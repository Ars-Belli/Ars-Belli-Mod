// node .tools/scripts/battle_sim/analysis/attrition_war.js [wars, default 600] [months, default 48] [interval, default 2]
// Cavalry vs infantry in wars of attrition at equal manpower INCOME (simulateWar: sampled battles, monthly upkeep and
// reinforcement from the pool). Upkeep is what counts, not the one-time recruitment.
// Setups:
//   same regiments - 30 regiments each; income = the dearer army's upkeep / 0.75, so the cheaper army keeps more surplus
//   75/25          - each side builds until upkeep is 75% of the same income (infantry 30 regiments)
// Pool starts full (5 years of income). Generals 55/58/62 both. A side under 50% of its men when a battle is due collapses.
const pool = require('../pool.js')();
const S = require('../engine.js');
S.setUnitDB(require('../units.json'));
const [WARS, MONTHS, INTERVAL] = [+process.argv[2] || 600, +process.argv[3] || 48, +process.argv[4] || 2];
const GEN = { adm: 55, dip: 58, mil: 62 };
const upkeepPerReg = type => S.armyCosts({ attacker: { armies: [{ units: [{ type, count: 1 }] }] }, defender: { armies: [] } })[0].upkeepManpower * 1000; // men a month, no efficiency
const pct = x => `${Math.round(100 * x)}%`;
const MATCHES = [
	...[3, 4, 5, 6].map(age => ({ name: `age ${age}: heavy cavalry vs heavy infantry`, cav: `generic:hc:${age}`, inf: `generic:hi:${age}` })),
	{ name: 'age 3: Lanzas de Castilla vs Halberdiers', cav: 'a_lanzas_de_castilla', inf: 'a_halberdiers' },
	{ name: 'age 5: heavy cavalry +20% power vs heavy infantry', cav: 'generic:hc:5', inf: 'generic:hi:5', cavBonus: 0.2 },
	{ name: 'age 6: heavy cavalry +20% power vs heavy infantry', cav: 'generic:hc:6', inf: 'generic:hi:6', cavBonus: 0.2 },
];
(async () => {
	const t0 = Date.now();
	console.log(`${WARS} wars per row, ${MONTHS} months, a battle every ${INTERVAL} months, frontage 10.`);
	console.log('columns: cavalry regiments / infantry regiments | income a month | cavalry collapses | infantry collapses | neither | battles won by cavalry | men lost cav / inf | manpower spent cav / inf (upkeep + reinforcement)');
	for (const mt of MATCHES) {
		const uc = upkeepPerReg(mt.cav), ui = upkeepPerReg(mt.inf);
		console.log(`\n=== ${mt.name} (upkeep a regiment: cavalry ${uc.toFixed(0)}, infantry ${ui.toFixed(0)} men a month)`);
		const setups = {
			'same regiments': { nc: 30, ni: 30, income: Math.max(30 * uc, 30 * ui) / 0.75 },
			'75/25 upkeep': { nc: Math.round(30 * ui / uc), ni: 30, income: 30 * ui / 0.75 },
		};
		for (const [sname, st] of Object.entries(setups)) {
			const scn = {
				location: { frontage: 10 },
				attacker: { armies: [{ name: 'cavalry', general: GEN, country: mt.cavBonus ? { power: { hc: mt.cavBonus } } : {}, units: [{ type: mt.cav, count: st.nc }] }] },
				defender: { armies: [{ name: 'infantry', general: GEN, country: {}, units: [{ type: mt.inf, count: st.ni }] }] },
			};
			const w = await pool.wars(scn, WARS, { months: MONTHS, interval: INTERVAL, sides: [{ income: st.income }, { income: st.income }] }, 1);
			const ci = c => `±${Math.round(50 * (c[1] - c[0]))}`;
			console.log(`  ${sname.padEnd(15)} ${String(st.nc).padStart(2)}/${String(st.ni).padEnd(2)} | ${Math.round(st.income)} | cav ${pct(w.collapsed[0])} ${ci(w.collapsedCI[0])} | inf ${pct(w.collapsed[1])} ${ci(w.collapsedCI[1])} | neither ${pct(w.undecided)} | cav won ${pct(w.battleShare[0])} of ${w.battles.toFixed(1)} battles | lost ${Math.round(w.lost[0] * 1000).toLocaleString('en-US')} / ${Math.round(w.lost[1] * 1000).toLocaleString('en-US')} | spent ${Math.round((w.upkeep[0] + w.reinforce[0]) * 1000).toLocaleString('en-US')} / ${Math.round((w.upkeep[1] + w.reinforce[1]) * 1000).toLocaleString('en-US')}`);
		}
	}
	console.log(`\n${pool.threads} threads, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
	await pool.close();
})();
