# Morelord Character Export 0.3.7

Release tooling, contributor policy, and documentation since 0.3.6. Character export behavior is unchanged. Morelord Core remains optional.

## What Changed

### Added

- The release package includes a root `CHANGELOG.md`, generated from `release-notes/`, so in-Foundry changelog viewers and GitHub can read the cumulative history from the module archive.
- A GitHub Actions Release workflow on `main` creates the GitHub Release and publishes the Foundry VTT package and the Morelord Gaming website feed. The workflow checks out public `tmoreland72/morelord-core` to run unit tests. Morelord Core remains optional for export.
- The release version resolver accepts an explicit `x.y.z` or a patch, minor, or major bump. `publish_only` republishes an existing version to the website and then to Foundry without creating a commit, tag, or GitHub Release.

### Improvements

- Contributor instructions require D&D 5e 2024 rules (SRD 5.2) only, and keep module settings world-scoped and GM-only unless Troy says otherwise.
- Contributor instructions require Morelord Core shared features before module-local versions, and ask the Core owner to add or fix shared assets in Core.

### Fixed

- The Release workflow and docs run `node --test test/*.mjs` so Node 22 loads the test files. `node --test test/` fails before any test file loads.

## Verification

`module.json` remains `0.3.6` in this preparation. The Release workflow bumps it to `0.3.7` and updates the download URL when Troy dispatches the workflow from `main`. This preparation does not run `release.ps1` or the Release workflow, and it does not publish.

`compatibility.verified` remains `14.368`. The latest stable Foundry VTT release is 14.370 (2 November 2026). This patch was not run in Foundry, so it does not claim 14.370. Foundry minimum and maximum remain `14`. D&D 5e verified remains `5.3.3`. No Dev1 world was available for in-Foundry testing.

`node --test test/*.mjs` on Node v22.23.4: 3 passed, 0 failed. `pwsh -NoProfile -File test/resolve-release-version.test.ps1` on PowerShell 7.6.9: `resolve-release-version tests passed`.

Cancelled pull request #5 (Export Character window) is not part of this patch.
