// Automatic car wash at the end of the jam (diorama style: front wall cut away, open top).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { LAYOUT as L } from './layout.js';
import { merge, xf, GB, prism, rectPoly } from './geo.js';
import { canvasTex, textTex } from './tex.js';
import { rng, smoothstep, clamp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);

function tileTex() {
  return canvasTex(512, 512, (ctx, w) => {
    ctx.fillStyle = '#d9e6ee'; ctx.fillRect(0, 0, w, w);
    const n = 8, s = w / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const c = (x + y) % 5 === 0 ? '#3aa7d8' : (x * 3 + y) % 7 === 0 ? '#9fd3ec' : '#eef5f8';
      ctx.fillStyle = c; ctx.fillRect(x * s + 3, y * s + 3, s - 6, s - 6);
    }
  }, { srgb: true, repeat: true });
}

function brushGeometry(radius, length, nStrips, colA, colB) {
  const geos = [];
  const R = rng(12);
  for (let i = 0; i < nStrips; i++) {
    const a = (i / nStrips) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const seg = length / 3;
      const r = radius * (0.88 + R() * 0.14);
      const g = new THREE.BoxGeometry(r, seg * 0.96, 0.05);
      g.translate(r / 2 + 0.06, -length / 2 + seg * (k + 0.5), 0);
      g.rotateY(a + (R() - 0.5) * 0.1);
      const col = (i + k) % 2 ? colA : colB;
      const n = g.getAttribute('position').count; const c = new Float32Array(n * 3);
      const pos = g.getAttribute('position');
      for (let j = 0; j < n; j++) {
        const rr = Math.hypot(pos.getX(j), pos.getZ(j)) / radius;
        const sh = 0.55 + 0.45 * rr; // darker toward the core (fake AO)
        c[j * 3] = col[0] * sh; c[j * 3 + 1] = col[1] * sh; c[j * 3 + 2] = col[2] * sh;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      geos.push(g.toNonIndexed());
    }
  }
  geos.push(new THREE.CylinderGeometry(0.08, 0.08, length + 0.4, 10).toNonIndexed());
  return merge(geos);
}

export function buildCarWash(ctx) {
  const cw = L.carwash;
  const group = new THREE.Group();
  const x0 = cw.x0, x1 = cw.x1, zc = cw.zc, zb = zc - cw.halfW, zf = zc + cw.halfW, H = cw.h;
  const M = {
    floor: new THREE.MeshPhysicalMaterial({ color: lin(0.42, 0.44, 0.47), roughness: 0.16, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.05 }),
    tile: new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.25 }),
    frame: new THREE.MeshStandardMaterial({ color: lin(0.92, 0.93, 0.95), roughness: 0.35, metalness: 0.4 }),
    blue: new THREE.MeshPhysicalMaterial({ color: lin(0.12, 0.45, 0.85), roughness: 0.3, clearcoat: 0.8 }),
    rail: new THREE.MeshStandardMaterial({ color: lin(0.25, 0.26, 0.28), roughness: 0.4, metalness: 0.8 }),
    brush: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }),
    ledC: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.0).multiplyScalar(5) }),
    ledM: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.25, 0.75).multiplyScalar(5) }),
    ledY: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.8, 0.2).multiplyScalar(5) }),
    sign: new THREE.MeshBasicMaterial({ map: textTex('CAR WASH', { w: 1024, h: 256, font: 'bold 150px DejaVu Sans, sans-serif', fill: '#7ff6ff', stroke: '#03384a', strokeW: 14, glow: 24 }), transparent: true }),
    signBoard: new THREE.MeshStandardMaterial({ color: lin(0.06, 0.12, 0.2), roughness: 0.4 }),
    curtain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
  };
  M.sign.color.setScalar(4.0);
  const add = (geo, mat, cast = true, parent = group) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; };

  // floor pad + conveyor rails
  add(xf(new RoundedBoxGeometry(x1 - x0 + 10, 0.12, cw.halfW * 2 + 0.6, 2, 0.05), { p: [(x0 + x1) / 2 + 3, 0.04, zc] }), M.floor, false);
  for (const z of [zc + 0.84, zc - 0.84]) add(xf(new THREE.BoxGeometry(x1 - x0 + 6, 0.06, 0.18), { p: [(x0 + x1) / 2 + 1, 0.12, z] }), M.rail, false);
  // back wall (tiles) + roof edge
  const wall = new GB();
  wall.quad(V(x0, 0, zb), V(x1, 0, zb), V(x1, H, zb), V(x0, H, zb), [0, 0], [(x1 - x0) / 4, 0], [(x1 - x0) / 4, H / 4], [0, H / 4], V(0, 0, 1));
  add(wall.build(), M.tile, false);
  add(xf(new RoundedBoxGeometry(x1 - x0 + 0.6, 0.6, 0.6, 2, 0.1), { p: [(x0 + x1) / 2, H + 0.3, zb + 0.1] }), M.blue);
  // end walls (short) at entrance/exit back corners
  for (const x of [x0, x1]) add(xf(new RoundedBoxGeometry(0.6, H + 0.6, 1.6, 2, 0.1), { p: [x, (H + 0.6) / 2, zb + 0.6] }), M.blue);
  // gantries (open top) with LED strips
  const gantX = [x0 + 0.4, x0 + 9, x0 + 18, x1 - 0.4];
  const leds = [M.ledC, M.ledM, M.ledY, M.ledC];
  gantX.forEach((gx, i) => {
    add(xf(new RoundedBoxGeometry(0.42, H, 0.42, 2, 0.08), { p: [gx, H / 2, zb + 0.35] }), M.frame);
    add(xf(new RoundedBoxGeometry(0.42, H, 0.42, 2, 0.08), { p: [gx, H / 2, zf - 0.3] }), M.frame);
    add(xf(new RoundedBoxGeometry(0.5, 0.5, zf - zb, 2, 0.1), { p: [gx, H, zc] }), M.frame);
    add(xf(new THREE.BoxGeometry(0.06, 0.08, zf - zb - 0.6), { p: [gx + 0.27, H - 0.2, zc] }), leds[i], false);
    add(xf(new THREE.BoxGeometry(0.06, H - 0.5, 0.06), { p: [gx + 0.24, H / 2, zf - 0.08] }), leds[i], false);
  });
  // sign
  const board = add(xf(new RoundedBoxGeometry(12, 2.4, 0.4, 2, 0.15), { p: [(x0 + x1) / 2, H + 2.0, zb + 0.2] }), M.signBoard);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(11.2, 2.8), M.sign); sign.position.set((x0 + x1) / 2, H + 2.0, zb + 0.42); group.add(sign);
  void board;

  // brushes
  const brushes = [];
  const mkBrush = (pos, axis, radius, len, cols) => {
    const pivot = new THREE.Group(); pivot.position.copy(pos);
    const spin = new THREE.Group(); pivot.add(spin);
    const mesh = new THREE.Mesh(brushGeometry(radius, len, 44, cols[0], cols[1]), M.brush); mesh.castShadow = true; mesh.receiveShadow = true; spin.add(mesh);
    if (axis === 'z') pivot.rotation.x = Math.PI / 2;
    group.add(pivot);
    const b = { pivot, spin, axis, radius, base: pos.clone() };
    brushes.push(b); return b;
  };
  const topBrush = mkBrush(V(x0 + 9, 3.2, zc), 'z', 0.75, 3.4, [[0.15, 0.55, 1.0], [0.95, 0.35, 0.7]]);
  const sideA = mkBrush(V(x0 + 14.5, 1.25, zc - 2.15), 'y', 0.85, 2.3, [[0.2, 0.75, 1.0], [1.0, 0.85, 0.2]]);
  const sideB = mkBrush(V(x0 + 20.0, 1.25, zc + 2.2), 'y', 0.85, 2.3, [[1.0, 0.45, 0.7], [0.3, 0.85, 1.0]]);
  // mitter curtain (hanging strips)
  const curtain = new THREE.Group(); curtain.position.set(x0 + 4.5, H - 0.25, zc); group.add(curtain);
  const strips = [];
  { const R = rng(4); const cols = [[0.2, 0.6, 1.0], [1.0, 0.4, 0.7], [1.0, 0.85, 0.25], [0.4, 0.9, 0.6]];
    for (let i = 0; i < 26; i++) {
      const z = -3.4 + i * 0.27;
      const g = new THREE.BoxGeometry(0.03, 3.6, 0.22, 1, 6, 1); g.translate(0, -1.8, 0);
      const c = cols[i % 4]; const n = g.getAttribute('position').count; const cc = new Float32Array(n * 3);
      for (let j = 0; j < n; j++) { cc[j * 3] = c[0]; cc[j * 3 + 1] = c[1]; cc[j * 3 + 2] = c[2]; }
      g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const m = new THREE.Mesh(g, M.curtain); m.position.set(0, 0, z); m.castShadow = true; curtain.add(m);
      strips.push({ m, ph: R() * 6.28 });
    } }
  // foam arch + rinse arch nozzles (positions used by fx)
  const foamArchX = x0 + 2.2, rinseArchX = x1 - 3.4;
  for (const ax of [foamArchX, rinseArchX]) {
    add(xf(new THREE.TorusGeometry(3.0, 0.09, 8, 32, Math.PI), { p: [ax, 0.4, zc], r: [0, Math.PI / 2, 0] }), M.frame);
  }
  const nozzles = [];
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; nozzles.push({ arch: 'foam', p: V(foamArchX, 0.4 + Math.sin(a) * 3.0, zc + Math.cos(a) * 3.0), d: V(0, -Math.sin(a), -Math.cos(a)) }); }
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; nozzles.push({ arch: 'rinse', p: V(rinseArchX, 0.4 + Math.sin(a) * 3.0, zc + Math.cos(a) * 3.0), d: V(0, -Math.sin(a), -Math.cos(a)) }); }

  function update(t, car) {
    const on = smoothstep(46.45, 46.9, t);
    const spinT = Math.max(0, t - 46.45);
    for (const b of brushes) b.spin.rotation.y = -spinT * 15.0 * on - (b === sideB ? 0 : 0);
    sideB.spin.rotation.y = spinT * 15.0 * on;
    // top brush rides over the car roof when the car is under it
    const dx = car.x - topBrush.base.x;
    const over = Math.exp(-(dx * dx) / 6.0);
    topBrush.pivot.position.y = 3.2 - over * 1.25 * on;
    // side brushes squeeze against the car sides
    const dA = car.x - sideA.base.x, dB = car.x - sideB.base.x;
    sideA.pivot.position.z = sideA.base.z + 0.35 * Math.exp(-(dA * dA) / 8);
    sideB.pivot.position.z = sideB.base.z - 0.35 * Math.exp(-(dB * dB) / 8);
    // curtain sways, pushed by the car
    const dc = car.x - curtain.position.x;
    for (const s of strips) {
      const push = Math.exp(-(dc * dc) / 5) * 0.9;
      s.m.rotation.z = (0.08 * Math.sin(t * 3.0 + s.ph) * on + push * (dc < 0 ? -0.6 : 0.6) * on);
    }
    // LED chase
    const k = 0.6 + 0.4 * Math.sin(t * 6.0);
    M.ledC.color.setRGB(0.2, 0.9, 1.0).multiplyScalar(3.5 + 2.5 * k * on);
    M.ledM.color.setRGB(1.0, 0.25, 0.75).multiplyScalar(3.5 + 2.5 * (1 - k) * on);
  }
  return { group, update, nozzles, foamArchX, rinseArchX, brushes, topBrush, sideA, sideB, curtain, mats: M };
}
