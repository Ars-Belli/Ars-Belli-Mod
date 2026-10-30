// Which locations to urbanise, long-sighted. A town (5,000 people) or city (30,000) costs gold and food and pays back
// over time through what it unlocks: more control, guilds and other town buildings, more burghers, nobles and clergy,
// and (before rural training fields, Age III) the only manpower buildings. For every location that can rise a rank:
//   - its immediate effect once control has settled (a town loses the rural +100% max RGO size: its RGO shrinks);
//   - the buildings the new rank unlocks, valued with their jobs filled by promotion (best three) and their manpower;
//   - the province's food: the surplus over consumption now and with every RGO built to its maximum, before and after.
//     Growth gets +0.15% a year at a surplus of 25% or more (less below it, none at 0); a shortage starves the province.
// Food-safe candidates (no shortage now or once RGOs are full, and no lost growth) rank first, by long-run value per gold.
//   node .tools/scripts/location_sim/urbanise.js <country scenario.json> [--top 40] [--rank town|city|all] [--csv file]
// The tier column is the Ars Belli Create Town / Create City map mode for the same location, adv tier Advanced Create Town.
const fs = require('fs');
const path = require('path');
const E = require('./engine.js');
E.setData(JSON.parse(fs.readFileSync(path.join(__dirname, 'data.json'), 'utf8')));
const CS = require('./country.js');
CS.setMap(require('./map.json'));
const plan = require('./planner.js');
const DB = E.DB;

const args = process.argv.slice(2);
const flag = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const file = args.find(a => a.endsWith('.json'));
if (!file) { console.error('usage: node urbanise.js <country scenario.json> [--top 40] [--rank town|city|all] [--csv file]'); process.exit(1); }
const scn = JSON.parse(fs.readFileSync(file, 'utf8'));
const onlyRank = flag('--rank', 'all');
const nm = k => DB.names[k] || k;
const num = (x, d = 0) => (+x).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const signed = (x, d = 0) => (x > 0 ? '+' : x < 0 ? '−' : '') + num(Math.abs(x), d);
const pct = (x, d = 0) => (x >= 0 ? '' : '−') + num(Math.abs(100 * x), d) + '%';
const t0 = Date.now();
const ctx = plan.context(scn);

// the Ars Belli map mode tiers (scripted_triggers/abm_map_mode_triggers.txt)
const HIGH = new Set(['goods_gold', 'silver', 'elephants', 'marble', 'saffron', 'pepper', 'cloves', 'chili', 'silk', 'dyes', 'cocoa', 'ivory', 'salt', 'gems', 'pearls', 'amber', 'horses', 'iron', 'copper', 'tea', 'coffee', 'alum', 'camels', 'mercury', 'cotton', 'sugar', 'tobacco', 'wool', 'incense']);
const MEDIUM = new Set(['lumber', 'coal', 'tin', 'lead', 'fiber_crops', 'saltpeter', 'wine', 'beeswax', 'fur']);
const FOOD8 = new Set(['rice', 'wheat', 'maize', 'potato', 'livestock']), FOOD5 = new Set(['fish', 'millet', 'legumes']), FOOD3 = new Set(['olives', 'fruit', 'wild_game', 'wool']);
function modTier(L, rank, taxBase) {
	const g = L.rawMaterial;
	if (rank === 'town') {
		if (HIGH.has(g)) return 'keep rural';
		if (FOOD8.has(g)) return 'last';
		if (FOOD5.has(g) || (MEDIUM.has(g) && taxBase >= 15)) return 'later';
		if (MEDIUM.has(g) || FOOD3.has(g)) return 'good';
		return 'first';
	}
	if (FOOD8.has(g)) return 'last';
	if (FOOD5.has(g)) return 'later';
	if (FOOD3.has(g)) return 'good';
	return 'first';
}

// the Advanced Create Town map mode (script_values and scripted_triggers abm_adv_town_*)
const POP_FOOD = Object.fromEntries(Object.entries(DB.pops).map(([k, v]) => [k, v.food || 0]));
const foodValue = g => (DB.goods[g] || {}).food || 0;
const provinceSites = new Map();
for (const s of ctx.state.sites) { const p = plan.provinceOf(s.loc.id); if (!provinceSites.has(p)) provinceSites.set(p, []); provinceSites.get(p).push(s); }
function advTier(site) {
	const { L, r } = ctx.base.get(site), sites = provinceSites.get(plan.provinceOf(site.loc.id));
	const production = sites.reduce((a, s) => a + ctx.base.get(s).r.food.production, 0);
	let eats = 0;
	for (const s of sites) for (const p of ctx.base.get(s).L.pops || []) eats += p.size * (POP_FOOD[p.type] || 0) * (1 + r.M.cty(`global_${p.type}_food_consumption`));
	const fv = foodValue(L.rawMaterial), g = L.rawMaterial, W = r.rgo.workers || 0, kept = W > 0 ? Math.min(1, (r.rgo.size || 0) / 2 / W) : 1;
	const after = (production - (fv >= 3 ? (r.rgo.output || 0) * fv * 1.25 * (1 - kept * 0.84) : 0)) / eats - 1;
	const only = !sites.some(s => s !== site && foodValue(ctx.base.get(s).L.rawMaterial) >= 3), cuts = kept < 0.75;
	if (HIGH.has(g) && cuts) return 'keep rural';
	if (fv >= 3 && (only || after < 0)) return 'shortage';
	if (fv >= 3 && after < 0.25) return 'last';
	if (HIGH.has(g) || (cuts && (MEDIUM.has(g) || (FOOD8.has(g) && after < 0.5)))) return 'later';
	return cuts ? 'good' : 'first';
}

const cache = new Map();
const rows = [];
for (const site of ctx.state.sites) {
	const o = plan.urbanOption(ctx, site, cache);
	if (!o || (onlyRank !== 'all' && o.rank !== onlyRank)) continue;
	const b0 = ctx.base.get(site), L0 = b0.L;
	rows.push({ ...o, key: site.loc.key, now: o.gain,
		rgo: L0.rawMaterial ? `${nm(L0.rawMaterial)} ${L0.rgoWorkers ?? '?'}→${o.L.rgoWorkers ?? '?'}` : '-', tier: modTier(L0, o.rank, b0.r.tax.base), adv: o.rank === 'town' ? advTier(site) : '-' });
}
const order = { 'food-safe': 0, 'costs growth': 1, shortage: 2 };
rows.sort((a, b) => order[a.verdict] - order[b.verdict] || b.value / b.valueCost - a.value / a.valueCost);

const top = +flag('--top', 40);
console.log(`${scn.name}: ${rows.length} locations can rise a rank (${((Date.now() - t0) / 1000).toFixed(0)} s); age ${ctx.age}`);
console.log('Long-run value = the change once control has settled (RGO shrink included) + the best three buildings the rank unlocks (jobs filled by promotion),');
console.log('in crown tax minus upkeep a month; food = the province\'s surplus over consumption, now and with every RGO full (25% or more = full food growth).\n');
console.log('   #  location                 rise           cost   RGO now→after         now    unlocked  long-run  manpower   food now→after   RGOs full     verdict       mod tier    adv tier');
const line = (r, i) => `  ${String(i + 1).padStart(2)}  ${nm(r.key).slice(0, 22).padEnd(22)}  ${(r.rank === 'town' ? 'town' : r.rank).padEnd(11)} ${num(r.cost).padStart(6)}   ${r.rgo.slice(0, 20).padEnd(20)} ${signed(r.now, 1).padStart(6)}  ${signed(r.bestGain, 1).padStart(9)}  ${signed(r.value, 1).padStart(8)}  ${signed((r.manpower + r.manpowerNow) * 1000).padStart(8)}   ${pct(r.food.before).padStart(5)}→${pct(r.food.after).padEnd(6)}   ${pct(r.food.fullBefore).padStart(5)}→${pct(r.food.fullAfter).padEnd(6)}  ${r.verdict.padEnd(13)} ${r.tier.padEnd(11)} ${r.adv}`;
rows.slice(0, top).forEach((r, i) => console.log(line(r, i)));
const counts = Object.fromEntries(Object.keys(order).map(k => [k, rows.filter(r => r.verdict === k).length]));
console.log(`\n${counts['food-safe']} food-safe, ${counts['costs growth']} cost food growth, ${counts.shortage} would cause a shortage (now or once RGOs are full).`);
const ex = rows.find(r => r.best.length);
if (ex) console.log(`Best unlocked buildings in ${nm(ex.key)}: ${ex.best.map(u => `${nm(u.type)} ${signed(u.gain, 2)}/mo for ${num(u.cost)}`).join(', ')}`);
if (flag('--csv')) {
	const q = x => `"${String(x).replace(/"/g, '""')}"`;
	const lines = ['rank,location,rise,cost,rgo,now_month,unlocked_month,long_run_month,manpower_month,food_now,food_after,food_full_now,food_full_after,verdict,mod_tier,adv_tier,best_buildings'];
	rows.forEach((r, i) => lines.push([i + 1, q(nm(r.key)), r.rank, r.cost.toFixed(0), q(r.rgo), r.now.toFixed(2), r.bestGain.toFixed(2), r.value.toFixed(2), ((r.manpower + r.manpowerNow) * 1000).toFixed(0),
		r.food.before.toFixed(3), r.food.after.toFixed(3), r.food.fullBefore.toFixed(3), r.food.fullAfter.toFixed(3), r.verdict, r.tier, r.adv, q(r.best.map(u => nm(u.type)).join('; '))].join(',')));
	fs.writeFileSync(flag('--csv'), lines.join('\n') + '\n');
	console.log(`wrote ${flag('--csv')} (${rows.length} locations)`);
}
