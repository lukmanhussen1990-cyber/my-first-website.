// Shots 12-21: the cloud reaches her, the smile freezes, the window, her head outside (in + out), the driver's eyes
// in the mirror, the hard brake, everyone runs off holding their noses, ME alone in the cloud, the bus drives away.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  ME, CRUSH, DRIVER, PAX, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat,
  BUS, busZ, busSpeed, STOP_Z, BRAKE_Z, SPEED_KEYS, zb, B, B2, camB, moveB, shadowB, busShake, cloud } from './shotlib.js';
import { ROW, ME_AT, WIN_AT, meSeat, crushSeat, crushFace, driverSeat, passengers, pinkSparkles } from './shots_a.js';

const H = (ctx) => ctx.W.cast.helpers;
const FACE_Y = 1.2;
const OUT_AT = [0.98, ROW - 0.34];            // where she stands to put her head out of the window
function everyone(ctx, o = {}) { const me = meSeat(ctx, o); driverSeat(ctx); const pax = passengers(ctx, o); return { me, pax }; }
// the crush standing at the window, leaning her head + shoulders out (k 0..1)
function crushOut(ctx, k, o = {}) {
  const c = CRUSH(ctx), p = show(c, B2(ctx, ...OUT_AT), Math.PI / 2, 0);     // faces the window (+X), bends forward out of it
  p.lean = 0.66 * k; p.headPitch = -0.45 * k; p.headYaw = 0.45 * k;
  p.handR = B(ctx, 1.17, lerp(1.0, 1.3, k), OUT_AT[1] + 0.24); p.handL = B(ctx, 1.17, lerp(1.0, 1.3, k), OUT_AT[1] - 0.24);
  p.handPoseL = p.handPoseR = 'grip'; p.windSide = -(o.wind ?? 1) * k; p.hairSway = 1;
  return c;
}
// the green smell cloud filling the bus (k 0..1)
function busCloud(ctx, k, around = [0.5, 1.0, 0.0]) {
  for (const [dz, r] of [[0, 0.75], [-1.4, 0.65], [1.3, 0.65], [-2.8, 0.55], [2.7, 0.55]]) {
    cloud(ctx, B(ctx, around[0] - 0.25, around[1] + 0.15, around[2] + dz), r * k, 0.75 * k, 10, 40 + dz * 3, 0.6);
  }
}
const noseHold = (ch) => { ch.p.handR = L(ch, -0.03, ch.spec.H * 0.86, 0.13); ch.p.handPoseR = 'fist'; ch.p.eyes = 'squeeze'; ch.p.mouth = 'grimace'; ch.p.brows = 'worried'; };

export const shots = {
  // 12. "...reaches her."  the green cloud reaches her face; her smile is still on.
  s12: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u);
    everyone(ctx); const c = crushSeat(ctx), p = c.p;
    p.lookAt = B(ctx, 0.6, FACE_Y, -0.25); crushFace(c, 'smileOpen');
    if (t > ctx.ev('her')) { p.headPitch = 0.06; p.eyes = 'open'; }
    cloud(ctx, B(ctx, lerp(0.72, 0.86, u), lerp(1.04, 1.16, u), lerp(-0.02, -0.08, u)), 0.24, 0.85, 9, 0, 0.8);
    moveB(ctx, { pos: [0.78, 1.25, -0.52], target: [0.92, 1.19, 0.06], fov: 37 }, { pos: [0.79, 1.25, -0.47], target: [0.92, 1.19, 0.06], fov: 37 });
    busShake(ctx, 0.4);
    shadowB(ctx, 0.9, 1.1, 0.0, 3);
  } },
  // 13. "Her smile stops."  close-up: the smile freezes, eyes go wide, a twitch; her face turns a little green.
  s13: { update(ctx) {
    const t = ctx.t, st = ctx.ev('stops');
    everyone(ctx); const c = crushSeat(ctx), p = c.p;
    p.lookAt = B(ctx, 0.75, FACE_Y + 0.02, -0.4); face(c, 'stare', 'raised', 'smileOpen'); p.blush = 0;
    if (t > st - 0.15) { face(c, 'stare', 'worried', 'smile'); p.green = smooth(clamp((t - st + 0.15) / 0.5)) * 0.75; }
    if (t > st + 0.25 && ((t * 9) % 1) > 0.8) p.eyes = 'squint';
    cloud(ctx, B(ctx, 0.84, 1.12, -0.08), 0.26, 0.7, 9, 0, 0.8);
    ctx.W.fx.sweat({ ch: c, t0: st + 0.2, size: 0.9, count: 1 });
    moveB(ctx, { pos: [0.86, 1.25, -0.45], target: [0.92, 1.2, 0.06], fov: 34 }, { pos: [0.865, 1.25, -0.41], target: [0.92, 1.2, 0.06], fov: 34 });
    punch(ctx, st, 1.08, 0.08);
    shadowB(ctx, 0.9, 1.1, 0.0, 3);
  } },
  // 14. "She opens the window."  she quickly slides the upper pane open.
  s14: { update(ctx) {
    const t = ctx.t, o0 = ctx.ev('opens') + 0.05, { me } = everyone(ctx);
    const c = crushSeat(ctx), p = c.p, k = easeOut(clamp((t - o0) / 0.3));
    face(c, 'stare', 'worried', 'grimace'); p.green = 0.75; p.blush = 0; p.lookAt = B(ctx, 1.8, 1.45, -0.6);
    p.handR = B(ctx, 1.16, 1.62, ROW - 0.5 + 0.62 * k); p.handPoseR = 'grip'; p.leanSide = 0.15;
    setState(ctx, { winOpen: k });
    face(me, 'open', 'worried', 'tight'); me.p.lookAt = v3(c.head.getWorldPosition(v3())).toArray();
    moveB(ctx, { pos: [1.95, 1.45, -0.85], target: [0.95, 1.3, -0.05], fov: 42 }, { pos: [1.92, 1.45, -0.78], target: [0.95, 1.3, -0.05], fov: 42 });
    cloud(ctx, B(ctx, 0.72, 1.05, 0.0), 0.3, 0.6, 9, 0, 0.8);
    hit(ctx, o0 + 0.25, 0.004, 0.15); busShake(ctx, 0.5);
    shadowB(ctx, 0.8, 1.2, 0.0, 4);
  } },
  // 15. "Then she puts her whole head outside."  from inside: she stands and pushes her head out of the window.
  s15: { update(ctx) {
    const t = ctx.t, k = easeInOut(clamp((t - ctx.ev('puts') + 0.15) / 0.45)), { me } = everyone(ctx);
    setState(ctx, { winOpen: 1 });
    const c = crushOut(ctx, k, { wind: 0.6 }); face(c, 'squeeze', 'worried', 'grimace'); c.p.green = 0.6;
    face(me, 'wide', 'raised', 'o'); me.p.lookAt = v3(c.head.getWorldPosition(v3())).toArray();
    moveB(ctx, { pos: [-0.18, 1.55, 0.32], target: [1.05, 1.28, -0.34], fov: 46 }, { pos: [-0.12, 1.53, 0.26], target: [1.05, 1.28, -0.34], fov: 46 });
    cloud(ctx, B(ctx, 0.6, 1.0, 0.1), 0.32, 0.6, 9, 0, 0.8);
    busShake(ctx, 0.6);
    shadowB(ctx, 0.7, 1.2, 0.0, 4);
  } },
  // 16. "...outside."  outside the moving bus: her head out of the window like a happy dog, hair blowing back.
  s16: { update(ctx) {
    const t = ctx.t;
    everyone(ctx); setState(ctx, { winOpen: 1 });
    const c = crushOut(ctx, 1, { wind: 1 }); face(c, 'happy', 'raised', 'tongue'); c.p.green = 0.2; c.p.blush = 1;
    c.p.headYaw = 0.45 + 0.1 * Math.sin(t * 5);
    moveB(ctx, { pos: [2.05, 1.42, -1.45], target: [1.42, 1.32, -0.36], fov: 40 }, { pos: [2.02, 1.42, -1.35], target: [1.42, 1.32, -0.36], fov: 40 });
    ctx.W.fx.speed({ amount: 0.45, count: 10 });
    busShake(ctx, 1.2);
    shadowB(ctx, 1.3, 1.2, -0.4, 4);
  } },
  // 17. "The driver looks in the mirror"  close: the driver's eyes in the big mirror, staring back.
  s17: { update(ctx) {
    const t = ctx.t, d = driverSeat(ctx), p = d.p, mr = ctx.ev('mirror');
    everyone(ctx); driverSeat(ctx);
    const dd = DRIVER(ctx); dd.p.lookAt = B(ctx, ...BUS.mirror.pos);
    face(dd, 'open', 'neutral', 'neutral');
    if (t > ctx.ev('looks')) face(dd, 'stare', 'raised', 'neutral');
    if (t > mr) face(dd, 'squint', 'angry', 'tight');
    moveB(ctx, { pos: BUS.mirror.cam, target: BUS.mirror.pos, fov: 22 }, { pos: [BUS.mirror.cam[0], BUS.mirror.cam[1], BUS.mirror.cam[2] - 0.08], target: BUS.mirror.pos, fov: 19 });
    punch(ctx, mr, 1.06, 0.1); busShake(ctx, 0.4);
    shadowB(ctx, -0.6, 1.4, -5.0, 3);
    void p;
  } },
  // 18. "...and stops the bus."  hard brake: everyone jerks forward.
  s18: { update(ctx) {
    const t = ctx.t, b0 = SPEED_KEYS.brake0, x = t - b0;
    const jerk = x < 0 ? 0 : x < 0.2 ? easeOut(x / 0.2) : Math.exp(-(x - 0.2) * 3.2) * Math.cos((x - 0.2) * 8);
    const { me } = everyone(ctx, { lean: 0.5 * jerk });
    me.p.lean = 0.06 + 0.55 * jerk; face(me, 'wide', 'worried', 'o');
    const c = crushOut(ctx, 1, { wind: 0.3 }); c.p.lean = 0.05 + 0.4 * jerk; face(c, 'wide', 'worried', 'o');
    setState(ctx, { crowdLean: 0.5 * jerk, winOpen: 1 });
    for (const k of [1, 5, 6, 9]) face(PAX(ctx, k), 'wide', 'raised', 'o');
    moveB(ctx, { pos: [0.02, 1.92, -4.25], target: [0.12, 1.0, 2.5], fov: 58 }, { pos: [0.02, 1.92, -4.15], target: [0.12, 1.0, 2.5], fov: 58 });
    hit(ctx, b0, 0.03, 0.3, 18); punch(ctx, b0, 1.08, 0.12);
    busCloud(ctx, 0.85);
    shadowB(ctx, 0.0, 1.0, 0.5, 8);
  } },
  // 19. "Everyone gets off."  everyone runs for the doors holding their noses (the crush too).
  s19: { update(ctx) {
    const t = ctx.t, u = clamp((t - ctx.shot.t0) / (ctx.shot.t1 - ctx.shot.t0));
    const me = meSeat(ctx); face(me, 'open', 'worried', 'tight'); me.p.lookAt = B(ctx, 0.0, 1.5, -3.0);
    driverSeat(ctx); setState(ctx, { crowd: 0, doorFront: 1, doorMid: 1, winOpen: 1 });
    const runners = [[CRUSH(ctx), [0.1, -0.5], [0.15, -4.8]], [PAX(ctx, 1), [0.12, -1.0], [0.4, -5.0]], [PAX(ctx, 7), [0.05, -1.6], [0.1, -5.6]],
      [PAX(ctx, 3), [0.0, -2.3], [0.9, -5.1]], [PAX(ctx, 9), [-0.1, 0.6], [1.6, 1.8]], [PAX(ctx, 5), [0.1, 1.25], [1.8, 1.7]],
      [PAX(ctx, 6), [0.0, 2.6], [1.7, 1.95]], [PAX(ctx, 2), [-0.05, 3.3], [0.6, 1.9]], [PAX(ctx, 4), [0.0, 4.2], [0.4, 2.4]], [PAX(ctx, 8), [1.0, 1.75], [2.4, 1.75]]];
    runners.forEach(([ch, a, b], i) => {
      show(ch, B2(ctx, ...a), 0, 0);
      H(ctx).go(ch, B2(ctx, ...a), B2(ctx, ...b), clamp(u * (0.62 + (i % 3) * 0.1)), 'run');
      noseHold(ch); ch.p.bounce = 0.3;
      if (ch === CRUSH(ctx)) { ch.p.green = 0.5; ch.p.hairSway = 1.5; }
    });
    moveB(ctx, { pos: [0.02, 1.75, 5.25], target: [0.1, 1.0, -2.0], fov: 56 }, { pos: [0.02, 1.72, 5.0], target: [0.1, 1.0, -2.0], fov: 56 });
    busCloud(ctx, 0.9);
    shadowB(ctx, 0.0, 1.0, 0.5, 8);
  } },
  // 20. "Except you."  ME sits alone in the empty bus, inside a big green cloud.
  s20: { update(ctx) {
    const t = ctx.t, me = meSeat(ctx), p = me.p;
    driverSeat(ctx); DRIVER(ctx).p.visible = false;
    setState(ctx, { crowd: 0, doorFront: 1, doorMid: 1, winOpen: 1 });
    face(me, 'open', 'neutral', 'tight'); p.pupils = [Math.sin(t * 2.2) > 0 ? 0.8 : -0.8, 0];
    if ((t - ctx.shot.t0) % 0.9 > 0.8) p.eyes = 'closed';
    if (t > ctx.ev('you')) face(me, 'open', 'sad', 'tight');
    cloud(ctx, B(ctx, 0.5, 1.0, 0.1), 0.85, 0.75, 14, 7, 0.6);
    ctx.W.fx.stink({ at: B(ctx, 0.55, 0.62, 0.16), amount: 0.6, spread: 0.3, height: 0.7, count: 3 });
    moveB(ctx, { pos: [0.02, 1.45, -1.55], target: [0.5, 1.02, 0.06], fov: 46 }, { pos: [0.05, 1.43, -1.35], target: [0.5, 1.04, 0.06], fov: 44 });
    shadowB(ctx, 0.4, 1.0, 0.0, 5);
  } },
  // 21. "Have a nice ride!"  outside: the bus drives off with only ME inside, green cloud puffing out of the windows.
  s21: { update(ctx) {
    const t = ctx.t, z0 = BRAKE_Z;
    const me = meSeat(ctx); face(me, 'open', 'sad', 'tight');
    driverSeat(ctx); setState(ctx, { crowd: 0, doorFront: 0, doorMid: 0, winOpen: 1 });
    // everyone on the sidewalk, holding their noses, watching it go
    const spots = [[CRUSH(ctx), 2.6, 3.0], [PAX(ctx, 1), 3.4, 2.2], [PAX(ctx, 2), 4.2, 3.4], [PAX(ctx, 3), 3.0, 4.4], [PAX(ctx, 4), 4.6, 1.6],
      [PAX(ctx, 5), 2.9, 1.0], [PAX(ctx, 6), 3.8, 0.4], [PAX(ctx, 7), 4.7, 4.6], [PAX(ctx, 8), 2.5, 5.4], [PAX(ctx, 9), 3.6, 5.6]];
    spots.forEach(([ch, x, dz], i) => {
      const pos = [x, z0 + dz], p = show(ch, pos, toward(pos, [0, z0 - 4]) + (i % 2 ? 0.2 : -0.2), BUS.curbY);
      noseHold(ch); if (i % 3 === 0) { p.handL = L(ch, 0.12, ch.spec.H * 0.6, 0.15); }
      if (ch === CRUSH(ctx)) { face(ch, 'squint', 'worried', 'grimace'); p.green = 0.3; }
    });
    for (const c of BUS.bays) for (const sx of [-1, 1]) {
      cloud(ctx, B(ctx, sx * 1.6, 1.75, c), 0.6, 0.9, 6, c * 7 + sx, 0.7);
    }
    cloud(ctx, B(ctx, 0.0, 2.9, 1.0), 1.2, 0.55, 10, 3, 0.5);
    move(ctx, { pos: [1.3, 1.65, z0 + 10.0], target: [0.9, 1.3, z0 - 1.0], fov: 50 }, { pos: [1.3, 1.95, z0 + 10.6], target: [0.6, 1.25, z0 - 4.0], fov: 50 });
    const fade = smooth(clamp((t - (ctx.shot.t1 - 0.5)) / 0.45));
    ctx.post.dim = fade;
    shadowAt(ctx, [1.5, 1.0, z0 + 2.0], 9);
  } },
};
