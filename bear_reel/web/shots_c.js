// Shots s21-s29 (the map -> the ending). See plan.js for timing/content.
import { move, punch, bump, shake, hit, win, face, stinkYou, lookCam, bearWalk, bearFace, light, toward,
  YX, YZ, BP, clamp, lerp, smooth, smoother, invLerp, easeOut, easeIn, easeInOut, easeOutBack, noise1, v3 } from './shotlib.js';
import { HIDE_TREE, HIDE_BUSH, MAP_BEAR, BIRD_TREES, FORE_BRANCH, TENT } from './layout.js';

const solve = (ctx) => ctx.W.animals.commit(ctx);
const pulse = (t, t0, dur) => (t >= t0 && t < t0 + dur ? Math.sin(Math.PI * (t - t0) / dur) : 0);

// wavy stink trail from YOU's tree to the map bear's nose (lies above the canopy)
function trailPoints(nose) {
  const pts = [], n = 16, a = [HIDE_TREE.pos[0] + 0.6, 2.0, 0.6];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = lerp(a[0], nose.x, u) + Math.sin(u * Math.PI * 3.2) * 7 * Math.sin(u * Math.PI);
    const z = lerp(a[2], nose.z - 2.5, u);
    const y = lerp(a[1], nose.y, u) + Math.sin(u * Math.PI) * 18;
    pts.push([x, Math.max(y, u < 0.08 ? 2 : 18), z]);
  }
  pts.push([nose.x, nose.y, nose.z]);
  return pts;
}

export const shots = {
  // ---------------------------------------------------------------- s21 "It smelled you from miles away." (map)
  s21: { update(ctx) {
    const t = ctx.t, A = ctx.W.animals;
    A.bear.p.visible = false;
    A.mapBear.p.visible = true; A.mapBear.p.pos = MAP_BEAR.pos.slice(); A.mapBear.p.scale = MAP_BEAR.scale;
    const [t0, t1] = ctx.ev('trail');
    const prog = smoother(invLerp(t0, t1, t));
    A.mapBear.p.sniff = pulse(t, t1 - 0.05, 0.35);
    solve(ctx);
    const nose = A.mapBear.nosePos();
    // camera straight down (north = up on screen); pans with the trail head, zooming out to show the whole way
    const k = smoother(invLerp(ctx.shot.t0, t1 + 0.1, t));
    const zc = lerp(14, 46, k), H = lerp(78, 150, k), xc = lerp(-1.5, -3.5, k);
    ctx.cam.set({ pos: [xc, H, zc], target: [xc, 0, zc + 0.001], up: [0, 0, 1], fov: 42, far: 600 }).handheld(0.0005);
    ctx.W.fx.trail({ points: trailPoints(nose), progress: prog, t, width: 4.5 });
    const s = ctx.W.set.state; s.fog = { ...s.fog, near: 200, far: 520 }; s.rays = 0;
    light(ctx, [-3, 0, 46], 70, 0.25, [0, 1, 0]);
  } },

  // ---------------------------------------------------------------- s22 "The bear gets closer."
  s22: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, you = ctx.W.cast.you;
    you.p.crouch = 0.45; face(ctx, 'stare', 'raised', 'tight');
    bearWalk(ctx, [BP.near[0] - 0.25, BP.near[1] + 2.0], BP.near, ctx.u, { stride: 1.5 });
    bearFace(ctx, 'open', 'neutral', 'closed'); p.headPitch = -0.28; p.ears = 0.8;
    p.sniff = Math.max(pulse(t, 31.25, 0.3), pulse(t, 31.85, 0.3)) * 0.8;
    for (const s of ctx.ev('steps')) hit(ctx, s, 0.0035, 0.15, 17);
    move(ctx, { pos: [YX + 0.12, 1.2, YZ + 0.12], target: [BP.near[0] - 0.1, 1.15, BP.near[1] + 1.2], fov: 46 },
              { pos: [YX + 0.12, 1.2, YZ + 0.2], target: [BP.near[0] - 0.05, 1.1, BP.near[1] + 0.6], fov: 43 });
    stinkYou(ctx, 0.5, { at: [YX + 0.25, 0.95, YZ + 0.45], count: 4, scale: 0.8 });
    ctx.W.set.state.skyDark = 0.2;
    light(ctx, [0, 1, 2], 6, 0.45);
  } },

  // ---------------------------------------------------------------- s23 "Closer."
  s23: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, thud = ctx.ev('thud');
    ctx.W.cast.you.p.crouch = 0.5;
    p.pos = BP.close.slice(); p.rotY = Math.PI; p.gait = 'idle';
    const lean = easeOut(invLerp(ctx.shot.t0, thud + 0.1, t));
    p.neck = lean; p.headPitch = -0.35 * lean; p.ears = 1;
    bearFace(ctx, 'open', 'neutral', 'closed');
    const camPos = [YX + 0.12, 1.02, YZ + 0.05];
    p.lookAt = camPos;
    ctx.cam.set({ pos: camPos, target: [BP.close[0], 1.95, BP.close[1] - 0.4], fov: 52 }).handheld(0.001);
    punch(ctx, thud, 1.25, 0.05);
    hit(ctx, thud, 0.01, 0.25);
    ctx.post.dim = 0.18 + 0.12 * smooth(invLerp(thud - 0.1, thud + 0.1, t));
    ctx.post.vignette = 0.5;
    light(ctx, [0, 1.5, 1.5], 4, 0.4, [0, 0.2, -1]);
  } },

  // ---------------------------------------------------------------- s24 "It sniffs once."
  s24: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, sn = ctx.ev('sniff');
    p.pos = BP.close.slice(); p.rotY = Math.PI; p.gait = 'idle'; p.neck = 0.6;
    bearFace(ctx, 'closed', 'raised', 'closed'); p.ears = 0.8;
    const big = smooth(invLerp(sn - 0.05, sn + 0.35, t)) * (1 - smooth(invLerp(sn + 0.75, sn + 0.95, t)));
    p.headPitch = 0.3 + 0.08 * big; p.sniff = big; p.cheeksIn = big;
    solve(ctx);
    const head = bear.headPos(), nose = bear.nosePos();
    // profile from the bear's left (+X side when it faces -Z is its right... we just pick the sunny side)
    const camP = head.clone().add(v3(1.05, 0.05, 0.12));
    ctx.cam.set({ pos: camP.toArray(), target: head.clone().lerp(nose, 0.45).add(v3(0, 0.02, 0)).toArray(), fov: 30 }).handheld(t > sn + 0.4 ? 0 : 0.001);
    ctx.W.fx.stinkFlow({ from: [YX + 0.1, 1.0, YZ + 0.4], to: nose.toArray(), progress: smooth(invLerp(ctx.shot.t0 - 0.2, sn + 0.4, t)), t, count: 5, seed: 6, width: 1.2 });
    bump(ctx, sn, 1.05, 0.4);
    light(ctx, head.toArray(), 3, 0.45);
  } },

  // ---------------------------------------------------------------- s25 "Its eyes start watering."
  s25: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, te = ctx.ev('tears');
    p.pos = BP.close.slice(); p.rotY = Math.PI; p.gait = 'idle'; p.neck = 0.4; p.headPitch = 0.05;
    bearFace(ctx, 'open', 'sad', 'tremble'); p.ears = 0.4;
    p.tears = smooth(invLerp(te, te + 0.9, t)); p.green = 0.55 * smooth(invLerp(ctx.shot.t0, ctx.shot.t1, t));
    solve(ctx);
    const head = bear.headPos(), nose = bear.nosePos();
    const fwd = nose.clone().sub(head).setY(0).normalize();
    const camP = head.clone().addScaledVector(fwd, 1.25).add(v3(0, -0.05, 0));
    ctx.cam.set({ pos: camP.toArray(), target: head.clone().add(v3(0, 0.03, 0)).toArray(), fov: lerp(30, 27, ctx.u) }).handheld(0.001);
    if (t > te + 0.5) { ctx.W.fx.tears({ ch: bear, t0: te + 0.5, t, amount: 0.7, side: 'L' }); ctx.W.fx.tears({ ch: bear, t0: te + 0.62, t, amount: 0.7, side: 'R' }); }
    ctx.W.fx.haze({ at: head.clone().add(v3(0, -0.3, 0.2)).toArray(), radius: 1.2, amount: 0.35 * ctx.u, t, seed: 2 });
    ctx.post.tint = 0.18 * smooth(ctx.u);
    light(ctx, head.toArray(), 3, 0.5);
  } },

  // ---------------------------------------------------------------- s26 "It holds its nose." (KEY)
  s26: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p, pin = ctx.ev('pinch');
    p.pos = BP.close.slice(); p.rotY = Math.PI; p.gait = 'idle';
    p.sit = smooth(invLerp(ctx.shot.t0, ctx.shot.t0 + 0.3, t));
    p.pinch = easeOut(invLerp(pin - 0.15, pin + 0.15, t));
    bearFace(ctx, 'squeeze', 'sad', 'pressed'); p.tears = 1; p.cheeksPuff = 0.7; p.green = 0.8; p.ears = 0.3;
    p.headYaw = 0.22 * Math.sin((t - pin) * 13) * smooth(invLerp(pin + 0.1, pin + 0.3, t));
    solve(ctx);
    const head = bear.headPos(), nose = bear.nosePos();
    const fwd = nose.clone().sub(head).setY(0).normalize();
    const camP = head.clone().addScaledVector(fwd, 2.3).add(v3(0.35, -0.35, 0));
    ctx.cam.set({ pos: camP.toArray(), target: head.clone().add(v3(0, -0.25, 0)).toArray(), fov: 36 }).handheld(0.0015);
    shake(ctx, pin, ctx.shot.t1, 0.004, 20);
    ctx.W.fx.tears({ ch: bear, t0: ctx.shot.t0, t, amount: 0.9, side: 'L' }); ctx.W.fx.tears({ ch: bear, t0: ctx.shot.t0 + 0.1, t, amount: 0.9, side: 'R' });
    ctx.W.fx.haze({ at: head.clone().add(v3(0, -0.4, 0)).toArray(), radius: 1.8, amount: 0.5, t, seed: 4 });
    ctx.post.tint = 0.24;
    light(ctx, head.toArray(), 4, 0.5);
  } },

  // ---------------------------------------------------------------- s27 "And runs away crying." (KEY)
  s27: { update(ctx) {
    const t = ctx.t, bear = ctx.W.animals.bear, p = bear.p;
    const a = [BP.close[0] + 0.6, BP.close[1] + 0.8], b = [BP.close[0] + 6.2, BP.close[1] + 9.5];
    const u = easeIn(invLerp(ctx.shot.t0 - 0.15, ctx.shot.t1 + 0.2, t)) * 0.8 + ctx.u * 0.2;
    bearWalk(ctx, a, b, u, { gait: 'biped_run', stride: 1.3 });
    p.stance = 1; p.flail = 1; bearFace(ctx, 'squeeze', 'sad', 'wail'); p.tears = 1; p.green = 0.5;
    p.headYaw = -0.5;   // looks back over its shoulder
    solve(ctx);
    const head = bear.headPos();
    const camP = [BP.close[0] + 7.5, 1.7, BP.close[1] - 0.5];
    ctx.cam.set({ pos: camP, target: [head.x, head.y - 0.6, head.z], fov: 44 }).handheld(0.002);
    ctx.W.fx.cryTears({ ch: bear, t, amount: 1, dir: [-(b[0] - a[0]), 0.3, -(b[1] - a[1])] });
    const fp = bear.pawPos ? bear.pawPos('BL') : head;
    ctx.W.fx.dust({ at: [fp.x, 0.05, fp.z], t0: t - ((t - ctx.shot.t0) % 0.32), t, amount: 0.8, seed: Math.floor(t * 3) });
    ctx.post.tint = 0.1;
    light(ctx, [head.x, 1, head.z], 7, 0.4);
  } },

  // ---------------------------------------------------------------- s28 "Even the birds leave." (KEY)
  s28: { update(ctx) {
    const t = ctx.t, A = ctx.W.animals, burst = ctx.ev('burst');
    A.bear.p.visible = false; ctx.W.cast.you.p.visible = false;
    A.birds.perch({ points: BIRD_TREES.slice(0, 3).map(([x, z], i) => [x, 11.5 + i, z]), t: Math.min(t, burst) });
    if (t >= burst - 0.02) A.birds.burst({ t, t0: burst, trees: BIRD_TREES, count: 70, height: [9, 15], dir: [0.25, 1.0, 0.55], speed: 7, seed: 5 });
    const sq = A.squirrel, path = ctx.W.set.props.foreBranch.userData.path;
    const su = smooth(invLerp(burst - 0.25, burst + 0.85, t));
    const sp = path(clamp(su)), sp2 = path(clamp(su + 0.02));
    sq.p.visible = true; sq.p.pos = sp.toArray(); sq.p.rotY = Math.atan2(sp2.x - sp.x, sp2.z - sp.z);
    sq.p.run = (t - burst) * 9; sq.p.jump = smooth(invLerp(burst + 0.75, burst + 1.0, t));
    if (sq.p.jump > 0) { sq.p.pos[1] += 0.6 * Math.sin(Math.PI * Math.min(1, sq.p.jump)); sq.p.pos[0] += 0.8 * sq.p.jump; }
    move(ctx, { pos: [FORE_BRANCH.pos[0] - 0.2, FORE_BRANCH.pos[1] + 0.2, FORE_BRANCH.pos[2] - 0.8], target: [6, 12.5, 13], fov: 50 },
              { pos: [FORE_BRANCH.pos[0] - 0.3, FORE_BRANCH.pos[1] + 0.15, FORE_BRANCH.pos[2] - 1.0], target: [6, 13.2, 13], fov: 52 });
    hit(ctx, burst, 0.006, 0.4, 16);
    ctx.W.set.state.rays = 0.6;
    light(ctx, [6, 10, 12], 12, 0.25);
  } },

  // ---------------------------------------------------------------- s29 "Enjoy your camping trip." (ending)
  s29: { update(ctx) {
    const t = ctx.t, A = ctx.W.animals;
    A.bear.p.visible = false; ctx.W.cast.you.p.crouch = 1; ctx.W.cast.you.p.visible = false;
    move(ctx, { pos: [5.2, 6.2, 12.8], target: [-1.2, 2.4, -3.5], fov: 44 }, { pos: [6.4, 7.4, 15.8], target: [-1.2, 2.6, -3.5], fov: 47 }, (u) => smooth(u));
    ctx.cam.handheld(0.0008);
    // big stink lines rising over the treetops from behind the hide tree + a green haze
    ctx.W.fx.stink({ at: [YX - 0.2, 2.0, YZ - 0.5], amount: 1, spread: 2.2, height: 9, count: 7, seed: 11, t, scale: 6 });
    ctx.W.fx.haze({ at: [YX, 2.5, YZ], radius: 6, amount: 0.45, t, seed: 9 });
    ctx.post.tint = 0.16; ctx.post.vignette = 0.25;
    ctx.W.set.state.rays = 0.7;
    light(ctx, [-1, 1, -3], 14, 0.25);
  } },
};
