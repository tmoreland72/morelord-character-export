# Morelord Character Export Changelog

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
