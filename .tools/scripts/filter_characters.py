#!/usr/bin/env python3
"""Build the mod's `main_menu/setup/1337/05_characters.txt` from vanilla.

Vanilla's character file defines characters for every country in the base game.
The mod deletes a lot of those countries (the 118 vanilla Japanese daimyo in
particular), so the game logs, at every start-up:

    unknown country 'NIT' at setup/1337/05_characters.txt:55135
    Character 'jap_nitta_yoshishige' has no Court Country
    SaveRepair_CharacterEstatesLink had to assign the nobles estate to ...

Those characters never load. This script emits a same-name copy of vanilla's file
with every character whose country does not exist in the mod COMMENTED OUT, so the
content stays visible/reversible while the errors disappear.

Two rules beyond "tag not in the mod":
  * referential closure - a kept character whose father/mother/spouse was dropped is
    dropped too, otherwise the engine would start reporting unknown characters;
  * mod references win - a character referenced by the mod's own start-state
    (`ruler = X`, `heir = X`, `character = X`, `consort = X`) is never dropped.

Usage (from the repo root):
    python3 .tools/scripts/filter_characters.py               # write the file
    python3 .tools/scripts/filter_characters.py --dry-run     # stats only
    python3 .tools/scripts/filter_characters.py --vanilla PATH

Re-run after every vanilla update: replaced_files.txt lists the shipped copy, so the
file must be regenerated against the new vanilla characters file.
"""

from __future__ import annotations

import argparse
import re
import pathlib
import sys

BASE = pathlib.Path(__file__).resolve().parent.parent.parent
SETUP = BASE / "main_menu" / "setup" / "1337"
DEFAULT_VANILLA = pathlib.Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game/"
    "main_menu/setup/1337/05_characters.txt"
)
TAG_RE = re.compile(r"(?m)^[ \t]{1,2}([A-Z]{3,5})[ \t]*=[ \t]*\{")
CHAR_START_RE = re.compile(r"^\t([a-z_0-9]+) = \{\s*$")
TAG_LINE_RE = re.compile(r"^[ \t]*tag = ([A-Z]{3,5})\s*$", re.M)
REF_KEYS = ("father", "mother", "spouse")
REF_LINE_RE = {k: re.compile(rf"^[ \t]*{k} = ([a-z_0-9]+)", re.M) for k in REF_KEYS}


def mod_tags() -> set[str]:
    tags: set[str] = set()
    for path in sorted(SETUP.glob("10_countries*.txt")):
        tags |= set(TAG_RE.findall(path.read_bytes().decode("utf-8-sig", "replace")))
    return tags


def mod_references() -> set[str]:
    """Character ids the mod's own start-state points at."""
    refs: set[str] = set()
    pattern = re.compile(r"(?:ruler|heir|character|consort) = ([a-z_0-9]+)")
    for path in sorted(SETUP.glob("*.txt")):
        if path.name == "05_characters.txt":
            continue
        refs |= set(pattern.findall(path.read_bytes().decode("utf-8-sig", "replace")))
    return refs


def split_blocks(lines: list[str]) -> list[tuple[int, int]]:
    """(start, end) line indexes of every top-level entry inside character_db."""
    spans: list[tuple[int, int]] = []
    i = 0
    while i < len(lines):
        if CHAR_START_RE.match(lines[i]):
            depth = 0
            for j in range(i, len(lines)):
                code = lines[j].split("#")[0]
                depth += code.count("{") - code.count("}")
                if depth == 0:
                    spans.append((i, j))
                    i = j + 1
                    break
            else:  # pragma: no cover - unbalanced vanilla file
                raise RuntimeError(f"unbalanced block starting at line {i + 1}")
            continue
        i += 1
    return spans


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--vanilla", type=pathlib.Path, default=DEFAULT_VANILLA)
    ap.add_argument("--out", type=pathlib.Path, default=SETUP / "05_characters.txt")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    raw = args.vanilla.read_bytes().decode("utf-8-sig", "replace")
    lines = raw.split("\n")
    spans = split_blocks(lines)
    tags = mod_tags()
    refs = mod_references()

    cid: dict[int, str] = {}
    tag_of: dict[str, str | None] = {}
    ref_of: dict[str, set[str]] = {}
    for start, end in spans:
        ident = CHAR_START_RE.match(lines[start]).group(1)
        cid[start] = ident
        body = "\n".join(lines[start : end + 1])
        m = TAG_LINE_RE.search(body)
        tag_of[ident] = m.group(1) if m else None
        ref_of[ident] = {
            mm.group(1) for k, rx in REF_LINE_RE.items() for mm in [rx.search(body)] if mm
        }

    dead = {c for c, t in tag_of.items() if t and t not in tags}
    kept_by_mod = dead & refs          # still a ruler somewhere in the mod: never drop
    drop = dead - kept_by_mod
    # any surviving character keeps its block, but loses the link to a dropped parent/spouse
    severed: dict[str, set[str]] = {
        c: rs & drop for c, rs in ref_of.items() if c not in drop and rs & drop
    }

    print(f"vanilla characters : {len(spans)}")
    print(f"mod countries      : {len(tags)}")
    print(f"dead-country chars : {len(dead)}")
    print(f"kept for mod refs  : {len(kept_by_mod)} {sorted(kept_by_mod)[:5]}")
    print(f"dropped            : {len(drop)}")
    print(f"severed family refs: {sum(len(v) for v in severed.values())} in {len(severed)} characters "
          f"{sorted(severed)[:5]}")
    print(f"kept               : {len(spans) - len(drop)}")

    out_lines = list(lines)
    for start, end in spans:
        ident = cid[start]
        if ident in drop:
            for j in range(start, end + 1):
                if out_lines[j].strip():
                    out_lines[j] = "#" + out_lines[j]
            continue
        if ident in severed:
            for j in range(start, end + 1):
                line = out_lines[j]
                code = line.split("#")[0]
                for key in REF_KEYS:
                    m = REF_LINE_RE[key].match(code)
                    if m and m.group(1) in severed[ident]:
                        out_lines[j] = "#" + line

    if args.dry_run:
        return 0

    body = "\n".join(out_lines)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    # CRLF without BOM, matching the other setup files the mod ships (eol=crlf in .gitattributes)
    args.out.write_bytes(body.replace("\r\n", "\n").replace("\n", "\r\n").encode("utf-8"))
    print(f"wrote {args.out} ({args.out.stat().st_size / 1e6:.2f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
