param(
    [Parameter(Mandatory = $false)]
    [string]$Version
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $ProjectRoot "module.json"
$ReleaseDirectory = Join-Path $ProjectRoot "release"
$ModuleId = "morelord-character-export"

if (-not (Test-Path $ManifestPath)) {
    throw "module.json was not found at $ManifestPath"
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json

if ($Version) {
    $Version = $Version.TrimStart("v")
    $Manifest.version = $Version
    $Manifest.download = "https://github.com/morelordgaming/$ModuleId/releases/download/v$Version/$ModuleId.zip"
    $Manifest | ConvertTo-Json -Depth 20 | Set-Content $ManifestPath -Encoding utf8NoBOM
}
else {
    $Version = $Manifest.version
}

if (Test-Path $ReleaseDirectory) {
    Remove-Item $ReleaseDirectory -Recurse -Force
}
New-Item $ReleaseDirectory -ItemType Directory | Out-Null

$StagingDirectory = Join-Path $ReleaseDirectory $ModuleId
New-Item $StagingDirectory -ItemType Directory | Out-Null

$IncludedFiles = @(
    "module.json",
    "README.md",
    "LICENSE",
    "scripts"
)

foreach ($Item in $IncludedFiles) {
    $Source = Join-Path $ProjectRoot $Item
    $Destination = Join-Path $StagingDirectory $Item
    Copy-Item $Source $Destination -Recurse -Force
}

$ZipPath = Join-Path $ReleaseDirectory "$ModuleId.zip"
Compress-Archive -Path "$StagingDirectory\*" -DestinationPath $ZipPath -Force
Copy-Item $ManifestPath (Join-Path $ReleaseDirectory "module.json") -Force

Write-Host "Created release v$Version" -ForegroundColor Green
Write-Host "ZIP:      $ZipPath"
Write-Host "Manifest: $(Join-Path $ReleaseDirectory 'module.json')"
