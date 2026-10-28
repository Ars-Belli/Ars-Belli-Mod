// Command-line battle simulator.
//   node .tools/scripts/battle_sim/sim.js <scenario.json> [--runs 2000] [--seed 1] [--sample] [--json]
//   node .tools/scripts/battle_sim/sim.js --units <search>        list unit types matching a name or key
// Scenario format: see scenarios/README.md next to this file.
const fs = require('fs');
const path = require('path');
const S = require('./engine.js');
S.setUnitDB(JSON.parse(fs.readFileSync(path.join(__dirname, 'units.json'), 'utf8')));

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
const men = x => Math.round(x * 1000).toLocaleString('en-US');

if (flag('--units')) {
	const q = String(flag('--units')).toLowerCase();
	const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'units.json'), 'utf8')).units;
	for (const [k, u] of Object.entries(db)) if (k.includes(q) || u.n.toLowerCase().includes(q))
		console.log(`${k.padEnd(36)} ${u.n.padEnd(28)} ${u.c.padEnd(3)} age ${u.a} ${u.levy ? 'LEVY ' : ''}power ${u.p} size ${u.s} init ${u.i} speed ${u.cs} sdd ${u.sdd} sdt ${u.sdt} mdd ${u.mdd} mdt ${u.mdt}${u.ct ? ' terrain ' + JSON.stringify(u.ct) : ''}`);
	process.exit(0);
}

const file = args.find(a => !a.startsWith('--') && a.endsWith('.json'));
if (!file) { console.error('usage: node sim.js <scenario.json> [--runs N] [--seed S] [--sample] [--json]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const runs = +flag('--runs', scn.runs || 2000);
const seed = flag('--seed') === undefined ? undefined : +flag('--seed');
const m = S.monteCarloScenario(scn, runs, { seed });
if (flag('--json')) { console.log(JSON.stringify(m, null, 1)); process.exit(0); }

const t = S.terrainInfo(scn.location || {});
console.log(`${scn.name || path.basename(file)} - ${runs} battles, frontage ${t.frontage}, attacker dice ${t.attackerDice >= 0 ? '+' : ''}${t.attackerDice}`);
console.log(`  Attacker wins ${(100 * m.wins[0] / runs).toFixed(1)}%  (wipes out the defender ${(100 * m.overrun[1] / runs).toFixed(1)}%, defender shattered ${(100 * m.shattered[1] / runs).toFixed(1)}%)`);
console.log(`  Defender wins ${(100 * m.wins[1] / runs).toFixed(1)}%  (wipes out the attacker ${(100 * m.overrun[0] / runs).toFixed(1)}%, attacker shattered ${(100 * m.shattered[0] / runs).toFixed(1)}%)`);
if (m.draws) console.log(`  Undecided ${(100 * m.draws / runs).toFixed(1)}%`);
console.log(`  Average length ${m.days.toFixed(1)} days; losses attacker ${men(m.losses[0])} of ${men(m.start[0])}, defender ${men(m.losses[1])} of ${men(m.start[1])}`);
['Attacker', 'Defender'].forEach((s, i) => m.armies[i].forEach(a => console.log(`    ${s}: ${a.name} - lost ${men(a.lost)} of ${men(a.start)}`)));
if (flag('--sample')) {
	const r = S.simulateScenario(scn, { seed });
	console.log(`\nSample battle: ${r.winner < 0 ? 'undecided' : (r.winner ? 'defender' : 'attacker') + ' won'} after ${r.days} days${r.overrun ? ' (overrun)' : r.shattered ? ' (shattered retreat)' : ''}`);
	console.log('  day  roll A/D   men A / D            morale A / D   front A / D  reserve A / D');
	for (const d of r.timeline) console.log(`  ${String(d.day).padStart(3)}  ${String(d.dice[0] + 5).padStart(3)}/${String(d.dice[1] + 5).padEnd(4)} ${men(d.men[0]).padStart(8)} / ${men(d.men[1]).padEnd(9)} ${String(Math.round(d.morale[0] * 100)).padStart(4)}% / ${String(Math.round(d.morale[1] * 100)).padEnd(5)}% ${String(d.front[0]).padStart(5)} / ${String(d.front[1]).padEnd(5)} ${String(d.reserve[0]).padStart(5)} / ${d.reserve[1]}`);
}
