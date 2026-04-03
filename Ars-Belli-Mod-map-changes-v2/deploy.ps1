# This script copies the files from this repository to the mod folder in the current
# user's Documents\Paradox Interactive\Europa Universalis V\mod folder for faster modding

# Define source and destination paths
$sourceDir = $PSScriptRoot
$destDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) "Paradox Interactive\Europa Universalis V\mod\ArsBelliMod"

# Ensure destination directory exists and is empty
if (-not (Test-Path -Path $destDir)) {
    Write-Host "Creating destination directory: $destDir"
    New-Item -ItemType Directory -Path $destDir -Force
} else {
    Write-Host "Cleaning destination directory: $destDir..."
    # Remove all items inside the destination directory, but keep the directory itself
    Remove-Item -Path (Join-Path $destDir "*") -Recurse -Force -ErrorAction SilentlyContinue
}

# Directories and files to copy (mod content)
$includeList = @("in_game", "main_menu", ".metadata")

foreach ($item in $includeList) {
    $srcPath = Join-Path $sourceDir $item
    if (Test-Path -Path $srcPath) {
        Write-Host "Copying $item to $destDir..."
        if (Test-Path -Path $srcPath -PathType Container) {
            # Copy directory recursively
            Copy-Item -Path $srcPath -Destination $destDir -Recurse -Force
        } else {
            # Copy single file
            Copy-Item -Path $srcPath -Destination $destDir -Force
        }
    } else {
        Write-Warning "Source path not found: $srcPath"
    }
}

# Check if the metadata folder exists and copy its content
$metadataDir = Join-Path $sourceDir ".metadata"
if (Test-Path -Path $metadataDir) {
    Write-Host "Copying metadata content to $destDir..."
    Copy-Item -Path (Join-Path $metadataDir "*") -Destination $destDir -Force
}

Write-Host "Deployment complete."
