param(
    [string]$Version,
    [string]$CommitMessage
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

$ModuleId = "morelord-character-export"
$GitHubOwner = "tmoreland72"
$GitHubRepo = "morelord-character-export"

$ArchiveName = "$ModuleId.zip"
$ArchivePath = Join-Path $ProjectRoot $ArchiveName
$ManifestPath = Join-Path $ProjectRoot "module.json"


function Show-Usage {

    Write-Host ""
    Write-Host "Morelord Character Export - Release Script" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "Syntax:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  .\release.ps1 -Version <version> [-CommitMessage <message>]"
    Write-Host ""

    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host ""

    Write-Host '  .\release.ps1 -Version 0.1.4'
    Write-Host ""

    Write-Host '  .\release.ps1 -Version 0.1.5 -CommitMessage "Release v0.1.5"'
    Write-Host ""

    Write-Host "The script will:" -ForegroundColor Yellow
    Write-Host ""

    Write-Host "  1. Update the version in module.json"
    Write-Host "  2. Update the version-specific Foundry download URL"
    Write-Host "  3. Ensure module.json is UTF-8 without BOM"
    Write-Host "  4. Build the Foundry module ZIP"
    Write-Host "  5. Verify the ZIP and embedded module.json"
    Write-Host "  6. Commit and push the source changes"
    Write-Host "  7. Create and push a Git tag"
    Write-Host "  8. Create a GitHub Release"
    Write-Host "  9. Upload the ZIP to the GitHub Release"
    Write-Host ""
}


function Assert-CommandExists {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    if (
        -not (
            Get-Command `
                $Command `
                -ErrorAction SilentlyContinue
        )
    ) {
        throw "Required command '$Command' was not found."
    }
}


function Ensure-Utf8NoBom {

    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $Bytes =
        [System.IO.File]::ReadAllBytes(
            $Path
        )

    $HasBom =
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xEF -and
        $Bytes[1] -eq 0xBB -and
        $Bytes[2] -eq 0xBF

    if ($HasBom) {

        Write-Host `
            "UTF-8 BOM detected in $Path. Removing it..." `
            -ForegroundColor Yellow

        $Text =
            [System.IO.File]::ReadAllText(
                $Path
            )

        $Utf8NoBom =
            New-Object System.Text.UTF8Encoding(
                $false
            )

        [System.IO.File]::WriteAllText(
            $Path,
            $Text,
            $Utf8NoBom
        )
    }

    #
    # Verify again after any correction.
    #

    $Bytes =
        [System.IO.File]::ReadAllBytes(
            $Path
        )

    if (
        $Bytes.Length -ge 3 -and
        $Bytes[0] -eq 0xEF -and
        $Bytes[1] -eq 0xBB -and
        $Bytes[2] -eq 0xBF
    ) {
        throw "Unable to remove UTF-8 BOM from '$Path'."
    }

    if (
        $Bytes.Length -eq 0 -or
        $Bytes[0] -ne 0x7B
    ) {
        throw "Manifest '$Path' does not begin with '{'."
    }

    Write-Host `
        "module.json encoding verified: UTF-8 without BOM." `
        -ForegroundColor Green
}


#
# No version: show help and exit.
#

if (
    [string]::IsNullOrWhiteSpace(
        $Version
    )
) {
    Show-Usage
    exit 0
}


#
# Validate semantic version format.
#

if (
    $Version -notmatch '^\d+\.\d+\.\d+$'
) {
    Write-Host ""
    Write-Host "ERROR: Invalid version format." -ForegroundColor Red
    Write-Host ""
    Write-Host "Use semantic version format, for example:"
    Write-Host ""
    Write-Host "  0.1.4"
    Write-Host "  1.0.0"
    Write-Host "  2.3.5"
    Write-Host ""

    exit 1
}


$Tag = "v$Version"

if (
    [string]::IsNullOrWhiteSpace(
        $CommitMessage
    )
) {
    $CommitMessage =
        "Release $Tag"
}


Set-Location $ProjectRoot


Write-Host ""
Write-Host "Preparing release $Tag..." -ForegroundColor Cyan
Write-Host ""


#
# Verify required commands.
#

Assert-CommandExists "git"
Assert-CommandExists "gh"


#
# Verify GitHub CLI authentication.
#

Write-Host "Checking GitHub CLI authentication..." -ForegroundColor Cyan

gh auth status

if (
    $LASTEXITCODE -ne 0
) {
    throw "GitHub CLI is not authenticated. Run 'gh auth login' first."
}


#
# Verify this is a Git repository.
#

git rev-parse --is-inside-work-tree 2>$null |
    Out-Null

if (
    $LASTEXITCODE -ne 0
) {
    throw "This directory is not a Git repository."
}


#
# Verify module.json exists.
#

if (
    -not (
        Test-Path $ManifestPath
    )
) {
    throw "module.json was not found at '$ManifestPath'."
}


#
# Prevent overwriting an existing local tag.
#

$ExistingLocalTag =
    git tag --list $Tag

if (
    $ExistingLocalTag
) {
    throw "Git tag '$Tag' already exists locally."
}


#
# Prevent overwriting an existing remote tag.
#
# A non-zero result is expected for a new release.
#

$PreviousErrorActionPreference =
    $ErrorActionPreference

$ErrorActionPreference =
    "SilentlyContinue"

git ls-remote `
    --exit-code `
    --tags `
    origin `
    "refs/tags/$Tag" `
    *> $null

$RemoteTagExists =
    $LASTEXITCODE -eq 0

$ErrorActionPreference =
    $PreviousErrorActionPreference


if (
    $RemoteTagExists
) {
    throw "Git tag '$Tag' already exists on origin."
}


#
# Prevent overwriting an existing GitHub Release.
#
# "Release not found" is expected for a new version.
#

$PreviousErrorActionPreference =
    $ErrorActionPreference

$ErrorActionPreference =
    "SilentlyContinue"

gh release view $Tag `
    --repo "$GitHubOwner/$GitHubRepo" `
    *> $null

$ReleaseExists =
    $LASTEXITCODE -eq 0

$ErrorActionPreference =
    $PreviousErrorActionPreference


if (
    $ReleaseExists
) {
    throw "GitHub Release '$Tag' already exists."
}


#
# Read module.json.
#

Write-Host ""
Write-Host "Updating module.json..." -ForegroundColor Cyan


$Manifest =
    Get-Content `
        -Path $ManifestPath `
        -Raw |
    ConvertFrom-Json


$OldVersion =
    $Manifest.version


$DownloadUrl =
    "https://github.com/$GitHubOwner/$GitHubRepo/releases/download/$Tag/$ArchiveName"


Write-Host "  Current version : $OldVersion"
Write-Host "  Release version : $Version"
Write-Host "  Download URL    : $DownloadUrl"


#
# Update manifest values.
#

$Manifest.version =
    $Version

$Manifest.download =
    $DownloadUrl

$Manifest.url =
    "https://github.com/$GitHubOwner/$GitHubRepo"

$Manifest.manifest =
    "https://raw.githubusercontent.com/$GitHubOwner/$GitHubRepo/main/module.json"


#
# Serialize module.json.
#

$ManifestJson =
    $Manifest |
    ConvertTo-Json -Depth 100


#
# Explicitly write UTF-8 without BOM.
#

$Utf8NoBom =
    New-Object System.Text.UTF8Encoding(
        $false
    )

[System.IO.File]::WriteAllText(
    $ManifestPath,
    $ManifestJson,
    $Utf8NoBom
)


#
# Verify encoding and automatically remove a BOM if one somehow exists.
#

Ensure-Utf8NoBom `
    -Path $ManifestPath


Write-Host ""
Write-Host "module.json updated." -ForegroundColor Green


#
# Remove previous local archive.
#

if (
    Test-Path $ArchivePath
) {
    Write-Host ""
    Write-Host "Removing previous local archive..." -ForegroundColor Cyan

    Remove-Item `
        $ArchivePath `
        -Force
}


#
# Required release content.
#

$RequiredPaths = @(
    "module.json",
    "README.md",
    "scripts"
)


#
# Optional release content.
#

$OptionalPaths = @(
    "styles",
    "templates",
    "assets",
    "lang",
    "LICENSE"
)


#
# Verify required paths.
#

foreach (
    $Path in $RequiredPaths
) {
    if (
        -not (
            Test-Path (
                Join-Path `
                    $ProjectRoot `
                    $Path
            )
        )
    ) {
        throw "Required release path '$Path' was not found."
    }
}


#
# Build complete release path list.
#

$IncludePaths =
    @(
        $RequiredPaths
    )


foreach (
    $Path in $OptionalPaths
) {
    if (
        Test-Path (
            Join-Path `
                $ProjectRoot `
                $Path
        )
    ) {
        $IncludePaths +=
            $Path
    }
}


#
# Build ZIP.
#

Write-Host ""
Write-Host "Building release archive..." -ForegroundColor Cyan


Compress-Archive `
    -Path $IncludePaths `
    -DestinationPath $ArchivePath `
    -CompressionLevel Optimal `
    -Force


Write-Host ""
Write-Host "Archive created:" -ForegroundColor Green
Write-Host "  $ArchivePath"


#
# Verify ZIP.
#

Write-Host ""
Write-Host "Verifying archive..." -ForegroundColor Cyan


Add-Type `
    -AssemblyName System.IO.Compression.FileSystem


$Zip =
    [System.IO.Compression.ZipFile]::OpenRead(
        $ArchivePath
    )


try {

    #
    # Verify module.json exists at ZIP root.
    #

    $ManifestEntry =
        $Zip.Entries |
        Where-Object {
            $_.FullName -eq "module.json"
        }


    if (
        -not $ManifestEntry
    ) {
        throw "module.json is not located at the root of the ZIP archive."
    }


    #
    # Read module.json from inside ZIP.
    #

    $Reader =
        New-Object System.IO.StreamReader(
            $ManifestEntry.Open()
        )


    try {

        $ZippedManifestText =
            $Reader.ReadToEnd()

        $ZippedManifest =
            $ZippedManifestText |
            ConvertFrom-Json
    }
    finally {

        $Reader.Dispose()
    }


    #
    # Verify version.
    #

    if (
        $ZippedManifest.version -ne
        $Version
    ) {
        throw `
            "ZIP module.json version '$($ZippedManifest.version)' does not match requested version '$Version'."
    }


    #
    # Verify download URL.
    #

    if (
        $ZippedManifest.download -ne
        $DownloadUrl
    ) {
        throw `
            "ZIP module.json download URL does not match the expected release URL."
    }


    #
    # Verify zipped manifest has no BOM.
    #

    $ManifestStream =
        $ManifestEntry.Open()

    try {

        $FirstByte =
            $ManifestStream.ReadByte()

        if (
            $FirstByte -ne 0x7B
        ) {
            throw `
                "ZIP module.json does not begin with '{'. Possible BOM or invalid encoding."
        }
    }
    finally {

        $ManifestStream.Dispose()
    }


    Write-Host "  module.json found at ZIP root"
    Write-Host "  version: $($ZippedManifest.version)"
    Write-Host "  download URL verified"
    Write-Host "  UTF-8 BOM check passed"
    Write-Host ""
    Write-Host "Archive verification successful." -ForegroundColor Green
}
finally {

    $Zip.Dispose()
}


#
# Show Git status.
#

Write-Host ""
Write-Host "Git changes:" -ForegroundColor Cyan
Write-Host ""

git status --short


#
# Stage source changes only.
#
# The ZIP is intentionally NOT committed to the repository.
#

Write-Host ""
Write-Host "Staging source changes..." -ForegroundColor Cyan


git add `
    module.json `
    README.md `
    scripts


foreach (
    $Path in $OptionalPaths
) {
    if (
        Test-Path (
            Join-Path `
                $ProjectRoot `
                $Path
        )
    ) {
        git add $Path
    }
}


if (
    $LASTEXITCODE -ne 0
) {
    throw "git add failed."
}


#
# Verify there are staged changes.
#

git diff --cached --quiet


if (
    $LASTEXITCODE -eq 0
) {
    throw "No source changes were detected to commit."
}


#
# Commit source.
#

Write-Host ""
Write-Host "Creating Git commit..." -ForegroundColor Cyan
Write-Host "  $CommitMessage"
Write-Host ""


git commit `
    -m $CommitMessage


if (
    $LASTEXITCODE -ne 0
) {
    throw "git commit failed."
}


#
# Push source.
#

Write-Host ""
Write-Host "Pushing source to GitHub..." -ForegroundColor Cyan


git push


if (
    $LASTEXITCODE -ne 0
) {
    throw "git push failed."
}


#
# Create Git tag.
#

Write-Host ""
Write-Host "Creating Git tag $Tag..." -ForegroundColor Cyan


git tag `
    -a $Tag `
    -m "Release $Tag"


if (
    $LASTEXITCODE -ne 0
) {
    throw "Failed to create Git tag '$Tag'."
}


#
# Push Git tag.
#

Write-Host ""
Write-Host "Pushing Git tag..." -ForegroundColor Cyan


git push origin $Tag


if (
    $LASTEXITCODE -ne 0
) {
    throw "Failed to push Git tag '$Tag'."
}


#
# Create GitHub Release and upload ZIP.
#

Write-Host ""
Write-Host "Creating GitHub Release..." -ForegroundColor Cyan


$ReleaseTitle =
    "$Tag - Morelord Character Export"


$ReleaseNotes = @"
Morelord Character Export $Tag

See README.md for module documentation and current functionality.
"@


gh release create $Tag `
    $ArchivePath `
    --repo "$GitHubOwner/$GitHubRepo" `
    --title $ReleaseTitle `
    --notes $ReleaseNotes


if (
    $LASTEXITCODE -ne 0
) {
    throw "Failed to create GitHub Release '$Tag'."
}


#
# Verify GitHub Release.
#

Write-Host ""
Write-Host "Verifying GitHub Release..." -ForegroundColor Cyan


gh release view $Tag `
    --repo "$GitHubOwner/$GitHubRepo"


if (
    $LASTEXITCODE -ne 0
) {
    throw "GitHub Release verification failed."
}


#
# Finished.
#

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Release $Tag completed successfully." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Foundry Manifest URL:" -ForegroundColor Yellow

Write-Host `
    "https://raw.githubusercontent.com/$GitHubOwner/$GitHubRepo/main/module.json"

Write-Host ""

Write-Host "Release download URL:" -ForegroundColor Yellow

Write-Host $DownloadUrl

Write-Host ""

Write-Host "GitHub Release:" -ForegroundColor Yellow

Write-Host `
    "https://github.com/$GitHubOwner/$GitHubRepo/releases/tag/$Tag"

Write-Host ""