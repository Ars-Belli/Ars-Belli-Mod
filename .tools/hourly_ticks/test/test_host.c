/* Stand-in host: imports version.dll statically like eu5.exe does. Run from a
   folder that holds our version.dll; it must load ours (log file appears, host
   is "not eu5.exe" so pass-through only) and every call must reach the real one. */
#include <windows.h>
#include <stdio.h>

int main(void) {
  wchar_t sys[MAX_PATH];
  GetSystemDirectoryW(sys, MAX_PATH);
  wcscat(sys, L"\\kernel32.dll");
  char sysA[MAX_PATH];
  WideCharToMultiByte(CP_ACP, 0, sys, -1, sysA, MAX_PATH, NULL, NULL);

  HMODULE ours = GetModuleHandleW(L"version.dll");
  wchar_t loaded[MAX_PATH] = L"?";
  if (ours) GetModuleFileNameW(ours, loaded, MAX_PATH);
  printf("version.dll loaded from: %ls\n", loaded);

  DWORD h = 0;
  DWORD sizeA = GetFileVersionInfoSizeA(sysA, &h);
  DWORD sizeW = GetFileVersionInfoSizeW(sys, &h);
  printf("GetFileVersionInfoSizeA=%lu W=%lu\n", sizeA, sizeW);
  if (!sizeA || sizeA != sizeW) return 1;

  void *buf = malloc(sizeW);
  if (!GetFileVersionInfoW(sys, 0, sizeW, buf)) return 2;
  VS_FIXEDFILEINFO *ffi;
  UINT len;
  if (!VerQueryValueW(buf, L"\\", (void **)&ffi, &len)) return 3;
  printf("kernel32 version %u.%u.%u.%u\n", HIWORD(ffi->dwFileVersionMS), LOWORD(ffi->dwFileVersionMS),
         HIWORD(ffi->dwFileVersionLS), LOWORD(ffi->dwFileVersionLS));
  char lang[64];
  VerLanguageNameA(0x409, lang, sizeof lang);
  printf("VerLanguageNameA(0x409)=%s\n", lang);
  puts("OK");
  return 0;
}
