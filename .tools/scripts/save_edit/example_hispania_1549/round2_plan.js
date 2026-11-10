// Worked example, round 2: named provinces and single locations change hands, on the save made after round 1.
// Lists the pieces the changes would cut off, so they can be handed over too (Krosno here).
//   node ../extract.js <the save made after round 1> hispania_2
//   node round2_plan.js
const fs = require('fs');
const { work } = require('../paths.js');
const st = require('../state.js').load('hispania_2');
const { L, D } = st, MAP = st.map;
const owner = {}; for (const l of Object.values(L)) if (l.tag) owner[l.id] = l.tag;
const byName = Object.fromEntries(Object.values(L).map(l => [l.name, l]));
const transfers = [];
const give = (l, to, why) => { if (owner[l.id] && owner[l.id] !== to) { transfers.push({ id: l.id, name: l.name, from: owner[l.id], to, why }); owner[l.id] = to; } };
const prov = (p, to, why, onlyFrom) => { const ls = Object.values(L).filter(l => l.g.province === p); if (!ls.length) throw new Error('no province ' + p); for (const l of ls) if (!onlyFrom || owner[l.id] === onlyFrom) give(l, to, why); };
const loc = (n, to, why) => { if (!byName[n]) throw new Error('no location ' + n); give(byName[n], to, why); };
for (const p of ['czestochowa_province', 'krakow_province', 'pilzno_province', 'sandomierz_province', 'przemysl_province']) prov(p, 'TEU', 'Lesser Poland to the Teutonic Order');
loc('biecz', 'HUN', 'Biecz to Hungary');
prov('drohobych_province', 'RUS', 'Drohobych and Lubaczow to Russia'); loc('lubaczow', 'RUS', 'Drohobych and Lubaczow to Russia');
for (const p of ['lower_alsace_province', 'upper_alsace_province', 'palatinate_province']) prov(p, 'HAB', 'Alsace and the Palatinate to Austria');
prov('untermain_province', 'BOH', 'Lower Main to Bohemia');
prov('oberwallis_province', 'PAP', 'Wallis to the Papal States');
loc('schleiden', 'FRA', 'Schleiden to France');
for (const p of ['niederrhein_province', 'limburg_province', 'kempenland_province', 'julich_province', 'koln_bucht_province']) prov(p, 'BOH', 'Lower Rhine to Bohemia');
prov('kabylia_province', 'SPA', 'Kabylia back to Spain');
loc('krosno', 'HUN', 'Krosno to Hungary'); // not asked for: the changes above would leave it a lone Bohemian location

// pieces cut off by the changes
const nb = id => (MAP.locations[id] ? MAP.locations[id].nb : []).filter(([j]) => owner[j] !== undefined);
const MAJ = ['RUS', 'SPA', 'FRA', 'BOH', 'GBR', 'BYZ', 'HUN', 'GEO', 'TEU', 'PAP', 'HAB'];
for (const tag of MAJ) {
	const ids = Object.keys(owner).filter(id => owner[id] === tag && (L[id].g.continent === 'europe' || L[id].g.region === 'maghreb_region')), seen = new Set(), comps = [];
	for (const s of ids) { if (seen.has(s)) continue; const comp = [], q = [s]; seen.add(s); while (q.length) { const x = q.pop(); comp.push(x); for (const [j] of nb(x)) { const k = String(j); if (owner[k] === tag && !seen.has(k)) { seen.add(k); q.push(k); } } } comps.push(comp); }
	comps.sort((a, b) => b.length - a.length);
	const small = comps.slice(1).filter(c => c.length <= 15);
	if (small.length) console.log(tag, 'pieces:', small.map(c => { const border = {}; for (const id of c) for (const [j, len] of nb(id)) if (owner[j] !== tag) border[owner[j]] = (border[owner[j]] || 0) + len; return c.length + ' [' + c.slice(0, 6).map(id => L[id].name).join(',') + '] next to ' + Object.entries(border).sort((a, b) => b[1] - a[1]).map(([t, v]) => t + ':' + Math.round(v)).join(' '); }).join('\n    '));
}
const tw = {}; for (const t of transfers) { const k = `${t.why}: ${t.from} -> ${t.to}`; (tw[k] = tw[k] || []).push(t.name); }
console.log('transfers:', transfers.length);
for (const [k, v] of Object.entries(tw)) console.log('  ' + k + ' (' + v.length + '): ' + v.join(' '));
fs.writeFileSync(work('hispania_round2_plan.json'), JSON.stringify({ transfers }, null, 1));
fs.writeFileSync(work('hispania_round2_owners.json'), JSON.stringify(owner));
