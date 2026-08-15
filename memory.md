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
- **Enforce Peace Warning:** Removed (base game now asks both defender and attacker to accept). Previously in `main_menu\localization\english\replace\01_ars_belli_locals_vanilla_l_english.yml`.

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
- `make_unit_available_for_hire` (generic_action, "Make Available For Hire") is disabled via `REPLACE:` with `potential = { always = no }` in `in_game\common\generic_actions\ars_belli_no_mercenary_listing.txt`. Renting out own regiments put the mercenary modifiers on the hirer while the owner kept the full hire price — a gold transfer that paid a profit.
- Gate in `potential`, not `allow`, so the action leaves the list instead of sitting greyed out; that covers player, delegation automation and AI, which share the gate.
- **`ai_tick = never` means "already handled in code"** per `country_interactions\readme.txt` — so if AI countries list mercenaries at all, it is engine code and no data change reaches it. Keep this reading of `ai_tick = never` in mind generally: it does not simply mean "AI never does this".
- `delist_unit` is a separate key in the same vanilla file and is deliberately left vanilla, so already-listed units can be pulled back. This is why `REPLACE:` was used rather than a same-name file copy.

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

Last updated: 2026-08-16 (economic support cap; union call to arms; tributary transfer bans; sell/buy location capped at a flat 100 gold in the GUI; mercenary listing removed).

## Important Files
- `README.md`: Basic mod title.
- `changes.txt`: High-level summary of mechanical changes (forts, combat).
- `.metadata/metadata.json`: Mod ID, version, and supported game version.

All files should have UTF-8 BOM encoding, especially localisation files
