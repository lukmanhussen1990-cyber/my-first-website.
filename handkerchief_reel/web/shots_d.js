// Shots 31-41: Paris (behind the Eiffel Tower, "for old times' sake"), the wedding (hand kiss, the bodyguard cries
// the loudest), 50 years later on the porch swing, holding hands, the old handkerchief, the framed one (never
// washed), and the ending: hearts + a few stink lines float up over the house at sunset.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, LADY, GUARD, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, inBush, PARIS, WEDDING, PORCH, INTERIOR } from './shotlib.js';

const PB = PARIS.bush.pos;
const W = WEDDING;

// YOU (in his nice suit) crouching in the Paris bush, facing the camera side (-Z), the tower behind him
function youParis(ctx) {
  const you = ctx.W.cast.youSuit;
  inBush(ctx, you, PB, Math.PI, -0.42);
  face(you, 'happy', 'raised', 'smile');
  return you;
}
// the old couple on the porch swing (sway shared with the swing)
function swing(ctx) {
  const t = ctx.t, a = 0.07 * Math.sin((t * 2 * Math.PI) / 3.4), dz = -1.55 * Math.sin(a);
  setState(ctx, { swing: a });
  const C = ctx.W.cast, you = C.youOld, lady = C.ladyOld;
  for (const [ch, at] of [[you, PORCH.you.pos], [lady, PORCH.lady.pos]]) {
    const p = show(ch, [at[0], at[1] + dz], Math.PI, PORCH.deckY);
    p.sit = 1; p.seatY = PORCH.swing.seatY; p.legs = 'chair'; p.feet = PORCH.deckY; p.lean = -0.06;
  }
  lady.p.glasses = 'up';
  face(you, 'happy', 'raised', 'smile'); face(lady, 'happy', 'raised', 'smile');
  return { you, lady, dz };
}

export const shots = {
  // 31. "Paris."  wide: the Eiffel Tower on a sunny golden afternoon, slow tilt up.   [MONTH 3]
  s31: { update(ctx) {
    youParis(ctx);
    move(ctx, { pos: [900, 1.3, -6.2], target: [901.5, 6, 40], fov: 52 }, { pos: [900, 1.35, -6.0], target: [904, 21, 78], fov: 50 }, easeInOut);
    shadowAt(ctx, [900, 1, 0], 8);
  } },
  // 32. "You poop behind the Eiffel Tower."  his head above a round trimmed bush, calm happy smile; stink + hearts.
  s32: { update(ctx) {
    const t = ctx.t;
    const you = youParis(ctx); you.p.headRoll = Math.sin(t * 1.5) * 0.05;
    setState(ctx, { bushShake: win(t, ctx.ev('poop') + 0.1, ctx.ev('poop') + 0.7, 0.08, 0.2) * 0.6 });
    move(ctx, { pos: [900, 1.28, -2.45], target: [900, 1.25, 0], fov: 46 }, { pos: [900, 1.27, -2.25], target: [900, 1.25, 0], fov: 45 });
    shadowAt(ctx, [900, 1.0, 0], 3);
    ctx.W.fx.stink({ at: [900, 0.92, -0.05], amount: 0.6, spread: 0.5, height: 0.5, count: 3 });
    ctx.W.fx.hearts({ at: [900, 1.2, -0.1], t0: ctx.shot.t0 + 0.2, count: 6, every: 0.32, life: 1.6, rise: 0.4, spread: 0.3, size: 0.045, loop: 1.9 });
  } },
  // 33. "For old times' sake."  she stands by the bush laughing, holding the pink handkerchief out to him again.
  s33: { update(ctx) {
    const t = ctx.t;
    const you = youParis(ctx); you.p.lookAt = [PARIS.lady.pos[0], 1.5, PARIS.lady.pos[1]]; face(you, 'happy', 'raised', 'grin');
    const lady = ctx.W.cast.lady, p = show(lady, PARIS.lady.pos, PARIS.lady.rotY, 0);
    p.glasses = 'up'; p.hairSway = 0.4;
    ctx.W.cast.helpers.laugh(lady, t, 0.6);
    const P = PROPS(ctx);
    const at = L(lady, -0.05, 1.32, 0.5);
    P.hanky.p = { ...P.hanky.p, visible: true, pos: at, rot: [0, PARIS.lady.rotY, 0], mode: 'held', k: 0.5 };
    p.gripR = { prop: P.hanky, pose: 'grip' };
    move(ctx, { pos: [899.35, 1.42, -2.7], target: [900.55, 1.28, -0.2], fov: 45 }, { pos: [899.45, 1.4, -2.55], target: [900.55, 1.28, -0.2], fov: 44 });
    shadowAt(ctx, [900.5, 1.0, -0.2], 3);
    ctx.W.fx.hearts({ at: [900.5, 1.5, -0.3], t0: ctx.shot.t0 + 0.1, count: 7, every: 0.2, life: 1.5, rise: 0.4, spread: 0.35, size: 0.045 });
    ctx.W.fx.glint({ at: at.map((v, i) => v + (i === 1 ? -0.15 : 0)), size: 0.05, t0: ctx.ev('sake') });
  } },
  // 34. "The wedding."  wide: flower arch, white chairs, guests; the groom bows and kisses the back of her hand.  [YEAR 1]
  s34: { update(ctx) {
    const t = ctx.t, C = ctx.W.cast;
    const you = C.youGroom, bride = C.bride;
    const yp = show(you, W.you.pos, W.you.rotY, 0), bp = show(bride, W.bride.pos, W.bride.rotY, 0);
    const hand = [1200.02, 1.12, 5.0];
    bp.handR = hand; bp.handPoseR = 'flat'; bp.lookAt = [W.you.pos[0], 1.3, W.you.pos[1]];
    face(bride, 'happy', 'raised', 'smile');
    const bow = smooth(clamp((t - ctx.shot.t0 - 0.05) / 0.35));
    yp.lean = 0.55 * bow; yp.headPitch = -0.35 * bow;
    yp.handR = [hand[0] - 0.02, hand[1] - 0.03, hand[2] + 0.02]; yp.handPoseR = 'relaxed';
    yp.handL = L(you, 0.14, 0.95, -0.08);
    face(you, 'closed', 'raised', 'smile');
    guests(ctx);
    move(ctx, { pos: [1200, 1.95, -3.6], target: [1200, 1.4, 5.0], fov: 46 }, { pos: [1200, 1.9, -3.0], target: [1200, 1.4, 5.0], fov: 45 });
    shadowAt(ctx, [1200, 1, 3.5], 6);
    ctx.W.fx.hearts({ at: [1200, 1.9, 5.0], t0: ctx.shot.t0 + 0.2, count: 8, every: 0.1, life: 1.5, rise: 0.5, spread: 0.4, size: 0.07 });
  } },
  // 35. "The bodyguard cries the loudest."  front row: big cartoon tears, mouth wide open, the huge tissue.
  s35: { update(ctx) {
    const t = ctx.t, lo = ctx.ev('loudest');
    guests(ctx);
    const g = GUARD(ctx), p = show(g, W.guard.pos, W.guard.rotY, 0);
    p.sit = 1; p.seatY = W.seatY; p.legs = 'chair'; p.feet = 0;
    face(g, 'squeeze', 'sad', 'scream'); p.talk = 0.5 + 0.5 * Math.abs(Math.sin(t * 9));
    p.bounce = 0.7; p.shoulderUp = 0.5 + 0.3 * Math.sin(t * 9);
    const P = PROPS(ctx);
    const blow = smooth(clamp((t - (lo - 0.15)) / 0.25));
    const at = L(g, -0.02, lerp(1.0, 1.52, blow), lerp(0.32, 0.2, blow));
    P.tissue.p = { ...P.tissue.p, visible: true, pos: at, rot: [lerp(0.2, -0.2, blow), W.guard.rotY, 0], mode: 'flat' };
    p.gripR = { prop: P.tissue, pose: 'grip' };
    p.handL = L(g, 0.14, 0.72, 0.3); p.handPoseL = 'fist';
    if (blow > 0.5) { p.cheeks = 1; p.talk = 0; face(g, 'squeeze', 'sad', 'pressed'); }
    move(ctx, { pos: [1201.25, 1.3, 4.5], target: [1201.25, 1.28, 3.0], fov: 40 }, { pos: [1201.25, 1.3, 4.35], target: [1201.25, 1.28, 3.0], fov: 39 });
    shake(ctx, ctx.shot.t0, ctx.shot.t1, 0.006, 9);
    hit(ctx, lo, 0.012, 0.3);
    shadowAt(ctx, [1201.2, 1.2, 3.0], 3);
    pose(ctx);
    ctx.W.fx.cryTears({ ch: g, amount: 1, size: 1.4, spread: 1.2, life: 0.8 });
  } },
  // 36. "Fifty years later."  wide: the cosy wooden house with the porch at sunset.   [50 YEARS LATER]
  s36: { update(ctx) {
    swing(ctx);
    move(ctx, { pos: [1500, 2.05, -12.5], target: [1500, 1.9, 1.0], fov: 45 }, { pos: [1500, 1.95, -10.8], target: [1500, 1.85, 1.0], fov: 45 });
    shadowAt(ctx, [1500, 1.5, 0.5], 9);
  } },
  // 37. "Two old people on a porch."  medium: side by side on the porch swing, smiling softly.
  s37: { update(ctx) {
    const { you, lady } = swing(ctx);
    you.p.lookAt = [lady.p.pos[0], 1.55, lady.p.pos[1]]; lady.p.headRoll = 0.06;
    move(ctx, { pos: [1500, 1.42, -1.75], target: [1500, 1.3, 1.25], fov: 42 }, { pos: [1500, 1.4, -1.55], target: [1500, 1.3, 1.25], fov: 41 });
    shadowAt(ctx, [1500, 1.2, 1.2], 3);
  } },
  // 38. "Still holding hands."  close-up of the two old hands holding each other on the swing; hearts float up.
  s38: { update(ctx) {
    const { you, lady, dz } = swing(ctx);
    const h = [1500.0, PORCH.swing.seatY + 0.13, PORCH.swing.pos[1] + dz - 0.02];
    you.p.handR = [h[0] - 0.02, h[1], h[2]]; you.p.handPoseR = 'grip';
    lady.p.handL = [h[0] + 0.02, h[1] + 0.02, h[2] + 0.01]; lady.p.handPoseL = 'grip';
    move(ctx, { pos: [1500.02, 1.42, 0.45], target: [1500, h[1], h[2]], fov: 36 }, { pos: [1500.02, 1.38, 0.55], target: [1500, h[1], h[2]], fov: 34 });
    shadowAt(ctx, [1500, 1.1, 1.2], 2);
    ctx.W.fx.hearts({ at: [h[0], h[1] + 0.05, h[2]], t0: ctx.shot.t0 + 0.2, count: 8, every: 0.25, life: 1.6, rise: 0.35, spread: 0.15, size: 0.035, loop: 2.0 });
  } },
  // 39. "She still has the handkerchief."  close-up: she holds up the same pink handkerchief, faded with age.
  s39: { update(ctx) {
    const t = ctx.t;
    const { you, lady } = swing(ctx);
    lady.p.lookAt = null; lady.p.headPitch = -0.08;
    const P = PROPS(ctx);
    const up = smooth(clamp((t - ctx.shot.t0 - 0.1) / 0.5));
    const at = L(lady, -0.1, PORCH.swing.seatY - PORCH.deckY + 0.42 + 0.2 * up, 0.26);
    P.hankyOld.p = { ...P.hankyOld.p, visible: true, pos: at, rot: [0, Math.PI, 0.15], mode: 'held', k: 0 };
    lady.p.gripR = { prop: P.hankyOld, pose: 'grip' };
    move(ctx, { pos: [1500.3, 1.48, 0.42], target: [1500.4, 1.42, 1.25], fov: 38 }, { pos: [1500.3, 1.48, 0.5], target: [1500.4, 1.42, 1.25], fov: 37 });
    shadowAt(ctx, [1500.4, 1.3, 1.2], 2);
    ctx.W.fx.glint({ at: at.map((v, i) => v + (i === 1 ? -0.1 : i === 2 ? -0.02 : 0)), size: 0.05, t0: ctx.ev('handkerchief') });
  } },
  // 40. "She never washed it."  the old crusty handkerchief in a golden frame on the wall; small stink lines, a fly.
  s40: { update(ctx) {
    const t = ctx.t, F = INTERIOR.frame.pos;
    move(ctx, { pos: [F[0], F[1] - 0.08, -1.75], target: [F[0], F[1] - 0.02, 0], fov: 40 }, { pos: [F[0], F[1] - 0.05, -1.3], target: [F[0], F[1], 0], fov: 40 });
    const P = PROPS(ctx), tt = t - ctx.shot.t0;
    P.fly.p = { ...P.fly.p, visible: true, pos: [F[0] + Math.sin(tt * 3.1) * 0.22 + Math.sin(tt * 17) * 0.015, F[1] + 0.05 + Math.sin(tt * 4.3 + 1) * 0.12, -0.12 + Math.sin(tt * 2.3) * 0.05], rot: [0, tt * 4, 0.3 * Math.sin(tt * 9)] };
    shadowAt(ctx, [F[0], F[1], 0], 2);
    ctx.W.fx.stink({ at: [F[0], F[1] + 0.12, -0.06], amount: 0.5, spread: 0.4, height: 0.35, count: 3, t0: ctx.ev('washed') - 0.3 });
  } },
  // 41. "That part is weird."  ending: the whole house at sunset from far away, hearts and a few small stink lines
  //     float up together into the sky; slow zoom out.
  s41: { update(ctx) {
    swing(ctx);
    move(ctx, { pos: [1500, 4.2, -21], target: [1500, 3.0, 0], fov: 42 }, { pos: [1500, 5.2, -28], target: [1500, 3.4, 0], fov: 46 }, easeOut);
    shadowAt(ctx, [1500, 2, 0], 12);
    ctx.W.fx.hearts({ at: [1500, 1.8, 1.0], t0: ctx.shot.t0 + 0.1, count: 10, every: 0.25, life: 2.6, rise: 3.2, spread: 1.6, size: 0.35, loop: 2.6 });
    ctx.W.fx.stink({ at: [1500, 1.6, 1.2], amount: 0.45, spread: 1.2, height: 2.6, count: 3, scale: 2.2 });
  } },
};

// wedding guests on the white chairs (front row: the bodyguard on the right of the aisle)
function guests(ctx) {
  const C = ctx.W.cast;
  const seat = (ch, x, z, smile = true) => {
    const p = show(ch, [x, z], 0, 0); p.sit = 1; p.seatY = W.seatY; p.legs = 'chair'; p.feet = 0;
    face(ch, smile ? 'happy' : 'open', 'raised', 'smile'); p.lookAt = [1200, 1.4, 5.0];
  };
  seat(C.guestW1, W.guard.pos[0] + W.seatGap, 3.0);
  seat(C.guestM2, 1200 - W.aisle - 0.31, 3.0);
  seat(C.guestM1, 1200 - W.aisle - 0.31 - W.seatGap, 3.0);
  seat(C.guestW2, W.guard.pos[0], 2.0);
  seat(C.pianist, 1200 - W.aisle - 0.31, 2.0);
  const g = GUARD(ctx);
  if (!g.p.visible) { const p = show(g, W.guard.pos, 0, 0); p.sit = 1; p.seatY = W.seatY; p.legs = 'chair'; p.feet = 0; face(g, 'squeeze', 'sad', 'frown'); }
}
