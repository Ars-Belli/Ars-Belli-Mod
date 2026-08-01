#!/usr/bin/env python3
"""Generate localization entries for all ABM China advance keys.
Reads all abm_f3-t2_*_china.txt files, extracts advance keys,
and generates name + desc entries (both using the same Title Case text).

Output: main_menu/localization/english/abm_advances_china.yml

Usage: python .tools/generate_localization.py
"""

import re, glob


def key_to_display(key):
    """Convert abm_tag_snake_case_name to Title Case display name.
    Strips abm_ and tag_ prefix, keeps only the descriptive part."""
    parts = key.split('_')
    # parts[0]='abm', parts[1]=tag, parts[2:]=name
    name_parts = parts[2:]
    return ' '.join(p.title() for p in name_parts)


def generate():
    files = sorted(glob.glob('in_game/common/advances/abm_f3-t2_*_china.txt'))
    all_keys = set()

    for fp in files:
        with open(fp) as f:
            for line in f:
                m = re.match(r'^(abm_\w+) = \{', line)
                if m:
                    all_keys.add(m.group(1))

    lines = ['l_english:']
    prev_tag = None

    for key in sorted(all_keys):
        tag = key.split('_')[1]
        if tag != prev_tag:
            lines.append('')
            lines.append(f' # {tag.upper()}')
            prev_tag = tag

        display = key_to_display(key)
        lines.append(f' {key}: "{display}"')
        lines.append(f' {key}_desc: "{display}"')

    output_path = 'main_menu/localization/english/abm_advances_china_l_english.yml'
    with open(output_path, 'w', encoding='utf-8-sig') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Generated {len(all_keys)} entries -> {output_path}')


if __name__ == '__main__':
    generate()
