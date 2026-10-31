// Runs Monte Carlo battles on several cores (Node worker_threads).
//   const pool = require('./pool.js')(threads);          // threads default: cores - 2
//   const m = await pool.mc(scenario, n, { seed, patch });  // merged result, same as monteCarloScenario
//   await pool.close();
// A run is split into chunks; chunk k starts at seed + its first battle index, so a seeded run gives exactly the
// single-thread result. opts.patch = { CAT: { hc: { dt: 0.5 } }, D: { BOMBARD_CHANCE: 0.4 } } changes rules for that
// job only (the worker resets them before every job).
const path = require('path');
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');

if (!isMainThread) {
	const S = require('./engine.js');
	S.setUnitDB(require(process.env.EU5_UNITS || './units.json'));
	const pristine = JSON.parse(JSON.stringify({ CAT: S.CAT, D: S.D }));
	parentPort.on('message', ({ id, scn, n, opts, kind }) => {
		for (const k of Object.keys(S.CAT)) { for (const f of Object.keys(S.CAT[k])) delete S.CAT[k][f]; Object.assign(S.CAT[k], JSON.parse(JSON.stringify(pristine.CAT[k]))); }
		Object.assign(S.D, pristine.D);
		const patch = opts.patch || {};
		for (const [k, v] of Object.entries(patch.CAT || {})) Object.assign(S.CAT[k], v);
		Object.assign(S.D, patch.D || {});
		if (kind === 'war') {
			const out = [];
			for (let k = 0; k < n; k++) { const w = S.simulateWar(scn, opts.war, opts.seed != null ? opts.seed + k : undefined); delete w.trace; out.push(w); }
			parentPort.postMessage({ id, result: out });
		} else parentPort.postMessage({ id, result: S.monteCarloScenario(scn, n, { seed: opts.seed }) });
	});
} else {
	// EU5_THREADS=n caps the workers and drops to below-normal priority, for runs while the game is being played
	if (process.env.EU5_THREADS) { try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) {} }
	module.exports = (threads = +process.env.EU5_THREADS || Math.max(1, os.cpus().length - 2)) => {
		const S = require('./engine.js');
		const workers = Array.from({ length: threads }, () => new Worker(__filename));
		const idle = [...workers], queue = [], pending = new Map();
		let nextId = 0;
		const pump = () => {
			while (idle.length && queue.length) {
				const w = idle.pop(), job = queue.shift();
				pending.set(job.id, { job, w });
				w.postMessage({ id: job.id, scn: job.scn, n: job.n, opts: job.opts, kind: job.kind });
			}
		};
		for (const w of workers) w.on('message', ({ id, result }) => {
			const p = pending.get(id); pending.delete(id); idle.push(w); p.job.resolve(result); pump();
		});
		const run = (scn, n, opts, kind) => new Promise(resolve => { queue.push({ id: nextId++, scn, n, opts, kind, resolve }); pump(); });
		return {
			threads,
			async mc(scn, n, opts = {}) {
				const chunks = Math.max(1, Math.min(threads * 2, Math.floor(n / 50)));
				const parts = [];
				for (let c = 0, start = 0; c < chunks; c++) {
					const k = Math.floor(n / chunks) + (c < n % chunks ? 1 : 0);
					parts.push(run(scn, k, { ...opts, seed: opts.seed != null ? opts.seed + start : undefined }));
					start += k;
				}
				return S.mergeMC(await Promise.all(parts));
			},
			// n sampled wars (simulateWar), split across the workers; returns summarizeWars of all of them (patch: as for mc)
			async wars(scn, n, war, seed, patch) {
				const chunks = Math.max(1, Math.min(threads * 2, Math.floor(n / 10)));
				const parts = [];
				for (let c = 0, start = 0; c < chunks; c++) {
					const k = Math.floor(n / chunks) + (c < n % chunks ? 1 : 0);
					parts.push(run(scn, k, { war, patch, seed: seed != null ? seed + start : undefined }, 'war'));
					start += k;
				}
				return S.summarizeWars((await Promise.all(parts)).flat());
			},
			close: () => Promise.all(workers.map(w => w.terminate())),
		};
	};
}
