#!/usr/bin/env python3
"""Update Chinese advance localizations: purge old, generate new."""

import re
from pathlib import Path

BASE = Path("/home/zp/Games/Modding/Ars-Belli-Mod")
ADVANCE_DIR = BASE / "in_game/common/advances"
LOC_FILE = BASE / "main_menu/localization/english/abm_advances_china_l_english.yml"

CHINA_FILES = [
    "abm_f3-t2_china_north.txt",
    "abm_f3-t2_china_east.txt",
    "abm_f3-t2_china_south.txt",
    "abm_f3-t2_china_west.txt",
]

# Tag display names
TAG_NAMES = {
    'anx': 'Anxi', 'ayg': 'Anyang', 'big': 'Bing', 'cdn': 'Dōngguǎn',
    'cfn': 'Fāng', 'cgu': 'Guō', 'che': 'Chén', 'chu': 'Chu',
    'cmo': 'Máo', 'cnp': 'Nánpíng', 'csi': 'Lǐ', 'cso': 'Sòng',
    'ctw': 'Tiānwán', 'cxi': 'Xià', 'gns': 'Gansu', 'hng': 'Hangzhou',
    'jnx': 'Jiangxi', 'kha': 'Kharchin', 'lez': 'Leizhou', 'lng': 'Liáng',
    'mng': 'Míng', 'mne': 'Yáo', 'sai': 'Shanxi', 'shd': 'Shandong',
    'wuu': 'Wú', 'yua': 'Yuán',
}

def snake_to_title(key):
    """Convert abm_tag_snake_name to a readable title."""
    parts = key.split('_')
    if parts[0] != 'abm' or len(parts) < 3:
        return key
    tag = parts[1]
    tag_name = TAG_NAMES.get(tag, tag.upper())
    
    if 'tradition' in key:
        if key.endswith('_1'):
            return f'{tag_name} Tradition I'
        elif key.endswith('_2'):
            return f'{tag_name} Tradition II'
    if 'ambition' in key:
        return f'{tag_name} Ambition'
    
    words = []
    for w in parts[2:]:
        if w == 'rgo':
            words.append('RGO')
        else:
            words.append(w.replace('_', ' ').title())
    return ' '.join(words)

def extract_advance_keys(filepath):
    """Extract all advance keys from a .txt file."""
    text = filepath.read_text(encoding='utf-8-sig')
    return set(re.findall(r'^(abm_[a-z_0-9]+) = \{', text, re.MULTILINE))

# Gather all current advance keys
current_keys = set()
for fname in CHINA_FILES:
    current_keys |= extract_advance_keys(ADVANCE_DIR / fname)

print(f"Found {len(current_keys)} current advance keys")

# Read localization file
lines = LOC_FILE.read_text(encoding='utf-8-sig').split('\n')

# Parse existing localization entries
existing_keys = set()
i = 0
while i < len(lines):
    line = lines[i].strip()
    if line.startswith('abm_') and ':' in line and not line.startswith('abm_wuu_people_granary'):
        key = line.split(':')[0].strip()
        if key.endswith('_desc'):
            key = key[:-5]
        existing_keys.add(key)
    i += 1

# Keys to remove (exist in loc but not in current advances)
removed = existing_keys - current_keys
# Keys to add (exist in current advances but not in loc)
added = current_keys - existing_keys

print(f"  Removing {len(removed)} obsolete entries")
print(f"  Adding {len(added)} new entries")

# Build new localization content
# Keep header (lines before first abm_ entry)
header_end = 0
for i, line in enumerate(lines):
    if line.strip().startswith('abm_'):
        header_end = i
        break

new_lines = lines[:header_end]

# Sort keys by tag group for readability
def tag_group(key):
    """Extract tag prefix for sorting."""
    m = re.match(r'abm_([a-z]+)_', key)
    return m.group(1) if m else ''

current_keys_sorted = sorted(current_keys, key=lambda k: (tag_group(k), k))

for key in current_keys_sorted:
    title = snake_to_title(key)
    new_lines.append(f' {key}: "{title}"')
    new_lines.append(f' {key}_desc: "{title}"')

output = '\n'.join(new_lines)
LOC_FILE.write_text(output, encoding='utf-8-sig')
print(f"Done: {LOC_FILE}")
print(f"  Removed: {len(removed)}")
print(f"  Added: {len(added)}")
print(f"  Total entries: {len(current_keys)}")
