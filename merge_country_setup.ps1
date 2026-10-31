# Merges main_menu/setup/<folder>/10_countries_*.txt into that folder's 10_countries.txt
# inside a deployed or staged copy of the mod, then deletes the regional files.
# Called by deploy.ps1 and release.ps1; the repo itself keeps the split files.
#
# Why: the repo keeps country history split per region (see
# .tools/scripts/split_10_countries.py) so it can be edited without merge conflicts in a
# 100k-line file, but the game spends ~2 seconds per setup file while generating a new
# game, whatever its size - 62 files cost ~2 minutes. Vanilla ships one file, so the
# shipped mod does too.
#
# Bodies are concatenated in ordinal filename order: that is the order the game applied
# the separate files in, and the first country to claim a location keeps it.

param(
    [Parameter(Mandatory = $true)]
    [string]$ModRoot,
    # Parse and validate only, write and delete nothing. Safe to point at the repo.
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

$resolvedRoot = (Resolve-Path -LiteralPath $ModRoot).ProviderPath.TrimEnd('\', '/')
if (-not $CheckOnly -and $resolvedRoot -eq $PSScriptRoot.TrimEnd('\', '/')) {
    throw "Refusing to merge in the repo itself ($resolvedRoot): it deletes the regional files. Point -ModRoot at a deployed or staged copy, or pass -CheckOnly."
}

# Setup files must not have a BOM (the setup parser rejects it), and vanilla has none.
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$countriesOpen = '^\s*countries\s*=\s*\{\s*(#.*)?$'
# Strings first, so a '#' inside quotes is not taken for a comment.
$stringOrComment = '"[^"]*"|#.*$'

# Splits a setup file into header (up to and including the inner "countries = {"),
# body (the country blocks) and trailer (the two closing braces).
function Read-CountriesFile([string]$path) {
    $lines = [System.IO.File]::ReadAllText($path, $utf8NoBom) -split '\r?\n'
    $name = Split-Path -Leaf $path

    $opens = @()
    for ($i = 0; $i -lt $lines.Count -and $opens.Count -lt 2; $i++) {
        if ($lines[$i] -match $countriesOpen) { $opens += $i }
    }
    if ($opens.Count -lt 2) { throw "${name}: no nested 'countries = { countries = {' header found." }
    $headerEnd = $opens[1]

    $closes = @()
    for ($i = $lines.Count - 1; $i -gt $headerEnd -and $closes.Count -lt 2; $i--) {
        $trimmed = $lines[$i].Trim()
        if ($trimmed -eq '') { continue }
        if ($trimmed -ne '}') { throw "${name}: expected the file to end with two lone '}' lines, found '$trimmed' on line $($i + 1)." }
        $closes += $i
    }
    if ($closes.Count -lt 2) { throw "${name}: missing the two closing '}' lines." }
    $bodyEnd = $closes[1]

    # Header lines with comments and blanks dropped, to compare files by meaning.
    $headerKey = (@($lines[0..$headerEnd] | ForEach-Object { ($_ -replace $stringOrComment, '').Trim() } | Where-Object { $_ -ne '' })) -join "`n"

    $body = @()
    if ($bodyEnd -gt $headerEnd + 1) { $body = $lines[($headerEnd + 1)..($bodyEnd - 1)] }

    [pscustomobject]@{
        Name      = $name
        Header    = $lines[0..$headerEnd]
        HeaderKey = $headerKey
        Body      = $body
        Trailer   = $lines[$bodyEnd..$closes[0]]
    }
}

# Checks the body's braces balance and returns the tags it defines at its top level.
function Get-BodyTags($file) {
    $tags = @()
    $depth = 0
    $lineNo = 0
    foreach ($line in $file.Body) {
        $lineNo++
        $clean = $line -replace $stringOrComment, ''
        if ($depth -eq 0 -and $clean -match '^\s*([A-Za-z0-9_]+)\s*=\s*\{') { $tags += $Matches[1] }
        foreach ($brace in [regex]::Matches($clean, '[{}]')) {
            if ($brace.Value -eq '{') { $depth++ } else { $depth-- }
            if ($depth -lt 0) { throw "$($file.Name): unbalanced '}' in the country list (body line $lineNo)." }
        }
    }
    if ($depth -ne 0) { throw "$($file.Name): $depth unclosed '{' at the end of the country list." }
    $tags
}

$setupDir = Join-Path (Join-Path $resolvedRoot 'main_menu') 'setup'
if (-not (Test-Path -LiteralPath $setupDir)) { return }

foreach ($dir in Get-ChildItem -LiteralPath $setupDir -Directory) {
    [string[]]$regionalNames = @(Get-ChildItem -LiteralPath $dir.FullName -File -Filter '10_countries_*.txt' | ForEach-Object { $_.Name })
    if ($regionalNames.Count -eq 0) { continue }
    [Array]::Sort($regionalNames, [StringComparer]::Ordinal)

    $stubPath = Join-Path $dir.FullName '10_countries.txt'
    if (-not (Test-Path -LiteralPath $stubPath)) { throw "$($dir.Name): regional 10_countries_*.txt files found but no 10_countries.txt to merge them into." }
    $stub = Read-CountriesFile $stubPath

    # 10_countries.txt sorts before 10_countries_*.txt ('.' < '_'), so its own blocks go first.
    $files = @($stub) + @($regionalNames | ForEach-Object { Read-CountriesFile (Join-Path $dir.FullName $_) })

    $tagOwner = New-Object 'System.Collections.Generic.Dictionary[string,string]' ([StringComparer]::Ordinal)
    $problems = @()
    foreach ($file in $files) {
        if ($file.HeaderKey -ne $stub.HeaderKey) { $problems += "$($file.Name): header differs from 10_countries.txt; it would be dropped by the merge." }
        foreach ($tag in Get-BodyTags $file) {
            if ($tagOwner.ContainsKey($tag)) { $problems += "$tag is defined in both $($tagOwner[$tag]) and $($file.Name)." }
            else { $tagOwner[$tag] = $file.Name }
        }
    }
    if ($problems.Count -gt 0) { throw "Cannot merge $($dir.Name)/10_countries_*.txt:`n  " + ($problems -join "`n  ") }

    $relative = "main_menu/setup/$($dir.Name)/10_countries.txt"
    if ($CheckOnly) {
        Write-Host "Check OK: $($regionalNames.Count) regional files ($($tagOwner.Count) countries) can merge into $relative"
        continue
    }

    $out = New-Object System.Collections.Generic.List[string]
    $out.AddRange([string[]]$stub.Header)
    $out.AddRange([string[]]$stub.Body)
    foreach ($file in $files | Select-Object -Skip 1) {
        $out.Add("`t# was $($file.Name)")
        $out.AddRange([string[]]$file.Body)
    }
    $out.AddRange([string[]]$stub.Trailer)
    [System.IO.File]::WriteAllText($stubPath, (($out -join "`r`n") + "`r`n"), $utf8NoBom)

    foreach ($name in $regionalNames) { Remove-Item -LiteralPath (Join-Path $dir.FullName $name) -Force }
    Write-Host "Merged $($regionalNames.Count) regional files ($($tagOwner.Count) countries) into $relative"
}
