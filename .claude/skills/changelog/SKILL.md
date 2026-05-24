---
name: changelog
description: Generate a user-facing changelog for the Ars Belli mod. Lists only player-visible changes since the previous mod version tag (new actions, balance tweaks, UI, gameplay bug fixes) and excludes dev/build/refactor/log-noise/workshop-description changes. Produces a workshop-ready "Since <prev version>" blurb and folds the new items into the canonical changes.txt under the correct category.
---

# changelog

Generate the user-facing patch notes for the Ars Belli mod. Output is for **players reading the Steam Workshop description**, not for developers.

## Scope rules

Version tags follow `game.<gv>.mod.<n>` (e.g. `game.1.2.2.mod.4`). The current version is in `.metadata/metadata.json`. The canonical, categorized state-of-mod doc is `changes.txt` at repo root.

The skill has two outputs and you should produce **both** unless the user asks for only one:

1. **Patch notes blurb** — short, Workshop-friendly. Grouped by the same headings used in `changes.txt`. Print to the chat for the user to copy.
2. **`changes.txt` update** — fold the new items into the matching `# Heading` sections (or add a new heading if needed). `changes.txt` is a *current-state* document, not a chronological log — rewrite affected lines so they describe the post-change state, do not append "v1.2.2.mod.5: ..." lines.

## Steps

1. **Determine the previous version tag.** Run `git tag -l "game.*.mod.*"` and pick the highest version-sorted tag that is reachable from `HEAD` and is *not* the current version in `.metadata/metadata.json`. If the user passed a tag/ref as an argument, use that instead. If no tag matches, ask the user which ref to diff from.
2. **Collect candidates.** `git log <prev_tag>..HEAD --oneline` plus `git status` (staged + unstaged + untracked tracked files). For each commit/change, you need the subject and, for ambiguous ones, the diff (`git show <sha>` or `git diff <path>`).
3. **Classify each candidate** using the lists below. Be conservative — when a commit subject is vague ("fix X"), look at the diff before deciding.
4. **Rewrite for players.** Drop file paths, scripted_effect names, scope/trigger jargon, REPLACE-prefix details, AI-tick mechanics, GUI-block coordinates. Keep numeric balance values, action names as they appear in-game, and player-visible behavior.
5. **Group** the surviving items under the headings already used in `changes.txt`:
   `# Fort Limit`, `# Crusades`, `# Personal Unions`, `# Access Diplomacy`, `# Guarantees`, `# Opinion`, `# Vision Sharing`, `# Wargoals / Casus Belli`, `# Economy`, `# Power Ranking & Diplo Limits`, `# Pops & Setup`, `# Patch Compatibility`. Add a new heading only if no existing one fits.
6. **Print the blurb** with a header line `Since <prev_tag> → <current_version>:`, then the grouped bullets.
7. **Update `changes.txt`** with `Edit` calls. For each surviving item, either patch the existing line (if it's an update of a previous behavior — e.g. "fort limit base 6 → 5") or insert a new bullet under the matching heading. Do NOT add change-history meta-lines.

## What counts as user-facing (include)

- New in-game actions, interactions, buttons, panels.
- Balance changes: numeric tweaks to costs, limits, modifiers, warscore, tech effects, fort/siege values, AI acceptance, opinion, legitimacy, cooldowns, etc.
- New advances, events, modifiers, town setups, pop adjustments visible at game start or during play.
- Localization changes that alter what the player *reads* in-game (tooltips, action names, rule descriptions) — but only if the meaning changes, not pure wording polish.
- Bug fixes that the player would have noticed: UI glitches, MP-desync-style visible bugs, wrong tooltip numbers, an action being uncastable, an effect not applying. Example included: "fix toggling tier list UI opening it for all players".
- Compatibility bumps to a new base-game version (one line under `# Patch Compatibility`).

## What to exclude (dev-only, skip)

- Workshop description, thumbnail, screenshots, store page assets.
- `README.md`, `CLAUDE.md`, `memory.md`, `memory/*`, `changesToDo.md`, `.claude/**`.
- `deploy.ps1`, `release.ps1`, `watch.ps1`, `make_thumbnail.ps1`, any build/release tooling.
- `.metadata/metadata.json` version bumps on their own (the version is in the header, not a bullet).
- `replaced_files.txt` housekeeping unless it's the *cause* of a player-visible fix.
- Pure log-spam silencing ("fix ai errors", "fix some errors for X") **unless** the diff shows behavior changing, not just a missing trigger guard.
- Refactors, renames, reformatting, comment-only changes, dead-code removal.
- `info` file edits, `.gitignore`, editor config.
- TODO list changes.

## Heuristics for ambiguous commits

- "fix X" — read the diff. If it changes a number, an effect, a trigger condition that gates a player action, or a UI element a player sees, include it. If it only adds a `scope_type` annotation, silences a warning, or reorders code, skip it.
- "updated for game X.Y" / "patch compatibility" — one line under `# Patch Compatibility`, not per-file.
- A pop/setup commit touching many countries — summarize ("pop adjustments across Asia: …") rather than listing every country, matching the existing style in `changes.txt`.
- GUI commits — keep only the player-visible result ("foreign country panel now shows AP/DP/GP"), not the block-placement details.

## Style

- Lowercase first letter, no trailing period — match existing `changes.txt` bullets.
- Lead with the player verb or the noun the player will recognize ("crusades", "fort limit", "guarantees"), not the file or system name.
- Keep numbers. Drop internal identifiers (`force_break_union_cd`, `mp_limits_monthly_pulse`, etc.).
- If a change reverses or replaces a previous bullet in `changes.txt`, edit that bullet rather than adding a contradicting one.

## Arguments

- No arg: diff from the highest `game.*.mod.*` tag below the current version.
- `<ref>`: diff from this ref instead (tag, branch, sha).
- `blurb`: only print the patch-notes blurb, do not edit `changes.txt`.
- `update`: only update `changes.txt`, do not print a blurb.
