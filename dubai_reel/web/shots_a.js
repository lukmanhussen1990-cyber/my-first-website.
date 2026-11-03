// Shots 1-21: the stinky bathroom door, YOU on the toilet (chest-up only), the deep breath, "MOM! I'M DOOONE!", Mom with
// the mug, the doorbell, the rich aunty from Dubai (slow motion), the mug drop, Mom runs, "You.", 10 minutes, "MOM!",
// Mom laughing with Aunty, the pressure cooker.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, MOM, AUNTY, GRANDPA, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, onToilet, yell, HOUSE } from './shotlib.js';

export const D = HOUSE.door, FD = HOUSE.front, K = HOUSE.kitchen, R = HOUSE.room;
export const H = (ctx) => ctx.W.cast.helpers;
export const GOLD = (ctx, at, t0, i = 0, size = 0.05) => ctx.W.fx.glint({ at, t0, size, seed: i * 3, color: '#ffd040', glow: '#fff0a0' });
export const SOFA = { aunty: [HOUSE.couch.seats[2], 3.32], mom: [HOUSE.couch.seats[1], 3.32] };
const TOILET_CAM = (k = 0) => ({ pos: [5.32 + k, 1.31, 0.94], target: [6.18, 1.22, 0.9], fov: 42 });

// ---------------------------------------------------------------- people
export function youSit(ctx, mood = 'relaxed') {
  const you = YOU(ctx), p = onToilet(ctx, you);
  if (mood === 'relaxed') face(you, 'closed', 'raised', 'smile');
  else face(you, 'open', 'worried', 'tight');
  return you;
}
export function momAt(ctx, pos, rotY, o = {}) {
  const m = MOM(ctx), p = show(m, pos, rotY, 0), P = PROPS(ctx);
  face(m, 'squint', 'sad', 'tight');                        // tired
  if (o.mug !== false) { P.mug.p = { ...P.mug.p, visible: true, pos: L(m, -0.17, 0.98, 0.28), rot: [0, rotY + Math.PI / 2, 0] }; p.gripR = { prop: P.mug, pose: 'grip' }; }
  if (o.tissues !== false) { P.tissues.p = { ...P.tissues.p, visible: true, pos: L(m, 0.17, 0.92, 0.24), rot: [0, rotY, 0] }; p.gripL = { prop: P.tissues, pose: 'grip' }; }
  return m;
}
export function auntyAt(ctx, pos, rotY, o = {}) {
  const a = AUNTY(ctx), p = show(a, pos, rotY, o.y || 0), P = PROPS(ctx);
  face(a, 'open', 'raised', 'smile'); p.hairSway = 0.4;
  if (o.bags) { P.bags.p = { ...P.bags.p, visible: true, pos: L(a, 0.26, 0.82, 0.12), rot: [0, rotY + Math.PI / 2, 0] }; p.gripL = { prop: P.bags, pose: 'grip' }; }
  return a;
}
export function sofaPair(ctx) {     // Aunty + Mom on the sofa, Aunty with her tea
  const a = AUNTY(ctx), P = PROPS(ctx);
  const pa = seat(ctx, a, SOFA.aunty, Math.PI, HOUSE.couch.seatY); face(a, 'open', 'raised', 'smile');
  P.cup.p = { ...P.cup.p, visible: true, pos: L(a, -0.1, 0.78, 0.3), rot: [0, 0, 0] }; pa.gripR = { prop: P.cup, pose: 'grip' };
  pa.handL = L(a, 0.15, 0.6, 0.3);
  const m = MOM(ctx), pm = seat(ctx, m, SOFA.mom, Math.PI, HOUSE.couch.seatY); face(m, 'happy', 'raised', 'laugh');
  pm.handL = L(m, 0.12, 0.6, 0.3); pm.handR = L(m, -0.12, 0.6, 0.3);
  return { a, m };
}

export const shots = {
  // 1. "You're thirty years old."  the closed bathroom door, green stink lines rising above it.
  s01: { update(ctx) {
    move(ctx, { pos: [1.6, 1.55, 0.9], target: [4.0, 1.45, 0.92], fov: 46 }, { pos: [1.8, 1.55, 0.9], target: [4.0, 1.45, 0.92], fov: 46 });
    ctx.W.fx.stink({ at: [D.x - 0.08, D.h + 0.05, D.z], amount: 0.8, spread: 0.45, height: 0.5, count: 3 });
    shadowAt(ctx, [3.5, 1.0, 0.9], 3);
  } },
  // 2. closer on the door: stink lines curl out of the gap at the top.
  s02: { update(ctx) {
    move(ctx, { pos: [2.85, 1.75, 0.95], target: [4.0, 1.85, 0.92], fov: 42 }, { pos: [2.95, 1.78, 0.95], target: [4.0, 1.88, 0.92], fov: 42 });
    ctx.W.fx.stink({ at: [D.x - 0.06, D.h + 0.02, D.z], amount: 1.0, spread: 0.4, height: 0.45, count: 4 });
    bump(ctx, ctx.ev('old'), 1.04, 0.2);
    shadowAt(ctx, [3.8, 1.5, 0.9], 2);
  } },
  // 3. "And you just pooped."  YOU on the toilet (chest-up only), totally relaxed.
  s03: { update(ctx) {
    const you = youSit(ctx); you.p.headPitch = 0.12; you.p.lean = -0.04;
    move(ctx, TOILET_CAM(-0.1), TOILET_CAM(0.02));
    shadowAt(ctx, [6.0, 1.0, 0.9], 2.5);
  } },
  // 4. close: a happy little sigh; a small stink line.
  s04: { update(ctx) {
    const t = ctx.t, you = youSit(ctx); you.p.headPitch = 0.16; you.p.headRoll = 0.08 * Math.sin(t * 3);
    move(ctx, { pos: [5.62, 1.32, 0.95], target: [6.18, 1.28, 0.9], fov: 40 }, { pos: [5.66, 1.32, 0.94], target: [6.18, 1.28, 0.9], fov: 40 });
    ctx.W.fx.stink({ at: [6.42, 1.05, 1.3], amount: 0.5, spread: 0.2, height: 0.4, count: 1 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 5. "As usual, you yell..."  deep breath: chest up, cheeks puffed.
  s05: { update(ctx) {
    const t = ctx.t, you = youSit(ctx, 'tense'), p = you.p, k = smooth(clamp((t - ctx.shot.t0) / 0.8));
    face(you, 'open', 'raised', 'pressed'); p.shoulderUp = k; p.cheeks = k; p.lean = -0.08 * k; p.headPitch = 0.1 * k;
    move(ctx, TOILET_CAM(0.05), TOILET_CAM(0.18));
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 6. even closer: he fills up with air.
  s06: { update(ctx) {
    const t = ctx.t, you = youSit(ctx, 'tense'), p = you.p;
    face(you, 'squeeze', 'raised', 'pressed'); p.shoulderUp = 1; p.cheeks = 1; p.red = 0.35 * smooth(clamp((t - ctx.shot.t0) / 0.9)); p.headPitch = 0.12;
    move(ctx, { pos: [5.7, 1.3, 0.92], target: [6.18, 1.3, 0.9], fov: 38 }, { pos: [5.76, 1.3, 0.92], target: [6.18, 1.3, 0.9], fov: 36 });
    shake(ctx, ctx.shot.t1 - 0.4, ctx.shot.t1, 0.002, 30);
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 7. "MOM!"  big yell, motion arcs, screen shake.
  s07: { update(ctx) {
    const you = youSit(ctx, 'tense'), p = you.p, m = ctx.ev('mom');
    face(you, 'squeeze', 'worried', 'scream'); p.headPitch = 0.25; p.shoulderUp = 0.6; p.red = 0.4;
    p.handL = L(you, 0.12, 1.45, 0.18); p.handR = L(you, -0.12, 1.45, 0.18); p.handPoseL = p.handPoseR = 'flat';
    move(ctx, { pos: [5.45, 1.33, 0.93], target: [6.18, 1.32, 0.9], fov: 40 }, { pos: [5.5, 1.33, 0.93], target: [6.18, 1.32, 0.9], fov: 40 });
    punch(ctx, m, 1.12, 0.08); yell(ctx, you, m - 0.03, 0.8, 0.014);
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 8. "I'M DOOONE!"  another angle, low and close.
  s08: { update(ctx) {
    const you = youSit(ctx, 'tense'), p = you.p, t0 = ctx.shot.t0;
    face(you, 'squeeze', 'angry', 'scream'); p.headPitch = 0.3; p.headRoll = -0.1; p.red = 0.5;
    p.handL = L(you, 0.22, 1.3, 0.2); p.handR = L(you, -0.22, 1.3, 0.2); p.handPoseL = p.handPoseR = 'fist';
    move(ctx, { pos: [5.55, 1.05, 1.25], target: [6.18, 1.35, 0.9], fov: 44 }, { pos: [5.6, 1.06, 1.22], target: [6.18, 1.35, 0.9], fov: 44 });
    yell(ctx, you, t0 + 0.05, 1.2, 0.016); punch(ctx, ctx.ev('done'), 1.08, 0.1);
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 9. "Mom comes with the mug."  Mom walks to the bathroom: tired, coffee mug + tissue box.
  s09: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u);
    const m = momAt(ctx, [0, 0], 0), a = [0.2, -0.6], b = [2.75, 0.55];
    H(ctx).go(m, a, b, u * 0.95, 'walk', 0.9); m.p.headPitch = -0.08;
    if ((t * 1.3) % 1 > 0.92) m.p.eyes = 'closed';
    move(ctx, { pos: [3.1, 1.45, -1.2], target: [1.3, 1.1, 0.1], fov: 44 }, { pos: [3.2, 1.45, -1.05], target: [2.2, 1.15, 0.35], fov: 44 });
    momAt(ctx, m.p.pos, m.p.rotY);
    shadowAt(ctx, [1.6, 1.0, 0.0], 4);
  } },
  // 10. "Then the doorbell rings."  close-up: a gold-ringed finger presses the doorbell (outside).
  s10: { update(ctx) {
    const t = ctx.t, r = ctx.ev('rings'), bz = FD.z + FD.w / 2 + 0.16;
    const a = auntyAt(ctx, [R.x0 - 0.62, bz + 0.18], Math.PI / 2 - 0.3), p = a.p;
    const press = win(t, r - 0.18, r + 0.35, 0.1, 0.12);
    p.handR = [R.x0 - 0.17 - 0.05 * (1 - press), 1.33, bz]; p.handPoseR = 'point';
    setState(ctx, { bellPress: press });
    move(ctx, { pos: [R.x0 - 0.42, 1.4, bz + 0.34], target: [R.x0 - 0.14, 1.33, bz], fov: 34 }, { pos: [R.x0 - 0.4, 1.39, bz + 0.3], target: [R.x0 - 0.14, 1.33, bz], fov: 30 });
    if (t > r) { GOLD(ctx, [R.x0 - 0.2, 1.4, bz - 0.03], r, 1, 0.04); ctx.W.fx.notes({ at: [R.x0 - 0.3, 1.5, bz - 0.05], count: 2, amount: 0.8, t0: r }); }
    shadowAt(ctx, [R.x0 - 0.3, 1.3, bz], 2);
  } },
  // 11. "It's your rich aunty."  slow motion: the front door opens - light, gold sparkles, Aunty with bags.
  s11: { update(ctx) {
    const t = ctx.t, u = clamp(ctx.u), k = smooth(clamp(u * 1.4));
    setState(ctx, { frontOpen: k * 0.95, doorLight: k });
    const a = auntyAt(ctx, [R.x0 - 0.75, FD.z], Math.PI / 2, { bags: true }); face(a, 'open', 'raised', 'grin'); a.p.hairSway = 1.5;
    a.p.handR = L(a, -0.2, 1.05, 0.15); a.p.handPoseR = 'relaxed';
    ctx.W.fx.glow({ at: [R.x0 - 1.4, 1.4, FD.z], size: 3.2, amount: k, color: '#fff4d0' });
    for (let i = 0; i < 9; i++) GOLD(ctx, [R.x0 - 0.7 + Math.cos(i * 2.2) * 0.45, 1.1 + Math.sin(i * 1.7) * 0.6, FD.z + Math.sin(i * 2.9) * 0.45], ctx.shot.t0 + 0.15 + i * 0.12, i, 0.05);
    ctx.post.tint = 0.1; ctx.post.tintColor = [1.0, 0.9, 0.6];
    move(ctx, { pos: [-2.2, 1.35, -1.55], target: [-4.6, 1.35, -1.75], fov: 44 }, { pos: [-2.45, 1.36, -1.6], target: [-4.6, 1.38, -1.75], fov: 42 });
    shadowAt(ctx, [-4.0, 1.0, -1.75], 3);
  } },
  // 12. "From Dubai."  close-up: huge sunglasses, gold jewellery, gold sparkles; she lowers the sunglasses.
  s12: { update(ctx) {
    const t = ctx.t, dd = ctx.ev('dubai');
    setState(ctx, { frontOpen: 0.95, doorLight: 1 });
    const a = auntyAt(ctx, [R.x0 + 0.15, FD.z], Math.PI / 2, { bags: true }); face(a, 'open', 'raised', 'grin');
    a.p.glassesLow = 0.4 * smooth(clamp((t - dd - 0.1) / 0.3)); a.p.handR = L(a, -0.2, 1.05, 0.15);
    move(ctx, { pos: [-3.45, 1.52, -1.72], target: [R.x0 + 0.15, 1.5, FD.z], fov: 36 }, { pos: [-3.52, 1.52, -1.73], target: [R.x0 + 0.15, 1.5, FD.z], fov: 34 });
    lookCam(ctx, a);
    for (let i = 0; i < 7; i++) GOLD(ctx, () => v3(a.head.getWorldPosition(v3())).add(v3(0.12 * Math.cos(i * 2.4), -0.2 + 0.4 * ((i * 0.37) % 1), 0.12 * Math.sin(i * 2.4))), ctx.shot.t0 + i * 0.1, i, 0.045);
    punch(ctx, dd, 1.06, 0.12);
    shadowAt(ctx, [R.x0 + 0.2, 1.3, FD.z], 2.5);
  } },
  // 13. "Mom drops the mug."  the mug falls in slow motion and splashes.
  s13: { update(ctx) {
    const t = ctx.t, dr = ctx.ev('drops'), hitT = ctx.ev('mug') + 0.05, P = PROPS(ctx);
    const m = momAt(ctx, [2.6, 0.65], -Math.PI / 2 - 0.6, { mug: false }); face(m, 'wide', 'raised', 'o');
    m.p.lookAt = [-4.0, 1.5, -1.75];
    const fall = clamp((t - dr) / (hitT - dr)), y = lerp(0.98, 0.06, fall * fall);
    const hand = L(m, -0.17, 0.98, 0.28);
    P.mug.p = { ...P.mug.p, visible: true, pos: [hand[0], t < dr ? 0.98 : y, hand[2]], rot: [fall * 2.2, 0.4, fall * 0.8] };
    if (t < dr) { m.p.gripR = { prop: P.mug, pose: 'grip' }; } else { m.p.handR = L(m, -0.2, 1.0, 0.3); m.p.handPoseR = 'open'; }
    if (t > hitT) { ctx.W.fx.splinters({ at: [hand[0], 0.05, hand[2]], count: 14, seed: 4, t0: hitT }); ctx.W.fx.dust({ at: [hand[0], 0.03, hand[2]], count: 6, t0: hitT }); }
    move(ctx, { pos: [hand[0] - 0.75, 0.32, hand[2] - 0.55], target: [hand[0], 0.35, hand[2]], fov: 44 }, { pos: [hand[0] - 0.7, 0.3, hand[2] - 0.5], target: [hand[0], 0.3, hand[2]], fov: 42 });
    hit(ctx, hitT, 0.006, 0.2);
    shadowAt(ctx, [2.4, 0.5, 0.5], 2.5);
  } },
  // 14. "And runs."  Mom runs to the front door.
  s14: { update(ctx) {
    const t = ctx.t, u = clamp((t - ctx.shot.t0) / 1.0);
    const m = momAt(ctx, [0, 0], 0, { mug: false, tissues: false }); face(m, 'happy', 'raised', 'grin');
    H(ctx).go(m, [2.3, 0.4], [-2.8, -1.45], easeIn(u), 'run'); m.p.handL = L(m, 0.22, 1.1, 0.25); m.p.handR = L(m, -0.22, 1.1, 0.25);
    move(ctx, { pos: [0.4, 1.3, -2.4], target: [1.6, 1.0, 0.2], fov: 50 }, { pos: [0.2, 1.3, -2.3], target: [-1.2, 1.0, -0.8], fov: 50 }, easeInOut);
    ctx.W.fx.speed({ amount: 0.6, count: 12 });
    shadowAt(ctx, [0.0, 1.0, -0.6], 4);
  } },
  // 15. "She forgot..."  Mom hugs Aunty at the front door, takes her bags; both laughing.
  s15: { update(ctx) {
    const t = ctx.t;
    setState(ctx, { frontOpen: 0.95, doorLight: 0.6 });
    const a = auntyAt(ctx, [-3.55, -1.7], Math.PI / 2, { bags: false }); H(ctx).laugh(a, t, 0.7);
    const m = momAt(ctx, [-3.08, -1.62], -Math.PI / 2, { mug: false, tissues: false }); H(ctx).laugh(m, t, 0.8);
    a.p.handL = L(a, 0.18, 1.25, 0.32); a.p.handR = L(a, -0.18, 1.25, 0.32);
    m.p.handL = L(m, 0.2, 1.2, 0.3); m.p.handR = L(m, -0.2, 1.2, 0.3);
    move(ctx, { pos: [-1.4, 1.5, 0.3], target: [-3.35, 1.2, -1.65], fov: 44 }, { pos: [-1.55, 1.5, 0.15], target: [-3.35, 1.25, -1.65], fov: 42 });
    ctx.W.fx.hearts({ at: [-3.3, 1.9, -1.65], count: 3, size: 0.06 });
    shadowAt(ctx, [-3.3, 1.0, -1.65], 3);
  } },
  // 16. "...one thing."  the bathroom door far at the back of the room, the two laughing in the front.
  s16: { update(ctx) {
    const t = ctx.t;
    setState(ctx, { frontOpen: 0.95, doorLight: 0.4 });
    const a = auntyAt(ctx, [-3.45, -1.25], Math.PI / 2 + 0.6, { bags: false }); H(ctx).laugh(a, t, 0.6);
    const m = momAt(ctx, [-2.95, -1.55], -Math.PI / 2 + 0.6, { mug: false, tissues: false }); H(ctx).laugh(m, t, 0.6);
    move(ctx, { pos: [-3.4, 1.62, -2.5], target: [4.0, 1.2, 0.9], fov: 34 }, { pos: [-3.4, 1.62, -2.5], target: [4.0, 1.2, 0.9], fov: 22 });
    shadowAt(ctx, [0.0, 1.0, 0.0], 6);
  } },
  // 17. "You."  alone on the toilet; slow zoom on his face; a tear.
  s17: { update(ctx) {
    const you = youSit(ctx, 'tense'); face(you, 'puppy', 'sad', 'frown'); you.p.headPitch = -0.05;
    move(ctx, { pos: [5.25, 1.3, 0.92], target: [6.18, 1.25, 0.9], fov: 42 }, { pos: [5.55, 1.3, 0.91], target: [6.18, 1.27, 0.9], fov: 38 });
    ctx.W.fx.cryTears({ ch: you, amount: 0.7, size: 0.8 });
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 18. "Ten minutes."  the wall clock: the minute hand jumps.
  s18: { update(ctx) {
    const t = ctx.t, k = Math.floor(clamp((t - ctx.shot.t0) / 0.9) * 10) / 10;
    setState(ctx, { clockMin: k * Math.PI * 2 * (10 / 60) + 0.4 });
    move(ctx, { pos: [3.0, 2.12, 3.15], target: [3.0, 2.15, 3.8], fov: 40 }, { pos: [3.0, 2.12, 3.25], target: [3.0, 2.15, 3.8], fov: 40 });
    shadowAt(ctx, [3.0, 2.0, 3.6], 2);
  } },
  // 19. "MOM!"  again: yell, arcs, shake.
  s19: { update(ctx) {
    const you = youSit(ctx, 'tense'), p = you.p, m = ctx.ev('mom');
    face(you, 'squeeze', 'angry', 'scream'); p.headPitch = 0.28; p.red = 0.55; p.shoulderUp = 0.7;
    p.handL = L(you, 0.14, 1.42, 0.2); p.handR = L(you, -0.14, 1.42, 0.2); p.handPoseL = p.handPoseR = 'flat';
    move(ctx, { pos: [5.5, 1.3, 0.75], target: [6.18, 1.32, 0.9], fov: 40 }, { pos: [5.56, 1.3, 0.76], target: [6.18, 1.32, 0.9], fov: 40 });
    punch(ctx, m, 1.12, 0.08); yell(ctx, you, m - 0.03, 0.75, 0.014);
    shadowAt(ctx, [6.0, 1.1, 0.9], 2);
  } },
  // 20. "The pressure..."  Mom laughing with Aunty on the sofa: she doesn't hear a thing.
  s20: { update(ctx) {
    const t = ctx.t, { a, m } = sofaPair(ctx);
    H(ctx).laugh(m, t, 0.9); H(ctx).talk(a, t, 1);
    move(ctx, { pos: [-0.25, 1.38, 1.55], target: [-0.25, 1.15, 3.3], fov: 48 }, { pos: [-0.25, 1.38, 1.65], target: [-0.25, 1.15, 3.3], fov: 48 });
    shadowAt(ctx, [-0.3, 1.0, 3.2], 3);
  } },
  // 21. "...cooker is louder."  the pressure cooker whistles, steam shooting up.
  s21: { update(ctx) {
    const t = ctx.t, w = ctx.ev('louder') - 0.25, cx = K.stoveX - 0.14;
    setState(ctx, { whistle: after(t, w, 0.1) });
    if (t > w) ctx.W.fx.steam({ at: [cx, 1.27, K.z], count: 9, size: 0.09, rise: 0.55 });
    move(ctx, { pos: [cx + 0.55, 1.42, K.z - 0.9], target: [cx, 1.15, K.z], fov: 40 }, { pos: [cx + 0.45, 1.4, K.z - 0.75], target: [cx, 1.16, K.z], fov: 38 });
    shake(ctx, w, ctx.shot.t1, 0.004, 30);
    shadowAt(ctx, [cx, 1.0, K.z], 2);
  } },
};
