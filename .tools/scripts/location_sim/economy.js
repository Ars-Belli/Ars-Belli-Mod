// Economy simulator: a country month by month for decades, spending its surplus gold the way a player would, to compare
// the long-run effect of modifiers (+20% building efficiency, +20% urban building efficiency, +3% tax efficiency...).
//   node .tools/scripts/location_sim/economy.js <country scenario.json> [--years 30] [--decide 12] [--reserve 6]
//        [--promotion 0.05] [--max-payback 40] [--roads-every 5]
//        [--mod key=+x]...                         change a country modifier for the run (repeatable)
//        [--compare "key=+x" "key2=+y,key3=-z"...] a baseline run and one run per variant, side by side
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
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node economy.js <country scenario.json> [--years 30] [--mod key=+x] [--compare "key=+x" ...]'); process.exit(1); }
const scn0 = JSON.parse(fs.readFileSync(file, 'utf8'));
const opt = {
	years: +flag('--years', 30), decide: +flag('--decide', 12), reserve: +flag('--reserve', 6), promotion: +flag('--promotion', 0.05),
	maxPayback: +flag('--max-payback', 40), roadsEvery: +flag('--roads-every', 5), quiet: args.includes('--quiet'),
};
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const nm = k => DB.names[k] || k;

// "key=+0.2,key2=-0.1" -> [[key, 0.2], [key2, -0.1]]
const parseMods = s => String(s || '').split(',').filter(Boolean).map(x => { const [k, v] = x.split('='); return [k.trim(), parseFloat(v)]; });

function run(variant, label) {
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
	const book = { treasury: obs.treasury || 0, invested: 0, crownTotal: 0, netTotal: 0, built: { building: 0, rank: 0, road: 0 } };
	const queue = [];
	const years = [];
	const months = opt.years * 12;
	let yearStats = null;
	const siteOf = new Map(state.sites.map(s => [s.loc.id, s]));
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
		if (m % opt.decide === 0) decide(m, results);
		// the month: manpower, pops, control, development, staffing; promotion; proximity, food, markets
		state.manpowerPool = Math.max(0, Math.min(t.maxManpower, state.manpowerPool + t.manpower - state.manpowerExpense));
		for (const [site, r] of results) E.advance(site.L, r);
		promote(results);
		if (state.proxMode === 'computed') CS.proximity(state, results);
		if (state.food) CS.stepFood(state, results);
		CS.stepMarkets(state, results);
	}
	return { label, variant, years, book };

	// ---- spend the treasury above the reserve on the best options by gain per gold
	function decide(m, results) {
		const reserve = opt.reserve * (fixed + [...results.values()].reduce((a, r) => a + r.upkeep, 0));
		let budget = book.treasury - reserve;
		if (budget < 100) return;
		const ctx = plan.context(scn, { state, results });
		const options = [];
		const cache = new Map();
		for (const site of state.sites) {
			if (queue.some(q => q.site === site && q.done > m)) continue; // one project at a time per location
			for (const o of plan.buildingOptions(ctx, site, { staffing: 'promotion' })) if (o.gain > 0) options.push({ ...o, score: o.gain / o.cost });
			const u = plan.urbanOption(ctx, site, cache);
			if (u && u.verdict === 'food-safe' && u.value > 0) options.push({ ...u, score: u.value / u.valueCost });
		}
		if (opt.roadsEvery > 0 && m % (opt.roadsEvery * 12) === 0) for (const o of plan.roadOptions(ctx)) if (o.gain > 0) options.push({ ...o, score: o.gain / o.cost });
		options.sort((a, b) => b.score - a.score);
		const used = new Set();
		for (const o of options) {
			if (budget < 50) break;
			// payback in years (gain is a month's)
			if (o.cost / Math.max(1e-9, o.kind === 'rank' ? o.value : o.gain) / 12 > opt.maxPayback) continue;
			const key = o.kind === 'road' ? `road ${o.a}` : o.site.loc.id;
			if (used.has(key) || (o.kind === 'road' && (used.has(o.a) || used.has(o.b)))) continue;
			if (o.cost > budget) continue;
			used.add(key); if (o.kind === 'road') { used.add(o.a); used.add(o.b); }
			budget -= o.cost; book.treasury -= o.cost; book.invested += o.cost;
			schedule(o, m);
		}
	}
	function schedule(o, m) {
		const days = o.kind === 'road' ? 180 : (typeof o.bt === 'number' ? o.bt : DB.values[o.bt] ?? 365);
		const done = m + Math.max(1, Math.round(days / 30.4));
		if (o.kind === 'building') queue.push({ done, site: o.site, apply: () => {
			const L = o.site.L, b = L.buildings.find(x => x.type === o.type && !x.foreign);
			if (b) b.level += 1; else L.buildings.push({ type: o.type, level: 1, employed: 0, ...(o.methods ? { methods: o.methods } : {}) });
			book.built.building++;
		} });
		else if (o.kind === 'rank') queue.push({ done, site: o.site, apply: () => {
			const L = o.site.L;
			L.rank = o.rank;
			// the RGO shrinks to its new maximum (a town loses the rural +100%)
			const r = E.evaluate(o.site.scn, { L, C: state.C, obs: null });
			if (L.rgoWorkers !== undefined) L.rgoWorkers = Math.min(L.rgoWorkers, Math.floor(E.maxRgo(L, r.M) + 1e-9));
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
for (const v of all('--compare')) variants.push([v, [...parseMods(all('--mod').join(',')), ...parseMods(v)]]);
const t0 = Date.now();
const runs = variants.map(([label, v]) => { const r = run(v, label); if (!opt.quiet) console.log(`  [${label}] done (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`); return r; });

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
console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
