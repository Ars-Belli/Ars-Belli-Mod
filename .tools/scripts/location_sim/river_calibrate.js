// Calibrates the map's river links from a save. build_map.js guesses them from rivers.png; the game traces its rivers
// differently (a river dipping through a corner of a location does not link it), so this reads every country's proximity
// tree (proximity_persistent_cache) and finds the neighbour pairs the game priced as a river (base 12) and the pairs that
// cannot be a river (a river step would have given the child more than the game did).
//   node .tools/scripts/location_sim/river_calibrate.js <save|latest> [--report 30]   -> river_fixes.json
// build_map.js applies river_fixes.json; rerun it after this. Fixes from earlier saves are kept unless this save disagrees.
const fs = require('fs');
const path = require('path');
const { openSave, latestSave } = require('../battle_sim/paradox.js');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'map.json'), 'utf8'));
const OUT = path.join(__dirname, 'river_fixes.json');

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const saveArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const file = !saveArg || saveArg === 'latest' ? latestSave() : saveArg;
const save = openSave(file);
const t0 = Date.now();
const key = id => (DATA.locations[id - 1] || [])[0] || String(id);
const T = id => DATA.locations[id - 1] || [];
const list = x => (x === undefined ? [] : Array.isArray(x) ? x : x.__list || (typeof x === 'object' ? Object.values(x) : String(x).trim().split(/\s+/)));

// ---- the save: proximity and development of every location, roads, every country's tree
const locSec = save.section('locations');
const locs = locSec.locations || locSec.database || locSec;
const prox = new Map(), dev = new Map(), owner = new Map();
for (const [id, l] of Object.entries(locs)) {
	if (!l || typeof l !== 'object') continue;
	if (l.proximity !== undefined) prox.set(+id, +l.proximity);
	if (l.development !== undefined) dev.set(+id, +l.development);
	if (l.owner !== undefined) owner.set(+id, +l.owner);
}
const roads = new Map();
for (const r of list((save.section('road_network') || {}).roads)) { roads.set(r.from + ',' + r.to, r.type); roads.set(r.to + ',' + r.from, r.type); }
const straits = new Set();
for (const [a, b] of MAP.straits || []) { straits.add(a + ',' + b); straits.add(b + ',' + a); }
const countries = save.section('countries').database || {};
console.log(`save read: ${prox.size} locations with proximity, ${roads.size / 2} roads, ${Object.keys(countries).length} countries (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

// ---- the cost model's terrain part (proximity_development.md 1.4): river and road steps ignore vegetation
const topo = DATA.terrain.topography, veg = DATA.terrain.vegetation;
function speeds(a, b) {
	const tp = (topo[T(a)[1]] || {}).proximity;
	const t = tp && typeof tp === 'object' ? (T(b)[1] in (tp.override || {}) ? tp.override[T(b)[1]] : tp.default) : 0;
	const v = (veg[T(a)[2]] || {}).proximity;
	return { np: Math.max(0.25, 1 + Math.min(0, t)), plain: Math.max(0.25, 1 + (typeof v === 'number' ? v : 0) + Math.min(0, t)) };
}
const roadBase = r => 20 - ((DATA.roadTypes[r] || {}).proximity || 0);
const isLand = id => !!T(id)[0] && !['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'atoll', 'lakes', 'high_lakes', 'salt_pans'].includes(T(id)[1]);
const nbOf = id => (MAP.locations[id] || {}).nb || [];
const isNb = (a, b) => nbOf(a).some(n => n[0] === b);
const mapRiver = (a, b) => nbOf(a).some(n => n[0] === b && n[2]);

// ---- per country: tree edges between its own land locations
const edgesOf = new Map(); // cid -> [{p, c, delta, road}]
for (const [cid, c] of Object.entries(countries)) {
	const cache = c && c.proximity_persistent_cache;
	if (!cache || typeof cache !== 'object') continue;
	const out = [];
	for (const [k, v] of Object.entries(cache)) {
		if (!v || typeof v !== 'object') continue;
		const ch = +k, p = +v.proximity_parent;
		if (!p || p === ch || !isLand(ch) || !isLand(p) || !prox.has(ch) || !prox.has(p) || !isNb(p, ch) || straits.has(p + ',' + ch)) continue;
		if (owner.get(ch) !== +cid || owner.get(p) !== +cid) continue;
		const delta = prox.get(p) - prox.get(ch);
		if (delta <= 0.01) continue;
		out.push({ p, c: ch, delta, road: roads.get(p + ',' + ch) });
	}
	if (out.length) edgesOf.set(cid, out);
}

// a location's own speed: 0.005 x development plus its buildings' local speed (bridges, canals) x level x staffing x input
// fill, as the engine scales a building's modifier (an unstaffed bridge gives nothing)
const bldSpeed = new Map();
for (const b of Object.values((save.section('building_manager') || {}).database || {})) {
	const t = b && DATA.buildings[b.type], x = t && t.mod && t.mod.local_distance_from_capital_speed_propagation;
	if (!x) continue;
	const level = +b.level || 1, size = typeof t.emp === 'number' ? t.emp : 0;
	const staffing = size ? Math.min(1, (+b.employed || 0) / (size * level)) : 1;
	const pms = Object.keys(b).filter(k => b[k] && typeof b[k] === 'object' && DATA.methods[k]);
	const fill = pms.length ? pms.reduce((a, k) => a + (b[k].input !== undefined ? +b[k].input : 1), 0) / pms.length : 1;
	bldSpeed.set(+b.location, (bldSpeed.get(+b.location) || 0) + x * level * staffing * fill);
}
const S = (G, p) => G + 0.005 * (dev.get(p) || 0) + (bldSpeed.get(p) || 0);
// the steps' candidate costs: a river (12), the road between them, or plain land (40), each over the terrain speed
const candidates = e => {
	const sp = speeds(e.p, e.c), out = [['river', 12 / sp.np]];
	if (e.road) out.push(['road', roadBase(e.road) / sp.np]); else out.push(['plain', 40 / sp.plain]);
	return out;
};
const fit = (G, e) => candidates(e).map(([n, x]) => [n, x, Math.abs(Math.log(e.delta * (1 + S(G, e.p)) / x))]).sort((a, b) => a[2] - b[2]);
// the country's speed G: the value that prices most of its tree steps exactly as one of the candidates
const Gof = new Map();
for (const [cid, es] of edgesOf) {
	if (es.length < 5) continue;
	let best = null;
	for (let G = 0; G <= 1.5; G += 0.0025) {
		const score = es.reduce((a, e) => a + Math.min(0.04, fit(G, e)[0][2]), 0);
		if (!best || score < best[1]) best = [G, score];
	}
	const exact = es.filter(e => fit(best[0], e)[0][2] < 0.01).length;
	if (exact >= Math.max(3, 0.3 * es.length)) Gof.set(cid, best[0]);
}

// ---- labels: what each tree step was priced as
const verdict = new Map(); // "a,b" (a < b) -> { river: bool, why }
const pairKey = (a, b) => (a < b ? a + ',' + b : b + ',' + a);
const note = (a, b, river, why) => {
	const k = pairKey(a, b), old = verdict.get(k);
	if (old && old.river !== river) { old.conflict = true; return; }
	if (!old) verdict.set(k, { river, why });
};
let priced = 0, unclear = 0;
for (const [cid, es] of edgesOf) {
	const G = Gof.get(cid);
	if (G === undefined) continue;
	for (const e of es) {
		const best = fit(G, e);
		if (best[0][2] > 0.03 || best[1][2] < best[0][2] + 0.12) { unclear++; continue; }
		priced++;
		if (best[0][0] === 'river') note(e.p, e.c, true, `tree step ${key(e.p)} -> ${key(e.c)} priced as a river`);
		// a road or plain step proves there is no river link, if a river would have been cheaper (modern roads and railroads are not)
		else if (best[1][0] === 'river' && best[1][1] < best[0][1] - 0.01) note(e.p, e.c, false, `tree step ${key(e.p)} -> ${key(e.c)} priced as ${best[0][0]}`);
	}
}
// map river links the game cannot have: a river step would give the child more than the game did (6% and 0.3 of margin)
let refuted = 0;
for (const [cid, es] of edgesOf) {
	const G = Gof.get(cid);
	if (G === undefined) continue;
	const own = new Set();
	for (const e of es) { own.add(e.p); own.add(e.c); }
	for (const a of own) for (const [b, , r] of nbOf(a)) {
		if (!r || !own.has(b) || straits.has(a + ',' + b) || verdict.has(pairKey(a, b))) continue;
		const cost = 12 / speeds(a, b).np / (1 + S(G, a));
		if (prox.get(b) < prox.get(a) - cost * 1.06 - 0.3) { note(a, b, false, `${key(a)} ${prox.get(a).toFixed(1)} -> ${key(b)} ${prox.get(b).toFixed(1)}: a river step (${cost.toFixed(1)}) would give more`); refuted++; }
	}
}
const Gs = [...Gof.values()].sort((a, b) => a - b), Gdefault = Gs.length ? Gs[Gs.length >> 1] : 0;

// ---- compare with the map's guess and write the fixes
const fixes = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { notes: '', river: {} };
let tp = 0, fp = 0, fn = 0, tn = 0, conflicts = 0;
const changes = [];
for (const [k, v] of verdict) {
	if (v.conflict) { conflicts++; continue; }
	const [a, b] = k.split(',').map(Number), m = mapRiver(a, b);
	if (v.river && m) tp++; else if (v.river && !m) fn++; else if (!v.river && m) fp++; else tn++;
	if (v.river !== m) changes.push([a, b, v.river, v.why]);
	fixes.river[`${key(a)},${key(b)}`] = v.river ? 1 : 0;
}
fixes.notes = 'River links the game has (1) or does not have (0), from the proximity trees of the saves read by river_calibrate.js; build_map.js applies them over its rivers.png guess. Last: ' + path.basename(file);
fs.writeFileSync(OUT, JSON.stringify(fixes, null, '\t'));
console.log(`G: ${Gof.size} countries fitted, median ${Gdefault.toFixed(3)}; tree steps priced ${priced}, unclear ${unclear}; refuted map rivers ${refuted}; conflicting labels ${conflicts}`);
console.log(`map guess vs the game on ${tp + fp + fn + tn} labelled pairs: rivers right ${tp}, false ${fp}, missed ${fn}; no-river right ${tn}`);
const n = +flag('--report', 30);
for (const [a, b, r, why] of changes.slice(0, n)) console.log(`  ${r ? 'add   ' : 'remove'} ${key(a)}-${key(b)}: ${why}`);
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${Object.keys(fixes.river).length} pairs); rerun build_map.js`);
