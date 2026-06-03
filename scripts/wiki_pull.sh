#!/usr/bin/env bash
#
# wiki_pull.sh — `wvb-wiki-pull` 크론잡 진입점
#
# 문제:
#   크론에서 `git pull --rebase` 를 그대로 돌리면 wiki 워킹트리에 커밋되지 않은
#   로컬 변경이 남아 있을 때 아래 에러로 중단된다 (exit 128).
#
#     error: 리베이스로 풀하기 할 수 없습니다: 스테이징하지 않은 변경 사항이 있습니다.
#     error: 커밋하거나 스태시에 넣으십시오.
#
# 해결:
#   pull 전에 로컬 변경을 자동 보관(autostash)했다가 rebase 후 복원한다.
#   rebase 가 충돌로 막히면 깨끗하게 abort 하여 워킹트리를 망가뜨리지 않고,
#   다음 크론 실행에 영향이 가지 않도록 한다.
#
# 환경 변수:
#   WIKI_DIR     wiki 로컬 클론 경로 (기본: $HOME/wvb-wiki)
#   WIKI_REMOTE  원격 이름           (기본: origin)
#   WIKI_BRANCH  브랜치 이름         (기본: main)
#
# 사용 (Hermes 크론 명령을 아래로 교체):
#   bash /path/to/wvb-cc-radar/scripts/wiki_pull.sh

set -euo pipefail

WIKI_DIR="${WIKI_DIR:-$HOME/wvb-wiki}"
WIKI_REMOTE="${WIKI_REMOTE:-origin}"
WIKI_BRANCH="${WIKI_BRANCH:-main}"

log() { printf '[wiki-pull] %s\n' "$*"; }

if [ ! -d "$WIKI_DIR/.git" ]; then
  log "ERROR: '$WIKI_DIR' 은(는) git 저장소가 아닙니다 (WIKI_DIR 설정 확인)"
  exit 1
fi

cd "$WIKI_DIR"

# 원격 최신 참조 가져오기 (삭제된 브랜치 정리 포함)
git fetch --prune "$WIKI_REMOTE"

# --autostash: 스테이징/언스테이징 로컬 변경을 pull 전에 자동 보관하고
#              rebase 완료 후 자동 복원한다. 이것이 원래 에러의 직접 해결책.
if git pull --rebase --autostash "$WIKI_REMOTE" "$WIKI_BRANCH"; then
  log "OK: $WIKI_REMOTE/$WIKI_BRANCH 동기화 완료 (rev $(git rev-parse --short HEAD))"
  exit 0
fi

# 여기 도달 = rebase 가 충돌 등으로 중단됨.
# 자동 해소가 불가능하므로 rebase 를 취소해 워킹트리를 안정 상태로 되돌리고,
# 보관해 둔 변경은 그대로 남겨 수동 처리할 수 있게 한다.
log "WARN: rebase pull 실패 (충돌 가능성). rebase 를 abort 하여 트리를 복구합니다."
git rebase --abort 2>/dev/null || true

log "ERROR: 수동 충돌 해결이 필요합니다 → $WIKI_DIR"
exit 1
