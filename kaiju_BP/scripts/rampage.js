/**
 * Kaiju Rampage - the rampage engine.
 *
 * Every kaiju in the world is tracked here. On each rampage tick a kaiju:
 *
 *   1. smashes any block its body is standing in - it carves its own path
 *      through hills, trees and buildings just by walking
 *   2. cracks the ground and hurls everything nearby into the air when it steps
 *   3. sweeps its tail through anything that gets close
 *   4. charges and fires the atomic breath, which carves a burning trench
 *   5. roars, shaking screens and sickening everything within 55 blocks
 *
 * Below half health it enrages: faster, angrier and on much shorter cooldowns.
 *
 * Block edits are strictly budgeted per tick (see maxBlockOpsPerTick) because
 * this has to stay playable on a phone.
 */

import { system, world } from "@minecraft/server";
import { KAIJU_ID, TUNING, getSetting, scaled } from "./config.js";
import { SOUNDS } from "./sounds.js";
import {
  add,
  addEffectSafe,
  blockIdAt,
  cameraShake,
  damageEntity,
  distance,
  entitiesNear,
  groundY,
  healEntity,
  igniteEntity,
  isAirId,
  isPassableId,
  isValidEntity,
  length,
  normalize,
  particleRing,
  playSoundAt,
  playersNear,
  pushEntity,
  randFloat,
  scale,
  setBlockSafe,
  smashBlock,
  spawnParticleSafe,
  sub
} from "./util.js";

const DIMENSION_IDS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

/** entity id -> tracked kaiju */
const herd = new Map();

let loopId = undefined;
let resyncIndex = 0;
let tickCounter = 0;
/** Block edits left this tick, shared by every kaiju. */
let blockBudget = 0;

/* --------------------------------------------------------- body offsets -- */

/**
 * Offsets covering the kaiju's body, walked through a few at a time so a full
 * sweep costs a bounded number of getBlock calls per tick.
 */
const BODY_OFFSETS = (() => {
  const list = [];
  const { radius, height } = TUNING.body;
  for (let dy = 0; dy < height; dy++) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
        if (dx * dx + dz * dz > radius * radius) continue;
        list.push({ x: dx, y: dy, z: dz });
      }
    }
  }
  return list;
})();

/** Offsets of a disc, used to carve the atomic beam. */
const BEAM_OFFSETS = (() => {
  const list = [];
  const r = Math.ceil(TUNING.breath.beamRadius);
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz > TUNING.breath.beamRadius * TUNING.breath.beamRadius) continue;
        list.push({ x: dx, y: dy, z: dz });
      }
    }
  }
  return list;
})();

/* ------------------------------------------------------------------ setup -- */

export function initRampage() {
  if (loopId !== undefined) return;
  loopId = system.runInterval(() => {
    try {
      rampageTick();
    } catch (error) {
      console.warn(`[Kaiju] rampage tick: ${error}`);
    }
  }, TUNING.tickInterval);
}

/** Starts tracking a kaiju. Returns false when the cap is full. */
export function register(entity, options = {}) {
  if (!isValidEntity(entity)) return false;
  let id;
  try {
    id = entity.id;
  } catch {
    return false;
  }
  if (herd.has(id)) return true;

  if (herd.size >= getSetting("maxKaiju")) {
    try {
      entity.triggerEvent("kj:despawn");
      entity.remove();
    } catch {
      // ignore
    }
    return false;
  }

  const now = system.currentTick;
  const entry = {
    entity,
    id,
    lastPos: undefined,
    enraged: false,
    phase: "idle",
    chargeUntil: 0,
    beamOrigin: undefined,
    beamDir: undefined,
    beamProgress: 0,
    stompTimer: 0,
    bodyCursor: 0,
    nextTail: now + TUNING.tail.cooldownTicks / 2,
    nextBreath: now + TUNING.breath.cooldownTicks / 2,
    nextRoar: now + 20 * 8
  };
  herd.set(id, entry);

  if (options.fresh !== false) announceArrival(entity);
  return true;
}

export function forget(id) {
  herd.delete(id);
}

export function population() {
  return herd.size;
}

export function statusText() {
  if (herd.size === 0) return "§7No kaiju are awake.";
  const lines = [];
  for (const entry of herd.values()) {
    let health = "?";
    try {
      const component = entry.entity.getComponent("minecraft:health");
      if (component) health = `${Math.round(component.currentValue)}`;
    } catch {
      // ignore
    }
    const state = entry.enraged ? "§cENRAGED" : entry.phase === "charging" ? "§bCHARGING" : "§6rampaging";
    lines.push(`§7- ${state} §7health §f${health}§7/1500`);
  }
  return `§c${herd.size}§f awake §7(cap ${getSetting("maxKaiju")})\n${lines.join("\n")}`;
}

/** Removes every kaiju. Returns how many. */
export function killAll() {
  let removed = 0;
  for (const entry of [...herd.values()]) {
    try {
      entry.entity.remove();
    } catch {
      // ignore
    }
    herd.delete(entry.id);
    removed++;
  }
  for (const dimensionId of DIMENSION_IDS) {
    let dimension;
    try {
      dimension = world.getDimension(dimensionId);
    } catch {
      continue;
    }
    for (const entity of safeQuery(dimension)) {
      try {
        entity.remove();
        removed++;
      } catch {
        // ignore
      }
    }
  }
  return removed;
}

/** Closest kaiju to a point, for the warning readout. */
export function nearestKaiju(dimension, location) {
  let best = undefined;
  for (const entry of herd.values()) {
    try {
      if (entry.entity.dimension.id !== dimension.id) continue;
      const dist = distance(entry.entity.location, location);
      if (!best || dist < best.dist) best = { entry, dist };
    } catch {
      // ignore
    }
  }
  return best;
}

function safeQuery(dimension) {
  try {
    return dimension.getEntities({ type: KAIJU_ID });
  } catch {
    return [];
  }
}

function announceArrival(entity) {
  try {
    const loc = entity.location;
    const dimension = entity.dimension;
    playSoundAt(dimension, loc, SOUNDS.roar.custom, SOUNDS.roar.vanilla, { volume: 2, pitch: 0.5 });
    cameraShake(dimension, loc, 0.3, 2.0, 80);
    for (const player of playersNear(dimension, loc, 120)) {
      try {
        player.onScreenDisplay.setTitle("§4§lTHE KAIJU AWAKENS", {
          subtitle: "§cRun.",
          fadeInDuration: 5,
          stayDuration: 50,
          fadeOutDuration: 20
        });
      } catch {
        // ignore
      }
    }
  } catch {
    // the entity vanished between spawning and this call
  }
}

/* ------------------------------------------------------------------ ticks -- */

function rampageTick() {
  tickCounter++;
  blockBudget = getSetting("maxBlockOpsPerTick");

  if (tickCounter % 5 === 0) resync();

  for (const entry of [...herd.values()]) {
    if (!isValidEntity(entry.entity)) {
      herd.delete(entry.id);
      continue;
    }
    try {
      updateKaiju(entry);
    } catch (error) {
      console.warn(`[Kaiju] update: ${error}`);
    }
  }
}

function resync() {
  const dimensionId = DIMENSION_IDS[resyncIndex % DIMENSION_IDS.length];
  resyncIndex++;
  let dimension;
  try {
    dimension = world.getDimension(dimensionId);
  } catch {
    return;
  }
  for (const entity of safeQuery(dimension)) {
    let id;
    try {
      id = entity.id;
    } catch {
      continue;
    }
    if (!herd.has(id)) register(entity, { fresh: false });
  }
}

function updateKaiju(entry) {
  const entity = entry.entity;
  let loc;
  let dimension;
  try {
    loc = entity.location;
    dimension = entity.dimension;
  } catch {
    herd.delete(entry.id);
    return;
  }

  healEntity(entity, TUNING.regenPerTick);
  checkEnrage(entry);

  const moved = entry.lastPos ? distance(entry.lastPos, loc) : 0;
  entry.lastPos = { ...loc };

  if (entry.phase === "beaming") {
    advanceBeam(entry, dimension);
    return; // it stands still and fires
  }

  if (entry.phase === "charging") {
    chargeEffects(entry, dimension, loc);
    if (system.currentTick >= entry.chargeUntil) fireBeam(entry, dimension, loc);
    return;
  }

  if (getSetting("destroyBlocks")) smashBody(entry, dimension, loc);

  entry.stompTimer += TUNING.tickInterval;
  if (moved > 0.12 && entry.stompTimer >= stompInterval(entry)) {
    entry.stompTimer = 0;
    stomp(entry, dimension, loc);
  }

  const now = system.currentTick;
  if (getSetting("roar") && now >= entry.nextRoar) {
    entry.nextRoar = now + cooldown(entry, TUNING.roar.cooldownTicks);
    roar(entry, dimension, loc);
  } else if (now >= entry.nextTail && hasTargetsWithin(entry, dimension, loc, TUNING.tail.radius)) {
    entry.nextTail = now + cooldown(entry, TUNING.tail.cooldownTicks);
    tailSweep(entry, dimension, loc);
  } else if (getSetting("atomicBreath") && now >= entry.nextBreath) {
    entry.nextBreath = now + cooldown(entry, TUNING.breath.cooldownTicks);
    beginCharge(entry, dimension, loc);
  }

  if (Math.random() < 0.25) {
    spawnParticleSafe(dimension, "kj:kaiju_smoke", {
      x: loc.x + randFloat(-2, 2),
      y: loc.y + randFloat(2, 10),
      z: loc.z + randFloat(-2, 2)
    });
  }
}

function cooldown(entry, ticks) {
  return Math.round(entry.enraged ? ticks * TUNING.enrageCooldownScale : ticks);
}

function stompInterval(entry) {
  return entry.enraged ? Math.round(TUNING.stomp.interval * 0.7) : TUNING.stomp.interval;
}

function checkEnrage(entry) {
  if (entry.enraged) return;
  try {
    const health = entry.entity.getComponent("minecraft:health");
    if (!health) return;
    const max = health.effectiveMax ?? health.defaultValue ?? 1500;
    if (health.currentValue > max * TUNING.enrageAtHealthFraction) return;
  } catch {
    return;
  }

  entry.enraged = true;
  try {
    entry.entity.triggerEvent("kj:enrage");
    const loc = entry.entity.location;
    const dimension = entry.entity.dimension;
    playSoundAt(dimension, loc, SOUNDS.screech.custom, SOUNDS.screech.vanilla, { volume: 2, pitch: 0.6 });
    cameraShake(dimension, loc, 0.3, 1.5, 60);
    for (const player of playersNear(dimension, loc, 90)) {
      try {
        player.sendMessage("§4[Kaiju] §cIt is enraged.");
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------ destruction -- */

/** Clears whatever the kaiju's body is currently occupying. */
function smashBody(entry, dimension, loc) {
  const perTick = 70;
  const forward = facing(entry.entity);
  const centre = {
    x: loc.x + forward.x * TUNING.body.forwardReach,
    y: loc.y,
    z: loc.z + forward.z * TUNING.body.forwardReach
  };

  let smashed = 0;
  for (let i = 0; i < perTick && blockBudget > 0; i++) {
    const offset = BODY_OFFSETS[(entry.bodyCursor + i) % BODY_OFFSETS.length];
    const target = {
      x: Math.floor(centre.x + offset.x),
      y: Math.floor(centre.y + offset.y),
      z: Math.floor(centre.z + offset.z)
    };
    const id = blockIdAt(dimension, target);
    if (id === undefined || isAirId(id) || isPassableId(id)) continue;
    if (smashBlock(dimension, target, 0.08)) {
      blockBudget--;
      smashed++;
      if (smashed % 6 === 0) {
        spawnParticleSafe(dimension, "kj:rubble", { x: target.x + 0.5, y: target.y + 0.5, z: target.z + 0.5 });
      }
    }
  }
  entry.bodyCursor = (entry.bodyCursor + perTick) % BODY_OFFSETS.length;

  if (smashed > 3) {
    playSoundAt(dimension, loc, SOUNDS.smash.custom, SOUNDS.smash.vanilla, {
      volume: 1.4,
      pitch: randFloat(0.4, 0.7)
    });
  }
}

/** A footfall: cracks the ground, throws everything nearby into the air. */
function stomp(entry, dimension, loc) {
  const radius = scaled(TUNING.stomp.radius);

  playSoundAt(dimension, loc, SOUNDS.step.custom, SOUNDS.step.vanilla, { volume: 1.6, pitch: 0.5 });
  playSoundAt(dimension, loc, SOUNDS.stomp.custom, SOUNDS.stomp.vanilla, { volume: 1.1, pitch: 0.4 });
  cameraShake(dimension, loc, TUNING.stomp.shakeIntensity, 0.5, TUNING.stomp.shakeRadius);
  particleRing(dimension, loc, radius * 0.8, "kj:stomp_dust", 20, 0.2);

  if (getSetting("destroyBlocks")) {
    for (let i = 0; i < 26 && blockBudget > 0; i++) {
      const angle = randFloat(0, Math.PI * 2);
      const dist = randFloat(0, radius);
      const x = Math.floor(loc.x + Math.cos(angle) * dist);
      const z = Math.floor(loc.z + Math.sin(angle) * dist);
      const ground = groundY(dimension, x, z, loc.y + 3, 6);
      if (ground === undefined) continue;
      for (let d = 0; d < TUNING.stomp.crackDepth && blockBudget > 0; d++) {
        if (smashBlock(dimension, { x, y: ground - d, z }, 0.25)) blockBudget--;
      }
    }
  }

  for (const victim of victimsNear(entry, dimension, loc, radius)) {
    damageEntity(victim, scaled(TUNING.stomp.damage), { by: entry.entity, cause: "entityAttack" });
    let victimLoc;
    try {
      victimLoc = victim.location;
    } catch {
      continue;
    }
    const away = normalize(sub(victimLoc, loc));
    pushEntity(victim, { x: away.x * 0.8, y: TUNING.stomp.launch, z: away.z * 0.8 });
  }
}

/** A wide sweep that flattens everything at close range. */
function tailSweep(entry, dimension, loc) {
  const radius = scaled(TUNING.tail.radius);
  playSoundAt(dimension, loc, SOUNDS.tail.custom, SOUNDS.tail.vanilla, { volume: 1.6, pitch: 0.6 });

  for (let ring = 1; ring <= 3; ring++) {
    particleRing(dimension, loc, (radius / 3) * ring, "kj:rubble", 16 + ring * 6, 1.0);
  }

  if (getSetting("destroyBlocks")) {
    for (let i = 0; i < 40 && blockBudget > 0; i++) {
      const angle = randFloat(0, Math.PI * 2);
      const dist = randFloat(2, TUNING.tail.blockRadius + 3);
      const target = {
        x: Math.floor(loc.x + Math.cos(angle) * dist),
        y: Math.floor(loc.y + randFloat(0, 6)),
        z: Math.floor(loc.z + Math.sin(angle) * dist)
      };
      if (smashBlock(dimension, target, 0.1)) blockBudget--;
    }
  }

  for (const victim of victimsNear(entry, dimension, loc, radius)) {
    damageEntity(victim, scaled(TUNING.tail.damage), { by: entry.entity, cause: "entityAttack" });
    let victimLoc;
    try {
      victimLoc = victim.location;
    } catch {
      continue;
    }
    const away = normalize(sub(victimLoc, loc));
    pushEntity(victim, { x: away.x * TUNING.tail.launch, y: 0.75, z: away.z * TUNING.tail.launch });
  }
}

/** The roar: everyone nearby gets shaken and sickened. */
function roar(entry, dimension, loc) {
  const radius = TUNING.roar.radius;
  playSoundAt(dimension, loc, SOUNDS.roar.custom, SOUNDS.roar.vanilla, { volume: 2, pitch: entry.enraged ? 0.45 : 0.6 });
  cameraShake(dimension, loc, TUNING.roar.shakeIntensity, 1.6, radius);

  for (let ring = 1; ring <= 4; ring++) {
    system.runTimeout(() => {
      particleRing(dimension, { x: loc.x, y: loc.y + 8, z: loc.z }, ring * 3.5, "kj:roar_wave", 22, 0);
    }, ring * 2);
  }

  for (const victim of victimsNear(entry, dimension, loc, radius)) {
    damageEntity(victim, TUNING.roar.damage, { by: entry.entity, cause: "sonicBoom" });
    addEffectSafe(victim, "nausea", TUNING.roar.nauseaSeconds, 0);
    addEffectSafe(victim, "slowness", TUNING.roar.slownessSeconds, 1);
    addEffectSafe(victim, "weakness", TUNING.roar.slownessSeconds, 0, false);
  }
}

/* --------------------------------------------------------- atomic breath -- */

function beginCharge(entry, dimension, loc) {
  entry.phase = "charging";
  entry.chargeUntil = system.currentTick + Math.round(TUNING.breath.chargeTicks * (entry.enraged ? 0.7 : 1));
  try {
    entry.entity.triggerEvent("kj:charge");
  } catch {
    // ignore
  }
  playSoundAt(dimension, loc, SOUNDS.charge.custom, SOUNDS.charge.vanilla, { volume: 2, pitch: 0.7 });
  for (const player of playersNear(dimension, loc, 90)) {
    try {
      player.onScreenDisplay.setActionBar("§b⚠ The kaiju is charging its breath");
    } catch {
      // ignore
    }
  }
}

/** Spines and mouth glow while the breath charges. */
function chargeEffects(entry, dimension, loc) {
  const head = { x: loc.x, y: loc.y + 10, z: loc.z };
  for (let i = 0; i < 5; i++) {
    spawnParticleSafe(dimension, "kj:atomic_charge", {
      x: head.x + randFloat(-1.5, 1.5),
      y: head.y + randFloat(-1.5, 2.5),
      z: head.z + randFloat(-1.5, 1.5)
    });
  }
  // Spines lighting up along the back.
  for (let i = 0; i < 4; i++) {
    spawnParticleSafe(dimension, "kj:atomic_charge", {
      x: loc.x + randFloat(-1, 1),
      y: loc.y + 6 + i * 1.5,
      z: loc.z + randFloat(-1, 1)
    });
  }
}

function fireBeam(entry, dimension, loc) {
  const target = pickBeamTarget(entry, dimension, loc);
  const head = { x: loc.x, y: loc.y + 9.5, z: loc.z };
  const direction = target
    ? normalize(sub(add(target, { x: 0, y: 1, z: 0 }), head))
    : facing(entry.entity);

  entry.phase = "beaming";
  entry.beamOrigin = head;
  entry.beamDir = direction;
  entry.beamProgress = 0;

  playSoundAt(dimension, loc, SOUNDS.beam.custom, SOUNDS.beam.vanilla, { volume: 2, pitch: 0.6 });
}

/** The beam extends a few blocks per tick, carving as it goes. */
function advanceBeam(entry, dimension) {
  const cfg = TUNING.breath;
  const stepLength = 3.0;
  const from = entry.beamProgress;
  const to = Math.min(cfg.range, from + stepLength);

  for (let travelled = from; travelled < to; travelled += 1.0) {
    const point = add(entry.beamOrigin, scale(entry.beamDir, travelled));

    spawnParticleSafe(dimension, "kj:atomic_beam", point);
    if (travelled % 3 < 1) {
      spawnParticleSafe(dimension, "kj:atomic_charge", point);
    }

    if (getSetting("destroyBlocks")) {
      for (const offset of BEAM_OFFSETS) {
        if (blockBudget <= 0) break;
        const target = {
          x: Math.floor(point.x + offset.x),
          y: Math.floor(point.y + offset.y),
          z: Math.floor(point.z + offset.z)
        };
        const id = blockIdAt(dimension, target);
        if (id === undefined || isAirId(id)) continue;
        if (Math.random() < cfg.scorchChance) {
          if (setBlockSafe(dimension, target, "minecraft:magma")) blockBudget--;
        } else if (smashBlock(dimension, target, 0)) {
          blockBudget--;
        }
      }
    }

    for (const victim of victimsNear(entry, dimension, point, cfg.beamRadius + 1.5)) {
      damageEntity(victim, scaled(cfg.damage), { by: entry.entity, cause: "magic" });
      igniteEntity(victim, cfg.burnSeconds);
    }
  }

  entry.beamProgress = to;

  if (to >= cfg.range) {
    const impact = add(entry.beamOrigin, scale(entry.beamDir, cfg.range));
    playSoundAt(dimension, impact, SOUNDS.beamHit.custom, SOUNDS.beamHit.vanilla, { volume: 2, pitch: 0.7 });
    spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", impact);
    try {
      dimension.createExplosion(impact, cfg.explosionPower, {
        breaksBlocks: getSetting("destroyBlocks"),
        causesFire: true,
        allowUnderwater: true
      });
    } catch {
      // unloaded chunk
    }
    for (const victim of victimsNear(entry, dimension, impact, cfg.beamRadius + 4)) {
      damageEntity(victim, scaled(cfg.splashDamage), { by: entry.entity, cause: "magic" });
      igniteEntity(victim, cfg.burnSeconds);
    }

    entry.phase = "idle";
    entry.beamOrigin = undefined;
    try {
      entry.entity.triggerEvent(entry.enraged ? "kj:enrage" : "kj:calm");
    } catch {
      // ignore
    }
  }
}

/** Prefers a player, otherwise whatever is closest. */
function pickBeamTarget(entry, dimension, loc) {
  const candidates = victimsNear(entry, dimension, loc, TUNING.breath.range * 0.8);
  let best = undefined;
  for (const candidate of candidates) {
    try {
      const isPlayer = candidate.typeId === "minecraft:player";
      const dist = distance(candidate.location, loc);
      const score = dist - (isPlayer ? 20 : 0);
      if (!best || score < best.score) best = { score, location: candidate.location };
    } catch {
      // ignore
    }
  }
  return best?.location;
}

/* ----------------------------------------------------------------- shared -- */

/** Direction the kaiju is facing, flattened to the ground plane. */
function facing(entity) {
  try {
    const view = entity.getViewDirection();
    const flat = { x: view.x, y: 0, z: view.z };
    return length(flat) < 0.01 ? { x: 0, y: 0, z: 1 } : normalize(flat);
  } catch {
    return { x: 0, y: 0, z: 1 };
  }
}

/** Everything the kaiju is allowed to hurt near a point. */
function victimsNear(entry, dimension, location, radius) {
  const huntPlayers = getSetting("huntPlayers");
  const out = [];
  for (const entity of entitiesNear(dimension, location, radius, { excludeFamilies: ["kaiju"] })) {
    let typeId;
    try {
      typeId = entity.typeId;
      if (entity.id === entry.id) continue;
    } catch {
      continue;
    }
    if (typeId === "minecraft:item" || typeId === "minecraft:xp_orb" || typeId === "minecraft:lightning_bolt") {
      continue;
    }
    if (typeId === "minecraft:player" && !huntPlayers) continue;
    out.push(entity);
  }
  return out;
}

function hasTargetsWithin(entry, dimension, loc, radius) {
  return victimsNear(entry, dimension, loc, radius).length > 0;
}

/** Called from main.js when a kaiju dies: it goes out with a bang. */
export function deathThroes(entity) {
  let loc;
  let dimension;
  try {
    loc = entity.location;
    dimension = entity.dimension;
  } catch {
    return;
  }

  playSoundAt(dimension, loc, SOUNDS.death.custom, SOUNDS.death.vanilla, { volume: 2, pitch: 0.5 });
  cameraShake(dimension, loc, 0.35, 2.5, 90);
  spawnParticleSafe(dimension, "minecraft:huge_explosion_emitter", { x: loc.x, y: loc.y + 4, z: loc.z });

  try {
    dimension.createExplosion({ x: loc.x, y: loc.y + 2, z: loc.z }, TUNING.death.explosionPower, {
      breaksBlocks: getSetting("destroyBlocks"),
      causesFire: true,
      allowUnderwater: true
    });
  } catch {
    // ignore
  }

  for (let i = 0; i < 40; i++) {
    spawnParticleSafe(dimension, "kj:rubble", {
      x: loc.x + randFloat(-6, 6),
      y: loc.y + randFloat(0, 8),
      z: loc.z + randFloat(-6, 6)
    });
  }

  for (const player of playersNear(dimension, loc, 120)) {
    try {
      player.onScreenDisplay.setTitle("§6§lTHE KAIJU FALLS", {
        subtitle: "§7The ground stops shaking.",
        fadeInDuration: 5,
        stayDuration: 50,
        fadeOutDuration: 20
      });
    } catch {
      // ignore
    }
  }
}
