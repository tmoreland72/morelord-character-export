import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rendered = [];
const warnings = [];

class ApplicationV2 {
  constructor(options = {}) {
    this.options = { ...this.constructor.DEFAULT_OPTIONS, ...options };
  }

  async _prepareContext() {
    return {};
  }

  render(options) {
    this.renderOptions = options;
    rendered.push(this);
    return this;
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

function HandlebarsApplicationMixin(Base) {
  return class extends Base {};
}

globalThis.foundry = { applications: { api: { ApplicationV2, HandlebarsApplicationMixin } } };
globalThis.ui = { notifications: { warn(message) { warnings.push(message); } } };
globalThis.canvas = { tokens: { controlled: [] } };
globalThis.game = {
  system: { id: "dnd5e" },
  user: { character: null },
  modules: new Map(),
  i18n: { localize: (key) => key }
};

const { open, resolveActor } = await import("../scripts/export-app.js");

function actor(name, extras = {}) {
  return {
    documentName: "Actor",
    type: "character",
    name,
    img: `${name}.webp`,
    uuid: `Actor.${name}`,
    testUserPermission: () => true,
    ...extras
  };
}

beforeEach(() => {
  warnings.length = 0;
  rendered.length = 0;
  canvas.tokens.controlled = [];
  game.user.character = null;
  game.system.id = "dnd5e";
  game.modules.clear();
});

test("resolveActor prefers the argument, then the controlled token, then the assigned character", () => {
  const given = actor("Given");
  const token = actor("Token");
  const character = actor("Character");
  canvas.tokens.controlled = [{ actor: token }];
  game.user.character = character;

  assert.equal(resolveActor(given), given);
  assert.equal(resolveActor(null), token);
  assert.equal(resolveActor(), token);

  canvas.tokens.controlled = [];
  assert.equal(resolveActor(), character);

  canvas.tokens.controlled = [{}];
  assert.equal(resolveActor(undefined), character);
});

test("resolveActor returns null unless the chosen actor is exportable", () => {
  const token = actor("Token");
  const character = actor("Character");
  canvas.tokens.controlled = [{ actor: token }];
  game.user.character = character;

  assert.equal(resolveActor(actor("NPC", { type: "npc" })), null);
  assert.equal(resolveActor(actor("Denied", { testUserPermission: () => false })), null);
  assert.equal(resolveActor({ documentName: "Item", type: "character", testUserPermission: () => true }), null);

  canvas.tokens.controlled = [{ actor: actor("Goblin", { type: "npc" }) }];
  assert.equal(resolveActor(), null);

  canvas.tokens.controlled = [];
  game.user.character = actor("Denied", { testUserPermission: () => false });
  assert.equal(resolveActor(), null);

  game.system.id = "pf2e";
  game.user.character = character;
  assert.equal(resolveActor(), null);
  assert.equal(resolveActor(character), null);
});

test("open warns and returns null when no exportable actor is found", () => {
  assert.equal(open(), null);
  assert.deepEqual(warnings, ["morelord-character-export.window.noActor"]);
  assert.equal(rendered.length, 0);

  canvas.tokens.controlled = [{ actor: actor("Goblin", { type: "npc" }) }];
  game.user.character = actor("Hero");
  assert.equal(open(), null);
  assert.equal(rendered.length, 0);
});

test("open renders the export window for the resolved actor", async () => {
  const given = actor("Given");
  const token = actor("Token");
  const character = actor("Character");
  canvas.tokens.controlled = [{ actor: token }];
  game.user.character = character;

  const explicit = open(given);
  assert.equal(warnings.length, 0);
  assert.equal(explicit.actor, given);
  assert.equal(rendered.at(-1), explicit);
  assert.deepEqual(explicit.renderOptions, { force: true, focus: true });
  assert.deepEqual(explicit.options.classes, []);

  const selected = open(null);
  assert.equal(selected.actor, token);

  canvas.tokens.controlled = [];
  const assigned = open();
  assert.equal(assigned.actor, character);

  const calls = [];
  game.modules.set("morelord-core", {
    active: true,
    api: {
      ui: {
        actorIdentity(identity) {
          calls.push(identity);
          return `<span class="ml-actor-identity">${identity.name}</span>`;
        }
      }
    }
  });
  const styled = open(given);
  assert.deepEqual(styled.options.classes, ["ml-window", "ml-character-export"]);
  const context = await styled._prepareContext({});
  assert.equal(context.core, true);
  assert.equal(context.identity, `<span class="ml-actor-identity">Given</span>`);
  assert.deepEqual(calls, [{ name: "Given", img: "Given.webp", actorUuid: "Actor.Given" }]);

  game.modules.set("morelord-core", {
    active: false,
    api: { ui: { actorIdentity: () => "unused" } }
  });
  const plain = open(given);
  const fallback = await plain._prepareContext({});
  assert.deepEqual(plain.options.classes, []);
  assert.equal(fallback.core, false);
  assert.equal(fallback.identity, "");
  assert.equal(fallback.name, "Given");
  assert.equal(fallback.img, "Given.webp");
});

test("export window template and strings name the actions", () => {
  const template = readFileSync(new URL("../templates/export-app.hbs", import.meta.url), "utf8");
  const strings = JSON.parse(readFileSync(new URL("../lang/en.json", import.meta.url), "utf8"));
  assert.equal(strings["morelord-character-export.window.title"], "Export Character");
  assert.equal(strings["morelord-character-export.window.export"], "Export JSON");
  assert.equal(strings["morelord-character-export.window.cancel"], "Cancel");
  assert.match(template, /class="ml-app ml-app-shell ml-character-export"/);
  assert.match(template, /class="ml-form-footer"/);
  assert.match(template, /\{\{\{identity\}\}\}/);
  assert.match(template, /<img src="\{\{img\}\}" alt="" width="48" height="48">/);
  assert.match(template, /\{\{name\}\}/);
  assert.match(template, /data-action="cancel"/);
  assert.match(template, /data-action="export"/);
  assert.match(template, /morelord-character-export\.window\.cancel/);
  assert.match(template, /morelord-character-export\.window\.export/);
});
