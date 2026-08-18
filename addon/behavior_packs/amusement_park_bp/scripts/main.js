/*
 * Amusement Park Mod - behaviour script
 *
 * Every builder item is a generator function that yields block operations.
 * A scheduler drains those generators with a per-tick time budget so that
 * huge builds never trip the script watchdog on phones.
 */

import { world, system, BlockPermutation } from "@minecraft/server";

const OPS_PER_TICK = 2200;   // hard cap on blocks placed in a single tick
const MS_PER_TICK = 9;       // soft cap: stop early if the tick is getting long
const MAX_UNDO = 60000;      // blocks remembered for the undo wand, per build

/* ------------------------------------------------------------------ *
 * Block palette
 *
 * Bedrock renamed a lot of blocks in the 1.21 flattening, so every entry
 * is a list of candidates: the first id that resolves on this version wins.
 * ------------------------------------------------------------------ */

const PALETTE = {
  air: [["minecraft:air"]],

  white: [["minecraft:white_concrete"], ["minecraft:concrete", { color: "white" }], ["minecraft:white_wool"], ["minecraft:quartz_block"]],
  black: [["minecraft:black_concrete"], ["minecraft:concrete", { color: "black" }], ["minecraft:black_wool"], ["minecraft:coal_block"]],
  gray: [["minecraft:gray_concrete"], ["minecraft:concrete", { color: "gray" }], ["minecraft:gray_wool"], ["minecraft:stone"]],
  red: [["minecraft:red_concrete"], ["minecraft:concrete", { color: "red" }], ["minecraft:red_wool"], ["minecraft:redstone_block"]],
  orange: [["minecraft:orange_concrete"], ["minecraft:concrete", { color: "orange" }], ["minecraft:orange_wool"], ["minecraft:red_sandstone"]],
  yellow: [["minecraft:yellow_concrete"], ["minecraft:concrete", { color: "yellow" }], ["minecraft:yellow_wool"], ["minecraft:gold_block"]],
  lime: [["minecraft:lime_concrete"], ["minecraft:concrete", { color: "lime" }], ["minecraft:lime_wool"], ["minecraft:emerald_block"]],
  green: [["minecraft:green_concrete"], ["minecraft:concrete", { color: "green" }], ["minecraft:green_wool"], ["minecraft:emerald_block"]],
  cyan: [["minecraft:cyan_concrete"], ["minecraft:concrete", { color: "cyan" }], ["minecraft:cyan_wool"], ["minecraft:prismarine"]],
  lightblue: [["minecraft:light_blue_concrete"], ["minecraft:concrete", { color: "light_blue" }], ["minecraft:light_blue_wool"], ["minecraft:diamond_block"]],
  blue: [["minecraft:blue_concrete"], ["minecraft:concrete", { color: "blue" }], ["minecraft:blue_wool"], ["minecraft:lapis_block"]],
  purple: [["minecraft:purple_concrete"], ["minecraft:concrete", { color: "purple" }], ["minecraft:purple_wool"], ["minecraft:purpur_block"]],
  magenta: [["minecraft:magenta_concrete"], ["minecraft:concrete", { color: "magenta" }], ["minecraft:magenta_wool"], ["minecraft:purpur_block"]],
  pink: [["minecraft:pink_concrete"], ["minecraft:concrete", { color: "pink" }], ["minecraft:pink_wool"], ["minecraft:brick_block"]],
  brown: [["minecraft:brown_concrete"], ["minecraft:concrete", { color: "brown" }], ["minecraft:brown_wool"], ["minecraft:dirt"]],

  quartz: [["minecraft:quartz_block"]],
  quartz_pillar: [["minecraft:quartz_pillar"], ["minecraft:quartz_block", { chisel_type: "lines" }], ["minecraft:quartz_block"]],
  quartz_slab: [["minecraft:quartz_slab"], ["minecraft:stone_block_slab", { stone_slab_type: "quartz" }], ["minecraft:stone_slab", { stone_slab_type: "quartz" }], ["minecraft:quartz_block"]],
  stone: [["minecraft:stone"]],
  smooth_stone: [["minecraft:smooth_stone"], ["minecraft:stone"]],
  stone_brick: [["minecraft:stone_bricks"], ["minecraft:stonebrick", { stone_brick_type: "default" }], ["minecraft:stone"]],
  iron: [["minecraft:iron_block"]],
  gold: [["minecraft:gold_block"]],
  redstone_block: [["minecraft:redstone_block"]],
  glass: [["minecraft:glass"]],
  glass_blue: [["minecraft:light_blue_stained_glass"], ["minecraft:stained_glass", { color: "light_blue" }], ["minecraft:glass"]],
  glass_red: [["minecraft:red_stained_glass"], ["minecraft:stained_glass", { color: "red" }], ["minecraft:glass"]],
  glass_pane: [["minecraft:glass_pane"], ["minecraft:glass"]],
  bars: [["minecraft:iron_bars"], ["minecraft:glass_pane"]],
  chain: [["minecraft:chain"], ["minecraft:iron_bars"]],
  lantern: [["minecraft:lantern"], ["minecraft:torch"], ["minecraft:glowstone"]],
  sea_lantern: [["minecraft:sea_lantern"], ["minecraft:glowstone"]],
  glowstone: [["minecraft:glowstone"]],
  fence: [["minecraft:oak_fence"], ["minecraft:fence", { wood_type: "oak" }], ["minecraft:iron_bars"]],
  planks: [["minecraft:oak_planks"], ["minecraft:planks", { wood_type: "oak" }], ["minecraft:brick_block"]],
  dark_planks: [["minecraft:dark_oak_planks"], ["minecraft:planks", { wood_type: "dark_oak" }], ["minecraft:brick_block"]],
  log: [["minecraft:oak_log"], ["minecraft:log", { old_log_type: "oak" }], ["minecraft:brick_block"]],
  leaves: [["minecraft:oak_leaves", { persistent_bit: true, update_bit: false }], ["minecraft:leaves", { old_leaf_type: "oak", persistent_bit: true, update_bit: false }], ["minecraft:oak_leaves"], ["minecraft:emerald_block"]],
  grass: [["minecraft:grass_block"], ["minecraft:grass"], ["minecraft:dirt"]],
  dirt: [["minecraft:dirt"]],
  path: [["minecraft:smooth_sandstone"], ["minecraft:sandstone", { sand_stone_type: "smooth" }], ["minecraft:quartz_block"]],
  path_edge: [["minecraft:cut_sandstone"], ["minecraft:sandstone", { sand_stone_type: "cut" }], ["minecraft:sandstone"], ["minecraft:quartz_block"]],
  barrel: [["minecraft:barrel"]],
  campfire: [["minecraft:campfire"], ["minecraft:torch"]],
  cake: [["minecraft:cake"], ["minecraft:white_wool"], ["minecraft:wool", { color: "white" }]],
  flower_red: [["minecraft:poppy"], ["minecraft:red_flower"], ["minecraft:air"]],
  flower_yellow: [["minecraft:dandelion"], ["minecraft:yellow_flower"], ["minecraft:air"]],
  water: [["minecraft:water"]],
};

const RAINBOW = ["red", "orange", "yellow", "lime", "cyan", "lightblue", "blue", "purple", "magenta", "pink"];

const permCache = new Map();

function tryPerm(id, states) {
  try {
    return states ? BlockPermutation.resolve(id, states) : BlockPermutation.resolve(id);
  } catch (e) {
    return undefined;
  }
}

/** Resolve a palette key (or a raw {id, states} spec) into a BlockPermutation. */
function permOf(spec) {
  if (typeof spec !== "string") {
    const key = spec.id + "|" + JSON.stringify(spec.states || 0);
    if (permCache.has(key)) return permCache.get(key);
    const p = tryPerm(spec.id, spec.states) || tryPerm(spec.id) || tryPerm("minecraft:stone");
    permCache.set(key, p);
    return p;
  }
  if (permCache.has(spec)) return permCache.get(spec);
  let p;
  const chain = PALETTE[spec];
  if (chain) {
    for (const cand of chain) {
      p = tryPerm(cand[0], cand[1]);
      if (p) break;
    }
  } else {
    p = tryPerm(spec);
  }
  if (!p) p = tryPerm("minecraft:stone");
  permCache.set(spec, p);
  return p;
}

/* ------------------------------------------------------------------ *
 * Frames: local (right, up, forward) coordinates -> world coordinates
 * so every build faces the way the player was looking.
 * ------------------------------------------------------------------ */

const QUARTER = [[0, 1], [-1, 0], [0, -1], [1, 0]]; // forward vector per quarter turn

function yawToQuarter(yaw) {
  return ((Math.round(yaw / 90) % 4) + 4) % 4;
}

function makeFrame(origin, q) {
  q = ((q % 4) + 4) % 4;
  const fwd = QUARTER[q];
  return {
    q,
    ox: Math.floor(origin.x), oy: Math.floor(origin.y), oz: Math.floor(origin.z),
    fx: fwd[0], fz: fwd[1],
    rx: -fwd[1], rz: fwd[0],
    wx(x, z) { return this.ox + x * this.rx + z * this.fx; },
    wz(x, z) { return this.oz + x * this.rz + z * this.fz; },
    wy(y) { return this.oy + y; },
  };
}

/** A child frame anchored at a local point of the parent, optionally turned. */
function subFrame(f, x, y, z, turns = 0) {
  return makeFrame({ x: f.wx(x, z), y: f.wy(y), z: f.wz(x, z) }, f.q + turns);
}

/* ------------------------------------------------------------------ *
 * Geometry helpers. Each yields [worldX, worldY, worldZ, permutation].
 * ------------------------------------------------------------------ */

function op(f, x, y, z, spec) {
  const p = permOf(spec);
  return p ? [f.wx(x, z), f.wy(y), f.wz(x, z), p] : null;
}

function* box(f, x0, y0, z0, x1, y1, z1, spec) {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        yield op(f, x, y, z, spec);
}

function* walls(f, x0, y0, z0, x1, y1, z1, spec) {
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (x === x0 || x === x1 || z === z0 || z === z1)
          yield op(f, x, y, z, spec);
}

function* pillar(f, x, y0, y1, z, spec) {
  for (let y = y0; y <= y1; y++) yield op(f, x, y, z, spec);
}

function* platter(f, cx, cz, y, r, spec) {          // filled disc, flat on the ground
  const ri = Math.ceil(r);
  for (let z = -ri; z <= ri; z++)
    for (let x = -ri; x <= ri; x++)
      if (Math.sqrt(x * x + z * z) <= r + 0.35)
        yield op(f, cx + x, y, cz + z, spec);
}

function* ringXZ(f, cx, cz, y, r, thick, spec) {    // horizontal ring
  const ri = Math.ceil(r + thick);
  for (let z = -ri; z <= ri; z++)
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x * x + z * z);
      if (d <= r + thick / 2 && d >= r - thick / 2)
        yield op(f, cx + x, y, cz + z, spec);
    }
}

function* ringXY(f, cx, cy, z, r, thick, spec) {    // vertical ring (the ferris wheel)
  const ri = Math.ceil(r + thick);
  for (let y = -ri; y <= ri; y++)
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r + thick / 2 && d >= r - thick / 2)
        yield op(f, cx + x, cy + y, z, spec);
    }
}

function* lineXY(f, x0, y0, x1, y1, z, spec) {      // straight run in the vertical plane
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 + 1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    yield op(f, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), z, spec);
  }
}

function* cylinder(f, cx, cz, y0, y1, r, spec) {
  for (let y = y0; y <= y1; y++) yield* ringXZ(f, cx, cz, y, r, 1, spec);
}

/** Striped cone roof: radius shrinks by one every level. */
function* coneRoof(f, cx, cz, y0, r0, colors) {
  let y = y0;
  for (let r = r0; r >= 0; r--, y++) {
    const ri = Math.ceil(r) + 1;
    for (let z = -ri; z <= ri; z++)
      for (let x = -ri; x <= ri; x++) {
        const d = Math.sqrt(x * x + z * z);
        if (d <= r + 0.5 && d >= r - 0.5) {
          const a = Math.atan2(z, x) + Math.PI;
          const c = colors[Math.floor(a / (Math.PI * 2) * colors.length) % colors.length];
          yield op(f, cx + x, y, cz + z, c);
        }
      }
    if (r === 0) yield op(f, cx, y, cz, "gold");
  }
}

/** Wipe out everything in a box, then lay a floor one level below it. */
function* clearAndFloor(f, x0, z0, x1, z1, height, floorSpec) {
  yield* box(f, x0, 1, z0, x1, height, z1, "air");
  if (floorSpec) yield* box(f, x0, 0, z0, x1, 0, z1, floorSpec);
}

/* ------------------------------------------------------------------ *
 * Ride 1 - Ferris wheel
 * ------------------------------------------------------------------ */

function* buildFerrisWheel(f) {
  const CZ = 17, HUB = 19, R = 14, ZA = 13, ZB = 21;

  yield* clearAndFloor(f, -18, 3, 18, 31, 36, "path");
  yield* ringXZ(f, 0, CZ, 0, 12, 2, "path_edge");
  yield* ringXZ(f, 0, CZ, 0, 6, 1, "red");

  // A-frame supports on both sides of the wheel
  for (const z of [ZA, ZB]) {
    yield* lineXY(f, -11, 1, 0, HUB, z, "iron");
    yield* lineXY(f, 11, 1, 0, HUB, z, "iron");
    yield* lineXY(f, -8, 6, 8, 6, z, "stone_brick");
    yield* box(f, -12, 0, z - 1, -9, 1, z + 1, "stone_brick");
    yield* box(f, 9, 0, z - 1, 12, 1, z + 1, "stone_brick");
  }
  yield* box(f, 0, HUB - 1, ZA - 1, 0, HUB + 1, ZB + 1, "iron");   // axle
  yield* box(f, -1, HUB - 1, ZA, 1, HUB + 1, ZB, "gold");          // hub

  // wheel: two rims tied together, with spokes
  for (const z of [ZA, ZB]) {
    yield* ringXY(f, 0, HUB, z, R, 1.7, "white");
    yield* ringXY(f, 0, HUB, z, R - 4, 1.0, "gray");
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      yield* lineXY(f, 0, HUB, Math.round(R * Math.cos(a)), HUB + Math.round(R * Math.sin(a)), z, "smooth_stone");
    }
  }
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12;
    const x = Math.round((R + 0.5) * Math.cos(a)), y = HUB + Math.round((R + 0.5) * Math.sin(a));
    yield op(f, x, y, ZA - 1, "sea_lantern");
    yield op(f, x, y, ZB + 1, "sea_lantern");
  }

  // twelve gondolas hanging from the rim
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const x = Math.round(R * Math.cos(a)), y = HUB + Math.round(R * Math.sin(a));
    const col = RAINBOW[i % RAINBOW.length];
    if (y - 4 < 1) continue;                       // gondola would clip the ground
    yield op(f, x, y - 1, CZ, "chain");
    yield* box(f, x - 1, y - 4, ZA + 1, x + 1, y - 2, ZB - 1, col);
    yield* box(f, x - 1, y - 3, ZA + 2, x + 1, y - 2, ZB - 2, "air");
    yield* box(f, x - 1, y - 3, ZA + 1, x - 1, y - 3, ZB - 1, "glass");
    yield* box(f, x + 1, y - 3, ZA + 1, x + 1, y - 3, ZB - 1, "glass");
    yield op(f, x, y - 2, CZ, "sea_lantern");
  }

  // queue line in front of the wheel
  yield* box(f, -6, 1, 28, 6, 1, 28, "fence");
  yield* box(f, -6, 1, 30, 6, 1, 30, "fence");
  yield* box(f, -6, 0, 29, 6, 0, 29, "red");
  yield op(f, -7, 1, 29, "lantern");
  yield op(f, 7, 1, 29, "lantern");
}

/* ------------------------------------------------------------------ *
 * Ride 2 - Roller coaster (a real, rideable rail circuit)
 * ------------------------------------------------------------------ */

function hillProfile(t, len, peak) {
  const flat = 4;
  const usable = len - 2 * flat;
  if (t < flat || t >= len - flat) return 0;
  const plateau = usable - peak * 2;
  if (plateau < 1) return 0;
  const u = t - flat;
  if (u < peak) return u + 1;
  if (u < peak + plateau) return peak;
  return Math.max(0, peak - (u - peak - plateau) - 1);
}

function compassOf(dx, dz) { return dx > 0 ? "e" : dx < 0 ? "w" : dz > 0 ? "s" : "n"; }
function ascendState(dx, dz) { return dx > 0 ? 2 : dx < 0 ? 3 : dz < 0 ? 4 : 5; }

function railStateFor(prev, cur, next) {
  if (next.y > cur.y) return ascendState(next.x - cur.x, next.z - cur.z);
  if (prev.y > cur.y) return ascendState(prev.x - cur.x, prev.z - cur.z);
  const ix = cur.x - prev.x, iz = cur.z - prev.z;
  const ox = next.x - cur.x, oz = next.z - cur.z;
  if (ix === ox && iz === oz) return ox !== 0 ? 1 : 0;
  const dirs = [compassOf(prev.x - cur.x, prev.z - cur.z), compassOf(next.x - cur.x, next.z - cur.z)];
  const has = (d) => dirs.indexOf(d) >= 0;
  if (has("s") && has("e")) return 6;
  if (has("s") && has("w")) return 7;
  if (has("n") && has("w")) return 8;
  return 9;
}

function* buildRollerCoaster(f) {
  const X0 = -14, X1 = 14, Z0 = 8, Z1 = 44, BASE = 6;

  yield* clearAndFloor(f, X0 - 4, Z0 - 6, X1 + 4, Z1 + 4, BASE + 18, "grass");

  const pts = [];
  for (let x = X0; x < X1; x++) pts.push([x, Z0]);
  for (let z = Z0; z < Z1; z++) pts.push([X1, z]);
  for (let x = X1; x > X0; x--) pts.push([x, Z1]);
  for (let z = Z1; z > Z0; z--) pts.push([X0, z]);

  const ys = pts.map(([x, z]) => {
    if (x === X1 && z > Z0 && z < Z1) return BASE + hillProfile(z - Z0, Z1 - Z0, 8);
    if (x === X0 && z > Z0 && z < Z1) return BASE + hillProfile(Z1 - z, Z1 - Z0, 5);
    return BASE;
  });

  const isStation = pts.map(([x, z]) => z === Z0 && x >= -6 && x <= 6);
  const world = pts.map((p, i) => ({ x: f.wx(p[0], p[1]), y: f.wy(ys[i]), z: f.wz(p[0], p[1]) }));
  const n = world.length;

  // track bed + supports
  for (let i = 0; i < n; i++) {
    const [lx, lz] = pts[i], y = ys[i];
    yield op(f, lx, y - 1, lz, isStation[i] ? "redstone_block" : "stone_brick");
    if (i % 4 === 0) {
      yield* pillar(f, lx, 1, y - 2, lz, "stone_brick");
      yield op(f, lx, y - 2, lz, "quartz");
    }
    if (i % 12 === 0) yield op(f, lx, y + 3, lz, "sea_lantern");
  }

  // rails, with curves and slopes worked out from the world-space path
  for (let i = 0; i < n; i++) {
    const cur = world[i];
    const state = railStateFor(world[(i - 1 + n) % n], cur, world[(i + 1) % n]);
    const perm = isStation[i]
      ? permOf({ id: "minecraft:golden_rail", states: { rail_direction: Math.min(state, 5), rail_data_bit: true } })
      : permOf({ id: "minecraft:rail", states: { rail_direction: state } });
    if (perm) yield [cur.x, cur.y, cur.z, perm];
  }

  // station: platform, roof, lights
  yield* box(f, -8, BASE - 1, Z0 - 4, 8, BASE - 1, Z0 - 1, "planks");
  yield* pillar(f, -8, BASE, Z0 - 4, "log");
  yield* pillar(f, 8, BASE, Z0 - 4, "log");
  yield* box(f, -8, BASE + 1, Z0 - 4, -8, BASE + 4, Z0 - 4, "log");
  yield* box(f, 8, BASE + 1, Z0 - 4, 8, BASE + 4, Z0 - 4, "log");
  yield* box(f, -9, BASE + 5, Z0 - 5, 9, BASE + 5, Z0, "red");
  yield* box(f, -9, BASE + 5, Z0 - 5, 9, BASE + 5, Z0 - 5, "white");
  for (let x = -8; x <= 8; x += 4) yield op(f, x, BASE + 4, Z0 - 4, "lantern");
  for (let x = -8; x <= 8; x++) yield op(f, x, BASE, Z0 - 5, "fence");
  yield* pillar(f, -9, 1, BASE - 2, Z0 - 4, "stone_brick");
  yield* pillar(f, 9, 1, BASE - 2, Z0 - 4, "stone_brick");
  yield* box(f, -9, 1, Z0 - 5, 9, BASE - 2, Z0 - 5, "stone_brick");

  // one cart, parked and ready
  const cart = { x: f.wx(0, Z0) + 0.5, y: f.wy(BASE) + 0.5, z: f.wz(0, Z0) + 0.5 };
  yield (job) => {
    try { job.dim.spawnEntity("minecraft:minecart", cart); } catch (e) { /* entity spawning may be blocked */ }
  };
}

/* ------------------------------------------------------------------ *
 * Ride 3 - Carousel
 * ------------------------------------------------------------------ */

function* buildCarousel(f) {
  const CZ = 14, R = 10;

  yield* clearAndFloor(f, -13, 1, 13, 27, 26, "path");
  yield* platter(f, 0, CZ, 1, R + 1, "quartz");

  // striped turntable
  const ri = R + 1;
  for (let z = -ri; z <= ri; z++)
    for (let x = -ri; x <= ri; x++) {
      const d = Math.sqrt(x * x + z * z);
      if (d > R) continue;
      const a = Math.atan2(z, x) + Math.PI;
      const seg = Math.floor(a / (Math.PI * 2) * 12) % 12;
      yield op(f, x, 2, CZ + z, seg % 2 ? "red" : "white");
    }
  yield* ringXZ(f, 0, CZ, 2, R, 1, "gold");

  // centre column
  yield* box(f, -1, 3, CZ - 1, 1, 14, CZ + 1, "quartz_pillar");
  yield* pillar(f, 0, 3, 15, CZ, "gold");

  // horses on brass poles
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const x = Math.round(7 * Math.cos(a)), z = CZ + Math.round(7 * Math.sin(a));
    const col = RAINBOW[i % RAINBOW.length];
    yield* pillar(f, x, 3, 11, z, "chain");
    yield op(f, x, 4, z, "white");
    yield op(f, x, 5, z, col);
    yield op(f, x, 6, z, "white");
    yield op(f, x, 3, z, col);
  }

  // striped canopy
  yield* ringXZ(f, 0, CZ, 12, R + 1, 1.5, "gold");
  yield* coneRoof(f, 0, CZ, 13, R + 1, ["red", "white"]);
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    yield op(f, Math.round((R + 1) * Math.cos(a)), 11, CZ + Math.round((R + 1) * Math.sin(a)), i % 2 ? "lantern" : "sea_lantern");
  }
}

/* ------------------------------------------------------------------ *
 * Ride 4 - Drop tower
 * ------------------------------------------------------------------ */

function* buildDropTower(f) {
  const CZ = 12, H = 44;

  yield* clearAndFloor(f, -11, 1, 11, 23, H + 6, "path");
  yield* platter(f, 0, CZ, 1, 10, "quartz");
  yield* ringXZ(f, 0, CZ, 1, 10, 1, "red");
  yield* ringXZ(f, 0, CZ, 1, 7, 1, "gold");

  // four legs and the glass drop shaft
  for (const dx of [-4, 4])
    for (const dz of [-4, 4]) {
      yield* pillar(f, dx, 2, H, CZ + dz, "iron");
      for (let y = 6; y <= H; y += 8) yield op(f, dx, y, CZ + dz, y % 16 === 6 ? "red" : "sea_lantern");
    }
  for (let y = 2; y <= H; y++) {
    const band = y % 8 === 0;
    yield* walls(f, -2, y, CZ - 2, 2, y, CZ + 2, band ? "iron" : "glass_blue");
    if (band) {                                   // cross braces out to the legs
      yield* box(f, -4, y, CZ - 4, 4, y, CZ - 4, "bars");
      yield* box(f, -4, y, CZ + 4, 4, y, CZ + 4, "bars");
      yield* box(f, -4, y, CZ - 4, -4, y, CZ + 4, "bars");
      yield* box(f, 4, y, CZ - 4, 4, y, CZ + 4, "bars");
    }
  }

  // gondolas parked at the bottom
  const seats = [[0, -6], [0, 6], [-6, 0], [6, 0]];
  for (let i = 0; i < seats.length; i++) {
    const [sx, sz] = seats[i];
    const col = RAINBOW[i * 2 % RAINBOW.length];
    yield* box(f, sx - 1, 2, CZ + sz - 1, sx + 1, 3, CZ + sz + 1, col);
    yield* box(f, sx - 1, 3, CZ + sz - 1, sx + 1, 3, CZ + sz + 1, "yellow");
    yield op(f, sx, 4, CZ + sz, "bars");
  }

  // crown
  yield* box(f, -3, H + 1, CZ - 3, 3, H + 1, CZ + 3, "red");
  yield* box(f, -2, H + 2, CZ - 2, 2, H + 2, CZ + 2, "white");
  yield* box(f, -1, H + 3, CZ - 1, 1, H + 3, CZ + 1, "gold");
  yield op(f, 0, H + 4, CZ, "sea_lantern");
  for (const dx of [-3, 3]) for (const dz of [-3, 3]) yield op(f, dx, H + 2, CZ + dz, "sea_lantern");

  // safety fence + queue
  yield* ringXZ(f, 0, CZ, 2, 10, 1, "fence");
  yield* box(f, -1, 2, CZ - 10, 1, 2, CZ - 10, "air");
}

/* ------------------------------------------------------------------ *
 * Ride 5 - Bumper cars
 * ------------------------------------------------------------------ */

function* buildBumperCars(f) {
  const CZ = 14, HALF = 11;

  yield* clearAndFloor(f, -HALF - 1, 1, HALF + 1, CZ + HALF + 1, 14, "gray");

  // checkerboard rink
  for (let z = -HALF; z <= HALF; z++)
    for (let x = -HALF; x <= HALF; x++)
      yield op(f, x, 0, CZ + z, (x + z) % 2 === 0 ? "black" : "white");

  // striped barrier wall
  for (let z = -HALF - 1; z <= HALF + 1; z++)
    for (let x = -HALF - 1; x <= HALF + 1; x++) {
      if (Math.abs(x) <= HALF && Math.abs(z) <= HALF) continue;
      if (z === -HALF - 1 && x >= -2 && x <= 2) continue;           // doorway
      yield op(f, x, 1, CZ + z, ((x + z) >> 1) % 2 === 0 ? "red" : "white");
      yield op(f, x, 2, CZ + z, "yellow");
    }

  // roof frame
  for (const dx of [-HALF - 1, HALF + 1])
    for (const dz of [-HALF - 1, HALF + 1])
      yield* pillar(f, dx, 3, 8, CZ + dz, "iron");
  yield* walls(f, -HALF - 1, 8, CZ - HALF - 1, HALF + 1, 8, CZ + HALF + 1, "iron");
  for (let z = -HALF; z <= HALF; z += 3)
    yield* box(f, -HALF, 8, CZ + z, HALF, 8, CZ + z, "bars");
  for (let z = -HALF + 2; z <= HALF; z += 5)
    for (let x = -HALF + 2; x <= HALF; x += 5)
      yield op(f, x, 8, CZ + z, "sea_lantern");

  // parked cars
  const cars = [[-7, -7], [0, -6], [7, -7], [-8, 2], [2, 1], [8, 4], [-4, 8], [5, 9]];
  for (let i = 0; i < cars.length; i++) {
    const [x, z] = cars[i];
    const col = RAINBOW[i % RAINBOW.length];
    yield* box(f, x - 1, 1, CZ + z - 1, x + 1, 1, CZ + z + 1, col);
    yield op(f, x, 1, CZ + z, "black");
    yield op(f, x, 2, CZ + z, col);
    yield op(f, x, 3, CZ + z, "fence");
    yield op(f, x, 4, CZ + z, "gold");
  }
}

/* ------------------------------------------------------------------ *
 * Ride 6 - Chain swing ride
 * ------------------------------------------------------------------ */

function* buildSwingRide(f) {
  const CZ = 14, TOP = 22;

  yield* clearAndFloor(f, -12, 1, 12, 26, TOP + 8, "path");
  yield* platter(f, 0, CZ, 1, 11, "quartz");
  yield* ringXZ(f, 0, CZ, 1, 11, 1, "blue");
  yield* ringXZ(f, 0, CZ, 1, 8, 1, "yellow");

  // banded centre mast
  for (let y = 2; y <= TOP + 1; y++)
    yield* box(f, -1, y, CZ - 1, 1, y, CZ + 1, Math.floor(y / 3) % 2 === 0 ? "white" : "red");
  yield* ringXZ(f, 0, CZ, TOP, 10, 1.4, "gold");

  // sixteen chain swings
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    const x = Math.round(10 * Math.cos(a)), z = CZ + Math.round(10 * Math.sin(a));
    const col = RAINBOW[i % RAINBOW.length];
    yield* pillar(f, x, 14, TOP - 1, z, "chain");
    yield op(f, x, 13, z, col);
    yield op(f, x, 12, z, "planks");
    yield op(f, x, TOP, z, "gold");
  }

  yield* coneRoof(f, 0, CZ, TOP + 2, 9, ["red", "yellow", "blue", "white"]);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    yield op(f, Math.round(11 * Math.cos(a)), 2, CZ + Math.round(11 * Math.sin(a)), "lantern");
  }
}

/* ------------------------------------------------------------------ *
 * Ride 7 - Park entrance
 * ------------------------------------------------------------------ */

const FONT = {
  A: ["010", "101", "111", "101", "101"],
  F: ["111", "100", "110", "100", "100"],
  K: ["101", "110", "100", "110", "101"],
  N: ["101", "111", "111", "111", "101"],
  P: ["111", "101", "111", "100", "100"],
  R: ["111", "101", "111", "110", "101"],
  U: ["101", "101", "101", "101", "111"],
  " ": ["000", "000", "000", "000", "000"],
};

function* writeText(f, text, x0, yTop, z, spec, mirror) {
  const chars = text.toUpperCase().split("");
  if (mirror) chars.reverse();                 // so the back of the sign reads correctly too
  let x = x0;
  for (const ch of chars) {
    const glyph = FONT[ch];
    if (glyph)
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (glyph[r][mirror ? 2 - c : c] === "1") yield op(f, x + c, yTop - r, z, spec);
    x += 4;
  }
}

function* buildEntrance(f) {
  const Z = 6;

  yield* clearAndFloor(f, -22, 0, 22, 16, 26, "path");

  // gate towers
  for (const side of [-1, 1]) {
    const cx = side * 18;
    for (let y = 1; y <= 13; y++)
      yield* walls(f, cx - 2, y, Z - 2, cx + 2, y, Z + 2, Math.floor(y / 2) % 2 === 0 ? "white" : "red");
    yield* box(f, cx - 1, 1, Z - 1, cx + 1, 13, Z + 1, "quartz");
    yield* box(f, cx - 2, 5, Z - 2, cx - 2, 7, Z + 2, "glass_blue");
    yield* box(f, cx + 2, 5, Z - 2, cx + 2, 7, Z + 2, "glass_blue");
    yield* coneRoof(f, cx, Z, 14, 3, ["red", "white"]);
    yield* pillar(f, cx, 19, 22, Z, "fence");
    yield* box(f, cx, 21, Z + 1, cx, 22, Z + 2, side > 0 ? "blue" : "lime");
    yield op(f, cx - 3, 3, Z, "lantern");
    yield op(f, cx + 3, 3, Z, "lantern");
  }

  // arch across the top
  yield* box(f, -16, 11, Z - 1, 16, 12, Z + 1, "red");
  yield* box(f, -16, 18, Z - 1, 16, 18, Z + 1, "red");
  yield* box(f, -16, 13, Z - 1, 16, 17, Z + 1, "white");
  yield* box(f, -16, 13, Z, 16, 17, Z, "blue");
  yield* writeText(f, "FUN PARK", -15, 17, Z - 1, "yellow");
  yield* writeText(f, "FUN PARK", -15, 17, Z + 1, "yellow", true);
  for (let x = -16; x <= 16; x += 4) {
    yield op(f, x, 19, Z, "gold");
    yield op(f, x, 20, Z, "sea_lantern");
    yield op(f, x, 10, Z - 1, "lantern");
    yield op(f, x, 10, Z + 1, "lantern");
  }

  // turnstiles and ticket booths
  for (let x = -14; x <= 14; x += 4) {
    yield* pillar(f, x, 1, 2, Z, "fence");
    yield op(f, x, 3, Z, "gold");
  }
  for (const side of [-1, 1]) {
    const cx = side * 9;
    yield* box(f, cx - 2, 1, Z - 6, cx + 2, 4, Z - 3, "planks");
    yield* box(f, cx - 1, 1, Z - 5, cx + 1, 3, Z - 4, "air");
    yield* box(f, cx - 1, 1, Z - 6, cx + 1, 2, Z - 6, "air");
    yield* box(f, cx - 1, 1, Z - 6, cx + 1, 1, Z - 6, "barrel");
    yield* box(f, cx - 3, 5, Z - 7, cx + 3, 5, Z - 3, side > 0 ? "yellow" : "cyan");
    yield op(f, cx, 4, Z - 6, "sea_lantern");
  }

  // red carpet leading in
  yield* box(f, -2, 0, Z - 10, 2, 0, Z + 10, "red");
}

/* ------------------------------------------------------------------ *
 * Ride 8 - Food court
 * ------------------------------------------------------------------ */

function* buildFoodCourt(f) {
  yield* clearAndFloor(f, -18, 1, 18, 22, 12, "path");

  const stalls = [[-13, "red"], [-4, "lime"], [5, "blue"], [14, "orange"]];
  for (const [cx, col] of stalls) {
    yield* box(f, cx - 3, 1, 8, cx + 3, 4, 11, "planks");        // shell
    yield* box(f, cx - 2, 1, 8, cx + 2, 3, 10, "air");           // interior
    yield* box(f, cx - 2, 1, 8, cx + 2, 2, 8, "air");            // serving window
    yield* box(f, cx - 2, 1, 8, cx + 2, 1, 8, "barrel");         // counter
    yield* pillar(f, cx - 3, 1, 4, 7, "log");
    yield* pillar(f, cx + 3, 1, 4, 7, "log");
    for (let x = cx - 4; x <= cx + 4; x++)                        // striped awning
      yield op(f, x, 5, 7, (x + 100) % 2 === 0 ? col : "white");
    yield* box(f, cx - 4, 5, 8, cx + 4, 5, 12, col);
    yield* box(f, cx - 4, 6, 9, cx + 4, 6, 11, "white");
    yield op(f, cx, 2, 10, "campfire");
    yield op(f, cx - 3, 4, 7, "lantern");
    yield op(f, cx + 3, 4, 7, "lantern");
    yield op(f, cx, 4, 12, "cake");
  }

  // picnic tables
  for (const tx of [-11, -2, 7, 16])
    for (const tz of [16, 20]) {
      yield op(f, tx, 1, tz, "log");
      yield* box(f, tx - 1, 2, tz - 1, tx + 1, 2, tz + 1, "planks");
      yield op(f, tx - 2, 1, tz, "fence");
      yield op(f, tx + 2, 1, tz, "fence");
      yield op(f, tx, 1, tz - 2, "fence");
      yield op(f, tx, 1, tz + 2, "fence");
    }

  // lamp posts and planters
  for (const lx of [-16, 0, 16])
    for (const lz of [14, 22]) {
      yield* pillar(f, lx, 1, 4, lz, "fence");
      yield op(f, lx, 5, lz, "sea_lantern");
      yield* box(f, lx - 1, 1, lz - 1, lx + 1, 1, lz + 1, "log");
      yield op(f, lx, 1, lz, "fence");
    }
}

/* ------------------------------------------------------------------ *
 * The whole park
 * ------------------------------------------------------------------ */

function* tree(f, x, z) {
  yield* pillar(f, x, 1, 4, z, "log");
  for (let y = 4; y <= 6; y++) {
    const r = y === 6 ? 1 : 2;
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++)
        if (Math.abs(dx) + Math.abs(dz) <= r + 1) yield op(f, x + dx, y, z + dz, "leaves");
  }
}

function* lampPost(f, x, z) {
  yield* pillar(f, x, 1, 4, z, "fence");
  yield op(f, x, 5, z, "sea_lantern");
  yield op(f, x, 6, z, "quartz_slab");
}

function* bench(f, x, z) {
  yield* box(f, x - 1, 1, z, x + 1, 1, z, "planks");
  yield op(f, x - 1, 2, z, "fence");
  yield op(f, x + 1, 2, z, "fence");
}

function* buildPark(f) {
  const X0 = -50, X1 = 56, Z0 = -12, Z1 = 96;

  // level the grounds
  yield* box(f, X0, 1, Z0, X1, 8, Z1, "air");
  yield* box(f, X0, 0, Z0, X1, 0, Z1, "grass");

  // perimeter fence with a gap where the entrance goes
  for (let x = X0; x <= X1; x++) {
    if (!(x >= -22 && x <= 22)) yield op(f, x, 1, Z0, "fence");
    yield op(f, x, 1, Z1, "fence");
  }
  for (let z = Z0; z <= Z1; z++) {
    yield op(f, X0, 1, z, "fence");
    yield op(f, X1, 1, z, "fence");
  }

  // main avenue, splitting around the carousel plaza
  for (let z = Z0 + 2; z <= Z1 - 2; z++) {
    const roundabout = z >= 24 && z <= 52;
    for (let x = -5; x <= 5; x++) {
      if (roundabout && Math.abs(x) < 5) continue;
      yield op(f, x, 0, z, Math.abs(x) === 5 ? "path_edge" : "path");
    }
  }
  // side spurs to the rides
  for (const z of [10, 40, 70]) {
    for (let x = -30; x <= 34; x++) yield op(f, x, 0, z, "path");
    for (let x = -30; x <= 34; x++) yield op(f, x, 0, z + 1, "path");
  }

  // street furniture
  for (let z = Z0 + 6; z < Z1 - 6; z += 10) {
    yield* lampPost(f, -7, z);
    yield* lampPost(f, 7, z);
  }
  for (const z of [18, 30, 58, 80]) {
    yield* bench(f, -9, z);
    yield* bench(f, 9, z);
  }
  for (const [tx, tz] of [[-14, 14], [14, 14], [-16, 56], [16, 56], [-20, 84], [20, 84], [46, 84], [-44, 40]])
    yield* tree(f, tx, tz);
  for (const [fx, fz] of [[-12, 8], [12, 8], [-12, 62], [12, 62]]) {
    yield* box(f, fx - 1, 1, fz - 1, fx + 1, 1, fz + 1, "log");
    yield op(f, fx, 1, fz, "dirt");
    yield op(f, fx, 2, fz, "flower_red");
    yield op(f, fx - 1, 2, fz, "flower_yellow");
  }

  // the rides
  yield* buildEntrance(subFrame(f, 0, 0, 0));
  yield* buildFoodCourt(subFrame(f, -30, 0, 4));
  yield* buildCarousel(subFrame(f, 0, 0, 24));
  yield* buildBumperCars(subFrame(f, -32, 0, 34));
  yield* buildRollerCoaster(subFrame(f, 34, 0, 8));
  yield* buildSwingRide(subFrame(f, -30, 0, 64));
  yield* buildDropTower(subFrame(f, 30, 0, 62));
  yield* buildFerrisWheel(subFrame(f, 0, 0, 62));

  // ring path around the carousel plaza
  yield* ringXZ(f, 0, 38, 0, 14, 1.4, "path_edge");
}

/* ------------------------------------------------------------------ *
 * Build scheduler - drains generators with a per-tick time budget
 * ------------------------------------------------------------------ */

const BUILDERS = {
  "apark:ferris_wheel_builder": ["Ferris Wheel", buildFerrisWheel],
  "apark:roller_coaster_builder": ["Roller Coaster", buildRollerCoaster],
  "apark:carousel_builder": ["Carousel", buildCarousel],
  "apark:drop_tower_builder": ["Drop Tower", buildDropTower],
  "apark:bumper_cars_builder": ["Bumper Cars", buildBumperCars],
  "apark:swing_ride_builder": ["Swing Ride", buildSwingRide],
  "apark:entrance_gate_builder": ["Park Entrance", buildEntrance],
  "apark:food_court_builder": ["Food Court", buildFoodCourt],
  "apark:park_kit": ["Amusement Park", buildPark],
};

const ALIASES = {
  ferris: "apark:ferris_wheel_builder", wheel: "apark:ferris_wheel_builder",
  coaster: "apark:roller_coaster_builder", rollercoaster: "apark:roller_coaster_builder",
  carousel: "apark:carousel_builder", merrygoround: "apark:carousel_builder",
  tower: "apark:drop_tower_builder", drop: "apark:drop_tower_builder",
  bumper: "apark:bumper_cars_builder", cars: "apark:bumper_cars_builder",
  swing: "apark:swing_ride_builder", swings: "apark:swing_ride_builder",
  gate: "apark:entrance_gate_builder", entrance: "apark:entrance_gate_builder",
  food: "apark:food_court_builder", stalls: "apark:food_court_builder",
  park: "apark:park_kit", all: "apark:park_kit",
};

const jobs = [];
const undoStore = new Map();
const lastUse = new Map();
let AIR;

function startJob(player, label, gen, radius) {
  if (jobs.some((j) => j.playerId === player.id)) {
    player.sendMessage("§eStill building - hang on a second.");
    return;
  }
  const job = {
    playerId: player.id, player, dim: player.dimension,
    label, gen, count: 0, skipped: 0, undo: [], truncated: false,
    zone: "apark_" + Math.abs(Math.floor(player.location.x)) + "_" + Math.abs(Math.floor(player.location.z)),
  };
  try {
    const l = player.location;
    job.dim.runCommand(`tickingarea add circle ${Math.floor(l.x)} ${Math.floor(l.y)} ${Math.floor(l.z)} ${radius || 4} ${job.zone}`);
    job.hasZone = true;
  } catch (e) { /* no permission for ticking areas - build anyway */ }
  jobs.push(job);
  player.sendMessage(`§bBuilding §f${label}§b...`);
  try { player.playSound("random.orb"); } catch (e) { }
}

function applyOp(job, entry) {
  if (typeof entry === "function") {
    try { entry(job); } catch (e) { }
    return;
  }
  const perm = entry[3];
  let block;
  try { block = job.dim.getBlock({ x: entry[0], y: entry[1], z: entry[2] }); } catch (e) { block = undefined; }
  if (!block) { job.skipped++; return; }
  try {
    if (perm === AIR && block.isAir) return;                 // nothing to clear here
    if (job.undo.length < MAX_UNDO) job.undo.push([entry[0], entry[1], entry[2], block.permutation]);
    else job.truncated = true;
    block.setPermutation(perm);
    job.count++;
  } catch (e) {
    job.skipped++;
  }
}

function finishJob(job) {
  jobs.shift();
  if (job.hasZone) {
    try { job.dim.runCommand(`tickingarea remove ${job.zone}`); } catch (e) { }
  }
  undoStore.set(job.playerId, { dim: job.dim, entries: job.undo, label: job.label, truncated: job.truncated });
  const p = job.player;
  try {
    p.onScreenDisplay.setActionBar(`§a${job.label} complete`);
    p.sendMessage(`§a${job.label} finished §7(${job.count} blocks${job.skipped ? ", " + job.skipped + " out of range" : ""})`);
    p.playSound("random.levelup");
  } catch (e) { /* player left */ }
}

system.runInterval(() => {
  if (!jobs.length) return;
  const job = jobs[0];
  const started = Date.now();
  let n = 0;
  while (n < OPS_PER_TICK) {
    let step;
    try {
      step = job.gen.next();
    } catch (e) {
      console.warn("[amusement park] build error: " + e);
      finishJob(job);
      return;
    }
    if (step.done) { finishJob(job); return; }
    if (step.value) applyOp(job, step.value);
    n++;
    if ((n & 127) === 0 && Date.now() - started > MS_PER_TICK) break;
  }
  try { job.player.onScreenDisplay.setActionBar(`§e${job.label}: §f${job.count} §eblocks placed`); } catch (e) { }
}, 1);

/* ------------------------------------------------------------------ *
 * Using the items
 * ------------------------------------------------------------------ */

function undoLast(player) {
  const rec = undoStore.get(player.id);
  if (!rec || !rec.entries.length) {
    player.sendMessage("§cNothing to undo. Build something first.");
    return;
  }
  undoStore.delete(player.id);
  const entries = rec.entries;
  function* replay() {
    for (let i = entries.length - 1; i >= 0; i--) yield entries[i];
  }
  startJob(player, "Undo of " + rec.label, replay(), 4);
  if (rec.truncated) player.sendMessage("§eThat build was too big to remember completely - some of it will stay.");
}

function trigger(player, id) {
  if (id === "apark:undo_wand") { undoLast(player); return; }
  const entry = BUILDERS[id];
  if (!entry) return;
  const [label, builder] = entry;
  const loc = player.location;
  const origin = { x: Math.floor(loc.x), y: Math.floor(loc.y) - 1, z: Math.floor(loc.z) };
  const frame = makeFrame(origin, yawToQuarter(player.getRotation().y));
  startJob(player, label, builder(frame), id === "apark:park_kit" ? 8 : 4);
}

function onUse(player, itemStack) {
  if (!player || !itemStack) return;
  const id = itemStack.typeId;
  if (!id || id.indexOf("apark:") !== 0) return;
  const now = system.currentTick;
  const prev = lastUse.get(player.id);
  if (prev !== undefined && now - prev < 20) return;          // one build per tap
  lastUse.set(player.id, now);
  trigger(player, id);
}

if (!AIR) AIR = permOf("air");

try {
  world.afterEvents.itemUse.subscribe((ev) => onUse(ev.source, ev.itemStack));
} catch (e) { console.warn("[amusement park] itemUse unavailable: " + e); }

try {
  world.afterEvents.playerInteractWithBlock.subscribe((ev) => {
    if (ev.itemStack) onUse(ev.player, ev.itemStack);
  });
} catch (e) { /* older runtimes only have itemUse */ }

try {
  system.afterEvents.scriptEventReceive.subscribe((ev) => {
    if (ev.id !== "apark:build" || !ev.sourceEntity) return;
    const key = String(ev.message || "").trim().toLowerCase().replace(/[^a-z]/g, "");
    const id = ALIASES[key];
    if (key === "undo") undoLast(ev.sourceEntity);
    else if (id) trigger(ev.sourceEntity, id);
    else ev.sourceEntity.sendMessage("§cUnknown ride. Try: " + Object.keys(ALIASES).join(", "));
  });
} catch (e) { /* scriptevent unavailable */ }

try {
  world.beforeEvents.chatSend.subscribe((ev) => {
    const msg = ev.message.trim();
    if (msg.charAt(0) !== "!") return;
    const key = msg.slice(1).trim().toLowerCase().replace(/[^a-z]/g, "");
    if (key === "park" || ALIASES[key] || key === "undo" || key === "help") {
      ev.cancel = true;
      const player = ev.sender;
      system.run(() => {
        if (key === "help") {
          player.sendMessage("§bAmusement Park§7: hold a builder item and tap the ground, or type §f!ferris !coaster !carousel !tower !bumper !swing !gate !food !park !undo");
        } else if (key === "undo") {
          undoLast(player);
        } else {
          trigger(player, ALIASES[key]);
        }
      });
    }
  });
} catch (e) { /* chat hooks unavailable on this runtime */ }

try {
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    ev.player.sendMessage("§bAmusement Park Mod loaded. §7Grab a builder from the creative Construction tab, stand in an open field and tap the ground. §f!help§7 lists the chat commands.");
  });
} catch (e) { /* not fatal */ }
