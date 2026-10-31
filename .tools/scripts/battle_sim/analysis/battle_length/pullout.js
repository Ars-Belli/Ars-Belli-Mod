// Battle length by stack size, then plain pull-out rotation: a tired army leaves with no replacement waiting, rests, comes back.
//   node pullout.js [battles a seat, default 100]
const { runCells, pct } = require('./relay.js');
const N = +process.argv[2] || 100;
const Q = [['plain', {}, 0], ['+30% morale', { moraleMod: .3 }, 0], ['+30% morale 50 exp', { moraleMod: .3 }, 50]];
const STACKS = [[30, 1], [20, 3], [30, 3], [30, 4], [30, 5], [40, 5]];
const SWEEP = [['Inf V 3x30', 'generic:hi:5', 30, 3], ['Inf V 5x30', 'generic:hi:5', 30, 5], ['Cav III 3x30', 'generic:hc:3', 30, 3]];
const THRESH = [0.15, 0.25, 0.35, 0.5, 0.7], TARGET = [0.6, 0.9];
(async () => {
	const jobs = [];
	for (const [n, k] of STACKS) for (const [, c, e] of Q) jobs.push({ kind: 'allin', o: { u: 'generic:hi:5', n, k, c, e, frontage: 10 }, seed: 1000, n: N * 2 });
	for (const [, u, n, k] of SWEEP) for (const th of THRESH) for (const tg of TARGET) jobs.push({ kind: 'relay', o: { u, n, k, c: { moraleMod: .3 }, e: 50, frontage: 10 }, cfg: { threshold: th, target: tg, maxRest: 25, minLine: 12, march: 3, recovery: 0.0625, friendly: true }, seed: 5000, n: N });
	const res = await runCells(jobs);
	let at = 0;
	console.log('=== all-in battle length in days, infantry V, frontage 10 (the line holds 37.5 regiments): mean (max)');
	console.log('regiments a side'.padEnd(18) + Q.map(([x]) => x.padStart(22)).join(''));
	for (const [n, k] of STACKS) console.log(`${n * k} (${k}x${n})`.padEnd(18) + Q.map(() => { const r = res[at++]; return `${r.days.toFixed(1)} (${r.maxDays})`.padStart(22); }).join(''));
	console.log('\n=== pull-out policy sweep, +30% morale, 50 exp, one-way march 3: outright % / with follow-up % / days / trips / trade');
	for (const [label] of SWEEP) {
		console.log('-- ' + label);
		for (const th of THRESH) for (const tg of TARGET) {
			const r = res[at++];
			console.log(`  leave <${th} rest to ${tg}`.padEnd(28) + pct(r.outright, 0).padStart(6) + pct(r.win, 0).padStart(6) + r.days.toFixed(1).padStart(8) + r.trips.toFixed(1).padStart(6) + r.trade.toFixed(2).padStart(7));
		}
	}
})();
