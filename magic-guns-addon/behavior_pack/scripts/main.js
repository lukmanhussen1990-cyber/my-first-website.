// @ts-check
/**
 * Magic Guns - gameplay script.
 *
 * Tap (or hold) with a gun to fire.  Projectiles are simulated here instead
 * of being real entities: every tick each shot ray-marches forward with
 * getBlockFromRay / getEntitiesFromRay, draws its trail with particles and
 * runs the weapon's hooks on impact.  Only stable @minecraft/server 1.11.0
 * APIs are used, so no experimental toggles are needed.
 */
import { world, system, GameMode, EntityDamageCause } from "@minecraft/server";
import { WEAPONS, impactFlash } from "./weapons.js";
import { fx, sound, health, aim, hurt, TARGET_FILTER } from "./fx.js";
import * as V from "./vec.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("@minecraft/server").ItemStack} ItemStack */
/** @typedef {import("@minecraft/server").Container} Container */
/** @typedef {import("@minecraft/server").EntityInventoryComponent} EntityInventoryComponent */
/** @typedef {import("@minecraft/server").ItemDurabilityComponent} ItemDurabilityComponent */
/** @typedef {import("@minecraft/server").ItemEnchantableComponent} ItemEnchantableComponent */
/** @typedef {import("./weapons.js").Shot} Shot */
/** @typedef {import("./weapons.js").Weapon} Weapon */

const MAX_SHOTS = 96; // hard cap on live projectiles (mobile friendly)
const MAX_TRAIL_PER_STEP = 8;
const HUD_EVERY = 4; // ticks

/** @type {Shot[]} */
let shots = [];
/** player id -> tick when that player may fire again */
const readyAt = new Map();
/** player id -> true while the use button / screen is held */
const holding = new Map();

// ------------------------------------------------------------- inventory

/** @param {Player} p */
function container(p) {
  const inv = /** @type {EntityInventoryComponent | undefined} */ (p.getComponent("minecraft:inventory"));
  return inv?.container;
}

/** @param {Player} p @returns {{ item: ItemStack, weapon: Weapon } | undefined} */
function heldGun(p) {
  try {
    const item = container(p)?.getItem(p.selectedSlotIndex);
    if (!item) return undefined;
    const weapon = WEAPONS.get(item.typeId);
    return weapon ? { item, weapon } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Bow enchantments work on the guns (they enchant like bows):
 * Power +25 % damage per level (+25 % base), Punch extra knockback, Flame
 * sets targets alight, Infinity halves wear, Unbreaking as usual.
 * @param {ItemStack} item
 */
function enchantLevels(item) {
  /** @type {Record<string, number>} */
  const lv = { power: 0, punch: 0, flame: 0, infinity: 0, unbreaking: 0 };
  try {
    const ench = /** @type {ItemEnchantableComponent | undefined} */ (item.getComponent("minecraft:enchantable"));
    if (ench) for (const id of Object.keys(lv)) lv[id] = ench.getEnchantment(id)?.level ?? 0;
  } catch {}
  return lv;
}

/** Wear the gun by one shot.  Returns false if it broke. @param {Player} p @param {ItemStack} item @param {Record<string, number>} lv */
function wear(p, item, lv) {
  if (p.getGameMode() === GameMode.creative) return true;
  const dur = /** @type {ItemDurabilityComponent | undefined} */ (item.getComponent("minecraft:durability"));
  if (!dur) return true;
  if (Math.random() >= 1 / (lv.unbreaking + 1)) return true;
  if (lv.infinity && Math.random() < 0.5) return true;
  const inv = container(p);
  if (!inv) return true;
  if (dur.damage >= dur.maxDurability) {
    inv.setItem(p.selectedSlotIndex, undefined);
    sound(p.dimension, "random.break", p.location, 1, 1);
    fx(p.dimension, "magic_guns:break_burst", p.getHeadLocation());
    return false;
  }
  dur.damage += 1;
  inv.setItem(p.selectedSlotIndex, item);
  return true;
}

// ----------------------------------------------------------------- firing

/** @param {Player} p */
function tryFire(p) {
  const tick = system.currentTick;
  if ((readyAt.get(p.id) ?? 0) > tick) return;
  const held = heldGun(p);
  if (!held) return;
  const { item, weapon } = held;
  readyAt.set(p.id, tick + weapon.cooldown);
  const lv = enchantLevels(item);
  if (!wear(p, item, lv)) return;
  const mods = { damage: lv.power ? 1 + 0.25 * (lv.power + 1) : 1, punch: lv.punch, flame: lv.flame > 0 };

  const dir = aim(p);
  const eye = p.getHeadLocation();
  const { right, up } = V.basis(dir);
  // Visual muzzle: in front of the eyes, down and to the right where the gun is.
  const muzzle = V.add(eye, V.add(V.scale(dir, 1.1), V.add(V.scale(right, 0.32), V.scale(up, -0.28))));
  fx(p.dimension, "magic_guns:muzzle_flash", muzzle, weapon.color);
  // Hotbar cooldown sweep + the attachable's recoil kick both read this.
  try {
    p.startItemCooldown(weapon.id.replace(":", "_"), weapon.cooldown);
  } catch {}
  sound(p.dimension, weapon.fireSound, eye, 0.92 + Math.random() * 0.16, 1);

  const volley = { hits: new Map(), struck: false };
  for (let i = 0; i < weapon.pellets; i++) {
    if (shots.length >= MAX_SHOTS) shots.shift();
    const d = V.spread(dir, weapon.spread);
    shots.push({
      owner: p,
      ownerId: p.id,
      dim: p.dimension,
      pos: eye,
      vel: V.scale(d, weapon.speed),
      weapon,
      traveled: 0,
      pierceLeft: weapon.pierce,
      hitIds: new Set(),
      age: 0,
      done: false,
      volley,
      mods,
    });
  }
  if (weapon.recoil) {
    try {
      p.applyKnockback(-dir.x, -dir.z, weapon.recoil, 0.05);
    } catch {}
  }
}

// ------------------------------------------------------------ projectiles

/** @param {Shot} s */
function step(s) {
  s.age++;
  const w = s.weapon;
  const speed = V.len(s.vel);
  if (speed < 1e-3 || !s.owner.isValid()) {
    s.done = true;
    return;
  }
  const dir = V.scale(s.vel, 1 / speed);
  const seg = Math.min(speed, w.range - s.traveled);

  // 1. nearest solid block along this tick's segment
  let blockHit;
  try {
    blockHit = s.dim.getBlockFromRay(s.pos, dir, {
      maxDistance: seg,
      includeLiquidBlocks: !!w.liquids,
      includePassableBlocks: false,
    });
  } catch {
    s.done = true; // ray left the loaded world
    return;
  }
  const blockAt = blockHit ? V.add(blockHit.block.location, blockHit.faceLocation) : undefined;
  const blockDist = blockAt ? V.dist(s.pos, blockAt) : Infinity;

  // 2. living entities in front of that block
  /** @type {import("@minecraft/server").EntityRaycastHit[]} */
  let hits = [];
  try {
    hits = s.dim.getEntitiesFromRay(s.pos, dir, { maxDistance: Math.min(seg, blockDist), ...TARGET_FILTER });
  } catch {}
  hits = hits
    .filter((h) => h.entity.id !== s.ownerId && !s.hitIds.has(h.entity.id) && h.entity.isValid() && health(h.entity))
    .sort((a, b) => a.distance - b.distance);

  for (const h of hits) {
    const at = V.add(s.pos, V.scale(dir, h.distance));
    drawTrail(s, dir, h.distance);
    s.hitIds.add(h.entity.id);
    hitEntity(s, h.entity, at, dir);
    if (s.pierceLeft-- <= 0) {
      s.done = true;
      return;
    }
  }

  if (blockHit && blockAt) {
    drawTrail(s, dir, blockDist);
    impactFlash(s, blockAt);
    w.onHitBlock?.call(w, s, blockHit, blockAt);
    s.done = true;
    return;
  }

  drawTrail(s, dir, seg);
  s.pos = V.add(s.pos, V.scale(dir, seg));
  s.traveled += seg;
  if (s.traveled >= w.range - 1e-6) {
    w.onExpire?.call(w, s);
    fx(s.dim, w.impact, s.pos, w.color);
    s.done = true;
    return;
  }
  // gravity + homing for the next tick
  let vel = s.vel;
  if (w.gravity) vel = { x: vel.x, y: vel.y - w.gravity, z: vel.z };
  if (w.homing) vel = steer(s, vel);
  s.vel = vel;
  w.onTick?.call(w, s);
}

/** @param {Shot} s @param {Entity} target @param {import("@minecraft/server").Vector3} at @param {import("@minecraft/server").Vector3} dir */
function hitEntity(s, target, at, dir) {
  const w = s.weapon;
  hurt(s, target, w.damage);
  const kb = w.knockback + s.mods.punch * 0.45;
  if (kb) {
    try {
      target.applyKnockback(dir.x, dir.z, kb, 0.12 + s.mods.punch * 0.05);
    } catch {}
  }
  if (s.mods.flame) {
    try {
      target.setOnFire(5, true);
    } catch {}
  }
  impactFlash(s, at);
  w.onHitEntity?.call(w, s, target, at);
}

/** Arcane homing: bend toward the closest enemy roughly in front. @param {Shot} s @param {import("@minecraft/server").Vector3} vel */
function steer(s, vel) {
  const speed = V.len(vel);
  const dir = V.scale(vel, 1 / speed);
  let best;
  let bestScore = -Infinity;
  /** @type {Entity[]} */
  let near = [];
  try {
    near = s.dim.getEntities({ location: s.pos, maxDistance: 7, ...TARGET_FILTER });
  } catch {}
  for (const e of near) {
    if (e.id === s.ownerId || s.hitIds.has(e.id) || !health(e)) continue;
    const to = V.sub(V.bodyCenter(e), s.pos);
    const d = V.len(to);
    const facing = V.dot(V.scale(to, 1 / Math.max(d, 1e-6)), dir);
    if (facing < 0.55) continue;
    const score = facing * 2 - d / 7;
    if (score > bestScore) {
      bestScore = score;
      best = to;
    }
  }
  if (!best) return vel;
  const nd = V.norm(V.lerp(dir, V.norm(best), s.weapon.homing));
  return V.scale(nd, speed);
}

/** @param {Shot} s @param {import("@minecraft/server").Vector3} dir @param {number} distance */
function drawTrail(s, dir, distance) {
  const w = s.weapon;
  const n = Math.min(MAX_TRAIL_PER_STEP, Math.floor(distance / w.trailEvery));
  for (let i = 1; i <= n; i++) {
    const t = (i * distance) / (n + 1);
    // first block or so is hidden inside the gun / the camera
    if (s.traveled + t < 1.1) continue;
    fx(s.dim, w.trail, V.add(s.pos, V.scale(dir, t)), w.color, dir);
  }
}

/** Apply the damage gathered by each trigger pull this tick. */
function flushDamage() {
  /** @type {Set<object>} */
  const seen = new Set();
  for (const s of shots) {
    const v = s.volley;
    if (seen.has(v) || v.hits.size === 0) continue;
    seen.add(v);
    for (const { entity, damage } of v.hits.values()) {
      if (!entity.isValid()) continue;
      deal(entity, damage, s);
    }
    v.hits.clear();
  }
}

/** @param {Entity} e @param {number} damage @param {Shot} s */
function deal(e, damage, s) {
  const opts = s.owner.isValid()
    ? { cause: s.weapon.cause, damagingEntity: s.owner }
    : { cause: s.weapon.cause };
  let took = false;
  try {
    took = e.applyDamage(damage, opts);
  } catch {
    try {
      took = e.applyDamage(damage, { cause: EntityDamageCause.magic });
    } catch {}
  }
  if (took) return;
  // Still in its hurt cooldown from the previous bullet: chip the health
  // directly (never lethal, the next real hit gets the kill credit).
  const h = health(e);
  if (!h) return;
  try {
    const left = h.currentValue - damage;
    h.setCurrentValue(Math.max(1, left));
  } catch {}
}

// ------------------------------------------------------------------- HUD

/** @param {Player} p */
function hud(p) {
  const held = heldGun(p);
  if (!held) return;
  const { item, weapon } = held;
  const dur = /** @type {ItemDurabilityComponent | undefined} */ (item.getComponent("minecraft:durability"));
  const left = (readyAt.get(p.id) ?? 0) - system.currentTick;
  let bar = "";
  if (dur) {
    const frac = 1 - dur.damage / Math.max(1, dur.maxDurability);
    const filled = Math.round(frac * 10);
    const col = frac > 0.5 ? "§a" : frac > 0.2 ? "§e" : "§c";
    bar = ` §8| ${col}${"|".repeat(filled)}§8${"|".repeat(10 - filled)}`;
  }
  const state = left > 0 ? `§7charging ${Math.ceil(left / 2) / 10}s` : "§fREADY";
  try {
    p.onScreenDisplay.setActionBar(`${weapon.chat}${weapon.name}${bar} §8| ${state}`);
  } catch {}
}

// ----------------------------------------------------------------- events

world.afterEvents.itemUse.subscribe((ev) => {
  if (WEAPONS.has(ev.itemStack.typeId)) tryFire(ev.source);
});

// Tapping while looking at a nearby block is a "use on" instead of a "use".
world.afterEvents.itemUseOn.subscribe((ev) => {
  if (WEAPONS.has(ev.itemStack.typeId)) tryFire(ev.source);
});

// Holding the screen / use button: automatic fire at the gun's own rate.
world.afterEvents.itemStartUse.subscribe((ev) => {
  if (WEAPONS.has(ev.itemStack.typeId)) holding.set(ev.source.id, ev.source);
});
world.afterEvents.itemStopUse.subscribe((ev) => holding.delete(ev.source.id));
world.afterEvents.itemReleaseUse.subscribe((ev) => holding.delete(ev.source.id));
world.afterEvents.itemCompleteUse.subscribe((ev) => holding.delete(ev.source.id));

world.afterEvents.playerLeave.subscribe((ev) => {
  holding.delete(ev.playerId);
  readyAt.delete(ev.playerId);
});

world.afterEvents.playerSpawn.subscribe((ev) => {
  if (!ev.initialSpawn) return;
  const p = ev.player;
  try {
    if (p.getDynamicProperty("magic_guns:welcomed")) return;
    p.setDynamicProperty("magic_guns:welcomed", true);
  } catch {}
  system.runTimeout(() => {
    if (!p.isValid()) return;
    p.sendMessage(
      "§d✦ Magic Guns§r loaded! Find the 7 guns in the §eEquipment§r tab (Creative) or craft them with §bMana Crystals§r. Tap to fire, hold to keep firing.",
    );
  }, 60);
});

// ------------------------------------------------------------------- loop

system.runInterval(() => {
  // automatic fire while the use input is held
  for (const [id, p] of holding) {
    const player = /** @type {Player} */ (p);
    if (!player.isValid() || !heldGun(player)) {
      holding.delete(id);
      continue;
    }
    tryFire(player);
  }

  if (shots.length) {
    for (const s of shots) {
      if (!s.done) step(s);
    }
    flushDamage();
    shots = shots.filter((s) => !s.done);
  }

  if (system.currentTick % HUD_EVERY === 0) {
    for (const p of world.getAllPlayers()) hud(p);
  }
}, 1);
