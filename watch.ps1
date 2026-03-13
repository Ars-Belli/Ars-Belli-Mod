# Watch script for EU5 Multiplayermod
# Monitors for file changes and executes deploy.ps1 automatically

$sourceDir = $PSScriptRoot
$global:deployScript = Join-Path $sourceDir "deploy.ps1"
$global:excludePatterns = @("\.git\", "\.idea\", "watch\.ps1", "replaced_files\.txt")

# Initialize FileSystemWatcher
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $sourceDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true

# Function to run the deploy script
function Invoke-Deployment {
    param($path)
    Write-Host "`nChange detected in: $path" -ForegroundColor Yellow
    Write-Host "Triggering deployment..." -ForegroundColor Cyan
    & $global:deployScript
}

# Event Action
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $name = $Event.SourceEventArgs.Name
    
    # Check if the changed file should be ignored
    $isExcluded = $false
    foreach ($pattern in $global:excludePatterns) {
        if ($path -match [regex]::Escape($pattern) -or $path -like "*$pattern*") {
            $isExcluded = $true
            break
        }
    }

    if (-not $isExcluded) {
        # Throttle deployment to avoid multiple rapid triggers
        $now = Get-Date
        if ($global:lastDeployment -eq $null -or ($now - $global:lastDeployment).TotalSeconds -gt 2) {
            $global:lastDeployment = $now
            
            # Since the function 'Invoke-Deployment' is in the parent scope,
            # we need to ensure it's accessible or re-define it.
            # Using '&' on a path is safest for a script.
            Write-Host "`nChange detected in: $path" -ForegroundColor Yellow
            Write-Host "Triggering deployment..." -ForegroundColor Cyan
            & $global:deployScript
        }
    }
}

# Register events for file changes
$handlers = @()
$handlers += Register-ObjectEvent $watcher "Changed" -Action $action
$handlers += Register-ObjectEvent $watcher "Created" -Action $action
$handlers += Register-ObjectEvent $watcher "Deleted" -Action $action
$handlers += Register-ObjectEvent $watcher "Renamed" -Action $action

Write-Host "Watching for changes in: $sourceDir" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the watcher." -ForegroundColor Gray

# Maintain the script execution
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Cleanup handlers on exit
    foreach ($handler in $handlers) {
        Unregister-Event -SourceIdentifier $handler.Name
    }
    $watcher.Dispose()
    Write-Host "`nEU5 mod Watcher stopped." -ForegroundColor Red
}
