// Sinkhole: the ground cracks, then a bowl collapses progressively from the centre outward and top down, pulling everything in.
import { spawnParticle, playSound, shake, actionBar, playersIn } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { TAU, groundAt, shield, makeGate, hd } from './common.js';

export default {
  id: 'sinkhole',
  defaultDurationSec: 60,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const RF = 6 + 2 * ctx.strength;
    const D = Math.round(8 + 2.4 * ctx.strength);
    const START = 60;
    const gy0 = groundAt(ctx, ctx.origin.x, ctx.origin.z, ctx.origin.y);
    const cx = Math.floor(ctx.origin.x), cz = Math.floor(ctx.origin.z);
    const baseY = gy0 === undefined ? Math.floor(ctx.origin.y) : Math.floor(gy0) - 1;
    const pullGate = makeGate(8);
    /** @type {Array<{x: number, y: number, z: number, w: number}>} */
    let entries = [];
    /** @type {Array<{x: number, y: number, z: number, w: number}>} */
    const recent = [];
    let ready = false;
    let idx = 0;
    let lastGrind = -999, lastThump = -999, lastWarn = -999;

    ctx.say('§6The ground begins to crack... run!');
    playSound(ctx.dim, 'nd.rumble_low', ctx.origin, { volume: 6 });

    // precompute the bowl (time-sliced): every block gets a collapse time - centre first, surface first
    ctx.job(function* () {
      const list = [];
      for (let dx = -RF; dx <= RF; dx++) {
        for (let dz = -RF; dz <= RF; dz++) {
          const r = Math.sqrt(dx * dx + dz * dz);
          if (r > RF) continue;
          const depth = Math.round(D * (1 - (r / RF) * (r / RF)));
          if (depth < 1) continue;
          const s = blk.surface(ctx.dim, cx + dx, cz + dz, baseY + 6, 16);
          yield 3;
          if (!s || s.liquid) continue;
          for (let k = 0; k < depth; k++) list.push({ x: cx + dx, y: s.y - k, z: cz + dz, w: 0.6 * (r / RF) + 0.3 * (k / depth) + 0.1 * ctx.rng() });
        }
      }
      list.sort((a, b) => a.w - b.w);
      entries = list;
      ready = true;
    });

    return {
      update() {
        const t = ctx.age();
        const endCollapse = ctx.durationTicks * 0.7;
        const w = ready ? Math.max(0, Math.min(1.05, (t - START) / Math.max(1, endCollapse - START))) : 0;

        // warning phase: cracks and dust on the rim
        if (t < START + 20) {
          for (let k = 0; k < 3; k++) {
            const a = ctx.rng() * TAU, r = RF * (0.5 + 0.5 * ctx.rng());
            spawnParticle(ctx.dim, 'nd:crack_dust', { x: ctx.origin.x + Math.cos(a) * r, y: baseY + 1.4, z: ctx.origin.z + Math.sin(a) * r }, { size: 1.6 });
          }
        }

        // collapse: remove blocks whose time has come (temporary when destruction is OFF)
        let removed = 0;
        while (ready && idx < entries.length && entries[idx].w <= w) {
          const en = entries[idx];
          const r = ctx.setBlock(en.x, en.y, en.z, 'air', { mode: 'destructive' });
          if (r === 'budget') break;
          idx++;
          if (r === 'ok') {
            removed++;
            recent.push(en);
            if (recent.length > 40) recent.shift();
          }
        }
        if (removed > 0) {
          const n = Math.min(6, recent.length);
          for (let i = 0; i < n; i++) {
            const en = recent[Math.floor(ctx.rng() * recent.length)];
            spawnParticle(ctx.dim, 'nd:dust_puff', { x: en.x + 0.5, y: en.y + 1, z: en.z + 0.5 }, { size: 2, vel: { x: 0, y: 0.3, z: 0 } });
            if (i % 2 === 0) spawnParticle(ctx.dim, 'nd:crack_dust', { x: en.x + 0.5, y: en.y + 1.2, z: en.z + 0.5 }, { size: 1.6 });
          }
          if (t - lastGrind >= 30) { lastGrind = t; playSound(ctx.dim, 'nd.stone_grind', ctx.origin, { volume: 5 }); }
          if (removed > 40 && t - lastThump >= 25) { lastThump = t; playSound(ctx.dim, 'nd.sinkhole_collapse', ctx.origin, { volume: 8 }); }
        }
        if (t > 20) shake(ctx.dim, ctx.origin, 55, (0.4 + 0.9 * Math.min(1, w)) * ctx.mul, 1);

        // pull everything near the hole inward and down
        if (ready && t > START) {
          const rNow = RF * Math.min(1, 0.2 + 1.1 * w);
          const list = ent.victims(ctx.dim, ctx.origin, RF + 8, { key: 'i' + ctx.id, items: true });
          shield(list);
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            let l;
            try { l = e.location; } catch (err) { continue; }
            const d = hd(l.x, l.z, ctx.origin.x, ctx.origin.z);
            if (d > rNow + 5 || !pullGate(e.id, t)) continue;
            const ox = d > 0.3 ? (l.x - ctx.origin.x) / d : 0, oz = d > 0.3 ? (l.z - ctx.origin.z) / d : 0;
            const f = 1 - d / (rNow + 5);
            const k = (0.06 + 0.2 * f) * (0.7 + 0.15 * ctx.strength);
            ent.push(e, -ox * k, -0.04, -oz * k);
          }
        }

        if (t - lastWarn >= 40) {
          lastWarn = t;
          const pl = playersIn(ctx.dim);
          for (let i = 0; i < pl.length; i++) {
            const d = hd(pl[i].loc.x, pl[i].loc.z, ctx.origin.x, ctx.origin.z);
            if (d < RF + 30) actionBar(pl[i].player, t < START ? '§6The ground is cracking - get away!' : '§6Sinkhole collapsing - ' + Math.round(d) + ' blocks from the centre');
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { entries = []; recent.length = 0; },
    };
  },
};
