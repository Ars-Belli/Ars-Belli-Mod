// EU5 1.4.4 land battle simulator engine (v2, scenario based).
// Mechanics read from eu5.exe 1.4.4; see "EU5 Combat Mechanics (1.4.4).md" in the repo root.
// Unit stats come from units.json (build_units.js). Steps the code reading did not cover are marked APPROX.
// Works in the browser (window.BattleSim) and in Node (module.exports).
(function (root) {
	'use strict';

	const D = {
		COMBAT_BASE: 5, COMBAT_MAX: 15, DICE_SIDES: 10, DAMAGE_MULT: 0.12,
		STR_MOD: 0.04, MOR_MOD: 0.25, DAILY_MORALE: 0.03, DAYS_PER_PHASE: 4, MIN_DAYS: 5, BOMBARD_DAYS: 3,
		COLLAPSE: 0.05,            // absolute morale points (MORALE_COLLAPSE_THRESHOLD)
		LOW_MORALE: 0.5,           // absolute, below it a lost battle is a shattered retreat
		MIN_STRENGTH: 0.001,       // regiments with less (in thousands of men) cannot fight
		INIT_BASE: 0.6, INIT_EACH: 0.025, INIT_MAX: 0.3, INIT_DAY: 0.03,
		SPEED_SCALE: 0.1, OVERSTACK: 1.25, SIZE_RATIO_MAX: 4, LEVY_IMPACT: 0.75, EXP_RED: 0.5,
		NOT_ENG_STR: 1.1, NOT_ENG_MOR: 1.2, INITIAL_OVERRUN: 10, MORALE_OVERRUN: 2,
		BOMBARD_CHANCE: 0.2, LAND_MORALE: 3, LEVY_DISCIPLINE: -0.2,
		COMBINED_PER_TYPE: 0.025, COMBINED_MIN: 0.1, COMBINED_MAX: 0.5,
		BASE_FRONTAGE: 10, MIN_FRONTAGE: 2, MOVEMENT_COST: 0.0069, MAX_DAYS: 120,
	};

	// unit_categories 1.4.4 (fallback when a unit is given generically)
	const CAT = {
		li: { name: 'Light infantry', dt: 1.0, sdd: -0.1, mdt: 0.1, i: 5, cs: 3, fl: 1.1, sf: 0.05 },
		hi: { name: 'Heavy infantry', dt: 1.0, sdd: 0, mdt: 0, i: 1, cs: 2, fl: 1.0, sf: 0.05 },
		lc: { name: 'Light cavalry', dt: 0.3, sdd: -0.1, mdt: 0.1, i: 5, cs: 5, fl: 1.6, sf: 0, ct: { jungle: -0.1, wetlands: -0.1, mountains: -0.1 } },
		hc: { name: 'Heavy cavalry', dt: 0.3, sdd: 0, mdt: 0, i: 2, cs: 5, fl: 1.6, sf: 0, ct: { jungle: -0.1, wetlands: -0.1, mountains: -0.1, river: -0.1 } },
		art: { name: 'Artillery', dt: 1.25, sdd: 0, mdt: 0, i: 1, cs: 1, fl: 1.0, sf: 0, bombard: 1 },
		aux: { name: 'Auxiliary', dt: 1.25, sdd: 0, mdt: 0, i: 1, cs: 0.1, fl: 1.0, sf: 0, aux: 1 },
	};
	const CATS = Object.keys(CAT);
	// 00_age_templates_land.txt: [combat_power, max_strength] per age 1-6
	const AGE = {
		li: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		hi: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		lc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		hc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		art: [[2, 0.1], [3, 0.2], [4, 0.6], [5, 0.8], [5.5, 1.0], [7.5, 1.2]],
		aux: [[0.25, 0.05], [0.25, 0.1], [0.25, 0.15], [0.25, 0.2], [0.25, 0.25], [0.25, 0.3]],
	};
	// topography/vegetation/climate: defender = attacker dice penalty, frontage = battle frontage change
	const TERRAIN_FALLBACK = {
		topography: { flatland: [0, 0], mountains: [2, -4], hills: [1, -3], plateau: [1, -1], wetlands: [1, -3], narrows: [1, -2] },
		vegetation: { sparse: [0, 0], grasslands: [0, 0], farmland: [0, 0], woods: [1, -2], forest: [1, -3], jungle: [1, -4] },
		climate: {},
	};
	const MIRROR = { L: 'R', C: 'C', R: 'L' };
	const SECTIONS = ['L', 'C', 'R'];
	let DB = null; // units.json
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
	};
	function country(spec, countries) {
		const c = typeof spec === 'string' ? (countries && countries[spec]) || {} : spec || {};
		return { ...COUNTRY_DEFAULTS, ...c, power: { ...(c.power || {}) } };
	}

	// Unit stats: units.json entry, or "generic:<cat>:<age>"
	function unitStats(type) {
		if (DB && DB.units && DB.units[type]) return DB.units[type];
		const m = /^generic:(li|hi|lc|hc|art|aux):([1-6])$/.exec(type || '');
		if (!m) throw new Error('unknown unit type ' + type + (DB ? '' : ' (no unit database loaded)'));
		const c = CAT[m[1]], [p, s] = AGE[m[1]][+m[2] - 1];
		return { n: `${c.name} (age ${m[2]})`, c: m[1], a: +m[2], levy: 0, p, s, i: c.i, cs: c.cs, f: 1, fl: c.fl, sf: c.sf, dt: c.dt, sdd: c.sdd, sdt: 0, mdd: 0, mdt: c.mdt, be: 0, bombard: c.bombard || 0, aux: c.aux || 0, ct: c.ct };
	}

	function terrainInfo(loc) {
		const t = (layer, key) => {
			const db = DB && DB.terrain && DB.terrain[layer];
			if (db && db[key]) return [db[key].defender, db[key].frontage];
			return (TERRAIN_FALLBACK[layer] || {})[key] || [0, 0];
		};
		const topo = t('topography', loc.topography || 'flatland'), veg = t('vegetation', loc.vegetation || 'farmland'), cli = t('climate', loc.climate || '');
		const frontage = loc.frontage != null ? loc.frontage : Math.max(D.MIN_FRONTAGE, D.BASE_FRONTAGE + topo[1] + veg[1] + cli[1]);
		const crossing = { river: 1, strait: 2, landing: 1 }[loc.crossing] || 0;
		return { frontage, attackerDice: -(topo[0] + veg[0] + cli[0]) - crossing, keys: [loc.topography, loc.vegetation, loc.climate].filter(Boolean), river: !!loc.river, coastal: !!loc.coastal };
	}

	function buildArmy(army, sideIdx, armyIdx, countries) {
		const c = country(army.country, countries);
		const regs = [];
		const maxMor = D.LAND_MORALE * (1 + c.moraleMod) + c.moraleFlat;
		const startMorFrac = army.morale != null ? army.morale : Math.max(0, 1 - (army.marchDays || 0) * c.movementCost);
		for (const g of army.units || []) {
			const u = unitStats(g.type);
			const levy = g.levy != null ? !!g.levy : !!u.levy;
			for (let k = 0; k < (g.count | 0); k++) {
				const maxStr = u.s * (g.maxStrength || 1);
				regs.push({
					side: sideIdx, army: armyIdx, type: g.type, name: u.n, cat: u.c, levy, u, c,
					maxStr, str: maxStr * (g.strength != null ? g.strength : 1),
					maxMor, mor: maxMor * (g.morale != null ? g.morale : startMorFrac),
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
	const canFight = r => present(r) && r.str > D.MIN_STRENGTH && r.mor >= D.COLLAPSE;
	const menWeighted = regs => regs.reduce((t, r) => t + (present(r) || r.section === 'routed' ? r.str * (r.levy ? levyFactor(r.c) : 1) : 0), 0);

	// AddUnit: section by formation preference (or the unit's own section) while it has room, else reserve
	function deploy(armyRegs, formation, width, sideRegs, toReserve) {
		const cap = D.OVERSTACK * width;
		const used = s => sideRegs.filter(x => x.section === s && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0);
		let rr = 0;
		for (const r of armyRegs) {
			if (toReserve || r.u.aux || r.cat === 'aux') { r.section = 'reserve'; continue; }
			let prefs;
			if (r.prefSection) prefs = [r.prefSection];
			else if (formation === 'cav_inf_cav') prefs = (r.cat === 'lc' || r.cat === 'hc') ? (rr++ % 2 ? ['R', 'L'] : ['L', 'R']) : ['C'];
			else prefs = [['C', 'L', 'R'][rr++ % 3]];
			r.section = 'reserve';
			for (const s of prefs) if (s === 'reserve') break; else if (used(s) + (r.u.f || 1) <= cap) { r.section = s; break; }
		}
	}

	function combinedArms(regs) {
		const tot = {}; let all = 0;
		for (const r of regs) if (canFight(r) && !r.u.aux) { tot[r.cat] = (tot[r.cat] || 0) + r.str; all += r.str; }
		if (!all) return 0;
		let n = 0;
		for (const c in tot) { const sh = tot[c] / all; if (sh >= D.COMBINED_MIN && sh <= D.COMBINED_MAX) n++; }
		return n * D.COMBINED_PER_TYPE;
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
		mor('Regiment size (attacker ÷ target)', Math.min(D.SIZE_RATIO_MAX, Math.max(1 / D.SIZE_RATIO_MAX, A.maxStr / B.maxStr)));
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

	function normalize(scn) {
		const side = s => (s && s.armies) ? s : { armies: s ? [s] : [] };
		return { location: scn.location || {}, countries: scn.countries || {}, sides: [side(scn.attacker), side(scn.defender)] };
	}

	function simulateScenario(scnIn, opts = {}) {
		const scn = normalize(scnIn);
		const rng = makeRng(opts.seed);
		const terr = terrainInfo(scn.location);
		const W = terr.frontage;
		const sides = scn.sides.map((s, i) => s.armies.map((a, j) => buildArmy(a, i, j, scn.countries)));
		const all = [0, 1].map(i => sides[i].flatMap(a => a.regs));
		const timeline = [];
		const dice = [0, 0];
		const arrive = (i, day) => {
			for (const a of sides[i]) {
				const at = a.army.arrivalDay || 0;
				if (at === day) deploy(a.regs, a.army.formation || 'balanced', W, all[i], day > 0);
			}
		};
		const sideDice = i => {
			const cmd = Math.max(0, ...sides[i].filter(a => (a.army.arrivalDay || 0) <= curDay).map(a => a.c.commanderDice | 0));
			return cmd + (i === 0 ? terr.attackerDice : 0);
		};
		const roll = () => { for (const i of [0, 1]) dice[i] = Math.floor(rng() * D.DICE_SIDES); };
		let curDay = 0;
		const startMen = [0, 1].map(i => all[i].reduce((t, r) => t + r.str, 0));
		const snap = day => timeline.push({
			day, dice: [dice[0] + sideDice(0), dice[1] + sideDice(1)],
			men: [0, 1].map(i => all[i].filter(r => r.section !== 'absent').reduce((t, r) => t + r.str, 0)),
			morale: [0, 1].map(i => { const f = all[i].filter(r => SECTIONS.includes(r.section)); return f.length ? f.reduce((t, r) => t + r.mor / r.maxMor, 0) / f.length : 0; }),
			front: [0, 1].map(i => all[i].filter(r => SECTIONS.includes(r.section) && canFight(r)).length),
			reserve: [0, 1].map(i => all[i].filter(r => r.section === 'reserve' && canFight(r)).length),
		});
		const finish = (winner, day, overrunSide) => {
			const end = [0, 1].map(i => all[i].reduce((t, r) => t + (overrunSide === i ? 0 : r.str), 0));
			const loser = winner < 0 ? -1 : 1 - winner;
			const lr = loser >= 0 ? all[loser].filter(r => r.str > D.MIN_STRENGTH) : [];
			const shattered = loser >= 0 && overrunSide !== loser && lr.length > 0 && lr.reduce((t, r) => t + r.mor, 0) / lr.length < D.LOW_MORALE;
			return {
				winner, days: day, overrun: overrunSide != null && overrunSide >= 0, shattered, frontage: W,
				start: startMen, end, losses: [0, 1].map(i => startMen[i] - end[i]),
				armies: sides.map((s, i) => s.map((a, j) => ({ name: a.army.name || `Army ${j + 1}`, start: a.regs.reduce((t, r) => t + r._start, 0), end: overrunSide === i ? 0 : a.regs.reduce((t, r) => t + r.str, 0) }))),
				timeline,
			};
		};
		for (const i of [0, 1]) for (const r of all[i]) r._start = r.str;
		arrive(0, 0); arrive(1, 0);
		roll();
		snap(0);
		// INITIAL_OVERRUN at battle start (no morale requirement)
		const s0 = [0, 1].map(i => menWeighted(all[i].filter(present)));
		if (s0[1] > 0 && s0[0] >= D.INITIAL_OVERRUN * s0[1]) return finish(0, 0, 1);
		if (s0[0] > 0 && s0[1] >= D.INITIAL_OVERRUN * s0[0]) return finish(1, 0, 0);
		if (!s0[0] || !s0[1]) return finish(s0[0] ? 0 : s0[1] ? 1 : -1, 0, null);

		for (let day = 1; day <= D.MAX_DAYS; day++) {
			curDay = day;
			arrive(0, day); arrive(1, day);
			if (day > 1 && (day - 1) % D.DAYS_PER_PHASE === 0) roll();
			const bombardPhase = day <= D.BOMBARD_DAYS;
			const attackSide = (i, bombard) => {
				const own = all[i], foe = all[1 - i];
				const combinedA = combinedArms(own);
				for (const A of own) {
					if (!SECTIONS.includes(A.section) || !canFight(A)) continue;
					if (bombard) { if (!A.u.bombard || rng() > D.BOMBARD_CHANCE * (1 + (A.u.be || 0))) continue; }
					else if (!A.engaged) continue;
					const facing = MIRROR[A.section];
					let pool = foe.filter(x => x.section === facing && canFight(x));
					let flanking = false;
					if (!pool.length) {
						if (bombard) continue;
						const others = SECTIONS.filter(s => s !== facing && foe.some(x => x.section === s && canFight(x)));
						if (!others.length) continue;
						const sec = others[Math.floor(rng() * others.length)];
						pool = foe.filter(x => x.section === sec && canFight(x));
						flanking = true;
					}
					const B = A.target && pool.includes(A.target) ? A.target : pool[Math.floor(rng() * pool.length)];
					A.target = B;
					const secured = B.section === 'C'
						? ['L', 'R'].filter(s => foe.some(x => x.section === s && canFight(x))).length
						: (foe.some(x => x.section === 'C' && canFight(x)) ? 1 : 0);
					const d = hit(A, B, { dice: dice[i] + sideDice(i), flanking, secured, combinedA, terr });
					B.pendStr += d.s; B.pendMor += d.m;
				}
			};
			if (bombardPhase) { attackSide(0, true); attackSide(1, true); }
			else {
				for (const i of [0, 1]) {
					const own = all[i], foe = all[1 - i];
					// HandleReserves: frontage budget W per day; section score = enemy engaged facing it + our free room
					let budget = W;
					const reserves = own.filter(r => r.section === 'reserve' && canFight(r) && !r.u.aux).sort((a, b) => b.str - a.str);
					for (const r of reserves) {
						if (budget <= 0) break;
						let best = null, bestScore = -Infinity;
						for (const s of SECTIONS) {
							const usedEng = own.filter(x => x.section === s && x.engaged && canFight(x)).reduce((t, x) => t + (x.u.f || 1), 0);
							const free = D.OVERSTACK * W - usedEng;
							if (free < (r.u.f || 1)) continue;
							const score = foe.filter(x => x.section === MIRROR[s] && x.engaged && canFight(x)).length + free;
							if (score > bestScore) { bestScore = score; best = s; }
						}
						budget -= (r.u.f || 1);
						if (best && rng() <= r.u.cs * (1 + r.c.speedMod) * D.SPEED_SCALE) r.section = best;
					}
					// AttemptInitiative
					for (const r of own) {
						if (!SECTIONS.includes(r.section) || r.engaged || !canFight(r)) continue;
						const ch = D.INIT_BASE + Math.min(D.INIT_EACH * r.u.i * (1 + r.c.initiativeMod), D.INIT_MAX) + D.INIT_DAY * (day - 1);
						if (rng() <= ch) r.engaged = true;
					}
				}
				attackSide(0, false); attackSide(1, false);
				for (const i of [0, 1]) for (const r of all[i]) if (present(r)) r.pendMor += D.DAILY_MORALE;
			}
			// apply and clean up
			for (const i of [0, 1]) for (const r of all[i]) {
				if (!present(r)) continue;
				r.str = Math.max(0, r.str - Math.min(r.pendStr, r.str));
				r.mor = Math.max(0, r.mor - r.pendMor);
				r.pendStr = 0; r.pendMor = 0;
				if (!canFight(r)) { r.section = 'routed'; r.engaged = false; }
			}
			snap(day);
			if (day < D.MIN_DAYS) continue;
			const fight = [0, 1].map(i => all[i].some(canFight));
			if (fight[0] && fight[1]) continue;
			if (!fight[0] && !fight[1]) return finish(-1, day, null);
			const w = fight[0] ? 0 : 1, l = 1 - w;
			// MORALE_OVERRUN: loser's morale collapsed; winner men (levies at their factor) >= 2x loser men
			const wm = menWeighted(all[w].filter(r => r.section !== 'absent')), lm = menWeighted(all[l].filter(r => r.section !== 'absent'));
			return finish(w, day, wm >= D.MORALE_OVERRUN * lm ? l : null);
		}
		return finish(-1, D.MAX_DAYS, null);
	}

	function monteCarloScenario(scn, n, opts = {}) {
		const out = { n, wins: [0, 0], draws: 0, days: 0, losses: [0, 0], overrun: [0, 0], shattered: [0, 0], start: null, armies: null, daysHist: {} };
		for (let k = 0; k < n; k++) {
			const r = simulateScenario(scn, { ...opts, seed: opts.seed != null ? opts.seed + k : undefined });
			if (r.winner < 0) out.draws++;
			else { out.wins[r.winner]++; if (r.overrun) out.overrun[1 - r.winner]++; if (r.shattered) out.shattered[1 - r.winner]++; }
			out.days += r.days; out.losses[0] += r.losses[0]; out.losses[1] += r.losses[1]; out.start = r.start;
			out.daysHist[r.days] = (out.daysHist[r.days] || 0) + 1;
			if (!out.armies) out.armies = r.armies.map(s => s.map(a => ({ name: a.name, start: a.start, lost: 0 })));
			r.armies.forEach((s, i) => s.forEach((a, j) => { out.armies[i][j].lost += (a.start - a.end) / n; }));
		}
		out.days /= n; out.losses = out.losses.map(x => x / n);
		return out;
	}

	// ---- Simple mode (one army per side, generic units by category) on top of the scenario engine
	function defaultSide() {
		return {
			age: 2, formation: 'balanced',
			units: { li: 0, hi: 10, lc: 0, hc: 4, art: 0, aux: 0 }, levies: { li: 0, hi: 0 },
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
	function simpleScenario(a, b, opts = {}) {
		return { location: { frontage: opts.width || 10, crossing: a.crossing || 'none' }, attacker: { armies: [simpleArmy(a, 'Side A')] }, defender: { armies: [simpleArmy(b, 'Side B')] } };
	}
	const simulate = (a, b, opts = {}) => {
		const r = simulateScenario(simpleScenario(a, b, opts), opts);
		r.timeline.forEach(t => { t.str = t.men; t.mor = t.morale; });
		return r;
	};
	const monteCarlo = (a, b, n, opts = {}) => {
		const m = monteCarloScenario(simpleScenario(a, b, opts), n, opts);
		return { ...m, overruns: m.overrun };
	};

	// One hit for the page: attacker/target unit types and their armies' countries
	function hitBreakdown(attType, defType, attCountry, defCountry, o = {}) {
		const mk = (type, c, levy) => {
			const u = unitStats(type), cc = country(c);
			const lv = levy != null ? levy : !!u.levy;
			return { u, c: cc, cat: u.c, levy: lv, maxStr: u.s, str: u.s, maxMor: D.LAND_MORALE * (1 + cc.moraleMod) + cc.moraleFlat, disc: cc.discipline + (lv ? D.LEVY_DISCIPLINE : 0), exp: lv ? cc.levyExperience : cc.experience, engaged: o.targetEngaged !== false };
		};
		const A = mk(attType, attCountry, o.attLevy), B = mk(defType, defCountry, o.defLevy);
		const terr = o.location ? terrainInfo(o.location) : null;
		const r = hit(A, B, { dice: o.dice || 0, flanking: !!o.flanking, secured: o.secured || 0, combinedA: o.combined || 0, terr, breakdown: true });
		return { ...r, target: B };
	}

	const api = { D, CAT, CATS, AGE, setUnitDB, unitStats, terrainInfo, simulateScenario, monteCarloScenario, hitBreakdown, defaultSide, simpleScenario, simulate, monteCarlo, levyFactor };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BattleSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
