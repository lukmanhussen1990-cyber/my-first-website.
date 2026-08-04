// The Hollow Bride - persistence.
// All progress lives in world dynamic properties. Never scoreboards, never NBT.
// Keys are namespaced "hb:" and, for per-player values, "hb:<playerId>:<field>".

import { world } from "@minecraft/server";
import { log } from "./util.js";

const PREFIX = "hb:";

export function gget(key, fallback) {
  try {
    const v = world.getDynamicProperty(PREFIX + key);
    return v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function gset(key, value) {
  try {
    world.setDynamicProperty(PREFIX + key, value);
    return true;
  } catch (e) {
    log("dynamic property write failed for " + key);
    return false;
  }
}

export function pget(player, field, fallback) {
  try {
    return gget(player.id + ":" + field, fallback);
  } catch (e) {
    return fallback;
  }
}

export function pset(player, field, value) {
  try {
    return gset(player.id + ":" + field, value);
  } catch (e) {
    return false;
  }
}

export function pnum(player, field, fallback) {
  const v = pget(player, field, fallback);
  return typeof v === "number" ? v : fallback;
}

export function pbool(player, field, fallback) {
  const v = pget(player, field, fallback);
  return typeof v === "boolean" ? v : fallback;
}

export function pstr(player, field, fallback) {
  const v = pget(player, field, fallback);
  return typeof v === "string" ? v : fallback;
}

// ---- Defaults applied the first time a player is seen -----------------------

export function ensurePlayer(player) {
  if (pbool(player, "init", false)) return false;
  pset(player, "init", true);
  pset(player, "sanity", 100);
  pset(player, "candle_fuel", 0);
  pset(player, "candle_lit", false);
  pset(player, "noise", 0);
  pset(player, "room", "approach");
  pset(player, "act", 0);
  pset(player, "keys", 0);
  pset(player, "pages", "");
  pset(player, "hiding", false);
  pset(player, "hide_x", 0);
  pset(player, "hide_y", 0);
  pset(player, "hide_z", 0);
  pset(player, "cp_x", 1015);
  pset(player, "cp_y", 65);
  pset(player, "cp_z", 996);
  pset(player, "intensity", "normal");
  pset(player, "flashes", true);
  pset(player, "configured", false);
  pset(player, "quiet", 0);
  pset(player, "bell_charges", 3);
  pset(player, "salt_left", 12);
  pset(player, "shots", "");
  pset(player, "ending", "");
  return true;
}

export function hasKey(player, id) {
  const mask = pnum(player, "keys", 0);
  return (mask & (1 << (id - 1))) !== 0;
}

export function giveKeyFlag(player, id) {
  const mask = pnum(player, "keys", 0);
  pset(player, "keys", mask | (1 << (id - 1)));
}

export function keyCount(player) {
  const mask = pnum(player, "keys", 0);
  let n = 0;
  for (let i = 0; i < 5; i++) if (mask & (1 << i)) n++;
  return n;
}

export function pagesFound(player) {
  const raw = pstr(player, "pages", "");
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));
}

export function addPage(player, id) {
  const list = pagesFound(player);
  if (list.indexOf(id) !== -1) return false;
  list.push(id);
  pset(player, "pages", list.join(","));
  return true;
}

export function shotsTaken(player) {
  const raw = pstr(player, "shots", "");
  if (!raw) return [];
  return raw
    .split(",")
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));
}

export function addShot(player, portraitIndex) {
  const list = shotsTaken(player);
  list.push(portraitIndex);
  pset(player, "shots", list.join(","));
  return list;
}

export function clearShots(player) {
  pset(player, "shots", "");
}

export function setCheckpoint(player, loc) {
  pset(player, "cp_x", Math.floor(loc.x));
  pset(player, "cp_y", Math.floor(loc.y));
  pset(player, "cp_z", Math.floor(loc.z));
}

export function getCheckpoint(player) {
  return {
    x: pnum(player, "cp_x", 1015) + 0.5,
    y: pnum(player, "cp_y", 65),
    z: pnum(player, "cp_z", 996) + 0.5
  };
}
