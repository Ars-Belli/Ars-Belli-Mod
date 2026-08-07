#!/usr/bin/env python3
"""Update advance icons and requires for India advances.

Rules:
- Mod advances never require each other (only vanilla prerequisites)
- Traditions and ambitions keep their names (only icon/requires updated)
- Middle advances keep their EU4-derived names (only icon/requires updated)
- Every icon within a tag is unique
- Requires are age-appropriate vanilla advances

Usage: python .tools/update_india_advance_icons_requires.py [file ...]
  If no files given, processes all in_game/common/advances/abm_*.txt
"""

import re, sys, random
from pathlib import Path

random.seed(42)

BASE = Path(__file__).resolve().parent.parent
ADVANCE_DIR = BASE / "in_game/common/advances"

# ── Modifier → (icon, requires, category) ──────────────────────────
MOD_MAP = {
    # Trade
    'export_efficiency': ('red_sea_trade', 'guilds', 'trade_export'),
    'import_efficiency': ('saharan_gold_trade', 'guilds', 'trade_import'),
    'global_merchant_capacity_modifier': ('merchants_and_trade', 'global_trade_advance', 'trade_merchant'),
    'selling_efficiency': ('global_trade_advance', 'merchants_and_trade', 'trade_sell'),
    'trade_range_modifier': ('global_trade_routes_advance', 'trade_range_advance_age_2', 'trade_range'),
    'global_trade_center_power': ('free_merchants', 'trade_range_advance_age_2', 'trade_center'),
    'global_merchant_power': ('free_merchants', 'trade_range_advance_age_2', 'trade_center'),
    'trade_income': ('merchants_and_trade', 'global_trade_advance', 'trade_merchant'),
    'trade_sea_efficiency': ('red_sea_trade', 'guilds', 'trade_export'),
    'trade_land_efficiency': ('saharan_gold_trade', 'guilds', 'trade_import'),
    'merchant_maintenance_efficiency': ('merchants_and_trade', 'global_trade_advance', 'trade_merchant'),
    'caravan_power': ('saharan_gold_trade', 'guilds', 'trade_land'),

    # Naval
    'naval_range_modifier': ('royal_navy', 'trade_range_advance_age_2', 'naval_range'),
    'naval_damage_done': ('glorious_arms', 'naval_morale_advance_1', 'naval_offense'),
    'naval_damage_taken': ('defensive_army', 'boarding_parties', 'naval_defense'),
    'blockade_efficiency': ('gunpowder_advance', 'naval_morale_advance_1', 'naval_blockade'),
    'global_sailors_modifier': ('nor_bounties_of_the_sea', 'trade_range_advance_age_2', 'naval_sailors'),
    'global_maritime_presence_modifier': ('colonies', 'colonial_charters', 'naval_presence'),
    'can_convert_galleys_to_light': ('letters_of_marque', 'naval_morale_advance_1', 'naval_convert'),
    'sea_cost_on_distance_from_capital_when_maritime': ('expansionism', 'boarding_parties', 'naval_logistics'),
    'navy_maintenance_efficiency': ('royal_navy', 'boarding_parties', 'naval_maintenance'),
    'naval_morale_modifier': ('glorious_arms', 'naval_morale_advance_1', 'naval_morale'),
    'global_naval_engagement_modifier': ('royal_navy', 'naval_morale_advance_1', 'naval_range'),
    'sailor_maintenance_modifier': ('nor_bounties_of_the_sea', 'trade_range_advance_age_2', 'naval_sailors'),

    # Military
    'army_heavy_infantry_power': ('glorious_arms', 'pike_square', 'mil_heavy_inf'),
    'army_light_infantry_power': ('glorious_arms', 'pike_and_shot_advance', 'mil_light_inf'),
    'army_heavy_cavalry_power': ('glorious_arms', 'horse_riding_advance', 'mil_heavy_cav'),
    'army_light_cavalry_power': ('glorious_arms', 'horse_riding_advance', 'mil_light_cav'),
    'army_artillery_power': ('artillery_institution_advance', 'unlock_chambered_cannon_advance', 'mil_artillery'),
    'army_fire_damage': ('gunpowder_advance', 'unlock_chambered_cannon_advance', 'mil_fire'),
    'army_shock_damage': ('glorious_arms', 'pike_square', 'mil_shock'),
    'army_fire_damage_received': ('defensive_army', 'fortification_advance', 'mil_defense'),
    'army_shock_damage_received': ('defensive_army', 'fortification_advance', 'mil_defense'),
    'discipline': ('army_professionalism', 'drill_army_advance', 'mil_discipline'),
    'army_tradition': ('army_professionalism', 'drill_army_advance', 'mil_tradition'),
    'monthly_army_tradition': ('army_professionalism', 'drill_army_advance', 'mil_tradition'),
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
    'global_defensive': ('defensive_army', 'fortification_advance', 'mil_defense'),
    'army_initiative': ('drill_army_advance', 'army_professionalism', 'mil_speed'),
    'military_tactics': ('army_professionalism', 'drill_army_advance', 'mil_discipline'),
    'movement_speed_if_no_road': ('drill_army_advance', 'road_building', 'mil_speed'),

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
    'global_urban_build_buildings_efficiency': ('city_building_advance', 'construction_speed_renaissance', 'econ_build'),
    'global_rural_build_buildings_efficiency': ('construction_speed_renaissance', 'rgo_logistics_discovery', 'econ_build'),
    'hire_advisor_cost_modifier': ('smooth_administration', 'regulate_court_procedures', 'econ_advisor'),
    'interest_modifier': ('debt_and_loans', 'counting_house_advance', 'econ_interest'),
    'state_maintenance_cost': ('smooth_administration', 'legalism_advance', 'adm_gov'),

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
    'global_cloth_output_modifier': ('artists_advance', 'merchants_and_trade', 'res_cloth'),
    'global_tea_output_modifier': ('agriculture_advance', 'construction_speed_renaissance', 'res_tea'),
    'global_spice_output_modifier': ('red_sea_trade', 'merchants_and_trade', 'res_spice'),
    'global_max_rgo_size_modifier': ('agriculture_advance', 'rgo_logistics_discovery', 'res_rgo'),
    'global_max_rgo_size_modifier_in_non_rural': ('agriculture_advance', 'rgo_logistics_discovery', 'terrain_rgo'),

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
    'diplomatic_spending_cost': ('court_accounting', 'formalized_relations', 'adm_diplo_cost'),
    'monthly_devotion': ('church_councils', 'organized_religion', 'adm_devotion'),
    'monthly_legitimacy': ('crown_power_advance_renaissance', 'legalism_advance', 'adm_legitimacy'),
    'monthly_republican_tradition': ('smooth_administration', 'distribution_of_power_advance', 'adm_republican'),
    'monthly_horde_unity': ('smooth_administration', 'distribution_of_power_advance', 'adm_horde'),
    'monthly_tribal_cohesion': ('smooth_administration', 'distribution_of_power_advance', 'adm_tribal'),
    'monthly_prestige': ('smooth_administration', 'legalism_advance', 'adm_prestige'),
    'monthly_war_exhaustion': ('smooth_administration', 'legalism_advance', 'adm_war_exhaustion'),
    'global_unrest': ('smooth_administration', 'legalism_advance', 'adm_unrest'),
    'institution_spread_modifier': ('library_advance', 'modern_bureaucracy', 'adm_institution'),
    'absorb_institutions_cost_modifier': ('library_advance', 'modern_bureaucracy', 'adm_institution'),

    # Population/Culture
    'global_migration_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_migration'),
    'global_pop_assimilation_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_assimilation'),
    'global_pop_conversion_speed_modifier': ('church_councils', 'organized_religion', 'pop_conversion'),
    'global_pop_promotion_speed_modifier': ('cultural_acceptance_advance', 'cultural_traditions_law_advance', 'pop_promotion'),
    'cultures_capacity': ('cultural_acceptance_advance', 'cultural_acceptance_advance', 'pop_cultures'),
    'tolerance_own': ('church_councils', 'organized_religion', 'pop_tolerance'),
    'tolerance_heathen': ('church_councils', 'organized_religion', 'pop_tolerance'),
    'tolerance_heretic': ('church_councils', 'organized_religion', 'pop_tolerance'),
    'global_life_expectancy': ('church_councils', 'pharmacology_advance', 'pop_health'),
    'global_disease_resistance': ('church_councils', 'pharmacology_advance', 'pop_health'),
    'global_population_growth': ('agriculture_advance', 'construction_speed_renaissance', 'pop_growth'),
    'global_max_literacy': ('library_advance', 'cultural_traditions_law_advance', 'pop_literacy'),
    'non_rural_migration_attraction': ('city_building_advance', 'construction_speed_renaissance', 'pop_urban'),
    'global_monthly_prosperity': ('agriculture_advance', 'construction_speed_renaissance', 'pop_prosperity'),
    'pop_join_rebel_threshold': ('smooth_administration', 'legalism_advance', 'pop_rebel'),

    # Estates
    'nobles_estate_max_tax': ('crown_power_advance_renaissance', 'feudalism_advance', 'est_noble_tax'),
    'burghers_estate_max_tax': ('crown_power_advance_renaissance', 'guilds', 'est_burgher_tax'),
    'nobles_estate_levy_size': ('crown_power_advance_renaissance', 'feudalism_advance', 'est_noble_levy'),
    'global_nobles_estate_power': ('crown_power_advance_renaissance', 'distribution_of_power_advance', 'est_noble_power'),
    'global_burghers_estate_power': ('crown_power_advance_renaissance', 'distribution_of_power_advance', 'est_burgher_power'),
    'global_estate_target_satisfaction': ('smooth_administration', 'regulate_court_procedures', 'est_satisfaction'),
    'global_estate_satisfaction_recovery': ('smooth_administration', 'regulate_court_procedures', 'est_recovery'),
    'global_estate_max_tax': ('court_accounting', 'regulate_court_procedures', 'est_max_tax'),
    'clergy_estate_target_satisfaction': ('church_councils', 'organized_religion', 'est_clergy_sat'),
    'clergy_estate_levy_size': ('church_councils', 'feudalism_advance', 'est_clergy_levy'),

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

    # Upgrades
    'town_upgrade_cost_modifier': ('city_building_advance', 'construction_speed_renaissance', 'econ_build'),
    'city_upgrade_cost_modifier': ('city_building_advance', 'construction_speed_renaissance', 'econ_build'),
    'megalopolis_upgrade_cost_modifier': ('city_building_advance', 'construction_speed_renaissance', 'econ_build'),
}


def find_block(text, key):
    escaped = re.escape(key)
    m = re.search(escaped + r'\s*=\s*\{', text)
    if not m:
        return None, None
    start = m.start()
    depth, i = 0, m.end() - 1
    while i < len(text):
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    return None, None


def extract_modifiers(block_text):
    mods = []
    for line in block_text.split('\n'):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if any(s.startswith(p) for p in ['age ', 'icon ', 'potential ',
                                          'requires ', 'OR =', 'has_or_had',
                                          'culture ', 'original_capital',
                                          '}', '{']):
            continue
        if '=' in s:
            mods.append(s)
    return mods


def get_mod_mapping(modifiers):
    for mod_line in modifiers:
        mod_key = mod_line.strip().split('=')[0].strip().split()[0]
        if mod_key in MOD_MAP:
            return MOD_MAP[mod_key]
    return ('glorious_arms', 'feudalism_advance', 'mil_generic')


def transform_file(filepath):
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    all_keys = re.findall(r'^(abm_\w+) = \{', content, re.MULTILINE)
    # Also catch non-abm_ keys used in some files
    all_keys += re.findall(r'^((?!abm_)[a-z]+_[a-z_]+) = \{', content, re.MULTILINE)
    # Filter out non-advance keys (like requires lines inside blocks)
    all_keys = [k for k in all_keys if 'advance' not in k and ' =' not in k]

    for old_key in set(all_keys):
        start, end = find_block(content, old_key)
        if start is None:
            continue

        block = content[start:end]
        mods = extract_modifiers(block)
        if not mods:
            continue

        icon, req, cat = get_mod_mapping(mods)

        # Process line by line
        lines = block.split('\n')
        new_lines = []
        for line in lines:
            s = line.strip()
            if s.startswith('icon = '):
                indent = line[:len(line) - len(line.lstrip())]
                line = f'{indent}icon = {icon}'
            elif s.startswith('requires = ') and 'abm_' in s:
                indent = line[:len(line) - len(line.lstrip())]
                line = f'{indent}requires = {req}'
            new_lines.append(line)

        new_block = '\n'.join(new_lines)
        content = content[:start] + new_block + content[end:]

    with open(filepath, 'w', encoding="utf-8") as f:
        f.write(content)
    print(f'Done: {filepath}')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        files = sorted(ADVANCE_DIR.glob("abm_*.txt"))
    else:
        files = [Path(f) for f in sys.argv[1:]]

    for f in files:
        transform_file(str(f))
    print(f"\nProcessed {len(files)} file(s)")
