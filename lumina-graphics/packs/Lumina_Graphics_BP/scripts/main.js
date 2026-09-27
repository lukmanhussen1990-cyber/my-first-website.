// Lumina Graphics - ambient visual effects for Minecraft Bedrock (mobile friendly).
//
//  * Bloom glow around torches, lanterns, glowstone, froglights, ...
//  * Fireflies over grass at night
//  * Leaves drifting down from trees
//  * Sun / moon glints on water surfaces (biased toward the sun, like a reflection)
//  * Dust motes floating in daylight, particulate underwater
//  * Morning mist that rolls in before sunrise and burns off after (some days heavier)
//
// Only the stable @minecraft/server 1.11.0 API is used, so no experimental toggles are
// needed. Blocks around each player are scanned a small slice per tick, and the slice
// size adapts to how long scanning takes so weaker phones stay smooth.

import { world, system, WeatherType } from "@minecraft/server";

const SCAN_R = 12; // horizontal scan radius (blocks)
const SCAN_UP = 10; // blocks scanned above the feet
const SCAN_DOWN = 6; // blocks scanned below the feet
const SIDE = SCAN_R * 2 + 1;
const HEIGHT = SCAN_UP + SCAN_DOWN + 1;
const COLUMNS = SIDE * SIDE;
const VOLUME = COLUMNS * HEIGHT;
const NO_ROOF = -100000;

const MAX_LIGHTS = 40; // nearest light sources that get a glow
const MAX_LIGHT_CANDIDATES = 256;
const MAX_SPOTS = 160; // cached water / leaf / grass spots per player

const TARGET_MS = 2; // scanning time budget per tick
const MIN_BUDGET = 48;
const MAX_BUDGET = 600;

/** @type {Record<string, [number, number]>} */
const Y_RANGE = {
  "minecraft:overworld": [-64, 319],
  "minecraft:nether": [0, 127],
  "minecraft:the_end": [0, 255],
};

// typeId -> [glow kind, height of the light inside the block]
/** @type {Map<string, [string, number]>} */
const LIGHTS = new Map([
  ["minecraft:torch", ["warm", 0.62]],
  ["minecraft:lantern", ["warm", 0.4]],
  ["minecraft:campfire", ["warm", 0.4]],
  ["minecraft:lit_pumpkin", ["warm", 0.5]],
  ["minecraft:lit_redstone_lamp", ["warm", 0.5]],
  ["minecraft:lit_furnace", ["warm", 0.5]],
  ["minecraft:lit_blast_furnace", ["warm", 0.5]],
  ["minecraft:lit_smoker", ["warm", 0.5]],
  ["minecraft:fire", ["fire", 0.4]],
  ["minecraft:soul_torch", ["soul", 0.62]],
  ["minecraft:soul_lantern", ["soul", 0.4]],
  ["minecraft:soul_campfire", ["soul", 0.4]],
  ["minecraft:soul_fire", ["soul", 0.4]],
  ["minecraft:redstone_torch", ["red", 0.62]],
  ["minecraft:glowstone", ["gold", 0.5]],
  ["minecraft:shroomlight", ["gold", 0.5]],
  ["minecraft:ochre_froglight", ["gold", 0.5]],
  ["minecraft:sea_lantern", ["cool", 0.5]],
  ["minecraft:beacon", ["cool", 0.5]],
  ["minecraft:verdant_froglight", ["green", 0.5]],
  ["minecraft:pearlescent_froglight", ["pink", 0.5]],
  ["minecraft:end_rod", ["white", 0.5]],
  ["minecraft:crying_obsidian", ["purple", 0.5]],
  ["minecraft:amethyst_cluster", ["purple", 0.4]],
  ["minecraft:portal", ["portal", 0.5]],
  ["minecraft:magma", ["magma", 0.5]],
]);

const GROUND = new Set([
  "minecraft:grass_block",
  "minecraft:grass",
  "minecraft:moss_block",
  "minecraft:podzol",
  "minecraft:mycelium",
  "minecraft:mud",
]);

const PLANT_WORDS = [
  "short_grass", "tall_grass", "tallgrass", "fern", "flower", "tulip", "orchid", "allium",
  "bluet", "daisy", "poppy", "dandelion", "cornflower", "lily_of_the_valley", "rose_bush",
  "peony", "lilac", "double_plant", "sapling", "deadbush", "dead_bush", "sweet_berry",
  "pink_petals", "torch", "vine", "button", "rail", "lever",
];

/**
 * @typedef {{ air: boolean, water: boolean, plant: boolean, ground: boolean,
 *   occludes: boolean, leaf: string | null | undefined, light: [string, number] | undefined,
 *   litRule: string | undefined }} BlockClass
 */

/** @type {Map<string, BlockClass>} */
const classCache = new Map();

/**
 * Classifies a block type once; results are cached per typeId.
 * @param {string} typeId
 * @returns {BlockClass}
 */
function classify(typeId) {
  const cached = classCache.get(typeId);
  if (cached) return cached;
  const id = typeId.startsWith("minecraft:") ? typeId.slice(10) : typeId;
  const air = id === "air" || id === "light_block" || id === "structure_void";
  const water = id === "water" || id === "flowing_water";
  const ground = GROUND.has(typeId);
  const isLeaf = id.endsWith("leaves") || id === "leaves2" || id.endsWith("leaves_flowered");
  const plant = !air && !ground && !isLeaf && PLANT_WORDS.some((w) => id.includes(w));
  /** @type {string | null | undefined} */
  let leaf;
  if (isLeaf) {
    if (id.includes("cherry")) leaf = null; // vanilla already drops cherry petals
    else if (id.includes("birch")) leaf = "lumina:leaf_pale";
    else if (id.includes("spruce") || id.includes("dark_oak") || id.includes("mangrove")) leaf = "lumina:leaf_dark";
    else if (id === "leaves" || id === "leaves2") leaf = "state"; // legacy ids: look at the block state
    else leaf = "lumina:leaf";
  }
  /** @type {[string, number] | undefined} */
  let light = LIGHTS.get(typeId);
  /** @type {string | undefined} */
  let litRule;
  if (id === "campfire" || id === "soul_campfire") litRule = "extinguished";
  else if (id.endsWith("candle") || id.endsWith("candle_cake")) {
    light = ["candle", id.endsWith("cake") ? 0.75 : 0.45];
    litRule = "lit";
  } else if (id.endsWith("copper_bulb")) {
    light = ["warm", 0.5];
    litRule = "lit";
  }
  const c = {
    air,
    water,
    plant,
    ground,
    occludes: !air && !plant,
    leaf,
    light,
    litRule,
  };
  classCache.set(typeId, c);
  return c;
}

/** Returns true if a light block is currently switched on. */
function isLit(/** @type {import("@minecraft/server").Block} */ block, /** @type {string | undefined} */ rule) {
  if (!rule) return true;
  try {
    const state = block.permutation.getState(rule);
    return rule === "extinguished" ? state !== true : state === true;
  } catch {
    return true;
  }
}

/** Resolves the leaf particle for legacy `leaves` / `leaves2` blocks from their state. */
function legacyLeaf(/** @type {import("@minecraft/server").Block} */ block) {
  try {
    const perm = block.permutation;
    const kind = perm.getState("old_leaf_type") ?? perm.getState("new_leaf_type");
    if (kind === "birch") return "lumina:leaf_pale";
    if (kind === "spruce" || kind === "dark_oak") return "lumina:leaf_dark";
  } catch {
    // fall through
  }
  return "lumina:leaf";
}

/**
 * @typedef {{ x: number, y: number, z: number }} Spot
 * @typedef {{ x: number, y: number, z: number, bx: number, by: number, bz: number,
 *   kind: string, typeId: string }} LightSpot
 * @typedef {{ x: number, y: number, z: number, id: string }} LeafSpot
 */

class PlayerState {
  constructor() {
    this.dimId = "";
    this.ox = 0;
    this.oy = 0;
    this.oz = 0;
    this.cursor = 0;
    /** @type {BlockClass | undefined} */
    this.above = undefined;
    /** @type {import("@minecraft/server").Block | undefined} */
    this.aboveBlock = undefined;
    this.open = true;
    // scan in progress
    /** @type {LightSpot[]} */ this.nLights = [];
    /** @type {Spot[]} */ this.nWater = [];
    /** @type {LeafSpot[]} */ this.nLeaves = [];
    /** @type {Spot[]} */ this.nGrass = [];
    this.nTop = new Int32Array(COLUMNS);
    this.seen = { lights: 0, water: 0, leaves: 0, grass: 0 };
    // last completed scan
    this.ready = false;
    this.doneDim = "";
    this.doneOx = 0;
    this.doneOz = 0;
    /** @type {LightSpot[]} */ this.lights = [];
    /** @type {Spot[]} */ this.water = [];
    /** @type {LeafSpot[]} */ this.leaves = [];
    /** @type {Spot[]} */ this.grass = [];
    this.top = new Int32Array(COLUMNS).fill(NO_ROOF);
    this.mist = -1; // -1 forces a fog reset the first time we see the player
  }
}

/** @type {Map<string, PlayerState>} */
const states = new Map();
let budget = 256;
let avgMs = 0;
let tick = 0;
let raining = false;

/** Keeps a uniform random sample of at most `max` items. */
function sample(/** @type {any[]} */ arr, /** @type {number} */ seen, /** @type {any} */ item, /** @type {number} */ max) {
  if (arr.length < max) arr.push(item);
  else {
    const j = Math.floor(Math.random() * seen);
    if (j < max) arr[j] = item;
  }
}

function pick(/** @type {any[]} */ arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function startScan(/** @type {PlayerState} */ st, /** @type {import("@minecraft/server").Player} */ player) {
  const loc = player.location;
  st.dimId = player.dimension.id;
  st.ox = Math.floor(loc.x);
  st.oy = Math.floor(loc.y);
  st.oz = Math.floor(loc.z);
  st.cursor = 0;
  st.nLights = [];
  st.nWater = [];
  st.nLeaves = [];
  st.nGrass = [];
  st.nTop.fill(NO_ROOF);
  st.seen = { lights: 0, water: 0, leaves: 0, grass: 0 };
}

function finishScan(/** @type {PlayerState} */ st, /** @type {import("@minecraft/server").Player} */ player) {
  const { x, y, z } = player.location;
  const d2 = (/** @type {LightSpot} */ l) => (l.bx - x) ** 2 + (l.by - y) ** 2 + (l.bz - z) ** 2;
  st.lights = st.nLights.sort((a, b) => d2(a) - d2(b)).slice(0, MAX_LIGHTS);
  st.water = st.nWater;
  st.leaves = st.nLeaves;
  st.grass = st.nGrass;
  const t = st.top;
  st.top = st.nTop;
  st.nTop = t;
  st.doneDim = st.dimId;
  st.doneOx = st.ox;
  st.doneOz = st.oz;
  st.ready = true;
}

/** Scans up to `count` blocks, column by column from the top down. */
function scanStep(/** @type {PlayerState} */ st, /** @type {import("@minecraft/server").Player} */ player, /** @type {number} */ count) {
  const dim = player.dimension;
  if (dim.id !== st.dimId) {
    st.ready = false;
    startScan(st, player);
  }
  const [minY, maxY] = Y_RANGE[dim.id] ?? [-64, 319];
  for (let n = 0; n < count; n++) {
    if (st.cursor >= VOLUME) {
      finishScan(st, player);
      startScan(st, player);
      return;
    }
    const col = (st.cursor / HEIGHT) | 0;
    const i = st.cursor - col * HEIGHT;
    st.cursor++;
    if (i === 0) {
      st.above = undefined;
      st.open = true;
    }
    const y = st.oy + SCAN_UP - i;
    if (y > maxY || y < minY) {
      st.above = undefined;
      continue;
    }
    const x = st.ox - SCAN_R + (col % SIDE);
    const z = st.oz - SCAN_R + ((col / SIDE) | 0);
    let block;
    try {
      block = dim.getBlock({ x, y, z });
    } catch {
      block = undefined;
    }
    if (!block) {
      st.above = undefined;
      continue;
    }
    const c = classify(block.typeId);
    const above = st.above;

    if (c.light && isLit(block, c.litRule)) {
      st.seen.lights++;
      sample(st.nLights, st.seen.lights, {
        x, y: y + c.light[1], z, bx: x, by: y, bz: z, kind: c.light[0], typeId: block.typeId,
      }, MAX_LIGHT_CANDIDATES);
    }
    if (above) {
      if (c.water && above.air && st.open) {
        st.seen.water++;
        sample(st.nWater, st.seen.water, { x, y, z }, MAX_SPOTS);
      } else if (c.air && above.leaf && st.aboveBlock) {
        const id = above.leaf === "state" ? legacyLeaf(st.aboveBlock) : above.leaf;
        st.seen.leaves++;
        sample(st.nLeaves, st.seen.leaves, { x, y: y + 0.92, z, id }, MAX_SPOTS);
      } else if (c.ground && (above.air || above.plant)) {
        st.seen.grass++;
        sample(st.nGrass, st.seen.grass, { x, y: y + 1, z }, MAX_SPOTS);
      }
    }
    if (st.open && c.occludes) {
      st.nTop[col] = y;
      st.open = false;
    }
    st.above = c;
    st.aboveBlock = block;
  }
}

/** True if the sky is visible from this position (based on the last scan). */
function skyVisible(/** @type {PlayerState} */ st, /** @type {import("@minecraft/server").Vector3} */ loc) {
  if (!st.ready) return false;
  if (st.doneDim === "minecraft:overworld" && loc.y < 50) return false;
  const cx = Math.floor(loc.x) - st.doneOx + SCAN_R;
  const cz = Math.floor(loc.z) - st.doneOz + SCAN_R;
  if (cx < 0 || cz < 0 || cx >= SIDE || cz >= SIDE) return true;
  return loc.y > st.top[cz * SIDE + cx];
}

function spawn(/** @type {import("@minecraft/server").Dimension} */ dim, /** @type {string} */ id, /** @type {import("@minecraft/server").Vector3} */ loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch {
    // chunk unloaded or particle missing: ignore
  }
}

function blockType(/** @type {import("@minecraft/server").Dimension} */ dim, /** @type {import("@minecraft/server").Vector3} */ loc) {
  try {
    return dim.getBlock(loc)?.typeId;
  } catch {
    return undefined;
  }
}

/** Re-spawns a glow on every nearby light; each glow lives 1.3 s and cross-fades. */
function emitGlows(/** @type {import("@minecraft/server").Player[]} */ players) {
  const done = new Set();
  for (const player of players) {
    const st = states.get(player.id);
    if (!st || !st.ready) continue;
    const dim = player.dimension;
    if (dim.id !== st.doneDim) continue;
    for (const l of st.lights) {
      const key = `${dim.id}|${l.bx}|${l.by}|${l.bz}`;
      if (done.has(key)) continue;
      done.add(key);
      if (blockType(dim, { x: l.bx, y: l.by, z: l.bz }) !== l.typeId) continue;
      spawn(dim, `lumina:glow_${l.kind}`, { x: l.bx + 0.5, y: l.y, z: l.bz + 0.5 });
    }
  }
}

/** Fireflies, leaves, glints, dust and underwater particles around one player. */
function emitAmbient(/** @type {import("@minecraft/server").Player} */ player, /** @type {PlayerState} */ st, /** @type {number} */ time) {
  if (!st.ready) return;
  const dim = player.dimension;
  if (dim.id !== st.doneDim) return;
  const overworld = dim.id === "minecraft:overworld";
  const head = player.getHeadLocation();
  const headType = blockType(dim, { x: Math.floor(head.x), y: Math.floor(head.y), z: Math.floor(head.z) });

  if (headType === "minecraft:water" || headType === "minecraft:flowing_water") {
    for (let i = 0; i < 2; i++) {
      const p = { x: head.x + (Math.random() - 0.5) * 7, y: head.y + (Math.random() - 0.5) * 4, z: head.z + (Math.random() - 0.5) * 7 };
      const t = blockType(dim, { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) });
      if (t === "minecraft:water" || t === "minecraft:flowing_water") spawn(dim, "lumina:plankton", p);
    }
    return;
  }

  // falling leaves (a bit windier in the rain)
  if (st.leaves.length && Math.random() < (raining ? 1 : 0.7)) {
    const l = pick(st.leaves);
    spawn(dim, l.id, { x: l.x + 0.5, y: l.y, z: l.z + 0.5 });
  }
  if (!overworld || raining) return;

  const day = time < 12300 || time > 23700;
  const golden = (time > 10800 && time < 13000) || time > 22600 || time < 900;
  const night = time > 13200 && time < 22800;
  // sun travels east (+x) -> west (-x); the moon is opposite
  const sunX = Math.cos((time / 24000) * 2 * Math.PI);

  // water glints, mostly on the side facing the sun / moon (fake reflections)
  if (st.water.length && (day || night)) {
    const lightX = day ? sunX : -sunX;
    const count = day ? 4 : Math.random() < 0.5 ? 1 : 0;
    const id = night ? "lumina:water_glint_moon" : golden ? "lumina:water_glint_warm" : "lumina:water_glint";
    for (let i = 0; i < count; i++) {
      let best = pick(st.water);
      if (Math.random() < 0.75) {
        let bestScore = -Infinity;
        for (let k = 0; k < 4; k++) {
          const w = pick(st.water);
          const dx = w.x + 0.5 - head.x;
          const dz = w.z + 0.5 - head.z;
          const score = (dx * lightX) / (Math.sqrt(dx * dx + dz * dz) + 1) + Math.random() * 0.3;
          if (score > bestScore) {
            bestScore = score;
            best = w;
          }
        }
      }
      spawn(dim, id, { x: best.x + 0.5, y: best.y + 0.93, z: best.z + 0.5 });
    }
  }

  // fireflies over grass at night
  if (night && st.grass.length && Math.random() < 0.55) {
    const g = pick(st.grass);
    spawn(dim, "lumina:firefly", { x: g.x + 0.5, y: g.y + 0.4 + Math.random() * 1.2, z: g.z + 0.5 });
  }

  // dust motes floating in daylight
  if (day && Math.random() < 0.7 && skyVisible(st, head)) {
    const p = { x: head.x + (Math.random() - 0.5) * 10, y: head.y - 1 + Math.random() * 4, z: head.z + (Math.random() - 0.5) * 10 };
    if (blockType(dim, { x: Math.floor(p.x), y: Math.floor(p.y), z: Math.floor(p.z) }) === "minecraft:air") {
      spawn(dim, "lumina:dust", p);
    }
  }
}

function hashDay(/** @type {number} */ day) {
  let h = (day * 2654435761) >>> 0;
  h ^= h >>> 15;
  return h % 5;
}

/** Target mist level 0..4: rolls in before sunrise, burns off by mid-morning. */
function mistLevel(/** @type {number} */ time) {
  if (raining) return 0;
  let day = 0;
  try {
    day = world.getDay() + (time >= 18000 ? 1 : 0);
  } catch {
    // older runtime: every morning is the same
  }
  const max = hashDay(day) < 2 ? 4 : 2; // ~40% of mornings are properly foggy
  let f = 0;
  if (time >= 21000) f = Math.min(1, (time - 21000) / 1800);
  else if (time < 1500) f = 1;
  else if (time < 3500) f = 1 - (time - 1500) / 2000;
  return Math.round(f * max);
}

function updateMist(/** @type {import("@minecraft/server").Player} */ player, /** @type {PlayerState} */ st, /** @type {number} */ target) {
  if (player.dimension.id !== "minecraft:overworld") target = 0;
  if (target === st.mist) return;
  st.mist = target;
  player.runCommandAsync("fog @s remove lumina_mist").catch(() => {});
  if (target > 0) player.runCommandAsync(`fog @s push lumina:mist_${target} lumina_mist`).catch(() => {});
}

function refreshWeather() {
  // Dimension.getWeather only exists in newer runtimes; weatherChange covers the rest.
  try {
    const overworld = /** @type {any} */ (world.getDimension("overworld"));
    if (typeof overworld.getWeather === "function") raining = overworld.getWeather() !== WeatherType.Clear;
  } catch {
    // keep the last known value
  }
}

world.afterEvents.weatherChange.subscribe((e) => {
  raining = e.newWeather !== WeatherType.Clear;
});

world.afterEvents.playerLeave.subscribe((e) => {
  states.delete(e.playerId);
});

world.afterEvents.playerSpawn.subscribe((e) => {
  const st = states.get(e.player.id);
  if (st) st.mist = -1; // re-apply mist after respawning
});

system.runInterval(() => {
  tick++;
  const players = world.getAllPlayers();
  if (!players.length) return;
  const time = world.getTimeOfDay();

  // adaptive block scanning, shared between players
  const t0 = Date.now();
  const per = Math.max(24, Math.floor(budget / players.length));
  for (const player of players) {
    try {
      let st = states.get(player.id);
      if (!st) {
        st = new PlayerState();
        states.set(player.id, st);
        startScan(st, player);
      }
      scanStep(st, player, per);
    } catch {
      // player may have just left; ignore
    }
  }
  avgMs = avgMs * 0.9 + (Date.now() - t0) * 0.1;
  if (avgMs > TARGET_MS * 1.5) budget = Math.max(MIN_BUDGET, budget * 0.85);
  else if (avgMs < TARGET_MS * 0.6) budget = Math.min(MAX_BUDGET, budget * 1.04 + 2);

  if (tick % 20 === 0) emitGlows(players);

  if (tick % 4 === 0) {
    for (const player of players) {
      const st = states.get(player.id);
      if (!st) continue;
      try {
        emitAmbient(player, st, time);
      } catch {
        // ignore transient errors
      }
    }
  }

  if (tick % 40 === 0) {
    if (tick % 200 === 0) refreshWeather();
    const target = mistLevel(time);
    for (const player of players) {
      const st = states.get(player.id);
      if (!st) continue;
      try {
        updateMist(player, st, target);
      } catch {
        // ignore
      }
    }
  }
}, 1);

system.run(refreshWeather);
