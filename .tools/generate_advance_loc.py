#!/usr/bin/env python3
"""Generate EU5 localization for advances imported from EU4 idea groups."""

import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
ADVANCE_DIR = BASE / "in_game/common/advances"
EU4_LOC_DIR = BASE / ".tools/eu4/localisation"
EU4_IDEA_DIR = BASE / ".tools/eu4/ideas"
OUTPUTS = {
    "india": BASE / "main_menu/localization/english/abm_advances_india_l_english.yml",
    "indochina": BASE / "main_menu/localization/english/abm_advances_indochina_l_english.yml",
    "indonesia": BASE / "main_menu/localization/english/abm_advances_indonesia_l_english.yml",
}
SET_ALIASES = {
    "lao": "laotian",
    "sulu": "sul",
}

def get_region(filename):
    if "india_" in filename:
        return "india"
    if "indochina" in filename:
        return "indochina"
    if "indonesia" in filename:
        return "indonesia"
    return "other"

# ---------------------------------------------------------------------------
# 1. Parse all EU4 localizations
# ---------------------------------------------------------------------------
eu4_name = {}
eu4_desc = {}

for f in sorted(EU4_LOC_DIR.glob("*.yml")):
    with open(f, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r'^\s*([a-zA-Z_][a-zA-Z_0-9]*):\d*\s+"(.*)"\s*$', line)
            if m:
                key = m.group(1).lower()
                value = m.group(2)
                if key.endswith("_desc"):
                    eu4_desc[key[:-5]] = value
                else:
                    eu4_name[key] = value

print(f"Loaded {len(eu4_name)} EU4 name keys (+ {len(eu4_desc)} descs)")

# Parse the idea slots in each EU4 idea group. Converted advance keys sometimes
# retain or drop a group prefix, so group membership provides a safe alias map.
eu4_idea_keys = {}

for f in sorted(EU4_IDEA_DIR.glob("*.txt")):
    depth = 0
    current_set = None
    with open(f, encoding="utf-8-sig") as fh:
        for line in fh:
            code = line.split("#", 1)[0]

            if depth == 0:
                m = re.match(r'^\s*([a-zA-Z_][a-zA-Z_0-9]*)_ideas\s*=\s*\{', code)
                if m:
                    current_set = m.group(1).lower()
                    eu4_idea_keys.setdefault(current_set, set())
            elif current_set and depth == 1:
                m = re.match(r'^\s*([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*\{', code)
                if m and m.group(1) not in {"start", "bonus", "trigger"}:
                    eu4_idea_keys[current_set].add(m.group(1).lower())

            depth += code.count("{") - code.count("}")
            if depth == 0:
                current_set = None

print(f"Loaded idea slots for {len(eu4_idea_keys)} EU4 idea groups")

# ---------------------------------------------------------------------------
# 2. Extract advances with their idea-set context
# ---------------------------------------------------------------------------
advances = []

for fpath in sorted(ADVANCE_DIR.glob("abm_*.txt")):
    current_set = None
    with open(fpath, encoding="utf-8") as fh:
        for line in fh:
            m = re.match(r'^#\s*([a-zA-Z_][a-zA-Z_0-9]*)_ideas?\s*$', line)
            if m:
                current_set = m.group(1).lower()
                continue

            m = re.match(r'^([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*\{', line)
            if not m:
                continue
            key = m.group(1)

            # Extract set tag from tradition/ambition keys
            tm = re.match(r'^abm_(.+)_ideas?_tradition[s]?_[12]$', key)
            if tm:
                current_set = tm.group(1).lower()

            advances.append((fpath.name, key, current_set))

print(f"Found {len(advances)} advance keys in {len(set(f for f,_,_ in advances))} files")

# ---------------------------------------------------------------------------
# 3. Map advance keys → EU4 localizations
# ---------------------------------------------------------------------------
def try_lookup(eu4_key):
    kl = eu4_key.lower()
    if kl in eu4_name:
        return eu4_name[kl], eu4_desc.get(kl, "")

    if "_" in eu4_key:
        parts = eu4_key.split("_", 1)
        alt = parts[0].upper() + "_" + parts[1]
        if alt.lower() in eu4_name:
            return eu4_name[alt.lower()], eu4_desc.get(alt.lower(), "")

    return None, None

def key_to_display(key):
    """Generate a human-readable name from a key like abm_river_warfare → River Warfare."""
    s = key
    for prefix in ["abm_", "tau_", "tpr_", "trt_"]:
        if s.startswith(prefix):
            s = s[len(prefix):]
            break
    return " ".join(w.capitalize() for w in s.split("_"))

def set_candidates(set_tag):
    candidates = [set_tag]
    if set_tag in SET_ALIASES:
        candidates.append(SET_ALIASES[set_tag])
    return candidates

def resolve(adv_key, set_tag):
    """Resolve an advance key to its display name and description."""
    # Pattern 1: Tradition/ambition keys (with _idea_ or _ideas_)
    m = re.match(r'^abm_(.+)_ideas?_tradition[s]?_([12])$', adv_key)
    if m:
        base = m.group(1)
        for candidate in set_candidates(base):
            name, desc = try_lookup(candidate + "_ideas_start")
            if name:
                suffix = " I" if m.group(2) == "1" else " II"
                return name + suffix, desc, True
        # Fallback
        return f"{key_to_display(base)} Traditions{' I' if m.group(2) == '1' else ' II'}", "", False

    m = re.match(r'^abm_(.+)_ideas?_ambition$', adv_key)
    if m:
        base = m.group(1)
        for candidate in set_candidates(base):
            name, desc = try_lookup(candidate + "_ideas_bonus")
            if name:
                return name, desc, True
        return f"{key_to_display(base)} Ambition", "", False

    # Pattern 2: Tradition keys without abm_ prefix (tau_traditions_1, tau_ambition)
    m = re.match(r'^([a-z]+)_traditions?_([12])$', adv_key)
    if m:
        tag = m.group(1).upper()
        eu4_base = f"{tag}_ideas_start"
        name, desc = try_lookup(eu4_base)
        if name:
            suffix = " I" if m.group(2) == "1" else " II"
            return name + suffix, desc, True
        return f"{key_to_display(tag)} Traditions{' I' if m.group(2) == '1' else ' II'}", "", False

    m = re.match(r'^([a-z]+)_ambition$', adv_key)
    if m:
        tag = m.group(1).upper()
        eu4_base = f"{tag}_ideas_bonus"
        name, desc = try_lookup(eu4_base)
        if name:
            return name, desc, True
        return f"{key_to_display(tag)} Ambition", "", False

    # Pattern 3: Keys without abm_ prefix (tpr_rajmala, trt_scholars_and_poets)
    if not adv_key.startswith("abm_"):
        # Sulu can be sul_ in EU4
        name, desc = try_lookup(adv_key)
        if name:
            return name, desc, True
        if set_tag:
            name, desc = try_lookup(f"{set_tag}_{adv_key}")
            if name:
                return name, desc, True
            # Try sul_ for sulu_ sets
            if set_tag == "sulu":
                name, desc = try_lookup(f"sul_{adv_key}")
                if name:
                    return name, desc, True
        return key_to_display(adv_key), "", False

    # Pattern 4: Regular idea with abm_ prefix
    idea_part = adv_key[4:]

    # Direct match
    name, desc = try_lookup(idea_part)
    if name:
        return name, desc, True

    # With set tag prefix
    if set_tag:
        name, desc = try_lookup(f"{set_tag}_{idea_part}")
        if name:
            return name, desc, True
        # sul_ for sulu_
        if set_tag == "sulu":
            name, desc = try_lookup(f"sul_{idea_part}")
            if name:
                return name, desc, True

        # Match converted IDs to a canonical slot in the same EU4 idea group.
        # Examples: malayan_heirs_of_pasai -> heirs_of_pasai and
        # seafaring_people -> cham_seafaring_people.
        group_keys = set().union(*(
            eu4_idea_keys.get(candidate, set())
            for candidate in set_candidates(set_tag)
        ))
        group_candidates = [
            key for key in group_keys
            if idea_part == key
            or idea_part.endswith(f"_{key}")
            or key.endswith(f"_{idea_part}")
        ]
        for candidate in sorted(group_candidates, key=len, reverse=True):
            name, desc = try_lookup(candidate)
            if name:
                return name, desc, True

    # Fallback: generate from key
    return key_to_display(idea_part), "", False

# ---------------------------------------------------------------------------
# 4. Group advances by region and generate output
# ---------------------------------------------------------------------------
region_advances = {}
for filename, adv_key, set_tag in advances:
    region = get_region(filename)
    region_advances.setdefault(region, []).append((filename, adv_key, set_tag))

total_matched = 0
total_fallback = 0

for region, adv_list in sorted(region_advances.items()):
    if region not in OUTPUTS:
        continue

    lines = ["l_english:"]
    matched = 0
    fallback = 0
    duplicate = 0
    generated = {}
    unresolved = []

    for filename, adv_key, set_tag in adv_list:
        name, desc, was_matched = resolve(adv_key, set_tag)

        if was_matched:
            matched += 1
        else:
            fallback += 1
            unresolved.append(adv_key)

        display_name = name.replace('"', "'") if name else key_to_display(adv_key)
        display_desc = desc.replace('"', "'") if desc else display_name

        values = (display_name, display_desc)
        if adv_key in generated:
            if generated[adv_key] != values:
                raise ValueError(f"Conflicting localization for duplicate key {adv_key}")
            duplicate += 1
            continue
        generated[adv_key] = values

        lines.append(f" {adv_key}: \"{display_name}\"")
        lines.append(f" {adv_key}_desc: \"{display_desc}\"")
        lines.append("")

    outpath = OUTPUTS[region]
    with open(outpath, "w", encoding="utf-8-sig", newline="\r\n") as f:
        f.write("\n".join(lines))

    total_matched += matched
    total_fallback += fallback
    print(
        f"  {region}: {matched} matched, {fallback} fallback, "
        f"{duplicate} duplicate skipped → {outpath.name}"
    )
    for adv_key in unresolved:
        print(f"    fallback: {adv_key}")

print(f"\nTotal: {total_matched} matched, {total_fallback} fallback across {len(OUTPUTS)} files")
