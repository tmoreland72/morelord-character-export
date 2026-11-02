# Releasing Morelord Character Export

Dispatch the **Release** workflow from the `main` branch after this workflow file is on `main`. The workflow runs `.github/workflows/release.yml` on `ubuntu-latest` with PowerShell. It does not run in-Foundry tests. The website release feed announces the release. This workflow has no Discord step.

## Secrets

The workflow reads these repository secrets. It passes them only as environment variables on the publish steps. It does not write a `.env` file and it does not print the values. The job stops with a clear error when either secret is empty.

| Secret | Used for |
| --- | --- |
| `RELEASE_PUBLISH_TOKEN` | `morelordgaming.com` release feed |
| `FOUNDRY_RELEASE_TOKEN` | Foundry VTT package listing |

`GITHUB_TOKEN` is provided by Actions. The workflow sets `GH_TOKEN` from it so `release.ps1` can commit, tag, push, and create the GitHub Release. The workflow grants `contents: write` and commits as `github-actions[bot]`. Branch protection on `main` must allow that bot to push commits and tags.

## Inputs

| Input | Default | Effect |
| --- | --- | --- |
| `bump` | `patch` | Used only when `version` is empty and `publish_only` is false |
| `version` | empty | Explicit `x.y.z`. When set, `bump` is ignored |
| `publish_only` | false | Skip the version bump, tag, and GitHub Release. Publish that version to the website and then to Foundry |

With `module.json` at `0.3.6` and no explicit version, the bumps are:

| `bump` | Next version |
| --- | --- |
| `patch` | `0.3.7` |
| `minor` | `0.4.0` |
| `major` | `1.0.0` |

`publish_only` without `version` uses the version already in `module.json`. It does not increment it. `publish_only` with `version` publishes that exact version. `module.json` on `main` must already equal that version, and the `v` tag must already exist on `origin`. `publish_only` with version `0.3.6` sends the existing 0.3.6 release to the website feed and the Foundry listing.

A normal release still needs `release-notes/RELEASE-NOTES-<version>.md` and `docs/README.md` frontmatter for that version before the dispatch. `release.ps1` creates the commit, tag, GitHub Release, website record, and Foundry release. It does not pass `-SkipFoundryPublish` or `-SkipWebsitePublish`.

## Changelog

Per-version release notes live in `release-notes/RELEASE-NOTES-<version>.md`. Those files are excluded from release archives. Every release maintains a cumulative root `CHANGELOG.md`: newest version first, `#`/`##`/`###` headings with a space after `#`, `- ` bullets, and no `---` horizontal rules. `release.ps1` rebuilds that file from the `## What Changed` sections in `release-notes/RELEASE-NOTES-*.md` before it stages the archive, and omits `## Verification` and other sections outside `## What Changed`. It then commits `CHANGELOG.md` with `module.json` (`git add -- module.json CHANGELOG.md`).

`release.config.json` lists `CHANGELOG.md` in `requiredPaths`, so the file is copied to the root of the release `.zip` and archive validation checks that it is present. In-Foundry changelog viewers and GitHub users read that packaged file.

`-ValidateOnly` and `-DryRun` do not commit, tag, or publish. When `CHANGELOG.md` is already current, both leave the Git worktree unchanged. The archive used for those checks still contains the changelog text generated from `release-notes/`.

## Morelord Core and tests

When `publish_only` is false, the workflow checks out the public repository `tmoreland72/morelord-core` and moves it beside this repository, then runs `node --test test/`. Checkout uses the Actions `GITHUB_TOKEN` already granted to the job. Morelord Core is public, so that token can read the repository and no cross-repo secret is required.

The owner is `tmoreland72`, the same value as `githubOwner` in `release.config.json`. The raw manifest is `https://raw.githubusercontent.com/tmoreland72/morelord-core/main/module.json`.

`publish_only` skips that checkout and skips the unit tests.

## Local equivalents

Website-only and Foundry-only publishing are separate script invocations. They do not commit, tag, or create a GitHub Release.

```powershell
$env:RELEASE_PUBLISH_TOKEN = '<token>'
./release.ps1 -Version 0.3.6 -WebsiteOnly
$env:FOUNDRY_RELEASE_TOKEN = '<token>'
./release.ps1 -Version 0.3.6 -FoundryOnly
```
