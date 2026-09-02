#!/usr/bin/env python3
"""Import EU5 localization for advances from EU4 idea groups.

Targets (positional args) can be:
  * file paths   -> import advances from those files
  * country tags -> import advances whose potential references the tag
                    (an EU4 tag XYZ also matches the AB-prefixed EU5 tag ABXYZ)

For each targeted advance the script resolves the EU4 localization, checks
whether the advance already has localization, and verifies it:
  * MISSING   no existing entry          -> added
  * OK        existing entry matches     -> left as-is
  * MISMATCH  existing entry differs     -> reported

By default the script only prints a report plus the changed entries. Use
--out FILE to write the selected advances' localization to FILE: if FILE
already exists the new entries are appended, skipping keys that already
exist there (never duplicates); otherwise a fresh file is created.
"""

import argparse
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
ADVANCE_DIR = BASE / "in_game/common/advances"
LOC_DIRS = [
    BASE / "main_menu/localization/english",
    BASE / "in_game/localization/english",
]
EU4_LOC_DIR = BASE / ".tools/eu4/localisation"
EU4_IDEA_DIR = BASE / ".tools/eu4/ideas"

SET_ALIASES = {
    "lao": "laotian",
    "sulu": "sul",
    "bedouin": "arabian",
    "bedouin_arabian": "arabian",
}


def tag_variants(tag):
    """EU4 tags may map to AB-prefixed EU5 tags and vice versa."""
    tag = tag.upper()
    variants = {tag}
    if len(tag) == 3:
        variants.add("AB" + tag)
    elif tag.startswith("AB") and len(tag) == 5:
        variants.add(tag[2:])
    return variants

# ---------------------------------------------------------------------------
# 1. Parse all EU4 localizations and idea groups
# ---------------------------------------------------------------------------
eu4_name = {}
eu4_desc = {}
eu4_idea_keys = {}


def load_eu4(loc_dir, idea_dir):
    global eu4_name, eu4_desc, eu4_idea_keys
    eu4_name = {}
    eu4_desc = {}
    eu4_idea_keys = {}

    for f in sorted(Path(loc_dir).glob("*.yml")):
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

    # Idea slots in each EU4 idea group. Converted advance keys sometimes
    # retain or drop a group prefix, so group membership is a safe alias map.
    for f in sorted(Path(idea_dir).glob("*.txt")):
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
# 2. Extract advances with their idea-set context and referenced tags
# ---------------------------------------------------------------------------
def extract_advances(files):
    advances = []
    for fpath in sorted(files):
        with open(fpath, encoding="utf-8-sig") as fh:
            text = fh.read().replace("\r\n", "\n")
        current_set = None
        lines = text.split("\n")
        i = 0
        while i < len(lines):
            line = lines[i]

            m = re.match(r'^#\s*([a-zA-Z_][a-zA-Z_0-9]*)_ideas?\s*$', line)
            if m:
                current_set = m.group(1).lower()
                i += 1
                continue

            m = re.match(r'^([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*\{', line)
            if not m:
                i += 1
                continue

            key = m.group(1)
            depth = line.count("{") - line.count("}")
            block = [line]
            i += 1
            while i < len(lines) and depth > 0:
                block.append(lines[i])
                depth += lines[i].count("{") - lines[i].count("}")
                i += 1
            block_text = "\n".join(block)

            tags = {
                t.upper()
                for t in re.findall(
                    r'has_or_had_tag\s*=\s*([A-Za-z0-9]+)', block_text,
                )
            }

            tm = re.match(r'^abm_(.+?)_(?:ideas?_)?tradition[s]?_[12]$', key)
            if tm:
                current_set = tm.group(1).lower()

            # Only process advances whose key starts with abm_.
            if key.startswith("abm_"):
                advances.append({
                    "file": fpath.name,
                    "key": key,
                    "set": current_set,
                    "tags": tags,
                })
    return advances

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

def eu4_tradition_ambition_keys(adv_key):
    """Encode the EU4 idea-set convention for tradition/ambition advances.

    EU4 localises an idea set with three keys:
        CHI_ideas        -> "Great Ming Ideas"
        CHI_ideas_start  -> "Great Ming Traditions"   (traditions)
        CHI_ideas_bonus  -> "Great Ming Ambition"     (ambition)

    Mod advances follow the same convention:
        abm_${idea_set}_[ideas_]tradition_1/2 -> ${idea_set}_ideas_start
        abm_${idea_set}_[ideas_]ambition      -> ${idea_set}_ideas_bonus

    Returns (eu4_keys, suffix, fallback) or (None, "", None) when the key
    is not a tradition/ambition advance. `eu4_keys` are ordered candidate
    EU4 loc keys to look up; `suffix` (" I"/" II"/"") is appended to a
    matched tradition name.
    """
    m = re.match(r'^abm_(.+?)_(?:ideas?_)?tradition[s]?_([12])$', adv_key)
    if m:
        base = m.group(1)
        suffix = " I" if m.group(2) == "1" else " II"
        keys = [c + "_ideas_start" for c in set_candidates(base)]
        return keys, suffix, f"{key_to_display(base)} Traditions{suffix}"

    m = re.match(r'^abm_(.+?)_(?:ideas?_)?ambition$', adv_key)
    if m:
        base = m.group(1)
        keys = [c + "_ideas_bonus" for c in set_candidates(base)]
        return keys, "", f"{key_to_display(base)} Ambition"

    return None, "", None


def resolve(adv_key, set_tag):
    """Resolve an advance key to its display name and description."""
    # Tradition/ambition keys (EU4 idea-set convention)
    keys, suffix, fallback = eu4_tradition_ambition_keys(adv_key)
    if keys is not None:
        for eu4_key in keys:
            name, desc = try_lookup(eu4_key)
            if name:
                return name + suffix, desc, True
        return fallback, "", False

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
# 4. Existing localization
# ---------------------------------------------------------------------------
def load_existing_loc():
    """Load every existing localization entry from the mod's loc files."""
    loc = {}
    for directory in LOC_DIRS:
        for f in sorted(directory.glob("*.yml")):
            with open(f, encoding="utf-8-sig") as fh:
                for line in fh:
                    line = line.rstrip("\r\n")
                    m = re.match(
                        r'^\s*([a-zA-Z_][a-zA-Z_0-9]*):\d*\s+"(.*)"\s*$',
                        line,
                    )
                    if m:
                        loc[m.group(1)] = (m.group(2), f.name)
    return loc


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------
def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "targets", nargs="*",
        help="file paths or country tags to import "
             "(default: all abm_*.txt files)",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="only report, never write",
    )
    parser.add_argument(
        "--out", metavar="FILE",
        help="write/append the selected advances' localization to FILE "
             "(appends missing keys if FILE exists, otherwise creates it "
             "fresh) (default: print report and changed entries to stdout)",
    )
    parser.add_argument(
        "--eu4-loc", default=str(EU4_LOC_DIR),
        help=f"EU4 localization directory (default: {EU4_LOC_DIR})",
    )
    parser.add_argument(
        "--eu4-ideas", default=str(EU4_IDEA_DIR),
        help=f"EU4 ideas directory (default: {EU4_IDEA_DIR})",
    )
    parser.add_argument(
        "--skip-key", action="append", default=[],
        metavar="KEY",
        help="skip advances with this exact key (repeatable)",
    )
    parser.add_argument(
        "--skip-pattern", action="append", default=[],
        metavar="REGEX",
        help="skip advances whose key matches this regex (repeatable; "
             "e.g. ^REPLACE: or ^INJECT:)",
    )
    parser.add_argument(
        "--skip-tag", action="append", default=[],
        metavar="TAG",
        help="skip advances whose potential references this tag "
             "(repeatable; AB prefix auto-expanded)",
    )
    args = parser.parse_args(argv)

    load_eu4(args.eu4_loc, args.eu4_ideas)

    files = []
    tags = set()
    for target in args.targets:
        path = Path(target)
        if path.suffix == ".txt" and path.is_file():
            files.append(path.resolve())
        elif re.fullmatch(r"(?:AB)?[A-Z]{3}", target.upper()):
            tags.update(tag_variants(target))
        else:
            raise SystemExit(f"Unrecognized target: {target}")

    if not files:
        files = sorted(ADVANCE_DIR.glob("abm_*.txt"))

    all_advances = extract_advances(files)
    if tags:
        selected = [a for a in all_advances if a["tags"] & tags]
    else:
        selected = all_advances

    # Skip filters (exact keys, regex patterns, tags).
    skip_keys = set(args.skip_key)
    skip_patterns = []
    for pattern in args.skip_pattern:
        try:
            skip_patterns.append(re.compile(pattern))
        except re.error as exc:
            raise SystemExit(
                f"Invalid --skip-pattern regex {pattern!r}: {exc}"
            )
    skip_tags = set()
    for tag in args.skip_tag:
        skip_tags.update(tag_variants(tag))

    if skip_keys or skip_patterns or skip_tags:
        kept = []
        for adv in selected:
            if adv["key"] in skip_keys:
                continue
            if any(p.search(adv["key"]) for p in skip_patterns):
                continue
            if skip_tags and (adv["tags"] & skip_tags):
                continue
            kept.append(adv)
        selected = kept

    print(f"Targets: {len(files)} files, "
          f"tags={sorted(tags) if tags else 'all'}")
    print(f"Advances selected: {len(selected)}")

    existing = load_existing_loc()

    ok = 0
    missing = 0
    mismatched = 0
    fallback = 0
    changed = []
    all_entries = []

    for adv in selected:
        key = adv["key"]
        set_tag = adv["set"]
        name, desc, was_matched = resolve(key, set_tag)
        if not was_matched:
            fallback += 1
        name = (name or key_to_display(key)).replace('"', "'")
        desc = (desc or name).replace('"', "'")

        existing_name = existing.get(key)
        existing_desc = existing.get(key + "_desc")

        if existing_name is None:
            status = "MISSING"
            missing += 1
        elif (existing_name[0] == name
              and (existing_desc is None or existing_desc[0] == desc)):
            status = "OK"
            ok += 1
        else:
            status = "MISMATCH"
            mismatched += 1

        all_entries.append((key, name, desc))
        if status != "OK":
            changed.append((key, name, desc))
            print(f"  {status}: {key}")
            if status == "MISMATCH":
                print(f'      existing: "{existing_name[0]}"')
                print(f'      EU4:      "{name}"')

    print(f"\n{ok} OK, {missing} missing, {mismatched} mismatch, "
          f"{fallback} fallback")

    if args.check:
        return

    if args.out:
        outpath = Path(args.out)

        if not outpath.exists():
            # Fresh file: write the full localization file, as before.
            lines = ["l_english:"]
            for key, name, desc in all_entries:
                lines.append(f' {key}: "{name}"')
                lines.append(f' {key}_desc: "{desc}"')
                lines.append("")
            with open(outpath, "w", encoding="utf-8-sig", newline="\r\n") as f:
                f.write("\n".join(lines))
            print(f"Wrote {len(all_entries)} entries to {outpath}")
        else:
            # Existing file: append only keys that are not already present.
            existing_keys = set()
            with open(outpath, encoding="utf-8-sig") as fh:
                for line in fh:
                    m = re.match(r'^\s*([a-zA-Z_][a-zA-Z_0-9]*):', line)
                    if m:
                        existing_keys.add(m.group(1))

            missing = [
                (key, name, desc)
                for key, name, desc in all_entries
                if key not in existing_keys
            ]
            if not missing:
                print(f"No new entries to append to {outpath} "
                      f"(all {len(all_entries)} already present)")
            else:
                with open(outpath, "a", encoding="utf-8-sig", newline="\r\n") as f:
                    for key, name, desc in missing:
                        f.write(f' {key}: "{name}"\r\n')
                        f.write(f' {key}_desc: "{desc}"\r\n')
                        f.write("\r\n")
                print(f"Appended {len(missing)} new entries to {outpath} "
                      f"({len(existing_keys)} existing keys skipped)")
    elif changed:
        print("\n--- changed entries ---")
        for key, name, desc in changed:
            print(f' {key}: "{name}"')
            print(f' {key}_desc: "{desc}"')


if __name__ == "__main__":
    main()
