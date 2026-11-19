# Military costs: horses x10 and reinforcement price options

Does dearer cavalry and dearer reinforcement make infantry usable in ages I to III? The branch keeps horses x10; the reinforcement prices studied here are commented out in `abm_prices.txt`. Rules and findings are in section 15 of `EU5 Combat Mechanics (1.4.4).md`. Run 2026-11-01 on `units.json` from 1.4.6, rerun 2026-11-02 after the rebase onto `update/1.4` (both land damage x2, heavy infantry combat speed 2.25), with a 25% column.

| File | What it does |
|---|---|
| `gold_parity.js` | 30 heavy infantry against the cavalry the same gold upkeep buys, cavalry gold x 1 to 4, reinforcement 5%, 25%, 50%, 100% of build |
| `equal_regiments.js` | 30 against 30 with no gold limit, cavalry reinforcement speed x 1 to 0.06 |
| `results/parity_upkeep60.txt`, `parity_upkeep85.txt` | `gold_parity.js` with upkeep at 60% and 85% of the gold budget, 2,000 battles and 300 wars a cell |
| `results/equal_regiments.txt` | `equal_regiments.js --wars 200` |

`simulateWar` takes `sides[i].goldIncome` and `gold` for this. Upkeep comes first, then reinforcement at the reinforce price and wiped regiments at the build price, and no men return at or below 0 gold. The game itself goes on to -10,000.

The goods impact is an input here (`k`), not modelled: the simulator does not know market prices.
