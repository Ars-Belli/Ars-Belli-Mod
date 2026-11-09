// node .tools/scripts/battle_sim/analysis/cav_power/units_with_cav_power.js <out.json> <p1,p2,p3,p4,p5,p6> [upkeep]
// Writes a copy of units.json whose cavalry (light and heavy) has the given template combat power per age, keeping
// each unit's own addition on top: p = p - mod template + wanted template. Mercenary copies (a_abm_merc_<x>, no age)
// take the age of a_<x>. The mod's templates are read from MOD_TEMPLATE below, so rebuild units.json first.
// upkeep (optional): cavalry maintenance manpower a man a month, the mod's 0.06 by default (MOD_UPKEEP). Vanilla 0.04.
// Vanilla 1.4.7: 2.6,2.6,2.6,2.85,3.25,3.25 0.04
const fs = require('fs');
const path = require('path');
const MOD_TEMPLATE = [2.2, 2.4, 2.6, 2.85, 3.0, 3.2]; // in_game/common/unit_types/00_age_templates_land.txt
const MOD_UPKEEP = 0.06; // in_game/common/prices/abm_prices.txt, army_light/heavy_cavalry_maintenance manpower
const [out, list, upkeepArg] = process.argv.slice(2);
const upkeep = upkeepArg != null ? +upkeepArg : MOD_UPKEEP;
if (!out || !list) { console.log('usage: units_with_cav_power.js <out.json> <p1,...,p6>'); process.exit(1); }
const want = list.split(',').map(Number);
if (want.length !== 6 || want.some(x => !(x > 0))) throw new Error('need six positive powers');
const db = JSON.parse(fs.readFileSync(path.join(__dirname, '../../units.json'), 'utf8'));
let n = 0;
for (const [k, u] of Object.entries(db.units)) {
	if (u.c !== 'lc' && u.c !== 'hc') continue;
	const age = u.a || (db.units[k.replace(/^a_abm_merc_/, 'a_')] || {}).a;
	if (!age) throw new Error(`no age for ${k}`);
	u.p = +(u.p - MOD_TEMPLATE[age - 1] + want[age - 1]).toFixed(4);
	if (u.pr) u.pr.m[1] = +(u.pr.m[1] - MOD_UPKEEP + upkeep).toFixed(5);
	n++;
}
for (const c of ['lc', 'hc']) db.catPrice[c].m[1] = +(db.catPrice[c].m[1] - MOD_UPKEEP + upkeep).toFixed(5);
db.cavPower = want; db.cavUpkeep = upkeep;
fs.writeFileSync(out, JSON.stringify(db));
console.log(`wrote ${out}: ${n} cavalry units, template power ${want.join(' / ')}, upkeep ${upkeep} manpower a man`);
