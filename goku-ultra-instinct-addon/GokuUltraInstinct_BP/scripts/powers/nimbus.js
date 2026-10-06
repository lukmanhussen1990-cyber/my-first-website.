// Flying Nimbus: a golden cloud that flies wherever you look.
import { actionBar, fx, sound, title } from '../lib/fx.js';
import { distance, scale, up } from '../lib/vec.js';

const CLOUD = 'goku:nimbus';
const active = new Set();
let counter = 0;

export function toggleNimbus(player, state) {
  if (state.nimbus) {
    land(player, state);
    return true;
  }
  const dim = player.dimension;
  let cloud;
  try {
    cloud = dim.spawnEntity(CLOUD, player.location);
  } catch {
    actionBar(player, '§cThe Nimbus cannot reach you here!');
    return false;
  }
  const tag = `goku_cloud_${++counter}`;
  cloud.addTag('goku_nimbus');
  cloud.addTag(tag);
  active.add(cloud.id);
  state.nimbus = cloud;
  state.nimbusMiss = 0;
  try {
    player.runCommand(`ride @s start_riding @e[type=${CLOUD},tag=${tag},c=1] teleport_rider`);
  } catch {
    // the player can still tap the cloud to sit on it
  }
  title(player, ' ', '§e§lFlying Nimbus! §r§7Look where you want to fly', 30);
  fx(dim, 'burst', 'gold', player.location, 1.2);
  fx(dim, 'ring', 'gold', player.location, 4);
  sound(dim, 'random.orb', player.location, 1, 0.7);
  sound(dim, 'mob.enderdragon.flap', player.location, 0.8, 1.6);
  return true;
}

export function land(player, state) {
  const cloud = state.nimbus;
  state.nimbus = undefined;
  try {
    player.runCommand('ride @s stop_riding');
  } catch {
    // not riding
  }
  if (cloud && cloud.isValid()) {
    active.delete(cloud.id);
    fx(cloud.dimension, 'burst', 'gold', cloud.location, 1.2);
    sound(cloud.dimension, 'random.pop', cloud.location, 1, 0.6);
    try {
      cloud.remove();
    } catch {
      // ignore
    }
  }
  try {
    player.addEffect('slow_falling', 80, { amplifier: 0, showParticles: false });
  } catch {
    // ignore
  }
}

/** Called every tick for a player that summoned a Nimbus. */
export function steerNimbus(player, state, tick) {
  const cloud = state.nimbus;
  if (!cloud || !cloud.isValid()) {
    state.nimbus = undefined;
    return;
  }
  // jumped off (sneak / dismount button)? then the cloud flies away
  if (distance(player.location, up(cloud.location, 0.4)) > 4) {
    state.nimbusMiss = (state.nimbusMiss ?? 0) + 1;
    if (state.nimbusMiss > 8) land(player, state);
    return;
  }
  state.nimbusMiss = 0;
  const speed = state.ui ? 1.1 : 0.8;
  const dir = player.getViewDirection();
  try {
    cloud.clearVelocity();
    cloud.applyImpulse(scale(dir, speed));
    cloud.setRotation({ x: 0, y: player.getRotation().y });
  } catch {
    // ignore
  }
  if (tick % 2 === 0) fx(cloud.dimension, 'trail', 'gold', cloud.location, 1.3);
}

/** Removes clouds nobody is riding (e.g. after the world was reloaded). */
export function cleanupClouds(dimensions) {
  for (const dim of dimensions) {
    try {
      for (const cloud of dim.getEntities({ type: CLOUD })) {
        if (!active.has(cloud.id)) cloud.remove();
      }
    } catch {
      // ignore
    }
  }
}

export function forgetCloud(cloud) {
  if (cloud) active.delete(cloud.id);
}
