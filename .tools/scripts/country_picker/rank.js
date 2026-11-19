// Node port of the page's milScore (start setup) to compare data versions and the reference script.
// usage: node rank.js <data.json> [--norel] [--out file.json]   (--norel: leave religion content out)
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const NOREL = process.argv.includes('--norel');
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : null;
const I = d.items, MODS = d.mods, SCOPES = d.scopes;
const WLIST = [['Discipline', 100], ['Army Morale', 25], ['Military Tactics', 50], ['Light Infantry Power', 33], ['Heavy Infantry Power', 33],
  ['Light Cavalry Power', 33], ['Heavy Cavalry Power', 33], ['Artillery Power', 33], ['Manpower', 25], ['Levy Combat Efficiency', 20], ['Levy Size', 10],
  ['Army Levy Size', 10], ['Army Maintenance Efficiency', 25], ['Mercenary Maintenance Efficiency', 5], ['Light Infantry Maintenance Cost', -8],
  ['Heavy Infantry Maintenance Cost', -8], ['Light Cavalry Maintenance Cost', -8], ['Heavy Cavalry Maintenance Cost', -8], ['Artillery Maintenance Cost', -8]];
const MILW = new Map(); MODS.forEach(([n, f], i) => { const w = WLIST.find(x => x[0] === n); if (w) MILW.set(i, n === 'Army Morale' && f === 'n' ? w[1] / 3 : w[1]); }); // flat base morale vs base 3.0
const SC_WF = SCOPES.indexOf('Well funded, up to: ');
const SC_OK = new Set([0, SCOPES.indexOf('Always: '), SC_WF].filter(i => i >= 0));
const ASPN = new Map((d.religions || []).map(r => [r[0], typeof r[3] === 'number' && I[r[3]] && I[r[3]].t === 'rel' ? 0 : (r[3] || 0)]));
const RC = d.rc || {};
function relContent(rel, gov) {
  const x = RC[rel]; if (!x) return [];
  if (!gov || gov === 'monarchy' || !x.gx || !x.gx[gov]) return x.refs;
  const m = new Map(x.refs.map(r => [r[0], r])); for (const r of x.gx[gov]) { if (r.length === 1) m.delete(r[0]); else m.set(r[0], r); }
  return [...m.values()];
}
const baseNeeds = (needs, own) => needs.split('one of: ').join('').split(' / ').join('; ').split(' and ').join('; ').split('; ').every(p => {
  p = p.trim(); if (/^(Advance|Age|Institution): /.test(p)) return true;
  // a law policy is the country's pick: one on its own list, or one open to every country (those aren't in the data)
  const m = p.match(/^(Reform|Privilege|Policy): (.*)$/); return !!m && (own.has(m[2]) || (m[1] === 'Policy' && !POLN.has(m[2])));
});
const POLN = new Set(I.filter(it => it.t === 'pol').map(it => it.n));
// A reform named in a condition that depends on play ("Reform: X" / "not Reform: X") is the country's choice: taken
// when it can adopt the reform (on its list, Needs met in this pass) and that scores more, the reform's own modifiers
// included. A Catholic theocracy takes Military Order: Military Orders then gives +5% discipline instead of +2.5%.
const RFX = /^(not )?Reform: (.+)$/;
function reformTake(refs, ok) {
  const W = (m, v) => v * (MILW.get(m) || 0);
  const avail = new Map(), gain = new Map();
  for (const r of refs) {
    if (!ok(r)) continue;
    const it = I[r[0]], cs = r[3] || '';
    if (it.t === 'ref') avail.set(it.n, (it.mv || []).reduce((t, [m, sc, v]) => t + (SC_OK.has(sc) ? W(m, v) : 0), 0));
    for (const [m, sc, v, ci] of it.mc || []) {
      const k = SC_OK.has(sc) && (cs[ci] || 'U') === 'U' && RFX.exec(it.cd[ci] || ''); if (!k) continue;
      gain.set(k[2], (gain.get(k[2]) || 0) + (k[1] ? -1 : 1) * W(m, v));
    }
  }
  const yes = new Set(), no = new Set();
  for (const [n, g] of gain) if (avail.has(n)) (g + avail.get(n) > 0 ? yes : no).add(n);
  return { yes, no };
}
function score(c) {
  let refs = c.refs.concat(relContent(c.rk, c.gk));
  if (NOREL) refs = refs.filter(r => r[1] !== 'f' && I[r[0]].t !== 'rel');
  const own = new Set(refs.filter(r => !r[2]).map(r => I[r[0]]).filter(it => it.t === 'ref' || it.t === 'priv' || it.t === 'pol').map(it => it.n));
  const aspN = ASPN.get(c.rk) || 0;
  const run = strict => {
    const sum = new Map(), contrib = new Map(), laws = new Map(), asps = [];
    const put = (i, m, v) => { sum.set(m, (sum.get(m) || 0) + v); const w = MILW.get(m); if (w) contrib.set(i, (contrib.get(i) || 0) + v * w); };
    const ok = r => !(strict && r[2] && !baseNeeds(r[2], own));
    const rf = reformTake(refs, ok);
    for (const r of refs) {
      const it = I[r[0]]; if (!it.mv && !it.mc) continue;
      if (!ok(r)) continue;
      if (it.t === 'ref' && rf.no.has(it.n)) continue; // a reform the country is better off without
      const cs = r[3] || ''; const lines = [];
      for (const [m, sc, v] of it.mv || []) if (SC_OK.has(sc)) lines.push([m, sc, v]);
      for (const [m, sc, v, ci] of it.mc || []) {
        const st = cs[ci] || 'U'; if (!SC_OK.has(sc) || st === 'F') continue;
        const k = st === 'U' && RFX.exec(it.cd[ci] || '');
        if (st === 'T' || (k && (k[1] ? !rf.yes.has(k[2]) : rf.yes.has(k[2])))) lines.push([m, sc, v]);
      }
      if (it.t === 'pol') { const key = it.x || it.id; if (!laws.has(key)) laws.set(key, new Map()); const lm = laws.get(key);
        for (const [m, , v] of lines) { const w = MILW.get(m); if (!w) continue; const o = lm.get(m); if (!o || v * w > o.v * w) lm.set(m, { v, i: r[0] }); } continue; }
      if (it.t === 'asp') { asps.push({ i: r[0], lines, pts: lines.reduce((t, [m, , v]) => t + v * (MILW.get(m) || 0), 0) }); continue; }
      for (const [m, sc, v] of lines) put(r[0], m, it.t === 'bur' && sc === SC_WF ? v * 2 : v);
    }
    for (const lm of laws.values()) for (const [m, { v, i }] of lm) put(i, m, v);
    for (const a of asps.filter(a => a.pts > 0).sort((x, y) => y.pts - x.pts).slice(0, aspN)) for (const [m, , v] of a.lines) put(a.i, m, v);
    let s = 0; for (const [m, v] of sum) { const w = MILW.get(m); if (w) s += v * w; }
    return { s, contrib };
  };
  const b = run(true), a = run(false);
  return { tag: c.tag, n: c.n, locs: c.locs, ovl: !!c.ovl, rk: c.rk, base: b.s, cond: a.s - b.s, top: [...b.contrib].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([i, p]) => I[i].n + '=' + p.toFixed(1)) };
}
const out = d.countries.map(score);
const big = out.filter(o => o.locs >= 8 && !o.ovl).sort((a, b) => b.base - a.base);
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log('independent 8+:', big.length, 'median base', med(big.map(o => o.base)).toFixed(1));
for (const o of big.slice(0, 15)) console.log(o.tag.padEnd(6), o.n.slice(0, 20).padEnd(21), String(o.locs).padStart(3), (o.rk || '').padEnd(14), o.base.toFixed(1).padStart(6), ('+' + o.cond.toFixed(1)).padStart(7), '|', o.top.join('; '));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out));
