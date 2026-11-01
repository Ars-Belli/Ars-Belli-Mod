// Why does a bigger stack of age V infantry not win more? A reserve regiment joins the line with a daily chance of combat speed x 0.1, and heavy infantry has speed 2.
// Tests faster reserves, then holding armies next door until the reserve runs out. All at the mod's land damage, both x2.
//   node reserve_speed.js [battles a seat, default 300]
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D }, CAT = S.CAT;
const N = (isMainThread ? +process.argv[2] : workerData.N) || 300;
const GEN = { adm: 60, dip: 59, mil: 61 }, q = { moraleMod: .3 };
const LEVERS = [
	['before: heavy infantry 2', 2, 0.1],
	['now: heavy infantry 2.25', 2.25, 0.1],
	['heavy infantry 2.5', 2.5, 0.1],
	['heavy infantry 3', 3, 0.1],
	['heavy infantry 4', 4, 0.1],
	['heavy infantry 5, like cavalry', 5, 0.1],
	['every unit x1.5', 2, 0.15],
	['every unit x2', 2, 0.2],
];
const UNITS = [
	['Infantry II', [['generic:hi:2', 30]]],
	['Infantry V', [['generic:hi:5', 30]]],
	['Mixed V: 20 infantry, 6 cavalry, 4 artillery', [['generic:hi:5', 20], ['generic:hc:5', 6], ['generic:art:5', 4]]],
	['Cavalry III', [['generic:hc:3', 30]]],
];
// light infantry: combat speed 3 in vanilla. Levies are mostly light infantry
const LIGHT = [
	['Light infantry II', [['generic:li:2', 30]]],
	['Light infantry IV', [['generic:li:4', 30]]],
	['Light infantry V', [['generic:li:5', 30]]],
	['Light infantry levy II', [['generic:li:2', 30, true]]],
	['Age V: 20 heavy, 10 light infantry', [['generic:hi:5', 20], ['generic:li:5', 10]]],
];
const LIGHT_SPEED = [3, 3.375, 4];
const HOLD = [['all 7 on day 0', 7], ['5 in, 2 next door', 5], ['4 in, 3 next door', 4], ['3 in, 4 next door', 3], ['2 in, 5 next door', 2]];
const army = (units, c, arrivalDay) => ({ general: GEN, country: c, ...(arrivalDay ? { arrivalDay } : {}), units: units.map(([type, count, levy]) => ({ type, count, experience: 50, ...(levy ? { levy: true } : {}) })) });
const side = (units, k, c, inNow = k) => ({ armies: Array.from({ length: k }, (_, j) => army(units, c, j >= inNow ? 'needed' : 0)) });
function cell(A, B) {
	let w = 0, d = 0, lost = 0, start = 0, left = 0, regs = 0, t = 0;
	const size = x => x.armies.reduce((n, a) => n + a.units.reduce((m, g) => m + g.count, 0), 0);
	for (let i = 0; i < N; i++) for (const s of [0, 1]) {
		const r = S.simulateScenario({ location: { frontage: 10 }, attacker: s ? B : A, defender: s ? A : B }, { seed: 6000 + i * 2 + s });
		w += r.winner === s ? 1 : 0; d += r.days; lost += r.losses[0] + r.losses[1]; start += r.start[0] + r.start[1]; t++;
		const loser = r.winner < 0 ? null : 1 - r.winner, last = r.timeline[r.timeline.length - 1];
		if (loser != null && last) { left += last.reserve[loser]; regs += size(loser === s ? A : B); }
	}
	return { w: w / t, d: d / t, lost: lost / start, left: regs ? left / regs : 0 };
}
function set(cs, scale) { Object.assign(D, BASE, { SPEED_SCALE: scale }); CAT.hi.cs = cs; }
if (!isMainThread) {
	const baseCs = CAT.hi.cs;
	parentPort.on('message', job => {
		let r;
		if (job.kind === 'light') {
			const u = LIGHT[job.ui][1];
			set(2.25, 0.1); CAT.li.cs = LIGHT_SPEED[job.si];
			r = { even: cell(side(u, 6, q), side(u, 6, q)), six: cell(side(u, 7, q), side(u, 6, q)), five: cell(side(u, 7, q), side(u, 5, q)), quality: cell(side(u, 6, { ...q, discipline: 0.05 }), side(u, 7, q)) };
			CAT.li.cs = 3;
		} else if (job.kind === 'lever') {
			const [, cs, scale] = LEVERS[job.li], u = UNITS[job.ui][1];
			set(cs, scale);
			r = { even: cell(side(u, 6, q), side(u, 6, q)), six: cell(side(u, 7, q), side(u, 6, q)), five: cell(side(u, 7, q), side(u, 5, q)), quality: cell(side(u, 6, { ...q, discipline: 0.05 }), side(u, 7, q)) };
		} else {
			const u = UNITS[job.ui][1];
			set(baseCs, BASE.SPEED_SCALE);
			r = cell(side(u, 7, q, HOLD[job.hi][1]), side(u, job.foe, q));
		}
		parentPort.postMessage({ id: job.id, r });
	});
} else (async () => {
	const jobs = [
		...UNITS.flatMap((_, ui) => LEVERS.map((__, li) => ({ kind: 'lever', ui, li }))),
		...LIGHT.flatMap((_, ui) => LIGHT_SPEED.map((__, si) => ({ kind: 'light', ui, si }))),
		...[1, 2].flatMap(ui => [5, 6].flatMap(foe => HOLD.map((_, hi) => ({ kind: 'hold', ui, foe, hi })))),
	];
	const tick = require('../../progress.js')(jobs.length, 'cells');
	const res = await new Promise((done, fail) => {
		const out = new Array(jobs.length), workers = Array.from({ length: Math.min(jobs.length, +process.env.EU5_THREADS || os.cpus().length) }, () => new Worker(__filename, { workerData: { N } }));
		let next = 0, left = jobs.length;
		const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, ...jobs[next] }); next++; } };
		for (const w of workers) {
			w.on('error', fail);
			w.on('message', m => { out[m.id] = m.r; tick(); if (--left === 0) { workers.forEach(x => x.terminate()); done(out); } else feed(w); });
			feed(w);
		}
	});
	const p = x => `${(x * 100).toFixed(0)}%`, get = f => res[jobs.findIndex(f)];
	console.log(`${N * 2} battles a cell, both seats, both land damage x2. Armies of 30 regiments, +30% morale, 50 experience, generals 60/59/61, frontage 10. Reserve = the loser's regiments still waiting when 6 v 6 ended.`);
	console.log('A reserve joins the line with a daily chance of combat speed x 0.1 x (1 + modifiers). Heavy infantry 2 is unit_categories/01_army_heavy_infantry.txt, every unit x2 is NCombat.COMBAT_SPEED_SCALE 0.2.');
	UNITS.forEach(([un], ui) => {
		console.log(`\n=== ${un}`);
		console.log('combat speed'.padEnd(32) + '6v6 days'.padStart(9) + 'lost'.padStart(6) + 'reserve'.padStart(9) + '7v6 wins'.padStart(10) + '7v5 wins'.padStart(10) + '6v7 +5% wins'.padStart(14));
		LEVERS.forEach(([ln], li) => { const r = get(j => j.kind === 'lever' && j.ui === ui && j.li === li); console.log(ln.padEnd(32) + r.even.d.toFixed(0).padStart(9) + p(r.even.lost).padStart(6) + p(r.even.left).padStart(9) + p(r.six.w).padStart(10) + p(r.five.w).padStart(10) + p(r.quality.w).padStart(14)); });
	});
	console.log('\n=== Light infantry at each combat speed, heavy infantry 2.25');
	console.log('unit, light combat speed'.padEnd(44) + '6v6 days'.padStart(9) + 'lost'.padStart(6) + 'reserve'.padStart(9) + '7v6 wins'.padStart(10) + '7v5 wins'.padStart(10) + '6v7 +5% wins'.padStart(14));
	LIGHT.forEach(([un], ui) => LIGHT_SPEED.forEach((sp, si) => { const r = get(j => j.kind === 'light' && j.ui === ui && j.si === si); console.log(`${si ? '' : un}`.padEnd(38) + String(sp).padEnd(6) + r.even.d.toFixed(0).padStart(9) + p(r.even.lost).padStart(6) + p(r.even.left).padStart(9) + p(r.six.w).padStart(10) + p(r.five.w).padStart(10) + p(r.quality.w).padStart(14)); }));
	console.log('\n=== Holding armies next door until the reserve runs out, current combat speed. The side of 7 against an enemy with everything in on day 0');
	console.log('plan'.padEnd(24) + UNITS.slice(1, 3).flatMap(([n]) => [5, 6].map(f => `${n.split(':')[0]} v ${f}`.padEnd(24))).join(''));
	HOLD.forEach(([hn], hi) => console.log(hn.padEnd(24) + [1, 2].flatMap(ui => [5, 6].map(foe => { const r = get(j => j.kind === 'hold' && j.ui === ui && j.foe === foe && j.hi === hi); return `${p(r.w)}, ${r.d.toFixed(0)} days`.padEnd(24); })).join('')));

	// relay: same speed changes through the scale, which for pure infantry is the same as raising heavy infantry
	const { runCells, pct } = require('./relay.js');
	const RS = [['before: heavy infantry 2', 0.1], ['now: heavy infantry 2.25', 0.1125], ['heavy infantry 3', 0.15], ['heavy infantry 4', 0.2], ['heavy infantry 5', 0.25]];
	const O = [['Infantry V', { u: 'generic:hi:5', n: 30, k: 4, c: q, e: 50, frontage: 10 }], ['Veteran infantry V', { u: 'generic:hi:5', n: 30, k: 4, c: { moraleMod: 1 }, e: 90, frontage: 10 }]];
	const rr = await runCells(O.flatMap(([, o]) => RS.map(([, scale]) => ({ kind: 'relay', o, cfg: { relay: true, start: 3, threshold: 0.3, target: 0.9, maxRest: 40, march: 4, recovery: 0.0625, friendly: true }, seed: 9000, n: N, over: { STR_MOD: 0.08, MOR_MOD: 0.5, SPEED_SCALE: scale } }))));
	console.log(`\n=== Relay, 4 armies, 3 in and 1 away, armies 25% slower. ${N * 2} battles a cell, 50% means no edge`);
	O.forEach(([n], a) => RS.forEach(([ln], b) => { const r = rr[a * RS.length + b]; console.log(`${n}, ${ln}`.padEnd(44) + `${pct(r.outright)} (${(r.lo * 100).toFixed(0)}-${(r.hi * 100).toFixed(0)})`.padEnd(20) + `${r.days.toFixed(0)} days`); }));
})();
