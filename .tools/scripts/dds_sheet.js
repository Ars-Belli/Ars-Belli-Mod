// Preview vanilla DDS art: decodes DXT1/DXT5 files (not BC7) and writes a contact sheet PNG of
// centre-cropped thumbnails; the numbered order is printed. Used to pick the focus panel card art.
// node .tools/scripts/dds_sheet.js out.png thumbW thumbH cols file1.dds file2.dds ...
const fs = require('fs');
const zlib = require('zlib');

function decodeDDS(file) {
	const b = fs.readFileSync(file);
	const h = b.readUInt32LE(12), w = b.readUInt32LE(16);
	const fourcc = b.toString('ascii', 84, 88);
	let off = 128;
	let fmt = fourcc;
	if (fourcc === 'DX10') { const dxgi = b.readUInt32LE(128); off += 20; fmt = dxgi === 71 || dxgi === 72 ? 'DXT1' : dxgi === 77 || dxgi === 78 ? 'DXT5' : 'BC' + dxgi; }
	if (fmt !== 'DXT1' && fmt !== 'DXT5') return null;
	const px = new Uint8Array(w * h * 4);
	const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4);
	const blockSize = fmt === 'DXT1' ? 8 : 16;
	const c565 = v => [((v >> 11) & 31) * 255 / 31, ((v >> 5) & 63) * 255 / 63, (v & 31) * 255 / 31];
	for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
		let p = off + (by * bw + bx) * blockSize;
		if (fmt === 'DXT5') p += 8; // skip alpha
		const c0 = b.readUInt16LE(p), c1 = b.readUInt16LE(p + 2);
		const a = c565(c0), bb = c565(c1);
		const cols = [a, bb];
		if (c0 > c1 || fmt === 'DXT5') { cols.push(a.map((v, i) => (2 * v + bb[i]) / 3), a.map((v, i) => (v + 2 * bb[i]) / 3)); }
		else { cols.push(a.map((v, i) => (v + bb[i]) / 2), [0, 0, 0]); }
		const idx = b.readUInt32LE(p + 4);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
			const X = bx * 4 + x, Y = by * 4 + y;
			if (X >= w || Y >= h) continue;
			const c = cols[(idx >> (2 * (y * 4 + x))) & 3];
			const q = (Y * w + X) * 4;
			px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2]; px[q + 3] = 255;
		}
	}
	return { w, h, px };
}

// Center-crop to the thumb aspect, then nearest-neighbour scale.
function thumb(img, tw, th) {
	const out = new Uint8Array(tw * th * 4);
	const ar = tw / th;
	let cw = img.w, ch = img.h;
	if (img.w / img.h > ar) cw = Math.round(img.h * ar); else ch = Math.round(img.w / ar);
	const ox = Math.floor((img.w - cw) / 2), oy = Math.floor((img.h - ch) / 2);
	for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
		const sx = ox + Math.floor(x * cw / tw), sy = oy + Math.floor(y * ch / th);
		const s = (sy * img.w + sx) * 4, d = (y * tw + x) * 4;
		out.set(img.px.subarray(s, s + 4), d);
	}
	return out;
}

function png(w, h, rgba) {
	const crcTable = [...Array(256)].map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
	const crc = buf => { let c = 0xffffffff; for (const x of buf) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
	const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
	const raw = Buffer.alloc((w * 4 + 1) * h);
	for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
	const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const [out, tw, th, cols, ...files] = process.argv.slice(2);
const TW = +tw, TH = +th, C = +cols, GAP = 6;
const rows = Math.ceil(files.length / C);
const W = C * TW + (C + 1) * GAP, H = rows * TH + (rows + 1) * GAP;
const sheet = new Uint8Array(W * H * 4).fill(40);
files.forEach((f, i) => {
	const img = decodeDDS(f);
	const label = `${i + 1}. ${f.split(/[\\/]illustrations[\\/]/).pop()}`;
	if (!img) { console.log(label, '(unsupported format, skipped)'); return; }
	console.log(label);
	const t = thumb(img, TW, TH);
	const X = GAP + (i % C) * (TW + GAP), Y = GAP + Math.floor(i / C) * (TH + GAP);
	for (let y = 0; y < TH; y++) sheet.set(t.subarray(y * TW * 4, (y + 1) * TW * 4), ((Y + y) * W + X) * 4);
});
fs.writeFileSync(out, png(W, H, sheet));
