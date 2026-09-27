import { world } from "@minecraft/server";
import { ALTAR_TO_TYPE, BLOCK, MARKER, RUIN_TYPES, TUNING } from "./config.js";
import { allRuins, markDirty, registerRuin } from "./registry.js";
import { blockAt, blockIdOf, distH, isBlock, playNear, setBlock, warn } from "./util.js";

/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("./registry.js").Ruin} Ruin */

/**
 * A ruin marker was summoned by a ruin's core command block (or placed with
 * the structure). Find the altar under it, register the ruin, remove the
 * command block and the marker.
 * @param {Entity} entity
 * @returns {boolean} true when the marker was handled (or discarded)
 */
export function handleMarker(entity) {
  let dim;
  let loc;
  try {
    if (!entity.isValid()) return true;
    dim = entity.dimension;
    loc = entity.location;
  } catch {
    return true;
  }
  let altar;
  let type;
  for (const dy of [0, -1, -2, 1]) {
    const b = blockAt(dim, { x: loc.x, y: loc.y + dy, z: loc.z });
    if (!b) return false; // chunk not ready yet, try again on the next sweep
    const id = blockIdOf(b);
    if (id && ALTAR_TO_TYPE[id]) {
      altar = b;
      type = ALTAR_TO_TYPE[id];
      break;
    }
  }
  if (altar && type) {
    const core = altar.below();
    if (core && isBlock(core, BLOCK.commandBlock)) {
      try {
        setBlock(core, BLOCK.vaultSeal);
      } catch (e) {
        warn("core swap", e);
      }
    }
    const { isNew } = registerRuin(type, dim.id, core ? core.location : altar.location, true);
    if (isNew) announceDiscovery(dim, altar.location, type);
  }
  try {
    entity.remove();
  } catch {
    // already gone
  }
  return true;
}

/**
 * @param {import("@minecraft/server").Dimension} dim
 * @param {import("@minecraft/server").Vector3} loc
 * @param {string} type
 */
function announceDiscovery(dim, loc, type) {
  const info = RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
  for (const p of dim.getPlayers({ location: loc, maxDistance: 96 })) {
    try {
      p.sendMessage(`§7Ancient stones rumble somewhere nearby... a ${info.color}${info.name}§7 was charted on your Ancient Map.`);
    } catch {
      // ignore
    }
  }
}

/** Re-scan for markers the spawn/load events may have missed. */
export function sweepMarkers() {
  for (const id of ["minecraft:overworld"]) {
    let list = [];
    try {
      list = world.getDimension(id).getEntities({ type: MARKER });
    } catch {
      continue;
    }
    for (const e of list) handleMarker(e);
  }
}

/**
 * Chart a ruin from something a player touched inside it (fallback when the
 * core command block cannot run, e.g. command blocks disabled).
 * @param {string} type
 * @param {Player} player
 * @param {import("@minecraft/server").Vector3} loc
 */
export function chartApprox(type, player, loc) {
  const { ruin, isNew } = registerRuin(type, player.dimension.id, loc, false);
  if (isNew) {
    const info = RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (type)];
    player.sendMessage(`§7You have charted a ${info.color}${info.name}§7. Check your Ancient Map.`);
  }
  return ruin;
}

/**
 * Wake a ruin's first guardians when a player comes close, and open vaults
 * whose boss died while the vault chunk was unloaded.
 * @param {Player[]} players
 * @param {(ruin: Ruin) => void} openVault
 */
export function proximityTick(players, openVault) {
  const ruins = allRuins();
  if (!ruins.length) return;
  for (const player of players) {
    let dim;
    let loc;
    try {
      dim = player.dimension;
      loc = player.location;
    } catch {
      continue;
    }
    for (const ruin of ruins) {
      if (ruin.d !== dim.id) continue;
      if (Math.abs(ruin.y - loc.y) > 24) continue;
      const d = distH(ruin, loc);
      if (d > TUNING.populateRadius) continue;
      if (ruin.c && !ruin.v) openVault(ruin);
      if (!ruin.p && ruin.pr && !ruin.a) populate(ruin, dim, player);
    }
  }
}

const GUARD_OFFSETS = [[2, 2], [-2, -2], [2, -2], [-2, 2]];

/**
 * @param {Ruin} ruin
 * @param {import("@minecraft/server").Dimension} dim
 * @param {Player} player
 */
function populate(ruin, dim, player) {
  const info = RUIN_TYPES[/** @type {keyof typeof RUIN_TYPES} */ (ruin.t)];
  if (!info) return;
  const count = ruin.t === "sunken_ship" ? 2 : 3;
  let spawned = 0;
  for (const [dx, dz] of GUARD_OFFSETS) {
    if (spawned >= count) break;
    const pos = { x: ruin.x + dx + 0.5, y: ruin.y + 1, z: ruin.z + dz + 0.5 };
    const b = blockAt(dim, pos);
    if (!b) return; // not loaded yet, retry later
    if (!b.isAir && !b.isLiquid) continue;
    try {
      dim.spawnEntity(info.guardian, pos);
      spawned++;
    } catch (e) {
      warn("populate", e);
    }
  }
  ruin.p = 1;
  markDirty();
  if (spawned) {
    playNear(dim, "ambient.cave", player.location, 32, 0.8, 0.8);
    player.sendMessage(`§7Stone grinds on stone... the guardians of the ${info.color}${info.name}§7 stir.`);
  }
}
