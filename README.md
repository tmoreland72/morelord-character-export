# Morelord Character Export

Morelord Character Export adds a **Morelord Export** command to the title-bar controls of D&D 5e character sheets in Foundry Virtual Tabletop.

The command downloads a portable JSON file intended for the Morelord Character Manager. The export contains the Actor's complete source data, a snapshot of values already prepared by Foundry and D&D 5e, and an embedded image library for character-sheet artwork.

## Compatibility

- **Foundry VTT:** v14 only.
- **Game system:** D&D 5e.
- Uses the Foundry v14 `getHeaderControlsApplicationV2` hook.
- Designed for the current D&D 5e ApplicationV2 character sheet and Tidy 5e character sheet.
- Foundry v13 and legacy ApplicationV1 sheets are not supported.

## Current features

- Foundry VTT v14 support.
- D&D 5e character Actors only.
- ApplicationV2 title-bar integration.
- Complete `Actor#toObject(false)` data, including embedded Items and Active Effects.
- Display-ready values copied from the live, prepared Actor under `derived`.
- Deduplicated embedded image library containing:
  - character portrait
  - prototype token image
  - class, subclass, species, background, feat, spell, equipment, container, tool, consumable, and other Item icons
- Item IDs mapped directly to their embedded image asset IDs.
- Images resized and converted to WebP when possible.
- Public API for macros and development testing.
- Exact Foundry and D&D 5e system versions recorded in every export.

## Installation during development

Place the repository outside the Foundry data directory and create a Windows directory junction inside your Foundry modules folder.

Run Command Prompt as Administrator:

```bat
mklink /J "C:\Path\To\FoundryVTT\Data\modules\morelord-character-export" "C:\Path\To\GitHub\morelord-character-export"
```

Enable **Morelord Character Export** under **Manage Modules** in the desired world.

## Use

Open a D&D 5e player-character sheet and choose **Morelord Export** from the sheet's title-bar controls.

The downloaded filename uses this pattern:

```text
character-name.morelord-character.json
```

## Macro API

Export an Actor directly:

```js
await game.modules.get("morelord-character-export").api.exportCharacter(actor);
```

Export the currently selected token's Actor:

```js
const actor = canvas.tokens.controlled[0]?.actor;
if (!actor) return ui.notifications.warn("Select a token first.");
await game.modules.get("morelord-character-export").api.exportCharacter(actor);
```

Export by UUID:

```js
await game.modules
  .get("morelord-character-export")
  .api.exportActorByUuid("Actor.ACTOR_ID");
```

## Export format

Format version `3` stores all images once and references them by asset ID:

```json
{
  "format": "morelord-character",
  "formatVersion": 3,
  "exportedAt": "2026-08-03T00:00:00.000Z",
  "source": {
    "moduleVersion": "0.3.0",
    "foundryVersion": "14.365",
    "systemVersion": "5.3.3"
  },
  "actor": {},
  "derived": {},
  "assets": {
    "images": {
      "image-1": {
        "path": "tokenizer/pc-images/example.webp",
        "mimeType": "image/webp",
        "data": "data:image/webp;base64,...",
        "embedded": true
      }
    },
    "references": {
      "actor": {
        "portrait": "image-1",
        "prototypeToken": "image-2"
      },
      "items": {
        "ITEM_ID": "image-3"
      }
    },
    "summary": {
      "requested": 3,
      "embedded": 3,
      "failed": 0
    }
  }
}
```

The raw Actor and embedded Item records retain their original Foundry image paths. The Character Manager should resolve portable images through `assets.references` and `assets.images`, then use the original path or a generic icon only as a fallback.
