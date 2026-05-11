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
    - **Toggle**: Scripted_gui effects `mp_limits_toggle_tier_panel` / `mp_limits_close_tier_panel` in `in_game/common/scripted_guis/ars_belli_tier_panel_gui.txt` set/remove global var `mp_tier_panel_open`. GUI uses `visible = "[GetGlobalVariable('mp_tier_panel_open').IsSet]"` — presence of the variable is the open state, so no init is needed (and a `GetValue` check would error before init).
    - **Tooltip**: `MP_RANK_TOOLTIP` retains score breakdown + per-tier limits/counts (no longer lists countries). Counts via `[GetDataModelSize(GetGlobalList('mp_<tier>_list'))]`.

### 2b. Break Others' Guarantee
- Country interaction allowing a player to break another country's guarantee on them (hostile action).
- File: `in_game\common\country_interactions\break_others_guarantee.txt`
- Requires not being at war. Creates a truce on use.

### 2c. Worsen Opinion
- Country interaction allowing a player to worsen their own opinion of another country (-100 opinion, decays over 10 years).
- Files: `in_game\common\country_interactions\worsen_opinion.txt`, `in_game\common\biases\ars_belli_opinion.txt`

### 3. War & Military Rebalancing
- **Ticking Warscore:** Max 36 at +1/month (reduced from 50 because occupations give double warscore post-patch). Defined in `loading_screen\common\defines\01_ars_belli_defines.txt`.
- **Unconditional Surrender:** Removed (base game now has one). Previously in `in_game\common\country_interactions\unconditional_surrender.txt`.
- **Enforce Peace Warning:** Removed (base game now asks both defender and attacker to accept). Previously in `main_menu\localization\english\replace\01_ars_belli_locals_vanilla_l_english.yml`.

### 3b. Fort Rebalancing
Significant changes to siege mechanics and fort limits (documented in `changes.txt` and `loading_screen\common\defines\01_ars_belli_defines.txt`):
- **Fort Limit:** Base limit of 5. Affected by tech and locations, NOT country rank or city count.
- **Defensiveness:** Removed movement speed/combat bonuses; focuses on scaling siege ability penalties.
- **Offensiveness:** Grants Logistics Distance, Assault Ability, and Siege Ability.

### 3c. Crusade & Jihad
- **Targeting:** Crusades can now hit any heathen kingdom/empire whose capital is in `continent:europe`, `sub_continent:north_africa`, or `sub_continent:middle_east`, OR holds a Catholic holy site (vanilla path). Override of `is_valid_target_for_crusade` in `in_game\common\scripted_triggers\crusade_target_overrides.txt`.
- **Global cooldown:** Both Crusade and Jihad limited to once per 100 years globally per religion. Enforced via global vars `crusade_recently_called_global` / `jihad_recently_called_global` (set in effect with `years = 100`), checked through scripted triggers `crusade_global_cooldown` / `jihad_global_cooldown` (same overrides file). Per-actor `cooldown` block also bumped to 100 for UI consistency.
- **Files:** `in_game\common\resolutions\ars_belli_crusade.txt` (REPLACE:call_crusade), `in_game\common\generic_actions\ars_belli_jihad.txt` (REPLACE:call_jihad). Cooldown loc strings in `in_game\localization\english\ars_belli_crusade_l_english.yml`.

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

Last updated: 2026-05-11 (crusade/jihad rebalance).

## Important Files
- `README.md`: Basic mod title.
- `changes.txt`: High-level summary of mechanical changes (forts, combat).
- `.metadata/metadata.json`: Mod ID, version, and supported game version.

All files should have UTF-8 BOM encoding, especially localisation files
