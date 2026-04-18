# wvb-cc-radar

**WVB Claude Code Radar** — Daily digest of trending GitHub repositories for Claude Code ecosystem upgrade.

## Categories (priority order)

1. **Claude Code 생태계** (primary, Top 30) — plugins, skills, sub-agents, hooks, workflows
2. **MCP 서버·도구** (Top 10) — Model Context Protocol
3. **AI 에이전트 프레임워크** (Top 10) — LangGraph, CrewAI, AutoGen
4. **LLM 프롬프트·워크플로우** (Top 10) — prompt engineering, agentic workflows

## Architecture

```
GitHub Actions cron (daily 00:00 UTC = 09:00 KST)
  → python scripts/fetch.py
  → GitHub Search API × 4 categories
  → data/YYYY-MM-DD.json (committed to Git)
  → Railway auto-rebuilds Next.js on push
  → Public static site
```

**Key design**: data lives in Git (free history + rollback). No database. Railway Hobby $5 covers web hosting only.

## Stack

- Next.js 14 App Router + TypeScript + Tailwind
- Python stdlib fetcher (no pip deps)
- GitHub Actions (free tier, 2000 min/month)
- Railway Hobby (~$3-5/month)

## Local dev

```bash
cd projects/wvb-cc-radar
npm install
cp .env.example .env
# (optional) set GITHUB_TOKEN for 5x rate limit headroom
python scripts/fetch.py        # generate today's data/YYYY-MM-DD.json
npm run dev                     # http://localhost:3000
```

## Deploy (Railway Hobby)

1. GitHub repo 생성 후 push
2. Railway → New Project → Deploy from GitHub repo → select this folder
3. (선택) Railway env에 `GITHUB_TOKEN` 추가 (없어도 GH Actions는 secrets.GITHUB_TOKEN 자동 사용)
4. GitHub Actions 자동 활성화 (`.github/workflows/daily-fetch.yml`)

## Data schema

`data/YYYY-MM-DD.json`:

```jsonc
{
  "date": "2026-04-18",
  "generated_at": "2026-04-18T00:00:15Z",
  "categories": [
    {
      "category": "claude-code",
      "title": "Claude Code 생태계",
      "subtitle": "...",
      "query": "...",
      "items": [
        {
          "full_name": "anthropics/claude-code",
          "stargazers_count": 12345,
          "stars_delta_24h": 234,
          "language": "TypeScript",
          "topics": ["claude", "cli"],
          "opengraph_url": "https://opengraph.githubassets.com/1/anthropics/claude-code",
          "is_new_this_week": false
        }
      ]
    }
  ],
  "meta": {
    "total_repos": 60,
    "total_new": 3,
    "fetch_duration_ms": 8421,
    "rate_limit_remaining": 29
  }
}
```

## Adding to WVB stack badge

Edit `lib/wvb-stack.ts` to add repos your team actively uses.

## License

Internal (WVB). Repository data sourced from public GitHub API.
