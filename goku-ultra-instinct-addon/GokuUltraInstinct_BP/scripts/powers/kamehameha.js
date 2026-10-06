// Kamehameha: "Ka... me... ha... me... HA!" — a sweeping energy wave.
import { blast, explode, hit, knock, rayBlock, targetsAlong } from '../lib/combat.js';
import { beam, fx, pose, shake, sound, title } from '../lib/fx.js';
import { setting } from '../lib/state.js';
import { add, along, frame, scale, up } from '../lib/vec.js';

const CHANT = ['§bKa...', '§bKa... me...', '§bKa... me... ha...', '§bKa... me... ha... me...'];
const RANGE = 48;

function handsPosition(caster) {
  const f = frame(caster);
  return add(add(up(caster.location, 0.85), scale(f.right, 0.45)), scale(f.forward, -0.3));
}

export function* kamehameha(caster, state) {
  const ui = state.ui;
  const dim = caster.dimension;
  const chargeTicks = ui ? 18 : 30;
  state.channel = 'kamehameha';
  try {
    pose(caster, 'kamehameha_charge');
    try {
      caster.addEffect('slowness', chargeTicks + 6, { amplifier: 2, showParticles: false });
    } catch {
      // ignore
    }
    sound(dim, 'beacon.power', caster.location, 1.2, 1.5);
    let lastPhase = -1;
    for (let t = 0; t < chargeTicks; t++) {
      const k = t / chargeTicks;
      const phase = Math.min(3, Math.floor(k * 4));
      if (phase !== lastPhase) {
        title(caster, ' ', CHANT[phase], 14);
        lastPhase = phase;
      }
      const hands = handsPosition(caster);
      const size = 0.25 + 1.1 * k;
      fx(dim, 'orb', 'blue', hands, size * 1.8);
      fx(dim, 'orb', 'silver', hands, size * 0.8);
      if (t % 3 === 0) fx(dim, 'gather', 'blue', hands, 0.4);
      if (t % 6 === 0) sound(dim, 'beacon.ambient', hands, 0.9, 1.2 + k);
      yield;
    }

    // HA!
    pose(caster, 'kamehameha_fire');
    title(caster, ui ? '§7§lHA!!!' : '§b§lHA!!!', ' ', 18);
    sound(dim, 'mob.warden.sonic_boom', caster.location, 2, 1.25);
    sound(dim, 'random.explode', caster.location, 1, 1.7);

    const beamTicks = ui ? 32 : 24;
    const damage = ui ? 15 : 9;
    const griefing = setting('griefing');
    let lastEnd;
    let lastDir;
    for (let t = 0; t < beamTicks; t++) {
      const dir = caster.getViewDirection();
      const origin = along(up(caster.getHeadLocation(), -0.35), dir, 1.0);
      const wall = rayBlock(dim, origin, dir, RANGE);
      const length = wall ? wall.distance : RANGE;
      const end = along(origin, dir, length);
      const swell = Math.max(0.3, Math.min(1, (t + 1) / 4, (beamTicks - t) / 5));
      const width = (ui ? 2.2 : 1.8) * swell;

      beam(dim, 'blue', origin, dir, length, width);
      beam(dim, 'silver', origin, dir, length, width * 0.45);
      for (let d = 0; d < length; d += 3) fx(dim, 'orb', 'blue', along(origin, dir, d), width * 0.9);
      fx(dim, 'orb', 'silver', origin, width * 1.2);
      fx(dim, 'orb', ui ? 'silver' : 'blue', end, width * 1.8);
      if (t % 2 === 0) fx(dim, 'burst', 'blue', end, 0.5);

      if (t % 3 === 0) {
        for (const target of targetsAlong(dim, origin, end, width * 0.6, caster)) {
          hit(target, caster, damage);
          knock(target, dir, 0.5, 0.12);
        }
      }
      if (wall && t % 6 === 3) explode(dim, end, ui ? 2.6 : 2.0, caster, griefing);
      if (t % 8 === 0) sound(dim, 'beacon.ambient', origin, 1, 2);
      lastEnd = end;
      lastDir = dir;
      yield;
    }

    if (lastEnd && lastDir) {
      const boom = along(lastEnd, lastDir, -0.5);
      explode(dim, boom, ui ? 4 : 3, caster, griefing);
      blast(dim, boom, ui ? 6 : 5, damage, caster, 1.4);
      fx(dim, 'burst', 'blue', boom, 2);
      fx(dim, 'ring', 'silver', boom, 9);
      shake(dim, boom, 24, 0.4, 0.6);
    }
  } finally {
    state.channel = undefined;
    try {
      caster.removeEffect('slowness');
    } catch {
      // ignore
    }
  }
}
