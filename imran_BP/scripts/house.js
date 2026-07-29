/**
 * Imran Security House - the deployable building.
 *
 * The house is described in local coordinates (x across the front, z back into
 * the building, y up from the floor), rotated so the door always faces the
 * player, then queued up and placed a few hundred blocks per tick so a phone
 * does not stutter while it goes up.
 *
 * Layout, 19 x 15 on the ground:
 *
 *        IMRAN            <- gold letters on the parapet
 *   ####################
 *   #  []          []  #  <- barred windows
 *   #                  #
 *   #         ][       #  <- iron door, centre of the front wall
 *   ####################
 *
 * Walls are stone brick with iron pillars, the floor and flat roof are polished
 * deepslate, the ceiling is lit with glowstone so nothing spawns inside, and the
 * whole footprint is registered as a security zone: any violent zombie that gets
 * in is zapped.
 */

import { system } from "@minecraft/server";
import { TUNING, ZOMBIE_ID, getSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  blockIdAt,
  damageEntity,
  entitiesNear,
  groundY,
  isAirId,
  playSoundAt,
  playersNear,
  sendMessage,
  setBlockSafe,
  setBlockWithStates,
  showTitle,
  spawnParticleSafe
} from "./util.js";

/* --------------------------------------------------------------- the name -- */

/** 3x5 letters, top row first. The house is exactly wide enough for these. */
const FONT = {
  I: ["111", "010", "010", "010", "111"],
  M: ["101", "111", "111", "101", "101"],
  R: ["110", "101", "110", "101", "101"],
  A: ["010", "101", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"]
};

const HOUSE_NAME = "IMRAN";

/* ------------------------------------------------------------ build queue -- */

/** Houses waiting to be placed, a slice at a time. */
const queue = [];
/** Finished houses, kept for the security system and for removal. */
const houses = [];
let loopId = undefined;

export function initHouses() {
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      drainQueue();
      runSecurity();
    } catch (error) {
      console.warn(`[Imran] house loop: ${error}`);
    }
  }, 5);
}

export function houseCount() {
  return houses.length;
}

export function houseStatus() {
  if (houses.length === 0 && queue.length === 0) return "§7No houses built yet.";
  const lines = [];
  for (const house of houses) {
    lines.push(
      `§7- §f${HOUSE_NAME}§7 at §f${Math.round(house.origin.x)}, ${Math.round(house.origin.y)}, ${Math.round(
        house.origin.z
      )}`
    );
  }
  if (queue.length > 0) lines.push(`§7- §e${queue.length} still going up...`);
  return lines.join("\n");
}

/** The most recently built house, for /scriptevent ih:removehouse. */
export function removeLastHouse(dimension) {
  const house = houses.pop();
  if (!house) return false;
  const { min, max } = house.bounds;
  let cleared = 0;
  for (let x = min.x; x <= max.x; x++) {
    for (let y = min.y; y <= max.y; y++) {
      for (let z = min.z; z <= max.z; z++) {
        if (setBlockSafe(house.dimension ?? dimension, { x, y, z }, "minecraft:air")) cleared++;
      }
    }
  }
  return cleared > 0;
}

/** True when a point is inside a finished house. */
export function insideAHouse(dimension, location) {
  for (const house of houses) {
    if (house.dimension.id !== dimension.id) continue;
    const { min, max } = house.bounds;
    if (
      location.x >= min.x &&
      location.x <= max.x &&
      location.y >= min.y - 1 &&
      location.y <= max.y &&
      location.z >= min.z &&
      location.z <= max.z
    ) {
      return true;
    }
  }
  return false;
}

/* ---------------------------------------------------------------- placing -- */

/**
 * Queues a house in front of the player.
 * @returns {{ok:boolean, reason?:string}}
 */
export function buildHouse(player) {
  let origin;
  let dimension;
  let view = { x: 0, y: 0, z: 1 };
  try {
    origin = player.location;
    dimension = player.dimension;
    view = player.getViewDirection();
  } catch {
    return { ok: false, reason: "Could not read where you are standing." };
  }

  // Face the door back towards the player: pick the dominant axis of the view.
  const rotation = Math.abs(view.x) > Math.abs(view.z) ? (view.x > 0 ? 1 : 3) : view.z > 0 ? 0 : 2;

  const cfg = TUNING.house;
  const forward = { x: Math.round(view.x), z: Math.round(view.z) };
  const distance = 12;
  const centre = {
    x: Math.floor(origin.x + (forward.x || 0) * distance),
    z: Math.floor(origin.z + (forward.z || 0) * distance)
  };

  const ground = groundY(dimension, centre.x, centre.z, origin.y + 12, 24);
  const baseY = ground === undefined ? Math.floor(origin.y) : ground + 1;

  const plan = [];
  for (const piece of describeHouse(cfg)) {
    const world = rotate(piece.x, piece.z, rotation, cfg);
    plan.push({
      pos: { x: centre.x + world.x - Math.floor(cfg.width / 2), y: baseY + piece.y, z: centre.z + world.z - Math.floor(cfg.depth / 2) },
      block: piece.block,
      states: piece.states
    });
  }

  const xs = plan.map((piece) => piece.pos.x);
  const ys = plan.map((piece) => piece.pos.y);
  const zs = plan.map((piece) => piece.pos.z);
  const bounds = {
    min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
    max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) }
  };

  queue.push({
    dimension,
    plan,
    cursor: 0,
    bounds,
    origin: { x: bounds.min.x, y: baseY, z: bounds.min.z },
    owner: player
  });

  showTitle(player, "§6§lIMRAN", "§7Security house going up...");
  return { ok: true };
}

/** Places the next slice of every queued house. */
function drainQueue() {
  if (queue.length === 0) return;
  let budget = getSetting("buildSpeed");

  while (queue.length > 0 && budget > 0) {
    const job = queue[0];
    while (job.cursor < job.plan.length && budget > 0) {
      const piece = job.plan[job.cursor++];
      budget--;
      if (piece.states) setBlockWithStates(job.dimension, piece.pos, piece.block, piece.states);
      else setBlockSafe(job.dimension, piece.pos, piece.block);
    }

    if (job.cursor % 200 < getSetting("buildSpeed")) {
      playSoundAt(job.dimension, job.origin, SOUNDS.build.custom, SOUNDS.build.vanilla, {
        volume: 0.8,
        pitch: 1.2
      });
    }

    if (job.cursor >= job.plan.length) {
      queue.shift();
      houses.push({ dimension: job.dimension, bounds: job.bounds, origin: job.origin });
      playSoundAt(job.dimension, job.origin, SOUNDS.builtDone.custom, SOUNDS.builtDone.vanilla, {
        volume: 1.2,
        pitch: 1
      });
      for (const player of playersNear(job.dimension, job.origin, 64)) {
        showTitle(player, "§6§lIMRAN", "§aSecurity house ready");
        sendMessage(player, "§6[Imran] §fThe house is up. Shut the door before the horde arrives.");
      }
    }
  }
}

/* ----------------------------------------------------------- the security -- */

let securityTick = 0;

function runSecurity() {
  if (!getSetting("securitySystem")) return;
  securityTick++;
  if (securityTick % 4 !== 0) return; // once a second

  for (const house of houses) {
    const centre = {
      x: (house.bounds.min.x + house.bounds.max.x) / 2,
      y: house.bounds.min.y + 2,
      z: (house.bounds.min.z + house.bounds.max.z) / 2
    };
    const radius = Math.max(
      house.bounds.max.x - house.bounds.min.x,
      house.bounds.max.z - house.bounds.min.z
    );

    for (const zombie of entitiesNear(house.dimension, centre, radius, { type: ZOMBIE_ID })) {
      let loc;
      try {
        loc = zombie.location;
      } catch {
        continue;
      }
      if (!insideAHouse(house.dimension, loc)) continue;
      damageEntity(zombie, TUNING.house.zapDamage, { cause: "lightning" });
      spawnParticleSafe(house.dimension, "ih:security_spark", { x: loc.x, y: loc.y + 1, z: loc.z });
      playSoundAt(house.dimension, loc, SOUNDS.zap.custom, SOUNDS.zap.vanilla, { volume: 0.7, pitch: 1.6 });
    }
  }
}

/* ------------------------------------------------------------- the layout -- */

/** Rotates a local x/z so the front of the house faces the player. */
function rotate(x, z, rotation, cfg) {
  switch (rotation & 3) {
    case 1:
      return { x: cfg.depth - 1 - z, z: x };
    case 2:
      return { x: cfg.width - 1 - x, z: cfg.depth - 1 - z };
    case 3:
      return { x: z, z: cfg.width - 1 - x };
    default:
      return { x, z };
  }
}

/**
 * Every block of the house, in local coordinates.
 * @returns {Array<{x:number,y:number,z:number,block:string,states?:object}>}
 */
function describeHouse(cfg) {
  const B = cfg.blocks;
  const pieces = [];
  const W = cfg.width;
  const D = cfg.depth;
  const H = cfg.wallHeight;
  const doorX = Math.floor(W / 2);

  const add = (x, y, z, block, states) => pieces.push({ x, y, z, block, states });

  // Floor and a carpet runner down the middle.
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      add(x, 0, z, B.floor);
      if (z > 0 && z < D - 1 && x === doorX) add(x, 1, z, B.carpet);
    }
  }

  // Walls, with iron pillars at the corners and every 6 blocks.
  for (let y = 1; y <= H; y++) {
    for (let x = 0; x < W; x++) {
      for (let z = 0; z < D; z++) {
        const onEdge = x === 0 || x === W - 1 || z === 0 || z === D - 1;
        if (!onEdge) {
          // Hollow inside: clear it so the house can be dropped into a hillside.
          add(x, y, z, "minecraft:air");
          continue;
        }
        const isPillar = (x === 0 || x === W - 1) && (z === 0 || z === D - 1);
        const isRib = x % 6 === 0 || z % 6 === 0;
        add(x, y, z, isPillar ? B.pillar : isRib && y === H ? B.trim : B.wall);
      }
    }
  }

  // Barred windows: two on the front, three down each side.
  const windows = [
    [3, 0],
    [W - 4, 0],
    [0, 4],
    [0, 7],
    [0, 10],
    [W - 1, 4],
    [W - 1, 7],
    [W - 1, 10],
    [4, D - 1],
    [doorX, D - 1],
    [W - 5, D - 1]
  ];
  for (const [wx, wz] of windows) {
    for (let y = 2; y <= 3; y++) add(wx, y, wz, B.window);
  }

  // The door, dead centre of the front wall, with a lever inside.
  add(doorX, 1, 0, B.door, { direction: 0, door_hinge_bit: false, open_bit: false, upper_block_bit: false });
  add(doorX, 2, 0, B.door, { direction: 0, door_hinge_bit: false, open_bit: false, upper_block_bit: true });
  add(doorX - 1, 2, 1, B.lever, { facing_direction: 3, open_bit: false });

  // Flat roof one block above the walls.
  for (let x = 0; x < W; x++) {
    for (let z = 0; z < D; z++) {
      add(x, H + 1, z, x === 0 || x === W - 1 || z === 0 || z === D - 1 ? B.trim : B.roof);
    }
  }

  // Ceiling lights so nothing can spawn indoors.
  for (let x = 3; x < W - 2; x += 5) {
    for (let z = 3; z < D - 2; z += 5) add(x, H, z, B.light);
  }

  // Furniture along the back wall.
  add(2, 1, D - 2, "minecraft:crafting_table");
  add(3, 1, D - 2, "minecraft:furnace");
  add(4, 1, D - 2, "minecraft:chest");
  add(5, 1, D - 2, "minecraft:barrel");
  add(W - 3, 1, D - 2, "minecraft:bed");
  add(W - 3, 1, D - 3, "minecraft:bed");

  // The parapet over the front wall, carrying the name.
  const signBase = H + 2;
  for (let y = signBase; y < signBase + cfg.signHeight; y++) {
    for (let x = 0; x < W; x++) add(x, y, 0, B.wall);
  }
  for (const piece of nameplate(W, signBase, B.letter)) pieces.push(piece);

  return pieces;
}

/** Spells IMRAN across the parapet in gold. */
function nameplate(width, baseY, letterBlock) {
  const pieces = [];
  const letters = HOUSE_NAME.split("");
  const totalWidth = letters.length * 3 + (letters.length - 1);
  let cursorX = Math.max(0, Math.floor((width - totalWidth) / 2));

  for (const letter of letters) {
    const rows = FONT[letter];
    if (!rows) {
      cursorX += 4;
      continue;
    }
    for (let row = 0; row < rows.length; row++) {
      for (let column = 0; column < rows[row].length; column++) {
        if (rows[row][column] !== "1") continue;
        pieces.push({
          x: cursorX + column,
          // Row 0 is the top of the letter, so count down from the top.
          y: baseY + (rows.length - 1 - row),
          z: 0,
          block: letterBlock
        });
      }
    }
    cursorX += 4;
  }
  return pieces;
}

/** Used by the tests. */
export { HOUSE_NAME, describeHouse, nameplate };
