"""
Railway usage monitor for wvb-cc-radar.

Queries Railway GraphQL `estimatedUsage` for this project and prints
a report. Intended to run as the last step of the daily GitHub Actions
workflow.

Raw API values (estimatedValue) have implicit units not documented by
Railway publicly. Interpretation guide (best-effort, validate against
the Railway dashboard Usage tab over 1-2 weeks):

  - MEMORY_USAGE_GB: GB-minute accumulator for the projected month
  - CPU_USAGE:       vCPU-minute (very low for idle Next.js SSG)
  - NETWORK_TX_GB:   GB egress projection (this one is in GB)
  - DISK_USAGE_GB:   GB-minute of persisted disk (SSG => 0)

Railway pricing (Hobby/Pro, 2024):
  - Memory: $10 / GB / month
  - CPU:    $20 / vCPU / month
  - Egress: $0.10 / GB
  - Disk:   $0.15 / GB / month

Exit codes:
  0 - normal
  1 - above threshold (for workflow to emit a warning)
  2 - API error

Env vars:
  RAILWAY_ACCOUNT_TOKEN (required)
  RAILWAY_PROJECT_ID    (required)
  USAGE_ALERT_USD       (optional, default 2.00)
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error

API = "https://backboard.railway.com/graphql/v2"
TOKEN = os.environ.get("RAILWAY_ACCOUNT_TOKEN", "").strip()
PROJECT_ID = os.environ.get("RAILWAY_PROJECT_ID", "").strip()
THRESHOLD_USD = float(os.environ.get("USAGE_ALERT_USD", "2.00"))

MEASUREMENTS = [
    "MEMORY_USAGE_GB",
    "CPU_USAGE",
    "NETWORK_TX_GB",
    "DISK_USAGE_GB",
]

# Assumed unit conversion from estimatedValue to USD.
# Refine these coefficients after 1-2 weeks of comparison with the
# Railway dashboard's stated monthly cost.
def estimate_usd(measurement: str, value: float) -> float:
    if measurement == "MEMORY_USAGE_GB":
        # Treat value as GB-minute over the projected month.
        # $10/GB/month ÷ (30 days × 24 h × 60 min) ≈ $0.0002315/GB-min.
        return value * 10 / (30 * 24 * 60)
    if measurement == "CPU_USAGE":
        # vCPU-minute. $20/vCPU/month ÷ 43200 ≈ $0.000463/vCPU-min.
        return value * 20 / (30 * 24 * 60)
    if measurement == "NETWORK_TX_GB":
        # Value already in GB.
        return value * 0.10
    if measurement == "DISK_USAGE_GB":
        # GB-minute. $0.15/GB/month ÷ 43200.
        return value * 0.15 / (30 * 24 * 60)
    return 0.0


def graphql(query: str) -> dict:
    req = urllib.request.Request(
        API,
        data=json.dumps({"query": query}).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "wvb-cc-radar/usage-check",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"[error] HTTP {e.code}: {body[:300]}", file=sys.stderr)
        raise


def main() -> int:
    if not TOKEN or not PROJECT_ID:
        print("[error] RAILWAY_ACCOUNT_TOKEN and RAILWAY_PROJECT_ID are required", file=sys.stderr)
        return 2

    measurements_list = ", ".join(MEASUREMENTS)
    query = f"""
    {{
      estimatedUsage(
        projectId: "{PROJECT_ID}",
        measurements: [{measurements_list}]
      ) {{
        estimatedValue
        measurement
      }}
    }}
    """
    try:
        data = graphql(query)
    except Exception as e:
        print(f"[error] GraphQL call failed: {e}", file=sys.stderr)
        return 2

    if data.get("errors"):
        print(f"[error] {data['errors']}", file=sys.stderr)
        return 2

    items = data["data"]["estimatedUsage"]
    total_usd = 0.0

    print("wvb-cc-radar Railway usage estimate (projected month)")
    print("=" * 60)
    print(f"{'measurement':<20} {'raw value':>18} {'~USD':>12}")
    print("-" * 60)
    for item in sorted(items, key=lambda x: x["measurement"]):
        m = item["measurement"]
        v = item["estimatedValue"]
        usd = estimate_usd(m, v)
        total_usd += usd
        print(f"{m:<20} {v:>18.4f} {'$%.3f' % usd:>12}")
    print("-" * 60)
    print(f"{'TOTAL (this project)':<20} {'':>18} {'$%.2f' % total_usd:>12}")
    print()
    print(f"Threshold: ${THRESHOLD_USD:.2f}")
    print(
        f"Dashboard: https://railway.com/project/{PROJECT_ID}/usage"
    )
    print()
    print(
        "Note: conversion coefficients are heuristic; verify against the "
        "Railway dashboard 'Usage' tab over 1-2 weeks and adjust."
    )

    if total_usd >= THRESHOLD_USD:
        print(
            f"\n[ALERT] estimated monthly cost ${total_usd:.2f} >= threshold "
            f"${THRESHOLD_USD:.2f}",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
