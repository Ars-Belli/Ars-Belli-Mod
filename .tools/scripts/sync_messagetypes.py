#!/usr/bin/env python3
"""Regenerate main_menu/gui/messagetypes/abm_messagetypes.txt (the Ars Belli message types).

WHY THIS EXISTS
  Up to game 1.3 the engine read message types from ONE hardcoded file,
  `gui/messagetypes.txt`, so the mod had to ship a full copy of vanilla's
  13k-line file with the ABM block appended, and re-sync it on every patch.

  Game 1.4 replaced that with a FOLDER, `gui/messagetypes/` (the only path left
  in binaries/eu5.exe is the bare folder string; vanilla ships
  `gui/messagetypes/00_messagetypes.txt`). Every file in it is loaded and a
  later definition of the same key wins, so the mod now ships only its own
  types in `abm_messagetypes.txt`. No vanilla copy, no re-sync on patches.
  A leftover `gui/messagetypes.txt` is silently ignored by 1.4 - do not
  recreate it.

USAGE (from the repo root)
  python3 .tools/scripts/sync_messagetypes.py           # regenerate
  python3 .tools/scripts/sync_messagetypes.py --check   # report only (exit 1 if out of sync)

NOTES / GOTCHAS
  * Output is UTF-8 with BOM and CRLF line endings, like vanilla's
    00_messagetypes.txt (.gitattributes enforces eol=crlf).
  * The file is generated from the ABM_TYPES/GENERIC_TYPES tables below --
    edit the tables, never the output file.
  * `message_category` must be one of the categories vanilla uses (see
    CATEGORIES). Invalid values are silently accepted by the engine but the
    message will not show under any filter tab.
  * Entry schema (all seven keys per type):
      log / onmap / popup / idle / option / pausepopup + message_category.
    Convention followed here: "we perform" -> popup=yes, "performed on us" and
    "other performs" -> popup=no, matching vanilla (e.g. WE_PERFORM_request_loan_ACTION
    vs ACTION_request_loan_PERFORMED_ON_US).
"""

from __future__ import annotations

import argparse
import difflib
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
OUT_REL = "main_menu/gui/messagetypes/abm_messagetypes.txt"

HEADER = (
    "# Ars Belli message types. 1.4 loads every file in gui/messagetypes/ (later key wins), so this\n"
    "# file only ADDS the mod's types - no vanilla copy needed. Regenerate with .tools/scripts/sync_messagetypes.py\n"
)

# Valid message_category values observed in vanilla (tabs in the message
# settings UI). Keep new entries inside this set.
CATEGORIES = {
    "diplomacy", "economy", "government", "geopolitics", "military", "society", "wars",
}

# (action_stem, category) -- registers BOTH
#   WE_PERFORM_<stem>_ACTION          (popup=yes, "we did it")
#   ACTION_<stem>_PERFORMED_ON_US     (popup=no,  "done to us")
ABM_TYPES: list[tuple[str, str]] = [
    ("abm_enforce_peace", "wars"),
    ("abm_send_economic_support", "economy"),
    ("abm_forgive_half_antagonism", "diplomacy"),
    ("abm_forgive_200_antagonism", "diplomacy"),
    ("pay_for_trade_access", "diplomacy"),
    ("pay_for_fondaco_rights", "diplomacy"),
    ("worsen_opinion", "diplomacy"),
    ("break_others_guarantee", "diplomacy"),
    ("abm_sabotage_fort", "military"),
]

# Generic actions need the generic form (generic_actions/readme.txt: "At the
# very least, the generic version should be provided").
GENERIC_TYPES: list[tuple[str, str]] = [
    ("force_break_union", "government"),
]


def entry(name: str, category: str, popup: bool) -> str:
    if category not in CATEGORIES:
        raise ValueError(f"invalid message_category {category!r} for {name}")
    return (
        f"{name}={{\n"
        f"log=yes\n"
        f"onmap=no\n"
        f"popup={'yes' if popup else 'no'}\n"
        f"idle=no\n"
        f"option=yes\n"
        f"pausepopup=no\n"
        f"message_category = {category}\n"
        f"}}\n"
    )


def generate() -> str:
    """Full file content, LF-terminated."""
    out = [HEADER]
    for stem, category in ABM_TYPES:
        out.append(entry(f"WE_PERFORM_{stem}_ACTION", category, True))
        out.append(entry(f"ACTION_{stem}_PERFORMED_ON_US", category, False))
    for stem, category in GENERIC_TYPES:
        out.append(entry(f"PERFORM_{stem}_ACTION", category, True))
    return "".join(out)


def to_disk_bytes(text_lf: str) -> bytes:
    return b"\xef\xbb\xbf" + text_lf.replace("\n", "\r\n").encode("utf-8")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report only, do not write")
    ap.add_argument("--out", default=None, help="output path (defaults to the repo file)")
    args = ap.parse_args()

    out_path = Path(args.out) if args.out else BASE / OUT_REL
    generated_lf = generate()
    generated_bytes = to_disk_bytes(generated_lf)
    existing_bytes = out_path.read_bytes() if out_path.is_file() else b""
    in_sync = existing_bytes == generated_bytes

    print(f"file  : {out_path}")
    print(f"types : {2 * len(ABM_TYPES) + len(GENERIC_TYPES)}")
    print(f"status: {'IN SYNC (byte-identical)' if in_sync else 'OUT OF SYNC'}")

    if args.check:
        if not in_sync:
            old = existing_bytes.decode("utf-8-sig").replace("\r\n", "\n").split("\n")
            diff = difflib.unified_diff(old, generated_lf.split("\n"), "on-disk", "generated", lineterm="", n=1)
            for line in list(diff)[:40]:
                print("   " + line)
        return 0 if in_sync else 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(generated_bytes)
    print(f"wrote {out_path} ({len(generated_bytes)} bytes, BOM+CRLF)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
