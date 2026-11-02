# Builds out\version.dll (the proxy) plus two tests, then runs the tests.
# Zig 0.17.0 portable lives in E:\Tools\zig; its caches are kept on E:.
$ErrorActionPreference = 'Stop'
$zig = 'E:\Tools\zig\zig-x86_64-windows-0.17.0\zig.exe'
$env:ZIG_GLOBAL_CACHE_DIR = 'E:\Tools\zig-cache'
$env:ZIG_LOCAL_CACHE_DIR = 'E:\Tools\zig-cache\local'
$root = $PSScriptRoot
$out = "$root\out"
New-Item -ItemType Directory -Force $out | Out-Null

function Build($argsList, $what) {
  & $zig cc -target x86_64-windows-gnu -O2 -Wall -Wextra @argsList
  if ($LASTEXITCODE -ne 0) { throw "$what build failed" }
}
Build @('-shared', '-o', "$out\version.dll", "$root\src\main.c", "$root\src\proxy_exports.c") 'version.dll'
Build @('-o', "$out\test_host.exe", "$root\test\test_host.c", '-lversion') 'test_host.exe'
Build @('-municode', '-Wno-unused-function', '-o', "$out\test_verify.exe", "$root\test\test_verify.c", "$root\src\proxy_exports.c") 'test_verify.exe'
Copy-Item "$root\ars_belli_hourly.ini" $out -Force
Remove-Item "$out\*.pdb", "$out\*.lib" -ErrorAction SilentlyContinue

Write-Host "`n== pass-through (stand-in host loads our version.dll)"
Push-Location $out; & .\test_host.exe; $hostExit = $LASTEXITCODE; Pop-Location
Write-Host "`n== checks and patches on the 1.4.6 image"
& "$out\test_verify.exe" 'E:\Tools\eu5_exes\eu5_1.4.6.exe' 4; $verifyExit = $LASTEXITCODE
Write-Host "`n== 1.3.11 image must be refused"
& "$out\test_verify.exe" 'E:\Tools\eu5_exes\eu5_1.3.11.exe' 4; $refuseExit = $LASTEXITCODE
Write-Host "`nexit codes: host $hostExit (0), verify $verifyExit (0), 1.3.11 $refuseExit (2)"
if ($hostExit -ne 0 -or $verifyExit -ne 0 -or $refuseExit -ne 2) { throw 'tests failed' }
Remove-Item "$out\ars_belli_hourly.log" -ErrorAction SilentlyContinue
