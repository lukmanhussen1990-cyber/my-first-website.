// Shared helpers: easing, deterministic noise, keyframe tracks, pixel-art canvas textures.
import * as THREE from 'three';

export const DEG = Math.PI / 180;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t, 0, 1); return t * t * t * (t * (t * 6 - 15) + 10); };
export const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
export const easeIn = (t) => { t = clamp(t, 0, 1); return t * t * t; };

// Deterministic PRNG (mulberry32) so every render of a frame is identical.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth 1D value noise in [-1, 1], deterministic. Used for idle motion / tremble.
const NOISE_TABLE = (() => { const r = rng(1337); return Array.from({ length: 512 }, () => r() * 2 - 1); })();
export function noise1(x) {
  const i = Math.floor(x), f = x - i;
  const a = NOISE_TABLE[((i % 512) + 512) % 512], b = NOISE_TABLE[(((i + 1) % 512) + 512) % 512];
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
// Fractal noise, 3 octaves, roughly [-1, 1].
export function fbm1(x, seed = 0) {
  return (noise1(x + seed * 17.3) * 0.6 + noise1(x * 2.1 + seed * 5.1 + 40) * 0.28 + noise1(x * 4.3 + seed * 3.7 + 90) * 0.12);
}

// Keyframe track of numbers or arrays. keys: [{t, v, ease?}] sorted by t.
// ease names the curve used to arrive AT that key from the previous one.
const EASES = { linear: (t) => t, smooth: smootherstep, inout: easeInOut, out: easeOut, in: easeIn, hold: () => 0 };
export function sampleTrack(keys, t) {
  if (!keys || keys.length === 0) return undefined;
  if (t <= keys[0].t) return keys[0].v;
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1].v;
  let i = 1;
  while (i < keys.length && keys[i].t < t) i++;
  const k0 = keys[i - 1], k1 = keys[i];
  const u = (EASES[k1.ease || 'smooth'])((t - k0.t) / (k1.t - k0.t));
  if (Array.isArray(k0.v)) return k0.v.map((a, j) => lerp(a, k1.v[j], u));
  if (typeof k0.v === 'number') return lerp(k0.v, k1.v, u);
  return u < 0.5 ? k0.v : k1.v;
}

// ---------- Pixel-art procedural textures (NearestFilter = crisp "voxel" look) ----------
// paint(ctx, size, rand) draws into a small canvas; result is a repeating texture.
export function pixelTexture(size, paint, { repeat = [1, 1], seed = 7, colorSpace = THREE.SRGBColorSpace } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  paint(ctx, size, rng(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Fill with base color and per-pixel jitter in lightness (classic voxel-game dither).
export function ditherFill(ctx, size, rand, base, jitter = 0.08, hueJitter = 0) {
  const col = new THREE.Color(base);
  const hsl = {}; col.getHSL(hsl);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = new THREE.Color().setHSL(hsl.h + (rand() - 0.5) * hueJitter, hsl.s, clamp(hsl.l + (rand() - 0.5) * 2 * jitter, 0, 1));
    ctx.fillStyle = '#' + c.getHexString();
    ctx.fillRect(x, y, 1, 1);
  }
}

export function pixelDither(base, { size = 16, jitter = 0.06, hueJitter = 0, repeat = [1, 1], seed = 3 } = {}) {
  return pixelTexture(size, (ctx, s, r) => ditherFill(ctx, s, r, base, jitter, hueJitter), { repeat, seed });
}

// Convenience: material with flat-ish stylized shading.
export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.0, ...opts });
}

export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}
