// Builds units.json for the battle simulator: every army unit type of vanilla EU5 + Ars Belli,
// with its effective combat stats, plus terrain data.
//   node .tools/scripts/battle_sim/build_units.js [gameDir]
// Stat rules (in_game/common/levies/readme.txt): every numeric stat line is ADDITIVE. A unit's value is
// its parent's accumulated value (copy_from) plus its own line, and the category value is added on top.
const fs = require('fs');
const path = require('path');
const GAME = process.argv[2] || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const MOD = path.resolve(__dirname, '../../..');
const OUT = path.join(__dirname, 'units.json');

const ADDITIVE = new Set(['max_strength', 'combat_power', 'frontage', 'combat_speed', 'initiative', 'flanking_ability',
	'secure_flanks_defense', 'morale_damage_taken', 'strength_damage_taken', 'morale_damage_done', 'strength_damage_done',
	'bombard_efficiency', 'artillery_barrage', 'damage_taken', 'movement_speed', 'attrition_loss', 'supply_weight']);

// Minimal Paradox script parser: returns [[key, value]] where value is a string or a nested list.
function parse(text) {
	const toks = text.replace(/^\uFEFF/, '').replace(/#[^\n]*/g, '').match(/"[^"]*"|[{}=]|[^\s{}=]+/g) || [];
	let i = 0;
	const block = () => {
		const out = [];
		while (i < toks.length && toks[i] !== '}') {
			const k = toks[i++];
			if (toks[i] === '=') {
				i++;
				if (toks[i] === '{') { i++; out.push([k, block()]); i++; } else out.push([k, (toks[i++] || '').replace(/"/g, '')]);
			} else if (k === '{') { block(); i++; } else out.push([k, true]);
		}
		return out;
	};
	return block();
}

// Load a database folder from vanilla then the mod; a mod file with the same name replaces the vanilla file.
function loadDb(rel) {
	const files = new Map();
	for (const root of [GAME, MOD]) {
		const dir = path.join(root, rel);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) files.set(f.toLowerCase(), path.join(dir, f));
	}
	const db = {};
	for (const [, file] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		for (const [k, v] of parse(fs.readFileSync(file, 'utf8'))) {
			if (!Array.isArray(v)) continue;
			const m = k.match(/^(REPLACE|INJECT|TRY_REPLACE|REPLACE_OR_CREATE|INJECT_OR_CREATE):(.+)$/);
			if (m && m[1].startsWith('INJECT') && db[m[2]]) db[m[2]] = db[m[2]].concat(v);
			else db[m ? m[2] : k] = v;
		}
	}
	return db;
}

const cats = loadDb('in_game/common/unit_categories');
const types = loadDb('in_game/common/unit_types');

// Goods: recruitment (construction_demand) and upkeep (maintenance_demand) baskets priced at default_market_price
const demands = loadDb('in_game/common/goods_demand');
const prices = {};
for (const [k, v] of Object.entries(loadDb('in_game/common/goods'))) prices[k] = +((v.find(([x]) => x === 'default_market_price') || [])[1] || 1);
const basketGold = key => {
	const d = demands[key];
	if (!d) return 0;
	return +d.filter(([g]) => g !== 'category').reduce((t, [g, x]) => t + parseFloat(x) * (prices[g] || 1), 0).toFixed(4);
};

function numbers(list) {
	const o = { combat: {} };
	for (const [k, v] of list) {
		if (k === 'combat' && Array.isArray(v)) for (const [t, x] of v) o.combat[t] = (o.combat[t] || 0) + parseFloat(x);
		else if (ADDITIVE.has(k)) o[k] = (o[k] || 0) + parseFloat(v);
		else if (!Array.isArray(v)) o[k] = v;
	}
	return o;
}
const catStats = {};
for (const [k, v] of Object.entries(cats)) if (k.startsWith('army_')) catStats[k] = numbers(v);

const cache = {};
function own(key, seen = new Set()) {
	if (cache[key]) return cache[key];
	const body = types[key];
	if (!body || seen.has(key)) return null;
	seen.add(key);
	const parentKey = (body.find(([k]) => k === 'copy_from') || [])[1];
	const parent = parentKey ? own(parentKey, seen) : null;
	const r = parent ? { ...parent, combat: { ...parent.combat } } : { combat: {} };
	for (const k of ['empty', 'hide']) delete r[k]; // not inherited in practice (templates are empty/hidden)
	const mine = numbers(body);
	for (const [k, v] of Object.entries(mine)) {
		if (k === 'combat') for (const [t, x] of Object.entries(v)) r.combat[t] = (r.combat[t] || 0) + x;
		else if (ADDITIVE.has(k)) r[k] = (r[k] || 0) + v;
		else r[k] = v;
	}
	return (cache[key] = r);
}

// English names
const names = {};
for (const root of [GAME, MOD]) {
	for (const sub of ['main_menu/localization/english', 'in_game/localization/english']) {
		const dir = path.join(root, sub);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.yml'))) {
			for (const m of fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/^\s*([A-Za-z0-9_]+):\d*\s*"(.*)"\s*$/gm)) names[m[1]] = m[2];
		}
	}
}
const cleanName = (s, depth = 0) => (s || '').replace(/\$([A-Za-z0-9_]+)\$/g, (_, k) => depth < 3 ? cleanName(names[k] || k, depth + 1) : k).replace(/#\w+\s?|#!/g, '');

const CAT_SHORT = { army_light_infantry: 'li', army_heavy_infantry: 'hi', army_light_cavalry: 'lc', army_heavy_cavalry: 'hc', army_artillery: 'art', army_auxiliary: 'aux' };
const AGE_N = { age_1_traditions: 1, age_2_renaissance: 2, age_3_discovery: 3, age_4_reformation: 4, age_5_absolutism: 5, age_6_revolutions: 6 };
const units = {};
for (const key of Object.keys(types)) {
	const u = own(key);
	if (!u || !CAT_SHORT[u.category] || (types[key].find(([k]) => k === 'empty') || [])[1] === 'yes') continue;
	const c = catStats[u.category] || { combat: {} };
	const v = k => +(((u[k] || 0) + (c[k] || 0)).toFixed(4));
	const combat = {};
	for (const t of new Set([...Object.keys(c.combat || {}), ...Object.keys(u.combat)])) {
		const x = +(((c.combat[t] || 0) + (u.combat[t] || 0)).toFixed(4));
		if (x) combat[t] = x;
	}
	units[key] = {
		n: cleanName(names[key]) || key, c: CAT_SHORT[u.category], a: AGE_N[u.age] || 0,
		levy: u.levy === 'yes' ? 1 : 0, buildable: u.buildable === 'no' ? 0 : 1, special: u.is_special === 'yes' ? 1 : 0,
		p: v('combat_power'), s: v('max_strength'), i: v('initiative'), cs: v('combat_speed'), f: v('frontage'),
		fl: v('flanking_ability'), sf: v('secure_flanks_defense'), dt: v('damage_taken'),
		sdd: v('strength_damage_done'), sdt: v('strength_damage_taken'), mdd: v('morale_damage_done'), mdt: v('morale_damage_taken'),
		bg: basketGold(u.construction_demand || c.construction_demand), ug: basketGold(u.maintenance_demand || c.maintenance_demand),
		be: v('bombard_efficiency'), bombard: (c.bombard || u.bombard) === 'yes' ? 1 : 0, aux: (c.auxiliary || u.auxiliary) === 'yes' ? 1 : 0,
		...(Object.keys(combat).length ? { ct: combat } : {}),
	};
	if (units[key].hide === undefined && u.hide === 'yes') units[key].hidden = 1;
}

// Terrain: defender dice (attacker gets minus this) and battle frontage change per layer
function terrain(rel) {
	const out = {};
	for (const [k, v] of Object.entries(loadDb(rel))) {
		const d = (v.find(([x]) => x === 'defender') || [])[1];
		const lm = (v.find(([x]) => x === 'location_modifier') || [])[1];
		const fr = Array.isArray(lm) ? (lm.find(([x]) => x === 'local_frontage_allowed') || [])[1] : null;
		out[k] = { defender: d ? +d : 0, frontage: fr ? +fr : 0, name: cleanName(names[k]) || k };
	}
	return out;
}
const data = {
	built: new Date().toISOString().slice(0, 10), game: '1.4.4', prices,
	// category baskets, used for the simulator's generic units
	catCost: Object.fromEntries(Object.entries(CAT_SHORT).map(([k, c]) => [c, { bg: basketGold((cats[k].find(([x]) => x === 'construction_demand') || [])[1]), ug: basketGold((cats[k].find(([x]) => x === 'maintenance_demand') || [])[1]) }])),
	units, terrain: { topography: terrain('in_game/common/topography'), vegetation: terrain('in_game/common/vegetation'), climate: terrain('in_game/common/climates') },
};
fs.writeFileSync(OUT, JSON.stringify(data));
const list = Object.values(units);
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB', list.length, 'army units,', list.filter(u => u.levy).length, 'levy units');
