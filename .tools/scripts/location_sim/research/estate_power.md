# Estate power (EU5 1.4.4) — research notes, in progress

Sources: in-game tooltips of Spain, 1 June 1547 save (Ars Belli), `in_game/common/estates/00_default.txt`,
`main_menu/common/modifier_type_definitions`, defines `NEstate`. Status tags as in the other notes.

## 1. What the tooltips show

- Estate panel: Crown 27%, Nobles 25% (tooltip: 25.53% = 20,899.88 of 81,851.19 Political Power), Clergy 20%,
  Burghers 24%, Commons 1%, Tribes <1%. The panel **floors** the percentage (25.53% shows 25%). Pop counts shown:
  nobles 105K, clergy 339K, burghers 937K, commons 12.042M, tribes 14,332.
- Nobles' political power 20,899.88 = "105K Nobles 20,547.23" + 352.65 not itemised.
- Location power (nobles): Sevilla 458.73, Córdoba 285.19, Lisbon 283.34, Toledo 257.68, Oporto 241.82, Valladolid
  236.34, Granada 221.42, Vélez-Málaga 217.52, Ventadour 216.31, Murcia 211.84, Coria del Río 160.10, Aranda de Duero
  159.82, Île d'Oléron 158.07, Alvito 157.32.
- Sevilla's breakdown: nobles 2,302 x base 25 (pop type `power_per_pop`) x (1 + local + global):
  - local: Fortress Town +25%, Castle +50%, Plenty of Opportunities (`possible_promotion_percentage`) -0.56%;
  - global: Current Wealth +56.39%, Aristocracy (societal value -93) +46.35%, Economic Base of Subjects +0%,
    privileges/laws/reforms (Offensive Military Doctrine 40, Land Rights 75, Auxilium et Consilium 50, Nobility
    Controlled Serfdom 40, Royal Marriage Rights 50, Primacy of Nobility 100, Elite Council 50, Manorial Courts 50,
    Noble Navy 33, Fuero Viejo 40, Royal Council of Castile -20, Court of Wards +5, Dynastic Administration -10,
    Curtail the Nobility -10), Primary Religion Tolerance 1.00%, five noble commanders "in command" +3.98, +3.98,
    +3.09, +3.89, +3.58%, five noble cabinet members +1.41% each.
  - Check: 2.302 x 25 x (1 + 0.7444 + 6.2232) = 458.5 (game 458.73). `save-checked` for the structure.
- Power effects (nobles above 25%): high_power x (0.2553 - 0.25): max tax -0.53%, levy combat efficiency +0.53%,
  fort maintenance efficiency +0.53% = the `high_power` block x 0.0053. `tooltip`

## 2. What the simulator already has

- `global_<estate>_power` from the country sum: nobles 5.393573 = every privilege/law/reform/societal value line of
  the tooltip, exactly. Clergy 3.76, burghers 3.97, peasants 1.75, tribes 0.25. `save-checked` (nobles)
- `local_<estate>_power` from town rights and buildings; pop type `power_per_pop` (nobles 25, clergy 10, burghers 4,
  laborers 0.0375, peasants 0.025, tribesmen 0.25).
- Pop-based totals with these (no wealth, characters, religion): nobles 18,660, clergy 17,420, burghers 22,353,
  commons 1,050, tribes 4.5.

## 3. Open

1. **Current Wealth** (`COMPARATIVE_WEALTH_POWER_FACTOR` 0.01, cap 1.0): nobles' 664,428 gold gives +56.39% =
   0.01 x gold / 11,783. 11,783 is not the treasury (54,629), monthly income (6,781), tax (5,499), the estates' gold
   or any sum of their income lines. Needs another estate's value.
2. **Characters**: `BASE_ESTATE_POWER_FROM_COMMAND` 0.25 (commanders: 0.25 x a share, 0.12-0.16 each here — army
   share?), `BASE_ESTATE_POWER_FROM_CABINET` 0.25 with `estate_power_from_cabinet` / `<estate>_power_from_cabinet`
   (Spain's nobles -0.66 from Curtail the Nobility; court maintenance is at 26%).
3. **Castle +50%**: the castle's `modifier` has `local_nobles_estate_power = 1.0`; Sevilla's castle is fully staffed
   (0.5 of 0.5) with no missing goods and fort maintenance at 100%, yet the tooltip says +50%.
4. **`possible_promotion_percentage`** (static: nobles/clergy/burghers -1, peasants +10 local power): Sevilla 0.0056,
   the other listed locations 0.014-0.144 (game local minus the simulator's). Not jobs vs pops; probably desired pops
   (`local_<type>_desired_pop`), i.e. the promotion model.
5. **Pop counts**: the panel's 937K burghers and 339K clergy vs 1,076.7k and 346.8k pops of those estates in the save
   (nobles 105K = 105.1k). Culture/religion power terms: `ESTATE_CULTURE_<status>_POWER` -0.05..-0.20,
   `ESTATE_RELIGION_HERETIC/HEATHEN_POWER` -0.1/-0.2, `ESTATE_RELIGION_TOLERANCE_SCALE` 0.0025.
6. **Crown**: `crown_power_from_population` (base 1.0; `average_control_50` +0.5 x (average control - 0.5); the
   panel's 61% next to the crown is probably average control) x (1 + `global_crown_estate_power`, Spain 1.198).
   The crown is 27.0-27.9% = 22,100-22,900 of 81,851.
7. The 352.65 of the nobles' power not itemised under pops.
