// Shots 22-42: one hour (sweat), numb legs, Grandpa walks past (whistling, then Zzz), two hours, Aunty's question, the
// door with no lock, the handle turns, the door opens, face to face, "Aunty... can you pass the tissue?", what you don't
// know: the will, crossed out in red.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, MOM, AUNTY, GRANDPA, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, onToilet, yell, HOUSE } from './shotlib.js';
import { D, FD, K, R, H, GOLD, SOFA, youSit, momAt, auntyAt, sofaPair } from './shots_a.js';

const TBL = HOUSE.table.pos;
const WILL_AT = [TBL[0] - 0.45, HOUSE.table.h + 0.002, TBL[1] + 0.12];
function grandpaWalk(ctx, u) {
  const g = GRANDPA(ctx), P = PROPS(ctx), a = [3.42, -0.9], b = [3.42, 2.7];
  show(g, a, 0, 0); H(ctx).go(g, a, b, u, 'walk', 0.55); g.p.lean = 0.12;
  P.cane.p = { ...P.cane.p, visible: true, pos: L(g, -0.24, 0.9, 0.2), rot: [0, g.p.rotY, 0] };
  g.p.gripR = { prop: P.cane, pose: 'grip' };
  face(g, 'open', 'neutral', 'o');
  return g;
}
function auntyInDoor(ctx) {
  const a = auntyAt(ctx, [3.62, 1.05], Math.PI / 2); setState(ctx, { doorOpen: 0.75, bathLight: 1.2 });
  a.p.handR = [3.98, 1.0, 1.22]; a.p.handPoseR = 'grip';
  return a;
}
function auntyWill(ctx) {
  const a = AUNTY(ctx), P = PROPS(ctx), p = seat(ctx, a, [TBL[0] - 0.45, TBL[1] + 0.72], Math.PI, 0.48);
  face(a, 'squint', 'angry', 'tight'); p.lean = 0.18; p.lookAt = [WILL_AT[0], WILL_AT[1], WILL_AT[2]];
  P.will.p = { ...P.will.p, visible: true, pos: WILL_AT.slice(), rot: [0, 0, 0] };
  p.handL = L(a, 0.18, 0.78, 0.38); p.handPoseL = 'flat';
  return a;
}

export const shots = {
  // 22. "One hour."  tired, sweating, still on the toilet.
  s22: { update(ctx) {
    const t = ctx.t, you = youSit(ctx, 'tense'); face(you, 'squint', 'sad', 'frown'); you.p.headPitch = -0.08; you.p.lean = 0.15;
    move(ctx, { pos: [5.4, 1.28, 0.95], target: [6.18, 1.22, 0.9], fov: 42 }, { pos: [5.5, 1.28, 0.94], target: [6.18, 1.22, 0.9], fov: 40 });
    ctx.W.fx.sweat({ ch: you, t0: ctx.shot.t0 + 0.1, size: 1.1, count: 2 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 23. "Your legs go numb."  his feet shake; pins-and-needles stars.
  s23: { update(ctx) {
    const t = ctx.t, you = YOU(ctx), T = HOUSE.toilet, p = seat(ctx, you, [T.pos[0] - 0.02, T.pos[1]], T.rotY, T.seatY + 0.03);
    face(you, 'squint', 'worried', 'grimace'); p.handL = L(you, 0.2, 0.62, 0.22); p.handR = L(you, -0.2, 0.62, 0.22);
    p.pos = [p.pos[0] + 0.006 * Math.sin(t * 61), p.pos[1] + 0.006 * Math.sin(t * 53)];
    move(ctx, { pos: [4.7, 0.5, 1.15], target: [5.72, 0.22, 0.9], fov: 48 }, { pos: [4.78, 0.48, 1.12], target: [5.72, 0.22, 0.9], fov: 46 });
    ctx.W.fx.stars({ at: [5.72, 0.28, 0.9], count: 8, radius: 0.22, size: 0.035, speed: 2 });
    shake(ctx, ctx.ev('numb') - 0.1, ctx.shot.t1, 0.003, 30);
    shadowAt(ctx, [5.8, 0.3, 0.9], 2);
  } },
  // 24. "Grandpa walks past the door."  with his cane, whistling, eyes front.
  s24: { update(ctx) {
    const u = clamp(ctx.u), g = grandpaWalk(ctx, lerp(0.05, 0.62, u));
    g.p.headYaw = -0.35;
    ctx.W.fx.notes({ at: () => v3(g.head.getWorldPosition(v3())).add(v3(0.0, 0.22, 0.1)), count: 3, amount: 0.9 });
    move(ctx, { pos: [1.7, 1.42, 0.9], target: [4.0, 1.2, 0.95], fov: 46 }, { pos: [1.8, 1.42, 0.9], target: [4.0, 1.2, 0.95], fov: 46 });
    shadowAt(ctx, [3.5, 1.0, 0.9], 3);
  } },
  // 25. "He pretends he didn't hear."  close: he looks away... then fake-sleeps while walking: Zzz.
  s25: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u), g = grandpaWalk(ctx, lerp(0.55, 0.85, u)), hr = ctx.ev('hear');
    g.p.headYaw = -0.8; face(g, 'open', 'raised', 'o');
    if (t > hr - 0.2) { face(g, 'closed', 'neutral', 'o'); g.p.headPitch = 0.1;
      ctx.W.fx.badge({ text: 'Zzz', at: () => v3(g.head.getWorldPosition(v3())).add(v3(-0.12, 0.24, 0.0)), t0: hr - 0.15, size: 0.09, roll: 0.1 }); }
    else ctx.W.fx.notes({ at: () => v3(g.head.getWorldPosition(v3())).add(v3(0.0, 0.2, 0.1)), count: 2, amount: 0.8 });
    const hp = () => g.head.getWorldPosition(v3());
    void hp;
    const gz = g.p.pos[1]; ctx.cam.set({ pos: [2.45, 1.58, gz + 0.95], target: [3.42, 1.42, gz], fov: 40 });
    shadowAt(ctx, [3.4, 1.2, 1.6], 2.5);
  } },
  // 26. "Two hours."  the clock spins fast.
  s26: { update(ctx) {
    const t = ctx.t;
    setState(ctx, { clockMin: (t - ctx.shot.t0) * 14 });
    move(ctx, { pos: [3.0, 2.12, 3.2], target: [3.0, 2.15, 3.8], fov: 40 }, { pos: [3.0, 2.12, 3.32], target: [3.0, 2.15, 3.8], fov: 38 });
    ctx.W.fx.speed({ amount: 0.35, count: 8 });
    shadowAt(ctx, [3.0, 2.0, 3.6], 2);
  } },
  // 27. "Aunty asks one question."  wide: Aunty on the sofa holding her tea, Mom next to her.
  s27: { update(ctx) {
    const t = ctx.t, { a, m } = sofaPair(ctx); face(m, 'open', 'raised', 'smile'); m.p.lookAt = v3(a.head.getWorldPosition(v3())).toArray();
    H(ctx).talk(a, t, 0.6);
    move(ctx, { pos: [1.3, 1.5, 0.6], target: [-0.3, 1.0, 3.2], fov: 46 }, { pos: [1.15, 1.48, 0.8], target: [-0.3, 1.0, 3.2], fov: 46 });
    for (let i = 0; i < 3; i++) GOLD(ctx, () => v3(a.head.getWorldPosition(v3())).add(v3(0.15 * Math.cos(i * 2), -0.25, 0.1)), ctx.shot.t0 + 0.2 + i * 0.25, i, 0.035);
    shadowAt(ctx, [-0.3, 1.0, 3.2], 3);
  } },
  // 28. "...one question."  close: she puts her teacup down.
  s28: { update(ctx) {
    const t = ctx.t, { a } = sofaPair(ctx), P = PROPS(ctx), k = easeInOut(clamp((t - ctx.shot.t0) / 0.6));
    const [cfx, cfz] = HOUSE.coffee.pos;
    P.cup.p = { ...P.cup.p, pos: [lerp(L(a, -0.1, 0.78, 0.3)[0], cfx + 0.05, k), lerp(0.78, 0.46, k), lerp(L(a, -0.1, 0.78, 0.3)[2], cfz + 0.1, k)] };
    face(a, 'open', 'neutral', 'tight');
    move(ctx, { pos: [0.4, 1.15, 1.5], target: [0.05, 0.75, 2.4], fov: 40 }, { pos: [0.38, 1.12, 1.6], target: [0.05, 0.72, 2.4], fov: 40 });
    shadowAt(ctx, [0.0, 0.8, 2.6], 2.5);
  } },
  // 29. "Where is the toilet?"  close-up Aunty (loud).
  s29: { update(ctx) {
    const t = ctx.t, { a, m } = sofaPair(ctx); PROPS(ctx).cup.p.visible = false;
    a.p.gripR = null; a.p.handR = L(a, -0.18, 1.0, 0.3); a.p.handPoseR = 'open';
    face(a, 'open', 'raised', 'neutral'); H(ctx).talk(a, t, 1.2);
    face(m, 'wide', 'worried', 'o');
    move(ctx, { pos: [0.12, 1.28, 2.62], target: [0.12, 1.24, 3.32], fov: 38 }, { pos: [0.12, 1.28, 2.68], target: [0.12, 1.24, 3.32], fov: 36 });
    lookCam(ctx, a);
    for (let i = 0; i < 4; i++) GOLD(ctx, () => v3(a.head.getWorldPosition(v3())).add(v3(0.14 * Math.cos(i * 1.7), 0.1 * Math.sin(i * 2.3), 0.05)), ctx.shot.t0 + i * 0.2, i, 0.035);
    punch(ctx, ctx.ev('toilet'), 1.06, 0.1);
    shadowAt(ctx, [0.1, 1.1, 3.2], 2);
  } },
  // 30. "The door has no lock."  the bathroom door handle: no lock, just an empty hole.
  s30: { update(ctx) {
    move(ctx, { pos: [3.62, 1.02, 1.0], target: [4.0, 0.95, 1.23], fov: 30 }, { pos: [3.66, 1.0, 1.04], target: [4.0, 0.93, 1.23], fov: 26 });
    shadowAt(ctx, [3.9, 1.0, 1.1], 2);
  } },
  // 31. YOU sweats: one big sweat drop.
  s31: { update(ctx) {
    const you = youSit(ctx, 'tense'); face(you, 'wide', 'worried', 'tight'); you.p.shoulderUp = 0.6;
    move(ctx, { pos: [5.58, 1.3, 0.92], target: [6.18, 1.26, 0.9], fov: 38 }, { pos: [5.62, 1.3, 0.92], target: [6.18, 1.26, 0.9], fov: 38 });
    ctx.W.fx.sweatBurst({ ch: you, t0: ctx.shot.t0 + 0.05, size: 1.3 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 32. "The handle turns."  inside: the handle turns.
  s32: { update(ctx) {
    const t = ctx.t, k = smooth(clamp((t - ctx.ev('turns') + 0.45) / 0.8));
    setState(ctx, { handleTurn: k });
    move(ctx, { pos: [4.5, 1.05, 0.92], target: [4.1, 1.0, 1.22], fov: 32 }, { pos: [4.45, 1.04, 0.95], target: [4.1, 1.0, 1.22], fov: 28 });
    shadowAt(ctx, [4.2, 1.0, 1.1], 2);
  } },
  // 33. "Slowly."  dramatic zoom: the door opens a crack, light comes in.
  s33: { update(ctx) {
    const t = ctx.t, k = smooth(clamp((t - ctx.shot.t0 - 0.1) / 1.0));
    setState(ctx, { handleTurn: 1, doorOpen: 0.16 * k, bathLight: 0.8 });
    ctx.W.fx.glow({ at: [3.9, 1.2, 1.25], size: 1.2 * k, amount: k, color: '#fff2c8' });
    const you = youSit(ctx, 'tense'); face(you, 'wide', 'worried', 'o');
    move(ctx, { pos: [5.95, 1.32, 0.7], target: [4.0, 1.15, 1.1], fov: 52 }, { pos: [5.8, 1.3, 0.75], target: [4.0, 1.15, 1.1], fov: 36 });
    shadowAt(ctx, [4.6, 1.0, 1.0], 3);
  } },
  // 34. "She looks at you."  Aunty in the doorway, frozen; her sunglasses slide down.
  s34: { update(ctx) {
    const t = ctx.t, a = auntyInDoor(ctx); face(a, 'stare', 'raised', 'o');
    a.p.glassesLow = 0.4 * smooth(clamp((t - ctx.ev('looks')) / 0.5));
    move(ctx, { pos: [5.35, 1.48, 0.98], target: [3.62, 1.5, 1.05], fov: 34 }, { pos: [5.25, 1.48, 0.99], target: [3.62, 1.5, 1.05], fov: 32 });
    lookCam(ctx, a);
    youSit(ctx, 'tense');
    shadowAt(ctx, [3.9, 1.2, 1.0], 3);
  } },
  // 35. "You look at her."  YOU, frozen, eyes wide.
  s35: { update(ctx) {
    const you = youSit(ctx, 'tense'); face(you, 'stare', 'raised', 'tight'); you.p.red = 0.45;
    auntyInDoor(ctx);
    move(ctx, { pos: [5.5, 1.3, 0.94], target: [6.18, 1.28, 0.9], fov: 36 }, { pos: [5.55, 1.3, 0.93], target: [6.18, 1.28, 0.9], fov: 34 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 36. "Aunty..."  he holds out his hand with a shy little smile.
  s36: { update(ctx) {
    const t = ctx.t, you = youSit(ctx, 'tense'), p = you.p, k = easeOut(clamp((t - ctx.shot.t0 - 0.1) / 0.4));
    face(you, 'happy', 'worried', 'smile'); p.red = 0.5; p.blush = 1; p.headRoll = 0.12;
    p.handR = L(you, -0.12, lerp(0.7, 1.08, k), lerp(0.25, 0.55, k)); p.handPoseR = 'open';
    auntyInDoor(ctx);
    move(ctx, { pos: [4.95, 1.3, 1.3], target: [5.9, 1.12, 0.9], fov: 50 }, { pos: [5.0, 1.3, 1.28], target: [5.9, 1.12, 0.9], fov: 48 });
    shadowAt(ctx, [5.9, 1.0, 0.9], 2.5);
  } },
  // 37. "...can you pass the tissue?"  Aunty's jaw drops; sweat.
  s37: { update(ctx) {
    const t = ctx.t, a = auntyInDoor(ctx); face(a, 'stare', 'raised', 'scream'); a.p.glassesLow = 0.4; a.p.green = 0;
    a.p.handL = L(a, 0.15, 1.3, 0.1); a.p.handPoseL = 'flat';
    move(ctx, { pos: [4.55, 1.5, 1.0], target: [3.62, 1.5, 1.05], fov: 36 }, { pos: [4.5, 1.5, 1.0], target: [3.62, 1.5, 1.05], fov: 34 });
    lookCam(ctx, a);
    ctx.W.fx.sweat({ ch: a, t0: ctx.shot.t0 + 0.2, size: 1.0 });
    punch(ctx, ctx.ev('tissue'), 1.08, 0.1);
    shadowAt(ctx, [3.7, 1.3, 1.0], 2.5);
  } },
  // 38. "What you don't know..."  the quiet living room, slow zoom toward the dining table.
  s38: { update(ctx) {
    auntyWill(ctx);
    move(ctx, { pos: [3.0, 1.62, -2.6], target: [-2.6, 1.0, 0.8], fov: 50 }, { pos: [2.2, 1.55, -2.1], target: [-2.6, 1.0, 0.8], fov: 44 });
    shadowAt(ctx, [-1.5, 1.0, 0.5], 5);
  } },
  // 39. "Aunty was writing her will today."  Aunty at the dining table, writing.
  s39: { update(ctx) {
    const t = ctx.t, a = auntyWill(ctx), P = PROPS(ctx);
    const pw = [WILL_AT[0] - 0.03 + 0.04 * Math.sin(t * 9), WILL_AT[1] + 0.02, WILL_AT[2] - 0.02 + 0.01 * Math.sin(t * 5)];
    P.pen.p = { ...P.pen.p, visible: true, pos: pw, rot: [0.6, 0.4, 0] }; a.p.gripR = { prop: P.pen, pose: 'grip' };
    move(ctx, { pos: [-2.9, 1.48, -0.55], target: [-2.9, 0.98, 0.95], fov: 42 }, { pos: [-2.9, 1.46, -0.42], target: [-2.9, 0.98, 0.95], fov: 42 });
    lookCam(ctx, a); a.p.lookAt = [WILL_AT[0], WILL_AT[1], WILL_AT[2]];
    shadowAt(ctx, [-2.9, 0.9, 0.8], 2.5);
  } },
  // 40. "...today."  close-up of the paper: MY WILL.
  s40: { update(ctx) {
    const a = auntyWill(ctx), P = PROPS(ctx);
    P.pen.p = { ...P.pen.p, visible: true, pos: [WILL_AT[0] + 0.12, WILL_AT[1] + 0.02, WILL_AT[2] + 0.06], rot: [0.5, 0.3, 0] }; a.p.gripR = { prop: P.pen, pose: 'grip' };
    move(ctx, { pos: [WILL_AT[0], 1.12, WILL_AT[2] + 0.34], target: [WILL_AT[0], WILL_AT[1], WILL_AT[2] - 0.02], fov: 40 }, { pos: [WILL_AT[0], 1.08, WILL_AT[2] + 0.3], target: [WILL_AT[0], WILL_AT[1], WILL_AT[2] - 0.02], fov: 38 });
    shadowAt(ctx, [WILL_AT[0], 0.8, WILL_AT[2]], 1.5);
  } },
  // 41. "Your name was in it."  the pen points at the last line: YOU.
  s41: { update(ctx) {
    const t = ctx.t, a = auntyWill(ctx), P = PROPS(ctx), lz = WILL_AT[2] + 0.077;
    P.pen.p = { ...P.pen.p, visible: true, pos: [WILL_AT[0] + 0.035, WILL_AT[1] + 0.012 + 0.006 * Math.abs(Math.sin(t * 6)), lz + 0.01], rot: [0.55, 0.3, 0] }; a.p.gripR = { prop: P.pen, pose: 'grip' };
    move(ctx, { pos: [WILL_AT[0], 0.98, lz + 0.22], target: [WILL_AT[0], WILL_AT[1], lz - 0.01], fov: 40 }, { pos: [WILL_AT[0], 0.95, lz + 0.19], target: [WILL_AT[0], WILL_AT[1], lz - 0.01], fov: 38 });
    shadowAt(ctx, [WILL_AT[0], 0.8, lz], 1.5);
  } },
  // 42. "Was."  she crosses his name out with the red pen. Fade out.
  s42: { update(ctx) {
    const t = ctx.t, a = auntyWill(ctx), P = PROPS(ctx), lz = WILL_AT[2] + 0.077, w = ctx.ev('was');
    const k = easeInOut(clamp((t - w + 0.05) / 0.45));
    P.will.p.k = k;
    P.pen.p = { ...P.pen.p, visible: true, pos: [WILL_AT[0] - 0.065 + 0.13 * k, WILL_AT[1] + 0.008, lz + 0.006], rot: [0.55, 0.3, 0] }; a.p.gripR = { prop: P.pen, pose: 'grip' };
    move(ctx, { pos: [WILL_AT[0], 0.98, lz + 0.22], target: [WILL_AT[0], WILL_AT[1], lz - 0.01], fov: 38 }, { pos: [WILL_AT[0], 0.95, lz + 0.19], target: [WILL_AT[0], WILL_AT[1], lz - 0.01], fov: 34 });
    ctx.post.dim = smooth(clamp((t - (ctx.shot.t1 - 0.7)) / 0.65));
    shadowAt(ctx, [WILL_AT[0], 0.8, lz], 1.5);
  } },
};
