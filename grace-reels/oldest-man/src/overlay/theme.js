// Overlay look + layout. Everything in px on the 1080x1920 canvas.
import { SERIF, SANS } from '../lib/fonts.js';
import { clamp, hash01 } from '../lib/util.js';

export { SERIF, SANS };
export const W = 1080, H = 1920;
export const C = {
  gold: '#f0bf5a', goldDeep: '#b8801f', goldInk: '#9a6420', ink: '#2a1a10', cream: '#f7ecd6', warm: '#fff6e8',
  scrimDark: 'rgba(12,8,6,0.5)', scrimLight: 'rgba(250,242,226,0.88)',
};
export const L = { headerY: 150, capTop: 240, capBottom: 600, capW: 940, trackY: 640, tile: 94, gap: 14 };

// tiny pure animation helpers (seconds)
export const ease = {
  out: (u) => 1 - (1 - clamp(u)) ** 3,
  inOut: (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2; },
  back: (u, k = 1.7) => { u = clamp(u); return 1 + (k + 1) * (u - 1) ** 3 + k * (u - 1) ** 2; },
};
export const win = (t, a, b, fi = 0.18, fo = 0.18) => clamp((t - a) / fi) * clamp((b - t) / fo);
// damped "pop" after an event at t0: 0 before, overshoot, settles to 0
export const pop = (t, t0, amp = 0.2, f = 15, d = 7) => (t < t0 ? 0 : amp * Math.exp(-d * (t - t0)) * Math.cos(f * (t - t0)));
// deterministic shake
export const shake = (frame, seed, amp) => [(hash01(frame, seed) - 0.5) * 2 * amp, (hash01(frame, seed + 7) - 0.5) * 2 * amp];

// soft film grain for the HTML-only scenes (generated once, offset per frame)
let _grain = null;
export function grainURL() {
  if (_grain) return _grain;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const img = g.createImageData(256, 256);
  for (let i = 0; i < 256 * 256; i++) { const v = Math.round(hash01(i, 99) * 255); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); _grain = c.toDataURL(); return _grain;
}
