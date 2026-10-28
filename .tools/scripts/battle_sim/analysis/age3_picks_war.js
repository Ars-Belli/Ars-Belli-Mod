// node .tools/scripts/battle_sim/analysis/age3_picks_war.js [wars, default 200] [battles, default 1000] [armies, default 6] [--reinf-eff-manpower]
// Quality vs Quantity vs Leadership (each after Standing Forces), at the army size of the 1547 Spain save: 6 armies of 30
// heavy cavalry a side (Spain: 8 armies, 182 Lanzas). Does a pick win early and lose long wars, or the other way round?
// Each side brings 2 armies and feeds the rest in as its reserve runs empty (arrivalDay 'needed', 1 day's march), so every
// regiment fights. Columns: the first battle, and the war, which goes on until one side has exhausted its manpower (pool
// empty while short of men); both sides fight once fully reinforced (interval 'ready'), with battle experience, each pick's
// experience gain and decay, monarchy -1% decay.
// Views: same regiments, and 75/25 budgets (manpower x maintenance efficiency buys regiments; Quantity gets more).
// Drilling: none (experience 0.37) or 48 months then 6 idle, both sides. Generals 60/59/61; Leadership's trained 77.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const { ages } = require('../../focus_picks/focus_data.js');
const [WARS, N, K] = [+process.argv[2] || 200, +process.argv[3] || 1000, +process.argv[4] || 6];
// --reinf-eff-manpower: army_reinforce_efficiency also divides reinforcement manpower (what the in-game tooltip says)
const PATCH = process.argv.includes('--reinf-eff-manpower') ? { D: { REINFORCE_EFF_MANPOWER: true } } : undefined;
const AGE = 3, CAT = 'hc', UNIT = `generic:${CAT}:${AGE}`, BASE_MAINT = 0.25, MON = -0.01;
const CHAR = { adm: 60, dip: 59, mil: 61 }, TRAINED = 77;
const MAP = {
	discipline: 'discipline', military_tactics: 'tactics', land_morale_modifier: 'moraleMod', land_morale: 'moraleFlat',
	army_initiative: 'initiativeMod', combat_speed_modifier: 'speedMod', possible_frontage_modifier: 'frontageMod',
	army_heavy_cavalry_power: 'power', army_maintenance_efficiency: 'maint', army_heavy_cavalry_maintenance_cost_modifier: 'maintCost',
	global_manpower_modifier: 'manpower', regiment_reinforcement_speed: 'reinforceSpeed', army_reinforce_efficiency: 'reinfEff',
	army_heavy_cavalry_reinforce_cost_modifier: 'reinfCost', monthly_experience_gain: 'expGain', experience_decay: 'expDecay',
	train_general_ability: 'genAbility', monthly_army_tradition: 'atGain',
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
const upkeep = m => 0.04 * S.AGE[CAT][AGE - 1][1] * 1000 * (1 + (m.maintCost || 0)) / (1 + BASE_MAINT + (m.maint || 0)); // men a month a regiment
const BASE_INCOME = K * 30 * upkeep({}) / 0.75;
const income = m => BASE_INCOME * (1 + (m.manpower || 0));
const perArmy = (m, view) => view === 'budget' ? Math.round(0.75 * income(m) / upkeep(m) / K) : 30;
function side(m, view, drill) {
	const decay = (m.expDecay || 0) + MON;
	const c = {
		tactics: 1 + (m.tactics || 0), discipline: m.discipline || 0, moraleMod: (m.moraleMod || 0) + (m.atGain ? 0.04 : 0), moraleFlat: m.moraleFlat || 0,
		initiativeMod: m.initiativeMod || 0, speedMod: m.speedMod || 0, frontageMod: m.frontageMod || 0, power: m.power ? { [CAT]: m.power } : {},
		experience: drill ? S.drilledExperience({ gain: m.expGain || 0, decay, drill: 48, wait: 6 }) : 0.37,
		maintenanceEfficiency: BASE_MAINT + (m.maint || 0), reinforceSpeed: m.reinforceSpeed || 0, reinforceEfficiency: m.reinfEff || 0,
		costMod: { maintenance: { [CAT]: m.maintCost || 0 }, reinforce: { [CAT]: m.reinfCost || 0 } },
	};
	const g = m.genAbility ? { adm: Math.max(CHAR.adm, TRAINED), dip: Math.max(CHAR.dip, TRAINED), mil: Math.max(CHAR.mil, TRAINED) } : CHAR;
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
		console.log('A beats B                       first battle   war (B runs out of manpower first)   battles   months   end experience A / B');
		for (let i = 0; i < PICKS.length; i++) for (let j = i + 1; j < PICKS.length; j++) {
			const A = side(PICKS[i].mods, view, drill), B = side(PICKS[j].mods, view, drill);
			const [m1, m2] = await Promise.all([pool.mc({ location: { frontage: 10 }, attacker: A, defender: B }, N, { seed: 3 }), pool.mc({ location: { frontage: 10 }, attacker: B, defender: A }, N, { seed: 3 })]);
			const battle = ((m1.wins[0] + m1.draws / 2) + (m2.wins[1] + m2.draws / 2)) / (2 * N);
			const opt = sd => ({ endOn: 'manpower', interval: 'ready', sides: sd });
			const [w1, w2] = await Promise.all([
				pool.wars({ location: { frontage: 10 }, attacker: A, defender: B }, WARS, opt([warSide(PICKS[i].mods), warSide(PICKS[j].mods)]), 5, PATCH),
				pool.wars({ location: { frontage: 10 }, attacker: B, defender: A }, WARS, opt([warSide(PICKS[j].mods), warSide(PICKS[i].mods)]), 5, PATCH),
			]);
			const war = ((w1.collapsed[1] + w1.undecided / 2) + (w2.collapsed[0] + w2.undecided / 2)) / 2;
			console.log(`  ${(PICKS[i].name + ' vs ' + PICKS[j].name).padEnd(28)}${pct(battle).padStart(14)}${pct(war).padStart(22)}${((w1.battles + w2.battles) / 2).toFixed(1).padStart(22)}${((w1.months + w2.months) / 2).toFixed(0).padStart(9)}${((w1.exp[0] + w2.exp[1]) / 2).toFixed(0).padStart(12)} / ${((w1.exp[1] + w2.exp[0]) / 2).toFixed(0)}`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
