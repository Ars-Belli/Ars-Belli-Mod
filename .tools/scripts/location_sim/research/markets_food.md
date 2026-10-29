# EU5 1.4.4 markets and food: formulas for the location/country simulator

Research stopped early (usage limit). **Goods price is fully decoded and checked against the save. Food and demand are only partly done.** Each line carries a tag:
- `code`: read in a decompile of eu5.exe 1.4.4
- `tooltip`: named by a loc key the code uses
- `save-checked`: reproduces numbers in `SP_SPA_1547_04_01` (debug text save, Ars Belli)
- `inferred`: a guess that has not been verified

Fixed-point notes: the engine uses CFixedPoint with 100000 = 1.0. Products are truncated to 1e-5, which does not matter at our precision.

Ars Belli does not override any NMarket, NEconomy or NPop define, or the age price settings (`in_game/common/age/00_default.txt` is the same as vanilla for these keys). Its only food-related defines are army ones: `NUnit.DEPOSIT_FOOD_FRACTION = 0.5` and `SUPPLY_DEPOT_FOOD_FRACTION = 0.5`. Neither touches markets.

Decompiles are in `E:\Tools\ghidra-projects\locsim_market\` (Ghidra project `eu5_144d`):
- `price1.c`: target, effective supply, effective demand, % change, monthly loop, stockpile bleed, elasticity
- `newprice.c`: new price plus its tooltip
- `food1.c`: market tick, food distribution, province food exchange, market capacity, food-price change
- `decay_disasm*.txt`: market food decay

Scratch scripts and data are in `...\scratchpad\research\market_tmp\`:
- `check_all.js`: fits every market in the save
- `check_price3.js`: checks one market
- `save\markets.json`: market_manager parsed
- `save\provinces.txt`: provinces section
- `fit_results.json`

---

## 1. Goods price (fully decoded; save-checked on 11,870 of 11,875 market-goods)

### 1.1 Monthly step
```
p_new = p + MONTHLY_PRICE_CHANGE * (T - p)          NMarket.MONTHLY_PRICE_CHANGE = 0.05      [code, save-checked]
```
- `p` is the stored current price (goods entry +0x50). It falls back to the good's `default_market_price` (goods +0x3e8) when unset. [code]
- Where it runs: `FUN_14322f410` (new price, plus its tooltip). It is called per good from the market loop `FUN_14322ded0`. [code]
- The loop then:
  - stores the price (when it equals the default, it clears the flag at +0x58)
  - appends it to `history` (at most 119 entries; the oldest is dropped) [code]
  - writes `impact` (§1.6) [code]
- The callers of `FUN_14322ded0` are the market monthly tick `0x1425bfcd0` / `0x143248390` and `0x143e6ef20`. [code]
- **Tick order (save-checked):** the supply and demand stored in the save reproduce the *last* history step exactly. Within the monthly tick, supply and demand for the month are therefore computed first, then the price is updated from them. To check a save, use: implied target = `h[-2] + (h[-1] - h[-2]) / 0.05`.

### 1.2 Target price `T`: `FUN_143240930(entry, out, age, extraS, extraD)`
```
S = EffectiveSupply(entry) + extraS          (extraS = extraD = 0 in the monthly tick; non-zero only for what-if callers, e.g. AI/build previews)
D = EffectiveDemand(entry) + extraD
if S <= 0 and D <= 0:  T = default_market_price                                           [code]
if good.food > 0 and market.food_price > NMarket.FOOD_PRICE (0.05):                       [code, save-checked]
      D = D * (1 + NMarket.FOOD_PRICE_IMPACT_ON_PRICES)     # 0.25 -> D x1.25 for all food goods (goods with food = > 0)
Sp = S + NEconomy.SUPPLY_AND_DEMAND_STABILITY_OFFSET_CONSTANT   # +1                      [code]
Dp = D + 1
k  = min(age.price_stability, 1)                                                          [code, save-checked]
R  = (k*Sp + Dp) / (k*Dp + Sp)                 # -> k at overwhelming supply, 1/k at overwhelming demand   [code, save-checked]
R  = clamp(R, age.min_price, age.max_price)                                               [code, save-checked]
R += NMarket.TARIFF_PRICE_IMPACT (0.25) * tariff(owner, good) * (1 + tariff_impact_on_price(owner))   [code; not seen in save]
T  = default_market_price * R                                                             [code, save-checked]
```

`market.food_price` is the market's own `price=` field in the save (market +0x88; for example `0.01019` in market 13).
- All 21 markets in the save with a food price above 0.05 need the x1.25 factor to fit, and all the others must not have it. [save-checked]

Age values (`in_game/common/age/00_default.txt`; vanilla and mod are the same):

| age | price_stability `k` | max_price |
|---|---|---|
| 1 traditions | 0.10 | 3 |
| 2 renaissance | 0.10 | 3 |
| 3 discovery | 0.08 | 4 |
| 4 reformation (the save) | 0.06 | 5 |
| 5 | 0.04 | 5 |
| 6 | 0.02 | 5 |

Notes on the clamp and the tariff term:
- **`min_price` = 0.1**: fitted from the save, not read from code. Several goods sit at exactly T = 0.1 x default:
  - market 89 gems, 105 gems, 85 medicaments, 84 saffron
  - 167/168 elephants, 175 jewelry
  - The age has a `min_price` key; its string is in the exe, but no age file sets it, so 0.1 is presumably the engine default.
  - The clamp offsets are age +0x180 (min) and +0x188 (max); +0x178 is `price_stability`. [code + save-checked]
- **max clamp**: market 13 tea, R = 5.84 -> 5, T = 15.00 = implied. [save-checked]
- **Tariff term**:
  - `tariff()` comes from `FUN_14274e4f0(country of the market-center owner, good)`, which was not decoded. It is presumably the per-good trade-policy rate: tariff +0.10/+0.25/+0.50, subsidy -0.10/-0.20/-0.35 (NCountry.TRADE_POLICY_*). [inferred]
  - The modifier is `tariff_impact_on_price` (country; the market-center owner). [code]
  - The term is added **after** the clamp, so tariffs can push past max_price. [code]
  - No market in this save needed a tariff term.
  - Tooltip keys: `PRICE_TOOLTIP_TARIFF_IMPACT`, `PRICE_TOOLTIP_SUBSIDY_IMPACT`, `..._BREAKDOWN` ("Base Price Impact: xBASE, Policy Rate: PERC").
- Tooltip keys: `PRICE_TOOLTIP` ("Monthly Change: STEP / target price TARGET due to: Base price BASE, effective supply SUPPLY, effective demand DEMAND, price stability STABILITY") and the concepts `target_price` and `price_stability` ("determined by the current age"). [tooltip]

### 1.3 Effective supply: `FUN_14322ef30`
```
S_eff = max(0, supply
             - (1 - BURGHER_TRADE_IMPACT_ON_SUPPLY_SCALE) * BTin        # 1 - 0.25 = 0.75
             - (1 - TRADE_IMPACT_ON_SUPPLY_SCALE)         * Tin         # 1 - 0.75 = 0.25
             - TRADE_IMPACT_ON_SUPPLY_SCALE   * min(Tin,  Tout)         # transit trade removed completely
             - BURGHER_TRADE_IMPACT_ON_SUPPLY_SCALE * min(BTin, BTout)
             + STOCKPILE_TRADE_IMPACT_ON_SUPPLY_SCALE (0) * extra_supply_from_stockpile)      [code, save-checked]
```
- The scales are fixed. Supply has no country modifier. [code]
- Tooltip: `PRICE_TOOLTIP_SUPPLY_BREAKDOWN` ("Local Supply / BG_EFF% of burghers importing / TRADE_EFF% of Trade Imports / STOCKPILE_EFF% of extra supply from stockpile"). [tooltip]

### 1.4 Effective demand: `FUN_14323b110`
```
v  = export_impact_on_demand (country modifier of the market-center owner)                [code]
bS = clamp(BURGHER_TRADE_IMPACT_ON_DEMAND_SCALE (0.25) * (1 + v), 0, 1)
tS = clamp(TRADE_IMPACT_ON_DEMAND_SCALE       (0.75) * (1 + v), 0, 1)
D_eff = max(0, demand
             - (1 - bS) * BTout - (1 - tS) * Tout
             - tS * min(Tout, Tin) - bS * min(BTout, BTin))                               [code, save-checked]
```
- Tooltip: `PRICE_TOOLTIP_DEMAND_BREAKDOWN`. [tooltip]
- Where `v` comes from:
  - It is mostly the societal value `mercantilism_vs_free_trade`, whose left side gives `export_impact_on_demand = 0.1` at full mercantilism, scaled by position/100.
  - Spain has `-28.6`, so v = +0.0286. That is exactly what market 13 needed (fit 0.0285).
  - Some laws and reforms add +0.05.
  - [save-checked; the scaling with position is inferred from the fit]

### 1.5 Save field mapping (goods entry)

| save field | engine offset | meaning |
|---|---|---|
| `supply` | +0x28 | sum of `supplied{}` |
| `demand` | +0x30 | sum of `demanded{}` |
| `supplied.BurgherTrades` = BTin | +0xa0 | |
| `supplied.Trade` = Tin | +0xa8 | |
| `demanded.Trade` = Tout | +0xe0 | |
| `demanded.BurgherTrades` = BTout | +0xe8 | |
| `extra_supply_from_stockpile` | +0x78 | |
| `stockpile` | +0x80 | |
| `price` | +0x50 | |
| `impact` | +0x20 | |
| `history` | +0x190 | count at +0x19c |

[code + save-checked]

### 1.6 `impact` field (feeds the market `impacts={}` construction/maintenance cost factors, not the price)
```
impact = clamp(price / default_market_price - 1, NMarket.MIN_PRICE_IMPACT (-0.33), NMarket.MAX_PRICE_IMPACT (3.0))   [code, save-checked]
```
- Clay: 0.6324 / 0.5 - 1 = 0.2648.
- Medicaments: 0.4466 / 1 - 1 = -0.553, clamped to -0.33. Both match the save.

### 1.7 Pop-demand price elasticity: `FUN_14323fdb0`
```
elasticity = clamp(1 - DEMAND_ELASTICITY_COEFFICIENT (0.40) * (p / default - 1), DEMAND_ELASTICITY_FLOOR (0.35), 1.0)   [code]
```
- It is capped at 1, so cheap goods do not raise demand.
- Tooltip `PRICE_TOOLTIP_POP_DEMAND_SCALE`: "Due to price, pop demands: X%". [tooltip]
- The call sites that multiply pop demand by it are `0x14334bfe0` and `0x143352900`, which were not decompiled. It probably applies only to `Pops` demand. [inferred]

### 1.8 Stockpile bleed (`extra_supply_from_stockpile`): `FUN_143241460`
```
cap   = maximum_stockpile_capacity   (modifier read via market-center owner; sources: market-center building
         maximum_stockpile_capacity 20/30/50/75/100 (market_buildings.txt), static location modifier 5, event building 50)
ratio = stockpile / cap ; pct = clamp(MARKET_STOCKPILE_PERCENTAGE_FOR_EXTRA_TRADE (0.05), 0, 1)
if ratio > MIN (0.5):  extra = pct * stockpile * clamp((ratio - 0.5) / (max(FULL 0.75, 0.5) - 0.5), 0, 1)
elif previous extra > 0 and ratio > MIN - 0.1 (0.4):   extra = pct * stockpile * min(1, (ratio - 0.4) / 0.1)   # hysteresis
else extra = 0                                                                            [code, save-checked]
```
- Market 13 checks:
  - clay/coal: stockpile 327.698, giving 16.3849 (matches the save).
  - salt: 327.558, giving 16.3779 (matches).
  - tin: 319.788, giving 15.9894 (matches).
  - silk: 204.185, so ratio 0.623, frac 0.492, giving 5.027 (save 5.0262).
- The cap equals the full stockpile, 327.698 in Spain's market 13. Which modifier set carries it (owner country +0x4f0) is not fully pinned down.
- With STOCKPILE_TRADE_IMPACT_ON_SUPPLY_SCALE = 0 the bleed **does not enter the price**. It only feeds trade routing. A simulator can ignore it for prices.

### 1.9 Worked checks (market 13, Sevilla, age 4, k = 0.06, v = 0.0286)

**Clay** (default 0.5):
- supply 65.26203 = Production 49.14484 + BurgherTrades 16.11719; demand 65.26203 (Building)
- S_eff = 65.26203 - 0.75 x 16.11719 = 53.17414; D_eff = 65.26203
- R = (0.06 x 54.17414 + 66.26203) / (0.06 x 66.26203 + 54.17414) = 69.51248 / 58.14986 = 1.19540, so T = 0.59770
- p = 0.63422 + 0.05 x (0.59770 - 0.63422) = 0.63239. **Save: 0.6324.** ✔

**Silk** (default 4; exports):
- demand 33.60229 = Building 19.22891 + BurgherTrades 9.69506 + Trade 4.67832; supply 33.60229 (RGO)
- bS = 0.25 x 1.0286 = 0.25715; tS = 0.77145
- D_eff = 33.60229 - 0.74285 x 9.69506 - 0.22855 x 4.67832 = 25.33109
- R = (0.06 x 34.60229 + 26.33109) / (0.06 x 26.33109 + 34.60229) = 28.40723 / 36.18216 = 0.78512, so T = 3.1405
- **Implied target from history: 3.1405.** ✔ With v = 0 it gives 3.1226, off by 0.6%. That is how `v` was identified.

**Tea**:
- D = 7.889 (Pops), S = 0, so R = 8.949 / 1.533 = 5.84, clamped to 5, T = 15.00. **Implied: 15.000.** ✔

**Gems, market 89**:
- Tin 153.55, so S_eff = 115.16; D = 0.5675; R = 0.073, clamped to 0.1, T = 0.400. **Implied: 0.4000.** ✔

**Whole save**: 182 markets, 11,875 goods with history, fitting one `v` per market. 11,870 match within 0.0006 x default. The 5 misses are markets 50 (lumber, masonry) and 73 (lumber, cloth, masonry), off by 0.3-0.9%. All have large `Construction`/`Units` demand that probably changed between the price step and the save write (construction started or ended mid-tick). [save-checked]

---

## 2. Supply (partly)
- `supplied={ Production, BurgherTrades, Trade }`; supply = their sum. [save-checked]
- `production_supplied={ Base, RawMaterials, Buildings }` sums exactly to `Production` (clay: 4.81232 + 31.41062 + 12.9219 = 49.14484). [save-checked]
  - RawMaterials = RGO output; Buildings = production-method outputs.
  - `Base` = goods `base_production` x something; the scale was not decoded (clay `base_production` 0.01). **Open.**
- **Observation**: for imported goods, BurgherTrades in = exactly demand - production (clay 65.26203 - 49.14484 = 16.11719; coal the same), so burgher imports fill the gap up to demand. The volume/limit logic was not decoded (`0x143225be0`, 21.7 KB, uses MARKET_FOOD_STOCKPILE_TRESHOLD_MONTHS and MARKET_MIN_FOOD_STOCKPILE_RATIO_FOR_BURGHER_TRADE). **Open.**
- **Market access**: not decoded. Defines MARKET_BASE_DISTANCE_FACTOR etc. are read in `0x143160620` / `0x143162200`. **Open.**

## 3. Demand (mostly open)
- `demanded={ Pops, Building, Construction, Units, Roads, Trade, BurgherTrades, Consumption, ... }`; demand = their sum. [save-checked]
- `taken={...}` = what was actually delivered. Building and Construction are rationed when the stockpile plus supply run short (clay: taken.Building 57.39 of 65.26). The rationing order and priority (market access? the `priority=` field?) **were not decoded. Open.**
- Pop demand inputs (data only; formula not decoded, **open**):
  - goods `demand_add {all, <pop type>, upper}` and `demand_multiply {...}`
  - `goods_demand/pop_demands.txt` per-good weights (wheat 0.75, fruit 0.5, the rest 1)
  - `winter/climate/continent/topography_demand_modifier`, `no_demand_if_no_market_availability`, `wealth_impact_threshold`
  - defines `NPop.DEVELOPMENT_SCALE_ON_DEMAND 0.05`, `POP_NEEDS_INCOME_SCALE 1.33`, `PRODUCED_IN_MARKET_DEMAND 0.1`, `STARVING_ON_FOOD_DEMAND 1.5`, `NEGATIVE_FOOD_ON_FOOD_DEMAND 0.5`, `NEstate.POP_DEMAND_DEFICIT_SCALE 0.5`
  - plus the elasticity in §1.7
  - The functions are `0x14334bfe0` (10.8 KB) and `0x143352900` (6.2 KB); both read all of these defines.
- Other demand categories in `goods_demand/`: `army_demands.txt`, `navy_demands.txt`, `building_construction_costs.txt`, `hardcoded.txt` (road_maintenance lumber 0.02 / masonry 0.02 / sand 0.01; bureaucracy_maintenance), `special_construction_demands.txt`, `religious_orders.txt`, `from_events.txt`. How they scale is **open**.

## 4. Food (partly decoded)

### 4.1 Market food capacity (`max`) [code]
`FUN_14322dae0`; it is also accumulated in `FUN_14333e040`:
```
market.max_food (+0x68) = sum over provinces whose CAPITAL location is a member of the market of
                          NMarket.FOOD_CAPACITY_FACTOR (1.0) * province.max_food_value (+0x5c0)
```
Not yet checked against market 13 `max = 180021.711`.

### 4.2 Province <-> market exchange, monthly per province: `FUN_14333e040(province, monthlyChange)` [code]
- **Condition**: the market of the province capital is valid, and `FUN_143320050(province, market, 0)` is true (the check was not decoded; probably whether the province may trade food with that market).
- **Sell**:
  - `reserve = FOOD_PROVINCE_LOCAL_RESERVE_RATIO (0.75) * max_food_value`
  - if `current > reserve`: `surplus = current - reserve`
    - market food (+0x60) += surplus
    - market +0x30 and +0x40/+0x48 (monthly in/supply counters) += surplus
    - province `trade` (+0x5d8) = -surplus
    - province `current` = reserve
    - the province goes on the market's seller list (+0x12a70)
- **Buy request**: only if `current <= reserve` and `monthlyChange < 0`:
  - `threshold = max(FUN_14285cc70(province) /* target, not decoded */, reserve)`
  - if `current < threshold`: `wanted (+0x5e0) = max(-monthlyChange, <callback value>)`
    - the province goes on the buyer list (`FUN_143239c70`)
    - market +0x80 += wanted x (country +0x44d8, unknown factor)
  - otherwise, if `current < max`, the province goes on the "can absorb" list (`FUN_143239d80`) for pass 2.
- `FUN_14285ddb0` returns the province's food demand on the market: `wanted` if set, otherwise the same deficit test.
- Save fields `food={month demand last current}`, `cached_food_change`, `cached_structural_food_change`, `trade`, `wanted`, `food_consumption`, `base_food_consumption`: only partly matched. Example:
  - bolghar has current = max = 500 and trade = -48.23 = cached_food_change. That means the monthly change is added **after** selling, or a later pass refills provinces.
  - **The exact order and the meaning of `month`/`demand`/`last` are open.**

### 4.3 Market distribution: `FUN_1432365b0` (13 KB, only the start and end read)
1. **Market food decay** [code; result surprising]:
   - `rate = (local_food_decay(center location) + global_food_decay(center owner)) / (1 + max(0, local_food_preservation_efficiency_modifier(center)))`
   - `delta = min(0, rate * market.food)`, then market.food += delta (also +0x30, +0x48).
   - The compiled code keeps only **negative** products (`sar 63; and`, with a positive /100000 magic). Normal rates are positive: auto_modifier `global_food_decay = 0.005`, climate `local_food_decay` 0.001-0.002, static location 0.0025. So as compiled, **market food never decays**.
   - Confirm with two consecutive saves before modelling decay. **Open.**
2. Three passes (`i = 0..2`) over the seller list (+0x12a58) and the buyer list (+0x12a70). They use FOOD_PROPORTION_TO_PRESERVE_IN_MARKET_IF_POSSIBLE 0.25 and FOOD_PASS2_MAX_MONTHS_OF_DEFICIT 3.0. **The body was not read. Open.**
3. Then:
   - market.food = clamp(market.food, 0, max)
   - provinces with `current < 1` (or a related negative-balance test on province +0x5b8/+0x5d0/+0x5d8) are collected into a list (+0x12a88), probably the starving ones
   - the food price update: `market.price (+0x88) += FUN_1431fd1d0(market)`. It reads MONTHLY_PRICE_CHANGE and FOOD_PRICE 0.05. It is decompiled in `food1.c` (lines 3290-3766) but **not analyzed. Open.**

### 4.4 Not reached [open]
- Location food production: RGO `food` x output, `local_monthly_food(_modifier)`, `local_food_production_mult`, `SUBSISTENCE_AGRICULTURE 0.8`. Probably `0x1430f3300` / `0x143155bd0`.
- Consumption: `pop_food_consumption` x pop size, `global/local_pop_food_consumption`.
- Province capacity (`local/global_food_capacity(_modifier)`, `NCountry.REGIONAL_FOOD_BASE_CAPACITY 100`, unused-looking).
- Who pays for food bought or sold (FOOD_PRICE).
- Starvation (`province_starving` static modifier).
- The growth terms (`food_surplus_growth_term`, `food_storage_growth_term`; NEconomy.GROWTH_FROM_FOOD_* in `0x14333e6a0`; NPop FOOD_*_POP_GROWTH in `0x14331d150`). These belong to the population agent.
- No province food balance was reproduced.

## 5. External trade
- Trades show up only through the four flows in §1.3/§1.4: `supplied.Trade` / `demanded.Trade` (merchant trades, 75% weight on the side they enter) and `supplied.BurgherTrades` / `demanded.BurgherTrades` (25% weight). A flow matched in and out (transit) is removed completely. [code, save-checked]
- The export weight grows with the owner's `export_impact_on_demand`.
- Per-country details sit in `last_month_trade_supply_by_country` / `last_month_trade_demand_by_country`.
- Trades are processed daily (`NAI.TRADE_MARKETS_PER_DAY = 1`), so the saved flows can differ slightly from those at the monthly price step. [inferred]

## 6. Capacity
- Goods stockpile cap: see §1.8. How the stockpile itself moves (probably `stockpile += supply - total_taken`, clamped to [0, cap]) is **open / inferred**.
- Market food capacity: see §4.1.

---

## What a simulator needs (prices; food is still open)

**State**
- per market per good: `p`, `default`; this month's supply parts `Production` (RGO + buildings + base), BTin, Tin; demand parts (Pops, Building, Construction, Units, Roads, ...), BTout, Tout; `stockpile`
- per market: `food_price` (for the x1.25 food-goods rule)
- per market owner: `v` = export_impact_on_demand, per-good tariff rate, `tariff_impact_on_price`
- per age: `k`, `min = 0.1`, `max_price`

**Monthly order** (the price step uses this month's supply and demand) [save-checked]
1. compute production and demand
2. S_eff, D_eff (§1.3/§1.4)
3. D x1.25 if the good is food and food_price > 0.05
4. T (§1.2)
5. `p += 0.05 (T - p)`
6. `impact = clamp(p/p0 - 1, -0.33, 3)`
7. stockpile and bleed (cosmetic for price)

**Modes**
- *Markets off / closed*: BTin = Tin = BTout = Tout = 0, so S_eff = local production and D_eff = local demand.
- *Fixed external trade*: hold the four flows at the save values (or user values). They enter at the fixed weights above. The weights do not depend on price, so holding them constant is consistent.

## Open questions (priority order)
1. Pop demand formula (`0x14334bfe0`, `0x143352900`): base per pop, development scale, income scale, the produced-in-market rule, starvation and negative-food demand, where elasticity applies.
2. Food: location production and consumption, the three-pass distribution body, the order of sell vs adding the monthly change (bolghar), the food price (`FUN_1431fd1d0`), who pays.
3. Whether market food decay is really disabled (needs two consecutive saves).
4. Rationing of `taken` vs `demanded`; burgher trade volume; the scale of `production_supplied.Base`.
5. `min_price` = 0.1 read from code (age offset +0x180) and `FUN_14274e4f0` (tariff rate).
6. Market access formula.
