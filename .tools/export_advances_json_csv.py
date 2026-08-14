#!/usr/bin/env python3
"""Parse Ars Belli EU5 advance files into a CSV summary.

For each advance block in a source file, extract:
  type          - left blank (reserved)
  tags          - every `has_or_had_tag` value, joined with "; "
  age           - the raw `age = <value>`
  advance       - the advance key (without any REPLACE: prefix)
  eu5_modifiers - uncommented `key = value` modifiers, joined with "; "
                  (inline `# comments` are stripped)
  eu4_modifiers - commented-out `# key = value` modifiers, joined with "; "

Usage:
  python3 parse_advances.py <input.txt> [<output.csv>]
  python3 parse_advances.py <input1.txt> <input2.txt> ... --out <dir>

  With a single input and no --out, the CSV is written next to the script
  using the input's basename. With --out <dir>, every input is written to
  <dir>/<basename>.csv.

Examples:
  # one file -> .tools/eu5/abm_f5-t3_egypt.csv
  python3 parse_advances.py ../../in_game/common/advances/abm_f5-t3_egypt.txt

  # many files -> .tools/eu5/*.csv
  python3 parse_advances.py ../../in_game/common/advances/abm_f5-t3_*.txt --out .
"""

import csv
import os
import re
import sys
from pathlib import Path

# Top-level keys that are advance metadata, NOT modifiers.
META_KEYS = {
    "age",
    "icon",
    "potential",
    "requires",
    "allow",
    "ai_chance",
    "ai_will_do",
    "content_priority",
    "government",
    "country_type",
    "for",
    "allow_children",
    "modifier_while_progressing",
}

FIELDS = ["type", "tags", "age", "advance", "eu5_modifiers", "eu4_modifiers"]


def match_brace(text: str, start: int) -> int:
    """Return index just past the '}' matching the '{' at text[start-1]."""
    depth = 1
    i = start
    while i < len(text) and depth > 0:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    return i


def remove_key_block(text: str, key: str) -> str:
    """Remove every `key = { ... }` block (nested braces aware) from text."""
    pattern = re.compile(r"(?:^|\n)[ \t]*" +
                         re.escape(key) + r"[ \t]*=[ \t]*\{")
    out = []
    i = 0
    while i < len(text):
        m = pattern.search(text, i)
        if not m:
            out.append(text[i:])
            break
        out.append(text[i:m.start()])
        end = match_brace(text, m.end())
        i = end
    return "".join(out)


def strip_inline_comment(line: str) -> str:
    """Cut a trailing `# ...` note off a line and trim whitespace."""
    return line.split("#", 1)[0].strip()


def parse_advances(text: str) -> list[dict]:
    block_re = re.compile(r"^(?:REPLACE:)?(\w+)[ \t]*=[ \t]*\{", re.MULTILINE)

    results = []
    for m in block_re.finditer(text):
        name = m.group(1)

        # Skip fully commented-out blocks (the name line starts with '#').
        line_start = text.rfind("\n", 0, m.start()) + 1
        if text[line_start:m.start()].strip().startswith("#"):
            continue

        end = match_brace(text, m.end())
        block = text[m.end():end - 1]

        age_m = re.search(r"(?:^|\n)[ \t]*age[ \t]*=[ \t]*(\S+)", block)
        age = age_m.group(1) if age_m else ""

        tags = re.findall(r"has_or_had_tag[ \t]*=[ \t]*(\S+)", block)

        # Strip metadata blocks that can contain nested braces.
        stripped = block
        for key in ("potential", "allow", "ai_chance", "modifier_while_progressing"):
            stripped = remove_key_block(stripped, key)

        eu5 = []
        for line in stripped.split("\n"):
            s = strip_inline_comment(line)
            if not s or s.startswith("#"):
                continue
            key_m = re.match(r"^(\S+)[ \t]*=", s)
            if key_m and (key_m.group(1) in META_KEYS or key_m.group(1).startswith("unlock_")):
                continue
            eu5.append(s)

        eu4 = []
        for line in block.split("\n"):
            raw = line.strip()
            if not raw.startswith("#"):
                continue
            s = strip_inline_comment(raw[1:])
            if s and "=" in s:
                eu4.append(s)

        results.append({
            "type": "",
            "tags": "; ".join(tags),
            "age": age,
            "advance": name,
            "eu5_modifiers": "; ".join(eu5),
            "eu4_modifiers": "; ".join(eu4),
        })
    return results


def write_csv(out_path: Path, rows: list[dict]) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS,
                                quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1

    out_dir = None
    if "--out" in argv:
        i = argv.index("--out")
        out_dir = Path(argv[i + 1])
        del argv[i:i + 2]

    script_dir = Path(__file__).resolve().parent

    for arg in argv:
        src = Path(arg)
        text = src.read_text(encoding="utf-8")
        rows = parse_advances(text)

        if out_dir is not None:
            dest = out_dir / (src.stem + ".csv")
        else:
            dest = script_dir / (src.stem + ".csv")

        write_csv(dest, rows)
        print(f"Wrote {len(rows):3d} advances -> {dest}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
