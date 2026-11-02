// Shots 1-11: the stink line, "it was a fart", the full bus, the crush gets on (slow motion), the empty seat,
// sweat, she sits down, her smile + pink sparkles, his shaky smile, the green cloud drifts to her.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  ME, CRUSH, DRIVER, PAX, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat,
  BUS, busZ, busSpeed, STOP_Z, BRAKE_Z, SPEED_KEYS, zb, B, B2, camB, moveB, shadowB, busShake, cloud } from './shotlib.js';

export const ROW = BUS.me.row;
export const ME_AT = [BUS.seatX.aisle, ROW + 0.05];
export const WIN_AT = [BUS.seatX.win, ROW + 0.05];
const H = (ctx) => ctx.W.cast.helpers;
const FACE_Y = 1.2;                                // seated head centre height (about)

// ---------------------------------------------------------------- people
export function meSeat(ctx, o = {}) {
  const me = ME(ctx), p = seat(ctx, me, B2(ctx, ...ME_AT), Math.PI, BUS.seatY);
  p.lean = o.lean ?? 0.06;
  p.handL = L(me, 0.13, 0.6, 0.36); p.handR = L(me, -0.13, 0.6, 0.36); p.handPoseL = p.handPoseR = 'relaxed';
  face(me, 'open', 'worried', 'tight');
  return me;
}
export function crushSeat(ctx) {
  const c = CRUSH(ctx), p = seat(ctx, c, B2(ctx, ...WIN_AT), Math.PI, BUS.seatY);
  p.handL = L(c, 0.1, 0.6, 0.34); p.handR = L(c, -0.1, 0.6, 0.34);
  crushFace(c); p.hairSway = 0.3;
  return c;
}
export function crushFace(c, mouth = 'smile') { face(c, 'puppy', 'raised', mouth); c.p.blush = 1; }
export function driverSeat(ctx, o = {}) {
  const d = DRIVER(ctx), [dx, dz] = BUS.driver.pos, p = seat(ctx, d, B2(ctx, dx, dz + 0.04), Math.PI, 0.55);
  p.handL = B(ctx, dx + 0.17, 1.12, dz - 0.4); p.handR = B(ctx, dx - 0.17, 1.12, dz - 0.4); p.handPoseL = p.handPoseR = 'grip';
  face(d, 'open', 'neutral', 'neutral'); p.lookAt = B(ctx, dx, 1.3, dz - 4);
  return d;
}
// the other passengers: 5 seated around ME, 4 standing (overhead rail / door pole); o.lean = brake jerk
export function passengers(ctx, o = {}) {
  const t = ctx.t, lean = o.lean || 0, out = {};
  const sitP = (k, x, z) => { const ch = PAX(ctx, k), p = seat(ctx, ch, B2(ctx, x, z + 0.06), Math.PI, BUS.seatY); p.handL = L(ch, 0.12, 0.6, 0.34); p.handR = L(ch, -0.12, 0.6, 0.34); p.lean = 0.02 + lean; face(ch, 'open', 'neutral', 'neutral'); out[k] = ch; return ch; };
  const standP = (k, x, z, rotY, railX) => {
    const ch = PAX(ctx, k), p = show(ch, B2(ctx, x, z), rotY, 0); p.lean = lean * 1.3; p.handR = B(ctx, railX, 1.92, z); p.handPoseR = 'grip';
    p.handL = L(ch, 0.15, 0.95, 0.12); face(ch, 'open', 'neutral', 'neutral'); out[k] = ch; return ch;
  };
  sitP(1, 0.5, -0.85); sitP(7, 0.93, -0.85); sitP(6, 0.93, 0.85); sitP(5, 0.5, 0.85); sitP(9, -0.5, 0.0);
  PAX(ctx, 7).p.headPitch = 0.25; PAX(ctx, 7).p.eyes = (t % 3) > 2.85 ? 'open' : 'closed';            // the old man dozes
  standP(3, 0.04, -1.7, Math.PI, -0.38); standP(2, 0.02, 1.15, Math.PI, 0.38); standP(4, -0.05, 2.5, Math.PI + 0.3, -0.38);
  standP(8, 0.8, 1.8, -Math.PI / 2, 1.0);
  const P = PROPS(ctx), p2 = out[2];
  P.phone.p = { ...P.phone.p, visible: true, pos: L(p2, 0.06, 1.18, 0.26), rot: [-0.6, p2.p.rotY + Math.PI, 0] };
  p2.p.gripL = { prop: P.phone, pose: 'grip' }; p2.p.lookAt = L(p2, 0.06, 1.18, 0.26);
  for (const k of [1, 2, 3, 4, 5, 6, 8, 9]) H(ctx).blink(out[k], t + k);
  return out;
}
function everyone(ctx, o = {}) { const me = meSeat(ctx, o); driverSeat(ctx); const pax = passengers(ctx, o); return { me, pax }; }
// pink + white sparkles around a point (her smile)
export function pinkSparkles(ctx, at, t0, n = 6, r = 0.16) {
  for (let i = 0; i < n; i++) {
    const a = i * 2.4 + 0.5, at2 = [at[0] + Math.cos(a) * r, at[1] + Math.sin(a * 1.3) * r * 0.8, at[2] - 0.04];
    ctx.W.fx.glint({ at: at2, size: 0.035 + (i % 3) * 0.01, t0: t0 + i * 0.06, color: i % 3 === 2 ? '#ffffff' : '#ff7ab4', glow: '#ffc4dc', overlay: true });
  }
}

export const shots = {
  // 1. "You pooped on the college bus."  ME sits on the crowded bus; a small green stink line rises.
  s01: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx), p = me.p;
    p.pupils = [Math.sin(t * 3.1) * 0.8, 0]; face(me, 'open', 'worried', 'tight');
    moveB(ctx, { pos: [0.12, 1.32, -1.2], target: [0.55, 1.02, 0.05], fov: 44 }, { pos: [0.15, 1.31, -1.02], target: [0.55, 1.04, 0.05], fov: 44 });
    lookCam(ctx, me); p.headYaw = 0.25 * Math.sin(t * 2.2);
    ctx.W.fx.stink({ at: B(ctx, 0.58, 0.62, 0.16), amount: 0.45 * after(t, ctx.ev('pooped') - 0.2, 0.4), spread: 0.18, height: 0.55, count: 1 });
    bump(ctx, ctx.ev('pooped'), 1.04, 0.25); busShake(ctx);
    shadowB(ctx, 0.4, 1.0, 0.0, 7);
  } },
  // 2. close on ME: he glances around; the stink line curls up past his face.
  s02: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx), p = me.p;
    face(me, 'open', 'worried', 'tight'); p.pupils = [Math.sign(Math.sin(t * 2.6)) * 0.9, 0];
    p.headYaw = 0.18 * Math.sign(Math.sin(t * 2.6)) * smooth(clamp((t - ctx.shot.t0) / 0.2));
    moveB(ctx, { pos: [0.34, 1.3, -0.56], target: [0.5, 1.2, 0.06], fov: 40 }, { pos: [0.35, 1.3, -0.5], target: [0.5, 1.2, 0.06], fov: 40 });
    ctx.W.fx.stink({ at: B(ctx, 0.66, 0.86, 0.06), amount: 0.6, spread: 0.15, height: 0.75, count: 1 });
    punch(ctx, ctx.ev('bus'), 1.06, 0.1); busShake(ctx, 0.6);
    shadowB(ctx, 0.5, 1.1, 0.0, 4);
  } },
  // 3. "But you thought it was a fart."  relaxed, smiling, hands behind his head, looking out at the trees.
  s03: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx), p = me.p;
    face(me, 'happy', 'raised', 'smile'); p.lean = -0.1;
    p.lookAt = B(ctx, 1.8, 1.32, -0.35);
    p.handL = L(me, 0.1, 1.3, -0.1); p.handR = L(me, -0.1, 1.3, -0.1); p.handPoseL = p.handPoseR = 'relaxed';
    if (t > ctx.ev('fart')) { p.eyes = 'happy'; p.headRoll = 0.08 * Math.sin((t - ctx.ev('fart')) * 6); }
    moveB(ctx, { pos: [0.98, 1.3, -0.52], target: [0.55, 1.15, 0.06], fov: 44 }, { pos: [0.96, 1.3, -0.46], target: [0.55, 1.15, 0.06], fov: 44 });
    ctx.W.fx.stink({ at: B(ctx, 0.56, 0.6, 0.16), amount: 0.3, spread: 0.12, height: 0.4, count: 1 });
    busShake(ctx, 0.6);
    shadowB(ctx, 0.6, 1.0, 0.0, 5);
  } },
  // 4. "The bus is full."  wide from the back: every seat taken, people standing, holding poles + straps.
  s04: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx);
    face(me, 'happy', 'neutral', 'smile'); me.p.lookAt = B(ctx, 1.8, 1.3, -0.6);
    moveB(ctx, { pos: [-0.12, 1.95, 5.3], target: [0.08, 1.05, -3.2], fov: 62 }, { pos: [-0.1, 1.92, 4.9], target: [0.08, 1.05, -3.2], fov: 62 });
    bump(ctx, ctx.ev('full'), 1.04, 0.25); busShake(ctx, 0.8);
    shadowB(ctx, 0.0, 1.0, 0.5, 8);
  } },
  // 5. "Then your crush gets on."  slow motion: she steps in through the front door; soft light + sparkles.
  s05: { update(ctx) {
    const t = ctx.t, t0 = ctx.shot.t0, u = clamp((t - t0) / (ctx.shot.t1 - t0));
    everyone(ctx);
    setState(ctx, { doorFront: 1 });
    const c = CRUSH(ctx), x = lerp(1.95, 0.92, smooth(u)), dz = BUS.driver.pos[1] - 0.1;
    const y = x > 1.5 ? BUS.curbY : x > 1.25 ? lerp(-0.17, BUS.curbY, (x - 1.25) / 0.25 > 1 ? 1 : 0) : lerp(0, -0.17, clamp((x - 1.05) / 0.2));
    const p = show(c, B2(ctx, x, -5.08), -Math.PI / 2 + 0.25, y);
    p.gait = { kind: 'walk', phase: (1.95 - x) / 0.9 * 0.9 };
    crushFace(c); p.hairSway = 1.2; p.lookAt = B(ctx, -0.1, 1.45, -3.6);
    p.handL = L(c, 0.16, 0.95, 0.06); p.handR = B(ctx, BUS.halfW - 0.22, 1.25, -4.55); p.handPoseR = 'grip';
    if (t > ctx.ev('crush')) p.mouth = 'smileOpen';
    const head = () => v3(c.head.getWorldPosition(v3()));
    ctx.W.fx.glow({ at: B(ctx, 1.7, 1.3, -5.1), size: 2.6, amount: 0.9, color: '#fff3d8' });
    for (let i = 0; i < 7; i++) ctx.W.fx.glint({ at: () => head().add(v3(Math.cos(i * 2.1) * 0.32, Math.sin(i * 1.7) * 0.35 - 0.05, -0.1)), size: 0.04, seed: i * 3, color: i % 2 ? '#ffffff' : '#ff9ac4', glow: '#ffd8e8' });
    ctx.post.tint = 0.12; ctx.post.tintColor = [1.0, 0.86, 0.9]; ctx.post.vignette = 0.25;
    moveB(ctx, { pos: [0.22, 1.42, -3.85], target: [1.25, 1.3, -5.12], fov: 36 }, { pos: [0.28, 1.42, -3.98], target: [1.2, 1.33, -5.12], fov: 33 });
    shadowB(ctx, 0.8, 1.0, -4.5, 5);
  } },
  // 6. "The only empty seat..."  slow zoom on the empty window seat next to ME.
  s06: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx);
    face(me, 'open', 'neutral', 'tight'); me.p.lookAt = B(ctx, 0.0, 1.6, -3.0);
    const u = smooth(clamp(ctx.u * 1.15));
    ctx.cam.set(camB(ctx, { pos: [lerp(1.0, 1.02, u), 1.55, lerp(-0.5, -0.45, u)], target: [0.85, 0.62, 0.04], fov: lerp(56, 30, u) }));
    ctx.W.fx.glow({ at: B(ctx, 0.93, 0.78, 0.0), size: 0.9, amount: 0.5 + 0.3 * Math.sin(t * 6), color: '#fff8d0' });
    ctx.W.fx.glint({ at: B(ctx, 1.02, 0.9, -0.05), size: 0.06, t0: ctx.ev('seat') - 0.05 });
    busShake(ctx, 0.5);
    shadowB(ctx, 0.8, 0.8, 0.0, 4);
  } },
  // 7. "...is next to you."  ME sweats.
  s07: { update(ctx) {
    const t = ctx.t, { me } = everyone(ctx), p = me.p;
    face(me, 'wide', 'worried', 'tight'); p.pupils = [-0.6, 0]; p.shoulderUp = 0.5;
    moveB(ctx, { pos: [0.33, 1.3, -0.5], target: [0.5, 1.21, 0.06], fov: 38 }, { pos: [0.34, 1.3, -0.45], target: [0.5, 1.22, 0.06], fov: 38 });
    ctx.W.fx.sweat({ ch: me, t0: ctx.shot.t0 + 0.1, size: 1.2 });
    ctx.W.fx.sweatBurst({ ch: me, t0: ctx.ev('next'), size: 1.0 });
    punch(ctx, ctx.ev('you'), 1.08, 0.1); busShake(ctx, 0.5);
    shadowB(ctx, 0.5, 1.1, 0.0, 3);
  } },
  // 8. "She sits down."  she slides into the window seat next to him.
  s08: { update(ctx) {
    const t = ctx.t, s0 = ctx.ev('sits') - 0.1, { me } = everyone(ctx);
    const c = CRUSH(ctx), u = smooth(clamp((t - s0) / 0.55));
    const pos = B2(ctx, lerp(0.14, WIN_AT[0], u), lerp(-0.45, WIN_AT[1], u));
    const p = show(c, pos, lerp(Math.PI / 2, Math.PI, u), 0); p.sit = u; p.seatY = BUS.seatY;
    crushFace(c); p.hairSway = 0.6; p.lookAt = B(ctx, 0.5, FACE_Y, 0.06);
    p.handL = L(c, 0.1, lerp(0.95, 0.6, u), lerp(0.1, 0.34, u)); p.handR = L(c, -0.1, lerp(0.95, 0.6, u), lerp(0.1, 0.34, u));
    face(me, 'wide', 'worried', 'tight'); me.p.lean = -0.12; me.p.lookAt = v3(c.head.getWorldPosition(v3())).toArray();
    moveB(ctx, { pos: [0.24, 1.36, -1.1], target: [0.72, 0.97, 0.0], fov: 46 }, { pos: [0.27, 1.34, -1.0], target: [0.72, 0.99, 0.0], fov: 46 });
    busShake(ctx, 0.6);
    shadowB(ctx, 0.7, 1.0, 0.0, 4);
  } },
  // 9. "She smiles at you."  close-up: big shiny eyes, blush, a sweet smile, pink sparkles pop.
  s09: { update(ctx) {
    const t = ctx.t, sm = ctx.ev('smiles');
    everyone(ctx); const c = crushSeat(ctx), p = c.p;
    p.lookAt = B(ctx, 0.6, FACE_Y + 0.02, -0.25); p.headRoll = -0.12;
    if (t > sm - 0.05) { crushFace(c, 'smileOpen'); p.talk = 0.0; }
    moveB(ctx, { pos: [0.72, 1.25, -0.55], target: [0.92, 1.19, 0.06], fov: 38 }, { pos: [0.73, 1.25, -0.5], target: [0.92, 1.19, 0.06], fov: 38 });
    pinkSparkles(ctx, B(ctx, 0.88, 1.24, -0.02), sm, 7, 0.17);
    for (let i = 0; i < 3; i++) ctx.W.fx.glint({ at: B(ctx, 0.88 + Math.cos(i * 2) * 0.22, 1.28 + Math.sin(i * 2.6) * 0.2, -0.05), size: 0.028, seed: i * 5, color: '#ff8ec0', glow: '#ffd0e4' });
    ctx.post.tint = 0.08; ctx.post.tintColor = [1.0, 0.85, 0.92];
    busShake(ctx, 0.4);
    shadowB(ctx, 0.9, 1.1, 0.0, 3);
  } },
  // 10. "You smile back."  a nervous, shaky smile. Sweat.
  s10: { update(ctx) {
    const t = ctx.t, sm = ctx.ev('smile'), { me } = everyone(ctx), p = me.p;
    crushSeat(ctx);
    face(me, 'open', 'worried', 'tight'); p.lookAt = B(ctx, 0.93, FACE_Y + 0.02, 0.06);
    if (t > sm - 0.1) { face(me, 'open', 'worried', 'grin'); p.headRoll = 0.035 * Math.sin(t * 47); p.headYaw = 0.02 * Math.sin(t * 39); p.red = 0.25; }
    moveB(ctx, { pos: [0.74, 1.28, -0.5], target: [0.5, 1.2, 0.06], fov: 38 }, { pos: [0.73, 1.28, -0.46], target: [0.5, 1.21, 0.06], fov: 38 });
    ctx.W.fx.sweat({ ch: me, t0: ctx.shot.t0 + 0.05, size: 1.1, count: 2 });
    busShake(ctx, 0.5);
    shadowB(ctx, 0.5, 1.1, 0.0, 3);
  } },
  // 11. "Then... the smell..."  two-shot: a green cloud slowly grows from his seat and drifts toward her.
  s11: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u), { me } = everyone(ctx); const c = crushSeat(ctx);
    face(me, 'open', 'worried', 'grin'); me.p.lookAt = B(ctx, 0.93, FACE_Y, 0.06);
    c.p.lookAt = B(ctx, 0.5, FACE_Y, 0.06); crushFace(c, 'smileOpen');
    const at = [lerp(0.52, 0.8, u), lerp(0.7, 1.0, u), lerp(0.14, 0.02, u)];
    cloud(ctx, B(ctx, ...at), lerp(0.16, 0.32, u), lerp(0.5, 0.9, u), 9, 0, 0.8);
    ctx.W.fx.stink({ at: B(ctx, 0.56, 0.62, 0.16), amount: 0.4, spread: 0.15, height: 0.45, count: 2 });
    moveB(ctx, { pos: [0.72, 1.86, -0.5], target: [0.72, 1.05, 0.08], fov: 54 }, { pos: [0.72, 1.84, -0.46], target: [0.72, 1.06, 0.08], fov: 52 });
    busShake(ctx, 0.5);
    shadowB(ctx, 0.7, 1.0, 0.0, 4);
  } },
};
