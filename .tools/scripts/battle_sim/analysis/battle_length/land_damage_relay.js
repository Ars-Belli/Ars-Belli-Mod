// Land damage settings with slower armies, 2026-11-01 MP playtest: days, men lost, shattered, wipes, then the relay's outright win rate. Baseline is vanilla (relay.js).
//   node land_damage_relay.js [battles a seat, default 240]
// Both land damage modifiers x k is the same as DAMAGE_MULT x k for land hits, so it is simulated that way; in the game set the two land modifiers, because COMBAT_DAMAGE_MULT also reaches sieges.
const { runCells, pct } = require('./relay.js');
const N = +process.argv[2] || 240;
const SCN = [
	['Infantry V, +30% morale, 50 exp', { u: 'generic:hi:5', n: 30, k: 4, c: { moraleMod: .3 }, e: 50, frontage: 10 }],
	['Veteran infantry V, +100% morale, 90 exp', { u: 'generic:hi:5', n: 30, k: 4, c: { moraleMod: 1 }, e: 90, frontage: 10 }],
	['Cavalry III, +30% morale, 50 exp', { u: 'generic:hc:3', n: 30, k: 4, c: { moraleMod: .3 }, e: 50, frontage: 10 }],
];
const LEVERS = [
	['vanilla', {}, 1],
	['morale x4 + strength x3', { MOR_MOD: 1, STR_MOD: 0.12 }, 1],
	['that, speed x0.75', { MOR_MOD: 1, STR_MOD: 0.12 }, 4 / 3],
	['both land damage x2', { MOR_MOD: 0.5, STR_MOD: 0.08 }, 1],
	['mod: x2, speed x0.75', { MOR_MOD: 0.5, STR_MOD: 0.08 }, 4 / 3],
	['speed x0.75', {}, 4 / 3],
	['both land damage x2/3', { DAMAGE_MULT: 0.08 }, 1],
	['both land damage x0.5', { DAMAGE_MULT: 0.06 }, 1],
	['both x2/3, speed x0.75', { DAMAGE_MULT: 0.08 }, 4 / 3],
	['both x0.5, speed x0.75', { DAMAGE_MULT: 0.06 }, 4 / 3],
];
(async () => {
	const jobs = SCN.flatMap(([, o]) => LEVERS.flatMap(([, over, t]) => [
		{ kind: 'allin', o, seed: 8000, n: N * 2, over },
		{ kind: 'relay', o, cfg: { relay: true, start: 3, threshold: 0.3, target: 0.9, maxRest: 40, march: Math.round(3 * t), recovery: 0.0625, friendly: true }, seed: 9000, n: N, over },
	]));
	const res = await runCells(jobs);
	SCN.forEach(([sn], a) => {
		console.log(`\n=== ${sn} (${N * 2} battles a cell)`);
		console.log('change'.padEnd(30) + 'days'.padStart(7) + 'men lost'.padStart(10) + 'shattered'.padStart(11) + 'wiped'.padStart(7) + '  relay outright (95%)'.padEnd(26) + 'relay days'.padStart(11) + 'swaps'.padStart(7) + 'trade'.padStart(7));
		LEVERS.forEach(([name], b) => {
			const c = res[(a * LEVERS.length + b) * 2], r = res[(a * LEVERS.length + b) * 2 + 1];
			console.log(name.padEnd(30) + c.days.toFixed(1).padStart(7) + pct(c.lost).padStart(10) + pct(c.sh, 0).padStart(11) + pct(c.ov, 0).padStart(7) + `   ${pct(r.outright)} (${(r.lo * 100).toFixed(0)}-${(r.hi * 100).toFixed(0)})`.padEnd(26) + r.days.toFixed(0).padStart(11) + r.trips.toFixed(1).padStart(7) + r.trade.toFixed(2).padStart(7));
		});
	});
})();
