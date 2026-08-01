# Ars Belli Mod — LLM Instructions & Conventions

## Project Overview
Europa Universalis V (EU5) overhaul mod focusing on Chinese Red Turban period.
Mod root: `/home/zp/Games/Modding/Ars-Belli-Mod`
Game root: `/home/zp/Games/SteamLibrary/steamapps/common/Europa Universalis V/game`

## Advance Files
All tag-specific China advances are in `in_game/common/advances/abm_f3-t2_*_china.txt`:
- `_east`: CGU, CFN, WUU, CNP, JNX, CTW, CHU, CHE, MNG (9 tags)
- `_south`: LEZ, CDN, MNE, LNG (4 tags)
- `_norh`: YUA, CMO, ANX, SAI, KHA, SHD, AYG, CSO (8 tags)
- `_west`: CXI, HNG, CSI, GNS, BIG (5 tags)
Total: 26 tags

## Advance Naming Convention
```
abm_<tag_lowercase>_china_tradition_1   # age_1, first modifier
abm_<tag_lowercase>_china_tradition_2   # age_1, second modifier
abm_<tag_lowercase>_<descriptive_name>  # ages 2-5, Chinese-themed
abm_<tag_lowercase>_china_ambition      # last age (age_5 or age_6)
```

## Advance Structure Pattern
```paradox
abm_tag_advance_name = {
    age = age_X_era
    icon = vanilla_icon_name

    potential = {
        has_or_had_tag = TAG
        culture = { has_culture_group = culture_group:chinese_group }
    }
    requires = vanilla_prerequisite_advance

    modifier_key = value
}
```

### Rules for Advances
1. **One modifier per advance** — split multi-modifier advances
2. **Never require other ABM advances** — only vanilla prerequisites
3. **Unique icons per tag** — no icon repeats within a tag
4. **Age-appropriate prerequisites** — requires must be same age or earlier
5. **Traditions & ambitions** — names stay `china_tradition_1/2` and `china_ambition`, only icon/requires updated
6. **Shared advances** — some advances use `OR = { has_or_had_tag = TAG, has_or_had_tag = ABECP }` (east) or `ABWCP` (west) for formable China inheritance

### Vanilla Icon Pool
- 392 unique vanilla icons available
- Located via: `grep -rh "icon = " <game>/in_game/common/advances/*.txt`
- Icons should be diverse — 256 unique used across 257 advances (target: max variety)

### Common Vanilla Prerequisites by Age
- **age_1**: `feudalism_advance`, `guilds`, `legalism_advance`, `ship_building_advance`
- **age_2**: `merchants_and_trade`, `trade_range_advance_age_2`, `naval_morale_advance_1`, `construction_speed_renaissance`, `drill_army_advance`, `army_professionalism`
- **age_3**: `colonial_charters`, `boarding_parties`, `trade_envoys`, `rgo_logistics_discovery`, `pike_and_shot_advance`
- **age_4**: `imperial_ambitions`, `boarding_parties`, `recruitment_improvements_reformation`, `pharmacology_advance`
- **age_5**: `absolute_rulership`, `national_sovereignty`, `naval_morale_advance_1`
- **age_6**: `modern_bureaucracy`, `merchant_power_from_maritime_revolutions_advance`

### Culture Gating Pattern
```paradox
potential = {
    has_or_had_tag = TAG
    culture = { has_culture_group = culture_group:chinese_group }
}
```

## Tool Scripts (in `.tools/`)
1. **`split_traditions_ambitions.py`** — splits age_1 double-modifier into tradition_1/2, renames last to ambition
2. **`update_advance_names_icons_requires.py`** — updates names/icons/requires based on modifier-to-vanilla mapping
3. **`diversify_icons.py`** — assigns unique vanilla icons via global round-robin

## Key Modifier Categories → Icon/Requires Mapping
- **trade** → `red_sea_trade`/`saharan_gold_trade` → `guilds`
- **naval_range** → `royal_navy` → `trade_range_advance_age_2`
- **naval_damage** → `glorious_arms`/`defensive_army` → `naval_morale_advance_1`/`boarding_parties`
- **blockade** → `gunpowder_advance` → `naval_morale_advance_1`
- **maritime_presence** → `colonies` → `colonial_charters`
- **sailors** → `nor_bounties_of_the_sea` → `trade_range_advance_age_2`
- **military** → `glorious_arms`/`army_professionalism`/`drill_army_advance`
- **siege** → `gunpowder_advance`/`artillery_institution_advance`
- **economy** → `court_accounting`/`banking_advance`/`abacus_advance`
- **admin** → `smooth_administration`/`crown_power_advance_renaissance` → `legalism_advance`
- **culture/pop** → `cultural_acceptance_advance`/`church_councils`
- **estates** → `crown_power_advance_renaissance` → `feudalism_advance`/`distribution_of_power_advance`

## When Editing Advances
- Use `replace_string_in_file` with 3-5 lines of context for safety
- Never use regex that could corrupt modifier values
- Always use line-by-line parsing for icon/requires replacement
- Verify with `grep` after changes
- Run `git diff` before committing

## Git Workflow
- Branch: `feature/china`
- Commit frequently with descriptive messages
- Push with `git push`
