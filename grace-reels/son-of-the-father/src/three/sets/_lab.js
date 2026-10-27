// LAB set (lighting/graphics test bench, NOT part of the reel). Each station is built lazily the first time
// one of its shots renders. Stations sit 400 m apart on x inside the set (see src/cams/_lab.js for cameras,
// timings and frame numbers). Any station at local time >= 50 s runs the in-frame timing bench.
import * as THREE from 'three';
import { matte } from '../materials.js';
import {
  makeTerrain, srgb, mixc, makePalm, makeTree, makeMudHouse, makeTent, makeStone, makeHalfBuriedRock, scatterGrass, scatterPebbles,
  scatterPots, scatterBaskets, scatterFirewood, pathWeight, makePathRibbon, makeFootprints, makeBevelBox, makeRug, makeBush,
} from '../kit.js';
import { makeOilLamp } from '../lamp.js';
import { makeMotes } from '../fx.js';
import { crackEnv } from '../sky.js';
import { makeGoldNumber, convergeU, slamCurve } from '../gold.js';
import { wetten, makePuddles, rainRamp, makeGiantDrop, makeCrackedGround } from '../rain.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, HAIR, CLOTH, SKIN } from '../rig.js';
import { makeAnimal } from '../animals.js';
import { buildArk } from '../arkmodel.js';
import { fbm, clamp, smooth, invLerp, lerp, hash01 } from '../../lib/util.js';
import { LAB_GOLD, LAB_DROP } from '../../cams/_lab.js';

const X = { night: 0, beam: 400, rain: 800, storm: 1200, gold: 1600, drop: 2000, wide: 2400, face: 2800, bench: 3200 };
const ALL = ['CA', 'BLUR', 'BLOOM', 'HAZE', 'VIG', 'GRAIN', 'SPLIT', 'FLASH', 'FADE', 'LGG'];
const NO = ['AO', 'RAYS', 'FOG'];   // features measured separately
const LAB_BENCH = {
  reps: 3,
  post: [
    { name: 'bare', post: { aa: 'none', strip: [...ALL, ...NO] } }, { name: 'none', post: { aa: 'none', strip: NO } }, { name: 'none-noCA', post: { aa: 'none', ca: 0, strip: NO } },
    { name: 'fxaa', post: { aa: 'fxaa', strip: NO } }, { name: 'smaa', post: { aa: 'smaa', strip: NO } },
    { name: 'ao', post: { aa: 'none', ao: 0.6, strip: ['RAYS', 'FOG'] } }, { name: 'rays', post: { aa: 'none', godrays: { strength: 0.8 }, strip: ['AO', 'FOG'] } },
    { name: 'fog', post: { aa: 'none', strip: ['AO', 'RAYS'] }, fog: { density: 0.02, height: 6 } }, { name: 'agx', post: { aa: 'none', tonemap: 'agx', strip: NO } },
    { name: 'dof', post: { aa: 'none', dof: 0.5, focus: 9, strip: NO } }, { name: 'mood', post: {} },
  ],
};

function person(o) { try { return new Person(o); } catch (e) { console.log('[lab] Person failed', e.message); return null; } }
const finish = (list, cam) => { for (const p of list) if (p && p.root.visible) { p.billboard(cam, 0.3); p.autoOutline(cam); } };
const stationGroup = (root, key) => { const g = new THREE.Group(); g.position.x = X[key]; root.add(g); return g; };
const off = (key, p) => [p[0] + X[key], p[1], p[2]];          // station-local -> set-local
const pt = (key, P) => (P ? { ...P, pos: off(key, P.pos) } : P);

// ---------------------------------------------------------------- night: lamp, stars, clouds, AO
function stationNight(root) {
  const g = stationGroup(root, 'night');
  const H = (x, z) => 0.5 * fbm(x * 0.05, z * 0.05, 3, 4) * Math.min(1, Math.hypot(x, z) / 8) - Math.max(0, -z - 30) * 0.02;
  g.add(makeTerrain({ size: 900, seg: 160, height: H, color: (x, z) => mixc(srgb('#55603a'), srgb('#6f6a44'), clamp(0.5 + fbm(x * 0.2, z * 0.2, 2, 9))) }));
  const seat = makeStone(0.42, { seed: 3, color: '#7b7366', sink: 0.25 }); seat.position.set(-0.1, 0.02, 0); seat.scale.set(1.2, 0.95, 1); g.add(seat);
  const stone = makeStone(0.22, { seed: 8, color: '#857b6c', sink: 0.2 }); stone.position.set(0.85, 0.02, 0.38); stone.scale.set(1.3, 0.8, 1.1); g.add(stone);
  const lamp = makeOilLamp({ scale: 1.7 }); lamp.group.position.set(0.85, 0.13, 0.38); lamp.group.rotation.y = 0.4; g.add(lamp.group);
  const m = person({ seed: 11, height: 1.62, age: 'old', hair: 'wrap', wrap: '#cfc4ae', hairColor: HAIR.white, beard: 'long', beardColor: HAIR.white, cloth: CLOTH.indigo, belt: '#b89a62', skin: '#a2693d', outfit: 'robe' });
  if (m) { m.root.position.set(-0.1, 0, 0); g.add(m.root); }
  for (let i = 0; i < 9; i++) { const r = makeStone(0.12 + 0.1 * ((i * 37) % 7) / 7, { seed: 20 + i, color: '#6d665c', sink: 0.3 }); r.position.set(-3 + (i * 1.37) % 6.5, 0.02, -1.5 + ((i * 2.3) % 4)); g.add(r); }
  g.add(scatterGrass(260, { area: [-7, -6, 7, 4], height: H, color: '#6f7448', skip: (x, z) => Math.hypot(x - 0.3, z) < 1.3 }));
  const ark = buildArk(); ark.set?.({ progress: 1 }); const arkG = ark.group || ark.root || ark; arkG.position.set(-38, 0, -150); arkG.rotation.y = 0.5; arkG.scale.setScalar(0.9); g.add(arkG);
  return {
    g,
    update(t, cam) {
      if (m) { m.setFacing(1); m.pose(Poses.sit(t, 11, 0.42)); finish([m], cam); }
      lamp.set(t, 0.9, cam);
    },
    mood(t) {
      return merge(MOODS.nightLamp, { sky: { cloudDir: -0.42, cloudArc: 1.0 }, point: pt('night', lamp.light(t, 0.9)), post: { profile: true, focus: 9.5, dof: 0.35, focusRange: 3, godrays: { pos: off('night', [0, 8, -60]) } } });
    },
  };
}

// ---------------------------------------------------------------- beam: soft morning gold + holy light pillar + god rays
const BEAM_FS = `uniform vec3 uColor; uniform float uK; uniform float uTime; varying vec3 vN; varying vec3 vW; varying float vY;
void main(){ vec3 V = normalize(cameraPosition - vW); float f = abs(dot(normalize(vN), V));
  float core = pow(f, 2.2) * 0.85 + pow(f, 9.0) * 0.6;
  float fy = smoothstep(0.0, 0.05, vY) * (1.0 - smoothstep(0.35, 1.0, vY));
  float sh = 0.82 + 0.18 * sin(vW.x * 2.3 + vW.z * 1.7 + uTime * 0.7) * sin(vY * 9.0 - uTime * 0.45);
  gl_FragColor = vec4(uColor * core * fy * sh * uK, 1.0); }`;
function makeBeam({ r0 = 1.5, r1 = 2.6, h = 34 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.86, 0.58) }, uK: { value: 1 }, uTime: { value: 0 } },
    vertexShader: 'varying vec3 vN; varying vec3 vW; varying float vY; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vY = uv.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: BEAM_FS });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 40, 1, true).translate(0, h / 2, 0), mat); cone.renderOrder = 6; g.add(cone);
  const R = (r0 * 1.9).toFixed(3);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(r0 * 1.9, 40).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, uniforms: { uColor: mat.uniforms.uColor, uK: mat.uniforms.uK },
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uK; varying vec2 vP; void main(){ float d = length(vP) / ${R};
      float a = exp(-d * d * 3.2) * 0.9 + exp(-d * d * 12.0) * 0.6; gl_FragColor = vec4(uColor * a * uK * 0.9, 1.0); }` }));
  pool.position.y = 0.03; pool.renderOrder = 3; g.add(pool);
  const motes = makeMotes(160, 31); g.add(motes.group);
  const _o = new THREE.Vector3();
  return { group: g, mat, set(t, k) { mat.uniforms.uK.value = k; mat.uniforms.uTime.value = t; g.getWorldPosition(_o); motes.set(t, [_o.x, _o.y + 0.2, _o.z], [r0 * 2.2, 7, r0 * 2.2], k * 1.4, [1.0, 0.85, 0.55], 0.035); } };
}
function stationBeam(root) {
  const key = 'beam', g = stationGroup(root, key);
  const path = [[-16, 11], [-9, 6.5], [-4, 3], [-0.5, 0.5], [2.4, -2.2], [4.5, -4.5]];
  const pw = pathWeight(path, 1.5, { seed: 4 });
  const H = (x, z) => 0.6 * fbm(x * 0.035, z * 0.035, 3, 21) * smooth(invLerp(6, 20, Math.hypot(x, z))) + 0.08 * fbm(x * 0.4, z * 0.4, 2, 5) - pw(x, z) * 0.03;
  g.add(makeTerrain({ size: 700, seg: 200, height: H, color: (x, z) => {
    const n = clamp(0.5 + fbm(x * 0.09, z * 0.09, 3, 7) * 1.2);
    return mixc(mixc(srgb('#c9a46a'), srgb('#9c9552'), n * 0.7), srgb('#dcc08e'), pw(x, z) * 0.85);
  } }));
  g.add(makePathRibbon(path, { width: 1.25, height: H, color: '#e0c792', edge: '#cfae78', opacity: 0.55 }));
  const house = makeMudHouse({ w: 4.2, d: 3.6, h: 2.9, seed: 5 }); house.position.set(-7, H(-7, -3.2), -3.2); house.rotation.y = 0.35; g.add(house);
  const h2 = makeMudHouse({ w: 3.4, d: 3, h: 2.5, seed: 9, dome: true, ladder: false }); h2.position.set(-12.5, H(-12.5, -6.5), -6.5); h2.rotation.y = 0.2; g.add(h2);
  for (const [x, z, s, sd] of [[-3.2, -6.5, 1.15, 3], [7.5, -9, 1.3, 7], [-10, 2.5, 1.0, 11], [9.5, 1.5, 0.9, 13]]) { const p = makePalm(s, sd); p.position.set(x, H(x, z), z); g.add(p); }
  for (let i = 0; i < 7; i++) { const x = -12 + i * 4.1, z = -11 + (i % 3) * 1.6; const r = makeHalfBuriedRock(0.45 + 0.4 * hash01(i, 3), { seed: 40 + i, color: '#a08668' }); r.position.set(x, H(x, z), z); g.add(r); }
  g.add(scatterGrass(420, { area: [-18, -14, 14, 12], height: H, color: '#a29a56', skip: (x, z) => pw(x, z) > 0.2 || Math.hypot(x - 2.8, z + 3.2) < 2.6 }));
  g.add(scatterPebbles(300, { area: [-16, -12, 12, 10], height: H, seed: 4 }));
  g.add(scatterPots(5, { points: [[-5.2, -1.0], [-4.8, -1.3], [-8.7, -1.0], [-9.1, -1.4], [-5.5, -1.6]], height: H }));
  const prints = makeFootprints(path, { height: H, color: '#9a7650' }); g.add(prints);
  const beam = makeBeam(); beam.group.position.set(2.8, H(2.8, -3.2), -3.2); g.add(beam.group);
  const enoch = person({ seed: 21, height: 1.78, age: 0.55, hair: 'long', hairColor: HAIR.grey, beard: 'long', beardColor: HAIR.grey, cloth: CLOTH.cream, belt: '#8a6a3a', outfit: 'robe', skin: SKIN[3] });
  const young = person({ seed: 22, height: 1.74, age: 0.1, hair: 'short', hairColor: HAIR.black, beard: 'short', beardColor: HAIR.black, cloth: CLOTH.slate, outfit: 'tunic', skin: SKIN[2] });
  if (enoch) g.add(enoch.root); if (young) g.add(young.root);
  // walker position along the path (arc length), pure fn of local time
  const seg = []; let L = 0; for (let i = 0; i < path.length - 1; i++) { const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seg.push([L, l]); L += l; }
  const along = (s) => { for (let i = 0; i < seg.length; i++) if (s <= seg[i][0] + seg[i][1] || i === seg.length - 1) { const u = clamp((s - seg[i][0]) / seg[i][1]); return [lerp(path[i][0], path[i + 1][0], u), lerp(path[i][1], path[i + 1][1], u), Math.sign(path[i + 1][0] - path[i][0]) || 1]; } };
  const doorL = house.userData.door.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), house.rotation.y).add(house.position);
  return {
    g,
    update(t, cam, shot) {
      const lt = t - shot.t0, s = 14 + lt * 1.0;
      const [x, z, dir] = along(s);
      if (enoch) { enoch.root.position.set(x, H(x, z), z); enoch.setFacing(dir); enoch.pose(Poses.walk(t, 21, 1, 1)); }
      const nShown = prints.userData.prints.findIndex((P) => Math.hypot(P.x - path[0][0], P.z - path[0][1]) > s - 0.3);
      prints.userData.setShown(nShown < 0 ? prints.userData.prints.length : nShown);
      if (young) { young.root.position.set(doorL.x, H(doorL.x, doorL.z), doorL.z); young.setFacing(1); young.pose(Poses.idle(t, 22)); }
      finish([enoch, young], cam);
      beam.set(t, 1);
    },
    mood() {
      return merge(MOODS.morningGold, { post: { profile: true, ao: 0.5, godrays: { strength: 0.75, pos: off(key, [2.8, 24, -3.2]), radius: 0.12, decay: 0.972, density: 0.95, streaks: 0.65 } } });
    },
  };
}

// ---------------------------------------------------------------- rain: streaks, splashes, puddles, wet ground, a lantern
function stationRain(root) {
  const key = 'rain', g = stationGroup(root, key);
  const H = (x, z) => 0.45 * fbm(x * 0.05, z * 0.05, 3, 31) * smooth(invLerp(5, 16, Math.hypot(x, z)));
  const terr = makeTerrain({ size: 600, seg: 180, height: H, color: (x, z) => mixc(srgb('#8f7a5a'), srgb('#7a6e4c'), clamp(0.5 + fbm(x * 0.12, z * 0.12, 3, 3))) });
  wetten(terr.material, { patch: 0.4, scale: 0.4 }); g.add(terr);
  const hs = makeMudHouse({ w: 4, d: 3.4, h: 2.7, seed: 12, glow: 0.8 }); hs.position.set(-4.5, 0, -5); hs.rotation.y = 0.25; g.add(hs);
  hs.traverse((o) => { if (o.isMesh && o.material.isMeshLambertMaterial) o.material = wetten(o.material.clone(), { patch: 0.2, k: 0.7 }); });
  const tent = makeTent({ seed: 4 }); tent.position.set(4.5, 0, -6); tent.rotation.y = -0.4; g.add(tent);
  // a lantern on a pole (its light drives the mood's point light)
  const pole = makeBevelBox(0.12, 2.6, 0.12, '#4a3524', { bevel: 0.02 }); pole.position.set(1.4, 1.3, -0.8); g.add(pole);
  const arm = makeBevelBox(0.6, 0.08, 0.08, '#4a3524', { bevel: 0.015 }); arm.position.set(1.2, 2.55, -0.8); g.add(arm);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.26, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.0, 0.9) })); lantern.position.set(0.98, 2.33, -0.8); g.add(lantern);
  const cap = makeBevelBox(0.3, 0.06, 0.3, '#3a2a1c', { bevel: 0.02 }); cap.position.set(0.98, 2.49, -0.8); g.add(cap);
  const puddles = makePuddles({ list: [{ x: 0.2, z: 0.8, r: 0.9, seed: 1 }, { x: -1.8, z: -0.5, r: 0.6, seed: 2 }, { x: 2.2, z: 1.9, r: 0.7, seed: 3 }, { x: -0.8, z: 2.6, r: 0.5, seed: 4 }, { x: 1.6, z: -2.2, r: 0.55, seed: 5 }], y: 0.012, res: 0.3 });
  g.add(puddles.group);
  g.add(scatterPebbles(260, { area: [-8, -6, 8, 6], height: H, seed: 9, colors: ['#6c6256', '#5e564c', '#7a6e60'] }));
  g.add(scatterGrass(200, { area: [-10, -8, 10, 8], height: H, color: '#6e7044', skip: (x, z) => Math.hypot(x, z) < 3.2 }));
  const p1 = person({ seed: 31, height: 1.7, hair: 'wrap', wrap: '#8a7a64', cloth: CLOTH.brown, outfit: 'robe', beard: 'short', skin: SKIN[2] });
  if (p1) { p1.root.position.set(0.7, 0, -0.4); g.add(p1.root); }
  const L = { pos: [0.98, 2.3, -0.8], color: '#ffb466', intensity: 7, distance: 9, decay: 1.6, charColor: '#ffc27a', charK: 0.9, charRange: 4 };
  return {
    g, heightAt: H,
    update(t, cam) { if (p1) { p1.setFacing(-1); p1.pose(Poses.idle(t, 31)); finish([p1], cam); } puddles.set(t, { k: 0.8, sky: '#7d8ba0' }); },
    mood(t, shot) {
      const lt = t - shot.t0, k = rainRamp(lt, 0.3, 5, { drizzle: 0.25 });
      return merge(MOODS.coldBlue, {
        sky: { top: '#1f2836', horizon: '#46505e', bottom: '#20252c', storm: 0.7, clouds: 0 },
        sun: { color: '#9fb0c8', intensity: 0.55 }, hemi: { sky: '#5b6a80', ground: '#2a2824', intensity: 0.55 },
        fog: { color: '#3d4652', density: 0.03, height: 5 },
        rain: { k, sheets: 0.5, splash: 1, wind: [1.4, 0.4] }, wet: smooth(invLerp(0.2, 3, lt)) * 0.95,
        point: pt(key, { ...L, intensity: L.intensity * (1 + 0.05 * Math.sin(t * 7)) }),
        post: { profile: true, ao: 0.45, exposure: 1.15, bloom: 0.8 },
      });
    },
  };
}

// ---------------------------------------------------------------- storm: decks, lightning crack, rain sheets, the ark
function stationStorm(root) {
  const key = 'storm', g = stationGroup(root, key);
  const H = (x, z) => 2.2 * fbm(x * 0.02, z * 0.02, 3, 41) * smooth(invLerp(10, 60, Math.hypot(x, z + 40)));
  g.add(makeTerrain({ size: 900, seg: 160, height: H, color: (x, z) => mixc(srgb('#4c5440'), srgb('#5e5a48'), clamp(0.5 + fbm(x * 0.05, z * 0.05, 2, 5))) }));
  const ark = buildArk(); ark.set?.({ progress: 1 }); const arkG = ark.group || ark.root || ark; arkG.position.set(6, 0, -70); arkG.rotation.y = -0.35; g.add(arkG);
  for (const [x, z, s, sd] of [[-14, -20, 1.4, 5], [-20, -35, 1.6, 6], [18, -28, 1.2, 8]]) { const p = makePalm(s, sd); p.position.set(x, H(x, z), z); g.add(p); }
  g.add(scatterGrass(300, { area: [-25, -40, 25, 20], height: H, color: '#5f6644', seed: 3 }));
  return {
    g, heightAt: H, update() {},
    mood(t, shot) {
      const lt = t - shot.t0, age = ((lt - 0.8) % 6 + 6) % 6;
      const E = crackEnv(age);
      const cpos = [10, 115, -420];
      return merge(MOODS.storm, {
        sky: { crack: { age, pos: off(key, cpos), size: 320 } },
        rain: { k: 1, sheets: 1, splash: 0.5, wind: [3.2, 0.6], color: '#b9c2cc', far: 90 }, wet: 1,
        post: { profile: true, godrays: { pos: off(key, cpos), strength: 0.9 * E.glow, color: '#fff1d0', radius: 0.22, decay: 0.975, density: 0.95, streaks: 0.85 }, tilt: 0 },
      });
    },
  };
}

// ---------------------------------------------------------------- gold numbers: rise (187, 182, 600) -> fly together -> slam 969
function stationGold(root, ctx) {
  const key = 'gold', g = stationGroup(root, key);
  g.add(makeTerrain({ size: 400, seg: 100, height: (x, z) => 0.2 * fbm(x * 0.1, z * 0.1, 2, 3), color: (x, z) => mixc(srgb('#2c2016'), srgb('#3a2a1c'), clamp(0.5 + fbm(x * 0.3, z * 0.3, 2, 8))) }));
  const lamp = makeOilLamp({ scale: 1.9 }); lamp.group.position.set(0, 0.02, 1.2); g.add(lamp.group);
  const renderer = ctx.world.gl;
  const N = {
    n187: makeGoldNumber('187', { renderer, size: 1.0 }), n182: makeGoldNumber('182', { renderer, size: 1.0 }), n600: makeGoldNumber('600', { renderer, size: 1.0 }),
    n969: makeGoldNumber('969', { renderer, size: 1.5 }),
  };
  for (const n of Object.values(N)) g.add(n.group, n.fx);
  const slots = { n187: [-1.25, 0, -2.6], n182: [1.25, 0, -2.6], n600: [0, 0, -0.6] };
  const target = [0, 1.25, 0.6];
  return {
    g,
    update(t, cam, shot) {
      const lt = t - shot.t0, G = LAB_GOLD;
      for (const k of ['n187', 'n182', 'n600']) {
        const n = N[k], age = lt - G[k];
        if (lt < G.fly) n.rise(age, { pos: slots[k], t: lt, groundY: 0.02 });
        else {
          const u = convergeU(lt - G.slam, G.slam - G.fly);
          n.fly(u, slots[k], target, { arc: 0.9, spin: 0.8, scaleTo: 0.6 });
          n.set(lt, { halo: 0.5 * (1 - u) });
          if (u >= 0.999) n.group.visible = false;
        }
      }
      N.n969.slam(lt - G.slam, { pos: target, t: lt });
      if (lt < G.slam) N.n969.group.visible = false;
      lamp.set(t, lt < G.slam ? 0.9 : 0.5, cam);
    },
    mood(t, shot) {
      const lt = t - shot.t0, S = slamCurve(lt - LAB_GOLD.slam);
      return merge(MOODS.mathDark, { point: pt(key, lamp.light(t, 0.9)), post: { profile: true, ao: 0.5, flash: S.flash * 0.35, bloom: 1.0 + 0.6 * (S.glow || 0), dof: 0.25, focus: 15, focusRange: 5 } });
    },
  };
}

// ---------------------------------------------------------------- the giant raindrop on dry cracked ground
function stationDrop(root, ctx) {
  const key = 'drop', g = stationGroup(root, key);
  const ground = makeCrackedGround({ size: 5, cell: 0.17, seed: 7 }); g.add(ground);
  g.add(makeTerrain({ size: 400, seg: 60, height: () => -0.01, color: () => srgb('#8c6c48') }));
  const lamp = makeOilLamp({ scale: 1.7 }); lamp.group.position.set(0.32, 0.03, -0.25); lamp.group.rotation.y = 0.3; g.add(lamp.group);
  const drop = makeGiantDrop({ renderer: ctx.world.gl, r: 0.045 }); g.add(drop.group);
  for (let i = 0; i < 5; i++) { const s = makeStone(0.05 + 0.04 * hash01(i, 2), { seed: 60 + i, color: '#8a745a', sink: 0.3 }); s.position.set(-0.6 + i * 0.33, 0.02, -0.5 + (i % 2) * 0.25); g.add(s); }
  return {
    g,
    update(t, cam, shot) {
      const lt = t - shot.t0, D = LAB_DROP;
      lamp.set(t, 0, cam, { outT: shot.t0 - 0.5 });
      drop.set(lt, { fallAge: lt - D.fall, fall: D.dur, from: [0.02, 1.1, 0.18], to: [0.02, 0.024, 0.18], slow: 1 });
    },
    mood(t, shot) {
      return merge(MOODS.coldBlue, { sky: { storm: 0.6, clouds: 0 }, sun: { intensity: 0.7 }, point: pt(key, lamp.light(t, 0, { outT: shot.t0 - 0.5 })),
        post: { profile: true, dof: 0.55, focus: 2.5, focusRange: 0.35, tilt: 0, ao: 0.4, bloom: 0.6 } });
    },
  };
}

// ---------------------------------------------------------------- wide world shot (quality loop): village in warm day light
function stationWide(root) {
  const key = 'wide', g = stationGroup(root, key);
  const pathA = [[-14, 14], [-6, 6], [-1.5, 1.5], [1.5, -3], [3.5, -10], [6, -22]], pathB = [[-1.5, 1.5], [-5, -6], [-7, -14], [-12, -24]];
  const pA = pathWeight(pathA, 1.9, { seed: 3 }), pB = pathWeight(pathB, 1.4, { seed: 5 });
  const pw = (x, z) => Math.max(pA(x, z), pB(x, z));
  const H = (x, z) => 2.4 * fbm(x * 0.022, z * 0.022, 3, 51) * smooth(invLerp(14, 40, Math.hypot(x, z + 5))) + 0.1 * fbm(x * 0.3, z * 0.3, 2, 9) - pw(x, z) * 0.05;
  g.add(makeTerrain({ size: 700, seg: 240, height: H, color: (x, z, y) => {
    const n = clamp(0.5 + fbm(x * 0.07, z * 0.07, 3, 17) * 1.5), m = clamp(0.5 + fbm(x * 0.3, z * 0.3, 2, 19));
    let c = mixc(srgb('#c99a5e'), srgb('#8e8c46'), smooth(invLerp(0.45, 0.85, n)) * 0.85);   // ochre sand -> olive patches
    c = mixc(c, srgb('#b07a46'), m * 0.3);                                                 // ochre mottling
    c = mixc(c, srgb('#dcb880'), pw(x, z) * 0.9);                                          // packed paths
    return c.map((v) => v * (0.93 + 0.04 * y));
  } }));
  g.add(makePathRibbon(pathA, { width: 1.6, height: H, color: '#e0bf86', edge: '#cfa772', opacity: 0.55, seed: 4 }));
  const occupied = [];
  const houses = [
    { p: [-4.6, -4.2], w: 3.7, d: 3.3, h: 2.8, ry: 0.28, seed: 1, awning: ['#2f4a6a', '#e3d2a8'], curtain: '#7a2e3a', roofClutter: true },
    { p: [2.6, -8.8], w: 3.3, d: 3.0, h: 2.6, ry: -0.2, seed: 2, dome: true, curtain: '#2f5a5a' },
    { p: [-3.4, -13.2], w: 4.2, d: 3.4, h: 3.0, ry: 0.12, seed: 3, roofClutter: ['#c06a2a', '#2f4a6a'], curtain: '#c08a2a' },
    { p: [-7.5, -20], w: 3.6, d: 3.2, h: 2.7, ry: 0.45, seed: 4, awning: ['#7a2e3a', '#d9b46a'] },
    { p: [4.8, -17.5], w: 3.4, d: 3.0, h: 2.5, ry: -0.35, seed: 5, roofClutter: true },
  ];
  const wallCols = ['#b98c5a', '#c49a66', '#ad8150', '#bf9462', '#b48656'];
  for (const Hh of houses) {
    const [x, z] = Hh.p;
    const m = makeMudHouse({ ...Hh, color: wallCols[Hh.seed % wallCols.length], roof: '#8a6c48' }); m.position.set(x, H(x, z) - 0.05, z); m.rotation.y = Hh.ry; g.add(m); occupied.push([x, z, Math.max(Hh.w, Hh.d) * 0.78]);
  }
  for (const [x, z, ry, sd, cols] of [[6.2, -12.5, -0.6, 2, ['#2f3a5a', '#c99a4a']], [-8, -9, 0.7, 3, ['#8a3a2a', '#e0cfa8']]]) { const tt = makeTent({ seed: sd, colors: cols, stripes: 9 }); tt.position.set(x, H(x, z), z); tt.rotation.y = ry; g.add(tt); occupied.push([x, z, 2.8]); }
  for (const [x, z, s, sd] of [[4.6, -3.2, 1.25, 2], [-6.8, 2.0, 1.15, 4], [0.8, -22, 1.35, 7], [7.5, -24, 1.2, 9]]) { const p = makePalm(s, sd); p.position.set(x, H(x, z), z); g.add(p); occupied.push([x, z, 0.8]); }
  for (const [x, z, s, sd] of [[3.2, 5.5, 1.05, 13], [-8.5, -26, 1.3, 11]]) { const tr = makeTree(s, sd); tr.position.set(x, H(x, z), z); g.add(tr); occupied.push([x, z, 1.6]); }
  for (let i = 0; i < 9; i++) { const x = -7 + 13 * hash01(i, 81), z = -24 + 33 * hash01(i, 82); if (pw(x, z) > 0.1 || occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r + 0.6)) continue;
    const b = makeBush(0.55 + 0.35 * hash01(i, 83), { seed: 90 + i }); b.position.set(x, H(x, z), z); g.add(b); occupied.push([x, z, 0.7]); }
  for (let i = 0; i < 10; i++) { const x = -8 + 16 * hash01(i, 71), z = -26 + 36 * hash01(i, 72); if (pw(x, z) > 0.1 || occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r)) continue;
    const r = makeHalfBuriedRock(0.35 + 0.45 * hash01(i, 73), { seed: 80 + i, color: '#a2876a' }); r.position.set(x, H(x, z), z); g.add(r); }
  for (const [x, z, ry, cols, sd] of [[1.6, 0.4, 0.3, ['#2f4a6a', '#d9b46a', '#7a2e3a'], 3], [-1.6, -8.6, -0.2, ['#c06a2a', '#e3d2a8'], 5]]) { const r = makeRug(1.7, 1.05, { colors: cols, seed: sd }); r.position.set(x, H(x, z), z); r.rotation.y = ry; g.add(r); occupied.push([x, z, 1.0]); }
  const skip = (x, z) => pw(x, z) > 0.15 || occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r);
  g.add(scatterGrass(900, { area: [-10, -28, 9, 12], height: H, skip, seed: 6, clump: 5, spread: 0.4 }));
  g.add(scatterPebbles(380, { area: [-10, -28, 9, 12], height: H, seed: 8, skip: (x, z) => occupied.some(([ox, oz, r]) => Math.hypot(x - ox, z - oz) < r * 0.8) }));
  g.add(scatterPots(12, { points: [[-2.5, -2.2], [-2.1, -2.5], [-6.4, -2.4], [1.0, -6.9], [1.3, -7.2], [-1.6, -11.2], [-1.2, -11.5], [3.4, -15.6], [-5.6, -18.2], [0.9, -1.0], [-6.9, -7.0], [5.4, -10.8]], height: H }));
  g.add(scatterBaskets(7, { points: [[-3.0, -2.0], [0.5, -6.6], [-5.0, -11.4], [2.2, 0.9], [-5.9, -17.9], [4.6, -15.1], [-7.2, -6.4]], height: H }));
  g.add(scatterFirewood(4, { points: [[-6.6, -3.0], [3.8, -7.2], [-1.0, -12.0], [-6.2, -18.6]], height: H }));
  g.add(makeFootprints(pathA.slice(1, 5), { height: H, color: '#a8865a', stride: 0.4 }));
  const people = [
    person({ seed: 41, height: 1.75, cloth: CLOTH.teal, outfit: 'robe', beard: 'short', skin: SKIN[3], quality: 'crowd' }),
    person({ seed: 42, height: 1.62, cloth: CLOTH.ochre, outfit: 'robe', hair: 'long', skin: SKIN[4], quality: 'crowd' }),
    person({ seed: 43, height: 1.8, cloth: CLOTH.slate, outfit: 'tunic', beard: 'long', hairColor: HAIR.grey, beardColor: HAIR.grey, age: 0.7, skin: SKIN[2], quality: 'crowd' }),
    person({ seed: 44, height: 1.15, cloth: CLOTH.rose, outfit: 'tunic', kid: true, skin: SKIN[3], quality: 'crowd' }),
    person({ seed: 45, height: 1.7, cloth: CLOTH.wine, outfit: 'robe', wrap: '#d8c8a8', skin: SKIN[1], quality: 'crowd' }),
    person({ seed: 46, height: 1.68, cloth: CLOTH.indigo, outfit: 'robe', hair: 'long', skin: SKIN[2], quality: 'crowd' }),
  ].filter(Boolean);
  const spots = [[-0.9, 3.2, 1], [0.6, 0.0, -1], [-2.2, -1.6, 1], [-0.2, 0.6, 1], [2.6, -5.6, -1], [-4.4, -9.6, 1]];
  people.forEach((p, i) => { const [x, z] = spots[i]; p.root.position.set(x, H(x, z), z); g.add(p.root); });
  for (let i = 0; i < 4; i++) { const A = makeAnimal('sheep', 90 + i); const x = 3.4 + (i % 2) * 1.1, z = -0.8 + Math.floor(i / 2) * 1.2 + 0.3 * hash01(i, 5); A.group.position.set(x, H(x, z), z); A.group.rotation.y = hash01(i, 6) * 6; A.group.scale.setScalar(0.85); g.add(A.group); }
  return {
    g, heightAt: H,
    update(t, cam) {
      people.forEach((p, i) => { p.setFacing(spots[i][2]); p.pose(i === 0 ? Poses.walk(t, 41, 0.8, 1) : Poses.idle(t, 41 + i)); });
      finish(people, cam);
    },
    mood() { return merge(MOODS.dayWarm, { post: { profile: true } }); },
  };
}

// ---------------------------------------------------------------- bench: trivial scene
function stationBench(root) {
  const g = stationGroup(root, 'bench');
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), matte('#9a8058')); ground.receiveShadow = true; g.add(ground);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), matte('#c99a3a')); box.position.y = 1; box.castShadow = true; g.add(box);
  return { g, update() {}, mood() { return { post: { profile: true } }; } };
}

const BUILD = { night: stationNight, beam: stationBeam, rain: stationRain, storm: stationStorm, gold: stationGold, drop: stationDrop, wide: stationWide, bench: stationBench };

export function build(ctx) {
  const g = new THREE.Group(); const S = {};
  const get = (shot) => {
    const k = BUILD[shot.station] ? shot.station : 'bench';
    if (!S[k]) { const t0 = performance.now(); S[k] = BUILD[k](g, ctx); console.log(`[lab] built ${k} in ${(performance.now() - t0).toFixed(0)} ms`); }
    return S[k];
  };
  const api = {
    group: g, persons: [], heightAt: null,
    update(t, cam, shot, c, M) {
      const st = get(shot);
      for (const s of Object.values(S)) s.g.visible = s === st;
      st.update(t, cam, shot, c, M);
    },
    mood(t, shot, c) {
      const st = get(shot);
      // the engine asks the set for heightAt(x, z) (set-local) for rain splashes
      api.heightAt = st.heightAt ? (x, z) => st.heightAt(x - X[shot.station], z) : null;
      const m = st.mood(t, shot, c);
      // lt >= 50 on any station: in-frame timing bench of that station's scene (see World.bench)
      return t - shot.t0 >= 50 ? merge(m, { post: { profile: false, bench: LAB_BENCH } }) : m;
    },
  };
  return api;
}
