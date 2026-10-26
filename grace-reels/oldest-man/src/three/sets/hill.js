// 'hill' set: night on a low hill above the plain. Old Methuselah sits on a rock beside his oil lamp (it burns lower
// through the story and dies on "died"); far below, the finished ark under gathering storm clouds. Shots S1, S2, S8
// (gold numbers -> the 969 slam), S9 (lamp macro, the giant raindrop on dry cracked ground), S10 (the empty seat, the
// cane against the rock, first rain) and LOOP. Layout constants live in src/cams/hill.js (HILL).
import * as THREE from 'three';
import { makeTerrain, srgb, mixc, makeStone, makeHalfBuriedRock, scatterGrass, scatterPebbles, makeBush, makeBevelBox } from '../kit.js';
import { makeOilLamp } from '../lamp.js';
import { makeMotes } from '../fx.js';
import { makeGoldNumber, convergeU, slamCurve } from '../gold.js';
import { makeGiantDrop, makeCrackedGround, wetten, rainRamp } from '../rain.js';
import { MOODS, merge, blend, resolve } from '../moods.js';
import { Person, Poses } from '../rig.js';
import { METHUSELAH_OLD } from '../characters/cast.js';
import { buildArk } from '../arkmodel.js';
import { fbm, clamp, smooth, invLerp, lerp, hash01 } from '../../lib/util.js';
import { HILL } from '../../cams/hill.js';

// terrain: a flat-topped knoll (seat + lamp) that falls away behind to the plain where the ark stands
export function heightAt(x, z) {
  const r = Math.hypot(x - 0.4, z - 0.3);
  const top = smooth(invLerp(1.6, 5, r));
  const fall = 7.6 * smooth(invLerp(-4, -52, z + 0.08 * x));
  const side = 0.6 * smooth(invLerp(6, 26, Math.abs(x)));
  return top * (0.32 * fbm(x * 0.09, z * 0.09, 3, 4) + 0.06 * fbm(x * 0.6, z * 0.6, 2, 7)) - fall - side + 0.25 * fbm(x * 0.02, z * 0.02, 2, 9) * smooth(invLerp(-30, -70, z));
}

function makeCane() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#6b4a2e', flatShading: true });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 1.0, 7), mat); shaft.position.y = 0.5; shaft.castShadow = true; g.add(shaft);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.017, 6, 10, Math.PI), mat); hook.position.set(0.06, 1.0, 0); hook.castShadow = true; g.add(hook);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), mat); knot.position.set(0, 0.62, 0); g.add(knot);
  return g;
}

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev;
  const g = new THREE.Group();
  const H = heightAt;

  // ground: dark night grass, a worn dirt patch around the seat, dry cracked earth in front of the lamp
  const terr = makeTerrain({ size: 900, seg: 200, height: H, color: (x, z) => {
    const n = clamp(0.5 + fbm(x * 0.18, z * 0.18, 3, 9) * 1.3), r = Math.hypot(x - 0.4, z - 0.3);
    let c = mixc(srgb('#4f5a36'), srgb('#6c6842'), n);
    c = mixc(c, srgb('#6e5c42'), (1 - smooth(invLerp(0.8, 2.8, r))) * 0.85);
    return c;
  } });
  wetten(terr.material, { patch: 0.4, scale: 0.4 }); g.add(terr);
  const cracked = makeCrackedGround({ size: 1.1, cell: 0.11, seed: 7, color: '#7d634a' }); cracked.position.set(HILL.drop[0], 0.0, HILL.drop[2] - 0.1); g.add(cracked);

  // rocks: the seat, the lamp stone, scattered stones; grass tufts, a couple of bushes, pebbles
  const seat = makeStone(0.42, { seed: 3, color: '#7b7366', sink: 0.25 }); seat.position.set(HILL.seat[0], 0.02, HILL.seat[2]); seat.scale.set(1.2, 0.95, 1); g.add(seat);
  const ls = makeStone(0.22, { seed: 8, color: '#857b6c', sink: 0.2 }); ls.position.set(...HILL.lampStone); ls.scale.set(1.3, 0.8, 1.1); g.add(ls);
  for (let i = 0; i < 14; i++) {
    const a = hash01(i, 1) * Math.PI * 2, rr = 1.8 + 5 * hash01(i, 2), x = 0.4 + Math.cos(a) * rr, z = 0.3 + Math.sin(a) * rr * 0.8;
    const r = (i % 3 ? makeStone : makeHalfBuriedRock)(0.12 + 0.28 * hash01(i, 3), { seed: 20 + i, color: ['#6d665c', '#77705f', '#625d55'][i % 3], sink: 0.3 });
    r.position.set(x, H(x, z), z); r.rotation.y = hash01(i, 4) * 6; g.add(r);
  }
  for (const [x, z, s, sd] of [[-2.6, -1.8, 0.7, 3], [3.2, -1.2, 0.55, 5], [-4.5, 1.5, 0.6, 9]]) { const b = makeBush(s, { seed: sd, colors: ['#3f4a2c', '#4a5532', '#38422a'] }); b.position.set(x, H(x, z), z); g.add(b); }
  const nearSeat = (x, z) => Math.hypot(x - 0.4, z - 0.4) < 1.25;
  g.add(scatterGrass(520, { area: [-9, -9, 9, 6], height: H, color: '#6e7a4a', skip: nearSeat, seed: 6, clump: 4, spread: 0.45, scale: [0.35, 0.75] }));
  g.add(scatterGrass(300, { area: [-30, -40, 30, -8], height: H, color: '#5e6a42', seed: 7, clump: 5, spread: 0.6, scale: [0.5, 1.0] }));
  g.add(scatterPebbles(240, { area: [-4, -3, 4, 3], height: H, seed: 4, colors: ['#6c6256', '#5e564c', '#7a6e60'] }));

  // the oil lamp on its stone
  const lamp = makeOilLamp({ scale: HILL.lampScale }); lamp.group.position.set(...HILL.lamp); lamp.group.rotation.y = HILL.lampRot; g.add(lamp.group);
  const lampOpts = (t) => (t > E.loopBack - 0.3 ? {} : { outT: E.lampOut });   // relit for the loop
  const level = (t) => E.lampLevel(t);

  // Methuselah (hero atlas) + his cane leaning on the rock once he is gone
  const meth = new Person({ ...METHUSELAH_OLD });
  meth.root.position.set(...HILL.seat); g.add(meth.root);
  const cane = makeCane(); cane.position.set(HILL.seat[0] + 0.42, 0.02, HILL.seat[2] + 0.22); cane.rotation.set(0.05, 0.6, -0.32); g.add(cane);

  // the finished ark far below on the plain
  const ark = buildArk(); ark.set({ progress: 1, door: 0.15 }); const arkG = ark.root;
  arkG.position.set(...HILL.ark); arkG.rotation.y = HILL.arkRot; g.add(arkG);
  for (const [x, z, s] of [[-52, -112, 1.0], [-18, -126, 1.3], [-60, -140, 1.2], [6, -150, 1.4]]) { const b = makeBush(s * 1.6, { seed: 30 + x, colors: ['#2f3a26', '#36412b'] }); b.position.set(x, H(x, z), z); g.add(b); }

  // fireflies + gold numbers + the giant raindrop
  const flies = makeMotes(26, 41); g.add(flies.group);
  const renderer = ctx.world.gl;
  const N = { n187: makeGoldNumber('187', { renderer, size: 0.28 }), n182: makeGoldNumber('182', { renderer, size: 0.28 }), n600: makeGoldNumber('600', { renderer, size: 0.28 }), n969: makeGoldNumber('969', { renderer, size: 0.45 }) };
  for (const n of Object.values(N)) g.add(n.group, n.fx);
  const drop = makeGiantDrop({ renderer, r: 0.045 }); g.add(drop.group);
  const _o = new THREE.Vector3();

  const isShot = (shot, ...ids) => ids.includes(shot.id);
  const flyStart = E.equals - 0.1;

  return {
    group: g, persons: [meth], heightAt: H,
    update(t, cam, shot) {
      const on = (ctx.B.hill.methuselahOn)(t);
      meth.root.visible = on; cane.visible = !on;
      if (on) {
        meth.setFacing(1);
        const P = Poses.sitOld(t, 969, 0.42, isShot(shot, 'S2') ? 0.25 : 0.45);
        meth.pose(P); meth.billboard(cam, 0.3); meth.autoOutline(cam);
      }
      lamp.set(t, level(t), cam, lampOpts(t));
      cracked.visible = isShot(shot, 'S9', 'S10');
      g.getWorldPosition(_o);
      flies.set(t, [_o.x + 0.5, _o.y + 0.9, _o.z - 1.0], [7, 1.6, 5], isShot(shot, 'S1', 'S2', 'LOOP') ? 1 : 0.35, [1.0, 0.82, 0.45], 0.02);

      // gold numbers (S8 only): rise behind the lamp one by one on line 9, converge on "equals", slam into 969
      const s8 = isShot(shot, 'S8');
      for (const k of ['n187', 'n182', 'n600']) {
        const n = N[k], age = t - E['sum' + k.slice(1)];
        if (!s8 || age < -0.3) { n.group.visible = false; n.quiet(); continue; }
        if (t < flyStart) n.rise(age, { pos: HILL.slots[k], t, groundY: H(HILL.slots[k][0], HILL.slots[k][2]) });
        else {
          const u = convergeU(t - E.slam, E.slam - flyStart);
          n.fly(u, [HILL.slots[k][0], HILL.slots[k][1] + 0.5 * 0.0, HILL.slots[k][2]], HILL.n969, { arc: 0.5, spin: 0.7, scaleTo: 0.55 });
          n.set(t, { halo: 0.5 * (1 - u) });
          if (u >= 0.999) n.group.visible = false;
        }
      }
      if (s8 && t >= E.slam - 0.05) N.n969.slam(t - E.slam, { pos: HILL.n969, t });
      else { N.n969.group.visible = false; N.n969.quiet(); }

      // the giant raindrop (S9): falls from ev.dropFall, splashes at ev.dropSplash
      if (isShot(shot, 'S9', 'S10')) {
        drop.group.visible = true;
        drop.set(t - E.dropFall, { fallAge: t - E.dropFall, fall: E.dropSplash - E.dropFall, from: [HILL.drop[0] + 0.02, 1.05, HILL.drop[2] - 0.02], to: HILL.drop, slow: 1 });
      } else drop.group.visible = false;
    },
    mood(t, shot) {
      const L = lamp.light(t, level(t), lampOpts(t));
      const night = merge(MOODS.nightLamp, {
        sky: { storm: 0.22, stormDark: '#10162a', stormLit: '#2c3a5e', stormAlt: 75, horizon: '#2e4272' },
        sunDir: [-0.35, 0.42, -0.84], sun: { color: '#9db4ea', intensity: 0.95 },
        hemi: { sky: '#3d5290', ground: '#2a2418', intensity: 0.62 },
        fog: { color: '#22305a', density: 0.004, near: 40, far: 420 },
        char: '#9aa6cc',
        point: L,
        post: { tilt: 0.18, exposure: 1.2 },
      });
      if (isShot(shot, 'S2')) return merge(night, { post: { dof: 0.85, focusRange: 0.35, tilt: 0, vignette: 0.6 } });
      if (isShot(shot, 'S8')) {
        const S = slamCurve(t - E.slam);
        return merge(night, { char: '#7c86a8', post: { flash: (S.flash || 0) * 0.35, bloom: 0.95 + 0.6 * (S.glow || 0), dof: 0.35, focusRange: 2.2, ao: 0.6 } });
      }
      if (isShot(shot, 'S9')) {
        // the flame dies: the warm key fades and a cold, dim night takes over; the drop falls in near silence
        const k = smooth(invLerp(E.lampOut, E.lampOut + 1.4, t));
        const cold = merge(MOODS.coldBlue, {
          sky: { top: '#141c2c', horizon: '#3a4a64', bottom: '#0f141c', clouds: 0.5, storm: 0.6 }, sun: { intensity: 1.1, color: '#a9bcd8' }, sunDir: [-0.35, 0.55, -0.75],
          hemi: { sky: '#5a6a88', ground: '#22242a', intensity: 0.85 }, fog: { color: '#1e2633', density: 0.006 },
          char: '#7d889c', point: L, post: { exposure: 1.45, dof: 0.5, focusRange: 0.4, tilt: 0, vignette: 0.6, bloom: 0.6 },
        });
        return blend(resolve(merge(night, { post: { dof: 0.45, focusRange: 0.5, tilt: 0, exposure: 0.72, bloom: 0.55, bloomThreshold: 1.0 } })), resolve(cold), k);
      }
      if (isShot(shot, 'S10')) {
        const lt = t - shot.t0;
        return merge(MOODS.coldBlue, {
          sky: { storm: 0.75, clouds: 0.3, top: '#1c2433', horizon: '#46546a', bottom: '#151a22' }, point: null,
          sun: { intensity: 0.75 }, hemi: { intensity: 0.6 }, fog: { density: 0.005, color: '#3a4656' },
          rain: { k: rainRamp(lt, -0.2, 2.5, { drizzle: 0.3, peak: 0.42 }), sheets: 0.25, splash: 0.8, wind: [1.2, 0.3] },
          wet: smooth(invLerp(-0.3, 4.5, lt)) * 0.85,
          post: { dof: 0.3, focusRange: 2.5, ao: 0.5, tilt: 0.15, exposure: 1.35, sat: 0.8 },
        });
      }
      return night;   // S1, LOOP
    },
  };
}
