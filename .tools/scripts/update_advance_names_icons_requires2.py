#!/usr/bin/env python3
"""Rematch icons and/or prerequisites for mod advances against vanilla EU5 advances.

Successor of update_advance_names_icons_requires.py:
  * keeps the curated modifier -> (icon, requires) mapping and the icon
    picking of the old tool, with two anti-repetition rules: an icon is never
    reused within an advance set (same potential block / same tag), and the
    least-used icon across the whole run is preferred so the same icon does
    not show up all over the mod.
  * drops the unused "advance renaming" part entirely,
  * adds a compatibility table built from vanilla EU5 advances so every match
    is thematic: a military advance gets a military icon and a military
    prerequisite, an economic advance an economic prerequisite, a government
    advance a government prerequisite, and so on. Prerequisites are always
    picked from the SAME AGE as the advance itself (never cross-age), and
    icons follow the same type + age rules.

Reference data (--dir, default .tools/eu5/advances):
  * _advances_template.txt   reference template (defines the six ages and the
                             shape of a tag advance); required.
  * [0-3]_<name>.txt         vanilla advance files scanned into the table.

Inputs (positional arguments, can be mixed and repeated):
  * file paths      -> update those files
  * advance keys    -> only update those advances, e.g. abm_bng_combat_piracy
  * country tags    -> only update advances whose potential contains
                       has_or_had_tag = <TAG>, e.g. BNG
Without positional arguments, all abm_*.txt files in in_game/common/advances
are processed.

Actions: --icons (only icons), --requires (only prerequisites), neither = both;
--force overwrites values even when the recomputed value is unchanged.
Skip filters: --skip-key, --skip-pattern, --skip-tag, --skip-replace exclude
matching advances from processing.
Encoding: every written file is UTF-8 with BOM (a missing BOM is added
automatically); existing line endings (LF or CRLF) are preserved.

Examples:
  python .tools/update_advance_names_icons_requires2.py
  python .tools/update_advance_names_icons_requires2.py in_game/common/advances/abm_f4-t2_india_bengal.txt
  python .tools/update_advance_names_icons_requires2.py --icons BNG abm_f4-t2_india_bengal.txt
  python .tools/update_advance_names_icons_requires2.py --requires abm_bng_combat_piracy
  python .tools/update_advance_names_icons_requires2.py --dir /path/to/eu5/advances --dry-run file.txt
"""

import argparse
import hashlib
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
ADVANCE_DIR = BASE / "in_game/common/advances"
DEFAULT_REF_DIR = BASE / ".tools/eu5/advances"

TEMPLATE_NAME = "_advances_template.txt"
REF_FILE_RE = re.compile(r"^[0-3]_\w+\.txt$")

# ── Modifier → (icon, requires, category) ──────────────────────────
# Curated by hand in the previous tool; kept verbatim on purpose.
MOD_MAP = {
    # Trade
    'export_efficiency': ('red_sea_trade', 'guilds', 'trade_export'),
    'import_efficiency': ('saharan_gold_trade', 'guilds', 'trade_import'),
    'global_merchant_capacity_modifier': ('merchants_and_trade', 'global_trade_advance', 'trade_merchant'),
    'selling_efficiency': ('global_trade_advance', 'merchants_and_trade', 'trade_sell'),
    'trade_range_modifier': ('global_trade_routes_advance', 'trade_range_advance_age_2', 'trade_range'),
    'global_trade_center_power': ('free_merchants', 'trade_range_advance_age_2', 'trade_center'),

    # Naval
    'naval_range_modifier': ('royal_navy', 'trade_range_advance_age_2', 'naval_range'),
    'naval_damage_done': ('glorious_arms', 'naval_morale_advance_1', 'naval_offense'),
    'naval_damage_taken': ('defensive_army', 'boarding_parties', 'naval_defense'),
    'blockade_efficiency': ('gunpowder_advance', 'naval_morale_advance_1', 'naval_blockade'),
    'global_sailors_modifier': ('nor_bounties_of_the_sea', 'trade_range_advance_age_2', 'naval_sailors'),
    'global_maritime_presence_modifier': ('colonies', 'colonial_charters', 'naval_presence'),
    'can_convert_galleys_to_light': ('letters_of_marque', 'naval_morale_advance_1', 'naval_convert'),
    'sea_cost_on_distance_from_capital_when_maritime': ('expansionism', 'boarding_parties', 'naval_logistics'),

    # Military
    'army_heavy_infantry_power': ('glorious_arms', 'pike_square', 'mil_heavy_inf'),
    'army_light_infantry_power': ('glorious_arms', 'pike_and_shot_advance', 'mil_light_inf'),
    'army_heavy_cavalry_power': ('glorious_arms', 'horse_riding_advance', 'mil_heavy_cav'),
    'army_light_cavalry_power': ('glorious_arms', 'horse_riding_advance', 'mil_light_cav'),
    'army_artillery_power': ('artillery_institution_advance', 'unlock_chambered_cannon_advance', 'mil_artillery'),
    'discipline': ('army_professionalism', 'drill_army_advance', 'mil_discipline'),
    'army_tradition': ('army_professionalism', 'drill_army_advance', 'mil_tradition'),
    'army_movement_speed': ('drill_army_advance', 'army_professionalism', 'mil_speed'),
    'army_maintenance_efficiency': ('administrative_leadership', 'supply_lines', 'mil_maintenance'),
    'land_morale_modifier': ('glorious_arms', 'army_professionalism', 'mil_morale'),
    'morale_recovery_in_friendly': ('defensive_army', 'supply_lines', 'mil_recovery'),
    'land_unit_attrition': ('defensive_army_attrition', 'supply_lines', 'mil_attrition'),
    'global_manpower_modifier': ('regimental_system', 'feudalism_advance', 'mil_manpower'),
    'global_hostile_attrition': ('defensive_army_attrition', 'fortification_advance', 'mil_hostile'),
    'siege_ability': ('gunpowder_advance', 'supply_depot_advance_age_3_discovery', 'mil_siege'),
    'artillery_bonus_vs_fort': ('artillery_institution_advance', 'unlock_chambered_cannon_advance', 'mil_siege'),
    'possible_frontage_modifier': ('army_professionalism', 'drill_army_advance', 'mil_frontage'),
    'experience_decay': ('army_professionalism', 'recruitment_improvements_reformation', 'mil_experience'),
    'monthly_experience_gain': ('army_professionalism', 'recruitment_improvements_reformation', 'mil_experience'),
    'amount_looted_modifier': ('slave_raiding_wars', 'feudalism_advance', 'mil_loot'),

    # Levy
    'levy_combat_efficiency_modifier': ('regimental_system', 'unlock_peasant_levy_advance', 'levy_combat'),
    'global_levy_size_modifier': ('regimental_system', 'unlock_peasant_levy_advance', 'levy_size'),

    # Fortification
    'global_fort_limit_modifier': ('fortified_towns', 'feudalism_advance', 'fort_limit'),
    'global_garrison_size_modifier': ('fortified_towns', 'feudalism_advance', 'fort_garrison'),

    # Economy
    'global_production_efficiency': ('abacus_advance', 'construction_speed_renaissance', 'econ_production'),
    'tax_income_efficiency': ('court_accounting', 'regulate_court_procedures', 'econ_tax'),
    'minting_income_factor': ('banking_advance', 'counting_house_advance', 'econ_minting'),
    'monthly_inflation': ('debt_and_loans', 'counting_house_advance', 'econ_inflation'),
    'global_build_buildings_efficiency': ('city_building_advance', 'construction_speed_renaissance', 'econ_build'),

    # Resources
    'global_iron_output_modifier': ('efficient_mining', 'bole_smelting', 'res_iron'),
    'global_coal_output_modifier': ('efficient_mining', 'bole_smelting', 'res_coal'),
    'global_copper_output_modifier': ('efficient_mining', 'rgo_logistics_discovery', 'res_copper'),
    'global_tin_output_modifier': ('efficient_mining', 'rgo_logistics_discovery', 'res_tin'),
    'global_stone_output_modifier': ('efficient_mining', 'rgo_logistics_discovery', 'res_stone'),
    'global_silver_output_modifier': ('efficient_mining', 'bole_smelting', 'res_silver'),
    'global_goods_gold_output_modifier': ('efficient_mining', 'bole_smelting', 'res_gold'),
    'global_jewelry_output_modifier': ('artists_advance', 'merchants_and_trade', 'res_jewelry'),
    'global_rice_output_modifier': ('agriculture_advance', 'construction_speed_renaissance', 'res_rice'),
    'global_food_output_modifier': ('agriculture_advance', 'construction_speed_renaissance', 'res_food'),
    'global_tools_output_modifier': ('efficient_mining', 'bole_smelting', 'res_tools'),

    # Administration
    'court_spending_efficiency': ('court_accounting', 'regulate_court_procedures', 'adm_court'),
    'government_size': ('crown_power_advance_renaissance', 'legalism_advance', 'adm_gov'),
    'government_reform_slots': ('crown_power_advance_renaissance', 'legalism_advance', 'adm_reform'),
    'stability_cost_efficiency': ('smooth_administration', 'legalism_advance', 'adm_stability'),
    'monthly_diplomats': ('trade_envoys', 'formalized_relations', 'adm_diplomats'),
    'diplomatic_reputation': ('trade_envoys', 'formalized_relations', 'adm_reputation'),
    'diplomatic_range_modifier': ('trade_envoys', 'diplomatic_range_age_1', 'adm_range'),
    'diplomatic_annexation_efficiency': ('smooth_administration', 'trade_envoys', 'adm_annex'),
    'global_monthly_control': ('road_building', 'legalism_advance', 'adm_control'),
    'global_max_control': ('road_building', 'legalism_advance', 'adm_control'),
    'global_distance_from_capital_speed_propagation': ('road_building', 'paved_road_advance', 'adm_distance'),
    'global_monthly_development': ('city_building_advance', 'construction_speed_renaissance', 'adm_dev'),
    'improve_relation_impact': ('trade_envoys', 'formalized_relations', 'adm_relations'),
    'spy_network_construction': ('diplomatic_training', 'formalized_relations', 'adm_spy'),
    'counter_espionage': ('diplomatic_training', 'formalized_relations', 'adm_espionage'),

    # Population/Culture
    'global_migration_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_migration'),
    'global_pop_assimilation_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_assimilation'),
    'global_pop_conversion_speed_modifier': ('church_councils', 'organized_religion', 'pop_conversion'),
    'global_pop_promotion_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_promotion'),
    'cultures_capacity': ('cultural_acceptance_advance', 'cultural_acceptance_advance', 'pop_cultures'),
    'tolerance_own': ('church_councils', 'organized_religion', 'pop_tolerance'),
    'global_life_expectancy': ('church_councils', 'pharmacology_advance', 'pop_health'),
    'global_disease_resistance': ('church_councils', 'pharmacology_advance', 'pop_health'),
    'global_population_growth': ('agriculture_advance', 'construction_speed_renaissance', 'pop_growth'),
    'global_max_literacy': ('library_advance', 'cultural_traditions_law_advance', 'pop_literacy'),
    'non_rural_migration_attraction': ('city_building_advance', 'construction_speed_renaissance', 'pop_urban'),
    'global_monthly_prosperity': ('agriculture_advance', 'construction_speed_renaissance', 'pop_prosperity'),

    # Estates
    'nobles_estate_max_tax': ('crown_power_advance_renaissance', 'feudalism_advance', 'est_noble_tax'),
    'burghers_estate_max_tax': ('crown_power_advance_renaissance', 'guilds', 'est_burgher_tax'),
    'nobles_estate_levy_size': ('crown_power_advance_renaissance', 'feudalism_advance', 'est_noble_levy'),
    'global_nobles_estate_power': ('crown_power_advance_renaissance', 'distribution_of_power_advance', 'est_noble_power'),
    'global_burghers_estate_power': ('crown_power_advance_renaissance', 'distribution_of_power_advance', 'est_burgher_power'),
    'global_estate_target_satisfaction': ('smooth_administration', 'regulate_court_procedures', 'est_satisfaction'),
    'global_estate_satisfaction_recovery': ('smooth_administration', 'regulate_court_procedures', 'est_recovery'),
    'global_estate_max_tax': ('court_accounting', 'regulate_court_procedures', 'est_max_tax'),

    # Estate pop modifiers
    'global_nobles_city_desired_pop_scaled': ('city_building_advance', 'legalism_advance', 'est_noble_city'),
    'global_nobles_rural_desired_pop_scaled': ('agriculture_advance', 'feudalism_advance', 'est_noble_rural'),
    'global_soldiers_city_desired_pop_scaled': ('fortified_towns', 'feudalism_advance', 'est_soldier_city'),
    'global_soldiers_rural_desired_pop_scaled': ('regimental_system', 'feudalism_advance', 'est_soldier_rural'),

    # Subjects
    'subject_loyalty': ('smooth_administration', 'trade_envoys', 'sub_loyalty'),
    'subject_income_modifier': ('court_accounting', 'trade_envoys', 'sub_income'),
    'subject_opinions': ('trade_envoys', 'trade_envoys', 'sub_opinion'),

    # Special
    'research_speed_modifier': ('library_advance', 'modern_bureaucracy', 'spec_research'),
    'combined_bonus_per_type': ('smooth_administration', 'imperial_ambitions', 'spec_combined'),
    'unlock_government_reform': ('crown_power_advance_renaissance', 'legalism_advance', 'spec_unlock_reform'),
    'unlock_subject_type': ('trade_envoys', 'global_trade_advance', 'spec_unlock_subject'),

    # Terrain
    'global_max_rgo_size_modifier_in_non_rural': ('agriculture_advance', 'rgo_logistics_discovery', 'terrain_rgo'),
    'global_road_building_time': ('road_building', 'paved_road_advance', 'terrain_road'),
    'road_cost_on_distance_from_capital': ('road_building', 'paved_road_advance', 'terrain_road_cost'),
}


def add_modifier_mappings(keys, icon, requirement, category):
    for key in keys.split():
        MOD_MAP.setdefault(key, (icon, requirement, category))


add_modifier_mappings(
    """navy_light_ship_build_cost_modifier navy_galley_build_cost_modifier
    navy_transport_build_cost_modifier navy_light_ship_power navy_galley_power
    navy_heavy_ship_power heavy_ship_power own_coast_naval_combat_bonus
    monthly_navy_tradition monthly_monthly_navy_tradition navy_tradition_decay
    naval_morale_recovery navy_movement_speed train_admiral_ability
    ship_durability privateer_maintenance_cost_modifier can_hire_privateers
    allow_privateers_slave_raid sea_cost_on_distance_from_capital""",
    'royal_navy', 'ship_building_advance', 'naval_maintenance',
)
add_modifier_mappings(
    """fort_limit_modifier fort_maintenance_efficiency
    army_light_infantry_maintenance_cost_modifier
    army_heavy_infantry_maintenance_cost_modifier
    army_artillery_maintenance_cost_modifier
    army_light_cavalry_build_cost_modifier army_heavy_cavalry_build_cost_modifier
    army_heavy_infantry_build_cost_modifier army_light_infantry_build_cost_modifier
    army_artillery_cost_modifier army_heavy_infantry_reinforce_cost_modifier
    army_light_infantry_reinforce_cost_modifier army_reinforce_efficiency
    regiment_reinforcement_speed mercenary_maintenance_efficiency
    train_general_ability train_general_cost_modifier combat_speed_modifier
    army_tradition_decay army_tradition_from_battle light_infantry_power
    land_morale_recovery global_war_score_efficiency declaring_war_cost_modifier
    antagonism_received_modifier power_projection monthly_rebel_growth
    aggressiveness_modifier""",
    'army_professionalism', 'drill_army_advance', 'mil_discipline',
)
add_modifier_mappings(
    """global_trade_through_owned_territory_efficiency
    global_trade_through_owned_territory_cost_modifier
    global_trades_per_burgher global_own_trade_power bank_interest""",
    'merchants_and_trade', 'global_trade_advance', 'trade_merchant',
)
add_modifier_mappings(
    """colonial_migration_size global_integration_speed_modifier
    diplomatic_upkeep_efficiency diplomatic_annexation_cost max_diplomats
    loyalty_to_overlord""",
    'diplomatic_influence', 'formalized_relations', 'adm_relations',
)
add_modifier_mappings(
    """cultures_capacity_modifier culture_capacity religion.group
    number_of_allowed_religious_figures global_institution_growth_modifier
    prestige_decay stability_decay stability_investment government_reforms
    country_cabinet_efficiency set_cabinet_member_cost_modifier""",
    'cultural_acceptance_advance', 'legalism_advance', 'pop_cultures',
)
add_modifier_mappings(
    """global_max_rgo_size_modifier_in_rural global_raw_material_output
    global_weaponry_output_modifier global_non_rural_monthly_prosperity
    global_wool_output_modifier global_lumber_output_modifier
    global_monthly_food_modifier global_pop_food_consumption
    global_pepper_output_modifier global_incense_output_modifier
    global_cloves_output_modifier""",
    'agriculture_advance', 'rgo_logistics_discovery', 'res_rgo',
)

ICON_POOLS = {
    'trade': (
        'red_sea_trade', 'saharan_gold_trade', 'merchants_and_trade',
        'global_trade_advance', 'global_trade_routes_advance', 'free_merchants',
        'trade_caravans', 'incense_trade_route', 'zmw_merchant_taxes',
    ),
    'naval': (
        'royal_navy', 'naval_ambitions', 'ship_building_advance',
        'letters_of_marque', 'boarding_parties', 'maritime_advance_age_4',
        'rudimentary_coastal_ship_repair', 'safe_exploration_techniques_advance',
        'merchant_power_from_maritime_reformation_advance',
    ),
    'military': (
        'glorious_arms', 'offensive_army', 'defensive_army',
        'defensive_mentality', 'army_professionalism', 'drill_army_advance',
        'regimental_system', 'expanded_supply_trains', 'pike_square',
        'pike_and_shot_advance',
    ),
    'artillery': (
        'artillery_institution_advance', 'gunpowder_advance',
        'unlock_chambered_cannon_advance', 'offensive_army',
        'siege_engineers_advance',
    ),
    'cavalry': (
        'horse_riding_advance', 'finest_of_horses', 'elephant_cavalry',
        'glorious_arms', 'offensive_army',
    ),
    'economy': (
        'abacus_advance', 'court_accounting', 'banking_advance',
        'debt_and_loans', 'city_building_advance', 'construction_speed_renaissance',
        'efficient_mining', 'agriculture_advance', 'food_advance_renaissance',
        'artists_advance',
    ),
    'administration': (
        'smooth_administration', 'crown_power_advance_renaissance',
        'legalism_advance', 'administrative_leadership', 'road_building',
        'laws', 'government_size', 'a_central_power', 'renaissance_advance',
        'town_rights_advance', 'bonded_by_loyalty',
    ),
    'diplomacy': (
        'trade_envoys', 'diplomatic_training', 'diplomatic_influence',
        'diplomatic_range_age_1', 'formalized_relations',
        'students_of_foreign_courts', 'efficient_spies',
    ),
    'culture': (
        'cultural_acceptance_advance', 'church_councils', 'organized_religion',
        'library_advance', 'scholasticism', 'religious_melting_pot',
        'bhakti_movement', 'buddhist_meditation', 'hindu_muslim_relations',
        'vegetarianism', 'roman_orthodoxy',
    ),
    'estate': (
        'crown_power_advance_renaissance', 'distribution_of_power_advance',
        'court_accounting', 'local_nobility', 'peasants_rights_laws_advance',
        'smooth_administration',
    ),
    'subject': (
        'smooth_administration', 'trade_envoys', 'diplomatic_influence',
        'formalized_relations', 'crown_power_advance_renaissance',
    ),
}

# ── Age → family → age-appropriate vanilla requires ────────────────
AGE_REQUIRES = {
    3: {  # age_3_discovery
        'trade': 'trade_range_advance_age_3',
        'naval': 'ship_building_techniques_discovery',
        'military': 'pike_and_shot_advance',
        'artillery': 'unlock_chambered_cannon_advance',
        'cavalry': 'horse_riding_advance',
        'economy': 'colonial_charters',
        'administration': 'colonial_charters',
        'diplomacy': 'colonial_charters',
        'culture': 'colonial_charters',
        'estate': 'colonial_charters',
        'subject': 'colonial_charters',
    },
    4: {  # age_4_reformation
        'trade': 'global_trade_advance',
        'naval': 'letters_of_marque',
        'military': 'recruitment_improvements_reformation',
        'artillery': 'artillery_institution_advance',
        'cavalry': 'recruitment_improvements_reformation',
        'economy': 'construction_speed_reformation',
        'administration': 'early_modern_administation',
        'diplomacy': 'global_trade_advance',
        'culture': 'confessionalism_advance',
        'estate': 'crown_power_advance_reformation',
        'subject': 'global_trade_advance',
    },
    5: {  # age_5_absolutism
        'trade': 'central_bank_advance',
        'naval': 'central_bank_advance',
        'military': 'government_size_absolutism',
        'artillery': 'manufactories_advance',
        'cavalry': 'government_size_absolutism',
        'economy': 'manufactories_advance',
        'administration': 'government_size_absolutism',
        'diplomacy': 'central_bank_advance',
        'culture': 'scientific_revolution_advance',
        'estate': 'government_size_absolutism',
        'subject': 'central_bank_advance',
    },
    6: {  # age_6_revolutions
        'trade': 'industrialization_advance',
        'naval': 'industrialization_advance',
        'military': 'modern_bureaucracy',
        'artillery': 'industrialization_advance',
        'cavalry': 'modern_bureaucracy',
        'economy': 'industrialization_advance',
        'administration': 'modern_bureaucracy',
        'diplomacy': 'enlightenment_advance',
        'culture': 'enlightenment_advance',
        'estate': 'modern_bureaucracy',
        'subject': 'enlightenment_advance',
    },
}

# ── Broad thematic types ───────────────────────────────────────────
FAMILY_TYPE = {
    'trade': 'economy',
    'naval': 'naval',
    'military': 'military',
    'artillery': 'military',
    'cavalry': 'military',
    'economy': 'economy',
    'administration': 'administration',
    'diplomacy': 'diplomacy',
    'culture': 'culture',
    'estate': 'estate',
    'subject': 'subject',
}

# Inverse mapping: an inferred type picks the icon pool of its family. Used
# for advances without a curated MOD_MAP entry so their icon pool matches the
# inferred type (same rule as the requirement matching).
FAMILY_FOR_TYPE = {
    'military': 'military',
    'naval': 'naval',
    'economy': 'economy',
    'administration': 'administration',
    'diplomacy': 'diplomacy',
    'culture': 'culture',
    'estate': 'estate',
    'subject': 'subject',
}

TYPE_PRIORITY = (
    'military', 'naval', 'economy', 'administration',
    'diplomacy', 'culture', 'estate', 'subject',
)

# Unambiguous domain prefixes checked first (whole-word prefixes win over
# segment keywords, e.g. trade_sea_* is economy, not naval).
FIELD_PREFIX_TYPE = (
    ('trade_', 'economy'),
    ('global_trade', 'economy'),
    ('tax_', 'economy'),
    ('navy_', 'naval'),
    ('naval_', 'naval'),
    ('ship_', 'naval'),
    ('army_', 'military'),
    ('military_', 'military'),
    ('land_', 'military'),
    ('fort_', 'military'),
    ('diplomatic_', 'diplomacy'),
    ('government_', 'administration'),
    ('culture_', 'culture'),
    ('religion_', 'culture'),
    ('nobles_', 'estate'),
    ('burghers_', 'estate'),
    ('clergy_', 'estate'),
    ('peasants_', 'estate'),
    ('subject_', 'subject'),
    ('vassal_', 'subject'),
)

# Segment keywords: matched against whole underscore-separated words of a
# field name (never against advance keys, never as substrings), so
# 'state' does not match inside 'estate' and 'road' does not match inside
# 'crossroad'.
SEGMENT_KEYWORDS = {
    'military': {
        'army', 'military', 'discipline', 'morale', 'manpower', 'attrition',
        'cavalry', 'infantry', 'artillery', 'fort', 'garrison', 'levy',
        'regiment', 'battle', 'experience', 'frontage', 'loot', 'hostile',
        'drill', 'mercenary', 'general', 'combat', 'assault', 'recruitment',
        'conscription', 'cannon', 'pike', 'muster', 'war', 'rebel',
        'aggressive', 'siege', 'defensive', 'offensive', 'tactics',
        'movement', 'initiative', 'soldier', 'proximity',
    },
    'naval': {
        'navy', 'naval', 'ship', 'blockade', 'sailor', 'admiral', 'privateer',
        'galley', 'maritime', 'sea', 'exploration', 'fleet',
    },
    'economy': {
        'trade', 'tax', 'mint', 'inflation', 'bank', 'merchant', 'market',
        'production', 'build', 'building', 'construction', 'coin', 'goods',
        'output', 'mining', 'agriculture', 'rgo', 'road', 'caravan',
        'prosperity', 'colonial', 'colonization', 'economy', 'income', 'food',
        'wool', 'lumber', 'pepper', 'incense', 'cloves', 'rice', 'iron',
        'coal', 'copper', 'tin', 'stone', 'silver', 'gold', 'jewelry',
        'tools', 'weaponry', 'price', 'interest', 'toll', 'industry',
        'industrial', 'manufactory', 'town', 'city', 'upgrade', 'workshop',
    },
    'administration': {
        'government', 'law', 'stability', 'legitimacy', 'cabinet',
        'bureaucracy', 'administration', 'administrative', 'control',
        'development', 'reform', 'court', 'crown', 'decree', 'census',
        'civil', 'absolutism', 'council', 'regency', 'autonomy', 'legalism',
        'federal', 'state', 'sovereignty',
    },
    'diplomacy': {
        'diplomat', 'diplomatic', 'relation', 'spy', 'espionage',
        'reputation', 'envoy', 'annex', 'favor', 'alliance', 'prestige',
        'truce', 'wargoal', 'casus', 'improve',
    },
    'culture': {
        'culture', 'cultural', 'religion', 'religious', 'church', 'faith',
        'tolerance', 'conversion', 'literacy', 'education', 'institution',
        'scholastic', 'missionary', 'art', 'philosophy', 'university',
        'heretic', 'heathen', 'syncretism', 'devotion',
    },
    'estate': {
        'estate', 'nobles', 'noble', 'burghers', 'burgher', 'clergy',
        'peasants', 'peasant', 'tribesmen', 'slaves', 'slave',
    },
    'subject': {
        'subject', 'vassal', 'tributary', 'overlord', 'loyalty',
    },
}

DEFAULT_MAP = ('glorious_arms', 'feudalism_advance', 'mil_generic')

STRUCTURAL_SKIP = {
    'age', 'icon', 'requires', 'depth', 'research_cost',
    'starting_technology_level', 'for', 'order', 'index',
}


# ── Text helpers ───────────────────────────────────────────────────
def strip_line(line):
    """Remove '#' comments and double-quoted strings from a single line."""
    out = []
    i = 0
    n = len(line)
    while i < n:
        ch = line[i]
        if ch == '"':
            j = line.find('"', i + 1)
            i = n if j == -1 else j + 1
            continue
        if ch == '#':
            break
        out.append(ch)
        i += 1
    return ''.join(out)


def find_top_level_blocks(text):
    """Yield (key, start, end) for every top-level `key = { ... }` block.

    Comment- and string-aware, so braces inside '#...' comments or "..."
    strings never disturb block detection.
    """
    pos = 0
    depth = 0
    key = None
    block_start = None
    in_block = False
    for match in re.finditer(r'[^\n]*(?:\n|$)', text):
        line_start = match.start()
        line_end = match.end()
        code = strip_line(match.group(0))
        stripped = code.strip()
        opens = code.count('{')
        closes = code.count('}')
        if not in_block:
            if not stripped:
                pass
            else:
                km = re.match(
                    r'^((?:REPLACE|INJECT):)?([A-Za-z_]\w*)\s*=\s*\{',
                    stripped,
                )
                if km:
                    key = (km.group(1) or '') + km.group(2)
                    block_start = line_start
                    depth = opens - closes
                    in_block = True
        else:
            depth += opens - closes
            if depth <= 0:
                yield key, block_start, line_end
                in_block = False
        pos = line_end


def parse_advance_block(block_text, key):
    """Parse one advance block into its age/icon/requires/fields."""
    open_idx = block_text.find('{')
    close_idx = block_text.rfind('}')
    if open_idx == -1 or close_idx <= open_idx:
        body = ''
    else:
        body = block_text[open_idx + 1:close_idx]
    entry = {
        'key': key,
        'age': None,
        'icons': [],
        'requires': [],
        'fields': [],   # (field, value) top-level lines
        'mod_keys': [],  # field names, for MOD_MAP lookup
    }
    depth = 0
    for raw in body.split('\n'):
        code = strip_line(raw)
        s = code.strip()
        if not s:
            continue
        opens = code.count('{')
        closes = code.count('}')
        if depth == 0:
            if s.endswith('{'):
                # nested block header (potential, allow, ai_weight, ...)
                depth += max(opens - closes, 1)
                continue
            if '=' not in s:
                continue
            field, _, value = s.partition('=')
            field = field.strip()
            value = value.strip()
            if field in STRUCTURAL_SKIP:
                if field == 'age':
                    entry['age'] = value
                elif field == 'icon':
                    entry['icons'].append(value)
                elif field == 'requires':
                    entry['requires'].append(value)
                continue
            entry['fields'].append((field, value))
            entry['mod_keys'].append(field.split()[0])
        else:
            depth += opens - closes
    return entry


def potential_signature(block_text, key):
    """Identity of an advance's potential block (for group icon uniqueness)."""
    match = re.search(r'(?m)^\s*potential\s*=\s*\{', block_text)
    if not match:
        return key
    depth = 0
    for index in range(match.end() - 1, len(block_text)):
        ch = block_text[index]
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return re.sub(r'\s+', '', strip_line(block_text[match.start():index + 1]))
    return key


# ── Reference table ────────────────────────────────────────────────
class Reference:
    def __init__(self, ref_dir):
        self.dir = Path(ref_dir)
        self.table = {}
        self.hub = Counter()
        self.available_icons = set()
        self.ages = []
        self._load_template()
        self._load_advance_files()
        self._resolve_requires_chain()
        self._count_hubs()

    def _load_template(self):
        template = self.dir / TEMPLATE_NAME
        if not template.is_file():
            raise SystemExit(
                f"Reference template not found: {template}. "
                f"Expected {TEMPLATE_NAME} in the reference directory."
            )
        text = template.read_text(encoding='utf-8-sig')
        ages = {}
        for m in re.finditer(r'\b(age_\d+_\w+)\b', text):
            num = re.search(r'age_(\d+)_', m.group(1))
            if num:
                ages[int(num.group(1))] = m.group(1)
        self.ages = [ages[n] for n in sorted(ages)]

    def _load_advance_files(self):
        files = [
            p for p in self.dir.iterdir()
            if p.is_file() and REF_FILE_RE.match(p.name)
        ]
        if not files:
            raise SystemExit(
                f"No reference advance files matching [0-3]_*.txt in {self.dir}"
            )
        for filepath in sorted(files):
            text = filepath.read_text(encoding='utf-8-sig')
            for key, start, end in find_top_level_blocks(text):
                entry = parse_advance_block(text[start:end], key)
                entry['type'] = None
                entry['known'] = False
                self.table[key] = entry
            # icon validity: any *.txt file in the reference dir (old behavior)
            self.available_icons.update(
                re.findall(r'(?m)^\s*icon\s*=\s*(\S+)',
                           filepath.read_text(encoding='utf-8-sig'))
            )
        # Icon validity should also cover icons that only appear in files
        # outside the [0-3] mask (country files etc.), exactly like the old tool.
        for filepath in self.dir.glob('*.txt'):
            if REF_FILE_RE.match(filepath.name):
                continue
            self.available_icons.update(
                re.findall(r'(?m)^\s*icon\s*=\s*(\S+)',
                           filepath.read_text(encoding='utf-8-sig'))
            )
        if not self.available_icons:
            raise RuntimeError(f"No vanilla icons found in {self.dir}")

        # First classification pass: curated map and keywords.
        for entry in self.table.values():
            mapped = lookup_mod_map(entry['mod_keys'])
            if mapped:
                entry['type'] = FAMILY_TYPE[category_family(mapped[2])]
                entry['known'] = True
            else:
                entry['type'] = classify_by_keywords(entry)
                entry['known'] = entry['type'] is not None
                if entry['type'] is None:
                    entry['type'] = classify_by_effects(entry)
                    entry['known'] = entry['type'] is not None

    def _resolve_requires_chain(self):
        """Propagate types through requires links for unclassified entries."""
        unknown = {
            key for key, entry in self.table.items()
            if not entry['known']
        }
        changed = True
        while changed:
            changed = False
            for key in list(unknown):
                entry = self.table[key]
                for req in entry['requires']:
                    other = self.table.get(req)
                    if other and other['known']:
                        entry['type'] = other['type']
                        entry['known'] = True
                        unknown.discard(key)
                        changed = True
                        break
        # Final fallback for anything still unresolved.
        for key in unknown:
            self.table[key]['type'] = 'military'

    def _count_hubs(self):
        for entry in self.table.values():
            for req in entry['requires']:
                self.hub[req] += 1

    def pick_requires(self, key, type_, age, preferred=None,
                      requires_counts=None):
        """Pick a same-age, same-type prerequisite, spreading usage.

        Only advances from the SAME age and type as the input advance are
        considered. When a usage counter is supplied the least-used candidate
        is preferred (so the same prerequisite does not clump); the curated or
        age-default `preferred` requirement wins ties, then canonical
        prerequisites; the choice is deterministically rotated by a hash of
        the advance key. Returns None if no same-age candidate exists.
        """
        candidates = [
            k for k, e in self.table.items()
            if e['type'] == type_ and e['known'] and k != key
            and e['age'] == age
        ]
        if not candidates:
            return None

        def rank(k):
            return 0 if k == preferred else 1

        def count(k):
            return (requires_counts.get(k, 0)
                    if requires_counts is not None else 0)

        candidates.sort(key=lambda k: (count(k), rank(k),
                                       -self.hub.get(k, 0), k))
        offset = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) % len(candidates)
        return candidates[offset]


def lookup_mod_map(mod_keys):
    """Return the first curated (icon, requires, category) for the block."""
    for key in mod_keys:
        if key in MOD_MAP:
            return MOD_MAP[key]
    return None


def category_family(category):
    if category.startswith('trade_'):
        return 'trade'
    if category.startswith('naval_'):
        return 'naval'
    if category in {'mil_artillery', 'mil_fire', 'mil_siege'}:
        return 'artillery'
    if category in {'mil_heavy_cav', 'mil_light_cav'}:
        return 'cavalry'
    if category.startswith(('mil_', 'levy_', 'fort_')):
        return 'military'
    if category.startswith(('econ_', 'res_', 'terrain_')):
        return 'economy'
    if category.startswith('adm_'):
        if category in {
            'adm_diplomats', 'adm_reputation', 'adm_range', 'adm_relations',
            'adm_spy', 'adm_espionage', 'adm_diplo_cost',
        }:
            return 'diplomacy'
        return 'administration'
    if category.startswith('pop_'):
        return 'culture'
    if category.startswith('est_'):
        return 'estate'
    if category.startswith('sub_'):
        return 'subject'
    if category.startswith('spec_'):
        return 'administration'
    return 'military'


def classify_field(field):
    """Classify a single modifier/effect field name.

    Domain prefixes win first; otherwise each underscore-separated segment is
    matched against the keyword sets (never the advance key, never substring
    matching), so e.g. 'clergy_estate_target_satisfaction' is an estate field
    (segment 'estate') and not administration ('state' is not a segment).
    """
    low = field.lower()
    for prefix, type_ in FIELD_PREFIX_TYPE:
        if low.startswith(prefix):
            return type_
    for seg in low.split('_'):
        if not seg:
            continue
        variants = {seg, seg.rstrip('s')} if seg.endswith('s') else {seg}
        for type_ in TYPE_PRIORITY:
            if variants & SEGMENT_KEYWORDS[type_]:
                return type_
    return None


def classify_by_keywords(entry):
    """Classify an advance from its field names by majority vote.

    Every classifiable field casts one vote; the most common type wins, ties
    broken by TYPE_PRIORITY order. This avoids one odd field (e.g. naval_range
    inside an otherwise trade-oriented advance) hijacking the whole advance.
    """
    votes = Counter()
    for field in entry['mod_keys']:
        type_ = classify_field(field)
        if type_:
            votes[type_] += 1
    if not votes:
        return None
    return max(votes, key=lambda t: (votes[t], -TYPE_PRIORITY.index(t)))


def classify_by_effects(entry):
    for field, _value in entry['fields']:
        if field.startswith('unlock_'):
            what = field[len('unlock_'):]
            if any(w in what for w in ('law', 'government', 'reform', 'parliament')):
                return 'administration'
            if 'building' in what:
                return 'economy'
            if 'ship' in what:
                return 'naval'
            if 'unit' in what or 'levy' in what:
                return 'military'
            if 'subject' in what:
                return 'subject'
        if field.startswith(('allow_', 'can_', 'may_', 'enable_')):
            if any(w in field for w in ('coloniz', 'tax')):
                return 'economy'
            if 'subject' in field:
                return 'subject'
            if any(w in field for w in ('law', 'parliament', 'government')):
                return 'administration'
    return None


def classify_entry(entry, ref):
    """Classify an input (mod) advance block."""
    type_ = classify_by_keywords(entry)
    if type_:
        return type_
    type_ = classify_by_effects(entry)
    if type_:
        return type_
    for req in entry['requires']:
        other = ref.table.get(req)
        if other and other['known']:
            return other['type']
    return 'military'


def get_age_require(age_str, family):
    """Age-appropriate vanilla requires override (old behavior)."""
    match = re.search(r'age_(\d+)_', age_str or '')
    if match:
        age_map = AGE_REQUIRES.get(int(match.group(1)), {})
        if family in age_map:
            return age_map[family]
    return None


# ── Icon picking (same type + same age rules as requirements) ───────
def choose_icon(key, primary, requirement, type_, family, age, ref,
                group_icons, icon_counts):
    """Pick an icon for `key`.

    1. Candidates: curated primary, the prerequisite's icon, then the
       family's icon pool.
    2. TYPE is a hard rule: known candidates of another type are excluded.
       AGE is a preference: same-age candidates are rank 0, cross-age
       same-type candidates rank 1 (used only when needed to avoid repeats).
    3. The pool is widened with same-age, same-type vanilla icons first
       (hub-ranked), then same-type icons of any age.
    4. Final pick: icons already used by the advance's own set (same
       potential block) are avoided first; then same-age is preferred over
       cross-age; within that, the least-used icon across the whole run is
       preferred to cut down on repetition; finally the choice is
       deterministically rotated by a hash of the advance key.
    """
    candidates = [primary, requirement, *ICON_POOLS.get(family, ())]
    candidates = [c for c in candidates if c]
    candidates = list(dict.fromkeys(candidates))

    def rank_of(candidate):
        entry = ref.table.get(candidate)
        if entry is None or not entry['known']:
            return 0  # curated/unknown: trusted, treated as same-age
        if entry['type'] != type_:
            return None  # wrong type: excluded (hard rule)
        if age and entry['age'] and entry['age'] != age:
            return 1  # same type, cross-age: allowed only to avoid repeats
        return 0  # same type + same age: preferred

    ranked = {}
    for c in candidates:
        r = rank_of(c)
        if r is not None:
            ranked[c] = r

    # Widen the pool: same-age, same-type vanilla icons first (rank 0), then
    # same-type icons of any age (rank 1), most-required advances first.
    same_age = sorted(
        (
            k for k, e in ref.table.items()
            if e['known'] and e['type'] == type_ and e['icons']
            and (not age or e['age'] == age)
        ),
        key=lambda k: (-ref.hub.get(k, 0), k),
    )
    any_age = sorted(
        (
            k for k, e in ref.table.items()
            if e['known'] and e['type'] == type_ and e['icons']
        ),
        key=lambda k: (-ref.hub.get(k, 0), k),
    )
    for rank, keys, cap in ((0, same_age, 24), (1, any_age, 12)):
        added = 0
        for k in keys:
            if added >= cap:
                break
            icon = ref.table[k]['icons'][0]
            if icon in ranked:
                continue
            ranked[icon] = rank
            added += 1

    pool = [c for c in ranked if c in ref.available_icons]
    if not pool:
        raise ValueError(
            f"No valid icon candidates for {key} ({family}, {type_})"
        )

    rotation = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    offset = rotation % len(pool)
    pool = pool[offset:] + pool[:offset]
    return min(
        pool,
        key=lambda icon: (
            icon in group_icons, ranked[icon],
            icon_counts.get(icon, 0), pool.index(icon),
        ),
    )


def seed_icon_counts(filepath, icon_counts):
    """Count existing `icon = ...` values so re-runs avoid reusing them."""
    raw = filepath.read_bytes()
    content = raw.decode('utf-8-sig').replace('\r\n', '\n')
    for match in re.finditer(r'^\s*icon\s*=\s*([A-Za-z_]\w*)', content, re.M):
        icon_counts[match.group(1)] += 1


def seed_requires_counts(filepath, requires_counts):
    """Count existing `requires = ...` values so re-runs avoid reusing them."""
    raw = filepath.read_bytes()
    content = raw.decode('utf-8-sig').replace('\r\n', '\n')
    for match in re.finditer(
            r'^\s*requires\s*=\s*([A-Za-z_]\w*)', content, re.M):
        requires_counts[match.group(1)] += 1


# ── File transformation ────────────────────────────────────────────
def transform_file(filepath, ref, options):
    raw = filepath.read_bytes()
    has_bom = raw.startswith(b'\xef\xbb\xbf')
    newline = '\r\n' if b'\r\n' in raw else '\n'
    content = raw.decode('utf-8-sig').replace('\r\n', '\n')

    do_icons = options['icons']
    do_requires = options['requires']
    key_filter = options['keys']
    tag_filter = options['tags']
    dry_run = options['dry_run']
    skip_replace = options['skip_replace']
    skip_keys = options['skip_keys']
    skip_patterns = options['skip_patterns']
    skip_tags = options['skip_tags']
    force = options['force']
    requires_counts = options['requires_counts']

    used_by_group = options['used_by_group']
    icon_counts = options['icon_counts']
    changed = 0
    output_parts = []
    cursor = 0

    for key, start, end in find_top_level_blocks(content):
        block = content[start:end]

        if skip_replace and key.startswith('REPLACE:'):
            continue

        bare_key = key.split(':', 1)[-1]
        if skip_keys and (bare_key in skip_keys or key in skip_keys):
            continue
        if skip_patterns and any(
            pat.search(bare_key) or pat.search(key)
            for pat in skip_patterns
        ):
            continue

        if key_filter and bare_key not in key_filter \
                and key not in key_filter:
            continue
        if tag_filter or skip_tags:
            block_tags = set(
                re.findall(r'has_or_had_tag\s*=\s*([A-Z]{3})', block)
            )
            if tag_filter and not (block_tags & tag_filter):
                continue
            if skip_tags and (block_tags & skip_tags):
                continue

        entry = parse_advance_block(block, key)
        if not entry['age'] and not entry['fields']:
            continue

        mapped = lookup_mod_map(entry['mod_keys'])
        if mapped:
            primary, requirement, category = mapped
            family = category_family(category)
            type_ = FAMILY_TYPE[family]
        else:
            # No curated icon anchor: build the icon pool from the inferred
            # type's family instead of the DEFAULT_MAP's military tuple.
            primary, requirement, category = None, DEFAULT_MAP[1], DEFAULT_MAP[2]
            type_ = classify_entry(entry, ref)
            family = FAMILY_FOR_TYPE[type_]
            print(
                f"  ! {key}: no curated mapping, inferred type "
                f"'{type_}' from {'/'.join(entry['mod_keys'][:3]) or 'nothing'}"
            )

        # Age-aware requires override (kept as the preferred prerequisite).
        age_require = get_age_require(entry['age'], family)
        if age_require:
            requirement = age_require

        # Spread prerequisites like icons: among same-age, same-type
        # candidates, prefer the least-used one so the same prerequisite does
        # not clump across the mod; the curated/age-default requirement only
        # wins ties.
        if do_requires and entry['age']:
            repl = ref.pick_requires(
                key, type_, entry['age'], requirement, requires_counts,
            )
            if repl:
                requirement = repl
        if do_requires:
            requires_counts[requirement] += 1

        if do_requires and entry['requires'] \
                and entry['requires'] != [requirement]:
            print(
                f"  ~ {key}: requires -> {requirement} ({type_})"
            )

        icon = None
        if do_icons and not entry['age']:
            print(
                f"  ! {key}: skipped icon matching (no age field)"
            )
        elif do_icons:
            signature = potential_signature(block, key)
            try:
                icon = choose_icon(
                    key, primary, requirement, type_, family,
                    entry['age'], ref, used_by_group[signature],
                    icon_counts,
                )
            except ValueError as exc:
                print(f"  ! {key}: {exc}")
                icon = None

        if do_icons and icon is not None:
            if entry['icons'] and icon not in entry['icons']:
                print(f"  ~ {key}: icon -> {icon} ({type_})")
            elif not entry['icons']:
                print(f"  + {key}: icon = {icon} ({type_})")

        lines = block.split('\n')
        new_lines = []
        had_icon = any(l.strip().startswith('icon = ') for l in lines)
        icon_written = False
        req_written = False
        for line in lines:
            s = line.strip()
            if do_icons and icon is not None and s.startswith('icon = '):
                if icon_written:
                    continue
                if force or icon not in entry['icons']:
                    indent = line[:len(line) - len(line.lstrip())]
                    new_lines.append(f'{indent}icon = {icon}')
                else:
                    new_lines.append(line)
                icon_written = True
                continue
            if do_requires and s.startswith('requires = '):
                if force or entry['requires'] != [requirement]:
                    indent = line[:len(line) - len(line.lstrip())]
                    new_lines.append(f'{indent}requires = {requirement}')
                else:
                    new_lines.append(line)
                req_written = True
                continue
            new_lines.append(line)
            if do_icons and icon is not None and not had_icon \
                    and not icon_written and s.startswith('age = '):
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}icon = {icon}')
                icon_written = True
            if do_requires and not req_written and s.startswith('age = ') \
                    and not any(
                        ls.strip().startswith('requires = ') for ls in lines
                    ):
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}requires = {requirement}')
                req_written = True

        new_block = '\n'.join(new_lines)

        output_parts.extend((content[cursor:start], new_block))
        cursor = end
        if do_icons and icon is not None:
            signature = potential_signature(block, key)
            used_by_group[signature].add(icon)
            icon_counts[icon] += 1
        changed += 1

    output_parts.append(content[cursor:])
    content = ''.join(output_parts)
    if not dry_run:
        # Repo convention: all files must be UTF-8 with BOM. Always write a
        # BOM, adding one when it was missing.
        output = content.replace('\n', newline).encode('utf-8')
        if content:
            output = b'\xef\xbb\xbf' + output
        filepath.write_bytes(output)
    mode = 'DRY-RUN' if dry_run else 'Done'
    if not content:
        bom_note = 'empty'
    elif has_bom:
        bom_note = 'BOM ok'
    else:
        bom_note = 'BOM ' + ('missing (would add)' if dry_run else 'ADDED')
    print(f'{mode}: {filepath} ({changed} advances processed; {bom_note})')


# ── CLI ────────────────────────────────────────────────────────────
def resolve_targets(targets):
    files, keys, tags = [], set(), set()
    for target in targets:
        path = Path(target)
        if path.suffix == '.txt' and path.is_file():
            files.append(path.resolve())
        elif re.fullmatch(r'[A-Z]{3}', target):
            tags.add(target)
        else:
            keys.add(target)
    return files, keys, tags


def main(argv=None):
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        'targets', nargs='*',
        help='files, advance keys, or 3-letter country tags (see docstring)',
    )
    parser.add_argument(
        '--dir', default=str(DEFAULT_REF_DIR),
        help=f'reference directory with {TEMPLATE_NAME} and [0-3]_*.txt '
             f'(default: {DEFAULT_REF_DIR})',
    )
    parser.add_argument('--icons', action='store_true', help='match icons only')
    parser.add_argument('--requires', action='store_true',
                        help='match prerequisites only')
    parser.add_argument('--dry-run', action='store_true',
                        help='report changes without writing files')
    parser.add_argument('--skip-replace', action='store_true',
                        help='skip advance blocks whose key starts with '
                             'REPLACE:')
    parser.add_argument('--skip-key', action='append', default=[],
                        metavar='KEY',
                        help='skip advances with this exact key (repeatable)')
    parser.add_argument('--skip-pattern', action='append', default=[],
                        metavar='REGEX',
                        help='skip advances whose key matches this regex '
                             '(repeatable)')
    parser.add_argument('--skip-tag', action='append', default=[],
                        metavar='TAG',
                        help='skip advances whose potential references this '
                             '3-letter tag (repeatable)')
    parser.add_argument('--force', action='store_true',
                        help='overwrite existing icon/requires values even '
                             'when the recomputed value is unchanged')
    args = parser.parse_args(argv)

    skip_patterns = []
    for pattern in args.skip_pattern:
        try:
            skip_patterns.append(re.compile(pattern))
        except re.error as exc:
            raise SystemExit(
                f'Invalid --skip-pattern regex {pattern!r}: {exc}'
            )

    do_icons = args.icons or not args.requires
    do_requires = args.requires or not args.icons

    files, keys, tags = resolve_targets(args.targets)
    if not files:
        files = sorted(ADVANCE_DIR.glob('abm_*.txt'))
    if not files:
        raise SystemExit('No files to process and no abm_*.txt found in '
                         f'{ADVANCE_DIR}')

    ref = Reference(args.dir)
    print(f"Reference table: {len(ref.table)} vanilla advances "
          f"from {ref.dir} ({len(ref.available_icons)} known icons)")
    print(f"Ages: {', '.join(ref.ages) or '(none parsed from template)'}")
    by_type = Counter(e['type'] for e in ref.table.values())
    print("Types: " + ', '.join(
        f"{type_}={by_type[type_]}" for type_ in TYPE_PRIORITY
        if by_type[type_]
    ))
    print(f"Actions: icons={'yes' if do_icons else 'no'}, "
          f"requires={'yes' if do_requires else 'no'}")
    if keys:
        print(f"Advance filter: {', '.join(sorted(keys))}")
    if tags:
        print(f"Tag filter: {', '.join(sorted(tags))}")
    if args.skip_key:
        print(f"Skip keys: {', '.join(sorted(set(args.skip_key)))}")
    if args.skip_pattern:
        print(f"Skip patterns: {', '.join(args.skip_pattern)}")
    if args.skip_tag:
        skip_tags_norm = sorted({t.upper() for t in args.skip_tag})
        print(f"Skip tags: {', '.join(skip_tags_norm)}")
    print()

    options = {
        'icons': do_icons,
        'requires': do_requires,
        'keys': keys or None,
        'tags': tags or None,
        'dry_run': args.dry_run,
        'skip_replace': args.skip_replace,
        'skip_keys': set(args.skip_key),
        'skip_patterns': skip_patterns,
        'skip_tags': {t.upper() for t in args.skip_tag},
        'force': args.force,
        'icon_counts': Counter(),
        'requires_counts': Counter(),
        'used_by_group': defaultdict(set),
    }
    if do_icons:
        for filepath in files:
            seed_icon_counts(filepath, options['icon_counts'])
    if do_requires:
        for filepath in files:
            seed_requires_counts(filepath, options['requires_counts'])

    for filepath in files:
        transform_file(filepath, ref, options)

    print(f"\nProcessed {len(files)} files; most-used icon appears "
          f"{max(options['icon_counts'].values(), default=0)} times")


if __name__ == '__main__':
    main(sys.argv[1:])
