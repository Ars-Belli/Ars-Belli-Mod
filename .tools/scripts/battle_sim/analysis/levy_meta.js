// node .tools/scripts/battle_sim/analysis/levy_meta.js levies|tribal|nerf [--ages 2,3,4,5,6] [--n 1500] [--plain] [--out file]
// --plain (with tribal): a country with Morocco's population but no tribes, as a comparison
// What levies are worth, against the regular meta found by army_meta.js. No mercenaries.
//   levies : generic levies (peasant infantry, noble knights) of ages 2-6
//            - how many levy regiments match 30 regulars (break-even)
//            - how much topping up a regular army with levies helps, same army or fed in behind it
//            - levy combat efficiency at break-even size
//            (the levy meta itself, with both sides raising levies: army_meta.js regulars --levies 30)
//   tribal : Morocco's real levies (D009 Sanhaja and Zenata cavalry, age-1 units that never scale) in ages 1-3
//            stacks from saves: the 30-regiment armies Morocco fielded, and its whole levy
//   nerf   : Ars Belli's steppe horde size (200 men in age 1, 400 from age 2) against vanilla's 600, same men
// Levies: discipline -20%, levy vs regular factor 0.75 + 0.25 x levy CE, no manpower, 1% of the gold upkeep (section 8 of the
// combat doc). Men come from pops, so a smaller regiment means more regiments for the same men, not fewer men: frontage counts
// regiments, which is why small levy regiments get weaker every age.
const fs = require('fs');
const S = require('../engine.js');
const pool = require('../pool.js')();
S.setUnitDB(require('../units.json'));
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const N = +opt('--n', 1500);
const GENERAL = { adm: 60, dip: 59, mil: 61 };
const FLAT_MORALE = [0, 0.25, 0.5, 0.8, 1.15, 1.55];
const baseCountry = (age, extra = {}) => ({
	tactics: 1, discipline: 0.2856 + (age >= 6 ? 0.05 : 0), moraleMod: 0.203 + 0.04, moraleFlat: FLAT_MORALE[age - 1], experience: 0.37, levyCE: 0.1,
	combinedPerType: 0.025 + (age >= 4 ? 0.01 : 0) + (age >= 6 ? 0.01 : 0),
	initiativeMod: age >= 2 ? 0.2 : 0, speedMod: age >= 6 ? 0.1 : 0, frontageMod: age >= 5 ? 0.1 : 0, correctBoxChance: 0.1 * (age - 1), ...extra,
});
const ROSTER = {
	1: { hi: 'a_footmen', li: 'a_archers', hc: 'a_armored_horsemen', lc: 'a_horsemen', art: 'a_age_1_traditions_artillery' },
	2: { hi: 'a_men_at_arms', li: 'a_handgonners', hc: 'a_heavy_cavalrymen', lc: 'a_cavalrymen', art: 'a_houfnice' },
	3: { hi: 'a_halberdiers', li: 'a_early_arquebusiers', hc: 'a_lancers', lc: 'a_light_lancers', art: 'a_falconet' },
	4: { hi: 'a_pikemen', li: 'a_arquebusiers', hc: 'a_heavy_lancers', lc: 'a_pistoleers', art: 'a_chambered_cannon' },
	5: { hi: 'a_musketeers', li: 'a_hunters', hc: 'a_gallop_cavalry', lc: 'a_hussars', art: 'a_royal_mortar' },
	6: { hi: 'a_fusiliers', li: 'a_sharpshooters', hc: 'a_cuirassiers', lc: 'a_light_dragoons', art: 'a_flying_battery' },
};
const LEVY = {
	1: { inf: 'a_feudal_levy', knights: 'a_mailed_knights' }, 2: { inf: 'a_peasant_levy', knights: 'a_plated_knights' }, 3: { inf: 'a_matchlock_levy', knights: 'a_cavaliers' },
	4: { inf: 'a_flintlock_levy', knights: 'a_late_cavaliers' }, 5: { inf: 'a_militiamen', knights: 'a_provincial_cavalry' }, 6: { inf: 'a_conscripts', knights: 'a_gendarmerie' },
};
// the regular meta at equal regiments (army_meta.js): what levies have to beat
const META = {
	1: { hc: 30 }, 2: { hc: 30 }, 3: { hc: 30 }, 4: { hi: 12, li: 9, hc: 6, lc: 3, f: 'cav_inf_cav' }, 5: { hi: 12, li: 12, hc: 3, lc: 3 }, 6: { hi: 12, li: 12, hc: 3, lc: 3 },
};
const units = (comp, age) => Object.entries(comp).filter(([k]) => k !== 'f').map(([c, n]) => ({ type: ROSTER[age][c], count: n }));
const regulars = (comp, age, extra) => ({ name: 'regulars', formation: comp.f || 'balanced', general: GENERAL, country: baseCountry(age, extra), units: units(comp, age) });
const levyArmy = (list, age, extra, more = {}) => ({ name: 'levies', formation: 'balanced', general: GENERAL, country: baseCountry(age, extra), units: list.filter(u => u.count > 0).map(u => ({ ...u })), ...more });
const scn = (a, b, location) => ({ location: location || { frontage: 10 }, attacker: { armies: [].concat(a) }, defender: { armies: [].concat(b) } });
// win rate, men lost and pops lost of side a against side b, both seat orders
async function fight(a, b, location, n = N) {
	const [m1, m2] = await Promise.all([pool.mc(scn(a, b, location), n, { seed: 21 }), pool.mc(scn(b, a, location), n, { seed: 500021 })]);
	return {
		win: (m1.wins[0] + m1.draws / 2 + m2.wins[1] + m2.draws / 2) / (2 * n), days: (m1.days + m2.days) / 2,
		lost: (m1.losses[0] + m2.losses[1]) / 2, killed: (m1.losses[1] + m2.losses[0]) / 2, wiped: (m1.overrun[0] + m2.overrun[1]) / (2 * n), n: 2 * n,
	};
}
const pct = x => `${Math.round(100 * x)}%`.padStart(5);
const men = x => `${(x / 1).toFixed(1)}k`;
const row = (a, xs) => console.log(a.padEnd(46) + xs.join(''));
async function breakEven(make, enemy, location, lo = 5, hi = 800) {
	// smallest regiment count that wins at least half the battles
	const test = async n => (await fight(make(n), enemy, location, 300)).win;
	if (await test(hi) < 0.5) return null;
	while (hi - lo > Math.max(1, lo * 0.04)) { const mid = Math.round((lo + hi) / 2); if (await test(mid) >= 0.5) hi = mid; else lo = mid; }
	return hi;
}
async function levies(ages) {
	const res = {};
	console.log('\n=== Levy regiments needed to match 30 regulars of the meta (men in brackets); levy CE +10%, frontage 10');
	row('', ['age'.padStart(5), 'all infantry'.padStart(20), '25% knights'.padStart(20), '100% knights'.padStart(20)]);
	for (const age of ages) {
		const enemy = regulars(META[age], age), mk = k => n => levyArmy([{ type: LEVY[age].inf, count: Math.round(n * (1 - k)) }, { type: LEVY[age].knights, count: Math.round(n * k) }], age);
		const cell = async k => { const b = await breakEven(mk(k), enemy); if (b == null) return 'never'; const m = (Math.round(b * (1 - k)) * S.unitStats(LEVY[age].inf).s + Math.round(b * k) * S.unitStats(LEVY[age].knights).s); return `${b} (${men(m)})`; };
		const c = await Promise.all([0, 0.25, 1].map(cell));
		res[age] = { breakEven: c };
		row('', [String(age).padStart(5), ...c.map(x => x.padStart(20))]);
	}
	console.log('\n=== Regular army of the meta + levies, against the same 30 regulars alone (win rate)');
	row('', ['age'.padStart(5), ...[10, 20, 40, 80].map(l => `+${l} levies`.padStart(11)), ' | fed in behind:', ...[20, 40, 80].map(l => `+${l}`.padStart(7))]);
	for (const age of ages) {
		const enemy = regulars(META[age], age), add = l => [{ type: LEVY[age].inf, count: Math.round(l * 0.75) }, { type: LEVY[age].knights, count: Math.round(l * 0.25) }];
		const same = await Promise.all([10, 20, 40, 80].map(l => { const a = regulars(META[age], age); a.units = [...a.units, ...add(l)]; return fight(a, enemy); }));
		const behind = await Promise.all([20, 40, 80].map(l => fight([regulars(META[age], age), levyArmy(add(l), age, {}, { arrivalDay: 'needed' })], enemy)));
		res[age].topUp = same.map(x => x.win); res[age].behind = behind.map(x => x.win);
		row('', [String(age).padStart(5), ...same.map(x => pct(x.win).padStart(11)), ' | '.padEnd(16), ...behind.map(x => pct(x.win).padStart(7))]);
	}
	console.log('\n=== Same regiment count: part of the 30 swapped for levy infantry, against 30 regulars (win rate)');
	row('', ['age'.padStart(5), ...['-10% regs', '-25%', '-50%', 'all levy'].map(x => x.padStart(11))]);
	for (const age of ages) {
		const enemy = regulars(META[age], age), base = Object.entries(META[age]).filter(([k]) => k !== 'f');
		const total = base.reduce((t, [, n]) => t + n, 0);
		const cells = await Promise.all([0.1, 0.25, 0.5, 1].map(s => {
			const u = base.map(([c, n]) => ({ type: ROSTER[age][c], count: Math.round(n * (1 - s)) })).filter(x => x.count);
			const lv = { type: LEVY[age].inf, count: total - u.reduce((t, x) => t + x.count, 0) };
			return fight({ ...regulars(META[age], age), units: [...u, lv] }, enemy);
		}));
		res[age].swap = cells.map(x => x.win);
		row('', [String(age).padStart(5), ...cells.map(x => pct(x.win).padStart(11))]);
	}
	console.log('\n=== Levy combat efficiency: all-infantry levies at their break-even size against 30 regulars (win rate); discipline stays -20%');
	row('', ['age'.padStart(5), 'levies'.padStart(8), ...[0, 0.1, 0.3, 0.6, 1].map(x => `+${Math.round(100 * x)}%`.padStart(9))]);
	for (const age of ages) {
		const enemy = regulars(META[age], age), n = await breakEven(c => levyArmy([{ type: LEVY[age].inf, count: c }], age, { levyCE: 0.1 }), enemy);
		const cells = await Promise.all([0, 0.1, 0.3, 0.6, 1].map(ce => fight(levyArmy([{ type: LEVY[age].inf, count: n }], age, { levyCE: ce }), enemy)));
		res[age].levyCE = { levies: n, win: cells.map(x => x.win) };
		row('', [String(age).padStart(5), String(n).padStart(8), ...cells.map(x => pct(x.win).padStart(9))]);
	}
	return res;
}
// Morocco's levies. Men are pop x size x culture x modifiers x control, read from three saves of the same setup:
//   1337: Sanhaja still Tolerated (x0.25), levy max 25.6k. 1372: Sanhaja Accepted, 410k tribesmen x 10% = 41k = 205 regiments.
// Discipline +13.65%, levy CE +10% (Morocco's 1372 save); the enemy gets the same discipline so only the levy penalty counts.
const MOR = { discipline: 0.1365, levyCE: 0.1 };
const STACKS = {
	1: {
		'one fielded stack': { a_sanhaja_camel_cavalry: 24, a_zenata_cavalry: 3, a_tribal_camelry_levy_1: 2, a_mailed_knights: 1 },
		'whole levy, Sanhaja Tolerated': { a_sanhaja_camel_cavalry: 49, a_zenata_cavalry: 28, a_mailed_knights: 3, a_feudal_levy: 16, a_masmuda_atlas_infantry: 4 },
		'whole levy, Sanhaja Accepted': { a_sanhaja_camel_cavalry: 195, a_zenata_cavalry: 28, a_mailed_knights: 3, a_feudal_levy: 16, a_masmuda_atlas_infantry: 4 },
	},
	2: {
		'one fielded stack': { a_sanhaja_camel_cavalry: 24, a_zenata_cavalry: 3, a_tribal_camelry_levy_1: 2, a_plated_knights: 1 },
		'whole levy, Sanhaja Tolerated': { a_sanhaja_camel_cavalry: 49, a_zenata_cavalry: 28, a_plated_knights: 2, a_peasant_levy: 8, a_masmuda_atlas_infantry: 4 },
		'whole levy, Sanhaja Accepted': { a_sanhaja_camel_cavalry: 195, a_zenata_cavalry: 28, a_plated_knights: 2, a_peasant_levy: 8, a_masmuda_atlas_infantry: 4 },
	},
	3: {
		'one fielded stack': { a_sanhaja_camel_cavalry: 25, a_zenata_cavalry: 3, a_tribal_camelry_levy_1: 2, a_cavaliers: 1, a_peasant_levy: 1 },
		'whole levy as fielded in 1372': { a_sanhaja_camel_cavalry: 205, a_zenata_cavalry: 18, a_tribal_camelry_levy_1: 16, a_mailed_knights: 5, a_peasant_levy: 6 },
	},
};
// a country with Morocco's 2.2M people but no tribes: everyone raises at 2%, with Morocco's control (x0.84) and 8k nobles at 10%
const PLAIN = {
	1: { a_feudal_levy: 74, a_mailed_knights: 4 }, 2: { a_peasant_levy: 37, a_plated_knights: 2 }, 3: { a_matchlock_levy: 25, a_cavaliers: 1 },
};
const stackMen = st => Object.entries(st).reduce((t, [k, n]) => t + n * S.unitStats(k).s, 0);
const stackArmy = (st, age, extra) => levyArmy(Object.entries(st).map(([type, count]) => ({ type, count })), age, { ...MOR, ...extra });
async function tribal() {
	const res = {};
	if (argv.includes('--plain')) {
		for (const age of [1, 2, 3]) {
			const [hc, hi] = await Promise.all(['hc', 'hi'].map(c => breakEven(n => regulars({ [c]: n }, age, { discipline: MOR.discipline }), stackArmy(PLAIN[age], age), { topography: 'flatland', vegetation: 'farmland' }, 5, 400)));
			console.log(`  age ${age}: same population, no tribes (${stackMen(PLAIN[age]).toFixed(0)}k men, ${Object.values(PLAIN[age]).reduce((a, b) => a + b, 0)} regs) is worth ${hc ?? 'more than 400'} heavy cavalry or ${hi ?? 'more than 400'} heavy infantry regiments`);
			res[age] = { hc, hi };
		}
		return res;
	}
	const terrains = { 'open farmland': { topography: 'flatland', vegetation: 'farmland' }, 'sparse (Sanhaja +20%)': { topography: 'flatland', vegetation: 'sparse' } };
	for (const age of [1, 2, 3]) {
		const foes = { '30 heavy cavalry': { hc: 30 }, '30 heavy infantry': { hi: 30 }, '60 heavy cavalry': { hc: 60 }, '60 heavy infantry': { hi: 60 } };
		console.log(`\n=== Age ${age}: Morocco's levies against regulars of the age (win rate, then men lost by Morocco / by the regulars). Regiment sizes: Sanhaja 200, heavy cavalry ${Math.round(1000 * S.unitStats(ROSTER[age].hc).s)}, heavy infantry ${Math.round(1000 * S.unitStats(ROSTER[age].hi).s)}`);
		row('', Object.keys(foes).map(x => x.padStart(24)));
		res[age] = {};
		for (const [tname, loc] of Object.entries(terrains)) {
			console.log(`  ${tname}`);
			for (const [name, st] of Object.entries(STACKS[age])) {
				const c = await Promise.all(Object.values(foes).map(f => fight(stackArmy(st, age), regulars(f, age, { discipline: MOR.discipline }), loc)));
				res[age][tname + ' / ' + name] = c;
				row(`    ${name} (${Object.values(st).reduce((a, b) => a + b, 0)} regs, ${stackMen(st).toFixed(0)}k)`, c.map(x => `${pct(x.win)} ${(x.lost).toFixed(1)}k/${(x.killed).toFixed(1)}k`.padStart(24)));
			}
		}
		// the whole levy as a number of regular regiments: the fewest that beat it half the time, in the same stack
		for (const [name, st] of Object.entries(STACKS[age]).slice(1)) {
			const [hc, hi] = await Promise.all(['hc', 'hi'].map(c => breakEven(n => regulars({ [c]: n }, age, { discipline: MOR.discipline }), stackArmy(st, age), terrains['open farmland'], 5, 400)));
			console.log(`  ${name} (${stackMen(st).toFixed(0)}k men) is worth ${hc ?? 'more than 400'} heavy cavalry or ${hi ?? 'more than 400'} heavy infantry regiments`);
			res[age]['worth ' + name] = { hc, hi };
		}
		const unit = n => levyArmy([{ type: 'a_sanhaja_camel_cavalry', count: n }], age, MOR);
		const [bc, bi] = await Promise.all([breakEven(unit, regulars({ hc: 30 }, age, { discipline: MOR.discipline })), breakEven(unit, regulars({ hi: 30 }, age, { discipline: MOR.discipline }))]);
		const mc = 30 * S.unitStats(ROSTER[age].hc).s, mi = 30 * S.unitStats(ROSTER[age].hi).s;
		console.log(`  Sanhaja regiments to match 30 regulars: ${bc ?? 'never'} vs heavy cavalry (${bc ? (bc * 0.2).toFixed(1) : '-'}k men against ${mc.toFixed(1)}k), ${bi ?? 'never'} vs heavy infantry (${bi ? (bi * 0.2).toFixed(1) : '-'}k men against ${mi.toFixed(1)}k)`);
		res[age].breakEven = { hc: bc, hi: bi };
	}
	return res;
}
// Ars Belli: a_steppe_horde lost vanilla's +0.4 max_strength (200 men, not 600) and a_late_steppe_horde (400 men) takes over at age 2.
// Same men either way, so the vanilla army has a third of the regiments. Morale damage done and taken also follow regiment size.
async function nerf() {
	const res = {};
	console.log('\n=== Steppe horde levy: men needed to match 30 regulars of the age, Ars Belli regiment size against vanilla 600-man regiments');
	for (const age of [1, 2, 3]) {
		const ab = age === 1 ? { type: 'a_steppe_horde', s: 0.2 } : { type: 'a_late_steppe_horde', s: 0.4 };
		const mine = n => levyArmy([{ type: ab.type, count: n }], age, MOR), vanilla = n => levyArmy([{ type: 'a_steppe_horde', count: n, maxStrength: 3 }], age, MOR);
		res[age] = {};
		for (const [fn, f] of Object.entries({ 'heavy cavalry': { hc: 30 }, 'heavy infantry': { hi: 30 } })) {
			const foe = regulars(f, age, { discipline: MOR.discipline });
			const [x, y] = await Promise.all([breakEven(mine, foe), breakEven(vanilla, foe)]);
			const mx = x && x * ab.s, my = y && y * 0.6;
			res[age][fn] = { abRegs: x, abMen: mx, vanillaRegs: y, vanillaMen: my };
			console.log(`  age ${age} vs 30 ${fn.padEnd(14)}: Ars Belli ${x} regs of ${Math.round(1000 * ab.s)} = ${mx?.toFixed(1)}k men, vanilla ${y} regs of 600 = ${my?.toFixed(1)}k men`);
		}
		// past the line's 40 regiments only a share of a horde fights at once, so size should bite: a whole horde as regular regiments
		for (const m of [24, 48, 96]) {
			const n = Math.round(m / ab.s), v = Math.round(m / 0.6);
			const [a, b, c, d] = await Promise.all([[mine(n), 'hc'], [vanilla(v), 'hc'], [mine(n), 'hi'], [vanilla(v), 'hi']].map(([x, cat]) => breakEven(k => regulars({ [cat]: k }, age, { discipline: MOR.discipline }), x, undefined, 5, 400)));
			res[age][m + 'k horde'] = { ab: [a, c], vanilla: [b, d] };
			console.log(`  age ${age}, ${m}k-man horde is worth: Ars Belli (${n} regs) ${a ?? '400+'} heavy cavalry or ${c ?? '400+'} heavy infantry, vanilla (${v} regs) ${b ?? '400+'} or ${d ?? '400+'}`);
		}
	}
	return res;
}
(async () => {
	const t0 = Date.now(), mode = argv[0], ages = opt('--ages', '2,3,4,5,6').split(',').map(Number);
	const out = mode === 'levies' ? await levies(ages) : mode === 'tribal' ? await tribal() : mode === 'nerf' ? await nerf() : null;
	if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify(out, null, 1));
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
