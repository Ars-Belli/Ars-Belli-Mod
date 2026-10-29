// EU5 1.4.4 location simulator engine.
// Mechanics from eu5.exe 1.4.4 and the game data; see "EU5 Location Mechanics (1.4.4).md" in the repo root and the
// research notes in research/. Game data comes from data.json (build_data.js). Works in the browser (window.LocationSim) and Node.
// Units: pops, men, manpower and food are in thousands, as the game stores them; gold is gold.
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
	const def = (sec, key, dflt) => { const s = DB.defines[sec]; return s && s[key] !== undefined ? s[key] : dflt; };
	const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
	// NCountry.MILITARY_CONTROL_FLOOR: an engine define missing from 00_defines.txt (global 0x14fb24ad8): control counts as at
	// least 10% for manpower, sailors and levies
	const MILITARY_CONTROL_FLOOR = 0.10;
	const ESTATE_OF = type => (DB.pops[type] && DB.pops[type].estate) || 'peasants_estate';

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
	// A location's view of its modifiers. get(local_X) = the location's local_X + the owner's global_X;
	// get(other) = location value + country value. loc() and glob() give the two halves for getters that use them apart.
	class LocationMods {
		constructor(local, country) { this.local = local; this.country = country; }
		loc(key) { return this.local.raw(key); }
		glob(key) { const g = LOCAL_TO_GLOBAL[key]; return g ? this.country.raw(g) : 0; }
		cty(key) { return this.country.raw(key); }
		get(key) { return this.loc(key) + this.glob(key) + (key.startsWith('local_') ? 0 : this.cty(key)); }
		on(key) { return this.local.on(key) || this.country.on(key); }
		why(key) {
			const g = LOCAL_TO_GLOBAL[key];
			return [...this.local.why(key), ...(key.startsWith('local_') ? [] : this.country.why(key).map(([s, x]) => ['country: ' + s, x])),
				...(g ? this.country.why(g).map(([s, x]) => [`country (${g}): ${s}`, x]) : [])];
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

	// ---------------------------------------------------------------- scenario -> state
	// Field list: the scenario format in "EU5 Location Mechanics (1.4.4).md".
	function locationState(scn) {
		const s = scn.location || {};
		const tpl = s.key ? DB.locations.find(l => l[0] === s.key) : null;
		const c = scn.country || {};
		const year = c.year ?? 1337;
		const age = c.age ?? +Object.keys(DB.ages).filter(a => DB.ages[a].year <= year).sort((a, b) => b - a)[0] ?? 1;
		const prices = {};
		for (const [g, v] of Object.entries(DB.goods)) prices[g] = v.price;
		Object.assign(prices, (scn.market || {}).prices || {});
		const obsProv = (scn.observed || {}).province || {};
		const L = {
			key: s.key || 'custom', id: s.id, year, age,
			rank: s.rank || 'rural_settlement',
			topography: s.topography || (tpl && tpl[1]) || 'flatland', vegetation: s.vegetation ?? (tpl && tpl[2]) ?? '', climate: s.climate || (tpl && tpl[3]) || 'continental',
			rawMaterial: s.rawMaterial || (tpl && tpl[4]) || '', harbor: s.harbor ?? (tpl ? tpl[5] : 0),
			development: s.development ?? 10, prosperity: s.prosperity ?? 0, control: s.control ?? 1, proximity: s.proximity ?? 100,
			integration: s.integration || 'core', capital: !!s.capital, provinceCapital: !!s.provinceCapital, historicalCapital: !!s.historicalCapital,
			marketCenter: !!s.marketCenter, port: !!s.port, coastal: s.coastal ?? (tpl ? !!tpl[9] : !!s.port), river: s.river ?? (tpl ? tpl[8] : 0), road: s.road ?? !!s.roadToCapital,
			roadToCapital: !!s.roadToCapital, marketAccess: s.marketAccess ?? 1, rgoWorkers: s.rgoWorkers,
			pops: (s.pops || []).map(p => ({ satisfaction: 0.5, literacy: 0, status: 'Primary', ...p, estate: p.estate || ESTATE_OF(p.type) })),
			buildings: (s.buildings || []).map(b => ({ level: 1, ...b })),
			situation: s.situation || {},
			prices, foodPrice: (scn.market || {}).foodPrice ?? def('NMarket', 'FOOD_PRICE', 0.05),
			// province food factors for growth (0..1 each): from the scenario, the save's province, or full storage and no surplus
			food: { surplus: (s.food || {}).surplusFactor ?? obsProv.surplusGrowth ?? 0, storage: (s.food || {}).storageFactor ?? obsProv.storageGrowth ?? 1, starving: !!(s.food || {}).starving },
			levyRecovery: s.levyRecovery ?? 1,
			timedModifiers: s.timedModifiers || [],
			burgherTrade: s.burgherTrade ?? 0,
			// raw materials of the province's locations (buildings get raw_material_in_province_impact for inputs made there)
			provinceRaw: s.provinceRaw || (tpl && tpl[10] !== undefined ? [...new Set(DB.locations.filter(l => l[10] === tpl[10]).map(l => l[4]).filter(Boolean))] : null),
		};
		L.population = L.pops.reduce((a, p) => a + (p.size || 0), 0);
		return L;
	}
	function countryState(scn) {
		const c = scn.country || {};
		const m = new Mods();
		// from_save.js sums the country modifiers including the base values; a hand-written scenario gets the base values
		// added unless it says baseValues: false
		if (c.baseValues !== false && !(c.notes || []).some(n => n.startsWith('base values'))) m.block(DB.countryBase, 1, 'base values');
		for (const [k, x] of Object.entries(c.modifiers || {})) {
			const parts = c.sources && c.sources[k];
			if (parts && Math.abs(parts.reduce((a, [, y]) => a + y, 0) - x) < 1e-6) for (const [src, y] of parts) m.add(k, y, src);
			else m.add(k, x, 'scenario');
		}
		const taxRates = Object.assign({ nobles_estate: 0.35, clergy_estate: 0.35, burghers_estate: 0.35, peasants_estate: 0.35 }, c.taxRates || {});
		// save tax rates list only the taxed estates: a missing estate pays nothing (e.g. the clergy's tax exemption)
		if (c.taxRates) for (const e of Object.keys(taxRates)) if (!(e in c.taxRates)) taxRates[e] = 0;
		return { mods: m, taxRates, locationModifiers: c.locationModifiers || {}, estates: c.estates || {}, advances: c.advances || null, raw: c };
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
					case 'max_rgo_workers': return L.rgoMax ?? L.rgoWorkers ?? 0;
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
	// employment per building level (thousands of pops), from its employment_size script value
	function employmentSize(type, L) {
		const t = DB.buildings[type];
		if (!t || t.emp === undefined) return 0;
		if (typeof t.emp === 'number') return t.emp;
		const v = scriptValue(t.emp, valueContext(L));
		return Number.isFinite(v) ? v : 0;
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
	// the production method a building runs: the scenario's, else the first one of its first slot
	function methodOf(b) {
		const t = DB.buildings[b.type];
		if (b.method && DB.methods[b.method]) return DB.methods[b.method];
		const k = t && t.slots && t.slots[0] && t.slots[0][0];
		return k ? DB.methods[k] : null;
	}
	const isProducing = b => { const pm = methodOf(b); return !!(pm && pm.out); };

	// ---------------------------------------------------------------- modifiers of a location (eu5.exe 0x143194700 + 0x143edcc30)
	// research/location_modifier_scales.md has every source and scale. Pass 1: everything that does not depend on staffing.
	function baseModifiers(L, C) {
		const m = new Mods();
		const st = k => DB.static[k] && DB.static[k].m;
		m.block(st('location_base_values'), 1, 'location base values');
		const rank = DB.ranks[L.rank];
		if (rank) m.block(rank.modifier, 1, 'rank: ' + (DB.names[L.rank] || L.rank));
		// template (0x143edcc30): terrain, river size, river mouth, coast
		for (const [layer, key] of [['topography', L.topography], ['vegetation', L.vegetation], ['climate', L.climate]]) {
			const t = DB.terrain[layer][key];
			if (t) m.block(t.modifier, 1, `${layer}: ${DB.names[key] || key}`);
		}
		if (L.river) m.block(st('river_flowing_through_' + Math.min(5, L.river)), 1, `river size ${L.river}`);
		if (L.river && L.coastal) m.block(st('river_flowing_through_coast_' + Math.min(5, L.river)), 1, 'river mouth');
		if (L.coastal) m.block(st('coastal'), 1, 'coastal');
		// location update (0x143194700)
		m.block(st('integration_' + L.integration), 1, 'integration: ' + L.integration);
		if (L.situation.winter) m.block(st('winter_' + L.situation.winter), 1, 'winter: ' + L.situation.winter);
		if (L.situation.occupied) m.block(st('is_occupied'), 1, 'occupied');
		if (L.capital) m.block(st('capital'), 1, 'capital');
		else if (L.provinceCapital) m.block(st('province_capital'), 1, 'province capital');
		if (L.historicalCapital && !L.capital) m.block(st('historical_capital'), 1, 'historical capital');
		if (L.port) m.block(st('is_port'), 1, 'port');
		if (L.road) m.block(st('has_road'), 1, 'road');
		if (L.roadToCapital) m.block(st('has_road_connected_to_capital'), 1, 'road to the capital');
		m.block(st('development'), L.development, `development ${L.development.toFixed(1)}`);
		m.block(st('proximity_to_capital'), L.proximity / 100, `proximity ${L.proximity.toFixed(0)}`);
		if (L.prosperity > 0) m.block(st('prosperity'), L.prosperity, `prosperity ${(100 * L.prosperity).toFixed(0)}%`);
		else if (L.prosperity < 0) m.block(st('devastation'), L.prosperity, `devastation ${(100 * L.prosperity).toFixed(0)}%`);
		m.block(st('control'), L.control, `control ${(100 * L.control).toFixed(0)}%`);
		m.block(st('inverse_control'), 1 - L.control, `missing control ${(100 * (1 - L.control)).toFixed(0)}%`);
		m.block(st('control_50'), L.control - 0.5, 'control - 50%');
		if (L.marketCenter) m.block(st('market_center'), 1, 'market center');
		m.block(st('total_population'), L.population, `population ${L.population.toFixed(2)}k`);
		if (L.population > 0) {
			const avg = Math.min(1, L.pops.reduce((a, p) => a + p.size * (p.satisfaction || 0), 0) / L.population);
			m.block(st('average_satisfaction'), avg, `average satisfaction ${(100 * avg).toFixed(0)}%`);
			m.block(st('average_satisfaction_inverted'), 1 - avg, `missing satisfaction ${(100 * (1 - avg)).toFixed(0)}%`);
			const troops = L.situation.friendlyTroops || 0, hostile = L.situation.hostileTroops || 0;
			if (troops) m.block(st('present_troops'), troops / L.population, `troops ${(troops * 1000).toFixed(0)} men`);
			if (hostile) m.block(st('hostile_troops'), hostile / L.population, `hostile troops ${(hostile * 1000).toFixed(0)} men`);
			if (L.situation.raisedLevies && !C.mods.raw('always_allow_levies')) m.block(st('raised_levies'), 1, 'levies raised');
			// pop types: pop_percentage_impact x share of the population, literacy_impact x average literacy / 100
			const byType = {};
			for (const p of L.pops) { const t = (byType[p.type] ??= { size: 0, lit: 0 }); t.size += p.size; t.lit += p.size * (p.literacy || 0); }
			for (const [type, t] of Object.entries(byType)) {
				const pt = DB.pops[type];
				if (!pt || !t.size) continue;
				m.block(pt.percentage, t.size / L.population, `${DB.names[type] || type} ${(100 * t.size / L.population).toFixed(1)}% of the population`);
				m.block(pt.literacy, t.lit / t.size / 100, `${DB.names[type] || type} literacy ${(t.lit / t.size).toFixed(0)}`);
			}
		}
		if (L.situation.looted) m.block(st('looted'), 1, 'looted');
		if (L.situation.underSiege) m.block(st('under_siege'), 1, 'under siege');
		if (L.situation.blockade) m.block(st('is_blockaded_by_enemies'), L.situation.blockade, 'blockaded');
		if (L.port) m.block(st('harbor'), Math.max(0, L.harbor), `harbor suitability ${L.harbor}`);
		// market food price and raw material price
		const fp = def('NMarket', 'FOOD_PRICE', 0.05), r = (L.foodPrice - fp) / fp;
		if (r > 0) m.block(st('expensive_food_in_location'), Math.min(0.5, r), 'expensive food');
		else if (r < 0) m.block(st('cheap_food_in_location'), Math.min(0.5, -r), 'cheap food');
		const g = DB.goods[L.rawMaterial];
		if (g && L.prices[L.rawMaterial] !== undefined) m.block(st('raw_material_relative_price'), (L.prices[L.rawMaterial] - g.price) / g.price, 'raw material price');
		if (L.food.starving) m.block(st('province_starving'), 1, 'province starving');
		m.block(st('province_base'), 1, 'province');
		for (const [k, sc] of Object.entries(L.situation.modifiers || {})) if (st(k)) m.block(st(k), sc === true ? 1 : sc, k);
		// timed location modifiers (events), and the location's historical base modifier (location_historical_base_values: almaden_base...)
		for (const [k, size] of L.timedModifiers) if (st(k)) m.block(st(k), size, (DB.names[k] || k) + ' (timed)');
		if (st(L.key + '_base')) m.block(st(L.key + '_base'), 1, 'historical base: ' + L.key);
		for (const [k, x] of Object.entries(C.locationModifiers || {})) {
			const parts = C.raw.locationSources && C.raw.locationSources[k];
			if (parts) for (const [src, y] of parts) m.add(k, y, src); else m.add(k, x, 'country location modifiers');
		}
		return m;
	}

	// RGO size in thousands of workers. The save's max_raw_material_workers when given; otherwise
	// local_max_rgo_size x (1 + local_max_rgo_size_modifier): research open (Sevilla: formula 14.9 vs save 16).
	function rgoSize(L, M) {
		if (L.rgoWorkers !== undefined) return { value: L.rgoWorkers, from: 'save' };
		if (!L.rawMaterial) return { value: 0, from: 'none' };
		return { value: Math.max(0, Math.floor(M.get('local_max_rgo_size') * (1 + M.get('local_max_rgo_size_modifier')))), from: 'formula (approximate)' };
	}

	// Who works where. A building employs only its pop type; laborers also work the RGO (1,000 per level).
	// Buildings with a saved `employed` keep it; otherwise every job of a pop type is filled at the same rate, min(1, pops/jobs).
	function employment(L, rgoMax, obs) {
		const jobs = {}, pops = {}, E = new Map();
		for (const p of L.pops) pops[p.type] = (pops[p.type] || 0) + p.size;
		for (const b of L.buildings) {
			const t = DB.buildings[b.type];
			if (!t || !t.pop) continue;
			b.size = employmentSize(b.type, L);
			jobs[t.pop] = (jobs[t.pop] || 0) + b.level * b.size;
		}
		const rgoFromSave = obs && obs.laborers && obs.laborers.employed_in_rgo !== undefined ? obs.laborers.employed_in_rgo : undefined;
		jobs.laborers = (jobs.laborers || 0) + rgoMax;
		const fill = type => jobs[type] ? Math.min(1, (pops[type] || 0) / jobs[type]) : 0;
		for (const b of L.buildings) {
			const t = DB.buildings[b.type];
			if (!t || !b.level) continue;
			if (b.employed !== undefined && b.size) E.set(b, clamp(b.employed / (b.level * b.size), 0, 1));
			else E.set(b, t.pop ? fill(t.pop) : 1);
		}
		const rgoWorkers = rgoFromSave ?? rgoMax * fill('laborers');
		const employed = {};
		for (const b of L.buildings) { const t = DB.buildings[b.type]; if (t && t.pop) employed[t.pop] = (employed[t.pop] || 0) + b.level * (b.size || 0) * E.get(b); }
		employed.laborers = (employed.laborers || 0) + rgoWorkers;
		const unemployed = {};
		for (const [type, n] of Object.entries(pops)) unemployed[type] = Math.max(0, n - (employed[type] || 0));
		return { jobs, pops, E, rgoWorkers, rgoMax, employed, unemployed };
	}

	// Pass 2: buildings (scaled by level x goods access x staffing), staffing and capacity statics.
	function locationModifiers(L, C, obs) {
		const base = baseModifiers(L, C);
		const st = k => DB.static[k] && DB.static[k].m;
		// RGO size first (it decides laborer jobs); building RGO-size modifiers count at full staffing here
		const pre = new Mods();
		pre.v = { ...base.v }; pre.src = { ...base.src };
		for (const b of L.buildings) { const t = DB.buildings[b.type]; if (t) pre.block(t.mod, b.level, b.type); }
		L.rgoMax = rgoSize(L, new LocationMods(pre, C.mods)).value;
		const J = employment(L, L.rgoMax, obs);
		const m = base;
		let staffed = 0, total = 0;
		for (const b of L.buildings) {
			const t = DB.buildings[b.type];
			if (!t || !b.level) continue;
			const access = b.goodsAccess ?? 1, e = J.E.get(b) ?? 1;
			const name = `${DB.names[b.type] || b.type} ${b.level}`;
			const S = b.level * access * e, Lv = b.level * access;
			m.block(t.mod, S, name);
			m.block(t.raw, Lv, name);
			if (L.capital || L.historicalCapital) m.block(t.capMod, S, name + ' (capital)');
			if (L.marketCenter) m.block(t.mcMod, S, name + ' (market center)');
			if (!b.foreign) { staffed += b.level * e; total += b.level + (b.queued || 0); }
		}
		m.block(st('building_levels'), staffed, `${staffed.toFixed(1)} staffed building levels`);
		const free = Math.max(0, m.raw('free_building_levels') * (1 + C.mods.raw('global_free_building_levels_modifier')));
		if (total > free) m.block(st('unsupported_building_levels'), total - free, `${(total - free).toFixed(1)} building levels over the free ${free.toFixed(1)}`);
		if (L.rgoMax) m.block(st('rgo_level'), L.rgoMax, `RGO size ${L.rgoMax}`);
		// jobs left open (not tribesmen, slaves or peasants), capped at POP_JOB_SURPLUS_SCALE_CAP thousand
		let open = 0;
		for (const [type, n] of Object.entries(J.jobs)) if (!['tribesmen', 'slaves', 'peasants'].includes(type)) open += Math.max(0, n - (J.pops[type] || 0));
		if (open > 0) m.block(st('surplus_jobs'), Math.min(def('NPop', 'POP_JOB_SURPLUS_SCALE_CAP', 5), open), `${(open * 1000).toFixed(0)} open jobs`);
		if (J.unemployed.peasants > 0) m.block(st('unemployed_peasants'), J.unemployed.peasants, `${(J.unemployed.peasants * 1000).toFixed(0)} peasants without a job`);
		// population capacity and its statics (damping from GROWTH_DAMPING_START of capacity, over-population above it)
		const M = new LocationMods(m, C.mods);
		const cap = capacity(M);
		const pop = L.population, start = def('NPop', 'GROWTH_DAMPING_START', 0.6);
		if (cap > 0 && pop <= cap) {
			const s = clamp((pop / cap - start) / (1 - start), 0, 1);
			if (s > 0) m.block(st('approaching_capacity'), s, `population at ${(100 * pop / cap).toFixed(0)}% of capacity`);
			if (M.on('free_capacity_attracts_pops')) {
				const free = (cap - pop) / cap;
				if (pop < 10 && free >= 0.9) m.block(st('abundant_free_land'), free, 'abundant free land');
				else m.block(st('available_free_land'), free, 'free land');
			}
		} else if (cap > 0) {
			m.block(st('overpopulation'), (pop - cap) / cap, `population ${(100 * pop / cap).toFixed(0)}% of capacity`);
			m.block(st('overpopulation_growth'), pop / cap, 'over capacity');
		}
		return { M, J, capacity: cap };
	}
	// population capacity (0x14310abc0)
	function capacity(M) {
		return Math.max(1, M.loc('local_population_capacity') * (1 + M.get('local_population_capacity_modifier')) * (1 + M.get('total_population_capacity_modifier')));
	}

	// ---------------------------------------------------------------- formulas
	// Population growth (0x142733a20, 0x143384090): yearly rate and the month's births per pop type.
	function growth(L, M) {
		const f = L.food, foodTerms = L.food.starving ? 0
			: def('NPop', 'FOOD_SURPLUS_POP_GROWTH', 0.0015) * clamp(f.surplus, 0, 1) + def('NPop', 'FOOD_STORAGE_POP_GROWTH', 0.001) * clamp(f.storage, 0, 1);
		let yearly = M.get('local_population_growth') + foodTerms;
		if (M.on('cap_maximum_population_growth_at_zero')) yearly = Math.min(0, yearly);
		const pool = L.population * yearly / 12;
		// primary, accepted and tolerated pops share the births, weighted by size x (1 + local/global <type>_pop_growth)
		const eligible = p => ['Primary', 'Accepted', 'Tolerated'].includes(p.status);
		const w = {};
		for (const p of L.pops) if (eligible(p)) w[p.type] = (w[p.type] || 0) + p.size * (1 + M.loc(`local_${p.type}_pop_growth`) + M.cty(`global_${p.type}_pop_growth`));
		const sumW = Object.values(w).reduce((a, x) => a + x, 0);
		const births = {};
		for (const [type, x] of Object.entries(w)) births[type] = sumW ? pool * x / sumW : 0;
		if (!sumW && pool) births.peasants = pool;
		return { yearly, foodTerms, pool, births, local: M.loc('local_population_growth'), global: M.glob('local_population_growth') };
	}

	// Manpower and sailors (0x1427892e0, 0x143106700). Flat local values come from buildings (already scaled by staffing).
	function military(L, M, kind) {
		const flat = M.loc(`local_${kind}`), localMod = M.loc(`local_${kind}_modifier`), globalMod = M.cty(`global_${kind}_modifier`);
		const ctrl = Math.max(L.control, MILITARY_CONTROL_FLOOR);
		const monthly = flat * (1 + localMod) * ctrl * (1 + globalMod); // this location's share of the country's income
		const years = def('NCountry', kind === 'manpower' ? 'MAX_MANPOWER_YEARS' : 'MAX_SAILORS_YEARS', 5);
		return { flat, localMod, globalMod, control: ctrl, monthly, locationView: flat * (1 + localMod + globalMod) * ctrl, max: monthly * years * 12 };
	}

	// Levies (0x143354880): the levy each pop raises and its men.
	function availableLevies(C, age) {
		const out = [];
		for (const [k, l] of Object.entries(DB.levies)) {
			if (l.countryAllow || l.allow || (l.cultures && l.cultures.length) || !l.power) continue; // flavour levies need triggers the simulator cannot check
			const ok = !l.unlock ? true : C.advances ? l.unlock.some(([a]) => C.advances.includes(a)) : l.unlock.some(([, ag]) => ag <= age);
			if (ok) out.push([k, l]);
		}
		return out;
	}
	function levies(L, M, C) {
		const ctrl = Math.max(L.control, MILITARY_CONTROL_FLOOR);
		const avail = availableLevies(C, L.age);
		const wrong = 1 + Math.min(0, C.mods.raw('wrong_culture_levy_size'));
		const threshold = def('NCountry', 'ESTATE_LEVY_SATISFACTION_THRESHOLD', 0.25);
		const rows = [];
		for (const navy of [false, true]) {
			const kind = navy ? 'navy' : 'army';
			const cands = avail.filter(([, l]) => !!l.navy === navy);
			for (const p of L.pops) {
				const pick = cands.filter(([, l]) => !l.pops.length || l.pops.includes(p.type)).sort((a, b) => b[1].power - a[1].power)[0];
				if (!pick) continue;
				const [key, l] = pick;
				const size = typeof l.size === 'number' ? l.size : DB.values[l.size] ?? 0;
				const est = C.estates[p.estate];
				const satisfied = !est || est.satisfaction === undefined || est.satisfaction >= threshold;
				const culture = p.status === 'Primary' || p.status === 'Accepted' ? 1 : wrong;
				const mult = 1 + M.get('local_levy_size_modifier') + M.get(`local_${kind}_levy_size_modifier`) + C.mods.raw(`${p.estate}_levy_size`);
				const men = satisfied ? p.size * size * culture * mult * ctrl * L.levyRecovery : 0;
				rows.push({ kind, levy: key, unit: l.unit, cat: l.cat, popType: p.type, status: p.status, popSize: p.size, size, culture, mult, satisfied, men, regimentSize: l.men });
			}
		}
		const sum = kind => rows.filter(r => r.kind === kind).reduce((a, r) => a + r.men, 0);
		return { control: ctrl, rows, army: sum('army'), navy: sum('navy') };
	}

	// RGO (economy_control.md 2.1): 1 unit a month per 1,000 workers x (1 + raw material output modifiers), sold at the market price.
	function rgo(L, M, J) {
		const good = L.rawMaterial;
		if (!good || !DB.goods[good]) return { good, workers: 0, output: 0, profit: 0 };
		const outMod = M.get('local_raw_material_output') + M.get(`local_${good}_output_modifier`);
		const output = J.rgoWorkers * (1 + outMod);
		const price = L.prices[good] ?? DB.goods[good].price;
		return { good, workers: J.rgoWorkers, size: J.rgoMax, outMod, output, price, profit: output * price * L.marketAccess, food: output * (DB.goods[good].food || 0) };
	}

	// Buildings (economy_control.md 2.2-2.3): producers make profit (wealth); the rest cost upkeep (an owner expense).
	function buildingEconomy(L, M, C, J) {
		const age = DB.ages[L.age] || DB.ages[1];
		const provinceRaw = new Set(L.provinceRaw || [L.rawMaterial]);
		// upkeep multiplier: base 0.2 + 0.001 a year (static years_since_game_start), divided by (1 + building_upkeep_efficiency);
		// the save shows ~0.39 in 1547 where this gives 0.385 for Spain (economy_control.md 2.3, close but not exact)
		const upkeepMult = (C.mods.raw('building_upkeep_multiplier') + 0.001 * Math.max(0, L.year - 1337)) / (1 + C.mods.raw('building_upkeep_efficiency'));
		const rows = [];
		for (const [idx, b] of L.buildings.entries()) {
			const t = DB.buildings[b.type], pm = methodOf(b);
			if (!t || !pm || !b.level) continue;
			const e = J.E.get(b) ?? 1;
			const inCost = Object.entries(pm.in || {}).reduce((a, [g, n]) => a + n * (L.prices[g] ?? (DB.goods[g] || {}).price ?? 0), 0);
			if (pm.out) {
				const inTotal = Object.values(pm.in || {}).reduce((a, n) => a + n, 0);
				const inLocal = Object.entries(pm.in || {}).filter(([g]) => provinceRaw.has(g)).reduce((a, [, n]) => a + n, 0);
				const pe = M.get('local_production_efficiency') + Math.max(0, b.level - 1) * def('NEconomy', 'PRODUCTION_EFFIENCY_BONUS_PER_LEVEL', 0.01) * age.efficiency
					+ (inTotal ? C.mods.raw('raw_material_in_province_impact') * inLocal / inTotal : 0);
				const price = L.prices[pm.out] ?? DB.goods[pm.out].price;
				const throughput = L.marketAccess * e;
				// output x (1 + production efficiency + the good's output modifier): Spain's lumber mill needs +50% lumber output on top
				const goodMod = M.get('local_' + pm.out + '_output_modifier');
				const profit = b.level * throughput * (pm.n * price * (1 + pe + goodMod) - inCost);
				rows.push({ idx, type: b.type, level: b.level, foreign: !!b.foreign, employment: e, produces: pm.out, output: b.level * throughput * pm.n * (1 + pe + goodMod), pe, goodMod, profit, savedProfit: b.profit });
			} else rows.push({ idx, type: b.type, level: b.level, foreign: !!b.foreign, employment: e, upkeep: b.level * inCost * upkeepMult, savedUpkeep: b.upkeep });
		}
		return { rows, upkeepMult };
	}

	// Tax (economy_control.md 1): wealth x control is the tax base; estates share it by pops x tax_per_pop, peasants keep the
	// enfranchised part and the nobles take the rest; burgher trade goes to the burghers; the crown taxes each estate's part.
	function tax(L, M, C, wealth) {
		const E = clamp(C.mods.raw('global_peasant_enfranchisment') + M.loc('local_peasant_enfranchisment'), def('NEstate', 'MIN_PEASANT_ENFRANCHISMENT', 0.1), def('NEstate', 'MAX_PEASANT_ENFRANCHISMENT', 1));
		const w = {};
		for (const p of L.pops) { const e = DB.estates[p.estate]; if (e) w[p.estate] = (w[p.estate] || 0) + p.size * e.taxPerPop; }
		if (w.peasants_estate) { w.nobles_estate = (w.nobles_estate || 0) + w.peasants_estate * (1 - E); w.peasants_estate *= E; }
		const sum = Object.values(w).reduce((a, x) => a + x, 0);
		const shared = wealth - L.burgherTrade, eff = 1 + C.mods.raw('tax_income_efficiency');
		const estates = {};
		for (const [e, x] of Object.entries(w)) {
			const possible = (sum ? x / sum : 0) * shared + (e === 'burghers_estate' ? L.burgherTrade : 0);
			const base = possible * L.control, rate = C.taxRates[e] || 0;
			estates[e] = { weight: x, share: sum ? x / sum : 0, possible, base, rate, crown: base * rate * eff };
		}
		const crown = Object.values(estates).reduce((a, e) => a + e.crown, 0);
		return { enfranchisement: E, wealth, base: wealth * L.control, efficiency: eff, estates, crown };
	}

	// Control (0x1430ed2f0 max, 0x1430edf80 monthly change)
	function control(L, M) {
		const urban = L.rank !== 'rural_settlement';
		const max = clamp(M.get('local_max_control') + M.get(urban ? 'local_max_urban_control' : 'local_max_rural_control'), 0, 1);
		let delta;
		if (L.control <= max) delta = Math.min(max - L.control, M.get('local_monthly_control') + M.get(urban ? 'local_monthly_urban_control' : 'local_monthly_rural_control'));
		else { const decline = M.get('local_monthly_control_decline'); delta = decline < 0 ? 0 : -Math.min(L.control - max, def('NLocation', 'MONTHLY_CONTROL_DECAY', 0.01), decline); }
		return { max, delta, urban };
	}

	// ---------------------------------------------------------------- one month, as numbers
	function evaluate(scn, state) {
		const L = state && state.L || locationState(scn), C = state && state.C || countryState(scn);
		const obs = state ? (state.obs ?? null) : ((scn.observed || {}).popStats || null);
		const { M, J, capacity: cap } = locationModifiers(L, C, obs);
		const r = { L, C, M, J, capacity: cap };
		r.growth = growth(L, M);
		r.manpower = military(L, M, 'manpower');
		r.sailors = military(L, M, 'sailors');
		r.levies = levies(L, M, C);
		r.rgo = rgo(L, M, J);
		r.buildings = buildingEconomy(L, M, C, J);
		const producing = r.buildings.rows.filter(b => b.profit !== undefined && !b.foreign);
		r.wealth = { rgo: r.rgo.profit, buildings: producing.reduce((a, b) => a + b.profit, 0), burgherTrade: L.burgherTrade };
		r.wealth.total = r.wealth.rgo + r.wealth.buildings + r.wealth.burgherTrade;
		r.upkeep = r.buildings.rows.filter(b => b.upkeep !== undefined && !b.foreign).reduce((a, b) => a + b.upkeep, 0);
		r.tax = tax(L, M, C, r.wealth.total);
		r.control = control(L, M);
		return r;
	}

	// ---------------------------------------------------------------- month by month
	// Pops grow by their births, control moves toward its max, manpower accumulates. Development, prosperity, prices and food
	// stay as given until their formulas are in (research open).
	// One month of change for a location, given this month's evaluation r: control moves toward its max, births join the
	// pops, buildings lay off or rehire by profit. Development, prosperity and food stay (research open).
	function advance(L, r) {
		L.control = clamp(L.control + r.control.delta, 0, 1);
		// births go to the eligible pops of each type in proportion to their size
		for (const [type, n] of Object.entries(r.growth.births)) {
			const group = L.pops.filter(p => p.type === type && ['Primary', 'Accepted', 'Tolerated'].includes(p.status));
			const tot = group.reduce((a, p) => a + p.size, 0);
			if (tot > 0) for (const p of group) p.size = Math.max(0, p.size + n * p.size / tot);
			else if (n > 0) L.pops.push({ type, size: n, status: 'Primary', satisfaction: 0.5, literacy: 0, estate: ESTATE_OF(type) });
		}
		L.population = L.pops.reduce((a, p) => a + p.size, 0);
		// staffing: an unprofitable building lays off UNPROFITABLE_BUILDING_WORKERS_LAID_OFF_PERCENTAGE (10%) of its workers a
		// month, a profitable one rehires PROFITABLE_BUILDING_WORKERS_REHIRED_PERCENTAGE (10%) of its jobs, as far as pops allow
		const off = def('NEconomy', 'UNPROFITABLE_BUILDING_WORKERS_LAID_OFF_PERCENTAGE', 10) / 100, hire = def('NEconomy', 'PROFITABLE_BUILDING_WORKERS_REHIRED_PERCENTAGE', 10) / 100;
		const free = {};
		for (const [type, n] of Object.entries(r.J.pops)) free[type] = n - (r.J.employed[type] || 0);
		const rowOf = new Map(r.buildings.rows.map(x => [x.idx, x]));
		for (const [idx, b] of L.buildings.entries()) {
			const t = DB.buildings[b.type];
			if (!t || !t.pop || !b.size) continue;
			const e = r.J.E.get(b) ?? 1, row = rowOf.get(idx);
			let next = row && row.profit !== undefined && row.profit < 0 ? e * (1 - off) : Math.min(1, e + hire);
			const extra = (next - e) * b.level * b.size;
			if (extra > 0) { const take = Math.min(extra, Math.max(0, free[t.pop] || 0)); free[t.pop] = (free[t.pop] || 0) - take; next = e + take / (b.level * b.size); }
			b.employed = next * b.level * b.size;
		}
	}

	// month by month for one location; manpower accumulates up to its max manpower share
	function project(scn, months = 120) {
		const L = locationState(scn), C = countryState(scn);
		const timeline = [];
		let manpowerPool = 0;
		for (let mth = 0; mth <= months; mth++) {
			const r = evaluate(scn, { L, C });
			timeline.push({ month: mth, population: L.population, capacity: r.capacity, growth: r.growth.yearly, manpower: r.manpower.monthly, maxManpower: r.manpower.max,
				sailors: r.sailors.monthly, levies: r.levies.army, wealth: r.wealth.total, crownTax: r.tax.crown, control: L.control, maxControl: r.control.max, manpowerPool });
			if (mth === months) break;
			manpowerPool = Math.min(r.manpower.max, manpowerPool + r.manpower.monthly);
			advance(L, r);
		}
		return timeline;
	}

	// market price step (markets_food.md 1.2): target from effective supply and demand, then 5% of the gap a month
	function targetPrice(good, supply, demand, age, foodPrice) {
		const g = DB.goods[good], a = DB.ages[age] || DB.ages[1];
		if (supply <= 0 && demand <= 0) return g.price;
		let D = demand;
		if (g.food > 0 && foodPrice > def('NMarket', 'FOOD_PRICE', 0.05)) D *= 1 + def('NMarket', 'FOOD_PRICE_IMPACT_ON_PRICES', 0.25);
		const off = def('NEconomy', 'SUPPLY_AND_DEMAND_STABILITY_OFFSET_CONSTANT', 1), k = Math.min(a.priceStability, 1);
		const Sp = supply + off, Dp = D + off;
		return g.price * clamp((k * Sp + Dp) / (k * Dp + Sp), a.minPrice, a.maxPrice);
	}
	const priceStep = (p, target) => p + def('NMarket', 'MONTHLY_PRICE_CHANGE', 0.05) * (target - p);

	const api = { setData, Mods, LocationMods, scriptValue, locationState, countryState, locationModifiers, baseModifiers, employment, capacity, valueContext,
		maxLevel, employmentSize, methodOf, isProducing, growth, military, levies, rgo, buildingEconomy, tax, control, evaluate, advance, project, targetPrice, priceStep,
		MILITARY_CONTROL_FLOOR, get DB() { return DB; } };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LocationSim = api;
})(typeof self !== 'undefined' ? self : this);
