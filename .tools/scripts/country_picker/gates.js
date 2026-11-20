'use strict';
// Three-valued trigger evaluation against a static 1337 country profile.
// T = true, F = false, U = unknown (depends on game state: religion, reforms, flags...).
// A piece of content is attached to a country when its gate is not F AND at least one
// "specific" check (tag / culture / culture group / language / capital geography)
// evaluated true with positive polarity — see Evaluator.attach().
const P = require('./pdx');
const { humanize } = require('./world');

const T = 1, F = 0, U = 2;

function strip(v) { return typeof v === 'string' ? v.replace(/^[a-z_]+:/, '') : v; }

class Evaluator {
  constructor({ loc, scriptedTriggers, cultures, reformGov }) {
    this.loc = loc;
    this.st = scriptedTriggers; // Map name -> block
    this.cultures = cultures;
    this.reformGov = reformGov || new Map(); // reform id -> government type it belongs to
    this.relTags = new Map(); // religion id -> Set of its tags and custom_tags
  }

  // ---- helpers -------------------------------------------------------
  nm(id, prefix) {
    const k = strip(id);
    return this.loc.T(k) || this.loc.T((prefix || '') + k) || humanize(k);
  }

  geoVal(ctx, kind, which) { // which: capital/original_capital (same at start)
    const g = ctx.geo; if (!g) return null;
    return g[kind] || null;
  }

  // ---- public API ----------------------------------------------------
  // returns { v, res: [strings], hits: Set(kind) }
  run(block, ctx, scope = 'country') {
    this.hits = new Set();
    this.hitTags = new Set();
    if (!Array.isArray(block) || block.length === 0) return { v: T, res: [], hits: this.hits, hitTags: this.hitTags };
    const r = this.and(block, ctx, scope, true, 0);
    return { v: r.v, res: r.res, hits: new Set(this.hits), hitTags: new Set(this.hitTags) };
  }

  and(entries, ctx, scope, pos, d) {
    let anyU = false; const res = [];
    for (const e of entries) {
      const r = this.atom(e, ctx, scope, pos, d);
      if (r.v === F) return { v: F, res: [] };
      if (r.v === U) { anyU = true; if (r.res) res.push(...r.res); }
    }
    return anyU ? { v: U, res } : { v: T, res: [] };
  }

  or(entries, ctx, scope, pos, d) {
    const us = [];
    let anyU = false;
    for (const e of entries) {
      const r = this.atom(e, ctx, scope, pos, d);
      if (r.v === T) return { v: T, res: [] };
      if (r.v === U) { anyU = true; if (r.res && r.res.length) us.push(r.res.join(' and ')); }
    }
    if (!anyU) return { v: F, res: [] };
    if (us.length <= 1) return { v: U, res: us };
    return { v: U, res: ['one of: ' + us.join(' / ')] };
  }

  not(r) {
    if (r.v === T) return { v: F, res: [] };
    if (r.v === F) return { v: T, res: [] };
    return { v: U, res: r.res && r.res.length ? ['not ' + (r.res.length > 1 ? '(' + r.res.join(' and ') + ')' : r.res[0])] : [] };
  }

  // a positive religion check is the specific hit of religion content (ctx.relHit: the per-religion table)
  relHit(ctx, op, pos) { return ctx.relHit && op !== '!=' ? this.hit('religion', T, pos) : T; }
  hit(kind, v, pos, tag) { if (v === T && pos && !this._neq) { this.hits.add(kind); if (tag) this.hitTags.add(tag); } return v; }

  cmp(op, a, b) { // a: actual (string|null), b: expected
    if (a == null) return U;
    const eq = String(a) === String(b);
    if (op === '!=') return eq ? F : T;
    return eq ? T : F;
  }

  expandScripted(name, val, ctx, scope, pos, d) {
    let body = this.st.get(name);
    if (val && Array.isArray(val)) { // parameters
      const params = {};
      for (const e of val) if (e.k) params[e.k] = typeof e.v === 'string' ? e.v : '';
      const sub = (b) => b.map(e => ({ k: typeof e.k === 'string' ? e.k.replace(/\$([A-Za-z0-9_]+)\$/g, (m, p) => params[p] ?? m) : e.k, op: e.op, v: Array.isArray(e.v) ? sub(e.v) : (typeof e.v === 'string' ? e.v.replace(/\$([A-Za-z0-9_]+)\$/g, (m, p) => params[p] ?? m) : e.v), tag: e.tag }));
      body = sub(body);
      return this.and(body, ctx, scope, pos, d + 1);
    }
    if (val === 'no') return this.not(this.and(body, ctx, scope, !pos, d + 1));
    return this.and(body, ctx, scope, pos, d + 1);
  }

  unknown(text) { return { v: U, res: text ? [text] : [] }; }

  // ---- atoms ---------------------------------------------------------
  atom(e, ctx, scope, pos, d) {
    if (d > 40) return this.unknown(null);
    let k = e.k; const op = e.op; const v = e.v;
    this._neq = op === '!=';
    if (k == null) return { v: T, res: [] };
    const lk = k.toLowerCase();
    // logic
    if (lk === 'and') return Array.isArray(v) ? this.and(v, ctx, scope, pos, d + 1) : { v: T, res: [] };
    if (lk === 'or') return Array.isArray(v) ? this.or(v, ctx, scope, pos, d + 1) : { v: T, res: [] };
    if (lk === 'not' || lk === 'nor') return Array.isArray(v) ? this.not(this.or(v, ctx, scope, !pos, d + 1)) : { v: T, res: [] };
    if (lk === 'nand') return Array.isArray(v) ? this.not(this.and(v, ctx, scope, !pos, d + 1)) : { v: T, res: [] };
    if (k === 'trigger_if' || k === 'trigger_else_if') {
      if (!Array.isArray(v)) return { v: T, res: [] };
      const lim = P.get(v, 'limit');
      const rest = v.filter(x => x.k !== 'limit');
      const lr = lim ? this.and(lim, ctx, scope, pos, d + 1) : { v: T };
      if (lr.v === F) return { v: T, res: [] };
      const rr = this.and(rest, ctx, scope, pos, d + 1);
      if (lr.v === T) return rr;
      return rr.v === T ? { v: T, res: [] } : { v: U, res: rr.res };
    }
    if (k === 'trigger_else') return { v: T, res: [] };
    if (k === 'custom_tooltip' || k === 'hidden_trigger' || k === 'custom_description') {
      if (!Array.isArray(v)) return { v: T, res: [] };
      const inner = v.filter(x => x.k !== 'text' && x.k !== 'subject' && x.k !== 'object' && x.k !== 'value');
      const r = this.and(inner, ctx, scope, pos, d + 1);
      if (r.v === U && k === 'custom_tooltip') {
        const t = P.get(v, 'text'); const raw = t ? this.loc.raw(t) : null;
        const tt = raw && !raw.includes('[') ? this.loc.T(t) : null; // texts with live data read badly once stripped
        if (tt) return { v: U, res: [tt] };
      }
      return r;
    }
    if (k === 'always') return { v: v === 'yes' ? T : (v === 'no' ? F : U), res: [] };
    if (k === 'has_dlc' || k === 'exists' || k === 'is_ai') return { v: k === 'is_ai' ? U : T, res: [] };
    if (k === 'text' || k === 'limit' || k === 'count' || k === 'percent') return { v: T, res: [] };

    // scripted triggers
    if (this.st.has(k)) return this.expandScripted(k, v, ctx, scope, pos, d);

    // dotted keys: capital.region, culture.language, original_capital.area, religion.group ...
    if (k.includes('.') && !k.includes(':')) {
      const parts = k.split('.');
      const head = parts[0];
      const tail = parts.slice(1);
      if (head === 'capital' || head === 'original_capital' || head === 'root' || head === 'scope:actor' || head === 'this') {
        if (head === 'root' || head === 'this') return this.atom({ k: tail.join('.'), op, v }, ctx, scope === 'location' ? 'location' : 'country', pos, d + 1);
        if (head === 'scope:actor') return this.atom({ k: tail.join('.'), op, v }, ctx, 'country', pos, d + 1);
        return this.atom({ k: tail.join('.'), op, v }, ctx, 'location', pos, d + 1);
      }
      if (head === 'culture' || head === 'primary_culture') {
        if (tail[0] === 'language' && tail.length === 1) return { v: this.hit('language', this.cmp(op, ctx.culture ? ctx.language : null, strip(v)), pos), res: ctx.culture ? [] : ['Language: ' + this.nm(v)] };
        if (tail[0] === 'language' && tail[1] === 'language_family') return { v: this.hit('language', this.cmp(op, ctx.culture ? ctx.family : null, strip(v)), pos), res: ctx.culture ? [] : ['Language family: ' + this.nm(v)] };
        if (tail[0] === 'dialect') return { v: this.hit('language', this.cmp(op, ctx.culture ? ctx.language : null, strip(v)), pos), res: [] };
        if (tail[0] === 'culture_group') return this.atom({ k: 'has_culture_group', op, v }, ctx, 'culture', pos, d + 1);
        return this.unknown(humanize(k) + ': ' + this.nm(v));
      }
      if (head === 'religion' && tail[0] === 'group') {
        if (ctx.religionGroup && this.cmp(op, ctx.religionGroup, strip(v)) === T) return { v: this.relHit(ctx, op, pos), res: [] };
        if (ctx.religionGroup && ctx.relFixed) return { v: F, res: [] };
        return this.unknown('Religion group: ' + this.nm(v));
      }
      if (head === 'religion' || head === 'dominant_religion') return this.unknown('Religion: ' + this.nm(v));
      return this.unknown(humanize(k) + (typeof v === 'string' ? ': ' + this.nm(v) : ''));
    }

    // scope switches
    if (Array.isArray(v)) {
      if (k === 'capital' || k === 'original_capital' || k === 'capital_scope') return this.and(v, ctx, 'location', pos, d + 1);
      if (k === 'culture' || k === 'primary_culture') return this.and(v, ctx, 'culture', pos, d + 1);
      if (k === 'scope:actor' || k === 'root' || k === 'this' || k === 'scope:recipient' && false) return this.and(v, ctx, 'country', pos, d + 1);
      if (k === 'owner' && scope === 'location') return this.and(v, ctx, 'country', pos, d + 1);
      if (k === 'religion') return this.and(v, ctx, 'religion', pos, d + 1);
      if (k === 'dominant_religion') return this.unknown(null);
      // other scopes / iterators -> unknown
      return this.unknown(this.describeScope(k, v));
    }

    const val = strip(v);
    if (typeof v === 'string' && (/^(scope:|root\b|prev\b|this\b|from\b)/.test(v) || (v.includes('.') && !/^[-\d.]+$/.test(v)))) return this.unknown(null);
    // ---- state known at start (not specific): religion, government ----
    // ctx.relFixed: the religion is the one the reader picked, so religion checks decide (T/F)
    if ((k === 'religion' && scope !== 'location') || (scope === 'religion' && k === 'this')) {
      if (ctx.religion && this.cmp(op, ctx.religion, val) === T) return { v: this.relHit(ctx, op, pos), res: [] };
      if (ctx.religion && ctx.relFixed) return { v: F, res: [] };
      return this.unknown((op === '!=' ? 'not ' : '') + 'Religion: ' + this.nm(val));
    }
    // ctx.govFixed: the government type is the one the reader picked, so it decides (T/F) instead of becoming a condition
    if (k === 'government_type') {
      if (ctx.govType && this.cmp(op, ctx.govType, val) === T) return { v: T, res: [] };
      if (ctx.govType && ctx.govFixed) return { v: F, res: [] };
      return this.unknown((op === '!=' ? 'not ' : '') + 'Government: ' + this.nm(val, 'government_type_'));
    }
    if (k === 'has_tribal_government' && ctx.govType) {
      const isTribe = ctx.govType === 'tribe';
      if ((v === 'yes') === isTribe) return { v: T, res: [] };
      if (ctx.govFixed) return { v: F, res: [] };
      return this.unknown(v === 'yes' ? 'Tribal government' : 'Not tribal');
    }
    if (k === 'has_reform' && typeof v === 'string') {
      // a reform tied to another government type can't be held under the picked one
      const rg = this.reformGov.get(val);
      if (ctx.govFixed && ctx.govType && rg && rg !== ctx.govType) return { v: op === '!=' ? T : F, res: [] };
      return this.unknown((op === '!=' ? 'not ' : '') + 'Reform: ' + this.nm(val));
    }
    if (k === 'is_subject' && ctx.isSubject != null) {
      if ((v === 'yes') === ctx.isSubject) return { v: T, res: [] };
      return this.unknown(v === 'yes' ? 'Is a subject' : 'Not a subject');
    }
    if (k === 'country_type' && ctx.ctype) {
      if (this.cmp(op, ctx.ctype, val) === T) return { v: T, res: [] };
      const CT = { location: 'Settled country', building: 'Building-based country', army: 'Army-based country', pop: 'Society of pops' };
      return this.unknown((op === '!=' ? 'not ' : '') + (CT[val] || 'Country type: ' + this.nm(val)));
    }
    if (scope === 'religion' && k === 'has_tag' && typeof v === 'string') {
      // religion tags (e.g. is_protestant = religion has the protestant tag)
      if (ctx.religion && this.relTags.has(ctx.religion)) {
        let r = this.relTags.get(ctx.religion).has(val) ? T : F; if (op === '!=') r = r === T ? F : T;
        if (r === T) return { v: this.relHit(ctx, op, pos), res: [] };
        if (ctx.relFixed) return { v: F, res: [] };
      }
      return this.unknown((op === '!=' ? 'not ' : '') + 'Religion tag: ' + humanize(val));
    }
    if (scope === 'religion' && (k === 'group' || k === 'religion_group')) {
      if (ctx.religionGroup && this.cmp(op, ctx.religionGroup, val) === T) return { v: this.relHit(ctx, op, pos), res: [] };
      if (ctx.religionGroup && ctx.relFixed) return { v: F, res: [] };
      return this.unknown('Religion group: ' + this.nm(val));
    }
    // ---- specific checks ----
    if (ctx.blank && (k === 'has_or_had_tag' || k === 'original_tag' || (k === 'tag' && scope === 'country'))) {
      return this.unknown((op === '!=' ? 'not ' : '') + 'Country: ' + this.nm(val));
    }
    if (k === 'has_or_had_tag' || k === 'original_tag') {
      const r = (ctx.tags.has(val) ? T : F); return { v: this.hit('tag', op === '!=' ? (r === T ? F : T) : r, pos, val), res: [] };
    }
    if (k === 'tag' && scope === 'country') {
      const r = ctx.tag === val ? T : F; return { v: this.hit('tag', op === '!=' ? (r === T ? F : T) : r, pos, val), res: [] };
    }
    if (k === 'country_exists' || k === 'is_tag_alive') return this.unknown(null);

    if (scope === 'country' || scope === 'culture') {
      if (k === 'culture' || (scope === 'culture' && (k === 'this' || k === 'culture'))) {
        if (!ctx.culture) return { v: U, res: ['Culture: ' + this.nm(val)] };
        return { v: this.hit('culture', this.cmp(op, ctx.culture, val), pos), res: [] };
      }
      if (k === 'has_culture_group' || k === 'culture_group') {
        if (!ctx.culture) return { v: U, res: ['Culture group: ' + this.nm(val)] };
        const r = ctx.groups.has(val) ? T : F;
        return { v: this.hit('group', op === '!=' ? (r === T ? F : T) : r, pos), res: [] };
      }
      if (k === 'merged_culture_group_contains_culture') {
        if (!ctx.culture) return { v: U, res: [] };
        return { v: this.hit('culture', ctx.culture === val ? T : F, pos), res: [] };
      }
      if (k === 'language' && scope === 'culture') {
        if (!ctx.culture) return { v: U, res: ['Language: ' + this.nm(val)] };
        return { v: this.hit('language', this.cmp(op, ctx.language, val), pos), res: [] };
      }
      if (k === 'has_accepted_culture' || k === 'has_primary_or_accepted_culture') {
        if (!ctx.culture) return { v: U, res: ['Accepted culture: ' + this.nm(val)] };
        if (ctx.culture === val || ctx.accepted.has(val)) return { v: this.hit('culture', T, pos), res: [] };
        return { v: U, res: ['Accepted culture: ' + this.nm(val)] };
      }
      if (k === 'court_language') return { v: U, res: ['Court language: ' + this.nm(val)] };
    }
    if (scope === 'location') {
      if (['region', 'area', 'sub_continent', 'continent', 'province', 'province_definition'].includes(k)) {
        const kind = k === 'province_definition' ? 'province' : k;
        if (!ctx.geo) return { v: U, res: [humanize(kind) + ': ' + this.nm(val)] };
        return { v: this.hit(kind === 'continent' ? 'wide' : 'region', this.cmp(op, ctx.geo[kind], val), pos), res: [] };
      }
      if (k === 'this' || k === 'location') {
        if (!ctx.geo) return { v: U, res: [] };
        return { v: this.hit('region', this.cmp(op, ctx.geo.location, val), pos), res: [] };
      }
      if (k === 'dominant_culture' || k === 'culture') {
        if (!ctx.culture) return { v: U, res: ['Local culture: ' + this.nm(val)] };
        return { v: this.hit('culture', this.cmp(op, ctx.culture, val), pos), res: [] };
      }
    }
    if ((k === 'capital' || k === 'original_capital') && scope === 'country') {
      if (!ctx.geo) return { v: U, res: [] };
      return { v: this.hit('region', this.cmp(op, ctx.geo.location, val), pos), res: [] };
    }
    if (scope === 'country' && ['region', 'area', 'sub_continent', 'continent'].includes(k)) { // some scripts check geography on the country (= capital)
      if (!ctx.geo) return { v: U, res: [] };
      return { v: this.hit(k === 'continent' ? 'wide' : 'region', this.cmp(op, ctx.geo[k], val), pos), res: [] };
    }
    return this.unknown(this.describe(k, op, v));
  }

  describeScope(k, v) {
    const m = /^(any|every|random)_(.+)$/.exec(k);
    if (m) return null; // iterators: too detailed to show
    return null;
  }

  describe(k, op, v) {
    const val = strip(v);
    const o = op === '=' || op === '?=' || op === '==' ? '' : ' ' + op + ' ';
    const neg = v === 'no';
    switch (k) {
      case 'religion': return 'Religion: ' + this.nm(val);
      case 'government_type': return 'Government: ' + this.nm(val, 'government_type_');
      case 'has_reform': return 'Reform: ' + this.nm(val);
      case 'has_advance': return 'Advance: ' + this.nm(val);
      case 'has_estate_privilege': return 'Privilege: ' + this.nm(val);
      case 'has_policy': return 'Policy: ' + this.nm(val);
      case 'has_law': return 'Law: ' + this.nm(val);
      case 'country_has_estate': return 'Has estate: ' + this.nm(val);
      case 'has_embraced_institution': case 'has_institution': return 'Institution: ' + this.nm(val);
      case 'is_subject': return neg ? 'Not a subject' : 'Is a subject';
      case 'is_subject_type': return 'Subject type: ' + this.nm(val);
      case 'owns': return 'Owns ' + this.nm(val);
      case 'has_variable': case 'has_global_variable': return null; // internal flags
      case 'has_unlocked_government_reform_trigger': case 'has_unlocked_estate_privilege_trigger': case 'has_unlocked_policy_trigger':
      case 'has_unlocked_unit_trigger': case 'has_unlocked_building_trigger': case 'has_unlocked_cabinet_action_trigger': case 'has_unlocked_law_trigger':
        return 'Unlocked by an advance/event';
      case 'current_age': case 'current_age_or_later': return 'Age: ' + this.nm(val);
      case 'has_tribal_government': return neg ? 'Not tribal' : 'Tribal government';
      case 'is_country_religion_pagan': return neg ? 'Not pagan' : 'Pagan religion';
      case 'is_protestant': return neg ? 'Not Protestant' : 'Protestant';
      case 'at_war': return neg ? 'At peace' : 'At war';
      case 'country_type': return 'Country type: ' + this.nm(val);
      case 'country_rank': case 'country_rank_level': return 'Rank' + (o || ': ') + this.nm(val);
      case 'num_of_ports': case 'has_ports': return neg ? 'No ports' : 'Has ports' + (o ? o + val : '');
      case 'has_societal_value': return 'Societal value: ' + this.nm(val);
      case 'is_member_of_international_organization': case 'is_leader_of_international_organization': return null;
      default:
        if (/^(is_|has_|can_)/.test(k) && (v === 'yes' || v === 'no')) return (neg ? 'not ' : '') + humanize(k).toLowerCase();
        if (typeof v === 'string') return humanize(k) + (o || ': ') + this.nm(val);
        return humanize(k);
    }
  }
}

module.exports = { Evaluator, T, F, U, strip };
