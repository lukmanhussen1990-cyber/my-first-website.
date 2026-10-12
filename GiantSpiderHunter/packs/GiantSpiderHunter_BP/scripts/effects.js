// Sounds, particles, camera shake and logging. Every engine call is wrapped: an effect failing
// (unloaded chunk, invalid player) must never break gameplay logic.
import { world } from '@minecraft/server';
import { CONFIG } from './config.js';

export const SOUND = {
  roar: 'mob.giant_spider.roar',
  grow: 'mob.giant_spider.grow',
  attack: 'mob.giant_spider.attack',
  bite: 'mob.giant_spider.bite',
  death: 'mob.giant_spider.death',
  ambient: 'mob.giant_spider.ambient',
  heartbeat: 'mob.giant_spider.heartbeat',
};

export const PARTICLE = {
  dust: 'minecraft:dust_plume',
  roar: 'minecraft:knockback_roar_particle',
  hugeExplosion: 'minecraft:huge_explosion_emitter',
  deathExplosion: 'minecraft:death_explosion_emitter',
  campfireSmoke: 'minecraft:campfire_smoke_particle',
  smoke: 'minecraft:basic_smoke_particle',
  crit: 'minecraft:critical_hit_emitter',
};

export function log(msg) {
  console.log(`[GSH] ${msg}`);
}

export function warn(msg) {
  console.warn(`[GSH] ${msg}`);
}

export function debug(msg) {
  if (CONFIG.debug) console.warn(`[GSH debug] ${msg}`);
}

export function errorText(e) {
  if (!e) return 'unknown error';
  return `${e}${e.stack ? `\n${e.stack}` : ''}`;
}

export function playWorldSound(id, loc, volume = 1, pitch = 1) {
  try {
    world.playSound(id, loc, { volume, pitch });
  } catch (e) {
    // location unloaded
  }
}

export function playPlayerSound(player, id, volume = 1, pitch = 1, location) {
  try {
    const opts = { volume, pitch };
    if (location) opts.location = location;
    player.playSound(id, opts);
  } catch (e) {
    // player gone
  }
}

export function particle(dim, id, loc) {
  try {
    dim.spawnParticle(id, loc);
  } catch (e) {
    // unloaded chunk
  }
}

/** Ring of particles around a centre. */
export function particleRing(dim, id, center, radius, count, yOffset = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    particle(dim, id, { x: center.x + Math.cos(a) * radius, y: center.y + yOffset, z: center.z + Math.sin(a) * radius });
  }
}

export function cameraShake(player, intensity, seconds) {
  try {
    player.runCommand(`camerashake add @s ${intensity.toFixed(2)} ${seconds.toFixed(2)} positional`);
  } catch (e) {
    // commands may be unavailable for this player; harmless
  }
}

export function actionBar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch (e) {
    // player gone
  }
}

export function tell(player, text) {
  try {
    player.sendMessage(text);
  } catch (e) {
    // player gone
  }
}
