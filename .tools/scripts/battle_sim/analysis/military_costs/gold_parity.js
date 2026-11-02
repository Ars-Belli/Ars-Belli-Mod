// node .tools/scripts/battle_sim/analysis/military_costs/gold_parity.js [--ages 1,2,3,4] [--battles 2000] [--wars 300] [--months 120] [--share 0.6] [--speed 1]
// Does dearer cavalry and dearer reinforcement make infantry usable early? 30 heavy infantry regiments against the heavy cavalry
// the same gold upkeep buys, with cavalry's gold prices x k (k is the market's goods impact on the cavalry basket, 1 = base price).
// Battles: both at full strength. Wars (simulateWar): same manpower and gold income, gold income = infantry upkeep / --share, so the
// rest of it pays reinforcement. --speed multiplies cavalry reinforcement speed (goods_access_factor when horses run short).
const pool = require('../../pool.js')();
const S = require('../../engine.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ages = arg('--ages', '1,2,3,4').split(',').map(Number), N = +arg('--battles', 2000), W = +arg('--wars', 300);
const months = +arg('--months', 120), share = +arg('--share', 0.6), speed = +arg('--speed', 1);
const KS = [1, 1.5, 2, 3, 4], REINF = [0.05, 0.25, 0.5, 1];
const GEN = { adm: 60, dip: 59, mil: 61 };
const P = { hi: { b: 50, m: 0.5 }, hc: { b: 150, m: 1.5 } }; // gold per 100 men, prices/02_units.txt
const size = (c, age) => S.AGE[c][age - 1][1];
const upkeep = (c, age, k = 1) => P[c].m * size(c, age) * 10 * k;
const costs = (age, k, r) => ({
	hi: { buildGold: P.hi.b * size('hi', age) * 10, upkeepGold: upkeep('hi', age), reinforceGold: P.hi.b * r * 10 },
	hc: { buildGold: P.hc.b * size('hc', age) * 10 * k, upkeepGold: upkeep('hc', age, k), reinforceGold: P.hc.b * r * 10 * k },
});
const army = (c, age, n, country) => ({ name: c, general: GEN, country, units: [{ type: `generic:${c}:${age}`, count: n }] });
const pct = x => (100 * x).toFixed(0).padStart(3) + '%';
(async () => {
	console.log(`30 heavy infantry vs heavy cavalry at equal gold upkeep. Upkeep ${share * 100}% of gold income, ${months}-month wars, fighting when both are reinforced, cavalry reinforce speed x${speed}`);
	console.log('cells: infantry share of battles at full strength | wars won by infantry at reinforcement 5% / 25% / 50% / 100% of the build price\n');
	for (const age of ages) {
		console.log(`age ${age}: infantry ${size('hi', age) * 1000} men a regiment, cavalry ${size('hc', age) * 1000}`);
		console.log('  cavalry gold x   cavalry regiments   battles      wars 5%     wars 25%     wars 50%    wars 100%');
		for (const k of KS) {
			const nc = Math.max(1, Math.round(30 * upkeep('hi', age) / upkeep('hc', age, k)));
			const loc = { frontage: 10 };
			const hi = () => army('hi', age, 30, {}), hc = () => army('hc', age, nc, speed === 1 ? {} : { reinforceSpeed: speed - 1 });
			const [m1, m2] = await Promise.all([
				pool.mc({ location: loc, attacker: { armies: [hi()] }, defender: { armies: [hc()] } }, N / 2, { seed: 7 }),
				pool.mc({ location: loc, attacker: { armies: [hc()] }, defender: { armies: [hi()] } }, N / 2, { seed: 8 }),
			]);
			const win = (m1.wins[0] + m1.draws / 2 + m2.wins[1] + m2.draws / 2) / N;
			const wars = [];
			for (const r of REINF) {
				const scn = { location: loc, costs: costs(age, k, r), attacker: { armies: [hi()] }, defender: { armies: [hc()] } };
				const men = Math.max(0.02 * size('hi', age) * 30, 0.04 * size('hc', age) * nc) * 1000, income = men / 0.75;
				const gold = upkeep('hi', age) * 30 / share, side = { income, goldIncome: gold, gold: gold * 6 };
				const w = await pool.wars(scn, W, { months, interval: 'ready', sides: [side, side] }, 3);
				wars.push(`${pct(w.collapsed[1])}/${pct(w.collapsed[0])}`);
			}
			console.log(`  ${String(k).padStart(8)} ${String(nc).padStart(19)} ${pct(win).padStart(9)} ${wars.map(x => x.padStart(12)).join(' ')}`);
		}
		console.log('');
	}
	await pool.close();
})();
