import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {rand} from '../lib/random';

type FacetOpts = {
  jitter?: number;
  palette?: string[];
  seed?: number;
  shade?: number; // +- brightness variation per face
  colorAt?: (centroid: THREE.Vector3, normal: THREE.Vector3, face: number) => THREE.Color | string;
};

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

// Jitter shared vertices, then split into flat faces with per-face colour variation.
export function faceted(source: THREE.BufferGeometry, opts: FacetOpts = {}) {
  const {jitter = 0, palette = ['#888888'], seed = 1, shade = 0.08, colorAt} = opts;
  let g = source.clone();
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  if (jitter > 0) {
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) + (rand(seed, i * 3) - 0.5) * 2 * jitter,
        pos.getY(i) + (rand(seed, i * 3 + 1) - 0.5) * 2 * jitter,
        pos.getZ(i) + (rand(seed, i * 3 + 2) - 0.5) * 2 * jitter,
      );
    }
  }
  const flat = g.toNonIndexed();
  const pos = flat.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const base = palette.map((p) => new THREE.Color(p));
  const col = new THREE.Color();
  const centroid = new THREE.Vector3();
  const normal = new THREE.Vector3();
  for (let f = 0; f < pos.count / 3; f++) {
    tmpA.fromBufferAttribute(pos, f * 3);
    tmpB.fromBufferAttribute(pos, f * 3 + 1);
    tmpC.fromBufferAttribute(pos, f * 3 + 2);
    centroid.copy(tmpA).add(tmpB).add(tmpC).divideScalar(3);
    normal.subVectors(tmpC, tmpB).cross(tmpA.clone().sub(tmpB)).normalize();
    if (colorAt) col.set(colorAt(centroid, normal, f) as THREE.ColorRepresentation);
    else col.copy(base[Math.floor(rand(seed + 5, f) * base.length) % base.length]);
    const k = 1 + (rand(seed + 11, f) - 0.5) * 2 * shade;
    for (let v = 0; v < 3; v++) {
      colors[(f * 3 + v) * 3] = col.r * k;
      colors[(f * 3 + v) * 3 + 1] = col.g * k;
      colors[(f * 3 + v) * 3 + 2] = col.b * k;
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  flat.computeVertexNormals();
  return flat;
}

export const flatMat = (opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0, ...opts});

// A leaf outline lying in the XY plane, base at origin, tip at +Y.
export function leafGeometry(len: number, width: number, fold = 0.25, curl = 0.15, seed = 1, color = '#5E9A33') {
  const s = new THREE.Shape();
  const w = width / 2;
  s.moveTo(0, 0);
  s.lineTo(w * 0.85, len * 0.22);
  s.lineTo(w, len * 0.5);
  s.lineTo(w * 0.6, len * 0.8);
  s.lineTo(0, len);
  s.lineTo(-w * 0.6, len * 0.8);
  s.lineTo(-w, len * 0.5);
  s.lineTo(-w * 0.85, len * 0.22);
  s.lineTo(0, 0);
  const g = new THREE.ShapeGeometry(s, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.abs(x) * fold + (y / len) * (y / len) * curl * len);
  }
  // add a midrib vertex line by subdividing via faceted colour split
  return faceted(g, {
    seed,
    shade: 0.06,
    colorAt: (c) => new THREE.Color(color).multiplyScalar(c.x > 0 ? 1.08 : 0.86),
  });
}

// Tube with varying radius along a polyline (parallel-transport frames). Optional per-vertex colour.
export function taperTube(
  pts: THREE.Vector3[],
  radiusAt: (u: number) => number,
  radial = 6,
  colorAt?: (u: number, a: number) => THREE.Color,
  capEnd = true,
) {
  const n = pts.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    tangents.push(b.clone().sub(a).normalize());
  }
  let normal = new THREE.Vector3(0, 1, 0);
  if (Math.abs(normal.dot(tangents[0])) > 0.9) normal = new THREE.Vector3(1, 0, 0);
  normal = normal.sub(tangents[0].clone().multiplyScalar(normal.dot(tangents[0]))).normalize();
  const normals: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = tangents[i - 1].clone().cross(tangents[i]);
      const len = axis.length();
      if (len > 1e-6) {
        const ang = Math.asin(Math.min(1, len));
        normal = normal.clone().applyAxisAngle(axis.normalize(), ang);
      }
    }
    normals.push(normal.clone());
  }
  const positions: number[] = [];
  const colors: number[] = [];
  const idx: number[] = [];
  const ring = (i: number) => {
    const u = i / (n - 1);
    const r = radiusAt(u);
    const t = tangents[i];
    const nn = normals[i];
    const bn = t.clone().cross(nn);
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const p = pts[i].clone().addScaledVector(nn, Math.cos(a) * r).addScaledVector(bn, Math.sin(a) * r);
      positions.push(p.x, p.y, p.z);
      const c = colorAt ? colorAt(u, j / radial) : new THREE.Color('#ffffff');
      colors.push(c.r, c.g, c.b);
    }
  };
  for (let i = 0; i < n; i++) ring(i);
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (capEnd) {
    const tip = pts[n - 1].clone().addScaledVector(tangents[n - 1], radiusAt(1) * 1.2);
    const ti = positions.length / 3;
    positions.push(tip.x, tip.y, tip.z);
    const c = colorAt ? colorAt(1, 0) : new THREE.Color('#ffffff');
    colors.push(c.r, c.g, c.b);
    for (let j = 0; j < radial; j++) idx.push((n - 1) * radial + j, ti, (n - 1) * radial + ((j + 1) % radial));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(idx);
  const flat = g.toNonIndexed();
  // flat shade: one colour per face (first vertex)
  const col = flat.attributes.color as THREE.BufferAttribute;
  for (let f = 0; f < col.count / 3; f++) {
    for (let v = 1; v < 3; v++) col.setXYZ(f * 3 + v, col.getX(f * 3), col.getY(f * 3), col.getZ(f * 3));
  }
  flat.computeVertexNormals();
  return flat;
}

export const curvePoints = (ctrl: [number, number, number][], count: number) =>
  new THREE.CatmullRomCurve3(ctrl.map((p) => new THREE.Vector3(...p))).getPoints(count - 1);

// Soft round contact-shadow texture (generated, no image files).
let shadowTex: THREE.Texture | null = null;
export const softDiscTexture = () => {
  if (shadowTex) return shadowTex;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5, dy = (y + 0.5) / size - 0.5;
      const d = Math.sqrt(dx * dx + dy * dy) * 2;
      const a = Math.max(0, 1 - d);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(255 * a * a);
    }
  }
  shadowTex = new THREE.DataTexture(data, size, size);
  shadowTex.needsUpdate = true;
  return shadowTex;
};
