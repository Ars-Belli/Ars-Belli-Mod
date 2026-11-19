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

Region schema (--region-csv):
  tag/culture   - `has_or_had_tag` values, or (culture-gated blocks) the
                  `culture:` values from `potential`, joined with "/"
  tier          - formable level of the nation (`level` in
                  formable_countries); 0 if the tag is not formable
  age           - the raw `age = <value>`
  advance_name  - the advance key (without any REPLACE: prefix)
  modifier      - uncommented `key = value` modifiers, joined with "; "
  eu4_ideas     - commented-out `# key = value` modifiers, joined with "; "

Usage:
  python3 export_advances_json_csv.py <input.txt> [<input2.txt> ...] [--out <dir>]

  With no --out, the CSV is written next to the script using the input's
  basename. With --out <dir>, every input is written to <dir>/<basename>.csv.

  --region-csv   emit the region schema above instead of the default one.
                 Pair it with --formables, one dir per formable_countries
                 folder, vanilla first and the mod's second (later dirs win
                 for a repeated formable id):
                   --formables "$EU5_GAME/in_game/common/formable_countries" \\
                   --formables in_game/common/formable_countries
                 Without --formables every tier is 0.

Examples:
  # one file -> .tools/eu5/abm_africa_east.csv
  python3 export_advances_json_csv.py ../../in_game/common/advances/abm_africa_east.txt

  # many files -> .tools/eu5/*.csv
  python3 export_advances_json_csv.py ../../in_game/common/advances/abm_*.txt --out .

  # region schema with formable tiers
  python3 export_advances_json_csv.py ../../in_game/common/advances/abm_german.txt \\
    --region-csv --formables "<game>/in_game/common/formable_countries" \\
    --formables ../../in_game/common/formable_countries --out ../parsed
"""

import argparse
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

REGION_FIELDS = ["tag/culture", "tier", "age", "advance_name", "modifier",
                 "eu4_ideas"]


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


def iter_blocks(text: str):
    """Yield (name, block) for every `name = { ... }` / `REPLACE:name = { ... }`.

    `name` has any `REPLACE:` prefix removed; fully commented-out blocks are
    skipped.
    """
    block_re = re.compile(r"^(?:REPLACE:)?(\w+)[ \t]*=[ \t]*\{", re.MULTILINE)
    for m in block_re.finditer(text):
        # Skip fully commented-out blocks (the name line starts with '#').
        line_start = text.rfind("\n", 0, m.start()) + 1
        if text[line_start:m.start()].strip().startswith("#"):
            continue
        end = match_brace(text, m.end())
        yield m.group(1), text[m.end():end - 1]


def key_block(text: str, key: str) -> str:
    """Return the body of the first `key = { ... }` block, or ''."""
    m = re.search(r"(?:^|\n)[ \t]*" + re.escape(key) + r"[ \t]*=[ \t]*\{", text)
    if not m:
        return ""
    end = match_brace(text, m.end())
    return text[m.end():end - 1]


def block_modifiers(block: str) -> tuple[list[str], list[str]]:
    """Return (uncommented `key = value` lines, `# key = value` lines)."""
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

    return eu5, eu4


def parse_advances(text: str) -> list[dict]:
    results = []
    for name, block in iter_blocks(text):
        age_m = re.search(r"(?:^|\n)[ \t]*age[ \t]*=[ \t]*(\S+)", block)
        age = age_m.group(1) if age_m else ""

        tags = re.findall(r"has_or_had_tag[ \t]*=[ \t]*(\S+)", block)
        eu5, eu4 = block_modifiers(block)

        results.append({
            "type": "",
            "tags": "; ".join(tags),
            "age": age,
            "advance": name,
            "eu5_modifiers": "; ".join(eu5),
            "eu4_modifiers": "; ".join(eu4),
        })
    return results


def scope_label(potential: str) -> tuple[str, list[str]]:
    """Return (tag/culture cell, labels used for the tier lookup)."""
    tags = list(dict.fromkeys(re.findall(r"has_or_had_tag[ \t]*=[ \t]*(\w+)",
                                         potential)))
    if tags:
        return "; ".join(tags), tags
    cultures = list(dict.fromkeys(re.findall(r"\bculture:(\w+)", potential)))
    return "/".join(cultures), cultures


def top_level_values(block: str) -> dict[str, str]:
    """Depth-0 `key = value` pairs of a script block."""
    values = {}
    depth = 0
    for line in block.split("\n"):
        s = strip_inline_comment(line)
        if depth == 0 and s and "=" in s and not s.endswith("{"):
            key, _, value = s.partition("=")
            values.setdefault(key.strip(), value.strip())
        depth += s.count("{") - s.count("}")
    return values


def load_formables(dirs: list[Path]) -> list[dict]:
    """Parse formable_countries folders; a repeated id is overridden by the
    later folder (so pass vanilla first, mod second)."""
    formables = {}
    for folder in dirs:
        if not folder.is_dir():
            print(f"warning: no such formables dir: {folder}", file=sys.stderr)
            continue
        for path in sorted(folder.glob("*.txt")):
            text = path.read_text(encoding="utf-8-sig", errors="replace")
            for name, block in iter_blocks(text):
                values = top_level_values(block)
                try:
                    level = int(values.get("level", "0"))
                except ValueError:
                    level = 0
                cultures = list(dict.fromkeys(
                    re.findall(r"\bculture:(\w+)", key_block(block, "potential"))))
                formables[name] = {
                    "tag": values.get("tag", ""),
                    "level": level,
                    "cultures": cultures,
                }
    return list(formables.values())


def tier_lookups(formables: list[dict]) -> tuple[dict[str, int], dict[str, int]]:
    """Build (tag -> formable level, culture -> level of the formable that
    carries that tag)."""
    by_tag: dict[str, int] = {}
    by_culture: dict[str, int] = {}
    for f in formables:
        if not f["tag"]:
            continue
        by_tag[f["tag"]] = max(by_tag.get(f["tag"], 0), f["level"])
        for culture in f["cultures"]:
            by_culture[culture] = max(by_culture.get(culture, 0), f["level"])
    return by_tag, by_culture


def parse_region_rows(text: str, by_tag: dict[str, int],
                      by_culture: dict[str, int]) -> list[dict]:
    rows = []
    for name, block in iter_blocks(text):
        label, labels = scope_label(key_block(block, "potential"))
        levels = [lookup[l] for lookup in (by_tag, by_culture)
                  for l in labels if l in lookup]

        age_m = re.search(r"(?:^|\n)[ \t]*age[ \t]*=[ \t]*(\S+)", block)
        eu5, eu4 = block_modifiers(block)

        rows.append({
            "tag/culture": label,
            "tier": str(max(levels)) if levels else "0",
            "age": age_m.group(1) if age_m else "",
            "advance_name": name,
            "modifier": "; ".join(eu5),
            "eu4_ideas": "; ".join(eu4),
        })
    return rows


def write_csv(out_path: Path, rows: list[dict], fields: list[str] = FIELDS) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields,
                                quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("inputs", nargs="*", help="advance .txt files")
    parser.add_argument("--out", help="output folder (default: next to this script)")
    parser.add_argument("--region-csv", action="store_true",
                        help="emit tag/culture,tier,age,advance_name,modifier,eu4_ideas")
    parser.add_argument("--formables", action="append", default=[], metavar="DIR",
                        help="formable_countries folder for tier lookup (repeatable)")
    args = parser.parse_args(argv)

    if not args.inputs:
        parser.print_help()
        return 1

    by_tag: dict[str, int] = {}
    by_culture: dict[str, int] = {}
    if args.region_csv:
        if args.formables:
            by_tag, by_culture = tier_lookups(
                load_formables([Path(d) for d in args.formables]))
        else:
            print("warning: --region-csv without --formables: every tier is 0",
                  file=sys.stderr)

    script_dir = Path(__file__).resolve().parent

    for arg in args.inputs:
        src = Path(arg)
        text = src.read_text(encoding="utf-8-sig")

        if args.region_csv:
            rows = parse_region_rows(text, by_tag, by_culture)
            fields = REGION_FIELDS
        else:
            rows = parse_advances(text)
            fields = FIELDS

        dest = (Path(args.out) if args.out else script_dir) / (src.stem + ".csv")
        write_csv(dest, rows, fields)
        print(f"Wrote {len(rows):3d} advances -> {dest}")

    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
