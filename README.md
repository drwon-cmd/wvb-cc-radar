# wvb-cc-radar

**WVB Claude Code Radar** — Claude Code 생태계 업그레이드를 위한 GitHub 트렌드 일일 다이제스트.

**Live**: https://wvb-cc-radar-production.up.railway.app

Curated by [Wilt Venture Builder](https://www.wiltvb.com).

---

## 무엇을 하는가

매일 아침 GitHub Search API로 **8개 카테고리 × 총 100개 레포**를 수집해 두 가지 뷰로 제공:

- **`/` (Daily)** — 24h trend score로 정렬 (`delta_24h × 10 + stars × 0.001`). 오늘 뜨고 있는 것.
- **`/top` (All-time)** — 누적 스타로 정렬. 안정적인 참고.
- **`/archive/YYYY-MM-DD`** — 일자별 과거 snapshot.

각 레포 설명은 **Gemini 2.0 Flash로 한국어 자동 번역** (원문은 hover 툴팁 유지).

## 카테고리 (우선순위 순)

| # | 카테고리 | Top N | 포커스 |
|---|---------|:---:|--------|
| 1 | **Claude Code 생태계** | 30 (Hero) | Plugins · Skills · Sub-agents · Hooks · Workflows |
| 2 | **Vibe Coding 도구** | 10 | Cursor·Bolt·Lovable·v0 계열 대안, AI IDE, 비개발자 코딩 |
| 3 | **Enterprise AX · FDE** | 10 | Forward Deployed Engineer, 기업 AI 전환 프레임워크 |
| 4 | **RAG · 지식 베이스** | 10 | LLM knowledge base, retrieval-augmented generation, wiki 자동화 |
| 5 | **Agent Orchestration · Router** | 10 | Multi-agent coordinator, handoff patterns |
| 6 | **MCP 서버·도구** | 10 | Model Context Protocol servers, CC-compatible |
| 7 | **AI 에이전트 프레임워크** | 10 | LangGraph · CrewAI · AutoGen |
| 8 | **LLM 프롬프트·워크플로우** | 10 | Prompt engineering, agentic workflows |

## 시그널 배지

| 배지 | 의미 |
|------|------|
| **NEW** | 지난 7일 내 생성된 레포 |
| **WVB uses** | WVB 팀이 실제로 사용 중 (`lib/wvb-stack.ts`에서 관리) |
| `+NNN/24h` | 어제 대비 스타 증가량 (2일차부터 표시) |

## 자동 운영 파이프라인

```
매일 09:00 KST (UTC 00:00)  ← GitHub Actions cron
  │
  ├─ scripts/fetch.py
  │    ├─ GitHub Search API 쿼리 × 8 카테고리 (카테고리당 3-4 쿼리 후 merge·dedup)
  │    ├─ 어제·오늘 JSON에서 번역 캐시 로드
  │    ├─ Gemini 2.0 Flash 배치 번역 (batch 10, 10s cooldown, 30s retry)
  │    └─ data/YYYY-MM-DD.json 생성
  │
  ├─ git commit + push   ← 변경 있을 때만
  │
  ├─ Railway CLI 설치 + railway up    ← 사이트 재빌드 (Nixpacks)
  │
  └─ scripts/check_usage.py
       └─ Railway estimatedUsage 쿼리 → USD 추정
          └─ $2 임계 초과 시 GitHub Issue 자동 생성 (중복 방지)
```

약 4-5분 내 사이트에 반영됨 (KST 09:05 전후).

## 데이터 스키마

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
      "queries": [ "topic:claude-code pushed:>...", "\"claude-code\" in:name pushed:>...", "..." ],
      "items": [
        {
          "full_name": "anthropics/claude-code",
          "description": "Claude Code is an agentic coding tool that lives in your terminal.",
          "description_ko": "터미널에서 작동하는 에이전틱 코딩 도구",
          "stargazers_count": 115426,
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
    "total_repos": 100,
    "total_new": 1,
    "fetch_duration_ms": 112233,
    "rate_limit_remaining": 21,
    "translated_kr": 11,
    "translation_cache_hit": 89,
    "translation_failed": 0,
    "query_mode": "v0.4-rate-safe"
  }
}
```

## 기술 스택

- **Frontend**: Next.js 14.2.35 App Router + TypeScript + Tailwind (dark theme, wiltvb.com 팔레트)
- **Fetcher**: Python 3.12 stdlib (외부 의존성 0)
- **Translation**: Gemini 2.0 Flash (무료 tier 15 RPM, 월 비용 사실상 $0)
- **Cron**: GitHub Actions (public repo 무료 tier 2,000분/월)
- **Host**: Railway Hobby ($5/월, 실제 사용 ~$0.6/월)
- **Storage**: Git이 곧 DB — `data/*.json` 일자별 스냅샷이 자동 히스토리·롤백

## 로컬 개발

```bash
cd projects/wvb-cc-radar
npm install

# 환경변수
export GITHUB_TOKEN="$(gh auth token)"
export GEMINI_API_KEY="..."   # 선택 (없으면 번역 skip, 영어 원문 그대로 표시)

# 오늘 데이터 생성
python scripts/fetch.py

# 개발 서버
npm run dev   # http://localhost:3000
```

## GitHub Secrets (워크플로우에서 사용)

| Secret | 용도 |
|--------|------|
| `GITHUB_TOKEN` | 기본 제공 (Actions가 data 커밋할 때 사용) |
| `GEMINI_API_KEY` | 한국어 번역 |
| `RAILWAY_TOKEN` | 재배포 (project-scoped) |
| `RAILWAY_SERVICE_ID` | 재배포 대상 서비스 |
| `RAILWAY_ACCOUNT_TOKEN` | usage 쿼리 (account-scoped, 읽기 전용) |
| `RAILWAY_PROJECT_ID` | usage 쿼리 대상 프로젝트 |

## 비용

| 항목 | 월 |
|------|:---:|
| Railway Hobby | **$5 구독** 내 (실제 사용 ~$0.6) |
| GitHub Actions | $0 (무료 tier 150분/2000분 사용) |
| GitHub Search API | $0 (인증 5,000 req/hr 대비 일 28 req) |
| Gemini API | $0 (무료 tier 내, 캐시 95% 적중) |
| **추가 비용** | **$0** |

사용량 임계 초과 시 `.github/workflows/daily-fetch.yml`의 마지막 step이 `cost-alert` 라벨을 단 GitHub Issue를 자동 생성. 중복 오픈 이슈 있으면 skip.

## 카테고리·쿼리 수정

새 레포 유형을 추가하거나 기존 쿼리를 다듬으려면:

1. `scripts/fetch.py`의 `categories()` 함수에 쿼리 추가
2. `lib/categories.ts`·`lib/types.ts`의 `CategoryId` 유니온 타입 동기화
3. 로컬에서 `python scripts/fetch.py`로 결과 확인
4. commit + push → 다음 cron에서 반영

**쿼리 설계 팁**: GitHub Search API는 mixed OR qualifier(`topic:X OR "Y" in:name`)를 잘 처리 못 함. 카테고리당 단일 qualifier 쿼리 2-3개를 돌려서 merge·dedup하는 방식이 안정적.

## WVB 스택 배지 추가

`lib/wvb-stack.ts`의 `WVB_STACK_REPOS` 배열에 `owner/repo` 추가하면 해당 카드에 gold **WVB uses** 배지 표시.

## 수동 트리거

```bash
# 오늘 cron을 기다리지 않고 바로 돌리기
gh workflow run daily-fetch.yml --repo drwon-cmd/wvb-cc-radar
```

또는 GitHub 웹 UI: Actions → Daily Fetch & Deploy → Run workflow.

## 라이선스

Internal (WVB). GitHub public API 데이터 사용. 사이트 공개 접근 가능.
