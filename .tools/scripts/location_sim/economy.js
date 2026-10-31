// Economy simulator: a country month by month for decades, spending its surplus gold the way a player would, to compare
// the long-run effect of modifiers (+20% building efficiency, +20% urban building efficiency, +3% tax efficiency...).
//   node .tools/scripts/location_sim/economy.js <country scenario.json> [--years 30] [--decide 12] [--reserve 0]
//        [--promotion 0.05] [--max-payback years] [--roads-every 5] [--full-every 5] [--build-share 0.33]
//        [--stability 0|save]                      the stability investment: none (default) or the save's, with the economy
//        [--threads N]                             worker threads in all (default: the CPU's threads less one)
//        [--profile]                               where each run's time went
//        [--mod key=+x]...                         change a country modifier for the run (repeatable)
//        [--compare "key=+x" "key2=+y,key3=-z"...] a baseline run and one run per variant, side by side
//        [--idle]                                  also a run that never invests (what investing gains)
//        [--unlock adv1,adv2]                      advances every run has from the start (armory_advance...)
//        [--levy-years 10,30,50]                   record the army levy by unit in those years (always the last year)
//        [--json out.json]                         the runs' yearly numbers, what they built and their levies
// In --mod and --compare, @mv=x makes a man of monthly manpower worth x gold a month when choosing what to build, and @from=y
// starts that in year y (use a multiple of --full-every).
//        [--serial]                                runs one after another (by default each runs in its own thread)
//        [--explain 20]                            the first N purchases of every decision, their value in parts
// Books: income = crown tax (simulated) + other income held at the save's (minting, trade, food sales...); expenses =
// building upkeep (simulated, as the game charges it), the court (and with --stability save the stability investment), which
// scale with the economic base at the save's slider positions (NEconomy: 0.5 x wealth + 0.015 x population + trade terms, x (1 + 0.066 a
// embraced institution); legitimacy and stability then move as they did), and army, navy, forts and food held. Every
// --decide months the whole treasury above --reserve months of expenses (0: everything is invested, so a modifier's
// extra surplus compounds) buys the best options by value per gold (planner.js: building levels with jobs filled by
// promotion and their new workers' demand, food-safe urbanisation valued with the buildings it unlocks, roads every
// --roads-every years), at most one per location per decision; each finishes after its build time. Every month idle
// peasants promote into --promotion of the open jobs (the game's formula is not decoded), which shifts market demand
// toward what burghers, nobles and clergy buy. A decision prices the locations' options in worker threads
// (planner_worker.js), each with its own copy of the country; runs side by side share the threads.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
E.setTracking(false); // no tooltips: modifier sources are not recorded
const CS = require('./country.js');
CS.setMap(require('./map.json'));
const plan = require('./planner.js');
const monthly = require('./months.js'); // the per-location parts of a month (shared with the shards)
const DB = E.DB;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const all = k => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
// every value after a flag up to the next flag: --compare "a=+1" "b=+2"
const after = k => args.flatMap((a, i) => { const out = []; if (a === k) for (let j = i + 1; j < args.length && !args[j].startsWith('--') && !args[j].endsWith('.json'); j++) out.push(args[j]); return out; });
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node economy.js <country scenario.json> [--years 30] [--mod key=+x] [--compare "key=+x" ...]'); process.exit(1); }
const scn0 = JSON.parse(fs.readFileSync(file, 'utf8'));
const opt = {
	years: +flag('--years', 30), decide: +flag('--decide', 12), reserve: +flag('--reserve', 0), promotion: +flag('--promotion', 0.05),
	maxPayback: +flag('--max-payback', Infinity), buildShare: +flag('--build-share', 1 / 3), roadsEvery: +flag('--roads-every', 5), fullEvery: +flag('--full-every', 5), quiet: args.includes('--quiet'), explain: +flag('--explain', 0),
	stability: flag('--stability', '0'), profile: args.includes('--profile'), threads: +flag('--threads', Math.max(1, os.availableParallelism() - 1)),
};
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const nm = k => DB.names[k] || k;

// "key=+0.2,key2=-0.1" -> [[key, 0.2], [key2, -0.1]]
const parseMods = s => String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k.trim(), parseFloat(v)]; });
const unlocks = String(flag('--unlock', '')).split(',').filter(Boolean);
const levyYears = String(flag('--levy-years', '')).split(',').filter(Boolean).map(Number);
const progress = require('../battle_sim/progress.js');

// a max-heap of [score, item]
class Heap {
	constructor() { this.a = []; }
	get size() { return this.a.length; }
	peek() { return this.a[0][0]; }
	push(score, item) {
		const a = this.a; a.push([score, item]);
		for (let i = a.length - 1; i > 0;) { const p = (i - 1) >> 1; if (a[p][0] >= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
	}
	pop() {
		const a = this.a, top = a[0], last = a.pop();
		if (a.length) {
			a[0] = last;
			for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < a.length && a[l][0] > a[k][0]) k = l; if (r < a.length && a[r][0] > a[k][0]) k = r; if (k === i) break; [a[k], a[i]] = [a[i], a[k]]; i = k; }
		}
		return top;
	}
}

// a shard of the run (planner_worker.js): whole provinces for the whole run; one message at a time
function newShard(scn, mine) {
	const w = new Worker(path.join(__dirname, 'planner_worker.js'), { workerData: { scn, mine } });
	let pending = null;
	w.on('message', m => { const p = pending; pending = null; if (p) p.res(m); });
	w.on('error', e => { const p = pending; pending = null; if (p) p.rej(e); else throw e; });
	return { run: msg => new Promise((res, rej) => { pending = { res, rej }; w.postMessage(msg); }), terminate: () => w.terminate() };
}

// milliseconds spent per part of a run (--profile)
const clock = () => { const T = {}; let t = Date.now(); return { T, lap(k) { const n = Date.now(); T[k] = (T[k] || 0) + n - t; t = n; } }; };

async function run(variant, label, invest = true) {
	const time = clock();
	const scn = JSON.parse(JSON.stringify(scn0));
	scn.options = { ...(scn.options || {}), markets: 'fixed', food: 'on' };
	scn.country.advances = [...new Set([...(scn.country.advances || []), ...unlocks])];
	const special = k => (variant.find(([x]) => x === k) || [])[1];
	const mv = special('@mv') || 0, mvFrom = (special('@from') || 0) * 12;
	const mods0 = { ...scn.country.modifiers };
	for (const [k, v] of variant) {
		if (k.startsWith('@')) continue;
		scn.country.modifiers[k] = (scn.country.modifiers[k] || 0) + v;
		if (scn.country.sources && scn.country.sources[k]) scn.country.sources[k].push(['economy.js variant', v]);
	}
	const state = CS.create(scn);
	const obs = scn.country.observed || {};
	const maint = obs.maintenance || {};
	// held: army, navy, forts, food (and colonies, exploration...); with the economic base: the court, and the stability
	// investment (last month's expense minus the maintenance list, which leaves it out)
	const SCALED = new Set(['UpkeepMaintenance', 'CourtMaintenance']);
	// the held army and navy follow a change of maintenance efficiency: upkeep is / (1 + efficiency)
	const eff = (key, k) => (maint[key] || 0) * ((1 + (mods0[k] || 0)) / (1 + (scn.country.modifiers[k] || 0)) - 1);
	const fixed = Object.entries(maint).filter(([k]) => !SCALED.has(k)).reduce((a, [, v]) => a + v, 0) + eff('ArmyMaintenance', 'army_maintenance_efficiency') + eff('NavyMaintenance', 'navy_maintenance_efficiency');
	const court0 = maint.CourtMaintenance || 0;
	// the stability investment: none by default (most players pay it only for a while, e.g. to clear a disaster); --stability save
	// keeps the save's (Spain 908 a month, paid to reach 30 stability)
	const stability0 = opt.stability === 'save' && obs.expense !== undefined ? Math.max(0, obs.expense - Object.values(maint).reduce((a, v) => a + v, 0)) : 0;
	const otherIncome = (obs.goldIncome || 0) - (obs.taxIncome || 0);
	// the economic base (NEconomy): wealth regardless of control, population, and the rest (trade, tariffs, subjects...)
	// held at what the save's value leaves over; x (1 + 0.066 a embraced institution)
	const NE = DB.defines.NEconomy || {}, instScale = 1 + (NE.ECONOMICAL_BASE_SCALE_FROM_EACH_INSTITUTION ?? 0.066) * (obs.institutions || 0);
	const ecoOwn = t => (NE.ECONOMICAL_BASE_FROM_TAX_BASE ?? 0.5) * t.wealth + (NE.ECONOMICAL_BASE_FROM_POP ?? 0.015) * t.population;
	let ecoRest = null, eco0 = null;
	const book = { treasury: obs.treasury || 0, invested: 0, crownTotal: 0, netTotal: 0, built: { building: 0, rank: 0, road: 0 }, types: {}, bought: [] };
	const queue = []; // projects under construction: { done, kind, siteId, site, ... } (data, so a shard can apply them)
	const years = [];
	const months = opt.years * 12;
	let yearStats = null;
	const levyAt = {};
	const siteOf = new Map(state.sites.map(s => [s.loc.id, s]));
	const worth = new Map(), rankChanged = new Set(); // building types that paid off per location; locations that rose a rank
	const townWorth = new Map(); // whether a location's rise was a candidate at the last full pass
	const siteIndex = new Map(state.sites.map((s, i) => [s, i]));
	// shards (planner_worker.js): whole provinces each for the whole run, the biggest first to the least loaded; each keeps
	// its locations up to date and does their part of every month and decision. This thread keeps the country: budget,
	// proximity, province food, markets, the decisions' choice. --threads 1: everything in this thread.
	const nShards = Math.floor(opt.threads / opt.runs);
	let shards = null;
	if (nShards > 1) {
		const byProvince = new Map();
		for (const site of state.sites) { const p = plan.provinceOf(site.loc.id); (byProvince.get(p) || byProvince.set(p, []).get(p)).push(site); }
		const parts = Array.from({ length: nShards }, () => []);
		for (const group of [...byProvince.values()].sort((a, b) => b.length - a.length)) parts.reduce((a, b) => (b.length < a.length ? b : a)).push(...group);
		shards = parts.filter(p => p.length).map(p => ({ sites: p, ids: new Set(p.map(s => s.loc.id)), w: newShard(scn, p.map(s => s.loc.id)) }));
	}
	const each = make => Promise.all(shards.map((s, i) => s.w.run(make(s, i))));
	let updates = null; // last month's proximity and province food, for the shards
	time.lap('start');
	try {
	for (let m = 0; m <= months; m++) {
		// projects that finish this month; then the month's evaluation (each shard its provinces)
		const due = queue.filter(q => q.done === m);
		for (const p of due) finished(p);
		let results;
		if (shards) {
			const projects = due.filter(p => p.kind !== 'road').concat(due.filter(p => p.kind === 'road').flatMap(p => [p.a, p.b].map(id => ({ kind: 'road', siteId: id }))));
			const markets = Object.fromEntries(Object.entries(state.markets).map(([id, mk]) => [id, { prices: mk.prices, foodPrice: mk.foodPrice }]));
			const replies = await each(s => ({ type: 'month', first: m === 0, yearly: m % 12 === 0, markets,
				updates: updates && s.sites.map(x => [x.loc.id, updates.get(x)]),
				projects: projects.filter(p => s.ids.has(p.siteId)).map(({ site, flow, ...p }) => p) }));
			// the summaries stand in for results, in location order; this thread's locations keep prices, population, control
			const sumOf = new Map();
			for (const r of replies) for (const x of r.sums) sumOf.set(x.id, x);
			results = new Map(state.sites.map(site => {
				const x = sumOf.get(site.loc.id);
				site.L.population = x.population; site.L.control = x.control;
				const mk = state.markets[site.loc.market];
				if (mk) Object.assign(site.L.prices, mk.prices);
				return [site, monthly.asResult(x)];
			}));
		} else {
			for (const p of due) if (p.kind !== 'road') monthly.applyProject(state, p.site, p);
			({ results } = CS.evaluateAll(state, m === 0));
			if (m === 0) for (const s of state.sites) s.obs = null; // after month 0 employment follows the pops, not the save
		}
		const t = CS.totals(state, results);
		if (ecoRest === null) { eco0 = obs.economicBase || ecoOwn(t) * instScale; ecoRest = eco0 / instScale - ecoOwn(t); }
		const eco = (ecoOwn(t) + ecoRest) * instScale, scaled = (court0 + stability0) * eco / eco0;
		const income = t.crownTax + otherIncome, expenses = fixed + scaled + t.upkeep;
		book.treasury += income - expenses;
		book.crownTotal += t.crownTax; book.netTotal += income - expenses;
		if (m % 12 === 0) {
			const pops = {};
			let dev = 0, towns = 0;
			for (const site of state.sites) {
				const x = shards ? results.get(site) : { pops: null, development: site.L.development, rank: site.L.rank };
				if (shards) for (const [type, n] of Object.entries(x.pops)) pops[type] = (pops[type] || 0) + n;
				else for (const p of site.L.pops) pops[p.type] = (pops[p.type] || 0) + p.size;
				dev += x.development; if (x.rank !== 'rural_settlement') towns++;
			}
			yearStats = { year: m / 12, treasury: book.treasury, crown: t.crownTax, taxBase: t.taxBase, upkeep: t.upkeep, net: income - expenses, eco, courtStability: scaled, population: t.population, burghers: pops.burghers || 0,
				manpower: t.manpower, maxManpower: t.maxManpower, pool: state.manpowerPool, control: t.control, development: dev / state.sites.length, invested: book.invested, built: { ...book.built }, towns, types: { ...book.types } };
			years.push(yearStats);
			if (!isMainThread) parentPort.postMessage({ tick: 1 }); else if (tickYear) tickYear();
			if (levyYears.includes(m / 12) || m === months) {
				const rows = shards ? (await each(() => ({ type: 'levies' }))).flatMap(r => r.rows) : [...results.values()].flatMap(r => r.levies.rows.filter(x => x.kind === 'army').map(x => [x.unit, x.regimentSize, x.men / (x.recovery || 1), x.men]));
				const by = {};
				for (const [unit, size, full, now] of rows) { const u = (by[unit] ??= { unit, size, men: 0, now: 0 }); u.men += Math.floor(full * 1000) / 1000; u.now += Math.floor(now * 1000) / 1000; }
				levyAt[m / 12] = Object.values(by).sort((a, b) => b.men - a.men);
			}
			if (!opt.quiet) console.log(`  [${label}] year ${String(m / 12).padStart(2)}: crown tax ${num(t.crownTax, 0)}/mo, tax base ${num(t.taxBase, 0)}, upkeep ${num(t.upkeep, 0)}, court+stability ${num(scaled, 0)}, net ${num(income - expenses, 0)}/mo, economic base ${num(eco)}, treasury ${num(book.treasury)}, invested ${num(book.invested)}, built ${book.built.building} levels / ${book.built.road} roads / ${book.built.rank} ranks`);
		}
		if (m === months) break;
		time.lap('months');
		if (invest && m % opt.decide === 0) await decide(m, results, income - expenses);
		// the month: manpower, pops, control, development, staffing; promotion; proximity, food, markets
		state.manpowerPool = Math.max(0, Math.min(t.maxManpower, state.manpowerPool + t.manpower - state.manpowerExpense));
		if (shards) {
			// each shard's month passes; this thread takes their pops for the market step
			for (const r of await each(() => ({ type: 'advance', promotion: opt.promotion })))
				for (const [id, pops, population] of r.pops) { const L = siteOf.get(id).L; L.pops = pops.map(([type, size]) => ({ type, size })); L.population = population; }
		} else {
			for (const [site, r] of results) E.advance(site.L, r);
			for (const [site, r] of results) monthly.promote(site, r, opt.promotion);
		}
		if (state.proxMode === 'computed') CS.proximity(state, results);
		if (state.food) CS.stepFood(state, results);
		CS.stepMarkets(state, results);
		if (shards) updates = new Map(state.sites.map(site => [site, { proximity: site.L.proximity, food: site.L.food, foodPrice: site.L.foodPrice }]));
	}
	} finally { if (shards) for (const s of shards) s.w.terminate(); }
	time.lap('months');
	if (opt.profile) console.log(`  [${label}] time: ${Object.entries(time.T).map(([k, v]) => `${k} ${(v / 1000).toFixed(1)} s`).join(', ')}`);
	return { label, variant, years, book, levies: levyAt };

	// ---- spend the treasury above the reserve, best value per gold first. An option's value is its gain once control has
	// settled, at the prices its output and inputs settle at in its market (with what is already planned there), minus what
	// those price moves cost our other locations, plus what cheaper construction goods save on future building. Values fall
	// as a market fills up, so the best option is re-valued against what was bought before it is bought (lazy greedy).
	async function decide(m, results, netNow) {
		const reserve = opt.reserve * (fixed + [...results.values()].reduce((a, r) => a + r.upkeep, 0));
		let budget = book.treasury - reserve;
		if (budget < 100) return;
		const ctx = plan.context(scn, { state, results });
		const manpowerValue = m >= mvFrom ? mv : 0;
		ctx.manpowerValue = manpowerValue;
		const options = [];
		time.lap('months');
		const cache = new Map();
		// every --full-every years all building types are priced; in between only the types that paid off last time (and
		// everything where the rank changed), which keeps a decision to a few seconds
		const full = !(m % (opt.fullEvery * 12)) || !worth.size;
		const busy = new Set(queue.filter(q => q.done > m && q.site).map(q => q.site)); // one project at a time per location
		const jobs = state.sites.filter(site => !busy.has(site)).map(site => {
			const known = worth.get(site), fresh = full || !known || rankChanged.has(site);
			return [site, fresh ? null : [...known]];
		});
		const roadsDue = opt.roadsEvery > 0 && m % (opt.roadsEvery * 12) === 0;
		let sens = null;
		if (shards) {
			// each shard prices its own locations (as they stand this month) and sends their price sensitivity
			const jobOf = new Map(jobs);
			const replies = await each(s => ({ type: 'options', manpowerValue, jobs: s.sites.filter(x => jobOf.has(x)).map(x => [x.loc.id, jobOf.get(x)]),
				towns: s.sites.filter(x => townWorth.get(x)).map(x => x.loc.id) }));
			const sensOf = new Map();
			for (const r of replies) {
				for (const [id, types] of r.worth) { const site = siteOf.get(id); worth.set(site, new Set(types)); rankChanged.delete(site); }
				for (const [id, ok] of r.towns) townWorth.set(siteOf.get(id), ok);
				for (const o of r.options) { o.site = siteOf.get(o.siteId); options.push(o); }
				for (const [id, x] of r.sens) sensOf.set(id, x);
			}
			sens = {};
			for (const site of state.sites) { const y = (sens[site.loc.market] ??= {}); for (const [g, v] of Object.entries(sensOf.get(site.loc.id) || {})) y[g] = (y[g] || 0) + v; }
			// the order of the one-thread run (by location), so ties fall the same way
			options.sort((a, b) => siteIndex.get(a.site) - siteIndex.get(b.site));
			time.lap('decisions: options (threads)');
		} else for (const [site, types] of jobs) {
			const only = types ? new Set(types) : null;
			const found = plan.buildingOptions(ctx, site, { staffing: 'promotion', types: only ? (k => only.has(k)) : undefined });
			if (!only) { worth.set(site, new Set(found.filter(o => o.gain > 0).map(o => o.type))); rankChanged.delete(site); }
			for (const o of found) if (o.gain > 0) options.push(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }));
			// an urbanisation is valued with the buildings it unlocks; only the rise itself joins the market plan. Between full
			// passes only where it was a candidate at the last one
			const u = !only || townWorth.get(site) ? plan.urbanOption(ctx, site, cache) : null;
			const ok = u && u.verdict === 'food-safe' && u.value > 0;
			if (!only) townWorth.set(site, !!ok);
			if (ok) options.push(plan.withFlows(ctx, { ...u, worth: u.value, cost2: u.valueCost }));
		}
		time.lap('decisions: options');
		if (roadsDue) {
			let roads;
			if (shards) {
				// two passes: every location's crown tax over control (each shard its own), then a share of the borders each
				const pairs = plan.roadCandidates(ctx), shares = shards.map(() => []); // (builds the road index the first time)
				const infoOf = new Map();
				for (const r of await each(() => ({ type: 'roadInfo' }))) for (const x of r.info) infoOf.set(x.id, x);
				const info = state.sites.map(site => infoOf.get(site.loc.id));
				pairs.forEach((p, i) => shares[i % shards.length].push(p));
				const prox = state.sites.map(site => [site.loc.id, results.get(site).prox]), roadIdx = [...state.roadIndex];
				const scored = await each((s, i) => ({ type: 'roadScores', info, pairs: shares[i], roads: roadIdx, prox }));
				// back in the one-thread order
				const at = new Map(); scored.forEach(r => r.scores.forEach(x => at.set(x[0] + ',' + x[1], x)));
				roads = plan.roadPriced(ctx, pairs.map(([a, b]) => at.get(a + ',' + b)));
			} else roads = plan.roadOptions(ctx);
			for (const o of roads) if (o.gain > 0) options.push(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }));
		}
		time.lap('decisions: roads');

		// markets: settled prices, our sensitivity, what is under construction. Future building (what cheaper construction
		// goods save on): the pace of spending since the first decision (which spends the starting treasury), with
		// --build-share of the surplus as a three-year prior; shared among markets and goods as spent so far (or as the
		// options on the table would spend it, the first time). Spain spends about a third of its surplus: options that pay
		// back within --max-payback run out before the gold does.
		const M = plan.markets(ctx, sens || undefined);
		for (const q of queue) if (q.done > m && q.flow) plan.addFlow(M.plannedOf(q.mk), q.flow);
		const since = book.first ? m - book.first.month : 0, spent = book.first ? book.invested - book.first.spent : 0;
		const pace = (36 * opt.buildShare * Math.max(0, netNow) + spent) / (36 + since);
		plan.setFuture(M, book.bought.length ? book.bought : options.map(o => ({ mk: o.mk, cost: o.cost, w: plan.constructionWeights(ctx, o) })), pace);
		const value = (o, parts) => plan.marketValue(M, o, parts);
		const heap = new Heap();
		for (const o of options) { o.value = value(o); if (o.value > 0) heap.push(o.value / o.cost2, o); }
		const used = new Set();
		let explained = 0;
		while (heap.size && budget >= 50) {
			const [score, o] = heap.pop();
			const key = o.kind === 'road' ? 'road ' + o.a : o.site.loc.id;
			if (used.has(key) || (o.kind === 'road' && (used.has(o.a) || used.has(o.b))) || o.cost > budget) continue;
			// re-value against what was bought since; buy it if it still beats the next best
			const v = value(o);
			if (!(v > 0)) continue;
			if (heap.size && v / o.cost2 < heap.peek() - 1e-12 && v / o.cost2 < score - 1e-12) { o.value = v; heap.push(v / o.cost2, o); continue; }
			// payback in years (the value is a month's)
			if (o.cost / v / 12 > opt.maxPayback) continue;
			o.value = v;
			used.add(key); if (o.kind === 'road') { used.add(o.a); used.add(o.b); }
			plan.commit(M, o);
			budget -= o.cost; book.treasury -= o.cost; book.invested += o.cost;
			book.bought.push({ mk: o.mk, cost: o.cost, w: plan.constructionWeights(ctx, o) });
			if (explained < opt.explain) {
				const p = {}; value(o, p); explained++;
				const what = o.kind === 'road' ? `road ${nm(DB.locations[o.a - 1] ? DB.locations[o.a - 1][0] : o.a)}` : `${o.kind === 'rank' ? o.rank : nm(o.type)} in ${nm(o.where)}`;
				const goods = (p.goods || []).filter(([, a, b]) => Math.abs(b - a) >= 0.005).map(([g, a, b]) => `${nm(g)} ${num(a, 2)}→${num(b, 2)}`);
				console.log(`    month ${m}: ${what.slice(0, 40).padEnd(40)} ${num(o.cost).padStart(6)} gold  gain ${num(o.worth, 2).padStart(6)}  own prices ${num(p.own || 0, 2).padStart(6)}  others ${num(p.others || 0, 2).padStart(6)}  cheaper building ${num(p.building || 0, 2).padStart(6)}  = ${num(v, 2).padStart(6)}/mo  ${goods.join(', ')}`);
			}
			schedule(o, m);
		}
		time.lap('decisions: markets and choice');
		if (!book.first) book.first = { month: m, spent: book.invested };
	}
	// a bought option goes on the queue; it buys its construction goods every month until it is done
	function schedule(o, m) {
		const days = o.kind === 'road' ? 180 : (typeof o.bt === 'number' ? o.bt : DB.values[o.bt] ?? 365);
		const done = m + Math.max(1, Math.round(days / 30.4));
		const goods = ((o.demandKey && DB.demands[o.demandKey]) || {}).goods;
		if (goods && Object.keys(goods).length) state.constructions.push({ market: o.mk, goods, months: done - m });
		if (o.kind === 'building') queue.push({ done, kind: 'building', siteId: o.site.loc.id, site: o.site, type: o.type, methods: o.methods, mk: o.mk, flow: o.flowOwn });
		else if (o.kind === 'rank') queue.push({ done, kind: 'rank', siteId: o.site.loc.id, site: o.site, rank: o.rank, mk: o.mk, flow: o.flowOwn });
		else if (o.kind === 'road') queue.push({ done, kind: 'road', a: o.a, b: o.b, road: o.road });
	}
	// a project done: the books, and the road index here (buildings and ranks are applied where their location lives)
	function finished(p) {
		if (p.kind === 'building') { book.built.building++; book.types[p.type] = (book.types[p.type] || 0) + 1; }
		else if (p.kind === 'rank') { rankChanged.add(p.site); book.built.rank++; }
		else if (p.kind === 'road') {
			state.roadIndex.set(p.a + ',' + p.b, p.road); state.roadIndex.set(p.b + ',' + p.a, p.road);
			for (const id of [p.a, p.b]) { const s = siteOf.get(id); if (s) s.L.road = true; }
			book.built.road++;
		}
	}
}

// ---- runs and report: several runs go to worker threads, one each (--serial runs them one after another)
const variants = [['baseline', parseMods(all('--mod').join(','))]];
if (args.includes('--idle')) variants.push(['no investment', parseMods(all('--mod').join(',')), false]);
for (const v of after('--compare')) variants.push([v, [...parseMods(all('--mod').join(',')), ...parseMods(v)]]);
const mostBuilt = r => Object.entries(r.book.types).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${nm(k)} ${n}`).join(', ');
const summary = r => ({ label: r.label, years: r.years, levies: r.levies, book: { crownTotal: r.book.crownTotal, netTotal: r.book.netTotal, invested: r.book.invested, types: r.book.types, built: r.book.built } });
let tickYear = null;
// runs side by side share the planner threads
opt.runs = variants.length > 1 && !args.includes('--serial') ? variants.length : 1;
const runOne = async ([label, v, invest]) => summary(await run(v, label, invest !== false));
if (!isMainThread) runOne(variants[workerData.i]).then(r => parentPort.postMessage(r));
else report();

async function report() {
	const t0 = Date.now();
	const parallel = variants.length > 1 && !args.includes('--serial');
	tickYear = progress((opt.years + 1) * variants.length, 'run-years', 5000);
	const go = (x, i) => (parallel ? new Promise((res, rej) => {
		const w = new Worker(__filename, { argv: process.argv.slice(2), workerData: { i } });
		w.on('message', m => { if (m && m.tick) tickYear(); else res(m); }); w.on('error', rej);
	}) : runOne(x));
	const runs = [];
	for (const p of variants.map((x, i) => (parallel ? go(x, i) : null))) runs.push(p);
	for (let i = 0; i < variants.length; i++) {
		runs[i] = await (runs[i] || go(variants[i], i));
		if (!opt.quiet) console.log(`  [${runs[i].label}] done (${((Date.now() - t0) / 1000).toFixed(0)} s); most built: ${mostBuilt(runs[i])}
`);
	}

	console.log(`
${scn0.name}: ${opt.years} years; decisions every ${opt.decide} months, reserve ${opt.reserve} months of expenses${Number.isFinite(opt.maxPayback) ? `, payback within ${opt.maxPayback} years` : ''}, promotion ${100 * opt.promotion}% of open jobs a month`);
	const at = (r, y) => r.years.find(x => x.year === y) || r.years[r.years.length - 1];
	const marks = [...new Set((opt.years >= 40 ? [10, 25, opt.years] : [5, 10, 20, opt.years]).filter(y => y <= opt.years))];
	const head = ['run'.padEnd(34), ...marks.map(y => `crown tax y${y}`.padStart(15)), 'crown tax total'.padStart(17), `tax base y${opt.years}`.padStart(17), `surplus y${opt.years}`.padStart(12), `eco base y${opt.years}`.padStart(13), 'invested'.padStart(10), 'treasury'.padStart(10), 'pop'.padStart(12), 'burghers'.padStart(10), 'towns'.padStart(6), 'manpower/mo'.padStart(12)];
	console.log(head.join(' '));
	const base = runs[0];
	for (const r of runs) {
		const end = at(r, opt.years);
		const d = (x, b) => (r === base ? '' : ` (${x >= b ? '+' : '−'}${num(Math.abs(100 * (x / b - 1)), 1)}%)`);
		console.log([r.label.slice(0, 34).padEnd(34), ...marks.map(y => num(at(r, y).crown).padStart(15)), (num(r.book.crownTotal) + d(r.book.crownTotal, base.book.crownTotal)).padStart(17),
			(num(end.taxBase) + d(end.taxBase, at(base, opt.years).taxBase)).padStart(17), num(end.net).padStart(12), num(end.eco).padStart(13), num(r.book.invested).padStart(10), num(end.treasury).padStart(10), num(end.population * 1000).padStart(12), num(end.burghers * 1000).padStart(10), String(end.towns).padStart(6), num(end.manpower * 1000).padStart(12)].join(' '));
	}
	for (const r of runs) if (Object.keys(r.book.types).length) console.log(`  ${r.label}: most built ${mostBuilt(r)}`);
	if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify({ name: scn0.name, source: scn0.source, years: opt.years, unlocks, runs }, null, '\t'));
	console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
