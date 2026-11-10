// node .tools/scripts/battle_sim/analysis/stat_sweep_cav_inf.js [age, default 4] [battles per row, default 3000]
// Heavy cavalry vs heavy infantry of one age: how much do morale, discipline and military tactics move the result, given
// to the infantry or to the cavalry? Same regiments (30 each) and equal manpower upkeep (cavalry count scaled), frontage 10,
// both seat orders, generals 60/59/61 (average commanding general in Europe, 1547 save). Also shows how each side loses.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const AGE = +process.argv[2] || 4, N = +process.argv[3] || 3000;
const GEN = { adm: 60, dip: 59, mil: 61 }, CAV = `generic:hc:${AGE}`, INF = `generic:hi:${AGE}`;
const upkeep = t => S.armyCosts({ attacker: { armies: [{ units: [{ type: t, count: 1 }] }] }, defender: { armies: [] } })[0].upkeepManpower;
const SETUPS = { 'same regiments': [30, 30], 'equal upkeep': [Math.round(30 * upkeep(INF) / upkeep(CAV)), 30] };
const BONUS = [
	['none', {}],
	['morale +10%', { moraleMod: 0.1 }], ['morale +20%', { moraleMod: 0.2 }], ['morale +30%', { moraleMod: 0.3 }], ['morale +50%', { moraleMod: 0.5 }],
	['discipline +5%', { discipline: 0.05 }], ['discipline +10%', { discipline: 0.1 }], ['discipline +20%', { discipline: 0.2 }],
	['tactics +0.25', { tactics: 0.25 }], ['tactics +0.5', { tactics: 0.5 }], ['tactics +1', { tactics: 1 }],
];
const country = b => ({ moraleMod: b.moraleMod || 0, discipline: b.discipline || 0, tactics: 1 + (b.tactics || 0) });
const army = (type, n, b) => ({ general: GEN, country: country(b), units: [{ type, count: n }] });
// cavalry's share of wins (draws half) over both seat orders, and how the loser's battles ended
async function duel(nc, ni, bc, bi) {
	const [m1, m2] = await Promise.all([
		pool.mc({ location: { frontage: 10 }, attacker: { armies: [army(CAV, nc, bc)] }, defender: { armies: [army(INF, ni, bi)] } }, N, { seed: 3 }),
		pool.mc({ location: { frontage: 10 }, attacker: { armies: [army(INF, ni, bi)] }, defender: { armies: [army(CAV, nc, bc)] } }, N, { seed: 3 }),
	]);
	const cav = ((m1.wins[0] + m1.draws / 2) + (m2.wins[1] + m2.draws / 2)) / (2 * N);
	const how = (si1, si2, k) => ((m1[k] || [])[si1] + (m2[k] || [])[si2]) / (2 * N); // share of all battles
	return { cav, inf: { overrun: how(1, 0, 'overrun'), shattered: how(1, 0, 'shattered'), retreated: how(1, 0, 'retreated') },
		cavLoss: { overrun: how(0, 1, 'overrun'), shattered: how(0, 1, 'shattered'), retreated: how(0, 1, 'retreated') },
		days: (m1.days + m2.days) / 2 };
}
const pct = x => `${Math.round(100 * x)}%`;
(async () => {
	const t0 = Date.now();
	console.log(`Age ${AGE}: ${CAV} vs ${INF}, ${N} battles each seat order. Upkeep a regiment: cavalry ${(upkeep(CAV) * 1000).toFixed(0)}, infantry ${(upkeep(INF) * 1000).toFixed(0)} men a month.`);
	for (const [sname, [nc, ni]] of Object.entries(SETUPS)) {
		console.log(`\n=== ${sname}: ${nc} cavalry vs ${ni} infantry. Cavalry win rate`);
		console.log('bonus              to infantry   to cavalry   | infantry loses by: retreat / shattered / wiped (bonus to infantry)');
		for (const [bn, b] of BONUS) {
			const [toInf, toCav] = await Promise.all([duel(nc, ni, {}, b), duel(nc, ni, b, {})]);
			const L = toInf.inf, tot = L.retreated + L.shattered + L.overrun || 1;
			console.log(`  ${bn.padEnd(17)}${pct(toInf.cav).padStart(10)}${pct(toCav.cav).padStart(13)}   | ${pct(L.retreated / tot)} / ${pct(L.shattered / tot)} / ${pct(L.overrun / tot)}   (${toInf.days.toFixed(1)} days)`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
