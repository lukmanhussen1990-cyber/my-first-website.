// Small shared helpers: deterministic random, easing, materials, blocky meshes, canvas textures.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, u) => a + (b - a) * u;
export const smooth = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
export const easeOut = (u) => 1 - Math.pow(1 - clamp(u), 3);
export const easeIn = (u) => Math.pow(clamp(u), 3);
export const easeInOut = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
export const easeOutBack = (u) => { u = clamp(u); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
export const ramp = (t, t0, t1) => clamp((t - t0) / Math.max(1e-6, t1 - t0));
export const pulse = (t, t0, rise, hold, fall) => {
  if (t < t0) return 0;
  if (t < t0 + rise) return (t - t0) / rise;
  if (t < t0 + rise + hold) return 1;
  return clamp(1 - (t - t0 - rise - hold) / fall);
};
export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerpV = (a, b, u) => new THREE.Vector3(lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u));

// Deterministic hash-noise
export function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function noise1(t, seed = 0) { // smooth value noise in [-1,1]
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 101.3) * 2 - 1, hash(i + 1 + seed * 101.3) * 2 - 1, u);
}

// ---------- materials ----------
const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  let m;
  if (opts.basic) m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide, depthWrite: opts.depthWrite ?? true, toneMapped: opts.toneMapped ?? true });
  else if (opts.std) m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.5, metalness: opts.metalness ?? 0, flatShading: true, emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1, envMapIntensity: opts.envMapIntensity ?? 1, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
  else m = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: opts.emissive ?? 0x000000, transparent: !!opts.transparent, opacity: opts.opacity ?? 1, side: opts.side ?? THREE.FrontSide });
  cache.set(key, m);
  return m;
}

const boxGeoCache = new Map();
function boxGeo(w, h, d) {
  const k = `${w}|${h}|${d}`;
  if (!boxGeoCache.has(k)) boxGeoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return boxGeoCache.get(k);
}
export function box(w, h, d, material, x = 0, y = 0, z = 0, parent = null, shadow = true) {
  const m = new THREE.Mesh(boxGeo(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function cyl(rt, rb, h, seg, material, x = 0, y = 0, z = 0, parent = null) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export function group(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group(); g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, { nearest = false, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.anisotropy = 4;
  t.userData.canvas = c; t.userData.ctx = ctx;
  return t;
}
export function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
export function shade(c, k) { // multiply color brightness
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k)), g = Math.min(255, Math.round(((c >> 8) & 255) * k)), b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}

// Aim a limb pivot so that its local -Y axis points along `dir` (given in the pivot's parent space)
const DOWN = new THREE.Vector3(0, -1, 0);
export function aim(pivot, dir) {
  const d = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
  pivot.quaternion.setFromUnitVectors(DOWN, d);
}
// Aim a two-segment limb: upper dir and lower dir both expressed in the upper pivot's parent space
const _q = new THREE.Quaternion();
export function aim2(upper, lower, dU, dL) {
  aim(upper, dU);
  const d = new THREE.Vector3(dL[0], dL[1], dL[2]).normalize();
  _q.copy(upper.quaternion).invert();
  d.applyQuaternion(_q);
  lower.quaternion.setFromUnitVectors(DOWN, d);
}
