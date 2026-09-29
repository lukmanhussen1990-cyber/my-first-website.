// Tornado: travelling funnel that lifts, spins and throws entities and items, flings debris, optionally rips blocks.
import { spawnParticle, playSound, shake, actionBar, playersIn } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import { ENTITY_IDS } from '../config.js';
import { EntityDamageCause } from '@minecraft/server';
import { groundAt, TAU, makeGate, hd, rr, randDirXZ, shield } from './common.js';

export default {
  id: 'tornado',
  defaultDurationSec: 75,
  variants: ['auto', 'ef5'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const ef5 = ctx.variant === 'ef5';
    const scale = (ef5 ? 1.55 : 1) * (0.7 + 0.15 * ctx.strength);
    const H = Math.round(24 * scale);
    const R0 = 1.6 * scale, R1 = 6.5 * scale;
    const catchR = 9 * scale;
    const speed = (ef5 ? 0.2 : 0.14) * (0.8 + 0.1 * ctx.strength);
    const dir = randDirXZ(ctx);
    let heading = Math.atan2(dir.z, dir.x);
    const pos = { x: ctx.origin.x, y: ctx.origin.y, z: ctx.origin.z };
    /** @type {Map<string, number>} entity id -> tick captured */
    const captured = new Map();
    const hitGate = makeGate(12);
    /** @type {import('@minecraft/server').Entity[]} */
    let debris = [];
    let spin = 0;
    let lastSound = -999, lastGust = -999;
    const danger = (ef5 ? 5 : 2.5) * ctx.mul;

    playSound(ctx.dim, 'nd.tornado_siren', ctx.origin, { volume: 3 });
    ctx.say('§cTornado warning! Seek shelter.');

    return {
      update() {
        const now = ctx.dim ? ctx.startTick + ctx.age() : 0;
        const dt = ctx.dt;
        spin += 0.55 * dt;
        heading += (ctx.rng() - 0.5) * 0.1 * dt;
        pos.x += Math.cos(heading) * speed * dt;
        pos.z += Math.sin(heading) * speed * dt;
        const gy = groundAt(ctx, pos.x, pos.z, pos.y);
        if (gy === undefined) { heading += Math.PI; pos.x += Math.cos(heading) * speed * dt * 2; pos.z += Math.sin(heading) * speed * dt * 2; }
        else pos.y += (gy - pos.y) * 0.5;
        const top = pos.y + H;

        // funnel + cloud particles
        const layers = Math.max(4, Math.min(11, Math.floor(ctx.q.particlesPerTick / 7)));
        for (let k = 0; k < layers; k++) {
          const f = (k + ctx.rng()) / layers;
          const h = f * H;
          const r = R0 + (R1 - R0) * Math.pow(f, 1.4);
          const a = spin + h * 0.32 + ctx.rng() * 1.5;
          const p = { x: pos.x + Math.cos(a) * r, y: pos.y + h, z: pos.z + Math.sin(a) * r };
          spawnParticle(ctx.dim, 'nd:cloud_puff', p, { size: 1.6 + f * 2.6 * scale * 0.5, life: 1.2 });
          if (k % 2 === 0) spawnParticle(ctx.dim, 'nd:wind_streak', { x: pos.x + Math.cos(a + 1.3) * r * 1.15, y: p.y, z: pos.z + Math.sin(a + 1.3) * r * 1.15 }, { size: 1 + f, vel: { x: -Math.sin(a) * 0.5, y: 0.2, z: Math.cos(a) * 0.5 } });
        }
        for (let k = 0; k < 4; k++) {
          const a = ctx.rng() * TAU, r = R0 + ctx.rng() * catchR * 0.7;
          spawnParticle(ctx.dim, 'nd:dust_puff', { x: pos.x + Math.cos(a) * r, y: pos.y + 0.3, z: pos.z + Math.sin(a) * r }, { size: 1.5 + ctx.rng() * 1.5, vel: { x: -Math.sin(a) * 0.4, y: 0.35, z: Math.cos(a) * 0.4 } });
          spawnParticle(ctx.dim, 'nd:debris_chip', { x: pos.x + Math.cos(a + spin) * r, y: pos.y + 1 + ctx.rng() * H * 0.6, z: pos.z + Math.sin(a + spin) * r }, { size: 1 });
        }
        for (let k = 0; k < 5; k++) {
          const a = spin * 0.4 + (k / 5) * TAU;
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * R1 * 1.5, y: top + 2 + ctx.rng() * 3, z: pos.z + Math.sin(a) * R1 * 1.5 }, { size: 5 + ctx.rng() * 3, life: 2 });
        }

        // entities: pull in, lift, spin, throw
        const list = ent.victims(ctx.dim, { x: pos.x, y: pos.y + H * 0.4, z: pos.z }, catchR * 1.6 + H * 0.35, { key: 'i' + ctx.id, items: true });
        shield(list);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          let l;
          try { l = e.location; } catch (err) { continue; }
          const d = hd(pos.x, pos.z, l.x, l.z);
          const rel = l.y - pos.y;
          if (rel < -3 || rel > H + 10) continue;
          const rcatch = catchR * (0.55 + 0.6 * Math.max(0, Math.min(1, rel / H)));
          if (d > rcatch * 1.5) continue;
          const nx = d > 0.01 ? (pos.x - l.x) / d : 0, nz = d > 0.01 ? (pos.z - l.z) / d : 0;
          const isP = ent.isPlayer(e);
          const cap = captured.get(e.id);
          if (d <= rcatch && cap === undefined) captured.set(e.id, now);
          const heldFor = cap === undefined ? 0 : now - cap;
          const strong = 0.85 + 0.25 * ctx.strength;
          if (cap !== undefined && (heldFor > 160 || rel > H * 0.85)) {
            // throw outward
            const out = ef5 ? 1.7 : 1.2;
            ent.push(e, (-nx + -nz * 0.6) * out, isP ? 0.9 : 0.6, (-nz + nx * 0.6) * out);
            captured.delete(e.id);
            playSound(ctx.dim, 'nd.debris_crash', l, { volume: 1.2 });
            continue;
          }
          const inward = (isP ? 0.16 : 0.09) * strong * (d / rcatch + 0.35);
          const tang = (isP ? 0.28 : 0.2) * strong;
          const lift = d < rcatch * 0.85 ? (isP ? 0.55 : 0.38) * strong : 0.1;
          ent.push(e, nx * inward - nz * tang, lift, nz * inward + nx * tang);
          if (d < rcatch * 0.7 && hitGate(e.id, now)) {
            ent.damage(e, danger, { cause: EntityDamageCause.contact });
          }
        }
        if (captured.size > 60) for (const k of captured.keys()) { captured.delete(k); break; }

        // flying debris entities orbiting the funnel
        debris = debris.filter((e) => { try { return e.isValid(); } catch (err) { return false; } });
        if (debris.length < ctx.q.maxDebris && ctx.rng() < 0.7) {
          const a = ctx.rng() * TAU, r = R0 + ctx.rng() * catchR * 0.6;
          const e = ctx.spawn(ENTITY_IDS.debris, { x: pos.x + Math.cos(a) * r, y: pos.y + 0.6, z: pos.z + Math.sin(a) * r }, 220, ctx.q.maxDebris);
          if (e) debris.push(e);
        }
        for (let i = 0; i < debris.length; i++) {
          const e = debris[i];
          try {
            const l = e.location;
            const d = hd(pos.x, pos.z, l.x, l.z) || 0.01;
            const nx = (pos.x - l.x) / d, nz = (pos.z - l.z) / d;
            const lift = l.y - pos.y < H * 0.75 ? 0.32 : -0.05;
            e.applyImpulse({ x: nx * 0.07 - nz * 0.32, y: lift, z: nz * 0.07 + nx * 0.32 });
            if (d < 3 && hitGate('d' + e.id, now) && ctx.rng() < 0.4) {
              const near = ent.victims(ctx.dim, l, 2, { key: 'd' + ctx.id, players: true, mobs: true, max: 6 });
              for (let j = 0; j < near.length; j++) ent.damage(near[j], danger * 0.5, { cause: EntityDamageCause.fallingBlock });
            }
          } catch (err) { /* gone */ }
        }

        // rip blocks when destruction is ON
        if (ctx.settings.blockDestruction) {
          const tries = 2 + ctx.strength * (ef5 ? 2 : 1);
          for (let i = 0; i < tries; i++) {
            const a = ctx.rng() * TAU, r = ctx.rng() * catchR * 0.55;
            const x = Math.floor(pos.x + Math.cos(a) * r), z = Math.floor(pos.z + Math.sin(a) * r);
            const y = Math.floor(pos.y) - 1 + Math.floor(ctx.rng() * 5);
            if (ctx.setBlock(x, y, z, 'air', { mode: 'destructive' }) === 'ok') {
              spawnParticle(ctx.dim, 'nd:debris_chip', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, { size: 1.6 });
            }
          }
        }

        // sound + shake + warnings
        const t = ctx.age();
        if (t - lastSound >= 40) { lastSound = t; playSound(ctx.dim, 'nd.tornado_loop', { x: pos.x, y: pos.y + 4, z: pos.z }, { volume: 4 * scale, pitch: ef5 ? 0.85 : 1 }); }
        if (t - lastGust >= 70) { lastGust = t; playSound(ctx.dim, 'nd.wind_gust', { x: pos.x, y: pos.y + 4, z: pos.z }, { volume: 3 }); }
        shake(ctx.dim, pos, catchR * 5, 0.5 * ctx.mul * (ef5 ? 1.6 : 1), 1.2);
        if (t % 40 === 0) {
          const pl = playersIn(ctx.dim);
          for (let i = 0; i < pl.length; i++) {
            const d = hd(pl[i].loc.x, pl[i].loc.z, pos.x, pos.z);
            if (d < 90) actionBar(pl[i].player, '§7Tornado ' + Math.round(d) + ' blocks away');
          }
        }
        return ctx.age() < ctx.durationTicks;
      },
      dispose() { debris = []; captured.clear(); },
    };
  },
};
