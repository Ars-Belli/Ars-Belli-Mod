// Castile against Morocco, levy against levy, on every terrain the two own, with each side attacking. Same neutral general on both sides.
//   node levy_battles.js [--n 2000] [--out results/levy_battles.json]
// Regiments of one unit type from different provinces merge, so each type is full regiments plus one partial. Progress goes to stderr.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '../..');
const S = require(path.join(R, 'engine.js'));
S.setUnitDB(require(path.join(R, 'units.json')));
const Pool = require(path.join(R, 'pool.js'));
const progress = require(path.join(R, 'progress.js'));
const args = process.argv.slice(2), flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const N = +flag('--n', 2000), OUT = flag('--out');
const I = JSON.parse(fs.readFileSync(path.join(__dirname, 'inputs.json'), 'utf8'));
const GENERAL = { adm: 60, dip: 59, mil: 61 }; // the neutral general of every analysis here (levy_meta.js)

const stack = (rows, field, scale = 1) => {
	const units = [];
	for (const r of rows) {
		const men = r[field] * scale, full = Math.floor(men / r.size + 1e-9), part = men / r.size - full;
		if (full) units.push({ type: r.unit, count: full });
		if (part * r.size >= 0.001) units.push({ type: r.unit, count: 1, strength: part });
	}
	return units;
};
const sum = (rows, f) => rows.reduce((t, r) => t + r[f], 0);
const army = (tag, units) => ({ name: tag, country: tag, formation: 'balanced', general: GENERAL, units });
const sep = I.levies.september, start = I.levies.start;
const FORCES = [
	['Full levies at September 1337 control', stack(sep.MOR, 'men'), stack(sep.CAS, 'men')],
	['Morocco as it stands in the save (still recovering), Castile full', stack(sep.MOR, 'now'), stack(sep.CAS, 'men')],
	['Full levies at the April 1337 start', stack(start.MOR, 'men'), stack(start.CAS, 'men')],
	['Equal men: Castile cut to the size of Morocco, same mix', stack(sep.MOR, 'men'), stack(sep.CAS, 'men', sum(sep.MOR, 'men') / sum(sep.CAS, 'men'))],
];
const place = (t, crossing = 'none') => ({ topography: t.topography, vegetation: t.vegetation, climate: t.climate, river: crossing === 'river', crossing, rankFrontage: 0 });
// the most common terrain of each country, also fought across a river and from the sea
const top = tag => [...I.terrains].sort((a, b) => b[tag] - a[tag])[0];
const crossings = [...new Set([top('MOR'), top('CAS')])].flatMap(t => ['river', 'strait'].map(c => ({ ...t, crossing: c })));
const PLACES = [...I.terrains, ...crossings];
const label = t => `${t.topography} ${t.vegetation}${t.crossing ? `, attacker crosses ${t.crossing}` : ''}`;
const scenario = (mor, cas, loc, morAttacks) => ({ location: loc, countries: I.countries, attacker: { armies: [morAttacks ? army('MOR', mor) : army('CAS', cas)] }, defender: { armies: [morAttacks ? army('CAS', cas) : army('MOR', mor)] } });
const men = u => u.reduce((t, g) => t + g.count * S.unitStats(g.type).s * (g.strength ?? 1), 0);
const regs = u => u.reduce((t, g) => t + g.count, 0);
const pct = x => `${(100 * x).toFixed(0)}%`;

(async () => {
	const pool = Pool();
	const total = FORCES.length * PLACES.length * 2, tick = progress(total, 'battle cells');
	const results = [];
	let seed = 1;
	const jobs = [];
	for (const [fi, [fname, mor, cas]] of FORCES.entries()) for (const [pi, t] of PLACES.entries()) for (const morAttacks of [true, false]) {
		const s = seed; seed += N;
		jobs.push(pool.mc(scenario(mor, cas, place(t, t.crossing), morAttacks), N, { seed: s }).then(m => {
			tick();
			const cs = morAttacks ? 1 : 0, ms = 1 - cs;
			results.push({ fi, pi, morAttacks, cas: m.wins[cs] / N, mor: m.wins[ms] / N, days: m.days, lostCas: m.losses[cs], lostMor: m.losses[ms], wiped: (m.overrun[0] + m.overrun[1]) / N, shatteredCas: m.shattered[cs] / N, shatteredMor: m.shattered[ms] / N, frontage: S.terrainInfo(place(t, t.crossing)).frontage, dice: S.terrainInfo(place(t, t.crossing)).attackerDice });
		}));
	}
	await Promise.all(jobs);
	await pool.close();
	console.log(`Castile against Morocco, levy against levy. ${N} battles a cell, same neutral general on both sides (adm 60, dip 59, mil 61), ${I.source.save}.`);
	console.log(`Morocco discipline ${pct(I.countries.MOR.discipline)}, morale +${pct(I.countries.MOR.moraleMod)}. Castile discipline ${pct(I.countries.CAS.discipline)}, morale +${pct(I.countries.CAS.moraleMod)}, +${pct(I.countries.CAS.vsHeathen || 0)} damage against other faiths, levy efficiency +${pct(I.countries.CAS.levyCE || 0)}.`);
	for (const [fi, [fname, mor, cas]] of FORCES.entries()) {
		console.log(`\n=== ${fname}: Morocco ${men(mor).toFixed(1)}k in ${regs(mor)} regiments, Castile ${men(cas).toFixed(1)}k in ${regs(cas)}`);
		console.log('terrain'.padEnd(44) + 'width'.padStart(6) + 'dice'.padStart(5) + ' | Morocco attacks: Castile wins  days  men lost M/C | Castile attacks: Castile wins  days  men lost M/C');
		for (const [pi, t] of PLACES.entries()) {
			const a = results.find(r => r.fi === fi && r.pi === pi && r.morAttacks), b = results.find(r => r.fi === fi && r.pi === pi && !r.morAttacks);
			const cell = r => pct(r.cas).padStart(13) + r.days.toFixed(1).padStart(6) + `${r.lostMor.toFixed(1)}k/${r.lostCas.toFixed(1)}k`.padStart(14);
			console.log(label(t).padEnd(44) + String(a.frontage).padStart(6) + String(a.dice).padStart(5) + ' |' + ' '.repeat(16) + cell(a) + ' |' + ' '.repeat(16) + cell(b));
		}
		const rs = results.filter(r => r.fi === fi);
		console.log(`  stack wipes in ${pct(rs.reduce((t, r) => t + r.wiped, 0) / rs.length)} of battles; the loser's retreat is shattered: Morocco ${pct(rs.reduce((t, r) => t + r.shatteredMor, 0) / rs.length)}, Castile ${pct(rs.reduce((t, r) => t + r.shatteredCas, 0) / rs.length)}`);
	}
	if (OUT) fs.writeFileSync(path.join(__dirname, OUT), JSON.stringify({ n: N, places: PLACES.map(label), forces: FORCES.map(f => f[0]), results }, null, '\t'));
})();
