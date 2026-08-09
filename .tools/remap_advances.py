#!/usr/bin/env python3
"""Redistribute formable nation advances from 3+3+2+2 to 2+2+3+2+1 pattern."""

import re
import os

BASE = "/home/zp/Games/Modding/Ars-Belli-Mod/in_game/common/advances"

# Files to process (formable sections only)
FILES = [
    "abm_f4-t2_india_deccan.txt",
    "abm_f4-t2_india_hindustan.txt",
    "abm_f4-t2_india_west.txt",
    "abm_f4-t2_indochina.txt",
]

# Age to default requires mapping
AGE_REQUIRES = {
    "age_2_renaissance": "feudalism_advance",
    "age_3_discovery": "pike_and_shot_advance",
    "age_4_reformation": "recruitment_improvements_reformation",
    "age_5_absolutism": "government_size_absolutism",
}

# Non-standard requires to preserve per age
PRESERVE_REQUIRES = {
    "age_4_reformation": {
        "early_modern_administation",
        "confessionalism_advance",
        "global_trade_advance",
        "construction_speed_reformation",
        "manufactories_advance",
        "scientific_revolution_advance",
    },
    "age_5_absolutism": {
        "manufactories_advance",
        "central_bank_advance",
        "scientific_revolution_advance",
    },
}


def get_new_age_mapping(advances):
    """Given 10 advances with ages, return list of (new_age, new_requires) pairs."""
    # Old distribution: 0,0,3,3,2,2 -> New: 0,2,2,3,2,1
    new_ages = (
        ["age_2_renaissance"] * 2
        + ["age_3_discovery"] * 2
        + ["age_4_reformation"] * 3
        + ["age_5_absolutism"] * 2
        + ["age_6_revolutions"] * 1
    )
    
    result = []
    for i, adv in enumerate(advances):
        new_age = new_ages[i]
        old_requires = adv["requires"]
        
        if new_age == "age_6_revolutions":
            # Keep original requires for age 6
            new_requires = old_requires
        elif new_age in PRESERVE_REQUIRES and old_requires in PRESERVE_REQUIRES[new_age]:
            new_requires = old_requires
        else:
            new_requires = AGE_REQUIRES.get(new_age, old_requires)
        
        result.append((new_age, new_requires))
    
    return result


def parse_advance_block(lines, start_idx):
    """Parse a single advance definition starting at start_idx. Returns (advance_dict, next_idx)."""
    adv = {}
    brace_depth = 0
    i = start_idx
    
    # Read the key line
    key_match = re.match(r"^(\S+)\s*=\s*\{", lines[i])
    if not key_match:
        return None, start_idx + 1
    
    adv["key"] = key_match.group(1)
    adv["start_line"] = i
    
    # Parse until matching close brace
    for j in range(i, len(lines)):
        line = lines[j]
        brace_depth += line.count("{") - line.count("}")
        
        # Extract age
        age_match = re.search(r'age\s*=\s*(\S+)', line)
        if age_match:
            adv["age"] = age_match.group(1)
        
        # Extract requires
        req_match = re.search(r'requires\s*=\s*(\S+)', line)
        if req_match:
            adv["requires"] = req_match.group(1)
        
        if brace_depth == 0:
            adv["end_line"] = j
            return adv, j + 1
    
    return adv, len(lines)


def find_formable_sections(lines):
    """Find all formable sections in the file. Returns list of (section_name, advances_list)."""
    sections = []
    in_formable = False
    current_section = None
    current_advances = []
    i = 0
    
    while i < len(lines):
        line = lines[i].strip()
        
        if line == "# FORMABLES":
            in_formable = True
            i += 1
            continue
        
        if in_formable and line.startswith("# T2"):
            # End of formable section
            if current_section and current_advances:
                sections.append((current_section, current_advances))
            in_formable = False
            current_section = None
            current_advances = []
            i += 1
            continue
        
        if in_formable and line.startswith("# ") and not line.startswith("# FORMABLES"):
            # Section header
            if current_section and current_advances:
                sections.append((current_section, current_advances))
            current_section = line
            current_advances = []
            i += 1
            continue
        
        if in_formable and re.match(r"^\w+.*=\s*\{", line):
            adv, next_i = parse_advance_block(lines, i)
            if adv:
                current_advances.append(adv)
            i = next_i
            continue
        
        i += 1
    
    # Don't forget last section
    if current_section and current_advances:
        sections.append((current_section, current_advances))
    
    return sections


def process_file(filepath):
    """Process a single advance file."""
    with open(filepath, "r") as f:
        content = f.read()
    
    lines = content.split("\n")
    
    # Find formable sections
    sections = find_formable_sections(lines)
    
    modified = False
    
    for section_name, advances in sections:
        # Check if this section has 3+3+2+2 pattern
        ages = [a["age"] for a in advances]
        age3_count = sum(1 for a in ages if a == "age_3_discovery")
        age4_count = sum(1 for a in ages if a == "age_4_reformation")
        age5_count = sum(1 for a in ages if a == "age_5_absolutism")
        age6_count = sum(1 for a in ages if a == "age_6_revolutions")
        
        if age3_count == 3 and age4_count == 3 and age5_count == 2 and age6_count == 2:
            print(f"  Processing: {section_name} ({len(advances)} advances, 3+3+2+2 pattern)")
            
            new_mapping = get_new_age_mapping(advances)
            
            for adv, (new_age, new_requires) in zip(advances, new_mapping):
                # Update age line
                for j in range(adv["start_line"], adv["end_line"] + 1):
                    if "age =" in lines[j]:
                        old_line = lines[j]
                        lines[j] = re.sub(r'age\s*=\s*\S+', f'age = {new_age}', lines[j])
                        break
                
                # Update requires line
                for j in range(adv["start_line"], adv["end_line"] + 1):
                    if "requires =" in lines[j]:
                        old_line = lines[j]
                        lines[j] = re.sub(r'requires\s*=\s*\S+', f'requires = {new_requires}', lines[j])
                        break
            
            modified = True
        else:
            counts = f"{age3_count}+{age4_count}+{age5_count}+{age6_count}"
            print(f"  Skipping: {section_name} ({len(advances)} advances, {counts} pattern - not 3+3+2+2)")
    
    if modified:
        with open(filepath, "w") as f:
            f.write("\n".join(lines))
        print(f"  ✓ Saved changes to {os.path.basename(filepath)}")
    else:
        print(f"  - No changes needed in {os.path.basename(filepath)}")


def main():
    for filename in FILES:
        filepath = os.path.join(BASE, filename)
        print(f"\n=== {filename} ===")
        process_file(filepath)


if __name__ == "__main__":
    main()
