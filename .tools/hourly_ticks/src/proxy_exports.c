/* Pass-through exports. Deliberately no <windows.h> here: the thunks carry the
   real API names, which windows.h declares as dllimport.

   Each export is a naked jump through a pointer that main.c fills from the real
   C:\Windows\System32\version.dll, so arguments and return values pass untouched
   and no signatures are needed. */
#include "exports.h"

#define THUNK(name)                                                        \
  void *real_##name;                                                       \
  __declspec(dllexport) __attribute__((naked)) void name(void) {           \
    __asm__ volatile("jmp *real_" #name "(%rip)");                         \
  }

VERSION_EXPORTS(THUNK)
