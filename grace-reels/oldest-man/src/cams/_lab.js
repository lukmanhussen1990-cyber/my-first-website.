// LAB cameras (lighting/graphics test bench, NOT part of the reel). Lab shots live at t >= LAB_T0 so they
// never replace a real shot: render a station with
//   CONC=1 NO_OVERLAY=1 node render.mjs stills <labFrame(station, lt)>
// frame = (LAB_T0 + slot * SLOT + lt) * 30, e.g. night lt 2 s -> 300060.
export const LAB_T0 = 10000;
export const SLOT = 60;
export const STATIONS = ['night', 'beam', 'rain', 'storm', 'gold', 'drop', 'wide', 'face', 'bench'];
export const LAB_SHOTS = STATIONS.map((s, i) => ({ id: 'LAB_' + s, scene: 'LAB', t0: LAB_T0 + i * SLOT, t1: LAB_T0 + (i + 1) * SLOT, trans: 'cut', tdur: 0, station: s, x: i * 400 }));
export const LAB_SHOT_SET = Object.fromEntries(LAB_SHOTS.map((s) => [s.id, '_lab']));
export const labShot = (t) => LAB_SHOTS[Math.min(LAB_SHOTS.length - 1, Math.max(0, Math.floor((t - LAB_T0) / SLOT)))];
export const labFrame = (station, lt) => Math.round((LAB_T0 + STATIONS.indexOf(station) * SLOT + lt) * 30);

export function blocking(plan, H) { return {}; }

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, X = shot.x || 0;
  const at = (p) => H.at('_lab', [p[0] + X, p[1], p[2]]);
  const u = H.smooth(H.invLerp(0, 12, lt));
  switch (shot.station) {
    case 'night': { const look = at([0.2, 1.25, 0]); return { pos: H.sph(look, 0.42, 0.06 + 0.02 * u, 9.5 - 1.2 * u), look, fov: 30, locked: true }; }
    case 'beam': { const look = at([0, 2.2, 0]); return { pos: H.sph(look, -0.25, 0.32, 40), look, fov: 24, locked: true }; }
    case 'rain': { const look = at([0, 0.4, 0]); return { pos: H.sph(look, 0.3, 0.26, 15), look, fov: 28, locked: true }; }
    case 'storm': { const look = at([0, 16, -60]); return { pos: at([0, 3.2, 26]), look, fov: 44, locked: true }; }
    case 'gold': { const look = at([0, 2.6, 0]); return { pos: H.sph(look, 0.12, 0.14, 17), look, fov: 26, locked: true }; }
    case 'drop': { const look = at([0, 0.22, 0]); return { pos: H.sph(look, 0.25, 0.16, 2.6), look, fov: 30, locked: true, focus: 2.6 }; }
    case 'wide': { const look = at([0, 0, 0]); return { pos: H.sph(look, 0.0, 0.66, 92), look, fov: 17, locked: true }; }
    case 'face': { const look = at([0, 1.45, 0]); return { pos: H.sph(look, 0.55, 0.05, 3.1), look, fov: 28, locked: true, focus: 3.1 }; }
    default: { const look = at([0, 1, 0]); return { pos: H.sph(look, 0.3, 0.3, 20), look, fov: 24, locked: true }; }
  }
}

export const anchors = {};
