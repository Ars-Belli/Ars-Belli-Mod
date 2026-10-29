// EU5 1.4.4 location simulator engine.
// Mechanics from eu5.exe 1.4.4 and the game data; see "EU5 Location Mechanics (1.4.4).md" in the repo root.
// Game data comes from data.json (build_data.js). Works in the browser (window.LocationSim) and Node.
(function (root) {
	'use strict';

	let DB = null;
	let LOCAL_TO_GLOBAL = {};
	function setData(d) {
		DB = d;
		// a location reads local_X plus its owner's global_X (same name with global_ instead of local_)
		LOCAL_TO_GLOBAL = {};
		for (const k of Object.keys(d.modifierTypes)) if (k.startsWith('local_') && d.modifierTypes['global_' + k.slice(6)]) LOCAL_TO_GLOBAL[k] = 'global_' + k.slice(6);
	}
	const def = (sec, key) => DB.defines[sec][key];

	// ---------------------------------------------------------------- modifiers
	// Sums modifier values by key and remembers every source, like the game's tooltips.
	class Mods {
		constructor() { this.v = {}; this.src = {}; }
		add(key, x, source) {
			if (x === 'yes') { this.v[key] = 'yes'; (this.src[key] ??= []).push([source, 'yes']); return; }
			if (typeof x !== 'number' || !x || !Number.isFinite(x)) return;
			this.v[key] = (this.v[key] || 0) + x;
			(this.src[key] ??= []).push([source, x]);
		}
		block(block, scale, source) {
			if (!block || !scale) return;
			for (const [k, x] of Object.entries(block)) this.add(k, typeof x === 'number' ? x * scale : x, source);
		}
		raw(key) { return typeof this.v[key] === 'number' ? this.v[key] : 0; }
		on(key) { return this.v[key] === 'yes'; }
		why(key) { return this.src[key] || []; }
	}
	// A location's view of its modifiers: local + the owner's global counterpart.
	class LocationMods {
		constructor(local, country) { this.local = local; this.country = country; }
		get(key) { const g = LOCAL_TO_GLOBAL[key]; return this.local.raw(key) + this.country.raw(key) + (g ? this.country.raw(g) : 0); }
		on(key) { return this.local.on(key) || this.country.on(key); }
		why(key) {
			const g = LOCAL_TO_GLOBAL[key];
			return [...this.local.why(key), ...this.country.why(key).map(([s, x]) => ['country: ' + s, x]), ...(g ? this.country.why(g).map(([s, x]) => [`country (${g}): ${s}`, x]) : [])];
		}
	}

	// ---------------------------------------------------------------- script values
	// Formula script values (building caps and the like): value/add/subtract/multiply/divide/min/max/if/else_if/else.
	// Triggers the simulator cannot know (variables, owner checks...) count as false and are listed in ctx.unknown.
	function scriptValue(name, ctx) {
		const block = DB.scripted[name];
		if (block === undefined) { const n = DB.values[name]; return n !== undefined ? n : NaN; }
		return evalBlock(block, ctx, 0);
	}
	function operand(v, ctx) {
		if (Array.isArray(v)) return evalBlock(v, ctx, 0);
		const n = parseFloat(v);
		if (Number.isFinite(n) && /^-?[\d.]+$/.test(v)) return n;
		if (DB.values[v] !== undefined) return DB.values[v];
		if (DB.scripted[v]) return evalBlock(DB.scripted[v], ctx, 0);
		const x = ctx.value(v);
		if (x === undefined) { (ctx.unknown ??= new Set()).add(v); return 0; }
		return x;
	}
	function evalBlock(block, ctx, start) {
		let acc = start;
		let lastIf = null;
		for (const [k, , v] of block) {
			switch (k) {
				case 'value': acc = operand(v, ctx); break;
				case 'add': acc += operand(v, ctx); break;
				case 'subtract': acc -= operand(v, ctx); break;
				case 'multiply': acc *= operand(v, ctx); break;
				case 'divide': { const d = operand(v, ctx); acc = d ? acc / d : acc; break; }
				case 'min': acc = Math.max(acc, operand(v, ctx)); break; // min = floor
				case 'max': acc = Math.min(acc, operand(v, ctx)); break; // max = ceiling
				case 'if': lastIf = trigger(limitOf(v), ctx); if (lastIf) acc = evalBlock(v, ctx, acc); break;
				case 'else_if': if (lastIf === false) { lastIf = trigger(limitOf(v), ctx); if (lastIf) acc = evalBlock(v, ctx, acc); } break;
				case 'else': if (lastIf === false) acc = evalBlock(v, ctx, acc); lastIf = null; break;
				case 'desc': case 'limit': case 'format': break;
				default: (ctx.unknown ??= new Set()).add(k);
			}
			if (k !== 'if' && k !== 'else_if') { if (k !== 'else') lastIf = k === 'desc' ? lastIf : null; }
		}
		return acc;
	}
	const limitOf = block => (block.find(([k]) => k === 'limit') || [])[2] || [];
	function compare(a, op, b) {
		switch (op) { case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b; case '!=': return a !== b; default: return a === b; }
	}
	function trigger(pairs, ctx, mode = 'AND') {
		const results = [];
		for (const [k, op, v] of pairs) {
			let r;
			if (k === 'AND' || k === 'OR' || k === 'NOT' || k === 'NOR' || k === 'NAND') {
				const inner = trigger(v, ctx, k === 'OR' || k === 'NOR' ? 'OR' : 'AND');
				r = k === 'NOT' || k === 'NOR' || k === 'NAND' ? !inner : inner;
			} else if (k === 'always') r = v === 'yes';
			else if (k === 'location_rank') r = ('location_rank:' + ctx.rank) === v;
			else if (Array.isArray(v)) { (ctx.unknown ??= new Set()).add(k); r = false; }
			else if (v === 'yes' || v === 'no') { const x = ctx.flag(k); if (x === undefined) { (ctx.unknown ??= new Set()).add(k); r = false; } else r = x === (v === 'yes'); }
			else r = compare(operand(k, ctx), op, operand(v, ctx));
			results.push(r);
		}
		return mode === 'OR' ? results.some(Boolean) : results.every(Boolean);
	}

	// ---------------------------------------------------------------- scenario -> location state
	// Location fields: see the scenario format in "EU5 Location Mechanics (1.4.4).md".
	function locationState(scn) {
		const s = scn.location || {};
		const tpl = s.key ? DB.locations.find(l => l[0] === s.key) : null;
		const L = {
			key: s.key || 'custom', id: s.id,
			rank: s.rank || 'rural_settlement',
			topography: s.topography || (tpl && tpl[1]) || 'flatland', vegetation: s.vegetation ?? (tpl && tpl[2]) ?? '', climate: s.climate || (tpl && tpl[3]) || 'continental',
			rawMaterial: s.rawMaterial || (tpl && tpl[4]) || '', harbor: s.harbor ?? (tpl ? tpl[5] : 0),
			development: s.development ?? 10, prosperity: s.prosperity ?? 0, control: s.control ?? 1, proximity: s.proximity ?? 100,
			integration: s.integration || 'core', capital: !!s.capital, provinceCapital: !!s.provinceCapital, historicalCapital: !!s.historicalCapital,
			marketCenter: !!s.marketCenter, port: !!s.port, coastal: s.coastal ?? (tpl ? !!tpl[9] : !!s.port), river: s.river ?? (tpl ? tpl[8] : 0), road: s.road ?? !!s.roadToCapital,
			roadToCapital: !!s.roadToCapital, marketAccess: s.marketAccess ?? 1, rgoWorkers: s.rgoWorkers,
			pops: (s.pops || []).map(p => ({ satisfaction: 0.5, literacy: 0, status: 'Primary', ...p })),
			buildings: (s.buildings || []).map(b => ({ level: 1, ...b })),
			situation: s.situation || {},
		};
		L.population = L.pops.reduce((a, p) => a + (p.size || 0), 0);
		L.popOf = type => L.pops.filter(p => p.type === type).reduce((a, p) => a + p.size, 0);
		return L;
	}
	function countryState(scn) {
		const c = scn.country || {};
		const m = new Mods();
		// scenario country modifiers are the full country sum (from_save.js includes the base values); a hand-written
		// scenario gets the base values added unless it says baseValues: false
		if (c.baseValues !== false && !(c.notes || []).some(n => n.startsWith('base values'))) m.block(DB.countryBase, 1, 'base values');
		for (const [k, x] of Object.entries(c.modifiers || {})) {
			const parts = c.sources && c.sources[k];
			if (parts && Math.abs(parts.reduce((a, [, y]) => a + y, 0) - x) < 1e-6) for (const [src, y] of parts) m.add(k, y, src);
			else m.add(k, x, 'scenario');
		}
		return { mods: m, taxRates: c.taxRates || {}, locationModifiers: c.locationModifiers || {}, cultures: c, raw: c };
	}

	// script-value context for a location
	function valueContext(L, extra = {}) {
		return {
			rank: L.rank, unknown: null,
			value(k) {
				switch (k) {
					case 'development': return L.development;
					case 'population': return L.population;
					case 'market_access': return L.marketAccess;
					case 'max_rgo_workers': return L.rgoWorkers ?? 0;
					case 'prosperity': return L.prosperity;
					case 'control': return L.control;
					default: return k.startsWith('modifier:') && extra.mods ? extra.mods.get(k.slice(9)) : extra[k];
				}
			},
			flag(k) {
				switch (k) {
					case 'has_river': return L.river > 0;
					case 'is_capital': return L.capital;
					case 'is_coastal': return L.coastal;
					case 'is_port': return L.port;
					case 'is_market_center': return L.marketCenter;
					case 'has_road_to_capital': return L.roadToCapital;
					default: return undefined;
				}
			},
		};
	}

	// ---------------------------------------------------------------- the location's modifiers
	// Static modifiers the engine applies and what it scales each by (static_modifiers/location.txt comments + code).
	function locationModifiers(L, C) {
		const m = new Mods();
		const st = k => DB.static[k] && DB.static[k].m;
		m.block(st('location_base_values'), 1, 'location base values');
		const rank = DB.ranks[L.rank];
		if (rank) m.block(rank.modifier, 1, 'rank: ' + (DB.names[L.rank] || L.rank));
		for (const [layer, key] of [['topography', L.topography], ['vegetation', L.vegetation], ['climate', L.climate]]) {
			const t = DB.terrain[layer][key];
			if (t) m.block(t.modifier, 1, `${layer}: ${DB.names[key] || key}`);
		}
		m.block(st('development'), L.development, `development ${L.development.toFixed(1)}`);
		if (L.prosperity > 0) m.block(st('prosperity'), L.prosperity, `prosperity ${(100 * L.prosperity).toFixed(0)}%`);
		else if (L.prosperity < 0) m.block(st('devastation'), L.prosperity, `devastation ${(100 * L.prosperity).toFixed(0)}%`);
		if (L.capital) m.block(st('capital'), 1, 'capital');
		if (L.provinceCapital && !L.capital) m.block(st('province_capital'), 1, 'province capital');
		if (L.historicalCapital && !L.capital) m.block(st('historical_capital'), 1, 'historical capital');
		m.block(st('control'), L.control, `control ${(100 * L.control).toFixed(0)}%`);
		m.block(st('control_50'), L.control - 0.5, 'control above 50%');
		m.block(st('inverse_control'), 1 - L.control, `missing control ${(100 * (1 - L.control)).toFixed(0)}%`);
		m.block(st('proximity_to_capital'), L.proximity / 100, `proximity ${L.proximity.toFixed(0)}`);
		m.block(st('integration_' + L.integration), 1, 'integration: ' + L.integration);
		if (L.marketCenter) m.block(st('market_center'), 1, 'market center');
		if (L.coastal) m.block(st('coastal'), 1, 'coastal');
		if (L.port) { m.block(st('is_port'), 1, 'port'); m.block(st('harbor'), L.harbor, `harbor suitability ${L.harbor}`); }
		if (L.river) m.block(st('river_flowing_through_' + Math.min(5, L.river)), 1, 'river');
		if (L.river && L.coastal) m.block(st('river_flowing_through_coast_' + Math.min(5, L.river)), 1, 'river mouth');
		if (L.road) m.block(st('has_road'), 1, 'road');
		if (L.roadToCapital) m.block(st('has_road_connected_to_capital'), 1, 'road to the capital');
		m.block(st('total_population'), L.population, `population ${L.population.toFixed(2)}k`);
		const levels = L.buildings.filter(b => !b.foreign).reduce((a, b) => a + b.level, 0);
		m.block(st('building_levels'), levels, `${levels} building levels`);
		// buildings: modifier x level (x goods access, taken as full), capital_modifier in the capital, market_center_modifier
		for (const b of L.buildings) {
			const t = DB.buildings[b.type];
			if (!t) continue;
			const name = `${DB.names[b.type] || b.type} ${b.level}`;
			const access = b.goodsAccess ?? 1;
			m.block(t.mod, b.level * access, name);
			m.block(t.raw, 1, name);
			if (L.capital) m.block(t.capMod, b.level * access, name + ' (capital)');
			if (L.marketCenter) m.block(t.mcMod, b.level * access, name + ' (market center)');
		}
		for (const [k, x] of Object.entries(C.locationModifiers || {})) {
			const parts = C.raw.locationSources && C.raw.locationSources[k];
			if (parts) for (const [src, y] of parts) m.add(k, y, src); else m.add(k, x, 'country location modifiers');
		}
		for (const [k, sc] of Object.entries(L.situation)) if (st(k)) m.block(st(k), sc === true ? 1 : sc, 'situation: ' + k);
		return new LocationMods(m, C.mods);
	}

	// building max level from its max_levels (a number or a formula script value)
	function maxLevel(type, L, M) {
		const t = DB.buildings[type];
		if (!t) return NaN;
		if (typeof t.max === 'number') return t.max;
		if (t.max === undefined) return 1;
		const ctx = valueContext(L, { mods: M });
		const v = scriptValue(t.max, ctx);
		return { value: Math.floor(v), unknown: ctx.unknown ? [...ctx.unknown] : [] };
	}

	const api = { setData, Mods, LocationMods, scriptValue, locationState, countryState, locationModifiers, valueContext, maxLevel, get DB() { return DB; } };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LocationSim = api;
})(typeof self !== 'undefined' ? self : this);
