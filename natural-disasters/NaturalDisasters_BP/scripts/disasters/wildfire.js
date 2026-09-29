// Wildfire: fire spreads cell by cell through fuel (grass, leaves, wood), drifts with the wind, and burns whatever stands in it.
import { spawnParticle, playSound, actionBar, playersIn } from '../lib/fx.js';
import * as ent from '../lib/entities.js';
import * as blk from '../lib/blocks.js';
import { EntityDamageCause } from '@minecraft/server';
import { TAU, shield, makeGate, hd } from './common.js';

const CS = 3;

/** @type {Array<[RegExp, number]>} */
const FUELS = [
  [/leaves|log|wood|plank|fence|door|bookshelf|wool|carpet|hay|bamboo|vine|bush|azalea|scaffold/, 0.9],
  [/grass|fern|flower|tulip|orchid|dandelion|poppy|crop|wheat|carrot|potato|beet|sapling|reeds|double_plant/, 0.75],
  [/podzol|mycelium|moss/, 0.55],
  [/dirt|farmland|rooted|coarse/, 0.2],
];

/** @param {string} id */
function fuelOf(id) {
  for (let i = 0; i < FUELS.length; i++) if (FUELS[i][0].test(id)) return FUELS[i][1];
  return 0.03;
}

/** @typedef {{x: number, y: number, z: number, cx: number, cz: number, state: number, until: number, fuel: number}} Cell state: 0 unlit, 1 burning, 2 burnt */

/** @param {number} cx @param {number} cz */
const cellKey = (cx, cz) => (cx + 40000) * 80001 + (cz + 40000);

export default {
  id: 'wildfire',
  defaultDurationSec: 120,
  variants: ['default'],
  /** @param {import('../lib/manager.js').Ctx} ctx */
  create(ctx) {
    const cap = ctx.q.maxDebris * 6;
    const spreadK = 0.7 + 0.15 * ctx.strength;
    let windAng = ctx.rng() * TAU;
    /** @type {Map<number, Cell>} */
    const cells = new Map();
    /** @type {Cell[]} */
    let fires = [];
    const dmgGate = makeGate(10);
    let lastRoar = -999, lastCrackle = -999, lastWarn = -999;

    /** @param {number} cx @param {number} cz @param {number} refY @param {boolean} [force] @returns {Cell|undefined} */
    function probe(cx, cz, refY, force) {
      const k = cellKey(cx, cz);
      const old = cells.get(k);
      if (old) return old.state === 0 ? old : undefined;
      const x = cx * CS + CS / 2, z = cz * CS + CS / 2;
      const s = blk.surface(ctx.dim, x, z, refY + 8, 30);
      if (!s) return undefined;
      if (cells.size > 3000) for (const [kk, c] of cells) if (c.state === 0) cells.delete(kk);
      let fuel = s.liquid ? 0 : fuelOf(s.id);
      if (!s.liquid) {
        const above = blk.getBlock(ctx.dim, Math.floor(x), s.y + 1, Math.floor(z));
        if (above) {
          const i = blk.inspect(above);
          if (i.kind === 'solid' && i.id) fuel = Math.max(fuel, fuelOf(i.id));
        }
      }
      if (force) fuel = Math.max(fuel, 0.6);
      /** @type {Cell} */
      const cell = { x, y: s.y + 1, z, cx, cz, state: 0, until: 0, fuel };
      cells.set(k, cell);
      return cell;
    }

    /** @param {Cell} cell @param {number} t */
    function ignite(cell, t) {
      cell.state = 1;
      cell.until = t + Math.round(160 + 360 * cell.fuel * (0.6 + ctx.rng() * 0.8));
      fires.push(cell);
      if (ctx.settings.blockDestruction && ctx.rng() < 0.5) {
        ctx.setBlock(Math.floor(cell.x + (ctx.rng() - 0.5) * 2), cell.y, Math.floor(cell.z + (ctx.rng() - 0.5) * 2), 'fire', { mode: 'destructive', onlyAir: true });
      }
    }

    /** @param {number} x @param {number} z */
    function fireNear(x, z) {
      const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
      for (let a = -1; a <= 1; a++) {
        for (let b = -1; b <= 1; b++) {
          const c = cells.get(cellKey(cx + a, cz + b));
          if (c && c.state === 1) {
            const dx = c.x - x, dz = c.z - z;
            if (dx * dx + dz * dz < CS * CS * 0.9) return c;
          }
        }
      }
      return undefined;
    }

    // ignite the target spot and a few cells around it (forced, so a fire always starts where the player aimed)
    const ocx = Math.floor(ctx.origin.x / CS), ocz = Math.floor(ctx.origin.z / CS);
    const c0 = probe(ocx, ocz, ctx.origin.y, true);
    if (c0) {
      ignite(c0, 0);
      for (let i = 0; i < 5; i++) {
        const c = probe(ocx + Math.round((ctx.rng() - 0.5) * 2), ocz + Math.round((ctx.rng() - 0.5) * 2), c0.y, true);
        if (c) ignite(c, 0);
      }
      ctx.say('§6Wildfire! The flames are spreading with the wind.');
    } else {
      ctx.say('§cThe wildfire could not start here (ground not loaded).');
    }

    return {
      update() {
        const t = ctx.age();
        const dt = ctx.dt;
        windAng += (ctx.rng() - 0.5) * 0.01 * dt;
        const wx = Math.cos(windAng), wz = Math.sin(windAng);

        // burn out
        for (let i = 0; i < fires.length; i++) if (t >= fires[i].until) fires[i].state = 2;
        fires = fires.filter((f) => f.state === 1);
        if (fires.length === 0 && t > 40) return false;

        // spread (newest cells are the front, so bias the pick toward them)
        if (t < ctx.durationTicks * 0.75 && fires.length > 0 && fires.length < cap) {
          const attempts = Math.min(fires.length, 2 + Math.ceil(ctx.strength / 2));
          for (let n = 0; n < attempts; n++) {
            const u = ctx.rng();
            const f = fires[Math.max(0, fires.length - 1 - Math.floor(u * u * fires.length))];
            if (ctx.rng() > Math.min(1, 0.1 * dt * (0.5 + f.fuel) * spreadK)) continue;
            const a = windAng + (ctx.rng() + ctx.rng() + ctx.rng() - 1.5) * 2.0;
            const dist = CS * (1 + ctx.rng() * 1.2);
            const ncx = Math.floor((f.x + Math.cos(a) * dist) / CS), ncz = Math.floor((f.z + Math.sin(a) * dist) / CS);
            if (ncx === f.cx && ncz === f.cz) continue;
            const cell = probe(ncx, ncz, f.y);
            if (!cell) continue;
            if (ctx.rng() < cell.fuel * (0.8 + 0.4 * Math.cos(a - windAng))) ignite(cell, t);
          }
        }

        // visuals: flames, smoke, embers on a random sample of burning cells
        const nSample = Math.min(fires.length, Math.max(4, Math.floor(ctx.q.particlesPerTick / 5)));
        for (let i = 0; i < nSample; i++) {
          const f = fires[Math.floor(ctx.rng() * fires.length)];
          const jx = f.x + (ctx.rng() - 0.5) * CS, jz = f.z + (ctx.rng() - 0.5) * CS;
          spawnParticle(ctx.dim, 'nd:flame', { x: jx, y: f.y + 0.2, z: jz }, { size: 1.6 + f.fuel * 1.6, vel: { x: wx * 0.05, y: 0.12, z: wz * 0.05 } });
          if (ctx.rng() < 0.5) spawnParticle(ctx.dim, 'nd:smoke_puff', { x: jx, y: f.y + 1.5 + ctx.rng() * 2, z: jz }, { size: 3, life: 2.5, vel: { x: wx * 0.15, y: 0.3, z: wz * 0.15 } });
          if (ctx.rng() < 0.3) spawnParticle(ctx.dim, 'nd:ember', { x: jx, y: f.y + 1, z: jz }, { size: 1, vel: { x: wx * 0.2, y: 0.25, z: wz * 0.2 } });
        }

        // heat: entities standing in or beside burning cells
        if (fires.length > 0) {
          let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
          for (let i = 0; i < fires.length; i++) {
            const f = fires[i];
            if (f.x < minX) minX = f.x;
            if (f.x > maxX) maxX = f.x;
            if (f.z < minZ) minZ = f.z;
            if (f.z > maxZ) maxZ = f.z;
          }
          const mid = { x: (minX + maxX) / 2, y: fires[0].y, z: (minZ + maxZ) / 2 };
          const rad = Math.min(90, Math.max(maxX - minX, maxZ - minZ) / 2 + 8);
          const list = ent.victims(ctx.dim, mid, rad, { key: 'i' + ctx.id });
          shield(list);
          for (let i = 0; i < list.length; i++) {
            const e = list[i];
            let l;
            try { l = e.location; } catch (err) { continue; }
            const c = fireNear(l.x, l.z);
            if (c && Math.abs(l.y - c.y) < 5 && dmgGate(e.id, t)) {
              ent.damage(e, 1.5 * ctx.mul, { cause: EntityDamageCause.fire });
              ent.setFire(e, 4);
            }
          }
        }

        // sound + warnings
        if (fires.length > 0) {
          const f = fires[Math.floor(ctx.rng() * fires.length)];
          if (t - lastRoar >= 70) { lastRoar = t; playSound(ctx.dim, 'nd.fire_roar', { x: f.x, y: f.y, z: f.z }, { volume: 5 }); }
          if (t - lastCrackle >= 25) { lastCrackle = t; playSound(ctx.dim, 'nd.fire_crackle', { x: f.x, y: f.y, z: f.z }, { volume: 3 }); }
          if (t - lastWarn >= 80) {
            lastWarn = t;
            const pl = playersIn(ctx.dim);
            for (let i = 0; i < pl.length; i++) {
              const d = hd(pl[i].loc.x, pl[i].loc.z, f.x, f.z);
              if (d < 90) actionBar(pl[i].player, '§6Wildfire - ' + fires.length + ' areas burning, ' + Math.round(d) + ' blocks away');
            }
          }
        }
        return t < ctx.durationTicks;
      },
      dispose() { fires = []; cells.clear(); },
    };
  },
};
