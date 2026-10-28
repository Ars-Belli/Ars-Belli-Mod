// Shared readers for the battle simulator tools: Paradox script files (game + Ars Belli) and EU5 TEXT saves.
const fs = require('fs');
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
function loadDb(rel) {
	const files = new Map();
	for (const root of [GAME, MOD]) {
		const dir = path.join(root, rel);
		if (!fs.existsSync(dir)) continue;
		for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort()) files.set(f.toLowerCase(), path.join(dir, f));
	}
	const db = {};
	for (const [, file] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
		for (const [k, v] of parse(fs.readFileSync(file, 'utf8'))) {
			if (!Array.isArray(v)) continue;
			const m = k.match(/^(REPLACE|INJECT|TRY_REPLACE|REPLACE_OR_CREATE|INJECT_OR_CREATE):(.+)$/);
			if (m && m[1].startsWith('INJECT') && db[m[2]]) db[m[2]] = db[m[2]].concat(v);
			else db[m ? m[2] : k] = v;
		}
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
		if (!head.toString('latin1').startsWith('SAV0300')) throw new Error(`${path.basename(file)} is a binary save (${head.toString('latin1')}); save with debug mode on to get a text save`);
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
const latestSave = () => {
	const dir = path.join(process.env.USERPROFILE || '', 'Documents/Paradox Interactive/Europa Universalis V/save games');
	const files = fs.readdirSync(dir).filter(f => f.endsWith('.eu5')).map(f => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	return files.find(f => { const b = Buffer.alloc(8); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 8, 0); fs.closeSync(fd); return b.toString('latin1').startsWith('SAV0300'); });
};

module.exports = { GAME, MOD, tokenize, parse, loadDb, get, TextSave, latestSave };
