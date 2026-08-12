/**
 * Persistent state, backed by scoreboards.
 *
 * Scoreboards rather than dynamic properties: the dynamic-property API changed
 * shape across the 1.20/1.21 line, whereas `/scoreboard` has been stable for
 * years and has the bonus that players and .mcfunction files can read the same
 * values we do.
 *
 * Writes always go through commands (universally stable). Reads go through the
 * scoreboard API, which is probed defensively because `getScore` has accepted
 * different participant types in different releases. Everything hot is cached
 * in memory, so a read never happens on a hot path.
 */

import { world } from "@minecraft/server";

export const OBJ_INF = "myc_inf"; // per-player infection, 0..100
export const OBJ_SYS = "myc_sys"; // global outbreak state
export const OBJ_POS = "myc_pos"; // mansion origin

function overworld() {
  return world.getDimension("overworld");
}

/** Fire-and-forget command. Selector misses reject the promise; that is normal. */
export function runCmd(command) {
  try {
    overworld().runCommandAsync(command).catch(() => {});
  } catch {
    /* dimension not ready yet */
  }
}

export function runCmdAt(entity, command) {
  try {
    entity.runCommandAsync(command).catch(() => {});
  } catch {
    /* entity gone */
  }
}

export function ensureObjectives() {
  runCmd(`scoreboard objectives add ${OBJ_INF} dummy "Mycelium-X"`);
  runCmd(`scoreboard objectives add ${OBJ_SYS} dummy "Outbreak"`);
  runCmd(`scoreboard objectives add ${OBJ_POS} dummy "Mansion"`);
}

/** Probe the several participant shapes `getScore` has accepted over time. */
function readScore(objectiveId, participant, name) {
  let objective;
  try {
    objective = world.scoreboard.getObjective(objectiveId);
  } catch {
    return undefined;
  }
  if (!objective) return undefined;

  const candidates = [participant, name].filter((c) => c !== undefined && c !== null);
  for (const candidate of candidates) {
    try {
      const value = objective.getScore(candidate);
      if (typeof value === "number") return value;
    } catch {
      /* try the next shape */
    }
  }

  // Last resort: walk the participant list and match on display name.
  try {
    for (const identity of objective.getParticipants()) {
      if (identity.displayName === name) {
        const value = objective.getScore(identity);
        if (typeof value === "number") return value;
      }
    }
  } catch {
    /* nothing else to try */
  }
  return undefined;
}

// ------------------------------------------------------------- globals ----

const GLOBAL_DEFAULTS = {
  outbreak: 0, // 0 = calm, 1 = active
  day: 0, // outbreak day, 1-based once started
  level: 0, // danger level 1..5
  elapsed: 0, // ticks since the outbreak began
  lockdown: 0, // 0 = open, 1 = sealed
  built: 0, // 1 once the mansion has been deployed
};

const globals = { ...GLOBAL_DEFAULTS };
let mansionOrigin = null; // {x, y, z} or null

export function loadFromWorld() {
  for (const key of Object.keys(GLOBAL_DEFAULTS)) {
    const value = readScore(OBJ_SYS, `#${key}`, `#${key}`);
    if (typeof value === "number") globals[key] = value;
  }
  const x = readScore(OBJ_POS, "#mx", "#mx");
  const y = readScore(OBJ_POS, "#my", "#my");
  const z = readScore(OBJ_POS, "#mz", "#mz");
  if ([x, y, z].every((v) => typeof v === "number")) {
    mansionOrigin = { x, y, z };
  }
}

export function getGlobal(key) {
  return globals[key];
}

export function setGlobal(key, value) {
  const next = Math.trunc(value);
  if (globals[key] === next) return;
  globals[key] = next;
  runCmd(`scoreboard players set #${key} ${OBJ_SYS} ${next}`);
}

export function getOrigin() {
  return mansionOrigin;
}

export function setOrigin(x, y, z) {
  mansionOrigin = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) };
  runCmd(`scoreboard players set #mx ${OBJ_POS} ${mansionOrigin.x}`);
  runCmd(`scoreboard players set #my ${OBJ_POS} ${mansionOrigin.y}`);
  runCmd(`scoreboard players set #mz ${OBJ_POS} ${mansionOrigin.z}`);
}

// ------------------------------------------------------ per-player state --

/**
 * Volatile per-player record. `infection` is mirrored to the scoreboard on
 * change so it survives a reload and is visible to /scoreboard and functions.
 */
const players = new Map();

export function playerState(player) {
  let record = players.get(player.id);
  if (!record) {
    record = {
      infection: 0,
      stage: 0,
      masked: false,
      suited: false,
      filterUntil: 0, // tick until which a fresh biofilter boosts the mask
      immuneUntil: 0, // tick until which suppressant blocks all infection gain
      sealedUntil: 0, // tick until which sealed air (bunker) blocks all gain
      lastUse: 0, // debounce for item-use events
      cooldowns: new Map(),
      warnedStage: -1,
    };
    players.set(player.id, record);
  }
  return record;
}

export function restorePlayer(player) {
  const record = playerState(player);
  const stored = readScore(OBJ_INF, player.scoreboardIdentity, player.name);
  if (typeof stored === "number") {
    record.infection = Math.max(0, Math.min(100, stored));
  } else {
    writeInfection(player, record.infection);
  }
}

export function forgetPlayer(playerId) {
  players.delete(playerId);
}

export function writeInfection(player, value) {
  runCmdAt(player, `scoreboard players set @s ${OBJ_INF} ${Math.trunc(value)}`);
}

export function allPlayerStates() {
  return players;
}

export function resetAllInfection() {
  runCmd(`scoreboard players set @a ${OBJ_INF} 0`);
  for (const record of players.values()) {
    record.infection = 0;
    record.stage = 0;
    record.warnedStage = -1;
  }
}
