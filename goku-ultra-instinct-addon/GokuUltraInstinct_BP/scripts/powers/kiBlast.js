// Ki Blast: fast energy balls, alternating hands.
import { aimPoint, blast, rayBlock, targetsNear } from '../lib/combat.js';
import { fx, pose, sound } from '../lib/fx.js';
import { add, along, frame, length, normalize, scale, sub, up } from '../lib/vec.js';

const RANGE = 60;
const SPEED = 1.8;

export function* kiBlast(caster, state) {
  const ui = state.ui;
  const dim = caster.dimension;
  const color = ui ? 'silver' : 'gold';
  const damage = ui ? 8 : 5;
  const f = frame(caster);
  state.hand = state.hand ? 0 : 1;
  pose(caster, state.hand ? 'blast_right' : 'blast_left');

  const start = along(add(up(caster.getHeadLocation(), -0.4), scale(f.right, state.hand ? 0.35 : -0.35)), f.look, 0.8);
  const aim = sub(aimPoint(caster, RANGE), start);
  const dir = length(aim) > 1.5 ? normalize(aim) : f.look;
  const wall = rayBlock(dim, start, dir, RANGE);
  const maxDistance = wall ? wall.distance : RANGE;
  sound(dim, 'mob.blaze.shoot', start, 0.7, 1.7);

  let travelled = 0;
  let pos = start;
  while (true) {
    fx(dim, 'orb', color, pos, 0.8);
    fx(dim, 'trail', color, pos, 0.55);
    if (targetsNear(dim, pos, 1.3, caster).length || travelled >= maxDistance) break;
    const step = Math.min(SPEED, maxDistance - travelled);
    travelled += step;
    pos = along(start, dir, travelled);
    yield;
  }

  blast(dim, pos, 2.2, damage, caster, 0.6);
  fx(dim, 'burst', color, pos, 0.6);
  fx(dim, 'ring', color, pos, 2.5);
  sound(dim, 'firework.blast', pos, 1, 1.4);
}
