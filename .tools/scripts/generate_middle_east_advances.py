#!/usr/bin/env python3
"""Generate Middle East EU5 advances from mapped EU4 national ideas."""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import urllib.request
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1_43aH1mfGr6nag1VKuwexsLMvptkVPcj4OXo2QCfmnY/"
    "gviz/tq?tqx=out:csv&sheet=EU4%3EEU5"
)
SECTIONS = ("Central Asia", "Persia", "Arabia")
IDEA_SET_ALIASES = {"Hadhrami Ideas": "HDR_ideas"}
OUTPUT = Path("in_game/common/advances/abm_f5-t3_middle_east.txt")
LOC_OUTPUT = Path(
    "main_menu/localization/english/abm_advances_middle_east_l_english.yml"
)

AGES = (
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
REQUIRES = (
    "feudalism_advance",
    "feudalism_advance",
    "renaissance_thought",
    "legalism_advance",
    "military_traditions",
    "paved_road_advance",
    "supply_depot_advance_age_4_reformation",
    "global_trade_advance",
    "absolutist_court",
    "imperial_ambitions",
)

# EU4 modifier -> one or more EU5 modifier templates. {value} preserves the
# source magnitude where the mechanics are directly equivalent.
CONVERSIONS: dict[str, tuple[str, ...]] = {
    "adm_tech_cost_modifier": ("research_speed_modifier = 0.05",),
    "ae_impact": ("antagonism_received_modifier = -0.10",),
    "army_tradition": ("monthly_army_tradition = 0.05",),
    "army_tradition_decay": ("army_tradition_decay = -0.001",),
    "artillery_cost": ("army_artillery_build_cost_modifier = -0.10",),
    "build_cost": ("global_build_buildings_efficiency = 0.10",),
    "caravan_power": ("trade_land_efficiency = medium_trade_land_efficiency_bonus",),
    "cav_to_inf_ratio": ("combined_arms_max_threshold = 0.10",),
    "cavalry_cost": (
        "army_light_cavalry_build_cost_modifier = -0.10",
        "army_heavy_cavalry_build_cost_modifier = -0.10",
    ),
    "cavalry_flanking": ("army_light_cavalry_power = 0.10",),
    "cavalry_power": ("army_heavy_cavalry_power = 0.10",),
    "colonists": ("can_colonize = yes",),
    "core_creation": ("global_integration_speed_modifier = 0.15",),
    "defensiveness": ("global_defensive = 0.15",),
    "development_cost": ("global_monthly_prosperity = 0.001",),
    "devotion": ("monthly_devotion = 0.10",),
    "dhimmi_loyalty_modifier": (
        "clergy_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    "dip_tech_cost_modifier": ("research_speed_modifier = 0.05",),
    "diplomatic_reputation": (
        "diplomatic_reputation = diplomatic_reputation_mild_bonus",
    ),
    "diplomatic_upkeep": ("diplomatic_upkeep_efficiency = 0.10",),
    "diplomats": ("monthly_diplomats = 0.10",),
    "discipline": ("discipline = 0.05",),
    "embracement_cost": ("absorb_institutions_cost_modifier = -0.10",),
    "envoy_travel_time": ("diplomatic_range_modifier = 0.10",),
    "fire_damage": ("army_fire_damage = 0.10",),
    "fort_maintenance_modifier": ("fort_maintenance_efficiency = 0.10",),
    "general_cost": ("train_general_cost_modifier = -0.10",),
    "global_autonomy": ("global_monthly_control = 0.001",),
    "global_foreign_trade_power": ("global_merchant_power = 0.10",),
    "global_heretic_missionary_strength": (
        "global_heretic_pop_conversion_speed_modifier = 0.20",
    ),
    "global_institution_spread": ("global_institution_growth_modifier = 0.10",),
    "global_manpower_modifier": ("global_manpower_modifier = 0.10",),
    "global_missionary_strength": (
        "global_pop_conversion_speed_modifier = 0.20",
    ),
    "global_own_trade_power": ("global_trade_center_power = 0.10",),
    "global_prov_trade_power_modifier": ("global_merchant_power = 0.10",),
    "global_regiment_cost": ("army_maintenance_efficiency = 0.10",),
    "global_tax_modifier": ("tax_income_efficiency = 0.10",),
    "global_trade_goods_size_modifier": ("global_max_rgo_size_modifier = 0.10",),
    "global_trade_power": ("global_merchant_power = 0.10",),
    "global_unrest": ("pop_join_rebel_threshold = -0.05",),
    "horde_unity": ("monthly_horde_unity = 0.10",),
    "hostile_attrition": ("global_hostile_attrition = 1",),
    "idea_cost": ("research_speed_modifier = 0.05",),
    "improve_relation_modifier": ("improve_relation_impact = 0.20",),
    "infantry_cost": (
        "army_light_infantry_build_cost_modifier = -0.10",
        "army_heavy_infantry_build_cost_modifier = -0.10",
    ),
    "infantry_power": ("army_heavy_infantry_power = 0.10",),
    "land_attrition": ("land_unit_attrition = -0.10",),
    "land_forcelimit_modifier": ("global_levy_size_modifier = 0.20",),
    "land_maintenance_modifier": ("army_maintenance_efficiency = 0.10",),
    "land_morale": ("land_morale_modifier = 0.10",),
    "leader_land_manuever": ("army_movement_speed = 0.10",),
    "leader_land_shock": ("army_initiative = 0.10",),
    "leader_naval_manuever": ("navy_movement_speed = 0.10",),
    "legitimacy": ("monthly_legitimacy = 0.10",),
    "loot_amount": ("amount_looted_modifier = 0.25",),
    "manpower_recovery_speed": ("army_reinforce_efficiency = 0.10",),
    "merc_maintenance_modifier": ("mercenary_maintenance_efficiency = 0.15",),
    "merchants": ("global_merchant_power = 0.20",),
    "meritocracy": ("monthly_tribal_cohesion = 0.10",),
    "missionaries": ("number_of_allowed_religious_figures = 1",),
    "monthly_piety": ("monthly_purity = 0.10",),
    "monthly_piety_accelerator": ("monthly_purity = 0.05",),
    "movement_speed": ("army_movement_speed = 0.10",),
    "naval_forcelimit_modifier": ("expected_navy_size_modifier = 0.25",),
    "naval_maintenance_modifier": ("navy_maintenance_efficiency = 0.10",),
    "navy_tradition": ("monthly_navy_tradition = 0.10",),
    "navy_tradition_decay": ("navy_tradition_decay = -0.01",),
    "num_accepted_cultures": ("cultures_capacity = 1",),
    "prestige": ("monthly_prestige = 0.10",),
    "privateer_efficiency": ("privateer_durability = 0.10",),
    "production_efficiency": ("global_production_efficiency = 0.10",),
    "reduced_liberty_desire": ("loyalty_to_overlord = 10",),
    "reinforce_speed": ("regiment_reinforcement_speed = 0.10",),
    "religious_unity": (
        "clergy_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    "republican_tradition": ("monthly_republican_tradition = 0.10",),
    "sailors_recovery_speed": ("global_sailors_modifier = 0.10",),
    "same_culture_advisor_cost": ("hire_advisor_cost_modifier = -0.10",),
    "ship_durability": ("naval_damage_taken = -0.05",),
    "shock_damage_received": ("army_shock_damage_taken = -0.10",),
    "siege_ability": ("siege_ability = 0.10",),
    "spy_offence": ("spy_network_construction = 0.20",),
    "stability_cost_modifier": ("stability_cost_efficiency = 0.10",),
    "technology_cost": ("research_speed_modifier = 0.05",),
    "tolerance_heathen": ("tolerance_heathen = 2",),
    "tolerance_heretic": ("tolerance_heretic = 1",),
    "tolerance_of_heathens_capacity": ("tolerance_heathen = 1",),
    "tolerance_own": ("tolerance_own = 1",),
    "trade_efficiency": ("trade_income = 0.10",),
    "trade_steering": ("global_trade_center_power = 0.10",),
    "war_exhaustion_cost": ("monthly_war_exhaustion = -0.05",),
    "warscore_cost_vs_other_religion": (
        "war_score_vs_other_religion_efficiency = 0.10",
    ),
    "years_of_nationalism": ("pop_join_rebel_threshold = -0.05",),
    "yearly_corruption": ("country_cabinet_efficiency = 0.10",),
}

IDEA_ASSIGNMENT_OVERRIDES = {
    "chagatai_literature": (
        ("legitimacy", "1"),
        ("devotion", "1"),
        ("republican_tradition", "0.3"),
        ("meritocracy", "1"),
        ("horde_unity", "1"),
    ),
    "reform_the_diwan": (("yearly_corruption", "-0.1"),),
    "coffea_arabica": (("global_trade_power", "0.1"),),
}

ICON_RULES = (
    (("army_", "discipline", "siege_", "regiment_", "global_manpower"), "glorious_arms"),
    (("navy_", "naval_", "sailors", "privateer"), "royal_navy"),
    (("trade_", "global_trade", "global_merchant", "export_", "import_"), "merchants_and_trade"),
    (("tolerance_", "clergy_", "global_pop_conversion", "religious_"), "church_councils"),
    (("research_", "institution", "absorb_"), "library_advance"),
    (("tax_", "production_", "global_build", "global_max_rgo"), "abacus_advance"),
    (("monthly_", "stability_", "global_monthly_control"), "smooth_administration"),
    (("can_colonize",), "colonies"),
)
DEFAULT_ICONS = (
    "administrative_leadership",
    "diplomatic_training",
    "court_accounting",
    "defensive_mentality",
    "cultural_acceptance_advance",
    "road_building",
)

AUTHORITY_MODIFIERS = {
    "devotion",
    "horde_unity",
    "legitimacy",
    "meritocracy",
    "republican_tradition",
}


@dataclass(frozen=True)
class MappingRow:
    section: str
    country_name: str
    eu5_tag: str
    idea_name: str


@dataclass(frozen=True)
class SourceBlock:
    key: str
    assignments: tuple[tuple[str, str], ...]


@dataclass(frozen=True)
class IdeaGroup:
    key: str
    start: tuple[tuple[str, str], ...]
    bonus: tuple[tuple[str, str], ...]
    ideas: tuple[SourceBlock, ...]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--eu4-root",
        type=Path,
        default=Path(
            "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis IV"
        ),
    )
    parser.add_argument("--sheet-url", default=SHEET_URL)
    parser.add_argument(
        "--sheet-csv",
        type=Path,
        help="Use a downloaded EU4>EU5 CSV instead of fetching Google Sheets.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate all source data and conversions without writing files.",
    )
    return parser.parse_args()


def read_sheet(args: argparse.Namespace) -> list[MappingRow]:
    if args.sheet_csv:
        text = args.sheet_csv.read_text(encoding="utf-8-sig")
    else:
        with urllib.request.urlopen(args.sheet_url) as response:
            text = response.read().decode("utf-8-sig")

    current_section = ""
    mappings = []
    for row in csv.DictReader(io.StringIO(text)):
        name = row["NAME"].strip()
        tag = row["EU5 TAG"].strip()
        idea_name = row["EU4 IDEA SET"].strip()
        if name and not tag and not idea_name:
            current_section = name
        elif current_section in SECTIONS and tag and idea_name:
            mappings.append(MappingRow(current_section, name, tag, idea_name))
    return mappings


def read_localization(directory: Path) -> tuple[dict[str, str], dict[str, str]]:
    by_key = {}
    key_by_value = {}
    pattern = re.compile(r'^\s*([A-Za-z0-9_-]+):\d*\s+"(.*)"\s*$')
    for path in sorted(directory.glob("*_l_english.yml")):
        for line in path.read_text(
            encoding="utf-8-sig", errors="replace"
        ).splitlines():
            match = pattern.match(line)
            if not match:
                continue
            key, value = match.groups()
            by_key[key] = value
            key_by_value.setdefault(value, key)
    return by_key, key_by_value


def strip_comments(text: str) -> str:
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


def find_blocks(text: str, depth_wanted: int) -> list[tuple[str, str]]:
    pattern = re.compile(r"(?m)^\s*([A-Za-z0-9_-]+)\s*=\s*\{")
    blocks = []
    depth = 0
    cursor = 0
    for match in pattern.finditer(text):
        depth += text[cursor : match.start()].count("{")
        depth -= text[cursor : match.start()].count("}")
        cursor = match.start()
        if not depth == depth_wanted:
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


def read_idea_groups(directory: Path) -> dict[str, IdeaGroup]:
    groups = {}
    for path in sorted(directory.glob("*.txt")):
        text = strip_comments(path.read_text(encoding="utf-8-sig", errors="replace"))
        for key, group_block in find_blocks(text, 0):
            children = {
                child_key: child_block
                for child_key, child_block in find_blocks(group_block, 1)
            }
            if "start" not in children or "bonus" not in children:
                continue
            ideas = tuple(
                SourceBlock(
                    child_key,
                    parse_assignments(child_block)
                    or IDEA_ASSIGNMENT_OVERRIDES.get(child_key, ()),
                )
                for child_key, child_block in find_blocks(group_block, 1)
                if child_key not in {"start", "bonus", "trigger"}
            )
            groups[key] = IdeaGroup(
                key,
                parse_assignments(children["start"]),
                parse_assignments(children["bonus"]),
                ideas,
            )
    return groups


def split_traditions(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[tuple[tuple[str, str], ...], tuple[tuple[str, str], ...]]:
    authority = tuple(item for item in assignments if item[0] in AUTHORITY_MODIFIERS)
    others = tuple(item for item in assignments if item[0] not in AUTHORITY_MODIFIERS)
    units = ((authority,) if authority else ()) + tuple((item,) for item in others)
    if not len(units) == 2:
        raise ValueError(f"expected two tradition effects, found {len(units)}: {assignments}")
    return units[0], units[1]


def resolve_groups(
    mappings: list[MappingRow],
    localization_keys: dict[str, str],
    groups: dict[str, IdeaGroup],
) -> list[tuple[str, str, tuple[MappingRow, ...], IdeaGroup]]:
    grouped: dict[tuple[str, str], list[MappingRow]] = defaultdict(list)
    for row in mappings:
        grouped[(row.section, row.idea_name)].append(row)

    resolved = []
    for (section, idea_name), rows in grouped.items():
        key = IDEA_SET_ALIASES.get(idea_name, localization_keys.get(idea_name, ""))
        if key not in groups:
            raise ValueError(f"could not resolve {idea_name!r} to an EU4 idea group")
        group = groups[key]
        if not len(group.ideas) == 7:
            raise ValueError(f"{key} has {len(group.ideas)} idea slots, expected 7")
        split_traditions(group.start)
        resolved.append((section, idea_name, tuple(rows), group))
    return resolved


def conversion_gaps(
    resolved: list[tuple[str, str, tuple[MappingRow, ...], IdeaGroup]],
) -> dict[str, set[str]]:
    gaps: dict[str, set[str]] = defaultdict(set)
    for _, _, _, group in resolved:
        assignments = group.start + group.bonus
        for idea in group.ideas:
            assignments += idea.assignments
        for modifier, _ in assignments:
            if modifier not in CONVERSIONS:
                gaps[modifier].add(group.key)
    return gaps


def sanitize_key(key: str) -> str:
    return re.sub(r"[^a-z0-9_]+", "_", key.lower()).strip("_")


def convert_assignments(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[list[str], list[str]]:
    comments = [f"# {modifier} = {value}" for modifier, value in assignments]
    converted = []
    for modifier, value in assignments:
        for template in CONVERSIONS[modifier]:
            line = template.format(value=value)
            if line not in converted:
                converted.append(line)
    return comments, converted


def choose_icon(converted: list[str], index: int) -> str:
    modifier = converted[0].split("=", 1)[0].strip()
    for prefixes, icon in ICON_RULES:
        if modifier.startswith(prefixes):
            return icon
    return DEFAULT_ICONS[index % len(DEFAULT_ICONS)]


def potential_lines(rows: tuple[MappingRow, ...]) -> list[str]:
    tags = [row.eu5_tag for row in rows]
    if len(tags) == 1:
        return [f"\t\thas_or_had_tag = {tags[0]}"]
    return ["\t\tOR = {"] + [
        f"\t\t\thas_or_had_tag = {tag}" for tag in tags
    ] + ["\t\t}"]


def render_advance(
    key: str,
    index: int,
    rows: tuple[MappingRow, ...],
    assignments: tuple[tuple[str, str], ...],
) -> str:
    comments, converted = convert_assignments(assignments)
    lines = [
        f"{key} = {{",
        f"\tage = {AGES[index]}",
        f"\ticon = {choose_icon(converted, index)}",
        "\tpotential = {",
        *potential_lines(rows),
        "\t}",
        "",
        f"\trequires = {REQUIRES[index]}",
        "",
        *(f"\t{line}" for line in comments),
        *(f"\t{line}" for line in converted),
        "}",
    ]
    return "\n".join(lines)


def localization_value(localization: dict[str, str], key: str) -> str:
    return localization.get(key, key.replace("_", " ").replace("-", " ").title())


def render_outputs(
    resolved: list[tuple[str, str, tuple[MappingRow, ...], IdeaGroup]],
    localization: dict[str, str],
) -> tuple[str, str, int]:
    advance_parts = [
        "# Generated by .tools/generate_middle_east_advances.py",
        "# Source: EU4>EU5 Google Sheet + installed EU4 ideas and localization.",
    ]
    loc_lines = ["l_english:"]
    generated_keys = set()
    current_section = ""

    for section, idea_name, rows, group in resolved:
        if section != current_section:
            advance_parts.extend(["", f"# {section.upper()}"])
            current_section = section
        tags = " | ".join(row.eu5_tag for row in rows)
        countries = ", ".join(row.country_name for row in rows)
        advance_parts.extend(["", f"# {idea_name}", f"# {countries} ({tags})"])

        base = sanitize_key(group.key.removesuffix("_ideas"))
        traditions = split_traditions(group.start)
        entries = [
            (f"abm_{base}_ideas_tradition_1", traditions[0], group.key + "_start", " I"),
            (f"abm_{base}_ideas_tradition_2", traditions[1], group.key + "_start", " II"),
        ]
        entries.extend(
            (f"abm_{sanitize_key(idea.key)}", idea.assignments, idea.key, "")
            for idea in group.ideas
        )
        entries.append(
            (f"abm_{base}_ideas_ambition", group.bonus, group.key + "_bonus", "")
        )

        for index, (key, assignments, source_key, suffix) in enumerate(entries):
            if key in generated_keys:
                raise ValueError(f"duplicate generated advance key: {key}")
            generated_keys.add(key)
            advance_parts.extend(["", render_advance(key, index, rows, assignments)])
            name = localization_value(localization, source_key) + suffix
            description = localization.get(source_key + "_desc", "")
            loc_lines.append(f' {key}: "{name}"')
            loc_lines.append(f' {key}_desc: "{description}"')

    return "\n".join(advance_parts) + "\n", "\n".join(loc_lines) + "\n", len(generated_keys)


def write_bom_crlf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("\ufeff" + text.replace("\n", "\r\n")).encode("utf-8"))


def main() -> int:
    args = parse_args()
    mappings = read_sheet(args)
    localization, localization_keys = read_localization(args.eu4_root / "localisation")
    groups = read_idea_groups(args.eu4_root / "common/ideas")
    resolved = resolve_groups(mappings, localization_keys, groups)

    gaps = conversion_gaps(resolved)
    print(
        f"Resolved {len(mappings)} country mappings into {len(resolved)} EU4 idea groups"
    )
    if gaps:
        print(f"Missing explicit conversions for {len(gaps)} EU4 modifiers:")
        for modifier, source_groups in sorted(gaps.items()):
            print(f"  {modifier}: {', '.join(sorted(source_groups))}")
        return 1

    if args.check:
        print("All Middle East source groups and modifier conversions are valid")
        return 0

    advances, localization_text, advance_count = render_outputs(resolved, localization)
    repo_root = Path(__file__).resolve().parent.parent
    write_bom_crlf(repo_root / OUTPUT, advances)
    write_bom_crlf(repo_root / LOC_OUTPUT, localization_text)
    print(f"Wrote {advance_count} advances to {OUTPUT}")
    print(f"Wrote {advance_count * 2} localization keys to {LOC_OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())