// 42 real 1.4.6 battles (battles14.json, AI wars of an observer game, 1370s, both sides at least 3k men) against the simulator.
// Compares the engage limit and engaged-first targeting (ENGAGE_W) with the model before them, on identical inputs and seeds.
// Stats per country are not known, so every side gets one age 1 baseline; only the comparison between rulesets is meaningful.
const os = require('os'); try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch {}
const S = require('../../engine.js'); S.setUnitDB(require('../../units.json'));
const B = require('./battles14.json').filter(b => [b.A, b.D].every(s => s.tot.reduce((x, y) => x + y, 0) >= 3));
const N = +process.argv[2] || 60;
// categories in a save's totals: light infantry, heavy infantry, light cavalry, heavy cavalry, artillery, auxiliary
const LEVY = ['a_feudal_levy', 'a_feudal_levy', 'a_tribal_cavalry', 'a_mailed_knights', 'a_age_1_traditions_artillery', 'a_supply_convoy'];
const REG = ['a_archers', 'a_footmen', 'a_horsemen', 'a_armored_horsemen', 'a_age_1_traditions_artillery', 'a_supply_convoy'];
const base = { tactics: 1, discipline: 0.1365, moraleMod: 0.243, moraleFlat: 0, experience: 0.37, levyCE: 0.1, combinedPerType: 0.025, initiativeMod: 0, correctBoxChance: 0 };
const side = (x, m) => {
	const share = Math.min(1, x.levy / Math.max(x.size, 0.01)), units = [];
	x.tot.slice(0, 6).forEach((men, i) => {
		for (const [t, part] of [[LEVY[i], share], [REG[i], 1 - share]]) { const n = Math.round(men * part / S.unitStats(t).s); if (n > 0) units.push({ type: t, count: n }); }
	});
	return { name: 'x', morale: m, general: { adm: 40, dip: 40, mil: 40 }, country: base, units };
};
const run = (flag, m) => {
	Object.assign(S.D, { ENGAGE_W: flag });
	let brier = 0, hit = 0; const r = [];
	for (const b of B) {
		const x = S.monteCarloScenario({ location: { topography: b.topo, vegetation: b.veg }, attacker: { armies: [side(b.A, m)] }, defender: { armies: [side(b.D, m)] } }, N, { seed: 3 });
		const p = (x.wins[0] + x.draws / 2) / x.n, y = b.res === 'yes' ? 1 : 0;
		brier += (p - y) ** 2; hit += (p >= 0.5) === (y === 1) ? 1 : 0;
		const men = s => s.tot.reduce((a, c) => a + c, 0), lost = s => s.lost.reduce((a, c) => a + c, 0);
		r.push({ rL: y ? lost(b.D) / men(b.D) : lost(b.A) / men(b.A), rW: y ? lost(b.A) / men(b.A) : lost(b.D) / men(b.D), sL: y ? x.losses[1] / men(b.D) : x.losses[0] / men(b.A), sW: y ? x.losses[0] / men(b.A) : x.losses[1] / men(b.D) });
	}
	const a = k => (100 * r.reduce((t, q) => t + q[k], 0) / r.length).toFixed(0) + '%';
	console.log(`  ${flag ? 'engage limit ' : 'old model    '} morale ${m}: winner ${hit}/${B.length}, Brier ${(brier / B.length).toFixed(3)}; loser lost real ${a('rL')} sim ${a('sL')}; winner real ${a('rW')} sim ${a('sW')}`);
};
for (const m of [1, 0.7]) for (const f of [false, true]) run(f, m);
