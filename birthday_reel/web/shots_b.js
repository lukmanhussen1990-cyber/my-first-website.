// Shots 13-24: the birthday boy knocks, "I'll teach you.", the fact (void: roll + AGE 5), the sunglasses (1 YEAR),
// "Four squares. / Fold. / Wipe.", 10 MINUTES LATER, the hero exit, "He's six." (hand out), the $5.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, MOM, DAD, UNCLE, GRANDMA, KID, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, HOUSE, VOID } from './shotlib.js';
import { dadOnCouch, uncleAt, grandmaInChair, kidAt } from './shots_a.js';

const VX = VOID.origin[0];
const DOOR = HOUSE.door;
const KD = HOUSE.kidAtDoor.pos;                  // [3.38, 1.02], facing the door (+X)
const OUT = [3.62, 0.92];                         // YOU after stepping out
const KOUT = [3.0, 0.8];                          // the kid waiting in front of him
const H = (ctx) => ctx.W.cast.helpers;

// the kid at the door, holding the roll in his left hand (coach)
function kidCoach(ctx, o = {}) {
  const k = kidAt(ctx, KD, o.rotY ?? Math.PI / 2, o), p = k.p, P = PROPS(ctx);
  if (o.roll !== false) {
    const rp = L(k, 0.16, o.rollY ?? 0.86, 0.2);
    P.roll.p = { ...P.roll.p, visible: true, pos: rp, rot: [0, p.rotY, 0], scale: 0.9 };
    p.gripL = { prop: P.roll, pose: 'grip' };
  }
  return k;
}
function family(ctx) {        // everyone gathered in front of the bathroom door (10 minutes later / the exit)
  const dad = DAD(ctx), g = GRANDMA(ctx);
  show(dad, [2.55, 1.85], toward([2.55, 1.85], [DOOR.x, DOOR.z]), 0); face(dad, 'open', 'neutral', 'tight');
  dad.p.handL = L(dad, 0.08, 1.05, 0.22); dad.p.handR = L(dad, -0.08, 1.02, 0.24);
  const un = uncleAt(ctx, [2.35, 0.05], toward([2.35, 0.05], [DOOR.x, DOOR.z]));
  show(g, [2.2, 1.0], toward([2.2, 1.0], [DOOR.x, DOOR.z]), 0); face(g, 'open', 'worried', 'tight');
  g.p.handL = L(g, 0.06, 1.0, 0.18); g.p.handR = L(g, -0.06, 1.0, 0.18);
  return { dad, un, g };
}

export const shots = {
  // 13. "Then the birthday boy knocks."  low angle: he walks up to the bathroom door and knocks twice.
  s13: { update(ctx) {
    const t = ctx.t, kn = ctx.ev('knocks'), a = [2.35, 0.75];
    const k = kidAt(ctx, KD, Math.PI / 2), p = k.p;
    const u = clamp((t - ctx.shot.t0) / (kn - 0.2 - ctx.shot.t0));
    if (u < 1) H(ctx).go(k, a, KD, easeOut(u), 'walk');
    else { p.gait = null; p.pos = KD.slice(); p.rotY = Math.PI / 2; }
    face(k, 'open', 'angry', 'tight');
    if (t > kn - 0.25 && t < kn + 0.5) {
      const w = Math.max(win(t, kn - 0.1, kn + 0.06, 0.08, 0.05), win(t, kn + 0.1, kn + 0.26, 0.08, 0.05));
      p.handR = L(k, -0.06, 0.95, lerp(0.3, 0.52, w)); p.handPoseR = 'fist';
    }
    move(ctx, { pos: [2.05, 0.62, 0.05], target: [3.9, 0.95, 1.05], fov: 46 }, { pos: [2.3, 0.64, 0.15], target: [3.95, 0.97, 1.05], fov: 46 });
    hit(ctx, kn, 0.004, 0.1); hit(ctx, kn + 0.2, 0.004, 0.1);
    setState(ctx, { doorShake: win(t, kn, kn + 0.32, 0.02, 0.05) * 0.4 });
    shadowAt(ctx, [3.3, 0.6, 1.0], 2.5);
  } },
  // 14. "I'll teach you."  low hero angle on the birthday boy, serious.
  s14: { update(ctx) {
    const t = ctx.t, cam = [3.82, 0.62, 0.52];
    const k = kidAt(ctx, KD, toward(KD, [cam[0], cam[2]]) - 0.35), p = k.p;
    move(ctx, { pos: cam, target: [KD[0], 0.95, KD[1]], fov: 42 }, { pos: [cam[0] - 0.08, cam[1], cam[2] + 0.06], target: [KD[0], 0.98, KD[1]], fov: 42 });
    face(k, 'squint', 'angry', 'tight'); lookCam(ctx, k); p.headPitch = -0.05;
    if (t > ctx.ev('teach') - 0.25 && t < ctx.ev('teach') + 0.7) H(ctx).talk(k, t, 0.9);
    p.handL = L(k, 0.15, 0.6, 0.05); p.handR = L(k, -0.15, 0.6, 0.05); p.handPoseL = p.handPoseR = 'fist';
    ctx.W.fx.glint({ at: () => v3(KID(ctx).head.getWorldPosition(v3())).add(v3(0.0, 0.17, 0)), size: 0.07, t0: ctx.shot.t0 + 0.2 });
    shadowAt(ctx, [KD[0], 0.6, KD[1]], 2);
  } },
  // 15. "What you don't know:"  void: a toilet paper roll spinning slowly in a spotlight.
  s15: { update(ctx) {
    const t = ctx.t, P = PROPS(ctx);
    setState(ctx, { voidShow: 'none', exposure: 1.25 });
    P.roll.p = { ...P.roll.p, visible: true, pos: VOID.roll.slice(), rot: [0.25, t * 1.6, 0.15], scale: 2.2 };
    ctx.W.fx.glow({ at: [VX, 1.55, 0.35], size: 1.8, amount: 0.9, color: '#9ec8ff' });
    for (let i = 0; i < 4; i++) ctx.W.fx.glint({ at: [VX + Math.cos(i * 1.7) * 0.4, 1.55 + Math.sin(i * 2.2) * 0.32, -0.15], size: 0.05, seed: i * 7 });
    move(ctx, { pos: [VX, 1.6, -1.25], target: [VX, 1.55, 0], fov: 40 }, { pos: [VX, 1.6, -1.05], target: [VX, 1.55, 0], fov: 40 });
    shadowAt(ctx, [VX, 1.5, 0], 2);
  } },
  // 16. "most kids learn to wipe by themselves by age five."  void: the kid proudly holds up a roll; AGE 5 pops.
  s16: { update(ctx) {
    const t = ctx.t, P = PROPS(ctx), k = kidAt(ctx, [VX + 0.15, 0.05], Math.PI - 0.2), p = k.p, f = ctx.ev('five');
    setState(ctx, { voidShow: 'none', exposure: 1.25 });
    const up = easeOutBack(clamp((t - ctx.ev('kids') + 0.1) / 0.35), 1.5);
    const rp = L(k, -0.12, lerp(0.75, 1.32, up), 0.18);
    P.roll.p = { ...P.roll.p, visible: true, pos: rp, rot: [0, p.rotY, 0], scale: 0.9 };
    p.gripR = { prop: P.roll, pose: 'grip' }; p.handL = L(k, 0.14, 0.62, 0.05); p.handPoseL = 'fist';
    move(ctx, { pos: [VX - 0.05, 1.05, -1.85], target: [VX, 0.95, 0], fov: 40 }, { pos: [VX - 0.05, 1.05, -1.6], target: [VX, 0.98, 0], fov: 40 });
    face(k, 'happy', 'raised', 'grin'); lookCam(ctx, k);
    ctx.W.fx.badge({ text: 'AGE 5', at: [VX - 0.32, 1.38, -0.15], t0: f - 0.05, size: 0.11, roll: -0.05 });
    if (t > f - 0.05) ctx.W.fx.stars({ at: [VX - 0.32, 1.38, -0.15], count: 6, radius: 0.22, size: 0.05 });
    ctx.W.fx.glow({ at: [VX, 1.0, 0.45], size: 2.4, amount: 0.8, color: '#ffe0a0' });
    punch(ctx, f, 1.08, 0.1);
    shadowAt(ctx, [VX, 0.8, 0], 2);
  } },
  // 17. "He has one year of experience."  at the door he slides on tiny sunglasses: a pro. Badge 1 YEAR.
  s17: { update(ctx) {
    const t = ctx.t, e = ctx.ev('experience'), one = ctx.ev('one');
    const k = kidCoach(ctx, { glasses: t > e - 0.15 ? 'on' : 'up', rotY: toward(KD, [2.9, 0.45]) + 0.3 }), p = k.p;
    move(ctx, { pos: [2.85, 1.02, 0.42], target: [KD[0], 0.98, KD[1]], fov: 40 }, { pos: [2.95, 1.0, 0.48], target: [KD[0], 0.98, KD[1]], fov: 40 });
    face(k, 'squint', 'neutral', 'tight'); lookCam(ctx, k);
    if (win(t, e - 0.45, e - 0.05, 0.12, 0.12) > 0) { p.handR = L(k, -0.04, 1.03, 0.14); p.handPoseR = 'point'; }
    if (t > e) face(k, 'open', 'neutral', 'smile');
    ctx.W.fx.badge({ text: '1 YEAR', at: [KD[0] - 0.18, 1.35, KD[1] - 0.32], t0: one, size: 0.085, roll: 0.06 });
    ctx.W.fx.glint({ at: () => v3(KID(ctx).head.getWorldPosition(v3())).add(v3(-0.06, 0.03, -0.06)), size: 0.06, t0: e + 0.05 });
    shadowAt(ctx, [KD[0], 0.6, KD[1]], 2);
  } },
  // 18. "Four squares."  he coaches through the door, roll up in one hand, pointing with the other.
  s18: { update(ctx) {
    const t = ctx.t, k = kidCoach(ctx, { glasses: 'on', rollY: 1.0 }), p = k.p;
    face(k, 'open', 'angry', 'tight'); H(ctx).talk(k, t, 1.0);
    p.handR = L(k, -0.1, 0.98, 0.38); p.handPoseR = 'point';
    p.lookAt = [DOOR.x, 1.0, DOOR.z];
    move(ctx, { pos: [2.62, 1.08, -0.05], target: [3.75, 0.95, 1.0], fov: 44 }, { pos: [2.75, 1.06, 0.02], target: [3.75, 0.95, 1.0], fov: 44 });
    shadowAt(ctx, [3.5, 0.7, 1.0], 2.5);
  } },
  // 19. "Fold."  the family watches, frozen: Dad lowers his paper, Uncle stops chewing, Grandma's eyes open.
  s19: { update(ctx) {
    const dad = dadOnCouch(ctx, { paperDown: 1 }); face(dad, 'wide', 'raised', 'tight'); dad.p.lookAt = [DOOR.x, 1.0, DOOR.z];
    const un = uncleAt(ctx, [0.95, 2.45], toward([0.95, 2.45], [DOOR.x, DOOR.z])); face(un, 'wide', 'raised', 'tight'); un.p.cheeks = 0.9; un.p.lookAt = [DOOR.x, 1.0, DOOR.z];
    const g = grandmaInChair(ctx); face(g, 'wide', 'raised', 'o'); g.p.lookAt = [DOOR.x, 1.0, DOOR.z];
    move(ctx, { pos: [3.6, 1.55, -1.55], target: [0.6, 0.98, 3.0], fov: 50 }, { pos: [3.5, 1.55, -1.4], target: [0.6, 0.98, 3.0], fov: 50 });
    bump(ctx, ctx.ev('fold'), 1.05, 0.2);
    shadowAt(ctx, [0.5, 0.9, 2.8], 4);
  } },
  // 20. "Wipe."  the bathroom door shakes; the kid nods like a coach.
  s20: { update(ctx) {
    const t = ctx.t, w = ctx.ev('wipe'), k = kidCoach(ctx, { glasses: 'on', rollY: 0.9 }), p = k.p;
    face(k, 'open', 'angry', 'tight'); if (t < w + 0.5) H(ctx).talk(k, t, 1.0);
    p.headPitch = t > w ? 0.12 * Math.sin((t - w) * 14) : 0; p.lookAt = [DOOR.x, 1.0, DOOR.z];
    p.handR = L(k, -0.12, 0.7, 0.18); p.handPoseR = 'fist';
    setState(ctx, { doorShake: win(t, w + 0.05, ctx.shot.t1, 0.05, 0.05) });
    move(ctx, { pos: [2.5, 1.2, 0.3], target: [3.95, 1.1, 0.95], fov: 44 }, { pos: [2.62, 1.2, 0.35], target: [3.95, 1.1, 0.95], fov: 44 });
    hit(ctx, w + 0.05, 0.004, 0.4);
    if (t > w + 0.1) ctx.W.fx.stink({ at: [DOOR.x - 0.1, 2.05, DOOR.z], amount: 0.55, spread: 0.35, height: 0.35, count: 2 });
    shadowAt(ctx, [3.6, 0.8, 1.0], 2.5);
  } },
  // 21. "Ten minutes later..."  everyone waits in front of the door; the clock spins. Label 10 MINUTES LATER.
  s21: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u);
    const fam = family(ctx);
    const k = kidAt(ctx, KOUT, toward(KOUT, [DOOR.x, DOOR.z]), { glasses: 'on' }); face(k, 'open', 'neutral', 'tight');
    k.p.handL = L(k, 0.12, 0.62, 0.1); k.p.handR = L(k, -0.12, 0.62, 0.1);
    if ((t * 3) % 1 > 0.92) for (const ch of [fam.dad, fam.un, fam.g]) ch.p.eyes = 'closed';
    fam.un.p.mouth = 'tight'; fam.un.p.cheeks = 0.2;
    setState(ctx, { clockMin: u * Math.PI * 2 * 1.6 });
    ctx.W.fx.sweat({ ch: fam.g, t0: ctx.shot.t0 + 0.4, size: 0.8 });
    move(ctx, { pos: [0.75, 1.55, 0.05], target: [3.6, 1.15, 1.05], fov: 48 }, { pos: [0.9, 1.55, 0.1], target: [3.6, 1.15, 1.05], fov: 48 });
    shadowAt(ctx, [2.8, 0.8, 1.0], 3);
  } },
  // 22. "You did it."  the door swings open; YOU steps out like a hero, golden light, sparkles; everyone cheers.
  s22: { update(ctx) {
    const t = ctx.t, d = ctx.ev('did'), t0 = ctx.shot.t0;
    const op = easeOut(clamp((t - t0) / 0.22));
    setState(ctx, { doorOpen: op, heroGlow: op, bathLight: 1.4 });
    const you = YOU(ctx), stp = easeOut(clamp((t - t0 - 0.08) / 0.5));
    const p = show(you, OUT, -Math.PI / 2, 0);
    if (stp < 1) H(ctx).go(you, [4.55, DOOR.z], OUT, stp, 'walk');
    p.rotY = -Math.PI / 2;
    face(you, 'happy', 'raised', 'grin'); p.headPitch = 0.14; p.lean = -0.06;
    p.handL = L(you, 0.24, 0.98, -0.02); p.handR = L(you, -0.24, 0.98, -0.02); p.handPoseL = p.handPoseR = 'fist';
    const fam = family(ctx);
    for (const ch of [fam.dad, fam.un, fam.g]) { H(ctx).laugh(ch, t, 0.8); ch.p.lookAt = L(you, 0, 1.6, 0); }
    fam.dad.p.handL = L(fam.dad, 0.2, 1.95, 0.1); fam.dad.p.handR = L(fam.dad, -0.2, 1.95, 0.1); fam.dad.p.handPoseL = fam.dad.p.handPoseR = 'fist';
    const k = kidAt(ctx, KOUT, toward(KOUT, OUT), { glasses: 'on' }); face(k, 'open', 'neutral', 'smile'); k.p.lookAt = L(you, 0, 1.6, 0);
    const clap = Math.sin(t * 13) > 0 ? 0.04 : 0.1;
    k.p.handL = L(k, clap, 0.72, 0.24); k.p.handR = L(k, -clap, 0.72, 0.24);
    ctx.W.fx.glow({ at: [DOOR.x + 0.4, 1.4, DOOR.z], size: 3.0, amount: op, color: '#fff0b0' });
    for (let i = 0; i < 7; i++) ctx.W.fx.glint({ at: [OUT[0] + Math.cos(i * 1.7) * 0.45, 1.2 + Math.sin(i * 2.1) * 0.6, OUT[1] + Math.sin(i * 1.3) * 0.4], size: 0.06, seed: i * 5, t0: t0 + 0.15 + i * 0.04 });
    move(ctx, { pos: [1.45, 1.25, 0.3], target: [3.75, 1.35, 0.95], fov: 46 }, { pos: [1.6, 1.22, 0.33], target: [3.75, 1.38, 0.95], fov: 46 });
    punch(ctx, d, 1.06, 0.15);
    shadowAt(ctx, [3.0, 1.0, 0.9], 3);
  } },
  // 23. "He's six."  the kid holds out his hand, palm up, looking up at YOU.
  s23: { update(ctx) {
    const t = ctx.t, you = YOU(ctx);
    show(you, OUT, -Math.PI / 2 - 0.25, 0); face(you, 'open', 'raised', 'smile');
    const kp0 = [OUT[0] - 0.52, OUT[1] - 0.06];
    const k = kidAt(ctx, kp0, toward(kp0, OUT), { glasses: 'on' }), p = k.p;
    face(k, 'open', 'neutral', 'tight'); p.lookAt = L(you, 0, 1.62, 0);
    const out = easeOut(clamp((t - ctx.shot.t0 - 0.05) / 0.25));
    p.handR = L(k, -0.08, lerp(0.55, 0.78, out), lerp(0.08, 0.33, out)); p.handPoseR = 'open';
    you.p.lookAt = L(k, 0, 0.9, 0.2);
    you.p.handL = L(you, 0.2, 0.9, 0.05); you.p.handR = L(you, -0.2, 0.9, 0.05);
    if (t > ctx.ev('six')) face(you, 'open', 'worried', 'tight');
    move(ctx, { pos: [3.36, 1.3, -1.25], target: [3.36, 1.12, 0.88], fov: 46 }, { pos: [3.36, 1.28, -1.1], target: [3.36, 1.12, 0.88], fov: 46 });
    shadowAt(ctx, [3.3, 0.8, 0.9], 2.5);
  } },
  // 24. "He charges five dollars."  YOU pays him a $5 bill; the kid snaps it, sunglasses, ka-ching. Hold.
  s24: { update(ctx) {
    const t = ctx.t, c = ctx.ev('charges'), dl = ctx.ev('dollars'), P = PROPS(ctx), you = YOU(ctx);
    show(you, OUT, -Math.PI / 2 - 0.25, 0); const yp = you.p;
    const kp0 = [OUT[0] - 0.52, OUT[1] - 0.06];
    const k = kidAt(ctx, kp0, toward(kp0, OUT), { glasses: 'on' }), p = k.p;
    face(you, 'squint', 'sad', 'frown'); yp.lookAt = L(k, 0, 0.9, 0.2);
    face(k, 'open', 'neutral', 'tight'); p.lookAt = L(you, 0, 1.62, 0);
    // the bill: in YOU's hand -> laid in the kid's palm (at 'charges') -> the kid snaps it up (at 'dollars')
    const give = easeInOut(clamp((t - (c - 0.25)) / 0.45));
    const kidHand = L(k, -0.08, 0.8, 0.33), youHand = L(you, -0.12, 1.02, 0.3);
    yp.handL = L(you, 0.2, 0.9, 0.05);
    if (t < dl) {
      const bp = [lerp(youHand[0], kidHand[0], give), lerp(youHand[1], kidHand[1] + 0.02, give), lerp(youHand[2], kidHand[2], give)];
      P.bill.p = { ...P.bill.p, visible: true, pos: bp, rot: [-Math.PI / 2 + 0.2, p.rotY, 0] };
      if (give < 0.95) yp.gripR = { prop: P.bill, pose: 'grip' }; else yp.handR = L(you, -0.2, 0.9, 0.05);
      p.handR = kidHand; p.handPoseR = 'open';
    } else {
      const sn = easeOutBack(clamp((t - dl) / 0.22), 2);
      P.bill.p = { ...P.bill.p, visible: true, pos: L(k, -0.1, lerp(0.82, 1.1, sn), lerp(0.33, 0.22, sn)), rot: [lerp(-1.37, 0, sn), p.rotY + Math.PI, 0] };
      p.gripR = { prop: P.bill, pose: 'grip' };
      face(k, 'open', 'raised', 'smile');
      yp.handR = L(you, -0.2, 0.9, 0.05);
    }
    ctx.W.fx.badge({ text: '$5', at: [kp0[0] - 0.05, 1.32, kp0[1] - 0.28], t0: dl, size: 0.1, roll: -0.08 });
    ctx.W.fx.glint({ at: () => v3(P.bill.position).add(v3(0, 0.05, -0.05)), size: 0.07, t0: dl + 0.05 });
    ctx.W.fx.glint({ at: () => v3(KID(ctx).head.getWorldPosition(v3())).add(v3(-0.07, 0.03, -0.05)), size: 0.06, t0: dl + 0.35 });
    move(ctx, { pos: [3.36, 1.3, -1.35], target: [3.36, 1.12, 0.88], fov: 46 }, { pos: [3.36, 1.26, -1.15], target: [3.36, 1.1, 0.88], fov: 45 });
    punch(ctx, dl, 1.06, 0.1);
    shadowAt(ctx, [3.3, 0.8, 0.9], 2.5);
  } },
};
