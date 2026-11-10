// node .tools/scripts/battle_sim/analysis/staggered_arrivals.js [unit, default generic:hi:5] [battles, default 2000] [armies, default 3]
// Big battles: side A brings all its armies at once, side B feeds the same armies in one after another. Late armies skip the
// reserve's daily morale drain (0.03 a day for every regiment present from day 4), join as reserves that move to the section
// that needs them, and march in from a neighbouring location (marchDays 3). Frontage 10, generals 60/59/61, both seat orders.
// A battle B's first armies lose before the others arrive counts as lost (the follow-up battle is not simulated).
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const UNIT = process.argv[2] || 'generic:hi:5', N = +process.argv[3] || 2000, K = +process.argv[4] || 3;
const GEN = { adm: 60, dip: 59, mil: 61 };
const army = (n, day = 0, march = 0) => ({ general: GEN, country: {}, units: [{ type: UNIT, count: n }], arrivalDay: day, ...(day ? { marchDays: march } : {}) });
const SCHED = [
	['all at once', Array(K).fill(0)],
	['every 4 days', [...Array(K).keys()].map(k => 4 * k)],
	['every 8 days', [...Array(K).keys()].map(k => 8 * k)],
	['every 12 days', [...Array(K).keys()].map(k => 12 * k)],
	['every 20 days', [...Array(K).keys()].map(k => 20 * k)],
	['first two at once, last day 10', [...Array(K - 1).fill(0), 10]],
];
const pct = x => `${Math.round(100 * x)}%`;
(async () => {
	const t0 = Date.now();
	for (const per of [30, 20]) {
		console.log(`\n=== ${K} armies of ${per} ${UNIT} a side (${K * per} regiments; one section holds 12.5). Side B's schedule vs A all at once`);
		console.log('B schedule                         B wins    A loses per B loss    days    B regiments in reserve at day 4');
		for (const [name, days] of SCHED) {
			const A = days.map(() => army(per)), B = days.map(d => army(per, d, 3));
			const [m1, m2] = await Promise.all([
				pool.mc({ location: { frontage: 10 }, attacker: { armies: A }, defender: { armies: B } }, N, { seed: 5 }),
				pool.mc({ location: { frontage: 10 }, attacker: { armies: B }, defender: { armies: A } }, N, { seed: 5 }),
			]);
			const win = ((m1.wins[1] + m1.draws / 2) + (m2.wins[0] + m2.draws / 2)) / (2 * N);
			const trade = ((m1.losses[0] / m1.losses[1]) + (m2.losses[1] / m2.losses[0])) / 2;
			const inLine = Math.min(per * days.filter(d => d === 0).length, 37.5);
			console.log(`  ${name.padEnd(33)}${pct(win).padStart(6)}${trade.toFixed(2).padStart(16)}${((m1.days + m2.days) / 2).toFixed(1).padStart(12)}${String(Math.max(0, Math.round(per * days.filter(d => d === 0).length - inLine))).padStart(14)}`);
		}
	}
	// hold back: the first two armies already fill the line (60 regiments vs 37.5 slots), the last two come in later
	console.log(`\n=== Hold back: A = 4 armies of 30 at once; B = 2 at once + 2 arriving later (march 1 day). B's win rate`);
	for (const [d1, d2] of [[0, 0], [5, 5], [8, 8], [6, 12], [12, 12], [10, 20], [15, 15]]) {
		const A = [0, 0, 0, 0].map(() => army(30)), B = [army(30), army(30), army(30, d1, 1), army(30, d2, 1)];
		const [m1, m2] = await Promise.all([
			pool.mc({ location: { frontage: 10 }, attacker: { armies: A }, defender: { armies: B } }, N, { seed: 9 }),
			pool.mc({ location: { frontage: 10 }, attacker: { armies: B }, defender: { armies: A } }, N, { seed: 9 }),
		]);
		const win = ((m1.wins[1] + m1.draws / 2) + (m2.wins[0] + m2.draws / 2)) / (2 * N);
		console.log(`  last two on days ${`${d1}/${d2}`.padEnd(6)} ${pct(win).padStart(5)} ±${(196 * Math.sqrt(win * (1 - win) / (2 * N))).toFixed(1)}   ${((m1.days + m2.days) / 2).toFixed(1)} days`);
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
