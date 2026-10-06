// Instant Transmission: two fingers to the forehead and you are somewhere else.
import { system } from '@minecraft/server';
import { isOpen, rayBlock, targetsNear } from '../lib/combat.js';
import { actionBar, fx, pose, sound } from '../lib/fx.js';
import { along, bodyCenter, distance, frame, scale, sub, up } from '../lib/vec.js';

const RANGE = 64;

/** Finds a free spot (feet + head) near `p`, standing on the ground if there is any close below. */
function findStand(dim, p) {
  let base = { x: Math.floor(p.x) + 0.5, y: Math.floor(p.y), z: Math.floor(p.z) + 0.5 };
  for (let drop = 0; drop < 4 && isOpen(dim, base) && isOpen(dim, up(base, -1)); drop++) {
    base = up(base, -1);
  }
  for (let dy = 0; dy <= 3; dy++) {
    const feet = up(base, dy);
    if (isOpen(dim, feet) && isOpen(dim, up(feet, 1))) return feet;
  }
  return undefined;
}

function nearestEnemy(player) {
  const all = targetsNear(player.dimension, player.location, 48, player);
  const monsters = all.filter((e) => {
    try {
      return e.matches({ families: ['monster'] });
    } catch {
      return false;
    }
  });
  const pool = monsters.length ? monsters : all;
  pool.sort((a, b) => distance(a.location, player.location) - distance(b.location, player.location));
  return pool[0];
}

export function instantTransmission(player, state) {
  const dim = player.dimension;
  let dest;
  let facing;
  let airborne = false;

  if (player.isSneaking) {
    const target = nearestEnemy(player);
    if (!target) {
      actionBar(player, '§dNo ki signature nearby...');
      state.hudUntil = system.currentTick + 30;
      return false;
    }
    const behind = sub(target.location, scale(frame(target).forward, 1.6));
    dest = findStand(dim, behind) ?? findStand(dim, target.location);
    facing = up(target.location, 1.2);
  } else {
    const head = player.getHeadLocation();
    const dir = player.getViewDirection();
    const wall = rayBlock(dim, head, dir, RANGE);
    if (wall) {
      const spot = wall.face === 'Up' ? wall.point : along(wall.point, dir, -0.7);
      dest = findStand(dim, spot);
    } else {
      dest = along(head, dir, 40);
      airborne = true;
    }
  }
  if (!dest) {
    actionBar(player, '§dCan\'t lock on to that spot!');
    state.hudUntil = system.currentTick + 30;
    return false;
  }

  pose(player, 'instant_transmission');
  const from = bodyCenter(player);
  fx(dim, 'orb', 'silver', from, 2.2);
  fx(dim, 'burst', 'violet', from, 0.9);
  sound(dim, 'mob.shulker.teleport', from, 1, 1.5);
  player.teleport(dest, facing ? { facingLocation: facing } : undefined);
  try {
    player.addEffect('slow_falling', airborne ? 120 : 30, { amplifier: 0, showParticles: false });
  } catch {
    // ignore
  }
  system.runTimeout(() => {
    if (!player.isValid()) return;
    const c = bodyCenter(player);
    fx(player.dimension, 'orb', 'silver', c, 2.2);
    fx(player.dimension, 'burst', 'violet', c, 0.9);
    fx(player.dimension, 'ring', 'violet', up(player.location, 0.1), 4);
    sound(player.dimension, 'random.orb', c, 1, 2);
  }, 1);
  return true;
}
