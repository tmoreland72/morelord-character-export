import { exportCharacter, isExportableActor } from "./character-exporter.js";

const MODULE_ID = "morelord-character-export";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function coreModule() {
  const core = game.modules.get("morelord-core");
  return core?.active ? core : null;
}

export function resolveActor(actor) {
  const resolved = actor ?? canvas?.tokens?.controlled?.[0]?.actor ?? game.user?.character;
  return isExportableActor(resolved) ? resolved : null;
}

export class CharacterExportApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "morelord-character-export-app",
    tag: "section",
    position: { width: 400, height: "auto" },
    window: {
      title: "morelord-character-export.window.title",
      icon: "fa-solid fa-file-export"
    },
    actions: {
      export: CharacterExportApp.exportJson,
      cancel: CharacterExportApp.cancel
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/export-app.hbs` }
  };

  constructor(actor) {
    super({ classes: coreModule() ? ["ml-window", "ml-character-export"] : [] });
    this.actor = actor;
  }

  async _prepareContext(options) {
    const core = coreModule();
    const actorIdentity = core?.api?.ui?.actorIdentity;
    const identity = typeof actorIdentity === "function"
      ? actorIdentity({ name: this.actor.name, img: this.actor.img, actorUuid: this.actor.uuid })
      : "";
    return {
      ...await super._prepareContext(options),
      core: Boolean(core),
      identity,
      name: this.actor.name ?? "",
      img: this.actor.img || "icons/svg/mystery-man.svg"
    };
  }

  static async exportJson(event) {
    event.preventDefault();
    if (this.exporting) return;
    this.exporting = true;
    try {
      await exportCharacter(this.actor);
      await this.close();
    } catch (error) {
      this.exporting = false;
      console.error(`${MODULE_ID} | Character export failed`, error);
      ui.notifications.error(`Character export failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static cancel(event) {
    event.preventDefault();
    return this.close();
  }
}

export function open(actor) {
  const resolved = resolveActor(actor);
  if (!resolved) {
    ui.notifications.warn(game.i18n.localize("morelord-character-export.window.noActor"));
    return null;
  }
  const app = new CharacterExportApp(resolved);
  app.render({ force: true, focus: true });
  return app;
}
