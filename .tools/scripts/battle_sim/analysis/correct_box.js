// node .tools/scripts/battle_sim/analysis/correct_box.js [battles, default 2000] [wars, default 200]
// What is +30% correct section chance (Leadership's Aides-de-Camp) worth? Identical sides at the 1547 Spain size (6 armies of 30,
// 2 at the start, the rest fed in as each side's reserve runs empty, so late regiments roll correct_box_chance), one side with
// +30% on top of the vanilla age bonus (+10% an age from age II). Generals 60/59/61 both (their adm adds +6% to each side).
// Reports side A's battle win rate, men lost each, and the manpower reserve gap after a 24-month war.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const [N, WARS] = [+process.argv[2] || 2000, +process.argv[3] || 200];
const GEN = { adm: 60, dip: 59, mil: 61 };
const side = (unit, box) => ({ armies: Array.from({ length: 6 }, (_, k) => ({ general: GEN, country: { correctBoxChance: box }, units: [{ type: unit, count: 30 }], ...(k < 2 ? {} : { arrivalDay: 'needed', marchDays: 1 }) })) });
(async () => {
	for (const [unit, age, price] of [['generic:hc:3', 3, 0.04], ['generic:hi:5', 5, 0.02]]) {
		const base = 0.1 * (age - 1), income = 180 * price * S.AGE[unit.split(':')[1]][age - 1][1] * 1000 / 1.25 / 0.75;
		for (const extra of [0.3, 0.6]) {
			const A = side(unit, base + extra), B = side(unit, base);
			const [m1, m2] = await Promise.all([pool.mc({ location: { frontage: 10 }, attacker: A, defender: B }, N, { seed: 4 }), pool.mc({ location: { frontage: 10 }, attacker: B, defender: A }, N, { seed: 4 })]);
			const win = ((m1.wins[0] + m1.draws / 2) + (m2.wins[1] + m2.draws / 2)) / (2 * N), ci = 1.96 * Math.sqrt(win * (1 - win) / (2 * N));
			const lostA = (m1.losses[0] + m2.losses[1]) / 2, lostB = (m1.losses[1] + m2.losses[0]) / 2;
			const opt = { months: 24, endOn: 'none', interval: 'ready', collapseAt: 0, sides: [{ income }, { income }] };
			const [w1, w2] = await Promise.all([pool.wars({ location: { frontage: 10 }, attacker: A, defender: B }, WARS, opt, 6), pool.wars({ location: { frontage: 10 }, attacker: B, defender: A }, WARS, opt, 6)]);
			const gap = (w1.reserveDiff - w2.reserveDiff) / 2;
			console.log(`${unit} ${Math.round(100 * (base + extra))}% vs ${Math.round(100 * base)}%: A wins ${(100 * win).toFixed(1)}% ±${(100 * ci).toFixed(1)}, men lost A ${Math.round(lostA * 1000).toLocaleString('en-US')} / B ${Math.round(lostB * 1000).toLocaleString('en-US')}, reserve gap after 24 months ${gap >= 0 ? '+' : ''}${(100 * gap).toFixed(1)} points`);
		}
	}
	await pool.close();
})();
