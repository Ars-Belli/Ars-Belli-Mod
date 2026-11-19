// Worked example, round 1: writes the helper mod from the plan (round1_plan.js) and the save's buildings.
// Two steps, each a decision: buildings over their limit, then the borders.
//   node round1_mod.js
const fs = require('fs');
const { work } = require('../paths.js');
const hm = require('../helper_mod.js');
const st = require('../state.js').load('hispania_0');
const { D, L } = st;
const plan = JSON.parse(fs.readFileSync(work('hispania_round1_plan.json'), 'utf8'));
const mod = hm.open('ArsBelliPlaytestTools', { name: 'Ars Belli Playtest Tools', id: 'arsbelli.playtesttools', description: 'One-off clean-up effects for the 1549 Hispania campaign save. Load after Ars Belli.' });
const staticTags = hm.staticTags(); // countries created during the campaign (AAA01...) cannot be named in script

const EUROPE = ['RUS', 'SPA', 'FRA', 'BOH', 'GBR', 'HUN', 'TEU', 'PAP', 'HAB'], WHOLE = ['BYZ', 'GEO'];
for (const t of [...EUROPE, ...WHOLE, 'DAN', 'NED', 'POR']) if (!staticTags.has(t)) throw new Error('tag not static: ' + t);

// final location transfers: last owner wins
const finalTo = new Map();
for (const t of plan.transfers) finalTo.set(t.name, t.to);
for (const to of finalTo.values()) if (!staticTags.has(to)) throw new Error('transfer to a dynamic tag: ' + to);

// trade offices over the mod's cap (1 town or rural, 2 city, 3 megalopolis), from the save
const rows = D.buildings; // [type, level, location id, owner id]
const explicit = [], genericLocs = new Set();
let levels = 0;
for (const [type, lv, lo, ow] of rows) {
	if (type !== 'trade_office') continue;
	const l = L[lo], cap = l.rank === 'megalopolis' ? 3 : l.rank === 'city' ? 2 : 1, over = +lv - cap;
	if (!(over > 0)) continue;
	levels += over;
	const tag = D.tags[ow];
	if (staticTags.has(tag)) explicit.push({ loc: l.name, tag, over }); else genericLocs.add(l.name);
}
const E = [];
E.push(`# Ars Belli Playtest Tools: one-off clean-up of the 1549.12.3 "Hispania" campaign save.
# Generated from that save (owners, subjects, buildings as they stand in it). Not for any other save.
# Run from the decisions list, as any player country. The decisions hide the effect from the tooltip:
# listing it there froze the game.

# ---- 1. buildings over the limit ----
# scope: location. One of the owner's own buildings down to the 1.4 manpower building cap.
abm_playtest_trim_one = {
	while = {
		limit = {
			location_building_level = {
				building_type = building_type:$BUILDING$
				value > manpower_max_level
			}
		}
		change_building_level_in_location = {
			building = building_type:$BUILDING$
			value = -1
		}
	}
}

# scope: location. Every country's Trade Office here down to the Ars Belli cap. Used where the owner is a
# country created during the campaign, which script cannot name.
abm_playtest_trim_trade_offices_here = {
	save_scope_as = abm_pt_loc
	every_country = {
		save_scope_as = abm_pt_owner
		scope:abm_pt_loc = {
			while = {
				limit = {
					location_building_level = {
						building_type = building_type:trade_office
						owner = scope:abm_pt_owner
						value > abm_trade_office_max_level
					}
				}
				change_building_level_in_location = {
					building = building_type:trade_office
					owner = scope:abm_pt_owner
					value = -1
				}
			}
		}
	}
}

abm_playtest_trim_buildings = {
	# armories, training fields, barracks, regimental camps, conscription centres: every country, every location
	every_country = {
		every_owned_location = {
			abm_playtest_trim_one = { BUILDING = armory }
			abm_playtest_trim_one = { BUILDING = training_fields }
			abm_playtest_trim_one = { BUILDING = barracks }
			abm_playtest_trim_one = { BUILDING = regimental_camp }
			abm_playtest_trim_one = { BUILDING = conscription_center }
		}
	}
	# Trade Offices: ${explicit.length} named, ${genericLocs.size} locations searched, ${levels} levels in all
`);
for (const x of explicit) E.push(`\tlocation:${x.loc} = { change_building_level_in_location = { building = building_type:trade_office owner = c:${x.tag} value = -${x.over} } }`);
for (const n of genericLocs) E.push(`\tlocation:${n} = { abm_playtest_trim_trade_offices_here = yes }`);
E.push(`}

# ---- 2. borders ----
# scope: overlord. Annexes its subjects, and theirs, whose capital is in Europe. Banks and rebels are left.
abm_playtest_annex_subjects_europe = {
	save_scope_as = abm_pt_over
	every_subject = {
		every_subject = {
			limit = {
				NOT = { subject_type = subject_type:state_bank }
				NOT = { subject_type = subject_type:secessionists }
				capital ?= { continent = continent:europe }
			}
			save_scope_as = abm_pt_sub
			scope:abm_pt_over = { annex_country = { country = scope:abm_pt_sub reason = Diplomatic transfer = yes } }
		}
	}
	every_subject = {
		limit = {
			NOT = { subject_type = subject_type:state_bank }
			NOT = { subject_type = subject_type:secessionists }
			capital ?= { continent = continent:europe }
		}
		save_scope_as = abm_pt_sub
		scope:abm_pt_over = { annex_country = { country = scope:abm_pt_sub reason = Diplomatic transfer = yes } }
	}
}
# scope: overlord. The same for every subject, wherever its capital is.
abm_playtest_annex_subjects_all = {
	save_scope_as = abm_pt_over
	every_subject = {
		every_subject = {
			limit = {
				NOT = { subject_type = subject_type:state_bank }
				NOT = { subject_type = subject_type:secessionists }
			}
			save_scope_as = abm_pt_sub
			scope:abm_pt_over = { annex_country = { country = scope:abm_pt_sub reason = Diplomatic transfer = yes } }
		}
	}
	every_subject = {
		limit = {
			NOT = { subject_type = subject_type:state_bank }
			NOT = { subject_type = subject_type:secessionists }
		}
		save_scope_as = abm_pt_sub
		scope:abm_pt_over = { annex_country = { country = scope:abm_pt_sub reason = Diplomatic transfer = yes } }
	}
}
# scope: country. Its land in Europe (and Tunis) becomes core, fully integrated and under its own control.
abm_playtest_core_europe = {
	save_scope_as = abm_pt_over
	every_owned_location = {
		limit = {
			OR = {
				continent = continent:europe
				area = area:tunis_area
			}
		}
		add_core = scope:abm_pt_over
		change_integration_level = core
		change_location_controller = scope:abm_pt_over
	}
}
# scope: country. The same for all its land.
abm_playtest_core_all = {
	save_scope_as = abm_pt_over
	every_owned_location = {
		add_core = scope:abm_pt_over
		change_integration_level = core
		change_location_controller = scope:abm_pt_over
	}
}

abm_playtest_clean_borders = {
	# white peace in every war of a country with its capital in Europe, of Byzantium and of Georgia
	every_country = {
		limit = {
			OR = {
				capital ?= { continent = continent:europe }
				this = c:BYZ
				this = c:GEO
			}
		}
		every_current_war = { white_peace = this }
	}
	# subjects into their overlords
${EUROPE.map(t => `\tc:${t} = { abm_playtest_annex_subjects_europe = yes }`).join('\n')}
${WHOLE.map(t => `\tc:${t} = { abm_playtest_annex_subjects_all = yes }`).join('\n')}
	# the Papal vassal in Tunisia
	c:PAP = {
		every_subject = {
			limit = {
				NOT = { subject_type = subject_type:state_bank }
				capital ?= { region = region:maghreb_region }
			}
			save_scope_as = abm_pt_sub
			c:PAP = { annex_country = { country = scope:abm_pt_sub reason = Diplomatic transfer = yes } }
		}
	}
	# Denmark with all its subjects to the Teutonic Order
	c:DAN = { abm_playtest_annex_subjects_all = yes }
	c:TEU = { annex_country = { country = c:DAN reason = Diplomatic transfer = yes } }
	# the Netherlands to France: its European subjects are annexed, its colonial nations become French
	c:NED = {
		abm_playtest_annex_subjects_europe = yes
		every_subject = {
			limit = { subject_type = subject_type:colonial_nation }
			make_subject_of = { target = c:FRA type = subject_type:colonial_nation }
		}
	}
	c:FRA = { annex_country = { country = c:NED reason = Diplomatic transfer = yes } }
	# Portugal to Spain: its colonial nations become Spanish
	c:POR = {
		abm_playtest_annex_subjects_europe = yes
		every_subject = {
			limit = { subject_type = subject_type:colonial_nation }
			make_subject_of = { target = c:SPA type = subject_type:colonial_nation }
		}
	}
	c:SPA = { annex_country = { country = c:POR reason = Diplomatic transfer = yes } }
	# single locations: Iberia to Spain, Tunis to the Papal States, French land east of the Rhine, strays
`);
const why = new Map(); for (const t of plan.transfers) why.set(t.name, t.why);
const groups = {}; for (const [name, to] of finalTo) (groups[`${why.get(name)} -> ${to}`] = groups[`${why.get(name)} -> ${to}`] || []).push(name);
for (const [g, names] of Object.entries(groups)) { E.push(`\t# ${g}`); for (const n of names) E.push(`\tlocation:${n} = { change_location_owner = c:${g.split(' -> ')[1]} }`); }
E.push(`	# cores, integration and control
${EUROPE.map(t => `\tc:${t} = { abm_playtest_core_europe = yes }`).join('\n')}
${WHOLE.map(t => `\tc:${t} = { abm_playtest_core_all = yes }`).join('\n')}
}
`);
mod.effects('abm_playtest_cleanup', E.join('\n'), { locNames: D.locNames, tags: staticTags });
mod.decisions('abm_playtest_decisions', [
	{ key: 'abm_playtest_trim_buildings', done: 'abm_playtest_buildings_done', effect: 'abm_playtest_trim_buildings = yes', title: 'Playtest: Trim Buildings Over the Limit', desc: 'Brings armories, training fields, barracks and Trade Offices down to their current limits, in every country. Run this first, once.', button: 'Trim them', tooltip: 'Every country: armories, training fields, barracks and Trade Offices come down to their limits.' },
	{ key: 'abm_playtest_clean_borders', done: 'abm_playtest_borders_done', effect: 'abm_playtest_clean_borders = yes', title: 'Playtest: Clean the Borders of Europe', desc: 'Ends the wars, annexes subjects into their overlords, merges Denmark, the Netherlands and Portugal, hands over stray locations and makes the land core. Run this second, once.', button: 'Clean them', tooltip: 'Wars end, subjects are annexed, stray locations change hands and the land becomes core.' },
], { header: '# Ars Belli Playtest Tools: the two clean-up steps as decisions, for whoever is playing.', locFile: 'abm_playtest' });
console.log('written to', mod.out);
console.log('trade offices over cap:', explicit.length, 'named +', genericLocs.size, 'locations searched;', levels, 'levels');
console.log('location transfers:', finalTo.size, Object.entries(groups).map(([g, n]) => g + ' ' + n.length).join(' | '));
