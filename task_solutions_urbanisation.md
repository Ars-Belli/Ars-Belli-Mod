# Task solutions — urbanisation limits

claude --resume 8049983e-390f-4781-ac1e-439576128e08

Branch: `feature/urbanisation-limits` (branched from `d554378`, `game.1.3.11.mod.18`).

Same format as `task_solutions.md`: one requirement per section, recording what the request was,
what the engine actually allowed, what was built, and anything left open.

Status summary:

| Nr. | Requirement | Status |
|---|---|---|
| 1 | Cap the number of towns/cities/megalopolises like the fort limit | Done — needs one in-game load check, see Open items |
| 2 | Make "Downgrade Location" step down one rank instead of razing to rural | **Not possible on the vanilla action — engine-locked.** Built a parallel action instead |
| 3 | Show the limit to the player, and warn when over it | Done — counter top-right, red past the cap. **A real alert is not possible** (the engine never builds a static alert banner). Layout needs one re-check, see Open items |
| 4 | −5% tax efficiency per point over the limit, and a mutable alert | Done — penalty as an auto_modifier; the alert is a monthly popup muted from the Tier List panel, mirroring the fort-limit one. Needs an in-game check, see Open items |
| 5 | Put the research term on each age's root advances instead of standalone advances | Done — `INJECT:` into six vanilla root advances. Needs an in-game check, see Open items |

---

## Nr.1 — urbanisation limit ("Urban Capacity")

**Request.** A limit on how many towns / cities / megalopolises a country may hold, in the shape
of the fort limit. Base of 10 towns; a city counts as 2 towns, a megalopolis as 4. Innovations
raise the limit, and the number of locations contributes on top of the base, as it does for forts.

**What the engine allows.** There is no engine-side urbanisation cap to bend, so this is built out
of three data mechanisms that do exist:

1. `modifier_type_definitions` is a normal multi-file database (vanilla ships `00_modifier_types`,
   `01_byz`, `02_generic_bureaucracies`), so a mod can add its own country modifier types. They
   carry no engine meaning but are readable from script through `modifier:<name>` — the same way
   vanilla reads `modifier:num_bailiffs` in the bailiff building's `allow`.
2. The `country_modifier` block of a `location_rank` is applied **once per location of that rank**.
   Vanilla relies on this for `monthly_doom` (0.01 / 0.03 / 0.06) and for the city's `fort_limit = 1`
   — which is exactly what the mod already cancelled with an `INJECT` of `-1`. So the engine will
   sum a per-country counter for us for free, with no iteration and no monthly pulse, and it is
   exact the instant a rank changes.
3. The `allow` block of a `location_rank` is the gate the "Found Town" / "Grant City Rights" /
   "Found Megalopolis" buttons run through, for the AI as well as the player.

**What was built.** Town points: **town = 1, city = 2, megalopolis = 4.**

| Term | Where | Value |
|---|---|---|
| Base | `INJECT:country_base_values`, `in_game/common/auto_modifiers/abm_country.txt` | **10** |
| Locations | new `abm_urbanisation_locations_impact`, same file | **+1 per 20 locations** |
| Population | new `abm_urbanisation_population_impact`, same file | **+1 per 400k people** (`total_population` is in thousands, so `divide = 400`) |
| Rank | `INJECT:rank_*` in `in_game/common/country_ranks/abm_country_ranks.txt` | **+1 duchy, +2 kingdom, +4 empire** (county +0) |
| Research | `INJECT:` into one root advance per age, `in_game/common/advances/abm_urbanisation_advances.txt` (Nr.5) | **+5 per age × 6 ages = +30** |

Files:

- `main_menu/common/modifier_type_definitions/abm_urbanisation.txt` — the two country modifier
  types, `abm_urbanisation_limit` (the cap) and `abm_urbanisation_used` (the count). Icons in
  `main_menu/common/modifier_icons/abm_urbanisation.txt`, reusing existing vanilla textures. Both
  appear as rows in the **Ledger → Modifiers tab** (`in_game/gui/player_modifiers_lateralview.gui`,
  opened by the `MODIFIERS_TEXT` tab in `ledger_tabs_template`), which is where every country
  modifier is listed. **Not** the government panel — that has no modifier list.
- `in_game/common/location_ranks/00_default.txt` — `abm_urbanisation_used = 1 / 2 / 4` in the
  `country_modifier` of town / city / megalopolis, and the gate in each `allow`: town and city
  need 1 free point, megalopolis needs 2.
- `in_game/common/script_values/abm_urbanisation_values.txt` — `abm_urbanisation_free_points`,
  i.e. limit − used. A named script value works as a trigger left-hand side; vanilla precedent is
  `strength_ratio_for_garrison_sortie` in `generic_actions/siege.txt`.
- `in_game/common/advances/abm_urbanisation_advances.txt` — the research term. Originally six
  standalone advances, one per age, each hung off that age's town-rights/city advance; since Nr.5
  an `INJECT:` of the +5 into one vanilla root advance per age.
- `main_menu/localization/english/abm_urbanisation_l_english.yml` — modifier type names and
  descriptions, the auto-modifier name and the three condition tooltips. (The six standalone
  advances' names and descriptions went with them in Nr.5.)

**Two decisions worth recording.**

`location_ranks/00_default.txt` is now a **same-name full-file replacement** (added to
`replaced_files.txt`) and the old `abm_location_ranks.txt` `INJECT` file is deleted, its
`fort_limit` edit folded in as `fort_limit = 0` on the city. `INJECT:` demonstrably merges
*numbers* inside a modifier block — that is what the old `fort_limit = -1` + vanilla `1` = `0`
trick depended on — but its behaviour on a **trigger** block such as `allow` is unverified, and
the failure mode there is a silent no-op that logs nothing and quietly deletes the whole feature.
The file is 203 lines and changes rarely, so determinism was worth the maintenance. This is the
same lesson as `REPLACE:` in `generic_actions` (Nr.3 of the previous batch) and the GUI slider
`max` (Nr.16): confirm an override took, or use the mechanism that cannot silently no-op.

Every gate is wrapped so that it **fails open**:

```
trigger_if = {
    limit = { owner ?= { modifier:abm_urbanisation_limit > 0 } }
    custom_tooltip = { text = abm_urbanisation_town_tt  owner ?= { abm_urbanisation_free_points >= 1 } }
}
```

If a mod-added modifier type ever fails to register, `abm_urbanisation_limit` reads 0, the
`trigger_if` is skipped and founding works exactly as in vanilla. The alternative wiring would
have locked every town, city and megalopolis upgrade in the game permanently.

**Calibration.** The size term has been retuned twice after in-game loads: from +1 per 10
locations, to +1 per 20 locations plus +1 per 250k people, and then — 250k being too generous —
to **+1 per 20 locations plus +1 per 400k people**. Counting the `own_*` lists in
`setup/start/10_countries.txt` against `06_pops.txt`, England starts with 138 locations, 3.0M
people, 12 towns and London — 14 points used against a limit of 10 + 2 (kingdom rank) + 6.9 + 7.5 ≈ 26 (≈ 24 without the rank
bonus, which is also what the original term gave; an earlier count of 155 locations gave 25). Globally the start has 884
towns, 312 cities and 3 megalopolises.

At 400k the retune is close to neutral overall but still redistributes. An average location holds
18.9k people (median 8.2k), so +1 per 400k is worth about +0.47 per 10 locations on its own, and
summed over every country the size term grows ×1.15 (1,358 → 1,565; it was ×1.54 at 250k, and
~520k would be exactly neutral). Capacity still moves to dense countries and away from sparse ones:
China 166 → 290, Delhi 37 → 118, Japan 34 → 42, France 16 → 22, while the Golden Horde drops
74 → 45.

The tunables are one line each: the `10` in `country_base_values`, the `divide = 20` in
`abm_urbanisation_locations_impact`, the `divide = 400` in `abm_urbanisation_population_impact`,
the three rank values in `country_ranks/abm_country_ranks.txt`, and
`@abm_urbanisation_limit_increase` at the top of the advances file. Both divisors are also
written into the auto-modifiers' loc names ("1 Urban Capacity every 20 locations" / "… every
400k people"), which is what the breakdown tooltip shows, so a retune has to change those too.

**Left open.**

- The check reads **completed** ranks only, so several upgrades ordered in the same tick can
  overshoot the cap. Each still costs its gold, goods and a year of build time, so it is expensive
  rather than free, but it is a hole. There is no country-scope "rank upgrades in progress" trigger
  to close it with — `num_civil_constructions` is per location and counts buildings too.
- Being over the cap after conquest is allowed. It blocks founding and upgrading until you are
  back under, and since Nr.4 it also costs 5% tax efficiency per point over.
- Subjects have their own limit, so a large subject network is a legitimate way to hold more towns
  than the cap. That mirrors vanilla, where the overlord may upgrade a subject's location.

---

## Nr.2 — downgrade a location one rank instead of all the way to rural

**Request.** The vanilla "Downgrade Location" button turns any urban location straight into a rural
settlement, whatever it was. Make it turn a megalopolis into a city and a city into a town instead;
failing that, add an action that steps an urban location down one level.

**What the engine allows.** Not the first option. The vanilla downgrade is engine-implemented end to
end: `location_window.gui` only calls `Location.CanDowngradeRank`, `Location.GetDowngradeRankPrice`,
`Location.GetDowngradeRankDescription` and `DowngradeLocationRank(Location.Self)`. There is no
"next rank down" field in `location_ranks` and no other data entry point — the entire moddable
surface is `prices/01_buildings.txt` → `rural_settlement_downgrade` (100 gold) and the
`DOWNGRADE_LOC_RANK_*` loc keys, both of which confirm the destination is hardcoded to rural
("It is not possible to downgrade **to a rural settlement** when a location is occupied").

The `change_location_rank = location_rank:X` effect *is* scriptable, though — vanilla uses it in
`scripted_effects/location_effects.txt` — so the second option is straightforward.

**What was built.** `in_game/common/generic_actions/abm_downgrade_location_rank.txt`, one step per
use: megalopolis → city → town → rural settlement. 100 gold via a new
`price:abm_downgrade_location_rank` in `abm_prices.txt`, matching what vanilla charges to raze but
kept separate so it can be retuned alone. Blocked while the location is occupied or under siege.
`ai_tick = never` and `automation_tick = never`. Loc in
`in_game/localization/english/abm_downgrade_location_l_english.yml`.

Two shape decisions:

- **`type = owncountry` with a location `select_trigger`, not `type = location`.** The
  `generic_actions/readme.txt` does list `location` as a type, but **no vanilla action uses it** —
  the well-trodden shape is an owncountry action with `looking_for_a = location`, as in
  `generic_actions/international_organizations.txt`.
- **The button goes in the location right-click menu** (`in_game/gui/context_menu.gui`, search
  `# Ars Belli: step a location down one rank`), which the mod already replaces, so it costs no new
  maintenance. `ContextMenuActionEntry` is defined as `action_button_regular`, so a generic action
  drops straight in, and
  `parameter = { parameter_name = "target" parameter_value = "[Location.MakeScope]" }` pre-fills
  the target so the map picker is skipped. Copied from vanilla's own
  `add_location_to_international_organization` entry in the same menu.
  **`location_window.gui` is 10,593 lines and was deliberately not replaced for a button** — the
  same call that was made against `diplomacy_macrobuilder_lateralview.gui` in the previous batch.

**Left open.** The vanilla "Downgrade Location" right-click still exists and still razes all the
way to countryside; the new action's description says so. Hiding it would mean replacing
`location_window.gui`, which is not worth it.

---

## Nr.3 — show the limit where the player can see it

**Request.** After Nr.1 landed, the only readout was the two modifier rows in the Ledger's
Modifiers tab — a sortable list of several hundred entries, which is not where anyone looks
before pressing "Found Town". Add a permanent readout, and a warning when over the cap.

**What the engine allows.** Two different answers for the two halves.

The readout is unremarkable: the mod already replaces
`in_game/gui/panels/right_panel/right_panel.gui`, and already draws its multiplayer point
counters there out of `customizable_localization` + named `script_values`. The urbanisation
counter is the same shape, so it cost no new mechanism.

The warning **cannot be an alert**. `alert_banner` takes the *name of an alert the engine fires*
(`is_over_fort_limit`, `has_weather_system`, …) and looks it up in the `AlertEntry` data model
that `alerts_layout` is fed from `[InGameTopbar.AccessAlertManager]`; `common/alert_descriptions`
only supplies each engine alert's title, icon, priority and hint.

A static banner parented into `type alert_manager` in `alertmanager.gui` was tried and **does not
work — the engine never builds it.** The proof is in the log: its `visible` used the same
`GetModifierValueNoFormat` → `*_CFixedPoint` comparison that spammed `FetchData failed` from the
right panel every frame (see below), yet it logged nothing at all, so it was never evaluated. It
was removed, and `alertmanager.gui` is back to its pre-Nr.3 state. The over-cap warning is now
the counter itself turning red.

The remaining fallback, not built: `common/scriptable_hints` is a genuinely moddable,
script-triggered database — `hint_cultural_capacity` fires on
`used_cultures_capacity > modifier:cultures_capacity`, exactly this shape — but it surfaces only
in the Hints lateral view, which the mod does not replace and whose per-hint icon blocks are
hardcoded `EqualTo_string` comparisons.

**What was built.**

| Piece | File |
|---|---|
| `abm_urbanisation_used_points`, `abm_urbanisation_limit_points` — named values so loc can read the two modifiers back | `in_game/common/script_values/abm_urbanisation_values.txt` |
| `abm_urbanisation_display` — picks a normal / yellow / red loc key from `abm_urbanisation_free_points` | `in_game/common/customizable_localization/abm_urbanisation_custom_loc.txt` |
| The counter, top of the right-hand stack on the panel bar; the Age label and icon shrunk to make room | `in_game/gui/panels/right_panel/right_panel.gui` |
| `ABM_URBAN_CAPACITY_*` | `main_menu/localization/english/abm_urbanisation_l_english.yml` |

The counter reads `Urban: 14 / 25`, turns **yellow** with no free points and **red** past the cap,
carries a tooltip with the used / capacity / free breakdown and what the capacity is made of, and
opens the Ledger's Modifiers tab on click. The capacity figure in that tooltip is
`[GetPlayer.GetModifierValue('abm_urbanisation_limit')]` rather than the script value, so
hovering it opens the engine's own modifier breakdown — base, the two size terms, each advance —
the same one the Ledger shows. That is the vanilla idiom (`local_governor_tt` in
`buildings_l_english.yml`); `GetModifierValueWithNoTooltipNoSign` exists precisely to suppress it.

Layout, as revised after the first in-game load:

- **The counter lives on the right, not the left.** The first version stacked it above the three
  MP point counters on the left, but the bar above the tabs is only ~55px tall and AP / DP / GR
  already fill it exactly (3 × 15 + 2 × 5), so the guarantee row was pushed out. It now sits in the
  right-hand stack between the MP rank label and the Tier List button:
  15 + 1 + 16 + 1 + 22 = 55. The rank block was split into two separately-`visible` rows to make
  room for it, with `MP_RANK_TOOLTIP` and the `GetPlayer` datacontext moved onto the label. To
  fit, the rank label went from `margin = { 5 0 }` to `{ 5 -4 }` —
  the same compaction the left-hand counters use — and the spacing from 2 to 1. In single-player
  the MP rows are hidden (`ignoreinvisible = yes`) and the counter centres vertically on its own.
- **The Age label is smaller** — `Font_Size_Medium` (18px) → `Font_Size_Small` (15px), icon
  40×40 → 30×30 — because the right-hand stack is up to ~150px wide in multiplayer
  ("MP Rank: 3 Great Power") and long age names were already running into it. It is also nudged
  25px left of centre (`position = { -25 0 }` on its flowcontainer), into the room the short
  AP / DP / GR rows leave on the left; that is the one number to tune if it now crowds them.
- **No visibility guard on the counter.** The first version hid it unless
  `abm_urbanisation_limit > 0`, written as
  `GreaterThan_CFixedPoint(GetPlayer.GetModifierValueNoFormat(...), '(CFixedPoint)0')`.
  `GetModifierValueNoFormat` is not a CFixedPoint, so every frame logged
  `pdx_gui_data_manager.cpp:233: FetchData failed … right_panel.gui:60`. The guard only existed
  for the case where the modifier types fail to register, and the same log shows no registration
  errors, so it was dropped rather than re-guessed. All colour logic stays in
  customizable_localization, where the triggers are typed script.

**Left open.** No alert — see above. If the red counter isn't enough, the scriptable hint is the
next step.

---

## Nr.4 — a penalty for being over the limit, with an alert

**Request.** Like the fort limit: −5% tax efficiency for every point over Urban Capacity, and an
alert that can be muted like the fort-limit one.

**The penalty** is an ordinary auto_modifier, the same shape as the mod's `abm_over_fort_limit_*`:

- `abm_over_urbanisation_limit` in `in_game/common/auto_modifiers/abm_country.txt`:
  `potential_trigger = { abm_urbanisation_points_over > 0 }`,
  `scales_with = { value = abm_urbanisation_points_over }`, `tax_income_efficiency = -0.05`.
  Named "Over Urban Capacity".
- `abm_urbanisation_points_over` in `script_values/abm_urbanisation_values.txt` — whole points
  over the limit, floored at 0. A named script value in `scales_with` has vanilla precedent
  (`byz_greek_traders_count`).
- **The limit is now rounded** before anything compares against it (`round = yes` in
  `abm_urbanisation_free_points` and `abm_urbanisation_limit_points`). Since the Nr.1 retune the
  size terms are fractional, so without this a 28.7 limit with 29 used read "29 / 29" in red and
  took a −1.35% penalty for being 0.3 over. Now the gates, the colour, the penalty and the counter
  all agree on the displayed whole number. The side effect runs the other way too: at 28.6 the
  gate treats the limit as 29, so rounding can allow one founding the raw value would have refused.

**The alert** copies the mod's own fort-limit popup piece for piece — that is the fort-limit alert
with a mute; vanilla's engine alert has no equivalent a mod can add (Nr.3):

| Fort limit (existing) | Urban Capacity (new) |
|---|---|
| `mp_limits_apply_fort_limit_alert` in `scripted_effects/abm_scripted_effects.txt` | `abm_urbanisation_apply_alert` in `scripted_effects/abm_urbanisation_effects.txt` |
| called from `mp_limits_monthly_pulse` in `on_action/mp_limits_on_actions.txt` | called from the same pulse, right after it |
| event `abm_mp_limits.2` | event `abm_urbanisation.1` in `events/abm_urbanisation_events.txt` |
| muted by `mp_fort_alert_muted` | muted by `abm_urban_alert_muted` |
| toggle `mp_limits_toggle_fort_alert` in `scripted_guis/abm_tier_panel_gui.txt` | toggle `abm_toggle_urban_alert`, same file |
| label `mp_fort_alert_toggle_label` | label `abm_urban_alert_toggle_label` in `abm_urbanisation_custom_loc.txt` |
| button in the Tier List panel | button directly under it |

So: a popup every month a human player is over the limit, on by default, switched off and on from
the Tier List panel.

On top of that the penalty carries `alert = yes`, the one data route to an *engine* alert
(`auto_modifiers/readme.txt`: *"should this modifier show in the alerts when it is active?"*).
Vanilla uses it once, on `ruler_is_not_a_commander_during_war`, and the only generic modifier alert
in `alert_descriptions` is `static_modifier_active` — red, titled "Penalties active", with a list
tooltip. So the penalty should also be listed there, the way vanilla's own fort penalty sits beside
its `is_over_fort_limit` engine alert. That part is inferred from the data; see open item 10.

**Left open.**

- The penalty is **uncapped**: 10 points over is −50% tax efficiency, 20 is −100%, and one conquest
  of a city-heavy region can get there. The fort-limit version is capped (`_under_50` /
  `_over_50`); `max = N` on `abm_urbanisation_points_over` is the one-line change.
- The Tier List panel only exists with multiplayer mechanics on, so in single-player the popup
  cannot be muted — the same gap the fort-limit popup has.

---

## Nr.5 — the research term moves onto each age's root advances

**Request.** Drop the six standalone advances and put the +5 Urban Capacity on a root advance of
each age instead: Agriculture in age 1, Scholarly Treatises in age 2, Printing Press in age 3, and
whichever root fits thematically in ages 4–6.

**What the engine allows.** Each age tree has several roots — the advances with `depth = 0` in
`advances/0_age_of_*.txt`: six in age 1, four in every later age. From age 2 on, all but one root
per age need their institution embraced (`allow = { has_embraced_institution = ... }`); the
exception is the health advance in ages 3–6 and Scholarly Treatises in age 2. Agriculture and
Scholarly Treatises happen to be the roots each age's town-rights branch grows from, but from
age 3 on that branch starts at the health advance (Surgery, Pharmacology, Sanitation,
Vaccination), not at Printing Press — so "the root above town rights" is not the rule behind the
picks, and ages 4–6 were chosen by theme instead: the urban-economy institutions.

**What was built.** `in_game/common/advances/abm_urbanisation_advances.txt` now holds six
`INJECT:` blocks, each adding only
`abm_urbanisation_limit = @abm_urbanisation_limit_increase` (still 5) to a vanilla root:

| Age | Root | Key | Gate |
|---|---|---|---|
| 1 | Agriculture | `agriculture_advance` | none — `starting_technology_level = 1` |
| 2 | Scholarly Treatises | `renaissance_development` | none |
| 3 | Printing Press | `printing_press_advance` | Printing Press institution |
| 4 | Global Trade | `global_trade_advance` | Global Trade institution |
| 5 | Manufactories | `manufactories_advance` | Manufactories institution |
| 6 | Industrialization | `industrialization_advance` | Industrialization institution |

The six `abm_urbanisation_N_advance` advances and their twelve loc keys are gone.

`INJECT:`, not `REPLACE:`: it adds the one line and leaves everything else in each advance to
vanilla, so a game update that changes these advances needs no re-sync. It is the mod's first
`INJECT:` in `advances`, and prefixes are per-database and fail silently where unsupported (the
`generic_actions` lesson in Nr.1), so confirm it took on load — open item 4. No DLC and no other
mod file defines these six advances.

**Consequences.**

- **Agriculture is a starting advance** (`starting_technology_level = 1`). Of the 1,010 countries
  that set a level in `setup/start/10_countries.txt`, 931 start at 1 or higher (915 at 3), so they
  should open with Agriculture — and the age-1 +5 — already researched, where the old age-1 advance
  had to be researched. England should start at about 31 instead of 26 (14 used). The 79 countries
  at level 0 do not get it. If the start should stay where it was, lower the base from 10 to 5.
- **Ages 3–6 arrive with the institution.** A country that has not embraced Printing Press, Global
  Trade, Manufactories or Industrialization cannot take that root and gets no capacity from that
  age, however much else it has researched — a bigger gap between leaders and laggards than the
  old town-rights parents gave.
- The +30 at full tech is unchanged.
- Saves that researched an `abm_urbanisation_N_advance` reference advances that no longer exist;
  start a new campaign.

---

## Open items to check on the first in-game load

1. **Do the two mod-added modifier types register?** This is the one piece that could not be
   verified from the files. Grep `error.log` for `abm_urbanisation_limit` and
   `abm_urbanisation_used`. If they are rejected, the symptom is *no limit at all* rather than a
   broken game — see the fail-open wiring above — and the fallback is to compute "used" from
   `num_of_non_rural` plus `num_location_rank:city` and `num_location_rank:megalopolis`
   (`T + C + 3M` on top of `T + C + M` gives the same `T + 2C + 4M`).
   *First load: no registration errors in `error.log`.*
2. **Does the `allow` gate actually bite?** Take a country at its cap and confirm the Found Town
   button greys out with the "Urban Capacity" tooltip rather than staying live.
3. **Do the tooltips resolve their numbers?** They use `[GetPlayer.GetModifierValue('...')]`, which
   is valid in localization (vanilla precedent in `diplomacy_l_english.yml` and
   `hints_l_english.yml`), but the location-rank `allow` has no named scope so `GetPlayer` is the
   only handle available. A failure shows as an unresolved token in the tooltip, not in the log.
4. **Did the six `INJECT:`s take?** (Nr.5) The tooltips of Agriculture, Scholarly Treatises,
   Printing Press, Global Trade, Manufactories and Industrialization should each show +5 Urban
   Capacity beside their vanilla effects, and `error.log` should have nothing for
   `abm_urbanisation_advances.txt`. A silent no-op shows as the plain vanilla tooltip; the fallback
   is `REPLACE:` with a verbatim copy of each root plus the line, as `abm_supply_depot_advances.txt`
   does.
5. **Does the Reduce Location entry appear** on right-clicking an owned town, and is it absent on
   rural settlements and foreign locations.
6. **Does the right-hand stack fit?** In multiplayer: the MP rank label, then the counter, then the
   Tier List button, all above the tabs without clipping, and AP / DP / GR fit on the left again.
   In single-player: the counter alone, vertically centred. The Age label, nudged 25px left,
   should clear both the rank label and the left-hand counters on the longest age names.
7. ~~Does the over-capacity banner render?~~ **Answered on the first load: no** — the engine never
   builds a static child of `alerts_layout`. Removed; see Nr.3.
8. **Does the counter turn yellow at the cap and red past it,** and does clicking it open the
   Ledger's Modifiers tab. `error.log` should have no `FetchData failed` lines from
   `right_panel.gui`. In the counter's tooltip, hovering the **Capacity** number should open the
   engine's modifier breakdown (base, the two size terms, each advance).
9. **Does the population term register?** `error.log` should have nothing for
   `abm_urbanisation_population_impact`, and the Capacity breakdown should list both size lines,
   "1 Urban Capacity every 20 locations" and "1 Urban Capacity every 400k people". England at the
   start should total about 31 (24, plus 2 for its kingdom rank, plus 5 from Agriculture — Nr.5).
10. **Do the penalty and the alerts work?** Push a country over the cap:
    - Tax Efficiency's breakdown shows "Over Urban Capacity" at −5% per whole point over.
    - The "Urban Capacity Exceeded" popup fires at the next monthly tick, and the Tier List
      panel's "Urban Capacity Popup: ON / OFF" button stops and restarts it.
    - The red "Penalties active" alert lists it. If it doesn't, `alert = yes` does not route to
      `static_modifier_active` — the popup still covers the warning.

Last deployed with `.\deploy.ps1` after the rank bonus.
