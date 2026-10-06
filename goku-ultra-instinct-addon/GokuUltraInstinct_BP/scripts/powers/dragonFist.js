// Dragon Fist (Silver Dragon Flash in Ultra Instinct): dash through enemies.
import { hit, isOpen, knock, targetsNear } from '../lib/combat.js';
import { fx, pose, sound, title } from '../lib/fx.js';
import { along, bodyCenter, frame, up } from '../lib/vec.js';

export function* dragonFist(caster, state) {
  const ui = state.ui;
  const dim = caster.dimension;
  const color = ui ? 'silver' : 'gold';
  const damage = ui ? 22 : 14;
  const steps = ui ? 8 : 6;
  const dir = frame(caster).forward;

  pose(caster, 'punch');
  title(caster, ' ', ui ? '§7§lSilver Dragon Flash!' : '§6§lDragon Fist!', 20);
  sound(dim, 'mob.enderdragon.growl', caster.location, 0.8, 1.5);
  sound(dim, 'item.trident.riptide_3', caster.location, 1, 1.1);

  const struck = new Map();
  for (let i = 0; i < steps; i++) {
    const next = along(caster.location, dir, 2);
    if (!isOpen(dim, up(next, 0.1)) || !isOpen(dim, up(next, 1.1))) break;
    try {
      caster.teleport(next, { keepVelocity: false });
    } catch {
      break;
    }
    const c = bodyCenter(caster);
    fx(dim, 'trail', color, c, 1.6);
    fx(dim, 'orb', color, along(c, dir, 1), 1.3);
    for (const target of targetsNear(dim, c, 2.4, caster)) {
      if (struck.has(target.id)) continue;
      struck.set(target.id, target);
      hit(target, caster, damage);
      knock(target, dir, 1.2, 1.1);
      fx(dim, 'burst', color, bodyCenter(target), 1.2);
      sound(dim, 'game.player.attack.strong', target.location, 1, 0.9);
    }
    yield;
  }

  // the dragon: a glowing spiral rising around everything that was hit
  const victims = [...struck.values()].filter((e) => e.isValid());
  if (!victims.length) return;
  sound(dim, 'mob.enderdragon.growl', victims[0].location, 1.2, 1.2);
  for (let t = 0; t < 16; t++) {
    for (const v of victims) {
      if (!v.isValid()) continue;
      const a = t * 0.8;
      const p = { x: v.location.x + Math.cos(a) * 1.3, y: v.location.y + t * 0.35, z: v.location.z + Math.sin(a) * 1.3 };
      fx(dim, 'orb', color, p, t === 15 ? 2.2 : 1.2);
      fx(dim, 'trail', color, p, 0.9);
    }
    yield;
  }
}
