/*
 * hero-kit — shared painting toolkit for the cinematic key-art pieces
 * (loading-hero, welcome-city, banner-ferris). Everything is procedural and
 * deterministic: seeded noise, a tiny perspective camera for street canyons,
 * a facade painter (window grids, broken floors, antennas), bloom, lit rain,
 * rippled water reflections, fog and a final film grade.
 *
 * World units are metres; screen units are canvas pixels.
 */
import { rng, layer } from './paint.js';

export { rng, layer };

/* ───────────────────────── math & colour ───────────────────────── */

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
export const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
export const scalec = (c, k) => [c[0] * k, c[1] * k, c[2] * k];

/** Pick from an array with a seeded rng. */
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
export const range = (r, a, b) => a + r() * (b - a);

/* ───────────────────────── noise ───────────────────────── */

/** Seeded 2D gradient (Perlin) noise, output roughly in [-0.7, 0.7]. */
export function perlin(seed = 1) {
  const r = rng(seed);
  const perm = new Uint8Array(256);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const gx = new Float32Array(256);
  const gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const X = xi & 255;
    const Y = yi & 255;
    const h00 = p[p[X] + Y];
    const h10 = p[p[X + 1] + Y];
    const h01 = p[p[X] + Y + 1];
    const h11 = p[p[X + 1] + Y + 1];
    const d00 = gx[h00] * xf + gy[h00] * yf;
    const d10 = gx[h10] * (xf - 1) + gy[h10] * yf;
    const d01 = gx[h01] * xf + gy[h01] * (yf - 1);
    const d11 = gx[h11] * (xf - 1) + gy[h11] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    const v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    const a = d00 + u * (d10 - d00);
    const b = d01 + u * (d11 - d01);
    return a + v * (b - a);
  };
}

/** Fractal sum of a noise function. Returns roughly [-1, 1]. */
export function fbm(n, x, y, oct = 5, lac = 2.03, gain = 0.5) {
  let amp = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += n(x, y) * amp;
    norm += amp;
    amp *= gain;
    x *= lac;
    y *= lac;
    x += 17.3;
    y += 9.1;
  }
  return (sum / norm) * 1.6;
}

/** Ridged fBm (sharp creases), 0..1. */
export function ridged(n, x, y, oct = 5, lac = 2.1, gain = 0.55) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    const v = 1 - Math.abs(n(x, y) * 1.4);
    sum += v * v * amp;
    norm += amp;
    amp *= gain;
    x *= lac;
    y *= lac;
  }
  return sum / norm;
}

/* ───────────────────────── canvas helpers ───────────────────────── */

/** Build a layer from a per-pixel function fn(x, y, out[4]). */
export function pixels(w, h, fn) {
  const { c, ctx } = layer(w, h);
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const out = [0, 0, 0, 0];
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[3] = 255;
      fn(x, y, out);
      d[i] = out[0];
      d[i + 1] = out[1];
      d[i + 2] = out[2];
      d[i + 3] = out[3];
      i += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Copy a canvas into a new layer (optionally scaled down). */
export function copy(src, w = src.width, h = src.height) {
  const l = layer(w, h);
  l.ctx.imageSmoothingQuality = 'high';
  l.ctx.drawImage(src, 0, 0, w, h);
  return l;
}

/** Return a blurred copy of a canvas (blur in source pixels). Works at reduced resolution for big radii. */
export function blurred(src, radius, down = 1) {
  const w = Math.max(1, Math.round(src.width / down));
  const h = Math.max(1, Math.round(src.height / down));
  const l = layer(w, h);
  l.ctx.filter = `blur(${radius / down}px)`;
  l.ctx.drawImage(src, 0, 0, w, h);
  l.ctx.filter = 'none';
  return l.c;
}

/** Draw `src` over ctx with a given composite op and alpha. */
export function comp(ctx, src, op = 'source-over', alpha = 1, x = 0, y = 0, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingQuality = 'high';
  if (w !== undefined) ctx.drawImage(src, x, y, w, h);
  else ctx.drawImage(src, x, y, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

/** Polygon path from [[x,y],...]. */
export function poly(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

/** Soft radial glow (additive). color is [r,g,b]. */
export function glowAt(ctx, x, y, r, color, alpha = 1, op = 'lighter') {
  if (r <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, alpha));
  g.addColorStop(0.25, css(color, alpha * 0.45));
  g.addColorStop(0.6, css(color, alpha * 0.12));
  g.addColorStop(1, css(color, 0));
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Sample the colour of a canvas (downsampled) → (x, y) => [r,g,b] in 0..255. */
export function sampler(src, down = 8) {
  const w = Math.max(1, Math.round(src.width / down));
  const h = Math.max(1, Math.round(src.height / down));
  const l = copy(src, w, h);
  const d = l.ctx.getImageData(0, 0, w, h).data;
  const sx = w / src.width;
  const sy = h / src.height;
  return (x, y) => {
    const xi = clamp(Math.floor(x * sx), 0, w - 1);
    const yi = clamp(Math.floor(y * sy), 0, h - 1);
    const i = (yi * w + xi) * 4;
    return [d[i], d[i + 1], d[i + 2]];
  };
}

/* ───────────────────────── bloom ───────────────────────── */

/**
 * Threshold bloom: extracts highlights of `src` (default: ctx's own canvas),
 * blurs them at several radii and adds them back.
 */
export function bloom(ctx, { src = ctx.canvas, threshold = 0.5, knee = 0.35, down = 4, passes = [[6, 0.5], [18, 0.45], [48, 0.4], [120, 0.3]], op = 'lighter', tint = null } = {}) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const w = Math.ceil(W / down);
  const h = Math.ceil(H / down);
  const s = copy(src, w, h);
  const img = s.ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const t = threshold * 255;
  const kn = Math.max(1, knee * 255);
  for (let i = 0; i < d.length; i += 4) {
    const m = Math.max(d[i], d[i + 1], d[i + 2]);
    let k = (m - t) / kn;
    k = k <= 0 ? 0 : k >= 1 ? 1 : k * k;
    d[i] *= k;
    d[i + 1] *= k;
    d[i + 2] *= k;
    if (tint) {
      d[i] = d[i] * tint[0];
      d[i + 1] = d[i + 1] * tint[1];
      d[i + 2] = d[i + 2] * tint[2];
    }
  }
  s.ctx.putImageData(img, 0, 0);
  for (const [radius, strength] of passes) {
    const b = blurred(s.c, radius / down);
    comp(ctx, b, op, strength, 0, 0, W, H);
  }
}

/** Add an emissive layer with multi-radius glow (layer is full-res, same size as ctx). */
export function emit(ctx, src, { core = 1, passes = [[3, 0.9], [10, 0.7], [28, 0.55], [70, 0.4], [160, 0.25]], down = 3 } = {}) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const small = copy(src, Math.ceil(W / down), Math.ceil(H / down)).c;
  for (const [radius, strength] of passes) {
    const b = radius < 6 ? blurred(src, radius) : blurred(small, radius / down);
    comp(ctx, b, 'lighter', strength, 0, 0, W, H);
  }
  if (core > 0) comp(ctx, src, 'lighter', core, 0, 0, W, H);
}

/* ───────────────────────── atmosphere ───────────────────────── */

/**
 * Horizontal fog band painted from stretched fBm.
 * mask(v) → 0..1 by normalised y; color [r,g,b].
 */
export function fogLayer(W, H, { seed = 5, color = [150, 20, 28], alpha = 0.5, sx = 0.0012, sy = 0.006, mask = () => 1, step = 3, lo = -0.2, hi = 0.7, warp = 0.6 } = {}) {
  const n = perlin(seed);
  const n2 = perlin(seed + 91);
  const w = Math.ceil(W / step);
  const h = Math.ceil(H / step);
  const c = pixels(w, h, (x, y, o) => {
    const X = x * step;
    const Y = y * step;
    const m = mask(Y / H, X / W);
    if (m <= 0.001) {
      o[3] = 0;
      return;
    }
    const wx = fbm(n2, X * sx * 0.7, Y * sy * 0.7, 3) * warp;
    const v = fbm(n, X * sx + wx, Y * sy + wx * 0.5, 5);
    const a = smooth(lo, hi, v) * m;
    o[0] = color[0];
    o[1] = color[1];
    o[2] = color[2];
    o[3] = a * alpha * 255;
  });
  const l = layer(W, H);
  l.ctx.imageSmoothingQuality = 'high';
  l.ctx.drawImage(c, 0, 0, W, H);
  return l.c;
}

/**
 * Rain streaks. light(x,y) may return [r,g,b] used to tint/brighten each
 * streak (rain catches the light behind it). Drawn on its own layer and
 * composited additively; `blur` softens near/out-of-focus drops.
 */
export function rainLayer(W, H, { seed = 21, count = 1500, len = [20, 60], width = [0.8, 1.6], angle = 0.08, alpha = 0.25, light = null, base = [200, 190, 200], blur = 0, mask = null, lightGain = 2.2 } = {}) {
  const r = rng(seed);
  const l = layer(W, H);
  const ctx = l.ctx;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = r() * W * 1.15 - W * 0.075;
    const y = r() * H * 1.05 - H * 0.05;
    const ln = len[0] + r() * (len[1] - len[0]);
    let m = mask ? mask(x / W, y / H) : 1;
    if (m <= 0.01) continue;
    let col = base;
    if (light) {
      const c = light(x, y);
      const lum = (c[0] + c[1] + c[2]) / 765;
      col = [Math.min(255, base[0] * 0.25 + c[0] * lightGain), Math.min(255, base[1] * 0.25 + c[1] * lightGain), Math.min(255, base[2] * 0.25 + c[2] * lightGain)];
      m *= 0.35 + lum * 2.4;
    }
    const a = Math.min(1, alpha * m * (0.35 + r() * 0.65));
    const g = ctx.createLinearGradient(x, y, x - ln * angle, y + ln);
    g.addColorStop(0, css(col, 0));
    g.addColorStop(0.55, css(col, a));
    g.addColorStop(1, css(col, a * 0.2));
    ctx.strokeStyle = g;
    ctx.lineWidth = width[0] + r() * (width[1] - width[0]);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - ln * angle, y + ln);
    ctx.stroke();
  }
  if (blur > 0) return blurred(l.c, blur);
  return l.c;
}

/* ───────────────────────── final grade ───────────────────────── */

/**
 * One-pass film finish: vignette, black lift tinted toward `shadow`, gentle
 * S-curve, saturation, luminance grain and a touch of chromatic aberration
 * at the frame edges.
 */
export function finish(ctx, { seed = 9, grain = 9, vignette = 0.55, vx = 0.5, vy = 0.45, vr = 0.8, shadow = [8, 3, 5], lift = 1, contrast = 1.08, sat = 1.05, ca = 1.2 } = {}) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const r = rng(seed);
  const src = ctx.getImageData(0, 0, W, H);
  const s = src.data;
  const out = ctx.createImageData(W, H);
  const d = out.data;
  const diag = Math.hypot(W, H) * 0.5;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const dx = (x - vx * W) / diag;
      const dy = (y - vy * H) / diag;
      const rr = Math.sqrt(dx * dx + dy * dy);
      // chromatic aberration: red sampled slightly outward, blue inward
      let R = s[i];
      let B = s[i + 2];
      if (ca > 0 && rr > 0.35) {
        const k = (rr - 0.35) * ca * 2;
        const ox = Math.round(dx * k * 6);
        const oy = Math.round(dy * k * 6);
        const xr = clamp(x + ox, 0, W - 1);
        const yr = clamp(y + oy, 0, H - 1);
        R = s[(yr * W + xr) * 4];
        const xb = clamp(x - ox, 0, W - 1);
        const yb = clamp(y - oy, 0, H - 1);
        B = s[(yb * W + xb) * 4 + 2];
      }
      let G = s[i + 1];
      // vignette
      const v = 1 - vignette * smooth(vr * 0.35, vr * 1.05, rr);
      R *= v;
      G *= v;
      B *= v;
      // saturation
      const L = R * 0.2126 + G * 0.7152 + B * 0.0722;
      R = L + (R - L) * sat;
      G = L + (G - L) * sat;
      B = L + (B - L) * sat;
      // contrast around mid grey (soft S)
      R = 128 + (R - 128) * contrast;
      G = 128 + (G - 128) * contrast;
      B = 128 + (B - 128) * contrast;
      // tinted black lift
      R = R < 0 ? 0 : R;
      G = G < 0 ? 0 : G;
      B = B < 0 ? 0 : B;
      R = shadow[0] * lift + R * (1 - shadow[0] / 255);
      G = shadow[1] * lift + G * (1 - shadow[1] / 255);
      B = shadow[2] * lift + B * (1 - shadow[2] / 255);
      // grain, strongest in the mid tones
      const g = (r() + r() - 1) * grain * (0.55 + 0.45 * Math.sin(Math.min(1, L / 200) * Math.PI));
      d[i] = R + g;
      d[i + 1] = G + g;
      d[i + 2] = B + g * 1.05;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

/* ───────────────────────── perspective camera ───────────────────────── */

/**
 * Pinhole camera at (0, h, 0) looking down +Z, pitched up by `pitch` radians.
 * p(X, Y, Z) → [sx, sy, depth]
 */
export function camera({ cx, cy, f, h = 1.6, pitch = 0 }) {
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cam = {
    cx,
    cy,
    f,
    h,
    pitch,
    horizon: cy + f * Math.tan(pitch),
    p(X, Y, Z) {
      const y = Y - h;
      const yy = y * cp - Z * sp;
      const zz = Math.max(0.05, y * sp + Z * cp);
      return [cx + (f * X) / zz, cy - (f * yy) / zz, zz];
    },
    /** project a list of [X,Y,Z] */
    pts(list) {
      return list.map(([X, Y, Z]) => cam.p(X, Y, Z));
    },
    /** screen size in px of `m` metres at depth Z */
    px(m, Z) {
      return (f * m) / Math.max(0.05, Z);
    },
  };
  return cam;
}

/* ───────────────────────── buildings ───────────────────────── */

/**
 * Generate a street-side row of building blocks.
 * side: -1 (left) / 1 (right); street: half width of the street (facade line).
 */
export function streetRow(r, { side, street = 14, z0 = 8, z1 = 260, hMin = 18, hMax = 70, hNear = null, jitterX = 3, gap = 0.25, brokenP = 0.45, tall = null }) {
  const blocks = [];
  let z = z0;
  while (z < z1) {
    const depthZ = range(r, 9, 26);
    const x = street + r() * jitterX;
    const t = clamp((z - z0) / (z1 - z0));
    let hb = range(r, hMin, hMax) * (hNear ? mix(hNear, 1, smooth(0, 0.4, t)) : 1);
    if (tall && r() < tall.p) hb *= tall.k;
    const profile = makeProfile(r, z, z + depthZ, hb, r() < brokenP);
    blocks.push({
      side,
      x,
      z0: z,
      z1: z + depthZ,
      h: hb,
      profile,
      broken: profile.broken,
      out: range(r, 14, 30),
      floor: range(r, 3.2, 4.1),
      col: range(r, 2.4, 3.6),
      seed: Math.floor(r() * 1e9),
      style: Math.floor(r() * 3),
    });
    z += depthZ;
    if (r() < gap) z += range(r, 2.5, 7); // alley
  }
  return blocks;
}

/** Top profile of a block along Z: list of [z, height]. Broken tops get jagged notches. */
export function makeProfile(r, za, zb, h, broken) {
  const pts = [[za, h]];
  if (!broken) {
    pts.push([zb, h]);
    pts.broken = false;
    return pts;
  }
  const len = zb - za;
  // a collapsed section: jagged random walk below the original roof line
  const s0 = za + len * range(r, 0, 0.5);
  const s1 = Math.min(zb, s0 + len * range(r, 0.3, 0.85));
  const depth = h * range(r, 0.12, 0.4);
  pts.push([s0, h]);
  const steps = 7 + Math.floor(r() * 9);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const zt = mix(s0, s1, t + range(r, -0.3, 0.3) / steps);
    const env = Math.pow(Math.sin(t * Math.PI), 0.6);
    const y = h - depth * env * range(r, 0.55, 1.1) - (r() < 0.25 ? depth * 0.25 : 0);
    if (r() < 0.35) pts.push([zt - range(r, 0.1, 0.4), Math.min(h, y + range(r, 1, depth * 0.3))]);
    pts.push([zt, Math.min(h, y)]);
  }
  pts.push([s1, h - range(r, 0, 2)]);
  pts.push([zb, h]);
  pts.broken = { s0, s1, depth };
  return pts;
}

/** Height of a profile at z (piecewise linear). */
export function profileAt(profile, z) {
  for (let i = 1; i < profile.length; i++) {
    const [za, ha] = profile[i - 1];
    const [zb, hb] = profile[i];
    if (z <= zb) return zb === za ? Math.min(ha, hb) : mix(ha, hb, (z - za) / (zb - za));
  }
  return profile[profile.length - 1][1];
}

/**
 * Paint one block (facade facing the street + its front face) with windows,
 * ledges, grime and roof clutter. `env` supplies:
 *   cam, fog(z) → 0..1, fogColor(sy) → [r,g,b], wall [r,g,b], lights (ctx of emissive layer),
 *   mirror (bool: paint the reflection, Y→-Y), litP, warm (0..1 amber share)
 */
export function paintBlock(ctx, b, env) {
  const { cam } = env;
  const r = rng(b.seed);
  const s = b.side;
  const M = env.mirror ? -1 : 1;
  const P = (X, Y, Z) => cam.p(X, Y * M, Z);
  const fogAt = env.fog;
  const shade = (z, sy, k = 1) => {
    const t = fogAt(z);
    return mixc(scalec(env.wall, k), env.fogColor(sy, z), t);
  };

  // ── front face (plane z = z0), extends outward from the facade
  const fx0 = s * b.x;
  const fx1 = s * (b.x + b.out);
  const hFront = b.profile[0][1];
  const frontPts = [P(fx0, 0, b.z0), P(fx0, hFront, b.z0), P(fx1, hFront, b.z0), P(fx1, 0, b.z0)];

  // occlusion: this block hides whatever emissive detail lies behind it
  if (env.lights) {
    const L = env.lights;
    const sidePts = [P(s * b.x, 0, b.z0)];
    for (const [z, hh] of b.profile) sidePts.push(P(s * b.x, hh, z));
    sidePts.push(P(s * b.x, 0, b.z1));
    L.save();
    L.globalCompositeOperation = 'destination-out';
    L.fillStyle = '#000';
    poly(L, frontPts);
    L.fill();
    poly(L, sidePts);
    L.fill();
    L.restore();
  }
  const midY = (frontPts[0][1] + frontPts[1][1]) / 2;
  ctx.save();
  poly(ctx, frontPts);
  ctx.fillStyle = css(shade(b.z0, midY, 0.75));
  ctx.fill();
  ctx.clip();
  if (env.tex) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (1 - fogAt(b.z0)) * (env.texAlpha ?? 0.8);
    ctx.drawImage(env.tex, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  paintFrontWindows(ctx, b, env, P, r, shade);
  ctx.restore();

  // ── side facade (plane X = s*x), polygon along the top profile
  const pts = [P(s * b.x, 0, b.z0)];
  for (const [z, hh] of b.profile) pts.push(P(s * b.x, hh, z));
  pts.push(P(s * b.x, 0, b.z1));
  const sxNear = P(s * b.x, 0, b.z0)[0];
  const sxFar = P(s * b.x, 0, b.z1)[0];
  const g = ctx.createLinearGradient(sxNear, 0, sxFar === sxNear ? sxNear + 1 : sxFar, 0);
  const midSy = (pts[0][1] + pts[1][1]) / 2;
  for (let k = 0; k <= 6; k++) {
    const z = mix(b.z0, b.z1, k / 6);
    const sx = P(s * b.x, 0, z)[0];
    const off = clamp((sx - sxNear) / (sxFar - sxNear || 1));
    g.addColorStop(off, css(shade(z, midSy, 1)));
  }
  ctx.save();
  poly(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  // vertical light: street glow near the base, faint sky sheen high up
  const base = P(s * b.x, 0, (b.z0 + b.z1) / 2);
  const top = P(s * b.x, b.h, (b.z0 + b.z1) / 2);
  const vg = ctx.createLinearGradient(0, base[1], 0, top[1]);
  const glowC = env.streetGlow ?? [150, 20, 24];
  vg.addColorStop(0, css(glowC, 0.22 * (1 - fogAt(b.z0) * 0.6)));
  vg.addColorStop(0.18, css(glowC, 0.05));
  vg.addColorStop(0.7, css(glowC, 0));
  vg.addColorStop(1, css(env.skyGlow ?? [120, 16, 22], 0.1));
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = vg;
  ctx.fillRect(Math.min(sxNear, sxFar) - 2, Math.min(top[1], base[1]) - 400, Math.abs(sxFar - sxNear) + 4, Math.abs(base[1] - top[1]) + 800);
  ctx.globalCompositeOperation = 'source-over';
  if (env.tex) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = (1 - fogAt(b.z0)) * (env.texAlpha ?? 0.8);
    ctx.drawImage(env.tex, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  paintSideWindows(ctx, b, env, P, r, shade);
  ctx.restore();

  // ── corner edge catching the light (near vertical edge of the facade)
  if (env.edge && !env.mirror) {
    const a = P(s * b.x, 0, b.z0);
    const c = P(s * b.x, b.profile[0][1], b.z0);
    const g2 = ctx.createLinearGradient(0, a[1], 0, c[1]);
    const ea = env.edge.alpha * (1 - fogAt(b.z0) * 0.8);
    g2.addColorStop(0, css(env.edge.color, ea * 0.3));
    g2.addColorStop(1, css(env.edge.color, ea));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = g2;
    ctx.lineWidth = Math.max(0.8, cam.px(0.18, b.z0));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
    ctx.restore();
  }

  // ── broken floors: slabs and columns sticking out of collapsed tops
  if (b.broken) paintRuin(ctx, b, env, P, r, shade);

  // ── roof clutter: antennas, water tanks
  paintRoof(ctx, b, env, P, r, shade);

  // ── silhouette rim catching the sky glow
  if (!env.mirror && env.rim) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < b.profile.length; i++) {
      const [z, hh] = b.profile[i];
      const q = P(s * b.x, hh, z);
      if (i === 0) ctx.moveTo(q[0], q[1]);
      else ctx.lineTo(q[0], q[1]);
    }
    ctx.strokeStyle = css(env.rim, (env.rimAlpha ?? 0.12) * (1 - fogAt(b.z0)));
    ctx.lineWidth = Math.max(0.8, cam.px(0.25, b.z0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.stroke();
    ctx.restore();
  }
}

function windowState(r, env) {
  const q = r();
  const lit = env.litP ?? 0.05;
  if (q < lit) {
    const k = r();
    return k < (env.white ?? 0.12) ? 'white' : k < (env.warm ?? 0.35) ? 'amber' : 'red';
  }
  if (q < lit + (env.brokenWin ?? 0.18)) return 'broken';
  return 'dark';
}

function winColor(state, env, z, sy, shade, r) {
  if (state === 'amber') return mixc([255, 150, 70], env.fogColor(sy, z), env.fog(z) * 0.55);
  if (state === 'white') return mixc([255, 214, 204], env.fogColor(sy, z), env.fog(z) * 0.55);
  if (state === 'red') return mixc([255, 46, 44], env.fogColor(sy, z), env.fog(z) * 0.55);
  if (state === 'broken') return shade(z, sy, 0.35);
  // dark glass reflecting a varying amount of red sky
  const g = env.glass ?? [34, 12, 16];
  const refl = env.glassSky ? mixc(g, env.glassSky, Math.pow(r(), 2.2) * 0.6) : g;
  return mixc(refl, env.fogColor(sy, z), env.fog(z) * 0.9).map((v) => v * (0.75 + r() * 0.4));
}

function paintSideWindows(ctx, b, env, P, r, shade) {
  const s = b.side;
  const X = s * b.x;
  const cols = Math.max(1, Math.floor((b.z1 - b.z0 - 1) / b.col));
  const pad = (b.z1 - b.z0 - cols * b.col) / 2;
  const floors = Math.floor((b.h - 2) / b.floor);
  const WW = [0.5, 0.4, 0.86][b.style];
  const WH = [0.48, 0.64, 0.8][b.style];
  const ww = b.col * WW;
  const wh = b.floor * WH;
  const lights = env.lights;
  const cam = env.cam;
  // per-floor occupancy so lit windows cluster like real habitation
  const floorLit = [];
  for (let f = 0; f < floors; f++) floorLit.push(r() < 0.22 ? range(r, 2, 5) : range(r, 0, 0.6));
  // ledges / floor slabs along the facade
  if (env.ledges !== false) {
    for (let f = 1; f <= floors; f++) {
      if (b.style === 2 ? f % 4 : b.style === 1 && f % 2) continue;
      const Y = f * b.floor;
      const a = P(X, Y, b.z0);
      const c = P(X, Y, b.z1);
      ctx.strokeStyle = css(shade(b.z0, a[1], 0.4), 0.95);
      ctx.lineWidth = Math.max(0.6, cam.px(0.3, b.z0));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
      // lit top edge of the ledge (catches the sky)
      ctx.strokeStyle = css(env.sill ?? [90, 22, 28], 0.18 * (1 - env.fog(b.z0)));
      ctx.lineWidth = Math.max(0.5, cam.px(0.08, b.z0));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - cam.px(0.2, b.z0));
      ctx.lineTo(c[0], c[1] - cam.px(0.2, b.z1));
      ctx.stroke();
    }
  }
  for (let j = 0; j < cols; j++) {
    const zc = b.z0 + pad + (j + 0.5) * b.col;
    const za = zc - ww / 2;
    const zb = zc + ww / 2;
    const pa = P(X, 0, za);
    const pb = P(X, 0, zb);
    const wpx = Math.abs(pb[0] - pa[0]);
    if (wpx < 0.3) continue;
    const fz = env.fog(zc);
    // close or very large windows: fewer and dimmer lit ones (big flat blocks of light look crude)
    const near = Math.min(smooth(8, 45, zc), smooth(70 * (env.unit ?? 1), 16 * (env.unit ?? 1), wpx));
    for (let f = 0; f < floors; f++) {
      const y0 = f * b.floor + (b.floor - wh) * 0.55 + (f === 0 ? 0.6 : 0);
      const y1 = y0 + wh;
      if (y1 > profileAt(b.profile, zc) - 0.4) continue;
      const q = [P(X, y0, za), P(X, y1, za), P(X, y1, zb), P(X, y0, zb)];
      let st;
      const qq = r();
      const litP = (env.litP ?? 0.05) * floorLit[f] * (0.25 + 0.75 * near);
      if (f === 0 && b.style !== 2) st = 'shutter';
      else if (qq < litP) {
        const k = r();
        st = k < (env.white ?? 0.12) ? 'white' : k < (env.warm ?? 0.35) ? 'amber' : 'red';
      }
      else if (qq < litP + (env.brokenWin ?? 0.18)) st = 'broken';
      else st = 'dark';
      poly(ctx, q);
      if (st === 'amber' || st === 'red' || st === 'white') {
        const col = winColor(st, env, zc, q[0][1], shade, r);
        const dim = (0.45 + r() * 0.55) * (0.45 + 0.55 * near);
        if (wpx > 3) {
          const g = ctx.createLinearGradient(0, q[1][1], 0, q[0][1]);
          g.addColorStop(0, css(scalec(col, dim * 0.55)));
          g.addColorStop(1, css(scalec(col, dim)));
          ctx.fillStyle = g;
        } else ctx.fillStyle = css(scalec(col, dim));
        ctx.fill();
        // blinds: dark band on top part
        if (wpx > 4 && r() < 0.5) {
          const yb = mix(y0, y1, range(r, 0.45, 0.85));
          poly(ctx, [P(X, yb, za), P(X, y1, za), P(X, y1, zb), P(X, yb, zb)]);
          ctx.fillStyle = css(scalec(col, dim * 0.25));
          ctx.fill();
        }
        const L = env.mirror ? env.mirrorLights : lights;
        if (L) {
          poly(L, q);
          L.fillStyle = css(scalec(col, dim * (env.mirror ? 0.35 : 0.5) * (1 - fz * 0.5)));
          L.fill();
        }
      } else if (st === 'shutter') {
        ctx.fillStyle = css(shade(zc, q[0][1], 0.55));
        ctx.fill();
        if (wpx > 5) {
          ctx.strokeStyle = css(shade(zc, q[0][1], 1.5), 0.6);
          ctx.lineWidth = 0.7;
          for (let k = 1; k < 6; k++) {
            const yy = mix(y0, y1, k / 6);
            const l0 = P(X, yy, za);
            const l1 = P(X, yy, zb);
            ctx.beginPath();
            ctx.moveTo(l0[0], l0[1]);
            ctx.lineTo(l1[0], l1[1]);
            ctx.stroke();
          }
        }
      } else if (st === 'broken') {
        ctx.fillStyle = css(shade(zc, q[0][1], 0.2));
        ctx.fill();
      } else {
        const col = winColor('dark', env, zc, q[0][1], shade, r);
        if (wpx > 3) {
          // glass picks up a sliver of sky at the top
          const g = ctx.createLinearGradient(0, q[1][1], 0, q[0][1]);
          g.addColorStop(0, css(scalec(col, 1.5)));
          g.addColorStop(0.5, css(col));
          g.addColorStop(1, css(scalec(col, 0.6)));
          ctx.fillStyle = g;
        } else ctx.fillStyle = css(col);
        ctx.fill();
      }
      // frame / mullion for close windows
      if (wpx > 8) {
        const m0 = P(X, y0, zc);
        const m1 = P(X, y1, zc);
        ctx.strokeStyle = css(shade(zc, m0[1], 0.5));
        ctx.lineWidth = Math.max(1, wpx * 0.07);
        ctx.beginPath();
        ctx.moveTo(m0[0], m0[1]);
        ctx.lineTo(m1[0], m1[1]);
        if (b.style !== 1) {
          const h0 = P(X, mix(y0, y1, 0.62), za);
          const h1 = P(X, mix(y0, y1, 0.62), zb);
          ctx.moveTo(h0[0], h0[1]);
          ctx.lineTo(h1[0], h1[1]);
        }
        ctx.stroke();
        // sill
        ctx.strokeStyle = css(env.sill ?? [90, 22, 28], 0.22 * (1 - fz));
        ctx.lineWidth = Math.max(0.8, cam.px(0.1, zc));
        ctx.beginPath();
        ctx.moveTo(q[0][0], q[0][1]);
        ctx.lineTo(q[3][0], q[3][1]);
        ctx.stroke();
      }
    }
    // occasional AC unit / box under a window on near facades
    if (wpx > 5 && env.clutter !== false) {
      for (let f = 1; f < floors; f++) {
        if (r() > 0.06) continue;
        const y0 = f * b.floor + 0.2;
        const q = [P(X, y0, zc - 0.5), P(X - s * 0.6, y0, zc - 0.5), P(X - s * 0.6, y0 + 0.7, zc - 0.5), P(X, y0 + 0.7, zc - 0.5)];
        const q2 = [P(X - s * 0.6, y0, zc - 0.5), P(X - s * 0.6, y0, zc + 0.5), P(X - s * 0.6, y0 + 0.7, zc + 0.5), P(X - s * 0.6, y0 + 0.7, zc - 0.5)];
        poly(ctx, q2);
        ctx.fillStyle = css(shade(zc, q2[0][1], 1.3));
        ctx.fill();
        poly(ctx, q);
        ctx.fillStyle = css(shade(zc, q[0][1], 0.6));
        ctx.fill();
      }
    }
  }
  // vertical drain pipe
  if (r() < 0.5) {
    const zp = mix(b.z0, b.z1, range(r, 0.05, 0.95));
    const a = P(X - s * 0.15, 0, zp);
    const c = P(X - s * 0.15, profileAt(b.profile, zp) - 0.5, zp);
    ctx.strokeStyle = css(shade(zp, a[1], 0.5));
    ctx.lineWidth = Math.max(0.6, cam.px(0.18, zp));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  // neon accents: vertical strip on the near corner, or a horizontal band at a floor
  if (env.neon && r() < env.neon.p) {
    const L = env.mirror ? env.mirrorLights : lights;
    const k = env.neon.k ?? 1;
    const tw = (z) => Math.max(1, cam.px(env.neon.w ?? 0.14, z));
    const strip = (pts, z) => {
      const col = mixc(env.neon.color ?? [255, 40, 56], env.fogColor(pts[0][1], z), env.fog(z) * 0.6);
      ctx.strokeStyle = css(col);
      ctx.lineWidth = tw(z);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.stroke();
      if (L) {
        L.strokeStyle = css(col, (env.mirror ? 0.45 : 0.9) * k * (1 - env.fog(z) * 0.4));
        L.lineWidth = tw(z) * 1.8;
        L.beginPath();
        L.moveTo(pts[0][0], pts[0][1]);
        L.lineTo(pts[1][0], pts[1][1]);
        L.stroke();
      }
    };
    if (r() < (env.neon.vertical ?? 0.6)) {
      const z = b.z0 + 0.3;
      const maxLen = env.neon.maxLen ?? b.h;
      const y0 = range(r, 2, b.h * 0.5);
      const y1 = Math.min(profileAt(b.profile, z) - 0.5, y0 + Math.min(maxLen, range(r, b.h * 0.2, b.h * 0.7)));
      if (y1 > y0 + 2) strip([P(X - s * 0.05, y0, z), P(X - s * 0.05, y1, z)], z);
    } else {
      const Y = b.floor * (1 + Math.floor(r() * 3)) - 0.3;
      const za = b.z0 + range(r, 0, 3);
      const zb = Math.min(b.z1, za + range(r, 6, 20));
      strip([P(X - s * 0.05, Y, za), P(X - s * 0.05, Y, zb)], (za + zb) / 2);
    }
  }
}

function paintFrontWindows(ctx, b, env, P, r, shade) {
  const s = b.side;
  const z = b.z0;
  const cols = Math.floor(b.out / b.col);
  const floors = Math.floor((b.profile[0][1] - 2) / b.floor);
  const ww = b.col * 0.55;
  const wh = b.floor * 0.5;
  for (let j = 0; j < cols; j++) {
    const xc = b.x + (j + 0.5) * b.col;
    for (let f = 0; f < floors; f++) {
      const y0 = f * b.floor + (b.floor - wh) * 0.55;
      const st = f === 0 ? 'broken' : windowState(r, env);
      const q = [P(s * (xc - ww / 2), y0, z), P(s * (xc - ww / 2), y0 + wh, z), P(s * (xc + ww / 2), y0 + wh, z), P(s * (xc + ww / 2), y0, z)];
      const col = winColor(st, env, z, q[0][1], shade, r);
      poly(ctx, q);
      const isLit = st === 'amber' || st === 'red' || st === 'white';
      ctx.fillStyle = css(isLit ? scalec(col, 0.35) : scalec(col, 0.6));
      ctx.fill();
      if (isLit && env.lights && !env.mirror) {
        poly(env.lights, q);
        env.lights.fillStyle = css(scalec(col, 0.15));
        env.lights.fill();
      }
    }
  }
}

function paintRuin(ctx, b, env, P, r, shade) {
  const s = b.side;
  const X = s * b.x;
  const { s0, s1 } = b.broken;
  const col = shade(b.z0, 0, 0.9);
  ctx.save();
  ctx.strokeStyle = css(col);
  ctx.fillStyle = css(col);
  // slabs: floors that still stick out over the collapse
  for (let Y = b.floor; Y < b.h; Y += b.floor) {
    if (r() < 0.35) continue;
    // find a run where Y is above the profile (missing wall)
    const za = mix(s0, s1, range(r, 0, 0.4));
    const zb = mix(za, s1, range(r, 0.2, 0.9));
    const ha = profileAt(b.profile, za);
    const hb = profileAt(b.profile, zb);
    if (Y < Math.min(ha, hb) - 0.5) continue;
    const a = P(X, Y, za);
    const c = P(X, Y - range(r, 0, 1.2), zb);
    ctx.lineWidth = Math.max(1, env.cam.px(0.45, za));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.stroke();
  }
  // columns and rebar
  const n = 2 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) {
    const z = mix(s0, s1, range(r, 0.05, 0.95));
    const base = profileAt(b.profile, z);
    const topY = base + range(r, 1.5, b.h - base + 2);
    const a = P(X, base - 0.5, z);
    const c = P(X, topY, z);
    ctx.lineWidth = Math.max(0.8, env.cam.px(0.5, z));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0] + range(r, -1, 1) * env.cam.px(0.4, z), c[1]);
    ctx.stroke();
    // rebar whiskers
    ctx.lineWidth = Math.max(0.5, env.cam.px(0.08, z));
    for (let k = 0; k < 3; k++) {
      const e = P(X, topY + range(r, 0.5, 2.2), z + range(r, -0.8, 0.8));
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function paintRoof(ctx, b, env, P, r, shade) {
  const s = b.side;
  const col = shade(b.z0, 0, 0.9);
  ctx.save();
  ctx.strokeStyle = css(col);
  ctx.fillStyle = css(col);
  const n = r() < 0.6 ? 1 + Math.floor(r() * 3) : 0;
  for (let i = 0; i < n; i++) {
    const z = mix(b.z0, b.z1, range(r, 0.1, 0.9));
    const X = s * (b.x + range(r, 0.5, 6));
    const base = profileAt(b.profile, z);
    if (b.broken && z > b.broken.s0 && z < b.broken.s1) continue;
    const kind = r();
    if (kind < 0.55) {
      // antenna mast with cross bars
      const hgt = range(r, 4, 16);
      const a = P(X, base, z);
      const c = P(X, base + hgt, z);
      ctx.lineWidth = Math.max(0.6, env.cam.px(0.18, z));
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(c[0], c[1]);
      ctx.stroke();
      const bars = 1 + Math.floor(r() * 3);
      for (let k = 0; k < bars; k++) {
        const yy = base + hgt * range(r, 0.45, 0.95);
        const w = range(r, 0.8, 2.4);
        const l0 = P(X - w, yy, z);
        const l1 = P(X + w, yy, z);
        ctx.lineWidth = Math.max(0.5, env.cam.px(0.1, z));
        ctx.beginPath();
        ctx.moveTo(l0[0], l0[1]);
        ctx.lineTo(l1[0], l1[1]);
        ctx.stroke();
      }
      if (r() < 0.6 && env.lights) {
        const rr = Math.max(1.2, env.cam.px(0.35, z));
        const L = env.mirror ? env.mirrorLights : env.lights;
        if (L) {
          L.fillStyle = css([255, 40, 40], env.mirror ? 0.5 : 1);
          L.beginPath();
          L.arc(c[0], c[1], rr, 0, Math.PI * 2);
          L.fill();
        }
        ctx.fillStyle = css([255, 70, 60]);
        ctx.beginPath();
        ctx.arc(c[0], c[1], rr * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = css(col);
      }
    } else {
      // rooftop box / water tank
      const w = range(r, 2, 5);
      const hh = range(r, 1.5, 4);
      const q = [P(X, base - 0.2, z), P(X, base + hh, z), P(X, base + hh, z + w), P(X, base - 0.2, z + w)];
      poly(ctx, q);
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ───────────────────────── water ───────────────────────── */

/**
 * Composite a reflection layer into the water region with ripple
 * displacement, vertical smear and horizontal ripple banding.
 *   top: screen y where the water starts (horizon), mask(x,y) 0..1 optional
 *   fresnel(v) → reflectivity by normalised depth below the horizon (0 at horizon, 1 at bottom)
 */
export function rippleReflect(ctx, refl, { seed = 4, top, bottom = ctx.canvas.height, amp = [1, 16], freq = [0.6, 0.06], smear = 10, smearStep = 2, fresnel = (t) => 1 - t * 0.6, band = 0.35, tint = null } = {}) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const n = perlin(seed);
  const n2 = perlin(seed + 7);
  // 1. row displacement into a temp layer
  const d = layer(W, H);
  d.ctx.imageSmoothingEnabled = true;
  for (let y = Math.floor(top); y < bottom; y++) {
    const t = clamp((y - top) / (bottom - top));
    const a = mix(amp[0], amp[1], t * t);
    const fr = mix(freq[0], freq[1], Math.sqrt(t));
    const off = (n(y * fr * 0.5, 3.1) * 1.3 + n2(y * fr * 2.2, 8.7) * 0.5) * a;
    const dy = n(7.7, y * fr * 0.8) * a * 0.25;
    d.ctx.drawImage(refl, 0, clamp(y + dy, 0, H - 1), W, 1, off, y, W, 1);
  }
  // 2. vertical smear (stretched streaky reflections)
  const sm = layer(W, H);
  sm.ctx.globalAlpha = 1 / smear;
  sm.ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < smear; k++) sm.ctx.drawImage(d.c, 0, (k - smear * 0.35) * smearStep);
  // 3. ripple banding + fresnel mask
  const mask = pixels(Math.ceil(W / 2), Math.ceil(H / 2), (x, y, o) => {
    const Y = y * 2;
    if (Y < top - 4) {
      o[3] = 0;
      return;
    }
    const t = clamp((Y - top) / (bottom - top));
    const persp = 1 / (0.02 + t); // bands compress toward the horizon
    const bn = fbm(n2, x * 2 * 0.004, (Y - top) * 0.02 * Math.min(persp, 18) * 0.3, 3);
    const k = clamp(1 - band + bn * band * 1.6) * fresnel(t);
    o[0] = o[1] = o[2] = 255;
    o[3] = clamp(k) * 255;
  });
  sm.ctx.globalCompositeOperation = 'destination-in';
  sm.ctx.globalAlpha = 1;
  sm.ctx.drawImage(mask, 0, 0, W, H);
  if (tint) {
    sm.ctx.globalCompositeOperation = 'source-atop';
    sm.ctx.fillStyle = tint;
    sm.ctx.fillRect(0, 0, W, H);
  }
  return sm.c;
}

/** Heart pip path centred at (x, y) with half-width s (points down). */
export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 0.15, y + s * 0.75, x - s * 1.0, y + s * 0.25, x - s * 1.0, y - s * 0.3);
  ctx.bezierCurveTo(x - s * 1.0, y - s * 0.78, x - s * 0.6, y - s * 1.0, x - s * 0.42, y - s * 1.0);
  ctx.bezierCurveTo(x - s * 0.2, y - s * 1.0, x - s * 0.04, y - s * 0.85, x, y - s * 0.62);
  ctx.bezierCurveTo(x + s * 0.04, y - s * 0.85, x + s * 0.2, y - s * 1.0, x + s * 0.42, y - s * 1.0);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.0, x + s * 1.0, y - s * 0.78, x + s * 1.0, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 1.0, y + s * 0.25, x + s * 0.15, y + s * 0.75, x, y + s * 0.95);
  ctx.closePath();
}

/** Rounded rect path. */
export function rrect(ctx, x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

/** Sagging cable between two screen points. */
export function cable(ctx, a, b, sag, width, color, segs = 24) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const x = mix(a[0], b[0], t);
    const y = mix(a[1], b[1], t) + sag * 4 * t * (1 - t);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

/** Concrete grime texture (grey around 128) for 'overlay' blending on facades. */
export function concreteTex(W, H, seed = 140) {
  const n = perlin(seed);
  const n2 = perlin(seed + 1);
  const n3 = perlin(seed + 2);
  const c = pixels(Math.ceil(W / 2), Math.ceil(H / 2), (x, y, o) => {
    const blot = fbm(n, x * 0.012, y * 0.012, 5);
    const streak = fbm(n2, x * 0.14, y * 0.006, 3);
    const fine = n3(x * 0.6, y * 0.6);
    const v = 128 + blot * 55 + streak * 40 + fine * 22;
    o[0] = v;
    o[1] = v;
    o[2] = v;
  });
  const l = layer(W, H);
  l.ctx.drawImage(c, 0, 0, W, H);
  return l.c;
}

/** Cap block heights so their roof line stays out of a screen region: allowed(sx, sy) → bool. */
export function capBlocks(blocks, cam, allowed, { minK = 0.12 } = {}) {
  for (const b of blocks) {
    let k = 1;
    for (let it = 0; it < 30; it++) {
      let ok = true;
      for (const [z, hh] of b.profile) {
        const p = cam.p(b.side * b.x, hh * k, z);
        if (!allowed(p[0], p[1])) {
          ok = false;
          break;
        }
      }
      if (ok) break;
      k *= 0.9;
      if (k < minK) break;
    }
    if (k < 1) {
      b.h *= k;
      for (const p of b.profile) p[1] *= k;
      if (b.broken) b.broken.depth *= k;
    }
  }
}
