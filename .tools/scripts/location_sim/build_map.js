// Builds map.json for the location simulator from the game's map images: for every location its size in pixels,
// centre, river size, and its neighbours (shared border length and whether a river links the two), plus the sea straits
// (adjacencies.csv) and each land location's port sea zone (ports.csv).
//   node .tools/scripts/location_sim/build_map.js [gameDir]      (about a minute; rerun after a game update)
// Location id = line order in location_templates.txt (from 1); colours come from map_data/named_locations.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
if (process.argv[2]) process.env.EU5_GAME = process.argv[2];
const { GAME } = require('../battle_sim/paradox.js');
const MAP = path.join(GAME, 'in_game/map_data');
const OUT = path.join(__dirname, 'map.json');

// whole image, unfiltered: Buffer of w*h*bpp
function png(file) {
	const b = fs.readFileSync(file);
	const w = b.readUInt32BE(16), h = b.readUInt32BE(20), bpp = b[25] === 2 ? 3 : 1;
	let p = 8; const idat = [];
	while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8); if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
	const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp;
	const out = Buffer.alloc(w * h * bpp);
	for (let y = 0; y < h; y++) {
		const off = y * (stride + 1), f = raw[off], o = y * stride, po = o - stride;
		for (let x = 0; x < stride; x++) {
			const r = raw[off + 1 + x], a = x >= bpp ? out[o + x - bpp] : 0, up = y ? out[po + x] : 0, c = x >= bpp && y ? out[po + x - bpp] : 0;
			let v;
			if (f === 0) v = r; else if (f === 1) v = r + a; else if (f === 2) v = r + up; else if (f === 3) v = r + ((a + up) >> 1);
			else { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? up : c); }
			out[o + x] = v & 255;
		}
	}
	return { w, h, bpp, px: out };
}

const t0 = Date.now();
const keys = [];
for (const m of fs.readFileSync(path.join(MAP, 'location_templates.txt'), 'utf8').matchAll(/^([A-Za-z0-9_]+)\s*=\s*\{/gm)) keys.push(m[1]);
const idOf = new Map(keys.map((k, i) => [k, i + 1]));
const colorToId = new Int32Array(1 << 24).fill(0);
for (const m of fs.readFileSync(path.join(MAP, 'named_locations/00_default.txt'), 'utf8').matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*([0-9a-fA-F]{6})/gm)) {
	const id = idOf.get(m[1]);
	if (id) colorToId[parseInt(m[2], 16)] = id;
}
const loc = png(path.join(MAP, 'locations.png'));
const { w, h } = loc;
const ids = new Uint16Array(w * h);
for (let i = 0, j = 0; i < w * h; i++, j += 3) ids[i] = colorToId[(loc.px[j] << 16) | (loc.px[j + 1] << 8) | loc.px[j + 2]];
loc.px = null;
console.log('locations decoded', ((Date.now() - t0) / 1000).toFixed(1) + 's');

const n = keys.length + 1;
const size = new Float64Array(n), sx = new Float64Array(n), sy = new Float64Array(n);
const border = new Map(); // a * 65536 + b (a < b) -> shared border pixels
const pair = (a, b) => { if (!a || !b || a === b) return; const k = a < b ? a * 65536 + b : b * 65536 + a; border.set(k, (border.get(k) || 0) + 1); };
for (let y = 0; y < h; y++) {
	const o = y * w;
	for (let x = 0; x < w; x++) {
		const a = ids[o + x];
		if (!a) continue;
		size[a]++; sx[a] += x; sy[a] += y;
		pair(a, ids[o + (x + 1) % w]); // the map wraps east-west
		if (y + 1 < h) pair(a, ids[o + w + x]);
	}
}
console.log('borders', border.size, ((Date.now() - t0) / 1000).toFixed(1) + 's');

// rivers.png: palette index per pixel; 254 = land, 255 = water, lower = river. The game (eu5.exe 0x1431c3f90) gives a location
// the widest river among its pixels v in 3..253: river size = min(4, floor((v - 3) / 3)) + 1, read by river_flowing_through_<size>.
// 0-2 are source and junction markers, not counted.
const riv = png(path.join(MAP, 'rivers.png'));
const riverPx = new Map(); // id -> { index: pixels }
const hist = {};
for (let i = 0; i < w * h; i++) {
	const v = riv.px[i];
	if (v >= 254) continue;
	hist[v] = (hist[v] || 0) + 1;
	const id = ids[i];
	if (!id) continue;
	const r = riverPx.get(id) || {};
	r[v] = (r[v] || 0) + 1;
	riverPx.set(id, r);
}
console.log('rivers', riverPx.size, 'locations; palette use', JSON.stringify(hist), ((Date.now() - t0) / 1000).toFixed(1) + 's');

// River links between neighbours (proximity: a river crossing costs 12 instead of 40, proximity_development.md 1.4). The game
// builds them when it loads the map; the closest rule found from the image: each location has river pixels within 4 px of
// the other (on 423 checked links: 124 right, 5 false, 4 missed).
const near = new Map(); // a * 65536 + b -> min (Chebyshev) distance from a river pixel of a to a pixel of b
const offs = [];
for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx || dy) offs.push([dx, dy, Math.max(Math.abs(dx), Math.abs(dy))]); // Chebyshev distance
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
	const i = y * w + x;
	if (riv.px[i] >= 254) continue;
	const a = ids[i];
	if (!a) continue;
	for (const [dx, dy, d2] of offs) {
		const yy = y + dy;
		if (yy < 0 || yy >= h) continue;
		const b = ids[yy * w + (x + dx + w) % w];
		if (!b || b === a) continue;
		const k = a * 65536 + b, old = near.get(k);
		if (old === undefined || d2 < old) near.set(k, d2);
	}
}
const riverLink = (a, b) => near.has(a * 65536 + b) && near.has(b * 65536 + a);
console.log('river links searched', ((Date.now() - t0) / 1000).toFixed(1) + 's');
const riverSize = h => { let best = 0; for (const v of Object.keys(h || {}).map(Number)) if (v >= 3 && v <= 253) best = Math.max(best, Math.min(4, Math.floor((v - 3) / 3)) + 1); return best; };
const neighbours = Array.from({ length: n }, () => []);
for (const [k, c] of border) { const a = Math.floor(k / 65536), b = k % 65536, r = riverLink(a, b) ? 1 : 0; neighbours[a].push(r ? [b, c, 1] : [b, c]); neighbours[b].push(r ? [a, c, 1] : [a, c]); }
// straits (land-land crossings through a sea zone) and ports (a land location's port sea zone)
const straits = [], ports = {};
for (const line of fs.readFileSync(path.join(MAP, 'adjacencies.csv'), 'utf8').split('\n').slice(1)) {
	const f = line.split(';');
	if (f.length < 4 || f[2] !== 'sea') continue;
	const a = idOf.get(f[0]), b = idOf.get(f[1]), z = idOf.get(f[3]);
	if (a && b && z) straits.push([a, b, z]);
}
for (const line of fs.readFileSync(path.join(MAP, 'ports.csv'), 'utf8').split('\n').slice(1)) {
	const f = line.split(';');
	const a = idOf.get(f[0]), z = idOf.get(f[1]);
	if (a && z) ports[a] = z;
}
const out = { built: new Date().toISOString().slice(0, 10), width: w, height: h, riverPalette: hist, straits, ports, locations: {} };
for (let id = 1; id < n; id++) {
	if (!size[id]) continue;
	out.locations[id] = {
		px: size[id], x: Math.round(sx[id] / size[id]), y: Math.round(sy[id] / size[id]),
		nb: neighbours[id].sort((p, q) => p[0] - q[0]),
		...(riverSize(riverPx.get(id)) ? { river: riverSize(riverPx.get(id)) } : {}),
	};
}
fs.writeFileSync(OUT, JSON.stringify(out));
console.log('wrote', OUT, (fs.statSync(OUT).size / 1048576).toFixed(1) + ' MB', Object.keys(out.locations).length, 'locations', ((Date.now() - t0) / 1000).toFixed(1) + 's');
