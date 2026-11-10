// node .tools/scripts/battle_sim/analysis/surplus_war.js [wars, default 300] [months, default 120] [interval months | ready, default 2]
//      ready = fight once both sides are fully reinforced (or one has waited 6 months for the other)
//      [--unit generic:hi:5] [--ratio 1.5] [--no-exp]
// How much of the monthly manpower income should go to upkeep (army size) and how much stay as surplus (reinforcements) in a
// long war? Sampled wars (simulateWar): a battle every `interval` months, full morale at each, reinforcement 25% of a regiment
// a month from the pool, pool starts full (5 years of income), a side under 50% of its men when a battle is due has lost.
// Battle experience is on (30 x own losses / own men, decaying 4% a month) unless --no-exp. Gold is assumed unlimited.
//   1. Equal incomes: every upkeep share plays every other (both seat orders); score = win rate against the field.
//   2. Unequal incomes: the stronger side has `ratio` x the income and spends 75% of it; the weaker side tries every share,
//      from a small army with a big surplus to matching the stronger army's size (upkeep above income, paid from the pool).
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const [WARS, MONTHS, INTERVAL] = [+pos[0] || 300, +pos[1] || 120, pos[2] === 'ready' ? 'ready' : +pos[2] || 2];
const UNIT = opt('--unit') || 'generic:hi:5', RATIO = +(opt('--ratio') || 1.5), EXP = !argv.includes('--no-exp');
const GEN = { adm: 60, dip: 59, mil: 61 };
const upkeep = S.armyCosts({ attacker: { armies: [{ units: [{ type: UNIT, count: 1 }] }] }, defender: { armies: [] } })[0].upkeepManpower * 1000; // men a month a regiment
const INCOME = 30 * upkeep / 0.75; // 30 regiments = 75% of income
const regs = (share, income) => Math.max(1, Math.round(share * income / upkeep));
const army = n => ({ general: GEN, country: {}, units: [{ type: UNIT, count: n }] });
const war = (nA, incA, nB, incB) => pool.wars({ location: { frontage: 10 }, attacker: { armies: [army(nA)] }, defender: { armies: [army(nB)] } }, WARS,
	{ months: MONTHS, interval: INTERVAL, experience: EXP, sides: [{ income: incA }, { income: incB }] }, 11);
const pct = x => `${Math.round(100 * x)}%`.padStart(5);
// A's chance to win the war: B collapses, half of the wars nobody lost
const scoreA = w => w.collapsed[1] + w.undecided / 2;

(async () => {
	const t0 = Date.now();
	console.log(`${UNIT}: ${upkeep.toFixed(1)} men a month a regiment; base income ${Math.round(INCOME)} a month (30 regiments = 75%).`);
	console.log(`${WARS} wars per pairing, ${MONTHS} months, ${INTERVAL === 'ready' ? 'battles when both are fully reinforced (max 6 months wait)' : `a battle every ${INTERVAL} months`}, experience ${EXP ? 'on' : 'off'}.\n`);

	// ---- 1. equal incomes
	const SH = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
	const W = await Promise.all(SH.map(a => Promise.all(SH.map(b => war(regs(a, INCOME), INCOME, regs(b, INCOME), INCOME)))));
	const M = SH.map((a, i) => SH.map((b, j) => (scoreA(W[i][j]) + 1 - scoreA(W[j][i])) / 2)); // both seat orders
	console.log('=== 1. Equal incomes: row share beats column share (upkeep as % of income; regiments in brackets)');
	console.log('         ' + SH.map(b => `${Math.round(100 * b)}%(${regs(b, INCOME)})`.padStart(9)).join(''));
	SH.forEach((a, i) => console.log(`${(Math.round(100 * a) + '%(' + regs(a, INCOME) + ')').padEnd(9)}` + M[i].map(x => pct(x).padStart(9)).join('') + `   vs field ${pct(M[i].reduce((s, x) => s + x, 0) / SH.length)}`));
	const best = j => SH[M.map(r => r[j]).reduce((bi, x, i, arr) => x > arr[bi] ? i : bi, 0)];
	console.log('best answer to each column: ' + SH.map((b, j) => `${Math.round(100 * b)}%->${Math.round(100 * best(j))}%`).join('  '));
	const self = SH.map((a, i) => ({ a, i })).filter(({ a, i }) => best(i) === a).map(({ a }) => `${Math.round(100 * a)}%`);
	console.log(`shares that are their own best answer: ${self.join(', ') || 'none'}`);
	const d = W[SH.indexOf(0.7)][SH.indexOf(0.7)];
	console.log(`(70% vs 70%: ${d.battles.toFixed(1)} battles, end experience ${d.exp.map(x => x.toFixed(1)).join(' / ')})`);

	// ---- 2. unequal incomes
	for (const ratio of [...new Set([RATIO, 2])]) {
		const incB = INCOME * ratio, nB = regs(0.75, incB), match = nB * upkeep / INCOME;
		const SA = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0].filter(s => s <= Math.max(1, match) + 1e-9 || s === 1.25 && match > 1);
		if (!SA.some(s => Math.abs(s - match) < 0.01)) SA.push(match);
		SA.sort((x, y) => x - y);
		console.log(`\n=== 2. Weaker side vs ${ratio}x income (stronger: ${nB} regiments, 75% of its income)`);
		console.log('weaker share  regiments  wins war  battles won  battles  end men weaker/stronger  pool left  experience');
		for (const s of SA) {
			const nA = regs(s, INCOME);
			const [w1, w2] = await Promise.all([war(nA, INCOME, nB, incB), war(nB, incB, nA, INCOME)]);
			const win = (scoreA(w1) + (w2.collapsed[0] + w2.undecided / 2)) / 2;
			const bw = (w1.battleShare[0] + w2.battleShare[1]) / 2, b = (w1.battles + w2.battles) / 2;
			const endA = (w1.end[0] + w2.end[1]) / 2, endB = (w1.end[1] + w2.end[0]) / 2, poolA = (w1.pool[0] + w2.pool[1]) / 2;
			console.log(`  ${(Math.round(100 * s) + '%' + (Math.abs(s - match) < 0.01 ? ' (match)' : '')).padEnd(12)}${String(nA).padStart(9)}  ${pct(win).padStart(8)}  ${pct(bw).padStart(11)}  ${b.toFixed(1).padStart(7)}  ${(pct(endA) + ' /' + pct(endB)).padStart(23)}  ${Math.round(poolA * 1000).toLocaleString('en-US').padStart(9)}  ${((w1.exp[0] + w2.exp[1]) / 2).toFixed(1).padStart(10)}`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
