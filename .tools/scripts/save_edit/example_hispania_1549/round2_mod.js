// Worked example, round 2: adds three more steps to the helper mod, from round2_plan.js: borders, accepted cultures,
// then armories and training fields where a location has none.
//   node round2_mod.js
const fs = require('fs');
const { work } = require('../paths.js');
const hm = require('../helper_mod.js');
const st = require('../state.js').load('hispania_2');
const plan = JSON.parse(fs.readFileSync(work('hispania_round2_plan.json'), 'utf8'));
const mod = hm.open('ArsBelliPlaytestTools', { name: 'Ars Belli Playtest Tools', id: 'arsbelli.playtesttools', description: 'One-off clean-up effects for the 1549 Hispania campaign save. Load after Ars Belli.' });
const MAJ = ['RUS', 'SPA', 'FRA', 'BOH', 'GBR', 'BYZ', 'HUN', 'GEO', 'TEU', 'PAP', 'HAB'];
for (const t of plan.transfers) if (!MAJ.includes(t.to)) throw new Error('unexpected target ' + t.to);

const E = [];
E.push(`# Ars Belli Playtest Tools, second round: for the save made after the first clean-up of the 1549.12.3 "Hispania" campaign.
# Run from the decisions list, in this order: borders, cultures, military buildings.

# scope: location. New owner, with core, full integration and control.
abm_playtest_give = {
	change_location_owner = c:$TO$
	add_core = c:$TO$
	change_integration_level = core
	change_location_controller = c:$TO$
}

abm_playtest_round2_borders = {`);
const groups = {};
for (const t of plan.transfers) (groups[t.why] = groups[t.why] || []).push(t);
for (const [g, ts] of Object.entries(groups)) { E.push(`\t# ${g}`); for (const t of ts) E.push(`\tlocation:${t.name} = { abm_playtest_give = { TO = ${t.to} } }`); }
E.push(`	# Spain: all its land in the Maghreb becomes core
	c:SPA = {
		every_owned_location = {
			limit = { region = region:maghreb_region }
			add_core = c:SPA
			change_integration_level = core
			change_location_controller = c:SPA
		}
	}
}

# scope: country. Every culture that is the largest one in at least one of its locations becomes accepted,
# and that culture and the country's own culture come to see each other as kindred, which makes acceptance cheaper.
abm_playtest_accept_cultures = {
	save_scope_as = abm_pt_c
	every_owned_location = {
		dominant_culture ?= {
			if = {
				limit = { NOT = { this = scope:abm_pt_c.culture } }
				save_scope_as = abm_pt_cu
				set_cultural_view = { target = scope:abm_pt_c.culture value = kindred }
				reverse_set_cultural_view = { target = scope:abm_pt_c.culture value = kindred }
				if = {
					limit = { NOT = { scope:abm_pt_c = { has_primary_or_accepted_culture = scope:abm_pt_cu } } }
					scope:abm_pt_c = {
						add_accepted_culture = scope:abm_pt_cu
						grant_culture_bonus_advances = scope:abm_pt_cu
					}
				}
			}
		}
	}
}
abm_playtest_accept_cultures_all = {
${MAJ.map(t => `\tc:${t} = { abm_playtest_accept_cultures = yes }`).join('\n')}
}

# scope: country. One Armory in every town and city without one, one Training Fields in every rural settlement
# without one, where the location's largest culture is the country's own or an accepted one (the game's own rule).
abm_playtest_add_military_buildings = {
	every_owned_location = {
		limit = {
			owner = { has_primary_or_accepted_culture = prev.dominant_culture }
			OR = {
				location_rank = location_rank:town
				location_rank = location_rank:city
				location_rank = location_rank:megalopolis
			}
			NOT = { has_building = building_type:armory }
		}
		change_building_level_in_location = {
			building = building_type:armory
			value = 1
		}
	}
	every_owned_location = {
		limit = {
			owner = { has_primary_or_accepted_culture = prev.dominant_culture }
			location_rank = location_rank:rural_settlement
			NOT = { has_building = building_type:training_fields }
		}
		change_building_level_in_location = {
			building = building_type:training_fields
			value = 1
		}
	}
}
abm_playtest_add_military_buildings_all = {
${MAJ.map(t => `\tc:${t} = { abm_playtest_add_military_buildings = yes }`).join('\n')}
}
`);
mod.effects('abm_playtest_round2', E.join('\n'), { locNames: st.D.locNames, tags: hm.staticTags() });

const DEC = [
	['abm_playtest_round2_borders', 'abm_playtest_round2_borders = yes', 'Playtest 2a: Border Changes, Second Round', 'Lesser Poland to the Teutonic Order, Alsace and the Palatinate to Austria, the lower Rhine and Lower Main to Bohemia, Wallis to the Papal States, Kabylia back to Spain, and Spanish cores in the Maghreb. Run this first.', 'Change the borders', 'The listed provinces change hands and become core. Spain gains cores on all its land in the Maghreb.'],
	['abm_playtest_cultures', 'abm_playtest_accept_cultures_all = yes', 'Playtest 2b: Accept Cultures', 'The eleven large European countries accept every culture that is the largest in one of their locations, and those cultures and the main culture come to see each other as kindred. Run this second.', 'Accept them', 'Cultures are accepted and see the main culture as kindred.'],
	['abm_playtest_military', 'abm_playtest_add_military_buildings_all = yes', 'Playtest 2c: Add Armories and Training Fields', 'The eleven large European countries get an Armory in every town and city without one and Training Fields in every rural settlement without one. Run this last.', 'Build them', 'An Armory or Training Fields is added to every location that lacks one.'],
];
mod.decisions('abm_playtest_round2_decisions', DEC.map(([key, effect, title, desc, button, tooltip]) => ({ key, effect, title, desc, button, tooltip })),
	{ header: '# Ars Belli Playtest Tools, second round. The effects are hidden from the tooltip: listing them froze the game.', locFile: 'abm_playtest_round2' });
console.log('written to', mod.out, '| transfers', plan.transfers.length);
