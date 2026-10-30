// node .tools/scripts/battle_sim/analysis/reformation_13.js [checks] [--n 60] [--nm 400] [--iters 8] [--regs 30,60] [--out file]
// Best army for Spain and Lotharingia in the Reformation on game 1.3.11 (rules RULES_13, units_1.3.11.json), from the campaign's
// 1.3.11 save of January 1547. Asymmetric zero-sum game solved by double oracle: each country has its own roster, stats and general
// and both best-respond. Tiers: today = units actually unlocked in the save; full = every age IV unit and universal advance.
// Base stats are the save's minus the general. Morale is fitted to the regiments' stored morale, which follows
// 3.5 x (1 + m + 0.002 x general dip): Spain 4.87 (dip 48) to 5.10 (dip 82), Lotharingia 4.99 (dip 51) and 5.10 (dip 67). The save's
// modifier sum misses part of it (rulers and so on), so m is 0.2954 and 0.323, not the importer's 0.2418 and 0.2694.
const fs = require('fs');
const path = require('path');
process.env.EU5_UNITS = process.env.EU5_UNITS || path.join(__dirname, '../units_1.3.11.json');
const S = require('../engine.js');
S.setUnitDB(require(process.env.EU5_UNITS));
const pool = require('../pool.js')();
const PATCH = { D: S.RULES_13 };
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const CATS = ['hi', 'li', 'hc', 'lc', 'art'];
const NAMES = { SPA: 'Spain', LOT: 'Lotharingia' };
// on top of the save: full = Spanish Square, Maurician Infantry, Combined Arms (neither has them); abs adds Line Infantry, Gustavian Infantry, Military Revolution
const BONUS = { today: { tactics: 0, moraleFlat: 0, combinedPerType: 0, frontageMod: 0 }, full: { tactics: 0.25, moraleFlat: 0.3, combinedPerType: 0.01, frontageMod: 0 }, abs: { tactics: 0.5, moraleFlat: 0.65, combinedPerType: 0.01, frontageMod: 0.1 } };
const SIDES = {
	SPA: {
		general: { adm: 99, dip: 82, mil: 84 },
		country: { tactics: 2.6, discipline: 0.216, moraleMod: 0.2954, moraleFlat: 0.5, initiativeMod: 0.1186, correctBoxChance: 0.2, experience: 0.4, power: { hc: 0.1, lc: 0.1 }, levyCE: 0.1, maintenanceEfficiency: 0.3651, reinforceSpeed: 0.2, combinedPerType: 0.025 },
		today: { hi: 'a_footmen', li: 'a_archers', hc: 'a_lanzas_de_castilla', lc: 'a_cavalrymen', art: 'a_falconet' },
		full: { hi: 'a_tercio', li: 'a_arquebusiers', hc: 'a_heavy_lancers', lc: 'a_pistoleers', art: 'a_chambered_cannon' },
		abs: { hi: 'a_musketeers', li: 'a_hunters', hc: 'a_gallop_cavalry', lc: 'a_hussars', art: 'a_royal_mortar' },
	},
	LOT: {
		general: { adm: 61, dip: 67, mil: 55 },
		country: { tactics: 2.6526, discipline: 0.3218, moraleMod: 0.323, moraleFlat: 0.5, initiativeMod: 0.3314, correctBoxChance: 0.2, experience: 4.3, power: { hc: 0.15, lc: 0.1 }, levyCE: 0.3, maintenanceEfficiency: 0.1474, reinforceSpeed: 0.2, combinedPerType: 0.025, costMod: { maintenance: { hc: -0.1 } } },
		today: { hi: 'a_halberdiers', li: 'a_archers', hc: 'a_lancers', lc: 'a_light_lancers', art: 'a_falconet' },
		full: { hi: 'a_pikemen', li: 'a_arquebusiers', hc: 'a_heavy_lancers', lc: 'a_pistoleers', art: 'a_chambered_cannon' },
		abs: { hi: 'a_musketeers', li: 'a_hunters', hc: 'a_gallop_cavalry', lc: 'a_hussars', art: 'a_royal_mortar' },
	},
};
const country = (s, tier) => {
	const c = SIDES[s].country, b = BONUS[tier];
	return { ...c, tactics: c.tactics + b.tactics, moraleFlat: c.moraleFlat + b.moraleFlat, combinedPerType: c.combinedPerType + b.combinedPerType, frontageMod: (c.frontageMod || 0) + b.frontageMod };
};
function counts(comp, n) {
	const raw = CATS.map(c => (comp[c] || 0) * n), out = raw.map(Math.floor);
	let left = n - out.reduce((a, b) => a + b, 0);
	for (const i of raw.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0]).map(x => x[1])) { if (left-- <= 0) break; out[i]++; }
	return Object.fromEntries(CATS.map((c, i) => [c, out[i]]));
}
const army = (s, tier, comp, n, roster) => {
	const k = counts(comp, n), r = roster || SIDES[s][tier];
	return { name: s, formation: comp.f || 'balanced', general: SIDES[s].general, country: country(s, tier), units: CATS.filter(c => k[c]).map(c => ({ type: r[c], count: k[c] })) };
};
const keyOf = c => CATS.map(k => Math.round((c[k] || 0) * 100)).join('/') + (c.f === 'cav_inf_cav' ? ' cic' : '');
const nameOf = c => CATS.filter(k => c[k]).map(k => `${Math.round(c[k] * 100)}${k}`).join(' ') + (c.f === 'cav_inf_cav' ? ' (cav_inf_cav)' : '');
function grid(step) {
	const out = [], k = Math.round(1 / step);
	const rec = (i, left, cur) => { if (i === CATS.length - 1) { out.push({ ...cur, [CATS[i]]: left * step }); return; } for (let x = 0; x <= left; x++) rec(i + 1, left - x, { ...cur, [CATS[i]]: x * step }); };
	rec(0, k, {});
	const clean = out.map(c => Object.fromEntries(Object.entries(c).filter(([, v]) => v > 1e-9).map(([a, b]) => [a, +b.toFixed(3)])));
	for (const c of [...clean]) if ((c.hc || 0) + (c.lc || 0) >= 0.2 && (c.hi || 0) + (c.li || 0) >= 0.2) clean.push({ ...c, f: 'cav_inf_cav' });
	return clean;
}
function neighbours(c, step) {
	const out = [];
	for (const a of CATS) for (const b of CATS) {
		if (a === b || (c[a] || 0) < step - 1e-9) continue;
		const n = { ...c, [a]: +(c[a] - step).toFixed(3), [b]: +((c[b] || 0) + step).toFixed(3) };
		if (n[a] < 1e-9) delete n[a];
		out.push(n);
	}
	return out;
}
// zero-sum matrix game (M = row player's win rate): multiplicative weights, average strategies
function solve(M, T = 60000) {
	const r = M.length, c = M[0].length, wr = new Float64Array(r), wc = new Float64Array(c), ar = new Float64Array(r), ac = new Float64Array(c), eta = Math.sqrt(8 * Math.log(Math.max(2, Math.max(r, c))) / T);
	const norm = w => { const top = Math.max(...w), p = Array.from(w, x => Math.exp(x - top)), s = p.reduce((a, b) => a + b, 0); return p.map(x => x / s); };
	for (let t = 0; t < T; t++) {
		const p = norm(wr), q = norm(wc);
		for (let i = 0; i < r; i++) { ar[i] += p[i]; let u = 0; for (let j = 0; j < c; j++) u += q[j] * M[i][j]; wr[i] += eta * u; }
		for (let j = 0; j < c; j++) { ac[j] += q[j]; let u = 0; for (let i = 0; i < r; i++) u += p[i] * M[i][j]; wc[j] -= eta * u; }
	}
	return { p: [...ar].map(x => x / T), q: [...ac].map(x => x / T) };
}
const LOC = { topography: 'flatland', vegetation: 'farmland' };
// Spain's win rate: both seat orders, draws count half
async function fight(a, b, n, seed = 13) {
	const [m1, m2] = await Promise.all([
		pool.mc({ location: LOC, attacker: { armies: [a] }, defender: { armies: [b] } }, n, { seed, patch: PATCH }),
		pool.mc({ location: LOC, attacker: { armies: [b] }, defender: { armies: [a] } }, n, { seed: seed + 500000, patch: PATCH }),
	]);
	return { win: (m1.wins[0] + m1.draws / 2 + m2.wins[1] + m2.draws / 2) / (2 * n), lost: (m1.losses[0] + m2.losses[1]) / 2, killed: (m1.losses[1] + m2.losses[0]) / 2 };
}
async function solveGame(ta, tb, regs, o, rosterA, rosterB) {
	const G = grid(o.step), memo = new Map();
	const pair = async (x, y, n) => {
		const k = keyOf(x) + '|' + keyOf(y) + '|' + n;
		if (memo.has(k)) return memo.get(k);
		const w = (await fight(army('SPA', ta, x, regs, rosterA), army('LOT', tb, y, regs, rosterB), n)).win;
		memo.set(k, w); return w;
	};
	let A = CATS.map(c => ({ [c]: 1 })), B = CATS.map(c => ({ [c]: 1 }));
	let M, eq, val = 0.5;
	const matrix = async () => { const R = A.map(() => B.map(() => 0.5)), jobs = []; A.forEach((x, i) => B.forEach((y, j) => jobs.push(pair(x, y, o.nm).then(w => { R[i][j] = w; })))); await Promise.all(jobs); return R; };
	for (let it = 0; it < o.iters; it++) {
		M = await matrix(); eq = solve(M);
		const supA = A.map((c, i) => ({ c, p: eq.p[i] })).filter(x => x.p >= 0.03).sort((x, y) => y.p - x.p).slice(0, 5), supB = B.map((c, j) => ({ c, p: eq.q[j] })).filter(x => x.p >= 0.03).sort((x, y) => y.p - x.p).slice(0, 5);
		const ta_ = supA.reduce((t, x) => t + x.p, 0), tb_ = supB.reduce((t, x) => t + x.p, 0);
		val = supA.reduce((t, x) => t + supB.reduce((u, y) => u + (x.p / ta_) * (y.p / tb_) * M[A.indexOf(x.c)][B.indexOf(y.c)], 0), 0);
		const vsB = async (c, n) => (await Promise.all(supB.map(y => pair(c, y.c, n).then(w => w * y.p / tb_)))).reduce((a, b) => a + b, 0);
		const vsA = async (c, n) => (await Promise.all(supA.map(x => pair(x.c, c, n).then(w => w * x.p / ta_)))).reduce((a, b) => a + b, 0);
		const pool_ = (set, sup) => { const seen = new Set(set.map(keyOf)), out = []; for (const c of [...G, ...sup.flatMap(x => neighbours(x.c, o.step / 2))]) { const k = keyOf(c); if (!seen.has(k)) { seen.add(k); out.push(c); } } return out; };
		const ca = (await Promise.all(pool_(A, supA).map(c => vsB(c, o.n).then(v => ({ c, v }))))).sort((x, y) => y.v - x.v).slice(0, 4);
		const cb = (await Promise.all(pool_(B, supB).map(c => vsA(c, o.n).then(v => ({ c, v }))))).sort((x, y) => x.v - y.v).slice(0, 4);
		const ba = (await Promise.all(ca.map(x => vsB(x.c, o.nm).then(v => ({ c: x.c, v }))))).sort((x, y) => y.v - x.v)[0];
		const bb = (await Promise.all(cb.map(x => vsA(x.c, o.nm).then(v => ({ c: x.c, v }))))).sort((x, y) => x.v - y.v)[0];
		const ga = ba.v - val, gb = val - bb.v;
		console.log(`    iter ${it}: Spain wins ${(100 * val).toFixed(1)}%; Spain ${supA.map(x => `${nameOf(x.c)} ${Math.round(100 * x.p)}%`).join(', ')}; Lotharingia ${supB.map(x => `${nameOf(x.c)} ${Math.round(100 * x.p)}%`).join(', ')}; counters +${(100 * ga).toFixed(1)} / +${(100 * gb).toFixed(1)}`);
		if (ga < o.tol && gb < o.tol) break;
		if (ga >= o.tol) A.push(ba.c);
		if (gb >= o.tol) B.push(bb.c);
	}
	M = await matrix(); eq = solve(M);
	const pick = (set, w) => set.map((c, i) => ({ c, p: w[i] })).filter(x => x.p >= 0.03).sort((x, y) => y.p - x.p).map(x => ({ comp: nameOf(x.c), c: x.c, p: x.p, regiments: counts(x.c, regs) }));
	return { ta, tb, regs, spain: pick(A, eq.p), lotharingia: pick(B, eq.q), spainWins: eq.p.reduce((t, p, i) => t + p * eq.q.reduce((u, q, j) => u + q * M[i][j], 0), 0), battles: [...memo.keys()].reduce((t, k) => t + 2 * +k.split('|')[2], 0) };
}
// ---- concrete questions: mode "checks"
const custom = (s, tier, units, extra = {}) => ({ name: s, formation: 'balanced', general: SIDES[s].general, country: { ...country(s, tier), ...extra }, units });
const stackMen = u => u.reduce((t, x) => t + x.count * S.unitStats(x.type).s, 0);
async function checks() {
	const out = {}, row = (a, r) => console.log(`  ${a.padEnd(62)} ${(100 * r.win).toFixed(1).padStart(5)}%  men lost ${r.lost.toFixed(1)}k / ${r.killed.toFixed(1)}k`);
	const SP30 = [{ type: 'a_lanzas_de_castilla', count: 28 }, { type: 'a_falconet', count: 2 }], LOT30 = [{ type: 'a_light_lancers', count: 18 }, { type: 'a_lancers', count: 10 }, { type: 'a_halberdiers', count: 1 }, { type: 'a_falconet', count: 1 }];
	const lanzas = n => [{ type: 'a_lanzas_de_castilla', count: n }], lancers = n => [{ type: 'a_lancers', count: n }];
	console.log('\n=== Their armies as fielded, 30 regiments (Spain\'s win rate; men lost by Spain / Lotharingia)');
	row('Spain as fielded vs Lotharingia as fielded', out.real30 = await fight(custom('SPA', 'today', SP30), custom('LOT', 'today', LOT30), 1500));
	row('Spain all Lanzas vs Lotharingia as fielded', out.pureSpa = await fight(custom('SPA', 'today', lanzas(30)), custom('LOT', 'today', LOT30), 1500));
	row('Spain as fielded vs Lotharingia all Lancers', out.pureLot = await fight(custom('SPA', 'today', SP30), custom('LOT', 'today', lancers(30)), 1500));
	row('Spain all Lanzas vs Lotharingia all Lancers', out.purePure = await fight(custom('SPA', 'today', lanzas(30)), custom('LOT', 'today', lancers(30)), 1500));
	console.log('\n=== Whole armies, all in one place (Spain 182 Lanzas + 14 Falconets, Lotharingia as fielded)');
	const SPall = [{ type: 'a_lanzas_de_castilla', count: 182 }, { type: 'a_falconet', count: 14 }], LOTall = [{ type: 'a_light_lancers', count: 61 }, { type: 'a_lancers', count: 34 }, { type: 'a_halberdiers', count: 3 }, { type: 'a_falconet', count: 5 }], LOTpure = [{ type: 'a_lancers', count: 100 }, { type: 'a_falconet', count: 3 }];
	row('Spain whole army vs Lotharingia whole army', out.whole = await fight(custom('SPA', 'today', SPall), custom('LOT', 'today', LOTall), 500));
	row('Spain whole army vs Lotharingia, same regiments, all Lancers', out.wholePure = await fight(custom('SPA', 'today', SPall), custom('LOT', 'today', LOTpure), 500));
	console.log('\n=== Which research matters? One side gets one step, the other nothing; 30 pure heavy cavalry a side');
	const STEPS = {
		'Heavy Lancers only (800-man regiments)': { unit: 'a_heavy_lancers' },
		'Spanish Square only (+0.25 tactics)': { extra: c => ({ tactics: c.tactics + 0.25 }) },
		'Maurician Infantry only (+0.3 morale)': { extra: c => ({ moraleFlat: c.moraleFlat + 0.3 }) },
		'Heavy Lancers + Spanish Square': { unit: 'a_heavy_lancers', extra: c => ({ tactics: c.tactics + 0.25 }) },
		'Heavy Lancers + Spanish Square + Maurician Infantry': { unit: 'a_heavy_lancers', extra: c => ({ tactics: c.tactics + 0.25, moraleFlat: c.moraleFlat + 0.3 }) },
	};
	out.steps = {};
	for (const [name, st] of Object.entries(STEPS)) {
		const up = (s, base) => custom(s, 'today', [{ type: st.unit || base, count: 30 }], st.extra ? st.extra(SIDES[s].country) : {});
		const a = await fight(up('SPA', 'a_lanzas_de_castilla'), custom('LOT', 'today', lancers(30)), 1000), b = await fight(custom('SPA', 'today', lanzas(30)), up('LOT', 'a_lancers'), 1000);
		console.log(`  ${name.padEnd(54)} Spain with it wins ${(100 * a.win).toFixed(1).padStart(5)}%; Lotharingia with it wins ${(100 * (1 - b.win)).toFixed(1).padStart(5)}%`);
		out.steps[name] = [a.win, 1 - b.win];
	}
	console.log('\n=== Wars with their real manpower: 120 months, fight when reinforced; first number = Spain wins the war (undecided count half)');
	const inc = [6937, 4050], max = [416211, 243000], pool0 = [412561, 227000], warC = s => ({ ...country(s, 'today') });
	const WAR = { months: 120, interval: 'ready', sides: [0, 1].map(i => ({ income: inc[i], max: max[i], pool: pool0[i], expDecay: 0.03 })) };
	const warOf = async (a, b, name) => { const w = await pool.wars({ location: LOC, attacker: { armies: [a] }, defender: { armies: [b] } }, 300, WAR, 5, PATCH); const won = w.collapsed[1] + w.undecided / 2; console.log(`  ${name.padEnd(62)} ${(100 * won).toFixed(0).padStart(3)}%  (undecided ${(100 * w.undecided).toFixed(0)}%, Spain won ${(100 * w.battleShare[0]).toFixed(0)}% of ${w.battles.toFixed(1)} battles, men lost ${w.lost[0].toFixed(0)}k / ${w.lost[1].toFixed(0)}k)`); return { won, undecided: w.undecided, battles: w.battleShare[0] }; };
	out.war = await warOf(custom('SPA', 'today', SPall), custom('LOT', 'today', LOTall), 'Spain whole army vs Lotharingia whole army');
	out.warPure = await warOf(custom('SPA', 'today', SPall), custom('LOT', 'today', LOTpure), 'same, Lotharingia all Lancers');
	return out;
}
(async () => {
	const t0 = Date.now(), o = { n: +opt('--n', 60), nm: +opt('--nm', 400), iters: +opt('--iters', 8), tol: 0.01, step: 0.2 }, sizes = opt('--regs', '30,60').split(',').map(Number), out = { games: [], units: [] };
	if (argv[0] === 'checks') { const r = await checks(); if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(r, null, 1)); console.log(`
${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`); await pool.close(); return; }
	const pure = (u, s, tier) => ({ name: u, formation: 'balanced', general: SIDES[s].general, country: country(s, tier), units: [{ type: u, count: 30 }] });
	console.log('=== Which regiment? 30 of each against each other, Spain\'s stats on both sides (win rate of the first; men lost)');
	for (const [a, b, tier] of [['a_lanzas_de_castilla', 'a_heavy_lancers', 'full'], ['a_lanzas_de_castilla', 'a_lancers', 'today'], ['a_tercio', 'a_pikemen', 'full'], ['a_tercio', 'a_heavy_lancers', 'full'], ['a_pikemen', 'a_heavy_lancers', 'full'], ['a_pistoleers', 'a_heavy_lancers', 'full'], ['a_arquebusiers', 'a_pikemen', 'full'], ['a_halberdiers', 'a_lancers', 'today'], ['a_light_lancers', 'a_lancers', 'today']]) {
		const r = await fight(pure(a, 'SPA', tier), pure(b, 'SPA', tier), 1000);
		console.log(`  ${a.padEnd(24)} vs ${b.padEnd(22)} ${(100 * r.win).toFixed(1).padStart(5)}%  men lost ${r.lost.toFixed(1)}k / ${r.killed.toFixed(1)}k`);
		out.units.push({ a, b, ...r });
	}
	for (const [ta, tb] of opt('--games', 'today:today,full:full,full:today,today:full').split(',').map(g => g.split(':'))) for (const regs of sizes) {
		console.log(`\n=== Spain ${ta} vs Lotharingia ${tb}, ${regs} regiments a side`);
		const r = await solveGame(ta, tb, regs, o);
		out.games.push(r);
		console.log(`  Spain wins ${(100 * r.spainWins).toFixed(1)}% with best play from both (${(r.battles / 1000).toFixed(0)}k battles)`);
		console.log(`  Spain: ${r.spain.map(x => `${Math.round(100 * x.p)}% ${x.comp} ${JSON.stringify(x.regiments)}`).join('; ')}`);
		console.log(`  Lotharingia: ${r.lotharingia.map(x => `${Math.round(100 * x.p)}% ${x.comp} ${JSON.stringify(x.regiments)}`).join('; ')}`);
		if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
