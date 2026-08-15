#!/usr/bin/env python3
"""Parse an EU5 advances file and output a CSV with advance modifiers.

Usage: python3 parse_advances.py [input_file] [output_csv]

If no arguments are given, defaults to abm_t2_steppes.txt → abm_t2_steppes.csv.
"""

import csv
import re
import os
import sys

INPUT_FILE = os.path.join(os.path.dirname(
    __file__), "../../in_game/common/advances/abm_t2_steppes.txt")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "abm_t2_steppes.csv")

# Known keys that are NOT modifiers
META_KEYS = {"age", "icon", "potential",
             "requires", "allow", "ai_chance", "ai_will_do"}


def _match_brace(text: str, start: int) -> int:
    """Return index just past the matching '}' for the '{' at text[start-1]."""
    brace_count = 1
    idx = start
    while idx < len(text) and brace_count > 0:
        if text[idx] == '{':
            brace_count += 1
        elif text[idx] == '}':
            brace_count -= 1
        idx += 1
    return idx


def _remove_nested_braces(text: str, key: str) -> str:
    """Remove `key = { ... }` blocks including nested braces from text."""
    result = []
    i = 0
    pattern = re.compile(r'(?:^|\n)\s*' + re.escape(key) + r'\s*=\s*\{')
    while i < len(text):
        m = pattern.search(text, i)
        if not m:
            result.append(text[i:])
            break
        result.append(text[i:m.start()])
        brace_start = m.end()
        end = _match_brace(text, brace_start)
        # Replace the block with whitespace to preserve line numbers (not needed, just skip)
        i = end
    return ''.join(result)


def parse_advances(filepath: str) -> list[dict]:
    """Parse the advances file and return a list of dicts."""
    with open(filepath, "r", encoding="utf-8") as f:
        text = f.read()

    # Match advance names: "name = {" or "REPLACE:name = {"
    pattern = re.compile(
        r'^(?:REPLACE:)?(\w+)\s*=\s*\{', re.MULTILINE
    )

    results = []

    for match in pattern.finditer(text):
        advance_name = match.group(1)
        start_idx = match.end()

        # Skip if the line starts with # (commented out)
        line_start = text.rfind('\n', 0, match.start()) + 1
        if text[line_start:match.start()].strip().startswith('#'):
            continue

        # Extract the full block text
        end_idx = _match_brace(text, start_idx)
        block_text = text[start_idx:end_idx - 1]

        # Extract age
        age_match = re.search(r'^\s*age\s*=\s*(\S+)', block_text, re.MULTILINE)
        age = age_match.group(1) if age_match else ""

        # Extract tag from potential block
        tag_match = re.search(r'has_or_had_tag\s*=\s*(\S+)', block_text)
        tag = tag_match.group(1) if tag_match else ""

        # Remove potential block (with nested braces) and requires line
        no_meta = _remove_nested_braces(block_text, 'potential')
        no_meta = _remove_nested_braces(no_meta, 'allow')
        no_meta = _remove_nested_braces(no_meta, 'ai_chance')

        eu5_modifiers = []
        eu4_modifiers = []

        for line in no_meta.split('\n'):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue

            # Check if it's a meta key
            key_match = re.match(r'^(\S+)\s*=', stripped)
            if key_match:
                key = key_match.group(1)
                if key in META_KEYS:
                    continue

            eu5_modifiers.append(stripped)

        # Find commented-out modifiers (from the full block, including potential area)
        for line in block_text.split('\n'):
            stripped = line.strip()
            if stripped.startswith('#') and '=' in stripped:
                comment_content = stripped[1:].strip()
                if comment_content and '=' in comment_content:
                    if not comment_content.startswith('#'):
                        eu4_modifiers.append(comment_content)

        results.append({
            "type": "",
            "tags": tag,
            "age": age,
            "advance": advance_name,
            "eu5_modifiers": "; ".join(eu5_modifiers),
            "eu4_modifiers": "; ".join(eu4_modifiers),
        })

    return results


def main():
    infile = sys.argv[1] if len(sys.argv) > 1 else INPUT_FILE
    outfile = sys.argv[2] if len(sys.argv) > 2 else OUTPUT_FILE

    results = parse_advances(infile)

    os.makedirs(os.path.dirname(outfile), exist_ok=True)

    with open(outfile, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["type", "tags", "age", "advance",
                        "eu5_modifiers", "eu4_modifiers"],
            quoting=csv.QUOTE_ALL,
        )
        writer.writeheader()
        writer.writerows(results)

    print(f"Wrote {len(results)} advances to {outfile}")


if __name__ == "__main__":
    main()
