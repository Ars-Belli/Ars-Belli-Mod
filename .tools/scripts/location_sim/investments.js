// What to build for the most crown tax per ducat. Every building level a location can take, every road the country can
// build or upgrade, and every rank upgrade, priced in gold and scored by what it adds to the country's crown tax a month
// minus the upkeep it adds, once control has settled at its maximum (a new level hires idle pops of its type only unless
// --staffing promotion, where open jobs fill from idle peasants over time), plus its market effects (planner.marketValue):
// its output and inputs at the prices they settle at once it is built, what those price moves do to the country's other
// locations, and what cheaper construction goods save on future building (--build-rate gold a month, by default a third
// of the save's monthly balance: what Spain's economy simulation spends). Each option is valued alone: two Cannon Makers
// in one market lower each other's price.
//   node .tools/scripts/location_sim/investments.js <country scenario.json> [--top 100] [--kinds buildings,roads,ranks]
//        [--location key]   only that location's buildings and rank (roads stay country-wide)
//        [--per-kind 10]    also the best of each kind      [--csv file.csv]   every option that pays back, ranked
//        [--staffing idle|promotion]  [--build-rate 1500]  [--static]   rank by today's prices only
// Prices (planner.js): base x (1 + inflation) x (1 + market price impact of the construction goods) x (1 + cost
// modifiers); a building's base is the age's build price, a road's its price per unit distance x the segment length
// (fitted on 838 roads under construction, +-12%). Rank upgrades are scored in urbanise.js's long-sighted terms elsewhere.
// Not counted: development growth (roads, rank), market access gains from roads.
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
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node investments.js <country scenario.json> [--top 100] [--kinds buildings,roads,ranks] [--location key] [--csv file]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const kinds = new Set(String(flag('--kinds', 'buildings,roads,ranks')).split(','));
const onlyLoc = flag('--location');
const staffing = flag('--staffing', 'idle');
const nm = k => DB.names[k] || k;
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d);
const t0 = Date.now();
const ctx = plan.context(scn);

// the country's monthly balance: crown tax and building upkeep as simulated, everything else as the save has it
const obs = scn.country.observed || {};
const tot = CS.totals(ctx.state, ctx.results);
const fixed = Object.entries(obs.maintenance || {}).filter(([k]) => k !== 'UpkeepMaintenance').reduce((a, [, v]) => a + v, 0);
const balance = tot.crownTax + (obs.goldIncome || 0) - (obs.taxIncome || 0) - fixed - tot.upkeep;
const buildRate = +flag('--build-rate', Math.max(0, balance) / 3);
const rows = [];
const sites = ctx.state.sites.filter(s => !onlyLoc || s.loc.key === onlyLoc);
if (kinds.has('buildings')) for (const site of sites) for (const o of plan.buildingOptions(ctx, site, { staffing })) {
	rows.push({ ...o, what: `${nm(o.type)}${o.level ? ` ${o.level} -> ${o.level + 1}` : ''}`,
		note: (DB.buildings[o.type].pop && o.size && o.hire < o.size ? `${num(100 * o.hire / o.size)}% staffed from idle ${staffing === 'promotion' ? 'pops' : DB.buildings[o.type].pop}` : '') + (o.unchecked ? ' (some conditions unchecked)' : '') });
}
if (kinds.has('ranks')) for (const site of sites) { const o = plan.rankOption(ctx, site); if (o) rows.push({ ...o, what: `${nm(o.from)} -> ${nm(o.rank)}`, note: '' }); }
if (kinds.has('roads')) {
	const roadName = k => (DB.names[k] || k.replace(/_/g, ' ')).replace(/^./, c => c.toUpperCase());
	for (const o of plan.roadOptions(ctx)) rows.push({ ...o, what: `${roadName(o.road)}${o.from ? ` (now ${roadName(o.from).toLowerCase()})` : ''}`,
		where: `${nm(DB.locations[o.a - 1][0])} – ${nm(DB.locations[o.b - 1][0])}`, note: 'cost +-12%' });
}

// ---- market effects: every option valued alone against today's markets; future building spread like the options are
const M = plan.markets(ctx);
for (const r of rows) plan.withFlows(ctx, r);
plan.setFuture(M, rows.filter(r => r.gain > 0 && r.cost > 0).map(r => ({ mk: r.mk, cost: r.cost, w: plan.constructionWeights(ctx, r) })), buildRate);
for (const r of rows) r.value = args.includes('--static') ? r.gain : plan.marketValue(M, r);

// ---- report
const top = +flag('--top', 100);
const ranked = rows.filter(r => r.value > 0.01 && r.cost > 0).sort((a, b) => b.value / b.cost - a.value / a.cost);
console.log(`${scn.name}: ${rows.length} options checked (${((Date.now() - t0) / 1000).toFixed(0)} s); age ${ctx.age} prices, inflation ${num(100 * ctx.inflation, 1)}%, construction efficiency ${num(100 * ctx.mods('global_build_buildings_efficiency'), 1)}%; staffing ${staffing}`);
console.log(`Gains once control has settled; net = crown tax minus the upkeep it adds, at today's prices; markets = its own goods at the prices they`);
console.log(`settle at, our other locations' change, cheaper construction (future building ${num(buildRate)} gold a month); payback = cost / value.\n`);
console.log('  #   investment                                   where                          cost   crown tax   upkeep     net  markets    value  payback  manpower');
const row = (r, i) => `  ${String(i + 1).padStart(2)}  ${(r.what).slice(0, 44).padEnd(44)} ${nm(r.where).slice(0, 28).padEnd(28)} ${num(r.cost).padStart(6)}  ${signed(r.crown, 2).padStart(9)}  ${signed(-r.upkeep, 2).padStart(7)}  ${signed(r.gain, 2).padStart(6)}  ${signed(r.value - r.gain, 2).padStart(7)}  ${signed(r.value, 2).padStart(7)}  ${(r.value > 0 ? num(r.cost / r.value / 12, 1) + ' y' : '-').padStart(7)}  ${signed(r.manpower * 1000).padStart(8)}${r.note ? '  ' + r.note.trim() : ''}`;
ranked.slice(0, top).forEach((r, i) => console.log(row(r, i)));
const tops = +flag('--per-kind', 10);
for (const k of ['building', 'road', 'rank']) {
	const list = ranked.filter(r => r.kind === k);
	if (tops && list.length && ranked.slice(0, top).filter(r => r.kind === k).length < Math.min(tops, list.length)) { console.log(`\nBest ${k}s:`); list.slice(0, tops).forEach((r, i) => console.log(row(r, i))); }
}
for (const k of ['building', 'road', 'rank']) {
	const of = ranked.filter(r => r.kind === k);
	if (of.length) console.log(`\n${k}s: ${of.length} pay back at all; best ${of[0].what} in ${nm(of[0].where)} (${num(of[0].cost / of[0].value / 12, 1)} years)`);
}
// --csv: every option that pays back, best first (for a spreadsheet)
if (flag('--csv')) {
	const q = x => `"${String(x).replace(/"/g, '""')}"`;
	const lines = ['rank,kind,investment,where,cost,crown_tax_month,upkeep_month,net_month,markets_month,value_month,payback_years,manpower_month,note'];
	ranked.forEach((r, i) => lines.push([i + 1, r.kind, q(r.what), q(nm(r.where)), r.cost.toFixed(1), r.crown.toFixed(3), r.upkeep.toFixed(3), r.gain.toFixed(3), (r.value - r.gain).toFixed(3), r.value.toFixed(3), (r.cost / r.value / 12).toFixed(2), (r.manpower * 1000).toFixed(1), q((r.note || '').trim())].join(',')));
	fs.writeFileSync(flag('--csv'), lines.join('\n') + '\n');
	console.log(`\nwrote ${flag('--csv')} (${ranked.length} options)`);
}
