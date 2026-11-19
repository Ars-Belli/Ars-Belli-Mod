// node .tools/scripts/battle_sim/analysis/artillery_count.js [battles, default 1000]
// How much artillery? 30-regiment armies, N guns replacing heavy infantry, vs 30 heavy infantry. Frontage 10 and 7.
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const N = +process.argv[2] || 1000;
const army = (age, guns, total = 30) => ({ name: 'x', formation: 'balanced', country: {}, units: [{ type: `generic:hi:${age}`, count: total - guns }, ...(guns ? [{ type: `generic:art:${age}`, count: guns }] : [])] });
for (const W of [10, 7]) {
	console.log(`\nFrontage ${W}: win rate of the side with N guns (of 30 regiments) vs 30 heavy infantry; bombard losses dealt by day 3`);
	console.log('guns ' + [2, 3, 4, 5, 6].map(a => `age ${a}`.padStart(16)).join(''));
	for (const g of [0, 3, 6, 9, 12, 15, 20, 25, 30]) {
		const row = [];
		for (const age of [2, 3, 4, 5, 6]) {
			const scn = { location: { frontage: W }, attacker: { armies: [army(age, g)] }, defender: { armies: [army(age, 0)] } };
			const m = S.monteCarloScenario(scn, N, { seed: 9 });
			// bombard effect: defender men lost by day 3 in a sample of battles
			let bl = 0; for (let k = 0; k < 60; k++) { const r = S.simulateScenario(scn, { seed: 1000 + k }); bl += r.timeline[0].men[1] - r.timeline[Math.min(3, r.timeline.length - 1)].men[1]; }
			row.push(`${(100 * (m.wins[0] + m.draws / 2) / N).toFixed(0)}% (${Math.round(bl / 60 * 1000)})`.padStart(16));
		}
		console.log(String(g).padStart(4) + row.join(''));
	}
}
