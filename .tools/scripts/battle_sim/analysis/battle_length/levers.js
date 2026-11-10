// A player who adapts: for each change the relay takes its best of four policies, at 3 and 5 days a location.
//   node levers.js [battles a seat, default 150]
const { runCells, pct } = require('./relay.js');
const N = +process.argv[2] || 150;
const q = { moraleMod: .3 };
const SCN = [
	['Inf V 4x30', { u: 'generic:hi:5', n: 30, k: 4, c: q, e: 50, frontage: 10 }],
	['Cav III 4x30', { u: 'generic:hc:3', n: 30, k: 4, c: q, e: 50, frontage: 10 }],
];
const LEVERS = [
	['vanilla', {}, 1, 1],
	['speed x0.75', {}, 4 / 3, 1],
	['speed x0.5', {}, 2, 1],
	['speed x0.33', {}, 3, 1],
	['tick 0.03 -> 0.06', { DAILY_MORALE: 0.06 }, 1, 1],
	['tick 0.03 -> 0.015', { DAILY_MORALE: 0.015 }, 1, 1],
	['tick 0.015 + damage x1.5', { DAILY_MORALE: 0.015, DAMAGE_MULT: 0.18 }, 1, 1],
	['damage x1.5', { DAMAGE_MULT: 0.18 }, 1, 1],
	['damage x2', { DAMAGE_MULT: 0.24 }, 1, 1],
	['damage x3', { DAMAGE_MULT: 0.36 }, 1, 1],
	['damage x4', { DAMAGE_MULT: 0.48 }, 1, 1],
	['morale x4 + strength x3', { MOR_MOD: 1, STR_MOD: 0.12 }, 1, 1],
	['morale recovery x0.5', {}, 1, 0.5],
	['MINIMUM_COMBAT_DAYS 15', { MIN_DAYS: 15 }, 1, 1],
	['MINIMUM_COMBAT_DAYS 30', { MIN_DAYS: 30 }, 1, 1],
];
const POL = []; for (const start of [2, 3]) for (const th of [0.3, 0.5]) POL.push([start, th]);
(async () => {
	const T = [3, 5];
	const jobs = [];
	for (const T0 of T) for (const [, o] of SCN) for (const [, over, tMul, rec] of LEVERS) {
		jobs.push({ kind: 'allin', o, seed: 8000, n: N * 2, over });
		for (const [start, th] of POL) jobs.push({ kind: 'relay', o, cfg: { relay: true, start, threshold: th, target: 0.9, maxRest: 25, march: Math.round(T0 * tMul), recovery: 0.0625 * rec, friendly: true }, seed: 9000, n: N, over });
	}
	const res = await runCells(jobs);
	let at = 0;
	for (const T0 of T) {
		console.log(`\n######## one-way march ${T0} days, own territory. Relay is the best outright rate of (2 in, 3 in) x swap (<0.3, <0.5)`);
		for (const [sn] of SCN) {
			console.log(`\n=== ${sn} (${N * 2} engagements a cell)`);
			console.log('change'.padEnd(28) + 'all-in days'.padStart(12) + 'relay best'.padStart(12) + '   95%'.padEnd(13) + 'policy'.padEnd(13) + 'days'.padStart(6) + 'swaps'.padStart(7) + 'trade'.padStart(7));
			for (const [name] of LEVERS) {
				const ctl = res[at++];
				let best = null, bp = '';
				for (const [start, th] of POL) { const r = res[at++]; if (!best || r.outright > best.outright) { best = r; bp = `${start} in <${th}`; } }
				console.log(name.padEnd(28) + ctl.days.toFixed(1).padStart(12) + pct(best.outright).padStart(12) + `   ${(best.lo * 100).toFixed(0)}-${(best.hi * 100).toFixed(0)}`.padEnd(13) + bp.padEnd(13) + best.days.toFixed(0).padStart(6) + best.trips.toFixed(1).padStart(7) + best.trade.toFixed(2).padStart(7));
			}
		}
	}
})();
