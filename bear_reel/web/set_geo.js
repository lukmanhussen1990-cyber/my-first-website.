// Low-poly geometry generators for the instanced forest (pines, grass, ferns, bushes, rocks, cones...). Deterministic.
import * as THREE from 'three';
import { rng, clamp } from './lib.js';
import { TriBuilder, faceColors, mergeGeos, hash2, vnoise } from './set_util.js';
import { ATLAS } from './set_tex.js';

const TAU = Math.PI * 2;
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- pine tree (trunk + stacked star-shaped tiers)
// Shape at scale 1 (origin at the trunk foot). UVs into the tree atlas (needles top half, bark bottom half).
export function pineGeo(V, { trunkSides = 6 } = {}) {
  const R = rng(V.seed * 97 + 5);
  const tb = new TriBuilder();
  const { h, trunkR, crownBase, crownR, tiers, sides } = V;
  const [b0, b1] = ATLAS.bark, [n0, n1] = ATLAS.needle;
  // trunk: three rings (flare, base, top)
  const rings = [[-0.35, trunkR * 1.25], [0.55, trunkR * 1.0], [Math.min(h * 0.93, crownBase + (h - crownBase) * 0.8), Math.max(0.04, trunkR * 0.22)]];
  if (!tiers) rings[2] = [h, trunkR * 0.3];
  const ao = (y) => clamp(0.45 + 0.55 * (y / Math.max(crownBase + 3, 4)), 0.45, 1);
  for (let j = 0; j < rings.length - 1; j++) {
    const [ya, ra] = rings[j], [yb, rbb] = rings[j + 1];
    for (let i = 0; i < trunkSides; i++) {
      const a0 = (i / trunkSides) * TAU, a1 = ((i + 1) / trunkSides) * TAU;
      const p = (a, y, r) => [Math.cos(a) * r, y, Math.sin(a) * r];
      const u0 = (i / trunkSides) * 2, u1 = ((i + 1) / trunkSides) * 2;
      const va = lerp(b0, b1, clamp((ya + 0.35) / (h + 0.35))), vb = lerp(b0, b1, clamp((yb + 0.35) / (h + 0.35)));
      const k = 0.92 + R() * 0.16, ca = [ao(ya) * k, ao(ya) * k, ao(ya) * k], cb = [ao(yb) * k, ao(yb) * k, ao(yb) * k];
      tb.quad(p(a0, ya, ra), p(a0, yb, rbb), p(a1, yb, rbb), p(a1, ya, ra), [u0, va], [u0, vb], [u1, vb], [u1, va], ca, cb, cb, ca);
    }
  }
  // dead snag: a few bare branch stubs, no needles
  if (!tiers) {
    for (let k = 0; k < 6; k++) {
      const y = h * (0.35 + R() * 0.55), a = R() * TAU, len = 0.6 + R() * 1.2, r = trunkR * 0.25;
      const base = [Math.cos(a) * trunkR * 0.5, y, Math.sin(a) * trunkR * 0.5], tip = [Math.cos(a) * len, y + len * 0.35, Math.sin(a) * len];
      const side = [-Math.sin(a) * r, 0, Math.cos(a) * r];
      const c = [0.75, 0.75, 0.75];
      tb.tri(base.map((v, i) => v + side[i]), tip, base.map((v, i) => v - side[i]), [0, b0], [0.2, b1], [0.1, b0], c);
      tb.tri([base[0], base[1] + r, base[2]], tip, [base[0], base[1] - r, base[2]], [0, b0], [0.2, b1], [0.1, b0], c);
    }
    return finish(tb.build());
  }
  // tiers
  const span = h - crownBase;
  for (let t = 0; t < tiers; t++) {
    const f = t / tiers;
    const yRim = crownBase + span * f * 0.84 + (R() - 0.5) * span * 0.02;
    const last = t === tiers - 1;
    const tierH = last ? h - yRim : span * 0.3 * (1 - f * 0.35);
    const apex = last ? h : yRim + tierH;
    const r = crownR * (1 - f * 0.8) * (0.9 + R() * 0.2);
    const N = sides, rot = R() * TAU;
    const ring = [];
    for (let k = 0; k < 2 * N; k++) {
      const a = rot + (k / (2 * N)) * TAU + (R() - 0.5) * 0.12;
      const tip = k % 2 === 0;
      const rr = tip ? r * (0.92 + R() * 0.16) : r * (0.62 + R() * 0.1);
      const y = tip ? yRim - tierH * (0.1 + R() * 0.06) : yRim + tierH * (0.2 + R() * 0.06);
      ring.push([Math.cos(a) * rr, y, Math.sin(a) * rr]);
    }
    const reps = Math.max(2, Math.round((TAU * r) / 1.6));
    const top = [0, apex, 0], under = [0, yRim + tierH * 0.3, 0];
    const lit = 0.52 + 0.48 * Math.pow(f + 1 / tiers, 0.7);
    for (let k = 0; k < 2 * N; k++) {
      const pa = ring[k], pb = ring[(k + 1) % (2 * N)];
      const ua = (k / (2 * N)) * reps, ub = ((k + 1) / (2 * N)) * reps, um = (ua + ub) / 2;
      const va = k % 2 === 0 ? n0 : lerp(n0, n1, 0.3), vb = (k + 1) % 2 === 0 ? n0 : lerp(n0, n1, 0.3);
      const j = 0.9 + R() * 0.2, hue = R();
      const c = [lit * j * (hue > 0.8 ? 1.06 : 1), lit * j, lit * j * (hue < 0.2 ? 1.12 : 1)];
      tb.tri(top, pb, pa, [um, n1], [ub, vb], [ua, va], c);
      const cu = [0.3 + f * 0.12, 0.33 + f * 0.12, 0.3 + f * 0.12];
      tb.tri(under, pa, pb, [um, lerp(n0, n1, 0.25)], [ua, va], [ub, vb], cu);
    }
  }
  return finish(tb.build());
}
function finish(g) { g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox(); return g; }

// simple far tree: two stacked 6-sided cones on a stub (no underside), for the horizon ring
export function farTreeGeo() {
  const tb = new TriBuilder();
  const [n0, n1] = ATLAS.needle;
  const cone = (y0, y1, r, lit, rot) => {
    const N = 6;
    for (let k = 0; k < N; k++) {
      const a0 = rot + (k / N) * TAU, a1 = rot + ((k + 1) / N) * TAU;
      const c = [lit * (0.92 + hash2(k, y0 * 10, 3) * 0.16), lit, lit];
      tb.tri([0, y1, 0], [Math.cos(a1) * r, y0, Math.sin(a1) * r], [Math.cos(a0) * r, y0, Math.sin(a0) * r], [k + 0.5, n1], [k + 1, n0], [k, n0], c);
    }
  };
  cone(1.0, 11.0, 3.0, 0.62, 0);
  cone(7.0, 16.5, 2.0, 0.95, 0.5);
  return finish(tb.build());
}

// ---------------------------------------------------------------- grass tuft (single-triangle blades, double sided)
export function grassGeo(seed, blades = 6) {
  const R = rng(seed), tb = new TriBuilder();
  for (let i = 0; i < blades; i++) {
    const a = R() * TAU, d = R() * 0.07, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const ba = R() * TAU, w = 0.012 + R() * 0.01, hgt = 0.16 + R() * 0.24, lean = 0.03 + R() * 0.12;
    const px = -Math.sin(ba) * w, pz = Math.cos(ba) * w;
    const tip = [cx + Math.cos(a) * lean, hgt, cz + Math.sin(a) * lean];
    const base = [0.32, 0.5, 0.2], top = [0.95 + R() * 0.1, 1.0, 0.62 + R() * 0.2];
    tb.tri([cx - px, -0.02, cz - pz], [cx + px, -0.02, cz + pz], tip, [0, 0], [1, 0], [0.5, 1], base, base, top);
  }
  return finish(tb.build());
}

// ---------------------------------------------------------------- fern: arching fronds made of leaflet triangles
export function fernGeo(seed, fronds = 7) {
  const R = rng(seed), tb = new TriBuilder();
  for (let f = 0; f < fronds; f++) {
    const a = (f / fronds) * TAU + (R() - 0.5) * 0.5, L = 0.5 + R() * 0.25, up = 0.75 + R() * 0.3;
    const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx;
    const P = (s) => [dx * L * s, L * (up * s - (up - 0.1) * s * s * 1.15) + 0.02, dz * L * s];
    const n = 9;
    for (let j = 0; j < n; j++) {
      const s = 0.14 + (j / n) * 0.82, ds = 0.4 / n;
      const len = 0.15 * Math.pow(1 - s, 0.55) * Math.sin(Math.PI * Math.min(1, s * 1.1 + 0.08)) + 0.02;
      const A = P(s - ds), Bp = P(s + ds * 0.6), C = P(s);
      const shade = 0.55 + 0.45 * s + (R() - 0.5) * 0.1;
      const col = [0.5 * shade, 0.95 * shade, 0.35 * shade];
      for (const side of [-1, 1]) {
        const tip = [C[0] + sx * len * side + dx * len * 0.35, C[1] - len * 0.25, C[2] + sz * len * side + dz * len * 0.35];
        if (side > 0) tb.tri(A, Bp, tip, [0, 0], [1, 0], [0.5, 1], col); else tb.tri(Bp, A, tip, [0, 0], [1, 0], [0.5, 1], col);
      }
    }
  }
  return finish(tb.build());
}

// ---------------------------------------------------------------- small round bush: a few chunky lumps
export function smallBushGeo(seed) {
  const R = rng(seed), geos = [];
  const n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const s = 1 + (hash2(Math.round(p.getX(k) * 50), Math.round(p.getY(k) * 50) + Math.round(p.getZ(k) * 50) * 7, seed + i) - 0.5) * 0.3; p.setXYZ(k, p.getX(k) * s, p.getY(k) * s, p.getZ(k) * s); }
    const r = i === 0 ? 0.45 : 0.25 + R() * 0.15, a = R() * TAU, d = i === 0 ? 0 : 0.25 + R() * 0.15;
    g.scale(r, r * 0.8, r);
    g.translate(Math.cos(a) * d, r * 0.6 + (i === 0 ? 0.05 : R() * 0.15), Math.sin(a) * d);
    geos.push(g);
  }
  const g = mergeGeos(geos.map((x) => x.toNonIndexed()));
  return finish(faceColors(g, (cx, cy, cz, nx, ny) => { const k = (0.6 + 0.4 * clamp(cy / 0.8)) * (0.85 + hash2(Math.round(cx * 97), Math.round(cz * 97), seed) * 0.3) * (ny < -0.3 ? 0.6 : 1); return [k, k, k]; }));
}

// ---------------------------------------------------------------- rock: jittered flattened icosahedron, moss on top
export function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
    const s = 0.8 + vnoise(x * 1.7 + seed, z * 1.7 + y * 1.3, seed) * 0.45;
    p.setXYZ(k, x * s * 1.1, Math.max(y * s * 0.62, -0.25), z * s * 0.95);
  }
  const ng = g.toNonIndexed();
  return finish(faceColors(ng, (cx, cy, cz, nx, ny) => {
    const j = 0.85 + hash2(Math.round(cx * 101), Math.round(cz * 101) + Math.round(cy * 37), seed) * 0.3;
    if (ny > 0.55) return [0.62 * j, 0.88 * j, 0.42 * j];       // moss
    return [j, j, j];
  }));
}

// ---------------------------------------------------------------- tiny stuff
export function pineConeGeo() {
  const g = new THREE.SphereGeometry(1, 6, 5); g.scale(0.022, 0.04, 0.022);
  return finish(faceColors(g.toNonIndexed(), (cx, cy, cz, nx, ny, nz, i) => { const k = 0.8 + ((i * 7) % 5) * 0.08; return [0.55 * k, 0.36 * k, 0.22 * k]; }));
}
export function mushroomGeo() {
  const stem = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 5, 1); stem.translate(0, 0.035, 0);
  const cap = new THREE.SphereGeometry(0.04, 7, 3, 0, TAU, 0, Math.PI / 2); cap.scale(1, 0.75, 1); cap.translate(0, 0.062, 0);
  const s = faceColors(stem.toNonIndexed(), () => [0.95, 0.92, 0.85]);
  const c = faceColors(cap.toNonIndexed(), (cx, cy, cz, nx, ny, nz, i) => (i % 5 === 2 ? [1, 0.97, 0.9] : [0.85, 0.12, 0.08]));
  return finish(mergeGeos([s, c]));
}
export function flowerGeo(color) {
  const tb = new TriBuilder();
  const stemC = [0.35, 0.6, 0.25], h = 0.16;
  tb.tri([-0.004, 0, 0], [0.004, 0, 0], [0.002, h, 0], [0, 0], [1, 0], [0.5, 1], stemC);
  tb.tri([0, 0, -0.004], [0, 0, 0.004], [0.002, h, 0], [0, 0], [1, 0], [0.5, 1], stemC);
  const N = 5;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * TAU, a1 = ((k + 0.5) / N) * TAU, a2 = ((k + 1) / N) * TAU;
    tb.tri([0.002, h + 0.006, 0], [0.002 + Math.cos(a1) * 0.022, h + 0.004, Math.sin(a1) * 0.022], [0.002 + Math.cos(a0) * 0.008, h + 0.006, Math.sin(a0) * 0.008], [0, 0], [1, 0], [0.5, 1], color);
    tb.tri([0.002, h + 0.006, 0], [0.002 + Math.cos(a2) * 0.008, h + 0.006, Math.sin(a2) * 0.008], [0.002 + Math.cos(a1) * 0.022, h + 0.004, Math.sin(a1) * 0.022], [0, 0], [1, 0], [0.5, 1], color);
  }
  tb.tri([0.002, h + 0.009, 0.006], [0.008, h + 0.009, -0.004], [-0.004, h + 0.009, -0.004], [0, 0], [1, 0], [0.5, 1], [1, 0.85, 0.2]);
  return finish(tb.build());
}
