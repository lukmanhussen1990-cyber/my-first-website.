/**
 * Extreme Blizzard - the storm itself.
 *
 * Runs the calm/storm cycle, freezes every player who is not in a warm sealed
 * room, kills mobs caught in the open, and piles snow up over the world.
 *
 * Timeline of a player caught outside, at default settings:
 *
 *   0.0s  body heat 100, "FREEZING" on the action bar, whiteout fog
 *   ~2s   below 55: slowness and heavy frost particles
 *   ~4s   body heat hits 0
 *   ~5.5s dead
 *
 * Step inside a sealed, heated room and it climbs back at 22 a second.
 */

import { system, world } from "@minecraft/server";
import { TUNING, getSetting, harsh } from "./config.js";
import { SOUNDS } from "./sounds.js";
import { evaluateShelter, insulationPercent } from "./shelter.js";
import {
  actionBar,
  addEffectSafe,
  allPlayers,
  blockIdAt,
  damageEntity,
  entitiesNear,
  groundY,
  isAirId,
  playSoundAt,
  playSoundForPlayer,
  playersNear,
  randFloat,
  randInt,
  runCommand,
  setBlockSafe,
  showTitle,
  spawnParticleSafe
} from "./util.js";

/** player id -> { temp, status, fogOn, lastSound } */
const bodies = new Map();

let loopId = undefined;
let storming = false;
let phaseEndsAt = 0;
let shelterCursor = 0;
let blockBudget = 0;

/* ------------------------------------------------------------------ state -- */

export function isStorming() {
  return storming;
}

export function ticksLeftInPhase() {
  return Math.max(0, phaseEndsAt - system.currentTick);
}

/** Body heat of a player, 0-100. */
export function temperatureOf(player) {
  try {
    return bodies.get(player.id)?.temp ?? TUNING.temperature.max;
  } catch {
    return TUNING.temperature.max;
  }
}

export function statusOf(player) {
  try {
    return bodies.get(player.id)?.status ?? "warm";
  } catch {
    return "warm";
  }
}

export function statusText() {
  const phase = storming ? "§b§lBLIZZARD" : "§a§lCalm";
  const minutes = Math.ceil(ticksLeftInPhase() / 20 / 60);
  const lines = [`${phase}§r §7- ${storming ? "ends" : "next storm"} in about §f${minutes}m`];
  for (const player of allPlayers()) {
    const body = bodies.get(player.id);
    if (!body) continue;
    lines.push(`§7${player.name}: §f${Math.round(body.temp)}%§7 body heat (${labelFor(body.status)}§7)`);
  }
  return lines.join("\n");
}

function labelFor(status) {
  if (status === "warm") return "§awarm";
  if (status === "sheltered") return "§esheltered";
  return "§cexposed";
}

/* ------------------------------------------------------------------ setup -- */

export function initBlizzard() {
  if (loopId !== undefined) return;
  scheduleNextPhase(true);
  loopId = system.runInterval(() => {
    try {
      blizzardTick();
    } catch (error) {
      console.warn(`[Blizzard] tick: ${error}`);
    }
  }, TUNING.tickInterval);
}

/** Starts or ends the storm right now. */
export function setStorm(active, announce = true) {
  if (storming === active) {
    scheduleNextPhase(false);
    return;
  }
  storming = active;
  scheduleNextPhase(false);
  if (announce) announcePhase();
  if (!active) {
    for (const player of allPlayers()) clearFog(player);
    runCommand(world.getDimension("overworld"), "weather clear");
  }
}

function scheduleNextPhase(initial) {
  const minutes = storming ? getSetting("stormMinutes") : getSetting("calmMinutes");
  phaseEndsAt = system.currentTick + Math.max(1, minutes) * 60 * 20;
  if (initial) storming = getSetting("alwaysOn");
}

function announcePhase() {
  for (const player of allPlayers()) {
    if (storming) {
      showTitle(player, "§b§lBLIZZARD", "§fGet inside. Seal it. Light a fire.");
      playSoundForPlayer(player, SOUNDS.stormStart.custom, SOUNDS.stormStart.vanilla, { volume: 1.2, pitch: 0.7 });
    } else {
      showTitle(player, "§a§lThe storm passes", "§7It is safe to go out.");
      playSoundForPlayer(player, SOUNDS.stormEnd.custom, SOUNDS.stormEnd.vanilla, { volume: 1, pitch: 1.1 });
    }
  }
}

/* ------------------------------------------------------------------ ticks -- */

function blizzardTick() {
  blockBudget = TUNING.storm.maxBlockOpsPerTick;

  if (getSetting("alwaysOn") && !storming) setStorm(true);

  if (getSetting("enabled") && !getSetting("alwaysOn") && system.currentTick >= phaseEndsAt) {
    setStorm(!storming);
  }
  if (!getSetting("enabled") && storming && !getSetting("alwaysOn")) setStorm(false);

  const players = allPlayers();
  for (let i = 0; i < players.length; i++) {
    // Only one player gets the expensive shelter check each pass.
    const doShelterCheck = players.length === 0 ? false : i === shelterCursor % players.length;
    try {
      updatePlayer(players[i], doShelterCheck);
    } catch (error) {
      console.warn(`[Blizzard] player: ${error}`);
    }
  }
  shelterCursor++;

  if (!storming) return;

  keepWeatherFoul();
  if (getSetting("mobsFreeze")) freezeMobs(players);
  if (getSetting("snowBuildUp")) buildSnow(players);
}

function keepWeatherFoul() {
  if (system.currentTick % 200 !== 0) return;
  try {
    runCommand(world.getDimension("overworld"), "weather rain 400");
  } catch {
    // ignore
  }
}

/* --------------------------------------------------------------- freezing -- */

function updatePlayer(player, doShelterCheck) {
  let id;
  let location;
  let dimension;
  try {
    id = player.id;
    location = player.location;
    dimension = player.dimension;
  } catch {
    return;
  }

  let body = bodies.get(id);
  if (!body) {
    body = { temp: TUNING.temperature.max, status: "warm", fogOn: false, sound: 0 };
    bodies.set(id, body);
  }

  if (doShelterCheck || body.shelter === undefined) {
    body.shelter = evaluateShelter(dimension, location);
  }
  body.status = body.shelter.status;

  const seconds = TUNING.tickInterval / 20;
  const cfg = TUNING.temperature;

  if (!storming) {
    // No storm: warm up wherever you are.
    body.temp = Math.min(cfg.max, body.temp + cfg.riseWarm * seconds);
    if (body.fogOn) clearFog(player);
    body.fogOn = false;
    return;
  }

  const resist = 1 - Math.min(0.6, insulationPercent(player) / 100);

  if (body.status === "warm") {
    body.temp = Math.min(cfg.max, body.temp + cfg.riseWarm * seconds);
  } else if (body.status === "sheltered") {
    body.temp = Math.max(0, body.temp - harsh(cfg.dropSheltered) * resist * seconds);
  } else {
    const fireHelp = Math.min(1, (body.shelter.nearbyFire ?? 0) / 4);
    const drop = harsh(cfg.dropOutside) * resist * (1 - fireHelp);
    const rise = cfg.riseFireOutside * fireHelp;
    body.temp = Math.max(0, Math.min(cfg.max, body.temp - (drop - rise) * seconds));
  }

  applyEffects(player, body, dimension, location, seconds);
}

function applyEffects(player, body, dimension, location, seconds) {
  const cfg = TUNING.temperature;
  const exposed = body.status === "open";

  // Whiteout fog only while exposed to the storm.
  if (getSetting("fog")) {
    if (exposed && !body.fogOn) {
      pushFog(player);
      body.fogOn = true;
    } else if (!exposed && body.fogOn) {
      clearFog(player);
      body.fogOn = false;
    }
  }

  if (body.temp <= cfg.damageBelow && getSetting("deadlyOutside")) {
    damageEntity(player, Math.max(1, cfg.damagePerSecond * seconds), { cause: "freezing" });
    addEffectSafe(player, "slowness", 2, 2);
    addEffectSafe(player, "blindness", 2, 0, false);
    if (body.sound++ % 2 === 0) {
      playSoundForPlayer(player, SOUNDS.freezing.custom, SOUNDS.freezing.vanilla, { volume: 1, pitch: 0.6 });
    }
  } else if (body.temp < cfg.slowBelow) {
    addEffectSafe(player, "slowness", 2, body.temp < 25 ? 1 : 0, false);
    addEffectSafe(player, "weakness", 2, 0, false);
  }

  if (exposed) {
    for (let i = 0; i < 4; i++) {
      spawnParticleSafe(dimension, "sw:snow_flurry", {
        x: location.x + randFloat(-3, 3),
        y: location.y + randFloat(0, 4),
        z: location.z + randFloat(-3, 3)
      });
    }
    if (body.sound % 6 === 0) {
      playSoundAt(dimension, location, SOUNDS.wind.custom, SOUNDS.wind.vanilla, {
        volume: 0.9,
        pitch: randFloat(0.5, 0.8)
      });
    }
    body.sound++;
  } else if (body.status === "warm" && body.temp < cfg.max) {
    spawnParticleSafe(dimension, "sw:heat_shimmer", { x: location.x, y: location.y + 1, z: location.z });
  }

  actionBar(player, temperatureBar(body));
}

/** The readout: a bar, a percentage and what the game thinks of your shelter. */
function temperatureBar(body) {
  const filled = Math.round((body.temp / TUNING.temperature.max) * 10);
  const colour = body.temp > 60 ? "§a" : body.temp > 30 ? "§e" : "§c";
  const bar = `${colour}${"█".repeat(Math.max(0, filled))}§8${"█".repeat(Math.max(0, 10 - filled))}`;
  const label =
    body.status === "warm"
      ? "§aWarm and sealed"
      : body.status === "sheltered"
        ? "§eSealed, but no fire"
        : "§c§lFREEZING - get inside";
  return `${bar} §f${Math.round(body.temp)}%  ${label}`;
}

function pushFog(player) {
  try {
    player.runCommand("fog @s push sw:blizzard blizzard");
  } catch {
    // fog command unavailable - the particles still sell it
  }
}

function clearFog(player) {
  try {
    player.runCommand("fog @s remove blizzard");
  } catch {
    // ignore
  }
}

/** Called when a player leaves so their body heat is not kept forever. */
export function forgetPlayer(id) {
  bodies.delete(id);
}

/** Warms a player up, used by Hot Cocoa and the Hand Warmer. */
export function warmPlayer(player, amount) {
  try {
    const body = bodies.get(player.id);
    if (!body) return;
    body.temp = Math.min(TUNING.temperature.max, body.temp + amount);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------- mobs -- */

function freezeMobs(players) {
  const seconds = TUNING.tickInterval / 20;
  for (const player of players) {
    let dimension;
    let location;
    try {
      dimension = player.dimension;
      location = player.location;
    } catch {
      continue;
    }

    for (const entity of entitiesNear(dimension, location, 48)) {
      let typeId;
      let loc;
      try {
        typeId = entity.typeId;
        loc = entity.location;
      } catch {
        continue;
      }
      if (typeId === "minecraft:player") continue;
      if (typeId === "minecraft:item" || typeId === "minecraft:xp_orb") continue;
      if (TUNING.coldImmune.includes(typeId)) continue;

      // A roof is enough to save a mob: they do not need a fire.
      if (hasRoof(dimension, loc)) continue;

      damageEntity(entity, Math.max(1, TUNING.storm.mobDamagePerSecond * seconds), { cause: "freezing" });
      if (Math.random() < 0.25) {
        spawnParticleSafe(dimension, "sw:snow_flurry", { x: loc.x, y: loc.y + 1, z: loc.z });
      }
    }
  }
}

/** True when something solid is directly overhead within 12 blocks. */
function hasRoof(dimension, location) {
  const x = Math.floor(location.x);
  const z = Math.floor(location.z);
  const startY = Math.floor(location.y) + 1;
  for (let y = startY; y < startY + 12; y++) {
    const id = blockIdAt(dimension, { x, y, z });
    if (id === undefined) return true; // unloaded: assume covered
    if (!isAirId(id)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------- snow -- */

function buildSnow(players) {
  for (const player of players) {
    if (blockBudget <= 0) return;
    let dimension;
    let location;
    try {
      dimension = player.dimension;
      location = player.location;
    } catch {
      continue;
    }
    if (dimension.id !== "minecraft:overworld") continue;

    for (let i = 0; i < 6 && blockBudget > 0; i++) {
      const x = Math.floor(location.x) + randInt(-TUNING.storm.buildRadius, TUNING.storm.buildRadius);
      const z = Math.floor(location.z) + randInt(-TUNING.storm.buildRadius, TUNING.storm.buildRadius);

      // Find the real top of the column, counting water as the surface. The
      // normal ground scan treats water as passable and reports the sea bed,
      // which would leave lakes unfrozen.
      const surface = topOfColumn(dimension, x, z, location.y + 24);
      if (surface === undefined) continue;

      const surfaceId = blockIdAt(dimension, surface);
      const above = { x, y: surface.y + 1, z };
      const aboveId = blockIdAt(dimension, above);
      if (!surfaceId || !aboveId) continue;

      // Freeze standing water solid.
      if (surfaceId === "minecraft:water" || surfaceId === "minecraft:flowing_water") {
        if (setBlockSafe(dimension, surface, "minecraft:ice")) blockBudget--;
        continue;
      }
      // Otherwise pile a snow layer on top.
      if (isAirId(aboveId) && !isAirId(surfaceId) && Math.random() < TUNING.storm.snowChance) {
        if (setBlockSafe(dimension, above, "minecraft:snow_layer")) blockBudget--;
      }
    }
  }
}

/** Topmost block in a column that is not air - water counts as the surface. */
function topOfColumn(dimension, x, z, fromY) {
  let y = Math.floor(fromY);
  const stop = y - 40;
  for (; y > stop; y--) {
    const id = blockIdAt(dimension, { x, y, z });
    if (id === undefined) return undefined;
    if (!isAirId(id)) return { x, y, z };
  }
  return undefined;
}

/** Number of players currently being tracked, for the tests and status. */
export function trackedPlayers() {
  return bodies.size;
}
