// Builds a battle scenario from an EU5 save: a normal (binary) save or a debug-mode text save.
//   node .tools/scripts/battle_sim/from_save.js <save.eu5|latest> --list                     armies with their location
//   node .tools/scripts/battle_sim/from_save.js <save> --attacker <army id|TAG> --defender <army id|TAG>
//        [--at <location key>] [--out scenario.json]
// Regiments keep their men, morale, experience and section (the army formation's "box"). Generals add their trait
// modifiers and skill modifiers (static_modifiers/character.txt). Country combat values are summed from base values,
// advances, laws, privileges, timed modifiers, societal values, army tradition and war exhaustion; the scenario's
// "notes" list every source so they can be checked against the game's military tab.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { GAME, loadDb, get, openSave, latestSave } = require('./paradox.js');
const UNITS = JSON.parse(fs.readFileSync(path.join(__dirname, 'units.json'), 'utf8')).units;

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const saveArg = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);
const file = !saveArg || saveArg === 'latest' ? latestSave() : saveArg;
if (!file) throw new Error('no save found');
const save = openSave(file);

// ---- game data
const templates = {};
for (const m of fs.readFileSync(path.join(GAME, 'in_game/map_data/location_templates.txt'), 'utf8').matchAll(/^([a-z0-9_]+)\s*=\s*\{([^}]*)\}/gm)) {
	const o = {}; for (const kv of m[2].matchAll(/(\w+)\s*=\s*(\w+)/g)) o[kv[1]] = kv[2];
	templates[m[1]] = o;
}
const locKeys = Object.keys(templates); // location id = order in location_templates.txt, from 1
const locKey = id => locKeys[+id - 1];

const FIELD = {
	discipline: 'discipline', military_tactics: 'tactics', land_morale_modifier: 'moraleMod', land_morale: 'moraleFlat',
	army_initiative: 'initiativeMod', combat_speed_modifier: 'speedMod', levy_combat_efficiency_modifier: 'levyCE',
	army_light_infantry_power: 'power.li', army_heavy_infantry_power: 'power.hi', army_light_cavalry_power: 'power.lc',
	army_heavy_cavalry_power: 'power.hc', army_artillery_power: 'power.art', army_auxiliary_power: 'power.aux',
	damage_done_versus_heretics_modifier: 'vsHeretic', damage_done_versus_heathens_modifier: 'vsHeathen',
	army_maintenance_efficiency: 'maintenanceEfficiency', army_reinforce_efficiency: 'reinforceEfficiency',
	regiment_reinforcement_speed: 'reinforceSpeed', levy_maintenance_modifier: 'levyMaintenance',
	land_morale_movement_cost: 'movementCost', correct_box_chance: 'correctBoxChance', commander_combat_bonus: 'commanderDice',
	possible_frontage_modifier: 'frontageMod',
};
// army_<category>_<build|reinforce|maintenance>_cost_modifier -> costMod.<kind>.<category>
const CAT_KEY = { light_infantry: 'li', heavy_infantry: 'hi', light_cavalry: 'lc', heavy_cavalry: 'hc', artillery: 'art', auxiliary: 'aux' };
for (const [k, c] of Object.entries(CAT_KEY)) for (const kind of ['build', 'reinforce', 'maintenance']) FIELD[`army_${k}_${kind}_cost_modifier`] = `costMod.${kind}.${c}`;
const autoMods = loadDb('in_game/common/auto_modifiers');
const advances = loadDb('in_game/common/advances');
const laws = loadDb('in_game/common/laws');
const privileges = loadDb('in_game/common/estate_privileges');
const societal = loadDb('in_game/common/societal_values');
const traits = loadDb('in_game/common/traits');
const staticMods = { ...loadDb('main_menu/common/static_modifiers') };
const ranks = loadDb('in_game/common/location_ranks');
const policies = {};
for (const law of Object.values(laws)) for (const [k, v] of law) if (Array.isArray(v) && get(v, 'country_modifier')) policies[k] = v;

// add the combat modifiers of one modifier block, scaled
function addBlock(acc, notes, source, block, scale = 1) {
	if (!Array.isArray(block)) return;
	for (const [k, v] of block) {
		const f = FIELD[k];
		const x = parseFloat(v);
		if (!f || !Number.isFinite(x) || !x) continue;
		acc[f] = (acc[f] || 0) + x * scale;
		notes.push(`${source}: ${k} ${x * scale > 0 ? '+' : ''}${+(x * scale).toFixed(4)}`);
	}
}
// "power.hc" / "costMod.build.hc" -> nested fields
function setField(o, f, x) {
	const ks = f.split('.');
	let t = o;
	for (const k of ks.slice(0, -1)) t = t[k] ??= {};
	const last = ks[ks.length - 1];
	t[last] = +((t[last] || 0) + x).toFixed(4);
}
function countryStats(id) {
	const c = save.entry('countries', id);
	const acc = {}, notes = [];
	const cur = c.currency_data || {};
	addBlock(acc, notes, 'base values', autoMods.country_base_values);
	// simple scaled auto modifiers (no limit or potential): army tradition, war exhaustion
	for (const [name, key] of [['army_tradition', 'army_tradition'], ['war_exhaustion_impact', 'war_exhaustion']]) {
		const b = autoMods[name]; if (!b) continue;
		const sw = get(b, 'scales_with');
		const mult = Array.isArray(sw) ? parseFloat(get(sw, 'multiply') || 1) : 1;
		addBlock(acc, notes, `${name} (${(+cur[key] || 0).toFixed(1)})`, b, (+cur[key] || 0) * mult);
	}
	// proper_culture_nobles_ratio: nobles of primary or accepted culture / population, x 100, at most 1
	{
		const locs = save.section('locations').locations, pops = save.section('population').database;
		let total = 0, nobles = 0;
		for (const id of [].concat(c.owned_locations || [])) for (const pid of [].concat(locs[id]?.population?.pops || [])) {
			const p = pops[pid];
			if (!p) continue;
			total += +p.size || 0;
			if (p.type === 'nobles' && (p.status === 'Primary' || p.status === 'Accepted')) nobles += +p.size || 0;
		}
		const ratio = total ? Math.min(1, nobles / total * 100) : 0;
		addBlock(acc, notes, `proper_culture_nobles_ratio (${(100 * nobles / (total || 1)).toFixed(2)}% nobles)`, autoMods.proper_culture_nobles_ratio, ratio);
	}
	for (const adv of Object.keys(c.researched_advances || {})) addBlock(acc, notes, `advance ${adv}`, advances[adv]);
	for (const [law, v] of Object.entries((c.government || {}).implemented_laws || {})) addBlock(acc, notes, `law ${law} = ${v.object}`, get(policies[v.object] || [], 'country_modifier'));
	for (const p of [].concat((c.government || {}).implemented_privileges || [])) addBlock(acc, notes, `privilege ${p.object}`, get(privileges[p.object] || [], 'country_modifier'));
	for (const t of [].concat((c.timed_modifiers || {}).timed_modifiers || [])) addBlock(acc, notes, `timed modifier ${t.modifier}`, staticMods[t.modifier], +(t.size || 1));
	for (const [sv, val] of Object.entries((c.government || {}).societal_values || {})) {
		const x = +val; if (!Number.isFinite(x) || x <= -999 || !x || !societal[sv]) continue;
		addBlock(acc, notes, `societal value ${sv} ${x > 0 ? '+' : ''}${(+x).toFixed(0)}`, get(societal[sv], x < 0 ? 'left_modifier' : 'right_modifier'), Math.abs(x) / 100);
	}
	const out = { tactics: 0, movementCost: 0 };
	for (const [f, x] of Object.entries(acc)) setField(out, f, x);
	return {
		tag: c.country_name, stats: out, notes,
		// monthly_manpower = net change a month (income minus the upkeep of all the country's armies)
		manpower: { max: +(c.max_manpower || 0) * 1000, income: +(c.last_month_manpower_income || 0) * 1000, surplus: +(c.monthly_manpower || 0) * 1000, current: +(cur.manpower || 0) * 1000 },
		religion: c.primary_religion,
	};
}
// a general's own modifiers: traits plus skill-scaled static modifiers
function generalMods(charId) {
	const ch = save.entry('character_db', charId);
	if (!ch) return null;
	const acc = {}, notes = [];
	for (const t of [].concat(ch.traits || [])) addBlock(acc, notes, `trait ${t}`, get(traits[t] || [], 'modifier'));
	for (const sk of ['adm', 'dip', 'mil']) addBlock(acc, notes, `${sk} ${ch[sk]}`, staticMods['general_' + sk], +ch[sk] || 0);
	return { name: `${ch.first_name || ''} ${ch.last_name || ''}`.trim(), adm: +ch.adm, dip: +ch.dip, mil: +ch.mil, traits: [].concat(ch.traits || []), acc, notes };
}

// ---- armies
const subunits = save.section('subunit_manager').database;
const units = save.section('unit_manager').database;
const tags = save.section('countries').tags;
const tagOf = id => tags[id];
const regimentsOf = {};
for (const [id, s] of Object.entries(subunits)) if (s && typeof s === 'object' && s.unit && s.unit !== '0') (regimentsOf[s.unit] ||= []).push({ id, ...s });
const armies = Object.entries(units).filter(([id, u]) => u && u.is_army === 'yes' && regimentsOf[id]).map(([id, u]) => ({ id, u, regs: regimentsOf[id] }));

if (args.includes('--list')) {
	for (const a of armies.sort((x, y) => (tagOf(x.u.country) || '').localeCompare(tagOf(y.u.country) || ''))) {
		const types = {};
		for (const r of a.regs) types[r.type] = (types[r.type] || 0) + 1;
		console.log(`${a.id.padStart(10)} ${tagOf(a.u.country)} at ${locKey(a.u.location)} (${a.u.location}): ${Object.entries(types).map(([t, n]) => `${n} ${t}`).join(', ')}${a.u.leader ? ` · general ${a.u.leader}` : ''}`);
	}
	process.exit(0);
}
const pick = q => {
	if (!q) throw new Error('give --attacker and --defender (an army id from --list, or a country tag for all its armies)');
	const byId = armies.filter(a => a.id === q);
	if (byId.length) return byId;
	const byTag = armies.filter(a => tagOf(a.u.country) === q);
	if (!byTag.length) throw new Error('no army ' + q);
	return byTag;
};
const att = pick(flag('--attacker')), def = pick(flag('--defender'));
const at = flag('--at') || locKey(def[0].u.location);

// ---- map: shared border of two locations and rivers along it / inside the location
function pngRows(file, onRow) {
	const b = fs.readFileSync(file);
	const w = b.readUInt32BE(16), h = b.readUInt32BE(20), bpp = b[25] === 2 ? 3 : 1;
	let p = 8; const idat = [];
	while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8); if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
	const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
	let prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
	for (let y = 0; y < h; y++) {
		const off = y * (stride + 1), f = raw[off];
		for (let x = 0; x < stride; x++) {
			const r = raw[off + 1 + x], a = x >= bpp ? cur[x - bpp] : 0, up = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
			let v;
			if (f === 0) v = r; else if (f === 1) v = r + a; else if (f === 2) v = r + up; else if (f === 3) v = r + ((a + up) >> 1);
			else { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
			cur[x] = v & 255;
		}
		onRow(y, cur, w);
		[prev, cur] = [cur, prev];
	}
}
function mapCheck(from, to) {
	const MAP = path.join(GAME, 'in_game/map_data/');
	const colors = {};
	for (const m of fs.readFileSync(MAP + 'named_locations/00_default.txt', 'utf8').matchAll(/^\s*([a-z0-9_]+)\s*=\s*([0-9a-f]{6})/gm)) colors[m[1]] = parseInt(m[2], 16);
	const ca = from ? colors[from] : -1, cb = colors[to];
	const border = new Set(), inside = [];
	let prevRow = null;
	pngRows(MAP + 'locations.png', (y, row, w) => {
		const col = x => (row[x * 3] << 16) | (row[x * 3 + 1] << 8) | row[x * 3 + 2];
		for (let x = 0; x < w; x++) {
			const c = col(x);
			if (c === cb && inside.length < 20000) inside.push(y * w + x);
			if (ca < 0 || (c !== ca && c !== cb)) continue;
			const other = c === ca ? cb : ca;
			if ((x > 0 && col(x - 1) === other) || (x < w - 1 && col(x + 1) === other)) border.add(y * w + x);
			if (prevRow && ((prevRow[x * 3] << 16) | (prevRow[x * 3 + 1] << 8) | prevRow[x * 3 + 2]) === other) { border.add(y * w + x); border.add((y - 1) * w + x); }
		}
		prevRow = Buffer.from(row);
	});
	const near = new Set();
	const W = 16384;
	for (const i of border) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) near.add(i + dy * W + dx);
	const ins = new Set(inside);
	let riverBorder = 0, riverInside = 0;
	pngRows(MAP + 'rivers.png', (y, row, w) => {
		for (let x = 0; x < w; x++) {
			if (row[x] >= 254) continue;
			const i = y * w + x;
			if (near.has(i)) riverBorder++;
			if (ins.has(i)) riverInside++;
		}
	});
	return { adjacent: border.size > 0, crossing: riverBorder >= 5, river: riverInside > 0 };
}

// ---- scenario
const SECTION = { Left: 'L', Right: 'R' }; // no box = Center
const countries = {};
const countryCache = {};
const sideArmies = list => list.map(a => {
	const cid = a.u.country;
	const cs = countryCache[cid] ??= countryStats(cid);
	let code = cs.tag;
	const gen = a.u.leader ? generalMods(a.u.leader) : null;
	if (gen) {
		code = `${cs.tag} (${gen.name})`;
		const st = JSON.parse(JSON.stringify(cs.stats));
		for (const [f, x] of Object.entries(gen.acc)) setField(st, f, x);
		countries[code] = { ...st, notes: [...cs.notes, ...gen.notes.map(n => 'general ' + n)] };
	} else countries[code] = { ...cs.stats, notes: cs.notes };
	const groups = new Map();
	for (const r of a.regs) {
		const u = UNITS[r.type];
		if (!u) { console.error('unknown unit type ' + r.type); continue; }
		const str = +r.strength || 0;
		const g = {
			type: r.type,
			strength: +Math.min(1, str / u.s).toFixed(4),
			...(str > u.s ? { maxStrength: +(str / u.s).toFixed(4) } : {}),
			moraleAbs: +(+r.morale || 0).toFixed(4),
			...(r.experience ? { experience: +(+r.experience).toFixed(2) } : {}),
			...(r.levies || u.levy ? { levy: true } : {}),
			...(u.aux ? {} : { section: SECTION[r.box] || 'C' }),
		};
		const key = JSON.stringify(g);
		groups.set(key, { ...g, count: (groups.get(key)?.count || 0) + 1 });
	}
	return {
		name: `${cs.tag} army ${a.id}${gen ? ` (${gen.name}, ${gen.adm}/${gen.dip}/${gen.mil})` : ''}`,
		country: code, formation: a.u.unit_formation_preference === 'cav_inf_cav' ? 'cav_inf_cav' : 'balanced',
		from: locKey(a.u.location), units: [...groups.values()].map(({ count, ...g }) => ({ type: g.type, count, ...g })),
	};
});
const A = sideArmies(att), Dd = sideArmies(def);
const t = templates[at] || {};
const fromLoc = A[0].from !== at ? A[0].from : null;
const map = mapCheck(fromLoc, at);
const rankOf = (save.section('locations').locations[locKeys.indexOf(at) + 1] || {}).rank || null;
const rankFront = rankOf && ranks[rankOf] ? parseFloat((JSON.stringify(ranks[rankOf]).match(/"local_frontage_allowed","(-?[\d.]+)"/) || [])[1] || 0) : 0;
const scn = {
	name: `${att.map(a => tagOf(a.u.country)).join('+')} attacks ${def.map(a => tagOf(a.u.country)).join('+')} at ${at} (${save.date()}, ${path.basename(file)})`,
	runs: 2000,
	location: {
		topography: t.topography, vegetation: t.vegetation, climate: t.climate, river: map.river,
		crossing: fromLoc && map.crossing ? 'river' : 'none', rank: rankOf, rankFrontage: rankFront,
	},
	countries,
	attacker: { armies: A.map(({ from, ...a }) => ({ ...a, arrivalDay: 0 })) },
	defender: { armies: Dd.map(({ from, ...a }) => ({ ...a, arrivalDay: 0 })) },
	war: {
		battles: 6, monthsBetweenBattles: 3,
		sides: [att, def].map(list => { const m = countryCache[list[0].u.country].manpower; return { maxManpower: Math.round(m.max), surplusManpower: Math.round(m.surplus), currentManpower: Math.round(m.current) }; }),
	},
	source: { save: path.basename(file), attackerFrom: fromLoc, adjacent: map.adjacent },
};
const out = flag('--out');
const json = JSON.stringify(scn, null, '\t').replace(/\{\s*"type": ([^{}]+?)\s*\}/g, (m, body) => '{ "type": ' + body.replace(/\s*\n\s*/g, ' ') + ' }');
if (out) { fs.writeFileSync(out, json + '\n'); console.log('wrote ' + out); } else console.log(json);
