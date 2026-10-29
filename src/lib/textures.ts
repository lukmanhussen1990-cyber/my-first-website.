import {
  ClampToEdgeWrapping,
  Data3DTexture,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RedFormat,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  CanvasTexture,
  type ColorSpace,
} from 'three';
import { fbm2, hash3, mulberry32, valueNoise3 } from './noise';

/* -------------------------------------------------------------------------- */
/*  Generic helpers                                                           */
/* -------------------------------------------------------------------------- */

function makeTexture(data: Uint8Array, size: number, colorSpace: ColorSpace = NoColorSpace): DataTexture {
  const tex = new DataTexture(data, size, size, RGBAFormat);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = colorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Packs a scalar field (0..1) into a grey RGBA texture. */
function scalarToTexture(field: Float32Array, size: number, lo: number, hi: number): DataTexture {
  const out = new Uint8Array(size * size * 4);
  for (let i = 0; i < field.length; i++) {
    const v = Math.round(255 * Math.min(1, Math.max(0, lo + (hi - lo) * field[i])));
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return makeTexture(out, size);
}

/** Tangent-space normal map from a tileable height field (OpenGL convention). */
function heightToNormal(height: Float32Array, size: number, strength: number): DataTexture {
  const out = new Uint8Array(size * size * 4);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      out[i] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      out[i + 1] = Math.round((-dy * inv * 0.5 + 0.5) * 255);
      out[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      out[i + 3] = 255;
    }
  }
  return makeTexture(out, size);
}

/** Tileable value noise with independent periods per axis (for anisotropic patterns). */
function anisoNoise(u: number, v: number, px: number, py: number, seed: number): number {
  const x = u * px;
  const y = v * py;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let xf = x - xi;
  let yf = y - yi;
  xf = xf * xf * (3 - 2 * xf);
  yf = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % px) + px) % px;
  const x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py;
  const y1 = (y0 + 1) % py;
  const a = hash3(x0, y0, 7, seed);
  const b = hash3(x1, y0, 7, seed);
  const c = hash3(x0, y1, 7, seed);
  const d = hash3(x1, y1, 7, seed);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Draws a soft 1px line into a wrapping scalar field. */
function stampLine(field: Float32Array, size: number, x0: number, y0: number, angle: number, length: number, amount: number) {
  const steps = Math.ceil(length);
  const cx = Math.cos(angle);
  const cy = Math.sin(angle);
  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const envelope = Math.sin(Math.PI * t); // taper both ends
    const x = Math.round(x0 + cx * s);
    const y = Math.round(y0 + cy * s);
    const i = (((y % size) + size) % size) * size + (((x % size) + size) % size);
    field[i] += amount * envelope;
  }
}

/* -------------------------------------------------------------------------- */
/*  Metal finishes                                                            */
/* -------------------------------------------------------------------------- */

export interface SurfaceMaps {
  roughness: DataTexture;
  normal: DataTexture;
  dispose: () => void;
}

/**
 * Brushed / turned aluminium. Streaks run along texture U; in our lathe UVs U
 * wraps around the part, which gives the circumferential "turned" finish of
 * CNC machined rings.
 */
export function createBrushedMaps(size = 512, seed = 11): SurfaceMaps {
  const height = new Float32Array(size * size);
  const rough = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const fine = anisoNoise(u, v, 6, size / 2, seed) * 0.5 + anisoNoise(u, v, 13, size, seed + 3) * 0.35;
      const broad = anisoNoise(u, v, 3, 24, seed + 9) * 0.15;
      const h = fine + broad;
      height[y * size + x] = h;
      rough[y * size + x] = h;
    }
  }
  const rnd = mulberry32(seed * 7 + 1);
  const scratches = Math.round(size * 0.9);
  for (let i = 0; i < scratches; i++) {
    const len = size * (0.08 + rnd() * 0.55);
    const amt = (rnd() < 0.5 ? -1 : 1) * (0.18 + rnd() * 0.35);
    stampLine(height, size, rnd() * size, rnd() * size, (rnd() - 0.5) * 0.01, len, amt);
    stampLine(rough, size, rnd() * size, rnd() * size, (rnd() - 0.5) * 0.01, len, Math.abs(amt) * 0.6);
  }
  normalize(rough);
  const roughness = scalarToTexture(rough, size, 0.72, 1.0);
  const normal = heightToNormal(height, size, 0.55);
  return { roughness, normal, dispose: () => (roughness.dispose(), normal.dispose()) };
}

/**
 * Hard-anodised aluminium: satin micro-texture, faint handling smudges and a
 * few hairline scratches.
 */
export function createAnodizedMaps(size = 512, seed = 23): SurfaceMaps {
  const rough = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const grain = hash3(x, y, 1, seed); // bead-blast grain
      const mottling = fbm2(u, v, 4, 4, seed);
      const smudge = fbm2(u + 0.37, v + 0.11, 3, 3, seed + 50);
      const smudgeMask = Math.max(0, (smudge - 0.56) * 4.5); // sparse glossy blotches
      const i = y * size + x;
      rough[i] = 0.62 + 0.22 * mottling + 0.1 * grain - 0.35 * Math.min(1, smudgeMask);
      height[i] = grain * 0.6 + mottling * 0.4;
    }
  }
  const rnd = mulberry32(seed * 13 + 5);
  for (let i = 0; i < 70; i++) {
    const len = size * (0.03 + rnd() * 0.2);
    const angle = rnd() * Math.PI * 2;
    const x0 = rnd() * size;
    const y0 = rnd() * size;
    stampLine(rough, size, x0, y0, angle, len, 0.28 + rnd() * 0.25);
    stampLine(height, size, x0, y0, angle, len, -0.6);
  }
  normalize(rough);
  const roughness = scalarToTexture(rough, size, 0.55, 1.0);
  const normal = heightToNormal(height, size, 0.35);
  return { roughness, normal, dispose: () => (roughness.dispose(), normal.dispose()) };
}

/** Bead-blasted titanium (pocket clip): isotropic grain with soft variation. */
export function createBlastedMaps(size = 256, seed = 41): SurfaceMaps {
  const rough = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const g = hash3(x, y, 3, seed);
      const m = fbm2(x / size, y / size, 6, 3, seed);
      rough[i] = 0.7 * m + 0.3 * g;
      height[i] = g;
    }
  }
  normalize(rough);
  const roughness = scalarToTexture(rough, size, 0.78, 1.0);
  const normal = heightToNormal(height, size, 0.9);
  return { roughness, normal, dispose: () => (roughness.dispose(), normal.dispose()) };
}

/** Matte black studio floor: troweled micro-cement with soft roughness variation. */
export function createFloorMaps(size = 512, seed = 71): SurfaceMaps & { color: DataTexture } {
  const rough = new Float32Array(size * size);
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const i = y * size + x;
      const broad = fbm2(u, v, 3, 5, seed);
      const mid = fbm2(u + 0.5, v + 0.25, 12, 3, seed + 9);
      const grain = hash3(x, y, 5, seed);
      rough[i] = 0.55 * broad + 0.3 * mid + 0.15 * grain;
      tone[i] = 0.6 * broad + 0.25 * mid + 0.15 * grain;
      height[i] = 0.5 * mid + 0.5 * grain;
    }
  }
  normalize(rough);
  normalize(tone);
  const roughness = scalarToTexture(rough, size, 0.62, 0.96);
  const normal = heightToNormal(height, size, 0.6);
  const colorData = new Uint8Array(size * size * 4);
  for (let i = 0; i < tone.length; i++) {
    const g = Math.round(255 * (0.78 + 0.22 * tone[i]));
    colorData[i * 4] = g;
    colorData[i * 4 + 1] = g;
    colorData[i * 4 + 2] = g;
    colorData[i * 4 + 3] = 255;
  }
  const color = makeTexture(colorData, size, SRGBColorSpace);
  return {
    roughness,
    normal,
    color,
    dispose: () => (roughness.dispose(), normal.dispose(), color.dispose()),
  };
}

function normalize(field: Float32Array) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < field.length; i++) {
    if (field[i] < lo) lo = field[i];
    if (field[i] > hi) hi = field[i];
  }
  const inv = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - lo) * inv;
}

/* -------------------------------------------------------------------------- */
/*  Lighting textures                                                         */
/* -------------------------------------------------------------------------- */

/** Tileable 3D haze density used by the volumetric beam. */
export function createHazeVolume(size = 48, seed = 5): Data3DTexture {
  const data = new Uint8Array(size * size * size);
  const p = 4;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = (x / size) * p;
        const v = (y / size) * p;
        const w = (z / size) * p;
        const n =
          0.55 * valueNoise3(u, v, w, p, seed) +
          0.3 * valueNoise3(u * 2, v * 2, w * 2, p * 2, seed + 1) +
          0.15 * valueNoise3(u * 4, v * 4, w * 4, p * 4, seed + 2);
        data[(z * size + y) * size + x] = Math.round(255 * n);
      }
    }
  }
  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RedFormat;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export interface GoboParams {
  /** Beam half-angle (radians) — the texture spans the spotlight frustum. */
  halfAngle: number;
  hotspot: number;
  spill: number;
  softness: number;
  rings: number;
}

/** Radial beam intensity profile (normalised angle t = θ / halfAngle). */
export function beamProfile(t: number, p: Omit<GoboParams, 'halfAngle'>): number {
  const h = p.hotspot;
  const core = 1 - smoothstep(h * (1 - 0.45 * p.softness), h * (1 + 0.6 * p.softness), t);
  const edge = 1 - smoothstep(0.78 - 0.3 * p.softness, 1.0, t);
  const corona = Math.exp(-Math.pow((t - h * 1.08) / 0.05, 2)) * 0.07 * p.rings;
  const ripple = 1 + p.rings * 0.05 * Math.sin(t * 46) * smoothstep(h, h + 0.15, t) * (1 - t);
  const spill = p.spill * edge * ripple;
  return Math.max(0, core + (1 - core) * spill + corona * edge);
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Spotlight cookie ("gobo"). three.js multiplies the light colour by this map,
 * projected through the shadow camera, so it shapes the hotspot, spill, rings
 * and the subtle tint shift seen in real reflector beams.
 */
export function createGoboTexture(size = 256): { texture: DataTexture; update: (p: GoboParams) => void } {
  const data = new Uint16Array(size * size * 4);
  const texture = new DataTexture(data, size, size, RGBAFormat, HalfFloatType);
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;

  const update = (p: GoboParams) => {
    const tanA = Math.tan(p.halfAngle);
    const toHalf = DataUtils.toHalfFloat;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5) / size - 0.5;
        const dy = (y + 0.5) / size - 0.5;
        const rho = Math.hypot(dx, dy) * 2; // 1 at the inscribed circle (cone edge)
        const theta = Math.atan(rho * tanA);
        const t = theta / p.halfAngle;
        const i = (y * size + x) * 4;
        if (t >= 1) {
          data[i] = data[i + 1] = data[i + 2] = toHalf(0);
          data[i + 3] = toHalf(1);
          continue;
        }
        const azimuth = Math.atan2(dy, dx);
        const imperfection = 1 + 0.018 * Math.sin(azimuth * 3 + 1.3) * smoothstep(0.2, 0.7, t);
        const value = beamProfile(t, p) * imperfection;
        // Tint shift: neutral hotspot, faintly blue corona edge, warmer spill.
        const warm = smoothstep(p.hotspot * 1.2, 1, t);
        const blue = Math.exp(-Math.pow((t - p.hotspot * 1.1) / 0.08, 2)) * 0.06;
        data[i] = toHalf(value * (1 + 0.05 * warm - blue * 0.6));
        data[i + 1] = toHalf(value * (1 + 0.01 * warm));
        data[i + 2] = toHalf(value * (1 - 0.1 * warm + blue));
        data[i + 3] = toHalf(1);
      }
    }
    texture.needsUpdate = true;
  };

  return { texture, update };
}

/** Soft lens glare with a faint six-point starburst. */
export function createGlowTexture(size = 256): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const a = Math.atan2(dy, dx);
      const core = Math.exp(-r * r * 60);
      const halo = 0.42 / (1 + Math.pow(r * 9, 2.2));
      const rays = Math.pow(Math.abs(Math.cos(a * 3)), 60) * Math.exp(-r * 5.5) * 0.35;
      const fadeOut = 1 - smoothstep(0.75, 1, r);
      const v = Math.min(1, (core + halo + rays) * fadeOut);
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
