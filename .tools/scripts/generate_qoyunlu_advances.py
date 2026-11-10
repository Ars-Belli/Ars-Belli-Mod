#!/usr/bin/env python3
"""Import the EU4 Qoyunlu national idea sets (QAR, AKK) as EU5 advances.

Reads the idea sets from .tools/eu4/ideas/00_country_ideas.txt, converts each
EU4 modifier to its EU5 equivalent (CONVERSIONS below, every entry taken from
an existing advance in this mod or from vanilla), and writes
in_game/common/advances/abm_f3-t2_caucasus_qoyunlu.txt (UTF-8 BOM, CRLF).

Advance ids keep the EU4 idea-set keys (abm_qar_*, abm_akk_*) because EU4
localisation keys are `QAR_ideas_start`, `akk_white_sheep`, ... and
generate_advance_loc.py resolves names 1:1 from them. The EU4 tag AKK is AQQ
in EU5, so the advances' `has_or_had_tag` uses AQQ.

Localisation is not written here; run afterwards:
    python3 .tools/scripts/generate_advance_loc.py \
        in_game/common/advances/abm_f3-t2_caucasus_qoyunlu.txt \
        --out main_menu/localization/english/abm_advances_caucasus_l_english.yml
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
EU4_IDEAS = REPO_ROOT / ".tools/eu4/ideas/00_country_ideas.txt"
ADVANCE_DIR = REPO_ROOT / "in_game/common/advances"
OUTPUT = ADVANCE_DIR / "abm_f3-t2_caucasus_qoyunlu.txt"

DEFAULT_GAME_ROOT = Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game"
)

# Age slots for the ten advances of an EU4 idea set: two traditions, seven
# ideas, one ambition. Same ladder as the Caucasus (CIR) and Middle East sets.
AGE_SLOTS = (
    "age_1_traditions",
    "age_1_traditions",
    "age_2_renaissance",
    "age_2_renaissance",
    "age_3_discovery",
    "age_3_discovery",
    "age_4_reformation",
    "age_4_reformation",
    "age_5_absolutism",
    "age_6_revolutions",
)


@dataclass(frozen=True)
class IdeaSetSpec:
    eu4_set: str
    eu5_tag: str
    title: str
    requires: tuple[str, ...]
    icons: tuple[str, ...]


SETS = (
    IdeaSetSpec(
        eu4_set="QAR_ideas",
        eu5_tag="QAR",
        title="Qara Qoyunlu (QAR)",
        # military -> admin -> military -> admin, matching the idea themes
        requires=(
            "feudalism_advance",
            "codified_laws",
            "land_morale_recovery_renaissance_advance",
            "renaissance_court",
            "print_culture",
            "unlock_early_arquebusiers_advance",
            "confessionalism_advance",
            "trade_companies_advance",
            "sanitation_advance",
            "unlock_cuirassiers_advance",
        ),
        icons=(
            "finest_of_horses",
            "skilled_captains",
            "slave_soldiers",
            "government_size",
            "religious_toleration",
            "expanded_supply_trains",
            "diplomatic_influence",
            "cosmopolitan_court",
            "river_trade",
            "artillery_institution_advance",
        ),
    ),
    IdeaSetSpec(
        eu4_set="AKK_ideas",
        eu5_tag="AQQ",
        title="Aq Qoyunlu (AQQ, EU4 tag AKK)",
        requires=(
            "feudalism_advance",
            "appointed_chain_of_command",
            "land_morale_recovery_renaissance_advance",
            "renaissance_court",
            "print_culture",
            "linked_armies_advance",
            "formalized_relations",
            "confessionalism_advance",
            "global_trade_advance",
            "unlock_cuirassiers_advance",
        ),
        icons=(
            "glorious_arms",
            "regimental_system",
            "offensive_army",
            "laws",
            "smooth_administration",
            "feudalism_advance",
            "foreign_politics",
            "religious_melting_pot",
            "trade_caravans",
            "defensive_mentality",
        ),
    ),
)


@dataclass(frozen=True)
class Conversion:
    """EU4 modifier -> EU5 modifier lines.

    templates: EU5 lines; "{v}" is the EU4 value * factor (never the literal
               EU4 number when the mechanics differ in scale).
    factor:    multiplier applied to the EU4 value before formatting.
    absolute:  use |value| (cost reductions become speed/efficiency bonuses).
    """

    templates: tuple[str, ...]
    factor: float | None = 1.0
    absolute: bool = False


# Provenance for each row (project precedent first, then the vanilla/wiki
# equivalent). Values are scaled where EU5 measures the same thing on a
# different scale; the raw EU4 line is preserved as a comment in the output.
CONVERSIONS: dict[str, Conversion] = {
    # EU4 leader pips have no EU5 counterpart; the mod maps them onto the
    # phase-appropriate unit power (SRV used heavy cav/inf for shock,
    # Ruthenia light inf/cav for fire).
    "leader_land_shock": Conversion(
        ("army_heavy_cavalry_power = {v}", "army_heavy_infantry_power = {v}"),
        factor=0.10,
    ),
    "leader_land_fire": Conversion(
        ("army_light_infantry_power = {v}", "army_light_cavalry_power = {v}"),
        factor=0.10,
    ),
    # CPA "Caucasus Hit and Run" precedent: movement + engagement speed.
    "leader_land_manuever": Conversion(
        ("combat_speed_modifier = {v}", "army_movement_speed = {v}"),
        factor=0.10,
    ),
    # SRV "Tribesmen of the Caucasus" precedent (light cavalry only).
    "cavalry_power": Conversion(("army_light_cavalry_power = {v}",), factor=1.0),
    "cavalry_cost": Conversion(
        (
            "army_light_cavalry_build_cost_modifier = {v}",
            "army_heavy_cavalry_build_cost_modifier = {v}",
        ),
        factor=1.0,
    ),
    "global_manpower_modifier": Conversion(
        ("global_manpower_modifier = {v}",), factor=1.0
    ),
    "land_morale": Conversion(("land_morale_modifier = {v}",), factor=1.0),
    # EU4 maintenance modifier is a cost; EU5 exposes maintenance efficiency.
    "land_maintenance_modifier": Conversion(
        ("army_maintenance_efficiency = {v}",), factor=1.0, absolute=True
    ),
    "global_tax_modifier": Conversion(("tax_income_efficiency = {v}",), factor=1.0),
    # CIR tradition precedent: stability cost modifier -> cost efficiency.
    "stability_cost_modifier": Conversion(
        ("stability_cost_efficiency = {v}",), factor=1.0, absolute=True
    ),
    # Cheaper coring -> faster integration.
    "core_creation": Conversion(
        ("global_integration_speed_modifier = {v}",), factor=1.0, absolute=True
    ),
    # Indonesia "Rise of Aceh" precedent: cheaper provinces -> war score
    # efficiency.
    "province_warscore_cost": Conversion(
        ("global_war_score_efficiency = {v}",), factor=1.0, absolute=True
    ),
    # EU4 +10% LD reduction -> EU5 +10 loyalty.
    "reduced_liberty_desire": Conversion(
        ("loyalty_to_overlord = {v}",), factor=1.0
    ),
    # EU4 -1 unrest -> EU5 rebel-threshold shift (Middle East map).
    "global_unrest": Conversion(
        ("pop_join_rebel_threshold = {v}",), factor=0.05
    ),
    # EU4 +1 diplomat -> EU5 +0.10 monthly diplomats (CIR precedent).
    "diplomats": Conversion(("monthly_diplomats = {v}",), factor=0.10),
    # SRV ambition precedent.
    "global_trade_goods_size_modifier": Conversion(
        ("global_max_rgo_size_modifier = {v}",), factor=1.0
    ),
    # EU4 government power = monarch points, gained from whichever resource
    # the government type uses (vanilla uses_government_power); the Caucasus
    # "Highland Khans" advance bundles those monthly gains at 0.10 each.
    "yearly_government_power": Conversion(
        (
            "monthly_legitimacy = {v}",
            "monthly_republican_tradition = {v}",
            "monthly_devotion = {v}",
            "monthly_horde_unity = {v}",
            "monthly_tribal_cohesion = {v}",
        ),
        factor=0.10,
    ),
    "tolerance_heretic": Conversion(("tolerance_heretic = 1",), factor=None),
}

# EU4 slots whose block is deliberately empty and cannot be converted as-is.
# QAR's in_honor_of_ali carries only the comment "#Same as Ajam"; Ajam's copy
# of the same idea is tolerance_heretic = 3.
IDEA_OVERRIDES: dict[str, tuple[tuple[str, str], ...]] = {
    "in_honor_of_ali": (("tolerance_heretic", "3"),),
}

AUTHORITY_MODIFIERS = {
    "devotion",
    "horde_unity",
    "legitimacy",
    "meritocracy",
    "republican_tradition",
    "yearly_government_power",
}

AGE_ORDER = {
    "age_1_traditions": 1,
    "age_2_renaissance": 2,
    "age_3_discovery": 3,
    "age_4_reformation": 4,
    "age_5_absolutism": 5,
    "age_6_revolutions": 6,
}


# ---------------------------------------------------------------------------
# EU4 parsing
# ---------------------------------------------------------------------------
def strip_comments(text: str) -> str:
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


def find_blocks(text: str, depth_wanted: int) -> list[tuple[str, str]]:
    """Return (key, block_text) for every block at the requested depth."""
    pattern = re.compile(r"(?m)^\s*([A-Za-z0-9_-]+)\s*=\s*\{")
    blocks = []
    depth = 0
    cursor = 0
    for match in pattern.finditer(text):
        depth += text[cursor : match.start()].count("{")
        depth -= text[cursor : match.start()].count("}")
        cursor = match.start()
        if depth != depth_wanted:
            continue
        block_depth = 0
        for index in range(match.end() - 1, len(text)):
            if text[index] == "{":
                block_depth += 1
            elif text[index] == "}":
                block_depth -= 1
                if block_depth == 0:
                    blocks.append((match.group(1), text[match.start() : index + 1]))
                    break
    return blocks


def parse_assignments(block: str) -> tuple[tuple[str, str], ...]:
    assignments = []
    depth = 0
    for line in block.splitlines():
        code = line.strip()
        if depth == 1:
            match = re.match(r"^([A-Za-z0-9_-]+)\s*=\s*([^{}]+?)\s*$", code)
            if match:
                assignments.append(match.groups())
        depth += code.count("{") - code.count("}")
    return tuple(assignments)


@dataclass(frozen=True)
class IdeaGroup:
    key: str
    start: tuple[tuple[str, str], ...]
    bonus: tuple[tuple[str, str], ...]
    ideas: tuple[tuple[str, tuple[tuple[str, str], ...]], ...]


def read_idea_group(path: Path, set_key: str) -> IdeaGroup:
    text = strip_comments(path.read_text(encoding="utf-8-sig", errors="replace"))
    for key, block in find_blocks(text, 0):
        if key != set_key:
            continue
        children = find_blocks(block, 1)
        slots = {child_key: child for child_key, child in children}
        if "start" not in slots or "bonus" not in slots:
            raise SystemExit(f"{set_key}: missing start/bonus block in {path}")
        ideas = tuple(
            (
                child_key,
                parse_assignments(child)
                or IDEA_OVERRIDES.get(child_key, ()),
            )
            for child_key, child in children
            if child_key not in {"start", "bonus", "trigger"}
        )
        return IdeaGroup(
            set_key,
            parse_assignments(slots["start"]),
            parse_assignments(slots["bonus"]),
            ideas,
        )
    raise SystemExit(f"{set_key} not found in {path}")


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------
def format_value(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}"


def convert_assignments(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[list[str], list[str]]:
    comments = [f"# {modifier} = {value}" for modifier, value in assignments]
    converted: list[str] = []
    for modifier, raw in assignments:
        if modifier not in CONVERSIONS:
            raise SystemExit(f"no EU5 conversion for EU4 modifier {modifier!r}")
        conversion = CONVERSIONS[modifier]
        if conversion.factor is None:
            lines = conversion.templates
        else:
            value = float(raw)
            if conversion.absolute:
                value = abs(value)
            formatted = format_value(value * conversion.factor)
            lines = tuple(t.replace("{v}", formatted) for t in conversion.templates)
        for line in lines:
            if line not in converted:
                converted.append(line)
    if not converted:
        raise SystemExit(f"idea block converts to nothing: {assignments}")
    return comments, converted


def split_traditions(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[tuple[tuple[str, str], ...], tuple[tuple[str, str], ...]]:
    """Split EU4 traditions into two advances, keeping authority modifiers
    together in the first one (same rule as the other regional importers)."""
    authority = tuple(a for a in assignments if a[0] in AUTHORITY_MODIFIERS)
    others = tuple(a for a in assignments if a[0] not in AUTHORITY_MODIFIERS)
    units = ((authority,) if authority else ()) + tuple((item,) for item in others)
    if len(units) != 2:
        raise SystemExit(f"expected two tradition effects, found {len(units)}")
    return units[0], units[1]


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------
def advance_index(game_root: Path) -> dict[str, str]:
    """id -> age for every advance in vanilla and in the mod."""
    ages: dict[str, str] = {}
    files = sorted((game_root / "in_game/common/advances").glob("*.txt"))
    files += sorted(ADVANCE_DIR.glob("*.txt"))
    for path in files:
        lines = path.read_text(encoding="utf-8-sig", errors="replace").split("\n")
        index = 0
        while index < len(lines):
            match = re.match(
                r"^\s*(?:REPLACE:|INJECT:)?([A-Za-z0-9_]+)\s*=\s*\{", lines[index]
            )
            if not match:
                index += 1
                continue
            key = match.group(1)
            depth = lines[index].count("{") - lines[index].count("}")
            block = [lines[index]]
            while depth > 0 and index + 1 < len(lines):
                index += 1
                block.append(lines[index])
                depth += lines[index].count("{") - lines[index].count("}")
            age = re.search(r"^\t?age = (\S+)", "\n".join(block), re.M)
            if age:
                ages.setdefault(key, age.group(1))
            index += 1
    return ages


def icon_pool(game_root: Path) -> set[str]:
    icons: set[str] = set()
    for path in sorted((game_root / "in_game/common/advances").glob("*.txt")):
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            match = re.match(r"^\s*icon = (\S+)", line)
            if match:
                icons.add(match.group(1).strip())
    return icons


def existing_advance_keys() -> set[str]:
    keys: set[str] = set()
    for path in sorted(ADVANCE_DIR.glob("abm_*.txt")):
        if path == OUTPUT:
            continue
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            match = re.match(
                r"^(?:REPLACE:|INJECT:)?([A-Za-z0-9_]+)\s*=\s*\{", line
            )
            if match:
                keys.add(match.group(1))
    return keys


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def render_advance(
    key: str,
    index: int,
    spec: IdeaSetSpec,
    assignments: tuple[tuple[str, str], ...],
) -> str:
    comments, converted = convert_assignments(assignments)
    lines = [
        f"{key} = {{",
        f"\tage = {AGE_SLOTS[index]}",
        f"\ticon = {spec.icons[index]}",
        "\tpotential = {",
        f"\t\thas_or_had_tag = {spec.eu5_tag}",
        "\t}",
        "",
        f"\trequires = {spec.requires[index]}",
        "",
        *(f"\t{line}" for line in comments),
        *(f"\t{line}" for line in converted),
        "}",
    ]
    return "\n".join(lines)


def render(spec: IdeaSetSpec, group: IdeaGroup) -> tuple[str, list[str]]:
    if len(group.ideas) != 7:
        raise SystemExit(
            f"{spec.eu4_set} has {len(group.ideas)} idea slots, expected 7"
        )
    base = spec.eu4_set.removesuffix("_ideas").lower()
    slots = [idea_key.lower() for idea_key, _ in group.ideas]
    traditions = split_traditions(group.start)
    entries = [
        (f"abm_{base}_ideas_tradition_1", traditions[0]),
        (f"abm_{base}_ideas_tradition_2", traditions[1]),
    ]
    for idea_key, assignments in group.ideas:
        # EU4 keys usually carry the tag prefix (qar_black_sheep); shared keys
        # such as in_honor_of_ali get the set tag added to stay unique.
        key = idea_key.lower()
        if not key.startswith(f"{base}_"):
            key = f"{base}_{key}"
        entries.append((f"abm_{key}", assignments))
    entries.append((f"abm_{base}_ideas_ambition", group.bonus))
    if len(entries) != len(AGE_SLOTS):
        raise SystemExit(f"{spec.eu4_set}: {len(entries)} advances, expected 10")
    if slots == []:
        raise SystemExit("empty idea set")

    parts = [
        f"# {spec.title}",
        f"# Potential tag: {spec.eu5_tag} "
        f"(EU4 idea set {spec.eu4_set})",
    ]
    keys = []
    for index, (key, assignments) in enumerate(entries):
        keys.append(key)
        parts.extend(["", render_advance(key, index, spec, assignments)])
    return "\n".join(parts) + "\n", keys


def write_bom_crlf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("\ufeff" + text.replace("\n", "\r\n")).encode("utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--eu4-ideas", type=Path, default=EU4_IDEAS,
        help=f"EU4 idea file (default: {EU4_IDEAS})",
    )
    parser.add_argument(
        "--game-root", type=Path, default=DEFAULT_GAME_ROOT,
        help=f"EU5 game root used for validation (default: {DEFAULT_GAME_ROOT})",
    )
    parser.add_argument(
        "--check", action="store_true",
        help="validate sources and conversions without writing",
    )
    args = parser.parse_args(argv)

    ages = advance_index(args.game_root)
    icons = icon_pool(args.game_root)
    existing = existing_advance_keys()

    chunks = [
        "# Generated by .tools/scripts/generate_qoyunlu_advances.py",
        "# Source: .tools/eu4/ideas/00_country_ideas.txt (QAR_ideas, AKK_ideas)",
        "# Localisation: generate_advance_loc.py "
        "-> abm_advances_caucasus_l_english.yml",
        "",
    ]
    generated: list[str] = []
    for spec in SETS:
        group = read_idea_group(args.eu4_ideas, spec.eu4_set)
        if len(spec.requires) != len(AGE_SLOTS) or len(spec.icons) != len(AGE_SLOTS):
            raise SystemExit(f"{spec.eu4_set}: requires/icons must have 10 entries")
        for required, age in zip(spec.requires, AGE_SLOTS):
            if required not in ages:
                raise SystemExit(f"{spec.eu4_set}: unknown advance {required!r}")
            if AGE_ORDER[ages[required]] > AGE_ORDER[age]:
                raise SystemExit(
                    f"{spec.eu4_set}: {required!r} is {ages[required]} "
                    f"but the advance is {age}"
                )
        for icon in spec.icons:
            if icon not in icons:
                raise SystemExit(f"{spec.eu4_set}: unknown icon {icon!r}")
        chunk, keys = render(spec, group)
        duplicates = sorted(
            key for key in keys if key in existing or generated.count(key)
        )
        if duplicates:
            raise SystemExit(f"{spec.eu4_set}: duplicate advance ids {duplicates}")
        if len(set(spec.icons)) != len(spec.icons):
            raise SystemExit(f"{spec.eu4_set}: repeated icon inside the set")
        generated.extend(keys)
        chunks.extend([chunk])

    text = "\n".join(chunks)
    print(f"{len(generated)} advances from {len(SETS)} EU4 idea sets")
    for key in generated:
        print(f"  {key}")
    if args.check:
        print("All sources, conversions, prerequisites and icons are valid")
        return 0
    write_bom_crlf(OUTPUT, text)
    print(f"Wrote {OUTPUT.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
