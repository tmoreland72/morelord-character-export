import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("exports preserve omitted values, image sharing, and image failure fallbacks", async () => {
  const source = readFileSync(new URL("../scripts/character-exporter.js", import.meta.url), "utf8");
  const original = new Blob(["original"], { type: "image/png" });
  const optimized = new Blob(["optimized"], { type: "image/webp" });
  let failure = null;
  const requests = [];
  const context = vm.createContext({
    game: { system: { id: "dnd5e" }, modules: new Map(), world: {}, version: "14" },
    CONFIG: { DND5E: {} }, foundry: { utils: { deepClone: structuredClone } },
    console: { warn() {} }, URL,
    fetch: async (path, options) => {
      requests.push({ path, options });
      if (failure === "fetch") throw new Error("Fetch failed");
      return { ok: failure !== "http", status: 404, statusText: "Not Found", blob: async () => original };
    },
    Image: class {
      naturalWidth = 64;
      naturalHeight = 32;
      addEventListener(name, callback) { this[name] = callback; }
      set src(value) { if (failure === "decode") this.error(); else this.load(); }
    },
    FileReader: class {
      addEventListener(name, callback) { this[name] = callback; }
      readAsDataURL(blob) { this.result = `data:${blob.type};base64,test`; this.load(); }
    },
    document: { createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toBlob: callback => callback(failure === "encode" ? null : optimized)
    }) }
  });
  vm.runInContext(source.replaceAll("export async function", "async function").replaceAll("export function", "function"), context);
  const actor = {
    documentName: "Actor", type: "character", name: "Test", testUserPermission: () => true,
    system: { skills: { prc: { mod: 0, total: null }, arc: { mod: null, total: null } } },
    img: "portrait.png", prototypeToken: { texture: { src: "portrait.png" } },
    items: [{ id: "item", img: "portrait.png", system: {} }], toObject: () => ({ items: [] })
  };
  const build = () => context.buildCharacterExport(actor);
  const payload = await build();
  assert.equal(payload.derived.skills.prc.total, 0);
  assert.equal("total" in payload.derived.skills.arc, false);
  assert.equal(payload.assets.summary.requested, 1);
  assert.equal(payload.assets.references.items.item, payload.assets.references.actor.portrait);
  assert.equal(payload.assets.references.actor.prototypeToken, payload.assets.references.actor.portrait);
  assert.equal(payload.assets.images["image-1"].optimized, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.credentials, "same-origin");
  for (failure of ["decode", "encode", "fetch", "http"]) {
    const asset = (await build()).assets.images["image-1"];
    assert.equal(asset.optimized, false);
    assert.equal(asset.embedded, ["decode", "encode"].includes(failure));
  }
  actor.img = "data:image/png;base64,original";
  actor.prototypeToken = null;
  actor.items = [];
  for (failure of [null, "fetch"]) {
    const asset = (await build()).assets.images["image-1"];
    assert.equal(asset.embedded, true);
    assert.equal(asset.optimized, failure === null);
    if (failure) assert.equal(asset.data, actor.img);
    assert.equal(requests.at(-1).options, undefined);
  }
  actor.testUserPermission = () => false;
  await assert.rejects(build(), /not an exportable/);
});
