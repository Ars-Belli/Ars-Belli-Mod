#!/usr/bin/env python3
"""Regenerate advance icons based on modifier-to-vanilla mapping.

Rules:
- Advance keys and prerequisites are never changed
- Icons are selected from semantically related vanilla EU5 advances
- Icon usage is balanced globally and kept unique within an idea group when possible

Usage: python .tools/update_advance_names_icons_requires.py [file ...]
    If no files are given, processes the India, Indochina, and Indonesia files.
"""

from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import re
import runpy
import sys

BASE = Path(__file__).resolve().parent.parent
ADVANCE_DIR = BASE / "in_game/common/advances"
VANILLA_ADVANCE_DIR = BASE / ".tools/eu5/advances"

# Try to import the regional mod map; skip if the file doesn't exist.
_regional_path = BASE / ".tools/update_india_advance_icons_requires.py"
if _regional_path.is_file():
    REGIONAL_MOD_MAP = runpy.run_path(str(_regional_path))["MOD_MAP"]
else:
    REGIONAL_MOD_MAP = {}
TARGET_GLOBS = (
        "abm_f4-t2_india_*.txt",
        "abm_f4-t2_indochina.txt",
        "abm_f4-t2_indonesia.txt",
)

# ── Modifier → (icon, requires, category) ──────────────────────────
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

# The regional updater contains newer modifier coverage. Keep this script's
# mapping as the baseline, then prefer the newer entries where they overlap.
MOD_MAP.update(REGIONAL_MOD_MAP)


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

# ── Category → name templates ─────────────────────────────────────
NAME_TEMPLATES = {
    'trade_export': ['export_market_charter', 'foreign_trade_office', 'merchant_export_guild'],
    'trade_import': ['import_depot_system', 'foreign_goods_monopoly', 'tribute_trade_bureau'],
    'trade_merchant': ['merchant_association', 'trade_guild_charter', 'market_network'],
    'trade_sell': ['goods_market_reform', 'trade_depot_network', 'market_licensing'],
    'trade_range': ['distant_market_expedition', 'trade_route_extension', 'caravan_charter'],
    'trade_center': ['trade_hub_privileges', 'market_city_charter', 'entrepot_decree'],

    'naval_range': ['ocean_going_fleet', 'distant_seas_command', 'blue_water_expedition'],
    'naval_offense': ['war_fleet_ordinance', 'naval_assault_doctrine', 'fleet_combat_code'],
    'naval_defense': ['armored_warships', 'naval_bulwark_formation', 'fleet_defense_screen'],
    'naval_blockade': ['blockade_squadron', 'port_stranglehold', 'coastal_blockade_corps'],
    'naval_sailors': ['mariner_conscription', 'fishing_fleet_levies', 'coastal_recruitment'],
    'naval_presence': ['coastal_haven_network', 'maritime_outpost_chain', 'sea_patrol_circuit'],
    'naval_convert': ['war_junk_refit', 'merchant_ship_conversion', 'auxiliary_fleet_program'],
    'naval_logistics': ['maritime_supply_chain', 'naval_logistics_office', 'fleet_supply_depot'],

    'mil_heavy_inf': ['heavy_infantry_reform', 'shock_regiment_code', 'armored_infantry_corps'],
    'mil_light_inf': ['light_infantry_doctrine', 'skirmisher_corps', 'mobile_infantry_tactics'],
    'mil_heavy_cav': ['heavy_cavalry_reform', 'shock_cavalry_squadron', 'armored_rider_corps'],
    'mil_light_cav': ['light_cavalry_doctrine', 'horse_archer_corps', 'mounted_scout_network'],
    'mil_artillery': ['cannon_foundry_board', 'artillery_corps_reform', 'gunpowder_ordinance_office'],
    'mil_discipline': ['military_discipline_code', 'army_regulation_reform', 'drill_field_system'],
    'mil_tradition': ['military_tradition_academy', 'army_heritage_council', 'veteran_tradition_corps'],
    'mil_speed': ['forced_march_doctrine', 'rapid_deployment_corps', 'mobile_army_reform'],
    'mil_maintenance': ['army_supply_board', 'campaign_logistics_office', 'military_provision_system'],
    'mil_morale': ['army_morale_ordinance', 'soldier_esprit_corps', 'battlefield_inspiration_code'],
    'mil_recovery': ['field_recovery_system', 'army_recuperation_camp', 'military_rest_depot'],
    'mil_attrition': ['attrition_reduction_corps', 'field_endurance_program', 'campaign_survival_doctrine'],
    'mil_manpower': ['conscription_roll_system', 'military_census_board', 'levy_registration_office'],
    'mil_hostile': ['scorched_earth_doctrine', 'hostile_terrain_defense', 'attrition_warfare_code'],
    'mil_siege': ['siege_engineer_corps', 'fortress_breach_doctrine', 'siege_warfare_bureau'],
    'mil_frontage': ['battle_line_extension', 'frontage_reform_ordinance', 'expanded_line_doctrine'],
    'mil_experience': ['veteran_cadre_system', 'military_experience_board', 'veteran_training_corps'],
    'mil_loot': ['campaign_loot_system', 'war_bounty_ordinance', 'military_plunder_code'],

    'levy_combat': ['levy_training_reform', 'militia_combat_ordinance', 'conscript_drill_system'],
    'levy_size': ['levy_expansion_edict', 'mass_conscription_board', 'militia_muster_roll'],

    'fort_limit': ['fortification_expansion', 'border_fortress_network', 'citadel_construction_board'],
    'fort_garrison': ['garrison_expansion_edict', 'fortress_guard_reform', 'citadel_defense_corps'],

    'econ_production': ['production_efficiency_edict', 'workshop_reform_bureau', 'craft_industry_charter'],
    'econ_tax': ['tax_collection_reform', 'revenue_assessment_board', 'imperial_tax_registry'],
    'econ_minting': ['imperial_mint_bureau', 'coinage_standardization', 'treasury_mint_office'],
    'econ_inflation': ['currency_stabilization', 'price_regulation_edict', 'monetary_control_board'],
    'econ_build': ['construction_efficiency_edict', 'public_works_bureau', 'building_corps_charter'],

    'res_iron': ['ironworks_expansion', 'iron_mining_charter', 'foundry_development_board'],
    'res_coal': ['coal_mine_development', 'coal_extraction_bureau', 'fuel_resource_office'],
    'res_copper': ['copper_mine_expansion', 'copper_extraction_charter', 'metal_mining_reform'],
    'res_tin': ['tin_mine_development', 'tin_extraction_bureau', 'alloy_resource_office'],
    'res_stone': ['quarry_expansion_edict', 'stone_extraction_charter', 'masonry_material_board'],
    'res_silver': ['silver_mine_development', 'silver_extraction_bureau', 'precious_metal_office'],
    'res_gold': ['gold_mine_expansion', 'gold_extraction_bureau', 'treasury_metal_charter'],
    'res_jewelry': ['jewelry_workshop_charter', 'gem_crafting_office', 'luxury_goods_bureau'],
    'res_rice': ['rice_paddy_expansion', 'grain_production_bureau', 'rice_cultivation_reform'],
    'res_food': ['food_production_edict', 'agricultural_expansion', 'granary_supply_system'],
    'res_tools': ['toolmaking_workshop', 'implement_production_office', 'tool_crafting_charter'],

    'adm_court': ['court_expenditure_reform', 'palace_efficiency_edict', 'imperial_household_bureau'],
    'adm_gov': ['government_expansion', 'state_apparatus_reform', 'administrative_extension'],
    'adm_reform': ['reform_capacity_edict', 'government_slot_charter', 'bureaucratic_expansion'],
    'adm_stability': ['stability_ordinance', 'internal_harmony_edict', 'realm_peace_bureau'],
    'adm_diplomats': ['diplomatic_corps_expansion', 'envoy_training_academy', 'foreign_mission_charter'],
    'adm_reputation': ['diplomatic_prestige_office', 'realm_reputation_bureau', 'foreign_regard_council'],
    'adm_range': ['diplomatic_outreach', 'envoy_relay_network', 'distant_diplomacy_charter'],
    'adm_annex': ['integration_chancery', 'annexation_memorial_office', 'realm_unification_board'],
    'adm_control': ['territorial_control_edict', 'provincial_oversight_bureau', 'prefectural_administration'],
    'adm_distance': ['distant_province_reform', 'capital_outreach_edict', 'peripheral_administration'],
    'adm_dev': ['development_commission', 'regional_development_board', 'provincial_growth_bureau'],
    'adm_relations': ['diplomatic_engagement', 'foreign_relations_council', 'goodwill_mission_office'],
    'adm_spy': ['intelligence_network', 'spy_corps_expansion', 'covert_operations_bureau'],
    'adm_espionage': ['counter_intelligence_office', 'internal_security_bureau', 'espionage_defense_council'],

    'pop_migration': ['migration_encouragement', 'settler_charter_edict', 'population_movement_code'],
    'pop_assimilation': ['cultural_integration_edict', 'assimilation_policy_board', 'harmony_integration_code'],
    'pop_conversion': ['conversion_mission_board', 'religious_outreach_office', 'faith_propagation_edict'],
    'pop_promotion': ['social_mobility_charter', 'class_promotion_edict', 'merit_advancement_system'],
    'pop_cultures': ['cultural_acceptance_edict', 'multi_cultural_bureau', 'diverse_customs_charter'],
    'pop_tolerance': ['religious_tolerance_edict', 'faith_harmony_ordinance', 'belief_acceptance_code'],
    'pop_health': ['public_health_ordinance', 'plague_prevention_bureau', 'medical_relief_system'],
    'pop_growth': ['population_growth_edict', 'demographic_expansion', 'settlement_encouragement'],
    'pop_literacy': ['literacy_expansion_edict', 'scholarly_education_board', 'learning_promotion_code'],
    'pop_urban': ['urban_attraction_charter', 'city_migration_edict', 'town_settlement_code'],
    'pop_prosperity': ['prosperity_encouragement', 'welfare_development_edict', 'common_wealth_charter'],

    'est_noble_tax': ['noble_taxation_edict', 'aristocratic_revenue_reform', 'gentry_fiscal_charter'],
    'est_burgher_tax': ['burgher_taxation_code', 'merchant_revenue_edict', 'urban_fiscal_charter'],
    'est_noble_levy': ['noble_levy_obligation', 'aristocratic_muster_roll', 'gentry_military_service'],
    'est_noble_power': ['noble_power_curtailment', 'aristocratic_regulation', 'gentry_influence_reform'],
    'est_burgher_power': ['burgher_power_regulation', 'merchant_influence_reform', 'urban_estate_charter'],
    'est_satisfaction': ['estate_harmony_edict', 'realm_satisfaction_code', 'social_balance_charter'],
    'est_recovery': ['estate_recovery_edict', 'social_reconciliation', 'harmony_restoration_bureau'],
    'est_max_tax': ['maximum_taxation_edict', 'estate_fiscal_code', 'universal_tax_charter'],
    'est_noble_city': ['noble_urban_presence', 'aristocratic_city_charter', 'gentry_town_residence'],
    'est_noble_rural': ['noble_rural_dominance', 'aristocratic_countryside', 'gentry_land_charter'],
    'est_soldier_city': ['soldier_urban_quarter', 'garrison_city_district', 'military_town_charter'],
    'est_soldier_rural': ['soldier_rural_settlement', 'veteran_land_grant', 'military_colony_system'],

    'sub_loyalty': ['subject_loyalty_edict', 'tributary_fidelity_code', 'vassal_allegiance_bureau'],
    'sub_income': ['tributary_revenue_system', 'vassal_taxation_office', 'subject_income_charter'],
    'sub_opinion': ['subject_relations_bureau', 'tributary_diplomacy_office', 'vassal_goodwill_council'],

    'spec_research': ['research_advancement', 'scholarly_innovation_office', 'learning_acceleration'],
    'spec_combined': ['combined_bonus_system', 'synergy_development_edict', 'integrated_advancement'],
    'spec_unlock_reform': ['reform_unlock_charter', 'government_innovation_edict', 'reform_path_ordinance'],
    'spec_unlock_subject': ['subject_type_unlock', 'vassal_innovation_charter', 'dependency_expansion_code'],

    'terrain_rgo': ['rgo_expansion_edict', 'resource_zone_development', 'land_use_optimization'],
    'terrain_road': ['road_construction_corps', 'highway_development_office', 'imperial_road_network'],
    'terrain_road_cost': ['road_cost_reduction', 'highway_efficiency_edict', 'road_building_reform'],
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


def get_age_require(age_str, family):
    """Return age-appropriate vanilla requires, falling back to the
    hardcoded MOD_MAP value if the age isn't covered."""
    match = re.search(r'age_(\d+)_', age_str)
    if match:
        age_num = int(match.group(1))
        age_map = AGE_REQUIRES.get(age_num, {})
        if family in age_map:
            return age_map[family]
    return None


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


def find_top_level_blocks(text):
    for match in re.finditer(
        r'(?m)^([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*\{', text
    ):
        depth = 0
        for index in range(match.end() - 1, len(text)):
            if text[index] == '{':
                depth += 1
            elif text[index] == '}':
                depth -= 1
                if depth == 0:
                    yield match.group(1), match.start(), index + 1
                    break


def extract_modifiers(block_text):
    mods = []
    for line in block_text.split('\n'):
        s = line.strip()
        if not s or s.startswith('#'):
            continue
        if any(s.startswith(p) for p in ['age ', 'icon ', 'potential ',
                                          'requires ', 'OR =', 'has_or_had',
                                          'culture ', '}', '{']):
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


def load_vanilla_icons():
    icons = set()
    for filepath in VANILLA_ADVANCE_DIR.glob("*.txt"):
        text = filepath.read_text(encoding="utf-8-sig")
        icons.update(re.findall(r'(?m)^\s*icon\s*=\s*(\S+)', text))
    if not icons:
        raise RuntimeError(f"No vanilla icons found in {VANILLA_ADVANCE_DIR}")
    return icons


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


def potential_signature(block_text, key):
    match = re.search(r'(?m)^\s*potential\s*=\s*\{', block_text)
    if not match:
        return key
    depth = 0
    for index in range(match.end() - 1, len(block_text)):
        if block_text[index] == '{':
            depth += 1
        elif block_text[index] == '}':
            depth -= 1
            if depth == 0:
                return re.sub(r'\s+', '', block_text[match.start():index + 1])
    return key


def choose_icon(key, primary, requirement, category, available_icons,
                icon_counts, group_icons):
    family = category_family(category)
    candidates = [primary, requirement, *ICON_POOLS[family]]
    candidates = list(dict.fromkeys(
        candidate for candidate in candidates if candidate in available_icons
    ))
    if not candidates:
        raise ValueError(f"No valid icon candidates for {key} ({category})")

    rotation = int(hashlib.sha256(key.encode()).hexdigest()[:8], 16)
    offset = rotation % len(candidates)
    candidates = candidates[offset:] + candidates[:offset]
    return min(
        candidates,
        key=lambda icon: (icon in group_icons, icon_counts[icon], candidates.index(icon)),
    )


def transform_file(filepath, available_icons, icon_counts):
    raw = filepath.read_bytes()
    has_bom = raw.startswith(b'\xef\xbb\xbf')
    newline = '\r\n' if b'\r\n' in raw else '\n'
    content = raw.decode('utf-8-sig').replace('\r\n', '\n')
    used_by_group = defaultdict(set)
    changed = 0
    output_parts = []
    cursor = 0

    for key, start, end in find_top_level_blocks(content):
        block = content[start:end]
        mods = extract_modifiers(block)
        if not mods:
            continue

        primary, requirement, category = get_mod_mapping(mods)
        signature = potential_signature(block, key)
        family = category_family(category)

        # Extract age for age-aware requires
        age_match = re.search(r'(?m)^\s*age\s*=\s*(\S+)', block)
        age_str = age_match.group(1) if age_match else ''
        age_require = get_age_require(age_str, family)
        if age_require:
            requirement = age_require

        icon = choose_icon(
            key, primary, requirement, category, available_icons,
            icon_counts, used_by_group[signature],
        )

        lines = block.split('\n')
        new_lines = []
        had_icon = any(line.strip().startswith('icon = ') for line in lines)
        icon_written = False
        req_written = False
        for line in lines:
            s = line.strip()
            if s.startswith('icon = '):
                if icon_written:
                    continue
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}icon = {icon}')
                icon_written = True
                continue
            if s.startswith('requires = '):
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}requires = {requirement}')
                req_written = True
                continue
            new_lines.append(line)
            if not had_icon and not icon_written and s.startswith('age = '):
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}icon = {icon}')
                icon_written = True
            # If no requires line exists, insert one after age line
            if not req_written and s.startswith('age = ') and not any(
                ls.strip().startswith('requires = ') for ls in lines
            ):
                indent = line[:len(line) - len(line.lstrip())]
                new_lines.append(f'{indent}requires = {requirement}')
                req_written = True

        new_block = '\n'.join(new_lines)
        if not icon_written:
            raise ValueError(f"Advance {key} has neither an icon nor an age field in {filepath}")
        output_parts.extend((content[cursor:start], new_block))
        cursor = end
        used_by_group[signature].add(icon)
        icon_counts[icon] += 1
        changed += 1

    output_parts.append(content[cursor:])
    content = ''.join(output_parts)
    output = content.replace('\n', newline).encode('utf-8')
    if has_bom:
        output = b'\xef\xbb\xbf' + output
    filepath.write_bytes(output)
    print(f'Done: {filepath} ({changed} icons)')


if __name__ == '__main__':
    if len(sys.argv) > 1:
        files = [Path(arg).resolve() for arg in sys.argv[1:]]
    else:
        files = sorted({
            filepath
            for pattern in TARGET_GLOBS
            for filepath in ADVANCE_DIR.glob(pattern)
        })

    available_icons = load_vanilla_icons()
    icon_counts = Counter()
    for filepath in files:
        transform_file(filepath, available_icons, icon_counts)

    print(
        f"\nProcessed {len(files)} files using {len(icon_counts)} distinct icons; "
        f"most-used icon appears {max(icon_counts.values(), default=0)} times"
    )
