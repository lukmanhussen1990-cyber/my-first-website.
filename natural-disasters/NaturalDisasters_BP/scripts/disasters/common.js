// Helpers shared by the disaster modules.
import * as blk from '../lib/blocks.js';
import * as ent from '../lib/entities.js';
import * as fx from '../lib/fx.js';
import { EntityDamageCause } from '@minecraft/server';

export const TAU = Math.PI * 2;

/** y of the first free block above the ground at (x,z), or undefined when the chunk is not loaded. @param {import('../lib/manager.js').Ctx} ctx */
export function groundAt(ctx, x, z, hint) {
  const s = blk.surface(ctx.dim, x, z, (hint === undefined ? ctx.origin.y : hint) + 24, 64);
  return s ? s.y + 1 : undefined;
}

/** Grant fall protection to entities that must not be hurt (damage switches OFF). @param {import('@minecraft/server').Entity[]} list */
export function shield(list) {
  for (let i = 0; i < list.length; i++) if (!ent.mayDamage(list[i])) ent.protect(list[i], 100);
}

/** Random number in [a,b). @param {import('../lib/manager.js').Ctx} ctx */
export function rr(ctx, a, b) { return a + ctx.rng() * (b - a); }

/** Per-key cooldown gate. @param {number} gap ticks */
export function makeGate(gap) {
  /** @type {Map<string, number>} */
  const last = new Map();
  return function ready(key, now) {
    const t = last.get(key);
    if (t !== undefined && now - t < gap) return false;
    last.set(key, now);
    if (last.size > 300) for (const [k, v] of last) if (now - v > gap * 4) last.delete(k);
    return true;
  };
}

/** Random unit vector on the XZ plane. @param {import('../lib/manager.js').Ctx} ctx */
export function randDirXZ(ctx) {
  const a = ctx.rng() * TAU;
  return { x: Math.cos(a), z: Math.sin(a) };
}

const WEAK = /leaves|glass|plank|door|fence|wool|log|torch|sapling|flower|grass|crop|bed$|sign|carpet|pane|wheat|carrot|potato|beetroot|vine|lantern|ladder|trapdoor|scaffold|bamboo|cactus|reeds|melon|pumpkin|hay|sand|gravel|dirt|mud|snow|tulip|orchid|dandelion|poppy|fern|roots|azalea|slab|stairs/;

/** True when the block at x,y,z is a weak (wood/glass/plant/loose) block a storm may destroy. @param {import('@minecraft/server').Dimension} dim */
export function isWeakBlock(dim, x, y, z) {
  const b = blk.getBlock(dim, x, y, z);
  if (!b) return false;
  const i = blk.inspect(b);
  return i.kind === 'solid' && i.id !== '' && WEAK.test(i.id);
}

/** Horizontal distance. */
export function hd(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

/**
 * Cached "is this spot open to the sky" test (one upward raycast per key per `gap` ticks).
 * @param {import('@minecraft/server').Dimension} dim @param {number} gap ticks
 */
export function makeSkyCheck(dim, gap) {
  /** @type {Map<string, {t: number, open: boolean}>} */
  const cache = new Map();
  /** @param {string} key @param {import('@minecraft/server').Vector3} loc @param {number} now */
  return function exposed(key, loc, now) {
    const c = cache.get(key);
    if (c && now - c.t < gap) return c.open;
    let open = true;
    try {
      const hit = dim.getBlockFromRay({ x: loc.x, y: loc.y + 1.9, z: loc.z }, { x: 0, y: 1, z: 0 }, { includeLiquidBlocks: false, includePassableBlocks: false, maxDistance: 24 });
      open = !hit;
    } catch (e) { open = true; }
    cache.set(key, { t: now, open });
    if (cache.size > 250) for (const [k, v] of cache) if (now - v.t > gap * 4) cache.delete(k);
    return open;
  };
}

/**
 * A lightning strike: bolt particle + flash + thunder + local damage. A real lightning bolt entity is only
 * summoned when block destruction and both damage switches are ON. Returns the strike point (undefined when unloaded).
 * @param {import('../lib/manager.js').Ctx} ctx @param {number} x @param {number} z @param {number} topY y of the cloud base
 */
export function lightningStrike(ctx, x, z, topY) {
  const gy = groundAt(ctx, x, z, ctx.origin.y);
  if (gy === undefined) return undefined;
  const pt = { x, y: gy, z };
  const h = Math.max(12, topY - gy);
  fx.spawnParticle(ctx.dim, 'nd:lightning_bolt', { x, y: gy + h / 2, z }, { size: h });
  fx.spawnParticle(ctx.dim, 'nd:flash', { x, y: gy + 1.5, z }, { size: 8 });
  for (let i = 0; i < 4; i++) {
    fx.spawnParticle(ctx.dim, 'nd:spark', { x, y: gy + 0.5, z }, { size: 1, vel: { x: (ctx.rng() - 0.5) * 0.7, y: 0.3 + ctx.rng() * 0.5, z: (ctx.rng() - 0.5) * 0.7 } });
  }
  fx.playSound(ctx.dim, 'nd.thunder_crack', pt, { volume: 14 });
  fx.shake(ctx.dim, pt, 40, 0.6 * ctx.mul, 0.6);
  const s = ctx.settings;
  if (s.blockDestruction && s.mobDamage && s.playerDamage) {
    try { ctx.dim.spawnEntity('minecraft:lightning_bolt', pt); return pt; } catch (e) { /* cosmetic fallback below */ }
  }
  const near = ent.victims(ctx.dim, pt, 3, { players: true, mobs: true, max: 8 });
  for (let i = 0; i < near.length; i++) {
    ent.damage(near[i], 5 * ctx.mul, { cause: EntityDamageCause.lightning });
    ent.setFire(near[i], 3);
  }
  return pt;
}
