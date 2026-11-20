'use strict';
// Game world: localisation, script values, modifier types, geography, cultures,
// 1337 start countries. Everything the gate evaluator and renderers need.
const fs = require('fs');
const path = require('path');
const P = require('./pdx');

function humanize(id) {
  if (id == null) return '';
  return String(id).replace(/^[a-z_]+:/, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());
}

function makeLoc(roots) {
  const loc = P.loadLoc(roots);
  const cache = new Map();
  function clean(s, depth) {
    s = s.replace(/\$([A-Za-z0-9_.\-']+)(\|[^$]*)?\$/g, (m, k) => (depth < 6 ? (T(k, depth + 1) ?? humanize(k)) : humanize(k)));
    s = s.replace(/\[([A-Za-z0-9_]+)\|[A-Za-z]+\]/g, (m, k) => T('game_concept_' + k, depth + 1) ?? humanize(k));
    s = s.replace(/\[Show[A-Za-z]*\('([A-Za-z0-9_:]+)'[^\]]*\)\]/g, (m, k) => T(k.replace(/^[a-z_]+:/, ''), depth + 1) ?? humanize(k));
    s = s.replace(/\[GetCountry\('([A-Za-z0-9_]+)'\)\.GetAdjective[A-Za-z]*\]/g, (m, k) => T(k + '_ADJ', depth + 1) ?? k);
    s = s.replace(/\[GetCountry\('([A-Za-z0-9_]+)'\)\.Get[A-Za-z]*\]/g, (m, k) => T(k, depth + 1) ?? k);
    s = s.replace(/\[[^\]]*\]/g, '');
    s = s.replace(/@[A-Za-z0-9_]+!/g, '');
    s = s.replace(/#!/g, '');
    s = s.replace(/#[A-Za-z_;]+\s?/g, '');
    s = s.replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
    return s;
  }
  function T(key, depth = 0) {
    if (key == null) return null;
    if (cache.has(key)) return cache.get(key);
    const raw = loc.get(key);
    if (raw == null) return null;
    cache.set(key, null); // recursion guard
    const v = clean(raw, depth);
    cache.set(key, v);
    return v;
  }
  return { T, has: k => loc.has(k), raw: k => loc.get(k), name: (k, fb) => T(k) || fb || humanize(k) };
}

function loadScriptValues(roots) {
  const vals = new Map();
  const dirs = [];
  for (const base of [roots.VANILLA, ...roots.DLC_DIRS.map(d => d.dir), roots.MOD]) {
    dirs.push(path.join(base, 'main_menu/common/script_values'));
    dirs.push(path.join(base, 'in_game/common/script_values'));
  }
  for (const d of dirs) for (const f of P.walkFiles(d, x => x.endsWith('.txt'))) {
    let b; try { b = P.parseFile(f); } catch (e) { continue; }
    for (const e of b) {
      if (!e.k) continue;
      if (typeof e.v === 'string') vals.set(e.k, e.v);
      else if (Array.isArray(e.v) && e.v.length === 1 && e.v[0].k === 'value' && typeof e.v[0].v === 'string') vals.set(e.k, e.v[0].v);
    }
  }
  function num(v, depth = 0) {
    if (typeof v === 'number') return v;
    if (typeof v !== 'string') return null;
    if (/^[-+]?\d*\.?\d+$/.test(v)) return parseFloat(v);
    if (depth > 6) return null;
    if (vals.has(v)) return num(vals.get(v), depth + 1);
    return null;
  }
  return { num, vals };
}

function loadModTypes(roots) {
  const db = P.loadDb(roots, 'modifier_type_definitions', { layer: 'main_menu' });
  const m = new Map();
  for (const [k, r] of db) {
    const b = r.block;
    m.set(k, {
      percent: P.get(b, 'percent') === 'yes',
      already: P.get(b, 'already_percent') === 'yes',
      boolean: P.get(b, 'boolean') === 'yes',
      decimals: P.get(b, 'decimals') != null ? parseInt(P.get(b, 'decimals'), 10) : null,
      color: P.get(b, 'color') || 'good',
    });
  }
  return m;
}

function loadGeography(roots) {
  const f = path.join(roots.VANILLA, 'in_game/map_data/definitions.txt');
  const modF = path.join(roots.MOD, 'in_game/map_data/definitions.txt');
  const b = P.parseFile(fs.existsSync(modF) ? modF : f);
  const loc2geo = new Map();
  const regionOf = new Map(); // area -> region etc. for display
  for (const cont of b) {
    if (!Array.isArray(cont.v)) continue;
    for (const sub of cont.v) {
      if (!Array.isArray(sub.v)) continue;
      for (const reg of sub.v) {
        if (!Array.isArray(reg.v)) continue;
        for (const area of reg.v) {
          if (!Array.isArray(area.v)) continue;
          regionOf.set(area.k, { region: reg.k, sub_continent: sub.k, continent: cont.k });
          for (const prov of area.v) {
            if (!Array.isArray(prov.v)) continue;
            for (const l of P.listValues(prov.v)) {
              loc2geo.set(l, { location: l, province: prov.k, area: area.k, region: reg.k, sub_continent: sub.k, continent: cont.k });
            }
          }
        }
      }
    }
  }
  return { loc2geo, regionOf };
}

function loadCultures(roots) {
  const cdb = P.loadDb(roots, 'cultures');
  const ldb = P.loadDb(roots, 'languages');
  const langFamily = new Map();
  const dialectOf = new Map();
  for (const [k, r] of ldb) {
    langFamily.set(k, P.get(r.block, 'family') || null);
    const dial = P.get(r.block, 'dialects');
    if (Array.isArray(dial)) for (const d of dial) if (d.k && Array.isArray(d.v)) { dialectOf.set(d.k, k); langFamily.set(d.k, P.get(r.block, 'family') || null); }
  }
  const cultures = new Map();
  for (const [k, r] of cdb) {
    const groups = new Set();
    for (const g of P.getAll(r.block, 'culture_groups')) for (const x of P.listValues(g)) groups.add(x);
    const lang = P.get(r.block, 'language') || null;
    cultures.set(k, { id: k, language: lang, groups, family: lang ? (langFamily.get(lang) || null) : null, dialectParent: lang ? dialectOf.get(lang) || null : null, mod: r.source === 'mod' || !!r.modStatus });
  }
  return { cultures, langFamily };
}

// layered setup directory (in_game/setup/countries, main_menu/setup/templates)
function layeredFiles(roots, rel) {
  const files = new Map();
  const add = (base, src) => {
    const d = path.join(base, rel);
    for (const f of P.walkFiles(d, x => x.endsWith('.txt'))) files.set(path.relative(d, f).replace(/\\/g, '/'), { file: f, src });
  };
  add(roots.VANILLA, 'vanilla');
  for (const dd of roots.DLC_DIRS) add(dd.dir, 'dlc');
  add(roots.MOD, 'mod');
  return [...files.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(x => x[1]);
}

function loadCountries(roots, geo, cult) {
  // country definitions (culture / religion)
  const defs = new Map();
  for (const fe of layeredFiles(roots, 'in_game/setup/countries')) {
    let b; try { b = P.parseFile(fe.file); } catch (e) { continue; }
    for (const e of b) if (e.k && Array.isArray(e.v)) defs.set(e.k.replace(/^(REPLACE|INJECT|TRY_REPLACE|TRY_INJECT|REPLACE_OR_CREATE):/, ''), Object.assign({}, defs.get(e.k) || {}, { culture: P.get(e.v, 'culture_definition'), religion: P.get(e.v, 'religion_definition') }));
  }
  // templates
  const templates = new Map();
  for (const fe of layeredFiles(roots, 'main_menu/setup/templates')) {
    try { templates.set(path.basename(fe.file, '.txt'), P.parseFile(fe.file)); } catch (e) { /* skip */ }
  }
  // 1337 setup: mod's split regional files (merged at deploy) — first claim wins, like merge_country_setup.ps1
  const setupDir = path.join(roots.MOD, 'main_menu/setup/1337');
  let files = fs.readdirSync(setupDir).filter(f => /^10_countries.*\.txt$/.test(f)).sort();
  const vanillaSetup = path.join(roots.VANILLA, 'main_menu/setup/1337/10_countries.txt');
  const entries = new Map();
  const readSetup = (f) => {
    const b = P.parseFile(f);
    const outer = P.get(b, 'countries');
    const inner = outer ? P.get(outer, 'countries') : null;
    if (!inner) return;
    for (const e of inner) if (e.k && Array.isArray(e.v) && !entries.has(e.k)) entries.set(e.k, e.v);
  };
  for (const f of files) readSetup(path.join(setupDir, f));
  if (entries.size < 100 && fs.existsSync(vanillaSetup)) readSetup(vanillaSetup);

  // subjects
  const overlord = new Map();
  const dipF = fs.existsSync(path.join(setupDir, '12_diplomacy.txt')) ? path.join(setupDir, '12_diplomacy.txt') : path.join(roots.VANILLA, 'main_menu/setup/1337/12_diplomacy.txt');
  try {
    const db = P.parseFile(dipF);
    const walk = (b) => { for (const e of b) { if (e.k === 'dependency' && Array.isArray(e.v)) { const s = P.get(e.v, 'second'); if (s) overlord.set(s, { tag: P.get(e.v, 'first'), type: P.get(e.v, 'subject_type') }); } else if (Array.isArray(e.v)) walk(e.v); } };
    walk(db);
  } catch (e) { /* ignore */ }

  const OWN = ['own_control_core', 'own_control_integrated', 'own_control_conquered', 'own_control_colony', 'own_core', 'own_conquered', 'own_integrated', 'own_colony'];
  const countries = [];
  for (const [tag, b] of entries) {
    const locs = [];
    for (const k of OWN) for (const v of P.getAll(b, k)) locs.push(...P.listValues(v));
    const def = defs.get(tag) || {};
    let govType = null; let rank = P.get(b, 'country_rank') || null;
    const gov = P.get(b, 'government');
    if (gov) govType = P.get(gov, 'type') || null;
    const seen = new Set();
    const visit = (incs, depth) => { // templates can include other templates
      for (const inc of incs) {
        const t = templates.get(inc);
        if (!t || seen.has(inc) || depth > 6) continue;
        seen.add(inc);
        const tg = P.get(t, 'government');
        if (!govType && tg) govType = P.get(tg, 'type') || null;
        if (!rank) rank = P.get(t, 'country_rank') || null;
        visit(P.getAll(t, 'include'), depth + 1);
      }
    };
    visit(P.getAll(b, 'include'), 0);
    const capital = P.get(b, 'capital') || locs[0] || null;
    const accepted = new Set();
    for (const a of P.getAll(b, 'accepted_cultures')) for (const x of P.listValues(a)) accepted.add(x);
    const c = cult.cultures.get(def.culture);
    countries.push({
      tag, capital, geo: capital ? geo.loc2geo.get(capital) || null : null,
      culture: def.culture || null, religion: def.religion || null, govType, rank,
      groups: c ? [...c.groups] : [], language: c ? c.language : null, family: c ? c.family : null,
      accepted: [...accepted], locCount: locs.length, ctype: P.get(b, 'type') || 'location', overlord: overlord.get(tag) || null,
    });
  }
  return countries;
}

module.exports = { humanize, makeLoc, loadScriptValues, loadModTypes, loadGeography, loadCultures, loadCountries };
