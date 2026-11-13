#!/usr/bin/env python3
"""Convert EU4 national idea sets into EU5 advances (universal importer).

Same conventions, ruleset and output shape as the regional importers
(generate_africa_advances.py, generate_middle_east_advances.py,
generate_colonial_nations_advances.py, generate_qoyunlu_advances.py); the
difference is that the source is whatever idea file(s) and idea set(s) you
point it at instead of a hard-coded region list.

Inputs
  * idea files     positional paths to EU4 idea files (any name) or to
                   directories scanned recursively for `*.txt`. A positional
                   file that does not contain idea definitions is read as a
                   spec list instead.
  * set lists      `EU4_SET=EU5_TAG` tokens on the command line (--set) or one
                   per line in a spec file (`#` comments allowed), e.g.
                       QAR_ideas=QAR
                       AKK_ideas=AQQ      # EU4 tag AKK is EU5 tag AQQ
                       MNG_ideas          # tag derived from the set name
  * --all          convert every idea set found in the loaded idea files.
  * --ideas-file   extra idea file or directory (repeatable); defaults to
                   .tools/eu4/ideas.

Conventions (identical to the other importers)
  * ten advances per idea set: 2 traditions (the EU4 `start` block split into
    two effects), the 7 idea slots, then the ambition (`bonus` block);
  * ages: age_1 x2, age_2 x2, age_3 x2, age_4 x2, age_5, age_6;
  * ids: abm_<set>_ideas_tradition_1/2, abm_<idea_key>, abm_<set>_ideas_ambition
    (an idea key shared by two sets gets the set prefix);
  * potential: has_or_had_tag = <EU5 tag>;
  * one modifier per advance, the raw EU4 line kept as a `#` comment;
  * icons come from the modifier family (ICON_RULES) and never repeat inside
    one set; `requires` follows the shared age ladder unless overridden.

Switches that change the result
  --preserve-values    keep the EU4 magnitude (scaled) instead of the fixed
                       values the regional importers use; reproduces the
                       Qoyunlu import exactly.
  --idea-key-prefix    "auto" (default) keeps the EU4 idea key and only
                       prefixes it when two sets share one; "always" always
                       prefixes with the set tag (Qoyunlu behaviour).
  --overrides JSON     fill idea slots the parser cannot read, e.g.
                       {"in_honor_of_ali": {"tolerance_heretic": "3"}}.
  --conversions JSON   add EU4 -> EU5 modifier rows without editing this file.
  --requires-file JSON per-set prerequisite ladders, e.g.
                       {"QAR_ideas": ["feudalism_advance", ...]}.
  --force              write ids that also exist in another mod file (use when
                       moving an import from one file to another).
  --prune-loc          drop localisation entries whose advance id no longer
                       exists (stale keys from an earlier run).

Validation (everything is checked before a single byte is written)
  * 7 idea slots per set and exactly 2 tradition effects;
  * every EU4 modifier has an explicit CONVERSIONS row (all gaps listed);
  * no duplicate advance id inside the run or against the mod's other files;
  * every `requires` exists and is no later than the advance's age;
  * every `icon` exists in vanilla EU5.
  The last two need the game install; pass --game-root or they are skipped
  with a warning.

Outputs (UTF-8 BOM, CRLF, like every other generated advance file)
  --output      advance blocks (default in_game/common/advances/
                abm_imported_advances.txt); existing non-generated content at
                the top of the file is preserved.
  --loc-output  `<key>: "Name"` / `<key>_desc: "..."` built from EU4
                localisation (default
                main_menu/localization/english/abm_advances_imported_l_english.yml);
                existing keys that are not regenerated are kept.

Examples
  # validate two sets against the checkout, write nothing
  python3 .tools/scripts/generate_advances_from_ideas.py --check \
      --set QAR_ideas=QAR --set AKK_ideas=AQQ

  # import a spec file into an existing advance file
  python3 .tools/scripts/generate_advances_from_ideas.py sets.txt \
      --output in_game/common/advances/abm_caucasus_qoyunlu.txt \
      --loc-output main_menu/localization/english/abm_advances_caucasus_l_english.yml

  # convert every set of an out-of-tree idea file, tag = AB + set prefix
  python3 .tools/scripts/generate_advances_from_ideas.py /tmp/ideas.txt --all \
      --tag-prefix AB --stdout
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
ADVANCE_DIR = REPO_ROOT / "in_game/common/advances"
DEFAULT_IDEA_DIR = REPO_ROOT / ".tools/eu4/ideas"
DEFAULT_EU4_ROOT = REPO_ROOT / ".tools/eu4"
DEFAULT_OUTPUT = ADVANCE_DIR / "abm_imported_advances.txt"
DEFAULT_LOC_OUTPUT = (
    REPO_ROOT / "main_menu/localization/english/abm_advances_imported_l_english.yml"
)
DEFAULT_GAME_ROOT = Path(
    "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game"
)

# Age slots for the ten advances of an EU4 idea set: two traditions, seven
# ideas, one ambition. Same ladder as every other importer in this repo.
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

# Default prerequisite ladder (same list as the regional importers). Override
# per set with --requires-file when a theme needs a different spine.
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

AGE_ORDER = {
    "age_1_traditions": 1,
    "age_2_renaissance": 2,
    "age_3_discovery": 3,
    "age_4_reformation": 4,
    "age_5_absolutism": 5,
    "age_6_revolutions": 6,
}


@dataclass(frozen=True)
class Conversion:
    """EU4 modifier -> EU5 modifier lines.

    templates: EU5 lines; "{v}" is replaced with the EU4 value * factor.
    factor:    None keeps the templates verbatim (the value is baked in, as in
               the earlier importers); a number preserves the source magnitude
               on the scale EU5 measures it.
    absolute:  substitute |value| (EU4 cost reductions become EU5 efficiencies).
    """

    templates: tuple[str, ...]
    factor: float | None = None
    absolute: bool = False


# EU4 modifier -> EU5 modifier templates. Fixed-value rows are copied verbatim
# from the regional importers (each maps a mechanic onto the EU5 scale used by
# the mod's existing advances); the raw EU4 line is always kept as a comment.
_FIXED_CONVERSIONS: dict[str, tuple[str, ...]] = {
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
    # --- reused from the Africa / Middle East generators ---
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
    # --- colonial-nation specific EU4 modifiers ---
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
    # --- galley warfare and claims (Cyprus import; EU5 has no claim-cost or
    # galley-power equivalent under the EU4 name, so map to the live ones) ---
    "galley_cost": ("navy_galley_build_cost_modifier = -0.20",),
    "galley_power": ("navy_galley_power = 0.20",),
    # EU4 made claims cheaper; EU5 expresses the same intent as faster CB creation.
    "fabricate_claims_cost": ("casus_belli_creation_speed_modifier = 0.25",),
    # EU4 culture-conversion cost: EU5 has no such key, assimilation speed is the live equivalent.
    "culture_conversion_cost": ("global_pop_assimilation_speed_modifier = 0.20",),
    # --- Catholic Church mechanics (Kingdom of Jerusalem import) ---
    "papal_influence": ("monthly_papal_authority = 0.05",),
    "curia_powers_cost": ("propose_curia_action_cost_modifier = -0.10",),
    # EU4 missionary upkeep: EU5 has no upkeep key, effort is the live equivalent.
    "missionary_maintenance_cost": ("building_missionary_effort_modifier = 0.25",),
    # EU4 "church power" has no EU5 resource; clergy estate power is the live analogue.
    "church_power_modifier": ("global_clergy_estate_power = 0.15",),
    # --- Egypt (Mamluk) mechanics with no direct EU5 key ---
    # EU4 admin efficiency (cheaper coring, less AE) -> integration speed.
    "administrative_efficiency": ("global_integration_speed_modifier = 0.05",),
    "burghers_loyalty_modifier": (
        "burghers_estate_target_satisfaction = small_permanent_target_satisfaction",
    ),
    # EU4 monarch military power has no EU5 resource; military tradition is the analogue.
    "country_military_power": ("monthly_army_tradition = 0.10",),
    # EU4 free policy slot -> more legislative capacity.
    "free_policy": ("legislative_efficiency = 0.10",),
    # General fire pips map onto the fire-phase arm, like leader_land_fire.
    "max_general_fire": ("army_artillery_power = 0.10",),
    # EU4 "can repair at sea" -> EU5 at-sea repair rate.
    "sea_repair": ("ship_repair_at_sea = 0.05",),
    # --- Qoyunlu import (leader pips and government power) ---
    # army_fire_damage is non-functional, so fire pips become the fire-phase arm
    # (cf. fire_damage -> army_artillery_power above).
    "leader_land_fire": ("army_artillery_power = 0.10",),
    # EU4 government power is drawn from whichever resource the government type
    # uses (vanilla uses_government_power); grant all of them, like the Caucasus
    # "Highland Khans" advance does.
    "yearly_government_power": (
        "monthly_legitimacy = 0.10",
        "monthly_republican_tradition = 0.10",
        "monthly_devotion = 0.10",
        "monthly_horde_unity = 0.10",
        "monthly_tribal_cohesion = 0.10",
    ),
    # --- Baltic + Russia import (Poland, Lithuania, Livonia, Novgorod, Muscovy) ---
    # EU4 "all estates" loyalty equilibrium -> the three estates EU5 models here.
    "all_estate_loyalty_equilibrium": (
        "nobles_estate_target_satisfaction = medium_permanent_target_satisfaction",
        "clergy_estate_target_satisfaction = medium_permanent_target_satisfaction",
        "burghers_estate_target_satisfaction = medium_permanent_target_satisfaction",
    ),
    # EU4 auto-exploration of colony-adjacent land -> EU5 exploration missions.
    "auto_explore_adjacent_to_colony": ("may_explore = yes",),
    # EU4 hussar unlock is a unit gate: emit the same line as vanilla unlock_hussars_advance.
    "can_recruit_hussars": ("unlock_unit = a_hussars",),
    # EU4 monarch admin power has no EU5 resource; it buys tech/ideas, so research speed.
    "country_admin_power": ("research_speed_modifier = 0.05",),
    # No EU5 drill-gain modifier; drilled regiments fight better, so tactics.
    "drill_gain_modifier": ("military_tactics = 0.10",),
    # EU4 governing capacity -> EU5 integration speed (cf. administrative_efficiency).
    "governing_capacity_modifier": ("global_integration_speed_modifier = 0.15",),
    # EU4 true-faith manpower has no EU5 split; plain manpower.
    "manpower_in_true_faith_provinces": ("global_manpower_modifier = 0.10",),
    # EU4 "may establish frontier" -> the EU5 cabinet action it stands for.
    "may_establish_frontier": ("unlock_cabinet_action = settle_the_frontier",),
    # EU4 nobles influence -> EU5 nobles estate power (negative value calms them).
    "nobles_influence_modifier": ("global_nobles_estate_power = -0.10",),
    # EU4 `range` is colonial range.
    "range": ("colonial_range_modifier = 0.20",),
    # EU4 heretic-tolerance cap -> a tolerance point, like tolerance_of_heathens_capacity.
    "tolerance_of_heretics_capacity": ("tolerance_heretic = 1",),
    "war_exhaustion": ("monthly_war_exhaustion = -0.05",),
}

CONVERSIONS: dict[str, Conversion] = {
    modifier: Conversion(templates) for modifier, templates in _FIXED_CONVERSIONS.items()
}

# Rows that keep the EU4 magnitude instead of a fixed value: the effect is a
# straight cost<->efficiency swap, so |value| is meaningful.
CONVERSIONS.update(
    {
        "province_warscore_cost": Conversion(
            ("global_war_score_efficiency = {v}",), factor=1.0, absolute=True
        ),
        "imperial_authority": Conversion(
            ("monthly_imperial_authority = {v}",), factor=0.10
        ),
    }
)

# Value-preserving variants used by --preserve-values: the EU4 magnitude is
# kept (scaled where EU5 measures the same thing differently) instead of the
# fixed magnitude the regional importers use to control modifier stacking.
_SCALED_CONVERSIONS: dict[str, Conversion] = {
    "leader_land_shock": Conversion(
        ("army_heavy_cavalry_power = {v}", "army_heavy_infantry_power = {v}"),
        factor=0.10,
    ),
    "leader_land_fire": Conversion(
        ("army_light_infantry_power = {v}", "army_light_cavalry_power = {v}"),
        factor=0.10,
    ),
    "leader_land_manuever": Conversion(
        ("combat_speed_modifier = {v}", "army_movement_speed = {v}"), factor=0.10
    ),
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
    "land_maintenance_modifier": Conversion(
        ("army_maintenance_efficiency = {v}",), factor=1.0, absolute=True
    ),
    "global_tax_modifier": Conversion(("tax_income_efficiency = {v}",), factor=1.0),
    "stability_cost_modifier": Conversion(
        ("stability_cost_efficiency = {v}",), factor=1.0, absolute=True
    ),
    "core_creation": Conversion(
        ("global_integration_speed_modifier = {v}",), factor=1.0, absolute=True
    ),
    "province_warscore_cost": Conversion(
        ("global_war_score_efficiency = {v}",), factor=1.0, absolute=True
    ),
    "reduced_liberty_desire": Conversion(("loyalty_to_overlord = {v}",), factor=1.0),
    "global_unrest": Conversion(("pop_join_rebel_threshold = {v}",), factor=0.05),
    "diplomats": Conversion(("monthly_diplomats = {v}",), factor=0.10),
    "global_trade_goods_size_modifier": Conversion(
        ("global_max_rgo_size_modifier = {v}",), factor=1.0
    ),
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


def apply_conversion_mode(preserve_values: bool) -> None:
    """Switch the table between the fixed (default) and the scaled variants."""
    if preserve_values:
        CONVERSIONS.update(_SCALED_CONVERSIONS)

ICON_RULES = (
    (("army_", "discipline", "siege_", "regiment_", "global_manpower", "cavalry", "land_"), "glorious_arms"),
    (("navy_", "naval_", "sailors", "privateer", "blockade", "galley", "maritime", "ship_"), "royal_navy"),
    (
        ("trade_", "global_trade", "global_merchant", "export_", "import_", "merchant_", "caravan"),
        "merchants_and_trade",
    ),
    (("tolerance_", "clergy_", "global_pop_conversion", "religious_"), "church_councils"),
    (("cultural_", "culture_", "assimilation", "global_pop_promotion"), "cultural_acceptance_advance"),
    (("research_", "institution", "absorb_", "_tech_cost", "literacy"), "library_advance"),
    (("tax_", "production_", "global_build", "global_max_rgo", "minting_", "build_cost"), "abacus_advance"),
    (
        (
            "monthly_legitimacy",
            "monthly_devotion",
            "monthly_republican",
            "monthly_horde",
            "monthly_tribal",
            "crown_",
        ),
        "crown_power_advance_renaissance",
    ),
    (("diplomat", "improve_relation", "antagonism", "casus_belli", "war_score"), "diplomatic_training"),
    (("fort_", "defensive", "hostile_attrition", "garrison"), "a_fortified_border"),
    (("prestige", "legitimacy"), "diplomatic_influence"),
    (
        ("monthly_", "stability_", "global_monthly_control", "global_max_control", "core_"),
        "smooth_administration",
    ),
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

# Fallback order used when an advance of a set already uses its rule icon: the
# rule icons first, then the generic ones (an icon never repeats inside a set).
ICON_POOL = (
    "glorious_arms",
    "royal_navy",
    "merchants_and_trade",
    "church_councils",
    "library_advance",
    "abacus_advance",
    "smooth_administration",
    "colonies",
    "crown_power_advance_renaissance",
    "diplomatic_training",
    "diplomatic_influence",
    "a_fortified_border",
    "cultural_acceptance_advance",
    "artists_advance",
    "finest_of_horses",
) + DEFAULT_ICONS

# EU4 ships a few idea slots as comment-only stubs (nothing to parse). The
# regional importers filled these two by hand; they stay as defaults here and
# --overrides can add more or replace them.
DEFAULT_IDEA_OVERRIDES: dict[str, tuple[tuple[str, str], ...]] = {
    # Shared by Canada/Cascadia; comment-only in the CSC set.
    "the_hudson_bay_company": (("merchants", "1"),),
    # QAR's in_honor_of_ali is "#Same as Ajam"; Ajam has tolerance_heretic = 3.
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
    source: Path


@dataclass(frozen=True)
class Spec:
    set_key: str
    tag: str
    requires: tuple[str, ...]


class ConversionError(Exception):
    pass


# ---------------------------------------------------------------------------
# EU4 parsing
# ---------------------------------------------------------------------------
def strip_comments(text: str) -> str:
    return "\n".join(line.split("#", 1)[0] for line in text.splitlines())


def find_blocks(text: str, depth_wanted: int) -> list[tuple[str, str]]:
    pattern = re.compile(r"(?m)^\s*([A-Za-z0-9_.-]+)\s*=\s*\{")
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
    """Top-level `key = value` pairs of a block, nested effects skipped.

    Works for both multi-line and single-line blocks (`slot = { a = 1 }`).
    """
    start = block.find("{")
    end = block.rfind("}")
    if start == -1 or end <= start:
        return ()
    assignments = []
    depth = 0
    for line in block[start + 1 : end].splitlines():
        code = line.strip()
        if depth == 0 and code:
            match = re.match(r"^([A-Za-z0-9_-]+)\s*=\s*([^{}]+?)\s*$", code)
            if match:
                assignments.append(match.groups())
        depth += code.count("{") - code.count("}")
    return tuple(assignments)


def idea_file_paths(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(path.rglob("*.txt")))
        else:
            files.append(path)
    return files


def load_groups(paths: list[Path]) -> dict[str, IdeaGroup]:
    """Every idea group found in the given files, first definition wins."""
    groups: dict[str, IdeaGroup] = {}
    for path in idea_file_paths(paths):
        if not path.is_file():
            raise SystemExit(f"idea file not found: {path}")
        text = strip_comments(path.read_text(encoding="utf-8-sig", errors="replace"))
        for key, block in find_blocks(text, 0):
            children = find_blocks(block, 1)
            slots = {child_key: child for child_key, child in children}
            if "start" not in slots or "bonus" not in slots:
                continue
            if key in groups:
                if groups[key].source != path:
                    print(
                        f"warning: {key} also defined in {path}, keeping "
                        f"{groups[key].source}",
                        file=sys.stderr,
                    )
                continue
            ideas = tuple(
                SourceBlock(child_key, parse_assignments(child))
                for child_key, child in children
                if child_key not in {"start", "bonus", "trigger"}
            )
            groups[key] = IdeaGroup(
                key,
                parse_assignments(slots["start"]),
                parse_assignments(slots["bonus"]),
                ideas,
                path,
            )
    return groups


# ---------------------------------------------------------------------------
# Spec resolution
# ---------------------------------------------------------------------------
def split_set_token(token: str) -> tuple[str, str | None]:
    set_key, sep, tag = token.partition("=")
    set_key = set_key.strip()
    tag = tag.strip().upper() if sep else None
    if not set_key:
        raise SystemExit(f"bad idea-set token {token!r}, expected EU4_SET=EU5_TAG")
    if not set_key.endswith("_ideas"):
        set_key += "_ideas"
    return set_key, tag


def derive_tag(set_key: str, prefix: str) -> str:
    base = re.sub(r"_ideas$", "", set_key)
    tag = re.sub(r"[^A-Za-z0-9]+", "_", base).upper().strip("_")
    return f"{prefix.upper()}{tag}" if prefix else tag


def spec_tokens_from_file(path: Path) -> list[str]:
    tokens = []
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        code = line.split("#", 1)[0].strip()
        if code:
            tokens.append(code)
    return tokens


def looks_like_idea_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    return bool(re.search(r"(?m)^\s*[A-Za-z0-9_.-]+_ideas\s*=\s*\{", text))


def collect_inputs(
    args: argparse.Namespace,
) -> tuple[list[Path], list[str]]:
    """Return (idea files/directories, set tokens) from every input channel."""
    idea_paths: list[Path] = []
    tokens: list[str] = []

    for path in args.ideas_file:
        idea_paths.append(path)

    for raw in args.inputs:
        path = Path(raw)
        if "=" not in raw and path.exists():
            if path.is_dir():
                idea_paths.append(path)
            elif looks_like_idea_file(path):
                idea_paths.append(path)
            else:
                tokens.extend(spec_tokens_from_file(path))
        else:
            tokens.append(raw)

    tokens.extend(args.set)

    if not idea_paths:
        idea_paths.append(DEFAULT_IDEA_DIR)
    return idea_paths, tokens


def resolve_specs(
    args: argparse.Namespace,
    groups: dict[str, IdeaGroup],
    tokens: list[str],
    requires_overrides: dict[str, tuple[str, ...]],
) -> list[Spec]:
    specs: list[Spec] = []
    seen: set[str] = set()

    if args.all:
        if tokens:
            print("note: --all ignores the given set tokens", file=sys.stderr)
        chosen = sorted(groups)
    else:
        chosen = []
        missing = []
        for token in tokens:
            set_key, tag = split_set_token(token)
            if set_key not in groups:
                missing.append(set_key)
                continue
            specs.append(
                Spec(
                    set_key,
                    tag or derive_tag(set_key, args.tag_prefix),
                    requires_overrides.get(set_key, REQUIRES),
                )
            )
            seen.add(set_key)
        if missing:
            hint = ", ".join(sorted(groups)[:8]) or "none"
            raise SystemExit(
                f"idea set(s) not found: {', '.join(missing)}\n"
                f"loaded sets include: {hint}..." if len(groups) > 8 else
                f"idea set(s) not found: {', '.join(missing)}\n"
                f"loaded sets: {hint}"
            )

    for set_key in chosen:
        if set_key in seen:
            continue
        specs.append(
            Spec(
                set_key,
                derive_tag(set_key, args.tag_prefix),
                requires_overrides.get(set_key, REQUIRES),
            )
        )
        seen.add(set_key)

    if not specs:
        raise SystemExit(
            "nothing to convert: pass idea sets (--set EU4_SET=EU5_TAG), a spec "
            "file, or --all"
        )
    return specs


# ---------------------------------------------------------------------------
# Conversion
# ---------------------------------------------------------------------------
def format_value(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.2f}"


def split_traditions(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[tuple[tuple[str, str], ...], tuple[tuple[str, str], ...]]:
    """Split EU4 traditions into two advances, keeping authority modifiers
    together in the first one (same rule as the other importers)."""
    authority = tuple(a for a in assignments if a[0] in AUTHORITY_MODIFIERS)
    others = tuple(a for a in assignments if a[0] not in AUTHORITY_MODIFIERS)
    units = ((authority,) if authority else ()) + tuple((item,) for item in others)
    if len(units) != 2:
        raise ConversionError(
            f"expected two tradition effects, found {len(units)}: {assignments}"
        )
    return units[0], units[1]


def convert_assignments(
    assignments: tuple[tuple[str, str], ...],
) -> tuple[list[str], list[str]]:
    comments = [f"# {modifier} = {value}" for modifier, value in assignments]
    converted: list[str] = []
    for modifier, raw in assignments:
        conversion = CONVERSIONS.get(modifier)
        if conversion is None:
            raise ConversionError(f"no EU5 conversion for EU4 modifier {modifier!r}")
        if conversion.factor is None:
            lines = conversion.templates
        else:
            value = float(raw)
            if conversion.absolute:
                value = abs(value)
            formatted = format_value(value * conversion.factor)
            lines = tuple(line.replace("{v}", formatted) for line in conversion.templates)
        for line in lines:
            if line not in converted:
                converted.append(line)
    if not converted:
        raise ConversionError(f"idea block converts to nothing: {assignments}")
    return comments, converted


def choose_icon(converted: list[str], index: int) -> str:
    modifier = converted[0].split("=", 1)[0].strip()
    for prefixes, icon in ICON_RULES:
        if modifier.startswith(prefixes):
            return icon
    return DEFAULT_ICONS[index % len(DEFAULT_ICONS)]


def unique_icon(preferred: str, used: set[str]) -> str:
    if preferred not in used:
        return preferred
    for icon in ICON_POOL:
        if icon not in used:
            return icon
    return preferred


# ---------------------------------------------------------------------------
# Reference data (vanilla + mod)
# ---------------------------------------------------------------------------
def advance_index(game_dir: Path) -> dict[str, str]:
    """id -> age for every advance in vanilla and in the mod."""
    ages: dict[str, str] = {}
    files = sorted((game_dir / "in_game/common/advances").glob("*.txt"))
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


def icon_pool(game_dir: Path) -> set[str]:
    icons: set[str] = set()
    for path in sorted((game_dir / "in_game/common/advances").glob("*.txt")):
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            match = re.match(r"^\s*icon = (\S+)", line)
            if match:
                icons.add(match.group(1).strip())
    return icons


def existing_advance_keys(exclude: Path) -> set[str]:
    keys: set[str] = set()
    for path in sorted(ADVANCE_DIR.glob("*.txt")):
        if path.resolve() == exclude.resolve():
            continue
        for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
            match = re.match(r"^(?:REPLACE:|INJECT:)?([A-Za-z0-9_]+)\s*=\s*\{", line)
            if match:
                keys.add(match.group(1))
    return keys


def read_localization(directory: Path) -> dict[str, str]:
    by_key: dict[str, str] = {}
    pattern = re.compile(r'^\s*([A-Za-z0-9_.-]+):\d*\s+"(.*)"\s*$')
    if not directory.is_dir():
        return by_key
    for path in sorted(directory.glob("*.yml")):
        for line in path.read_text(
            encoding="utf-8-sig", errors="replace"
        ).splitlines():
            match = pattern.match(line)
            if match:
                by_key.setdefault(match.group(1), match.group(2))
    return by_key


def read_existing_advances(path: Path) -> dict[str, tuple[str | None, str | None]]:
    """icon / requires of every block already in the target file.

    Regenerating into an existing import must not throw away the hand-tuned
    icons and prerequisites, so they are inherited unless --reset-icons /
    --reset-requires is passed.
    """
    found: dict[str, tuple[str | None, str | None]] = {}
    if not path.exists():
        return found
    text = path.read_text(encoding="utf-8-sig", errors="replace")
    for match in re.finditer(
        r"(?m)^(?:REPLACE:|INJECT:)?([A-Za-z0-9_]+)\s*=\s*\{(.*?)^\}", text, re.S
    ):
        key, body = match.group(1), match.group(2)
        icon = re.search(r"^\t?icon = (\S+)", body, re.M)
        requires = re.search(r"^\t?requires = (\S+)", body, re.M)
        found[key] = (
            icon.group(1) if icon else None,
            requires.group(1) if requires else None,
        )
    return found


def read_existing_comments(path: Path) -> dict[str, list[str]]:
    """Top-level comment lines that introduce a block already in the target.

    Keeps hand-written group headers (`# Qara Qoyunlu (QAR)`) across a
    regeneration; in-block comments are indented and therefore ignored.
    """
    found: dict[str, list[str]] = {}
    if not path.exists():
        return found
    pending: list[str] = []
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        if line in ("", "\ufeff") or line.isspace():
            continue
        if line.startswith("#") and not line.startswith(
            ("# Generated by", "# Source:", "# Localisation:")
        ):
            pending.append(line.rstrip())
            continue
        match = re.match(r"^(?:REPLACE:|INJECT:)?([A-Za-z0-9_]+)\s*=\s*\{", line)
        if match and pending:
            found.setdefault(match.group(1), pending)
        pending = []
    return found


def read_preamble(path: Path) -> str:
    """Return the non-generated content at the top of the target file."""
    if not path.exists():
        return ""
    kept = []
    for line in path.read_text(encoding="utf-8-sig", errors="replace").splitlines():
        if line.startswith("# Generated by"):
            break
        if re.match(r"^(?:REPLACE:|INJECT:)?[A-Za-z0-9_-]+\s*=\s*\{", line.strip()):
            break
        kept.append(line)
    return "\n".join(kept).rstrip()


def read_existing_loc(
    path: Path,
) -> tuple[list[str], dict[int, str], bool, int]:
    """Body lines of the existing loc file plus layout details.

    Returns (lines, line index -> key, blank_after_header, trailing_blank_lines)
    so a regenerated file keeps its comments, spacing and final newline.
    """
    lines: list[str] = []
    line_key: dict[int, str] = {}
    header_blank = True
    trailing = 0
    if not path.exists():
        return lines, line_key, header_blank, trailing
    pattern = re.compile(r"^\s*([A-Za-z0-9_.-]+):\d*\s+\"")
    raw_lines = path.read_text(
        encoding="utf-8-sig", errors="replace"
    ).splitlines()
    start = 0
    for index, raw in enumerate(raw_lines):
        if raw.strip() == "l_english:":
            start = index + 1
            break
    body = raw_lines[start:]
    header_blank = bool(body) and not body[0].strip()
    while body and not body[0].strip():
        body.pop(0)
    while body and not body[-1].strip():
        body.pop()
        trailing += 1
    for raw in body:
        match = pattern.match(raw)
        if match:
            line_key[len(lines)] = match.group(1)
        lines.append(raw.rstrip())
    return lines, line_key, header_blank, trailing


def humanize(key: str) -> str:
    return key.replace("_", " ").replace("-", " ").title()


def localization_value(localization: dict[str, str], key: str) -> str:
    return localization.get(key) or humanize(key)


def singular_tradition(name: str) -> str:
    """EU4 localises the `start` block as "<Country> Traditions"; the mod's
    advances use the singular ("Tradition I", "Tradition II")."""
    return re.sub(
        r"\btraditions\b",
        lambda match: "Tradition" if match.group(0)[0].isupper() else "tradition",
        name,
        flags=re.IGNORECASE,
    )


def advance_name(localization: dict[str, str], source_key: str, suffix: str) -> str:
    name = localization_value(localization, source_key)
    if suffix:
        name = singular_tradition(name)
    return name + suffix


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------
def set_entries(
    group: IdeaGroup,
    prefix_idea_keys: bool = False,
) -> tuple[
    tuple[str, tuple[tuple[str, str], ...], str, str], ...
]:
    """(advance id, assignments, localization source key, name suffix) x10."""
    base = re.sub(r"[^a-z0-9_]+", "_", group.key.lower().removesuffix("_ideas")).strip("_")
    traditions = split_traditions(group.start)
    entries = [
        (f"abm_{base}_ideas_tradition_1", traditions[0], group.key + "_start", " I"),
        (f"abm_{base}_ideas_tradition_2", traditions[1], group.key + "_start", " II"),
    ]
    for idea in group.ideas:
        name = re.sub(r"[^a-z0-9_]+", "_", idea.key.lower()).strip("_")
        if prefix_idea_keys and not name.startswith(f"{base}_"):
            name = f"{base}_{name}"
        entries.append((f"abm_{name}", idea.assignments, idea.key, ""))
    entries.append((f"abm_{base}_ideas_ambition", group.bonus, group.key + "_bonus", ""))
    return tuple(entries)


def effective_requires(
    spec: Spec,
    group: IdeaGroup,
    prefix_idea_keys: bool,
    inherited: dict[str, tuple[str | None, str | None]],
    reset_requires: bool,
) -> tuple[str, ...]:
    """The ten prerequisites, keeping ones already tuned in the target file."""
    requires = []
    for index, (key, *_rest) in enumerate(set_entries(group, prefix_idea_keys)):
        existing = inherited.get(key, (None, None))[1]
        if existing and not reset_requires:
            requires.append(existing)
        else:
            requires.append(spec.requires[index])
    return tuple(requires)


def render_advance(
    key: str,
    index: int,
    spec: Spec,
    assignments: tuple[tuple[str, str], ...],
    icon: str,
    requires: str,
) -> str:
    comments, converted = convert_assignments(assignments)
    lines = [
        f"{key} = {{",
        f"\tage = {AGES[index]}",
        f"\ticon = {icon}",
        "\tpotential = {",
        f"\t\thas_or_had_tag = {spec.tag}",
        "\t}",
        "",
        f"\trequires = {requires}",
        "",
        *(f"\t{line}" for line in comments),
        *(f"\t{line}" for line in converted),
        "}",
    ]
    return "\n".join(lines)


def render_set(
    spec: Spec,
    group: IdeaGroup,
    localization: dict[str, str],
    existing_keys: set[str],
    used_keys: set[str],
    vanilla_icons: set[str],
    prefix_idea_keys: bool,
    inherited: dict[str, tuple[str | None, str | None]],
    comments_source: Path | None,
    reset_icons: bool,
    reset_requires: bool,
    allow_existing: bool,
    warnings: list[str],
    problems: list[str],
) -> tuple[str, list[str], list[str]]:
    """Return (advance block text, loc lines, generated keys)."""
    entries = set_entries(group, prefix_idea_keys)
    if len(entries) != len(AGES):
        raise ConversionError(f"{spec.set_key}: {len(entries)} advances, expected 10")

    comments_by_key = read_existing_comments(Path(comments_source)) if comments_source else {}
    parts: list[str] = []
    loc_lines: list[str] = []
    keys: list[str] = []
    used_icons: set[str] = set()
    allowed: list[str] = []
    base = re.sub(r"[^a-z0-9_]+", "_", spec.set_key.lower().removesuffix("_ideas")).strip("_")
    requires = effective_requires(
        spec, group, prefix_idea_keys, inherited, reset_requires
    )

    for index, (key, assignments, source_key, suffix) in enumerate(entries):
        inherited_comments = comments_by_key.get(key)
        if index == 0 and not inherited_comments:
            parts.append(f"# {spec.tag} (EU4 idea set {spec.set_key}, {group.source.name})")
        if key in existing_keys and not allow_existing:
            problems.append(
                f"{spec.set_key}: advance id {key} already exists in another mod file"
            )
            continue
        if key in used_keys:
            # An idea key shared by two sets (EU4 ships a few), e.g. the
            # Hudson Bay Company slot: prefix it with the set tag.
            prefixed = f"abm_{base}_{key.removeprefix('abm_')}"
            warnings.append(f"{spec.set_key}: {key} already generated, renamed to {prefixed}")
            key = prefixed
            if key in used_keys or (key in existing_keys and not allow_existing):
                problems.append(f"{spec.set_key}: duplicate advance id {key}")
                continue
        if key in existing_keys:
            allowed.append(key)
        used_keys.add(key)
        keys.append(key)

        try:
            converted = convert_assignments(assignments)[1]
        except ConversionError as error:
            problems.append(
                f"{spec.set_key}/{source_key}: {error} (see --overrides)"
            )
            continue
        preferred = choose_icon(converted, index)
        inherited_icon = inherited.get(key, (None, None))[0]
        if inherited_icon and not reset_icons and inherited_icon not in used_icons:
            preferred = inherited_icon
        icon = unique_icon(preferred, used_icons)
        if icon in used_icons:
            problems.append(f"{spec.set_key}: no unique icon left for {key}")
        if vanilla_icons and icon not in vanilla_icons:
            problems.append(f"{spec.set_key}: unknown icon {icon!r} for {key}")
        used_icons.add(icon)

        if parts:
            parts.append("")
        if inherited_comments:
            parts.extend(inherited_comments)
            parts.append("")
        parts.append(render_advance(key, index, spec, assignments, icon, requires[index]))
        name = advance_name(localization, source_key, suffix)
        description = localization.get(source_key + "_desc") or name
        loc_lines.append(f' {key}: "{name}"')
        loc_lines.append(f' {key}_desc: "{description}"')

    if allowed:
        warnings.append(
            f"{spec.set_key}: {len(allowed)} id(s) already exist in other mod "
            f"files and were written again (--force); remove the old copies: "
            + ", ".join(allowed)
        )
    return "\n".join(parts) + "\n", loc_lines, keys


def write_bom_crlf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(("\ufeff" + text.replace("\n", "\r\n")).encode("utf-8"))


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate_group(
    spec: Spec,
    group: IdeaGroup,
    problems: list[str],
    gaps: dict[str, set[str]],
) -> None:
    if len(group.ideas) != 7:
        problems.append(
            f"{spec.set_key}: {len(group.ideas)} idea slots, expected 7 "
            f"({group.source.name})"
        )
    try:
        split_traditions(group.start)
    except ConversionError as error:
        problems.append(f"{spec.set_key}: {error}")

    assignments = group.start + group.bonus
    for idea in group.ideas:
        assignments += idea.assignments
    for modifier, _ in assignments:
        if modifier not in CONVERSIONS:
            gaps.setdefault(modifier, set()).add(spec.set_key)


def validate_requires(
    spec: Spec,
    requires: tuple[str, ...],
    ages: dict[str, str],
    problems: list[str],
) -> None:
    if len(requires) != len(AGES):
        problems.append(f"{spec.set_key}: requires must have {len(AGES)} entries")
        return
    for required, age in zip(requires, AGES):
        if required not in ages:
            problems.append(f"{spec.set_key}: unknown advance {required!r}")
            continue
        if AGE_ORDER.get(ages[required], 0) > AGE_ORDER[age]:
            problems.append(
                f"{spec.set_key}: {required!r} is {ages[required]} but the "
                f"advance is {age}"
            )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "inputs",
        nargs="*",
        metavar="FILE|EU4_SET=TAG",
        help="idea file, spec file, directory, or SET=EU5_TAG token",
    )
    parser.add_argument(
        "--set",
        action="append",
        default=[],
        metavar="EU4_SET=EU5_TAG",
        help="idea set to import (repeatable; tag optional, derived from the set)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="convert every idea set found in the loaded idea files",
    )
    parser.add_argument(
        "--ideas-file",
        action="append",
        type=Path,
        default=[],
        metavar="PATH",
        help=f"extra idea file or directory (default: {DEFAULT_IDEA_DIR})",
    )
    parser.add_argument(
        "--tag-prefix",
        default="",
        help="prefix for tags derived from set names (e.g. AB for ABXYZ)",
    )
    parser.add_argument(
        "--overrides",
        type=Path,
        metavar="JSON",
        help='fill idea slots the parser cannot read, e.g. {"in_honor_of_ali": '
        '{"tolerance_heretic": "3"}}',
    )
    parser.add_argument(
        "--conversions",
        type=Path,
        metavar="JSON",
        help="extra EU4 -> EU5 modifier rows to merge into CONVERSIONS",
    )
    parser.add_argument(
        "--requires-file",
        type=Path,
        metavar="JSON",
        help='per-set prerequisite ladders, e.g. {"QAR_ideas": ["feudalism_advance", ...]}',
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"advance file to write (default: {DEFAULT_OUTPUT.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "--loc-output",
        type=Path,
        default=DEFAULT_LOC_OUTPUT,
        help="localisation file to write (default: "
        f"{DEFAULT_LOC_OUTPUT.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "--eu4-root",
        type=Path,
        default=DEFAULT_EU4_ROOT,
        help=f"directory holding EU4 'localisation/' (default: {DEFAULT_EU4_ROOT})",
    )
    parser.add_argument(
        "--game-root",
        type=Path,
        default=DEFAULT_GAME_ROOT,
        help="EU5 game root used to validate requires/icons "
        f"(default: {DEFAULT_GAME_ROOT})",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate sources, conversions, requires and icons; write nothing",
    )
    parser.add_argument(
        "--preserve-values",
        action="store_true",
        help="keep the EU4 magnitude (scaled) instead of the importers' fixed "
        "values, as the Qoyunlu import does",
    )
    parser.add_argument(
        "--idea-key-prefix",
        choices=("auto", "always"),
        default="auto",
        help="advance ids for idea slots: 'auto' keeps the EU4 key and only "
        "prefixes it on collision, 'always' always prefixes with the set tag",
    )
    parser.add_argument(
        "--reset-icons",
        action="store_true",
        help="do not inherit the icons already in the target file",
    )
    parser.add_argument(
        "--reset-requires",
        action="store_true",
        help="do not inherit the prerequisites already in the target file",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="allow advance ids that already exist in another mod file "
        "(use when moving or rewriting an existing import)",
    )
    parser.add_argument(
        "--prune-loc",
        action="store_true",
        help="drop localisation entries whose advance id no longer exists "
        "(stale keys from an earlier run with different options)",
    )
    parser.add_argument(
        "--stdout",
        action="store_true",
        help="print the generated files instead of writing them",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="only print warnings and errors",
    )
    return parser.parse_args(argv)


def load_overrides(
    path: Path | None,
) -> dict[str, tuple[tuple[str, str], ...]]:
    if path is None:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: expected a JSON object")
    overrides: dict[str, tuple[tuple[str, str], ...]] = {}
    for idea_key, assignments in data.items():
        if not isinstance(assignments, dict):
            raise SystemExit(f"{path}: {idea_key} must map modifier -> value")
        overrides[str(idea_key)] = tuple(
            (str(modifier), str(value)) for modifier, value in assignments.items()
        )
    return overrides


def load_extra_conversions(path: Path | None) -> None:
    """Merge extra EU4 -> EU5 rows from JSON.

    {"modifier": ["eu5_line = 0.10", ...]}                 fixed templates
    {"modifier": {"templates": [...], "factor": 0.1,
                  "absolute": true}}                       value-scaled
    """
    if path is None:
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: expected a JSON object")
    for modifier, spec in data.items():
        if isinstance(spec, list):
            CONVERSIONS[str(modifier)] = Conversion(tuple(str(line) for line in spec))
        elif isinstance(spec, dict) and "templates" in spec:
            CONVERSIONS[str(modifier)] = Conversion(
                tuple(str(line) for line in spec["templates"]),
                factor=None if spec.get("factor") is None else float(spec["factor"]),
                absolute=bool(spec.get("absolute", False)),
            )
        else:
            raise SystemExit(f"{path}: {modifier} must be a list or a templates object")


def load_requires(path: Path | None) -> dict[str, tuple[str, ...]]:
    if path is None:
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise SystemExit(f"{path}: expected a JSON object")
    return {
        str(set_key): tuple(str(value) for value in values)
        for set_key, values in data.items()
    }


def apply_overrides(
    groups: dict[str, IdeaGroup],
    overrides: dict[str, tuple[tuple[str, str], ...]],
) -> None:
    """Fill empty idea slots (and warn about unused user override keys)."""
    user_overrides = dict(overrides)
    overrides = {**DEFAULT_IDEA_OVERRIDES, **overrides}
    used: set[str] = set()
    for key, group in groups.items():
        ideas = []
        for idea in group.ideas:
            if not idea.assignments and idea.key in overrides:
                used.add(idea.key)
                ideas.append(SourceBlock(idea.key, overrides[idea.key]))
            else:
                ideas.append(idea)
        groups[key] = IdeaGroup(group.key, group.start, group.bonus, tuple(ideas), group.source)
    unused = sorted(set(user_overrides) - used)
    if unused:
        print(f"warning: unused overrides: {', '.join(unused)}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    apply_conversion_mode(args.preserve_values)
    output = args.output if args.output.is_absolute() else REPO_ROOT / args.output
    loc_output = (
        args.loc_output if args.loc_output.is_absolute() else REPO_ROOT / args.loc_output
    )

    idea_paths, tokens = collect_inputs(args)
    if not args.quiet:
        print(f"Reading idea definitions from {len(idea_file_paths(idea_paths))} file(s)")
    groups = load_groups(idea_paths)
    apply_overrides(groups, load_overrides(args.overrides))
    specs = resolve_specs(args, groups, tokens, load_requires(args.requires_file))

    load_extra_conversions(args.conversions)

    inherited = read_existing_advances(output)
    problems: list[str] = []
    gaps: dict[str, set[str]] = {}
    for spec in specs:
        if spec.set_key not in groups:
            problems.append(f"{spec.set_key}: idea set not found")
            continue
        validate_group(spec, groups[spec.set_key], problems, gaps)
    if gaps:
        print(
            f"{len(gaps)} EU4 modifier(s) have no EU5 conversion "
            f"(extend CONVERSIONS or pass --conversions):",
            file=sys.stderr,
        )
        for modifier in sorted(gaps):
            sets = sorted(gaps[modifier])
            shown = ", ".join(sets[:4]) + (f", +{len(sets) - 4} more" if len(sets) > 4 else "")
            print(f"  {modifier}: {shown}", file=sys.stderr)

    game_dir = args.game_root if args.game_root.is_absolute() else REPO_ROOT / args.game_root
    game_ok = (game_dir / "in_game/common/advances").is_dir()
    ages: dict[str, str] = {}
    vanilla_icons: set[str] = set()
    if game_ok:
        ages = advance_index(game_dir)
        vanilla_icons = icon_pool(game_dir)
        for spec in specs:
            if spec.set_key in groups:
                validate_requires(
                    spec,
                    effective_requires(
                        spec,
                        groups[spec.set_key],
                        args.idea_key_prefix == "always",
                        inherited,
                        args.reset_requires,
                    ),
                    ages,
                    problems,
                )
    else:
        print(
            f"warning: {game_dir} has no advances; skipping requires/icon validation",
            file=sys.stderr,
        )

    localization = read_localization(
        (args.eu4_root if args.eu4_root.is_absolute() else REPO_ROOT / args.eu4_root)
        / "localisation"
    )
    existing = existing_advance_keys(output)
    used_keys: set[str] = set()
    warnings: list[str] = []
    blocks: list[str] = []
    loc_lines: list[str] = []
    total = 0

    for spec in specs:
        group = groups[spec.set_key]
        try:
            text, lines, keys = render_set(
                spec,
                group,
                localization,
                existing,
                used_keys,
                vanilla_icons,
                args.idea_key_prefix == "always",
                inherited,
                output,
                args.reset_icons,
                args.reset_requires,
                args.force,
                warnings,
                problems,
            )
        except ConversionError as error:
            problems.append(str(error))
            continue
        used_keys.update(keys)
        blocks.append(text)
        loc_lines.extend(lines)
        total += len(keys)

    if problems:
        print(f"{len(problems)} problem(s), nothing written:", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    loc_display = (
        loc_output.relative_to(REPO_ROOT)
        if loc_output.is_relative_to(REPO_ROOT)
        else loc_output
    )
    header = [
        "# Generated by .tools/scripts/generate_advances_from_ideas.py",
        f"# Source: {', '.join(sorted({groups[s.set_key].source.name for s in specs}))} "
        f"({', '.join(s.set_key for s in specs)})",
        f"# Localisation: {loc_display}",
        "",
    ]
    preamble = read_preamble(output)
    advance_text = "\n".join(
        ([preamble, ""] if preamble else []) + header + blocks
    ).strip() + "\n"

    (
        existing_lines,
        existing_keys_by_line,
        loc_header_blank,
        loc_trailing_blanks,
    ) = read_existing_loc(loc_output)
    generated_loc = {line.strip().split(":", 1)[0]: line for line in loc_lines}
    live_ids = existing | used_keys
    kept_loc: list[str] = []
    emitted: set[str] = set()
    for index, line in enumerate(existing_lines):
        key = existing_keys_by_line.get(index)
        if key is not None and key in generated_loc:
            kept_loc.append(generated_loc[key])
            emitted.add(key)
            continue
        if (
            key is not None
            and args.prune_loc
            and key.removesuffix("_desc") not in live_ids
        ):
            continue
        kept_loc.append(line)
    kept_loc.extend(line for key, line in generated_loc.items() if key not in emitted)
    loc_body = ["l_english:", *([""] if loc_header_blank else []), *kept_loc]
    loc_body.extend([""] * loc_trailing_blanks)
    loc_text = "\n".join(loc_body) + "\n"

    for warning in warnings:
        print(f"warning: {warning}", file=sys.stderr)
    if not args.quiet:
        print(f"{total} advances from {len(specs)} EU4 idea set(s)")
        for spec in specs:
            print(f"  {spec.set_key} -> {spec.tag}")

    if args.check:
        if not args.quiet:
            print("All sources, conversions, prerequisites and icons are valid")
        return 0

    if args.stdout:
        sys.stdout.write(advance_text)
        sys.stdout.write("\n# --- localisation ---\n")
        sys.stdout.write(loc_text)
        return 0

    write_bom_crlf(output, advance_text)
    write_bom_crlf(loc_output, loc_text)
    if not args.quiet:
        print(f"Wrote {total} advances to {output}")
        print(f"Wrote {total * 2} localization keys to {loc_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
