// Textures for animals.js only: pixel-noise fur, tan muzzle, sky reflection map for wet noses / glossy eyes.
// Deterministic (rng / noise2 only). Small canvases sampled with NearestFilter (PS1 look).
import * as THREE from 'three';
import { paint, tex, rng, hexToRgb, noise2, clamp, lerp } from './lib.js';
import { SUN, SKY } from './layout.js';

// Fur: mottled base colour + short darker / lighter strand dashes running along canvas y (= along the body).
export function furCanvas(hex, { size = 64, seed = 1, amount = 16, strands = 1, dark = 0.62, light = 1.28, cell = 5, warm = 0 } = {}) {
  const base = hexToRgb(hex), N = noise2(size, size, cell, seed), N2 = noise2(size, size, 2, seed + 5), R = rng(seed + 11);
  const S = new Float32Array(size * size);
  const nStr = Math.floor(size * size * 0.09 * strands);
  for (let i = 0; i < nStr; i++) {
    const x = Math.floor(R() * size), y = Math.floor(R() * size), len = 2 + Math.floor(R() * 4), v = R() < 0.6 ? -1 : 1;
    for (let k = 0; k < len; k++) S[((y + k) % size) * size + x] = v * (1 - k / (len + 1.5));
  }
  return paint(size, size, (x, y) => {
    const i = y * size + x;
    const d = (N[i] - 0.5) * amount * 1.5 + (N2[i] - 0.5) * amount * 0.9 + (R() - 0.5) * amount * 0.5;
    let f = 1 + d / 100;
    const s = S[i];
    if (s < 0) f *= lerp(1, dark, -s); else if (s > 0) f *= lerp(1, light, s);
    return [base[0] * f + warm * (f - 1) * 30, base[1] * f, base[2] * f];
  });
}
export function furTex(hex, o = {}, repeat = [1, 1]) { return tex(furCanvas(hex, o), { repeat }); }

// Short-pile snout fur with a few darker whisker pores.
export function muzzleTex(hex, seed = 3) {
  const size = 32, base = hexToRgb(hex), N = noise2(size, size, 4, seed), R = rng(seed + 7);
  return tex(paint(size, size, (x, y) => {
    const i = y * size + x;
    let f = 1 + (N[i] - 0.5) * 0.16 + (R() - 0.5) * 0.08;
    if (((x * 7 + y * 13) % 23) === 0) f *= 0.72;
    return [base[0] * f, base[1] * f, base[2] * f];
  }));
}

// Equirectangular sunset sky used as envMap on glossy parts (nose, eyes, tears, claws). three.js convention:
// u = atan2(dir.z, dir.x) / 2PI + 0.5 ; v = asin(dir.y) / PI + 0.5 (v = 1 at the top row, CanvasTexture flipY).
let _env = null;
export function skyEnv() {
  if (_env) return _env;
  const W = 128, H = 64;
  const sd = new THREE.Vector3(...SUN.dir).normalize();
  const hz = hexToRgb(SKY.horizon), md = hexToRgb(SKY.mid), zn = hexToRgb(SKY.zenith), op = hexToRgb(SKY.opposite);
  const ground = [52, 58, 36], groundFar = [96, 84, 70];
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const c = paint(W, H, (x, y) => {
    const u = (x + 0.5) / W, v = 1 - (y + 0.5) / H;
    const el = (v - 0.5) * Math.PI, az = (u - 0.5) * 2 * Math.PI;
    const d = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const toSun = d[0] * sd.x + d[1] * sd.y + d[2] * sd.z;
    const side = clamp(0.5 + 0.5 * (d[0] * sd.x + d[2] * sd.z) / Math.max(1e-3, Math.hypot(sd.x, sd.z) * Math.hypot(d[0], d[2])));
    if (d[1] < -0.02) return mix(groundFar, ground, clamp(-d[1] * 3));
    const h = clamp(d[1] / 0.9);
    let col = h < 0.25 ? mix(mix(op, hz, side), md, h / 0.25) : mix(md, zn, (h - 0.25) / 0.75);
    if (h < 0.08) col = mix(mix(op, hz, side), col, h / 0.08);
    const glow = Math.pow(clamp(toSun), 18) * 1.0 + Math.pow(clamp(toSun), 400) * 2.0;
    col = mix(col, [255, 236, 190], clamp(glow));
    return col;
  });
  const t = new THREE.CanvasTexture(c);
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  _env = t;
  return t;
}
