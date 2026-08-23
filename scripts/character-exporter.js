const MODULE_ID = "morelord-character-export";
const FORMAT_ID = "morelord-character";
const FORMAT_VERSION = 3;

const IMAGE_SETTINGS = {
  portrait: { maxDimension: 1024, quality: 0.85 },
  token: { maxDimension: 512, quality: 0.85 },
  item: { maxDimension: 256, quality: 0.82 }
};

const IMAGE_EXPORT_CONCURRENCY = 4;

/**
 * Export one Actor to the Morelord Character JSON format.
 *
 * The raw Actor document is retained unchanged under `actor`. Values prepared
 * by the D&D 5e system are copied separately under `derived`. Images are
 * embedded once in a shared asset library and referenced by stable export IDs.
 *
 * @param {Actor} actor Actor to export.
 * @returns {Promise<object>} Portable export payload.
 */
export async function buildCharacterExport(actor) {
  assertExportableActor(actor);

  // Export the source representation so embedded DataModel collections (most
  // importantly D&D5e item activities) remain plain serializable objects.
  // Prepared values are captured separately in `derived` below.
  const actorData = actor.toObject(true);
  serializeItemActivities(actor, actorData);
  const derived = buildDerivedSnapshot(actor);
  const assets = await buildImageAssets(actor);

  return {
    format: FORMAT_ID,
    formatVersion: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    source: {
      module: MODULE_ID,
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? null,
      foundryVersion: game.version ?? null,
      foundryGeneration:
        game.release?.generation ?? (Number.parseInt(game.version, 10) || null),
      systemId: game.system.id ?? null,
      systemVersion: game.system.version ?? null,
      worldId: game.world.id ?? null
    },
    actor: actorData,
    derived,
    assets
  };
}

/**
 * D&D5e 5.3 stores item activities in an ActivityCollection. Its documented
 * `toObject(source)` method returns the contained activities as plain objects;
 * restore those objects to the keyed shape used by the ActivitiesField source.
 *
 * @param {Actor} actor Prepared Actor document.
 * @param {object} actorData Serializable Actor source data.
 */
function serializeItemActivities(actor, actorData) {
  const exportedItems = new Map(
    (actorData.items ?? []).map((item) => [item._id ?? item.id, item])
  );

  for (const item of actor.items) {
    const exportedItem = exportedItems.get(item.id);
    if (!exportedItem?.system) continue;

    const activities = item.system?.activities;
    if (typeof activities?.toObject !== "function") continue;

    exportedItem.system.activities = Object.fromEntries(
      activities.toObject(true).map((activity) => {
        const id = activity._id ?? activity.id;
        if (!id) throw new Error(`Unable to identify an activity on ${item.name}.`);
        return [id, activity];
      })
    );
  }
}

/**
 * Build and download an export for an Actor.
 *
 * @param {Actor} actor Actor to export.
 * @returns {Promise<object>} The exported payload.
 */
export async function exportCharacter(actor) {
  const payload = await buildCharacterExport(actor);
  const filename = `${sanitizeFilename(actor.name)}.morelord-character.json`;
  const json = JSON.stringify(payload, null, 2);

  saveDataToFile(json, "application/json", filename);
  ui.notifications.info(`Exported ${actor.name} to ${filename}.`);

  return payload;
}

/**
 * Return the Actor represented by an ApplicationV2 sheet.
 *
 * @param {object} application Foundry application instance.
 * @returns {Actor|null}
 */
export function getActorFromApplication(application) {
  const candidate =
    application?.actor ??
    application?.document ??
    application?.object ??
    application?.options?.document ??
    null;

  return candidate?.documentName === "Actor" ? candidate : null;
}

/**
 * Whether the Actor should receive the export command.
 *
 * @param {Actor|null} actor Candidate Actor.
 * @returns {boolean}
 */
export function isExportableActor(actor) {
  if (!actor || actor.documentName !== "Actor") return false;
  if (game.system.id !== "dnd5e") return false;
  if (actor.type !== "character") return false;
  return actor.testUserPermission(game.user, "OBSERVER");
}

function assertExportableActor(actor) {
  if (!isExportableActor(actor)) {
    throw new Error(
      "The selected document is not an exportable D&D 5e character Actor."
    );
  }
}

/**
 * Copy values already prepared by Foundry and the D&D 5e system.
 * No D&D rules calculations are reproduced here.
 *
 * @param {Actor} actor Prepared Actor document.
 * @returns {object}
 */
function buildDerivedSnapshot(actor) {
  const system = actor.system ?? {};
  const abilities = {};
  const skills = {};
  const tools = {};

  for (const [key, ability] of Object.entries(system.abilities ?? {})) {
    abilities[key] = compactObject({
      label: CONFIG.DND5E?.abilities?.[key]?.label ?? key,
      value: ability.value,
      modifier: ability.mod,
      proficiency: ability.proficient,
      save: firstDefined(ability.save?.total, ability.save),
      check: firstDefined(ability.check?.total, ability.check?.mod)
    });
  }

  for (const [key, skill] of Object.entries(system.skills ?? {})) {
    skills[key] = compactObject({
      label: CONFIG.DND5E?.skills?.[key]?.label ?? key,
      ability: skill.ability,
      proficiency: skill.value,
      modifier: firstDefined(skill.mod, skill.total),
      total: firstDefined(skill.total, skill.mod),
      passive: skill.passive
    });
  }

  for (const [key, tool] of Object.entries(system.tools ?? {})) {
    tools[key] = compactObject({
      label: CONFIG.DND5E?.toolProficiencies?.[key] ?? key,
      ability: tool.ability,
      proficiency: tool.value,
      modifier: firstDefined(tool.mod, tool.total),
      total: firstDefined(tool.total, tool.mod)
    });
  }

  const classes = actor.items
    .filter((item) => item.type === "class")
    .map((item) => ({
      id: item.id,
      name: item.name,
      identifier: item.system?.identifier ?? null,
      levels: Number(item.system?.levels ?? 0),
      hitDie: item.system?.hd?.denomination ?? null,
      spellcastingProgression: item.system?.spellcasting?.progression ?? null
    }));

  const totalLevel = firstDefined(
    system.details?.level,
    system.details?.level?.value,
    classes.reduce((total, cls) => total + cls.levels, 0)
  );

  return compactObject({
    name: actor.name,
    level: totalLevel,
    classes,
    proficiencyBonus: system.attributes?.prof,
    armorClass: firstDefined(
      system.attributes?.ac?.value,
      system.attributes?.ac?.flat
    ),
    hitPoints: compactObject({
      value: system.attributes?.hp?.value,
      max: system.attributes?.hp?.max,
      temporary: system.attributes?.hp?.temp,
      temporaryMax: system.attributes?.hp?.tempmax
    }),
    initiative: compactObject({
      total: firstDefined(
        system.attributes?.init?.total,
        system.attributes?.init?.mod
      ),
      modifier: firstDefined(
        system.attributes?.init?.mod,
        system.attributes?.init?.total
      ),
      bonus: system.attributes?.init?.bonus
    }),
    movement: cloneSerializable(system.attributes?.movement ?? {}),
    senses: cloneSerializable(system.attributes?.senses ?? {}),
    abilities,
    skills,
    tools,
    passivePerception: system.skills?.prc?.passive,
    spellcasting: compactObject({
      ability: system.attributes?.spellcasting,
      modifier: system.attributes?.spellmod,
      attackBonus: firstDefined(
        system.attributes?.spell?.attack,
        system.bonuses?.spell?.attack
      ),
      saveDC: firstDefined(
        system.attributes?.spelldc,
        system.attributes?.spell?.dc
      ),
      slots: cloneSerializable(system.spells ?? {})
    })
  });
}

/**
 * Build a shared, deduplicated image library for all character-sheet images.
 *
 * @param {Actor} actor Prepared Actor document.
 * @returns {Promise<object>}
 */
async function buildImageAssets(actor) {
  const registrations = new Map();
  const references = {
    actor: {
      portrait: null,
      prototypeToken: null
    },
    items: {}
  };

  const register = (path, settings) => {
    if (!path) return null;

    const normalizedPath = String(path);
    let registration = registrations.get(normalizedPath);

    if (!registration) {
      registration = {
        id: `image-${registrations.size + 1}`,
        path: normalizedPath,
        maxDimension: settings.maxDimension,
        quality: settings.quality
      };
      registrations.set(normalizedPath, registration);
    } else {
      registration.maxDimension = Math.max(
        registration.maxDimension,
        settings.maxDimension
      );
      registration.quality = Math.max(registration.quality, settings.quality);
    }

    return registration.id;
  };

  references.actor.portrait = register(actor.img, IMAGE_SETTINGS.portrait);
  references.actor.prototypeToken = register(
    actor.prototypeToken?.texture?.src,
    IMAGE_SETTINGS.token
  );

  for (const item of actor.items) {
    const assetId = register(item.img, IMAGE_SETTINGS.item);
    if (assetId) references.items[item.id] = assetId;
  }

  const registrationList = Array.from(registrations.values());
  const exportedAssets = await mapWithConcurrency(
    registrationList,
    IMAGE_EXPORT_CONCURRENCY,
    async (registration) => [
      registration.id,
      await exportImageAsset(
        registration.path,
        registration.maxDimension,
        registration.quality
      )
    ]
  );

  return {
    images: Object.fromEntries(exportedAssets),
    references,
    summary: {
      requested: registrationList.length,
      embedded: exportedAssets.filter(([, asset]) => asset.embedded).length,
      failed: exportedAssets.filter(([, asset]) => !asset.embedded).length
    }
  };
}

async function exportImageAsset(path, maxDimension, quality) {
  if (!path) return emptyImageAsset(null);

  if (path.startsWith("data:")) {
    try {
      const response = await fetch(path);
      const blob = await response.blob();
      return await optimizeImageBlob(blob, path, maxDimension, quality);
    } catch (error) {
      return {
        path,
        originalMimeType: getDataUrlMimeType(path),
        mimeType: getDataUrlMimeType(path),
        data: path,
        embedded: true,
        optimized: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  try {
    const response = await fetch(path, { credentials: "same-origin" });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ${response.statusText}`.trim()
      );
    }

    return await optimizeImageBlob(
      await response.blob(),
      path,
      maxDimension,
      quality
    );
  } catch (error) {
    console.warn(`${MODULE_ID} | Could not embed image asset`, path, error);
    return {
      ...emptyImageAsset(path),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function optimizeImageBlob(blob, path, maxDimension, quality) {
  const sourceUrl = URL.createObjectURL(blob);

  try {
    const image = await loadImage(sourceUrl);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    const scale = Math.min(
      1,
      maxDimension / Math.max(originalWidth, originalHeight)
    );
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is unavailable.");

    context.drawImage(image, 0, 0, width, height);

    const optimizedBlob = await canvasToBlob(
      canvas,
      "image/webp",
      quality
    );
    const outputBlob = optimizedBlob ?? blob;
    const data = await blobToDataUrl(outputBlob);

    return {
      path,
      originalMimeType: blob.type || null,
      mimeType: outputBlob.type || getDataUrlMimeType(data),
      data,
      embedded: true,
      optimized: outputBlob !== blob,
      originalWidth,
      originalHeight,
      width: outputBlob !== blob ? width : originalWidth,
      height: outputBlob !== blob ? height : originalHeight,
      originalBytes: blob.size,
      bytes: outputBlob.size,
      error: null
    };
  } catch (error) {
    console.warn(
      `${MODULE_ID} | Could not optimize image; embedding original`,
      path,
      error
    );
    const data = await blobToDataUrl(blob);

    return {
      path,
      originalMimeType: blob.type || null,
      mimeType: blob.type || getDataUrlMimeType(data),
      data,
      embedded: true,
      optimized: false,
      originalBytes: blob.size,
      bytes: blob.size,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function emptyImageAsset(path) {
  return {
    path,
    originalMimeType: null,
    mimeType: null,
    data: null,
    embedded: false,
    optimized: false,
    error: null
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener(
      "error",
      () => reject(new Error("Unable to decode image.")),
      { once: true }
    );
    image.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener(
      "error",
      () => reject(reader.error ?? new Error("Unable to read image data."))
    );
    reader.readAsDataURL(blob);
  });
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) return;
      results[index] = await mapper(values[index], index);
    }
  };

  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return results;
}

function getDataUrlMimeType(value) {
  const match = /^data:([^;,]+)/i.exec(value);
  return match?.[1] ?? null;
}

function firstDefined(...values) {
  return values.find(
    (value) => value !== undefined && value !== null
  );
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function cloneSerializable(value) {
  if (value === undefined || value === null) return value;
  return foundry.utils.deepClone(value);
}

function sanitizeFilename(value) {
  const safe = String(value ?? "character")
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .replace(/ /g, "-")
    .toLowerCase();

  return safe || "character";
}
