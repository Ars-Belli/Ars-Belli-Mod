#!/usr/bin/env python3
"""Split 10_countries.txt into per-region files based on capital location."""

import os
import re
from collections import defaultdict

BASE = "/home/zp/Games/Modding/Ars-Belli-Mod/main_menu/setup/start"
DEFINITIONS = "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game/in_game/map_data/definitions.txt"
INPUT = os.path.join(BASE, "10_countries.txt.bak")

DIRECTION_WORDS = {"east", "eastern", "west", "western", "north", "northern", "south", "southern", "central"}

def parse_definitions(path):
    """Parse definitions.txt and return dict: location_name -> region_name."""
    loc_to_region = {}
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    region_stack = []   # stack of (region_name, depth_at_entry)
    cum_depth = 0

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue

        opens = line.count('{')
        closes = line.count('}')

        # Check for region block opening
        if opens > 0 and ' = {' in stripped:
            name_part = stripped.split(' = {')[0].strip()
            if name_part.endswith('_region'):
                region_stack.append((name_part, cum_depth))

        # Extract location names from this line:
        # 1. Lines without = or { (continuation lines with just locations)
        # 2. Content within { ... } on block definition lines
        if region_stack:
            locations = []
            if '=' not in stripped and '{' not in stripped and stripped != '}':
                # Pure location line
                locations = stripped.split()
            elif '{' in stripped:
                # Block definition line that may have locations inside { ... }
                # Example: "province = { loc1 loc2 loc3 }" or "province = { loc1 loc2 ..."
                # Get content after '{' and before '}'
                brace_start = stripped.index('{')
                content = stripped[brace_start+1:]
                content = content.replace('}', ' ').strip()
                if content:
                    locs = content.split()
                    # Filter out any '=' or other non-location tokens
                    locations.extend(l for l in locs if '=' not in l and not l.startswith('#'))

            for loc in locations:
                loc = loc.strip('{}')
                if loc and not loc.startswith('#'):
                    if loc not in loc_to_region:
                        loc_to_region[loc] = region_stack[-1][0]

        # Update cumulative brace depth AFTER processing the line
        cum_depth += opens
        cum_depth -= closes

        # Pop regions whose closing brace brought depth below their entry level
        while region_stack and region_stack[-1][1] > cum_depth:
            region_stack.pop()

    return loc_to_region


def region_to_filename(region_name):
    """Convert 'west_china_region' -> 'china_west_region'."""
    base = region_name
    if base.endswith('_region'):
        base = base[:-7]
    parts = base.split('_')
    if parts and parts[0] in DIRECTION_WORDS:
        direction = parts[0]
        rest = '_'.join(parts[1:])
        return f"{rest}_{direction}_region"
    else:
        return f"{base}_region"


def parse_countries(filepath):
    """Parse country file into (preamble_lines, [(tag, start_line, end_line_excl, capital)], trailer_lines)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Find the second 'countries = {' which marks inner country blocks
    inner_start = None
    found_first = False
    for i, line in enumerate(lines):
        if 'countries = {' in line:
            if not found_first:
                found_first = True
            else:
                inner_start = i
                break
    if inner_start is None:
        raise ValueError("Could not find inner countries block")
    preamble = lines[:inner_start + 1]

    tag_pattern = re.compile(r'^(\s*)([A-Z0-9]{3})\s*=\s*\{')

    blocks = []
    j = inner_start + 1
    while j < len(lines):
        m = tag_pattern.match(lines[j])
        if m:
            tag = m.group(2)
            # Skip lines in comment blocks (# prefix after whitespace)
            if lines[j].lstrip().startswith('#'):
                j += 1
                continue
            block_start = j
            brace_depth = 1
            j += 1
            while j < len(lines) and brace_depth > 0:
                for ch in lines[j]:
                    if ch == '{':
                        brace_depth += 1
                    elif ch == '}':
                        brace_depth -= 1
                j += 1
            # Extract capital
            block_text = ''.join(lines[block_start:j])
            capital = None
            m_cap = re.search(r'^\s*capital\s*=\s*(\w[\w.]*)', block_text, re.MULTILINE)
            if m_cap:
                capital = m_cap.group(1)
                # Normalize: some capitals have dots like 'dan.erik_v_schleswig'
                # Take first part if dotted
                if '.' in capital:
                    capital = capital.split('.')[0]
            blocks.append((tag, block_start, j, capital))
        else:
            j += 1

    last_end = blocks[-1][2] if blocks else len(preamble)
    trailer = lines[last_end:]
    return preamble, blocks, trailer


def main():
    print("Parsing definitions.txt...")
    loc_to_region = parse_definitions(DEFINITIONS)
    print(f"  Mapped {len(loc_to_region)} locations to regions")

    print(f"Parsing {INPUT}...")
    preamble, blocks, trailer = parse_countries(INPUT)
    print(f"  Found {len(blocks)} country blocks")

    # Load lines once
    with open(INPUT, 'r', encoding='utf-8') as f:
        file_lines = f.readlines()

    # Group blocks by region
    region_blocks = defaultdict(list)
    unmapped = []

    for tag, start, end, capital in blocks:
        if capital and capital in loc_to_region:
            region = loc_to_region[capital]
            region_blocks[region].append((tag, start, end))
        else:
            unmapped.append((tag, capital))

    # Report by region
    print(f"\nCountries by region ({len(region_blocks)} regions):")
    for region, blist in sorted(region_blocks.items(), key=lambda x: -len(x[1])):
        fname = region_to_filename(region)
        print(f"  {region:35s} → 10_countries_{fname}.txt  ({len(blist):4d} countries)")

    if unmapped:
        print(f"\nWARNING: {len(unmapped)} countries have unmapped capitals:")
        for tag, cap in sorted(unmapped, key=lambda x: str(x[1]) or ''):
            print(f"  {tag}: capital={cap}")
        if len(unmapped) > 30:
            print(f"  ... and {len(unmapped) - 30} more")

    # Write output files
    print("\nWriting output files...")
    out_dir = BASE

    for region, blist in sorted(region_blocks.items()):
        fname = region_to_filename(region)
        out_path = os.path.join(out_dir, f"10_countries_{fname}.txt")
        with open(out_path, 'w', encoding='utf-8') as f:
            for line in preamble:
                f.write(line)
            for tag, start, end in blist:
                for i in range(start, end):
                    f.write(file_lines[i])
            for line in trailer:
                f.write(line)
        print(f"  Wrote {out_path} ({len(blist)} countries)")

    print("\nDone!")

if __name__ == "__main__":
    main()
