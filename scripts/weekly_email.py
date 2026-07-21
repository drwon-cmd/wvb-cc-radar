"""
Weekly Korean-language email digest for wvb-cc-radar.

Ports the ranking logic in lib/sort.ts + lib/diff.ts to Python (stdlib only)
and renders a self-contained HTML email summarizing the week's top movers,
new entrants, rank jumps, and Korean-opensource highlights for 원대표.

Usage:
  python scripts/weekly_email.py --dry-run [--out PATH] [--date YYYY-MM-DD]
  python scripts/weekly_email.py --send

Behavior:
  - Default is --dry-run UNLESS GMAIL_APP_PASSWORD is set, in which case the
    default flips to sending (pass --dry-run explicitly to force a preview
    even when the env var is present).
  - --dry-run always writes the rendered HTML to --out (default: OS temp dir)
    and prints a compact text summary to stdout. It never sends mail.
  - --send forces an actual send via Gmail SMTP (requires env vars below).

Env:
  GMAIL_USER            - sender Gmail address (required to send)
  GMAIL_APP_PASSWORD    - Gmail App Password, NOT the account password
                           (required to send; https://myaccount.google.com/apppasswords)
  DIGEST_TO             - comma-separated recipient list (default: GMAIL_USER)

GitHub Actions wiring (runs every Monday 09:00 KST = 00:00 UTC):

  # .github/workflows/weekly-digest.yml
  name: Weekly Digest Email
  on:
    schedule:
      - cron: "0 0 * * 1"   # Monday 00:00 UTC = 09:00 KST
    workflow_dispatch: {}
  jobs:
    send:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with:
            python-version: "3.12"
        - name: Send weekly digest
          env:
            GMAIL_USER: ${{ secrets.GMAIL_USER }}
            GMAIL_APP_PASSWORD: ${{ secrets.GMAIL_APP_PASSWORD }}
            DIGEST_TO: ${{ secrets.DIGEST_TO }}
          run: python scripts/weekly_email.py --send

Rate limits / cost: Gmail SMTP is free (well under the 500 msgs/day cap for
a single weekly send). No paid API involved.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import smtplib
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.json$")

SITE_URL = "https://wvb-cc-radar-production.up.railway.app"
MIN_STARS_MOVERS = 1000
MIN_STARS_JUMPS = 1000
TOP_N_MOVERS = 10
TOP_N_NEW = 10
COMPARE_N = 20
JUMP_TOP_N = 10
JUMP_MIN_GAP = 3
KOREAN_TOP_N = 5


# ============================================================
# Data loading (mirrors lib/data.ts)
# ============================================================

def list_digest_dates() -> list[str]:
    """Dates (YYYY-MM-DD) of all daily digest files, sorted descending."""
    if not DATA_DIR.exists():
        return []
    names = [f.name for f in DATA_DIR.iterdir() if f.is_file() and DATE_RE.match(f.name)]
    return sorted((n.replace(".json", "") for n in names), reverse=True)


def load_digest(date: str) -> dict | None:
    path = DATA_DIR / f"{date}.json"
    if not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"[weekly_email] failed to read {path}: {e}", file=sys.stderr)
        return None


def pick_current_and_baseline(override_date: str | None) -> tuple[dict, str, dict | None, str | None]:
    """Pick 'current' (latest or --date override) and closest-to-7d-prior baseline.

    Returns (current_digest, current_date, baseline_digest_or_None, baseline_date_or_None).
    Falls back gracefully when fewer than 7 days of history exist by picking the
    oldest available snapshot that isn't the current one (same policy as
    scripts/fetch.py's load_weekly_baseline()).
    """
    dates = list_digest_dates()
    if not dates:
        raise SystemExit(f"[weekly_email] no data/YYYY-MM-DD.json files found in {DATA_DIR}")

    if override_date:
        if override_date not in dates:
            raise SystemExit(f"[weekly_email] --date {override_date} not found in {DATA_DIR}")
        current_date = override_date
    else:
        current_date = dates[0]

    current = load_digest(current_date)
    if current is None:
        raise SystemExit(f"[weekly_email] failed to load current digest {current_date}")

    current_dt = datetime.strptime(current_date, "%Y-%m-%d").date()
    older = [d for d in dates if d < current_date]
    if not older:
        return current, current_date, None, None

    # Prefer the snapshot closest to (but not after) 7 days before current.
    target = current_dt - timedelta(days=7)

    def distance(d: str) -> int:
        return abs((datetime.strptime(d, "%Y-%m-%d").date() - target).days)

    baseline_date = min(older, key=distance)
    baseline = load_digest(baseline_date)
    return current, current_date, baseline, baseline_date


# ============================================================
# Ranking (ported from lib/sort.ts)
# ============================================================

def trend_score(r: dict) -> float:
    delta = r.get("stars_delta_24h") or 0
    return delta * 10 + r.get("stargazers_count", 0) * 0.001


def korean_quality_score(r: dict) -> float:
    stars = r.get("stargazers_count", 0)
    forks = r.get("forks_count") or 0
    korean_desc = 30 if _has_korean(r.get("description")) else 0
    owner_bonus = 30 if r.get("korean_owner") else 0
    delta = (r.get("stars_delta_24h") or 0) * 5
    new_bonus = 15 if r.get("is_new_this_week") else 0
    return stars + forks * 3 + korean_desc + owner_bonus + delta + new_bonus


def _has_korean(desc: str | None) -> bool:
    if not desc:
        return False
    return any("가" <= ch <= "힯" for ch in desc)


def rank_map(cat: dict) -> dict[str, int]:
    """1-indexed rank per full_name, mirroring lib/diff.ts rankMap()."""
    score_fn = korean_quality_score if cat.get("category") == "korean-opensource" else trend_score
    sorted_items = sorted(cat.get("items", []), key=score_fn, reverse=True)
    return {r["full_name"]: i + 1 for i, r in enumerate(sorted_items)}


# ============================================================
# Digest computation
# ============================================================

def dedup_by_full_name(current: dict) -> list[dict]:
    """Flatten all categories, dedup by full_name keeping the max stargazers_count copy."""
    merged: dict[str, dict] = {}
    for cat in current.get("categories", []):
        for r in cat.get("items", []):
            fn = r["full_name"]
            if fn not in merged or r.get("stargazers_count", 0) > merged[fn].get("stargazers_count", 0):
                merged[fn] = r
    return list(merged.values())


def compute_top_movers(current: dict) -> list[dict]:
    pool = [r for r in dedup_by_full_name(current) if r.get("stargazers_count", 0) >= MIN_STARS_MOVERS]
    pool.sort(key=lambda r: r.get("stars_delta_7d") or 0, reverse=True)
    return pool[:TOP_N_MOVERS]


def compute_new_entries(current: dict) -> list[dict]:
    pool = [r for r in dedup_by_full_name(current) if r.get("is_new_this_week")]
    pool.sort(key=lambda r: r.get("stargazers_count", 0), reverse=True)
    return pool[:TOP_N_NEW]


def compute_rank_jumps(current: dict, baseline: dict | None) -> list[dict]:
    """Repos whose category rank jumped >= JUMP_MIN_GAP positions into the
    current top JUMP_TOP_N, mirroring lib/diff.ts computeWhatsNew() 'jumped'
    branch. korean-opensource is excluded (own popularity scale — same
    EXCLUDED_CATEGORIES policy as lib/diff.ts)."""
    if baseline is None:
        return []

    baseline_ranks: dict[str, dict[str, int]] = {}
    for cat in baseline.get("categories", []):
        baseline_ranks[cat["category"]] = rank_map(cat)

    out: list[dict] = []
    for cat in current.get("categories", []):
        cat_id = cat.get("category")
        if cat_id == "korean-opensource":
            continue
        prev_ranks = baseline_ranks.get(cat_id)
        if prev_ranks is None:
            continue

        sorted_items = sorted(cat.get("items", []), key=trend_score, reverse=True)
        top = sorted_items[:JUMP_TOP_N]

        for i, repo in enumerate(top):
            today_rank = i + 1
            if repo.get("stargazers_count", 0) < MIN_STARS_JUMPS:
                continue
            prev_rank = prev_ranks.get(repo["full_name"])
            if prev_rank is None or prev_rank > COMPARE_N:
                continue  # new entries are covered by compute_new_entries()
            gap = prev_rank - today_rank
            if gap >= JUMP_MIN_GAP:
                out.append({
                    "repo": repo,
                    "category_title": cat.get("title", cat_id),
                    "from_rank": prev_rank,
                    "to_rank": today_rank,
                    "gap": gap,
                })

    out.sort(key=lambda e: e["gap"], reverse=True)
    return out


def compute_korean_highlights(current: dict) -> list[dict]:
    for cat in current.get("categories", []):
        if cat.get("category") == "korean-opensource":
            items = list(cat.get("items", []))
            items.sort(key=lambda r: r.get("stars_delta_7d") or 0, reverse=True)
            return items[:KOREAN_TOP_N]
    return []


class WeeklyDigest:
    def __init__(self, current: dict, current_date: str, baseline_date: str | None,
                 window_days: int | None):
        self.current = current
        self.current_date = current_date
        self.baseline_date = baseline_date
        self.window_days = window_days
        self.top_movers = compute_top_movers(current)
        self.new_entries = compute_new_entries(current)
        self.rank_jumps = compute_rank_jumps(current, load_digest(baseline_date) if baseline_date else None)
        self.korean_highlights = compute_korean_highlights(current)


# ============================================================
# Formatting helpers
# ============================================================

def fmt_num(n: int | float | None) -> str:
    if n is None:
        return "0"
    return f"{int(n):,}"


def fmt_delta(n: int | float | None) -> str:
    if not n:
        return "+0"
    n = int(n)
    return f"+{n:,}" if n >= 0 else f"{n:,}"


def now_kst_str() -> str:
    kst = timezone(timedelta(hours=9))
    return datetime.now(kst).strftime("%Y-%m-%d %H:%M KST")


def date_to_kst_label(date_str: str) -> str:
    """'2026-07-15' -> '7월 15일'."""
    d = datetime.strptime(date_str, "%Y-%m-%d")
    return f"{d.month}월 {d.day}일"


def esc(s: str | None) -> str:
    if not s:
        return ""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ============================================================
# HTML rendering (email-client-safe: tables + inline CSS only)
# ============================================================

COLORS = {
    "bg": "#f4f5f7",
    "card": "#ffffff",
    "text": "#1a1a2e",
    "muted": "#6b7280",
    "accent": "#4f46e5",
    "up": "#059669",
    "border": "#e5e7eb",
}


def render_repo_row(r: dict, right_label: str) -> str:
    name = esc(r["full_name"])
    url = esc(r["html_url"])
    stars = fmt_num(r.get("stargazers_count"))
    desc = esc(r.get("description_ko") or r.get("description") or "")
    if len(desc) > 90:
        desc = desc[:87] + "..."
    return f"""
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid {COLORS['border']};">
        <a href="{url}" style="color:{COLORS['accent']};text-decoration:none;font-weight:600;font-size:14px;">{name}</a>
        <div style="color:{COLORS['muted']};font-size:12px;margin-top:2px;">{desc}</div>
        <div style="color:{COLORS['muted']};font-size:11px;margin-top:4px;">★ {stars}</div>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid {COLORS['border']};text-align:right;white-space:nowrap;vertical-align:top;">
        <span style="color:{COLORS['up']};font-weight:700;font-size:13px;">{esc(right_label)}</span>
      </td>
    </tr>"""


def render_section(title: str, subtitle: str, rows_html: str) -> str:
    return f"""
  <tr>
    <td style="padding:28px 24px 8px 24px;">
      <h2 style="margin:0 0 2px 0;font-size:17px;color:{COLORS['text']};">{esc(title)}</h2>
      <div style="color:{COLORS['muted']};font-size:12px;margin-bottom:10px;">{esc(subtitle)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        {rows_html}
      </table>
    </td>
  </tr>"""


def render_html(digest: WeeklyDigest) -> str:
    sections: list[str] = []

    if digest.top_movers:
        rows = "".join(
            render_repo_row(r, f"{fmt_delta(r.get('stars_delta_7d'))} / 주")
            for r in digest.top_movers
        )
        sections.append(render_section("이번 주 급상승 Top Movers", "주간 스타 증가량 기준 상위 10개", rows))

    if digest.new_entries:
        rows = "".join(render_repo_row(r, "NEW") for r in digest.new_entries)
        sections.append(render_section("신규 진입", "지난 7일 내 생성된 레포 중 스타 상위 10개", rows))

    if digest.rank_jumps:
        rows = "".join(
            render_repo_row(
                e["repo"],
                f"#{e['from_rank']} → #{e['to_rank']}",
            )
            for e in digest.rank_jumps
        )
        sections.append(render_section("순위 급등", "카테고리 내 순위가 3계단 이상 상승한 레포", rows))

    if digest.korean_highlights:
        rows = "".join(
            render_repo_row(r, f"{fmt_delta(r.get('stars_delta_7d'))} / 주")
            for r in digest.korean_highlights
        )
        sections.append(render_section("한국 오픈소스 하이라이트", "한국 오픈소스 카테고리 주간 스타 증가량 상위 5개", rows))

    if not sections:
        sections.append(
            render_section(
                "이번 주 소식 없음",
                "",
                f"""<tr><td style="padding:16px 0;color:{COLORS['muted']};font-size:13px;">
                이번 주는 급상승·신규 진입·순위 급등 항목이 없었습니다.</td></tr>""",
            )
        )

    window_note = (
        f"{digest.window_days}일 창"
        if digest.window_days
        else "누적 히스토리 부족 (7일 미만) — 이용 가능한 가장 오래된 스냅샷 기준"
    )
    baseline_note = (
        f"비교 기준: {esc(digest.baseline_date)} ({window_note})"
        if digest.baseline_date
        else "비교 기준 없음 (첫 실행 — 절대 수치만 표시)"
    )

    current_label = date_to_kst_label(digest.current_date)

    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WVB CC Radar 주간 다이제스트</title>
</head>
<body style="margin:0;padding:0;background:{COLORS['bg']};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{COLORS['bg']};padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:{COLORS['card']};border-radius:12px;overflow:hidden;border:1px solid {COLORS['border']};">
        <tr>
          <td style="background:{COLORS['text']};padding:24px;">
            <div style="color:#ffffff;font-size:20px;font-weight:700;">WVB CC Radar</div>
            <div style="color:#c7c9e0;font-size:13px;margin-top:4px;">주간 다이제스트 — {current_label} 주</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 0 24px;color:{COLORS['muted']};font-size:12px;">
            {esc(baseline_note)}
          </td>
        </tr>
        {''.join(sections)}
        <tr>
          <td style="padding:24px;border-top:1px solid {COLORS['border']};background:#fafafa;">
            <div style="font-size:12px;color:{COLORS['muted']};line-height:1.8;">
              <a href="{SITE_URL}" style="color:{COLORS['accent']};text-decoration:none;">Daily</a>
              &nbsp;·&nbsp;
              <a href="{SITE_URL}/top" style="color:{COLORS['accent']};text-decoration:none;">Weekly (All-time)</a>
              &nbsp;·&nbsp;
              <a href="{SITE_URL}/archive/{esc(digest.current_date)}" style="color:{COLORS['accent']};text-decoration:none;">Archive</a>
              <br>생성 시각: {now_kst_str()}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>"""


def render_text(digest: WeeklyDigest) -> str:
    """Plaintext fallback part for the MIME multipart email."""
    lines = [f"WVB CC Radar 주간 다이제스트 — {date_to_kst_label(digest.current_date)} 주", ""]

    def block(title: str, items: list[str]) -> None:
        if not items:
            return
        lines.append(title)
        lines.extend(f"  - {i}" for i in items)
        lines.append("")

    block(
        "[이번 주 급상승]",
        [f"{r['full_name']} ({fmt_delta(r.get('stars_delta_7d'))}, ★{fmt_num(r.get('stargazers_count'))})" for r in digest.top_movers],
    )
    block(
        "[신규 진입]",
        [f"{r['full_name']} (★{fmt_num(r.get('stargazers_count'))})" for r in digest.new_entries],
    )
    block(
        "[순위 급등]",
        [f"{e['repo']['full_name']} (#{e['from_rank']} -> #{e['to_rank']})" for e in digest.rank_jumps],
    )
    block(
        "[한국 오픈소스 하이라이트]",
        [f"{r['full_name']} ({fmt_delta(r.get('stars_delta_7d'))})" for r in digest.korean_highlights],
    )

    lines.append(f"자세히 보기: {SITE_URL}")
    return "\n".join(lines)


def render_subject(digest: WeeklyDigest) -> str:
    label = date_to_kst_label(digest.current_date)
    if digest.top_movers:
        top_name = digest.top_movers[0]["full_name"]
        return f"[CC Radar] 주간 다이제스트 — {label} 주 (Top: {top_name})"
    return f"[CC Radar] 주간 다이제스트 — {label} 주"


# ============================================================
# Sending
# ============================================================

def send_email(subject: str, html_body: str, text_body: str) -> None:
    gmail_user = os.environ.get("GMAIL_USER", "").strip()
    gmail_pass = os.environ.get("GMAIL_APP_PASSWORD", "").strip()
    to_raw = os.environ.get("DIGEST_TO", "").strip() or gmail_user

    missing = []
    if not gmail_user:
        missing.append("GMAIL_USER")
    if not gmail_pass:
        missing.append("GMAIL_APP_PASSWORD")
    if missing:
        raise SystemExit(
            f"[weekly_email] cannot send: missing env var(s) {', '.join(missing)}. "
            "Set them, or use --dry-run to preview without sending."
        )

    to_list = [t.strip() for t in to_raw.split(",") if t.strip()]
    if not to_list:
        raise SystemExit("[weekly_email] cannot send: DIGEST_TO/GMAIL_USER resolved to no recipients")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = gmail_user
    msg["To"] = ", ".join(to_list)
    msg.attach(MIMEText(text_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    print(f"[weekly_email] connecting to smtp.gmail.com:465 as {gmail_user} -> {to_list}", file=sys.stderr)
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as server:
        server.login(gmail_user, gmail_pass)
        server.sendmail(gmail_user, to_list, msg.as_string())
    print(f"[weekly_email] sent to {len(to_list)} recipient(s)", file=sys.stderr)


# ============================================================
# CLI
# ============================================================

def default_out_path() -> Path:
    return Path(tempfile.gettempdir()) / "cc-radar-weekly-preview.html"


def print_summary(digest: WeeklyDigest, out_path: Path | None) -> None:
    print(f"[weekly_email] current={digest.current_date} baseline={digest.baseline_date or 'none'} "
          f"window_days={digest.window_days or 0}")
    print(f"[weekly_email] top_movers={len(digest.top_movers)} new_entries={len(digest.new_entries)} "
          f"rank_jumps={len(digest.rank_jumps)} korean_highlights={len(digest.korean_highlights)}")
    top3 = digest.top_movers[:3]
    if top3:
        print("[weekly_email] top 3 movers:")
        for r in top3:
            print(f"  - {r['full_name']}: {fmt_delta(r.get('stars_delta_7d'))} (★{fmt_num(r.get('stargazers_count'))})")
    else:
        print("[weekly_email] top 3 movers: (none)")
    if out_path is not None:
        size = out_path.stat().st_size if out_path.exists() else 0
        print(f"[weekly_email] wrote HTML preview -> {out_path} ({size:,} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser(description="WVB CC Radar weekly Korean email digest")
    parser.add_argument("--dry-run", action="store_true", help="Compute + write HTML, do not send")
    parser.add_argument("--send", action="store_true", help="Force sending via Gmail SMTP")
    parser.add_argument("--out", type=str, default=None, help="HTML output path for --dry-run")
    parser.add_argument("--date", type=str, default=None, help="Override 'current' date (YYYY-MM-DD)")
    args = parser.parse_args()

    if args.dry_run and args.send:
        raise SystemExit("[weekly_email] --dry-run and --send are mutually exclusive")

    # Default: send only if explicitly requested OR (no explicit flag AND
    # GMAIL_APP_PASSWORD is present). Otherwise dry-run.
    should_send = args.send or (not args.dry_run and bool(os.environ.get("GMAIL_APP_PASSWORD", "").strip()))

    current, current_date, baseline, baseline_date = pick_current_and_baseline(args.date)
    window_days = current.get("meta", {}).get("weekly_window_days")
    digest = WeeklyDigest(current, current_date, baseline_date, window_days)

    html_body = render_html(digest)
    text_body = render_text(digest)
    subject = render_subject(digest)

    if should_send:
        send_email(subject, html_body, text_body)
        print_summary(digest, out_path=None)
        return 0

    out_path = Path(args.out) if args.out else default_out_path()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html_body, encoding="utf-8")
    print(f"[weekly_email] DRY RUN — subject: {subject}")
    print_summary(digest, out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
