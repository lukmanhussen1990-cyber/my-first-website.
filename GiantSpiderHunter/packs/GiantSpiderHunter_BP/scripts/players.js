// Eligible players: survival/adventure, in the Overworld, alive, valid.
// The list is computed at most once per game tick and shared by every system.
import { GameMode, system, world } from '@minecraft/server';

export const OVERWORLD = 'minecraft:overworld';
const EXCLUDED_MODES = [GameMode.creative, GameMode.spectator];
const QUERY = { excludeGameModes: EXCLUDED_MODES };

let cacheTick = -1;
let cache = [];

export function isAlive(player) {
  try {
    const h = player.getComponent('minecraft:health');
    return !h || h.currentValue > 0;
  } catch (e) {
    return false;
  }
}

/** Full eligibility test for one player (never throws). */
export function isEligible(player) {
  try {
    return (
      !!player &&
      player.isValid() &&
      player.dimension.id === OVERWORLD &&
      player.matches(QUERY) &&
      isAlive(player)
    );
  } catch (e) {
    return false;
  }
}

/** Survival/adventure test only (used where dimension does not matter). */
export function isSurvivalLike(player) {
  try {
    return !!player && player.isValid() && player.matches(QUERY);
  } catch (e) {
    return false;
  }
}

/** All eligible players (cached per tick). */
export function eligiblePlayers() {
  const t = system.currentTick;
  if (t === cacheTick) return cache;
  cacheTick = t;
  let list = [];
  try {
    list = world.getPlayers(QUERY);
  } catch (e) {
    list = [];
  }
  cache = list.filter((p) => {
    try {
      return p.isValid() && p.dimension.id === OVERWORLD && isAlive(p);
    } catch (e) {
      return false;
    }
  });
  return cache;
}

export function allPlayers() {
  try {
    return world.getPlayers();
  } catch (e) {
    return [];
  }
}

/** Eligible players in the given dimension within `range` of `loc`, nearest first: [{player, d}]. */
export function eligibleNear(dimId, loc, range) {
  const out = [];
  if (dimId !== OVERWORLD) return out;
  for (const p of eligiblePlayers()) {
    try {
      const l = p.location;
      const dx = l.x - loc.x;
      const dy = l.y - loc.y;
      const dz = l.z - loc.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d <= range) out.push({ player: p, d });
    } catch (e) {
      // player became invalid mid-tick
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

export function findPlayerById(id) {
  if (!id) return undefined;
  for (const p of allPlayers()) {
    try {
      if (p.id === id) return p;
    } catch (e) {
      // ignore
    }
  }
  return undefined;
}
