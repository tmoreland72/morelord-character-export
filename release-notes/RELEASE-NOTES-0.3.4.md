# Morelord Character Export 0.3.4

## What Changed

### Improvements

- Updated Foundry verification metadata to 14.367 and synchronized the standard release archive validation workflow.
- Verified Foundry compatibility is explicitly recorded as 14.367; existing Foundry and system support minimums remain unchanged.
- Release guidelines require checking the latest stable Foundry build and confirming the published Foundry listing.

## Validation

- The automated export test passes. Live export on Foundry 14.367 / D&D 5e 6.0.1 preserves calculated AC, all 33 sampled character items, and serializable activities. Website-side import was not exercised.
- Legacy rarity compatibility is regression-tested; a live pre-v6 world was not available.
