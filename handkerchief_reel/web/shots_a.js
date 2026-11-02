// Shots 1-12: the bush, the leaf + bus ticket, the limo, the golden wheel, the door, the red heel, fur + diamonds,
// the bodyguard panics, "Ma'am... what are you doing?", "Shut up.", the boop.
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3, move, punch, bump, shake, hit, win, after,
  YOU, LADY, GUARD, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, inBush, STREET } from './shotlib.js';

export const BUSH = STREET.bush.pos;                        // [2.0, -2.2]
export const BUSH_Y = -0.3;                                 // YOU's root y while crouching in the bush (head + shoulders out)
export const PARK = STREET.limo.parkedX;                    // limo centre x when parked (-0.75)
export const REAR = STREET.ladyOut.pos;                     // her step-out point [-1.3, -3.05]
export const GOUT = STREET.guardOut.pos;                    // bodyguard [1.5, -3.0]
export const ATBUSH = [2.0, -3.15];                         // the lady in front of the bush (road side), facing +Z
const SY = STREET.sideY;

// YOU in the street bush, facing the road (-Z); nervous glances
export function youInBush(ctx, o = {}) {
  const you = YOU(ctx);
  inBush(ctx, you, BUSH, Math.PI + (o.yaw || 0), BUSH_Y);
  face(you, 'open', 'worried', 'tight');
  return you;
}
// the lady standing (sunglasses on, deadpan)
export function ladyAt(ctx, pos, rotY) {
  const lady = LADY(ctx), p = show(lady, pos, rotY, SY);
  face(lady, 'open', 'neutral', 'neutral'); p.hairSway = 0.3;
  return lady;
}
export function parked(ctx, o = {}) { setState(ctx, { limoX: PARK, ...o }); }

export const shots = {
  // 1. "You're homeless."  medium close-up: head + shoulders above a small round bush, nervous glances, stink lines.
  s01: { update(ctx) {
    const you = youInBush(ctx), p = you.p, t = ctx.t;
    p.headYaw = 0.32 * Math.sin(t * 2.6) * smooth(t / 0.3); p.pupils = [Math.sin(t * 2.6) * 0.9, 0];
    if (t > ctx.ev('homeless')) { face(you, 'open', 'sad', 'frown'); }
    parked(ctx, { limoX: -60 });                            // the limo is not here yet
    move(ctx, { pos: [2.0, 1.36, -3.75], target: [2.0, 1.2, -2.2], fov: 38 }, { pos: [2.0, 1.34, -3.45], target: [2.0, 1.2, -2.2], fov: 38 });
    punch(ctx, ctx.ev('homeless'), 1.1, 0.1);
    shadowAt(ctx, [2.0, 1.0, -2.2], 4);
    ctx.W.fx.stink({ at: [2.0, 1.02, -2.25], amount: 0.75, spread: 0.55, height: 0.55, count: 4 });
  } },
  // 2. "You're pooping behind a bush."  wide: the bush on a busy sidewalk, people walk past, the bush shakes.
  s02: { update(ctx) {
    const you = youInBush(ctx), p = you.p, t = ctx.t, b = ctx.ev('bush');
    p.headYaw = 0.45 * Math.sin(t * 2.2);
    const H = ctx.W.cast.helpers;
    const m1 = ctx.W.cast.guestM1; show(m1, [0, 0], 0, SY); H.go(m1, [-3.5, -3.0], [5.5, -3.0], clamp((t - ctx.shot.t0) / 2.0) * 0.95, 'walk');
    face(m1, 'open', 'neutral', 'neutral'); m1.p.headYaw = -0.2;
    const w1 = ctx.W.cast.guestW1; show(w1, [0, 0], 0, SY); H.go(w1, [7.0, -0.9], [-1.0, -0.9], clamp((t - ctx.shot.t0) / 2.0) * 0.9, 'walk');
    face(w1, 'open', 'neutral', 'neutral');
    parked(ctx, { limoX: -60, bushShake: win(t, b - 0.15, b + 0.7, 0.08, 0.25) });
    move(ctx, { pos: [-0.8, 2.15, -8.8], target: [1.4, 1.0, -1.6], fov: 46 }, { pos: [-0.2, 2.1, -8.6], target: [2.3, 1.0, -1.6], fov: 46 });
    shadowAt(ctx, [1.5, 1.0, -2.0], 7);
    ctx.W.fx.stink({ at: [2.0, 1.05, -2.25], amount: 0.6, spread: 0.45, height: 0.5, count: 3, burst: b });
  } },
  // 3. "And you forgot toilet paper."  close-up: he holds up the only things he found: a leaf and a bus ticket.
  s03: { update(ctx) {
    const you = youInBush(ctx), p = you.p, t = ctx.t, f = ctx.ev('forgot'), tp = ctx.ev('toilet');
    const P = PROPS(ctx);
    const up = easeOut(clamp((t - (f - 0.35)) / 0.35));
    const hy = lerp(1.0, 1.3, up);
    P.leaf.p = { ...P.leaf.p, visible: true, pos: [BUSH[0] - 0.17, hy, BUSH[1] - 0.3], rot: [0, Math.PI, 0.25] };
    P.ticket.p = { ...P.ticket.p, visible: true, pos: [BUSH[0] + 0.17, hy - 0.02, BUSH[1] - 0.3], rot: [0, Math.PI, -0.2] };
    p.gripL = { prop: P.leaf, pose: 'grip' }; p.gripR = { prop: P.ticket, pose: 'grip' };
    p.handL = null; p.handR = null;
    p.headPitch = -0.05; p.lookAt = [BUSH[0], hy, BUSH[1] - 0.6];
    face(you, 'open', 'sad', 'frown');
    if (t > tp) { face(you, 'wide', 'worried', 'tight'); }
    parked(ctx, { limoX: -60 });
    move(ctx, { pos: [2.0, 1.3, -3.15], target: [2.0, 1.22, -2.2], fov: 40 }, { pos: [2.0, 1.3, -3.05], target: [2.0, 1.22, -2.2], fov: 40 });
    punch(ctx, tp, 1.15, 0.1);
    shadowAt(ctx, [2.0, 1.1, -2.3], 3);
    pose(ctx);
    ctx.W.fx.sweat({ ch: you, t0: tp + 0.12, size: 1.0 });
  } },
  // 4. "Then a black car stops."  low angle at street level: the long black limo slides in and stops; puddle in front.
  s04: { update(ctx) {
    const t = ctx.t, st = ctx.ev('stops');
    const k = clamp((t - ctx.shot.t0) / (st - ctx.shot.t0));
    const x = lerp(-26, PARK, 1 - Math.pow(1 - k, 2.4));
    parked(ctx, { limoX: x });
    youInBush(ctx);
    move(ctx, { pos: [5.4, 0.14, -6.6], target: [0.6, 0.72, -4.3], fov: 50 }, { pos: [5.2, 0.14, -6.4], target: [0.6, 0.74, -4.3], fov: 49 });
    hit(ctx, st + 0.05, 0.012, 0.25);
    shadowAt(ctx, [1.5, 0.8, -4.3], 8);
  } },
  // 5. "A really expensive black car."  extreme close-up: gold rim with diamonds, slow pan along the car, sparkles.
  s05: { update(ctx) {
    parked(ctx);
    const P = ctx.W.set.props.street || {};
    const w = (P.anchors && P.anchors.frontWheel) || [PARK + 2.45, 0.37, -3.3];
    move(ctx, { pos: [w[0] - 0.45, 0.46, -2.45], target: [w[0] - 0.1, 0.37, w[2]], fov: 38 }, { pos: [w[0] + 0.25, 0.44, -2.5], target: [w[0] + 0.05, 0.37, w[2]], fov: 38 });
    punch(ctx, ctx.ev('black'), 1.12, 0.1);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.6 + ctx.t * 0.8;
      ctx.W.fx.glint({ at: [w[0] + Math.cos(a) * 0.18, w[1] + Math.sin(a) * 0.18, w[2] + 0.12], size: 0.07, seed: i * 3 });
    }
    ctx.W.fx.glint({ at: [w[0], w[1] + 0.05, w[2] + 0.13], size: 0.12, t0: ctx.ev('black') });
    shadowAt(ctx, [w[0], 0.5, w[2]], 3);
  } },
  // 6. "The door opens."  low-angle close-up: the rear door swings open, warm golden light + soft mist pour out.
  s06: { update(ctx) {
    const t = ctx.t, o = ctx.ev('opens');
    parked(ctx, { limoDoor: smooth(clamp((t - (o - 0.25)) / 0.6)), limoMist: smooth(clamp((t - o) / 0.5)) });
    move(ctx, { pos: [-2.05, 0.42, -2.25], target: [-1.3, 1.0, -3.35], fov: 46 }, { pos: [-1.95, 0.42, -2.35], target: [-1.3, 1.02, -3.35], fov: 44 });
    if (t > o) ctx.W.fx.glow({ at: [-1.3, 0.95, -3.55], size: 1.4, color: '#ffd890', amount: 0.55 * smooth((t - o) / 0.4) });
    ctx.W.fx.glint({ at: [-1.1, 1.25, -3.3], size: 0.08, t0: o + 0.2 });
    shadowAt(ctx, [-1.3, 0.8, -3.3], 4);
  } },
  // 7. "A rich lady steps out."  ground level, slow-motion feel: the red heel steps out onto the wet sidewalk.
  s07: { update(ctx) {
    const t = ctx.t, st = ctx.ev('steps');
    parked(ctx, { limoDoor: 1, limoMist: 0.6 });
    const lady = LADY(ctx), H = ctx.W.cast.helpers;
    show(lady, REAR, 0, SY - 0.02);
    const k = clamp((t - ctx.shot.t0) / (st + 0.15 - ctx.shot.t0));
    H.go(lady, [REAR[0], REAR[1] - 0.55], [REAR[0], REAR[1]], easeOut(k), 'walk', 0.55, 0.15);
    lady.p.y = SY - 0.02;
    move(ctx, { pos: [-1.82, 0.13, -2.55], target: [-1.3, 0.22, -3.15], fov: 40 }, { pos: [-1.78, 0.13, -2.6], target: [-1.3, 0.2, -3.15], fov: 38 });
    if (t > st) ctx.W.fx.dust({ at: [-1.24, SY + 0.02, -3.0], amount: 0.6, size: 0.05, life: 0.5 });
    hit(ctx, st, 0.004, 0.2);
    shadowAt(ctx, [-1.3, 0.4, -3.1], 3);
  } },
  // 8. "Fur coat." "Diamonds."  low angle: tilt up the white fur coat to the giant diamond necklace (punch + sparkles),
  //    then up to the big sunglasses.
  s08: { update(ctx) {
    const t = ctx.t, d = ctx.ev('diamonds');
    parked(ctx, { limoDoor: 1, limoMist: 0.3 });
    const lady = ladyAt(ctx, REAR, 0);
    const neckY = SY + 1.33, faceY = SY + 1.52;
    let ty;
    if (t < d) ty = lerp(SY + 0.85, neckY, smooth((t - ctx.shot.t0) / (d - ctx.shot.t0)));
    else if (t < ctx.shot.t1 - 0.45) ty = neckY;
    else ty = lerp(neckY, faceY, smooth((t - (ctx.shot.t1 - 0.45)) / 0.4));
    ctx.cam.set({ pos: [REAR[0] + 0.05, SY + 0.95, REAR[1] + 1.45], target: [REAR[0], ty, REAR[1]], fov: 34 });
    punch(ctx, d, 1.25, 0.09);
    if (t > d && t < d + 0.12) ctx.post.flash = 0.35 * (1 - (t - d) / 0.12);
    pose(ctx);
    const pts = lady.necklacePts || [];
    lady.chest.updateMatrixWorld(true);
    pts.forEach((q, i) => {
      if (i % 3 !== 0 && i !== pts.length - 1) return;
      const w = v3(q).applyMatrix4(lady.chest.matrixWorld);
      ctx.W.fx.glint({ at: w.toArray(), size: i === pts.length - 1 ? 0.07 : 0.04, seed: i });
    });
    if (t > d && pts.length) ctx.W.fx.glint({ at: v3(pts[pts.length - 1]).applyMatrix4(lady.chest.matrixWorld).toArray(), size: 0.16, t0: d });
    shadowAt(ctx, [REAR[0], 1.2, REAR[1]], 3);
  } },
  // 9. "Her bodyguard panics."  the huge bodyguard jumps out of the front door, hands up, mouth wide open, sweat flies.
  s09: { update(ctx) {
    const t = ctx.t, t0 = ctx.shot.t0;
    parked(ctx, { limoDoor: 1, guardDoor: smooth(clamp((t - t0) / 0.18)) });
    const g = GUARD(ctx), k = clamp((t - (t0 + 0.06)) / 0.32);
    const z = lerp(GOUT[1] - 0.75, GOUT[1], easeOut(k)), hop = Math.sin(Math.PI * k) * 0.22;
    const p = show(g, [GOUT[0], z], -0.35, SY + hop);
    face(g, 'wide', 'raised', 'scream'); p.shoulderUp = 1;
    const shakeK = Math.sin(t * 34) * 0.05;
    p.handL = L(g, 0.32, 2.05 + shakeK, 0.15); p.handR = L(g, -0.32, 2.05 - shakeK, 0.15); p.handPoseL = p.handPoseR = 'open';
    if (k >= 1) p.bounce = 0.6;
    move(ctx, { pos: [0.55, 1.6, -0.95], target: [1.5, 1.42, -3.05], fov: 46 }, { pos: [0.65, 1.6, -1.1], target: [1.5, 1.42, -3.05], fov: 44 });
    shake(ctx, t0 + 0.3, ctx.shot.t1, 0.01, 20);
    hit(ctx, t0 + 0.38, 0.02, 0.2);
    shadowAt(ctx, [1.5, 1.0, -3.0], 4);
    ctx.W.fx.sweatBurst({ ch: g, t0: t0 + 0.25, count: 7, size: 1.3 });
  } },
  // 10. "Ma'am... what are you doing?"  close-up: the bodyguard whisper-shouts, worried, one hand reaching out.
  s10: { update(ctx) {
    const t = ctx.t;
    parked(ctx, { limoDoor: 1, guardDoor: 1 });
    const g = GUARD(ctx), p = show(g, GOUT, -1.35, SY);
    face(g, 'wide', 'worried', 'neutral'); ctx.W.cast.helpers.talk(g, t, 0.9);
    p.lean = 0.18; p.shoulderUp = 0.6;
    p.lookAt = [REAR[0] + 0.6, 1.6, REAR[1] - 0.1];
    p.handL = L(g, 0.12, 1.5, 0.55); p.handPoseL = 'open';
    move(ctx, { pos: [0.5, 1.9, -2.5], target: [1.48, 1.86, -3.02], fov: 38 }, { pos: [0.58, 1.89, -2.55], target: [1.48, 1.86, -3.02], fov: 36 });
    bump(ctx, ctx.ev('what'), 1.04);
    shadowAt(ctx, [1.5, 1.6, -3.0], 3);
    pose(ctx);
    ctx.W.fx.sweat({ ch: g, t0: ctx.shot.t0 + 0.25, size: 1.2, repeat: 0.7 });
  } },
  // 11. "Shut up."  hard cut: her deadpan face, chin up, not looking at him. No camera move.
  s11: { update(ctx) {
    const t = ctx.t, sh = ctx.ev('shut');
    parked(ctx, { limoDoor: 1, guardDoor: 1 });
    const lady = ladyAt(ctx, REAR, 0.25), p = lady.p;
    p.headPitch = 0.08;
    if (t > sh && t < sh + 0.62) ctx.W.cast.helpers.talk(lady, t, 0.55);
    ctx.cam.set({ pos: [REAR[0] + 0.12, SY + 1.5, REAR[1] + 0.95], target: [REAR[0], SY + 1.5, REAR[1]], fov: 36 });
    ctx.cam.handheld(0);
    shadowAt(ctx, [REAR[0], 1.5, REAR[1]], 3);
  } },
  // 12. (boop)  the bodyguard's mouth snaps shut: lips pressed, cheeks puffed, stiff as a statue.
  s12: { update(ctx) {
    parked(ctx, { limoDoor: 1, guardDoor: 1 });
    const g = GUARD(ctx), p = show(g, GOUT, -1.35, SY);
    face(g, 'wide', 'raised', 'pressed'); p.cheeks = 0.8; p.shoulderUp = 0.9;
    p.lookAt = [REAR[0] + 0.6, 1.6, REAR[1] - 0.1];
    ctx.cam.set({ pos: [0.68, 1.88, -2.6], target: [1.48, 1.87, -3.02], fov: 33 });
    ctx.cam.handheld(0);
    punch(ctx, ctx.shot.t0, 1.08, 0.06);
    shadowAt(ctx, [1.5, 1.6, -3.0], 3);
  } },
};
