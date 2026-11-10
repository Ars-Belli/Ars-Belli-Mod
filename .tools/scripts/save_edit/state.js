// const st = require('./state.js').load('<name>')  : an extract (extract.js) joined with the game's map.
//   st.D           the raw extract
//   st.L[id]       { id, name, owner, tag (owner's tag; also ownerTag), ctl, cores, rank, development, tax, possible_tax,
//                    g: { continent, sub, region, area, province } }
//   st.byName      location name -> the same record
//   st.C[tag]      the country record plus { id, tag }
//   st.idOf(tag)   country id
//   st.deps        [{ o: overlord tag, s: subject tag, type }]
//   st.owners()    { location id: owner tag }   (a copy to change while planning)
//   st.nb(id, owners)        land neighbours of a location that have an owner: [[id, shared border length], ...]
//   st.components(owners, tag)   the connected pieces of a country: arrays of location ids
//   st.borders(ids, owners)  for a set of locations: [[neighbour tag, border length], ...], longest first
const fs = require('fs');
const { GAME, MAP, work } = require('./paths.js');
const { parse } = require('../battle_sim/paradox.js');
function load(name) {
	const D = JSON.parse(fs.readFileSync(work(name + '.json'), 'utf8'));
	const defs = parse(fs.readFileSync(GAME + '/in_game/map_data/definitions.txt', 'utf8'));
	const geo = {};
	for (const [continent, a] of defs) if (Array.isArray(a)) for (const [sub, b] of a) if (Array.isArray(b)) for (const [region, c] of b) if (Array.isArray(c)) for (const [area, d] of c) if (Array.isArray(d)) for (const [province, e] of d) if (Array.isArray(e)) for (const [loc] of e) geo[loc] = { continent, sub, region, area, province };
	const L = {}, byName = {};
	for (const [id, l] of Object.entries(D.locations)) { const n = D.locNames[id - 1]; byName[n] = L[id] = { id, name: n, ...l, tag: D.tags[l.owner], ownerTag: D.tags[l.owner], ctl: D.tags[l.controller], controllerTag: D.tags[l.controller], g: geo[n] || {} }; }
	const C = {}, ids = {};
	for (const [id, c] of Object.entries(D.countries)) { C[D.tags[id]] = { ...c, id, tag: D.tags[id] }; ids[D.tags[id]] = id; }
	const deps = D.dependencies.map(d => ({ o: D.tags[d.first], s: D.tags[d.second], type: d.type }));
	const map = JSON.parse(fs.readFileSync(MAP, 'utf8'));
	const owners = () => { const o = {}; for (const l of Object.values(L)) if (l.tag) o[l.id] = l.tag; return o; };
	const nb = (id, own) => (map.locations[id] ? map.locations[id].nb : []).filter(([j]) => own[j] !== undefined);
	const components = (own, tag) => {
		const mine = Object.keys(own).filter(id => own[id] === tag), seen = new Set(), out = [];
		for (const s of mine) { if (seen.has(s)) continue; const comp = [], q = [s]; seen.add(s); while (q.length) { const x = q.pop(); comp.push(x); for (const [j] of nb(x, own)) { const k = String(j); if (own[k] === tag && !seen.has(k)) { seen.add(k); q.push(k); } } } out.push(comp); }
		return out.sort((a, b) => b.length - a.length);
	};
	const borders = (list, own) => { const set = new Set(list.map(String)), b = {}; for (const id of list) for (const [j, len] of nb(id, own)) if (!set.has(String(j))) b[own[j]] = (b[own[j]] || 0) + len; return Object.entries(b).sort((x, y) => y[1] - x[1]); };
	return { D, L, byName, C, geo, deps, map, idOf: t => ids[t], owners, nb, components, borders };
}
module.exports = { load };
