# Operations Runbook

> wvb-cc-radar 운영 절차. 정기 장애 및 수동 개입이 필요한 상황의 처리 방법.

## 1. Gemini Quota 소진 복구 (수동 번역 패치)

### 증상

- GitHub Actions `daily-fetch.yml` 실행 중 `[translate] HTTP 429: Resource exhausted`
- 완료 후 사이트에 일부 repo 소개가 영어로만 노출
- 워크플로 로그 끝에 `KR: 0 new + N cached + M failed` 에서 M > 0

### 원인

Gemini 2.0 Flash **무료 티어 일일 쿼터(1M tokens/day)** 가 소진됨. 프로젝트(`claude-mcp-483614`)에 결제수단 미연결이므로 추가 과금 없이 429로 끊김. 재계는 **태평양 시간 자정 (PT midnight)** = 한국 오후 4~5시경.

### 복구 절차 (Claude Code 세션에서 수동 처리)

세션 1회 실행으로 5분 이내 복구.

#### Step 1. 누락 항목 추출

```bash
cd /c/wvb-ai/projects/wvb-cc-radar
python scripts/list_missing_translations.py
```

출력 예시:
```
# Missing Korean translations — 12 items
[vibecoded-products] lobehub/lobehub
  The ultimate space for work and life — to find, build, and collaborate...
[vibecoded-products] AppFlowy-IO/AppFlowy
  Bring projects, wikis, and teams together with AI...
...
```

#### Step 2. Claude Code 세션에 번역 요청

세션에 붙여넣고 명시:

> 위 12건을 한글로 번역해줘. 규칙: 기술용어·제품명 원문 보존(MCP/LLM/RAG/ChatGPT 등), 80자 이내 문어체, 마침표 없음, 결과를 `{full_name: 한글번역}` dict로.

Claude가 dict 반환. 예:
```python
{
    "lobehub/lobehub": "에이전트 팀원과 협업하는...",
    ...
}
```

#### Step 3. JSON 패치 (inline 실행)

```bash
python -X utf8 -c "
import json, sys
from pathlib import Path
path = Path('data/YYYY-MM-DD.json')  # 오늘 날짜
d = json.load(open(path, encoding='utf-8'))
ko_map = { ... }  # Step 2에서 받은 dict 여기 붙여넣기
patched = 0
for c in d['categories']:
    for item in c['items']:
        if item['full_name'] in ko_map and not item.get('description_ko'):
            item['description_ko'] = ko_map[item['full_name']]
            patched += 1
d['meta']['translation_cache_hit'] += patched
d['meta']['translation_failed'] = max(0, d['meta'].get('translation_failed', 0) - patched)
json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f'patched {patched}')"
```

#### Step 4. 커밋 → Railway 배포

```bash
git add data/YYYY-MM-DD.json
git commit -m "fix(i18n): manual KR patch for N items (Gemini quota)"
git push origin main
# Railway 자동 배포 안 되는 repo이므로 수동 트리거
railway link --project wvb-cc-radar   # 필요 시
railway service wvb-cc-radar
railway up --detach --ci
```

5분 내 사이트 반영 확인:
```bash
curl -fsSL "https://wvb-cc-radar-production.up.railway.app/?v=$(date +%s)" | grep -c "<번역한 구절의 특징 토큰>"
```

### 예방

- 수동 복구는 Gemini 쿼터가 이례적으로 빨리 소진될 때만 필요
- 일반적으로 128건/일 수준이므로 1M tokens/day 안에서 충분
- 재발 시 `data/vibecoded-products.json` 등 allowlist 확대가 원인인지 확인 (한 번에 수십 건 신규 추가 = 캐시 미스 대량 발생)

---

## 2. Railway 재배포 (수동)

이 repo는 **Railway auto-deploy 설정 없음**. 모든 배포는 GitHub Actions workflow 또는 수동 `railway up`.

### GitHub Actions로 배포 (권장)

```bash
gh workflow run daily-fetch.yml -R drwon-cmd/wvb-cc-radar
```

- `workflow_dispatch` 이벤트로 실행. 내부에서 fetch → commit → `railway up` 전 단계 자동
- 완료 후 사이트 반영까지 약 3~5분

### 로컬 직접 배포 (Actions 우회)

Actions에서 fetch가 돌면 내 로컬 패치가 덮어쓰일 수 있을 때 사용.

```bash
cd /c/wvb-ai/projects/wvb-cc-radar
railway link --project wvb-cc-radar   # service까지 선택
railway service wvb-cc-radar
railway up --detach --ci
```

업로드 URL과 `deployment id`가 반환됨. Build 시간 약 2~4분.

---

## 3. Claude API Fallback 활성화 (선택)

현재 `fetch.py`에는 Gemini 실패 시 Claude Haiku로 자동 fallback하는 코드가 있으나
`ANTHROPIC_API_KEY` secret 미등록 상태라 Gemini-only로 동작.

활성화하려면:

```bash
gh secret set ANTHROPIC_API_KEY -R drwon-cmd/wvb-cc-radar
# 프롬프트에 sk-ant-... 붙여넣기 (Anthropic Console에서 발급)
```

이후 Gemini quota 소진 시 자동으로 Claude API 호출 → 수동 개입 불필요.
예상 비용: 소진 발생일 기준 건당 약 $0.05 이하.

비활성 상태를 유지하는 이유(현 기본): Gemini 소진 자체가 드물고, 소진 시 세션 내 수동 처리로 $0 운영 가능.

---

## 4. Billing 안전성 점검 (분기별)

Gemini API 키가 속한 GCP 프로젝트의 결제 연결 상태 점검.

1. https://console.cloud.google.com/billing/linkedaccount?project=claude-mcp-483614
2. "This project has no billing account" 문구 확인 → 무료 티어 확정
3. 만약 billing account가 붙어 있으면 즉시 Budgets & alerts에서 월 $1 상한 설정
