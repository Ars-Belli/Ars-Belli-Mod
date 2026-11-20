# Advance → CSV generation

Extract a per-advance summary CSV from an Ars Belli EU5 advance file
(`in_game/common/advances/*.txt`).

## Script

`.tools/eu5/parse_advances.py`

## CSV schema

| column        | content                                                              |
|---------------|----------------------------------------------------------------------|
| `type`        | left blank (reserved)                                                |
| `tags`        | all `has_or_had_tag` values, joined with `; `                        |
| `age`         | raw `age = <value>` (e.g. `age_1_traditions`)                        |
| `advance`     | advance key, with any `REPLACE:` prefix removed                      |
| `eu5_modifiers` | current uncommented `key = value` modifiers, joined with `; ` (inline `#` notes stripped) |
| `eu4_modifiers` | commented-out `# key = value` modifiers, joined with `; `          |

## Usage

One file → CSV written next to the script (same basename):

```bash
cd .tools/eu5
python3 parse_advances.py ../../in_game/common/advances/abm_africa_east.txt
```

One or more files → CSVs written to a chosen folder:

```bash
cd .tools/eu5
python3 parse_advances.py \
  ../../in_game/common/advances/abm_africa_west.txt \
  ../../in_game/common/advances/abm_africa_guinea.txt \
  ... \
  --out .
```

Using shell globs:

```bash
cd .tools/eu5
python3 parse_advances.py ../../in_game/common/advances/abm_*.txt --out .
```

## Region batches (as of 2026-08-14)

```bash
cd .tools/eu5

# Africa / Ethiopia / Guinea / Madagascar / Sahel / Somalia / Zimbabwe
python3 parse_advances.py \
  ../../in_game/common/advances/abm_africa_west.txt \
  ../../in_game/common/advances/abm_africa_east.txt \
  ../../in_game/common/advances/abm_africa_ethiopia.txt \
  ../../in_game/common/advances/abm_africa_guinea.txt \
  ../../in_game/common/advances/abm_madagascar.txt \
  ../../in_game/common/advances/abm_africa_sahel.txt \
  ../../in_game/common/advances/abm_africa_somalia.txt \
  ../../in_game/common/advances/abm_africa_zimbabwe.txt \
  --out .
```

To add a new region batch, find the matching source files with:

```bash
ls -1 ../../in_game/common/advances/ | grep -iE 'africa|egypt|ethiopia|guinea|madagascar|sahel|somalia|zimbabwe'
```

## Parser rules

- Blocks are `name = { ... }` and `REPLACE:name = { ... }`.
- Fully commented-out blocks (`# name = { ... }`) are skipped.
- `potential`, `allow`, `ai_chance`, `modifier_while_progressing` blocks are
  stripped before reading modifiers (so `has_or_had_tag`, `culture =`, etc.
  inside them are not treated as modifiers).
- Metadata keys ignored: `age`, `icon`, `requires`, `allow`, `ai_chance`,
  `ai_will_do`, `content_priority`, `government`, `country_type`, `for`,
  `allow_children`, `modifier_while_progressing`, and any `unlock_*` key.
- Inline `# ...` notes on modifier lines are stripped (e.g.
  `trade_range = 200 #new` → `trade_range = 200`).
- Only commented lines that contain `=` count as `eu4_modifiers`
  (plain `#` notes and `#` section headers are ignored).

## Region schema (`--region-csv`)

`.tools/scripts/export_advances_json_csv.py` can also emit the compact
per-advance table used for region review:

| column         | content                                                          |
|----------------|------------------------------------------------------------------|
| `tag/culture`  | `has_or_had_tag` value, or the `culture:` values of `potential` for culture-gated blocks (joined with `/`) |
| `region`       | EU5 map region(s) of the tag's homeland, alphabetical asc as the primary sort key (see below). Hand-added, not emitted by the script |
| `tier`         | `level` of the formable that grants that tag (0 when the tag is not formable) |
| `age`          | raw `age = <value>`                                              |
| `advance_name` | advance key, `REPLACE:` prefix removed                           |
| `modifier`     | current uncommented `key = value` modifiers, joined with `; `    |
| `eu4_ideas`    | the `# key = value` (EU4) lines, joined with `; `                |

`tier` comes from `formable_countries` (`level`, not the `tag =` field of a
nested `potential`). Pass vanilla first and the mod second so a repeated
formable id resolves to the mod's version:

```bash
cd ../..
python3 .tools/scripts/export_advances_json_csv.py \
  in_game/common/advances/abm_german.txt --region-csv \
  --formables "/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game/in_game/common/formable_countries" \
  --formables in_game/common/formable_countries \
  --out .tools/parsed
```

Culture-gated blocks (e.g. the Silesian set, since EU5 has no start-date
Silesia tag) take the tier of the formable whose `potential` names that
culture — `silesian` → `SIL_f` (level 2).

### `region` column + sort (`.tools/parsed/abm_german.csv`)

The German review table is sorted **region → tier (highest first) → tag →
age**, with a hand-added `region` column between `tag/culture` and `tier`.
`region` is the EU5 map region of the tag's homeland:

- 1337-start tags: the `10_countries_<region>_region.txt` file that defines
  the country in `main_menu/setup/1337/`.
- Formable-only tags (WES POM HAN SWA FKN GER HRE LOT) and culture-gated
  blocks (SIL): the formable's `areas` / `regions`, with areas resolved to
  regions through `in_game/map_data/definitions.txt`.
- Multi-region formables list every region, joined with `+`:
  `GER`/`HRE` = `north_german_region+south_german_region`, `LOT` =
  `france_region+north_german_region+south_german_region` (lorraine_area is
  `france_region`, the Rhineland/Low Countries areas are `north_german_region`,
  alsace_area is `south_german_region`).

Re-running the exporter with `--region-csv` regenerates the file **without**
`region` and unsorted, so re-apply the sort after any regeneration.
