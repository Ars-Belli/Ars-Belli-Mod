# Ars Belli Mod - Project Memory

This document provides context for AI agents working on the Ars Belli Mod for Europa Universalis V (EU5).

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

### 3. War & Military Rebalancing
- **Ticking Warscore:** Max 36 at +1/month (reduced from 50 because occupations give double warscore post-patch). Defined in `loading_screen\common\defines\01_ars_belli_defines.txt`.

### 3b. Fort Rebalancing
Significant changes to siege mechanics and fort limits (documented in `changes.txt` and `loading_screen\common\defines\01_ars_belli_defines.txt`):
- **Fort Limit:** Base limit of 5. Affected by tech and locations, NOT country rank or city count.
- **Defensiveness:** Removed movement speed/combat bonuses; focuses on scaling siege ability penalties.
- **Offensiveness:** Grants Logistics Distance, Assault Ability, and Siege Ability.

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

## GUI File Update Procedure
The mod overrides two vanilla `.gui` files with mod-specific additions on top:
- `in_game\gui\panels\right_panel\right_panel.gui`
- `in_game\gui\foreign_country_lateralview.gui`

When the base game updates, copy the new vanilla files from `E:\Steam\steamapps\common\Europa Universalis V\game\in_game\gui\` and reapply the mod blocks:

**right_panel.gui** mod additions (3 blocks):
1. **Alliance/Defensive/Guarantee points display** — a `flowcontainer` with `# Ars Belli multiplayer limits display:` comment, inserted after the `non_clickable_color_gold_texture` corner icon, before the age `flowcontainer`.
2. **Remove `max_width = 200`** from the age name `text_single`.
3. **Country rank display** — a `flowcontainer` with `# Ars Belli Current country Rank:` comment, inserted after the age tooltip block, before `### CORNER2`.

**foreign_country_lateralview.gui** mod additions (1 block):
1. **MP Rank and Power Score hbox** — with `# MP Rank and Power Score` comment, inserted after the country rank icon's `glow` block (around the `GetCountryRankIcon` section), inside the same parent container.

To identify mod blocks, search for comments starting with `# Ars Belli` or `# MP Rank`.

Last updated: 2026-05-10 (game update).

## Important Files
- `README.md`: Basic mod title.
- `changes.txt`: High-level summary of mechanical changes (forts, combat).
- `.metadata/metadata.json`: Mod ID, version, and supported game version.
