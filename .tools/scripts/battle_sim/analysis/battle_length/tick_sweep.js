// What is finer battle ticking worth? The engine's "day" is one combat tick, so a config rescales the per-tick numbers.
// "ticks" is how many steps make one calendar day; reported days = steps / ticks. Unit data is 1.4 for every row, so the 1.3 rows show the rules alone.
//   node tick_sweep.js [battles a seat, default 1200]
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D };
const N = (isMainThread ? +process.argv[2] : workerData.N) || 1200;
const GEN = { adm: 60, dip: 59, mil: 61 };
const pp = (p, n) => 1 - Math.pow(1 - Math.min(p, 0.999), 1 / n);
// a real engine with n ticks a day at 1.4's pace per day: impossible in a mod, measures granularity alone
const trueTicks = (n, phaseDays = 4) => ({ ticks: n, over: { DAMAGE_MULT: BASE.DAMAGE_MULT / n, DAILY_MORALE: BASE.DAILY_MORALE / n, DAYS_PER_PHASE: Math.max(1, Math.round(phaseDays * n)), MIN_DAYS: BASE.MIN_DAYS * n, BOMBARD_DAYS: BASE.BOMBARD_DAYS * n, INIT_BASE: pp(BASE.INIT_BASE, n), INIT_EACH: BASE.INIT_EACH / n, INIT_MAX: BASE.INIT_MAX / n, INIT_DAY: BASE.INIT_DAY / n / n, SPEED_SCALE: BASE.SPEED_SCALE / n, MAX_DAYS: 400 * n } });
const rules13 = phase => ({ ticks: 12, over: { ...S.RULES_13, DAYS_PER_PHASE: phase } });
const defs = over => ({ ticks: 1, over });
const CONFIGS = [
	['1.4 (1 tick a day, dice every 4 days)', defs({})],
	['ENGINE: 12 ticks a day, dice every 4 days', trueTicks(12, 4)],
	['1.3 rules: 12 ticks a day, dice every 5 ticks', rules13(5)],
	['1.3 rules: 12 ticks a day, dice every 3 ticks', rules13(3)],
	['DEFINES: DAYS_PER_PHASE 3', defs({ DAYS_PER_PHASE: 3 })],
	['DEFINES: DAYS_PER_PHASE 2', defs({ DAYS_PER_PHASE: 2 })],
	['DEFINES: DAYS_PER_PHASE 1', defs({ DAYS_PER_PHASE: 1 })],
];
const SCN = [['Inf age V, 30v30', 'generic:hi:5', 30], ['Inf age V, 60v60', 'generic:hi:5', 60], ['Cav age III, 30v30', 'generic:hc:3', 30]];
const army = (unit, n, country) => ({ general: GEN, country, units: [{ type: unit, count: n }] });
function run(unit, n, disc) {
	const better0 = { location: { frontage: 10 }, attacker: { armies: [army(unit, n, { discipline: disc })] }, defender: { armies: [army(unit, n, {})] } };
	const better1 = { location: { frontage: 10 }, attacker: { armies: [army(unit, n, {})] }, defender: { armies: [army(unit, n, { discipline: disc })] } };
	let w = 0, d = 0, d2 = 0, tot = 0, lossB = 0, lossW = 0;
	for (let i = 0; i < N; i++) for (const [scn, side] of [[better0, 0], [better1, 1]]) {
		const r = S.simulateScenario(scn, { seed: 1000 + i * 2 + side });
		if (r.winner === side) w++; else if (r.winner < 0) w += 0.5;
		d += r.days; d2 += r.days * r.days; tot++; lossB += r.losses[side]; lossW += r.losses[1 - side];
	}
	return { win: w / tot, ci: S.wilson(w, tot), meanSteps: d / tot, sd: Math.sqrt(Math.max(0, d2 / tot - (d / tot) ** 2)), trade: lossW / (lossB || 1) };
}
if (!isMainThread) {
	parentPort.on('message', ({ id, si, ci }) => {
		for (const k of Object.keys(D)) if (!(k in BASE)) delete D[k];
		Object.assign(D, BASE, CONFIGS[ci][1].over);
		const [, unit, n] = SCN[si];
		parentPort.postMessage({ id, a: run(unit, n, 0.05), b: run(unit, n, 0.10), phase: D.DAYS_PER_PHASE });
	});
} else {
	const jobs = SCN.flatMap((_, si) => CONFIGS.map((__, ci) => ({ si, ci })));
	const threads = Math.min(jobs.length, +process.env.EU5_THREADS || Math.max(1, os.cpus().length - 2));
	const workers = Array.from({ length: threads }, () => new Worker(__filename, { workerData: { N } }));
	const out = new Array(jobs.length);
	let next = 0, left = jobs.length;
	const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, ...jobs[next] }); next++; } };
	const fmt = r => `${(r.win * 100).toFixed(1)} (${(r.ci[0] * 100).toFixed(1)}-${(r.ci[1] * 100).toFixed(1)})`;
	const report = () => {
		SCN.forEach(([sn], si) => {
			console.log(`\n=== ${sn}  (${N * 2} battles a cell, both seat orders; generals 60/59/61, frontage 10)`);
			console.log('config'.padEnd(48) + 'days'.padStart(7) + 'sd'.padStart(6) + 'ticks'.padStart(7) + 'dice'.padStart(6) + '  win% +5% disc     win% +10% disc    trade +5%');
			CONFIGS.forEach(([name, cfg], ci) => {
				const { a, b, phase } = out[si * CONFIGS.length + ci];
				console.log(name.padEnd(48) + (a.meanSteps / cfg.ticks).toFixed(1).padStart(7) + (a.sd / cfg.ticks).toFixed(1).padStart(6) + a.meanSteps.toFixed(0).padStart(7) + (a.meanSteps / phase).toFixed(1).padStart(6) + '  ' + fmt(a).padEnd(17) + fmt(b).padEnd(18) + a.trade.toFixed(2));
			});
		});
	};
	for (const w of workers) {
		w.on('error', e => { throw e; });
		w.on('message', m => { out[m.id] = m; if (--left === 0) { workers.forEach(x => x.terminate()); report(); } else feed(w); });
		feed(w);
	}
}
