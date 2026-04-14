#!/usr/bin/env python3
"""
VendIQ Nayax CSV Upload Automation Script
Runs on Mac Mini via Hermes cron.

Usage:
  python3 upload_csv_to_vendiq.py --csv /path/to/nayax_export.csv
  python3 upload_csv_to_vendiq.py --auto   # uses CDP browser to download fresh CSV

Environment variables:
  VENDIQ_API_KEY  — must match the key set in Vercel env vars
  VENDIQ_API_URL  — optional override (default: https://vendiq-app-iota.vercel.app)
"""

import os
import sys
import json
import argparse
import requests
from pathlib import Path
from datetime import datetime, timedelta

VENDIQ_API_URL = os.environ.get("VENDIQ_API_URL", "https://vendiq-app-iota.vercel.app")
VENDIQ_API_KEY = os.environ.get("VENDIQ_API_KEY", "c70175e2c74a2c0e0a5b176e85f5ca47")


def upload_csv(csv_path: str) -> dict:
    """Upload a CSV file to the VendIQ API."""
    path = Path(csv_path)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    print(f"Uploading {path.name} ({path.stat().st_size:,} bytes)...")

    with open(path, "rb") as f:
        response = requests.post(
            f"{VENDIQ_API_URL}/api/upload-csv",
            headers={
                "X-VendIQ-Key": VENDIQ_API_KEY,
            },
            files={
                "file": (path.name, f, "text/csv"),
            },
            timeout=120,
        )

    if response.status_code == 200:
        return response.json()
    elif response.status_code == 401:
        raise PermissionError("API key rejected. Check VENDIQ_API_KEY env var.")
    else:
        raise RuntimeError(f"API error {response.status_code}: {response.text[:500]}")


def download_nayax_csv_via_cdp() -> str:
    """
    Download the Nayax transaction CSV using CDP browser automation.
    Returns path to the downloaded file.

    TODO: Wire up CDP session from ~/.hermes/nayax/nayax_cdp_briefing.py
    This is a stub — implement tomorrow with the CDP session.
    """
    # Placeholder — import and call the actual CDP downloader once wired up
    # from pathlib import Path
    # sys.path.insert(0, str(Path.home() / ".hermes" / "nayax"))
    # from nayax_cdp_briefing import download_transactions_csv
    # return download_transactions_csv(days=1)

    raise NotImplementedError(
        "CDP auto-download not wired up yet. "
        "Use --csv /path/to/file.csv for now. "
        "Wire up CDP session tomorrow."
    )


def main():
    parser = argparse.ArgumentParser(description="Upload Nayax CSV to VendIQ")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--csv", metavar="PATH", help="Path to Nayax CSV file to upload")
    group.add_argument("--auto", action="store_true", help="Auto-download via CDP (requires active Nayax session)")
    args = parser.parse_args()

    if not VENDIQ_API_KEY:
        print("ERROR: VENDIQ_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    csv_path = args.csv
    if args.auto:
        print("Downloading fresh Nayax CSV via CDP...")
        try:
            csv_path = download_nayax_csv_via_cdp()
            print(f"Downloaded to: {csv_path}")
        except NotImplementedError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            sys.exit(1)

    try:
        result = upload_csv(csv_path)
        print("\n✓ Upload successful!")
        print(f"  Rows imported:  {result.get('rows_imported', 0):,}")
        machines = result.get("machines", [])
        print(f"  Machines found: {len(machines)} ({', '.join(machines[:5])}{'...' if len(machines) > 5 else ''})")
        dr = result.get("date_range", {})
        if dr.get("start") and dr.get("end"):
            print(f"  Date range:     {dr['start']} → {dr['end']}")
        print(f"\nDashboard: {VENDIQ_API_URL}/dashboard")
    except FileNotFoundError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except PermissionError as e:
        print(f"AUTH ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except RuntimeError as e:
        print(f"UPLOAD ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
