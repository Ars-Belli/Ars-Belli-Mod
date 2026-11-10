// Which AI subjects could lend an army to their overlord? "Lend Army to War Leader" (lend_unit_to_ally) refuses any army holding a levy, mercenary or
// prisoner regiment, and an army of auxiliaries only. Counts, for every subject in a save, the armies it has and the armies the interaction would accept.
//   node .tools/scripts/battle_sim/analysis/meta_1.4/subject_armies.js <save file name>
// Loyalty is not stored in the save, so it is not checked. Liberty desire is, and the AI's subject case needs it under 25.
const path = require('path');
const R = path.resolve(__dirname, '..', '..', '..', '..', '..');
const P = require(R + '/.tools/scripts/battle_sim/paradox.js');
const U = require(R + '/.tools/scripts/battle_sim/units.json').units;
const dir = path.join(process.env.USERPROFILE, 'Documents/Paradox Interactive/Europa Universalis V/save games');
const s = P.openSave(path.join(dir, process.argv[2]));
const dip = s.section('diplomacy_manager'), units = s.section('unit_manager').database, subs = s.section('subunit_manager').database;
const regsOf = {};
for (const x of Object.values(subs)) if (x && typeof x === 'object' && x.unit && x.unit !== '0') (regsOf[x.unit] ||= []).push(x);
const armiesOf = {};
for (const [id, u] of Object.entries(units)) if (u && u.is_army === 'yes' && regsOf[id]) (armiesOf[u.country] ||= []).push(regsOf[id]);
const isAux = r => U[r.type]?.c === 'aux' || /camp_followers|auxiliar/.test(r.type);
const lendable = regs => !regs.some(r => r.levies || r.mercenary || r.prisoner) && !regs.every(isAux);
const list = [].concat(dip.dependency || []);
const byType = {};
let withArmy = 0, withLendable = 0, lowLD = 0, lowLDLendable = 0, armies = 0, lend = 0, regiments = 0, lendRegs = 0;
for (const d of list) {
	const type = d.named_targets?.find(t => t.flag === 'subject_type')?.target?.object || '?';
	const t = (byType[type] ||= { n: 0, army: 0, lendable: 0 });
	const a = armiesOf[d.second] || [], ok = a.filter(lendable), ld = +(dip[d.second]?.liberty_desire || 0);
	t.n++; if (a.length) { t.army++; withArmy++; } if (ok.length) { t.lendable++; withLendable++; }
	if (ld < 25) { lowLD++; if (ok.length) lowLDLendable++; }
	armies += a.length; lend += ok.length; regiments += a.reduce((x, r) => x + r.length, 0); lendRegs += ok.reduce((x, r) => x + r.length, 0);
}
console.log(`${process.argv[2]}, ${s.date()}`);
console.log(`${list.length} subjects; ${withArmy} with an army; ${withLendable} with an army the interaction accepts; ${lowLD} under 25 liberty desire, of which ${lowLDLendable} with such an army`);
console.log(`${armies} subject armies, ${lend} lendable; ${regiments} regiments, ${lendRegs} in lendable armies`);
for (const [k, v] of Object.entries(byType).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(24)} ${String(v.n).padStart(4)} subjects  ${String(v.army).padStart(4)} with an army  ${String(v.lendable).padStart(4)} lendable`);
