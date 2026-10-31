# Game 1.3.11 army meta: inputs, results, checks

Everything behind section 11c of `EU5 Combat Mechanics (1.4.4).md`. The numbers are 1.3.11 only. Run 2026-10-30 on one low-priority core, so most runs are quick (±3–4 points on the campaign armies).

The main scripts are one folder up (`army_meta.js`, `reformation_13.js`). The files here are their inputs and raw output, plus the one-off checks. The one-offs need only `node <file>`; they find the simulator and `units_1.3.11.json` themselves. `inf13.js`, `lanzas13.js` and `validate13*.js` use every core unless `EU5_THREADS=1` is set, so set it while the game is running.

## Inputs

| File | What it is |
|---|---|
| `battles13.json` | Land battles from the January 1547 save. `val13c.js` keeps the 33 with both sides at 3k men or more. Finished wars are dropped from saves, so all are from the 1540s. |
| `spa_lot_13.json` | Spain and Lotharingia scenario from the same save. `from_save.js` undercounts discipline and morale here, so `reformation_13.js` holds the military tab's values instead. |

The save is `SP_SPA_1547_01_04_7f25c496-f283-4e84-b8b6-b35a16c851c9_0.eu5`, the last true 1.3.11 save of the campaign (later ones are 1.4.4 conversions). It is not in the repo.

## Results

`results/` is the current set, run after the engage limit and engaged-first targeting were added to `S.RULES_13`.

| File | Run | Backs |
|---|---|---|
| `r14` | best army by age, equal regiments and equal manpower | "Best army by age" |
| `w14` | wars of `r14`'s armies | "Wars of attrition" |
| `ref14` | Spain and Lotharingia, today, Reformation, Absolutism, equal regiments | equilibrium table, regiments rows |
| `ref15` | the same at equal manpower | equilibrium table, manpower rows |
| `ref16` | Absolutism at equal manpower, more iterations | Absolutism manpower row (remaining counters 0.1) |
| `ref13_checks3.json` | today's armies, research order, whole armies, wars with real manpower | "Today", "Research", "Whole armies" |

`results/pre_fix/` was run before that rule fix. Its armies and win rates are superseded; 11c quotes it only for the equal-gold and no-combined-arms lines, marked as not rerun. The only 60-regiment runs are in there (`r13_60`, `ref13`, `ref13c`).

## One-off checks

| File | What it does | Reads the save |
|---|---|---|
| `val13c.js` | 33 real battles against the simulator: 30 of 33 winners, Brier 0.079 | no |
| `validate13.js`, `validate13b.js` | earlier versions of that check, `node validate13.js 1.3\|1.4` | no |
| `fix13.js` | initiative tests and Spain against Lotharingia today | no |
| `lc13.js` | Light Lancers against Lancers, per regiment and per gold | no |
| `gen13.js` | the same against general diplomacy 30, 59, 82, 100 | no |
| `cannon13.js` | why cannons: mixes against 30 Heavy Lancers, and what each cannon property is worth | no |
| `inf13.js`, `lanzas13.js` | Reformation infantry and Lanzas de Castilla match-ups | no |
| `battles13.js` | writes `battles13.json` | yes |
| `raw13.js`, `raw14.js`, `raw15.js` | top armies, country stats, advances, unlocked units, generals (`ABLOM` is Lombardia, Lotharingia is `LOT`) | yes |
| `adv13.js` | which advances each country holds | yes |
| `roster13.js`, `age5.js` | unit rosters per culture, age V units, Tercio upgrade path | no |

`inf13.js`, `lanzas13.js` and `validate13*.js` were written before the rule fix but run on the current engine, so a rerun gives corrected numbers.

## Commands

From the repo root, in bash. `EU5_THREADS=1` keeps a run on one low-priority core; leave it set if the game is running.

```sh
export EU5_THREADS=1 EU5_UNITS="$PWD/.tools/scripts/battle_sim/units_1.3.11.json"
A=.tools/scripts/battle_sim/analysis; R=$A/meta_1.3/results
node $A/army_meta.js regulars --rules 1.3 --ages 2,3,4,5,6 --views regiments,manpower --n 30 --nm 200 --iters 5 --out $R/r14.json > $R/r14.log 2>&1
node $A/army_meta.js wars --rules 1.3 --in $R/r14.json --ages 4,5,6 --wars 100 --months 120 --interval ready --out $R/w14.json > $R/w14.log 2>&1
node $A/reformation_13.js --games today:today,full:full,abs:abs --regs 30 --n 30 --nm 150 --iters 4 --out $R/ref14.json > $R/ref14.log 2>&1
node $A/reformation_13.js --games today:today,full:full,abs:abs --parity manpower --regs 30 --n 30 --nm 150 --iters 4 --out $R/ref15.json > $R/ref15.log 2>&1
node $A/reformation_13.js --games abs:abs --parity manpower --regs 30 --n 30 --nm 200 --iters 9 --out $R/ref16.json > $R/ref16.log 2>&1
node $A/reformation_13.js checks --out $R/ref13_checks3.json
```

## Rebuilding `units_1.3.11.json`

Only with the game on 1.3. `build_units.js` needs the mod at 1.3:

```sh
git worktree add --detach .claude/worktrees/mod-13 game.1.3.11.mod.25
EU5_MOD="$PWD/.claude/worktrees/mod-13" EU5_UNITS_OUT="$PWD/.tools/scripts/battle_sim/units_1.3.11.json" node .tools/scripts/battle_sim/build_units.js
git worktree remove .claude/worktrees/mod-13
```

## Not in the repo

The Ghidra project `eu5_13` and its decompiles (`combat13.c`, `tick13.c`, `parts13.c`, `init13.c`) are in `E:\Tools\ghidra-projects`. They are the game's own code and this repo is public, so they stay out. The rules read from them are in section 11c.
