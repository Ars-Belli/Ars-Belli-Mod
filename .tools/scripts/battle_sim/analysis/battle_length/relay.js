// Army relay against a side that stays in. See README.md. Library for the tables in this folder; run alone it prints a policy sweep.
//   const { runCells, D } = require('./relay.js');
//   const rows = await runCells([{ kind: 'relay', o, cfg, seed, n, over }, ...]);   // over = changes to engine D for that job
// kind 'relay': a side (cfg null = control) against plain armies, both seats. kind 'allin': both sides commit everything.
// EU5_THREADS=n caps the workers; while the game is being played leave it 8 cores. Priority: engine.js sets the lowest.
const os = require('os');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D };
const GEN = { adm: 60, dip: 59, mil: 61 };
const mk = (u, n, c, e, x = {}) => ({ general: GEN, country: c, units: [{ type: u, count: n, experience: e }], ...x });
const mku = (u, n, c, e, g) => ({ general: GEN, country: c, units: [{ type: u, count: n, experience: e, ...g }] });
const avg = (a, f) => a.reduce((t, x) => t + f(x), 0) / a.length;

// One engagement: the battle, then, if side s lost it with armies still away, those armies against the worn-out winner.
// That second fight flatters holding armies back, because the winner never reacts, so quote `outright`.
function engagement(o, cfg, seed, s) {
	const { u, n, k, c, e, frontage = 10 } = o;
	const mine = Array.from({ length: k }, (_, j) => mk(u, n, c, e, cfg && cfg.relay && j >= cfg.start ? { arrivalDay: 99999 } : {}));
	const plain = Array.from({ length: k }, () => mk(u, n, c, e));
	const scn = { location: { frontage }, attacker: { armies: s === 0 ? mine : plain }, defender: { armies: s === 0 ? plain : mine } };
	const r1 = S.simulateScenario(scn, { seed, rotate: cfg ? (s ? [null, cfg] : [cfg, null]) : null });
	const out = { win: r1.winner === s ? 1 : r1.winner < 0 ? .5 : 0, days: r1.days, trips: cfg ? r1.trips[s] : 0, lostA: r1.losses[s], lostB: r1.losses[1 - s], stage2: 0, outright: r1.winner === s ? 1 : 0 };
	if (!cfg || r1.winner === s) return out;
	const info = r1.awayInfo[s];
	if (!info.length) return out;
	const backDay = Math.max(...info.map(x => x.back));
	const gap = Math.max(0, backDay - r1.days);
	const rested = info.map(x => {
		const regs = r1.state[s][x.j].filter(r => r.sec === 'away' || r.sec === 'absent');
		if (!regs.length) return null;
		const gain = x.fresh ? -cfg.march * D.MOVEMENT_COST : x.rest * cfg.recovery - 2 * cfg.march * D.MOVEMENT_COST;
		return mku(u, regs.length, c, e, { strength: Math.min(1, avg(regs, r => r.s) + (x.fill ? D.MONTHLY_REINFORCE : 0)), morale: Math.min(1, Math.max(0, avg(regs, r => r.m) + gain)) });
	}).filter(Boolean);
	const foes = r1.state[1 - s].map(regs => { const a = regs.filter(r => r.sec !== 'absent'); return a.length ? mku(u, a.length, c, e, { strength: avg(a, r => r.s), morale: Math.min(1, avg(a, r => r.m) + gap * 0.05) }) : null; }).filter(Boolean);
	if (!rested.length || !foes.length) return out;
	const r2 = S.simulateScenario({ location: { frontage }, attacker: { armies: rested }, defender: { armies: foes } }, { seed: seed + 500000 });
	out.stage2 = 1; out.win = r2.winner === 0 ? 1 : r2.winner < 0 ? .5 : 0; out.days = Math.max(r1.days, backDay) + r2.days; out.lostA += r2.losses[0]; out.lostB += r2.losses[1];
	return out;
}
function cell(o, cfg, seed, n) {
	let w = 0, t = 0, d = 0, tr = 0, la = 0, lb = 0, st = 0, ow = 0;
	for (let i = 0; i < n; i++) for (const s of [0, 1]) { const r = engagement(o, cfg, seed + i * 2 + s, s); w += r.win; d += r.days; tr += r.trips; la += r.lostA; lb += r.lostB; st += r.stage2; ow += r.outright; t++; }
	const se = 1.96 * Math.sqrt(ow / t * (1 - ow / t) / t);
	return { win: w / t, ci: S.wilson(w, t), days: d / t, trips: tr / t, trade: lb / (la || 1), stage2: st / t, outright: ow / t, lo: Math.max(0, ow / t - se), hi: Math.min(1, ow / t + se) };
}
function allIn(o, seed, n) {
	const a = () => ({ armies: Array.from({ length: o.k }, () => mk(o.u, o.n, o.c, o.e)) });
	const scn = { location: { frontage: o.frontage || 10 }, attacker: a(), defender: a() };
	let d = 0, lost = 0, start = 0, sh = 0, ov = 0, mx = 0;
	for (let i = 0; i < n; i++) {
		const r = S.simulateScenario(scn, { seed: seed + i });
		d += r.days; mx = Math.max(mx, r.days); lost += r.losses[0] + r.losses[1]; start += r.start[0] + r.start[1]; sh += r.shattered ? 1 : 0; ov += r.overrun ? 1 : 0;
	}
	return { days: d / n, maxDays: mx, lost: lost / start, sh: sh / n, ov: ov / n };
}
const runJob = job => {
	for (const k of Object.keys(D)) if (!(k in BASE)) delete D[k];
	Object.assign(D, BASE, job.over || {});
	return job.kind === 'allin' ? allIn(job.o, job.seed, job.n) : cell(job.o, job.cfg, job.seed, job.n);
};

if (!isMainThread) parentPort.on('message', ({ id, job }) => parentPort.postMessage({ id, result: runJob(job) }));

function runCells(jobs) {
	const threads = Math.min(jobs.length, +process.env.EU5_THREADS || Math.max(1, os.cpus().length - 2));
	return new Promise((done, fail) => {
		const out = new Array(jobs.length), workers = Array.from({ length: threads }, () => new Worker(__filename));
		let next = 0, left = jobs.length;
		const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, job: jobs[next] }); next++; } };
		for (const w of workers) {
			w.on('error', fail);
			w.on('message', ({ id, result }) => {
				out[id] = result;
				if (--left === 0) { workers.forEach(x => x.terminate()); done(out); } else feed(w);
			});
			feed(w);
		}
	});
}

const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
module.exports = { runCells, D, BASE, S, pct };

if (isMainThread && require.main === module) (async () => {
	const N = +process.argv[2] || 60;
	const q = { moraleMod: .3 };
	const SCN = [['Inf V 4x30', { u: 'generic:hi:5', n: 30, k: 4, c: q, e: 50 }], ['Inf V 6x20', { u: 'generic:hi:5', n: 20, k: 6, c: q, e: 50 }], ['Cav III 4x30', { u: 'generic:hc:3', n: 30, k: 4, c: q, e: 50 }]];
	const POL = [[0, 0]]; for (const start of [2, 3, 4]) for (const th of [0.3, 0.5, 0.7]) POL.push([start, th]);
	const jobs = SCN.flatMap(([, o]) => POL.map(([start, th]) => ({ kind: 'relay', o, cfg: start ? { relay: true, start, threshold: th, target: 0.9, maxRest: 25, march: 3, recovery: 0.0625, friendly: true } : null, seed: start ? 9000 : 8000, n: N })));
	const res = await runCells(jobs);
	console.log('Relay vs all-in. win% whole engagement / won battle outright / trade (their losses per ours) / days / swaps. March 3, own territory');
	SCN.forEach(([label], a) => {
		console.log('-- ' + label);
		POL.forEach(([start, th], b) => {
			const r = res[a * POL.length + b];
			console.log((start ? `  ${start} in, swap <${th}` : '  all-in control').padEnd(24) + pct(r.win, 0).padStart(5) + pct(r.outright, 0).padStart(6) + r.trade.toFixed(2).padStart(7) + r.days.toFixed(0).padStart(6) + r.trips.toFixed(1).padStart(6));
		});
	});
})();
