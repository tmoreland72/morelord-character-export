# Unreleased

## What Changed

### Fixed

- The Release workflow no longer requests a documentation deployment from `tmorelord72/morelord-gaming-web`. That `repository_dispatch` returned HTTP 403 and failed the run after GitHub, Foundry, and the website feed had already published.
