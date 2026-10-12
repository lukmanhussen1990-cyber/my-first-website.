// Terrain adaptation for the giant: writes horror:foot_0..7 (terrain height under each leg's
// neutral foot point minus entity y, in blocks) so the client IK plants the feet on the ground.
import { CONFIG } from './config.js';
import { legGroundTop } from './blocks.js';
import { footOffsets } from './geometry.js';
import { TPS, wrapDeg, yawOfDir } from './util.js';

export const FOOT_PROPS = [
  'horror:foot_0',
  'horror:foot_1',
  'horror:foot_2',
  'horror:foot_3',
  'horror:foot_4',
  'horror:foot_5',
  'horror:foot_6',
  'horror:foot_7',
];

// Per-column ground cache shared by all spiders: key "dim|x|z" -> {top, yTop, tick}
const columnCache = new Map();
let lastPurge = 0;

function purgeCache(now) {
  if (now - lastPurge < TPS * 5 && columnCache.size < 1024) return;
  lastPurge = now;
  const maxAge = CONFIG.terrainCacheSeconds * TPS;
  for (const [k, v] of columnCache) if (now - v.tick > maxAge) columnCache.delete(k);
}

export function terrainCacheSize() {
  return columnCache.size;
}

export class TerrainSampler {
  constructor() {
    this.values = [0, 0, 0, 0, 0, 0, 0, 0]; // last written property values
    this.lastTick = -1000;
    this.lastPos = null;
    this.lastYaw = 0;
    this.pending = true; // some column could not be resolved last time
    this.lastCost = 0;
  }

  /** Read the current property values (after a reload). */
  syncFrom(entity) {
    for (let i = 0; i < 8; i++) {
      try {
        const v = entity.getProperty(FOOT_PROPS[i]);
        this.values[i] = typeof v === 'number' ? v : 0;
      } catch (e) {
        this.values[i] = 0;
      }
    }
    this.pending = true;
  }

  /** Reset every foot to 0 (small form). */
  reset(entity) {
    for (let i = 0; i < 8; i++) {
      if (this.values[i] !== 0) {
        try {
          entity.setProperty(FOOT_PROPS[i], 0);
          this.values[i] = 0;
        } catch (e) {
          // invalid entity
        }
      }
    }
    this.lastPos = null;
    this.pending = true;
  }

  /** Heading used for the foot layout: velocity when moving, else body yaw. */
  static heading(entity) {
    try {
      const v = entity.getVelocity();
      if (v.x * v.x + v.z * v.z > 0.0025) return yawOfDir(v.x, v.z);
    } catch (e) {
      // fall through
    }
    try {
      return entity.getRotation().y;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Sample if due. Returns the number of getBlock calls used (0 when skipped).
   * @param entity giant spider
   * @param now    system.currentTick
   * @param s      giant scale
   */
  update(entity, now, s, force = false) {
    if (!force && now - this.lastTick < CONFIG.terrainSampleIntervalTicks) return 0;
    const pos = entity.location;
    const yaw = TerrainSampler.heading(entity);
    if (!force && !this.pending && this.lastPos) {
      const dx = pos.x - this.lastPos.x;
      const dy = pos.y - this.lastPos.y;
      const dz = pos.z - this.lastPos.z;
      const moved = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (moved <= CONFIG.terrainMoveThreshold && Math.abs(wrapDeg(yaw - this.lastYaw)) <= CONFIG.terrainTurnThreshold) {
        this.lastTick = now;
        return 0;
      }
    }
    this.lastTick = now;
    purgeCache(now);
    const dim = entity.dimension;
    const dimId = dim.id;
    const offsets = footOffsets(s, yaw);
    const yTop = Math.floor(pos.y + 6 * s);
    const yBottom = Math.floor(pos.y - 10 * s);
    const budget = { n: CONFIG.terrainBlockBudget };
    const maxAge = CONFIG.terrainCacheSeconds * TPS;
    let pending = false;
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(pos.x + offsets[i].x);
      const z = Math.floor(pos.z + offsets[i].z);
      const key = `${dimId}|${x}|${z}`;
      let top;
      const c = columnCache.get(key);
      if (c && now - c.tick <= maxAge && Math.abs(c.yTop - yTop) <= 2) {
        top = c.top;
      } else {
        const r = legGroundTop(dim, x, z, yTop, yBottom, budget);
        if (r.top === undefined) {
          pending = true; // unloaded chunk or budget exhausted: keep the previous value
          continue;
        }
        top = r.top;
        columnCache.set(key, { top, yTop, tick: now });
      }
      const v = Math.max(-24, Math.min(24, top - pos.y));
      if (Math.abs(v - this.values[i]) > 0.2) {
        try {
          entity.setProperty(FOOT_PROPS[i], v);
          this.values[i] = v;
        } catch (e) {
          pending = true;
        }
      }
    }
    this.pending = pending;
    this.lastPos = { x: pos.x, y: pos.y, z: pos.z };
    this.lastYaw = yaw;
    this.lastCost = CONFIG.terrainBlockBudget - budget.n;
    return this.lastCost;
  }
}
