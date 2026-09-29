// Volcano: rumbling vent with an ash column, lava fountain, flying lava bombs, glowing magma and localized burning.
import { spawnParticle, playSound, shake, actionBar, playersIn, explode } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { ENTITY_IDS } from '../config.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, makeGate, hd } from './common.js';

export default {
  id: 'volcano',
  defaultDurationSec: 90,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.7 + 0.15 * ctx.strength;
    const H = 44 * scale;
    const gy0 = groundAt(ctx, ctx.origin.x, ctx.origin.z, ctx.origin.y);
    const vent = { x: ctx.origin.x, y: gy0 === undefined ? ctx.origin.y : gy0, z: ctx.origin.z };
    const ventR = 3 + ctx.strength * 0.6;
    const wind = ctx.rng() * TAU;
    const wx = Math.cos(wind) * 0.35, wz = Math.sin(wind) * 0.35;
    const heatGate = makeGate(12);
    const bombGate = makeGate(20);
    /** @type {Array<{e: import('@minecraft/server').Entity, born: number}>} */
    let bombs = [];
    /** @type {Array<{x: number, y: number, z: number, until: number}>} */
    let spots = [];
    let lastBomb = 0, lastRumble = -999, lastBlast = -999, lastWarn = -999;
    let lavaPlaced = 0;

    // glowing magma ring at the vent (temporary, restored when the volcano ends)
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU, r = ventR * (0.5 + 0.5 * ctx.rng());
      const x = Math.floor(vent.x + Math.cos(a) * r), z = Math.floor(vent.z + Math.sin(a) * r);
      const s = blk.surface(ctx.dim, x, z, vent.y + 3, 8);
      if (s && !s.liquid) ctx.setBlock(x, s.y, z, 'magma', { mode: 'temporary' });
    }
    ctx.say('§6The ground trembles... a volcano is erupting!');
    playSound(ctx.dim, 'nd.volcano_rumble', vent, { volume: 6 });

    /** eruption strength 0..1 over the timeline */
    function intensity() {
      const p = ctx.progress();
      if (p < 0.1) return 0.2 + p * 3;
      if (p > 0.85) return Math.max(0.1, (1 - p) / 0.15);
      return 0.75 + 0.25 * Math.sin(ctx.age() * 0.05);
    }

    /** @param {number} x @param {number} y @param {number} z */
    function bombImpact(x, y, z) {
      const gy = groundAt(ctx, x, z, y) ;
      const iy = gy === undefined ? y : gy;
      const pt = { x, y: iy, z };
      playSound(ctx.dim, 'nd.lava_pop', pt, { volume: 2.5 });
      for (let k = 0; k < 4; k++) {
        spawnParticle(ctx.dim, 'nd:flame', { x: x + (ctx.rng() - 0.5) * 1.5, y: iy + 0.3, z: z + (ctx.rng() - 0.5) * 1.5 }, { size: 1.6 });
        spawnParticle(ctx.dim, 'nd:spark', pt, { size: 1, vel: { x: (ctx.rng() - 0.5) * 0.6, y: 0.5, z: (ctx.rng() - 0.5) * 0.6 } });
      }
      spawnParticle(ctx.dim, 'nd:debris_chip', pt, { size: 1.5 });
      spawnParticle(ctx.dim, 'nd:smoke_puff', pt, { size: 2.5 });
      const near = ent.victims(ctx.dim, pt, 4, { key: 'b' + ctx.id + Math.floor(x) + '_' + Math.floor(z), players: true, mobs: true, max: 12 });
      shield(near);
      for (let i = 0; i < near.length; i++) {
        ent.damage(near[i], 4 * ctx.mul, { cause: EntityDamageCause.lava });
        ent.setFire(near[i], 5);
        try {
          const l = near[i].location;
          const d = hd(x, z, l.x, l.z) || 0.5;
          ent.push(near[i], ((l.x - x) / d) * 0.5, 0.45, ((l.z - z) / d) * 0.5);
        } catch (err) { /* gone */ }
      }
      if (spots.length < 30) spots.push({ x, y: iy, z, until: ctx.age() + 120 });
      if (ctx.settings.blockDestruction) {
        if (ctx.rng() < 0.5) ctx.setBlock(Math.floor(x), Math.floor(iy), Math.floor(z), 'fire', { mode: 'destructive', onlyAir: true });
        if (ctx.rng() < 0.2 && lavaPlaced < 12) {
          if (ctx.setBlock(Math.floor(x), Math.floor(iy) - 1, Math.floor(z), 'lava', { mode: 'destructive' }) === 'ok') lavaPlaced++;
        }
      }
    }

    return {
      update() {
        const t = ctx.age();
        const I = intensity();
        const erupt = ctx.progress() > 0.1;

        // smoke / ash column
        const nCol = Math.max(3, Math.floor(ctx.q.particlesPerTick / 10 * (0.4 + I)));
        for (let k = 0; k < nCol; k++) {
          const h = ctx.rng() * H * (0.35 + 0.65 * I);
          const w = 1.2 + h * 0.16;
          spawnParticle(ctx.dim, 'nd:smoke_puff', { x: vent.x + wx * h * 0.5 + (ctx.rng() - 0.5) * w, y: vent.y + 2 + h, z: vent.z + wz * h * 0.5 + (ctx.rng() - 0.5) * w }, { size: 2.5 + h * 0.12, life: 2 + I, vel: { x: wx * 0.25, y: 0.35, z: wz * 0.25 } });
        }
        for (let k = 0; k < 3; k++) {
          const a = ctx.rng() * TAU, r = ctx.rng() * 26;
          spawnParticle(ctx.dim, 'nd:ash_flake', { x: vent.x + Math.cos(a) * r + wx * 8, y: vent.y + 8 + ctx.rng() * 16, z: vent.z + Math.sin(a) * r + wz * 8 }, { size: 1, vel: { x: wx * 0.15, y: -0.12, z: wz * 0.15 } });
        }
        if (erupt) {
          for (let k = 0; k < 3; k++) {
            const a = ctx.rng() * TAU, h = 0.25 + ctx.rng() * 0.35;
            spawnParticle(ctx.dim, 'nd:lava_glob', { x: vent.x, y: vent.y + 1.5, z: vent.z }, { size: 1.4, vel: { x: Math.cos(a) * h, y: 0.9 + ctx.rng() * 0.9 * I, z: Math.sin(a) * h } });
          }
          spawnParticle(ctx.dim, 'nd:flame', { x: vent.x + (ctx.rng() - 0.5) * ventR, y: vent.y + 1, z: vent.z + (ctx.rng() - 0.5) * ventR }, { size: 2.4 });
        }
        for (let k = 0; k < 3; k++) {
          const a = ctx.rng() * TAU, r = ventR * ctx.rng();
          spawnParticle(ctx.dim, 'nd:ember', { x: vent.x + Math.cos(a) * r, y: vent.y + 1, z: vent.z + Math.sin(a) * r }, { size: 1, vel: { x: 0, y: 0.2 + ctx.rng() * 0.3, z: 0 } });
        }

        // lava bombs
        const gap = Math.max(10, Math.round(46 / (0.4 + I * ctx.mul * 1.2)));
        if (erupt && t - lastBomb >= gap && bombs.length < Math.max(3, Math.floor(ctx.q.maxDebris / 2))) {
          lastBomb = t;
          const e = ctx.spawn(ENTITY_IDS.lavaBomb, { x: vent.x, y: vent.y + 2, z: vent.z }, 200, ctx.q.maxDebris);
          if (e) {
            const a = ctx.rng() * TAU, h = 0.35 + ctx.rng() * 0.6 * (0.6 + 0.4 * ctx.strength / 3);
            try { e.applyImpulse({ x: Math.cos(a) * h, y: 1.1 + ctx.rng() * 0.7, z: Math.sin(a) * h }); } catch (err) { /* no physics */ }
            bombs.push({ e, born: t });
            playSound(ctx.dim, 'nd.volcano_blast', vent, { volume: 4 });
          }
        }
        const alive = [];
        for (let i = 0; i < bombs.length; i++) {
          const b = bombs[i];
          let l, ground = false;
          try { if (!b.e.isValid()) continue; l = b.e.location; ground = b.e.isOnGround; } catch (err) { continue; }
          spawnParticle(ctx.dim, 'nd:flame', l, { size: 1.2 });
          spawnParticle(ctx.dim, 'nd:smoke_puff', l, { size: 1.2 });
          const aged = t - b.born;
          if ((ground && aged > 8) || aged > 160 || l.y < vent.y - 12) {
            bombImpact(l.x, l.y, l.z);
            ent.removeEntity(b.e);
          } else alive.push(b);
        }
        bombs = alive;

        // burning ground spots
        spots = spots.filter((s) => s.until > t);
        for (let i = 0; i < spots.length; i++) {
          spawnParticle(ctx.dim, 'nd:flame', { x: spots[i].x, y: spots[i].y + 0.3, z: spots[i].z }, { size: 1.3 });
        }

        // heat near the vent
        const near = ent.victims(ctx.dim, vent, ventR + 10, { key: 'i' + ctx.id });
        shield(near);
        for (let i = 0; i < near.length; i++) {
          let l;
          try { l = near[i].location; } catch (err) { continue; }
          const d = hd(vent.x, vent.z, l.x, l.z);
          if (d < ventR + 1.5 && l.y < vent.y + 6 && heatGate(near[i].id, t)) {
            ent.damage(near[i], 2.5 * ctx.mul, { cause: EntityDamageCause.fire });
            ent.setFire(near[i], 4);
            if (d > 0.5) ent.push(near[i], ((l.x - vent.x) / d) * 0.35, 0.3, ((l.z - vent.z) / d) * 0.35);
          } else if (d < ventR + 10 && erupt && I > 0.6 && bombGate(near[i].id, t)) {
            ent.softEffect(near[i], 'nausea', 60, 0);
          }
        }

        if (erupt && I > 0.9 && ctx.rng() < 0.03) explode(ctx.dim, { x: vent.x, y: vent.y + 3, z: vent.z }, 2.5 + ctx.strength * 0.5, {});

        // sound, shake, warning
        if (t - lastRumble >= 50) { lastRumble = t; playSound(ctx.dim, 'nd.volcano_rumble', vent, { volume: 5 }); }
        if (erupt && t - lastBlast >= 200) { lastBlast = t; playSound(ctx.dim, 'nd.volcano_blast', vent, { volume: 8 }); }
        shake(ctx.dim, vent, 60 * scale, (0.35 + 0.6 * I) * ctx.mul, 1);
        if (t - lastWarn >= 40) {
          lastWarn = t;
          const pl = playersIn(ctx.dim);
          for (let i = 0; i < pl.length; i++) {
            const d = hd(pl[i].loc.x, pl[i].loc.z, vent.x, vent.z);
            if (d < 100) actionBar(pl[i].player, '§6Volcano ' + Math.round(d) + ' blocks away');
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { bombs = []; spots = []; },
    };
  },
};
