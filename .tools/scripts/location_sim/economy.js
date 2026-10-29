// Economy simulator: a country month by month for decades, spending its surplus gold the way a player would, to compare
// the long-run effect of modifiers (+20% building efficiency, +20% urban building efficiency, +3% tax efficiency...).
//   node .tools/scripts/location_sim/economy.js <country scenario.json> [--years 30] [--decide 12] [--reserve 6]
//        [--promotion 0.05] [--max-payback 40] [--roads-every 5] [--full-every 5]
//        [--mod key=+x]...                         change a country modifier for the run (repeatable)
//        [--compare "key=+x" "key2=+y,key3=-z"...] a baseline run and one run per variant, side by side
//        [--idle]                                  also a run that never invests (what investing gains)
//        [--explain 20]                            the first N purchases of every decision, their value in parts
// Books: income = crown tax (simulated) + other income held at the save's (trade, tariffs...); expenses = court, army,
// navy, forts and food held at the save's + building upkeep (simulated). Every --decide months the treasury above
// --reserve months of expenses buys the best options by gain per gold (planner.js: building levels with jobs filled by
// promotion, food-safe urbanisation valued with the buildings it unlocks, roads every --roads-every years), at most one per
// location per decision; each finishes after its build time. Every month idle peasants promote into --promotion of the
// open jobs (the game's formula is not decoded), which shifts market demand toward what burghers, nobles and clergy buy.
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
	years: +flag('--years', 30), decide: +flag('--decide', 12), reserve: +flag('--reserve', 6), promotion: +flag('--promotion', 0.05),
	maxPayback: +flag('--max-payback', 40), roadsEvery: +flag('--roads-every', 5), fullEvery: +flag('--full-every', 5), quiet: args.includes('--quiet'), explain: +flag('--explain', 0),
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
	const fixed = Object.entries(maint).filter(([k]) => k !== 'UpkeepMaintenance').reduce((a, [, v]) => a + v, 0);
	const otherIncome = (obs.goldIncome || 0) - (obs.taxIncome || 0);
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
		const income = t.crownTax + otherIncome, expenses = fixed + t.upkeep;
		book.treasury += income - expenses;
		book.crownTotal += t.crownTax; book.netTotal += income - expenses;
		if (m % 12 === 0) {
			const pops = {}; for (const s of state.sites) for (const p of s.L.pops) pops[p.type] = (pops[p.type] || 0) + p.size;
			const devAvg = state.sites.reduce((a, s) => a + s.L.development, 0) / state.sites.length;
			yearStats = { year: m / 12, treasury: book.treasury, crown: t.crownTax, upkeep: t.upkeep, net: income - expenses, population: t.population, burghers: pops.burghers || 0,
				manpower: t.manpower, control: t.control, development: devAvg, invested: book.invested, built: { ...book.built },
				towns: state.sites.filter(s => s.L.rank !== 'rural_settlement').length };
			years.push(yearStats);
			if (!opt.quiet) console.log(`  [${label}] year ${String(m / 12).padStart(2)}: crown tax ${num(t.crownTax, 0)}/mo, net ${num(income - expenses, 0)}/mo, treasury ${num(book.treasury)}, invested ${num(book.invested)}, built ${book.built.building} levels / ${book.built.road} roads / ${book.built.rank} ranks`);
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
			const r0 = ctx.base.get(site).r;
			for (const o of found) if (o.gain > 0) { const fl = plan.flowDelta(o.r, r0); options.push({ ...o, flow: fl, flowOwn: fl, worth: o.gain, cost2: o.cost }); }
			const u = plan.urbanOption(ctx, site, cache);
			if (u && u.verdict === 'food-safe' && u.value > 0) {
				// valued with the buildings it unlocks; only the rise itself joins the market plan
				const own = plan.flowDelta(u.r, r0), fl = plan.addFlow({ dS: {}, dD: {}, sens: {} }, own);
				for (const b of u.best) plan.addFlow(fl, plan.flowDelta(b.r, u.r));
				options.push({ ...u, flow: fl, flowOwn: own, worth: u.value, cost2: u.valueCost });
			}
		}
		if (opt.roadsEvery > 0 && m % (opt.roadsEvery * 12) === 0) for (const o of plan.roadOptions(ctx)) if (o.gain > 0) options.push({ ...o, worth: o.gain, cost2: o.cost });
		for (const o of options) { o.mk = (o.kind === 'road' ? siteOf.get(o.a).loc : o.site.loc).market; o.demandKey = demandKeyOf(o); }

		// markets: our locations' price sensitivity per market and good, and what is planned there (under construction, bought now)
		const view = CS.marketView(state, results);
		const sens = {};
		for (const site of state.sites) { const x = (sens[site.loc.market] ??= {}); for (const [g, v] of Object.entries(plan.priceSensitivity(ctx.base.get(site).r))) x[g] = (x[g] || 0) + v; }
		const planned = {};
		const plannedOf = mk => (planned[mk] ??= { dS: {}, dD: {}, sens: {} });
		for (const q of queue) if (q.done > m && q.flow) plan.addFlow(plannedOf(q.mk), q.flow);
		// future building: the surplus a month, shared among markets and their construction goods as spent so far (or as the
		// options on the table would spend it, the first time)
		const basket = book.bought.length ? book.bought : options.map(o => ({ mk: o.mk, cost: o.cost, w: weightsOf(o) }));
		const spentAll = basket.reduce((a, b) => a + b.cost, 0) || 1, future = {};
		for (const b of basket) { const x = (future[b.mk] ??= {}); for (const [g, w] of Object.entries(b.w)) x[g] = (x[g] || 0) + w * b.cost * Math.max(0, netNow) / spentAll; }

		// an option's value with the market effects (gold a month)
		const value = (o, parts) => {
			if (!o.flow) return o.worth;
			const P = plannedOf(o.mk), S = sens[o.mk] || {}, F = future[o.mk] || {};
			let v = o.worth;
			if (parts) Object.assign(parts, { own: 0, others: 0, building: 0, goods: [] });
			for (const g of new Set([...Object.keys(o.flow.dS), ...Object.keys(o.flow.dD), ...Object.keys(o.flow.sens)])) {
				const p0 = view.price(o.mk, g);
				if (p0 === null) continue;
				const pS = P.dS[g] || 0, pD = P.dD[g] || 0;
				const before = view.settled(o.mk, g, pS, pD), after = view.settled(o.mk, g, pS + (o.flow.dS[g] || 0), pD + (o.flow.dD[g] || 0));
				const own = (o.flow.sens[g] || 0) * (after - p0), others = ((S[g] || 0) + (P.sens[g] || 0)) * (after - before);
				const building = (F[g] || 0) * (plan.goodImpact(g, before) - plan.goodImpact(g, after));
				v += own + others + building;
				if (parts) { parts.own += own; parts.others += others; parts.building += building; parts.goods.push(`${nm(g)} ${num(p0, 2)}→${num(after, 2)}`); }
			}
			return v;
		};
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
			if (o.flowOwn) plan.addFlow(plannedOf(o.mk), o.flowOwn);
			budget -= o.cost; book.treasury -= o.cost; book.invested += o.cost;
			book.bought.push({ mk: o.mk, cost: o.cost, w: weightsOf(o) });
			if (explained < opt.explain) {
				const p = {}; value(o, p); explained++;
				const what = o.kind === 'road' ? `road ${nm(DB.locations[o.a - 1] ? DB.locations[o.a - 1][0] : o.a)}` : `${o.kind === 'rank' ? o.rank : nm(o.type)} in ${nm(o.where)}`;
				console.log(`    month ${m}: ${what.slice(0, 40).padEnd(40)} ${num(o.cost).padStart(6)} gold  gain ${num(o.worth, 2).padStart(6)}  own prices ${num(p.own || 0, 2).padStart(6)}  others ${num(p.others || 0, 2).padStart(6)}  cheaper building ${num(p.building || 0, 2).padStart(6)}  = ${num(v, 2).padStart(6)}/mo  ${(p.goods || []).join(', ')}`);
			}
			schedule(o, m);
		}
	}
	// the construction goods an option buys: its build price = base x (1 + the amount-weighted mean of the goods' price
	// impacts) (planner.marketImpact), so a gold spent saves a/sum(a) / (1 + impact) gold per point a good's impact falls
	function demandKeyOf(o) {
		if (o.kind === 'building') return (DB.buildings[o.type] || {}).demand;
		if (o.kind === 'rank') return (DB.ranks[o.rank] || {}).demand;
		if (o.kind === 'road') return 'build_' + o.road + '_demand';
		return null;
	}
	function weightsOf(o) {
		const d = o.demandKey && DB.demands[o.demandKey], w = {};
		if (!d || !d.goods) return w;
		const L = o.kind === 'road' ? siteOf.get(o.a).L : o.site.L;
		const sumA = Object.entries(d.goods).filter(([g]) => (DB.goods[g] || {}).price).reduce((a, [, x]) => a + x, 0);
		if (!sumA) return w;
		const k = 1 / (1 + plan.marketImpact(o.demandKey, L));
		for (const [g, a] of Object.entries(d.goods)) if ((DB.goods[g] || {}).price) w[g] = k * a / sumA;
		return w;
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
	// ---- idle peasants promote into open jobs of the other types, a share of the open jobs a month
	function promote(results) {
		if (!(opt.promotion > 0)) return;
		for (const [site, r] of results) {
			const L = site.L, J = r.J;
			let idle = Math.max(0, (J.unemployed || {}).peasants || 0);
			if (idle <= 1e-6) continue;
			for (const type of ['burghers', 'laborers', 'soldiers', 'clergy', 'nobles']) {
				const open = (J.jobs[type] || 0) - (J.pops[type] || 0);
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

// ---- runs and report
const variants = [['baseline', parseMods(all('--mod').join(','))]];
if (args.includes('--idle')) variants.push(['no investment', parseMods(all('--mod').join(',')), false]);
for (const v of after('--compare')) variants.push([v, [...parseMods(all('--mod').join(',')), ...parseMods(v)]]);
const t0 = Date.now();
const mostBuilt = r => Object.entries(r.book.types).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${nm(k)} ${n}`).join(', ');
const runs = variants.map(([label, v, invest]) => {
	const r = run(v, label, invest !== false);
	if (!opt.quiet) console.log(`  [${label}] done (${((Date.now() - t0) / 1000).toFixed(0)} s); most built: ${mostBuilt(r)}\n`);
	return r;
});

console.log(`\n${scn0.name}: ${opt.years} years; decisions every ${opt.decide} months, reserve ${opt.reserve} months of expenses, promotion ${100 * opt.promotion}% of open jobs a month`);
const at = (r, y) => r.years.find(x => x.year === y) || r.years[r.years.length - 1];
const marks = [...new Set([5, 10, 20, opt.years].filter(y => y <= opt.years))];
const head = ['run'.padEnd(34), ...marks.map(y => `crown tax y${y}`.padStart(15)), 'crown tax total'.padStart(17), 'net total'.padStart(12), 'invested'.padStart(10), 'pop'.padStart(12), 'burghers'.padStart(10), 'towns'.padStart(6), 'manpower/mo'.padStart(12)];
console.log(head.join(' '));
const base = runs[0];
for (const r of runs) {
	const end = at(r, opt.years);
	const d = (x, b) => (r === base ? '' : ` (${x >= b ? '+' : '−'}${num(Math.abs(100 * (x / b - 1)), 1)}%)`);
	console.log([r.label.slice(0, 34).padEnd(34), ...marks.map(y => num(at(r, y).crown).padStart(15)), (num(r.book.crownTotal) + d(r.book.crownTotal, base.book.crownTotal)).padStart(17),
		num(r.book.netTotal).padStart(12), num(r.book.invested).padStart(10), num(end.population * 1000).padStart(12), num(end.burghers * 1000).padStart(10), String(end.towns).padStart(6), num(end.manpower * 1000).padStart(12)].join(' '));
}
for (const r of runs) if (Object.keys(r.book.types).length) console.log(`  ${r.label}: most built ${mostBuilt(r)}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
