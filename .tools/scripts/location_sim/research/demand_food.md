# EU5 1.4.4 pop demand, building demand and food: formulas for the location/country simulator

Continues `markets_food.md` (goods price, decoded and save-checked there; not
repeated here). Tags per line:
- `code`: read in a decompile of eu5.exe 1.4.4 (Ghidra project `eu5_144d`)
- `tooltip`: named by a loc key the code prints
- `save-checked`: reproduces numbers in `SP_SPA_1547_04_01` (debug text save, Ars Belli, Spain 1547)
- `inferred`: my reading, not verified

Fixed point: 100000 = 1.0 everywhere (products truncated to 1e-5).

Decompiles (all in `E:\Tools\ghidra-projects\locsim_market\`):
- `popdemand1.c`: FUN_14334bfe0 (pop needs tooltip), FUN_143352900 (pop demand per good), FUN_1433543f0, FUN_14333cf60 (province monthly food)
- `popdemand2.c`: FUN_143354130 (store pop demand list), FUN_14285cc70 (province food change), FUN_143336030 (province food capacity), FUN_14333dd90 (unit food draw), FUN_143336b00 (apply monthly food change), job runners
- `foodloc1.c`: food lambdas 143fd7f60/7680/77c0/7480, FUN_1430f3300 (location food production)
- `foodloc2.c`: FUN_143155d80 (RGO food), FUN_143155020 (subsistence workers), FUN_14310c7e0 (location food change),
  FUN_1430f24a0 (pop food consumption), FUN_142400f90, lambda 143fd7920 (location food capacity)
- `foodloc3.c`: FUN_1430b8b60 (RGO workers), FUN_1430f17f0 (food decay), FUN_142db0d80 (method output), FUN_1431fd1d0 (food price)
- `mkt2.c`: FUN_1425d4990 (trade execution), FUN_1425d5600 (stockpile clamp / caches), FUN_143320050; `lists.c`:
  FUN_143239c70 / FUN_143239d80 (buyer / seller lists)
- `food1.c` (earlier): market tick FUN_143248390, distribution FUN_1432365b0, exchange FUN_14333e040, capacity FUN_14322dae0, FUN_14285ddb0, food price FUN_1431fd1d0, FUN_1425cb220, FUN_143155bd0

Scratch (scripts + extracted save tables): `C:\Users\Doru\AppData\Local\Temp\claude\E--Modding-EU5-Ars-Belli-Mod\cb62676a-535b-42c1-9468-827d53a25fcb\scratchpad\research\food_tmp\`
(`locs.json` all 28,573 locations, `pops.json` all 241,038 pops, `goods_full.json` all goods keys).

---

## 1. Pop demand

### 1.1 Per-pop demand vector: `FUN_143352900(pop, out_list)` [code]
For every good in the `pop_demand` goods list (game +0x10b0; the goods of `goods_demand/pop_demands.txt`), per 1000
pops of the pop (the tooltip header `POP_GOODS_TT_PREFIX` "For every [POP.GetNeedsScaling] pops of [type]"):
```
loc = pop.location ; prov = loc.province ; market = loc.market ; owner = loc.owner (country)
w   = estate(pop).wealth_impact          (FUN_1425c8d00 -> estate, field +0x1d8; save `wealth_impact`)
dev = loc.development (+0xd08)
for each good g:
  b = base[g][pop.type]                                     (good +0x390, per pop-type array; 1.2)
  skip if g.development_threshold > dev                    (good +0x3c0; tooltip POP_ONLY_IF_DEVELOPMENT)
  skip if max(0,w) < g.wealth_impact_threshold[type or all] (good +0x3a8; HARD gate, tooltip POP_WANT_IF_WEALTH)
  P = market.goods[g].supplied.Production (+0x98)         ("produced in this market")
  if g.no_demand_if_no_market_availability and P == 0: skip
  if P == 0: demanded only if owner.known_goods[g] (country +0x4d0 map) > age.known_goods_demand_threshold
             (age +0x1b8: 100/80/60/40/20/10 for ages 1-6); then flag "unavailable"
  d = b
    * (1 + relgroup.goods_demand_modifier[g]) * (1 + religion.goods_demand_modifier[g])          POP_DEMAND_FROM_RELIGION
    * (1 + culture.goods_demand_modifier[g]) * PROD over culture groups (1 + group.goods_demand_modifier[g])
                                                                                                   POP_DEMAND_FROM_CULTURE
    * [clergy only] (1 + relgroup.clergy_goods_demand_modifier[g]) * (1 + religion.clergy_goods_demand_modifier[g])
                                                                                                   POP_DEMAND_FROM_CLERGY
    * (1 + Location_map[g])                       (location +0xf30; winter/climate/topography/region/... 1.3)
                                                                                                   POP_DEMAND_FROM_LOCATION
    * [if g.literacy_demand_factor] literacy_demand_factor * pop.literacy / 100                   POP_DEMAND_FROM_LITERACY
    * (1 + global_<g>_pop_demand(owner))          (country per-good modifier, cached at country +0x2f20)
                                                                                                   POP_DEMAND_FROM_COUNTRY
    * [if unavailable] g.market_unavailability_demand_modifier                                    POP_DEMAND_FROM_MARKET_UNAVAIL
    * [if loc+0xac0 > 0 (disease present)] g.disease_demand_modifier                              POP_DEMAND_FROM_DISEASE
    * (1 + NPop.DEVELOPMENT_SCALE_ON_DEMAND (0.05) * dev)                                         POP_FROM_DEV
    * (1 + global_pop_demand(owner)) * (1 + local_pop_demand(loc))
    * [if w < 1] (1 - NEstate.POP_DEMAND_DEFICIT_SCALE (0.5) * (1 - w))                           POP_DEMAND_FROM_ESTATE_DEFICIT
    * clamp(1 - DEMAND_ELASTICITY_COEFFICIENT (0.4) * (p / default_market_price - 1), FLOOR 0.35, 1)  POP_FROM_MARKET_SCALE
          (p = market price of g at the time of the computation, i.e. BEFORE this month's price step)
    * ( 1 + [g.food > 0] * ( starving(prov) ? STARVING_ON_FOOD_DEMAND 1.5
                             : prov.structural_food_change < 0 ? NEGATIVE_FOOD_ON_FOOD_DEMAND 0.5 : 0 )
          + [P > 0] * PRODUCED_IN_MARKET_DEMAND 0.1 )          POP_FROM_STARVING / POP_FROM_LOW_FOOD / POP_FROM_LOCAL_PRODUCED
  if d != 0: append (g, d) to the pop's list (pop +0xd8, stored by FUN_143354130)
demand of the pop for g = d * pop.size  (size in thousands; the tooltip FUN_14334bfe0 multiplies list value x pop+0xe8)
market demanded.Pops[g] = SUM over pops of the market's locations of d * size
```
- Field identification: the factor order and every define/modifier are `code`; that +0x1d8 is the estate's
  `wealth_impact`, pop +0xf0 its literacy, country +0x2f18 the cached `global_pop_demand`, age +0x1b8
  `known_goods_demand_threshold` and +0x3c0/+0x3a8 the development/wealth thresholds is `inferred` from the tooltip
  keys, the define comment ("At wealth-impact = 0, demand is multiplied by 1 - POP_DEMAND_DEFICIT_SCALE") and the save fits.
- The goods' multiplier maps hold `value - 1`: a file value `tea = 2` doubles demand, `wine = 0` removes it. [save-checked:
  maghrebi_group `tea = 2` -> moroccan/andalusi pops have x2.03-2.13 the per-pop tea of Castilian pops in market 13
  (the rest is the price lag of 1.4); muslim group `wine/beer/liquor = 0`]
- `pop_demands.txt` weights (`wheat = 0.75`, `fruit = 0.5`) are NOT applied to pop demand. [save-checked: wheat
  in market 13 = 36.025 observed vs 36.146 modelled without the weight, 27.11 with it]
- The age block `goods_demand = { global_<good>_pop_demand ... }` (age 4: liquor +0.5, tobacco +0.5, sugar +0.75) does
  NOT show in the save: sugar 7.501 obs vs 7.532 model WITHOUT the +75%, liquor 2.890 vs 2.934 without the +50%.
  [save-checked, negative result; where the block goes is open]. Country per-good modifiers that exist:
  institution static modifier `printing_press_books` global_books_pop_demand +0.2 (explains Spain's books +20%,
  see 1.5), events `anglican_vestments_modifier` / `por_printing_ordinances_modifier` +1.0, reform +1 silver.
- `global_pop_demand`: societal value serfdom_vs_free_subjects right side +0.2 (x position); `local_pop_demand` has
  no vanilla source. [data]
- Starving test = the province test in 3.1; "low food" = province `cached_structural_food_change` < 0. [code]

### 1.2 Base table `base[g][type]` (good +0x390) [save-checked, construction inferred]
```
add  = demand_add.all + demand_add[type] + (type.upper ? demand_add.upper : 0)
mult = (demand_multiply[type] if present else 1) * (type.upper ? demand_multiply.upper (default 1) : 1)
base = add * mult          (per 1000 pops per month)
```
`upper = yes` for nobles, clergy, burghers (`pop_types/00_default.txt`). Both multipliers apply to nobles
(H2): furniture (upper 10, nobles 2) 8.073 model vs 8.023 obs, liquor (upper 5, nobles 2) 2.934 vs 2.890; with only the
type multiplier (H1) 7.117 and 2.775. Tea (no `all`, no multiplier) reproduces per pop: nobles 0.2, burghers/clergy
0.01 per 1000. [save-checked]

### 1.3 Location factor (location +0xf30 map) [save-checked for winter; rest inferred from the goods keys]
Product of the good's location-dependent multipliers for that location:
`winter_demand_modifier[current winter severity]` x `climate_demand_modifier[climate]` x
`topography_demand_modifier[topography]` x `region/sub_continent/continent_demand_modifier[...]`, and 0 outside
`demand_only_in_region/sub_continent/continent` when the good has those keys.
- Winter is the location's CURRENT winter (none/mild/normal/severe), not the climate's static winter type: in the
  1 April save every market-13 location behaves as `none` (salt 15.288 model vs 15.224 obs; cloth 31.83 vs 32.05;
  coal/lumber/fur pop demand ~0, with the static climate winter they would be 0.30/0.29/9.1). So demand for coal,
  lumber, fur, salt, cloth, beeswax is seasonal. [save-checked]

### 1.4 When it is recomputed (lag) [save-checked, scheduling not decoded]
The per-pop list is cached on the pop and recomputed by jobs (FUN_143e47ed0 / FUN_143fe64a0 call FUN_143352900 and
store the result); not every pop is recomputed every month. Tea in market 13 (zero supply, so `missing` = full
demand): of 146 pops, 50 used last month's price (elasticity 0.9191), 18 the price of two months ago (0.9547),
24 three to five months ago (0.966-0.970), none the current price. Gates (wealth threshold, known goods, province
food state, winter) therefore show up in the aggregate with a delay of 1-5 months. For a simulator: evaluate the
formula every month (the engine converges to it).

### 1.5 Save check (`food_tmp\model.js <market>`; winter = none, estate wealth per owner)
| market | goods with Pops demand > 0.5 | within 5% | total observed | total model |
|---|---|---|---|---|
| 13 (Sevilla) | 44 | 22 | 400.4 | 418.5 |
| 29 (Spain) | 42 | 23 | 432.2 | 427.2 |
| 160 (Spain) | 41 | 20 | 212.5 | 207.6 |
| 71 (other country) | 28 | 15 | 56.3 | 54.0 |
- Exact-ish (market 160): wheat 1.000, fish 1.003, livestock 1.001, olives 1.005, legumes 1.007, leather 1.002,
  weaponry 1.003, glass 1.004, pottery 0.992, liquor 1.016, furniture 1.018, salt 0.984, ivory 0.999, sugar 1.027.
- Systematic misses, all explained by a gate the current state sits next to, plus the lag in 1.4:
  fine_cloth (threshold 1.25 vs Spanish nobles 1.226 / burghers 1.17: obs 2-3x model), paper and jewelry (1.2 vs
  burghers 1.17), beer and tools (0.75 vs peasants estate 0.738: obs between gated and ungated), firearms (1.2 vs
  nobles 1.226: obs below model), tea/cocoa/porcelain/chili/cloves (not produced in market -> known-goods gate,
  recently opened), horses/fruit (+50% low-food term depends on the province state at recompute time).
- Without the wealth gate the totals blow up (medicaments x3.98, gems x4.6, livestock x2.0), so the gate is hard
  (not the linear "wealth reach" the goods-info tooltip GOODS_WEALTH_REACH_HEADER describes; that tooltip is a
  market average). [save-checked]
- Books: in Spain the observed demand is 1.14-1.19x the model (which leaves out country modifiers), in market 71
  0.92x: consistent with the printing press institution's `printing_press_books` +20% in Spain. [save-checked, inferred source]

### 1.6 Who gets scarce goods (`taken.Pops` < `demanded.Pops`)
Not pro rata: chili in market 13 (demand 2.067, taken 0.552): one pop (the 16.3k Castilian burghers of Sevilla, the market center) got 59% of its
demand, every other pop 0% (including Castilian burghers of Carmona). There is a pop priority order (size? market center first?). Not decoded. [save-checked
observation; open]
- `missing={...}` on a pop = its unsatisfied demand per good; `goods` (0..1) = goods access; `price` = price
  satisfaction term. [save fields]

### 1.7 Estate pop expense and POP_NEEDS_INCOME_SCALE
- `NPop.POP_NEEDS_INCOME_SCALE` (1.33) is NOT read by the demand functions; its only readers are FUN_142fa4240
  (17 KB) and FUN_14321b560 (25 KB, the market/RGO update that pays estates). [code: definemap]
- Spain's estates' `last_month.pop_expense` vs the model value of their pops' goods (taken x price, 7 markets,
  `food_tmp\model_cost.js`): nobles 1,784.7 / 1,585.5 (x1.13), clergy 1,115.5 / 930.6 (x1.20), burghers 1,760.1 /
  1,373.0 (x1.28), peasants 954.8 / 655.2 (x1.46). Of the order of 1.33 but not constant (the model misses country
  modifiers and the lag): the expense formula is **open**. [save-checked, inconclusive]

---

## 2. Building demand and supply, RGO and base supply (save-checked relations; rationing open)

Checks: `food_tmp\bdem.js` / `bout.js` over all 171,946 buildings of the save (`buildings.json`: type, level, employed,
per production method its `missing{}` and `input=` fraction). er = employment ratio = employed / (level x
employment_size) (cap 1), acc = location `market_access`, in = the method's per-level input amount, I = the
method's `input` value (absent = 1).
```
demanded.Building[g] = SUM_buildings level * in[g] * er * acc                        [save-checked, +-2%]
taken.Building[g]    = SUM_buildings level * in[g] * er * acc * I(method)            [save-checked, +-3%]
production_supplied.Buildings[g] = SUM level * out_amount * er * I                    [save-checked, single-method buildings]
production_supplied.RawMaterials[g] = SUM_rgo_locations employed_in_rgo * (1 + raw output modifiers)   (no access)
production_supplied.Base[g]  = goods.base_production(g) * SUM_locations unemployed peasants (thousands)  (no access)
supplied.Production = Base + RawMaterials + Buildings                                 [save-checked, markets_food 2]
```
- Market 13: glass 4.85 / 4.83 (demanded / model), cloth 96.94 / 96.05, paper 72.57 / 71.94, coal 44.23 / 44.90,
  wool 179.74 / 176.57, firearms 75.13 / 74.67; taken: glass 4.74 / 4.72, copper 32.19 / 32.04, beeswax 3.47 /
  3.44, iron 37.53 / 37.19, tin 5.17 / 5.15, cannons 4.60 / 4.60. Without `acc` the model is 10-20% too high;
  without `I` the taken model equals the demanded one.
- Output has no market-access factor: coal 29.52 = level x out x er exactly (with acc 26.28); tools 61.87 vs 62.26,
  weaponry 75.10 vs 76.52, cloth 182.10 vs 187.00. Larger gaps (fine_cloth x1.33, jewelry x1.47, firearms x1.27,
  iron, lumber) are buildings with a second ("enhancement"/ammunition/alum) method missing from data.json.
  Market access therefore scales a building's bought inputs and (economy_control 2.2) its profit, not the goods it
  puts on the market. [save-checked]
- `I` (save `input=` per method, e.g. tools_guild in Sevilla 0.70719 with `missing={ iron=4.39187 }`) is one
  fraction per method applied to ALL its inputs: beeswax is abundant (stockpile full) yet temples took 27% of their
  beeswax because temple_maintenance also needs tools, which are short (60%). Same for livestock (leather guilds,
  tools-limited): taken 57%. [save-checked]
- RGO supply per employed RGO worker is the same 1.3732 for all 23 single-modifier goods of market 13
  (olives 76.456 / 55.71 workers); with market access it would vary 1.42-2.31. [save-checked]
- Base: clay/sand/stone/lumber/wool all give the same scale per market = SUM unemployed peasants (pop_stats
  `unemployed` of peasants): 481.23 vs 480.44 (market 13), 631.91 / 630.75 (22), 970.05 / 969.42 (29), 391.04 /
  390.38 (160), 201.95 / 201.81 (71). base_production: clay 0.01, sand 0.0065, stone 0.006, lumber 0.005, wool
  0.00025. [save-checked]
- Upkeep-only buildings (`category = building_maintenance` methods: temples, granaries, marketplaces) demand
  their maintenance goods the same way (level x in x er x acc).
- Merchant trades (FUN_1425d4990, daily): a trade moves `amount = min(trade volume, source stockpile, ...)` from
  the source market (demand +amount, `demanded.Trade`, stockpile -amount) to the target (supply +amount,
  `supplied.Trade`, stockpile +amount); for a food good it also moves `amount x good.food` of market food
  (target food/+0x30/+0x78 +, source -). [code]
- Stockpile: clamped every month to [0, maximum_stockpile_capacity of the market-center location] and the bleed
  recomputed (FUN_1425d5600; markets_food 1.8). [code]
- **Open**: how the scarce-good fill ratio `I` is computed (iron: demand 84.54, supply 48.99, taken 37.53; sand:
  supply + stockpile exceed demand yet 52% taken because its users are tools-limited), whether the stockpile
  serves demand, and what `priority=` means. Construction demand is rationed separately (lumber Construction
  92.2 demanded, 12.59 taken).

---

## 3. Food (province storage, market exchange)

### 3.1 Province monthly food tick: `FUN_14333cf60(province)` [code]
Order inside the tick (one province):
```
1. max_food (+0x5c0)      = FoodCapacity(province)                      (FUN_143336030, 3.5)
   current (+0x5b8)       = clamp(current, 0, max_food)
2. base_food_consumption (+0x5f0) = SUM over the province's locations, SUM over pop types t:
                              size(t in location) * pop_type.pop_food_consumption(t)       (lambda 143fd7480)
3. growth terms +0x5f8 / +0x600 = FUN_14333db30 (population agent; uses the stock BEFORE this month's change)
4. unit_draw (+0x5e8, save `food_consumption`) = FUN_14333dd90 =
       max(last (+0x5b0), month (+0x5a0), demand (+0x5a8) * days_in_month / day_of_month)
       (save `food={ month demand last current }` = +0x5a0 +0x5a8 +0x5b0 +0x5b8: food taken by units this month,
        unit demand this month, last month's taken; see 3.4)
5. y = ProvinceFoodChange(province, flag=1)       = -unit_draw + SUM_locations LocationFoodChange(loc, 1)
   ApplyFoodChange(province, y + unit_draw)        (FUN_143336b00):
        current = clamp(current + delta, 0, 2 * max_food)     <- may exceed capacity for a moment
        cached_food_change (+0x5c8) = delta = SUM_locations LocationFoodChange(loc, 1)
6. cached_structural_food_change (+0x5d0) = ProvinceFoodChange(province, flag=0)
        = -unit_draw + SUM_locations LocationFoodChange(loc, 0)
7. Exchange with the market: FUN_14333e040(province, change)   (3.2)
8. last (+0x5b0) = month (+0x5a0); month = 0; demand (+0x5a8) = 0
9. current = clamp(current, 0, max_food)
```
- Units do not pass through the monthly change: armies take food from the stock during the month (`month`), so the
  applied change adds `unit_draw` back; the structural change keeps it as a cost. [code]
- `flag` (last argument of FUN_14285cc70) is passed to every location's food change (FUN_14310c7e0) and adds the
  province food decay (3.7, FOOD_TOTAL_DECAY). So cached = structural + unit_draw - decay: bolghar 48.23 = 50.73 -
  2.5 with 2.5 = 0.005 x 500 (global decay x full stock, no granaries) [save-checked]; Sevilla -324.70 = -293.30 -
  31.40 and manikpur 51.12 = -197.88 + 274.44 - 25.45 imply decay rates 0.0012 / 0.0029 per month (granary
  preservation, 3.7). [code]
- `province_starving` test (used before/after every stock change; a change of state marks the province dirty so the
  static modifier is re-applied) [code]:
```
starving = current < 1  OR  ( structural <= 0  AND  current <= -structural  AND  trade >= 0  AND  trade + structural < 1 )
```
  i.e. empty stock, or a stock that cannot cover one month of the structural deficit while the market gave nothing
  that covers it. Static modifier `province_starving` (static_modifiers/province.txt): local_population_growth -0.05,
  local_supply_limit_modifier -0.25, local_migration_attraction -1, local_pop_demotion_speed_modifier +0.5,
  local_upper_class_capacity_modifier -0.5, local_life_expectancy -10. [code + data]

### 3.2 Province <-> market exchange: `FUN_14333e040(province, change)` [code]
Runs right after the monthly change is applied (step 7), once per province per month.
```
trade (+0x5d8) = 0 ; wanted (+0x5e0) = 0
market = market of the province's capital location
market.max_food (+0x68) += FOOD_CAPACITY_FACTOR (1.0) * max_food
consumption = SUM_locations SUM_types PopFoodConsumption(loc, t)   (lambda 143fd7680; FUN_1430f24a0 = modified
              consumption, see 3.7)
market.food_consumption (+0x70) += consumption
if not FUN_143320050(province, market): stop          (access check; not decoded, inferred: market access/food access)
reserve = FOOD_PROVINCE_LOCAL_RESERVE_RATIO (0.75) * max_food
cur = max(current, 0)
if cur > reserve:                                       # SELL
    s = cur - reserve
    market.food (+0x60) += s ; market.+0x30 += s ; market.+0x40 += s ; market.+0x48 += s
    trade = -s ; current = reserve
    add province to the market's seller list (+0x12a70)
elif change < 0:                                        # BUY REQUEST
    thr = max(ProvinceFoodChange(flag 0) /*negative, never wins*/, reserve)
    if cur < thr:
        wanted = max(-change, consumption)
        add to buyer list (+0x12a58, FUN_143239c70)
        market.+0x80 += wanted * owner_country.(+0x44d8)          (country factor, see 3.3)
    elif cur < max_food:
        add to the seller list +0x12a70 (FUN_143239d80; only reachable when cur == reserve exactly)
# a province below its reserve with change >= 0 is in neither list: it neither buys nor gets refilled
```
- `change` is the STRUCTURAL change of step 6 (the decompiler dropped the argument): manikpur has cached +51.1,
  structural -197.9 and a `wanted` of 547.58; a positive cached change would not have produced a request.
  [save-checked]
- `wanted = max(-change, consumption)`: a buying province asks for at least one month of its pops' modified food
  consumption. manikpur wanted 547.58 vs base_food_consumption 514.24 (x1.065 modifiers); cuchumatan 156.89 vs
  162.57 (x0.965). [save-checked: wanted > deficit in both]

### 3.3 Market food distribution: `FUN_1432365b0(market)` [code]
Runs after every province of the market did 3.2 (it reads the seller and buyer lists the provinces filled).
```
0. decay: rate = (local_food_decay(center location) + global_food_decay(center owner))
                 / (1 + max(0, local_food_preservation_efficiency_modifier(center)))
   d = rate * market.food ; market.food += min(0, d)       <- only a NEGATIVE product is applied (sar 63 / and);
                                                             with positive decay modifiers nothing happens
1. three passes i = 0, 1, 2:
   list  = i < 2 ? buyers (+0x12a58) : sellers (+0x12a70)
   for each province p in list:
       cur = max(p.current, 0)
       i = 0:  need = -cur                                   (never positive: pass 0 gives nothing as compiled)
       i = 1:  target = max(0.75 * p.max_food, Y) ; need = target - cur
               Y = -unit_draw + SUM_locations LocationFoodChange(loc, flag 0) = the structural change (same lambda
               143fd7f60 as FUN_14285cc70); a monthly delta never beats 75% of capacity, so: fill buyers to 75%
       i = 2:  x = 3.0 (FOOD_PASS2_MAX_MONTHS_OF_DEFICIT) * max(0, -p.structural)
               room = p.max_food - cur
               need = (x < 1) ? room : min(x, room)
       w = need * owner_country.(+0x44d8)                    (country factor: 1.0 for normal countries, inferred)
       keep w if w > 0 ; total += w
   avail = (i == 2) ? market.food - FOOD_PROPORTION_TO_PRESERVE_IN_MARKET_IF_POSSIBLE (0.25) * market.max_food
                    : market.food
   if total > 0 and avail < total: scale every w by avail / total       (pro-rata rationing)
   for each kept p:  t = min(w, market.food)
                     market.food -= t ; market.+0x30 -= w ; market.+0x48 -= w ; market.+0x38 += w
                     p.trade += t ; p.current = clamp(p.current + w, 0, p.max_food)
                     (starving state re-evaluated; dirty flag on change)
2. market.food = clamp(market.food, 0, market.max_food)
3. provinces of both lists with the starving test true -> list +0x12a88 (starving provinces)
4. market.food_price (+0x88) += FoodPriceStep(market)     (FUN_1431fd1d0, 3.8)
```
- Pass 2 runs over the SELLERS: every province that sold its surplus (stock above 75%) is topped up again from the
  market's food above 25% of the market capacity: to full if its structural balance is >= 0, else by up to 3 months
  of its structural deficit. [code + save-checked below]
- Worked checks (market 13 is full, food = max = 180,021.7, so no rationing): [save-checked]
  - **bolghar** (83886080, max 500, structural +50.73, cached +48.23): +48.23 applied unclamped -> 548.23;
    sells 548.23 - 375 = 173.23 (trade -173.23); pass 2: structural >= 0 -> refill to max (+125) -> trade
    = -48.23, current = 500. **Save: current 500, trade -48.23296 = -cached_food_change.** ✔
  - **Sevilla** (2221, max 34,925, reserve 26,193.75, structural -293.29964): sold down to the reserve, pass 2
    refill = 3 x 293.29964 = 879.899 -> current = 27,073.649. **Save: 27,073.64892.** ✔
    trade = 325.29 = refill - sold -> sold 554.61 -> stock before the exchange = 26,748.36.
  - **cuchumatan** (16777220, max 2,100, reserve 1,575, cached -98.97, structural -91.81): ends at exactly 1,575
    with trade +98.97 = -cached: it was at the reserve, lost the month's change, and pass 1 bought it back to 75%.
    `wanted` 156.89 = its modified consumption (> 91.81 deficit). ✔
- So a province with `current > reserve` in a full market sits at `reserve + min(3 x deficit, 25% of capacity)`
  (deficit provinces) or at `max_food` (surplus provinces), whatever its own balance. [code + save-checked]
- All 3,367 provinces with capacity: 1,645 at max, 695 exactly at the 75% reserve (395 of them with trade =
  -cached change), 355 at reserve + 3 x structural deficit, 468 below the reserve (markets out of food, or
  change >= 0 so they never ask), 204 elsewhere. 80% follow the rules to the last digit. [save-checked]
- The market's food stock therefore moves by (sold surplus) - (pass 1 + pass 2 refills) + trade;
  `food_produced` (+0x40) counts the sales, `food_added_to_provinces` (+0x38) the refills (3.9). [save-checked]

### 3.4 Unit food draw (`food={ month demand last }`, `food_consumption`)
- FUN_14333dd90 (above). Units (armies resupplying in the province) take food from the province stock during the
  month; `last` is last month's total, `month`/`demand` this month's. Tooltip `FOOD_FROM_UNITS` "From Units
  Resupplying in Province". [code + tooltip]
- manikpur: month 8.85, demand 8.85, last 274.44 -> food_consumption 274.44 = last. [save-checked]

### 3.5 Province food capacity: `FUN_143336030` + lambda `143fd7920` [code, save-checked]
```
max_food = ( global_food_capacity(owner) + local_food_capacity(province-level modifiers, +0x110) )
           * (1 + max(-1, global_food_capacity_modifier(owner) + local_food_capacity_modifier(province)))
         + SUM over the province's locations:
           local_food_capacity(loc) * max(0, 1 + global_food_capacity_modifier(owner) + local_food_capacity_modifier(loc))
market.max_food = SUM over provinces whose capital location is a market member of FOOD_CAPACITY_FACTOR (1.0) * max_food
```
Sources of `local_food_capacity`: location_base_values 50; rank city 500 / town 250 / megalopolis 1000 (rural 0);
granary 500 per level, village_granary 250, farming/fishing/market villages 50-100, grain_house 100 (building
modifiers scale with level x employment ratio). `local_food_capacity_modifier`: town right traditions +0.5,
nav_destructive_feuds -0.25. [data]
- Save check over Spain's provinces (building modifier x employment ratio): exact for 2201, 2204, 2205, 2206,
  16778490, 16778690, 16779024, 16779442, 16780404, 16780936, 16780973, 33555976, 50332959, 50333162, 33556617
  ...; 33557447 = 1.5000 x (town right +0.5); Sevilla 2221 34,925 vs 31,250 (x1.118, an unidentified location
  modifier). Without the employment scaling 2204 would be 8,550 vs 4,950 observed. [save-checked]
- market.max_food = SUM province max_food exactly: market 13 180,021.7, 22 250,736.5, 29 212,768.2, 160 88,865.4,
  71 45,419.9. [save-checked]

### 3.6 Location food production: `FUN_1430f3300(location)` [code; tooltip keys in brackets]
```
subsist  = max(0, unemployed laborers + unemployed peasants)                 (FUN_143155020; pop_stats `unemployed`
           of the pop types at game +0xff8 / +0x1008, read as laborers / peasants: inferred)
rgo_food = rgo_workers * max(0, 1 + local_raw_material_output + global_raw_material_output) * rgo_good.food
           (FUN_143155d80; rgo_workers = FUN_1430b8b60 = `employed_in_rgo` of the types at +0xff8 / +0x1018, read as
            laborers / slaves: inferred; [FOOD_PEASANTS_WORKING])
bld_food = SUM over the location's buildings, over their methods whose output good has food > 0:
           output(method, level, employment ratio) * good.food                                    [BUILDING_FOOD_OUTPUT]
base     = bld_food + local_monthly_food (flat) + NLocation.SUBSISTENCE_AGRICULTURE (0.8) * subsist + rgo_food
                                                                                    [FOOD_SUBSIST, FOOD_TOTAL_PRODUCTION]
productivity = 1 + local_monthly_food_modifier + global_monthly_food_modifier
               + [if the RGO good has food] local/global per-good modifiers (good +0x144 / +0x146: the good's
                 local_/global_<good>_output_modifier pair)                                    [FOOD_TOTAL_PRODUCTIVITY]
food = max(0, base * productivity * (1 + local_food_production_mult + hostile_food_multiplier))   [FOOD_PRODUCTION_MULT]
```
- `local_food_production_mult`: rank town -0.1, city -0.2, megalopolis -0.3. `local_monthly_food_modifier`:
  named values monthly_food_productivity_* from terrain, seasons (winter_* static modifiers: severe winter
  "extinction_penalty"), weather, events; `global_monthly_food_modifier`: laws/advances. [data]
- Subsistence: "1000 unemployed pops in subsistence agriculture produce 0.8 food" (food goods are 1 unit per 1000
  RGO workers x their food value, e.g. wheat 8, fish 5, olives 4). [code + loc FOOD_EFFICIENCY_TT]
- Not save-checked (needs every location's modifier stack); the province balance identity below is.

### 3.7 Location consumption and the location food change [code, save-checked for the base]
```
cons(loc, type) = -( size(type in loc) * pop_type.pop_food_consumption(type)
                     * max(0.05, 1 + local_<type>_food_consumption(loc) + global_<type>_food_consumption(owner)
                               + global_pop_food_consumption(owner) + local_pop_food_consumption(loc)) )   (FUN_1430f24a0)
    pop_food_consumption: nobles 20, clergy 5, burghers 4, soldiers 5, laborers 1, peasants 1, slaves 1, tribesmen 0
LocationFoodChange(loc, flag) = food(loc) + SUM_types cons(loc, type) + (flag ? decay(loc) : 0)     (FUN_14310c7e0)
decay(loc) = only for the province's capital location:
             -max(0, province.current) * (local_food_decay(capital) + global_food_decay(owner))
                                       / (1 + max(0, SUM_province_locations local_food_preservation_efficiency_modifier))
             (FUN_1430f17f0; tooltip FOOD_TOTAL_DECAY / FOOD_DECAY_TITLE "Decay of X% of Y food each month")
```
- base_food_consumption (province +0x5f0, save `base_food_consumption`) = SUM size x pop_food_consumption, no
  modifiers: 2,555 of 3,461 provinces within 0.2% (rest within a few %: pops moved since the tick), Sevilla 890.31
  vs 890.01. [save-checked]
- The modified consumption is accumulated into market.food_consumption: market 13 4,357.3 vs SUM base 4,488.6
  (x0.971), 22 x0.976, 29 x0.965, 160 x0.965, 71 x0.936, so Spain has roughly -3% of consumption modifiers. [save-checked]
- Decay = structural + unit_draw - cached (3.1): bolghar -2.5 = 0.005 x 500
  (global_food_decay 0.005 from auto_modifiers country_base_values, no preservation); Sevilla -31.40 with
  67 granary levels (preservation 3.35): 0.005 / 4.35 x ~27,300. Global decay sources: country base 0.005; climate
  local_food_decay tropical 0.002, subtropical 0.001; winter_severe 0.005, storms, hostile_troops 0.0025.
  Preservation: granary / village_granary 0.05 per level, town right traditions 0.25. [code + save-checked]
- So the stock decays ~0.5%/month at base; the market stock does not (3.3 step 0, as compiled).

### 3.8 Market food price: `FUN_1431fd1d0(market)` (tooltip FOOD_PRICE_EXPLANATION: EQUILIBRIUM, STEP) [code]
```
age = current age (game +0x2a8): min = age +0x180 (0.1 fitted in markets_food), max = age.max_price (+0x188)
F = market.food, Fmax = market.max_food, flow = market.food_supply (+0x30, this month's net food flow)
if Fmax <= 0:            R = 1
elif flow < 0:           months = F / -flow ;  R = (months <= 0) ? max : 5 / months      (5 is a hard constant)
else:                    fill = clamp(F / Fmax, 0, 1) ;  R = min + (1 - min) * (1 - fill)
R = clamp(R, min, max)
target = max(0.01, NMarket.FOOD_PRICE (0.05) * R)
market.food_price += NMarket.MONTHLY_PRICE_CHANGE (0.05) * (target - market.food_price)
```
- Runs at the end of the distribution (3.3 step 4). A market whose stock covers 50+ months of its net outflow, or
  any full market with inflow, sits at the 0.01 floor: 91 of 181 markets in the save are within 0.0005 of the
  target (market 13: 0.01019 -> 0.01); empty markets with outflow head to 0.25 (152: 0.24829), empty ones with
  inflow to 0.05. [save-checked qualitatively; one save has no food-price history]
- Effects: food goods' price demand x1.25 when food_price > FOOD_PRICE (markets_food 1.2); location static
  modifiers `expensive_food_in_location` / `cheap_food_in_location` (FUN_143194700 compares with FOOD_PRICE);
  initial price of a new market = FOOD_PRICE (FUN_1425cb220). [code]

### 3.9 Market food counters (save field = offset) and checks [save-checked]
| save | offset | meaning |
|---|---|---|
| food | +0x60 | stock |
| max | +0x68 | capacity = SUM province max_food |
| food_consumption | +0x70 | SUM provinces' modified pop consumption |
| food_supply | +0x30 | produced - added_to_provinces + trade (net flow; drives the food price) |
| food_produced | +0x40 | food sold in by provinces (surpluses above 75%) |
| food_added_to_provinces | +0x38 | passes 1-2 allocations |
| food_not_traded | +0x48 | produced - added |
| trade | +0x78 | food content of traded food goods (FUN_1425d4990) |
| missing | +0x80 | SUM provinces' `wanted` x owner factor (+0x44d8) |
| price | +0x88 | food price |
- market 13: food_supply -1,580.32 = 23,088.39 - 24,725.96 + 57.26; SUM province `trade` = 1,637.57 =
  added - produced (exact in markets 13, 22, 29, 160, 71); `missing` = SUM `wanted` exactly in all five, so the
  owner factor +0x44d8 is 1.0 for these countries. [save-checked]
- Open: market 13 shows food = max after a month with net outflow -1,580; the per-province exchanges probably run
  on staggered days so the snapshot does not close (or the counters are last month's).

### 3.10 Who pays
- Concept text: "The owner of the province will be the one affected by the cost or profit of the transaction"
  (game_concept_market_food_desc). [tooltip]
- Save: estates carry `food_income` / `food_expense` (Spain: nobles 101.65 / 77.60, clergy 77.92 / 59.49, burghers
  88.65 / 67.67, peasants 0.65 / 0.50, all with expense/income = 0.76337, split in the same proportion as their
  `trade_income`); the country has `FoodMaintenance` 76.20 / month (slider). SUM over Spanish provinces of net
  |trade| x market food price = 314.0 sold / 279.6 bought, not matching 268.9 / 205.3. Formula **open**.

---

## 4. Not reached
- Burgher trade volume (FUN_143225be0, 21.7 KB; TRADE_BURGHER_PROFIT_SCALE 0.1, MARKET_FOOD_STOCKPILE_TRESHOLD_MONTHS
  24, MARKET_MIN_FOOD_STOCKPILE_RATIO_FOR_BURGHER_TRADE 0.25: burghers do not export food from a market whose
  food stock is below 25% of its capacity). Observation kept from markets_food: for imported goods BurgherTrades
  in = demand - production.
- Market access (FUN_143160620 / FUN_143162200, MARKET_BASE_DISTANCE_FACTOR 0.005 per pixel, sea 0.75 / open sea
  1.5 / downstream 0.5 / upstream 0.9 multipliers, port +0.02 x (1 - harbor) / no port +0.1): not decompiled.
- Goods stockpile movement beyond the clamp (2): not decoded.

---

## 5. What a simulator needs

### 5.1 State
- per pop: type, estate, size (thousands), culture, religion, literacy; per location: development, market access,
  climate/topography/region chain, current winter severity, rank, RGO good + employed_in_rgo, unemployed
  laborers/peasants (pop_stats), buildings (type, level, employed, method, input fraction), province.
- per province: current food, max_food, cached / structural change, trade, wanted, unit draw (month/demand/last),
  preservation sum, capital location.
- per market: goods (price, supply parts, demand parts, stockpile), food, max_food, food_price, counters
  (food_supply, produced, added, trade), seller/buyer lists for the month.
- per country: estate wealth_impact per estate type, known_goods (or "all known"), global_<good>_pop_demand,
  global_pop_demand, food / consumption / capacity / raw-output modifiers.
- per age: known_goods_demand_threshold, min/max price, price_stability.

### 5.2 Monthly order (country mode, one market or several)
```
1. Pops: recompute each pop's demand vector (1.1) with last month's prices, estate wealth, province food state,
   current winter. (Engine: lagged 1-5 months per pop; a simulator can do it every month.)
2. Production: RGO goods = workers x (1 + raw output mods); building outputs = level x out x er x I;
   Base = base_production x SUM unemployed peasants. Building input demand = level x in x er x acc.
3. Market goods: demand parts (Pops, Building, Construction, Units, Roads, Trade...), supply parts; allocate scarce
   goods (rule open: use one fill ratio per scarce good = min(1, (supply + usable stockpile) / demand) and give
   each building method I = min over its inputs of the fill ratios, pops pro rata) -> taken; stockpile update and
   clamp to the market capacity; bleed.
4. Price step per good (markets_food 1), food goods' demand x1.25 when food_price > 0.05.
5. Food, per province (any order, all before step 6):
   a. max_food (3.5); clamp stock to [0, max].
   b. base consumption; unit draw.
   c. change = SUM_locations (production 3.6 - consumption 3.7) - decay (3.7, capital location only);
      structural = SUM (production - consumption) - unit draw.
   d. stock = clamp(stock + change, 0, 2 x max)       (cached_food_change = change)
   e. exchange (3.2): above 75% -> sell surplus to the market; else if structural < 0 and stock < 75% -> buyer
      (wanted = max(-structural, modified consumption)).
6. Food, per market (3.3): pass 1 fills buyers to 75% (pro rata if the market food runs short); pass 2 tops up the
   sellers toward 100% (or by 3 months of structural deficit) from market food above 25% of the market capacity;
   clamp market food to [0, max]; starving provinces; food price step (3.8).
7. Province food bookkeeping: last = month; month = demand = 0; clamp stock to [0, max]; starving modifier.
```

### 5.3 Modes
- **Closed market**: no Trade / BurgherTrades flows (supply = production, demand = local demand); food only moves
  between the market's provinces and its stock; the market stock fills from surpluses until all provinces sit at
  100% (surplus provinces) or at 75% + 3 months of deficit (deficit provinces), then the food price falls to the
  0.01 floor; a market whose stock runs out with net outflow prices food toward 0.05 x max_price (0.25 in age 4).
- **Fixed external trade**: hold `supplied.Trade/BurgherTrades` and `demanded.Trade/BurgherTrades` per good at
  fixed volumes; for food goods add/remove `volume x good.food` to/from the market food stock and to food_supply
  each month (FUN_1425d4990), which feeds the food price.

---

## 6. Open questions (priority order)
1. Scarce-good allocation: how the method fill fraction `I` and `taken.Pops` per pop are set (chili: one pop got
   59%, every other pop 0%; iron 44% of demand with supply at 58%); the role of the stockpile and of `priority=`;
   Construction rationing. Candidates: the market tick functions not yet read (FUN_143225be0, FUN_143e6ef20 21 KB).
2. Pop demand recompute schedule (which pops, how often) and where the age `goods_demand` block goes (not visible
   in the save).
3. `known_goods` (country +0x4d0 map vs age known_goods_demand_threshold): how it grows; not in the save text.
4. Who pays for province food trade (3.10) and what `FoodMaintenance` is; estate pop expense and the 1.33
   POP_NEEDS_INCOME_SCALE (1.7): decompile FUN_14321b560 / FUN_142fa4240.
5. Market food snapshot vs counters (3.9 open note); pass 0 (as compiled it never allocates).
6. Location food production save check (needs the location modifier stack; e.g. a test save with known modifiers).
7. Sevilla's capacity x1.118 (2221) and the province-level food capacity term (+0x110).
8. Burgher trade, market access (4).

## 7. Function index (eu5.exe 1.4.4)
| function | role |
|---|---|
| FUN_143352900 | pop demand vector (1.1) |
| FUN_14334bfe0 | pop needs tooltip (POP_* keys) |
| FUN_1433543f0 / FUN_143e47ed0 / FUN_143fe64a0 | recompute jobs (call 143352900, store via FUN_143354130 into pop +0xd8) |
| FUN_1425c8d00 | pop -> estate (wealth_impact at estate +0x1d8) |
| FUN_14333cf60 | province monthly food tick (3.1) |
| FUN_14285cc70 | province food change (flag: include decay) |
| FUN_14310c7e0 | location food change (production + consumption [+ decay]) |
| FUN_1430f3300 | location food production (3.6) |
| FUN_143155d80 / FUN_143155020 / FUN_1430b8b60 | RGO food / subsistence workers / RGO workers |
| FUN_143155bd0 | base food without buildings/productivity (AI) |
| FUN_1430f24a0 | pop-type food consumption at a location |
| FUN_1430f17f0 | food decay (province capital only) |
| FUN_143336030 + lambda 143fd7920 | province food capacity |
| FUN_14333dd90 | unit food draw |
| FUN_143336b00 | apply change, clamp [0, 2 x max], starving dirty flag |
| FUN_14333e040 | province <-> market exchange (3.2) |
| FUN_143239c70 / FUN_143239d80 | add to buyer (+0x12a58) / seller (+0x12a70) list |
| FUN_1432365b0 | market food decay + 3 passes + clamp + price (3.3) |
| FUN_1431fd1d0 | food price step (3.8) |
| FUN_14322dae0 | market food capacity |
| FUN_14285ddb0 | province food demand on the market (wanted or deficit) |
| FUN_1425d4990 | merchant trade execution (goods + food content) |
| FUN_1425d5600 | stockpile clamp + bleed + surplus/deficit caches |
| FUN_143248390 | market manager tick (trades -> burgher trade -> post -> prices) |
Lambdas (std::function vtables, call at slot +0x10): 14c984738 -> 143fd7f60 (location food change),
14c984498 -> 143fd7680 (modified consumption), 14c9843f8 -> 143fd7480 (base consumption), 14c9845d8 -> 143fd7920
(location capacity), 14c984538 -> 143fd77c0.
