# Game 1.4 army meta: inputs, results, checks

Everything behind section 11b of `EU5 Combat Mechanics (1.4.4).md`. The numbers are 1.4 only (`units.json` built from 1.4.6). Run 2026-10-31.

The main scripts are one folder up (`army_meta.js`, `levy_meta.js`). `results/` uses the engage limit and engaged-first targeting that 1.4 shares with 1.3. `results/pre_fix/` is the 2026-10-30 set from before them, superseded: to compare, set `ENGAGE_W: false` in the engine's `D` (`levy_meta.js --old-engage` does this).

## Results

| File in `results/` | Run |
|---|---|
| `regulars_30` | best army by age, 30 regiments |
| `reg_step10` | the same at 10% steps; the armies `wars_*` use |
| `reg_nocomb`, `reg_bal` | without combined arms; balanced tactic only |
| `reg_c25` | combined arms at 2.5% per type |
| `reg_dpp2` | 2 days per phase |
| `reg_hills` | hills and woods |
| `reg_60` | 60 regiments |
| `levy_game` | the levy game, `--levies 30` |
| `wars_ready`, `wars_2m` | wars, fighting when reinforced; a battle every 2 months |
| `levies.json`, `tribal`, `tribal_quick.json` | levy modes of `levy_meta.js`; `tribal_quick` is the 600-battle version of `tribal` |
| `nerf` | steppe horde levies: men needed to match 30 regulars, Ars Belli 200-man regiments against vanilla 600 |
| `rate`, `rate_old` | Morocco's whole levy at each share of tribesmen; `rate_old` is 10% on the model before the fix |

`.log` is the console output of the `.json` beside it.

## Real battles

`val14.js` runs 42 real 1.4.6 battles against both models: 37 of 42 winners either way at full morale, Brier 0.101, and at 70% morale 38 and 0.096 against 37 and 0.102. They come from `battles14.json`, written by `battles14.js` from the AI wars of `SP_Observer_1378_04_02_7c79e0a2-...eu5`. Most armies are levies and country stats are unknown, so only the comparison means anything. The `7f25c496` campaign's `MP_SPA_1568` saves look like 1.4 but were played on 1.3.

## Morocco investigation

Saves are read from the Paradox save folder; none are in the repo. `mor_battles.json` and `mor_cas_1372.json` are the extracted data.

| File | What it does |
|---|---|
| `mor_cas_1372.json` | Morocco against Castile scenario from `SP_MOR_1372_06_01_...eu5` |
| `mor_battles.json` | Morocco's battles, written by `mor_battles3.js` |
| `mor_inspect.js`, `mor_levies.js`, `mor_capacity.js` | Morocco's country data, levies, levy capacity |
| `mor_battles.js`, `mor_battles2.js`, `mor_battles4.js` | where a save keeps battle records |
| `mor_live.js`, `mor_morale.js` | battles in live wars; regiment morale by unit |
| `pops_cmp.js` | tribesmen and peasants, vanilla against mod |
| `advances_by_age.js` | universal combat advances per age, vanilla, DLC and mod |

The nerf itself is `in_game/common/levies/abm_d009_maghreb_levies.txt`, at the 3% in `main_menu/common/script_values/abm_levy_values.txt`.

## Commands

From the repo root, in bash, with the game on 1.4 for fresh `units.json` data.

```sh
A=.tools/scripts/battle_sim/analysis/army_meta.js; L=.tools/scripts/battle_sim/analysis/levy_meta.js; R=.tools/scripts/battle_sim/analysis/meta_1.4/results
node $A regulars --ages 1,2,3,4,5,6 --n 100 --nm 800 --iters 10 --out $R/regulars_30.json > $R/regulars_30.log 2>&1
node $A regulars --ages 1,2,3,4,5,6 --step 0.1 --n 60 --nm 800 --iters 8 --out $R/reg_step10.json > $R/reg_step10.log 2>&1
node $A regulars --ages 3,4,5,6 --views regiments,manpower --n 100 --nm 800 --no-combined --out $R/reg_nocomb.json > $R/reg_nocomb.log 2>&1
node $A regulars --ages 3,4,5,6 --views regiments,manpower --n 100 --nm 800 --balanced-only --out $R/reg_bal.json > $R/reg_bal.log 2>&1
node $L rate --rates 2,3,4,5,6,10 --out $R/rate.json > $R/rate.log 2>&1
node $L rate --rates 10 --old-engage --out $R/rate_old.json > $R/rate_old.log 2>&1
node $L levies --out $R/levies.json > $R/levies.log 2>&1
node $L tribal --n 1500 --out $R/tribal.json > $R/tribal.log 2>&1
node $L tribal --n 600 --out $R/tribal_quick.json
node $L nerf --out $R/nerf.json > $R/nerf.log 2>&1
node $A wars --in $R/reg_step10.json --ages 2,3,4,5,6 --wars 500 --months 120 --interval ready --out $R/wars_ready.json > $R/wars_ready.log 2>&1
node $A wars --in $R/reg_step10.json --ages 2,3,4,5,6 --wars 500 --months 48 --interval 2 --out $R/wars_2m.json > $R/wars_2m.log 2>&1
node $A regulars --ages 4,5,6 --views regiments,manpower --n 100 --nm 800 --combined-per-type 0.025 --out $R/reg_c25.json > $R/reg_c25.log 2>&1
node $A regulars --ages 2,3,4,5,6 --views regiments,manpower --n 100 --nm 800 --days-per-phase 2 --out $R/reg_dpp2.json > $R/reg_dpp2.log 2>&1
node $A regulars --ages 2,3,4,5,6 --views regiments --n 100 --nm 800 --loc '{"topography":"hills","vegetation":"woods"}' --out $R/reg_hills.json > $R/reg_hills.log 2>&1
node $A regulars --ages 2,3,4,5,6 --views regiments,manpower --regs 60 --n 60 --nm 400 --iters 8 --out $R/reg_60.json > $R/reg_60.log 2>&1
node $A regulars --ages 2,3,4,5,6 --views regiments --levies 30 --n 60 --nm 400 --iters 8 --out $R/levy_game.json > $R/levy_game.log 2>&1
```

These run on every core by default. Set `EU5_THREADS=1` if the game is running.
