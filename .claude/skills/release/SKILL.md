---
name: release
description: Cut a new GitHub release for the Ars Belli mod, matching the existing release pattern. Bumps the version + builds the ZIP via release.ps1, commits/tags/pushes, and publishes a GitHub release whose tag and title are the version string and whose body is the "Since <prev_tag> -> <version>" changelog blurb, with the versioned ZIP attached as an asset.
---

# release

Cut a new release of the Ars Belli mod and publish it to GitHub, mirroring the existing releases (run `gh release list` to see them). A release = a version bump, a built ZIP, a tagged commit on `main`, and a GitHub release carrying notes + the ZIP asset.

## What a release looks like (match this)

Every existing release (e.g. `game.1.2.4.mod.6`) shares this shape:

- **Tag name = title =** the version string `game.<gv>.mod.<n>` from `.metadata/metadata.json` (e.g. `game.1.2.4.mod.7`).
- **Body =** the changelog blurb: a header line `Since <prev_tag> → <version>:`, a blank line, then player-facing changes grouped under `# Heading` lines with `- bullet` items. In the published body the heading/bullet lines are indented two spaces — open a prior release body (`gh release view <prev_tag> --json body`) and copy the exact shape. Keep the unicode `→` and `×`. Optionally end with a line like `Workshop description updated to match.`
- **Asset =** the versioned ZIP `ArsBelliMod_<version>.zip`, produced by `release.ps1`. ZIPs are gitignored, so the release asset is the only published copy.
- Not a prerelease. GitHub auto-marks the newest as **Latest**.

The matching git commit is titled exactly the version string (e.g. commit subject `game.1.2.4.mod.6`) and touches `.metadata/metadata.json` + `changes.txt` (plus `workshop_description.txt` when wording changed).

## Steps (full cut-a-release)

1. **Pre-flight.** `git status -sb` — be on `main`, up to date, with all the code/balance changes you intend to ship already committed. Note the version currently in `.metadata/metadata.json`; that is the *previous, already-tagged* release (confirm with `git tag -l <that-version>`).
2. **Bump version + build ZIP.** Run `./release.ps1`. It bumps the trailing integer in `metadata.json` (`…mod.N` → `…mod.N+1`) and writes `ArsBelliMod_<new_version>.zip` to the repo root. It only bumps `.mod.<n>` — for a base-game bump (e.g. `1.2.4` → `1.2.5`) edit `version` and `supported_game_version` in `metadata.json` by hand *before* running it. (Neither `changes.txt` nor `workshop_description.txt` is bundled in the ZIP, so editing them before or after this step is fine.)
3. **Changelog.** Invoke the `changelog` skill. With `metadata.json` now holding the new (untagged) version, it picks `prev_tag` = the highest `game.*.mod.*` tag below it (the previous release), folds player-facing changes into `changes.txt`, and prints the `Since <prev_tag> → <version>:` blurb. Keep that blurb — it becomes the release body. Update `workshop_description.txt` too if any of its lines changed meaning.
4. **Commit.** Stage `.metadata/metadata.json`, `changes.txt`, and any `workshop_description.txt` edits; commit with the title set to the bare version string (no prefix), e.g. `git commit -m "game.1.2.4.mod.7"`, matching prior release commits.
5. **Tag + push.** `git tag <version>` then `git push origin main && git push origin <version>`.
6. **Create the GitHub release.** Reformat the blurb to the published body shape (2-space-indented `# Heading` / `- bullet`), then:
   ```
   gh release create <version> "ArsBelliMod_<version>.zip" \
     --title "<version>" \
     --notes "<body>"
   ```
   Pass `--notes` via a heredoc so newlines and the `→`/`×` unicode survive.
7. **Verify.** `gh release view <version> --json name,tagName,isPrerelease,assets` and `gh release list --limit 2` — confirm the asset uploaded, tag/title equal the version, `isPrerelease` is false, and it shows as Latest.

## Release-only (version already bumped, committed, tagged, pushed)

If `release.ps1` already ran and the tagged commit is pushed (you only owe the GitHub release), skip steps 2–5 and do 6–7. Build the body from the version's `changes.txt` entries / the blurb, or re-derive it by diffing `git log <prev_tag>..<version> --oneline` and classifying with the `changelog` skill's rules. Confirm `ArsBelliMod_<version>.zip` still sits in the repo root (it is left there by step 2 and gitignored); if it was deleted, build a ZIP at the current version matching `release.ps1`'s include list — do **not** just re-run `release.ps1`, which would bump the version again.

## Cautions

- This publishes to GitHub (shared/public) and the tag + release are visible immediately. Confirm the version and notes before step 6.
- Don't move or delete an existing tag/release to "redo" one — cut the next `.mod.N+1` instead.
- The Steam Workshop upload is still manual (Paradox uploader, using the built ZIP). This skill does not push to Steam.

## Arguments

- No arg: full cut-a-release flow (steps 1–7).
- `release-only` (or `notes`): assume the version is already bumped, committed, tagged, and pushed; just create + verify the GitHub release (steps 6–7).
- `<version>`: target this version string explicitly instead of reading it from `metadata.json` (handy with `release-only`).
