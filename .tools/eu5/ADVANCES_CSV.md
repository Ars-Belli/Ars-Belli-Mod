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
python3 parse_advances.py ../../in_game/common/advances/abm_f5-t3_egypt.txt
```

One or more files → CSVs written to a chosen folder:

```bash
cd .tools/eu5
python3 parse_advances.py \
  ../../in_game/common/advances/abm_f5-t3_africa_west.txt \
  ../../in_game/common/advances/abm_f5-t3_guinea.txt \
  ... \
  --out .
```

Using shell globs:

```bash
cd .tools/eu5
python3 parse_advances.py ../../in_game/common/advances/abm_f5-t3_*.txt --out .
```

## Region batches (as of 2026-08-14)

```bash
cd .tools/eu5

# Africa / Egypt / Ethiopia / Guinea / Madagascar / Sahel / Somalia / Zimbabwe
python3 parse_advances.py \
  ../../in_game/common/advances/abm_f5-t3_africa_west.txt \
  ../../in_game/common/advances/abm_f5-t3_africa_east.txt \
  ../../in_game/common/advances/abm_f5-t3_egypt.txt \
  ../../in_game/common/advances/abm_f5-t3_ethiopia.txt \
  ../../in_game/common/advances/abm_f5-t3_guinea.txt \
  ../../in_game/common/advances/abm_f5-t3_madagascar.txt \
  ../../in_game/common/advances/abm_f5-t3_sahel.txt \
  ../../in_game/common/advances/abm_f5-t3_somalia.txt \
  ../../in_game/common/advances/abm_f5-t3_zimbabwe.txt \
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
