// node .tools/scripts/battle_sim/analysis/focus_picks_round_robin.js [battles per pairing, default 120]   (~3 min)
// Round-robin: at each age, every distinct battle-relevant pick state fights every other (budget view, both sides
// alternating as attacker). A state's score = expected win rate against a random opponent path (states weighted by how
// many of the 3^k paths reach them). Same assumptions as focus.js.
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const { ages } = require('../../focus_picks/focus_data.js');
const N = +process.argv[2] || 120;
const MAP = {
	discipline: 'discipline', military_tactics: 'tactics', land_morale_modifier: 'moraleMod', land_morale: 'moraleFlat',
	army_initiative: 'initiativeMod', combat_speed_modifier: 'speedMod', possible_frontage_modifier: 'frontageMod',
	army_heavy_infantry_power: 'power.hi', army_heavy_cavalry_power: 'power.hc',
	army_maintenance_efficiency: 'maint', army_heavy_cavalry_maintenance_cost_modifier: 'maintCost.hc', army_heavy_infantry_maintenance_cost_modifier: 'maintCost.hi',
	monthly_experience_gain: 'expGain', experience_decay: 'expDecay', train_general_ability: 'genAbility', monthly_army_tradition: 'atGain',
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
const relevant = (mods, age) => { // drop stats that do nothing for the meta army of that age
	const o = { ...mods }; const cav = age <= 4;
	if (cav) { delete o['power.hi']; delete o['maintCost.hi']; } else { delete o['power.hc']; delete o['maintCost.hc']; }
	return JSON.stringify(Object.keys(o).sort().map(k => [k, +o[k].toFixed(4)]));
};
function side(mods, age) {
	const cat = age <= 4 ? 'hc' : 'hi';
	const g = Math.min(100, 40 + (mods.genAbility || 0) + (mods.atGain ? 12.5 : 0));
	const c = { tactics: 1 + (mods.tactics || 0), discipline: mods.discipline || 0, moraleMod: (mods.moraleMod || 0) + (mods.atGain ? 0.05 : 0), moraleFlat: mods.moraleFlat || 0,
		initiativeMod: mods.initiativeMod || 0, speedMod: mods.speedMod || 0, frontageMod: mods.frontageMod || 0,
		experience: 10 * (1 + (mods.expGain || 0)) * 0.05 / (0.05 + (mods.expDecay || 0)), power: {} };
	if (mods['power.' + cat]) c.power[cat] = mods['power.' + cat];
	const size = (1 + (mods.maint || 0)) / (1 + (mods['maintCost.' + cat] || 0));
	return { name: 'x', country: c, general: { adm: g, dip: g, mil: g }, units: [{ type: `generic:${cat}:${age}`, count: Math.round(30 * size) }] };
}
const sum = list => { const o = {}; for (const m of list) for (const [k, v] of Object.entries(m)) o[k] = (o[k] || 0) + v; return o; };
const paths = [];
const rec = (i, picks) => { if (i === AGES.length) { paths.push(picks); return; } for (const b of AGES[i].branches) rec(i + 1, [...picks, b]); };
rec(0, []);
const scoreOf = {}; // age -> state key -> score
for (const [ai, a] of AGES.entries()) {
	const states = new Map(); // key -> { mods, weight, prefixes }
	for (const p of paths) {
		const mods = sum(p.slice(0, ai + 1).map(b => b.mods));
		const key = relevant(mods, a.n);
		if (!states.has(key)) states.set(key, { mods, weight: 0, names: new Set() });
		const st = states.get(key); st.weight++; st.names.add(p.slice(0, ai + 1).map(b => b.name).join(' > '));
	}
	const list = [...states.entries()];
	const total = list.reduce((t, [, s]) => t + s.weight, 0);
	const wr = new Map();
	for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
		const A = list[i][1], B = list[j][1];
		let w = 0;
		for (const [x, y, me] of [[side(A.mods, a.n), side(B.mods, a.n), 0], [side(B.mods, a.n), side(A.mods, a.n), 1]]) {
			const m = S.monteCarloScenario({ location: { frontage: 10 }, attacker: { armies: [x] }, defender: { armies: [y] } }, N, { seed: 7 + i * 31 + j });
			w += (m.wins[me] + m.draws / 2) / N;
		}
		wr.set(i + ',' + j, w / 2);
	}
	const score = list.map(([key, s], i) => {
		let t = 0;
		list.forEach(([, o], j) => { const v = i === j ? 0.5 : i < j ? wr.get(i + ',' + j) : 1 - wr.get(j + ',' + i); t += v * o.weight; });
		return { key, score: t / total, s };
	});
	scoreOf[a.n] = Object.fromEntries(score.map(x => [x.key, x.score]));
	score.sort((x, y) => y.score - x.score);
	console.log(`\nAge ${a.n}: ${list.length} distinct states; best and worst (score = win rate vs a random path):`);
	const show = x => `  ${Math.round(100 * x.score).toString().padStart(3)}%  ${[...x.s.names].slice(0, 3).join(' | ')}${x.s.names.size > 3 ? ` (+${x.s.names.size - 3} same)` : ''}`;
	score.slice(0, 5).forEach(x => console.log(show(x)));
	if (score.length > 6) console.log('  ...');
	score.slice(-Math.min(3, score.length - 5)).forEach(x => console.log(show(x)));
}
// full paths: average score over ages
const ranked = paths.map(p => {
	const per = AGES.map((a, ai) => scoreOf[a.n][relevant(sum(p.slice(0, ai + 1).map(b => b.mods)), a.n)]);
	return { path: p.map(b => b.name).join(' > '), per, avg: per.reduce((t, x) => t + x, 0) / per.length };
}).sort((x, y) => y.avg - x.avg);
console.log('\nWhole paths (ages 2..6 scores, average):');
ranked.slice(0, 10).forEach(r => console.log(`  ${r.path.padEnd(72)}${r.per.map(x => String(Math.round(100 * x)).padStart(4)).join('')}  avg ${Math.round(100 * r.avg)}%`));
console.log('  ...');
ranked.slice(-5).forEach(r => console.log(`  ${r.path.padEnd(72)}${r.per.map(x => String(Math.round(100 * x)).padStart(4)).join('')}  avg ${Math.round(100 * r.avg)}%`));
