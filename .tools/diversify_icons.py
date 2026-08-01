#!/usr/bin/env python3
"""Assign unique vanilla icons to each advance in China tag files.
Uses round-robin from the full vanilla icon pool, ensuring no duplicate
icon within a tag.

Usage: python .tools/diversify_icons.py <path_to_advances_file>
  or:  python .tools/diversify_icons.py --all   (process all abm_f3-t2_*_china.txt)
"""

import re, glob, subprocess, random, sys

random.seed(777)


def load_vanilla_icons():
    """Load all unique icon names from vanilla EU5 advance files."""
    result = subprocess.run(
        'grep -rh "icon = " '
        '"/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game/in_game/common/advances/"*.txt',
        shell=True, capture_output=True, text=True
    )
    icons = set()
    for line in result.stdout.split('\n'):
        m = re.search(r'icon\s*=\s*(\S+)', line)
        if m:
            icons.add(m.group(1))
    return sorted(icons)


def find_block(text, key):
    escaped = re.escape(key)
    m = re.search(escaped + r'\s*=\s*\{', text)
    if not m:
        return None, None
    start = m.start()
    depth, i = 0, m.end() - 1
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None, None


def diversify_file(filepath, vanilla_icons):
    with open(filepath) as f:
        content = f.read()

    all_keys = re.findall(r'^(abm_\w+) = \{', content, re.MULTILINE)
    tag_keys = {}
    for k in all_keys:
        tag = k.split('_')[1]
        tag_keys.setdefault(tag, []).append(k)

    global_icon_idx = 0

    for tag, keys in tag_keys.items():
        used_icons = set()
        for key in keys:
            start, end = find_block(content, key)
            if start is None:
                continue

            # Pick next unused icon
            attempts = 0
            while (vanilla_icons[global_icon_idx % len(vanilla_icons)]
                   in used_icons
                   and attempts < len(vanilla_icons)):
                global_icon_idx += 1
                attempts += 1
            icon = vanilla_icons[global_icon_idx % len(vanilla_icons)]
            used_icons.add(icon)
            global_icon_idx += 1

            block = content[start:end]
            lines = block.split('\n')
            new_lines = []
            for line in lines:
                s = line.strip()
                if s.startswith('icon = '):
                    indent = line[:len(line) - len(line.lstrip())]
                    line = f'{indent}icon = {icon}'
                new_lines.append(line)

            content = content[:start] + '\n'.join(new_lines) + content[end:]

    with open(filepath, 'w') as f:
        f.write(content)


if __name__ == '__main__':
    icons = load_vanilla_icons()
    random.shuffle(icons)
    print(f'Vanilla icon pool: {len(icons)}')

    if len(sys.argv) > 1 and sys.argv[1] == '--all':
        files = sorted(glob.glob(
            'in_game/common/advances/abm_f3-t2_*_china.txt'))
    elif len(sys.argv) > 1:
        files = [sys.argv[1]]
    else:
        print("Usage: python diversify_icons.py <file> | --all")
        sys.exit(1)

    for fp in files:
        diversify_file(fp, icons)
        print(f'Done: {fp}')
