// Shots 1-12: AGE 30 at the kids' table, the roll he can't use, Mom the hero, the party, the bathroom (chest-up only),
// "MOM!", the empty chair + tumbleweed, "DAD!" / "No.", "UNCLE!" / "No.", Grandma fake-sleeping.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, MOM, DAD, UNCLE, GRANDMA, KID, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, onToilet, HOUSE, VOID } from './shotlib.js';

const VX = VOID.origin[0];
const TBL = HOUSE.table.pos;
export const TINY_SEAT = 0.345;                                  // kid chair seat height
export const YOU_TINY = [TBL[0] + 0.45, TBL[1] - 0.66];          // YOU on the little green chair (facing the table, +Z)
export const KID_TINY = [TBL[0] - 0.5, TBL[1] - 0.66];
export const DOORWAY_Z = HOUSE.door.z;

// ---------------------------------------------------------------- the family (helpers shared with shots_b.js)
export function dadOnCouch(ctx, o = {}) {
  const dad = DAD(ctx), P = PROPS(ctx), x = HOUSE.couch.seats[0];
  const p = seat(ctx, dad, [x, 3.34], Math.PI, HOUSE.couch.seatY);
  face(dad, 'open', 'neutral', 'neutral'); p.lean = -0.06;
  const ph = o.paperY ?? 1.06, down = o.paperDown || 0;
  if (o.paper !== false) {
    P.paper.p = { ...P.paper.p, visible: true, pos: L(dad, 0, lerp(ph, 0.82, down), lerp(0.36, 0.42, down)), rot: [lerp(-0.15, 0.6, down), Math.PI + p.rotY, 0] };
    p.gripL = { prop: P.paper, which: 'R', pose: 'grip' }; p.gripR = { prop: P.paper, which: 'L', pose: 'grip' };
    p.lookAt = L(dad, 0, lerp(ph, 0.82, down), 0.36);
  }
  return dad;
}
export function uncleAt(ctx, pos, rotY, o = {}) {
  const un = UNCLE(ctx), P = PROPS(ctx), p = show(un, pos, rotY, 0);
  face(un, 'open', 'neutral', 'chew'); p.cheeks = 0.5;
  if (o.plate !== false) {
    P.plate.p = { ...P.plate.p, visible: true, pos: L(un, 0.16, 1.02, 0.36), rot: [0, rotY, 0] };
    p.gripL = { prop: P.plate, pose: 'grip' };
  }
  return un;
}
export function grandmaInChair(ctx) {
  const g = GRANDMA(ctx), A = HOUSE.armchair;
  const back = [-Math.sin(A.rotY) * 0.07, -Math.cos(A.rotY) * 0.07];
  const p = seat(ctx, g, [A.pos[0] + back[0], A.pos[1] + back[1]], A.rotY, A.seatY + 0.02);
  p.handL = L(g, 0.17, 0.62, 0.3); p.handR = L(g, -0.17, 0.62, 0.3);
  face(g, 'open', 'neutral', 'smile');
  return g;
}
export function kidAt(ctx, pos, rotY, o = {}) {
  const k = KID(ctx), p = show(k, pos, rotY, 0);
  face(k, 'open', 'neutral', 'neutral'); p.glasses = o.glasses || 'off';
  return k;
}
export function youTiny(ctx) {
  const you = YOU(ctx), p = seat(ctx, you, YOU_TINY, 0, TINY_SEAT);
  p.handL = L(you, 0.2, HOUSE.table.h + 0.02, 0.4); p.handR = L(you, -0.2, HOUSE.table.h + 0.02, 0.4);
  p.handPoseL = p.handPoseR = 'flat';
  return you;
}
// YOU peeking out of the bathroom: body behind the wall next to the door, leaning so only the head + a shoulder show
export function youPeek(ctx, o = {}) {
  const you = YOU(ctx), p = show(you, [HOUSE.door.x + 0.32, DOORWAY_Z + 0.68], -Math.PI / 2, 0);
  p.leanSide = o.lean ?? 0.42; p.lean = 0.05;
  p.handR = L(you, -0.2, 1.25, 0.12); p.handPoseR = 'grip';
  setState(ctx, { doorOpen: 0.62 });
  return you;
}

export const shots = {
  // 1. "You're thirty years old."  YOU on a tiny kids' chair at the party table, party hat, deadpan. Label AGE 30.
  s01: { update(ctx) {
    const t = ctx.t, you = youTiny(ctx), p = you.p;
    face(you, 'open', 'neutral', 'neutral');
    move(ctx, { pos: [TBL[0] + 0.62, 1.42, 1.85], target: [TBL[0] + 0.5, 0.98, -0.12], fov: 40 }, { pos: [TBL[0] + 0.6, 1.38, 1.6], target: [TBL[0] + 0.5, 1.0, -0.12], fov: 40 });
    lookCam(ctx, you); p.headRoll = 0.04;
    if (t > ctx.ev('old') + 0.15) { face(you, 'squint', 'neutral', 'tight'); }
    const k = kidAt(ctx, [KID_TINY[0], KID_TINY[1]], 0.25); seat(ctx, k, KID_TINY, 0.25, TINY_SEAT); k.p.lookAt = L(you, 0, 1.25, 0); face(k, 'open', 'raised', 'smile');
    k.p.handL = L(k, 0.15, HOUSE.table.h + 0.02, 0.3); k.p.handR = L(k, -0.15, HOUSE.table.h + 0.02, 0.3);
    punch(ctx, ctx.ev('old'), 1.08, 0.1);
    shadowAt(ctx, [TBL[0], 0.8, TBL[1]], 3);
  } },
  // 2. "You can't wipe your own ass."  void: he holds a toilet paper roll and stares at it, lost. Question marks.
  s02: { update(ctx) {
    const t = ctx.t, you = YOU(ctx), p = show(you, [VX, 0.05], Math.PI, 0), P = PROPS(ctx);
    setState(ctx, { voidShow: 'none', exposure: 1.25 });
    const turn = Math.sin(t * 2.3) * 0.5;
    const rp = L(you, -0.04, 1.42, 0.34);
    P.roll.p = { ...P.roll.p, visible: true, pos: rp, rot: [0.15, Math.PI + turn, 0.2 * Math.sin(t * 1.7)] };
    p.gripR = { prop: P.roll, pose: 'grip' };
    p.lookAt = rp; p.headRoll = 0.22; face(you, 'open', 'worried', 'tight');
    if (t > ctx.ev('ass')) { face(you, 'wide', 'worried', 'o'); p.headRoll = -0.18; }
    ctx.W.fx.question({ at: [VX + 0.18, 2.0, -0.05], size: 0.16, t0: ctx.ev('wipe') - 0.1 });
    ctx.W.fx.question({ at: [VX - 0.2, 2.08, -0.05], size: 0.13, t0: ctx.ev('ass'), roll: 0.3 });
    move(ctx, { pos: [VX, 1.58, -1.75], target: [VX, 1.52, 0], fov: 40 }, { pos: [VX, 1.58, -1.5], target: [VX, 1.55, 0], fov: 40 });
    punch(ctx, ctx.ev('ass'), 1.1, 0.1);
    shadowAt(ctx, [VX, 1.2, 0], 2);
  } },
  // 3. "Mom always does it."  void: Mom, golden glow, holds up a fresh roll like a trophy. Sparkles.
  s03: { update(ctx) {
    const t = ctx.t, mom = MOM(ctx), p = show(mom, [VX, 0.05], Math.PI, 0), P = PROPS(ctx);
    setState(ctx, { voidShow: 'none', exposure: 1.25 });
    const up = easeOutBack(clamp((t - ctx.shot.t0 - 0.05) / 0.35), 1.6);
    const rp = L(mom, -0.2, lerp(1.25, 1.95, up), lerp(0.25, 0.12, up));
    P.roll.p = { ...P.roll.p, visible: true, pos: rp, rot: [0, Math.PI, 0] };
    p.gripR = { prop: P.roll, pose: 'grip' };
    p.handL = L(mom, 0.2, 1.0, 0.12); p.handPoseL = 'fist';
    move(ctx, { pos: [VX, 1.5, -1.75], target: [VX, 1.55, 0], fov: 40 }, { pos: [VX, 1.55, -1.5], target: [VX, 1.6, 0], fov: 40 });
    face(mom, 'happy', 'raised', 'grin'); lookCam(ctx, mom); p.headRoll = 0.08;
    if (t > ctx.ev('does')) { face(mom, 'happy', 'raised', 'smileOpen'); p.talk = 0.6; }
    ctx.W.fx.glow({ at: [VX, 1.45, 0.5], size: 3.2, amount: 1, color: '#ffd890' });
    for (let i = 0; i < 6; i++) ctx.W.fx.glint({ at: [VX + Math.cos(i * 1.9) * 0.5, 1.4 + Math.sin(i * 2.3) * 0.55, -0.15], size: 0.06, seed: i * 3 });
    ctx.W.fx.glint({ at: () => v3(P.roll.position).add(v3(0.05, 0.08, -0.08)), size: 0.1, t0: ctx.shot.t0 + 0.35 });
    ctx.post.tint = 0.18; ctx.post.tintColor = [1.0, 0.85, 0.55];
    shadowAt(ctx, [VX, 1.2, 0], 2);
  } },
  // 4. "Today is your nephew's sixth birthday."  wide: the party (cake + 6 candles, balloons, banner, family).
  s04: { update(ctx) {
    const t = ctx.t, H = ctx.W.cast.helpers;
    const you = youTiny(ctx); face(you, 'open', 'neutral', 'smile'); you.p.lookAt = [TBL[0] + 0.1, 1.0, TBL[1]];
    const k = kidAt(ctx, [TBL[0] - 0.25, TBL[1] - 0.62], 0.1); H.laugh(k, t, 0.7); k.p.handL = L(k, 0.1, 0.95, 0.3); k.p.handR = L(k, -0.1, 0.95, 0.3);
    if (Math.sin(t * 12) > 0) { k.p.handL = L(k, 0.04, 0.97, 0.33); k.p.handR = L(k, -0.04, 0.97, 0.33); }
    dadOnCouch(ctx);
    const un = uncleAt(ctx, [0.6, 2.2], toward([0.6, 2.2], [TBL[0], TBL[1]])); H.laugh(un, t, 0.4);
    grandmaInChair(ctx);
    ctx.W.fx.notes({ at: [TBL[0] + 0.1, 1.5, TBL[1]], count: 4, amount: 0.9 });
    move(ctx, { pos: [-3.65, 1.8, -2.95], target: [-0.7, 1.0, 2.1], fov: 52 }, { pos: [-3.5, 1.75, -2.7], target: [-0.7, 1.0, 2.1], fov: 52 });
    punch(ctx, ctx.ev('birthday'), 1.06, 0.12);
    shadowAt(ctx, [-1.0, 0.8, 1.2], 5);
  } },
  // 5. "You just pooped."  bathroom, chest-up only: eyes closed, relieved little smile; stink lines; then: no paper.
  s05: { update(ctx) {
    const t = ctx.t, you = YOU(ctx), p = onToilet(ctx, you);
    face(you, 'closed', 'raised', 'smile'); p.headPitch = 0.12; p.headRoll = 0.06;
    const pp = ctx.ev('pooped');
    if (t > pp + 0.35) { face(you, 'open', 'neutral', 'neutral'); p.lookAt = [HOUSE.toilet.pos[0] - 0.05, 0.72, HOUSE.bath.z0 + 0.09]; }
    if (t > pp + 0.6) face(you, 'wide', 'worried', 'o');
    ctx.W.fx.stink({ at: [HOUSE.toilet.pos[0] + 0.3, 1.0, HOUSE.toilet.pos[1] + 0.42], amount: 0.5, spread: 0.3, height: 0.45, count: 2, burst: pp });
    move(ctx, { pos: [5.18, 1.3, 0.96], target: [6.18, 1.2, 0.9], fov: 42 }, { pos: [5.3, 1.3, 0.94], target: [6.18, 1.2, 0.9], fov: 42 });
    bump(ctx, pp, 1.05, 0.25);
    setState(ctx, { doorOpen: 0 });
    shadowAt(ctx, [6.0, 1.0, 0.9], 2.5);
  } },
  // 6. "MOM!"  close-up: he yells; camera shake + speed lines.
  s06: { update(ctx) {
    const t = ctx.t, you = YOU(ctx), p = onToilet(ctx, you), m = ctx.ev('mom');
    face(you, 'wide', 'worried', 'o');
    if (t > m - 0.03) { face(you, 'squeeze', 'worried', 'scream'); p.headPitch = 0.22; p.shoulderUp = 0.6; p.red = 0.35; }
    if (t > m + 0.95) { face(you, 'wide', 'worried', 'tight'); p.headPitch = 0.05; p.shoulderUp = 0.2; }
    p.handL = L(you, 0.1, 1.42, 0.2); p.handR = L(you, -0.1, 1.42, 0.2); p.handPoseL = p.handPoseR = 'flat';
    if (t < m) { p.handL = L(you, 0.2, 0.62, 0.22); p.handR = L(you, -0.2, 0.62, 0.22); p.handPoseL = p.handPoseR = 'relaxed'; }
    move(ctx, { pos: [5.4, 1.32, 0.93], target: [6.18, 1.3, 0.9], fov: 40 }, { pos: [5.47, 1.32, 0.92], target: [6.18, 1.3, 0.9], fov: 40 });
    punch(ctx, m, 1.12, 0.08);
    shake(ctx, m, m + 0.9, 0.012, 26);
    if (t > m && t < m + 0.9) ctx.W.fx.speed({ amount: 0.8, count: 14 });
    setState(ctx, { doorOpen: 0 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 7. "Mom isn't here."  her empty chair with the MOM card; a tumbleweed rolls past. Crickets.
  s07: { update(ctx) {
    const t = ctx.t, u = clamp((t - ctx.shot.t0) / (ctx.shot.t1 - ctx.shot.t0 + 0.2));
    const x = lerp(-0.7, -4.2, u);
    setState(ctx, { tumble: { x, z: 1.92, rot: (x + 0.7) / -0.24 * -1 } });
    move(ctx, { pos: [-2.3, 0.95, 3.05], target: [-2.45, 0.62, 1.1], fov: 44 }, { pos: [-2.32, 0.92, 2.9], target: [-2.45, 0.62, 1.1], fov: 44 });
    shadowAt(ctx, [-2.45, 0.5, 1.4], 3);
  } },
  // 8. "DAD!"  the bathroom door, open a crack: only YOU's head pokes out, yelling.
  s08: { update(ctx) {
    const t = ctx.t, you = youPeek(ctx), p = you.p, d = ctx.ev('dad');
    face(you, 'wide', 'worried', 'tight'); p.lookAt = [0, 1.3, 2.6];
    if (t > d - 0.03 && t < d + 0.85) { face(you, 'squeeze', 'worried', 'scream'); p.headPitch = 0.15; }
    move(ctx, { pos: [2.75, 1.55, 1.0], target: [4.1, 1.5, 1.2], fov: 38 }, { pos: [2.85, 1.55, 1.02], target: [4.1, 1.52, 1.2], fov: 38 });
    punch(ctx, d, 1.08, 0.08); shake(ctx, d, d + 0.7, 0.008, 24);
    shadowAt(ctx, [4.0, 1.2, 1.2], 2.5);
  } },
  // 9. "No."  Dad on the couch behind his newspaper. Doesn't even look up.
  s09: { update(ctx) {
    const t = ctx.t, dad = dadOnCouch(ctx, { paperY: 0.78, paperDown: 0.25 }), n = ctx.ev('no');
    face(dad, 'squint', 'neutral', 'neutral'); dad.p.glassesLow = 0.4;
    if (t > n && t < n + 0.38) dad.p.talk = 0.55;
    move(ctx, { pos: [-1.32, 1.36, 2.1], target: [-1.32, 1.1, 3.3], fov: 40 }, { pos: [-1.32, 1.35, 2.2], target: [-1.32, 1.1, 3.3], fov: 40 });
    shadowAt(ctx, [-1.32, 1.0, 3.2], 2.5);
  } },
  // 10. "UNCLE!"  closer on the head poking out of the door.
  s10: { update(ctx) {
    const t = ctx.t, you = youPeek(ctx, { lean: 0.46 }), p = you.p, d = ctx.ev('uncle');
    face(you, 'wide', 'worried', 'tight'); p.lookAt = [0.8, 1.5, 2.4];
    if (t > d - 0.03 && t < d + 0.7) { face(you, 'squeeze', 'angry', 'scream'); p.headPitch = 0.12; p.red = 0.4; }
    move(ctx, { pos: [3.1, 1.6, 1.12], target: [4.12, 1.56, 1.22], fov: 36 }, { pos: [3.2, 1.6, 1.13], target: [4.12, 1.56, 1.22], fov: 36 });
    punch(ctx, d, 1.1, 0.08); shake(ctx, d, d + 0.6, 0.01, 24);
    shadowAt(ctx, [4.0, 1.4, 1.2], 2);
  } },
  // 11. "No."  Uncle with cake, mouth full, shakes his head.
  s11: { update(ctx) {
    const t = ctx.t, n = ctx.ev('no'), cam = [0.25, 1.62, 1.3];
    const un = uncleAt(ctx, [0.95, 2.45], toward([0.95, 2.45], [cam[0], cam[2]]) + 0.25), p = un.p;
    p.lookAt = [cam[0] - 0.3, 1.6, cam[2]];
    if (t > n - 0.05) { p.headYaw = 0.35 * Math.sin((t - n) * 18) * Math.exp(-(t - n) * 1.5); face(un, 'squint', 'angry', 'chew'); p.cheeks = 0.9; }
    move(ctx, { pos: cam, target: [0.95, 1.5, 2.45], fov: 38 }, { pos: [cam[0] + 0.06, cam[1], cam[2] + 0.1], target: [0.95, 1.5, 2.45], fov: 38 });
    shadowAt(ctx, [0.95, 1.2, 2.45], 2.5);
  } },
  // 12. "Grandma pretends to sleep."  eyes squeezed shut, fake snore (Zzz); one peek, then shut again.
  s12: { update(ctx) {
    const t = ctx.t, g = grandmaInChair(ctx), p = g.p;
    face(g, 'squeeze', 'raised', 'o'); p.headPitch = 0.12; p.headRoll = 0.15; p.glasses = 'up';
    const pk = ctx.ev('sleep') - 0.1;
    if (t > pk && t < pk + 0.32) { face(g, 'open', 'neutral', 'tight'); p.pupils = [0.9, 0]; }
    p.bellyWobble = 0.3;
    const A = HOUSE.armchair, fwd = [Math.sin(A.rotY), Math.cos(A.rotY)];
    ctx.W.fx.badge({ text: 'Zzz', at: () => v3(GRANDMA(ctx).head.getWorldPosition(v3())).add(v3(0.1, 0.22, -0.05)), t0: ctx.shot.t0 + 0.12, size: 0.1, roll: 0.1 });
    const cp = [A.pos[0] + fwd[0] * 1.25, 1.12, A.pos[1] + fwd[1] * 1.25];
    move(ctx, { pos: cp, target: [A.pos[0], 0.98, A.pos[1]], fov: 40 }, { pos: [cp[0] - fwd[0] * 0.12, cp[1], cp[2] - fwd[1] * 0.12], target: [A.pos[0], 0.98, A.pos[1]], fov: 40 });
    shadowAt(ctx, [A.pos[0], 0.9, A.pos[1]], 2.5);
  } },
};
