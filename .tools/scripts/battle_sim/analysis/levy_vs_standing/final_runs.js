// Picks each checkpoint's armory plan from the sweep and reruns it under both focuses, with the levy at that year.
//   node final_runs.js --country cas [--variant name]
// A plan qualifies for year T if the treasury never went below zero up to T and net income is not negative at T; the best is the most manpower at T.
// Economy runs use the focus's modifiers from focus_data.js, plus the variant's. Age II levy units are unlocked for both sides: see README.md.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const R = path.join(__dirname, '../..'), LS = path.join(R, '../location_sim');
const { ages } = require(path.join(R, '../focus_picks/focus_data.js'));
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const TAG = flag('--country', 'cas'), VARIANT = flag('--variant', 'base');
const VARIANTS = JSON.parse(fs.readFileSync(path.join(__dirname, 'variants.json'), 'utf8'));
const YEARS = [10, 30, 50];
const UNLOCK = 'armory_advance,unlock_peasant_levy_advance,aristocracy,unlock_men_at_arms_advance,unlock_camel_2_advance';
const grid = JSON.parse(fs.readFileSync(path.join(__dirname, 'results', `grid_${TAG}.json`), 'utf8'));
const pick = T => {
	let best = null;
	for (const r of grid.runs) {
		const upTo = r.years.filter(y => y.year <= T), at = upTo[upTo.length - 1];
		if (Math.min(...upTo.map(y => y.treasury)) < 0 || at.net < 0) continue;
		if (!best || at.manpower > best.at.manpower + 1e-9) best = { label: r.label, at };
	}
	return best;
};
const focusMods = id => {
	const f = ages.find(a => a.n === 2).mil.find(x => x.id === id), m = {};
	for (const [, text] of f.adv) for (const line of String(text).split('\n')) { const [k, v] = line.split('=').map(x => x.trim()); if (k && !Number.isNaN(+v)) m[k] = (m[k] || 0) + +v; }
	for (const [k, v] of Object.entries((VARIANTS[VARIANT] || {})[id] || {})) m[k] = (m[k] || 0) + v;
	return Object.entries(m).map(([k, v]) => `${k}=${v >= 0 ? '+' : ''}${v}`).join(',');
};
const plans = YEARS.map(T => ({ T, plan: pick(T) }));
for (const { T, plan } of plans) console.log(`year ${T}: plan ${plan.label}, ${(plan.at.manpower * 1000).toFixed(0)} men a month, ${plan.at.types.armory || 0} armories, net ${plan.at.net.toFixed(1)}`);
const planMods = l => (l === 'baseline' ? '' : l.replace(/\+/g, '+'));
const names = [], variants = [];
for (const { T, plan } of plans) for (const id of ['levy', 'standing_forces']) { names.push(`${id}@${T}`); variants.push([planMods(plan.label), focusMods(id)].filter(Boolean).join(',')); }
const out = path.join(__dirname, 'results', `final_${TAG}${VARIANT === 'base' ? '' : '_' + VARIANT}.json`);
const res = spawnSync('node', [path.join(LS, 'economy.js'), path.join(LS, 'scenarios/local', `${TAG}_1338_04.json`), '--years', '50', '--quiet', '--unlock', UNLOCK, '--levy-years', '10,30,50', '--compare', ...variants, '--json', out], { encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'inherit'] });
if (res.status) { console.error(res.stdout.slice(-2000)); process.exit(res.status); }
const J = JSON.parse(fs.readFileSync(out, 'utf8'));
J.runs.shift(); // the plain baseline economy.js always runs
J.runs.forEach((r, i) => { r.variantText = r.label; r.label = names[i]; });
J.plans = plans.map(({ T, plan }) => ({ year: T, plan: plan.label }));
fs.writeFileSync(out, JSON.stringify(J, null, '\t'));
console.log('wrote', path.basename(out));
for (const r of J.runs) { const T = +r.label.split('@')[1], y = r.years.find(v => v.year === T); console.log(r.label.padEnd(24), `${(y.manpower * 1000).toFixed(0)} men/mo, levy ${r.levies[T].reduce((t, u) => t + u.men, 0).toFixed(1)}k, ${y.types.armory || 0} armories, crown ${y.crown.toFixed(0)}, net ${y.net.toFixed(1)}`); }
