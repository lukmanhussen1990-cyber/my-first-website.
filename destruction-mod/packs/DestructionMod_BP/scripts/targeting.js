// @ts-check
// "Where should it hit?" - turns a target mode into a place in the world.
import { world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showAction, showModal } from "./forms.js";
import { clamp, fmt, groundY, isLoaded, notify, rand, tell, yLimits } from "./util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */

/**
 * @typedef {Object} Target
 * @property {Dimension} dim
 * @property {Vector3} pos    standing point on top of the target block
 * @property {Vector3} core   centre of the target block
 * @property {string} label   shown to the player
 */

/** Direction of each block face, used to step out of the block that was hit. */
const FACE = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

/** @param {Dimension} dim @param {Vector3} pos @param {string} label @returns {Target} */
function standingTarget(dim, pos, label) {
  return { dim, pos, core: { x: pos.x, y: pos.y - 0.5, z: pos.z }, label };
}

/**
 * The block under the crosshair.
 * @param {Player} player @param {number} range @param {boolean} [warn]
 * @returns {Target | undefined}
 */
export function aimTarget(player, range, warn = true) {
  let hit;
  try {
    hit = player.getBlockFromViewDirection({ maxDistance: range, includeLiquidBlocks: true, includePassableBlocks: false });
  } catch {
    hit = undefined;
  }
  if (!hit) {
    if (warn) notify(player, `§cNothing to hit within ${range} blocks - aim at the ground`);
    return undefined;
  }
  const b = hit.block;
  const f = FACE[hit.face] ?? FACE.Up;
  const pos = { x: b.x + 0.5 + f.x, y: b.y + f.y, z: b.z + 0.5 + f.z };
  return { dim: player.dimension, pos, core: { x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 }, label: `${b.x} ${b.y} ${b.z}` };
}

// ---------------------------------------------------------------- marker
/** @param {Player} player @param {Dimension} dim @param {Vector3} pos */
export function setMarker(player, dim, pos) {
  player.setDynamicProperty("destruct:marker", pos);
  player.setDynamicProperty("destruct:marker_dim", dim.id);
}

/** @param {Player} player */
export function clearMarker(player) {
  player.setDynamicProperty("destruct:marker", undefined);
  player.setDynamicProperty("destruct:marker_dim", undefined);
}

/** @param {Player} player @returns {{dim: Dimension, pos: Vector3} | undefined} */
export function getMarker(player) {
  try {
    const pos = player.getDynamicProperty("destruct:marker");
    const dimId = player.getDynamicProperty("destruct:marker_dim");
    if (!pos || typeof pos !== "object" || typeof dimId !== "string") return undefined;
    return { dim: world.getDimension(dimId), pos };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------- coordinates
/** "~" = your position, "~5" = 5 blocks from it, "120" = absolute. @param {string} s @param {number} base */
function parseCoord(s, base) {
  if (s === "" || s === "~") return base;
  const rel = s.startsWith("~");
  const n = Number(rel ? s.slice(1) : s);
  if (!Number.isFinite(n)) return undefined;
  return rel ? base + n : n;
}

/** @param {Player} player @returns {Promise<Target | undefined>} */
async function askCoords(player) {
  const last = String(player.getDynamicProperty("destruct:last_coords") ?? "~ ~ ~").split(" ");
  const form = new ModalFormData()
    .title("§lType coordinates")
    .textField("§fX §7(~ = where you stand, ~10 = 10 blocks from you)", "e.g. 120 or ~", last[0] ?? "~")
    .textField("§fY §7(if it's in the air, the strike drops to the ground)", "e.g. 64 or ~", last[1] ?? "~")
    .textField("§fZ", "e.g. -35 or ~", last[2] ?? "~");
  const res = await showModal(player, form);
  if (!res || res.canceled || !res.formValues || !player.isValid()) return undefined;

  const [sx, sy, sz] = res.formValues.map((v) => String(v).trim().replace(/\s+/g, ""));
  const here = player.location;
  const x = parseCoord(sx, here.x);
  const y = parseCoord(sy, here.y);
  const z = parseCoord(sz, here.z);
  if (x === undefined || y === undefined || z === undefined) {
    tell(player, "§cThose coordinates don't look right. §7Use numbers like §f120§7, §f-35§7 or §f~10§7.");
    return undefined;
  }
  player.setDynamicProperty("destruct:last_coords", `${sx || "~"} ${sy || "~"} ${sz || "~"}`);

  const dim = player.dimension;
  const lim = yLimits(dim);
  const pos = { x: Math.floor(x) + 0.5, y: clamp(Math.floor(y), lim.min, lim.max), z: Math.floor(z) + 0.5 };
  if (!isLoaded(dim, pos)) {
    tell(player, "§cThat spot isn't loaded (too far away). §7Get closer or pick a nearer spot.");
    return undefined;
  }
  // a point in mid-air snaps down onto the ground below it
  try {
    if (dim.getBlock(pos)?.isAir) {
      const gy = groundY(dim, pos.x, pos.z, pos.y, pos.y - lim.min + 1);
      if (gy !== undefined) pos.y = gy + 1;
    }
  } catch {
    // keep as typed
  }
  return standingTarget(dim, pos, fmt(pos));
}

// ---------------------------------------------------------------- players
/** @param {Player} player @returns {Promise<Target | undefined>} */
async function askPlayer(player) {
  const list = world.getAllPlayers();
  const form = new ActionFormData().title("§lStrike which player?").body("§7The strike lands where they are standing right now.");
  for (const p of list) form.button(p.id === player.id ? `§l${p.name}\n§r§8(you!)` : `§l${p.name}`, "textures/ui/destruct/player");
  const res = await showAction(player, form);
  if (!res || res.canceled || res.selection === undefined) return undefined;
  const t = list[res.selection];
  if (!t || !t.isValid()) {
    tell(player, "§cThat player isn't here any more.");
    return undefined;
  }
  const l = t.location;
  return standingTarget(t.dimension, { x: l.x, y: l.y, z: l.z }, t.name);
}

// ---------------------------------------------------------------- random
/** @param {Player} player @returns {Target | undefined} */
function randomSpot(player) {
  const dim = player.dimension;
  const here = player.location;
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(14, 36);
    const x = Math.floor(here.x + Math.cos(a) * d) + 0.5;
    const z = Math.floor(here.z + Math.sin(a) * d) + 0.5;
    const gy = groundY(dim, x, z, here.y + 30, 90);
    if (gy !== undefined) return standingTarget(dim, { x, y: gy + 1, z }, `random spot ${Math.floor(x)} ${gy + 1} ${Math.floor(z)}`);
  }
  tell(player, "§cCouldn't find a random spot nearby.");
  return undefined;
}

/**
 * Resolves a target mode for this player. Coordinates and players open a form.
 * @param {Player} player @param {string} mode @param {number} range
 * @returns {Promise<Target | undefined>}
 */
export async function resolveTarget(player, mode, range) {
  switch (mode) {
    case "marker": {
      const m = getMarker(player);
      if (!m) {
        tell(player, "§cNo marker set yet. §7Tap a block with the §2Target Marker§7 (or use the tablet) first.");
        return undefined;
      }
      if (!isLoaded(m.dim, m.pos)) {
        tell(player, "§cYour marker is too far away (not loaded). §7Get closer to it.");
        return undefined;
      }
      return standingTarget(m.dim, m.pos, `marker ${fmt(m.pos)}`);
    }
    case "coords":
      return askCoords(player);
    case "player":
      return askPlayer(player);
    case "random":
      return randomSpot(player);
    default:
      return aimTarget(player, range, true);
  }
}
