// Blizzard: whiteout snow and fog, howling wind, slowing and freezing of anything left out in the open, drifting snow layers.
import { spawnParticle, playSoundTo, actionBar, playersIn, setWeather, setFog, clearFog } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { isTerrainId } from '../lib/blocklists.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, makeGate, hd, randDirXZ, makeSkyCheck } from './common.js';

export default {
  id: 'blizzard',
  defaultDurationSec: 100,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.85 + 0.12 * ctx.strength;
    const R = 60 * scale;
    const windAng = ctx.rng() * TAU;
    const wx = Math.cos(windAng), wz = Math.sin(windAng);
    const d0 = randDirXZ(ctx);
    let heading = Math.atan2(d0.z, d0.x);
    const pos = { x: ctx.origin.x, y: ctx.origin.y, z: ctx.origin.z };
    const sky = makeSkyCheck(ctx.dim, 20);
    const coldGate = makeGate(50);
    const gustGate = makeGate(8);
    const windSnd = makeGate(80);
    const maxLayers = ctx.q.maxTempEntities * 3;
    let placed = 0;
    let nextGust = 60, gustUntil = 0;
    let lastWarn = -999;

    setWeather(ctx.dim, 'rain', ctx.durationTicks + 400);
    ctx.say('§bA blizzard is blowing in - find shelter and stay warm!');

    /** drop a snow layer on dry ground or freeze a water surface near (px,pz) @param {number} px @param {number} py @param {number} pz */
    function layDown(px, py, pz) {
      if (placed >= maxLayers) return;
      const a = ctx.rng() * TAU, r = 2 + ctx.rng() * 12;
      const x = Math.floor(px + Math.cos(a) * r), z = Math.floor(pz + Math.sin(a) * r);
      const s = blk.surface(ctx.dim, x, z, py + 6, 14);
      if (!s) return;
      if (s.liquid) {
        if (s.id === 'water' && ctx.setBlock(x, s.y, z, 'ice', { mode: 'temporary' }) === 'ok') placed++;
      } else if (isTerrainId(s.id)) {
        if (ctx.setBlock(x, s.y + 1, z, 'snow_layer', { mode: 'temporary', onlyAir: true }) === 'ok') placed++;
      }
    }

    return {
      update() {
        const t = ctx.age();
        const dt = ctx.dt;
        heading += (ctx.rng() - 0.5) * 0.05 * dt;
        pos.x += Math.cos(heading) * 0.04 * dt;
        pos.z += Math.sin(heading) * 0.04 * dt;
        const gy = groundAt(ctx, pos.x, pos.z, pos.y);
        if (gy !== undefined) pos.y += (gy - pos.y) * 0.3;

        // per-player: fog, blowing snow, wind streaks, ambient howl, snow drifts
        const pl = playersIn(ctx.dim);
        const inside = [];
        for (let i = 0; i < pl.length; i++) {
          const p = pl[i];
          const d = hd(p.loc.x, p.loc.z, pos.x, pos.z);
          const isIn = d < R;
          setFog(p.player, 'blizzard', isIn);
          if (d > R + 20) continue;
          const open = sky(p.player.id, p.loc, t);
          const nFlake = open ? 6 : 2;
          for (let k = 0; k < nFlake; k++) {
            spawnParticle(ctx.dim, 'nd:snowflake', { x: p.loc.x + (ctx.rng() - 0.5) * 28, y: p.loc.y + 1 + ctx.rng() * 8, z: p.loc.z + (ctx.rng() - 0.5) * 28 }, { size: 1, vel: { x: wx * (0.5 + ctx.rng() * 0.4), y: -0.25 - ctx.rng() * 0.2, z: wz * (0.5 + ctx.rng() * 0.4) } });
          }
          if (open) {
            for (let k = 0; k < 2; k++) {
              spawnParticle(ctx.dim, 'nd:wind_streak', { x: p.loc.x + (ctx.rng() - 0.5) * 20, y: p.loc.y + 1 + ctx.rng() * 4, z: p.loc.z + (ctx.rng() - 0.5) * 20 }, { size: 2, vel: { x: wx * 1.2, y: 0, z: wz * 1.2 } });
            }
          }
          if (isIn) {
            inside.push(p);
            if (windSnd(p.player.id, t)) playSoundTo(p.player, 'nd.blizzard_wind', { volume: open ? 1.4 : 0.5, pitch: 0.9 + ctx.rng() * 0.2 });
            if (open && ctx.rng() < 0.7) layDown(p.loc.x, p.loc.y, p.loc.z);
          }
        }

        // cold and wind on everything that is exposed to the sky
        if (t >= nextGust) {
          gustUntil = t + 30 + ctx.rng() * 30;
          nextGust = gustUntil + 50 + ctx.rng() * 90;
        }
        const gust = t < gustUntil;
        const list = ent.victims(ctx.dim, pos, R, { key: 'i' + ctx.id });
        shield(list);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          let l;
          try { l = e.location; } catch (err) { continue; }
          if (hd(l.x, l.z, pos.x, pos.z) > R) continue;
          if (!sky(e.id, l, t)) continue;
          if (coldGate(e.id, t)) {
            ent.softEffect(e, 'slowness', 70, ctx.strength >= 4 ? 2 : 1);
            ent.harmEffect(e, 'weakness', 70, 0);
            ent.damage(e, (0.6 + 0.4 * ctx.strength) * ctx.mul, { cause: EntityDamageCause.freezing, floor: 2 });
          }
          if (gust && gustGate(e.id, t)) {
            const f = (0.1 + 0.04 * ctx.strength) * (ent.isPlayer(e) ? 1 : 0.6);
            ent.push(e, wx * f, 0.02, wz * f);
          }
        }

        if (t - lastWarn >= 60) {
          lastWarn = t;
          for (let i = 0; i < inside.length; i++) actionBar(inside[i].player, '§bBlizzard - get out of the wind, exposure is freezing you');
        }
        return t < ctx.durationTicks;
      },
      dispose() { clearFog('blizzard'); },
    };
  },
};
