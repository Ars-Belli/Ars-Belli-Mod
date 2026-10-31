#!/usr/bin/env python3
"""
Deep semantic matching of EU4 ↔ EU5 modifiers.

Strategy:
  1. Word-level name matching (high/medium confidence)
  2. Comprehensive manual concept mappings
  3. Each EU5 modifier can have multiple EU4 matches → multiple output rows

Reads from the clean deduplicated base CSV.
"""

import csv
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
CSV_IN = SCRIPT_DIR / "eu4_vs_eu5_advances4_clean.csv"  # clean dedup base
CSV_OUT = SCRIPT_DIR / "eu4_vs_eu5_advances4_merged.csv"

# ═══════════════════════════════════════════════════════════════
# MANUAL MAPPINGS  (EU5_modifier → [(EU4_modifier, confidence), ...])
# ═══════════════════════════════════════════════════════════════

MANUAL_MAP: dict[str, list[tuple[str, str]]] = {

    # ── INSTITUTIONS ──
    "absorb_institutions_cost_modifier": [("embracement_cost", "high")],
    "embrace_institution_cost_modifier": [("embracement_cost", "high")],
    "global_institution_growth_modifier": [("global_institution_spread", "high")],
    "institution_growth": [("global_institution_spread", "medium")],

    # ── DIPLOMACY ──
    "accept_subjugation_reasons": [("accept_vassalization_reasons", "high")],
    "reject_subjugation_reasons": [("accept_vassalization_reasons", "low")],
    "aggressiveness_modifier": [("ae_impact", "high")],
    "diplomatic_reputation": [("diplomatic_reputation", "high")],
    "diplomatic_capacity": [("diplomatic_upkeep", "high")],
    "diplomatic_capacity_modifier": [("diplomatic_upkeep", "high")],
    "diplomatic_range": [("range", "medium")],
    "diplomatic_range_modifier": [("range", "medium")],
    "improve_relation_impact": [("improve_relation_modifier", "high")],
    "diplomatic_annexation_efficiency": [("diplomatic_annexation_cost", "high")],
    "hostile_diplomatic_annexation_efficiency": [("diplomatic_annexation_cost", "medium")],
    "global_war_score_efficiency": [("province_warscore_cost", "medium")],
    "global_integration_speed_modifier": [("diplomatic_annexation_cost", "medium")],
    "annexation_speed_base": [("diplomatic_annexation_cost", "medium")],
    "annexation_speed_modifier": [("diplomatic_annexation_cost", "medium")],
    "diplomatic_upkeep_efficiency": [("diplomatic_upkeep", "medium")],
    "diplomatic_spending_cost": [("diplomatic_upkeep", "low")],
    "max_diplomats": [("diplomats", "high")],
    "monthly_diplomats": [("diplomats", "medium")],
    "casus_belli_creation_speed": [("fabricate_claims_cost", "medium")],
    "casus_belli_creation_speed_modifier": [("fabricate_claims_cost", "medium")],
    "spy_network_construction": [("spy_offence", "high")],
    "counter_espionage": [("global_spy_defence", "high")],
    "declare_independence_war_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "declaring_war_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_breaking_truce_cost_modifier": [("stability_cost_to_declare_war", "medium")],
    "war_no_cb_cost_modifier": [("stability_cost_to_declare_war", "medium")],
    "war_good_relations_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_great_relations_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_on_different_religion_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_on_same_religion_cb_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_on_same_religion_no_cb_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_on_subject_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_when_military_acces_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "war_breaking_truce_with_guarantor_cost_modifier": [("stability_cost_to_declare_war", "low")],
    "expected_warscore_modifier": [("province_warscore_cost", "low")],
    "lack_of_control_impact_on_warscore": [("province_warscore_cost", "low")],
    "war_score_vs_other_religion_efficiency": [("warscore_cost_vs_other_religion", "medium")],
    "scaled_lost_war_cost_modifier": [("war_exhaustion", "low")],

    # ── SUBJECTS ──
    "subject_income_modifier": [("vassal_income", "high")],
    "subject_loyalty": [("liberty_desire", "medium")],
    "subject_opinions": [("reduced_liberty_desire", "medium")],
    "subject_pays_colonial_cost_modifier": [("global_tariffs", "medium")],
    "subject_pays_maha_samanta_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_march_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_pradhana_maha_samanta_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_pronoia_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_samanta_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_trade_company_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_tributary_cost_modifier": [("vassal_income", "medium")],
    "subject_pays_vassal_cost_modifier": [("vassal_income", "high")],
    "payment_to_overlord_modifier": [("vassal_income", "medium")],
    "loyalty_to_overlord": [("liberty_desire", "medium")],
    "uc_bey_pays_cost_modifier": [("vassal_income", "medium")],

    # ── CULTURE ──
    "add_accepted_culture_cost_modifier": [("promote_culture_cost", "high")],
    "add_tolerated_culture_cost_modifier": [("promote_culture_cost", "medium")],
    "remove_accepted_culture_cost_modifier": [("promote_culture_cost", "low")],
    "remove_tolerated_culture_cost_modifier": [("promote_culture_cost", "low")],
    "cultures_capacity": [("num_accepted_cultures", "high")],
    "cultures_capacity_modifier": [("num_accepted_cultures", "high")],
    "change_primary_culture_cost_modifier": [("promote_culture_cost", "low")],
    "language_change_threshold_modifier": [("culture_conversion_cost", "low")],

    # ── RELIGION ──
    "tolerance_own": [("tolerance_own", "high")],
    "tolerance_heretic": [("tolerance_heretic", "high")],
    "tolerance_heathen": [("tolerance_heathen", "high")],
    "global_pop_conversion_speed": [("global_missionary_strength", "medium")],
    "global_pop_conversion_speed_modifier": [("global_missionary_strength", "medium")],
    "global_heathen_pop_conversion_speed_modifier": [("global_heathen_missionary_strength", "medium")],
    "global_heretic_pop_conversion_speed_modifier": [("global_heretic_missionary_strength", "medium")],
    "building_missionary_effort": [("global_missionary_strength", "medium")],
    "building_missionary_effort_modifier": [("global_missionary_strength", "medium")],
    "maximum_religious_influence": [("religious_unity", "low")],
    "monthly_religious_influence": [("religious_unity", "low")],
    "monthly_papal_authority": [("papal_influence", "high")],
    "papal_authority_modifier": [("papal_influence", "medium")],
    "monthly_church_power": [("monthly_church_power", "high")],
    "monthly_fervor_increase": [("monthly_fervor_increase", "high")],
    "monthly_piety": [("monthly_piety", "high")],
    "monthly_karma": [("monthly_karma", "high")],
    "monthly_karma_decay": [("yearly_karma_decay", "medium")],
    "monthly_harmony": [("yearly_harmony", "high")],
    "monthly_devotion": [("devotion", "high")],
    "monthly_horde_unity": [("horde_unity", "high")],
    "monthly_legitimacy": [("legitimacy", "high")],
    "monthly_republican_tradition": [("republican_tradition", "high")],
    "monthly_doom": [("yearly_doom_reduction", "medium")],
    "monthly_imperial_authority": [("imperial_authority_value", "high")],
    "imperial_authority_modifier": [("imperial_authority", "high")],
    "monthly_celestial_authority": [("imperial_mandate", "medium")],
    "monthly_reform_desire": [("monthly_fervor_increase", "low")],

    # ── PRESTIGE / STABILITY ──
    "monthly_prestige": [("prestige", "high")],
    "prestige_decay": [("prestige_decay", "high")],
    "prestige_from_land_battle": [("prestige_from_land", "high")],
    "prestige_from_naval_battle": [("prestige_from_naval", "high")],
    "stability_cost_efficiency": [("stability_cost_modifier", "high")],
    "stability_decay": [("stability_cost_modifier", "low")],
    "stability_investment": [("stability_cost_modifier", "medium")],

    # ── UNREST / REBELS / WAR EXHAUSTION ──
    "global_unrest": [("global_unrest", "high")],
    "global_separatism": [("years_of_nationalism", "high")],
    "global_rebel_suppression_efficiency": [("global_rebel_suppression_efficiency", "high")],
    "monthly_rebel_growth": [("global_unrest", "medium")],
    "monthly_nationalist_rebel_growth": [("global_unrest", "medium")],
    "monthly_religious_rebel_growth": [("global_unrest", "medium")],
    "monthly_pretender_rebel_growth": [("global_unrest", "medium")],
    "monthly_slave_rebel_growth": [("global_unrest", "medium")],
    "pop_join_rebel_threshold": [("global_unrest", "low")],
    "pop_leave_rebels_threshold": [("global_unrest", "low")],
    "rebel_monthly_progress": [("global_unrest", "low")],
    "negotiate_rebels_buy_off_price_cost_modifier": [("harsh_treatment_cost", "low")],
    "monthly_war_exhaustion": [("war_exhaustion", "high")],
    "max_war_exhaustion": [("war_exhaustion_cost", "low")],
    "war_declaration_stab_hit_tolerance": [("stability_cost_to_declare_war", "medium")],
    "war_declaration_war_exhaustion_tolerance": [("war_exhaustion", "low")],

    # ── GOVERNMENT ──
    "horde_unity_hit_at_ruler_death": [("horde_unity", "low")],
    "monthly_towards_absolutism": [("yearly_absolutism", "high")],
    "monthly_towards_centralization": [("yearly_absolutism", "low")],
    "government_reform_slots": [("possible_policy", "low")],
    "parliament_base_support": [("parliament_backing_chance", "medium")],
    "parliament_duration_modifier": [("parliament_debate_duration", "medium")],

    # ── ECONOMY ──
    "tax_income_efficiency": [("global_tax_modifier", "high")],
    "global_production_efficiency": [("production_efficiency", "high")],
    "global_raw_material_output": [("production_efficiency", "medium")],
    "global_construction_speed": [("build_time", "high")],
    "global_build_buildings_efficiency": [("build_cost", "medium")],
    "global_building_establishment_speed": [("build_time", "medium")],
    "bank_interest": [("interest", "high")],
    "bond_interest": [("interest", "medium")],
    "monthly_inflation": [("inflation_reduction", "low")],
    "minting_income_factor": [("inflation_reduction", "low")],
    "minting_inflation_threshold": [("inflation_reduction", "low")],
    "global_monthly_development": [("development_cost", "medium")],
    "global_monthly_prosperity": [("global_prosperity_growth", "medium")],
    "global_prosperity_decay": [("global_prosperity_growth", "low")],
    "global_devastation_recovery": [("global_monthly_devastation", "low")],
    "global_population_growth": [("global_colonial_growth", "low")],
    "monthly_gold_income": [("global_tax_income", "low")],
    "monthly_gold_expense": [("global_tax_income", "low")],

    # ── TRADE ──
    "trade_income": [("trade_efficiency", "high")],
    "global_merchant_power": [("global_trade_power", "high")],
    "global_merchant_capacity_modifier": [("merchants", "medium")],
    "global_trade_center_power": [("global_prov_trade_power_modifier", "medium")],
    "global_trade_protection_factor": [("global_own_trade_power", "medium")],
    "export_efficiency": [("trade_efficiency", "medium")],
    "import_efficiency": [("trade_efficiency", "medium")],
    "selling_efficiency": [("trade_efficiency", "medium")],
    "trade_land_efficiency": [("trade_efficiency", "medium")],
    "trade_sea_efficiency": [("trade_efficiency", "medium")],
    "trade_range": [("trade_range_modifier", "high")],
    "trade_range_modifier": [("trade_range_modifier", "high")],
    "merchant_power_from_maritime": [("global_ship_trade_power", "medium")],
    "merchant_power_from_maritime_modifier": [("global_ship_trade_power", "medium")],
    "foreign_export_from_market_efficiency": [("global_foreign_trade_power", "medium")],

    # ── COLONIZATION ──
    "colonial_range": [("range", "high")],
    "colonial_range_modifier": [("range", "high")],
    "colonial_maintenance_efficiency": [("colony_cost_modifier", "high")],
    "colonial_migration_size": [("global_colonial_growth", "high")],
    "colonial_migration_size_modifier": [("global_colonial_growth", "high")],
    "exploration_maintenance_efficiency": [("colony_cost_modifier", "medium")],
    "exploration_mission_speed": [("colonist_placement_chance", "low")],
    "exploration_mission_speed_modifier": [("colonist_placement_chance", "low")],
    "can_colonize": [("colonists", "high")],
    "can_invite_settlers": [("colonists", "medium")],
    "may_explore": [("may_explore", "high")],
    "allow_conquistadors": [("may_explore", "high")],
    "allow_open_sea_exploration": [("may_explore", "medium")],
    "can_recruit_explorer": [("may_explore", "high")],

    # ── RESEARCH / TECH ──
    "research_speed": [("technology_cost", "high")],
    "research_speed_modifier": [("technology_cost", "high")],

    # ═══ MILITARY: Unit type power ═══
    "army_heavy_infantry_power": [
        ("infantry_power", "high"), ("infantry_shock", "medium"),
        ("infantry_fire", "medium"), ("shock_damage", "low"), ("fire_damage", "low"),
    ],
    "army_light_infantry_power": [
        ("infantry_power", "high"), ("infantry_shock", "medium"),
        ("infantry_fire", "medium"), ("shock_damage", "low"), ("fire_damage", "low"),
    ],
    "army_heavy_cavalry_power": [
        ("cavalry_power", "high"), ("cavalry_shock", "medium"),
        ("cavalry_fire", "medium"), ("shock_damage", "low"),
    ],
    "army_light_cavalry_power": [
        ("cavalry_power", "high"), ("cavalry_shock", "medium"),
        ("cavalry_fire", "medium"), ("shock_damage", "low"),
    ],
    "army_artillery_power": [
        ("artillery_power", "high"), ("artillery_fire",
                                      "medium"), ("fire_damage", "low"),
    ],
    "army_auxiliary_power": [
        ("infantry_power", "medium"), ("shock_damage", "low"), ("fire_damage", "low"),
    ],
    "navy_heavy_ship_power": [("heavy_ship_power", "high")],
    "navy_light_ship_power": [("light_ship_power", "high")],
    "navy_galley_power": [("galley_power", "high")],
    "navy_transport_power": [("transport_power", "high")],

    # ═══ MILITARY: Unit type build cost ═══
    "army_heavy_infantry_build_cost_modifier": [("infantry_cost", "high"), ("global_regiment_cost", "medium")],
    "army_light_infantry_build_cost_modifier": [("infantry_cost", "high"), ("global_regiment_cost", "medium")],
    "army_heavy_cavalry_build_cost_modifier": [("cavalry_cost", "high"), ("global_regiment_cost", "medium")],
    "army_light_cavalry_build_cost_modifier": [("cavalry_cost", "high"), ("global_regiment_cost", "medium")],
    "army_artillery_build_cost_modifier": [("artillery_cost", "high"), ("global_regiment_cost", "medium")],
    "army_auxiliary_build_cost_modifier": [("global_regiment_cost", "medium")],
    "navy_heavy_ship_build_cost_modifier": [("heavy_ship_cost", "high"), ("global_ship_cost", "medium")],
    "navy_light_ship_build_cost_modifier": [("light_ship_cost", "high"), ("global_ship_cost", "medium")],
    "navy_galley_build_cost_modifier": [("galley_cost", "high"), ("global_ship_cost", "medium")],
    "navy_transport_build_cost_modifier": [("transport_cost", "high"), ("global_ship_cost", "medium")],

    # ═══ MILITARY: Unit type maintenance ═══
    "army_heavy_infantry_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "army_light_infantry_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "army_heavy_cavalry_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "army_light_cavalry_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "army_artillery_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "army_auxiliary_maintenance_cost_modifier": [("land_maintenance_modifier", "medium")],
    "navy_heavy_ship_maintenance_cost_modifier": [("naval_maintenance_modifier", "medium")],
    "navy_light_ship_maintenance_cost_modifier": [("naval_maintenance_modifier", "medium")],
    "navy_galley_maintenance_cost_modifier": [("naval_maintenance_modifier", "medium")],
    "navy_transport_maintenance_cost_modifier": [("naval_maintenance_modifier", "medium")],

    # ═══ MILITARY: Unit type reinforce/repair cost ═══
    "army_heavy_infantry_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "army_light_infantry_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "army_heavy_cavalry_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "army_light_cavalry_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "army_artillery_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "army_auxiliary_reinforce_cost_modifier": [("reinforce_cost_modifier", "medium")],
    "navy_heavy_ship_reinforce_cost_modifier": [("global_ship_repair", "medium")],
    "navy_light_ship_reinforce_cost_modifier": [("global_ship_repair", "medium")],
    "navy_galley_reinforce_cost_modifier": [("global_ship_repair", "medium")],
    "navy_transport_reinforce_cost_modifier": [("global_ship_repair", "medium")],

    # ═══ MILITARY: Combat ═══
    "discipline": [("discipline", "high")],
    "land_morale_modifier": [("land_morale", "high")],
    "land_morale": [("land_morale", "high"), ("land_morale_constant", "medium")],
    "naval_morale_modifier": [("naval_morale", "high")],
    "naval_morale": [("naval_morale", "high"), ("naval_morale_constant", "medium")],
    "military_tactics": [("military_tactics", "high")],
    "land_morale_recovery": [("recover_army_morale_speed", "high")],
    "naval_morale_recovery": [("recover_navy_morale_speed", "high")],
    "morale_recovery_in_friendly": [("recover_army_morale_speed", "medium")],
    "siege_ability": [("siege_ability", "high")],
    "assault_ability": [("assault_fort_ability", "high")],
    "blockade_efficiency": [("blockade_efficiency", "high")],
    "ship_capture_chance": [("capture_ship_chance", "high")],
    "commander_combat_bonus": [("leader_land_fire", "low"), ("leader_land_shock", "low")],
    "own_coast_naval_combat_bonus": [("own_coast_naval_combat_bonus", "high")],
    "possible_frontage_modifier": [("global_naval_engagement_modifier", "medium")],

    # ═══ MILITARY: Initiative & Damage ═══
    "army_initiative": [
        ("shock_damage", "low"), ("fire_damage", "low"),
        ("infantry_shock", "low"), ("cavalry_shock", "low"),
    ],
    "navy_initiative": [("shock_damage", "low"), ("naval_morale_damage", "low")],
    "naval_damage_done": [("shock_damage", "low"), ("naval_morale_damage", "medium")],
    "naval_damage_taken": [("shock_damage_received", "low"), ("naval_morale_damage_received", "medium")],

    # ═══ MILITARY: Manpower / Sailors ═══
    "global_manpower_modifier": [("global_manpower_modifier", "high")],
    "global_sailors_modifier": [("global_sailors_modifier", "high")],
    "max_manpower": [("global_manpower", "medium")],
    "max_sailors": [("global_sailors", "medium")],

    # ═══ MILITARY: Levy / Recruitment ═══
    "regiment_reinforcement_speed": [("reinforce_speed", "high")],
    "regiment_recruit_speed": [("global_regiment_recruit_speed", "high")],
    "global_levy_size_modifier": [("land_forcelimit_modifier", "medium")],
    "global_army_levy_size_modifier": [("land_forcelimit_modifier", "medium")],
    "global_navy_levy_size_modifier": [("naval_forcelimit_modifier", "medium")],
    "levy_maintenance_modifier": [("land_maintenance_modifier", "medium")],
    "levy_combat_efficiency_modifier": [("discipline", "low")],
    "levy_recovery_modifier": [("reinforce_speed", "low")],
    "global_levy_recruitment_speed_modifier": [("global_regiment_recruit_speed", "medium")],

    # ═══ MILITARY: Maintenance efficiency ═══
    "army_maintenance_efficiency": [("land_maintenance_modifier", "high")],
    "navy_maintenance_efficiency": [("naval_maintenance_modifier", "high")],
    "mercenary_maintenance_efficiency": [("merc_maintenance_modifier", "high")],
    "army_reinforce_efficiency": [("reinforce_cost_modifier", "high")],
    "navy_repair_efficiency": [("global_ship_repair", "high")],

    # ═══ MILITARY: Experience / Tradition ═══
    "monthly_experience_gain": [("army_tradition", "low"), ("navy_tradition", "low")],
    "experience_decay": [("army_tradition_decay", "low"), ("navy_tradition_decay", "low")],
    "army_tradition_decay": [("army_tradition_decay", "high")],
    "navy_tradition_decay": [("navy_tradition_decay", "high")],
    "monthly_army_tradition": [("army_tradition", "high")],
    "monthly_navy_tradition": [("navy_tradition", "high")],
    "army_tradition_from_battle": [("army_tradition_from_battle", "high")],
    "navy_tradition_from_battle": [("naval_tradition_from_battle", "high")],

    # ═══ MILITARY: Special unit counts ═══
    "num_of_banner_cavalry": [("amount_of_banners", "high")],
    "num_of_cataphracts_modifier": [("cavalry_power", "low"), ("special_unit_forcelimit", "medium")],
    "num_of_legionaries_modifier": [("infantry_power", "low"), ("special_unit_forcelimit", "medium")],
    "num_of_varangian_units": [("special_unit_forcelimit", "medium")],

    # ═══ MILITARY: Supply / Logistics ═══
    "supply_limit": [("supply_limit", "high")],
    "global_supply_limit_modifier": [("global_supply_limit_modifier", "high")],
    "army_logistics_distance": [("global_supply_limit_modifier", "low")],
    "army_logistics_distance_modifier": [("global_supply_limit_modifier", "low")],

    # ═══ MILITARY: Movement ═══
    "army_movement_speed": [("movement_speed", "high")],
    "navy_movement_speed": [("movement_speed", "low")],
    "army_disembark_speed": [("regiment_disembark_speed", "high")],
    "movement_speed_if_no_road": [("movement_speed", "medium")],
    "ignore_zone_of_control": [("can_bypass_forts", "high")],
    "hostile_disembark_time_modifier": [("hostile_disembark_speed", "high")],
    "friendly_disembark_time_modifier": [("regiment_disembark_speed", "medium")],

    # ═══ MILITARY: Attrition ═══
    "land_unit_attrition": [("land_attrition", "high")],
    "naval_unit_attrition": [("naval_attrition", "high")],
    "global_hostile_attrition": [("hostile_attrition", "high")],
    "max_attrition": [("max_attrition", "high")],
    "hostile_fleet_attrition": [("hostile_fleet_attrition", "high")],

    # ═══ MILITARY: Fort ═══
    "fort_level": [("fort_level", "high")],
    "minimum_fort_level": [("fort_level", "medium")],
    "fort_maintenance_efficiency": [("fort_maintenance_modifier", "high")],
    "global_defensive": [("defensiveness", "high")],
    "global_garrison_growth": [("global_garrison_growth", "high")],
    "global_garrison_size_modifier": [("garrison_size", "high")],
    "artillery_bonus_vs_fort": [("artillery_levels_available_vs_fort", "high")],

    # ═══ NAVY: Repair ═══
    "ship_repair_at_sea": [("sea_repair", "high")],
    "ship_repair_at_sea_to_max_strength": [("sea_repair", "medium")],
    "local_repair_speed": [("local_ship_repair", "high")],
    "ship_build_speed": [("global_ship_recruit_speed", "high")],

    # ═══ MILITARY: Privateer / Slave Raid ═══
    "privateer_durability": [("privateer_efficiency", "medium")],
    "allow_privateers_slave_raid": [("may_perform_slave_raid", "high")],
    "auto_slave_raid": [("may_perform_slave_raid", "medium")],
    "auto_slave_raid_different_religion": [("may_perform_slave_raid_on_same_religion", "medium")],
    "slave_raid_efficiency": [("may_perform_slave_raid", "medium")],

    # ═══ MILITARY: Mercenary ═══
    "mercenary_maintenance_efficiency": [("merc_maintenance_modifier", "high")],
    "global_mercenaries_modifier": [("possible_condottieri", "medium")],
    "allow_mercenary_drill": [("allow_mercenary_drill", "high")],

    # ═══ MILITARY: Expected Size / Force limit ═══
    "expected_army_size": [("land_forcelimit", "medium")],
    "expected_army_size_modifier": [("land_forcelimit_modifier", "medium")],
    "expected_navy_size": [("naval_forcelimit", "medium")],
    "expected_navy_size_modifier": [("naval_forcelimit_modifier", "medium")],

    # ═══ MILITARY: Weight ═══
    "army_weight_modifier": [("land_attrition", "low")],
    "navy_weight_modifier": [("naval_attrition", "low")],

    # ── ADVISORS ──
    "hire_advisor_cost_modifier": [("advisor_cost", "high")],

    # ── CHARACTER / RULER ──
    "character_life_expectancy": [("monarch_lifespan", "high")],
    "global_life_expectancy": [("monarch_lifespan", "high")],
    "character_fertility": [("heir_chance", "medium")],
    "character_adm_child_education": [("monarch_admin_power", "medium")],
    "character_dip_child_education": [("monarch_diplomatic_power", "medium")],
    "character_mil_child_education": [("monarch_military_power", "medium")],
    "character_child_education": [("monarch_admin_power", "low")],

    # ── GENDER ──
    "allow_female_leader": [("may_recruit_female_generals", "high")],
    "gender_equality": [("may_recruit_female_generals", "medium")],

    # ── ESTATES ──
    "global_estate_power": [("all_estate_influence_modifier", "high")],
    "global_estate_satisfaction_from_legitimacy": [("all_estate_loyalty_equilibrium", "medium")],
    "global_estate_target_satisfaction": [("all_estate_loyalty_equilibrium", "high")],

    # ── CONTROL / AUTONOMY ──
    "global_monthly_control": [("global_autonomy", "medium")],
    "global_monthly_control_decline": [("global_autonomy", "low")],
    "global_max_control": [("min_autonomy", "low")],
    "global_max_rural_control": [("min_autonomy", "low")],
    "global_max_urban_control": [("min_autonomy", "low")],

    # ── LOOT ──
    "amount_looted_modifier": [("loot_amount", "high")],

    # ── CB / NATIVE ──
    "allow_native_subjugation_cb": [("cb_on_primitives", "high")],

    # ── ROADS ──
    "global_road_building_time": [("build_time", "medium")],

    # ── PANOKSEON (EU5-specific Korean ship) ──
    "n_panokseon_build_cost_modifier": [("galley_cost", "medium"), ("global_ship_cost", "medium")],
    "n_panokseon_maintenance_cost_modifier": [("naval_maintenance_modifier", "medium")],
    "n_panokseon_reinforce_cost_modifier": [("global_ship_repair", "medium")],

    # ── SLAVERY ──
    "allow_rgo_slave_demand": [],
    "allow_slave_conversion": [],
    "slavery_blocked": [],
    "any_pop_can_be_slave": [],
    "global_slave_pop_satisfaction": [],
    "building_enslavement_power": [],
    "slave_market_max_level": [],
    "unemployed_slave_promotion": [],
    "enslave_tribals": [],
    "expel_tribals": [],
}

# ── load CSV ─────────────────────────────────────────────────


def load_csv(path: Path) -> tuple[list[str], list[dict]]:
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return reader.fieldnames or [], list(reader)


def build_eu4_kb(rows: list[dict]) -> dict[str, dict]:
    kb = {}
    for r in rows:
        mod = r.get("eu4_matches", "").strip()
        if mod and not r.get("eu5_modifier", "").strip():
            kb[mod] = {
                "desc": r.get("eu4_description", "").strip(),
                "subsection": r.get("eu4_subsection", "").strip(),
                "effect": r.get("eu4_effect_type", "").strip(),
            }
    return kb


# ── word-level name matching ─────────────────────────────────
GENERIC_WORDS = {"cost", "modifier", "modifiers", "efficiency", "speed",
                 "base", "global", "local", "monthly", "yearly",
                 "modify", "value", "rate", "power", "size"}


def _words(name: str) -> set[str]:
    return set(name.lower().replace("_", " ").split()) - GENERIC_WORDS


def name_based_match(eu5_mod: str, eu4_kb: dict[str, dict],
                     existing_match: str) -> list[tuple[str, str]]:
    """Word-level matching: high if all meaningful words overlap, medium if most do."""
    results = []
    eu5_words = _words(eu5_mod)
    if not eu5_words:
        return results

    for eu4_mod in eu4_kb:
        if eu4_mod == existing_match:
            continue
        eu4_words = _words(eu4_mod)
        if not eu4_words:
            continue

        # Exact vocabulary match
        if eu5_words == eu4_words:
            results.append((eu4_mod, "high"))
            continue

        # One is subset of the other (all words of one contained in the other)
        # Require at least 2 words in the subset to avoid single-word false matches
        smaller_set = eu4_words if len(
            eu4_words) < len(eu5_words) else eu5_words
        if len(smaller_set) >= 2 and (eu4_words.issubset(eu5_words) or eu5_words.issubset(eu4_words)):
            results.append((eu4_mod, "high"))
            continue

        # >= 75% word overlap, minimum 2 common words
        common = eu5_words & eu4_words
        smaller = min(len(eu5_words), len(eu4_words))
        if smaller > 0 and len(common) >= 2 and len(common) / smaller >= 0.75:
            results.append((eu4_mod, "high" if len(common) >= 3 else "medium"))

    return results

# ── main ─────────────────────────────────────────────────────


def main():
    fields, rows = load_csv(CSV_IN)
    eu4_kb = build_eu4_kb(rows)
    eu5_rows_list = [r for r in rows if r.get("eu5_modifier", "").strip()]
    eu4_only_rows = [r for r in rows if not r.get("eu5_modifier", "").strip()]

    print(
        f"EU4 KB: {len(eu4_kb)}  EU5 rows: {len(eu5_rows_list)}  EU4-only: {len(eu4_only_rows)}")

    new_rows = []
    matched_new = 0
    multi_added = 0

    for r in eu5_rows_list:
        eu5_mod = r.get("eu5_modifier", "").strip()
        existing_match = r.get("eu4_matches", "").strip()
        existing_conf = r.get("confidence", "").strip()

        candidates: list[tuple[str, str]] = []

        # 1. Manual map
        if eu5_mod in MANUAL_MAP:
            for eu4_m, conf in MANUAL_MAP[eu5_mod]:
                if eu4_m in eu4_kb:
                    candidates.append((eu4_m, conf))

        # 2. Name-based
        for eu4_m, conf in name_based_match(eu5_mod, eu4_kb, existing_match):
            if (eu4_m, conf) not in candidates:
                candidates.append((eu4_m, conf))

        # Deduplicate per EU4 name (keep highest confidence)
        best: dict[str, str] = {}
        conf_rank = {"high": 3, "medium": 2, "low": 1}
        for eu4_m, conf in candidates:
            if eu4_m not in best or conf_rank.get(conf, 0) > conf_rank.get(best[eu4_m], 0):
                best[eu4_m] = conf

        # Remove already-matched EU4 modifier from new candidates
        filtered = [(m, c) for m, c in best.items() if m != existing_match]

        if existing_match and existing_conf in ("high", "medium", "low"):
            new_rows.append(dict(r))
            for eu4_new, conf_new in filtered:
                nr = dict(r)
                nr["eu4_matches"] = eu4_new
                nr["confidence"] = conf_new
                nr["notes"] = f"Multi-match: {eu4_new} ↔ {eu5_mod}"
                nr["eu4_subsection"] = eu4_kb.get(
                    eu4_new, {}).get("subsection", "")
                nr["eu4_description"] = eu4_kb.get(eu4_new, {}).get("desc", "")
                nr["eu4_effect_type"] = eu4_kb.get(
                    eu4_new, {}).get("effect", "")
                new_rows.append(nr)
                multi_added += 1
        elif filtered:
            primary = filtered[0]
            r["eu4_matches"] = primary[0]
            r["confidence"] = primary[1]
            r["notes"] = f"Match: {primary[0]} ↔ {eu5_mod}"
            r["eu4_subsection"] = eu4_kb.get(
                primary[0], {}).get("subsection", "")
            r["eu4_description"] = eu4_kb.get(primary[0], {}).get("desc", "")
            r["eu4_effect_type"] = eu4_kb.get(primary[0], {}).get("effect", "")
            new_rows.append(r)
            matched_new += 1
            for eu4_new, conf_new in filtered[1:]:
                nr = dict(r)
                nr["eu4_matches"] = eu4_new
                nr["confidence"] = conf_new
                nr["notes"] = f"Multi-match: {eu4_new} ↔ {eu5_mod}"
                nr["eu4_subsection"] = eu4_kb.get(
                    eu4_new, {}).get("subsection", "")
                nr["eu4_description"] = eu4_kb.get(eu4_new, {}).get("desc", "")
                nr["eu4_effect_type"] = eu4_kb.get(
                    eu4_new, {}).get("effect", "")
                new_rows.append(nr)
                multi_added += 1
        else:
            new_rows.append(dict(r))

    # Add EU4-only rows
    for r in eu4_only_rows:
        new_rows.append(dict(r))

    print(
        f"New matches: {matched_new}  Multi-match rows: {multi_added}  Total: {len(new_rows)}")

    with open(CSV_OUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(new_rows)
    print(f"Written → {CSV_OUT}")


if __name__ == "__main__":
    main()
