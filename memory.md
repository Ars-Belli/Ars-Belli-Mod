# Ars Belli Mod - Project Memory

This document provides context for AI agents working on the Ars Belli Mod for Europa Universalis V (EU5).
AI agents will keep this file updated from now on, and use caveman-speak to save up tokens. Care will be taken not to read big files directly unless necessary.

## Project Overview
Ars Belli Mod is a gameplay-focused mod primarily designed for multiplayer sessions. It introduces custom power ranking systems, diplomatic constraints, and extensive military rebalancing.

**Game Path:** `E:\Steam\steamapps\common\Europa Universalis V` (as of May 2026)

## Core Features & Systems

### 1. Multiplayer Power Ranking System (`mp_limits`)
The mod implements a custom ranking system that classifies countries into tiers based on their "Power Score".
- **Tiers:** Great Power (GP), Major Power, Normal, Small, Minor.
- **Scoring:** Calculated via `mp_limits_monthly_calculation` in `in_game\common\scripted_effects\ars_belli_scripted_effects.txt`. It considers:
    - Population score
    - Economic score
    - Manpower & Military strength
    - Navy (Sailors, Heavy Ships, Galleys)
    - Control & Vassal population
- **Classification:** Controlled by game rules (e.g., number of GPs/Majors) set at game start.
- **Triggers:** Use `is_mp_gp`, `is_mp_major`, etc., from `in_game\common\scripted_triggers\mp_limits_triggers.txt` to check a country's rank.

### 2. Diplomatic Limits (Alliance & Defensive Points)
- Uses "Alliance Points" (AP) and "Defensive Points" (DP) to limit diplomatic web complexity in multiplayer.
- Rules are defined in `main_menu\common\game_rules\ars_belli_rules.txt` and localized in `main_menu\localization\english\ars_belli_rules_l_english.yml`.
- Penalties are applied via static modifiers if limits are exceeded.
- **Deduplication:** A country in both an alliance and a defensive league (or PU) with the player counts only once — under DP, not AP. Personal Unions count as defensive alliances (DP) but don't double-count if already in a defensive league. Logic in `in_game\common\script_values\mp_limits_values.txt`.
- **Display:** Player's own AP/DP/GP shown in `right_panel.gui` top bar. Foreign country AP/DP/GP shown in `foreign_country_lateralview.gui`. DP display shows actual (uncapped) values so overflow is visible.
- **Tier Country List Panel:** Click the rank label in `right_panel.gui` → opens an overlay panel listing all countries per tier (GP, Major, Normal, Small, Minor) with flag, name, score. No 20-entry cap.
    - **Storage**: `mp_limits_store_tier_lists` populates `mp_gp_list` / `mp_major_list` / `mp_normal_list` / `mp_small_list` / `mp_minor_list` global variable lists. Two-pass population (every_country into temp buffer `mp_tier_sort_buffer`, then `ordered_in_list` by `var:mp_power_score` to split into tier lists in score-desc order).
    - **Display**: Panel widget embedded in `right_panel.gui` (top|right anchor, search `# Ars Belli tier list panel`). Each tier section uses `dynamicgridbox` with `datamodel = "[GetGlobalList('mp_<tier>_list')]"` — vanilla pattern from `war_of_religions.gui`. Rows are clickable buttons (`OpenDiplomacy(Country.Self)`) with country tooltip.
    - **Toggle**: Per-player UI state via `GetVariableSystem` (client-side, not script vars). Rank label and close button both call `[GetVariableSystem.Toggle('mp_tier_panel_open')]`; panel `visible = "[GetVariableSystem.Exists('mp_tier_panel_open')]"`. Must NOT use global script vars here — those are shared across all MP players (one player opening the panel would open it for everyone). Pattern mirrors vanilla `court_and_country.gui` / `game_rules.gui`.
    - **Tooltip**: `MP_RANK_TOOLTIP` retains score breakdown + per-tier limits/counts (no longer lists countries). Counts via `[GetDataModelSize(GetGlobalList('mp_<tier>_list'))]`.

### 2b. Break Others' Guarantee
- Country interaction allowing a player to break another country's guarantee on them (hostile action).
- File: `in_game\common\country_interactions\break_others_guarantee.txt`
- Requires not being at war. Creates a truce on use.

### 2c. Worsen Opinion
- Country interaction allowing a player to worsen their own opinion of another country (-200 opinion, decays over 10 years). -200 is twice vanilla's Improve Relations cap (`opinion_improve_relation` = +100 in vanilla `biases\00_opinion_hardcoded.txt`) and is the floor of the opinion scale (`OPINION_MAX = 200`).
- Costs one diplomat and has a **1-month per-actor cooldown** (`cooldown = { type = worsen_opinion_cd months = 1 }`). Both exist because the action pushes a notification at the target on every use, and unthrottled spam at another player was reported to be able to crash their client. Per-actor, not per-target: a per-target cooldown still lets a player cycle every country in one sitting.
- Diplomat cost pattern (vanilla `country_interactions\form_closer_bond_iroquois.txt`): `allow = { scope:actor = { num_of_diplomats >= N } }` + `add_diplomats = -N` in the effect. Diplomats are a pool that regenerates at `monthly_diplomats` up to `max_diplomats` — not a permanent capacity, so spending them is a real but temporary cost.
- Cooldown loc key convention is `<cooldown_type>_cooldown` (e.g. `worsen_opinion_cd_cooldown`).
- Files: `in_game\common\country_interactions\worsen_opinion.txt`, `in_game\common\biases\ars_belli_opinion.txt`, loc in `main_menu\localization\english\00_mp_limits_l_english.yml`

### 3. War & Military Rebalancing
- **Ticking Warscore:** Max 36 at +1/month (reduced from 50 because occupations give double warscore post-patch). Defined in `loading_screen\common\defines\01_ars_belli_defines.txt`.
- **Unconditional Surrender:** Removed (base game now has one). Previously in `in_game\common\country_interactions\unconditional_surrender.txt`.
- **Intervene in War / Threaten War / engine Enforce Peace:** all three removed, replaced by the scripted `ars_belli_enforce_peace`. See 3j.

### 3b. Fort Rebalancing
Significant changes to siege mechanics and fort limits (documented in `changes.txt` and `loading_screen\common\defines\01_ars_belli_defines.txt`):
- **Fort Limit:** Base limit of 5. Affected by tech and locations, NOT country rank or city count.
- **Defensiveness:** Removed movement speed/combat bonuses; focuses on scaling siege ability penalties.
- **Offensiveness:** Grants Logistics Distance, Assault Ability, and Siege Ability.

### 3e. Access Diplomacy
- **"Pay for X" sliders:** new country_interactions in `in_game\common\country_interactions\ars_belli_pay_for_access.txt` — `pay_for_military_access`, `pay_for_fleet_basing_rights`, `pay_for_trade_access`, `pay_for_food_access`, `pay_for_fondaco_rights`. Each uses `select_trigger { looking_for_a = value ... }` (pattern from `bribe_voter_for_policy`) to expose a gold slider; default is 12 months of recipient income, min 0, max actor's gold. `effect` transfers gold actor→recipient and `create_relation = { first = scope:recipient second = scope:actor type = relation_type:<X> }`. `ai_will_do = -1000` (AI never proposes these).
- **Auto-accept on the slider-paths for Mil Access / Fleet Basing:** `pay_for_military_access` and `pay_for_fleet_basing_rights` have `diplo_chance.base = 1000` with `accept` subtracting 2000 for rivalry — so AI auto-accepts unless the actor is its rival, regardless of offered gold. Trade/food/fondaco use neutral `diplo_chance.base = -20/-50` and require enough offered gold (8 acceptance points per month of recipient income offered) to convince the AI.
- **Vanilla request paths untouched.** The vanilla `military_access` and `fleet_basing_rights` scripted_relations are NOT overridden — the auto-accept only applies to the new slider-based actions, so the vanilla 5-favor flow keeps its normal acceptance logic.
- **Files:** 5 country_interactions in one file + loc file `ars_belli_pay_for_access_l_english.yml`. No GUI edits — country_interactions auto-appear in the diplomacy panel under their category (ACCESS_ACTIONS / ECONOMY_ACTIONS).

### 3d. Force Break Union
- Any union member (senior, junior, or federal peer) gets a **Force Break Union** button in the union panel.
- **Effect:** spends 20 legitimacy (`legitimacy_extreme_penalty`), removes the actor from the union IO (`remove_country_from_international_organization`), then generates a random new ruler via `create_character` matching the actor's culture/religion and calls `set_new_ruler`.
- **Limit:** 50-year per-actor cooldown (`cooldown = { type = force_break_union_cd years = 50 }`). Legitimacy gating surfaces via the `force_break_union_legitimacy_tt` custom_tooltip in `allow`. `ai_tick = never`.
- **Why `generic_action` (type=owncountry), not country_interaction:** the action only affects the actor — country_interactions force a recipient `select_trigger` step in the UI ("pick a country" panel) that is meaningless here. Generic_actions with `type = owncountry` need no recipient and no select_trigger.
- **GUI button** uses `left_click_and_hold_action = { action_name = "force_break_union" }` (click-and-hold acts as a built-in confirmation). No `action_direction`, no IO `parameter` — those are country_interaction concepts.
- **Files:** `in_game\common\generic_actions\ars_belli_force_break_union.txt`, GUI button hand-placed in `in_game\gui\panels\organization\union.gui` (after `place_relative_on_throne` in MAIN_ACTIONS — search for `# Ars Belli force_break_union button`), tooltip template `io_force_break_union_button_tooltip` in `in_game\gui\shared\ars_belli_force_break_union.gui`, loc strings in `in_game\localization\english\ars_belli_force_break_union_l_english.yml`.
- **GUI override:** `union.gui` is a full-file copy (added to `replaced_files.txt`); reapply the mod block after `place_relative_on_throne` when vanilla updates.

### 3c. Crusade & Jihad
- **Targeting:** Crusades can now hit any heathen kingdom/empire whose capital is in `continent:europe`, `sub_continent:north_africa`, or `sub_continent:middle_east`, OR holds a Catholic holy site (vanilla path). Override of `is_valid_target_for_crusade` in `in_game\common\scripted_triggers\crusade_target_overrides.txt`.
- **Global cooldown:** Both Crusade and Jihad limited to once per 100 years globally per religion. Enforced via global vars `crusade_recently_called_global` / `jihad_recently_called_global` (set in effect with `years = 100`), checked through scripted triggers `crusade_global_cooldown` / `jihad_global_cooldown` (same overrides file). Per-actor `cooldown` block also bumped to 100 for UI consistency.
- **Files:** `in_game\common\resolutions\ars_belli_crusade.txt` (REPLACE:call_crusade), `in_game\common\generic_actions\ars_belli_jihad.txt` (REPLACE:call_jihad). Cooldown loc strings in `in_game\localization\english\ars_belli_crusade_l_english.yml`.

### 3f. Economic Support (scripted replacement)
- Vanilla "Send Economic Support" is **engine-only** — not a relation_type, no scripted_relation / country_interaction / on_action / ai_diplochance entry, and its action list comes from `Country.GetQuickDiplomaticActions`. It cannot be removed or hooked, so it is relabelled "AGAINST THE RULES" in loc (`ECONOMIC_SUPPORT*` keys) and a replacement was built alongside it.
- **Split across two files on purpose:** the relation `ars_belli_economic_support` (`in_game\common\scripted_relations\`) is the ongoing half; the amount slider + accept/decline popup live in the country_interaction `ars_belli_send_economic_support` (`in_game\common\country_interactions\`). A relation's own `select_trigger` is the only selection stage in its flow, so a value-type one leaves the picker with no attribute columns and the game asserts on `(AttributeColumns.GetSize() > 0)` and crashes. The interaction's country stage supplies columns first. Hence `offer_visible/request_visible = { always = no }` on the relation.
- **Amount storage:** the agreed figure is a variable `ab_ecosupport_amount` on the RECIPIENT (unambiguous because the interaction allows only one patron at a time). Set to 0 then `change_variable add = scope:target_value` — assigning the selection scope directly can store the object instead of the number. `gold_to_second = ars_belli_economic_support_amount` reads it back. Cleared by cancel/break/expire (each uses a different scope — actor / actor / `scope:second`).
- **Cap on the amount** (`in_game\common\script_values\ars_belli_economic_support_values.txt`, `# --- tune here ---` block at the top): the slider max is the lower of a share of the RECIPIENT's `country_tax_base` (currently 1.0) and a share of the SENDER's `monthly_income_total` (currently 10.0, a backstop), floored at 1 gold, opening at half the cap. Scaling both shares together moves the ceiling; their ratio decides how small a recipient must be before its own economy is the limit. **The shares are spelled out in words in the loc file** (`ars_belli_economic_support_relation_desc`, `ars_belli_send_economic_support_desc`) — retune those texts alongside.
- `country_tax_base` is the country-scope value for Tax Base and works as `scope:recipient.country_tax_base` inside a value `select_trigger`'s min/max/default (vanilla precedent: `bribe_vote.txt`). Guard it with `exists = scope:recipient` — `ai_override_value` can be evaluated with no recipient in scope. Pass `max` a plain number or a single value reference; vanilla never inlines arithmetic into `max = { ... }`.
- Costs both sides a Defensive Point (see `mp_limits` weight recompute) and -0.10 monthly diplomats via `giving_`/`receiving_` auto-modifiers in `main_menu\common\static_modifiers\ars_belli_country_changes.txt`. `ai_tick = never` on the interaction.

### 3f2. Tributaries excluded from transfers
- A tributary can no longer appear on either end of `give_subject_location_to_other_subject` or `transfer_subject`. Checks sit in the `enabled` block of each selection stage (`custom_tooltip` + `NOT = { is_subject_type = tributary }`), so the country greys out with a reason instead of vanishing from the picker.
- Both are same-name full-file replacements of vanilla country_interactions (in `replaced_files.txt`); shared loc key `ars_belli_not_a_tributary_tt` in `in_game\localization\english\ars_belli_tributaries_l_english.yml`.

### 3g. Union war participation (call to arms)
- IO war-joining is controlled by six fields on the international_organization, documented in vanilla `international_organizations\readme.txt` lines 94-99. For each of defensive/offensive: `join_*_wars_always` (silently auto-join, no prompt), `join_*_wars_auto_call` (**call to arms is issued automatically, the callee still accepts/declines**), `join_*_wars_can_call` (a call may be made manually). Scopes: root = the IO, `scope:actor` = caller, `scope:recipient` = callee, `scope:target` (optional) = against who.
- Vanilla `union.txt` had `join_defensive_wars_always = { always = yes }`, commented as the baseline of a union that "will never change" — union partners were dragged into each other's defensive wars with no popup. Ars Belli sets it to `no` and adds `join_defensive_wars_auto_call = { always = yes }`, which is what produces the accept/decline popup. Vanilla precedents for auto_call: `hre.txt`, `ilkhanate.txt`.
- **The offensive side is untouched and is not in `union.txt` at all** — it is voted through `laws\40_personal_unions.txt` → `union_mutual_offense_law`: Assured Offense sets `join_offensive_wars_always`, Automatic Offense sets `join_offensive_wars_auto_call`, Possible Offense sets `join_offensive_wars_can_call`. There is no defensive equivalent law, so the hardcoded baseline in `union.txt` is the only defensive lever.
- `union.txt` is a same-name full-file replacement (in `replaced_files.txt`).

### 3h. Sell / Buy Location — engine-locked except a flat GUI ceiling
- The sell/buy location action is **entirely engine-implemented**, like vanilla Economic Support was (see 3f). Confirmed absent: no `country_interactions` file, no price id in `prices\00_hardcoded.txt` (checked against the full several-hundred-entry list), no `diplomatic_costs` entry, and no on_action of its own. Only `ai_diplochance\00_ai_diplochance.txt` (`sell_location` / `buy_location` AI weights) and the GUI are moddable.
- **`on_location_changed_owner` is the only ownership hook** (root = location, `scope:loser` = previous owner, `scope:winner` = new owner) and it **cannot tell a sale from a conquest, a peace-treaty transfer, a gift to a subject, or any of the ~155 scripted `change_location_owner` calls in vanilla**. Do not use it to hang costs on "selling" — it will silently tax event-driven transfers. This is why the requested -10 prestige on sale/purchase was **not implemented**: there is no data-side hook for it. The only engine cost that exists is `SELL_CORE_STABILITY_COST` (-20 stability, seller only, core locations only).
- **The GUI takes a flat ceiling and nothing else.** `sell_location_action_view.gui` is a same-name full-file replacement (in `replaced_files.txt`) whose price `economy_slider` sets `max = 100` — a **literal**, replacing vanilla's `[SellLocationActionView.GetMaxPrice]` (the buyer's whole treasury). The engine still applies `GetMaxPrice` as a further clamp on top, so the effective ceiling is `min(100, buyer's treasury)`. The paired loc override `ars_belli_sell_location_l_english.yml` relabels `sell_buy_location_price`.
- **A *scaling* ceiling is impossible here — proven, do not retry.** The `max` property accepts only a literal or a bare getter on the view's own datacontext, no computed expression. Tested in game with four otherwise-identical sliders differing only in `max`: a literal (`9999`) works; `Multiply_float(SellLocationActionView.GetMaxPrice, 0.5)` — arithmetic over vanilla's own known-good source — does **not**; neither does `Player.GetTotalTaxBase` raw nor `FixedPointToFloat(Player.GetTotalTaxBase)`. `SellLocationActionView` exposes no tax-base getter (only `CanSend`, `GetAcceptance*`, `GetConfirmMessage`, `GetLocationsSortSearch`, `GetMax/MinPrice`, `GetPossibleLocations`, `GetTotalPrice`, `IsBuying`, `IsSelected`, `OnSend`, `SetTotalPrice`, `ToggleLocation`), and clamping the committed value is not available either (`onvaluechanged = SetTotalPrice`, no scripted intermediary). Hence the flat number.
- **Two silent-failure traps found here, both generalize.** (1) A `ranged_slider` whose `max` assignment is rejected keeps its default of **100** and logs nothing — a clean `error.log` does *not* mean a GUI property took effect; verify against a known value. (2) `FixedPointToFloat` on something already a float (e.g. `GetMaxPrice`) *does* log `FetchData failed` and kills the whole enclosing expression. Bisect GUI expressions with parallel widgets and a literal control rather than reasoning about which sub-term is wrong.
- `GetSeller` / `GetBuyer` appear in `diplomacy_l_english.yml` but in **no** vanilla `.gui`: localization and the GUI use separate data registries, so loc-only functions are unavailable to GUI expressions.
- **Gift scale for reference** (`prices\00_hardcoded.txt` → `send_gift`): `scaled_recipient_gold = 2`, `scaled_gold = 1`, `min_scale = 25` — i.e. 2 months of recipient income + 1 of sender. Not reachable from GUI script, which is why a flat number was used instead.

### 3i. Mercenary listing removed
- **The real feature is engine-side and the script action is a decoy.** What players use is the **"Set Up The Mercenary Contract"** window (`SETUP_MERCENARY`, the `setup_condottieri` lateralview) — engine-driven end to end: `SetupCondottieriView` / `CondottieriItem`, with `OnAccept`, `OnCostModifierChanged`, `OnDurationChanged`, `DelistUnhiredMercenaries` all engine functions, and refusals coming from engine loc keys (`MERC_UNIT_HAS_MERCENARIES` and siblings in `units_l_english.yml`, i.e. `NUnitUtilities::CanBecomeMercenary`), not from any script trigger. **No data change reaches it.** There is also a `make_unit_available_for_hire` generic_action with the same name and the same tooltip title — gating it does nothing to the player path. Two attempts were burned on that decoy.
- **There are FOUR player-facing surfaces, all GUI, all needing their own edit.** Closing one at a time cost three round trips with the player. All four are same-name replacements in `replaced_files.txt`:
  1. `army_builder.gui` — the "Become Mercenary" header button, the only caller of `ShowCondottieriViewWithFilter` (no hotkey reaches it). Killed by restoring `blockoverride "right_widget_visible" { visible = no }` — vanilla's own default from `shared\windows.gui`, which army_builder *empties* to switch the button on — and emptying `blockoverride "right_widget"{}` so the widget is never built.
  2. `single_unit_window.gui` — the individual army screen's action bar (`SingleUnitWindow.GetAllActionItems`). This is the one players actually use.
  3. `multi_unit_window.gui` — the same list for a multi-unit selection, plus the pinned quick-action row.
  4. `context_menu.gui` — the right-click unit menu (`QuickUnitActions.AccessList`).
- **Filtering an engine `UnitActionItem`:** `visible = "[Not(EqualTo_string(UnitActionItem.GetName, Localize('BECOME_MERCENARY')))]"`, ANDed onto whatever `visible` vanilla already had. `UnitActionItem.GetKey` **does** exist (vanilla uses it in `multi_unit_window.gui` for the pin collection) and would be sturdier, but the key's *value* is not discoverable from the files and a wrong guess fails silently — both halves of the name comparison are verifiable instead. In `single_unit_window.gui` the filter must go on each `unit_action_category`'s `unit_action_category_block_visible` blockoverride (7 of them), **not** on the item template: a blockoverride replaces the block wholesale, so a template default is overwritten by every category.
- `make_unit_available_for_hire` (generic_action) is *also* disabled by a **same-name full-file replacement** of `in_game\common\generic_actions\make_unit_available_for_hire.txt` (in `replaced_files.txt`) — it closes the AI/automation path (`generic_action_ai_lists\global_list.txt` lists it) but was never the player path. Renting out own regiments put the mercenary modifiers on the hirer while the owner kept the full hire price — a gold transfer that paid a profit.
- **Method note.** The thing that finally located it was grepping the *player-visible strings* (`"Set Up The Mercenary Contract"` → `SETUP_MERCENARY`, the refusal text → `MERC_UNIT_HAS_MERCENARIES`) rather than the action key. Ask for the exact on-screen wording early when a removal "doesn't work" — a matching action name is not proof you have the right mechanism.
- **`REPLACE:` does not work in `generic_actions` — proven by a shipped failure, do not retry it here.** The first attempt (`17a2076`, `ars_belli_no_mercenary_listing.txt` holding `REPLACE:make_unit_available_for_hire` with `potential = { always = no }`) had **no effect whatsoever** and **logged nothing**; players could still open the action and list units. `REPLACE:` *is* honoured in other databases — `REPLACE:order_commandery` in `building_types` is live and the engine names it under the plain key in `error.log` (`Building 'order_commandery' has want_foreign_pop_created = yes…`, a property only the mod's copy has). So treat `REPLACE:` as **per-database**, not universal: after using it, confirm the entry actually took rather than assuming.
- **Gate a removed action at every stage, not one.** The shipped failure had `potential`, `ai_prerequisite` and the unit `select_trigger.visible` all set to `no` and still worked, which is what proved the whole entry was inert. The replacement sets `show_in_gui_list = no` (the readme flag that keeps an action out of the auto-generated GUI lists — **no `.gui` file references this action by name**, so the button is auto-generated), `potential`, `allow`, `ai_prerequisite`, `automation_tick = never`, the select_trigger, **and empties the `effect`** so nothing can be listed even if a path is missed.
- **`ai_tick = never` means "already handled in code"** per `country_interactions\readme.txt` — so if AI countries list mercenaries at all, it is engine code and no data change reaches it. Keep this reading of `ai_tick = never` in mind generally: it does not simply mean "AI never does this".
- `delist_unit` is a separate key in the same vanilla file and is kept byte-identical to vanilla, so already-listed units can be pulled back.

### 3j. Selling works of art — AI willingness
- **Four gold-for-art paths exist in the whole game**, and no others (`grep destroy_art|move_art_and_owner|art_price` over `in_game\`): `country_interactions\sell_work_of_art.txt` (offer to a country, they accept/decline), `country_interactions\request_work_of_art_purchase.txt` (the mirror, you buy), `generic_actions\sell_work_of_art_to_estates.txt` (instant, no counterparty, 60% of `art_price`), and the Orthodox-only `country_interactions\sell_icon.txt`.
- **`art_price` is engine-computed and not moddable.** No define, no entry in `prices\`; `price:sell_work_of_art = { gold = 1 }` is only a stub that `price_modifier` overwrites with `scope:target.art_price`. Its magnitude relative to a country's income is **not knowable from script** — assume nothing about it.
- **Vanilla's acceptance formula never looked at the price.** Opinion, the buyer's own treasury and the art's quality only. So a rich AI bought nearly anything at whatever the engine valued it at, which is the free-money faucet. Ars Belli's `sell_work_of_art.txt` (a **same-name full-file replacement**, in `replaced_files.txt` — it was a `REPLACE:` until 3i proved that unreliable per-database) adds a price-against-income term, drops `diplo_chance.base` −30 → −50, halves `WEALTHY_BUYER` and raises its bar 24 → 36 months, adds a −25 band for `art_quality` 40–69 (vanilla punished only below 40) and deepens the below-40 band −50 → −90.
- **`diplo_chance.base` and the `accept` block sum into one acceptance score** — see also 3f. `accept` factor `desc =` values are plain loc keys.
- **`divide = { value = X min = 1 }` is the vanilla divide-by-zero guard** (`script_values\diplomatic_values.txt`), and `max = N` as a sibling of `value`/`multiply` clamps the finished term. Both are worth reaching for whenever an acceptance term divides by another country's income.
- **Estates and "the bank" are the same thing in EU5's own vocabulary** — `generic_actions\take_bank_loan.txt` defines `take_estate_loan`, whose message log reads "We took a loan from the bank". Expect player reports about "banks" to mean either the estates or a counterparty country; ask which.

### 3k. Intervene in War & Threaten War removed; Enforce Peace is the replacement
- **Both are engine actions.** No `country_interactions` file, no `prices` entry, no `on_action`. `intervene_in_war` is only ever named in GUI as `[OpenDiploAction('intervene_in_war')]`; `threaten_war` only as an `ai_diplochance` weight. The moddable surface is: the `allowed_*` country modifiers, the loc, and the GUI.
- **Threaten War is a clean kill** — `allowed_threaten_war` is the engine's only gate (vanilla `THREATEN_WAR_NOT_POWERFUL_ENOUGH` says exactly that: "We do not have the [allowed_threaten_war] modifier"). Set `no` on `REPLACE:is_great_power` **and** `REPLACE:is_regional_power` (`main_menu\common\static_modifiers\abm_country_changes.txt`) and on the HRE `leader_modifier` (`in_game\common\international_organizations\hre.txt`). Those are the only three grants in the whole game.
- **Intervene in War is NOT.** `allowed_intervene_in_war = no` closes only the rank path. The engine hands the action to **any** country whose rival is in the war, whatever the modifier says — vanilla admits it in `INTERVENE_IN_WAR_NOT_POWERFUL_ENOUGH`: *"We are not powerful enough to intervene in the wars that countries that are not our rivals."* There is no data-side flag for the rival path. **If a report says Intervene is still usable, this is why.**
- **The rival path is closed in the GUI instead** (same-name replacements in `replaced_files.txt`):
  1. `in_game\gui\select_war_to_intervene.gui` — the engine's war picker (`SelectInterveneWindow.GetWars`), rewritten with **no list at all**, just a message and Cancel. **This is the whole removal**: it is the choke point every remaining path runs through, so no war can be selected and the action can never complete, rival or not. 44 lines, and the reason no bigger GUI file has to be replaced.
  2. `in_game\gui\context_menu.gui` — tag guard `Not(EqualTo_string(DiplomaticActionItem.GetTag, 'INTERVENE_IN_WAR'))` on the pinned quick-action entry, plus `in_game\gui\war_lateralview.gui` where both Intervene buttons are `visible = no`.
- **`DiplomaticActionItem.GetTag` is the loc key prefix in caps**, i.e. `INTERVENE_IN_WARTITLE` → tag `INTERVENE_IN_WAR` (same for `UNCONDITIONALSURRENDER`, `IMPROVE_RELATION`, …). `EqualTo_string` against a wrong tag is harmless (just false), unlike `IsType`, whose accepted strings are a different, lowercase set (`declarewar`, `requestpeace`, `create_casus_belli`).
- **The row is left in the diplomacy list on purpose — do not "fix" it by replacing `diplomacy_macrobuilder_lateralview.gui`.** Gating it there works (`type ui_diplomatic_action_button`, the template behind both the quick actions and the categorised list `foreign_country_lateralview.gui` renders via `GetCategoryItems` → `diplomatic_actions`), but that is a 2400-line vanilla file to re-merge on every patch and it was **explicitly rejected as not worth the maintenance**. The row stays, reads "Intervene in War (Removed)" from the loc override, and opens the dead picker. Hiding it is not an option either: `diplomatic_actions` is a `fixedgridbox`, so an invisible item still eats its grid cell and leaves a hole in Hostile Actions.
- **Loc overrides live in `main_menu\localization\english\replace\01_abm_locals_vanilla_l_english.yml`** — the engine keeps listing both actions, so `INTERVENE_IN_WARTITLE` / `THREATEN_WARTITLE` read "(Removed)", the `_DESC` / `_FLAVOR` / `_TOOLTIP_HEADER*` / `_NOT_POWERFUL_ENOUGH` keys say what replaced them, and `CRANK_CAN_INTERVENE` / `CRANK_CAN_THREATEN_WAR` (the rank-tooltip bullets) no longer advertise them.
- **Engine Enforce Peace is off too** (`allowed_enforce_peace = no` on both ranks and the HRE leader) because it is a single attacker-side accept/decline. **It still survives on vanilla situation league leaders** — `foreign_league_balkan/france/hre/iberia` and `italian_league_1/2/3` each set `allowed_enforce_peace = yes` in their own `leader_modifier`, and those files are not replaced. That is why the `ENFORCE_PEACETITLE` override still carries the against-the-rules warning. Unions have a separate `union_allowed_enforce_peace` modifier + `union_enforce_peace` country_interaction, untouched.
- **The replacement is `ars_belli_enforce_peace`** (`in_game\common\country_interactions\`, events in `in_game\events\ars_belli_enforce_peace_events.txt`, loc in `in_game\localization\english\ars_belli_enforce_peace_l_english.yml`). Defender is asked first; only on their acceptance does the attacker get `ars_belli_enforce_peace.1`; refusal drags the enforcer into the war on the defender's side. Standing: `is_mp_gp`, `is_mp_major`, or rival to either war leader — deliberately the same reach Intervene had. The vanilla rival-war alert (`can_intervene_in_rival_war`) is retargeted to it in `alertmanager.gui` with the `ALERT_INTERVENE_RIVAL_WAR_*` keys rewritten.
- **Italian Wars `iw_intervene_in_war` is a different mechanic** (a situation generic_action for joining the Italian Wars, `generic_actions\italian_wars.txt`). Untouched — do not confuse the two when grepping for "intervene".

### 4. Economy & Town Setups
- Custom building setups for different cultures/regions in `in_game\common\town_setups\00_default.txt`.
- Tweaks to prices and societal values.

## Project Structure
The repository mirrors the EU5 file structure:
- `in_game/`: Contains gameplay logic (advances, effects, triggers, setup).
- `main_menu/`: Contains game rules, localization, and static modifiers.
- `loading_screen/`: Contains defines.
- `deploy.ps1`, `release.ps1`, `watch.ps1`: Automation scripts for mod development.
- `release.ps1` excludes `.exe` files from the release archive.

## Implementation Details for Agents
- **Scripted Effects:** Check `in_game\common\scripted_effects\ars_belli_scripted_effects.txt` for the core logic of the ranking system.
- **Monthly Pulse:** The `mp_limits_monthly_pulse` on-action triggers the recalculation of scores and ranks.
- **Localization:** Multiplayer-specific rules and settings are localized in `main_menu\localization\english\ars_belli_rules_l_english.yml`.
- **REPLACE: prefix:** EU5 supports `REPLACE:key = { ... }` in mod files to override a single vanilla definition without copying the whole vanilla file. Use a separately-named mod file (convention: `ars_belli_<topic>.txt`); avoid same-name file replacement so future vanilla additions in that file still load. Works for resolutions, generic_actions, scripted_triggers, static_modifiers, auto_modifiers, prices, diplomatic_costs, advances. Only fall back to whole-file replacement (and `replaced_files.txt`) for non-keyed files like GUI.
- **Load-phase gotcha:** static modifiers are loaded ONLY from `main_menu/common/static_modifiers/` — a file under `in_game/common/static_modifiers/` is ignored (unknown-directory), so a `REPLACE:` there never applies. Likewise, scripted-trigger `custom_description` text keys (`text = key` inside a trigger's `custom_description`) must live in `main_menu/localization/english/`: scripted triggers are validated before `in_game` loc loads, else the log reports `No trigger loc`. Runtime-only loc keys can stay in `in_game/localization/english/`.

## GUI File Update Procedure
The mod overrides two vanilla `.gui` files with mod-specific additions on top:
- `in_game\gui\panels\right_panel\right_panel.gui`
- `in_game\gui\foreign_country_lateralview.gui`

When the base game updates, copy the new vanilla files from `E:\Steam\steamapps\common\Europa Universalis V\game\in_game\gui\` and reapply the mod blocks:

**right_panel.gui** mod additions (4 blocks):
1. **Alliance/Defensive/Guarantee points display** — a `flowcontainer` with `# Ars Belli multiplayer limits display:` comment, inserted after the `non_clickable_color_gold_texture` corner icon, before the age `flowcontainer`.
2. **Remove `max_width = 200`** from the age name `text_single`.
3. **Country rank display (clickable)** — a `flowcontainer` with `# Ars Belli Current country Rank:` comment, inserted after the age tooltip block, before `### CORNER2`. Inner `button` with onclick → `mp_limits_toggle_tier_panel` scripted_gui.
4. **Tier list panel** — a `widget` with `# Ars Belli tier list panel` comment, inserted right after the rank flowcontainer, before `### CORNER2`. Toggled by global var `mp_tier_panel_open`. Contains 5 `dynamicgridbox` sections iterating `GetGlobalList('mp_<tier>_list')`.

**foreign_country_lateralview.gui** mod additions (2 blocks):
1. **MP Rank and Power Score hbox** — with `# MP Rank and Power Score` comment, inserted after the country rank icon's `glow` block (around the `GetCountryRankIcon` section), inside the same parent container.
2. **Foreign Diplo Limits hbox** — with `# Ars Belli Foreign Diplo Limits` comment, inserted immediately after the MP Rank block. Shows the viewed country's AP/DP/GP usage and limits.

To identify mod blocks, search for comments starting with `# Ars Belli` or `# MP Rank`.

Last updated: 2026-08-29 (Intervene in War fully removed incl. the engine rival path; Threaten War removed from Regional Powers and the HRE Emperor; ars_belli_enforce_peace confirmed as the replacement).

## Important Files
- `README.md`: Basic mod title.
- `changes.txt`: High-level summary of mechanical changes (forts, combat).
- `.metadata/metadata.json`: Mod ID, version, and supported game version.

All files should have UTF-8 BOM encoding, especially localisation files

## Indentation Convention
- `.txt`/`.gui` script files use TABS (tab width 4). `.yml` = 1 space. `.md`/`.json`/`.ps1` = spaces.
- Enforced in `.vscode/settings.json`.
- Gotcha: the `paradox-highlight` extension's formatter reads TOP-LEVEL `editor.insertSpaces` (ignores language-scoped overrides). Top-level must be `false`, else formatOnSave silently rewrites tabs -> spaces.

## Language Association
- Repo uses EU5 syntax. `paradox-highlight` only auto-detects `eu5` under a game-named folder (Europa Universalis V/EU/EU5/3450310), which this repo is not, so it falls back to generic `paradox`.
- Fixed via `files.associations` in `.vscode/settings.json`: `in_game/**`, `loading_screen/**`, `main_menu/**` `*.txt`/`*.gui` -> `eu5`.
