// 'modern' set (S14b): a modern low-poly city at night in the same paper/diorama style — bevelled blocks with lit
// windows, streetlights, a damp street with puddles, parked cars. One person stands alone under a streetlight, head
// bowed: the same pose and silhouette as Barabbas at the gate (the match cut on "you"). On "So am I" a soft warm light
// falls on them from above (God shown only as light); they look up. Layout + blocking in src/cams/modern.js (MODERN).
import * as THREE from 'three';
import { makeBevelBox, srgb } from '../kit.js';
import { makeBeam } from '../beam.js';
import { makePuddles, wetten } from '../rain.js';
import { MOODS, merge, blend, resolve } from '../moods.js';
import { Person, Poses, expr } from '../rig.js';
import { CITY_PERSON } from '../characters/cast.js';
import { clamp, smooth, invLerp, lerp, hash01, mulberry32 } from '../../lib/util.js';
import { MODERN as CITY } from '../../cams/modern.js';
import '../poses3.js';

const WALLS = ['#4a4652', '#56505a', '#3e434f', '#5a4e48', '#46505a', '#52463f'];

function makeBuilding(w, h, d, seed, faceZ) {
  const g = new THREE.Group();
  const body = makeBevelBox(w, h, d, WALLS[seed % WALLS.length], { bevel: 0.12, lum: 0.05, seed });
  body.position.y = h / 2; g.add(body);
  body.traverse((o) => { if (o.isMesh) { const m = o.material.clone(); wetten(m, { patch: 0.2, k: 0.5 }); o.material = m; o.receiveShadow = true; } });
  const cap = makeBevelBox(w + 0.3, 0.3, d + 0.3, '#2e2c33', { bevel: 0.05 }); cap.position.y = h + 0.15; g.add(cap);
  // windows on the street face: a grid of quads, some lit warm, some cool, many dark
  const R = mulberry32(seed * 7 + 3);
  const cols = Math.max(2, Math.floor(w / 1.6)), rows = Math.max(2, Math.floor((h - 1.5) / 2.2));
  const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.85, 1.15), new THREE.MeshBasicMaterial({ color: '#ffffff' }), cols * rows);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), faceZ > 0 ? 0 : Math.PI), c = new THREE.Color(); let n = 0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = -w / 2 + (k + 0.5) * (w / cols), y = 2.0 + r * 2.2;
    m4.compose(new THREE.Vector3(x, y, faceZ * (d / 2 + 0.02)), q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(n, m4);
    const v = R(); if (v < 0.42) c.setRGB(0.05, 0.055, 0.07); else if (v < 0.82) c.setRGB(1.15, 0.72, 0.32); else c.setRGB(0.45, 0.65, 1.0);
    im.setColorAt(n, c.multiplyScalar(0.55 + 0.45 * R())); n++;
  }
  im.instanceColor.needsUpdate = true; g.add(im);
  // a shop front on the ground floor (glowing)
  if (R() < 0.6) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.6, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(...(R() < 0.5 ? [0.9, 0.55, 0.25] : [0.3, 0.5, 0.8])) })); s.position.set(0, 1.1, faceZ * (d / 2 + 0.03)); if (faceZ < 0) s.rotation.y = Math.PI; g.add(s); }
  return g;
}

function makeStreetlight(H = 5.2) {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: '#2a2d33', flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, H, 7), metal); pole.position.y = H / 2; pole.castShadow = true; g.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), metal); arm.position.set(0.5, H - 0.05, 0); g.add(arm);
  const head = makeBevelBox(0.55, 0.12, 0.26, '#2a2d33', { bevel: 0.03 }); head.position.set(0.95, H - 0.12, 0); g.add(head);
  const bulb = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.8, 3.2) })); bulb.position.set(0.95, H - 0.19, 0); g.add(bulb);
  // soft light pool on the ground under it
  const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec2 vP; void main(){ float d = length(vP) / 2.4; gl_FragColor = vec4(vec3(0.42, 0.5, 0.62) * exp(-d * d * 4.0), 1.0); }' }));
  pool.position.set(0.95, 0.02, 0); g.add(pool);
  g.userData.head = new THREE.Vector3(0.95, H - 0.22, 0);
  return g;
}

function makeCar(seed, color) {
  const g = new THREE.Group();
  const body = makeBevelBox(4.2, 0.75, 1.8, color, { bevel: 0.12, seed }); body.position.y = 0.6; g.add(body);
  const cab = makeBevelBox(2.3, 0.6, 1.6, color, { bevel: 0.12, seed: seed + 1 }); cab.position.set(-0.2, 1.25, 0); g.add(cab);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 1.64), new THREE.MeshStandardMaterial({ color: '#12161c', roughness: 0.1, metalness: 0.4 })); glass.position.set(-0.2, 1.28, 0); g.add(glass);
  for (const [x, z] of [[-1.4, 0.85], [1.4, 0.85], [-1.4, -0.85], [1.4, -0.85]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#141414' })); w.position.set(x, 0.34, z); g.add(w); }
  for (const z of [0.6, -0.6]) { const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.15, 0.1) })); tl.position.set(2.11, 0.75, z); tl.rotation.y = Math.PI / 2; g.add(tl); }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const B = ctx.B.modern;
  const g = new THREE.Group();
  // street (asphalt), kerbs + sidewalks, lane markings, a crosswalk
  const asphalt = wetten(new THREE.MeshLambertMaterial({ color: '#2b2d31' }), { patch: 0.6, scale: 0.5, k: 1 });
  const street = new THREE.Mesh(new THREE.PlaneGeometry(240, 8).rotateX(-Math.PI / 2), asphalt); street.receiveShadow = true; g.add(street);
  for (const s of [1, -1]) {
    const walk = makeBevelBox(240, 0.15, 3.2, '#4a4a4e', { bevel: 0.03, lum: 0.03 }); walk.position.set(0, 0.075, s * 5.6); g.add(walk);
    walk.traverse((o) => { if (o.isMesh) { o.material = wetten(o.material.clone(), { patch: 0.5, k: 0.9 }); o.receiveShadow = true; } });
  }
  const dashMat = new THREE.MeshBasicMaterial({ color: '#8c8a80' });
  for (let x = -110; x < 110; x += 4) { const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.14).rotateX(-Math.PI / 2), dashMat); d.position.set(x, 0.012, 0); g.add(d); }
  for (let k = 0; k < 8; k++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6.5).rotateX(-Math.PI / 2), dashMat); s.position.set(9 + k * 0.95, 0.013, 0); g.add(s); }
  // buildings on both sides
  let x = -90, i = 0;
  while (x < 40) { const w = 7 + 6 * hash01(i, 1), h = 8 + 18 * hash01(i, 2), d = 8; const b = makeBuilding(w, h, d, i, 1); b.position.set(x + w / 2, 0.15, -7.2 - d / 2); g.add(b); x += w + 0.4; i++; }
  x = -90;
  while (x < 40) { const w = 7 + 6 * hash01(i, 1), h = 8 + 18 * hash01(i, 2), d = 8; const b = makeBuilding(w, h, d, i, -1); b.position.set(x + w / 2, 0.15, 7.2 + d / 2); g.add(b); x += w + 0.4; i++; }
  // streetlights every 14 m on both sides (theirs is at CITY.lamp)
  const lights = [];
  for (let k = -5; k <= 2; k++) for (const s of [-1, 1]) {
    const L = makeStreetlight(CITY.lampH); const lx = CITY.lamp[0] + k * 14 + (s > 0 ? 7 : 0);
    L.position.set(lx, 0.15, s * 5.5); L.rotation.y = s > 0 ? Math.PI : 0; g.add(L); lights.push(L);
  }
  for (const [cx, cz, col, sd] of [[-11, -3.1, '#7a2e2e', 3], [-25, 3.1, '#2e4a6a', 5], [9, -3.1, '#4a4a4a', 7], [-40, -3.1, '#6a5a2e', 9]]) { const car = makeCar(sd, col); car.position.set(cx, 0, cz); g.add(car); }
  const puddles = makePuddles({ list: [{ x: CITY.person[0] + 1.6, z: -2.8, r: 1.3, seed: 1 }, { x: -6, z: -1.5, r: 1.6, seed: 2 }, { x: 3.5, z: 1.2, r: 1.1, seed: 3 }, { x: -14, z: 0.8, r: 1.8, seed: 4 }, { x: CITY.person[0] - 0.6, z: -4.4, r: 0.6, seed: 5 }], y: 0.014, res: 0.3 });
  g.add(puddles.group);
  // the warm light from above (God shown only as light)
  const beam = makeBeam({ r0: 1.1, r1: 2.0, h: 26 }); beam.group.position.set(CITY.person[0], CITY.person[1], CITY.person[2]); g.add(beam.group);
  beam.mat.uniforms.uColor.value.setRGB(1.0, 0.8, 0.5);
  const person = new Person({ ...CITY_PERSON }); person.root.position.set(...CITY.person); g.add(person.root);
  const groundH = (x, z) => (Math.abs(z) > 4 ? 0.15 : 0.0);

  return {
    group: g, persons: [person], heightAt: groundH,
    update(t, cam, shot) {
      const w = B.warm(t);
      person.setFacing(-1);
      let P;
      person.setView('threeQuarter');
      if (w < 0.02) { P = Poses.freed(t, 2026, 1); P.lookY = -0.25; P.headTilt = -0.1; expr(P, 'sadness', 0.4); P.mouth = 'none'; }
      else { P = Poses.lookUp(t, 2026, w); P.aF = [lerp(0.12, 0.35, w), lerp(0.25, 0.5, w)]; P.aB = [lerp(-0.08, 0.2, w), lerp(0.2, 0.4, w)]; P.handF = P.handB = 'open'; }
      person.pose(P); person.billboard(cam, 0.3); person.autoOutline(cam);
      beam.group.visible = w > 0.001; beam.set(t, w * 0.5);
      puddles.set(t, { k: 0.05, sky: '#3a4a64' });
    },
    mood(t) {
      const w = B.warm(t);
      const head = [CITY.lamp[0] + 0.95, CITY.lampH + 0.15 - 0.22, CITY.lamp[2]];
      const night = merge(MOODS.cityNight, {
        spot: { pos: head, target: [CITY.person[0], 0, CITY.person[2]], color: '#bcd0ff', intensity: 30, angle: 0.62, penumbra: 0.75, decay: 2, distance: 16, shadow: true },
        rain: { k: 0 },
        wet: 0.75, wetSheen: '#6c7c96',
        post: { ao: 0.5, dof: 0.35, focusRange: 3, tilt: 0 },
      });
      if (w <= 0.001) return night;
      const warm = merge(MOODS.cityWarm, {
        spot: night.spot,
        point: { pos: [CITY.person[0], 3.2, CITY.person[2] + 0.4], color: '#ffc27a', intensity: 8 * w, distance: 9, charColor: '#ffcf8f', charK: 0.9, charRange: 3.2 },
        rain: night.rain, wet: 0.75, wetSheen: '#a08870',
        post: { ao: 0.5, dof: 0.35, focusRange: 3, tilt: 0, exposure: 0.85, bloom: 0.7, godrays: { strength: 0.4 * w, pos: [CITY.person[0], 26, CITY.person[2]], color: '#ffd9a0', radius: 0.12, decay: 0.97, density: 0.95, streaks: 0.5 } },
      });
      return blend(resolve(night), resolve(warm), w);
    },
  };
}
