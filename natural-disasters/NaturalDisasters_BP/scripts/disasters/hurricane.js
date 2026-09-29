// Hurricane: a huge cyclone - calm eye, violent eyewall, spiral rain bands, lashing wind, flying debris and lightning.
import { spawnParticle, playSound, playSoundTo, actionBar, playersIn, setWeather, setFog, clearFog, nearestPlayerDist } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import { ENTITY_IDS } from '../config.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, makeGate, hd, randDirXZ, makeSkyCheck, lightningStrike, isWeakBlock } from './common.js';

export default {
  id: 'hurricane',
  defaultDurationSec: 150,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.85 + 0.15 * ctx.strength;
    const eyeR = 12 * scale;
    const wallW = 22 * scale;
    const R = 78 * scale;
    const H = 46 * scale;
    const d0 = randDirXZ(ctx);
    let heading = Math.atan2(d0.z, d0.x);
    const speed = 0.06 * (0.8 + 0.1 * ctx.strength);
    const pos = { x: ctx.origin.x, y: ctx.origin.y, z: ctx.origin.z };
    const sky = makeSkyCheck(ctx.dim, 20);
    const pushGate = makeGate(6);
    const hitGate = makeGate(24);
    const howlGate = makeGate(70);
    /** @type {import('@minecraft/server').Entity[]} */
    let debris = [];
    /** @type {Array<{at: number, x: number, z: number}>} */
    let rolls = [];
    let spin = 0;
    let nextStrike = 80;
    let lastWarn = -999;

    /** counter-clockwise wind at a point: unit-ish vector scaled by strength 0..1 @param {number} x @param {number} z */
    function windAt(x, z) {
      const dx = x - pos.x, dz = z - pos.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 0.01;
      const ox = dx / d, oz = dz / d;
      let s;
      if (d < eyeR) s = 0.05;
      else if (d < eyeR + wallW) s = 1;
      else s = Math.max(0.1, 1 - (d - eyeR - wallW) / Math.max(1, R - eyeR - wallW)) * 0.6;
      return { x: -oz * s - ox * 0.3 * s, z: ox * s - oz * 0.3 * s, s, d, ox, oz };
    }

    setWeather(ctx.dim, 'thunder', ctx.durationTicks + 400);
    ctx.say('§bHurricane warning! Find sturdy shelter.');

    return {
      update() {
        const t = ctx.age();
        const dt = ctx.dt;
        spin += 0.03 * dt;
        heading += (ctx.rng() - 0.5) * 0.04 * dt;
        pos.x += Math.cos(heading) * speed * dt;
        pos.z += Math.sin(heading) * speed * dt;
        const gy = groundAt(ctx, pos.x, pos.z, pos.y);
        if (gy !== undefined) pos.y += (gy - pos.y) * 0.3;

        // eyewall cloud, cloud tops, spiral bands
        const nWall = Math.max(5, Math.min(12, Math.floor(ctx.q.particlesPerTick / 9)));
        for (let k = 0; k < nWall; k++) {
          const r = eyeR + ctx.rng() * wallW;
          const h = ctx.rng() * H;
          const a = ctx.rng() * TAU;
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * r, y: pos.y + h, z: pos.z + Math.sin(a) * r }, { size: 5 + h * 0.1, life: 2, vel: { x: -Math.sin(a) * 0.6, y: 0.05, z: Math.cos(a) * 0.6 } });
        }
        for (let k = 0; k < 2; k++) {
          const a = ctx.rng() * TAU, r = eyeR + ctx.rng() * wallW;
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * r, y: pos.y + H + ctx.rng() * 8, z: pos.z + Math.sin(a) * r }, { size: 10, life: 3, vel: { x: -Math.sin(a) * 0.4, y: 0, z: Math.cos(a) * 0.4 } });
        }
        for (let arm = 0; arm < 3; arm++) {
          const r = eyeR + wallW + ctx.rng() * (R - eyeR - wallW) * 0.8;
          const a = spin * 0.7 + (arm * TAU) / 3 + (r - eyeR) * 0.05;
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * r, y: pos.y + H * 0.7 + ctx.rng() * 6, z: pos.z + Math.sin(a) * r }, { size: 10, life: 3, vel: { x: -Math.sin(a) * 0.3, y: 0, z: Math.cos(a) * 0.3 } });
        }

        // per-player: fog, rain, wind streaks, overhead cloud, ambient howl
        const pl = playersIn(ctx.dim);
        const inside = [];
        for (let i = 0; i < pl.length; i++) {
          const p = pl[i];
          const w = windAt(p.loc.x, p.loc.z);
          setFog(p.player, 'hurricane', w.d < R * 0.9);
          if (w.d > R + 25) continue;
          inside.push({ p, w });
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: p.loc.x + (ctx.rng() - 0.5) * 50, y: p.loc.y + 36 + ctx.rng() * 12, z: p.loc.z + (ctx.rng() - 0.5) * 50 }, { size: 9, life: 3, vel: { x: w.x * 0.6, y: 0, z: w.z * 0.6 } });
          if (w.d >= eyeR && sky(p.player.id, p.loc, t)) {
            for (let k = 0; k < 4; k++) {
              spawnParticle(ctx.dim, 'nd:rain_streak', { x: p.loc.x + (ctx.rng() - 0.5) * 22, y: p.loc.y + 6 + ctx.rng() * 6, z: p.loc.z + (ctx.rng() - 0.5) * 22 }, { size: 1, vel: { x: w.x * 0.9, y: -1.0, z: w.z * 0.9 } });
            }
            for (let k = 0; k < 2; k++) {
              spawnParticle(ctx.dim, 'nd:wind_streak', { x: p.loc.x + (ctx.rng() - 0.5) * 18, y: p.loc.y + 1 + ctx.rng() * 5, z: p.loc.z + (ctx.rng() - 0.5) * 18 }, { size: 1.6, vel: { x: w.x * 1.6, y: 0, z: w.z * 1.6 } });
            }
          }
          if (w.d < R && howlGate(p.player.id, t)) playSoundTo(p.player, 'nd.wind_howl', { volume: 1.2 + 2.5 * w.s, pitch: 0.75 + 0.3 * w.s });
        }

        // wind on entities (sheltered ones are spared; the eye is calm)
        const list = ent.victims(ctx.dim, pos, R, { key: 'i' + ctx.id, items: true });
        shield(list);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          let l;
          try { l = e.location; } catch (err) { continue; }
          const w = windAt(l.x, l.z);
          if (w.d > R || w.d < eyeR) continue;
          if (!pushGate(e.id, t) || !sky(e.id, l, t)) continue;
          const wall = w.d < eyeR + wallW;
          const k = 0.28 * w.s * (0.7 + 0.15 * ctx.strength) * (ent.isPlayer(e) ? 1 : 0.7);
          ent.push(e, w.x * k, wall ? 0.03 * ctx.strength : 0, w.z * k);
          if (wall && hitGate(e.id, t)) ent.damage(e, 1.8 * ctx.mul, { cause: EntityDamageCause.contact });
        }

        // debris orbiting the eyewall
        debris = debris.filter((e) => { try { return e.isValid(); } catch (err) { return false; } });
        if (debris.length < ctx.q.maxDebris && ctx.rng() < 0.6) {
          const a = ctx.rng() * TAU, r = eyeR + ctx.rng() * wallW;
          const e = ctx.spawn(ENTITY_IDS.debris, { x: pos.x + Math.cos(a) * r, y: pos.y + 0.8, z: pos.z + Math.sin(a) * r }, 240, ctx.q.maxDebris);
          if (e) debris.push(e);
        }
        for (let i = 0; i < debris.length; i++) {
          const e = debris[i];
          try {
            const l = e.location;
            const w = windAt(l.x, l.z);
            const rc = (eyeR + wallW * 0.5 - w.d) * 0.006;
            e.applyImpulse({ x: w.x * 0.2 + w.ox * rc, y: l.y - pos.y < H * 0.6 ? 0.28 : -0.04, z: w.z * 0.2 + w.oz * rc });
            if (hitGate('d' + e.id, t) && ctx.rng() < 0.4) {
              const near = ent.victims(ctx.dim, l, 2, { players: true, mobs: true, max: 6 });
              for (let j = 0; j < near.length; j++) ent.damage(near[j], 1.5 * ctx.mul, { cause: EntityDamageCause.fallingBlock });
            }
          } catch (err) { /* gone */ }
        }

        // lightning in the eyewall
        if (t >= nextStrike) {
          nextStrike = t + 40 + ctx.rng() * 140;
          if (nearestPlayerDist(ctx.dim, pos) < 110) {
            const a = ctx.rng() * TAU, r = eyeR + ctx.rng() * wallW * 1.5;
            const pt = lightningStrike(ctx, pos.x + Math.cos(a) * r, pos.z + Math.sin(a) * r, pos.y + H);
            if (pt) rolls.push({ at: t + 6 + Math.floor(ctx.rng() * 25), x: pt.x, z: pt.z });
          }
        }
        rolls = rolls.filter((r) => {
          if (r.at > t) return true;
          playSound(ctx.dim, 'nd.thunder_roll', { x: r.x, y: pos.y, z: r.z }, { volume: 10, pitch: 0.75 + ctx.rng() * 0.3 });
          return false;
        });

        // ON: violent wind rips weak blocks (wood, glass, plants, loose blocks) in the eyewall
        if (ctx.settings.blockDestruction) {
          const tries = 3 + 2 * ctx.strength;
          for (let i = 0; i < tries; i++) {
            const a = ctx.rng() * TAU, r = eyeR + ctx.rng() * wallW * 1.3;
            const x = Math.floor(pos.x + Math.cos(a) * r), z = Math.floor(pos.z + Math.sin(a) * r);
            const g = groundAt(ctx, x, z, pos.y);
            if (g === undefined) continue;
            const y = Math.floor(g) - 1 + Math.floor(ctx.rng() * 5);
            if (isWeakBlock(ctx.dim, x, y, z)) ctx.setBlock(x, y, z, 'air', { mode: 'destructive' });
          }
        }

        if (t - lastWarn >= 60) {
          lastWarn = t;
          for (let i = 0; i < inside.length; i++) {
            const { p, w } = inside[i];
            if (w.d < eyeR) actionBar(p.player, '§aYou are in the eye of the hurricane - the calm before the other wall arrives');
            else if (w.d < R) actionBar(p.player, '§bHurricane winds - stay indoors (' + Math.round(w.d) + ' blocks from the eye)');
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { clearFog('hurricane'); debris = []; rolls = []; },
    };
  },
};
