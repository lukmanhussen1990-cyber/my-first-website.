export const W = 1080, H = 1920, FPS = 60;
export const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const seg = (t, a, b) => b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const smoother = x => { x = clamp(x); return x * x * x * (x * (x * 6 - 15) + 10); };
export const eOut = (x, p = 3) => 1 - Math.pow(1 - clamp(x), p);
export const eIn = (x, p = 3) => Math.pow(clamp(x), p);
export const eIO = (x, p = 3) => { x = clamp(x); return x < 0.5 ? 0.5 * Math.pow(2 * x, p) : 1 - 0.5 * Math.pow(2 - 2 * x, p); };
export const backOut = (x, s = 1.70158) => { x = clamp(x) - 1; return x * x * ((s + 1) * x + s) + 1; };
export const backIn = (x, s = 1.70158) => { x = clamp(x); return x * x * ((s + 1) * x - s); };
export const elastic = (x, p = 0.35) => { x = clamp(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x - p / 4) * 2 * Math.PI / p) + 1; };
export const spring = (t, t0, f = 2.2, d = 5) => t <= t0 ? 0 : 1 - Math.exp(-d * (t - t0)) * Math.cos(2 * Math.PI * f * (t - t0));
export const wig = (t, t0, a = 1, f = 3, d = 4) => t <= t0 ? 0 : a * Math.exp(-d * (t - t0)) * Math.sin(2 * Math.PI * f * (t - t0));
// anticipation -> overshoot -> settle
export const antic = (x, a = 0.15) => { x = clamp(x); if (x < 0.22) return -a * Math.sin(x / 0.22 * Math.PI / 2); return lerp(-a, 1, backOut((x - 0.22) / 0.78, 2.4)); };
export function keys(t, kf, ease = smoother) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i], [t1, v1] = kf[i + 1];
    if (t <= t1) {
      const e = kf[i + 1][2] || ease;
      const u = t1 > t0 ? e((t - t0) / (t1 - t0)) : 1;
      if (Array.isArray(v0)) return v0.map((a, j) => lerp(a, v1[j], u));
      return lerp(v0, v1, u);
    }
  }
  return kf[kf.length - 1][1];
}
const PH = []; { let s = 12345; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 256; i++) PH.push(r() * Math.PI * 2); }
export const noise = (t, seed = 0) => { const p = (seed * 4) % 252; return Math.sin(t + PH[p]) * 0.5 + Math.sin(t * 2.31 + PH[p + 1]) * 0.3 + Math.sin(t * 4.13 + PH[p + 2]) * 0.15 + Math.sin(t * 7.7 + PH[p + 3]) * 0.05; };
export function hash(...a) { let h = 2166136261 >>> 0; for (const v of a) { h ^= Math.floor(v * 1000 + 7919) >>> 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15; } return (h >>> 0) / 4294967295; }
export function rng(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
