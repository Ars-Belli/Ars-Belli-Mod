// node .tools/scripts/battle_sim/analysis/cav_transition.js [battles, default 2000]
// Can a cavalry-heavy country keep fielding cavalry after the infantry switch? Pure heavy cavalry vs pure heavy infantry of
// the same age, with cavalry power bonuses, at frontage 10. Both generals 60/59/61 (average commanding general in Europe, 1547 save).
// Views: equal regiments (30 vs 30); equal manpower upkeep (cavalry 0.04 x men a month, infantry 0.02 x men: cavalry gets
// more regiments); equal recruitment manpower (regiments cost their men; the pool limits the first army).
const pool = require('../pool.js')();
const S = require('../engine.js');
const N = +process.argv[2] || 2000;
const GEN = { adm: 60, dip: 59, mil: 61 };
const size = (c, age) => S.AGE[c][age - 1][1];
const army = (c, age, n, bonus = 0) => ({ name: c, general: GEN, country: bonus ? { power: { [c]: bonus } } : {}, units: [{ type: `generic:${c}:${age}`, count: n }] });
const pct = x => (100 * x).toFixed(0) + '%';
(async () => {
	for (const age of [4, 5, 6]) {
		const upkeep = { hc: 0.04 * size('hc', age), hi: 0.02 * size('hi', age) };
		const views = {
			'equal regiments': 30,
			'equal manpower upkeep': Math.round(30 * upkeep.hi / upkeep.hc),
			'equal recruitment pool': Math.round(30 * size('hi', age) / size('hc', age)),
		};
		console.log(`\n=== age ${age}: cavalry ${Math.round(size('hc', age) * 1000)} men a regiment, infantry ${Math.round(size('hi', age) * 1000)}; 30 infantry regiments vs N cavalry`);
		console.log('  view                       cavalry  ' + [0, 0.1, 0.2, 0.3, 0.5].map(b => `+${Math.round(b * 100)}% cav power`.padStart(19)).join(''));
		for (const [vname, nCav] of Object.entries(views)) {
			const cells = await Promise.all([0, 0.1, 0.2, 0.3, 0.5].map(async b => {
				const [m1, m2] = await Promise.all([
					pool.mc({ location: { frontage: 10 }, attacker: { armies: [army('hc', age, nCav, b)] }, defender: { armies: [army('hi', age, 30)] } }, N / 2, { seed: 4 }),
					pool.mc({ location: { frontage: 10 }, attacker: { armies: [army('hi', age, 30)] }, defender: { armies: [army('hc', age, nCav, b)] } }, N / 2, { seed: 4 }),
				]);
				const w = m1.wins[0] + m1.draws / 2 + m2.wins[1] + m2.draws / 2, ci = S.wilson(w, N);
				const own = (m1.losses[0] + m2.losses[1]) / 2, enemy = (m1.losses[1] + m2.losses[0]) / 2;
				return `${pct(w / N)} ±${Math.round(50 * (ci[1] - ci[0]))} (${(enemy / own).toFixed(1)}x)`.padStart(19);
			}));
			console.log(`  ${vname.padEnd(26)} ${String(nCav).padStart(4)}     ${cells.join('')}`);
		}
	}
	console.log('\ncells: cavalry win rate ±95% margin (infantry men lost per cavalry man lost)');
	await pool.close();
})();
