// Shared materials and small modelling helpers for characters and props.
import * as THREE from 'three';
import * as T from './textures.js';
import { rng, fbm, clamp, lerp } from './util.js';
import { merge, paint } from './plants.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cache = {};

export const M = {
  get burlap() { return cache.burlap ||= (() => { const t = T.burlap(); [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.repeat.set(3, 2)); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, normalScale: new THREE.Vector2(1.3, 1.3) }); })(); },
  get plaid() { return cache.plaid ||= (() => { const t = T.plaid(); [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.repeat.set(2, 1.2)); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap }); })(); },
  get plaidSleeve() { return cache.plaidS ||= (() => { const t = T.plaid(); const m = t.map.clone(); m.repeat.set(1.2, 1.4); m.needsUpdate = true; const n = t.normalMap.clone(); n.repeat.set(1.2, 1.4); n.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: m, normalMap: n, roughness: 0.9 }); })(); },
  get straw() { return cache.straw ||= (() => { const t = T.straw(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, vertexColors: true }); })(); },
  get strawPlain() { return cache.strawP ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }); },
  get hat() { return cache.hat ||= (() => { const t = T.straw(true); [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.repeat.set(5, 2)); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, side: THREE.DoubleSide }); })(); },
  get hatBrim() { return cache.hatB ||= (() => { const t = T.straw(true); const m = t.map.clone(); m.repeat.set(9, 2); m.needsUpdate = true; const n = t.normalMap.clone(); n.repeat.set(9, 2); n.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: m, normalMap: n, roughness: 0.75, side: THREE.DoubleSide }); })(); },
  get wood() { return cache.wood ||= (() => { const t = T.wood('warm'); [t.map, t.normalMap, t.roughnessMap].forEach((x) => x.repeat.set(1, 3)); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap }); })(); },
  get rope() { return cache.rope ||= new THREE.MeshStandardMaterial({ color: 0xa8865a, roughness: 0.95, normalMap: T.straw().normalMap }); },
  get thread() { return cache.thread ||= new THREE.MeshStandardMaterial({ color: 0x1b1410, roughness: 0.8 }); },
  get felt() { return cache.felt ||= new THREE.MeshStandardMaterial({ color: 0x15110f, roughness: 0.55 }); },
  get feltOrange() { return cache.feltO ||= new THREE.MeshStandardMaterial({ color: 0xd8742a, roughness: 0.9, normalMap: T.burlap().normalMap }); },
  get ribbon() { return cache.ribbon ||= new THREE.MeshStandardMaterial({ color: 0xa3262a, roughness: 0.6 }); },
  get metal() { return cache.metal ||= (() => { const t = T.brushedMetal(); return new THREE.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: 0.3, roughnessMap: t.roughnessMap, normalMap: t.normalMap }); })(); },
  get darkMetal() { return cache.dmetal ||= new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: 0.8, roughness: 0.35 }); },
  get gold() { return cache.gold ||= new THREE.MeshStandardMaterial({ color: 0xe0b24a, metalness: 1, roughness: 0.3 }); },
  get paintRed() { return cache.pred ||= new THREE.MeshPhysicalMaterial({ color: 0xd8432b, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }); },
  get paintYellow() { return cache.pyel ||= new THREE.MeshPhysicalMaterial({ color: 0xf2c230, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2 }); },
  get plasticWhite() { return cache.pw ||= new THREE.MeshPhysicalMaterial({ color: 0xf0f0ea, roughness: 0.3, clearcoat: 0.7 }); },
  get plasticDark() { return cache.pd ||= new THREE.MeshPhysicalMaterial({ color: 0x23252b, roughness: 0.4, clearcoat: 0.5 }); },
  get wireRed() { return cache.wr ||= new THREE.MeshPhysicalMaterial({ color: 0xd42a20, roughness: 0.35, clearcoat: 0.6 }); },
  get wireBlack() { return cache.wb ||= new THREE.MeshPhysicalMaterial({ color: 0x1d1d22, roughness: 0.35, clearcoat: 0.6 }); },
  get soilLoose() { return cache.sl ||= (() => { const t = T.looseSoil(); return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughness: 1, color: 0xc0a090 }); })(); },
  get stone() { return cache.stone ||= new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, normalMap: T.looseSoil().normalMap, normalScale: new THREE.Vector2(0.4, 0.4) }); },
  get root() { return cache.root ||= new THREE.MeshStandardMaterial({ color: 0xc8a57c, roughness: 0.8 }); },
};

// Glow material (emissive, blooms). Returns a new material each call so intensity can animate.
export function glow(color, intensity = 3, opts = {}) {
  return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity, roughness: 0.4, ...opts });
}

// A bunch of straw strands fanning out from origin along `dir`.
export function strawTuft({ n = 20, len = 0.12, spread = 0.6, dir = V(0, -1, 0), radius = 0.0055, seed = 1, base = 0.04 } = {}) {
  const r = rng(seed); const parts = [];
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  for (let i = 0; i < n; i++) {
    const L = len * (0.6 + r() * 0.7);
    const c = new THREE.CylinderGeometry(radius * 0.6, radius, L, 4, 1); c.translate(0, L / 2, 0);
    const a = r() * Math.PI * 2, s = r() * spread;
    c.rotateX(s * Math.cos(a)); c.rotateZ(s * Math.sin(a));
    c.translate((r() - 0.5) * base, 0, (r() - 0.5) * base);
    c.applyQuaternion(q);
    const g = 0.75 + r() * 0.4; paint(c, new THREE.Color(0.86 * g, 0.66 * g, 0.3 * g));
    parts.push(c);
  }
  return merge(parts);
}

// Stitches: a running thread along a curve plus small cross stitches.
export function stitches(curve, { cross = 0.02, count = 9, r = 0.0035 } = {}) {
  const parts = [new THREE.TubeGeometry(curve, 24, r, 4)];
  for (let i = 0; i <= count; i++) {
    const t = i / count; const p = curve.getPoint(t); const tan = curve.getTangent(t);
    const n = tan.clone().cross(V(0, 0, 1)).normalize();
    const c = new THREE.CatmullRomCurve3([p.clone().addScaledVector(n, -cross / 2), p.clone().addScaledVector(n, cross / 2).add(V(0, 0, 0.002))]);
    parts.push(new THREE.TubeGeometry(c, 2, r * 0.9, 4));
  }
  return merge(parts);
}

// Rounded, lumpy blob mesh for stones/clods.
export function lumpy(radius, seed, amp = 0.25, detail = 2) {
  const g = new THREE.IcosahedronGeometry(radius, detail); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = v.clone().normalize();
    v.multiplyScalar(1 + (fbm(n.x * 2 + seed, n.y * 2 + n.z * 1.3, 3, seed) - 0.5) * amp * 2); p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// Canvas text label as a texture.
export function labelTexture(w, h, draw) {
  const c = T.textCanvas(w, h, draw); return T.canvasTexture(c);
}

export function setShadows(obj, cast = true, recv = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = recv; } });
  return obj;
}
