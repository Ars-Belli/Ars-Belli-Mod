// EU5 1.4.4 country mode for the location simulator: several locations of one country, month by month, with markets.
// Works in Node (require) and the browser (window.CountrySim, after engine.js).
//
// Scenario: { name, country: {...as for a location...}, capital: <location id>, locations: [ <location>... ],
//             markets: { <id>: { prices, foodPrice, goods: { <good>: { price, supplied, production, demanded, stockpile } } } },
//             options: { markets: 'fixed' | 'closed' | 'off' }, observed: { <location id>: {...} } }
// from_save.js --country TAG writes one.
//
// Markets (markets_food.md): the price of a good moves 5% a month toward a target set by effective supply and demand.
// The country's own locations are simulated: RGO output and building output are supply, building inputs and maintenance
// are demand. Everything else in the market at month 0 (foreign members, pop demand, armies, construction, roads) is
// calibrated from the save as the difference and held fixed. Trade with other markets:
//   'fixed'  - imports and exports stay at the save's values
//   'closed' - no trade with other markets
//   'off'    - no market at all: prices stay where they are
// Pop demand and food are not simulated yet (research open), so prices react to production and building demand only.
(function (root) {
	'use strict';
	const E = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.LocationSim;
	const DB = () => E.DB;
	const sumObj = o => Object.values(o || {}).reduce((a, x) => a + (+x || 0), 0);

	// a location of the country scenario as a single-location scenario
	const locationScenario = (scn, loc) => ({ location: loc, country: scn.country, market: (scn.markets || {})[loc.market] || {}, observed: (scn.observed || {})[loc.id] || {} });

	// own supply and demand of one evaluated location, per good (units a month)
	function flows(r) {
		const s = {}, d = {};
		const add = (o, g, x) => { if (g && x) o[g] = (o[g] || 0) + x; };
		if (r.rgo.good) add(s, r.rgo.good, r.rgo.output * r.L.marketAccess);
		const rowOf = new Map(r.buildings.rows.map(x => [x.idx, x]));
		for (const [idx, b] of r.L.buildings.entries()) {
			const t = DB().buildings[b.type], pm = E.methodOf(b), row = rowOf.get(idx);
			if (!t || !pm || !b.level || !row) continue;
			if (pm.out) {
				add(s, pm.out, row.output);
				for (const [g, n] of Object.entries(pm.in || {})) add(d, g, b.level * r.L.marketAccess * row.employment * n);
			} else for (const [g, n] of Object.entries(pm.in || {})) add(d, g, b.level * (t.alwaysDemand ? 1 : row.employment) * n);
		}
		return { s, d };
	}

	// effective supply and demand (markets_food.md 1.3/1.4): trade flows enter at fixed weights, transit is removed
	function effective(S, D, t, v) {
		const N = DB().defines.NMarket;
		const bsS = N.BURGHER_TRADE_IMPACT_ON_SUPPLY_SCALE ?? 0.25, tsS = N.TRADE_IMPACT_ON_SUPPLY_SCALE ?? 0.75;
		const bS = Math.min(1, Math.max(0, (N.BURGHER_TRADE_IMPACT_ON_DEMAND_SCALE ?? 0.25) * (1 + v))), tS = Math.min(1, Math.max(0, (N.TRADE_IMPACT_ON_DEMAND_SCALE ?? 0.75) * (1 + v)));
		const sEff = Math.max(0, S + t.BTin + t.Tin - (1 - bsS) * t.BTin - (1 - tsS) * t.Tin - tsS * Math.min(t.Tin, t.Tout) - bsS * Math.min(t.BTin, t.BTout));
		const dEff = Math.max(0, D + t.BTout + t.Tout - (1 - bS) * t.BTout - (1 - tS) * t.Tout - tS * Math.min(t.Tout, t.Tin) - bS * Math.min(t.BTout, t.BTin));
		return { sEff, dEff };
	}

	// pop demand falls when a good is dear: clamp(1 - DEMAND_ELASTICITY_COEFFICIENT x (price/default - 1), FLOOR, 1) (markets_food.md 1.7)
	function elasticity(good, price) {
		const N = DB().defines.NMarket, g = DB().goods[good];
		if (!g) return 1;
		return Math.min(1, Math.max(N.DEMAND_ELASTICITY_FLOOR ?? 0.35, 1 - (N.DEMAND_ELASTICITY_COEFFICIENT ?? 0.4) * (price / g.price - 1)));
	}

	function create(scn) {
		const C = E.countryState(scn);
		const mode = (scn.options || {}).markets || 'fixed';
		const sites = scn.locations.map(loc => {
			const s = locationScenario(scn, loc);
			return { loc, scn: s, L: E.locationState(s), obs: s.observed.popStats || null };
		});
		// market calibration at month 0
		const markets = {};
		for (const [id, m] of Object.entries(scn.markets || {})) markets[id] = { id, foodPrice: m.foodPrice, prices: { ...(m.prices || {}) }, goods: {}, src: m };
		// army upkeep in manpower is not simulated: held at options.manpowerExpense (thousands a month), by default the save's
		// income minus its net change
		const obs = C.raw.observed || {};
		const expense = (scn.options || {}).manpowerExpense ?? (obs.manpowerIncome !== undefined && obs.manpowerNet !== undefined ? obs.manpowerIncome - obs.manpowerNet : 0);
		const state = { scn, C, mode, sites, markets, month: 0, manpowerPool: obs.manpower ?? 0, manpowerExpense: expense, history: [] };
		const first = evaluateAll(state, true);
		const own = {};
		for (const site of sites) {
			const f = flows(first.results.get(site));
			const o = (own[site.loc.market] ??= { s: {}, d: {} });
			for (const [g, x] of Object.entries(f.s)) o.s[g] = (o.s[g] || 0) + x;
			for (const [g, x] of Object.entries(f.d)) o.d[g] = (o.d[g] || 0) + x;
		}
		for (const mk of Object.values(markets)) {
			const o = own[mk.id] || { s: {}, d: {} };
			for (const [g, x] of Object.entries(mk.src.goods || {})) {
				const sup = x.supplied || {}, dem = x.demanded || {};
				const prod = sup.Production ?? sumObj(x.production);
				const demand = sumObj(dem) - (dem.Trade || 0) - (dem.BurgherTrades || 0), pops = dem.Pops || 0;
				mk.goods[g] = {
					// pop demand kept apart: its base (before price elasticity) is fixed, the elasticity follows the price
					price: x.price, otherS: prod - (o.s[g] || 0), otherD: demand - pops - (o.d[g] || 0), popBase: pops / elasticity(g, x.price),
					trade: { Tin: sup.Trade || 0, Tout: dem.Trade || 0, BTin: sup.BurgherTrades || 0, BTout: dem.BurgherTrades || 0 },
				};
			}
		}
		return state;
	}

	// evaluate every location this month (prices come from its market)
	function evaluateAll(state, firstMonth) {
		const results = new Map();
		for (const site of state.sites) {
			const mk = state.markets[site.loc.market];
			if (mk) Object.assign(site.L.prices, mk.prices);
			results.set(site, E.evaluate(site.scn, { L: site.L, C: state.C, obs: firstMonth ? site.obs : null }));
		}
		return { results };
	}

	function totals(state, results) {
		const t = { population: 0, manpower: 0, sailors: 0, armyLevies: 0, navyLevies: 0, wealth: 0, taxBase: 0, crownTax: 0, upkeep: 0, births: 0, controlWeighted: 0 };
		for (const [site, r] of results) {
			t.population += site.L.population; t.manpower += r.manpower.monthly; t.sailors += r.sailors.monthly;
			t.armyLevies += r.levies.army; t.navyLevies += r.levies.navy; t.wealth += r.wealth.total; t.taxBase += r.tax.base;
			t.crownTax += r.tax.crown; t.upkeep += r.upkeep; t.births += r.growth.pool; t.controlWeighted += site.L.control * r.wealth.total;
		}
		const years = (E.DB.defines.NCountry || {}).MAX_MANPOWER_YEARS ?? 5;
		t.maxManpower = t.manpower * years * 12 + state.C.mods.raw('max_manpower');
		t.maxSailors = t.sailors * years * 12 + state.C.mods.raw('max_sailors');
		t.control = t.wealth ? t.controlWeighted / t.wealth : 0;
		return t;
	}

	// market prices for next month from this month's own flows
	function stepMarkets(state, results) {
		if (state.mode === 'off') return;
		const own = {};
		for (const [site, r] of results) {
			const f = flows(r), o = (own[site.loc.market] ??= { s: {}, d: {} });
			for (const [g, x] of Object.entries(f.s)) o.s[g] = (o.s[g] || 0) + x;
			for (const [g, x] of Object.entries(f.d)) o.d[g] = (o.d[g] || 0) + x;
		}
		const age = state.sites[0] ? state.sites[0].L.age : 1;
		const v = state.C.mods.raw('export_impact_on_demand');
		const none = { Tin: 0, Tout: 0, BTin: 0, BTout: 0 };
		for (const mk of Object.values(state.markets)) {
			const o = own[mk.id] || { s: {}, d: {} };
			for (const [g, x] of Object.entries(mk.goods)) {
				if (!DB().goods[g]) continue;
				const S = Math.max(0, x.otherS + (o.s[g] || 0)), D = Math.max(0, x.otherD + x.popBase * elasticity(g, x.price) + (o.d[g] || 0));
				const { sEff, dEff } = effective(S, D, state.mode === 'closed' ? none : x.trade, v);
				x.supply = S; x.demand = D; x.target = E.targetPrice(g, sEff, dEff, age, mk.foodPrice ?? 0.05);
				x.price = E.priceStep(x.price, x.target);
				mk.prices[g] = x.price;
			}
		}
	}

	// month by month for the whole country
	function project(scn, months = 120) {
		const state = create(scn);
		const timeline = [];
		for (let mth = 0; mth <= months; mth++) {
			const { results } = evaluateAll(state, mth === 0);
			const t = totals(state, results);
			timeline.push({ month: mth, ...t, manpowerPool: state.manpowerPool, prices: Object.fromEntries(Object.entries(state.markets).map(([id, m]) => [id, { ...m.prices }])) });
			if (mth === months) break;
			state.manpowerPool = Math.max(0, Math.min(t.maxManpower, state.manpowerPool + t.manpower - state.manpowerExpense));
			for (const [site, r] of results) E.advance(site.L, r);
			stepMarkets(state, results);
		}
		return { timeline, state };
	}

	// one month, as numbers (month 0)
	function evaluate(scn) {
		const state = create(scn);
		const { results } = evaluateAll(state, true);
		return { state, results, totals: totals(state, results) };
	}

	const api = { create, evaluate, project, flows, effective, elasticity };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CountrySim = api;
})(typeof self !== 'undefined' ? self : this);
