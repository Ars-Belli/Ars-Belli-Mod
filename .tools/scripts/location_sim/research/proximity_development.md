# EU5 1.4.4 — proximity, development/prosperity, max RGO size (location simulator research)

Research notes for the location simulator. Game: EU5 1.4.4 (eu5.exe, Ghidra project `eu5_144b`, decompiles in
`E:\Tools\ghidra-projects\locsim_prox\*.c`; the cost function itself is in `...\locsim_eco\control_prox_rgo.c`).
Save used for checks: `SP_SPA_1547_04_01_7f25c496-...eu5` (Spain = country id 930, 1 Apr 1547, played with Ars Belli).
Scratch scripts and extracted data: `...\scratchpad\research\prox_tmp\` (see the file index at the end).

Confidence tags: `code` = read in a decompile; `tooltip` = from the English tooltip/loc text; `save-checked` =
reproduced numbers from the save; `inferred` = my best reading, not verified.

Fixed point: int64 x 100000 (1.0 = 100000). Ghidra prints `ptr + 0x30d4` for typed pointers: that is +0x30d4 x 8 =
+100000 = **+1.0**, not +0.125 (the earlier note in economy_control.md section 4 read it as 0.125 — that was wrong).

Status: proximity fully decoded and reproduced (75% of Spanish locations to 0.01, 91% to 1.0; the rest is river
adjacency and building-input timing); development and prosperity monthly formulas decoded and reproduced to the
save's rounding; max RGO size decoded (443/522 exact as floor); tax factor F decoded, Spain's value 2.4% short.

---------------------------------------------------------------------------------------------------------------

## 1. PROXIMITY

### 1.1 What the save fields mean

- Location `proximity` (0..100) = the result of the country's multi-source shortest-path search (1.3). `save-checked`.
- Country `proximity_persistent_cache = { <locId> = { proximity_parent = <locId> proximity_propagation = X
  sea_zone_proximity = Y } }`: one entry per node reached by the search (land locations AND sea zones/lakes).
  `proximity_parent` = the neighbour the best path came from (absent for sources); `sea_zone_proximity` = the
  proximity value of a water node (sea zones and lakes are not owned, so their value lives only here);
  `proximity_propagation` = "total proximity propagation importance to Capital" (loc key `PROXIMITY_PROPAGATION_INFO`)
  = the sum of `local_proximity_propagation` over all DESCENDANTS of the node in the proximity tree (its own value
  excluded; absent = 0 for leaves). `save-checked` exactly: 313/313 Spanish entries with the field, 381/381 leaves
  without it (`prox_tmp\proptest.js`; e.g. Aurillac 808.64143 = 823.21155 subtree - 14.57012 own). It is an
  importance weight (AI roads / proximity buildings), not part of the proximity value. `code` (tooltip FUN_1430d7110
  reads parent/propagation from the hash at country+0x5080).
- Location `local_proximity_propagation` = "local proximity propagation importance to Capital"
  (`LOCAL_PROXIMITY_PROPAGATION_INFO`) — a per-location weight, NOT a cost. It is about half the location's wealth
  (`possible_tax`): lpp / possible_tax = 0.49-0.51 for most Spanish locations (Sevilla 41.86 / 78.26 = 0.535, Tarifa
  1.48), i.e. probably the economic-base score (`ECONOMICAL_BASE_FROM_TAX_BASE` 0.5 x tax base + other terms).
  `tooltip` + `inferred`.

### 1.2 Sources — FUN_143158bf0 (`code`), save-checked

```
strength(loc) = min(100, local_proximity_source) x (1 + max(-1, local_proximity_source_modifier))   [0 if lps <= 0]
```
- `local_proximity_source` (modifier index global 0x14f0a3576) and `local_proximity_source_modifier` (0x14f0a3746) are
  read from the location's own modifier set; the 100 cap applies BEFORE the multiplier. `code`
- Contributors (vanilla 1.4.4): static `capital` 100; static `historical_capital` 80 (only when NOT the capital);
  buildings `local_governor` 80, `naval_governor` 80, `italian_administration_center` 80 (all `modifier` blocks),
  `itinerant_court_seat` 75 (capital_buildings.txt l.1362), uniques 75 (unique_buildings l.1477), 80 (l.1904),
  20 (l.5578), a `raw_modifier` 60 (l.1653), event static modifiers 80/50/20.
- Building `modifier` blocks are scaled like every location building modifier (location_modifier_scales.md):
  `S = min(1, employed / (employment_size x level)) x level x input`, where `input` = the building's input
  satisfaction (save: `<production_method>={ ... input=0.66666 }`, key absent = 1.0; level 0 = under construction
  = 0). So an unstaffed or unsupplied Local Governor gives less than 80. `code` (scale) + `save-checked` (bridges,
  canals, harbour buildings, fishing villages in 1.6).
- Spain 1547: Sevilla 100 (capital), Valladolid / Toledo / Aurillac 80 (`local_governor`, employed 0.1 = full,
  no missing input). All four are stored with exactly that proximity. `save-checked`
- Initialisation (FUN_143ab4f10): every owned location (country+0x4640 list) with strength > 0 is pushed into the
  priority queue with key -strength. `code`

### 1.3 Propagation — multi-source best-path search (`code` + `save-checked`)

```
best[src] = strength(src)                       for every source
repeat: take the node with the highest best[] value (Dijkstra on -best)
        for each neighbour n (map adjacency + sea straits from adjacencies.csv):
            if n is not (owned land of this country) and not water: skip    # foreign land never carries proximity
            v = best[node] - segmentCost(node -> n)    # 1.4; priced FROM the node being expanded
            if v > best[n]: best[n] = v; parent[n] = node
location.proximity = max(0, best[loc])          # 0 = no path (NO_PROXIMITY_TT_TEXT / PROXIMITY_NO_PATH_FOUND)
cache[node] = { proximity_parent = parent, sea_zone_proximity = best (water nodes only), proximity_propagation }
```
- Tree builder FUN_142720030 -> generic search FUN_142895e00 / FUN_142896780 with the edge callback FUN_143ab4e60 ->
  FUN_142717450 (finds the neighbour index of `to` in the from-template's neighbour list and the road object for that
  neighbour, `from+0x450[idx]`) -> FUN_1427175b0 (segment cost). `code`
- Combination is "max over sources of (strength - sum of segment costs)"; a weaker source only wins where its path is
  better. 505/522 Spanish locations and 142/160 sea zones get the save's parent (rest: ties and river-adjacency
  differences, 1.6). `save-checked`
- Water nodes: every sea zone and lake is a node (not owned; value kept only in the cache). Land of other countries is
  never entered (no cache entry of Spain has a foreign land parent). `save-checked`
- Path tooltip FUN_1430d7110 (PROXIMITY_LIST_TITLE / PROXIMITY_START_INFO / PROXIMITY_FROM_INFO) re-walks the parent
  chain with FUN_1428969e0 and re-prices every segment, starting from the source's strength. `code`

### 1.4 Segment cost — FUN_1427175b0 (15 KB) `code`; branches save-checked as noted in 1.6

Country values (country modifiers; Spain 1547 in brackets, base values from `auto_modifiers/country.txt`):

| term | modifier | base | Spain 1547 |
|---|---|---|---|
| L  land | `land_cost_on_distance_from_capital` | 40 | 40 |
| R  road | `road_cost_on_distance_from_capital` | 20 | 20 |
| Rv river | `land_cost_going_downstream` (river types 1,2) / `land_cost_going_upstream` (type 3) | 12 / 12 | 12 / 12 |
| F  frozen water | `land_cost_on_frozen_water` | 20 | 20 |
| Sm sea, maritime | `sea_cost_on_distance_from_capital_when_maritime` | 5 | 3.713649 (advance -0.5, land_vs_naval +79 -0.786) |
| Se sea | `sea_cost_on_distance_from_capital` | 30 | 30 |
| Po port | `port_cost_distance_from_capital` | 35 | 28 (advance -5, reform naval_infrastructure_act -2) |
| Tr sea<->land, not the location's port sea zone | `sea_land_transition_cost_distance_from_capital` | 35 | 35 |
| G  speed, global | `global_distance_from_capital_speed_propagation` | 0 | 0.4845 (1.5) |
| Gl speed, land-land segments only | `land_cost_on_distance_from_capital_speed_propagation` | 0 | 0 |
| Ix topography impact | `<topography>_proximity_impact` (modifier index at topography+0x158) | 0 | flatland -0.2 (static `capital_in_flatland`, no effect: flatland has no penalty) |

Road types (`common/road_types/00_default.txt` `proximity`): gravel_road 0, paved_road 5, modern_road 10, railroad 15.
Topography `proximity` (`common/topography/00_default.txt`; keyed by the FROM topography, `override` by the TO
topography): mountains -0.5, hills -0.25, plateau -0.125 (plateau -> plateau 0), wetlands -0.25, all others 0.
Vegetation `proximity` (`common/vegetation/00_default.txt`): desert -0.05, farmland -0.05, woods -0.125, forest -0.25,
jungle -0.5, others 0. Static modifiers `capital_in_<topography>` give the country `<topography>_proximity_impact`
-0.2 for the capital's own topography.

```
segmentCost(a -> b):                       # a = node being expanded (parent side), b = neighbour
  la = a is land, lb = b is land           # frozen water counts as land (base F)
  S  = G + localSpeed(a) + edgeSpeed(a,b)  # localSpeed(water) = 0
  factor = 1
  if la and lb:
      if strait(a,b) (adjacencies.csv Type=sea, Through=z):  base = seaCost(z); plain = false
      else:
          base = L; plain = true
          if road(a,b): base = R - road.proximity;  plain = false         # paved 20-5 = 15, gravel 20
          if riverAdjacency(a,b) and Rv < base: base = Rv; plain = false  # river REPLACES the road when cheaper
      t = topo(a).override[topo(b)] ?? topo(a).default                    # FROM topography
      speed = (plain ? 1 + veg(a) : 1) + min(0, t x (1 + Ix[topo(a)]))   # vegetation only on plain land
      speed = max(NCountry.PROXIMITY_TERRAIN_SPEED_FLOOR 0.25, speed)     # speed 0 -> impassable
      base = base / speed
      S += Gl
  else if not la and not lb:           base = seaCost(a)   # water -> water, presence in the FROM zone (lake: Sm)
  else if a or b is a lake:            base = Sm           # land <-> lake (PROX_LAKE_IS_MARITIME: lakes = 100%)
  else (land <-> sea zone):
      land = la ? a : b;  sea = la ? b : a
      if portSeaZone(land) == sea:  base = Po;  factor = max(0.05, 1 + local_port_cost_distance_impact(land))
      else:                         base = Tr       # EMBARKING_/LANDING_TO_DIFFERENT_SEA_ZONE, no port factor
  cost = max(0.01, (base + edgeCost(a,b)) x max(0.05, factor) / (1 + max(-0.95, S)))

seaCost(z) = Sm x mp + Se x (1 - mp)       # mp = this country's maritime presence in z / 100 (lake: 1)
                                           # FUN_14271c460; save maritime_manager.objects.<z>.presences{power, country}
```
- `edgeCost(a,b)` (`from+0x468[nbIdx]`) and `edgeSpeed(a,b)` (`from+0x480[nbIdx]`) are per-neighbour values set by
  the script effects behind ADD_PROXIMITY_BONUS_EFFECT ("proximity cost to X is changed by") and
  ADD_PROXIMITY_MODIFIER_BONUS_EFFECT ("... by X%"); duplicate guard string "Tried to add a duplicate scripted
  proximity from {} to {} and key {}" (location.cpp). 0 on every Spanish edge. `code`; effect names `inferred`.
- `localSpeed(loc)` = location modifier `local_distance_from_capital_speed_propagation` (cached at from+0xa18):
  static `development` 0.005 x development; `bridge_infrastructure` 0.1 and `pound_lock_canal_infrastructure` 0.1
  (x building scale S, 1.2); `capital_connection_modifier` 0.1; `chi_grand_canal` +0.2 / `_destruction` -0.2;
  `ruler_overriding_ulema` -0.1; `lack_of_conciliar_justice` -0.25; `talented_qadi` 0.1; two event buildings 0.5; one
  unique 0.1; D008 static 0.2. `save-checked` for development, bridge, canal.
- `local_port_cost_distance_impact(loc)`: reform `harbor_administration` location_modifier -0.2 (coastal locations);
  static `harbor` -0.5 x max(0, harbor_suitability) (port locations; location_modifier_scales.md `harbor` row).
  `save-checked`
- `harbor_suitability(loc)` = min(1, template natural harbour + `river_flowing_through_coast_<n>` 0.05 x n)
  (cap `inferred` from Lisbon) + port buildings x S (dock 0.1, dry_dock 0.15, shipyard 0.2, grand_shipyard 0.25,
  naval_base 0.3, protected_harbor 0.1, wharf 0.1, fishing_village 0.02 per staffed level, special yards 0.1-0.2)
  + reform `naval_infrastructure_act` 0.1 (coastal town/city) + town rights `staple_port` 0.2 / `royal_staple_rights`
  0.3 / one German right 0.2 + cabinet action `cab_naval_focus` 0.1. `save-checked` (Sevilla 1.2, Lisbon 1.45,
  Bilbao 0.92 = 0.8 + 6 fishing-village levels, Pollensa 0.063 = 3.11 staffed levels x 0.02).
- `portSeaZone(land)` = the land location's sea zone in `map_data/ports.csv`.
- River adjacency = adjacency river type (+0x22: 1,2 -> downstream cost, country+0x2e38; 3 -> upstream, +0x2e40;
  table 0x14c9d5e90). Built by the map loader, not in any text file; 1.6 gives a pixel approximation and its error.
- Country cache fields (country = `lStack_c0`): +0x2df8 Sm, +0x2e00 Se, +0x2e08 L, +0x2e10 Gl, +0x2e18 G (reaches the
  function as *param_6), +0x2e20 Po, +0x2e28 Tr, +0x2e30 F, +0x2e38 downstream, +0x2e40 upstream, +0x2e48 R (each
  offset paired with the modifier index the tooltip prints next to it). `code`
- Tooltip keys of the segment breakdown: PROXIMITY_ADJACENT_DISTANCE ("Segment cost (A->B) is X due to:"),
  PROXIMITY_BASE / PROXIMITY_BASE_WITH_BREAKDOWN, PROXIMITY_ROAD_TYPE, PROX_TOP ("From [topography] to [topography]:
  X%"), PROX_VEG_IMP ("[vegetation]: X%"), PROX_SPEED_MODIFIER ("Proximity Efficiency is X% due to" = the 1 + S
  divisor), PROX_WITH_MARITIME / PROXIMITY_BASE_MARITIME_MULTIPLIER, PROX_LAKE_IS_MARITIME,
  EMBARKING_TO_DIFFERENT_SEA_ZONE, LANDING_TO_DIFFERENT_SEA_ZONE. `tooltip`
- Correction to economy_control.md section 4: the "0.125" constant is +1.0 (pointer arithmetic); the divisor is
  (1 + S); the "factor" is 1 except for port transitions; vegetation is ADDED to the speed (1 + veg + topo) and only
  for segments with neither road nor river nor strait.

### 1.5 Spain's global speed G (fit 0.4845; 0.4695 itemised)

Fit: `base / delta - 1 - localSpeed(parent)` over the Spanish road/river segments has one dominant value, 0.4845
(139 segments already in a first pass that ignored building staffing; with the full model 625/678 tree edges are
priced to 0.01 with this G). E.g. Sevilla's children: 15 / 7.54830 = 1.98720 = 1 + G + 0.30274 + 0.1 + 0.1 ->
G = 0.48446; the sea-sea segments with full presence give the same: 3.713649 / 2.50159 = 1.48452. `save-checked`

Itemised (`code`/data): societal value `centralization_vs_decentralization` -99.75652 -> 0.2 x 0.99757 = 0.19951;
law `administrative_system = merindad_policy` 0.1; privilege `manorial_courts` 0.05; `supreme_court` in the capital
(`capital_country_modifier` 0.1); static `ruler_adm` 0.001 x ADM 20 = 0.02. Sum 0.46951; **0.0150 unexplained**
(no cabinet `administrator` trait, no other law/privilege/reform/trait with this modifier; a ruler ADM of 35 would
explain it). For the simulator take G as an input (country modifier sum) — open question 1.

**Resolved (in-game tooltip, June 1547 save loaded):** "Proximity Efficiency" of La Tour d'Auvergne -> Ussel lists Development
+13.63%, Bridge +10%, Centralization +20%, Supreme Court +8.57%, Manorial Courts +5%, Merindad Division +10%, Ruler's
Administrative Ability **+3.50%**. The ruler (ADM 20) is in the Order of the Ermine, whose `character_modifier` gives
ADM +15: `ruler_adm` scales with the skill including character modifiers (chivalric orders, timed character modifiers).
G = 0.4707 today. The save's stored tree fits 0.4850 = the same with the Supreme Court at full goods access (+0.0143):
its input fill (0.857 in the save) dropped after the last rebuild, which only dirty-flag triggers start (1.7), and the
game recomputed on load (Ussel 51.16 stored, 50.91 shown; the simulator gives 50.91). `save-checked`

### 1.6 Validation on the 1547 save (`save-checked`)

Solver: `prox_tmp\solve.js` (Spain only; inputs: scenario json, map.json adjacency, save roads, `binputs.json`
= every building's employed/level/input from the save, `maritime.json`, `townrights.json`, ports.csv,
adjacencies.csv). Edge checker: `prox_tmp\edges.js` (prices each OBSERVED parent->child edge with the model).

Worked segments (model vs save delta = proximity[parent] - proximity[child]):
```
Sevilla -> Carmona   paved road, flatland:  15 / (1 + 0.4845 + 0.005x60.54891 + 0.1 bridge + 0.1 canal) = 15/1.98724
                                            = 7.5481   (save 100 - 92.45170 = 7.5483)
Sevilla -> Coria     river:                 12 / 1.98724 = 6.0385   (save 6.0386)
Sevilla -> bay_of_cadiz (embark, own port): 28 x (1 - 0.2 - 0.5 x 1.2) / 1.98724 = 28 x 0.2 / 1.98724 = 2.8180  (save 2.8180)
          harbour suitability 1.2 = min(1, 0.5 template + 0.05 river-coast) + wharf 0.1 + protected_harbor 0.1
          + dry_dock 0.15 + naval_infrastructure_act 0.1 + staple_port 0.2
bay_of_cadiz -> cape_st_mary (sea, presence 100%): 3.713649 / 1.4845 = 2.5016  (save 2.5016)
cape_st_mary -> Ayamonte (landing into its own port, from a sea zone so S = G only):
          harbour = min(1, 0.5 + 0.05 river-coast) + wharf 0.1 + protected_harbor 0.1 + dry_dock 0.15 + reform 0.1 = 1.0
          28 x (1 - 0.2 - 0.5 x 1.0) / 1.4845 = 5.6585   (save 94.68038 - 89.02195 = 5.6584)
Ferrol -> Coruna     strait through rias_altas (presence 100%), flatland -> flatland, no road/river term:
                     3.713649 / (1.4845 + 0.005 x 35.51036) = 3.713649 / 1.66205 = 2.2344   (save 2.2344)
La Teste -> lagoon_of_sanguinet (lake): 3.713649 / (1.4845 + 0.005x27.34) = 2.2907  (save 2.2907)
Lliria -> Chelva     plain land, hills/grasslands: 40 / 0.75 / (1.4845 + 0.005x30.099) = 32.620  (save 32.620)
Mora de Rubielos -> Teruel  plain land plateau->plateau (override 0), grasslands: 40 / 1.0 / 1.61263 = 24.804  (save 24.805)
```

Error distribution, all 522 Spanish locations (|predicted - saved proximity|):

| variant | < 0.01 | < 0.1 | < 1 | median | p90 | max | same parent |
|---|---|---|---|---|---|---|---|
| river adjacency from pixels (both locations have river pixels within 4 px of the other) | 392 | 413 | 473 | 0.0004 | 0.75 | 6.97 | 505 |
| same, river flag of the 160 observed tree edges taken from the save (oracle) | 427 | 448 | 513 | 0.0003 | 0.16 | 6.97 | 508 |
| sea zones (160) | 159 | 160 | 160 | 0.0002 | 0.002 | 0.04 | 142 |

Per-edge check (observed parent, model cost): 625/678 edges within 0.01. The 53 misses: 31 within 3% = building
staffing/input or maritime presence that changed after the proximity was computed (e.g. Ourense/Idanha/Lamego bridges
priced at input 1.0 but evidently 0.667 at compute time; Dax/Tortosa the reverse); 9 river-adjacency
misclassifications (5 false river at ratio 1.25 = 15/12, 4 missed river); 11 landings: 5 priced too high because
their harbour buildings now run at input 0.75-0.8 (Algeciras, Gibraltar, Malaga, Tarifa, Oleron: the save's values
need full input) and 6 priced too low by 0.05-0.08 harbour suitability (San Sebastian, Finisterre, Silves, Viana,
Noya, Ferrol: a dry dock at partial input at compute time, `inferred`); 2 Canary locations clamped at 0. The largest
location errors come from the false rivers (Tulle/Ussel +6.97 = a false Mauriac->Ussel river).

River-adjacency proxy quality on 423 labelled tree edges (128 river): "max distance <= 4 px" 124 TP / 5 FP / 4 FN;
"river pixels touch (8-neighbour)" 107 / 1 / 21. The game's adjacency river type is not reproducible from rivers.png
alone; for the simulator derive it once from saves (edges whose observed cost x (1+S) x speed = 12) or accept ~2%
misclassification.

Vegetation rule, world-wide (`prox_tmp\vegtest.js`, all 1851 country caches, same parent with one plain-land child
and one road child): implied plain-land speed equals 1 + veg(from) + min(0, topo): flatland/woods 0.8750 (n=53),
plateau/desert 0.9500 (35), flatland/farmland 0.9500 (14), hills/woods 0.6250 (7), hills/forest 0.5156 (18, mix of
countries with/without hills impact), plateau/sparse -> mountains 0.9162 (= countries with plateau impact -0.33).
`save-checked`

### 1.7 Evaluation timing (`code`, partly `inferred`)

- FUN_1425c9c80(country) rebuilds everything only when `country+0x3136` (proximity dirty flag) is set: zeroes every
  owned location's proximity (+0xd18), clears the cache hash (country+0x5080), runs the search, writes values and
  the cache. Callers: FUN_1425bfcd0 (23 KB) and FUN_14279f400 (22 KB) — the country update ticks — plus UI paths.
- The flag is set by 11 functions, among them: location owner change (FUN_1427657a0, sets old and new owner),
  overlord change (FUN_142aaf320, "Attempted to change overlord to country"), scripted proximity bonus
  (FUN_142aac820), location modifier refresh when a location's source strength changes (FUN_143edd6f0). A change of
  development or of a bridge's staffing alone does not set it (FUN_143edd6f0 compares only the source strength), so
  stored proximity can lag local-speed changes until the next trigger — this is the 3% timing noise above.
  The Spanish values match the CURRENT development to 1e-4, so in practice the rebuild runs at least monthly.
- Control reads `proximity` through the static `proximity_to_capital` (scale proximity/100,
  location_modifier_scales.md) — 0.75 x proximity/100 of `local_max_control`.

### 1.8 Open questions (proximity)

1. G residual 0.0150 for Spain (1.5).
2. River adjacency type source (map loader); which pairs are "river" is only approximated (1.6). **Calibrated** instead:
   `river_calibrate.js` labels pairs from every country's tree in a save (fits each country's G by pricing its steps,
   building speed x staffing x goods access; a step priced 12 is a river, a step priced as road/plain when 12 was
   cheaper is not, and an image river that would beat the stored child value is not). June 1547: 145 countries fitted
   (Spain 0.485), 7,681 pairs labelled; the 4 px image rule gets 93.2% of them right (421 false, 104 missed) and every
   stricter variant does worse (touch: 90.7%), so the game's links are not an image rule (river map mode: links follow
   the flow between location centres and alternate banks where the river is a border). With the labels Spain is
   522/522 within 1 point, median 0.001 at the stored G.
3. The full list of dirty-flag triggers (FUN_1426f0d10, FUN_142d6e490/eaa0, FUN_143166bb0/7550, FUN_143ab7e50 not
   read) and the exact tick of FUN_1425bfcd0 / FUN_14279f400 (daily or monthly).
4. Frozen-water branch (location+0x13d0 == 1, cost F) and `Gl` were read in code only (Spain has neither).
5. Whether proximity can exceed 100 when `local_proximity_source_modifier` > 0 (cap is applied before the modifier).

---------------------------------------------------------------------------------------------------------------

## 2. DEVELOPMENT AND PROSPERITY — monthly change

Getters: FUN_1430cc5b0 = monthly development change (tooltip wrapper FUN_1430cc550), FUN_1430cb200 = monthly
prosperity change (wrapper FUN_1430cb1a0, tooltip keys PROSP_CHANGES_BY_DUE_TO, RECOVERY_DUE_TO "As prosperity is
below 0, it recovers by X due to", PROSPERITY_DECAY "Decay: X", PROSP_DEC_TT "Decay is X% of current Prosperity due
to"); FUN_14313de00 = add to prosperity with clamp, FUN_1431713b0 = set prosperity with clamp. `code`
Modifier indices: local_monthly_prosperity 0x14f0a36fa, local_monthly_development 36fc, global_monthly_prosperity 36fe,
global_non_rural_monthly_prosperity 3700, global_monthly_development 3702, global_non_rural_monthly_development 3704,
local_prosperity_decay 3706, global_prosperity_decay 3708, local_/global_monthly_development_modifier 38e8/38ea,
local_/global_devastation_recovery 3990/3992.

### 2.1 Development (FUN_1430cc5b0) `code` + `save-checked`

```
urban = location rank is non-rural (rank object at location+0xd38, flag +0x308; town/city/megalopolis)
d  = local_monthly_development + owner.global_monthly_development + (urban ? owner.global_non_rural_monthly_development : 0)
if d > 0:
    d = d x (1 + max(-1, local_monthly_development_modifier))       # location modifier only
    d = d x (1 + max(-1, owner.global_monthly_development_modifier)) # then the country one, multiplicative
development += d   once a month (no define caps development; a negative d is not scaled by the modifiers)
```
- `local_monthly_development` sources: static `prosperity` 0.004 x prosperity (prosperity > 0), static `devastation`
  0.004 x prosperity (prosperity < 0, so negative), capital_connection_modifier 0.05, religious-order and event
  statics (0.001-0.005), building `modifier`s. Country `global_monthly_development`: laws (merindad_policy 0.001),
  privileges (urban_development_grants 0.001), ruler trait architectural_visionary 0.002, auto modifiers
  balanced_harmony 0.001 / negative_harmony -0.001, ...
- `local_monthly_development_modifier` sources: topography (mountains -0.5, hills -0.25, plateau -0.1, wetlands -0.3),
  vegetation (desert -0.33, farmland +0.1, woods -0.2, forest -0.25, jungle -0.3), `river_flowing_through_<n>` +0.05 x n,
  `supreme_court` capital_modifier +0.1, reform `harbor_administration` +0.1 (coastal), pop literacy (burghers
  literacy_impact), buildings.
- Timing: monthly, every location on the 1st (two save intervals of 14 and 48 days both contain one tick; the
  per-location changes of the two intervals have ratio 1.00 median, p10/p90 1.00/1.03). `save-checked`
- The `prosperity` static inside `local_monthly_development` uses the prosperity of ONE MONTH EARLIER (the location
  modifier set used at the tick was built before the previous prosperity step). Pricing it with the current
  prosperity is 1% too high; with p(previous month) the error drops to the save's rounding. `save-checked`

Check (`prox_tmp\devcheck.js`, engine location modifiers + the formula, saves of game 566ad5a2: country scenario from
SP_BRZ_1342_04_20 / SP_HAL_1342_05_04, observed change in the next save; |error| in development units):

| country, interval | n | current p: < 1.5e-5 / p50 | lagged p: < 1.5e-5 / p50 / p90 |
|---|---|---|---|
| CAS 4.20 -> 5.4 | 183 | 166 / 9.1e-6 | 181 / 3.3e-6 / 7.6e-6 |
| CAS 5.4 -> 6.21 | 183 | 161 / 9.0e-6 | 181 / 3.3e-6 / 8.0e-6 |
| HUN 5.4 -> 6.21 | 182 | 152 / 9.3e-6 | 167 / 4.0e-6 / 9.1e-6 |
| ENG 5.4 -> 6.21 | 148 | 124 / 1.0e-5 | 139 / 3.1e-6 / 8.8e-6 |
(the save stores 5 decimals, so 1e-5 is the noise floor)

Worked example, Avila (CAS, town, hills, 1342.4.20 -> 5.4): prosperity 0.2103, previous month 0.2077;
`local_monthly_development` = 0.004 x 0.2077 = 0.000831; modifier = hills -0.25 + burgher literacy +0.023 = -0.227;
d = 0.000831 x 0.773 = 0.000642 (save 19.02055 -> 19.02119 = +0.00064).

### 2.2 Prosperity (FUN_1430cb200) `code` + `save-checked`

```
dp = local_monthly_prosperity + owner.global_monthly_prosperity + (urban ? owner.global_non_rural_monthly_prosperity : 0)
if prosperity < 0:  dp += local_devastation_recovery + owner.global_devastation_recovery     # RECOVERY_DUE_TO
elif prosperity > 0: dp -= (local_prosperity_decay + owner.global_prosperity_decay) x prosperity   # PROSPERITY_DECAY
prosperity = clamp(prosperity + dp, NLocation.PROSPERITY_MIN -1, NLocation.PROSPERITY_MAX 1)    # FUN_14313de00
```
- Negative prosperity IS devastation (one field, location+0xd00): the location gets the `devastation` static scaled
  by the negative value instead of `prosperity` (location_modifier_scales.md). No decay below 0; recovery is additive.
- Sources: `location_base_values` local_monthly_prosperity 0.0025 and local_devastation_recovery 0.0025; static
  `average_satisfaction_inverted` local_monthly_prosperity -0.0025 x (1 - average pop satisfaction); buildings 0.001
  each (town_buildings l.669 etc.), town rights 0.001-0.002, `banking_birth` 0.01, event statics;
  country base `global_prosperity_decay` 0.01 (auto_modifiers/country.txt), positive_harmony +0.02 decay,
  balanced_harmony +0.002 monthly, privilege `market_fairs` 0.0025, reform `agricultural_cultivation` 0.001,
  advance `cas_repoblaciones` 0.001, many country statics +-0.001..0.005.
- Timing: monthly (as 2.1). The decay uses the CURRENT prosperity; satisfaction-type terms come through the cached
  modifier set.
- Check: CAS 4.20 -> 5.4: 166/183 within 1e-4, median |error| 2.6e-5 (residual = pop satisfaction drift inside the
  month); HUN 182/182 within 1e-4 (median 2.6e-5); ENG has a constant -2.8e-4 offset on every location (a country
  term from_save.js does not list — open). Avila: 0.0025 - 0.0025 x 0.5475 + 0.0035 - 0.01 x 0.2103 = +0.00253
  (save +0.00260). `save-checked`

### 2.3 Open questions (development / prosperity)

1. Engine order of the monthly steps (why the development step sees last month's prosperity): the applier was not
   found (the getters have only UI/tooltip callers; the tick inlines or reaches them through a function table,
   FUN_143131490 references the prosperity wrapper).
2. ENG's -2.8e-4/month prosperity offset (country modifier missing from the scenario's sources).
3. Negative development change and devastation recovery were read in code only (no devastated location in the pair).

---------------------------------------------------------------------------------------------------------------

## 3. RGO SIZE AND RGO EMPLOYMENT

### 3.1 Max RGO size — FUN_1425fd6d0 (2.3 KB) `code` + `save-checked`

```
urban   = rank non-rural (rank+0x308)
maxRGO  = local_max_rgo_size x (1 + local_max_rgo_size_modifier + owner.global_max_rgo_size_modifier
                                 + (urban ? owner.global_max_rgo_size_modifier_in_non_rural
                                          : owner.global_max_rgo_size_modifier_in_rural))
local_max_rgo_size = location_base_values 2 + static development 0.1 x development
                     + static total_population 0.025 x population(k) + building/event terms
```
- Modifier indices: local_max_rgo_size 0x14f0a3614, local_/global_max_rgo_size_modifier 360e/360c,
  global_..._in_rural 3610, global_..._in_non_rural 3612. The three modifiers are ADDED inside one (1 + ...) factor
  (not multiplied); no clamp or rounding inside the getter. `code`
- Local modifier sources: rank `rural_settlement` +1.0 (`megalopolis` -0.5), vegetation farmland +0.1, laborers
  `literacy_impact` local_max_rgo_size_modifier 0.1 x (average laborer literacy / 100) (literacy 40 -> +0.04),
  buildings. Spain 1547 country: advances
  rgo_size_advance_discovery / _renaissance +0.1 each (global), rural_rgo_disc_advance 0.2 + rural_rgo_traditions 0.1
  + societal value capital_economy +0.33 (in_rural, total 0.63), renaissance_urbanisation +0.1 (in_non_rural).
- Save field `max_raw_material_workers` = the location's CURRENT RGO level (thousands of workers), not the max: it
  grows by RGO expansions (estates spend on it, estate `next_spend=RGO rgo=<loc>`; expansion price FUN_142584020,
  economy_control.md 2.1) up to floor(maxRGO), and is not reduced when the max falls. `inferred` from the save:
  443/522 Spanish locations are exactly floor(maxRGO), 76 are below it (not yet expanded), 3 above (max fell after
  expanding: Albi 11 vs 9.1, Toledo 13 vs 10.5, Onate 8 vs 6.7). `save-checked` (`prox_tmp\rgocheck.js`).
- Sevilla (city): local_max_rgo_size = 2 + 0.1 x 60.549 + 0.025 x 136.15 = 2 + 6.055 + 3.404 = 11.459;
  modifiers = farmland 0.1 + laborer literacy 0.04 + global 0.2 + non-rural 0.1 = 0.44;
  11.459 x 1.44 = 16.50 -> RGO level 16 (save 16). The "+40% unexplained" of economy_control.md 2.1 is this 0.44
  modifier sum (the engine.js rgoSize misses the in_rural / in_non_rural term).
- Static slot `T+0x320` IS `rgo_level` (static_reg.c l.1690: the registration passes `table + 800` decimal = 0x320
  with the string "rgo_level" at 0x14c7e2cd5, length 9). Scale = location+0xcf8 = the current RGO level; block
  `local_laborers_desired_pop = 1` (one desired laborer pop unit per level). `code`

### 3.2 RGO employment `save-checked`

```
rgoWorkers = min(RGO level, laborers of the location)        # only laborers; the RGO is filled BEFORE buildings
```
- Only `laborers` carry `pop_stats.<type>.employed_in_rgo` (522/522 Spanish locations). 376 RGOs are full; in all 146
  others `employed_in_rgo` equals the location's whole laborer population (to 2e-3) and there are no unemployed
  laborers, even where buildings have unfilled laborer jobs (Beteta: 7.151k laborers, RGO 11 -> 7.151 in the RGO,
  building laborer jobs 1.25k left empty). Peasants never work the RGO (they are counted as unemployed /
  subsistence farmers). `save-checked`
- Output per worker and the raw-material modifier: FUN_14313b840 returns
  `1 + local_raw_material_output + local_<good>_output_modifier (good+0x144) + global_raw_material_output
  + global_<good>_output_modifier (good+0x146)`, floored at 0 (modifier indices 0x14f0a36f6 / 36f8; the per-good
  indices sit on the goods object). This answers economy_control.md open question 2/3 for RGOs: the good-specific
  output modifiers are added into the same (1 + ...) factor. `code`

---------------------------------------------------------------------------------------------------------------

## 4. TAX: the factor F in `paid_taxes = taxable_income x tax_rate x F` (economy_control.md 1.3)

FUN_14278b0b0(country, estate, rate) (callers FUN_142753b00 47 KB = monthly country economy, UI) `code`:
```
if country.enable_taxation <= 0: paid = 0
base = estate.taxable_income (estate+0xa0, or +0x130 when 0) x (1 - country.estate_enrichment)     # FUN_142744260
paid = base x rate x (1 + max(-1, country.tax_income_efficiency))
```
Tooltip lines ESTATE_TAXABLE_INCOME_ENTRY_LOCATIONS, ESTATE_TAXABLE_INCOME_ENTRY_ENRICHMENT (shows -enrichment),
ESTATE_TAXABLE_INCOME_ENTRY_TAX_INCOME_EFFICIENCY. So F = (1 - estate_enrichment) x (1 + tax_income_efficiency).

Spain 1547 (`prox_tmp\tiescan.js` scans every law/privilege/reform/advance object of the country block, vanilla + mod):
tax_income_efficiency = abacus_advance 0.02 + right_of_possesion 0.03 + treasury_rights 0.02 +
the_court_of_wards_and_liveries 0.03 + royal_council_of_castile 0.05 = 0.15, + cabinet trait `tax_optimizer` 0.01
(minister Joseph Ferdinand) = 0.16; estate_enrichment = ledgers_double_checking -0.05 (no bureaucracy).
F = 1.05 x 1.16 = 1.218 vs observed 1.2475 (nobles 1.2470, burghers 1.2476, peasants 1.2475) — 2.4% short
(equivalent to a missing +0.028 tax_income_efficiency). `code` for the formula, residual open.

---------------------------------------------------------------------------------------------------------------

## 5. Summary of open questions

1. Proximity: Spain's G residual 0.0150; river adjacency source; full list of proximity-dirty triggers; frozen water
   and `land_cost_on_distance_from_capital_speed_propagation` only read in code (1.8).
2. Development/prosperity: the engine order that makes the development step use last month's prosperity; ENG's
   -2.8e-4 prosperity offset; negative development and devastation recovery unchecked (2.3).
3. RGO: when exactly an RGO level is added (estate/AI expansion rule) — only "level <= floor(max)" is checked (3.1).
4. Tax: F residual +0.028 tax_income_efficiency for Spain (4).

## 6. Function / address index (eu5.exe 1.4.4)

- Proximity: FUN_1427175b0 segment cost; FUN_142717450 wrapper (neighbour index, road); FUN_14271c460 sea cost by
  maritime presence; FUN_143158bf0 source strength; FUN_143ab4f10 search initialisation; FUN_143ab4e60 edge callback;
  FUN_142720030 / FUN_142895e00 / FUN_142896780 search; FUN_1425c9c80 country rebuild (dirty flag country+0x3136);
  FUN_1428969e0 path to the nearest source; FUN_1430d7110 location proximity tooltip; FUN_143edd6f0 location modifier
  refresh (sets the dirty flag on source change); dirty setters FUN_1427657a0 (owner change), FUN_142aaf320 (overlord),
  FUN_142aac820 (scripted proximity), FUN_1426f0d10, FUN_142d6e490, FUN_142d6eaa0, FUN_143166bb0, FUN_143167550,
  FUN_143ab7e50.
- Modifier index globals: land 0x14f0a35da, road 35d8, sea_maritime 3730, sea 3732, port 3734, transition 3736,
  upstream 3738, downstream 373a, frozen 373c, land speed 373e, global speed 3740, local speed 3742,
  local_port_cost_distance_impact 3744, local_proximity_source_modifier 3746, local_proximity_source 3576.
- Defines: NCountry.PROXIMITY_TERRAIN_SPEED_FLOOR 0x14faf9760; NLocation.PROSPERITY_MIN/MAX 0x14fb20cb8 / 0x14fb20918.
- Development / prosperity: FUN_1430cc5b0, FUN_1430cb200, FUN_14313de00, FUN_1431713b0; GUI datafunctions
  FUN_1481df7e0, FUN_1481df540.
- RGO: FUN_1425fd6d0 max size; FUN_14313b840 raw-material output factor; FUN_143155d80 (1 + local/global raw material
  output, subsistence side).
- Tax: FUN_14278b0b0 paid taxes, FUN_142744260 taxable base x (1 - enrichment).
- Decompiles: `E:\Tools\ghidra-projects\locsim_prox\prop1.c` (tooltip, wrapper, sea cost), `path1.c`, `dijk1.c`,
  `dijk2.c` (search, callbacks, rebuild), `dirty.c`, `devpros.c`, `devapply.c`, `rgo.c`, `taxeff.c`, `taxbase.c`,
  `cache_fill*.asm`, `dirty_ctx.asm`; cost function in `...\locsim_eco\control_prox_rgo.c`.

## 7. Scratch files (`...\scratchpad\research\prox_tmp\`)

- Extraction: `cache.js` (Spain cache + roads -> cache.json), `maritime.js` (maritime.json), `tr.js` (townrights.json),
  `binputs.js` (binputs.json: employed/level/input of every building), `world.js` (all locations + every country's
  cache; world.json, w_SP_*_1342_*.json), `rivers.js` / `rivdist.js` (river_pairs*.json, river_dist.json).
- Proximity: `solve.js` (solver, `ORACLE=1` uses observed river flags), `edges.js`, `rivtest.js`, `vegtest.js`,
  `examples.js`, `harb.js`.
- Development / prosperity / RGO / tax: `devcheck.js` (+ cas/eng/hun_1342*.json scenarios), `devpair*.js`, `prosk*.js`,
  `rgocheck.js`, `tiescan.js`.
