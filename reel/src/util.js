import * as THREE from 'three';

// ---------- world constants ----------
export const V = new THREE.Vector3(-5.5, 0, 2); // volcano centre
export const CR = 2.8;  // crater radius at ground level
export const CD = 5.0;  // crater depth
export const CH = 5.5;  // cone height
export const CB = 5.0;  // cone base radius
export const CT = 1.5;  // cone top inner radius
export const ZC = V.z;  // cutaway plane z
export const TANK = { x: 7.5, y: -4.0, r: 1.7 };
export const TUN = { y: -4.0, r: 0.6, x0: V.x + CR, x1: 5.59 };
export const NICHE = { x0: 2.2, x1: 4.6, y0: -5.0, y1: -2.4 };

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const easeOutCubic = (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); };
export const easeInCubic = (t) => { t = clamp(t); return t * t * t; };
export const easeOutBack = (t) => { t = clamp(t); const c1 = 2.2, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
export const pop = (t, t0, d = 0.32) => (t < t0 ? 0 : easeOutBack((t - t0) / d));
export function bounceDrop(t, t0, fall = 0.35) { // 1 -> 0 height factor with bounces
  const u = (t - t0) / fall;
  if (u <= 0) return 1;
  if (u < 1) return 1 - u * u;
  const v = u - 1;
  return Math.abs(Math.sin(v * Math.PI * 1.6)) * 0.28 * Math.exp(-v * 2.6);
}
export function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const noise1 = (t, k = 1) => Math.sin(t * 37.1 * k) * 0.5 + Math.sin(t * 61.7 * k + 1.3) * 0.3 + Math.sin(t * 23.3 * k + 4.1) * 0.2;

// ---------- materials / clipping ----------
export const cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), ZC); // keeps z < ZC
export const clipMats = [];
export function M(color, opts = {}, noClip = false) {
  const m = new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  m.userData.own = [];
  if (!noClip) { clipMats.push(m); m.clipShadows = true; }
  return m;
}
export function reg(m) { m.userData.own = m.userData.own || []; clipMats.push(m); m.clipShadows = true; return m; }
let cutOn = null;
export function setCut(on) {
  if (on === cutOn) return; cutOn = on;
  for (const m of clipMats) {
    const own = m.userData.own;
    m.clippingPlanes = on ? [...own, cutPlane] : (own.length ? own : null);
  }
}
export function mk(geo, material, parent, x = 0, y = 0, z = 0, cast = true, recv = true) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = recv;
  if (parent) parent.add(m);
  return m;
}
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const cyl = (rt, rb, h, s = 10, open = false) => new THREE.CylinderGeometry(rt, rb, h, s, 1, open);
