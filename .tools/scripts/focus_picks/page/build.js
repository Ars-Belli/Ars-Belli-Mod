// Builds the public "Ars Belli Focus Picks" page from the mod's focus_data.js, the vanilla
// modifier names/formats and changelog.json (times shown in Europe/Berlin, CET/CEST).
// node .tools/scripts/focus_picks/page/build.js [game dir]
// Output: focus-picks.html next to this script; publish it to the existing artifact URL.
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '../../../..');
const game = process.argv[2] || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const tplPath = path.join(__dirname, 'template.html');
const outPath = path.join(__dirname, 'focus-picks.html');

const data = require(path.join(repo, '.tools/scripts/focus_picks/focus_data.js'));
const PARENT = [null, 0, 1, 0, 3, 4, 2];

// Vanilla advance names.
const names = {};
for (const f of ['advances_l_english.yml']) {
	const txt = fs.readFileSync(path.join(game, 'main_menu/localization/english', f), 'utf8');
	for (const m of txt.matchAll(/^\s*([A-Za-z0-9_]+):\d*\s*"(.*)"\s*$/gm)) names[m[1]] = m[2];
}
// All vanilla English loc, modifier names, descriptions (tooltips) and value formats.
const { loc, clean, modInfo, modName, fmtValue } = require('./modloc.js')(game);

const AGE_NAMES = {
	age_2_renaissance: 'Age of Renaissance', age_3_discovery: 'Age of Discovery',
	age_4_reformation: 'Age of Reformation', age_5_absolutism: 'Age of Absolutism',
	age_6_revolutions: 'Age of Revolutions',
};

// Named constants used in the data (resolved from vanilla script values).
const CONST = {
	diplomatic_reputation_mild_bonus: 2, small_permanent_target_satisfaction: 0.025,
	medium_production_efficiency_bonus: 0.05, small_trade_efficiency_bonus: 0.025,
	small_tax_income_efficiency_bonus: 0.02, large_tax_income_efficiency_bonus: 0.05,
	medium_tax_income_efficiency_bonus: 0.03, medium_trade_land_efficiency_bonus: 0.20,
	medium_trade_sea_efficiency_bonus: 0.20, small_stability_investment: 0.02,
};

// kind: pct = value x100 %, cost = cost-efficiency shown as a cost cut of half the value
// (the game shows *_efficiency on costs at half), flat = plain number, raw = plain decimal,
// asis = value with a % sign. combat = shown with the army/navy combat marker.
const M = {
	add_accepted_culture_cost_modifier: ['Accepted culture cost', 'pct'],
	antagonism_received_modifier: ['Antagonism received', 'pct'],
	anti_piracy_warfare_modifier: ['Anti-piracy warfare', 'pct'],
	army_artillery_build_cost_modifier: ['Artillery build cost', 'pct'],
	army_artillery_power: ['Artillery power', 'pct', 'combat'],
	army_auxiliary_build_cost_modifier: ['Auxiliary build cost', 'pct'],
	army_auxiliary_maintenance_cost_modifier: ['Auxiliary maintenance cost', 'pct'],
	army_auxiliary_power: ['Auxiliary power', 'pct', 'combat'],
	army_disembark_speed: ['Disembark speed', 'pct'],
	army_initiative: ['Army initiative', 'pct', 'combat'],
	army_logistics_distance_modifier: ['Logistics distance', 'pct'],
	army_maintenance_efficiency: ['Army maintenance cost', 'cost'],
	army_movement_speed: ['Army movement speed', 'pct'],
	army_reinforce_efficiency: ['Reinforcement cost', 'cost'],
	army_tradition_from_battle: ['Army tradition from battles', 'pct'],
	artillery_bonus_vs_fort: ['Artillery bonus vs forts', 'flat', 'combat'],
	artist_impact: ['Artist impact', 'pct'],
	assault_ability: ['Assault ability', 'pct', 'combat'],
	bank_interest: ['Bank interest', 'pct'],
	blockade_efficiency: ['Blockade efficiency', 'pct'],
	casus_belli_creation_speed_modifier: ['Casus belli creation speed', 'pct'],
	change_policy_cost_modifier: ['Policy change cost', 'pct'],
	change_primary_culture_cost_modifier: ['Change primary culture cost', 'pct'],
	colonial_maintenance_efficiency: ['Colonial maintenance cost', 'cost'],
	colonial_migration_size_modifier: ['Colonist migration size', 'pct'],
	colonial_range: ['Colonial range', 'flat'],
	colonial_range_modifier: ['Colonial range', 'pct'],
	combat_speed_modifier: ['Combat speed', 'pct', 'combat'],
	counter_espionage: ['Counterespionage', 'pct'],
	country_cabinet_efficiency: ['Cabinet efficiency', 'pct'],
	court_spending_efficiency: ['Court spending cost', 'cost'],
	cultural_influence_modifier: ['Cultural influence', 'pct'],
	cultural_tradition_modifier: ['Cultural tradition', 'pct'],
	cultures_capacity: ['Cultures capacity', 'flat'],
	cultures_capacity_modifier: ['Cultures capacity', 'pct'],
	diplomatic_capacity: ['Diplomatic capacity', 'flat'],
	diplomatic_range: ['Diplomatic range', 'flat'],
	diplomatic_range_modifier: ['Diplomatic range', 'pct'],
	diplomatic_reputation: ['Diplomatic reputation', 'flat'],
	discipline: ['Discipline', 'pct', 'combat'],
	expand_rgo_mining_cost_modifier: ['Mine expansion cost', 'pct'],
	experience_decay: ['Monthly experience decay', 'pct'],
	exploration_mission_speed: ['Exploration speed', 'pct'],
	exploration_preparation_time_modifier: ['Exploration preparation time', 'pct'],
	food_consumption_modifier: ['Army food consumption', 'pct'],
	fort_limit: ['Fort limit', 'flat'],
	fort_limit_modifier: ['Fort limit', 'pct'],
	fort_maintenance_efficiency: ['Fort maintenance cost', 'cost'],
	global_build_buildings_efficiency: ['Building cost', 'cost'],
	global_bureaucracy_maintenance_efficiency: ['Bureaucracy maintenance cost', 'cost'],
	global_cannons_output_modifier: ['Cannon output', 'pct'],
	global_copper_output_modifier: ['Copper output', 'pct'],
	global_defensive: ['Fort defense', 'pct'],
	global_devastation_recovery: ['Devastation recovery', 'pct'],
	global_distance_from_capital_speed_propagation: ['Proximity propagation speed', 'pct'],
	global_estate_target_satisfaction: ['Estate target satisfaction', 'pct'],
	global_fort_build_buildings_efficiency: ['Fort build cost', 'cost'],
	global_garrison_growth: ['Garrison growth', 'pct'],
	global_garrison_size_modifier: ['Garrison size', 'pct'],
	global_hostile_attrition: ['Attrition for enemies in our land', 'asis'],
	global_integration_speed_modifier: ['Integration speed', 'pct'],
	global_iron_output_modifier: ['Iron output', 'pct'],
	global_levy_recruitment_speed_modifier: ['Levy recruitment speed', 'pct'],
	global_levy_size_modifier: ['Levy size', 'pct'],
	global_manpower_modifier: ['Manpower', 'pct'],
	global_max_literacy: ['Max literacy', 'asis'],
	global_max_rgo_size_modifier: ['Max RGO size', 'pct'],
	global_merchant_capacity_modifier: ['Merchant capacity', 'pct'],
	global_merchant_power: ['Merchant power', 'pct'],
	global_monthly_art_start_chance: ['Monthly chance of new art', 'pct'],
	global_monthly_control: ['Monthly control', 'raw'],
	global_monthly_control_decline: ['Monthly control decline', 'raw'],
	global_monthly_development: ['Monthly development', 'raw'],
	global_monthly_literacy: ['Monthly literacy', 'asis'],
	global_pop_assimilation_speed_modifier: ['Assimilation speed', 'pct'],
	global_pop_conversion_speed: ['Conversion speed (flat)', 'raw'],
	global_pop_conversion_speed_modifier: ['Conversion speed', 'pct'],
	global_production_efficiency: ['Production efficiency', 'pct'],
	global_raw_material_output: ['Raw material output', 'pct'],
	global_road_building_time: ['Road building time', 'pct'],
	global_sailors_modifier: ['Sailors', 'pct'],
	global_separatism: ['Separatism', 'pct'],
	global_supply_limit_modifier: ['Supply limit', 'pct'],
	global_trade_center_power: ['Trade center power', 'pct'],
	global_urban_build_buildings_efficiency: ['Urban building cost', 'cost'],
	global_war_score_efficiency: ['Warscore cost efficiency', 'pct'],
	government_size: ['Government size', 'flat'],
	hire_advisor_cost_modifier: ['Advisor hiring cost', 'pct'],
	hire_mercenary_leader_cost_modifier: ['Mercenary leader cost', 'pct'],
	hire_mercenary_premium_cost_modifier: ['Mercenary hiring premium', 'pct'],
	improve_relation_impact: ['Improve relations impact', 'pct'],
	land_morale_attrition_cost: ['Morale lost to attrition', 'pct'],
	land_morale_modifier: ['Land morale', 'pct', 'combat'],
	land_morale_movement_cost: ['Morale lost while moving', 'pct'],
	land_morale_recovery: ['Land morale recovery', 'pct'],
	land_unit_attrition: ['Army attrition', 'pct'],
	legislative_efficiency: ['Legislative efficiency', 'pct'],
	levy_combat_efficiency_modifier: ['Levy combat efficiency', 'pct', 'combat'],
	levy_maintenance_modifier: ['Levy maintenance cost', 'pct'],
	levy_recovery_modifier: ['Levy recovery', 'pct'],
	max_bonds: ['Max bonds', 'flat'],
	max_diplomats: ['Max diplomats', 'flat'],
	max_manpower: ['Max manpower (thousands)', 'flat'],
	mercenary_maintenance_efficiency: ['Mercenary maintenance cost', 'cost'],
	mercenary_range_modifier: ['Mercenary range', 'pct'],
	merchant_maintenance_efficiency: ['Merchant maintenance cost', 'cost'],
	merchant_power_from_maritime_modifier: ['Merchant power from maritime presence', 'pct'],
	military_tactics: ['Military tactics', 'raw', 'combat'],
	minting_income_factor: ['Income from minting', 'pct'],
	minting_inflation_threshold: ['Minting inflation threshold', 'pct'],
	monthly_army_tradition: ['Monthly army tradition', 'flat'],
	monthly_diplomats: ['Monthly diplomats', 'flat'],
	monthly_experience_gain: ['Monthly experience gain', 'pct'],
	monthly_navy_tradition: ['Monthly navy tradition', 'flat'],
	monthly_prestige: ['Monthly prestige', 'flat'],
	monthly_rebel_growth: ['Monthly rebel growth', 'raw'],
	monthly_religious_rebel_growth: ['Monthly religious rebel growth', 'raw'],
	monthly_war_exhaustion: ['Monthly war exhaustion', 'flat'],
	morale_recovery_in_friendly: ['Morale recovery in friendly territory', 'pct'],
	movement_speed_if_no_road: ['Movement speed off roads', 'pct'],
	naval_damage_done: ['Naval damage done', 'pct', 'combat'],
	naval_damage_taken: ['Naval damage taken', 'pct', 'combat'],
	naval_morale_modifier: ['Naval morale', 'pct', 'combat'],
	naval_unit_attrition: ['Navy attrition', 'pct'],
	navy_galley_build_cost_modifier: ['Galley build cost', 'pct'],
	navy_galley_maintenance_cost_modifier: ['Galley maintenance cost', 'pct'],
	navy_galley_power: ['Galley power', 'pct', 'combat'],
	navy_heavy_ship_build_cost_modifier: ['Heavy ship build cost', 'pct'],
	navy_heavy_ship_maintenance_cost_modifier: ['Heavy ship maintenance cost', 'pct'],
	navy_heavy_ship_power: ['Heavy ship power', 'pct', 'combat'],
	navy_initiative: ['Navy initiative', 'pct', 'combat'],
	navy_light_ship_build_cost_modifier: ['Light ship build cost', 'pct'],
	navy_light_ship_maintenance_cost_modifier: ['Light ship maintenance cost', 'pct'],
	navy_light_ship_power: ['Light ship power', 'pct', 'combat'],
	navy_maintenance_efficiency: ['Navy maintenance cost', 'cost'],
	navy_repair_efficiency: ['Navy repair cost', 'cost'],
	navy_tradition_from_battle: ['Navy tradition from battles', 'pct'],
	num_local_governors: ['Local governors', 'flat'],
	num_naval_governors: ['Naval governors', 'flat'],
	occupation_time: ['Time for enemies to occupy our land', 'pct'],
	own_coast_naval_combat_bonus: ['Naval combat bonus off own coast', 'pct', 'combat'],
	pop_leave_rebels_threshold: ['Threshold for pops to leave rebels', 'raw'],
	port_cost_distance_from_capital: ['Port distance cost from capital', 'flat'],
	prestige_from_land_battle: ['Prestige from land battles', 'pct'],
	prestige_from_naval_battle: ['Prestige from naval battles', 'pct'],
	raw_material_in_province_impact: ['Local access to raw materials', 'pct'],
	regiment_recruit_speed: ['Regiment recruitment speed', 'pct'],
	regiment_reinforcement_speed: ['Reinforcement speed', 'pct'],
	research_speed: ['Research speed (flat)', 'raw'],
	research_speed_modifier: ['Research speed', 'pct'],
	road_cost_on_distance_from_capital: ['Road distance cost from capital', 'flat'],
	sea_cost_on_distance_from_capital_when_maritime: ['Sea distance cost from capital (maritime)', 'flat'],
	selling_efficiency: ['Selling efficiency', 'pct'],
	set_policy_cost_modifier: ['Policy setting cost', 'pct'],
	ship_build_speed: ['Ship build speed', 'pct'],
	ship_repair_at_sea: ['Ship repair at sea', 'pct'],
	siege_ability: ['Siege ability', 'pct', 'combat'],
	skill_of_new_artists: ['Skill of new artists', 'pct'],
	spy_network_construction: ['Spy network construction', 'pct'],
	stability_investment: ['Stability investment', 'raw'],
	subject_income_modifier: ['Subject income', 'pct'],
	subject_loyalty: ['Subject loyalty', 'flat'],
	subject_opinions: ['Subject opinion', 'flat'],
	subject_pays_colonial_cost_modifier: ['Colonial cost paid by subjects', 'pct'],
	tax_income_efficiency: ['Tax efficiency', 'pct'],
	tolerance_heathen: ['Heathen tolerance', 'flat'],
	tolerance_heretic: ['Heretic tolerance', 'flat'],
	tolerance_own: ['True faith tolerance', 'flat'],
	trade_land_efficiency: ['Land trade efficiency', 'pct'],
	trade_range_modifier: ['Trade range', 'pct'],
	trade_sea_efficiency: ['Sea trade efficiency', 'pct'],
	train_admiral_cost_modifier: ['Admiral training cost', 'pct'],
	train_general_cost_modifier: ['General training cost', 'pct'],
	work_of_art_quality_modifier: ['Work of art quality', 'pct'],
	wrong_culture_levy_size: ['Levy size from other cultures', 'pct'],
};
// In-game display rules (percent / already_percent / decimals / color / format) from the
// vanilla modifier_type_definitions. Names come from MODIFIER_TYPE_NAME_<key>.
const DEFS = require('./defs.js')(game);
// Army and navy combat stats, including unit upkeep (forts, merchants, court etc. are not).
const UNIT_UPKEEP = /^(army|navy|levy|mercenary)_.*maintenance/;
const UNIT_POWER = /^(army|navy)_.*_power$/;
const isCombat = key => (M[key] && M[key][2] === 'combat') || UNIT_POWER.test(key) || UNIT_UPKEEP.test(key);
// The game colours hostile attrition as bad (it is bad for whoever suffers it); for the
// country holding the modifier it is a bonus, so show it as one.
const COLOR_OVERRIDE = { global_hostile_attrition: 'good' };

function fmt(key, rawVal) {
	const def = DEFS[key];
	if (!def) throw new Error('no modifier definition for ' + key);
	const label = modName(key);
	if (def.boolean) return { label, value: 'Yes', good: true, combat: isCombat(key), info: modInfo(key) };
	const v = rawVal in CONST ? CONST[rawVal] : parseFloat(rawVal);
	const shown = fmtValue(def, v);
	const color = COLOR_OVERRIDE[key] || def.color;
	const good = color === 'bad' ? v < 0 : v > 0;
	return { label, value: shown, good, neutral: color === 'neutral', combat: isCombat(key), info: modInfo(key) };
}

function effects(mods) {
	return mods.split('\n').filter(Boolean).map(l => l.split('=').map(s => s.trim())).map(([k, v]) => {
		const e = fmt(k, v);
		if (k === 'can_hire_privateers') e.info = UNLOCK_INFO.privateers;
		return e;
	});
}
// Longer explanations for the advances that unlock something rather than give a number.
const UNLOCK_INFO = {
	sabotage: 'A covert action against a country you are at war with. Pick one of its locations with a fort (not its capital): every soldier pop living there becomes peasants, so the fort stands unmanned until the location raises new soldiers on its own. Costs 50 spy network plus gold equal to 3 months of the target\'s income (at least 25). You can use it once every 2 years, and a sabotaged country can\'t be targeted again by anyone for 2 years. The victim is told who did it and which location.',
	infiltrate: 'The full Infiltrate Administration action: lifts the fog of war over another country\'s whole territory for 24 months, for 50 spy network. Everyone else only has Lesser Infiltration from the Renaissance tree, which costs the same but lasts 3 months.',
	steal: 'Take 20% of another country\'s current research progress, for 100 spy network. Only targets countries that have researched more advances than you, and they need more than 20 research progress. In Ars Belli the target loses nothing.',
	march: clean(loc.march_desc || '') + ' Lets you turn subjects into Marches.',
	exploration: 'A casus belli for wars of superiority against a country whose capital is on another subcontinent, as long as your power projection is higher than theirs. Chartered Companies grants it too.',
	privateers: clean(loc.game_concept_privateer_desc || '') + ' This advance lets you hire them.',
};
const UNLOCKS = {
	'unlock_subject_type = march': ['Unlocks the March subject type', 'march'],
	'unlock_casus_belli = cb_exploration': ['Unlocks the Exploration casus belli', 'exploration'],
	'unlock_country_interaction = abm_sabotage_fort': ['Unlocks the Sabotage Fort action', 'sabotage'],
	'unlock_diplomacy = { infiltrate_administration }': ['Unlocks Infiltrate Administration', 'infiltrate'],
	'unlock_country_interaction = steal_technology': ['Unlocks Steal Technology', 'steal'],
};
function unlocks(raw) {
	if (!raw) return [];
	return Object.keys(UNLOCKS).filter(k => raw.includes(k)).map(k => ({ unlock: UNLOCKS[k][0], info: UNLOCK_INFO[UNLOCKS[k][1]] }));
}

const ages = data.ages.map(a => ({
	key: a.age, n: a.n, name: AGE_NAMES[a.age],
	slots: [['Economic', a.eco], ['Military', a.mil]].map(([slot, brs]) => ({
		slot,
		branches: brs.map(br => ({
			id: br.id, name: br.name, desc: br.desc,
			advances: br.adv.map(([key, mods, ex = {}], i) => {
				const name = ex.name || names[key];
				if (!name) throw new Error('no name for ' + key);
				return { key, name, parent: PARENT[i], isNew: !!ex.name, effects: [...effects(mods), ...unlocks(ex.raw)] };
			}),
		})),
	})),
}));

// Change log, newest first, times in Central European time (CET, or CEST in summer).
const CET = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Berlin', day: 'numeric', month: 'short', year: 'numeric',
	hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});
const changes = JSON.parse(fs.readFileSync(path.join(__dirname, 'changelog.json'), 'utf8'))
	.map(c => ({ ...c, when: CET.format(new Date(c.time)) }))
	.sort((a, b) => new Date(b.time) - new Date(a.time));

const tpl = fs.readFileSync(tplPath, 'utf8');
const safe = x => JSON.stringify(x).replace(/</g, '\\u003c');
fs.writeFileSync(outPath, tpl.replace('__FOCUS_DATA__', () => safe(ages)).replace('__CHANGELOG__', () => safe(changes)));
console.log('wrote', outPath, (fs.statSync(outPath).size / 1024).toFixed(1) + ' KB');
