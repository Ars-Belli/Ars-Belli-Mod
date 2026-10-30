// node .tools/scripts/battle_sim/analysis/army_meta.js regulars [--ages 2,3,4,5,6] [--views regiments,manpower,gold] [--regs 30]
//      [--n 60] [--nm 300] [--iters 10] [--tol 0.01] [--step 0.2] [--frontage 10] [--loc '{"topography":"hills"}'] [--balanced-only]
//      [--no-combined] [--combined-per-type 0.025] [--days-per-phase 4] [--levies L] [--out file]
// --levies L: the levy meta. Both sides also bring L free levy regiments, so a strategy is a regular composition plus the share of
// knights among its levies (0, 25 or 50%). Levies count for combined arms by category: levy infantry as li, knights as hc.
// node .tools/scripts/battle_sim/analysis/army_meta.js wars --in results.json [--wars 500] [--months 120] [--interval ready|2]
//      plays the best mixed army of each age against pure cavalry and pure infantry in wars of attrition (simulateWar): same
//      manpower income, same regiments or same upkeep, 75% of income spent on upkeep by the dearer side, pool full at the start.
// Which army composition wins, age by age, with regular regiments only (no levies, no mercenaries).
// Composition is treated as a symmetric zero-sum game and solved by double oracle, so the answer is not limited to a list of
// guesses: keep a small strategy set S, solve its equilibrium, search a whole grid of compositions for the best counter to that
// equilibrium, add it to S, repeat until nothing beats the equilibrium by more than --tol. The equilibrium is the meta: a pure
// answer means one army beats everything, a spread means a rock-paper-scissors.
// Strategy = regiment shares over hi/li/hc/lc/art plus formation (balanced_army or cav_inf_cav, the only two presets).
// Parity views (the same three as focus_picks_round_robin.js):
//   regiments = same regiment count (recruitment locations are the limit)
//   manpower  = same monthly manpower upkeep (2% of the men for infantry, 4% for cavalry and artillery)
//   gold      = same gold upkeep (build gold has the same ratios, x 100)
// The budget is what 30 regiments of the old MP meta cost: heavy cavalry to age 4, heavy infantry from age 5.
// Both sides: generals 60/59/61, Spain 1547's discipline and morale, army tradition 20, experience 0.37, and every universal
// advance of the age. No universal advance gives one category power, so the only unequal ones are combined_bonus_per_type
// (+1% at ages 4 and 6) for mixed armies; frontage +10% (age 5), discipline +5% and combat speed +10% (age 6) apply to all.
const fs = require('fs');
const path = require('path');
const S = require('../engine.js');
const pool = require('../pool.js')();
S.setUnitDB(require('../units.json'));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; }, has = k => argv.includes(k);
const CATS = ['hi', 'li', 'hc', 'lc', 'art'];
const ROSTER = {
	1: { hi: 'a_footmen', li: 'a_archers', hc: 'a_armored_horsemen', lc: 'a_horsemen', art: 'a_age_1_traditions_artillery' },
	2: { hi: 'a_men_at_arms', li: 'a_handgonners', hc: 'a_heavy_cavalrymen', lc: 'a_cavalrymen', art: 'a_houfnice' },
	3: { hi: 'a_halberdiers', li: 'a_early_arquebusiers', hc: 'a_lancers', lc: 'a_light_lancers', art: 'a_falconet' },
	4: { hi: 'a_pikemen', li: 'a_arquebusiers', hc: 'a_heavy_lancers', lc: 'a_pistoleers', art: 'a_chambered_cannon' },
	5: { hi: 'a_musketeers', li: 'a_hunters', hc: 'a_gallop_cavalry', lc: 'a_hussars', art: 'a_royal_mortar' },
	6: { hi: 'a_fusiliers', li: 'a_sharpshooters', hc: 'a_cuirassiers', lc: 'a_light_dragoons', art: 'a_flying_battery' },
};
const LEVY = {
	1: { inf: 'a_feudal_levy', knights: 'a_mailed_knights' }, 2: { inf: 'a_peasant_levy', knights: 'a_plated_knights' }, 3: { inf: 'a_matchlock_levy', knights: 'a_cavaliers' },
	4: { inf: 'a_flintlock_levy', knights: 'a_late_cavaliers' }, 5: { inf: 'a_militiamen', knights: 'a_provincial_cavalry' }, 6: { inf: 'a_conscripts', knights: 'a_gendarmerie' },
};
const LEVIES = +opt('--levies', 0);
const GENERAL = { adm: 60, dip: 59, mil: 61 };
const FLAT_MORALE = [0, 0.25, 0.5, 0.8, 1.15, 1.55];
const baseCountry = (age, extra = {}) => ({
	tactics: 1, discipline: 0.2856 + (age >= 6 ? 0.05 : 0), moraleMod: 0.203 + 0.04, moraleFlat: FLAT_MORALE[age - 1], experience: 0.37, levyCE: 0.1,
	combinedPerType: has('--no-combined') ? 0 : opt('--combined-per-type') ? +opt('--combined-per-type') : 0.025 + (age >= 4 ? 0.01 : 0) + (age >= 6 ? 0.01 : 0),
	initiativeMod: age >= 2 ? 0.2 : 0, speedMod: age >= 6 ? 0.1 : 0, frontageMod: age >= 5 ? 0.1 : 0, correctBoxChance: 0.1 * (age - 1), ...extra,
});
const size = (cat, age) => S.unitStats(ROSTER[age][cat]).s;
const regCost = (cat, age, view) => {
	const u = S.unitStats(ROSTER[age][cat]);
	return view === 'manpower' ? u.pr.m[1] * u.s : view === 'gold' ? u.pr.m[0] * u.s / S.D.PRICE_SCALE : 1;
};
const budgetOf = (age, view, regs) => regs * regCost(age <= 4 ? 'hc' : 'hi', age, view);
// regiment counts from shares: as many regiments as the budget buys, split by largest remainder
function counts(comp, age, view, regs) {
	const avg = CATS.reduce((t, c) => t + (comp[c] || 0) * regCost(c, age, view), 0);
	const n = Math.round(budgetOf(age, view, regs) / avg);
	const raw = CATS.map(c => (comp[c] || 0) * n), out = raw.map(Math.floor);
	let left = n - out.reduce((a, b) => a + b, 0);
	for (const i of raw.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0]).map(x => x[1])) { if (left-- <= 0) break; out[i]++; }
	return Object.fromEntries(CATS.map((c, i) => [c, out[i]]));
}
const army = (comp, age, view, regs, extra) => {
	const n = counts(comp, age, view, regs);
	const lv = LEVIES ? [[LEVY[age].inf, Math.round(LEVIES * (1 - (comp.lk || 0)))], [LEVY[age].knights, Math.round(LEVIES * (comp.lk || 0))]].filter(x => x[1]).map(([type, count]) => ({ type, count })) : [];
	return { name: 'x', formation: comp.f || 'balanced', general: GENERAL, country: baseCountry(age, extra), units: [...CATS.filter(c => n[c]).map(c => ({ type: ROSTER[age][c], count: n[c] })), ...lv] };
};
const compKey = c => CATS.map(k => Math.round((c[k] || 0) * 100)).join('/') + (c.f === 'cav_inf_cav' ? ' cic' : '') + (c.lk ? ` lk${Math.round(100 * c.lk)}` : '');
const compName = c => CATS.filter(k => c[k]).map(k => `${Math.round(c[k] * 100)}${k}`).join(' ') + (c.f === 'cav_inf_cav' ? ' (cav_inf_cav)' : '') + (LEVIES ? ` +${LEVIES} levies ${Math.round(100 * (c.lk || 0))}% knights` : '');
const isPure = c => CATS.filter(k => c[k]).length === 1;
// every composition with shares in steps of `step`, plus cav_inf_cav where the army has both cavalry and something for the centre
function grid(step) {
	const out = [], k = Math.round(1 / step);
	const rec = (i, left, cur) => {
		if (i === CATS.length - 1) { out.push({ ...cur, [CATS[i]]: left * step }); return; }
		for (let x = 0; x <= left; x++) rec(i + 1, left - x, { ...cur, [CATS[i]]: x * step });
	};
	rec(0, k, {});
	const clean = out.map(c => Object.fromEntries(Object.entries(c).filter(([, v]) => v > 1e-9).map(([a, b]) => [a, +b.toFixed(3)])));
	if (!has('--balanced-only')) for (const c of [...clean]) if ((c.hc || 0) + (c.lc || 0) >= 0.2 && (c.hi || 0) + (c.li || 0) >= 0.2) clean.push({ ...c, f: 'cav_inf_cav' });
	return LEVIES ? clean.flatMap(c => [c, { ...c, lk: 0.25 }, { ...c, lk: 0.5 }]) : clean;
}
// a composition's neighbours: move `step` of the regiments from one category to another
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
// symmetric zero-sum game: multiplicative weights in self-play; the average strategy converges to an equilibrium
function equilibrium(M, T = 60000) {
	const n = M.length, w = new Float64Array(n), avg = new Float64Array(n), eta = Math.sqrt(8 * Math.log(Math.max(2, n)) / T);
	for (let t = 0; t < T; t++) {
		const top = Math.max(...w); let sum = 0; const p = new Float64Array(n);
		for (let i = 0; i < n; i++) { p[i] = Math.exp(w[i] - top); sum += p[i]; }
		for (let i = 0; i < n; i++) { p[i] /= sum; avg[i] += p[i]; }
		for (let i = 0; i < n; i++) { let u = 0; for (let j = 0; j < n; j++) u += p[j] * (M[i][j] - 0.5); w[i] += eta * u; }
	}
	return [...avg].map(x => x / T);
}
const location = () => opt('--loc') ? JSON.parse(opt('--loc')) : { frontage: +opt('--frontage', 10) };
const PATCH = opt('--days-per-phase') ? { D: { DAYS_PER_PHASE: +opt('--days-per-phase') } } : undefined;
// win rate of a against b: both seat orders, draws count half
async function duel(a, b, age, view, regs, n, seed = 11) {
	const x = army(a, age, view, regs), y = army(b, age, view, regs);
	const [m1, m2] = await Promise.all([
		pool.mc({ location: location(), attacker: { armies: [x] }, defender: { armies: [y] } }, n, { seed, patch: PATCH }),
		pool.mc({ location: location(), attacker: { armies: [y] }, defender: { armies: [x] } }, n, { seed: seed + 500000, patch: PATCH }),
	]);
	return { win: (m1.wins[0] + m1.draws / 2 + m2.wins[1] + m2.draws / 2) / (2 * n), lost: (m1.losses[0] + m2.losses[1]) / 2, killed: (m1.losses[1] + m2.losses[0]) / 2, days: (m1.days + m2.days) / 2 };
}
async function solveCell(age, view, regs, o) {
	const G = grid(o.step), byKey = new Map(), memo = new Map();
	const pair = async (a, b, n) => {
		const k = compKey(a) + '|' + compKey(b) + '|' + n, r = compKey(b) + '|' + compKey(a) + '|' + n;
		if (compKey(a) === compKey(b)) return 0.5;
		if (memo.has(k)) return memo.get(k);
		if (memo.has(r)) return 1 - memo.get(r);
		const w = (await duel(a, b, age, view, regs, n)).win;
		memo.set(k, w); return w;
	};
	let set = CATS.map(c => ({ [c]: 1 }));
	if (LEVIES) set = set.flatMap(c => [c, { ...c, lk: 0.25 }]);
	const matrix = async list => {
		const M = list.map(() => list.map(() => 0.5)), jobs = [];
		for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) jobs.push(pair(list[i], list[j], o.nm).then(w => { M[i][j] = w; M[j][i] = 1 - w; }));
		await Promise.all(jobs);
		return M;
	};
	let M, eq, gain = 0, it = 0;
	for (; it < o.iters; it++) {
		M = await matrix(set);
		eq = equilibrium(M);
		const support = set.map((c, i) => ({ c, p: eq[i] })).filter(x => x.p >= 0.02).sort((a, b) => b.p - a.p).slice(0, 6);
		const tot = support.reduce((t, x) => t + x.p, 0);
		// screen the grid and the neighbours of the support against the equilibrium, then re-test the best at full size
		const seen = new Set(set.map(compKey)), cand = [];
		for (const c of [...G, ...support.flatMap(x => neighbours(x.c, o.step / 2))]) { const k = compKey(c); if (!seen.has(k)) { seen.add(k); cand.push(c); } }
		const vs = async (c, n) => (await Promise.all(support.map(x => pair(c, x.c, n).then(w => w * x.p / tot)))).reduce((a, b) => a + b, 0);
		const screened = (await Promise.all(cand.map(c => vs(c, o.n).then(v => ({ c, v }))))).sort((a, b) => b.v - a.v).slice(0, 5);
		const best = (await Promise.all(screened.map(x => vs(x.c, o.nm).then(v => ({ c: x.c, v }))))).sort((a, b) => b.v - a.v);
		gain = best[0].v - 0.5;
		console.log(`  age ${age} ${view} iter ${it}: |S| ${set.length}, support ${support.map(x => `${compName(x.c)} ${Math.round(100 * x.p)}%`).join(', ')}; best counter ${compName(best[0].c)} ${(100 * best[0].v).toFixed(1)}%`);
		if (gain < o.tol) break;
		set.push(best[0].c);
		if (best[1] && best[1].v - 0.5 >= o.tol) set.push(best[1].c);
	}
	M = await matrix(set);
	eq = equilibrium(M);
	const score = set.map((c, i) => ({ c, p: eq[i], vsEq: set.reduce((t, _, j) => t + eq[j] * M[i][j], 0), vsField: M[i].reduce((a, b) => a + b, 0) / set.length }));
	const meta = score.filter(x => x.p >= 0.02).sort((a, b) => b.p - a.p);
	const topMixed = score.filter(x => !isPure(x.c)).sort((a, b) => b.p - a.p || b.vsEq - a.vsEq)[0], topPure = score.filter(x => isPure(x.c)).sort((a, b) => b.vsEq - a.vsEq || b.p - a.p)[0];
	// the best pure army against the best mixed army, with more battles
	const n2 = 1500, hh = topMixed && topPure ? await duel(topMixed.c, topPure.c, age, view, regs, n2, 77) : null;
	return {
		age, view, regs, iters: it + 1, counterGain: gain,
		meta: meta.map(x => ({ comp: compName(x.c), key: compKey(x.c), c: x.c, p: x.p, vsEq: x.vsEq, regiments: counts(x.c, age, view, regs) })),
		pure: Object.fromEntries(score.filter(x => isPure(x.c)).map(x => [compName(x.c), { p: x.p, vsEq: x.vsEq }])),
		topMixed: topMixed && { comp: compName(topMixed.c), c: topMixed.c, p: topMixed.p, vsEq: topMixed.vsEq, regiments: counts(topMixed.c, age, view, regs) },
		topPure: topPure && { comp: compName(topPure.c), c: topPure.c, vsEq: topPure.vsEq, regiments: counts(topPure.c, age, view, regs) },
		headToHead: hh && { ...hh, n: 2 * n2, ci: S.wilson(hh.win * 2 * n2, 2 * n2) },
		set: set.map(compKey), battles: [...memo.keys()].reduce((t, k) => t + 2 * +k.split('|')[2], 0),
	};
}
(async () => {
	const t0 = Date.now(), mode = argv[0];
	const ages = opt('--ages', '2,3,4,5,6').split(',').map(Number), views = opt('--views', 'regiments,manpower,gold').split(',');
	const regs = +opt('--regs', 30), o = { n: +opt('--n', 60), nm: +opt('--nm', 300), iters: +opt('--iters', 10), tol: +opt('--tol', 0.01), step: +opt('--step', 0.2) };
	if (mode === 'regulars') {
		const out = [];
		for (const age of ages) for (const view of views) {
			const t1 = Date.now();
			const r = await solveCell(age, view, regs, o);
			out.push(r);
			console.log(`\n=== age ${age}, ${view} parity, ${regs} regiments' budget: ${r.iters} iterations, ${(r.battles / 1000).toFixed(0)}k battles, ${((Date.now() - t1) / 1000).toFixed(0)} s, best remaining counter +${(100 * r.counterGain).toFixed(1)}`);
			for (const m of r.meta) console.log(`  meta ${(100 * m.p).toFixed(0).padStart(3)}%  ${m.comp.padEnd(38)} vs meta ${(100 * m.vsEq).toFixed(1)}%  ${JSON.stringify(m.regiments)}`);
			if (r.headToHead) console.log(`  best mixed ${r.topMixed.comp} beats best pure ${r.topPure.comp}: ${(100 * r.headToHead.win).toFixed(1)}% [${r.headToHead.ci.map(x => (100 * x).toFixed(1)).join('-')}], men lost ${(1000 * r.headToHead.lost).toFixed(0)} vs ${(1000 * r.headToHead.killed).toFixed(0)}, ${r.headToHead.days.toFixed(0)} days`);
			if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
		}
	}
	if (mode === 'wars') {
		const res = JSON.parse(fs.readFileSync(opt('--in'), 'utf8')), W = +opt('--wars', 500), months = +opt('--months', 120), interval = opt('--interval', 'ready') === 'ready' ? 'ready' : +opt('--interval');
		const warExtra = age => ({ maintenanceEfficiency: 0.25, reinforceSpeed: 0.1 * (age - 1) });
		const upkeep = (comp, age, view) => S.armyCosts({ attacker: { armies: [army(comp, age, view, regs, warExtra(age))] }, defender: { armies: [] } })[0].upkeepManpower * 1000;
		const out = [];
		console.log(`${W} wars a row, ${months} months, battles ${interval === 'ready' ? 'once both are fully reinforced' : 'every ' + interval + ' months'}. Share of wars won by the first army (undecided count half), share of battles it won, manpower reserve gap at the end in points of the pool`);
		for (const age of ages) for (const view of ['regiments', 'manpower']) {
			const cell = res.find(r => r.age === age && r.view === view);
			if (!cell) continue;
			const mix = (cell.meta.find(m => !isPure(m.c)) || cell.meta[0]).c, list = [['meta', mix], ['100hc', { hc: 1 }], ['100hi', { hi: 1 }]];
			console.log(`
=== age ${age}, ${view === 'regiments' ? 'same regiments' : 'same upkeep'}: meta = ${compName(mix)}`);
			for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
				const [[an, a], [bn, b]] = [list[i], list[j]];
				if (compKey(a) === compKey(b)) continue;
				const ua = upkeep(a, age, view), ub = upkeep(b, age, view), income = Math.max(ua, ub) / 0.75;
				const decay = age >= 3 ? 0.03 : 0.04, sc = { location: location(), attacker: { armies: [army(a, age, view, regs, warExtra(age))] }, defender: { armies: [army(b, age, view, regs, warExtra(age))] } };
				const w = await pool.wars(sc, W, { months, interval, sides: [{ income, expDecay: decay }, { income, expDecay: decay }] }, 3, PATCH);
				const won = w.collapsed[1] + w.undecided / 2;
				console.log(`  ${(an + ' vs ' + bn).padEnd(16)} wars ${(100 * won).toFixed(0).padStart(3)}% (undecided ${(100 * w.undecided).toFixed(0)}%)  battles ${(100 * w.battleShare[0]).toFixed(0).padStart(3)}% of ${w.battles.toFixed(1)}  reserve gap ${(100 * w.reserveDiff).toFixed(0).padStart(4)}  men lost ${w.lost[0].toFixed(0)}k / ${w.lost[1].toFixed(0)}k  regiments ${JSON.stringify(sc.attacker.armies[0].units.map(u => u.count))} / ${JSON.stringify(sc.defender.armies[0].units.map(u => u.count))}`);
				out.push({ age, view, a: an, b: bn, comp: compName(mix), won, undecided: w.undecided, battles: w.battleShare[0], reserve: w.reserveDiff });
			}
			if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
