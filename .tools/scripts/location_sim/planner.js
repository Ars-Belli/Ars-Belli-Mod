// Shared planning code for investments.js (crown tax per gold), urbanise.js (long-sighted urbanisation) and the economy
// simulator: settled evaluation, location conditions, prices, and the options a country can buy.
// A context is made from a country scenario (or a running country.js state) with plan.context(...).
const E = require('./engine.js');
const CS = require('./country.js');
const MAP = require('./map.json');
const DB = () => E.DB;

const clone = L => JSON.parse(JSON.stringify(L));
const net = r => r.tax.crown - r.upkeep;
const AGES = ['tradition', 'renaissance', 'discovery', 'reformation', 'absolutism', 'revolution'];
const SOURCES = new Set(['local_governor', 'naval_governor', 'kings_manor', 'lieutenancy', 'itinerant_court_seat']); // governors.js
const LAKES = new Set(['lakes', 'high_lakes', 'salt_pans']), SEAS = new Set(['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'atoll']);
// a road's length per pixel of centre distance by the ends' topography (fitted on 838 roads under construction, +-12%)
const ROAD_TERRAIN = { flatland: 0.445, plateau: 0.47, wetlands: 0.53, hills: 0.57, mountains: 0.67 };
// province food: full surplus growth at a balance of 25% over consumption (population_military.md 3.1)
const FOOD_SURPLUS_POP_GROWTH = 0.0015, SURPLUS_FULL = 0.25;

// scn: a country scenario; state/results: an evaluated country.js state (made here when not given)
function context(scn, given = {}) {
	const { state, results } = given.state ? given : CS.evaluate(scn);
	const C = state.C, mods = k => C.mods.raw(k);
	const ctx = {
		scn, state, results, C, mods,
		advances: new Set(scn.country.advances || []), inflation: scn.country.inflation || 0, capital: scn.capital,
		age: AGES[Math.max(1, Math.min(6, scn.country.age || 1)) - 1],
		siteOf: new Map(state.sites.map(s => [s.loc.id, s])),
		base: new Map(),
	};
	// each location's settled numbers (control at its maximum)
	for (const site of state.sites) {
		const L = clone(site.L);
		const r = settle(ctx, site, L, site.obs);
		ctx.base.set(site, { r, L, crown: r.tax.crown, upkeep: r.upkeep, manpower: r.manpower.monthly });
	}
	return ctx;
}

// ---- a location's settled numbers: control at its maximum; the RGO capped at whole levels of its maximum size (a town
// loses the rural +100% max RGO size, so Constantina's silver mines would fall from 17 levels to 7)
function settle(ctx, site, L, obs) {
	// RGO employment never above the RGO's size (a location already shrunk by a rank change keeps its smaller RGO)
	const capObs = levels => obs && obs.laborers && obs.laborers.employed_in_rgo !== undefined && obs.laborers.employed_in_rgo > levels
		? { ...obs, laborers: { ...obs.laborers, employed_in_rgo: levels } } : obs;
	if (L.rgoWorkers !== undefined) obs = capObs(L.rgoWorkers);
	let r = E.evaluate(site.scn, { L, C: ctx.C, obs });
	if (L.rawMaterial && L.rgoWorkers !== undefined) {
		const levels = Math.floor(E.maxRgo(L, r.M) + 1e-9);
		if (L.rgoWorkers > levels) {
			L.rgoWorkers = levels;
			obs = capObs(levels);
			r = E.evaluate(site.scn, { L, C: ctx.C, obs });
		}
	}
	if (Math.abs(L.control - r.control.max) > 1e-9) { L.control = r.control.max; r = E.evaluate(site.scn, { L, C: ctx.C, obs }); }
	return r;
}

// ---- location_potential / allow triggers: 1 true, 0 false, null not evaluated (allowed, marked "unchecked")
const continentOf = id => (DB().locations[id - 1] || [])[13];
function trig(ctx, block, L, any = false) {
	const yes = (x, v) => (!!x === (v === 'yes')) ? 1 : 0;
	const val = ([k, op, v]) => {
		const kids = () => Array.isArray(v) ? v : [];
		switch (k) {
			case 'OR': return trig(ctx, kids(), L, true);
			case 'AND': return trig(ctx, kids(), L);
			case 'NOT': case 'NOR': { const x = trig(ctx, kids(), L, true); return x === null ? null : 1 - x; }
			case 'NAND': { const x = trig(ctx, kids(), L); return x === null ? null : 1 - x; }
			case 'custom_tooltip': return trig(ctx, kids().filter(([x]) => x !== 'text'), L);
			case 'vegetation': return L.vegetation === v ? 1 : 0;
			case 'topography': return L.topography === v ? 1 : 0;
			case 'climate': return L.climate === v ? 1 : 0;
			case 'raw_material': return L.rawMaterial === String(v).replace(/^goods:/, '') ? 1 : 0;
			case 'location_rank': return 'location_rank:' + L.rank === v ? 1 : 0;
			case 'has_building': { const t = String(v).replace(/^building_type:/, ''); return L.buildings.some(b => b.type === t && b.level > 0) ? 1 : 0; }
			case 'is_coastal': return yes(L.coastal, v);
			case 'has_river': return yes(L.river > 0, v);
			case 'is_port': return yes(L.port, v);
			case 'is_capital': case 'counts_as_capital': return yes(L.capital, v);
			case 'is_market_center': return yes(L.marketCenter, v);
			case 'has_road_to_capital': return yes(L.roadToCapital, v);
			case 'is_overseas_for_owner': return yes(continentOf(L.id) !== continentOf(ctx.capital), v);
			case 'is_city': return yes(L.rank !== 'rural_settlement', v);
			case 'is_rural': return yes(L.rank === 'rural_settlement', v);
			case 'has_proximity_source_building': return yes(L.buildings.some(b => { const t = DB().buildings[b.type]; return t && t.mod && t.mod.local_proximity_source; }), v);
			default: return null;
		}
	};
	const r = (block || []).map(val);
	if (any) return r.includes(1) ? 1 : r.includes(null) ? null : 0;
	return r.includes(0) ? 0 : r.includes(null) ? null : 1;
}

// ---- prices in gold: base x (1 + inflation) x (1 + market price impact) x (1 + cost modifiers), each a factor ("Upgrade to
// Town": 500 x 1.018 x 1.0361 x 0.9 = 474 in Toledo). The market price impact is the amount-weighted mean of the
// construction goods' price against their base price in the location's market (Lisbon city: +20.89%).
// a good's price impact on costs (markets_food.md 1.6): price / default - 1, clamped to MIN/MAX_PRICE_IMPACT (-0.33..3)
function goodImpact(g, price) {
	const b = (DB().goods[g] || {}).price, N = DB().defines.NMarket || {};
	return b ? Math.max(N.MIN_PRICE_IMPACT ?? -0.33, Math.min(N.MAX_PRICE_IMPACT ?? 3, price / b - 1)) : 0;
}
function marketImpact(demandKey, L) {
	const d = demandKey && DB().demands[demandKey];
	if (!d || !d.goods) return 0;
	let num = 0, den = 0;
	for (const [g, a] of Object.entries(d.goods)) { const b = (DB().goods[g] || {}).price; if (!b) continue; num += a * goodImpact(g, L.prices[g] ?? b); den += a; }
	return den ? num / den : 0;
}
function buildingPrice(ctx, t, level, L) {
	if (t.price) return null; // estate, religious and special prices
	const p = DB().values[(t.expensive ? 'expensive_' : '') + 'build_price_age_of_' + ctx.age];
	if (p === undefined) return null;
	const m = ctx.mods;
	// urban construction efficiency: any building in a town or city ('in all urban locations')
	const eff = m('global_build_buildings_efficiency') + (t.cat === 'defense_category' ? m('global_fort_build_buildings_efficiency') : 0)
		+ (t.cat === 'naval_category' ? m('global_port_build_buildings_efficiency') : 0) + (L.rank !== 'rural_settlement' ? m('global_urban_build_buildings_efficiency') : 0);
	return p * (1 + (t.inc || 0) * level) * (1 + ctx.inflation) * (1 + marketImpact(t.demand, L)) * Math.max(0.1, 1 - eff);
}
const nextRank = L => Object.entries(DB().ranks).find(([, r]) => r.upgradeFrom === L.rank || (L.rank === 'rural_settlement' && r.minPopulation !== undefined && !r.upgradeFrom));
function rankPrice(ctx, rank, L) {
	const rd = DB().ranks[rank];
	return rd && rd.upgradePrice ? rd.upgradePrice * (1 + ctx.inflation) * (1 + marketImpact(rd.demand, L)) * (1 + ctx.mods(rank + '_upgrade_cost_modifier')) : null;
}

// ---- building options: one more level where the rules allow it. staffing 'idle' hires idle pops of the building's type
// only; 'promotion' assumes its jobs fill over time (peasants promote into open jobs while any are idle).
function buildingOptions(ctx, site, opts = {}) {
	const b0 = ctx.base.get(site), L0 = opts.L || b0.L, r0 = opts.r || b0.r, J = r0.J;
	const out = [];
	for (const [type, t] of Object.entries(DB().buildings)) {
		if (t.foreign || t.special || t.estate || SOURCES.has(type) || !(t.ranks || {})[L0.rank]) continue;
		if (opts.types && !opts.types(type, t)) continue;
		if (t.unlock && !t.unlock.some(a => ctx.advances.has(a))) continue;
		const existing = L0.buildings.find(b => b.type === type && !b.foreign);
		const level = existing ? existing.level : 0;
		// a staffed building the save shows starved of its inputs (every output slot filled 0) would add levels that make
		// nothing (input rationing is not simulated: the fill stays as saved)
		const outs = existing && !existing.idleFill ? E.methodsOf(existing).map(([, pm], i) => [pm, ((existing.inputFill || [])[i] ?? 1)]).filter(([pm]) => pm.out) : [];
		if (outs.length && outs.every(([, fill]) => fill <= 0)) continue;
		const pot = trig(ctx, t.locPot, L0), allow = trig(ctx, t.allow, L0);
		if (pot === 0 || allow === 0) continue;
		const cap = E.maxLevel(type, L0, r0.M), capV = typeof cap === 'number' ? cap : cap.value;
		if (!(level < capV)) continue;
		const cost = buildingPrice(ctx, t, level, L0);
		if (!cost) continue;
		const size = E.employmentSize(type, L0);
		const idle = t.pop ? Math.max(0, (J.unemployed || {})[t.pop] || 0) : 0, peasants = Math.max(0, (J.unemployed || {}).peasants || 0);
		const hire = !t.pop || !size ? 0 : opts.staffing === 'promotion' ? Math.min(size, idle + (t.pop !== 'peasants' ? peasants : 0)) : Math.min(size, idle);
		const slots = t.slots || [];
		// a new building tries up to three methods for its first slot (the others take their first)
		const methodSets = slots.length && !existing ? (slots[0] || []).slice(0, 3).map(m => [m, ...slots.slice(1).map(s => s[0])]) : [null];
		let best = null;
		for (const methods of methodSets) {
			const L = clone(L0);
			const b = L.buildings.find(x => x.type === type && !x.foreign);
			if (b) { b.employed = (b.employed ?? b.level * (size || 0)) + hire; b.level += 1; }
			else L.buildings.push({ type, level: 1, employed: hire, ...(methods ? { methods } : {}) });
			L.control = r0.control.max;
			const r = settle(ctx, site, L, site.obs);
			const gain = net(r) - net(r0);
			if (!best || gain > best.gain) best = { gain, crown: r.tax.crown - r0.tax.crown, upkeep: r.upkeep - r0.upkeep, manpower: r.manpower.monthly - r0.manpower.monthly, methods, L, r };
		}
		out.push({ kind: 'building', type, level, where: site.loc.key, site, cost, ...best, hire, size,
			unchecked: pot === null || allow === null, bt: t.bt });
	}
	return out;
}

// ---- the next rank: a town needs 5,000 people, a city 30,000, a megalopolis 400,000 and the capital + market center
function rankOption(ctx, site, opts = {}) {
	const b0 = ctx.base.get(site), L0 = opts.L || b0.L, r0 = opts.r || b0.r;
	const next = nextRank(L0);
	if (!next || !next[1].upgradePrice) return null;
	const [rank, rd] = next;
	if (rd.minPopulation !== undefined && L0.population < rd.minPopulation) return null;
	if (rank === 'megalopolis' && !(L0.capital && L0.marketCenter)) return null;
	const L = clone(L0); L.rank = rank;
	const r = settle(ctx, site, L, site.obs);
	return { kind: 'rank', from: L0.rank, rank, where: site.loc.key, site, cost: rankPrice(ctx, rank, L0), gain: net(r) - net(r0), crown: r.tax.crown - r0.tax.crown,
		upkeep: r.upkeep - r0.upkeep, manpower: r.manpower.monthly - r0.manpower.monthly, L, r, bt: rd.buildTime };
}

// ---- roads: the best unlocked road on a land border without one (or with a worse one); the gain is the country's
// settled crown tax with proximity recomputed (a location's settled control = its other terms + 0.75 x proximity / 100)
function roadOptions(ctx) {
	const { state, results, scn } = ctx;
	const best = Object.entries(DB().roadTypes).filter(([, r]) => !r.advance || ctx.advances.has(r.advance)).sort((a, b) => b[1].level - a[1].level)[0];
	if (!best) return [];
	// the proximity the results were evaluated with (the search below overwrites it)
	const evalProxOf = new Map(state.sites.map(s => [s.loc.id, s.L.proximity || 0]));
	const P = CS.proximity(state, results);
	const baseProx = new Map(state.sites.map(s => [s.loc.id, P.best.get(s.loc.id) || 0]));
	const GRID = 20;
	const info = state.sites.map(site => {
		const r = results.get(site), M = r.M, urban = site.L.rank !== 'rural_settlement';
		const B = M.get('local_max_control') + M.get(urban ? 'local_max_urban_control' : 'local_max_rural_control') - 0.75 * evalProxOf.get(site.loc.id) / 100;
		const L = clone(site.L), table = [];
		for (let i = 0; i <= GRID; i++) { L.control = i / GRID; const x = E.evaluate(site.scn, { L, C: ctx.C, obs: site.obs }); table.push([x.tax.crown, x.manpower.monthly]); }
		return { id: site.loc.id, B, table };
	});
	const at = (inf, c) => { const x = Math.max(0, Math.min(1, c)) * GRID, i = Math.min(GRID - 1, Math.floor(x)), f = x - i; return inf.table[i].map((v, k) => v + (inf.table[i + 1][k] - v) * f); };
	const score = prox => { let crown = 0, mp = 0; for (const inf of info) { const v = at(inf, inf.B + 0.0075 * Math.max(0, Math.min(100, prox.get(inf.id) || 0))); crown += v[0]; mp += v[1]; } return [crown, mp]; };
	const [crown0, mp0] = score(baseProx);
	const own = new Set(state.sites.map(s => s.loc.id));
	const isWater = id => { const tp = (DB().locations[id - 1] || [])[1]; return LAKES.has(tp) || SEAS.has(tp); };
	const strait = new Map();
	for (const [a, b] of MAP.straits || []) { (strait.get(a) || strait.set(a, []).get(a)).push(b); (strait.get(b) || strait.set(b, []).get(b)).push(a); }
	const nbs = id => ((MAP.locations[id] || {}).nb || []).map(n => n[0]).concat(strait.get(id) || []);
	const search = () => {
		const bestV = new Map(), heap = [];
		const push = (v, id) => { heap.push([v, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
		const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < heap.length && heap[l][0] > heap[k][0]) k = l; if (r < heap.length && heap[r][0] > heap[k][0]) k = r; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
		for (const [id, v] of P.sources) { bestV.set(id, v); push(v, id); }
		while (heap.length) {
			const [v, id] = pop();
			if (v < (bestV.get(id) ?? 0)) continue;
			for (const nb of nbs(id)) { if (!own.has(nb) && !isWater(nb)) continue; const nv = v - P.cost(id, nb); if (nv > (bestV.get(nb) ?? 0)) { bestV.set(nb, nv); push(nv, nb); } }
		}
		return bestV;
	};
	const length = (a, b) => {
		const A = MAP.locations[a], B2 = MAP.locations[b];
		const dx = Math.min(Math.abs(A.x - B2.x), MAP.width - Math.abs(A.x - B2.x)), dy = A.y - B2.y;
		const f = x => ROAD_TERRAIN[(DB().locations[x - 1] || [])[1]] ?? 0.5;
		return Math.hypot(dx, dy) * (f(a) + f(b)) / 2;
	};
	// a road is priced in its starting location's market (its construction goods: lumber, masonry, sand...)
	const price = a => best[1].price * (1 + ctx.inflation) * (1 + marketImpact('build_' + best[0] + '_demand', ctx.siteOf.get(a).L)) * (1 + ctx.mods('build_' + best[0] + '_cost_modifier'));
	const out = [];
	for (const a of own) for (const [b] of (MAP.locations[a] || {}).nb || []) {
		if (b <= a || !own.has(b)) continue;
		const cur = state.roadIndex.get(a + ',' + b);
		if (cur && DB().roadTypes[cur].level >= best[1].level) continue;
		state.roadIndex.set(a + ',' + b, best[0]); state.roadIndex.set(b + ',' + a, best[0]);
		const [crown, mp] = score(search());
		if (cur) { state.roadIndex.set(a + ',' + b, cur); state.roadIndex.set(b + ',' + a, cur); } else { state.roadIndex.delete(a + ',' + b); state.roadIndex.delete(b + ',' + a); }
		out.push({ kind: 'road', road: best[0], from: cur, a, b, cost: price(a) * length(a, b), gain: crown - crown0, crown: crown - crown0, upkeep: 0, manpower: mp - mp0 });
	}
	return out;
}

// ---- province food: production and pop consumption a month over the country's locations of each province, with some
// locations replaced (urbanisation), now or with every RGO built to its maximum (rgoMax: true)
function maxedRgo(ctx, site, L) {
	const r = E.evaluate(site.scn, { L, C: ctx.C, obs: site.obs });
	if (!L.rawMaterial) return r;
	const levels = Math.floor(E.maxRgo(L, r.M) + 1e-9);
	const L2 = clone(L); L2.rgoWorkers = levels;
	const obs = site.obs && site.obs.laborers ? { ...site.obs, laborers: { ...site.obs.laborers, employed_in_rgo: levels } } : site.obs;
	return E.evaluate(site.scn, { L: L2, C: ctx.C, obs });
}
const provinceOf = id => (DB().locations[id - 1] || [])[10];
function provinceFood(ctx, province, replace = new Map(), rgoMax = false) {
	let production = 0, consumption = 0;
	for (const site of ctx.state.sites) {
		if (provinceOf(site.loc.id) !== province) continue;
		const L = replace.get(site) || ctx.base.get(site).L;
		const r = rgoMax ? maxedRgo(ctx, site, L) : (replace.has(site) ? settle(ctx, site, clone(L), site.obs) : ctx.base.get(site).r);
		production += r.food.production; consumption += r.food.consumption;
	}
	const ratio = consumption ? (production - consumption) / consumption : 0;
	return { production, consumption, balance: production - consumption, ratio, growth: FOOD_SURPLUS_POP_GROWTH * Math.max(0, Math.min(1, ratio / SURPLUS_FULL)) };
}

// ---- urbanisation, long-sighted (urbanise.js): the rank's immediate effect, the best three buildings it unlocks (jobs filled
// by promotion), the manpower those buildings allow, and the province's food now and with every RGO full. A rise that
// leaves its province short (now or once RGOs are full) is a 'shortage'; one that lowers the province's food growth
// (a surplus under 25%) 'costs growth'; otherwise 'food-safe'. cache: a Map reused across locations for province baselines.
function urbanOption(ctx, site, cache = new Map()) {
	const o = rankOption(ctx, site);
	if (!o || !o.cost) return null;
	const province = provinceOf(site.loc.id);
	if (!cache.has(province)) cache.set(province, { now: provinceFood(ctx, province), full: provinceFood(ctx, province, new Map(), true) });
	const fb = cache.get(province);
	const replace = new Map([[site, o.L]]);
	const after = provinceFood(ctx, province, replace), afterFull = provinceFood(ctx, province, replace, true);
	const unlocked = buildingOptions(ctx, site, { L: o.L, r: o.r, staffing: 'promotion', types: (k, t) => (t.ranks || {})[o.rank] && !(t.ranks || {})[o.from] });
	const best = unlocked.filter(u => u.gain > 0).sort((a, b) => b.gain / b.cost - a.gain / a.cost).slice(0, 3);
	let manpower = 0;
	for (const u of unlocked.filter(x => DB().buildings[x.type].mod && DB().buildings[x.type].mod.local_manpower && x.manpower > 0)) {
		const cap = E.maxLevel(u.type, o.L, o.r.M), levels = typeof cap === 'number' ? cap : cap.value;
		manpower += u.manpower * Math.max(1, levels || 1);
	}
	const shortage = after.balance < 0 || afterFull.balance < 0;
	const growthLoss = Math.min(after.growth - fb.now.growth, afterFull.growth - fb.full.growth);
	const bestGain = best.reduce((a, u) => a + u.gain, 0), bestCost = best.reduce((a, u) => a + u.cost, 0);
	// manpowerNow: the rise itself; manpower: what its unlocked manpower buildings allow at full levels
	return { ...o, manpowerNow: o.manpower, best, bestGain, manpower, value: o.gain + bestGain, valueCost: o.cost + bestCost,
		food: { before: fb.now.ratio, after: after.ratio, fullBefore: fb.full.ratio, fullAfter: afterFull.ratio, growthLoss },
		verdict: shortage ? 'shortage' : growthLoss < -1e-6 ? 'costs growth' : 'food-safe' };
}

// ---- prices (economy.js): how a location's crown tax minus upkeep moves with each good's price, in gold a month per gold
// of price, at fixed employment. The crown takes tau of the wealth (control x each estate's share x rate x efficiency); RGO
// and producing buildings' wealth moves with their output and input prices, other buildings' upkeep with their inputs.
function priceSensitivity(r) {
	const L = r.L, sens = {};
	const add = (g, x) => { if (g && x) sens[g] = (sens[g] || 0) + x; };
	let tau = 0;
	for (const e of Object.values(r.tax.estates)) tau += e.share * L.control * e.rate * r.tax.efficiency;
	if (r.rgo.good) add(r.rgo.good, tau * r.rgo.output * L.marketAccess);
	for (const row of r.buildings.rows) {
		const b = L.buildings[row.idx];
		if (row.foreign || !b) continue;
		const pms = E.methodsOf(b);
		if (row.profit !== undefined) {
			const k = tau * b.level * L.marketAccess * row.employment;
			for (const [i, [, pm]] of pms.entries()) {
				const fill = E.fillOf(b, i, row.employment);
				for (const [g, n] of Object.entries(pm.in || {})) add(g, -k * fill * n);
				if (pm.out) add(pm.out, k * fill * pm.n * (1 + row.pe + r.M.get('local_' + pm.out + '_output_modifier')));
			}
		} else for (const [, pm] of pms) for (const [g, n] of Object.entries(pm.in || {})) add(g, -b.level * n * r.buildings.upkeepMult);
	}
	return sens;
}
// what a change does to its market and to the location's price sensitivity: own supply and demand added per good (units
// a month, CS.flows) and sensitivity added, after minus before; several changes add up with addFlow
const subObj = (a, b) => { const o = {}; for (const g of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = (a[g] || 0) - (b[g] || 0); if (Math.abs(x) > 1e-12) o[g] = x; } return o; };
function flowDelta(rNew, rOld) {
	const a = CS.flows(rNew), b = CS.flows(rOld);
	return { dS: subObj(a.s, b.s), dD: subObj(a.d, b.d), sens: subObj(priceSensitivity(rNew), priceSensitivity(rOld)) };
}
function addFlow(into, f, sign = 1) {
	for (const k of ['dS', 'dD', 'sens']) for (const [g, x] of Object.entries(f[k] || {})) into[k][g] = (into[k][g] || 0) + sign * x;
	return into;
}

// ---- options valued with their market effects (economy.js, investments.js), gold a month. markets(ctx) holds the settled
// prices (country.js marketView), our locations' price sensitivity per market and good, what is planned per market
// (extra own supply, demand and sensitivity: projects under construction, options already bought) and future building
// (gold a month per point of a construction good's cost impact, per market; setFuture).
function markets(ctx) {
	const sens = {};
	for (const site of ctx.state.sites) { const x = (sens[site.loc.market] ??= {}); for (const [g, v] of Object.entries(priceSensitivity(ctx.base.get(site).r))) x[g] = (x[g] || 0) + v; }
	const planned = {};
	return { view: CS.marketView(ctx.state, ctx.results), sens, planned, future: {}, plannedOf: mk => (planned[mk] ??= { dS: {}, dD: {}, sens: {} }) };
}
// an option's market and its flows: what it adds to its market and to our price sensitivity once built (flowOwn), and for
// valuing it (flow; an urbanisation adds the best buildings it unlocks)
function withFlows(ctx, o) {
	o.mk = (o.kind === 'road' ? ctx.siteOf.get(o.a).loc : o.site.loc).market;
	o.demandKey = demandKeyOf(o);
	if (o.kind === 'building' || o.kind === 'rank') {
		const r0 = ctx.base.get(o.site).r;
		o.flowOwn = o.flow = flowDelta(o.r, r0);
		if (o.best) { o.flow = addFlow({ dS: {}, dD: {}, sens: {} }, o.flowOwn); for (const b of o.best) addFlow(o.flow, flowDelta(b.r, o.r)); }
	}
	return o;
}
function demandKeyOf(o) {
	if (o.kind === 'building') return (DB().buildings[o.type] || {}).demand;
	if (o.kind === 'rank') return (DB().ranks[o.rank] || {}).demand;
	if (o.kind === 'road') return 'build_' + o.road + '_demand';
	return null;
}
// the construction goods an option buys: its build price = base x (1 + the amount-weighted mean of the goods' cost
// impacts), so a gold spent on it saves a/sum(a) / (1 + impact) gold per point a good's impact falls
function constructionWeights(ctx, o) {
	const d = o.demandKey && DB().demands[o.demandKey], w = {};
	if (!d || !d.goods) return w;
	const L = (o.kind === 'road' ? ctx.siteOf.get(o.a) : o.site).L;
	const sumA = Object.entries(d.goods).filter(([g]) => (DB().goods[g] || {}).price).reduce((a, [, x]) => a + x, 0);
	if (!sumA) return w;
	const k = 1 / (1 + marketImpact(o.demandKey, L));
	for (const [g, a] of Object.entries(d.goods)) if ((DB().goods[g] || {}).price) w[g] = k * a / sumA;
	return w;
}
// future building: perMonth gold a month, shared among markets and their construction goods as in basket ([{ mk, cost, w }])
function setFuture(M, basket, perMonth) {
	const all = basket.reduce((a, b) => a + b.cost, 0) || 1;
	M.future = {};
	for (const b of basket) { const x = (M.future[b.mk] ??= {}); for (const [g, w] of Object.entries(b.w)) x[g] = (x[g] || 0) + w * b.cost * Math.max(0, perMonth) / all; }
}
// the value: its worth (gain at today's prices; an urbanisation's with its unlocked buildings) + per good it supplies or
// buys, at the price the good settles at in its market after it (with what is planned there): its own output and inputs
// at that price, our other locations' change from the price move, and what cheaper construction goods save on future
// building. parts (optional) gets the terms.
function marketValue(M, o, parts) {
	const worth = o.worth ?? o.gain;
	if (!o.flow) return worth;
	const P = M.plannedOf(o.mk), S = M.sens[o.mk] || {}, F = M.future[o.mk] || {};
	let v = worth;
	if (parts) Object.assign(parts, { own: 0, others: 0, building: 0, goods: [] });
	for (const g of new Set([...Object.keys(o.flow.dS), ...Object.keys(o.flow.dD), ...Object.keys(o.flow.sens)])) {
		const p0 = M.view.price(o.mk, g);
		if (p0 === null) continue;
		const pS = P.dS[g] || 0, pD = P.dD[g] || 0;
		const before = M.view.settled(o.mk, g, pS, pD), after = M.view.settled(o.mk, g, pS + (o.flow.dS[g] || 0), pD + (o.flow.dD[g] || 0));
		const own = (o.flow.sens[g] || 0) * (after - p0), others = ((S[g] || 0) + (P.sens[g] || 0)) * (after - before);
		const building = (F[g] || 0) * (goodImpact(g, before) - goodImpact(g, after));
		v += own + others + building;
		if (parts) { parts.own += own; parts.others += others; parts.building += building; parts.goods.push([g, p0, after]); }
	}
	return v;
}
// an option bought: its market effects join the plan
const commit = (M, o) => { if (o.flowOwn) addFlow(M.plannedOf(o.mk), o.flowOwn); };

module.exports = { markets, withFlows, demandKeyOf, constructionWeights, setFuture, marketValue, commit, goodImpact, priceSensitivity, flowDelta, addFlow, urbanOption, context, settle, trig, marketImpact, buildingPrice, rankPrice, nextRank, buildingOptions, rankOption, roadOptions, provinceFood, provinceOf, maxedRgo, clone, net, SOURCES, FOOD_SURPLUS_POP_GROWTH, SURPLUS_FULL };
