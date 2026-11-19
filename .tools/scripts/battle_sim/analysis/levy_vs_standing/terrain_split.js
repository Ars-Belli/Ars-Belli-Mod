// Why does the Levy side lose its lead on wooded hills? The same armies as battles.js, with frontage and terrain modifiers switched separately.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, "../..");
const L = __dirname;
const S = require(path.join(R, 'engine.js'));
S.setUnitDB(require(path.join(R, 'units.json')));
const pool = require(path.join(R, 'pool.js'))();
const { ages } = require(path.join(R, '../focus_picks/focus_data.js'));
const ROSTER = { hi: 'a_men_at_arms', li: 'a_handgonners', hc: 'a_heavy_cavalrymen', lc: 'a_cavalrymen', art: 'a_houfnice' };
const GENERAL = { adm: 60, dip: 59, mil: 61 };
const N = 400;
const FIELD = { land_morale: 'moraleFlat', land_morale_modifier: 'moraleMod', discipline: 'discipline', levy_combat_efficiency_modifier: 'levyCE', army_maintenance_efficiency: 'maintenanceEfficiency', army_initiative: 'initiativeMod', military_tactics: 'tactics', army_heavy_infantry_power: 'power.hi', army_light_infantry_power: 'power.li', army_heavy_cavalry_power: 'power.hc', army_light_cavalry_power: 'power.lc', army_artillery_power: 'power.art' };
const setField = (o, f, x) => { const ks = f.split('.'); let t = o; for (const k of ks.slice(0, -1)) t = t[k] ??= {}; const l = ks[ks.length - 1]; t[l] = (t[l] || 0) + x; };
const focusMods = id => {
	const f = ages.find(a => a.n === 2).mil.find(x => x.id === id), m = {};
	for (const [, text] of f.adv) for (const line of String(text).split('\n')) { const [k, v] = line.split('=').map(x => x.trim()); if (k && !Number.isNaN(+v)) m[k] = (m[k] || 0) + +v; }
	return m;
};
const LOCS = [
	['open ground, frontage 10', { topography: 'flatland', vegetation: 'farmland', climate: 'mediterranean', rankFrontage: 0 }],
	['open ground, frontage 5', { topography: 'flatland', vegetation: 'farmland', climate: 'mediterranean', rankFrontage: 0, frontage: 5 }],
	['hills + woods modifiers, frontage 10', { topography: 'hills', vegetation: 'woods', climate: 'mediterranean', rankFrontage: 0, frontage: 10 }],
	['wooded hills, frontage 5', { topography: 'hills', vegetation: 'woods', climate: 'mediterranean', rankFrontage: 0 }],
];
const side = (tag, id, T, res, saved) => {
	const save = JSON.parse(fs.readFileSync(path.join(L, '../castile_morocco/countries_1338_04.json'), 'utf8')).countries[tag.toUpperCase()];
	const { notes, ...BASE } = save, c = JSON.parse(JSON.stringify(BASE)), mods = focusMods(id);
	for (const [k, v] of Object.entries(mods)) if (FIELD[k]) setField(c, FIELD[k], v);
	const r = res.runs.find(x => x.label === `${id}@${T}`), levy = [];
	for (const u of r.levies[T]) { const full = Math.floor(u.men / u.size + 1e-9), part = u.men / u.size - full; if (full) levy.push({ type: u.unit, count: full }); if (part * u.size >= 0.001) levy.push({ type: u.unit, count: 1, strength: part }); }
	const exp = (mods.monthly_experience_gain || 0) / Math.max(1e-6, S.D.EXPERIENCE_DECAY + S.D.REGULAR_DECAY);
	const regs = saved.regulars.split(', ').filter(Boolean).map(x => { const [n, k] = x.split(' '); return { type: ROSTER[k], count: +n, experience: exp }; });
	return { name: id, country: c, formation: /cav wings/.test(saved.mix) ? 'cav_inf_cav' : 'balanced', general: GENERAL, units: [...regs, ...levy] };
};
(async () => {
	const out = [];
	for (const tag of ['mor', 'cas']) {
		const res = JSON.parse(fs.readFileSync(path.join(L, `results/final_${tag}_applied.json`), 'utf8'));
		const bat = JSON.parse(fs.readFileSync(path.join(L, `results/battles_${tag}_applied.json`), 'utf8'));
		for (const b of bat.results) {
			const A = side(tag, 'levy', b.year, res, b.levy), B = side(tag, 'standing_forces', b.year, res, b.standing);
			const row = { tag, year: b.year, cells: [] };
			for (const [label, loc] of LOCS) {
				const [x, y] = await Promise.all([{ location: loc, attacker: { armies: [A] }, defender: { armies: [B] } }, { location: loc, attacker: { armies: [B] }, defender: { armies: [A] } }].map((s, i) => pool.mc(s, N, { seed: 1000 + b.year + i })));
				row.cells.push({ label, win: (x.wins[0] + y.wins[1]) / (2 * N), days: (x.days + y.days) / 2, lostLevy: (x.losses[0] + y.losses[1]) / 2, lostStanding: (x.losses[1] + y.losses[0]) / 2 });
			}
			out.push(row);
			console.log(`${tag} year ${b.year}: ` + row.cells.map(c => `${(100 * c.win).toFixed(0)}%`).join('  '));
		}
	}
	await pool.close();
	console.log('\ncolumns:', LOCS.map(l => l[0]).join(' | '));
	for (const r of out) for (const c of r.cells) console.log(`${r.tag} y${r.year} ${c.label.padEnd(38)} ${(100 * c.win).toFixed(0).padStart(3)}%  ${c.days.toFixed(0)} days  men lost ${c.lostLevy.toFixed(1)}k / ${c.lostStanding.toFixed(1)}k`);
})();
