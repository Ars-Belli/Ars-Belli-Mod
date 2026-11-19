# Country picker generator

Builds the "Ars Belli Country Picker" page: every landed 1337 start country with the content gated to it by tag, primary culture, culture group / language, capital region or state religion, plus the formable nations it qualifies for. A second view (`#build`) puts together a country from a base country, a government, a religion and the formable nations it plans to form; a third (`#ranking`) ranks all countries, and the build, by a military score.

```
node build.js                      # writes out/country_picker.html
node build.js --out <file.html> --json <data.json> --vanilla <EU5 game dir>
```

`country_picker.html` in this folder is the last published page (https://claude.ai/artifact/VgvSVyJNnuZj6QK5zdm6Wi). Refresh it with `node build.js --out country_picker.html` and republish it to the same URL.

Defaults: vanilla at `E:/Modding/EU5/vanilla-game-1.4.9/game` (or `EU5_VANILLA`), mod = this repo. Takes about 25 s. `out/` is git-ignored. To update the published page, republish the new HTML to the same artifact URL.

## Files

- `pdx.js` – script parser and layered loader. Vanilla, then DLC, then mod; a mod file with a vanilla filename hides the vanilla file; plain definitions load first and `REPLACE:` / `INJECT:` / `TRY_*` overrides apply afterwards (INJECT appends, so repeated modifier keys are summed).
- `world.js` – localisation (`main_menu/localization/english`, `replace/` wins), script values, modifier types, `map_data/definitions.txt` geography, cultures + languages, start countries. Start countries come from the repo's split `main_menu/setup/1337/10_countries_*.txt` (first claim wins, as in `merge_country_setup.ps1`), culture/religion from `in_game/setup/countries`, government type from setup templates (recursive includes), subjects from `12_diplomacy.txt`.
- `gates.js` – three-valued trigger evaluation (true / false / depends on play). An item attaches to a country when its gate is not false and at least one tag / culture / group / language / capital-geography check is true. Religion content (see below) attaches on a true religion check instead. For start countries, government type and religion are decisive (the page switches them per country; see `gx`/`rx` below). Tribal, subject and country type are compared with the start state; when they differ they become a "Needs" condition instead of excluding the item. Formables are evaluated without a fixed government or religion, so those stay "Needs". Scripted triggers are expanded inline (with `$PARAM$` substitution).
- `build.js` – content extraction and rendering, then embeds the JSON into `template.html`.

## Content types

Advances (including `religion_*.txt`), estate privileges, government reforms, law policies (international-organisation laws skipped), bureaucracies, unit types (country and location potential, location checked against the capital), levies (`allowed_culture`), buildings, decisions, generic actions, cabinet actions, casus belli, events whose options add a country modifier with no duration, formable countries. Per religion: its own `definition_modifier` (every block merged, so INJECTs add up) and its religious aspects (`religious_aspects/`, keyed by `religion = X`, with `visible` / `enabled` read as gates).

**Religion content** = items whose gate checks religion and nothing country, culture or place specific: religion advances, religion-gated privileges, laws, bureaucracies, actions, CBs, events and so on, plus the religion modifier and aspects. They are evaluated once per religion and government type (`rc` below), not per country, and shown under "State religion" (via `f`). Items that mix religion with culture or place checks stay per country (`rx`).

## JSON shape (`--json`)

- `items[i]`: `t` type, `n` name, `fx` display lines `[text, sentiment, subLine, condIdx]`, `mv` unconditional modifiers `[modIdx, scopeIdx, value]`, `mc` conditional modifiers `[modIdx, scopeIdx, value, condIdx]`, `cd` condition texts (indexed by `condIdx`), `k` number of start countries that get the item.
- `mods[modIdx]` = `[name, format p|a|n|b, decimals, colour 1 good / -1 bad / 0 neutral]`; `scopes[scopeIdx]` = prefix (`''` country-wide, `'Locations: '`, ...).
- `countries[c].refs` = `[itemIdx, via, needs|null, condStates]` for the start government (`gk`) and start religion (`rk`). `condStates` is one letter per `item.cd`: `T` met, `F` not met, `U` depends on play. Trailing fields appear only when present.
- `countries[c].gx[gov]` = refs that differ under another government type; a ref with only an index means the item is unavailable. `govs` lists `[key, name]`.
- `items[i].rl` = `[religions, religionGroups]` named by the item's religion checks (only on items whose gate depends on religion). A religion falls in one class per item: the religion itself if listed, else `group*` if its group is listed, else `-` (any other).
- `countries[c].rx` = `[[itemIdx, {"gov|class": ref | 0}]]`: results under another religion class that differ from the government-only result. Look up `gov|class` (government-dependent items) then `*|class`; `0` means unavailable, a missing key means unchanged. Apply after `gx`. `religions` lists `[key, name, group]`, `rgroups` `[key, name]`.
- `rc[religion]` = `{ refs, gx }`: religion content for a monarchy, and per other government type the refs that differ (same shapes as a country's `refs` / `gx`). A country's full content = its `refs` (+`gx`, +`rx`) plus `rc[rk]` (+`gx[gk]`); country `refs` no longer include religion content. `religions[i][3]` = how many aspects the religion holds (absent = none). Item types `rel` (religion modifier) and `asp` (aspect) are new.
- `countries[c].forms` = `[[formableIdx, needs?]]`: formables tied to the country by its culture, language, tag or capital region. `countries[c].fo` = `[formableIdx]`: formables open to any country (potential with no such check), whose conditions are `formables[i].pn` (potential evaluated without a country). A formable is left out when its potential or its `allow` is false for the country's culture, language or tag. Subject status never rules one out (a subject can break free), nor does the capital's location in `allow` (a capital can move), and an `allow` that is false even without a country (`always = no`, an IO that exists) is treated as an event or world condition. Culture is taken as fixed.
- A modifier block with `potential_trigger` or `scale` is conditional; `display_trigger` is ignored. Unconditional blocks of the same kind are merged.

## Build a country

Page-only (no extra JSON). Formables come from the base country's `forms` and `fo` (open ones are marked "any country"); following the game (`formable_countries/readme.txt`: players can only form countries of higher level) a build forms at most one nation per level, in rising order, above the base tag's own level (a start country that is itself a formable tag has that level). Content = the base country's refs under the chosen government and religion, plus each formed tag's `refs`, whose culture / language / government / religion conditions (evaluated without a culture) are checked against the build in the page; conditions it cannot decide stay as Needs. The build is kept in the address (`#build?c=ARA&g=…&r=…&f=SPA`) and in localStorage, scored with `milScore` and listed as a highlighted row in the ranking.

## Military ranking

`node rank.js <data.json>` prints the same ranking from the JSON (start setup, religion content included). Ported from `notes/op_rank_reference.js` (STRICT=1, BURX=2) and checked to give the same base scores on the same data. Weights per 1.0: Discipline 100, Army Morale 25 (flat base morale `land_morale` at 25/3, as base land morale is 3.0), Military Tactics 50 (so +10% morale = +2.5% discipline = +0.05 tactics), unit-type Power 33, Manpower 25, Army Maintenance Efficiency 25, Levy Combat Efficiency 20, Levy Size / Army Levy Size 10, Mercenary Maintenance Efficiency 5, unit-type Maintenance Cost −8. Country-wide, `Always` and `Well funded` scopes; bureaucracies all count with well-funded values doubled; best policy per law per modifier; `mc` lines count when `T` or (not `F` and `not Reform: …`); best N aspects. Base = no Needs, or Needs only Advance / Age / Institution / an own unconditional reform or privilege; +Conditional = the rest. Two deliberate differences from the reference: `mc` lines whose condition is `T` count, and a law's best policy is chosen by weighted value (so a maintenance-cost cut counts as best).

## Known limits

- Religion content is evaluated for an independent, settled country; subject-only or country-type conditions show as Needs.
- Religious aspects are choices: the page lists all of them, and the ranking counts the best N by military value (N = `religions[i][3]`).
- The picked government type decides `government_type`, `has_tribal_government` and `has_reform` of a reform tied to another type; any other reform check stays conditional.
- `NOT` with several children is read as NOR.
- `trigger_else` branches are treated as satisfied.
- Custom tooltip texts that contain live data (`[...]`) are replaced by the underlying conditions.
- Unit stats are the values written in the unit block (the differences from its `copy_from` template), not the final in-game numbers.
- Tags that are neither start countries nor formables (colonial nations, releasables, dynasty tags) get no page; build.js prints how many mod items that leaves out.
