/* Every export of the system version.dll (Windows 11). The proxy must pass all of
   them through: once our version.dll is loaded, every module in the process that
   imports version.dll gets ours, not just eu5.exe. */
#define VERSION_EXPORTS(X) \
  X(GetFileVersionInfoA) \
  X(GetFileVersionInfoByHandle) \
  X(GetFileVersionInfoExA) \
  X(GetFileVersionInfoExW) \
  X(GetFileVersionInfoSizeA) \
  X(GetFileVersionInfoSizeExA) \
  X(GetFileVersionInfoSizeExW) \
  X(GetFileVersionInfoSizeW) \
  X(GetFileVersionInfoW) \
  X(VerFindFileA) \
  X(VerFindFileW) \
  X(VerInstallFileA) \
  X(VerInstallFileW) \
  X(VerLanguageNameA) \
  X(VerLanguageNameW) \
  X(VerQueryValueA) \
  X(VerQueryValueW)
