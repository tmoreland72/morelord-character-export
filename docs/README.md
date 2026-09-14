---
title: Morelord Character Export Documentation
description: Export D&D 5e characters from Foundry and import them into My Characters on Morelord Gaming.
slug: morelord-character-export
product: morelord-character-export
version: 0.3.3
audience: all
foundry: 14
---

# Morelord Character Export

## Overview

Morelord Character Export lets GMs and players download a D&D 5e character from Foundry Virtual Tabletop and import it into **My Characters** on the Morelord Gaming website. The file includes character data, a snapshot of prepared sheet values, and available character and item artwork.

Exporting from Foundry does not require Morelord Core, a Morelord account connection, or a paid subscription. To import the file on the website, register for a free Morelord Gaming account and sign in.

This guide covers version 0.3.3. Exports are snapshots: later changes in Foundry do not automatically update the imported character.

## Requirements

- Foundry VTT v14 only.
- D&D 5e system version 4.0.0 or later; verified with 5.3.3.
- A supported ApplicationV2 character sheet, including the current D&D 5e and Tidy 5e sheets. Legacy ApplicationV1 sheets and Foundry v13 are unsupported.
- A D&D 5e character Actor for which you have at least Observer permission. NPCs and other Actor types are not exportable.

## Install and enable

1. In Foundry Setup, open **Add-on Modules**, then **Install Module**.
2. Paste the manifest URL below and install the module.
3. Open your D&D 5e world and enable **Morelord Character Export** under **Manage Modules**.

```text
https://raw.githubusercontent.com/tmoreland72/morelord-character-export/main/module.json
```

## Export a character

1. Open the character's sheet.
2. Choose **Morelord Export** from the sheet's title-bar controls.
3. Wait for the export notification and save the downloaded JSON file.

The filename follows the pattern `character-name.morelord-character.json`. The export does not change the Foundry character.

## Import into My Characters

1. Visit the [Morelord Gaming website](https://morelordgaming.com), register for a free account if needed, and sign in.
2. Open [My Characters](https://morelordgaming.com/characters).
3. Select **Import Character** and choose the downloaded `.morelord-character.json` file.
4. Open the imported character to view it.

Export a new file when you want a more recent snapshot. The website determines how exported fields are displayed; this workflow does not synchronize changes back to Foundry.

## What the file contains

- Source Actor data, including embedded Items, item activities, and Active Effects.
- Prepared character values and item-use values captured from the running D&D 5e system.
- Available portrait, prototype-token image, and Item icons, stored once per image path and referenced from the character and Items.
- Foundry, system, and exporter versions, the export timestamp, and the source world ID.

Images are resized and converted to WebP when possible. An image that cannot be fetched or embedded retains its original path as a fallback; that path may not be accessible outside Foundry. The file can include character details and notes from the Actor source, so share it only with people who should have those details.

## Troubleshooting

### Morelord Export is missing

Confirm the module is enabled, the world uses D&D 5e on Foundry v14, and you opened a character rather than an NPC or another Actor type. Confirm the sheet uses ApplicationV2 and you have Observer permission or higher. A GM can adjust the character's permissions.

### Artwork is missing after import

Check that the image loads in Foundry, then export again. Missing files, inaccessible remote images, or image-conversion failures can prevent artwork from being embedded. Some failed conversions retain the original image; failed fetches can leave only a path reference.

### Export fails or the website rejects the file

Check Foundry's notification and browser console for the export error. Use the JSON downloaded by **Morelord Export**, rather than a standard Foundry Actor export, and keep the file intact. Confirm you are signed in to the website. When reporting an issue, include the module, Foundry, and D&D 5e versions and the error message.

## Macro and format reference

Macros can call `game.modules.get("morelord-character-export").api.exportCharacter(actor)` or `exportActorByUuid(uuid)`. The same character and permission checks apply. `buildCharacterExport(actor)` returns the export payload without downloading it.

The current format is `morelord-character`, version `3`, with `actor`, `derived`, and `assets` sections. Full macro examples and a format sample are in the [repository README](https://github.com/tmoreland72/morelord-character-export#macro-api).
