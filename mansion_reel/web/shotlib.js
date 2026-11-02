// Helpers shared by the shot files. Everything is a pure function of ctx.t.
import * as THREE from 'three';
import { clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, lerpCam, noise1, hash1, v3 } from './lib.js';
import { STREET, MANSION, PORCH_SPOT, DOORWAY_SPOT, HALL, BATH, THRONE, YOUR_DOOR, MYBATH, MYTHRONE, ZOO, PENGUINS } from './layout.js';

export { THREE, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3 };
export { STREET, MANSION, PORCH_SPOT, DOORWAY_SPOT, HALL, BATH, THRONE, YOUR_DOOR, MYBATH, MYTHRONE, ZOO, PENGUINS };

export const FY = MANSION.floorY;
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
export const YOU = (ctx) => ctx.W.cast.you;
export const RICH = (ctx) => ctx.W.cast.rich;
export const YROBE = (ctx) => ctx.W.cast.youRobe;
export function face(ch, eyes, brows, mouth) { const p = ch.p; if (eyes) p.eyes = eyes; if (brows) p.brows = brows; if (mouth) p.mouth = mouth; }
export function show(ch, pos, rotY, y = 0) { const p = ch.p; p.visible = true; p.pos = pos.slice(); p.rotY = rotY; p.y = y; return p; }
// pose everything now (so positions can be read before the engine commits)
export function pose(ctx) { ctx.W.cast.commit(ctx); ctx.W.animals.commit(ctx); }
export function lookCam(ctx, ch, off = [0, 0, 0]) { ch.p.lookAt = v3(ctx.cam.spec.pos).add(v3(off)).toArray(); }
export const toward = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);
// blink helper (custom period)
export function blinkAt(ch, t, times) { for (const b of times) if (t >= b && t < b + 0.11) ch.p.eyes = 'closed'; }

// lighting: shadow box + soft frontal fill (+ interior key)
export function light(ctx, center, radius = 6, fill = 0.35, o = {}) {
  const s = ctx.W.set.state;
  s.shadow = { center, radius };
  const cp = ctx.cam.spec.pos, tg = ctx.cam.spec.target;
  const d = o.fillDir || [cp[0] - tg[0], cp[1] - tg[1] + 0.6, cp[2] - tg[2]];
  s.fill = { dir: d, intensity: fill, color: o.fillColor || '#ffe6d2' };
  if (o.key) s.key = o.key;
  if (o.exposure) s.exposure = o.exposure;
}
// YOU sitting on the golden toilet (seat height from the toilet group)
export function seatYOU(ctx, spin = 0) {
  const p = show(YOU(ctx), [THRONE.pos[0], THRONE.pos[1] - 0.02], THRONE.rotY + spin, FY + THRONE.platform);
  p.sit = 1; p.seatY = FY + THRONE.platform + 0.47; p.feet = FY + THRONE.platform; p.legs = 'chair';
  return p;
}
// world position of button i on the big panel
export function buttonPos(ctx, i) { const b = ctx.W.set.props.throne.buttons[i]; b.updateWorldMatrix(true, false); return new THREE.Vector3().setFromMatrixPosition(b.matrixWorld); }
// common room boxes
export const BATH_ROOM = { x0: BATH.x0, x1: BATH.x1, y0: BATH.floorY, y1: BATH.ceilY, z0: BATH.z0, z1: BATH.z1 };
export const DISCO_AT = () => [THRONE.pos[0], BATH.ceilY - 1.6, 188.6];
