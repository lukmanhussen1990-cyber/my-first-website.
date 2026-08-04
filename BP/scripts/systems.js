// The Hollow Bride - the ten mechanics.
// Everything here runs for exactly one player per loop tick (round robin).

import { world } from "@minecraft/server";
import {
  ROOMS,
  PROPS,
  SANITY,
  CANDLE,
  NOISE,
  INTENSITY,
  SILENCE_TICKS,
  LOOP_TICKS
} from "./config.js";
import {
  clamp,
  dist,
  distFlat,
  inBox,
  hint,
  sound,
  effect,
  particle,
  getBlockAt,
  getState,
  spawn,
  entitiesOfType,
  runCmd,
  norm,
  sub,
  dot,
  dim,
  pick,
  titleCard
} from "./util.js";
import { pget, pset, pnum, pbool, pstr, setCheckpoint, getCheckpoint } from "./state.js";

// ---- Rooms ------------------------------------------------------------------

export function roomAt(loc) {
  for (const r of ROOMS) {
    if (inBox(loc, r.min, r.max)) return r;
  }
  return undefined;
}

export function roomById(id) {
  return ROOMS.find((r) => r.id === id);
}

export function updateRoom(player) {
  const r = roomAt(player.location);
  if (!r) return undefined;
  const prev = pstr(player, "room", "approach");
  if (r.id !== prev) {
    pset(player, "room", r.id);
    // Auto-checkpoint on every room entry.
    setCheckpoint(player, r.spawn);
    sound(player, "ag.checkpoint", 0.8, 0.5);
    titleCard(player, r.name, "Checkpoint saved");
    applyFog(player, r.fog);
    if (r.act > pnum(player, "act", 0)) pset(player, "act", r.act);
  }
  return r;
}

export function applyFog(player, fogId) {
  runCmd(player, "fog @s remove ag_room");
  runCmd(player, "fog @s push " + fogId + " ag_room");
}

export function applySanityFog(player, on) {
  if (on) {
    runCmd(player, "fog @s push ag:sanity_fog ag_sanity");
  } else {
    runCmd(player, "fog @s remove ag_sanity");
  }
}

// ---- Candle -----------------------------------------------------------------

function candleDrainFor(roomId, player) {
  if (roomId === "cellar") return CANDLE.drainDamp;
  if (roomId === "approach") return CANDLE.drainWindy;
  try {
    const b = getBlockAt(player.location);
    if (b && b.typeId === "minecraft:water") return CANDLE.drainDamp;
  } catch (e) {
    // ignore
  }
  return CANDLE.drainNormal;
}

function heldSlot(player) {
  if (typeof player.selectedSlotIndex === "number") return player.selectedSlotIndex;
  if (typeof player.selectedSlot === "number") return player.selectedSlot;
  return 0;
}

export function heldItem(player) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return undefined;
    return inv.container.getItem(heldSlot(player));
  } catch (e) {
    return undefined;
  }
}

function syncCandleDurability(player, fuel) {
  try {
    const inv = player.getComponent("minecraft:inventory");
    if (!inv || !inv.container) return;
    const slot = heldSlot(player);
    const item = inv.container.getItem(slot);
    if (!item || item.typeId !== "ag:tallow_candle") return;
    const dur = item.getComponent("minecraft:durability");
    if (!dur) return;
    const used = Math.floor(CANDLE.maxFuel - fuel);
    dur.damage = clamp(used, 0, CANDLE.maxFuel - 1);
    inv.container.setItem(slot, item);
  } catch (e) {
    // ignore
  }
}

export function tickCandle(player, room) {
  let fuel = pnum(player, "candle_fuel", 0);
  const lit = pbool(player, "candle_lit", false);
  if (!lit || fuel <= 0) {
    if (lit && fuel <= 0) {
      pset(player, "candle_lit", false);
      sound(player, "ag.candle_out", 0.8, 0.7);
      hint(player, "The wick drowns. Find tallow.");
    }
    return false;
  }
  fuel -= candleDrainFor(room ? room.id : "foyer", player);
  fuel = clamp(fuel, 0, CANDLE.maxFuel);
  pset(player, "candle_fuel", fuel);
  syncCandleDurability(player, fuel);

  const held = heldItem(player);
  if (held && held.typeId === "ag:tallow_candle") {
    const loc = player.getHeadLocation();
    particle("ag:candle_flame", { x: loc.x, y: loc.y - 0.2, z: loc.z });
  }
  if (fuel < 120 && fuel % 40 === 0) {
    hint(player, "The flame is guttering.");
  }
  return true;
}

export function lightCandle(player) {
  const fuel = pnum(player, "candle_fuel", 0);
  if (fuel <= 0) {
    hint(player, "No tallow left in the cup.");
    sound(player, "ag.candle_out", 0.9, 0.5);
    return false;
  }
  pset(player, "candle_lit", true);
  sound(player, "ag.candle_light", 1.0, 0.8);
  hint(player, "The candle takes.");
  return true;
}

export function snuffCandle(player) {
  pset(player, "candle_lit", false);
  sound(player, "ag.candle_out", 0.8, 0.7);
  hint(player, "Dark. Something notices.");
}

export function refuelCandle(player, amount) {
  const fuel = clamp(pnum(player, "candle_fuel", 0) + amount, 0, CANDLE.maxFuel);
  pset(player, "candle_fuel", fuel);
  syncCandleDurability(player, fuel);
}

// ---- Light safety -----------------------------------------------------------

export function litWallCandleNear(loc, radius) {
  for (const c of PROPS.wallCandles) {
    if (dist(loc, c) > radius) continue;
    const b = getBlockAt(c);
    if (b && b.typeId === "ag:wall_candle" && getState(b, "ag:lit") === true) return true;
  }
  return false;
}

export function saltUnderfoot(player) {
  const l = player.location;
  const spots = [
    { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z) },
    { x: Math.floor(l.x) + 1, y: Math.floor(l.y) - 1, z: Math.floor(l.z) },
    { x: Math.floor(l.x) - 1, y: Math.floor(l.y) - 1, z: Math.floor(l.z) },
    { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z) + 1 },
    { x: Math.floor(l.x), y: Math.floor(l.y) - 1, z: Math.floor(l.z) - 1 }
  ];
  for (const s of spots) {
    const b = getBlockAt(s);
    if (b && b.typeId === "ag:salt_line") return true;
  }
  return false;
}

export function isLightSafe(player, room) {
  if (pbool(player, "candle_lit", false) && pnum(player, "candle_fuel", 0) > 0) return true;
  if (litWallCandleNear(player.location, 8)) return true;
  if (room && room.id === "approach") return true;
  return false;
}

// ---- Noise ------------------------------------------------------------------

export function tickNoise(player) {
  let noise = pnum(player, "noise", 0);
  noise -= NOISE.decay;
  try {
    if (player.isSprinting) noise += NOISE.sprint;
  } catch (e) {
    // ignore
  }
  noise = clamp(noise, 0, NOISE.max);
  pset(player, "noise", noise);
  return noise;
}

export function addNoise(player, amount) {
  const noise = clamp(pnum(player, "noise", 0) + amount, 0, NOISE.max);
  pset(player, "noise", noise);
  return noise;
}

// ---- Sanity -----------------------------------------------------------------

function nearbyHorrorCount(player) {
  try {
    const d = dim();
    if (!d) return 0;
    const list = d.getEntities({
      location: player.location,
      maxDistance: 12,
      families: ["ag_horror"]
    });
    return list.length;
  } catch (e) {
    return 0;
  }
}

export function tickSanity(player, room) {
  let s = pnum(player, "sanity", 100);
  const safe = isLightSafe(player, room);
  const onSalt = saltUnderfoot(player);
  const horrors = nearbyHorrorCount(player);

  if (onSalt) s += SANITY.saltRestore;
  else if (safe) s += SANITY.candleRestore;
  else s -= SANITY.darkDrain;

  if (horrors > 0) s -= SANITY.entityDrain * Math.min(horrors, 3);

  s = clamp(s, 0, SANITY.max);
  pset(player, "sanity", s);
  return s;
}

export function applySanityEffects(player, s, room) {
  const flashes = pbool(player, "flashes", true);
  if (s >= 75) {
    applySanityFog(player, false);
    return;
  }
  if (s >= SANITY.tierWhisper) {
    applySanityFog(player, false);
    if (Math.random() < 0.12) sound(player, "ag.whisper", 1.4, 0.3);
    return;
  }
  if (s >= SANITY.tierHallucination) {
    applySanityFog(player, false);
    if (Math.random() < 0.2) sound(player, "ag.whisper", 1.2, 0.45);
    if (Math.random() < 0.08) runCmd(player, "camerashake add @s 0.03 1 rotational");
    return;
  }
  if (s >= SANITY.tierFog) {
    applySanityFog(player, false);
    if (Math.random() < 0.25) sound(player, "ag.whisper", 0.9, 0.6);
    if (Math.random() < 0.15) runCmd(player, "camerashake add @s 0.05 1.5 rotational");
    maybeHallucinate(player, room);
    return;
  }
  // Tier 10 and below: heavy fog, distorted audio, false jumpscares.
  applySanityFog(player, true);
  if (Math.random() < 0.3) sound(player, "ag.whisper", 0.55, 0.8);
  if (flashes && Math.random() < 0.08) {
    sound(player, "ag.scare", 0.7, 0.6);
    runCmd(player, "camerashake add @s 0.12 0.6 rotational");
  }
  maybeHallucinate(player, room);
}

function hallucinationCap(player) {
  const mode = pstr(player, "intensity", "normal");
  const cfg = INTENSITY[mode] || INTENSITY.normal;
  return cfg.hallucinations;
}

export function maybeHallucinate(player, room) {
  if (Math.random() > 0.15) return;
  const existing = entitiesOfType("ag:hallucination");
  if (existing.length >= hallucinationCap(player)) return;
  try {
    const head = player.getHeadLocation();
    const view = player.getViewDirection();
    const at = {
      x: head.x + view.x * 7 + (Math.random() * 4 - 2),
      y: Math.floor(head.y) - 1,
      z: head.z + view.z * 7 + (Math.random() * 4 - 2)
    };
    if (room && !inBox(at, room.min, room.max)) return;
    spawn("ag:hallucination", at);
  } catch (e) {
    // ignore
  }
}

// Hallucinations are harmless and vanish the moment you look away.
export function cullHallucinations(player) {
  const list = entitiesOfType("ag:hallucination");
  if (list.length === 0) return;
  let view;
  let head;
  try {
    view = player.getViewDirection();
    head = player.getHeadLocation();
  } catch (e) {
    return;
  }
  for (const h of list) {
    try {
      const d = dist(head, h.location);
      if (d > 24) {
        h.triggerEvent("ag:despawn");
        continue;
      }
      const to = norm(sub(h.location, head));
      if (dot(view, to) < 0.2) h.triggerEvent("ag:despawn");
    } catch (e) {
      // ignore
    }
  }
}

// ---- Observation ------------------------------------------------------------

// Returns { dot, clear } for an entity or location relative to the player's view.
export function observation(player, target) {
  try {
    const head = player.getHeadLocation();
    const view = player.getViewDirection();
    const to = sub(target, head);
    const d = Math.sqrt(to.x * to.x + to.y * to.y + to.z * to.z);
    const nd = norm(to);
    const dp = dot(view, nd);
    if (dp <= 0.35) return { dot: dp, clear: false, distance: d };
    let clear = true;
    try {
      const hit = player.dimension.getBlockFromRay(head, nd, {
        maxDistance: Math.min(d, 32),
        includePassableBlocks: false,
        includeLiquidBlocks: false
      });
      if (hit && hit.block) {
        const hd = dist(head, hit.block.location);
        if (hd < d - 1.2) clear = false;
      }
    } catch (e) {
      clear = true;
    }
    return { dot: dp, clear: clear, distance: d };
  } catch (e) {
    return { dot: -1, clear: false, distance: 999 };
  }
}

export function isObserved(player, target) {
  const o = observation(player, target);
  return o.dot > 0.35 && o.clear;
}

// ---- Hiding -----------------------------------------------------------------

export function enterHiding(player, blockLoc) {
  pset(player, "hiding", true);
  pset(player, "hide_x", blockLoc.x);
  pset(player, "hide_y", blockLoc.y);
  pset(player, "hide_z", blockLoc.z);
  sound(player, "ag.wardrobe", 0.6, 0.8);
  sound(player, "ag.muffled", 0.5, 0.6);
  hint(player, "Hidden. Tap again to come out.");
  try {
    player.teleport({ x: blockLoc.x + 0.5, y: blockLoc.y, z: blockLoc.z + 0.5 });
  } catch (e) {
    // ignore
  }
  const b = getBlockAt(blockLoc);
  if (b) {
    try {
      b.setPermutation(b.permutation.withState("ag:occupied", true));
    } catch (e) {
      // ignore
    }
  }
}

export function exitHiding(player) {
  const loc = {
    x: pnum(player, "hide_x", 0),
    y: pnum(player, "hide_y", 0),
    z: pnum(player, "hide_z", 0)
  };
  pset(player, "hiding", false);
  const b = getBlockAt(loc);
  if (b) {
    try {
      b.setPermutation(b.permutation.withState("ag:occupied", false));
    } catch (e) {
      // ignore
    }
  }
  sound(player, "ag.wardrobe", 0.6, 0.5);
  hint(player, "You step back into the room.");
}

export function tickHiding(player, loopCount) {
  if (!pbool(player, "hiding", false)) return false;
  effect(player, "invisibility", 40, 0);
  effect(player, "slowness", 40, 255);
  effect(player, "weakness", 40, 0);
  if (loopCount % 4 === 0) sound(player, "ag.heartbeat", 1.0, 0.7);
  return true;
}

// ---- Scare pacing -----------------------------------------------------------

export function tickQuiet(player) {
  const q = pnum(player, "quiet", 0) + LOOP_TICKS;
  pset(player, "quiet", q);
  return q;
}

export function canScare(player) {
  const mode = pstr(player, "intensity", "normal");
  const cfg = INTENSITY[mode] || INTENSITY.normal;
  const q = pnum(player, "quiet", 0);
  return q >= Math.max(SILENCE_TICKS, cfg.scareEvery);
}

export function markScare(player) {
  pset(player, "quiet", 0);
}

// Every jumpscare gets a tell: sound plus a visual, both 2 seconds early.
export function tell(player, message) {
  sound(player, "ag.tell", 0.6, 0.6);
  hint(player, message || "Something inhales.");
  try {
    const l = player.location;
    particle("ag:dust_motes", { x: l.x, y: l.y + 1, z: l.z });
  } catch (e) {
    // ignore
  }
}

export function damageScaled(player, amount) {
  const mode = pstr(player, "intensity", "normal");
  const cfg = INTENSITY[mode] || INTENSITY.normal;
  const dmg = Math.max(1, Math.round(amount * cfg.damageScale));
  try {
    const hp = player.getComponent("minecraft:health");
    if (hp && hp.currentValue - dmg <= 1) {
      // Never an instant death: bottom out at half a heart and send them back.
      hp.setCurrentValue(1);
      sendToCheckpoint(player, "She found you. Again.");
      return;
    }
    player.applyDamage(dmg);
  } catch (e) {
    // ignore
  }
}

export function sendToCheckpoint(player, message) {
  const cp = getCheckpoint(player);
  try {
    player.teleport(cp);
  } catch (e) {
    // ignore
  }
  pset(player, "sanity", 40);
  pset(player, "hiding", false);
  markScare(player);
  titleCard(player, "You wake at the door", message || "Nothing was taken.");
  sound(player, "ag.checkpoint", 0.7, 0.6);
}
