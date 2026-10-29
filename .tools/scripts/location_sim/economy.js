// Economy simulator: a country month by month for decades, spending its surplus gold the way a player would, to compare
// the long-run effect of modifiers (+20% building efficiency, +20% urban building efficiency, +3% tax efficiency...).
//   node .tools/scripts/location_sim/economy.js <country scenario.json> [--years 30] [--decide 12] [--reserve 0]
//        [--promotion 0.05] [--max-payback years] [--roads-every 5] [--full-every 5] [--build-share 0.33]
//        [--mod key=+x]...                         change a country modifier for the run (repeatable)
//        [--compare "key=+x" "key2=+y,key3=-z"...] a baseline run and one run per variant, side by side
//        [--idle]                                  also a run that never invests (what investing gains)
//        [--serial]                                runs one after another (by default each runs in its own thread)
//        [--explain 20]                            the first N purchases of every decision, their value in parts
// Books: income = crown tax (simulated) + other income held at the save's (minting, trade, food sales...); expenses =
// building upkeep (simulated, as the game charges it), the court and the stability investment, which scale with the
// economic base at the save's slider positions (NEconomy: 0.5 x wealth + 0.015 x population + trade terms, x (1 + 0.066 a
// embraced institution); legitimacy and stability then move as they did), and army, navy, forts and food held. Every
// --decide months the whole treasury above --reserve months of expenses (0: everything is invested, so a modifier's
// extra surplus compounds) buys the best options by value per gold (planner.js: building levels with jobs filled by
// promotion and their new workers' demand, food-safe urbanisation valued with the buildings it unlocks, roads every
// --roads-every years), at most one per location per decision; each finishes after its build time. Every month idle
// peasants promote into --promotion of the open jobs (the game's formula is not decoded), which shifts market demand
// toward what burghers, nobles and clergy buy.
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const CS = require('./country.js');
CS.setMap(require('./map.json'));
const plan = require('./planner.js');
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
};
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const nm = k => DB.names[k] || k;

// "key=+0.2,key2=-0.1" -> [[key, 0.2], [key2, -0.1]]
const parseMods = s => String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k.trim(), parseFloat(v)]; });

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

function run(variant, label, invest = true) {
	const scn = JSON.parse(JSON.stringify(scn0));
	scn.options = { ...(scn.options || {}), markets: 'fixed', food: 'on' };
	for (const [k, v] of variant) {
		scn.country.modifiers[k] = (scn.country.modifiers[k] || 0) + v;
		if (scn.country.sources && scn.country.sources[k]) scn.country.sources[k].push(['economy.js variant', v]);
	}
	const state = CS.create(scn);
	const obs = scn.country.observed || {};
	const maint = obs.maintenance || {};
	// held: army, navy, forts, food (and colonies, exploration...); with the economic base: the court, and the stability
	// investment (last month's expense minus the maintenance list, which leaves it out)
	const SCALED = new Set(['UpkeepMaintenance', 'CourtMaintenance']);
	const fixed = Object.entries(maint).filter(([k]) => !SCALED.has(k)).reduce((a, [, v]) => a + v, 0);
	const court0 = maint.CourtMaintenance || 0;
	const stability0 = obs.expense !== undefined ? Math.max(0, obs.expense - Object.values(maint).reduce((a, v) => a + v, 0)) : 0;
	const otherIncome = (obs.goldIncome || 0) - (obs.taxIncome || 0);
	// the economic base (NEconomy): wealth regardless of control, population, and the rest (trade, tariffs, subjects...)
	// held at what the save's value leaves over; x (1 + 0.066 a embraced institution)
	const NE = DB.defines.NEconomy || {}, instScale = 1 + (NE.ECONOMICAL_BASE_SCALE_FROM_EACH_INSTITUTION ?? 0.066) * (obs.institutions || 0);
	const ecoOwn = t => (NE.ECONOMICAL_BASE_FROM_TAX_BASE ?? 0.5) * t.wealth + (NE.ECONOMICAL_BASE_FROM_POP ?? 0.015) * t.population;
	let ecoRest = null, eco0 = null;
	const book = { treasury: obs.treasury || 0, invested: 0, crownTotal: 0, netTotal: 0, built: { building: 0, rank: 0, road: 0 }, types: {}, bought: [] };
	const queue = [];
	const years = [];
	const months = opt.years * 12;
	let yearStats = null;
	const siteOf = new Map(state.sites.map(s => [s.loc.id, s]));
	const worth = new Map(), rankChanged = new Set(); // building types that paid off per location; locations that rose a rank
	for (let m = 0; m <= months; m++) {
		// projects that finish this month
		for (const p of queue.filter(q => q.done === m)) p.apply();
		const { results } = CS.evaluateAll(state, m === 0);
		if (m === 0) for (const s of state.sites) s.obs = null; // after month 0 employment follows the pops, not the save
		const t = CS.totals(state, results);
		if (ecoRest === null) { eco0 = obs.economicBase || ecoOwn(t) * instScale; ecoRest = eco0 / instScale - ecoOwn(t); }
		const eco = (ecoOwn(t) + ecoRest) * instScale, scaled = (court0 + stability0) * eco / eco0;
		const income = t.crownTax + otherIncome, expenses = fixed + scaled + t.upkeep;
		book.treasury += income - expenses;
		book.crownTotal += t.crownTax; book.netTotal += income - expenses;
		if (m % 12 === 0) {
			const pops = {}; for (const s of state.sites) for (const p of s.L.pops) pops[p.type] = (pops[p.type] || 0) + p.size;
			const devAvg = state.sites.reduce((a, s) => a + s.L.development, 0) / state.sites.length;
			yearStats = { year: m / 12, treasury: book.treasury, crown: t.crownTax, upkeep: t.upkeep, net: income - expenses, eco, courtStability: scaled, population: t.population, burghers: pops.burghers || 0,
				manpower: t.manpower, control: t.control, development: devAvg, invested: book.invested, built: { ...book.built },
				towns: state.sites.filter(s => s.L.rank !== 'rural_settlement').length };
			years.push(yearStats);
			if (!opt.quiet) console.log(`  [${label}] year ${String(m / 12).padStart(2)}: crown tax ${num(t.crownTax, 0)}/mo, upkeep ${num(t.upkeep, 0)}, court+stability ${num(scaled, 0)}, net ${num(income - expenses, 0)}/mo, economic base ${num(eco)}, treasury ${num(book.treasury)}, invested ${num(book.invested)}, built ${book.built.building} levels / ${book.built.road} roads / ${book.built.rank} ranks`);
		}
		if (m === months) break;
		if (invest && m % opt.decide === 0) decide(m, results, income - expenses);
		// the month: manpower, pops, control, development, staffing; promotion; proximity, food, markets
		state.manpowerPool = Math.max(0, Math.min(t.maxManpower, state.manpowerPool + t.manpower - state.manpowerExpense));
		for (const [site, r] of results) E.advance(site.L, r);
		promote(results);
		if (state.proxMode === 'computed') CS.proximity(state, results);
		if (state.food) CS.stepFood(state, results);
		CS.stepMarkets(state, results);
	}
	return { label, variant, years, book };

	// ---- spend the treasury above the reserve, best value per gold first. An option's value is its gain once control has
	// settled, at the prices its output and inputs settle at in its market (with what is already planned there), minus what
	// those price moves cost our other locations, plus what cheaper construction goods save on future building. Values fall
	// as a market fills up, so the best option is re-valued against what was bought before it is bought (lazy greedy).
	function decide(m, results, netNow) {
		const reserve = opt.reserve * (fixed + [...results.values()].reduce((a, r) => a + r.upkeep, 0));
		let budget = book.treasury - reserve;
		if (budget < 100) return;
		const ctx = plan.context(scn, { state, results });
		const options = [];
		const cache = new Map();
		// every --full-every years all building types are priced; in between only the types that paid off last time (and
		// everything where the rank changed), which keeps a decision to a few seconds
		const full = !(m % (opt.fullEvery * 12)) || !worth.size;
		for (const site of state.sites) {
			if (queue.some(q => q.site === site && q.done > m)) continue; // one project at a time per location
			const known = worth.get(site), fresh = full || !known || rankChanged.has(site);
			const types = fresh ? undefined : (k => known.has(k));
			const found = plan.buildingOptions(ctx, site, { staffing: 'promotion', types });
			if (fresh) { worth.set(site, new Set(found.filter(o => o.gain > 0).map(o => o.type))); rankChanged.delete(site); }
			for (const o of found) if (o.gain > 0) options.push(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }));
			// an urbanisation is valued with the buildings it unlocks; only the rise itself joins the market plan
			const u = plan.urbanOption(ctx, site, cache);
			if (u && u.verdict === 'food-safe' && u.value > 0) options.push(plan.withFlows(ctx, { ...u, worth: u.value, cost2: u.valueCost }));
		}
		if (opt.roadsEvery > 0 && m % (opt.roadsEvery * 12) === 0) for (const o of plan.roadOptions(ctx)) if (o.gain > 0) options.push(plan.withFlows(ctx, { ...o, worth: o.gain, cost2: o.cost }));

		// markets: settled prices, our sensitivity, what is under construction. Future building (what cheaper construction
		// goods save on): the pace of spending since the first decision (which spends the starting treasury), with
		// --build-share of the surplus as a three-year prior; shared among markets and goods as spent so far (or as the
		// options on the table would spend it, the first time). Spain spends about a third of its surplus: options that pay
		// back within --max-payback run out before the gold does.
		const M = plan.markets(ctx);
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
		if (!book.first) book.first = { month: m, spent: book.invested };
	}
	function schedule(o, m) {
		const days = o.kind === 'road' ? 180 : (typeof o.bt === 'number' ? o.bt : DB.values[o.bt] ?? 365);
		const done = m + Math.max(1, Math.round(days / 30.4));
		// it buys its construction goods every month until it is done
		const goods = ((o.demandKey && DB.demands[o.demandKey]) || {}).goods;
		if (goods && Object.keys(goods).length) state.constructions.push({ market: o.mk, goods, months: done - m });
		if (o.kind === 'building') queue.push({ done, site: o.site, mk: o.mk, flow: o.flowOwn, apply: () => {
			const L = o.site.L, b = L.buildings.find(x => x.type === o.type && !x.foreign);
			if (b) b.level += 1; else L.buildings.push({ type: o.type, level: 1, employed: 0, ...(o.methods ? { methods: o.methods } : {}) });
			book.built.building++; book.types[o.type] = (book.types[o.type] || 0) + 1;
		} });
		else if (o.kind === 'rank') queue.push({ done, site: o.site, mk: o.mk, flow: o.flowOwn, apply: () => {
			const L = o.site.L;
			// the new rank's extra desired pops become promotion targets
			for (const [type, n] of Object.entries(plan.rankDesiredDelta(L.rank, o.rank))) (o.site.desired ??= {})[type] = (o.site.desired[type] || 0) + n;
			L.rank = o.rank;
			// the RGO shrinks to its new maximum (a town loses the rural +100%)
			const r = E.evaluate(o.site.scn, { L, C: state.C, obs: null });
			if (L.rgoWorkers !== undefined) L.rgoWorkers = Math.min(L.rgoWorkers, Math.floor(E.maxRgo(L, r.M) + 1e-9));
			rankChanged.add(o.site);
			book.built.rank++;
		} });
		else if (o.kind === 'road') queue.push({ done, site: null, apply: () => {
			state.roadIndex.set(o.a + ',' + o.b, o.road); state.roadIndex.set(o.b + ',' + o.a, o.road);
			for (const id of [o.a, o.b]) { const s = siteOf.get(id); if (s) s.L.road = true; }
			book.built.road++;
		} });
	}
	// ---- idle peasants promote into open jobs of the other types (and a new rank's extra desired pops), a share of the
	// open places a month
	function promote(results) {
		if (!(opt.promotion > 0)) return;
		for (const [site, r] of results) {
			const L = site.L, J = r.J;
			let idle = Math.max(0, (J.unemployed || {}).peasants || 0);
			if (idle <= 1e-6) continue;
			for (const type of ['burghers', 'laborers', 'soldiers', 'clergy', 'nobles']) {
				const open = (J.jobs[type] || 0) + ((site.desired || {})[type] || 0) - (J.pops[type] || 0);
				if (open <= 1e-6 || idle <= 1e-6) continue;
				let n = Math.min(open * opt.promotion, idle);
				idle -= n;
				// from the biggest peasant pops of an accepted culture, into the same culture and religion of the new type
				const peasants = L.pops.filter(p => p.type === 'peasants' && ['Primary', 'Accepted', 'Tolerated'].includes(p.status) && p.size > 0).sort((a, b) => b.size - a.size);
				for (const p of peasants) {
					if (n <= 1e-9) break;
					const take = Math.min(n, p.size);
					p.size -= take; n -= take;
					const into = L.pops.find(q => q.type === type && q.culture === p.culture && q.religion === p.religion && q.status === p.status);
					if (into) into.size += take;
					else L.pops.push({ type, size: take, culture: p.culture, religion: p.religion, status: p.status, satisfaction: p.satisfaction, literacy: p.literacy, estate: (DB.pops[type] || {}).estate || 'peasants_estate' });
				}
			}
			L.pops = L.pops.filter(p => p.size > 1e-9);
			L.population = L.pops.reduce((a, p) => a + p.size, 0);
		}
	}
}

// ---- runs and report: several runs go to worker threads, one each (--serial runs them one after another)
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const variants = [['baseline', parseMods(all('--mod').join(','))]];
if (args.includes('--idle')) variants.push(['no investment', parseMods(all('--mod').join(',')), false]);
for (const v of after('--compare')) variants.push([v, [...parseMods(all('--mod').join(',')), ...parseMods(v)]]);
const mostBuilt = r => Object.entries(r.book.types).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${nm(k)} ${n}`).join(', ');
const summary = r => ({ label: r.label, years: r.years, book: { crownTotal: r.book.crownTotal, netTotal: r.book.netTotal, invested: r.book.invested, types: r.book.types, built: r.book.built } });
const runOne = ([label, v, invest]) => summary(run(v, label, invest !== false));
if (!isMainThread) parentPort.postMessage(runOne(variants[workerData.i]));
else report();

async function report() {
	const t0 = Date.now();
	const parallel = variants.length > 1 && !args.includes('--serial');
	const go = (x, i) => (parallel ? new Promise((res, rej) => {
		const w = new Worker(__filename, { argv: process.argv.slice(2), workerData: { i } });
		w.on('message', res); w.on('error', rej);
	}) : Promise.resolve(runOne(x)));
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
	const marks = [...new Set([5, 10, 20, opt.years].filter(y => y <= opt.years))];
	const head = ['run'.padEnd(34), ...marks.map(y => `crown tax y${y}`.padStart(15)), 'crown tax total'.padStart(17), `surplus y${opt.years}`.padStart(12), `eco base y${opt.years}`.padStart(13), 'invested'.padStart(10), 'treasury'.padStart(10), 'pop'.padStart(12), 'burghers'.padStart(10), 'towns'.padStart(6), 'manpower/mo'.padStart(12)];
	console.log(head.join(' '));
	const base = runs[0];
	for (const r of runs) {
		const end = at(r, opt.years);
		const d = (x, b) => (r === base ? '' : ` (${x >= b ? '+' : '−'}${num(Math.abs(100 * (x / b - 1)), 1)}%)`);
		console.log([r.label.slice(0, 34).padEnd(34), ...marks.map(y => num(at(r, y).crown).padStart(15)), (num(r.book.crownTotal) + d(r.book.crownTotal, base.book.crownTotal)).padStart(17),
			num(end.net).padStart(12), num(end.eco).padStart(13), num(r.book.invested).padStart(10), num(end.treasury).padStart(10), num(end.population * 1000).padStart(12), num(end.burghers * 1000).padStart(10), String(end.towns).padStart(6), num(end.manpower * 1000).padStart(12)].join(' '));
	}
	for (const r of runs) if (Object.keys(r.book.types).length) console.log(`  ${r.label}: most built ${mostBuilt(r)}`);
	console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}
