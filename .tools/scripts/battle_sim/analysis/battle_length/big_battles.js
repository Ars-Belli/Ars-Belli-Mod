// 6 and 7 armies of 30 regiments a side, before (mod.27: vanilla damage and speed) against now (both land damage x2, armies x0.75):
// how long the battle runs, who wins, what it costs, how much of the stack gets to fight. Then the relay at the same sizes.
//   node big_battles.js [battles a seat, default 150]
const os = require('os');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const S = require('../../engine.js');
S.setUnitDB(require('../../units.json'));
const D = S.D, BASE = { ...D };
const N = (isMainThread ? +process.argv[2] : workerData.N) || 150;
const GEN = { adm: 60, dip: 59, mil: 61 };
const q = { moraleMod: .3 }, better = { ...q, discipline: 0.05 };
// t: how many times longer a march takes
const SET = [['before', { STR_MOD: 0.04, MOR_MOD: 0.25 }, 1], ['now', { STR_MOD: 0.08, MOR_MOD: 0.5 }, 4 / 3]];
const UNITS = [
	['Infantry II', [['generic:hi:2', 30]]],
	['Cavalry III', [['generic:hc:3', 30]]],
	['Infantry V', [['generic:hi:5', 30]]],
	['Mixed V: 20 infantry, 6 cavalry, 4 artillery', [['generic:hi:5', 20], ['generic:hc:5', 6], ['generic:art:5', 4]]],
];
const MATCH = [
	['6 v 6', { a: 6, b: 6 }],
	['7 v 7', { a: 7, b: 7 }],
	['7 v 6', { a: 7, b: 6 }],
	['7 v 5', { a: 7, b: 5 }],
	['6 v 6, first +5% discipline', { a: 6, b: 6, c: better }],
	['6 v 7, first +5% discipline', { a: 6, b: 7, c: better }],
	['6 v 6, frontage 5', { a: 6, b: 6, frontage: 5 }],
	['6 v 6, second arrives army by army', { a: 6, b: 6, gap: 5 }],
];
// the same 7:5 odds at growing size, in one stack each: where do numbers stop counting?
const SIZE = [[42, 30], [84, 60], [126, 90], [168, 120], [210, 150]];
const SIZE_UNITS = [['Infantry II', 'generic:hi:2'], ['Cavalry III', 'generic:hc:3'], ['Infantry V', 'generic:hi:5']];
const army = (units, c, arrivalDay) => ({ general: GEN, country: c, ...(arrivalDay ? { arrivalDay } : {}), units: units.map(([type, count]) => ({ type, count, experience: 50 })) });
const side = (units, k, c, gap) => ({ armies: Array.from({ length: k }, (_, j) => army(units, c, gap ? j * gap : 0)) });

function run(units, m, t) {
	const gap = m.gap ? Math.round(m.gap * t) : 0;
	const A = m.ra ? { armies: [army([[units, m.ra]], q)] } : side(units, m.a, m.c || q), B = m.rb ? { armies: [army([[units, m.rb]], q)] } : side(units, m.b, q, gap);
	const scns = [[{ location: { frontage: m.frontage || 10 }, attacker: A, defender: B }, 0], [{ location: { frontage: m.frontage || 10 }, attacker: B, defender: A }, 1]];
	let w = 0, wipe = 0, sh = 0, lostA = 0, lostB = 0, startA = 0, startB = 0, left = 0, regs = 0, tot = 0; const days = [];
	for (let i = 0; i < N; i++) for (const [scn, s] of scns) {
		const r = S.simulateScenario(scn, { seed: 7000 + i * 2 + s });
		w += r.winner === s ? 1 : 0; days.push(r.days); wipe += r.overrun ? 1 : 0; sh += r.shattered ? 1 : 0;
		lostA += r.losses[s]; lostB += r.losses[1 - s]; startA += r.start[s]; startB += r.start[1 - s];
		// regiments the loser still had waiting in reserve when the battle ended
		const loser = r.winner < 0 ? null : 1 - r.winner, last = r.timeline[r.timeline.length - 1];
		if (loser != null && last) { left += last.reserve[loser]; regs += m.ra ? (loser === s ? m.ra : m.rb) : (loser === s ? m.a : m.b) * 30; }
		tot++;
	}
	days.sort((x, y) => x - y);
	return { w: w / tot, d: days.reduce((x, y) => x + y, 0) / tot, p90: days[Math.floor(tot * .9)], wipe: wipe / tot, sh: sh / tot, la: lostA / startA, lb: lostB / startB, left: regs ? left / regs : 0 };
}

if (!isMainThread) {
	parentPort.on('message', ({ id, si, ui, mi, zi }) => { Object.assign(D, BASE, SET[si][1]); parentPort.postMessage({ id, r: zi == null ? run(UNITS[ui][1], MATCH[mi][1], SET[si][2]) : run(SIZE_UNITS[ui][1], { ra: SIZE[zi][0], rb: SIZE[zi][1] }, SET[si][2]) }); });
} else (async () => {
	const jobs = UNITS.flatMap((_, ui) => MATCH.flatMap((__, mi) => SET.map((___, si) => ({ ui, mi, si }))));
	const sizeFrom = jobs.length;
	jobs.push(...SIZE_UNITS.flatMap((_, ui) => SIZE.flatMap((__, zi) => SET.map((___, si) => ({ ui, zi, si })))));
	const tick = require('../../progress.js')(jobs.length, 'cells');
	const out = await new Promise((done, fail) => {
		const res = new Array(jobs.length), threads = Math.min(jobs.length, +process.env.EU5_THREADS || os.cpus().length);
		const workers = Array.from({ length: threads }, () => new Worker(__filename, { workerData: { N } }));
		let next = 0, left = jobs.length;
		const feed = w => { if (next < jobs.length) { w.postMessage({ id: next, ...jobs[next] }); next++; } };
		for (const w of workers) {
			w.on('error', fail);
			w.on('message', m => { res[m.id] = m.r; tick(); if (--left === 0) { workers.forEach(x => x.terminate()); done(res); } else feed(w); });
			feed(w);
		}
	});
	const p = x => `${(x * 100).toFixed(0)}%`;
	console.log(`${N * 2} battles a cell, both seats. Armies of 30 regiments, +30% morale, 50 experience, generals 60/59/61, frontage 10 unless named.`);
	console.log('before = mod.27, vanilla damage and speed. now = both land damage x2, armies x0.75. First side named is the one the win rate is for; lost = share of its men, then of the other side\'s.');
	console.log('reserve = the loser\'s regiments still waiting to fight when the battle ended. Army by army: one every 5 days before, 7 days now, because armies are slower.');
	UNITS.forEach(([un], ui) => {
		console.log(`\n=== ${un}`);
		console.log('matchup'.padEnd(38) + 'setting'.padEnd(8) + 'days'.padStart(7) + 'p90'.padStart(6) + 'first wins'.padStart(12) + 'lost'.padStart(7) + 'lost'.padStart(7) + 'shattered'.padStart(11) + 'wiped'.padStart(7) + 'reserve'.padStart(9));
		MATCH.forEach(([mn], mi) => SET.forEach(([sn], si) => {
			const r = out[(ui * MATCH.length + mi) * SET.length + si];
			console.log((si ? '' : mn).padEnd(38) + sn.padEnd(8) + r.d.toFixed(1).padStart(7) + String(r.p90).padStart(6) + p(r.w).padStart(12) + p(r.la).padStart(7) + p(r.lb).padStart(7) + p(r.sh).padStart(11) + p(r.wipe).padStart(7) + p(r.left).padStart(9));
		}));
	});

	console.log('');
	console.log("=== Same 7:5 odds at growing size, one stack each. Win rate of the bigger side, days, the loser's reserve left at the end");
	console.log('regiments'.padEnd(12) + SIZE_UNITS.flatMap(([n]) => SET.map(([st]) => (n + ' ' + st).padEnd(26))).join(''));
	SIZE.forEach(([x, y], zi) => console.log(`${x} v ${y}`.padEnd(12) + SIZE_UNITS.flatMap((_, ui) => SET.map((__, si) => { const r = out[sizeFrom + (ui * SIZE.length + zi) * SET.length + si]; return `${p(r.w)}, ${r.d.toFixed(0)} days, ${p(r.left)}`.padEnd(26); })).join('')));

	// relay at the same sizes: the study baseline in relay.js is vanilla, so "before" needs no override
	const { runCells, pct } = require('./relay.js');
	const REL = [['Infantry V', 'generic:hi:5'], ['Cavalry III', 'generic:hc:3']];
	const SIZES = [[6, 5, '6 armies, 1 held back'], [6, 4, '6 armies, 2 held back'], [7, 5, '7 armies, 2 held back']];
	const rj = REL.flatMap(([, u]) => SIZES.flatMap(([k, start]) => SET.map(([, over, t]) => ({ kind: 'relay', o: { u, n: 30, k, c: q, e: 50, frontage: 10 }, cfg: { relay: true, start, threshold: 0.3, target: 0.9, maxRest: 40, march: Math.round(3 * t), recovery: 0.0625, friendly: true }, seed: 9000, n: Math.ceil(N / 2), over }))));
	const rr = await runCells(rj);
	console.log(`\n=== Relay: one side rests armies a location away and swaps them in, the other commits everything. ${Math.ceil(N / 2) * 2} battles a cell. 50% means no edge. 3 days a location before, 4 now.`);
	console.log('case'.padEnd(36) + 'setting'.padEnd(8) + 'relay wins (95%)'.padEnd(20) + 'days'.padStart(6) + 'swaps'.padStart(7));
	REL.forEach(([un], a) => SIZES.forEach(([, , sn], b) => SET.forEach(([st], c) => {
		const r = rr[(a * SIZES.length + b) * SET.length + c];
		console.log((c ? '' : `${un}, ${sn}`).padEnd(36) + st.padEnd(8) + `${pct(r.outright)} (${(r.lo * 100).toFixed(0)}-${(r.hi * 100).toFixed(0)})`.padEnd(20) + r.days.toFixed(0).padStart(6) + r.trips.toFixed(1).padStart(7));
	})));
})();
