// The director: pure functions of time for every shot's camera and for blocking (who stands where).
// Imported by the 3D engine (to place things) AND by the HTML overlay (to project label anchors with the
// very same camera), so labels stay glued to the world during camera moves.
//
// Each 3D set owns a camera module in src/cams/<set>.js exporting:
//   blocking(plan, H)                  -> object of pure functions of t (positions, timings) for that set
//   camera(plan, B, shot, t, H)        -> { pos:[x,y,z], look:[x,y,z], fov, focus?, mblur?, roll? } (WORLD coords)
//   anchors                            -> { name: (plan, B, t) => [x,y,z] } world points for overlay labels
// H = helpers below (at(set, p) converts set-local to world coords; sets live at SETS offsets).
import { clamp, lerp, smooth, invLerp, easeInOut, easeOut, easeIn, hash01, noise2 } from './util.js';
import { shotAt } from '../plan.js';
import * as hill from '../cams/hill.js';
import * as enoch from '../cams/enoch.js';
import * as family from '../cams/family.js';
import * as ark from '../cams/ark.js';
import * as city from '../cams/city.js';
import * as cta from '../cams/cta.js';

export const SETS = { hill: [0, 0, 0], enoch: [1000, 0, 0], family: [2000, 0, 0], ark: [3000, 0, 0], city: [4000, 0, 0], cta: [5000, 0, 0] };
// which 3D set each shot shows (shots not listed are HTML-only: S4 timeline, S15 end card)
export const SHOT_SET = {
  S1: 'hill', S2: 'hill', S3: 'enoch', S5: 'family', S6: 'family', S7: 'ark', S8: 'hill', S9: 'hill', S10: 'hill',
  S11a: 'ark', S11b: 'ark', S11c: 'ark', S12: 'ark', S13a: 'city', S13b: 'city', S14: 'cta', LOOP: 'hill',
};
export const CAMS = { hill, enoch, family, ark, city, cta };

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const at = (set, p) => add(SETS[set], p);
const sph = (target, yaw, pitch, dist) => [target[0] + Math.sin(yaw) * Math.cos(pitch) * dist, target[1] + Math.sin(pitch) * dist, target[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
const mixv = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const H = { SETS, add, at, sph, mixv, clamp, lerp, smooth, invLerp, easeInOut, easeOut, easeIn, hash01, noise2 };

// blocking for every set, namespaced: B.hill.*, B.enoch.*, ...
export function blocking(plan) {
  const B = {};
  for (const [name, m] of Object.entries(CAMS)) B[name] = m.blocking ? m.blocking(plan, H) : {};
  return B;
}
export const blockingOf = (plan) => plan._B || (plan._B = blocking(plan));

export function cameraAt(plan, t) { return cameraShot(plan, shotAt(plan, t).shot, t); }

export function cameraShot(plan, shot, t) {
  const Ball = blockingOf(plan);
  const set = SHOT_SET[shot.id];
  let c = set ? CAMS[set].camera(plan, Ball[set], shot, t, H) : { pos: [0, 2, 10], look: [0, 1, 0], fov: 24 };
  let { pos, look } = c;
  const fov = c.fov ?? 24; let mblur = c.mblur ?? 0;
  // seeded handheld drift on everything (tiny) unless the shot asks for a locked-off camera
  if (!c.locked) pos = add(pos, [noise2(t * 0.33, 1.3, 11) * 0.05, noise2(t * 0.29, 7.7, 13) * 0.035, noise2(t * 0.27, 3.1, 17) * 0.05]);
  // whip pans: the outgoing shot whips away, the incoming one arrives from the other side
  const si = plan.shots.indexOf(shot), next = plan.shots[si + 1], lt = t - shot.t0;
  let whip = 0;
  if (next && next.trans === 'whip' && t > next.t0 - 0.2) whip = easeIn(invLerp(next.t0 - 0.2, next.t0, t));
  if (shot.trans === 'whip' && lt < 0.2) whip = -easeOut(1 - Math.max(0, lt) / 0.2);
  if (whip !== 0) {
    const yaw = whip * 0.65, dx = look[0] - pos[0], dz = look[2] - pos[2], cs = Math.cos(yaw), sn = Math.sin(yaw);
    look = [pos[0] + dx * cs - dz * sn, look[1], pos[2] + dx * sn + dz * cs];
    mblur = Math.max(mblur, 5);
  }
  const focus = c.focus ?? Math.hypot(look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]);
  return { ...c, pos, look, fov, focus, mblur, roll: c.roll || 0, shot: shot.id, lt, u: clamp(lt / (shot.t1 - shot.t0)) };
}

// project a named overlay anchor of a set to world coordinates
export function anchorAt(plan, set, name, t) {
  const m = CAMS[set]; const f = m.anchors && m.anchors[name];
  return f ? f(plan, blockingOf(plan)[set], t, H) : null;
}

// which shots are on screen at time t, and how they are joined (shared by the engine and the overlay)
export function layersAt(plan, t) {
  const { i, shot } = shotAt(plan, t);
  const prev = plan.shots[i - 1], next = plan.shots[i + 1];
  const Wd = (s) => (s.trans === 'whip' ? 0.2 : s.tdur || 0);
  let A = shot, Bs = null, k = 0, mode = null;
  if (next && next.trans !== 'cut' && Wd(next) > 0 && t >= next.t0 - Wd(next) / 2) { Bs = next; k = (t - (next.t0 - Wd(next) / 2)) / Wd(next); mode = next.trans; }
  else if (prev && shot.trans !== 'cut' && Wd(shot) > 0 && t < shot.t0 + Wd(shot) / 2) { A = prev; Bs = shot; k = (t - (shot.t0 - Wd(shot) / 2)) / Wd(shot); mode = shot.trans; }
  const in3d = (s) => !!SHOT_SET[s.id];
  const out = { shot, A, B: Bs, k: clamp(k), mode, a3d: in3d(A), b3d: Bs ? in3d(Bs) : false };
  if (Bs && mode === 'match') { out.A = t < Bs.t0 ? A : Bs; out.B = null; out.a3d = in3d(out.A); }
  return out;
}
