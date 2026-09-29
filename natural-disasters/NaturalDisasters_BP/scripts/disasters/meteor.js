// Meteor strike: a burning rock falls from the sky with a rising whistle, then impact, crater, fire, smoke and a shockwave.
import { spawnParticle, playSound, shake, actionBar, explode } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import { ENTITY_IDS } from '../config.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, hd } from './common.js';

export default {
  id: 'meteor',
  defaultDurationSec: 45,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.7 + 0.15 * ctx.strength;
    const craterR = Math.round(3 + ctx.strength * 1.2);
    const blastR = 5 + ctx.strength * 1.3;
    const waveR = 26 * scale;
    const fallSpeed = 1.7;
    const gy0 = groundAt(ctx, ctx.origin.x, ctx.origin.z, ctx.origin.y);
    const target = { x: ctx.origin.x, y: gy0 === undefined ? ctx.origin.y : gy0, z: ctx.origin.z };
    const a0 = ctx.rng() * TAU;
    const start = { x: target.x + Math.cos(a0) * 45, y: target.y + 95, z: target.z + Math.sin(a0) * 45 };
    const pos = { x: start.x, y: start.y, z: start.z };
    const total = Math.sqrt(45 * 45 + 95 * 95);
    const step = { x: (target.x - start.x) / total, y: (target.y - start.y) / total, z: (target.z - start.z) / total };
    const rock = ctx.spawn(ENTITY_IDS.meteor, start, 600, 4);
    let impacted = false;
    let impactTick = 0;
    let wave = 0;
    /** @type {Array<{x: number, y: number, z: number, until: number}>} */
    const fires = [];
    let lastWhistle = -999;

    ctx.say('§cMeteor incoming!');
    playSound(ctx.dim, 'nd.meteor_whistle', start, { volume: 12 });

    function impact() {
      impacted = true;
      impactTick = ctx.age();
      pos.x = target.x; pos.y = target.y; pos.z = target.z;
      if (rock) ent.removeEntity(rock);
      const real = explode(ctx.dim, { x: target.x, y: target.y + 1, z: target.z }, blastR, { source: ctx.source });
      playSound(ctx.dim, 'nd.meteor_impact', target, { volume: 14 });
      playSound(ctx.dim, 'nd.shockwave', target, { volume: 10 });
      shake(ctx.dim, target, 110, 3 * ctx.mul, 3);
      for (let i = 0; i < 26; i++) {
        const a = ctx.rng() * TAU, h = 0.4 + ctx.rng() * 0.9;
        spawnParticle(ctx.dim, 'nd:debris_chip', { x: target.x, y: target.y + 1, z: target.z }, { size: 1.6, vel: { x: Math.cos(a) * h, y: 0.7 + ctx.rng() * 0.9, z: Math.sin(a) * h } });
        if (i % 2 === 0) spawnParticle(ctx.dim, 'nd:flame', { x: target.x + Math.cos(a) * 2, y: target.y + 1, z: target.z + Math.sin(a) * 2 }, { size: 2.5 });
      }
      // crater: sphere carved into the ground (temporary unless destruction is ON)
      const cx = Math.floor(target.x), cy = Math.floor(target.y) - 1, cz = Math.floor(target.z);
      if (!real) {
        ctx.job(function* () {
          for (let dy = 0; dy >= -craterR; dy--) {
            for (let dx = -craterR; dx <= craterR; dx++) {
              for (let dz = -craterR; dz <= craterR; dz++) {
                if (dx * dx + dz * dz + dy * dy * 1.6 > craterR * craterR) continue;
                ctx.setBlock(cx + dx, cy + dy, cz + dz, 'air', { mode: 'destructive' });
                yield 1;
              }
            }
          }
        });
      }
      // shockwave + burning ring
      for (let i = 0; i < 8; i++) {
        const a = ctx.rng() * TAU, r = craterR + ctx.rng() * 4;
        fires.push({ x: target.x + Math.cos(a) * r, y: target.y + 0.4, z: target.z + Math.sin(a) * r, until: ctx.age() + 240 });
        if (ctx.settings.blockDestruction) ctx.setBlock(Math.floor(target.x + Math.cos(a) * r), Math.floor(target.y), Math.floor(target.z + Math.sin(a) * r), 'fire', { mode: 'destructive', onlyAir: true });
      }
      // direct blast on entities near the point of impact
      const near = ent.victims(ctx.dim, target, blastR + 4, { players: true, mobs: true, items: true, max: 40 });
      shield(near);
      for (let i = 0; i < near.length; i++) {
        try {
          const l = near[i].location;
          const d = Math.max(0.5, hd(target.x, target.z, l.x, l.z));
          const f = Math.max(0, 1 - d / (blastR + 4));
          if (!real) ent.damage(near[i], (14 * f + 2) * ctx.mul, { cause: EntityDamageCause.entityExplosion });
          if (f > 0.3) ent.setFire(near[i], 6);
          ent.push(near[i], ((l.x - target.x) / d) * (0.6 + 1.8 * f), 0.5 + 1.1 * f, ((l.z - target.z) / d) * (0.6 + 1.8 * f));
        } catch (err) { /* gone */ }
      }
      ctx.setBlock(Math.floor(target.x), Math.floor(target.y) - 1, Math.floor(target.z), 'magma', { mode: 'temporary' });
    }

    return {
      update() {
        const t = ctx.age();
        const dt = ctx.dt;
        if (!impacted) {
          const adv = fallSpeed * dt;
          pos.x += step.x * adv; pos.y += step.y * adv; pos.z += step.z * adv;
          if (rock) {
            try { rock.teleport(pos); } catch (err) { /* moved on */ }
          }
          spawnParticle(ctx.dim, 'nd:flame', pos, { size: 5 });
          spawnParticle(ctx.dim, 'nd:smoke_puff', { x: pos.x - step.x * 3, y: pos.y - step.y * 3, z: pos.z - step.z * 3 }, { size: 4, life: 2.5 });
          spawnParticle(ctx.dim, 'nd:spark', pos, { size: 1, vel: { x: -step.x * 0.5, y: -step.y * 0.5, z: -step.z * 0.5 } });
          if (t - lastWhistle >= 24) {
            lastWhistle = t;
            const k = 1 - Math.max(0, (pos.y - target.y)) / 95;
            playSound(ctx.dim, 'nd.meteor_whistle', pos, { volume: 8 + k * 8, pitch: 0.7 + k * 0.9 });
          }
          if (t % 30 === 0) actionBar(ctx.source || /** @type {any} */ (undefined), '§cMeteor impact in ' + Math.max(0, Math.round((pos.y - target.y) / (fallSpeed * 20))) + 's');
          if (pos.y <= target.y + 1) impact();
        } else {
          // expanding shockwave ring
          wave += 1.6 * dt;
          if (wave < waveR) {
            const n = Math.max(6, Math.floor(ctx.q.particlesPerTick / 5));
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + ctx.rng() * 0.2;
              spawnParticle(ctx.dim, 'nd:dust_puff', { x: target.x + Math.cos(a) * wave, y: target.y + 0.6, z: target.z + Math.sin(a) * wave }, { size: 2.2, vel: { x: Math.cos(a) * 0.3, y: 0.25, z: Math.sin(a) * 0.3 } });
            }
            const ring = ent.victims(ctx.dim, target, wave + 3, { key: 'i' + ctx.id, players: true, mobs: true, items: true });
            shield(ring);
            for (let i = 0; i < ring.length; i++) {
              try {
                const l = ring[i].location;
                const d = hd(target.x, target.z, l.x, l.z);
                if (Math.abs(d - wave) > 3 || d < 1) continue;
                const f = 1 - d / waveR;
                ent.push(ring[i], ((l.x - target.x) / d) * (0.4 + 1.2 * f), 0.35 + 0.8 * f, ((l.z - target.z) / d) * (0.4 + 1.2 * f));
                ent.damage(ring[i], 2.5 * f * ctx.mul, { cause: EntityDamageCause.entityExplosion });
              } catch (err) { /* gone */ }
            }
          }
          for (let i = fires.length - 1; i >= 0; i--) {
            if (fires[i].until < t) { fires.splice(i, 1); continue; }
            spawnParticle(ctx.dim, 'nd:flame', fires[i], { size: 1.8 });
            if (ctx.rng() < 0.5) spawnParticle(ctx.dim, 'nd:smoke_puff', { x: fires[i].x, y: fires[i].y + 1, z: fires[i].z }, { size: 3, life: 2, vel: { x: 0.02, y: 0.3, z: 0 } });
          }
          spawnParticle(ctx.dim, 'nd:smoke_puff', { x: target.x + (ctx.rng() - 0.5) * 3, y: target.y + 2 + ctx.rng() * 10, z: target.z + (ctx.rng() - 0.5) * 3 }, { size: 5, life: 3, vel: { x: 0, y: 0.3, z: 0 } });
          if ((t - impactTick) % 60 === 0) playSound(ctx.dim, 'nd.fire_crackle', target, { volume: 3 });
        }
        return t < ctx.durationTicks;
      },
      dispose() { fires.length = 0; if (rock) ent.removeEntity(rock); },
    };
  },
};
