#!/usr/bin/env node
// EU5 binary save reader (game 1.4.x). Usage and format notes: README.md next to this file.
// node eu5save.js <command> <save> ...   where <save> is a .eu5 file, an extracted folder, or "latest".
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');

const GAME = process.env.EU5_GAME || 'E:/Steam/steamapps/common/Europa Universalis V/game';
const SAVES = path.join(os.homedir(), 'Documents/Paradox Interactive/Europa Universalis V/save games');

// ---------- loading ----------

// A .eu5 save is a binary header followed by a zip holding `gamestate` and `string_lookup`.
// .NET's ZipFile silently extracts nothing from it, so walk the local file headers by hand.
function extract(save, outdir) {
	const buf = fs.readFileSync(save);
	fs.mkdirSync(outdir, { recursive: true });
	const sig = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
	let i = buf.indexOf(sig);
	while (i >= 0 && buf.readUInt32LE(i) === 0x04034b50) {
		const method = buf.readUInt16LE(i + 8);
		let csize = buf.readUInt32LE(i + 18);
		const nlen = buf.readUInt16LE(i + 26), xlen = buf.readUInt16LE(i + 28);
		const name = buf.slice(i + 30, i + 30 + nlen).toString();
		const start = i + 30 + nlen + xlen;
		let data;
		if (method === 8) {
			const r = zlib.inflateRawSync(buf.slice(start, csize ? start + csize : undefined), { info: true });
			data = r.buffer;
			if (!csize) csize = r.engine.bytesWritten;
		} else data = buf.slice(start, start + csize);
		fs.writeFileSync(path.join(outdir, name.replace(/[\\/]/g, '_')), data);
		i = buf.indexOf(sig, start + csize);
	}
	if (!fs.existsSync(path.join(outdir, 'gamestate'))) throw new Error('no gamestate entry found in ' + save);
	return outdir;
}

// <save> -> folder with gamestate + string_lookup. A .eu5 is extracted once into .cache/ next to
// this script (gitignored; EU5SAVE_CACHE overrides it), keyed by name + mtime; "latest" is the
// newest .eu5 in the save games folder.
function resolveSave(arg) {
	if (!arg) throw new Error('missing <save>');
	if (arg === 'latest') {
		const files = fs.readdirSync(SAVES).filter(f => f.endsWith('.eu5'))
			.map(f => ({ f, t: fs.statSync(path.join(SAVES, f)).mtimeMs })).sort((a, b) => b.t - a.t);
		if (!files.length) throw new Error('no .eu5 in ' + SAVES);
		arg = path.join(SAVES, files[0].f);
		console.error('latest save:', arg);
	}
	if (fs.statSync(arg).isDirectory()) return arg;
	const st = fs.statSync(arg);
	const dir = path.join(process.env.EU5SAVE_CACHE || path.join(__dirname, '.cache'), path.basename(arg, '.eu5') + '-' + Math.floor(st.mtimeMs));
	if (!fs.existsSync(path.join(dir, 'string_lookup'))) { console.error('extracting to', dir); extract(arg, dir); }
	return dir;
}

function load(saveArg) {
	const dir = resolveSave(saveArg);
	const sl = fs.readFileSync(path.join(dir, 'string_lookup'));
	const strs = [];
	let p = 5; // 5-byte header, then u16-length strings; the index is the order
	while (p + 2 <= sl.length) { const n = sl.readUInt16LE(p); p += 2; strs.push(sl.slice(p, p + n).toString('latin1')); p += n; }
	return { strs, gs: fs.readFileSync(path.join(dir, 'gamestate')) };
}

// ---------- tokenizer ----------

function readUInt(buf, p, n) { let v = 0; for (let i = n - 1; i >= 0; i--) v = v * 256 + buf[p + i]; return v; }

// Calls cb({t, v}) per token; return false from cb to stop. Token types:
// eq open close | id (key token, no payload; v = hex id) | look (string_lookup ref) | str | int | fix | f32 | f64 | bool
function tokenize({ strs, gs }, cb) {
	let p = 0;
	while (p + 2 <= gs.length) {
		const id = gs.readUInt16LE(p); p += 2;
		let tok;
		switch (id) {
			case 0x0001: tok = { t: 'eq' }; break;
			case 0x0003: tok = { t: 'open' }; break;
			case 0x0004: tok = { t: 'close' }; break;
			case 0x000c: tok = { t: 'int', v: gs.readInt32LE(p) }; p += 4; break;
			case 0x0014: tok = { t: 'int', v: gs.readUInt32LE(p) }; p += 4; break;
			case 0x000e: tok = { t: 'bool', v: gs[p] }; p += 1; break;
			case 0x000f: case 0x0017: { const n = gs.readUInt16LE(p); p += 2; tok = { t: 'str', v: gs.slice(p, p + n).toString('latin1') }; p += n; break; }
			case 0x000d: tok = { t: 'f32', v: gs.readFloatLE(p) }; p += 4; break;
			case 0x0167: tok = { t: 'f64', v: gs.readDoubleLE(p) }; p += 8; break;
			case 0x029c: tok = { t: 'int', v: Number(gs.readBigUInt64LE(p)) }; p += 8; break;
			case 0x0317: tok = { t: 'int', v: Number(gs.readBigInt64LE(p)) }; p += 8; break;
			// string_lookup references: 0d40/0d3e/0d41 mostly values, 0d5a/0d5b/0d5c mostly keys
			case 0x0d40: case 0x0d5a: tok = { t: 'look', v: strs[gs[p]] }; p += 1; break;
			case 0x0d3e: case 0x0d5b: tok = { t: 'look', v: strs[gs.readUInt16LE(p)] }; p += 2; break;
			case 0x0d41: case 0x0d5c: tok = { t: 'look', v: strs[readUInt(gs, p, 3)] }; p += 3; break;
			case 0x0d42: tok = { t: 'look', v: '' }; break;
			case 0x0d47: tok = { t: 'fix', v: 0 }; break;
			default:
				// fixed point / 100000: 0d48..0d4e positive with 1..7 bytes, 0d4f..0d55 negative
				if (id >= 0x0d48 && id <= 0x0d4e) { const n = id - 0x0d47; tok = { t: 'fix', v: readUInt(gs, p, n) / 100000 }; p += n; }
				else if (id >= 0x0d4f && id <= 0x0d55) { const n = id - 0x0d4e; tok = { t: 'fix', v: -readUInt(gs, p, n) / 100000 }; p += n; }
				else tok = { t: 'id', v: id.toString(16) };
		}
		if (cb(tok) === false) return;
	}
}

function show(tok) {
	switch (tok.t) {
		case 'eq': return '=';
		case 'open': return '{';
		case 'close': return '}';
		case 'id': return '#' + tok.v;
		case 'look': return tok.v;
		case 'str': return JSON.stringify(tok.v);
		default: return String(tok.v);
	}
}

// Walks the tree keeping the key path. cb(tok, stack, key) where key = the key this token is the
// value of (when it follows "key ="), and stack = labels of the open objects ("[]" = unnamed).
function walk(save, cb) {
	const stack = [];
	let prev1 = null, prev2 = null;
	tokenize(save, (tok) => {
		const key = prev1 && prev1.t === 'eq' && prev2 ? show(prev2) : null;
		if (tok.t === 'open') stack.push(key || '[]');
		const r = cb(tok, stack, key);
		if (tok.t === 'close') stack.pop();
		prev2 = prev1; prev1 = tok;
		return r;
	});
}

// ---------- location names ----------

let locKeys = null;
function locationKeys() {
	if (!locKeys) {
		locKeys = [];
		const f = path.join(GAME, 'in_game/map_data/location_templates.txt');
		for (const l of fs.readFileSync(f, 'latin1').split(/\r?\n/)) { const m = /^([A-Za-z0-9_\-]+)\s*=/.exec(l); if (m) locKeys.push(m[1]); }
	}
	return locKeys;
}
const locName = (id) => locationKeys()[id - 1] || '?';

// ---------- commands ----------

const cmds = {};

cmds.extract = (save, outdir) => console.log(outdir ? extract(save, outdir) : resolveSave(save));

// Top-level sections of the gamestate.
cmds.top = (save) => {
	const s = load(save), top = [];
	walk(s, (tok, stack) => { if (tok.t === 'open' && stack.length === 1) top.push(stack[0]); });
	console.log(top.join(' '));
};

// Key path + surrounding tokens of every use of a string (a variable, modifier, rule option...).
cmds.find = (save, target, max = '5', after = '40') => {
	const s = load(save);
	let hits = 0, pending = null, recent = [];
	walk(s, (tok, stack) => {
		const sh = show(tok);
		if (pending) {
			pending.out.push(sh);
			if (pending.out.length >= +after) { console.log(pending.path + '\n    ' + pending.out.join(' ')); pending = null; if (hits >= +max) return false; }
		} else if (tok.t === 'look' && tok.v === target) {
			hits++;
			pending = { path: stack.join(' > '), out: recent.slice(-6).concat(['<<', sh, '>>']) };
		}
		recent.push(sh); if (recent.length > 8) recent.shift();
	});
	if (pending) console.log(pending.path + '\n    ' + pending.out.join(' '));
	console.log('hits shown:', hits);
};

// Every object at a key path, e.g. "locations>locations>3074" or "countries>database>1235".
cmds.dump = (save, want, maxTok = '3000') => {
	const s = load(save);
	let out = null, depth = 0, n = 0;
	walk(s, (tok, stack) => {
		if (out) {
			out.push(show(tok));
			if (tok.t === 'open') depth++;
			if (tok.t === 'close') depth--;
			if (depth === 0 || out.length > +maxTok) { console.log(want, out.join(' ')); out = null; n++; }
		} else if (tok.t === 'open' && stack.join('>') === want) { out = ['{']; depth = 1; }
	});
	console.log('matches:', n);
};

// Every object that directly holds "<key> = <value>", e.g. "location 3074".
cmds.refs = (save, key, value, max = '200') => {
	const s = load(save), frames = [];
	let hits = 0;
	walk(s, (tok, stack, k) => {
		for (const f of frames) if (f.toks.length < 400) f.toks.push(show(tok));
		if (tok.t === 'open') frames.push({ toks: [], hit: false });
		else if (tok.t === 'close') {
			const f = frames.pop();
			if (f && f.hit && ++hits <= +max) console.log(stack.join('>'), '{', f.toks.join(' '));
		} else if (k === key && show(tok) === value && frames.length) frames[frames.length - 1].hit = true;
	});
	console.log('hits:', hits);
};

// Every holder of a script variable, with its value (type value: identity / 100000).
cmds.vars = (save, name, max = '100000') => {
	const s = load(save);
	let cur = null, n = 0;
	walk(s, (tok, stack, k) => {
		if (k === 'flag' && tok.t === 'look' && tok.v === name) {
			const i = stack.lastIndexOf('variables');
			cur = { holder: stack.slice(0, i < 0 ? stack.length : i).join('>') };
		} else if (cur && k === 'type') cur.type = show(tok);
		else if (cur && k === 'identity') {
			const v = cur.type === 'value' ? +show(tok) / 100000 : show(tok);
			if (++n <= +max) {
				const m = /^locations>locations>(\d+)$/.exec(cur.holder);
				console.log(cur.holder + (m ? ' (' + locName(+m[1]) + ')' : ''), cur.type, v);
			}
			cur = null;
		}
	});
	console.log('holders:', n);
};

// Buildings, filtered by any of type= location= owner= (location accepts an id or a location key).
cmds.buildings = (save, ...filters) => {
	const s = load(save), want = {};
	for (const f of filters) { const [k, v] = f.split('='); want[k] = v; }
	if (want.location && !/^\d+$/.test(want.location)) want.location = String(locationKeys().indexOf(want.location) + 1);
	let cur = null, n = 0;
	walk(s, (tok, stack, k) => {
		if (tok.t === 'open' && stack.length === 3 && stack[0] === 'building_manager' && stack[1] === 'database') cur = { id: stack[2] };
		else if (cur && stack.length === 3 && k && ['type', 'location', 'owner', 'level'].includes(k)) cur[k] = show(tok);
		else if (cur && tok.t === 'close' && stack.length === 3) {
			if (Object.entries(want).every(([wk, wv]) => cur[wk] === wv)) {
				n++;
				console.log(`building ${cur.id}: ${cur.type} level ${cur.level} at ${cur.location} (${locName(+cur.location)}) owner ${cur.owner}`);
			}
			cur = null;
		}
	});
	console.log('buildings:', n);
};

// First tokens of a country: tag, name, type. Player country = the save header's display name.
cmds.country = (save, ...ids) => {
	for (const id of ids) cmds.dump(save, 'countries>database>' + id, 30);
};

// Location id <-> key (id = order in in_game/map_data/location_templates.txt, 1 = stockholm).
cmds.loc = (...args) => {
	for (const a of args) console.log(/^\d+$/.test(a) ? `${a} = ${locName(+a)}` : `${a} = ${locationKeys().indexOf(a) + 1}`);
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmds[cmd]) {
	console.log(fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8').split('## Format')[0]);
	process.exit(cmd ? 1 : 0);
}
cmds[cmd](...args);
