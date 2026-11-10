// Real 1.4.6 battles from an observer game, written to battles14.json for val14.js.
// Read-only on the save. Run at below-normal priority: the game may be running.
const path = require('path'), fs = require('fs'), os = require('os');
try { os.setPriority(os.constants.priority.PRIORITY_LOW); } catch {}
const R = path.resolve(__dirname, '..', '..') + '/';
const P = require(R + 'paradox.js');
const dir = path.join(process.env.USERPROFILE, 'Documents/Paradox Interactive/Europa Universalis V/save games');
const file = process.argv[2] || 'SP_Observer_1378_04_02_7c79e0a2-7da9-479b-a52b-4989855aca25.eu5';
const t0 = Date.now();
// work on a copy so the game can never see a locked or half-read file
const copy = path.join(__dirname, 'obs1378.eu5'); fs.copyFileSync(path.join(dir, file), copy);
const s = P.openSave(copy);
console.log(s.constructor.name, s.date(), ((Date.now() - t0) / 1000).toFixed(0) + 's');
const tags = s.section('countries').tags;
const tmpl = {};
for (const m of fs.readFileSync(path.join(P.GAME, 'in_game/map_data/location_templates.txt'), 'utf8').matchAll(/^([a-z0-9_]+)\s*=\s*\{([^}]*)\}/gm)) {
	const o = {}; for (const k of ['topography', 'vegetation']) { const x = m[2].match(new RegExp(k + '\\s*=\\s*([a-z_]+)')); if (x) o[k] = x[1]; } tmpl[m[1]] = o;
}
const keys = Object.keys(tmpl), wm = s.section('war_manager').database, out = [];
let n = 0;
for (const [, w] of Object.entries(wm)) {
	if (!w || typeof w !== 'object' || !w.battle) continue;
	for (const b of [].concat(w.battle)) {
		n++;
		const who = x => [].concat(x.who || []), num = a => [].concat(a || []).map(Number);
		const side = x => ({ tot: num(x.total), lost: num(x.losses), tags: who(x).map(y => tags[y.country]), levy: who(x).reduce((t, y) => t + +(y.levy || 0), 0), size: who(x).reduce((t, y) => t + +(y.size || 0), 0) });
		const k = keys[+b.location - 1], t = tmpl[k] || {};
		out.push({ date: b.date, loc: k, topo: t.topography, veg: t.vegetation, res: b.result, A: side(b.attacker), D: side(b.defender) });
	}
}
const year = b => +String(b.date).split('.')[0];
const land = out.filter(b => b.A.tot.slice(0, 5).reduce((a, c) => a + c, 0) > 0 && b.D.tot.slice(0, 5).reduce((a, c) => a + c, 0) > 0);
const after = land.filter(b => year(b) >= 1337);
const years = {}; for (const b of land) { const y = String(year(b)).slice(0, 3) + '0s'; years[y] = (years[y] || 0) + 1; }
console.log('battles', n, 'land', land.length, JSON.stringify(years), 'kept', after.length);
fs.writeFileSync(path.join(__dirname, 'battles14.json'), JSON.stringify(after));
const big = after.filter(b => b.A.tot.reduce((x, y) => x + y, 0) >= 3 && b.D.tot.reduce((x, y) => x + y, 0) >= 3);
console.log('both sides >= 3k men:', big.length);
fs.unlinkSync(copy);
