/* Ars Belli hourly ticks: a version.dll proxy that gives EU5 1.4 sub-day ticks
   again, the way 1.3 had them (HOUR_TICK).

   EU5 1.4 advances the date by a compiled 24 hours per tick and runs every
   daily task each tick. The date is still stored in hours, and each tick the
   date step sets four flags (new day / week / month / year) that pick the task
   list to run. So with a smaller step:
     - the date step adds hours_per_tick instead of 24 (three constants);
     - ticks that don't start a new day set no flag, match no task list and run
       nothing (the engine logs that once): daily, monthly and yearly work keeps
       running once per day/month/year;
     - on those ticks this DLL runs one battle round itself (CCombatManager vtable
       slot 8, the battle tick for every battle), so battles get 24/hours_per_tick
       rounds a day;
     - the game-speed table (seconds per tick) is scaled by hours_per_tick/24 so
       a day still takes as long as before;
     - the top-bar date (GetDateString) shows the hour;
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
  uint32_t game_data_global, game_data_inner, combat_manager_offset;
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
} build_t;

static const build_t KNOWN_BUILDS[] = {
  {
    .name = "1.4.6 (ud009/release/hotfix)",
    .time_date_stamp = 0x6ae34c4c, .size_of_image = 0x10559000,
    .combat_vftable = 0x0c7ef738, .combat_slot = 8, .combat_tick = 0x024a7620,
    .combat_tick_start = { 0x024a7620, 16, { 0x55, 0x41, 0x57, 0x41, 0x56, 0x41, 0x55, 0x41, 0x54, 0x56, 0x57, 0x53, 0x48, 0x81, 0xec, 0x68 } },
    .game_data_global = 0x0fac1028, .game_data_inner = 0x108, .combat_manager_offset = 0x26e40,
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
  },
};

/* ---- state ---- */
typedef uint64_t (*tick_fn)(void *, void *, void *, void *);
typedef void (*step_fn)(void *);
typedef void *(*date_format_fn)(const void *date, void *out, uint64_t flag);
typedef void *(*string_from_cstr_fn)(void *out, const char *s);
typedef void (*engine_free_fn)(void *p);
typedef uint64_t (*checksum_fn)(void *obj, uint64_t flag);

static int g_hours_per_tick = 4;
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

static void describe_date(uint64_t date, char *out, size_t n) {
  int hours = (int32_t)date;
  int hour = hours % 24;
  if (hour < 0) hour += 24;
  snprintf(out, n, "%d.%d.%d %02d:00", (int)(int16_t)(date >> 48), (int)((date >> 40) & 0x7f) + 1,
           (int)((date >> 32) & 0xff) + 1, hour);
}

/* ---- battles ---- */
static void *combat_manager(void) {
  uint8_t *data = *(uint8_t **)(g_base + g_build->game_data_global);
  if (!data) return NULL;
  uint8_t *inner = *(uint8_t **)(data + g_build->game_data_inner);
  if (!inner) return NULL;
  void *mgr = inner + g_build->combat_manager_offset;
  return *(void **)mgr == (void *)(g_base + g_build->combat_vftable) ? mgr : NULL;
}

static int active_battles(void *mgr) { return mgr ? *(int *)((uint8_t *)mgr + 0x8c) : -1; }

/* vtable slot 8: the daily task's battle tick. Runs once, as in vanilla. */
static uint64_t hook_tick(void *mgr, void *a2, void *a3, void *a4) {
  static int checked;
  if (!checked) {
    checked = 1;
    log_line("daily battle tick: manager %p, pointer chain gives %p%s", mgr, combat_manager(),
             mgr == combat_manager() ? " (match)" : "  MISMATCH: extra rounds will be skipped");
  }
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

/* ---- date step: one tick ---- */
static uint64_t g_ticks, g_extra_rounds;

static void hook_step(void *gs) {
  scale_speed_table();
  void *mgr = combat_manager();
  int battles_before = active_battles(mgr);

  InterlockedExchange(&g_combat_ran, 0);
  g_step(gs);
  g_ticks++;

  const char *round = "daily task";
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

  int battles_after = active_battles(combat_manager());
  if (g_ticks <= 30 || battles_before > 0 || battles_after > 0) {
    char when[48];
    describe_date(*(uint64_t *)((uint8_t *)gs + 8), when, sizeof when);
    log_line("tick %llu %s  battles %d -> %d, round: %s", (unsigned long long)g_ticks, when,
             battles_before, battles_after, round);
  }
}

/* ---- top-bar date with the hour (replaces the GetDateString getter) ---- */
static void *hook_get_date_string(void *out) {
  uint8_t *gs = game_state();
  if (!gs) return g_string_from_cstr(out, "");
  uint64_t date = *(uint64_t *)(gs + 8);
  uint8_t text[16];
  memset(text, 0, sizeof text);
  g_date_format(&date, text, 0);
  const char *chars;
  uint32_t len;
  string_view(text, &chars, &len);
  int hour = (int32_t)date % 24;
  if (hour < 0) hour += 24;
  char buf[256];
  snprintf(buf, sizeof buf, "%.*s, %02d:00", (int)(len < 200 ? len : 200), chars, hour);
  if ((text[15] & 0x80) && !(text[15] & 0x40) && *(void **)text) g_free(*(void **)text);
  return g_string_from_cstr(out, buf);
}

/* ---- checksum: feed a salted version string instead of the plain one ---- */
static uint64_t hook_checksum(void *obj, uint64_t flag) {
  uint8_t *version = (uint8_t *)obj + g_build->checksum_version_offset;
  uint8_t saved[16];
  memcpy(saved, version, sizeof saved);
  const char *chars;
  uint32_t len;
  string_view(version, &chars, &len);
  int n = snprintf(g_salted_version, sizeof g_salted_version, "%.*s+abm-hourly-%dh",
                   (int)(len < 64 ? len : 64), chars, g_hours_per_tick);
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

/* Applies every patch to the image at base (build already checked). */
static int apply_patches(uint8_t *base, const build_t *b, int hours) {
  g_base = base;
  g_build = b;
  g_tick = (tick_fn)(void *)(base + b->combat_tick);
  g_step = (step_fn)(void *)(base + b->date_step);
  g_date_format = (date_format_fn)(void *)(base + b->date_format);
  g_string_from_cstr = (string_from_cstr_fn)(void *)(base + b->string_from_cstr);
  g_free = (engine_free_fn)(void *)(base + b->engine_free);
  g_checksum = (checksum_fn)(void *)(base + b->checksum);

  uint8_t *stubs = alloc_near(base);
  if (!stubs) {
    log_line("no free memory near the image for call stubs: nothing patched");
    return 0;
  }
  uint8_t *step_stub = stubs, *checksum_stub = stubs + 16;
  make_abs_jump(step_stub, (void *)hook_step);
  make_abs_jump(checksum_stub, (void *)hook_checksum);
  FlushInstructionCache(GetCurrentProcess(), stubs, 32);

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
  int hours = GetPrivateProfileIntW(L"ticks", L"hours_per_tick", 4, ini);
  log_line("Ars Belli hourly ticks loaded; %ls: enabled=%d hours_per_tick=%d", ini, enabled, hours);
  if (!enabled || hours == 24) {
    log_line("off: pass-through only");
    return TRUE;
  }
  if (!valid_hours(hours)) {
    log_line("hours_per_tick must divide 24 (1 2 3 4 6 8 12): pass-through only");
    return TRUE;
  }
  g_hours_per_tick = hours;

  wchar_t exe_path[MAX_PATH];
  GetModuleFileNameW(NULL, exe_path, MAX_PATH);
  if (!ends_with_ci(exe_path, L"\\eu5.exe")) {
    log_line("host is not eu5.exe (%ls): pass-through only", exe_path);
    return TRUE;
  }
  uint8_t *base = (uint8_t *)GetModuleHandleW(NULL);
  const build_t *b = check_build(base);
  if (!b) return TRUE;
  if (apply_patches(base, b, hours))
    log_line("build %s patched: a tick is %d hours, %d battle rounds a day, date shows the hour, checksum salted",
             b->name, hours, 24 / hours);
  else
    log_line("PATCHING FAILED part-way (see above); restart the game without the DLL");
  return TRUE;
}
#endif /* ABT_TEST */
