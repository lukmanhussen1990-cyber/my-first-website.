// 'enoch' set (S3): soft golden morning. A worn path through dry fields beside mud-brick houses; a soft beam of
// light stands beside the path (God is shown only as light). Enoch walks the path into the light and is gone on
// "took" — he brightens into the light and is not there; his footprints simply stop. Young Methuselah watches
// from a doorway in wonder. Layout + Enoch's blocking live in src/cams/enoch.js.
import * as THREE from 'three';
import {
  makeTerrain, srgb, mixc, makePalm, makeTree, makeMudHouse, makeHalfBuriedRock, scatterGrass, scatterPebbles,
  scatterPots, scatterBaskets, scatterFirewood, pathWeight, makePathRibbon, makeFootprints, makeRug, makeBush, makeTent,
} from '../kit.js';
import { makeBeam } from '../beam.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, expr } from '../rig.js';
import { ENOCH as ENOCH_LOOK, METHUSELAH_YOUNG } from '../characters/cast.js';
import { makeAnimal } from '../animals.js';
import { fbm, clamp, smooth, invLerp, hash01 } from '../../lib/util.js';
import { ENOCH, along } from '../../cams/enoch.js';

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const B = ctx.B.enoch;
  const g = new THREE.Group();
  const path = ENOCH.path;
  const pw = pathWeight(path, 1.5, { seed: 4 });
  const H = (x, z) => 0.6 * fbm(x * 0.035, z * 0.035, 3, 21) * smooth(invLerp(6, 20, Math.hypot(x, z))) + 0.08 * fbm(x * 0.4, z * 0.4, 2, 5) - pw(x, z) * 0.03;
  g.add(makeTerrain({ size: 700, seg: 220, height: H, color: (x, z, y) => {
    const n = clamp(0.5 + fbm(x * 0.09, z * 0.09, 3, 7) * 1.3), m = clamp(0.5 + fbm(x * 0.3, z * 0.3, 2, 19));
    let c = mixc(srgb('#c9a46a'), srgb('#9c9552'), smooth(invLerp(0.4, 0.85, n)) * 0.8);   // warm sand -> olive field patches
    c = mixc(c, srgb('#b8864e'), m * 0.25);
    c = mixc(c, srgb('#e0c38e'), pw(x, z) * 0.85);                                          // the worn path
    return c.map((v) => v * (0.94 + 0.03 * y));
  } }));
  g.add(makePathRibbon(path, { width: 1.25, height: H, color: '#e2c994', edge: '#cfae78', opacity: 0.55 }));

  // houses (the near one has young Methuselah in its doorway), a tent, palms, trees, bushes
  const occupied = [];
  const house = makeMudHouse({ w: 4.2, d: 3.6, h: 2.9, seed: 5, awning: ['#2f4a6a', '#e3d2a8'], curtain: '#7a2e3a', roofClutter: true });
  house.position.set(ENOCH.house.pos[0], H(...ENOCH.house.pos), ENOCH.house.pos[1]); house.rotation.y = ENOCH.house.rotY; g.add(house); occupied.push([...ENOCH.house.pos, 3.2]);
  const h2 = makeMudHouse({ w: 3.4, d: 3, h: 2.5, seed: 9, dome: true, ladder: false, curtain: '#2f5a5a' }); h2.position.set(-12.5, H(-12.5, -6.5), -6.5); h2.rotation.y = 0.2; g.add(h2); occupied.push([-12.5, -6.5, 2.6]);
  const h3 = makeMudHouse({ w: 3.8, d: 3.2, h: 2.7, seed: 11, roofClutter: ['#c06a2a', '#2f4a6a'] }); h3.position.set(-10.5, H(-10.5, -13), -13); h3.rotation.y = 0.5; g.add(h3); occupied.push([-10.5, -13, 3]);
  const tent = makeTent({ seed: 3, colors: ['#8a3a2a', '#e0cfa8'], stripes: 9 }); tent.position.set(-15, H(-15, 1), 1); tent.rotation.y = 0.9; g.add(tent); occupied.push([-15, 1, 2.6]);
  for (const [x, z, s, sd] of [[-3.2, -6.5, 1.15, 3], [7.5, -9, 1.3, 7], [-10, 2.5, 1.0, 11], [9.5, 1.5, 0.9, 13], [-6, -11, 1.25, 17]]) { const p = makePalm(s, sd); p.position.set(x, H(x, z), z); g.add(p); occupied.push([x, z, 0.9]); }
  for (const [x, z, s, sd] of [[6.5, -15, 1.2, 21], [-17, -8, 1.1, 23]]) { const tr = makeTree(s, sd); tr.position.set(x, H(x, z), z); g.add(tr); occupied.push([x, z, 1.6]); }
  for (let i = 0; i < 10; i++) {
    const x = -14 + 24 * hash01(i, 81), z = -14 + 22 * hash01(i, 82);
    if (pw(x, z) > 0.1 || occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r + 0.6) || Math.hypot(x - ENOCH.beam[0], z - ENOCH.beam[1]) < 3) continue;
    const b = makeBush(0.5 + 0.35 * hash01(i, 83), { seed: 90 + i }); b.position.set(x, H(x, z), z); g.add(b); occupied.push([x, z, 0.7]);
  }
  for (let i = 0; i < 8; i++) { const x = -12 + i * 3.4, z = -11 + (i % 3) * 1.6; if (occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r)) continue; const r = makeHalfBuriedRock(0.4 + 0.4 * hash01(i, 3), { seed: 40 + i, color: '#a08668' }); r.position.set(x, H(x, z), z); g.add(r); }
  const rug = makeRug(1.6, 1.0, { colors: ['#7a2e3a', '#d9b46a', '#2f4a6a'], seed: 2 }); rug.position.set(-4.4, H(-4.4, -0.6), -0.6); rug.rotation.y = 0.35; g.add(rug);
  const skip = (x, z) => pw(x, z) > 0.18 || occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r) || Math.hypot(x - ENOCH.beam[0], z - ENOCH.beam[1]) < 2.4;
  g.add(scatterGrass(700, { area: [-18, -16, 14, 12], height: H, skip, seed: 6, clump: 5, spread: 0.4, colors: ['#b8ab62', '#a9a058', '#c2b06a', '#9a9a50'] }));
  g.add(scatterPebbles(320, { area: [-16, -12, 12, 10], height: H, seed: 4 }));
  g.add(scatterPots(6, { points: [[-5.2, -1.0], [-4.8, -1.4], [-8.7, -0.9], [-9.1, -1.4], [-5.6, -1.7], [-11.2, -4.4]], height: H }));
  g.add(scatterBaskets(4, { points: [[-5.9, -0.8], [-8.2, -1.2], [-12, -3.8], [-9.4, -10.6]], height: H }));
  g.add(scatterFirewood(2, { points: [[-8.8, -5.6], [-11.6, -9.6]], height: H }));
  for (let i = 0; i < 4; i++) { const A = makeAnimal('sheep', 70 + i); const x = 5.5 + (i % 2) * 1.2, z = 3.5 + Math.floor(i / 2) * 1.1; A.group.position.set(x, H(x, z), z); A.group.rotation.y = hash01(i, 6) * 6; A.group.scale.setScalar(0.85); g.add(A.group); }

  // footprints along the whole path: shown up to where Enoch is; they stop in the light
  const prints = makeFootprints(path, { height: H, color: '#9a7650' }); g.add(prints);
  const beam = makeBeam({ r0: 0.95, r1: 1.7, h: 30 }); beam.group.position.set(ENOCH.beam[0], H(...ENOCH.beam), ENOCH.beam[1]); g.add(beam.group);

  const enoch = new Person({ ...ENOCH_LOOK }); g.add(enoch.root);
  const young = new Person({ ...METHUSELAH_YOUNG }); g.add(young.root);
  const doorL = house.userData.door ? house.userData.door.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), house.rotation.y).add(house.position) : new THREE.Vector3(-5.2, 0, -1.6);
  const P0 = path[0];

  return {
    group: g, persons: [enoch, young], heightAt: H,
    update(t, cam, shot) {
      const s = B.enochS(t), [x, z, dir] = along(s);
      enoch.root.visible = !B.gone(t);
      enoch.root.position.set(x, H(x, z), z);
      enoch.setFacing(dir);
      const glow = B.glow(t);
      if (B.walking(t)) enoch.pose(Poses.walk(t, 365, 0.9, 0.95));
      else { const P = Poses.lookUp(t, 365, smooth(invLerp(E.enochGone - 0.35, E.enochGone - 0.1, t))); expr(P, 'peace', 1); enoch.pose(P); }
      enoch.uni.uGlow.value = glow;
      // prints up to his feet (none ahead of him); after he is gone they simply stop at the light
      const n = prints.userData.prints.findIndex((Q) => Math.hypot(Q.x - P0[0], Q.z - P0[1]) > s - 0.35);
      prints.userData.setShown(n < 0 ? prints.userData.prints.length : n);
      // young Methuselah in the doorway: watching him go, wonder as the light takes him
      young.root.position.set(doorL.x + 0.5, H(doorL.x + 0.5, doorL.z + 0.4), doorL.z + 0.4);
      young.setFacing(1);
      const w = smooth(invLerp(E.enochGone - 0.8, E.enochGone + 0.3, t));
      const Py = Poses.idle(t, 22); expr(Py, w > 0.5 ? 'wonder' : 'kind', w > 0.5 ? w : 0.6); Py.lookY = 0.2 * w; young.pose(Py);
      for (const p of [enoch, young]) if (p.root.visible) { p.billboard(cam, 0.3); p.autoOutline(cam); }
      // the light swells as it takes him
      beam.set(t, 0.75 + 0.7 * Math.sin(Math.PI * clamp(invLerp(E.enochGone - 0.6, E.enochGone + 0.9, t))));
    },
    mood(t) {
      const swell = Math.sin(Math.PI * clamp(invLerp(E.enochGone - 0.6, E.enochGone + 0.9, t)));
      return merge(MOODS.morningGold, { fog: { density: 0.003 }, post: { ao: 0.5, haze: 0.08, exposure: 0.86, bloom: 0.6 + 0.4 * swell,
        godrays: { strength: 0.75 + 0.35 * swell, pos: [ENOCH.beam[0], 24, ENOCH.beam[1]], radius: 0.12, decay: 0.972, density: 0.95, streaks: 0.65 } } });
    },
  };
}
