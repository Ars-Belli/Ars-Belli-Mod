// Where to put Local Governors. Every eligible city (a city or megalopolis with a road to the capital, not the capital,
// no other proximity source building) is scored by what the country gains once control has settled at its new maximum:
// a governor is a proximity source of 80, proximity gives 0.75 x proximity / 100 max control, and control moves toward
// its maximum every month. Crown tax, manpower and levies are read from the engine at each location's settled control.
//   node .tools/scripts/location_sim/governors.js <country scenario.json> [--roads best|current] [--count N] [--top 15]
//        [--years 10]    also project the current and the best set month by month (switching costs control first)
// --roads best (the default) puts the best road the country has unlocked on every land border between its locations.
// --naval: Naval Governors instead (same 80 source, own cap num_naval_governors): a port city NOT connected to the capital
//   through the country's land (straits count), on the capital's continent; the Local Governors stay where they are
//   (--local key,key,... to place them elsewhere first). A naval governor is an extra building, so its upkeep is shown.
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
if (!file) { console.error('usage: node governors.js <country scenario.json> [--roads best|current] [--count N] [--top 15] [--years 10]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const nm = k => DB.names[k] || k;
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d);
const own = new Map(scn.locations.map(l => [l.id, l]));
const key = id => (DB.locations[id - 1] || [])[0] || String(id);

// ---- roads: the best unlocked type on every land border between the country's own locations
const roadsMode = flag('--roads', 'best');
const advances = new Set(scn.country.advances || []);
const bestRoad = Object.entries(DB.roadTypes).filter(([, r]) => !r.advance || advances.has(r.advance)).sort((a, b) => b[1].level - a[1].level)[0];
let newRoads = 0;
if (roadsMode === 'best' && bestRoad) {
	const have = new Map();
	for (const [a, b, t] of scn.roads || []) { have.set(a + ',' + b, t); have.set(b + ',' + a, t); }
	const roads = [];
	for (const l of scn.locations) for (const [b] of (MAP.locations[l.id] || {}).nb || []) {
		if (b <= l.id || !own.has(b)) continue;
		const cur = have.get(l.id + ',' + b);
		if (!cur) newRoads++;
		roads.push([l.id, b, cur && DB.roadTypes[cur].level >= bestRoad[1].level ? cur : bestRoad[0]]);
	}
	scn.roads = roads;
}
// road flags: a location with a road has one; a road to the capital needs a road path to it
{
	const adj = new Map();
	for (const [a, b] of scn.roads || []) { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); }
	const seen = new Set([scn.capital]), queue = [scn.capital];
	while (queue.length) for (const n of adj.get(queue.shift()) || []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
	for (const l of scn.locations) { if (adj.has(l.id)) l.road = true; l.roadToCapital = seen.has(l.id) && l.id !== scn.capital ? true : l.roadToCapital; }
}

// ---- the current governors of the kind being placed come out: everything is scored against none of them
const naval = args.includes('--naval');
const TYPE = naval ? 'naval_governor' : 'local_governor', LABEL = naval ? 'naval governor' : 'governor';
const isGovernor = b => b.type === TYPE;
const current = scn.locations.filter(l => l.buildings.some(isGovernor)).map(l => l.id);
for (const l of scn.locations) l.buildings = l.buildings.filter(b => !isGovernor(b));
const building = type => ({ type, level: 1, employed: DB.buildings[type].emp, methods: [...(DB.buildings[type].slots || [[]]).map(s => s[0]).filter(Boolean)] });
if (naval && flag('--local')) {
	// the Local Governors where --local puts them
	const want = String(flag('--local')).split(',');
	for (const l of scn.locations) {
		l.buildings = l.buildings.filter(b => b.type !== 'local_governor');
		if (want.includes(l.key)) l.buildings.push(building('local_governor'));
	}
}
const allowed = naval ? scn.country.modifiers.num_naval_governors || 0
	: Math.max(scn.country.modifiers.num_local_governors || 1, scn.country.modifiers.minimum_num_local_governors || 0);
// naval: connected to the capital through the country's own land (straits count), and the capital's continent
const connected = new Set([scn.capital]);
{
	const strait = new Map();
	for (const [a, b] of MAP.straits || []) { (strait.get(a) || strait.set(a, []).get(a)).push(b); (strait.get(b) || strait.set(b, []).get(b)).push(a); }
	const queue = [scn.capital];
	while (queue.length) { const a = queue.shift(); for (const b of ((MAP.locations[a] || {}).nb || []).map(n => n[0]).concat(strait.get(a) || [])) if (own.has(b) && !connected.has(b)) { connected.add(b); queue.push(b); } }
}
const continentOf = id => (DB.locations[id - 1] || [])[13];

const t0 = Date.now();
const { state, results } = CS.evaluate(scn);
const sites = state.sites;
// the proximity the month-0 modifiers were computed with (the save's), before the search below overwrites it
const evalProx = new Map(sites.map(s => [s.loc.id, s.L.proximity || 0]));
const P = CS.proximity(state, results); // the search without governors; also gives the step cost with these roads
const baseProx = new Map(sites.map(s => [s.loc.id, P.best.get(s.loc.id) || 0]));

// ---- one proximity map per candidate: source value minus the cheapest path (same rules as country.js)
const LAKES = new Set(['lakes', 'high_lakes', 'salt_pans']), SEAS = new Set(['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'atoll']);
const isWater = id => { const t = (DB.locations[id - 1] || [])[1]; return LAKES.has(t) || SEAS.has(t); };
const strait = new Map();
for (const [a, b] of MAP.straits || []) { (strait.get(a) || strait.set(a, []).get(a)).push(b); (strait.get(b) || strait.set(b, []).get(b)).push(a); }
const nbs = id => ((MAP.locations[id] || {}).nb || []).map(n => n[0]).concat(strait.get(id) || []);
function spread(src, value) {
	const best = new Map([[src, value]]), heap = [[value, src]];
	const push = (v, id) => { heap.push([v, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
	const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < heap.length && heap[l][0] > heap[k][0]) k = l; if (r < heap.length && heap[r][0] > heap[k][0]) k = r; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
	while (heap.length) {
		const [v, id] = pop();
		if (v < (best.get(id) ?? 0)) continue;
		for (const nb of nbs(id)) {
			if (!own.has(nb) && !isWater(nb)) continue;
			const nv = v - P.cost(id, nb);
			if (nv > (best.get(nb) ?? 0)) { best.set(nb, nv); push(nv, nb); }
		}
	}
	return best;
}
const sourceBuilding = b => { const t = DB.buildings[b.type]; return t && t.mod && t.mod.local_proximity_source; };
const eligible = s => ['city', 'megalopolis'].includes(s.L.rank) && s.loc.id !== scn.capital && !s.L.historicalCapital && !s.loc.buildings.some(sourceBuilding)
	&& (naval ? MAP.ports[s.loc.id] && !connected.has(s.loc.id) && continentOf(s.loc.id) === continentOf(scn.capital) : s.L.roadToCapital);
const candidates = sites.filter(eligible).map(s => {
	const M = results.get(s).M;
	const value = Math.min(100, M.loc('local_proximity_source') + 80) * (1 + Math.max(-1, M.loc('local_proximity_source_modifier')));
	// the building's upkeep at this location's market prices (an extra building for a naval governor)
	const L = JSON.parse(JSON.stringify(s.L));
	L.buildings.push(building(TYPE));
	const row = E.evaluate(s.scn, { L, C: state.C, obs: s.obs }).buildings.rows.find(r => r.type === TYPE);
	return { id: s.loc.id, key: s.loc.key, value, map: spread(s.loc.id, value), upkeep: row && row.upkeep || 0 };
});
const count = Math.min(+flag('--count', allowed), candidates.length);

// ---- each location at settled control: max control = its other terms + 0.75 x proximity / 100 (clamped 0..1)
const GRID = 20;
const info = sites.map(s => {
	const r = results.get(s), M = r.M, urban = s.L.rank !== 'rural_settlement';
	const B = M.get('local_max_control') + M.get(urban ? 'local_max_urban_control' : 'local_max_rural_control') - 0.75 * evalProx.get(s.loc.id) / 100;
	const saved = s.L.control, table = [];
	for (let i = 0; i <= GRID; i++) {
		s.L.control = i / GRID;
		const x = E.evaluate(s.scn, { L: s.L, C: state.C, obs: s.obs });
		table.push([x.tax.crown, x.manpower.monthly, x.levies.army, x.wealth.total * s.L.control]);
	}
	s.L.control = saved;
	return { id: s.loc.id, key: s.loc.key, B, table, control: saved, wealth: r.wealth.total };
});
const at = (inf, c) => { const x = Math.max(0, Math.min(1, c)) * GRID, i = Math.min(GRID - 1, Math.floor(x)), f = x - i; return inf.table[i].map((v, k) => v + (inf.table[i + 1][k] - v) * f); };
const maxControl = (inf, prox) => Math.max(0, Math.min(1, inf.B + 0.0075 * Math.max(0, Math.min(100, prox))));
function score(set, rows) {
	const out = [0, 0, 0, 0];
	let cw = 0, w = 0;
	for (const inf of info) {
		let prox = baseProx.get(inf.id) || 0;
		for (const c of set) prox = Math.max(prox, c.map.get(inf.id) || 0);
		const mc = maxControl(inf, prox), v = at(inf, mc);
		for (let k = 0; k < 4; k++) out[k] += v[k];
		cw += mc * inf.wealth; w += inf.wealth;
		if (rows) rows.set(inf.id, { key: inf.key, prox, control: mc, crown: v[0], manpower: v[1] });
	}
	return { crown: out[0], manpower: out[1], levies: out[2], taxBase: out[3], control: w ? cw / w : 0 };
}
const base = score([]);
const gain = s => ({ crown: s.crown - base.crown, manpower: s.manpower - base.manpower, levies: s.levies - base.levies, control: s.control - base.control });

// ---- report
const L0 = scn.locations.length;
const fixedLocal = naval ? scn.locations.filter(l => l.buildings.some(b => b.type === 'local_governor')).map(l => nm(l.key)) : [];
console.log(`${scn.name}: ${L0} locations; ${roadsMode === 'best' ? `${nm(bestRoad[0])} on every land border (${num(newRoads)} new road links)` : 'roads as in the save'}; ${allowed} ${LABEL}s allowed` +
	(naval ? `; Local Governors kept in ${fixedLocal.join(', ') || 'none'}` : ''));
console.log(`Settled control without ${LABEL}s: ${(100 * base.control).toFixed(1)}% (wealth-weighted); crown tax ${num(base.crown, 1)}, manpower ${num(base.manpower * 1000)} a month, levies ${num(base.levies * 1000)} men`);
console.log(`${candidates.length} eligible cities: ${naval ? 'ports not connected to the capital through own land, on its continent' : 'cities with a road to the capital'} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
if (!candidates.length) process.exit(0);
const singles = candidates.map(c => ({ c, g: gain(score([c])) })).sort((a, b) => b.g.crown - a.g.crown);
const top = +flag('--top', 15);
const head = '  city                      crown tax  manpower/mo   levies   control   upkeep';
console.log(`One ${LABEL} alone (gain once control has settled), by crown tax:\n` + head);
const row = (name, g, upkeep) => `  ${name.padEnd(24)} ${signed(g.crown, 1).padStart(10)}  ${signed(g.manpower * 1000).padStart(11)}  ${signed(g.levies * 1000).padStart(7)}  ${signed(100 * g.control, 2).padStart(7)} pts` + (upkeep ? `  ${num(upkeep, 1).padStart(6)}` : '');
for (const { c, g } of singles.slice(0, top)) console.log(row(nm(c.key), g, c.upkeep));

// every set of `count` (exhaustive when small enough, else greedy then swaps)
function bestSet(metric) {
	const pool = singles.slice(0, Math.min(singles.length, 60)).map(x => x.c);
	let best = null;
	const consider = set => { const s = score(set), v = s[metric]; if (!best || v > best.v) best = { set: [...set], v, s }; };
	const combos = (k, start, cur) => { if (cur.length === k) { consider(cur); return; } for (let i = start; i < pool.length; i++) { cur.push(pool[i]); combos(k, i + 1, cur); cur.pop(); } };
	if (count <= 3) combos(count, 0, []);
	else {
		let set = [];
		for (let k = 0; k < count; k++) { let pick = null; for (const c of pool) if (!set.includes(c)) { const v = score([...set, c])[metric]; if (!pick || v > pick[1]) pick = [c, v]; } set.push(pick[0]); }
		for (let changed = true; changed;) { changed = false; for (let i = 0; i < set.length; i++) for (const c of pool) if (!set.includes(c)) { const t = [...set]; t[i] = c; if (score(t)[metric] > score(set)[metric] + 1e-9) { set = t; changed = true; } } }
		consider(set);
	}
	return best;
}
const describe = set => set.map(c => nm(c.key)).join(', ');
const curSet = candidates.filter(c => current.includes(c.id));
const curScore = curSet.length ? gain(score(curSet)) : null;
const picks = {};
if (count > 1 || curSet.length) {
	console.log(`\nSets of ${count} (gain over no ${LABEL} once control has settled):\n` + head.replace('city                    ', 'set                     '));
	if (curSet.length) console.log(row('current: ' + describe(curSet), curScore, curSet.reduce((a, c) => a + c.upkeep, 0)));
}
for (const metric of ['crown', 'manpower', 'levies']) {
	const b = bestSet(metric);
	picks[metric] = b.set;
	if (count > 1 || curSet.length) console.log(row(`best for ${metric === 'crown' ? 'crown tax' : metric}: ${describe(b.set)}`, gain(b.s), b.set.reduce((a, c) => a + c.upkeep, 0)));
}
// where a change of set moves settled control the most (crown tax a month)
{
	const shown = new Set([curSet.map(c => c.id).sort().join(',')]);
	for (const set of Object.values(picks)) {
		const k = set.map(c => c.id).sort().join(',');
		if (shown.has(k)) continue;
		shown.add(k);
		const ra = new Map(), rb = new Map();
		score(curSet, ra); score(set, rb);
		const diff = [...ra.keys()].map(id => ({ key: ra.get(id).key, a: ra.get(id), b: rb.get(id), d: rb.get(id).crown - ra.get(id).crown })).filter(x => Math.abs(x.d) > 0.05);
		const fmt = x => `${nm(x.key)} ${signed(x.d, 1)} (proximity ${x.a.prox.toFixed(0)}->${x.b.prox.toFixed(0)}, control ${(100 * x.a.control).toFixed(0)}->${(100 * x.b.control).toFixed(0)}%)`;
		console.log(`\n${describe(curSet) || `no ${LABEL}`} -> ${describe(set)}: ${diff.filter(x => x.d > 0).length} locations gain, ${diff.filter(x => x.d < 0).length} lose (settled crown tax a month)`);
		console.log('  gain: ' + diff.filter(x => x.d > 0).sort((p, q) => q.d - p.d).slice(0, 8).map(fmt).join('; '));
		console.log('  lose: ' + diff.filter(x => x.d < 0).sort((p, q) => p.d - q.d).slice(0, 8).map(fmt).join('; '));
	}
}

// ---- month by month: the current set vs the best one for crown tax (control falls fast where a governor leaves, rises slowly)
const years = +flag('--years', 10);
if (years > 0) {
	// a set the country already has from month 0; a new one finishes after the build time, and the governors it replaces
	// come down at month 0 (the cap counts governors under construction)
	const buildMonths = Math.round((DB.buildings[TYPE].bt || 365) / 30.4);
	const governor = building(TYPE);
	const withGovs = set => {
		const s = JSON.parse(JSON.stringify(scn)), keep = set.filter(c => current.includes(c.id)).map(c => c.id);
		for (const l of s.locations) if (keep.includes(l.id)) l.buildings.push({ ...governor });
		const schedule = set.filter(c => !current.includes(c.id)).map(c => ({ month: buildMonths, location: c.id, building: { ...governor } }));
		return CS.project({ ...s, options: { ...(s.options || {}), food: 'off', schedule } }, years * 12).timeline;
	};
	// the current set against each different best set; the projection keeps markets as in the save and food off
	const ta = withGovs(curSet);
	const seen = new Set([curSet.map(c => c.id).sort().join(',')]);
	for (const [metric, set] of Object.entries(picks)) {
		const k = set.map(c => c.id).sort().join(',');
		if (seen.has(k)) continue;
		seen.add(k);
		const tb = withGovs(set);
		const moved = set.filter(c => !curSet.includes(c)).map(c => nm(c.key)), dropped = curSet.filter(c => !set.includes(c)).map(c => nm(c.key));
		console.log(`
${years} years month by month (new ${LABEL}s finish after ${buildMonths} months), ${curSet.length ? 'current set' : `no ${LABEL}`} vs best for ${metric === 'crown' ? 'crown tax' : metric} (${dropped.join(', ') || 'none'} -> ${moved.join(', ')}): crown tax and building upkeep, manpower a month, levies, control`);
		// net = crown tax minus building upkeep (both gold a month), so an extra building pays for itself or not
		let sumA = 0, sumB = 0, mpA = 0, mpB = 0;
		for (let m = 0; m < ta.length; m++) { sumA += ta[m].crownTax - ta[m].upkeep; sumB += tb[m].crownTax - tb[m].upkeep; mpA += ta[m].manpower; mpB += tb[m].manpower; }
		// the month after which the new set has earned at least as much in total, for good
		let cum = 0, lastBehind = -1;
		for (let m = 0; m < ta.length; m++) { cum += (tb[m].crownTax - tb[m].upkeep) - (ta[m].crownTax - ta[m].upkeep); if (cum < 0) lastBehind = m; }
		const breakEven = lastBehind === ta.length - 1 ? -1 : lastBehind + 1;
		for (const y of [1, 2, 5, years].filter((v, i, a) => v <= years && a.indexOf(v) === i)) {
			const a = ta[y * 12], b = tb[y * 12], dNet = (b.crownTax - b.upkeep) - (a.crownTax - a.upkeep);
			console.log(`  year ${String(y).padStart(2)}: crown tax ${signed(b.crownTax - a.crownTax, 1)}, upkeep ${signed(b.upkeep - a.upkeep, 1)}, net ${signed(dNet, 1)} gold; manpower ${signed((b.manpower - a.manpower) * 1000)} a month; levies ${signed((b.armyLevies - a.armyLevies) * 1000)}; control ${(100 * a.control).toFixed(1)}% -> ${(100 * b.control).toFixed(1)}%`);
		}
		console.log(`  over ${years} years: net gold ${signed(sumB - sumA, 0)}, manpower ${signed((mpB - mpA) * 1000, 0)} men; the net gold is ahead for good after ${breakEven < 0 ? 'more than ' + years + ' years' : (breakEven / 12).toFixed(1) + ' years'}`);
	}
}
