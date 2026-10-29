// Builds a location simulator scenario from an EU5 save (normal binary save or debug-mode text save).
//   node .tools/scripts/location_sim/from_save.js <save.eu5|latest> --list <TAG> [--top 40]     a country's locations
//   node .tools/scripts/location_sim/from_save.js <save> --location <id|key> [--out scenario.json]
// The scenario holds the location as the save has it (rank, development, control, pops, buildings, market prices), its
// owner's country modifiers (summed from base values, advances, laws, privileges, reforms, timed modifiers and societal
// values; "notes" lists every source) and an "observed" block with the game's own numbers to check the simulator against.
const fs = require('fs');
const path = require('path');
const { loadDb, get, openSave, latestSave } = require('../battle_sim/paradox.js');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8'));

const args = process.argv.slice(2);
const flag = k => { const i = args.indexOf(k); return i < 0 ? undefined : args[i + 1]; };
const saveArg = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const file = !saveArg || saveArg === 'latest' ? latestSave() : saveArg;
if (!file) throw new Error('no save found');
const save = openSave(file);
const isText = !!save.text;
const N = x => (x === undefined || x === null || x === '' ? undefined : +x);
const list = x => (x === undefined ? [] : Array.isArray(x) ? x : x.__list || (typeof x === 'object' ? Object.values(x) : String(x).trim().split(/\s+/)));

// ---- one entry of a save section (text saves: found by its indentation, without parsing the whole section)
const INDENT = { countries: '', locations: '\t\t', population: '', market_manager: '', provinces: '', building_manager: '' };
function entry(section, id) {
	if (isText) return save.entry(section, id, INDENT[section]);
	const s = save.section(section);
	return (s.database && s.database[id]) || (s.locations && s.locations[id]) || s[id] || null;
}
const locKeys = DATA.locations.map(l => l[0]);
const locId = q => /^\d+$/.test(q) ? +q : locKeys.indexOf(q) + 1;
const locKey = id => locKeys[+id - 1];

// country tag <-> id
function countryIds() {
	if (isText) {
		const t = save.sectionText('countries');
		const i = t.indexOf('tags={');
		const block = t.slice(i, t.indexOf('}', i));
		const out = {};
		for (const m of block.matchAll(/(\d+)=([A-Za-z0-9_]+)/g)) out[m[1]] = m[2];
		return out;
	}
	return save.section('countries').tags;
}
const tags = countryIds();
const idOfTag = tag => Object.keys(tags).find(id => tags[id] === tag);

// buildings in a location
function buildingsAt(lid) {
	const out = [];
	if (isText) {
		const t = save.sectionText('building_manager');
		const re = new RegExp('\\n\\tlocation=' + lid + '\\n', 'g');
		let m;
		while ((m = re.exec(t))) {
			const start = t.lastIndexOf('\n', t.lastIndexOf('={', m.index)) + 1;
			const id = (/^(\d+)=\{/.exec(t.slice(start, start + 20)) || [])[1];
			if (id) out.push({ id, ...save.entry('building_manager', id, '') });
		}
		return out;
	}
	for (const [id, b] of Object.entries(save.section('building_manager').database || {})) if (b && +b.location === +lid) out.push({ id, ...b });
	return out;
}

// ---- the owner's country modifiers (a partial sum; see notes)
const advances = loadDb('in_game/common/advances');
const laws = loadDb('in_game/common/laws');
const privileges = loadDb('in_game/common/estate_privileges');
const reforms = loadDb('in_game/common/government_reforms');
const societal = loadDb('in_game/common/societal_values');
const policies = {};
for (const law of Object.values(laws)) for (const [k, v] of law) if (Array.isArray(v) && (get(v, 'country_modifier') || get(v, 'location_modifier'))) policies[k] = v;
// adds a modifier block to acc, with each key's sources in acc.__src (key -> [[source, value]])
function addBlock(acc, notes, source, block, scale = 1) {
	if (!Array.isArray(block)) return;
	const parts = [];
	const src = (acc.__src ??= {});
	for (const [k, v] of block) {
		if (Array.isArray(v)) continue;
		let x = parseFloat(v);
		if (!Number.isFinite(x) && DATA.values[v] !== undefined) x = DATA.values[v];
		if (!Number.isFinite(x) || !x || !DATA.modifierTypes[k]) continue;
		acc[k] = +((acc[k] || 0) + x * scale).toFixed(6);
		(src[k] ??= []).push([source, +(x * scale).toFixed(6)]);
		parts.push(`${k} ${x * scale > 0 ? '+' : ''}${+(x * scale).toFixed(4)}`);
	}
	if (parts.length) notes.push(`${source}: ${parts.join(', ')}`);
}
const strip = o => Object.fromEntries(Object.entries(o).filter(([k]) => k !== '__src'));
function countryContext(cid) {
	const c = entry('countries', cid);
	const acc = {}, notes = [], locMods = {}, locNotes = [];
	addBlock(acc, notes, 'base values', Object.entries(DATA.countryBase).map(([k, v]) => [k, String(v)]));
	for (const adv of Object.keys(c.researched_advances || {})) addBlock(acc, notes, `advance ${adv}`, advances[adv]);
	const gov = c.government || {};
	for (const [law, v] of Object.entries(gov.implemented_laws || {})) {
		const p = policies[v.object] || [];
		addBlock(acc, notes, `law ${law} = ${v.object}`, get(p, 'country_modifier'));
		addBlock(locMods, locNotes, `law ${law} = ${v.object} (location_modifier)`, get(p, 'location_modifier'));
	}
	for (const p of list(gov.implemented_privileges)) {
		const d = privileges[p.object] || [];
		addBlock(acc, notes, `privilege ${p.object}`, get(d, 'country_modifier'));
		addBlock(locMods, locNotes, `privilege ${p.object} (location_modifier)`, get(d, 'location_modifier'));
	}
	for (const r of list(gov.implemented_reforms)) {
		const d = reforms[r.object] || [];
		addBlock(acc, notes, `reform ${r.object}`, get(d, 'country_modifier'));
		addBlock(locMods, locNotes, `reform ${r.object} (location_modifier)`, get(d, 'location_modifier'));
	}
	for (const t of list((c.timed_modifiers || {}).timed_modifiers)) {
		const s = DATA.static[t.modifier];
		if (s) addBlock(acc, notes, `timed modifier ${t.modifier}`, Object.entries(s.m).map(([k, v]) => [k, String(v)]), +(t.size || 1));
	}
	for (const [sv, val] of Object.entries(gov.societal_values || {})) {
		const x = +val;
		if (!Number.isFinite(x) || x <= -999 || !x || !societal[sv]) continue;
		addBlock(acc, notes, `societal value ${sv} ${x > 0 ? '+' : ''}${x.toFixed(0)}`, get(societal[sv], x < 0 ? 'left_modifier' : 'right_modifier'), Math.abs(x) / 100);
	}
	const econ = c.economy || {};
	return {
		id: +cid, tag: tags[cid], capital: N(c.capital), primaryCulture: N(c.primary_culture), acceptedCultures: list(c.accepted_cultures).map(Number),
		religion: N(c.primary_religion), government: gov.type,
		taxRates: Object.fromEntries(Object.entries(econ.tax_rates || {}).map(([k, v]) => [k, +v])),
		estates: Object.fromEntries(Object.entries(gov.estates || {}).map(([k, v]) => [k, typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'object').map(([f, x]) => [f, N(x) ?? x])) : v])),
		modifiers: strip(acc), sources: acc.__src || {}, locationModifiers: strip(locMods), locationSources: locMods.__src || {},
		notes: [...notes, ...locNotes, 'Not counted: religion, culture, ruler and cabinet, estates satisfaction and power effects, situations, international organizations, conditional auto modifiers.'],
		observed: {
			manpowerIncome: N(c.last_month_manpower_income), manpowerNet: N(c.monthly_manpower), maxManpower: N(c.max_manpower),
			sailorsIncome: N(c.last_month_sailors_income), maxSailors: N(c.max_sailors), taxIncome: N(c.last_months_tax_income),
			goldIncome: N(c.last_month_gold_income), population: N(c.last_months_population), manpower: N((c.currency_data || {}).manpower),
		},
	};
}

// ---- --list TAG: the country's locations, richest first
if (flag('--list')) {
	const cid = idOfTag(flag('--list'));
	if (!cid) throw new Error('no country ' + flag('--list'));
	const c = entry('countries', cid);
	const rows = [];
	for (const lid of list(c.owned_locations)) {
		const l = entry('locations', lid);
		if (!l) continue;
		rows.push({ lid, key: locKey(lid), rank: l.rank, tax: +l.tax || 0, control: +l.control || 0, dev: +l.development || 0, raw: l.raw_material });
	}
	rows.sort((a, b) => b.tax - a.tax);
	console.log(`${tags[cid]} (${cid}): ${rows.length} locations, capital ${locKey(c.capital)} (${c.capital})`);
	for (const r of rows.slice(0, +(flag('--top') || 40)))
		console.log(`  ${String(r.lid).padStart(6)} ${r.key.padEnd(24)} ${(r.rank || '').padEnd(17)} tax ${r.tax.toFixed(2).padStart(8)}  control ${(100 * r.control).toFixed(0).padStart(3)}%  dev ${r.dev.toFixed(1).padStart(5)}  ${r.raw || ''}`);
	process.exit(0);
}

// ---- --location: one location as a scenario
const q = flag('--location');
if (!q) { console.error('usage: from_save.js <save|latest> --list TAG | --location <id|key> [--out file.json]'); process.exit(1); }
const lid = locId(q);
const l = entry('locations', lid);
if (!l) throw new Error('no location ' + q);
const [key, topography, vegetation, climate, rawTemplate, harbor] = DATA.locations[lid - 1];
const country = countryContext(l.owner);
const cultureStatus = p => p.status || 'none';
const pops = [];
for (const pid of list((l.population || {}).pops)) {
	const p = entry('population', pid);
	if (!p) continue;
	pops.push({ type: p.type, estate: p.estate, size: N(p.size), status: cultureStatus(p), culture: N(p.culture), religion: N(p.religion),
		satisfaction: N(p.satisfaction) ?? 0, literacy: N(p.literacy) ?? 0, ...(p.building ? { building: N(p.building) } : {}) });
}
const buildings = buildingsAt(lid).map(b => {
	const pm = Object.keys(b).find(k => b[k] && typeof b[k] === 'object' && DATA.methods[k]);
	return { type: b.type, level: N(b.level), employed: N(b.employed), owner: N(b.owner), ...(+b.owner !== +l.owner ? { foreign: 1 } : {}),
		...(pm ? { method: pm } : {}), ...(b.last_months_profit !== undefined ? { profit: N(b.last_months_profit) } : {}), ...(b.upkeep !== undefined ? { upkeep: N(b.upkeep) } : {}) };
});
const market = l.market ? entry('market_manager', l.market) : null;
const prices = {};
if (market && market.goods) for (const [g, v] of Object.entries(market.goods)) if (v && v.price !== undefined) prices[g] = +v.price;
const province = l.province ? entry('provinces', l.province) : null;
const stats = (l.population || {}).pop_stats || {};
const scenario = {
	name: `${key} (${tags[l.owner]}) ${save.date()}`,
	source: path.basename(file),
	location: {
		id: lid, key, rank: l.rank, topography, vegetation, climate, rawMaterial: l.raw_material || rawTemplate, harbor,
		development: N(l.development), prosperity: N(l.prosperity) ?? 0, control: N(l.control) ?? 0, proximity: N(l.proximity) ?? 0,
		integration: l.integration || (l.cores && list(l.cores).map(Number).includes(+l.owner) ? 'core' : 'conquered'),
		capital: +country.capital === lid, marketCenter: !!market && +market.center === lid, roadToCapital: l.road_to_capital === 'yes',
		port: !!l.port, rgoWorkers: N(l.max_raw_material_workers), garrison: N(l.garrison),
		province: N(l.province), market: N(l.market), marketAccess: N(l.market_access),
		pops, buildings,
	},
	country,
	market: { id: N(l.market), prices },
	observed: {
		tax: N(l.tax), possibleTax: N(l.possible_tax), estateTax: Object.fromEntries(Object.entries(l.estate_tax || {}).map(([k, v]) => [k, +v])),
		estatePossibleTax: Object.fromEntries(Object.entries(l.estate_possible_tax || {}).map(([k, v]) => [k, +v])), valueFlow: N(l.value_flow),
		proximityPropagation: N(l.local_proximity_propagation),
		popStats: Object.fromEntries(Object.entries(stats).map(([t, s]) => [t, Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, +b])) : +v]))])),
		province: province ? { food: N((province.food || {}).current), maxFood: N(province.max_food_value), foodChange: N(province.cached_food_change),
			surplusGrowth: N(province.food_surplus_growth_term), storageGrowth: N(province.food_storage_growth_term), levies: province.army_levies || undefined } : undefined,
	},
};
const out = flag('--out');
if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(scenario, null, '\t')); console.log('wrote', out); }
else console.log(JSON.stringify(scenario, null, '\t'));
