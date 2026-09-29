// Supercell: thunderstorm with a rotating wall cloud, driving rain, gusting wind and lightning that strikes near players.
import { spawnParticle, playSound, playSoundTo, actionBar, playersIn, setWeather, setFog, clearFog } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import { TAU, groundAt, shield, makeGate, hd, randDirXZ, makeSkyCheck, lightningStrike } from './common.js';

export default {
  id: 'supercell',
  defaultDurationSec: 120,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.8 + 0.12 * ctx.strength;
    const R = 62 * scale;
    const cloudH = 50;
    const d0 = randDirXZ(ctx);
    let heading = Math.atan2(d0.z, d0.x);
    const windAng = ctx.rng() * TAU;
    const wx = Math.cos(windAng), wz = Math.sin(windAng);
    const speed = 0.09;
    const pos = { x: ctx.origin.x, y: ctx.origin.y, z: ctx.origin.z };
    const sky = makeSkyCheck(ctx.dim, 20);
    const gustGate = makeGate(8);
    const howlGate = makeGate(80);
    let spin = 0;
    let nextStrike = 50;
    let nextGust = 100, gustUntil = 0;
    let lastWarn = -999;
    /** @type {Array<{at: number, x: number, z: number}>} */
    let rolls = [];

    setWeather(ctx.dim, 'thunder', ctx.durationTicks + 400);
    ctx.say('§7A supercell storm is rolling in!');

    return {
      update() {
        const t = ctx.age();
        const dt = ctx.dt;
        spin += 0.035 * dt;
        heading += (ctx.rng() - 0.5) * 0.05 * dt;
        pos.x += Math.cos(heading) * speed * dt;
        pos.z += Math.sin(heading) * speed * dt;
        const gy = groundAt(ctx, pos.x, pos.z, pos.y);
        if (gy !== undefined) pos.y += (gy - pos.y) * 0.3;
        const cy = pos.y + cloudH;

        // rotating wall cloud and a lowered, spinning cloud lump
        const nRing = Math.max(3, Math.min(8, Math.floor(ctx.q.particlesPerTick / 12)));
        for (let k = 0; k < nRing; k++) {
          const a = spin + (k / nRing) * TAU + ctx.rng() * 0.4;
          const r = R * (0.2 + 0.5 * ctx.rng());
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * r, y: cy + ctx.rng() * 5, z: pos.z + Math.sin(a) * r }, { size: 9 + ctx.rng() * 5, life: 3, vel: { x: -Math.sin(a) * 0.15, y: 0, z: Math.cos(a) * 0.15 } });
        }
        for (let k = 0; k < 2; k++) {
          const a = spin * 1.6 + k * Math.PI + ctx.rng() * 0.5, r = 7 + ctx.rng() * 6;
          spawnParticle(ctx.dim, 'nd:cloud_puff', { x: pos.x + Math.cos(a) * r, y: cy - 10 + ctx.rng() * 3, z: pos.z + Math.sin(a) * r }, { size: 6, life: 2, vel: { x: -Math.sin(a) * 0.3, y: 0, z: Math.cos(a) * 0.3 } });
        }

        // per-player: fog, overhead clouds, rain, wind streaks, ambient wind
        const pl = playersIn(ctx.dim);
        const inside = [];
        for (let i = 0; i < pl.length; i++) {
          const p = pl[i];
          const d = hd(p.loc.x, p.loc.z, pos.x, pos.z);
          setFog(p.player, 'supercell', d < R * 0.9);
          if (d > R + 25) continue;
          if (d < R) inside.push(p);
          for (let k = 0; k < 2; k++) {
            spawnParticle(ctx.dim, 'nd:cloud_puff', { x: p.loc.x + (ctx.rng() - 0.5) * 56, y: p.loc.y + 38 + ctx.rng() * 12, z: p.loc.z + (ctx.rng() - 0.5) * 56 }, { size: 9, life: 3, vel: { x: wx * 0.2, y: 0, z: wz * 0.2 } });
          }
          if (d < R * 1.1 && sky(p.player.id, p.loc, t)) {
            for (let k = 0; k < 4; k++) {
              spawnParticle(ctx.dim, 'nd:rain_streak', { x: p.loc.x + (ctx.rng() - 0.5) * 22, y: p.loc.y + 6 + ctx.rng() * 6, z: p.loc.z + (ctx.rng() - 0.5) * 22 }, { size: 1, vel: { x: wx * 0.4, y: -1.1, z: wz * 0.4 } });
            }
            spawnParticle(ctx.dim, 'nd:wind_streak', { x: p.loc.x + (ctx.rng() - 0.5) * 16, y: p.loc.y + 1 + ctx.rng() * 4, z: p.loc.z + (ctx.rng() - 0.5) * 16 }, { size: 1.5, vel: { x: wx * 0.9, y: 0, z: wz * 0.9 } });
          }
          if (d < R && howlGate(p.player.id, t)) playSoundTo(p.player, 'nd.wind_howl', { volume: 1.2, pitch: 0.9 + ctx.rng() * 0.2 });
        }

        // gusts
        if (t >= nextGust) {
          gustUntil = t + 40 + ctx.rng() * 40;
          nextGust = gustUntil + 60 + ctx.rng() * 100;
          for (let i = 0; i < inside.length; i++) playSoundTo(inside[i].player, 'nd.wind_gust', { volume: 2 });
        }
        if (t < gustUntil) {
          const list = ent.victims(ctx.dim, pos, R * 0.9, { key: 'i' + ctx.id, items: true });
          shield(list);
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            let l;
            try { l = e.location; } catch (err) { continue; }
            if (!gustGate(e.id, t) || !sky(e.id, l, t)) continue;
            const force = (0.1 + 0.05 * ctx.strength) * (ent.isPlayer(e) ? 1 : 0.6);
            ent.push(e, wx * force, 0.03, wz * force);
          }
        }

        // lightning
        if (t >= nextStrike) {
          nextStrike = t + 18 + ctx.rng() * Math.max(30, 120 - 14 * ctx.strength);
          let x, z;
          if (inside.length && ctx.rng() < 0.55) {
            const p = inside[Math.floor(ctx.rng() * inside.length)];
            const a = ctx.rng() * TAU, r = 8 + ctx.rng() * 22;
            x = p.loc.x + Math.cos(a) * r; z = p.loc.z + Math.sin(a) * r;
          } else {
            const a = ctx.rng() * TAU, r = ctx.rng() * R * 0.9;
            x = pos.x + Math.cos(a) * r; z = pos.z + Math.sin(a) * r;
          }
          const pt = lightningStrike(ctx, x, z, cy);
          if (pt) rolls.push({ at: t + 6 + Math.floor(ctx.rng() * 30), x: pt.x, z: pt.z });
        }
        rolls = rolls.filter((r) => {
          if (r.at > t) return true;
          playSound(ctx.dim, 'nd.thunder_roll', { x: r.x, y: pos.y, z: r.z }, { volume: 10, pitch: 0.8 + ctx.rng() * 0.3 });
          return false;
        });

        if (t - lastWarn >= 60) {
          lastWarn = t;
          for (let i = 0; i < inside.length; i++) actionBar(inside[i].player, '§7Supercell storm - stay away from open ground and tall trees');
        }
        return t < ctx.durationTicks;
      },
      dispose() { clearFog('supercell'); rolls = []; },
    };
  },
};
