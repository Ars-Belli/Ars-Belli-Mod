// node render.js <extract name> [owners.json] [--out file.png] [--scale 2] [--world]
// A political map as a PNG, coloured by owner: of the extract as it is, or of a planned owner list ({ location id: tag },
// as plan scripts write it). Europe and north Africa by default, --world for everything. Look at it before generating
// any script: stray locations and cut-off pieces show at once.
// Also a module: render(ownerOf, outFile, { scale, world, st }).
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { GAME, work } = require('./paths.js');
function readPng(file) {
	const b = fs.readFileSync(file);
	const w = b.readUInt32BE(16), h = b.readUInt32BE(20), bpp = b[25] === 2 ? 3 : b[25] === 6 ? 4 : 1;
	let p = 8; const idat = [];
	while (p < b.length) { const len = b.readUInt32BE(p), type = b.toString('latin1', p + 4, p + 8); if (type === 'IDAT') idat.push(b.subarray(p + 8, p + 8 + len)); p += 12 + len; }
	const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
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
function writePng(file, w, h, rgb) {
	const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
	const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
	const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
	const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
	const raw = Buffer.alloc((w * 3 + 1) * h);
	for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
	fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const colorOf = t => { let h = 0; for (const ch of t) h = (h * 131 + ch.charCodeAt(0)) >>> 0; return [60 + (h % 170), 60 + ((h >> 8) % 170), 60 + ((h >> 16) % 170)]; };
function render(ownerOf, outFile, { scale = 2, world = false, st } = {}) {
	const dir = GAME + '/in_game/map_data';
	const keys = [];
	for (const m of fs.readFileSync(path.join(dir, 'location_templates.txt'), 'utf8').matchAll(/^([A-Za-z0-9_]+)\s*=\s*\{/gm)) keys.push(m[1]);
	const idOf = new Map(keys.map((k, i) => [k, i + 1]));
	const colorToId = new Int32Array(1 << 24);
	for (const m of fs.readFileSync(path.join(dir, 'named_locations/00_default.txt'), 'utf8').matchAll(/^\s*([A-Za-z0-9_]+)\s*=\s*([0-9a-fA-F]{1,6})\b/gm)) { const id = idOf.get(m[1]); if (id) colorToId[parseInt(m[2], 16)] = id; }
	const img = readPng(path.join(dir, 'locations.png'));
	let x0 = 0, y0 = 0, x1 = img.w - 1, y1 = img.h - 1;
	if (!world && st) {
		x0 = 1e9; y0 = 1e9; x1 = 0; y1 = 0;
		for (const l of Object.values(st.L)) {
			if (!(l.g.continent === 'europe' || l.g.region === 'maghreb_region') || ['ural_region', 'steppes_region', 'russian_region', 'north_atlantic_islands_region'].includes(l.g.region)) continue;
			const m = st.map.locations[l.id]; if (!m) continue;
			x0 = Math.min(x0, m.x); x1 = Math.max(x1, m.x); y0 = Math.min(y0, m.y); y1 = Math.max(y1, m.y);
		}
		x0 = Math.max(0, x0 - 80); y0 = Math.max(0, y0 - 80); x1 = Math.min(img.w - 1, x1 + 80); y1 = Math.min(img.h - 1, y1 + 80);
	}
	const W = Math.floor((x1 - x0) / scale), H = Math.floor((y1 - y0) / scale), rgb = Buffer.alloc(W * H * 3);
	const at = (sx, sy) => { const j = (sy * img.w + sx) * img.bpp; return colorToId[(img.px[j] << 16) | (img.px[j + 1] << 8) | img.px[j + 2]]; };
	for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
		const sx = x0 + x * scale, sy = y0 + y * scale, id = at(sx, sy), t = id ? ownerOf(id) : null;
		let c = !id ? [40, 60, 90] : t ? colorOf(t) : [70, 70, 70];
		if (id && x + 1 < W && y + 1 < H) { const i2 = at(sx + scale, sy), i3 = at(sx, sy + scale); if ((i2 && ownerOf(i2) !== t) || (i3 && ownerOf(i3) !== t)) c = [20, 20, 20]; }
		rgb[(y * W + x) * 3] = c[0]; rgb[(y * W + x) * 3 + 1] = c[1]; rgb[(y * W + x) * 3 + 2] = c[2];
	}
	writePng(outFile, W, H, rgb);
	return { W, H };
}
module.exports = { render };
if (require.main === module) {
	const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
	const pos = args.filter((a, i) => !a.startsWith('--') && !['--out', '--scale'].includes(args[i - 1]));
	if (!pos[0]) { console.error('usage: node render.js <extract name> [owners.json] [--out file.png] [--scale 2] [--world]'); process.exit(1); }
	const st = require('./state.js').load(pos[0]);
	const planned = pos[1] ? JSON.parse(fs.readFileSync(fs.existsSync(pos[1]) ? pos[1] : work(pos[1]), 'utf8')) : null;
	const out = opt('--out') || work((pos[1] ? path.basename(pos[1], '.json') : pos[0]) + '.png');
	const r = render(planned ? id => planned[id] : id => st.L[id] && st.L[id].tag, out, { scale: +opt('--scale') || 2, world: args.includes('--world'), st });
	console.log(`${out} (${r.W} x ${r.H})`);
}
