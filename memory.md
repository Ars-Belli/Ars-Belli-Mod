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

### 3. Military & Fort Rebalancing
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

## Implementation Details for Agents
- **Scripted Effects:** Check `in_game\common\scripted_effects\ars_belli_scripted_effects.txt` for the core logic of the ranking system.
- **Monthly Pulse:** The `mp_limits_monthly_pulse` on-action triggers the recalculation of scores and ranks.
- **Localization:** Multiplayer-specific rules and settings are localized in `main_menu\localization\english\ars_belli_rules_l_english.yml`.

## Important Files
- `README.md`: Basic mod title.
- `changes.txt`: High-level summary of mechanical changes (forts, combat).
- `.metadata/metadata.json`: Mod ID, version, and supported game version.
