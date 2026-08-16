#!/usr/bin/env python3
"""Fill the remaining missing advance/unit localizations (name + desc = name).

Reads a list of base keys (one per line), humanizes each into a name, and writes
`<key>: "<name>"` / `<key>_desc: "<name>"` into the appropriate region file:

  ant/malagasy/mir/mgo  -> abm_advances_africa_l_english.yml
  gkh/khr/steppe/tum    -> abm_advances_steppe_l_english.yml
  wuu/csi               -> abm_advances_china_l_english.yml
  jap                   -> abm_advances_japan_l_english.yml
  a_* (unit types)      -> abm_unit_types_misc_l_english.yml (new)

Usage: python3 generate_remaining_loc.py [keys-file]
"""

import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
LOC_DIR = BASE / "main_menu" / "localization" / "english"

TAG_JP_RE = re.compile(r"^([a-z]{3})(jp\d+)$")
SLOT_RE = re.compile(r"^(?:adm|dip|mil|eco|nav|jp|adv|tra|ide|inf)\d*$")

SMALL = {"of", "the", "and", "in", "on", "to", "for", "by", "with", "from",
         "a", "an", "or", "at", "over", "under"}

# tag -> destination loc filename
TAG_FILE = {
    "ant": "abm_advances_africa_l_english.yml",
    "malagasy": "abm_advances_africa_l_english.yml",
    "mir": "abm_advances_africa_l_english.yml",
    "mgo": "abm_advances_africa_l_english.yml",
    "gkh": "abm_advances_steppe_l_english.yml",
    "khr": "abm_advances_steppe_l_english.yml",
    "steppe": "abm_advances_steppe_l_english.yml",
    "tum": "abm_advances_steppe_l_english.yml",
    "wuu": "abm_advances_china_l_english.yml",
    "csi": "abm_advances_china_l_english.yml",
    "jap": "abm_advances_japan_l_english.yml",
}
UNIT_FILE = "abm_unit_types_misc_l_english.yml"


def humanize(key: str) -> str:
    is_unit = key.startswith("a_")
    k = key
    if k.startswith("a_"):
        k = k[2:]
    if k.startswith("abm_"):
        k = k[4:]
    k = re.sub(r"ideas_tradition_", "tradition_", k)
    k = re.sub(r"ideas_ambition\b", "ambition", k)
    k = re.sub(r"^adv(\d+)$", r"advance_\1", k)
    k = re.sub(r"\badv(\d+)\b", r"advance_\1", k)
    parts = k.split("_")
    if parts and not is_unit:
        first = parts[0]
        m = TAG_JP_RE.match(first)
        if m:
            parts = parts[1:]
        elif re.match(r"^[a-z]{3}$", first):
            parts = parts[1:]
            if parts and SLOT_RE.match(parts[0]):
                parts = parts[1:]
    if not parts:
        parts = [key]
    out = []
    for i, w in enumerate(parts):
        if not w:
            continue
        if w in SMALL and i != 0:
            out.append(w)
        else:
            out.append(w.capitalize())
    return " ".join(out)


def tag_of(key: str) -> str:
    k = key
    if k.startswith("a_"):
        return ""
    if k.startswith("abm_"):
        k = k[4:]
    m = TAG_JP_RE.match(k)
    if m:
        return m.group(1).upper()
    return k.split("_", 1)[0][:3].upper()


def load_keys(path: Path) -> list[str]:
    keys = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            keys.append(line)
    return keys


def detect_newline(path: Path) -> str:
    raw = path.read_bytes()
    if b"\r\n" in raw:
        return "\r\n"
    return "\n"


def append_entries(path: Path, groups: dict[str, list[str]]) -> None:
    newline = detect_newline(path) if path.exists() else "\r\n"
    existing = path.read_text(encoding="utf-8-sig") if path.exists() else ""
    existing = existing.rstrip("\r\n")
    lines = []
    for tag in sorted(groups):
        lines.append(f" # {tag}")
        for k in groups[tag]:
            name = humanize(k)
            lines.append(f" {k}: \"{name}\"")
            lines.append(f" {k}_desc: \"{name}\"")
        lines.append("")
    block = newline.join(lines)
    content = existing + newline + newline + block + newline
    path.write_text(content, encoding="utf-8-sig", newline="")


def write_new(path: Path, keys: list[str]) -> None:
    lines = ["l_english:", ""]
    for k in sorted(keys):
        name = humanize(k)
        lines.append(f" {k}: \"{name}\"")
        lines.append(f" {k}_desc: \"{name}\"")
    content = "\r\n".join(lines) + "\r\n"
    path.write_text(content, encoding="utf-8-sig", newline="")


def main() -> None:
    keys_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/tmp/remaining_keys.txt")
    keys = load_keys(keys_file)

    advance_groups: dict[str, dict[str, list[str]]] = {}
    unit_keys: list[str] = []

    for k in keys:
        if k.startswith("a_"):
            unit_keys.append(k)
        else:
            fname = TAG_FILE.get(k.split("_")[1] if k.startswith("abm_") else k.split("_")[0], None)
            if fname is None:
                # fall back to tag extraction
                fname = TAG_FILE.get(tag_of(k).lower(), "abm_advances_misc_l_english.yml")
            advance_groups.setdefault(fname, {})
            advance_groups[fname].setdefault(tag_of(k), []).append(k)

    for fname, groups in advance_groups.items():
        path = LOC_DIR / fname
        append_entries(path, groups)
        n = sum(len(v) for v in groups.values())
        print(f"{fname}: +{n} entries ({len(groups)} tags)")

    if unit_keys:
        path = LOC_DIR / UNIT_FILE
        write_new(path, unit_keys)
        print(f"{UNIT_FILE}: +{len(unit_keys)} unit entries")


if __name__ == "__main__":
    main()
