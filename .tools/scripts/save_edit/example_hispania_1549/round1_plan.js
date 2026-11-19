// Worked example, round 1: the border clean-up plan for the 1549 "Hispania" campaign save. Works out which subjects are
// annexed, which locations change hands and which stray pieces go to a neighbour, simulates the owners afterwards and
// writes hispania_round1_plan.json and hispania_round1_owners.json (look at the second with render.js).
//   node ../extract.js <the save> hispania_0
//   node round1_plan.js [--report] [--max=8]
const fs = require('fs');
const { work } = require('../paths.js');
const st = require('../state.js').load('hispania_0');
const { D, L, C, deps } = st, MAP = st.map;
const overlord = {}, subs = {};
for (const d of deps) { overlord[d.s] = d; (subs[d.o] = subs[d.o] || []).push(d); }
const top = t => { let x = t; while (overlord[x]) x = overlord[x].o; return x; };
const EUR = l => l.g.continent === 'europe';
const capLoc = t => C[t] && L[C[t].capital];
const MAJORS = ['RUS', 'SPA', 'FRA', 'BOH', 'GBR', 'BYZ', 'HUN', 'GEO', 'TEU', 'PAP', 'HAB'];
const MERGE = { DAN: 'TEU', NED: 'FRA', POR: 'SPA' }; // whole countries annexed
const ALL_OVERLORDS = [...MAJORS, ...Object.keys(MERGE)];
const NO_ANNEX_TYPES = new Set(['state_bank', 'secessionists']);

// 1. subjects: annexed into their top overlord, or kept (and moved to the new overlord when theirs is merged away)
const annex = []; // { s, into, type, via }
const resubject = []; // { s, to, type }
for (const d of deps) {
	const T = top(d.s);
	if (!ALL_OVERLORDS.includes(T)) continue;
	const finalTop = MERGE[T] || T;
	const cap = capLoc(d.s);
	const inEurope = cap && EUR(cap);
	const whole = T === 'BYZ' || T === 'GEO' || T === 'DAN';
	const papTunis = d.o === 'PAP' && cap && cap.g.region === 'maghreb_region'; // the Papal vassal in Tunisia
	if (!NO_ANNEX_TYPES.has(d.type) && (whole || inEurope || papTunis)) annex.push({ s: d.s, into: finalTop, type: d.type, overlord: d.o });
	else if (MERGE[d.o] && !NO_ANNEX_TYPES.has(d.type)) resubject.push({ s: d.s, to: MERGE[d.o], type: d.type });
}
const annexedInto = Object.fromEntries(annex.map(a => [a.s, a.into]));
for (const [a, b] of Object.entries(MERGE)) annexedInto[a] = b;
const finalTag = t => annexedInto[t] || t;

// 2. simulated owners
const owner = {}; // location id -> tag
for (const l of Object.values(L)) if (l.owner) owner[l.id] = finalTag(l.ownerTag);
const transfers = []; // { id, name, from, to, why }
const give = (l, to, why) => { if (owner[l.id] && owner[l.id] !== to) { transfers.push({ id: l.id, name: l.name, from: owner[l.id], to, why }); owner[l.id] = to; } };
for (const l of Object.values(L)) if (owner[l.id] && l.g.region === 'iberia_region') give(l, 'SPA', 'Iberia to Spain');
for (const l of Object.values(L)) if (owner[l.id] && l.g.area === 'tunis_area') give(l, 'PAP', 'Tunis to the Papal States');
// French land east of the Rhine (right bank), by name; the four south Baden locations sit inside Austria
const RIGHT_BANK_BOH = ['darmstadt', 'offenbach', 'frankfurt', 'dillenburg', 'wiesbaden', 'diez', 'usingen', 'katzenelnbogen', 'hadamar', 'heidelberg', 'bensheim', 'erbach', 'apeldoorn', 'doetinchem'];
const RIGHT_BANK_HAB = ['freiburg', 'offenburg', 'hachberg', 'baden'];
const byName = Object.fromEntries(Object.values(L).map(l => [l.name, l]));
for (const n of RIGHT_BANK_BOH) { if (!byName[n]) throw new Error('no location ' + n); if (owner[byName[n].id] === 'FRA') give(byName[n], 'BOH', 'French land east of the Rhine'); }
for (const n of RIGHT_BANK_HAB) { if (!byName[n]) throw new Error('no location ' + n); if (owner[byName[n].id] === 'FRA') give(byName[n], 'HAB', 'French land east of the Rhine, inside Austria'); }

// 3. strays: small disconnected pieces in Europe (and the Maghreb coast) go to the neighbour with the longest border
const nb = id => (MAP.locations[id] ? MAP.locations[id].nb : []).filter(([j]) => owner[j] !== undefined);
function components(tag) {
	const ids = Object.keys(owner).filter(id => owner[id] === tag), seen = new Set(), out = [];
	for (const s of ids) { if (seen.has(s)) continue; const comp = [], q = [s]; seen.add(s); while (q.length) { const x = q.pop(); comp.push(x); for (const [j] of nb(x)) { const k = String(j); if (owner[k] === tag && !seen.has(k)) { seen.add(k); q.push(k); } } } out.push(comp); }
	return out;
}
const CORE = new Set(['scandinavian_region', 'north_atlantic_islands_region', 'north_german_region', 'south_german_region', 'great_britain_region', 'ireland_region', 'france_region', 'iberia_region', 'italy_region', 'carpathia_region', 'baltic_region', 'ruthenia_region', 'balkan_region', 'russian_region']);
const inScope = l => CORE.has(l.g.region) || l.g.area === 'tunis_area';
const MAX_STRAY = +(process.argv.find(a => a.startsWith('--max='))?.slice(6) || 8);
const strays = [];
for (let pass = 0; pass < 4; pass++) {
	let changed = false;
	const tags = [...new Set(Object.values(owner))];
	for (const tag of tags) {
		const comps = components(tag);
		const capital = C[tag] && String(C[tag].capital);
		const biggest = comps.reduce((a, b) => (b.length > a.length ? b : a), []);
		for (const comp of comps) {
			if (comp === biggest || comp.includes(capital) && MAJORS.includes(tag)) continue;
			if (comp.length > MAX_STRAY || !comp.every(id => inScope(L[id]))) continue;
			const border = {};
			for (const id of comp) for (const [j, len] of nb(id)) { const o = owner[j]; if (o !== tag) border[o] = (border[o] || 0) + len; }
			const cand = Object.entries(border).sort((a, b) => b[1] - a[1]);
			if (!cand.length) continue; // an island with no land neighbour
			const to = cand[0][0];
			strays.push({ tag, to, names: comp.map(id => L[id].name), border: cand.slice(0, 3) });
			for (const id of comp) give(L[id], to, 'stray');
			changed = true;
		}
	}
	if (!changed) break;
}
// 4. hand-picked: islands and far-off holdings of non-European overlords' subjects, which have no land neighbour to decide by
const HAND = { wight: 'GBR', mann: 'GBR', zakynthos: 'BYZ', sporades: 'BYZ', nice: 'FRA', thisted: 'BOH', hjorring: 'BOH', skagen: 'BOH' };
// whole small countries of far-off overlords (or with no overlord) left inside the cleaned area: to the neighbour with the longest border
for (const tag of ['AAA55', 'AAA96', 'NOR', 'AAA20']) {
	const ids = Object.keys(owner).filter(id => owner[id] === tag && EUR(L[id]));
	const border = {};
	for (const id of ids) for (const [j, len] of nb(id)) { const o = owner[j]; if (o !== tag && MAJORS.includes(o)) border[o] = (border[o] || 0) + len; }
	const to = Object.entries(border).sort((a, b) => b[1] - a[1])[0];
	if (!to) { console.log('no major neighbour for', tag); continue; }
	for (const id of ids) give(L[id], to[0], 'small foreign holding inside ' + to[0]);
}
for (const [n, to] of Object.entries(HAND)) { if (!byName[n]) throw new Error('no location ' + n); give(byName[n], to, 'island held by a far-off overlord'); }

const plan = { annex, resubject, merge: MERGE, transfers, strays };
fs.writeFileSync(work('hispania_round1_plan.json'), JSON.stringify(plan, null, 1));
fs.writeFileSync(work('hispania_round1_owners.json'), JSON.stringify(owner));
if (process.argv.includes('--report')) {
	console.log('annexed subjects:', annex.length);
	const byInto = {}; for (const a of annex) (byInto[a.into] = byInto[a.into] || []).push(a.s + (a.type !== 'vassal' ? ':' + a.type : ''));
	for (const [k, v] of Object.entries(byInto)) console.log('  ' + k + ' <- ' + v.join(' '));
	console.log('subjects moved to a new overlord:', resubject.map(r => `${r.s}(${r.type})->${r.to}`).join(' '));
	const skipped = deps.filter(d => ALL_OVERLORDS.includes(top(d.s)) && !annexedInto[d.s] && !resubject.some(r => r.s === d.s));
	console.log('subjects left as they are:', skipped.map(d => `${d.s}(${d.o} ${d.type}, cap ${capLoc(d.s)?.g.region})`).join(' '));
	const tw = {}; for (const t of transfers) { const k = `${t.why}: ${t.from} -> ${t.to}`; (tw[k] = tw[k] || []).push(t.name); }
	console.log('location transfers:', transfers.length);
	for (const [k, v] of Object.entries(tw)) console.log('  ' + k + ' (' + v.length + '): ' + v.slice(0, 14).join(' ') + (v.length > 14 ? ' ...' : ''));
	// who still owns land in Europe besides the majors
	const left = {}; for (const [id, t] of Object.entries(owner)) if (EUR(L[id]) && !MAJORS.includes(t)) (left[t] = left[t] || []).push(L[id].name);
	console.log('other owners left in Europe:'); for (const [t, v] of Object.entries(left)) console.log('  ' + t + (overlord[t] ? '(' + overlord[t].o + ')' : '') + ' ' + v.length + ': ' + v.slice(0, 8).join(' '));
	// majors' pieces
	for (const m of MAJORS) { const cs = components(m).filter(c => c.some(id => inScope(L[id]))).sort((a, b) => b.length - a.length); console.log(m, 'pieces in scope:', cs.map(c => c.length).join(' '), cs.slice(1).filter(c => c.length <= 12).map(c => '[' + c.slice(0, 4).map(id => L[id].name).join(',') + ']').join(' ')); }
}
