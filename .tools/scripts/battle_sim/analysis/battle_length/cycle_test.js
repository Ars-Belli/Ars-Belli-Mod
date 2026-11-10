// Prediction: the relay's edge follows swap cycle / battle length for any unit. Lengthen or shorten battles and see if the edge follows.
//   node cycle_test.js [battles a seat, default 120]
const { runCells, pct } = require('./relay.js');
const N = +process.argv[2] || 120;
const INF = (m, e, k = 4, n = 30) => ({ u: 'generic:hi:5', n, k, c: { moraleMod: m }, e, frontage: 10 });
const CAV = { u: 'generic:hc:3', n: 30, k: 4, c: { moraleMod: .3 }, e: 50, frontage: 10 };
const EXP = [
	['inf, baseline', INF(.3, 50), {}, 3, 1],
	['inf, +60% morale 80 exp', INF(.6, 80), {}, 3, 1],
	['inf, +100% morale 90 exp', INF(1, 90), {}, 3, 1],
	['inf, damage x0.67 (long)', INF(.3, 50), { DAMAGE_MULT: 0.08 }, 3, 1],
	['inf, damage x0.5 (long)', INF(.3, 50), { DAMAGE_MULT: 0.06 }, 3, 1],
	['inf, damage x0.33 (long)', INF(.3, 50), { DAMAGE_MULT: 0.04 }, 3, 1],
	['inf, damage x2 (short)', INF(.3, 50), { DAMAGE_MULT: 0.24 }, 3, 1],
	['inf, damage x3 (short)', INF(.3, 50), { DAMAGE_MULT: 0.36 }, 3, 1],
	['inf, damage x4 (short)', INF(.3, 50), { DAMAGE_MULT: 0.48 }, 3, 1],
	['inf long: speed x0.75', INF(1, 90), {}, 4, 1],
	['inf long: speed x0.5', INF(1, 90), {}, 6, 1],
	['inf long: damage x1.5', INF(1, 90), { DAMAGE_MULT: 0.18 }, 3, 1],
	['inf long: damage x2', INF(1, 90), { DAMAGE_MULT: 0.24 }, 3, 1],
	['inf long: recovery x0.5', INF(1, 90), {}, 3, .5],
	['cav: damage x2', CAV, { DAMAGE_MULT: 0.24 }, 3, 1],
	['cav: damage x3', CAV, { DAMAGE_MULT: 0.36 }, 3, 1],
	['cav: damage x4', CAV, { DAMAGE_MULT: 0.48 }, 3, 1],
	['cav: recovery x0.75', CAV, {}, 3, .75],
	['cav: recovery x0.5', CAV, {}, 3, .5],
	['cav: recovery x0.33', CAV, {}, 3, 1 / 3],
	['cav: speed x0.75 + recovery x0.75', CAV, {}, 4, .75],
	['cav: speed x0.75 + rec x0.75 + dmg x1.25', CAV, { DAMAGE_MULT: 0.15 }, 4, .75],
	['cav: rec x0.5 + dmg x1.25', CAV, { DAMAGE_MULT: 0.15 }, 3, .5],
];
(async () => {
	const jobs = EXP.flatMap(([, o, over, march, rec]) => [
		{ kind: 'allin', o, seed: 8000, n: N * 2, over },
		{ kind: 'relay', o, cfg: { relay: true, start: 3, threshold: 0.3, target: 0.9, maxRest: 40, march, recovery: 0.0625 * rec, friendly: true }, seed: 9000, n: N, over },
	]);
	const res = await runCells(jobs);
	console.log(`(${N * 2} engagements a cell) 3 armies in, 1 a location away, swap under 30% morale, rest to 90%. outright = this battle only`);
	console.log('experiment'.padEnd(42) + 'all-in days'.padStart(12) + 'outright%'.padStart(11) + '   95%'.padEnd(10) + 'days'.padStart(6) + 'swaps'.padStart(7) + 'trade'.padStart(7));
	EXP.forEach(([name], i) => {
		const c = res[i * 2], r = res[i * 2 + 1];
		console.log(name.padEnd(42) + c.days.toFixed(1).padStart(12) + pct(r.outright).padStart(11) + `   ${(r.lo * 100).toFixed(0)}-${(r.hi * 100).toFixed(0)}`.padEnd(10) + r.days.toFixed(0).padStart(6) + r.trips.toFixed(1).padStart(7) + r.trade.toFixed(2).padStart(7));
	});
})();
