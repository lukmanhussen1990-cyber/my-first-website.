// Shots 21-40 of the awards reel: LUMP E (huge, buttons popping), the thick green fog, the director's single tear + his
// handkerchief, the orchestra pit + the conductor's stopwatch, the countdown (0:40 / 0:44 / 0:45 - numbers are drawn by the
// caption overlay), the baton swing + play-off music, the slow penguin walk off with the fog trailing, the one-handed
// orchestra pinching their noses, and the theatre at night with stink lines rising from the roof.
import { THREE, clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, noise1, hash1, v3, move, punch, bump, shake, hit, win, after,
  YOU, CH, PROPS, face, show, pose, lookCam, toward, L, shadowAt, setState, seat, OUTSIDE } from './shotlib.js';
import { T, ST, PIT, SY, ACT, H, FX, POOPS, lumpAt, actor, lumpShot, stinkFX, fogFX, pinchNose, frontRow, sniff, conductor, musicians,
  stopwatchK, crowd } from './shots_a.js';

const FACE = (dx = 0, dz = 0, fov = 30, dy = 0) => ({ pos: [0.48 + dx, 2.99 + dy, -2.02 + dz], target: [0, 2.93 + dy * 0.5, -3.25], fov });
const OX = OUTSIDE.origin[0], OZ = OUTSIDE.origin[1];
// the slow penguin walk off: 47.9 -> 52.7, from the mic toward the left wing (-X)
const W0 = 47.95, W1 = 54.4;
const walkX = (t) => lerp(ACT[0], -2.6, clamp((t - W0) / (W1 - W0)));
function penguin(ctx) {
  const t = ctx.t, you = actor(ctx, { up: 0 }), p = you.p;
  if (t < W0) return you;
  const x = walkX(t);
  H(ctx).go(you, [ACT[0], ACT[1]], [-2.6, ACT[1]], clamp((t - W0) / (W1 - W0)), 'walk', 0.2);
  const ph = p.gait.phase;
  p.leanSide = 0.14 * Math.sin(ph * Math.PI * 2); p.torsoYaw = 0.05 * Math.sin(ph * Math.PI * 2);
  p.handR = L(you, -0.36, 0.9, 0.02); p.handPoseR = 'flat';
  p.headYaw = -0.25; p.headPitch = -0.05;
  face(you, 'wide', 'raised', 'smile'); p.red = 0.35;
  void x;
  return you;
}
// conducting pattern after the swing (baton bounces), tAfter = time since the swing
function conducting(t) { return { up: 0.55 + 0.25 * Math.sin(t * 6.3), batonTilt: 0.25 * Math.sin(t * 6.3 + 1.2) }; }

export const shots = {
  // 21. LUMP E: "You poop a little more." - HUGE lump like a beach ball, buttons pop off. SQUOOOSH.
  s21: { update(ctx) { lumpShot(ctx, 'more', { k: 2, buttons: true }); } },
  // 22. "Out of nerves."  wide on the stage: thick green fog around him, frozen smile.
  s22: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, { pos: [0.1, 3.0, 5.6], target: [0, 2.35, -3.2], fov: 34 }, { pos: [0.05, 2.9, 4.7], target: [0, 2.4, -3.2], fov: 32 });
    face(you, 'wide', 'raised', 'smile'); p.red = 0.3; p.headRoll = 0.03 * Math.sin(t * 30);
    stinkFX(ctx, you, { scale: 1.2 }); fogFX(ctx, { k: 1.0, r: 1.2, opacity: 0.8 });
    crowd(ctx, { nose: 0.6, sniff: 0.4 });
    shadowAt(ctx, [0, 2, -3], 5);
    ctx.post.vignette = 0.35; ctx.post.tint = 0.1;
  } },
  // 23. "The director in row one"  white beard, round glasses, burgundy velvet jacket, very serious.
  s23: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx, ['director', 'costar']), d = fr.director;
    move(ctx, { pos: [-1.5, 1.2, 0.98], target: [-1.62, 1.03, 2.06], fov: 40 }, { pos: [-1.55, 1.18, 1.12], target: [-1.62, 1.05, 2.06], fov: 37 });
    face(d, 'squint', 'sad', 'tight'); d.p.headPitch = -0.03;
    pinchNose(ctx, fr.costar, 'R', 1);
    face(fr.costar, 'squeeze', 'raised', 'grin');
    crowd(ctx, { nose: 0.4 });
    shadowAt(ctx, [-1.6, 0.8, 2.2], 2.5);
    ctx.post.vignette = 0.3; void t;
  } },
  // 24. "is quietly crying."  a single tear rolls down the director's cheek.
  s24: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx, ['director']), d = fr.director, tc = ctx.ev('crying');
    move(ctx, { pos: [-1.58, 1.2, 1.3], target: [-1.62, 1.1, 2.06], fov: 32 }, { pos: [-1.59, 1.19, 1.38], target: [-1.62, 1.1, 2.06], fov: 30 });
    face(d, 'squint', 'sad', 'tight'); d.p.headPitch = 0.04;
    FX(ctx).tears({ ch: d, t0: tc - 0.5, side: 'R', amount: 0.55, size: 0.8, grow: 1.2 });
    if (t > tc + 0.5) d.p.eyes = 'closed';
    crowd(ctx, { nose: 0.3 });
    shadowAt(ctx, [-1.6, 1.0, 2.1], 1.5);
    ctx.post.vignette = 0.35;
  } },
  // 25. "Not from joy."  he presses his handkerchief over his nose, eyes squeezed.
  s25: { update(ctx) {
    const t = ctx.t, fr = frontRow(ctx, ['director']), d = fr.director, p = d.p, P = PROPS(ctx), tj = ctx.ev('joy');
    move(ctx, { pos: [-1.84, 1.2, 1.02], target: [-1.62, 1.07, 2.06], fov: 35 }, { pos: [-1.82, 1.19, 1.1], target: [-1.62, 1.08, 2.06], fov: 33 });
    const k = smooth(clamp((t - tj + 0.35) / 0.3));
    pose(ctx);
    const n = d.nosePos(), rest = L(d, -0.12, 0.66, 0.3), tgt = [n.x, n.y - 0.05, n.z - 0.045];
    P.hanky.p = { ...P.hanky.p, visible: true, pos: [lerp(rest[0], tgt[0], k), lerp(rest[1], tgt[1], k), lerp(rest[2], tgt[2], k)], rot: [0, p.rotY, 0], scale: 0.75 };
    p.gripR = { prop: P.hanky, pose: 'grip' }; p.poleR = [1.0, -0.4, 0.2];
    face(d, k > 0.5 ? 'squeeze' : 'squint', 'sad', 'tight');
    FX(ctx).tears({ ch: d, t0: ctx.shot.t0 - 1.0, side: 'R', amount: 0.55, size: 0.8 });
    if (k > 0.5) FX(ctx).stink({ at: [n.x + 0.18, n.y + 0.05, n.z - 0.1], amount: 0.6, spread: 0.15, height: 0.3, count: 2 });
    crowd(ctx, { nose: 0.5 });
    shadowAt(ctx, [-1.6, 1.0, 2.1], 1.5);
    ctx.post.vignette = 0.35;
  } },
  // 26. "What you don't know:"  the orchestra pit below the stage (stopwatch overlay starts in the corner).
  s26: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0.3, 2.9, 4.2], target: [0, -0.2, -0.85], fov: 50 }, { pos: [0.2, 2.7, 3.7], target: [0, -0.2, -0.85], fov: 50 });
    conductor(ctx, { up: 0.15, watch: true, watchK: stopwatchK(t) });
    musicians(ctx, { play: 0 });
    const you = actor(ctx, { up: 0.3 }); face(you, 'wide', 'worried', 'tight');
    stinkFX(ctx, you); fogFX(ctx);
    shadowAt(ctx, [0, 0, -1.5], 6);
    ctx.post.vignette = 0.35;
  } },
  // 27. the conductor slowly raises his baton, staring at a stopwatch.
  s27: { update(ctx) {
    const t = ctx.t, k = smooth(ctx.u);
    move(ctx, { pos: [-0.32, 1.12, -0.88], target: [0, 0.92, 0.4], fov: 46 }, { pos: [-0.3, 1.1, -0.8], target: [0, 0.94, 0.4], fov: 44 });
    const cd = conductor(ctx, { up: lerp(0.15, 0.85, k), watch: true, watchK: stopwatchK(t) });
    face(cd, 'squint', 'angry', 'tight');
    shadowAt(ctx, [0, 0, 0.4], 2.5);
    ctx.post.vignette = 0.35;
  } },
  // 28. close: the stopwatch in his hand, ticking.
  s28: { update(ctx) {
    const t = ctx.t;
    const cd = conductor(ctx, { up: 0.85, watch: true, watchK: stopwatchK(t) });
    face(cd, 'squint', 'angry', 'tight');
    move(ctx, { pos: [-0.36, 1.13, 0.68], target: [-0.12, 0.83, 0.1], fov: 27 }, { pos: [-0.33, 1.1, 0.6], target: [-0.12, 0.83, 0.1], fov: 23 });
    bump(ctx, ctx.ev('seconds'), 1.04, 0.2);
    shadowAt(ctx, [0, 0.5, 0.2], 1.5);
    ctx.post.vignette = 0.45;
  } },
  // 29. "Then the orchestra starts playing"  the orchestra ready, looking up at the conductor.
  s29: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0.9, 2.0, 3.1], target: [-0.1, -0.05, -0.85], fov: 54 }, { pos: [0.85, 1.9, 2.85], target: [-0.1, -0.05, -0.85], fov: 52 });
    conductor(ctx, { up: 0.85, watch: true, watchK: stopwatchK(t) });
    const m = musicians(ctx, { play: 0 });
    for (const c of Object.values(m)) { c.p.headPitch = 0.15; face(c, 'wide', 'raised', 'tight'); }
    const you = actor(ctx, { up: 0.3 }); face(you, 'wide', 'worried', 'tight');
    stinkFX(ctx, you); fogFX(ctx);
    shadowAt(ctx, [0, 0, -1], 5);
    ctx.post.vignette = 0.35;
  } },
  // 30. "to push you off the stage."  over the conductor's shoulder: him at the mic, far away.
  s30: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0.5, 1.05, 1.5], target: [0, 2.3, -3.25], fov: 36 }, { pos: [0.48, 1.07, 1.42], target: [0, 2.35, -3.25], fov: 33 });
    conductor(ctx, { up: 0.9, tremble: 0.3, watch: true, watchK: stopwatchK(t) });
    const you = actor(ctx, { up: 0.3 }); face(you, 'wide', 'worried', 'tight'); you.p.red = 0.3;
    stinkFX(ctx, you); fogFX(ctx, { opacity: 0.4, r: 0.75 });
    shadowAt(ctx, [0, 1, -1.5], 4);
    ctx.post.vignette = 0.4;
  } },
  // 31. COUNTDOWN 0:40 - his sweating face.
  s31: { update(ctx) {
    const t = ctx.t, you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, FACE(-0.3, -0.25, 29), FACE(-0.3, -0.3, 27));
    face(you, 'wide', 'worried', 'tight'); p.red = 0.35; p.wet = 0.8;
    FX(ctx).sweat({ ch: you, t0: ctx.shot.t0, count: 3 });
    hit(ctx, ctx.ev('forty'), 0.008, 0.2);
    stinkFX(ctx, you); fogFX(ctx, { opacity: 0.45 });
    shadowAt(ctx, [0, 2.6, -3.2], 2);
    ctx.post.vignette = 0.45; void t;
  } },
  // 32. COUNTDOWN 0:44 - the conductor's raised baton, trembling.
  s32: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [-0.5, 1.08, -0.82], target: [0.1, 1.24, 0.35], fov: 47 }, { pos: [-0.48, 1.08, -0.74], target: [0.1, 1.26, 0.35], fov: 45 });
    const cd = conductor(ctx, { up: 1, tremble: 1, watch: false });
    face(cd, 'stare', 'angry', 'tight'); cd.p.lookAt = [0, 2.9, -3.25];
    hit(ctx, ctx.ev('fortyfour'), 0.006, 0.2);
    shadowAt(ctx, [0, 0.8, 0.4], 2);
    ctx.post.vignette = 0.45; void t;
  } },
  // 33. COUNTDOWN 0:45 - extreme close-up: his eyes go wide.
  s33: { update(ctx) {
    const t = ctx.t, tf = ctx.ev('fortyfive'), you = actor(ctx, { up: 0.3 }), p = you.p;
    move(ctx, { pos: [0.05, 3.0, -2.8], target: [0, 2.955, -3.2], fov: 30 }, { pos: [0.05, 3.0, -2.84], target: [0, 2.955, -3.2], fov: 29 });
    face(you, t < tf ? 'open' : 'wide', 'worried', 'tight'); p.red = 0.4; p.wet = 0.8;
    punch(ctx, tf, 1.25, 0.08); hit(ctx, tf, 0.012, 0.3);
    shadowAt(ctx, [0, 2.8, -3.2], 1.5);
    ctx.post.vignette = 0.5;
  } },
  // 34. "The music starts."  the conductor swings his baton - play-off music - the spotlight slides away from him.
  s34: { update(ctx) {
    const t = ctx.t, tm = ctx.ev('music'), sw = t >= tm;
    move(ctx, { pos: [0.8, 1.15, 1.8], target: [-0.1, 1.5, -3.0], fov: 52 }, { pos: [0.75, 1.17, 1.65], target: [-0.1, 1.55, -3.0], fov: 50 });
    const kk = clamp((t - tm) / 0.18);
    const cdo = !sw ? { up: 1, tremble: 0.5 } : kk < 1 ? { up: lerp(1, 0.2, easeIn(kk)), batonTilt: lerp(0, 0.5, kk) } : conducting(t);
    conductor(ctx, { ...cdo, watch: false });
    musicians(ctx, { play: sw ? 1 : 0, notesT0: tm });
    const you = actor(ctx, { up: 0.3 }); face(you, sw ? 'wide' : 'open', 'worried', 'tight');
    if (sw) hit(ctx, tm, 0.012, 0.25);
    setState(ctx, { spot: { x: lerp(0, 4.5, smooth(clamp((t - tm - 0.15) / 0.6))), z: ACT[1] } });
    stinkFX(ctx, you); fogFX(ctx);
    crowd(ctx, { nose: 0.4 });
    shadowAt(ctx, [0, 0.5, -1.2], 5);
    ctx.post.vignette = 0.35;
  } },
  // 35. "You walk off."  wide from behind: he walks off stiff-legged like a penguin, the huge lump, green fog trailing.
  s35: { update(ctx) {
    const t = ctx.t, you = penguin(ctx), x = you.p.pos[0];
    const tx = x - 0.35; move(ctx, { pos: [1.0, 2.7, -7.7], target: [tx, 2.05, -3.0], fov: 46 }, { pos: [0.7, 2.65, -7.5], target: [tx, 2.05, -3.0], fov: 45 });
    stinkFX(ctx, you, { scale: 1.1 });
    fogFX(ctx, { at: [x, SY + 0.3, ACT[1]], k: 1, r: 0.9 });
    FX(ctx).haze({ at: [lerp(x, ACT[0], 0.5) + 0.2, SY + 0.25, ACT[1] - 0.1], radius: 1.1, amount: 0.8, count: 8, color: '#9ae05a', color2: '#4f9c33', opacity: 0.3, ground: SY });
    setState(ctx, { spot: { x: 4.5, z: ACT[1] } });
    conductor(ctx, { ...conducting(t) });
    crowd(ctx, { nose: 0.6 });
    shadowAt(ctx, [x, 2, -3.3], 4);
    ctx.post.vignette = 0.35; ctx.post.tint = 0.08;
  } },
  // 36. "Very... slowly."  side view: the whole crowd watches him cross the stage, holding their noses.
  s36: { update(ctx) {
    const t = ctx.t, you = penguin(ctx), x = you.p.pos[0];
    move(ctx, { pos: [3.7, 2.35, 3.4], target: [-1.0, 2.1, -3.3], fov: 40 }, { pos: [3.4, 2.4, 3.0], target: [-1.4, 2.1, -3.3], fov: 38 });
    stinkFX(ctx, you, { scale: 1.1 });
    fogFX(ctx, { at: [x, SY + 0.3, ACT[1]], k: 1, r: 0.9 });
    FX(ctx).haze({ at: [lerp(x, ACT[0], 0.5) + 0.3, SY + 0.25, ACT[1]], radius: 1.2, amount: 0.8, count: 8, color: '#9ae05a', color2: '#4f9c33', opacity: 0.3, ground: SY });
    setState(ctx, { spot: { x: 4.5, z: ACT[1] } });
    crowd(ctx, { nose: 0.9, look: 0.15 });
    conductor(ctx, { ...conducting(t) }); musicians(ctx, { play: 1, notes: false });
    shadowAt(ctx, [0, 1.5, -1], 6);
    ctx.post.vignette = 0.35;
  } },
  // 37. "The orchestra keeps playing."  wide on the pit, he's still walking off up on the stage.
  s37: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0.8, 2.2, 3.1], target: [-0.1, 0.05, -0.9], fov: 54 }, { pos: [0.7, 2.1, 2.85], target: [-0.15, 0.1, -0.9], fov: 52 });
    conductor(ctx, { ...conducting(t) });
    musicians(ctx, { play: 1, notesT0: 46.8 });
    const you = penguin(ctx), x = you.p.pos[0];
    stinkFX(ctx, you); fogFX(ctx, { at: [x, SY + 0.3, ACT[1]], r: 0.9 });
    crowd(ctx, { nose: 0.9 });
    setState(ctx, { spot: { x: 4.5, z: ACT[1] } });
    shadowAt(ctx, [0, 0, -1], 5);
    ctx.post.vignette = 0.35;
  } },
  // 38. "With one hand."  violin, trumpet and cello playing with ONE hand, pinching their noses with the other.
  s38: { update(ctx) {
    const t = ctx.t, th = ctx.ev('hand');
    move(ctx, { pos: [0.05, 1.25, 2.65], target: [0, 0.25, -0.85], fov: 58 }, { pos: [0.0, 1.2, 2.45], target: [0, 0.25, -0.85], fov: 56 });
    const m = musicians(ctx, { play: 1, nose: (t - th + 0.3) / 0.35, notesT0: 46.8 });
    if (t > th) for (const c of Object.values(m)) { face(c, 'squeeze', 'worried', c.name === 'trumpeter' ? 'tight' : 'tight'); }
    crowd(ctx, { nose: 1 });
    shadowAt(ctx, [0, -0.5, -0.8], 3);
    ctx.post.vignette = 0.35;
  } },
  // 39. "The other is holding their nose."  the conductor conducting with his nose pinched.
  s39: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [0.42, 1.06, -0.55], target: [0, 0.98, 0.4], fov: 42 }, { pos: [0.4, 1.06, -0.47], target: [0, 1.0, 0.4], fov: 40 });
    const cd = conductor(ctx, { ...conducting(t) });
    pinchNose(ctx, cd, 'L', 1);
    face(cd, 'squeeze', 'angry', 'tight');
    shadowAt(ctx, [0, 0.5, 0.4], 2);
    ctx.post.vignette = 0.35;
  } },
  // 40. the glowing theatre at night: searchlights, green stink lines rising from the roof, slow zoom out, fade.
  s40: { update(ctx) {
    const t = ctx.t;
    move(ctx, { pos: [OX, 4.5, OZ + 30], target: [OX, 13, OZ - 8], fov: 52 }, { pos: [OX, 9, OZ + 60], target: [OX, 14, OZ - 8], fov: 52 }, easeInOut);
    const fx = FX(ctx);
    fx.stink({ at: [OX, 26.5, OZ - 12], amount: 1, spread: 5.5, height: 9, count: 6, scale: 1, thick: 3 });
    fx.stink({ at: [OX - 12, 18.2, OZ - 4], amount: 0.8, spread: 3, height: 6, count: 3, thick: 2.5 });
    fx.stink({ at: [OX + 12, 18.2, OZ - 4], amount: 0.8, spread: 3, height: 6, count: 3, thick: 2.5 });
    fx.haze({ at: [OX, 24, OZ - 12], radius: 10, amount: 0.8, count: 10, color: '#9ae05a', color2: '#4f9c33', opacity: 0.22, ground: 18 });
    ctx.post.dim = smooth(clamp((t - 56.75) / 0.9));
    ctx.post.vignette = 0.35;
  } },
};
