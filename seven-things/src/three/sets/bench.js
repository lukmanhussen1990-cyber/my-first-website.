// S6 — "An heart that deviseth wicked imaginations." A calm man on a bench in a quiet square; the
// camera pushes into his head and through: inside, a glowing outline of his head holds a small dark
// storm cloud with tiny lightning — sin starts in the mind.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeBench, makeWall, makeOlive, makeHouse, makeJar, texMat, paveTex } from '../kit.js';
import { makeSprites, makeBolt, makeMotes, puffTex } from '../fx.js';
import { matte } from '../materials.js';
import { makeAnimal } from '../animals.js';
import { SKIN, HAIR, CLOTH, Poses, expr, smoothClosed } from '../rig.js';
import { person, place, finish } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, hash01, noise2 } from '../../lib/util.js';

export function buildBench(ctx) {
  const { plan, B } = ctx; const O = SETS.bench;
  const g = new THREE.Group();
  const pave = paveTex().clone(); pave.needsUpdate = true; pave.repeat.set(8, 8);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), texMat('#b8ab98', pave, { flat: false })); ground.receiveShadow = true; g.add(ground);
  const bench = makeBench(2.1, '#9a8c78'); bench.position.set(0, 0, 0); g.add(bench);
  const wall = makeWall({ len: 9, h: 0.95, t: 0.45, color: '#b0a08a', seed: 21 }); wall.position.set(0.5, 0, -1.6); g.add(wall);
  const olive = makeOlive(1.3, 7); olive.position.set(-1.8, 0, -2.6); g.add(olive);
  const h1 = makeHouse({ w: 6, d: 5, h: 5.2, wall: '#d2c2a8', roofCol: '#9a8a74', windows: 3, seed: 22 }); h1.position.set(-3, 0, -9); g.add(h1);
  const h2 = makeHouse({ w: 5, d: 5, h: 4.0, wall: '#c8b496', roofCol: '#9a8a74', windows: 2, seed: 23, roof: 'dome' }); h2.position.set(4.5, 0, -10); g.add(h2);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6), matte('#2e2a26')); post.position.set(1.9, 1.6, -0.9); post.castShadow = true; g.add(post);
  const lampH = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.32, 6), matte('#3a3530')); lampH.position.set(1.9, 3.3, -0.9); g.add(lampH);
  for (const [x, z] of [[-1.5, -1.1], [2.6, -1.2]]) { const j = makeJar(1.1, '#a05c3a'); j.position.set(x, 0, z); g.add(j); }
  const doves = [];
  const man = person(g, { seed: 61, height: 1.76, skin: SKIN[3], hair: 'short', hairColor: HAIR.dark, beard: 'short', outfit: 'tunic', cloth: CLOTH.slate, belt: '#c9b28a', legs: '#5a5048' });
  const persons = [man];
  const S6a = plan.shots.find((s) => s.id === 'S6a');
  return {
    group: g, persons,
    update(t, cam) {
      const P = Poses.sit(t, 61, 0.48);
      P.aF = [0.62, 1.05]; P.aB = [0.45, 1.1];                   // hands resting on the knees
      const dark = smooth(invLerp(S6a.t1 - 0.9, S6a.t1 - 0.2, t));
      P.eye = Math.min(P.eye, lerp(1, 0.72, dark)); P.brow = lerp(0, 0.25, dark); P.look = lerp(0, 0.4, dark);
      man.setFacing(1); man.pose(P); place(man, O, B.benchMan());
      doves.forEach((d, i) => {
        const x = 0.9 + i * 0.45 + 0.08 * Math.sin(t * 0.7 + i), z = 0.75 + 0.3 * hash01(i, 3);
        d.group.position.set(x, 0.1, z); d.group.rotation.y = i % 2 ? Math.PI : 0.3;
        d.update(t, 0, { glide: true }); d.wings.forEach((w) => { w.g.rotation.x = w.s * 0.1; });
        if (d.head) d.head.rotation.z = -0.5 * Math.max(0, Math.sin(t * 3.2 + i * 1.7)) ** 6; // pecking
      });
      finish(persons, cam);
    },
    mood() {
      return {
        sky: { top: '#8aa0b8', horizon: '#e2d6c4', bottom: '#a89a86', sunGlow: '#f0d8b0' },
        sunDir: [-0.55, 0.62, 0.56], sun: { color: '#ffeedd', intensity: 2.4 },
        hemi: { sky: '#cfdcea', ground: '#8a7a68', intensity: 1.15 },
        fog: { color: '#d8d0c4', near: 25, far: 120 }, char: '#f4f0ea', ao: 0.18,
        shadow: { size: 6 },
        post: { exposure: 0.97, bloom: 0.4, bloomThreshold: 0.92, haze: 0.06, hazeColor: '#e8e0d4', tint: '#f6f8ff', sat: 0.92, contrast: 1.03, vignette: 0.5, dof: 0.6, focusRange: 1.4, tilt: 0, grain: 0.03 },
      };
    },
  };
}

// --- the mind: a glowing outline of his head, a small storm inside ---
const HEAD = [[-0.055, -0.05], [-0.13, 0.05], [-0.165, 0.17], [-0.12, 0.29], [-0.02, 0.335], [0.09, 0.305], [0.135, 0.235], [0.148, 0.19], [0.205, 0.142], [0.152, 0.118], [0.158, 0.085], [0.13, 0.042], [0.065, 0.012], [0.06, -0.05]];
export function buildMind(ctx) {
  const { plan } = ctx;
  const g = new THREE.Group();
  const C = [0.15, 2.3, 0];
  // head outline: profile + neck, as a glowing tube (open at the neck)
  const S = 6.6, cx = 0.02, cy = 0.15;
  const prof = smoothClosed(HEAD, 120).map(([x, y]) => new THREE.Vector3(C[0] + (x - cx) * S, C[1] + (y - cy) * S - 0.2, 0));
  const cut = prof.filter((p) => p.y > C[1] + (-0.045 - cy) * S - 0.2);
  const curve = new THREE.CatmullRomCurve3(cut, false);
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.82, 0.28), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.022, 6, false), glowMat); g.add(tube);
  const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 260, 0.09, 6, false), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.33, 0.12), fog: false, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(halo);
  const fillShape = new THREE.Shape(prof.map((p) => new THREE.Vector2(p.x, p.y)));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(fillShape), new THREE.MeshBasicMaterial({ color: '#2a2f52', transparent: true, opacity: 0.85, depthWrite: false, fog: false })); fill.position.z = -0.6; g.add(fill);
  // the storm cloud
  const cloud = new THREE.Group(); cloud.position.set(C[0] - 0.12, C[1] + 0.32, 0.2); cloud.scale.setScalar(0.62); g.add(cloud);
  const puffs = []; const cm = new THREE.MeshLambertMaterial({ color: '#5a6078', flatShading: true, emissive: new THREE.Color(0, 0, 0) });
  for (let i = 0; i < 11; i++) {
    const r = 0.22 + 0.16 * hash01(i, 1); const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cm);
    m.position.set((i - 5) * 0.12 + (hash01(i, 2) - 0.5) * 0.15, (hash01(i, 3) - 0.3) * 0.22 + (Math.abs(i - 5) < 3 ? 0.12 : 0), (hash01(i, 4) - 0.5) * 0.3);
    cloud.add(m); puffs.push(m);
  }
  const flashL = new THREE.PointLight('#b8c8ff', 0, 4, 2); flashL.position.set(0, -0.1, 0.4); cloud.add(flashL);
  const bolts = [0, 1, 2].map((i) => { const b = makeBolt(40 + i, 7); b.scale.setScalar(0.55); b.position.set(-0.35 + i * 0.35, -0.22, 0.25); cloud.add(b); return b; });
  const swirl = makeSprites(70, { tex: puffTex(), fog: false, order: 4 }); g.add(swirl.group);
  const sparks = makeSprites(120, { additive: true, fog: false, order: 6 }); g.add(sparks.group);
  const rain = makeSprites(60, { additive: true, fog: false, order: 6 }); g.add(rain.group);
  const flash = (t) => { // deterministic lightning: short double flickers
    let k = 0;
    for (let i = 0; i < 9; i++) { const t0 = 27.9 + i * 0.47 + 0.2 * hash01(i, 7); const u = t - t0; if (u > 0 && u < 0.16) k = Math.max(k, u < 0.05 ? 1 : u > 0.09 && u < 0.13 ? 0.7 : 0.15); }
    return k;
  };
  return {
    group: g, persons: [], flash,
    update(t) {
      const f = flash(t);
      cloud.rotation.y = 0.15 * Math.sin(t * 0.7); cloud.rotation.z = 0.04 * Math.sin(t * 1.3);
      puffs.forEach((m, i) => { const s = 1 + 0.07 * Math.sin(t * 2.2 + i * 1.3); m.scale.set(s, s * 0.85, s); });
      cm.emissive.setRGB(0.35 * f, 0.4 * f, 0.6 * f);
      flashL.intensity = 6 * f;
      bolts.forEach((b, i) => { b.visible = f > 0.5 && (Math.floor(t * 9) + i) % 3 !== 0; b.rotation.z = (hash01(Math.floor(t * 9), i) - 0.5) * 0.6; });
      const o = cloud.position;
      swirl.begin();
      for (let i = 0; i < 70; i++) { const a = t * (0.9 + 0.4 * hash01(i, 1)) + i * 0.9; const r = 0.75 + 0.35 * hash01(i, 2);
        swirl.add(o.x + Math.cos(a) * r, o.y - 0.05 + 0.25 * Math.sin(a * 1.3 + i), o.z + Math.sin(a) * r * 0.5, 0.16 + 0.12 * hash01(i, 3), 0.16, 0.17, 0.24, 0.5, a); }
      swirl.end();
      sparks.begin();
      for (let i = 0; i < 120; i++) { const life = 3.2, u = ((t * 0.6 + hash01(i, 5) * life) % life) / life; const a = hash01(i, 6) * 6.28 + u * 3.0; const r = 1.9 * (1 - u) + 0.5;
        sparks.add(o.x + Math.cos(a) * r, o.y - 0.4 + (hash01(i, 8) - 0.5) * 2.6 * (1 - u), o.z + Math.sin(a) * r * 0.4, 0.025, 0.9 * u, 0.75 * u, 1.2 * u, 1); }
      sparks.end();
      rain.begin();
      for (let i = 0; i < 60; i++) { const u = ((t * 1.6 + hash01(i, 9)) % 1); rain.add(o.x - 0.5 + hash01(i, 10) * 1.0, o.y - 0.25 - u * 0.7, o.z + 0.1, 0.03, 0.35, 0.4, 0.6, 0.6 * (1 - u)); }
      rain.end();
      glowMat.color.setRGB(1.3 + f * 0.5, 0.82 + f * 0.45, 0.28 + f * 0.5);
    },
    mood(t) {
      const f = this.flash(t);
      return {
        sky: { top: '#090b18', horizon: '#171c34', bottom: '#05060c' },
        sunDir: [-0.3, 0.8, 0.5], sun: { color: '#9fb2ff', intensity: 0.9 },
        hemi: { sky: '#8a9ad0', ground: '#1a1a30', intensity: 1.5 },
        fog: { color: '#0c0f1e', near: 40, far: 200 }, char: '#ffffff', ao: 0,
        shadow: { size: 5 },
        post: { exposure: 1.0 + 0.15 * f, bloom: 0.95, bloomThreshold: 0.7, haze: 0, tint: '#eef0ff', lift: '#04050c', sat: 1.0, contrast: 1.06, vignette: 0.7, dof: 0.25, focusRange: 2, tilt: 0, grain: 0.035, flash: 0.04 * f },
      };
    },
  };
}
