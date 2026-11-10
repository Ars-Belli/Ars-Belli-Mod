// Game update re-sync for game definitions the mod copies under ANOTHER file name:
//   1. REPLACE:/TRY_REPLACE:/REPLACE_OR_CREATE: blocks in in_game/common, main_menu/common, loading_screen/common
//      (the game's block with the same key, found in the same folder);
//   2. the start setup's country blocks, which the mod splits from main_menu/setup/1337/10_countries.txt into
//      10_countries_<region>.txt files.
// Each block is merged 3-way like resync.js does for whole files: base = the block in the old game version,
// theirs = in the new one, ours = the mod's block.
// node .tools/scripts/game_update/resync_blocks.js <oldGameDir> <newGameDir> [--apply] [--report file.json]
// Without --apply it only lists the blocks the game changed. With --apply clean merges are written and conflicts get
// diff3 markers (<<<<<<< mod, ||||||| old game, >>>>>>> new game).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const args = process.argv.slice(2);
const flag = k => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const [OLD, NEW] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--report'));
if (!OLD || !NEW) { console.log('usage: resync_blocks.js <oldGameDir> <newGameDir> [--apply] [--report file.json]'); process.exit(1); }
const MOD = path.resolve(__dirname, '../../..');
const slash = p => p.split(path.sep).join('/');
const lf = s => s.replace(/^﻿/, '').split('\r\n').join('\n');
const loose = s => s.split('\n').map(l => l.replace(/#.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

// Top-level `key = { ... }` blocks of a text: [{ key, start, end }] with start at the key and end after the closing brace.
function blocks(s, from = 0, to = s.length) {
	const out = [];
	let i = from, depth = 0, cur = null;
	while (i < to) {
		const c = s[i];
		if (c === '#') { while (i < to && s[i] !== '\n') i++; continue; }
		if (c === '"') { i++; while (i < to && s[i] !== '"') i++; i++; continue; }
		if (c === '{') {
			if (depth === 0) {
				// the key is the token before "=" before this brace
				const m = s.slice(Math.max(from, i - 200), i).match(/([^\s={}#"]+)\s*=\s*$/);
				cur = m ? { key: m[1], start: i - m[0].length, open: i } : null;
			}
			depth++;
		} else if (c === '}') {
			depth--;
			if (depth === 0 && cur) { cur.end = i + 1; out.push(cur); cur = null; }
		}
		i++;
	}
	return out;
}
const inner = (s, path_) => { // text span inside nested blocks, e.g. ['countries', 'countries']
	let a = 0, b = s.length;
	for (const k of path_) { const blk = blocks(s, a, b).find(x => x.key === k); if (!blk) return null; a = blk.open + 1; b = blk.end - 1; }
	return [a, b];
};
const gameRoots = g => { const r = [g]; const d = path.join(g, 'dlc'); if (fs.existsSync(d)) for (const x of fs.readdirSync(d).sort()) r.push(path.join(d, x)); return r; };

// key -> block text for every plain top-level block of a folder in a game version (later files win, as in the game)
function gameFolder(game, rel, skipNames) {
	const m = new Map();
	for (const root of gameRoots(game)) {
		const d = path.join(root, rel);
		if (!fs.existsSync(d)) continue;
		for (const f of fs.readdirSync(d).filter(f => f.endsWith('.txt')).sort()) {
			if (skipNames.has(f.toLowerCase())) continue; // a same-name mod file shadows it; resync.js handles those
			const s = lf(fs.readFileSync(path.join(d, f), 'utf8'));
			for (const b of blocks(s)) if (!/^[A-Z_]+:/.test(b.key)) m.set(b.key, { text: s.slice(b.start, b.end), file: slash(path.relative(game, path.join(d, f))) });
		}
	}
	return m;
}
const tmp = fs.mkdtempSync(path.join(MOD, '.tools', 'resync-tmp-'));
function merge3(ours, base, theirs) {
	const [a, b, c] = ['ours', 'base', 'theirs'].map(x => path.join(tmp, x));
	fs.writeFileSync(a, ours + '\n'); fs.writeFileSync(b, base + '\n'); fs.writeFileSync(c, theirs + '\n');
	const r = cp.spawnSync('git', ['merge-file', '-p', '--diff3', '-L', 'mod', '-L', 'old game', '-L', 'new game', a, b, c], { encoding: 'utf8', maxBuffer: 1 << 28 });
	if (r.status === null || r.status < 0) throw new Error('merge-file failed: ' + r.stderr);
	return { text: r.stdout.replace(/\n$/, ''), conflicts: r.status };
}
const report = { replace: [], countries: [] };
const edits = new Map(); // mod file -> [{ start, end, text }]
const addEdit = (file, e) => { if (!edits.has(file)) edits.set(file, []); edits.get(file).push(e); };
try {
	// 1. REPLACE blocks
	const walkDirs = (d, out = [d]) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) walkDirs(path.join(d, e.name), (out.push(path.join(d, e.name)), out)); return out; };
	for (const top of ['in_game/common', 'main_menu/common', 'loading_screen/common']) {
		if (!fs.existsSync(path.join(MOD, top))) continue;
		for (const dir of walkDirs(path.join(MOD, top))) {
			const rel = slash(path.relative(MOD, dir));
			const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'));
			const names = new Set(files.map(f => f.toLowerCase()));
			let oldF = null, newF = null;
			for (const f of files) {
				const raw = fs.readFileSync(path.join(dir, f), 'utf8'), s = lf(raw);
				for (const b of blocks(s)) {
					const m = b.key.match(/^(TRY_REPLACE|REPLACE_OR_CREATE|REPLACE):(.*)$/);
					if (!m) continue;
					oldF = oldF || gameFolder(OLD, rel, names); newF = newF || gameFolder(NEW, rel, names);
					const o = oldF.get(m[2]), n = newF.get(m[2]);
					if (!n) { report.replace.push({ file: rel + '/' + f, key: m[2], state: o ? 'gone from the new game' : 'not in the game (mod key)' }); continue; }
					if (!o) { report.replace.push({ file: rel + '/' + f, key: m[2], state: 'new in the new game, no old block' }); continue; }
					if (loose(o.text) === loose(n.text)) continue;
					const head = s.slice(b.start, b.open + 1);                 // "REPLACE:key = {"
					const ours = n.text.slice(0, n.text.indexOf('{') + 1) + s.slice(b.open + 1, b.end); // same header as the game's block, so only the body is merged
					const r = merge3(ours, o.text, n.text);
					const text = head + r.text.slice(r.text.indexOf('{') + 1);
					report.replace.push({ file: rel + '/' + f, key: m[2], state: r.conflicts ? 'CONFLICT' : 'clean', conflicts: r.conflicts, game: n.file });
					addEdit(path.join(dir, f), { start: b.start, end: b.end, text });
				}
			}
		}
	}
	// 2. country blocks of the start setup
	const SETUP = 'main_menu/setup/1337', P = ['countries', 'countries'];
	const countryBlocks = file => { if (!fs.existsSync(file)) return new Map(); const s = lf(fs.readFileSync(file, 'utf8')); const sp = inner(s, P); const m = new Map(); if (sp) for (const b of blocks(s, sp[0], sp[1])) m.set(b.key, { ...b, text: s.slice(b.start, b.end) }); return m; };
	const oldC = countryBlocks(path.join(OLD, SETUP, '10_countries.txt')), newC = countryBlocks(path.join(NEW, SETUP, '10_countries.txt'));
	const modC = new Map();
	for (const f of fs.readdirSync(path.join(MOD, SETUP)).filter(f => /^10_countries_.*\.txt$/.test(f))) for (const [k, b] of countryBlocks(path.join(MOD, SETUP, f))) modC.set(k, { ...b, file: path.join(MOD, SETUP, f) });
	for (const [tag, n] of newC) {
		const o = oldC.get(tag), mine = modC.get(tag);
		if (!o) { report.countries.push({ tag, state: mine ? 'new in the game, the mod has its own block' : 'NEW in the game, not in the mod' }); continue; }
		if (loose(o.text) === loose(n.text)) continue;
		if (!mine) { report.countries.push({ tag, state: 'changed in the game, not in the mod (removed by the mod)' }); continue; }
		const r = merge3(mine.text, o.text, n.text);
		report.countries.push({ tag, state: r.conflicts ? 'CONFLICT' : 'clean', conflicts: r.conflicts, file: slash(path.relative(MOD, mine.file)) });
		addEdit(mine.file, { start: mine.start, end: mine.end, text: r.text });
	}
	for (const [tag] of oldC) if (!newC.has(tag)) report.countries.push({ tag, state: modC.has(tag) ? 'REMOVED from the game, still in the mod' : 'removed from the game' });
	if (flag('--apply')) for (const [file, list] of edits) {
		const raw = fs.readFileSync(file, 'utf8'), bom = raw.charCodeAt(0) === 0xFEFF, crlf = raw.includes('\r\n');
		let s = lf(raw);
		for (const e of list.sort((a, b) => b.start - a.start)) s = s.slice(0, e.start) + e.text + s.slice(e.end);
		fs.writeFileSync(file, (bom ? '﻿' : '') + (crlf ? s.split('\n').join('\r\n') : s));
	}
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
const count = (list, st) => list.filter(x => x.state === st).length;
console.log(`REPLACE blocks the game changed: ${count(report.replace, 'clean')} merge cleanly, ${count(report.replace, 'CONFLICT')} conflict`);
for (const x of report.replace) console.log(`  ${x.state.padEnd(9)} ${x.key}  (${x.file}${x.game ? ' <- ' + x.game : ''})`);
console.log(`country setup blocks the game changed: ${count(report.countries, 'clean')} merge cleanly, ${count(report.countries, 'CONFLICT')} conflict`);
for (const x of report.countries) console.log(`  ${x.state.padEnd(9)} ${x.tag}${x.file ? '  (' + x.file + ')' : ''}`);
if (opt('--report')) fs.writeFileSync(opt('--report'), JSON.stringify(report, null, 1));
if (flag('--apply')) console.log('written. Conflicted blocks hold diff3 markers.');
