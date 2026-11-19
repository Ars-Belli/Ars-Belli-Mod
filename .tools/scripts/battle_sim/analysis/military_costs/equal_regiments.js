// node .tools/scripts/battle_sim/analysis/military_costs/equal_regiments.js [--ages 1,2,3] [--wars 300] [--months 120]
// The other limit: gold is no object and the armies are the same size, as in the MP meta (30 regiments a side). Price changes cannot
// reach this view, only goods_access_factor can: cavalry reinforcement speed x g when the market runs short of horses.
// Heavy cavalry vs heavy infantry, same manpower income, fighting when both are ready (spacing 'ready') or every 2 months.
const pool = require('../../pool.js')();
const S = require('../../engine.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ages = arg('--ages', '1,2,3').split(',').map(Number), W = +arg('--wars', 300), months = +arg('--months', 120);
const GEN = { adm: 60, dip: 59, mil: 61 };
const size = (c, age) => S.AGE[c][age - 1][1];
const army = (c, age, n, country) => ({ name: c, general: GEN, country, units: [{ type: `generic:${c}:${age}`, count: n }] });
const pct = x => (100 * x).toFixed(0).padStart(3) + '%';
(async () => {
	console.log('30 heavy infantry vs 30 heavy cavalry, no gold limit. wars won: infantry / cavalry (the rest undecided)');
	console.log('age  cavalry reinforce speed x   fight when ready   every 2 months');
	for (const age of ages) for (const g of [1, 0.5, 0.2, 0.06]) {
		const loc = { frontage: 10 };
		const scn = { location: loc, attacker: { armies: [army('hi', age, 30, {})] }, defender: { armies: [army('hc', age, 30, { reinforceSpeed: g - 1 })] } };
		const men = Math.max(0.02 * size('hi', age), 0.04 * size('hc', age)) * 30 * 1000, income = men / 0.75;
		const side = { income };
		const r = [];
		for (const interval of ['ready', 2]) { const w = await pool.wars(scn, W, { months, interval, sides: [side, side] }, 3); r.push(`${pct(w.collapsed[1])}/${pct(w.collapsed[0])}`); }
		console.log(`${String(age).padStart(3)} ${String(g).padStart(26)} ${r[0].padStart(18)} ${r[1].padStart(16)}`);
	}
	await pool.close();
})();
