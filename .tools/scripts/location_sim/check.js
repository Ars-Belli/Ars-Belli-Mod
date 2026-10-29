// Checks the engine against a save: every location of a country scenario (from_save.js --country TAG), simulated vs the
// game's own numbers.
//   node .tools/scripts/location_sim/check.js <country scenario.json> [--worst 15]
// Wealth is checked twice: fully simulated, and with the save's building profits (which isolates RGO, estate split and
// control from the building model).
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node check.js <country scenario.json> [--worst 15]'); process.exit(1); }
const S = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = [];
let manpower = 0, sailors = 0, crown = 0, crownSaved = 0, births = 0, birthsSaved = 0, armyLevies = 0;
for (const loc of S.locations) {
	const scn = { location: loc, country: S.country, market: S.markets[loc.market] || {}, observed: S.observed[loc.id] || {} };
	const r = E.evaluate(scn);
	const o = scn.observed;
	const savedBuildings = r.buildings.rows.filter(b => b.profit !== undefined && !b.foreign).reduce((a, b) => a + (b.savedProfit || 0), 0);
	const wealthSaved = r.rgo.profit + savedBuildings;
	// the same estate split applied to the saved-profit wealth
	const t2 = E.tax(r.L, r.M, r.C, wealthSaved);
	manpower += r.manpower.monthly; sailors += r.sailors.monthly; armyLevies += r.levies.army;
	crown += r.tax.crown; crownSaved += t2.crown;
	births += r.growth.pool;
	birthsSaved += Object.values(o.popStats || {}).reduce((a, s) => a + ((s.changes || {}).Reproduction || 0), 0);
	rows.push({ key: loc.key, control: loc.control, possible: o.possibleTax || 0, sim: r.wealth.total, simSaved: wealthSaved,
		estates: Object.fromEntries(Object.entries(t2.estates).map(([e, x]) => [e, [x.possible, (o.estatePossibleTax || {})[e] || 0]])) });
}
const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
const pct = (a, b) => (b ? (100 * (a / b - 1)).toFixed(1) + '%' : '-');
console.log(`${S.name}: ${rows.length} locations`);
console.log(`Wealth (possible_tax) total: save ${sum(r => r.possible).toFixed(1)}; simulated ${sum(r => r.sim).toFixed(1)} (${pct(sum(r => r.sim), sum(r => r.possible))}); ` +
	`with the save's building profits ${sum(r => r.simSaved).toFixed(1)} (${pct(sum(r => r.simSaved), sum(r => r.possible))}, the rest is burgher trade, not modelled)`);
// estate split accuracy on the saved-profit wealth (shares only: scale each estate by the location's total)
let shareErr = [];
for (const r of rows) {
	const simTot = Object.values(r.estates).reduce((a, [x]) => a + x, 0), obsTot = Object.values(r.estates).reduce((a, [, y]) => a + y, 0);
	if (simTot > 1 && obsTot > 1) for (const [e, [x, y]] of Object.entries(r.estates)) if (y > 0.5) shareErr.push(Math.abs(x / simTot - y / obsTot));
}
shareErr.sort((a, b) => a - b);
console.log(`Estate shares: median error ${(100 * shareErr[shareErr.length >> 1]).toFixed(2)} points, 90th percentile ${(100 * shareErr[Math.floor(shareErr.length * 0.9)]).toFixed(2)} points (${shareErr.length} estate rows)`);
const c = S.country.observed || {};
console.log(`Crown tax income: save ${c.taxIncome?.toFixed(1)}; simulated ${crown.toFixed(1)} (${pct(crown, c.taxIncome)}); with the save's building profits ${crownSaved.toFixed(1)} (${pct(crownSaved, c.taxIncome)})`);
console.log(`Manpower a month: save ${c.manpowerIncome?.toFixed(3)}k; simulated ${manpower.toFixed(3)}k (${pct(manpower, c.manpowerIncome)}); max manpower save ${c.maxManpower?.toFixed(1)}k, simulated ${(60 * manpower).toFixed(1)}k`);
console.log(`Sailors a month: save ${c.sailorsIncome?.toFixed(3)}k; simulated ${sailors.toFixed(3)}k (${pct(sailors, c.sailorsIncome)})`);
console.log(`Births a month (Reproduction): save ${birthsSaved.toFixed(3)}k; simulated ${births.toFixed(3)}k (${pct(births, birthsSaved)})`);
console.log(`Army levies (not in the save): ${(armyLevies * 1000).toFixed(0)} men`);
const worst = +flag('--worst', 15);
if (worst) {
	console.log(`\nBiggest wealth gaps (simulated vs save possible_tax):`);
	for (const r of [...rows].sort((a, b) => Math.abs(b.sim - b.possible) - Math.abs(a.sim - a.possible)).slice(0, worst))
		console.log(`  ${r.key.padEnd(24)} save ${r.possible.toFixed(2).padStart(8)}  sim ${r.sim.toFixed(2).padStart(8)}  with saved buildings ${r.simSaved.toFixed(2).padStart(8)}`);
}

// Proximity: the country search (country.js) against the save's stored values. The game rebuilds them only when something
// marks them dirty, so a save can hold values from an older speed term (Spain June 1547: the Supreme Court's goods access fell
// after the last rebuild); the speed term that reproduces the stored tree is fitted and shown next to the current one.
if (S.roads && S.proximityCache) {
	const CS = require('./country.js');
	const saved = new Map(S.locations.map(l => [l.id, l.proximity]));
	const { state, results } = CS.evaluate(S);
	const G0 = state.C.mods.raw('global_distance_from_capital_speed_propagation');
	const run = G => {
		state.C.mods.v.global_distance_from_capital_speed_propagation = G;
		const P = CS.proximity(state, results);
		const errs = S.locations.map(l => ({ key: l.key, save: saved.get(l.id), sim: P.best.get(l.id) || 0 })).map(r => ({ ...r, err: r.sim - r.save }));
		const abs = errs.map(r => Math.abs(r.err)).sort((a, b) => a - b);
		return { G, errs, median: abs[abs.length >> 1], p90: abs[Math.floor(abs.length * 0.9)], max: abs[abs.length - 1], within1: abs.filter(x => x <= 1).length };
	};
	const show = r => `median error ${r.median.toFixed(3)}, 90th percentile ${r.p90.toFixed(3)}, worst ${r.max.toFixed(2)}, ${r.within1} of ${r.errs.length} within 1 point`;
	const now = run(G0);
	let best = now;
	for (let G = Math.max(0, G0 - 0.3); G <= G0 + 0.15; G += 0.005) { const r = run(G); if (r.median < best.median) best = r; }
	for (let G = Math.max(0, best.G - 0.0025); G <= best.G + 0.0025; G += 0.0001) { const r = run(G); if (r.median < best.median) best = r; }
	run(G0);
	console.log(`Proximity, speed term ${G0.toFixed(4)} (the country's modifiers): ${show(now)}`);
	if (Math.abs(best.G - G0) > 0.002) console.log(`  the save's stored values fit a speed term of ${best.G.toFixed(4)} (computed before a modifier changed): ${show(best)}`);
	if (worst) for (const r of [...best.errs].sort((a, b) => Math.abs(b.err) - Math.abs(a.err)).slice(0, Math.min(worst, 8)))
		console.log(`  ${r.key.padEnd(24)} save ${r.save.toFixed(2).padStart(6)}  sim ${r.sim.toFixed(2).padStart(6)}`);
}
