// The per-location parts of economy.js's month, shared by the one-thread run and the shard workers (planner_worker.js):
// a finished project, promotion, and what the main thread needs of a location's month (its summary).
'use strict';
const E = require('./engine.js');
const plan = require('./planner.js');
const DB = () => E.DB;

// a project done this month: a building level; a rank (its extra desired pops become promotion targets, the RGO shrinks to
// its new maximum: a town loses the rural +100%); a road's end (the location gains the road flag)
function applyProject(state, site, p) {
	const L = site.L;
	if (p.kind === 'building') {
		const b = L.buildings.find(x => x.type === p.type && !x.foreign);
		if (b) b.level += 1; else L.buildings.push({ type: p.type, level: 1, employed: 0, ...(p.methods ? { methods: p.methods } : {}) });
	} else if (p.kind === 'rank') {
		for (const [type, n] of Object.entries(plan.rankDesiredDelta(L.rank, p.rank))) (site.desired ??= {})[type] = (site.desired[type] || 0) + n;
		L.rank = p.rank;
		const r = E.evaluate(site.scn, { L, C: state.C, obs: null });
		if (L.rgoWorkers !== undefined) L.rgoWorkers = Math.min(L.rgoWorkers, Math.floor(E.maxRgo(L, r.M) + 1e-9));
	} else if (p.kind === 'road') L.road = true;
}

// idle peasants promote into open jobs of the other types (and a new rank's extra desired pops), a share of the open
// places a month, from the biggest peasant pops of an accepted culture into the same culture and religion of the new type
function promote(site, r, share) {
	if (!(share > 0)) return;
	const L = site.L, J = r.J;
	let idle = Math.max(0, (J.unemployed || {}).peasants || 0);
	if (idle <= 1e-6) return;
	for (const type of ['burghers', 'laborers', 'soldiers', 'clergy', 'nobles']) {
		const open = (J.jobs[type] || 0) + ((site.desired || {})[type] || 0) - (J.pops[type] || 0);
		if (open <= 1e-6 || idle <= 1e-6) continue;
		let n = Math.min(open * share, idle);
		idle -= n;
		const peasants = L.pops.filter(p => p.type === 'peasants' && ['Primary', 'Accepted', 'Tolerated'].includes(p.status) && p.size > 0).sort((a, b) => b.size - a.size);
		for (const p of peasants) {
			if (n <= 1e-9) break;
			const take = Math.min(n, p.size);
			p.size -= take; n -= take;
			const into = L.pops.find(q => q.type === type && q.culture === p.culture && q.religion === p.religion && q.status === p.status);
			if (into) into.size += take;
			else L.pops.push({ type, size: take, culture: p.culture, religion: p.religion, status: p.status, satisfaction: p.satisfaction, literacy: p.literacy, estate: (DB().pops[type] || {}).estate || 'peasants_estate' });
		}
	}
	L.pops = L.pops.filter(p => p.size > 1e-9);
	L.population = L.pops.reduce((a, p) => a + p.size, 0);
}

// what the main thread needs of a location's month, as a result-like object: the totals' terms, its food, the four
// modifiers the proximity search reads, its market flows; and (yearly) its pops by type, development and rank
const PROX = ['local_proximity_source', 'local_proximity_source_modifier', 'local_distance_from_capital_speed_propagation', 'local_port_cost_distance_impact'];
function summary(site, r, CS, yearly) {
	const f = r.food;
	const s = {
		id: site.loc.id, population: site.L.population, control: site.L.control,
		manpower: { monthly: r.manpower.monthly }, sailors: { monthly: r.sailors.monthly }, levies: { army: r.levies.army, navy: r.levies.navy },
		wealth: { total: r.wealth.total }, tax: { base: r.tax.base, crown: r.tax.crown }, upkeep: r.upkeep, growth: { pool: r.growth.pool },
		food: { capacity: f.capacity, baseConsumption: f.baseConsumption, consumption: f.consumption, production: f.production, preservation: f.preservation, decay: f.decay },
		prox: PROX.map(k => r.M.loc(k)), ownFlows: CS.flows(r),
	};
	if (yearly) {
		const pops = {};
		for (const p of site.L.pops) pops[p.type] = (pops[p.type] || 0) + p.size;
		Object.assign(s, { pops, development: site.L.development, rank: site.L.rank });
	}
	return s;
}
// a summary made into what CS.totals, stepFood, proximity and ownFlows read of a result
function asResult(s) {
	const prox = Object.fromEntries(PROX.map((k, i) => [k, s.prox[i]]));
	return { ...s, M: { loc: k => prox[k] || 0 } };
}

module.exports = { applyProject, promote, summary, asResult, PROX };
