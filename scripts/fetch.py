"""
Daily GitHub Search API fetcher for wvb-cc-radar + Gemini KR translation.

Usage:
  python scripts/fetch.py

Output: data/YYYY-MM-DD.json

Env:
  GITHUB_TOKEN    - optional, 5000/hr if set (else anonymous 60/hr)
  GEMINI_API_KEY  - optional, if set translates `description` → `description_ko`

Rate limits:
  - GitHub Search: 30 req/min (authenticated)
  - Gemini 2.0 Flash free tier: 15 RPM, 1M tokens/day

# 누락 방지 디자인 (2026-05-15 추가)
Viral repo 가 모든 search 조건에서 빠져 누락되는 패턴을 막는 3-tier 전략:

  T1 - 트렌딩 (suffix, 14d window)
       토픽·이름·짧은 description match. "지금 뜨고 있는" 신호.
       기존 쿼리 4종(예: claude-code).

  T2 - 안정 viral (suffix_long, 60d window, stars:>5000)
       README 매치 + 더 넓은 description 키워드. 안정기 진입한 viral repo
       (월간 commit cadence) catch. 핵심: 높은 stars 임계로 노이즈 제거.

  T3 - 영구 viral (NO pushed cutoff, stars:>20000-50000)
       토픽 매치 + 매우 높은 stars floor. 분기간 정체된 안정 hit
       (예: dair-ai/Prompt-Engineering-Guide 65d, nextlevelbuilder/
       ui-ux-pro-max-skill 42d) 영구 catch. 토픽이 있어야 동작.

# 4-way exclusion 패턴 (방지 대상)
Viral repo 가 다음 4가지 조건에 모두 어긋나면 모든 T1 쿼리 누락:
  (1) GitHub topics 미부여, (2) name pattern 미매칭,
  (3) description 키워드 미포함, (4) pushed_at > 14d cutoff

대응: T2/T3가 (1)~(3)을 우회하고, suffix_long/no-cutoff가 (4)를 우회.
모두 빠지면 → claude-code-curated.json 또는 *-seed.json 에 명시 등록.
실제 사례: msitarzewski/agency-agents 97k stars (2026-05-15 RCA + 시스템 fix).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import quote_plus
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

KOREAN_OWNERS_FILE = DATA_DIR / "korean-owners.json"
VIBECODED_FILE = DATA_DIR / "vibecoded-products.json"
APPLICATIONS_SEED_FILE = DATA_DIR / "applications-seed.json"
CLAUDE_CODE_CURATED_FILE = DATA_DIR / "claude-code-curated.json"


def load_korean_owners() -> list[str]:
    """Load Korean GitHub owner logins from data/korean-owners.json.

    Enables listing Korean-made repos whose descriptions have no Korean-language
    markers (e.g. popup-studio-ai/bkit-claude-code — English desc, Korean team).
    Failure to read returns an empty list so the main flow continues.
    """
    if not KOREAN_OWNERS_FILE.exists():
        return []
    try:
        with open(KOREAN_OWNERS_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        owners = raw.get("owners", [])
        logins = [o.get("login", "").strip() for o in owners if o.get("login")]
        return [l for l in logins if l]
    except Exception as e:
        print(f"[korean-owners] failed to read {KOREAN_OWNERS_FILE}: {e}", file=sys.stderr)
        return []


def load_applications_seed() -> list[str]:
    """Load full_name list from data/applications-seed.json.

    Applications 카테고리는 search-driven이지만 GitHub topic 미부여로 검색에
    잡히지 않는 도메인 응용을 강제 포함하기 위해 explicit seed allowlist를
    병행. 각 full_name은 vibecoded와 동일하게 /repos/{full_name} direct fetch.
    """
    if not APPLICATIONS_SEED_FILE.exists():
        return []
    try:
        with open(APPLICATIONS_SEED_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [p["full_name"] for p in raw.get("products", []) if p.get("full_name")]
    except Exception as e:
        print(f"[applications-seed] failed to read {APPLICATIONS_SEED_FILE}: {e}", file=sys.stderr)
        return []


def load_claude_code_curated() -> list[str]:
    """Load full_name list from data/claude-code-curated.json.

    Viral Claude Code 셋업·skill·tool repo가 `topic:claude-code` 미부여 +
    이름에 'claude-code'/'bkit' 미포함이라 search에서 누락되는 케이스 보강.
    예: garrytan/gstack (89k stars, topic 없음, 이름이 'gstack'). 각 full_name은
    `repo:owner/name` direct fetch로 강제 포함되며 main loop에서 search 결과와
    merge 후 stargazers 정렬로 top_n 선별.
    """
    if not CLAUDE_CODE_CURATED_FILE.exists():
        return []
    try:
        with open(CLAUDE_CODE_CURATED_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [p["full_name"] for p in raw.get("products", []) if p.get("full_name")]
    except Exception as e:
        print(f"[claude-code-curated] failed to read {CLAUDE_CODE_CURATED_FILE}: {e}", file=sys.stderr)
        return []


def load_vibecoded_allowlist() -> list[str]:
    """Load full_name list from data/vibecoded-products.json.

    Vibecoded Products는 엔드유저 앱만 엄격 큐레이션하므로 allowlist 방식.
    각 full_name(owner/repo)은 `repo:owner/repo` 쿼리로 개별 조회.
    """
    if not VIBECODED_FILE.exists():
        return []
    try:
        with open(VIBECODED_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        return [p["full_name"] for p in raw.get("products", []) if p.get("full_name")]
    except Exception as e:
        print(f"[vibecoded] failed to read {VIBECODED_FILE}: {e}", file=sys.stderr)
        return []


GITHUB_API = "https://api.github.com"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# Claude API fallback — kicks in only when Claude CLI + Gemini both fail.
# Uses a separate (paid) quota pool. x-api-key = per-token billing.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
CLAUDE_MODEL = "claude-haiku-4-5-20251001"
CLAUDE_URL = "https://api.anthropic.com/v1/messages"

# Claude CLI (Max 구독, $0) — 주 번역기 (2026-07-04 전환: 유료 API → Max 구독).
# `claude -p`로 로그인된 Max 구독을 사용(토큰당 과금 없음). snapterminal/labor-advisor CLI 패턴.
# 인증: 로컬 ~/.claude 로그인 또는 CI의 CLAUDE_CODE_OAUTH_TOKEN(CLI가 자동 인식). API 키 불요.
CLAUDE_CLI = os.environ.get("CLAUDE_CLI_PATH", "claude").strip() or "claude"
CLAUDE_CLI_MODEL = os.environ.get("CLAUDE_CLI_MODEL", "haiku").strip() or "haiku"
USE_CLAUDE_CLI = os.environ.get("USE_CLAUDE_CLI", "1").strip().lower() not in ("0", "false", "no")

RECENT_DAYS = 14


def recent_date(days: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def categories() -> list[dict]:
    cutoff = recent_date(RECENT_DAYS)
    suffix = f" pushed:>{cutoff}"
    # Relaxed 60d window for high-star (>5k) signal queries. Catches viral
    # repos with monthly cadence that get filtered by the standard 14d window.
    # Real example: msitarzewski/agency-agents (97k stars, pushed_at=2026-04-12,
    # 33d ago, no topic, name 미매칭, description에 "claude code" 미포함) —
    # 14d cutoff + topic/name 4중 누락으로 search에서 빠졌음 (2026-05-15 발견).
    suffix_long = f" pushed:>{recent_date(60)}"
    korean_owners = load_korean_owners()
    vibecoded_full_names = load_vibecoded_allowlist()
    # Vibecoded는 엔드유저 앱 allowlist. pushed 필터 안 씀 (업데이트 주기 다양).
    vibecoded_queries = [f"repo:{fn}" for fn in vibecoded_full_names]
    applications_seed_names = load_applications_seed()
    applications_seed_queries = [f"repo:{fn}" for fn in applications_seed_names]
    claude_code_curated_names = load_claude_code_curated()
    claude_code_seed_queries = [f"repo:{fn}" for fn in claude_code_curated_names]
    # GitHub search: `user:<login>` matches both users and orgs (they share
    # the same login namespace). One query per owner, no fork/archive filter
    # since these are curated logins we already trust.
    korean_owner_queries = [f"user:{login}{suffix}" for login in korean_owners]
    return [
        {
            "id": "claude-code",
            "title": "Claude Code 생태계",
            "subtitle": "Plugins · Skills · Sub-agents · Hooks · Workflows",
            "queries": [
                # T1 trending (14d)
                "topic:claude-code" + suffix,
                '"claude-code" in:name' + suffix,
                '"bkit" in:name' + suffix,
                # T1 description match (viral missing topic, e.g. gstack)
                '"claude code" in:description stars:>500' + suffix,
                # T2 README match (60d) — catches "Use with Claude Code" type
                # mentions when description has no CC keyword (msitarzewski/
                # agency-agents 97k 사례). awesome-list 노이즈 회피 위해
                # "with claude code" 구문 사용.
                '"with claude code" in:readme stars:>5000' + suffix_long,
                # T3 stable viral (NO pushed cutoff) — topic-based 안정기
                # CC repo 영구 catch (예: ui-ux-pro-max-skill 42d 정체 78k).
                "topic:claude-code stars:>50000",
            ],
            # Hybrid: search-driven + explicit allowlist for repos that slip
            # through both topic and name filters. data/claude-code-curated.json.
            "seed_queries": claude_code_seed_queries,
            "top_n": 15,
            "priority": 1,
        },
        {
            "id": "vibe-coding",
            "title": "Vibe Coding 도구",
            "subtitle": "Cursor·Bolt·Lovable·v0 계열 대안, AI IDE, 비개발자 코딩",
            "queries": [
                "topic:ai-coding" + suffix,
                "topic:ai-ide" + suffix,
                '"ai-coding" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 2,
        },
        {
            "id": "vibecoded-products",
            "title": "Vibecoded Products",
            "subtitle": "AI 시대에 만들어진 완성된 엔드유저 앱·서비스 (프레임워크·SDK·라이브러리 제외)",
            # Allowlist-only: data/vibecoded-products.json 의 full_name 목록을
            # `repo:owner/name` 개별 쿼리로 정확 조회. 엄격한 수동 큐레이션으로
            # 개발자 도구·라이브러리 유입 차단.
            "queries": vibecoded_queries,
            "top_n": 15,
            "priority": 3,
        },
        {
            "id": "applications",
            "title": "Applications · 비즈니스·실생활 응용",
            "subtitle": "AI 시대 finance·trading·productivity·legal·healthcare·edtech·martech 응용 — 라이브러리가 아닌 \"쓰면 가치 나오는\" 도구·시스템",
            # Hybrid: search-driven topic 쿼리 7개 도메인 + applications-seed.json
            # explicit allowlist (search에 안 잡히는 항목 강제 포함). main loop의
            # applications 분기에서 search items + seed direct fetch 둘 다 merge
            # 후 stargazers 정렬로 top_n 선별.
            "queries": [
                # finance · trading
                "topic:ai topic:finance" + suffix,
                "topic:ai topic:trading" + suffix,
                "topic:fintech topic:ai" + suffix,
                # productivity · personal-assistant
                "topic:productivity topic:ai" + suffix,
                "topic:personal-assistant topic:ai" + suffix,
                # legal-tech
                "topic:legal-tech" + suffix,
                "topic:legaltech" + suffix,
                # healthcare · medical
                "topic:healthcare topic:ai" + suffix,
                "topic:medical-ai" + suffix,
                # edtech
                "topic:edtech topic:ai" + suffix,
                # martech · marketing-automation
                "topic:marketing-automation topic:ai" + suffix,
                # creator-tools · content-creation
                "topic:creator-tools topic:ai" + suffix,
                "topic:content-creation topic:ai" + suffix,
            ],
            # Direct-fetch seed (separate field — main loop에서 별도 처리).
            "seed_queries": applications_seed_queries,
            "top_n": 10,
            "priority": 4,
        },
        {
            "id": "rag-kb",
            "title": "RAG · 지식 베이스",
            "subtitle": "LLM knowledge base, retrieval-augmented generation, wiki 자동화",
            "queries": [
                "topic:rag" + suffix,
                "topic:retrieval-augmented-generation" + suffix,
                '"knowledge-base" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 4,
        },
        {
            "id": "agent-orchestration",
            "title": "Agent Orchestration · Router",
            "subtitle": "Multi-agent coordinator, handoff patterns, agent routing",
            "queries": [
                # T1 trending (14d)
                "topic:multi-agent" + suffix,
                "topic:agent-orchestration" + suffix,
                '"orchestrator" in:name' + suffix,
                # T3 stable viral — topic-based, 안정기 multi-agent 도구 catch
                "topic:multi-agent stars:>20000",
            ],
            "top_n": 10,
            "priority": 5,
        },
        {
            "id": "mcp-servers",
            "title": "MCP 서버·도구",
            "subtitle": "Model Context Protocol servers & tools (CC-compatible)",
            "queries": [
                # T1 trending (14d)
                "topic:model-context-protocol" + suffix,
                '"mcp-server" in:name' + suffix,
                '"mcp-servers" in:name' + suffix,
                # T2 README match (60d) — MCP topic 미부여 server catch.
                # "is an MCP server" 문구가 가장 정확 (대부분 MCP server README
                # 첫 줄에 등장). 일반 "MCP server" 매치는 노이즈 너무 많음.
                '"is an MCP server" in:readme stars:>500' + suffix_long,
                # T3 stable viral — MCP topic 채택률 낮아 stars:>10k floor
                "topic:model-context-protocol stars:>10000",
            ],
            "top_n": 10,
            "priority": 6,
        },
        {
            "id": "ai-agents",
            "title": "AI 에이전트 프레임워크",
            "subtitle": "LangGraph · CrewAI · AutoGen · multi-agent framework",
            "queries": [
                # T1 trending (14d)
                "topic:ai-agents" + suffix,
                '"langgraph" in:name' + suffix,
                '"crewai" in:name' + suffix,
                '"autogen" in:name' + suffix,
                # T2 README match (60d) — "multi-agent framework" 구문이
                # 프레임워크 자체 식별에 가장 정확. 일반 "ai agent"는 노이즈 다수.
                '"multi-agent framework" in:readme stars:>10000' + suffix_long,
                # T3 stable viral — langchain/crewai/autogen 같은 정착 hit catch
                "topic:ai-agents stars:>30000",
            ],
            "top_n": 10,
            "priority": 7,
        },
        {
            "id": "llm-prompts",
            "title": "LLM 프롬프트·워크플로우",
            "subtitle": "Prompt engineering · agentic workflows · LLM-native dev",
            "queries": [
                # T1 trending (14d)
                "topic:prompt-engineering" + suffix,
                "topic:agentic-workflow" + suffix,
                '"prompt-engineering" in:name' + suffix,
                # T3 stable viral — Prompt-Engineering-Guide 같은 분기간
                # 정체 대형 hit catch (65d 사례). topic 채택률 양호.
                "topic:prompt-engineering stars:>20000",
            ],
            "top_n": 10,
            "priority": 8,
        },
        {
            "id": "korean-opensource",
            "title": "한국 오픈소스",
            "subtitle": "Claude Code·MCP·RAG·Agent·Vibe Coding — 한국인이 한국 시장·사용자 대상으로 만든 프로젝트",
            # Strategy: cover ALL 8 existing category topics × Korean signals.
            # Korean signals: "korean" in name/description, "한국" in description, topic:korean.
            # Examples: NomaDamas/k-skill, kimlawtech/korean-privacy-terms.
            "queries": [
                # (1) Claude Code × Korean
                'topic:claude-code "korean" in:name,description' + suffix,
                '"한국" in:description topic:claude-code' + suffix,
                # (2) Vibe Coding × Korean
                'topic:ai-coding "korean" in:name,description' + suffix,
                # (3) Enterprise AX × Korean
                'topic:enterprise-ai "korean" in:name,description' + suffix,
                # (4) RAG × Korean
                'topic:rag "korean" in:name,description' + suffix,
                # (5) Agent Orchestration × Korean
                'topic:multi-agent "korean" in:name,description' + suffix,
                # (6) MCP × Korean (both topic variants)
                'topic:mcp "korean" in:name,description' + suffix,
                'topic:model-context-protocol "korean" in:name,description' + suffix,
                # (7) AI Agents × Korean
                'topic:ai-agents "korean" in:name,description' + suffix,
                # (8) LLM / Prompt × Korean
                'topic:llm "korean" in:name,description' + suffix,
                'topic:prompt-engineering "korean" in:name,description' + suffix,
                # Korean topic direct
                'topic:korean topic:llm' + suffix,
                'topic:korean topic:ai-agents' + suffix,
                # Hangul description catch-all
                '"한국" in:description topic:llm' + suffix,
                '"한국어" in:description topic:llm' + suffix,
                # (9) Known Korean owner allowlist — covers repos with
                # English-only descriptions from Korean teams (e.g. bkit).
                # Entries in data/korean-owners.json.
                *korean_owner_queries,
            ],
            "top_n": 15,  # larger pool, UI re-ranks by Korean Quality Score
            "priority": 9,
        },
    ]


# ============================================================
# GitHub Search
# ============================================================

def gh_request(url: str) -> tuple[dict, dict]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "wvb-cc-radar/0.3",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data, dict(resp.headers)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {body[:400]}", file=sys.stderr)
        raise


def search_repos(query: str, per_page: int) -> tuple[list[dict], dict]:
    encoded = quote_plus(query)
    url = (
        f"{GITHUB_API}/search/repositories"
        f"?q={encoded}&sort=stars&order=desc&per_page={per_page}"
    )
    data, hdrs = gh_request(url)
    return data.get("items", []), hdrs


def get_repo_direct(full_name: str) -> tuple[dict | None, dict]:
    """Direct repo fetch via /repos/{owner}/{name}.

    GitHub Search API does NOT support `repo:owner/name` as a limiter in
    repository search — it's only valid in issue/code search. For allowlist
    carry-through (vibecoded-products), we hit the repo endpoint directly.
    Returns (item, headers); item=None on 404 so callers can skip silently.
    """
    url = f"{GITHUB_API}/repos/{full_name}"
    try:
        data, hdrs = gh_request(url)
        return data, hdrs
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"[direct] 404 {full_name}", file=sys.stderr)
            return None, {}
        raise


def extract_repo(item: dict, korean_owners: set[str] | None = None) -> dict:
    full_name = item["full_name"]
    owner = item["owner"]["login"]
    repo = {
        "id": item["id"],
        "full_name": full_name,
        "name": item["name"],
        "owner": owner,
        "description": item.get("description"),
        "html_url": item["html_url"],
        "homepage": item.get("homepage"),
        "stargazers_count": item.get("stargazers_count", 0),
        "forks_count": item.get("forks_count", 0),
        "language": item.get("language"),
        "topics": item.get("topics", []) or [],
        "pushed_at": item["pushed_at"],
        "created_at": item["created_at"],
        "updated_at": item["updated_at"],
        "opengraph_url": f"https://opengraph.githubassets.com/1/{full_name}",
    }
    # Case-insensitive owner match — GitHub logins are case-insensitive in
    # search but the raw API preserves casing (e.g. "Yeachan-Heo").
    if korean_owners and owner.lower() in korean_owners:
        repo["korean_owner"] = True
    return repo


def load_prior_translations() -> tuple[dict[str, int], dict[str, str]]:
    """Load translations from today's + yesterday's snapshot.

    - Yesterday JSON: carries over star counts (for 24h delta) AND translations.
    - Today JSON (if exists): re-uses translations from prior run — lets the
      script be re-run to fill in items that hit Gemini rate limits earlier,
      without re-translating what already succeeded.
    """
    stars: dict[str, int] = {}
    ko: dict[str, str] = {}
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    for date, is_yesterday in [(yesterday, True), (today, False)]:
        path = DATA_DIR / f"{date}.json"
        if not path.exists():
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                digest = json.load(f)
            for cat in digest.get("categories", []):
                for item in cat.get("items", []):
                    if is_yesterday:
                        stars[item["full_name"]] = item.get("stargazers_count", 0)
                    if item.get("description_ko") and item.get("description"):
                        ko[f"{item['full_name']}|{item['description']}"] = item["description_ko"]
        except Exception as e:
            print(f"[cache] failed to read {date}.json: {e}", file=sys.stderr)
    return stars, ko


def load_weekly_baseline() -> tuple[dict[str, dict], int]:
    """Load the oldest snapshot within the last 7 days for weekly-delta math.

    Returns ({full_name: {stars, forks}}, window_days). Prefers the snapshot
    closest to exactly 7d ago; falls back to the oldest we have so the site
    shows meaningful deltas even during the first week of operation (when the
    history is shorter than 7 days).

    The mini-window is the primary signal bkamp.ai-style "this week's hottest"
    depends on; raw cumulative stars hide fresh viral momentum.
    """
    today = datetime.now(timezone.utc).date()
    candidates: list[tuple[int, Path]] = []
    for delta_days in range(7, 0, -1):
        d = today - timedelta(days=delta_days)
        p = DATA_DIR / f"{d.strftime('%Y-%m-%d')}.json"
        if p.exists():
            candidates.append((delta_days, p))
    if not candidates:
        return {}, 0
    # Prefer the oldest snapshot we have (largest delta_days) so the window
    # approximates a real "week of activity" as soon as possible.
    delta_days, path = max(candidates, key=lambda c: c[0])
    baseline: dict[str, dict] = {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            digest = json.load(f)
        for cat in digest.get("categories", []):
            for item in cat.get("items", []):
                fn = item["full_name"]
                if fn not in baseline:
                    baseline[fn] = {
                        "stars": item.get("stargazers_count", 0),
                        "forks": item.get("forks_count", 0),
                    }
    except Exception as e:
        print(f"[weekly] failed to read {path}: {e}", file=sys.stderr)
        return {}, 0
    print(f"[weekly] baseline from {path.name} ({delta_days}d window), {len(baseline)} repos")
    return baseline, delta_days


def is_new_this_week(created_at: str) -> bool:
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - created).days <= 7
    except Exception:
        return False


# ============================================================
# Gemini Translation
# ============================================================

def gemini_translate_batch(descriptions: list[str]) -> list[str | None]:
    """
    Translate English descriptions to natural Korean via Gemini 2.0 Flash.
    Returns list of KR strings aligned with input (None if translation failed).
    """
    if not GEMINI_API_KEY or not descriptions:
        return [None] * len(descriptions)

    numbered = "\n".join(f"{i+1}. {d}" for i, d in enumerate(descriptions))
    prompt = (
        "You are a technical translator. Translate the following GitHub repo "
        "descriptions from English to natural, concise Korean. Rules:\n"
        "- Preserve technical terms, product names, and acronyms as-is "
        "(e.g., MCP, LLM, RAG, Claude Code, LangGraph).\n"
        "- 1 sentence per item, under 80 Korean characters.\n"
        "- Use 문어체 (written style), not 구어체.\n"
        "- No period at end.\n"
        "- If the description is already Korean or non-English, return as-is.\n"
        "- Output strictly as a JSON array of strings in the same order.\n\n"
        f"Input ({len(descriptions)} items):\n{numbered}\n\n"
        "Output JSON array:"
    )

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 2048,
            "responseMimeType": "application/json",
        },
    }

    try:
        req = urllib.request.Request(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        if not isinstance(parsed, list) or len(parsed) != len(descriptions):
            print(f"[translate] length mismatch {len(parsed)}/{len(descriptions)}", file=sys.stderr)
            return [None] * len(descriptions)
        return [str(x) if x else None for x in parsed]
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        print(f"[translate] HTTP {e.code}: {body_text[:300]}", file=sys.stderr)
        return [None] * len(descriptions)
    except Exception as e:
        print(f"[translate] error: {e}", file=sys.stderr)
        return [None] * len(descriptions)


# ============================================================
# Claude Fallback Translation
# ============================================================

def claude_translate_batch(descriptions: list[str]) -> list[str | None]:
    """
    Translate English → Korean via Claude Haiku 4.5.
    Same prompt rules as Gemini. Used only when Gemini batch is all-failed
    (daily quota exhausted / 429), so daily traffic stays minimal.
    Returns list aligned with input (None on failure).
    """
    if not ANTHROPIC_API_KEY or not descriptions:
        return [None] * len(descriptions)

    numbered = "\n".join(f"{i+1}. {d}" for i, d in enumerate(descriptions))
    prompt = (
        "You are a technical translator. Translate the following GitHub repo "
        "descriptions from English to natural, concise Korean. Rules:\n"
        "- Preserve technical terms, product names, and acronyms as-is "
        "(e.g., MCP, LLM, RAG, Claude Code, LangGraph).\n"
        "- 1 sentence per item, under 80 Korean characters.\n"
        "- Use 문어체 (written style), not 구어체.\n"
        "- No period at end.\n"
        "- If the description is already Korean or non-English, return as-is.\n"
        "- Output strictly as a JSON array of strings in the same order. "
        "No markdown fences, no prose before/after.\n\n"
        f"Input ({len(descriptions)} items):\n{numbered}"
    )

    body = {
        "model": CLAUDE_MODEL,
        "max_tokens": 2048,
        "temperature": 0.2,
        "messages": [{"role": "user", "content": prompt}],
    }

    try:
        req = urllib.request.Request(
            CLAUDE_URL,
            data=json.dumps(body).encode("utf-8"),
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        text = data["content"][0]["text"].strip()
        # Strip accidental ```json fences if model ignored the rule
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        parsed = json.loads(text)
        if not isinstance(parsed, list) or len(parsed) != len(descriptions):
            print(f"[translate/claude] length mismatch {len(parsed)}/{len(descriptions)}", file=sys.stderr)
            return [None] * len(descriptions)
        return [str(x) if x else None for x in parsed]
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        print(f"[translate/claude] HTTP {e.code}: {body_text[:300]}", file=sys.stderr)
        return [None] * len(descriptions)
    except Exception as e:
        print(f"[translate/claude] error: {e}", file=sys.stderr)
        return [None] * len(descriptions)


# ============================================================
# Claude CLI Translation (Max subscription, $0) — 주 번역기
# ============================================================

def claude_cli_translate_batch(descriptions: list[str]) -> list[str | None]:
    """
    Translate English → Korean via the `claude` CLI (Max 구독, $0).
    2026-07-04 전환: 유료 API(Gemini/Anthropic) 대신 Max 구독 `claude -p` 주 사용.
    인증: 로컬 ~/.claude 로그인 또는 CI의 CLAUDE_CODE_OAUTH_TOKEN. API 키 불요.
    Same prompt rules as Gemini/Claude-API. Returns list aligned with input (None on failure).
    """
    if not USE_CLAUDE_CLI or not descriptions:
        return [None] * len(descriptions)
    cli_path = shutil.which(CLAUDE_CLI)
    if cli_path is None:
        print("[translate/claude-cli] `claude` CLI not on PATH -- skipping (fallback to paid API if configured)", file=sys.stderr)
        return [None] * len(descriptions)

    numbered = "\n".join(f"{i+1}. {d}" for i, d in enumerate(descriptions))
    prompt = (
        "You are a technical translator. Translate the following GitHub repo "
        "descriptions from English to natural, concise Korean. Rules:\n"
        "- Preserve technical terms, product names, and acronyms as-is "
        "(e.g., MCP, LLM, RAG, Claude Code, LangGraph).\n"
        "- 1 sentence per item, under 80 Korean characters.\n"
        "- Use 문어체 (written style), not 구어체.\n"
        "- No period at end.\n"
        "- If the description is already Korean or non-English, return as-is.\n"
        "- Output strictly as a JSON array of strings in the same order. "
        "No markdown fences, no prose before/after.\n\n"
        f"Input ({len(descriptions)} items):\n{numbered}"
    )

    # 빈 임시 cwd → 상위 CLAUDE.md/memory/hooks 자동 로드 차단 (cache·지연 절감).
    with tempfile.TemporaryDirectory(prefix="cc-radar-claude-") as clean_cwd:
        cli_args = [
            "-p",
            "--model", CLAUDE_CLI_MODEL,
            "--output-format", "json",
            "--permission-mode", "bypassPermissions",
            "--no-session-persistence",
        ]
        # Windows: npm 전역 bin은 .CMD 셔임 → CreateProcess가 직접 실행 불가(WinError 2). cmd /c 경유.
        if os.name == "nt":
            cmd = ["cmd", "/c", cli_path, *cli_args]
        else:
            cmd = [cli_path, *cli_args]
        try:
            proc = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                cwd=clean_cwd,
                timeout=180,
            )
        except subprocess.TimeoutExpired:
            print("[translate/claude-cli] timeout after 180s", file=sys.stderr)
            return [None] * len(descriptions)
        except Exception as e:
            print(f"[translate/claude-cli] spawn error: {e}", file=sys.stderr)
            return [None] * len(descriptions)

        if proc.returncode != 0 and not proc.stdout.strip():
            print(f"[translate/claude-cli] exit {proc.returncode}: {proc.stderr[:300]}", file=sys.stderr)
            return [None] * len(descriptions)

        # `claude -p --output-format json` → {"result": "<text>", ...}
        try:
            envelope = json.loads(proc.stdout.strip())
            text = (envelope.get("result") or "").strip()
        except Exception as e:
            print(f"[translate/claude-cli] envelope parse failed: {e}; raw={proc.stdout[:200]}", file=sys.stderr)
            return [None] * len(descriptions)

        # result 텍스트 = JSON 배열. 우발적 ```json 펜스 제거.
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
            text = text.strip("` \n")
        try:
            parsed = json.loads(text)
        except Exception as e:
            print(f"[translate/claude-cli] result JSON parse failed: {e}; text={text[:200]}", file=sys.stderr)
            return [None] * len(descriptions)
        if not isinstance(parsed, list) or len(parsed) != len(descriptions):
            n = len(parsed) if isinstance(parsed, list) else "NA"
            print(f"[translate/claude-cli] length mismatch {n}/{len(descriptions)}", file=sys.stderr)
            return [None] * len(descriptions)
        return [str(x) if x else None for x in parsed]


def translate_batch(descriptions: list[str]) -> tuple[list[str | None], str]:
    """Unified translation entry point.
    우선순위: Claude CLI (Max 구독, $0) → Gemini(유료) → Anthropic API(유료) 폴백.

    Returns (results, provider_used) — 'claude-cli' | 'gemini' | 'claude' | '*-failed' | 'none'.
    """
    # Primary: Max 구독 CLI ($0)
    if USE_CLAUDE_CLI:
        cli_results = claude_cli_translate_batch(descriptions)
        if any(r is not None for r in cli_results):
            return cli_results, "claude-cli"
        # CLI 미가용/실패 → 아래 유료 폴백 (키 있을 때만)

    if GEMINI_API_KEY:
        results = gemini_translate_batch(descriptions)
        if any(r is not None for r in results):
            return results, "gemini"
        # Gemini all-failed — try Claude API if configured
        if ANTHROPIC_API_KEY:
            print("[translate] Gemini batch all-failed, falling back to Claude API", file=sys.stderr)
            claude_results = claude_translate_batch(descriptions)
            if any(r is not None for r in claude_results):
                return claude_results, "claude"
            return claude_results, "claude-failed"
        return results, "gemini-failed"
    if ANTHROPIC_API_KEY:
        return claude_translate_batch(descriptions), "claude"
    return [None] * len(descriptions), "none"


def translate_all_descriptions(
    categories_result: list[dict],
    ko_cache: dict[str, str],
    batch_size: int = 10,
    inter_batch_sleep: float = 10.0,
    retry_backoff: float = 30.0,
) -> tuple[int, int, list[str], dict[str, int]]:
    """Mutates items in-place, adding `description_ko` field.

    Uses Gemini 2.0 Flash (primary, free tier 15 RPM / 1M tok/day).
    Falls back to Claude Haiku when Gemini batch returns all-None
    (typically: daily quota exhaustion → HTTP 429).

    Returns (translated_count, cached_count, failed_repo_names, provider_stats).
    """
    if not USE_CLAUDE_CLI and not GEMINI_API_KEY and not ANTHROPIC_API_KEY:
        print("[translate] no translator available (Claude CLI disabled, no API keys) -- skipping")
        return 0, 0, [], {}

    todo: list[tuple[dict, str]] = []
    cached = 0
    for cat in categories_result:
        for item in cat["items"]:
            desc = item.get("description")
            if not desc or not desc.strip():
                continue
            cache_key = f"{item['full_name']}|{desc}"
            if cache_key in ko_cache:
                item["description_ko"] = ko_cache[cache_key]
                cached += 1
            else:
                todo.append((item, desc))

    providers_available = []
    if USE_CLAUDE_CLI: providers_available.append("claude-cli")
    if GEMINI_API_KEY: providers_available.append("gemini")
    if ANTHROPIC_API_KEY: providers_available.append("claude")
    print(
        f"[translate] {cached} cached, {len(todo)} to translate "
        f"(providers={'+'.join(providers_available)}, "
        f"batch={batch_size}, sleep={inter_batch_sleep}s, retry_after={retry_backoff}s)"
    )

    translated = 0
    failed_repos: list[str] = []
    provider_stats: dict[str, int] = {"claude-cli": 0, "gemini": 0, "claude": 0, "none": 0}
    for i in range(0, len(todo), batch_size):
        batch = todo[i : i + batch_size]
        descriptions = [d for _, d in batch]
        batch_idx = i // batch_size + 1

        results, provider = translate_batch(descriptions)
        # 1-time retry after backoff if all-None AND Gemini was the only provider that tried
        if all(r is None for r in results) and provider == "gemini-failed" and not ANTHROPIC_API_KEY:
            print(
                f"[translate] batch {batch_idx} all-failed, retry after {retry_backoff}s",
                file=sys.stderr,
            )
            time.sleep(retry_backoff)
            results, provider = translate_batch(descriptions)

        for (item, _), ko in zip(batch, results):
            if ko:
                item["description_ko"] = ko
                translated += 1
            else:
                failed_repos.append(item["full_name"])
        # Tally by provider that actually produced output
        key = provider if provider in ("claude-cli", "gemini", "claude") else "none"
        provider_stats[key] = provider_stats.get(key, 0) + sum(1 for r in results if r)

        if i + batch_size < len(todo):
            time.sleep(inter_batch_sleep)

    if failed_repos:
        print(f"[translate] {len(failed_repos)} still untranslated:", file=sys.stderr)
        for fn in failed_repos[:20]:
            print(f"  - {fn}", file=sys.stderr)

    return translated, cached, failed_repos, provider_stats


# ============================================================
# Main
# ============================================================

def sleep_between() -> None:
    time.sleep(2 if GITHUB_TOKEN else 7)


def main() -> int:
    start = time.time()
    gh_mode = "authenticated" if GITHUB_TOKEN else "ANONYMOUS"
    cli_mode = "ENABLED" if USE_CLAUDE_CLI else "disabled"
    gm_mode = "ENABLED" if GEMINI_API_KEY else "disabled"
    cl_mode = "ENABLED" if ANTHROPIC_API_KEY else "disabled"
    print(f"[wvb-cc-radar] start | GitHub={gh_mode} | Claude-CLI(Max)={cli_mode} | Gemini={gm_mode} | Claude-API-fallback={cl_mode}")

    korean_owners_set = {l.lower() for l in load_korean_owners()}
    print(f"[korean-owners] {len(korean_owners_set)} allowlisted owners")

    yesterday_stars, ko_cache = load_prior_translations()
    print(f"[cache] {len(yesterday_stars)} prior stars, {len(ko_cache)} cached translations")

    weekly_baseline, weekly_window_days = load_weekly_baseline()

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    categories_result = []
    total_repos = 0
    total_new = 0
    rate_remaining = None

    for cat in categories():
        per_query = max(cat["top_n"], 30)
        merged: dict[str, dict] = {}
        # Hybrid category: search-driven + explicit seed allowlist.
        # Search items 와 direct /repos seed fetch 둘 다 merge 후 stargazers 정렬.
        # Trigger: any category with `seed_queries` field
        # (currently: applications, claude-code).
        if cat.get("seed_queries"):
            # 1) Search queries (topic-based)
            for q in cat["queries"]:
                try:
                    items, hdrs = search_repos(q, per_page=per_query)
                    rate_remaining = hdrs.get("X-RateLimit-Remaining", rate_remaining)
                except Exception as e:
                    print(f"    FAIL search: {e}", file=sys.stderr)
                    items = []
                for item in items:
                    fn = item["full_name"]
                    if fn not in merged or item["stargazers_count"] > merged[fn]["stargazers_count"]:
                        merged[fn] = item
                sleep_between()
            # 2) Seed allowlist (direct /repos)
            seed_full_names = [q.replace("repo:", "", 1) for q in cat.get("seed_queries", [])]
            print(f"[fetch] applications seed ({len(seed_full_names)} direct /repos calls)")
            for fn in seed_full_names:
                try:
                    item, hdrs = get_repo_direct(fn)
                    rate_remaining = hdrs.get("X-RateLimit-Remaining", rate_remaining)
                    if item:
                        # Seed 항목은 search에서 잡혔어도 덮어쓰기 (도메인 정보 보존 미래 확장)
                        merged[item["full_name"]] = item
                except Exception as e:
                    print(f"    FAIL seed {fn}: {e}", file=sys.stderr)
                sleep_between()
            ranked = sorted(
                merged.values(),
                key=lambda i: i.get("stargazers_count", 0),
                reverse=True,
            )[: cat["top_n"]]
            processed = []
            for item in ranked:
                repo = extract_repo(item, korean_owners_set)
                prev = yesterday_stars.get(repo["full_name"])
                if prev is not None:
                    repo["stars_delta_24h"] = repo["stargazers_count"] - prev
                base = weekly_baseline.get(repo["full_name"])
                if base is not None and weekly_window_days > 0:
                    repo["stars_delta_7d"] = repo["stargazers_count"] - base["stars"]
                    repo["forks_delta_7d"] = repo["forks_count"] - base["forks"]
                    repo["delta_window_days"] = weekly_window_days
                if is_new_this_week(repo["created_at"]):
                    repo["is_new_this_week"] = True
                    total_new += 1
                processed.append(repo)
            categories_result.append({
                "category": cat["id"],
                "title": cat["title"],
                "subtitle": cat["subtitle"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "queries": cat["queries"] + cat.get("seed_queries", []),
                "total_count": len(processed),
                "items": processed,
            })
            total_repos += len(processed)
            print(f"  -> {len(merged)} merged ({len(seed_full_names)} from seed), kept top {len(processed)}")
            continue
        # Allowlist categories use direct /repos fetch (search API can't
        # constrain by full_name in repo search).
        if cat["id"] == "vibecoded-products":
            full_names = [q.replace("repo:", "", 1) for q in cat["queries"]]
            print(f"[fetch] {cat['id']} ({len(full_names)} direct /repos calls)")
            for fn in full_names:
                try:
                    item, hdrs = get_repo_direct(fn)
                    rate_remaining = hdrs.get("X-RateLimit-Remaining", rate_remaining)
                    if item:
                        merged[item["full_name"]] = item
                except Exception as e:
                    print(f"    FAIL {fn}: {e}", file=sys.stderr)
                sleep_between()
            ranked = sorted(
                merged.values(),
                key=lambda i: i.get("stargazers_count", 0),
                reverse=True,
            )[: cat["top_n"]]
            processed = []
            for item in ranked:
                repo = extract_repo(item, korean_owners_set)
                prev = yesterday_stars.get(repo["full_name"])
                if prev is not None:
                    repo["stars_delta_24h"] = repo["stargazers_count"] - prev
                base = weekly_baseline.get(repo["full_name"])
                if base is not None and weekly_window_days > 0:
                    repo["stars_delta_7d"] = repo["stargazers_count"] - base["stars"]
                    repo["forks_delta_7d"] = repo["forks_count"] - base["forks"]
                    repo["delta_window_days"] = weekly_window_days
                if is_new_this_week(repo["created_at"]):
                    repo["is_new_this_week"] = True
                    total_new += 1
                processed.append(repo)
            categories_result.append({
                "category": cat["id"],
                "title": cat["title"],
                "subtitle": cat["subtitle"],
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "queries": cat["queries"],
                "total_count": len(processed),
                "items": processed,
            })
            total_repos += len(processed)
            print(f"  -> {len(merged)} merged, kept top {len(processed)}")
            continue
        print(f"[fetch] {cat['id']} ({len(cat['queries'])} queries)")
        for q in cat["queries"]:
            try:
                items, hdrs = search_repos(q, per_page=per_query)
                rate_remaining = hdrs.get("X-RateLimit-Remaining", rate_remaining)
            except Exception as e:
                print(f"    FAIL: {e}", file=sys.stderr)
                items = []
            for item in items:
                fn = item["full_name"]
                if fn not in merged or item["stargazers_count"] > merged[fn]["stargazers_count"]:
                    merged[fn] = item
            sleep_between()

        ranked = sorted(
            merged.values(),
            key=lambda i: i.get("stargazers_count", 0),
            reverse=True,
        )[: cat["top_n"]]

        processed = []
        for item in ranked:
            repo = extract_repo(item, korean_owners_set)
            prev = yesterday_stars.get(repo["full_name"])
            if prev is not None:
                repo["stars_delta_24h"] = repo["stargazers_count"] - prev
            base = weekly_baseline.get(repo["full_name"])
            if base is not None and weekly_window_days > 0:
                repo["stars_delta_7d"] = repo["stargazers_count"] - base["stars"]
                repo["forks_delta_7d"] = repo["forks_count"] - base["forks"]
                repo["delta_window_days"] = weekly_window_days
            if is_new_this_week(repo["created_at"]):
                repo["is_new_this_week"] = True
                total_new += 1
            processed.append(repo)

        categories_result.append({
            "category": cat["id"],
            "title": cat["title"],
            "subtitle": cat["subtitle"],
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "queries": cat["queries"],
            "total_count": len(processed),
            "items": processed,
        })
        total_repos += len(processed)
        print(f"  -> {len(merged)} merged, kept top {len(processed)}")

    # Translate descriptions (Gemini primary, Claude fallback)
    translated, cached, failed, provider_stats = translate_all_descriptions(
        categories_result, ko_cache
    )

    duration_ms = int((time.time() - start) * 1000)
    digest = {
        "date": today,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "categories": categories_result,
        "meta": {
            "total_repos": total_repos,
            "total_new": total_new,
            "fetch_duration_ms": duration_ms,
            "rate_limit_remaining": int(rate_remaining) if rate_remaining else None,
            "translated_kr": translated,
            "translation_cache_hit": cached,
            "translation_failed": len(failed),
            "translation_failed_repos": failed if len(failed) <= 30 else failed[:30],
            "translation_providers": provider_stats,
            "query_mode": "v0.6-cc-curated",
            "weekly_window_days": weekly_window_days,
        },
    }

    out = DATA_DIR / f"{today}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=2)

    by_provider = ", ".join(f"{k}={v}" for k, v in provider_stats.items() if v > 0)
    print(
        f"[done] {total_repos} repos, {total_new} new | "
        f"KR: {translated} new ({by_provider}) + {cached} cached + {len(failed)} failed | {duration_ms}ms"
    )
    print(f"[done] rate_remaining={rate_remaining}, wrote={out}")
    return 0 if not failed else 0  # non-zero only on catastrophic error, not partial translation


if __name__ == "__main__":
    sys.exit(main())
