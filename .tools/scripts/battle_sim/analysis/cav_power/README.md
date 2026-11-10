# Cavalry combat power by age (feature/military-costs, 2026-11-10)

The user's change: cavalry combat power 2.2 / 2.4 / 2.6 / 2.85 / 3.0 / 3.2 by age, vanilla 2.6 / 2.6 / 2.6 / 2.85 / 3.25 / 3.25, light and heavy alike (`in_game/common/unit_types/00_age_templates_land.txt` and the written-out tech-line and mercenary cavalry). The question: which army wins in each age with it, and what changes against vanilla power.

## Setup

- Data: `units.json` rebuilt from game 1.4.8 and this branch (1.4.7 and 1.4.8 change no unit stat, price or terrain). Battle rules as game 1.4.8 in a daily game, including its reserve rule; this branch's damage, speed and heavy infantry are vanilla. "vanilla" runs use `results/units_vanilla_cav.json`, the same data with vanilla cavalry power (`units_with_cav_power.js`).
- Armies as `army_meta.js` builds them: the age's tech-line units, 30 regiments' budget, generals 60/59/61, Spain 1547's discipline and morale, every universal advance of the age (combined arms +1% at ages 4 and 6), frontage 10, plains unless noted, balanced formation for the named armies.
- Two comparisons only: **same regiments**, and **same maintenance manpower** a month (2% of the men for infantry, 4% for cavalry). Never equal gold.
- Combined arms (game rule): no bonus if any category is 50% or more of the regiments; otherwise +2.5% for every category with at least 10%.

## Runs

`run_all.sh` runs everything into `results/` (`.log` is the console output of the `.json` beside it):

| File | What |
|---|---|
| `named_mod`, `named_vanilla` | round robin of the named armies, 1,600 battles a pair |
| `meta_mod`, `meta_vanilla` | best army by double oracle over every mix in 20% steps (`army_meta.js regulars`) |
| `wars_mod`, `wars_vanilla` | wars of attrition, the best mix against 100% heavy cavalry and 100% heavy infantry, 500 wars of 10 years |
| `named_mod_hills` | named armies on hills and woods, same regiments |
| `age3_sweep_<p>` | age 3 only, cavalry power p = 2.6 (the mod), 2.4, 2.2, 2.0 |

Named armies: infantry only (50hi 50li), heavy infantry only, cavalry only (100hc), cavalry 50hc 50lc, 40hi 40li 20lc and 25hi 25li 25hc 25lc (the user's), 40hi 40li 20hc, 30hi 30li 20hc 20lc, 45hi 45hc 10lc, 30hi 30li 20hc 10lc 10art, 40hi 20li 20hc 20art.

## Results

### Rerun with cavalry upkeep +50% (2026-11-10, current mod)

Cavalry maintenance manpower 6% of its men a month (vanilla 4%), on top of the power change. The sections further down are the power-only run, kept in `results/power_only/`; `results/` is this rerun, and its `vanilla` files are vanilla power and upkeep. Battles at the same regiment count do not change (upkeep is not in a battle), so those tables below still hold. What changes is the same-manpower comparison and the wars.

#### Same maintenance manpower, battles against pure heavy cavalry

Win %, men lost per battle (army / heavy cavalry), and in brackets the win % before the upkeep change.

| Age | Best mix found | Infantry 50hi 50li | 100hi | 40hi 40li 20lc | 25hi 25li 25hc 25lc |
|---|---|---|---|---|---|
| 1 | 50hi 20li 10hc 10lc 10art | 76%, 7.8k / 3.3k [0%] | 81%, 7.6k / 3.5k [0%] | 79%, 6.7k / 3.4k [1%] | 77%, 5.1k / 3.4k [15%] |
| 2 | 40hi 40li 10hc 10art 94% / 40hi 40li 20art 5% | 75%, 17.4k / 7.2k [0%] | 69%, 17.0k / 7.3k [0%] | 80%, 14.6k / 7.3k [2%] | 76%, 11.1k / 7.3k [14%] |
| 3 | 20hi 20li 20hc 20lc 20art | 40%, 33.7k / 9.9k [0%] | 49%, 33.7k / 10.8k [0%] | 53%, 27.7k / 10.5k [0%] | 63%, 19.9k / 11.1k [7%] |
| 4 | 40hi 20li 10hc 30art | 93%, 34.6k / 18.5k [2%] | 96%, 34.1k / 19.6k [3%] | 93%, 29.5k / 18.6k [9%] | 91%, 22.9k / 18.5k [33%] |
| 5 | 100hi | 100%, 21.8k / 23.0k [43%] | 100%, 22.1k / 23.7k [48%] | 100%, 19.2k / 22.9k [62%] | 99%, 18.4k / 22.3k [73%] |
| 6 | 40hi 30li 30art 73% / 30hi 40li 30art 23% | 100%, 22.4k / 29.4k [84%] | 100%, 22.6k / 29.8k [89%] | 100%, 19.8k / 29.3k [95%] | 100%, 19.5k / 29.1k [96%] |

#### Wars of attrition: share of wars won by the first army, now [before the upkeep change]

| Age | Same regiments: best mix v 100hc | 100hc v 100hi | Same manpower: best mix v 100hc | 100hc v 100hi |
|---|---|---|---|---|
| 1 | 0% [0%] | 100% [100%] | 0% [–] | 100% [100%] |
| 2 | 0% [0%] | 100% [100%] | 0% [–] | 100% [100%] |
| 3 | – [–] | 100% [100%] | 0% [–] | 100% [100%] |
| 4 | 0% [0%] | 100% [100%] | 0% [–] | 100% [100%] |
| 5 | 3% [1%] | 100% [100%] | 10% [4%] | 78% [100%] |
| 6 | 62% [40%] | 81% [94%] | 72% [43%] | 48% [98%] |

- **Battles at the same manpower flip.** Pure heavy cavalry no longer wins ages 1, 2 and 4 (infantry and mixes win 69-96% against it) and age 3 is about even (40-63%). The best mixes are mostly infantry with 10-20% cavalry and, new here, artillery; from age 5 pure heavy infantry or infantry with artillery.
- **Wars do not flip before age 6.** Pure heavy cavalry still wins every war to age 4 and most at age 5, because it still loses about half the men per battle (age 1: 3.3k against 7.8k) and a war ends when manpower runs out. At age 6 the mixes now win (62-72%, many undecided).
- Heavy infantry alone and infantry + 10% light cavalry: `results/infantry_mix`, `results/infantry_10lc` are rerun too; at the same regiments they are as below.

### Power only (before the upkeep change)

**What the change does.** It turns ages 1 and 2 from pure cavalry into mixed armies in battle at the same regiment count, and nothing else much. Ages 3 and 4 are unchanged by design (2.6 and 2.85 stay), age 5 is a small infantry gain, and age 6 moves too little to show.

- **Same regiments, age 1:** vanilla = 100% heavy cavalry. Mod = 40hi 10li 40hc 10lc, which beats 100hc 58%. Of the named armies 45hi 45hc 10lc does best. Infantry only still loses to 100hc (25%, vanilla 7%), 40hi 40li 20lc loses 42% (vanilla 20%), 25hi 25li 25hc 25lc is even (51%, vanilla 34%).
- **Same regiments, age 2:** mod = 20hi 20li 40hc 20lc (vanilla 10hi 10li 40hc 40lc). 25hi 25li 25hc 25lc is even with 100hc (52%). Infantry only 26% (vanilla 14%).
- **Age 3 is the cavalry peak and stays it:** 100hc against everything, infantry only wins 5%. Lowering age 3 alone: at 2.4 100hc is still best; at 2.2 45hi 45hc 10lc overtakes it and 25x4 is even; at 2.0 every mix beats 100hc. See the sweep.
- **Age 4 to 6 (same regiments):** mixed armies win: 40hi 30li 20hc 10lc at age 4, 40hi 40li 10hc 10lc at 5 and 6. Infantry only is even with 100hc at age 4 and beats it from age 5.
- **Same maintenance manpower: cavalry to age 4 whatever the power.** A cavalry regiment pays 4% of its men a month but has far fewer men (age 1: 200 against 500), so it is the cheaper regiment and the cavalry side fields more of them. 100hc wins ages 1 to 4 with or without the change; mixes from age 5. Combat power does not touch this.
- **Wars: pure heavy cavalry still wins every war to age 5.** The age 1 and 2 mixes now win about as many battles as 100hc (47%) but lose more men, so they lose the war. Wars are manpower-limited and gold is not counted.
- **Hills and woods** cut cavalry further (table below, rerun 2026-11-10 on the game 1.4.8 reserve rule; the other tables did not move, since at frontage 10 these armies fit in the line and have no reserves).
- **Artillery** in a 30-regiment army never paid in these battles; 40hi 20li 20hc 20art comes last at every age.

The horse costs of this branch are not in any of this: they limit cavalry through gold and goods, which these comparisons leave out.

In the tables, "x [y]" is mod power [vanilla power]; win % is the row army against the column army over 1,600 battles (about ±2.5); "Best mix found" is the double oracle answer with its weight; "–" in the wars table means the best mix is 100hc itself.

### Same regiments

| Age | Best mix found, mod | vanilla | Best named, mod (avg win %) | vanilla | 50hi 50li v 100hc | 40hi 40li 20lc v 100hc | 25hi 25li 25hc 25lc v 100hc |
|---|---|---|---|---|---|---|---|
| 1 | 40hi 10li 40hc 10lc 92% / 30hi 10li 40hc 20lc 6% | 100hc | 45hi 45hc 10lc (67) | 100hc (78) | 25 [7] | 42 [20] | 51 [34] |
| 2 | 20hi 20li 40hc 20lc 96% | 10hi 10li 40hc 40lc 95% | 25hi 25li 25hc 25lc (65) | 100hc (72) | 26 [14] | 39 [28] | 52 [44] |
| 3 | 100hc | 100hc | 100hc (76) | 100hc (76) | 5 [5] | 18 [18] | 33 [33] |
| 4 | 40hi 30li 20hc 10lc 92% | 40hi 30li 20hc 10lc 92% | 30hi 30li 20hc 20lc (61) | 30hi 30li 20hc 20lc (61) | 52 [52] | 69 [69] | 72 [72] |
| 5 | 40hi 40li 10hc 10lc 95% | 40hi 40li 10hc 10lc 95% | 40hi 40li 20hc (66) | 40hi 40li 20hc (65) | 97 [91] | 97 [93] | 94 [91] |
| 6 | 40hi 40li 10hc 10lc 95% | 40hi 40li 10hc 10lc 95% | 40hi 40li 20hc (67) | 40hi 40li 20hc (67) | 100 [100] | 100 [100] | 100 [100] |

### Same maintenance manpower

| Age | Best mix found, mod | vanilla | Best named, mod (avg win %) | vanilla | 50hi 50li v 100hc | 40hi 40li 20lc v 100hc | 25hi 25li 25hc 25lc v 100hc |
|---|---|---|---|---|---|---|---|
| 1 | 100hc | 100hc | 100hc (91) | 100hc (94) | 0 [0] | 1 [1] | 15 [8] |
| 2 | 100hc | 100hc | 100hc (92) | 100hc (93) | 0 [0] | 2 [1] | 14 [10] |
| 3 | 100hc | 100hc | 100hc (94) | 100hc (94) | 0 [0] | 0 [0] | 7 [7] |
| 4 | 100hc | 100hc | 100hc (82) | 100hc (82) | 2 [2] | 9 [9] | 33 [33] |
| 5 | 20hi 40li 20hc 20lc 55% / 40hi 20li 20hc 20lc 44% | 40hi 20li 20hc 20lc 98% | 30hi 30li 20hc 20lc (68) | 30hi 30li 20hc 20lc (67) | 43 [27] | 62 [51] | 73 [66] |
| 6 | 40hi 20li 20hc 20lc 96% | 40hi 20li 20hc 20lc 97% | 30hi 30li 20hc 20lc (70) | 30hi 30li 20hc 20lc (70) | 84 [82] | 95 [94] | 96 [95] |

## Casualties (battles, mod power)

Each army against pure heavy cavalry: share of battles won, then men lost per battle by that army / by the heavy cavalry, averaged over wins and losses. Pure heavy cavalry has 6k / 12k / 18k / 24k / 30k / 36k men at the same regiment count; the infantry armies are bigger, because infantry regiments are.

### Same regiments

| Age | Infantry 50hi 50li | 40hi 40li 20lc | 25hi 25li 25hc 25lc | 45hi 45hc 10lc |
|---|---|---|---|---|
| 1 | 25%, 8.2k / 2.6k | 42%, 6.8k / 2.9k | 51%, 5.3k / 3.0k | 57%, 5.0k / 3.2k |
| 2 | 26%, 18.3k / 5.6k | 39%, 15.1k / 6.1k | 52%, 11.6k / 6.6k | 49%, 10.9k / 6.7k |
| 3 | 5%, 32.1k / 7.2k | 18%, 26.8k / 8.4k | 33%, 20.6k / 9.6k | 39%, 19.7k / 10.2k |
| 4 | 52%, 38.7k / 15.8k | 69%, 30.6k / 16.9k | 72%, 24.4k / 17.2k | 73%, 23.8k / 17.8k |
| 5 | 97%, 33.9k / 26.5k | 97%, 28.7k / 26.5k | 94%, 25.2k / 26.0k | 96%, 24.7k / 26.9k |
| 6 | 100%, 33.7k / 34.9k | 100%, 28.5k / 34.9k | 100%, 26.1k / 34.7k | 99%, 26.3k / 35.2k |

### Same maintenance manpower

| Age | Infantry 50hi 50li | 40hi 40li 20lc | 25hi 25li 25hc 25lc | 45hi 45hc 10lc |
|---|---|---|---|---|
| 1 | 0%, 7.5k / 1.5k | 1%, 6.8k / 1.8k | 15%, 5.5k / 2.4k | 18%, 5.2k / 2.5k |
| 2 | 0%, 16.6k / 3.2k | 2%, 15.0k / 3.9k | 14%, 12.2k / 5.1k | 13%, 11.1k / 5.2k |
| 3 | 0%, 27.3k / 4.2k | 0%, 24.8k / 5.3k | 7%, 20.3k / 7.5k | 9%, 19.5k / 7.8k |
| 4 | 2%, 38.8k / 9.0k | 9%, 34.4k / 11.2k | 33%, 26.9k / 14.2k | 32%, 26.1k / 14.5k |
| 5 | 43%, 55.6k / 26.8k | 62%, 45.5k / 29.4k | 73%, 35.8k / 30.5k | 78%, 34.9k / 31.8k |
| 6 | 84%, 54.0k / 40.6k | 95%, 42.0k / 42.0k | 96%, 35.0k / 42.1k | 96%, 35.3k / 42.9k |

Through age 4 the heavy cavalry loses fewer men than every one of these armies, battles it loses included (age 4: 45hi 45hc 10lc wins 73% but loses 23.8k men to the cavalry's 17.8k). From age 5 the mixes with cavalry lose about as many or fewer at the same regiments, while infantry only still loses more (age 5 33.9k to 26.5k; at the same manpower it loses more through age 6). As a share of their own army the mixes lose less from age 4. Losing more men per battle is why the mixes lose the wars of attrition to 100hc through age 5 even where they win the battles.

### Age 3 sweep (the other ages as the mod)

| Age 3 cavalry power | Same regiments: best (avg win %) | 100hc avg | 50hi 50li v 100hc | 40hi 40li 20lc v 100hc | 25x4 v 100hc | 45hi 45hc 10lc v 100hc | Same manpower: 100hc avg |
|---|---|---|---|---|---|---|---|
| 2.6 (mod) | 100hc (74) | 74 | 5 | 18 | 33 | 39 | 97 |
| 2.4 | 100hc (67) | 67 | 12 | 26 | 40 | 45 | 95 |
| 2.2 | 45hi 45hc 10lc (61) | 57 | 22 | 40 | 50 | 54 | 93 |
| 2.0 | 45hi 45hc 10lc (60) | 42 | 40 | 57 | 63 | 66 | 89 |

### Hills and woods, same regiments, mod power

| Age | Best named (avg win %) | 50hi 50li v 100hc | 40hi 40li 20lc v 100hc | 25hi 25li 25hc 25lc v 100hc |
|---|---|---|---|---|
| 1 | 45hi 45hc 10lc (59) | 39 | 46 | 51 |
| 2 | 25hi 25li 25hc 25lc (58) | 36 | 46 | 51 |
| 3 | cavalry only (100hc) (66) | 17 | 30 | 43 |
| 4 | 45hi 45hc 10lc (56) | 51 | 58 | 60 |
| 5 | 40hi 40li 20hc (63) | 88 | 92 | 84 |
| 6 | 40hi 40li 20hc (66) | 99 | 99 | 98 |

### Wars of attrition (500 wars, 10 years, fight when reinforced, same manpower income): share of wars won by the first army, mod [vanilla]

| Age | Same regiments: best mix v 100hc | best mix v 100hi | 100hc v 100hi | Same manpower: best mix v 100hc | best mix v 100hi | 100hc v 100hi |
|---|---|---|---|---|---|---|
| 1 | 0% [–] | 100% [100%] | 100% [100%] | – [–] | 100% [100%] | 100% [100%] |
| 2 | 0% [2%] | 100% [100%] | 100% [100%] | – [–] | 100% [100%] | 100% [100%] |
| 3 | – [–] | 100% [100%] | 100% [100%] | – [–] | 100% [100%] | 100% [100%] |
| 4 | 0% [0%] | 98% [98%] | 100% [100%] | – [–] | 100% [100%] | 100% [100%] |
| 5 | 1% [0%] | 78% [80%] | 100% [100%] | 4% [2%] | 96% [97%] | 100% [100%] |
| 6 | 40% [37%] | 79% [79%] | 94% [96%] | 43% [41%] | 93% [94%] | 98% [99%] |

## Heavy or light infantry (infantry-only armies, mod power)

`results/infantry_mix` (added 2026-11-10): 100hi, 70hi 30li, 50hi 50li, 30hi 70li, 100li, battles. Win % of 100hi against 50hi 50li and men lost per battle (100hi / 50-50); best and worst by average win rate. An infantry-only army never gets combined arms: with two categories one is always 50% or more.

| Age | Same regiments: 100hi v 50/50 | Same manpower: 100hi v 50/50 | Best | Worst |
|---|---|---|---|---|
| 1 | 59%, 7.0k / 7.9k | 58%, 5.6k / 6.2k | 100hi | 100li |
| 2 | 44%, 15.5k / 16.1k | 47%, 12.2k / 13.0k | 100li | 100hi |
| 3 | 56%, 25.8k / 27.5k | 59%, 20.4k / 22.1k | 100hi | 100li |
| 4 | 53%, 39.2k / 41.0k | 58%, 30.6k / 33.2k | 100hi | 100li |
| 5 | 54%, 55.0k / 57.4k | 54%, 55.0k / 57.4k | 100hi | 100li |
| 6 | 52%, 71.5k / 73.7k | 52%, 71.5k / 73.7k | 100hi | 100li |

Pure heavy infantry beats every heavy/light mix and loses fewer men in every age but 2, by a small margin (52-59%). Age 2 is the exception: light infantry (Handgonners) is better, and 100li comes first. From age 5 both cost the same manpower a regiment, so the two comparisons give the same armies.

## Infantry with 10% light cavalry (mod power)

`results/infantry_10lc` (added 2026-11-10). Win % of the first army and men lost per battle (first / second). 45hi 45li 10lc is the only infantry + 10% light cavalry army with combined arms (three types, none at 50%); 90hi 10lc has none.

### Same regiments

| Age | 45hi 45li 10lc v 100hi | v 50hi 50li | v 40hi 40li 20lc | v 100hc | 90hi 10lc v 100hi |
|---|---|---|---|---|---|
| 1 | 57%, 6.9k / 7.6k | 65%, 6.2k / 7.8k | 50%, 6.8k / 6.3k | 39%, 7.3k / 2.9k | 48%, 7.3k / 7.5k |
| 2 | 70%, 14.0k / 16.4k | 63%, 13.9k / 16.9k | 49%, 14.9k / 13.9k | 39%, 16.2k / 6.2k | 49%, 14.7k / 15.5k |
| 3 | 62%, 23.4k / 28.3k | 71%, 21.4k / 28.0k | 46%, 24.5k / 21.9k | 14%, 29.2k / 8.2k | 53%, 25.7k / 27.8k |
| 4 | 62%, 35.4k / 42.5k | 69%, 32.3k / 42.3k | 50%, 36.0k / 33.8k | 69%, 32.7k / 17.1k | 47%, 39.7k / 40.8k |
| 5 | 56%, 50.8k / 58.1k | 63%, 47.0k / 57.8k | 53%, 49.5k / 48.3k | 98%, 29.3k / 26.9k | 41%, 56.6k / 55.1k |
| 6 | 60%, 64.5k / 76.2k | 66%, 60.6k / 76.1k | 55%, 64.3k / 63.8k | 100%, 28.9k / 35.1k | 43%, 72.3k / 71.0k |

### Same maintenance manpower

| Age | 45hi 45li 10lc v 100hi | v 50hi 50li | v 40hi 40li 20lc | v 100hc | 90hi 10lc v 100hi |
|---|---|---|---|---|---|
| 1 | 53%, 5.6k / 5.9k | 61%, 5.2k / 6.1k | 31%, 6.0k / 4.7k | 0%, 7.1k / 1.6k | 50%, 5.8k / 6.1k |
| 2 | 65%, 11.6k / 12.8k | 59%, 11.4k / 13.2k | 29%, 13.2k / 10.3k | 0%, 15.7k / 3.4k | 50%, 11.8k / 12.4k |
| 3 | 56%, 19.6k / 21.9k | 63%, 18.0k / 21.6k | 24%, 21.7k / 16.1k | 0%, 25.8k / 4.6k | 54%, 20.6k / 22.3k |
| 4 | 55%, 29.5k / 32.7k | 62%, 27.2k / 32.5k | 30%, 32.1k / 25.0k | 3%, 36.4k / 9.8k | 48%, 31.8k / 32.8k |
| 5 | 63%, 50.4k / 59.8k | 65%, 48.0k / 58.5k | 50%, 52.4k / 48.9k | 62%, 48.8k / 29.4k | 55%, 54.7k / 59.3k |
| 6 | 64%, 64.0k / 77.2k | 64%, 62.9k / 75.9k | 50%, 68.4k / 64.1k | 94%, 45.4k / 42.0k | 54%, 70.7k / 75.3k |

Adding 10% light cavalry to the 50/50 infantry (45hi 45li 10lc) beats both 50/50 and pure heavy infantry in every age and loses fewer men than either. The gain is the combined arms bonus: 90hi 10lc, with no bonus, is no better than pure heavy infantry. Against 40hi 40li 20lc it is about even at the same regiments, but 40hi 40li 20lc loses fewer men and, at the same manpower, wins ages 1 to 4 because its cavalry regiments cost less manpower. Against pure heavy cavalry it still loses ages 1 to 3 (39 / 39 / 14% at the same regiments) and wins from age 4.
