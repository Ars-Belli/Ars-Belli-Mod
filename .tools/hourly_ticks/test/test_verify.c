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
  int hours = argc > 2 ? _wtoi(argv[2]) : 4;
  g_log = stdout;
  InitializeCriticalSection(&g_log_lock);
  g_hours_per_tick = hours;

  HMODULE m = LoadLibraryExW(argv[1], NULL, DONT_RESOLVE_DLL_REFERENCES);
  if (!m) { printf("map failed %lu\n", GetLastError()); return 1; }
  uint8_t *base = (uint8_t *)m;
  const build_t *b = check_build(base);
  if (!b) { puts("build refused"); return 2; }
  printf("build %s accepted, applying patches for %d hours a tick\n", b->name, hours);
  if (!apply_patches(base, b, hours)) { puts("apply failed"); return 3; }

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

  /* the patched image must now be refused by a second check (bytes changed) */
  printf("re-check of the patched image (must be refused):\n");
  EXPECT(check_build(base) == NULL, "patched image refused");

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
  snprintf(want, sizeof want, "1.4.6+abm-hourly-%dh", hours);
  EXPECT(r == 7 && strcmp(seen, want) == 0, "checksum sees \"%s\"", seen);
  EXPECT(memcmp(ver, "1.4.6", 5) == 0 && ver[15] == 5, "version string restored after the checksum");

  puts(fails ? "FAILED" : "OK");
  return fails ? 4 : 0;
}
