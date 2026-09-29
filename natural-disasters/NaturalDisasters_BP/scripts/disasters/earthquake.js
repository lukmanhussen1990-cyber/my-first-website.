// Earthquake M4 / M6 / M9: camera shake, rumble, stumbling entities, dust, falling debris and (temporary) cracks in the ground.
import { spawnParticle, playSound, shake, actionBar, playersIn } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, makeGate, hd, isWeakBlock } from './common.js';

/** per-magnitude tuning: radius, shake intensity, jolt, debris damage, cracks (count, length, depth), duration factor */
const MAG = {
  m4: { name: 'M4.0', radius: 45, shake: 0.5, jolt: 0.12, dmg: 0, cracks: 0, len: 0, depth: 0, dur: 0.5, quakes: 'rumble_low' },
  m6: { name: 'M6.0', radius: 75, shake: 1.5, jolt: 0.3, dmg: 1.5, cracks: 3, len: 18, depth: 1, dur: 1, quakes: 'rumble_heavy' },
  m9: { name: 'M9.0', radius: 120, shake: 3.2, jolt: 0.55, dmg: 3, cracks: 6, len: 34, depth: 3, dur: 1.6, quakes: 'rumble_heavy' },
};

export default {
  id: 'earthquake',
  defaultDurationSec: 40,
  variants: ['m4', 'm6', 'm9'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const m = MAG[ctx.variant] || MAG.m6;
    ctx.durationTicks = Math.round(ctx.durationTicks * m.dur);
    const R = m.radius * (0.8 + 0.1 * ctx.strength);
    const joltGate = makeGate(16);
    const debrisGate = makeGate(40);
    let lastRumble = -999, lastCrack = -999, lastWarn = -999;
    let cracksLeft = ctx.settings.blockDestruction || m.cracks > 0 ? m.cracks : 0;
    /** @type {Array<{x: number, z: number, y: number, heading: number, left: number}>} */
    const cracks = [];

    ctx.say('§eEarthquake ' + m.name + '! Drop, cover and hold on.');
    playSound(ctx.dim, 'nd.' + m.quakes, ctx.origin, { volume: 6 });

    /** envelope 0..1: ramp up 15%, hold, decay from 70% */
    function env() {
      const p = ctx.progress();
      if (p < 0.15) return 0.25 + 0.75 * (p / 0.15);
      if (p > 0.7) return Math.max(0.1, (1 - p) / 0.3);
      return 0.85 + 0.15 * Math.sin(ctx.age() * 0.3);
    }

    function startCrack() {
      const a = ctx.rng() * TAU, r = 3 + ctx.rng() * R * 0.35;
      const x = ctx.origin.x + Math.cos(a) * r, z = ctx.origin.z + Math.sin(a) * r;
      cracks.push({ x, z, y: ctx.origin.y, heading: ctx.rng() * TAU, left: m.len });
    }

    return {
      update() {
        const t = ctx.age();
        const E = env();
        const dt = ctx.dt;

        shake(ctx.dim, ctx.origin, R, m.shake * E * ctx.mul, 1.5);

        if (t - lastRumble >= 30) {
          lastRumble = t;
          playSound(ctx.dim, 'nd.' + m.quakes, ctx.origin, { volume: 3 + 4 * E, pitch: 0.9 + ctx.rng() * 0.2 });
          if (ctx.rng() < 0.4) playSound(ctx.dim, 'nd.stone_grind', ctx.origin, { volume: 3 });
        }

        // per-player effects: dust, jolts, falling debris
        const pl = playersIn(ctx.dim);
        for (let i = 0; i < pl.length; i++) {
          const p = pl[i];
          const d = hd(p.loc.x, p.loc.z, ctx.origin.x, ctx.origin.z);
          if (d > R) continue;
          const k = 1 - d / R;
          for (let n = 0; n < 3; n++) {
            const a = ctx.rng() * TAU, r = 2 + ctx.rng() * 14;
            spawnParticle(ctx.dim, 'nd:dust_puff', { x: p.loc.x + Math.cos(a) * r, y: p.loc.y + 0.2, z: p.loc.z + Math.sin(a) * r }, { size: 1 + E, vel: { x: 0, y: 0.15, z: 0 } });
          }
          if (ctx.rng() < 0.5) {
            const a = ctx.rng() * TAU, r = 3 + ctx.rng() * 10;
            spawnParticle(ctx.dim, 'nd:crack_dust', { x: p.loc.x + Math.cos(a) * r, y: p.loc.y + 0.1, z: p.loc.z + Math.sin(a) * r }, { size: 1.5 });
          }
          if (m.dmg > 0 && E > 0.5 && ctx.rng() < 0.12 * k && debrisGate(p.player.id, t)) {
            const px = p.loc.x + (ctx.rng() - 0.5) * 4, pz = p.loc.z + (ctx.rng() - 0.5) * 4;
            for (let n = 0; n < 4; n++) spawnParticle(ctx.dim, 'nd:debris_chip', { x: px + (ctx.rng() - 0.5), y: p.loc.y + 3 + ctx.rng() * 3, z: pz + (ctx.rng() - 0.5) }, { size: 1.2, vel: { x: 0, y: -0.4, z: 0 } });
            playSound(ctx.dim, 'nd.debris_crash', p.loc, { volume: 1.2 });
            ent.damage(p.player, m.dmg * ctx.mul, { cause: EntityDamageCause.fallingBlock, floor: 2 });
          }
        }

        // shove mobs and players sideways on the shaking ground
        const list = ent.victims(ctx.dim, ctx.origin, R, { key: 'i' + ctx.id, items: true });
        shield(list);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          if (!joltGate(e.id, t)) continue;
          let l;
          try { l = e.location; } catch (err) { continue; }
          const d = hd(l.x, l.z, ctx.origin.x, ctx.origin.z);
          if (d > R) continue;
          const k = (1 - d / R) * E;
          const a = ctx.rng() * TAU;
          const j = m.jolt * (0.4 + k) * (0.7 + 0.15 * ctx.strength);
          ent.push(e, Math.cos(a) * j, 0.12 + 0.25 * k * (ctx.variant === 'm9' ? 1.5 : 1), Math.sin(a) * j);
        }

        // cracks in the ground (temporary unless destruction is ON)
        if (cracksLeft > 0 && t - lastCrack >= 24 && t > 40) {
          lastCrack = t;
          cracksLeft--;
          startCrack();
        }
        for (let c = cracks.length - 1; c >= 0; c--) {
          const cr = cracks[c];
          const steps = Math.max(1, Math.round(dt * 0.8));
          for (let s = 0; s < steps && cr.left > 0; s++) {
            cr.heading += (ctx.rng() - 0.5) * 0.7;
            cr.x += Math.cos(cr.heading);
            cr.z += Math.sin(cr.heading);
            cr.left--;
            const gy = groundAt(ctx, cr.x, cr.z, cr.y);
            if (gy === undefined) { cr.left = 0; break; }
            cr.y = gy;
            const bx = Math.floor(cr.x), bz = Math.floor(cr.z), top = Math.floor(gy) - 1;
            for (let dpt = 0; dpt < m.depth; dpt++) ctx.setBlock(bx, top - dpt, bz, 'air', { mode: 'destructive' });
            spawnParticle(ctx.dim, 'nd:crack_dust', { x: cr.x, y: gy + 0.3, z: cr.z }, { size: 2 });
            spawnParticle(ctx.dim, 'nd:dust_puff', { x: cr.x, y: gy + 0.5, z: cr.z }, { size: 1.8, vel: { x: 0, y: 0.25, z: 0 } });
          }
          if (cr.left <= 0) {
            playSound(ctx.dim, 'nd.quake_crack', { x: cr.x, y: cr.y, z: cr.z }, { volume: 4 });
            cracks.splice(c, 1);
          }
        }

        // ON: M9 shakes weak surface blocks apart
        if (ctx.settings.blockDestruction && ctx.variant === 'm9' && E > 0.6) {
          for (let n = 0; n < 4; n++) {
            const a = ctx.rng() * TAU, r = ctx.rng() * R * 0.6;
            const x = Math.floor(ctx.origin.x + Math.cos(a) * r), z = Math.floor(ctx.origin.z + Math.sin(a) * r);
            const gy = groundAt(ctx, x, z, ctx.origin.y);
            if (gy !== undefined && isWeakBlock(ctx.dim, x, Math.floor(gy) - 1, z)) ctx.setBlock(x, Math.floor(gy) - 1, z, 'air', { mode: 'destructive' });
          }
        }

        if (t - lastWarn >= 40) {
          lastWarn = t;
          for (let i = 0; i < pl.length; i++) {
            const d = hd(pl[i].loc.x, pl[i].loc.z, ctx.origin.x, ctx.origin.z);
            if (d < R) actionBar(pl[i].player, '§eEarthquake ' + m.name + ' - ' + Math.max(0, Math.round((ctx.durationTicks - t) / 20)) + 's');
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { cracks.length = 0; },
    };
  },
};
