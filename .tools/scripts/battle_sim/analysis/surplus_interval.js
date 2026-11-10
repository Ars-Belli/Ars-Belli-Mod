// node .tools/scripts/battle_sim/analysis/surplus_interval.js [wars, default 300] [months, default 120] [--unit generic:hi:5]
// Does the time between battles change how much manpower income should go to upkeep? Equal incomes, the same wars as
// surplus_war.js (pool full at the start, 25% reinforcement a month, collapse under 50%, battle experience on).
//   1. Fixed spacing: a battle every 1-12 months, or 'ready' (both back to full, or one forces it after waiting 6 months).
//      Every upkeep share plays every other in both seat orders.
//   2. One side picks the moment: it gives battle as soon as it is back to full, the enemy can only force one after 12 months.
//      Does a smaller army with a bigger surplus beat a bigger army that way?
// Wars nobody lost by the end count half; the undecided share is shown where it matters.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i < 0 ? null : argv[i + 1]; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const [WARS, MONTHS] = [+pos[0] || 300, +pos[1] || 120];
const UNIT = opt('--unit') || 'generic:hi:5';
const GEN = { adm: 60, dip: 59, mil: 61 };
const upkeep = S.armyCosts({ attacker: { armies: [{ units: [{ type: UNIT, count: 1 }] }] }, defender: { armies: [] } })[0].upkeepManpower * 1000;
const INCOME = 30 * upkeep / 0.75;
const SH = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const regs = s => Math.max(1, Math.round(s * INCOME / upkeep));
const army = n => ({ general: GEN, country: {}, units: [{ type: UNIT, count: n }] });
// side 0 at share a vs side 1 at share b
const war = (a, b, warOpts) => pool.wars({ location: { frontage: 10 }, attacker: { armies: [army(regs(a))] }, defender: { armies: [army(regs(b))] } }, WARS,
	{ months: MONTHS, experience: true, sides: [{ income: INCOME }, { income: INCOME }], ...warOpts }, 13);
const score0 = w => w.collapsed[1] + w.undecided / 2; // side 0 wins
const pct = x => `${Math.round(100 * x)}%`;
const name = iv => iv === 'ready' ? 'ready' : `${iv} mo`;

(async () => {
	const t0 = Date.now();
	console.log(`${UNIT}: ${upkeep.toFixed(1)} men a month a regiment, income ${Math.round(INCOME)} a month (= ${regs(1)} regiments at 100%). ${WARS} wars a pairing, ${MONTHS} months.\n`);

	// ---- 1. fixed spacing
	console.log('=== 1. Battle spacing: each share\'s win rate against the field (all shares), and its result against 100%');
	console.log('spacing   ' + SH.map(s => `${Math.round(100 * s)}%(${regs(s)})`.padStart(9)).join('') + '   best answer to 100% / to 80%   battles (70v70)');
	for (const iv of [1, 2, 3, 4, 6, 9, 12, 'ready']) {
		const W = await Promise.all(SH.map(a => Promise.all(SH.map(b => war(a, b, { interval: iv })))));
		const M = SH.map((a, i) => SH.map((b, j) => (score0(W[i][j]) + 1 - score0(W[j][i])) / 2));
		const best = j => SH[M.map(r => r[j]).reduce((bi, x, i, arr) => x > arr[bi] ? i : bi, 0)];
		const field = M.map(r => r.reduce((s, x) => s + x, 0) / SH.length);
		const vs100 = M.map(r => r[SH.length - 1]);
		console.log(`${name(iv).padEnd(10)}` + field.map((f, i) => `${pct(f)} (${pct(vs100[i])})`.padStart(9)).join('') +
			`   ${pct(best(SH.length - 1))} / ${pct(best(SH.indexOf(0.8)))}`.padEnd(30) + W[2][2].battles.toFixed(1).padStart(10));
	}
	console.log('(cell: win rate vs the field, in brackets vs 100%)');

	// ---- 2. one side picks the moment
	for (const opp of [1.0, 0.8]) {
		console.log(`\n=== 2. Challenger vs ${pct(opp)} upkeep (${regs(opp)} regiments). Challenger's win rate (undecided wars in brackets)`);
		console.log('challenger      both fight when full    challenger picks the moment    enemy picks the moment    battles (challenger picks)');
		for (const s of SH) {
			const both = await Promise.all([war(s, opp, { interval: 'ready' }), war(opp, s, { interval: 'ready' })]);
			const mine = await Promise.all([war(s, opp, { interval: 'ready', decides: 0 }), war(opp, s, { interval: 'ready', decides: 1 })]);
			const theirs = await Promise.all([war(s, opp, { interval: 'ready', decides: 1 }), war(opp, s, { interval: 'ready', decides: 0 })]);
			const f = ([w1, w2]) => ({ win: (score0(w1) + 1 - score0(w2)) / 2, und: (w1.undecided + w2.undecided) / 2, b: (w1.battles + w2.battles) / 2 });
			const [B, Mi, T] = [f(both), f(mine), f(theirs)];
			const cell = x => `${pct(x.win)} (${pct(x.und)})`;
			console.log(`  ${(pct(s) + ' (' + regs(s) + ')').padEnd(14)}${cell(B).padStart(16)}${cell(Mi).padStart(26)}${cell(T).padStart(26)}${Mi.b.toFixed(1).padStart(18)}`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
