// Helpers shared by the shot files. Everything is a pure function of ctx.t.
import * as THREE from 'three';
import { clamp, lerp, smooth, invLerp, easeOut, easeInOut, lerpCam, noise1, v3 } from './lib.js';

export { clamp, lerp, smooth, invLerp, easeOut, easeInOut, noise1, v3 };

// measured anchor points (seated / standing defaults)
export const P = {
  youHead: [0, 1.196, -0.825], youEye: [0, 1.2, -0.738], youMouth: [0, 1.146, -0.742], youBelly: [0, 0.684, -0.729],
  youSeat: [0, 0.47, -0.88], youPlate: [0, 0.771, -0.33], youShoulderR: [-0.18, 1.0, -0.838],
  uncleHead: [0, 1.243, 0.87], uncleEye: [0, 1.247, 0.783],
  gmaHead: [-0.403, 1.453, -0.718], gmaEye: [-0.332, 1.447, -0.667], gmaGlass: [-0.306, 1.454, -0.686],
};

// camera move from a to b over the shot (eased); a/b = {pos, target, fov}
export function move(ctx, a, b, ease = smooth, u = ctx.u) { ctx.cam.set(lerpCam(a, b, ease(u))); }
// sudden zoom step at time t0 (k > 1 zooms in); quick 3-frame snap
export function punch(ctx, t0, k = 1.2, dur = 0.07) { if (ctx.t >= t0) ctx.cam.punch(1 + (k - 1) * easeOut((ctx.t - t0) / dur)); }
// shake between t0 and t1 with soft edges
export function shake(ctx, t0, t1, amp, freq = 22) { const w = smooth(invLerp(t0, t0 + 0.06, ctx.t)) * (1 - smooth(invLerp(t1 - 0.12, t1, ctx.t))); if (w > 0) ctx.cam.shake(amp * w, freq); }
export const camPos = (ctx) => ctx.cam.spec.pos;

// window helper 0..1..0
export const win = (t, a, b, fi = 0.1, fo = 0.1) => smooth(invLerp(a, a + fi, t)) * (1 - smooth(invLerp(b - fo, b, t)));

// Place a prop so its local point `anchor` lands on world point `at`, local +Z along `axis`, local +Y toward `up`.
export function placeProp(prop, at, axis, up = [0, 1, 0], anchor = [0, 0, 0]) {
  const Z = v3(axis).normalize(), Uv = v3(up).normalize();
  let X = new THREE.Vector3().crossVectors(Uv, Z); if (X.lengthSq() < 1e-8) X.set(1, 0, 0); X.normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X);
  prop.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  prop.position.copy(v3(at)).sub(v3(anchor).applyQuaternion(prop.quaternion));
  prop.updateMatrixWorld(true);
}
// world position of a prop-local point
export function propPoint(prop, local) { prop.updateMatrixWorld(true); return v3(local).applyMatrix4(prop.matrixWorld); }

// stink behind / around YOU's seat (lines fan out beside his body from the camera's view)
export function stinkYou(ctx, amount, o = {}) {
  ctx.W.fx.stink({ at: o.at || [0, 0.62, -0.92], amount, spread: o.spread ?? 0.36, gap: o.gap ?? 0.34, height: o.height ?? 0.85, seed: o.seed ?? 5, t: ctx.t, burst: o.burst });
}
export function sweatYou(ctx, t0, side = 'L', o = {}) { if (ctx.t >= t0) ctx.W.fx.sweat({ ch: ctx.W.cast.you, side, t0, t: ctx.t, ...o }); }

// YOU's face presets
export function youFace(ctx, eyes = 'wide', brows = 'worried', mouth = 'tight') { const p = ctx.W.cast.you.p; p.eyes = eyes; p.brows = brows; p.mouth = mouth; }
export function lookCam(ctx, ch, offset = [0, 0, 0]) { const c = v3(ctx.cam.spec.pos).add(v3(offset)); ch.p.lookAt = c.toArray(); }
