// EU5 1.4.4 land battle simulator engine (v3).
// Mechanics read from eu5.exe 1.4.4; see "EU5 Combat Mechanics (1.4.4).md" in the repo root.
// Unit stats come from units.json (build_units.js). Works in the browser (window.BattleSim) and Node.
(function (root) {
	'use strict';

	const D = {
		COMBAT_BASE: 5, COMBAT_MAX: 15, DICE_SIDES: 10, DAMAGE_MULT: 0.12,
		STR_MOD: 0.04, MOR_MOD: 0.25, DAILY_MORALE: 0.03, DAYS_PER_PHASE: 4, MIN_DAYS: 5, BOMBARD_DAYS: 3,
		COLLAPSE: 0.05,            // absolute morale points (MORALE_COLLAPSE_THRESHOLD)
		LOW_MORALE: 0.5,           // absolute; below it a lost battle is a shattered retreat
		MIN_STRENGTH: 0.001,       // regiments with less strength (thousands of men) leave the line
		LINE_EMPTY: 0.01,          // a section counts as empty below this total strength
		INIT_BASE: 0.6, INIT_EACH: 0.025, INIT_MAX: 0.3, INIT_DAY: 0.03,
		SPEED_SCALE: 0.1, OVERSTACK: 1.25, SIZE_RATIO_MAX: 4, LEVY_IMPACT: 0.75, EXP_RED: 0.5,
		NOT_ENG_STR: 1.1, NOT_ENG_MOR: 1.2, INITIAL_OVERRUN: 10, MORALE_OVERRUN: 2,
		BOMBARD_CHANCE: 0.2, LAND_MORALE: 3, LEVY_DISCIPLINE: -0.2, RETREAT_STRENGTH_DAMAGE: 0.1,
		COMBINED_PER_TYPE: 0.025, COMBINED_MIN: 0.1, COMBINED_MAX: 0.5,
		BASE_FRONTAGE: 10, MIN_FRONTAGE: 2, MOVEMENT_COST: 0.0069, MAX_DAYS: 400, // MAX_DAYS: a safety stop only (no game cap is known); Spain-size battles with high morale and experience run past 120 days
		REINFORCE_EFF_FLOOR: -0.5, MAINT_EFF_FLOOR: -0.95, LEVY_MAINTENANCE: 0.01, MONTHLY_REINFORCE: 0.25, MAX_MANPOWER_YEARS: 5, PRICE_SCALE: 0.1,
		EXPERIENCE_GAIN: 30, EXPERIENCE_DECAY: 0.05, REGULAR_DECAY: -0.01, // NCombat / country base value / is_army_regular
		// army_reinforce_efficiency divides reinforcement gold AND manpower (the modifier tooltip says so; checked on Spain 1527:
		// 7 Falconets taking 178.2 men a month each = 1,247 men cost 1,043 manpower = / 1.196 with +20% efficiency).
		REINFORCE_EFF_MANPOWER: true,
	};
	const CAT = {
		li: { name: 'Light infantry', dt: 1.0, sdd: -0.1, mdt: 0.1, i: 5, cs: 3, fl: 1.1, sf: 0.05 },
		hi: { name: 'Heavy infantry', dt: 1.0, sdd: 0, mdt: 0, i: 1, cs: 2, fl: 1.0, sf: 0.05 },
		lc: { name: 'Light cavalry', dt: 0.3, sdd: -0.1, mdt: 0.1, i: 5, cs: 5, fl: 1.6, sf: 0, ct: { jungle: -0.1, wetlands: -0.1, mountains: -0.1 } },
		hc: { name: 'Heavy cavalry', dt: 0.3, sdd: 0, mdt: 0, i: 2, cs: 5, fl: 1.6, sf: 0, ct: { jungle: -0.1, wetlands: -0.1, mountains: -0.1, river: -0.1 } },
		art: { name: 'Artillery', dt: 1.25, sdd: 0, mdt: 0, i: 1, cs: 1, fl: 1.0, sf: 0, bombard: 1 },
		aux: { name: 'Auxiliary', dt: 1.25, sdd: 0, mdt: 0, i: 1, cs: 0.1, fl: 1.0, sf: 0, aux: 1 },
	};
	const CATS = Object.keys(CAT);
	const AGE = {
		li: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		hi: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		lc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		hc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		art: [[2, 0.1], [3, 0.2], [4, 0.6], [5, 0.8], [5.5, 1.0], [7.5, 1.2]],
		aux: [[0.25, 0.05], [0.25, 0.1], [0.25, 0.15], [0.25, 0.2], [0.25, 0.25], [0.25, 0.3]],
	};
	const TERRAIN_FALLBACK = {
		topography: { flatland: [0, 0], mountains: [2, -4], hills: [1, -3], plateau: [1, -1], wetlands: [1, -3], narrows: [1, -2] },
		vegetation: { sparse: [0, 0], grasslands: [0, 0], farmland: [0, 0], woods: [1, -2], forest: [1, -3], jungle: [1, -4] },
		climate: {},
	};
	const MIRROR = { L: 'R', C: 'C', R: 'L' };
	const SECTIONS = ['C', 'L', 'R'];       // code order: centre (0x198), left (0xf0), right (0x240)
	const FALLBACK = ['C', 'L', 'R', 'reserve'];
	let DB = null;
	const setUnitDB = db => { DB = db; };

	function makeRng(seed) {
		if (seed == null) return Math.random;
		let s = seed >>> 0;
		return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	}
	const COUNTRY_DEFAULTS = {
		discipline: 0, tactics: 1.0, moraleMod: 0, moraleFlat: 0, initiativeMod: 0, speedMod: 0, levyCE: 0,
		commanderDice: 0, movementCost: D.MOVEMENT_COST, experience: 0, levyExperience: 0,
		power: {}, sdd: 0, sdt: 0, mdd: 0, mdt: 0, vsHeretic: 0, vsHeathen: 0, religion: null, religionGroup: null,
		combinedPerType: D.COMBINED_PER_TYPE, combinedMin: D.COMBINED_MIN, combinedMax: D.COMBINED_MAX,
		reinforceEfficiency: 0, maintenanceEfficiency: 0, reinforceSpeed: 0, levyMaintenance: 0, correctBoxChance: 0, frontageMod: 0, costMod: {},
	};
	// a general's skills (static_modifiers/character.txt general_adm/dip/mil, per point) and trait dice, on his army only
	const GENERAL_PER_POINT = { mil: { discipline: 0.001, speedMod: 0.005 }, dip: { moraleMod: 0.002, initiativeMod: 0.01 }, adm: { correctBoxChance: 0.001, frontageMod: 0.001 } };
	function withGeneral(c, g) {
		if (!g) return c;
		const o = { ...c, power: { ...c.power } };
		for (const [skill, mods] of Object.entries(GENERAL_PER_POINT)) for (const [k, x] of Object.entries(mods)) o[k] = (o[k] || 0) + x * (+g[skill] || 0);
		o.commanderDice = (o.commanderDice || 0) + (+g.dice || 0);
		return o;
	}
	const country = (spec, countries) => { const c = typeof spec === 'string' ? (countries && countries[spec]) || {} : spec || {}; return { ...COUNTRY_DEFAULTS, ...c, power: { ...(c.power || {}) } }; };

	function unitStats(type) {
		if (DB && DB.units && DB.units[type]) return DB.units[type];
		const m = /^generic:(li|hi|lc|hc|art|aux):([1-6])$/.exec(type || '');
		if (!m) throw new Error('unknown unit type ' + type + (DB ? '' : ' (no unit database loaded)'));
		const c = CAT[m[1]], [p, s] = AGE[m[1]][+m[2] - 1];
		return { n: `${c.name} (age ${m[2]})`, c: m[1], a: +m[2], levy: 0, p, s, i: c.i, cs: c.cs, f: c.f || 1, fl: c.fl, sf: c.sf, dt: c.dt, sdd: c.sdd, sdt: 0, mdd: c.mdd || 0, mdt: c.mdt, be: 0, bombard: c.bombard || 0, aux: c.aux || 0, ct: c.ct };
	}
	function terrainInfo(loc) {
		const t = (layer, key) => {
			const db = DB && DB.terrain && DB.terrain[layer];
			if (db && db[key]) return [db[key].defender, db[key].frontage];
			return (TERRAIN_FALLBACK[layer] || {})[key] || [0, 0];
		};
		const topo = t('topography', loc.topography || 'flatland'), veg = t('vegetation', loc.vegetation || 'farmland'), cli = t('climate', loc.climate || '');
		// local_frontage_allowed: 10 + terrain + location rank (town -1, city -2, megalopolis -3), at least 2 (0x14247a0d0)
		const frontage = loc.frontage != null ? loc.frontage : Math.max(D.MIN_FRONTAGE, D.BASE_FRONTAGE + topo[1] + veg[1] + cli[1] + (+loc.rankFrontage || 0));
		const crossing = { river: 1, strait: 2, landing: 1 }[loc.crossing] || 0;
		return { frontage, attackerDice: -(topo[0] + veg[0] + cli[0]) - crossing, keys: [loc.topography, loc.vegetation, loc.climate].filter(Boolean), river: !!loc.river, coastal: !!loc.coastal };
	}

	function buildArmy(army, sideIdx, armyIdx, countries) {
		const c = withGeneral(country(army.country, countries), army.general);
		const regs = [];
		const maxMor = (D.LAND_MORALE + c.moraleFlat) * (1 + c.moraleMod); // flat land_morale before the % (game tooltip)
		const startMorFrac = army.morale != null ? army.morale : Math.max(0, 1 - (army.marchDays || 0) * c.movementCost);
		for (const [gi, g] of (army.units || []).entries()) {
			const u = unitStats(g.type);
			const levy = g.levy != null ? !!g.levy : !!u.levy;
			for (let k = 0; k < (g.count | 0); k++) {
				const maxStr = u.s * (g.maxStrength || 1);
				const str = maxStr * (g.strength != null ? g.strength : 1);
				if (str < D.MIN_STRENGTH) continue; // an emptied regiment does not take part
				regs.push({
					side: sideIdx, army: armyIdx, grp: gi, type: g.type, name: u.n, cat: u.c, levy, u, c, maxStr, str, start: str,
					maxMor: Math.max(maxMor, +g.moraleAbs || 0), mor: g.moraleAbs != null ? +g.moraleAbs : maxMor * (g.morale != null ? g.morale : startMorFrac),
					disc: c.discipline + (levy ? D.LEVY_DISCIPLINE : 0) + (g.discipline || 0),
					exp: g.experience != null ? g.experience : (levy ? c.levyExperience : c.experience),
					prefSection: g.section || null, section: 'absent', engaged: false, target: null, pendStr: 0, pendMor: 0,
				});
			}
		}
		return { regs, c, army };
	}

	const levyFactor = c => Math.min(1, Math.max(0.05, D.LEVY_IMPACT + (1 - D.LEVY_IMPACT) * c.levyCE));
	const present = r => r.section !== 'absent' && r.section !== 'routed';
	const inLine = r => SECTIONS.includes(r.section);
	const canFight = r => present(r) && r.str >= D.MIN_STRENGTH && r.mor >= D.COLLAPSE;
	// overrun "men": every regiment of the side's armies in the battle, levies at their factor (0x143519150)
	const sideMen = regs => regs.reduce((t, r) => t + (r.section === 'absent' ? 0 : r.str * (r.levy ? levyFactor(r.c) : 1)), 0);

	// Formation boxes (the army's autobalance, as stored in saves): "balanced" deals regiments out in a snake,
	// C L R R L C C L R ...; "cav_inf_cav" snakes cavalry over L R R L ... and puts the rest in the centre.
	const SNAKE3 = ['C', 'L', 'R', 'R', 'L', 'C'], SNAKE2 = ['L', 'R', 'R', 'L'];
	function boxes(armyRegs, formation) {
		let i = 0, j = 0;
		for (const r of armyRegs) {
			if (r.u.aux) { r.box = null; continue; }
			if (r.prefSection) { r.box = r.prefSection; continue; }
			r.box = formation === 'cav_inf_cav' ? ((r.cat === 'lc' || r.cat === 'hc') ? SNAKE2[j++ % 4] : 'C') : SNAKE3[i++ % 6];
		}
	}
	// AddUnit (0x142473ae0): a regiment enters its box while that section holds less than 1.25 x W frontage, else
	// reserve. Armies arriving after the start reach their box only with correct_box_chance, else reserve.
	function deploy(armyRegs, formation, width, sideRegs, late, rng) {
		const cap = D.OVERSTACK * width;
		const used = s => sideRegs.filter(x => x.section === s && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0);
		boxes(armyRegs, formation);
		for (const r of armyRegs) {
			r.section = 'reserve';
			if (!r.box || r.box === 'reserve') continue;
			if (late && !(rng() < (r.c.correctBoxChance || 0))) continue;
			if (used(r.box) < cap) r.section = r.box;
		}
	}

	// Combined arms (0x142486dd0): regiment COUNT per category over the side's armies (auxiliaries excluded).
	// If any category is >= combined_arms_max_threshold of the regiments: no bonus at all.
	// Otherwise every category with >= combined_arms_min_percent_for_bonus adds combined_bonus_per_type.
	function combinedArms(regs, c) {
		const n = {}; let all = 0;
		for (const r of regs) if (r.section !== 'absent' && !r.u.aux) { n[r.cat] = (n[r.cat] || 0) + 1; all++; }
		if (!all) return 0;
		const shares = Object.values(n).map(x => x / all);
		if (Math.max(...shares) >= c.combinedMax) return 0;
		return shares.filter(s => s >= c.combinedMin).length * c.combinedPerType;
	}

	// Damage function 0x142482130: one hit of A on B
	function hit(A, B, ctx) {
		const { dice, flanking, secured, combinedA, terr, breakdown } = ctx;
		const ua = A.u, ub = B.u, ca = A.c, cb = B.c;
		let roll = dice + D.COMBAT_BASE;
		roll = roll <= 0 ? 1 : Math.min(roll, D.COMBAT_MAX);
		const base = roll * D.DAMAGE_MULT;
		let s = base * D.STR_MOD, m = base * D.MOR_MOD;
		const f = [];
		const both = (k, x) => { if (x === 1) return; s *= x; m *= x; if (breakdown) f.push([k, x, 'both']); };
		const mor = (k, x) => { if (x === 1) return; m *= x; if (breakdown) f.push([k, x, 'morale']); };
		const str = (k, x) => { if (x === 1) return; s *= x; if (breakdown) f.push([k, x, 'strength']); };
		mor('Relative strength (attacker men / max)', A.str / A.maxStr);
		if (D.SIZE_RATIO_MAX) mor('Regiment size (attacker ÷ target)', Math.min(D.SIZE_RATIO_MAX, Math.max(1 / D.SIZE_RATIO_MAX, A.maxStr / B.maxStr)));
		both('Unit power modifier', 1 + ((ca.power && ca.power[A.cat]) || 0));
		if (flanking) both('Flanking ability', ua.fl);
		both('Discipline', 1 + A.disc);
		both('Target discipline', 1 / (1 + B.disc));
		if (cb.religion && ca.religion && cb.religion !== ca.religion) both('Versus other religion', 1 + (ca.religionGroup && ca.religionGroup === cb.religionGroup ? ca.vsHeretic : ca.vsHeathen));
		both('Combat power', ua.p);
		if (cb.tactics > ca.tactics) both('Military tactics gap', 1 / (1 + (cb.tactics - ca.tactics)));
		if (A.levy && !B.levy) both('Levy vs regular', levyFactor(ca));
		str('Current strength (attacker men)', A.str);
		both('Target experience', 1 - D.EXP_RED * B.exp / 100);
		both('Target category damage taken', ub.dt);
		both('Combined arms', 1 + combinedA);
		if (secured) both('Target secured flanks', Math.max(0.05, 1 - secured * ub.sf));
		if (terr) {
			const ct = ua.ct || {};
			for (const k of terr.keys) if (ct[k]) both('Terrain: ' + k, 1 + ct[k]);
			const coast = terr.coastal ? 'coastal' : 'inland';
			if (ct[coast]) both('Terrain: ' + coast, 1 + ct[coast]);
			if (terr.river && ct.river) both('Terrain: river', 1 + ct.river);
		}
		str('Strength damage done', 1 + ua.sdd + ca.sdd);
		str('Target strength damage taken', 1 + ub.sdt + cb.sdt);
		mor('Morale damage done', 1 + ua.mdd + ca.mdd);
		mor('Target morale damage taken', 1 + ub.mdt + cb.mdt);
		if (!B.engaged) { str('Target not engaged', D.NOT_ENG_STR); mor('Target not engaged', D.NOT_ENG_MOR); }
		return breakdown ? { s, m, base, roll, factors: f } : { s, m };
	}

	const normalize = scn => {
		const side = s => (s && s.armies) ? s : { armies: s ? [s] : [] };
		return { location: scn.location || {}, countries: scn.countries || {}, sides: [side(scn.attacker), side(scn.defender)] };
	};

	function simulateScenario(scnIn, opts = {}) {
		const scn = normalize(scnIn);
		const rng = makeRng(opts.seed);
		const terr = terrainInfo(scn.location);
		const sides = scn.sides.map((s, i) => s.armies.map((a, j) => buildArmy(a, i, j, scn.countries)));
		// side.retreatDay: order a retreat at the end of that day (not before the minimum battle length)
		const retreatDay = scn.sides.map(s => s.retreatDay != null ? Math.max(D.MIN_DAYS, +s.retreatDay) : null);
		// each side's width: the location's frontage x (1 + possible_frontage_modifier of one of its armies; the code's pick
		// was not decoded, the first army is used)
		const Ws = [0, 1].map(i => terr.frontage * (1 + ((sides[i][0] || {}).c?.frontageMod || 0)));
		const all = [0, 1].map(i => sides[i].flatMap(a => a.regs));
		const timeline = [];
		const dice = [0, 0];
		let curDay = 0;
		// arrivalDay 'needed': the army waits next door and comes in (one a day, in list order) once its side has no fighting
		// regiment left in reserve, so big stacks are fed in as the line needs them instead of draining morale in reserve
		const arrivedAt = sides.map(s => s.map(a => a.army.arrivalDay === 'needed' ? Infinity : (+a.army.arrivalDay || 0)));
		const arrived = i => sides[i].filter((a, j) => arrivedAt[i][j] <= curDay);
		const leadCountry = i => (arrived(i)[0] || sides[i][0]).c;
		const arrive = (i, day) => {
			sides[i].forEach((a, j) => { if (arrivedAt[i][j] === day) deploy(a.regs, a.army.formation || 'balanced', Ws[i], all[i], day > 0, rng); });
			const next = arrivedAt[i].indexOf(Infinity);
			if (day > 0 && next >= 0 && !all[i].some(r => r.section === 'reserve' && canFight(r) && !r.u.aux)) {
				arrivedAt[i][next] = day;
				deploy(sides[i][next].regs, sides[i][next].army.formation || 'balanced', Ws[i], all[i], true, rng);
			}
		};
		const sideDice = i => Math.max(0, ...arrived(i).map(a => a.c.commanderDice | 0)) + (i === 0 ? terr.attackerDice : 0);
		const roll = () => { for (const i of [0, 1]) dice[i] = Math.floor(rng() * D.DICE_SIDES); };
		const lineStrength = (i, s) => all[i].filter(r => r.section === s).reduce((t, r) => t + r.str, 0);
		const lineEmpty = i => SECTIONS.every(s => lineStrength(i, s) < D.LINE_EMPTY);
		const lineMorale = i => { const f = all[i].filter(inLine); return f.length ? f.reduce((t, r) => t + r.mor, 0) / f.length : 0; };
		const startMen = [0, 1].map(i => all[i].reduce((t, r) => t + r.str, 0));
		const snap = day => timeline.push({
			day, dice: [dice[0] + sideDice(0), dice[1] + sideDice(1)],
			men: [0, 1].map(i => all[i].filter(r => r.section !== 'absent').reduce((t, r) => t + r.str, 0)),
			morale: [0, 1].map(i => { const f = all[i].filter(inLine); return f.length ? f.reduce((t, r) => t + r.mor / r.maxMor, 0) / f.length : 0; }),
			front: [0, 1].map(i => all[i].filter(r => inLine(r)).length),
			reserve: [0, 1].map(i => all[i].filter(r => r.section === 'reserve' && canFight(r)).length),
		});
		const finish = (winner, day, overrunSide) => {
			const loser = winner < 0 ? -1 : 1 - winner;
			const lostOf = r => r.section === 'absent' ? 0 : overrunSide === r.side ? r.start : r.start - r.str; // a wiped army loses every man
			const lr = loser >= 0 ? all[loser].filter(r => r.str >= D.MIN_STRENGTH) : [];
			const shattered = loser >= 0 && overrunSide !== loser && lr.length > 0 && lr.reduce((t, r) => t + r.mor, 0) / lr.length < D.LOW_MORALE;
			const sum = (i, f) => all[i].filter(r => r.section !== 'absent').reduce((t, r) => t + f(r), 0);
			return {
				winner, days: day, overrun: overrunSide != null, shattered, frontage: Ws[0], frontages: Ws, start: startMen,
				losses: [0, 1].map(i => sum(i, lostOf)),
				lossesRegular: [0, 1].map(i => sum(i, r => r.levy ? 0 : lostOf(r))),
				lossesLevy: [0, 1].map(i => sum(i, r => r.levy ? lostOf(r) : 0)),
				armies: sides.map(s => s.map((a, j) => ({ name: a.army.name || `Army ${j + 1}`, start: a.regs.reduce((t, r) => t + r.start, 0), lost: a.regs.reduce((t, r) => t + lostOf(r), 0) }))),
				// per unit group: men lost, and how many of them were in a wiped army (rebuilt rather than reinforced)
				groups: sides.map((s, i) => s.map(a => (a.army.units || []).map((g, gi) => {
					const lost = a.regs.filter(r => r.grp === gi).reduce((t, r) => t + lostOf(r), 0);
					return { lost, wiped: overrunSide === i ? lost : 0 };
				}))),
				timeline,
			};
		};
		arrive(0, 0); arrive(1, 0);
		roll();
		snap(0);
		const m0 = [0, 1].map(i => sideMen(all[i]));
		if (!m0[0] || !m0[1]) return finish(m0[0] ? 0 : m0[1] ? 1 : -1, 0, null);
		if (m0[0] >= D.INITIAL_OVERRUN * m0[1]) return finish(0, 0, 1);   // stack wipe at the start, no morale check
		if (m0[1] >= D.INITIAL_OVERRUN * m0[0]) return finish(1, 0, 0);
		let phaseCounter = 0, bombardOver = false, phase = 0;

		const attackSide = (i, bombard) => {
			const own = all[i], foe = all[1 - i];
			const combinedA = combinedArms(own, leadCountry(i));
			const d = dice[i] + sideDice(i);
			for (const sec of SECTIONS) {
				let budget = Ws[i]; // bombard: up to W frontage of artillery per section (0x142486c70)
				for (const A of own) {
					if (A.section !== sec || !canFight(A)) continue;
					if (bombard) {
						if (!A.u.bombard) continue;
						if ((A.u.f || 1) > budget) continue;
						budget -= (A.u.f || 1);
						if (rng() > D.BOMBARD_CHANCE * (1 + (A.u.be || 0))) { A.target = null; continue; }
						const pool = foe.filter(x => x.section === MIRROR[sec] && canFight(x));
						if (!pool.length) continue;
						const B = A.target && pool.includes(A.target) ? A.target : pool[Math.floor(rng() * pool.length)];
						A.target = B;
						const h = hit(A, B, { dice: d, flanking: false, secured: 0, combinedA, terr });
						B.pendStr += h.s; B.pendMor += h.m;
						continue;
					}
					if (!A.engaged) continue;
					// melee target (0x142481230): facing section, keep target; else centre, left, right, reserve
					if (D.RULES_13) {
						// 0x1443e3ba0 + 0x1443e5170: keep the target; else an ENGAGED enemy facing; else any enemy facing; a section with nobody
						// facing falls back to centre, left, right, reserve, and there only an engaged regiment can be picked
						const all = t => foe.filter(x => x.section === t && canFight(x));
						let t13 = MIRROR[sec], list = all(t13);
						if (!list.length) { t13 = FALLBACK.find(q => all(q).length); if (!t13) continue; list = all(t13); }
						let B = A.target && list.includes(A.target) ? A.target : null;
						if (!B) { const eng = list.filter(x => x.engaged), facing = t13 === MIRROR[sec]; const from = eng.length ? eng : facing ? list : []; if (!from.length) continue; B = from[Math.floor(rng() * from.length)]; }
						A.target = B;
						const hasF = q => foe.some(x => x.section === q && canFight(x)), hasO = q => own.some(x => x.section === q && canFight(x));
						let sec13 = 0, fl13 = false;
						if (t13 !== 'reserve') { sec13 = t13 === 'C' ? (hasF('L') ? 1 : 0) + (hasF('R') ? 1 : 0) : (hasF('C') ? 1 : 0); fl13 = MIRROR[sec] !== t13 && hasO(MIRROR[t13]) && !hasF(MIRROR[sec]); }
						const h13 = hit(A, B, { dice: d, flanking: fl13, secured: sec13, combinedA, terr });
						B.pendStr += h13.s; B.pendMor += h13.m;
						continue;
					}
					let tSec = MIRROR[sec];
					let pool = foe.filter(x => x.section === tSec && canFight(x));
					if (!pool.length) { tSec = FALLBACK.find(s => foe.some(x => x.section === s && canFight(x))); if (!tSec) continue; pool = foe.filter(x => x.section === tSec && canFight(x)); }
					const B = A.target && pool.includes(A.target) ? A.target : pool[Math.floor(rng() * pool.length)];
					A.target = B;
					const foeHas = s => foe.some(x => x.section === s && canFight(x));
					const ownHas = s => own.some(x => x.section === s && canFight(x));
					let secured = 0, flanking = false;
					if (tSec !== 'reserve') {
						secured = tSec === 'C' ? (foeHas('L') ? 1 : 0) + (foeHas('R') ? 1 : 0) : (foeHas('C') ? 1 : 0);
						const facingPair = MIRROR[sec] === tSec;
						flanking = !facingPair && ownHas(MIRROR[tSec]) && !foeHas(MIRROR[sec]);
					}
					const h = hit(A, B, { dice: d, flanking, secured, combinedA, terr });
					B.pendStr += h.s; B.pendMor += h.m;
				}
			}
		};

		for (let day = 1; day <= D.MAX_DAYS; day++) {
			curDay = day;
			arrive(0, day); arrive(1, day);
			let justEnded = false;
			if ((D.RULES_13 ? day >= D.BOMBARD_DAYS : day > D.BOMBARD_DAYS) && !bombardOver) { bombardOver = true; justEnded = true; if (D.RULES_13) for (const i of [0, 1]) for (const r of all[i]) r.target = null; }
			if (D.RULES_13) { if (phase >= D.DAYS_PER_PHASE) { phase = 0; roll(); } else if (justEnded) roll(); } // 0x1443e8d20: phase compared first, +1 at the end of the tick
			else { phaseCounter++; if (phaseCounter >= D.DAYS_PER_PHASE) { phaseCounter = 0; roll(); } else if (justEnded) roll(); }
			if (!bombardOver) { attackSide(0, true); attackSide(1, true); }
			else {
				for (const i of [0, 1]) {
					const own = all[i], foe = all[1 - i];
					const W = Ws[i];
					let budget = W; // HandleReserves
					const reserves = own.filter(r => r.section === 'reserve' && canFight(r) && !r.u.aux).sort((a, b) => b.str - a.str);
					for (const r of reserves) {
						if (budget <= 0) break;
						let best = null, bestScore = -Infinity;
						for (const s of SECTIONS) {
							const usedEng = own.filter(x => x.section === s && x.engaged && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0);
							const free = D.OVERSTACK * W - usedEng;
							if (free < (r.u.f || 1)) continue;
							const score = foe.filter(x => x.section === MIRROR[s] && x.engaged && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0) + free;
							if (score > bestScore) { bestScore = score; best = s; }
						}
						budget -= (r.u.f || 1);
						if (best && rng() <= r.u.cs * (1 + r.c.speedMod) * D.SPEED_SCALE) r.section = best;
					}
					if (D.RULES_13) for (const s of SECTIONS) { // 0x1443e55a0: candidates in section order while W minus the engaged frontage lasts, then each rolls
						let free = W - own.filter(x => x.section === s && x.engaged && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0);
						for (const r of own) {
							if (r.section !== s || r.engaged || !canFight(r) || (r.u.f || 1) > free) continue;
							free -= (r.u.f || 1);
							if (rng() <= D.INIT_BASE + Math.min(D.INIT_EACH * r.u.i * (1 + r.c.initiativeMod), D.INIT_MAX) + D.INIT_DAY * phase) r.engaged = true;
						}
					}
					else for (const s of SECTIONS) for (const r of own) { // AttemptInitiative per section
						if (r.section !== s || r.engaged || !canFight(r)) continue;
						if (rng() <= D.INIT_BASE + Math.min(D.INIT_EACH * r.u.i * (1 + r.c.initiativeMod), D.INIT_MAX) + D.INIT_DAY * (D.RULES_13 ? phase : day)) r.engaged = true;
					}
				}
				attackSide(0, false); attackSide(1, false);
				for (const i of [0, 1]) for (const r of all[i]) if (present(r)) r.pendMor += D.DAILY_MORALE;
			}
			for (const i of [0, 1]) for (const r of all[i]) {
				if (!present(r)) continue;
				r.str = Math.max(0, r.str - Math.min(r.pendStr, r.str));
				r.mor = Math.max(0, r.mor - r.pendMor);
				r.pendStr = 0; r.pendMor = 0;
				if (!canFight(r)) { r.section = 'routed'; r.engaged = false; }
			}
			phase++;
			snap(day);
			// end of day (0x1424a77f0): before the minimum length only overruns; after it a side with an empty line loses
			const men = [0, 1].map(i => sideMen(all[i]));
			const overrun = f => {
				// 1.3 (0x1443e8920): a side whose line holds no men counts as 0, and the check is a strict <
				if (D.RULES_13) { for (const i of [1, 0]) if (lineMorale(i) <= D.COLLAPSE && (lineEmpty(i) ? 0 : men[i]) < men[1 - i] / f) return i; return -1; }
				for (const i of [0, 1]) if (lineMorale(i) <= D.COLLAPSE && !lineEmpty(1 - i) && men[1 - i] >= f * men[i]) return i;
				return -1;
			};
			if (day < D.MIN_DAYS) {
				let w = overrun(D.MORALE_OVERRUN); if (w < 0) w = overrun(D.INITIAL_OVERRUN);
				if (w >= 0) return finish(1 - w, day, w);
				continue;
			}
			for (const i of [0, 1]) if (retreatDay[i] != null && day >= retreatDay[i]) {
				for (const r of all[i]) if (r.section !== 'absent') r.str *= 1 - D.RETREAT_STRENGTH_DAMAGE;
				const res = finish(1 - i, day, null);
				res.retreated = i;
				return res;
			}
			const e0 = lineEmpty(0), e1 = lineEmpty(1);
			if (e0 && e1) return finish(-1, day, null);
			if (e0) return finish(1, day, null);
			if (e1) return finish(0, day, null);
			const w = overrun(D.INITIAL_OVERRUN);
			if (w >= 0) return finish(1 - w, day, w);
		}
		return finish(-1, D.MAX_DAYS, null);
	}

	// ---- How sure is a Monte Carlo result? 95% intervals for the sampling noise of n battles (not for errors in the
	// inputs or in the rules). Win rates: Wilson score interval. Averages: mean +- 1.96 x standard error.
	const Z95 = 1.96;
	function wilson(k, n, z = Z95) {
		if (!n) return [0, 1];
		const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
		return [Math.max(0, c - h), Math.min(1, c + h)];
	}
	const meanCI = (mean, meanSq, n) => { const se = Math.sqrt(Math.max(0, meanSq - mean * mean) / Math.max(1, n - 1)); return [mean - Z95 * se, mean + Z95 * se]; };
	// Exchange ratio = defender losses / attacker losses (above 1: the attacker trades men better), with a delta-method
	// interval from the losses' variances and covariance (needs lossesProd = mean of attacker x defender losses).
	function exchange(m) {
		const [a, b] = m.losses;
		if (!(a > 0) || m.lossesProd == null) return { exchange: a > 0 ? b / a : null, exchangeCI: null };
		const r = b / a, va = m.lossesSq[0] - a * a, vb = m.lossesSq[1] - b * b, cov = m.lossesProd - a * b;
		const se = Math.sqrt(Math.max(0, r * r * (vb / (b * b || 1) + va / (a * a) - 2 * cov / (a * (b || 1)))) / Math.max(1, m.n - 1));
		return { exchange: r, exchangeCI: [Math.max(0, r - Z95 * se), r + Z95 * se] };
	}
	// from a result with n, wins, draws, days/daysSq and losses/lossesSq (means)
	function confidence(m) {
		return {
			winsCI: [0, 1].map(i => wilson(m.wins[i], m.n)),
			shareCI: [0, 1].map(i => wilson(m.wins[i] + m.draws / 2, m.n)), // draws counted as half a win
			daysCI: meanCI(m.days, m.daysSq, m.n),
			lossesCI: [0, 1].map(i => meanCI(m.losses[i], m.lossesSq[i], m.n)),
			...exchange(m),
		};
	}

	function mergeMC(parts) {
		parts = parts.filter(p => p && p.n);
		const n = parts.reduce((t, p) => t + p.n, 0);
		const w = p => p.n / n;
		const out = { n, start: parts[0].start };
		for (const k of ['wins', 'overrun', 'shattered', 'retreated']) out[k] = [0, 1].map(i => parts.reduce((t, p) => t + ((p[k] || [0, 0])[i] || 0), 0));
		out.draws = parts.reduce((t, p) => t + p.draws, 0);
		for (const k of ['days', 'daysSq', 'lossesProd']) out[k] = parts.reduce((t, p) => t + (p[k] || 0) * w(p), 0);
		for (const k of ['losses', 'lossesSq', 'lossesRegular', 'lossesLevy', 'overrunLosses']) out[k] = [0, 1].map(i => parts.reduce((t, p) => t + p[k][i] * w(p), 0));
		out.armies = parts[0].armies.map((s, i) => s.map((a, j) => ({ ...a, lost: parts.reduce((t, p) => t + p.armies[i][j].lost * w(p), 0) })));
		out.groups = parts[0].groups.map((s, i) => s.map((a, j) => a.map((g, k) => ({ lost: parts.reduce((t, p) => t + p.groups[i][j][k].lost * w(p), 0), wiped: parts.reduce((t, p) => t + p.groups[i][j][k].wiped * w(p), 0) }))));
		return Object.assign(out, confidence(out));
	}

	// Regiment experience over months (0x143485830): each month
	//   E += monthly_experience_gain - max(0, experience_decay) x E x (2 - goods access) [+ 1 on a mission]
	// Drilling (unit ability drill_army) adds 2.5 a month (and costs -90% morale and -25% maintenance efficiency while on).
	// Decay: country base 5%, regulars -1%, levies +2%; monarchies -1% more from age III (Military Traditions). gain/decay here
	// are the country's extra modifiers. In-game check (Spain 1547, monarchy, age III): a regiment at 0.20 drilled one month
	// = 0.20 + 2.5 - 3% x 0.20 = 2.694 ("Reduces Damage in combat by 1.34%", next month "+2.41%").
	function drilledExperience({ gain = 0, decay = 0, drill = 0, wait = 0, start = 0, goods = 1, levy = false } = {}) {
		const d = Math.max(0, 0.05 + (levy ? 0.02 : -0.01) + decay);
		let E = start;
		for (let m = 0; m < drill + wait; m++) E = Math.min(100, Math.max(0, E + gain + (m < drill ? 2.5 : 0) - d * E * (2 - goods)));
		return E;
	}

	function monteCarloScenario(scn, n, opts = {}) {
		const out = { n, wins: [0, 0], draws: 0, days: 0, daysSq: 0, losses: [0, 0], lossesSq: [0, 0], lossesProd: 0, lossesRegular: [0, 0], lossesLevy: [0, 0], overrunLosses: [0, 0], overrun: [0, 0], shattered: [0, 0], retreated: [0, 0], start: null, armies: null, groups: null };
		for (let k = 0; k < n; k++) {
			const r = simulateScenario(scn, { ...opts, seed: opts.seed != null ? opts.seed + k : undefined });
			if (r.retreated != null) out.retreated[r.retreated]++;
			if (r.winner < 0) out.draws++;
			else { out.wins[r.winner]++; if (r.overrun) out.overrun[1 - r.winner]++; if (r.shattered) out.shattered[1 - r.winner]++; }
			out.days += r.days; out.daysSq += r.days * r.days; out.start = r.start;
			out.lossesProd += r.losses[0] * r.losses[1];
			for (const i of [0, 1]) {
				out.losses[i] += r.losses[i]; out.lossesSq[i] += r.losses[i] * r.losses[i]; out.lossesRegular[i] += r.lossesRegular[i]; out.lossesLevy[i] += r.lossesLevy[i];
				if (r.overrun && r.winner === 1 - i) out.overrunLosses[i] += r.lossesRegular[i];
			}
			if (!out.armies) out.armies = r.armies.map(s => s.map(a => ({ name: a.name, start: a.start, lost: 0 })));
			r.armies.forEach((s, i) => s.forEach((a, j) => { out.armies[i][j].lost += a.lost; }));
			if (!out.groups) out.groups = r.groups.map(s => s.map(a => a.map(() => ({ lost: 0, wiped: 0 }))));
			r.groups.forEach((s, i) => s.forEach((a, j) => a.forEach((g, k) => { out.groups[i][j][k].lost += g.lost; out.groups[i][j][k].wiped += g.wiped; })));
		}
		for (const k of ['losses', 'lossesSq', 'lossesRegular', 'lossesLevy', 'overrunLosses']) out[k] = out[k].map(x => x / n);
		out.days /= n; out.daysSq /= n; out.lossesProd /= n;
		Object.assign(out, confidence(out));
		out.armies = out.armies.map(s => s.map(a => ({ ...a, lost: a.lost / n })));
		out.groups = out.groups.map(s => s.map(a => a.map(g => ({ lost: g.lost / n, wiped: g.wiped / n }))));
		return out;
	}

	// ---- Costs, manpower and repeated battles. Strength and manpower are in thousands of men.
	// Prices (in_game/common/prices/02_units.txt, units.json "pr"): <category>_build / _reinforce / _maintenance as
	// [gold, manpower], plus unit-specific adds. Gold is per 100 men (BASE_REGIMENT_PRICE_SCALE 0.1); manpower is per man.
	// Each price is scaled by its army_<category>_<build|reinforce|maintenance>_cost_modifier (country costMod); upkeep is
	// divided by (1 + army maintenance efficiency) and reinforcement gold by (1 + reinforce efficiency).
	// Checked on a 1342 save: monthly manpower upkeep matched to the man; gold upkeep in the budget was ~68% of the
	// price-list value (a factor not traced). scenario.costs[unitKey or category] = { buildGold, upkeepGold, reinforceGold }
	// overrides gold (reinforceGold per 1,000 men).
	const NO_PRICE = { b: [0, 0], r: [0, 0], m: [0, 0] };
	function unitCost(g, c, costs) {
		const u = unitStats(g.type), levy = g.levy != null ? !!g.levy : !!u.levy;
		const o = (costs && (costs[g.type] || costs[u.c])) || {};
		const pr = u.pr || (DB && DB.catPrice && DB.catPrice[u.c]) || NO_PRICE;
		const mod = kind => 1 + (((c.costMod || {})[kind] || {})[u.c] || 0);
		const size = u.s * (g.maxStrength || 1);
		const maintDiv = 1 + Math.max(D.MAINT_EFF_FLOOR, c.maintenanceEfficiency || 0);
		const reinfDiv = 1 + Math.max(D.REINFORCE_EFF_FLOOR, c.reinforceEfficiency || 0);
		const build = o.buildGold != null ? o.buildGold : pr.b[0] * size / D.PRICE_SCALE * mod('build');
		const buildManpower = levy ? 0 : pr.b[1] * size * mod('build');
		const upkeep = (o.upkeepGold != null ? o.upkeepGold : pr.m[0] * size / D.PRICE_SCALE * mod('maintenance')) * (levy ? D.LEVY_MAINTENANCE * (1 + (c.levyMaintenance || 0)) : 1) / maintDiv;
		const upkeepManpower = levy ? 0 : pr.m[1] * size * mod('maintenance') / maintDiv;
		// per 1,000 men put back into the regiment
		const reinforce = (o.reinforceGold != null ? o.reinforceGold : pr.r[0] / D.PRICE_SCALE * mod('reinforce')) / reinfDiv;
		const reinforceManpower = pr.r[1] * mod('reinforce') / (D.REINFORCE_EFF_MANPOWER ? reinfDiv : 1);
		return { u, levy, size, build, buildManpower, upkeep, upkeepManpower, reinforce, reinforceManpower };
	}
	function armyCosts(scnIn) {
		const scn = normalize(scnIn);
		return scn.sides.map(s => {
			const rows = [];
			const tot = { regiments: 0, levies: 0, men: 0, menLevy: 0, buildManpower: 0, buildGold: 0, upkeepGold: 0, upkeepManpower: 0 };
			s.armies.forEach((a, j) => {
				const c = country(a.country, scn.countries);
				for (const g of a.units || []) {
					const k = g.count | 0;
					if (!k) continue;
					const x = unitCost(g, c, scnIn.costs);
					// upkeep scales with current strength (game tooltip: "Current Strength x1.00")
					const cur = g.strength != null ? g.strength : 1;
					const men = x.size * k * cur;
					rows.push({
						army: j, armyName: a.name || `Army ${j + 1}`, type: g.type, name: x.u.n, count: k, levy: x.levy, men, size: x.size,
						buildManpower: x.buildManpower * k, buildGold: x.levy ? 0 : x.build * k, upkeepGold: x.upkeep * k * cur, upkeepManpower: x.upkeepManpower * k * cur,
						reinforceGold: x.levy ? 0 : x.reinforce,
					});
					if (x.levy) { tot.levies += k; tot.menLevy += men; } else { tot.regiments += k; tot.men += men; tot.buildManpower += x.buildManpower * k; tot.buildGold += x.build * k; }
					tot.upkeepGold += x.upkeep * k * cur; tot.upkeepManpower += x.upkeepManpower * k * cur;
				}
			});
			return { rows, ...tot };
		});
	}
	// What one battle costs each side (expected values from a Monte Carlo result): manpower to refill regulars, gold to
	// reinforce what retreated, gold and manpower to rebuild what was wiped, pops lost as levies.
	function battleCosts(scnIn, mc) {
		const scn = normalize(scnIn);
		return scn.sides.map((s, i) => {
			const o = { manpower: 0, reinforceGold: 0, rebuildGold: 0, rebuildManpower: 0, levyPops: 0 };
			s.armies.forEach((a, j) => {
				const c = country(a.country, scn.countries);
				(a.units || []).forEach((g, k) => {
					const L = mc.groups && mc.groups[i][j][k];
					if (!L || !L.lost) return;
					const x = unitCost(g, c, scnIn.costs);
					if (x.levy) { o.levyPops += L.lost; return; }
					o.manpower += (L.lost - L.wiped) * x.reinforceManpower + L.wiped / x.size * x.buildManpower;
					o.reinforceGold += (L.lost - L.wiped) * x.reinforce;
					o.rebuildGold += L.wiped / x.size * x.build; o.rebuildManpower += L.wiped / x.size * x.buildManpower;
				});
			});
			return o;
		});
	}
	// Monthly manpower left for the war: max / 60 minus the upkeep of the armies in this scenario (men a month)
	const manpowerSurplus = (scnIn, i, maxManpower) => maxManpower / (D.MAX_MANPOWER_YEARS * 12) - armyCosts(scnIn)[i].upkeepManpower * 1000;

	// Repeated battles: the same armies meet every `monthsBetween` months. After each battle the expected losses are
	// applied; between battles each side gains its monthly manpower (stored up to MAX_MANPOWER_YEARS x 12 months of it)
	// and spends it reinforcing regulars: MONTHLY_REINFORCE 25% of a regiment a month x (1 + reinforceSpeed), wiped
	// regiments rebuilt without that cap. Levies are re-raised from pops (no manpower); the pops they lost are counted.
	// scenario.war = { battles, monthsBetweenBattles, sides: [{ maxManpower, surplusManpower, currentManpower }] } (men).
	// surplusManpower is the net gain a month left for this war (income minus the upkeep of all the country's armies;
	// may be negative); it defaults to max / 60 minus the upkeep of the armies in the scenario. Current defaults to max.
	function* campaignSteps(scnIn, opts = {}) {
		const war = scnIn.war || {};
		const battles = opts.battles || war.battles || 8;
		const months = Math.max(0, opts.monthsBetween != null ? opts.monthsBetween : (war.monthsBetweenBattles != null ? war.monthsBetweenBattles : 3));
		const runs = opts.runs || 200;
		const scn = JSON.parse(JSON.stringify(scnIn));
		const ns = normalize(scn); // shares its army objects with scn, so strengths written here carry into the next battle
		const num = x => x != null && x !== '' && !isNaN(+x);
		const pools = [0, 1].map(i => {
			const w = (war.sides && war.sides[i]) || {};
			const max = (+w.maxManpower || 0) / 1000;
			const monthly = (num(w.surplusManpower) ? +w.surplusManpower : num(w.monthlyManpower) ? +w.monthlyManpower : manpowerSurplus(scnIn, i, max * 1000)) / 1000;
			const start = num(w.currentManpower) ? Math.min(max, w.currentManpower / 1000) : max;
			return { max, monthly, start, pool: start };
		});
		const isLevy = g => g.levy != null ? !!g.levy : !!unitStats(g.type).levy;
		const strength = g => g.strength != null ? g.strength : 1;
		const groups = i => ns.sides[i].armies.flatMap((a, j) => (a.units || []).map((g, k) => ({ g, j, k, size: unitStats(g.type).s * (g.maxStrength || 1) * (g.count | 0) })));
		const men = (i, f) => groups(i).reduce((t, x) => t + x.size * f(x.g), 0);
		const full = [men(0, () => 1), men(1, () => 1)];
		const total = { gold: [0, 0], manpower: [0, 0], levyPops: [0, 0] };
		const rows = [];
		for (let b = 1; b <= battles; b++) {
			const before = [men(0, strength), men(1, strength)];
			const mc = monteCarloScenario(scn, runs, { seed: opts.seed != null ? opts.seed + b * 100003 : undefined });
			const bc = battleCosts(scn, mc);
			const rebuild = [0, 0];
			for (const i of [0, 1]) for (const x of groups(i)) {
				if (!x.size) continue;
				const L = mc.groups[i][x.j][x.k];
				x.g.strength = Math.max(0, (x.size * strength(x.g) - L.lost) / x.size);
				if (!isLevy(x.g)) rebuild[i] += L.wiped;
			}
			const after = [men(0, strength), men(1, strength)];
			const used = [0, 0];
			for (const i of [0, 1]) {
				const P = pools[i];
				const cs = ns.sides[i].armies.map(a => country(a.country, ns.countries));
				for (let m = 0; m < months; m++) {
					P.pool = Math.max(0, Math.min(P.max, P.pool + P.monthly));
					const asks = groups(i).filter(x => x.size && !isLevy(x.g) && strength(x.g) < 1 - 1e-9).map(x => {
						const missing = x.size * (1 - strength(x.g));
						const cap = rebuild[i] > 1e-9 ? missing : x.size * D.MONTHLY_REINFORCE * (1 + (cs[x.j].reinforceSpeed || 0));
						return { x, want: Math.min(missing, cap) };
					});
					const want = asks.reduce((t, a) => t + a.want, 0);
					if (want <= 1e-9) continue;
					const share = Math.min(1, P.pool / want);
					for (const a of asks) a.x.g.strength = Math.min(1, strength(a.x.g) + a.want * share / a.x.size);
					P.pool -= want * share; used[i] += want * share; rebuild[i] = Math.max(0, rebuild[i] - want * share);
				}
				for (const x of groups(i)) if (isLevy(x.g)) x.g.strength = 1; // levies re-raised
				total.gold[i] += bc[i].reinforceGold + bc[i].rebuildGold; total.manpower[i] += used[i]; total.levyPops[i] += bc[i].levyPops;
			}
			rows.push({
				battle: b, winRate: mc.wins.map(w => w / runs), wiped: [mc.overrun[0] / runs, mc.overrun[1] / runs], days: mc.days,
				before, after, refilled: [men(0, strength), men(1, strength)], losses: mc.losses.slice(),
				pool: pools.map(p => p.pool), used, gold: bc.map(c => c.reinforceGold + c.rebuildGold), levyPops: bc.map(c => c.levyPops),
			});
			yield { battle: b, of: battles };
		}
		// a side is worn down once it can no longer bring its army back above half strength before the next battle
		let worn = -1, at = 0;
		for (const r of rows) { for (const i of [0, 1]) if (worn < 0 && r.refilled[i] < 0.5 * full[i]) { worn = i; at = r.battle; } if (worn >= 0) break; }
		return { battles, months, runs, rows, pools, full, total, worn, at };
	}
	function campaign(scnIn, opts) {
		const it = campaignSteps(scnIn, opts);
		for (;;) { const r = it.next(); if (r.done) return r.value; }
	}

	// ---- War of attrition, sampled battle by battle (not expected values). The two forces of a scenario fight a battle every
	// `interval` months for `months` months, attacker alternating, full morale at each battle. Each month, per side:
	//   pool += income (capped at max = MAX_MANPOWER_YEARS x 12 x income unless given)
	//   pool -= manpower upkeep: price x men x current strength / (1 + maintenance efficiency)   (game tooltip, Spain 1547)
	//   reinforcement: up to MONTHLY_REINFORCE x (1 + reinforce speed) of each regiment a month, one manpower a man (x reinforce
	//   cost modifier), while the pool lasts; regiments destroyed in a wipe are rebuilt without the monthly cap.
	// Experience (eu5.exe 0x14249c2d0 battle end, 0x142475d80): after a land battle every regiment of a side gains the same
	//   EXPERIENCE_GAIN 30 x max(0.01, side's men lost / (side's men at the start + 1))   (thousands of men)
	// so the side that bleeds more learns more. Monthly: E += expGain - expDecay x E (0x143485830, full goods access). Refilled
	// men keep the regiment's experience (the reinforcement setter 0x1423fbcc0 only writes strength); wiped regiments are
	// rebuilt from scratch at 0. opts.experience = false turns this off.
	// A side whose army is under collapseAt (default 50%) of its full men when a battle is due has lost the war.
	// opts.endOn = 'manpower' instead: the war goes on (months default 600) until a side has exhausted its manpower, i.e. its pool
	// is empty while its army is still short of men; that side has lost (both in the same month: the one with fewer men left).
	// opts = { months, interval, collapseAt, endOn, experience, sides: [{ income, max, pool, expDecay, expGain }] } (men a month / men;
	// expDecay default 0.04 = base 5% - 1% regulars; monarchies get another -1% from Military Traditions in age III).
	function simulateWar(scnIn, opts = {}, seed) {
		const scn = JSON.parse(JSON.stringify(scnIn)), ns = normalize(scn);
		// interval 'ready': the next battle comes once both sides are back to readyAt (default 99%) of their men, or once one side
		// has been ready for maxWait months (default 6) and forces it (players fight when fully reinforced).
		// opts.decides = 0 | 1 (with 'ready'): that side picks the moment. It gives battle as soon as it is back to readyAt, whatever
		// the other side's state; the other side can only force a battle after forceAfter months (default 12) without one.
		const ready = opts.interval === 'ready', readyAt = opts.readyAt != null ? opts.readyAt : 0.99, maxWait = opts.maxWait || 6;
		const decides = opts.decides === 0 || opts.decides === 1 ? opts.decides : -1, forceAfter = opts.forceAfter || 12;
		const endOnManpower = opts.endOn === 'manpower';
		const months = opts.months || (endOnManpower ? 600 : 36), interval = ready ? 1 : Math.max(1, +opts.interval || 2), collapseAt = opts.collapseAt != null ? opts.collapseAt : 0.5;
		const useExp = opts.experience !== false;
		const sides = [0, 1].map(i => {
			const w = (opts.sides || [])[i] || {}, income = (+w.income || 0) / 1000;
			const max = w.max != null ? w.max / 1000 : income * D.MAX_MANPOWER_YEARS * 12;
			const expDecay = Math.max(0, w.expDecay != null ? w.expDecay : D.EXPERIENCE_DECAY + D.REGULAR_DECAY);
			return { income, max, pool: w.pool != null ? w.pool / 1000 : max, upkeep: 0, reinforce: 0, won: 0, lost: 0, expDecay, expGain: w.expGain || 0 };
		});
		// the battle scenario shares these unit objects, so experience written here is what the next battle uses
		const G = [0, 1].map(i => ns.sides[i].armies.flatMap((a, j) => {
			const c = country(a.country, ns.countries);
			return (a.units || []).map((g, k) => {
				const x = unitCost(g, c, scnIn.costs);
				if (useExp && g.experience == null) g.experience = (g.levy != null ? g.levy : x.levy) ? c.levyExperience : c.experience;
				return { g, j, k, x, c, total: x.size * (g.count | 0) };
			});
		}));
		const str = g => g.strength != null ? g.strength : 1;
		const men = i => G[i].reduce((t, x) => t + x.total * str(x.g), 0);
		const avgExp = i => { const t = G[i].reduce((s, x) => s + x.total, 0); return t ? G[i].reduce((s, x) => s + x.total * (x.g.experience || 0), 0) / t : 0; };
		const full = [men(0), men(1)];
		let battles = 0, loser = -1, month = 0;
		const trace = [];
		for (;;) {
			if (!endOnManpower) for (const i of [0, 1]) if (loser < 0 && men(i) < collapseAt * full[i]) loser = i;
			if (loser >= 0 || month >= months) break;
			const att = battles % 2; // side that attacks this battle
			const bscn = att === 0 ? scn : { ...scn, attacker: scn.defender, defender: scn.attacker };
			const r = simulateScenario(bscn, { seed: seed != null ? seed * 1009 + battles : undefined });
			const before = [men(0), men(1)], lostNow = [0, 0];
			for (const s of [0, 1]) {
				const i = att === 0 ? s : 1 - s;
				r.groups[s].forEach((ag, j) => ag.forEach((L, k) => {
					const x = G[i].find(y => y.j === j && y.k === k);
					if (!x || !x.total) return;
					x.g.strength = Math.max(0, (x.total * str(x.g) - L.lost) / x.total);
					if (L.wiped > 0) x.rebuild = true;
					x.wipedNow = L.wiped;
					sides[i].lost += L.lost; lostNow[i] += L.lost;
				}));
			}
			if (useExp) for (const i of [0, 1]) {
				const gain = D.EXPERIENCE_GAIN * Math.max(0.01, lostNow[i] / (before[i] + 1));
				// survivors gain; regiments destroyed in a wipe come back as new ones with no experience
				for (const x of G[i]) if (x.total) x.g.experience = Math.min(100, (x.g.experience || 0) + gain) * Math.max(0, 1 - (x.wipedNow || 0) / x.total);
			}
			if (r.winner >= 0) sides[att === 0 ? r.winner : 1 - r.winner].won++;
			battles++;
			const tick = i => {
				const P = sides[i];
				if (useExp) for (const x of G[i]) x.g.experience = Math.min(100, Math.max(0, x.g.experience + P.expGain - P.expDecay * x.g.experience));
				P.pool = Math.min(P.max, P.pool + P.income);
				const up = G[i].reduce((t, x) => t + x.x.upkeepManpower * (x.g.count | 0) * str(x.g), 0);
				P.upkeep += Math.min(up, P.pool); P.pool = Math.max(0, P.pool - up);
				const asks = G[i].filter(x => x.total && str(x.g) < 1 - 1e-9).map(x => ({ x, men: Math.min(x.total * (1 - str(x.g)), x.rebuild ? Infinity : x.total * D.MONTHLY_REINFORCE * (1 + (x.c.reinforceSpeed || 0))) }));
				const cost = asks.reduce((t, a) => t + a.men * a.x.x.reinforceManpower, 0);
				if (cost <= 0) return;
				const share = Math.min(1, P.pool / cost);
				for (const a of asks) { a.x.g.strength = Math.min(1, str(a.x.g) + a.men * share / a.x.total); if (str(a.x.g) >= 1 - 1e-9) a.x.rebuild = false; }
				P.pool -= cost * share; P.reinforce += cost * share;
			};
			const exhausted = () => {
				if (!endOnManpower || loser >= 0) return loser >= 0;
				const ex = [0, 1].filter(i => sides[i].pool <= 1e-9 && men(i) < readyAt * full[i]);
				if (ex.length) loser = ex.length === 1 ? ex[0] : (men(0) / full[0] <= men(1) / full[1] ? 0 : 1);
				return loser >= 0;
			};
			if (ready) {
				const readyFor = [0, 0];
				for (let waited = 1; month < months; waited++) {
					tick(0); tick(1); month++;
					if (exhausted()) break;
					for (const i of [0, 1]) readyFor[i] = men(i) >= readyAt * full[i] ? readyFor[i] + 1 : 0;
					if (decides >= 0 ? readyFor[decides] || (waited >= forceAfter && readyFor[1 - decides]) : (readyFor[0] && readyFor[1]) || Math.max(...readyFor) >= maxWait) break;
				}
			} else for (let m = 0; m < interval && month < months; m++) { tick(0); tick(1); month++; if (exhausted()) break; }
			trace.push({ battle: battles, month, men: [men(0), men(1)], pool: sides.map(p => p.pool), exp: [0, 1].map(avgExp) });
		}
		return { loser, battles, months: month, won: sides.map(p => p.won), lost: sides.map(p => p.lost), upkeep: sides.map(p => p.upkeep), reinforce: sides.map(p => p.reinforce),
			end: [men(0) / full[0], men(1) / full[1]], pool: sides.map(p => p.pool), exp: [0, 1].map(avgExp), full, trace,
			// pool share of max once the army is refilled (pool - missing men x reinforce manpower): how hard the war is being won
			reserve: [0, 1].map(i => (sides[i].pool - G[i].reduce((t, x) => t + x.total * (1 - str(x.g)) * x.x.reinforceManpower, 0)) / (sides[i].max || 1)) };
	}
	// many wars: P(collapse) per side with 95% intervals, battle win share, average ending strength, manpower spent
	function summarizeWars(list) {
		const n = list.length, s = k => [0, 1].map(i => list.reduce((t, w) => t + w[k][i], 0) / n);
		const col = [0, 1].map(i => list.filter(w => w.loser === i).length);
		const battles = list.reduce((t, w) => t + w.battles, 0);
		const won = [0, 1].map(i => list.reduce((t, w) => t + w.won[i], 0));
		return { n, collapsed: col.map(c => c / n), collapsedCI: col.map(c => wilson(c, n)), undecided: (n - col[0] - col[1]) / n,
			months: list.reduce((t, w) => t + w.months, 0) / n,
			// side 0's reserve minus side 1's (share of max pool, after refilling), mean and 95% interval over the wars
			...(() => { const d = list.map(w => w.reserve[0] - w.reserve[1]), m = d.reduce((t, x) => t + x, 0) / n;
				const sd = Math.sqrt(d.reduce((t, x) => t + (x - m) ** 2, 0) / Math.max(1, n - 1)); return { reserveDiff: m, reserveDiffCI: [m - 1.96 * sd / Math.sqrt(n), m + 1.96 * sd / Math.sqrt(n)] }; })(),
			battleShare: won.map(w => w / Math.max(1, battles)), battleShareCI: won.map(w => wilson(w, Math.max(1, battles))), battles: battles / n,
			lost: s('lost'), upkeep: s('upkeep'), reinforce: s('reinforce'), end: s('end'), pool: s('pool'), exp: s('exp') };
	}

	// ---- Simple mode on top of the scenario engine
	function defaultSide() {
		return {
			age: 2, formation: 'balanced', units: { li: 0, hi: 10, lc: 0, hc: 4, art: 0, aux: 0 }, levies: { li: 0, hi: 0 },
			discipline: 0, tactics: 1.0, moraleMod: 0, moraleFlat: 0, initiativeMod: 0, speedMod: 0, levyCE: 0,
			experience: 0, levyExperience: 0, power: { li: 0, hi: 0, lc: 0, hc: 0, art: 0 }, commanderDice: 0, crossing: 'none', marchDays: 0,
		};
	}
	function simpleArmy(s, name) {
		const age = Math.min(6, Math.max(1, s.age | 0));
		const units = [];
		for (const c of CATS) if (s.units[c] | 0) units.push({ type: `generic:${c}:${age}`, count: s.units[c] | 0 });
		for (const c of ['li', 'hi']) if (s.levies && (s.levies[c] | 0)) units.push({ type: `generic:${c}:${age}`, count: s.levies[c] | 0, levy: true });
		const { units: _u, levies: _l, age: _a, formation, crossing, marchDays, ...c } = s;
		return { name, formation, marchDays: marchDays || 0, country: c, units };
	}
	const simpleScenario = (a, b, opts = {}) => ({ location: { frontage: opts.width || 10, crossing: a.crossing || 'none' }, attacker: { armies: [simpleArmy(a, 'Side A')] }, defender: { armies: [simpleArmy(b, 'Side B')] } });
	const simulate = (a, b, opts = {}) => { const r = simulateScenario(simpleScenario(a, b, opts), opts); r.timeline.forEach(t => { t.str = t.men; t.mor = t.morale; }); return r; };
	const monteCarlo = (a, b, n, opts = {}) => { const m = monteCarloScenario(simpleScenario(a, b, opts), n, opts); return { ...m, overruns: m.overrun }; };

	function hitBreakdown(attType, defType, attCountry, defCountry, o = {}) {
		const mk = (type, c, levy) => {
			const u = unitStats(type), cc = country(c), lv = levy != null ? levy : !!u.levy;
			return { u, c: cc, cat: u.c, levy: lv, maxStr: u.s, str: u.s, maxMor: (D.LAND_MORALE + cc.moraleFlat) * (1 + cc.moraleMod), disc: cc.discipline + (lv ? D.LEVY_DISCIPLINE : 0), exp: lv ? cc.levyExperience : cc.experience, engaged: o.targetEngaged !== false };
		};
		const A = mk(attType, attCountry, o.attLevy), B = mk(defType, defCountry, o.defLevy);
		const r = hit(A, B, { dice: o.dice || 0, flanking: !!o.flanking, secured: o.secured || 0, combinedA: o.combined || 0, terr: o.location ? terrainInfo(o.location) : null, breakdown: true });
		return { ...r, target: B };
	}

	// 1.3.11 rules, read from eu5.exe 1.3.11 (tick 0x1443e8d20, damage 0x1442e5580) and its defines. A tick is 2 hours, so 'days' are ticks here.
	// Same flow as 1.4; no REGIMENT_SIZE morale factor; melee from tick 5; initiative's time term uses the phase counter (combat+0x30), not the age.
	const RULES_13 = { RULES_13: true, DAMAGE_MULT: 0.01, STR_MOD: 0.2, MOR_MOD: 1, DAILY_MORALE: 0.01, DAYS_PER_PHASE: 5, BOMBARD_DAYS: 5, MIN_DAYS: 24, SIZE_RATIO_MAX: 0,
		INIT_BASE: 0.1, INIT_EACH: 0.02, INIT_MAX: 0.1, INIT_DAY: 0.01, SPEED_SCALE: 0.05, LEVY_DISCIPLINE: -0.1, MAX_DAYS: 2400 };
	const api = { RULES_13, D, CAT, CATS, AGE, GENERAL_PER_POINT, wilson, confidence, mergeMC, drilledExperience, simulateWar, summarizeWars, setUnitDB, unitStats, terrainInfo, simulateScenario, monteCarloScenario, hitBreakdown, unitCost, armyCosts, battleCosts, manpowerSurplus, campaign, campaignSteps, combinedArms, defaultSide, simpleScenario, simulate, monteCarlo, levyFactor };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BattleSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
