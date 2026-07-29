/**
 * Extreme Blizzard - "am I actually safe in here?"
 *
 * This is the heart of the pack. A player is only safe from the storm when they
 * are standing in a **sealed room with a heat source in it**. Both halves are
 * checked honestly:
 *
 *   sealed  a flood fill of the air around the player finishes inside a set
 *           number of blocks. A real room closes; a doorway left open, a hole in
 *           the roof or the open world runs past the limit and counts as
 *           outdoors, so you cannot cheat with a wall and a roof alone.
 *   warm    at least one heat source touches that same body of air - a heater,
 *           campfire, lit furnace, torch, lava. A sealed room with no fire in it
 *           only slows the freezing down.
 *
 * The flood fill is bounded (160 cells, radius 14) and only one player is
 * checked per pass, so this stays cheap enough for a phone.
 */

import { TUNING } from "./config.js";
import { blockIdAt, isAirId, isPassableId } from "./util.js";

/** Six neighbours of a cell. */
const NEIGHBOURS = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 }
];

/** Doors and trapdoors are see-through to the flood fill only when open. */
function isOpenable(typeId) {
  return typeId.includes("door") || typeId.includes("fence_gate");
}

/** Warmth value of a block, 0 when it is not a heat source. */
export function heatValue(typeId) {
  if (!typeId) return 0;
  const direct = TUNING.heatSources[typeId];
  if (direct !== undefined) return direct;
  if (typeId.includes("campfire") && !typeId.includes("unlit")) return 2;
  if (typeId.includes("froglight")) return 1;
  return 0;
}

/**
 * Works out where a player is standing.
 *
 * @returns {{status:"open"|"sheltered"|"warm", sealed:boolean, heat:number,
 *            cells:number, nearbyFire:number}}
 */
export function evaluateShelter(dimension, location) {
  const cfg = TUNING.shelter;
  const origin = {
    x: Math.floor(location.x),
    y: Math.floor(location.y),
    z: Math.floor(location.z)
  };

  const visited = new Set();
  const queue = [origin];
  visited.add(`${origin.x},${origin.y},${origin.z}`);

  let heat = 0;
  let cells = 0;
  let escaped = false;

  while (queue.length > 0) {
    if (cells >= cfg.maxRoomCells) {
      escaped = true; // the space just keeps going: this is the outdoors
      break;
    }
    const cell = queue.shift();
    cells++;

    for (const offset of NEIGHBOURS) {
      const next = { x: cell.x + offset.x, y: cell.y + offset.y, z: cell.z + offset.z };

      if (
        Math.abs(next.x - origin.x) > cfg.maxRoomRadius ||
        Math.abs(next.z - origin.z) > cfg.maxRoomRadius ||
        Math.abs(next.y - origin.y) > cfg.maxRoomRadius
      ) {
        escaped = true; // reached the edge of the search box without closing
        break;
      }

      const key = `${next.x},${next.y},${next.z}`;
      if (visited.has(key)) continue;

      const id = blockIdAt(dimension, next);
      if (id === undefined) {
        // Unloaded chunk: treat as a wall rather than pretending it is open.
        visited.add(key);
        continue;
      }

      const warmth = heatValue(id);
      if (warmth > 0) {
        heat += warmth;
        visited.add(key);
        continue; // a lit block is a wall to the fill, but a warm one
      }

      if (isAirId(id) || (isPassableId(id) && !isOpenable(id))) {
        visited.add(key);
        queue.push(next);
      } else {
        visited.add(key); // solid wall, floor or ceiling
      }
    }
    if (escaped) break;
  }

  const sealed = !escaped;
  const nearbyFire = sealed ? 0 : countNearbyFire(dimension, origin);

  let status = "open";
  if (sealed && heat >= cfg.heatNeeded) status = "warm";
  else if (sealed) status = "sheltered";

  return { status, sealed, heat, cells, nearbyFire };
}

/** Heat found in the open, e.g. huddling by a campfire outdoors. */
function countNearbyFire(dimension, origin) {
  const radius = TUNING.shelter.outdoorFireRadius;
  let total = 0;
  for (let dx = -radius; dx <= radius; dx += 2) {
    for (let dy = -2; dy <= 2; dy += 2) {
      for (let dz = -radius; dz <= radius; dz += 2) {
        const id = blockIdAt(dimension, { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz });
        total += heatValue(id);
        if (total >= 4) return total;
      }
    }
  }
  return total;
}

/** Leather armour is the only clothing that helps, as a damage-rate cut. */
export function insulationPercent(player) {
  let pieces = 0;
  try {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return 0;
    for (const slot of ["Head", "Chest", "Legs", "Feet"]) {
      const item = equippable.getEquipment(slot);
      if (!item) continue;
      const id = item.typeId;
      if (id.startsWith("minecraft:leather_")) pieces++;
      else if (id.includes("netherite")) pieces++; // thick and heavy, counts too
    }
  } catch {
    return 0;
  }
  return pieces * TUNING.temperature.leatherResistPercent;
}
