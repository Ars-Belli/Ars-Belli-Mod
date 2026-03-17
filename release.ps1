# This script packages the mod files into a ZIP for release.
# The files included are the same as those in the deploy script.

# Define source paths
$sourceDir = $PSScriptRoot
$zipName = "ArsBelliMod.zip"
$zipPath = Join-Path $sourceDir $zipName

# Directories and files to include (matching deploy.ps1)
$includeList = @("in_game", "main_menu", ".metadata")

# Define a temporary staging directory
$stagingDir = Join-Path $sourceDir "release_staging"

# Clean up any previous staging directory or existing ZIP
if (Test-Path -Path $stagingDir) {
    Remove-Item -Path $stagingDir -Recurse -Force
}
if (Test-Path -Path $zipPath) {
    Write-Host "Removing existing $zipName..."
    Remove-Item -Path $zipPath -Force
}

# Create staging directory
New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

foreach ($item in $includeList) {
    $srcPath = Join-Path $sourceDir $item
    if (Test-Path -Path $srcPath) {
        Write-Host "Staging $item..."
        if (Test-Path -Path $srcPath -PathType Container) {
            # Copy directory recursively
            $destPath = Join-Path $stagingDir $item
            Copy-Item -Path $srcPath -Destination $stagingDir -Recurse -Force
        } else {
            # Copy single file
            Copy-Item -Path $srcPath -Destination $stagingDir -Force
        }
    } else {
        Write-Warning "Source path not found: $srcPath"
    }
}

# Note: deploy.ps1 has a specific step to copy metadata content to $destDir.
# However, usually for a Paradox mod, the .metadata folder itself or its contents 
# should be at the root of the ZIP if it's meant to be in the mod root.
# Looking at deploy.ps1, it copies the .metadata folder AND then its contents again.
# 19: $includeList = @("in_game", "main_menu", ".metadata")
# 41: Copy-Item -Path (Join-Path $metadataDir "*") -Destination $destDir -Force
# This effectively puts the files from .metadata into the root of the mod folder.

$metadataDir = Join-Path $sourceDir ".metadata"
if (Test-Path -Path $metadataDir) {
    Write-Host "Moving metadata content to staging root..."
    Copy-Item -Path (Join-Path $metadataDir "*") -Destination $stagingDir -Force
}

# Compress the staging directory into a ZIP
Write-Host "Creating $zipName..."
Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -Force

# Clean up staging directory
Write-Host "Cleaning up staging..."
Remove-Item -Path $stagingDir -Recurse -Force

Write-Host "Release ZIP created at $zipPath"
