# EU5 Combat Mechanics (game 1.4.4)

How land combat actually works in Europa Universalis V 1.4.4, read from the game code (eu5.exe decompiled with Ghidra) and the game files. Written for balancing Ars Belli: which numbers matter, how they combine, and what a modifier is really worth.

**Sources and confidence.** Formulas marked *(code)* were read from decompiled eu5.exe 1.4.4; the tooltip labels in `CAPS` are the loc keys each step uses, which name the factors. Values come from `loading_screen/common/defines/00_defines.txt`, `in_game/common/unit_categories`, `unit_types`, `main_menu/common/static_modifiers/subunit.txt` and `in_game/common/auto_modifiers/country.txt`. Anything marked *(defines only)* or *(not traced)* is inferred from define names and comments, not from code. Struct field names are inferred from those labels, so treat exotic edge cases with care. Re-check after every game update (see the appendix).

All engine math is fixed-point: 100000 = 1.0.

---

## 1. One day of battle

Combat ticks once per day (1.3 ticked per "hour"; see section 13).

1. **Battle start.** Both sides roll dice. If one side's strength is at least `INITIAL_OVERRUN_FACTOR` = **10×** the other's, the weaker side is overrun at once. *(code)*
2. **Bombard phase.** The first `BOMBARD_DAYS` = **3** days are a bombard phase. *(code: the phase flag; what differs inside it was not traced)*
3. **Phases.** Every `DAYS_PER_PHASE` = **4** days a new phase starts and **both sides re-roll their dice**. *(code)*
4. **Reserves move up** (`HandleReserves`). Each regiment in reserve picks the battle section (left, centre, right) with the most free frontage, and moves in with a daily chance equal to its combat speed (section 5). *(code)*
5. **Engaging** (`AttemptInitiative`). Each regiment in a section that is not yet engaged rolls its initiative chance (section 4); on success it becomes engaged. *(code)*
6. **Damage.** Engaged regiments hit enemy regiments (section 2). Strength losses and morale losses are collected per target and applied together. Strength loss can't exceed the men the target has left. *(code)*
7. **Morale drain.** Every regiment in the battle loses `COMBAT_DAILY_MORALE_TICK` = **0.03** morale per day on top of combat damage. *(code)*
8. **End.** A battle lasts at least `MINIMUM_COMBAT_DAYS` = **5** days. A regiment with morale below `MORALE_COLLAPSE_THRESHOLD` = **5%** (or no men) drops out of the line. When a side's morale has collapsed and the other side has at least `MORALE_OVERRUN_FACTOR` = **2×** its strength, the beaten side is overrun. *(code)*

"Strength" for the overrun ratios is a side total in which levies count at their levy factor (section 8) and naval levies at `NAVAL_LEVY_IMPACT` = 5%. *(code)*

---

## 2. Damage per hit (the core formula)

Regiment **A** hits regiment **B**. Every hit produces a **strength loss** (men, where strength 1.0 = 1000 men) and a **morale loss** (morale points; base land morale is 3.0). *(code, damage function `0x142482130`)*

### Base

```
roll  = raw die (0-9, shown in game as 1-10) + COMBAT_BASE 5 + dice modifiers   (section 3)
roll  = min(roll, COMBAT_MAX 15);  roll <= 0 counts as 1
base  = roll x COMBAT_DAMAGE_MULT 0.12
strength_loss = base x LAND_STRENGTH_DAMAGE_MODIFIER 0.04     (naval 0.0625)   [CT_STR_BASE]
morale_loss   = base x LAND_MORALE_DAMAGE_MODIFIER 0.25       (naval 0.05)     [CT_MOR_BASE]
```

### Multipliers, in the order the code applies them

| Label | Applies to | Factor | Where the numbers come from |
|---|---|---|---|
| `RELATIVE_STRENGTH` | morale | A current strength ÷ A max strength | a half-strength regiment does half the morale damage |
| `REGIMENT_SIZE` | morale | clamp(A max strength ÷ B max strength, 0.25, 4) | `MORALE_SIZE_RATIO_MAX` 4; land vs land only. Big regiments shred the morale of small ones |
| `POWER` | both | 1 + A's category power modifier | `army_heavy_infantry_power`, `army_light_cavalry_power`, … |
| `FLANKING_ABILITY` | both | × A flanking ability, when A attacks from a flank | category: light inf 1.1, heavy inf 1.0, cavalry 1.6, artillery 1.0 |
| `DISCIPLINE` | both | × (1 + A discipline) | |
| `TARGET_DISCIPLINE` | both | ÷ (1 + B discipline) | discipline counts twice: more damage dealt, less taken |
| `VS_RELIGION` | both | × (1 + A `damage_done_versus_heretics_modifier`) if same religion group but a different religion; × (1 + `damage_done_versus_heathens_modifier`) if a different group | |
| `COMBAT_POWER` | both | × A combat power | unit type (table in section 10) |
| `MIL_TAC` | both | ÷ (1 + (B tactics − A tactics)), only when B has more | base `military_tactics` = 1.0 per country; only the gap counts |
| `LEVY_VS_REGULAR` | both | clamp(0.75 + 0.25 × A `levy_combat_efficiency`, 0.05, 1.0), only when A is a levy and B a regular | section 8 |
| `CURRENT_STRENGTH` | strength | × A current strength | 1.0 = 1000 men: more men kill more men |
| `EXPERIENCE` | both | × (1 − `LAND_EXPERIENCE_DAMAGE_REDUCTION` 0.5 × B experience ÷ 100) | full experience halves damage taken |
| `CATEGORY_TAKEN` | both | × B category `damage_taken` | infantry 1.0, **cavalry 0.30**, artillery 1.25, auxiliary 1.25 |
| `COMBINED_ARMS` | both | × (1 + A side's combined-arms bonus) | `combined_bonus_per_type` 0.025 per category present; a category counts between `combined_arms_min_percent_for_bonus` 10% and `combined_arms_max_threshold` 50% of the side *(bonus calculation not traced)*. Auxiliaries are excluded |
| `SECURED_FLANKS` | both | × max(0.05, 1 − n × B `secure_flanks_defense`), n = secured flanks | infantry 0.05 per secured flank, others 0 |
| `TOPOGRAPHY`, `VEGETATION`, `CLIMATE` | both | × (1 + A's terrain modifier + A unit type `combat = { … }` entry) for the battle location | e.g. cavalry −10% in mountains, wetlands, jungle |
| `COASTAL` / `INLAND` | both | × (1 + A coastal or inland bonus) | |
| `RIVER` | both | × (1 + A river modifier), if the location has a river | heavy cavalry −10% |
| `STRENGTH_DAMAGE_DONE` | strength | × (1 + A `strength_damage_done`) | unit type + category (light units −10%) |
| `STRENGTH_DAMAGE_TAKEN` | strength | × (1 + B `strength_damage_taken`) | |
| `MORALE_DAMAGE_DONE` | morale | × (1 + A `morale_damage_done`) | |
| `MORALE_DAMAGE_TAKEN` | morale | × (1 + B `morale_damage_taken`) | light units +10% |
| `NOT_ENGAGED` | both | strength × 1.1, morale × 1.2 when B is not engaged | `NOT_ENGAGED_STRENGTH/MORALE_DAMAGE_MODIFIER` |

Naval combat swaps in `NAVAL_DAMAGE_DONE`, `OWN_COAST`, `GUNS_VS_HULL` and `NAVAL_DAMAGE_TAKEN` (1 + `naval_damage_taken`) in place of the land-only steps.

**What this means for modifiers:**
- Discipline is worth roughly double: +10% discipline means ×1.1 dealt and ÷1.1 taken.
- Military tactics only matters as a gap. Equal tactics on both sides do nothing.
- Unit power modifiers (`army_*_power`) are a straight multiplier on everything that regiment deals.
- Morale damage depends on regiment **size** (`max_strength`) and current fill; strength damage depends on **men** present.

---

## 3. Dice *(code)*

- Roll = random 0–9 (`COMBAT_DICE_SIDE` = 10), re-rolled per side every phase (4 days). The tooltip shows it +1 (1–10), but the damage code adds the raw 0–9, so rolls run **5–14** before bonuses.
- Dice modifiers for a side:
  - **Commander:** the `commander_combat_bonus` of the side's commander, rounded to whole dice. The commander is the best-rated leader among the side's armies; traits give this modifier. Raw general skill was not seen adding dice directly.
  - **Attacker only:** river crossing −1 (`RIVER_CROSSING_DICE`), strait −2 (`STRAIT_CROSSING_DICE`), landing from the sea −1 (`SEA_LANDING_DICE`).
- The roll caps at 15 (`COMBAT_MAX`), which only a dice bonus can reach (14 + 1). Each extra die is worth the same until the cap.
- The non-die entries of the side's dice list are summed into the dice modifier for every hit that side deals. *(code, `0x142481230`)*

---

## 4. Initiative: who engages *(code)*

Daily chance that a regiment not yet engaged becomes engaged:

```
chance = INITIATIVE_BASE_CHANCE 0.60
       + min(INITIATIVE_CHANCE_EACH 0.025 x initiative x (1 + army_initiative), INITIATIVE_CHANCE_MAX 0.30)
       + INITIATIVE_CHANCE_PER_DAY 0.03 x days the battle has lasted
```

Category initiative: light infantry 5, heavy infantry 1, light cavalry 5, heavy cavalry 2, artillery 1, auxiliary 1, plus unit-type bonuses (e.g. Winged Hussars +2, Caroleans +5).

The initiative part saturates at an effective initiative of 12, so `army_initiative` stops mattering past that. Engaged regiments deal damage, and an unengaged target takes the `NOT_ENGAGED` bonus damage, so initiative decides who hits first and who gets hit while unprepared.

---

## 5. Combat speed: reserves moving up *(code)*

A reserve regiment moves into the line with a daily chance of:

```
chance = combat_speed x (1 + combat_speed_modifier) x COMBAT_SPEED_SCALE 0.1
```

Category combat speed: light infantry 3, heavy infantry 2, cavalry 5, artillery 1, auxiliary 0.1. So heavy infantry with no bonuses has a 20% daily chance to fill a gap, and cavalry 50%. Combat speed does **not** change damage. It's how fast the reserves replace broken front regiments.

---

## 6. Frontage, sections and targeting *(code)*

- **Battle frontage W** is the location's `local_frontage_allowed`: 10 base (static modifier on every location), mountains −4, hills −3, wetlands −3, plateau −1, forests −2 to −4 (vegetation), never below 2 (`MIN_FRONTAGE_AFTER_TERRAIN`). `possible_frontage_modifier` is read in the same code (where exactly was not traced).
- **Three sections**, left, centre and right, each holding **1.25 × W** frontage of engaged regiments (`MAX_FRONTAGE_OVERSTACKING`, also `max_frontage = 1.25` per section in `unit_formation_preference`). Every land regiment has frontage 1.
- **Deployment** (`AddUnit`): each regiment goes to the section its army's formation preference points to (`unit_formation_preference/army.txt`: `balanced_army` lets every category use any section; `cav_inf_cav` puts cavalry on the flanks and infantry and artillery in the centre), if that section has room; otherwise it waits in reserve. Auxiliaries always go to reserve.
- **Reserves** (`HandleReserves`): each day a side spends a frontage budget of W on reserve regiments. Each considered regiment scores every section as *enemy engaged frontage facing it + our free room* and moves into the best one with its combat-speed chance (section 5).
- **Targets** (`0x142481230`): an engaged regiment hits the enemy section **facing** it (left faces their right, centre faces centre). It keeps its last target while that target is still in the section; otherwise it picks a random enemy there. If the facing section is empty it hits another section, and that hit counts as a **flank attack** (× flanking ability).
- **Secured flanks** (the `SECURED_FLANKS` factor): a target on a flank counts 1 secured flank if its own centre is occupied; a target in the centre counts one per occupied flank. Infantry take 5% less damage per secured flank.
- **Bombard** (`0x142481ba0`): artillery rolls `BOMBARD_BASE_CHANCE 0.2 × (1 + its bombard bonus)` per day to hit a regiment in the facing section, through the same damage function.

---

## 7. Morale

- Base land and naval morale: 3.0 (`NUnit.LAND_MORALE` / `NAVAL_MORALE`), changed by `land_morale_modifier` (%) and `land_morale` (flat) *(the order they combine in was not traced)*.
- Losses: combat morale damage (section 2) + 0.03 per day just for being in the battle.
- Below 5% morale a regiment leaves the line.
- Country auto modifiers (`auto_modifiers/country.txt`): war exhaustion −2.5% land morale per point; army tradition up to +20% (at 100); revolutionary +25%; horde army expectation −50% (−10% in Ars Belli).

---

## 8. Levies *(code)*

Levy units have the **same stats** as regulars of the same age (Peasant Levy = Crossbowmen, Militiamen = Hunters, Conscripts = Sharpshooters, Men-at-Arms levy = Men-at-Arms). The penalties are:

1. **Levy vs regular factor** = clamp(0.75 + 0.25 × `levy_combat_efficiency`, 0.05, 1.0):
   - It applies only when a levy hits a regular. A regular hitting a levy, and levy vs levy, get no factor.
   - `0.75` is `LAND_LEVY_COMBAT_IMPACT`, so **+10% levy combat efficiency = +2.5% damage**, and **+100% is the cap**.
2. **Discipline −20%** (static modifier `is_army_levy`; −10% on 1.3). This counts on both sides of the formula, so levies deal 80% and take 125%.
3. **Experience decays faster:** base 5% per month, levies +2%, regulars −1%, so levies sit at lower experience and take more damage.
4. Levies count at their levy factor in the side-strength totals used for overrun checks.

Levy vs regular trade (damage dealt ÷ damage taken, same unit type, no experience, no discipline bonuses):

| Levy combat efficiency | Levy factor | Dealt | Taken | Trade |
|---|---|---|---|---|
| 0% | 0.75 | 60% | 125% | 48% |
| +30% | 0.825 | 66% | 125% | 53% |
| +70% | 0.925 | 74% | 125% | 59% |
| +100% (cap) | 1.0 | 80% | 125% | 64% |

Matching regulars needs a smaller levy discipline penalty, which the mod can set through `is_army_levy`.

**Changing it for one country only.** `is_army_levy` is a static modifier with no trigger, so it applies to every country's levies. Two ways to give only some countries (e.g. a focus pick) better levies:

1. **Their own levy units** (data only, recommended). A levy can be gated with `country_allow = { … }` or unlocked by an advance (`unlock_levy`), and each pop raises the eligible levy with the highest total combat power (`levies/readme.txt`). A per-age set of "drilled" levy unit types with `strength_damage_done +0.25`, `morale_damage_done +0.25`, `strength_damage_taken −0.20`, `morale_damage_taken −0.20` cancels the −20% discipline exactly against regulars at base discipline: 0.8 × 1.25 = 1 dealt, 1.25 × 0.8 = 1 taken. Those stats also raise the unit's total combat power, so the drilled version wins the pick automatically. Side effect: they also out-power flavour levies, which then stop raising for that country.
2. **`add_unit_modifier` on levy armies** (script). Armies have an `is_levy` trigger, and a unit modifier with `discipline = 0.2` can be put on them from an on_action or a monthly pulse. But unit modifiers cover the whole army, so a levy merged into a regular army would hand the bonus to regulars too, and it needs refreshing whenever levies are raised.

---

## 9. Experience

- Damage taken × (1 − 0.5 × experience ÷ 100): 50 experience = −25% damage taken, 100 = −50%. *(code)*
- Monthly experience decay: base `experience_decay` 5% (country base values), regulars −1%, levies +2%. Mercenaries get +15% monthly experience gain and start with the age's `mercenary_starting_experience`.
- `NCombat.EXPERIENCE_GAIN` = 30 is the experience gained from battles *(defines only)*.

---

## 10. Unit data

### Category base stats (`in_game/common/unit_categories`)

| Category | Damage taken | Strength dmg done | Morale dmg taken | Initiative | Combat speed | Flanking | Secure flanks |
|---|---|---|---|---|---|---|---|
| Light infantry | 1.0 | −10% | +10% | 5 | 3 | 1.1 | 0.05 |
| Heavy infantry | 1.0 | – | – | 1 | 2 | 1.0 | 0.05 |
| Light cavalry | 0.30 | −10% | +10% | 5 | 5 | 1.6 | 0 |
| Heavy cavalry | 0.30 | – | – | 2 | 5 | 1.6 | 0 |
| Artillery | 1.25 | – | – | 1 | 1 | 1.0 | 0 |
| Auxiliary | 1.25 | – | – | 1 | 0.1 | 1.0 | 0 |

Cavalry also take −10% combat in mountains, wetlands and jungle and −10% at rivers (heavy cavalry), and suffer +25% attrition.

### Combat power and regiment size by age (`unit_types/00_age_templates_land.txt`)

| Age | Infantry power | Infantry size | Cavalry power | Cavalry size | Artillery power | Artillery size |
|---|---|---|---|---|---|---|
| I Traditions | 1 | 0.5 | 2.6 | 0.2 | 2 | 0.1 |
| II Renaissance | 1 | 1.0 | 2.6 | 0.4 | 3 | 0.2 |
| III Discovery | 1 | 1.5 | 2.6 | 0.6 | 4 | 0.6 |
| IV Reformation | 1.5 | 2.0 | 2.85 | 0.8 | 5 | 0.8 |
| V Absolutism | 2.25 | 2.5 | 3.25 | 1.0 | 5.5 | 1.0 |
| VI Revolutions | 3 | 3.0 | 3.25 | 1.2 | 7.5 | 1.2 |

Size is `max_strength` (1.0 = 1000 men). Light and heavy versions of a category share these values; unique units add their own changes on top.

### Static unit modifiers (`static_modifiers/subunit.txt`)

| Modifier | Effects |
|---|---|
| `is_army_levy` | discipline −20%, experience decay +2%, food consumption −75% |
| `is_army_regular` | experience decay −1% |
| `is_army_mercenary` | food consumption +50%, monthly experience gain +15% |
| `is_navy_levy` / `is_navy_regular` | experience decay +2% / −1% |

### Country base values (`auto_modifiers/country.txt`, `country_base_values`)

`military_tactics` 1.0, `experience_decay` 5%, `combined_bonus_per_type` 2.5%, `combined_arms_min_percent_for_bonus` 10%, `combined_arms_max_threshold` 50%, `max_war_exhaustion` 20.

---

## 11. Worked example: why MP armies go cavalry first, infantry later

Same roll of 11 (raw die 6, shown as 7; base 1.32), both engaged, equal discipline and tactics, no terrain, full-strength regiments.

**Renaissance** (infantry power 1, size 1.0; cavalry power 2.6, size 0.4):

| | Strength loss | as % of target | Morale loss |
|---|---|---|---|
| Infantry hits cavalry | 1.32 × 0.04 × 1.0 men × 1 × 0.30 = 0.016 (16 men) | 4% of 400 | 1.32 × 0.25 × size 2.5 × 1 × 0.30 = 0.25 |
| Cavalry hits infantry | 1.32 × 0.04 × 0.4 men × 2.6 × 1.0 = 0.055 (55 men) | 5.5% of 1000 | 1.32 × 0.25 × size 0.4 × 2.6 × 1.0 = 0.34 |

**Absolutism** (infantry power 2.25, size 2.5; cavalry power 3.25, size 1.0):

| | Strength loss | as % of target | Morale loss |
|---|---|---|---|
| Infantry hits cavalry | 1.32 × 0.04 × 2.5 × 2.25 × 0.30 = 0.089 | 8.9% of 1000 | 1.32 × 0.25 × 2.5 × 2.25 × 0.30 = 0.56 |
| Cavalry hits infantry | 1.32 × 0.04 × 1.0 × 3.25 × 1.0 = 0.172 | 6.9% of 2500 | 1.32 × 0.25 × 0.4 × 3.25 × 1.0 = 0.43 |

Early on, cavalry's 0.30 damage taken and 2.6 power outweigh infantry's size. By Absolutism, infantry's power and size growth flip it: infantry deal more morale damage and lose a smaller share of their men. Cavalry also cost more frontage per man and more upkeep.

---

## 11a. What a stat is worth

Analytically, against an equal enemy:
- **+5% discipline:** you deal ×1.05 and take ÷1.05, a trade of ×1.10.
- **+0.1 military tactics:** you take ÷1.1 and deal the same, a trade of ×1.10.
- **Tactics only counts as a gap:** each +0.1 is worth ÷(1 + gap), so it shrinks a little when one side already leads. Discipline also shrinks slightly as its base grows.

Simulated with the battle simulator (2,000 battles, equal armies of heavy infantry, heavy cavalry and artillery, one side with the bonus):

| Bonus | Win rate, Renaissance | Win rate, Absolutism | Enemy losses ÷ own losses |
|---|---|---|---|
| none | 50% | 49% | 0.99 |
| +5% discipline | 64.2% | 59.8% | 1.18 |
| +0.1 tactics | 64.3% | 60.0% | 1.17 |
| +10% discipline | 77.6% | 69.7% | 1.39 |
| +0.2 tactics | 76.2% | 68.8% | 1.36 |
| +10% morale | 63.1% | 59.0% | 1.05 |
| +1 commander die | 64.6% | 60.2% | 1.19 |
| +20 experience | 66.2% | 60.3% | 1.19 |

So **+0.1 tactics ≈ +5% discipline**. Discipline edges ahead at larger amounts because it scales both sides of the trade. Morale wins battles without trading better (it keeps regiments in the line longer).

---

## 12. Sieges *(defines only, not traced in code)*

- `SIEGE_DAYS_PER_PHASE` 1: siege dice re-roll every day (was 5 on 1.3).
- `DAYS_PER_SIEGE_PHASE` 30, `MIN_DAYS_PER_SIEGE_PHASE` 7, `DAYS_PER_SIEGE_PHASE_WITHOUT_FORT` 15.
- `SIEGE_REGIMENTS_FOR_ARTILLERY` 2 (was 3).
- `SIEGE_WIN` 20; `SIEGE_GARRISON_SURRENDER_THRESHOLD` 5%; `MAX_BREACH` 3, `BREACH_REPAIR_PER_DAY` 0.01.
- Shortages hurt the defender each phase: supply `SIEGE_SUPPLY_SHORTAGE_LOSS` 2% (impact 1), food 3% (impact 2), water 5% (impact 3), desertion 10% (impact 2), breach 5% (impact 2).
- Assaults: `ASSAULT_DICE_MODIFIER` 5; the attacker loses `ASSAULT_ATTACKER_LOSS` 2.5 and morale 3.0, the defender 0.03 and morale 0.3 *(units not traced)*; `ASSAULT_WIDTH_LIMIT` 1.
- `SIEGE_DISEASE_IMPACT` 5%; `SIEGE_MAX_FORT_LIMIT_BONUS` 8.

---

## 13. What changed from 1.3.11 to 1.4.4 (defines)

1.3 ticked combat per "hour" and 1.4 per day, so per-tick numbers aren't directly comparable.

| Define | 1.3.11 | 1.4.4 |
|---|---|---|
| Tick | `HOURS_PER_PHASE` 5, `MINIMUM_COMBAT_DURATION` 24 | `DAYS_PER_PHASE` 4, `MINIMUM_COMBAT_DAYS` 5 |
| `COMBAT_DAMAGE_MULT` | 0.01 | 0.12 |
| `LAND_STRENGTH_DAMAGE_MODIFIER` | 0.2 | 0.04 |
| `LAND_MORALE_DAMAGE_MODIFIER` | 1.0 | 0.25 |
| `NAVAL_STRENGTH_DAMAGE_MODIFIER` / `NAVAL_MORALE_DAMAGE_MODIFIER` | 0.25 / 0.2 | 0.0625 / 0.05 |
| Morale tick | `COMBAT_HOURLY_MORALE_TICK` 0.01 | `COMBAT_DAILY_MORALE_TICK` 0.03 |
| Initiative | base 0.1, each 0.02, max 0.1, +0.01/hour | base 0.60, each 0.025, max 0.30, +0.03/day |
| `COMBAT_SPEED_SCALE` | 0.05 | 0.1 |
| Overruns | – | `INITIAL_OVERRUN_FACTOR` 10, `MORALE_OVERRUN_FACTOR` 2 |
| `MORALE_SIZE_RATIO_MAX` | – | 4.0 |
| Bombard | `BOMBARD_HOURS` 5 | `BOMBARD_DAYS` 3 |
| `NAVAL_RETREAT_CHANCE` | 10 | 3 |
| `SIEGE_DAYS_PER_PHASE` | 5 | 1 |
| `SIEGE_REGIMENTS_FOR_ARTILLERY` | 3 | 2 |
| Levy discipline (`is_army_levy`) | −10% | −20% |

---

## 14. Ars Belli changes that touch combat

- Levy combat efficiency on the focus picks: Designated Instruction +30% (worth +7.5% levy damage vs regulars), Nationalistic Enthusiasm +10%.
- `high_horde_unity`: discipline +5% (vanilla +10%). `horde_army_expectation`: land morale −10% (vanilla −50%).
- Mercenary hiring costs back to vanilla (2026-10-28).
- No combat defines are overridden (`01_abm_defines.txt` only touches war score, war worth, food depots and loans).

---

## 15. Upkeep and reinforcement *(code, `0x14357a730`, `0x143491290`, `0x14352ed50`)*

**Maintenance** of one regiment, per month:

```
cost = goods(maintenance_demand) x current strength
       x army maintenance slider ("Investment in Maintenance")
       x category maintenance cost multipliers (army_*_maintenance_cost_modifier)
       / (1 + army_maintenance_efficiency)        (efficiency floored at -95%)
       x 0.5 if mothballed (MOTHBALL_MAINTENANCE_FACTOR)
       x prisoners factor if it is a prisoner unit (PRISONERS_MAINTENANCE_FACTOR 0.3)
levy:      x LEVY_MAINTENANCE_FACTOR 0.01 x (1 + levy_maintenance_modifier)
mercenary: x MERCENARY_MONTHLY_MAINTENANCE_MULTIPLIER 1.35, efficiency = mercenary_maintenance_efficiency
```

- **Goods, not gold.** Upkeep is a basket of goods bought at market prices (`goods_demand/army_demands.txt`). Per regiment: infantry 0.1 firearms + 0.1 weaponry + 0.06 leather (early infantry has no firearms); heavy cavalry 1.0 horses + 0.2 weaponry + 0.2 tools + 0.1 leather + 0.1 cloth; light cavalry 0.5 horses + …; artillery 1.0 cannons + 0.2 copper + 0.1 tin. Cavalry and artillery cost follows horse and cannon prices.
- **Efficiency divides.** +25% maintenance efficiency means paying 80%, not 75% (confirmed in game with mercenaries: 6.24 → 5.49 when efficiency went 10% → 25%).
- **Levies cost 1%** of a regular's upkeep, so `levy_maintenance_modifier` −50% saves half of almost nothing.
- **Recruitment** uses `construction_demand` (e.g. infantry 0.2 firearms + 0.2 weaponry + 0.1 leather; heavy cavalry 2.0 horses + …; artillery 2.0 cannons + 2.0 copper + 0.2 tin).

**Reinforcement**, per month:

```
rate    = situation factor x MONTHLY_REINFORCE 0.25 x (1 + regiment_reinforcement_speed)
amount  = min(missing men, rate x max strength)
cost    = goods for those men (bought from the market) / (1 + army_reinforce_efficiency)   (floored at -50%)
```

- A regiment refills at most 25% of its size a month before speed bonuses. The situation factor (supply, location, at war or not) was not traced.
- Navies use `navy_repair_efficiency` the same way.
- Category `army_*_reinforce_cost_modifier` also exists (where it enters was not traced).

---

## 16. Battle simulator

`.tools/scripts/battle_sim/` holds `engine.js` (the rules above as code; runs in Node: `node -e "const S=require('./engine.js'); console.log(S.monteCarlo(S.defaultSide(), S.defaultSide(), 500))"`) and `battle-sim.html`, the interactive page: https://claude.ai/artifact/PjQC55Y4sfvuuSdJKJEwFi. Its approximations: bombard only in the first 3 days, the order of steps inside a day, deployment, the combined-arms bonus, the end of battle, and the 90-day cap; terrain, river, religion and general traits other than dice are left out.

---

## Appendix: where it lives in eu5.exe 1.4.4

Kit: `E:\Tools\ghidra-scripts` (README there). Addresses change every patch; re-derive them from the define-name strings, loc labels and assert strings, which stay stable.

| What | Address | How found |
|---|---|---|
| Damage per hit | `0x142482130` | uses `COMBAT_BASE`, `COMBAT_MAX`, `COMBAT_DAMAGE_MULT`, `LAND_*_DAMAGE_MODIFIER`; labels `CT_STR_BASE` … `NOT_ENGAGED` |
| Damage wrapper (applies the losses) | `0x142482030` | only caller of the above besides the tooltip `0x143487cf0` |
| Dice roll | `0x142473840` | `COMBAT_DICE_SIDE` |
| Dice modifiers | `0x142476870` | `*_CROSSING_DICE`, `SEA_LANDING_DICE`, `commander_combat_bonus` |
| Daily battle tick | `0x1424a77f0` | `DAYS_PER_PHASE`, `BOMBARD_DAYS`, both overrun factors |
| Reserves (`HandleReserves`) | `0x14247e610` | assert string; calls combat speed `0x1424854a0` and frontage `0x142485a90` |
| Initiative (`AttemptInitative`) | `0x14247eee0` | assert string; chance in `0x1424862c0` |
| Daily morale drain | `0x142485920` | `COMBAT_DAILY_MORALE_TICK` |
| Unit placement, side strength | `0x142473ae0` | `MORALE_COLLAPSE_THRESHOLD`, `LAND_LEVY_COMBAT_IMPACT`, `NAVAL_LEVY_IMPACT` |
| Overrun check | `0x14248ed60` | called with `INITIAL_OVERRUN_FACTOR` / `MORALE_OVERRUN_FACTOR` |
| Retreat / battle end | `0x142477570` | `FOOD_PERCENTAGE_LOST_AT_RETREAT`, `NAVAL_LOW_MORALE_THRESHOLD` |
| Melee targeting, flanks, secured flanks | `0x142481230` | caller of the damage wrapper |
| Bombard hits | `0x142481ba0` | `BOMBARD_BASE_CHANCE` |
| Battle frontage W | `0x14247a0d0` | reads location modifier `local_frontage_allowed` (index `0x14f0a37ea`) |
| Regiment maintenance | `0x14357a730` | `LEVY_MAINTENANCE_FACTOR`, `MOTHBALL_MAINTENANCE_FACTOR`; labels `SUBUNIT_MAINTENANCE_FACTOR`, `LEVY_MAINTENANCE_RATE_TOOLTIP` |
| Reinforcement rate / cost | `0x143491290` / `0x14352ed50` | `MONTHLY_REINFORCE`; `army_reinforce_efficiency` (`0x14f0a3676`) |
| Siege / assault tick | `0x143475730` | all `SIEGE_*` / `ASSAULT_*` defines (not decompiled) |
| Modifier registration | `0x144c840f0` | each modifier name string is followed by a store of its index, e.g. discipline `0x14f0a37c2`, military_tactics `0x14f0a37ce`, levy_combat_efficiency `0x14f0a389e`, commander_combat_bonus `0x14f0a37d0`, army_initiative `0x14f0a37ee`, combat_speed_modifier `0x14f0a37f2` |

Helpers: `node definemap.js <eu5.exe> <00_defines.txt> NCombat` maps every define to its global and the functions that read it. `node peek.js str <va>` resolves label strings, and `node peek.js modmap 144c840f0 52669 [globals]` names modifier index globals. `DecompileAddrs.java` decompiles chosen addresses headless.
