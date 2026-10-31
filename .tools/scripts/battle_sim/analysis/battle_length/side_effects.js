// What else the damage settings change: small and uneven battles, stack wipes, how far quality decides a battle, how much of a big stack gets used.
//   node side_effects.js [battles, default 600]
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D };
const N = (isMainThread ? +process.argv[2] : workerData.N) || 600;
const GEN = { adm: 60, dip: 59, mil: 61 };
const SET = [
	['vanilla', {}],
	['both x2', { DAMAGE_MULT: 0.24 }],
	['both x3', { DAMAGE_MULT: 0.36 }],
	['morale x3 + strength x2.5', { MOR_MOD: 0.75, STR_MOD: 0.10 }],
	['morale x4 + strength x3', { MOR_MOD: 1, STR_MOD: 0.12 }],
	['both x4', { DAMAGE_MULT: 0.48 }],
	['morale x5 + strength x4', { MOR_MOD: 1.25, STR_MOD: 0.16 }],
];
const q = { moraleMod: .3 };
const army = (u, n, c = q) => ({ general: GEN, country: c, units: [{ type: u, count: n, experience: 50 }] });
const SCN = [
	['Infantry 10 v 10', 'generic:hi:5', 10, 10, null],
	['Infantry 30 v 30', 'generic:hi:5', 30, 30, null],
	['Infantry 30 v 15 (2:1)', 'generic:hi:5', 30, 15, null],
	['Infantry 40 v 15 (2.7:1)', 'generic:hi:5', 40, 15, null],
	['Infantry 60 v 20 (3:1)', 'generic:hi:5', 60, 20, null],
	['Cavalry 30 v 30', 'generic:hc:3', 30, 30, null],
	['Cavalry 40 v 15 (2.7:1)', 'generic:hc:3', 40, 15, null],
	['Infantry 30 v 30, +5% discipline', 'generic:hi:5', 30, 30, { ...q, discipline: 0.05 }],
	['Infantry 120 v 120, +5% discipline', 'generic:hi:5', 120, 120, { ...q, discipline: 0.05 }],
	['Cavalry 30 v 30, +5% discipline', 'generic:hc:3', 30, 30, { ...q, discipline: 0.05 }],
];
function run([, u, a, b, better]) {
	const A = better || q, scn0 = { location: { frontage: 10 }, attacker: { armies: [army(u, a, A)] }, defender: { armies: [army(u, b)] } }, scn1 = { location: { frontage: 10 }, attacker: { armies: [army(u, b)] }, defender: { armies: [army(u, a, A)] } };
	let w = 0, d = 0, wipe = 0, sh = 0, lostA = 0, lostB = 0, startA = 0, startB = 0, t = 0;
	for (let i = 0; i < N; i++) for (const [scn, s] of [[scn0, 0], [scn1, 1]]) {
		const r = S.simulateScenario(scn, { seed: 3000 + i * 2 + s });
		w += r.winner === s; d += r.days; wipe += r.overrun ? 1 : 0; sh += r.shattered ? 1 : 0; lostA += r.losses[s]; lostB += r.losses[1 - s]; startA += r.start[s]; startB += r.start[1 - s]; t++;
	}
	return { w: w / t, d: d / t, wipe: wipe / t, sh: sh / t, la: lostA / startA, lb: lostB / startB };
}
if (!isMainThread) {
	parentPort.on('message', ({ id, si, ci }) => { Object.assign(D, BASE, SET[si][1]); parentPort.postMessage({ id, r: run(SCN[ci]) }); });
} else {
	const jobs = SET.flatMap((_, si) => SCN.map((__, ci) => ({ si, ci })));
	const threads = Math.min(jobs.length, +process.env.EU5_THREADS || Math.max(1, os.cpus().length - 2));
	const workers = Array.from({ length: threads }, () => new Worker(__filename, { workerData: { N } }));
	const out = new Array(jobs.length);
	let next = 0, left = jobs.length;
	const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, ...jobs[next] }); next++; } };
	const p = x => `${(x * 100).toFixed(0)}%`;
	for (const w of workers) {
		w.on('error', e => { throw e; });
		w.on('message', m => {
			out[m.id] = m.r;
			if (--left === 0) {
				workers.forEach(x => x.terminate());
				console.log(`(${N * 2} battles a cell, both seats, +30% morale, 50 exp, generals 60/59/61, frontage 10.) First side named is the bigger or better one; lost = share of its men, then of the other side's.`);
				SCN.forEach(([sn], ci) => {
					console.log(`\n=== ${sn}`);
					console.log('setting'.padEnd(30) + 'days'.padStart(7) + 'first wins'.padStart(12) + 'wiped'.padStart(8) + 'shattered'.padStart(11) + 'lost'.padStart(7) + 'lost'.padStart(7));
					SET.forEach(([name], si) => { const r = out[si * SCN.length + ci]; console.log(name.padEnd(30) + r.d.toFixed(1).padStart(7) + p(r.w).padStart(12) + p(r.wipe).padStart(8) + p(r.sh).padStart(11) + p(r.la).padStart(7) + p(r.lb).padStart(7)); });
				});
			} else feed(w);
		});
		feed(w);
	}
}
