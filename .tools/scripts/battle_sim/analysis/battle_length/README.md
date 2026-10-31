# Battle length and taking armies out of a battle (game 1.4)

Everything behind section 11d of `EU5 Combat Mechanics (1.4.4).md`. Asked on 2026-10-30: would slower armies stop endless battles, and armies stepping out of a battle to rest and coming back? Numbers are 1.4 only, run 2026-10-31 with the engage limit, the fixed dice timing and `units.json` from 1.4.6.

**Answer:** slower armies barely help. Raising the land damage modifiers does. The ready-to-use block is commented out in `loading_screen/common/defines/01_abm_defines.txt`: `LAND_MORALE_DAMAGE_MODIFIER = 1.0` and `LAND_STRENGTH_DAMAGE_MODIFIER = 0.12`. It is not active.

## The model

`simulateScenario(scn, { rotate: [cfg, null] })` in `engine.js`. See the comment above `rotate` there.

- **Relay** (`cfg.relay`): armies from index `cfg.start` wait a location away. When an army in the battle falls under `cfg.threshold` average morale and a rested one is ready, the rested one marches in, and the tired one leaves the day it arrives.
- **Pull-out** (no `relay`): the tired army just leaves, rests and comes back.
- The side that swaps is compared with an equal side that commits everything. 50% means no edge.
- `outright` is the win rate of the battle itself. `with follow-up` adds a fight between the rested armies and the worn-out winner, who never reacts, so it flatters holding back. Quote `outright`.

Standard case: 4 armies of 30 regiments a side, frontage 10, 3 in and 1 away, swap under 30% morale, rest to 90% at 6.25% a day, 3 days a location, own territory.

## Files

| File | What it does | Output in `results/` |
|---|---|---|
| `relay.js` | Library: engagement, cells, worker pool. Alone it prints a policy sweep | |
| `final_levers.js` | Every setting: days, men lost, shattered, wipes, relay win rate | `final.txt` |
| `side_effects.js` | Small and uneven battles, stack wipes, what quality is worth | `side_effects.txt` |
| `cycle_test.js` | Does the edge follow swap cycle against battle length? | `cycle.txt` |
| `explain.js` | One suspected cause at a time | `explain.txt` |
| `levers.js` | A player who adapts: best of 4 policies at 3 and 5 days a location | `levers.txt` |
| `pullout.js` | Battle length by stack size, then pull-out with no replacement | `pullout.txt` |
| `tick_sweep.js` | What finer ticks and more dice are worth | `tick_sweep.txt` |

`results/pre_fix/` is the 2026-10-30 set, run without the engage limit and superseded. It said infantry relay wins 45% and that doubling damage is enough. Both are wrong on the corrected engine.

`../meta_1.4/subject_armies.js` is a separate question: which subject armies can be lent to an overlord (memory.md, Lend Army to War Leader).

## Commands

From this folder. Leave the game 8 cores if it is running: 28 logical cores, so `EU5_THREADS=20`. The simulator always runs at the lowest priority, set in `engine.js`.

```sh
export EU5_THREADS=20
node final_levers.js > results/final.txt
node side_effects.js > results/side_effects.txt
node cycle_test.js > results/cycle.txt
node explain.js > results/explain.txt
node levers.js > results/levers.txt
node pullout.js > results/pullout.txt
node tick_sweep.js > results/tick_sweep.txt
```

## Limits

- The opponent never reacts. A real one can chase the army that left or attack the waiting one.
- Even forces, generic units, no artillery.
- Days per location are assumed (3 and 5), not measured.
- Not tested in game.
