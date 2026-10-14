// Shared helpers for the wedding film. Frame numbers are 1-based (frame f is at t = (f - 1) / 30 s); every scene
// defines window.renderFrame = async (f) => { ... } as a pure function of f.
const FPS = 30, BEAT = 25, BAR = 100;                       // 72 bpm: one beat = 25 frames, one bar = 100 frames
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, x) => clamp((x - a) / (b - a));
const smooth = (a, b, x) => { const t = invlerp(a, b, x); return t * t * (3 - 2 * t); };
const ease = {
  linear: t => t, inQuad: t => t * t, outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t, outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuint: t => t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
// piecewise keyframes: kf(f, [[f0, v0], [f1, v1, 'inOutCubic'], ...]); easing names the segment arriving at that key
function kf(f, keys) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i], [f0, v0] = keys[i - 1];
    if (f <= f1) { const t = (ease[e || 'linear'])((f - f0) / (f1 - f0)); return Array.isArray(v0) ? v0.map((a, k) => lerp(a, v1[k], t)) : lerp(v0, v1, t); }
  }
  return keys[keys.length - 1][1];
}
// deterministic randomness
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
// smooth 1-D value noise (for wandering fireflies, swaying lanterns)
function vnoise(x, seed = 0) { const i = Math.floor(x), f = x - i, h = n => { const s = Math.sin((n + seed * 131.7) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const u = f * f * (3 - 2 * f); return lerp(h(i), h(i + 1), u) * 2 - 1; }
const spring = (t, tau = 2.5, T = 9) => t <= 0 ? 0 : 1 - Math.exp(-t / tau) * Math.cos(2 * Math.PI * t / T);
function svgEl(tag, attrs = {}, parent = null) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
async function loadImg(src) { const im = new Image(); im.src = src; await im.decode().catch(() => {}); return im; }
