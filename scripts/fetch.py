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
"""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import quote_plus
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

GITHUB_API = "https://api.github.com"
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

RECENT_DAYS = 14


def recent_date(days: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def categories() -> list[dict]:
    cutoff = recent_date(RECENT_DAYS)
    suffix = f" pushed:>{cutoff}"
    return [
        {
            "id": "claude-code",
            "title": "Claude Code 생태계",
            "subtitle": "Plugins · Skills · Sub-agents · Hooks · Workflows",
            "queries": [
                "topic:claude-code" + suffix,
                '"claude-code" in:name' + suffix,
                '"bkit" in:name' + suffix,
            ],
            "top_n": 30,
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
            "id": "enterprise-ax",
            "title": "Enterprise AX · FDE",
            "subtitle": "Forward Deployed Engineer 모델, 기업 AI 전환 프레임워크",
            "queries": [
                "topic:enterprise-ai" + suffix,
                "topic:digital-transformation" + suffix,
                '"forward-deployed" in:name,description' + suffix,
            ],
            "top_n": 10,
            "priority": 3,
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
                "topic:multi-agent" + suffix,
                "topic:agent-orchestration" + suffix,
                '"orchestrator" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 5,
        },
        {
            "id": "mcp-servers",
            "title": "MCP 서버·도구",
            "subtitle": "Model Context Protocol servers & tools (CC-compatible)",
            "queries": [
                "topic:model-context-protocol" + suffix,
                '"mcp-server" in:name' + suffix,
                '"mcp-servers" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 6,
        },
        {
            "id": "ai-agents",
            "title": "AI 에이전트 프레임워크",
            "subtitle": "LangGraph · CrewAI · AutoGen · multi-agent framework",
            "queries": [
                "topic:ai-agents" + suffix,
                '"langgraph" in:name' + suffix,
                '"crewai" in:name' + suffix,
                '"autogen" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 7,
        },
        {
            "id": "llm-prompts",
            "title": "LLM 프롬프트·워크플로우",
            "subtitle": "Prompt engineering · agentic workflows · LLM-native dev",
            "queries": [
                "topic:prompt-engineering" + suffix,
                "topic:agentic-workflow" + suffix,
                '"prompt-engineering" in:name' + suffix,
            ],
            "top_n": 10,
            "priority": 8,
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


def extract_repo(item: dict) -> dict:
    full_name = item["full_name"]
    return {
        "id": item["id"],
        "full_name": full_name,
        "name": item["name"],
        "owner": item["owner"]["login"],
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


def load_yesterday_stars_and_ko() -> tuple[dict[str, int], dict[str, str]]:
    """Load yesterday's snapshot to carry over star counts (for delta) and
    translations (for cost savings - don't re-translate unchanged descriptions).
    """
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    path = DATA_DIR / f"{yesterday}.json"
    if not path.exists():
        return {}, {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            digest = json.load(f)
        stars: dict[str, int] = {}
        ko: dict[str, str] = {}
        for cat in digest.get("categories", []):
            for item in cat.get("items", []):
                stars[item["full_name"]] = item.get("stargazers_count", 0)
                if item.get("description_ko") and item.get("description"):
                    # Key = (full_name, original_desc) so stale descriptions re-translate
                    ko[f"{item['full_name']}|{item['description']}"] = item["description_ko"]
        return stars, ko
    except Exception as e:
        print(f"Failed to load yesterday: {e}", file=sys.stderr)
        return {}, {}


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


def translate_all_descriptions(
    categories_result: list[dict],
    ko_cache: dict[str, str],
    batch_size: int = 15,
) -> tuple[int, int]:
    """Mutates items in-place, adding `description_ko` field.
    Returns (translated_count, cached_count).
    """
    if not GEMINI_API_KEY:
        print("[translate] GEMINI_API_KEY not set, skipping translations")
        return 0, 0

    # collect items needing translation
    todo: list[tuple[dict, str]] = []  # (item_ref, description)
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

    print(f"[translate] {cached} cached, {len(todo)} to translate via Gemini")

    translated = 0
    for i in range(0, len(todo), batch_size):
        batch = todo[i : i + batch_size]
        descriptions = [d for _, d in batch]
        results = gemini_translate_batch(descriptions)
        for (item, _), ko in zip(batch, results):
            if ko:
                item["description_ko"] = ko
                translated += 1
        # Gemini free tier 15 RPM -> 5s between batches
        if i + batch_size < len(todo):
            time.sleep(5)

    return translated, cached


# ============================================================
# Main
# ============================================================

def sleep_between() -> None:
    time.sleep(2 if GITHUB_TOKEN else 7)


def main() -> int:
    start = time.time()
    gh_mode = "authenticated" if GITHUB_TOKEN else "ANONYMOUS"
    gm_mode = "ENABLED" if GEMINI_API_KEY else "disabled"
    print(f"[wvb-cc-radar] start | GitHub={gh_mode} | Gemini={gm_mode}")

    yesterday_stars, ko_cache = load_yesterday_stars_and_ko()
    print(f"[yesterday] {len(yesterday_stars)} prior stars, {len(ko_cache)} cached translations")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    categories_result = []
    total_repos = 0
    total_new = 0
    rate_remaining = None

    for cat in categories():
        per_query = max(cat["top_n"], 30)
        merged: dict[str, dict] = {}
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
            repo = extract_repo(item)
            prev = yesterday_stars.get(repo["full_name"])
            if prev is not None:
                repo["stars_delta_24h"] = repo["stargazers_count"] - prev
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

    # Translate descriptions
    translated, cached = translate_all_descriptions(categories_result, ko_cache)

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
            "query_mode": "v0.3-8cat-with-kr",
        },
    }

    out = DATA_DIR / f"{today}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=2)

    print(f"[done] {total_repos} repos, {total_new} new, KR {translated} new / {cached} cached, {duration_ms}ms")
    print(f"[done] rate_remaining={rate_remaining}, wrote={out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
