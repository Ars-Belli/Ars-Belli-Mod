// Why does the relay work? Swap one suspected cause at a time. outright = the battle itself, so a passive winner cannot inflate it.
//   node explain.js [battles a seat, default 120]
const { runCells, pct } = require('./relay.js');
const N = +process.argv[2] || 120;
const q = { moraleMod: .3 };
const INF = { u: 'generic:hi:5', n: 30, k: 4, c: q, e: 50, frontage: 10 };
const CAV = { u: 'generic:hc:3', n: 30, k: 4, c: q, e: 50, frontage: 10 };
const EXP = [
	['inf: baseline', INF, {}, 3],
	['inf: reserves fill like cavalry', INF, { SPEED_SCALE: 0.25 }, 3],
	['inf: no daily morale tick', INF, { DAILY_MORALE: 0 }, 3],
	['inf: tick x2', INF, { DAILY_MORALE: 0.06 }, 3],
	['inf: speed x0.5', INF, {}, 6],
	['inf: no engage limit', INF, { ENGAGE_W: false }, 3],
	['cav: baseline', CAV, {}, 3],
	['cav: reserves fill like infantry', CAV, { SPEED_SCALE: 0.04 }, 3],
	['cav: no daily morale tick', CAV, { DAILY_MORALE: 0 }, 3],
	['cav: tick x2', CAV, { DAILY_MORALE: 0.06 }, 3],
	['cav: speed x0.5', CAV, {}, 6],
	['cav: speed x0.25', CAV, {}, 12],
	['cav: no engage limit', CAV, { ENGAGE_W: false }, 3],
	['cav: damage x1.5', CAV, { DAMAGE_MULT: 0.18 }, 3],
	['cav: damage x2', CAV, { DAMAGE_MULT: 0.24 }, 3],
	['cav: damage x3', CAV, { DAMAGE_MULT: 0.36 }, 3],
];
(async () => {
	const jobs = EXP.flatMap(([, o, over, march]) => [
		{ kind: 'allin', o, seed: 8000, n: N * 2, over },
		{ kind: 'relay', o, cfg: { relay: true, start: 3, threshold: 0.3, target: 0.9, maxRest: 25, march, recovery: 0.0625, friendly: true }, seed: 9000, n: N, over },
	]);
	const res = await runCells(jobs);
	console.log(`(${N * 2} engagements a cell) relay = 3 armies in, 1 a location away, swap under 30% morale`);
	console.log('experiment'.padEnd(36) + 'all-in days'.padStart(12) + 'outright%'.padStart(11) + '   95%'.padEnd(11) + 'with follow-up%'.padStart(16) + 'days'.padStart(6) + 'swaps'.padStart(7) + 'trade'.padStart(7));
	EXP.forEach(([name], i) => {
		const c = res[i * 2], r = res[i * 2 + 1];
		console.log(name.padEnd(36) + c.days.toFixed(1).padStart(12) + pct(r.outright).padStart(11) + `   ${(r.lo * 100).toFixed(0)}-${(r.hi * 100).toFixed(0)}`.padEnd(11) + pct(r.win).padStart(16) + r.days.toFixed(0).padStart(6) + r.trips.toFixed(1).padStart(7) + r.trade.toFixed(2).padStart(7));
	});
})();
