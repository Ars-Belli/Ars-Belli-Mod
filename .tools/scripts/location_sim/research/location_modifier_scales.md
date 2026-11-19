# EU5 1.4.4 location modifier update (`FUN_143194700`) - sources, conditions, scales

Research notes for the location simulator. Function: `FUN_143194700(node, out)` in eu5.exe 1.4.4
(decompile: `E:\Tools\ghidra-projects\locsim_main\locmods.c`, helpers in `...\locsim_main\scales\helpers1.c`,
`helpers2.c`, `helpers3.c` (not yet read), call-site asm in `callsites.asm`, `callsites2.asm`).

Conventions used below
- `loc` = the location object (`*param_1`), `node` = `param_1` (the location's modifier node), `set` = `param_2[10]` (set being built).
- Fixed point: `100000` = 1.0. Population, pop sizes, men, jobs are all stored in **thousands** (Sevilla pop `size=42.13347` = 42,133 people).
- `apply(X, s)` = `FUN_1424dbdd0(set, X.block, s, -1)`: adds static/scripted modifier block `X` times `s`. It is a no-op when the block is empty **or `s == 0`**.
- Static table: `T = FUN_1449b00c0()`, entry `T+off` -> name per `static_map.txt`; two slots were missing from the map:
  `T+0x10e8..0x1128` = `integration_none/conquered/colonized/integrated/core` (5 entries), `T+0x1138..0x1168` = `winter_none/mild/normal/severe`.
  `T+0x320` is applied but its name was not found in the registration decompile (see open questions; by elimination it is most likely `rgo_level`).
- Confidence: `code` = read in the decompile/asm; `save` = cross-checked against the SPA 1547 save (Sevilla 2877); `inferred` = reasoned, not verified.
- Resolved globals: modifier indices `0x14f0a3a08 always_allow_levies`, `0x14f0a3578 fort_level`, `0x14f0a3658 free_building_levels`,
  `0x14f0a365a global_free_building_levels_modifier`, `0x14f0a361c free_capacity_attracts_pops`, `0x14ee8fb68 harbor_suitability`,
  `0x14f0a3756 local_population_capacity`, `0x14f0a3758 local_population_capacity_modifier`, `0x14f0a375a global_population_capacity_modifier`,
  `0x14f0a375c total_population_capacity_modifier`. Defines: `0x14fb05db0 NPop.POP_JOB_SURPLUS_SCALE_CAP=5`, `0x14fb05e88 NPop.GROWTH_DAMPING_START=0.6`,
  `0x14fb06208 NLocation.LOOT_MONTHS=12`, `0x14fb06530 NMarket.FOOD_PRICE=0.05`, `0x14fb24ad0 NEconomy.ESTABLISHMENT_SYSTEM_ENABLED=no`,
  `0x14faff958 NDisease.MAX_DISEASE_PERCENTAGE=1` (the Ars Belli mod overrides none of these).
- Location fields identified: `+0x20` id, `+0x68` art value, `+0xf4` dynasty seats (int), `+0x228/+0x234` buildings list, `+0x4f0` current modifier set,
  `+0x50/+0x5c` works of art, `+0x108/+0x10c` religious orders, `+0xa50` has road, `+0xb78` timed modifiers (CTimedModifierOwner), `+0xbc8` owner,
  `+0xbd0` controller, `+0xcb8/+0xcc4` integration entries (country,?,level; 0x18 each), `+0xcd0` culture id, `+0xcd8` religion id, `+0xcf0` raw-material goods ptr,
  `+0xcf8` RGO workers/size (fixed; Sevilla `max_raw_material_workers=16`), `+0xd00` prosperity (negative = devastation), `+0xd08` development,
  `+0xd10` control, `+0xd18` proximity (0-100), `+0xd30` pop summary, `+0xd38` ptr with a modifier block (unidentified, see row), `+0xd60` port data,
  `+0xd68/+0xd74` units here, `+0xd80` market id, `+0x12c0/+0x12cc` holy sites, `+0x12d8/+0x12e4` international organizations, `+0x1330` province id,
  `+0x1338` siege id, `+0x1370` blockade value, `+0x1378/+0x1384` town rights, `+0x13b8` loot date, `+0x13cc` winter level, `+0x13d4` blockade state (1 ice, 2 enemies), `+0x13db` road to capital.
- Early exit (`locmods.c` 238-249): after location_base_values, node sub-set, province set, IO/collected pairs, timed modifiers and winter, the function
  returns if `loc.template(+0x18)` vfunc 0x40 is true, vfunc 0x20 is false, or `template+0x22c != 0` (non-land / impassable / unowned-type gate; `inferred`).
  Everything from the owner-gated block onward (rows marked "owner valid") also requires `owner = FUN_14001c8f0(loc+0xbc8)` to pass its validity vfunc.

## 1. Static-table modifiers

| Static modifier | Condition | Scale (pseudo-code) | Conf. | Lines / addr |
|---|---|---|---|---|
| `location_base_values` | always (block non-empty) | 1.0 | code | 128-139 |
| `integration_<level>` | owner valid; level = entry in `loc+0xcb8[]` whose country == owner (field +0x10), else 0 (`integration_none`) | 1.0 | code (Sevilla: `integration=core`) | 1244-1272, table `0x10e8+lvl*0x10` |
| `winter_<none/mild/normal/severe>` | always; level = `loc+0x13cc` | 1.0 | code | 223-237, table `0x1138+lvl*0x10` |
| unidentified block at `loc+0xd38 -> +0x118` | owner valid, block count (+0x128) != 0 | 1.0 | code (what +0xd38 points to is open) | 1273-1284 |
| `dynasty_seat` | owner valid, `int loc+0xf4 != 0` | `loc+0xf4` (number of dynasty seats, integer -> x1.0 each) | code | 1285-1298 |
| `is_occupied` | owner valid, `owner(+0xbc8) != controller(+0xbd0)` | 1.0 | code | 1299-1312 |
| `capital` | owner valid, `FUN_142529900(owner) == loc` (owner capital) | 1.0 | code | 1313-1330 |
| `province_capital` | owner valid, NOT owner capital, province (`loc+0x1330`) valid and `province+0x598 (ushort) == loc id` | 1.0 | code | 1343-1362 |
| `historical_capital` | owner valid, NOT owner capital, `loc` in owner's historical-capital list (`owner+0x4728`, count `+0x4734`) | 1.0 | code | 1363-1392 |
| `is_port` | owner valid, `*(int*)(*(loc+0xd60)+8) != 0` (port data present) | 1.0 | code | 1394-1406 |
| `has_road` | owner valid, `byte loc+0xa50` | 1.0 | code | 1407-1419 |
| `has_road_connected_to_capital` | owner valid, `byte loc+0x13db == 1` | 1.0 | code / save (`road_to_capital=yes`) | 1420-1432 |
| `development` | owner valid, development != 0 | `development` (fixed; Sevilla 60.549 -> x60.549). Matches "0-100" comment: raw value, not /100. | code / save | 1433-1445 |
| `proximity_to_capital` | owner valid, result != 0 | `proximity(loc+0xd18) / 100` (0..1; Sevilla proximity=100 -> x1.0) | code / save | 1446-1471 |
| `T+0x320` (name missing; likely `rgo_level`) | owner valid, `loc+0xcf8 != 0` | `loc+0xcf8` = RGO workers/size (Sevilla 16 -> x16; `rgo_level: local_laborers_desired_pop = 1` -> 16 desired laborers) | inferred (slot name unverified) | 1472-1484 |
| `prosperity` | owner valid, `loc+0xd00 > 0` | `prosperity` (0..1) | code / save (0.24126) | 1485-1506 |
| `devastation` | owner valid, `loc+0xd00 < 0` | the same field, **negative** value (0..-1) - the static block is written for a negative multiplier (comment "0 to -1") | code | 1485-1506 |
| `control` | owner valid (no other check) | `control` (0..1) | code / save (1.0) | 1507-1517 |
| `inverse_control` | owner valid | `1 - control` | code | 1518-1527 |
| `control_50` | owner valid | `control - 0.5` (negative below 50 % control) | code | 1528-1537 |
| `market_center` | `market(loc+0xd80).center location (+0x12ad8) == loc` | 1.0 | code / save (`center=2877`) | 1182-1242 |
| `total_population` | population != 0 | `population` (thousands; Sevilla ~136 -> x136) | code (asm 143196d36 R8=pop) | 1169-1213 |
| `average_satisfaction` | population > 0, result != 0 | `min(1, summary(loc+0xd30)[+0x20] / population)` = pop-weighted average satisfaction | code | 744-819 |
| `average_satisfaction_inverted` | population > 0, result != 0 | `1 - average_satisfaction` (note: `-(avg-1.0)`) | code | 820-832 |
| `present_troops` | population > 0, owner valid, result != 0 | `friendly_men / population`; friendly = units in `loc+0xd68` with `unit+0xa46==1`, owner != `game+0x2371c` (rebel/none id), owner passes `FUN_1423eb880(unitOwner, locOwner)` (same country / subject tree / allied-access / same IO - partly read). Men = `FUN_143517e30(unit)` strength, same unit as pops (thousands). | code (helper 14319c3d0) | 848-879 |
| `hostile_troops` | as above, unit owner fails friendly test and `FUN_142434370(unitOwner, ...)` (at war) | `hostile_men / population` | code | 880-893 |
| `raised_levies` | population > 0, owner valid, owner's `always_allow_levies` modifier == 0, `FUN_143192fe0(loc)` (some pop of the location has a raised levy; pop+0x130) | 1.0 | code (condition detail inferred) | 894-963 |
| `building_levels` | result > 0 | `sum over buildings with type flag `+0xd8d`==0 of employed(b+0x38) / (level(b+0x30) x type.employment_size(+0x1c0)) x level` = **staffed levels** (employed / per-level employment), not nominal levels | code | 1539-1723, 2050-2060, asm 143198d00 |
| `unsupported_building_levels` | `total - supported > 0` | `total - supported`; total = sum(level + levels under construction) over same buildings; supported = `max(0, free_building_levels(of this set) x (1 + owner.global_free_building_levels_modifier))` | code (asm 143198e30: `SUB R14,[max]`) | 2064-2092, helper 1431312f0 |
| `unestablished_buildings` | `ESTABLISHMENT_SYSTEM_ENABLED` (define, **= no in 1.4.4 -> never applies**), count >= 2 | `count - 1`; count = buildings (active, level>0, not enemy-owned) with `b+0x50 < type+0x1b8` (establishment progress below target) | code (asm 143198ec6) | 1724-1731, 2093-2105 |
| `location_art` | `loc+0x68 > 0` and world total (`*(game+0x108)+0x150c0`) > 0, quotient != 0 | `loc_art_value / world_art_value` (0..1 share) | code | 2106-2176, asm 1431991e7 |
| `has_ongoing_colonial_charter_migration` | not blockaded (`+0x13d4 != 2`), owner == controller, no siege object, owner valid, an owner colonial charter (`owner+0x2a0` list) has an entry with flag `+0xd4` and target location == loc | `owner+0x44e0` (a country fixed value; probably a maintenance/colonial slider - open) | code (scale field unidentified) | 2434-2519 |
| `location_exports` | list `loc+0x308` (count `+0x314`) non-empty | `min(100, sum of trade route values (+0x30))` | code (cap confirmed) | 2521-2547 |
| `location_imports` | list `loc+0x2d0` (count `+0x2dc`) non-empty | `min(100, sum of trade route values)` | code | 2548-2586 |
| `expensive_food_in_location` | owner valid; `r = (market.food_price(+0x88) - FOOD_PRICE)/FOOD_PRICE > 0` | `min(0.5, r)`. Edge: if FOOD_PRICE == 0 -> fixed 0.5 | code (market+0x88 = food price inferred; market 13 `price=0.01019`) | 2825-2927 |
| `cheap_food_in_location` | owner valid; `r < 0` | `min(0.5, -r)` (positive) | code | same |
| `raw_material_relative_price` | owner valid (applied even when 0) | `(market price of loc raw material - goods base price(+0x3e8)) / base price`; 0 if no market/goods | code (helper 143160440) | 2928-2940 |
| `approaching_capacity` | capacity (`FUN_14310abc0`) > 0, `pop <= capacity`, `GROWTH_DAMPING_START < 1`, `x > 0` | `clamp((pop/cap - 0.6) / (1 - 0.6), 0, 1)` | code | 2943-3071 |
| `available_free_land` | pop <= cap, owner valid, location's **current** set (`loc+0x4f0`) has `free_capacity_attracts_pops != 0`, not abundant case | `(cap - pop) / cap` | code | 3073-3179, 3249-3257 |
| `abundant_free_land` | same gate, `pop < 10.0` (= 10k people) **and** `(cap-pop)/cap >= 0.9` | `(cap - pop) / cap` | code (matches "<10% capacity & <10k") | 3171-3179 |
| `overpopulation` | `pop > cap` | `(pop - cap) / cap` (excess fraction) | code | 3180-3242 |
| `overpopulation_growth` | `pop > cap` | `pop / cap` (= excess fraction + 1) | code | 3243-3257 |
| `looted` | `today - LOOT_MONTHS(12) < loot date (loc+0x13b8)` | 1.0 | code | 3260-3276 |
| `under_siege` | siege (`loc+0x1338`) valid and `!FUN_1434741e0(siege,0)` i.e. besieging strength >= required (`max(1000, dev/100)` or `max(10000, loc+0x12f0)` when `loc+0xaba` (fort?) set) | 1.0 | code | 3277-3297 |
| `surplus_jobs` | owner valid, result > 0 | `min(POP_JOB_SURPLUS_SCALE_CAP=5, sum over pop types except tribesmen/slaves/peasants of max(0, jobs(type) - pops(type)))`; `jobs(laborers) += loc+0xcf8` (RGO workers). jobs read from summary record `+8`, pops from `FUN_142400f90(summary,type)[0]`. Units thousands -> "per 1k jobs", capped at 5k. | code | 3298-3439 |
| `is_blockaded_by_enemies` | `loc+0x13d4 == 2` and `loc+0x1370 != 0` | `loc+0x1370` (blockade value, likely 0..1 fraction) | code (field semantics inferred) | 3440-3463 |
| `is_blockaded_by_ice` | `loc+0x13d4 == 1` and `loc+0x1370 != 0` | `loc+0x1370` | code | same |
| `harbor` | port (`*(*(loc+0xd60)+8) != 0`), owner valid | `max(0, harbor_suitability)` read from the set **being built** (so template/river/town-rights contributions applied earlier count) | code | 3464-3511 |
| `unemployed_peasants` | population > 0, value > 0 | `summary.jobs_record(peasants)+0x20` = unemployed peasants (thousands; Sevilla 52.5) | code / save | 3512-3549 |
| `possible_promotion_percentage` | population > 0, sums non-zero | `clamp(sum(jobs - pops) / sum(jobs), 0, 1)` over pop types with pops>0, `type+0x1bc != 0`, jobs(record +0) > pops | code | 3550-3664 |
| `provincial_troops`, `coastal`, `river_*`, `location_size_impact`, `location_closeness_to_equator_impact`, `movement_cost`, `location_template_natural_harbor_*`, `parliament_location`, weather statics, `tribals_expelled`, `minor_rebel_uprising`, `rgo_level`(by name) | **not applied in this function** (template ones in `FUN_143edcc30`; the rest come via timed modifiers / other updaters) | - | code | - |

## 2. Non-static sources

| Source | Condition | Scale | Conf. | Lines / addr |
|---|---|---|---|---|
| Node sub-set `node+0xa8` merged via `FUN_1439be8d0` | always | its whole set (likely the template/terrain set computed by `FUN_143edcc30`) | inferred | 140 |
| **Province** modifier set (`province+0xc0`, province = `loc+0x1330`) merged | province valid | whole set (province_base, province_starving, province timed modifiers) | code (RTTI CProvince) | 141-146 |
| **International organizations** (`loc+0x12d8` list, RTTI CInternationalOrganization): (a) `(IO+0x60)->vf0x48` returns (block, value) | value != 0, block non-empty | `value` (semantics open) | code | 188-219 |
| IO (b) `FUN_143192450`: each IO's active entries `IO+0x728` {start date, duration, def}; def modifier entries (`def+0x2a0`) **without trigger** and fixed value (`entry+0x11c==0`), or value-type entries with `entry+0x84==0` | entries with triggers are skipped in this pass | `entry_value x max(def.min(+0x4a8), ramp) x (1 + IO vf0x50 value)`; ramp = `days_since_start/duration` (1.0 if `game+0x2760f` set) | code | 147-168, helper 143192450 |
| IO (c) type `owned_location_modifier` (`*(IO+0x658)+0x32c8 -> +0x38`) | sub-object vfunc0 true | 1.0 (readme: "not scaled") | code | 2799-2824 |
| Node cached pairs `node[0x2c]` (count `node+0x16c`) | always | stored (block, scale) pairs - origin open | code | 169-182 |
| **Timed location modifiers** `loc+0xb78` (CTimedModifierOwner, 0x48-byte entries, def at +0x10) via `FUN_142516150` | always | `FUN_1434ad600(entry)` = current (decaying) scale of each timed modifier | code (scale fn not read) | 222 |
| Six parent slots `node+0x1a8/+0x240/+0x2d8/+0x370/+0x408/+0x4a0` (each: stored pairs vector + virtual collector `vf0x28(&vec,1,0)`), the last one applied with default scale | after the land gate | per-pair scales; **identity of the six parents open** (candidate initializer `FUN_14312e140` decompiled into `helpers3.c`, not yet read) | open | 251-529 |
| **Diseases** (global array `*(game+0x108)+0x27d20`, stride 0x558; per-location record `FUN_142f30c90(disease+0xc0, locId)`, RTTI CDiseaseOutbreak) | record `[2] > 0.2` (2^30 fixed) and `int record[4] < 1`, loc vfunc0x60 true, disease def `+0x10c8` modifier index valid | each def block in `def+0xf60[]`: `scale = to1e5( record[2] / (1 + min(MAX_DISEASE_PERCENTAGE, record.vf0x30() + record[3])) ) x (1 + loc current `local_<disease>_impact_modifier`)` (2^30 fixed arithmetic converted to 1e5) | code (record field meanings open) | 530-696 |
| **Culture group** of location culture (`culture(loc+0xcd0)[0x1d]`): block `+0x108`; plus list `+0x490[]` items' block `+0x118` | population > 0, culture valid | 1.0 each (`location_modifier` of culture group; list items unidentified) | code (RTTI CCulture) | 705-743 |
| **Pop types** (`0x14fac5e70` DB, array `+0x98`): block A `type+0x40` (count `+0x50`) | population > 0, pops of type > 0, ratio != 0 | `pops(type) / population` -> **pop_percentage_impact** (by semantics) | inferred | 964-1058 |
| Pop types block B `type+0xa8` (count `+0xb8`) | as above | `record[1] / (pops(type) x 100)` = average literacy of that type / 100 -> **literacy_impact** (by semantics; record[1] assumed = sum(size x literacy)) | inferred | 1059-1119 |
| **Town rights** (`loc+0x1378`, RTTI CTownRights): `type(+0x30)+0x1e0` | block non-empty | 1.0 | code | 1121-1143 |
| **Industry promotions** (owner `+0x4bb8` list, RTTI CIndustryPromotion): `type(+0x30)+0x1e0` | owner valid, `promo+0x38 == loc area` (`template+0x200 -> +0xb0`) | 1.0 | code | 1144-1168 |
| **Buildings** (loop over `loc+0x228`): per building `b`, type `t=b+0x10`, active if `b+0x69==1`, not `FUN_142427ca0(b)` (owner at war with controller), level>0, `t+0xd96==1` (type-level flag, probably "has location modifiers") | | `L = level x avg(input satisfaction b+0x18[i]+0x20)` (1.0 if no inputs); `E = employed/(level x employment_size)` (0 if building owner hostile to location owner); `S = E x L`; if `t+0xd95` flag: `S x= owner+0x44f0`; else if type has `fort_level` modifier: `S x= owner+0x44c0` | code (country fields unidentified; likely maintenance sliders) | 1724-1864, helpers 14240ee20/142427ca0 |
| building `t+0x1d8` block (`modifier`) | `t+0x1e8 != 0` | `S` | code (key mapping inferred) | 1844, 1952-1962 |
| building `t+0x240` block (unknown key, control-scaled) | `t+0x250 != 0` | `S x control` | code | 1846-1874 |
| building `t+0x2a8` block (`raw_modifier`) | `t+0x2b8 != 0` | `L` (no employment/efficiency factor) | inferred (name) | 1878, 1966-1975 |
| building `t+0x310` block (`capital_modifier`) | location is owner capital or historical capital | `S` | code | 1895-1905 |
| building `t+0x4b0` block (`market_center_modifier`) | location is market center | `S` | code (asm 143198c92) | 2027-2038 |
| **Works of art** (`loc+0x50`, RTTI CWorkOfArt): first art with `art+0x34 == iRam14fb2d3d8` (one specific art type) and type def (`art+0x18`) having blocks | result != 0 | `art_value(+0x20)/100 x (1 + owner modifier named by `def+0x108` (religion_scale_modifier, tooltip WORK_OF_ART_COUNTRY_RELIGION_SCALE_MODIFIER))`, applied to `def+0x118` | code | 2177-2212, helper 144d66f20 |
| **Holy sites** (`loc+0x12c0`, RTTI CHolySite; lambda `CalcHolySiteModifiers`): type `location_modifier` (`type+0x38`) as nested set | not blockaded-by-enemies, owner == controller, no siege object; `importance (+0x28) > 0`; site religions list (`+0x40`) contains the location's dominant religion (`loc+0xcd8`); first matching site only | `importance` (int, x1.0 each; asm `MOVSXD RAX,[RBX+0x28]; IMUL R8,RAX,0x186a0`) | code | 2213-2322 |
| **Religious orders** (`loc+0x108`, RTTI CReligiousOrder; lambda `CalcReligiousOrderModifiers`): type (`order[3]`) `+0x38` block as nested set | same gates; type has blocks; value > 0 | `order+0x60 / 100` (0..1; likely zeal 0-100) | code (field = zeal inferred) | 2324-2432 |
| **Cabinet actions** (owner `+0x33e0` cabinet, list `+0x36a8`, RTTI CCabinet; global `0x14fb26848` if owner invalid) | def (`a+0xf8`) valid, `def+0x5dc == a+0x4c != 0`, def has entries; location inside target (`FUN_142452750`: location/province/area/region/subcontinent/continent/list scope); owner == controller | per entry (trigger `entry+0x130` checked): `FUN_14244df10 value x max(def.min, ramp) x (1 + efficiency FUN_14244f870) x (1 + vf0x50(a+0xe0))`; ramp = `days/duration` (1.0 when `game+0x2760f`) | code (efficiency fn not read) | 2587-2797 |

## 3. Clamps / caps / conversions summary
- Fixed-point products use the 1e5 convention everywhere; `proximity/100`, `art_value/100`, `order_value/100`, `literacy/100` are the only /100 conversions.
- Caps: `average_satisfaction <= 1`; `location_imports/exports <= 100`; `surplus_jobs <= 5` (define); food price ratio clamped to +-0.5; `approaching_capacity`, `possible_promotion_percentage`, `available/abundant_free_land` in [0,1]; `harbor` scale `>= 0`; supported building levels `>= 0`; population capacity `>= 1.0` (FUN_14310abc0: `max(1, local_population_capacity x (1 + local_population_capacity_modifier + owner.global_population_capacity_modifier) x (1 + total_population_capacity_modifier))`).
- Disease scale uses a 2^30 fixed point internally and is converted to 1e5.

## 4. Differences vs `location.txt` comments
- `devastation` multiplies by the (negative) prosperity field, as the comment says; prosperity/devastation are one field.
- `overpopulation` is scaled by the excess fraction `(pop-cap)/cap`, `overpopulation_growth` by `pop/cap` (not 1.0).
- `unsupported_building_levels` and `unestablished_buildings` are scaled (excess levels; count-1), not flat; `unestablished_buildings` is dead in 1.4.4 (define `no`).
- `building_levels` counts **staffed** levels (employed / employment per level), so unstaffed buildings add nothing.
- `surplus_jobs` is capped at 5 (k jobs) and excludes tribesmen/slaves/peasants; laborer jobs include RGO workers.
- `raised_levies` is suppressed when the owner has `always_allow_levies`.
- `harbor` multiplies by `max(0, harbor_suitability)` accumulated so far in the same set.
- `abundant_free_land` needs `pop < 10k` and `>= 90 %` free capacity, and both free-land statics are gated by the location already having `free_capacity_attracts_pops`.
- `present/hostile_troops` divide men by population (both in thousands).

## 5. Open questions (research stopped at usage limit)
1. The six parent slots of the node (`node+0x1a8 ... +0x4a0`): `helpers3.c` holds the decompile of candidate initializer `FUN_14312e140`; map its vtable LEAs with `scales_tmp\vtname.js <vtableVA>` to get class names, then decompile each `vf0x28` collector.
2. Name of static slot `T+0x320` (not in `static_reg.c` grep); verify `rgo_level` by checking `local_laborers_desired_pop` in-game vs RGO size.
3. Pop-type block mapping (+0x40 = pop_percentage_impact, +0xa8 = literacy_impact) and summary record fields (`[0]` pops, `[1]` literacy sum; jobs record `+0` vs `+8`, `+0x20` unemployed) - verify with a location where tribesmen exist.
4. Country fields `owner+0x44c0` (fort buildings), `+0x44e0` (colonial charter migration), `+0x44f0` (type flag 0xd95 buildings): probably fort/colonial/other maintenance sliders - unverified.
5. Building type flags `+0xd8d` (excluded from building_levels; likely `is_foreign`), `+0xd95`, `+0xd96`; block keys for `+0x240` (control-scaled) and confirmation of `+0x1d8 = modifier`, `+0x2a8 = raw_modifier`.
6. `loc+0xd38` modifier holder (owner-gated, x1.0) and the culture-group list `+0x490` items.
7. IO `(IO+0x60)->vf0x48` meaning; IO `+0x728` entry kind (laws?).
8. Disease record fields `[2]`, `[3]`, `vf0x30` (CDiseaseOutbreak vftable `0x14c8221d8`, entry 6 = `0x14024cae0`, decompiled in `helpers3.c`).
9. Market `+0x88` = food price (inferred from FOOD_PRICE usage; market 13 `price=0.01019`).
10. `FUN_1423eb880` friendly-army criteria beyond same-country/subject tree (uses relation lookup and IO lookup).
