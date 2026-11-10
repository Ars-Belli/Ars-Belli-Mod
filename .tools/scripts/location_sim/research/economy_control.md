# EU5 1.4.4 — location economy and control formulas (tax, wealth, control, proximity)

Research notes for the location simulator. Game: EU5 1.4.4 (eu5.exe, Ghidra project `eu5_144b`, decompiles in
`E:\Tools\ghidra-projects\locsim_eco\*.c`). Save used for checks: `SP_SPA_1547_04_01_7f25c496-...eu5`
(Spain, 1 Apr 1547, played with Ars Belli). Scratch scripts + extracted data:
`...\scratchpad\research\eco_tmp\` (`spain_locs.js` -> `spain_locs.json` = all 522 Spanish locations with pops,
buildings, estate_tax; `fit_share.js`, `fit2.js`, `pm_fit.js`, `pm_regress.js`, `pops_of.js`, `market13_prices.json`,
`definemap_all.txt` = every define -> exe global + reader functions).

Confidence tags: `code` = read in a decompile; `tooltip` = from the English tooltip/loc text; `save-checked` =
reproduced a number from the save; `inferred` = my best reading, not verified.

Fixed point: the engine stores these values as int64 x 100000 (1.0 = 100000); products are `(a*b)/100000`.

Research was cut short by the user's usage limit; everything not marked verified is listed under "Open questions".

---------------------------------------------------------------------------------------------------------------

## 0. What the save fields mean (save-checked)

Location (`locations > locations > <id>={...}`):
- `possible_tax` = location WEALTH (the full tax base at control 1). `save-checked`: sum over Spain's 522 locations
  = 14116.171 = sum over Spain's estates of (`taxable_income` + `uncontrolled_income`) = 9317.345 + 4798.826.
- `tax` = TAX BASE actually controlled = wealth x control. `save-checked`: sum over Spain = 9317.344 = sum of the
  estates' `last_month.taxable_income` (nobles 5059.78 + clergy 1022.42 + burghers 2424.40 + peasants 810.75).
- `estate_possible_tax` / `estate_tax` = the per-estate split of `possible_tax` / `tax` (estate tax base in that
  location). `save-checked`: per-estate sums over all locations equal each estate's `taxable_income` exactly.
- `control`, `proximity` (0..100), `local_proximity_propagation` (per-location proximity cost figure, see 4),
  `max_raw_material_workers` (RGO levels = thousands of workers), `pop_stats.<type>.employed_in_rgo`,
  `market_access` (0..1), `development`, `prosperity`, `rank`, `integration_data.integration`.
- `value_flow` (2877: 512.12; Spain sum 10833) is NOT wealth; meaning unknown (open).

Estate (`estate_manager > database`): `last_month.taxable_income` (= sum of its `estate_tax` over the country's
locations), `uncontrolled_income` (= sum of `estate_possible_tax - estate_tax`), `paid_taxes`, `city_income`,
`trade_income`, `food_income`, ... ; `gold`, `satisfaction`, `wealth_impact`.

Country `economy.tax_rates={ nobles_estate=0.54929 burghers_estate=0.46188 peasants_estate=0.57189 }` are the
effective tax fractions (clergy missing = 0; Spain has the clergy `tax_exemption` privilege, and the clergy estate has
no `paid_taxes`). `last_months_tax_income=5441.13907` = sum of the estates' `paid_taxes` (3465.68937 + 1397.03903 +
578.41067) `save-checked`.

Pops: `population > database > <id>={ type estate culture religion status size(thousands) satisfaction ... }`.
Pop sizes in the save are a few days newer than the monthly tax tick, so tiny pops (0.02k) show % noise.

---------------------------------------------------------------------------------------------------------------

## 1. TAX

### 1.1 Tax base of a location

```
wealth          = sum(building.last_months_profit over PRODUCING buildings in the location, negatives included)
                + RGO_profit                                   (see 2.1)
                + burgher_trade_profit                         (see 2.4, small; 100% goes to the burghers estate)
possible_tax    = wealth                                        [save key]
tax_base (=tax) = wealth x control                              [TAX_BASE_TT_LIST "tax_base due to control of X%"]
```
- `save-checked`: `tax / possible_tax` = control as of the monthly tick, for ALL control levels (no step at 0.95):
  in 291 of 518 Spanish locations `tax/possible_tax - control = +0.00500` exactly (control declined by
  `global_monthly_control_decline` 0.005 after the tax was computed), the rest differ by the location's own
  monthly control change. Evaluated monthly (the tick computes tax before the control update).
- `NCountry.LOW_CONTROL_THRESHOLD_FOR_BEST_TAX` 0.95 (global 14fafcf28) is read only by FUN_1428ba910 (18 KB, UI/AI,
  not decompiled) — it is NOT in the tax-base formula. `code`(xref) + `save-checked`.
- Buildings with `upkeep=` in the save (temples, forts, offices...) produce nothing and do not count toward wealth;
  their upkeep is a separate owner expense (TAX_BASE_TT_TEXT lists "building maintenance" separately). `tooltip`+`save`.
- Worked check, location 2877 (Sevilla, capital, city, control 1, market_access 1): sum of the 47 buildings'
  `last_months_profit` = 71.23173 (includes jewelry_guild -11.24896 and tannery -0.36699); RGO olives = 5.4375 (2.1);
  remainder 78.25802 - 71.23173 - 5.4375 = 1.5888 = burgher trade (consistent with the 2.16% share residual in 1.2).
  `save-checked` to the residual.

### 1.2 Split of the tax base among estates (wealth share)

Engine: FUN_143219360 (distributes an amount among estates; called from the building monthly update FUN_1425cf110 and
the market/RGO update FUN_14321b560; pays each estate through FUN_143219df0). Peasant enfranchisement getter:
FUN_142fbdd30 (tooltip `PEASANT_ENFRANCHISMENT_TITLE`, `PEASANT_ENFRANCHISMENT` "Min $MIN$ and Max is $MAX$").

```
for each estate e:   w[e] = (sum of pop.size of pops whose estate==e, in thousands) x estate.tax_per_pop
                      tax_per_pop (estates/00_default.txt): nobles 100, clergy 25, burghers 40, peasants 1,
                      dhimmi 1, tribes 0.01, cossacks 0.5, crown 0        [code: estate+0x38, save-checked]
E = clamp( country.global_peasant_enfranchisment + location.local_peasant_enfranchisment,
           NEstate.MIN_PEASANT_ENFRANCHISMENT 0.1, NEstate.MAX_PEASANT_ENFRANCHISMENT 1.0 )     [code]
for each estate e with a transfer target t (peasants -> nobles; vfunc at estate+0x358):
      w[t] += w[e] x (1 - E);   w[e] = w[e] x E                                                   [code]
share[e] = w[e] / sum(w);   estate_possible_tax[e] = share[e] x shared_wealth (+ burgher trade for burghers)
estate_tax[e] = estate_possible_tax[e] x control
```
- The crown estate has tax_per_pop 0: it gets no wealth share. Pop estate = `estate=` field of the pop (pop type ->
  estate mapping in pop_types: nobles->nobles_estate, clergy->clergy, burghers->burghers, laborers/soldiers/peasants/
  slaves->peasants_estate, tribesmen->tribes; dhimmi/tribes/cossacks override by trigger).
- `save-checked` over 518 Spanish locations: clergy and burghers shares match `pops x tax_per_pop` with median ratio
  1.0000 (p10/p90 0.996/1.003); peasants keep E and nobles get the rest.
- Enfranchisement sources (vanilla 1.4.4, all additive): country base `global_peasant_enfranchisment = 0.25`
  (auto_modifiers/country.txt); societal value `serfdom_vs_free_subjects` left -0.33 / right +0.33 (x position);
  privileges: nobles_land_rights -0.10, noble_serfdom_rights -0.05, banal_lordship -0.05, peasants_free_peasantry
  +0.10, peasants_represented_in_parliament/peasant_owns_their_food/peasants_allowed_weapons_privilege/communal_lands/
  peasants_in_administration/peasants_autonomous_villages +0.05 each; reforms new_farmers_directive +0.2,
  frisian_freedom_reform +0.33, ancient_french_taxation -0.20, benevolence_tax_reform +0.10; laws vlach/pyrenean/
  carta_de_logu +0.05; static modifier `textile_monopolies_modifier` -0.1.
  Location side: rank (`location_ranks/00_default.txt`): rural_settlement -0.2, town +0.1, city +0.25, megalopolis
  +0.5; engine static modifier `control` = 0.50 x control (mod's `REPLACE:control` keeps 0.50); `surplus_jobs` 0.02
  x scale; buildings noble_villa -0.02, local_estates -0.01, peasants_hunting_grounds +0.01, free_village +0.02,
  fishing/farming/forest/market_village +0.01, one rural building -0.1; town rights mining_charter -0.1,
  plantation_charter -0.15, fuero_juzgo +0.05, fuero_de_aragon +0.1, usatges_de_barcelona -0.1.
- Burgher trade: the share analysis leaves a residual that is exactly explained if a small amount is given 100% to the
  burghers estate (2877: 2.16% of wealth = 1.59-1.69 gold/month). `inferred` from save residuals (define
  `NEconomy.TRADE_BURGHER_PROFIT_SCALE` 0.1, reader FUN_143225be0 — not decompiled).

Worked check, location 2877 (`save-checked`, all four within 0.2%):
```
pops (k): nobles 2.30157, clergy 4.89023, burghers 19.44347, peasants-estate 42.29414+13.95295+53.2642 = 109.51129
w: nobles 230.157, clergy 122.256, burghers 777.739, peasants 109.511
E = 0.25 - 0.10 (nobles_land_rights) - 0.05 (noble_serfdom_rights) + 0.10 (peasants_free_peasantry)
    + 0.05 (peasants_allowed_weapons_privilege) - 0.33 x 0.6596 (serfdom_vs_free_subjects = -65.96176)
    + 0.50 x 1.0 (control) + 0.25 (city)  = 0.7823        (observed peasants-kept fraction 0.7824)
w': nobles 230.157 + 109.511 x 0.2177 = 254.00; clergy 122.256; burghers 777.739; peasants 109.511 x 0.7823 = 85.67
sum = 1239.66;  shared wealth S = 78.25802 - 1.5888 (burgher trade) = 76.669
nobles   254.00/1239.66 x 76.669 = 15.709   (save 15.68619)
clergy   122.256/1239.66 x 76.669 =  7.561   (save  7.55090)
burghers 777.739/1239.66 x 76.669 + 1.5888 = 49.689   (save 49.72940)
peasants  85.67/1239.66 x 76.669 =  5.298   (save  5.29153)
```

### 1.3 What the crown collects

```
per location/estate:  crown_tax = tax_rate[estate] x estate_tax[estate]          [TAX_BASE_TT_ESTATES_LIST_TAXED]
country/month:        paid_taxes[estate] = taxable_income[estate] x tax_rate[estate] x F
tax income            = sum over estates of paid_taxes                            [save-checked: 5441.139]
```
- `save-checked`: F = 1.2475 for nobles, burghers and peasants alike (3465.689/5059.785/0.54929;
  1397.039/2424.398/0.46188; 578.411/810.745/0.57189). The estate breakdown tooltip lists
  `ESTATE_TAXABLE_INCOME_ENTRY_TAX_INCOME_EFFICIENCY` ("Tax Income Efficiency: X%") and
  `ESTATE_TAXABLE_INCOME_ENTRY_ENRICHMENT` ("Estate Enrichment: X%"), so F = (1 + tax_income_efficiency) possibly
  times an enrichment factor. Spain's modifier sum was not finished (`spain_mods.js` written, not run) — open.
  `tax_income_efficiency` named values: tiny/small/medium/large/huge bonus 0.01/0.02/0.03/0.05/0.1,
  penalties -0.01/-0.025/-0.05/-0.1/-0.2 (default_values.txt).
- `tax_rate` is bounded by `global_estate_min_tax` (0) and `global_estate_max_tax` (0.35 base, country_base_values)
  + `<estate>_estate_max_tax` (estate power blocks in estates/00_default.txt; emergency taxes +0.10; crown estate
  power +0.20 x power; negative_self_control +0.1 x scale; parliament_approved_extra_taxes +0.25). The saved rates
  are the effective fractions, not "percent of max" (the game concept text says "percentage of max tax" but the
  tooltip multiplies rate x estate tax base directly). `tooltip`.
- Clergy with `tax_exemption` pays nothing (no `paid_taxes` key). `save-checked`.
- Not resolved: `NCountry.ESTATE_TAX_SATISFACTION_THRESHOLD` 0.01 (reader FUN_142753b00, 47 KB) — satisfaction hit
  per tax; `ECONOMICAL_BASE_FROM_TAX_BASE` 0.5 (economic base score, not income).

---------------------------------------------------------------------------------------------------------------

## 2. WEALTH

### 2.1 RGO

```
workers      = employed_in_rgo (thousands; <= max_raw_material_workers = RGO level, 1000 pops per level)
output/month = workers x 1.0 x (1 + sum of raw-material output modifiers:
                 global_raw_material_output + local_raw_material_output
                 + global_<good>_output_modifier + local_<good>_output_modifier ...)
RGO_profit   = output x market_price(good) x market_access            -> wealth (and tax base x control)
```
- `save-checked` (market 13, 12 goods whose producers are all Spanish): output per 1000 workers = 1.3732 for olives
  (1.3724), beeswax, horses, medicaments, salt, stone, wine, livestock, alum, dyes, fruit, marble; higher where Spain
  has good-specific modifiers (lead 1.6732, wool 2.3764, silk 1.5507, tin 1.4732, clay 1.4278, sugar 1.4248), wheat
  1.351 (one location penalised). So base = 1 unit per 1000 workers per month, and Spain's country-wide raw-material
  modifier sum in 1547 = +37.32% (sources not itemised — open).
- `tooltip`: RAW_MATERIAL_LOCATION_TABLE_TITLE_TT "A total of <output> is sold every month for <price> (<market
  access>)"; RGO_MARKET_ACCESS_MECHANIC_DESC "50% market access produces 100% of the output but only generates 50% of
  the tax base". RAW_MATERIAL_SIZE_TT "output due to rgo_pops: WORKERS + MORE".
- 2877: 16 x 1.3732 x 0.24748 (olives, market 13) x 1.0 = 5.4375 gold/month (`save-checked` via the wealth residual).
- `NEconomy.GOODS_RGO_BASE_COST` 0.5 and `GOODS_RGO_PRICE_SCALE` 0.25 are the RGO EXPANSION price
  (FUN_142584020 / FUN_143155870: `default_market_price x 0.25 + 0.5` per level scale) — not a production cost. `code`
- Max RGO size (`local_max_rgo_size`, modifier_types): `location_base_values` 2 + `development` 0.1 x development
  + `total_population` 0.025 x pop(k) + ..., times (1 + `local_max_rgo_size_modifier`: rural_settlement +1.0,
  megalopolis -0.5, laborers pop literacy_impact +0.1 ...). Not verified against the save (2877 has 16 levels with
  development 60.5 and 136k pops -> 2 + 6.05 + 3.40 = 11.45 before multipliers; the remaining +40% is unexplained) —
  open; the static-modifier scales are being mapped by the main agent.
- Unemployed laborers/peasants do subsistence agriculture (`NLocation.SUBSISTENCE_AGRICULTURE` 0.8, readers
  FUN_1430f3300 (19 KB) and FUN_143155bd0) — food side, owned by the food agent.

### 2.2 Producing buildings (profit -> wealth)

Production methods: `building_types/*.txt` `unique_production_methods = { <pm> = { <input good> = amount ...
produced = <good> output = amount } }` (per level), or standalone PMs in `production_methods/`. Employment per level
= `employment_size` script value (default_values.txt: guild 0.1 = 100 pops, workshop 0.1, manufactory 0.16,
rural_peasant_produce 1.0, advanced_peasant_building 0.5, generic_peasant_building 0.25, religious_building 0.05 ...).

```
throughput  = market_access x (employed / (employment_size x level))     [save-checked for market access]
profit      = level x throughput x ( sum_out output_amount x price_out x (1 + PE)
                                    - sum_in  input_amount  x price_in )
PE (FUN_142435ec0, "production efficiency" of this building) =
      local_production_efficiency (location) + global_production_efficiency (country)        [code]
    + max(0, level - 1) x NEconomy.PRODUCTION_EFFIENCY_BONUS_PER_LEVEL 0.01 x age.efficiency   [code; tooltip
        EFF_LEVELS_OF_BUILDING "$NUM$ Levels in Building (Age Multiplier $AGE$)"; age/00_default.txt `efficiency`:
        age1 1.0, age2 0.8, age3 0.6, age4 0.4, age5 0.2, age6 0.1]
    + raw_material_in_province_impact (country modifier, base 0.1)
        x ( sum of input amounts of goods that are an RGO good somewhere in the same province
          / sum of all input amounts )                                                          [code; tooltip
        INPUT_GOODS_IN_PROVINCE "<good> rgo in province X: +Y%"]
```
- `save-checked` (pm_regress.js, 31 cloth guilds / 22 paper guilds in market 13 at market access 0.54-1.00): the
  quantity (profit/level + cost x access) / (revenue x access) is constant across access (cloth L1 1.025-1.032,
  paper L1 1.028-1.049), i.e. both the sold output and the bought inputs scale with market access; PE applies to
  the output only. Prices used = current market price (the save's `last_months_profit` used last month's prices, so
  expect ~0.5% noise).
- Implied PE at 2877 (age 4 would give +6.8% for L18 from the level term, age 3 +10.2%; the save's current age was
  not read — open): cloth_guild L18 9.54%, paper_guild L18 9.46%, weapon_guild L18 9.18%, tools_guild L18 4.79%
  (probably iron shortage -> lower throughput), brewery L1 8.82% (wheat is a province RGO: +0.9944/1.3427 x 10% =
  +7.4%), distillers_guild L1 7.65% (wheat share 0.897 -> +9.0%), pottery_guild L2 8.03% (clay share 0.855 -> +8.5%),
  mason L14 16.7% (clay 100% -> +10%), scriptorium L15 26.8%, lumber_mill L16 59.1% (needs a large lumber output
  modifier — where goods-specific `<good>_output_modifier` enter was not located; open).
- Partially employed buildings scale with employed/(size x level) (`employment_requirement_status` LayingOff/
  Rehiring; unprofitable ones lay off UNPROFITABLE_BUILDING_WORKERS_LAID_OFF_PERCENTAGE 10%/month unless subsidised).
  `tooltip` + `inferred` for the exact scaling.
- Establishment system is OFF (`ESTABLISHMENT_SYSTEM_ENABLED = no`): no ramp, no STARTUP_MAX_PE_BONUS.
- Negative profits count in wealth (2877 reproduces only with -11.25 and -0.37 included). `save-checked`.
- Whether foreign-owned producing buildings count toward the location's wealth: open (2877's foreign buildings are
  all upkeep-only).

### 2.3 Upkeep-only buildings (owner expense, not wealth)

```
upkeep/month = level x sum(maintenance input amount x market price) x building_upkeep_multiplier x (1 - building_upkeep_efficiency ?)
building_upkeep_multiplier = 0.2 (country_base_values) + 0.001 x years since 1337 (static `years_since_game_start`)
                           -> 1547: 0.410
```
- `save-checked` ratio upkeep / (level x inputs x price) for Spain-owned buildings in 2877: temple 0.3906, granary
  0.3916, marketplace 0.3914, castle 0.3908, armory 0.3879, sergeantry 0.3870, royal_atarazanas 0.3878; foreign-owned
  trade offices 0.424, embassy (other owner) 0.413. So ~0.39 for Spain vs 0.41 from the two known terms: the last
  5% (an efficiency modifier or a slightly different year count) is open.

### 2.4 Burgher trade

Adds a small amount to location wealth credited entirely to the burghers estate (1.2); `NEconomy.TRADE_BURGHER_PROFIT_SCALE`
= 0.1 is read by the market trade update FUN_143225be0 (21 KB, not decompiled). Market-level mechanic (market agent).
Open.

### 2.5 Market prices / access
Owned by the market agent. Inputs needed here: `market_manager > database > <market> > goods > <good> > price`,
location `market_access` (0..1).

---------------------------------------------------------------------------------------------------------------

## 3. CONTROL

Modifier indices (peek.js modmap on the registration function 0x144c840f0): local_max_control 14f0a3582,
global_max_control 14f0a370e, local/global_max_rural_control 14f0a3580/3710, local/global_max_urban_control
14f0a357e/3712, local/global_monthly_control 14f0a3714/3716, local/global_monthly_rural_control 3718/371a,
local/global_monthly_urban_control 371c/371e, local/global_monthly_control_decline 3720/3722.

### 3.1 Max control — FUN_1430ed2f0 (tooltip MAX_CONTROL_TT_TEXT "Max Control is due to:") `code`

```
urban = rank->vfunc0() && rank.flag(+0x308)     (town/city/megalopolis vs rural — inferred from the modifier names)
max_control = local_max_control + global_max_control
            + (urban ? local_max_urban_control  : local_max_rural_control)
            + (urban ? global_max_urban_control : global_max_rural_control)
max_control = clamp(max_control, 0, 1)
```
`local_max_control` sources (static_modifiers/location.txt, integration.txt, ranks; scales are engine-applied — the
main agent is mapping the scale of each static modifier):
- `proximity_to_capital` 0.75 (x proximity/100), `capital` +0.20, `historical_capital` +0.10;
- rank: town +0.05, city +0.10, megalopolis +0.20;
- integration: conquered -0.10, integrated +0.05, core +0.20 (colonized 0);
- `average_satisfaction_inverted` -0.10 (x (1 - average pop satisfaction)), `present_troops` +0.10, `provincial_troops`
  +0.01, `is_blockaded_by_enemies` -0.10; buildings (e.g. stronghold_city_modifier +0.2) and event modifiers;
- country `global_max_control`: low_legitimacy/low_republican_tradition/low_devotion/low_horde_unity -0.2 x scale
  (auto_modifiers), yua_purge -0.1, etc.
- 2877: 0.75 + 0.20 + 0.10 + 0.20 (+ troops) >= 1 -> clamped to 1.0 = saved control 1. `save-checked` (loosely).
- `inverse_control` static modifier (local_crown_estate_power -1.0 x (1 - control)) is estate power, not control.

### 3.2 Monthly control change — FUN_1430edf80 (tooltip MONTHLY_CONTROL_TT_TEXT) `code`

```
if control <= max_control:
    delta = local_monthly_control + global_monthly_control
          + (urban ? local_monthly_urban_control  : local_monthly_rural_control)
          + (urban ? global_monthly_urban_control : global_monthly_rural_control)
    (no cap inside the getter; the applier presumably clamps control at max — not read)
else:
    decline = local_monthly_control_decline + global_monthly_control_decline
    delta = - min(control - max_control, NLocation.MONTHLY_CONTROL_DECAY 0.01, decline);  delta = 0 if decline < 0
```
- `save-checked`: 291/518 Spanish locations moved exactly -0.005/month (= `global_monthly_control_decline` 0.005 in
  country_base_values), the rest smaller declines (within 0.005 of max) or increases of +0.0001..+0.0203 (so
  increases are NOT capped at 0.01).
- `local_monthly_control` sources: `location_base_values` 0.0005, `has_road_connected_to_capital` 0.0005,
  `integration_core` 0.001, `integration_colonized` 0.001, `present_troops` 0.01, `provincial_troops` 0.001,
  `is_occupied` -0.002, `isolating_cities` 0.005, cabinet action increase_control_province, many event modifiers;
  country `global_monthly_control` from auto_modifiers (balanced_yanantin, high_righteousness 0.001...).
- Tax uses the control value from before the month's control update (1.1).
- Other defines seen: `NCountry.MILITARY_CONTROL_FLOOR` 0.10 (17 readers, purpose open — probably the control floor
  used by occupation/war code), `NEconomy.BANKRUPTCY_CONTROL_CHANGE_PERCENT` -0.33, `REBEL_LACK_OF_CONTROL_FACTOR`
  0.02.

---------------------------------------------------------------------------------------------------------------

## 4. PROXIMITY (partially decoded — open)

Data: location `proximity` (capital 100), `local_proximity_propagation` (2877: 41.86119 — a per-location cost term,
~ land_cost 40 adjusted by terrain/development), `road_to_capital`; country `proximity_persistent_cache = { <id> =
{ proximity_parent = <id> sea_zone_proximity = x } ... }` (690 entries for Spain; the ids seen are sea zones).
Proximity sources: `capital` local_proximity_source 100, `historical_capital` 80, the Local Governor building
(capped by `num_local_governors`, base 1 in country_base_values; building definition not read — open),
`local_proximity_source_modifier` (14f0a3746).

Cost function FUN_1427175b0 (15 KB; PROXIMITY_TERRAIN_SPEED_FLOOR reader). Tooltip labels: PROXIMITY_BASE
("$BASE$: $VAL$"), PROXIMITY_BASE_WITH_BREAKDOWN, PROXIMITY_ROAD_TYPE ("[ROAD_TYPE]: $VAL$"),
PROXIMITY_BASE_MARITIME_MULTIPLIER ("Multiplied by $VAL$ from maritime presence"), EMBARKING_TO_DIFFERENT_SEA_ZONE /
LANDING_TO_DIFFERENT_SEA_ZONE (red: extra cost when the embark/landing crosses sea zones), PROXIMITY_ADJACENT_DISTANCE
("Segment cost (A->B) is $DISTANCE$ due to: ..."), PROXIMITY_NO_PATH_FOUND. Modifiers read: land_cost_on_distance_from_capital
(14f0a35da), local_port_cost_distance_impact (3744), local_distance_from_capital_speed_propagation (3742),
land_cost_on_distance_from_capital_speed_propagation (373e); per-topography country modifiers
`<topography>_proximity_impact` (percent; flatland/mountains/hills/plateau/wetlands/ocean/... in modifier_types) via
the topography object's modifier index (topo+0x158).

What the decompile shows (land branch, `code` but incompletely decoded):
```
terrain = topographyBase(from,to) x (1 + country.<topography>_proximity_impact)     (only the negative part is kept)
speed   = max(NCountry.PROXIMITY_TERRAIN_SPEED_FLOOR 0.25, 1.0 + min(terrain, 0))
cost    = base_cost / speed                       base_cost = land 40 (road type replaces it: road 20; sea 30 / 5 when
                                                  maritime; port 35; sea-land transition 35; upstream/downstream 12;
                                                  frozen water 20 — country_base_values)
cost   += per-location extra (location array at +0x468 indexed by country slot; likely local_port_cost_distance_impact)
speedprop = country.global_distance_from_capital_speed_propagation + location.local_distance_from_capital_speed_propagation
            (development gives 0.005 x development; chi_grand_canal +0.2; lack_of_conciliar_justice -0.25 ...)
cost    = max(0.01, cost x max(0.05, factor) / (0.125 + max(-0.95, speedprop)))   <- the 0.125 constant (0x30d4) and
          `factor` (1.0 on land) are read literally from the decompile and NOT verified; treat as open
proximity[to] = proximity[from] - cost   (propagation from the nearest source; PROXIMITY_LIST_TITLE "proximity ... to
          the nearest source is X% due to:"), 0 if no path
```
Open: exact combination, how `local_proximity_propagation` is derived (test: does proximity[child] = proximity[parent]
- propagation[child] or - propagation[parent]?), sea-zone handling (`sea_zone_proximity`), road types. Adjacency is
not in text form (`map_data/locations.png` + `nodes.dat`; `adjacencies.csv` only lists special crossings).

---------------------------------------------------------------------------------------------------------------

## 5. Development / prosperity — NOT DONE (open)

Pointers: static modifiers `prosperity` -> local_monthly_development 0.004 (x prosperity), `development` scales
(local_max_rgo_size 0.1, local_distance_from_capital_speed_propagation 0.005, local_population_capacity_modifier
0.025 ...), `location_base_values` local_monthly_prosperity 0.0025, `global_prosperity_decay` 0.01 (country base),
`NLocation.PROSPERITY_MIN/MAX` -1/1 (readers FUN_14313de00 710 B and FUN_1431713b0 707 B — probably the monthly
prosperity change/clamp; decompile these first), modifier types local/global_monthly_development(_modifier),
local/global_monthly_prosperity, local/global_prosperity_decay (indices via `node peek.js modmap 144c840f0 900000`).
Food is owned by the food agent.

---------------------------------------------------------------------------------------------------------------

## 6. Mod (Ars Belli) overrides that touch this area

- `main_menu/common/static_modifiers/abm_location_changes.txt`: `REPLACE:control` keeps vanilla's
  local_trade_protection_factor 0.50 and local_peasant_enfranchisment 0.50 and adds local_mercenaries_modifier -0.50;
  `REPLACE:control_50 = {}` removes vanilla's local_mercenaries_modifier -1.0. No effect on the formulas above.
- `in_game/common/age/00_default.txt`: only `lack_of_control_impact_on_warscore` changed; age `efficiency` (PE level
  multiplier) is vanilla.
- `in_game/common/auto_modifiers/abm_country.txt` INJECT:country_base_values adds fort_limit/mercenary_range/
  supply_depot_capacity only; tax/control/enfranchisement bases are vanilla.
- No mod changes to estates (abm_estates.txt is empty), pop types (soldiers REPLACE keeps peasants_estate),
  location ranks (fort_limit only), production methods (adds three new maintenance PMs), defines (NEconomy
  LOAN_MAX_INTEREST only). `in_game/common/prices/abm_prices.txt` and `town_setups` were not inspected (open).

## 7. Open questions (unverified / not reached)
1. F = 1.2475 in paid_taxes: is it (1 + tax_income_efficiency) alone or with the "Estate Enrichment" term; itemise
   Spain's tax_income_efficiency sources (script `eco_tmp/spain_mods.js` is written but was not run).
2. Spain's +37.32% raw-material output and the per-good extras (lead/wool/silk/tin/clay/sugar) — which modifiers.
3. Where `<good>_output_modifier` enters building output (not in FUN_142435ec0); lumber_mill 59% / scriptorium 27%.
4. Current age in the 1547 save (age 3 vs 4) to fix the level-term multiplier; then re-derive Spain's base PE.
5. Upkeep multiplier 0.39 vs 0.41 (building_upkeep_efficiency or year count).
6. Max RGO size formula vs save (2877: 16 levels).
7. Burgher trade amount (TRADE_BURGHER_PROFIT_SCALE 0.1; FUN_143225be0).
8. Proximity cost function (section 4), Local Governor building, sea-zone proximity, adjacency source.
9. Where the monthly control change is applied/clamped (callers of FUN_1430edf80: FUN_1430edd60 is a debug
   formatter; FUN_1441776e0 is UI).
10. Development and prosperity monthly change (section 5).
11. `value_flow` location field; whether foreign-owned producing buildings count toward wealth.

## 8. Function / address index (eu5.exe 1.4.4)
- FUN_142fbdd30 GetPeasantEnfranchisement (clamp MIN 14faf97a0 / MAX 14faf9798); callers 143219360, 142fb9be0,
  143d76e00 (country average), 1463adc00, 147106230.
- FUN_143219360 location wealth -> estate split; FUN_143219df0 pays an estate; callers 1425cf110 (buildings),
  14321b560 (market/RGO), 1432225e0.
- FUN_142f9ab10 estate "enfranchised income" tooltip (ENFRANCHISED_INCOME_*); FUN_14278f860 country-level split.
- FUN_1430ed2f0 GetMaxControl; FUN_1430edf80 GetMonthlyControlChange (MONTHLY_CONTROL_DECAY 14fb064c0).
- FUN_1427175b0 proximity cost (PROXIMITY_TERRAIN_SPEED_FLOOR 14faf9760).
- FUN_142435ec0 building production efficiency (PRODUCTION_EFFIENCY_BONUS_PER_LEVEL 14fb20db8; modifiers
  local/global_production_efficiency 14f0a38c6/38c8, raw_material_in_province_impact 14f0a38d0).
- FUN_142584020 / FUN_143155870 RGO expansion cost (GOODS_RGO_BASE_COST 14fb24c70, GOODS_RGO_PRICE_SCALE 14fb24c78).
- FUN_1428ba910 reads LOW_CONTROL_THRESHOLD_FOR_BEST_TAX (not decompiled).
- Decompiles: `locsim_eco\enfranch.c`, `control_prox_rgo.c`, `maxcontrol_prodeff.c`, `apply_control_wealthsplit.c`.
