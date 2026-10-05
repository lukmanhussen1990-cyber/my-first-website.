// The seven weapons: tap/use abilities (`fire`) and melee passives (`onHit`).
// `delay` is the tick of the animation's strike frame, so spell and swing land together.
import { system } from '@minecraft/server';
import {
  COLORS, add, aim, aimPoint, burst, center, dist, effect, flat, head, heal, hurt, ignite, later, len, livingNear,
  mul, norm, passable, push, puff, rand, rightOf, sfx, spark, sub, valid, yawRotate,
} from './util.js';

/** Run `fn` once per tick (up to `maxSteps`); return false from `fn` to stop early. */
function runSteps(maxSteps, fn) {
  let n = 0;
  const id = system.runInterval(() => {
    n++;
    let keep = false;
    try {
      keep = fn(n) !== false;
    } catch (err) {
      console.warn(`[MagicalWeapons] spell error: ${err}`);
    }
    if (!keep || n >= maxSteps) system.clearRun(id);
  }, 1);
}

const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ================================================================ Flamebrand: Flame Wave
function flameWave(p) {
  const dim = p.dimension;
  const dir = flat(aim(p));
  if (len(dir) < 0.1) return;
  const right = rightOf(dir);
  let pos = add(head(p), mul(dir, 1.3));
  pos.y = p.location.y + 0.8;
  sfx(dim, 'mob.blaze.shoot', pos, 1.3, 0.75);
  sfx(dim, 'mob.ghast.fireball', pos, 0.8, 1.2);
  const hit = new Set();
  runSteps(15, () => {
    if (!valid(p)) return false;
    pos = add(pos, mul(dir, 1.05));
    if (!passable(dim, pos)) {                      // climb one block, otherwise fizzle out on the wall
      const up = { x: pos.x, y: pos.y + 1, z: pos.z };
      if (!passable(dim, up)) {
        burst(dim, pos, COLORS.fire, 12, 0.9);
        sfx(dim, 'random.fizz', pos, 0.8, 1.0);
        return false;
      }
      pos = up;
    } else {
      const d1 = { x: pos.x, y: pos.y - 1, z: pos.z };
      const d2 = { x: pos.x, y: pos.y - 2, z: pos.z };
      if (passable(dim, d1) && !passable(dim, d2)) pos = d1;   // hug the ground
    }
    for (let i = -6; i <= 6; i++) {                  // a crescent whose tips trail behind
      const t = i / 6;
      const q = add(add(pos, mul(right, t * 2.0)), mul(dir, -(t * t) * 1.1));
      spark(dim, q, i % 2 ? COLORS.fire : COLORS.ember, { x: 0, y: rand(0.1, 0.5), z: 0 });
      if (Math.abs(i) >= 5 || i % 3 === 0) puff(dim, 'minecraft:basic_flame_particle', q);
    }
    for (const e of livingNear(dim, pos, 2.1, [p])) {
      if (hit.has(e.id)) continue;
      hit.add(e.id);
      hurt(e, 7, p, 'fire');
      ignite(e, 5);
      push(e, dir, 0.9, 0.35);
      burst(dim, center(e), COLORS.fire, 10, 0.8);
      sfx(dim, 'fire.ignite', e.location, 0.9, 1.0);
    }
    return true;
  });
}

// ================================================================ Frostbite: Frost Nova
function frostNova(p) {
  const dim = p.dimension;
  const dir = flat(aim(p));
  const f = add(p.location, mul(dir, 1.4));
  const c = { x: f.x, y: p.location.y + 0.15, z: f.z };
  sfx(dim, 'random.glass', c, 1.4, 0.7);
  sfx(dim, 'mob.snowgolem.shoot', c, 1.0, 0.6);
  effect(p, 'resistance', 60, 0);
  try { p.extinguishFire(); } catch (err) { /* not burning */ }
  const hit = new Set();
  runSteps(11, (n) => {
    const r = 0.6 + n * 0.6;
    const pts = Math.min(64, Math.floor(r * 9) + 12);
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2;
      const q = { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r };
      spark(dim, q, k % 2 ? COLORS.ice : COLORS.frost, { x: 0, y: rand(0.05, 0.25), z: 0 });
      if (k % 4 === 0) puff(dim, 'minecraft:snowflake_particle', add(q, { x: 0, y: 0.2, z: 0 }));
      if (k % 7 === 0) spark(dim, q, COLORS.frost, { x: 0, y: 0.9, z: 0 });      // ice shards thrown upward
    }
    for (const e of livingNear(dim, c, r + 1.2, [p])) {
      if (hit.has(e.id) || dist2d(c, e.location) > r + 0.9) continue;
      hit.add(e.id);
      hurt(e, 6, p, 'freezing');
      effect(e, 'slowness', 120, 2);
      const out = flat(sub(e.location, c));
      push(e, len(out) > 0.01 ? out : dir, 0.9, 0.4);
      burst(dim, center(e), COLORS.frost, 10, 0.7);
      try { e.extinguishFire(); } catch (err) { /* not burning */ }
    }
    return true;
  });
}

// ================================================================ Stormcaller Staff: Thunder Strike
function drawBolt(dim, top, bottom) {
  const N = 14;
  let prev = top;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    const j = (1 - t) * 1.0;
    const q = {
      x: top.x + (bottom.x - top.x) * t + rand(-j, j),
      y: top.y + (bottom.y - top.y) * t,
      z: top.z + (bottom.z - top.z) * t + rand(-j, j),
    };
    const seg = sub(q, prev);
    for (let s = 0; s < 3; s++) {
      const pt = add(prev, mul(seg, s / 3));
      spark(dim, pt, i % 2 ? COLORS.bolt : COLORS.storm, { x: 0, y: 0, z: 0 });
      if (s === 0) puff(dim, 'minecraft:electric_spark_particle', pt);
    }
    prev = q;
  }
}

function thunderStrike(p) {
  const dim = p.dimension;
  const info = aimPoint(p, 34);
  let target = info.point;
  if (dist(target, p.location) < 3) target = add(p.location, mul(flat(info.dir), 4));
  const top = { x: target.x, y: target.y + 26, z: target.z };
  sfx(dim, 'ambient.weather.lightning.impact', target, 3.0, 1.0);
  sfx(dim, 'item.trident.thunder', target, 2.0, 1.1);
  drawBolt(dim, top, target);
  later(() => drawBolt(dim, top, target), 1);
  later(() => drawBolt(dim, top, target), 2);
  burst(dim, target, COLORS.bolt, 18, 1.4);
  burst(dim, target, COLORS.storm, 14, 1.0, 'minecraft:electric_spark_particle');
  const primary = livingNear(dim, target, 3.4, [p]);
  const struck = new Set();
  for (const e of primary) {
    struck.add(e.id);
    hurt(e, dist(center(e), target) < 2 ? 13 : 9, p, 'lightning');
    ignite(e, 3);
    push(e, flat(sub(e.location, target)), 0.7, 0.45);
  }
  let chains = 0;
  for (const e of primary) {                      // chain lightning to up to two more targets
    for (const o of livingNear(dim, center(e), 6, [p])) {
      if (struck.has(o.id) || chains >= 2) continue;
      struck.add(o.id);
      chains++;
      hurt(o, 5, p, 'lightning');
      const a = center(e);
      const seg = sub(center(o), a);
      for (let s = 0; s <= 8; s++) spark(dim, add(a, mul(seg, s / 8)), COLORS.bolt, { x: 0, y: 0, z: 0 }, 'minecraft:electric_spark_particle');
      burst(dim, center(o), COLORS.storm, 8, 0.8);
    }
  }
}

// ================================================================ Arcane Wand: Arcane Missiles
function launchMissile(p, yaw) {
  const dim = p.dimension;
  let dir = yawRotate(aim(p), yaw);
  dir = norm({ x: dir.x, y: dir.y + 0.04, z: dir.z });
  const right = rightOf(flat(dir));
  let pos = add(add(head(p), mul(dir, 1.2)), add(mul(right, 0.25), { x: 0, y: -0.25, z: 0 }));
  sfx(dim, 'mob.shulker.shoot', pos, 0.9, 1.7);
  burst(dim, pos, COLORS.arcane, 6, 0.6);
  const hitSet = new Set();
  runSteps(34, () => {
    if (!valid(p)) return false;
    // home in on the best target in front of the bolt
    let best;
    let bestScore = 0.55;
    for (const e of livingNear(dim, pos, 16, [p])) {
      const to = norm(sub(center(e), pos));
      const score = to.x * dir.x + to.y * dir.y + to.z * dir.z;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best) {
      const to = norm(sub(center(best), pos));
      dir = norm({ x: dir.x * 0.8 + to.x * 0.2, y: dir.y * 0.8 + to.y * 0.2, z: dir.z * 0.8 + to.z * 0.2 });
    }
    pos = add(pos, mul(dir, 1.15));
    for (let s = 0; s < 3; s++) {
      const q = add(pos, mul(dir, -s * 0.38));
      spark(dim, q, s % 2 ? COLORS.arcane : COLORS.lilac, { x: rand(-0.1, 0.1), y: rand(-0.1, 0.1), z: rand(-0.1, 0.1) });
    }
    if (Math.random() < 0.35) puff(dim, 'minecraft:endrod', pos);
    const blocked = !passable(dim, pos);
    for (const e of livingNear(dim, pos, 1.25, [p])) {
      if (hitSet.has(e.id)) continue;
      hitSet.add(e.id);
      hurt(e, 5, p, 'magic');
      push(e, flat(dir), 0.35, 0.2);
      burst(dim, pos, COLORS.arcane, 12, 0.9);
      sfx(dim, 'mob.shulker.bullet.hit', pos, 0.9, 1.5);
      return false;
    }
    if (blocked) {
      burst(dim, pos, COLORS.arcane, 10, 0.8);
      sfx(dim, 'random.glass', pos, 0.4, 1.8);
      return false;
    }
    return true;
  });
}

function arcaneMissiles(p) {
  [-9, 0, 9].forEach((deg, i) => later(() => { if (valid(p)) launchMissile(p, deg); }, i * 3));
}

// ================================================================ Shadowfang: Shadow Step
const shadowUntil = new Map();   // player id -> tick until the next hit is empowered

function shadowStep(p) {
  const dim = p.dimension;
  const origin = { x: p.location.x, y: p.location.y, z: p.location.z };
  const dir = aim(p);
  let last = origin;
  let travelled = 0;
  for (let s = 0.5; s <= 10; s += 0.5) {
    const c = add(origin, mul(dir, s));
    if (!passable(dim, c) || !passable(dim, { x: c.x, y: c.y + 1, z: c.z })) break;
    last = c;
    travelled = s;
  }
  burst(dim, add(origin, { x: 0, y: 1, z: 0 }), COLORS.shadow, 16, 0.8);
  sfx(dim, 'mob.endermen.portal', origin, 0.9, 1.3);
  if (travelled < 1.5) return;                       // blocked: the spell fizzles
  const struck = new Set();
  for (let s = 0; s <= travelled; s += 1) {         // slash everything the dash passes through
    const c = add(origin, mul(dir, s));
    spark(dim, add(c, { x: 0, y: 1, z: 0 }), COLORS.shadow, { x: 0, y: 0.2, z: 0 });
    puff(dim, 'minecraft:basic_smoke_particle', add(c, { x: 0, y: 0.8, z: 0 }));
    for (const e of livingNear(dim, add(c, { x: 0, y: 1, z: 0 }), 1.6, [p])) {
      if (struck.has(e.id)) continue;
      struck.add(e.id);
      hurt(e, 6, p, 'magic');
      effect(e, 'slowness', 40, 1);
      burst(dim, center(e), COLORS.shadow, 10, 0.8);
    }
  }
  try {
    p.teleport(last, { dimension: dim, keepVelocity: false });
  } catch (err) { return; }
  effect(p, 'speed', 40, 1);
  effect(p, 'slow_falling', 50, 0);
  burst(dim, add(last, { x: 0, y: 1, z: 0 }), COLORS.shadow, 18, 0.9);
  sfx(dim, 'mob.endermen.portal', last, 0.9, 1.0);
  shadowUntil.set(p.id, system.currentTick + 70);
}

// ================================================================ Earthshaker: Seismic Slam
function seismicSlam(p) {
  const dim = p.dimension;
  const dir = flat(aim(p));
  const f = add(p.location, mul(dir, 2.2));
  const c = { x: f.x, y: p.location.y + 0.1, z: f.z };
  sfx(dim, 'mace.heavy_smash_ground', c, 2.0, 0.9);
  sfx(dim, 'dig.stone', c, 1.5, 0.6);
  sfx(dim, 'random.anvil_land', c, 0.6, 0.5);
  puff(dim, 'minecraft:smash_ground_particle', c);
  puff(dim, 'minecraft:smash_ground_particle_center', c);
  const hit = new Set();
  runSteps(8, (n) => {
    const r = 0.8 + n * 0.75;
    const pts = Math.min(56, Math.floor(r * 8) + 10);
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2;
      const q = { x: c.x + Math.cos(a) * r, y: c.y, z: c.z + Math.sin(a) * r };
      spark(dim, q, COLORS.amber, { x: 0, y: rand(0.2, 0.7), z: 0 });
      if (k % 3 === 0) spark(dim, q, COLORS.dust, { x: 0, y: rand(0.5, 1.1), z: 0 }, 'minecraft:falling_dust');
      if (k % 6 === 0) puff(dim, 'minecraft:dust_plume', q);
    }
    for (const e of livingNear(dim, c, r + 1.2, [p])) {
      if (hit.has(e.id) || dist2d(c, e.location) > r + 1.0) continue;
      hit.add(e.id);
      const d = dist2d(c, e.location);
      hurt(e, d < 2.5 ? 10 : 6, p, 'entityAttack');
      const out = flat(sub(e.location, c));
      push(e, len(out) > 0.01 ? out : dir, 1.1, 0.95);
      burst(dim, center(e), COLORS.dust, 8, 0.8);
    }
    return true;
  });
}

// ================================================================ Soul Reaper: Soul Harvest
function soulHarvest(p) {
  const dim = p.dimension;
  const here = center(p);
  sfx(dim, 'particle.soul_escape', here, 1.4, 0.8);
  sfx(dim, 'mob.vex.charge', here, 0.9, 0.7);
  let healed = 0;
  for (const e of livingNear(dim, here, 9, [p]).slice(0, 12)) {
    hurt(e, 5, p, 'wither');
    effect(e, 'slowness', 40, 1);
    const toP = flat(sub(here, e.location));
    push(e, toP, 1.7, 0.35);                       // pull the target towards the reaper
    const a = center(e);
    const seg = sub(here, a);
    for (let s = 0; s <= 9; s++) {
      const q = add(a, mul(seg, s / 9));
      spark(dim, q, COLORS.soul, { x: 0, y: 0.3, z: 0 });
      if (s % 3 === 0) puff(dim, 'minecraft:soul_particle', q);
    }
    if (healed < 8) {
      heal(p, 2);
      healed += 2;
    }
  }
  burst(dim, here, COLORS.soul, 22, 1.2);
  if (healed > 0) sfx(dim, 'random.orb', here, 0.9, 0.7);
}

// ================================================================ table
export const WEAPONS = {
  'mw:flamebrand': {
    name: 'Flame Wave', color: '§6', delay: 10, wear: 3, fire: flameWave,
    begin: (p) => sfx(p.dimension, 'fire.ignite', p.location, 1.0, 0.7),
    hint: 'Tap to unleash a wave of fire. Hits set enemies ablaze.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.fire, { x: 0, y: 0.5, z: 0 });
      if (Math.random() < 0.5) puff(dim, 'minecraft:basic_flame_particle', loc);
    },
    onHit: (dim, a, v) => {
      ignite(v, 6);
      burst(dim, center(v), COLORS.fire, 8, 0.7);
      sfx(dim, 'fire.ignite', v.location, 0.7, 1.2);
    },
  },
  'mw:frostbite': {
    name: 'Frost Nova', color: '§b', delay: 14, wear: 4, fire: frostNova,
    begin: (p) => sfx(p.dimension, 'beacon.power', p.location, 0.8, 1.6),
    hint: 'Tap to plunge the blade and freeze everything nearby.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.frost, { x: 0, y: -0.2, z: 0 });
      if (Math.random() < 0.4) puff(dim, 'minecraft:snowflake_particle', loc);
    },
    onHit: (dim, a, v) => {
      effect(v, 'slowness', 70, 1);
      burst(dim, center(v), COLORS.frost, 8, 0.6);
      sfx(dim, 'random.glass', v.location, 0.4, 1.9);
    },
  },
  'mw:storm_staff': {
    name: 'Thunder Strike', color: '§9', delay: 13, wear: 4, fire: thunderStrike,
    begin: (p) => {
      sfx(p.dimension, 'mob.evocation_illager.prepare_attack', p.location, 0.9, 1.4);
      sfx(p.dimension, 'beacon.activate', p.location, 0.6, 1.8);
    },
    hint: 'Aim and tap to call lightning down on your target.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.storm, { x: rand(-0.3, 0.3), y: rand(0, 0.4), z: rand(-0.3, 0.3) });
      if (Math.random() < 0.3) puff(dim, 'minecraft:electric_spark_particle', loc);
    },
    onHit: (dim, a, v) => {
      for (const o of livingNear(dim, center(v), 4, [a, v]).slice(0, 1)) {
        hurt(o, 2, a, 'lightning');
        burst(dim, center(o), COLORS.bolt, 6, 0.7, 'minecraft:electric_spark_particle');
      }
      burst(dim, center(v), COLORS.storm, 6, 0.7);
    },
  },
  'mw:arcane_wand': {
    name: 'Arcane Missiles', color: '§d', delay: 6, wear: 1, fire: arcaneMissiles,
    begin: (p) => sfx(p.dimension, 'mob.evocation_illager.cast_spell', p.location, 0.8, 1.5),
    hint: 'Tap to fire three homing arcane bolts.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.arcane, { x: rand(-0.3, 0.3), y: rand(0, 0.5), z: rand(-0.3, 0.3) });
      if (Math.random() < 0.25) puff(dim, 'minecraft:endrod', loc);
    },
    onHit: (dim, a, v) => burst(dim, center(v), COLORS.arcane, 6, 0.6),
  },
  'mw:shadow_dagger': {
    name: 'Shadow Step', color: '§5', delay: 5, wear: 2, fire: shadowStep,
    begin: (p) => sfx(p.dimension, 'mob.endermen.stare', p.location, 0.6, 1.8),
    hint: 'Tap to blink forward, slashing through enemies. Strike from behind for bonus damage.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.shadow, { x: 0, y: -0.15, z: 0 });
      if (Math.random() < 0.3) puff(dim, 'minecraft:basic_smoke_particle', loc);
    },
    onHit: (dim, a, v) => {
      let bonus = 0;
      const vd = norm(v.getViewDirection());
      const toV = norm({ x: v.location.x - a.location.x, y: 0, z: v.location.z - a.location.z });
      if (vd.x * toV.x + vd.z * toV.z > 0.3) bonus += 5;              // backstab: the target faces away
      if ((shadowUntil.get(a.id) || 0) > system.currentTick) {         // empowered by Shadow Step
        bonus += 4;
        shadowUntil.delete(a.id);
      }
      if (bonus > 0) {
        hurt(v, bonus, a, 'magic');
        burst(dim, center(v), COLORS.shadow, 14, 0.9);
        sfx(dim, 'random.bowhit', v.location, 0.8, 0.8);
      }
    },
  },
  'mw:earth_hammer': {
    name: 'Seismic Slam', color: '§6', delay: 17, wear: 5, fire: seismicSlam,
    begin: (p) => sfx(p.dimension, 'dig.stone', p.location, 0.8, 0.5),
    hint: 'Tap to smash the ground and launch nearby enemies.',
    ambient: (dim, loc) => {
      if (Math.random() < 0.5) spark(dim, loc, COLORS.amber, { x: 0, y: 0.15, z: 0 });
    },
    onHit: (dim, a, v) => {
      const out = flat(sub(v.location, a.location));
      push(v, out, 2.0, 0.55);
      burst(dim, center(v), COLORS.dust, 8, 0.7);
      sfx(dim, 'dig.stone', v.location, 0.9, 0.7);
    },
  },
  'mw:soul_scythe': {
    name: 'Soul Harvest', color: '§a', delay: 15, wear: 5, fire: soulHarvest,
    begin: (p) => sfx(p.dimension, 'mob.vex.charge', p.location, 0.7, 0.6),
    hint: 'Tap to drag nearby souls to you and drain their life.',
    ambient: (dim, loc) => {
      spark(dim, loc, COLORS.soul, { x: 0, y: 0.45, z: 0 });
      if (Math.random() < 0.3) puff(dim, 'minecraft:soul_particle', loc);
    },
    onHit: (dim, a, v) => {                                           // sweeping reap + a little life steal
      for (const o of livingNear(dim, center(v), 3, [a, v]).slice(0, 3)) {
        hurt(o, 4, a, 'wither');
        burst(dim, center(o), COLORS.soul, 6, 0.6);
      }
      heal(a, 1);
      burst(dim, center(v), COLORS.soul, 8, 0.7);
    },
  },
};
