// S5 — "Hands that shed innocent blood." Told gently, with no violence: a vast field at dusk, two
// brothers; one walks away alone. A single red flower bends, wilts and lets two petals fall.
import * as THREE from 'three';
import { makeTerrain, makeMountains, makeOlive, makeGrass, makeWall, makeRock, srgb, mixc } from '../kit.js';
import { makeBirds, makeMotes } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, place, finish, kin } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, easeIn, easeOut, fbm, hash01, noise2 } from '../../lib/util.js';

export function buildField(ctx) {
  const { plan, B } = ctx; const O = SETS.field;
  const S5 = plan.shots.find((s) => s.id === 'S5a');
  const g = new THREE.Group();
  const height = (x, z) => 0.6 * fbm(x * 0.03, z * 0.03, 3, 2) * smooth(invLerp(4, 16, Math.hypot(x, z))) + 3.5 * smooth(invLerp(40, 120, -z)) * (0.6 + 0.4 * fbm(x * 0.02, z * 0.02, 2, 6)) + 1.8 * Math.exp(-((x + 6) ** 2 + (z + 9) ** 2) / 40);
  const gA = srgb('#8a7a3e'), gB = srgb('#6a6430'), gC = srgb('#b49a52');
  g.add(makeTerrain({ size: 500, seg: 170, height, color: (x, z, y) => { const n = fbm(x * 0.08, z * 0.08, 3, 3); return mixc(mixc(gB, gA, smooth(0.5 + n)), gC, smooth(invLerp(0.2, 0.6, n))); } }));
  g.add(makeMountains({ seed: 3, n: 20, r0: 170, r1: 280, h0: 10, h1: 30, color: '#6a4a52' }));
  g.add(makeGrass(5200, [-22, -26, 16, 12], 4, '#a08a48', 0.62, height, (x, z) => Math.hypot(x - 0.75, z - 0.42) < 0.35));
  const olive = makeOlive(1.5, 5); olive.position.set(-6, height(-6, -9), -9); g.add(olive);
  const fw = makeWall({ len: 16, h: 0.7, t: 0.5, color: '#9a8a74', seed: 11 }); fw.position.set(4, 0, -6.5); fw.rotation.y = 0.35; g.add(fw);
  for (let i = 0; i < 9; i++) { const r = makeRock(0.2 + 0.3 * hash01(i, 1), i + 3, '#8a7a66'); const x = -10 + 20 * hash01(i, 2), z = -12 + 14 * hash01(i, 3); r.position.set(x, height(x, z), z); g.add(r); }

  // ---- the red flower: segmented stem (bends from the base), two leaves, six petals ----
  const flower = new THREE.Group(); g.add(flower);
  const stemSegs = []; let parent = flower;
  const stemMat = matte('#4f6a2a');
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group(); s.position.y = i === 0 ? 0 : 0.085; parent.add(s);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.085, 5).translate(0, 0.0425, 0), stemMat); m.castShadow = true; s.add(m);
    stemSegs.push(s); parent = s;
  }
  const leafGeo = new THREE.SphereGeometry(1, 8, 4).scale(0.07, 0.012, 0.028).translate(0.06, 0, 0);
  const leaves = [0, 1].map((k) => { const l = new THREE.Mesh(leafGeo, matte('#5a7a30')); l.position.y = 0.04; l.rotation.set(0, k * Math.PI + 0.6, 0.5); stemSegs[1 + k].add(l); return l; });
  const head = new THREE.Group(); head.position.y = 0.085; parent.add(head);
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), matte('#2a1a14')); head.add(center);
  const petalGeo = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.05, 0.035, 0.03).translate(0.045, 0, 0);
  const petalMats = Array.from({ length: 6 }, () => new THREE.MeshLambertMaterial({ color: '#c8231e', side: THREE.DoubleSide }));
  const petals = petalMats.map((m, i) => { const p = new THREE.Group(); p.rotation.y = i / 6 * Math.PI * 2; head.add(p); const mesh = new THREE.Mesh(petalGeo, m); mesh.castShadow = true; p.add(mesh); p.userData.mesh = mesh; return p; });
  const fallers = [1, 4]; // these two petals detach and drift down
  const loose = fallers.map((i) => { const m = new THREE.Mesh(petalGeo, petalMats[i]); m.visible = false; g.add(m); return m; });

  const A = person(g, { seed: 51, height: 1.78, skin: SKIN[3], hair: 'curly', hairColor: HAIR.dark, beard: 'short', outfit: 'tunic', cloth: CLOTH.brick, belt: '#c9a36a', legs: SKIN[3] });
  const Bb = person(g, { seed: 52, height: 1.72, skin: SKIN[4], hair: 'short', hairColor: HAIR.brown, outfit: 'tunic', cloth: CLOTH.cream, trim: CLOTH.sky, belt: '#8a6a4a', legs: SKIN[4] });
  const persons = [A, Bb];
  const birds = makeBirds(6, 9, '#2a1e22'); g.add(birds.group);
  const motes = makeMotes(140, 31); g.add(motes.group);
  const _p = new THREE.Vector3();
  const sun = [-0.78, 0.075, -0.62];

  return {
    group: g, persons,
    update(t, cam) {
      // brother A walks away alone, head low; brother B stays, looking down at the flower
      const ax = (tt) => B.brotherA(tt)[0];
      const { v } = kin(ax, t);
      const moving = Math.abs(v) > 0.05;
      const PA = moving ? Poses.walk(t, 51, 0.95, 0.85) : Poses.idle(t, 51);
      expr(PA, 'sad', 1); PA.headTilt = -0.16; A.secondary(PA, { vx: Math.abs(v), t });
      A.setFacing(-1); A.pose(PA); place(A, O, B.brotherA(t));
      const PB = expr(Poses.idle(t, 52), 'sad', 1); PB.headTilt = -0.2; PB.aF = [0.12, 0.25]; PB.aB = [-0.02, 0.2];
      Bb.setFacing(-1); Bb.pose(PB); place(Bb, O, B.brotherB());
      // flower: a breeze, then it bends, droops and fades
      const f = B.flower(); flower.position.set(f[0] - O[0], height(f[0] - O[0], f[2] - O[2]), f[2] - O[2]);
      const w = smooth(invLerp(B.wiltT, B.wiltT + 1.5, t));
      const breeze = 0.05 * Math.sin(t * 1.6) + 0.03 * noise2(t * 0.9, 2, 5);
      stemSegs.forEach((s, i) => { s.rotation.z = breeze * (0.3 + i * 0.15) + w * (0.05 + i * 0.09); s.rotation.x = 0.02 * Math.sin(t * 1.3 + i); });
      head.rotation.z = w * 0.9;
      leaves.forEach((l, k) => { l.rotation.z = 0.5 - w * 0.9; });
      const col = new THREE.Color('#c8231e').lerp(new THREE.Color('#5a1a14'), w * 0.75);
      petals.forEach((p, i) => { p.rotation.z = -0.1 - w * (0.9 + 0.2 * hash01(i, 3)); petalMats[i].color.copy(col); p.visible = !(fallers.includes(i) && t > B.wiltT + 0.9 + fallers.indexOf(i) * 0.35); });
      fallers.forEach((i, k) => {
        const t0 = B.wiltT + 0.9 + k * 0.35, u = t - t0; const m = loose[k]; m.visible = u > 0;
        if (u <= 0) return;
        head.updateWorldMatrix(true, false);
        const p0 = head.getWorldPosition(_p).sub(g.position);
        const fall = Math.min(u, 2.4);
        m.position.set(p0.x + 0.12 * fall + 0.05 * Math.sin(u * 3 + k), Math.max(height(p0.x, p0.z) + 0.02, p0.y - 0.28 * fall), p0.z + 0.05 * Math.sin(u * 2.3 + k * 2));
        m.rotation.set(u * 2.1 + k, u * 1.3, Math.sin(u * 3) * 0.8);
      });
      birds.set(t, (i, tt) => { const x = 30 - (tt - 20) * (2.2 + 0.3 * hash01(i, 1)) - i * 1.4; return [x, 16 + i * 0.7 + Math.sin(tt + i) * 0.3, -40 - i * 2, Math.PI]; }, 1.4, 8);
      motes.set(t, [-1, 0.2, -1], [12, 3, 8], 0.55, [1.0, 0.65, 0.45], 0.03);
      finish(persons, cam);
    },
    mood() {
      return {
        sky: { top: '#3a3352', horizon: '#e27a4c', bottom: '#7a4a38', band: '#5a2410', sunGlow: '#ff8a4e', sunDisk: '#ffd2a0' },
        sunDir: sun, sun: { color: '#ff9a62', intensity: 2.6 },
        hemi: { sky: '#7a6a92', ground: '#5a3a2a', intensity: 0.95 },
        fog: { color: '#c9785a', near: 30, far: 230 }, char: '#f2cdb8', ao: 0.15, wind: 0.6,
        shadow: { size: 16 },
        post: { exposure: 0.98, bloom: 0.6, bloomThreshold: 0.82, haze: 0.18, hazeColor: '#e8946a', tint: '#fff0e6', lift: '#0e0608', sat: 0.86, contrast: 1.05, vignette: 0.6, dof: 0.6, focusRange: 1.2, tilt: 0.25, grain: 0.032 },
      };
    },
  };
}
