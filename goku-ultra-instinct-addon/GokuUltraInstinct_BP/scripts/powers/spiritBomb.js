// Spirit Bomb: raise your hands, gather energy, throw a giant ball.
import { aimPoint, blast, explode, targetsNear } from '../lib/combat.js';
import { fx, pose, shake, sound, title } from '../lib/fx.js';
import { setting } from '../lib/state.js';
import { along, distance, frame, normalize, sub, up } from '../lib/vec.js';

const FLIGHT_TICKS = 140;

function solidAt(dim, location) {
  try {
    const block = dim.getBlock(location);
    if (!block) return true; // unloaded: stop here
    return !block.isAir && !block.isLiquid;
  } catch {
    return true;
  }
}

export function* spiritBomb(caster, state) {
  const ui = state.ui;
  const dim = caster.dimension;
  const chargeTicks = ui ? 40 : 60;
  state.channel = 'spirit_bomb';
  try {
    pose(caster, 'spirit_bomb');
    try {
      caster.addEffect('slowness', chargeTicks + 10, { amplifier: 4, showParticles: false });
    } catch {
      // ignore
    }
    title(caster, ' ', '§9Everyone... lend me your energy!', chargeTicks);
    sound(dim, 'beacon.power', caster.location, 1.5, 0.8);

    let center = up(caster.location, 4);
    for (let t = 0; t < chargeTicks; t++) {
      const k = (t + 1) / chargeTicks;
      center = up(caster.location, 3.5 + 2.5 * k);
      const size = 0.6 + 5.4 * k;
      fx(dim, 'orb', 'blue', center, size);
      fx(dim, 'orb', 'silver', center, size * 0.55);
      if (t % 2 === 0) fx(dim, 'gather', 'blue', center, 0.6 + k * 1.4);
      if (t % 5 === 0) fx(dim, 'spark', 'silver', center, size * 0.5);
      if (t % 10 === 0) sound(dim, 'beacon.ambient', center, 1.4, 0.8 + k);
      yield;
    }

    // throw it where the caster is looking
    pose(caster, 'spirit_bomb_throw');
    title(caster, '§9§lSPIRIT BOMB!', ' ', 24);
    sound(dim, 'mob.enderdragon.flap', center, 2, 0.6);
    state.channel = undefined;
    try {
      caster.removeEffect('slowness');
    } catch {
      // ignore
    }

    // fly from above the head to whatever is under the crosshair
    let target = aimPoint(caster, 80);
    let dir = normalize(sub(target, center));
    if (dir.y > 0.2) {
      // still looking up at the bomb: throw it forward and down instead
      const forward = frame(caster).forward;
      target = aimPoint(caster, 40, normalize({ x: forward.x, y: -0.35, z: forward.z }));
      dir = normalize(sub(target, center));
    }
    const total = distance(center, target);
    const speed = ui ? 1.0 : 0.75;
    const radius = 3;
    let pos = center;
    let travelled = 0;
    for (let t = 0; t < FLIGHT_TICKS; t++) {
      travelled = Math.min(total, travelled + speed);
      pos = along(center, dir, travelled);
      fx(dim, 'orb', 'blue', pos, 6);
      fx(dim, 'orb', 'silver', pos, 3.3);
      if (t % 2 === 0) fx(dim, 'trail', 'blue', pos, 4);
      if (t % 4 === 0) fx(dim, 'spark', 'silver', pos, 2.5);
      if (t % 10 === 0) sound(dim, 'beacon.ambient', pos, 1.6, 0.6);
      const front = along(pos, dir, radius * 0.8);
      const bottom = up(pos, -radius * 0.8);
      if (travelled >= total) break;
      if (solidAt(dim, front) || solidAt(dim, bottom) || targetsNear(dim, pos, radius + 0.5, caster).length) break;
      yield;
    }

    // BOOM
    const griefing = setting('griefing');
    explode(dim, pos, ui ? 8 : 7, caster, griefing);
    blast(dim, pos, 12, ui ? 40 : 30, caster, 2.5);
    fx(dim, 'orb', 'silver', pos, 14);
    fx(dim, 'burst', 'blue', pos, 4);
    fx(dim, 'burst', 'silver', pos, 3);
    fx(dim, 'ring', 'silver', pos, 30);
    fx(dim, 'ring', 'blue', up(pos, 0.5), 22);
    sound(dim, 'random.explode', pos, 4, 0.6);
    sound(dim, 'ambient.weather.thunder', pos, 3, 0.8);
    shake(dim, pos, 40, 0.8, 1.5);
    for (let t = 0; t < 12; t++) {
      fx(dim, 'orb', 'blue', pos, 10 - t * 0.7);
      if (t % 3 === 0) fx(dim, 'burst', 'blue', pos, 2);
      yield;
    }
  } finally {
    state.channel = undefined;
  }
}
