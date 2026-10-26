// Lighting/grade presets. A set's mood(t) returns a partial object; resolve() fills the rest.
import { DEFAULT_POST } from './post.js';
import * as THREE from 'three';
import { lerp } from '../lib/util.js';

export const BASE = {
  sky: { top: '#9fb6c4', horizon: '#e6d6b0', bottom: '#b8a070', band: '#000000', sunGlow: '#000000', sunDisk: '#000000', stars: 0, moon: 0, moonDir: [0.3, 0.45, -1] },
  sunDir: [-0.5, 0.7, 0.45], sun: { color: '#fff2dc', intensity: 2.6 },
  hemi: { sky: '#dfe6ee', ground: '#8a7350', intensity: 1.1 },
  fog: { color: '#e6d6b0', near: 60, far: 420 },
  char: '#ffffff', ao: 0.18,
  point: null, spot: null, shadow: { size: null }, wind: 1,
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
