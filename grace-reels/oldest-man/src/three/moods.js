// Lighting/grade presets. A set's mood(t) returns a partial object; resolve() fills the rest from BASE.
// New in v2 (all default OFF, so a mood only pays for what it asks):
//   fog.density / fog.height / fog.base / fog.sun / fog.max / fog.hcolor  -> exponential height fog (post)
//   sky.clouds / sky.storm / sky.crack                                    -> sky.js cloud layer, storm decks, lightning
//   post.ao, post.godrays{}, post.tonemap 'aces'|'agx', post.gLift/gGamma/gGain, post.split*, post.aa, post.supersample
//   rain{} / wet / wetSheen                                               -> rain.js streaks, sheets, splashes, wet materials
// MOODS holds per-scene presets (merge them: mood(t) { return merge(MOODS.nightLamp, { ... }) }).
import { DEFAULT_POST } from './post.js';
import * as THREE from 'three';
import { lerp, clamp, smooth } from '../lib/util.js';

export const BASE = {
  sky: {
    top: '#9fb6c4', horizon: '#e6d6b0', bottom: '#b8a070', band: '#000000', sunGlow: '#000000', sunDisk: '#000000', stars: 0, moon: 0, moonDir: [0.3, 0.45, -1],
    clouds: 0, cloudLit: '#fff6e8', cloudShade: '#b9b0a4', cloudSpeed: 1.2, cloudAlt: 85, cloudScale: 14,
    storm: 0, stormDark: '#2b3038', stormLit: '#5d6670', stormAlt: 70, crack: null,
  },
  sunDir: [-0.5, 0.7, 0.45], sun: { color: '#fff2dc', intensity: 2.6 },
  hemi: { sky: '#dfe6ee', ground: '#8a7350', intensity: 1.1 },
  fog: { color: '#e6d6b0', near: 60, far: 420, density: 0, height: 8, base: 0, sun: 0.35, max: 0.92 },
  char: '#ffffff', ao: 0.18,
  point: null, spot: null, shadow: { size: null }, wind: 1,
  // rain.js (engine-level): k 0 = off .. 1 = sheets (use rainRamp); wind [x,z] m/s slant; sheets 0..1 far curtains;
  // splash 0..1 ground crowns (near shots); groundY set-local ground height for streaks/splashes (or give the set heightAt(x,z))
  rain: { k: 0, wind: [1.2, 0.3], speed: 9, len: 0.5, width: 0.009, alpha: 0.3, color: '#c4ccd6', far: 70, sheets: 0, sheetColor: null, splash: 1, groundY: 0 },
  // wet ground: 0..1 darkens + sheen on materials patched with rain.js wetten(); wetSheen defaults to sky.horizon
  wet: 0, wetSheen: null,
  post: { ...DEFAULT_POST },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(a, b) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b || {})) o[k] = isObj(v) && isObj(a[k]) ? merge(a[k], v) : v;
  return o;
}
export const resolve = (m) => merge(BASE, m);

// blend two (resolved) moods: colours lerp in linear space, numbers lerp, the rest switches at k=0.5
const _a = new THREE.Color(), _b = new THREE.Color();
export function blend(A, B, k) {
  const walk = (a, b) => {
    if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, k);
    if (typeof a === 'string' && typeof b === 'string' && a[0] === '#' && b[0] === '#') return '#' + _a.set(a).lerp(_b.set(b), k).getHexString();
    if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => lerp(x, b[i], k));
    if (isObj(a) && isObj(b)) { const o = {}; for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) o[key] = key in a && key in b ? walk(a[key], b[key]) : (k < 0.5 ? a[key] : b[key]) ?? a[key] ?? b[key]; return o; }
    return k < 0.5 ? a : b;
  };
  return walk(A, B);
}

// keyframed moods: keys = [[t, partialMood], ...] -> resolved mood at t (eased blend between neighbours)
export function moodAt(t, keys) {
  if (t <= keys[0][0]) return resolve(keys[0][1]);
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, m0] = keys[i], [t1, m1] = keys[i + 1];
    if (t <= t1) return blend(resolve(m0), resolve(m1), smooth((t - t0) / (t1 - t0)));
  }
  return resolve(keys[keys.length - 1][1]);
}

// ---------------------------------------------------------------- per-scene presets (BRIEF "Moods")
// The sun comes from the BACK-LEFT in day scenes (sunDir points TOWARD the sun): shadows fall toward camera-right.
export const MOODS = {
  // S1, S2, S8: deep blue night + warm amber lamp (the set adds point: lamp.light(t, level))
  nightLamp: {
    sky: { top: '#050a1a', horizon: '#26365f', bottom: '#0b0f1a', band: '#1c2a52', stars: 1.2, moon: 0.8, moonDir: [-0.32, 0.2, -1],
      clouds: 0.4, cloudLit: '#56679a', cloudShade: '#18203a', cloudSpeed: 0.8, cloudAlt: 48, cloudScale: 12, cloudFade: 1400 },
    sunDir: [0.45, 0.62, -0.65], sun: { color: '#8ea4d8', intensity: 0.42 },
    hemi: { sky: '#33467a', ground: '#1c1712', intensity: 0.42 },
    fog: { color: '#1f2b4c', near: 25, far: 320, density: 0.01, height: 5, sun: 0 },
    char: '#8592b8', ao: 0.25, wind: 0.6,
    post: { exposure: 1.12, bloom: 0.85, bloomThreshold: 0.9, haze: 0, vignette: 0.55, grain: 0.028, sat: 1.0, contrast: 1.04,
      split: 0.4, splitShadow: '#3d5a94', splitHigh: '#ffb35c', splitBalance: -0.05, ao: 0.65, aoRadius: 0.4, tilt: 0.3 },
  },
  // S3: soft morning gold, holy beam (set: post.godrays.pos = beam source, strength ~0.7)
  morningGold: {
    sky: { top: '#d9c7a6', horizon: '#f6dcae', bottom: '#c9a26c', band: '#3a2810', sunGlow: '#ffcf8a', sunDisk: '#fff0cc', clouds: 0.3, cloudLit: '#fff1d6', cloudShade: '#d9b48a', cloudSpeed: 1.0 },
    sunDir: [-0.55, 0.36, -0.62], sun: { color: '#ffd9a0', intensity: 2.9 },
    hemi: { sky: '#e8dcc6', ground: '#9a7a4e', intensity: 0.95 },
    fog: { color: '#ecd3a4', near: 50, far: 380, density: 0.02, height: 7, sun: 0.6 },
    char: '#fff4e2', ao: 0.18,
    post: { exposure: 1.02, bloom: 0.7, bloomThreshold: 0.92, hazeColor: '#f2d9a8', haze: 0.18, vignette: 0.32, grain: 0.024,
      split: 0.3, splitShadow: '#7a5a86', splitHigh: '#ffcf7a', ao: 0.5, aoRadius: 0.5,
      godrays: { color: '#ffe0a8', strength: 0, radius: 0.14, decay: 0.968, density: 0.92, streaks: 0.7 } },
  },
  // S4: warm parchment (HTML scene; kept for transitions)
  parchment: {
    sky: { top: '#e8d3a8', horizon: '#f0dfbc', bottom: '#cdb07a' }, sun: { color: '#fff0d6', intensity: 2.4 },
    post: { haze: 0.1, vignette: 0.35, split: 0.2, splitShadow: '#6b4a2a', splitHigh: '#ffe1a6' },
  },
  // S5-S7: dark with gold numbers (a warm key on the people, the numbers carry their own env map)
  mathDark: {
    sky: { top: '#0d0906', horizon: '#20160e', bottom: '#0a0705', stars: 0.25 },
    sunDir: [-0.45, 0.5, 0.55], sun: { color: '#ffcf96', intensity: 1.15 },
    hemi: { sky: '#3a2c20', ground: '#120d09', intensity: 0.35 },
    fog: { color: '#1a120c', near: 18, far: 140, density: 0.02, height: 4, sun: 0 },
    char: '#c9b294', ao: 0.25,
    post: { exposure: 1.08, bloom: 1.0, bloomThreshold: 0.82, haze: 0, vignette: 0.68, grain: 0.03, contrast: 1.06,
      split: 0.35, splitShadow: '#3a2416', splitHigh: '#ffc25a', ao: 0.6, tilt: 0.25 },
  },
  // S9, S10: lamp out, cold blue-grey (first rain in S10)
  coldBlue: {
    sky: { top: '#3f4c5c', horizon: '#6c7886', bottom: '#2f3741', clouds: 0.7, cloudLit: '#8b96a3', cloudShade: '#3c4552', storm: 0.35, stormDark: '#2c333c', stormLit: '#5b6571' },
    sunDir: [-0.3, 0.75, -0.5], sun: { color: '#b8c6d8', intensity: 0.9 },
    hemi: { sky: '#8796aa', ground: '#3a3630', intensity: 0.75 },
    fog: { color: '#606b78', near: 30, far: 260, density: 0.025, height: 6, sun: 0 },
    char: '#a9b4c4', ao: 0.22, wind: 1.3,
    post: { exposure: 1.0, bloom: 0.45, haze: 0.08, hazeColor: '#7d8896', vignette: 0.5, grain: 0.03, sat: 0.72, contrast: 1.05,
      split: 0.35, splitShadow: '#2c4766', splitHigh: '#b8c4cc', ao: 0.55 },
  },
  // S11: changing seasons; use seasonMood(k) (0 green -> 0.5 dry -> 1 green)
  // S12: storm grey with cracks of light (set: sky.crack = { age: t - ev.floodCrack, pos }, godrays at the crack)
  storm: {
    sky: { top: '#2a3038', horizon: '#59606a', bottom: '#262a2f', clouds: 0, storm: 1, stormDark: '#22272e', stormLit: '#4f5864', stormAlt: 60, stormSpeed: 1.6 },
    sunDir: [-0.2, 0.85, -0.45], sun: { color: '#9aa6b6', intensity: 0.7 },
    hemi: { sky: '#6f7c8e', ground: '#2b2a28', intensity: 0.7 },
    fog: { color: '#4b535d', near: 20, far: 220, density: 0.035, height: 7, sun: 0 },
    char: '#9aa4b2', ao: 0.22, wind: 2.2,
    post: { exposure: 1.0, bloom: 0.75, bloomThreshold: 0.88, haze: 0.06, hazeColor: '#59606a', vignette: 0.55, grain: 0.034, sat: 0.7, contrast: 1.1,
      split: 0.35, splitShadow: '#24384f', splitHigh: '#d6dde4', ao: 0.5,
      godrays: { color: '#fff1d0', strength: 0, radius: 0.2, decay: 0.97, density: 0.95, streaks: 0.8 } },
  },
  // S13a: rainy city at night (cool); S13b blends to cityWarm at ev.warmLight
  cityNight: {
    sky: { top: '#070c18', horizon: '#1d2638', bottom: '#0a0d14', clouds: 0, storm: 0.6, stormDark: '#0e131c', stormLit: '#242c3a', stormAlt: 80 },
    sunDir: [0.3, 0.7, -0.6], sun: { color: '#7d8fb8', intensity: 0.35 },
    hemi: { sky: '#2d3a58', ground: '#14161b', intensity: 0.45 },
    fog: { color: '#151d2c', near: 20, far: 200, density: 0.03, height: 5, sun: 0 },
    char: '#8794b4', ao: 0.25, wind: 1.2,
    post: { exposure: 1.1, bloom: 0.9, bloomThreshold: 0.85, haze: 0, vignette: 0.55, grain: 0.03, sat: 0.85,
      split: 0.4, splitShadow: '#24406e', splitHigh: '#ffcf8f', ao: 0.55 },
  },
  cityWarm: {
    sky: { top: '#140e14', horizon: '#3a2a2a', bottom: '#120c0c' },
    hemi: { sky: '#4a3a3a', ground: '#1a1410', intensity: 0.5 },
    fog: { color: '#2a1e1a', density: 0.022 },
    char: '#d6b896',
    post: { exposure: 1.15, bloom: 1.05, sat: 0.95, split: 0.35, splitShadow: '#3a2a3e', splitHigh: '#ffc884',
      godrays: { color: '#ffd9a0', strength: 0, radius: 0.12, decay: 0.97, density: 0.95, streaks: 0.5 } },
  },
  // S14: dark warm call to action
  ctaDark: {
    sky: { top: '#120b07', horizon: '#2a1a10', bottom: '#0c0805' },
    sunDir: [-0.4, 0.6, 0.6], sun: { color: '#ffd2a0', intensity: 1.4 },
    hemi: { sky: '#4a3324', ground: '#140e0a', intensity: 0.45 },
    fog: { color: '#1e140d', near: 15, far: 120 },
    post: { exposure: 1.05, bloom: 0.95, bloomThreshold: 0.85, haze: 0, vignette: 0.6, grain: 0.028, split: 0.3, splitShadow: '#3a2014', splitHigh: '#ffcf80', tilt: 0 },
  },
};

// S11 time-lapse: k 0 green spring -> 0.5 dry summer -> 1 green again (pass a looping k for several years)
const SEASON_GREEN = {
  sky: { top: '#a9c2cf', horizon: '#e9dfc0', bottom: '#b9a578', clouds: 0.45, cloudLit: '#ffffff', cloudShade: '#c6c3bb' },
  sunDir: [-0.5, 0.6, -0.55], sun: { color: '#fff1d8', intensity: 2.7 }, hemi: { sky: '#dce8ee', ground: '#7d7a48', intensity: 1.1 },
  fog: { color: '#e3dcc2', density: 0.012, height: 8 },
  post: { haze: 0.15, hazeColor: '#e3dcc2', sat: 1.08, split: 0.2, splitShadow: '#4a6a7a', splitHigh: '#ffe0a0', ao: 0.45 },
};
const SEASON_DRY = {
  sky: { top: '#c9c0a4', horizon: '#f2dcab', bottom: '#c99a5e', clouds: 0.1, cloudLit: '#fff3dc', cloudShade: '#d9bc90' },
  sunDir: [-0.5, 0.72, -0.4], sun: { color: '#ffe2b0', intensity: 3.1 }, hemi: { sky: '#efe0c4', ground: '#a07a48', intensity: 1.0 },
  fog: { color: '#efd8a8', density: 0.022, height: 9, sun: 0.7 },
  post: { haze: 0.26, hazeColor: '#f0d6a2', sat: 0.88, split: 0.28, splitShadow: '#7a5038', splitHigh: '#ffd27a', ao: 0.45 },
};
export function seasonMood(k) {
  const d = 1 - Math.abs(((k % 1) + 1) % 1 * 2 - 1);    // 0 green, 1 dry (triangle wave)
  return blend(resolve(SEASON_GREEN), resolve(SEASON_DRY), smooth(clamp(d)));
}
