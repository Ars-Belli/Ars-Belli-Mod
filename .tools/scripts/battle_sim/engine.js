// EU5 1.4.4 land battle simulator engine. Mechanics read from eu5.exe (see
// "EU5 Combat Mechanics (1.4.4).md" in the repo root); values from the 1.4.4 game files.
// Approximations (marked APPROX) cover steps whose code was not traced.
// Works in the browser (window.BattleSim) and in Node (module.exports).
(function (root) {
	'use strict';

	const D = {
		COMBAT_BASE: 5, COMBAT_MAX: 15, DICE_SIDES: 10, DAMAGE_MULT: 0.12,
		STR_MOD: 0.04, MOR_MOD: 0.25, DAILY_MORALE: 0.03, DAYS_PER_PHASE: 4, MIN_DAYS: 5,
		COLLAPSE: 0.05, INIT_BASE: 0.6, INIT_EACH: 0.025, INIT_MAX: 0.3, INIT_DAY: 0.03,
		SPEED_SCALE: 0.1, OVERSTACK: 1.25, SIZE_RATIO_MAX: 4, LEVY_IMPACT: 0.75, EXP_RED: 0.5,
		NOT_ENG_STR: 1.1, NOT_ENG_MOR: 1.2, INITIAL_OVERRUN: 10, MORALE_OVERRUN: 2,
		BOMBARD_CHANCE: 0.2, BOMBARD_DAYS: 3, LAND_MORALE: 3, LEVY_DISCIPLINE: -0.2,
		COMBINED_PER_TYPE: 0.025, COMBINED_MIN: 0.1, COMBINED_MAX: 0.5, MAX_DAYS: 90,
	};

	// unit_categories (1.4.4)
	const CAT = {
		li: { name: 'Light infantry', taken: 1.0, sdd: -0.1, mdt: 0.1, init: 5, speed: 3, flank: 1.1, secure: 0.05 },
		hi: { name: 'Heavy infantry', taken: 1.0, sdd: 0, mdt: 0, init: 1, speed: 2, flank: 1.0, secure: 0.05 },
		lc: { name: 'Light cavalry', taken: 0.3, sdd: -0.1, mdt: 0.1, init: 5, speed: 5, flank: 1.6, secure: 0 },
		hc: { name: 'Heavy cavalry', taken: 0.3, sdd: 0, mdt: 0, init: 2, speed: 5, flank: 1.6, secure: 0 },
		art: { name: 'Artillery', taken: 1.25, sdd: 0, mdt: 0, init: 1, speed: 1, flank: 1.0, secure: 0, bombard: true },
		aux: { name: 'Auxiliary', taken: 1.25, sdd: 0, mdt: 0, init: 1, speed: 0.1, flank: 1.0, secure: 0, noCombined: true },
	};
	const CATS = Object.keys(CAT);

	// unit_types/00_age_templates_land.txt: [combat_power, max_strength] per age 1-6
	const AGE = {
		li: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		hi: [[1, 0.5], [1, 1.0], [1, 1.5], [1.5, 2.0], [2.25, 2.5], [3, 3.0]],
		lc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		hc: [[2.6, 0.2], [2.6, 0.4], [2.6, 0.6], [2.85, 0.8], [3.25, 1.0], [3.25, 1.2]],
		art: [[2, 0.1], [3, 0.2], [4, 0.6], [5, 0.8], [5.5, 1.0], [7.5, 1.2]],
		aux: [[0.25, 0.05], [0.25, 0.1], [0.25, 0.15], [0.25, 0.2], [0.25, 0.25], [0.25, 0.3]],
	};

	const MIRROR = { L: 'R', C: 'C', R: 'L' };
	const SECTIONS = ['L', 'C', 'R'];

	function defaultSide() {
		return {
			age: 2, formation: 'balanced',
			units: { li: 0, hi: 10, lc: 0, hc: 4, art: 0, aux: 0 },
			levies: { li: 0, hi: 0 },
			discipline: 0, tactics: 1.0, moraleMod: 0, moraleFlat: 0,
			initiativeMod: 0, speedMod: 0, levyCE: 0, experience: 0, levyExperience: 0,
			power: { li: 0, hi: 0, lc: 0, hc: 0, art: 0 }, commanderDice: 0, crossing: 'none',
		};
	}

	function makeRng(seed) {
		if (seed == null) return Math.random;
		let s = seed >>> 0;
		return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
	}

	function buildArmy(cfg, sideIdx) {
		const regs = [];
		const a = Math.min(6, Math.max(1, cfg.age | 0)) - 1;
		const maxMor = D.LAND_MORALE * (1 + cfg.moraleMod) + cfg.moraleFlat;
		const add = (cat, levy) => {
			const [power, size] = AGE[cat][a];
			regs.push({
				side: sideIdx, cat, levy, power, maxStr: size, str: size, maxMor, mor: maxMor,
				disc: cfg.discipline + (levy ? D.LEVY_DISCIPLINE : 0),
				exp: levy ? cfg.levyExperience : cfg.experience,
				section: 'reserve', engaged: false, target: null, pendStr: 0, pendMor: 0,
			});
		};
		for (const cat of CATS) for (let i = 0; i < (cfg.units[cat] | 0); i++) add(cat, false);
		for (const cat of ['li', 'hi']) for (let i = 0; i < ((cfg.levies && cfg.levies[cat]) | 0); i++) add(cat, true);
		return regs;
	}

	const levyFactor = (cfg) => Math.min(1, Math.max(0.05, D.LEVY_IMPACT + (1 - D.LEVY_IMPACT) * cfg.levyCE));
	const sideStrength = (regs, cfg) => regs.reduce((s, r) => s + (r.section === 'routed' ? 0 : r.str * (r.levy ? levyFactor(cfg) : 1)), 0);
	const alive = r => r.section !== 'routed';
	const canFight = r => alive(r) && r.str > 0.001 && r.mor >= D.COLLAPSE * r.maxMor;

	// Battle start (AddUnit): each regiment goes to its formation's section while that section has room
	// (1.25 x battle width); auxiliaries and overflow wait in reserve.
	function deploy(regs, cfg, width) {
		const cap = D.OVERSTACK * width;
		const used = { L: 0, C: 0, R: 0 };
		const order = { balanced: ['C', 'L', 'R'], cav_inf_cav: null }[cfg.formation] || ['C', 'L', 'R'];
		let rr = 0;
		for (const r of regs) {
			if (r.cat === 'aux') continue;
			let prefs;
			if (cfg.formation === 'cav_inf_cav') prefs = (r.cat === 'lc' || r.cat === 'hc') ? (rr++ % 2 ? ['R', 'L'] : ['L', 'R']) : ['C'];
			else prefs = [order[rr++ % 3]];
			for (const s of prefs) if (used[s] + 1 <= cap) { r.section = s; used[s] += 1; break; }
		}
	}

	function combinedArms(regs) {
		const tot = {}; let all = 0;
		for (const r of regs) if (canFight(r) && !CAT[r.cat].noCombined) { tot[r.cat] = (tot[r.cat] || 0) + r.str; all += r.str; }
		if (!all) return 0;
		let n = 0;
		for (const c in tot) { const share = tot[c] / all; if (share >= D.COMBINED_MIN && share <= D.COMBINED_MAX) n++; }
		return n * D.COMBINED_PER_TYPE;
	}

	// One hit: damage function 0x142482130.
	function hit(A, B, ctx) {
		const { cfgA, cfgB, dice, flanking, secured, combinedA, breakdown } = ctx;
		const ca = CAT[A.cat], cb = CAT[B.cat];
		let roll = dice + D.COMBAT_BASE;
		roll = roll <= 0 ? 1 : Math.min(roll, D.COMBAT_MAX);
		const base = roll * D.DAMAGE_MULT;
		let s = base * D.STR_MOD, m = base * D.MOR_MOD;
		const f = [];
		const both = (k, x) => { s *= x; m *= x; if (breakdown) f.push([k, x]); };
		const mor = (k, x) => { m *= x; if (breakdown) f.push([k + ' (morale)', x]); };
		const str = (k, x) => { s *= x; if (breakdown) f.push([k + ' (strength)', x]); };
		mor('Relative strength', A.str / A.maxStr);
		mor('Regiment size', Math.min(D.SIZE_RATIO_MAX, Math.max(1 / D.SIZE_RATIO_MAX, A.maxStr / B.maxStr)));
		both('Unit power modifier', 1 + ((cfgA.power && cfgA.power[A.cat]) || 0));
		if (flanking) both('Flanking ability', ca.flank);
		both('Discipline', 1 + A.disc);
		both('Target discipline', 1 / (1 + B.disc));
		both('Combat power', A.power);
		if (cfgB.tactics > cfgA.tactics) both('Military tactics', 1 / (1 + (cfgB.tactics - cfgA.tactics)));
		if (A.levy && !B.levy) both('Levy vs regular', levyFactor(cfgA));
		str('Current strength', A.str);
		both('Target experience', 1 - D.EXP_RED * B.exp / 100);
		both('Target category damage taken', cb.taken);
		both('Combined arms', 1 + combinedA);
		if (secured) both('Target secured flanks', Math.max(0.05, 1 - secured * cb.secure));
		str('Strength damage done', 1 + ca.sdd);
		mor('Morale damage taken', 1 + cb.mdt);
		if (!B.engaged) { str('Target not engaged', D.NOT_ENG_STR); mor('Target not engaged', D.NOT_ENG_MOR); }
		return breakdown ? { s, m, base, roll, factors: f } : { s, m };
	}

	function simulate(cfgA, cfgB, opts = {}) {
		const rng = makeRng(opts.seed);
		const width = opts.width || 10;
		const cfg = [cfgA, cfgB];
		const regs = [buildArmy(cfgA, 0), buildArmy(cfgB, 1)];
		deploy(regs[0], cfgA, width); deploy(regs[1], cfgB, width);
		const startStr = [0, 1].map(i => regs[i].reduce((t, r) => t + r.str, 0));
		const dice = [0, 0];
		const crossingDice = c => ({ river: -1, strait: -2, landing: -1 }[c.crossing] || 0);
		// raw die 0-9 (the tooltip shows it +1) plus commander and crossing dice
		const roll = () => { for (const i of [0, 1]) dice[i] = Math.floor(rng() * D.DICE_SIDES) + (cfg[i].commanderDice | 0) + crossingDice(cfg[i]); };
		const timeline = [];
		const snap = day => timeline.push({ day, str: [0, 1].map(i => regs[i].reduce((t, r) => t + r.str, 0)), mor: [0, 1].map(i => { const a = regs[i].filter(alive); return a.length ? a.reduce((t, r) => t + r.mor / r.maxMor, 0) / a.length : 0; }), dice: dice.slice() });
		roll();
		snap(0);
		const result = (winner, day, overrun) => {
			const endStr = [0, 1].map(i => regs[i].reduce((t, r) => t + r.str, 0));
			if (overrun != null) endStr[overrun] = 0;
			return { winner, days: day, overrun: overrun != null, losses: [0, 1].map(i => startStr[i] - endStr[i]), start: startStr, timeline };
		};
		// Initial overrun: 10:1 strength
		const s0 = [0, 1].map(i => sideStrength(regs[i], cfg[i]));
		if (s0[0] >= D.INITIAL_OVERRUN * s0[1]) return result(0, 0, 1);
		if (s0[1] >= D.INITIAL_OVERRUN * s0[0]) return result(1, 0, 0);

		for (let day = 1; day <= D.MAX_DAYS; day++) {
			if (day > 1 && (day - 1) % D.DAYS_PER_PHASE === 0) roll();
			for (const i of [0, 1]) {
				const own = regs[i], foe = regs[1 - i], c = cfg[i];
				// HandleReserves: daily frontage budget = width; best section = enemy engaged frontage facing it + our free room
				let budget = width;
				const reserves = own.filter(r => r.section === 'reserve' && canFight(r) && r.cat !== 'aux').sort((a, b) => b.str - a.str);
				for (const r of reserves) {
					if (budget <= 0) break;
					let best = null, bestScore = -1;
					for (const s of SECTIONS) {
						const usedEng = own.filter(x => x.section === s && x.engaged).length;
						const free = D.OVERSTACK * width - usedEng;
						if (free < 1) continue;
						const score = foe.filter(x => x.section === MIRROR[s] && x.engaged).length + free;
						if (score > bestScore) { bestScore = score; best = s; }
					}
					budget -= 1;
					if (best && rng() <= CAT[r.cat].speed * (1 + c.speedMod) * D.SPEED_SCALE) r.section = best;
				}
				// AttemptInitiative
				const initChance = cat => D.INIT_BASE + Math.min(D.INIT_EACH * CAT[cat].init * (1 + c.initiativeMod), D.INIT_MAX) + D.INIT_DAY * (day - 1);
				for (const r of own) if (SECTIONS.includes(r.section) && !r.engaged && canFight(r) && rng() <= initChance(r.cat)) r.engaged = true;
			}
			// Attacks
			for (const i of [0, 1]) {
				const own = regs[i], foe = regs[1 - i];
				const combinedA = combinedArms(own);
				const attackers = own.filter(r => SECTIONS.includes(r.section) && canFight(r) && (r.engaged || (CAT[r.cat].bombard && day <= D.BOMBARD_DAYS)));
				for (const A of attackers) {
					if (!A.engaged) { if (rng() > D.BOMBARD_CHANCE) continue; } // APPROX: bombard only in the bombard phase
					const facing = MIRROR[A.section];
					let pool = foe.filter(x => x.section === facing && canFight(x));
					let flanking = false;
					if (!pool.length) {
						const others = SECTIONS.filter(s => s !== facing && foe.some(x => x.section === s && canFight(x)));
						if (!others.length) continue;
						const s = others[Math.floor(rng() * others.length)];
						pool = foe.filter(x => x.section === s && canFight(x));
						flanking = true;
					}
					let B = A.target && pool.includes(A.target) ? A.target : pool[Math.floor(rng() * pool.length)];
					A.target = B;
					const secured = B.section === 'C'
						? SECTIONS.filter(s => s !== 'C' && foe.some(x => x.section === s && canFight(x))).length
						: (foe.some(x => x.section === 'C' && canFight(x)) ? 1 : 0);
					const d = hit(A, B, { cfgA: cfg[i], cfgB: cfg[1 - i], dice: dice[i], flanking, secured, combinedA });
					B.pendStr += d.s; B.pendMor += d.m;
				}
			}
			// Daily morale drain, then apply losses
			for (const i of [0, 1]) for (const r of regs[i]) {
				if (!alive(r)) continue;
				r.pendMor += D.DAILY_MORALE;
				r.str = Math.max(0, r.str - Math.min(r.pendStr, r.str));
				r.mor = Math.max(0, r.mor - r.pendMor);
				r.pendStr = 0; r.pendMor = 0;
				if (!canFight(r)) { r.section = 'routed'; r.engaged = false; }
			}
			snap(day);
			if (day < D.MIN_DAYS) continue;
			const fight = [0, 1].map(i => regs[i].some(canFight));
			if (fight[0] && fight[1]) continue;
			if (!fight[0] && !fight[1]) return result(-1, day, null);
			const w = fight[0] ? 0 : 1, l = 1 - w;
			const ws = regs[w].filter(canFight).reduce((t, r) => t + r.str * (r.levy ? levyFactor(cfg[w]) : 1), 0);
			const ls = regs[l].reduce((t, r) => t + r.str, 0);
			return result(w, day, ws >= D.MORALE_OVERRUN * ls ? l : null);
		}
		return result(-1, D.MAX_DAYS, null);
	}

	function monteCarlo(cfgA, cfgB, n, opts = {}) {
		const out = { n, wins: [0, 0], draws: 0, days: 0, losses: [0, 0], overruns: [0, 0], start: [0, 0] };
		for (let k = 0; k < n; k++) {
			const r = simulate(cfgA, cfgB, { ...opts, seed: opts.seed != null ? opts.seed + k : undefined });
			if (r.winner < 0) out.draws++; else { out.wins[r.winner]++; if (r.overrun) out.overruns[1 - r.winner]++; }
			out.days += r.days; out.losses[0] += r.losses[0]; out.losses[1] += r.losses[1];
			out.start = r.start;
		}
		out.days /= n; out.losses = out.losses.map(x => x / n);
		return out;
	}

	const api = { D, CAT, CATS, AGE, defaultSide, simulate, monteCarlo, hit, levyFactor };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BattleSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
