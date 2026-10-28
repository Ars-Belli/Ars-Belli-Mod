// node .tools/scripts/battle_sim/analysis/focus_picks_round_robin.js [battles per pairing, default 300] [threads]
//      [--drill months --wait months]   both sides drill, then wait (default 0/0: no drilling, experience 0.37)
//      [--war same|budget [--wars 200]]  score by wars of attrition (simulateWar) instead of battles: same base manpower
//          income for both, income x (1 + manpower modifier); "same" = 30 regiments each (cheaper upkeep keeps more surplus),
//          "budget" = each side builds regiments until upkeep is 75% of its income. 48 months, a battle every 2 months.
// Military focus picks: at each age every distinct battle-relevant pick state fights every other (both sides alternating as
// attacker), under three parity views. A state's score = expected win rate against a random opponent path (states weighted
// by how many of the 3^k paths reach them).
// Meta armies (the user's MP meta): ages 2-4 thirty heavy cavalry, ages 5-6 thirty heavy infantry; frontage 10.
// Assumptions (2026-10-28, from the user and a 1547 Spain save):
//  - Generals are characters, typically 55/58/62 (adm/dip/mil; median of Spain's field generals). Without Leadership,
//    trained generals average 37 at army tradition 14, so nobody trains. Leadership: trained generals +40 a skill, i.e. 77
//    on average (better than most characters), plus +0.2 army tradition a month, taken as +20 by mid-age (+4% morale).
//  - Experience starts near 0 (Spain 1547: 0.37), so experience-gain picks barely count.
//  - Parity views: "regiments" = equal regiment count (recruitment locations/buildings are the limit); "manpower" = size x
//    (1 + manpower modifier) x (1 + maintenance efficiency) / (1 + unit maintenance cost modifier) (manpower upkeep is
//    divided by maintenance efficiency, checked on a save); "gold" = size x (1 + maintenance efficiency) / (1 + cost modifier).
//  - Both sides start from BASE_MAINT army maintenance efficiency (Spain 1547: 26.7%), so +10% is worth 1.35/1.25.
//  - The user (2026-10-28): from the Reformation (1550+) gold is no limit and manpower is; the final table therefore
//    scores ages II-III by gold and ages IV-VI by manpower.
const path = require('path');
const { ages } = require('../../focus_picks/focus_data.js');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i < 0 ? null : +argv[i + 1]; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--'));
const N = +pos[0] || 300;
const pool = require('../pool.js')(+pos[1] || undefined);
const DRILL = opt('--drill') || 0, WAIT = opt('--wait') || 0;
const WAR = (() => { const i = argv.indexOf('--war'); return i < 0 ? null : argv[i + 1]; })(), WARS = opt('--wars') || 200;
const exp = require('../engine.js').drilledExperience;
const MAP = {
	discipline: 'discipline', military_tactics: 'tactics', land_morale_modifier: 'moraleMod', land_morale: 'moraleFlat',
	army_initiative: 'initiativeMod', combat_speed_modifier: 'speedMod', possible_frontage_modifier: 'frontageMod',
	army_heavy_infantry_power: 'power.hi', army_heavy_cavalry_power: 'power.hc',
	army_maintenance_efficiency: 'maint', army_heavy_cavalry_maintenance_cost_modifier: 'maintCost.hc', army_heavy_infantry_maintenance_cost_modifier: 'maintCost.hi',
	global_manpower_modifier: 'manpower', regiment_reinforcement_speed: 'reinforceSpeed',
	army_heavy_infantry_reinforce_cost_modifier: 'reinfCost.hi', army_heavy_cavalry_reinforce_cost_modifier: 'reinfCost.hc', monthly_experience_gain: 'expGain', experience_decay: 'expDecay', train_general_ability: 'genAbility', monthly_army_tradition: 'atGain',
};
const branchMods = br => {
	const o = {};
	for (const [, mods] of br.adv) for (const line of (mods || '').split('\n')) {
		const m = /^\s*([a-z_]+)\s*=\s*(-?[\d.]+)/.exec(line);
		if (m && MAP[m[1]]) o[MAP[m[1]]] = (o[MAP[m[1]]] || 0) + parseFloat(m[2]);
	}
	return o;
};
const AGES = ages.map(a => ({ n: a.n, branches: a.mil.map(b => ({ name: b.name, mods: branchMods(b) })) }));
const BASE_MAINT = 0.25;
const eff = m => (1 + BASE_MAINT + (m.maint || 0)) / (1 + BASE_MAINT);
const VIEWS = WAR ? { ['war (' + WAR + ')']: () => 1 } : {
	regiments: () => 1,
	manpower: (m, cat) => (1 + (m.manpower || 0)) * eff(m) / (1 + (m['maintCost.' + cat] || 0)),
	gold: (m, cat) => eff(m) / (1 + (m['maintCost.' + cat] || 0)),
};
const CHAR = { adm: 55, dip: 58, mil: 62 }, TRAINED = 37 + 40;
const relevant = (mods, age, view) => {
	const o = { ...mods }; const cat = age <= 4 ? 'hc' : 'hi';
	for (const k of Object.keys(o)) if (/^(power|maintCost)\./.test(k) && !k.endsWith(cat)) delete o[k];
	if (view === 'regiments') { delete o.maint; delete o.manpower; delete o['maintCost.' + cat]; }
	if (!WAR) { delete o.reinforceSpeed; delete o['reinfCost.hi']; delete o['reinfCost.hc']; } else if (!o['reinfCost.' + cat]) { delete o['reinfCost.hi']; delete o['reinfCost.hc']; }
	if (view === 'gold') delete o.manpower;
	return JSON.stringify(Object.keys(o).sort().map(k => [k, +o[k].toFixed(4)]));
};
const S = require('../engine.js');
const upkeepReg = (mods, cat, age) => (cat === 'hc' ? 0.04 : 0.02) * S.AGE[cat][age - 1][1] * (1 + (mods['maintCost.' + cat] || 0)) / (1 + BASE_MAINT + (mods.maint || 0));
const baseIncome = (cat, age) => 30 * upkeepReg({}, cat, age) / 0.75;
const warRegs = (mods, cat, age) => WAR === 'budget' ? Math.round(0.75 * baseIncome(cat, age) * (1 + (mods.manpower || 0)) / upkeepReg(mods, cat, age)) : 30;
function side(mods, age, view) {
	const cat = age <= 4 ? 'hc' : 'hi';
	const g = mods.genAbility ? { adm: Math.max(CHAR.adm, TRAINED), dip: Math.max(CHAR.dip, TRAINED), mil: Math.max(CHAR.mil, TRAINED) } : CHAR;
	const c = { tactics: 1 + (mods.tactics || 0), discipline: mods.discipline || 0, moraleMod: (mods.moraleMod || 0) + (mods.atGain ? 0.04 : 0), moraleFlat: mods.moraleFlat || 0,
		initiativeMod: mods.initiativeMod || 0, speedMod: mods.speedMod || 0, frontageMod: mods.frontageMod || 0,
		experience: DRILL || WAIT ? exp({ gain: mods.expGain || 0, decay: mods.expDecay || 0, drill: DRILL, wait: WAIT }) : 0.37, power: {} };
	if (mods['power.' + cat]) c.power[cat] = mods['power.' + cat];
	if (WAR) {
		c.maintenanceEfficiency = BASE_MAINT + (mods.maint || 0); c.reinforceSpeed = mods.reinforceSpeed || 0;
		c.costMod = { maintenance: { [cat]: mods['maintCost.' + cat] || 0 }, reinforce: { [cat]: mods['reinfCost.' + cat] || 0 } };
		return { name: 'x', country: c, general: g, units: [{ type: `generic:${cat}:${age}`, count: warRegs(mods, cat, age) }] };
	}
	return { name: 'x', country: c, general: g, units: [{ type: `generic:${cat}:${age}`, count: Math.round(30 * VIEWS[view](mods, cat)) }] };
}
const sum = list => { const o = {}; for (const m of list) for (const [k, v] of Object.entries(m)) o[k] = (o[k] || 0) + v; return o; };
const paths = [];
const rec = (i, picks) => { if (i === AGES.length) { paths.push(picks); return; } for (const b of AGES[i].branches) rec(i + 1, [...picks, b]); };
rec(0, []);
(async () => {
	const t0 = Date.now();
	const report = {};
	for (const view of Object.keys(VIEWS)) {
		const scoreOf = {};
		for (const [ai, a] of AGES.entries()) {
			const states = new Map();
			for (const p of paths) {
				const mods = sum(p.slice(0, ai + 1).map(b => b.mods));
				const key = relevant(mods, a.n, view);
				if (!states.has(key)) states.set(key, { mods, weight: 0, names: new Set() });
				const st = states.get(key); st.weight++; st.names.add(p.slice(0, ai + 1).map(b => b.name).join(' > '));
			}
			const list = [...states.entries()];
			const total = list.reduce((t, [, s]) => t + s.weight, 0);
			const jobs = [];
			for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
				const A = list[i][1].mods, B = list[j][1].mods;
				if (WAR) {
					const cat = a.n <= 4 ? 'hc' : 'hi', inc = m => baseIncome(cat, a.n) * (1 + (m.manpower || 0));
					jobs.push(pool.wars({ location: { frontage: 10 }, attacker: { armies: [side(A, a.n, view)] }, defender: { armies: [side(B, a.n, view)] } }, WARS,
						{ months: 48, interval: 2, sides: [{ income: inc(A) }, { income: inc(B) }] }, 7).then(w => [i, j, w.collapsed[1] + w.undecided / 2]));
					continue;
				}
				jobs.push(Promise.all([
					pool.mc({ location: { frontage: 10 }, attacker: { armies: [side(A, a.n, view)] }, defender: { armies: [side(B, a.n, view)] } }, N, { seed: 7 }),
					pool.mc({ location: { frontage: 10 }, attacker: { armies: [side(B, a.n, view)] }, defender: { armies: [side(A, a.n, view)] } }, N, { seed: 7 }),
				]).then(([m1, m2]) => [i, j, ((m1.wins[0] + m1.draws / 2) + (m2.wins[1] + m2.draws / 2)) / (2 * N)]));
			}
			const wr = new Map((await Promise.all(jobs)).map(([i, j, v]) => [i + ',' + j, v]));
			scoreOf[a.n] = {};
			list.forEach(([key], i) => {
				let t = 0;
				list.forEach(([, o], j) => { t += (i === j ? 0.5 : i < j ? wr.get(i + ',' + j) : 1 - wr.get(j + ',' + i)) * o.weight; });
				scoreOf[a.n][key] = t / total;
			});
		}
		const ranked = paths.map(p => {
			const per = AGES.map((a, ai) => scoreOf[a.n][relevant(sum(p.slice(0, ai + 1).map(b => b.mods)), a.n, view)]);
			return { path: p.map(b => b.name).join(' > '), per, avg: per.reduce((t, x) => t + x, 0) / per.length };
		}).sort((x, y) => y.avg - x.avg);
		report[view] = { ranked, scoreOf };
		console.log(`\n=== parity: ${view} (score = win rate vs a random path; ages 2..6, average)`);
		// best pick per age assuming the best path so far
		ranked.slice(0, 8).forEach(r => console.log(`  ${r.path.padEnd(72)}${r.per.map(x => String(Math.round(100 * x)).padStart(4)).join('')}  avg ${Math.round(100 * r.avg)}%`));
		console.log('  ...');
		ranked.slice(-3).forEach(r => console.log(`  ${r.path.padEnd(72)}${r.per.map(x => String(Math.round(100 * x)).padStart(4)).join('')}  avg ${Math.round(100 * r.avg)}%`));
		// per-age pick value: average score of states reached by each branch at that age
		for (const [ai, a] of AGES.entries()) {
			const by = a.branches.map(b => {
				const ps = paths.filter(p => p[ai] === b);
				return `${b.name} ${Math.round(100 * ps.reduce((t, p) => t + scoreOf[a.n][relevant(sum(p.slice(0, ai + 1).map(x => x.mods)), a.n, view)], 0) / ps.length)}%`;
			});
			console.log(`  age ${a.n} picks (average over paths): ${by.join(', ')}`);
		}
	}
	// realistic mix: gold matters until age III, manpower from age IV (Reformation)
	if (!WAR) {
	const G = Object.fromEntries(report.gold.ranked.map(x => [x.path, x.per])), M = Object.fromEntries(report.manpower.ranked.map(x => [x.path, x.per]));
	const mix = Object.keys(G).map(p => { const per = [G[p][0], G[p][1], M[p][2], M[p][3], M[p][4]]; return { path: p, per, avg: per.reduce((a, b) => a + b, 0) / 5 }; }).sort((x, y) => y.avg - x.avg);
	console.log('\n=== gold until age III, manpower from age IV');
	mix.slice(0, 6).forEach(r => console.log(`  ${r.path.padEnd(72)}${r.per.map(x => String(Math.round(100 * x)).padStart(4)).join('')}  avg ${Math.round(100 * r.avg)}%`));
	}
	require('fs').writeFileSync(path.join(__dirname, 'focus_picks_results.json'), JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, v.ranked])), null, 1));
	if (DRILL || WAIT) console.log(`\nExperience after drilling ${DRILL} months and waiting ${WAIT}: no picks ${exp({ drill: DRILL, wait: WAIT }).toFixed(1)}, Standing Forces ${exp({ gain: 0.25, drill: DRILL, wait: WAIT }).toFixed(1)}, Leadership ${exp({ gain: 0.5, decay: -0.02, drill: DRILL, wait: WAIT }).toFixed(1)}, both ${exp({ gain: 0.75, decay: -0.02, drill: DRILL, wait: WAIT }).toFixed(1)}`);
	console.log(`\n${N} battles a pairing each way, ${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
