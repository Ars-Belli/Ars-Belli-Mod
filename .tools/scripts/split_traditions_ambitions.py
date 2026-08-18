#!/usr/bin/env python3
"""Split age_1 double-modifier advances into china_tradition_1/2
and rename last advance to china_ambition.

Usage: python .tools/split_traditions_ambitions.py <path_to_advances_file>
"""

import re, sys


def find_block(text, key):
    """Find a top-level block by key, handling nested braces."""
    escaped = re.escape(key)
    pattern = re.compile(escaped + r'\s*=\s*\{')
    m = pattern.search(text)
    if not m:
        return None, None
    start = m.start()
    brace_start = m.end() - 1  # position of opening {
    depth = 0
    i = brace_start
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None, None


def split_block(block_text):
    """Split a block into header (up to requires) and modifier list."""
    req_match = re.search(r'\n(\trequires = [^\n]+)', block_text)
    if not req_match:
        return None, None, None
    header = block_text[:req_match.end()]
    tail = block_text[req_match.end():]
    tail = tail.rstrip()
    if tail.endswith('}'):
        tail = tail[:-1].rstrip()
    mod_lines = []
    for line in tail.split('\n'):
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            mod_lines.append(line)
    closing = block_text[block_text.rfind('}'):]
    return header, mod_lines, closing


def transform_file(filepath, tags_info):
    """
    tags_info: list of (tag, old_first_key, old_last_key) tuples
    """
    with open(filepath) as f:
        content = f.read()

    for tag, old_first, old_last in tags_info:
        start, end = find_block(content, old_first)
        if start is None:
            print(f'WARNING: Could not find {old_first}')
            continue
        block = content[start:end]
        header, mods, closing = split_block(block)
        if header is None or not mods:
            print(f'WARNING: Could not parse {tag}')
            continue
        mid = len(mods) // 2
        m1 = mods[:mid]
        m2 = mods[mid:]
        new_header_1 = header.replace(old_first + ' = {',
                                      f'abm_{tag}_china_tradition_1 = {{', 1)
        new_header_2 = header.replace(old_first + ' = {',
                                      f'abm_{tag}_china_tradition_2 = {{', 1)
        repl = (
            new_header_1 + '\n'
            + '\n'
            + '\n'.join(m1) + '\n'
            + closing + '\n'
            + '\n'
            + new_header_2 + '\n'
            + '\n'
            + '\n'.join(m2) + '\n'
            + closing
        )
        content = content[:start] + repl + content[end:]
        content = content.replace(f'{old_last} = {{',
                                  f'abm_{tag}_china_ambition = {{')

    # Fix any mod-to-mod prerequisite references
    # Example: MNG grand_divisions_restored -> china_tradition_1
    for tag, old_first, old_last in tags_info:
        content = content.replace(f'requires = {old_first}',
                                  f'requires = abm_{tag}_china_tradition_1')

    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Done: {filepath}')


# Example usage for east China file:
if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python split_traditions_ambitions.py <file>")
        print("Edit the script to define tags_info for your file.")
        sys.exit(1)

    # Define tag mappings here based on the file
    # Format: (tag_lowercase, old_first_advance_key, old_last_advance_key)
    tags_info = [
        # Add your tags here, e.g.:
        # ('cgu', 'abm_cgu_aristocratic_assembly_charter', 'abm_cgu_grand_canal_state_office'),
    ]

    if not tags_info:
        print("ERROR: tags_info is empty. Edit the script to define your tags.")
        sys.exit(1)

    transform_file(sys.argv[1], tags_info)
