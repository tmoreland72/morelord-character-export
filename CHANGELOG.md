# Morelord Character Export Changelog

## 0.3.7

### Added

- The release package includes a root `CHANGELOG.md`, generated from `release-notes/`, so in-Foundry changelog viewers and GitHub can read the cumulative history from the module archive.
- A GitHub Actions Release workflow on `main` creates the GitHub Release and publishes the Foundry VTT package and the Morelord Gaming website feed. The workflow checks out public `tmoreland72/morelord-core` to run unit tests. Morelord Core remains optional for export.
- The release version resolver accepts an explicit `x.y.z` or a patch, minor, or major bump. `publish_only` republishes an existing version to the website and then to Foundry without creating a commit, tag, or GitHub Release.

### Improvements

- Contributor instructions require D&D 5e 2024 rules (SRD 5.2) only, and keep module settings world-scoped and GM-only unless Troy says otherwise.
- Contributor instructions require Morelord Core shared features before module-local versions, and ask the Core owner to add or fix shared assets in Core.

### Fixed

- The Release workflow and docs run `node --test test/*.mjs` so Node 22 loads the test files. `node --test test/` fails before any test file loads.

## 0.3.6

### Improvements

- Added a manifest changelog link and moved release history into `release-notes/`. Local working files belong in ignored `/tmp/`.

- Release staging and generated ZIP files use module-local `/tmp/`; ZIP validation rejects working files and release-note sources.

## 0.3.5

### Improvements

- Added optional export usage and sanitized error reporting through Core, requiring fresh GM consent. Exporting still works without Core or a Morelord account connection.

## 0.3.4

### Improvements

- Updated Foundry verification metadata to 14.367 and synchronized the standard release archive validation workflow.
- Verified Foundry compatibility is explicitly recorded as 14.367; existing Foundry and system support minimums remain unchanged.
- Release guidelines require checking the latest stable Foundry build and confirming the published Foundry listing.

## 0.3.3

### Improvements

- Exports include prepared item-use values alongside the character's source data and prepared sheet snapshot.
- Character Export now uses the standard Morelord release workflow for GitHub, Foundry VTT, and the Morelord Gaming release feed.
- Updated installation and usage documentation for My Characters and free website accounts.
- Added a versioned GM and player guide covering installation, export, website import, permissions, and troubleshooting, included in the module package and website documentation workflow.
