// A shard of economy.js's run: a worker thread that owns whole provinces (workerData.mine, location ids) for the whole
// run. It builds its own copy of the country once from the run's scenario; its own locations stay up to date, the rest
// are never looked at (a town's value needs its province's food: whole provinces). Each month the main thread sends:
//   month    - last month's proximity and province food (updates), projects done this month, market prices; the shard
//              evaluates its locations and sends their summaries (months.summary)
//   advance  - the month passes for its locations (control, development, births, staffing) and peasants promote; it sends
//              their pops for the market step
// and at a decision (before the month advances):
//   options    - the building and urbanisation options of the locations it is given, with market flows, and the price
//                sensitivity of all its locations (summed in the main thread in location order)
//   roadInfo   - its locations' crown tax and manpower over control
//   roadScores - a share of the candidate roads, with every location's info and the proximity modifiers of all of them
// Options come back without their evaluations (r, L, best): what the decision and the schedule use, keyed by location id.
'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
E.setTracking(false); // no tooltips: modifier sources are not recorded
const CS = require('./country.js');
CS.setMap(require('./map.json'));
const plan = require('./planner.js');
const months = require('./months.js');

const scn = workerData.scn;
const state = CS.create(scn);
const siteOf = new Map(state.sites.map(s => [s.loc.id, s]));
const mine = workerData.mine.map(id => siteOf.get(id));
let results = new Map(); // this month's evaluation of its locations
const KEEP = ['kind', 'type', 'level', 'where', 'cost', 'cost2', 'worth', 'gain', 'crown', 'upkeep', 'manpower', 'methods', 'bt', 'hire', 'size',
	'unchecked', 'rank', 'from', 'verdict', 'value', 'valueCost', 'bestGain', 'manpowerNow', 'mk', 'demandKey', 'flow', 'flowOwn'];
const lean = (o, siteId) => { const x = { siteId }; for (const k of KEEP) if (o[k] !== undefined) x[k] = o[k]; return x; };

const handlers = {
	month(msg) {
		for (const [id, u] of msg.updates || []) Object.assign(siteOf.get(id).L, u);
		for (const p of msg.projects || []) months.applyProject(state, siteOf.get(p.siteId), p);
		for (const [id, mk] of Object.entries(msg.markets)) {
			const x = state.markets[id];
			Object.assign(x.prices, mk.prices);
			for (const [g, p] of Object.entries(mk.prices)) if (x.goods[g]) x.goods[g].price = p;
			x.foodPrice = mk.foodPrice;
		}
		results = new Map();
		for (const site of mine) {
			const mk = state.markets[site.loc.market];
			if (mk) Object.assign(site.L.prices, mk.prices);
			results.set(site, E.evaluate(site.scn, { L: site.L, C: state.C, obs: msg.first ? site.obs : null }));
		}
		if (msg.first) for (const site of mine) site.obs = null; // after month 0 employment follows the pops, not the save
		return { sums: mine.map(site => months.summary(site, results.get(site), CS, msg.yearly)) };
	},
	advance(msg) {
		for (const site of mine) E.advance(site.L, results.get(site));
		for (const site of mine) months.promote(site, results.get(site), msg.promotion);
		return { pops: mine.map(site => [site.loc.id, site.L.pops.map(p => [p.type, p.size]), site.L.population]) };
	},
	options(msg) {
		const ctx = plan.context(scn, { state, results });
		ctx.manpowerValue = msg.manpowerValue || 0;
		const cache = new Map(), options = [], worth = [], towns = [], townAt = new Set(msg.towns || []);
		for (const [id, types] of msg.jobs) {
			const site = siteOf.get(id);
			// a list of types: only those (they paid off at the last full pass); null: every type, and report which pay off
			const only = types ? new Set(types) : null;
			const found = plan.buildingOptions(ctx, site, { staffing: 'promotion', types: only ? (k => only.has(k)) : undefined });
			if (!only) worth.push([id, found.filter(o => o.gain > 0).map(o => o.type)]);
			for (const o of found) if (o.gain > 0) options.push(lean(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }), id));
			// an urbanisation is valued with the buildings it unlocks; only the rise itself joins the market plan. Between full
			// passes only where it was a candidate (types given: the location was priced before and its rank has not changed)
			const u = !only || townAt.has(id) ? plan.urbanOption(ctx, site, cache) : null;
			const ok = u && u.verdict === 'food-safe' && u.value > 0;
			if (!only) towns.push([id, !!ok]);
			if (ok) options.push(lean(plan.withFlows(ctx, { ...u, worth: u.value, cost2: u.valueCost }), id));
		}
		return { options, worth, towns, sens: mine.map(site => [site.loc.id, plan.priceSensitivity(ctx.base.get(site).r)]) };
	},
	// the army levy now, one row per pop: unit, regiment size, full men, men as shown (recovery applied), each rounded down as the game shows it
	levies() {
		const rows = [];
		for (const site of mine) for (const x of results.get(site).levies.rows) if (x.kind === 'army') rows.push([x.unit, x.regimentSize, x.men / (x.recovery || 1), x.men]);
		return { rows };
	},
	roadInfo() {
		return { info: plan.roadInfo(plan.context(scn, { state, results }), mine) };
	},
	roadScores(msg) {
		// the proximity search reads four modifiers of every location: the main thread's summaries
		const all = new Map(msg.prox.map(([id, p]) => [siteOf.get(id), months.asResult({ prox: p })]));
		state.roadIndex = new Map(msg.roads);
		const kept = mine.map(site => site.L.proximity); // the search writes every location's proximity: keep its own
		const scores = plan.roadScores(plan.context(scn, { state, results: all }), msg.info, msg.pairs);
		mine.forEach((site, i) => { site.L.proximity = kept[i]; });
		return { scores };
	},
};
parentPort.on('message', msg => parentPort.postMessage(handlers[msg.type](msg)));
