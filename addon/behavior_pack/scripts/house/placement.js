// @ts-check
// Luxury Base placement flow (SPEC §6, docs/LUXURY_BASE.md):
//
//   use item -> resolve ground + orientation -> quick pre-checks (height, player position,
//   overlap) -> reserve box -> scan (spread over ticks, <= SCAN_BUDGET_PER_TICK getBlock
//   calls per tick) -> rotation calibration (first build of the session) -> consume item ->
//   StructureManager.place (Layers animation) or the /structure load fallback ->
//   progress -> after buildSeconds + 1 s: release box, verify key blocks, report.
//
// Each build is a "job": a generator that yields how many getBlock calls it is about to
// make (the runner grants at most SCAN_BUDGET_PER_TICK per tick, shared by all jobs) or
// WAIT (= continue next tick). One job per player; jobs reserve their box until finished.

import { world, system, ItemStack, StructureAnimationMode } from "@minecraft/server";
import { ITEMS, SOUNDS, PARTICLES } from "../lib/ids.js";
import {
  logError,
  tell,
  actionbar,
  playSound,
  playSoundTo,
  spawnParticle,
  findHeld,
  consumeHeld,
  isSurvivalLike,
  giveOrDrop,
  getInventory,
  cardinalFromYaw,
  isValidEntity,
} from "../lib/util.js";
import { HOUSE } from "./blueprint_meta.js";
import {
  computePlacement,
  apiRotation,
  ROTATION_DEGREES,
  toWorld,
  boxesOverlap,
  getCalibration,
  isProbeRunning,
  runProbe,
  probeArea,
  noteCalibrationFailure,
  WAIT,
} from "./rotation.js";
import {
  scanSite,
  loadStructureInfo,
  getStructureInfo,
  keyCells,
  readType,
  shortName,
  isReplaceable,
  cellKey,
  SCAN_BUDGET_PER_TICK,
} from "./checks.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Block} Block */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("./rotation.js").Placement} Placement */
/** @typedef {import("./rotation.js").Vec3i} Vec3i */
/** @typedef {import("./rotation.js").Convention} Convention */
/** @typedef {import("./checks.js").ScanBlocked} ScanBlocked */

/** Max raycast distance when the spawner is used in the air. */
export const AIM_DISTANCE = 12;
/** How far below a clicked plant (grass, flowers, snow layer) we look for the real ground. */
const GROUND_SEARCH_DEPTH = 3;
/** Vanilla sound played to the player when the site is blocked. */
const BLOCKED_SOUND = "note.bass";
const TICKS_PER_SECOND = 20;

/**
 * @typedef {"scan" | "calibrate" | "build"} Phase
 * @typedef {object} Job
 * @property {number} id
 * @property {Player} player
 * @property {string} playerId
 * @property {Dimension} dim
 * @property {string} dimId
 * @property {Placement} pl
 * @property {Vec3i} min box min (inclusive)
 * @property {Vec3i} max box max (inclusive)
 * @property {Phase} phase
 * @property {Generator<number, void, void>} gen
 * @property {number | undefined} pending budget request not granted yet
 * @property {number} lastSliceTick
 * @property {boolean} consumed an item was taken from the player
 * @property {boolean} placed the placement call (API or command) succeeded
 * @property {"api" | "command" | undefined} method
 * @property {import("@minecraft/server").StructureRotation | undefined} rotation
 * @property {Convention | undefined} convention
 * @property {number} startTick
 * @property {number} buildStartTick
 * @property {number} buildEndTick
 * @property {string[]} log diagnostics (tests)
 */

/** Active jobs (each reserves its box until it finishes). @type {Set<Job>} */
const jobs = new Set();
/** @type {Map<string, Job>} */
const activeByPlayer = new Map();
let nextJobId = 1;
/** @type {number | undefined} */
let pumpRunId;
let budgetTick = -1;
let budgetLeft = 0;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

/** @param {Vec3i} p @returns {string} */
function xyz(p) {
  return `${p.x} ${p.y} ${p.z}`;
}

export const MSG = Object.freeze({
  aim: `§eAim at the ground (within ${AIM_DISTANCE} blocks).`,
  scanning: "§eStill checking the build area...",
  /** @param {number} secs */
  building: (secs) => `§eYour Luxury Base is still being built (${secs}s left).`,
  /** @param {string} name @param {Vec3i} p */
  obstruction: (name, p) =>
    `§cCan't build here: ${name} at ${xyz(p)} is in the way. Clear a ${HOUSE.size.x}×${HOUSE.size.z} area (${HOUSE.size.y} high) or pick flatter ground.`,
  /** @param {string} name @param {Vec3i} p */
  liquid: (name, p) => `§cCan't build here: ${name} at ${xyz(p)}. The base can't be built in or over water or lava.`,
  /** @param {number} pct @param {number} need @param {string} name @param {Vec3i} p */
  support: (pct, need, name, p) =>
    `§cCan't build here: not enough solid ground (${pct}% of the footprint, need ${need}%). First gap: ${name} at ${xyz(p)}. Pick flatter ground.`,
  /** @param {Vec3i} p */
  unloaded: (p) => `§cCan't build here: area not fully loaded (${xyz(p)}). Move closer and try again.`,
  /** @param {number} top */
  tooHigh: (top) =>
    `§cCan't build here: the base is ${HOUSE.size.y} blocks high and would reach above the build limit (y ${top}). Pick lower ground.`,
  /** @param {number} bottom */
  tooLow: (bottom) => `§cCan't build here: the base would go below the bottom of the world (y ${bottom}).`,
  /** @param {Vec3i} p */
  overlap: (p) =>
    `§cCan't build here: another Luxury Base is being built in this area (near ${xyz(p)}). Wait for it to finish or pick another spot.`,
  inside: "§cCan't build here: you are standing inside the build area. Step back and try again.",
  /** @param {string} name */
  otherInside: (name) => `§cCan't build here: ${name} is standing inside the build area.`,
  noItem: "§cYou no longer have a Luxury Base Spawner.",
  /** @param {number} secs */
  started: (secs) => `§aBuilding your Luxury Base... (${secs}s)`,
  /** @param {number} pct */
  progress: (pct) => `§aBuilding Luxury Base... ${pct}%`,
  done: "§aLuxury Base complete!",
  /** @param {string} expected @param {Vec3i} p @param {string} found */
  verifyMissing: (expected, p, found) =>
    `§eLuxury Base finished, but ${expected} is missing at ${xyz(p)} (found ${found}). The build may have been interrupted.`,
  verifyUnloaded: "§eLuxury Base finished, but the area is not loaded any more, so it could not be checked.",
  /** @param {string} why @param {boolean} refunded */
  failed: (why, refunded) => `§cThe Luxury Base could not be placed (${why}).${refunded ? " Your spawner was returned." : ""}`,
});

/** @param {Player} player @param {string} msg @param {string} bar */
function reportBlocked(player, msg, bar) {
  tell(player, msg);
  actionbar(player, bar);
  playSoundTo(player, BLOCKED_SOUND);
}

/**
 * @param {Player} player
 * @param {ScanBlocked} r
 */
function reportScanBlocked(player, r) {
  const name = r.typeId ? shortName(r.typeId) : "unknown block";
  switch (r.reason) {
    case "unloaded":
      return reportBlocked(player, MSG.unloaded(r.at), "§cArea not fully loaded");
    case "liquid":
      return reportBlocked(player, MSG.liquid(name, r.at), `§cBlocked: ${name} at ${xyz(r.at)}`);
    case "support":
      return reportBlocked(
        player,
        MSG.support(Math.floor((r.solidRatio ?? 0) * 100), Math.round(HOUSE.supportRatio * 100), name, r.at),
        "§cNot enough solid ground",
      );
    default:
      return reportBlocked(player, MSG.obstruction(name, r.at), `§cBlocked: ${name} at ${xyz(r.at)}`);
  }
}

// ---------------------------------------------------------------------------
// Job runner (tick-spread work with a shared getBlock budget)
// ---------------------------------------------------------------------------

/** getBlock calls still allowed this tick. @returns {number} */
function budgetRemaining() {
  const t = system.currentTick;
  if (t !== budgetTick) {
    budgetTick = t;
    budgetLeft = SCAN_BUDGET_PER_TICK;
  }
  return budgetLeft;
}

function ensurePump() {
  if (pumpRunId !== undefined) return;
  pumpRunId = system.runInterval(pump, 1);
}

function pump() {
  try {
    if (jobs.size === 0) {
      if (pumpRunId !== undefined) system.clearRun(pumpRunId);
      pumpRunId = undefined;
      return;
    }
    const list = [...jobs];
    const shift = system.currentTick % list.length; // rotate so no job always goes first
    for (const job of [...list.slice(shift), ...list.slice(0, shift)]) {
      if (!jobs.has(job)) continue;
      if (job.phase === "scan" && !isValidEntity(job.player)) {
        abortJob(job); // player left while the site was being checked: nothing was changed
        continue;
      }
      runSlice(job);
    }
  } catch (e) {
    logError("house.pump", e);
  }
}

/** @param {Job} job */
function runSlice(job) {
  const t = system.currentTick;
  if (job.lastSliceTick === t) return;
  job.lastSliceTick = t;
  for (let guard = 0; guard < 100000; guard++) {
    let req = job.pending;
    if (req === undefined) {
      /** @type {IteratorResult<number, void>} */
      let r;
      try {
        r = job.gen.next();
      } catch (e) {
        failJob(job, e);
        return;
      }
      if (r.done) {
        finishJob(job);
        return;
      }
      req = r.value;
    }
    if (!(req > 0)) {
      job.pending = undefined;
      return; // WAIT: continue next tick
    }
    req = Math.min(req, SCAN_BUDGET_PER_TICK);
    if (budgetRemaining() < req) {
      job.pending = req; // retry next tick with a fresh budget
      return;
    }
    budgetLeft -= req;
    job.pending = undefined;
  }
}

/** @param {Job} job */
function finishJob(job) {
  jobs.delete(job);
  if (activeByPlayer.get(job.playerId) === job) activeByPlayer.delete(job.playerId);
}

/** Stop a job that has not changed the world (player left, test reset). @param {Job} job */
function abortJob(job) {
  try {
    job.gen.return(undefined);
  } catch {
    // ignore
  }
  job.log.push("aborted");
  finishJob(job);
}

/**
 * @param {Job} job
 * @param {unknown} e
 */
function failJob(job, e) {
  logError("house.job", e);
  job.log.push(`error: ${e instanceof Error ? e.message : String(e)}`);
  const refunded = job.consumed && !job.placed ? refund(job) : false;
  if (!job.placed) tell(job.player, MSG.failed("internal error", refunded));
  finishJob(job);
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/**
 * Take one spawner from the player (hand first, then inventory). Creative: nothing taken.
 * @param {Player} player
 * @returns {"consumed" | "free" | "missing"}
 */
function consumeSpawner(player) {
  if (!isSurvivalLike(player)) return "free";
  const held = findHeld(player, ITEMS.BASE_SPAWNER);
  if (held && consumeHeld(player, held.hand)) return "consumed";
  const inv = getInventory(player);
  if (!inv) return "missing";
  try {
    for (let i = 0; i < inv.size; i++) {
      const it = inv.getItem(i);
      if (!it || it.typeId !== ITEMS.BASE_SPAWNER) continue;
      if (it.amount > 1) {
        it.amount = it.amount - 1;
        inv.setItem(i, it);
      } else inv.setItem(i, undefined);
      return "consumed";
    }
  } catch (e) {
    logError("house.consume", e);
  }
  return "missing";
}

/**
 * Give the consumed spawner back (or drop it at the build site if the player is gone).
 * @param {Job} job
 * @returns {boolean}
 */
function refund(job) {
  try {
    const stack = new ItemStack(ITEMS.BASE_SPAWNER, 1);
    if (isValidEntity(job.player)) giveOrDrop(job.player, stack);
    else job.dim.spawnItem(stack, anchorCenter(job.pl));
    job.consumed = false;
    return true;
  } catch (e) {
    logError("house.refund", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

/** @param {Placement} pl @returns {Vector3} */
function anchorCenter(pl) {
  const a = toWorld(pl, pl.anchorLocal);
  return { x: a.x + 0.5, y: a.y + 1, z: a.z + 0.5 };
}

/**
 * The clicked block, or the real ground below it when a plant / snow layer was clicked.
 * `reads` = getBlock calls made (charged to the tick budget).
 * @param {Block} block
 * @returns {{block: Block, reads: number}}
 */
export function resolveGround(block) {
  let b = block;
  let reads = 0;
  for (let i = 0; i <= GROUND_SEARCH_DEPTH; i++) {
    /** @type {string} */
    let t;
    try {
      t = b.typeId;
    } catch {
      return { block, reads };
    }
    if (t === "minecraft:air" || !isReplaceable(t)) return { block: b, reads };
    /** @type {Block | undefined} */
    let below;
    try {
      reads++;
      below = b.below();
    } catch {
      below = undefined;
    }
    if (!below) return { block, reads };
    b = below;
  }
  return { block, reads };
}

/**
 * Whether a player's body (feet or head cell) is inside the box.
 * @param {Player} p
 * @param {Placement} pl
 * @returns {boolean}
 */
function standsIn(p, pl) {
  try {
    const f = p.location;
    const x = Math.floor(f.x);
    const y = Math.floor(f.y);
    const z = Math.floor(f.z);
    return x >= pl.min.x && x <= pl.max.x && z >= pl.min.z && z <= pl.max.z && y >= pl.min.y - 1 && y <= pl.max.y;
  } catch {
    return false;
  }
}

/** Whether `player` has a build in progress. @param {Player} player @returns {boolean} */
export function isBusy(player) {
  return activeByPlayer.has(player.id);
}

/**
 * Start a build for `player` on the clicked ground block. All feedback goes to the player.
 * @param {Player} player
 * @param {Block} clicked
 * @returns {Job | undefined} the started job, or undefined when refused right away
 */
export function requestBuild(player, clicked) {
  const busy = activeByPlayer.get(player.id);
  if (busy) {
    if (busy.phase === "build") {
      const left = Math.max(1, Math.ceil((busy.buildEndTick - system.currentTick) / TICKS_PER_SECOND));
      tell(player, MSG.building(left));
    } else tell(player, MSG.scanning);
    return undefined;
  }
  const dim = clicked.dimension;
  const resolved = resolveGround(clicked);
  if (resolved.reads) {
    budgetRemaining();
    budgetLeft -= resolved.reads; // may go negative: the first scan slice then waits a tick
  }
  const ground = resolved.block;
  const facing = cardinalFromYaw(player.getRotation().y);
  const pl = computePlacement(ground.location, facing);

  // height range
  const range = dim.heightRange;
  if (pl.max.y >= range.max) {
    reportBlocked(player, MSG.tooHigh(range.max - 1), "§cToo close to the build limit");
    return undefined;
  }
  if (pl.min.y - 1 < range.min) {
    reportBlocked(player, MSG.tooLow(range.min), "§cToo low");
    return undefined;
  }
  // no player may stand inside the box (they would be built in)
  if (standsIn(player, pl)) {
    reportBlocked(player, MSG.inside, "§cStep out of the build area");
    return undefined;
  }
  for (const other of dim.getPlayers()) {
    if (other.id !== player.id && standsIn(other, pl)) {
      reportBlocked(player, MSG.otherInside(other.name), "§cSomeone is in the build area");
      return undefined;
    }
  }
  // overlap with builds in progress (scanning or animating)
  for (const other of jobs) {
    if (other.dimId === dim.id && boxesOverlap(other, pl)) {
      reportBlocked(player, MSG.overlap(toWorld(other.pl, other.pl.anchorLocal)), "§cAnother base is being built here");
      return undefined;
    }
  }

  /** @type {Job} */
  const job = {
    id: nextJobId++,
    player,
    playerId: player.id,
    dim,
    dimId: dim.id,
    pl,
    min: pl.min,
    max: pl.max,
    phase: "scan",
    gen: /** @type {any} */ (undefined),
    pending: undefined,
    lastSliceTick: -1,
    consumed: false,
    placed: false,
    method: undefined,
    rotation: undefined,
    convention: undefined,
    startTick: system.currentTick,
    buildStartTick: 0,
    buildEndTick: 0,
    log: [],
  };
  job.gen = jobMain(job);
  jobs.add(job);
  activeByPlayer.set(player.id, job);
  ensurePump();
  runSlice(job); // start right away with this tick's budget
  return job;
}

// ---------------------------------------------------------------------------
// The job
// ---------------------------------------------------------------------------

/**
 * Pick the probe origin: one cell in from a corner of the verified box, at HOUSE.probeCell.y
 * (then other heights), whose whole 4x1x4 probe area is plain air.
 * @param {Placement} pl
 * @param {Set<string>} nonAir
 * @returns {Vec3i | undefined}
 */
export function chooseProbeSite(pl, nonAir) {
  const { min, max } = pl;
  const xs = [min.x + 1, max.x - 2];
  const zs = [min.z + 1, max.z - 2];
  /** @type {number[]} */
  const heights = [];
  for (let y = HOUSE.probeCell.y; y < pl.size.y; y++) heights.push(y);
  for (let y = HOUSE.probeCell.y - 1; y >= 1; y--) heights.push(y);
  for (const ly of heights)
    for (const x of xs)
      for (const z of zs) {
        const origin = { x, y: min.y + ly, z };
        const area = probeArea(origin);
        const inside = area.every((p) => p.x >= min.x && p.x <= max.x && p.z >= min.z && p.z <= max.z);
        if (inside && area.every((p) => !nonAir.has(cellKey(p)))) return origin;
      }
  return undefined;
}

/** @param {Job} job @returns {Generator<number, void, void>} */
function* jobMain(job) {
  const now = () => system.currentTick;
  // 1. structure info (once per session) + scan
  const info = yield* loadStructureInfo();
  const res = yield* scanSite(job.dim, job.pl, info.mask);
  if (!res.ok) {
    job.log.push(`blocked: ${res.reason}`);
    reportScanBlocked(job.player, res);
    return;
  }
  job.log.push(`scan ok (${res.reads} reads, ${Math.round(res.solidRatio * 100)}% solid)`);

  // 2. rotation calibration (first placement of the session)
  job.phase = "calibrate";
  while (!getCalibration() && isProbeRunning()) yield WAIT;
  let cal = getCalibration();
  if (!cal) {
    const site = chooseProbeSite(job.pl, res.nonAir);
    cal = site ? yield* runProbe(job.dim, site, now) : noteCalibrationFailure("no free probe site in the build box", now());
  }
  job.convention = cal.convention;
  job.log.push(`calibration: ${cal.convention} (${cal.source})`);
  if (!isValidEntity(job.player)) return; // left: nothing consumed, nothing placed

  // 3. consume and place
  job.phase = "build";
  const taken = consumeSpawner(job.player);
  if (taken === "missing") {
    reportBlocked(job.player, MSG.noItem, "§cNo Luxury Base Spawner");
    return;
  }
  job.consumed = taken === "consumed";
  const rotation = apiRotation(job.pl.q, cal.convention);
  job.rotation = rotation;
  const o = job.pl.origin;
  const secs = HOUSE.buildSeconds;
  let apiError = "";
  try {
    world.structureManager.place(HOUSE.structureId, job.dim, o, {
      rotation,
      animationMode: StructureAnimationMode.Layers,
      animationSeconds: secs,
      includeEntities: false,
      waterlogged: false,
    });
    job.placed = true;
    job.method = "api";
  } catch (e) {
    apiError = e instanceof Error ? e.message : String(e);
    logError("house.place", e);
  }
  if (!job.placed) {
    // /structure load <name> <x y z> <rotation> <mirror> <animationMode> <animationSeconds> <includeEntities> <includeBlocks>
    const cmd = `structure load ${HOUSE.structureId} ${o.x} ${o.y} ${o.z} ${ROTATION_DEGREES[rotation]} none layer_by_layer ${secs} false true`;
    job.log.push(`fallback: ${cmd}`);
    try {
      const r = job.dim.runCommand(cmd);
      if (r && r.successCount > 0) {
        job.placed = true;
        job.method = "command";
      } else apiError += "; /structure load reported no success";
    } catch (e) {
      apiError += `; /structure load failed: ${e instanceof Error ? e.message : String(e)}`;
      logError("house.place.command", e);
    }
  }
  if (!job.placed) {
    const refunded = job.consumed ? refund(job) : false;
    tell(job.player, MSG.failed(apiError || "unknown error", refunded));
    playSoundTo(job.player, BLOCKED_SOUND);
    return; // finishing the job releases the reservation
  }
  job.log.push(`placed via ${job.method} with ${rotation} at ${xyz(o)}`);
  const center = anchorCenter(job.pl);
  playSound(job.dim, SOUNDS.BASE_BUILD, center);
  sparkle(job);
  tell(job.player, MSG.started(secs));
  actionbar(job.player, MSG.progress(0));

  // 4. wait for the engine's layer-by-layer animation (+1 s), showing progress
  job.buildStartTick = now();
  job.buildEndTick = job.buildStartTick + (secs + 1) * TICKS_PER_SECOND;
  while (now() < job.buildEndTick) {
    yield WAIT;
    const elapsed = now() - job.buildStartTick;
    if (elapsed > 0 && elapsed % TICKS_PER_SECOND === 0 && now() < job.buildEndTick) {
      const pct = Math.min(100, Math.floor((elapsed / (secs * TICKS_PER_SECOND)) * 100));
      actionbar(job.player, MSG.progress(pct));
      if (elapsed <= secs * TICKS_PER_SECOND) sparkle(job);
    }
  }

  // 5. verify a few key blocks (the reservation is released when the job returns)
  const keys = keyCells();
  yield keys.length;
  const v = verifyBuild(job, keys);
  job.log.push(`verify: ${v.status}`);
  if (v.status === "ok") {
    tell(job.player, MSG.done);
    actionbar(job.player, MSG.done);
    playSound(job.dim, SOUNDS.BASE_DONE, center);
    playSoundTo(job.player, SOUNDS.BASE_DONE);
    spawnParticle(job.dim, PARTICLES.BUILD, center);
  } else if (v.status === "unloaded") {
    tell(job.player, MSG.verifyUnloaded);
  } else {
    tell(job.player, MSG.verifyMissing(v.expected, v.at, v.found));
  }
}

/** A few sparkles over the build site. @param {Job} job */
function sparkle(job) {
  const { min, max } = job.pl;
  const y = min.y + 1;
  const c = anchorCenter(job.pl);
  spawnParticle(job.dim, PARTICLES.BUILD, c);
  spawnParticle(job.dim, PARTICLES.BUILD, { x: min.x + 0.5, y, z: min.z + 0.5 });
  spawnParticle(job.dim, PARTICLES.BUILD, { x: max.x + 0.5, y, z: max.z + 0.5 });
}

/**
 * @typedef {{status: "ok"} | {status: "unloaded"} | {status: "missing", expected: string, at: Vec3i, found: string}} VerifyResult
 */

/**
 * Check the key cells (front door halves, foundation under the entrance) against the
 * structure's own blocks (or "not air" when the structure could not be read).
 * @param {Job} job
 * @param {Vec3i[]} keys
 * @returns {VerifyResult}
 */
function verifyBuild(job, keys) {
  const info = getStructureInfo(); // cached by the scan
  for (const local of keys) {
    const at = toWorld(job.pl, local);
    const found = readType(job.dim, at);
    if (found === undefined) return { status: "unloaded" };
    const expected = info?.types.get(`${local.x},${local.y},${local.z}`);
    if (expected ? found !== expected : found === "minecraft:air") {
      return { status: "missing", expected: expected ? shortName(expected) : "a block", at, found: shortName(found) };
    }
  }
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// Diagnostics / tests
// ---------------------------------------------------------------------------

export const __houseState = Object.freeze({
  jobs,
  activeByPlayer,
  /** Abort every job and forget all state (tests). */
  reset() {
    for (const j of [...jobs]) abortJob(j);
    jobs.clear();
    activeByPlayer.clear();
    if (pumpRunId !== undefined) {
      try {
        system.clearRun(pumpRunId);
      } catch {
        // ignore
      }
    }
    pumpRunId = undefined;
    budgetTick = -1;
    budgetLeft = 0;
  },
});
