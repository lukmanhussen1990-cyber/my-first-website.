// Painterly drawing helpers: soft gradients, leaves, canopies, trees, hills, texture.
import { mulberry32, fbm2 } from '../core/random';

type Ctx = CanvasRenderingContext2D;
export type Stops = [number, string][];

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
export function radial(ctx: Ctx, x: number, y: number, r: number, stops: Stops, r0 = 0) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}
export function fillRect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = radial(ctx, x, y, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mixHex(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// a soft-edged ridge/hill silhouette filled down to the bottom
export function ridge(ctx: Ctx, opts: { y: number; amp: number; freq: number; seed: number; x0: number; x1: number; bottom: number; fill: string | CanvasGradient; soft?: number }) {
  const { y, amp, freq, seed, x0, x1, bottom, fill, soft = 0 } = opts;
  ctx.save();
  if (soft) ctx.filter = `blur(${soft}px)`;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 8) ctx.lineTo(x, y - (fbm2(x * freq, 0.5, seed, 4) - 0.5) * 2 * amp);
  ctx.lineTo(x1, bottom);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// rounded canopy made of overlapping blobs, shaded dark -> lit on the light side
export function canopy(ctx: Ctx, cx: number, cy: number, r: number, opts: { dark: string; mid: string; light: string; rim?: string; lightDir?: [number, number]; seed: number; blobs?: number; flat?: number; leafSize?: number }) {
  const rnd = mulberry32(opts.seed);
  const [lx, ly] = opts.lightDir ?? [0.6, -0.5];
  const n = opts.blobs ?? 14;
  const flat = opts.flat ?? 0.75;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r * 0.62;
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * flat, r * (0.32 + rnd() * 0.26)]);
  }
  // shadow mass
  for (const [x, y, br] of pts) {
    ctx.fillStyle = radial(ctx, x - lx * br * 0.3, y - ly * br * 0.3, br * 1.15, [[0, opts.mid], [0.7, opts.dark], [1, opts.dark]]);
    ctx.beginPath();
    ctx.arc(x, y, br, 0, Math.PI * 2);
    ctx.fill();
  }
  // lit tops
  for (const [x, y, br] of pts) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = radial(ctx, x + lx * br * 0.45, y + ly * br * 0.45, br * 0.75, [[0, opts.light], [1, rgbaFromAny(opts.light, 0)]]);
    ctx.beginPath();
    ctx.arc(x, y, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // painterly leaf dabs: dark inside, lit on the light side, a few rim-lit edges
  const dabs = Math.round((r * r) / (opts.leafSize ?? 9) / 9);
  for (let i = 0; i < dabs; i++) {
    const [bx, by, br] = pts[Math.floor(rnd() * pts.length)];
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * br;
    const x = bx + Math.cos(a) * d;
    const y = by + Math.sin(a) * d;
    const nx = (x - cx) / r;
    const ny = (y - cy) / (r * flat);
    const lit = Math.max(0, nx * lx + ny * ly) * 0.9 + (rnd() - 0.5) * 0.35;
    const edge = Math.min(1, Math.hypot(nx, ny));
    const ls = (opts.leafSize ?? 9) * (0.7 + rnd() * 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.globalAlpha = 0.55 + rnd() * 0.4;
    ctx.fillStyle = lit > 0.55 ? opts.light : lit > 0.15 ? opts.mid : opts.dark;
    if (opts.rim && lit > 0.75 && edge > 0.7) ctx.fillStyle = opts.rim;
    ctx.beginPath();
    ctx.ellipse(0, 0, ls * 1.6, ls * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
function rgbaFromAny(c: string, a: number) {
  if (c.startsWith('#')) return rgba(c, a);
  return c.replace(/rgba?\(([^)]+)\)/, (_, inner) => `rgba(${inner.split(',').slice(0, 3).join(',')},${a})`);
}

// a tapering trunk with a few branches (bezier strokes)
export function trunk(ctx: Ctx, x: number, base: number, h: number, w: number, opts: { color: string; light?: string; seed: number; lean?: number; branches?: number; twist?: number }) {
  const rnd = mulberry32(opts.seed);
  const lean = opts.lean ?? 0;
  const twist = opts.twist ?? 0.15;
  const topX = x + lean * h;
  const topY = base - h;
  ctx.save();
  ctx.fillStyle = opts.color;
  ctx.beginPath();
  ctx.moveTo(x - w, base);
  ctx.bezierCurveTo(x - w * 0.7 + twist * h * 0.3, base - h * 0.35, topX - w * 0.6 - twist * h * 0.25, base - h * 0.7, topX - w * 0.3, topY);
  ctx.lineTo(topX + w * 0.3, topY);
  ctx.bezierCurveTo(topX + w * 0.6 - twist * h * 0.2, base - h * 0.7, x + w * 0.7 + twist * h * 0.3, base - h * 0.35, x + w, base);
  ctx.closePath();
  ctx.fill();
  if (opts.light) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = linear(ctx, x - w, 0, x + w, 0, [[0, 'rgba(0,0,0,0)'], [0.65, 'rgba(0,0,0,0)'], [1, opts.light]]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = opts.color;
  ctx.lineCap = 'round';
  for (let i = 0; i < (opts.branches ?? 3); i++) {
    const t = 0.45 + rnd() * 0.45;
    const bx = x + (topX - x) * t;
    const by = base - h * t;
    const dir = rnd() < 0.5 ? -1 : 1;
    const len = h * (0.25 + rnd() * 0.3);
    ctx.lineWidth = w * (0.5 - t * 0.3);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + dir * len * 0.5, by - len * 0.2, bx + dir * len, by - len * (0.4 + rnd() * 0.4));
    ctx.stroke();
  }
  ctx.restore();
}

// a big tropical/storybook leaf: pointed oval with midrib and veins, gradient + rim
export function leaf(ctx: Ctx, x: number, y: number, len: number, wid: number, ang: number, opts: { dark: string; light: string; rim?: string; vein?: string; curl?: number }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const curl = opts.curl ?? 0.1;
  const path = new Path2D();
  path.moveTo(0, 0);
  path.bezierCurveTo(len * 0.25, -wid * (1 + curl), len * 0.7, -wid * (0.9 - curl), len, curl * wid * 2);
  path.bezierCurveTo(len * 0.7, wid * (0.9 + curl), len * 0.25, wid * (1 - curl), 0, 0);
  ctx.fillStyle = linear(ctx, 0, -wid, len * 0.3, wid, [[0, opts.light], [0.55, opts.dark], [1, opts.dark]]);
  ctx.fill(path);
  if (opts.vein) {
    ctx.strokeStyle = opts.vein;
    ctx.lineWidth = Math.max(1.2, wid * 0.04);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, curl * wid * 0.6, len, curl * wid * 2);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.8, wid * 0.02);
    for (let i = 1; i < 7; i++) {
      const t = i / 7;
      const px = len * t;
      const py = curl * wid * 2 * t * t;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + len * 0.06, py + s * wid * 0.45, px + len * 0.12, py + s * wid * 0.75 * Math.sin(Math.PI * t));
        ctx.stroke();
      }
    }
  }
  if (opts.rim) {
    ctx.strokeStyle = opts.rim;
    ctx.lineWidth = Math.max(1.5, wid * 0.05);
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -wid * (1 + curl), len * 0.7, -wid * (0.9 - curl), len, curl * wid * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// a fan of leaves from one point (foreground foliage clumps)
export function leafFan(ctx: Ctx, x: number, y: number, n: number, len: number, a0: number, a1: number, opts: Parameters<typeof leaf>[6] & { seed: number }) {
  const rnd = mulberry32(opts.seed);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = a0 + (a1 - a0) * t + (rnd() - 0.5) * 0.15;
    const l = len * (0.75 + rnd() * 0.4);
    leaf(ctx, x, y, l, l * (0.2 + rnd() * 0.08), a, { ...opts, curl: (rnd() - 0.5) * 0.4 });
  }
}

// grass blades + tiny glowing flowers along a ground band
export function meadow(ctx: Ctx, x0: number, x1: number, y0: number, y1: number, opts: { dark: string; light: string; flower?: string; seed: number; density?: number }) {
  const rnd = mulberry32(opts.seed);
  const n = Math.round((x1 - x0) * (opts.density ?? 1.2));
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const t = rnd();
    const y = y0 + t * (y1 - y0);
    const h = 18 + t * 70 + rnd() * 30;
    ctx.strokeStyle = rnd() < 0.3 ? opts.light : opts.dark;
    ctx.lineWidth = 1 + t * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + (rnd() - 0.5) * h * 0.4, y - h * 0.6, x + (rnd() - 0.5) * h * 0.7, y - h);
    ctx.stroke();
  }
  if (opts.flower) {
    for (let i = 0; i < n / 14; i++) {
      const x = x0 + rnd() * (x1 - x0);
      const t = rnd();
      const y = y0 + t * (y1 - y0) - 20;
      const r = 2 + t * 6;
      glow(ctx, x, y, r * 4, opts.flower, 0.35);
      ctx.fillStyle = opts.flower;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// painterly paper/brush grain applied over a whole layer
export function grain(ctx: Ctx, w: number, h: number, seed: number, strength = 0.06, scale = 0.012) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const step = 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const n = (fbm2(x * scale, y * scale, seed, 3) - 0.5) * 2 * strength * 255;
      for (let yy = y; yy < Math.min(h, y + step); yy++) {
        for (let xx = x; xx < Math.min(w, x + step); xx++) {
          const i = (yy * w + xx) * 4;
          if (d[i + 3] === 0) continue;
          d[i] += n;
          d[i + 1] += n;
          d[i + 2] += n;
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

// soft atmospheric haze band (between depth layers)
export function haze(ctx: Ctx, y0: number, y1: number, w: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = linear(ctx, 0, y0, 0, y1, [[0, rgbaFromAny(color, 0)], [0.5, color], [1, rgbaFromAny(color, 0)]]);
  ctx.fillRect(-400, y0, w + 800, y1 - y0);
  ctx.restore();
}

// dense foreground grass, leaves and flowers rising to yTop (hides feet and legs in wide shots)
export function tallGrass(ctx: Ctx, x0: number, x1: number, yTop: number, bottom: number, opts: { dark: string; mid: string; rim: string; flower: string; seed: number }) {
  const rnd = mulberry32(opts.seed);
  ctx.save();
  ctx.fillStyle = opts.dark;
  ctx.beginPath();
  ctx.moveTo(x0, bottom);
  for (let x = x0; x <= x1; x += 16) ctx.lineTo(x, yTop + 70 + (fbm2(x * 0.01, 2, opts.seed) - 0.5) * 60);
  ctx.lineTo(x1, bottom);
  ctx.fill();
  ctx.lineCap = 'round';
  const n = Math.round((x1 - x0) * 1.4);
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const base = yTop + 120 + rnd() * (bottom - yTop);
    const h = 120 + rnd() * 160;
    const lean = (rnd() - 0.5) * h * 0.6;
    ctx.strokeStyle = rnd() < 0.18 ? opts.mid : opts.dark;
    ctx.lineWidth = 3 + rnd() * 5;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + lean * 0.3, base - h * 0.6, x + lean, base - h);
    ctx.stroke();
    if (rnd() < 0.25) {
      ctx.strokeStyle = opts.rim;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 2, base - h * 0.5);
      ctx.quadraticCurveTo(x + lean * 0.3 + 2, base - h * 0.75, x + lean + 1, base - h);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (let i = 0; i < n / 10; i++) {
    const x = x0 + rnd() * (x1 - x0);
    const y = yTop + 30 + rnd() * 160;
    const r = 5 + rnd() * 8;
    glow(ctx, x, y, r * 4, opts.flower, 0.3);
    ctx.fillStyle = opts.flower;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.ellipse(x + Math.cos((k * Math.PI * 2) / 5) * r * 0.7, y + Math.sin((k * Math.PI * 2) / 5) * r * 0.7, r * 0.6, r * 0.35, (k * Math.PI * 2) / 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
