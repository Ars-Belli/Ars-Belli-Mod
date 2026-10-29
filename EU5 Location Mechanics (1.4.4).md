# EU5 Location Mechanics (game 1.4.4)

How a location's numbers come about in Europa Universalis V 1.4.4: population, manpower, levies, wealth, tax, control and market prices. Read from the game code (eu5.exe decompiled with Ghidra) and the game files, and checked against a save. Written for balancing Ars Belli and for the location simulator in `.tools/scripts/location_sim/`.

**Sources and confidence.** *(code)* = read in decompiled eu5.exe 1.4.4; *(save)* = reproduces numbers in the Spain 1547 save (`SP_SPA_1547_04_01`, Ars Belli, 522 Spanish locations); *(tooltip)* = named by a loc key the code prints; *(open)* = not settled. The detailed notes, with addresses and worked arithmetic, are in `.tools/scripts/location_sim/research/`:

| File | Covers |
|---|---|
| `population_military.md` | manpower, sailors, levies, growth, capacity |
| `economy_control.md` | wealth, RGO, buildings, tax and the estate split, control, proximity (partly) |
| `location_modifier_scales.md` | every modifier source of a location and its scale |
| `markets_food.md` | goods prices (complete); food and demand (partly) |

All engine math is fixed point (100000 = 1.0). **Pops, men, manpower and food are stored in thousands**: a pop of `size = 42.13` is 42,130 people; Spain's `manpower = 407.69` is 407,690 men.

---

## 1. A location's modifiers

A location's modifier set is rebuilt by `0x143194700` (plus the template part in `0x143edcc30`). Most static modifiers in `main_menu/common/static_modifiers/location.txt` are applied by the engine with a scale *(code)*:

| Static modifier | Scale |
|---|---|
| `location_base_values`, rank `rank_modifier`, terrain `location_modifier` | 1 |
| `river_flowing_through_<n>` (+ `_coast_<n>` if coastal), `coastal` | 1 (n = river size, below) |
| `integration_<status>`, `capital`, `province_capital` (not in the capital), `historical_capital`, `is_port`, `has_road`, `has_road_connected_to_capital`, `market_center` | 1 |
| `development` | development (0–100, not /100) |
| `proximity_to_capital` | proximity / 100 |
| `prosperity` / `devastation` | prosperity if > 0 / prosperity (negative) if < 0 |
| `control` / `inverse_control` / `control_50` | control / 1 − control / control − 0.5 |
| `total_population` | population (thousands) |
| `average_satisfaction` / `_inverted` | pop-weighted average satisfaction / 1 − it |
| `building_levels` | **staffed** levels: Σ level × staffing |
| `unsupported_building_levels` | levels above `free_building_levels` × (1 + `global_free_building_levels_modifier`) |
| `surplus_jobs` | open jobs (thousands; not peasants, slaves, tribesmen), capped at 5 |
| `unemployed_peasants` | peasants without a job (thousands) |
| `approaching_capacity` | clamp((pop/capacity − 0.6) / 0.4, 0, 1) |
| `overpopulation` / `overpopulation_growth` | (pop − cap)/cap / pop/cap, above capacity only |
| `present_troops` / `hostile_troops` | men present / population |
| `expensive_food_in_location` / `cheap_food_in_location` | min(0.5, ±(market food price − 0.05)/0.05) |
| `raw_material_relative_price` | (price − default)/default of the location's raw material |
| `harbor` | max(0, harbor suitability), ports only |

Other sources *(code)*:
- **Buildings:** `modifier` × level × goods access × staffing (staffing = employed ÷ (level × employment size)); `raw_modifier` × level × goods access; `capital_modifier` in the capital or historical capital and `market_center_modifier` in a market center, both × level × goods access × staffing. An empty barracks gives nothing.
- **Pop types:** `pop_percentage_impact` × the type's share of the population; `literacy_impact` × the type's average literacy / 100.
- Timed location modifiers (events, e.g. `quality_merino_wool`, +50% raw material output) × their size; the location's historical base modifier (`almaden_base`: +300% mercury); province modifiers (`province_base`, `province_starving`); town rights, holy sites, religious orders, cabinet actions, international organizations, diseases, culture groups.
- The owner's `global_X` modifiers are read next to `local_X` by each getter (Section 2 onward says how).

**River size** *(code, `0x1431c3f90`)*: the game traces `rivers.png`; a location gets the widest river pixel v (3–253) it touches: size = min(4, ⌊(v − 3)/3⌋) + 1. In the map, palette 4 and 5 give size 1 (Sevilla, Paris, London), 11 gives size 3 (Danube at Vienna, Nile at Cairo, Rhine), 15 gives size 5.

**Building caps** are the `max_levels` script values (`script_values/building_caps.txt`), e.g. guilds 1 + development × 0.1 + population × 0.05 + 5 in a city; rural buildings 1 + development × 0.1 + RGO size × 0.5 + 1 with a river; manpower buildings 1 + population × 0.025. Levels built when the cap was higher stay (Sevilla has 7 armories over a cap of 4).

---

## 2. Population

**Capacity** *(code, `0x14310abc0`)*: `max(1, local_population_capacity × (1 + local + global population_capacity_modifier) × (1 + total_population_capacity_modifier))`, in thousands. Flat capacity comes from rank (town 20, city 100, megalopolis 400), vegetation (grasslands 50, farmland 100…) and the equator; the percentage from climate (Mediterranean +150%, oceanic +100%), development (+2.5% a point), rivers (+10% × size), coast (+25%), capital (+10%), staffed building levels (+0.1% each).

**Yearly growth** *(code, `0x142733a20`; save: Sevilla 0.248% vs 0.251%)*:

```
yearly = local_population_growth + global_population_growth                  (all modifier sources)
       + 0.0015 × clamp((province food balance ÷ monthly consumption) ÷ 0.25, 0, 1)   FOOD_SURPLUS_POP_GROWTH
       + 0.001  × min(stored food ÷ (12 × monthly consumption), 2) ÷ 2               FOOD_STORAGE_POP_GROWTH
```
- No food terms when the province starves (`province_starving`: −5% a year instead).
- `overpopulation` caps growth at 0. From 60% of capacity, `approaching_capacity` takes up to −0.5% a year (linear to 100%); above capacity `overpopulation_growth` takes −0.5% × pop/cap.
- Prosperity adds +0.2% at 100%; a rural settlement +0.2%.

**Births** *(code, `0x143384090`; save: each type within 1–2%)*: `pool = population × yearly ÷ 12` a month, shared by primary, accepted and tolerated pops by weight `size × (1 + local_<type>_pop_growth + global_<type>_pop_growth)`. Discriminated and ignored cultures get none.

---

## 3. Manpower and sailors

*(code, `0x1427892e0`; save: Spain +0.1%; Sevilla equals the in-game tooltip)*

```
location manpower = local_manpower × (1 + local_manpower_modifier) × max(control, 0.10)
country income    = (Σ locations + manpower of its buildings abroad) × (1 + global_manpower_modifier)
max manpower      = income × 60  (MAX_MANPOWER_YEARS 5) + flat max_manpower
```
- **`local_manpower` comes only from buildings**, scaled by staffing (Section 1). Armory 0.01 and training fields 0.01–0.025 per level, sergeantry 0.015 in the capital. Soldiers pops staff them. So manpower = soldiers in barracks, not population.
- **Control below 10% still counts as 10%** (`NCountry.MILITARY_CONTROL_FLOOR`, a define missing from the define file). The same floor applies to sailors and levies.
- The location panel adds local and country bonuses in one bracket (Sevilla: 85 × 1.34 = 113.9); the country's income multiplies the country bonus on top (85 × 1.24 × 1.10 = 115.9).
- Town rights count: Sevilla's Fortress Town gives +20% local manpower.
- Sailors are the same with `local_sailors` (docks 0.016 … 0.2 per level).

---

## 4. Levies

*(code, `0x143354880`; tooltip `POP_LEVY_CALC_FINAL_CALCULATION_*`)*

```
men = pop size × levy size × culture × levy multiplier × max(control, 0.10) × recovery
```
- **Levy size**: `levy_generic_infantry_size` 0.02 (2% of the pop) or `levy_generic_noble_cavalry_size` 0.1 (10% of nobles); boats 0.005.
- **Which levy**: each pop raises the strongest eligible levy unit (by total combat power, `levies/readme.txt`). Unlocks come from advances (`unlock_levy`), e.g. matchlock levy in age III. Nobles raise cavalry; peasants and laborers infantry; soldiers and (from Discovery) burghers too; clergy and slaves nothing.
- **Culture**: pops of a culture that is not primary or accepted raise × (1 − 0.75) = × 0.25 (`wrong_culture_levy_size`).
- **Levy multiplier**: 1 + local and global `levy_size_modifier` + local and global `army_levy_size_modifier` + the pop's estate's `<estate>_levy_size` (additive; inferred).
- **Estate satisfaction below 25%** (`ESTATE_LEVY_SATISFACTION_THRESHOLD`): that estate's pops raise nothing. In 1547 Spain's nobles sit at 22%, so Sevilla's nobles raise no cavalry.
- **Recovery**: a raised province recovers `raised × (1 + levy_recovery_modifier) ÷ 240` a month (`LEVY_RECOVERY_MONTHS`); until then its levies are × recovered/raised. It cannot raise below 20% (`LEVY_RECRUIT_THRESHOLD`). Raised men leave the pops and the survivors return.

---

## 5. Wealth

*(save: Spain −0.5% in total; with the save's own building profits −1.8%, the rest being burgher trade)*

```
wealth (save: possible_tax) = RGO profit + Σ profit of producing buildings (losses count) + burgher trade
```

**RGO** *(save)*: 1 unit a month per 1,000 workers × (1 + `raw_material_output` + `<good>_output_modifier`), sold at the market price × market access. RGO workers are laborers, up to the RGO size (`max_raw_material_workers`). Peasants without a job farm for food. `GOODS_RGO_BASE_COST`/`_PRICE_SCALE` are the RGO **expansion** price, not a production cost *(code)*.

**Producing buildings** *(code `0x142435ec0`, save)*:
```
profit = level × market access × staffing × ( output × price × (1 + PE + <good>_output_modifier) − Σ inputs × prices )
PE     = local + global production_efficiency
       + (level − 1) × 0.01 × age efficiency (1.0 / 0.8 / 0.6 / 0.4 / 0.2 / 0.1 for ages I–VI)
       + raw_material_in_province_impact (0.1) × share of inputs that are an RGO good somewhere in the province
```
The good's output modifier is found on the save (Spain's lumber mills need its +50% lumber output). Input shortages lower a building's output and input costs together; the simulator has no rationing yet, so short buildings (Sevilla's tools guild, gunsmith) are off.

**Upkeep-only buildings** (temples, forts, offices) are an owner expense, not wealth: `level × Σ maintenance goods × prices × (0.2 + 0.001 × years since 1337) ÷ (1 + building_upkeep_efficiency)` *(save: within ~1.5%)*.

**Staffing over time**: an unprofitable building lays off 10% of its workers a month, a profitable one rehires 10% (`UNPROFITABLE_BUILDING_WORKERS_LAID_OFF_PERCENTAGE`, `PROFITABLE_…_REHIRED_PERCENTAGE`).

---

## 6. Tax

*(code `0x143219360`, `0x142fbdd30`; save: estate shares within 0.03 points median over 1,740 estate rows)*

```
tax base (save: tax) = wealth × control                      (no step at 95%: LOW_CONTROL_THRESHOLD_FOR_BEST_TAX is UI/AI only)
weight[estate]       = Σ pop size of the estate × tax_per_pop      nobles 100, burghers 40, clergy 25, peasants 1
E                    = clamp(global + local peasant_enfranchisment, 0.1, 1)
peasants keep weight × E; the nobles get the rest
estate share         = weight ÷ Σ weights; burgher trade goes 100% to the burghers
crown income         = Σ estate tax base × tax rate × tax efficiency
```
- **Enfranchisement**: country base 0.25, `serfdom_vs_free_subjects` ±0.33, privileges ±0.05–0.10; location: rank (rural −0.2, town +0.1, city +0.25, megalopolis +0.5) and `control` +0.5 × control. Sevilla: 0.7823, exactly the save's.
- **Uncontrolled wealth** (wealth × (1 − control)) goes to the estates untaxed.
- **Tax efficiency** *(code `0x14278b0b0`)*: the crown receives taxes × (1 − `estate_enrichment`) × (1 + `tax_income_efficiency`); the location panel lists the taxes before it (Sevilla 35.77). Spain 1547: 1.05 × 1.16 = 1.218 against the save's 1.2475 (2.4% unexplained). A missing estate in `tax_rates` pays nothing (Spain's clergy are exempt).

---

## 7. Control and proximity

**Max control** *(code `0x1430ed2f0`)*: `clamp(local + global max_control + urban or rural variant, 0, 1)`. Sources: proximity × 0.75, capital +0.2, historical capital +0.1, rank (town 0.05, city 0.1, megalopolis 0.2), integration (conquered −0.1, integrated +0.05, core +0.2), dissatisfaction −0.1 × (1 − satisfaction), troops, bailiff +0.2.

**Monthly change** *(code `0x1430edf80`; save: 291 of 518 locations at exactly −0.005)*: below max, `+ local + global monthly_control` (base 0.0005, core 0.001, road to the capital 0.0005); above max, `−min(control − max, 0.01, local + global monthly_control_decline)` (base 0.005).

**Proximity** *(code `0x143158bf0`, `0x1427175b0`; save: Spain June 1547, median error 0.34, 472 of 522 within 1)*:
- **Sources**: `min(100, local_proximity_source) × (1 + local_proximity_source_modifier)`: the capital 100, a historical capital 80, a **Local Governor** 80 (city only, needs a road to the capital, capped by `num_local_governors`, 1 at base). Building sources scale with staffing and input coverage, so an understaffed governor gives less.
- **Spread**: every location takes the best "source strength minus the sum of jump costs" through the country's own land and every sea zone and lake, never foreign land.
- **Jump cost** = base × factor ÷ (1 + speed), at least 0.01:
  - base: plain land 40, divided by the start location's terrain speed (mountains 0.5, hills and wetlands 0.75, plateau 0.875; vegetation 0.5–0.95 on plain land only; floor 0.25); road 20 minus its bonus (paved 15); a river 12 when cheaper; sea 30, falling toward 5 with full maritime presence; landing or embarking at the location's own port 35, elsewhere 35 with no port factor;
  - factor: own-port jumps × (1 + port modifiers − 0.5 × harbor suitability), at least 0.05;
  - speed: the country's `global_distance_from_capital_speed_propagation` (centralization, laws, the Supreme Court, ruler administration) + the start location's own (0.005 × development, bridges, canals).
- A governor only helps where its 80 beats what the capital already reaches: a governor in Lisbon, reached at 86 by sea, changes nothing. Spain 1547 with a governor in Zaragoza (proximity 32): control +2.1 points within two years, crown tax +3%, manpower +150 a month, levies +7,000.

**Development and prosperity** *(code `0x1430cc5b0`, `0x1430cb200`; consecutive saves within rounding)*, once a month:
- development += (local + global monthly development) × (1 + local modifier) × (1 + global modifier); the modifiers only scale a positive change; prosperity adds 0.004 × prosperity a month;
- prosperity += local + global monthly prosperity − decay (1% of prosperity at base); below zero it recovers by the devastation recovery instead; clamped to −1…1.

---

## 8. Markets

**Goods price** *(code `0x14322f410`, `0x143240930`; save: 11,870 of 11,875 market goods)*:
```
S, D  = effective supply and demand (imports/exports weighted: merchant trade 75%, burgher trade 25%, transit removed)
D    ×= 1.25 for food goods when the market's food price is above 0.05
R     = (k × (S + 1) + (D + 1)) ÷ (k × (D + 1) + (S + 1)),   k = age price stability (0.1, 0.1, 0.08, 0.06, 0.04, 0.02)
R     = clamp(R, 0.1, age max price 3 / 3 / 4 / 5 / 5 / 5) (+ tariff impact after the clamp)
target = default price × R;   price += 5% × (target − price) each month
```
**Building and RGO goods** *(save: `demand_food.md` 2)*: a building demands `level × input × staffing × market access` and supplies `level × output × staffing × input fill` (no market access on what it sells into the market); an RGO supplies `workers × (1 + output modifiers)`; unemployed peasants add `base_production` × their number (clay, sand, stone, lumber, wool). A building runs one production method per slot (e.g. the fine cloth guild's alum slot, the gunsmith's ammunition slot), and a method short of one input runs at that fill fraction for all its inputs.

**Pop demand** *(code; fits markets within ~5%)*: per 1,000 pops `(all + type + upper) × type and upper multipliers`, then religion, culture, location (winter, climate, region), literacy, country, development `× (1 + 0.05 × development)`, estate wealth, price elasticity `clamp(1 − 0.4 × (price/default − 1), 0.35, 1)`, starving ×2.5, food deficit ×1.5; gated by the estate's wealth reaching the good's threshold and by the age's known goods. Who gets scarce goods is open.

## 8b. Food

*(code `0x14333cf60`, `0x14333e040`, `0x1432365b0`, `0x1430f3300`; save: provinces end where these rules say in 80% of 3,367 cases)*

- **Location production**: `(building food + local_monthly_food + 0.8 × unemployed peasants and laborers (subsistence) + RGO workers × (1 + raw output) × the good's food value) × (1 + local and global monthly_food_modifier [+ the RGO good's output modifier]) × (1 + local_food_production_mult)`. Towns −10%, cities −20%, megalopolises −30%. Food values: wheat 8, fish 5, olives 4.
- **Consumption**: pops × `pop_food_consumption` (nobles 20, clergy and soldiers 5, burghers 4, laborers, peasants and slaves 1, tribesmen 0) × (1 + consumption modifiers, at least 0.05).
- **Province store**: capacity from `local_food_capacity` (50 a location, town 250, city 500, granary 500 a level) × (1 + capacity modifier). Each month the store takes the balance minus decay: `stock × (local + global food_decay (0.005)) ÷ (1 + preservation)`; granaries preserve 5% a level.
- **Market exchange**: a province above 75% of its capacity sells the surplus to the market; a province below 75% with a deficit asks to be refilled. The market then refills buyers to 75%, and tops up the sellers to full (or by 3 months of their deficit) from its food above 25% of its own capacity. Shortages are rationed pro rata.
- **Starvation**: an empty store, or one that cannot cover a month of deficit with nothing bought, applies `province_starving` (−5% growth a year).
- **Food price**: heads 5% a month toward `0.05 × R`, floor 0.01. R = 5 ÷ months of stock left when food flows out, else `0.1 + 0.9 × (1 − store/capacity)`. Above 0.05 food goods get ×1.25 demand and locations get `expensive_food_in_location`.
- **Growth**: the store gives the food terms in Section 2 (surplus over consumption, months of stock).

Who pays for traded food and the 1.33 pop-income scale are open.

---

## 9. Checked against the save (Spain, 1 June 1547, game 1.4.4)

`node .tools/scripts/location_sim/check.js scenarios/local/spain_1547_06.json`

| Number | Save | Simulated | |
|---|---|---|---|
| Wealth, all 522 locations | 14,379 | 14,086 | −2.0% (burgher trade, not modelled) |
| Estate shares | | | median error 0.03 points, 90th percentile 0.21 |
| Crown tax income a month | 5,499 | 5,206 | −5.3% (tax efficiency 2.4% unexplained, plus wealth) |
| Manpower a month | 6,747 | 6,751 | +0.1% |
| Sailors a month | 1,496 | 1,525 | +2.0% |
| Births a month | 4,405 | 4,402 | −0.1% |
| Proximity | | | median error 0.34, 472 of 522 within 1 point |

Sevilla against the in-game tooltips (June 1547): wealth 80.89 vs 80.99; estate shares 16.58 / 7.98 / 50.73 / 5.59 vs 16.48 / 7.93 / 51.01 / 5.55; location taxes 35.72 vs 35.77; building maintenance 31.68 vs 31.87; monthly manpower 113.9 vs 113 (85 from buildings × (1 + 10% Crown of Castile + 4% soldier literacy + 20% Fortress Town)).

---

## 10. Ars Belli changes that touch this

None of the formulas. The mod's `REPLACE:control` keeps vanilla's +0.5 enfranchisement; its INJECT on `country_base_values` adds fort limit, mercenary range and supply depot capacity only; `REPLACE:soldiers` drops the soldiers' estate power. Mod advances add `global_manpower_modifier` / `global_levy_size_modifier` values (inputs).

---

## 11. Location simulator

Files in `.tools/scripts/location_sim/`:

| File | What it is |
|---|---|
| `engine.js` | The rules of this document as code; runs in Node and the browser. |
| `data.json` | Game + mod data: pops, estates, ranks, ages, static modifiers, buildings, production methods, goods, levies, terrain, 28,573 locations with province, river size and coast. Rebuild with `node build_data.js` after a game or mod change (after `build_map.js`). |
| `map.json` | Each location's size, centre, neighbours (shared border) and river pixels, from the map images. `node build_map.js` (3 s). |
| `sim.js` | `node sim.js <scenario.json> [--months 120] [--buildings] [--modifier <key>] [--modifiers] [--json]` |
| `from_save.js` | `node from_save.js <save|latest> --list TAG`, `--location <id|key>`, `--country TAG` (whole country to `scenarios/local/`, git-ignored) `[--out file]` |
| `check.js` | A country scenario against the save's own numbers. |
| `research/` | The research notes. |

**Scenario format** (all location fields optional except `pops`; `key` fills terrain, raw material, river and coast from the map):

```json
{
  "name": "…",
  "location": { "key": "sevilla", "rank": "city", "development": 60.5, "prosperity": 0.24, "control": 1, "proximity": 100,
                "integration": "core", "capital": true, "provinceCapital": false, "marketCenter": true, "port": true,
                "roadToCapital": true, "marketAccess": 1, "rgoWorkers": 16, "burgherTrade": 0,
                "food": { "surplusFactor": 0, "storageFactor": 1, "starving": false }, "levyRecovery": 1,
                "pops": [ { "type": "peasants", "size": 53.26, "status": "Primary", "satisfaction": 0.5, "literacy": 10 } ],
                "buildings": [ { "type": "armory", "level": 7, "employed": 7, "method": "armory_maintenance" } ],
                "timedModifiers": [ [ "quality_merino_wool", 1 ] ],
                "situation": { "friendlyTroops": 0, "occupied": false, "looted": false, "raisedLevies": false } },
  "country": { "year": 1547, "age": 4, "modifiers": { "global_manpower_modifier": 0.1 }, "baseValues": true,
               "taxRates": { "nobles_estate": 0.55, "burghers_estate": 0.46, "peasants_estate": 0.57 },
               "estates": { "nobles_estate": { "satisfaction": 0.22 } }, "advances": [ "unlock_matchlock_levy" ] },
  "market": { "prices": { "olives": 0.247 }, "foodPrice": 0.0102 }
}
```
- Sizes and men are thousands. `status` is the pop's culture status (`Primary`, `Accepted`, `Tolerated`, anything else counts as another culture).
- `employed` (thousands) fixes a building's staffing; without it jobs fill from the pops. `rgoWorkers` is the RGO size; without it, the formula estimate (open).
- `country.modifiers` is the owner's full modifier sum. `from_save.js` fills it from base values, advances, laws, privileges, reforms, timed modifiers and societal values, with every source in `sources`. Base values are added for hand-written scenarios unless `baseValues: false`.
- Without `advances`, levies unlock by `age`. Without `taxRates`, every estate pays 35%.
- `market.prices` default to the goods' base prices.

**The projection** (`--months`): pops grow by their births, control moves toward its max, buildings lay off or rehire 10% a month by profit, manpower accumulates. Development, prosperity, prices and food are held constant until their research is done.

### Country mode

`node sim.js scenarios/local/spain_1547.json --months 120 --markets fixed|closed|off` (`country.js`; a scenario with a `locations` list, as `from_save.js --country TAG` writes). Every location runs month by month against one shared country:
- **Totals**: manpower income, max manpower and the pool, army upkeep in manpower held at the save's value (`options.manpowerExpense`, thousands a month), levies, wealth, tax base, crown tax, building upkeep, control weighted by wealth.
- **Markets**: each good's price moves 5% a month toward the target from effective supply and demand (Section 8).
  - The country's own RGO and building output is supply; its building inputs and maintenance goods are demand.
  - Everything else in the market at month 0 (foreign members, construction, armies, roads) is calibrated as the difference from the save and held.
  - Pop demand is kept apart and follows the decoded price elasticity: `clamp(1 − 0.4 × (price/default − 1), 0.35, 1)`.
  - Trade with other markets: `fixed` holds the save's imports and exports; `closed` removes them; `off` freezes prices.
- **Food** (`--food on`, the default; Section 8b): every province keeps its store, sells its surplus to the market and buys back to 75% when short; the market moves its food price; the stores drive growth and starvation. With `--markets off` provinces cannot share food, so deficit provinces (Sevilla's) slowly starve. `--food off` keeps the scenario's food terms for a quick run.
- **Limits**: pop demand does not grow with population yet, and proximity is taken from the scenario (Local Governors need the proximity research). Thin goods can swing hard: with everything else fixed, a good drifts to the target its saved supply and demand imply.

---

## 12. Open questions

1. Tax efficiency: 0.0975 of Spain's ×1.2475 is unexplained.
2. Proximity: 0.015 of Spain's speed term, and river links (approximated from the river map, about 2% wrong).
3. Burgher trade (about 2% of wealth, all to the burghers).
4. Building input rationing, pop demand and burgher trade (market research).
5. Food: production, consumption, storage and the province–market exchange.
6. Pop demand growth beyond population, and scarce-goods rationing in the market.

## Appendix: where it lives in eu5.exe 1.4.4

Location modifier update `0x143194700`, template modifiers `0x143edcc30`, static modifier table `0x14fb2d558` (getter `0x1449b00c0`; offsets in `E:\Tools\ghidra-projects\locsim_main\static_map.txt`), river size `0x1431c3f90`, capacity `0x14310abc0`, growth `0x142733a20`, births `0x143384090`, manpower `0x1427892e0` / `0x143106700`, max manpower `0x142740990`, levy size `0x143354880`, levy recovery `0x14333d1f0`, building staffing `0x14240ee20`, production efficiency `0x142435ec0`, estate split `0x143219360`, enfranchisement `0x142fbdd30`, max control `0x1430ed2f0`, monthly control `0x1430edf80`, proximity cost `0x1427175b0`, goods price `0x14322f410` / target `0x143240930`.
