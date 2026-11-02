// Shots 23-30: the fun fact (cute brain + golden stopwatch "0.1 SEC"), both pairs of eyes go wide + the heart pops,
// then the first date in the fancy restaurant: steak with hands, she copies, the waiter faints.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, LADY, GUARD, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, STREET, VOID, RESTAURANT } from './shotlib.js';
import { BUSH, ATBUSH, youInBush, ladyAt, parked } from './shots_a.js';

const SY = STREET.sideY;
const LFACE = SY + 1.47;
const R = RESTAURANT;

function sitAt(ch, seat, rotY, seatY = R.seatY) {
  const p = show(ch, seat, rotY, 0); p.sit = 1; p.seatY = seatY; p.legs = 'chair'; p.feet = 0; return p;
}
// the couple at their table (shots 27-30)
function dinner(ctx, o = {}) {
  const C = ctx.W.cast;
  const you = C.youSuit, lady = C.lady;
  const yp = sitAt(you, R.youSeat.pos, R.youSeat.rotY), lp = sitAt(lady, R.ladySeat.pos, R.ladySeat.rotY);
  lp.glasses = 'up'; lp.hairSway = 0.2;
  face(you, 'happy', 'raised', 'smile'); face(lady, 'open', 'raised', 'smile');
  yp.lookAt = [R.ladySeat.pos[0], 1.22, R.ladySeat.pos[1]]; lp.lookAt = [R.youSeat.pos[0], 1.25, R.youSeat.pos[1]];
  yp.handL = L(you, 0.16, 0.8, 0.32); yp.handR = L(you, -0.16, 0.8, 0.32); yp.handPoseL = yp.handPoseR = 'relaxed';
  lp.handL = L(lady, 0.15, 0.8, 0.3); lp.handR = L(lady, -0.15, 0.8, 0.3);
  // pianist at the grand piano + two guests at a table in the back
  const pi = C.pianist, pp = sitAt(pi, [R.piano.pos[0] - 0.2, R.piano.pos[1] - 1.05], 0.25, 0.5);
  face(pi, 'happy', 'raised', 'smile');
  const tt = ctx.t * 6.5;
  pp.handL = L(pi, 0.18 + Math.sin(tt) * 0.06, 0.78 + Math.max(0, Math.sin(tt * 1.3)) * 0.03, 0.42); pp.handR = L(pi, -0.18 + Math.sin(tt + 1.7) * 0.06, 0.78 + Math.max(0, Math.sin(tt * 1.1 + 2)) * 0.03, 0.42);
  pp.handPoseL = pp.handPoseR = 'flat'; pp.headYaw = Math.sin(ctx.t * 1.6) * 0.12;
  const g1 = C.guestM1, g2 = C.guestW2;
  sitAt(g1, [596.4, 5.6], Math.PI / 2); sitAt(g2, [597.6, 5.6], -Math.PI / 2);
  face(g1, 'open', 'neutral', 'smile'); face(g2, 'happy', 'raised', 'smile');
  if (!o.noTalk) { ctx.W.cast.helpers.talk(g1, ctx.t * 0.7, 0.4); }
  return { you, lady };
}
// a steak held up to the mouth with both hands
function eatSteak(ctx, ch, steak, k, side = 1) {
  if (!steak) return;
  const p = ch.p, at = L(ch, 0, 1.12 + 0.05 * k, 0.24 - 0.08 * k);
  steak.position.set(...at); steak.rotation.set(0.25, p.rotY, 0, 'YXZ'); steak.visible = true; steak.updateMatrixWorld(true);
  const g = steak.userData.grips;
  if (g && g.L && g.R) { p.gripL = { prop: steak, which: 'L', pose: 'grip' }; p.gripR = { prop: steak, which: 'R', pose: 'grip' }; }
  else if (steak.userData.grip) { p.gripR = { prop: steak, pose: 'grip' }; p.handL = L(ch, 0.08, 1.08, 0.24); p.handPoseL = 'flat'; }
  else { p.handL = L(ch, 0.09, 1.1, 0.22); p.handR = L(ch, -0.09, 1.1, 0.22); p.handPoseL = p.handPoseR = 'grip'; }
}

export const shots = {
  // 23. "your brain decides if it likes someone's face"  a cute pink brain holding a golden stopwatch; ticking.
  s23: { update(ctx) {
    const t = ctx.t;
    setState(ctx, { voidShow: 'brain', brainBob: Math.sin(t * 4.2) * 0.02, brainBlink: (t % 1.7) > 1.62 ? 1 : 0 });
    move(ctx, { pos: [300, 1.62, -1.7], target: [300, 1.6, 0], fov: 40 }, { pos: [300, 1.62, -1.55], target: [300, 1.6, 0], fov: 40 });
    punch(ctx, ctx.ev('face'), 1.1, 0.1);
    for (let i = 0; i < 4; i++) ctx.W.fx.glint({ at: [300 + Math.cos(i * 1.6) * 0.45, 1.6 + Math.sin(i * 2.1) * 0.4, -0.2], size: 0.05, seed: i * 5 });
    shadowAt(ctx, [300, 1.6, 0], 2);
  } },
  // 24. "in about a tenth of a second."  the golden stopwatch stops; "0.1 SEC" pops up.
  s24: { update(ctx) {
    const t = ctx.t, te = ctx.ev('tenth');
    const run = clamp((t - ctx.shot.t0) / (te - ctx.shot.t0));
    setState(ctx, { voidShow: 'watch', watchHand: run * 0.1, watchPress: win(t, te - 0.05, te + 0.18, 0.04, 0.1) });
    move(ctx, { pos: [300, 1.62, -0.85], target: [300, 1.62, 0], fov: 40 }, { pos: [300, 1.62, -0.78], target: [300, 1.62, 0], fov: 40 });
    punch(ctx, te, 1.15, 0.08);
    if (t > te && t < te + 0.1) ctx.post.flash = 0.3 * (1 - (t - te) / 0.1);
    ctx.W.fx.badge({ text: '0.1 SEC', at: [300, 1.9, -0.25], t0: te, size: 0.33, roll: 0, depthTest: false });
    ctx.W.fx.glint({ at: [300.12, 1.78, -0.1], size: 0.08, t0: te });
    shadowAt(ctx, [300, 1.6, 0], 2);
  } },
  // 25. "She decided."  extreme close-up: her eyes go wide over the lowered sunglasses, cheeks pink, sparkle.
  s25: { update(ctx) {
    const t = ctx.t, d = ctx.ev('decided');
    parked(ctx, { limoDoor: 1, guardDoor: 1 });
    const lady = ladyAt(ctx, ATBUSH, 0), p = lady.p;
    p.glassesLow = 1; p.headPitch = -0.2; p.pupils = [0, -0.8];
    face(lady, t > d + 0.08 ? 'wide' : 'open', t > d + 0.08 ? 'raised' : 'neutral', 'neutral');
    p.blush = t > d + 0.08 ? 1 : 0; p.red = t > d + 0.08 ? 0.15 : 0;
    ctx.cam.set({ pos: [2.01, LFACE + 0.03, -2.66], target: [2.0, LFACE + 0.01, -3.15], fov: 30 });
    ctx.cam.handheld(0);
    punch(ctx, d + 0.08, 1.22, 0.07);
    if (t > d + 0.08) ctx.W.fx.speed({ amount: 1 - smooth((t - d - 0.08) / 0.5), count: 26 });
    pose(ctx);
    for (const sd of ['L', 'R']) ctx.W.fx.glint({ at: lady.head.localToWorld(lady.eyeLocal(sd).clone().add(v3(0, 0.004, 0.012))).toArray(), size: 0.018, t0: d + 0.12 });
    shadowAt(ctx, [2.0, 1.5, -3.1], 3);
  } },
  // 26. "So did you."  his eyes go wide too; a big pink heart pops between them, small hearts float.
  s26: { update(ctx) {
    const t = ctx.t, y = ctx.ev('you'), pop = ctx.ev('pop');
    parked(ctx, { limoDoor: 1, guardDoor: 1 });
    const you = youInBush(ctx), p = you.p;
    face(you, t > y + 0.04 ? 'wide' : 'open', 'raised', t > pop ? 'smile' : 'neutral'); p.headPitch = 0.28; p.pupils = [0, 0.8];
    p.blush = t > y + 0.04 ? 1 : 0.3;
    ctx.cam.set({ pos: [2.0, 1.35, -2.7], target: [2.0, 1.34, -2.2], fov: 30 });
    ctx.cam.handheld(0);
    punch(ctx, y + 0.04, 1.22, 0.07);
    if (t > y + 0.04) ctx.W.fx.speed({ amount: 1 - smooth((t - y - 0.04) / 0.45), count: 26 });
    if (t > pop) {
      const k = t - pop;
      ctx.W.fx.heartGlow({ at: [2.0, 1.22 + Math.min(0.06, k * 0.2), -2.5], size: 0.09 * easeOutBack(clamp(k / 0.25), 2.2), beat: 1.6, amount: 1, overlay: true });
      ctx.W.fx.hearts({ at: [2.0, 1.1, -2.45], t0: pop + 0.1, count: 8, every: 0.09, life: 1.4, rise: 0.25, spread: 0.18, size: 0.03, overlay: true });
    }
    shadowAt(ctx, [2.0, 1.2, -2.3], 3);
  } },
  // 27. "First date." "A fancy restaurant."  wide: chandeliers, gold, piano; the two of them at a candle-lit table.
  s27: { update(ctx) {
    dinner(ctx);
    move(ctx, { pos: [600, 2.35, -3.3], target: [600, 1.25, 3.2], fov: 50 }, { pos: [600, 2.2, -2.6], target: [600, 1.2, 3.0], fov: 48 });
    shadowAt(ctx, [600, 1.0, 2.5], 6);
    ctx.W.fx.hearts({ at: [600, 1.35, 2.0], t0: ctx.shot.t0 + 0.6, count: 5, every: 0.3, life: 1.6, rise: 0.35, spread: 0.15, size: 0.05, loop: 1.8 });
  } },
  // 28. "You eat steak with your hands."  close-up: he holds a huge steak with both hands and bites, very happy.
  s28: { update(ctx) {
    const t = ctx.t, st = ctx.ev('steak'), hn = ctx.ev('hands');
    const { you, lady } = dinner(ctx);
    const S = ctx.W.set.props.restaurant || {};
    const k = smooth(clamp((t - (st - 0.25)) / 0.35));
    eatSteak(ctx, you, S.steakYou, k);
    face(you, 'happy', 'raised', Math.sin(t * 14) > 0 ? 'chew' : 'smile');
    you.p.lookAt = null; you.p.headPitch = -0.05;
    move(ctx, { pos: [600.35, 1.24, 1.42], target: [599.3, 1.12, 2.0], fov: 42 }, { pos: [600.25, 1.22, 1.5], target: [599.3, 1.12, 2.0], fov: 40 });
    punch(ctx, hn, 1.12, 0.1);
    shadowAt(ctx, [599.3, 1.0, 2.0], 3);
  } },
  // 29. "She copies you."  close-up: she picks up her steak with both hands too, laughing; hearts.
  s29: { update(ctx) {
    const t = ctx.t, cp = ctx.ev('copies');
    const { you, lady } = dinner(ctx);
    const S = ctx.W.set.props.restaurant || {};
    const k = smooth(clamp((t - (cp - 0.3)) / 0.35));
    eatSteak(ctx, lady, S.steakLady, k);
    ctx.W.cast.helpers.laugh(lady, t, 0.7);
    lady.p.lookAt = null;
    move(ctx, { pos: [599.65, 1.24, 1.42], target: [600.72, 1.12, 2.0], fov: 42 }, { pos: [599.75, 1.22, 1.5], target: [600.72, 1.12, 2.0], fov: 40 });
    shadowAt(ctx, [600.7, 1.0, 2.0], 3);
    ctx.W.fx.hearts({ at: [600.6, 1.35, 1.9], t0: cp, count: 7, every: 0.12, life: 1.3, rise: 0.3, spread: 0.2, size: 0.04 });
  } },
  // 30. "The waiter faints."  he goes stiff and falls straight backwards, still holding up the tray; plates fly.
  s30: { update(ctx) {
    const t = ctx.t, f = ctx.ev('faints');
    dinner(ctx, { noTalk: true });
    const C = ctx.W.cast, w = C.waiter, S = ctx.W.set.props.restaurant || {};
    const wp = show(w, R.waiter.pos, R.waiter.rotY, 0);
    const k = clamp((t - (f + 0.1)) / 0.42), fall = easeIn(k) * 1.5;
    wp.fall = fall;
    face(w, t > f - 0.15 ? 'wide' : 'open', 'raised', t > f - 0.15 ? 'o' : 'neutral');
    if (k >= 1) face(w, 'dizzy', 'worried', 'open');
    wp.handR = L(w, -0.22, 1.62, 0.12); wp.handPoseR = 'flat';
    const tray = S.tray;
    pose(ctx);
    if (tray) {
      tray.visible = true;
      const hp = w.handPos('R');
      const fly = clamp((t - (f + 0.25)) / 0.8);
      tray.position.set(hp.x, hp.y + 0.04 + Math.sin(Math.PI * fly) * 0.5 * (fly > 0 ? 1 : 0), hp.z);
      tray.rotation.set(fly * 3.0, 0, fly * 1.4);
    }
    if (Array.isArray(S.flyers)) S.flyers.forEach((o, i) => {
      const s0 = f + 0.2 + i * 0.03, u = t - s0;
      if (u < 0) { o.visible = false; return; }
      o.visible = true;
      const vx = (i % 3 - 1) * 0.6, vy = 2.2 + (i % 2) * 0.6, vz = ((i * 7) % 5 - 2) * 0.25;
      const y0 = 1.65, y = Math.max(0.03, y0 + vy * u - 4.9 * u * u);
      o.position.set(R.waiter.pos[0] + vx * u, y, R.waiter.pos[1] + vz * u);
      o.rotation.set(u * (4 + i), u * 3, u * (2 + i % 3));
    });
    if (k >= 1) ctx.W.fx.stars({ at: w.headPos().toArray(), count: 5, radius: 0.12, size: 0.05, speed: 3 });
    move(ctx, { pos: [598.9, 1.55, 4.85], target: [601.2, 1.0, 3.25], fov: 46 }, { pos: [598.95, 1.5, 4.75], target: [601.2, 0.95, 3.25], fov: 46 });
    hit(ctx, f + 0.52, 0.03, 0.3);
    shadowAt(ctx, [601, 0.8, 3.0], 4);
  } },
};
