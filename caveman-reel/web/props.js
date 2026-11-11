// Props, creatures and effects: mammoth, hole, stick, stone seat, coconut bowl, bamboo pipes,
// modern toilet + stone hut, phone, clock, speaker, shelf, sprites, ribbons and particle bursts.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { V3, clamp, lerp, ss, rng, noise3, canvasTex, blobGeo, mesh, group, tube, curvePts, loft, TAU, backOut } from './util.js';
import { MAT, TEX, makeHut, makeRock } from './world.js';

export let ENV = null;
export function initProps(renderer) { const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(new RoomEnvironment(), 0.03).texture; }

// ---------- sprites (drawn in code) ----------
const sprTex = (w, h, draw) => canvasTex(w, h, draw, { clamp: true });
export const SPR = {};
export function makeSprites() {
  SPR.bulb = sprTex(256, 320, (g) => {
    g.lineCap = 'round'; g.strokeStyle = '#ffd92e'; g.lineWidth = 11;
    for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * 0.84 / 6 * 1.0) + 0.0; const ang = -Math.PI + (i / 6) * Math.PI; const cx = 128, cy = 150; g.beginPath(); g.moveTo(cx + Math.cos(ang) * 96, cy + Math.sin(ang) * 96); g.lineTo(cx + Math.cos(ang) * 122, cy + Math.sin(ang) * 122); g.stroke(); }
    g.fillStyle = '#ffe23a'; g.strokeStyle = '#c99700'; g.lineWidth = 7;
    g.beginPath(); g.arc(128, 150, 72, Math.PI * 0.80, Math.PI * 0.20); g.bezierCurveTo(176, 222, 160, 226, 160, 246); g.lineTo(96, 246); g.bezierCurveTo(96, 226, 80, 222, 70, 192); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(102, 118, 13, 24, 0.5, 0, TAU); g.fill();
    g.strokeStyle = '#e08a00'; g.lineWidth = 5; g.beginPath(); g.moveTo(108, 182); for (let i = 0; i <= 8; i++) g.lineTo(108 + i * 5, 182 + (i % 2 ? -7 : 5)); g.stroke();
    g.fillStyle = '#cfd3d8'; g.strokeStyle = '#8b9096'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.roundRect(100 + i * 4, 250 + i * 14, 56 - i * 8, 11, 5); g.fill(); g.stroke(); }
  });
  SPR.spark = sprTex(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 60); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,230,0.55)'); gr.addColorStop(1, 'rgba(255,255,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#ffffff'; g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, r = i % 2 ? 9 : 62; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } g.closePath(); g.fill();
  });
  const note = (ch, col) => sprTex(128, 128, (g) => { g.font = '900 104px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#1b1b2a'; g.lineJoin = 'round'; g.strokeText(ch, 64, 66); g.fillStyle = col; g.fillText(ch, 64, 66); });
  SPR.note1 = note('♪', '#ff5fa2'); SPR.note2 = note('♫', '#3fd0ff'); SPR.note3 = note('♪', '#ffe14a');
  SPR.zap = sprTex(128, 128, (g) => { g.strokeStyle = '#3a2a00'; g.lineWidth = 16; g.lineJoin = 'round'; g.lineCap = 'round'; const p = [[30, 16], [74, 46], [48, 62], [98, 112]]; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); g.strokeStyle = '#ffe53b'; g.lineWidth = 8; g.stroke(); });
  SPR.heart = sprTex(128, 128, (g) => { g.fillStyle = '#ff4d7e'; g.strokeStyle = '#7a1030'; g.lineWidth = 6; g.beginPath(); g.moveTo(64, 108); g.bezierCurveTo(8, 66, 20, 18, 64, 44); g.bezierCurveTo(108, 18, 120, 66, 64, 108); g.fill(); g.stroke(); });
  SPR.bang = sprTex(256, 256, (g) => { g.fillStyle = '#ffe53b'; g.strokeStyle = '#2a1a00'; g.lineWidth = 9; g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i < 20; i++) { const a = i / 20 * TAU, r = i % 2 ? 62 : 118; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#ff5a2a'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + 0.2, r = i % 2 ? 30 : 60; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.closePath(); g.fill(); });
  SPR.puff = sprTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  SPR.sweat = sprTex(64, 96, (g) => { g.fillStyle = '#7fd2ff'; g.strokeStyle = '#1d5f8f'; g.lineWidth = 5; g.beginPath(); g.moveTo(32, 6); g.bezierCurveTo(60, 50, 56, 88, 32, 88); g.bezierCurveTo(8, 88, 4, 50, 32, 6); g.fill(); g.stroke(); });
}
export function sprite(tex, size = 1, opts = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, ...opts }));
  s.scale.set(size * (tex.image.width / tex.image.height), size, 1); s.userData.size = size; s.userData.aspect = tex.image.width / tex.image.height;
  s.setSize = (k) => s.scale.set(Math.max(1e-4, k) * s.userData.aspect, Math.max(1e-4, k), 1);
  return s;
}

/** Camera-facing wiggly ribbon (stink lines, heat waves, steam). Points are rebuilt every frame. */
export class Ribbon {
  constructor(color, n = 22, opacity = 0.9) {
    this.n = n; const pos = new Float32Array((n + 1) * 2 * 3); const idx = [];
    for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
  }
  /** fn(u) -> [x, y] in the ribbon's local plane, wfn(u) -> half width */
  set(fn, wfn) {
    const p = this.mesh.geometry.attributes.position; const n = this.n;
    for (let i = 0; i <= n; i++) {
      const u = i / n; const [x, y] = fn(u); const [x2, y2] = fn(Math.min(1, u + 0.01)); const [x1, y1] = fn(Math.max(0, u - 0.01));
      let tx = x2 - x1, ty = y2 - y1; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; const w = wfn(u);
      p.setXYZ(i * 2, x - ty * w, y + tx * w, 0); p.setXYZ(i * 2 + 1, x + ty * w, y - tx * w, 0);
    }
    p.needsUpdate = true;
  }
}
/** Instanced ballistic particles. Each particle: launch time, origin, velocity; update(t). */
export class Burst {
  constructor(geo, mat, n, seed = 1) {
    this.m = new THREE.InstancedMesh(geo, mat, n); this.m.castShadow = true; this.m.frustumCulled = false; this.n = n; this.R = rng(seed); this.parts = []; this.d = new THREE.Object3D();
    for (let i = 0; i < n; i++) this.parts.push({ t0: 1e9, o: V3(), v: V3(), s: 1, life: 1, spin: V3() });
    this.k = 0; this.gravity = -9.8; this.floor = null;
  }
  emit(t0, o, dir, speed, spread, count, size = 1, life = 0.9) {
    const R = this.R;
    for (let i = 0; i < count; i++) {
      const p = this.parts[this.k++ % this.n]; p.t0 = t0 + R() * 0.07; p.o.set(o[0] + (R() - 0.5) * 0.08, o[1], o[2] + (R() - 0.5) * 0.08);
      p.v.set(dir[0] + (R() - 0.5) * spread, dir[1] + (R() - 0.5) * spread * 0.6, dir[2] + (R() - 0.5) * spread).multiplyScalar(speed * (0.6 + 0.6 * R()));
      p.s = size * (0.5 + R()); p.life = life * (0.7 + 0.5 * R()); p.spin.set(R() * 9, R() * 9, R() * 9);
    }
  }
  update(t) {
    const d = this.d;
    for (let i = 0; i < this.n; i++) {
      const p = this.parts[i]; const dt = t - p.t0;
      if (dt < 0 || dt > p.life) { d.scale.setScalar(0); d.position.set(0, -50, 0); }
      else {
        let y = p.o.y + p.v.y * dt + 0.5 * this.gravity * dt * dt; if (this.floor !== null && y < this.floor) y = this.floor;
        d.position.set(p.o.x + p.v.x * dt, y, p.o.z + p.v.z * dt);
        d.rotation.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt); d.scale.setScalar(p.s * Math.min(1, (p.life - dt) / 0.18 + 0.15));
      }
      d.updateMatrix(); this.m.setMatrixAt(i, d.matrix);
    }
    this.m.instanceMatrix.needsUpdate = true;
  }
}

// ---------- mammoth ----------
export function makeMammoth() {
  const root = new THREE.Group(); root.name = 'mammoth';
  const fur = MAT.fur; const furD = new THREE.MeshStandardMaterial({ map: TEX.fur, color: 0xb8a090, roughness: 1 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xf6efdc, roughness: 0.45 });
  const skinM = new THREE.MeshStandardMaterial({ color: 0x5a3a26, roughness: 0.9 });
  const body = new THREE.Group(); root.add(body);
  const sph = (r, pos, sc, mat = fur, det = 3, seed = 1) => { const m = mesh(blobGeo(r, det, seed, 0.07, 2.2), mat, { pos, scale: sc }); return m; };
  body.add(sph(1.12, [0, 2.05, -0.2], [1.0, 1.02, 1.55], fur, 3, 1));
  body.add(sph(0.95, [0, 2.72, 0.75], [0.95, 0.95, 1.0], fur, 3, 2));       // shoulder hump
  body.add(sph(0.9, [0, 2.0, -1.35], [0.98, 0.98, 0.9], fur, 3, 3));        // rump
  // shaggy skirt of fur tufts
  const tuft = new THREE.ConeGeometry(0.11, 0.62, 5); tuft.translate(0, -0.31, 0);
  const tufts = new THREE.InstancedMesh(tuft, fur, 260); const d = new THREE.Object3D(); const R = rng(4); let k = 0;
  for (let i = 0; i < 200; i++) { const a = R() * TAU; const z = -1.9 + R() * 3.3; const side = Math.cos(a) > 0 ? 1 : -1; const y = 1.25 + R() * 1.0; const rx = Math.sqrt(Math.max(0.05, 1 - Math.pow((y - 2.05) / 1.2, 2))) * 1.13; d.position.set(side * rx * (0.9 + R() * 0.1), y, z); d.rotation.set((R() - 0.5) * 0.3, R() * 6, side * -0.25); d.scale.set(1 + R(), 0.8 + R() * 0.9, 1 + R()); d.updateMatrix(); tufts.setMatrixAt(k++, d.matrix); }
  tufts.count = k; tufts.castShadow = true; body.add(tufts);
  // legs
  const legs = [];
  for (const [x, z] of [[0.62, 0.75], [-0.62, 0.75], [0.6, -1.25], [-0.6, -1.25]]) {
    const lg = new THREE.Group(); lg.position.set(x, 1.55, z);
    lg.add(mesh(new THREE.CylinderGeometry(0.36, 0.40, 1.55, 14), fur, { pos: [0, -0.78, 0] }));
    lg.add(mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.16, 14), skinM, { pos: [0, -1.47, 0] }));
    for (let i = -1; i <= 1; i++) lg.add(mesh(new THREE.SphereGeometry(0.1, 8, 6), ivory, { pos: [i * 0.2, -1.5, 0.38], scale: [1, 0.8, 0.7] }));
    root.add(lg); legs.push(lg);
  }
  const tail = mesh(tube(curvePts([[0, 2.3, -2.1], [0, 1.9, -2.35], [0, 1.4, -2.3]], 8), (u) => lerp(0.09, 0.04, u), 8), fur); root.add(tail);
  root.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), fur, { pos: [0, 1.36, -2.3], scale: [1, 1.5, 1] }));
  // head
  const head = new THREE.Group(); head.position.set(0, 2.72, 1.55); root.add(head);
  head.add(sph(0.78, [0, 0.0, 0.25], [0.92, 1.12, 0.95], fur, 3, 5));
  head.add(sph(0.5, [0, 0.72, 0.12], [1, 0.95, 1], fur, 3, 6));              // domed top-knot
  for (let i = 0; i < 9; i++) head.add(mesh(tuft, fur, { pos: [(i - 4) * 0.13, 0.86 - Math.abs(i - 4) * 0.035, 0.55 - Math.abs(i - 4) * 0.02], rot: [0.5, 0, (i - 4) * 0.1], scale: [1.2, 0.75, 1.2] }));
  const ears = [];
  for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * 0.62, 0.2, 0.05); const em = mesh(new THREE.SphereGeometry(0.42, 14, 10), fur, { pos: [s * 0.22, -0.05, 0], scale: [1, 1.2, 0.22] }); e.add(em); e.rotation.y = s * 0.5; head.add(e); ears.push(e); }
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.40, 0.18, 0.86); head.add(e);
    e.add(mesh(new THREE.SphereGeometry(0.115, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfffdf6, roughness: 0.25 }), { cast: false }));
    const pupil = mesh(new THREE.SphereGeometry(0.066, 12, 10), new THREE.MeshStandardMaterial({ color: 0x1a0f08, roughness: 0.2 }), { pos: [0, 0, 0.066], cast: false }); e.add(pupil);
    e.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), { pos: [-0.03, 0.035, 0.125], cast: false }));
    const lid = mesh(new THREE.SphereGeometry(0.125, 16, 8, 0, TAU, 0, Math.PI / 2), fur, { cast: false }); lid.rotation.x = -0.5; e.add(lid);
    const brow = mesh(new THREE.CapsuleGeometry(0.035, 0.2, 4, 8), skinM, { pos: [0, 0.16, 0.05], rot: [0, 0, Math.PI / 2 + s * 0.25] }); e.add(brow);
    eyes.push({ g: e, pupil, lid, brow, s });
  }
  // trunk: chain of segments so it can sway and curl
  const trunk = []; let par = head; const TN = 11;
  for (let i = 0; i < TN; i++) {
    const j = new THREE.Group(); j.position.set(0, i === 0 ? -0.25 : -0.24, i === 0 ? 0.92 : 0);
    const r = lerp(0.27, 0.10, i / (TN - 1));
    j.add(mesh(new THREE.SphereGeometry(r, 12, 9), i % 2 ? fur : furD, { scale: [1, 1.25, 1] }));
    par.add(j); par = j; trunk.push(j);
  }
  // tusks
  for (const s of [-1, 1]) {
    const pts = curvePts([[s * 0.34, -0.42, 0.72], [s * 0.62, -1.1, 1.1], [s * 0.85, -1.35, 1.85], [s * 0.62, -0.95, 2.5], [s * 0.28, -0.4, 2.7]], 22);
    head.add(mesh(tube(pts, (u) => lerp(0.13, 0.025, Math.pow(u, 1.2)), 12), ivory));
  }
  // mouth + chewing jaw with grass
  const jaw = new THREE.Group(); jaw.position.set(0, -0.55, 0.55); head.add(jaw);
  jaw.add(mesh(new THREE.SphereGeometry(0.26, 12, 9), furD, { pos: [0, -0.05, 0.12], scale: [1, 0.6, 1.1] }));
  const grassM = new THREE.MeshStandardMaterial({ color: 0x57b032, roughness: 0.9, side: THREE.DoubleSide });
  const grass = new THREE.Group(); jaw.add(grass); grass.position.set(0.0, 0.05, 0.3);
  const RG = rng(8);
  for (let i = 0; i < 14; i++) { const b = mesh(new THREE.ConeGeometry(0.022, 0.5 + RG() * 0.25, 4), grassM, { pos: [(RG() - 0.5) * 0.36, -0.02, 0.1], rot: [1.3 + (RG() - 0.5) * 0.6, 0, (RG() - 0.5) * 1.6] }); b.geometry.translate(0, 0.25, 0); grass.add(b); }
  function update(t, o = {}) {
    const chew = o.chew ?? 1; const c = Math.sin(t * 9.5);
    jaw.position.y = -0.55 - 0.05 * chew * (0.5 + 0.5 * c); jaw.rotation.z = 0.10 * chew * Math.sin(t * 4.75); jaw.rotation.x = 0.08 * chew * c;
    grass.rotation.z = 0.25 * Math.sin(t * 4.75 + 1); grass.rotation.x = 0.1 * c;
    trunk.forEach((j, i) => { j.rotation.x = (i < 3 ? 0.10 : i < 7 ? -0.03 : -0.34) + 0.05 * Math.sin(t * 1.7 + i * 0.5) + (o.curl || 0) * -0.25; j.rotation.z = 0.045 * Math.sin(t * 1.2 + i * 0.7); });
    ears.forEach((e, i) => { e.rotation.y = (i ? 1 : -1) * (0.5 + 0.16 * Math.sin(t * 2.3 + i)); });
    const blinkP = (t + 0.4) % 3.1; const bl = blinkP < 0.14 ? Math.sin(blinkP / 0.14 * Math.PI) : 0;
    eyes.forEach(e => { e.lid.rotation.x = lerp(o.stare ? -0.72 : -0.45, 0.5, bl); e.pupil.position.x = (o.look?.[0] || 0) * 0.04; e.pupil.position.y = (o.look?.[1] || 0) * 0.04; e.brow.position.y = 0.16 + (o.brow || 0) * 0.05; });
    head.rotation.set((o.nod || 0) + 0.02 * Math.sin(t * 1.3), (o.turn || 0) + 0.03 * Math.sin(t * 0.9), 0.02 * Math.sin(t * 4.75) * chew);
    body.position.y = 0.02 * Math.sin(t * 1.6);
  }
  update(0);
  return { root, update, head, legs };
}

// ---------- dig site ----------
export function makeHole() {
  const g = new THREE.Group();
  const pit = mesh(new THREE.CircleGeometry(0.30, 28), new THREE.MeshBasicMaterial({ color: 0x120c07 }), { rot: [-Math.PI / 2, 0, 0], pos: [0, 0.03, 0], cast: false, receive: false }); g.add(pit);
  const inner = mesh(new THREE.CylinderGeometry(0.31, 0.24, 0.05, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a2716, roughness: 1, side: THREE.BackSide }), { pos: [0, 0.03, 0], cast: false }); g.add(inner);
  const rim = new THREE.Group(); const R = rng(3);
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; const r = 0.07 + R() * 0.05; rim.add(mesh(blobGeo(r, 1, 30 + i, 0.3, 1.5, [1.3, 0.7, 1]), MAT.soil, { pos: [Math.cos(a) * 0.36, 0.03, Math.sin(a) * 0.36], rot: [0, R() * 6, 0] })); }
  g.add(rim);
  const pile = new THREE.Group(); pile.position.set(0.72, 0, -0.25);
  pile.add(mesh(blobGeo(0.34, 2, 44, 0.22, 1.6, [1.2, 0.55, 1]), MAT.soil, { pos: [0, 0.07, 0] })); pile.add(mesh(blobGeo(0.2, 2, 45, 0.25, 1.6, [1, 0.6, 1]), MAT.soil, { pos: [0.22, 0.05, 0.2] }));
  g.add(pile);
  return { g, pit, rim, pile };
}
export function makeStick(len = 1.35) {
  const g = new THREE.Group();
  const s = mesh(tube(curvePts([[0, 0, 0], [0.012, len * 0.4, 0.006], [-0.008, len * 0.75, 0], [0, len, 0]], 12), (u) => lerp(0.024, 0.016, u), 8), MAT.bark); g.add(s);
  g.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), MAT.bark, { pos: [0, len, 0] }));
  g.userData.len = len;
  return g;
}
/** aim a +Y-aligned prop so that it runs from point a to point b */
export function placeBetween(obj, a, b) {
  obj.position.copy(a); const d = b.clone().sub(a).normalize(); obj.quaternion.setFromUnitVectors(V3(0, 1, 0), d);
}
export function makeStoneSeat() {
  const prof = [[0.13, 0.0], [0.40, 0.0], [0.44, 0.04], [0.45, 0.20], [0.44, 0.36], [0.40, 0.42], [0.22, 0.43], [0.17, 0.40], [0.15, 0.30], [0.13, 0.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const m = mesh(new THREE.LatheGeometry(prof, 30), MAT.stoneFlat);
  const g = new THREE.Group(); g.add(m);
  const R = rng(12);  // chiselled dents
  for (let i = 0; i < 9; i++) { const a = R() * TAU; g.add(mesh(new THREE.SphereGeometry(0.03 + R() * 0.03, 6, 5), MAT.rock, { pos: [Math.cos(a) * 0.44, 0.08 + R() * 0.26, Math.sin(a) * 0.44], scale: [1, 0.7, 1] })); }
  return g;
}
export function makeBowl() {
  const g = new THREE.Group();
  const out = new THREE.MeshStandardMaterial({ color: 0x6b4526, roughness: 1, map: TEX.fur });
  g.add(mesh(new THREE.SphereGeometry(0.15, 22, 12, 0, TAU, Math.PI / 2, Math.PI / 2), out));
  g.add(mesh(new THREE.SphereGeometry(0.138, 22, 12, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2e6cf, roughness: 0.7, side: THREE.BackSide })));
  g.add(mesh(new THREE.TorusGeometry(0.144, 0.008, 6, 24), new THREE.MeshStandardMaterial({ color: 0xe9dcc0, roughness: 0.8 }), { rot: [Math.PI / 2, 0, 0] }));
  const water = mesh(new THREE.CircleGeometry(0.132, 22), WATER(), { rot: [-Math.PI / 2, 0, 0], pos: [0, -0.02, 0], cast: false }); g.add(water);
  return { g, water };
}
export const WATER = (op = 0.86) => new THREE.MeshStandardMaterial({ color: 0x3aa8f2, roughness: 0.12, transparent: true, opacity: op, emissive: 0x0b4f8a, emissiveIntensity: 0.35 });
/** bamboo pipe along +X, from x=0 to x=len */
export function makePipe(len = 1.6, r = 0.085) {
  const g = new THREE.Group(); const t = TEX.bamboo.clone(); t.repeat.set(1, Math.max(1, Math.round(len / 0.5)) / 2); t.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(r, r, len, 16, 1, true), mat, { pos: [len / 2, 0, 0], rot: [0, 0, Math.PI / 2] }));
  const nodeM = new THREE.MeshStandardMaterial({ color: 0x6f8d2a, roughness: 0.6 });
  const nn = Math.max(2, Math.round(len / 0.5) + 1);
  for (let i = 0; i < nn; i++) g.add(mesh(new THREE.TorusGeometry(r * 1.03, r * 0.13, 6, 16), nodeM, { pos: [i / (nn - 1) * len, 0, 0], rot: [0, Math.PI / 2, 0] }));
  g.add(mesh(new THREE.CircleGeometry(r * 0.82, 14), MAT.dark, { pos: [len + 0.001, 0, 0], rot: [0, Math.PI / 2, 0], cast: false }));
  g.add(mesh(new THREE.CircleGeometry(r * 0.82, 14), MAT.dark, { pos: [-0.001, 0, 0], rot: [0, -Math.PI / 2, 0], cast: false }));
  return g;
}

// ---------- the real toilet + stone hut ----------
export function makeToilet() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xdfe4ea, roughness: 0.10, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.05, envMap: ENV, envMapIntensity: 0.9 });
  const prof = [[0.0, 0.0], [0.15, 0.0], [0.17, 0.02], [0.165, 0.08], [0.12, 0.17], [0.125, 0.24], [0.175, 0.33], [0.215, 0.385], [0.225, 0.41], [0.212, 0.42], [0.185, 0.405], [0.13, 0.33], [0.07, 0.27], [0.0, 0.26]].map(([r, y]) => new THREE.Vector2(r, y));
  const bowl = mesh(new THREE.LatheGeometry(prof, 36), white, { scale: [1, 1, 1.28] }); bowl.material.side = THREE.DoubleSide; g.add(bowl);
  const water = mesh(new THREE.CircleGeometry(0.11, 22), WATER(0.9), { rot: [-Math.PI / 2, 0, 0], pos: [0, 0.30, 0], scale: [1, 1.28, 1], cast: false }); g.add(water);
  const seatMat = new THREE.MeshPhysicalMaterial({ color: 0xe6eaef, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, envMap: ENV, envMapIntensity: 0.8, emissive: 0xff5a1e, emissiveIntensity: 0 });
  const seat = mesh(new THREE.TorusGeometry(0.19, 0.036, 12, 36), seatMat, { pos: [0, 0.432, 0.0], rot: [Math.PI / 2, 0, 0], scale: [1, 1.28, 0.5] }); g.add(seat);
  const lid = mesh(new THREE.SphereGeometry(0.225, 26, 14), white, { pos: [0, 0.665, -0.255], rot: [-0.20, 0, 0], scale: [1, 1.18, 0.10] }); g.add(lid);
  g.add(mesh(new THREE.BoxGeometry(0.30, 0.05, 0.08), white, { pos: [0, 0.43, -0.27] }));
  const tank = mesh(roundBox(0.46, 0.40, 0.19, 0.045), white, { pos: [0, 0.63, -0.39] }); g.add(tank);
  g.add(mesh(roundBox(0.50, 0.05, 0.225, 0.02), white, { pos: [0, 0.852, -0.39] }));
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.15, metalness: 1, envMap: ENV });
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 16), chrome, { pos: [0, 0.884, -0.39] }));
  g.add(mesh(new THREE.BoxGeometry(0.30, 0.42, 0.16), white, { pos: [0, 0.21, -0.36] }));
  return { g, seat, seatMat, lid, white, water };
}
export function roundBox(w, h, d, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r * 0.5, bevelEnabled: true, bevelThickness: r * 0.5, bevelSize: r * 0.5, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - r) / 2); return g;
}
export const HUT = { W: 2.9, D: 2.7, H: 3.1, T: 0.24, doorW: 1.05, doorH: 2.05 };
export function makeToiletHut() {
  const { W, D, H, T, doorW, doorH } = HUT; const g = new THREE.Group();
  const sm = (rx, ry) => { const t = TEX.stone.clone(); t.repeat.set(rx, ry); t.needsUpdate = true; return new THREE.MeshLambertMaterial({ map: t }); };
  const back = mesh(new THREE.BoxGeometry(W, H, T), sm(2.2, 2.4), { pos: [0, H / 2, -D / 2 + T / 2] });
  const left = mesh(new THREE.BoxGeometry(T, H, D), sm(2.0, 2.4), { pos: [-W / 2 + T / 2, H / 2, 0] });
  const right = mesh(new THREE.BoxGeometry(T, H, D), sm(2.0, 2.4), { pos: [W / 2 - T / 2, H / 2, 0] });
  const front = new THREE.Group(); const sw = (W - doorW) / 2;
  front.add(mesh(new THREE.BoxGeometry(sw, H, T), sm(0.75, 2.4), { pos: [-(doorW + sw) / 2, H / 2, D / 2 - T / 2] }));
  front.add(mesh(new THREE.BoxGeometry(sw, H, T), sm(0.75, 2.4), { pos: [(doorW + sw) / 2, H / 2, D / 2 - T / 2] }));
  front.add(mesh(new THREE.BoxGeometry(doorW, H - doorH, T), sm(0.8, 0.8), { pos: [0, doorH + (H - doorH) / 2, D / 2 - T / 2] }));
  // wooden door frame
  for (const s of [-1, 1]) front.add(mesh(new THREE.BoxGeometry(0.1, doorH + 0.06, T + 0.06), MAT.woodDark, { pos: [s * (doorW / 2 + 0.02), doorH / 2, D / 2 - T / 2] }));
  front.add(mesh(new THREE.BoxGeometry(doorW + 0.24, 0.12, T + 0.08), MAT.woodDark, { pos: [0, doorH + 0.05, D / 2 - T / 2] }));
  const floorT = TEX.stone.clone(); floorT.repeat.set(1.6, 1.6); floorT.needsUpdate = true;
  const floor = mesh(new THREE.BoxGeometry(W - 0.1, 0.06, D - 0.1), new THREE.MeshLambertMaterial({ map: floorT, color: 0xd9d2c6 }), { pos: [0, 0.03, 0], cast: false });
  // roof: thatch pyramid with an overhang
  const roof = new THREE.Group();
  const rm = MAT.thatch;
  roof.add(mesh(new THREE.ConeGeometry(W * 0.86, 1.25, 4, 1), rm, { pos: [0, H + 0.6, 0], rot: [0, Math.PI / 4, 0] }));
  roof.add(mesh(new THREE.ConeGeometry(W * 0.62, 0.95, 4, 1), rm, { pos: [0, H + 1.05, 0], rot: [0, Math.PI / 4, 0] }));
  roof.add(mesh(new THREE.BoxGeometry(W + 0.5, 0.1, D + 0.5), MAT.woodDark, { pos: [0, H + 0.02, 0] }));
  // door: planks, braces, hinges, handle (pivot on its left edge)
  const door = new THREE.Group(); door.position.set(-doorW / 2 + 0.01, 0, D / 2 - 0.02);
  const dt = TEX.wood.clone(); dt.repeat.set(1, 1); dt.needsUpdate = true;
  const panel = mesh(new THREE.BoxGeometry(doorW - 0.04, doorH - 0.04, 0.07), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.85 }), { pos: [doorW / 2 - 0.01, doorH / 2, 0] }); door.add(panel);
  for (const y of [0.42, 1.60]) door.add(mesh(new THREE.BoxGeometry(doorW - 0.08, 0.13, 0.03), MAT.woodDark, { pos: [doorW / 2 - 0.01, y, 0.045] }));
  door.add(mesh(new THREE.BoxGeometry(1.42, 0.11, 0.03), MAT.woodDark, { pos: [doorW / 2 - 0.01, 1.01, 0.045], rot: [0, 0, 0.88] }));
  const iron = new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.6, metalness: 0.6 });
  for (const y of [0.42, 1.60]) door.add(mesh(new THREE.BoxGeometry(0.34, 0.07, 0.035), iron, { pos: [0.16, y, 0.062] }));
  door.add(mesh(new THREE.TorusGeometry(0.06, 0.013, 8, 18), iron, { pos: [doorW - 0.2, 1.02, 0.07] }));
  // tiny crescent-moon cut-out, outhouse style
  const moon = mesh(new THREE.CircleGeometry(0.085, 20), MAT.dark, { pos: [doorW / 2 - 0.01, 1.72, 0.0365], cast: false }); door.add(moon);
  door.add(mesh(new THREE.CircleGeometry(0.075, 20), new THREE.MeshStandardMaterial({ map: dt, roughness: 0.85 }), { pos: [doorW / 2 + 0.035, 1.735, 0.037], cast: false }));
  g.add(back, left, right, front, floor, roof, door);
  // window on the back wall (bright sky pane + frame)
  const win = new THREE.Group(); win.position.set(-0.86, 2.12, -D / 2 + T + 0.006);
  win.add(mesh(new THREE.PlaneGeometry(0.46, 0.46), new THREE.MeshBasicMaterial({ color: 0x8fc8ff }), { cast: false }));
  for (const [w2, h2, x, y] of [[0.56, 0.06, 0, 0.25], [0.56, 0.06, 0, -0.25], [0.06, 0.56, 0.25, 0], [0.06, 0.56, -0.25, 0], [0.04, 0.46, 0, 0], [0.46, 0.04, 0, 0]]) win.add(mesh(new THREE.BoxGeometry(w2, h2, 0.05), MAT.woodDark, { pos: [x, y, 0.02] }));
  g.add(win);
  return { g, back, left, right, front, floor, roof, door, win };
}
export function makePhone() {
  const g = new THREE.Group();
  g.add(mesh(roundBox(0.074, 0.152, 0.011, 0.008), new THREE.MeshStandardMaterial({ color: 0x16171c, roughness: 0.35, metalness: 0.4 })));
  const tex = canvasTex(128, 512, (c, w, h) => {
    c.fillStyle = '#f4f6fb'; c.fillRect(0, 0, w, h); const R = rng(5); const cols = ['#ff5f8f', '#3ec6ff', '#ffc93e', '#7be36b', '#b07bff', '#ff8a3e'];
    for (let i = 0; i < 8; i++) { const y = i * 64 + 4; c.fillStyle = cols[i % cols.length]; c.beginPath(); c.roundRect(6, y, 116, 40, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(24, y + 20, 10, 0, TAU); c.fill(); c.fillStyle = '#c9cfdb'; c.fillRect(8, y + 46, 70 + R() * 40, 5); c.fillRect(8, y + 54, 40 + R() * 40, 4); c.fillStyle = '#ff4d6d'; c.beginPath(); c.arc(112, y + 53, 4, 0, TAU); c.fill(); }
  });
  tex.repeat.set(1, 0.42);
  const screen = mesh(new THREE.PlaneGeometry(0.066, 0.142), new THREE.MeshBasicMaterial({ map: tex }), { pos: [0, 0, 0.0062], cast: false }); g.add(screen);
  const glow = new THREE.PointLight(0xbfdcff, 0, 1.4, 1.6); glow.position.set(0, 0, 0.12); g.add(glow);
  return { g, tex, glow, screen };
}
export function makeClock() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.30, 0.31, 0.07, 28), MAT.stoneFlat, { rot: [Math.PI / 2, 0, 0] }));
  g.add(mesh(new THREE.TorusGeometry(0.295, 0.028, 8, 28), MAT.rock, { pos: [0, 0, 0.03] }));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(mesh(new THREE.BoxGeometry(0.022, i % 3 ? 0.04 : 0.075, 0.012), MAT.dark, { pos: [Math.sin(a) * 0.235, Math.cos(a) * 0.235, 0.04], rot: [0, 0, -a] })); }
  const hm = new THREE.MeshStandardMaterial({ color: 0x3a2413, roughness: 0.8 });
  const minute = new THREE.Group(); minute.add(mesh(new THREE.BoxGeometry(0.024, 0.22, 0.012), hm, { pos: [0, 0.10, 0.05] })); g.add(minute);
  const hour = new THREE.Group(); hour.add(mesh(new THREE.BoxGeometry(0.032, 0.15, 0.012), hm, { pos: [0, 0.065, 0.058] })); g.add(hour);
  g.add(mesh(new THREE.SphereGeometry(0.026, 10, 8), hm, { pos: [0, 0, 0.058] }));
  return { g, minute, hour };
}
export function makeSpeaker() {
  const g = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.30, 24), bodyM, { pos: [0, 0.15, 0] }));
  const grille = canvasTex(128, 128, (c) => { c.fillStyle = '#2f333d'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#0d0e12'; for (let y = 4; y < 128; y += 9) for (let x = 4 + (y % 18 ? 0 : 4); x < 128; x += 9) { c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); } }); grille.repeat.set(4, 1.4);
  g.add(mesh(new THREE.CylinderGeometry(0.113, 0.113, 0.21, 24, 1, true), new THREE.MeshStandardMaterial({ map: grille, roughness: 0.7 }), { pos: [0, 0.15, 0] }));
  const led = new THREE.MeshStandardMaterial({ color: 0x35b6ff, emissive: 0x2aa6ff, emissiveIntensity: 2.2 });
  g.add(mesh(new THREE.TorusGeometry(0.112, 0.008, 6, 28), led, { pos: [0, 0.27, 0], rot: [Math.PI / 2, 0, 0], cast: false }));
  g.add(mesh(new THREE.TorusGeometry(0.112, 0.008, 6, 28), led, { pos: [0, 0.03, 0], rot: [Math.PI / 2, 0, 0], cast: false }));
  return g;
}
export function makeShelf() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.46, 0.04, 0.20), MAT.wood, { pos: [0, 0, 0.10] }));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.035, 0.16, 0.035), MAT.woodDark, { pos: [s * 0.17, -0.09, 0.03], rot: [0.5, 0, 0] }));
  return g;
}

// ---------- cutaway village (pipes under the huts) ----------
export function makeCutaway() {
  const g = new THREE.Group();
  const st = TEX.soil.clone(); st.repeat.set(9, 3.4); st.needsUpdate = true;
  g.add(mesh(new THREE.BoxGeometry(60, 16, 16), new THREE.MeshLambertMaterial({ map: st }), { pos: [0, -8, -8], cast: false }));
  g.add(mesh(new THREE.PlaneGeometry(60, 16), MAT.grass, { rot: [-Math.PI / 2, 0, 0], pos: [0, 0.02, -8], cast: false }));
  g.add(mesh(new THREE.BoxGeometry(60, 0.34, 0.5), new THREE.MeshStandardMaterial({ color: 0x55b337, roughness: 1 }), { pos: [0, -0.1, 0.08], cast: false }));
  // darker topsoil band + embedded rocks and a fossil bone
  g.add(mesh(new THREE.PlaneGeometry(60, 1.1), new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 1, transparent: true, opacity: 0.55 }), { pos: [0, -0.8, 0.012], cast: false }));
  const R = rng(21);
  for (let i = 0; i < 26; i++) { const r = 0.2 + R() * 0.45; g.add(mesh(blobGeo(r, 2, 80 + i, 0.25, 1.4, [1.2, 0.8, 0.5]), MAT.rock, { pos: [(R() - 0.5) * 16, -1.5 - R() * 9.5, 0.0], cast: false })); }
  const boneM = new THREE.MeshStandardMaterial({ color: 0xf0e8d2, roughness: 0.8 });
  const bone = new THREE.Group(); bone.add(mesh(new THREE.CapsuleGeometry(0.07, 0.9, 4, 8), boneM, { rot: [0, 0, Math.PI / 2] })); for (const sx of [-1, 1]) for (const sy of [-1, 1]) bone.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), boneM, { pos: [sx * 0.5, sy * 0.07, 0] }));
  bone.position.set(-3.2, -4.6, 0.08); bone.rotation.z = 0.4; g.add(bone);
  const huts = [];
  for (const [x, z, s] of [[-4.3, -2.6, 0.95], [0, -3.4, 1.02], [4.3, -2.6, 0.95], [-8.5, -6, 1], [8.6, -6.5, 1], [-1.5, -9, 1.05], [3.5, -10, 1]]) { const h = makeHut((x * 7 + 40) | 0, s); h.position.set(x, 0, z); h.rotation.y = x * 0.08; g.add(h); huts.push(h); }
  // pipe network drawn on the cut face (z ~ 0.25): segments pop in one after another
  const segs = []; const add = (x0, y0, x1, y1, r = 0.17) => { const len = Math.hypot(x1 - x0, y1 - y0); const p = makePipe(len, r); p.position.set(x0, y0, 0.3); p.rotation.z = Math.atan2(y1 - y0, x1 - x0); g.add(p); segs.push({ p, a: [x0, y0], b: [x1, y1], len }); const j = mesh(new THREE.SphereGeometry(r * 1.25, 12, 10), new THREE.MeshStandardMaterial({ color: 0x7e9a30, roughness: 0.6 }), { pos: [x1, y1, 0.3] }); g.add(j); segs[segs.length - 1].j = j; };
  add(-4.3, -0.15, -4.3, -1.75); add(0, -0.15, 0, -2.25); add(4.3, -0.15, 4.3, -2.75);
  add(-5.6, -1.6, -4.3, -1.75, 0.2); add(-4.3, -1.75, 0, -2.25, 0.2); add(0, -2.25, 4.3, -2.75, 0.2); add(4.3, -2.75, 5.6, -2.9, 0.2);
  add(5.6, -2.9, 5.6, -5.6, 0.22); add(5.6, -5.6, 0.5, -6.3, 0.22); add(0.5, -6.3, -7.5, -7.4, 0.22);
  // water blobs flowing through
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x59c4ff }), 40); drops.frustumCulled = false; g.add(drops);
  const path = [[-5.6, -1.6], [-4.3, -1.75], [0, -2.25], [4.3, -2.75], [5.6, -2.9], [5.6, -5.6], [0.5, -6.3], [-7.5, -7.4]];
  const plen = []; let tot = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); plen.push(l); tot += l; }
  const d = new THREE.Object3D();
  function update(t, grow, flow) {
    segs.forEach((s, i) => { const k = backOut(clamp((grow - i * 0.085) / 0.16)); s.p.scale.set(Math.max(0.001, k), 1, 1); s.p.visible = k > 0.002; s.j.visible = k > 0.9; });
    for (let i = 0; i < 40; i++) {
      let dist = ((t * 5.2 + i * tot / 40) % tot); let j = 0; while (j < plen.length - 1 && dist > plen[j]) { dist -= plen[j]; j++; }
      const u = dist / plen[j]; d.position.set(lerp(path[j][0], path[j + 1][0], u), lerp(path[j][1], path[j + 1][1], u), 0.56); d.scale.setScalar(flow > 0 ? 0.8 + 0.3 * Math.sin(i * 3) : 0); d.updateMatrix(); drops.setMatrixAt(i, d.matrix);
    }
    drops.instanceMatrix.needsUpdate = true;
  }
  return { g, update, huts };
}
