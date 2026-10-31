# Castile against Morocco, levy against levy (game 1.4.6)

Levy counts come from the country simulator, the battles from the battle simulator, with the Ars Belli 3% Maghreb cavalry rate. Run 2026-10-31. The main run is the save `SP_MOR_1338_04_08_640fb766-...eu5` (`--date 1338_04`). The first run, from `SP_MOR_1337_09_26_85a5e25a-...eu5`, is kept as `results/levy_battles.*`, before men were rounded as the game rounds them.

## Levy counts

`location_sim/levy_report.js` gives men by unit. Morocco's total with each row rounded down is 8,517 on 1338.4.8, the game's top bar exactly, and 7,703 against the bar's 7,701 on 1337.9.26. All 21 rows of Tadla match the game's list in September, as do the rows checked in Fez, Meknes and Sevilla, including the 10% control floor. Castile's total has no such check, only its Sevilla rows.

| | Start (April 1337) | April 1338, full | April 1338, now |
|---|---|---|---|
| Morocco | 14,749 | 11,238 | 8,517 |
| Castile | 25,682 | 21,638 | 21,638 |

- **Full** is every location at its control, with recovery 1.
- **Now** applies the Army Levies Recovery panel, province by province. The panel's percentage is the tooltip's "Recovering since last raise".
- The panel's men are not the men available. Its total is the levy at the last raise: Morocco's rows at the start come to 12,670 in the eight provinces listed, and the panel to 12,612. Control has fallen since, so the rows are lower.
- Castile has no recovery entries, so its full and now are the same.

## Files

| File | What it does |
|---|---|
| `build_inputs.js` | Gathers levies, country values and terrains into `inputs_<date>.json` |
| `countries_1338_04.json`, `countries_raw.json` | Country values from `battle_sim/from_save.js --no-general`; the second is the September run |
| `inputs_<date>.json` | Everything the battles need, so they rerun without the saves |
| `levy_battles.js` | The battles; progress goes to stderr |
| `results/levy_battles_1338_04.txt`, `.json` | 2,000 battles a cell, 208 cells, 41 s |

## Commands

The saves are not in the repo. From `.tools/scripts`:

```sh
S="<save folder>"; M="$S/SP_MOR_1338_04_08_640fb766-77b2-44b8-8a9a-6bd1ca3ea2d5.eu5"; O="$S/SP_Observer_1337_04_01_96f43fde-1e90-4484-9848-105bc8c25d79.eu5"
cd location_sim
node from_save.js "$M" --country MOR --out scenarios/local/mor_1338_04.json
node from_save.js "$M" --country CAS --out scenarios/local/cas_1338_04.json
node from_save.js "$O" --country MOR --out scenarios/local/mor_1337_04.json
node from_save.js "$O" --country CAS --out scenarios/local/cas_1337_04.json
node levy_report.js scenarios/local/mor_1338_04.json --json scenarios/local/mor_levy_1338_04.json
node levy_report.js scenarios/local/cas_1338_04.json --json scenarios/local/cas_levy_1338_04.json
node levy_report.js scenarios/local/mor_1337_04.json --json scenarios/local/mor_levy_start.json
node levy_report.js scenarios/local/cas_1337_04.json --json scenarios/local/cas_levy_start.json
cd ../battle_sim
node from_save.js "$M" --attacker MOR --defender CAS --no-general --out analysis/castile_morocco/countries_1338_04.json
cd analysis/castile_morocco
node build_inputs.js 1338_04
node levy_battles.js --n 2000 --date 1338_04 --out results/levy_battles_1338_04.json > results/levy_battles_1338_04.txt
```

## How the battles are set up

- Each side's whole levy is one stack, raised and at full morale.
- Regiments of one unit type from different provinces merge, so each type is full regiments plus one partial.
- Both sides have the same neutral general, adm 60, dip 59, mil 61, no traits.
- Men are rounded down row by row, as the game shows them.
- Country values are from the main save for every case, also the April 1337 one. Terrains are every land terrain the two countries own, and the most common of each country is also fought across a river and a strait.
- Not modelled: regular armies, artillery, armies arriving at different times, and the time to raise and march a levy.
