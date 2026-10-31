// Gathers what levy_battles.js needs into inputs.json, so the battles can be rerun without the saves: levies from the country simulator, country values from the battle importer,
// and the terrains the two countries really hold. See README.md for the commands that make the source files.
const fs = require('fs'), path = require('path');
const LS = path.join(__dirname, '../../../location_sim');
const local = f => JSON.parse(fs.readFileSync(path.join(LS, 'scenarios/local', f), 'utf8'));
const DATA = JSON.parse(fs.readFileSync(path.join(LS, 'data.json'), 'utf8'));
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'countries_raw.json'), 'utf8'));
const countries = {};
for (const k of ['MOR', 'CAS']) { const { notes, ...stats } = raw.countries[k]; countries[k] = stats; }
const units = r => r.rows.map(({ unit, men, now, size }) => ({ unit, men, now, size }));
const levies = {
	september: { MOR: units(local('mor_levy.json')), CAS: units(local('cas_levy.json')) },
	start: { MOR: units(local('mor_levy_start.json')), CAS: units(local('cas_levy_start.json')) },
};
// every land terrain the two countries own, most common first, with an example location
const byKey = new Map(DATA.locations.map(l => [l[0], l]));
const combos = {};
for (const [tag, file] of [['MOR', 'mor_1337_09.json'], ['CAS', 'cas_1337_09.json']]) for (const loc of local(file).locations) {
	const l = byKey.get(loc.key);
	if (!l) continue;
	const k = `${l[1]}|${l[2]}`, c = (combos[k] ??= { topography: l[1], vegetation: l[2], MOR: 0, CAS: 0, climates: {}, example: {} });
	c[tag]++; c.climates[l[3]] = (c.climates[l[3]] || 0) + 1; c.example[tag] ??= loc.key;
}
const terrains = Object.values(combos).sort((a, b) => (b.MOR + b.CAS) - (a.MOR + a.CAS)).map(c => ({ topography: c.topography, vegetation: c.vegetation, climate: Object.entries(c.climates).sort((a, b) => b[1] - a[1])[0][0], MOR: c.MOR, CAS: c.CAS, example: c.example.MOR || c.example.CAS }));
fs.writeFileSync(path.join(__dirname, 'inputs.json'), JSON.stringify({ source: raw.source, countries, levies, terrains }, null, '\t'));
const men = (r, f) => r.reduce((t, x) => t + x[f], 0) * 1000;
console.log(`Morocco ${men(levies.september.MOR, 'men').toFixed(0)} full, ${men(levies.september.MOR, 'now').toFixed(0)} now, ${men(levies.start.MOR, 'men').toFixed(0)} at the start; Castile ${men(levies.september.CAS, 'men').toFixed(0)} full, ${men(levies.start.CAS, 'men').toFixed(0)} at the start; ${terrains.length} terrains`);
console.log(JSON.stringify(countries));
for (const t of terrains) console.log(`  ${t.topography} ${t.vegetation} (${t.climate}): ${t.MOR} Moroccan, ${t.CAS} Castilian locations, e.g. ${t.example}`);
