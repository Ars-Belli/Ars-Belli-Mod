# Switzerland (SWI) — every advance and modifier the tag can receive

How a Swiss state is put together: the **SWI tag** exists only as the level-3 `SWI_f` formable
(potential: culture group `swiss_group`, original capital in `south_german_region`), and vanilla's
**Swiss cultural tree** is gated on the scripted trigger `is_swiss_for_advances`, *not* on the tag.
So a Swiss state stacks: the tag set + the Swiss cultural tree + whatever its culture group and
primary culture unlock.

Since 2026-11-18 every Swiss advance also requires the **original capital** to lie in
`western_switzerland_area` (Romandy), `central_switzerland_area` (Switzerland) or
`eastern_switzerland_area` (Raetia).

**56 gated advances** in total. Ungated advances available to every nation are not listed.

For a typical Swiss state (SWI tag, `high_alemannic` primary culture, capital in `central_switzerland_area`) the live set is **section 1 + section 2 + section 3 (`german_group`)**, roughly 23 advances. Sections 3b/3c and 4 only apply if the primary culture is Romansh or Ticinese, and Appendix B/C do not apply to Switzerland at all.


## 1. Tag axis — `has_or_had_tag = SWI` (mod only)

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `abm_swi_ideas_tradition_1` | `mercenary_maintenance_efficiency = 0.15` | `tag` | abm_german.txt |
| `age_1_traditions` | `abm_swi_ideas_tradition_2` | `army_heavy_infantry_power = 0.10` | `tag` | abm_german.txt |
| `age_6_revolutions` | `abm_swi_ideas_ambition` | `discipline = 0.05` | `tag` | abm_german.txt |

## 2. Swiss cultural tree — `is_swiss_for_advances` / `culture_group:swiss_group`

14 trigger-gated advances, plus `swiss_eternal_alliance`, whose potential names `culture_group:swiss_group` and the cantonal tags URI/SYZ/OBW directly. `gebirgsschutzen_infantry` is the one shared entry: its `potential` is an OR of the two Bavarian cultures and `is_swiss_for_advances`, so Bavaria gets it too.

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `swiss_alpine_passes` | `unlock_estate_privilege = abm_alpine_proximity_privilege` | `is_swiss_for_advances` | abm_rough_terrain_advances.txt |
| `age_1_traditions` | `swiss_eternal_alliance` | `monthly_diplomats = 0.1`<br>`monthly_prestige = 0.1` | `culture_group:swiss_group` | culture_high_alemannic.txt |
| `age_1_traditions` | `swiss_halberd_infantry` | `army_heavy_infantry_power = 0.1` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_1_traditions` | `swiss_oath_of_rutli` | `peasants_estate_levy_size = 0.2` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_2_renaissance` | `swiss_mercenaries` | `global_mercenaries_modifier = 0.25`<br>`mercenary_payment_to_owner = 0.5` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_2_renaissance` | `the_swiss_confederation` | `stability_cost_efficiency = 0.2` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_3_discovery` | `swiss_recovery_and_prosperity` | `global_monthly_development = 0.001`<br>`global_monthly_prosperity = 0.001` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_3_discovery` | `swiss_reislaufer` | `unlock_unit = a_reislaufer` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_4_reformation` | `alpine_defensiveness` | `military_tactics = 0.1`<br>`global_defensive = 0.25` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_4_reformation` | `gebirgsschutzen_infantry` | `unlock_unit = a_gebirgsschutzen_infantry` | `is_swiss_for_advances` | culture_group_german.txt |
| `age_4_reformation` | `swiss_religious_refuge` | `invite_artist_cost_modifier = -0.1`<br>`non_rural_migration_attraction = 0.2` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_5_absolutism` | `swiss_clockwork` | `global_production_efficiency = medium_production_efficiency_bonus` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_5_absolutism` | `swiss_tolerance` | `tolerance_heretic = 1` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_6_revolutions` | `swiss_ambition` | `monthly_republican_tradition = 0.1` | `is_swiss_for_advances` | culture_high_alemannic.txt |
| `age_6_revolutions` | `swiss_banking` | `bank_interest = -0.02` | `is_swiss_for_advances` | culture_high_alemannic.txt |

## 3. Culture group — `german_group`

Requires the primary culture's group to satisfy `german_group` - the same gate the German formables (`SWA_f`, `WES_f`, ...) use. `high_alemannic` is a Swiss-group culture, so this depends on `swiss_group` merging into / counting as `german_group`.

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `fortress_church_advance` | `unlock_building = fortress_church`<br>`allow_children = no` | `german_group` | 1_building_unlocks.txt |
| `age_2_renaissance` | `german_mountain_toll_castle_advance` | `unlock_building = german_mountain_toll_castle` | `german_group` | culture_group_german.txt |
| `age_2_renaissance` | `german_river_toll_castle_advance` | `unlock_building = german_river_toll_castle` | `german_group` | culture_group_german.txt |
| `age_2_renaissance` | `saiger_process` | `global_silver_output_modifier = 0.2`<br>`global_lead_output_modifier = 0.2`<br>`allow_children = no` | `german_group` | culture_group_german.txt |
| `age_3_discovery` | `landsknechte` | `mercenary_payment_to_owner = 0.15`<br>`unlock_unit = a_landsknechte` | `german_group` | culture_group_german.txt |

## 3. Culture group — `rhaetian_group` (Romansh: Chur, Disentis, Ilanz)

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `rhaetian_the_vicinanza` | `global_peasant_enfranchisment = 0.05`<br>`monthly_devotion = 0.1`<br>`monthly_legitimacy = 0.1`<br>`monthly_republican_tradition = 0.1` | `rhaetian_group` | culture_group_rhaetian.txt |
| `age_2_renaissance` | `rhaetian_the_tobia` | `global_food_decay = -0.02`<br>`global_monthly_food_modifier = monthly_food_productivity_weak_bonus` | `rhaetian_group` | culture_group_rhaetian.txt |
| `age_3_discovery` | `rhaetian_the_mountain_warriors` | `army_heavy_infantry_power = 0.10`<br>`embrace_institution_cost_modifier = -0.10` | `rhaetian_group` | culture_group_rhaetian.txt |
| `age_4_reformation` | `rhaetian_the_chanzun` | `cultural_tradition_modifier = 0.20` | `rhaetian_group` | culture_group_rhaetian.txt |
| `age_5_absolutism` | `rhaetian_the_alpine_diplomacy` | `diplomatic_reputation = diplomatic_reputation_mild_bonus`<br>`improve_relation_impact = 0.1` | `rhaetian_group` | culture_group_rhaetian.txt |
| `age_6_revolutions` | `rhaetian_the_national_revival` | `cultural_influence_modifier = 0.15`<br>`global_max_literacy = 10` | `rhaetian_group` | culture_group_rhaetian.txt |

## 3. Culture group — `italian_group` (Ticino: Bellinzona, Lugano, Mesocco)

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `italy_great_families` | `diplomatic_capacity_modifier = 0.15`<br>`monthly_prestige = 0.15` | `italian_group` | region_italy.txt |
| `age_2_renaissance` | `abm_italian_balestrieri_stradioti` | `unlock_unit = a_abm_balestrieri`<br>`unlock_unit = a_abm_italian_stradioti` | `italian_group` | abm_units_italy.txt |
| `age_2_renaissance` | `italian_condottieri` | `hire_mercenary_premium_cost_modifier = -0.2`<br>`hire_mercenary_leader_cost_modifier = -0.2` | `italian_group` | region_italy.txt |
| `age_3_discovery` | `abm_italian_late_balestrieri_stradioti` | `unlock_unit = a_abm_late_balestrieri`<br>`unlock_unit = a_abm_late_italian_stradioti` | `italian_group` | abm_units_italy.txt |
| `age_4_reformation` | `abm_italian_archibugieri_cappelletti` | `unlock_unit = a_abm_archibugieri`<br>`unlock_unit = a_abm_italian_cappelletti` | `italian_group` | abm_units_italy.txt |
| `age_4_reformation` | `italian_galleass` | `unlock_unit = n_italian_galleass`<br>`in_tree_of = global_trade_advance` | `italian_group` | 2_ship_unlocks.txt |
| `age_4_reformation` | `unlock_galleass_advance` | `unlock_unit = n_galleass`<br>`in_tree_of = global_trade_advance` | `italian_group` | 2_ship_unlocks.txt |
| `age_5_absolutism` | `abm_italian_corazze` | `unlock_unit = a_abm_corazze` | `italian_group` | abm_units_italy.txt |
| `age_5_absolutism` | `abm_italian_corazzieri` | `unlock_unit = a_abm_italian_corazzieri` | `italian_group` | abm_units_italy.txt |
| `age_6_revolutions` | `abm_italian_bersaglieri` | `unlock_unit = a_abm_bersaglieri` | `italian_group` | abm_units_italy.txt |
| `age_6_revolutions` | `abm_italian_carabinieri` | `unlock_unit = a_abm_italian_carabinieri` | `italian_group` | abm_units_italy.txt |

## 4. Culture — `culture:arpitan` (Romandy)

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `sav_savoyard_flexibility` | `diplomatic_capacity = 1`<br>`monthly_diplomats = 0.1` | `arpitan` | country_sav.txt |

## 4. Culture — `culture:lombard` (Ticino)

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `milanese_tradition` | `global_nobles_estate_power = -0.10`<br>`legislative_efficiency = 0.10` | `lombard` | culture_lombard.txt |
| `age_2_renaissance` | `patron_of_music` | `global_merchant_power = 0.10`<br>`trade_range = 200` | `lombard` | culture_lombard.txt |
| `age_3_discovery` | `age_of_condottieri` | `global_monthly_development = 0.001`<br>`trade_land_efficiency = small_trade_land_efficiency_bonus` | `lombard` | culture_lombard.txt |
| `age_4_reformation` | `merchant_princes` | `cultural_tradition_modifier = 0.10`<br>`skill_of_new_artists = 0.10` | `lombard` | culture_lombard.txt |
| `age_5_absolutism` | `lombard_silk_masters` | `export_efficiency = small_trade_efficiency_bonus`<br>`global_silk_output_modifier = 0.20` | `lombard` | culture_lombard.txt |
| `age_6_revolutions` | `lombard_the_manifattura` | `global_cloth_output_modifier = 0.15`<br>`global_monthly_prosperity = 0.001` | `lombard` | culture_lombard.txt |

## Appendix B. `culture:swabian` — neighbouring, no Swiss location

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `swabian_league_of_cities` | `global_burghers_city_desired_pop = 0.25`<br>`land_morale_modifier = 0.05` | `swabian` | culture_group_german.txt |
| `age_4_reformation` | `swabian_frugal_people` | `bank_interest = -0.01`<br>`court_spending_efficiency = 0.1` | `swabian` | culture_group_german.txt |

## Appendix B. `culture:vivaro_alpine` — neighbouring, no Swiss location

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_1_traditions` | `vivaro_alpine_drailles` | `global_livestock_output_modifier = 0.2`<br>`global_monthly_food_modifier = monthly_food_productivity_mild_bonus` | `vivaro_alpine` | culture_vivaro_alpine.txt |
| `age_2_renaissance` | `vivaro_alpine_infantry` | `army_light_infantry_power = 0.1`<br>`military_tactics = 0.1` | `vivaro_alpine` | culture_vivaro_alpine.txt |
| `age_3_discovery` | `vivaro_alpine_passes` | `diplomatic_capacity_modifier = 0.1`<br>`trade_land_efficiency = medium_trade_land_efficiency_bonus` | `vivaro_alpine` | culture_vivaro_alpine.txt |
| `age_4_reformation` | `vivaro_alpine_herbes_des_alpes` | `global_disease_resistance = 0.1`<br>`global_life_expectancy = 2` | `vivaro_alpine` | culture_vivaro_alpine.txt |
| `age_5_absolutism` | `vivaro_alpine_valley_councils` | `country_cabinet_efficiency = 0.1`<br>`legislative_efficiency = 0.1` | `vivaro_alpine` | culture_vivaro_alpine.txt |
| `age_6_revolutions` | `vivaro_alpine_nature` | `cultural_influence_modifier = 0.1`<br>`non_rural_migration_attraction = 0.1` | `vivaro_alpine` | culture_vivaro_alpine.txt |

## Appendix C. Region-gated — none reachable from a Swiss capital

| age | advance | modifiers | gate | source |
| --- | --- | --- | --- | --- |
| `age_6_revolutions` | `unlock_archipelago_frigate` | `unlock_unit = n_archipelago_frigate`<br>`in_tree_of = enlightenment_advance` | `german region` | 2_ship_unlocks.txt |

## Disabled — not obtainable

| advance | why |
| --- | --- |
| `--abm_swiss_mercenaries` | duplicate of vanilla `swiss_mercenaries` |
| `--abm_swiss_tolerance` | duplicate of vanilla `swiss_tolerance` |
| `--abm_the_swiss_confederation` | duplicate of vanilla `the_swiss_confederation` |
| `--abm_alpine_defensiveness` | duplicate of vanilla `alpine_defensiveness` |
| `--abm_oasis_of_peace_and_prosperity` | duplicate of vanilla `swiss_recovery_and_prosperity` |
| `--abm_haven_for_refugees` | duplicate of vanilla `swiss_religious_refuge` |
| `--abm_clockwork` | duplicate of vanilla `swiss_clockwork` |
