// Registries used by the @minecraft/server mock: vanilla data from the
// bedrock-samples reference for the exact target build, plus our own pack
// files (items, entities). Everything is loaded lazily and cached.
//
// Reference location: env PAS_VANILLA_REF, default = the scratchpad clone of
// Mojang bedrock-samples tag v1.21.0.26-preview (see docs/SPEC.md).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const BP_DIR = path.join(REPO_ROOT, "addon", "behavior_pack");
export const RP_DIR = path.join(REPO_ROOT, "addon", "resource_pack");

export const DEFAULT_REF =
  "/tmp/claude-0/-home-user-my-first-website-/6f33ccbb-4073-57f5-b83c-87aab56fa441/scratchpad/ref/bedrock-samples-1.21.0.26";

export function refPath() {
  return process.env.PAS_VANILLA_REF || DEFAULT_REF;
}

/** True when the vanilla reference (mojang-blocks.json) is available. */
export function hasVanillaRef() {
  return fs.existsSync(path.join(refPath(), "metadata", "vanilladata_modules", "mojang-blocks.json"));
}

// ---------------------------------------------------------------------------
// Lenient JSON (vanilla files contain comments and trailing commas)
// ---------------------------------------------------------------------------

/** Strip // and /* *\/ comments outside strings and trailing commas. */
export function stripJsonComments(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  let inStr = false;
  while (i < n) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') {
      inStr = true;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      const j = src.indexOf("\n", i);
      i = j < 0 ? n : j;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      const j = src.indexOf("*/", i + 2);
      i = j < 0 ? n : j + 2;
      continue;
    }
    out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

export function readJsonLenient(file) {
  let s = fs.readFileSync(file, "utf8");
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return JSON.parse(stripJsonComments(s));
}

export function readJsonStrict(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function listJson(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...listJson(p));
    else if (ent.name.endsWith(".json")) out.push(p);
  }
  return out.sort();
}

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

/** Drop cached registries (e.g. after a test changed PAS_VANILLA_REF). */
export function clearRegistryCache() {
  cache.clear();
}

export function normalizeId(id) {
  if (typeof id !== "string") return id;
  return id.includes(":") ? id : `minecraft:${id}`;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * @returns {{available: boolean, blocks: Map<string, {name: string, props: {name: string, type: string, values: any[]}[]}>}}
 */
export function blockRegistry() {
  return cached("blocks", () => {
    const file = path.join(refPath(), "metadata", "vanilladata_modules", "mojang-blocks.json");
    const blocks = new Map();
    if (!fs.existsSync(file)) return { available: false, blocks };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    const props = new Map();
    for (const p of d.block_properties) props.set(p.name, { name: p.name, type: p.type, values: p.values.map((v) => v.value) });
    for (const b of d.data_items) {
      blocks.set(b.name, { name: b.name, props: (b.properties || []).map((p) => props.get(p.name)) });
    }
    return { available: true, blocks };
  });
}

/** Every block state type (BlockStates.getAll()). */
export function blockStateTypes() {
  return cached("blockStateTypes", () => {
    const file = path.join(refPath(), "metadata", "vanilladata_modules", "mojang-blocks.json");
    if (!fs.existsSync(file)) return [];
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return d.block_properties.map((p) => ({ id: p.name, validValues: p.values.map((v) => v.value) }));
  });
}

export const LIQUIDS = new Set(["minecraft:water", "minecraft:flowing_water", "minecraft:lava", "minecraft:flowing_lava"]);

const PASSABLE_RE = new RegExp(
  "^minecraft:(" +
    [
      "air",
      "light_block",
      "structure_void",
      "short_grass",
      "tall_grass",
      "fern",
      "large_fern",
      "deadbush",
      "dead_bush",
      "seagrass",
      "kelp",
      "vine",
      "weeping_vines",
      "twisting_vines",
      "cave_vines.*",
      "glow_lichen",
      "sculk_vein",
      ".*torch",
      "lever",
      ".*_button",
      ".*_pressure_plate",
      "trip_wire",
      "tripwire_hook",
      "redstone_wire",
      "rail",
      "golden_rail",
      "detector_rail",
      "activator_rail",
      ".*sapling",
      "wheat",
      "carrots",
      "potatoes",
      "beetroot",
      "melon_stem",
      "pumpkin_stem",
      "torchflower_crop",
      "pitcher_crop",
      "sweet_berry_bush",
      "reeds",
      "web",
      "fire",
      "soul_fire",
      "poppy",
      "dandelion",
      "red_flower",
      "yellow_flower",
      "blue_orchid",
      "allium",
      "azure_bluet",
      ".*_tulip",
      "oxeye_daisy",
      "cornflower",
      "lily_of_the_valley",
      "wither_rose",
      "torchflower",
      "pitcher_plant",
      "sunflower",
      "lilac",
      "rose_bush",
      "peony",
      "double_plant",
      "pink_petals",
      "brown_mushroom",
      "red_mushroom",
      "crimson_fungus",
      "warped_fungus",
      "crimson_roots",
      "warped_roots",
      "nether_sprouts",
      "hanging_roots",
      "spore_blossom",
      "snow_layer",
      ".*standing_sign",
      ".*wall_sign",
      ".*_hanging_sign",
      "standing_banner",
      "wall_banner",
      "nether_wart",
      "frog_spawn",
      ".*coral_fan.*",
      ".*coral_wall_fan.*",
      "(dead_)?(tube|brain|bubble|fire|horn)_coral",
    ].join("|") +
    ")$",
);

const passableOverrides = new Map();

/** Blocks without collision (skipped by getBlockFromRay unless includePassableBlocks). */
export function isPassable(name) {
  if (passableOverrides.has(name)) return passableOverrides.get(name);
  return PASSABLE_RE.test(name);
}
export function setPassable(name, value) {
  passableOverrides.set(normalizeId(name), !!value);
}

const CONTAINER_SIZES = new Map([
  ["minecraft:chest", 27],
  ["minecraft:trapped_chest", 27],
  ["minecraft:barrel", 27],
  ["minecraft:hopper", 5],
  ["minecraft:dispenser", 9],
  ["minecraft:dropper", 9],
  ["minecraft:furnace", 3],
  ["minecraft:lit_furnace", 3],
  ["minecraft:blast_furnace", 3],
  ["minecraft:lit_blast_furnace", 3],
  ["minecraft:smoker", 3],
  ["minecraft:lit_smoker", 3],
  ["minecraft:brewing_stand", 5],
]);

/** Inventory size for container blocks, or 0. */
export function containerSize(name) {
  if (CONTAINER_SIZES.has(name)) return CONTAINER_SIZES.get(name);
  if (/^minecraft:(.*_)?shulker_box$/.test(name)) return 27;
  return 0;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** Our BP item definitions: id -> {maxStack, file, json}. */
export function addonItems() {
  return cached("addonItems", () => {
    const m = new Map();
    for (const f of listJson(path.join(BP_DIR, "items"))) {
      try {
        const j = readJsonStrict(f);
        const it = j["minecraft:item"];
        const id = it?.description?.identifier;
        if (!id) continue;
        const ms = it.components?.["minecraft:max_stack_size"];
        const maxStack = typeof ms === "number" ? ms : typeof ms?.value === "number" ? ms.value : 64;
        m.set(id, { maxStack, file: f, json: j });
      } catch {
        // malformed item file: tools/validate.py reports it
      }
    }
    return m;
  });
}

// Vanilla items that do not stack (subset; everything else defaults to 64).
const UNSTACKABLE_RE =
  /^minecraft:(.*_(sword|pickaxe|axe|shovel|hoe|helmet|chestplate|leggings|boots|horse_armor|boat|minecart|bucket)|bow|crossbow|trident|shield|elytra|totem_of_undying|shears|flint_and_steel|fishing_rod|carrot_on_a_stick|warped_fungus_on_a_stick|saddle|potion|splash_potion|lingering_potion|enchanted_book|writable_book|written_book|bed|cake|music_disc_.*|mushroom_stew|rabbit_stew|beetroot_soup|suspicious_stew|milk_bucket|bucket|spyglass|brush|mace|.*_smithing_template_unused)$/;
const STACK16_RE = /^minecraft:(ender_pearl|snowball|egg|.*_sign|.*_hanging_sign|honey_bottle|bucket|armor_stand|.*_banner|wind_charge_unused)$/;

/** @returns {{available: boolean, items: Set<string>}} */
export function vanillaItems() {
  return cached("vanillaItems", () => {
    const file = path.join(refPath(), "metadata", "vanilladata_modules", "mojang-items.json");
    const items = new Set();
    if (!fs.existsSync(file)) return { available: false, items };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const it of d.data_items) items.add(it.name);
    return { available: true, items };
  });
}

/** Item type known to the mock? (vanilla list + our items + extra registrations) */
export function isKnownItem(id) {
  const n = normalizeId(id);
  if (extraItems.has(n)) return true;
  if (addonItems().has(n)) return true;
  const v = vanillaItems();
  if (!v.available) return true; // no reference: accept anything
  return v.items.has(n);
}

export function itemMaxStack(id) {
  const n = normalizeId(id);
  if (extraItems.has(n)) return extraItems.get(n).maxStack;
  const a = addonItems().get(n);
  if (a) return a.maxStack;
  if (n === "minecraft:bucket") return 16;
  if (UNSTACKABLE_RE.test(n)) return 1;
  if (STACK16_RE.test(n)) return 16;
  return 64;
}

const extraItems = new Map();
/** Register an extra item type for tests. */
export function registerItemType(id, maxStack = 64) {
  extraItems.set(normalizeId(id), { maxStack });
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

export function vanillaEffects() {
  return cached("effects", () => {
    const file = path.join(refPath(), "metadata", "vanilladata_modules", "mojang-effects.json");
    if (!fs.existsSync(file)) return { available: false, effects: new Set() };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return { available: true, effects: new Set(d.data_items.map((e) => e.name)) };
  });
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export function vanillaEntityIds() {
  return cached("vanillaEntityIds", () => {
    const file = path.join(refPath(), "metadata", "vanilladata_modules", "mojang-entities.json");
    if (!fs.existsSync(file)) return { available: false, ids: new Set() };
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    return { available: true, ids: new Set(d.data_items.map((e) => normalizeId(e.name))) };
  });
}

function vanillaEntityFiles() {
  return cached("vanillaEntityFiles", () => {
    const m = new Map();
    for (const f of listJson(path.join(refPath(), "behavior_pack", "entities"))) {
      try {
        const j = readJsonLenient(f);
        const id = j["minecraft:entity"]?.description?.identifier;
        if (id) m.set(id, j);
      } catch {
        // ignore unparsable vanilla file
      }
    }
    return m;
  });
}

function addonEntityFiles() {
  return cached("addonEntityFiles", () => {
    const m = new Map();
    for (const f of listJson(path.join(BP_DIR, "entities"))) {
      try {
        const j = readJsonStrict(f);
        const id = j["minecraft:entity"]?.description?.identifier;
        if (id) m.set(id, { json: j, file: f });
      } catch (e) {
        m.set(`__error__${f}`, { error: String(e), file: f });
      }
    }
    return m;
  });
}

// Built-in fallback for pas:* entities, used only when addon/behavior_pack/entities
// has no definition for the type yet (SPEC §3).
const HORDE_HEALTH = {
  "pas:parasite": 12,
  "pas:infected_villager": 24,
  "pas:infected_cow": 16,
  "pas:infected_pig": 16,
  "pas:infected_sheep": 14,
  "pas:infected_chicken": 8,
  "pas:infected_human": 24,
};
const SPECIES = {
  "pas:infected_villager": "villager",
  "pas:infected_cow": "cow",
  "pas:infected_pig": "pig",
  "pas:infected_sheep": "sheep",
  "pas:infected_chicken": "chicken",
  "pas:infected_human": "human",
};

function fallbackPasDef(id) {
  if (!(id in HORDE_HEALTH)) return undefined;
  const families =
    id === "pas:parasite"
      ? ["pas_horde", "pas_parasite", "arthropod", "monster", "mob"]
      : ["pas_horde", "pas_infected", `pas_infected_${SPECIES[id]}`, "monster", "mob"];
  const hp = HORDE_HEALTH[id];
  const components = {
    "minecraft:type_family": { family: families },
    "minecraft:health": { value: hp, max: hp },
    "minecraft:persistent": {},
    "minecraft:nameable": {},
    "minecraft:damage_sensor": {
      triggers: [
        {
          on_damage: { filters: { test: "is_family", subject: "other", value: "pas_horde" } },
          deals_damage: false,
        },
      ],
    },
  };
  const groups = { "pas:hunting": {}, "pas:dormant": {} };
  const events = {
    "minecraft:entity_spawned": { add: { component_groups: ["pas:hunting"] } },
    "pas:become_dormant": { remove: { component_groups: ["pas:hunting"] }, add: { component_groups: ["pas:dormant"] } },
    "pas:become_active": { remove: { component_groups: ["pas:dormant"] }, add: { component_groups: ["pas:hunting"] } },
  };
  const indexed = (prefix, count, comp) => {
    for (let i = 0; i < count; i++) {
      groups[`${prefix}${i}`] = { [comp]: { value: i } };
      events[`${prefix.replace(/^pas:/, "pas:set_")}${i}`] = { add: { component_groups: [`${prefix}${i}`] } };
    }
  };
  if (id === "pas:parasite") events["pas:born"] = {};
  if (["pas:infected_villager", "pas:infected_cow", "pas:infected_pig", "pas:infected_sheep", "pas:infected_chicken"].includes(id)) {
    groups["pas:baby"] = { "minecraft:is_baby": {}, "minecraft:scale": { value: 0.5 } };
    events["pas:make_baby"] = { add: { component_groups: ["pas:baby"] } };
  }
  if (id === "pas:infected_villager") {
    indexed("pas:variant_", 15, "minecraft:variant");
    indexed("pas:mark_", 7, "minecraft:mark_variant");
    indexed("pas:skin_", 6, "minecraft:skin_id");
  }
  if (id === "pas:infected_cow") indexed("pas:variant_", 3, "minecraft:variant");
  if (id === "pas:infected_sheep") {
    indexed("pas:color_", 16, "minecraft:color");
    groups["pas:sheared"] = { "minecraft:is_sheared": {} };
    events["pas:set_sheared"] = { add: { component_groups: ["pas:sheared"] } };
  }
  return {
    format_version: "1.21.0",
    "minecraft:entity": {
      description: { identifier: id, is_spawnable: false, is_summonable: true },
      components,
      component_groups: groups,
      events,
    },
  };
}

/**
 * Entity definition for a type id.
 * @returns {{id: string, source: "addon"|"vanilla"|"fallback", components: object, groups: object, events: object, description: object} | undefined}
 */
export function entityDef(typeId) {
  const id = normalizeId(typeId);
  return cached(`entityDef:${id}`, () => {
    let json;
    let source;
    const addon = addonEntityFiles().get(id);
    if (addon?.json) {
      json = addon.json;
      source = "addon";
    } else if (id.startsWith("minecraft:")) {
      json = vanillaEntityFiles().get(id);
      source = "vanilla";
    } else {
      json = fallbackPasDef(id);
      source = "fallback";
    }
    if (!json) return undefined;
    const ent = json["minecraft:entity"];
    return {
      id,
      source,
      description: ent.description || {},
      components: ent.components || {},
      groups: ent.component_groups || {},
      events: ent.events || {},
    };
  });
}

/** Is `typeId` a spawnable/known entity type? */
export function isKnownEntityType(typeId) {
  const id = normalizeId(typeId);
  if (addonEntityFiles().has(id)) return true;
  if (fallbackPasDef(id)) return true;
  const v = vanillaEntityIds();
  if (!v.available) return id.startsWith("minecraft:") || id.includes(":");
  return v.ids.has(id);
}

/** Problems found while loading addon entity files (e.g. invalid JSON). */
export function addonEntityLoadErrors() {
  return [...addonEntityFiles().values()].filter((v) => v.error);
}

/** Path of a structure file for an identifier like "pas:luxury_base" (or "mystructure:x"). */
export function structureFile(identifier) {
  const [ns, name] = identifier.includes(":") ? identifier.split(":") : ["mystructure", identifier];
  const cands = [];
  if (ns === "mystructure") cands.push(path.join(BP_DIR, "structures", `${name}.mcstructure`));
  cands.push(path.join(BP_DIR, "structures", ns, `${name}.mcstructure`));
  return cands.find((p) => fs.existsSync(p));
}
