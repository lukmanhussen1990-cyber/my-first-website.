// Tsunami: a wall of water that races across the land, shoves entities, floods low ground (temporary water) and recedes.
import { spawnParticle, playSound, shake, actionBar, playersIn } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, groundAt, shield, makeGate, isWeakBlock } from './common.js';

const MAX_FLOOD_BLOCKS = 6000;

export default {
  id: 'tsunami',
  defaultDurationSec: 60,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const scale = 0.75 + 0.15 * ctx.strength;
    const W = Math.round(46 * scale);
    const wallH = 6 + ctx.strength * 1.6;
    const speed = 0.5 * (0.85 + 0.08 * ctx.strength);
    const travel = 90 + 30 * ctx.strength;
    const depthBehind = 9;
    const floodY = Math.floor(ctx.origin.y) + 1 + Math.floor(ctx.strength / 2) + 1;
    const hitGate = makeGate(15);
    const danger = 3 * ctx.mul;

    let dx = 0, dz = 0;
    try {
      if (ctx.source) { const l = ctx.source.location; dx = l.x - ctx.origin.x; dz = l.z - ctx.origin.z; }
    } catch (e) { dx = 0; dz = 0; }
    let len = Math.sqrt(dx * dx + dz * dz);
    if (len < 4) { const a = ctx.rng() * TAU; dx = Math.cos(a); dz = Math.sin(a); len = 1; }
    const dir = { x: dx / len, z: dz / len };
    const perp = { x: -dir.z, z: dir.x };

    let front = 0;
    let crestY = ctx.origin.y;
    let floodedTo = -2;
    let flooded = 0;
    let lastRush = -999, lastWarn = -999;
    /** @type {Array<{x: number, z: number}>} */
    const queue = [];

    ctx.say('§bTsunami warning! Get to high ground.');
    playSound(ctx.dim, 'nd.wave_crash', ctx.origin, { volume: 6 });

    ctx.job(function* () {
      for (;;) {
        const col = queue.shift();
        if (!col) { yield 1; continue; }
        const s = blk.surface(ctx.dim, col.x, col.z, floodY + 6, 24);
        yield 3;
        if (!s || s.liquid) continue;
        const top = s.y + 1;
        if (top > floodY) continue;
        const maxY = Math.min(floodY, top + 2);
        for (let y = top; y <= maxY; y++) {
          const r = ctx.setBlock(col.x, y, col.z, 'water', { mode: 'temporary' });
          if (r === 'budget') { queue.unshift(col); yield 6; break; }
          if (r !== 'ok') break;
          flooded++;
          yield 1;
        }
      }
    });

    return {
      update() {
        const dt = ctx.dt;
        const t = ctx.age();
        const moving = front < travel;
        if (moving) front += speed * dt;
        const cx = ctx.origin.x + dir.x * front, cz = ctx.origin.z + dir.z * front;
        const gy = groundAt(ctx, cx, cz, crestY);
        if (gy !== undefined) crestY += (gy - crestY) * 0.5;

        // queue flood stripes behind the crest
        if (moving && flooded < MAX_FLOOD_BLOCKS) {
          while (floodedTo + 2 <= front - 2 && queue.length < 400) {
            floodedTo += 2;
            const fx = ctx.origin.x + dir.x * floodedTo, fz = ctx.origin.z + dir.z * floodedTo;
            for (let o = -W / 2; o <= W / 2; o += 2) queue.push({ x: Math.floor(fx + perp.x * o), z: Math.floor(fz + perp.z * o) });
          }
        }

        // the wall itself
        if (moving) {
          const n = Math.max(4, Math.min(14, Math.floor(ctx.q.particlesPerTick / 5)));
          for (let i = 0; i < n; i++) {
            const o = ((i + ctx.rng()) / n - 0.5) * W;
            const px = cx + perp.x * o, pz = cz + perp.z * o;
            const vel = { x: dir.x * 0.5, y: 0.25, z: dir.z * 0.5 };
            spawnParticle(ctx.dim, 'nd:water_spray', { x: px, y: crestY + wallH * (0.15 + 0.3 * ctx.rng()), z: pz }, { size: wallH * 0.3, vel });
            spawnParticle(ctx.dim, 'nd:water_spray', { x: px, y: crestY + wallH * (0.55 + 0.4 * ctx.rng()), z: pz }, { size: wallH * 0.28, vel });
            if (i % 2 === 0) spawnParticle(ctx.dim, 'nd:foam', { x: px - dir.x * 1.5, y: crestY + wallH * 0.95, z: pz - dir.z * 1.5 }, { size: 2.2, vel });
          }
        }

        // push entities in the wave
        const R = W * 0.6 + 12;
        const list = ent.victims(ctx.dim, { x: cx, y: crestY, z: cz }, R, { key: 'i' + ctx.id, items: true });
        shield(list);
        for (let i = 0; i < list.length; i++) {
          const e = list[i];
          let l;
          try { l = e.location; } catch (err) { continue; }
          const rx = l.x - cx, rz = l.z - cz;
          const along = rx * dir.x + rz * dir.z;
          const side = rx * perp.x + rz * perp.z;
          if (Math.abs(side) > W / 2 || along > 3 || along < -depthBehind) continue;
          if (l.y > crestY + wallH + 3 || l.y < crestY - 8) continue;
          const front3 = along > -3;
          const p = (moving ? 0.5 : 0.18) * (front3 ? 1 : 0.55) * (0.8 + 0.1 * ctx.strength);
          ent.push(e, dir.x * p, front3 ? 0.3 : 0.12, dir.z * p);
          ent.softEffect(e, 'slowness', 30, 1);
          if (front3 && moving && hitGate(e.id, t)) {
            ent.damage(e, danger, { cause: EntityDamageCause.contact });
            playSound(ctx.dim, 'nd.wave_crash', l, { volume: 1.5 });
          }
        }

        // ON: the wave smashes weak blocks (wood, glass, plants)
        if (ctx.settings.blockDestruction && moving) {
          const tries = 4 + 2 * ctx.strength;
          for (let i = 0; i < tries; i++) {
            const o = (ctx.rng() - 0.5) * W;
            const x = Math.floor(cx + perp.x * o + dir.x * ctx.rng() * 2), z = Math.floor(cz + perp.z * o + dir.z * ctx.rng() * 2);
            const y = Math.floor(crestY) + Math.floor(ctx.rng() * 4);
            if (isWeakBlock(ctx.dim, x, y, z)) ctx.setBlock(x, y, z, 'air', { mode: 'destructive' });
          }
        }

        if (moving && t - lastRush >= 30) {
          lastRush = t;
          playSound(ctx.dim, 'nd.wave_rush', { x: cx, y: crestY + 2, z: cz }, { volume: 5 });
        }
        if (moving) shake(ctx.dim, { x: cx, y: crestY, z: cz }, 50, 0.6 * ctx.mul, 1);
        if (t - lastWarn >= 40) {
          lastWarn = t;
          const pl = playersIn(ctx.dim);
          for (let i = 0; i < pl.length; i++) {
            const along = (pl[i].loc.x - cx) * dir.x + (pl[i].loc.z - cz) * dir.z;
            if (moving && along > 0 && along < 140) actionBar(pl[i].player, '§bTsunami arriving in ' + Math.round(along / (speed * 20)) + 's');
            else if (!moving) actionBar(pl[i].player, '§bThe water is receding soon...');
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { queue.length = 0; },
    };
  },
};
