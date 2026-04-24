"""One-time cleanup: strip enterprise-ax category from historical data files.

Background (2026-04-24): the Enterprise AX · FDE category was removed from the
active config because its GitHub star distribution (max 397, median 254) was
two orders of magnitude below the other cats — it didn't fit a star-based
radar. The render-time filter in app/*.tsx already hides it, but physical
removal keeps the data files consistent with lib/categories.ts so API/RSS
consumers and direct-read archive viewers don't see stale entries either.

Safe to run multiple times — idempotent. Updates meta.total_repos and
meta.total_new (if present) to reflect the post-removal counts.
"""
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
TARGET_CATEGORY = "enterprise-ax"


def clean_file(path: Path) -> dict | None:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    cats = data.get("categories", [])
    removed = [c for c in cats if c.get("category") == TARGET_CATEGORY]
    if not removed:
        return None

    kept = [c for c in cats if c.get("category") != TARGET_CATEGORY]
    data["categories"] = kept

    meta = data.get("meta", {})
    removed_repo_count = sum(len(c.get("items", [])) for c in removed)
    if "total_repos" in meta and isinstance(meta["total_repos"], int):
        meta["total_repos"] = max(0, meta["total_repos"] - removed_repo_count)
    if "total_new" in meta and isinstance(meta["total_new"], int):
        removed_new = sum(
            1
            for c in removed
            for r in c.get("items", [])
            if r.get("is_new_this_week")
        )
        meta["total_new"] = max(0, meta["total_new"] - removed_new)

    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return {
        "file": path.name,
        "removed_items": removed_repo_count,
        "cats_before": len(cats),
        "cats_after": len(kept),
    }


def main() -> int:
    files = sorted(DATA_DIR.glob("2026-*.json"))
    if not files:
        print(f"no daily data files found in {DATA_DIR}", file=sys.stderr)
        return 1

    summary = []
    for path in files:
        result = clean_file(path)
        if result:
            summary.append(result)
            print(
                f"{result['file']}  cats {result['cats_before']} -> {result['cats_after']}"
                f"  removed {result['removed_items']} items"
            )
        else:
            print(f"{path.name}  (already clean)")

    print()
    print(f"cleaned {len(summary)}/{len(files)} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
