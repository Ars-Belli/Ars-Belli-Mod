# Levy focus against Standing Forces, a country against itself (game 1.4.6)

Run 2026-10-31 from the save `SP_MOR_1338_04_08_640fb766-...eu5`. Castile and Morocco each develop for 50 years, one side with each Age II military focus, and meet at years 10, 30 and 50.

## Rules of the comparison

Set by the user:
- Armories are unlocked from the start, and each country builds them to have the most manpower it can while developing its economy.
- Neither side keeps an army while it develops. At a checkpoint each gets regulars whose manpower upkeep is 75% of its monthly manpower, in the regiment mix best for it.
- Same neutral general on both sides.

Chosen here:
- Each side also brings its whole levy, recovered.
- Both focuses apply from the start, four years before Age II. Age II units at all three checkpoints: research is not simulated.
- Each checkpoint has its own armory plan, the one with the most manpower at that year that never went into debt, so a plan for year 50 is not paused at year 10.
- Regulars at a checkpoint have the experience their monthly gain settles at.
- Levy and Standing use the same country values from the save, plus their focus's modifiers read from `focus_data.js`.

## Armories

`economy.js` gained `@mv` (what a man of monthly manpower is worth when choosing what to build) and `@from` (the year that starts). `sweep` is 20 plans plus none. Armory upkeep goods count as market demand. Armories need a town or city and stop at the level cap: Castile reaches 25, Morocco 14.

| | Plan | Armories | Men a month (none) | Net gold a month (none) | Tax base (none) |
|---|---|---|---|---|---|
| Castile, year 10 | from the start, sparingly | 7 | 158 (58) | 17 (28) | 178 (184) |
| Castile, year 30 | from year 20 | 25 | 261 (60) | 5 (55) | 239 (255) |
| Castile, year 50 | from year 30 | 25 | 291 (62) | 16 (76) | 287 (318) |
| Morocco, year 10 | from the start | 11 | 84 (14) | 2 (24) | 67 (75) |
| Morocco, year 30 | from year 10 | 13 | 87 (14) | 11 (36) | 92 (112) |
| Morocco, year 50 | from year 10 | 14 | 91 (14) | 13 (47) | 104 (145) |

Building every armory from the start puts Castile about 2,800 gold in debt.

## Results

The Levy side's win rate at the equilibrium of the regiment mix search, years 10 / 30 / 50, open farmland, both seats. `base` is 1,000 battles at the final armies; the others 600, about ±4 points.

| Change to the focus | Castile | Morocco |
|---|---|---|
| Focus as studied (nobles +200%, culture +25%) | 89 / 62 / 60 | 99 / 99 / 99 |
| Culture bonus halved | 89 / 62 / 59 | 92 / 90 / 92 |
| Culture bonus removed | 88 / 61 / 58 | 70 / 65 / 69 |
| Levy size +20% to +10% | 82 / 52 / 52 | 99 / 98 / 100 |
| Noble levies +200% to +100% | 85 / 52 / 57 | 99 / 99 / 99 |
| All three cuts | 68 / 43 / 47 | 48 / 41 / 50 |
| Standing Forces +50% manpower | 16 / 16 / 13 | 86 / 83 / 76 |
| **Applied: nobles +100%, culture +15%** | **83 / 52 / 59** | **93 / 92 / 94** |

The applied row went into the Levy focus on 2026-10-31, with Levy Size left at +20%. Those armies on wooded hills: Castile 57 / 43 / 55, Morocco 44 / 47 / 51. Year-50 levies: Castile 39.9k against 33.3k, Morocco 11.7k against 8.1k.

`variants.json` holds changes to the focus as studied, and `focus_data.js` now has the applied values. To rerun the table, use commit `cbfe291`.

## Open

- **Morocco's manpower.** The save reports 39 men a month, the simulator finds 15; 19% short for Castile, and within 0.1% for Spain 1547. Sailors show the same gap. Not explained yet, so Morocco's regulars are understated on both sides.
- Why Morocco's levy falls over the run (15.0k to 13.3k with Levy) was not looked into. Control is the likely cause.

## Files and commands

From `location_sim`, with the scenarios from `../castile_morocco/README.md`, then from this folder. Everything uses all cores at the lowest priority.

```sh
V=""; for mv in 0.1 0.2 0.5 1 2; do for f in 0 10 20 30; do V="$V @mv=+$mv,@from=+$f"; done; done
for t in cas mor; do node economy.js scenarios/local/${t}_1338_04.json --years 50 --quiet --unlock armory_advance --levy-years 10,30,50 --compare $V --json $R/grid_$t.json; done
node final_runs.js --country cas [--variant name]
node battles.js --country cas --n 500 --search 80 --step 0.25 [--variant name] --out results/battles_cas.json
```

`variants.json` holds the balance changes. `results/grid_*` is the sweep, `final_*` the economies, `battles_*` the fights.
