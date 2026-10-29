// Shared readers for the battle simulator tools: Paradox script files (game + Ars Belli) and EU5 TEXT saves.
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const GAME = process.env.EU5_GAME || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const MOD = path.resolve(__dirname, '../../..');

function tokenize(s) {
	const out = [];
	let i = 0;
	const n = s.length;
	while (i < n) {
		const c = s[i];
		if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\uFEFF') { i++; continue; }
		if (c === '#') { while (i < n && s[i] !== '\n') i++; continue; }
		if (c === '{' || c === '}' || c === '=' || c === '<' || c === '>') { out.push(c); i++; continue; }
		if (c === '"') {
			let j = i + 1, buf = '';
			while (j < n && s[j] !== '"') { if (s[j] === '\\' && j + 1 < n) { buf += s[j + 1]; j += 2; } else buf += s[j++]; }
			out.push({ q: buf }); i = j + 1; continue;
		}
		let j = i;
		while (j < n && !' \t\n\r{}="<>'.includes(s[j])) j++;
		out.push(s.slice(i, j)); i = j;
	}
	return out;
}

// Script as [[key, value]] pairs (value: string or nested pairs); comparison operators are kept as the key's value.
function parse(text) {
	const t = tokenize(text);
	let i = 0;
	const val = x => (x && typeof x === 'object') ? x.q : x;
	const block = () => {
		const out = [];
		while (i < t.length && t[i] !== '}') {
			if (t[i] === '{') { i++; out.push(['', block()]); i++; continue; }
			const k = val(t[i++]);
			if (t[i] === '=' || t[i] === '<' || t[i] === '>') {
				i++;
				if (t[i] === '=') i++;
				if (t[i] === '{') { i++; out.push([k, block()]); i++; } else out.push([k, val(t[i++])]);
			} else out.push([k, true]);
		}
		return out;
	};
	return block();
}

// A database folder from vanilla then the mod; a mod file with the same name replaces the vanilla file.
// REPLACE:/INJECT: entries apply after every plain definition, whatever the file order: a mod file such as
// abm_country.txt sorts before vanilla's country.txt and must still override it.
function loadDb(rel) {
	const files = new Map();
	for (const root of [GAME, MOD]) {
		const dir = path.join(root, rel);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) files.set(f.toLowerCase(), path.join(dir, f));
	}
	const db = {}, overrides = [];
	for (const [, file] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		for (const [k, v] of parse(fs.readFileSync(file, 'utf8'))) {
			if (!Array.isArray(v)) continue;
			const m = k.match(/^(REPLACE|INJECT|TRY_REPLACE|TRY_INJECT|REPLACE_OR_CREATE|INJECT_OR_CREATE):(.+)$/);
			if (m) overrides.push([m[1], m[2], v]); else db[k] = v;
		}
	}
	for (const [op, k, v] of overrides) {
		if (op.startsWith('TRY_') && !db[k]) continue;
		db[k] = op.includes('INJECT') && db[k] ? db[k].concat(v) : v;
	}
	return db;
}
const get = (pairs, key) => (pairs.find(([k]) => k === key) || [])[1];

// Save objects: { key: value }, repeated keys collected into arrays marked __multi; bare lists become arrays.
function parseSaveTokens(t) {
	let i = 0;
	const val = x => (x && typeof x === 'object') ? x.q : x;
	const block = () => {
		const obj = {}; const list = []; let hasKeys = false;
		while (i < t.length && t[i] !== '}') {
			if (t[i] === '{') { i++; list.push(block()); i++; continue; }
			const k = val(t[i++]);
			if (t[i] === '=') {
				i++; hasKeys = true;
				let v;
				if (t[i] === '{') { i++; v = block(); i++; } else v = val(t[i++]);
				if (k in obj) { if (!(Array.isArray(obj[k]) && obj[k].__multi)) obj[k] = Object.assign([obj[k]], { __multi: true }); obj[k].push(v); } else obj[k] = v;
			} else list.push(k);
		}
		if (hasKeys) { if (list.length) obj.__list = list; return obj; }
		return list;
	};
	return block();
}

// EU5 TEXT save (debug saves start with SAV0300). Sections are parsed on demand.
class TextSave {
	constructor(file) {
		this.file = file;
		const head = Buffer.alloc(8); const fd = fs.openSync(file, 'r'); fs.readSync(fd, head, 0, 8, 0); fs.closeSync(fd);
		if (!head.toString('latin1').startsWith('SAV0300')) throw new Error(`${path.basename(file)} is not a text save; use openSave()`);
		this.text = fs.readFileSync(file, 'latin1');
		this.sections = {};
		const re = /\n([a-z_]+)=\{/g; let m;
		while ((m = re.exec(this.text))) if (!(m[1] in this.sections)) this.sections[m[1]] = m.index + 1;
		this.cache = {};
	}
	sectionText(name) {
		const start = this.sections[name];
		if (start == null) throw new Error('no section ' + name);
		const next = Object.values(this.sections).filter(p => p > start).sort((a, b) => a - b)[0];
		return this.text.slice(start, next || this.text.length);
	}
	section(name) { return this.cache[name] ??= parseSaveTokens(tokenize(this.sectionText(name)))[name]; }
	// one "id={...}" entry inside a section, found by its indentation, without parsing the whole section
	entry(name, id, indent = '') {
		const txt = this.sectionText(name);
		const m = new RegExp('\\n' + indent + id + '=\\{').exec(txt);
		if (!m) return null;
		let depth = 0, j = m.index + m[0].length - 1;
		const s = j;
		for (; j < txt.length; j++) { if (txt[j] === '{') depth++; else if (txt[j] === '}') { depth--; if (!depth) break; } }
		return parseSaveTokens(tokenize(txt.slice(s + 1, j)));
	}
}
// date "1342.6.21" from a text save, or the binary int (hours since 1 Jan -5000, 365-day years)
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
function binaryDate(v) {
	const days = Math.floor(v / 24);
	let doy = days % 365, m = 0;
	while (doy >= MONTH_DAYS[m]) doy -= MONTH_DAYS[m++];
	return `${Math.floor(days / 365) - 5000}.${m + 1}.${doy + 1}`;
}
TextSave.prototype.date = function () { return (/\n\s*date=([\d.]+)/.exec(this.text.slice(0, 4000)) || [])[1]; };

// EU5 BINARY save (normal saves; header SAV0303): a zip with `gamestate` (u16 tokens) and `string_lookup` (names).
// Most keys are string_lookup names; engine-fixed tokens show as '#hex'. Sections parse into the same objects as TextSave.
// Token format: .tools/scripts/eu5_save/README.md on branch feature/trade-office-limit-1.4.
function unzip(buf) {
	const out = {};
	const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
	let i = buf.indexOf(sig);
	while (i >= 0 && buf.readUInt32LE(i) === 0x04034b50) {
		const method = buf.readUInt16LE(i + 8);
		let csize = buf.readUInt32LE(i + 18);
		const nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
		const name = buf.subarray(i + 30, i + 30 + nlen).toString();
		const start = i + 30 + nlen + xlen;
		if (method === 8) {
			const r = zlib.inflateRawSync(buf.subarray(start, csize ? start + csize : undefined), { info: true });
			out[name] = r.buffer;
			if (!csize) csize = r.engine.bytesWritten;
		} else out[name] = buf.subarray(start, start + csize);
		i = buf.indexOf(sig, start + csize);
	}
	return out;
}
class BinarySave {
	constructor(file) {
		this.file = file;
		const z = unzip(fs.readFileSync(file));
		if (!z.gamestate || !z.string_lookup) throw new Error('no gamestate in ' + path.basename(file));
		this.gs = z.gamestate;
		const sl = z.string_lookup;
		this.strs = [];
		for (let p = 5; p + 2 <= sl.length;) { const n = sl.readUInt16LE(p); p += 2; this.strs.push(sl.toString('latin1', p, p + n)); p += n; }
		// top-level sections: name -> [start, end) byte range of the block's content
		this.sections = {};
		this.cache = {};
		let depth = 0, prev1 = null, prev2 = null;
		this.scan(0, this.gs.length, (tok, p0, p1) => {
			if (tok === '{') { if (depth === 0 && prev1 === '=' && prev2 != null && typeof prev2 !== 'object') this.open = [String(prev2), p1]; depth++; }
			// the binary has an unmatched '}' after country_name_keys (timeline_manager's wrapper): never go below 0
			else if (tok === '}') { depth = Math.max(0, depth - 1); if (depth === 0 && this.open) { if (!(this.open[0] in this.sections)) this.sections[this.open[0]] = [this.open[1], p0]; this.open = null; } }
			prev2 = prev1; prev1 = tok;
		});
	}
	// calls cb(token, start, end) with text-save style tokens: '=', '{', '}', strings, numbers as strings, {q} for quoted
	scan(from, to, cb) {
		const gs = this.gs, strs = this.strs;
		const uint = (p, n) => { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + gs[p + i]; return v; };
		let p = from;
		while (p + 2 <= to) {
			const p0 = p, id = gs.readUInt16LE(p); p += 2;
			let t;
			switch (id) {
				case 0x0001: t = '='; break;
				case 0x0003: t = '{'; break;
				case 0x0004: t = '}'; break;
				case 0x000c: t = String(gs.readInt32LE(p)); p += 4; break;
				case 0x0014: t = String(gs.readUInt32LE(p)); p += 4; break;
				case 0x000e: t = gs[p] ? 'yes' : 'no'; p += 1; break;
				case 0x000f: case 0x0017: { const n = gs.readUInt16LE(p); p += 2; t = { q: gs.toString('latin1', p, p + n) }; p += n; break; }
				case 0x000d: t = String(+gs.readFloatLE(p).toFixed(5)); p += 4; break;
				case 0x0167: t = String(gs.readDoubleLE(p)); p += 8; break;
				case 0x029c: t = String(gs.readBigUInt64LE(p)); p += 8; break;
				case 0x0317: t = String(gs.readBigInt64LE(p)); p += 8; break;
				case 0x0d40: case 0x0d5a: t = strs[gs[p]]; p += 1; break;
				case 0x0d3e: case 0x0d5b: t = strs[gs.readUInt16LE(p)]; p += 2; break;
				case 0x0d41: case 0x0d5c: t = strs[uint(p, 3)]; p += 3; break;
				case 0x0d42: t = ''; break;
				case 0x0d47: t = '0'; break;
				default:
					if (id >= 0x0d48 && id <= 0x0d4e) { const n = id - 0x0d47; t = String(uint(p, n) / 100000); p += n; }
					else if (id >= 0x0d4f && id <= 0x0d55) { const n = id - 0x0d4e; t = String(-uint(p, n) / 100000); p += n; }
					else t = '#' + id.toString(16);
			}
			cb(t, p0, p);
		}
	}
	section(name) {
		if (this.cache[name]) return this.cache[name];
		const r = this.sections[name];
		if (!r) throw new Error('no section ' + name);
		const toks = [];
		this.scan(r[0], r[1], t => { toks.push(t); });
		return (this.cache[name] = parseSaveTokens(toks));
	}
	entry(name, id) {
		const s = this.section(name);
		return (s.database && s.database[id]) || (s.locations && s.locations[id]) || s[id] || null;
	}
	date() {
		let d = null;
		const r = this.sections['#9de'] || [0, Math.min(this.gs.length, 4000)];
		let prev1 = null, prev2 = null;
		// metadata (#9de) starts with its date under the unnamed token #6b5
		this.scan(r[0], Math.min(r[1], r[0] + 4000), t => { if (!d && (prev2 === 'date' || prev2 === '#6b5') && prev1 === '=' && /^\d+$/.test(t)) d = binaryDate(+t); prev2 = prev1; prev1 = t; });
		return d;
	}
}
const headerOf = f => { const b = Buffer.alloc(8); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 8, 0); fs.closeSync(fd); return b.toString('latin1'); };
const openSave = file => headerOf(file).startsWith('SAV0300') ? new TextSave(file) : new BinarySave(file);
const latestSave = () => {
	const dir = path.join(process.env.USERPROFILE || '', 'Documents/Paradox Interactive/Europa Universalis V/save games');
	return fs.readdirSync(dir).filter(f => f.endsWith('.eu5')).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
};

module.exports = { GAME, MOD, tokenize, parse, parseSaveTokens, loadDb, get, TextSave, BinarySave, openSave, latestSave, binaryDate };
