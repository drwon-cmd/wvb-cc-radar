"""
Manual pruning tool for data/YYYY-MM-DD.json daily snapshots.

NOT wired to any cron/CI workflow — run by hand when data/ grows too large.

Usage:
  python scripts/prune_data.py --keep-days 365            # dry-run (default)
  python scripts/prune_data.py --keep-days 365 --apply     # actually delete
  python scripts/prune_data.py --keep-days 365 --dry-run   # explicit dry-run

Deletes data/YYYY-MM-DD.json files older than --keep-days, but ALWAYS keeps:
  - the newest 30 dated snapshots, regardless of age (recent history always
    intact even if --keep-days is set very low)
  - non-date config JSONs (applications-seed.json, claude-code-curated.json,
    korean-owners.json, vibecoded-products.json, ...) — matched the same way
    lib/data.ts does, via the `^\\d{4}-\\d{2}-\\d{2}\\.json$` filename regex,
    so anything that isn't a dated snapshot is never touched.

NOTE: app/archive/[date] renders one static page per data/YYYY-MM-DD.json
file. Pruning a date's JSON means that date's /archive/<date> page 404s on
next build/deploy. This is expected and intentional for this tool, but is
worth knowing before running --apply on a live site.
"""
from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

# Same pattern as lib/data.ts's filter — only dated daily snapshots match.
DATE_FILE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\.json$")

# Newest N dated snapshots are never pruned, regardless of --keep-days.
MIN_KEEP_NEWEST = 30


def find_dated_files() -> list[tuple[str, Path]]:
    """Return [(date_str, path), ...] for data/YYYY-MM-DD.json files, sorted
    newest-first. Non-date JSONs (config/seed/allowlist files) are excluded
    by construction — DATE_FILE_RE only matches the dated snapshot pattern.
    """
    if not DATA_DIR.exists():
        return []
    out = []
    for p in DATA_DIR.iterdir():
        if not p.is_file():
            continue
        m = DATE_FILE_RE.match(p.name)
        if m:
            out.append((m.group(1), p))
    out.sort(key=lambda t: t[0], reverse=True)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--keep-days",
        type=int,
        required=True,
        help="Delete dated snapshots older than this many days (subject to the newest-30 floor).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually delete files. Without this flag, the script only reports what it would do.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Explicit dry-run (default behavior when --apply is omitted).",
    )
    args = parser.parse_args()

    if args.keep_days < 0:
        print("[error] --keep-days must be >= 0", file=sys.stderr)
        return 2

    dry_run = not args.apply  # --dry-run is accepted for explicitness but --apply is what flips it live

    dated = find_dated_files()
    total = len(dated)
    if total == 0:
        print(f"[prune] no dated snapshots found in {DATA_DIR}")
        return 0

    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.keep_days)).strftime("%Y-%m-%d")
    always_keep = {date for date, _ in dated[:MIN_KEEP_NEWEST]}

    to_delete: list[tuple[str, Path]] = []
    kept_old = 0
    for date, path in dated:
        if date in always_keep:
            continue
        if date < cutoff:
            to_delete.append((date, path))
        else:
            kept_old += 1

    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"[prune] mode={mode} keep_days={args.keep_days} cutoff={cutoff}")
    print(f"[prune] {total} dated snapshots found; newest {min(MIN_KEEP_NEWEST, total)} always kept ({DATA_DIR})")

    if not to_delete:
        print(f"[prune] nothing to {'delete' if not dry_run else 'prune'} -- {kept_old} within keep-days, rest protected by newest-{MIN_KEEP_NEWEST} floor")
        return 0

    for date, path in to_delete:
        action = "would delete" if dry_run else "deleting"
        print(f"[prune] {action}: {path.relative_to(ROOT)}")
        if not dry_run:
            try:
                path.unlink()
            except OSError as e:
                print(f"[prune] failed to delete {path}: {e}", file=sys.stderr)

    verb = "Would delete" if dry_run else "Deleted"
    print(
        f"[prune] {verb} {len(to_delete)}/{total} snapshots "
        f"({kept_old} kept within keep-days, {min(MIN_KEEP_NEWEST, total)} kept by newest-{MIN_KEEP_NEWEST} floor)."
    )
    if dry_run:
        print("[prune] this was a dry-run -- re-run with --apply to actually delete files")

    return 0


if __name__ == "__main__":
    sys.exit(main())
