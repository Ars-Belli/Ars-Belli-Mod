// node .tools/scripts/battle_sim/analysis/composition_rules.js [battles, default 400]
// Equal-gold compositions, vanilla vs frontage-by-men (+ positional roles). Budget = 36 heavy infantry regiments of the age.
const S = require('../engine.js');
const DBJ = require('../units.json');
S.setUnitDB(DBJ);
const N = +process.argv[2] || 400;
const base = JSON.parse(JSON.stringify({ CAT: S.CAT, B: S.D.BOMBARD_CHANCE }));
const PRICE = DBJ.catPrice; // build gold per 100 men
const size = (c, age) => S.AGE[c][age - 1][1];
const cost = (c, age) => PRICE[c].b[0] * size(c, age) / 0.1;
// compositions as gold shares
const COMPS = {
	'all cavalry': { hc: 1 },
	'all infantry': { hi: 1 },
	'inf 70 / cav 30': { hi: 0.7, hc: 0.3, f: 'cav_inf_cav' },
	'inf 55 / cav 25 / guns 20': { hi: 0.55, hc: 0.25, art: 0.2, f: 'cav_inf_cav' },
};
const RULES = {
	'vanilla (frontage 1 a regiment)': {},
	'G: frontage = men / 1,000': { frontageByMen: true },
	'H: G + positional roles + combined arms 5%': {
		frontageByMen: true, combined: { per: 0.05, max: 0.75 }, cavFlank: 2.5, cavSecure: -0.25, infSecure: 0.15, artSecure: 0.35, artDt: 1.0, bombard: 0.4,
	},
};
function apply(r, age) {
	for (const k of ['hc', 'lc', 'hi', 'li', 'art']) { Object.assign(S.CAT[k], base.CAT[k]); delete S.CAT[k].f; }
	S.D.BOMBARD_CHANCE = base.B;
	if (r.frontageByMen) for (const k of ['hc', 'lc', 'hi', 'li', 'art']) S.CAT[k].f = Math.max(0.25, Math.round(size(k, age) * 4) / 4);
	if (r.cavFlank) S.CAT.hc.fl = S.CAT.lc.fl = r.cavFlank;
	if (r.cavSecure != null) S.CAT.hc.sf = S.CAT.lc.sf = r.cavSecure;
	if (r.infSecure) S.CAT.hi.sf = S.CAT.li.sf = r.infSecure;
	if (r.artSecure) S.CAT.art.sf = r.artSecure;
	if (r.artDt) S.CAT.art.dt = r.artDt;
	if (r.bombard) S.D.BOMBARD_CHANCE = r.bombard;
}
const army = (comp, age, r) => {
	const budget = 36 * cost('hi', age);
	const units = ['hi', 'hc', 'art'].filter(k => comp[k]).map(k => ({ type: `generic:${k}:${age}`, count: Math.max(1, Math.round(budget * comp[k] / cost(k, age))) }));
	return { name: 'x', formation: comp.f || 'balanced', country: r.combined ? { combinedPerType: r.combined.per, combinedMax: r.combined.max } : {}, units };
};
for (const [rname, r] of Object.entries(RULES)) {
	console.log(`\n=== ${rname}: average win rate vs the other three, equal gold (frontage 10)`);
	console.log(''.padEnd(28) + [2, 3, 4, 5, 6].map(a => `age ${a}`.padStart(9)).join(''));
	const res = {};
	for (const age of [2, 3, 4, 5, 6]) {
		apply(r, age);
		for (const [a, ca] of Object.entries(COMPS)) {
			let w = 0, n = 0;
			for (const [b, cb] of Object.entries(COMPS)) {
				if (a === b) continue;
				for (const [x, y, me] of [[ca, cb, 0], [cb, ca, 1]]) {
					const m = S.monteCarloScenario({ location: { frontage: 10 }, attacker: { armies: [army(x, age, r)] }, defender: { armies: [army(y, age, r)] } }, N, { seed: 21 });
					w += (m.wins[me] + m.draws / 2) / N; n++;
				}
			}
			(res[a] = res[a] || []).push(w / n);
		}
	}
	for (const [a, v] of Object.entries(res)) console.log(a.padEnd(28) + v.map(x => `${Math.round(100 * x)}%`.padStart(9)).join(''));
}
apply({}, 2);
console.log('\nregiments at equal gold (age 2 / age 5):', Object.entries(COMPS).map(([k, c]) => k + ': ' + [2, 5].map(a => army(c, a, {}).units.map(u => u.count + ' ' + u.type.split(':')[1]).join('+')).join(' / ')).join('; '));
