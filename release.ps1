param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$')]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$ReleaseNotes,

    [Parameter(Mandatory = $false)]
    [switch]$Draft,

    [Parameter(Mandatory = $false)]
    [switch]$Prerelease,

    [Parameter(Mandatory = $false)]
    [switch]$BuildOnly
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ModuleId = "morelord-character-export"
$GitHubRepository = "morelordgaming/morelord-character-export"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ManifestPath = Join-Path $ProjectRoot "module.json"
$ReleaseDirectory = Join-Path $ProjectRoot "release"
$StagingDirectory = Join-Path $ReleaseDirectory $ModuleId
$ZipPath = Join-Path $ReleaseDirectory "$ModuleId.zip"
$ReleaseManifestPath = Join-Path $ReleaseDirectory "module.json"

$Version = $Version.TrimStart("v")
$Tag = "v$Version"

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $Encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $Encoding)
}

function Assert-NoUtf8Bom {
    param([Parameter(Mandatory = $true)][string]$Path)

    $Bytes = [System.IO.File]::ReadAllBytes($Path)
    if (
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xEF -and
        $Bytes[1] -eq 0xBB -and
        $Bytes[2] -eq 0xBF
    ) {
        throw "$Path contains a UTF-8 BOM. Foundry manifests must be UTF-8 without BOM."
    }
}

function Assert-CleanGitWorkingTree {
    $Status = git -C $ProjectRoot status --porcelain
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to read Git status."
    }

    if ($Status) {
        throw "The Git working tree is not clean. Commit or stash current changes before creating a release."
    }
}

function Assert-ZipLayout {
    param([Parameter(Mandatory = $true)][string]$Path)

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [System.IO.Compression.ZipFile]::OpenRead($Path)

    try {
        $Names = @($Archive.Entries | ForEach-Object { $_.FullName.Replace('\\', '/') })

        if ($Names -notcontains "module.json") {
            throw "The release ZIP does not contain module.json at its root."
        }

        if ($Names -notcontains "scripts/main.js") {
            throw "The release ZIP does not contain scripts/main.js."
        }

        if ($Names | Where-Object { $_ -like "$ModuleId/*" }) {
            throw "The release ZIP contains an extra $ModuleId directory. Module files must be at the ZIP root."
        }
    }
    finally {
        $Archive.Dispose()
    }
}

if (-not (Test-Path $ManifestPath)) {
    throw "module.json was not found at $ManifestPath"
}

Assert-Command -Name "git"

if (-not $BuildOnly) {
    Assert-Command -Name "gh"
    Assert-CleanGitWorkingTree

    gh auth status | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub CLI is not authenticated. Run: gh auth login"
    }

    git -C $ProjectRoot rev-parse --is-inside-work-tree | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "$ProjectRoot is not a Git repository."
    }

    git -C $ProjectRoot remote get-url origin | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "The Git repository does not have an origin remote."
    }

    git -C $ProjectRoot fetch origin --tags
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to fetch Git tags from origin."
    }

    $ExistingTag = git -C $ProjectRoot tag --list $Tag
    if ($ExistingTag) {
        throw "Git tag $Tag already exists."
    }

    gh release view $Tag --repo $GitHubRepository 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        throw "GitHub release $Tag already exists."
    }
}

$Manifest = Get-Content $ManifestPath -Raw | ConvertFrom-Json
$Manifest.version = $Version
$Manifest.url = "https://github.com/$GitHubRepository"
$Manifest.manifest = "https://github.com/$GitHubRepository/releases/latest/download/module.json"
$Manifest.download = "https://github.com/$GitHubRepository/releases/download/$Tag/$ModuleId.zip"

$ManifestJson = $Manifest | ConvertTo-Json -Depth 100
Write-Utf8NoBom -Path $ManifestPath -Content ($ManifestJson + [Environment]::NewLine)

# Confirm the generated manifest parses and does not contain a UTF-8 BOM.
Get-Content $ManifestPath -Raw | ConvertFrom-Json | Out-Null
Assert-NoUtf8Bom -Path $ManifestPath

if (Test-Path $ReleaseDirectory) {
    Remove-Item $ReleaseDirectory -Recurse -Force
}

New-Item $StagingDirectory -ItemType Directory -Force | Out-Null

$IncludedFiles = @(
    "module.json",
    "README.md",
    "LICENSE",
    "scripts"
)

foreach ($Item in $IncludedFiles) {
    $Source = Join-Path $ProjectRoot $Item
    if (-not (Test-Path $Source)) {
        throw "Required release item was not found: $Source"
    }

    Copy-Item $Source (Join-Path $StagingDirectory $Item) -Recurse -Force
}

Compress-Archive -Path (Join-Path $StagingDirectory "*") -DestinationPath $ZipPath -Force
Copy-Item $ManifestPath $ReleaseManifestPath -Force
Assert-NoUtf8Bom -Path $ReleaseManifestPath
Assert-ZipLayout -Path $ZipPath

Write-Host "Built Morelord Character Export $Tag" -ForegroundColor Green
Write-Host "ZIP:      $ZipPath"
Write-Host "Manifest: $ReleaseManifestPath"

if ($BuildOnly) {
    Write-Host "Build-only mode complete. No Git commit, tag, push, or GitHub release was created." -ForegroundColor Yellow
    exit 0
}

# Commit the versioned manifest, then tag and push the exact release commit.
git -C $ProjectRoot add module.json
if ($LASTEXITCODE -ne 0) {
    throw "Unable to stage module.json."
}

git -C $ProjectRoot commit -m "Release $Tag"
if ($LASTEXITCODE -ne 0) {
    throw "Unable to create the release commit."
}

git -C $ProjectRoot tag -a $Tag -m "Release $Tag"
if ($LASTEXITCODE -ne 0) {
    throw "Unable to create Git tag $Tag."
}

git -C $ProjectRoot push origin HEAD
if ($LASTEXITCODE -ne 0) {
    throw "Unable to push the release commit."
}

git -C $ProjectRoot push origin $Tag
if ($LASTEXITCODE -ne 0) {
    throw "Unable to push Git tag $Tag."
}

$GhArguments = @(
    "release", "create", $Tag,
    $ZipPath,
    $ReleaseManifestPath,
    "--repo", $GitHubRepository,
    "--title", "Morelord Character Export $Tag",
    "--verify-tag"
)

if ($ReleaseNotes) {
    $GhArguments += @("--notes", $ReleaseNotes)
}
else {
    $GhArguments += "--generate-notes"
}

if ($Draft) {
    $GhArguments += "--draft"
}

if ($Prerelease) {
    $GhArguments += "--prerelease"
}

& gh @GhArguments
if ($LASTEXITCODE -ne 0) {
    throw "GitHub release creation failed. The commit and tag were already pushed; correct the problem and publish the release assets manually if necessary."
}

Write-Host "Published GitHub release $Tag" -ForegroundColor Green
Write-Host "Manifest URL: https://github.com/$GitHubRepository/releases/latest/download/module.json"
