// =====================================================
//  Arcane Weapons - custom weapon behavior (Script API)
//  @minecraft/server
//
//  Flame Sword  : melee hits set enemies ablaze; right-click
//                 unleashes a spreading wave of fire.
//  Arcane Staff : right-click casts an explosive fireball.
//  Storm Hammer : melee hits call down a lightning bolt.
// =====================================================
import { world, EquipmentSlot } from "@minecraft/server";

const FLAME_SWORD = "arcane:flame_sword";
const ARCANE_STAFF = "arcane:arcane_staff";
const STORM_HAMMER = "arcane:storm_hammer";

// Get the item currently held in the main hand (or undefined).
function mainhand(entity) {
  try {
    const eq = entity.getComponent("minecraft:equippable");
    return eq ? eq.getEquipment(EquipmentSlot.Mainhand) : undefined;
  } catch {
    return undefined;
  }
}

// ---- Melee effects -------------------------------------------------
world.afterEvents.entityHurt.subscribe((ev) => {
  const src = ev.damageSource?.damagingEntity;
  const victim = ev.hurtEntity;
  if (!src || !victim) return; // fire/lightning ticks have no attacker -> ignored

  const item = mainhand(src);
  if (!item) return;

  if (item.typeId === FLAME_SWORD) {
    try { victim.setOnFire(6, true); } catch {}
    try { victim.dimension.spawnParticle("minecraft:basic_flame_particle", victim.location); } catch {}
    try { victim.dimension.playSound("mob.blaze.shoot", victim.location); } catch {}
  } else if (item.typeId === STORM_HAMMER) {
    try { victim.dimension.spawnEntity("minecraft:lightning_bolt", victim.location); } catch {}
  }
});

// ---- Use (right-click) effects ------------------------------------
// Lightweight per-player cooldown so abilities can't be spammed.
const lastUse = new Map();
function ready(id, key, ms) {
  const now = Date.now();
  const k = id + ":" + key;
  if (now - (lastUse.get(k) ?? 0) < ms) return false;
  lastUse.set(k, now);
  return true;
}

world.afterEvents.itemUse.subscribe((ev) => {
  const player = ev.source;
  const item = ev.itemStack;
  if (!player || !item) return;

  if (item.typeId === ARCANE_STAFF) {
    if (!ready(player.id, "staff", 700)) return;
    shoot(player, "minecraft:fireball", 2.6);
    try { player.dimension.playSound("mob.ghast.fireball", player.location); } catch {}
  } else if (item.typeId === FLAME_SWORD) {
    if (!ready(player.id, "sword", 1500)) return;
    fireWave(player);
    try { player.dimension.playSound("mob.blaze.shoot", player.location); } catch {}
  }
});

// Spawn a projectile from the player's eyes and launch it forward.
function shoot(player, typeId, speed) {
  const v = player.getViewDirection();
  const h = player.getHeadLocation();
  const pos = { x: h.x + v.x * 0.8, y: h.y + v.y * 0.8, z: h.z + v.z * 0.8 };
  try {
    const proj = player.dimension.spawnEntity(typeId, pos);
    const pc = proj.getComponent("minecraft:projectile");
    if (pc) {
      try { pc.owner = player; } catch {}
      pc.shoot({ x: v.x * speed, y: v.y * speed, z: v.z * speed });
    }
  } catch {}
}

// Flame Sword special: a fan of small (igniting) fireballs.
function fireWave(player) {
  const v = player.getViewDirection();
  const h = player.getHeadLocation();
  for (const s of [-0.18, 0, 0.18]) {
    const d = { x: v.x + s, y: v.y, z: v.z + s };
    const pos = { x: h.x + d.x * 0.8, y: h.y + d.y * 0.8, z: h.z + d.z * 0.8 };
    try {
      const fb = player.dimension.spawnEntity("minecraft:small_fireball", pos);
      const pc = fb.getComponent("minecraft:projectile");
      if (pc) {
        try { pc.owner = player; } catch {}
        pc.shoot({ x: d.x * 2.2, y: d.y * 2.2, z: d.z * 2.2 });
      }
    } catch {}
  }
}
