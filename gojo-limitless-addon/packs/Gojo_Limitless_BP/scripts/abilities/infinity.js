import { EntityDamageCause, GameMode, system, world } from "@minecraft/server";
import { registerAbility } from "../core/cast.js";
import { flash, peekState, saveToggles } from "../core/state.js";
import { refreshBuffs } from "../core/buffs.js";
import { knock, effect, wasTechniqueHit } from "../core/combat.js";
import { NEVER_TARGET, PROJECTILES, LOOSE, isFriendly, bodyCenter } from "../core/targets.js";
import { worldSettings } from "../core/settings.js";
import { particle, sound, pose } from "../lib/fx.js";
import { alive } from "../lib/util.js";

/** @typedef {import("@minecraft/server").Player} Player */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("../core/state.js").PlayerState} PlayerState */

/** Large mobs whose melee reach is longer: keep them further away. */
const BIG = new Set([
  "minecraft:warden",
  "minecraft:ravager",
  "minecraft:iron_golem",
  "minecraft:hoglin",
  "minecraft:zoglin",
  "minecraft:ender_dragon",
  "minecraft:wither",
  "minecraft:elder_guardian",
  "minecraft:ghast",
  "minecraft:polar_bear",
  "minecraft:sniffer",
]);

/** Damage that Infinity nullifies (anything that has to "reach" you). */
const BLOCKED_CAUSES = new Set([
  EntityDamageCause.entityAttack,
  EntityDamageCause.projectile,
  EntityDamageCause.entityExplosion,
  EntityDamageCause.blockExplosion,
  EntityDamageCause.sonicBoom,
  EntityDamageCause.thorns,
  EntityDamageCause.fireworks,
  EntityDamageCause.ramAttack,
  EntityDamageCause.fallingBlock,
  EntityDamageCause.anvil,
  EntityDamageCause.stalactite,
  EntityDamageCause.magic,
  EntityDamageCause.lightning,
  EntityDamageCause.charging,
]);

const SCAN_RADIUS = 7;
const FREEZE_RADIUS = 3.2;
const HOLD_TICKS = 30;

registerAbility("infinity", (player, st) => {
  setInfinity(player, st, !st.infinity, false);
});

/**
 * @param {Player} player
 * @param {PlayerState} st
 * @param {boolean} on
 * @param {boolean} silent
 */
export function setInfinity(player, st, on, silent) {
  st.infinity = on;
  saveToggles(player, st);
  refreshBuffs(player, st, true);
  if (!on) releaseAll(st);
  if (silent) return;
  const c = bodyCenter(player);
  particle(player.dimension, on ? "gojo:infinity_toggle" : "gojo:infinity_off", c);
  sound(player.dimension, on ? "gojo.infinity.on" : "gojo.infinity.off", c, { radius: 24 });
  pose(player, "animation.gojo.infinity");
  flash(st, on ? "§b∞ Infinity §a§lON" : "§b∞ Infinity §c§lOFF", 40);
}

/** Let go of every projectile this player is holding in place. @param {PlayerState} st */
function releaseAll(st) {
  for (const id of st.frozen.keys()) {
    const e = world.getEntity(id);
    if (e && alive(e)) discard(e);
  }
  st.frozen.clear();
}

/**
 * Held projectiles vanish (tridents simply drop, so nobody loses their trident).
 * @param {Entity} e
 */
function discard(e) {
  try {
    particle(e.dimension, "gojo:infinity_ripple", e.location);
    if (e.typeId === "minecraft:thrown_trident") {
      e.clearVelocity();
      return;
    }
    e.remove();
  } catch {
    // already gone
  }
}

/**
 * Runs every 2 ticks for each player with Infinity on.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {number} tick
 */
export function infinityTick(player, st, tick) {
  const dim = player.dimension;
  const center = bodyCenter(player);
  let near;
  try {
    near = dim.getEntities({ location: center, maxDistance: SCAN_RADIUS, excludeTags: ["gojo_immune"] });
  } catch {
    return;
  }
  for (const e of near) {
    if (e.id === player.id) continue;
    let type;
    try {
      type = e.typeId;
    } catch {
      continue;
    }
    if (PROJECTILES.has(type)) {
      if (!st.frozen.has(e.id)) slowProjectile(player, st, e, center, tick);
      continue;
    }
    if (NEVER_TARGET.has(type) || LOOSE.has(type)) continue;
    try {
      if (type === "minecraft:player") {
        if (!worldSettings().pvp) continue;
        if (e.matches({ gameMode: GameMode.creative }) || e.matches({ gameMode: GameMode.spectator })) continue;
      } else if (!e.hasComponent("minecraft:health") || isFriendly(e)) {
        continue;
      }
    } catch {
      continue;
    }
    repel(player, st, e, center, tick);
  }
  holdFrozen(st, tick);
}

/**
 * Projectiles decelerate as they approach and stop dead before contact.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {Entity} e
 * @param {import("@minecraft/server").Vector3} center
 * @param {number} tick
 */
function slowProjectile(player, st, e, center, tick) {
  try {
    const proj = /** @type {import("@minecraft/server").EntityProjectileComponent | undefined} */ (
      e.getComponent("minecraft:projectile")
    );
    if (proj?.owner?.id === player.id) return; // your own arrows fly freely
  } catch {
    // owner unloaded - treat as foreign
  }
  const loc = e.location;
  const dx = loc.x - center.x;
  const dy = loc.y - center.y;
  const dz = loc.z - center.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  try {
    const v = e.getVelocity();
    const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    // Stop dead once close, or once Infinity has bled off nearly all its speed.
    if (d < FREEZE_RADIUS || (speed < 0.2 && d < SCAN_RADIUS - 1)) {
      e.clearVelocity();
      st.frozen.set(e.id, { pos: { x: loc.x, y: loc.y, z: loc.z }, since: tick });
      particle(e.dimension, "gojo:infinity_ripple", loc);
      if (tick - st.lastRippleTick > 6) {
        st.lastRippleTick = tick;
        sound(e.dimension, "gojo.infinity.block", loc, { radius: 16, volume: 0.7 });
      }
      st.infinityBlocked++;
      flash(st, "§b∞ §7Projectile stopped by Infinity", 30);
      return;
    }
    // Visible slow-down: bleed off speed the closer it gets.
    if (speed > 0.12) {
      const keep = d < 5 ? 0.35 : 0.6;
      e.clearVelocity();
      e.applyImpulse({ x: v.x * keep, y: v.y * keep, z: v.z * keep });
    }
  } catch {
    // projectile despawned
  }
}

/** @param {PlayerState} st @param {number} tick */
function holdFrozen(st, tick) {
  for (const [id, data] of st.frozen) {
    const e = world.getEntity(id);
    if (!e || !alive(e)) {
      st.frozen.delete(id);
      continue;
    }
    if (tick - data.since >= HOLD_TICKS) {
      st.frozen.delete(id);
      discard(e);
      continue;
    }
    try {
      e.clearVelocity();
      e.teleport(data.pos, { keepVelocity: false });
      if ((tick - data.since) % 8 === 0) particle(e.dimension, "gojo:infinity_ripple", data.pos);
    } catch {
      st.frozen.delete(id);
    }
  }
}

/**
 * Attackers get slower the closer they are and cannot cross the barrier.
 * @param {Player} player
 * @param {PlayerState} st
 * @param {Entity} e
 * @param {import("@minecraft/server").Vector3} center
 * @param {number} tick
 */
function repel(player, st, e, center, tick) {
  const c = bodyCenter(e);
  const dx = c.x - center.x;
  const dz = c.z - center.z;
  const dy = c.y - center.y;
  if (Math.abs(dy) > 3.5) return;
  const d = Math.sqrt(dx * dx + dz * dz);
  const barrier = BIG.has(e.typeId) ? 4.2 : 2.5;
  if (d > barrier + 2) return;
  effect(e, "slowness", 14, d < barrier + 0.7 ? 4 : 1);
  if (d >= barrier) return;
  const nx = d > 0.05 ? dx / d : Math.random() - 0.5;
  const nz = d > 0.05 ? dz / d : Math.random() - 0.5;
  const push = (barrier - d) * 0.55 + 0.25;
  knock(e, nx, nz, push, 0.02);
  if (tick - st.lastRippleTick > 5) {
    st.lastRippleTick = tick;
    const at = { x: center.x + nx * (d * 0.6), y: c.y, z: center.z + nz * (d * 0.6) };
    particle(player.dimension, "gojo:infinity_ripple", at);
  }
}

/**
 * entityHurt (players): remember that this hit came from something Infinity stops.
 * The matching entityHealthChanged event (fired right after) restores the health.
 * @param {import("@minecraft/server").EntityHurtAfterEvent} ev
 */
export function onPlayerHurt(ev) {
  const player = ev.hurtEntity;
  const st = peekState(player.id);
  if (!st || !st.infinity) return;
  if (wasTechniqueHit(player.id)) return; // another sorcerer's technique pierces Infinity
  const src = ev.damageSource;
  if (src.damagingEntity && src.damagingEntity.id === player.id) return;
  const fromSomething = !!src.damagingEntity || !!src.damagingProjectile;
  if (!fromSomething && !BLOCKED_CAUSES.has(src.cause)) return;
  st.infinityPendingTick = system.currentTick;
}

/**
 * entityHealthChanged (players): undo damage flagged by onPlayerHurt this tick.
 * @param {import("@minecraft/server").EntityHealthChangedAfterEvent} ev
 */
export function onPlayerHealthChanged(ev) {
  const st = peekState(ev.entity.id);
  if (!st || st.infinityPendingTick !== system.currentTick) return;
  if (ev.newValue >= ev.oldValue || ev.newValue <= 0) return;
  st.infinityPendingTick = -1;
  try {
    const hp = /** @type {import("@minecraft/server").EntityHealthComponent | undefined} */ (
      ev.entity.getComponent("minecraft:health")
    );
    hp?.setCurrentValue(Math.min(ev.oldValue, hp.effectiveMax));
  } catch {
    return;
  }
  st.infinityBlocked++;
  const player = /** @type {Player} */ (ev.entity);
  const c = bodyCenter(player);
  particle(player.dimension, "gojo:infinity_ripple", c);
  if (system.currentTick - st.lastRippleTick > 4) {
    st.lastRippleTick = system.currentTick;
    sound(player.dimension, "gojo.infinity.block", c, { radius: 16, volume: 0.8 });
  }
  flash(st, "§b∞ §7The attack never reached you", 30);
}
