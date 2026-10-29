// Command-line location simulator.
//   node .tools/scripts/location_sim/sim.js <scenario.json> [--months 120] [--json]
//        [--modifier <key>]     one modifier taken apart by source (local + the owner's global counterpart)
//        [--modifiers]          every modifier of the location with its total
//        [--buildings]          every building with its level, cap and staffing
// Scenario format: "EU5 Location Mechanics (1.4.4).md" in the repo root; from_save.js builds one from a save.
// Pops, men and manpower are thousands in the engine; this prints people.
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const DB = E.DB;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const file = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
if (!file) { console.error('usage: node sim.js <scenario.json> [--months N] [--modifier key] [--modifiers] [--buildings] [--json]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const r = E.evaluate(scn);
const { L, M } = r;
const nm = k => DB.names[k] || k;
const num = (x, d = 2) => (x === undefined || x === null || Number.isNaN(x)) ? '-' : (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const men = x => num(x * 1000, 0);
const pct = (x, d = 1) => (x >= 0 ? '+' : '') + (100 * x).toFixed(d) + '%';
const fmtMod = (k, x) => { const t = DB.modifierTypes[k]; return t && t[0] === 1 ? pct(x) : (x >= 0 ? '+' : '') + num(x, 4); };

if (flag('--json')) { const { L: l, C, M: m, J, ...rest } = r; console.log(JSON.stringify(rest, null, 1)); process.exit(0); }
if (flag('--modifier')) {
	const k = flag('--modifier');
	console.log(`${nm('m:' + k)} (${k}) = ${fmtMod(k, M.get(k))}`);
	for (const [s, x] of M.why(k)) console.log(`  ${typeof x === 'number' ? fmtMod(k, x).padStart(10) : String(x).padStart(10)}  ${s}`);
	process.exit(0);
}
if (flag('--modifiers')) {
	const keys = new Set([...Object.keys(M.local.v), ...Object.keys(M.country.v).map(k => k.startsWith('global_') && DB.modifierTypes['local_' + k.slice(7)] ? 'local_' + k.slice(7) : k)]);
	for (const k of [...keys].sort()) { const x = M.get(k); if (x) console.log(`  ${k.padEnd(48)} ${fmtMod(k, x)}`); }
	process.exit(0);
}

// ---- location
console.log(`${scn.name || path.basename(file)}`);
console.log(`  ${nm(L.key)}: ${nm(L.rank)}, ${nm(L.topography)} / ${nm(L.vegetation) || '-'} / ${nm(L.climate)}, raw material ${nm(L.rawMaterial)}` +
	`${L.river ? `, river size ${L.river}` : ''}${L.coastal ? ', coastal' : ''}${L.port ? ', port' : ''}${L.capital ? ', capital' : ''}${L.marketCenter ? ', market center' : ''}; age ${L.age}, ${L.year}`);
console.log(`  development ${num(L.development, 1)}, prosperity ${pct(L.prosperity)}, proximity ${num(L.proximity, 0)}, ${L.integration}, market access ${(100 * L.marketAccess).toFixed(0)}%`);

// ---- population
const byType = {};
for (const p of L.pops) byType[p.type] = (byType[p.type] || 0) + p.size;
console.log(`\nPopulation ${men(L.population)} of capacity ${men(r.capacity)} (${(100 * L.population / r.capacity).toFixed(0)}%)`);
console.log('  ' + Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, x]) => `${nm(t)} ${men(x)}`).join(', '));
const g = r.growth;
console.log(`  growth ${pct(g.yearly, 3)} a year = ${men(g.pool)} people a month (modifiers ${pct(g.local + g.global, 3)}, food ${pct(g.foodTerms, 3)})`);
console.log('  born this month: ' + Object.entries(g.births).map(([t, x]) => `${nm(t)} ${num(x * 1000, 1)}`).join(', '));
const J = r.J;
console.log('  jobs filled: ' + Object.entries(J.jobs).filter(([, n]) => n > 0).map(([t, n]) => `${nm(t)} ${men(J.employed[t] || 0)}/${men(n)}`).join(', ') +
	(J.unemployed.peasants ? `; ${men(J.unemployed.peasants)} peasants without a job (subsistence farming)` : ''));

// ---- military
const mp = r.manpower, sl = r.sailors;
console.log(`\nManpower ${men(mp.monthly)} a month to the country (max manpower +${men(mp.max)})`);
console.log(`  = buildings ${men(mp.flat)} x (1 ${pct(mp.localMod)} local) x control ${(100 * mp.control).toFixed(0)}% (floor 10%) x (1 ${pct(mp.globalMod)} country)`);
if (sl.monthly || sl.flat) console.log(`Sailors ${men(sl.monthly)} a month (max sailors +${men(sl.max)})`);
const lv = r.levies;
console.log(`Levies: ${men(lv.army)} army${lv.navy ? `, ${men(lv.navy)} navy` : ''} (control ${(100 * lv.control).toFixed(0)}%)`);
const groups = {};
for (const row of lv.rows.filter(x => x.kind === 'army')) {
	const k = `${row.popType}|${row.levy}`;
	const gr = (groups[k] ??= { ...row, men: 0, popSize: 0, wrong: 0 });
	gr.men += row.men; gr.popSize += row.popSize; if (row.culture < 1) gr.wrong += row.popSize;
}
for (const gr of Object.values(groups)) {
	const regs = gr.regimentSize ? gr.men / gr.regimentSize : 0;
	console.log(`  ${nm(gr.popType).padEnd(10)} ${men(gr.popSize).padStart(8)} -> ${nm(gr.unit).padEnd(24)} ${men(gr.men).padStart(7)} men` +
		`${regs ? ` (${num(regs, 1)} regiments of ${men(gr.regimentSize)})` : ''}  size ${(100 * gr.size).toFixed(0)}%, levy size x${gr.mult.toFixed(2)}` +
		`${gr.wrong ? `, ${men(gr.wrong)} of another culture at x${(1 + Math.min(0, r.C.mods.raw('wrong_culture_levy_size'))).toFixed(2)}` : ''}${gr.satisfied ? '' : ', ESTATE BELOW 25% SATISFACTION: none'}`);
}

// ---- economy
const rg = r.rgo;
console.log(`\nRGO: ${nm(rg.good)} ${num(rg.workers * 1000, 0)} workers of ${num((rg.size || 0) * 1000, 0)}, output ${num(rg.output, 2)} x price ${num(rg.price, 3)} x access ${(100 * L.marketAccess).toFixed(0)}% = ${num(rg.profit, 2)} gold` +
	`${rg.food ? `, food ${num(rg.food, 1)}` : ''} (output ${pct(rg.outMod)})`);
const prod = r.buildings.rows.filter(b => b.profit !== undefined && !b.foreign).sort((a, b) => b.profit - a.profit);
if (prod.length) {
	console.log(`Producing buildings: ${num(r.wealth.buildings, 2)} gold`);
	for (const b of prod) console.log(`  ${nm(b.type).padEnd(28)} ${String(b.level).padStart(3)} ${nm(b.produces).padEnd(12)} ${num(b.output, 2).padStart(7)} made, profit ${num(b.profit, 2).padStart(7)}` +
		`${b.employment < 1 ? `  staffed ${(100 * b.employment).toFixed(0)}%` : ''}${b.savedProfit !== undefined ? `  (save ${num(b.savedProfit, 2)})` : ''}`);
}
console.log(`Building upkeep ${num(r.upkeep, 2)} gold a month (multiplier ${r.buildings.upkeepMult.toFixed(3)})`);
const t = r.tax;
console.log(`\nWealth ${num(r.wealth.total, 2)} gold a month; tax base ${num(t.base, 2)} at control ${(100 * L.control).toFixed(0)}%; crown takes ${num(t.crown, 2)} (tax efficiency x${t.efficiency.toFixed(3)})`);
console.log(`  peasant enfranchisement ${(100 * t.enfranchisement).toFixed(1)}% (the nobles take the rest of the peasants' share)`);
console.log('  estate            share   wealth  tax base   rate    crown');
for (const [e, x] of Object.entries(t.estates)) console.log(`  ${nm(e).padEnd(16)} ${(100 * x.share).toFixed(1).padStart(5)}%  ${num(x.possible, 2).padStart(7)}  ${num(x.base, 2).padStart(8)}  ${(100 * x.rate).toFixed(1).padStart(5)}%  ${num(x.crown, 2).padStart(7)}`);
const c = r.control;
console.log(`\nControl ${(100 * L.control).toFixed(1)}%, max ${(100 * c.max).toFixed(1)}% (${c.urban ? 'urban' : 'rural'}), ${c.delta >= 0 ? '+' : ''}${(100 * c.delta).toFixed(2)} points a month`);

// ---- the save's own numbers
const o = scn.observed;
if (o && o.possibleTax !== undefined) {
	console.log(`\nSave: wealth ${num(o.possibleTax, 2)}, tax base ${num(o.tax, 2)}; estates ` + Object.entries(o.estatePossibleTax || {}).map(([e, x]) => `${nm(e)} ${num(x, 2)}`).join(', '));
	const rep = Object.entries(o.popStats || {}).map(([tp, s]) => [tp, (s.changes || {}).Reproduction || 0]);
	console.log('  born last month: ' + rep.map(([tp, x]) => `${nm(tp)} ${num(x * 1000, 1)}`).join(', '));
}

// ---- buildings and caps
if (flag('--buildings')) {
	console.log('\nBuildings (level / cap, staffing)');
	for (const b of [...L.buildings].sort((a, b) => (a.foreign ? 1 : 0) - (b.foreign ? 1 : 0) || b.level - a.level)) {
		const cap = E.maxLevel(b.type, L, M), cv = typeof cap === 'object' ? cap.value : cap;
		console.log(`  ${nm(b.type).padEnd(32)} ${String(b.level).padStart(3)} / ${String(Number.isNaN(cv) ? '?' : cv).padEnd(4)} staffed ${(100 * (J.E.get(b) ?? 1)).toFixed(0)}%${b.foreign ? ' foreign' : ''}`);
	}
}

// ---- projection
if (flag('--months')) {
	const months = +flag('--months');
	const tl = E.project(scn, months);
	console.log(`\nProjection, ${months} months (development, prosperity, prices and food held constant)`);
	console.log('  year   population  capacity  growth/yr  control  manpower/mo  levies   wealth  crown tax');
	for (const p of tl.filter(x => x.month % 12 === 0 || x.month === months))
		console.log(`  ${String(p.month / 12).padStart(4)}  ${men(p.population).padStart(10)}  ${men(p.capacity).padStart(8)}  ${pct(p.growth, 3).padStart(9)}  ${(100 * p.control).toFixed(1).padStart(6)}%  ${men(p.manpower).padStart(11)}  ${men(p.levies).padStart(6)}  ${num(p.wealth, 1).padStart(7)}  ${num(p.crownTax, 1).padStart(9)}`);
}
