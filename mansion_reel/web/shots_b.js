// Shots 12-22: "Please.", he points, the very long gold hallway, you run, the 30-button toilet, you press them all,
// the water jet hits the ceiling, the disco ball + music, the seat spins.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3, move, punch, bump, shake, hit, win, after, YOU, RICH, face, show, pose, light, lookCam,
  PORCH_SPOT, DOORWAY_SPOT, HALL, BATH, THRONE, FY, seatYOU, buttonPos, BATH_ROOM, DISCO_AT } from './shotlib.js';
import { L } from './shots_a.js';

const PH = THRONE.platform;
const JET_FROM = [THRONE.pos[0], FY + PH + 0.95, THRONE.pos[1] + 0.3];
const JET_TO = [THRONE.pos[0], BATH.ceilY, THRONE.pos[1] + 0.3];

// water from the toilet: jet + ceiling splash + rain on YOU (amount 0..1, reach 0..1)
export function water(ctx, amount, reach = 1, rain = 1) {
  if (amount <= 0) return;
  ctx.W.fx.jet({ from: JET_FROM, to: JET_TO, amount, reach, width: 0.13 });
  if (reach > 0.97 && rain > 0) ctx.W.fx.rain({ center: [THRONE.pos[0], FY + PH, THRONE.pos[1]], radius: 1.9, height: BATH.ceilY - FY - PH, amount: rain, count: 140, speed: 7, thick: 2.2, len: 1.3 });
}
// the beanie stuck on the ceiling after the jet blasted it up
export const HAT_CEIL = { pos: [THRONE.pos[0] + 0.12, BATH.ceilY - 0.06, THRONE.pos[1] + 0.25], rot: [Math.PI, 0.4, 0] };
// party: disco ball down, coloured beams + spots, music notes
export function party(ctx, drop = 1, notes = 1) {
  const s = ctx.W.set.state; s.disco = drop; s.party = 1;
  ctx.W.fx.disco({ at: DISCO_AT(), amount: drop, room: BATH_ROOM, len: 6 });
  if (notes > 0) ctx.W.fx.notes({ at: [THRONE.pos[0], FY + PH + 0.9, THRONE.pos[1] - 0.2], amount: notes, count: 10, spread: 1.4, rise: 2.0, size: 0.24, t0: 31.7 });
}
// wet YOU on the toilet: drips from nose, chin and hair
export function drips(ctx, you, n = 1) {
  pose(ctx);
  const nose = you.nosePos(), mouth = you.mouthPos(), head = you.headPos();
  ctx.W.fx.drips({ points: [head.clone().add(v3(0.1, -0.03, 0.01)).toArray(), head.clone().add(v3(-0.1, -0.02, 0.0)).toArray(), nose.clone().add(v3(0, -0.025, 0.015)).toArray()].slice(0, Math.max(1, Math.round(3 * n))), every: 0.7, size: 0.013 });
}
const BATH_LIGHT = (ctx, c = [0, FY + PH + 0.8, THRONE.pos[1]], fill = 0.45, o = {}) => light(ctx, c, 3.5, fill, { key: { dir: [0.2, 1, -0.6], color: '#ffe6c2', intensity: 2.1 }, ...o });

export const shots = {
  // 12. "Please."  extreme close-up: huge puppy eyes, hands pressed together under the chin.
  s12: { update(ctx) {
    const you = YOU(ctx), p = show(you, PORCH_SPOT.pos, PORCH_SPOT.rotY, FY);
    const pl = ctx.ev('please');
    face(you, 'open', 'worried', 'tight');
    if (ctx.t > pl - 0.06) { face(you, 'puppy', 'sad', 'pressed'); p.headRoll = 0.1 * after(ctx.t, pl, 0.25); }
    p.handL = L(you, 0.02, 1.47, 0.17); p.handR = L(you, -0.02, 1.47, 0.17); p.handPoseL = p.handPoseR = 'flat';
    p.handRotL = [0, Math.PI, 0]; p.handRotR = [0, Math.PI, 0];
    p.shoulderUp = 0.5; p.headPitch = 0.14;
    move(ctx, { pos: [0.1, FY + 1.62, 100.25], target: [0.15, FY + 1.58, 99.42], fov: 34 }, { pos: [0.11, FY + 1.62, 100.1], target: [0.15, FY + 1.58, 99.42], fov: 32 });
    pose(ctx);
    for (const sd of [-1, 1]) ctx.W.fx.glint({ at: you.eyePos().add(v3(sd * 0.03 + 0.008, 0.012, 0.03)).toArray(), t0: pl + 0.05 + (sd > 0 ? 0.06 : 0), size: 0.03 });
    light(ctx, [0.15, FY + 1.5, 99.4], 2, 0.6, { fillColor: '#ffd8a8', fillDir: [0, 0.3, 1] });
  } },
  // 13. "He points down a hallway."  in the doorway he points back into the house, looking at YOU.
  s13: { update(ctx) {
    const rich = RICH(ctx), p = show(rich, [0.85, 101.0], Math.PI + 0.55, FY);
    face(rich, 'open', 'raised', 'smile');
    const pt = ctx.ev('point'), k = after(ctx.t, pt - 0.18, 0.2);
    p.torsoYaw = 0.25 * k;
    // his left arm sweeps out and points down the hallway (deep into the house)
    p.handL = [lerp(0.55, -0.15, k), FY + lerp(1.0, 1.62, k), lerp(100.8, 101.85, k)]; p.handPoseL = k > 0.4 ? 'point' : 'relaxed';
    p.handR = L(rich, -0.2, 1.0, 0.06); p.handPoseR = 'fist';
    p.lookAt = [PORCH_SPOT.pos[0], FY + 1.6, PORCH_SPOT.pos[1]];
    move(ctx, { pos: [-0.2, FY + 1.6, 98.3], target: [0.45, FY + 1.6, 101.6], fov: 50 }, { pos: [-0.15, FY + 1.6, 98.45], target: [0.45, FY + 1.6, 101.6], fov: 49 });
    bump(ctx, pt, 1.04);
    light(ctx, [0, FY + 1, 101], 3, 0.4, { fillColor: '#ffe2c0' });
  } },
  // 14. "A very long hallway."  dolly-zoom from the doorway: the gold hallway stretches away forever.
  s14: { update(ctx) {
    const lg = ctx.ev('long');
    const k = smooth(clamp((ctx.t - (lg - 0.12)) / 0.75));
    ctx.cam.set({ pos: [0, FY + 1.75, lerp(100.6, 103.8, k) + (ctx.t - ctx.shot.t0) * 0.25], target: [0, FY + 1.65, 150], fov: lerp(30, 82, k) });
    ctx.cam.handheld(0);
    light(ctx, [0, FY + 1, 106], 8, 0.2);
  } },
  // 15. "Made of gold."  slide along the wall: gold bust, gold frames, gold vases, chandeliers, glints.
  s15: { update(ctx) {
    move(ctx, { pos: [-1.55, FY + 1.95, 116.6], target: [2.4, FY + 1.55, 119.8], fov: 50 }, { pos: [-1.5, FY + 2.0, 119.4], target: [2.4, FY + 1.7, 122.4], fov: 50 }, easeInOut);
    const g = ctx.ev('gold');
    const pts = [[2.2, FY + 1.55, 120.3], [2.5, FY + 2.75, 118.3], [2.3, FY + 0.6, 118.9], [0, HALL.ceilY - 1.3, 120.3], [2.5, FY + 2.75, 122.3]];
    pts.forEach((p2, i) => ctx.W.fx.glint({ at: p2, t0: g + i * 0.07, size: i === 3 ? 0.35 : 0.22 }));
    light(ctx, [1.5, FY + 1, 120], 5, 0.3);
  } },
  // 16. "You run."  YOU sprints down the hallway toward the camera, speed lines.
  s16: { update(ctx) {
    const you = YOU(ctx), H = ctx.W.cast.helpers;
    const z0 = 128, z1 = 135.2, u = ctx.u;
    show(you, [0, z0], 0, FY);
    H.go(you, [0, z0], [0, z1], u, 'run');
    face(you, 'wide', 'worried', 'grimace'); you.p.hairBounce = 1;
    const z = lerp(z0, z1, u);
    ctx.cam.set({ pos: [0.25, FY + 1.5, z + 2.55], target: [0.0, FY + 1.3, z - 0.4], fov: 44 });
    ctx.cam.shake(0.012, 9);
    ctx.W.fx.speed({ amount: 1, count: 22, speed: 3.2 });
    ctx.W.fx.sweat({ ch: you, t0: ctx.shot.t0 + 0.1, size: 1.1 });
    light(ctx, [0, FY + 1, z], 4, 0.5);
  } },
  // 17. "The toilet has thirty buttons."  push in on the golden toilet on its platform, the 30 buttons blink.
  s17: { update(ctx) {
    const th = ctx.ev('thirty'), bt = ctx.ev('buttons');
    move(ctx, { pos: [0, FY + 1.55, 183.4], target: [0, FY + 0.95, 190.4], fov: 46 }, { pos: [-0.2, FY + 1.45, 187.7], target: [0.45, FY + 0.95, 190.3], fov: 42 }, easeInOut);
    punch(ctx, bt, 1.12, 0.1);
    ctx.W.set.state.buttons = (i, t) => (t < th ? 0.15 : 0.5 + 0.5 * Math.sin(t * 14 - (i % 5) * 0.9 - Math.floor(i / 5) * 0.5));
    ctx.W.fx.glow({ at: [THRONE.pos[0], FY + PH + 0.9, THRONE.pos[1] + 0.6], size: 3.0, opacity: 0.35, color: '#ffe6a0' });
    for (let i = 0; i < 3; i++) ctx.W.fx.glint({ at: [THRONE.pos[0] + (i - 1) * 0.3, FY + PH + 0.95 + i * 0.12, THRONE.pos[1] - 0.25], t0: th - 0.4 + i * 0.12, size: 0.16 });
    BATH_LIGHT(ctx, [0, FY + PH + 0.5, THRONE.pos[1]], 0.3);
  } },
  // 18. "You don't know which one flushes."  YOU on the throne behind the panel, eyes darting, question marks.
  s18: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx);
    face(you, 'open', 'worried', 'tight');
    const q1 = ctx.ev('q1'), q2 = ctx.ev('q2');
    p.pupils = [Math.sin(ctx.t * 7) > 0 ? 0.8 : -0.8, -0.6];
    p.headPitch = -0.25; p.headYaw = -0.35 + Math.sin(ctx.t * 3.5) * 0.15;
    p.handR = L(you, -0.16, 1.03, 0.25); p.handPoseR = 'point';
    p.handL = L(you, 0.1, 0.86, 0.2);
    ctx.W.set.state.buttons = 0.25;
    move(ctx, { pos: [1.0, FY + PH + 1.2, 189.05], target: [0.15, FY + PH + 1.05, 190.35], fov: 42 }, { pos: [0.92, FY + PH + 1.19, 189.2], target: [0.15, FY + PH + 1.07, 190.35], fov: 40 });
    pose(ctx);
    const top = you.headPos().add(v3(0, 0.22, 0));
    ctx.W.fx.question({ at: top.clone().add(v3(0.12, 0, 0)).toArray(), t0: q1, size: 0.18 });
    ctx.W.fx.question({ at: top.clone().add(v3(-0.14, 0.08, 0)).toArray(), t0: q2, size: 0.15, roll: 0.3 });
    ctx.W.fx.sweat({ ch: you, t0: ctx.shot.t0 + 0.15 });
    BATH_LIGHT(ctx);
  } },
  // 19. "So you press them all."  close on the panel: both hands mash all the buttons, everything lights up.
  s19: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx);
    face(you, 'squeeze', 'angry', 'grimace'); p.leanSide = 0.12; p.lean = 0.12; p.headPitch = -0.3;
    const pr = ctx.ev('press'), al = ctx.ev('all');
    const rate = 9, kk = Math.floor((ctx.t - pr) * rate);
    const pressed = new Set();
    if (ctx.t > pr - 0.12) {
      for (const [side, off] of [['R', 0], ['L', 0.5]]) {
        const k = Math.floor((ctx.t - pr) * rate + off);
        const bi = Math.floor(hash1(k * 3.7 + (side === 'R' ? 1 : 5)) * 30);
        const ph = ((ctx.t - pr) * rate + off) % 1;
        const bp = buttonPos(ctx, bi);
        const lift = Math.sin(ph * Math.PI) * 0.06;
        const tgt = [bp.x + (side === 'L' ? 0.02 : -0.01), bp.y + 0.05 + lift, bp.z];
        if (side === 'R') { p.handR = tgt; p.handPoseR = 'point'; } else { p.handL = tgt; p.handPoseL = 'point'; p.poleL = [-0.3, -0.6, 0.6]; }
        if (ph < 0.5) pressed.add(bi);
      }
    }
    const allOn = ctx.t > al;
    ctx.W.set.state.buttons = (i, t) => (allOn ? 0.6 + 0.4 * Math.sin(t * 30 + i * 1.7) : pressed.has(i) ? 1 : (t > pr && hash1(i * 9.1 + Math.floor(t * 9)) > 0.6 ? 0.8 : 0.1));
    ctx.W.set.state.panelShake = ctx.t > pr ? 1 : 0;
    move(ctx, { pos: [1.15, FY + PH + 1.25, 189.55], target: [0.55, FY + PH + 0.72, 190.3], fov: 42 }, { pos: [1.08, FY + PH + 1.2, 189.65], target: [0.55, FY + PH + 0.74, 190.3], fov: 40 });
    if (ctx.t > pr) ctx.cam.shake(0.005, 18);
    bump(ctx, al, 1.07);
    BATH_LIGHT(ctx, [0.5, FY + PH + 0.7, 190.3], 0.5);
  } },
  // 20. "Water sprays the ceiling."  a huge water jet blasts up behind YOU to the ceiling, the beanie flies off.
  s20: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx);
    const sp = ctx.ev('spray'), ce = ctx.ev('ceiling');
    const reach = clamp((ctx.t - sp) / 0.22);
    face(you, 'wide', 'raised', 'scream'); p.lean = -0.12; p.shoulderUp = 0.8;
    if (ctx.t < sp) face(you, 'squeeze', 'angry', 'grimace');
    p.handL = L(you, 0.3, 1.15, 0.12); p.handR = L(you, -0.3, 1.15, 0.12); p.handPoseL = p.handPoseR = 'open';
    p.wet = clamp((ctx.t - sp - 0.3) / 1.2);
    // the beanie shoots up the jet and sticks to the ceiling
    const hk = clamp((ctx.t - sp - 0.05) / 0.45);
    p.hatOn = ctx.t < sp + 0.05;
    if (!p.hatOn) { const y0 = FY + PH + 1.0; p.hatFly = { pos: [lerp(THRONE.pos[0], HAT_CEIL.pos[0], hk), lerp(y0, HAT_CEIL.pos[1], easeOut(hk)), lerp(THRONE.pos[1], HAT_CEIL.pos[2], hk)], rot: [hk * HAT_CEIL.rot[0] + Math.sin(ctx.t * 20) * 0.3 * (1 - hk), hk * 6, 0] }; }
    water(ctx, 1, reach, clamp((ctx.t - sp - 0.3) / 0.4));
    ctx.cam.set({ pos: [-1.45, FY + 0.75, 187.7], target: [0.1, lerp(FY + 2.0, FY + 2.6, after(ctx.t, ce - 0.2, 0.4)), 190.4], fov: 62 });
    hit(ctx, sp, 0.025, 0.35); hit(ctx, ce, 0.012, 0.25);
    BATH_LIGHT(ctx, [0, FY + PH + 1.5, THRONE.pos[1]], 0.45);
  } },
  // 21. "Music starts playing."  the disco ball drops from the ceiling, coloured lights + music notes; YOU deadpan, soaked.
  s21: { update(ctx) {
    const you = YOU(ctx), p = seatYOU(ctx);
    face(you, 'squint', 'neutral', 'tight'); p.wet = 1; p.hatOn = false; p.hatFly = HAT_CEIL;
    p.headPitch = ctx.t > ctx.ev('music') + 0.3 ? 0.35 : 0.0;
    const m = ctx.ev('music');
    party(ctx, clamp((ctx.t - m) / 0.6), after(ctx.t, m, 0.3));
    water(ctx, 0.75, 1, 0.65);
    drips(ctx, you);
    move(ctx, { pos: [0.05, FY + PH + 0.95, 187.7], target: [0, FY + PH + 1.45, 190.3], fov: 58 }, { pos: [0.05, FY + PH + 0.95, 187.95], target: [0, FY + PH + 1.45, 190.3], fov: 56 });
    BATH_LIGHT(ctx, undefined, 0.35, { exposure: 0.95 });
  } },
  // 22. "The seat spins."  the toilet seat spins YOU around like a turntable, dizzy eyes, stars.
  s22: { update(ctx) {
    const sp = ctx.ev('spin'), tt = Math.max(0, ctx.t - sp);
    const ang = Math.PI * 2 * (1.6 * tt + 0.9 * tt * tt);
    const you = YOU(ctx), p = seatYOU(ctx, ang);
    ctx.W.set.state.seatSpin = ang;
    face(you, tt > 0.35 ? 'dizzy' : 'wide', 'raised', 'open'); p.wet = 1; p.hatOn = false; p.hatFly = HAT_CEIL; p.hairBounce = 1;
    p.handL = L(you, 0.32, 1.05 + Math.sin(ctx.t * 13) * 0.08, 0.1); p.handR = L(you, -0.32, 1.05 + Math.cos(ctx.t * 13) * 0.08, 0.1); p.handPoseL = p.handPoseR = 'open';
    party(ctx, 1, 1);
    water(ctx, 0.5, 1, 0.5);
    move(ctx, { pos: [0.0, FY + PH + 1.12, 188.0], target: [0, FY + PH + 0.95, 190.35], fov: 52 }, { pos: [0.0, FY + PH + 1.1, 188.25], target: [0, FY + PH + 0.95, 190.35], fov: 50 });
    if (tt > 0) ctx.cam.shake(0.006, 14);
    pose(ctx);
    if (tt > 0.3) ctx.W.fx.stars({ at: you.headPos().add(v3(0, 0.2, 0)).toArray(), count: 4, radius: 0.17, size: 0.07 });
    BATH_LIGHT(ctx, undefined, 0.35, { exposure: 0.95 });
  } },
};
