// Builds the "Ars Belli Military Modifiers" reference page: every army and navy modifier the
// game defines, with its in-game name, tooltip, format, the values vanilla advances give it,
// where else vanilla uses it, and which focus pick advances use it now.
// node .tools/scripts/focus_picks/page/build_military.js [game dir]
// Output: military-modifiers.html next to this script; publish it to its artifact URL.
const fs = require('fs');
const path = require('path');
const repo = path.resolve(__dirname, '../../../..');
const game = process.argv[2] || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const tplPath = path.join(__dirname, 'military_template.html');
const outPath = path.join(__dirname, 'military-modifiers.html');

const { loc, clean, modInfo, modName, fmtValue } = require('./modloc.js')(game);
const DEFS = require('./defs.js')(game);
const focus = require(path.join(repo, '.tools/scripts/focus_picks/focus_data.js'));

// Scope of each modifier, from game_data { category = ... } in the definitions.
const scope = {};
{
	const dir = path.join(game, 'main_menu/common/modifier_type_definitions');
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
		const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^\uFEFF/, '');
		for (const m of t.matchAll(/^([a-z0-9_]+)\s*=\s*\{([\s\S]*?)^\}/gm)) scope[m[1]] = (m[2].match(/category\s*=\s*([a-z]+)/) || [])[1] || 'other';
	}
}

// Which modifiers count as army or navy ones.
const UNIT_TYPES = ['light_infantry', 'heavy_infantry', 'light_cavalry', 'heavy_cavalry', 'artillery', 'auxiliary', 'galley', 'heavy_ship', 'light_ship', 'transport'];
const UNIT_KEY = new RegExp('^(army|navy)_(' + UNIT_TYPES.join('|') + ')_(power|build_cost_modifier|reinforce_cost_modifier|maintenance_cost_modifier)$');
const INCLUDE = /army|navy|naval|military|regiment|ship|fleet|levy|levies|mercenar|manpower|sailor|discipline|morale|tactic|attrition|siege|fort|garrison|general|admiral|combat|initiative|reinforce|supply|blockade|privateer|pira|occupation|war_score|war_exhaustion|warscore|cavalry|infantry|artillery|galley|flagship|experience|battle|embark|hostile|defensive|frontage|commander|movement_speed|food_consumption_modifier|food_gathering|retreat|devastation|loot|zone_of_control|assault/;
const EXCLUDE = /estate|proximity_impact|_movement_(resistance|growth)|desired_pop|_output_modifier|sengoku|kirishitan|kami|spiritual_retreat|shogun|lordship_of_ireland|high_kingship|italian_league|peasants_war|hanseatic|panokseon|a_clan_|varangian|banner_cavalry|nahuatl|north_american|sofa_units|paik|electorship|horde_unity|preordained|naval_supplies|slave_raid|imperial_army_contribution|hre_army|examine_our_fortifications|fortify_key_location|_importance_modifier|preference_modifier|abandon_piracy|bureaucracy_impact|allow_cabinet_naval_focus|monthly_towards_|^local_(port|mills)|can_recruit_regiment_in_this|can_build_ships_in_this|overlord_blocked|target_of_military_sponsorships|^(n|a)_|_food_consumption$|reject_subjugation|accept_subjugation|shameless|is_excluded|ruler_must_be_commander|^num_of_|hostile_diplomatic_annexation|disallow_diplomatic|may_not_take_land|subjugat|native|^land_cost|comfort|effort|dun_fort|nobility_fortifications|apprenticeships|league_leadership|trade_embark|naval_governors|military_order/;
const wanted = k => !EXCLUDE.test(k) && !['character', 'internationalorganization'].includes(scope[k]) && (UNIT_KEY.test(k) || scope[k] === 'unit' || INCLUDE.test(k));

// Sections, first match wins.
const SECTIONS = [
	['units', 'Unit types', 'Power and cost of each regiment and ship type.', k => UNIT_KEY.test(k)],
	['mercenaries', 'Mercenaries', 'Hiring, range and upkeep of mercenary companies.', k => /mercenar/.test(k)],
	['forts', 'Forts and sieges', 'Fort limits and upkeep, garrisons, sieges, assaults and occupation.', k => /(^|_)forts?(_|$)|siege|assault|garrison|occupation|zone_of_control/.test(k)],
	['navy', 'Navy', 'Ships, sailors, naval combat, blockades and privateers.', k => /navy|naval|ship|sailor|fleet|blockade|maritime|galley|privateer|pira|transport|admiral|embark/.test(k) && !/disembark_speed/.test(k)],
	['leaders', 'Leaders and tradition', 'Generals, army tradition, experience and battle rewards.', k => /general|tradition|experience|prestige_from|commander/.test(k)],
	['manpower', 'Manpower and levies', 'Manpower, levy size, recovery and recruitment.', k => /manpower|levy|levies|expected_army/.test(k)],
	['movement', 'Movement, supply and attrition', 'Marching, supply limits, food, attrition and devastation.', k => /movement|attrition|supply|logistics|food|disembark|retreat|loot|devastation/.test(k)],
	['combat', 'Land combat', 'Discipline, morale, tactics, initiative and other battle stats.', k => /discipline|tactic|initiative|morale|combat|damage|defensive|frontage|flank|combined|box|assist|weight/.test(k)],
	['upkeep', 'Recruitment, upkeep and reinforcement', 'Regiment training, maintenance and reinforcement.', k => /maintenance|reinforce|recruit|regiment|build_cost|unit/.test(k)],
	['war', 'War', 'War score, war exhaustion, declaring war and military access.', k => /war|antagonism|truce|access/.test(k)],
	['other', 'Other', 'Everything else with an army or navy link.', () => true],
];
const sectionOf = k => SECTIONS.find(s => s[3](k))[0];

// Named constants vanilla uses as modifier values.
const CONST = {};
for (const d of ['main_menu/common/script_values', 'in_game/common/script_values']) {
	const dir = path.join(game, d);
	if (!fs.existsSync(dir)) continue;
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) {
		for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^@?([a-z0-9_]+)\s*=\s*(-?[\d.]+)\s*$/gm)) CONST[m[1]] = parseFloat(m[2]);
	}
}

const keys = Object.keys(DEFS).filter(wanted);
const keySet = new Set(keys);

// Vanilla usage: every in_game/common database, top-level object names for advances.
const DB_NAMES = { advances: 'advances', government_reforms: 'government reforms', laws: 'laws', policies: 'policies', estate_privileges: 'estate privileges', static_modifiers: 'static modifiers', building_types: 'buildings', religious_aspects: 'religious aspects', traditions: 'traditions', cabinet_actions: 'cabinet actions', unit_types: 'unit types', production_methods: 'production methods' };
const usage = {};
function walk(dir, db) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) walk(p, db);
		else if (e.name.endsWith('.txt')) scan(p, db);
	}
}
function scan(file, db) {
	const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
	let top = null, depth = 0;
	for (const raw of lines) {
		const line = raw.replace(/#.*/, '');
		if (depth === 0) { const t = line.match(/^([A-Za-z0-9_]+)\s*=\s*\{/); if (t) top = t[1]; }
		for (const m of line.matchAll(/(?:^|[\s{])([a-z0-9_]+)\s*=\s*(-?[\d.]+|[a-z_]+)(?=[\s}]|$)/g)) {
			if (!keySet.has(m[1])) continue;
			const v = /^-?[\d.]+$/.test(m[2]) ? parseFloat(m[2]) : m[2] === 'yes' ? 'yes' : m[2] in CONST ? CONST[m[2]] : null;
			if (v === null) continue;
			const u = usage[m[1]] ||= { dbs: {}, adv: [] };
			u.dbs[db] = (u.dbs[db] || 0) + 1;
			if (db === 'advances' && top) u.adv.push({ v, top, file: path.basename(file) });
		}
		for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
	}
}
{
	const root = path.join(game, 'in_game/common');
	for (const e of fs.readdirSync(root, { withFileTypes: true })) if (e.isDirectory()) walk(path.join(root, e.name), e.name);
}

// Focus pick usage.
const AGE_SHORT = { age_2_renaissance: 'Renaissance', age_3_discovery: 'Discovery', age_4_reformation: 'Reformation', age_5_absolutism: 'Absolutism', age_6_revolutions: 'Revolutions' };
const advNames = {};
for (const m of fs.readFileSync(path.join(game, 'main_menu/localization/english/advances_l_english.yml'), 'utf8').matchAll(/^\s*([A-Za-z0-9_]+):\d*\s*"(.*)"\s*$/gm)) advNames[m[1]] = m[2];
const abm = {};
for (const a of focus.ages) for (const slot of ['eco', 'mil']) for (const br of a[slot]) for (const [key, mods, ex = {}] of br.adv) {
	for (const l of mods.split('\n').filter(Boolean)) {
		const [k, v] = l.split('=').map(s => s.trim());
		const num = v in CONST ? CONST[v] : v === 'yes' ? 'yes' : parseFloat(v);
		(abm[k] ||= []).push({ age: AGE_SHORT[a.age], branch: br.name, advance: ex.name || advNames[key] || key, raw: num });
	}
}

const show = (def, v) => (v === 'yes' || def.boolean ? 'Yes' : fmtValue(def, v));
const rows = keys.map(k => {
	const def = DEFS[k];
	const color = def.color;
	const u = usage[k] || { dbs: {}, adv: [] };
	// Distinct vanilla advance values, most common first.
	const counts = {};
	for (const a of u.adv) counts[a.v] = (counts[a.v] || 0) + 1;
	const advValues = Object.entries(counts).sort((a, b) => b[1] - a[1] || Math.abs(b[0]) - Math.abs(a[0])).map(([v, n]) => ({ v: show(def, v === 'yes' ? 'yes' : parseFloat(v)), n }));
	const examples = [...new Set(u.adv.map(a => advNames[a.top] || null).filter(Boolean))].slice(0, 4);
	const elsewhere = Object.entries(u.dbs).filter(([db]) => db !== 'advances').sort((a, b) => b[1] - a[1]).map(([db, n]) => [DB_NAMES[db] || db.replace(/_/g, ' '), n]);
	return {
		key: k,
		name: modName(k),
		info: modInfo(k),
		section: sectionOf(k),
		scope: { unit: 'Unit', country: 'Country', location: 'Location' }[scope[k]] || 'Other',
		better: def.boolean ? 'switch' : color === 'bad' ? 'lower' : color === 'neutral' ? 'neutral' : 'higher',
		kind: def.boolean ? 'Yes/No' : def.percent || def.already ? 'Percent' : def.format === 'FormatManPower' ? 'Men (×1000)' : 'Number',
		advCount: u.adv.length,
		advValues,
		examples,
		elsewhere,
		abm: (abm[k] || []).map(x => ({ ...x, value: show(def, x.raw) })),
	};
});
// Unit-type rows sort by unit, then stat; the rest by name.
const UNIT_ORDER = k => { const m = k.match(UNIT_KEY); return m ? UNIT_TYPES.indexOf(m[2]) * 10 + ['power', 'build_cost_modifier', 'reinforce_cost_modifier', 'maintenance_cost_modifier'].indexOf(m[3]) : 0; };
rows.sort((a, b) => UNIT_ORDER(a.key) - UNIT_ORDER(b.key) || a.name.localeCompare(b.name));

const sections = SECTIONS.map(([id, title, blurb]) => ({ id, title, blurb })).filter(s => rows.some(r => r.section === s.id));
// Game version the mod targets, from its version string (game.<gv>.mod.<n>).
const vanillaVersion = (fs.readFileSync(path.join(repo, '.metadata/metadata.json'), 'utf8').match(/"version"\s*:\s*"game\.([\d.]+)\.mod/) || [])[1] || null;

const tpl = fs.readFileSync(tplPath, 'utf8');
const safe = x => JSON.stringify(x).replace(/</g, '\\u003c');
fs.writeFileSync(outPath, tpl.replace('__ROWS__', () => safe(rows)).replace('__SECTIONS__', () => safe(sections)).replace('__VERSION__', () => safe(vanillaVersion)));
console.log('wrote', outPath, (fs.statSync(outPath).size / 1024).toFixed(1) + ' KB,', rows.length, 'modifiers');
if (process.env.DUMP) for (const s of sections) console.log(s.id, rows.filter(r => r.section === s.id).map(r => r.key).join(' '));
