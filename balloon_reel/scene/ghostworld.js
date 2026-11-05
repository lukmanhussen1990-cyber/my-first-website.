// Ghost-girlfriend reel: night sets + props (low-poly, flat colours, moonlit). Places far apart (x0):
//   the country road (0), the graveyard (200), the candlelight dinner (400), the park bench (600),
//   the proposal hill (800), the haunted castle outside (1000), inside (1200)
import * as THREE from 'three';
import { mat, tex, paint, canvas, rng, hexToRgb, clamp, lerp, hash1 } from './lib.js';
import { glowSprite, spaghettiPlate, fork, waterGlass, tree } from './sets.js';
import { building as cityBlock } from './storm.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const M = (geo, material, { cast = true, receive = true, name } = {}) => {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
};
const add = (parent, m, x = 0, y = 0, z = 0) => { m.position.set(x, y, z); parent.add(m); return m; };
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
const grp = (parent, x = 0, y = 0, z = 0, ry = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g); return g; };
const glowMat = (hex, k = 2) => mat(hex, { emissive: hex, emissiveIntensity: k, rough: 0.4 });
const noisyTex = (hex, amount = 12, seed = 3, size = 32, rep = [1, 1]) => { const b = hexToRgb(hex), R = rng(seed); return tex(paint(size, size, () => { const d = (R() - 0.5) * amount; return [b[0] + d, b[1] + d, b[2] + d]; }), { repeat: rep }); };

export const PL = { road: 0, grave: 200, dinner: 400, park: 600, hill: 800, castle: 1000, hall: 1200 };

// ------------------------------------------------------------------ moonlit night: lights, sky dome, moon, stars
export function night(W, { at = [0, 0, 0], size = 10, moon = [-14, 22, -30], hemi = 1.35, moonI = 1.6, fog = [18, 90], sky = '#1c2a50', far = 120 } = {}) {
  const L = {};
  L.hemi = new THREE.HemisphereLight(0x6a80c0, 0x1c2030, hemi); W.scene.add(L.hemi);
  L.moon = new THREE.DirectionalLight(0xc4d4ff, moonI); L.moon.castShadow = true; L.moon.shadow.mapSize.set(2048, 2048);
  L.moon.shadow.bias = -0.0005; L.moon.shadow.normalBias = 0.03; L.moon.shadow.radius = 4;
  const t = V(...at); L.moon.position.copy(t).add(V(...moon).normalize().multiplyScalar(30)); L.moon.target.position.copy(t);
  Object.assign(L.moon.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 0.5, far: 90 });
  L.moon.shadow.camera.updateProjectionMatrix(); W.scene.add(L.moon); W.scene.add(L.moon.target);
  W.lights = L;
  if (fog) W.scene.fog = new THREE.Fog('#141c34', fog[0], fog[1]);
  W.scene.background = new THREE.Color('#0a0e1e');
  // sky dome (dark blue gradient), stars, a big moon in the direction of the moonlight
  const c = canvas(8, 256), x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#04060f'); gr.addColorStop(0.32, '#0c1430'); gr.addColorStop(0.5, sky); gr.addColorStop(0.56, '#121a30'); gr.addColorStop(1, '#06080e');
  x.fillStyle = gr; x.fillRect(0, 0, 8, 256);
  const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(far, 24, 16), new THREE.MeshBasicMaterial({ map: st, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.position.set(at[0], 0, at[2]); dome.renderOrder = -10; W.scene.add(dome);
  const R = rng(17), pos = [];
  for (let i = 0; i < 700; i++) { const a = R() * Math.PI * 2, e = 0.12 + R() * 1.3, r = far * 0.95; pos.push(at[0] + Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, at[2] + Math.sin(a) * Math.cos(e) * r); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  W.scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xe8eeff, size: 1.6, sizeAttenuation: false, fog: false })));
  const md = V(...moon).normalize().multiplyScalar(far * 0.85).add(V(at[0], 0, at[2]));
  const mm = new THREE.Mesh(new THREE.CircleGeometry(far * 0.06, 32), new THREE.MeshBasicMaterial({ color: '#f4f0dc', fog: false }));
  mm.position.copy(md); mm.lookAt(at[0], 1, at[2]); W.scene.add(mm);
  glowSprite(W.scene, [md.x, md.y, md.z], far * 0.32, 'rgba(200,215,255,0.55)', 0.6).material.fog = false;
  W.moonPos = md;
  return L;
}

// ------------------------------------------------------------------ trees, posts, fog
export function darkTree(parent, x, z, s = 1, seed = 1) {
  const g = grp(parent, x, 0, z), R = rng(seed);
  add(g, M(new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 1.6 * s, 6).translate(0, 0.8 * s, 0), mat('#2a2018')));
  for (let k = 0; k < 3; k++) add(g, M(new THREE.ConeGeometry((1.3 - k * 0.3) * s, 1.6 * s, 7).translate(0, (1.9 + k * 0.9) * s, 0), mat(['#1c3428', '#203a2c', '#24402e'][k])), (R() - 0.5) * 0.1, 0, 0);
  return g;
}
export function deadTree(parent, x, z, s = 1, seed = 1) {
  const g = grp(parent, x, 0, z), R = rng(seed), m = mat('#2a221c');
  add(g, M(new THREE.CylinderGeometry(0.1 * s, 0.22 * s, 2.6 * s, 6).translate(0, 1.3 * s, 0), m));
  for (let k = 0; k < 6; k++) {
    const b = new THREE.CylinderGeometry(0.03 * s, 0.07 * s, (0.9 + R()) * s, 5); b.translate(0, (0.45 + R() * 0.4) * s, 0);
    const mb = add(g, M(b, m), 0, (1.4 + R() * 1.1) * s, 0); mb.rotation.set((R() - 0.5) * 1.6, R() * 6, (R() - 0.5) * 1.6 + (k % 2 ? 0.7 : -0.7));
  }
  return g;
}
export function fogBank(parent, x0, z0, w, d, { n = 26, y = 0.35, size = 3.2, color = 'rgba(170,185,220,1)', opacity = 0.32, seed = 5 } = {}) {
  const c = canvas(64, 64), cx = c.getContext('2d'), gr = cx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, color); gr.addColorStop(1, color.replace(/,1\)$/, ',0)')); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, opacity, depthWrite: false });
  const g = grp(parent), R = rng(seed);
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(m); s.position.set(x0 + (R() - 0.5) * w, y + R() * 0.3, z0 + (R() - 0.5) * d); s.scale.set(size * (1 + R()), size * 0.45 * (1 + R() * 0.5), 1); g.add(s); }
  g.userData.mat = m;
  return g;
}

// ------------------------------------------------------------------ 1. the country road at 2 AM (road along z; cars drive to +z)
export function buildRoad(W, { x0 = PL.road, lamps = true, grown = 0 } = {}) {
  const g = grp(W.scene, x0); const R0 = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), mat(noisyTex('#1e3424', 14, 4, 32, [60, 60]), { rough: 1 }), { cast: false }), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(7, 300).rotateX(-Math.PI / 2), mat(noisyTex('#2a2d34', 10, 6, 32, [2, 80]), { rough: 0.9 }), { cast: false }), 0, 0.01, 0);
  for (let z = -140; z < 140; z += 5) add(g, M(new THREE.PlaneGeometry(0.16, 2.2).rotateX(-Math.PI / 2), mat('#d8c860'), { cast: false }), 0, 0.02, z);
  for (const sx of [-1, 1]) add(g, M(new THREE.PlaneGeometry(0.14, 300).rotateX(-Math.PI / 2), mat('#d8d8d0'), { cast: false }), sx * 3.2, 0.02, 0);
  const R = rng(9);
  for (let z = -120; z < 60; z += 7 + R() * 6) for (const sx of [-1, 1]) if (R() < 0.8) darkTree(g, sx * (7 + R() * 9), z, 0.9 + R() * 0.7, Math.floor(R() * 99));
  for (let z = -60; z < 40; z += 2.6) for (const sx of [-1, 1]) add(g, M(boxG(0.1, 0.9, 0.1), mat('#4a3a2a')), sx * 4.6, 0, z);
  for (const sx of [-1, 1]) add(g, M(new THREE.BoxGeometry(0.05, 0.06, 100).translate(0, 0.75, 0), mat('#4a3a2a')), sx * 4.6, 0, -10);
  // hills far away
  for (let i = 0; i < 9; i++) add(g, M(new THREE.SphereGeometry(30 + R() * 25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), mat('#121c22')), (R() - 0.5) * 220, -2, -110 - R() * 40);
  if (lamps) { R0.lamps = []; for (const z of [-34, -6, 22]) { R0.lamps.push(roadLamp(g, 3.9, z)); } }
  if (grown) { for (let i = 0; i < 120; i++) add(g, M(new THREE.ConeGeometry(0.06, 0.35 + R() * 0.4, 4).translate(0, 0.18, 0), mat('#2e5a2e')), (R() - 0.5) * 6.4, 0, 6 + (R() - 0.5) * 8); }
  return R0;
}
export function roadLamp(parent, x, z, { h = 4.4 } = {}) {
  const g = grp(parent, x, 0, z), dark = mat('#2a2e38', { rough: 0.4, metal: 0.5 });
  add(g, M(new THREE.CylinderGeometry(0.06, 0.09, h, 8).translate(0, h / 2, 0), dark));
  add(g, M(new THREE.BoxGeometry(1.1, 0.07, 0.07), dark), -0.5, h, 0);
  add(g, M(new THREE.BoxGeometry(0.36, 0.1, 0.24), glowMat('#ffd890', 2.4)), -1.0, h - 0.07, 0);
  glowSprite(g, [-1.0, h - 0.2, 0], 2.2, 'rgba(255,215,150,0.9)', 0.6);
  const l = new THREE.SpotLight(0xffd8a0, 30, 14, 0.85, 0.7, 1.4); l.position.set(-1.0, h - 0.2, 0); l.target.position.set(-1.3, 0, 0); g.add(l); g.add(l.target);
  return g;
}

// ------------------------------------------------------------------ the convertible (faces +z; driver on the left = +x)
export const SEATS = { driver: [0.42, 0.12], front: [-0.42, 0.12], backL: [0.42, -0.95], backR: [-0.42, -0.95], y: 0.05 };
export function convertible(parent, x, z, ry = 0, color = '#2a8a9a', { rust = false } = {}) {
  const g = grp(parent, x, 0, z, ry), C = { g };
  const body = mat(rust ? '#7a5a40' : color, { rough: rust ? 0.95 : 0.3, metal: rust ? 0 : 0.35 }), dark = mat('#1a1a1e', { rough: 0.6 }), seat = mat('#6a3a2a', { rough: 0.8 });
  const tyre = mat('#141416', { rough: 0.8 }), chrome = mat('#c8ccd4', { metal: 0.9, rough: 0.25 });
  add(g, M(boxG(1.9, 0.5, 4.3), body), 0, 0.28, 0);                                    // lower body
  add(g, M(boxG(1.86, 0.12, 1.5), body), 0, 0.78, 1.35);                               // hood
  add(g, M(boxG(1.86, 0.12, 1.0), body), 0, 0.78, -1.6);                               // trunk deck
  for (const sx of [-1, 1]) add(g, M(boxG(0.1, 0.22, 1.9), body), sx * 0.9, 0.78, -0.35);   // door tops
  add(g, M(boxG(1.7, 0.12, 1.9), dark), 0, 0.5, -0.35);                                // cabin floor
  for (const [sx, sz, w] of [[0.42, 0.12, 0.6], [-0.42, 0.12, 0.6], [0, -0.95, 1.5]]) {   // seats + backrests
    add(g, M(boxG(w, 0.14, 0.55), seat), sx, 0.5, sz);
    add(g, M(boxG(w, 0.55, 0.14), seat), sx, 0.6, sz - 0.33).rotation.x = -0.18;
  }
  add(g, M(boxG(1.7, 0.25, 0.3), dark), 0, 0.7, 0.68);                                  // dashboard
  const wheel = add(g, M(new THREE.TorusGeometry(0.17, 0.025, 6, 14), dark), 0.42, 1.0, 0.55); wheel.rotation.x = -0.5;
  C.dash = add(g, M(new THREE.PlaneGeometry(1.2, 0.1), glowMat('#6ad8ff', 1.4), { cast: false }), 0, 0.93, 0.52); C.dash.rotation.x = -0.5;
  // windshield frame + glass
  const ws = grp(g, 0, 0.9, 0.78); ws.rotation.x = -0.45;
  for (const sx of [-1, 1]) add(ws, M(new THREE.BoxGeometry(0.05, 0.5, 0.05).translate(0, 0.25, 0), chrome), sx * 0.85, 0, 0);
  add(ws, M(new THREE.BoxGeometry(1.75, 0.05, 0.05), chrome), 0, 0.5, 0);
  add(ws, M(new THREE.PlaneGeometry(1.68, 0.48), mat('#a8c8e8', { transparent: true, opacity: 0.18, rough: 0.05 }), { cast: false }), 0, 0.25, 0);
  // wheels
  C.wheels = [];
  for (const sx of [-0.92, 0.92]) for (const sz of [-1.35, 1.35]) { const w = grp(g, sx, 0.36, sz); add(w, M(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12).rotateZ(Math.PI / 2), tyre)); add(w, M(new THREE.CylinderGeometry(0.17, 0.17, 0.27, 8).rotateZ(Math.PI / 2), chrome)); C.wheels.push(w); }
  add(g, M(new THREE.BoxGeometry(1.95, 0.12, 0.1), chrome), 0, 0.36, 2.17);
  // headlights (emissive + glow + a spot light), tail lights
  C.heads = []; C.glows = [];
  for (const sx of [-0.62, 0.62]) {
    C.heads.push(add(g, M(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12).rotateX(Math.PI / 2), glowMat('#fff6dc', 3)), sx, 0.62, 2.16));
    C.glows.push(glowSprite(g, [sx, 0.62, 2.25], 1.3, 'rgba(255,245,220,0.95)', 0.85));
    add(g, M(new THREE.BoxGeometry(0.3, 0.1, 0.05), glowMat('#ff2a2a', 2.0)), sx, 0.62, -2.16);
  }
  const cab = new THREE.PointLight(0xa8b8ff, 5, 4.5, 1.5); cab.position.set(0, 2.2, -0.4); g.add(cab);           // soft light on the people in the car
  C.beam = new THREE.SpotLight(0xfff2dc, 60, 30, 0.42, 0.55, 1.2); C.beam.position.set(0, 0.7, 2.2); C.beam.target.position.set(0, 0, 12); g.add(C.beam); g.add(C.beam.target);
  C.cone = add(g, M(new THREE.ConeGeometry(2.6, 11, 20, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 5.5), new THREE.MeshBasicMaterial({ color: '#fff4d8', transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), { cast: false, receive: false }), 0, 0.62, 2.2);
  C.setLights = (k) => { C.heads.forEach((h) => { h.material.emissiveIntensity = 3 * k; }); C.glows.forEach((s) => { s.material.opacity = 0.85 * k; }); C.beam.intensity = 60 * k; C.cone.material.opacity = 0.06 * k; };
  // trunk lid (hinged at the back seat) for the tire iron
  C.trunk = grp(g, 0, 0.9, -1.1); add(C.trunk, M(new THREE.BoxGeometry(1.8, 0.05, 1.0).translate(0, 0, -0.5), body));
  if (rust) { const R = rng(4); for (let i = 0; i < 18; i++) add(g, M(new THREE.CircleGeometry(0.06 + R() * 0.12, 6), mat('#5a3a22'), { cast: false }), (R() > 0.5 ? 1 : -1) * 0.955, 0.35 + R() * 0.35, (R() - 0.5) * 3.8).rotation.y = Math.PI / 2; }
  return C;
}
export function tireIron(parent) {
  const g = new THREE.Group(); parent.add(g); const m = mat('#5a5e66', { metal: 0.8, rough: 0.35 });
  add(g, M(new THREE.CylinderGeometry(0.014, 0.014, 0.62, 6), m), 0, 0, 0);
  add(g, M(new THREE.CylinderGeometry(0.02, 0.016, 0.1, 6).rotateZ(Math.PI / 2).translate(0.04, 0, 0), m), 0, 0.31, 0);
  g.userData.grip = { pos: [0, -0.2, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}

// ------------------------------------------------------------------ the ghost: translucent glowing materials, floating, a hair curtain over the face
export function ghostify(ch, { opacity = 0.82, glow = 0.55, tint = '#bfe2ff' } = {}) {
  const done = new Set();
  ch.root.traverse((o) => {
    if (!o.isMesh) return;
    if (/(thigh|shin|shoe|sole)/.test(o.name)) { o.visible = false; return; }
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {      // her own materials, changed in place
      if (done.has(m)) continue; done.add(m);                                       // (the face texture keeps updating)
      const isFace = m === ch.mats.face;
      m.transparent = true; m.opacity = isFace ? 0.97 : opacity; m.depthWrite = true;
      if (m.emissive) { m.emissive = new THREE.Color(tint).multiplyScalar(isFace ? glow * 0.25 : glow); m.emissiveIntensity = 1; }
    }
    o.castShadow = false;
  });
  ch.ghostGlow = glowSprite(ch.root.parent, [0, 0, 0], 2.6, 'rgba(160,210,255,0.8)', 0.35);
  // long black hair hanging in front of her face (scary first), split open for the reveal: ch.hairCurtain(k 0..1)
  const hm = mat('#14161c', { rough: 0.9, transparent: true, opacity: 0.95 });
  const halves = [-1, 1].map((sd) => {
    const geo = new THREE.BoxGeometry(0.105, 0.42, 0.03, 2, 6, 1); const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + Math.sin(y * 18 + sd) * 0.008); p.setZ(i, p.getZ(i) + (y + 0.21) * 0.06); }
    geo.computeVertexNormals(); geo.translate(sd * 0.0525, -0.1, 0.12);
    const m = new THREE.Mesh(geo, hm); ch.head.add(m); return m;
  });
  ch.hairCurtain = (k) => halves.forEach((m, i) => { const sd = i ? 1 : -1; m.visible = k < 0.98; m.position.x = sd * 0.075 * k; m.rotation.y = sd * 0.9 * k; m.scale.x = 1 - 0.5 * k; });
  ch.hairCurtain(0);
  return ch;
}

// ------------------------------------------------------------------ 2. the graveyard
export function tombstone(parent, x, z, kind = 0, s = 1, ry = 0) {
  const g = grp(parent, x, 0, z, ry), m = mat(noisyTex('#7a8090', 18, Math.floor(x * 7 + z), 16), { rough: 0.95 });
  if (kind === 0) { add(g, M(boxG(0.6 * s, 0.75 * s, 0.14 * s), m)); add(g, M(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.14 * s, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2 * 0).translate(0, 0.75 * s, 0), m)).rotation.z = 0; }
  else if (kind === 1) { add(g, M(boxG(0.14 * s, 1.1 * s, 0.14 * s), m)); add(g, M(new THREE.BoxGeometry(0.55 * s, 0.13 * s, 0.13 * s), m), 0, 0.8 * s, 0); }
  else { add(g, M(boxG(0.7 * s, 0.5 * s, 0.2 * s), m)); add(g, M(boxG(0.5 * s, 0.25 * s, 0.16 * s), m), 0, 0.5 * s, 0); }
  add(g, M(boxG(0.8 * s, 0.06, 0.6 * s), mat('#3a3e30')), 0, 0, 0.3 * s);
  g.rotation.z = (hash1(x * 3 + z) - 0.5) * 0.12;
  return g;
}
export function buildGraveyard(W, { x0 = PL.grave } = {}) {
  const g = grp(W.scene, x0); const G = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), mat(noisyTex('#1c3020', 16, 7, 32, [40, 40]), { rough: 1 }), { cast: false }), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(1.6, 60).rotateX(-Math.PI / 2), mat(noisyTex('#4a4232', 14, 8, 32, [1, 20])), { cast: false }), 0, 0.01, -10);
  const R = rng(13);
  for (let row = 0; row < 7; row++) for (let i = 0; i < 6; i++) { const sx = i < 3 ? -1 : 1; tombstone(g, sx * (1.6 + (i % 3) * 1.7 + (R() - 0.5) * 0.4), 3 - row * 2.6 + (R() - 0.5) * 0.6, Math.floor(R() * 3), 0.85 + R() * 0.35, (R() - 0.5) * 0.3); }
  deadTree(g, -6.5, -6, 1.5, 3); deadTree(g, 7, -12, 1.8, 5); deadTree(g, 5.5, 2, 1.2, 8);
  const fence = mat('#141418', { metal: 0.6, rough: 0.5 });
  for (let x = -12; x <= 12; x += 0.35) { add(g, M(new THREE.CylinderGeometry(0.018, 0.018, 1.3, 5).translate(0, 0.65, 0), fence), x, 0, -19); add(g, M(new THREE.ConeGeometry(0.04, 0.12, 4).translate(0, 1.36, 0), fence), x, 0, -19); }
  add(g, M(new THREE.BoxGeometry(24, 0.04, 0.04), fence), 0, 1.1, -19);
  G.fog = fogBank(g, 0, -4, 18, 22, { n: 34, y: 0.25, size: 3.5, opacity: 0.3 });
  return G;
}
export function rose(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 5).translate(0, 0.17, 0), mat('#2a6a2a')));
  add(g, M(new THREE.IcosahedronGeometry(0.035, 0), mat('#d8203a')), 0, 0.35, 0);
  g.userData.grip = { pos: [0, 0.1, 0], axis: [0, 1, 0], up: [0, 0, 1] };
  return g;
}

// ------------------------------------------------------------------ 3. candlelight dinner (table along x at the origin; he sits at -x, she at +x)
export function candle(parent, x, y, z, h = 0.22) {
  const g = grp(parent, x, y, z);
  add(g, M(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 10), mat('#c8a040', { metal: 0.7, rough: 0.3 })));
  add(g, M(new THREE.CylinderGeometry(0.022, 0.022, h, 8).translate(0, h / 2, 0), mat('#f4ecd8')), 0, 0.05, 0);
  const fl = add(g, M(new THREE.ConeGeometry(0.014, 0.05, 6).translate(0, 0.025, 0), mat('#ffd060', { emissive: '#ffb030', emissiveIntensity: 3 }), { cast: false }), 0, 0.05 + h, 0);
  const gl = glowSprite(g, [0, 0.07 + h, 0], 0.45, 'rgba(255,200,110,1)', 0.8);
  const l = new THREE.PointLight(0xffb060, 1.6, 4, 1.6); l.position.set(0, 0.12 + h, 0); g.add(l);
  g.userData = { fl, gl, l, flicker(t, seed = 0) { const k = 0.85 + 0.15 * Math.sin(t * 23 + seed) * Math.sin(t * 7.3 + seed * 2); fl.scale.set(1, k, 1); gl.material.opacity = 0.65 * k + 0.1; l.intensity = 1.6 * k; } };
  return g;
}
export function buildDinner(W, { x0 = PL.dinner } = {}) {
  const g = grp(W.scene, x0); const D = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(12, 12).rotateX(-Math.PI / 2), mat(noisyTex('#3a2418', 12, 3, 32, [6, 6])), { cast: false }), 0, 0, 0);
  const wall = mat(tex(paint(32, 32, (x, y) => ((x % 8) < 4 ? [92, 24, 34] : [80, 20, 30])), { repeat: [10, 4] }), { rough: 0.9 });
  for (const [w, x, z, ry] of [[12, 0, -2.6, 0], [12, -3.6, 0, Math.PI / 2], [12, 3.6, 0, -Math.PI / 2]]) { const p = add(g, M(new THREE.PlaneGeometry(w, 4), wall, { cast: false }), x, 2, z); p.rotation.y = ry; }
  // window with the moon
  add(g, M(new THREE.PlaneGeometry(1.6, 1.8), mat('#0e1830', { emissive: '#0c1428', emissiveIntensity: 1 }), { cast: false }), 0, 1.9, -2.58);
  add(g, M(new THREE.CircleGeometry(0.22, 20), new THREE.MeshBasicMaterial({ color: '#f4f0dc' }), { cast: false }), 0.35, 2.3, -2.57);
  for (const [w, h, x, y] of [[1.7, 0.08, 0, 2.8], [1.7, 0.08, 0, 1.0], [0.08, 1.8, -0.83, 1.9], [0.08, 1.8, 0.83, 1.9], [0.06, 1.8, 0, 1.9]]) add(g, M(new THREE.BoxGeometry(w, h, 0.06), mat('#2a1a14')), x, y, -2.55);
  // table + cloth + two chairs
  add(g, M(boxG(1.3, 0.74, 0.8), mat('#f2eee6', { rough: 0.9 })), 0, 0, 0);
  for (const sx of [-1, 1]) { const ch = grp(g, sx * 0.95, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2); add(ch, M(boxG(0.45, 0.06, 0.45), mat('#4a2a1a')), 0, 0.42, 0); add(ch, M(boxG(0.45, 0.6, 0.05), mat('#4a2a1a')), 0, 0.46, -0.2); for (const [a, b] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) add(ch, M(boxG(0.04, 0.42, 0.04), mat('#3a2014')), a, 0, b); }
  D.plates = [-1, 1].map((sd) => spaghettiPlate(g, sd * 0.38, 0.745, 0, { full: true, seed: sd > 0 ? 2 : 1 }));
  D.glasses = [-1, 1].map((sd) => waterGlass(g, sd * 0.35, 0.745, -0.25));
  D.candles = [candle(g, -0.08, 0.745, -0.05, 0.24), candle(g, 0.1, 0.745, 0.06, 0.18)];
  add(g, M(new THREE.CylinderGeometry(0.035, 0.05, 0.16, 8).translate(0, 0.08, 0), mat('#5a1a2a', { rough: 0.3 })), 0.0, 0.745, 0.22);   // a little vase
  add(g, M(new THREE.IcosahedronGeometry(0.04, 0), mat('#d8203a')), 0.0, 0.93, 0.22);
  return D;
}

// ------------------------------------------------------------------ 4. the park bench under a lamp
export function buildPark(W, { x0 = PL.park } = {}) {
  const g = grp(W.scene, x0); const P = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(120, 120).rotateX(-Math.PI / 2), mat(noisyTex('#1e3624', 14, 9, 32, [30, 30]), { rough: 1 }), { cast: false }), 0, 0, 0);
  add(g, M(new THREE.PlaneGeometry(40, 1.8).rotateX(-Math.PI / 2), mat(noisyTex('#5a5040', 12, 4, 32, [16, 1])), { cast: false }), 0, 0.01, 0.9);
  const wood = mat('#7a4a2a'), iron = mat('#1a1a1e', { metal: 0.6, rough: 0.5 });
  const b = grp(g, 0, 0, 0);
  for (let i = 0; i < 3; i++) add(b, M(new THREE.BoxGeometry(1.7, 0.05, 0.12), wood), 0, 0.45, -0.15 + i * 0.14);
  for (let i = 0; i < 3; i++) add(b, M(new THREE.BoxGeometry(1.7, 0.1, 0.04), wood), 0, 0.62 + i * 0.13, -0.3).rotation.x = -0.15;
  for (const sx of [-0.75, 0.75]) { add(b, M(boxG(0.06, 0.45, 0.4), iron), sx, 0, -0.05); add(b, M(boxG(0.06, 0.5, 0.05), iron), sx, 0.45, -0.3); }
  roadLamp(g, 1.6, -0.5, { h: 3.6 });
  for (const [x, z, s] of [[-5, -4, 1.1], [4.5, -6, 1.3], [-9, -10, 1.6], [8, -12, 1.5], [0, -14, 1.4]]) tree(g, x, z, s, Math.floor(x * 3 + 20));
  P.flies = [];
  const R = rng(3);
  for (let i = 0; i < 16; i++) P.flies.push({ s: glowSprite(g, [(R() - 0.5) * 6, 0.5 + R() * 1.5, -1 - R() * 4], 0.12, 'rgba(220,255,140,1)', 0.9), a: R() * 6, r: 0.2 + R() * 0.4 });
  return P;
}

// ------------------------------------------------------------------ 5. the proposal hill: fairy lights + the city far below
export function buildHill(W, { x0 = PL.hill } = {}) {
  const g = grp(W.scene, x0); const H = { g, x0 };
  add(g, M(new THREE.SphereGeometry(30, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.12, 1), mat(noisyTex('#1e3624', 14, 11, 32, [20, 20]), { rough: 1 })), 0, -3.4, 0);
  for (let i = 0; i < 26; i++) cityBlock(g, -60 + i * 5, -70 - (i % 4) * 6, 4, 8 + (i * 7 % 11) * 2.2, 4, { color: '#1e2638', seed: 30 + i, lit: 0.5 });
  const big = tree(g, -1.6, -1.2, 1.7, 7);
  // fairy lights: a few strings of warm bulbs
  H.bulbs = [];
  for (let s = 0; s < 3; s++) for (let i = 0; i <= 14; i++) {
    const k = i / 14, x = -3.2 + k * 6.4, y = 2.6 - s * 0.35 - Math.sin(k * Math.PI) * 0.45, z = -1.6 - s * 0.25;
    add(g, M(new THREE.SphereGeometry(0.03, 6, 4), glowMat(['#ffd070', '#ffe8a0', '#ff9a60'][i % 3], 3), { cast: false }), x, y, z);
    H.bulbs.push(glowSprite(g, [x, y, z], 0.3, 'rgba(255,210,130,1)', 0.7));
  }
  for (const sx of [-3.2, 3.2]) add(g, M(new THREE.CylinderGeometry(0.04, 0.05, 2.7, 6).translate(0, 1.35, 0), mat('#3a2a1e')), sx, -0.05, -1.75);
  return H;
}
export function ringBox(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.BoxGeometry(0.07, 0.04, 0.07), mat('#8a1a2a')), 0, 0.02, 0);
  const lid = grp(g, 0, 0.04, -0.035); add(lid, M(new THREE.BoxGeometry(0.07, 0.025, 0.07).translate(0, 0.0125, 0.035), mat('#8a1a2a'))); lid.rotation.x = -1.6;
  g.userData.ring = add(g, M(new THREE.TorusGeometry(0.014, 0.004, 6, 14), mat('#f2d26a', { metal: 0.9, rough: 0.2, emissive: '#806020', emissiveIntensity: 0.4 })), 0, 0.055, 0);
  add(g, M(new THREE.OctahedronGeometry(0.008, 0), mat('#e8f4ff', { emissive: '#a8d8ff', emissiveIntensity: 1.2 })), 0, 0.072, 0);
  g.userData.grip = { pos: [0, 0.0, 0], axis: [1, 0, 0], up: [0, 1, 0] };
  return g;
}
export function ring(parent) {
  const g = new THREE.Group(); parent.add(g);
  add(g, M(new THREE.TorusGeometry(0.014, 0.004, 6, 14), mat('#f2d26a', { metal: 0.9, rough: 0.2, emissive: '#806020', emissiveIntensity: 0.4 })));
  add(g, M(new THREE.OctahedronGeometry(0.008, 0), mat('#e8f4ff', { emissive: '#a8d8ff', emissiveIntensity: 1.2 })), 0, 0.018, 0);
  return g;
}

// ------------------------------------------------------------------ 6. the haunted castle (outside) + its clock
const stoneTex = (hex = '#5a6070', seed = 9) => { const b = hexToRgb(hex), R = rng(seed); return tex(paint(64, 64, (x, y) => { const r = Math.floor(y / 8), o = (r & 1) * 8; const edge = y % 8 === 0 || (x + o) % 16 === 0; const d = (edge ? -30 : 0) + (R() - 0.5) * 16; return [b[0] + d, b[1] + d, b[2] + d * 1.1]; }), { repeat: [4, 4] }); };
export function buildCastle(W, { x0 = PL.castle } = {}) {
  const g = grp(W.scene, x0); const C = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), mat(noisyTex('#1a2420', 14, 5, 32, [60, 60]), { rough: 1 }), { cast: false }), 0, 0, 0);
  add(g, M(new THREE.SphereGeometry(40, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.25, 1), mat('#1c2622')), 0, -2, -40);
  const st = mat(stoneTex('#565c6c', 9), { rough: 0.95 }), roof = mat('#2a2238', { rough: 0.8 });
  const base = grp(g, 0, 7.5, -40);
  add(base, M(boxG(22, 10, 8), st));
  for (let x = -10.5; x <= 10.5; x += 1.5) add(base, M(boxG(0.8, 0.9, 8), st), x, 10, 0);
  C.towers = [];
  for (const [x, z, r, h] of [[-12, 0, 3, 18], [12, 0, 3, 18], [-5, -4, 2.2, 24], [5, -4, 2.2, 22], [0, -6, 2.8, 30]]) {
    add(base, M(new THREE.CylinderGeometry(r, r * 1.05, h, 10).translate(0, h / 2, 0), st), x, 0, z);
    add(base, M(new THREE.ConeGeometry(r * 1.25, r * 2.2, 10).translate(0, h + r * 1.1, 0), roof), x, 0, z);
    C.towers.push([x, z, r, h]);
  }
  // lit windows (warm) + the big door
  const R = rng(8);
  for (let i = 0; i < 26; i++) { const t = C.towers[i % 5]; const a = -Math.PI / 2 + (R() - 0.5) * 1.2; add(base, M(new THREE.BoxGeometry(0.5, 0.9, 0.1), glowMat(R() < 0.7 ? '#ffb850' : '#1a1a22', 1.8), { cast: false }), t[0] + Math.cos(a) * t[2] * 1.0, 3 + R() * (t[3] - 6), t[1] - Math.sin(a) * t[2] * 1.0).rotation.y = -a - Math.PI / 2; }
  for (let i = 0; i < 8; i++) add(base, M(new THREE.BoxGeometry(0.6, 1.1, 0.1), glowMat(i % 3 ? '#ffb850' : '#ff8a30', 1.6), { cast: false }), -8 + i * 2.3, 5.5, 4.02);
  add(base, M(new THREE.BoxGeometry(3, 4.5, 0.2), mat('#2a1a10')), 0, 2.25, 4.05);
  // the clock on the middle tower (3:00)
  C.clock = clockFace(); const cf = add(base, M(new THREE.CircleGeometry(1.9, 32), new THREE.MeshBasicMaterial({ map: C.clock, fog: false }), { cast: false }), 0, 22, -6 + 2.85); C.clockMesh = cf;
  C.clockAt = V(x0 + 0, 7.5 + 22, -40 - 6 + 2.85);
  deadTree(g, -9, 6, 2.2, 4); deadTree(g, 11, 2, 2.5, 6);
  C.fog = fogBank(g, 0, -8, 50, 30, { n: 30, y: 0.6, size: 9, color: 'rgba(150,120,200,1)', opacity: 0.22 });
  // bats
  C.bats = [];
  for (let i = 0; i < 12; i++) {
    const b = grp(g); const bm = mat('#0a0a0e');
    const body = add(b, M(new THREE.SphereGeometry(0.18, 6, 4).scale(1, 0.8, 1.3), bm));
    const wings = [-1, 1].map((sd) => { const w = grp(b, sd * 0.12, 0, 0); add(w, M(new THREE.BoxGeometry(0.6, 0.03, 0.3).translate(sd * 0.3, 0, 0), bm)); return w; });
    C.bats.push({ b, wings, a: R() * 6, r: 6 + R() * 10, y: 16 + R() * 14, sp: 0.6 + R() * 0.6 });
  }
  C.flyBats = (t) => C.bats.forEach((o, i) => { const a = o.a + t * o.sp; o.b.position.set(Math.cos(a) * o.r, o.y + Math.sin(t * 2 + i) * 0.8, -36 + Math.sin(a) * o.r * 0.6); o.b.rotation.y = -a; const f = Math.sin(t * 22 + i) * 0.7; o.wings[0].rotation.z = f; o.wings[1].rotation.z = -f; });
  return C;
}
export function clockFace() {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#e8dcc0'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
  x.lineWidth = 10; x.strokeStyle = '#2a2018'; x.stroke();
  x.fillStyle = '#2a2018';
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.save(); x.translate(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100); x.rotate(a); x.fillRect(-4, -12, 8, 24); x.restore(); }
  x.lineCap = 'round';
  x.lineWidth = 14; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + 62, 128); x.stroke();          // hour hand at 3
  x.lineWidth = 9; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 128 - 92); x.stroke();          // minute hand at 12
  x.beginPath(); x.arc(128, 128, 10, 0, Math.PI * 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ------------------------------------------------------------------ 7. inside the haunted castle: the aisle (along -z), the altar at z = -6
function webTex() {
  const c = canvas(256, 256), x = c.getContext('2d'); x.strokeStyle = 'rgba(235,240,255,0.75)'; x.lineWidth = 2;
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 256, Math.sin(a) * 256); x.stroke(); }
  for (let r = 30; r < 256; r += 30) { x.beginPath(); for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; const rr = r * (1 - 0.08 * Math.sin(i * 1.7)); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (i) x.quadraticCurveTo(Math.cos(a - 0.1) * (rr - 8), Math.sin(a - 0.1) * (rr - 8), px, py); else x.moveTo(px, py); } x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const _web = { t: null };
export function web(parent, x, y, z, s = 1, ry = 0, rz = 0) {
  if (!_web.t) _web.t = webTex();
  const m = add(parent, M(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: _web.t, transparent: true, depthWrite: false, side: THREE.DoubleSide }), { cast: false, receive: false }), x, y, z);
  m.rotation.set(0, ry, rz); return m;
}
export function candelabra(parent, x, z, h = 1.6) {
  const g = grp(parent, x, 0, z), m = mat('#3a3020', { metal: 0.7, rough: 0.4 });
  add(g, M(new THREE.CylinderGeometry(0.04, 0.14, h, 8).translate(0, h / 2, 0), m));
  add(g, M(new THREE.BoxGeometry(0.7, 0.04, 0.05), m), 0, h, 0);
  g.userData.candles = [-0.32, 0, 0.32].map((cx) => candle(g, cx, h, 0, 0.16));
  return g;
}
export function buildHall(W, { x0 = PL.hall } = {}) {
  const g = grp(W.scene, x0); const H = { g, x0 };
  add(g, M(new THREE.PlaneGeometry(14, 24).rotateX(-Math.PI / 2), mat(stoneTex('#3a3e48', 3)), { cast: false }), 0, 0, -4);
  add(g, M(new THREE.PlaneGeometry(1.6, 16).rotateX(-Math.PI / 2), mat(noisyTex('#7a1420', 12, 5, 32, [1, 8])), { cast: false }), 0, 0.01, -1);
  const wall = mat(stoneTex('#4a4e5c', 7), { rough: 0.95 });
  for (const [w, x, z, ry] of [[14, 0, -9, 0], [24, -5, -2, Math.PI / 2], [24, 5, -2, -Math.PI / 2]]) { const p = add(g, M(new THREE.PlaneGeometry(w, 9), wall), x, 4.5, z); p.rotation.y = ry; }
  // the big arched window with moonlight
  add(g, M(new THREE.PlaneGeometry(2.4, 4.2), mat('#2a3a68', { emissive: '#3a5090', emissiveIntensity: 1.1 }), { cast: false }), 0, 4.6, -8.97);
  add(g, M(new THREE.CircleGeometry(1.2, 20, 0, Math.PI), mat('#2a3a68', { emissive: '#3a5090', emissiveIntensity: 1.1 }), { cast: false }), 0, 6.7, -8.96);
  for (const xx of [-0.6, 0, 0.6]) add(g, M(new THREE.BoxGeometry(0.06, 5.4, 0.05), mat('#1a1a20')), xx, 4.6, -8.93);
  const beamC = new THREE.SpotLight(0x8aa8ff, 25, 18, 0.45, 0.8, 1.2); beamC.position.set(0, 6, -8.5); beamC.target.position.set(0, 0, -4); g.add(beamC); g.add(beamC.target);
  // altar + candelabras + benches
  add(g, M(boxG(1.8, 1.0, 0.7), mat(stoneTex('#6a6e7a', 4))), 0, 0, -6.5);
  H.candelabras = [candelabra(g, -1.6, -6.2), candelabra(g, 1.6, -6.2), candelabra(g, -3.8, -3), candelabra(g, 3.8, -3), candelabra(g, -3.8, 1.5), candelabra(g, 3.8, 1.5)];
  H.chairs = [];
  for (let r = 0; r < 4; r++) for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
    const c = grp(g, sx * (1.5 + k * 0.75), 0, -2.8 + r * 1.5, Math.PI); const w = mat('#3a2418');
    add(c, M(boxG(0.5, 0.06, 0.48), w), 0, 0.45, 0); add(c, M(boxG(0.5, 0.65, 0.05), w), 0, 0.48, -0.22);
    for (const [a, b] of [[-0.21, -0.2], [0.21, -0.2], [-0.21, 0.2], [0.21, 0.2]]) add(c, M(boxG(0.04, 0.45, 0.04), w), a, 0, b);
    H.chairs.push(c);
  }
  web(g, -4.9, 8.3, -8.9, 2.4, 0, 0); web(g, 4.9, 8.3, -8.9, 2.4, 0, -Math.PI / 2);
  web(g, -4.95, 8, -3, 2.6, Math.PI / 2, 0); web(g, 4.95, 8, 1, 2.6, -Math.PI / 2, 0);
  return H;
}
// a cobweb strung between two points (friends at the end)
export function webBetween(parent, a, b, s = 0.8) {
  const A = V(...a), B = V(...b), mid = A.clone().add(B).multiplyScalar(0.5);
  const m = web(parent, mid.x, mid.y, mid.z, Math.max(s, A.distanceTo(B)), 0, Math.PI / 4);
  return m;
}
