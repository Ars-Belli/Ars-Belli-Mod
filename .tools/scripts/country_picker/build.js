'use strict';
// Country picker generator for the Ars Belli MP mod.
// Usage: node build.js [--vanilla <game dir>] [--out <file.html>] [--json <data.json>]
// Reads vanilla 1.4.9 (+DLC) and the mod repo, resolves which country / culture /
// region gated content applies to each 1337 start country, and writes a single
// self-contained HTML page (template.html + embedded JSON).
const fs = require('fs');
const path = require('path');
const P = require('./pdx');
const W = require('./world');
const { Evaluator, T, F, U, strip } = require('./gates');

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const VANILLA = arg('--vanilla', process.env.EU5_VANILLA || 'E:/Modding/EU5/vanilla-game-1.4.9/game');
const MOD = path.resolve(__dirname, '../../..');
const OUT = arg('--out', path.join(__dirname, 'out/country_picker.html'));
const JSON_OUT = arg('--json', null);
const DLC_DIRS = fs.existsSync(path.join(VANILLA, 'dlc')) ? fs.readdirSync(path.join(VANILLA, 'dlc')).sort().map(n => ({ name: n, dir: path.join(VANILLA, 'dlc', n) })) : [];
const roots = { VANILLA, DLC_DIRS, MOD };
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

// ---------------------------------------------------------------- world
const L = W.makeLoc(roots);
const SV = W.loadScriptValues(roots);
const MT = W.loadModTypes(roots);
const GEO = W.loadGeography(roots);
const CU = W.loadCultures(roots);
log('loc/world loaded');

const scriptedTriggers = new Map();
for (const layer of ['in_game', 'main_menu']) {
  for (const [k, r] of P.loadDb(roots, 'scripted_triggers', { layer })) scriptedTriggers.set(k, r.block);
}
const EV = new Evaluator({ loc: L, scriptedTriggers, cultures: CU.cultures });
const humanize = W.humanize;
const nm = (id, ...pref) => { const k = strip(id); if (k == null) return ''; for (const p of ['', ...pref]) { const t = L.T(p + k); if (t) return t; } return humanize(k); };

// ---------------------------------------------------------------- formatting
function round(x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f; }
function signed(x) { return (x > 0 ? '+' : '') + x; }
function fmtNum(v, def) {
  const dec = def && def.decimals != null ? def.decimals : 2;
  const r = (x, d) => { const y = round(x, d); return y === 0 && x !== 0 ? round(x, d + 3) : y; };
  if (def && def.percent) return signed(r(v * 100, Math.max(0, dec - 2) + 1)) + '%';
  if (def && def.already) return signed(r(v, dec)) + '%';
  return signed(r(v, dec));
}
function modLine(key, raw) {
  const def = MT.get(key);
  let name = L.T('MODIFIER_TYPE_NAME_' + key) || humanize(key);
  if (raw === 'yes' || raw === 'no' || (def && def.boolean)) return [raw === 'no' ? 'No: ' + name : name, def && def.color === 'bad' ? -1 : 1];
  const v = SV.num(raw);
  if (v == null) return [name + ': ' + humanize(raw), 0];
  if (v === 0) return null;
  const good = !def || def.color === 'neutral' ? (def && def.color === 'neutral' ? 0 : (v > 0 ? 1 : -1)) : def.color === 'bad' ? (v < 0 ? 1 : -1) : (v > 0 ? 1 : -1);
  return [fmtNum(v, def) + ' ' + name, good];
}
const MOD_BLOCKS = {
  country_modifier: '', modifier: '', location_modifier: 'Locations: ', province_modifier: 'Provinces: ', character_modifier: 'Ruler/characters: ',
  capital_modifier: 'Capital: ', capital_country_modifier: '', raw_modifier: '', rebel_modifier: 'Rebels: ', foreign_country_modifier: 'Owner (foreign): ',
  market_center_modifier: 'Market center: ', unit_modifier: 'Units: ',
};
function modifierLines(block, prefix = '') {
  const out = [];
  if (!Array.isArray(block)) return out;
  // sum duplicate keys (INJECT appends deltas)
  const sums = new Map(); const order = [];
  for (const e of block) {
    if (!e.k || Array.isArray(e.v)) continue;
    if (!MT.has(e.k) && !L.has('MODIFIER_TYPE_NAME_' + e.k)) continue;
    const n = SV.num(e.v);
    if (sums.has(e.k) && n != null && typeof sums.get(e.k) === 'number') sums.set(e.k, sums.get(e.k) + n);
    else { if (!sums.has(e.k)) order.push(e.k); sums.set(e.k, n != null ? n : e.v); }
  }
  for (const k of order) {
    const v = sums.get(k);
    const l = modLine(k, v); if (!l) continue;
    const line = [prefix + l[0], l[1]];
    // structured value for the page's modifier totals (non-index array props are not serialised)
    if (typeof v === 'number') line._m = [k, prefix, v]; else if (v === 'yes') line._m = [k, prefix, true];
    out.push(line);
  }
  return out;
}
// Modifier blocks of one item. Unconditional blocks of the same kind are merged (INJECT appends a second
// block of deltas). A block with `potential_trigger` (or a `scale`) only applies under a condition: its lines
// carry the condition index in line[3], and the condition goes into `conds` so build.js can evaluate it per
// country / government. `display_trigger` only changes the tooltip and is ignored.
// Without a `conds` collector (summaries of unlocked things) the condition is written into the line text.
const LOCATION_SCOPED = new Set(['location_modifier', 'province_modifier', 'capital_modifier', 'market_center_modifier']);
const BLANK_CTX = { tag: null, tags: new Set(), culture: null, groups: new Set(), accepted: new Set(), geo: null, religion: null, govType: null, blank: true };
function scaleText(sc) {
  if (!Array.isArray(sc)) return 'scaled';
  const d = P.get(sc, 'desc'); const v = P.get(sc, 'value');
  const txt = (d && L.T(String(d).replace(/^\[|\|e\]$/g, ''))) || (typeof v === 'string' ? humanize(v.replace(/\(.*\)/, '')) : null);
  return 'scales with ' + (txt ? txt.toLowerCase() : 'a game value');
}
function condText(c) {
  const parts = [];
  if (c.trig) { const r = EV.run(c.trig, BLANK_CTX, c.scope); parts.push(r.res.length ? r.res.join('; ') : 'a special condition'); }
  if (c.scale) parts.push(c.scale);
  return parts.join('; ');
}
function allModifierBlocks(block, conds) {
  const out = [];
  const plain = new Map(); const order = [];
  for (const e of block) {
    if (!e.k || MOD_BLOCKS[e.k] === undefined || !Array.isArray(e.v)) continue;
    const pt = P.get(e.v, 'potential_trigger');
    const sc = P.get(e.v, 'scale');
    const entries = e.v.filter(x => x.k !== 'potential_trigger' && x.k !== 'display_trigger' && x.k !== 'scale');
    if (!pt && !sc) { if (!plain.has(e.k)) { plain.set(e.k, []); order.push({ k: e.k }); } plain.get(e.k).push(...entries); continue; }
    order.push({ k: e.k, entries, cond: { trig: pt || null, scope: LOCATION_SCOPED.has(e.k) ? 'location' : 'country', scale: sc ? scaleText(sc) : null } });
  }
  for (const o of order) {
    if (!o.cond) { out.push(...modifierLines(plain.get(o.k), MOD_BLOCKS[o.k])); continue; }
    const lines = modifierLines(o.entries, MOD_BLOCKS[o.k]);
    if (!lines.length) continue;
    if (!conds) { const t = condText(o.cond); for (const l of lines) { l[0] += ` (only when ${t})`; delete l._m; } out.push(...lines); continue; }
    const ci = conds.length; conds.push(o.cond);
    for (const l of lines) { l[2] = null; l[3] = ci; if (l._m) l._m[3] = ci; }
    out.push(...lines);
  }
  return out;
}
function shortText(s, n = 260) { if (!s) return null; s = s.trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }

// ---------------------------------------------------------------- databases
const DB = {};
for (const sub of ['advances', 'estate_privileges', 'government_reforms', 'laws', 'unit_types', 'levies', 'building_types', 'decisions', 'generic_actions', 'cabinet_actions', 'casus_belli', 'formable_countries', 'estates', 'government_types', 'country_ranks', 'bureaucracies']) DB[sub] = P.loadDb(roots, sub);
DB.static_modifiers = P.loadDb(roots, 'static_modifiers', { layer: 'main_menu' });
// reform -> government type, so a reform of another government type is false under the picked one
for (const [id, r] of DB.government_reforms) { const g = P.get(r.block, 'government'); if (typeof g === 'string') EV.reformGov.set(id, strip(g)); }
const GOVS = ['monarchy', 'republic', 'theocracy', 'tribe', 'steppe_horde'].filter(g => DB.government_types.has(g) || g === 'monarchy');
log('databases loaded');

function modFlag(r) {
  if (!r) return undefined;
  if (r.source === 'mod' && r.modStatus === 'new') return 'new';
  if (r.modStatus === 'replaced' || r.modStatus === 'injected' || r.modStatus === 'file_override') return 'chg';
  return undefined;
}
function dlcName(r) { if (!r || !r.dlc) return undefined; return r.dlc.replace(/^D\d+_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

// unit helpers
function unitRec(id) { return DB.unit_types.get(strip(id)); }
function unitInherit(id, key, depth = 0) {
  const r = unitRec(id); if (!r || depth > 8) return null;
  const v = P.get(r.block, key); if (v != null) return v;
  const cf = P.get(r.block, 'copy_from'); return cf ? unitInherit(cf, key, depth + 1) : null;
}
const UNIT_PCT = new Set(['strength_damage_done', 'morale_damage_done', 'strength_damage_taken', 'morale_damage_taken', 'build_time_modifier', 'bombard_efficiency', 'attrition_loss']);
const UNIT_BAD = new Set(['strength_damage_taken', 'morale_damage_taken', 'build_time_modifier', 'attrition_loss', 'supply_weight', 'food_consumption_per_strength']);
const UNIT_STATS = ['combat_power', 'max_strength', 'strength_damage_done', 'morale_damage_done', 'strength_damage_taken', 'morale_damage_taken', 'combat_speed', 'initiative', 'movement_speed', 'flanking_ability', 'secure_flanks_defense', 'bombard_efficiency', 'artillery_barrage', 'frontage', 'build_time_modifier', 'attrition_loss', 'supply_weight', 'cannons', 'hull_size', 'crew_size', 'blockade_capacity', 'transport_capacity', 'anti_piracy_warfare', 'maritime_presence'];
function unitLines(id) {
  const r = unitRec(id); if (!r) return [];
  const b = r.block; const out = [];
  const cat = unitInherit(id, 'category'); const age = unitInherit(id, 'age');
  const base = P.get(b, 'copy_from');
  const head = [cat ? nm(cat) : null, age ? 'from ' + nm(age) : null, base ? 'based on ' + nm(base) : null].filter(Boolean).join(', ');
  if (head) out.push([head, 0]);
  for (const s of UNIT_STATS) {
    const raw = P.get(b, s); if (raw == null) continue;
    const v = SV.num(raw); if (v == null || v === 0) continue;
    const label = L.T('game_concept_' + s) || humanize(s);
    const txt = UNIT_PCT.has(s) ? signed(round(v * 100, 1)) + '%' : (s === 'max_strength' || s === 'combat_power' ? String(round(v, 2)) : signed(round(v, 2)));
    const good = s === 'max_strength' || s === 'combat_power' ? 0 : (UNIT_BAD.has(s) ? (v < 0 ? 1 : -1) : (v > 0 ? 1 : -1));
    out.push([`${txt} ${label}`, good]);
  }
  for (const blk of ['combat', 'impact']) {
    const cb = P.get(b, blk); if (!Array.isArray(cb)) continue;
    const parts = cb.filter(e => e.k && SV.num(e.v) != null && SV.num(e.v) !== 0).map(e => `${signed(round(SV.num(e.v) * 100, 1))}% ${nm(e.k)}`);
    if (parts.length) out.push([(blk === 'combat' ? 'Terrain combat: ' : 'Terrain impact on enemy: ') + parts.join(', '), 0]);
  }
  const up = P.get(b, 'upgrades_to_only') || P.get(b, 'upgrades_to');
  if (up && unitRec(up)) out.push(['Upgrades to ' + nm(up), 0]);
  return out;
}

// sub-summaries for unlocked things
function summarizeRef(kind, id) {
  id = strip(id);
  let r, lines = [];
  switch (kind) {
    case 'unit': return unitLines(id);
    case 'policy': { const pol = POLICIES.get(id); if (pol) lines = allModifierBlocks(pol.block); break; }
    case 'reform': r = DB.government_reforms.get(id); if (r) lines = allModifierBlocks(r.block); break;
    case 'privilege': r = DB.estate_privileges.get(id); if (r) lines = allModifierBlocks(r.block); break;
    case 'building': r = DB.building_types.get(id); if (r) lines = buildingLines(r.block); break;
    case 'levy': r = DB.levies.get(id); if (r) lines = levyLines(r.block); break;
    case 'cabinet': r = DB.cabinet_actions.get(id); if (r) lines = allModifierBlocks(r.block); break;
  }
  return lines;
}
const UNLOCK = {
  unlock_unit: ['Unlocks unit', 'unit'], unlock_building: ['Unlocks building', 'building'], unlock_levy: ['Unlocks levy', 'levy'],
  unlock_policy: ['Unlocks policy', 'policy'], unlock_government_reform: ['Unlocks reform', 'reform'], unlock_estate_privilege: ['Unlocks privilege', 'privilege'],
  unlock_cabinet_action: ['Unlocks cabinet action', 'cabinet'], unlock_production_method: ['Unlocks production method', null], unlock_law: ['Unlocks law', null],
  unlock_road_type: ['Unlocks road', null], unlock_ability: ['Unlocks ability', null], unlock_character_interaction: ['Unlocks interaction', null],
  unlock_country_interaction: ['Unlocks diplomatic action', null], unlock_generic_action: ['Unlocks action', null], unlock_subject_type: ['Unlocks subject type', null],
  unlock_diplomacy: ['Unlocks', null], unlock_heir_selection: ['Unlocks heir selection', null], unlock_institution: ['Unlocks', null], unlock_parliament_type: ['Unlocks parliament', null],
};
function unlockLines(block) {
  const out = [];
  for (const e of block) {
    if (!e.k || !/^unlock_/.test(e.k) || typeof e.v !== 'string') continue;
    const u = UNLOCK[e.k] || [humanize(e.k), null];
    const id = strip(e.v);
    out.push([`${u[0]}: ${nm(id, 'building_type_', 'law_')}`, 2]);
    if (u[1]) for (const s of summarizeRef(u[1], id)) out.push(['  ' + s[0], s[1], 1]);
  }
  return out;
}
function buildingLines(b, conds) {
  const out = allModifierBlocks(b, conds);
  const ml = P.get(b, 'max_levels'); if (ml && ml !== '1' && SV.num(ml)) out.unshift(['Max level ' + SV.num(ml), 0]);
  return out;
}
function levyLines(b) {
  const out = [];
  const unit = P.get(b, 'unit');
  const pops = P.getAll(b, 'allowed_pop_type').map(x => nm(x));
  const cults = P.getAll(b, 'allowed_culture').map(x => nm(x));
  if (unit) out.push(['Raises ' + nm(unit) + (pops.length ? ' from ' + pops.join('/') + ' pops' : ''), 0]);
  if (cults.length) out.push(['Pops of culture: ' + cults.join(', '), 0]);
  const sz = P.get(b, 'size'); const n = SV.num(sz); if (n != null) out.push(['Size factor ' + round(n, 3), 0]);
  if (unit) for (const s of unitLines(unit)) out.push(['  ' + s[0], s[1], 1]);
  return out;
}

// effects summary for decisions / actions / events
function effectLines(block, out = [], depth = 0) {
  if (!Array.isArray(block) || depth > 12) return out;
  for (const e of block) {
    if (!e.k) continue;
    if (e.k === 'add_country_modifier' && Array.isArray(e.v)) {
      const m = P.get(e.v, 'modifier');
      const dur = ['years', 'months', 'days'].map(u => P.get(e.v, u) ? `${SV.num(P.get(e.v, u)) ?? P.get(e.v, u)} ${u}` : null).filter(Boolean)[0];
      const sm = m ? DB.static_modifiers.get(strip(m)) : null;
      out.push([`Modifier “${nm(m)}” (${dur || 'permanent'})`, 2]);
      if (sm) for (const l of modifierLines(sm.block)) out.push(['  ' + l[0], l[1], 1]);
    } else if (e.k === 'grant_estate_privilege' || e.k === 'add_estate_privilege') {
      const id = typeof e.v === 'string' ? e.v : P.get(e.v, 'type') || P.get(e.v, 'privilege');
      out.push(['Grants privilege: ' + nm(id), 2]);
      for (const l of summarizeRef('privilege', id)) out.push(['  ' + l[0], l[1], 1]);
    } else if (e.k === 'add_reform' || e.k === 'add_government_reform') {
      const id = typeof e.v === 'string' ? e.v : P.get(e.v, 'type');
      out.push(['Gains reform: ' + nm(id), 2]);
      for (const l of summarizeRef('reform', id)) out.push(['  ' + l[0], l[1], 1]);
    } else if (/^unlock_.*_effect$/.test(e.k) && Array.isArray(e.v)) {
      const id = P.get(e.v, 'type');
      if (id && e.k !== 'unlock_government_reform_effect') out.push([humanize(e.k.replace(/_effect$/, '')) + ': ' + nm(id), 2]);
    } else if (e.k === 'set_country_rank') {
      out.push(['Rank becomes ' + nm(e.v), 2]);
    } else if (e.k === 'change_country_tag' || e.k === 'change_tag' || e.k === 'change_country_name') {
      out.push(['Becomes ' + nm(typeof e.v === 'string' ? e.v : P.get(e.v, 'tag') || ''), 2]);
    } else if (e.k === 'add_core' || e.k === 'add_claim') {
      // skip: map specific
    } else if (Array.isArray(e.v) && !['limit', 'ai_chance', 'ai_will_do', 'trigger', 'show_as_tooltip', 'random_list'].includes(e.k)) {
      effectLines(e.v, out, depth + 1);
    }
  }
  // dedupe
  const seen = new Set();
  return out.filter(l => { const k = l[0]; if (seen.has(k)) return false; seen.add(k); return true; });
}

// ---------------------------------------------------------------- content items
const items = [];
const gates = []; // parallel: { blocks: [{b, scope}], extra: residual-only blocks }
function addItem(item, gate) { items.push(item); gates.push(gate); return items.length - 1; }
// item with conditional modifier blocks: item.cd = condition texts, gate.conds = triggers evaluated per country
function addCondItem(item, gate, conds) {
  if (conds && conds.length) { item.cd = conds.map(condText); gate.conds = conds; }
  return addItem(item, gate);
}
// `government = X` on an advance or reform restricts it to that government type
function govBlock(gov) { return typeof gov === 'string' ? [{ b: [{ k: 'government_type', op: '=', v: gov }], scope: 'country' }] : []; }

// policies (nested in laws)
const POLICIES = new Map();
for (const [lawId, r] of DB.laws) {
  for (const e of r.block) {
    if (!e.k || !Array.isArray(e.v)) continue;
    if (['potential', 'allow', 'locked', 'custom_tags', 'requires_vote', 'law_category', 'type', 'unique'].includes(e.k)) continue;
    POLICIES.set(e.k, { law: lawId, block: e.v, rec: r });
  }
}

const AGE_ORDER = { age_1_traditions: 1, age_2_renaissance: 2, age_3_discovery: 3, age_4_reformation: 4, age_5_absolutism: 5, age_6_revolutions: 6 };
const ageName = a => a ? nm(a).replace(/^Age of /, '') : null;

// Advances
let religionAdv = 0;
for (const [id, r] of DB.advances) {
  const b = r.block;
  const pot = P.get(b, 'potential');
  if (!pot) continue;
  if (/^religion_/.test(path.basename(r.file))) religionAdv++;
  const conds = [];
  const fx = [...allModifierBlocks(b, conds), ...modifierLines(b), ...unlockLines(b)];
  const gov = P.get(b, 'government');
  const age = P.get(b, 'age');
  const req = P.get(b, 'requires');
  addCondItem({ id, t: 'adv', n: nm(id), fx, a: AGE_ORDER[strip(age)] || 0, x: [gov ? 'Only for ' + nm(gov, 'government_type_') : null, req ? 'Requires ' + nm(req) : null].filter(Boolean).join(' · ') || undefined, m: modFlag(r), dlc: dlcName(r) },
    { blocks: [{ b: pot, scope: 'country' }, ...govBlock(gov)], extra: [P.get(b, 'allow')] }, conds);
}
// Estate privileges
for (const [id, r] of DB.estate_privileges) {
  const pot = P.get(r.block, 'potential'); if (!pot) continue;
  const est = P.get(r.block, 'estate');
  const conds = [];
  addCondItem({ id, t: 'priv', n: nm(id), fx: allModifierBlocks(r.block, conds), x: est ? nm(est) : undefined, m: modFlag(r), dlc: dlcName(r) },
    { blocks: [{ b: pot, scope: 'country' }], extra: [P.get(r.block, 'allow')] }, conds);
}
// Government reforms
for (const [id, r] of DB.government_reforms) {
  const pot = P.get(r.block, 'potential'); if (!pot) continue;
  const gov = P.get(r.block, 'government'); const age = P.get(r.block, 'age');
  const tags = [P.get(r.block, 'major') === 'yes' ? 'Major' : null, P.get(r.block, 'unique') === 'yes' ? 'Unique' : null, gov ? nm(gov, 'government_type_') : null].filter(Boolean);
  const conds = [];
  addCondItem({ id, t: 'ref', n: nm(id), fx: allModifierBlocks(r.block, conds), x: tags.join(' · ') || undefined, a: AGE_ORDER[strip(age)] || 0, m: modFlag(r), dlc: dlcName(r) },
    { blocks: [{ b: pot, scope: 'country' }, ...govBlock(gov)], extra: [P.get(r.block, 'allow')] }, conds);
}
// Laws & policies
for (const [lawId, r] of DB.laws) {
  const lpot = P.get(r.block, 'potential');
  const cat = P.get(r.block, 'law_category');
  if (P.get(r.block, 'type')) continue; // international organisation laws
  for (const e of r.block) {
    if (!e.k || !Array.isArray(e.v) || !POLICIES.has(e.k) || POLICIES.get(e.k).law !== lawId) continue;
    const ppot = P.get(e.v, 'potential');
    const blocks = [];
    if (lpot) blocks.push({ b: lpot, scope: 'country' });
    if (ppot) blocks.push({ b: ppot, scope: 'country' });
    if (!blocks.length) continue;
    const conds = [];
    addCondItem({ id: e.k, t: 'pol', n: nm(e.k), fx: allModifierBlocks(e.v, conds), x: nm(lawId) + (cat ? ' (' + humanize(cat) + ')' : ''), m: modFlag(r), dlc: dlcName(r) },
      { blocks, extra: [P.get(e.v, 'allow')] }, conds);
  }
}
// Bureaucracies
for (const [id, r] of DB.bureaucracies) {
  const b = r.block;
  const pot = P.get(b, 'potential'); if (!pot) continue;
  const fx = [
    ...modifierLines(P.get(b, 'neutral_modifier'), 'Always: '),
    ...modifierLines(P.get(b, 'positive_modifier'), 'Well funded, up to: '),
    ...modifierLines(P.get(b, 'negative_modifier'), 'Underfunded, up to: '),
  ];
  const like = P.listValues(P.get(b, 'estates_that_like')).map(x => nm(x));
  const dislike = P.listValues(P.get(b, 'estates_that_dislike')).map(x => nm(x));
  if (like.length) fx.push(['Liked by ' + like.join(', '), 0]);
  if (dislike.length) fx.push(['Disliked by ' + dislike.join(', '), 0]);
  addItem({ id, t: 'bur', n: titleOf(id), fx, m: modFlag(r), dlc: dlcName(r) }, { blocks: [{ b: pot, scope: 'country' }], extra: [P.get(b, 'allow')] });
}
// Unit types
for (const [id, r] of DB.unit_types) {
  const b = r.block;
  if (P.get(b, 'hide') === 'yes' || P.get(b, 'buildable') === 'no') continue;
  const cp = P.get(b, 'country_potential'); const lp = P.get(b, 'location_potential');
  if (!cp && !lp) continue;
  const blocks = [];
  if (cp) blocks.push({ b: cp, scope: 'country' });
  if (lp) blocks.push({ b: lp, scope: 'location' });
  const age = unitInherit(id, 'age');
  addItem({ id, t: 'unit', n: nm(id), fx: unitLines(id), a: AGE_ORDER[strip(age)] || 0, m: modFlag(r), dlc: dlcName(r) }, { blocks, extra: [] });
}
// Levies
for (const [id, r] of DB.levies) {
  const b = r.block;
  const cults = P.getAll(b, 'allowed_culture').map(strip);
  const ca = P.get(b, 'country_allow');
  if (!cults.length && !ca) continue;
  const unit = P.get(b, 'unit');
  addItem({ id, t: 'levy', n: unit ? nm(unit) + ' levy' : nm(id), fx: levyLines(b), m: modFlag(r), dlc: dlcName(r) }, { blocks: ca ? [{ b: ca, scope: 'country' }] : [], cultures: cults, extra: [] });
}
// Buildings
for (const [id, r] of DB.building_types) {
  const b = r.block;
  const cp = P.get(b, 'country_potential'); const lp = P.get(b, 'location_potential');
  if (!cp && !lp) continue;
  const blocks = [];
  if (cp) blocks.push({ b: cp, scope: 'country' });
  if (lp) blocks.push({ b: lp, scope: 'location', soft: true });
  const conds = [];
  addCondItem({ id, t: 'bld', n: nm(id, 'building_type_'), fx: buildingLines(b, conds), x: nm(P.get(b, 'category')) || undefined, m: modFlag(r), dlc: dlcName(r) }, { blocks, extra: [P.get(b, 'allow')] }, conds);
}
// Decisions
for (const [id, r] of DB.decisions) {
  const pot = P.get(r.block, 'potential'); if (!pot) continue;
  const fx = [];
  for (const o of P.getAll(r.block, 'option')) effectLines(o, fx);
  addItem({ id, t: 'dec', n: titleOf(id), d: descOf(id), fx: dedupe(fx), m: modFlag(r), dlc: dlcName(r) }, { blocks: [{ b: pot, scope: 'country' }], extra: [] });
}
function dedupe(fx) { const s = new Set(); return fx.filter(l => !s.has(l[0]) && s.add(l[0])); }
function titleOf(id) { return L.T(id) || L.T(id + '.title') || L.T(id + '_title') || L.T(id + '_name') || humanize(id); }
function descOf(id) { return shortText(L.T(id + '_desc') || L.T(id + '.desc') || L.T(id + '_description')); }
// Generic actions (country-owned ones)
for (const [id, r] of DB.generic_actions) {
  const pot = P.get(r.block, 'potential'); if (!pot) continue;
  addItem({ id, t: 'act', n: titleOf(id), d: descOf(id), fx: effectLines(P.get(r.block, 'effect') || []), m: modFlag(r), dlc: dlcName(r) }, { blocks: [{ b: pot, scope: 'country' }], extra: [] });
}
// Cabinet actions
for (const [id, r] of DB.cabinet_actions) {
  const pot = P.get(r.block, 'potential'); if (!pot) continue;
  const conds = [];
  addCondItem({ id, t: 'cab', n: titleOf(id), d: descOf(id), fx: allModifierBlocks(r.block, conds), m: modFlag(r), dlc: dlcName(r) }, { blocks: [{ b: pot, scope: 'country' }], extra: [P.get(r.block, 'allow')] }, conds);
}
// Casus belli
for (const [id, r] of DB.casus_belli) {
  const cv = P.get(r.block, 'create_visible'); if (!cv) continue;
  addItem({ id, t: 'cb', n: titleOf(id), d: descOf(id), fx: [], m: modFlag(r), dlc: dlcName(r) }, { blocks: [{ b: cv, scope: 'country' }], extra: [] });
}
// Events granting a permanent country modifier
let eventFiles = 0, permEvents = 0, untriggeredPerm = 0;
{
  const files = new Map();
  const add = (base, src, dlc) => { const d = path.join(base, 'in_game/events'); for (const f of P.walkFiles(d, x => x.endsWith('.txt'))) files.set(path.relative(d, f).replace(/\\/g, '/'), { f, src, dlc }); };
  add(VANILLA, 'vanilla'); for (const dd of DLC_DIRS) add(dd.dir, 'dlc', dd.name); add(MOD, 'mod');
  for (const [rel, fe] of files) {
    let b; try { b = P.parseFile(fe.f); } catch (e) { continue; }
    eventFiles++;
    for (const e of b) {
      if (!e.k || !Array.isArray(e.v) || !/\.\d+$/.test(e.k)) continue;
      const opts = P.getAll(e.v, 'option');
      const fx = []; const optNames = [];
      for (const o of opts) {
        const perm = [];
        (function walk(bl) { for (const x of bl) { if (x.k === 'add_country_modifier' && Array.isArray(x.v) && !['years', 'months', 'days'].some(u => P.has(x.v, u))) perm.push(x); else if (Array.isArray(x.v) && x.k !== 'trigger' && x.k !== 'ai_chance') walk(x.v); } })(o);
        if (!perm.length) continue;
        const on = P.get(o, 'name');
        const lines = effectLines(perm);
        fx.push([`Option “${on ? nm(on) : 'default'}”:`, 2], ...lines.map(l => ['  ' + l[0], l[1], l[2] || 1]));
      }
      if (!fx.length) continue;
      permEvents++;
      const trig = P.get(e.v, 'trigger');
      if (!trig) { untriggeredPerm++; continue; }
      addItem({ id: e.k, t: 'evt', n: nm(e.k + '.title') || e.k, fx, m: fe.src === 'mod' ? 'new' : undefined, dlc: fe.dlc ? dlcName({ dlc: fe.dlc }) : undefined }, { blocks: [{ b: trig, scope: 'country' }], extra: [] });
    }
  }
}
log(`items: ${items.length} (${religionAdv} religion advances; ${permEvents} events with permanent modifiers, ${untriggeredPerm} without a trigger)`);

// ---------------------------------------------------------------- evaluation
function evalGate(g, ctx) {
  let v = T; const res = []; const hits = new Set(); const hitTags = new Set();
  if (g.cultures && g.cultures.length) {
    if (!ctx.culture) return null;
    if (g.cultures.includes(ctx.culture)) hits.add('culture'); else if (ctx.accepted && [...ctx.accepted].some(c => g.cultures.includes(c))) { hits.add('culture'); res.push('Pops of an accepted culture'); } else return null;
  }
  for (const bl of g.blocks) {
    const r = EV.run(bl.b, ctx, bl.scope);
    if (r.v === F) { if (bl.soft) { continue; } return null; }
    if (r.v === U) { v = U; res.push(...r.res); }
    r.hits.forEach(h => hits.add(h)); r.hitTags.forEach(h => hitTags.add(h));
  }
  if (!hits.size) return null;
  for (const ex of g.extra || []) {
    if (!Array.isArray(ex) || !ex.length) continue;
    const r = EV.run(ex, ctx, 'country');
    if (r.v === U) res.push(...r.res);
    else if (r.v === F) res.push('(currently not met at start)');
  }
  // conditional modifier blocks: one state letter per condition (T met, F not met, U depends on play)
  let st;
  if (g.conds) st = g.conds.map(c => { let s = c.trig ? EV.run(c.trig, ctx, c.scope).v : T; if (c.scale && s === T) s = U; return s === T ? 'T' : s === F ? 'F' : 'U'; }).join('');
  return { hits, hitTags, res: [...new Set(res.filter(Boolean))], st };
}
// ref = [itemIndex, via, needs|null, conditionStates]; trailing fields only when present
function refOf(i, ctx) {
  const r = evalGate(gates[i], ctx);
  if (!r) return null;
  const res = cleanRes(r.res, items[i]);
  const ref = [i, viaOf(r.hits)];
  if (res.length || r.st) ref.push(res.length ? res.join('; ') : null);
  if (r.st) ref.push(r.st);
  return ref;
}
function viaOf(h) { return h.has('tag') ? 't' : h.has('culture') ? 'c' : (h.has('group') || h.has('language')) ? 'g' : h.has('region') ? 'r' : h.has('religion') ? 'f' : 'w'; }
// residual conditions: drop the "not already taken" self-checks and duplicates
function cleanRes(res, item) {
  const own = item.n;
  return res.filter(s => s && !(s.startsWith('not ') && s.endsWith(': ' + own)) && !/^not (Reform|Privilege|Policy|Advance): /.test(s) && s.length < 400);
}

const countriesRaw = W.loadCountries(roots, GEO, CU).filter(c => c.locCount > 0);
log(`countries with land: ${countriesRaw.length}`);

const RELIGION_DB = P.loadDb(roots, 'religions');
function ctxOf(c) {
  const rr = c.religion ? RELIGION_DB.get(c.religion) : null;
  return {
    tag: c.tag, tags: new Set([c.tag]), culture: c.culture, groups: new Set(c.groups), language: c.language, family: c.family, accepted: new Set(c.accepted), geo: c.geo,
    religion: c.religion, religionGroup: rr ? P.get(rr.block, 'group') : null, govType: c.govType, govFixed: true, relFixed: true, isSubject: !!c.overlord, ctype: c.ctype,
  };
}
const REL_GROUP = new Map(); for (const [id, r] of RELIGION_DB) REL_GROUP.set(id, P.get(r.block, 'group') || null);
for (const [id, r] of RELIGION_DB) EV.relTags.set(id, new Set([...P.getAll(r.block, 'tags'), ...P.getAll(r.block, 'custom_tags')].flatMap(b => P.listValues(b))));
// JSON of every scripted trigger a gate reaches (transitively), so religion checks inside them are seen
function scriptedClosure(json) {
  const out = []; const seen = new Set();
  const stack = [...json.matchAll(/"k":"([a-z_0-9]+)"/g)].map(m => m[1]).filter(n => scriptedTriggers.has(n));
  while (stack.length) {
    const n = stack.pop(); if (seen.has(n)) continue; seen.add(n);
    const s = JSON.stringify(scriptedTriggers.get(n)); out.push(s);
    for (const m of s.matchAll(/"k":"([a-z_0-9]+)"/g)) if (scriptedTriggers.has(m[1])) stack.push(m[1]);
  }
  return out.join('');
}
// Religion classes per item: the religions and religion groups its gate names. Any religion falls in one
// class (a named religion, "another religion of a named group" = group + '*', or '-' for everything else),
// and all religions of one class give the same result, so each class is evaluated once.
const relInfo = gates.map(g => {
  const s = JSON.stringify([g.blocks.map(b => b.b), g.extra, (g.conds || []).map(c => c.trig)]);
  const full = s + scriptedClosure(s);
  const rels = new Set([...full.matchAll(/"k":"(?:religion|this)","op":"[^"]*","v":"religion:([a-z_0-9]+)"/g)].map(m => m[1]));
  for (const m of full.matchAll(/"k":"religion","op":"[^"]*","v":"([a-z_0-9]+)"/g)) if (REL_GROUP.has(m[1])) rels.add(m[1]);
  const groups = new Set([...full.matchAll(/"v":"religion_group:([a-z_0-9]+)"/g)].map(m => m[1]));
  for (const m of full.matchAll(/"k":"religion\.group","op":"[^"]*","v":"([a-z_0-9]+)"/g)) groups.add(m[1]);
  // religion tags (has_tag = protestant inside a religion scope): every religion carrying the tag is named
  for (const m of full.matchAll(/"k":"has_tag","op":"[^"]*","v":"([a-z_0-9]+)"/g)) for (const [r, tags] of EV.relTags) if (tags.has(m[1])) rels.add(r);
  if (!rels.size && !groups.size) return null;
  return { rels: [...rels].sort(), groups: [...groups].sort() };
});
function relClass(rel, info) {
  if (info.rels.includes(rel)) return rel;
  const g = REL_GROUP.get(rel);
  return g && info.groups.includes(g) ? g + '*' : '-';
}
function relRep(cls) { // a stand-in religion for a class
  if (cls === '-') return { r: '__other', g: '__other' };
  if (cls.endsWith('*')) return { r: '__other_' + cls.slice(0, -1), g: cls.slice(0, -1) };
  return { r: cls, g: REL_GROUP.get(cls) || null };
}
const relSensitive = []; relInfo.forEach((x, i) => { if (x) relSensitive.push(i); });
// Items whose result can change with the government type (directly or through a scripted trigger).
const GOV_KEYS = /"(government_type|has_tribal_government|has_reform)"/;
const govScripted = new Set();
for (let changed = true; changed;) {
  changed = false;
  for (const [name, body] of scriptedTriggers) {
    if (govScripted.has(name)) continue;
    const s = JSON.stringify(body);
    if (GOV_KEYS.test(s) || [...s.matchAll(/"k":"([a-z_0-9]+)"/g)].some(m => govScripted.has(m[1]))) { govScripted.add(name); changed = true; }
  }
}
const govSensitive = [];
gates.forEach((g, i) => {
  const s = JSON.stringify([g.blocks.map(b => b.b), g.extra, (g.conds || []).map(c => c.trig)]);
  if (GOV_KEYS.test(s) || [...s.matchAll(/"k":"([a-z_0-9]+)"/g)].some(m => govScripted.has(m[1]))) govSensitive.push(i);
});

// Pre-index items by referenced tags so tag-only gates are skipped quickly.
const NON_TAG_SPECIFIC = /"(culture|has_culture_group|culture_group|merged_culture_group_contains_culture|language|has_accepted_culture|has_primary_or_accepted_culture|dominant_culture|region|area|sub_continent|continent|province|province_definition|capital|original_capital|capital\.[a-z_]+|original_capital\.[a-z_]+|culture\.[a-z_.]+|this|location)"/;
const tagIndexCache = gates.map(g => {
  const s = JSON.stringify(g.blocks.map(b => b.b));
  const hasTag = /"(has_or_had_tag|tag|original_tag)"/.test(s);
  const nonTagSpecific = NON_TAG_SPECIFIC.test(s) || (g.cultures && g.cultures.length);
  const usesScripted = [...s.matchAll(/"k":"([a-z_0-9]+)"/g)].some(m => scriptedTriggers.has(m[1]));
  const tags = new Set([...s.matchAll(/"k":"(?:has_or_had_tag|tag|original_tag)","op":"[^"]*","v":"([A-Za-z0-9_]+)"/g)].map(m => m[1]));
  return { tagOnly: hasTag && !nonTagSpecific && !usesScripted, tags, scripted: usesScripted };
});

// Religion content: items whose gate checks religion and nothing country, culture or place specific (religion
// advances, religious actions, CBs and events). They are evaluated once per religion and government type (DATA.rc)
// instead of per country; each country's refs get the set of its start religion and government.
const relOnly = new Set();
gates.forEach((g, i) => {
  if (!relInfo[i] || (g.cultures && g.cultures.length)) return;
  const s = JSON.stringify(g.blocks.map(b => b.b)); const full = s + scriptedClosure(s);
  if (/"(has_or_had_tag|tag|original_tag)"/.test(full) || NON_TAG_SPECIFIC.test(full)) return;
  relOnly.add(i);
});

const countries = [];
for (const c of countriesRaw) {
  const ctx = ctxOf(c);
  const refs = [];
  const base = new Map();
  for (let i = 0; i < gates.length; i++) {
    const ix = tagIndexCache[i];
    if (relOnly.has(i)) continue;
    if (ix.tagOnly && !ix.tags.has(c.tag)) continue;
    const ref = refOf(i, ctx);
    if (ref) { refs.push(ref); base.set(i, JSON.stringify(ref)); }
  }
  // per-government differences: gx[gov] = refs that change ([i] = no longer available)
  const gx = {};
  for (const g of GOVS) {
    if (g === c.govType) continue;
    const ctx2 = Object.assign({}, ctx, { govType: g });
    const diff = [];
    for (const i of govSensitive) {
      if (relOnly.has(i)) continue;
      const ix = tagIndexCache[i];
      if (ix.tagOnly && !ix.tags.has(c.tag)) continue;
      const ref = refOf(i, ctx2); const b = base.get(i);
      if (!ref) { if (b) diff.push([i]); continue; }
      if (JSON.stringify(ref) !== b) diff.push(ref);
    }
    if (diff.length) gx[g] = diff;
  }
  // per-religion results: rx = [[i, {"gov|class": ref | 0}]], stored only where they differ from the
  // government-only result (refs + gx). "*|class" = same for every government.
  const gxMaps = {};
  for (const g of GOVS) { const m = new Map(); for (const r of gx[g] || []) m.set(r[0], r.length === 1 ? undefined : JSON.stringify(r)); gxMaps[g] = m; }
  const govSet = new Set(govSensitive);
  const rx = [];
  for (const i of relSensitive) {
    if (relOnly.has(i)) continue;
    const ix = tagIndexCache[i];
    if (ix.tagOnly && !ix.tags.has(c.tag)) continue;
    const info = relInfo[i];
    const startCls = relClass(c.religion, info);
    const classes = [...info.rels, ...info.groups.map(g => g + '*'), '-'].filter(k => k !== startCls);
    const govDep = govSet.has(i);
    const tab = {};
    for (const g of govDep ? GOVS : [c.govType]) {
      const govRes = g === c.govType || !gxMaps[g].has(i) ? base.get(i) : gxMaps[g].get(i);
      for (const cls of classes) {
        const rep = relRep(cls);
        const ref = refOf(i, Object.assign({}, ctx, { govType: g, religion: rep.r, religionGroup: rep.g }));
        const s = ref ? JSON.stringify(ref) : undefined;
        if (s !== govRes) tab[(govDep ? g : '*') + '|' + cls] = ref || 0;
      }
    }
    if (Object.keys(tab).length) rx.push([i, tab]);
  }
  countries.push({ c, refs, gx, rx });
}
// State religion: the religion's own definition_modifier, one item per religion. Each country gets the item of
// its start religion (via 'f'); the page swaps it when another religion is picked (religions[i][3]).
const relItem = new Map();
for (const [id, r] of RELIGION_DB) {
  if (!REL_GROUP.get(id)) continue;
  const fx = modifierLines(P.getAll(r.block, 'definition_modifier').flat());
  if (!fx.length) continue;
  relItem.set(id, items.length);
  items.push({ id, t: 'rel', n: nm(id), fx, x: nm(REL_GROUP.get(id)), m: modFlag(r), dlc: dlcName(r) });
}
// religious aspects: choices of a religion (it picks religions[i][3] of them), with visible / enabled triggers
DB.religious_aspects = P.loadDb(roots, 'religious_aspects');
const aspByRel = new Map();
for (const [id, r] of DB.religious_aspects) {
  const b = r.block;
  const fx = modifierLines(P.getAll(b, 'modifier').flat());
  const ai = items.length;
  items.push({ id, t: 'asp', n: nm(id), fx, d: descOf(id), m: modFlag(r), dlc: dlcName(r) });
  for (const rel of P.getAll(b, 'religion')) { const k = strip(rel); if (!aspByRel.has(k)) aspByRel.set(k, []); aspByRel.get(k).push({ i: ai, trig: [P.get(b, 'visible'), P.get(b, 'enabled')].filter(Array.isArray) }); }
}
const REL_ASPN = new Map(); for (const [id, r] of RELIGION_DB) { const n = SV.num(P.get(r.block, 'religious_aspects')); if (n) REL_ASPN.set(id, n); }
const CTYPE = (() => { const n = new Map(); for (const c of countriesRaw) if (c.ctype) n.set(c.ctype, (n.get(c.ctype) || 0) + 1); return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || null; })();
// rc[religion] = { refs: for a monarchy, gx: { gov: differences } } (same shapes as a country's refs / gx)
const rc = new Map(); const relOnlyList = [...relOnly];
for (const [R] of RELIGION_DB) {
  const G = REL_GROUP.get(R); if (!G) continue;
  const byGov = {};
  for (const g of GOVS) {
    const ctx = { tag: null, tags: new Set(), culture: null, groups: new Set(), accepted: new Set(), geo: null, religion: R, religionGroup: G, govType: g, govFixed: true, relFixed: true, isSubject: false, ctype: CTYPE, relHit: true };
    const refs = [];
    if (relItem.has(R)) refs.push([relItem.get(R), 'f']);
    for (const i of relOnlyList) { const ref = refOf(i, ctx); if (ref) refs.push(ref); }
    for (const a of aspByRel.get(R) || []) {
      let out = false; const res = [];
      for (const t of a.trig) { const r = EV.run(t, ctx, 'country'); if (r.v === F) { out = true; break; } if (r.v === U) res.push(...r.res); }
      if (out) continue;
      const cl = cleanRes(res, items[a.i]);
      refs.push(cl.length ? [a.i, 'f', cl.join('; ')] : [a.i, 'f']);
    }
    byGov[g] = refs;
  }
  const base = byGov.monarchy || [];
  const bmap = new Map(base.map(r => [r[0], JSON.stringify(r)]));
  const gx = {};
  for (const g of GOVS) {
    if (g === 'monarchy') continue;
    const cur = new Map(byGov[g].map(r => [r[0], r])); const diff = [];
    for (const [i] of bmap) if (!cur.has(i)) diff.push([i]);
    for (const [i, r] of cur) if (bmap.get(i) !== JSON.stringify(r)) diff.push(r);
    if (diff.length) gx[g] = diff;
  }
  if (base.length || Object.keys(gx).length) rc.set(R, { refs: base, gx });
}
function rcFor(R, g) {
  const x = rc.get(R); if (!x) return [];
  if (g === 'monarchy' || !x.gx[g]) return x.refs;
  const m = new Map(x.refs.map(r => [r[0], r]));
  for (const r of x.gx[g]) { if (r.length === 1) m.delete(r[0]); else m.set(r[0], r); }
  return [...m.values()];
}
for (const cc of countries) cc.refs.push(...rcFor(cc.c.religion, cc.c.govType || 'monarchy').map(r => r.slice()));
log(`religion content: ${relOnly.size} religion-gated items, ${DB.religious_aspects.size} aspects, ${rc.size} religions with content`);
log(`countries evaluated (${govSensitive.length} items re-checked per government type, ${relSensitive.length} per religion class)`);

// ---------------------------------------------------------------- formables
const formables = [];
const formIdx = new Map();
for (const [id, r] of DB.formable_countries) {
  const b = r.block;
  const tag = P.get(b, 'tag'); if (!tag) continue;
  const pot = P.get(b, 'potential');
  const req = [];
  for (const k of ['regions', 'areas', 'provinces', 'sub_continents', 'continents', 'locations']) {
    const v = P.get(b, k); if (Array.isArray(v)) { const ids = P.listValues(v); if (ids.length) req.push(humanize(k).replace(/s$/, '') + (ids.length > 1 ? 's' : '') + ': ' + ids.map(x => nm(x)).join(', ')); }
  }
  const frac = SV.num(P.get(b, 'required_locations_fraction'));
  const allowRes = EV.run(P.get(b, 'allow') || [], { tag: null, tags: new Set(), culture: null, groups: new Set(), accepted: new Set(), geo: null }, 'country').res;
  formIdx.set(id, formables.length);
  formables.push({ id, tag, n: nm(P.get(b, 'name') || tag), lvl: SV.num(P.get(b, 'level')) || undefined, req: req.join(' · ') || undefined, frac: frac != null ? Math.round(frac * 100) : undefined, allow: shortText([...new Set(allowRes)].join('; '), 400) || undefined, m: modFlag(r), pot, refs: [] });
}
// content gated on the formed tag (evaluated with an unknown culture so only tag checks count)
const formTags = new Map();
for (const f of formables) if (!formTags.has(f.tag)) formTags.set(f.tag, []);
for (const [tag] of formTags) {
  const ctx = { tag, tags: new Set([tag]), culture: null, groups: new Set(), accepted: new Set(), geo: null };
  const refs = [];
  for (let i = 0; i < gates.length; i++) {
    const ix = tagIndexCache[i];
    if (!ix.tags.has(tag) && !ix.scripted) continue;
    const r = evalGate(gates[i], ctx);
    if (!r || !r.hits.has('tag')) continue;
    refs.push(r.res.length ? [i, 't', r.res.join('; ')] : [i, 't']);
  }
  formTags.set(tag, refs);
}
for (const f of formables) f.refs = formTags.get(f.tag) || [];
// which formables each country can pursue
for (const cc of countries) {
  // formables keep religion and government as "Needs" text: the selectors don't re-evaluate them
  const ctx = Object.assign(ctxOf(cc.c), { govFixed: false, relFixed: false });
  cc.forms = [];
  for (let i = 0; i < formables.length; i++) {
    const f = formables[i];
    if (f.tag === cc.c.tag) continue;
    if (!f.pot) continue;
    const r = EV.run(f.pot, ctx, 'country');
    if (r.v === F || !r.hits.size) continue;
    cc.forms.push(r.res.length ? [i, r.res.join('; ')] : [i]);
  }
}
log('formables resolved');

// ---------------------------------------------------------------- output
const usedItems = new Set();
for (const cc of countries) for (const r of cc.refs) usedItems.add(r[0]);
for (const cc of countries) for (const g in cc.gx) for (const r of cc.gx[g]) usedItems.add(r[0]);
for (const cc of countries) for (const [i] of cc.rx) usedItems.add(i);
for (const f of formables) for (const r of f.refs) usedItems.add(r[0]);
for (const x of rc.values()) { for (const r of x.refs) usedItems.add(r[0]); for (const g in x.gx) for (const r of x.gx[g]) usedItems.add(r[0]); }
const shareCount = new Map();
for (const cc of countries) for (const r of cc.refs) shareCount.set(r[0], (shareCount.get(r[0]) || 0) + 1);
const remap = new Map(); const outItems = [];
for (let i = 0; i < items.length; i++) if (usedItems.has(i)) {
  remap.set(i, outItems.length); const it = items[i]; it.k = shareCount.get(i) || 0;
  if (relInfo[i]) it.rl = [relInfo[i].rels, relInfo[i].groups]; // religion classes, see relClass()
  outItems.push(it);
}
const fixRefs = refs => refs.map(r => { const x = r.slice(); x[0] = remap.get(r[0]); return x; });

// Structured modifier values for the totals panel: item.mv = [[modIdx, scopeIdx, value]] (unconditional),
// item.mc = [[modIdx, scopeIdx, value, condIdx]] (only when condition item.cd[condIdx] holds; its state per
// country is ref[3][condIdx]). Only content whose modifiers apply directly; unlocked sub-items, units,
// decisions and events are left out.
const SUM_TYPES = new Set(['adv', 'ref', 'priv', 'pol', 'bur', 'bld', 'cab', 'rel', 'asp']);
const modTable = [], modIdx = new Map(), scopeTable = [], scopeIdx = new Map();
for (const it of outItems) {
  if (!SUM_TYPES.has(it.t)) continue;
  const mv = [], mc = [];
  for (const l of it.fx || []) {
    if (!l._m) continue;
    const [k, p, v, ci] = l._m;
    if (!modIdx.has(k)) {
      const def = MT.get(k) || {};
      modIdx.set(k, modTable.length);
      modTable.push([L.T('MODIFIER_TYPE_NAME_' + k) || humanize(k), def.boolean || v === true ? 'b' : def.percent ? 'p' : def.already ? 'a' : 'n', def.decimals != null ? def.decimals : 2, def.color === 'bad' ? -1 : def.color === 'neutral' ? 0 : 1]);
    }
    if (!scopeIdx.has(p)) { scopeIdx.set(p, scopeTable.length); scopeTable.push(p); }
    const e = [modIdx.get(k), scopeIdx.get(p), v === true ? 1 : Math.round(v * 1e6) / 1e6];
    if (ci == null) mv.push(e); else mc.push([...e, ci]);
  }
  if (mv.length) it.mv = mv;
  if (mc.length) it.mc = mc;
}

const geoName = id => id ? nm(id) : null;
const data = {
  generated: new Date().toISOString().slice(0, 10),
  version: (() => { try { return JSON.parse(fs.readFileSync(path.join(MOD, '.metadata/metadata.json'), 'utf8')).version || null; } catch (e) { return null; } })(),
  items: outItems,
  mods: modTable,
  scopes: scopeTable,
  formables: formables.map(f => ({ tag: f.tag, n: f.n, lvl: f.lvl, req: f.req, frac: f.frac, allow: f.allow, m: f.m, refs: fixRefs(f.refs) })),
  govs: GOVS.map(g => [g, nm(g, 'government_type_')]),
  religions: [...RELIGION_DB.keys()].filter(r => REL_GROUP.get(r)).map(r => REL_ASPN.has(r) ? [r, nm(r), REL_GROUP.get(r), REL_ASPN.get(r)] : [r, nm(r), REL_GROUP.get(r)]),
  rc: Object.fromEntries([...rc].map(([R, x]) => [R, Object.keys(x.gx).length ? { refs: fixRefs(x.refs), gx: Object.fromEntries(Object.entries(x.gx).map(([g, d]) => [g, fixRefs(d)])) } : { refs: fixRefs(x.refs) }])),
  rgroups: [...new Set(REL_GROUP.values())].filter(Boolean).map(g => [g, nm(g)]),
  countries: countries.map(({ c, refs, gx, rx, forms }) => ({
    tag: c.tag, n: nm(c.tag), cap: c.capital ? nm(c.capital) : null,
    reg: c.geo ? geoName(c.geo.region) : null, sub: c.geo ? geoName(c.geo.sub_continent) : null, area: c.geo ? geoName(c.geo.area) : null,
    cul: c.culture ? nm(c.culture) : null, grp: c.groups.map(g => nm(g)), lang: c.language ? nm(c.language) : null,
    rel: c.religion ? nm(c.religion) : null, gov: c.govType ? nm(c.govType, 'government_type_') : null, rank: c.rank ? nm(c.rank) : null,
    locs: c.locCount, ovl: c.overlord ? { tag: c.overlord.tag, n: nm(c.overlord.tag), t: nm(c.overlord.type) } : null,
    gk: c.govType || null,
    refs: fixRefs(refs.filter(r => r[1] !== 'f')), forms, // religion content (via 'f') lives in rc[rk]
    gx: Object.keys(gx).length ? Object.fromEntries(Object.entries(gx).map(([g, d]) => [g, fixRefs(d)])) : undefined,
    rk: c.religion || null,
    rx: rx.length ? rx.map(([i, tab]) => [remap.get(i), Object.fromEntries(Object.entries(tab).map(([k, r]) => [k, r ? fixRefs([r])[0] : 0]))]) : undefined,
  })),
  stats: {},
};
data.stats = {
  countries: data.countries.length, items: outItems.length, totalItems: items.length,
  modItems: outItems.filter(i => i.m).length,
  unattachedModItems: items.filter((it, i) => it.m && !usedItems.has(i)).map(it => it.t + ':' + it.id),
};
if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify(data, null, 1));
const tpl = fs.readFileSync(path.join(__dirname, 'template.html'), 'utf8');
const json = JSON.stringify(data).replace(/</g, '\\u003c');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, tpl.replace('/*__DATA__*/null', json));
log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB): ${data.countries.length} countries, ${outItems.length} items, ${formables.length} formables`);
log(`mod items not attached to any start country or formable: ${data.stats.unattachedModItems.length}`);
