/* Maps an eu5.exe as an image (relocated; imports and entry point NOT run), runs
   the DLL's own build checks, applies every patch to that mapped copy and reads
   the results back. Usage: test_verify <eu5.exe> [hours_per_tick] */
#define ABT_TEST
#include "../src/main.c"

static int fails;
#define EXPECT(cond, ...) do { if (cond) printf("  ok    " __VA_ARGS__); else { printf("  FAIL  " __VA_ARGS__); fails++; } putchar('\n'); } while (0)

static uint8_t *rel32_dest(uint8_t *site) { return site + 5 + *(int32_t *)(site + 1); }
static void *abs_jump_dest(uint8_t *at) {
  void *p;
  memcpy(&p, at + 6, 8);
  return (at[0] == 0xFF && at[1] == 0x25 && *(int32_t *)(at + 2) == 0) ? p : NULL;
}

/* stand-ins for task Prepare functions and the unit speed function */
static int prepare_calls[2];
static void fake_prepare_a(void *t, void *c) { (void)t; (void)c; prepare_calls[0]++; }
static void fake_prepare_b(void *t, void *c) { (void)t; (void)c; prepare_calls[1]++; }
static int64_t *fake_speed(void *unit, int64_t *out, uint64_t flag) { (void)unit; (void)flag; *out = 120000; return out; }

/* stand-in for the engine checksum: records the version string it is fed */
static char seen[128];
static uint64_t fake_checksum(void *obj, uint64_t flag) {
  (void)flag;
  const char *c;
  uint32_t l;
  string_view((uint8_t *)obj + g_build->checksum_version_offset, &c, &l);
  snprintf(seen, sizeof seen, "%.*s", (int)l, c);
  return 7;
}

int wmain(int argc, wchar_t **argv) {
  if (argc < 2) { fputs("usage: test_verify <eu5.exe> [hours_per_tick]\n", stderr); return 9; }
  int hours = argc > 2 ? _wtoi(argv[2]) : 2;
  g_log = stdout;
  InitializeCriticalSection(&g_log_lock);
  g_hours_per_tick = hours;

  HMODULE m = LoadLibraryExW(argv[1], NULL, DONT_RESOLVE_DLL_REFERENCES);
  if (!m) { printf("map failed %lu\n", GetLastError()); return 1; }
  uint8_t *base = (uint8_t *)m;
  const build_t *b = check_build(base);
  if (!b) { puts("build refused"); return 2; }
  printf("build %s accepted, applying patches for %d hours a tick\n", b->name, hours);
  if (!apply_patches(base, b, hours, 1)) { puts("apply failed"); return 3; }

  void **slot = (void **)(base + b->combat_vftable + 8 * b->combat_slot);
  EXPECT(*slot == (void *)hook_tick, "vtable slot 8 -> hook_tick");
  for (int i = 0; i < 2; i++) {
    uint8_t *dest = rel32_dest(base + b->date_step_calls[i]);
    EXPECT(abs_jump_dest(dest) == (void *)hook_step, "date step call %d -> stub %p -> hook_step", i, (void *)dest);
  }
  for (int i = 0; i < 3; i++) {
    uint8_t *site = base + b->checksum_entries[i];
    uint8_t *dest = rel32_dest(site);
    EXPECT(abs_jump_dest(dest) == (void *)hook_checksum, "checksum entry %d (%s) -> hook_checksum", i, site[0] == 0xE8 ? "call" : "jmp");
  }
  EXPECT(abs_jump_dest(base + b->get_date_string.rva) == (void *)hook_get_date_string, "GetDateString -> hook_get_date_string");
  EXPECT(base[b->step_hours.rva + 3] == hours, "date step adds %d hours", hours);
  EXPECT(*(int32_t *)(base + b->step_offset_a.rva + 2) == hours - DATE_EPOCH_HOURS, "offset a = %d", hours - DATE_EPOCH_HOURS);
  EXPECT(*(int32_t *)(base + b->step_offset_b.rva + 2) == hours - DATE_EPOCH_HOURS, "offset b = %d", hours - DATE_EPOCH_HOURS);
  EXPECT(g_tick == (tick_fn)(void *)(base + b->combat_tick), "original battle tick kept for calls");
  EXPECT(g_chain_offset == 0x108, "combat manager field known from the start (0x%x)", g_chain_offset);

  /* hourly movement sites */
  EXPECT(g_movement == 1 && g_allowed_n == 9, "hourly movement on, %d tasks allowed on in-between ticks", g_allowed_n);
  {
    uint8_t *site = base + b->prepare_call.rva;
    const uint8_t *orig = b->prepare_call.bytes;
    int same_regs = memcmp(site, orig + 3, 7) == 0 && memcmp(site + 7, orig + 10, 3) == 0 && site[10] == 0x90;
    EXPECT(same_regs && site[11] == 0xE8 && abs_jump_dest(rel32_dest(site + 11)) == (void *)hook_prepare && site[16] == 0x90,
           "task Prepare call -> hook_prepare, return address unchanged");
    EXPECT(abs_jump_dest(rel32_dest(base + b->unit_speed_call)) == (void *)hook_unit_speed, "movement job speed -> hook_unit_speed");
    EXPECT(g_graph_run == (graph_run_fn)(void *)(base + b->graph_run), "task-graph runner kept for calls");
  }

  /* the patched image must now be refused by a second check (bytes changed) */
  printf("re-check of the patched image (must be refused):\n");
  EXPECT(check_build(base) == NULL, "patched image refused");

  /* clock: tick n of a day shows first_hour + n, the next day starts at first_hour again */
  int ticks = 24 / hours;
  g_first_hour = fit_first_hour(7, hours);
  EXPECT(shown_hour(DATE_EPOCH_HOURS) == g_first_hour, "first tick of a day shows %02d:00", shown_hour(DATE_EPOCH_HOURS));
  EXPECT(shown_hour(DATE_EPOCH_HOURS + 24 - hours) == g_first_hour + ticks - 1, "last tick of a day shows %02d:00",
         shown_hour(DATE_EPOCH_HOURS + 24 - hours));
  EXPECT(shown_hour(DATE_EPOCH_HOURS + 24) == g_first_hour, "next day starts at %02d:00 again", shown_hour(DATE_EPOCH_HOURS + 24));
  EXPECT(fit_first_hour(7, 2) == 7 && fit_first_hour(20, 2) == 12 && fit_first_hour(7, 1) == 0 && fit_first_hour(-3, 4) == 0,
         "first_hour kept so the last tick ends by 23:00 (7 2h -> 7, 20 2h -> 12, 7 1h -> 0)");

  /* gate: on an in-between tick only allowed tasks reach their Prepare */
  {
    void *vt_a[10] = { 0 }, *vt_b[10] = { 0 };
    vt_a[9] = (void *)fake_prepare_a;
    vt_b[9] = (void *)fake_prepare_b;
    void **task_a = vt_a, **task_b = vt_b;
    int saved_n = g_allowed_n;
    g_allowed_vt[g_allowed_n] = vt_a;
    g_allowed_name[g_allowed_n++] = "test";
    hook_prepare(&task_a, NULL);
    hook_prepare(&task_b, NULL);
    EXPECT(prepare_calls[0] == 1 && prepare_calls[1] == 1, "day tick: every task prepared");
    g_ran_mask = 0;
    g_skipped = 0;
    g_inbetween = 1;
    hook_prepare(&task_a, NULL);
    hook_prepare(&task_b, NULL);
    g_inbetween = 0;
    EXPECT(prepare_calls[0] == 2 && prepare_calls[1] == 1 && g_skipped == 1 && (g_ran_mask & (1L << saved_n)),
           "in-between tick: allowed task prepared, other task skipped");
    g_allowed_n = saved_n;
  }

  /* speed: a day's move split over the day's ticks */
  {
    unit_speed_fn real_speed = g_unit_speed;
    g_unit_speed = fake_speed;
    int64_t out = 0;
    hook_unit_speed(NULL, &out, 1);
    g_unit_speed = real_speed;
    EXPECT(out == 120000LL * hours / 24, "speed 1.2 a day -> %lld per tick (fixed point)", (long long)out);
  }

  /* graph lookup on a stand-in game state: the smallest graph holding the movement task */
  {
    static uint8_t gs[0x200], table[8 * 0x28];
    static void *other_vt[10], *move_obj, *other_obj;
    static void *tick_tasks[3], *day_tasks[7], *month_tasks[9];
    move_obj = g_move_vt;      /* a task instance = its vftable pointer first */
    other_obj = other_vt;
    for (int i = 0; i < 3; i++) tick_tasks[i] = &other_obj;
    for (int i = 0; i < 7; i++) day_tasks[i] = i == 4 ? (void *)&move_obj : (void *)&other_obj;
    for (int i = 0; i < 9; i++) month_tasks[i] = i == 2 ? (void *)&move_obj : (void *)&other_obj;
    memset(gs, 0, sizeof gs);
    memset(table, 0, sizeof table);
    *(uint8_t **)(gs + 0xe0) = table;
    *(int *)(gs + 0xec) = 3; /* mask: 4 slots */
    gs[0xf0] = 2;            /* plus 2 probe slots */
    uint8_t *tick = table + 0 * 0x28, *month = table + 1 * 0x28, *day = table + 4 * 0x28, *broken = table + 2 * 0x28;
    tick[4] = 1; /* key 0: every-tick list, no movement */
    *(void **)(tick + 0x10) = tick_tasks; *(int *)(tick + 0x1c) = 3;
    month[4] = 1; month[8] = 1; month[10] = 1;
    *(void **)(month + 0x10) = month_tasks; *(int *)(month + 0x1c) = 9;
    day[4] = 2; day[8] = 1;
    *(void **)(day + 0x10) = day_tasks; *(int *)(day + 0x1c) = 7;
    broken[4] = 1; /* occupied, no tasks: skipped */
    EXPECT(find_graph(gs, 1) == day + 0x10, "task graph = plain day (7 tasks, holds movement), not the every-tick list");
    *(int *)(gs + 0xec) = -1;
    EXPECT(find_graph(gs, 0) == NULL, "bad map refused");
  }

  /* checksum salt: run hook_checksum's string swap with a stand-in object and checksum function */
  static uint8_t fake_obj[0x400];
  uint8_t *ver = fake_obj + b->checksum_version_offset;
  memcpy(ver, "1.4.6", 5);
  ver[15] = 5;
  checksum_fn real_checksum = g_checksum;
  g_checksum = fake_checksum;
  uint64_t r = hook_checksum(fake_obj, 0);
  g_checksum = real_checksum;
  char want[64];
  snprintf(want, sizeof want, "1.4.6+abm-hourly-%dh-move", hours);
  EXPECT(r == 7 && strcmp(seen, want) == 0, "checksum sees \"%s\"", seen);
  EXPECT(memcmp(ver, "1.4.6", 5) == 0 && ver[15] == 5, "version string restored after the checksum");

  puts(fails ? "FAILED" : "OK");
  return fails ? 4 : 0;
}
