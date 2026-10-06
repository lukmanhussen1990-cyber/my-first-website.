// Power Pole: "Extend!" — hits whatever you look at, far away.
import { hit, isTarget, knock, rayBlock } from '../lib/combat.js';
import { fx, pose, sound } from '../lib/fx.js';
import { along, bodyCenter, up } from '../lib/vec.js';

const REACH = 28;

export function powerPole(player, state) {
  const dim = player.dimension;
  pose(player, 'punch');

  if (player.isSneaking) {
    // pole vault straight up
    try {
      player.applyKnockback(0, 0, 0, 1.4);
      player.addEffect('slow_falling', 60, { amplifier: 0, showParticles: false });
    } catch {
      // ignore
    }
    for (let y = 0; y < 6; y++) fx(dim, 'trail', 'red', up(player.location, -y * 0.6), 0.4);
    sound(dim, 'item.trident.throw', player.location, 1, 0.7);
    return true;
  }

  const head = player.getHeadLocation();
  const dir = player.getViewDirection();
  const wall = rayBlock(dim, head, dir, REACH);
  let length = wall ? wall.distance : REACH;
  let target;
  try {
    for (const seen of player.getEntitiesFromViewDirection({ maxDistance: length })) {
      if (seen.distance < length && isTarget(seen.entity, player)) {
        target = seen.entity;
        length = seen.distance;
      }
    }
  } catch {
    // ignore
  }

  const tip = up(head, -0.3);
  for (let d = 0.8; d < length; d += 0.5) fx(dim, 'trail', 'red', along(tip, dir, d), 0.35);
  fx(dim, 'orb', 'gold', along(tip, dir, length), 0.8);
  sound(dim, 'item.trident.throw', head, 1, 0.8);

  if (target) {
    hit(target, player, state.ui ? 14 : 10);
    knock(target, dir, 2.5, 0.45);
    fx(dim, 'burst', 'gold', bodyCenter(target), 0.8);
    sound(dim, 'random.anvil_land', target.location, 0.6, 1.8);
  }
  return true;
}
