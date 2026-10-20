// The traffic jam: chunky toy-like cars (instanced) with little drivers, brake lights on,
// plus the city bus John lands on. No brands or logos anywhere.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT as L } from './layout.js';
import { merge, xf } from './geo.js';
import { rng } from './util.js';
import { textTex, contactShadowTex } from './tex.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
export const PALETTE = [
  [0.96, 0.36, 0.33], [1.0, 0.78, 0.18], [0.16, 0.70, 0.72], [0.45, 0.82, 0.55], [0.36, 0.62, 0.95], [0.66, 0.50, 0.92],
  [1.0, 0.56, 0.22], [0.98, 0.52, 0.70], [0.62, 0.84, 0.24], [0.20, 0.42, 0.85], [0.95, 0.90, 0.80], [0.35, 0.36, 0.40],
];

// ---- toy car designs (local: +X forward, ground y=0) ----
function carType(kind) {
  const rb = (w, h, d, r, p, seg = 2) => xf(new RoundedBoxGeometry(w, h, d, seg, r), { p });
  const bx = (w, h, d, p) => xf(new THREE.BoxGeometry(w, h, d), { p });
  // dims: len, body height, cabin (length, x-offset, window height), wheel radius, axles, track
  const D = {
    hatch: { len: 3.7, bodyTop: 0.92, cabL: 2.0, cabX: -0.32, win: 0.5, wr: 0.38, axles: [1.18, -1.18], track: 0.8, w: 1.74, head: [-0.3, 1.18, -0.36] },
    sedan: { len: 4.3, bodyTop: 0.88, cabL: 2.2, cabX: -0.15, win: 0.46, wr: 0.37, axles: [1.42, -1.38], track: 0.81, w: 1.78, head: [-0.2, 1.14, -0.37] },
    van:   { len: 4.6, bodyTop: 1.02, cabL: 3.3, cabX: -0.42, win: 0.56, wr: 0.40, axles: [1.52, -1.47], track: 0.85, w: 1.86, head: [0.6, 1.3, -0.4] },
    truck: { len: 4.5, bodyTop: 0.86, cabL: 1.45, cabX: 1.36, win: 0.52, wr: 0.39, axles: [1.46, -1.42], track: 0.83, w: 1.8, head: [1.32, 1.12, -0.38] },
  }[kind];
  const T = { len: D.len, wr: D.wr, axles: D.axles, track: D.track, head: D.head };
  const W = D.w, bodyH = D.bodyTop - 0.3, yb = 0.3 + bodyH / 2;
  const cw = W - 0.16, cyb = D.bodyTop, cyt = D.bodyTop + D.win;
  const paint = [rb(D.len, bodyH, W, 0.3, [0, yb, 0]), rb(D.cabL, 0.16, cw, 0.07, [D.cabX, cyt + 0.06, 0])];
  // four pillars
  for (const sx of [1, -1]) for (const sz of [1, -1]) paint.push(bx(0.13, D.win + 0.08, 0.13, [D.cabX + sx * (D.cabL / 2 - 0.08), (cyb + cyt) / 2, sz * (cw / 2 - 0.07)]));
  if (kind === 'truck') paint.push(rb(2.6, 0.5, W, 0.1, [-0.85, D.bodyTop + 0.2, 0], 1));
  T.paint = merge(paint);
  T.glass = rb(D.cabL - 0.04, D.win + 0.02, cw - 0.03, 0.08, [D.cabX, (cyb + cyt) / 2, 0]);
  T.interior = merge([bx(D.cabL - 0.3, 0.3, cw - 0.25, [D.cabX, cyb + 0.05, 0])]);
  const L2 = D.len / 2;
  const wheels = [], hubs = [];
  for (const ax of D.axles) for (const s of [1, -1]) {
    wheels.push(xf(new THREE.CylinderGeometry(D.wr, D.wr, 0.28, 14), { p: [ax, D.wr, D.track * s], r: [Math.PI / 2, 0, 0] }));
    hubs.push(xf(new THREE.CircleGeometry(D.wr * 0.55, 12), { p: [ax, D.wr, (D.track + 0.142) * s], r: [0, s > 0 ? 0 : Math.PI, 0] }));
  }
  T.wheels = merge(wheels); T.hubs = merge(hubs);
  T.trim = merge([rb(0.22, 0.24, W - 0.06, 0.1, [L2 - 0.02, 0.44, 0], 1), rb(0.22, 0.24, W - 0.06, 0.1, [-L2 + 0.02, 0.44, 0], 1)]);
  T.headl = merge([xf(new THREE.SphereGeometry(0.12, 8, 6), { p: [L2 - 0.03, 0.74, 0.56], s: [0.5, 1, 1] }), xf(new THREE.SphereGeometry(0.12, 8, 6), { p: [L2 - 0.03, 0.74, -0.56], s: [0.5, 1, 1] })]);
  T.taill = merge([bx(0.08, 0.16, 0.36, [-L2, 0.76, 0.6]), bx(0.08, 0.16, 0.36, [-L2, 0.76, -0.6])]);
  return T;
}

export function buildTraffic(ctx) {
  const group = new THREE.Group();
  const R = rng(321);
  const kinds = ['hatch', 'sedan', 'van', 'truck'];
  const types = Object.fromEntries(kinds.map((k) => [k, carType(k)]));
  // ---- slots ----
  const cars = [];
  const pick = () => { const r = R(); return r < 0.36 ? 'hatch' : r < 0.68 ? 'sedan' : r < 0.86 ? 'van' : 'truck'; };
  // lane A: three cars ahead of John, then the bus, then the rest
  let x = 5.75;
  const laneA = [];
  for (let i = 0; i < 3; i++) { const k = i === 1 ? 'sedan' : 'hatch'; laneA.push({ k, x, z: L.laneA }); x += types[k].len / 2 + 1.25 + types[k === 'hatch' ? 'sedan' : 'hatch'].len / 2 * 0 + 2.0; }
  // fixed nice spacing for the first three
  laneA[0].x = 5.6; laneA[1].x = 11.0; laneA[2].x = 16.3;
  x = L.busX + L.busLen / 2 + 3.3;
  while (x < L.jamEnd - 2) { const k = pick(); laneA.push({ k, x, z: L.laneA }); x += types[k].len + 1.1 + R() * 0.8; }
  let xb = -3.6;
  const laneB = [];
  while (xb < L.jamEnd - 3) { const k = pick(); laneB.push({ k, x: xb, z: L.laneB }); xb += types[k].len + 1.1 + R() * 0.9; }
  for (const c of [...laneA, ...laneB]) cars.push({ ...c, yaw: 0, col: PALETTE[Math.floor(R() * PALETTE.length)] });
  // a few cars queued in cross streets (both directions), to keep the city busy
  for (const [a, b] of L.cross) {
    for (let k = 0; k < 4; k++) cars.push({ k: pick(), x: a + 3.2, z: L.roadFar - 7 - k * 5.4, yaw: Math.PI / 2, col: PALETTE[Math.floor(R() * PALETTE.length)] });
    for (let k = 0; k < 3; k++) cars.push({ k: pick(), x: b - 3.2, z: L.roadFar - 9 - k * 5.4, yaw: -Math.PI / 2, col: PALETTE[Math.floor(R() * PALETTE.length)] });
  }
  // colour for the three cars John clears: bright & distinct
  laneA[0].col = PALETTE[0]; laneA[1].col = PALETTE[2]; laneA[2].col = PALETTE[1];
  const firstCars = laneA.slice(0, 3);

  const M = {
    paint: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.06 }),
    glass: new THREE.MeshPhysicalMaterial({ color: lin(0.10, 0.13, 0.16), roughness: 0.05, transparent: true, opacity: 0.42, envMapIntensity: 1.6, depthWrite: false }),
    rubber: new THREE.MeshStandardMaterial({ color: lin(0.05, 0.05, 0.055), roughness: 0.7 }),
    hub: new THREE.MeshStandardMaterial({ color: lin(0.85, 0.86, 0.88), roughness: 0.3, metalness: 0.7 }),
    trim: new THREE.MeshStandardMaterial({ color: lin(0.16, 0.16, 0.18), roughness: 0.55 }),
    headl: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.92, 0.75).multiplyScalar(2.2) }),
    taill: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.06, 0.04).multiplyScalar(7.5) }),
    skin: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    hair: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
    eyeW: new THREE.MeshStandardMaterial({ color: lin(0.98, 0.98, 0.97), roughness: 0.2 }),
    eyeP: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  };
  const skinTones = [[0.96, 0.78, 0.64], [0.86, 0.64, 0.48], [0.66, 0.46, 0.32], [0.45, 0.30, 0.20], [0.98, 0.84, 0.72], [0.76, 0.56, 0.40]];
  const hairCols = [[0.15, 0.1, 0.07], [0.35, 0.22, 0.12], [0.9, 0.75, 0.45], [0.08, 0.07, 0.07], [0.6, 0.3, 0.15], [0.7, 0.7, 0.72]];
  const headG = new THREE.SphereGeometry(0.17, 10, 8);
  const hairG = xf(new THREE.SphereGeometry(0.178, 10, 5, 0, Math.PI * 2, 0, 1.3), { r: [0, 0, 0.4] });
  const eyeWG = merge([xf(new THREE.SphereGeometry(0.045, 8, 6), { p: [0.15, 0.03, 0.06] }), xf(new THREE.SphereGeometry(0.045, 8, 6), { p: [0.15, 0.03, -0.06] })]);
  const eyePG = merge([xf(new THREE.SphereGeometry(0.022, 6, 4), { p: [0.19, 0.03, 0.062] }), xf(new THREE.SphereGeometry(0.022, 6, 4), { p: [0.19, 0.03, -0.062] })]);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = V(1, 1, 1);
  const meshes = [];
  const CH = 70;
  const chunks = new Map();
  for (const c of cars) { const key = c.k + ':' + Math.floor(c.x / CH); if (!chunks.has(key)) chunks.set(key, []); chunks.get(key).push(c); }
  for (const [key, list] of chunks) {
    const k = key.split(':')[0];
    const T = types[k];
    const parts = [['paint', T.paint, true], ['glass', T.glass, false], ['trim', T.interior, false], ['rubber', T.wheels, true], ['hub', T.hubs, false], ['trim', T.trim, true], ['headl', T.headl, false], ['taill', T.taill, false]];
    for (const [mk, geo, cast] of parts) {
      const im = new THREE.InstancedMesh(geo, M[mk], list.length);
      list.forEach((c, i) => {
        q.setFromEuler(new THREE.Euler(0, c.yaw, 0));
        m4.compose(V(c.x, 0, c.z), q, one); im.setMatrixAt(i, m4);
        if (mk === 'paint') im.setColorAt(i, lin(...c.col));
      });
      im.castShadow = cast; im.receiveShadow = mk !== 'glass';
      if (mk === 'glass') im.renderOrder = 2;
      im.computeBoundingSphere();
      group.add(im); meshes.push(im);
    }
    // drivers
    const hIm = new THREE.InstancedMesh(headG, M.skin, list.length), hrIm = new THREE.InstancedMesh(hairG, M.hair, list.length);
    const ewIm = new THREE.InstancedMesh(eyeWG, M.eyeW, list.length), epIm = new THREE.InstancedMesh(eyePG, M.eyeP, list.length);
    list.forEach((c, i) => {
      q.setFromEuler(new THREE.Euler(0, c.yaw, 0));
      const hp = V(...T.head).applyQuaternion(q).add(V(c.x, 0, c.z));
      const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, c.yaw + (R() - 0.5) * 0.9, 0));
      m4.compose(hp, look, one);
      hIm.setMatrixAt(i, m4); hrIm.setMatrixAt(i, m4); ewIm.setMatrixAt(i, m4); epIm.setMatrixAt(i, m4);
      hIm.setColorAt(i, lin(...skinTones[Math.floor(R() * skinTones.length)]));
      hrIm.setColorAt(i, lin(...hairCols[Math.floor(R() * hairCols.length)]));
    });
    for (const im of [hIm, hrIm, ewIm, epIm]) { im.computeBoundingSphere(); group.add(im); }
  }

  // soft contact shadows (fake ambient occlusion) under every car
  const shTex = contactShadowTex();
  const shMat = new THREE.MeshBasicMaterial({ map: shTex, color: 0x000000, transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 });
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2);
  const shIm = new THREE.InstancedMesh(shGeo, shMat, cars.length + 1);
  cars.forEach((c, i) => { const T = types[c.k]; q.setFromEuler(new THREE.Euler(0, c.yaw, 0)); m4.compose(V(c.x, 0.012, c.z), q, V(T.len + 0.7, 1, 2.35)); shIm.setMatrixAt(i, m4); });
  q.identity(); m4.compose(V(L.busX, 0.012, L.laneA), q, V(L.busLen + 1.2, 1, 3.2)); shIm.setMatrixAt(cars.length, m4);
  shIm.renderOrder = 1; shIm.computeBoundingSphere(); group.add(shIm);

  const bus = buildBus();
  bus.root.position.set(L.busX, 0, L.laneA);
  group.add(bus.root);
  return { group, cars, firstCars, bus, mats: M };
}

// ---------------- the bus ----------------
function buildBus() {
  const root = new THREE.Group();     // ground anchor
  const wob = new THREE.Group();       // wobble / squash pivot (at axle line)
  root.add(wob);
  const len = L.busLen, H = 2.86, W = 2.5, y0 = 0.36;
  const rb = (w, h, d, r, p, s = 3) => xf(new RoundedBoxGeometry(w, h, d, s, r), { p });
  const M = {
    body: new THREE.MeshPhysicalMaterial({ color: lin(1.0, 0.72, 0.16), roughness: 0.34, clearcoat: 1.0, clearcoatRoughness: 0.07 }),
    roof: new THREE.MeshPhysicalMaterial({ color: lin(0.97, 0.96, 0.93), roughness: 0.4, clearcoat: 0.6 }),
    stripe: new THREE.MeshPhysicalMaterial({ color: lin(0.10, 0.62, 0.66), roughness: 0.35, clearcoat: 1.0 }),
    glass: new THREE.MeshPhysicalMaterial({ color: lin(0.08, 0.11, 0.14), roughness: 0.05, transparent: true, opacity: 0.6, envMapIntensity: 1.4, depthWrite: false }),
    dark: new THREE.MeshStandardMaterial({ color: lin(0.12, 0.12, 0.13), roughness: 0.6 }),
    rubber: new THREE.MeshStandardMaterial({ color: lin(0.05, 0.05, 0.055), roughness: 0.7 }),
    hub: new THREE.MeshStandardMaterial({ color: lin(0.8, 0.8, 0.82), roughness: 0.3, metalness: 0.7 }),
    headl: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.92, 0.75).multiplyScalar(2.5) }),
    taill: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.06, 0.04).multiplyScalar(7) }),
    sign: new THREE.MeshBasicMaterial({ map: textTex('8', { w: 256, h: 128, font: 'bold 110px DejaVu Sans, sans-serif', fill: '#ffb21e', bg: '#140d05', glow: 18 }) }),
  };
  M.sign.color.setScalar(3.0);
  const add = (g, m, cast = true) => { const mesh = new THREE.Mesh(g, m); mesh.castShadow = cast; mesh.receiveShadow = true; wob.add(mesh); return mesh; };
  add(rb(len, H * 0.62, W, 0.32, [0, y0 + H * 0.31, 0]), M.body);
  add(rb(len - 0.02, H * 0.42, W - 0.02, 0.4, [0, y0 + H * 0.79, 0]), M.roof);
  add(rb(len + 0.02, 0.16, W + 0.02, 0.06, [0, y0 + H * 0.56, 0]), M.stripe);
  const glass = add(rb(len - 1.6, 0.98, W + 0.03, 0.18, [-0.35, y0 + H * 0.71, 0]), M.glass, false); glass.renderOrder = 2;
  const ws = add(rb(0.12, 1.5, W - 0.2, 0.06, [len / 2 - 0.02, y0 + H * 0.66, 0]), M.glass, false); ws.renderOrder = 2;
  add(rb(0.14, 0.42, 1.6, 0.06, [len / 2 + 0.01, y0 + H * 0.93, 0]), M.dark);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.34), M.sign); sign.position.set(len / 2 + 0.085, y0 + H * 0.93, 0); sign.rotation.y = Math.PI / 2; wob.add(sign);
  // front door outline, skirt, bumpers
  add(rb(0.04, 1.9, 1.0, 0.02, [len / 2 - 1.3, y0 + 1.0, W / 2 + 0.005]), M.dark);
  add(rb(len + 0.1, 0.3, W + 0.04, 0.1, [0, y0 + 0.1, 0]), M.dark);
  add(rb(0.3, 0.32, W, 0.1, [len / 2 + 0.05, y0 + 0.18, 0]), M.dark);
  add(rb(0.3, 0.32, W, 0.1, [-len / 2 - 0.05, y0 + 0.18, 0]), M.dark);
  // roof AC unit (front part of the roof, so the rear part is free for landing)
  add(rb(2.4, 0.32, 1.5, 0.12, [len / 2 - 2.3, y0 + H + 0.12, 0]), M.roof);
  // lights
  for (const s of [1, -1]) {
    add(xf(new THREE.SphereGeometry(0.16, 12, 8), { p: [len / 2 + 0.06, y0 + 0.5, 0.85 * s], s: [0.4, 1, 1] }), M.headl, false);
    add(rb(0.08, 0.5, 0.22, 0.05, [-len / 2 - 0.02, y0 + 0.85, 1.0 * s]), M.taill, false);
  }
  // wheels
  const wheels = [];
  for (const ax of [len / 2 - 2.2, -len / 2 + 2.6]) for (const s of [1, -1]) {
    const w = new THREE.Group(); w.position.set(ax, 0.52, 1.0 * s); root.add(w);
    const tire = new THREE.Mesh(xf(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 24), { r: [Math.PI / 2, 0, 0] }), M.rubber); tire.castShadow = true; w.add(tire);
    const hub = new THREE.Mesh(xf(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 18), { p: [0, 0, 0.175 * s], r: [Math.PI / 2, 0, 0] }), M.hub); w.add(hub);
    wheels.push(w);
  }
  // passengers (heads in windows), they look up after the bonk
  const pax = [];
  const PR = rng(55);
  const skin = [[0.96, 0.78, 0.64], [0.66, 0.46, 0.32], [0.86, 0.64, 0.48], [0.45, 0.30, 0.20]];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    g.position.set(-4.2 + i * 1.25 + PR() * 0.2, y0 + H * 0.66, 0.55 + PR() * 0.3);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshStandardMaterial({ color: lin(...skin[i % 4]), roughness: 0.6 }));
    const hr = new THREE.Mesh(xf(new THREE.SphereGeometry(0.21, 16, 8, 0, Math.PI * 2, 0, 1.3), { r: [0, 0, 0.3] }), new THREE.MeshStandardMaterial({ color: lin(...[[0.15, 0.1, 0.07], [0.6, 0.35, 0.15], [0.08, 0.07, 0.07], [0.85, 0.7, 0.4]][i % 4]), roughness: 0.6 }));
    const eyes = new THREE.Group(); g.add(hd, hr, eyes);
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })); e.position.set(0.07, 0.03, 0.17 * 0 + 0.07 * s); eyes.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: 0x050505 })); p.position.set(0.1, 0.03, 0.07 * s); eyes.add(p);
    }
    g.rotation.y = -Math.PI / 2 + (PR() - 0.5) * 0.6; // looking toward the near window
    wob.add(g); pax.push(g);
  }
  return { root, wob, wheels, pax, roofY: y0 + H, mats: M };
}
