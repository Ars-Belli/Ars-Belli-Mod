#!/usr/bin/env python3
"""
Fill the eu5_localization column in eu4_vs_eu5_advances3_merged.csv
with matching MODIFIER_TYPE_DESC_* descriptions from
eu5/localisation/modifier_types_l_english.yml.
"""

import csv
import re
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
YML_PATH = SCRIPT_DIR / "eu5" / "localisation" / "modifier_types_l_english.yml"
CSV_PATH = SCRIPT_DIR / "eu4_vs_eu5_advances3_merged.csv"


def main():
    # Parse the YML to build modifier_name -> description mapping
    desc_map: dict[str, str] = {}

    with open(YML_PATH, "r", encoding="utf-8") as f:
        for line in f:
            m = re.match(r' MODIFIER_TYPE_DESC_(\w+): "(.+)"', line)
            if m:
                desc_map[m.group(1)] = m.group(2)

    print(f"Loaded {len(desc_map)} descriptions from YML")

    # Read CSV, update eu5_localization column
    updated = 0
    unmatched = 0
    empty_mod = 0

    rows: list[dict] = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            mod = row.get("eu5_modifier", "").strip()
            if mod:
                if mod in desc_map:
                    row["eu5_localization"] = desc_map[mod]
                    updated += 1
                else:
                    unmatched += 1
            else:
                empty_mod += 1
            rows.append(row)

    print(f"Updated: {updated}")
    print(f"Unmatched (kept as-is): {unmatched}")
    print(f"Empty eu5_modifier (skipped): {empty_mod}")

    # Write back
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Done writing {CSV_PATH}")


if __name__ == "__main__":
    main()
