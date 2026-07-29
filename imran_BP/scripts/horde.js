/**
 * Imran Security House - the zombie disaster.
 *
 * Type the trigger phrase in chat and a thousand violent zombies come for you.
 *
 * They are sent in waves rather than all at once, and the number *alive at the
 * same time* is capped (150 by default). The full count still arrives - the
 * horde tops itself up as they die - but the world stays playable on a phone.
 * Raise `hordeMaxAlive` if you are on a strong device and want a real wall of
 * them at once.
 *
 * These zombies are not the vanilla kind:
 *   - they hit for 9 and move faster than you walk
 *   - they attack players, every other mob, villagers **and each other**
 *   - they rot: 1 damage every 6 seconds, so a horde left alone eats itself
 *   - some of them explode when they die
 */

import { system, world } from "@minecraft/server";
import { TUNING, ZOMBIE_ID, getSetting } from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  actionBar,
  allPlayers,
  blockIdAt,
  groundY,
  isAirId,
  playSoundAt,
  playersNear,
  randFloat,
  randInt,
  showTitle,
  spawnEntitySafe,
  spawnParticleSafe
} from "./util.js";

const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

const state = {
  active: false,
  spawned: 0,
  target: 0,
  alive: 0,
  killed: 0,
  waveTimer: 0,
  aliveTimer: 0,
  endsAt: 0
};

let loopId = undefined;

export function initHorde() {
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      hordeTick();
    } catch (error) {
      console.warn(`[Imran] horde tick: ${error}`);
    }
  }, TUNING.tickInterval);
}

export function isActive() {
  return state.active;
}

export function hordeStatus() {
  if (!state.active) {
    return state.spawned > 0
      ? `§7No disaster running. Last one sent §f${state.spawned}§7 zombies.`
      : "§7No disaster running.";
  }
  return (
    `§4§lZOMBIE DISASTER§r\n` +
    `§7alive: §c${state.alive}§7 / ${getSetting("hordeMaxAlive")}\n` +
    `§7sent: §f${state.spawned}§7 of §f${state.target}\n` +
    `§7killed: §a${state.killed}`
  );
}

/** Starts a disaster. Count defaults to the hordeTotal setting. */
export function startHorde(count) {
  const total = Math.max(1, Math.floor(count ?? getSetting("hordeTotal")));
  state.active = true;
  state.spawned = 0;
  state.killed = 0;
  state.target = total;
  state.waveTimer = 0;
  state.endsAt = system.currentTick + TUNING.horde.maxMinutes * 60 * 20;

  for (const player of allPlayers()) {
    showTitle(player, "§4§lZOMBIE DISASTER", `§c${total} of them are coming`);
    try {
      player.playSound(SOUNDS.hordeStart.vanilla, { volume: 1.2, pitch: 0.6 });
    } catch {
      // ignore
    }
  }
  try {
    world.sendMessage(`§4[!] §cZOMBIE DISASTER §7- §f${total}§7 violent zombies inbound. Get inside.`);
  } catch {
    // ignore
  }
  return total;
}

/** Stops the disaster and clears every zombie it made. */
export function stopHorde(announce = true) {
  const removed = killAll();
  state.active = false;
  state.alive = 0;
  if (announce) {
    try {
      world.sendMessage(`§b[Imran] §fDisaster called off. Removed §f${removed}§f zombies.`);
    } catch {
      // ignore
    }
  }
  return removed;
}

export function killAll() {
  let removed = 0;
  for (const dimensionId of DIMENSION_IDS) {
    let dimension;
    try {
      dimension = world.getDimension(dimensionId);
    } catch {
      continue;
    }
    let list = [];
    try {
      list = dimension.getEntities({ type: ZOMBIE_ID });
    } catch {
      list = [];
    }
    for (const zombie of list) {
      try {
        zombie.remove();
        removed++;
      } catch {
        // ignore
      }
    }
  }
  return removed;
}

/** Called from main.js when one of our zombies dies. */
export function noteDeath(entity) {
  state.killed++;
  if (state.alive > 0) state.alive--;

  let variant = 0;
  let loc;
  let dimension;
  try {
    loc = entity.location;
    dimension = entity.dimension;
    variant = entity.getComponent("minecraft:variant")?.value ?? 0;
  } catch {
    return;
  }
  if (variant !== 1) return;

  // Bombers go off where they fall.
  playSoundAt(dimension, loc, SOUNDS.zombieBomb.custom, SOUNDS.zombieBomb.vanilla, { volume: 1.2, pitch: 1.1 });
  spawnParticleSafe(dimension, "ih:rot_burst", { x: loc.x, y: loc.y + 1, z: loc.z });
  try {
    dimension.createExplosion(loc, TUNING.horde.bomberPower, {
      breaksBlocks: getSetting("bomberBreaksBlocks"),
      causesFire: false,
      allowUnderwater: true
    });
  } catch {
    // unloaded chunk
  }
}

/* ------------------------------------------------------------------ ticks -- */

function hordeTick() {
  if (!state.active) return;

  state.aliveTimer++;
  if (state.aliveTimer % 4 === 0) state.alive = countAlive();

  if (system.currentTick > state.endsAt) {
    state.active = false;
    try {
      world.sendMessage("§b[Imran] §fThe disaster burns itself out.");
    } catch {
      // ignore
    }
    return;
  }

  if (state.spawned >= state.target && state.alive === 0) {
    state.active = false;
    for (const player of allPlayers()) {
      showTitle(player, "§a§lYOU SURVIVED", `§7${state.killed} of them stopped moving`);
      try {
        player.playSound(SOUNDS.hordeEnd.vanilla, { volume: 1, pitch: 1.2 });
      } catch {
        // ignore
      }
    }
    return;
  }

  state.waveTimer += TUNING.tickInterval;
  if (state.waveTimer >= getSetting("hordeWaveTicks") && state.spawned < state.target) {
    state.waveTimer = 0;
    spawnWave();
  }

  for (const player of allPlayers()) {
    actionBar(
      player,
      `§4☣ HORDE §calive ${state.alive}§7/${getSetting("hordeMaxAlive")}  §7sent §f${state.spawned}§7/§f${
        state.target
      }  §7killed §a${state.killed}`
    );
  }
}

function countAlive() {
  let total = 0;
  for (const dimensionId of DIMENSION_IDS) {
    try {
      total += world.getDimension(dimensionId).getEntities({ type: ZOMBIE_ID }).length;
    } catch {
      // ignore
    }
  }
  return total;
}

function spawnWave() {
  const players = allPlayers();
  if (players.length === 0) return;

  const room = getSetting("hordeMaxAlive") - state.alive;
  if (room <= 0) return;

  const wave = Math.min(getSetting("hordeWaveSize"), room, state.target - state.spawned);
  let made = 0;

  for (let i = 0; i < wave; i++) {
    const player = players[randInt(0, players.length - 1)];
    const zombie = spawnOne(player);
    if (zombie) {
      made++;
      state.spawned++;
      state.alive++;
    }
  }

  if (made > 0) {
    const player = players[0];
    try {
      playSoundAt(player.dimension, player.location, SOUNDS.hordeWave.custom, SOUNDS.hordeWave.vanilla, {
        volume: 0.8,
        pitch: randFloat(0.5, 0.8)
      });
    } catch {
      // ignore
    }
  }
}

/** Drops one zombie on open ground somewhere around a player. */
function spawnOne(player) {
  let origin;
  let dimension;
  try {
    origin = player.location;
    dimension = player.dimension;
  } catch {
    return undefined;
  }

  for (let attempt = 0; attempt < TUNING.horde.placementTries; attempt++) {
    const angle = randFloat(0, Math.PI * 2);
    const distance = randFloat(TUNING.horde.spawnMinDistance, TUNING.horde.spawnMaxDistance);
    const x = Math.floor(origin.x + Math.cos(angle) * distance);
    const z = Math.floor(origin.z + Math.sin(angle) * distance);

    const ground = groundY(dimension, x, z, origin.y + 20, 30);
    if (ground === undefined) continue;

    const feet = { x: x + 0.5, y: ground + 1, z: z + 0.5 };
    const headId = blockIdAt(dimension, { x, y: ground + 2, z });
    const feetId = blockIdAt(dimension, { x, y: ground + 1, z });
    if (!headId || !feetId || !isAirId(headId) || !isAirId(feetId)) continue;

    const zombie = spawnEntitySafe(dimension, ZOMBIE_ID, feet);
    if (!zombie) continue;

    if (randInt(1, 100) <= getSetting("bomberPercent")) {
      try {
        zombie.triggerEvent("ih:make_bomber");
      } catch {
        // ignore
      }
    }
    spawnParticleSafe(dimension, "ih:rot_burst", feet);
    return zombie;
  }
  return undefined;
}

/** Used by the tests. */
export function hordeState() {
  return { ...state };
}
