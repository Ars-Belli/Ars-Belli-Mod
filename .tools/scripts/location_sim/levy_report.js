// A country's whole army levy from a country scenario (from_save.js --country TAG): men and regiments by unit, by culture status and by pop.
//   node .tools/scripts/location_sim/levy_report.js <scenario.json> [--find <location key>] [--json <out.json>]
// "full" is the levy at every location's control with recovery 1. "now" applies the save's recovery per province (the Army Levies Recovery panel), which is what the game's rows show.
// --find prints every row of one location, the way the game's "Army Levies" tooltip lists them. A levy condition this code can't read is listed at the end.
const fs = require('fs');
const path = require('path');
const CS = require('./country.js');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const args = process.argv.slice(2), flag = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const scn = JSON.parse(fs.readFileSync(args.find(a => a.endsWith('.json')), 'utf8'));
const state = CS.create({ ...scn, options: { ...(scn.options || {}), markets: 'off' } });
const units = {}, status = {}, provinces = {};
let total = 0, totalNow = 0;
const rowsAt = {};
for (const site of state.sites) {
	const mk = (scn.markets || {})[site.loc.market];
	if (mk && mk.goods) site.L.marketGoods = Object.entries(mk.goods).filter(([, g]) => Object.keys(g.production || {}).length).map(([k]) => k);
	const r = E.evaluate(site.scn, { L: site.L, C: state.C });
	for (const x of r.levies.rows) {
		if (x.kind !== 'army') continue;
		const u = (units[x.unit] ??= { unit: x.unit, cat: x.cat, men: 0, now: 0, size: x.regimentSize, levy: x.levy });
		const full = x.men / (x.recovery || 1);
		u.men += full; u.now += x.men; total += full; totalNow += x.men;
		const pv = (provinces[site.loc.province] ??= {}), pu = (pv[x.unit] ??= { size: x.regimentSize, men: 0, now: 0 });
		pu.men += full; pu.now += x.men;
		const st = (status[`${x.cultureKey} ${x.popType} (${x.status})`] ??= { men: 0, unit: x.unit });
		st.men += full;
		(rowsAt[site.loc.key] ??= []).push(x);
	}
}
const rows = Object.values(units).sort((a, b) => b.men - a.men).map(u => ({ ...u, regiments: Math.round(u.men / u.size) }));
console.log(`${scn.name}: ${state.sites.length} locations, army levy ${(total * 1000).toFixed(0)} men full, ${(totalNow * 1000).toFixed(0)} now`);
console.log('  unit'.padEnd(36) + 'full'.padStart(9) + 'now'.padStart(9) + 'share'.padStart(8));
for (const u of rows) console.log(`  ${u.unit}`.padEnd(36) + (u.men * 1000).toFixed(0).padStart(9) + (u.now * 1000).toFixed(0).padStart(9) + `${(100 * u.men / total).toFixed(1)}%`.padStart(8));
console.log('  by pop:');
for (const [k, v] of Object.entries(status).sort((a, b) => b[1].men - a[1].men).slice(0, 12)) console.log(`    ${k}`.padEnd(46) + (v.men * 1000).toFixed(0).padStart(8) + `  ${v.unit}`);
if (flag('--find')) for (const q of flag('--find').split(',')) {
	console.log(`  ${q}:`);
	for (const x of (rowsAt[q] || []).sort((a, b) => b.men - a.men)) console.log(`    ${(x.men * 1000).toFixed(0).padStart(6)}  ${x.cultureKey} ${x.popType} ${x.status}, ${x.unit}: ${(x.popSize * 1000).toFixed(0)} pop x ${x.size} x culture ${x.culture} x mult ${x.mult.toFixed(4)} x control ${x.control.toFixed(4)} x recovery ${x.recovery}`);
}
const unknown = E.levyUnknown ? [...E.levyUnknown] : [];
if (unknown.length) console.log('  conditions not modelled (counted false):', unknown.join(' '));
if (flag('--json')) fs.writeFileSync(flag('--json'), JSON.stringify({ name: scn.name, source: scn.source, men: total, now: totalNow, rows, provinces }, null, '\t'));
