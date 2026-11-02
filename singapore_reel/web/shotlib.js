// Helpers shared by the Singapore shots. Everything is a pure function of ctx.t.
import * as THREE from 'three';
import { clamp, lerp, smooth, invLerp, easeOut, easeInOut, lerpCam, noise1, hash1, v3 } from './lib.js';
import { SPOTS, STREET } from './layout.js';

export { clamp, lerp, smooth, invLerp, easeOut, easeInOut, noise1, hash1, v3 };
export const C = STREET.curb;

// measured anchors (standing defaults)
export const P = {
  youHead: [-2, 1.735, 0.008], youEye: [-2, 1.739, 0.094], youChest: [-2, 1.408, 0.098],
  poop: [SPOTS.poop.pos[0], C, SPOTS.poop.pos[1]],
  offHead: [-1.063, 1.875, 0.937], offEye: [-1.125, 1.878, 0.876], offChest: [-1.134, 1.525, 0.867],
  manHead: [-0.208, 1.761, 4.586], ladyHead: [-4.593, 1.63, 3.592], kidHead: [-3.992, 1.22, -2.395],
};
// officer frame at his spot
const th = SPOTS.officer.rotY;
export const OFF = { pos: SPOTS.officer.pos, f: [Math.sin(th), 0, Math.cos(th)], r: [-Math.cos(th), 0, Math.sin(th)] }; // f = facing, r = his right

export function move(ctx, a, b, ease = smooth, u = ctx.u) { ctx.cam.set(lerpCam(a, b, ease(u))); }
export function punch(ctx, t0, k = 1.2, dur = 0.07) { if (ctx.t >= t0) ctx.cam.punch(1 + (k - 1) * easeOut((ctx.t - t0) / dur)); }
export function shake(ctx, t0, t1, amp, freq = 22) { const w = smooth(invLerp(t0, t0 + 0.05, ctx.t)) * (1 - smooth(invLerp(t1 - 0.1, t1, ctx.t))); if (w > 0) ctx.cam.shake(amp * w, freq); }
export const win = (t, a, b, fi = 0.1, fo = 0.1) => smooth(invLerp(a, a + fi, t)) * (1 - smooth(invLerp(b - fo, b, t)));
export function kf(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [t0, a] = keys[i - 1], [t1, b] = keys[i], u = ease((t - t0) / (t1 - t0));
    return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u);
  }
  return keys[keys.length - 1][1];
}
// world point from the officer's frame: right, up, forward offsets from his feet
export function offPt(r, y, f) { return [OFF.pos[0] + OFF.r[0] * r + OFF.f[0] * f, y, OFF.pos[1] + OFF.r[2] * r + OFF.f[2] * f]; }

// Place a prop so its local point `anchor` lands on `at`, local +Z along `axis`, local +Y toward `up`.
export function placeProp(prop, at, axis, up = [0, 1, 0], anchor = [0, 0, 0]) {
  const Z = v3(axis).normalize(), Uv = v3(up).normalize();
  let X = new THREE.Vector3().crossVectors(Uv, Z); if (X.lengthSq() < 1e-8) X.set(1, 0, 0); X.normalize();
  const Y = new THREE.Vector3().crossVectors(Z, X);
  prop.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));
  prop.position.copy(v3(at)).sub(v3(anchor).applyQuaternion(prop.quaternion));
  prop.visible = true;
  prop.updateMatrixWorld(true);
}
export function propPoint(prop, local) { prop.updateMatrixWorld(true); return v3(local).applyMatrix4(prop.matrixWorld); }
export function lookCam(ctx, ch, offset = [0, 0, 0]) { ch.p.lookAt = v3(ctx.cam.spec.pos).add(v3(offset)).toArray(); }
export function face(ch, eyes, brows, mouth) { ch.p.eyes = eyes; ch.p.brows = brows; ch.p.mouth = mouth; }

// green stink lines from the poop
export function stinkPoop(ctx, amount, o = {}) {
  ctx.W.fx.stink({ at: o.at || [P.poop[0], C + 0.08, P.poop[2]], amount, spread: o.spread ?? 0.16, gap: 0, height: o.height ?? 0.55, seed: o.seed ?? 3, t: ctx.t, burst: o.burst, thick: o.thick });
}
export function sweat(ctx, t0, side = 'L', o = {}) { if (ctx.t >= t0) ctx.W.fx.sweat({ ch: ctx.W.cast.you, side, t0, t: ctx.t, ...o }); }

// field of twinkling sparkle stars on the pavement around `center` (skips a disc around the poop when avoidPoop)
export function sparkles(ctx, center, radius, n, o = {}) {
  const t = ctx.t, per = o.period ?? 1.0, size = o.size ?? 1.2, y = o.y ?? C + 0.006;
  for (let i = 0; i < n; i++) {
    const a = hash1(i * 7.13 + 1) * 6.283, r = Math.sqrt(hash1(i * 3.71 + 2)) * radius;
    const x = center[0] + Math.cos(a) * r, z = center[2] + Math.sin(a) * r;
    if (o.avoidPoop && Math.hypot(x - P.poop[0], z - P.poop[2]) < (o.avoidR ?? 0.35)) continue;
    const ph = (t + hash1(i * 5.3) * per) % per;
    ctx.W.fx.glint({ at: [x, o.yFn ? o.yFn(i) : y, z], t0: t - ph, t, size: size * (0.6 + hash1(i * 2.2) * 0.7) });
  }
}
