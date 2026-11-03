// Helpers shared by the shot files. Everything is a pure function of ctx.t.
import * as THREE from 'three';
import { clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, lerpCam, noise1, hash1, v3 } from './lib.js';
import { HOUSE, VOID } from './layout.js';

export { THREE, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3 };
export { HOUSE, VOID };

// camera move a -> b over the shot (eased)
export function move(ctx, a, b, ease = smooth, u = ctx.u) { ctx.cam.set(lerpCam(a, b, ease(clamp(u)))); }
export function punch(ctx, t0, k = 1.2, dur = 0.07) { if (ctx.t >= t0) ctx.cam.punch(1 + (k - 1) * easeOut((ctx.t - t0) / dur)); }
export function bump(ctx, t0, k = 1.06, dur = 0.22) { if (ctx.t >= t0 && ctx.t < t0 + dur) { const x = (ctx.t - t0) / dur; ctx.cam.punch(1 + (k - 1) * Math.sin(Math.PI * Math.pow(x, 0.6))); } }
export function shake(ctx, t0, t1, amp, freq = 22) {
  const w = smooth(invLerp(t0, t0 + 0.06, ctx.t)) * (1 - smooth(invLerp(t1 - 0.12, t1, ctx.t)));
  if (w > 0) ctx.cam.shake(amp * w, freq);
}
export function hit(ctx, t0, amp, decay = 0.25, freq = 24) { if (ctx.t >= t0) { const k = Math.exp(-(ctx.t - t0) / decay); if (k > 0.02) ctx.cam.shake(amp * k, freq); } }
export const win = (t, a, b, fi = 0.1, fo = 0.1) => smooth(invLerp(a, a + fi, t)) * (1 - smooth(invLerp(b - fo, b, t)));
export const after = (t, t0, d = 0.25) => smooth(invLerp(t0, t0 + d, t));

// characters
export const C = (ctx) => ctx.W.cast;
export const YOU = (ctx) => ctx.W.cast.you;
export const MOM = (ctx) => ctx.W.cast.mom;
export const AUNTY = (ctx) => ctx.W.cast.aunty;
export const GRANDPA = (ctx) => ctx.W.cast.grandpa;
export const PROPS = (ctx) => ctx.W.cast.props;
export function face(ch, eyes, brows, mouth) { const p = ch.p; if (eyes) p.eyes = eyes; if (brows) p.brows = brows; if (mouth) p.mouth = mouth; }
export function show(ch, pos, rotY, y = 0) { const p = ch.p; p.visible = true; p.pos = pos.slice(); p.rotY = rotY; p.y = y; return p; }
// pose everything now (so positions can be read before the engine commits)
export function pose(ctx) { ctx.W.cast.commit(ctx); ctx.W.animals.commit(ctx); }
export function lookCam(ctx, ch, off = [0, 0, 0]) { ch.p.lookAt = v3(ctx.cam.spec.pos).add(v3(off)).toArray(); }
export const toward = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
export function blinkAt(ch, t, times) { for (const b of times) if (t >= b && t < b + 0.11) ch.p.eyes = 'closed'; }
// world point from a character's local frame (x = its left, z = forward), using p (no matrices)
export const L = (ch, lx, ly, lz) => { const p = ch.p, c = Math.cos(p.rotY), s = Math.sin(p.rotY); return [p.pos[0] + lx * c + lz * s, p.y + ly, p.pos[1] - lx * s + lz * c]; };

// set state helpers
export function shadowAt(ctx, center, radius = 6) { ctx.W.set.state.shadow = { center, radius }; }
export function setState(ctx, o) { Object.assign(ctx.W.set.state, o); }

// sit a character on a seat: root at the seat point [x, z] facing rotY, hips at seatY
export function seat(ctx, ch, at, rotY, seatY) { const p = show(ch, at, rotY, 0); p.sit = 1; p.seatY = seatY; return p; }
// YOU on the toilet, seen chest-up only (legs + hips hidden as in the bush shots of the last reel)
export function onToilet(ctx, ch) {
  const T = HOUSE.toilet, p = seat(ctx, ch, [T.pos[0] - 0.02, T.pos[1]], T.rotY, T.seatY + 0.03);
  p.inBush = true; p.lean = 0.08;
  p.handL = L(ch, 0.2, 0.62, 0.22); p.handR = L(ch, -0.2, 0.62, 0.22);
  return p;
}
// yell: motion arcs around the head + screen shake from t0 for dur
export function yell(ctx, ch, t0, dur = 0.8, amp = 0.012) {
  ctx.W.fx.rumble({ at: () => ch.head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.04, 0)), t0, dur, count: 7, radius: 0.2, size: 0.11, color: '#2a1a10' });
  shake(ctx, t0, t0 + dur, amp, 26);
}
