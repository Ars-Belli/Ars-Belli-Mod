# EU5 1.4.4 - population & military formulas (manpower, sailors, levies, pop growth)

Research notes for the location simulator. eu5.exe 1.4.4, Ghidra project `eu5_144` (decompiles in
`E:\Tools\ghidra-projects\locsim_pop\*.c`), save `SP_SPA_1547_04_01_...eu5` (Spain id 930, capital 2877,
province 2221), played with the Ars Belli mod.

Confidence tags: `code` = read in the decompile; `tooltip` = from the loc key the branch prints;
`save-checked` = reproduced a save number; `inferred` = my reading, not verified.

## 0. Conventions that apply everywhere

- All engine arithmetic is 64-bit fixed point with 100000 = 1.0 (every `/ 100000` in the decompiles). `code`
- Pop sizes, manpower, sailors and levy men are in **thousands** (`NPop.DISPLAY_SIZE = 1000`, global
  `0x14fb268d0`, is only a display multiplier: the levy tooltip prints `value * DISPLAY_SIZE`). Spain's
  `currency_data.manpower = 407.69` means 407,690 men. `code`
- A location's modifier container is at `location+0x4f0`, a country's at `country+0x28b0`; a modifier is
  looked up by its 16-bit index (FNV-1a hash in the decompiles). Index globals (`node peek.js modmap
  144c840f0 4000000 <globals>`): `local_manpower 0x14ee8fb60`, `local_sailors 0x14ee8fb62`,
  `sailors_to_building_owner 0x14ee8fb64`, `manpower_to_building_owner 0x14ee8fb66`,
  `global_sailors_modifier 0x14ee8fb6c`, `global_manpower_modifier 0x14ee8fb6e`,
  `local_sailors_modifier 0x14ee8fb70`, `local_manpower_modifier 0x14ee8fb72`, `max_manpower 0x14f0a374c`,
  `max_sailors 0x14f0a374e`, `cap_maximum_population_growth_at_zero 0x14f0a3750`,
  `local_population_growth 0x14f0a3752`, `global_population_growth 0x14f0a3754`,
  `local_population_capacity 0x14f0a3756`, `local_population_capacity_modifier 0x14f0a3758`,
  `global_population_capacity_modifier 0x14f0a375a`, `total_population_capacity_modifier 0x14f0a375c`,
  `wrong_culture_levy_size 0x14f0a3896`, `local_levy_size_modifier 0x14f0a3898`,
  `global_levy_size_modifier 0x14f0a389a`, `levy_recovery_modifier 0x14f0a389c`,
  `local/global_army_levy_size_modifier 0x14f0a38a2/a4`, `local/global_navy_levy_size_modifier
  0x14f0a38a6/a8`, `growth_is_primary_culture 0x14f0a3968`. Full list: `research\pop_tmp\modmap_all.txt`
  (695 entries; per-pop-type and per-estate modifiers such as `local_nobles_pop_growth` or
  `nobles_estate_levy_size` are registered elsewhere and are read through the pop type object:
  `popType+0x14e` = its `local_<type>_pop_growth` index, `popType+0x2a` = `global_<type>_pop_growth`,
  `popType+0x2c2` = `<estate>_levy_size`). `code`
- Location fields used below: `+0x10` total population (thousands), `+0xbd0` owner id, `+0xd10` control
  (1.0 = 100%), `+0x1330` province id, `+0x4f0` modifiers. Country: `+0x10` id, `+0x4640/+0x464c`
  location array/count, `+0x458/+0x464` array of building ids the country owns elsewhere,
  `+0x51c8` cached max manpower, `+0x2e50` cached `wrong_culture_levy_size`. Building: `+0x10` type,
  `+0x30` level, `+0x38` employed (thousands), `+0x18/+0x24` production-method list (each has an "input
  satisfied" fraction at `+0x20`). Province: `+0x5b8` stored food, `+0x5c0` food capacity, `+0x5d0`
  monthly food balance, `+0x5d8` structural balance, `+0x5f8/+0x600` cached food growth factors. `code`
- Define `NCountry.MILITARY_CONTROL_FLOOR = 0.10` (global `0x14fb24ad8`, registered in `0x14376f860`).
  Not in the define file's comments; it is the floor used by manpower, sailors and levies.
  Tooltip `MILITARY_CONTROL_MINIMUM_GIVEN` = "Minimum given: $MIN$", `CONTROL_IMPACT_ON_MILITARY_OUTPUT`
  = "manpower, sailors and levies output at $VAL$". `code`
- Mod (Ars Belli) overrides touching these systems: none of the formulas. Checked: `01_abm_defines.txt`
  (no NPop/NCountry military defines; `LEVY_MAINTENANCE_FACTOR` is commented out), `pop_types\00_abm_default.txt`
  (`REPLACE:soldiers` only drops `power_per_pop`, estate power), `static_modifiers\abm_location_changes.txt`
  (`control` gains `local_mercenaries_modifier`, `control_50` emptied), `abm_country_changes.txt`
  (`new_colonial_nation_founded` `local_population_growth = 0.010`, colonial nations only),
  `auto_modifiers\abm_country.txt` (no manpower/levy/growth terms), `location_ranks\abm_location_ranks.txt`
  (fort limit only), mod `levies\*.txt` add flavour levies using the same `levy_generic_*_size` values,
  mod advances add regional `global_manpower_modifier` / `global_levy_size_modifier` / `nobles_estate_levy_size`
  values (inputs, not formula changes). `save-checked` (grep)

## 1. Monthly manpower and sailors

### 1.1 Location output (what the location UI shows)

```
loc_manpower = local_manpower
             * (1 + local_manpower_modifier + global_manpower_modifier)   # one bracket, additive
             * max(control, MILITARY_CONTROL_FLOOR=0.10)
```
`code` - generic location-output getter `0x143106700(location, &out, flatIdx, localModIdx, globalModIdx)`:
flat x (1 + local + global); the control factor is applied only when `flatIdx` is `local_manpower` or
`local_sailors` (compares against `0x14ee8fb60/62`). Sailors: same with `local_sailors`,
`local_sailors_modifier`, `global_sailors_modifier`. Per-location list in the country tooltip
(`LOCATION_MANPOWER_ENTRY`, `0x14264c670`) uses `local_manpower * (1 + local_manpower_modifier) *
max(control, 0.10)` (no global term there) and prints the 15 biggest, then `LOCATION_MANPOWER_AND_MORE`. `code`

### 1.2 Country monthly income ("Manpower from Pops")

```
from_locations = SUM over owned locations L of
                   local_manpower(L) * (1 + local_manpower_modifier(L)) * max(control(L), 0.10)
from_buildings = SUM over buildings B owned by the country in OTHER countries' locations of
                   level(B) * employment_ratio(B) * manpower_to_building_owner(type(B))
monthly_manpower_income = (from_locations + from_buildings) * (1 + global_manpower_modifier)
```
`code` - `0x1427892e0(ctx, &out, kind, flatIdx, localModIdx, ownerIdx, globalIdx)`, called from the
currency breakdown `0x142753b00` with (manpower: `0x14ee8fb60, 0x14ee8fb72, 0x14ee8fb66, 0x14ee8fb6e`;
sailors: `0x14ee8fb62, 0x14ee8fb70, 0x14ee8fb64, 0x14ee8fb6c`). Tooltip labels: `MANPOWER_FROM_POPS` /
`SAILORS_FROM_POPS` is the *total* line ("Manpower from Pops: X"); its nested breakdown is
`RESOURCES_FROM_LOCATIONS` ("From locations"), `RESOURCES_FROM_BUILDINGS` ("From buildings") and
`game_manpower_locations_struct` -> `MANPOWER_LOCATIONS_TOOLTIP` (the per-location list). `code`
- Note the asymmetry: in the country total the global modifier multiplies the whole sum; in the
  location getter (1.1) it is added inside the same bracket as the local modifier. They differ only when
  `local_manpower_modifier != 0`. `code`
- `employment_ratio(B)` = `0x14240ee20(building)` = `employed(+0x38) / (level * employment_size(type+0x1c0))`;
  0 when the owner check `0x142427bb0(ownerCountry, locationOwner)` fails (building disabled, e.g. hostile
  owner). `code`
- Net monthly manpower in the save: `monthly_manpower = last_month_manpower_income - last_months_manpower_expense`
  (2.98411 = 6.76403 - 3.77992). `save-checked` Expense = regiment reinforcement/recruitment, not covered here.
- Evaluated monthly (the save keeps `last_month_manpower_income`); the tooltip recomputes live. `inferred`

### 1.3 Where `local_manpower` comes from (buildings)

`local_manpower` is a location modifier. Its only normal sources are building types (`modifier = {}`
for every location, `capital_modifier = {}` only in the capital), e.g. `armory`/`training_fields`
0.01-0.025 per level (`in_game\common\building_types\manpower_buildings.txt`), `sergeantry` capital 0.015,
plus a few event modifiers (`influx_of_foreign_knights 0.05`). Port buildings give `local_sailors`
(dock 0.016, dry dock 0.032, ... 0.2). `save-checked` (grep)

Scaling of a building's modifier block into the location container:
```
scale(B) = level(B) * goods_access(B) * employment_ratio(B)
goods_access = average over the building's production methods of their "input satisfied" fraction
               (the save's  <method>={ input=0.707 }  value; 1.0 when nothing is missing)
employment_ratio = employed / (level * employment_size)        # employment_size: script value, 1.0 for manpower buildings
```
`code` for the country-modifier path (`0x1428aad80`: level x average(method+0x20) x `0x14240ee20` then
`0x1424dbdd0(countryModifierSet, type+0x378, scale, -1)`), and for the owner path in 1.2 (level x
employment_ratio). `inferred` for the location `modifier` block (same scale helper is called by the
location recalculation functions `0x14289d5e0` / `0x143194700`; not read line by line). The building
readme says "multiplied by building level and goods access" and omits employment; the code includes it on
the two paths I read. Manpower buildings have `pop_type = soldiers`, so soldier pops employed in them
are what produces manpower - an empty barracks gives 0.

Soldier literacy adds `local_manpower_modifier = 0.1` scaled by the soldiers' literacy share
(`pop_types\00_default.txt`, `literacy_impact`); engine scaling of `literacy_impact` not read. `inferred`

### 1.4 Maximum manpower / sailors

```
max_manpower = monthly_manpower_income_now * (MAX_MANPOWER_YEARS=5 * 12) + max_manpower (country flat modifier)
max_sailors  = monthly_sailors_income_now  * (MAX_SAILORS_YEARS=5  * 12) + max_sailors  (country flat modifier)
```
`code` - `0x142740990`: calls the breakdown `0x142753b00` in income-only mode for kind 0 and kind 1, multiplies
by define `0x14fb243b8` (MAX_MANPOWER_YEARS) / `0x14fb243e8` (MAX_SAILORS_YEARS) x 12, adds modifier
`0x14f0a374c` / `0x14f0a374e`. Tooltip `MAX_MANPOWER_TT` ("up to $YEARS$ years of monthly production").
The cached result sits at `country+0x51c8`. `save-checked` approximately: Spain `max_manpower = 404.3922` =
60 x 6.7399, while `last_month_manpower_income = 6.76403` (60 x = 405.84, +0.36%): the max uses the income
recomputed at save time, not last month's booked income. `max_sailors 89.3334` = 60 x 1.4889 vs
`last_month_sailors_income 1.49458` (-0.4%), same effect.

### 1.5 Worked check - Spain 1547 (`research\pop_tmp\mp_check.js`)

Parsed all 169,008 buildings in `building_manager`; 641 Spain-owned buildings with `local_manpower`/`local_sailors`
(armory x256 / 496 levels, training_fields x222 / 388 levels, dry_dock x58, sergeantry, order_stronghold,
wharf, dock, fishing_village, ...). With `control` from the `locations` section (`max(control, 0.10)`),
`employment_ratio = employed/(level*employment_size)` and `goods_access` = the method `input` value:

| variant (sum over buildings) | manpower | sailors |
|---|---|---|
| level x employment x control x input | **5.5617** | **1.4807** |
| level x employment x control | 5.5640 | 1.5482 |
| level x control x input (no employment) | 6.0300 | 1.5041 |
| level x control | 6.0665 | 1.5735 |
| save `last_month_*_income` | 6.76403 | 1.49458 |

Sailors reproduce to +0.9% with the full scaling (1.4807 vs 1.4946), i.e. Spain has about +1% of
`global/local_sailors_modifier`; without employment it is -0.6%, so the sailors check cannot separate the two.
Manpower needs x1.216 on top of the full-scaling sum (or x1.12 without employment): that is Spain's
`(1 + global_manpower_modifier)` x average `(1 + local_manpower_modifier)` (advances, estate privileges,
soldier literacy), which the save does not store per country - open. Capital 2877 alone:
sergeantry 1 lvl x 0.015 x 1.0 x control 1 = 0.015; armory 7 lvl x 0.01 x (7/7) = 0.07 -> 0.085k/month
before modifiers; sailors: royal_atarazanas 0.02 + dry_dock 0.032 + wharf 0.001 = 0.053k. `save-checked`

## 2. Levies

### 2.1 Which pops raise what

- Levy definitions: `in_game\common\levies\*.txt`; a levy has `unit`, `size = <script value>`,
  `allowed_pop_type` (none = all), `allowed_culture`, `allow` (pop scope), `country_allow`, `allow_as_crew`
  (navy). Sizes: `levy_generic_infantry_size = 0.02`, `levy_generic_noble_cavalry_size = 0.1`,
  `levy_ship_size = 0.005` (fishing boat; 1 burgher owner per boat, peasants as crew),
  `levy_ship_size_special = 0.1`, `levy_ship_size_barbary_fusta = 0.05` (`main_menu\common\script_values\default_values.txt`).
- Selection: the engine sorts all army levies (and separately all navy levies) by the unit's total combat
  power and takes the first one the pop is eligible for (file order only breaks exact ties). Generic ladder:
  nobles -> cavalry levies (0.1 of the pop), peasants/laborers (and from Age of Discovery soldiers and
  burghers) -> infantry levies (0.02), soldiers -> footmen/men-at-arms (0.02), tribesmen -> a_tribesmen,
  clergy and slaves have no generic levy (clergy only crusader/camelry flavour). `readme.txt` in the levies
  folder documents this (it is the engine author's note). `tooltip`
- Pop culture status index `pop+0x13c`: 0 primary, 1 accepted, >1 (tolerated/ignored/discriminated)
  counts as "wrong culture". `code`

### 2.2 Men a pop raises

```
base      = pop_size * size(levy)                                  # thousands; tooltip POP_LEVY_CALC_ENTRY
if estate_satisfaction(pop's estate) < ESTATE_LEVY_SATISFACTION_THRESHOLD (0.25): result = 0
culture   = 1 + min(0, wrong_culture_levy_size)   if culture status > accepted, else 1
            # country_base_values: wrong_culture_levy_size = -0.75  -> x0.25 ; tooltip POP_LEVY_CALC_WRONG_CULTURE
levy_mult = 1 + local_levy_size_modifier + local_(army|navy)_levy_size_modifier
              + global_levy_size_modifier + global_(army|navy)_levy_size_modifier
              + <estate>_levy_size (of the pop's estate; e.g. nobles_estate_levy_size)
control   = max(control(location), MILITARY_CONTROL_FLOOR=0.10)   # tooltip POP_LEVY_CALC_CONTROL "control at X: xVAL"
recovery  = recovered / raised for (province, country, army-or-navy), 1.0 if nothing is recovering
            # tooltip LEVY_RECOVERY_PERC "Recovering since last raise: xVAL"
men       = base * culture * levy_mult * control * recovery       # thousands; UI shows * 1000
```
`code` - `0x143354880(pop, &out, levySetup, detailed, tooltip, flags, &ctx)`:
`base = pop+0xe8 * levy+0x2e0`; estate gate reads the estate's satisfaction (`+0x1e8`) against define
`0x14fb24510` (skipped when `flags & 0x100`); culture term from the cached country value `country+0x2e50`
with breakdown of modifier `0x14f0a3896`; levy multiplier entries are printed from `0x14f0a3898`,
`0x14f0a38a2/a6`, `0x14f0a389a`, the global army/navy index and `popType+0x2c2`; recovery from
`0x143359a40(province, countryId, category)` -> record `[raised, recovered]`, multiplier = `recovered/raised`;
final multiplication order `(culture * levy_mult) * control * base * recovery`. The tooltip variants
`POP_LEVY_CALC_FINAL_CALCULATION[_WITH_CULTURE][_AND_CONTROL][_AND_RECOVERY]` name exactly these factors
(BASE * CULTURE_MULTIPLIER * CONTROL_MULTIPLIER * LEVY_MULTIPLIER * RECOVERY_MULTIPLIER). `code`+`tooltip`
- Additivity of the levy multiplier terms is `inferred` from the decompile pattern (`value + 100000`
  accumulations) and the single `LEVY_MULTIPLIER` tooltip value; sign/scale of each term `code`.
- `global_levy_size_modifier` sources in vanilla: auto-modifier `high_tribal_cohesion` (0.25 x cohesion/100),
  parliament issues, events; `nobles_estate_levy_size` etc. from privileges/laws (e.g.
  `nobles_estate_less_levy_obligations -0.5`, `peasants_estate_less_levy_obligations -0.15`). `save-checked` (grep)

### 2.3 Province level, raising, recovery, recruitment

- Levies are raised per province (`RAISE_ARMY_LEVIES`, "Raise as many army levies as we can in this
  province"); the province total `GetTotalProvinceArmyLevySize` is the sum of 2.2 over the pops of its
  locations owned by the country. `tooltip`
- Raising (`0x142591da0`, uses `LEVY_RECRUIT_THRESHOLD = 0.20`, global `0x14fb003a8`): a province's levies
  are skipped when the raisable fraction is below 0.20 (i.e. less than 20% recovered). `code` (branch read,
  exact quantity compared is `inferred`). `ARMY_LEVY_RECRUITMENT_TIME = NAVY_LEVY_RECRUITMENT_TIME = 15`
  days from the order to the regiment appearing (`RAISE_ARMY_LEVY_LOC_TIP` "will be raised in X on DATE";
  `local/global_levy_recruitment_speed_modifier` and `war_declared_on_us` +25% speed up). `tooltip`
- Raised men are removed from the pops ("When the unit is recruited, the pops they get recruited from are
  reduced, and when the unit is disbanded, any survivors return to the pops" -
  `game_concept_army_levy_desc`; message `POP_LEVIES_OUT_WT`). A location's `pop_stats > <type> > levies=`
  in the save is the amount of that type currently away on levy duty (capital 2877: burghers 0.067 =
  67 burghers, fishing-boat owners). `tooltip`+`save-checked`
- Recovery (`0x14333d1f0`, monthly, per province record): `recovered += raised * (1 + levy_recovery_modifier)
  / LEVY_RECOVERY_MONTHS (240)`, record removed when `recovered >= raised`; so a fully raised province is
  back to 100% after 240 months at base, 200 months with the `at_peace` auto-modifier
  (`levy_recovery_modifier = 0.2`), 120 with +100%. The 2.2 multiplier for a province that is still recovering
  is `recovered/raised`. `code` (structure), the exact per-month increment is `inferred` from the
  `(1 + modifier) / 240` arithmetic in the decompile.
- Levy regiments: the levy unit type's `max_strength` is the regiment size; the raised men are packed into
  as many regiments as needed. Levy regiments do not reinforce from manpower, have `is_army_levy` and
  fight at `clamp(0.75 + 0.25 * levy_combat_efficiency, 0.05, 1)` vs regulars (`LAND_LEVY_COMBAT_IMPACT`,
  see the combat doc). `tooltip`+`code` (combat doc)
- Spain capital 2877 potential (control 1, all estates above 0.25, before `levy_mult` and recovery):
  peasants 53.264 x 0.02 = 1.065k, laborers (primary) 42.133 x 0.02 = 0.843k, soldiers 13.953 x 0.02 = 0.279k,
  burghers (primary+accepted) 16.476 x 0.02 = 0.330k, nobles 2.302 x 0.10 = 0.230k cavalry, wrong-culture
  burghers+laborers 3.128 x 0.02 x 0.25 = 0.016k; clergy 4.890 -> 0 (no generic levy). Total about
  2.76k men x (1 + Spain's levy size modifiers). The save stores no province levy totals to compare
  against; `levies=0.067` burghers / (16.476 x 0.005 = 0.0824) = 0.81 suggests a -19% levy multiplier
  or 81% recovery on the naval levy. `save-checked` (arithmetic only)

## 3. Population growth

### 3.1 Yearly growth rate of a location (`Location.GetPopGrowth`)

```
food_surplus_factor  = clamp( (province_food_balance / monthly_pop_food_consumption)
                              / (GROWTH_FROM_FOOD_SURPLUS_THRESHOLD - 1 = 0.25), 0, 1 )
food_storage_factor  = min( stored_food / (12 * monthly_pop_food_consumption), GROWTH_FROM_FOOD_MULTIPLIER_MAX = 2 ) / 2
food_terms = FOOD_SURPLUS_POP_GROWTH (0.0015) * food_surplus_factor
           + FOOD_STORAGE_POP_GROWTH (0.001)  * food_storage_factor
           (only if province food capacity > 0, stored food > 0 and the province is not starving;
            starving province instead applies static modifier province_starving: local_population_growth -0.05)

yearly_growth = local_population_growth (sum of the location's modifiers, incl. engine-scaled static ones)
              + global_population_growth (country)
              + food_terms
if cap_maximum_population_growth_at_zero (from static modifier `overpopulation`): yearly_growth = min(yearly_growth, 0)
```
`code` - `0x142733a20(gui, &out, tooltip)`: province = `location+0x28->+0x1330`; the two food terms use the
province's cached factors `+0x5f8` (surplus) and `+0x600` (storage) times defines `0x14fb210d8` /
`0x14fb210e0`, labels `POP_GROWTH_FROM_FOOD_SURPLUS` / `POP_GROWTH_FROM_FOOD_STORAGE`; then
`0x14317e230(&out, location, 0x14f0a3752, 0xffff, base, 0x14f0a3754, ...)` sums local + global modifiers;
then `if modifier 0x14f0a3750 > 0: out = min(out, 0)`. The factors are computed in `0x14333db30` ->
`0x14333e6a0` (clamps above, defines `0x14fb07058` threshold and `0x14fb07040` max); `0x14333ea90` =
12 x monthly pop food consumption of the province; `0x14331d150` is the province food tooltip
(`EFFECTS_FROM_STORAGE`: "consumes $TOTAL_POP_CONSUMPTION$ food every 12 months. Its population growth is
boosted both by a monthly food surplus over consumption and by stored food"; `FOOD_NO_EFF`;
`province_starving` applied at scale 1.0 via static table offset `0x6d0`). `code`
- Which balance field feeds the surplus factor: `+0x5d0`; in the save the province block lists
  `cached_food_change` before `cached_structural_food_change`, so I read `+0x5d0` as `cached_food_change`
  (includes trade). `inferred`
- Units: the result is the yearly fraction shown as "Yearly population growth of X%" (`POP_GROWTH_TT_TEXT`);
  `local_population_growth` modifiers are yearly values (`prosperity 0.002` at full prosperity, etc.). `tooltip`
- Static location modifiers with growth terms, applied by the engine with a scale (coordinator owns the
  scales; listed here because they are in the formula): `prosperity` +0.002 x prosperity, `devastation`
  +0.015 x devastation (note the sign: the static block is positive and the engine passes a negative scale -
  not verified), `approaching_capacity` -0.005, `overpopulation_growth` -0.005, `abundant_free_land` +0.02,
  `expensive_food_in_location` -0.001 / `cheap_food_in_location` +0.002, `looted` -0.005,
  `tribals_expelled` +0.0025, rank `rural_settlement` +0.002 (`location_ranks\00_default.txt`), mod
  `new_colonial_nation_founded` +0.010. Country: `global_population_growth` from events/laws
  (e.g. `colonist_incentives 0.005`, `great_frost_modifier -0.02`). `save-checked` (grep)
- Capacity-driven scales (`0x143194700`, the location's monthly static-modifier recalculation):
  ```
  cap = population capacity (3.3);  pop = location population
  if pop <= cap and GROWTH_DAMPING_START (0.6) < 1:
        s = clamp( (pop/cap - 0.6) / (1 - 0.6), 0, 1 );  if s > 0 apply approaching_capacity x s
        (local_population_growth -0.005*s, local_migration_speed +0.15*s)
  if pop > cap:
        apply overpopulation        x (pop - cap)/cap    (cap_maximum_population_growth_at_zero, demotion +50%, attraction -25, migration speed)
        apply overpopulation_growth x pop/cap            (local_population_growth -0.005 * pop/cap)
  free land (only with modifier free_capacity_attracts_pops, colonisation): abundant_free_land when
        pop < 10 and free share >= 0.9, else available_free_land (attraction only)
  ```
  `code` (static table offsets 0x6b0, 0x430, 0x440, 0x690/0x6a0 after `0x1449b00c0()`; define `0x14fb05e88`).
  So "damping" is a linear ramp from 60% to 100% of capacity down to -0.5%/year, then the cap at zero.

### 3.2 Monthly births and their distribution (`0x143384090`)

```
pool_monthly = location_population * yearly_growth / 12         # thousands; LOCATION_POPULATION_GROWTH_INFO_FORMULA
                                                                 # "Born monthly (GROWTH_POOL) = Location's Population * POP_GROWTH / 12"
eligible pops = pops whose culture is primary, accepted or tolerated (LOCATION_POPULATION_GROWTH_INFO_ONLY_ACCEPTED_CULTURES)
w_t   = eligible_size_t * (1 + local_<t>_pop_growth + global_<t>_pop_growth)   # per pop type t
births_t = pool_monthly * w_t / SUM_t w_t                        # LOCATION_POPULATION_GROWTH_INFO_POP_TYPE_ENTRY "(share) * modifier"
if a type has no eligible pops the growth goes to peasants of the primary culture (…INFO_NEW_PEASANTS)
growth_is_primary_culture (modifier) sends all births to the primary culture
negative pool: shown as POP_STARVATION instead of POP_REPRODUCTION (…INFO_NEGATIVE / INFO_NO_POSITIVE)
```
`code` for the pool (`location+0x10 * 0x142733a20() / 12`), the per-type factor (`1 + loc[popType+0x14e] +
country[popType+0x2a]`) and the labels; `tooltip` for the eligibility rule and new-peasants rule;
`save-checked` for the normalised distribution (below). Within a type the births are split over that
type's eligible pops (by size, `inferred`).

Worked check, capital 2877 (`research\pop_tmp\sum_pops2.js`, pops from the `population` section):
total population 136.147k; wrong-culture (status none) pops 3.128k (burghers 2.967k + laborers 0.161k);
eligible 133.019k. `pop_stats > changes > Reproduction` total 0.02845k/month -> yearly growth
0.02845 x 12 / 136.147 = **0.2508%** (0.2567% if the pool used eligible pops only; the tooltip says
"Location's Population", and 0.25% is the rounder number: food storage 0.001 (factor 1, below) + food
surplus 0 + prosperity 0.002 x 0.24126 = 0.00048 + about 0.001 of unidentified country/location terms).
Per-type births with `w_t = eligible_size_t * factor_t`, factors nobles 1.20, clergy 1.24, others 1.00:
nobles 0.000584 (save 0.00059), clergy 0.00128 (0.00128), burghers 0.00348 (0.00347), laborers 0.00891
(0.0089), soldiers 0.00295 (0.00295), peasants 0.01126 (0.01126). With all factors 1 the nobles/clergy
rows are 20-24% too low, so the normalised weighting is confirmed; the factors match vanilla sources
`global_nobles_pop_growth = 0.25` scaled by a societal value (`societal_values\00_default.txt`) and the
capital's level-1 `temple` (`town_buildings.txt`: `local_clergy_pop_growth = 0.25`). `save-checked`

Province 2221 food check: `food.current = 27073.6`, `base_food_consumption = 890.01`/month,
`cached_food_change = -324.7` -> surplus factor clamp(-324.7/890/0.25, 0, 1) = 0; storage factor
min(27073.6 / (12 x 890.01) = 2.535, 2) / 2 = **1.0** = the save's `food_storage_growth_term = 1`. `save-checked`

### 3.3 Population capacity

```
capacity = local_population_capacity
         * (1 + local_population_capacity_modifier + global_population_capacity_modifier)
         * (1 + total_population_capacity_modifier)
```
`code` - `0x14310abc0(location, &out, tooltip)` (indices `0x14f0a3756/58/5a/5c`; the last factor prints
`THIS_IS_GENERALLY_MODIFIED_INFO` "This is then modified by the following effects"). Over-capacity tooltip
`OVER_POPULATION_CAPACITY` in `0x14310bc30`. Inputs (static, coordinator scales them): rank
(`town 20 / city 100 / megalopolis 400` flat and `+10% / +25% / +50%`), `location_closeness_to_equator_impact`
10 x scale, `development` +2.5% x development, `capital` +10%, `province_capital` +5%, `historical_capital`
+2.5%, `coastal` +25%, `river_flowing_through_n` +10% x n, `building_levels` +0.1% x levels,
`urban_decay` -20%, event modifiers; location templates (`location_historical_base_values.txt`) may add a
flat base. `save-checked` (grep)

## 4. Promotion, demotion, employment (partial)

- Base values (`static_modifiers\location.txt`, `location_base_values`): `local_pop_promotion_speed = 0.001`,
  `local_pop_demotion_speed = 0.10`, `local_clergy_desired_pop_scaled = 0.005`,
  `local_nobles_desired_pop_scaled = 0.0025`; `location_art` x10 promotion speed; `possible_promotion_percentage`
  (static, offset 0xc50, applied in `0x143194700`) adds `local_pop_promotion_speed_scaled = 0.001` and
  estate power; `surplus_jobs` (0x580) is scaled by `min(jobs_surplus, POP_JOB_SURPLUS_SCALE_CAP = 5)` -
  in `0x143194700`, `code` for the cap, scale definition `inferred`; `unemployed_peasants` (0xc60).
  Country base `global_pop_promotion_speed_modifier` from `positive_stability_impact` (+1.0 x stability/100,
  mod keeps vanilla value). `MIN_SIZE_TO_BLOCK_PROMOTION = 0.5` (global `0x14fb05d08`, used by `0x1431183d0`
  and the pop update `0x143378730`, not decompiled). Desired pops: `local_<type>_desired_pop` flat
  (rank: city burghers 1.0, laborers 1.0, soldiers 0.25, nobles 0.05, clergy 0.1; `rgo_level` laborers +1 per
  level) and `_scaled` (percentage of location population, `scale_with_pop = yes`). `tooltip`
- Save `pop_stats` fields per type (location 2877, checked against the pop list): `produced` = thousands of
  that type employed in buildings (soldiers 13.5 of 13.953; laborers 25.4 + `employed_in_rgo` 16 + `unemployed`
  0.894 = 42.3 total), `unemployed` = idle (peasants: all 52.5 + 0.75 "produced" working in RGO?),
  `population_ratio` = not the size (nobles 2.50 vs size 2.30) - looks like the type's capacity/desired pop
  (`Location.GetPopCap`), `levies` = away on levy duty, `last` = last month's net change,
  `changes` = per-move-type monthly deltas (Reproduction, PromotionIn/Out, DemotionIn/Out, MigrationOut,
  Assimilation). `save-checked` (arithmetic) / `inferred` (meaning of population_ratio).
- Not done: the promotion/demotion amount formulas (`0x143378730`, 41 KB) and RGO/building employment
  filling order.

## 5. Open questions

1. Spain's exact `(1 + global_manpower_modifier)` x `(1 + local_manpower_modifier)`: needed x1.216 on top of
   the building sum; the save does not store country modifier values. Could be read from the in-game
   tooltip of monthly manpower (nested "From locations" value) - that single number would settle whether
   the location modifier block uses employment (x1.216) or not (x1.12).
2. Location `modifier` block scaling by employment: `code` only on the country-modifier and
   building-owner paths; the location path (`0x14289d5e0`, 50 KB) was not decompiled.
3. Levy multiplier terms assumed additive in one bracket (pattern + tooltip); the engine could in principle
   multiply the estate term separately.
4. Which food balance (`cached_food_change` vs `cached_structural_food_change`) is `province+0x5d0`.
5. Growth pool uses total vs eligible population (0.2508% vs 0.2567% for the capital); tooltip wording
   says total.
6. `devastation` growth sign/scale, `literacy_impact` scaling, `levy_recovery` per-month increment detail,
   `LEVY_RECRUIT_THRESHOLD` exact comparand, manpower expense (reinforcement) formula.
7. `population_ratio` in `pop_stats` is probably the per-type cap, unverified.

## 6. Files

- Decompiles: `E:\Tools\ghidra-projects\locsim_pop\` - `mp_calc.c` (0x1427892e0 monthly manpower/sailors,
  0x142790370 formatter), `mp_loc_max_levy.c` (0x14264c670 location list, 0x142618de0 dispatcher,
  0x143354880 pop levy size), `currency_breakdown.c` (0x142753b00), `bldg_scale.c` (0x14240ee20 employment
  ratio), `bldg_mod_scale.c`, `bldg_apply.c` (0x1428aad80 building->country modifiers), `maxmp_growth.c`
  (0x142740990 max manpower, 0x14331d150 province food tooltip, 0x14310bc30 capacity tooltip),
  `food_growth.c` (0x14333db30/ea90/ed80/e6a0 food factors, 0x142733a20 yearly growth), `growth_dist.c`
  (0x143384090 monthly births), `pop_monthly.c` (0x143194700 location static modifiers incl. damping),
  `capacity_ctrl.c` (0x14310abc0 capacity, 0x14310a3c0 control tooltip, 0x143106700 location output getter),
  `levy_recovery.c` (0x143359a40, 0x14333d1f0 recovery, 0x142591da0 raise).
- Scratch: `...\scratchpad\research\pop_tmp\` - `mp_check.js` (manpower/sailors reproduction),
  `dump_pops.js` + `pops_2877.txt` + `sum_pops2.js`, `province_2221.txt`, `buildings_2877.txt`,
  `definemap.txt`/`definemap2.txt` (define -> global -> reader functions), `modmap_all.txt`.
