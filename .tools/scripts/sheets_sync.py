#!/usr/bin/env python3
"""Download a tab of the ABM advance-list spreadsheet as a local CSV mirror.

The sheet is link-shared as "anyone with the link can edit", so this works
without any credentials. Writing still has to go through the browser UI.

Usage:
    python .tools/scripts/sheets_sync.py                  # page 1 (abm_germany)
    python .tools/scripts/sheets_sync.py OLD1             # any tab by name
    python .tools/scripts/sheets_sync.py MUS->RUS --out .tools/sheets/mus_rus.csv
"""

from __future__ import annotations

import argparse
import sys
import urllib.parse
import urllib.request
from pathlib import Path

SHEET_ID = "1D65i5OMrR_DFL5NInMsP0TT4ntmldJUk79HEISX97ks"
DEFAULT_TAB = "abm_germany"  # tab 1, the sheet we actually work on
REPO_ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = REPO_ROOT / ".tools" / "sheets"


def slug(tab: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in tab.lower()).strip("_")


def fetch_tab_csv(tab: str) -> bytes:
    url = (
        f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq"
        f"?tqx=out:csv&sheet={urllib.parse.quote(tab)}"
    )
    with urllib.request.urlopen(url, timeout=60) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for tab {tab!r}")
        return response.read()


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("tab", nargs="?", default=DEFAULT_TAB, help="sheet tab name")
    parser.add_argument("--out", help="output path (default: .tools/sheets/<tab>.csv)")
    args = parser.parse_args(argv)

    out_path = Path(args.out) if args.out else OUT_DIR / f"{slug(args.tab)}.csv"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    data = fetch_tab_csv(args.tab)
    out_path.write_bytes(data)
    rows = data.count(b"\n")
    print(f"{args.tab}: {len(data)} bytes, ~{rows} rows -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
