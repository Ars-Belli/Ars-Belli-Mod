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
//   'fixed'  - imports and exports stay at the save's values, plus a response to the price: net imports grow by
//              options.tradeResponse (default 1) x the good's market volume per 100% its price is above the save's
//              (exports when below). Merchants re-route toward dear markets in the game; the trade AI is not decoded, so
//              this is an assumption that keeps a thin market from spiking (Alcañiz's town would otherwise lift alum in
//              Lisbon's market from 2.11 to 7.84)
//   'closed' - no trade with other markets
//   'off'    - no market at all: prices stay where they are
// Constructions (scn.constructions from the save, and economy.js's own) buy their demand's goods every month until they
// are done: the save's are taken out of the held demand and run out as they finish.
// options.marketCalibration: 'rest' (default) starts every market at rest - its target equal to today's price - since one
// month's supply and demand are noisy (in Spain's June 1547 save 40% of the goods have a target 25%+ away from their
// price, while their 119-month price histories are flat); 'snapshot' keeps the month as it is (its target reproduces the
// save's next price step).
// Pop demand and food are not simulated yet (research open), so prices react to production and building demand only.
(function (root) {
	'use strict';
	const E = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.LocationSim;
	const DB = () => E.DB;
	// map.json (build_map.js): neighbours with river links, straits, ports. Node loads it; the page passes it with setMap().
	let MAP = null;
	const setMap = m => { MAP = m; };
	const mapData = () => MAP || (typeof module !== 'undefined' && module.exports ? (MAP = require('./map.json')) : null);
	const sumObj = o => Object.values(o || {}).reduce((a, x) => a + (+x || 0), 0);

	// a location of the country scenario as a single-location scenario
	const locationScenario = (scn, loc) => ({ location: loc, country: scn.country, market: (scn.markets || {})[loc.market] || {}, observed: (scn.observed || {})[loc.id] || {} });

	// own supply and demand of one evaluated location, per good (units a month; demand_food.md 2): goods put on the market
	// carry no market-access factor, goods bought do
	function flows(r) {
		const s = {}, d = {};
		const add = (o, g, x) => { if (g && x) o[g] = (o[g] || 0) + x; };
		if (r.rgo.good) add(s, r.rgo.good, r.rgo.output);
		const rowOf = new Map(r.buildings.rows.map(x => [x.idx, x]));
		for (const [idx, b] of r.L.buildings.entries()) {
			const t = DB().buildings[b.type], pm = E.methodOf(b), row = rowOf.get(idx);
			if (!t || !pm || !b.level || !row) continue;
			if (pm.out) {
				add(s, pm.out, row.output);
				for (const [g, n] of Object.entries(pm.in || {})) add(d, g, b.level * r.L.marketAccess * row.employment * n);
			} else for (const [g, n] of Object.entries(pm.in || {})) add(d, g, b.level * r.L.marketAccess * (t.alwaysDemand ? 1 : row.employment) * n);
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
		// options.food: 'on' (default) simulates province stores and market food; 'off' keeps the growth food terms as given
		// options.proximity: 'computed' recomputes every location's proximity each month (needs map.json and the roads),
		// 'given' keeps the scenario's values
		const proxMode = (scn.options || {}).proximity || (scn.roads ? 'computed' : 'given');
		const calibration = (scn.options || {}).marketCalibration || 'rest', tradeResponse = (scn.options || {}).tradeResponse ?? 1;
		const state = { scn, C, mode, calibration, tradeResponse, food: (scn.options || {}).food !== 'off', proxMode, sites, markets, month: 0, manpowerPool: obs.manpower ?? 0, manpowerExpense: expense, history: [] };
		const first = evaluateAll(state, true);
		// provinces (food stores): the save's province id, else the map's province of the location
		const provinces = {};
		for (const site of sites) {
			const tpl = E.DB.locations[(site.loc.id || 0) - 1];
			const pid = site.loc.province ?? (tpl ? 'p' + tpl[10] : 'p?');
			const p = (provinces[pid] ??= { id: pid, sites: [], current: null, maxSave: null, market: site.loc.market });
			p.sites.push(site);
			const o = (site.scn.observed || {}).province || {};
			if (p.current === null && o.food !== undefined) { p.current = o.food; p.maxSave = o.maxFood; }
			if (site.loc.provinceCapital || site.L.capital) p.capitalSite = site;
		}
		for (const p of Object.values(provinces)) {
			p.capitalSite ??= p.sites[0];
			p.cap0 = p.sites.reduce((a, site) => a + first.results.get(site).food.capacity, 0);
			if (p.current === null) p.current = 0.75 * (p.maxSave ?? p.cap0);
		}
		state.provinces = provinces;
		const marketOfLoc = new Map(sites.map(site => [+site.loc.id, site.loc.market]));
		state.constructions = (scn.constructions || []).map(c => ({ market: marketOfLoc.get(+c.location), goods: (E.DB.demands[c.demand] || {}).goods || {}, months: c.days / 30.4 }))
			.filter(c => c.market !== undefined && Object.keys(c.goods).length);
		const built = constructionDemand(state);
		for (const mk of Object.values(markets)) {
			mk.food = mk.src.food ?? 0; mk.maxFood0 = mk.src.maxFood ?? 0; mk.foodTrade = mk.src.foodTrade ?? 0;
			mk.ownCap0 = Object.values(provinces).filter(p => String(p.market) === String(mk.id)).reduce((a, p) => a + (p.maxSave ?? p.cap0), 0);
		}
		const own = ownFlows(first.results);
		for (const mk of Object.values(markets)) {
			const o = own[mk.id] || { s: {}, d: {} };
			mk.pop0 = sites.filter(site => String(site.loc.market) === String(mk.id)).reduce((a, site) => a + site.L.population, 0);
			mk.typed0 = typedPop(sites, mk.id);
			for (const [g, x] of Object.entries(mk.src.goods || {})) {
				const sup = x.supplied || {}, dem = x.demanded || {};
				const prod = sup.Production ?? sumObj(x.production);
				const demand = sumObj(dem) - (dem.Trade || 0) - (dem.BurgherTrades || 0) - ((built[mk.id] || {})[g] || 0), pops = dem.Pops || 0;
				mk.goods[g] = {
					// pop demand kept apart: its base (before price elasticity) is fixed, the elasticity follows the price
					price: x.price, otherS: prod - (o.s[g] || 0), otherD: demand - pops - (o.d[g] || 0), popBase: pops / elasticity(g, x.price),
					trade: { Tin: sup.Trade || 0, Tout: dem.Trade || 0, BTin: sup.BurgherTrades || 0, BTout: dem.BurgherTrades || 0 },
				};
				if (DB().goods[g]) calibrate(state, mk, g, mk.goods[g], (o.s[g] || 0), (o.d[g] || 0) + ((built[mk.id] || {})[g] || 0));
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
		const t = { population: 0, manpower: 0, sailors: 0, armyLevies: 0, navyLevies: 0, wealth: 0, taxBase: 0, crownTax: 0, upkeep: 0, births: 0, controlWeighted: 0, foodProduction: 0, foodConsumption: 0 };
		for (const [site, r] of results) {
			t.population += site.L.population; t.manpower += r.manpower.monthly; t.sailors += r.sailors.monthly;
			t.armyLevies += r.levies.army; t.navyLevies += r.levies.navy; t.wealth += r.wealth.total; t.taxBase += r.tax.base;
			t.crownTax += r.tax.crown; t.upkeep += r.upkeep; t.births += r.growth.pool; t.controlWeighted += site.L.control * r.wealth.total;
			t.foodProduction += r.food.production; t.foodConsumption += r.food.consumption;
		}
		const years = (E.DB.defines.NCountry || {}).MAX_MANPOWER_YEARS ?? 5;
		t.maxManpower = t.manpower * years * 12 + state.C.mods.raw('max_manpower');
		t.maxSailors = t.sailors * years * 12 + state.C.mods.raw('max_sailors');
		t.control = t.wealth ? t.controlWeighted / t.wealth : 0;
		return t;
	}

	// a pop type's weight in a good's demand (demand_food.md: per 1,000 pops (all + type + upper) x the type's and upper
	// multipliers), and a market's pops summed with those weights, per good
	const popWeights = {};
	function popWeight(type, g) {
		const key = type + '|' + g;
		if (key in popWeights) return popWeights[key];
		const good = DB().goods[g] || {}, add = good.demandAdd || {}, mul = good.demandMultiply || {}, upper = !!(DB().pops[type] || {}).upper;
		const base = (add.all || 0) + (add[type] || 0) + (upper ? add.upper || 0 : 0);
		return (popWeights[key] = base * (mul[type] ?? 1) * (upper ? (mul.upper ?? 1) : 1));
	}
	function typedPop(sites, marketId) {
		const byType = {};
		for (const site of sites) if (String(site.loc.market) === String(marketId)) for (const p of site.L.pops) byType[p.type] = (byType[p.type] || 0) + p.size;
		const out = {};
		for (const g of Object.keys(DB().goods)) { let w = 0; for (const [type, n] of Object.entries(byType)) w += n * popWeight(type, g); out[g] = w; }
		return out;
	}

	// the goods every market's constructions under way buy this month
	function constructionDemand(state) {
		const out = {};
		for (const c of state.constructions || []) { const x = (out[c.market] ??= {}); for (const [g, a] of Object.entries(c.goods)) x[g] = (x[g] || 0) + a * Math.min(1, c.months); }
		return out;
	}
	// the own supply and demand of every market (flows summed over the country's locations in it)
	function ownFlows(results) {
		const own = {};
		for (const [site, r] of results) {
			const f = flows(r), o = (own[site.loc.market] ??= { s: {}, d: {} });
			for (const [g, x] of Object.entries(f.s)) o.s[g] = (o.s[g] || 0) + x;
			for (const [g, x] of Object.entries(f.d)) o.d[g] = (o.d[g] || 0) + x;
		}
		return own;
	}
	// pop demand scales with the population of the country's locations in the market (foreign members held), each good
	// weighted by every pop type's demand for it: promoted burghers, nobles and clergy raise what they buy most
	function popScales(state, mk) {
		const pop = state.sites.filter(site => String(site.loc.market) === String(mk.id)).reduce((a, site) => a + site.L.population, 0);
		const popScale = mk.pop0 > 0 ? pop / mk.pop0 : 1;
		const typed = mk.typed0 ? typedPop(state.sites, mk.id) : null;
		return g => (typed && mk.typed0[g] > 0 ? typed[g] / mk.typed0[g] : popScale);
	}
	const NO_TRADE = { Tin: 0, Tout: 0, BTin: 0, BTout: 0 };
	// a good's target price from its supply, its demand without pops (Dn) and the pops' demand before elasticity (popD)
	function target(state, mk, g, S, Dn, popD, price) {
		const x = mk.goods[g], age = state.sites[0] ? state.sites[0].L.age : 1;
		const { sEff, dEff } = effective(Math.max(0, S), Math.max(0, Dn + popD * elasticity(g, price)), state.mode === 'closed' ? NO_TRADE : x.trade, state.C.mods.raw('export_impact_on_demand'));
		// trade response (fixed mode): imports when dearer than the save, exports when cheaper
		const t = state.mode === 'fixed' && x.volume ? state.tradeResponse * x.volume * (price / x.price0 - 1) : 0;
		return E.targetPrice(g, Math.max(0, sEff + (x.calS || 0) + Math.max(0, t)), Math.max(0, dEff + (x.calD || 0) + Math.max(0, -t)), age, mk.foodPrice ?? 0.05);
	}
	// 'rest' calibration: effective supply and demand moved to the ratio whose target is today's price, their sum kept
	// (R = (k Sp + Dp) / (k Dp + Sp) = p / default gives Dp / Sp = (R - k) / (1 - R k); Sp, Dp include the +1 offset and
	// the food x1.25). A price at the age's clamp stays as the month has it.
	function calibrate(state, mk, g, x, ownS, ownD) {
		x.calS = 0; x.calD = 0;
		if (state.mode === 'off' || !(x.price > 0)) return;
		const D = Math.max(0, x.otherD + ownD + x.popBase * elasticity(g, x.price));
		const { sEff, dEff } = effective(Math.max(0, x.otherS + ownS), D, state.mode === 'closed' ? NO_TRADE : x.trade, state.C.mods.raw('export_impact_on_demand'));
		// the trade response's reference: the save's price and the good's market volume (mean of effective supply and demand)
		x.price0 = x.price; x.volume = (sEff + dEff) / 2;
		if (state.calibration === 'snapshot') return;
		const good = DB().goods[g], age = state.sites[0] ? state.sites[0].L.age : 1, a = DB().ages[age] || DB().ages[1];
		const k = Math.min(a.priceStability, 1), R = x.price / good.price;
		if (!(R > a.minPrice && R < a.maxPrice && R > k && R * k < 1)) return;
		const off = (DB().defines.NEconomy || {}).SUPPLY_AND_DEMAND_STABILITY_OFFSET_CONSTANT ?? 1;
		const f = good.food > 0 && (mk.foodPrice ?? 0.05) > ((DB().defines.NMarket || {}).FOOD_PRICE ?? 0.05) ? 1 + ((DB().defines.NMarket || {}).FOOD_PRICE_IMPACT_ON_PRICES ?? 0.25) : 1;
		const Sp = sEff + off, Dp = dEff * f + off, rho = (R - k) / (1 - R * k), Sp2 = (Sp + Dp) / (1 + rho);
		x.calS = Sp2 - Sp; x.calD = (rho * Sp2 - Dp) / f;
	}

	// market prices for next month from this month's own flows
	function stepMarkets(state, results) {
		if (state.mode === 'off') return;
		const own = ownFlows(results), built = constructionDemand(state);
		for (const mk of Object.values(state.markets)) {
			const o = own[mk.id] || { s: {}, d: {} }, b = built[mk.id] || {}, scale = popScales(state, mk);
			for (const [g, x] of Object.entries(mk.goods)) {
				if (!DB().goods[g]) continue;
				const S = Math.max(0, x.otherS + (o.s[g] || 0)), Dn = x.otherD + (o.d[g] || 0) + (b[g] || 0), popD = x.popBase * scale(g);
				x.supply = S; x.demand = Math.max(0, Dn + popD * elasticity(g, x.price));
				x.target = target(state, mk, g, S, Dn, popD, x.price);
				x.price = E.priceStep(x.price, x.target);
				mk.prices[g] = x.price;
			}
		}
		// a month of construction done
		for (const c of state.constructions || []) c.months -= 1;
		state.constructions = (state.constructions || []).filter(c => c.months > 1e-9);
	}

	// planning view of the markets (economy.js): the price a good settles at - where the monthly steps lead with nothing
	// else changing - with extra own supply dS and demand dD (units a month), pop demand following the price. With
	// markets off prices never move.
	function marketView(state, results) {
		const own = ownFlows(results), built = constructionDemand(state), scales = {}, memo = new Map();
		for (const mk of Object.values(state.markets)) scales[mk.id] = popScales(state, mk);
		function settled(mkId, g, dS = 0, dD = 0) {
			const mk = state.markets[mkId], x = mk && mk.goods[g];
			if (!x || !DB().goods[g]) return null;
			if (state.mode === 'off') return x.price;
			const key = mkId + '|' + g + '|' + dS + '|' + dD;
			if (memo.has(key)) return memo.get(key);
			const o = own[mkId] || { s: {}, d: {} };
			const S = x.otherS + (o.s[g] || 0) + dS, Dn = x.otherD + (o.d[g] || 0) + ((built[mkId] || {})[g] || 0) + dD, popD = x.popBase * scales[mkId](g);
			// the target falls as the price rises (pop demand shrinks above the base price, trade responds), so
			// target(p) - p falls and has one root: bisection between the age's price clamps
			const base = DB().goods[g].price, a = DB().ages[state.sites[0] ? state.sites[0].L.age : 1] || DB().ages[1];
			let lo = base * a.minPrice * 0.999, hi = base * a.maxPrice * 1.001 + Math.abs(x.price);
			for (let i = 0; i < 60 && hi - lo > 1e-9 * hi; i++) { const mid = (lo + hi) / 2; if (target(state, mk, g, S, Dn, popD, mid) > mid) lo = mid; else hi = mid; }
			const p = (lo + hi) / 2;
			memo.set(key, p);
			return p;
		}
		return { own, settled, price: (mkId, g) => ((state.markets[mkId] || {}).goods || {})[g] ? state.markets[mkId].goods[g].price : null };
	}

	// Food (demand_food.md 3): each province applies its month (production - consumption - decay) to its store, sells what is
	// above 75% of its capacity to the market or asks to be refilled to 75% when it runs a deficit; the market then refills
	// buyers to 75% and tops its sellers back up (to full, or by 3 months of deficit) from its food above 25% of capacity, and
	// moves its food price. With markets off, each province keeps its own store. Foreign members' food is not simulated.
	function stepFood(state, results) {
		const N = E.DB.defines.NMarket || {}, global = state.C.mods.raw('global_food_decay');
		const reserveRatio = N.FOOD_PROVINCE_LOCAL_RESERVE_RATIO ?? 0.75;
		const lists = {};
		for (const p of Object.values(state.provinces)) {
			const rs = p.sites.map(site => results.get(site));
			const simCap = rs.reduce((a, r) => a + r.food.capacity, 0);
			p.cap = p.maxSave !== null && p.cap0 > 0 ? p.maxSave * simCap / p.cap0 : simCap;
			p.current = Math.min(Math.max(p.current, 0), p.cap);
			p.base = rs.reduce((a, r) => a + r.food.baseConsumption, 0);
			p.consumption = rs.reduce((a, r) => a + r.food.consumption, 0);
			p.production = rs.reduce((a, r) => a + r.food.production, 0);
			p.structural = p.production - p.consumption;
			const pres = Math.max(0, rs.reduce((a, r) => a + r.food.preservation, 0));
			const capR = results.get(p.capitalSite);
			p.decay = Math.max(0, p.current) * ((capR ? capR.food.decay : 0) + global) / (1 + pres);
			p.change = p.structural - p.decay;
			p.current = Math.min(Math.max(p.current + p.change, 0), 2 * p.cap);
			p.trade = 0;
			if (state.mode === 'off' || !state.markets[p.market]) continue;
			const mk = state.markets[p.market], l = (lists[p.market] ??= { buyers: [], sellers: [], produced: 0, added: 0 });
			const reserve = reserveRatio * p.cap;
			if (p.current > reserve) { const sold = p.current - reserve; mk.food += sold; l.produced += sold; p.trade = -sold; p.current = reserve; l.sellers.push(p); }
			else if (p.structural < 0 && p.current < reserve) l.buyers.push(p);
		}
		for (const mk of Object.values(state.markets)) {
			mk.maxFood = mk.maxFood0 + Object.values(state.provinces).filter(p => String(p.market) === String(mk.id)).reduce((a, p) => a + p.cap, 0) - mk.ownCap0;
			const l = lists[mk.id] || { buyers: [], sellers: [], produced: 0, added: 0 };
			if (state.mode !== 'off') {
				const pass = (list, needOf, avail) => {
					const w = list.map(p => [p, Math.max(0, needOf(p))]).filter(([, x]) => x > 0);
					const total = w.reduce((a, [, x]) => a + x, 0);
					const scale = total > 0 && avail < total ? Math.max(0, avail) / total : 1;
					for (const [p, x] of w) { const t = Math.min(x * scale, mk.food); mk.food -= t; l.added += t; p.trade += t; p.current = Math.min(p.current + t, p.cap); }
				};
				pass(l.buyers, p => reserveRatio * p.cap - p.current, mk.food);
				const months = N.FOOD_PASS2_MAX_MONTHS_OF_DEFICIT ?? 3;
				pass(l.sellers, p => { const x = months * Math.max(0, -p.structural), room = p.cap - p.current; return x < 1 ? room : Math.min(x, room); },
					mk.food - (N.FOOD_PROPORTION_TO_PRESERVE_IN_MARKET_IF_POSSIBLE ?? 0.25) * mk.maxFood);
				const trade = state.mode === 'fixed' ? mk.foodTrade : 0;
				mk.food = Math.min(Math.max(mk.food + trade, 0), mk.maxFood);
				// food price (3.8): heads for 0.05 x R, R from months of stock left (net outflow) or how empty the store is
				const age = E.DB.ages[state.sites[0].L.age] || E.DB.ages[1];
				const flow = l.produced - l.added + trade;
				let R;
				if (mk.maxFood <= 0) R = 1;
				else if (flow < 0) { const m = mk.food / -flow; R = m <= 0 ? age.maxPrice : 5 / m; }
				else R = age.minPrice + (1 - age.minPrice) * (1 - Math.min(1, Math.max(0, mk.food / mk.maxFood)));
				R = Math.min(age.maxPrice, Math.max(age.minPrice, R));
				const target = Math.max(0.01, (N.FOOD_PRICE ?? 0.05) * R);
				mk.foodPrice = (mk.foodPrice ?? 0.05) + (N.MONTHLY_PRICE_CHANGE ?? 0.05) * (target - (mk.foodPrice ?? 0.05));
				mk.foodFlow = flow;
			}
		}
		// growth terms and starvation for next month, from the store after the exchange
		for (const p of Object.values(state.provinces)) {
			p.current = Math.min(Math.max(p.current, 0), p.cap);
			p.starving = p.current < 1 || (p.structural <= 0 && p.current <= -p.structural && p.trade >= 0 && p.trade + p.structural < 1);
			const surplus = p.base > 0 ? Math.min(1, Math.max(0, p.structural / p.base / 0.25)) : 0;
			const storage = p.base > 0 ? Math.min(p.current / (12 * p.base), 2) / 2 : 0;
			for (const site of p.sites) {
				site.L.food = { surplus, storage, starving: p.starving };
				const mk = state.markets[site.loc.market];
				if (mk && mk.foodPrice !== undefined) site.L.foodPrice = mk.foodPrice;
			}
		}
	}

	// Proximity (proximity_development.md 1): every source (capital 100, Local Governor 80 x its staffing...) spreads
	// strength minus the cost of each jump through the country's own land and every sea zone and lake, never foreign land;
	// a location takes the best value over all sources. Jump cost = base x factor / (1 + speed), at least 0.01.
	const LAKES = new Set(['lakes', 'high_lakes', 'salt_pans']), SEAS = new Set(['ocean', 'deep_ocean', 'coastal_ocean', 'inland_sea', 'narrows', 'atoll']);
	function proximity(state, results) {
		const map = mapData();
		if (!map) return null;
		const T = id => E.DB.locations[id - 1] || [];
		const own = new Map(state.sites.map(site => [site.loc.id, site]));
		const isLake = id => LAKES.has(T(id)[1]), isWater = id => LAKES.has(T(id)[1]) || SEAS.has(T(id)[1]);
		const m = k => state.C.mods.raw(k);
		const c = { land: m('land_cost_on_distance_from_capital'), road: m('road_cost_on_distance_from_capital'), down: m('land_cost_going_downstream'),
			sea: m('sea_cost_on_distance_from_capital'), seaM: m('sea_cost_on_distance_from_capital_when_maritime'), port: m('port_cost_distance_from_capital'),
			trans: m('sea_land_transition_cost_distance_from_capital'), G: m('global_distance_from_capital_speed_propagation'), Gl: m('land_cost_on_distance_from_capital_speed_propagation') };
		const floor = (E.DB.defines.NCountry || {}).PROXIMITY_TERRAIN_SPEED_FLOOR ?? 0.25;
		if (!state.roadIndex) {
			state.roadIndex = new Map();
			for (const [a, b, t] of state.scn.roads || []) { state.roadIndex.set(a + ',' + b, t); state.roadIndex.set(b + ',' + a, t); }
			state.straits = new Map();
			for (const [a, b, z] of map.straits || []) { state.straits.set(a + ',' + b, z); state.straits.set(b + ',' + a, z); }
		}
		const presence = z => isLake(z) ? 1 : ((state.scn.maritime || {})[z] || 0) / 100;
		const seaCost = z => c.seaM * presence(z) + c.sea * (1 - presence(z));
		const mods = id => results.get(own.get(id)).M;
		const river = (a, b) => ((map.locations[a] || {}).nb || []).some(n => n[0] === b && n[2]);
		function cost(a, b) {
			const la = own.has(a), lb = own.has(b);
			let base, factor = 1, plain = false, S = c.G + (la ? mods(a).loc('local_distance_from_capital_speed_propagation') : 0);
			if (la && lb) {
				const z = state.straits.get(a + ',' + b);
				if (z) base = seaCost(z);
				else {
					base = c.land; plain = true;
					const r = state.roadIndex.get(a + ',' + b);
					if (r) { base = c.road - ((E.DB.roadTypes[r] || {}).proximity || 0); plain = false; }
					if (river(a, b) && c.down < base) { base = c.down; plain = false; }
				}
				const ta = T(a)[1], tb = T(b)[1], tp = (E.DB.terrain.topography[ta] || {}).proximity;
				let tv = tp && typeof tp === 'object' ? (tb in (tp.override || {}) ? tp.override[tb] : tp.default) : 0;
				tv *= 1 + m(ta + '_proximity_impact');
				const veg = (E.DB.terrain.vegetation[T(a)[2]] || {}).proximity;
				const speed = Math.max(floor, (plain ? 1 + (typeof veg === 'number' ? veg : 0) : 1) + Math.min(0, tv));
				base /= speed; S += c.Gl;
			} else if (isLake(a) || isLake(b)) base = c.seaM;
			else if (!la && !lb) base = seaCost(a);
			else {
				const land = la ? a : b, sea = la ? b : a;
				if (String(map.ports[land]) === String(sea)) { base = c.port; factor = Math.max(0.05, 1 + mods(land).loc('local_port_cost_distance_impact')); }
				else base = c.trans;
			}
			return Math.max(0.01, base * factor / (1 + Math.max(-0.95, S)));
		}
		const strait = new Map();
		for (const k of state.straits.keys()) { const [x, y] = k.split(',').map(Number); (strait.get(x) || strait.set(x, []).get(x)).push(y); }
		const nbs = id => ((map.locations[id] || {}).nb || []).map(n => n[0]).concat(strait.get(id) || []);
		// sources and a max-first search (Dijkstra on -value)
		const best = new Map(), heap = [];
		const push = (v, id) => { heap.push([v, id]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] >= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
		const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let k = i; if (l < heap.length && heap[l][0] > heap[k][0]) k = l; if (r < heap.length && heap[r][0] > heap[k][0]) k = r; if (k === i) break; [heap[k], heap[i]] = [heap[i], heap[k]]; i = k; } } return top; };
		const sources = [];
		for (const [id, site] of own) {
			const M = results.get(site).M, lps = M.loc('local_proximity_source');
			if (lps <= 0) continue;
			const v = Math.min(100, lps) * (1 + Math.max(-1, M.loc('local_proximity_source_modifier')));
			sources.push([id, v]); best.set(id, v); push(v, id);
		}
		while (heap.length) {
			const [v, id] = pop();
			if (v < (best.get(id) ?? 0) || v <= 0) continue;
			for (const nb of nbs(id)) {
				if (!own.has(nb) && !isWater(nb)) continue;
				const nv = v - cost(id, nb);
				if (nv > (best.get(nb) ?? 0)) { best.set(nb, nv); push(nv, nb); }
			}
		}
		for (const [id, site] of own) site.L.proximity = Math.max(0, best.get(id) || 0);
		return { sources, cost, best };
	}

	// month by month for the whole country
	function project(scn, months = 120) {
		const state = create(scn);
		const timeline = [];
		// options.schedule: [{ month, location, building }] finishes a building at the start of that month (a construction)
		const schedule = (scn.options || {}).schedule || [];
		for (let mth = 0; mth <= months; mth++) {
			for (const ev of schedule) if (ev.month === mth) { const site = state.sites.find(x => x.loc.id === ev.location); if (site) site.L.buildings.push({ level: 1, ...ev.building }); }
			const { results } = evaluateAll(state, mth === 0);
			const t = totals(state, results);
			const provs = Object.values(state.provinces);
			timeline.push({ month: mth, ...t, manpowerPool: state.manpowerPool, prices: Object.fromEntries(Object.entries(state.markets).map(([id, m]) => [id, { ...m.prices }])),
				foodStored: provs.reduce((a, p) => a + p.current, 0), foodCapacity: provs.reduce((a, p) => a + (p.cap ?? p.maxSave ?? p.cap0), 0), starving: provs.filter(p => p.starving).length,
				marketFood: Object.fromEntries(Object.entries(state.markets).map(([id, m]) => [id, { food: m.food, max: m.maxFood ?? m.maxFood0, price: m.foodPrice }])) });
			if (mth === months) break;
			state.manpowerPool = Math.max(0, Math.min(t.maxManpower, state.manpowerPool + t.manpower - state.manpowerExpense));
			for (const [site, r] of results) E.advance(site.L, r);
			if (state.proxMode === 'computed') proximity(state, results);
			if (state.food) stepFood(state, results);
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

	const api = { create, evaluate, project, flows, ownFlows, constructionDemand, effective, elasticity, stepFood, stepMarkets, marketView, evaluateAll, totals, proximity, setMap, popWeight };
	if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CountrySim = api;
})(typeof self !== 'undefined' ? self : this);
