// Low-poly 3D animals with an inverted-hull outline so they share the cut-out characters' line.
// Local space: facing +x, ground at y=0.
import * as THREE from 'three';
import { matte, hullMat } from './materials.js';
import { hash01 } from '../lib/util.js';

const OUT = 0.03; // outline thickness in animal-local units

function part(parent, geo, color, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], opts = {}) {
  const m = new THREE.Mesh(geo, matte(color));
  m.position.set(...pos); m.rotation.set(...rot); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = false;
  parent.add(m);
  if (opts.outline !== false) {
    geo.computeBoundingBox();
    const s = new THREE.Vector3(); geo.boundingBox.getSize(s);
    const h = new THREE.Mesh(geo, hullMat());
    const k = (d) => 1 + (2 * OUT) / Math.max(0.02, d);
    h.scale.set(k(s.x * scale[0]), k(s.y * scale[1]), k(s.z * scale[2]));
    m.add(h);
  }
  return m;
}
const ico = (r = 1, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cyl = (r0, r1, h, n = 6) => { const g = new THREE.CylinderGeometry(r0, r1, h, n); g.translate(0, -h / 2, 0); return g; };
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const cone = (r, h, n = 5) => new THREE.ConeGeometry(r, h, n);

function legs(root, pts, r, h, color, out) {
  const L = [];
  for (const [x, z] of pts) {
    const p = new THREE.Group(); p.position.set(x, h, z); root.add(p);
    part(p, cyl(r, r * 0.8, h), color);
    L.push(p);
  }
  out.legs = L;
}

export function makeAnimal(kind, seed = 1) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const A = { group: g, body, kind, legs: [], head: null, wings: [], seed };
  const add = (...a) => part(body, ...a);
  switch (kind) {
    case 'sheep': {
      add(ico(1, 1), '#ece5d3', [0, 0.52, 0], [0, 0, 0], [0.42, 0.3, 0.29]);
      add(ico(1, 1), '#e2dac6', [-0.18, 0.6, 0], [0, 0, 0], [0.24, 0.2, 0.22], { outline: false });
      A.head = new THREE.Group(); A.head.position.set(0.38, 0.62, 0); body.add(A.head);
      part(A.head, box(0.2, 0.17, 0.15), '#2f2925', [0.06, 0, 0]);
      part(A.head, box(0.04, 0.05, 0.12), '#2f2925', [-0.02, 0.06, 0.1], [0.4, 0, 0.3], [1, 1, 1], { outline: false });
      part(A.head, box(0.04, 0.05, 0.12), '#2f2925', [-0.02, 0.06, -0.1], [-0.4, 0, 0.3], [1, 1, 1], { outline: false });
      legs(body, [[0.24, 0.12], [0.24, -0.12], [-0.22, 0.12], [-0.22, -0.12]], 0.035, 0.38, '#2f2925', A);
      break;
    }
    case 'elephant': {
      add(ico(1, 1), '#908c87', [0, 1.6, 0], [0, 0, 0], [1.25, 0.92, 0.86]);
      A.head = new THREE.Group(); A.head.position.set(1.12, 1.95, 0); body.add(A.head);
      part(A.head, ico(0.56, 1), '#98948f');
      part(A.head, ico(1, 1), '#a8a39d', [-0.12, 0.02, 0.5], [0, 0, 0], [0.12, 0.52, 0.44]);
      part(A.head, ico(1, 1), '#a8a39d', [-0.12, 0.02, -0.5], [0, 0, 0], [0.12, 0.52, 0.44]);
      const tr = new THREE.Group(); tr.position.set(0.42, -0.12, 0); A.head.add(tr); A.trunk = tr;
      part(tr, cyl(0.17, 0.13, 0.55), '#928e89', [0, 0, 0], [0, 0, 0.35]);
      const tr2 = new THREE.Group(); tr2.position.set(0.19, -0.51, 0); tr.add(tr2); A.trunk2 = tr2;
      part(tr2, cyl(0.13, 0.08, 0.6), '#928e89', [0, 0, 0], [0, 0, 0.12]);
      part(A.head, cone(0.06, 0.42), '#efe6d2', [0.42, -0.32, 0.2], [0, 0, -2.2]);
      part(A.head, cone(0.06, 0.42), '#efe6d2', [0.42, -0.32, -0.2], [0, 0, -2.2]);
      part(A.head, ico(0.05, 0), '#1c1612', [0.32, 0.12, 0.38], [0, 0, 0], [1, 1, 1], { outline: false });
      part(A.head, ico(0.05, 0), '#1c1612', [0.32, 0.12, -0.38], [0, 0, 0], [1, 1, 1], { outline: false });
      legs(body, [[0.65, 0.42], [0.65, -0.42], [-0.65, 0.42], [-0.65, -0.42]], 0.24, 1.05, '#8a8681', A);
      add(cyl(0.03, 0.02, 0.6), '#8a8681', [-1.2, 1.75, 0], [0, 0, -0.5]);
      break;
    }
    case 'giraffe': {
      add(ico(1, 1), '#d8a647', [0, 1.85, 0], [0, 0, 0.12], [0.85, 0.52, 0.42]);
      for (let i = 0; i < 7; i++) add(box(0.16, 0.13, 0.02), '#8a5a2b', [-0.5 + (i % 4) * 0.28, 1.72 + (i > 3 ? 0.25 : 0), 0.415], [0, 0, hash01(i, 3)], [1, 1, 1], { outline: false });
      for (let i = 0; i < 7; i++) add(box(0.16, 0.13, 0.02), '#8a5a2b', [-0.5 + (i % 4) * 0.28, 1.72 + (i > 3 ? 0.25 : 0), -0.415], [0, 0, hash01(i, 4)], [1, 1, 1], { outline: false });
      const nk = new THREE.Group(); nk.position.set(0.62, 2.05, 0); body.add(nk); A.neck = nk;
      part(nk, cyl(0.13, 0.17, 1.65), '#d8a647', [0, 0, 0], [0, 0, Math.PI - 0.42]);
      A.head = new THREE.Group(); A.head.position.set(0.67, 1.52, 0); nk.add(A.head);
      part(A.head, box(0.42, 0.2, 0.2), '#d8a647', [0.14, 0, 0], [0, 0, -0.25]);
      part(A.head, cyl(0.025, 0.025, 0.18), '#6b4320', [-0.02, 0.27, 0.06]);
      part(A.head, cyl(0.025, 0.025, 0.18), '#6b4320', [-0.02, 0.27, -0.06]);
      legs(body, [[0.5, 0.2], [0.5, -0.2], [-0.48, 0.2], [-0.48, -0.2]], 0.07, 1.55, '#c99a3c', A);
      break;
    }
    case 'lion': case 'lioness': {
      add(ico(1, 1), kind === 'lion' ? '#c58a3e' : '#cf9a52', [0, 0.78, 0], [0, 0, 0], kind === 'lion' ? [0.78, 0.42, 0.38] : [0.8, 0.34, 0.3]);
      A.head = new THREE.Group(); A.head.position.set(0.82, 1.02, 0); body.add(A.head);
      if (kind === 'lion') part(A.head, ico(0.44, 1), '#7d4520', [-0.08, 0, 0]);
      part(A.head, ico(kind === 'lion' ? 0.27 : 0.22, 1), '#cc9548');
      part(A.head, box(0.18, 0.15, 0.2), '#d9a55e', [0.2, -0.07, 0]);
      part(A.head, ico(0.04, 0), '#2a1a10', [0.31, -0.03, 0], [0, 0, 0], [1, 1, 1], { outline: false });
      part(A.head, ico(0.07, 0), '#b07a35', [-0.05, 0.25, 0.14]);
      part(A.head, ico(0.07, 0), '#b07a35', [-0.05, 0.25, -0.14]);
      legs(body, [[0.45, 0.17], [0.45, -0.17], [-0.48, 0.17], [-0.48, -0.17]], 0.08, 0.58, '#c08438', A);
      const tail = new THREE.Group(); tail.position.set(-0.75, 0.85, 0); body.add(tail); A.tail = tail;
      part(tail, cyl(0.025, 0.02, 0.6), '#c58a3e', [0, 0, 0], [0, 0, 1.1]);
      part(tail, ico(0.07, 0), '#7d4520', [-0.52, -0.25, 0]);
      break;
    }
    case 'deer': case 'doe': {
      add(ico(1, 1), '#a0683a', [0, 0.92, 0], [0, 0, 0.05], [0.58, 0.3, 0.25]);
      add(ico(0.1, 0), '#f2ead8', [-0.58, 1.0, 0], [0, 0, 0], [1, 1, 1], { outline: false });
      const nk = new THREE.Group(); nk.position.set(0.42, 1.05, 0); body.add(nk); A.neck = nk;
      part(nk, cyl(0.08, 0.11, 0.5), '#a0683a', [0, 0, 0], [0, 0, Math.PI - 0.5]);
      A.head = new THREE.Group(); A.head.position.set(0.24, 0.45, 0); nk.add(A.head);
      part(A.head, box(0.3, 0.14, 0.14), '#a66e3e', [0.1, 0, 0], [0, 0, -0.3]);
      part(A.head, box(0.06, 0.12, 0.03), '#8a5a2e', [-0.04, 0.12, 0.08], [0.5, 0, 0]);
      part(A.head, box(0.06, 0.12, 0.03), '#8a5a2e', [-0.04, 0.12, -0.08], [-0.5, 0, 0]);
      if (kind === 'deer') {
        for (const s of [1, -1]) {
          part(A.head, cyl(0.018, 0.015, 0.36), '#d9c8a6', [0.0, 0.08, 0.05 * s], [s * 0.35, 0, Math.PI + 0.25]);
          part(A.head, cyl(0.015, 0.012, 0.16), '#d9c8a6', [0.05, 0.25, 0.1 * s], [s * 0.3, 0, Math.PI - 0.6]);
          part(A.head, cyl(0.015, 0.012, 0.14), '#d9c8a6', [-0.05, 0.33, 0.12 * s], [s * 0.3, 0, Math.PI + 0.7]);
        }
      }
      legs(body, [[0.33, 0.11], [0.33, -0.11], [-0.33, 0.11], [-0.33, -0.11]], 0.035, 0.78, '#8e5c32', A);
      break;
    }
    case 'camel': {
      add(ico(1, 1), '#c9a06a', [0, 1.6, 0], [0, 0, 0], [0.88, 0.45, 0.4]);
      add(ico(0.38, 1), '#c39864', [-0.05, 1.98, 0], [0, 0, 0], [1, 0.9, 0.85]);
      const nk = new THREE.Group(); nk.position.set(0.75, 1.62, 0); body.add(nk); A.neck = nk;
      part(nk, cyl(0.12, 0.16, 0.7), '#c9a06a', [0, 0, 0], [0, 0, Math.PI - 1.0]);
      part(nk, cyl(0.11, 0.12, 0.55), '#c9a06a', [0.6, 0.38, 0], [0, 0, Math.PI - 0.15]);
      A.head = new THREE.Group(); A.head.position.set(0.7, 0.9, 0); nk.add(A.head);
      part(A.head, box(0.42, 0.2, 0.2), '#c9a06a', [0.12, 0, 0], [0, 0, -0.15]);
      legs(body, [[0.5, 0.18], [0.5, -0.18], [-0.5, 0.18], [-0.5, -0.18]], 0.075, 1.32, '#bb915c', A);
      break;
    }
    case 'dove': {
      add(ico(1, 1), '#f4f1ea', [0, 0, 0], [0, 0, 0.1], [0.16, 0.1, 0.1]);
      A.head = new THREE.Group(); A.head.position.set(0.15, 0.06, 0); body.add(A.head);
      part(A.head, ico(0.065, 1), '#f4f1ea');
      part(A.head, cone(0.02, 0.07, 4), '#d4a03a', [0.08, -0.01, 0], [0, 0, -Math.PI / 2], [1, 1, 1], { outline: false });
      add(box(0.12, 0.02, 0.1), '#e8e4da', [-0.18, 0.0, 0], [0, 0, 0.15]);
      for (const s of [1, -1]) {
        const w = new THREE.Group(); w.position.set(0.0, 0.04, 0.06 * s); body.add(w);
        part(w, box(0.16, 0.015, 0.3), '#ffffff', [0, 0, 0.15 * s]);
        A.wings.push({ g: w, s });
      }
      break;
    }
  }
  A.update = (t, walk = 0, opts = {}) => {
    const ph = hash01(seed, 5) * 6.28;
    if (kind === 'dove') {
      const f = Math.sin(t * 2 * Math.PI * (opts.glide ? 2.0 : 6.5) + ph);
      for (const w of A.wings) w.g.rotation.x = w.s * (opts.glide ? 0.15 + 0.15 * f : 0.85 * f);
      return;
    }
    const sp = { elephant: 0.9, giraffe: 0.95, camel: 1.0, sheep: 2.1, lion: 1.4, lioness: 1.4, deer: 1.6, doe: 1.6 }[kind] || 1.3;
    const f = t * 2 * Math.PI * sp * (walk > 0 ? 1 : 0) + ph;
    const amp = 0.38 * walk;
    A.legs.forEach((L, i) => { const s = (i === 0 || i === 3) ? 1 : -1; L.rotation.z = Math.sin(f) * amp * s; });
    body.position.y = walk > 0 ? Math.abs(Math.sin(f)) * 0.025 * walk : 0;
    if (A.head) A.head.rotation.z = 0.06 * Math.sin(f * (walk > 0 ? 1 : 0) + t * (walk > 0 ? 0 : 0.8) + ph);
    if (A.trunk) { A.trunk.rotation.z = 0.12 * Math.sin(t * 1.3 + ph); A.trunk2.rotation.z = 0.2 * Math.sin(t * 1.3 + ph + 0.6); }
    if (A.tail) A.tail.rotation.z = 0.15 * Math.sin(t * 2.0 + ph);
    if (A.neck && kind === 'giraffe') A.neck.rotation.z = 0.04 * Math.sin(f + 0.5);
  };
  return A;
}
