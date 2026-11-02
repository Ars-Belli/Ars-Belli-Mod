# Hourly ticks for EU5 1.4 (version.dll)

EU5 1.3 ticked every 2 hours (`HOUR_TICK = 2`); 1.4 ticks once a day and the hour code and defines are gone
from the exe, so script can't bring them back (combat doc section 13). This is a `version.dll` proxy that
patches eu5.exe in memory when the game starts. Nothing on disk is changed, and it is not part of the
Workshop mod (the release zip takes only `in_game`, `main_menu`, `loading_screen`, `.metadata`).

## What it does (eu5.exe 1.4.6)
- **Date step** (`0x142fd82e0`): adds `hours_per_tick` instead of 24 hours. The date is still stored in hours,
  and each step sets new-day/week/month/year flags that pick the task list to run. A step inside a day sets
  no flag, matches no list and runs nothing (the engine logs that once), so daily, monthly and yearly work
  keeps its pace. Patched: three constants (`lea r10,[rax+0x18]` and the two folded `24 - 43800000` offsets).
- **Battles**: on steps that run no daily tasks the DLL runs one battle round itself: `CCombatManager`
  slot 8, the tick for every battle in progress. The manager is `*(field) + 0x26e40`; the DLL learns which
  game-state field from the first daily battle tick (it scans the game state for the pointer), and until then
  uses the manager that tick passed, dropped on a date jump (save load). The first guess, global
  `0x14fac1028 -> +0x108`, gave NULL in game, so in-between rounds were skipped. Day steps run it from the daily task as usual, so every tick is one round:
  24 / `hours_per_tick` rounds a day. Movement, sieges and the rest stay daily.
- **Game speed**: the mod defines 7 speeds in seconds per day (`01_abm_defines.txt`, `hud_topbar.gui`).
  `NGame.GAME_SPEED_TICKS` (seconds per tick, a float array at `*0x14fb229d0`, count at
  `+0xc`) is scaled by `hours_per_tick / 24`, so a day takes as long as before.
- **Date text**: the `GetDateString` getter (`0x1428fded0`) is replaced; it formats the date with the
  engine's own formatter (`0x140e58380`) and adds `, HH:00`.
- **Checksum**: the three entries into the checksum function (`0x140af8510`) go through a wrapper that feeds
  `1.4.6+abm-hourly-<h>h` instead of the game version string (`+0x1b8`). A player without the DLL, or with
  another `hours_per_tick`, has a different checksum and can't join.

## Safety
Only patches a known build (PE TimeDateStamp + SizeOfImage) after checking the bytes at every site;
anything else leaves the game untouched and only passes `version.dll` calls through. After a game update
it does nothing until a new `KNOWN_BUILDS` entry is added. Log: `binaries\ars_belli_hourly.log`
(rewritten each start; every battle tick with its date and hour, and whether the round came from the daily
task or the DLL).

## Use
`build.ps1` builds `out\version.dll` with portable Zig 0.17.0 (`E:\Tools\zig`, cache `E:\Tools\zig-cache`)
and runs the tests. Copy `out\version.dll` and `ars_belli_hourly.ini` to
`...\Europa Universalis V\binaries\`. Delete `version.dll` there to go back to vanilla ticks.

## Tests
- `test/test_host.c`: a stand-in program that imports version.dll; every call must reach the real one.
- `test/test_verify.c`: maps an eu5.exe image without running it, runs the DLL's checks, applies every
  patch to that copy and reads them back, and checks the checksum salt on a stand-in object. The 1.3.11
  exe must be refused.

## Adding a game build
Re-find each site from stable anchors, then add a `KNOWN_BUILDS` entry and run `build.ps1`:
- battle tick: `node vtables.js <exe> CCombatManager`, slot 8 (reads `DAYS_PER_PHASE`, `BOMBARD_DAYS`);
  manager pointer: the `CTickTask_CombatDailyUpdate` lambda (`_Func_impl_no_alloc<...Prepare...>`, slot 2).
- date step: only callee of `CDailyTickCommand` execute that adds `0x18`; constants `0x29c55a8`/`0xfd63aa58`.
- `GetDateString`: string xref in the GUI registration, the getter passed beside it.
- checksum: the function logging "Feeding game version into checksum"; find its E8/E9 entries.
- `GAME_SPEED_TICKS`: the define name string, registration passes the array address in R9.
Tools and method: `E:\Tools\ghidra-scripts` (README there).
