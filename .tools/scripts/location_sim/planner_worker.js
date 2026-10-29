// A worker thread for economy.js's decisions. It builds its own copy of the country once from the run's scenario and, for
// each decision, takes the locations and markets as they stand (a JSON snapshot, the same for every worker), then prices the options of the locations
// it is given: building levels (planner.buildingOptions, with jobs filled by promotion), food-safe urbanisation
// (urbanOption) and their market flows (withFlows), with its locations' price sensitivity; and roads in
// two passes (each location's crown tax over control, then a share of the candidate borders). Options come back without
// their evaluations (r, L, best): what the decision and the schedule use, keyed by location id.
'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const CS = require('./country.js');
CS.setMap(require('./map.json'));
const plan = require('./planner.js');

const scn = workerData.scn;
const state = CS.create(scn);
for (const s of state.sites) s.obs = null; // decisions come after month 0: employment follows the pops
const siteOf = new Map(state.sites.map(s => [s.loc.id, s]));
const KEEP = ['kind', 'type', 'level', 'where', 'cost', 'cost2', 'worth', 'gain', 'crown', 'upkeep', 'manpower', 'methods', 'bt', 'hire', 'size',
	'unchecked', 'rank', 'from', 'verdict', 'value', 'valueCost', 'bestGain', 'manpowerNow', 'mk', 'demandKey', 'flow', 'flowOwn'];
const lean = (o, siteId) => { const x = { siteId }; for (const k of KEEP) if (o[k] !== undefined) x[k] = o[k]; return x; };

// the snapshot as it stands; this month's results only for roads (their proximity search reads every location's modifiers)
let ctx = null;
function restore(snap, roads, evaluated) {
	const msg = JSON.parse(snap);
	for (const [id, L] of msg.sites) siteOf.get(id).L = L;
	for (const [id, mk] of Object.entries(msg.markets)) Object.assign(state.markets[id], mk);
	if (roads) state.roadIndex = new Map(roads);
	ctx = plan.context(scn, { state, results: evaluated ? CS.evaluateAll(state, false).results : new Map() });
}

parentPort.on('message', msg => {
	if (msg.type === 'roadInfo') {
		restore(msg.snap, msg.roads, true);
		return parentPort.postMessage({ info: plan.roadInfo(ctx, msg.sites.map(id => siteOf.get(id))) });
	}
	if (msg.type === 'roadScores') return parentPort.postMessage({ scores: plan.roadScores(ctx, msg.info, msg.pairs) });
	restore(msg.snap);
	const cache = new Map(), options = [], worth = [];
	for (const [id, types] of msg.jobs) {
		const site = siteOf.get(id);
		// a list of types: only those (they paid off at the last full pass); null: every type, and report which pay off
		const only = types ? new Set(types) : null;
		const found = plan.buildingOptions(ctx, site, { staffing: 'promotion', types: only ? (k => only.has(k)) : undefined });
		if (!only) worth.push([id, found.filter(o => o.gain > 0).map(o => o.type)]);
		for (const o of found) if (o.gain > 0) options.push(lean(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }), id));
		// an urbanisation is valued with the buildings it unlocks; only the rise itself joins the market plan
		const u = plan.urbanOption(ctx, site, cache);
		if (u && u.verdict === 'food-safe' && u.value > 0) options.push(lean(plan.withFlows(ctx, { ...u, worth: u.value, cost2: u.valueCost }), id));
	}
	// the price sensitivity of every location of this worker's provinces, busy ones too (summed in the main thread, in the
	// one-thread order)
	parentPort.postMessage({ options, worth, sens: msg.mine.map(id => [id, plan.priceSensitivity(ctx.base.get(siteOf.get(id)).r)]) });
});
