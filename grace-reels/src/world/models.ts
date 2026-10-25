import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rngFrom } from "../lib/random";

// Flat-shaded low-poly geometry built in code, with baked vertex colours.
// Every builder is seeded so the same seed always gives the same model.

export type RGB = [number, number, number];
export const hex = (h: string): RGB => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Make geometry non-indexed (faceted), paint it, compute flat normals. */
export function facet(g: THREE.BufferGeometry, color: RGB | ((faceCenter: THREE.Vector3, i: number) => RGB)) {
  const ng = g.index ? g.toNonIndexed() : g;
  ng.deleteAttribute("uv");
  const pos = ng.getAttribute("position");
  const cols = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const center = new THREE.Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    center.set(0, 0, 0);
    for (let k = 0; k < 3; k++) center.add(new THREE.Vector3(pos.getX(f * 3 + k), pos.getY(f * 3 + k), pos.getZ(f * 3 + k)));
    center.multiplyScalar(1 / 3);
    const rgb = typeof color === "function" ? color(center, f) : color;
    c.setRGB(rgb[0], rgb[1], rgb[2]).convertSRGBToLinear();
    for (let k = 0; k < 3; k++) cols.set([c.r, c.g, c.b], (f * 3 + k) * 3);
  }
  ng.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  ng.computeVertexNormals();
  return ng;
}

function jitter(g: THREE.BufferGeometry, seed: number, amount: number, squashY = 1) {
  // jitter shared vertices consistently (works on indexed or position-welded geometry)
  const pos = g.getAttribute("position");
  const r = rngFrom(seed);
  const map = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let d = map.get(key);
    if (!d) {
      d = [r.range(-amount, amount), r.range(-amount, amount), r.range(-amount, amount)];
      map.set(key, d);
    }
    pos.setXYZ(i, pos.getX(i) + d[0], (pos.getY(i) + d[1]) * squashY, pos.getZ(i) + d[2]);
  }
  pos.needsUpdate = true;
  return g;
}

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export function rockGeometry(seed: number, base = "#9a8b7a") {
  const r = rngFrom(seed);
  const g = jitter(new THREE.IcosahedronGeometry(1, r.next() < 0.5 ? 0 : 1), seed, 0.22, r.range(0.55, 0.8));
  g.translate(0, 0.15, 0);
  const c = hex(base);
  return facet(g, (_p, i) => shade(c, 0.88 + ((i * 7919) % 13) / 60));
}

export function canopyGeometry(seed: number, base = "#5f8a3c") {
  const g = jitter(new THREE.IcosahedronGeometry(1, 1), seed, 0.14, 0.92);
  const c = hex(base);
  return facet(g, (p, i) => shade(c, 0.86 + p.y * 0.12 + ((i * 31) % 7) / 50));
}

export function trunkGeometry(height = 1, radius = 0.12) {
  const g = new THREE.CylinderGeometry(radius * 0.7, radius, height, 5, 1);
  g.translate(0, height / 2, 0);
  return facet(g, hex("#6b4a2f"));
}

/** Round tree: trunk + 1-3 canopy blobs, merged. Height ~ 1 (scale per instance). */
export function roundTreeGeometry(seed: number, leaf = "#5f8a3c") {
  const r = rngFrom(seed);
  const parts = [trunkGeometry(0.62, 0.075)];
  const n = r.int(1, 3);
  for (let i = 0; i < n; i++) {
    const s = r.range(0.32, 0.45) * (i === 0 ? 1 : 0.75);
    const c = canopyGeometry(seed * 13 + i, leaf);
    c.scale(s, s * 0.95, s);
    c.translate(i === 0 ? 0 : r.range(-0.2, 0.2), 0.78 + (i === 0 ? 0 : r.range(-0.12, 0.06)), i === 0 ? 0 : r.range(-0.2, 0.2));
    parts.push(c);
  }
  return mergeGeometries(parts)!;
}

/** Palm: curved segmented trunk + drooping fronds. Height ~ 1. */
export function palmGeometry(seed: number) {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  const lean = r.range(-0.18, 0.18);
  const segs = 5;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const h = 0.17;
    const g = new THREE.CylinderGeometry(0.045 - i * 0.004, 0.055 - i * 0.004, h, 5, 1);
    g.translate(0, h / 2, 0);
    g.rotateZ(-lean * (i / segs));
    g.translate(x, y, 0);
    parts.push(facet(g, shade(hex("#7a5a3a"), 0.9 + (i % 2) * 0.12)));
    x += Math.sin(lean * (i / segs)) * h;
    y += h * 0.98;
  }
  const top = new THREE.Vector3(x, y, 0);
  const fronds = r.int(6, 8);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + r.range(-0.2, 0.2);
    const len = r.range(0.42, 0.55);
    // a frond = two thin triangles bending down
    const shape = new THREE.BufferGeometry();
    const w = 0.07;
    const v = [
      0, 0, 0, len * 0.5, 0.05, w, len * 0.5, 0.05, -w,
      len * 0.5, 0.05, w, len, -0.22, 0, len * 0.5, 0.05, -w,
    ];
    shape.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
    shape.rotateY(a);
    shape.translate(top.x, top.y, top.z);
    const doubleSided = shape.clone();
    const idx = doubleSided.getAttribute("position");
    // flip winding for the back side
    for (let f = 0; f < idx.count; f += 3) {
      const ax = idx.getX(f), ay = idx.getY(f), az = idx.getZ(f);
      idx.setXYZ(f, idx.getX(f + 1), idx.getY(f + 1), idx.getZ(f + 1));
      idx.setXYZ(f + 1, ax, ay, az);
    }
    const green = shade(hex("#4f7a34"), r.range(0.85, 1.1));
    parts.push(facet(shape, green), facet(doubleSided, shade(green, 0.8)));
  }
  return mergeGeometries(parts)!;
}

/** Thorny thicket: tangled dark branches with a few leaf clumps and thorns. Size ~1. */
export function thicketGeometry(seed: number) {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const len = r.range(0.5, 1.0);
    const g = new THREE.CylinderGeometry(0.018, 0.03, len, 4, 1);
    g.translate(0, len / 2, 0);
    g.rotateZ(r.range(-1.1, 1.1));
    g.rotateY(r.range(0, Math.PI * 2));
    g.translate(r.range(-0.3, 0.3), 0, r.range(-0.3, 0.3));
    parts.push(facet(g, shade(hex("#4a3424"), r.range(0.8, 1.1))));
    for (let k = 0; k < 3; k++) {
      const th = new THREE.ConeGeometry(0.02, 0.09, 3);
      th.rotateZ(r.range(-2, 2));
      th.translate(r.range(-0.4, 0.4), r.range(0.15, 0.75), r.range(-0.4, 0.4));
      parts.push(facet(th, hex("#3b2a1d")));
    }
  }
  for (let i = 0; i < 7; i++) {
    const s = r.range(0.14, 0.26);
    const c = jitter(new THREE.IcosahedronGeometry(1, 0), seed * 7 + i, 0.25, 0.8);
    c.scale(s, s, s);
    c.translate(r.range(-0.4, 0.4), r.range(0.3, 0.8), r.range(-0.35, 0.35));
    parts.push(facet(c, shade(hex("#4d5e2c"), r.range(0.8, 1.05))));
  }
  return mergeGeometries(parts)!;
}

/** Low bush (no thorns). */
export function bushGeometry(seed: number, base = "#6b7a3a") {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = r.int(2, 4);
  for (let i = 0; i < n; i++) {
    const s = r.range(0.3, 0.5);
    const c = jitter(new THREE.IcosahedronGeometry(1, 0), seed * 11 + i, 0.2, 0.75);
    c.scale(s, s, s);
    c.translate(r.range(-0.3, 0.3), s * 0.55, r.range(-0.3, 0.3));
    parts.push(facet(c, shade(hex(base), r.range(0.85, 1.1))));
  }
  return mergeGeometries(parts)!;
}

export function cloudGeometry(seed: number, base = "#ffffff") {
  const r = rngFrom(seed);
  const parts: THREE.BufferGeometry[] = [];
  const n = r.int(4, 7);
  for (let i = 0; i < n; i++) {
    const s = r.range(0.45, 0.9) * (1 - Math.abs(i - n / 2) / n);
    const c = jitter(new THREE.IcosahedronGeometry(1, 1), seed * 5 + i, 0.12, 0.7);
    c.scale(s * 1.2, s, s);
    c.translate((i - n / 2) * 0.55, r.range(-0.1, 0.15), r.range(-0.2, 0.2));
    parts.push(facet(c, (p) => shade(hex(base), 0.88 + Math.max(0, p.y) * 0.18)));
  }
  return mergeGeometries(parts)!;
}

export function lambert(opts: THREE.MeshLambertMaterialParameters = {}) {
  return new THREE.MeshLambertMaterial({ vertexColors: true, ...opts });
}
