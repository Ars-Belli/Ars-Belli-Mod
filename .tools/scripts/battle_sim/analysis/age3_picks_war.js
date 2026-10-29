// node .tools/scripts/battle_sim/analysis/age3_picks_war.js [wars, default 200] [battles, default 1000] [armies, default 6]
//      [--age 3 --cat hc] [--reinf-eff-gold-only]
// Quality vs Quantity vs Leadership (each after Standing Forces), at the army size of the 1547 Spain save: 6 armies of 30
// heavy cavalry a side (Spain: 8 armies, 182 Lanzas). Does a pick win early and lose long wars, or the other way round?
// Each side brings 2 armies and feeds the rest in as its reserve runs empty (arrivalDay 'needed', 1 day's march), so every
// regiment fights. Columns: A's first-battle win rate, then the gap in manpower reserve after 12 / 24 / 48 months of war: each
// side's pool, after paying for the men its army still misses, as a share of its max pool (5 years of income), A minus B, in
// points (+30 = A has 30% of its max pool more left). Both sides fight once fully reinforced (interval 'ready'), with battle
// experience, each pick's experience gain and decay, monarchy -1% decay.
// Views: same regiments, and 75/25 budgets (manpower x maintenance efficiency buys regiments; Quantity gets more).
// Drilling: none (experience 0.37) or 48 months then 6 idle, both sides. Generals 60/59/61; Leadership's trained 77.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const { ages } = require('../../focus_picks/focus_data.js');
const pos = process.argv.slice(2).filter((a, i, arr) => !a.startsWith('--') && !(arr[i - 1] || '').startsWith('--'));
const [WARS, N, K] = [+pos[0] || 200, +pos[1] || 1000, +pos[2] || 6];
// --reinf-eff-gold-only: army_reinforce_efficiency divides reinforcement gold only (the game divides manpower too)
const MONTHS = [12, 24, 48];
const PATCH = process.argv.includes('--reinf-eff-gold-only') ? { D: { REINFORCE_EFF_MANPOWER: false } } : undefined;
const argOf = k => { const i = process.argv.indexOf(k); return i < 0 ? null : process.argv[i + 1]; };
// --age N --cat hc|hi: the armies' unit (default age 3 heavy cavalry); the picks stay Standing Forces + the age III pick
const AGE = +(argOf('--age') || 3), CAT = argOf('--cat') || 'hc', UNIT = `generic:${CAT}:${AGE}`, BASE_MAINT = 0.25, MON = -0.01;
const CATNAME = { hc: 'heavy_cavalry', hi: 'heavy_infantry', lc: 'light_cavalry', li: 'light_infantry' }[CAT];
const UPKEEP_PRICE = CAT === 'hc' || CAT === 'lc' ? 0.04 : 0.02; // manpower upkeep a man a month (prices/02_units.txt)
const CHAR = { adm: 60, dip: 59, mil: 61 };
// Army tradition decays 0.5% of itself a month (auto_modifiers), so it settles at monthly gain / 0.005. Typical sources: Martial
// Society +0.05, army experience ~+0.01, advances like Castile's Masters of the Orders +0.05: about AT 20. Leadership adds +0.2 a
// month and its player maximises tradition: about AT 60. Tradition gives +0.2% morale a point. Trained generals
// (generic_actions/train_general.txt) roll each skill in [10 + AT/2, 50 + AT/2] + train_general_ability, capped at 100.
// Country baseline (Spain 1547, the user's tooltips): discipline +28.56% (nobles ratio, Aristocracy, Masters of the Orders, Military
// Orders, Primacy of Nobility); morale +20.3% from laws, privileges and the ruler (Military Orders 10%, doctrine 5%, ruler 5.3%) on top
// of army tradition; flat land morale from the vanilla age advances (Medieval Military, Pike and Shot, Maurician Infantry,
// Gustavian Infantry, Impulse Warfare), cumulative by age. Spain 1547: (3 + 0.5) x 1.277 = 4.47 (game 4.46).
const BASE_DISC = 0.2856, BASE_MORALE = 0.203, FLAT_MORALE = [0, 0.25, 0.5, 0.8, 1.15, 1.55];
const AT_BASE = 20, AT_LEADERSHIP = 70; // Leadership: +0.2 a month and decay 0.4% (Quality Education -0.1%): ~0.29 / 0.004
const trained = (at, ability) => { let t = 0, n = 0; for (let x = Math.ceil(10 + at / 2); x <= Math.floor(50 + at / 2); x++, n++) t += Math.min(100, x + ability); return t / n; };
const AT = m => m.atGain ? AT_LEADERSHIP : AT_BASE;
const MAP = {
	discipline: 'discipline', military_tactics: 'tactics', land_morale_modifier: 'moraleMod', land_morale: 'moraleFlat',
	army_initiative: 'initiativeMod', combat_speed_modifier: 'speedMod', possible_frontage_modifier: 'frontageMod',
	[`army_${CATNAME}_power`]: 'power', army_maintenance_efficiency: 'maint', [`army_${CATNAME}_maintenance_cost_modifier`]: 'maintCost',
	global_manpower_modifier: 'manpower', regiment_reinforcement_speed: 'reinforceSpeed', army_reinforce_efficiency: 'reinfEff',
	[`army_${CATNAME}_reinforce_cost_modifier`]: 'reinfCost', monthly_experience_gain: 'expGain', experience_decay: 'expDecay',
	train_general_ability: 'genAbility', monthly_army_tradition: 'atGain', correct_box_chance: 'correctBox',
};
const branch = (age, name) => {
	const b = ages.find(a => a.n === age).mil.find(x => x.name === name), o = {};
	for (const [, mods] of b.adv) for (const line of (mods || '').split('\n')) {
		const m = /^\s*([a-z_]+)\s*=\s*(-?[\d.]+)/.exec(line);
		if (m && MAP[m[1]]) o[MAP[m[1]]] = (o[MAP[m[1]]] || 0) + parseFloat(m[2]);
	}
	return o;
};
const add = (...l) => { const o = {}; for (const m of l) for (const [k, v] of Object.entries(m)) o[k] = (o[k] || 0) + v; return o; };
const PICKS = ['Quality', 'Quantity', 'Leadership'].map(p => ({ name: p, mods: add(branch(2, 'Standing Forces'), branch(3, p)) }));
const upkeep = m => UPKEEP_PRICE * S.AGE[CAT][AGE - 1][1] * 1000 * (1 + (m.maintCost || 0)) / (1 + BASE_MAINT + (m.maint || 0)); // men a month a regiment
const BASE_INCOME = K * 30 * upkeep({}) / 0.75;
const income = m => BASE_INCOME * (1 + (m.manpower || 0));
const perArmy = (m, view) => view === 'budget' ? Math.round(0.75 * income(m) / upkeep(m) / K) : 30;
function side(m, view, drill) {
	const decay = (m.expDecay || 0) + MON;
	const c = {
		tactics: 1 + (m.tactics || 0), discipline: BASE_DISC + (m.discipline || 0), moraleMod: BASE_MORALE + (m.moraleMod || 0) + 0.002 * AT(m), moraleFlat: FLAT_MORALE[AGE - 1] + (m.moraleFlat || 0),
		initiativeMod: m.initiativeMod || 0, speedMod: m.speedMod || 0, frontageMod: m.frontageMod || 0, power: m.power ? { [CAT]: m.power } : {},
		experience: drill ? S.drilledExperience({ gain: m.expGain || 0, decay, drill: 48, wait: 6 }) : 0.37,
		// correct section chance: vanilla age advances +10% each from the Renaissance (age II), plus picks (Leadership +30%)
		correctBoxChance: 0.1 * (AGE - 1) + (m.correctBox || 0),
		maintenanceEfficiency: BASE_MAINT + (m.maint || 0), reinforceSpeed: m.reinforceSpeed || 0, reinforceEfficiency: m.reinfEff || 0,
		costMod: { maintenance: { [CAT]: m.maintCost || 0 }, reinforce: { [CAT]: m.reinfCost || 0 } },
	};
	const tg = m.genAbility ? trained(AT(m), m.genAbility) : 0;
	const g = { adm: Math.max(CHAR.adm, tg), dip: Math.max(CHAR.dip, tg), mil: Math.max(CHAR.mil, tg) };
	return { armies: Array.from({ length: K }, (_, k) => ({ general: g, country: c, units: [{ type: UNIT, count: perArmy(m, view) }], ...(k < 2 ? {} : { arrivalDay: 'needed', marchDays: 1 }) })) };
}
const warSide = m => ({ income: income(m), expGain: m.expGain || 0, expDecay: Math.max(0, 0.04 + (m.expDecay || 0) + MON) });
const pct = x => `${Math.round(100 * x)}%`.padStart(6);
(async () => {
	const t0 = Date.now();
	console.log(`${K} armies a side of ${UNIT}; ${N} battles and ${WARS} wars per seat order. Picks after Standing Forces:`);
	for (const p of PICKS) console.log(`  ${p.name}: ${JSON.stringify(p.mods)}`);
	for (const drill of [false, true]) for (const view of ['same', 'budget']) {
		console.log(`\n=== ${view === 'same' ? 'same regiments' : '75/25 budgets'}, ${drill ? 'drilled 48 months + 6 idle' : 'no drilling'}` +
			`  (regiments a side: ${PICKS.map(p => `${p.name} ${K * perArmy(p.mods, view)}`).join(', ')}; experience: ${PICKS.map(p => side(p.mods, view, drill).armies[0].country.experience.toFixed(0)).join(' / ')})`);
		console.log('A vs B                       1st battle   A minus B manpower reserve, points of max pool (battles fought), after ' + MONTHS.map(m => m + ' months').join(' / '));
		for (let i = 0; i < PICKS.length; i++) for (let j = i + 1; j < PICKS.length; j++) {
			const A = side(PICKS[i].mods, view, drill), B = side(PICKS[j].mods, view, drill);
			const [m1, m2] = await Promise.all([pool.mc({ location: { frontage: 10 }, attacker: A, defender: B }, N, { seed: 3 }), pool.mc({ location: { frontage: 10 }, attacker: B, defender: A }, N, { seed: 3 })]);
			const battle = ((m1.wins[0] + m1.draws / 2) + (m2.wins[1] + m2.draws / 2)) / (2 * N);
			const cells = [];
			for (const months of MONTHS) {
				const opt = sd => ({ months, endOn: 'none', interval: 'ready', collapseAt: 0, sides: sd });
				const [w1, w2] = await Promise.all([
					pool.wars({ location: { frontage: 10 }, attacker: A, defender: B }, WARS, opt([warSide(PICKS[i].mods), warSide(PICKS[j].mods)]), 5, PATCH),
					pool.wars({ location: { frontage: 10 }, attacker: B, defender: A }, WARS, opt([warSide(PICKS[j].mods), warSide(PICKS[i].mods)]), 5, PATCH),
				]);
				// A's reserve minus B's, both seat orders; half-width of the 95% interval from the two halves
				const d = (w1.reserveDiff - w2.reserveDiff) / 2, h = ((w1.reserveDiffCI[1] - w1.reserveDiffCI[0]) + (w2.reserveDiffCI[1] - w2.reserveDiffCI[0])) / 8;
				cells.push(`${d >= 0 ? '+' : ''}${Math.round(100 * d)} ±${Math.round(100 * h)}`.padStart(11) + ` (${((w1.battles + w2.battles) / 2).toFixed(1)})`);
			}
			console.log(`  ${(PICKS[i].name + ' vs ' + PICKS[j].name).padEnd(28)}${pct(battle).padStart(8)}  ${cells.join('  ')}`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
