// node summary.js <extract name> TAG [TAG ...] [--europe]
// Per country, from what the save holds NOW: locations, towns and cities, development, tax, possible tax, levels of
// armories and training fields. Then the game's own last-month figures (rank, manpower, army and fleet size): those are
// stale after an edit until the game has run a month. Good for comparing countries, for example to balance teams.
const st = require('./state.js').load(process.argv[2]);
const tags = process.argv.slice(3).filter(a => !a.startsWith('--')), europe = process.argv.includes('--europe');
if (!tags.length) { console.error('usage: node summary.js <extract name> TAG [TAG ...] [--europe]'); process.exit(1); }
const mil = {};
for (const [type, level, , owner] of st.D.buildings) if (type === 'armory' || type === 'training_fields') { const t = st.D.tags[owner]; (mil[t] = mil[t] || { armory: 0, training_fields: 0 })[type] += level; }
const rows = tags.map(t => {
	const own = Object.values(st.L).filter(l => l.tag === t && (!europe || l.g.continent === 'europe')), c = st.C[t] || {};
	const sum = k => Math.round(own.reduce((a, l) => a + (l[k] || 0), 0));
	return { tag: t, locations: own.length, towns: own.filter(l => l.rank && l.rank !== 'rural_settlement').length, development: sum('development'), tax: sum('tax'), possibleTax: sum('possible_tax'),
		armories: (mil[t] || {}).armory || 0, trainingFields: (mil[t] || {}).training_fields || 0, rank: c.great_power_rank, maxManpower: c.max_manpower, armySize: c.expected_army_size, navySize: c.expected_navy_size };
});
const cols = Object.keys(rows[0]);
console.log(cols.join('\t'));
for (const r of rows) console.log(cols.map(k => r[k] === undefined ? '-' : typeof r[k] === 'number' ? Math.round(r[k] * 10) / 10 : r[k]).join('\t'));
