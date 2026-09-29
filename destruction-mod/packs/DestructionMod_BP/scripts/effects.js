// @ts-check
// The ten destruction effects. Each one is a generator run by scheduler.js:
// `yield` = wait a tick, `yield n` = wait n ticks.
import { system } from "@minecraft/server";
import { budget } from "./scheduler.js";
import {
  add,
  breakBlock,
  clamp,
  dist,
  entitiesNear,
  groundY,
  hurt,
  lerp,
  norm,
  particle,
  placeBlock,
  push,
  rand,
  randInt,
  shake,
  sound,
  sub,
  yLimits,
} from "./util.js";

/** @typedef {import("@minecraft/server").Vector3} Vector3 */
/** @typedef {import("@minecraft/server").Dimension} Dimension */
/** @typedef {import("@minecraft/server").Entity} Entity */
/** @typedef {import("./scheduler.js").Effect} Effect */

/**
 * @typedef {Object} StrikeCtx
 * @property {Dimension} dim
 * @property {Vector3} pos     standing point on top of the target block
 * @property {Vector3} core    centre of the target block itself
 * @property {number} power    1..5
 * @property {boolean} breakBlocks
 * @property {boolean} fire
 * @property {boolean} protect
 * @property {string} ownerId
 */

const TAU = Math.PI * 2;

/** @param {StrikeCtx} ctx @param {Vector3} pos @param {number} power @param {boolean} [fire] */
function explode(ctx, pos, power, fire = true) {
  try {
    ctx.dim.createExplosion(pos, clamp(power, 0.5, 12), {
      breaksBlocks: ctx.breakBlocks,
      causesFire: ctx.fire && fire,
      allowUnderwater: true,
    });
  } catch {
    // unloaded chunk
  }
}

/** Random point on a disc around `c` (uniform). @param {Vector3} c @param {number} radius */
function discPoint(c, radius) {
  const a = rand(0, TAU);
  const r = Math.sqrt(Math.random()) * radius;
  return { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r };
}

// ------------------------------------------------------------ 1. Mega TNT Wand
/** @param {StrikeCtx} ctx @returns {Effect} */
function* megaTnt(ctx) {
  const { dim, pos, power: p } = ctx;
  sound(dim, "random.fuse", pos, 2, 1);
  for (let t = 0; t < 24; t++) {
    particle(dim, "minecraft:basic_flame_particle", add(pos, { x: rand(-0.3, 0.3), y: 0.4 + t * 0.04, z: rand(-0.3, 0.3) }));
    if (t % 4 === 0) particle(dim, "minecraft:white_smoke_particle", add(pos, { x: 0, y: 1, z: 0 }));
    yield;
  }
  explode(ctx, pos, 4 + p * 1.5);
  particle(dim, "minecraft:huge_explosion_emitter", pos);
  sound(dim, "random.explode", pos, 6, 0.7);
  shake(dim, pos, 24 + p * 12, 0.3 + p * 0.1, 1.2);
  yield 2;

  // satellite blasts in a ring
  const ring = 2 + p;
  const rr = 3 + p * 1.6;
  const off = rand(0, TAU);
  for (let i = 0; i < ring; i++) {
    const a = off + (i / ring) * TAU;
    const q = { x: pos.x + Math.cos(a) * rr, y: pos.y + rand(-1, 1), z: pos.z + Math.sin(a) * rr };
    explode(ctx, q, 3 + p * 0.8);
    particle(dim, "minecraft:huge_explosion_emitter", q);
    if (i % 2 === 0) sound(dim, "random.explode", q, 4, rand(0.8, 1.1));
    yield 2;
  }

  // a deep charge digs the crater out
  const deep = { x: pos.x, y: pos.y - (2 + p), z: pos.z };
  explode(ctx, deep, 3 + p);
  sound(dim, "random.explode", deep, 5, 0.5);

  for (let t = 0; t < 40; t++) {
    const h = t * 0.5;
    particle(dim, "minecraft:campfire_tall_smoke_particle", add(pos, { x: rand(-2, 2), y: h, z: rand(-2, 2) }));
    if (t % 4 === 0) particle(dim, "minecraft:large_explosion", add(pos, { x: rand(-3, 3), y: h, z: rand(-3, 3) }));
    yield;
  }
}

// ------------------------------------------------------------ 2. Meteor Staff
/** @param {StrikeCtx} ctx @returns {Effect} */
function* meteorShower(ctx) {
  const { dim, pos, power: p } = ctx;
  const lim = yLimits(dim);
  const count = 2 + p * 2;
  const spread = 5 + p * 3;
  const heading = rand(0, TAU); // all meteors come in from the same side of the sky
  sound(dim, "ambient.weather.thunder", pos, 3, 0.5);

  /** @type {{from: Vector3, to: Vector3, step: number, steps: number}[]} */
  const flying = [];
  /** @type {{at: number, x: number, y: number, z: number}[]} */
  const rocks = [];
  let launched = 0;
  let next = 0;

  for (let t = 0; launched < count || flying.length > 0 || rocks.length > 0; t++) {
    if (launched < count && t >= next) {
      const spot = discPoint(pos, spread);
      const gy = groundY(dim, spot.x, spot.z, pos.y + 24, 64) ?? Math.floor(pos.y) - 1;
      const to = { x: spot.x, y: gy + 1, z: spot.z };
      const h = clamp(lim.max - to.y - 2, 10, 60);
      const from = { x: to.x - Math.cos(heading) * h * 0.7, y: to.y + h, z: to.z - Math.sin(heading) * h * 0.7 };
      flying.push({ from, to, step: 0, steps: 20 + randInt(0, 8) });
      sound(dim, "mob.ghast.fireball", to, 3, 0.5);
      launched++;
      next = t + randInt(3, 8);
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const m = flying[i];
      m.step++;
      const k = m.step / m.steps;
      const at = lerp(m.from, m.to, k * k * 0.4 + k * 0.6); // speeds up as it falls
      particle(dim, "minecraft:lava_particle", at);
      particle(dim, "minecraft:basic_flame_particle", add(at, { x: rand(-0.5, 0.5), y: rand(-0.5, 0.5), z: rand(-0.5, 0.5) }));
      if (m.step % 2 === 0) particle(dim, "minecraft:campfire_smoke_particle", at);
      if (m.step % 3 === 0) particle(dim, "minecraft:mobflame_single", at);
      if (m.step < m.steps) continue;

      flying.splice(i, 1);
      explode(ctx, m.to, 3 + p * 0.8, true);
      particle(dim, "minecraft:huge_explosion_emitter", m.to);
      for (let j = 0; j < 5; j++) particle(dim, "minecraft:lava_particle", add(m.to, { x: rand(-2, 2), y: rand(0, 2), z: rand(-2, 2) }));
      sound(dim, "random.explode", m.to, 5, rand(0.6, 0.9));
      shake(dim, m.to, 16 + p * 4, 0.2 + p * 0.05, 0.6);
      if (ctx.breakBlocks) rocks.push({ at: t + 3, x: m.to.x, y: m.to.y, z: m.to.z });
    }

    // leave a hot meteorite in each crater once the dust settles
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i];
      if (t < r.at) continue;
      rocks.splice(i, 1);
      const gy = groundY(dim, r.x, r.z, r.y + 4, 20);
      if (gy === undefined) continue;
      const bx = Math.floor(r.x);
      const bz = Math.floor(r.z);
      placeBlock(dim, bx, gy + 1, bz, "minecraft:magma");
      if (p >= 3) {
        placeBlock(dim, bx + 1, gy + 1, bz, "minecraft:blackstone");
        placeBlock(dim, bx, gy + 1, bz + 1, "minecraft:magma");
      }
      if (p >= 5) placeBlock(dim, bx, gy + 2, bz, "minecraft:blackstone");
    }
    yield;
  }
}

// ------------------------------------------------------------ 3. Thunder Staff
/** @param {StrikeCtx} ctx @returns {Effect} */
function* thunderStorm(ctx) {
  const { dim, pos, power: p } = ctx;
  const duration = (3 + p) * 20;
  const radius = 4 + p * 3;
  sound(dim, "ambient.weather.thunder", pos, 4, 0.8);
  for (let t = 0; t < duration; ) {
    const spot = discPoint(pos, radius);
    const gy = groundY(dim, spot.x, spot.z, pos.y + 24, 64);
    if (gy !== undefined) {
      const hit = { x: spot.x, y: gy + 1, z: spot.z };
      if (ctx.fire) {
        try {
          dim.spawnEntity("minecraft:lightning_bolt", hit);
        } catch {
          // unloaded
        }
      } else {
        // fire is off: a lightning-looking beam that can't start fires
        for (let h = 0; h < 24; h += 1.5) particle(dim, "minecraft:endrod", add(hit, { x: rand(-0.3, 0.3), y: h, z: rand(-0.3, 0.3) }));
        sound(dim, "ambient.weather.lightning.impact", hit, 4, 1);
        for (const e of entitiesNear(ctx, hit, 3)) hurt(e, 4 + p);
      }
      explode(ctx, hit, 1.5 + p * 0.5, true);
      particle(dim, "minecraft:campfire_smoke_particle", hit);
    }
    const gap = randInt(3, 7);
    t += gap;
    yield gap;
  }
}

// ------------------------------------------------------------ 4. Black Hole Orb
/**
 * Removes the shell of blocks between radius r0 and r1 around c, a budgeted
 * slice per tick.
 * @param {StrikeCtx} ctx @param {Vector3} c @param {number} r0 @param {number} r1
 * @param {{min: number, max: number}} lim @returns {Effect}
 */
function* swallow(ctx, c, r0, r1, lim) {
  const R = Math.ceil(r1);
  const in2 = r0 * r0;
  const out2 = r1 * r1;
  const cx = Math.floor(c.x);
  const cy = Math.floor(c.y);
  const cz = Math.floor(c.z);
  for (let dx = -R; dx <= R; dx++) {
    for (let dz = -R; dz <= R; dz++) {
      const h2 = dx * dx + dz * dz;
      if (h2 > out2) continue;
      for (let dy = -R; dy <= R; dy++) {
        const d2 = h2 + dy * dy;
        if (d2 > out2 || d2 <= in2) continue;
        budget.left -= 1;
        if (breakBlock(ctx.dim, cx + dx, cy + dy, cz + dz, lim)) {
          budget.left -= 3;
          if (Math.random() < 0.04) particle(ctx.dim, "minecraft:dragon_destroy_block", { x: cx + dx + 0.5, y: cy + dy + 0.5, z: cz + dz + 0.5 });
        }
        if (budget.left <= 0) yield;
      }
    }
  }
}

/** @param {StrikeCtx} ctx @returns {Effect} */
function* blackHole(ctx) {
  const { dim, power: p } = ctx;
  const lim = yLimits(dim);
  const c = { x: ctx.pos.x, y: ctx.pos.y + 2 + p * 0.5, z: ctx.pos.z };
  const maxR = 3 + p * 2;
  const pullR = maxR * 2 + 6;
  const duration = (7 + p * 2) * 20;
  const growFor = Math.floor(duration * 0.75);
  const start = system.currentTick;
  sound(dim, "mob.endermen.portal", c, 4, 0.5);
  sound(dim, "block.end_portal.spawn", c, 3, 0.6);

  let r = 0.5;
  let spin = 0;
  /** @type {Effect | undefined} */
  let carver;
  for (let t = 0; t < duration; t = system.currentTick - start) {
    spin += 0.35;
    // black core + swirling purple disk
    if (t % 3 === 0) particle(dim, "minecraft:ink_emitter", c);
    const ring = Math.max(r + 1.5, 2.5);
    for (let k = 0; k < 8; k++) {
      const a = spin + (k / 8) * TAU;
      particle(dim, "minecraft:dragon_breath_trail", { x: c.x + Math.cos(a) * ring, y: c.y + Math.sin(a * 2) * 0.3, z: c.z + Math.sin(a) * ring });
    }
    const fa = rand(0, TAU);
    const fd = rand(ring + 2, pullR * 0.7);
    particle(dim, "minecraft:obsidian_glow_dust_particle", { x: c.x + Math.cos(fa) * fd, y: c.y + rand(-3, 3), z: c.z + Math.sin(fa) * fd });

    // pull everything in; items that reach the core are gone
    if (t % 2 === 0) {
      for (const e of entitiesNear(ctx, c, pullR)) {
        const d = dist(e.location, c);
        if (d < r + 1.5) {
          if (e.typeId === "minecraft:item" || e.typeId === "minecraft:xp_orb") {
            try {
              e.remove();
            } catch {
              // gone already
            }
            continue;
          }
          if (t % 10 === 0) hurt(e, 3 + p);
        }
        const u = norm(sub(c, e.location));
        const s = 0.06 + (1 - d / pullR) * 0.3;
        push(e, { x: u.x * s, y: u.y * s + 0.05, z: u.z * s });
      }
    }
    if (t % 40 === 0) sound(dim, "mob.endermen.portal", c, 3, 0.4);

    // grow, eating the terrain a slice at a time
    const want = 0.5 + (maxR - 0.5) * Math.min(1, t / growFor);
    if (!carver && want - r >= 0.5) {
      if (ctx.breakBlocks) carver = swallow(ctx, c, r, want, lim);
      r = want;
    }
    if (carver && carver.next().done) carver = undefined;
    yield;
  }

  // collapse
  sound(dim, "mob.warden.sonic_charge", c, 4, 1);
  for (let k = 0; k < 20; k++) {
    const ringR = Math.max(0.3, (r + 2) * (1 - k / 20));
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * TAU + k * 0.3;
      particle(dim, "minecraft:dragon_breath_trail", { x: c.x + Math.cos(a) * ringR, y: c.y, z: c.z + Math.sin(a) * ringR });
    }
    yield;
  }
  explode(ctx, c, 4 + p, false);
  particle(dim, "minecraft:sonic_explosion", c);
  particle(dim, "minecraft:huge_explosion_emitter", c);
  sound(dim, "mob.warden.sonic_boom", c, 5, 0.7);
  for (const e of entitiesNear(ctx, c, pullR)) {
    const u = norm(sub(e.location, c));
    push(e, { x: u.x * 1.6, y: 0.6, z: u.z * 1.6 });
  }
}

// ------------------------------------------------------------ 5. Earthquake Hammer
/** @param {StrikeCtx} ctx @returns {Effect} */
function* earthquake(ctx) {
  const { dim, pos, power: p } = ctx;
  const lim = yLimits(dim);
  const R = 8 + p * 4;
  const duration = (4 + p) * 20;
  const depth = 3 + Math.floor(p / 2);
  const n = 3 + p;
  const base = rand(0, TAU);
  const cracks = [];
  for (let i = 0; i < n; i++) {
    cracks.push({ a: base + (i / n) * TAU + rand(-0.3, 0.3), x: pos.x, z: pos.z, len: 0, max: R * rand(0.7, 1) });
  }
  sound(dim, "mob.warden.emerge", pos, 4, 0.6);
  shake(dim, pos, R * 2.5, 0.2 + p * 0.06, duration / 20);
  explode(ctx, { x: pos.x, y: pos.y - 1, z: pos.z }, 2 + p * 0.6, false);

  for (let t = 0; t < duration; t++) {
    if (t % 2 === 0) {
      for (const cr of cracks) {
        if (cr.len >= cr.max) continue;
        cr.a += rand(-0.3, 0.3); // jagged
        cr.x += Math.cos(cr.a);
        cr.z += Math.sin(cr.a);
        cr.len++;
        const bx = Math.floor(cr.x);
        const bz = Math.floor(cr.z);
        const gy = groundY(dim, bx, bz, pos.y + 12, 32);
        if (gy === undefined) continue;
        if (ctx.breakBlocks) {
          const wide = cr.len < cr.max * 0.6;
          const sx = Math.round(-Math.sin(cr.a));
          const sz = Math.round(Math.cos(cr.a));
          for (let dy = 0; dy < depth; dy++) {
            breakBlock(dim, bx, gy - dy, bz, lim);
            if (wide) breakBlock(dim, bx + sx, gy - dy, bz + sz, lim);
          }
          // the strongest quakes split the ground open to lava
          if (ctx.fire && p >= 4 && cr.len <= 5) placeBlock(dim, bx, gy - depth + 1, bz, "minecraft:lava");
        }
        particle(dim, "minecraft:dust_plume", { x: bx + 0.5, y: gy + 1, z: bz + 0.5 });
        if (cr.len % 3 === 0) sound(dim, "dig.stone", { x: bx, y: gy, z: bz }, 2, 0.5);
      }
    }
    if (t % 10 === 0) {
      for (const e of entitiesNear(ctx, pos, R)) push(e, { x: rand(-0.15, 0.15), y: 0.3 + p * 0.06, z: rand(-0.15, 0.15) });
      sound(dim, "random.explode", pos, 2, 0.35); // deep rumble
      const spot = discPoint(pos, R);
      particle(dim, "minecraft:dust_plume", { x: spot.x, y: pos.y + 0.2, z: spot.z });
    }
    yield;
  }
}

// ------------------------------------------------------------ 6. Tornado Wand
/** @param {StrikeCtx} ctx @returns {Effect} */
function* tornado(ctx) {
  const { dim, power: p } = ctx;
  const lim = yLimits(dim);
  const duration = (8 + p * 2) * 20;
  const baseR = 1.5 + p * 0.5;
  const height = 14 + p * 4;
  const pullR = baseR + 7;
  const speed = 0.16 + p * 0.03;
  let x = ctx.pos.x;
  let z = ctx.pos.z;
  let y = ctx.pos.y;
  let heading = rand(0, TAU);
  let spin = 0;
  sound(dim, "mob.breeze.whirl", ctx.pos, 4, 0.5);

  for (let t = 0; t < duration; t++) {
    heading += rand(-0.15, 0.15);
    x += Math.cos(heading) * speed;
    z += Math.sin(heading) * speed;
    if (t % 4 === 0) {
      const gy = groundY(dim, x, z, y + 10, 30);
      if (gy !== undefined) y = gy + 1;
    }

    // the funnel: two spiral arms that widen with height
    spin += 0.45;
    for (let k = 0; k < 12; k++) {
      const h = Math.random() * height;
      const rr = baseR * 0.5 + h * 0.3;
      const a = spin + h * 0.35 + (k % 2) * Math.PI;
      const id = k % 3 === 0 ? "minecraft:campfire_smoke_particle" : "minecraft:white_smoke_particle";
      particle(dim, id, { x: x + Math.cos(a) * rr, y: y + h, z: z + Math.sin(a) * rr });
    }
    if (t % 4 === 0) particle(dim, "minecraft:dust_plume", { x: x + rand(-baseR, baseR), y: y + 0.2, z: z + rand(-baseR, baseR) });
    if (t % 10 === 0) particle(dim, "minecraft:wind_explosion_emitter", { x, y: y + 1, z });

    // spin things around and lift them up the funnel
    if (t % 2 === 0) {
      for (const e of entitiesNear(ctx, { x, y: y + height / 2, z }, pullR + height / 2)) {
        const el = e.location;
        const dx = x - el.x;
        const dz = z - el.z;
        const hd = Math.hypot(dx, dz) || 0.01;
        if (hd > pullR) continue;
        const ux = dx / hd;
        const uz = dz / hd;
        const lift = el.y - y < height ? 0.16 + p * 0.02 : -0.05;
        push(e, { x: ux * 0.12 - uz * 0.35, y: lift, z: uz * 0.12 + ux * 0.35 });
        if (t % 20 === 0) hurt(e, 1 + Math.floor(p / 2));
      }
    }

    // rip up the ground along its path
    if (ctx.breakBlocks && t % 3 === 0) {
      const R = Math.ceil(baseR);
      const cx = Math.floor(x);
      const cz = Math.floor(z);
      for (let dx = -R; dx <= R; dx++) {
        for (let dz = -R; dz <= R; dz++) {
          if (dx * dx + dz * dz > baseR * baseR || Math.random() > 0.55) continue;
          const gy = groundY(dim, cx + dx, cz + dz, y + 8, 16);
          if (gy !== undefined && breakBlock(dim, cx + dx, gy, cz + dz, lim) && Math.random() < 0.15) {
            particle(dim, "minecraft:dragon_destroy_block", { x: cx + dx + 0.5, y: gy + 0.5, z: cz + dz + 0.5 });
          }
        }
      }
    }
    if (t % 20 === 0) sound(dim, "mob.breeze.whirl", { x, y, z }, 4, 0.5);
    yield;
  }
  particle(dim, "minecraft:wind_explosion_emitter", { x, y: y + 1, z });
}

// ------------------------------------------------------------ 7. Sky Beam Staff
/** @param {StrikeCtx} ctx @returns {Effect} */
function* skyBeam(ctx) {
  const { dim, pos, power: p } = ctx;
  const lim = yLimits(dim);
  const r = 1.2 + p * 0.7;
  const depth = 10 + p * 8;
  const top = Math.min(lim.max, Math.floor(pos.y) + 64);
  sound(dim, "beacon.activate", pos, 4, 1.4);
  sound(dim, "mob.warden.sonic_charge", pos, 3, 1.2);

  // lock-on: a ring on the ground and a spark coming down from the sky
  for (let t = 0; t < 30; t++) {
    for (let k = 0; k < 4; k++) {
      const a = t * 0.4 + (k * Math.PI) / 2;
      particle(dim, "minecraft:endrod", { x: pos.x + Math.cos(a) * (r + 1), y: pos.y + 0.2, z: pos.z + Math.sin(a) * (r + 1) });
    }
    particle(dim, "minecraft:endrod", { x: pos.x, y: top - ((top - pos.y) * t) / 30, z: pos.z });
    yield;
  }

  sound(dim, "mob.warden.sonic_boom", pos, 5, 1.4);
  sound(dim, "beacon.power", pos, 4, 0.8);
  let y = Math.floor(pos.y);
  const bottom = Math.max(lim.min + 1, Math.floor(pos.y) - depth);
  const beamTicks = (3 + p) * 20;
  const perTick = Math.max(1, Math.ceil((y - bottom) / (beamTicks * 0.6)));
  const R = Math.ceil(r);
  const cx = Math.floor(pos.x);
  const cz = Math.floor(pos.z);

  for (let t = 0; t < beamTicks; t++) {
    const stepH = Math.max(3, (top - y) / 28);
    for (let h = y; h < top; h += stepH) {
      particle(dim, "minecraft:endrod", { x: pos.x + rand(-0.4, 0.4), y: h + rand(0, stepH), z: pos.z + rand(-0.4, 0.4) });
    }
    if (ctx.breakBlocks) {
      for (let n = 0; n < perTick && y > bottom; n++, y--) {
        for (let dx = -R; dx <= R; dx++) {
          for (let dz = -R; dz <= R; dz++) {
            if (dx * dx + dz * dz <= r * r) breakBlock(dim, cx + dx, y, cz + dz, lim);
          }
        }
      }
    }
    particle(dim, "minecraft:lava_particle", { x: pos.x + rand(-r, r), y: y + 1, z: pos.z + rand(-r, r) });
    if (t % 4 === 0) particle(dim, "minecraft:large_explosion", { x: pos.x, y: y + 1, z: pos.z });

    // anything standing in the beam gets burned
    if (t % 5 === 0) {
      const half = (top - y) / 2;
      for (const e of entitiesNear(ctx, { x: pos.x, y: y + half, z: pos.z }, half + r + 1)) {
        if (Math.hypot(e.location.x - pos.x, e.location.z - pos.z) > r + 1) continue;
        hurt(e, 4 + p);
        if (ctx.fire) {
          try {
            e.setOnFire(4, true);
          } catch {
            // fire-proof
          }
        }
      }
    }
    // the rim catches fire
    if (ctx.fire && t % 6 === 0) {
      const a = rand(0, TAU);
      const fx = pos.x + Math.cos(a) * (r + 1.5);
      const fz = pos.z + Math.sin(a) * (r + 1.5);
      const gy = groundY(dim, fx, fz, pos.y + 6, 16);
      if (gy !== undefined) placeBlock(dim, Math.floor(fx), gy + 1, Math.floor(fz), "minecraft:fire");
    }
    if (t % 20 === 0) sound(dim, "mob.blaze.shoot", pos, 3, 0.6);
    yield;
  }
  const end = { x: pos.x, y: y + 1, z: pos.z };
  explode(ctx, end, 3 + p, true);
  particle(dim, "minecraft:huge_explosion_emitter", end);
  sound(dim, "random.explode", end, 5, 0.8);
}

// ------------------------------------------------------------ 8. TNT Rain Wand
/** @param {StrikeCtx} ctx @returns {Effect} */
function* tntRain(ctx) {
  const { dim, pos, power: p } = ctx;
  const lim = yLimits(dim);
  const count = 4 + p * 4;
  const radius = 3 + p * 2.5;
  sound(dim, "random.fuse", pos, 3, 0.7);
  // With block damage off we set the TNT off ourselves (without breaking
  // blocks) just before its own 4 second fuse runs out.
  /** @type {{e: Entity, at: number}[]} */
  const tamed = [];
  let spawned = 0;
  for (let t = 0; spawned < count || tamed.length > 0; t++) {
    if (spawned < count && t % 2 === 0) {
      const spot = discPoint(pos, radius);
      spot.y = Math.min(lim.max - 1, pos.y + randInt(16, 26));
      try {
        const tnt = dim.spawnEntity("minecraft:tnt", spot);
        if (!ctx.breakBlocks) tamed.push({ e: tnt, at: t + 70 });
      } catch {
        // unloaded
      }
      particle(dim, "minecraft:white_smoke_particle", spot);
      spawned++;
    }
    for (let i = tamed.length - 1; i >= 0; i--) {
      const x = tamed[i];
      if (t < x.at) continue;
      tamed.splice(i, 1);
      try {
        if (!x.e.isValid()) continue;
        const at = x.e.location;
        x.e.remove();
        explode(ctx, at, 4, false);
        particle(dim, "minecraft:huge_explosion_emitter", at);
        sound(dim, "random.explode", at, 4, rand(0.8, 1.1));
      } catch {
        // already exploded
      }
    }
    yield;
  }
}

// ------------------------------------------------------------ 9. Shockwave Core
/** @param {StrikeCtx} ctx @returns {Effect} */
function* shockwave(ctx) {
  const { dim, pos, power: p } = ctx;
  const R = 6 + p * 3;
  const c = { x: pos.x, y: pos.y + 0.5, z: pos.z };
  sound(dim, "mob.warden.sonic_boom", c, 5, 0.9);
  particle(dim, "minecraft:sonic_explosion", c);
  explode(ctx, c, 2.5 + p * 0.6, false);
  shake(dim, c, R * 2, 0.3 + p * 0.08, 0.8);

  let inner = 0;
  for (let r = 3; r <= R; r += 3) {
    const n = clamp(Math.round(r * 0.9), 6, 18);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      particle(dim, "minecraft:wind_explosion_emitter", { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r });
    }
    // small blasts along the ring shatter the ground (half now, half next tick)
    const blasts = [];
    if (ctx.breakBlocks) {
      const m = clamp(Math.round((TAU * r) / 7), 6, 14);
      const off = rand(0, Math.PI);
      for (let k = 0; k < m; k++) {
        const a = off + (k / m) * TAU;
        blasts.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r });
      }
    }
    const ringBlast = (/** @type {{x: number, z: number}} */ b) => {
      const gy = groundY(dim, b.x, b.z, c.y + 6, 14) ?? Math.floor(c.y) - 1;
      explode(ctx, { x: b.x, y: gy + 1, z: b.z }, 1.6 + p * 0.3, false);
    };
    blasts.filter((_, k) => k % 2 === 0).forEach(ringBlast);
    // knock back everything the wave passes
    for (const e of entitiesNear(ctx, c, r + 1.5)) {
      const dx = e.location.x - c.x;
      const dz = e.location.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d < inner - 0.5) continue;
      const k = 1.2 + p * 0.3;
      push(e, { x: (dx / d) * k, y: 0.45 + p * 0.08, z: (dz / d) * k });
      hurt(e, 2 + p);
    }
    inner = r;
    sound(dim, "wind_charge.burst", c, 3, clamp(1.3 - r / (R * 1.5), 0.5, 1.3));
    yield;
    blasts.filter((_, k) => k % 2 === 1).forEach(ringBlast);
    yield;
  }
}

// ------------------------------------------------------------ 10. Crater Wand
/** @param {StrikeCtx} ctx @returns {Effect} */
function* crater(ctx) {
  const { dim, core, power: p } = ctx;
  const lim = yLimits(dim);
  const R = 3 + p * 2.5;
  sound(dim, "mob.endermen.portal", core, 4, 0.6);
  sound(dim, "beacon.deactivate", core, 4, 0.7);
  particle(dim, "minecraft:sonic_explosion", core);
  for (let k = 0; k < 20; k++) {
    particle(dim, "minecraft:dragon_breath_trail", add(core, { x: rand(-R, R), y: rand(-R / 2, R / 2), z: rand(-R, R) }));
  }
  if (!ctx.breakBlocks) return;

  const Ri = Math.ceil(R);
  const R2 = R * R;
  const cx = Math.floor(core.x);
  const cy = Math.floor(core.y);
  const cz = Math.floor(core.z);
  // top-down, so sand and gravel above never fall into the hole mid-way
  for (let dy = Ri; dy >= -Ri; dy--) {
    for (let dx = -Ri; dx <= Ri; dx++) {
      for (let dz = -Ri; dz <= Ri; dz++) {
        if (dx * dx + dy * dy + dz * dz > R2) continue;
        budget.left -= 1;
        if (breakBlock(dim, cx + dx, cy + dy, cz + dz, lim)) budget.left -= 3;
        if (budget.left <= 0) yield;
      }
    }
    if (dy % 2 === 0) particle(dim, "minecraft:obsidian_glow_dust_particle", { x: core.x, y: cy + dy + 0.5, z: core.z });
  }
}

// ------------------------------------------------------------ marker beacon
/** A short column of light where a marker was just placed. @param {Dimension} dim @param {Vector3} pos @returns {Effect} */
export function* markerFlash(dim, pos) {
  for (let t = 0; t < 40; t += 2) {
    for (let h = 0; h < 6; h++) particle(dim, "minecraft:endrod", { x: pos.x, y: pos.y + h + (t % 4) * 0.25, z: pos.z });
    yield 2;
  }
}

/**
 * Effect + how long (ticks) the owner is protected when "Protect me" is on.
 * @type {Record<string, {run: (ctx: StrikeCtx) => Effect, protectTicks: (power: number) => number}>}
 */
export const EFFECTS = {
  mega_tnt_wand: { run: megaTnt, protectTicks: () => 20 * 7 },
  meteor_staff: { run: meteorShower, protectTicks: (p) => 20 * (7 + p * 2) },
  thunder_staff: { run: thunderStorm, protectTicks: (p) => 20 * (5 + p) },
  black_hole_orb: { run: blackHole, protectTicks: (p) => 20 * (11 + p * 2) },
  earthquake_hammer: { run: earthquake, protectTicks: (p) => 20 * (6 + p) },
  tornado_wand: { run: tornado, protectTicks: (p) => 20 * (11 + p * 2) },
  sky_beam_staff: { run: skyBeam, protectTicks: (p) => 20 * (7 + p) },
  tnt_rain_wand: { run: tntRain, protectTicks: (p) => 20 * (7 + p) },
  shockwave_core: { run: shockwave, protectTicks: () => 20 * 4 },
  crater_wand: { run: crater, protectTicks: () => 20 * 5 },
};
