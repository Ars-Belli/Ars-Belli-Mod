'use strict';
// Minimal Paradox (Jomini) script parser + layered loader (vanilla -> DLC -> mod).
// A block is an array of entries: { k, op, v } where v is a string or a block
// (array). Bare list items have k = null. Tagged values like `rgb { 1 2 3 }`
// become { k, op, v: block, tag: 'rgb' }.
const fs = require('fs');
const path = require('path');

function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  if (src.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '{' || c === '}') { toks.push(c); i++; continue; }
    if (c === '"') {
      let j = i + 1; let s = '';
      while (j < n && src[j] !== '"') { if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; continue; } s += src[j++]; }
      toks.push({ q: s }); i = j + 1; continue;
    }
    if (c === '=' || c === '<' || c === '>' || c === '!' || c === '?') {
      if (src[i + 1] === '=') { toks.push({ op: c + '=' }); i += 2; continue; }
      if (c === '!' ) { i++; continue; }
      toks.push({ op: c }); i++; continue;
    }
    if (c === '@' && src[i + 1] === '[') { // inline math @[ ... ]
      let j = i + 2; let depth = 1;
      while (j < n && depth > 0) { if (src[j] === '[') depth++; else if (src[j] === ']') depth--; j++; }
      toks.push(src.slice(i, j)); i = j; continue;
    }
    let j = i;
    while (j < n) {
      const d = src[j];
      if (d === ' ' || d === '\t' || d === '\r' || d === '\n' || d === '{' || d === '}' || d === '=' || d === '#' || d === '"' || d === '<' || d === '>') break;
      if ((d === '!' || d === '?') && src[j + 1] === '=') break;
      j++;
    }
    if (j === i) { i++; continue; }
    toks.push(src.slice(i, j)); i = j;
  }
  return toks;
}

function parse(src) {
  const toks = tokenize(src);
  let p = 0;
  function val(t) { return typeof t === 'string' ? t : (t && t.q !== undefined ? t.q : t); }
  function parseBlock(top) {
    const out = [];
    while (p < toks.length) {
      const t = toks[p];
      if (t === '}') { p++; if (!top) return out; continue; }
      if (t === '{') { p++; out.push({ k: null, op: null, v: parseBlock(false) }); continue; }
      if (t && t.op) { p++; continue; } // stray operator
      const key = val(t); p++;
      const nx = toks[p];
      if (nx && nx.op) {
        p++;
        const vt = toks[p];
        if (vt === '{') { p++; out.push({ k: key, op: nx.op, v: parseBlock(false) }); continue; }
        p++;
        const v = val(vt);
        if (toks[p] === '{' && typeof vt === 'string' && /^(rgb|hsv|hsv360|LIST)$/i.test(vt)) {
          p++; out.push({ k: key, op: nx.op, v: parseBlock(false), tag: vt }); continue;
        }
        out.push({ k: key, op: nx.op, v: v === undefined ? '' : v });
        continue;
      }
      if (nx === '{' && typeof t === 'string' && /^(rgb|hsv|hsv360)$/i.test(t)) { p++; out.push({ k: null, op: null, v: parseBlock(false), tag: t }); continue; }
      out.push({ k: null, op: null, v: key });
    }
    return out;
  }
  return parseBlock(true);
}

function readText(file) { return fs.readFileSync(file, 'utf8'); }
function parseFile(file) { return parse(readText(file)); }

// helpers on blocks
function get(block, key) { if (!Array.isArray(block)) return undefined; for (const e of block) if (e.k === key) return e.v; return undefined; }
function getAll(block, key) { const r = []; if (!Array.isArray(block)) return r; for (const e of block) if (e.k === key) r.push(e.v); return r; }
function has(block, key) { return Array.isArray(block) && block.some(e => e.k === key); }
function listValues(block) { return Array.isArray(block) ? block.filter(e => e.k === null && typeof e.v === 'string').map(e => e.v) : []; }

function serialize(v, ind = '') {
  if (!Array.isArray(v)) return String(v);
  return '{ ' + v.map(e => (e.k === null ? '' : e.k + ' ' + e.op + ' ') + (e.tag ? e.tag + ' ' : '') + serialize(e.v)).join(' ') + ' }';
}

function walkFiles(dir, pred, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(f, pred, out);
    else if (!pred || pred(f)) out.push(f);
  }
  return out;
}

// Layered database loading for in_game/common/<sub> (or main_menu/common/<sub>).
// Returns Map id -> { id, block, file, source: 'vanilla'|'dlc'|'mod', dlc, modStatus: null|'new'|'replaced'|'injected'|'file_override' }
function loadDb(roots, sub, opts = {}) {
  const { VANILLA, DLC_DIRS, MOD } = roots;
  const layer = opts.layer || 'in_game';
  const files = new Map(); // relative filename (within dir) -> {file, source, dlc}
  const addDir = (base, source, dlc) => {
    const d = path.join(base, layer, 'common', sub);
    for (const f of walkFiles(d, x => x.endsWith('.txt'))) {
      const rel = path.relative(d, f).replace(/\\/g, '/');
      const prev = files.get(rel);
      files.set(rel, { file: f, source, dlc, overrides: prev || null });
    }
  };
  addDir(VANILLA, 'vanilla', null);
  for (const dd of DLC_DIRS) addDir(dd.dir, 'dlc', dd.name);
  addDir(MOD, 'mod', null);
  const order = [...files.keys()].sort((a, b) => a.localeCompare(b));
  const db = new Map();
  const vanillaCopy = new Map(); // id -> serialized vanilla version for comparing same-name file overrides
  // first pass: remember vanilla serialization for ids in overridden files
  for (const rel of order) {
    const fe = files.get(rel);
    if (fe.source === 'mod' && fe.overrides) {
      try { for (const e of parseFile(fe.overrides.file)) if (e.k && Array.isArray(e.v)) vanillaCopy.set(e.k, serialize(e.v)); } catch (err) { /* ignore */ }
    }
  }
  // Plain definitions load first (filename order); REPLACE:/INJECT: overrides apply afterwards,
  // so an override in abm_byz.txt still lands on the definition from byz.txt.
  const parsed = [];
  for (const rel of order) {
    const fe = files.get(rel);
    try { parsed.push({ fe, rel, blk: parseFile(fe.file) }); } catch (err) { console.warn('parse fail', fe.file, err.message); }
  }
  const OVR = /^(REPLACE_OR_CREATE|INJECT_OR_CREATE|TRY_REPLACE|TRY_INJECT|REPLACE|INJECT):(.+)$/;
  const queue = [];
  for (const pass of [0, 1]) for (const p of parsed) for (const e of p.blk) {
    if (!e.k || !Array.isArray(e.v)) continue;
    if ((pass === 0) === OVR.test(e.k)) continue;
    queue.push({ fe: p.fe, rel: p.rel, e });
  }
  for (const { fe, rel, e } of queue) {
    {
      let key = e.k; let mode = 'define';
      const m = OVR.exec(key);
      if (m) { mode = m[1]; key = m[2]; }
      const prev = db.get(key);
      const rec = { id: key, block: e.v, file: fe.file, rel, source: fe.source, dlc: fe.dlc, modStatus: null };
      if (mode === 'define') {
        if (fe.source === 'mod') {
          if (fe.overrides && vanillaCopy.has(key)) rec.modStatus = vanillaCopy.get(key) === serialize(e.v) ? null : 'file_override';
          else if (prev && prev.source !== 'mod') rec.modStatus = 'replaced';
          else rec.modStatus = 'new';
          if (fe.overrides && vanillaCopy.has(key) && rec.modStatus === null) rec.source = 'vanilla';
        }
        db.set(key, rec);
      } else if (mode === 'REPLACE' || mode === 'TRY_REPLACE' || mode === 'REPLACE_OR_CREATE') {
        if (!prev && mode !== 'REPLACE_OR_CREATE' && mode !== 'REPLACE') continue;
        rec.modStatus = fe.source === 'mod' ? (prev ? 'replaced' : 'new') : null;
        if (prev && fe.source !== 'mod') rec.source = prev.source;
        rec.vanillaBlock = prev ? prev.block : null;
        db.set(key, rec);
      } else { // INJECT
        if (!prev) { if (mode === 'INJECT_OR_CREATE') { rec.modStatus = fe.source === 'mod' ? 'new' : null; db.set(key, rec); } continue; }
        const merged = Object.assign({}, prev, { block: prev.block.concat(e.v) });
        if (fe.source === 'mod') { merged.modStatus = prev.modStatus === 'new' ? 'new' : (prev.modStatus || 'injected'); merged.injectFile = fe.file; }
        db.set(key, merged);
      }
    }
  }
  return db;
}

// Localisation: key -> text. Later layers override earlier ones; files in a `replace` folder win.
function loadLoc(roots) {
  const { VANILLA, DLC_DIRS, MOD } = roots;
  const loc = new Map();
  const dirs = [path.join(VANILLA, 'main_menu/localization/english'), path.join(VANILLA, 'in_game/localization/english')];
  for (const dd of DLC_DIRS) { dirs.push(path.join(dd.dir, 'main_menu/localization/english')); dirs.push(path.join(dd.dir, 'in_game/localization/english')); }
  dirs.push(path.join(MOD, 'main_menu/localization/english'));
  dirs.push(path.join(MOD, 'in_game/localization/english'));
  const replaceFiles = [];
  for (const d of dirs) {
    for (const f of walkFiles(d, x => x.endsWith('.yml')).sort()) {
      if (/[\\/]replace[\\/]/.test(f)) { replaceFiles.push(f); continue; }
      readLocFile(f, loc);
    }
  }
  for (const f of replaceFiles) readLocFile(f, loc);
  return loc;
}
function readLocFile(f, loc) {
  const txt = readText(f);
  const re = /^\s*([A-Za-z0-9_.\-']+):\d*\s*"(.*)"\s*(#.*)?$/;
  for (const line of txt.split(/\r?\n/)) {
    const m = re.exec(line);
    if (m) loc.set(m[1], m[2]);
  }
}

module.exports = { tokenize, parse, parseFile, readText, get, getAll, has, listValues, serialize, walkFiles, loadDb, loadLoc };
