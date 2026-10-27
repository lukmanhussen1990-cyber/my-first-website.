// LAB cameras (lighting/graphics test bench, NOT part of the reel). Lab shots live at t >= LAB_T0 so they
// never replace a real shot: render a station with
//   CONC=1 NO_OVERLAY=1 node render.mjs stills <labFrame(station, lt)> build/lab
// frame = (LAB_T0 + slot * SLOT + lt) * 30, e.g. night lt 2 s -> 300060.  lt >= 50 runs the timing bench.
import { camShake, slamCurve } from '../three/gold.js';

export const LAB_T0 = 10000;
export const SLOT = 60;
export const STATIONS = ['night', 'beam', 'rain', 'storm', 'gold', 'drop', 'wide', 'face', 'bench'];
export const LAB_SHOTS = STATIONS.map((s, i) => ({ id: 'LAB_' + s, scene: 'LAB', t0: LAB_T0 + i * SLOT, t1: LAB_T0 + (i + 1) * SLOT, trans: 'cut', tdur: 0, station: s, x: i * 400 }));
export const LAB_SHOT_SET = Object.fromEntries(LAB_SHOTS.map((s) => [s.id, '_lab']));
export const labShot = (t) => LAB_SHOTS[Math.min(LAB_SHOTS.length - 1, Math.max(0, Math.floor((t - LAB_T0) / SLOT)))];
export const labFrame = (station, lt) => Math.round((LAB_T0 + STATIONS.indexOf(station) * SLOT + lt) * 30);

// station timelines (local seconds)
export const LAB_GOLD = { n187: 1.0, n182: 2.3, n600: 3.6, fly: 5.4, slam: 6.0 };
export const LAB_DROP = { fall: 1.0, dur: 0.75 };

export function blocking(plan, H) { return {}; }

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, X = shot.x || 0;
  const at = (p) => H.at('_lab', [p[0] + X, p[1], p[2]]);
  const u = H.smooth(H.invLerp(0, 12, lt));
  switch (shot.station) {
    case 'night': { const look = at([0.2, 1.25, 0]); return { pos: H.sph(look, 0.42, 0.06 + 0.02 * u, 9.5 - 1.2 * u), look, fov: 30, locked: true }; }
    case 'beam': { const look = at([-1.5, 1.6, -2.5]); return { pos: H.sph(look, -0.22, 0.3, 46), look, fov: 22, locked: true }; }
    case 'rain': { const look = at([0.3, 0.7, 0]); return { pos: H.sph(look, 0.3, 0.3, 13), look, fov: 30, locked: true, focus: 13 }; }
    case 'storm': { const look = at([0, 16, -60]); return { pos: at([0, 3.2, 26]), look, fov: 44, locked: true }; }
    case 'gold': {
      const look = at([0, 1.35, -0.6]); const pos = H.sph(look, 0.1, 0.16, 15.5);
      const S = slamCurve(lt - LAB_GOLD.slam), K = camShake(t, S.shake || 0, { amp: 0.12 });
      return { pos: H.add(pos, K.pos), look: H.add(look, K.look), roll: K.roll, fov: 26, locked: true };
    }
    case 'drop': { const look = at([0.05, 0.16, 0.1]); return { pos: H.sph(look, 0.28, 0.2, 2.5), look, fov: 30, locked: true, focus: 2.5 }; }
    case 'wide': { const look = at([-0.8, 0, -7]); return { pos: H.sph(look, 0.0, 0.7, 72), look, fov: 17, locked: true }; }
    case 'face': { const look = at([0, 1.45, 0]); return { pos: H.sph(look, 0.55, 0.05, 3.1), look, fov: 28, locked: true, focus: 3.1 }; }
    default: { const look = at([0, 1, 0]); return { pos: H.sph(look, 0.3, 0.3, 20), look, fov: 24, locked: true }; }
  }
}

export const anchors = {};
