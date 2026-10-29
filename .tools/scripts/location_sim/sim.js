// Command-line location simulator.
//   node .tools/scripts/location_sim/sim.js <scenario.json> [--months 120] [--json]
//        [--modifier <key>]     one modifier taken apart by source (local + the owner's global counterpart)
//        [--modifiers]          every modifier of the location with its total
// Scenario format: "EU5 Location Mechanics (1.4.4).md" in the repo root; from_save.js builds one from a save.
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const DB = E.DB;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const file = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
if (!file) { console.error('usage: node sim.js <scenario.json> [--months N] [--modifier key] [--modifiers] [--json]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const L = E.locationState(scn), C = E.countryState(scn), M = E.locationModifiers(L, C);
const nm = k => DB.names[k] || k;
const num = (x, d = 2) => (x === undefined || x === null || Number.isNaN(x)) ? '-' : (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
const pct = x => (x >= 0 ? '+' : '') + (100 * x).toFixed(1) + '%';
const fmtMod = (k, x) => { const t = DB.modifierTypes[k]; return t && t[0] === 1 ? pct(x) : (x >= 0 ? '+' : '') + num(x, 4); };

if (flag('--modifier')) {
	const k = flag('--modifier');
	console.log(`${nm('m:' + k)} (${k}) = ${fmtMod(k, M.get(k))}`);
	for (const [s, x] of M.why(k)) console.log(`  ${typeof x === 'number' ? fmtMod(k, x).padStart(10) : String(x).padStart(10)}  ${s}`);
	process.exit(0);
}
if (flag('--modifiers')) {
	const keys = new Set([...Object.keys(M.local.v), ...Object.keys(C.mods.v).map(k => k.startsWith('global_') && DB.modifierTypes['local_' + k.slice(7)] ? 'local_' + k.slice(7) : k)]);
	for (const k of [...keys].sort()) { const x = M.get(k); if (x) console.log(`  ${k.padEnd(48)} ${fmtMod(k, x)}`); }
	process.exit(0);
}

// ---- location summary
console.log(`${scn.name || path.basename(file)}`);
console.log(`  ${nm(L.key)}: ${nm(L.rank)}, ${nm(L.topography)} / ${nm(L.vegetation) || '-'} / ${nm(L.climate)}, raw material ${nm(L.rawMaterial)}` +
	`${L.river ? `, river size ${L.river}` : ''}${L.coastal ? ', coastal' : ''}${L.port ? ', port' : ''}${L.capital ? ', capital' : ''}${L.marketCenter ? ', market center' : ''}`);
console.log(`  development ${num(L.development, 1)}, prosperity ${pct(L.prosperity)}, control ${(100 * L.control).toFixed(0)}% (max ${(100 * Math.min(1, M.get('local_max_control'))).toFixed(0)}%), proximity ${num(L.proximity, 0)}, ${L.integration}`);
const byType = {};
for (const p of L.pops) byType[p.type] = (byType[p.type] || 0) + p.size;
console.log(`  population ${num(L.population * 1000, 0)}: ` + Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([t, x]) => `${nm(t)} ${num(x * 1000, 0)}`).join(', '));

// ---- buildings and their caps
if (L.buildings.length) {
	console.log('\nBuildings (level / cap)');
	for (const b of [...L.buildings].sort((a, b) => (b.foreign ? -1 : 0) - (a.foreign ? -1 : 0) || b.level - a.level)) {
		const cap = E.maxLevel(b.type, L, M);
		const c = typeof cap === 'object' ? cap.value : cap;
		console.log(`  ${nm(b.type).padEnd(32)} ${String(b.level).padStart(3)} / ${String(Number.isNaN(c) ? '?' : c).padEnd(4)}${b.foreign ? ' foreign' : ''}${b.employed !== undefined ? `  employs ${num(b.employed * 1000, 0)}` : ''}`);
	}
}

// ---- results from the engine (sections appear as the engine gains them)
if (typeof E.evaluate === 'function') {
	const r = E.evaluate(scn);
	if (flag('--json')) { console.log(JSON.stringify(r, null, 1)); process.exit(0); }
	for (const section of r.sections || []) {
		console.log('\n' + section.title);
		for (const line of section.lines) console.log('  ' + line);
	}
}
