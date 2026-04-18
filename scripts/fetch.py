"""
Daily GitHub Search API fetcher for wvb-cc-radar.

Usage:
  python scripts/fetch.py

Output: data/YYYY-MM-DD.json

Rate limits:
  - Anonymous: 10 req/min (Search API)
  - Authenticated (GITHUB_TOKEN env): 30 req/min, 5000/hour

4 categories × 1 query each = 4 requests per run. Very safe.
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
TOKEN = os.environ.get("GITHUB_TOKEN", "").strip()

RECENT_DAYS = 14


def recent_date(days: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    return d.strftime("%Y-%m-%d")


def categories() -> list[dict]:
    cutoff = recent_date(RECENT_DAYS)
    return [
        {
            "id": "claude-code",
            "title": "Claude Code 생태계",
            "subtitle": "Plugins · Skills · Sub-agents · Hooks · Workflows",
            "query": f'"claude-code" OR "claude code" OR "bkit" OR "claudecode" in:name,description,readme pushed:>{cutoff}',
            "top_n": 30,
            "priority": 1,
        },
        {
            "id": "mcp-servers",
            "title": "MCP 서버·도구",
            "subtitle": "Model Context Protocol servers & tools (CC-compatible)",
            "query": f'"model context protocol" OR "mcp-server" OR "mcp server" in:name,description pushed:>{cutoff}',
            "top_n": 10,
            "priority": 2,
        },
        {
            "id": "ai-agents",
            "title": "AI 에이전트 프레임워크",
            "subtitle": "LangGraph · CrewAI · AutoGen · multi-agent patterns",
            "query": f'langgraph OR crewai OR autogen OR "multi-agent framework" in:name,description pushed:>{cutoff}',
            "top_n": 10,
            "priority": 3,
        },
        {
            "id": "llm-prompts",
            "title": "LLM 프롬프트·워크플로우",
            "subtitle": "Prompt engineering · agentic workflows · LLM-native dev",
            "query": f'"prompt engineering" OR "agentic workflow" OR "llm workflow" OR "prompt library" in:name,description pushed:>{cutoff}',
            "top_n": 10,
            "priority": 4,
        },
    ]


def gh_request(url: str) -> tuple[dict, dict]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "wvb-cc-radar/0.1",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if TOKEN:
        headers["Authorization"] = f"Bearer {TOKEN}"
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
    url = f"{GITHUB_API}/search/repositories?q={encoded}&sort=stars&order=desc&per_page={per_page}"
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


def load_yesterday_stars() -> dict[str, int]:
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    path = DATA_DIR / f"{yesterday}.json"
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            digest = json.load(f)
        stars_map: dict[str, int] = {}
        for cat in digest.get("categories", []):
            for item in cat.get("items", []):
                stars_map[item["full_name"]] = item.get("stargazers_count", 0)
        return stars_map
    except Exception as e:
        print(f"Failed to load yesterday: {e}", file=sys.stderr)
        return {}


def is_new_this_week(created_at: str) -> bool:
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - created).days <= 7
    except Exception:
        return False


def main() -> int:
    start = time.time()
    auth_status = "authenticated" if TOKEN else "ANONYMOUS"
    print(f"[wvb-cc-radar] fetch start, mode={auth_status}")

    yesterday_stars = load_yesterday_stars()
    print(f"[yesterday] loaded {len(yesterday_stars)} prior repos for delta")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    categories_result = []
    total_repos = 0
    total_new = 0
    rate_remaining = None

    for cat in categories():
        print(f"[fetch] {cat['id']}: {cat['query'][:90]}...")
        try:
            items, hdrs = search_repos(cat["query"], per_page=cat["top_n"])
            rate_remaining = hdrs.get("X-RateLimit-Remaining", rate_remaining)
        except Exception as e:
            print(f"  FAIL: {e}", file=sys.stderr)
            items = []

        processed = []
        for item in items:
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
            "query": cat["query"],
            "total_count": len(processed),
            "items": processed,
        })
        total_repos += len(processed)
        print(f"  -> {len(processed)} repos")

        # Pace requests: anonymous 10/min = sleep 7s, authenticated 30/min = sleep 2s
        time.sleep(2 if TOKEN else 7)

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
        },
    }

    out = DATA_DIR / f"{today}.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(digest, f, ensure_ascii=False, indent=2)

    print(f"[done] {total_repos} repos, {total_new} new this week, {duration_ms}ms")
    print(f"[done] rate_remaining={rate_remaining}, wrote={out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
