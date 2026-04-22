"""List items in today's digest that are missing `description_ko`.

Used for manual KR patch workflow when Gemini daily quota is exhausted
(see docs/ops.md #1). Output is Claude-paste-ready:

    # Missing Korean translations - N items
    [category] owner/repo
      english description text

Examples:
    python scripts/list_missing_translations.py                  # today
    python scripts/list_missing_translations.py 2026-04-21       # specific date
    python scripts/list_missing_translations.py --json           # JSON output
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"


def find_missing(date: str) -> list[tuple[str, str, str]]:
    path = DATA_DIR / f"{date}.json"
    if not path.exists():
        print(f"[ERR] {path} not found", file=sys.stderr)
        sys.exit(1)
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    missing: list[tuple[str, str, str]] = []
    for cat in d["categories"]:
        for item in cat["items"]:
            desc = item.get("description")
            if not desc or not desc.strip():
                continue
            if item.get("description_ko"):
                continue
            missing.append((cat["category"], item["full_name"], desc))
    return missing


def main() -> int:
    argv = sys.argv[1:]
    as_json = "--json" in argv
    argv = [a for a in argv if not a.startswith("--")]
    date = argv[0] if argv else datetime.now(timezone.utc).strftime("%Y-%m-%d")

    missing = find_missing(date)

    if as_json:
        print(json.dumps(
            [{"category": c, "full_name": f, "description": d} for c, f, d in missing],
            ensure_ascii=False,
            indent=2,
        ))
        return 0

    if not missing:
        print(f"[OK] {date} - no missing translations")
        return 0

    print(f"# Missing Korean translations - {len(missing)} items ({date})")
    print()
    for cat, full_name, desc in missing:
        print(f"[{cat}] {full_name}")
        print(f"  {desc}")
        print()
    print("# ---")
    print("# Paste the above to Claude Code and request:")
    print("# '위 N건을 한글로 번역해줘. 규칙: 기술용어 원문 보존, 80자 이내 문어체,")
    print("#  마침표 없음. 결과를 {full_name: 한글번역} Python dict로.'")
    return 0


if __name__ == "__main__":
    sys.exit(main())
