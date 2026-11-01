// Shared low-poly toolkit for the Thanksgiving reel.
// Everything here is deterministic: no Math.random(), no Date. Animation must be a pure function of time
// so frames can be rendered out of order and in parallel chunks.
import * as THREE from 'three';

export { THREE };

// ---------------------------------------------------------------- math / easing
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t) => Math.pow(clamp(t), 3);
export const easeInOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOutBack = (t, s = 1.70158) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; };
export const pulse = (t, a, b) => smooth(invLerp(a, a + (b - a) * 0.3, t)) * (1 - smooth(invLerp(a + (b - a) * 0.7, b, t)));
// window: 0 before a, ramps to 1 by a+fadeIn, back to 0 from b-fadeOut to b
export const win = (t, a, b, fi = 0.15, fo = 0.15) => smooth(invLerp(a, a + fi, t)) * (1 - smooth(invLerp(b - fo, b, t)));
export const v3 = (x = 0, y = 0, z = 0) => (Array.isArray(x) ? new THREE.Vector3(x[0], x[1], x[2]) : new THREE.Vector3(x, y, z));
export const lerpV = (a, b, t) => v3(a).lerp(v3(b), t);
export const deg = (d) => (d * Math.PI) / 180;

// Deterministic PRNG + hash noise
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash1(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
// smooth 1D noise in [-1,1] (deterministic), used for idle motion and camera handheld drift
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash1(i + seed * 57.3) * 2 - 1, b = hash1(i + 1 + seed * 57.3) * 2 - 1;
  return lerp(a, b, f * f * (3 - 2 * f));
}

// ---------------------------------------------------------------- canvases / textures (PS1 look)
export function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function hexToRgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbToHex([r, g, b]) { return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join(''); }
export function shade(hex, f) { const c = hexToRgb(hex); return rgbToHex(c.map((v) => v * f)); }

// Tileable value noise, w*h floats in [0,1]
export function noise2(w, h, cell, seed) {
  const r = rng(seed);
  const gw = Math.max(1, Math.ceil(w / cell)), gh = Math.max(1, Math.ceil(h / cell));
  const g = new Float32Array(gw * gh).map(() => r());
  const out = new Float32Array(w * h);
  const sm = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = sm(gx - x0), fy = sm(gy - y0);
    const a = g[(y0 % gh) * gw + (x0 % gw)], b = g[(y0 % gh) * gw + ((x0 + 1) % gw)];
    const c = g[((y0 + 1) % gh) * gw + (x0 % gw)], d = g[((y0 + 1) % gh) * gw + ((x0 + 1) % gw)];
    out[y * w + x] = (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  }
  return out;
}

// paint(w,h,(x,y)=>[r,g,b,a?]) -> canvas
export function paint(w, h, fn) {
  const c = canvas(w, h), ctx = c.getContext('2d'), img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b, a = 255] = fn(x, y);
    const i = (y * w + x) * 4;
    img.data[i] = clamp(r, 0, 255); img.data[i + 1] = clamp(g, 0, 255); img.data[i + 2] = clamp(b, 0, 255); img.data[i + 3] = clamp(a, 0, 255);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// Low-res noisy solid colour: the basic "slightly pixelated" surface.
export function noisyCanvas(hex, { size = 32, amount = 14, cell = 3, seed = 1 } = {}) {
  const base = hexToRgb(hex), n = noise2(size, size, cell, seed), R = rng(seed + 99);
  return paint(size, size, (x, y) => { const d = (n[y * size + x] - 0.5) * amount * 1.4 + (R() - 0.5) * amount * 0.6; return [base[0] + d, base[1] + d, base[2] + d]; });
}

// CanvasTexture with nearest-neighbour magnification (pixel look) and sRGB colour.
export function tex(c, { repeat = [1, 1], nearest = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.magFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : (nearest ? THREE.NearestFilter : THREE.LinearFilter);
  t.generateMipmaps = mip;
  t.anisotropy = 8;
  return t;
}

const _matCache = new Map();
// Standard material for the whole reel: flat-shaded facets, soft lighting response.
// opts: { map, rough, metal, emissive, emissiveIntensity, flat, side, transparent, opacity, polygonOffset }
export function mat(colorOrMap, opts = {}) {
  const o = { roughness: opts.rough ?? 0.85, metalness: opts.metal ?? 0.0, flatShading: opts.flat ?? true };
  if (colorOrMap instanceof THREE.Texture) { o.map = colorOrMap; o.color = new THREE.Color(opts.tint ?? 0xffffff); }
  else o.color = new THREE.Color(colorOrMap);
  if (opts.map) o.map = opts.map;
  if (opts.emissive) { o.emissive = new THREE.Color(opts.emissive); o.emissiveIntensity = opts.emissiveIntensity ?? 1; }
  if (opts.side) o.side = opts.side;
  if (opts.transparent) { o.transparent = true; o.opacity = opts.opacity ?? 1; o.depthWrite = opts.depthWrite ?? false; }
  const m = new THREE.MeshStandardMaterial(o);
  if (opts.polygonOffset) { m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2 * opts.polygonOffset; }
  return m;
}
// Cached noisy-colour material: matNoisy('#c8a070', {amount:12})
export function matNoisy(hex, o = {}) {
  const key = hex + JSON.stringify(o);
  if (!_matCache.has(key)) _matCache.set(key, mat(tex(noisyCanvas(hex, { size: o.size ?? 32, amount: o.amount ?? 12, cell: o.cell ?? 3, seed: o.seed ?? 7 }), { repeat: o.repeat ?? [1, 1] }), o));
  return _matCache.get(key);
}

// ---------------------------------------------------------------- geometry helpers
// Mesh that casts + receives shadows by default
export function mesh(geo, material, { cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geo, material); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
}
export function box(w, h, d, material, o = {}) { return mesh(new THREE.BoxGeometry(w, h, d), material, o); }
// Box sitting on y=0 (origin at bottom centre)
export function boxOnFloor(w, h, d, material, o = {}) { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0); return mesh(g, material, o); }
// Low-poly cylinder, origin at bottom centre
export function cyl(rTop, rBot, h, sides, material, o = {}) { const g = new THREE.CylinderGeometry(rTop, rBot, h, sides, 1); g.translate(0, h / 2, 0); return mesh(g, material, o); }
export function lowSphere(rx, ry, rz, w = 8, h = 6) { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); return g; }
// Lathe from [[r,y],...] profile, origin at y=0
export function lathe(profile, sides, material, o = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y)), sides);
  return mesh(g, material, o);
}
// Box with chamfered (bevelled) edges, low poly. origin centre.
export function chamferBox(w, h, d, c = 0.01) {
  const s = new THREE.Shape();
  const hw = w / 2 - c, hh = h / 2 - c;
  s.moveTo(-hw, -h / 2); s.lineTo(hw, -h / 2); s.lineTo(w / 2, -hh); s.lineTo(w / 2, hh); s.lineTo(hw, h / 2);
  s.lineTo(-hw, h / 2); s.lineTo(-w / 2, hh); s.lineTo(-w / 2, -hh); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: 0, bevelSegments: 1 });
  g.translate(0, 0, -(d - 2 * c) / 2);
  return g;
}

// Loft through elliptical rings ({z, w, h, y, x}) along +Z.
export function loftGeometry(rings, sides, { capStart = true, capEnd = true } = {}) {
  const pos = [], uv = [], idx = [];
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const r = rings[i];
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      pos.push(Math.sin(a) * r.w + (r.x || 0), Math.cos(a) * r.h + (r.y || 0), r.z);
      uv.push(i / (n - 1), s / sides);
    }
  }
  const row = sides + 1;
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const a = i * row + s, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const addCap = (ri, flip) => {
    const r = rings[ri], ci = pos.length / 3;
    pos.push(r.x || 0, r.y || 0, r.z); uv.push(ri / (n - 1), 0.5);
    for (let s = 0; s < sides; s++) { const a = ri * row + s, b = a + 1; if (flip) idx.push(ci, a, b); else idx.push(ci, b, a); }
  };
  if (capStart) addCap(0, true);
  if (capEnd) addCap(n - 1, false);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Unit bone along +Y (0..1); placeBone() stretches it between two points.
export function boneGeometry(r0, r1, sides = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, sides, 1, false);
  g.translate(0, 0.5, 0);
  return g;
}
export const UP = new THREE.Vector3(0, 1, 0);
export function placeBone(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  m.position.copy(a);
  if (len > 1e-6) m.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
  m.scale.set(1, Math.max(len, 1e-4), 1);
}

// 3D two-bone IK. A = root joint, target = end goal, L1/L2 bone lengths, pole = point the elbow/knee bends toward.
export function ik3(A, target, L1, L2, pole) {
  const d = new THREE.Vector3().subVectors(target, A);
  const dist = clamp(d.length(), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const dir = d.normalize();
  const toPole = new THREE.Vector3().subVectors(pole, A);
  const n = new THREE.Vector3().crossVectors(dir, toPole);
  if (n.lengthSq() < 1e-10) n.set(1, 0, 0); n.normalize();
  const bend = new THREE.Vector3().crossVectors(n, dir).normalize();
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  return { J: A.clone().addScaledVector(dir, a).addScaledVector(bend, h), E: A.clone().addScaledVector(dir, dist), reach: d.length ? null : null };
}

// Billboard: rotate obj so its +Z faces the camera (Y kept up if keepUp)
export function faceCamera(obj, camera, keepUp = true) {
  if (!keepUp) { obj.quaternion.copy(camera.quaternion); return; }
  const p = new THREE.Vector3(); obj.getWorldPosition(p);
  const c = camera.position;
  obj.rotation.set(0, Math.atan2(c.x - p.x, c.z - p.z), 0);
}

// ---------------------------------------------------------------- camera direction helpers used by shots
// cam spec: { pos:[x,y,z], target:[x,y,z], fov:deg, roll:rad }
export function lerpCam(a, b, t) {
  return { pos: lerpV(a.pos, b.pos, t).toArray(), target: lerpV(a.target, b.target, t).toArray(), fov: lerp(a.fov ?? 40, b.fov ?? 40, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) };
}
// Deterministic shake offset (meters) for time t. amp in meters, freq in Hz.
export function shakeOffset(t, amp, freq = 18, seed = 3) {
  return new THREE.Vector3(noise1(t * freq, seed) * amp, noise1(t * freq, seed + 1) * amp, noise1(t * freq, seed + 2) * amp * 0.5);
}
// Subtle handheld drift (radians) so static shots feel alive
export function handheld(t, amt = 0.003, seed = 11) {
  return { yaw: noise1(t * 0.6, seed) * amt, pitch: noise1(t * 0.5, seed + 4) * amt, roll: noise1(t * 0.4, seed + 9) * amt * 0.6 };
}
