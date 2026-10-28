# eu5save.js - read an EU5 binary save

Checks what script actually wrote into a game (variables, modifiers, buildings, countries)
when an in-game test "does nothing". Node only, no packages; a 270 MB gamestate takes seconds.

```
node .tools/scripts/eu5_save/eu5save.js <command> <save> [args]
```

`<save>` is a `.eu5` file, an already extracted folder, or `latest` (newest save in
`Documents/Paradox Interactive/Europa Universalis V/save games`). A `.eu5` is extracted once to
`%TEMP%/eu5save/<name>-<mtime>/` and reused.

| Command | What it prints |
|---|---|
| `vars <save> <var>` | every holder of a script variable and its value |
| `find <save> <string> [max] [after]` | key path and surrounding tokens of each use of a string (variable, modifier, rule option, building type...) |
| `buildings <save> [type=X] [location=id-or-key] [owner=id]` | building instances: type, level, location, owner country id |
| `dump <save> <path> [maxTokens]` | the object at a key path, e.g. `locations>locations>3074` |
| `refs <save> <key> <value>` | every object holding `key = value`, e.g. `location 3074` |
| `country <save> <id>...` | first tokens of a country (tag, name, type) |
| `top <save>` | the gamestate's top-level sections |
| `loc <id-or-key>...` | location id <-> key, no save needed |
| `extract <save.eu5> [outdir]` | just unpack `gamestate` and `string_lookup` |

Example (2026-10-28, trade office limit): `vars latest abm_trade_office_count` listed the count in
every location, `buildings latest type=trade_office location=pesaro` showed only two offices at
level 5 in Pesare, so the "sixth office" was really the player's own office going to level 6.

The player's country: the save header (`dump <save> "#9de"`) holds its display name
("Lombardia"); match it with `country` (whose `country_name` is the tag, e.g. ABLOM).

## Format

Game 1.4.4; re-check after a game update if the output looks garbled
(`find` paths that keep growing = a token with the wrong payload size).

- `.eu5` = `SAV0...` text line + binary metadata + a zip with `gamestate` and `string_lookup`.
  .NET `ZipFile` extracts nothing from it; walk the zip local headers (`PK\3\4`) and inflate.
- `string_lookup`: 5-byte header, then strings as u16 length + bytes; a string's index is its order.
- `gamestate` tokens are u16 LE:
  - `0001` `=`, `0003` `{`, `0004` `}`
  - `000c` i32, `0014` u32, `029c` u64, `0317` i64, `000d` f32, `0167` f64, `000e` bool (1 byte),
    `000f` / `0017` string (u16 length + bytes)
  - string_lookup references: `0d40` / `0d5a` u8 index, `0d3e` / `0d5b` u16, `0d41` / `0d5c` u24
    (the `0d5x` ones are mostly keys), `0d42` empty
  - fixed point / 100000: `0d47` zero, `0d48`..`0d4e` positive with 1..7 bytes, `0d4f`..`0d55` negative
  - any other id is a key token with no payload (its name is unknown - shown as `#hex`)
- Script variables: `variables = { data = { { flag = NAME data = { type = value identity = N } } } }`,
  value = N / 100000.
- Location id = order in `in_game/map_data/location_templates.txt` (1 = stockholm). Locations live in
  `locations > locations > <id>` (`owner`, `market`, `rank`, `variables`, `timed_modifiers`,
  `foreign_building_visible`); buildings in `building_manager > database > <n>`
  (`type`, `level`, `location`, `owner`); countries in `countries > database > <id>`.
- Game folder: `E:/Steam/steamapps/common/Europa Universalis V/game`, override with `EU5_GAME`.
