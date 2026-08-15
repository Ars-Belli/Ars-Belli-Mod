#!/usr/bin/env python3
"""
merge_country_modifiers.py (stdlib-only, alias-tolerant version)

Merges eu4_vs_eu5_advances2.csv with:
    eu4/eu4_modifiers_country.csv
    eu5/eu5_modifiers_country.csv

Tolerates both prefixed (eu4_modifier) and unprefixed (modifier) column names.

Usage:
    python3 merge_country_modifiers.py
"""

import argparse
import csv
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent

FINAL_COLUMNS = [
    'eu5_modifier', 'eu4_matches', 'confidence', 'notes',
    'eu5_localization', 'eu5_category', 'eu5_type', 'eu5_format',
    'eu4_subsection', 'eu4_description', 'eu4_effect_type',
]

# canonical_name -> list of acceptable actual column names, in priority order
EU4_ALIASES = {
    'subsection':  ['eu4_subsection', 'subsection'],
    'modifier':    ['eu4_modifier', 'modifier'],
    'example':     ['eu4_example', 'example'],
    'description': ['eu4_description', 'description'],
    'effect_type': ['eu4_effect_type', 'effect_type'],
}

EU5_ALIASES = {
    'modifier':     ['eu5_modifier'],
    'localization': ['eu5_localization'],
    'category':     ['eu5_category'],
    'type':         ['eu5_type'],
    'format':       ['eu5_format'],
}


def read_csv_rows(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = [fn.strip()
                      for fn in reader.fieldnames if fn and fn.strip()]
        rows = []
        for row in reader:
            clean_row = {k.strip(): (v or '').strip()
                         for k, v in row.items() if k and k.strip()}
            rows.append(clean_row)
        return rows, fieldnames


def resolve_aliases(fieldnames, aliases_map, source_label):
    """
    For each canonical field, find which actual column name is present.
    Returns dict: canonical_name -> actual_column_name
    Raises if none of the candidates are found.
    """
    resolved = {}
    for canonical, candidates in aliases_map.items():
        found = next((c for c in candidates if c in fieldnames), None)
        if found is None:
            raise ValueError(
                f"{source_label}: none of {candidates} found for '{canonical}' "
                f"(available columns: {fieldnames})"
            )
        resolved[canonical] = found
    return resolved


def build_lookup(rows, key_field):
    lookup = {}
    dupes = set()
    for row in rows:
        key = (row.get(key_field) or '').strip()
        if not key:
            continue
        if key in lookup:
            dupes.add(key)
        lookup[key] = row
    if dupes:
        print(
            f"  ⚠ WARNING: {len(dupes)} duplicate '{key_field}' value(s), last occurrence used:")
        for d in sorted(dupes)[:10]:
            print(f"      {d}")
        if len(dupes) > 10:
            print(f"      ... and {len(dupes) - 10} more")
    return lookup


def main():
    parser = argparse.ArgumentParser(
        description="Merge advances2 mapping with EU4/EU5 country modifier CSVs.")
    parser.add_argument(
        '--mapping', default=str(SCRIPT_DIR / 'eu4_vs_eu5_advances2.csv'))
    parser.add_argument(
        '--eu4-source', default=str(SCRIPT_DIR / 'eu4' / 'eu4_modifiers_country.csv'))
    parser.add_argument(
        '--eu5-source', default=str(SCRIPT_DIR / 'eu5' / 'eu5_modifiers_country.csv'))
    parser.add_argument('--out', default=str(SCRIPT_DIR /
                        'eu4_vs_eu5_advances2_merged.csv'))
    args = parser.parse_args()

    for label, path in [('mapping', args.mapping), ('eu4-source', args.eu4_source), ('eu5-source', args.eu5_source)]:
        if not Path(path).exists():
            raise FileNotFoundError(f"{label} file not found: {path}")

    mapping_rows, mapping_fields = read_csv_rows(args.mapping)
    for col in ['eu5_modifier', 'eu4_matches', 'confidence', 'notes']:
        if col not in mapping_fields:
            raise ValueError(f"{args.mapping} missing expected column: {col}")

    eu5_rows, eu5_fields = read_csv_rows(args.eu5_source)
    eu5_cols = resolve_aliases(eu5_fields, EU5_ALIASES, args.eu5_source)
    print(f"EU5 column mapping resolved: {eu5_cols}")

    eu4_rows, eu4_fields = read_csv_rows(args.eu4_source)
    eu4_cols = resolve_aliases(eu4_fields, EU4_ALIASES, args.eu4_source)
    print(f"EU4 column mapping resolved: {eu4_cols}")

    print(f"Building EU5 lookup ({len(eu5_rows)} rows)")
    eu5_lookup = build_lookup(eu5_rows, eu5_cols['modifier'])

    print(f"Building EU4 lookup ({len(eu4_rows)} rows)")
    eu4_lookup = build_lookup(eu4_rows, eu4_cols['modifier'])

    output_rows = []
    unmatched_eu5_count = 0
    unmatched_eu4_count = 0

    for row in mapping_rows:
        eu5_key = (row.get('eu5_modifier') or '').strip()
        eu4_key = (row.get('eu4_matches') or '').strip()

        eu5_hit = eu5_lookup.get(eu5_key, {}) if eu5_key else {}
        eu4_hit = eu4_lookup.get(eu4_key, {}) if eu4_key else {}

        if eu5_key and not eu5_hit:
            unmatched_eu5_count += 1
        if eu4_key and not eu4_hit:
            unmatched_eu4_count += 1

        out_row = {
            'eu5_modifier': row.get('eu5_modifier', ''),
            'eu4_matches': row.get('eu4_matches', ''),
            'confidence': row.get('confidence', ''),
            'notes': row.get('notes', ''),
            'eu5_localization': eu5_hit.get(eu5_cols['localization'], ''),
            'eu5_category': eu5_hit.get(eu5_cols['category'], ''),
            'eu5_type': eu5_hit.get(eu5_cols['type'], ''),
            'eu5_format': eu5_hit.get(eu5_cols['format'], ''),
            'eu4_subsection': eu4_hit.get(eu4_cols['subsection'], ''),
            'eu4_description': eu4_hit.get(eu4_cols['description'], ''),
            'eu4_effect_type': eu4_hit.get(eu4_cols['effect_type'], ''),
        }
        output_rows.append(out_row)

    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=FINAL_COLUMNS)
        writer.writeheader()
        writer.writerows(output_rows)

    print(
        f"\nMapping rows: {len(mapping_rows)}  ->  Merged rows: {len(output_rows)}")
    print(f"eu5_modifier set but no match: {unmatched_eu5_count}")
    print(f"eu4_matches set but no match: {unmatched_eu4_count}")
    print(f"Written to: {args.out}")


if __name__ == '__main__':
    main()
