#!/usr/bin/env python3
"""Generate English localization for the Japanese advances in
in_game/common/advances/japanese_unique.txt.

For each advance the script creates:
  <key>:      "<humanized name>"
  <key>_desc: "<humanized name>"   (description = name, per request)

Output: main_menu/localization/english/abm_advances_japan_l_english.yml
(UTF-8 BOM, CRLF line endings, matching the existing advance loc files).
"""

import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
ADV_FILE = BASE / "in_game/common/advances" / "japanese_unique.txt"
OUT_FILE = BASE / "main_menu" / "localization" / "english" / "abm_advances_japan_l_english.yml"

SLOT_RE = re.compile(r"^(?:adm|dip|mil|eco|nav|jp)\d+$")
TAG_JP_RE = re.compile(r"^([a-z]{3})(jp\d+)$")

SMALL = {"of", "the", "and", "in", "on", "to", "for", "by", "with", "from",
         "a", "an", "or", "at", "over", "under"}


def humanize(key: str) -> str:
    k = key
    if k.startswith("abm_"):
        k = k[4:]
    parts = k.split("_")
    # Drop the leading country tag (and optional idea-slot) prefix.
    if parts:
        first = parts[0]
        m = TAG_JP_RE.match(first)  # e.g. "abejp1" -> tag "abe" + slot "jp1"
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
    k = key[4:] if key.startswith("abm_") else key
    m = TAG_JP_RE.match(k)
    if m:
        return m.group(1).upper()
    return k.split("_", 1)[0][:3].upper()


def main() -> None:
    keys = []
    with open(ADV_FILE, encoding="utf-8-sig") as fh:
        for line in fh:
            m = re.match(r"^([a-z0-9_]+)\s*=\s*\{", line)
            if m:
                keys.append(m.group(1))

    # Group by tag, preserving file order.
    groups: dict[str, list[str]] = {}
    for k in keys:
        groups.setdefault(tag_of(k), []).append(k)

    lines = ["l_english:", ""]
    for tag in sorted(groups):
        lines.append(f" # {tag}")
        for k in groups[tag]:
            name = humanize(k)
            lines.append(f" {k}: \"{name}\"")
            lines.append(f" {k}_desc: \"{name}\"")
        lines.append("")

    content = "\r\n".join(lines) + "\r\n"
    with open(OUT_FILE, "w", encoding="utf-8-sig", newline="") as fh:
        fh.write(content)

    print(f"Generated {len(keys)} advances ({len(groups)} tags) -> {OUT_FILE}")


if __name__ == "__main__":
    main()
