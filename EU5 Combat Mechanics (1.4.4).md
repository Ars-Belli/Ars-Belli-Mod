# EU5 Combat Mechanics (game 1.4.4)

How land combat actually works in Europa Universalis V 1.4.4, read from the game code (eu5.exe decompiled with Ghidra) and the game files. Written for balancing Ars Belli: which numbers matter, how they combine, and what a modifier is really worth.

**Sources and confidence.** Formulas marked *(code)* were read from decompiled eu5.exe 1.4.4; the tooltip labels in `CAPS` are the loc keys each step uses, which name the factors. Values come from `loading_screen/common/defines/00_defines.txt`, `in_game/common/unit_categories`, `unit_types`, `main_menu/common/static_modifiers/subunit.txt` and `in_game/common/auto_modifiers/country.txt`. Anything marked *(defines only)* or *(not traced)* is inferred from define names and comments, not from code. Struct field names are inferred from those labels, so treat exotic edge cases with care. Re-check after every game update (see the appendix).

All engine math is fixed-point: 100000 = 1.0.

---

## 1. One day of battle

Combat ticks once per day (1.3 ticked per "hour"; see section 13). The daily tick is `0x1424a77f0`; this is its order. *(code)*

**Battle start**
1. Every regiment of the armies in the location is placed (`AddUnit`, section 6): into its formation's section while that section has room, otherwise into reserve.
2. Both sides roll dice.
3. **Stack wipe at the start:** if one side's men are at least `INITIAL_OVERRUN_FACTOR` = **10×** the other's, the weaker side is overrun at once, with no morale check. The battle screen warns about this with "They/We have a big enough army to instantly eliminate…" (`COMBAT_IMMINENT_STACKWIPE_*`).

**Every day**
1. Once the battle is older than `BOMBARD_DAYS` = **3** days, the bombard phase ends and both sides re-roll their dice.
2. Every `DAYS_PER_PHASE` = **4** days a new phase starts and **both sides re-roll their dice**. The dice modifiers (commander, terrain, crossings) are recomputed every day.
3. **Bombard phase (days 1–3): only artillery fires.** Per section, the guns in the battle line fire, up to W frontage of them; guns in reserve don't. Each rolls `0.2 × (1 + bombard efficiency)` once a day. A hit lands on the enemy section facing it: the gun keeps its last target if it is still there, otherwise it picks one at random. A miss makes it forget its target. Bombard hits get no flanking or secured-flank factors. Nothing happens if the facing section is empty. No reserves move, no regiment engages, no melee, no daily morale drain.
4. **From day 4:** side 1 moves reserves up (`HandleReserves`) and rolls initiative in each section (`AttemptInitiative`), then side 2 does the same. Then both sides' engaged regiments hit (side 1, then side 2), and every regiment in the battle loses `COMBAT_DAILY_MORALE_TICK` = **0.03** morale.
5. The day's collected strength and morale losses are applied together. Strength loss can't exceed the men a regiment has left.
6. Each section drops regiments that can no longer fight: morale below `MORALE_COLLAPSE_THRESHOLD` = **0.05** (absolute morale points, 1.7% of base morale 3.0) or almost no men left.
7. **End checks.** `0x142493100` compares the battle's age with `MINIMUM_COMBAT_DAYS` = **5** (plus the `retreat_delay` modifier; navies use `MINIMUM_NAVAL_COMBAT_DAYS` 5). The two branches differ:
   - **Days 1–4 (shorter than the minimum): only overruns.** A side whose battle-line morale has collapsed (≤ 0.05) is wiped out if the other side has at least `MORALE_OVERRUN_FACTOR` = **2×** its men; then the same check with 10×. Otherwise the battle goes on, even when one side's line is already empty.
   - **Day 5 on: the line decides.** If the attacker's three sections hold no men (each under 0.01 strength), the attacker **loses and retreats**; then the same check for the defender. A side is **destroyed** instead only if none of its armies can retreat. The retreat is **shattered** if the army's average morale is below `LOW_MORALE_THRESHOLD` = **0.5** (absolute, 17% of base morale; navies 1.5). If neither line is empty, the 10× overrun check (with collapsed morale) runs.

**Ordered retreats.** A side can only order a retreat once the battle has lasted `MINIMUM_COMBAT_DAYS` = **5** days plus `retreat_delay` (a modifier; its description says hours; Christian religions +20, some folk religions −5). The game says "It is not possible to retreat from a battle until N days have passed" (`RETREAT_BLOCK_TT`, `0x140135fa0`). It is the same check as the battle's own minimum length (`0x142493100`, which reads `retreat_delay`), so melee on days 4 and 5 can't be skipped: an artillery raid can't leave right after the bombardment. The retreat is a shattered retreat ("We can only force a shattered retreat from others' territory OR from a battle").

**Retreat losses.** `RETREAT_STRENGTH_DAMAGE` = 10% applies only to the **manual shattered retreat** order (the army's Shatter button: "a full retreat makes the army lose X% of its current strength"; `0x143521670`). Losing a battle costs no strength beyond the battle itself; the loser's armies lose `FOOD_PERCENTAGE_LOST_AT_RETREAT` = 50% of their food (`0x142477570`).

**Armies joining later.** An army that reaches the location while the battle runs joins it as fresh reserves (unless its correct section chance puts a regiment straight into its box, section 6) (the game's own hint: "You can bring neighboring armies to reinforce ongoing battles. If they arrive in time, they will join the fight as fresh reserves"). From there they move up by combat speed like any reserve. They arrive with whatever morale their march left them (section 7).

**"Men" in the overrun ratios** is each army's men still alive (current strength), with levies counted at their levy factor (section 8) (`0x143519150`). Navies count cannons instead, and naval levies at `NAVAL_LEVY_IMPACT` = 5%.

**What this means:**
- **A stack wipe needs 10:1 at the start, or 2:1 during the first 4 days once a side's line has broken.** A battle that lasts 5 days or more ends in a retreat, not a wipe, unless the loser has nowhere to retreat or is outnumbered 10:1 with its morale gone.
- Melee only starts on day 4, so a fresh army rarely breaks in time. The 2:1 wipe hits armies that **enter a battle already broken**: one attacked again before its morale has recovered from the last battle, one that marched its morale away (section 7), or one shredded by guns in days 1–3.
- To avoid being wiped, don't let a low-morale army be caught by twice its men; let it recover first.
- Reinforcements that arrive in time count towards the ratios and the line.

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
| `COMBINED_ARMS` | both | × (1 + A side's combined-arms bonus) | *(code, `0x142486dd0`)* counts **regiments** per category over the side's armies, auxiliaries excluded. If any category is ≥ `combined_arms_max_threshold` 50% of them, the bonus is **0**. Otherwise each category with ≥ `combined_arms_min_percent_for_bonus` 10% adds `combined_bonus_per_type` 0.025 (at most 5 categories, so ≤ 12.5%). An army that is half heavy infantry gets nothing |
| `SECURED_FLANKS` | both | × max(0.05, 1 − n × B `secure_flanks_defense`), n = secured flanks | infantry 0.05 per secured flank, others 0 |
| `TOPOGRAPHY`, `VEGETATION`, `CLIMATE` | both | × (1 + A's regiment terrain value + A unit type `combat = { … }` entry) for the battle location, one factor per layer | e.g. cavalry −10% in mountains, wetlands, jungle. The only data that feeds these is the `combat` blocks of unit categories and unit types (added together). No country-level terrain modifier type exists in 1.4.4 (checked modifier definitions, localization and exe strings) |
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
  - **Commander:** the `commander_combat_bonus` of the side's commander, rounded to whole dice. The commander is the best-rated leader among the side's armies. **Only traits give it** (Offensive Planner +1, others ±1 or +2); skill adds no dice. Confirmed on 9 live battles in three 1342 saves: each side's untyped dice entry is just the die shown (last raw die + 1), and a separate `COMMANDER` entry appears only for generals with such a trait.
  - **Attacker only:** river crossing −1 (`RIVER_CROSSING_DICE`), strait −2 (`STRAIT_CROSSING_DICE`), landing from the sea −1 (`SEA_LANDING_DICE`).
  - **Attacker only, terrain:** minus the `defender` value of the location's topography, vegetation and climate. Mountains −2; hills, plateau, wetlands and narrows −1; woods, forest and jungle −1; climates 0. So an attack into forested mountains is −3 dice, plus −1 across a river.
- The roll caps at 15 (`COMBAT_MAX`), which only a dice bonus can reach (14 + 1). Each extra die is worth the same until the cap.
- The non-die entries of the side's dice list are summed into the dice modifier for every hit that side deals. *(code, `0x142481230`)*

---

### Generals
A general's skills scale static modifiers on his army (`static_modifiers/character.txt`, per skill point):

| Skill | Per point | At 75 |
|---|---|---|
| Military (`general_mil`) | discipline +0.1%, combat speed +0.5%, movement speed +0.2% | +7.5% discipline, +37.5% combat speed |
| Diplomatic (`general_dip`) | land morale +0.2%, army initiative +1%, food consumption −0.5% | +15% morale, +75% initiative (the initiative bonus saturates near +30% of chance, section 4) |
| Administrative (`general_adm`) | siege ability +0.1%, correct section chance +0.1%, logistics distance +0.5%, possible frontage +0.1% | +7.5% siege ability, +7.5% correct section chance |

Traits add their own modifiers (e.g. Defensive Planner +0.1 military tactics).

Simulated (v3, 3,000 even Renaissance battles, 16 heavy infantry + 6 heavy cavalry + 2 artillery a side, one side with the general): a **75/75/75 general wins 88%**. Military 75 alone wins 71%, and so does diplomatic 75 alone. For comparison, +0.1 tactics wins 65% and +0.2 tactics 77%. A good general is worth more than any single country modifier.

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

- **Battle frontage W** is the location's `local_frontage_allowed` (`0x14247a0d0`), never below 2 (`MIN_FRONTAGE_AFTER_TERRAIN`):
  - 10 base (static modifier on every location);
  - terrain: mountains −4, hills −3, wetlands −3, plateau −1, forests −2 to −4 (vegetation);
  - location rank (`location_ranks`): town −1, city −2, megalopolis −3.
  - Then **each side** multiplies it by (1 + `possible_frontage_modifier`) of one of its armies (picked by `0x1424722b0` mode 2; probably the commanding army, not verified). Sources: generals' administrative skill +0.1% a point, the Absolutism advance +10%, a military law +5%, a general trait +10%. So the attacker and defender can have different widths, and the width is not rounded.
- **Forts don't touch field battles.** The engine's dice modifier types are DICE, TOPOGRAPHY, VEGETATION, CLIMATE, RIVER_CROSSING, STRAIT_CROSSING, SEA_LANDING and COMMANDER: no fort entry. No fort modifier changes frontage. Forts matter for sieges and zones of control only.
- **Three sections**, left, centre and right, each holding **1.25 × W** frontage of engaged regiments (`MAX_FRONTAGE_OVERSTACKING`, also `max_frontage = 1.25` per section in `unit_formation_preference`). Every land regiment has frontage 1.
- **Boxes.** Every regiment carries a `box` (Left / Center / Right; no box stored = Center), set when its army is formed by the army's formation (`unit_formation_preference/army.txt`, "autobalance").
  - Saves show `balanced_army` dealing identical regiments out in a snake: C L R R L C C L R R L C…, so 16 regiments make 5 C, 5 L and 6 R.
  - `cav_inf_cav` weights cavalry 10 on each flank and infantry 20 in the centre.
  - The autobalance code itself was not found. The rule above is read from 535 armies in a 1342 save. Boxes persist, so armies that gained and lost regiments over time show mixed patterns.
- **Deployment** (`AddUnit`, `0x142473ae0`, *code*): a regiment enters its box while that section holds **less than** 1.25 × W frontage (so the last one may overfill it slightly); otherwise it waits in reserve. Auxiliaries go to reserve.
- **Late arrivals:** an army that is not there at the start reaches its box only with `correct_box_chance` ("Correct Section Chance": "the chance of a unit late to a battle joining their intended section"); otherwise it goes to reserve. The base is 0. Several age advances give +10%, and a general gives +0.1% per administrative point.
- **Reserves** (`HandleReserves`): each day a side spends a frontage budget of W on reserve regiments. Each considered regiment scores every section as *enemy engaged frontage facing it + our free room* and moves into the best one with its combat-speed chance (section 5).
- **Targets** (`0x142481230`): an engaged regiment hits the enemy section **facing** it (left faces their right, centre faces centre). It keeps its last target while that target is still in the section; otherwise it picks a random enemy there. If the facing section is empty, it looks in this order: the enemy centre, left, right, reserve, then any other enemy regiment in the battle.
- **Flank attack** (× flanking ability): the target is not in the section facing the attacker, the attacker's side has regiments facing the target's section, and the enemy section facing the attacker is empty. In short: a section whose opposite number is gone helps a neighbouring fight from the side.
- **Secured flanks** (the `SECURED_FLANKS` factor): a target on a flank counts 1 secured flank if its own centre is occupied; a target in the centre counts one per occupied flank. Infantry take 5% less damage per secured flank.
- **Bombard** (`0x142481720` per side, `0x142481ba0` per section): see section 1, step 3. Same damage function, side dice included.

---

## 7. Morale

### Maximum morale
- Base land and naval morale: 3.0 (`NUnit.LAND_MORALE` / `NAVAL_MORALE`). **Max morale = (3.0 + flat `land_morale`) × (1 + `land_morale_modifier`)**: the flat bonuses join the base before the percentages. The game's tooltip shows this; Spain 1547 has (3.00 + 0.25 Pike and Shot + 0.25 Medieval Military) × (1 + 2.73% army tradition + 5% Offensive Military Doctrine + 5.30% ruler) = 3.95.
- Country auto modifiers (`auto_modifiers/country.txt`): war exhaustion −2.5% land morale per point; army tradition up to +20% (at 100); revolutionary +25%; horde army expectation −50% (−10% in Ars Belli).
- **Locked armies:** while an army is "locked" (a date stored on the army is still in the future, e.g. after a retreat; *which events set it was not traced*), its maximum morale is capped at `LOCKED_MORALE_CAP` = **50%**. *(code, `0x1434f47a0`)*

### In battle *(code)*
- Losses: combat morale damage (section 2) + 0.03 per day just for being in the battle (not during the 3-day bombard phase).
- At 0.05 morale (absolute) a regiment leaves the line; a side with nobody left able to fight has lost.

### Outside battle: one daily change *(code, `0x1434f47a0`; the tooltip calls it "Daily Change")*

```
daily change = max morale x ( recovery - movement cost - attrition cost x current attrition )
recovery      = land_morale_recovery (base 5%)  x (1 + morale_recovery_in_friendly 25%) in friendly territory
                = 0 while the army is moving ("While an army is moving, it can not recover morale")
movement cost = land_morale_movement_cost (base 0.0069 = 0.69% of max morale per day), only while moving
attrition cost = land_morale_attrition_cost (base 0.01) x the army's current attrition
```

Base values are in `country_base_values`. So standing still, an army recovers **5% of its max morale a day (6.25% at home)**, about 16–20 days from empty to full. On the march it recovers nothing and loses 0.69% a day.

### What a movement-cost modifier is worth
There is no waiting time before a battle starts. A battle begins as soon as hostile armies share a location, so movement cost only matters through the **morale an army arrives with**. Ars Belli's Trained March and Unrelenting Advance each give **−0.14%** (0.69% → 0.55%; both → 0.41%).

| Days marched | Base 0.69%/day | One advance (0.55%) | Both (0.41%) |
|---|---|---|---|
| 5 | arrives at 96.5% | 97.3% | 98.0% |
| 10 | 93.1% | 94.5% | 95.9% |
| 20 | 86.2% | 89.0% | 91.8% |

- **Recovery time:** 10 days of marching cost 6.9% of max morale, which takes 1.4 days of rest to win back (5%/day). One advance cuts that by 0.3 days, both by 0.6 days.
- **Simulated** (simulator v3, equal Renaissance armies of 16 heavy infantry, 6 heavy cavalry and 2 artillery, 3,000 battles each, the attacker marched before the battle): attacker win rate after 10 days' march, base 39.3% → one advance 41.3% → both 42.8% (no march: 49.1%). After 20 days: 29.5% → 33.1% → 37.0%.
- So each −0.14% is worth about **+2 to 4 points of win rate per 10 to 20 days of marching** into a battle. The longer the march, the more it matters, and it is worthless for armies that rest before attacking.

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

Early on, cavalry's 0.30 damage taken and 2.6 power outweigh infantry's size. By Absolutism, infantry's power and size growth flip it: infantry deal more morale damage and lose a smaller share of their men.

**Per frontage slot vs per manpower** (`analysis/cav_transition.js`: 30 heavy infantry vs heavy cavalry of the same age, frontage 10, cavalry win rate):

| Age | Equal regiments, +0 / +10 / +20 / +50% cavalry power | Equal manpower upkeep (cavalry gets 25% more regiments) |
|---|---|---|
| IV (Reformation) | 43% / 58% / 70% / 90% | 95% / 98% / 99% / 100% |
| V (Absolutism) | 14% / 22% / 32% / 62% | 71% / 81% / 87% / 97% |
| VI (Revolutions) | 2% / 4% / 10% / 27% | 28% / 38% / 50% / 75% |

- **Cavalry is cheap in manpower per frontage slot.** It needs 4% of its men a month against infantry's 2%, but its regiments are a third to two fifths the size: 32 against 40 men a month per regiment in age IV, and 48 against 60 in age VI. It also never loses more men than the infantry: infantry loses 1.0× (age VI, equal regiments, no bonus) to 9.8× as many.
- **At equal regiments**, the multiplayer meta appears: in the Reformation, cavalry with about +10% power still beats infantry, so cavalry-bonus countries can keep cavalry one more age. From Absolutism, infantry wins unless cavalry has +50%.
- **At equal manpower**, cavalry stays ahead into Absolutism, and in age VI breaks even at +20% power. If manpower were the only limit after 1550, cavalry should still win. That the meta switches suggests regiment count is the real limit: recruitment locations, supply weight, horses on the market, or frontage-filling stacks.

---

## 11a. What a stat is worth

Analytically, against an equal enemy:
- **+5% discipline:** you deal ×1.05 and take ÷1.05, a trade of ×1.10.
- **+0.1 military tactics:** you take ÷1.1 and deal the same, a trade of ×1.10.
- **Tactics only counts as a gap:** each +0.1 is worth ÷(1 + gap), so it shrinks a little when one side already leads. Discipline also shrinks slightly as its base grows.

Simulated with the battle simulator v3 (2,000 battles, frontage 10, each side 16 heavy infantry, 6 heavy cavalry and 2 artillery, one side with the bonus; draws count half):

| Bonus | Win rate, Renaissance | Win rate, Absolutism | Enemy losses ÷ own losses (Renaissance) |
|---|---|---|---|
| none | 49.4% | 49.5% | 1.00 |
| +5% discipline | 64.1% | 60.3% | 1.18 |
| +0.1 tactics | 62.9% | 60.2% | 1.17 |
| +10% discipline | 76.0% | 70.6% | 1.37 |
| +0.2 tactics | 77.0% | 69.3% | 1.37 |
| +10% morale | 62.5% | 60.1% | 1.05 |
| +1 commander die | 63.9% | 62.2% | 1.19 |
| +20 experience | 64.6% | 61.9% | 1.19 |
| +10% infantry power | 58.0% | 57.7% | 1.11 |
| +10% cavalry power | 54.1% | 51.7% | 1.05 |
| +25% army initiative | 49.8% | 50.2% | 1.00 |
| +25% combat speed | 49.4% | 49.5% | 1.00 |

So **+0.1 tactics ≈ +5% discipline ≈ +1 commander die ≈ +20 experience**, each worth about 63% in an even Renaissance battle. Discipline edges ahead at larger amounts because it scales both sides of the trade. Morale wins battles without trading better (it keeps regiments in the line longer). Initiative and combat speed are worth nothing here: all 24 regiments fit in the line, so there are no reserves, and every regiment engages within two days anyway. They matter when armies are larger than the frontage or arrive late.

(v3 = exact end rules, bombard limited to W guns per section, combined arms by regiment count. Neither army gets a combined-arms bonus: heavy infantry is two thirds of it. The v2 table, before those fixes, read about 2 points higher for every bonus.)

---

## 12. Sieges *(partly code; marked per line)*

**Phase length** *(code, `0x143462cb0`; the arithmetic of the modifiers not finished)*: a siege rolls once per phase. The base is `DAYS_PER_SIEGE_PHASE` **30** days with a fort, `DAYS_PER_SIEGE_PHASE_WITHOUT_FORT` **15** without, and never under `MIN_DAYS_PER_SIEGE_PHASE` **7**. It is changed by the besieger's `siege_ability`, the fort's defence (`global_defensive` + `local_defensive`), the spy network and culture war; the tooltip reads "Siege phases are X (±Y%) days long".

**The roll** *(code, `0x143465df0`)*: a die of **1–14** plus siege modifiers. The modifiers include the breach bonus and an artillery bonus of artillery regiments ÷ `SIEGE_REGIMENTS_FOR_ARTILLERY` **2** (was 3 on 1.3). The artillery bonus is capped by `artillery_bonus_vs_fort` and the fort level, up to `SIEGE_MAX_FORT_LIMIT_BONUS` 8.

**Outcome of a phase** *(code, `0x143466d60`; `SIEGE_WIN` 20)*:

| Total | Outcome | Effect |
|---|---|---|
| natural 1 | disease | the besiegers lose `SIEGE_DISEASE_IMPACT` 5% of their max strength |
| 2–4 | status quo | nothing |
| 5–11 | supplies shortage | garrison −2% (impact 1) |
| 12–13 | food shortage | garrison −3% (impact 2) |
| 14–15 | water shortage | garrison −5% (impact 3) |
| 16–19 | defenders desert | garrison −10% (impact 2) |
| 20 or more | surrender | the fort falls |

- A **breach** costs the garrison 5% (impact 2) and gives a roll bonus; at most `MAX_BREACH` 3, repaired at `BREACH_REPAIR_PER_DAY` 1% a day. *(defines; the breach trigger was not traced)*
- "Impact" is probably a roll bonus for the next phases *(not confirmed)*.
- The garrison surrenders at or under `SIEGE_GARRISON_SURRENDER_THRESHOLD` **5%**. *(code)*
- The siege only progresses while the besiegers' men are at least the garrison's (100 men without a fort). *(code)*
- **Assaults** *(defines only)*: `ASSAULT_DICE_MODIFIER` +5; the attacker loses `ASSAULT_ATTACKER_LOSS` 2.5 and morale 3.0, the defender 0.03 and morale 0.3 (units not traced); `ASSAULT_WIDTH_LIMIT` 1; `SIEGE_DAYS_PER_PHASE` 1 (was 5 on 1.3).

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
- Levy focus, Enforced Service: Nobles Levy Size +30% (nobles raise the cavalry levies; France's French Heritage gives the same). Levy knights (Mailed Knights, Plated Knights, Cavaliers…) take 25% less strength and morale damage than regular heavy cavalry, which offsets part of the levy penalties.
- Army Morale Movement Cost −0.14% on Trained March (Quality) and Unrelenting Advance (Maneuver); see section 7 for what it is worth.
- `high_horde_unity`: discipline +5% (vanilla +10%). `horde_army_expectation`: land morale −10% (vanilla −50%).
- Mercenary hiring costs back to vanilla (2026-10-28).
- No combat defines are overridden (`01_abm_defines.txt` only touches war score, war worth, food depots and loans).

---

## 15. Costs: recruitment, upkeep, reinforcement and manpower

**Prices** (`in_game/common/prices/02_units.txt`; GUI `UnitTypeItem.GetManpowerCost` → `0x1477d17a0` → cost struct `0x144d189c0`). Every army category has three prices, each `{ gold, manpower }`, and a unit can add its own (`<unit>_build` etc., e.g. Clan Retainers −30 gold). The file's own note: "All manpower costs scale by max_strength, so army units should be at 1 manpower".

| Category | Build gold / manpower | Reinforce gold / manpower | Maintenance gold / manpower (a month) |
|---|---|---|---|
| Light infantry | 40 / 1 | 2 / 1 | 0.4 / 0.02 |
| Heavy infantry | 50 / 1 | 2.5 / 1 | 0.5 / 0.02 |
| Light cavalry | 100 / 1 | 5 / 1 | 1.0 / 0.04 |
| Heavy cavalry | 150 / 1 | 7.5 / 1 | 1.5 / 0.04 |
| Artillery | 200 / 1 | 10 / 1 | 2.0 / 0.04 |
| Auxiliary | 100 / 1 | 5 / 1 | 1.0 / 0.02 |

*(code, `0x144d189c0`)*
- **Manpower** = price × max strength (1 = the regiment's men). Recruiting costs the regiment's full size; reinforcing costs one man per man; upkeep is 2% of the regiment's men a month for infantry and auxiliaries, 4% for cavalry and artillery.
- **Gold** = price × max strength ÷ `BASE_REGIMENT_PRICE_SCALE` 0.1 ("100 men is a base"), i.e. the price is per 100 men. A 500-man Footmen regiment recruits for 250 gold.
- Each price is scaled by its `army_<category>_<build|reinforce|maintenance>_cost_modifier`. The modifier scales the whole price, so a −20% cavalry build cost (Halych's parliament modifier) also cuts the manpower. This follows the price system; the multiplication itself was not traced.
- **Upkeep** (gold and manpower) is divided by (1 + `army_maintenance_efficiency`), floored at −95%. Mothballed regiments pay 50%, prisoners 30%. Levies pay `LEVY_MAINTENANCE_FACTOR` 1% of the gold and no manpower. Mercenaries pay ×1.35 with `mercenary_maintenance_efficiency`.
- **Efficiency divides.** +25% efficiency means paying 80%, not 75% (confirmed in game with mercenaries: 6.24 → 5.49 when efficiency went 10% → 25%).
- **Confirmed by the game's manpower tooltip (Spain 1547):**
  - One Lanzas de Castilla: "Base Cost 0.02" (0.04 × 600 men = 0.024), "Army Maintenance Efficiency at +26.72%: −21.08%" (= 1 − 1/1.2672), "Current Strength ×1.00", total −18 a month.
  - 23 of them: −435 (0.024 × 23 ÷ 1.2672 = 0.4356).
  - So **upkeep scales with current strength**, and efficiency divides it. The simulator does both.
- **Checked on the 1342 save:**
  - Manpower upkeep matches to the man. Moldavia's 16 Horsemen cost 0.04 × 0.2 × 16 ÷ 1.0635 = 120 a month; with 9 a month of income, the save's net change is −111.2 (formula −111.3). Halych's 16 Footmen cost 150; the save's net change is −133.7 (formula −133.7).
  - Gold upkeep in the budget was about **68%** of the price-list value for both armies (20.8 vs 30.1, 25.2 vs 37.6). A common factor is missing (not traced).
  - The goods baskets (`goods_demand/army_demands.txt`) are the regiments' market **demand**, not their gold cost: priced at base, they come out 3–5× below the budget. The earlier reading of `0x14357a730` as "goods × strength" is that demand.

**Reinforcement**, per month (`0x143491290`, `0x14352ed50`):

```
rate    = situation factor x MONTHLY_REINFORCE 0.25 x (1 + regiment_reinforcement_speed)
amount  = min(missing men, rate x max strength)
cost    = reinforce price for those men; gold / (1 + army_reinforce_efficiency)   (floored at -50%)
```

- A regiment refills at most 25% of its size a month before speed bonuses. The situation factor (supply, location, at war or not) was not traced.
- Reinforce efficiency divides the gold, not the manpower: each man added costs one manpower.
- Navies use `navy_repair_efficiency` the same way.

**Manpower pool.**
- Max manpower = `MAX_MANPOWER_YEARS` **5** years of monthly income (tooltip `MAX_MANPOWER_TT`). So income = max ÷ 60.
- The save's `monthly_manpower` is the **net** change: income − the upkeep of every army. It can be negative, as for both countries in the test save.
- Levies cost no manpower: they are raised from pops, and levies that die are pops lost (`LEVY_RECOVERY_MONTHS` 240).

---

## 16. Battle simulator

Interactive page: https://claude.ai/artifact/PjQC55Y4sfvuuSdJKJEwFi (Quick battle and Full battle tabs). Files in `.tools/scripts/battle_sim/`:

| File | What it is |
|---|---|
| `engine.js` | The rules of this document as code. Runs in the browser and in Node. |
| `units.json` | Every army unit type of vanilla 1.4.4 + Ars Belli with its effective stats, plus terrain. Rebuild with `node .tools/scripts/battle_sim/build_units.js` after a game update or a unit change. |
| `sim.js` | Command line: `node .tools/scripts/battle_sim/sim.js <scenario.json> [--runs 2000] [--seed 1] [--sample] [--json] [--campaign [battles]] [--months 3]`; `--units <text>` lists unit types matching a key or name. It always prints costs; `--campaign` adds the war of attrition. |
| `scenarios/` | Scenario files; `example_river_hills.json` shows every field. |
| `battle-sim.html` | The page (publish with `engine.js` and `units.json` as supporting files). |

**Unit stats are additive** (vanilla `levies/readme.txt`): every numeric stat line adds to what the unit inherited through `copy_from`, and the category's value is added on top. Writing `initiative = 2` on a unit whose parent already has 5, in a category with 5, gives 12, not 2. `build_units.js` follows this rule.

### Scenario format

```json
{
  "name": "…", "runs": 2000,
  "location": { "topography": "hills", "vegetation": "forest", "climate": "continental",
                "crossing": "none|river|strait|landing", "river": true, "coastal": false, "frontage": null,
                "rankFrontage": -1 },
  "countries": { "FRA": { "discipline": 0.05, "tactics": 1.1, "moraleMod": 0.1, "moraleFlat": 0,
                 "commanderDice": 1, "experience": 0, "levyCE": 0.3, "levyExperience": 0,
                 "initiativeMod": 0, "speedMod": 0, "movementCost": 0.0069,
                 "power": { "li": 0, "hi": 0, "lc": 0, "hc": 0.1, "art": 0 },
                 "sdd": 0, "sdt": 0, "mdd": 0, "mdt": 0,
                 "religion": "catholic", "religionGroup": "christian", "vsHeretic": 0, "vsHeathen": 0,
                 "maintenanceEfficiency": 0, "levyMaintenance": 0, "reinforceEfficiency": 0, "reinforceSpeed": 0,
                 "frontageMod": 0, "correctBoxChance": 0, "costMod": { "build": { "hc": -0.2 } } } },
  "attacker": { "armies": [ { "name": "…", "country": "FRA", "formation": "balanced|cav_inf_cav",
                "arrivalDay": 0, "marchDays": 6, "morale": null,
                "general": { "adm": 60, "dip": 70, "mil": 80, "dice": 1 },
                "units": [ { "type": "a_musketeers", "count": 10, "section": "L|C|R|reserve",
                             "strength": 0.8, "morale": 0.9, "moraleAbs": 2.6, "experience": 25, "levy": false } ] } ] },
  "defender": { "armies": [ … ] },
  "costs": { "hc": { "buildGold": 12, "upkeepGold": 3, "reinforceGold": 20 }, "a_musketeers": { … } },
  "war": { "battles": 8, "monthsBetweenBattles": 3,
           "sides": [ { "maxManpower": 60000, "surplusManpower": 600, "currentManpower": 50000 }, { … } ] }
}
```

- Percentages are fractions: 0.05 = +5%. `tactics` is the absolute value (base 1.0). `commanderDice` is the side commander's `commander_combat_bonus`; the side uses the highest among its armies present.
- `morale` (army or unit) is a fraction of max morale and overrides `marchDays`. Use it when a screenshot shows an army's current morale. `moraleAbs` is current morale in absolute points (what saves store) and overrides both.
- `general` adds the skill modifiers of section 3 to that army only; `dice` is its trait dice (`commander_combat_bonus`). A country's `correctBoxChance` sets how often late regiments reach their box.
- `rankFrontage` is the location rank's frontage change (town −1, city −2, megalopolis −3).
- `arrivalDay` > 0 means the army joins on that day as reserves. Defenders coming from a neighbouring location also march, so give them `marchDays`.
- `type` is a unit key from `units.json` (`sim.js --units musket` to search), or `generic:<li|hi|lc|hc|art|aux>:<age 1-6>`.
- `costs` (optional) overrides the base-price gold per unit key or category: `buildGold` per regiment, `upkeepGold` per regiment a month at full strength, `reinforceGold` per 1,000 men. Use it when market prices are far from base.
- `war` (optional) drives the war of attrition. Manpower is in men, and there is one pool per side, even with allied countries on it.
  - `surplusManpower` is the net gain a month after all the country's army upkeep (may be negative). It defaults to max ÷ 60 minus the upkeep of the armies in the scenario.
  - `currentManpower` defaults to the max.
- Country `costMod` (`{ build: { hc: -0.2 }, reinforce: {…}, maintenance: {…} }`) and `frontageMod` (possible frontage) are filled by `from_save.js`.

### Speed: all cores
- **Command line and analysis scripts:** `pool.js` runs battles on worker threads (all cores but two by default).
  - `sim.js --threads N` sets the count; `--threads 1` turns the workers off.
  - A seeded run splits its battles by seed offset, so it gives exactly the single-thread result.
  - 20,000 battles: 13.6 s on one thread, 2.9 s on 26 threads.
- **Page:** `worker.js` runs Web Workers (one per core but one), published next to the page; it falls back to the page thread if workers can't start. 5,000 battles take about 0.3 s on 28 cores.
- `engine.mergeMC(parts)` merges chunk results (counts add up, means are weighted by battles, intervals recomputed).

### Ordered retreats in scenarios
`attacker.retreatDay` / `defender.retreatDay`: that side orders a retreat at the end of that day (never before day 5). It loses 10% of its men and the battle. `analysis/artillery_raid.js` uses it.

### How sure a result is
Every Monte Carlo result carries 95% intervals for its sampling noise: the spread you would see if you ran the same battles again.
- **Win rates:** Wilson score interval. With n battles the half-width is about 1.96 × √(p(1−p)/n): ±3 points at 1,000 battles and p = 50%, ±1.4 at 5,000. It halves with 4× the battles.
- **Average losses and length:** mean ± 1.96 × standard error.
- **Losses traded** (enemy losses per own loss): delta-method interval from both sides' variances and their covariance.
- They do not cover wrong inputs or mechanics the simulator does not model. A difference between two options is only reliable when their intervals don't overlap, or when the same comparison holds across repeated runs.
- The page shows them as "95% range" in the tiles, as whiskers on both stat-worth charts (win rate, and enemy losses per own loss), and as a column in the war table. `sim.js` prints them too.

### Costs and the war of attrition
- **Per army:** recruitment manpower (regular regiments' full size) and gold, monthly upkeep, and reinforcement gold per 1,000 men (section 15).
- **Per battle:** the expected manpower to refill (one man per man lost by regulars), gold to reinforce what retreated, gold to rebuild regiments that were wiped, and pops that died as levies.
- **War of attrition** (`campaign` in `engine.js`): the same battle is fought `battles` times, `monthsBetweenBattles` apart, with the expected losses of each battle applied to every unit group.
  - Between battles each side adds its monthly surplus (net of all army upkeep; may be negative), keeping the pool between 0 and its max.
  - It then reinforces regulars at up to 25% of a regiment a month × (1 + reinforce speed); regiments that were wiped are rebuilt without that cap, if the pool allows.
  - Levies come back at full strength (raised again from pops); the pops they lost are counted.
  - A side is **worn down** once it can no longer refill its army past half strength before the next battle.
  - It is an expected-value model: each battle uses averages from a fresh Monte Carlo of the armies as they stand.

### From a save to a scenario (`from_save.js`)
Reads both kinds of save:
- **normal (binary) saves** (`SAV0303`): most keys are stored as names in `string_lookup`, so the same fields are read. Dates are hours since 1 Jan −5000; one unmatched `}` after `country_name_keys` is skipped.
- **debug-mode text saves** (`SAV0300`).

`latest` takes the newest save of either kind.

```
node .tools/scripts/battle_sim/from_save.js <save.eu5|latest> --list
node .tools/scripts/battle_sim/from_save.js <save|latest> --attacker <army id|TAG> --defender <army id|TAG> [--at <location>] [--out scenarios/x.json]
```

- **Regiments:** type, men, current morale (`moraleAbs`, absolute), experience, levy flag, and section from the stored box.
- **Generals:** traits plus skill modifiers, as a per-army country entry.
- **Location:** template terrain and rank. The river crossing comes from `locations.png` + `rivers.png`: a river along the border between the attacker's location and the battle location.
- **Countries:** combat values summed from these sources, each listed under `notes`:
  - base values, army tradition and war exhaustion;
  - the proper-culture nobles ratio (up to +10% discipline);
  - advances, law policies, estate privileges, timed modifiers and societal values.
  - Not counted: religion, culture, rulers and cabinet, government reforms, situations, and conditional auto-modifiers. Compare the notes with the military tab and edit the numbers if they differ.
- **Manpower:** max, the net monthly change (`monthly_manpower`, used as the surplus) and the current pool.
- `paradox.js` holds the shared script and save readers. The binary-save reader `eu5save.js` lives on branch `feature/trade-office-limit-1.4`.

### From an in-game screenshot to a scenario
Read, per army, the regiments by type (the unit names map to keys; names are in `units.json`), their count, and if visible each one's men and morale. Per country, read discipline, military tactics, morale, combat speed, initiative, unit power and levy combat efficiency from the military tab or modifier tooltips; read the general's combat bonus. For the location, read topography, vegetation, a river and whether the attacker crossed one. Then run `sim.js` and compare the day-by-day sample with the game's battle screen.

### Approximated in the simulator
- formation boxes in hand-made scenarios (the snake rule read from saves; scenarios built from a save carry the exact boxes);
- which regiments overflow into reserve when a section is full (the game sorts them first; the order was not decoded);
- the 120-day cap;
- the reinforcement goods basket, and the war of attrition's expected-value steps (section above).

Exact since v3 (2026-10-28): the end rules (section 1, step 7), bombard (W guns per section, one roll per gun, target forgotten on a miss), the melee fallback order and flank rule, combined arms by regiment count with the 50% cut-off, and the dice re-roll when the bombard phase ends.

Generals are modelled through skills plus trait dice (`general: { adm, dip, mil, dice }` on an army); other trait modifiers come in through `from_save.js`. There are no country-level terrain modifiers to model, and forts don't change field battles. Not modelled: naval combat.

---

## 17. Where the code and the tooltips disagree

What the game shows, and what the code actually does:

| Tooltip or description | What the code does |
|---|---|
| Battle die shown as 1–10 | The damage code adds the raw die, 0–9. Rolls run 5–14 before modifiers (section 3). |
| Levy combat efficiency +X% | Levies hitting regulars deal 0.75 + 0.25 × levy CE, capped at 1.0. So +40% levy CE is worth +10% damage, and nothing past +100% (section 8). |
| "Army Morale Movement Cost" (description says every hour) | Applied once a day, as a share of max morale (0.69% a day base) (section 7). |
| Maintenance / reinforce efficiency +25% | Divides the cost: 1 ÷ 1.25 = 80%, not 75% (section 15). Reinforce efficiency cuts goods, never manpower. |
| Military tactics | Only the gap counts, and only on the side with less tactics: it cuts the damage that side deals ÷ (1 + gap). Equal tactics do nothing (section 2). |
| Combat speed | Only the daily chance that a reserve moves into the line (speed × 0.1). It never changes damage (section 5). |
| Initiative / army initiative | A daily chance to engage, capped at +30% on top of the 60% base and +3% a day; worth nothing once the initiative part reaches 30% (section 4). |
| Combined arms "+2.5% per type" | No bonus at all if one category is half the regiments or more (section 2). |
| "Instantly eliminate" warning at 10:1 | True. But the 2:1 wipe only happens in the first 4 days, not at the end of a long battle (section 1). |
| `MORALE_LAND_FLAVOR` (only the battle line counts for morale) | Matches the code: side morale is the line's, reserves don't count. |

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
| Overrun check (stack wipe) | `0x14248ed60` | called at start with `INITIAL_OVERRUN_FACTOR` (no morale check); on days 1–4 with `MORALE_OVERRUN_FACTOR` then 10 (loser line morale ≤ 0.05); from day 5 only with 10, after the empty-line check |
| Minimum battle length | `0x142493100` | `MINIMUM_COMBAT_DAYS` / `MINIMUM_NAVAL_COMBAT_DAYS` + a location modifier, compared with battle days (+0x34) |
| Lost battle, no retreat possible | `0x14248fc80` | called when a side's line is empty and none of its armies can retreat |
| Combined arms | `0x142486dd0` | `combined_arms_max_threshold`, `combined_arms_min_percent_for_bonus`, `combined_bonus_per_type` |
| Bombard per side / gun collector | `0x142481720` / `0x142486c70` | bombard-capable flag at unit type +0x1e3; budget W per section |
| Siege phase length / roll / outcome | `0x143462cb0` / `0x143465df0` / `0x143466d60` | `DAYS_PER_SIEGE_PHASE*`, `SIEGE_REGIMENTS_FOR_ARTILLERY`, `SIEGE_WIN`, shortage defines |
| Max manpower tooltip | `0x142638ab0` | `MAX_MANPOWER_YEARS` (`0x14fb243b8`), labels `MAX_MANPOWER_TT`, `THIRD_MAX_MANPOWER_TT` |
| Land army strength for overruns | `0x143519150` | men, levies × levy factor |
| Daily morale change outside battle | `0x1434f47a0` | recovery `0x143493940` (labels `CAN_NOT_RECOVER_WHILE_MOVING`, `UNIT_MORALE_RECOVERY_IN_FRIENDLY`), movement cost `land_morale_movement_cost` (`0x14f0a367e`), attrition cost; `LOCKED_MORALE_CAP` |
| Retreat after a lost battle | `0x142477570` | shattered if average morale < `LOW_MORALE_THRESHOLD` 0.5 (navy 1.5) |
| Siege / assault tick | `0x143475730` | all `SIEGE_*` / `ASSAULT_*` defines (not decompiled) |
| Modifier registration | `0x144c840f0` | each modifier name string is followed by a store of its index, e.g. discipline `0x14f0a37c2`, military_tactics `0x14f0a37ce`, levy_combat_efficiency `0x14f0a389e`, commander_combat_bonus `0x14f0a37d0`, army_initiative `0x14f0a37ee`, combat_speed_modifier `0x14f0a37f2` |

Helpers: `node definemap.js <eu5.exe> <00_defines.txt> NCombat` maps every define to its global and the functions that read it. `node peek.js str <va>` resolves label strings, and `node peek.js modmap 144c840f0 52669 [globals]` names modifier index globals. `DecompileAddrs.java` decompiles chosen addresses headless.
