/* Ars Belli hourly ticks: a version.dll proxy that gives EU5 1.4 sub-day ticks
   again, the way 1.3 had them (HOUR_TICK).

   EU5 1.4 advances the date by a compiled 24 hours per tick and runs every
   daily task each tick. The date is still stored in hours, and each tick the
   date step sets four flags (new day / week / month / year) that pick the task
   list to run. So with a smaller step:
     - the date step adds hours_per_tick instead of 24 (three constants);
     - ticks that don't start a new day set no flag and match the key 0 list,
       which is empty: daily, monthly and yearly work keeps running once per
       day/month/year;
     - on those ticks this DLL runs the day's task graph again with every task
       skipped except army/navy movement, battle starts and the battle round
       (hourly movement: each task's Prepare goes through one call site, which
       the DLL gates), so units move and fight every tick; unit speed in the
       movement job is scaled by hours_per_tick/24 so a day's distance stays the
       same. The march morale cost, sieges, supply and the AI stay daily. With
       hourly_movement=0 it only runs the battle round (CCombatManager slot 8);
     - the game-speed table (seconds per tick) is scaled by hours_per_tick/24 so
       a day still takes as long as before;
     - the unit tooltip's "Will arrive in X on DATE" counts in ticks and shows
       the hour (with hourly movement);
     - the top-bar date (GetDateString) shows a 1.3-style clock: the ticks of a
       day are shown one hour apart from first_hour (07:00 to 18:00 at 12 ticks
       a day), whatever the stored hour is;
     - the multiplayer checksum gets a salt, so players without the same DLL and
       setting can't join (they would go out of sync).
   Nothing in eu5.exe on disk changes. Every site is byte-checked against a known
   build before anything is written; on any other build the DLL only passes
   version.dll calls through. */
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <wchar.h>

#include "exports.h"

#define DECLARE_REAL(name) extern void *real_##name;
VERSION_EXPORTS(DECLARE_REAL)

#define DATE_EPOCH_HOURS 43800000 /* the date's hour count starts 5000 years before year 0 */

typedef struct {
  uint32_t rva;
  uint8_t len;
  uint8_t bytes[24];
} code_check_t;

typedef struct {
  const char *name;
  uint32_t time_date_stamp, size_of_image;
  /* battles */
  uint32_t combat_vftable, combat_slot, combat_tick;
  code_check_t combat_tick_start;
  uint32_t combat_manager_offset;  /* manager = *(game state + combat_manager_field) + this */
  uint32_t combat_manager_field;   /* 0 = unknown: learned from the first daily battle tick */
  /* date */
  uint32_t game_state_global; /* date (8 bytes) at +8 */
  uint32_t date_step;
  uint32_t date_step_calls[2];      /* E8 rel32 */
  code_check_t step_hours;          /* lea r10,[rax+0x18]: new hour count */
  code_check_t step_offset_a;       /* lea ecx,[rax+(24-EPOCH)] */
  code_check_t step_offset_b;       /* add edx,(24-EPOCH) */
  /* date text */
  code_check_t get_date_string;     /* GUI getter, replaced */
  uint32_t date_format, string_from_cstr, engine_free;
  /* checksum */
  uint32_t checksum;
  uint32_t checksum_entries[3];     /* E8/E9 rel32 into it */
  uint32_t checksum_version_offset; /* game version string fed into the checksum */
  /* speed */
  uint32_t speed_ticks_array;       /* NGame.GAME_SPEED_TICKS: float* at +0, count at +0xc */
  /* hourly movement */
  code_check_t graph_map_lookup;    /* task-graph map in the game state: mask +0xec, table +0xe0, entries 0x28 */
  code_check_t graph_map_end;       /* max probe byte +0xf0 */
  code_check_t graph_run_args;      /* graph = entry + 0x10 */
  uint32_t graph_run_call, graph_run; /* E8 in the date step -> graph runner (game state, date*, graph) */
  code_check_t prepare_call;        /* stage executor: mov rax,[rbx]; lea rdx,[rbp+X]; mov rcx,rbx; call [rax+0x48] */
  uint32_t unit_speed_call, unit_speed; /* E8 in the movement job -> unit speed (unit, int64 *out, flag) */
  struct { uint32_t vftable; const char *name; } hourly_tasks[12]; /* tasks that run on in-between ticks */
  /* arrival estimate to the hour (unit tooltip) */
  uint32_t estimate_a, estimate_b;      /* (unit, date *out, location): arrival date, counted in whole days */
  uint32_t estimate_calls_a[2], estimate_call_b; /* the tooltip's calls: E8 -> estimate_a / estimate_b */
  uint32_t estimate_speed_calls[2];     /* E8 -> unit_speed inside estimate_a and estimate_b */
  uint32_t arrival_format_calls[4];     /* E8 -> date_format for the arrival date in the tooltip */
  code_check_t earliest_arrival;        /* mov ecx,[rdi+0x820]; cmp ecx,UNSET: the unit's earliest arrival */
  uint32_t estimate_never;              /* global date the estimate returns when the unit can't get there */
} build_t;

static const build_t KNOWN_BUILDS[] = {
  {
    .name = "1.4.6 (ud009/release/hotfix)",
    .time_date_stamp = 0x6ae34c4c, .size_of_image = 0x10559000,
    .combat_vftable = 0x0c7ef738, .combat_slot = 8, .combat_tick = 0x024a7620,
    .combat_tick_start = { 0x024a7620, 16, { 0x55, 0x41, 0x57, 0x41, 0x56, 0x41, 0x55, 0x41, 0x54, 0x56, 0x57, 0x53, 0x48, 0x81, 0xec, 0x68 } },
    .combat_manager_offset = 0x26e40, .combat_manager_field = 0x108, /* seen in game 2026-11-02 */
    .game_state_global = 0x0fac4028,
    .date_step = 0x02fd82e0,
    .date_step_calls = { 0x02fd8113, 0x02fd813e },
    .step_hours = { 0x02fd857f, 4, { 0x4c, 0x8d, 0x50, 0x18 } },
    .step_offset_a = { 0x02fd8583, 6, { 0x8d, 0x88, 0x58, 0xaa, 0x63, 0xfd } },
    .step_offset_b = { 0x02fd85b1, 6, { 0x81, 0xc2, 0x58, 0xaa, 0x63, 0xfd } },
    .get_date_string = { 0x028fded0, 10, { 0x56, 0x57, 0x53, 0x48, 0x83, 0xec, 0x60, 0x48, 0x89, 0xce } },
    .date_format = 0x00e58380, .string_from_cstr = 0x00c7e0a0, .engine_free = 0x0b004260,
    .checksum = 0x00af8510,
    .checksum_entries = { 0x00959658, 0x00af8503, 0x00b88cd4 },
    .checksum_version_offset = 0x1b8,
    .speed_ticks_array = 0x0fb229d0,
    .graph_map_lookup = { 0x02fd8b8a, 20, { 0x8b, 0x86, 0xec, 0x00, 0x00, 0x00, 0x48, 0x98, 0x21, 0xc1, 0x48, 0x63, 0xd1, 0x48, 0x8b, 0x8e, 0xe0, 0x00, 0x00, 0x00 } },
    .graph_map_end = { 0x02fd8bf0, 22, { 0x0f, 0xb6, 0x96, 0xf0, 0x00, 0x00, 0x00, 0x48, 0x01, 0xd0, 0x48, 0x8d, 0x14, 0x80, 0x4c, 0x8d, 0x04, 0xd1, 0x49, 0x83, 0xc0, 0x28 } },
    .graph_run_args = { 0x02fd8c1b, 14, { 0x49, 0x83, 0xc0, 0x10, 0x48, 0x8d, 0x95, 0x38, 0x04, 0x00, 0x00, 0x48, 0x89, 0xf1 } },
    .graph_run_call = 0x02fd8c29, .graph_run = 0x02fecca0,
    .prepare_call = { 0x035bbd8f, 17, { 0x48, 0x8b, 0x03, 0x48, 0x8d, 0x95, 0x20, 0x16, 0x00, 0x00, 0x48, 0x89, 0xd9, 0xff, 0x50, 0x48, 0x90 } },
    .unit_speed_call = 0x0395c4b1, .unit_speed = 0x03511fa0,
    .hourly_tasks = {
      { 0x0c900398, "UnitCancelRetreatIfNeeded" },         /* 912 */
      { 0x0c900828, "UnitHandleAttachment" },              /* 913 */
      { 0x0c900cb8, "UnitProgressMovementOneDay" },        /* 913 */
      { 0x0c901b38, "UnitRemoveOverload" },                /* 913 */
      { 0x0c9013f8, "CalcCachedValuesForStartingBattle" }, /* 913 */
      { 0x0c9016a8, "UnitStartBattles" },                  /* 913 */
      { 0x0c907e88, "CombatDailyUpdate" },                 /* 914 */
      { 0x0c9b2ad8, "ClearArrivingUnits" },                /* 916 */
      { 0x0c9b2d88, "UpdateArrivingUnits" },               /* 917 */
    },
    .estimate_a = 0x03531980, .estimate_b = 0x03531d70,
    .estimate_calls_a = { 0x034e0318, 0x047e97cb }, .estimate_call_b = 0x047e972c, /* ESTIMATE_ARIVAL, DEFINITE_ESTIMATE_ARIVAL */
    .estimate_speed_calls = { 0x035319c4, 0x03531d8c },
    .arrival_format_calls = { 0x034e032c, 0x047e9857, 0x047e9904, 0x047e99a7 },
    .earliest_arrival = { 0x03531d0b, 12, { 0x8b, 0x8f, 0x20, 0x08, 0x00, 0x00, 0x81, 0xf9, 0xf8, 0x77, 0x9c, 0x02 } },
    .estimate_never = 0x0fafbc50,
  },
};

/* ---- state ---- */
typedef uint64_t (*tick_fn)(void *, void *, void *, void *);
typedef void (*step_fn)(void *);
typedef void *(*date_format_fn)(const void *date, void *out, uint64_t flag);
typedef void *(*string_from_cstr_fn)(void *out, const char *s);
typedef void (*engine_free_fn)(void *p);
typedef uint64_t (*checksum_fn)(void *obj, uint64_t flag);

static int g_hours_per_tick = 2;
static int g_movement;           /* hourly movement on (ini hourly_movement and the build checks) */
static int g_arrival_hours;      /* tooltip arrival date counted in ticks, with the hour */
static int g_first_hour = 7;     /* hour the first tick of a day shows */
static uint8_t *g_base;
static const build_t *g_build;
static tick_fn g_tick;
static step_fn g_step;
static date_format_fn g_date_format;
static string_from_cstr_fn g_string_from_cstr;
static engine_free_fn g_free;
static checksum_fn g_checksum;
static volatile LONG g_combat_ran;
static char g_salted_version[128];

static CRITICAL_SECTION g_log_lock;
static FILE *g_log;
static int g_log_lines;

static void log_line(const char *fmt, ...) {
  if (!g_log || g_log_lines > 5000) return;
  EnterCriticalSection(&g_log_lock);
  SYSTEMTIME t;
  GetLocalTime(&t);
  fprintf(g_log, "%02d:%02d:%02d.%03d  ", t.wHour, t.wMinute, t.wSecond, t.wMilliseconds);
  va_list ap;
  va_start(ap, fmt);
  vfprintf(g_log, fmt, ap);
  va_end(ap);
  fputc('\n', g_log);
  fflush(g_log);
  if (++g_log_lines == 5000) fputs("(log limit reached)\n", g_log);
  LeaveCriticalSection(&g_log_lock);
}

/* ---- engine strings: 16 bytes; byte 15 bit 7 = heap (ptr +0, length +8,
   capacity|flags +0xc), else inline (length = byte 15 & 0xf, max 14);
   bit 6 of byte 15 = buffer not owned (never freed) ---- */
static void string_view(const uint8_t *s, const char **chars, uint32_t *len) {
  if (s[15] & 0x80) {
    *chars = *(const char *const *)s;
    *len = *(const uint32_t *)(s + 8);
  } else {
    *chars = (const char *)s;
    *len = s[15] & 0xf;
  }
}

/* ---- dates ---- */
static uint8_t *game_state(void) { return *(uint8_t **)(g_base + g_build->game_state_global); }

/* The hour shown for a date: tick n of the day (n = stored hour / hours_per_tick)
   shows first_hour + n, so the clock goes one hour a tick, as in 1.3. The stored
   hour stays a real one (0, 2, 4 ... at 2 hours a tick); only the text differs. */
static int shown_hour(int32_t stored_hours) {
  int hour = stored_hours % 24;
  if (hour < 0) hour += 24;
  return g_first_hour + hour / g_hours_per_tick;
}

/* first_hour from the ini, moved earlier if the day's last tick would pass 23:00 */
static int fit_first_hour(int first, int hours_per_tick) {
  int ticks = 24 / hours_per_tick;
  if (first < 0) first = 0;
  if (first + ticks - 1 > 23) first = 24 - ticks;
  return first;
}

static void describe_date(uint64_t date, char *out, size_t n) {
  snprintf(out, n, "%d.%d.%d %02d:00", (int)(int16_t)(date >> 48), (int)((date >> 40) & 0x7f) + 1,
           (int)((date >> 32) & 0xff) + 1, shown_hour((int32_t)date));
}

/* ---- battles ----
   The daily task reaches the manager as *(context->x + 0x108) + 0x26e40, where x is
   not the global tried first (that gave NULL in game, 2026-11-02). So the DLL learns
   the chain from the daily call itself: it looks for the field of the game state
   (date at +8) that points at manager - 0x26e40. Until then, or if none is found, it
   uses the manager the daily task passed, dropped on any date jump (save load). */
static void *g_daily_mgr;            /* last manager the daily task passed */
static int g_chain_offset = -1;      /* game-state field pointing at manager - combat_manager_offset */

static int is_combat_manager(void *mgr) {
  return mgr && *(void **)mgr == (void *)(g_base + g_build->combat_vftable);
}

static size_t readable_bytes(const void *p, size_t want) {
  MEMORY_BASIC_INFORMATION mbi;
  if (!VirtualQuery(p, &mbi, sizeof mbi) || mbi.State != MEM_COMMIT) return 0;
  if (mbi.Protect & (PAGE_NOACCESS | PAGE_GUARD)) return 0;
  size_t left = (size_t)((uint8_t *)mbi.BaseAddress + mbi.RegionSize - (uint8_t *)p);
  return left < want ? left : want;
}

static void learn_chain(void *mgr) {
  uint8_t *gs = game_state();
  if (!gs) return;
  uint8_t *want = (uint8_t *)mgr - g_build->combat_manager_offset;
  size_t n = readable_bytes(gs, 0x2000) & ~(size_t)7;
  for (size_t off = 0; off < n; off += 8)
    if (*(uint8_t **)(gs + off) == want) {
      g_chain_offset = (int)off;
      log_line("combat manager %p = *(game state %p + 0x%x) + 0x%x", mgr, gs, g_chain_offset,
               g_build->combat_manager_offset);
      return;
    }
  log_line("combat manager %p: no game-state field points at it; using the daily task's pointer", mgr);
}

static void *combat_manager(void) {
  if (g_chain_offset >= 0) {
    uint8_t *gs = game_state();
    uint8_t *inner = gs ? *(uint8_t **)(gs + g_chain_offset) : NULL;
    void *mgr = inner ? inner + g_build->combat_manager_offset : NULL;
    if (is_combat_manager(mgr)) return mgr;
  }
  return is_combat_manager(g_daily_mgr) ? g_daily_mgr : NULL;
}

static int active_battles(void *mgr) { return mgr ? *(int *)((uint8_t *)mgr + 0x8c) : -1; }

/* vtable slot 8: the daily task's battle tick. Runs once, as in vanilla. */
static uint64_t hook_tick(void *mgr, void *a2, void *a3, void *a4) {
  static int attempts;
  if (g_chain_offset < 0 && attempts < 3) {
    attempts++;
    learn_chain(mgr);
  }
  g_daily_mgr = mgr;
  InterlockedExchange(&g_combat_ran, 1);
  return g_tick(mgr, a2, a3, a4);
}

/* ---- game speed: seconds per tick, scaled so a day lasts as long as before ---- */
static float *g_speed_array;
static float g_speed_first;

static void scale_speed_table(void) {
  uint8_t *arr_obj = g_base + g_build->speed_ticks_array;
  float *arr = *(float **)arr_obj;
  int n = *(int *)(arr_obj + 0xc);
  if (!arr || n <= 0 || n > 16) return;
  if (arr == g_speed_array && arr[0] == g_speed_first) return;
  char before[128] = "", after[128] = "";
  for (int i = 0; i < n; i++) {
    snprintf(before + strlen(before), sizeof before - strlen(before), "%s%.3g", i ? " " : "", arr[i]);
    arr[i] *= (float)g_hours_per_tick / 24.0f;
    snprintf(after + strlen(after), sizeof after - strlen(after), "%s%.3g", i ? " " : "", arr[i]);
  }
  g_speed_array = arr;
  g_speed_first = arr[0];
  log_line("GAME_SPEED_TICKS (seconds per tick) %s -> %s", before, after);
}

/* ---- hourly movement ----
   On an in-between tick the DLL runs one of the game's own task graphs (the
   lists the date step picks for a new day), but every task's Prepare goes
   through hook_prepare, which skips all tasks except hourly_tasks while
   g_inbetween is set. A skipped Prepare leaves the task's job empty, and the
   stage executor then counts it done. Movement then runs 24/h times a day, so
   the unit speed it reads is scaled by h/24. 913_SubUnitsProcessMoveCost (the
   march morale cost) is not in the list: it charges once per call. */
typedef void (*prepare_fn)(void *task, void *ctx);
typedef void (*graph_run_fn)(void *gs, void *date, void *graph);
typedef int64_t *(*unit_speed_fn)(void *unit, int64_t *out, uint64_t flag);

static graph_run_fn g_graph_run;
static unit_speed_fn g_unit_speed;
static volatile LONG g_inbetween;
static void *g_allowed_vt[12];
static const char *g_allowed_name[12];
static int g_allowed_n;
static volatile LONG g_ran_mask, g_skipped;

static void hook_prepare(void *task, void *ctx) {
  void **vt = *(void ***)task;
  if (g_inbetween) {
    int i = 0;
    while (i < g_allowed_n && g_allowed_vt[i] != (void *)vt) i++;
    if (i == g_allowed_n) {
      InterlockedIncrement(&g_skipped);
      return;
    }
    InterlockedOr(&g_ran_mask, 1L << i);
  }
  ((prepare_fn)vt[9])(task, ctx);
}

/* the movement job's speed read: a day's move split over the day's ticks */
static int64_t *hook_unit_speed(void *unit, int64_t *out, uint64_t flag) {
  int64_t *r = g_unit_speed(unit, out, flag);
  *out = *out * g_hours_per_tick / 24;
  return r;
}

/* graph = { task **tasks; ...; int count at +0xc }; returns 1 if it holds a task with vftable vt */
static int graph_has(uint8_t *graph, void *vt) {
  void **tasks = *(void ***)graph;
  int n = *(int *)(graph + 0xc);
  if (!tasks || n <= 0 || n > 100000 || readable_bytes(tasks, (size_t)n * 8) < (size_t)n * 8) return 0;
  for (int i = 0; i < n; i++)
    if (tasks[i] && readable_bytes(tasks[i], 8) == 8 && *(void **)tasks[i] == vt) return 1;
  return 0;
}

/* The task graphs sit in the game state's map, keyed by four flags (in game, 1.4.6:
   day 108 tasks, a second flag 2, month 107, year 13; every combination is built and
   holds the union, key 0 0 0 0 holds none). The DLL takes the smallest graph that
   holds the movement task (the plain day); every task not in hourly_tasks is skipped
   anyway. Taking the fewest flags instead picked the year-only list (13 tasks).
   Read from the game state (cached per map), not remembered from the last day, so a
   player joining mid-day runs the same as everyone else. */
static void *g_move_vt;
static uint8_t *g_map_gs, *g_map_table;
static int g_map_mask = -2;
static void *g_map_graph;

static void *find_graph(uint8_t *gs, int log_map) {
  uint8_t *table = *(uint8_t **)(gs + 0xe0);
  int mask = *(int *)(gs + 0xec);
  int n = mask + 1 + gs[0xf0];
  if (!table || mask < 0 || mask > 0xffff) return NULL;
  if (readable_bytes(table, (size_t)n * 0x28) < (size_t)n * 0x28) return NULL;
  void *best = NULL;
  int best_tasks = 0x7fffffff;
  for (int i = 0; i < n; i++) {
    uint8_t *e = table + (size_t)i * 0x28;
    if (!e[4]) continue; /* empty slot */
    uint8_t *graph = e + 0x10;
    int tasks = *(int *)(graph + 0xc);
    int has_move = graph_has(graph, g_move_vt);
    if (log_map)
      log_line("task graph key %d %d %d %d: %d tasks%s", e[8], e[9], e[10], e[11], tasks, has_move ? ", has movement" : "");
    if (has_move && tasks < best_tasks) {
      best = graph;
      best_tasks = tasks;
    }
  }
  return best;
}

static void *graph_for(uint8_t *gs) {
  uint8_t *table = *(uint8_t **)(gs + 0xe0);
  int mask = *(int *)(gs + 0xec);
  if (gs == g_map_gs && table == g_map_table && mask == g_map_mask && g_map_graph) return g_map_graph;
  static int logged;
  void *graph = find_graph(gs, logged++ < 2);
  g_map_gs = gs;
  g_map_table = table;
  g_map_mask = mask;
  g_map_graph = graph;
  log_line("hourly movement: task graph %p (%d tasks)", graph, graph ? *(int *)((uint8_t *)graph + 0xc) : 0);
  return graph;
}

static uint64_t g_hourly_runs;

static int run_hourly_tasks(uint8_t *gs) {
  void *graph = graph_for(gs);
  if (!graph) {
    static int warned;
    if (!warned++) log_line("hourly movement: no task graph with the movement task; only the battle round runs");
    return 0;
  }
  uint64_t date = *(uint64_t *)(gs + 8);
  g_ran_mask = 0;
  g_skipped = 0;
  InterlockedExchange(&g_inbetween, 1);
  g_graph_run(gs, &date, graph);
  InterlockedExchange(&g_inbetween, 0);
  if (++g_hourly_runs <= 2) {
    char ran[512] = "", missing[512] = "";
    for (int i = 0; i < g_allowed_n; i++) {
      char *dst = (g_ran_mask & (1L << i)) ? ran : missing;
      snprintf(dst + strlen(dst), 512 - strlen(dst), "%s%s", *dst ? " " : "", g_allowed_name[i]);
    }
    log_line("hourly run %llu: graph %p (%d stages), %ld tasks skipped; ran: %s; not in the graph: %s",
             (unsigned long long)g_hourly_runs, graph, *(int *)((uint8_t *)graph + 0xc), (long)g_skipped, ran,
             *missing ? missing : "none");
  }
  return 1;
}

/* ---- arrival date in the unit tooltip, to the hour ----
   The engine's estimate (estimate_a; estimate_b adds the next location) takes the
   unit's daily speed, rounds the days left up and returns now + days * 24 hours.
   For the tooltip's calls only, the DLL makes the speed it reads per tick (on that
   thread, so the AI's own calls stay daily) and turns the days it returns into
   ticks: now + ticks * hours_per_tick. If the unit has an earliest-arrival date
   (unit +0x820) still ahead, or can't get there, the engine's answer stays. The
   formatted date then gets ", HH:00" like the top bar. */
#define EARLIEST_ARRIVAL_UNSET 0x29c77f8 /* 1.1.1, the engine's "not set" */
typedef int32_t *(*estimate_fn)(void *unit, int32_t *date, void *location);
static estimate_fn g_estimate_a, g_estimate_b;
static DWORD g_tls_estimate = TLS_OUT_OF_INDEXES;

static int64_t *hook_estimate_speed(void *unit, int64_t *out, uint64_t flag) {
  int64_t *r = g_unit_speed(unit, out, flag);
  if (g_tls_estimate != TLS_OUT_OF_INDEXES && TlsGetValue(g_tls_estimate)) *out = *out * g_hours_per_tick / 24;
  return r;
}

/* date = hours since the epoch, plus the packed day (+4, from 0), month (+5, from 0), year (+6) */
static void set_date_hours(int32_t *date, int32_t hours) {
  static const uint8_t month_days[12] = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
  int32_t days = (hours - DATE_EPOCH_HOURS) / 24;
  int doy = days % 365, month = 0;
  while (doy >= month_days[month]) doy -= month_days[month++];
  uint8_t *p = (uint8_t *)date;
  date[0] = hours;
  p[4] = (uint8_t)doy;
  p[5] = (uint8_t)month;
  *(int16_t *)(p + 6) = (int16_t)(days / 365);
}

static int32_t *estimate_to_hour(void *unit, int32_t *date, void *location, estimate_fn fn) {
  uint8_t *gs = game_state();
  if (!gs) return fn(unit, date, location);
  int32_t now = *(int32_t *)(gs + 8);
  int32_t earliest = *(int32_t *)((uint8_t *)unit + 0x820);
  if (earliest != EARLIEST_ARRIVAL_UNSET && earliest > now) return fn(unit, date, location);
  TlsSetValue(g_tls_estimate, (void *)1);
  fn(unit, date, location);
  TlsSetValue(g_tls_estimate, NULL);
  if (*(uint64_t *)date == *(uint64_t *)(g_base + g_build->estimate_never)) return date;
  int32_t span = date[0] - now; /* whole "days" here are ticks */
  if (span > 0 && span % 24 == 0) set_date_hours(date, now + span / 24 * g_hours_per_tick);
  return date;
}
static int32_t *hook_estimate_a(void *unit, int32_t *date, void *location) {
  return estimate_to_hour(unit, date, location, g_estimate_a);
}
static int32_t *hook_estimate_b(void *unit, int32_t *date, void *location) {
  return estimate_to_hour(unit, date, location, g_estimate_b);
}

static void *date_text_with_hour(const void *date, void *out, uint64_t flag);

static void *hook_format_arrival(const void *date, void *out, uint64_t flag) {
  if (*(const uint64_t *)date == *(uint64_t *)(g_base + g_build->estimate_never)) return g_date_format(date, out, flag);
  return date_text_with_hour(date, out, flag);
}

/* ---- date step: one tick ---- */
static uint64_t g_ticks, g_extra_rounds;
static void *g_last_gs;
static int32_t g_last_hours;

static void hook_step(void *gs) {
  scale_speed_table();
  int32_t hours_before = *(int32_t *)((uint8_t *)gs + 8);
  if (gs != g_last_gs || hours_before != g_last_hours) {
    if (g_ticks) log_line("date jumped (load?): manager pointer from the daily task dropped until the next day");
    g_daily_mgr = NULL; /* a loaded game may hold a new manager */
  }
  void *mgr = combat_manager();
  int battles_before = active_battles(mgr);

  InterlockedExchange(&g_combat_ran, 0);
  g_step(gs);
  g_ticks++;

  const char *round = "daily task";
  int32_t hours_now = *(int32_t *)((uint8_t *)gs + 8);
  if (hours_now % 24 != 0) { /* in-between tick: the step ran no task list */
    if (g_movement && run_hourly_tasks(gs)) round = g_combat_ran ? "hourly tasks" : "hourly tasks, NO BATTLE ROUND";
    if (!g_combat_ran) {
      mgr = combat_manager();
      if (mgr) {
        g_tick(mgr, NULL, NULL, NULL);
        g_extra_rounds++;
        round = "extra";
      } else {
        round = "SKIPPED (no manager)";
      }
    }
  }

  g_last_gs = gs;
  g_last_hours = *(int32_t *)((uint8_t *)gs + 8);
  int battles_after = active_battles(combat_manager());
  if (g_ticks <= 30 || battles_before > 0 || battles_after > 0) {
    char when[48];
    describe_date(*(uint64_t *)((uint8_t *)gs + 8), when, sizeof when);
    log_line("tick %llu %s  battles %d -> %d, round: %s", (unsigned long long)g_ticks, when,
             battles_before, battles_after, round);
  }
}

/* ---- dates with the hour: "<engine date>, HH:00" into a new engine string at out ---- */
static void *date_text_with_hour(const void *date, void *out, uint64_t flag) {
  uint8_t text[16];
  memset(text, 0, sizeof text);
  g_date_format(date, text, flag);
  const char *chars;
  uint32_t len;
  string_view(text, &chars, &len);
  char buf[256];
  snprintf(buf, sizeof buf, "%.*s, %02d:00", (int)(len < 200 ? len : 200), chars, shown_hour(*(const int32_t *)date));
  if ((text[15] & 0x80) && !(text[15] & 0x40) && *(void **)text) g_free(*(void **)text);
  return g_string_from_cstr(out, buf);
}

/* top-bar date (replaces the GetDateString getter) */
static void *hook_get_date_string(void *out) {
  uint8_t *gs = game_state();
  if (!gs) return g_string_from_cstr(out, "");
  uint64_t date = *(uint64_t *)(gs + 8);
  return date_text_with_hour(&date, out, 0);
}

/* ---- checksum: feed a salted version string instead of the plain one ---- */
static uint64_t hook_checksum(void *obj, uint64_t flag) {
  uint8_t *version = (uint8_t *)obj + g_build->checksum_version_offset;
  uint8_t saved[16];
  memcpy(saved, version, sizeof saved);
  const char *chars;
  uint32_t len;
  string_view(version, &chars, &len);
  int n = snprintf(g_salted_version, sizeof g_salted_version, "%.*s+abm-hourly-%dh%s",
                   (int)(len < 64 ? len : 64), chars, g_hours_per_tick, g_movement ? "-move" : "");
  /* a heap-form string over our own buffer, flagged not-owned so the engine never frees it */
  *(char **)version = g_salted_version;
  *(uint32_t *)(version + 8) = (uint32_t)n;
  *(uint32_t *)(version + 12) = ((uint32_t)n + 1) | 0xC0000000u;
  log_line("checksum: game version fed as \"%s\"", g_salted_version);
  uint64_t r = g_checksum(obj, flag);
  memcpy(version, saved, sizeof saved);
  return r;
}

/* ---- patching ---- */
static int check_code(uint8_t *base, const code_check_t *c, const char *what) {
  if (memcmp(base + c->rva, c->bytes, c->len) == 0) return 1;
  log_line("bytes at %s (rva 0x%x) differ from the known build: nothing patched", what, c->rva);
  return 0;
}

static int rel32_target_is(uint8_t *base, uint32_t site_rva, uint32_t target_rva, const char *what) {
  uint8_t *site = base + site_rva;
  if ((site[0] == 0xE8 || site[0] == 0xE9) && site + 5 + *(int32_t *)(site + 1) == base + target_rva) return 1;
  log_line("%s at rva 0x%x is not a call/jmp to rva 0x%x: nothing patched", what, site_rva, target_rva);
  return 0;
}

static int write_code(void *dst, const void *src, size_t n) {
  DWORD old;
  if (!VirtualProtect(dst, n, PAGE_EXECUTE_READWRITE, &old)) return 0;
  memcpy(dst, src, n);
  VirtualProtect(dst, n, old, &old);
  FlushInstructionCache(GetCurrentProcess(), dst, n);
  return 1;
}

/* absolute jump: jmp [rip+0] ; dq target (14 bytes) */
static void make_abs_jump(uint8_t *at, void *target) {
  at[0] = 0xFF; at[1] = 0x25;
  memset(at + 2, 0, 4);
  memcpy(at + 6, &target, 8);
}

/* executable page within rel32 reach (below the image) for call-site stubs */
static uint8_t *alloc_near(uint8_t *base) {
  SYSTEM_INFO si;
  GetSystemInfo(&si);
  uintptr_t gran = si.dwAllocationGranularity;
  uintptr_t lowest = (uintptr_t)base > 0x70000000u ? (uintptr_t)base - 0x70000000u : gran;
  for (uintptr_t a = ((uintptr_t)base - gran) & ~(gran - 1); a > lowest; a -= gran) {
    MEMORY_BASIC_INFORMATION mbi;
    if (!VirtualQuery((void *)a, &mbi, sizeof mbi)) break;
    if (mbi.State != MEM_FREE) continue;
    void *p = VirtualAlloc((void *)a, gran, MEM_RESERVE | MEM_COMMIT, PAGE_EXECUTE_READWRITE);
    if (p) return p;
  }
  return NULL;
}

static int retarget_rel32(uint8_t *base, uint32_t site_rva, uint8_t *stub) {
  uint8_t *site = base + site_rva;
  int64_t rel = stub - (site + 5);
  if (rel != (int32_t)rel) return 0;
  int32_t rel32 = (int32_t)rel;
  return write_code(site + 1, &rel32, 4);
}

/* Finds the build of the image at base and checks every patch site.
   Returns the build, or NULL (reason logged) if anything differs. */
static const build_t *check_build(uint8_t *base) {
  IMAGE_DOS_HEADER *dos = (IMAGE_DOS_HEADER *)base;
  IMAGE_NT_HEADERS64 *nt = (IMAGE_NT_HEADERS64 *)(base + dos->e_lfanew);
  uint32_t stamp = nt->FileHeader.TimeDateStamp, size = nt->OptionalHeader.SizeOfImage;
  log_line("eu5.exe at %p, TimeDateStamp 0x%08x, SizeOfImage 0x%08x", base, stamp, size);

  const build_t *b = NULL;
  for (size_t i = 0; i < sizeof KNOWN_BUILDS / sizeof *KNOWN_BUILDS; i++)
    if (KNOWN_BUILDS[i].time_date_stamp == stamp && KNOWN_BUILDS[i].size_of_image == size) b = &KNOWN_BUILDS[i];
  if (!b) {
    log_line("UNKNOWN eu5.exe build (game updated?): nothing patched, the game runs daily ticks");
    return NULL;
  }
  void **slot = (void **)(base + b->combat_vftable + 8 * b->combat_slot);
  if (*slot != base + b->combat_tick) {
    log_line("CCombatManager slot %u holds %p, expected %p: nothing patched", b->combat_slot, *slot, base + b->combat_tick);
    return NULL;
  }
  int ok = check_code(base, &b->combat_tick_start, "battle tick") &&
           check_code(base, &b->step_hours, "date step hours") &&
           check_code(base, &b->step_offset_a, "date step offset a") &&
           check_code(base, &b->step_offset_b, "date step offset b") &&
           check_code(base, &b->get_date_string, "GetDateString");
  for (int i = 0; ok && i < 2; i++) ok = rel32_target_is(base, b->date_step_calls[i], b->date_step, "date step call");
  for (int i = 0; ok && i < 3; i++) ok = rel32_target_is(base, b->checksum_entries[i], b->checksum, "checksum entry");
  return ok ? b : NULL;
}

static int vftable_is_task(uint8_t *base, uint32_t vt_rva, const char *name) {
  IMAGE_NT_HEADERS64 *nt = (IMAGE_NT_HEADERS64 *)(base + ((IMAGE_DOS_HEADER *)base)->e_lfanew);
  uint8_t *end = base + nt->OptionalHeader.SizeOfImage;
  uint8_t *col = *(uint8_t **)(base + vt_rva - 8);
  if (col < base || col + 24 > end) return 0;
  uint32_t td = *(uint32_t *)(col + 12);
  if (td + 16 + 128 > nt->OptionalHeader.SizeOfImage) return 0;
  char want[128];
  int n = snprintf(want, sizeof want, ".?AVCTickTask_%s@", name);
  return strncmp((const char *)base + td + 16, want, (size_t)n) == 0;
}

/* Checks the hourly-movement sites; fills the allowed task list. */
static int check_movement(uint8_t *base, const build_t *b) {
  if (!check_code(base, &b->graph_map_lookup, "task-graph map lookup") ||
      !check_code(base, &b->graph_map_end, "task-graph map end") ||
      !check_code(base, &b->graph_run_args, "task-graph run arguments") ||
      !check_code(base, &b->prepare_call, "task Prepare call") ||
      !rel32_target_is(base, b->graph_run_call, b->graph_run, "task-graph run call") ||
      !rel32_target_is(base, b->unit_speed_call, b->unit_speed, "unit speed call"))
    return 0;
  g_allowed_n = 0;
  for (int i = 0; i < 12 && b->hourly_tasks[i].name; i++) {
    if (!vftable_is_task(base, b->hourly_tasks[i].vftable, b->hourly_tasks[i].name)) {
      log_line("vftable rva 0x%x is not CTickTask_%s", b->hourly_tasks[i].vftable, b->hourly_tasks[i].name);
      return 0;
    }
    g_allowed_vt[g_allowed_n] = base + b->hourly_tasks[i].vftable;
    if (strcmp(b->hourly_tasks[i].name, "UnitProgressMovementOneDay") == 0) g_move_vt = g_allowed_vt[g_allowed_n];
    g_allowed_name[g_allowed_n++] = b->hourly_tasks[i].name;
  }
  return g_allowed_n > 0 && g_move_vt;
}

/* Checks the arrival-estimate sites (tooltip calls, speed reads, date formatting). */
static int check_arrival(uint8_t *base, const build_t *b) {
  int ok = check_code(base, &b->earliest_arrival, "earliest arrival check");
  for (int i = 0; ok && i < 2; i++) ok = rel32_target_is(base, b->estimate_calls_a[i], b->estimate_a, "arrival estimate call");
  ok = ok && rel32_target_is(base, b->estimate_call_b, b->estimate_b, "arrival estimate call (next location)");
  for (int i = 0; ok && i < 2; i++) ok = rel32_target_is(base, b->estimate_speed_calls[i], b->unit_speed, "estimate speed call");
  for (int i = 0; ok && i < 4; i++) ok = rel32_target_is(base, b->arrival_format_calls[i], b->date_format, "arrival date text call");
  return ok;
}

/* Applies every patch to the image at base (build already checked). */
static int apply_patches(uint8_t *base, const build_t *b, int hours, int movement) {
  g_base = base;
  g_build = b;
  g_tick = (tick_fn)(void *)(base + b->combat_tick);
  g_step = (step_fn)(void *)(base + b->date_step);
  g_date_format = (date_format_fn)(void *)(base + b->date_format);
  g_string_from_cstr = (string_from_cstr_fn)(void *)(base + b->string_from_cstr);
  g_free = (engine_free_fn)(void *)(base + b->engine_free);
  g_checksum = (checksum_fn)(void *)(base + b->checksum);
  if (b->combat_manager_field) g_chain_offset = (int)b->combat_manager_field; /* rounds run right after a load */
  g_graph_run = (graph_run_fn)(void *)(base + b->graph_run);
  g_unit_speed = (unit_speed_fn)(void *)(base + b->unit_speed);
  g_movement = movement && check_movement(base, b);
  if (movement && !g_movement) log_line("hourly movement sites differ from the known build: movement stays daily");
  g_estimate_a = (estimate_fn)(void *)(base + b->estimate_a);
  g_estimate_b = (estimate_fn)(void *)(base + b->estimate_b);
  if (g_movement && g_tls_estimate == TLS_OUT_OF_INDEXES) g_tls_estimate = TlsAlloc();
  g_arrival_hours = g_movement && g_tls_estimate != TLS_OUT_OF_INDEXES && check_arrival(base, b);
  if (g_movement && !g_arrival_hours) log_line("arrival estimate sites differ: the tooltip keeps whole days");

  uint8_t *stubs = alloc_near(base);
  if (!stubs) {
    log_line("no free memory near the image for call stubs: nothing patched");
    return 0;
  }
  uint8_t *step_stub = stubs, *checksum_stub = stubs + 16, *prepare_stub = stubs + 32, *speed_stub = stubs + 48;
  uint8_t *est_a_stub = stubs + 64, *est_b_stub = stubs + 80, *est_speed_stub = stubs + 96, *arrival_text_stub = stubs + 112;
  make_abs_jump(step_stub, (void *)hook_step);
  make_abs_jump(checksum_stub, (void *)hook_checksum);
  make_abs_jump(prepare_stub, (void *)hook_prepare);
  make_abs_jump(speed_stub, (void *)hook_unit_speed);
  make_abs_jump(est_a_stub, (void *)hook_estimate_a);
  make_abs_jump(est_b_stub, (void *)hook_estimate_b);
  make_abs_jump(est_speed_stub, (void *)hook_estimate_speed);
  make_abs_jump(arrival_text_stub, (void *)hook_format_arrival);
  FlushInstructionCache(GetCurrentProcess(), stubs, 128);

  /* 1. checksum first: from here on a patched game never matches an unpatched one */
  for (int i = 0; i < 3; i++)
    if (!retarget_rel32(base, b->checksum_entries[i], checksum_stub)) return 0;

  /* 2. battle tick: one round per call, flag that it ran */
  void **slot = (void **)(base + b->combat_vftable + 8 * b->combat_slot);
  void *hook = (void *)hook_tick;
  if (!write_code(slot, &hook, sizeof hook)) return 0;

  /* 3. date text */
  uint8_t jump[14];
  make_abs_jump(jump, (void *)hook_get_date_string);
  if (!write_code(base + b->get_date_string.rva, jump, sizeof jump)) return 0;

  /* 4. date step wrapper, then the step size */
  for (int i = 0; i < 2; i++)
    if (!retarget_rel32(base, b->date_step_calls[i], step_stub)) return 0;
  uint8_t h8 = (uint8_t)hours;
  int32_t offset = hours - DATE_EPOCH_HOURS;
  if (!write_code(base + b->step_hours.rva + 3, &h8, 1) ||
      !write_code(base + b->step_offset_a.rva + 2, &offset, 4) ||
      !write_code(base + b->step_offset_b.rva + 2, &offset, 4))
    return 0;

  /* 5. hourly movement: every task Prepare through hook_prepare, with the same
     registers and return address (lea rdx,[rbp+X]; mov rcx,rbx; nop; call stub);
     the movement job's speed scaled */
  if (g_movement) {
    uint8_t *site = base + b->prepare_call.rva;
    uint8_t code[16];
    memcpy(code, site + 3, 7);      /* lea rdx,[rbp+X] */
    memcpy(code + 7, site + 10, 3); /* mov rcx,rbx */
    code[10] = 0x90;
    code[11] = 0xE8;
    int64_t rel = prepare_stub - (site + 16);
    if (rel != (int32_t)rel) return 0;
    int32_t rel32 = (int32_t)rel;
    memcpy(code + 12, &rel32, 4);
    if (!write_code(site, code, sizeof code)) return 0;
    if (!retarget_rel32(base, b->unit_speed_call, speed_stub)) return 0;
  }

  /* 6. the tooltip's arrival date in ticks, with the hour */
  if (g_arrival_hours) {
    for (int i = 0; i < 2; i++)
      if (!retarget_rel32(base, b->estimate_calls_a[i], est_a_stub) ||
          !retarget_rel32(base, b->estimate_speed_calls[i], est_speed_stub))
        return 0;
    if (!retarget_rel32(base, b->estimate_call_b, est_b_stub)) return 0;
    for (int i = 0; i < 4; i++)
      if (!retarget_rel32(base, b->arrival_format_calls[i], arrival_text_stub)) return 0;
  }
  return 1;
}

static int ends_with_ci(const wchar_t *s, const wchar_t *suffix) {
  size_t ls = wcslen(s), lx = wcslen(suffix);
  return ls >= lx && _wcsicmp(s + ls - lx, suffix) == 0;
}

static int resolve_real_exports(void) {
  wchar_t path[MAX_PATH];
  UINT len = GetSystemDirectoryW(path, MAX_PATH);
  if (!len || len > MAX_PATH - 20) return 0;
  wcscat(path, L"\\version.dll");
  HMODULE real = LoadLibraryW(path);
  if (!real) return 0;
#define RESOLVE(name) \
  real_##name = (void *)GetProcAddress(real, #name); \
  if (!real_##name) return 0;
  VERSION_EXPORTS(RESOLVE)
#undef RESOLVE
  return 1;
}

static int valid_hours(int h) { return h >= 1 && h <= 24 && 24 % h == 0; }

#ifndef ABT_TEST
BOOL WINAPI DllMain(HINSTANCE inst, DWORD reason, LPVOID reserved) {
  (void)reserved;
  if (reason != DLL_PROCESS_ATTACH) return TRUE;
  DisableThreadLibraryCalls(inst);
  if (!resolve_real_exports()) return FALSE; /* without the real exports every caller would crash */

  /* files next to this DLL: ars_belli_hourly.ini (settings), ars_belli_hourly.log */
  wchar_t dir[MAX_PATH], ini[MAX_PATH], logp[MAX_PATH];
  DWORD n = GetModuleFileNameW(inst, dir, MAX_PATH);
  while (n && dir[n - 1] != L'\\') n--;
  dir[n] = 0;
  _snwprintf(ini, MAX_PATH, L"%lsars_belli_hourly.ini", dir);
  _snwprintf(logp, MAX_PATH, L"%lsars_belli_hourly.log", dir);

  InitializeCriticalSection(&g_log_lock);
  g_log = _wfopen(logp, L"w");

  int enabled = GetPrivateProfileIntW(L"ticks", L"enabled", 1, ini);
  int hours = GetPrivateProfileIntW(L"ticks", L"hours_per_tick", 2, ini);
  int first = GetPrivateProfileIntW(L"ticks", L"first_hour", 7, ini);
  int movement = GetPrivateProfileIntW(L"ticks", L"hourly_movement", 1, ini);
  log_line("Ars Belli hourly ticks loaded; %ls: enabled=%d hours_per_tick=%d first_hour=%d hourly_movement=%d", ini,
           enabled, hours, first, movement);
  if (!enabled || hours == 24) {
    log_line("off: pass-through only");
    return TRUE;
  }
  if (!valid_hours(hours)) {
    log_line("hours_per_tick must divide 24 (1 2 3 4 6 8 12): pass-through only");
    return TRUE;
  }
  g_hours_per_tick = hours;
  g_first_hour = fit_first_hour(first, hours);
  if (g_first_hour != first)
    log_line("first_hour %d moved to %d so the day's %d ticks end by 23:00", first, g_first_hour, 24 / hours);

  wchar_t exe_path[MAX_PATH];
  GetModuleFileNameW(NULL, exe_path, MAX_PATH);
  if (!ends_with_ci(exe_path, L"\\eu5.exe")) {
    log_line("host is not eu5.exe (%ls): pass-through only", exe_path);
    return TRUE;
  }
  uint8_t *base = (uint8_t *)GetModuleHandleW(NULL);
  const build_t *b = check_build(base);
  if (!b) return TRUE;
  if (apply_patches(base, b, hours, movement != 0))
    log_line("build %s patched: a tick is %d hours, %d battle rounds a day, movement %s, arrival dates %s, "
             "clock %02d:00 to %02d:00, checksum salted",
             b->name, hours, 24 / hours, g_movement ? "every tick" : "daily", g_arrival_hours ? "to the hour" : "in days",
             g_first_hour, g_first_hour + 24 / hours - 1);
  else
    log_line("PATCHING FAILED part-way (see above); restart the game without the DLL");
  return TRUE;
}
#endif /* ABT_TEST */
