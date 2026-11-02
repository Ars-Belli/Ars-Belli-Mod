# Hourly ticks for EU5 1.4 (version.dll)

EU5 1.3 ticked every 2 hours (`HOUR_TICK = 2`); 1.4 ticks once a day and the hour code and defines are gone
from the exe, so script can't bring them back (combat doc section 13). This is a `version.dll` proxy that
patches eu5.exe in memory when the game starts. Nothing on disk is changed, and it is not part of the
Workshop mod (the release zip takes only `in_game`, `main_menu`, `loading_screen`, `.metadata`).

## What it does (eu5.exe 1.4.6)
- **Date step** (`0x142fd82e0`): adds `hours_per_tick` (default 2: 12 ticks a day, as 1.3) instead of 24 hours. The date is still stored in hours,
  and each step sets new-day/week/month/year flags that pick the task list to run. A step inside a day sets
  no flag and runs only the list under key 0, the engine's own every-tick list (a few tasks; the log names
  them). So daily, monthly and yearly work keeps its pace. Patched: three constants (`lea r10,[rax+0x18]` and the two folded `24 - 43800000` offsets).
- **Movement and battles** (`hourly_movement=1`, default): on steps that run no daily tasks the DLL runs a
  task graph itself: the smallest one in the game state's map that holds `UnitProgressMovementOneDay`, which
  is the plain-day list. The map: table `+0xe0`, mask `+0xec`, max probe `+0xf0`, 0x28-byte entries, key at
  `+8`, graph at `+0x10`; a graph is an array of task instances (count at `+0xc`). The graph is read from the
  game state, not remembered from the last day, so a player joining mid-day runs the same as the host. The
  key 0 list holds no daily tasks; the first build took it by mistake, so armies stood still. Every task's Prepare (vtable slot 9) is called from
  one site in the stage executor (`0x1435bbd9c`, `call [rax+0x48]`). That call now goes through a gate, which
  on these steps skips every task except:
  - 912 `UnitCancelRetreatIfNeeded`;
  - 913 `UnitHandleAttachment`, `UnitProgressMovementOneDay`, `UnitRemoveOverload`,
    `CalcCachedValuesForStartingBattle`, `UnitStartBattles`;
  - 914 `CombatDailyUpdate`;
  - 916/917 `ClearArrivingUnits`, `UpdateArrivingUnits`.

  A skipped Prepare leaves the task's job empty, and the executor counts it as done. So armies and navies
  move every tick, battles start at the hour armies meet, and every tick is one battle round
  (24 / `hours_per_tick` a day).
  - Speed: the movement job reads the unit speed through one call (`0x14395c4b1` -> `0x143511fa0`, fixed
    point, 100000 = 1). The DLL scales that result by `hours_per_tick / 24`, so a day's distance is
    unchanged. The other callers (the tooltip's arrival date, the AI) keep the daily speed, so the arrival
    date stays right.
  - Daily on purpose:
    - `913_SubUnitsProcessMoveCost`, the march morale cost. Each call charges a day's cost; the movement job
      only stores the rate on the unit (`+0x118`/`+0x120`/`+0x128`).
    - Sieges, supply and attrition.
    - AI orders.
- **Arrival date to the hour** (with hourly movement): the unit tooltip's "Will arrive in X on DATE"
  (`ESTIMATE_ARIVAL`, `DEFINITE_ESTIMATE_ARIVAL`). The engine estimate (`0x143531980`; `0x143531d70` adds the
  next location) reads the daily speed, rounds the days left up and returns now + days * 24 hours.
  - The tooltip's three calls to it go through a wrapper. On that thread only (TLS), its two speed reads
    return the per-tick speed, and the wrapper turns the whole "days" into ticks: now + ticks * hours_per_tick.
    The AI's own calls to the same functions stay in days.
  - If the unit's earliest-arrival date (`unit +0x820`, `0x29c77f8` = not set) is still ahead, or the
    estimate is the "can't get there" date (global `0x14fafbc50`), the engine's answer stays.
  - Its four date-text calls (`0x140e58380`) add `, HH:00` with the same clock as the top bar.
  - The map marker text `UNIT_WILL_ARRIVE` is not built in the exe and is untouched.
- **Battles only** (`hourly_movement=0`): on those steps the DLL runs one battle round itself
  (`CCombatManager` slot 8). The manager is `*(game state + 0x108) + 0x26e40`, taken from the build table;
  a build without that field learns it from the first daily battle tick.
- **Game speed**: the mod defines 7 speeds in seconds per day (`01_abm_defines.txt`, `hud_topbar.gui`).
  `NGame.GAME_SPEED_TICKS` (seconds per tick, a float array at `*0x14fb229d0`, count at
  `+0xc`) is scaled by `hours_per_tick / 24`, so a day takes as long as before.
- **Date text**: the `GetDateString` getter (`0x1428fded0`) is replaced; it formats the date with the
  engine's own formatter (`0x140e58380`) and adds `, HH:00`. The clock goes one hour a tick from
  `first_hour` (default 7): 07:00 to 18:00 at 12 ticks a day, then 07:00 the next day. Only the text: the
  stored hour stays real (0, 2 ... 22) and the day turns at midnight. The log shows the same clock.
- **Checksum**: the three entries into the checksum function (`0x140af8510`) go through a wrapper that feeds
  `1.4.6+abm-hourly-<h>h` (plus `-move` with hourly movement) instead of the game version string (`+0x1b8`).
  A player without the DLL, or with another `hours_per_tick` or movement setting, has a different checksum
  and can't join.

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
  patch to that copy and reads them back. On stand-ins it checks the checksum salt, the task gate, the
  speed scaling and the graph lookup. The 1.3.11 exe must be refused.

## Adding a game build
Re-find each site from stable anchors, then add a `KNOWN_BUILDS` entry and run `build.ps1`:
- battle tick: `node vtables.js <exe> CCombatManager`, slot 8 (reads `DAYS_PER_PHASE`, `BOMBARD_DAYS`);
  manager pointer: the `CTickTask_CombatDailyUpdate` lambda (`_Func_impl_no_alloc<...Prepare...>`, slot 2).
- date step: only callee of `CDailyTickCommand` execute that adds `0x18`; constants `0x29c55a8`/`0xfd63aa58`.
- `GetDateString`: string xref in the GUI registration, the getter passed beside it.
- checksum: the function logging "Feeding game version into checksum"; find its E8/E9 entries.
- `GAME_SPEED_TICKS`: the define name string, registration passes the array address in R9.
- task graphs: the date step's only call to the graph runner. Before that call the step hashes the four
  flags with FNV-1a and looks them up in the game-state map.
- stage executor: the runner's per-stage callee. It builds a `CGameTickTaskExecutionContext` (find it by its
  vftable xref) and calls the task's slot 9 right after.
- hourly tasks: `node vtables.js <exe> CTickTask_<Name>@unity_<hash>`. The names come from RTTI; most of
  these classes sit in anonymous namespaces.
- arrival estimate: string xrefs `ESTIMATE_ARIVAL` / `DEFINITE_ESTIMATE_ARIVAL` give the two tooltip
  functions; their callees that call the unit speed and add `days * 0x18` are the estimates. The
  `cmp ecx,0x29c77f8` on `+0x820` is in the first one.
- unit speed: the call in the `UnitProgressMovementOneDay` job lambda (`_Func_impl_no_alloc<...Prepare...>`,
  slot 2) whose result is added to the unit's progress (`+0x8e0`).
Tools and method: `E:\Tools\ghidra-scripts` (README there).
