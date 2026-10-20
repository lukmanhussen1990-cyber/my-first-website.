// Lighting that changes with the journey: golden-hour sun, cool studio key in
// the soil and rock, warm lava glow, the white-hot core flash, sunrise beach.
import * as THREE from 'three';
import { track } from './director.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
// Directions point from the scene toward the light.
const DIR = {
  sun: V(-0.8, 0.24, 0.55),
  studioNear: V(-0.5, 0.55, 0.68),
  studioFar: V(0.5, -0.55, 0.68),   // after the flip "up" on screen is world -y
  beach: V(0.55, -0.42, 0.72),      // sunrise sun (far-local (-0.55, 0.42, 0.72))
};

export function makeLighting(TL) {
  // c = key colour, i = key intensity, hs/hg = hemisphere sky/ground colour, hi = hemisphere intensity,
  // d = key direction blend (0 sun, 1 studio near, 2 studio far, 3 beach), lava = warm fill light,
  // bloomT = bloom threshold, exp = exposure, env = which reflection map, haze = heat haze.
  const K = (t, o) => [t, o];
  const keys = [
    K(0, { cr: 1.0, cg: 0.78, cb: 0.55, i: 3.4, hsr: 1.0, hsg: 0.78, hsb: 0.62, hgr: 0.22, hgg: 0.26, hgb: 0.14, hi: 0.95, d: 0, lava: 0, bloomT: 2.4, exp: 1.0, haze: 0, sat: 1.1 }),
    K(11.8, { cr: 1.0, cg: 0.78, cb: 0.55, i: 3.4, hsr: 1.0, hsg: 0.78, hsb: 0.62, hgr: 0.22, hgg: 0.26, hgb: 0.14, hi: 0.95, d: 0, lava: 0, bloomT: 2.4, exp: 1.0, haze: 0, sat: 1.1 }),
    K(14.0, { cr: 1.0, cg: 0.92, cb: 0.82, i: 2.6, hsr: 0.86, hsg: 0.78, hsb: 0.70, hgr: 0.2, hgg: 0.15, hgb: 0.1, hi: 0.6, d: 1, lava: 0, bloomT: 2.4, exp: 1.05, haze: 0, sat: 1.08 }),
    K(19.5, { cr: 1.0, cg: 0.93, cb: 0.84, i: 2.6, hsr: 0.86, hsg: 0.78, hsb: 0.70, hgr: 0.2, hgg: 0.15, hgb: 0.1, hi: 0.6, d: 1, lava: 0, bloomT: 2.4, exp: 1.05, haze: 0, sat: 1.08 }),
    K(21.5, { cr: 0.93, cg: 0.96, cb: 1.0, i: 2.6, hsr: 0.72, hsg: 0.75, hsb: 0.82, hgr: 0.13, hgg: 0.13, hgb: 0.15, hi: 0.55, d: 1, lava: 0, bloomT: 2.4, exp: 1.05, haze: 0, sat: 1.06 }),
    K(23.4, { cr: 0.95, cg: 0.92, cb: 0.9, i: 2.3, hsr: 0.8, hsg: 0.6, hsb: 0.5, hgr: 0.25, hgg: 0.1, hgb: 0.05, hi: 0.55, d: 1, lava: 0.4, bloomT: 2.0, exp: 1.0, haze: 0.2, sat: 1.08 }),
    K(25.5, { cr: 1.0, cg: 0.72, cb: 0.5, i: 1.7, hsr: 0.95, hsg: 0.5, hsb: 0.28, hgr: 0.45, hgg: 0.12, hgb: 0.03, hi: 0.65, d: 1, lava: 1.0, bloomT: 1.7, exp: 0.95, haze: 0.6, sat: 1.1 }),
    K(30.0, { cr: 1.0, cg: 0.66, cb: 0.42, i: 1.2, hsr: 1.0, hsg: 0.45, hsb: 0.22, hgr: 0.55, hgg: 0.12, hgb: 0.03, hi: 0.8, d: 1, lava: 1.6, bloomT: 1.5, exp: 0.88, haze: 0.6, sat: 1.1 }),
    K(35.6, { cr: 1.0, cg: 0.7, cb: 0.45, i: 1.3, hsr: 1.0, hsg: 0.5, hsb: 0.25, hgr: 0.6, hgg: 0.15, hgb: 0.04, hi: 0.9, d: 1, lava: 2.0, bloomT: 1.4, exp: 0.85, haze: 0.6, sat: 1.1 }),
    K(36.3, { cr: 1.0, cg: 0.75, cb: 0.5, i: 1.5, hsr: 1.0, hsg: 0.6, hsb: 0.3, hgr: 0.7, hgg: 0.3, hgb: 0.08, hi: 1.0, d: 1.2, lava: 1.8, bloomT: 2.0, exp: 0.66, haze: 0.3, sat: 1.15 }),
    K(36.8, { cr: 1.0, cg: 0.8, cb: 0.55, i: 1.4, hsr: 1.0, hsg: 0.65, hsb: 0.35, hgr: 0.75, hgg: 0.4, hgb: 0.15, hi: 0.9, d: 1.5, lava: 1.4, bloomT: 2.8, exp: 0.5, haze: 0.2, sat: 1.2 }),
    K(37.6, { cr: 1.0, cg: 0.68, cb: 0.44, i: 1.3, hsr: 1.0, hsg: 0.48, hsb: 0.24, hgr: 0.55, hgg: 0.13, hgb: 0.03, hi: 0.85, d: 2, lava: 1.8, bloomT: 1.5, exp: 0.88, haze: 0.7, sat: 1.1 }),
    K(40.6, { cr: 1.0, cg: 0.75, cb: 0.55, i: 1.8, hsr: 0.9, hsg: 0.55, hsb: 0.35, hgr: 0.4, hgg: 0.12, hgb: 0.04, hi: 0.65, d: 2, lava: 0.8, bloomT: 1.8, exp: 0.95, haze: 0.4, sat: 1.08 }),
    K(42.4, { cr: 1.0, cg: 0.95, cb: 0.88, i: 2.5, hsr: 0.86, hsg: 0.8, hsb: 0.72, hgr: 0.18, hgg: 0.15, hgb: 0.11, hi: 0.6, d: 2, lava: 0, bloomT: 2.4, exp: 1.05, haze: 0, sat: 1.06 }),
    K(45.0, { cr: 1.0, cg: 0.95, cb: 0.88, i: 2.5, hsr: 0.86, hsg: 0.8, hsb: 0.72, hgr: 0.18, hgg: 0.15, hgb: 0.11, hi: 0.6, d: 2, lava: 0, bloomT: 2.4, exp: 1.05, haze: 0, sat: 1.06 }),
    K(46.3, { cr: 1.0, cg: 0.9, cb: 0.76, i: 2.6, hsr: 0.55, hsg: 0.72, hsb: 1.0, hgr: 0.8, hgg: 0.72, hgb: 0.55, hi: 0.8, d: 3, lava: 0, bloomT: 3.3, exp: 0.95, haze: 0, sat: 1.15 }),
    K(55.6, { cr: 1.0, cg: 0.9, cb: 0.76, i: 2.6, hsr: 0.55, hsg: 0.72, hsb: 1.0, hgr: 0.8, hgg: 0.72, hgb: 0.55, hi: 0.8, d: 3, lava: 0, bloomT: 3.3, exp: 0.95, haze: 0, sat: 1.15 }),
  ];
  const tr = track(keys);
  const envAt = (t) => (t < 13.0 ? 'sunset' : t < 20.2 ? 'soil' : t < 24.2 ? 'rock' : t < 41.4 ? 'lava' : t < 45.6 ? 'rock' : 'beach');
  const dirAt = (d) => {
    const list = [DIR.sun, DIR.studioNear, DIR.studioFar, DIR.beach];
    const i = Math.min(2, Math.floor(d)), f = d - i;
    return list[i].clone().lerp(list[i + 1], f).normalize();
  };
  return (t) => {
    const c = tr(t);
    return { ...c, env: envAt(t), dir: dirAt(c.d) };
  };
}
