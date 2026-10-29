// What to build for the most crown tax per ducat. Every building level a location can take, every road the country can
// build or upgrade, and every rank upgrade, priced in gold and scored by what it adds to the country's crown tax a month
// minus the upkeep it adds, once control has settled at its maximum (today's prices; a new level hires idle pops of its
// type only, so where none are idle a production building adds nothing until pops grow).
//   node .tools/scripts/location_sim/investments.js <country scenario.json> [--top 30] [--kinds buildings,roads,ranks]
//        [--location key]   only that location's buildings and rank (roads stay country-wide)
// Prices: a building costs build_price_age_of_<age> (expensive ones expensive_build_price_age_of_<age>) x (1 + per-level
// increase x its levels) x (1 - construction efficiency) x (1 + inflation); a road its price per unit distance x the segment
// length (fitted on 838 roads under construction: centre distance x 0.45 flatland ... 0.67 mountains, about +-12%).
// Not counted: market price changes, development growth (roads, rank), market access gains from roads.
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const CS = require('./country.js');
const MAP = require('./map.json');
CS.setMap(MAP);
const DB = E.DB;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node investments.js <country scenario.json> [--top 30] [--kinds buildings,roads,ranks] [--location key]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const kinds = new Set(String(flag('--kinds', 'buildings,roads,ranks')).split(','));
const onlyLoc = flag('--location');
const nm = k => DB.names[k] || k;
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d);
const t0 = Date.now();

const { state, results } = CS.evaluate(scn);
const C = state.C, mods = k => C.mods.raw(k);
const advances = new Set(scn.country.advances || []);
const inflation = scn.country.inflation || 0;
const capital = scn.capital;
const continentOf = id => (DB.locations[id - 1] || [])[13];
const AGE = ['tradition', 'renaissance', 'discovery', 'reformation', 'absolutism', 'revolution'][Math.max(1, Math.min(6, scn.country.age || 1)) - 1];

// ---- a location's settled numbers: control at its maximum (the same rule as governors.js)
const settle = (site, L, obs) => {
	let r = E.evaluate(site.scn, { L, C, obs });
	// the RGO is capped at whole levels of its maximum size: a town loses the rural +100% max RGO size, so Constantina's
	// silver mines would fall from 17 levels to 11 (a lower maximum shrinks the RGO; a higher one needs expanding first)
	if (L.rawMaterial && L.rgoWorkers !== undefined) {
		const levels = Math.floor(E.maxRgo(L, r.M) + 1e-9);
		if (L.rgoWorkers > levels) {
			L.rgoWorkers = levels;
			if (obs && obs.laborers && obs.laborers.employed_in_rgo !== undefined) obs = { ...obs, laborers: { ...obs.laborers, employed_in_rgo: Math.min(obs.laborers.employed_in_rgo, levels) } };
			r = E.evaluate(site.scn, { L, C, obs });
		}
	}
	if (Math.abs(L.control - r.control.max) > 1e-9) { L.control = r.control.max; r = E.evaluate(site.scn, { L, C, obs }); }
	return r;
};
const clone = L => JSON.parse(JSON.stringify(L));
const net = r => r.tax.crown - r.upkeep;
const base = new Map();
for (const site of state.sites) {
	const L = clone(site.L);
	const r = settle(site, L, site.obs);
	base.set(site, { r, L, crown: r.tax.crown, upkeep: r.upkeep, manpower: r.manpower.monthly });
}

// ---- triggers of location_potential / allow: 1 true, 0 false, null not evaluated (allowed, marked "unchecked")
function trig(block, L, any = false) {
	const val = ([k, op, v]) => {
		const kids = () => Array.isArray(v) ? v : [];
		switch (k) {
			case 'OR': return trig(kids(), L, true);
			case 'AND': return trig(kids(), L);
			case 'NOT': case 'NOR': { const x = trig(kids(), L, true); return x === null ? null : 1 - x; }
			case 'NAND': { const x = trig(kids(), L); return x === null ? null : 1 - x; }
			case 'custom_tooltip': return trig(kids().filter(([x]) => x !== 'text'), L);
			case 'vegetation': return L.vegetation === v ? 1 : 0;
			case 'topography': return L.topography === v ? 1 : 0;
			case 'climate': return L.climate === v ? 1 : 0;
			case 'raw_material': return L.rawMaterial === String(v).replace(/^goods:/, '') ? 1 : 0;
			case 'location_rank': return 'location_rank:' + L.rank === v ? 1 : 0;
			case 'has_building': { const t = String(v).replace(/^building_type:/, ''); return L.buildings.some(b => b.type === t && b.level > 0) ? 1 : 0; }
			case 'is_coastal': return (!!L.coastal === (v === 'yes')) ? 1 : 0;
			case 'has_river': return ((L.river > 0) === (v === 'yes')) ? 1 : 0;
			case 'is_port': return (!!L.port === (v === 'yes')) ? 1 : 0;
			case 'is_capital': case 'counts_as_capital': return (!!L.capital === (v === 'yes')) ? 1 : 0;
			case 'is_market_center': return (!!L.marketCenter === (v === 'yes')) ? 1 : 0;
			case 'has_road_to_capital': return (!!L.roadToCapital === (v === 'yes')) ? 1 : 0;
			case 'is_overseas_for_owner': return ((continentOf(L.id) !== continentOf(capital)) === (v === 'yes')) ? 1 : 0;
			case 'is_city': return ((L.rank !== 'rural_settlement') === (v === 'yes')) ? 1 : 0;
			case 'is_rural': return ((L.rank === 'rural_settlement') === (v === 'yes')) ? 1 : 0;
			case 'has_proximity_source_building': return (L.buildings.some(b => { const t = DB.buildings[b.type]; return t && t.mod && t.mod.local_proximity_source; }) === (v === 'yes')) ? 1 : 0;
			default: return null;
		}
	};
	const r = (block || []).map(val);
	if (any) return r.includes(1) ? 1 : r.includes(null) ? null : 0;
	return r.includes(0) ? 0 : r.includes(null) ? null : 1;
}

// ---- building price in gold
const SOURCES = new Set(['local_governor', 'naval_governor', 'kings_manor', 'lieutenancy', 'itinerant_court_seat']); // governors.js
function buildingPrice(t, level) {
	if (t.price) return null; // estate, religious and special prices
	const p = DB.values[(t.expensive ? 'expensive_' : '') + 'build_price_age_of_' + AGE];
	if (p === undefined) return null;
	const eff = mods('global_build_buildings_efficiency') + (t.cat === 'defense_category' ? mods('global_fort_build_buildings_efficiency') : 0)
		+ (t.cat === 'naval_category' ? mods('global_port_build_buildings_efficiency') : 0) + (!(t.ranks || {}).rural_settlement ? mods('global_urban_build_buildings_efficiency') : 0);
	return p * (1 + (t.inc || 0) * level) * Math.max(0.1, 1 - eff) * (1 + inflation);
}

const rows = [];
// ---- buildings: one more level where the rules allow it
if (kinds.has('buildings')) for (const site of state.sites) {
	if (onlyLoc && site.loc.key !== onlyLoc) continue;
	const b0 = base.get(site), L0 = b0.L, J = b0.r.J;
	for (const [type, t] of Object.entries(DB.buildings)) {
		if (t.foreign || t.special || t.estate || SOURCES.has(type) || !(t.ranks || {})[L0.rank]) continue;
		if (t.unlock && !t.unlock.some(a => advances.has(a))) continue;
		const existing = L0.buildings.find(b => b.type === type && !b.foreign);
		const level = existing ? existing.level : 0;
		const pot = trig(t.locPot, L0), allow = trig(t.allow, L0);
		if (pot === 0 || allow === 0) continue;
		const cap = E.maxLevel(type, L0, b0.r.M), capV = typeof cap === 'number' ? cap : cap.value;
		if (!(level < capV)) continue;
		const cost = buildingPrice(t, level);
		if (!cost) continue;
		// staff the new level from idle pops of its type
		const size = E.employmentSize(type, L0), idle = t.pop ? Math.max(0, (J.unemployed || {})[t.pop] || 0) : 0;
		const hire = t.pop && size ? Math.min(size, idle) : 0;
		const slots = t.slots || [];
		// a new building tries up to three methods for its first slot (the others take their first)
		const options = slots.length && !existing ? (slots[0] || []).slice(0, 3).map(m => [m, ...slots.slice(1).map(s => s[0])]) : [null];
		let best = null;
		for (const methods of options) {
			const L = clone(L0);
			const b = L.buildings.find(x => x.type === type && !x.foreign);
			if (b) { b.employed = (b.employed ?? b.level * (E.employmentSize(type, L0) || 0)) + hire; b.level += 1; }
			else L.buildings.push({ type, level: 1, employed: hire, ...(methods ? { methods } : {}) });
			L.control = b0.r.control.max;
			const r = settle(site, L, site.obs);
			const gain = net(r) - net(b0.r);
			if (!best || gain > best.gain) best = { gain, crown: r.tax.crown - b0.crown, upkeep: r.upkeep - b0.upkeep, manpower: r.manpower.monthly - b0.manpower, methods };
		}
		rows.push({ kind: 'building', what: `${nm(type)}${level ? ` ${level} -> ${level + 1}` : ''}`, where: site.loc.key, cost, ...best,
			note: (t.pop && size && hire < size ? `${num(100 * hire / size)}% staffed from idle ${t.pop}` : '') + (pot === null || allow === null ? ' (some conditions unchecked)' : '') });
	}
}

// ---- rank upgrades
if (kinds.has('ranks')) for (const site of state.sites) {
	if (onlyLoc && site.loc.key !== onlyLoc) continue;
	const b0 = base.get(site), L0 = b0.L;
	const next = Object.entries(DB.ranks).find(([, r]) => r.upgradeFrom === L0.rank || (L0.rank === 'rural_settlement' && r.minPopulation !== undefined && !r.upgradeFrom));
	if (!next || !next[1].upgradePrice) continue;
	const [rank, rd] = next;
	if (rd.minPopulation !== undefined && L0.population < rd.minPopulation) continue;
	if (rank === 'megalopolis' && !(L0.capital && L0.marketCenter)) continue;
	const L = clone(L0); L.rank = rank;
	const r = settle(site, L, site.obs);
	const cost = rd.upgradePrice * (1 + mods(rank + '_upgrade_cost_modifier')) * (1 + inflation);
	rows.push({ kind: 'rank', what: `${nm(L0.rank)} -> ${nm(rank)}`, where: site.loc.key, cost, gain: net(r) - net(b0.r), crown: r.tax.crown - b0.crown, upkeep: r.upkeep - b0.upkeep, manpower: r.manpower.monthly - b0.manpower, note: '' });
}

// ---- roads: the best unlocked road on a land border without one (or with a worse one); the gain is the country's
// settled crown tax with proximity recomputed (a location's settled control = its other terms + 0.75 x proximity / 100)
if (kinds.has('roads')) {
	const best = Object.entries(DB.roadTypes).filter(([, r]) => !r.advance || advances.has(r.advance)).sort((a, b) => b[1].level - a[1].level)[0];
	const P = CS.proximity(state, results);
	const baseProx = new Map(state.sites.map(s => [s.loc.id, P.best.get(s.loc.id) || 0]));
	// each location's settled numbers as a function of proximity: tables over control, and its max control intercept
	const GRID = 20;
	const info = state.sites.map(site => {
		const r = results.get(site), M = r.M, urban = site.L.rank !== 'rural_settlement';
		const B = M.get('local_max_control') + M.get(urban ? 'local_max_urban_control' : 'local_max_rural_control') - 0.75 * (scn.locations.find(l => l.id === site.loc.id).proximity || 0) / 100;
		const L = clone(site.L), table = [];
		for (let i = 0; i <= GRID; i++) { L.control = i / GRID; const x = E.evaluate(site.scn, { L, C, obs: site.obs }); table.push([x.tax.crown, x.manpower.monthly]); }
		return { id: site.loc.id, B, table };
	});
	const at = (inf, c) => { const x = Math.max(0, Math.min(1, c)) * GRID, i = Math.min(GRID - 1, Math.floor(x)), f = x - i; return inf.table[i].map((v, k) => v + (inf.table[i + 1][k] - v) * f); };
	const score = prox => { let crown = 0, mp = 0; for (const inf of info) { const v = at(inf, Math.max(0, Math.min(1, inf.B + 0.0075 * Math.max(0, Math.min(100, prox.get(inf.id) || 0))))); crown += v[0]; mp += v[1]; } return [crown, mp]; };
	const [crown0, mp0] = score(baseProx);
	// multi-source search with the same step cost as country.js
	const own = new Set(state.sites.map(s => s.loc.id));
	const LAKES = new Set(['lakes', 'high_lakes', 'salt_pans']), SEAS = new Set(['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'atoll']);
	const isWater = id => { const tp = (DB.locations[id - 1] || [])[1]; return LAKES.has(tp) || SEAS.has(tp); };
	const strait = new Map();
	for (const [a, b] of MAP.straits || []) { (strait.get(a) || strait.set(a, []).get(a)).push(b); (strait.get(b) || strait.set(b, []).get(b)).push(a); }
	const nbs = id => ((MAP.locations[id] || {}).nb || []).map(n => n[0]).concat(strait.get(id) || []);
	function search() {
		const bestV = new Map(), heap = [];
		const push = (v, id) => { heap.push([v, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
		const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < heap.length && heap[l][0] > heap[k][0]) k = l; if (r < heap.length && heap[r][0] > heap[k][0]) k = r; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
		for (const [id, v] of P.sources) { bestV.set(id, v); push(v, id); }
		while (heap.length) {
			const [v, id] = pop();
			if (v < (bestV.get(id) ?? 0)) continue;
			for (const nb of nbs(id)) {
				if (!own.has(nb) && !isWater(nb)) continue;
				const nv = v - P.cost(id, nb);
				if (nv > (bestV.get(nb) ?? 0)) { bestV.set(nb, nv); push(nv, nb); }
			}
		}
		return bestV;
	}
	// segment length: centre distance x the mean of the two ends' terrain factors (fitted on the save's road constructions)
	const TERRAIN = { flatland: 0.445, plateau: 0.47, wetlands: 0.53, hills: 0.57, mountains: 0.67 };
	const length = (a, b) => {
		const A = MAP.locations[a], B2 = MAP.locations[b];
		const dx = Math.min(Math.abs(A.x - B2.x), MAP.width - Math.abs(A.x - B2.x)), dy = A.y - B2.y;
		const f = x => TERRAIN[(DB.locations[x - 1] || [])[1]] ?? 0.5;
		return Math.hypot(dx, dy) * (f(a) + f(b)) / 2;
	};
	const roadPrice = best[1].price * (1 + mods('build_' + best[0] + '_cost_modifier')) * (1 + inflation);
	for (const a of own) for (const [b] of (MAP.locations[a] || {}).nb || []) {
		if (b <= a || !own.has(b)) continue;
		const cur = state.roadIndex.get(a + ',' + b);
		if (cur && DB.roadTypes[cur].level >= best[1].level) continue;
		state.roadIndex.set(a + ',' + b, best[0]); state.roadIndex.set(b + ',' + a, best[0]);
		const [crown, mp] = score(search());
		if (cur) { state.roadIndex.set(a + ',' + b, cur); state.roadIndex.set(b + ',' + a, cur); } else { state.roadIndex.delete(a + ',' + b); state.roadIndex.delete(b + ',' + a); }
		const cost = roadPrice * length(a, b);
		const roadName = k => (DB.names[k] || k.replace(/_/g, ' ')).replace(/^./, c => c.toUpperCase());
		rows.push({ kind: 'road', what: `${roadName(best[0])}${cur ? ` (now ${roadName(cur).toLowerCase()})` : ''}`, where: `${nm(DB.locations[a - 1][0])} – ${nm(DB.locations[b - 1][0])}`, cost, gain: crown - crown0, crown: crown - crown0, upkeep: 0, manpower: mp - mp0, note: 'cost +-12%' });
	}
}

// ---- report
const top = +flag('--top', 30);
const ranked = rows.filter(r => r.gain > 0.01).sort((a, b) => b.gain / b.cost - a.gain / a.cost);
console.log(`${scn.name}: ${rows.length} options checked (${((Date.now() - t0) / 1000).toFixed(0)} s); age ${AGE} prices, inflation ${num(100 * inflation, 1)}%, construction efficiency ${num(100 * mods('global_build_buildings_efficiency'), 1)}%`);
console.log('Gains once control has settled, at today\'s prices; net = crown tax minus the upkeep it adds; payback = cost / net.\n');
console.log('  #   investment                                   where                          cost   crown tax   upkeep     net  payback  manpower');
const row = (r, i) => `  ${String(i + 1).padStart(2)}  ${(r.what).slice(0, 44).padEnd(44)} ${nm(r.where).slice(0, 28).padEnd(28)} ${num(r.cost).padStart(6)}  ${signed(r.crown, 2).padStart(9)}  ${signed(-r.upkeep, 2).padStart(7)}  ${signed(r.gain, 2).padStart(7)}  ${(r.gain > 0 ? num(r.cost / r.gain / 12, 1) + ' y' : '-').padStart(7)}  ${signed(r.manpower * 1000).padStart(8)}${r.note ? '  ' + r.note.trim() : ''}`;
ranked.slice(0, top).forEach((r, i) => console.log(row(r, i)));
const tops = +flag('--per-kind', 10);
for (const k of ['building', 'road', 'rank']) {
	const list = ranked.filter(r => r.kind === k);
	if (tops && list.length && ranked.slice(0, top).filter(r => r.kind === k).length < Math.min(tops, list.length)) { console.log(`
Best ${k}s:`); list.slice(0, tops).forEach((r, i) => console.log(row(r, i))); }
}
for (const k of ['building', 'road', 'rank']) {
	const of = ranked.filter(r => r.kind === k);
	if (of.length) console.log(`\n${k}s: ${of.length} pay back at all; best ${of[0].what} in ${nm(of[0].where)} (${num(of[0].cost / of[0].gain / 12, 1)} years)`);
}
