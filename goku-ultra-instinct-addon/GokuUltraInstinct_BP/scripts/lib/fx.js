// Particles, sounds, poses and on-screen text.
import { MolangVariableMap } from '@minecraft/server';

const sizeVars = new Map();

function varsForSize(size) {
  const key = Math.round(size * 20) / 20;
  let vars = sizeVars.get(key);
  if (!vars) {
    vars = new MolangVariableMap();
    vars.setFloat('variable.size', key);
    sizeVars.set(key, vars);
  }
  return vars;
}

/**
 * Spawns one of the add-on particles.
 * kind: orb | trail | burst | ring | aura | spark | gather
 * color: blue | silver | gold | violet | red
 */
export function fx(dimension, kind, color, location, size = 1) {
  try {
    dimension.spawnParticle(`goku:${kind}_${color}`, location, varsForSize(size));
  } catch {
    // location in an unloaded chunk or outside the world
  }
}

/** A whole energy-beam segment drawn by a single particle emitter. */
export function beam(dimension, color, origin, dir, length, size) {
  try {
    const vars = new MolangVariableMap();
    vars.setFloat('variable.size', size);
    vars.setFloat('variable.length', length);
    vars.setVector3('variable.direction', dir);
    dimension.spawnParticle(`goku:beam_${color}`, origin, vars);
  } catch {
    // ignore
  }
}

/** Plays a sound at a location for the players close enough to hear it. */
export function sound(dimension, id, location, volume = 1, pitch = 1) {
  const range = Math.max(16, volume * 16);
  try {
    for (const player of dimension.getPlayers({ location, maxDistance: range })) {
      player.playSound(id, { location, volume, pitch });
    }
  } catch {
    // ignore
  }
}

/** Plays one of the Goku poses (see RP animations/goku_poses.animation.json). */
export function pose(entity, name) {
  try {
    entity.playAnimation(`animation.goku.${name}`, { blendOutTime: 0.2, controller: 'goku_pose' });
  } catch {
    // ignore
  }
}

export const isPlayer = (entity) => entity.typeId === 'minecraft:player';

export function actionBar(entity, text) {
  if (!isPlayer(entity)) return;
  try {
    entity.onScreenDisplay.setActionBar(text);
  } catch {
    // ignore
  }
}

export function title(entity, text, subtitle, stay = 20) {
  if (!isPlayer(entity)) return;
  try {
    entity.onScreenDisplay.setTitle(text, { fadeInDuration: 0, stayDuration: stay, fadeOutDuration: 8, subtitle });
  } catch {
    // ignore
  }
}

export function shake(dimension, location, radius, intensity, seconds) {
  const { x, y, z } = location;
  try {
    dimension.runCommand(
      `camerashake add @a[x=${x.toFixed(1)},y=${y.toFixed(1)},z=${z.toFixed(1)},r=${radius}] ${intensity} ${seconds} positional`
    );
  } catch {
    // no players in range
  }
}
