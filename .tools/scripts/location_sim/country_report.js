// Country report for sim.js: a country scenario (from_save.js --country TAG) month by month.
//   node .tools/scripts/location_sim/sim.js <country scenario.json> [--months 120] [--markets fixed|closed|off] [--top 12]
const CS = require('./country.js');
const E = require('./engine.js');

module.exports = (scn, flag) => {
	const DB = E.DB;
	const nm = k => DB.names[k] || k;
	const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
	const men = x => num(x * 1000);
	const months = +(flag('--months', 120) === true ? 120 : flag('--months', 120));
	const mode = flag('--markets', (scn.options || {}).markets || 'fixed');
	const { timeline, state } = CS.project({ ...scn, options: { ...(scn.options || {}), markets: mode } }, months);
	const t0 = timeline[0], tN = timeline[timeline.length - 1];
	const capital = scn.locations.find(l => l.id === scn.capital);
	console.log(`${scn.name}: ${scn.locations.length} locations, capital ${capital ? nm(capital.key) : '?'}; markets ${mode}` +
		(mode === 'fixed' ? ' (trade with other markets held at the save)' : mode === 'closed' ? ' (no trade with other markets)' : ' (prices frozen)'));
	console.log(`  population ${men(t0.population)}; control ${(100 * t0.control).toFixed(1)}% (wealth-weighted)`);
	console.log(`  manpower ${men(t0.manpower)} a month, max ${men(t0.maxManpower)}; army upkeep held at ${men(state.manpowerExpense)} a month; sailors ${men(t0.sailors)} a month`);
	console.log(`  army levies ${men(t0.armyLevies)} men; wealth ${num(t0.wealth, 1)}, tax base ${num(t0.taxBase, 1)}, crown tax ${num(t0.crownTax, 1)}, building upkeep ${num(t0.upkeep, 1)} gold a month`);
	const o = scn.country.observed || {};
	if (o.taxIncome !== undefined) console.log(`  save: tax income ${num(o.taxIncome, 1)}, manpower ${men(o.manpowerIncome)} a month, max ${men(o.maxManpower)}, pool ${men(o.manpower)}`);

	console.log(`\nProjection, ${months} months (development, prosperity and food held constant; pop demand fixed at the save)`);
	console.log('  year   population  manpower/mo  manpower pool  levies    wealth  crown tax  upkeep  control');
	for (const p of timeline.filter(x => x.month % 12 === 0 || x.month === months))
		console.log(`  ${String(p.month / 12).padStart(4)}  ${men(p.population).padStart(11)}  ${men(p.manpower).padStart(11)}  ${men(p.manpowerPool).padStart(13)}  ${men(p.armyLevies).padStart(7)}  ${num(p.wealth, 1).padStart(8)}  ${num(p.crownTax, 1).padStart(9)}  ${num(p.upkeep, 1).padStart(6)}  ${(100 * p.control).toFixed(1).padStart(6)}%`);

	if (mode !== 'off') {
		const top = +flag('--top', 12);
		console.log(`\nBiggest price changes over ${months} months`);
		for (const [id, mk] of Object.entries(state.markets)) {
			const own = scn.locations.filter(l => String(l.market) === id).length;
			const center = scn.locations.find(l => l.id === (scn.markets[id] || {}).center);
			const moves = Object.keys(mk.goods).map(g => [g, t0.prices[id][g], tN.prices[id][g]]).filter(([, a, b]) => a && b)
				.sort((a, b) => Math.abs(Math.log(b[2] / b[1])) - Math.abs(Math.log(a[2] / a[1]))).slice(0, top);
			console.log(`  market ${id}${center ? ` (${nm(center.key)})` : ''}, ${own} of its locations simulated: ` +
				moves.map(([g, a, b]) => `${nm(g)} ${a.toFixed(2)}->${b.toFixed(2)}`).join(', '));
		}
	}
};
