// Which land damage setting keeps numbers counting at 6 and 7 armies? Length of 6 v 6, 7 v 5 with the bigger side, 6 v 7 with the smaller side at +5% discipline.
//   node big_settings.js [battles a seat, default 300]
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D };
const N = (isMainThread ? +process.argv[2] : workerData.N) || 300;
const GEN = { adm: 60, dip: 59, mil: 61 }, q = { moraleMod: .3 };
const SET = [
	['vanilla', 0.04, 0.25],
	['both x1.5', 0.06, 0.375],
	['both x2 (now)', 0.08, 0.5],
	['both x2.5', 0.1, 0.625],
	['both x3', 0.12, 0.75],
	['morale x3, strength x2', 0.08, 0.75],
	['morale x4, strength x3', 0.12, 1],
	['morale x2, strength x3', 0.12, 0.5],
	['morale x1.5, strength x3', 0.12, 0.375],
	['strength x3 only', 0.12, 0.25],
];
const UNITS = [['Infantry II', 'generic:hi:2'], ['Infantry V', 'generic:hi:5'], ['Cavalry III', 'generic:hc:3']];
const side = (u, k, c) => ({ armies: Array.from({ length: k }, () => ({ general: GEN, country: c, units: [{ type: u, count: 30, experience: 50 }] })) });
function cell(u, a, b, ca) {
	const A = side(u, a, ca), B = side(u, b, q);
	let w = 0, d = 0, lost = 0, start = 0, left = 0, regs = 0, t = 0;
	for (let i = 0; i < N; i++) for (const s of [0, 1]) {
		const r = S.simulateScenario({ location: { frontage: 10 }, attacker: s ? B : A, defender: s ? A : B }, { seed: 5000 + i * 2 + s });
		w += r.winner === s ? 1 : 0; d += r.days; lost += r.losses[0] + r.losses[1]; start += r.start[0] + r.start[1]; t++;
		const loser = r.winner < 0 ? null : 1 - r.winner, last = r.timeline[r.timeline.length - 1];
		if (loser != null && last) { left += last.reserve[loser]; regs += (loser === s ? a : b) * 30; }
	}
	return { w: w / t, d: d / t, lost: lost / start, left: regs ? left / regs : 0 };
}
if (!isMainThread) {
	parentPort.on('message', ({ id, si, ui }) => {
		Object.assign(D, BASE, { STR_MOD: SET[si][1], MOR_MOD: SET[si][2] });
		const u = UNITS[ui][1];
		parentPort.postMessage({ id, r: { even: cell(u, 6, 6, q), big: cell(u, 7, 5, q), quality: cell(u, 6, 7, { ...q, discipline: 0.05 }) } });
	});
} else {
	const jobs = UNITS.flatMap((_, ui) => SET.map((__, si) => ({ ui, si }))), res = [];
	const workers = Array.from({ length: Math.min(jobs.length, +process.env.EU5_THREADS || os.cpus().length) }, () => new Worker(__filename, { workerData: { N } }));
	let next = 0, left = jobs.length;
	const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, ...jobs[next] }); next++; } };
	const p = x => `${(x * 100).toFixed(0)}%`;
	for (const w of workers) {
		w.on('error', e => { throw e; });
		w.on('message', m => {
			res[m.id] = m.r;
			if (--left) return feed(w);
			workers.forEach(x => x.terminate());
			console.log(`${N * 2} battles a cell, both seats. Armies of 30 regiments, +30% morale, 50 experience, frontage 10. Reserve = the loser's regiments still waiting when 6 v 6 ended.`);
			UNITS.forEach(([un], ui) => {
				console.log(`\n=== ${un}`);
				console.log('setting'.padEnd(32) + '6v6 days'.padStart(9) + 'lost'.padStart(6) + 'reserve'.padStart(9) + '7v5 wins'.padStart(10) + '6v7 +5% wins'.padStart(14));
				SET.forEach(([sn], si) => { const r = res[ui * SET.length + si]; console.log(sn.padEnd(32) + r.even.d.toFixed(0).padStart(9) + p(r.even.lost).padStart(6) + p(r.even.left).padStart(9) + p(r.big.w).padStart(10) + p(r.quality.w).padStart(14)); });
			});
		});
		feed(w);
	}
}
