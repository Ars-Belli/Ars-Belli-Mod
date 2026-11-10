// node extract.js <save file | name in the save games folder | latest> <name>
// One pass over a TEXT (debug) save. Writes <work>/<name>.json with what a border or building edit needs:
//   date, locNames (index + 1 = location id), tags (country id -> tag),
//   countries (id -> type, capital, rank, population, income, manpower, counts of owned locations and units),
//   locations (id -> owner, controller, cores, rank, development, tax, possible_tax),
//   dependencies ({ first: overlord id, second: subject id, type }), buildings ([type, level, location id, owner id]).
// A 480 MB save takes about a minute. Binary saves: save as debug text first (or see eu5_save/eu5save.js).
const fs = require('fs'), readline = require('readline');
const { savePath, work } = require('./paths.js');
const [arg, name] = process.argv.slice(2);
if (!arg || !name) { console.error('usage: node extract.js <save|latest> <name>'); process.exit(1); }
const file = savePath(arg);
const C_TEXT = ['country_type', 'capital', 'definition'];
const C_NUM = ['great_power_rank', 'great_power_points', 'last_months_population', 'last_month_gold_income', 'last_months_tax_income', 'max_manpower', 'monthly_manpower', 'max_sailors', 'expected_army_size', 'expected_navy_size', 'last_months_army_maintenance', 'last_months_navy_maintenance'];
const C_COUNT = { owned_locations: 'owned', controlled_locations: 'controlled', core_locations: 'cores', units: 'units', owned_subunits: 'subunits', accepted_cultures: 'acceptedCultures' };
const L_TEXT = ['owner', 'controller', 'previous_owner', 'rank', 'province', 'market', 'culture', 'religion'];
const L_NUM = ['development', 'tax', 'possible_tax', 'control'];
(async () => {
	const rl = readline.createInterface({ input: fs.createReadStream(file, { encoding: 'latin1', highWaterMark: 1 << 22 }) });
	const res = { file, date: null, locNames: [], tags: {}, countries: {}, locations: {}, dependencies: [], buildings: [] };
	let sec = null, stack = [], cur = null, dep = null, bld = null;
	const list = s => s.replace(/^[^{]*\{/, '').replace(/\}.*$/, '').trim().split(/\s+/).filter(Boolean);
	const val = (t, key) => t.slice(key.length + 1).replace(/"/g, '');
	for await (const line of rl) {
		const t = line.trim();
		if (!t) continue;
		if (stack.length === 0 && !sec && /^[a-z_]+=\{$/.test(t)) { sec = t.slice(0, -2); continue; }
		if (!sec) continue;
		const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
		const key = t.split('=')[0], d = stack.length;
		if (sec === 'metadata') {
			if (key === 'date' && d === 0) res.date = t.split('=')[1];
			if (key === 'locations' && stack[0] === 'compatibility') res.locNames = list(t);
		} else if (sec === 'countries') {
			if (stack[0] === 'tags' && d === 1 && /^\d+=/.test(t)) res.tags[key] = t.split('=')[1];
			else if (stack[0] === 'database') {
				if (d === 1 && /^\d+=\{$/.test(t)) cur = res.countries[key] = {};
				else if (d === 2 && cur) {
					if (C_TEXT.includes(key)) cur[key] = val(t, key);
					else if (C_NUM.includes(key)) cur[key] = +val(t, key);
					else if (C_COUNT[key]) cur[C_COUNT[key]] = list(t).length;
				}
			}
		} else if (sec === 'locations') {
			if (stack[0] === 'locations') {
				if (d === 1 && /^\d+=\{$/.test(t)) cur = res.locations[key] = {};
				else if (d === 2 && cur) {
					if (L_TEXT.includes(key)) cur[key] = val(t, key);
					else if (L_NUM.includes(key)) cur[key] = +val(t, key);
					else if (key === 'cores') cur.cores = list(t);
				}
			}
		} else if (sec === 'diplomacy_manager') {
			if (d === 0 && key === 'dependency' && opens > closes) dep = {};
			else if (dep && d === 1 && opens === 0 && closes === 0) dep[key] = val(t, key);
			else if (dep && key === 'object') dep.type = val(t, key);
		} else if (sec === 'building_manager') {
			if (stack[0] === 'database') {
				if (d === 1 && /^\d+=\{$/.test(t)) { bld = {}; }
				else if (d === 2 && bld && (key === 'type' || key === 'level' || key === 'location' || key === 'owner')) bld[key] = val(t, key);
			}
		}
		if (opens > closes) { stack.push(/=\{$/.test(t) ? key : '?'); for (let i = 1; i < opens - closes; i++) stack.push('?'); }
		else if (closes > opens) for (let i = 0; i < closes - opens; i++) {
			if (!stack.length) { sec = null; cur = null; break; }
			stack.pop();
			if (sec === 'diplomacy_manager' && dep && stack.length === 0) { res.dependencies.push(dep); dep = null; }
			if (sec === 'building_manager' && bld && stack.length === 1) { if (bld.type) res.buildings.push([bld.type, +bld.level || 0, bld.location, bld.owner]); bld = null; }
		}
	}
	rl.close();
	fs.writeFileSync(work(name + '.json'), JSON.stringify(res));
	console.log(`${res.date}: ${res.locNames.length} location names, ${Object.keys(res.tags).length} tags, ${Object.keys(res.locations).length} locations, ${res.dependencies.length} subject relations, ${res.buildings.length} buildings -> ${work(name + '.json')}`);
})();
