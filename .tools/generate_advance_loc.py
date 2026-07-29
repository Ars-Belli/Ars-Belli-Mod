#!/usr/bin/env python3
"""Generate EU5 localization for advances imported from EU4 idea groups."""

import re
from pathlib import Path

BASE = Path("/home/zp/Games/Modding/Ars-Belli-Mod")
ADVANCE_DIR = BASE / "in_game/common/advances"
EU4_LOC_DIR = BASE / ".tools/eu4/localisation"
OUTPUT = BASE / "main_menu/localization/english/abm_advances_india_indochina_indonesia_l_english.yml"

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

def resolve(adv_key, set_tag):
    """Resolve an advance key to its display name and description."""
    # Pattern 1: Tradition/ambition keys (with _idea_ or _ideas_)
    m = re.match(r'^abm_(.+)_ideas?_tradition[s]?_([12])$', adv_key)
    if m:
        base = m.group(1)
        eu4_base = base + "_ideas_start"
        name, desc = try_lookup(eu4_base)
        if name:
            suffix = " I" if m.group(2) == "1" else " II"
            return name + suffix, desc
        # Fallback
        return f"{key_to_display(base)} Traditions{' I' if m.group(2) == '1' else ' II'}", ""

    m = re.match(r'^abm_(.+)_ideas?_ambition$', adv_key)
    if m:
        base = m.group(1)
        eu4_base = base + "_ideas_bonus"
        name, desc = try_lookup(eu4_base)
        if name:
            return name, desc
        return f"{key_to_display(base)} Ambition", ""

    # Pattern 2: Tradition keys without abm_ prefix (tau_traditions_1, tau_ambition)
    m = re.match(r'^([a-z]+)_traditions?_([12])$', adv_key)
    if m:
        tag = m.group(1).upper()
        eu4_base = f"{tag}_ideas_start"
        name, desc = try_lookup(eu4_base)
        if name:
            suffix = " I" if m.group(2) == "1" else " II"
            return name + suffix, desc
        return f"{key_to_display(tag)} Traditions{' I' if m.group(2) == '1' else ' II'}", ""

    m = re.match(r'^([a-z]+)_ambition$', adv_key)
    if m:
        tag = m.group(1).upper()
        eu4_base = f"{tag}_ideas_bonus"
        name, desc = try_lookup(eu4_base)
        if name:
            return name, desc
        return f"{key_to_display(tag)} Ambition", ""

    # Pattern 3: Keys without abm_ prefix (tpr_rajmala, trt_scholars_and_poets)
    if not adv_key.startswith("abm_"):
        # Sulu can be sul_ in EU4
        name, desc = try_lookup(adv_key)
        if name:
            return name, desc
        if set_tag:
            name, desc = try_lookup(f"{set_tag}_{adv_key}")
            if name:
                return name, desc
            # Try sul_ for sulu_ sets
            if set_tag == "sulu":
                name, desc = try_lookup(f"sul_{adv_key}")
                if name:
                    return name, desc
        return key_to_display(adv_key), ""

    # Pattern 4: Regular idea with abm_ prefix
    idea_part = adv_key[4:]

    # Direct match
    name, desc = try_lookup(idea_part)
    if name:
        return name, desc

    # With set tag prefix
    if set_tag:
        name, desc = try_lookup(f"{set_tag}_{idea_part}")
        if name:
            return name, desc
        # sul_ for sulu_
        if set_tag == "sulu":
            name, desc = try_lookup(f"sul_{idea_part}")
            if name:
                return name, desc

    # Fallback: generate from key
    return key_to_display(idea_part), ""

# ---------------------------------------------------------------------------
# 4. Generate output
# ---------------------------------------------------------------------------
lines = ["l_english:"]
matched = 0
fallback = 0

for filename, adv_key, set_tag in advances:
    name, desc = resolve(adv_key, set_tag)

    # Detect if this is a fallback
    is_fb = (name is not None and desc == "" and not any(
        k in adv_key.lower() for k in ["tradition", "ambition"]
    )) or name == key_to_display(adv_key) or name == key_to_display(adv_key[4:])

    if is_fb:
        fallback += 1
    else:
        matched += 1

    display_name = name.replace('"', "'") if name else key_to_display(adv_key)
    display_desc = desc.replace('"', "'") if desc else display_name

    lines.append(f" {adv_key}: \"{display_name}\"")
    if desc:
        lines.append(f" {adv_key}_desc: \"{display_desc}\"")
    else:
        lines.append(f" {adv_key}_desc: \"{display_name}\"")
    lines.append("")

print(f"\nMatched (EU4): {matched}, Fallback (generated): {fallback}")

with open(OUTPUT, "w", encoding="utf-8-sig", newline="\r\n") as f:
    f.write("\n".join(lines))

print(f"Wrote {OUTPUT}")
print(f"Total lines: {len(lines)}")
