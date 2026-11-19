// When no copy of the game version the mod's override files were made from exists, estimate it.
// node .tools/scripts/game_update/classify.js <ancientGameDir> <newGameDir> <outDir> [--only <substring>] [--adopt "file@line;..."]
//   ancient = an older game copy that does exist (1.3.11), new = the version to merge up to first (1.4.7).
// Every difference (hunk) between a mod override file and the new game file is either a mod edit or a game change the
// mod has not taken yet. Evidence, in order:
//   mod    the mod's lines carry a mod marker (#ABM, Ars Belli, abm_ ...), or a git commit after the file's import wrote them
//   mod    the game's lines are the same in the ancient copy: the game did not change there, so the mod did
//   game   the mod's lines are the ancient copy's lines: the mod still has old game text, the game moved on
//   game   the mod's lines all date from the file's import commit and are not mod-looking, and the game's lines are new
//   ?      anything else: listed for a person to decide (kept as a mod edit, which is what the mod does today)
// Output: <outDir>/<path> = the estimated old game file (the new game file with every "game" hunk put back to the mod's
// text), ready to be the <oldGameDir> of resync.js, plus <outDir>/classify.json with every hunk and its class.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const [ANC, NEW, OUT] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--only', '--adopt'].includes(args[i - 1])));
const ADOPT = opt('--adopt') ? new Set(opt('--adopt').split(';')) : null;
if (!ANC || !NEW || !OUT) { console.log('usage: classify.js <ancientGameDir> <newGameDir> <outDir> [--only <substring>]'); process.exit(1); }
const MOD = path.resolve(__dirname, '../../..');
const slash = p => p.split(path.sep).join('/');
const TEXT = /\.(txt|gui|yml|csv|json|info|shader|fxh|asset|settings|lua|map)$/i;
const MARK = /#.*(ABM|Ars ?Belli|\bAB\b|\bmod\b|vanilla|#1\.[34])|abm_|ABM|is_mp_|mp_/i;
function index(game, remap) {
	const m = new Map();
	const roots = [game];
	const dlc = path.join(game, 'dlc');
	if (fs.existsSync(dlc)) for (const d of fs.readdirSync(dlc).sort()) roots.push(path.join(dlc, d));
	const walk = (d, root) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, root); else { let rel = slash(path.relative(root, p)).toLowerCase(); if (remap) rel = remap(rel); if (!m.has(rel)) m.set(rel, p); } } };
	for (const root of roots) for (const top of ['in_game', 'main_menu', 'loading_screen']) if (fs.existsSync(path.join(root, top))) walk(path.join(root, top), root);
	return m;
}
// 1.3 kept the start setup in main_menu/setup/start, 1.4 in main_menu/setup/1337
const ancIdx = index(ANC, r => r.replace(/^main_menu\/setup\/start\//, 'main_menu/setup/1337/')), newIdx = index(NEW);
const lf = s => s.replace(/^﻿/, '').split('\r\n').join('\n');
const code = l => l.replace(/#.*$/, '').replace(/\s+/g, ' ').trim();
const git = (a, o = {}) => cp.spawnSync('git', a, { cwd: MOD, encoding: 'utf8', maxBuffer: 1 << 28, ...o }).stdout;
const modFiles = git(['ls-files', 'in_game', 'main_menu', 'loading_screen']).split('\n').filter(Boolean).map(f => f.replace(/^"|"$/g, '')).filter(f => TEXT.test(f) && (!opt('--only') || f.includes(opt('--only'))));
const ctCache = {}; const ct = c => ctCache[c] ?? (ctCache[c] = +git(["show", "-s", "--format=%ct", c]).trim());
const tmp = fs.mkdtempSync(path.join(MOD, '.tools', 'resync-tmp-'));
const all = [], tally = {};
try {
	for (const f of modFiles) {
		const n = newIdx.get(f.toLowerCase());
		if (!n) continue;
		const theirs = lf(fs.readFileSync(n, 'utf8')).split('\n'), ours = lf(fs.readFileSync(path.join(MOD, f), 'utf8')).split('\n');
		const a = theirs.map(l => l.replace(/\s+$/, '')), b = ours.map(l => l.replace(/\s+$/, ''));
		if (a.join('\n').replace(/\n+$/, '') === b.join('\n').replace(/\n+$/, '')) continue;
		const anc = ancIdx.get(f.toLowerCase());
		const S = anc ? new Set(lf(fs.readFileSync(anc, 'utf8')).split('\n').map(code).filter(Boolean)) : null;
		// per line of the mod file: the commit that last wrote it; the import commit = the one that wrote most lines
		const blame = git(['blame', '--line-porcelain', '-w', '--', f]).split('\n').filter(l => /^[0-9a-f]{40} \d+ \d+/.test(l)).map(l => l.slice(0, 40));
		const freq = {}; for (const c of blame) freq[c] = (freq[c] || 0) + 1;
		const importCommit = Object.entries(freq).sort((x, y) => y[1] - x[1])[0][0];
		const importTime = ct(importCommit);
		const later = new Set(Object.keys(freq).filter(c => c !== importCommit && ct(c) >= importTime));
		fs.writeFileSync(path.join(tmp, 'a'), a.join('\n') + '\n'); fs.writeFileSync(path.join(tmp, 'b'), b.join('\n') + '\n');
		const d = cp.spawnSync('diff', ['-U0', slash(path.join(tmp, 'a')), slash(path.join(tmp, 'b'))], { encoding: 'utf8', maxBuffer: 1 << 28 }).stdout;
		const hunks = []; let cur = null;
		for (const l of d.split('\n')) {
			const m = l.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
			if (m) { cur = { va: +m[1], vn: m[2] == null ? 1 : +m[2], ma: +m[3], mn: m[4] == null ? 1 : +m[4], van: [], mod: [] }; hunks.push(cur); }
			else if (cur && l[0] === '-' && !l.startsWith('---')) cur.van.push(l.slice(1));
			else if (cur && l[0] === '+' && !l.startsWith('+++')) cur.mod.push(l.slice(1));
		}
		const est = theirs.slice(); // estimated old game file, edited bottom-up
		for (const h of hunks.slice().reverse()) {
			const A = h.van.map(code).filter(Boolean), B = h.mod.map(code).filter(Boolean);
			const start = h.mn ? h.ma : h.ma + 1;
			const near = [b[start - 2] || '', ...h.mod, b[start - 1 + h.mn] || ''];
			const modLater = h.mn > 0 && blame.slice(h.ma - 1, h.ma - 1 + h.mn).some(c => later.has(c));
			let cls, why;
			if (!A.length && !B.length) { cls = 'blank'; why = 'whitespace or comments only'; }
			else if (h.mod.some(l => MARK.test(l)) || (!B.length && h.mod.length && near.some(l => MARK.test(l)))) { cls = 'mod'; why = 'marker'; }
			else if (modLater) { cls = 'mod'; why = 'written by a commit after the import'; }
			else if (S && A.length && A.every(l => S.has(l))) { cls = 'mod'; why = 'game text unchanged since the ancient copy'; }
			else if (S && B.length && B.every(l => S.has(l))) { cls = 'game'; why = 'mod still has the ancient game text'; }
			else if (near.some(l => MARK.test(l))) { cls = 'mod'; why = 'marker next to it'; }
			else if (B.length && !A.length) { cls = '?'; why = 'mod-only lines from the import commit, no marker'; }
			else if (!B.length) { cls = '?'; why = 'game lines the mod lacks, new since the ancient copy'; }
			else { cls = '?'; why = 'both sides differ from the ancient copy'; }
			// --adopt "file@line;file@line": a person reviewed the hunks (with the patch notes) and only these are game changes
			if (ADOPT) { const hit = ADOPT.has(f + '@' + h.va); if (cls !== 'blank') { cls = hit ? 'game' : 'mod'; if (hit) why = 'reviewed: game change'; } }
			tally[cls] = (tally[cls] || 0) + 1;
			all.push({ f, cls, why, va: h.va, vn: h.vn, ma: h.ma, mn: h.mn, van: h.van, mod: h.mod });
			if (cls === 'game') est.splice(h.vn ? h.va - 1 : h.va, h.vn, ...ours.slice(h.mn ? h.ma - 1 : h.ma, (h.mn ? h.ma - 1 : h.ma) + h.mn));
		}
		const rel = slash(path.relative(NEW, n));
		fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
		fs.writeFileSync(path.join(OUT, rel), est.join('\n'));
	}
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
fs.writeFileSync(path.join(OUT, 'classify.json'), JSON.stringify(all));
console.log('hunks by class:', JSON.stringify(tally));
const by = {}; for (const h of all) { by[h.f] = by[h.f] || {}; by[h.f][h.cls] = (by[h.f][h.cls] || 0) + 1; }
console.log('files with game changes:', Object.values(by).filter(x => x.game).length, '| files with undecided hunks:', Object.values(by).filter(x => x['?']).length);
