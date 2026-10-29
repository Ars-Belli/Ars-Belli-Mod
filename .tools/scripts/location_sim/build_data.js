// Builds data.json for the location simulator: everything a location's numbers depend on, from vanilla EU5 + Ars Belli.
//   node .tools/scripts/location_sim/build_data.js [gameDir]
// Modifier blocks become { key: number | 'yes' } with duplicate keys summed (INJECT: adds lines to a vanilla block) and
// named constants (script values such as monthly_food_productivity_severe_bonus) resolved to their numbers.
const fs = require('fs');
const path = require('path');
if (process.argv[2]) process.env.EU5_GAME = process.argv[2];
const { GAME, MOD, tokenize, parse, loadDb, get } = require('../battle_sim/paradox.js');
const OUT = path.join(__dirname, 'data.json');

const readText = rel => [GAME, MOD].map(r => path.join(r, rel)).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8'));
const all = (pairs, key) => (pairs || []).filter(([k]) => k === key).map(([, v]) => v);
const num = x => { const n = parseFloat(x); return Number.isFinite(n) && /^-?[\d.]+$/.test(String(x).trim()) ? n : null; };

// ---- defines (vanilla, then the mod's define files on top)
const defines = {};
for (const root of [GAME, MOD]) {
	const dir = path.join(root, 'loading_screen/common/defines');
	if (!fs.existsSync(dir)) continue;
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort())
		for (const [sec, body] of parse(fs.readFileSync(path.join(dir, f), 'utf8')))
			if (Array.isArray(body)) for (const [k, v] of body) {
				const n = num(v);
				(defines[sec] ??= {})[k] = n ?? (v === 'yes' ? true : v === 'no' ? false : v);
			}
}
const KEEP_DEFINES = ['NPop', 'NLocation', 'NEconomy', 'NCountry', 'NEstate', 'NMarket', 'NUnit', 'NColony'];

// ---- script values: plain numbers in `values`, formula blocks in `scripted` (evaluated by the engine)
// Formula blocks keep their comparison operators: [key, op, value] with op '=', '<', '>', '<=', '>=', '?=' or '!='.
function parseOps(text) {
	const t = tokenize(text);
	let i = 0;
	const val = x => (x && typeof x === 'object') ? x.q : x;
	const block = () => {
		const out = [];
		while (i < t.length && t[i] !== '}') {
			if (t[i] === '{') { i++; out.push(['', '=', block()]); i++; continue; }
			const k = val(t[i++]);
			let op = null;
			if ((t[i] === '?' || t[i] === '!') && t[i + 1] === '=') { op = t[i] + '='; i += 2; }
			else if (t[i] === '<' || t[i] === '>') { op = t[i++]; if (t[i] === '=') { op += '='; i++; } }
			else if (t[i] === '=') { op = '='; i++; }
			if (!op) { out.push([k, null, true]); continue; }
			if (t[i] === '{') { i++; out.push([k, op, block()]); i++; } else out.push([k, op, val(t[i++])]);
		}
		return out;
	};
	return block();
}
function loadDbOps(rel) {
	const files = new Map();
	for (const root of [GAME, MOD]) {
		const dir = path.join(root, rel);
		if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt'))) files.set(f.toLowerCase(), path.join(dir, f));
	}
	const db = {}, overrides = [];
	for (const [, file] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0])))
		for (const [k, , v] of parseOps(fs.readFileSync(file, 'utf8'))) {
			if (!Array.isArray(v)) continue;
			const m = k.match(/^(REPLACE|INJECT|TRY_REPLACE|TRY_INJECT|REPLACE_OR_CREATE|INJECT_OR_CREATE):(.+)$/);
			if (m) overrides.push([m[2], v]); else db[k] = v;
		}
	for (const [k, v] of overrides) db[k] = v;
	return db;
}
const values = {}, scripted = {};
for (const rel of ['main_menu/common/script_values', 'in_game/common/script_values'])
	for (const [k, v] of Object.entries(loadDbOps(rel))) scripted[k] = v;
for (const rel of ['main_menu/common/script_values', 'in_game/common/script_values'])
	for (const root of [GAME, MOD]) {
		const dir = path.join(root, rel);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')))
			for (const [k, v] of parse(fs.readFileSync(path.join(dir, f), 'utf8'))) if (!Array.isArray(v) && num(v) !== null) { values[k] = num(v); delete scripted[k]; }
	}
const resolve = v => num(v) ?? (values[v] !== undefined ? values[v] : v === 'yes' || v === 'no' ? v : v);

// a modifier block -> { key: value }, summing repeated numeric keys
function mods(block, scale = 1) {
	if (!Array.isArray(block)) return undefined;
	const o = {};
	for (const [k, v] of block) {
		if (Array.isArray(v) || k === 'game_data') continue;
		const r = resolve(v);
		if (typeof r === 'number') o[k] = +(((o[k] || 0) + r * scale).toFixed(6));
		else o[k] = r;
	}
	return Object.keys(o).length ? o : undefined;
}
// every block with this key merged (INJECT: appends a second block, e.g. a mod's extra country_modifier on a rank)
const modsAll = (pairs, key) => mods([].concat(...all(pairs, key).filter(Array.isArray)));
const scalar = (pairs, key) => { const v = get(pairs, key); return v === undefined || Array.isArray(v) ? undefined : resolve(v); };

// ---- pop types and estates
const pops = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/pop_types'))) {
	pops[k] = {
		food: scalar(v, 'pop_food_consumption') ?? 0, power: scalar(v, 'power_per_pop') ?? 0,
		upper: scalar(v, 'upper') === 'yes' ? 1 : 0, cap: scalar(v, 'has_cap') === 'yes' ? 1 : 0, grow: scalar(v, 'grow') === 'yes' ? 1 : 0,
		promotion: scalar(v, 'promotion_factor') ?? 0, migration: scalar(v, 'migration_factor') ?? 0,
		assimilation: scalar(v, 'assimilation_conversion_factor') ?? 0, tribal: scalar(v, 'tribal_rules') === 'yes' ? 1 : 0,
		promoteTo: all(v, 'promote_to'),
		// estate: the unconditional one (empty trigger block); the others need a trigger (is_dhimmi, ...)
		estate: (v.find(([e, b]) => e.endsWith('_estate') && Array.isArray(b) && !b.length) || [])[0],
		literacy: modsAll(v, 'literacy_impact'), percentage: modsAll(v, 'pop_percentage_impact'),
	};
}
const estates = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/estates'))) {
	estates[k] = {
		taxPerPop: scalar(v, 'tax_per_pop') ?? 0, ruler: scalar(v, 'ruler') === 'yes' ? 1 : 0, bank: scalar(v, 'bank') === 'yes' ? 1 : 0,
		privateArmyPerPop: scalar(v, 'private_army_per_pop'),
		satisfaction: modsAll(v, 'satisfaction'), power: modsAll(v, 'power'), highPower: modsAll(v, 'high_power'), lowPower: modsAll(v, 'low_power'),
	};
}

// ---- location ranks
const ranks = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/location_ranks'))) {
	ranks[k] = {
		tier: scalar(v, 'tier'), modifier: modsAll(v, 'rank_modifier'), country: modsAll(v, 'country_modifier'),
		capitalCountry: modsAll(v, 'capital_country_modifier'), upgradeFrom: scalar(v, 'upgrade_from'), buildTime: scalar(v, 'build_time'),
		demand: scalar(v, 'construction_demand'), max: scalar(v, 'max_rank') === 'yes' ? 1 : 0,
		// population needed to upgrade (allow = { population >= N }); megalopolis also needs capital + market center
		minPopulation: (() => { const a = get(v, 'allow'); const p = a && a.find(([x]) => x === 'population'); return p ? num(p[1]) : undefined; })(),
	};
}

// ---- static modifiers (location, province and country ones the engine applies or scales)
const staticMods = {};
for (const [k, v] of Object.entries(loadDb('main_menu/common/static_modifiers'))) {
	const gd = get(v, 'game_data');
	const cat = gd ? scalar(gd, 'category') : undefined;
	const m = mods(v);
	if (m) staticMods[k] = { cat, ...(scalar(gd || [], 'decaying') === 'yes' ? { decaying: 1 } : {}), m };
}

// ---- country auto modifiers: base values (always on) and the scaled ones kept with their scales_with text
const autoDb = loadDb('in_game/common/auto_modifiers');
const countryBase = mods(autoDb.country_base_values);

// ---- goods
const goods = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/goods'))) {
	goods[k] = {
		method: scalar(v, 'method') ?? 'farming', cat: scalar(v, 'category') ?? 'raw_material', price: scalar(v, 'default_market_price') ?? 1,
		food: scalar(v, 'food') ?? 0, transport: scalar(v, 'transport_cost') ?? 1, base: scalar(v, 'base_production') ?? 0,
		...(scalar(v, 'inflation') === 'yes' ? { inflation: 1 } : {}), ...(scalar(v, 'block_rgo_upgrade') === 'yes' ? { blockRgo: 1 } : {}),
		...(scalar(v, 'is_slaves') === 'yes' ? { slaves: 1 } : {}),
		demandAdd: mods(get(v, 'demand_add')), demandMultiply: mods(get(v, 'demand_multiply')),
	};
}

// ---- production methods (files + unique ones written inside buildings) and goods demands
const methods = {};
const methodOf = v => {
	const inputs = {};
	for (const [g, a] of v) if (goods[g] && !Array.isArray(a)) inputs[g] = resolve(a);
	return {
		in: inputs, out: scalar(v, 'produced'), n: scalar(v, 'output') ?? 0, cat: scalar(v, 'category'),
		...(scalar(v, 'no_upkeep') === 'yes' ? { noUpkeep: 1 } : {}), profit: scalar(v, 'debug_max_profit'),
	};
};
for (const [k, v] of Object.entries(loadDb('in_game/common/production_methods'))) methods[k] = methodOf(v);
const demands = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/goods_demand'))) {
	const o = {};
	for (const [g, a] of v) if (goods[g] && !Array.isArray(a)) o[g] = resolve(a);
	demands[k] = { goods: o, cat: scalar(v, 'category') };
}

// ---- prices (gold, manpower, ... per price key)
const prices = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/prices'))) { const m = mods(v); if (m) prices[k] = m; }

// ---- buildings
const RANKS = ['rural_settlement', 'town', 'city', 'megalopolis'];
const buildings = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/building_types'))) {
	const slots = all(v, 'possible_production_methods').map(list => list.map(([x]) => x));
	// each unique_production_methods block is one slot (e.g. the fine cloth guild's cloth slot and its alum slot)
	for (const unique of all(v, 'unique_production_methods')) if (Array.isArray(unique)) {
		const keys = [];
		for (const [pk, pv] of unique) if (Array.isArray(pv)) { methods[pk] = methodOf(pv); keys.push(pk); }
		if (keys.length) slots.push(keys);
	}
	const rankOk = {};
	for (const r of RANKS) { const x = scalar(v, r); if (x !== undefined) rankOk[r] = x === 'yes' ? 1 : 0; }
	buildings[k] = {
		pop: scalar(v, 'pop_type'), emp: scalar(v, 'employment_size'), max: scalar(v, 'max_levels'), cat: scalar(v, 'category'),
		ranks: rankOk, bt: scalar(v, 'build_time'), slots, demand: scalar(v, 'construction_demand'), price: scalar(v, 'price'),
		obsolete: scalar(v, 'obsolete'), estate: scalar(v, 'estate'), foreign: scalar(v, 'is_foreign') === 'yes' ? 1 : 0,
		inc: scalar(v, 'increase_per_level_cost'), special: scalar(v, 'is_special') === 'yes' ? 1 : 0,
		forbiddenForEstates: scalar(v, 'forbidden_for_estates') === 'yes' ? 1 : 0, alwaysDemand: scalar(v, 'always_add_demands') === 'yes' ? 1 : 0,
		mod: modsAll(v, 'modifier'), raw: modsAll(v, 'raw_modifier'), capMod: modsAll(v, 'capital_modifier'),
		capCountry: modsAll(v, 'capital_country_modifier'), mcMod: modsAll(v, 'market_center_modifier'),
		// the potential/allow triggers stay as text for the reader (the simulator does not check them)
		...(get(v, 'location_potential') || get(v, 'allow') ? { needs: true } : {}),
	};
	for (const f of Object.keys(buildings[k])) if (buildings[k][f] === undefined) delete buildings[k][f];
}

// ---- levies, the advances that unlock them, and their units (stats from the battle simulator's units.json)
// A pop raises the eligible levy whose unit has the highest total combat power (levies/readme.txt):
// max_strength x combat_power x (1 + initiative x 0.025) x (1 + (flanking - 1) x 0.3) x (1 + mdd)(1 - mdt)(1 + sdd)(1 - sdt)
const AGE_N = { age_1_traditions: 1, age_2_renaissance: 2, age_3_discovery: 3, age_4_reformation: 4, age_5_absolutism: 5, age_6_revolutions: 6 };
const advancesDb = loadDb('in_game/common/advances');
const unlockedBy = {};
for (const [ak, av] of Object.entries(advancesDb))
	for (const lv of all(av, 'unlock_levy')) (unlockedBy[lv] ??= []).push([ak, AGE_N[scalar(av, 'age')] || 0]);
const UNITS = JSON.parse(fs.readFileSync(path.join(__dirname, '../battle_sim/units.json'), 'utf8')).units;
const levies = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/levies'))) {
	const u = UNITS[scalar(v, 'unit')];
	levies[k] = { unit: scalar(v, 'unit'), size: scalar(v, 'size'), pops: all(v, 'allowed_pop_type'), cultures: all(v, 'allowed_culture'),
		...(get(v, 'country_allow') ? { countryAllow: 1 } : {}), ...(get(v, 'allow') ? { allow: 1 } : {}), ...(get(v, 'allow_as_crew') ? { navy: 1 } : {}),
		...(unlockedBy[k] ? { unlock: unlockedBy[k] } : {}),
		...(u ? { cat: u.c, age: u.a, men: u.s, power: +(u.s * u.p * (1 + u.i * 0.025) * (1 + (u.fl - 1) * 0.3) * (1 + u.mdd) * (1 - u.mdt) * (1 + u.sdd) * (1 - u.sdt)).toFixed(5) } : {}) };
}

// ---- terrain
function terrain(rel) {
	const out = {};
	for (const [k, v] of Object.entries(loadDb(rel))) {
		const p = get(v, 'proximity');
		out[k] = {
			movement: scalar(v, 'movement_cost') ?? 1, defender: scalar(v, 'defender') ?? 0,
			proximity: Array.isArray(p) ? mods(p) : p !== undefined ? resolve(p) : undefined,
			winter: scalar(v, 'winter'), modifier: modsAll(v, 'location_modifier'),
		};
		for (const f of Object.keys(out[k])) if (out[k][f] === undefined) delete out[k][f];
	}
	return out;
}

// ---- locations: id = line order in location_templates.txt, from 1
// [key, topography, vegetation, climate, raw material, harbor suitability, culture, religion, river size, coastal]; river size
// and coastal (borders sea or lake) come from map.json (build_map.js), when it exists
const MAPJ = fs.existsSync(path.join(__dirname, 'map.json')) ? JSON.parse(fs.readFileSync(path.join(__dirname, 'map.json'), 'utf8')).locations : {};
const locations = [];
for (const m of readText('in_game/map_data/location_templates.txt')[0].matchAll(/^([A-Za-z0-9_]+)\s*=\s*\{([^}]*)\}/gm)) {
	const o = {}; for (const kv of m[2].matchAll(/(\w+)\s*=\s*([\w.]+)/g)) o[kv[1]] = kv[2];
	locations.push([m[1], o.topography || '', o.vegetation || '', o.climate || '', o.raw_material || '', o.natural_harbor_suitability ? +o.natural_harbor_suitability : 0, o.culture || '', o.religion || '', 0, 0]);
}
// province and area of every location (map_data/definitions.txt: continent > subcontinent > region > area > province { locations });
// appended as [10] province index into `provinces`, [11] area index into `areas`
const provinces = [], areas = [];
{
	const idOf = new Map(locations.map((l, i) => [l[0], i]));
	const stack = [];
	for (const tok of readText('in_game/map_data/definitions.txt')[0].replace(/^﻿/, '').replace(/#[^\n]*/g, '').match(/\{|\}|[^\s{}=]+/g)) {
		if (tok === '{') continue;
		if (tok === '}') { stack.pop(); continue; }
		if (stack.length === 5) { const i = idOf.get(tok); if (i !== undefined) { locations[i][10] = provinces.length - 1; locations[i][11] = areas.length - 1; } continue; }
		stack.push(tok);
		if (stack.length === 4) areas.push(tok);
		if (stack.length === 5) provinces.push(tok);
	}
}
const WATER = new Set(['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'lakes', 'high_lakes', 'ocean_wasteland']);
for (const [id, ml] of Object.entries(MAPJ)) {
	const l = locations[id - 1];
	if (!l) continue;
	l[8] = ml.river || 0;
	l[9] = !WATER.has(l[1]) && ml.nb.some(([b]) => locations[b - 1] && WATER.has(locations[b - 1][1])) ? 1 : 0;
}

// ---- modifier types: percent / decimals / category / boolean, for display and for global->local pairing
const modifierTypes = {};
for (const root of [GAME, MOD]) {
	const dir = path.join(root, 'main_menu/common/modifier_type_definitions');
	if (!fs.existsSync(dir)) continue;
	for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')))
		for (const [k, v] of parse(fs.readFileSync(path.join(dir, f), 'utf8'))) if (Array.isArray(v)) {
			const gd = get(v, 'game_data') || [];
			modifierTypes[k] = [get(v, 'percent') === 'yes' ? 1 : get(v, 'already_percent') === 'yes' ? 2 : 0, num(get(v, 'decimals')) ?? 2,
				scalar(gd, 'category') || 'all', get(v, 'boolean') === 'yes' ? 1 : 0];
		}
}

// ---- ages: start year, production efficiency multiplier of building levels, market price stability and price clamps
// (min_price is not set by any age file; 0.1 x default price is the engine default fitted from the 1547 save)
const ages = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/age')))
	if (AGE_N[k]) ages[AGE_N[k]] = { key: k, year: scalar(v, 'year'), efficiency: scalar(v, 'efficiency') ?? 1, priceStability: scalar(v, 'price_stability') ?? 0.1,
		maxPrice: scalar(v, 'max_price') ?? 3, minPrice: scalar(v, 'min_price') ?? 0.1 };

// ---- English names for everything kept
const loc = {};
for (const root of [GAME, MOD])
	for (const sub of ['main_menu/localization/english', 'in_game/localization/english']) {
		const dir = path.join(root, sub);
		if (!fs.existsSync(dir)) continue;
		const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			if (e.isDirectory()) walk(path.join(d, e.name));
			else if (e.name.endsWith('.yml')) for (const m of fs.readFileSync(path.join(d, e.name), 'utf8').matchAll(/^\s*([A-Za-z0-9_.]+):\d*\s*"(.*)"\s*$/gm)) loc[m[1]] = m[2];
		} };
		walk(dir);
	}
const clean = (s, d = 0) => (s || '').replace(/\$([A-Za-z0-9_]+)\$/g, (_, k) => d < 3 ? clean(loc[k] || k, d + 1) : k).replace(/\[[^\]]*\]/g, '').replace(/#\w+\s?|#!|@\w+!/g, '').trim();
const names = {};
const nameKeys = [...Object.keys(pops), ...Object.keys(estates), ...Object.keys(ranks), ...Object.keys(goods), ...Object.keys(buildings),
	...Object.keys(methods), ...Object.keys(staticMods), ...locations.map(l => l[0])];
for (const k of nameKeys) if (loc[k]) names[k] = clean(loc[k]);
for (const k of Object.keys(modifierTypes)) if (loc['MODIFIER_TYPE_NAME_' + k]) names['m:' + k] = clean(loc['MODIFIER_TYPE_NAME_' + k]);
for (const t of ['topography', 'vegetation', 'climates']) for (const k of Object.keys(loadDb('in_game/common/' + t))) if (loc[k]) names[k] = clean(loc[k]);

// script values the kept data refers to by name (max levels, sizes...) and that are formulas, not numbers
const used = new Set();
for (const b of Object.values(buildings)) for (const f of ['max', 'emp', 'bt']) if (typeof b[f] === 'string') used.add(b[f]);
for (const l of Object.values(levies)) if (typeof l.size === 'string') used.add(l.size);
const keptScripted = {};
for (const k of used) if (scripted[k]) keptScripted[k] = scripted[k];

const data = {
	built: new Date().toISOString().slice(0, 10), game: '1.4.4',
	defines: Object.fromEntries(KEEP_DEFINES.filter(s => defines[s]).map(s => [s, defines[s]])),
	values, scripted: keptScripted, pops, estates, ranks, ages, static: staticMods, countryBase,
	goods, methods, demands, prices, buildings, levies,
	terrain: { topography: terrain('in_game/common/topography'), vegetation: terrain('in_game/common/vegetation'), climate: terrain('in_game/common/climates') },
	locations, provinces, areas, modifierTypes, names,
};
fs.writeFileSync(OUT, JSON.stringify(data));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB:', Object.keys(buildings).length, 'buildings,', Object.keys(methods).length,
	'production methods,', Object.keys(goods).length, 'goods,', locations.length, 'locations,', Object.keys(staticMods).length, 'static modifiers,',
	Object.keys(keptScripted).length, 'formula script values');
