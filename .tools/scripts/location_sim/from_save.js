// Builds a location simulator scenario from an EU5 save (normal binary save or debug-mode text save).
//   node .tools/scripts/location_sim/from_save.js <save.eu5|latest> --list <TAG> [--top 40]     a country's locations
//   node .tools/scripts/location_sim/from_save.js <save> --location <id|key> [--out scenario.json]
//   node .tools/scripts/location_sim/from_save.js <save> --country <TAG> [--out scenario.json]     every owned location
// The scenario holds the location as the save has it (rank, development, control, pops, buildings, market prices), its
// owner's country modifiers (summed from base values, advances, laws, privileges, reforms, timed modifiers, societal
// values, ruler and cabinet traits and the state religion; "notes" lists every source; the engine adds the estates' satisfaction) and an "observed" block with the game's own numbers to check the simulator against.
const fs = require('fs');
const path = require('path');
const { loadDb, get, openSave, latestSave, tokenize, parseSaveTokens } = require('../battle_sim/paradox.js');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const saveArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const file = !saveArg || saveArg === 'latest' ? latestSave() : saveArg;
if (!file) throw new Error('no save found');
const save = openSave(file);
const isText = !!save.text;
const N = x => (x === undefined || x === null || x === '' ? undefined : +x);
const list = x => (x === undefined ? [] : Array.isArray(x) ? x : x.__list || (typeof x === 'object' ? Object.values(x) : String(x).trim().split(/\s+/)));

// ---- one entry of a save section (text saves: found by its indentation, without parsing the whole section)
const INDENT = { countries: '', locations: '\t\t', population: '', market_manager: '', provinces: '', building_manager: '' };
function entry(section, id) {
	if (isText) return save.entry(section, id, INDENT[section]);
	const s = save.section(section);
	return (s.database && s.database[id]) || (s.locations && s.locations[id]) || s[id] || null;
}
const locKeys = DATA.locations.map(l => l[0]);
const locId = q => /^\d+$/.test(q) ? +q : locKeys.indexOf(q) + 1;
const locKey = id => locKeys[+id - 1];

// country tag <-> id
function countryIds() {
	if (isText) {
		const t = save.sectionText('countries');
		const i = t.indexOf('tags={');
		const block = t.slice(i, t.indexOf('}', i));
		const out = {};
		for (const m of block.matchAll(/(\d+)=([A-Za-z0-9_]+)/g)) out[m[1]] = m[2];
		return out;
	}
	return save.section('countries').tags;
}
const tags = countryIds();
const idOfTag = tag => Object.keys(tags).find(id => tags[id] === tag);

// buildings in a location
function buildingsAt(lid) {
	const out = [];
	if (isText) {
		const t = save.sectionText('building_manager');
		const re = new RegExp('\\n\\tlocation=' + lid + '\\n', 'g');
		let m;
		while ((m = re.exec(t))) {
			const start = t.lastIndexOf('\n', t.lastIndexOf('={', m.index)) + 1;
			const id = (/^(\d+)=\{/.exec(t.slice(start, start + 20)) || [])[1];
			if (id) out.push({ id, ...save.entry('building_manager', id, '') });
		}
		return out;
	}
	for (const [id, b] of Object.entries(save.section('building_manager').database || {})) if (b && +b.location === +lid) out.push({ id, ...b });
	return out;
}

// ---- the owner's country modifiers (a partial sum; see notes)
const advances = loadDb('in_game/common/advances');
const laws = loadDb('in_game/common/laws');
const privileges = loadDb('in_game/common/estate_privileges');
const reforms = loadDb('in_game/common/government_reforms');
const societal = loadDb('in_game/common/societal_values');
const religionsDb = loadDb('in_game/common/religions');
const traitsDb = loadDb('in_game/common/traits');
const ordersDb = loadDb('in_game/common/chivalric_orders');
const policies = {};
for (const law of Object.values(laws)) for (const [k, v] of law) if (Array.isArray(v) && (get(v, 'country_modifier') || get(v, 'location_modifier'))) policies[k] = v;
// adds a modifier block to acc, with each key's sources in acc.__src (key -> [[source, value]])
function addBlock(acc, notes, source, block, scale = 1) {
	if (!Array.isArray(block)) return;
	const parts = [];
	const src = (acc.__src ??= {});
	for (const [k, v] of block) {
		if (Array.isArray(v)) continue;
		let x = parseFloat(v);
		if (!Number.isFinite(x) && DATA.values[v] !== undefined) x = DATA.values[v];
		if (!Number.isFinite(x) || !x || !DATA.modifierTypes[k]) continue;
		acc[k] = +((acc[k] || 0) + x * scale).toFixed(6);
		(src[k] ??= []).push([source, +(x * scale).toFixed(6)]);
		parts.push(`${k} ${x * scale > 0 ? '+' : ''}${+(x * scale).toFixed(4)}`);
	}
	if (parts.length) notes.push(`${source}: ${parts.join(', ')}`);
}
const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => k !== '__src'));
function countryContext(cid) {
	const c = entry('countries', cid);
	const acc = {}, notes = [], locMods = {}, locNotes = [], locObjects = [];
	addBlock(acc, notes, 'base values', Object.entries(DATA.countryBase).map(([k, v]) => [k, String(v)]));
	for (const adv of Object.keys(c.researched_advances || {})) addBlock(acc, notes, `advance ${adv}`, advances[adv]);
	const gov = c.government || {};
	for (const [law, v] of Object.entries(gov.implemented_laws || {})) {
		const p = policies[v.object] || [];
		addBlock(acc, notes, `law ${law} = ${v.object}`, get(p, 'country_modifier'));
		if (DATA.locationObjects[v.object]) locObjects.push(v.object);
	}
	for (const p of list(gov.implemented_privileges)) {
		const d = privileges[p.object] || [];
		addBlock(acc, notes, `privilege ${p.object}`, get(d, 'country_modifier'));
		if (DATA.locationObjects[p.object]) locObjects.push(p.object);
	}
	for (const r of list(gov.implemented_reforms)) {
		const d = reforms[r.object] || [];
		addBlock(acc, notes, `reform ${r.object}`, get(d, 'country_modifier'));
		if (DATA.locationObjects[r.object]) locObjects.push(r.object);
	}
	for (const t of list((c.timed_modifiers || {}).timed_modifiers)) {
		const s = DATA.static[t.modifier];
		if (s) addBlock(acc, notes, `timed modifier ${t.modifier}`, Object.entries(s.m).map(([k, v]) => [k, String(v)]), +(t.size || 1));
	}
	for (const [sv, val] of Object.entries(gov.societal_values || {})) {
		const x = +val;
		if (!Number.isFinite(x) || x <= -999 || !x || !societal[sv]) continue;
		addBlock(acc, notes, `societal value ${sv} ${x > 0 ? '+' : ''}${x.toFixed(0)}`, get(societal[sv], x < 0 ? 'left_modifier' : 'right_modifier'), Math.abs(x) / 100);
	}
	// the ruler's skills (static ruler_adm / ruler_dip / ruler_mil x the skill) and ruler traits. The skill counts its character
	// modifiers: a chivalric order's character_modifier (Order of the Ermine ADM +15) and timed character modifiers.
	const character = id => save.entry('character_db', id, isText ? '' : undefined) || (isText ? null : (save.section('character_db').database || {})[id]);
	const skillOf = (ch, sk) => {
		let x = +ch[sk] || 0;
		const parts = [];
		const alive = ch.alive_data || {}, order = alive.joined_chivalric_order;
		const v = order && ordersDb[order] ? parseFloat(get(get(ordersDb[order], 'character_modifier') || [], sk)) : NaN;
		if (Number.isFinite(v) && v) { x += v; parts.push(`${order} ${v > 0 ? '+' : ''}${v}`); }
		for (const t of list((alive.timed_modifiers || {}).timed_modifiers)) {
			const m = t && DATA.static[t.modifier] && DATA.static[t.modifier].m[sk];
			if (m) { x += m * (+t.size || 1); parts.push(`${t.modifier} ${m > 0 ? '+' : ''}${m * (+t.size || 1)}`); }
		}
		return [x, parts];
	};
	if (gov.ruler && gov.ruler !== '0') {
		const ch = character(gov.ruler);
		if (ch) for (const sk of ['adm', 'dip', 'mil']) {
			if (ch[sk] === undefined || !DATA.static['ruler_' + sk]) continue;
			const [x, parts] = skillOf(ch, sk);
			addBlock(acc, notes, `ruler ${sk} ${x}${parts.length ? ` (${ch[sk]} ${parts.join(', ')})` : ''}`, Object.entries(DATA.static['ruler_' + sk].m).map(([k, v]) => [k, String(v)]), x);
		}
		if (ch) for (const t of list(ch.traits)) if (get(traitsDb[t] || [], 'category') === 'ruler') addBlock(acc, notes, `ruler trait ${t}`, get(traitsDb[t], 'modifier'));
	}
	// cabinet members' cabinet traits (Tax Optimizer +1% tax efficiency...)
	for (const eid of list(gov.cabinet_entries)) {
		const ce = entry('cabinet_manager', eid), ch = ce && ce.character ? character(ce.character) : null;
		if (ch) for (const t of list(ch.traits)) if (get(traitsDb[t] || [], 'category') === 'cabinet') addBlock(acc, notes, `cabinet trait ${t}`, get(traitsDb[t], 'modifier'));
	}
	// the state religion's definition_modifier (Lutheranism +3% tax efficiency...)
	if (c.primary_religion !== undefined) {
		const rel = isText ? save.entry('religion_manager', c.primary_religion, '') : ((save.section('religion_manager') || {}).database || {})[c.primary_religion];
		const key = rel && (rel.key || rel.definition);
		if (key && religionsDb[key]) addBlock(acc, notes, `religion ${key}`, get(religionsDb[key], 'definition_modifier'));
	}
	// capital buildings' capital_country_modifier, x level x staffing x goods access (building_types readme, location_modifier_scales.md)
	if (c.capital) for (const b of buildingsOf(c.capital)) {
		const t = DATA.buildings[b.type];
		if (!t || !t.capCountry || +b.owner !== +cid) continue;
		const size = typeof t.emp === 'number' ? t.emp : 0;
		const staffing = size && b.level ? Math.min(1, (+b.employed || 0) / (size * +b.level)) : 1;
		const pms = Object.keys(b).filter(k => b[k] && typeof b[k] === 'object' && DATA.methods[k]);
		const fill = pms.length ? pms.reduce((a, k) => a + (N(b[k].input) ?? 1), 0) / pms.length : 1;
		addBlock(acc, notes, `capital building ${b.type} ${b.level}`, Object.entries(t.capCountry).map(([k, v]) => [k, String(v)]), +b.level * staffing * fill);
	}
	const econ = c.economy || {};
	const year = +String(save.date() || '1337').split('.')[0];
	const age = +Object.keys(DATA.ages).filter(a => DATA.ages[a].year <= year).sort((a, b) => b - a)[0] || 1;
	return {
		id: +cid, tag: tags[cid], year, age, advances: Object.keys(c.researched_advances || {}), capital: N(c.capital), primaryCulture: N(c.primary_culture), acceptedCultures: list(c.accepted_cultures).map(Number),
		religion: N(c.primary_religion), government: gov.type,
		taxRates: Object.fromEntries(Object.entries(econ.tax_rates || {}).map(([k, v]) => [k, +v])),
		// estates that exist: satisfaction (the engine applies their satisfaction blocks), wealth impact and last month's income lines
		estates: Object.fromEntries(Object.entries(gov.estates || {}).map(([k, eid]) => {
			const e = entry('estate_manager', eid) || {};
			if (e.existence !== 'yes') return [k, {}];
			return [k, { satisfaction: N(e.satisfaction), wealthImpact: N(e.wealth_impact), gold: N(e.gold), autoTaxRate: e.auto_tax_rate === 'yes',
				lastMonth: Object.fromEntries(Object.entries(e.last_month || {}).map(([a, b]) => [a, +b])) }];
		}).filter(([, e]) => e.satisfaction !== undefined)),
		modifiers: strip(acc), sources: acc.__src || {}, locationObjects: locObjects,
		notes: [...notes, ...locObjects.map(k => `location modifier from ${k}`), 'Estate satisfaction effects are applied by the engine from "estates". Not counted: culture, religious aspects and schools, estate power effects (power is not in the save), situations, international organizations, conditional auto modifiers.'],
		observed: {
			manpowerIncome: N(c.last_month_manpower_income), manpowerNet: N(c.monthly_manpower), maxManpower: N(c.max_manpower),
			sailorsIncome: N(c.last_month_sailors_income), maxSailors: N(c.max_sailors), taxIncome: N(c.last_months_tax_income),
			goldIncome: N(c.last_month_gold_income), population: N(c.last_months_population), manpower: N((c.currency_data || {}).manpower),
		},
	};
}

// ---- --list TAG: the country's locations, richest first
if (flag('--list')) {
	const cid = idOfTag(flag('--list'));
	if (!cid) throw new Error('no country ' + flag('--list'));
	const c = entry('countries', cid);
	const rows = [];
	for (const lid of list(c.owned_locations)) {
		const l = entry('locations', lid);
		if (!l) continue;
		rows.push({ lid, key: locKey(lid), rank: l.rank, tax: +l.tax || 0, control: +l.control || 0, dev: +l.development || 0, raw: l.raw_material });
	}
	rows.sort((a, b) => b.tax - a.tax);
	console.log(`${tags[cid]} (${cid}): ${rows.length} locations, capital ${locKey(c.capital)} (${c.capital})`);
	for (const r of rows.slice(0, +(flag('--top') || 40)))
		console.log(`  ${String(r.lid).padStart(6)} ${r.key.padEnd(24)} ${(r.rank || '').padEnd(17)} tax ${r.tax.toFixed(2).padStart(8)}  control ${(100 * r.control).toFixed(0).padStart(3)}%  dev ${r.dev.toFixed(1).padStart(5)}  ${r.raw || ''}`);
	process.exit(0);
}

// ---- fast lookups for many locations (text saves: one pass over the section, then parse single entries)
const indexes = {};
function topIndex(section) {
	if (indexes[section]) return indexes[section];
	const t = save.sectionText(section), at = new Map(), re = /\n(\d+)=\{/g;
	let m;
	while ((m = re.exec(t))) at.set(m[1], m.index + 1);
	return (indexes[section] = { t, at });
}
function rawParse(t, start) {
	let d = 0, k = t.indexOf('{', start);
	for (; k < t.length; k++) { if (t[k] === '{') d++; else if (t[k] === '}') { d--; if (!d) break; } }
	return parseSaveTokens(tokenize(t.slice(t.indexOf('{', start) + 1, k)));
}
function popEntry(pid) {
	if (!isText) return entry('population', pid);
	const ix = topIndex('population'), s = ix.at.get(String(pid));
	return s === undefined ? null : rawParse(ix.t, s);
}
let buildingsByLocation = null;
function buildingsOf(lid) {
	if (!isText) return buildingsAt(lid);
	if (!buildingsByLocation) {
		buildingsByLocation = new Map();
		const ix = topIndex('building_manager'), starts = [...ix.at.entries()].sort((a, b) => a[1] - b[1]);
		for (let i = 0; i < starts.length; i++) {
			const [id, s] = starts[i], e = i + 1 < starts.length ? starts[i + 1][1] : ix.t.length;
			const m = /\n\tlocation=(\d+)/.exec(ix.t.slice(s, Math.min(e, s + 4000)));
			if (m) (buildingsByLocation.get(m[1]) || buildingsByLocation.set(m[1], []).get(m[1])).push([id, s]);
		}
	}
	return (buildingsByLocation.get(String(lid)) || []).map(([id, s]) => ({ id, ...rawParse(indexes.building_manager.t, s) }));
}
// trades routed through each location (their trade path's from_port exports, to_port imports), as goods amounts (size).
// Which trade value the engine sums for location_exports / location_imports is not confirmed; market centers are far above the cap of 100.
let tradePorts = null;
function tradeThrough(lid) {
	if (!tradePorts) {
		tradePorts = new Map();
		let paths = {}, trades = {};
		try { paths = save.section('trade_path_manager').database || {}; trades = save.section('trade_manager').database || {}; } catch { /* older saves */ }
		const add = (loc, k, x) => { if (!loc || loc === '0') return; const r = tradePorts.get(loc) || tradePorts.set(loc, { exports: 0, imports: 0 }).get(loc); r[k] += x; };
		for (const t of Object.values(trades)) {
			const p = t && paths[t.trade_path];
			if (!p || typeof p !== 'object') continue;
			add(p.from_port, 'exports', +t.size || 0);
			add(p.to_port, 'imports', +t.size || 0);
		}
	}
	const r = tradePorts.get(String(lid));
	return r ? { exports: +r.exports.toFixed(3), imports: +r.imports.toFixed(3) } : null;
}
const marketCache = new Map();
const marketOf = id => { if (!marketCache.has(id)) marketCache.set(id, entry('market_manager', id)); return marketCache.get(id); };

// ---- one location: its scenario fields and the game's own numbers
function locationScenario(lid, country) {
	const l = entry('locations', lid);
	if (!l) return null;
	const [key, topography, vegetation, climate, rawTemplate, harbor] = DATA.locations[lid - 1];
	const pops = [];
	for (const pid of list((l.population || {}).pops)) {
		const p = popEntry(pid);
		if (!p) continue;
		pops.push({ type: p.type, estate: p.estate, size: N(p.size), status: p.status || 'none', culture: N(p.culture), religion: N(p.religion),
			satisfaction: N(p.satisfaction) ?? 0, literacy: N(p.literacy) ?? 0, ...(p.building ? { building: N(p.building) } : {}) });
	}
	const buildings = buildingsOf(lid).map(b => {
		// every active production method (one per slot) and its input fill fraction (input=, 1 when nothing is missing)
		const pms = Object.keys(b).filter(k => b[k] && typeof b[k] === 'object' && DATA.methods[k]);
		const fills = pms.map(k => N(b[k].input) ?? 1);
		return { type: b.type, level: N(b.level), employed: N(b.employed), owner: N(b.owner), ...(+b.owner !== +l.owner ? { foreign: 1 } : {}),
			...(pms.length ? { methods: pms } : {}), ...(fills.some(x => x < 1) ? { inputFill: fills } : {}), ...(b.last_months_profit !== undefined ? { profit: N(b.last_months_profit) } : {}), ...(b.upkeep !== undefined ? { upkeep: N(b.upkeep) } : {}) };
	});
	const market = l.market ? marketOf(l.market) : null;
	const province = l.province ? entry('provinces', l.province) : null;
	const stats = (l.population || {}).pop_stats || {};
	return {
		location: {
			id: lid, key, rank: l.rank, topography, vegetation, climate, rawMaterial: l.raw_material || rawTemplate, harbor,
			development: N(l.development), prosperity: N(l.prosperity) ?? 0, control: N(l.control) ?? 0, proximity: N(l.proximity) ?? 0,
			integration: l.integration || (l.cores && list(l.cores).map(Number).includes(+l.owner) ? 'core' : 'conquered'),
			capital: +country.capital === lid, marketCenter: !!market && +market.center === lid, roadToCapital: l.road_to_capital === 'yes',
			rgoWorkers: N(l.max_raw_material_workers), garrison: N(l.garrison),
			...(townRightsOf(lid).length ? { townRights: townRightsOf(lid) } : {}),
			...(tradeThrough(lid) ? { trade: tradeThrough(lid) } : {}),
			// timed location modifiers (event modifiers such as quality_merino_wool) with their size
			timedModifiers: list((l.timed_modifiers || {}).timed_modifiers).filter(t => t && t.modifier).map(t => [t.modifier, N(t.size) ?? 1]),
			province: N(l.province), market: N(l.market), marketAccess: N(l.market_access),
			pops, buildings,
		},
		observed: {
			tax: N(l.tax), possibleTax: N(l.possible_tax), estateTax: Object.fromEntries(Object.entries(l.estate_tax || {}).map(([k, v]) => [k, +v])),
			estatePossibleTax: Object.fromEntries(Object.entries(l.estate_possible_tax || {}).map(([k, v]) => [k, +v])), valueFlow: N(l.value_flow),
			proximityPropagation: N(l.local_proximity_propagation),
			popStats: Object.fromEntries(Object.entries(stats).map(([t, s]) => [t, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, +b])) : +v]))])),
			province: province ? { food: N((province.food || {}).current), maxFood: N(province.max_food_value), foodChange: N(province.cached_food_change),
				surplusGrowth: N(province.food_surplus_growth_term), storageGrowth: N(province.food_storage_growth_term), levies: province.army_levies || undefined } : undefined,
		},
	};
}
const pricesOf = id => {
	const m = id ? marketOf(id) : null, prices = {};
	if (m && m.goods) for (const [g, v] of Object.entries(m.goods)) if (v && v.price !== undefined) prices[g] = +v.price;
	return prices;
};
const foodPriceOf = id => { const m = id ? marketOf(id) : null; return m && m.price !== undefined ? +m.price : undefined; };
// a market's goods as the save has them: price, supply and demand by source, stockpile (for the country mode's market layer)
const num1 = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [k, +v]));
function marketDetail(id) {
	const m = id ? marketOf(id) : null;
	if (!m) return {};
	const goods = {};
	for (const [g, v] of Object.entries(m.goods || {})) if (v && typeof v === 'object' && v.price !== undefined)
		goods[g] = { price: +v.price, supplied: num1(v.supplied), production: num1(v.production_supplied), demanded: num1(v.demanded), stockpile: N(v.stockpile) ?? 0 };
	return { center: N(m.center), members: list(m.members).map(Number), foodPrice: foodPriceOf(id), food: N(m.food), maxFood: N(m.max), foodTrade: N(m.trade) ?? 0, goods };
}
const write = scenario => {
	const out = flag('--out');
	if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(scenario, null, '\t')); console.log('wrote', out); }
	else console.log(JSON.stringify(scenario, null, '\t'));
};

// town rights by location (townrights_manager: id = { location type })
let rightsByLocation = null;
function townRightsOf(lid) {
	if (!rightsByLocation) {
		rightsByLocation = new Map();
		const add = (loc, type) => { if (loc && type && type !== 'none') (rightsByLocation.get(String(loc)) || rightsByLocation.set(String(loc), []).get(String(loc))).push(type); };
		if (isText) for (const m of save.sectionText('townrights_manager').matchAll(/\n\d+=\{\n\tlocation=(\d+)\n\ttype=([a-z_0-9]+)/g)) add(m[1], m[2]);
		else for (const r of Object.values((save.section('townrights_manager') || {}).database || {})) if (r && typeof r === 'object') add(r.location, r.type);
	}
	return rightsByLocation.get(String(lid)) || [];
}

// ---- roads between the given locations ([a, b, type]) and the country's maritime presence per sea zone (0-100), for proximity
function roadsAmong(ids) {
	const own = new Set(ids.map(Number)), out = [];
	if (isText) {
		for (const m of save.sectionText('road_network').matchAll(/from=(\d+)\s+to=(\d+)\s+type=([a-z_]+)/g))
			if (own.has(+m[1]) && own.has(+m[2])) out.push([+m[1], +m[2], m[3]]);
	} else for (const r of list((save.section('road_network') || {}).roads)) if (own.has(+r.from) && own.has(+r.to)) out.push([+r.from, +r.to, r.type]);
	return out;
}
function maritimeOf(cid) {
	const out = {};
	if (isText) {
		const t = save.sectionText('maritime_manager'), re = /\n\t\t(\d+)=\{([\s\S]*?)\n\t\t\}/g;
		let m;
		while ((m = re.exec(t))) for (const p of m[2].matchAll(/power=([\d.\-]+)\s+country=(\d+)/g)) if (p[2] === String(cid)) out[m[1]] = +p[1];
	} else for (const [z, o] of Object.entries((save.section('maritime_manager') || {}).objects || {}))
		for (const p of list((o || {}).presences)) if (String(p.country) === String(cid)) out[z] = +p.power;
	return out;
}

// ---- --country TAG: every owned location (the country mode), markets by id
if (flag('--country')) {
	const cid = idOfTag(flag('--country'));
	if (!cid) throw new Error('no country ' + flag('--country'));
	const country = countryContext(cid);
	const c = entry('countries', cid);
	const locations = [], observed = {}, markets = {};
	for (const lid of list(c.owned_locations)) {
		const s = locationScenario(+lid, country);
		if (!s) continue;
		locations.push(s.location);
		observed[lid] = s.observed;
		if (s.location.market && !markets[s.location.market]) markets[s.location.market] = { prices: pricesOf(s.location.market), ...marketDetail(s.location.market) };
	}
	write({ name: `${tags[cid]} ${save.date()}`, source: path.basename(file), capital: country.capital, country, locations, markets, observed,
		roads: roadsAmong(locations.map(l => l.id)), maritime: maritimeOf(cid),
		// the save's proximity tree (parent of each node; sea zones keep their value), to check the proximity search
		proximityCache: Object.fromEntries(Object.entries(c.proximity_persistent_cache || {}).filter(([, v]) => v && typeof v === 'object')
			.map(([k, v]) => [k, { parent: N(v.proximity_parent), sea: N(v.sea_zone_proximity) }])) });
	process.exit(0);
}

// ---- --location: one location as a scenario
const q = flag('--location');
if (!q) { console.error('usage: from_save.js <save|latest> --list TAG | --location <id|key> | --country TAG  [--out file.json]'); process.exit(1); }
const lid = locId(q);
const first = entry('locations', lid);
if (!first) throw new Error('no location ' + q);
const country = countryContext(first.owner);
const s = locationScenario(lid, country);
write({ name: `${s.location.key} (${tags[first.owner]}) ${save.date()}`, source: path.basename(file), location: s.location, country,
	market: { id: s.location.market, prices: pricesOf(s.location.market), foodPrice: foodPriceOf(s.location.market) }, observed: s.observed });
