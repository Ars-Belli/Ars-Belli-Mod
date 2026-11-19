// Game update re-sync for the mod's same-path override files: a 3-way merge of
//   base   = the game file the mod's copy was made from (old game version)
//   theirs = the same game file in the new version
//   ours   = the mod's copy
// node .tools/scripts/game_update/resync.js <oldGameDir> <newGameDir> [--apply] [--only <substring>] [--report file.json]
//   <oldGameDir>/<newGameDir>: folders holding in_game, main_menu, loading_screen and dlc (a "game" folder of an install
//   or of a text copy such as E:/Modding/EU5/vanilla-game-1.4.8/game).
// Without --apply nothing is written: it prints which override files the game changed, which merge cleanly and which
// conflict. With --apply clean merges are written (the mod file's BOM and line endings are kept) and conflicted files are
// written with diff3 conflict markers (<<<<<<< mod, ||||||| old game, >>>>>>> new game) to resolve by hand.
// Line endings, BOM and trailing whitespace are ignored when deciding whether the game changed a file.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const args = process.argv.slice(2);
const flag = k => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const [OLD, NEW] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && ['--only', '--report'].includes(args[i - 1])));
if (!OLD || !NEW) { console.log('usage: resync.js <oldGameDir> <newGameDir> [--apply] [--only <substring>] [--report file.json]'); process.exit(1); }
const MOD = path.resolve(__dirname, '../../..');
const slash = p => p.split(path.sep).join('/');
const TEXT = /\.(txt|gui|yml|csv|json|info|shader|fxh|asset|settings|lua|map)$/i;

function index(game) {
	const m = new Map();
	const roots = [game];
	const dlc = path.join(game, 'dlc');
	if (fs.existsSync(dlc)) for (const d of fs.readdirSync(dlc).sort()) roots.push(path.join(dlc, d));
	const walk = (d, root) => {
		for (const e of fs.readdirSync(d, { withFileTypes: true })) {
			const p = path.join(d, e.name);
			if (e.isDirectory()) walk(p, root);
			else { const rel = slash(path.relative(root, p)).toLowerCase(); if (!m.has(rel)) m.set(rel, p); }
		}
	};
	for (const root of roots) for (const top of ['in_game', 'main_menu', 'loading_screen']) if (fs.existsSync(path.join(root, top))) walk(path.join(root, top), root);
	return m;
}
const read = f => fs.readFileSync(f, 'utf8');
const style = s => ({ bom: s.charCodeAt(0) === 0xFEFF, crlf: s.includes('\r\n') });
const lf = s => s.replace(/^\uFEFF/, '').split('\r\n').join('\n');
const loose = s => lf(s).split('\n').map(l => l.replace(/\s+$/, '')).join('\n').replace(/\n+$/, '');

const oldIdx = index(OLD), newIdx = index(NEW);
const modFiles = cp.execSync('git ls-files in_game main_menu loading_screen', { cwd: MOD, encoding: 'utf8', maxBuffer: 1 << 26 })
	.split('\n').filter(Boolean).map(f => f.replace(/^"|"$/g, '')).filter(f => TEXT.test(f) && (!opt('--only') || f.includes(opt('--only'))));
const tmp = fs.mkdtempSync(path.join(MOD, '.tools', 'resync-tmp-'));
const out = { same: [], unchanged: [], clean: [], conflict: [], newOnly: [], gone: [] };
try {
	for (const f of modFiles) {
		const key = f.toLowerCase(), n = newIdx.get(key), o = oldIdx.get(key);
		if (!n && !o) continue;                       // the mod's own file
		if (!n) { out.gone.push(f); continue; }       // the game dropped the file the mod overrides
		if (!o) { out.newOnly.push(f); continue; }    // no old copy to merge against
		const ours = read(path.join(MOD, f)), base = read(o), theirs = read(n);
		if (loose(base) === loose(theirs)) { out.unchanged.push(f); continue; }
		if (loose(ours) === loose(theirs)) { out.same.push(f); continue; }
		const [a, b, c] = ['ours', 'base', 'theirs'].map(x => path.join(tmp, x));
		fs.writeFileSync(a, lf(ours)); fs.writeFileSync(b, lf(base)); fs.writeFileSync(c, lf(theirs));
		const r = cp.spawnSync('git', ['merge-file', '-p', '--diff3', '-L', 'mod', '-L', 'old game', '-L', 'new game', a, b, c], { encoding: 'utf8', maxBuffer: 1 << 28 });
		const conflicts = r.status > 0 ? r.status : 0;
		if (r.status < 0 || r.status === null) throw new Error(`merge-file failed on ${f}: ${r.stderr}`);
		const st = style(ours);
		const merged = (st.bom ? '\uFEFF' : '') + (st.crlf ? r.stdout.split('\n').join('\r\n') : r.stdout);
		const gameLines = cp.spawnSync('git', ['diff', '--no-index', '--numstat', b, c], { encoding: 'utf8' }).stdout.split('\t').slice(0, 2).join('/');
		(conflicts ? out.conflict : out.clean).push({ f, conflicts, gameLines });
		if (flag('--apply')) fs.writeFileSync(path.join(MOD, f), merged);
	}
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`override files with a game counterpart: ${out.same.length + out.unchanged.length + out.clean.length + out.conflict.length + out.newOnly.length + out.gone.length}`);
console.log(`  game file unchanged between the two versions: ${out.unchanged.length}`);
console.log(`  mod file already equals the new game file:    ${out.same.length}`);
console.log(`  game changed, merges cleanly:                 ${out.clean.length}`);
console.log(`  game changed, conflicts with mod edits:       ${out.conflict.length}`);
console.log(`  no old game copy (new file or renamed):       ${out.newOnly.length}  ${out.newOnly.join(', ')}`);
console.log(`  dropped by the game:                          ${out.gone.length}  ${out.gone.join(', ')}`);
for (const x of out.clean) console.log(`  clean     game +/- ${x.gameLines.padEnd(9)} ${x.f}`);
for (const x of out.conflict) console.log(`  CONFLICT  ${String(x.conflicts).padStart(2)} hunks, game +/- ${x.gameLines.padEnd(9)} ${x.f}`);
if (opt('--report')) fs.writeFileSync(opt('--report'), JSON.stringify(out, null, 1));
if (flag('--apply')) console.log('written. Conflicted files hold diff3 markers.');
