#!/usr/bin/env python3
"""Regenerate main_menu/gui/messagetypes.txt = current vanilla file + ABM block.

WHY THIS EXISTS
  EU5 registers message types ONLY from the hardcoded path `gui/messagetypes.txt`
  (the literal string is embedded in binaries/eu5.exe, alongside
  `messagetypes_custom.txt` which is the user-profile settings override). GUI
  files do not support the REPLACE:/INJECT: database entry modes used in
  common/, so the mod has to override that file wholesale. That makes it
  patch-sensitive: whenever vanilla updates messagetypes.txt, our copy must be
  rebuilt from the new vanilla file plus the Ars Belli block at the end.

  This script does that rebuild, so re-syncing is one command instead of a
  13,000-line manual merge.

USAGE (from the repo root)
  python3 .tools/scripts/sync_messagetypes.py                 # regenerate
  python3 .tools/scripts/sync_messagetypes.py --check         # report only
  python3 .tools/scripts/sync_messagetypes.py --game /path/to/game

WHAT --check REPORTS
  1. whether the file on disk is byte-identical to what would be generated
     (if not, it lists the differing lines), and
  2. vanilla message-type keys that were ADDED or REMOVED since our copy was
     made -- i.e. what a re-sync would pick up.

NOTES / GOTCHAS
  * Output is UTF-8 with BOM and CRLF line endings, matching the rest of the
    mod's replaced files (.gitattributes enforces eol=crlf).
  * The ABM block is generated from the ABM_TYPES/GENERIC_TYPES tables below --
    never hand-edit the block inside the 13k-line output file, edit the tables.
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
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
DEFAULT_GAME = Path("/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game")
VANILLA_REL = "main_menu/gui/messagetypes.txt"
OUT_REL = "main_menu/gui/messagetypes.txt"

BLOCK_HEADER = "# --- Ars Belli: custom message types (added below) ---"

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
    ("pay_for_military_access", "diplomacy"),
    ("pay_for_trade_access", "diplomacy"),
    ("pay_for_food_access", "diplomacy"),
    ("pay_for_fondaco_rights", "diplomacy"),
    ("pay_for_fleet_basing_rights", "diplomacy"),
    ("worsen_opinion", "diplomacy"),
    ("break_others_guarantee", "diplomacy"),
]

# Generic actions need the generic form (the readme: "At the very least, the
# generic version should be provided").
GENERIC_TYPES: list[tuple[str, str]] = [
    ("force_break_union", "government"),
]

KEY_RE = re.compile(r"^[A-Za-z_0-9]+=\{")


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


def build_block() -> str:
    """The Ars Belli additions, as LF-terminated text (no trailing blank line)."""
    out = [BLOCK_HEADER + "\n"]
    for stem, category in ABM_TYPES:
        out.append(entry(f"WE_PERFORM_{stem}_ACTION", category, True))
        out.append(entry(f"ACTION_{stem}_PERFORMED_ON_US", category, False))
    for stem, category in GENERIC_TYPES:
        out.append(entry(f"PERFORM_{stem}_ACTION", category, True))
    return "".join(out)


def normalize(text: str) -> str:
    """To LF, ensure a single trailing newline."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    if not text.endswith("\n"):
        text += "\n"
    return text


def generate(vanilla_text: str) -> str:
    """Full file content (LF) = vanilla + blank line + ABM block."""
    return normalize(vanilla_text) + "\n" + build_block()


def to_disk_bytes(text_lf: str) -> bytes:
    return b"\xef\xbb\xbf" + text_lf.replace("\n", "\r\n").encode("utf-8")


def keys_of(text: str) -> set[str]:
    return {m.group(0)[:-1] for m in (KEY_RE.match(line) for line in text.split("\n")) if m}


def vanilla_portion(text_lf: str) -> str:
    """Strip our appended block back off (header line onwards)."""
    idx = text_lf.find(BLOCK_HEADER)
    return text_lf if idx < 0 else text_lf[:idx]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report only, do not write")
    ap.add_argument("--game", default=str(DEFAULT_GAME), help="vanilla game dir")
    ap.add_argument("--out", default=None, help="output path (defaults to the repo file)")
    args = ap.parse_args()

    game = Path(args.game)
    vanilla_path = game / VANILLA_REL
    out_path = Path(args.out) if args.out else BASE / OUT_REL

    if not vanilla_path.is_file():
        print(f"ERROR: vanilla file not found: {vanilla_path}", file=sys.stderr)
        return 2

    vanilla_lf = normalize(vanilla_path.read_text(encoding="utf-8-sig"))
    generated_lf = generate(vanilla_lf)
    generated_bytes = to_disk_bytes(generated_lf)

    existing_exists = out_path.is_file()
    existing_bytes = out_path.read_bytes() if existing_exists else b""

    in_sync = existing_exists and existing_bytes == generated_bytes

    # ---- key-level drift report -------------------------------------------------
    existing_lf = normalize(existing_bytes.decode("utf-8-sig")) if existing_exists else ""
    v_keys = keys_of(vanilla_lf)
    o_keys = keys_of(vanilla_portion(existing_lf))
    added = sorted(v_keys - o_keys)      # vanilla gained -> we are missing them
    removed = sorted(o_keys - v_keys)    # vanilla dropped -> we carry stale ones
    our_block_keys = sorted(keys_of(existing_lf) - o_keys)

    print(f"vanilla : {vanilla_path}")
    print(f"          {len(v_keys)} message types")
    print(f"our file: {out_path}")
    print(f"          {len(v_keys) + len(our_block_keys)} message types "
          f"({len(our_block_keys)} Ars Belli-added)")
    print(f"status  : {'IN SYNC (byte-identical)' if in_sync else 'OUT OF SYNC'}")

    if added:
        print(f"\nvanilla types missing from our copy ({len(added)}) -- re-sync needed:")
        for k in added[:30]:
            print(f"   + {k}")
        if len(added) > 30:
            print(f"   ... and {len(added) - 30} more")
    if removed:
        print(f"\ntypes in our copy that vanilla no longer has ({len(removed)}):")
        for k in removed[:30]:
            print(f"   - {k}")
        if len(removed) > 30:
            print(f"   ... and {len(removed) - 30} more")
    if not added and not removed:
        print("\nno vanilla key drift (our copy carries exactly vanilla's current types)")

    if args.check:
        if not in_sync and existing_exists:
            old = existing_bytes.decode("utf-8-sig").replace("\r\n", "\n").split("\n")
            new = generated_lf.split("\n")
            import difflib
            diff = list(difflib.unified_diff(old, new, "on-disk", "generated", lineterm="", n=1))
            print(f"\nline diff vs what would be generated ({sum(1 for d in diff if d[:1] in '+-')} lines):")
            for line in diff[:40]:
                print("   " + line)
        return 0 if in_sync else 1

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(generated_bytes)
    print(f"\nwrote {out_path} ({len(generated_bytes)} bytes, BOM+CRLF)")
    if existing_exists and not in_sync:
        print("NOTE: content changed -- review with `git diff main_menu/gui/messagetypes.txt`")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
