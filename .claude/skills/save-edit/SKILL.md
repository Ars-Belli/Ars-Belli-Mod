---
name: save-edit
description: Edit an EU5 save for a playtest or a campaign fix - redraw borders, annex subjects, add cores, trim or add buildings, accept cultures - by generating a small local helper mod whose script effects run inside the game from one-click decisions, then checking the result in the new save. Use when the user asks to change, clean up or prepare a save game.
---

# save-edit

Change a save by letting the game do it: a local helper mod holds script effects built from the save's own data, the
user loads the save, takes a decision per step, and saves. Tools are in `.tools/scripts/save_edit/`.

**Do not edit the save file by hand.** A text save is editable, but every country keeps its own lists of owned,
controlled and core locations and provinces next to the location records, and buildings, pops and markets point at
owners too. One missed list corrupts the save. The game's effects keep all of it consistent.

## Method

1. **Find the save and what it is.** `node .tools/scripts/save_edit/extract.js <file|name|latest> <name>` reads a TEXT
   (debug) save in about a minute and prints its date. Check the save's game version against the installed game: map
   and country files come from `EU5_GAME` (default: the installed game).
2. **Pin down the request before planning.** Things to ask when the request leaves them open: what happens to wars and
   occupations, whole-country cases (annex or keep), and who gets stray locations. Offer the in-game script route as
   the method.
3. **Plan in a script, on the extract.** Load it with `state.js`, apply the changes to a copy of the owner list
   (`st.owners()`), and write the planned owners and the list of transfers to the work folder. Look for pieces the
   changes cut off (`st.components`, `st.borders`) and hand small ones to the neighbour with the longest border.
4. **Look at the map.** `node render.js <name> <planned owners.json>` and Read the PNG. Stray locations show at once.
5. **Generate the helper mod** with `helper_mod.js`: one scripted effect file, one decision per step. Check every
   script command against vanilla files before using it (grep the game folder for a real use).
6. **The user runs it.** Add the mod to the playset after Ars Belli, restart the game, load the save, take the
   decisions in order, save under a new name, remove the mod. Claude cannot run the game: say plainly that nothing was
   run until the user reports back.
7. **Verify in the new save.** Extract it and compare each location's owner with the planned owners: expect 0
   differences. Check cores and control the same way, and `logs/error.log` for the mod's file names.
8. **Next round = a new extract.** Plan every further round on the save the user made, never on the old one.

## Tools

| File | What it does |
|---|---|
| `extract.js` | One pass over a text save into `<work>/<name>.json`: locations (owner, controller, cores, rank, development, tax), countries, subject relations with their type, every building. |
| `state.js` | Loads an extract with the map: locations by id and name with continent / region / area / province, countries by tag, neighbours with border lengths, connected pieces of a country. |
| `render.js` | Political map PNG of an extract or of planned owners. |
| `helper_mod.js` | Writes the mod: metadata, scripted effects (with brace, location-name and tag checks), decisions and their texts. Also the list of tags script can name. |
| `summary.js` | Strength of countries from the save (locations, development, tax, military buildings), for comparing them. |
| `peek.js` | Lists the keys under any path of a text save, to find where something is stored. |
| `example_hispania_1549/` | The first use, two rounds: plan and mod scripts for a 1549 campaign save (subjects annexed, three countries merged, 190 locations moved, buildings trimmed and added, cultures accepted). Copy from it. |

Extracts, plans and maps go to `.tools/scripts/save_edit/.work/` (not in git). `EU5_SAVE_WORK`, `EU5_GAME` and
`EU5_MODS` move the work folder, the game files and where the mod is written.

## Script commands that worked

All used in game on 1.4.7, each first found in a vanilla file.

- Wars: country scope `every_current_war = { white_peace = this }`.
- Annex: annexer scope `annex_country = { country = <country> reason = Diplomatic transfer = yes }`. Do a subject's own
  subjects first. Leave `subject_type:state_bank` and `subject_type:secessionists` alone.
- Move a subject: subject scope `make_subject_of = { target = c:TAG type = subject_type:colonial_nation }`.
- Location: `change_location_owner = c:TAG`, `add_core = c:TAG`, `change_integration_level = core`,
  `change_location_controller = c:TAG`. A new owner needs all four for clean, usable land.
- Where: `continent = continent:europe`, `region = region:maghreb_region`, `area = area:tunis_area` on a location;
  `capital ?= { continent = continent:europe }` on a country.
- Buildings: location scope `change_building_level_in_location = { building = building_type:X value = -1 }`, with
  `owner = <country>` for a foreign building. `value = 1` on a location without one builds it. Level test:
  `location_building_level = { building_type = building_type:X value > <script value> }` (add `owner =` for foreign
  ones; without it only the location owner's building counts). Existence: `has_building = building_type:X`.
- Loops: `while = { limit = { ... } ... }`. Scripted effects take parameters (`$BUILDING$`, `c:$TO$`).
- Cultures: country scope `add_accepted_culture = <culture>` and `grant_culture_bonus_advances = <culture>`; culture
  scope `set_cultural_view = { target = <culture> value = kindred }` and `reverse_set_cultural_view` for the other
  direction. A location's largest culture is `dominant_culture`.

## What went wrong, and what to know

- **The decision tooltip froze the game.** The game writes out the tooltip of every effect in a decision. Put the whole
  effect in `hidden_effect` with a one-line `custom_tooltip` (`helper_mod.js` does).
- **Countries created during a campaign cannot be named.** Tags like `AAA01` are not in the game files, so `c:AAA01`
  does not resolve. Reach them through iterators (`every_subject`, `every_country`) and saved scopes. Tags defined in
  `setup/countries` or as formables (`tag = SPA` in `formable_countries`) can be named; `staticTags()` lists them.
  The first tag of a setup file sits right after the file's byte order mark: allow for it when matching.
- **Province names from the user are display names.** Look them up in the localization (`krakow_province: "Kraków"`,
  `przemysl_province: "Nadsania"`, `koln_bucht_province: "Cologne Bay"`). A name that matches no province is often a
  single location.
- **Building limits are script values**: let the game evaluate them (`value > manpower_max_level`) instead of working
  out populations. Armories go in towns and cities, training fields in rural settlements. The game removes both where
  the location's largest culture is neither the country's own nor accepted, and it does so only when time runs: accept
  cultures before the user unpauses, then add buildings.
- **Cultural views belong to the culture pair, not the country.** Setting two cultures to kindred changes it for
  everyone.
- **Nothing updates until the game runs.** After an edit the save's last-month numbers (population, income, manpower,
  army size) are still the old ones; locations, owners, cores and buildings are current.
- **A change can cut pieces off.** After every transfer list, look for small disconnected pieces again. Islands always
  show as separate pieces: ignore those with no land neighbour.
- **Each decision hides itself** with a global variable once taken. The variable stays in the save, harmlessly.
- **Files:** script and localization files with a byte order mark, CRLF line ends. Write generator scripts with the
  Write tool: shell heredocs drop backslashes from regular expressions.
- **Location ids** in a save are positions in `metadata > compatibility > locations`, counted from 1.
