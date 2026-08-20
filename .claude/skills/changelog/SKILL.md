---
name: changelog
description: Generate a user-facing changelog for the Ars Belli mod. Lists only player-visible changes since the previous mod version tag (new actions, balance tweaks, UI, gameplay bug fixes) and excludes dev/build/refactor/log-noise/workshop-description changes. Produces a workshop-ready "Since <prev version>" blurb and folds the new items into versionsChangelog.md and the cumulative "Ars Belli - Complete Changelog.md".
---

# changelog

Generate the user-facing patch notes for the Ars Belli mod. Output is for **players reading the Steam Workshop description**, not for developers.

## Scope rules

Version tags follow `game.<gv>.mod.<n>` (e.g. `game.1.2.2.mod.4`). The current version is in `.metadata/metadata.json`. Three documents live at repo root:

- `versionsChangelog.md` — the per-release log, and the source of the GitHub release notes.
- `Ars Belli - Complete Changelog.md` — the cumulative state-of-mod document. **This is the one you edit.**
- `Ars Belli Mod - List of Changes - google docs.md` — a verbatim Markdown export of the published Google Doc, kept as a snapshot of what players currently see. **Never hand-edit it**; it is replaced wholesale by the next download from Docs, and it lags the file above until the user re-publishes. Read it to recover edits the user made inside the Doc.

The skill has three outputs and you should produce **all three** unless the user asks for only one:

1. **Patch notes blurb** — short, Workshop-friendly, grouped under `# Heading` lines. Print to the chat for the user to copy; it becomes the GitHub release body.
2. **`versionsChangelog.md` update** — a *chronological* log. Add a new `## <version>` section at the top, above the previous release, with the same grouped bullets. Never rewrite an older release's section.
3. **`Ars Belli - Complete Changelog.md` update** — the *cumulative* state-of-mod document (published to Google Docs for players). It has two parts:
   - the **Cumulative Changelog** part describes the post-change state, so patch the affected lines in place — do not append "since mod.N" notes, and delete a bullet whose behavior was reverted;
   - the **Release History** part mirrors `versionsChangelog.md`, so paste the new version's section at the top of it.

   Bump the `Mod version:` line in the header too.

## Steps

1. **Determine the previous version tag.** Run `git tag -l "game.*.mod.*"` and pick the highest version-sorted tag that is reachable from `HEAD` and is *not* the current version in `.metadata/metadata.json`. If the user passed a tag/ref as an argument, use that instead. If no tag matches, ask the user which ref to diff from.
2. **Collect candidates.** `git log <prev_tag>..HEAD --oneline` plus `git status` (staged + unstaged + untracked tracked files). For each commit/change, you need the subject and, for ambiguous ones, the diff (`git show <sha>` or `git diff <path>`).
3. **Classify each candidate** using the lists below. Be conservative — when a commit subject is vague ("fix X"), look at the diff before deciding.
4. **Rewrite for players.** Drop file paths, scripted_effect names, scope/trigger jargon, REPLACE-prefix details, AI-tick mechanics, GUI-block coordinates. Keep numeric balance values, action names as they appear in-game, and player-visible behavior.
5. **Group** the surviving items under the section names used by the cumulative document: Game Rules, Multiplayer Power Ranking, Diplomatic Limits, New Diplomatic Actions, Changes to Vanilla Diplomatic Actions, Enforce Peace, Personal Unions, War/Wargoals and Peace, Forts and Sieges, Supply and Logistics, Mercenaries, Crusades and Jihads, Economy and Gold-Transfers, Buildings and Reforms, National Flavour, Pops/Map and Campaign Setup, UI and Quality of Life, Compatibility. Add a new heading only if no existing one fits.
6. **Print the blurb** with a header line `Since <prev_tag> → <current_version>:`, then the grouped bullets.
7. **Add the new section to `versionsChangelog.md`** at the top, and **fold the same items into `Ars Belli - Complete Changelog.md`** — patching the affected Cumulative Changelog lines in place, and pasting the new version's section at the top of its Release History part. Do NOT add change-history meta-lines to the cumulative part.
8. **Verify before you migrate.** The cumulative document claims things about the *current* build. When a bullet you are about to keep touches a file the release changed, re-check the file — overrides do get commented out or reverted upstream, and a stale bullet is worse than a missing one.

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
- A pop/setup commit touching many countries — summarize ("pop adjustments across Asia: …") rather than listing every country, matching the existing style in `versionsChangelog.md`.
- GUI commits — keep only the player-visible result ("foreign country panel now shows AP/DP/GP"), not the block-placement details.

## Style

- Lowercase first letter, no trailing period — match existing `versionsChangelog.md` bullets.
- Lead with the player verb or the noun the player will recognize ("crusades", "fort limit", "guarantees"), not the file or system name.
- Keep numbers. Drop internal identifiers (`force_break_union_cd`, `mp_limits_monthly_pulse`, etc.).
- If a change reverses or replaces a previous bullet in the cumulative document, edit or delete that bullet rather than leaving a contradicting one.

## Arguments

- No arg: diff from the highest `game.*.mod.*` tag below the current version.
- `<ref>`: diff from this ref instead (tag, branch, sha).
- `blurb`: only print the patch-notes blurb, do not edit either changelog file.
- `update`: only update the changelog files, do not print a blurb.
