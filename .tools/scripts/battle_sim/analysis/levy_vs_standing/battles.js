// Levy focus against Standing Forces: one country against itself at years 10, 30 and 50 of developing its economy. See README.md.
//   node battles.js --country cas [--years 10,30,50] [--n 200] [--search 60] [--step 0.25] [--variant name] [--out results/battles_cas.json]
// Neither side keeps an army while it develops. At a checkpoint each gets regulars whose manpower upkeep is 75% of its monthly manpower, plus its whole levy, recovered.
// The regular mix is found by double oracle: each side's best answer to the other's mixed strategy, over a grid of unit shares and the two formations, until neither gains.
// Focus bonuses are read from focus_data.js. Progress goes to stderr.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '../..');
const S = require(path.join(R, 'engine.js'));
S.setUnitDB(require(path.join(R, 'units.json')));
const pool = require(path.join(R, 'pool.js'))();
const progress = require(path.join(R, 'progress.js'));
const { ages } = require(path.join(R, '../focus_picks/focus_data.js'));
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const TAG = flag('--country', 'cas'), N = +flag('--n', 200), NS = +flag('--search', 60), STEP = +flag('--step', 0.25), OUT = flag('--out');
const YEARS = flag('--years', '10,30,50').split(',').map(Number), VARIANT = flag('--variant', 'base');
const SAVE_STATS = JSON.parse(fs.readFileSync(path.join(__dirname, '../castile_morocco/countries_1338_04.json'), 'utf8')).countries[TAG.toUpperCase()];
const { notes, ...BASE } = SAVE_STATS;
const VARIANTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'variants.json'), 'utf8'));
const GENERAL = { adm: 60, dip: 59, mil: 61 }; // the neutral general of every analysis here
const SHARE = 0.75; // the user's rule: upkeep of 75% of monthly manpower
const ROSTER = { hi: 'a_men_at_arms', li: 'a_handgonners', hc: 'a_heavy_cavalrymen', lc: 'a_cavalrymen', art: 'a_houfnice' }; // age II, as army_meta.js
const CATS = Object.keys(ROSTER);

// the focus's modifiers, from focus_data.js, with a variant's changes on top
const focusMods = id => {
	const f = ages.find(a => a.n === 2).mil.find(x => x.id === id), m = {};
	for (const [, text] of f.adv) for (const line of String(text).split('\n')) { const [k, v] = line.split('=').map(x => x.trim()); if (k && !Number.isNaN(+v)) m[k] = (m[k] || 0) + +v; }
	for (const [k, v] of Object.entries((VARIANTS[VARIANT] || {})[id] || {})) m[k] = (m[k] || 0) + v;
	return m;
};
const FIELD = { land_morale: 'moraleFlat', land_morale_modifier: 'moraleMod', discipline: 'discipline', levy_combat_efficiency_modifier: 'levyCE', army_maintenance_efficiency: 'maintenanceEfficiency', army_initiative: 'initiativeMod', military_tactics: 'tactics',
	army_heavy_infantry_power: 'power.hi', army_light_infantry_power: 'power.li', army_heavy_cavalry_power: 'power.hc', army_light_cavalry_power: 'power.lc', army_artillery_power: 'power.art',
	army_heavy_cavalry_maintenance_cost_modifier: 'costMod.maintenance.hc', army_light_cavalry_maintenance_cost_modifier: 'costMod.maintenance.lc', army_heavy_infantry_maintenance_cost_modifier: 'costMod.maintenance.hi', army_light_infantry_maintenance_cost_modifier: 'costMod.maintenance.li' };
const setField = (o, f, x) => { const ks = f.split('.'); let t = o; for (const k of ks.slice(0, -1)) t = t[k] ??= {}; const l = ks[ks.length - 1]; t[l] = (t[l] || 0) + x; };
const countryOf = mods => { const c = JSON.parse(JSON.stringify(BASE)); for (const [k, v] of Object.entries(mods)) if (FIELD[k]) setField(c, FIELD[k], v); return c; };
// regulars standing since the last checkpoint: monthly gain over the regular decay
const experienceOf = mods => (mods.monthly_experience_gain || 0) / Math.max(1e-6, S.D.EXPERIENCE_DECAY + S.D.REGULAR_DECAY);

const eco = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', `final_${TAG}${VARIANT === 'base' ? '' : '_' + VARIANT}.json`), 'utf8'));
const runOf = (id, T) => eco.runs.find(r => r.label === `${id}@${T}`);
const side = (id, T) => {
	const r = runOf(id, T), y = r.years.find(x => x.year === T), mods = focusMods(id), c = countryOf(mods), levy = [];
	for (const u of r.levies[T]) { const full = Math.floor(u.men / u.size + 1e-9), part = u.men / u.size - full; if (full) levy.push({ type: u.unit, count: full }); if (part * u.size >= 0.001) levy.push({ type: u.unit, count: 1, strength: part }); }
	return { id, mods, c, levy, exp: experienceOf(mods), budget: SHARE * y.manpower, manpower: y.manpower, year: y };
};
// regiments of each category for a share of regiments, spending the whole upkeep budget
const regiments = (comp, s) => {
	const per = CATS.reduce((t, k) => t + (comp[k] || 0) * upkeepOf(k, s), 0), total = s.budget / per, out = {};
	for (const k of CATS) if (comp[k]) out[k] = Math.round(total * comp[k]);
	return out;
};
const upkeepOf = (cat, s) => { const u = S.unitStats(ROSTER[cat]), mod = 1 + (((s.c.costMod || {}).maintenance || {})[u.c] || 0); return u.pr.m[1] * u.s * mod / (1 + (s.c.maintenanceEfficiency || 0)); };
const army = (st, s) => { const n = regiments(st.comp, s); return { name: s.id, country: s.c, formation: st.f, general: GENERAL, units: [...CATS.filter(k => n[k]).map(k => ({ type: ROSTER[k], count: n[k], experience: s.exp })), ...s.levy] }; };
const OPEN = { topography: 'flatland', vegetation: 'farmland', climate: 'mediterranean', rankFrontage: 0 };
const scn = (a, b, sa, sb, loc, first) => ({ location: loc, attacker: { armies: [first ? army(a, sa) : army(b, sb)] }, defender: { armies: [first ? army(b, sb) : army(a, sa)] } });
const grid = () => {
	const k = Math.round(1 / STEP), out = [];
	const rec = (i, left, c) => { if (i === CATS.length - 1) { const x = { ...c }; if (left) x[CATS[i]] = left / k; out.push(x); return; } for (let n = 0; n <= left; n++) { const x = { ...c }; if (n) x[CATS[i]] = n / k; rec(i + 1, left - n, x); } };
	rec(0, k, {});
	return out.flatMap(comp => [{ comp, f: 'balanced' }, ...(comp.hc || comp.lc ? [{ comp, f: 'cav_inf_cav' }] : [])]);
};
let tick = () => {};
// the same pairing always gets the same dice, so a rerun gives the same numbers
const seedOf = text => { let h = 2166136261; for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619); return (h >>> 0) % 2000000000; };
// A's win rate over both seats
const play = async (a, b, sa, sb, n, loc = OPEN) => {
	const [x, y] = await Promise.all([true, false].map(first => pool.mc(scn(a, b, sa, sb, loc, first), n, { seed: seedOf(JSON.stringify([a, b, sa.id, sa.budget, loc.topography, first])) })));
	tick(2);
	return { win: (x.wins[0] + y.wins[1]) / (2 * n), days: (x.days + y.days) / 2, lostA: (x.losses[0] + y.losses[1]) / 2, lostB: (x.losses[1] + y.losses[0]) / 2 };
};
// a zero-sum matrix by fictitious play: row player's mix, column player's mix, value
const solveMatrix = M => {
	const r = M.length, c = M[0].length, rc = new Array(r).fill(0), cc = new Array(c).fill(0), rs = new Array(r).fill(0), cs = new Array(c).fill(0);
	let i = 0, j = 0;
	for (let t = 0; t < 4000; t++) {
		rc[i]++; cc[j]++;
		for (let k = 0; k < c; k++) cs[k] += M[i][k];
		for (let k = 0; k < r; k++) rs[k] += M[k][j];
		j = cs.indexOf(Math.min(...cs)); i = rs.indexOf(Math.max(...rs));
	}
	const T = 4000, x = rc.map(v => v / T), y = cc.map(v => v / T);
	return { x, y, value: x.reduce((t, a, p) => t + a * y.reduce((u, b, q) => u + b * M[p][q], 0), 0) };
};
const name = st => CATS.filter(k => st.comp[k]).map(k => `${Math.round(100 * st.comp[k])}${k}`).join(' ') + (st.f === 'cav_inf_cav' ? ' (cav wings)' : '');
async function solve(T) {
	const L = side('levy', T), F = side('standing_forces', T), G = grid();
	const start = { comp: { hc: 1 }, f: 'balanced' };
	const A = [start], B = [start], M = [[(await play(start, start, L, F, NS)).win]];
	let sol = solveMatrix(M);
	for (let it = 0; it < 8; it++) {
		const bestAgainst = async (mine, foe, foeMix, flip) => {
			const sup = foeMix.map((w, i) => [w, foe[i]]).filter(([w]) => w > 0.02);
			const scores = await Promise.all(G.map(async st => {
				let v = 0, tw = 0;
				for (const [w, f] of sup) { const r = flip ? 1 - (await play(f, st, L, F, NS)).win : (await play(st, f, L, F, NS)).win; v += w * r; tw += w; }
				return [v / tw, st];
			}));
			scores.sort((a, b) => b[0] - a[0]);
			return scores[0];
		};
		const [va, sa] = await bestAgainst(A, B, sol.y, false), [vb, sb] = await bestAgainst(B, A, sol.x, true);
		const key = s => JSON.stringify(s), hasA = A.some(s => key(s) === key(sa)), hasB = B.some(s => key(s) === key(sb));
		if ((va <= sol.value + 0.01 || hasA) && ((1 - vb) >= sol.value - 0.01 || hasB)) break;
		if (!hasA) { A.push(sa); M.push(await Promise.all(B.map(async b => (await play(sa, b, L, F, NS)).win))); }
		if (!hasB) { B.push(sb); for (let i = 0; i < A.length; i++) M[i].push((await play(A[i], sb, L, F, NS)).win); }
		sol = solveMatrix(M);
	}
	const top = (S2, w) => S2.map((s, i) => [w[i], s]).sort((a, b) => b[0] - a[0])[0][1];
	const a = top(A, sol.x), b = top(B, sol.y);
	const open = await play(a, b, L, F, N);
	const hills = await play(a, b, L, F, N, { topography: 'hills', vegetation: 'woods', climate: 'mediterranean', rankFrontage: 0 });
	const sum = (s, st) => { const n = regiments(st.comp, s); return { manpower: s.manpower * 1000, regulars: Object.entries(n).map(([k, v]) => `${v} ${k}`).join(', '), regularMen: Object.entries(n).reduce((t, [k, v]) => t + v * S.unitStats(ROSTER[k]).s, 0), mix: name(st), levyMen: s.levy.reduce((t, g) => t + g.count * S.unitStats(g.type).s * (g.strength ?? 1), 0), levyRegs: s.levy.reduce((t, g) => t + g.count, 0) }; };
	return { year: T, levyWins: sol.value, open, hills, levy: sum(L, a), standing: sum(F, b), mixes: { levy: A.map((s, i) => [+sol.x[i].toFixed(2), name(s)]).filter(([w]) => w > 0.02), standing: B.map((s, i) => [+sol.y[i].toFixed(2), name(s)]).filter(([w]) => w > 0.02) } };
}
(async () => {
	const gridSize = grid().length;
	tick = progress(YEARS.length * (gridSize * 2 * 3 * 2 * 2 + 40), `battles ${TAG} ${VARIANT}`, 5000, true);
	const out = [];
	for (const T of YEARS) out.push(await solve(T));
	tick.finish();
	await pool.close();
	console.log(`${TAG.toUpperCase()}, variant ${VARIANT}: Levy focus against Standing Forces. Win rates are the Levy side's, both seats, ${N * 2} battles.`);
	for (const r of out) {
		console.log(`\n=== Year ${r.year}: equilibrium ${(100 * r.levyWins).toFixed(0)}%; those armies on open ground ${(100 * r.open.win).toFixed(0)}% (${r.open.days.toFixed(0)} days, men lost ${r.open.lostA.toFixed(1)}k / ${r.open.lostB.toFixed(1)}k); on wooded hills ${(100 * r.hills.win).toFixed(0)}%`);
		for (const [k, s] of [['Levy', r.levy], ['Standing', r.standing]]) console.log(`  ${k.padEnd(9)} manpower ${s.manpower.toFixed(0)}/mo; regulars ${s.regulars} (${s.regularMen.toFixed(1)}k, ${s.mix}); levy ${s.levyMen.toFixed(1)}k in ${s.levyRegs} regiments`);
		console.log(`  mixes: Levy ${r.mixes.levy.map(([w, n]) => `${(100 * w).toFixed(0)}% ${n}`).join(' + ')} | Standing ${r.mixes.standing.map(([w, n]) => `${(100 * w).toFixed(0)}% ${n}`).join(' + ')}`);
	}
	if (OUT) fs.writeFileSync(path.join(__dirname, OUT), JSON.stringify({ country: TAG, variant: VARIANT, results: out }, null, '\t'));
})();
