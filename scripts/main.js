import {
  buildCharacterExport,
  exportCharacter,
  getActorFromApplication,
  isExportableActor
} from "./character-exporter.js";

const MODULE_ID = "morelord-character-export";
const CONTROL_NAME = "morelord-character-export";

Hooks.once("init", () => {
  const generation = Number.parseInt(game.version, 10);

  if (generation !== 14) {
    console.warn(
      `${MODULE_ID} | Foundry ${game.version} is unsupported. This module requires Foundry VTT v14.`
    );
  }

  console.log(`${MODULE_ID} | Initializing for Foundry ${game.version}`);
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);

  if (!module) {
    console.error(`${MODULE_ID} | Unable to register API because the module record was not found.`);
    return;
  }

  module.api = {
    buildCharacterExport,
    exportCharacter,
    exportActorByUuid: async (uuid) => {
      const actor = await fromUuid(uuid);
      return exportCharacter(actor);
    }
  };

  console.log(`${MODULE_ID} | Ready`);
});

// Foundry v14 ApplicationV2 sheets, including the current D&D 5e and Tidy 5e sheets.
Hooks.on("getHeaderControlsApplicationV2", (application, controls) => {
  const actor = getActorFromApplication(application);
  if (!isExportableActor(actor)) return;
  if (controls.some((control) => control.action === CONTROL_NAME || control.name === CONTROL_NAME)) return;

  controls.unshift({
    action: CONTROL_NAME,
    icon: "fa-solid fa-file-export",
    label: "Morelord Export",
    visible: true,
    onClick: () => runExport(actor)
  });
});

async function runExport(actor) {
  try {
    await exportCharacter(actor);
  } catch (error) {
    console.error(`${MODULE_ID} | Character export failed`, error);
    ui.notifications.error(`Character export failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
