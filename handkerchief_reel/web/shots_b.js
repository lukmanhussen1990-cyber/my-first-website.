// Shots 13-22: she walks to the bush, the freeze (closer each time), the silk handkerchief, YOU's whole life (the
// cart), she holds it out, "You'll need this.", the aerial "What you don't know:".
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, LADY, GUARD, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, STREET } from './shotlib.js';
import { BUSH, PARK, REAR, GOUT, ATBUSH, youInBush, ladyAt, parked } from './shots_a.js';

const SY = STREET.sideY;
const HEADY = 1.31;                                  // YOU's head centre height in the bush (BUSH_Y = -0.3)
const LFACE = SY + 1.47;                             // the lady's eye height (1.66 m tall + heels)
const GUARD_SIDE = [1.0, -2.6];                      // bodyguard stepped back onto the sidewalk, hands on his head

function guardWorried(ctx, at = GUARD_SIDE, rotY = -2.6) {
  const g = GUARD(ctx), p = show(g, at, rotY, SY);
  face(g, 'wide', 'worried', 'pressed'); p.shoulderUp = 0.8;
  p.handL = L(g, 0.12, 2.02, 0.05); p.handR = L(g, -0.12, 2.02, 0.05); p.handPoseL = p.handPoseR = 'flat';
  return g;
}
// her standing in front of the bush, facing it (+Z), hanky held out or not
function ladyAtBush(ctx) { const lady = ladyAt(ctx, ATBUSH, 0); lady.p.lookAt = null; return lady; }
// the handkerchief pinched in her right hand, arm straight toward YOU's face
function holdOut(ctx, lady, k = 1) {
  const P = PROPS(ctx), p = lady.p;
  const sh = [ATBUSH[0] - 0.16, SY + 1.36, ATBUSH[1] + 0.05];
  const tip = [ATBUSH[0] - 0.05, SY + 1.32, ATBUSH[1] + 0.62];
  const at = sh.map((v, i) => lerp(v + (i === 1 ? -0.35 : 0), tip[i], k));
  P.hanky.p = { ...P.hanky.p, visible: true, pos: at, rot: [0, 0.4, 0], mode: 'held', k: 0.3 };
  p.gripR = { prop: P.hanky, pose: 'grip' };
  return at;
}

export const shots = {
  // 13. "She walks straight to your bush."  from the shop side: the back of YOU's head above the bush in the
  //     foreground, she walks along the curb straight toward it, the limo behind her, the bodyguard holding his head.
  s13: { update(ctx) {
    const t = ctx.t, t0 = ctx.shot.t0, H = ctx.W.cast.helpers;
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const you = youInBush(ctx); you.p.lookAt = null;
    const lady = ladyAt(ctx, REAR, Math.PI / 2);
    const u = clamp((t - (t0 + 0.05)) / 1.95);
    H.go(lady, REAR, ATBUSH, smooth(u) * 0.999, 'walk', 0.62);
    if (u >= 1) { lady.p.rotY = lerp(Math.PI / 2, 0, smooth((t - t0 - 2.0) / 0.25)); lady.p.gait = null; }
    lady.p.y = SY;
    you.p.headYaw = clamp((lady.p.pos[0] - BUSH[0]) * -0.25, -0.6, 0.6);
    guardWorried(ctx);
    move(ctx, { pos: [3.7, 2.05, -0.35], target: [0.4, 0.95, -3.3], fov: 50 }, { pos: [3.5, 2.0, -0.55], target: [0.9, 0.95, -3.25], fov: 48 });
    shadowAt(ctx, [1.0, 1.0, -2.8], 6);
  } },
  // 14. "You freeze."  close-up: frozen, eyes wide, tiny straight mouth, one sweat drop. (All sound drops.)
  s14: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const you = youInBush(ctx), p = you.p;
    face(you, 'wide', 'raised', 'tight'); p.headPitch = 0.12; p.pupils = [0, 0.4]; p.shoulderUp = 0.7;
    move(ctx, { pos: [2.0, 1.36, -3.1], target: [2.0, HEADY + 0.02, -2.2], fov: 36 }, { pos: [2.0, 1.36, -3.0], target: [2.0, HEADY + 0.02, -2.2], fov: 36 });
    ctx.cam.handheld(0);
    shadowAt(ctx, [2.0, 1.2, -2.3], 3);
    pose(ctx);
    ctx.W.fx.sweat({ ch: you, t0: ctx.shot.t0 + 0.2, size: 1.0 });
  } },
  // 15. "She freezes."  close-up: frozen mid-step in front of the bush, perfectly still, one brow up.
  s15: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx), p = lady.p;
    face(lady, 'open', 'raised', 'neutral'); p.headPitch = -0.12;
    p.gait = { kind: 'walk', phase: 0.22 };
    move(ctx, { pos: [2.06, LFACE + 0.02, -2.38], target: [2.0, LFACE, -3.15], fov: 34 }, { pos: [2.05, LFACE + 0.02, -2.44], target: [2.0, LFACE, -3.15], fov: 34 });
    ctx.cam.handheld(0);
    shadowAt(ctx, [2.0, 1.5, -3.1], 3);
  } },
  // 16. "She looks at you."  extreme close-up: she slowly lowers her sunglasses with one finger, eyes look down.
  s16: { update(ctx) {
    const t = ctx.t, t0 = ctx.shot.t0;
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx), p = lady.p;
    const k = smooth(clamp((t - t0 - 0.1) / 0.9));
    p.glassesLow = k; face(lady, 'open', 'neutral', 'neutral'); p.headPitch = -0.2; p.pupils = [0, -0.8];
    pose(ctx);
    const gp = lady.head.localToWorld(v3(0, 0.004 - 0.026 * k, 0.11)).toArray();     // the glasses' bridge
    const lift = win(t, t0, ctx.shot.t1, 0.12, 0.3);
    p.handR = [gp[0] - 0.04, gp[1] - 0.07 - 0.12 * (1 - lift), gp[2] + 0.035]; p.handPoseR = 'point';
    move(ctx, { pos: [2.13, LFACE + 0.04, -2.62], target: [2.0, LFACE + 0.0, -3.15], fov: 30 }, { pos: [2.11, LFACE + 0.04, -2.7], target: [2.0, LFACE + 0.0, -3.15], fov: 30 });
    ctx.cam.handheld(0);
    shadowAt(ctx, [2.0, 1.5, -3.1], 3);
  } },
  // 17. "You look at her."  the closest shot: his kind eyes looking up at her.
  s17: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const you = youInBush(ctx), p = you.p;
    face(you, 'open', 'raised', 'neutral'); p.headPitch = 0.28; p.pupils = [0, 0.8]; p.blush = 0.3;
    move(ctx, { pos: [2.0, 1.35, -2.74], target: [2.0, HEADY + 0.03, -2.2], fov: 30 }, { pos: [2.0, 1.35, -2.66], target: [2.0, HEADY + 0.03, -2.2], fov: 30 });
    ctx.cam.handheld(0);
    shadowAt(ctx, [2.0, 1.2, -2.3], 3);
  } },
  // 18. "Then she pulls out her silk handkerchief."  slow motion: the pink silk floats out of her hand in a heavenly
  //     beam of light, sparkles (choir "aaah").
  s18: { update(ctx) {
    const t = ctx.t, pl = ctx.ev('pulls'), sk = ctx.ev('silk');
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx), p = lady.p, P = PROPS(ctx);
    face(lady, 'open', 'neutral', 'neutral');
    const a = clamp((t - (pl - 0.2)) / 0.6);
    const from = [ATBUSH[0] - 0.12, SY + 1.05, ATBUSH[1] + 0.2], held = [ATBUSH[0] - 0.05, SY + 1.32, ATBUSH[1] + 0.42];
    const pinch = from.map((v, i) => lerp(v, held[i], easeOut(a)));
    if (t < sk) {
      P.hanky.p = { ...P.hanky.p, visible: true, pos: pinch, rot: [0, 0.3, 0], mode: 'held', k: 0.4 };
      p.gripR = { prop: P.hanky, pose: 'grip' };
    } else {                                           // released: floats up in slow motion
      const f = t - sk;
      P.hanky.p = { ...P.hanky.p, visible: true, pos: [held[0] + Math.sin(f * 0.9) * 0.05, held[1] + 0.05 + f * 0.09, held[2] + 0.05], rot: [0.2 + Math.sin(f * 0.7) * 0.2, 0.4 + f * 0.25, Math.sin(f * 0.5) * 0.3], mode: 'float', t0: sk };
      p.handR = [held[0] - 0.02, held[1] - 0.06, held[2] - 0.05]; p.handPoseR = 'open';
    }
    move(ctx, { pos: [1.7, SY + 1.42, -2.3], target: [1.98, SY + 1.4, -2.9], fov: 40 }, { pos: [1.76, SY + 1.44, -2.42], target: [1.98, SY + 1.44, -2.85], fov: 38 });
    shadowAt(ctx, [2.0, 1.4, -3.0], 3);
    const hk = P.hanky.p.pos;
    ctx.W.fx.glow({ at: [hk[0], hk[1] - 0.05, hk[2]], size: 0.9, color: '#ffe6b0', amount: 0.5 * smooth((t - pl) / 0.6) });
    for (let i = 0; i < 6; i++) {
      const ang = i * 1.05 + t * 0.6;
      ctx.W.fx.glint({ at: [hk[0] + Math.cos(ang) * 0.22, hk[1] - 0.1 + Math.sin(ang * 1.3) * 0.15, hk[2] + 0.05], size: 0.045, seed: i * 7 });
    }
    ctx.post.vignette = 0.35;
  } },
  // 19. "It costs more than your whole life."  YOU's whole life: the rusty shopping cart. Slow sideways pan.
  s19: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const you = youInBush(ctx); face(you, 'open', 'sad', 'frown'); you.p.lookAt = [0.55, 0.8, -1.15];
    const c = STREET.cart.pos;
    move(ctx, { pos: [-0.35, 1.15, -3.0], target: [0.4, 0.62, -1.15], fov: 44 }, { pos: [0.35, 1.12, -3.05], target: [0.7, 0.62, -1.15], fov: 44 });
    bump(ctx, ctx.ev('whole'), 1.05, 0.3);
    shadowAt(ctx, [c[0], 0.6, c[1]], 3);
  } },
  // 20. "She holds it out."  side view: she holds the handkerchief out at arm's length, arm perfectly straight,
  //     deadpan, looking straight ahead; his head above the bush, staring at it.
  s20: { update(ctx) {
    const t = ctx.t, t0 = ctx.shot.t0;
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx), p = lady.p;
    holdOut(ctx, lady, easeOut(clamp((t - t0) / 0.35)));
    p.headPitch = 0.05; p.lookAt = [ATBUSH[0], LFACE, ATBUSH[1] + 3];
    const you = youInBush(ctx); face(you, 'wide', 'raised', 'o'); you.p.lookAt = [ATBUSH[0] - 0.05, SY + 1.3, ATBUSH[1] + 0.62];
    move(ctx, { pos: [3.75, 1.42, -2.7], target: [2.0, 1.3, -2.68], fov: 42 }, { pos: [3.6, 1.42, -2.7], target: [2.0, 1.3, -2.68], fov: 42 });
    shadowAt(ctx, [2.0, 1.2, -2.7], 3);
    pose(ctx);
    ctx.W.fx.glint({ at: PROPS(ctx).hanky.p.pos.map((v, i) => v + (i === 1 ? -0.12 : 0)), size: 0.05, t0: t0 + 0.4 });
  } },
  // 21. "You'll need this."  close-up: her perfectly straight face, sunglasses on, the handkerchief held out.
  s21: { update(ctx) {
    const t = ctx.t, nd = ctx.ev('need');
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx), p = lady.p;
    holdOut(ctx, lady, 1);
    p.headPitch = -0.08;
    if (t > nd - 0.32 && t < nd + 0.55) ctx.W.cast.helpers.talk(lady, t, 0.5);
    ctx.cam.set({ pos: [2.22, LFACE + 0.02, -2.42], target: [2.0, LFACE, -3.15], fov: 36 });
    ctx.cam.handheld(0);
    punch(ctx, nd, 1.08, 0.1);
    shadowAt(ctx, [2.0, 1.5, -3.1], 3);
  } },
  // 22. "What you don't know:"  high wide shot looking down at the street: limo, bush, the lady, the bodyguard.
  s22: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 0 });
    const lady = ladyAtBush(ctx); holdOut(ctx, lady, 1);
    youInBush(ctx);
    guardWorried(ctx);
    move(ctx, { pos: [-3.2, 13.5, -11.5], target: [0.8, 0.0, -3.0], fov: 46 }, { pos: [-3.0, 13.2, -11.2], target: [0.9, 0.0, -3.0], fov: 41 });
    shadowAt(ctx, [0.5, 0.5, -3.2], 9);
  } },
};
