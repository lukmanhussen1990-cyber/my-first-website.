// Helpers shared by the shot files. Everything is a pure function of ctx.t.
import * as THREE from 'three';
import { clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, lerpCam, noise1, hash1, v3 } from './lib.js';
import { YOU_SPOT, HIDE_TREE, HIDE_BUSH, BEAR_PATH } from './layout.js';

export { THREE, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3 };

// camera move from a to b over the shot (eased); a/b = {pos, target, fov}
export function move(ctx, a, b, ease = smooth, u = ctx.u) { ctx.cam.set(lerpCam(a, b, ease(clamp(u)))); }
// sudden zoom step at time t0 (k > 1 zooms in); quick snap over `dur`
export function punch(ctx, t0, k = 1.2, dur = 0.07) { if (ctx.t >= t0) ctx.cam.punch(1 + (k - 1) * easeOut((ctx.t - t0) / dur)); }
// short zoom bump that returns (on a beat): k peak
export function bump(ctx, t0, k = 1.06, dur = 0.22) { if (ctx.t >= t0 && ctx.t < t0 + dur) { const x = (ctx.t - t0) / dur; ctx.cam.punch(1 + (k - 1) * Math.sin(Math.PI * Math.pow(x, 0.6))); } }
// shake between t0 and t1 with soft edges
export function shake(ctx, t0, t1, amp, freq = 22) {
  const w = smooth(invLerp(t0, t0 + 0.06, ctx.t)) * (1 - smooth(invLerp(t1 - 0.12, t1, ctx.t)));
  if (w > 0) ctx.cam.shake(amp * w, freq);
}
// decaying hit shake at t0
export function hit(ctx, t0, amp, decay = 0.25, freq = 24) { if (ctx.t >= t0) { const k = Math.exp(-(ctx.t - t0) / decay); if (k > 0.02) ctx.cam.shake(amp * k, freq); } }
export const win = (t, a, b, fi = 0.1, fo = 0.1) => smooth(invLerp(a, a + fi, t)) * (1 - smooth(invLerp(b - fo, b, t)));

// ---------------------------------------------------------------- YOU
export const YX = YOU_SPOT.pos[0], YZ = YOU_SPOT.pos[1];
export function face(ctx, eyes, brows, mouth) { const p = ctx.W.cast.you.p; p.eyes = eyes; p.brows = brows; p.mouth = mouth; }
// YOU's eye height for a given crouch (approx.)
export const youEyeY = (crouch = 0) => 1.6 - crouch * 0.42;
// stink lines rising from behind the bush, around YOU's hips (seen from the front they rise beside his body)
export function stinkYou(ctx, amount, o = {}) {
  if (amount <= 0.001) return;
  ctx.W.fx.stink({ at: o.at || [YX + 0.05, 0.75, YZ - 0.05], amount, spread: o.spread ?? 0.42, height: o.height ?? 0.95,
    count: o.count ?? 5, seed: o.seed ?? 5, t: ctx.t, scale: o.scale ?? 1 });
}
export function lookCam(ctx, ch, off = [0, 0, 0]) { ch.p.lookAt = v3(ctx.cam.spec.pos).add(v3(off)).toArray(); }

// ---------------------------------------------------------------- BEAR
// walk the bear along a straight line a->b (x,z) over u (0..1); sets pos, rotY (facing the travel direction) and gait phase
export const STRIDES = { walk: 1.7, run: 3.2, biped_run: 2.6, idle: 1.7 };   // metres per gait cycle (animal_bear.js GAITS)
export const STRIDE = STRIDES.walk;
export function bearWalk(ctx, a, b, u, o = {}) {
  const bear = ctx.W.animals.bear, p = bear.p;
  const x = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
  p.pos = [x, z];
  p.rotY = Math.atan2(b[0] - a[0], b[1] - a[1]);
  p.gait = o.gait || 'walk';
  const st = o.stride ?? STRIDES[p.gait] ?? STRIDE;
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]) * u + (o.phase0 ?? 0) * st;
  p.phase = dist / st;
  return p;
}
export function bearFace(ctx, eyes, brows, mouth) { const p = ctx.W.animals.bear.p; p.eyes = eyes; p.brows = brows; p.mouth = mouth; }
export const BP = BEAR_PATH;
export const toward = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);   // rotY facing from -> to (x,z)

// set the sun's shadow box + soft frontal fill for this shot
export function light(ctx, center, radius = 8, fill = 0.35, fillDir = null) {
  const s = ctx.W.set.state;
  s.shadow = { center, radius };
  const cp = ctx.cam.spec.pos, tg = ctx.cam.spec.target;
  const d = fillDir || [cp[0] - tg[0], cp[1] - tg[1] + 0.6, cp[2] - tg[2]];
  s.fill = { dir: d, intensity: fill, color: '#ffe6d2' };
}
