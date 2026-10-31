// Country report for sim.js: a country scenario (from_save.js --country TAG) month by month.
//   node .tools/scripts/location_sim/sim.js <country scenario.json> [--months 120] [--markets fixed|closed|off] [--food on|off] [--top 12]
//        [--add <location key>:<building type>[:level]]...   what-if: build something first (e.g. lisbon:local_governor)
const CS = require('./country.js');
const E = require('./engine.js');

module.exports = (scn, flag) => {
	const DB = E.DB;
	const nm = k => DB.names[k] || k;
	const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
	const men = x => num(x * 1000);
	const months = +(flag('--months', 120) === true ? 120 : flag('--months', 120));
	const mode = flag('--markets', (scn.options || {}).markets || 'fixed');
	const foodMode = flag('--food', (scn.options || {}).food || 'on');
	// --add location:building[:level], repeatable: the building starts fully staffed
	const argv = process.argv.slice(2), added = [];
	argv.forEach((a, i) => { if (a !== '--add') return; const [key, type, lvl] = String(argv[i + 1] || '').split(':'); const loc = scn.locations.find(l => l.key === key); if (!loc || !DB.buildings[type]) throw new Error('--add ' + argv[i + 1] + ': unknown location or building'); const level = +(lvl || 1), size = E.employmentSize(type, E.locationState({ location: loc })); loc.buildings.push({ type, level, employed: level * size }); added.push(nm(type) + ' in ' + nm(key)); });
	const { timeline, state } = CS.project({ ...scn, options: { ...(scn.options || {}), markets: mode, food: foodMode } }, months);
	const t0 = timeline[0], tN = timeline[timeline.length - 1];
	const capital = scn.locations.find(l => l.id === scn.capital);
	if (added.length) console.log('What-if: ' + added.join(', '));
	console.log(`${scn.name}: ${scn.locations.length} locations, capital ${capital ? nm(capital.key) : '?'}; markets ${mode}; proximity ${state.proxMode}` +
		(mode === 'fixed' ? ' (trade with other markets held at the save)' : mode === 'closed' ? ' (no trade with other markets)' : ' (prices frozen)'));
	console.log(`  population ${men(t0.population)}; control ${(100 * t0.control).toFixed(1)}% (wealth-weighted)`);
	console.log(`  manpower ${men(t0.manpower)} a month, max ${men(t0.maxManpower)}; army upkeep held at ${men(state.manpowerExpense)} a month; sailors ${men(t0.sailors)} a month`);
	console.log(`  army levies ${men(t0.armyLevies)} men; wealth ${num(t0.wealth, 1)}, tax base ${num(t0.taxBase, 1)}, crown tax ${num(t0.crownTax, 1)}, building upkeep ${num(t0.upkeep, 1)} gold a month`);
	if (foodMode !== 'off') console.log(`  food ${num(t0.foodProduction)} produced and ${num(t0.foodConsumption)} eaten a month; ${num(t0.foodStored)} stored of ${num(t0.foodCapacity)} in ${Object.keys(state.provinces).length} provinces`);
	else console.log("  food not simulated (--food off): growth keeps the save's food terms");
	const o = scn.country.observed || {};
	if (o.taxIncome !== undefined) console.log(`  save: tax income ${num(o.taxIncome, 1)}, manpower ${men(o.manpowerIncome)} a month, max ${men(o.maxManpower)}, pool ${men(o.manpower)}`);

	console.log(`\nProjection, ${months} months (development and prosperity held constant; pop demand fixed at the save with its price elasticity)`);
	console.log('  year   population  births/mo  manpower/mo  manpower pool  levies    wealth  crown tax  upkeep  control  food stored  starving');
	for (const p of timeline.filter(x => x.month % 12 === 0 || x.month === months))
		console.log(`  ${String(p.month / 12).padStart(4)}  ${men(p.population).padStart(11)}  ${men(p.births).padStart(9)}  ${men(p.manpower).padStart(11)}  ${men(p.manpowerPool).padStart(13)}  ${men(p.armyLevies).padStart(7)}  ${num(p.wealth, 1).padStart(8)}  ${num(p.crownTax, 1).padStart(9)}  ${num(p.upkeep, 1).padStart(6)}  ${(100 * p.control).toFixed(1).padStart(6)}%  ${foodMode === 'off' ? '         -' : (100 * p.foodStored / p.foodCapacity).toFixed(0).padStart(10) + '%'}  ${String(foodMode === 'off' ? '-' : p.starving).padStart(8)}`);

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
