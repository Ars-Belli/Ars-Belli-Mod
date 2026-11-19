// node .tools/scripts/battle_sim/analysis/artillery_raid.js [battles, default 2000]
// Hit and run with guns: attack, bombard days 1-3, retreat as soon as allowed (MINIMUM_COMBAT_DAYS 5: melee on days 4-5 is
// unavoidable), paying the shattered-retreat 10% of current strength. Compared with what the enemy loses. Frontage 10.
const pool = require('../pool.js')();
const N = +process.argv[2] || 2000;
const men = x => Math.round(x * 1000).toLocaleString('en-US');
const SETUPS = [
	{ name: '30 guns', units: age => [{ type: `generic:art:${age}`, count: 30 }] },
	{ name: '20 guns + 10 infantry', units: age => [{ type: `generic:hi:${age}`, count: 10, section: 'C' }, { type: `generic:art:${age}`, count: 20 }] },
	{ name: '10 guns + 20 infantry', units: age => [{ type: `generic:hi:${age}`, count: 20 }, { type: `generic:art:${age}`, count: 10 }] },
];
const TARGETS = { '30 heavy infantry': age => [{ type: `generic:hi:${age}`, count: 30 }], '30 heavy cavalry': age => [{ type: `generic:hc:${age}`, count: 30 }] };
(async () => {
	for (const age of [3, 6]) {
		console.log(`\n=== age ${age}`);
		for (const [tname, tunits] of Object.entries(TARGETS)) {
			for (const s of SETUPS) {
				const scn = { location: { frontage: 10 }, attacker: { retreatDay: 5, armies: [{ name: 'raid', units: s.units(age) }] }, defender: { armies: [{ name: 'target', units: tunits(age) }] } };
				const m = await pool.mc(scn, N, { seed: 3 });
				const wiped = m.overrun[0] / m.n, ret = m.retreated[0] / m.n;
				console.log(`  ${s.name.padEnd(24)} vs ${tname.padEnd(18)} raid loses ${men(m.losses[0]).padStart(6)} of ${men(m.start[0]).padStart(6)}, enemy loses ${men(m.losses[1]).padStart(6)} (${(m.losses[1] / m.losses[0]).toFixed(2)} per own loss; 95% ${m.exchangeCI.map(x => x.toFixed(2)).join('-')}); raid wiped ${(100 * wiped).toFixed(1)}%, retreated ${(100 * ret).toFixed(1)}%`);
			}
		}
	}
	await pool.close();
})();
