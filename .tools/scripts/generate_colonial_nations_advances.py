#!/usr/bin/env python3
"""Generate Colonial Nations EU5 advances from EU4 national ideas.

Modeled on generate_africa_advances.py. Reads the colonial-nation idea groups
directly from the cached EU4 ideas extract (no Google Sheet needed: every
colonial idea group maps 1:1 to an EU5 tag of the same name).
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path


# Each colonial-nation EU4 idea group maps directly to one EU5 tag.
COLONIAL_GROUPS = (
    ("ALA", "ALA_ideas"),
    ("BRZ", "BRZ_ideas"),
    ("CAN", "CAN_ideas"),
    ("CSC", "CSC_ideas"),
    ("MEX", "MEX_ideas"),
    ("QUE", "QUE_ideas"),
    ("SNA", "SNA_ideas"),
    ("TEX", "TEX_ideas"),
    ("VRM", "VRM_ideas"),
    ("USA", "USA_ideas"),
    ("WSI", "WSI_ideas"),
    ("NZL", "NZL_ideas"),
)

OUTPUT = Path("in_game/common/advances/abm_f4_colonial_nations.txt")
LOC_OUTPUT = Path("main_menu/localization/english/abm_advances_colonial_l_english.yml")

# Colonial nations only appear in the Age of Discovery, so their idea line
# starts at age 3 instead of age 1:
#   age 3: tradition_1, tradition_2
#   age 4: idea1, idea2, idea3, idea4
#   age 5: idea5, idea6, idea7
#   age 6: ambition
AGES = (
    "age_3_discovery",
    "age_3_discovery",
    "age_4_reformation",
    "age_4_reformation",
    "age_4_reformation",
    "age_4_reformation",
    "age_5_absolutism",
    "age_5_absolutism",
    "age_5_absolutism",
    "age_6_revolutions",
)
REQUIRES = (
    "military_traditions",
    "paved_road_advance",
    "supply_depot_advance_age_4_reformation",
    "global_trade_advance",
    "trade_envoys",
    "pharmacology_advance",
    "absolutist_court",
    "absolute_rulership",
    "national_sovereignty",
    "modern_bureaucracy",
)

# EU4 modifier -> EU5 modifier templates. {value} preserves the source
# magnitude where the mechanics are directly equivalent. Non-functional EU5
# names found in earlier generators are replaced with their working equivalents
# (army_fire_damage, army_shock_damage_taken, naval_damage, embargo_efficiency,
# spy_network_defence, integration_cost_modifier are all dead in EU5).
CONVERSIONS: dict[str, tuple[str, ...]] = {
    # --- vanilla EU4 modifiers (functional EU5 equivalents) ---
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
    "fire_damage": ("army_artillery_power = 0.10",),  # army_fire_damage is non-functional
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
    "merchants": ("global_merchant_capacity_modifier = 0.10",),
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
    "reduced_liberty_desire": ("subject_loyalty = 10",),
    "reinforce_speed": ("regiment_reinforcement_speed = 0.10",),
    "religious_unity": (
        "clergy_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    "republican_tradition": ("monthly_republican_tradition = 0.10",),
    "sailors_recovery_speed": ("global_sailors_modifier = 0.10",),
    "same_culture_advisor_cost": ("hire_advisor_cost_modifier = -0.10",),
    "ship_durability": ("naval_damage_taken = -0.05",),
    "shock_damage_received": ("military_tactics = 0.10",),  # army_shock_damage_taken non-functional
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
    # --- reused from Africa / Middle East generators ---
    "advisor_cost": ("hire_advisor_cost_modifier = -0.10",),
    "advisor_pool": ("hire_advisor_cost_modifier = -0.10",),
    "army_tradition_from_battle": ("monthly_army_tradition = 0.05",),
    "artillery_power": ("army_artillery_power = 0.10",),
    "church_loyalty_modifier": (
        "clergy_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    "diplomatic_annexation_cost": ("diplomatic_annexation_efficiency = 0.10",),
    "embargo_efficiency": ("blockade_efficiency = 0.25",),  # embargo_efficiency is non-functional
    "global_ship_cost": ("navy_maintenance_efficiency = 0.10",),
    "global_spy_defence": ("spy_network_construction = 0.20",),  # no EU5 spy-defence modifier
    "light_ship_cost": ("navy_light_ship_build_cost_modifier = -0.10",),
    "light_ship_power": ("navy_light_ship_power = 0.10",),  # naval_damage is non-functional
    "naval_morale": ("naval_morale_modifier = 0.10",),
    "nobles_loyalty_modifier": (
        "nobles_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    "recover_army_morale_speed": ("land_morale_recovery = 0.10",),
    "sailor_maintenance_modifer": ("navy_maintenance_efficiency = 0.10",),
    "trade_range_modifier": ("trade_range_modifier = 0.10",),
    "vassal_income": ("subject_tax_efficiency = 0.10",),
    # --- colonial-nations specific EU4 modifiers ---
    "global_colonial_growth": ("colonial_migration_size_modifier = 0.25",),
    "inflation_reduction": ("minting_income_factor = 0.10",),
    "global_ship_trade_power": ("merchant_power_from_maritime_modifier = 0.10",),
    "native_uprising_chance": ("pop_join_rebel_threshold = -0.05",),
    "native_assimilation": ("colonial_migration_size_modifier = 0.10",),
    "leader_siege": ("train_general_ability = 0.10",),
    "mercenary_discipline": ("discipline = 0.05",),
    "mercenary_manpower": ("global_mercenaries_modifier = 0.20",),
    "prestige_from_land": ("prestige_from_land_battle = 0.10",),
    "fire_damage_received": ("military_tactics = 0.10",),
    "no_religion_penalty": ("tolerance_heretic = 1",),
    "max_revolutionary_zeal": ("monthly_republican_tradition = 0.10",),
    "liberty_desire_from_subject_development": ("subject_loyalty = 10",),
    "trade_company_investment_cost": ("global_merchant_capacity_modifier = 0.10",),
    "allowed_marine_fraction": ("army_light_infantry_power = 0.10",),
    "min_autonomy_in_territories": ("global_max_control = 0.05",),
    "prestige_decay": ("prestige_decay = -0.005",),
    "shock_damage": ("army_heavy_infantry_power = 0.10",),
    "heavy_ship_power": ("navy_heavy_ship_power = 0.10",),
    "global_sailors_modifier": ("global_sailors_modifier = 0.10",),
}

# Hand-fixes for idea slots the EU4 parser cannot read (nested effects) or that
# are intentionally empty in the source.
IDEA_ASSIGNMENT_OVERRIDES = {
    # CSC's Hudson Bay Company slot is a comment-only stub in EU4; give it the
    # same merchant theme as Canada's version so the 7-slot structure survives.
    "the_hudson_bay_company": (("merchants", "1"),),
}

ICON_RULES = (
    (("army_", "discipline", "siege_", "regiment_", "global_manpower"), "glorious_arms"),
    (("navy_", "naval_", "sailors", "privateer", "blockade"), "royal_navy"),
    (("trade_", "global_trade", "global_merchant", "export_", "import_", "merchant_"), "merchants_and_trade"),
    (("tolerance_", "clergy_", "global_pop_conversion", "religious_"), "church_councils"),
    (("research_", "institution", "absorb_"), "library_advance"),
    (("tax_", "production_", "global_build", "global_max_rgo", "minting_"), "abacus_advance"),
    (("monthly_", "stability_", "global_monthly_control", "global_max_control"), "smooth_administration"),
    (("can_colonize", "colonial_migration", "native_"), "colonies"),
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
        default=Path(".tools/eu4"),
        help="Directory holding extracted EU4 'ideas/' and 'localisation/'.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate all source data and conversions without writing files.",
    )
    return parser.parse_args()


def read_localization(directory: Path) -> dict[str, str]:
    by_key = {}
    pattern = re.compile(r'^\s*([A-Za-z0-9_-]+):\d*\s+"(.*)"\s*$')
    for path in sorted(directory.glob("*_l_english.yml")):
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            match = pattern.match(line)
            if match:
                key, value = match.groups()
                by_key[key] = value
    return by_key


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


def render_advance(
    key: str,
    index: int,
    tag: str,
    assignments: tuple[tuple[str, str], ...],
) -> str:
    comments, converted = convert_assignments(assignments)
    lines = [
        f"{key} = {{",
        f"\tage = {AGES[index]}",
        f"\ticon = {choose_icon(converted, index)}",
        "\tpotential = {",
        f"\t\thas_or_had_tag = {tag}",
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


def read_preamble(path: Path) -> str:
    """Return the non-idea content at the top of the current advances file."""
    if not path.exists():
        return ""
    lines = path.read_text(encoding="utf-8-sig").splitlines()
    kept = []
    for line in lines:
        if line.startswith("# Generated by"):
            break
        if re.match(r"^[A-Za-z0-9_-]+_ideas\s*=\s*\{", line):
            break
        kept.append(line)
    return "\n".join(kept).rstrip()


# Loc keys that predate the generator and must survive regeneration.
PROTECTED_LOC_KEYS = {
    "abm_colonial_representation_law",
    "abm_colonial_representation_law_desc",
}


def read_loc_preamble(path: Path) -> list[str]:
    """Return existing non-generated loc keys (e.g. the representation law)."""
    if not path.exists():
        return []
    kept = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        stripped = line.strip()
        if not stripped or stripped == "l_english:":
            continue
        key = stripped.split(":", 1)[0]
        if key in PROTECTED_LOC_KEYS:
            kept.append(line)
    return kept


def render_outputs(
    groups: dict[str, IdeaGroup],
    localization: dict[str, str],
) -> tuple[str, str, int]:
    advance_parts = [
        "# Generated by .tools/generate_colonial_nations_advances.py",
        "# Source: extracted EU4 colonial-nation idea groups + EU4 localization.",
    ]
    loc_lines = []
    generated_keys = set()

    for tag, group_key in COLONIAL_GROUPS:
        group = groups[group_key]
        if not len(group.ideas) == 7:
            raise ValueError(f"{group_key} has {len(group.ideas)} idea slots, expected 7")
        split_traditions(group.start)

        base = sanitize_key(group.key.removesuffix("_ideas"))
        advance_parts.extend(["", f"# {tag}"])
        traditions = split_traditions(group.start)
        entries = [
            (f"abm_{base}_ideas_tradition_1", traditions[0], group.key + "_start", " I"),
            (f"abm_{base}_ideas_tradition_2", traditions[1], group.key + "_start", " II"),
        ]
        for idea in group.ideas:
            name = sanitize_key(idea.key)
            key = f"abm_{name}"
            # The Hudson Bay Company idea is shared by Canada and Cascadia in
            # EU4; keep the bare advance_name for the first owner and only add
            # the tag prefix when a bare key has already been taken.
            if key in generated_keys:
                key = f"abm_{base}_{name}"
            entries.append((key, idea.assignments, idea.key, ""))
        entries.append(
            (f"abm_{base}_ideas_ambition", group.bonus, group.key + "_bonus", "")
        )

        for index, (key, assignments, source_key, suffix) in enumerate(entries):
            if key in generated_keys:
                raise ValueError(f"duplicate generated advance key: {key}")
            generated_keys.add(key)
            advance_parts.extend(["", render_advance(key, index, tag, assignments)])
            name = localization_value(localization, source_key) + suffix
            description = localization.get(source_key + "_desc") or name
            loc_lines.append(f' {key}: "{name}"')
            loc_lines.append(f' {key}_desc: "{description}"')

    preamble = read_preamble(Path(OUTPUT))
    advances = (
        "\n".join([preamble, ""] + advance_parts).strip() + "\n"
        if preamble
        else "\n".join(advance_parts).strip() + "\n"
    )
    loc_preamble = read_loc_preamble(Path(LOC_OUTPUT))
    loc_text = "\n".join(["l_english:", "", *loc_preamble, ""] + loc_lines).strip() + "\n"
    return advances, loc_text, len(generated_keys)


def write_bom_crlf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("\ufeff" + text.replace("\n", "\r\n")).encode("utf-8"))


def conversion_gaps(groups: dict[str, IdeaGroup]) -> dict[str, set[str]]:
    gaps: dict[str, set[str]] = defaultdict(set)
    for tag, group_key in COLONIAL_GROUPS:
        group = groups[group_key]
        assignments = group.start + group.bonus
        for idea in group.ideas:
            assignments += idea.assignments
        for modifier, _ in assignments:
            if modifier not in CONVERSIONS:
                gaps[modifier].add(group_key)
    return gaps


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parent.parent.parent
    eu4_root = (repo_root / args.eu4_root).resolve()
    localization = read_localization(eu4_root / "localisation")
    groups = read_idea_groups(eu4_root / "ideas")

    missing = [g for _, g in COLONIAL_GROUPS if g not in groups]
    if missing:
        print(f"Missing EU4 idea groups: {', '.join(missing)}")
        return 1

    gaps = conversion_gaps(groups)
    if gaps:
        print(f"Missing explicit conversions for {len(gaps)} EU4 modifiers:")
        for modifier, source_groups in sorted(gaps.items()):
            print(f"  {modifier}: {', '.join(sorted(source_groups))}")
        return 1

    if args.check:
        print("All colonial-nation source groups and modifier conversions are valid")
        return 0

    advances, loc_text, count = render_outputs(groups, localization)
    write_bom_crlf(repo_root / OUTPUT, advances)
    write_bom_crlf(repo_root / LOC_OUTPUT, loc_text)
    print(f"Wrote {count} advances to {OUTPUT}")
    print(f"Wrote {count * 2} localization keys to {LOC_OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
