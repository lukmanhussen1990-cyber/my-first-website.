// s01-s10: the poop, the cleanest city, it shines, everyone notices: man, lady, kid.
import { P, C, move, punch, shake, win, kf, placeProp, propPoint, lookCam, face, stinkPoop, sweat, sparkles, smooth, invLerp, lerp, clamp, easeOut, hash1, noise1, v3 } from './shotlib.js';
import { SPOTS } from './layout.js';

const dirOf = (th) => ({ f: [Math.sin(th), 0, Math.cos(th)], r: [-Math.cos(th), 0, Math.sin(th)] });
const at = (base, r, f, y, d) => [base[0] + d.r[0] * r + d.f[0] * f, y, base[1] + d.r[2] * r + d.f[2] * f];

// one orange: thrown out of the falling bag, bounces twice, rolls (time-warped for slow motion)
function orangeAt(i, t, start) {
  if (t < 12.2) return null;
  const tau = t < 12.8 ? (t - 12.2) * 0.45 : 0.27 + (t - 12.8) * 1.0;
  const a = -0.9 + hash1(i * 4.1) * 2.6, sp = 0.45 + hash1(i * 2.3) * 0.7, vy0 = 0.7 + hash1(i * 5.7) * 0.8;
  const r = 0.045, g = 9.8;
  let y = start[1], vy = vy0, tt = tau, bounces = 0, t0 = 0;
  // analytic bounces (restitution 0.35), then rolling
  let landed = false;
  while (!landed) {
    const disc = vy * vy + 2 * g * (y - (C + r));
    const tHit = (vy + Math.sqrt(Math.max(0, disc))) / g;
    if (tt < tHit) { y = y + vy * tt - 0.5 * g * tt * tt; break; }
    tt -= tHit; t0 += tHit; y = C + r; vy = (vy - g * tHit) * -0.35; bounces++;
    if (bounces >= 2 || vy < 0.2) { landed = true; y = C + r; }
  }
  const k = 1.6, dist = sp * (1 - Math.exp(-k * tau)) / k;
  const pos = [start[0] + Math.cos(a) * dist, y, start[2] + Math.sin(a) * dist];
  return { pos, rot: dist / r };
}

export const shots = {
  s01: { update(ctx) { // "You just pooped in the street."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-1.6, 1.18, 2.85], target: [-1.84, 1.0, 0.0], fov: 46 }, { pos: [-1.64, 1.16, 2.55], target: [-1.84, 1.0, 0.0], fov: 45 });
    lookCam(ctx, you);
    if (t < 0.6) face(you, 'open', 'neutral', 'neutral'); else { face(you, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1; }
    punch(ctx, 0.62, 1.08); shake(ctx, 0.62, 0.9, 0.006);
    if (t >= 0.62) { stinkPoop(ctx, 0.35 + 0.3 * smooth(invLerp(0.62, 1.6, t)), { burst: 0.65 }); sweat(ctx, 0.85, 'L'); }
  } },
  s02: { update(ctx) { // "In Singapore."
    move(ctx, { pos: [5.6, 7.6, 18.5], target: [-2.0, 1.4, -6.0], fov: 52 }, { pos: [5.1, 7.1, 16.6], target: [-2.0, 1.4, -6.0], fov: 51 });
    ctx.cam.handheld(0.0012);
    ctx.W.set.state.focus = [-2, C, 2]; ctx.W.set.state.shadowSize = 16;
    stinkPoop(ctx, 0.6, { height: 0.9, spread: 0.3 });
  } },
  s03: { update(ctx) { // "One of the cleanest…"
    const { W, t } = ctx, a = t * 0.6, rb = [SPOTS.robot.pos[0] + Math.cos(a) * 0.5, C, SPOTS.robot.pos[1] + Math.sin(a) * 0.35];
    ctx.cam.set({ pos: [rb[0] + 0.95, 0.62, rb[2] + 1.3], target: [rb[0], 0.2, rb[2]], fov: 44 });
    ctx.cam.handheld(0.0015);
    W.set.state.focus = rb; W.set.state.shadowSize = 4;
    sparkles(ctx, rb, 0.9, 12, { size: 1.0 });
    if (t >= 3.92) W.fx.glint({ at: [rb[0], 0.36, rb[2]], t0: 3.92, t, size: 2.4 });
  } },
  s04: { update(ctx) { // "…cities in the world."
    const { W, t } = ctx;
    move(ctx, { pos: [150, 175, 250], target: [-30, 40, -140], fov: 46, near: 1 }, { pos: [168, 190, 282], target: [-30, 40, -140], fov: 48, near: 1 }, (u) => u);
    W.set.state.focus = [0, 0, -100]; W.set.state.shadowSize = 160;
    for (let i = 0; i < 9; i++) { const ph = (t + hash1(i) * 0.9) % 0.9; W.fx.glint({ at: [-120 + hash1(i * 3.3) * 240, 70 + hash1(i * 7.7) * 110, -300 + hash1(i * 1.9) * 330], t0: t - ph, t, size: 60 }); }
  } },
  s05: { update(ctx) { // "The street is so clean…"
    const { W } = ctx;
    move(ctx, { pos: [-3.3, 0.27, 6.6], target: [-3.7, 0.5, -6.0], fov: 52 }, { pos: [-2.7, 0.27, 6.4], target: [-3.6, 0.5, -6.0], fov: 51 }, (u) => u);
    W.set.state.focus = [-3.2, C, 1]; W.set.state.shadowSize = 9;
    sparkles(ctx, [-3.3, C, 2.5], 2.6, 16, { size: 1.6 });
  } },
  s06: { update(ctx) { // "…it shines."
    const { W, t } = ctx;
    move(ctx, { pos: [-1.3, 0.58, 1.3], target: [-1.62, 0.24, 0.32], fov: 40 }, { pos: [-1.33, 0.55, 1.18], target: [-1.62, 0.24, 0.32], fov: 39 });
    W.set.state.focus = P.poop; W.set.state.shadowSize = 3;
    sparkles(ctx, P.poop, 0.95, 18, { size: 0.9, avoidPoop: true, avoidR: 0.25 });
    if (t >= 7.45) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; W.fx.glint({ at: [P.poop[0] + Math.cos(a) * 0.35, C + 0.01, P.poop[2] + Math.sin(a) * 0.3], t0: 7.45 + i * 0.03, t, size: 2.0 }); }
    stinkPoop(ctx, 0.75, { height: 0.5 });
    punch(ctx, 7.45, 1.08);
  } },
  s07: { update(ctx) { // "So, everyone notices."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-2.5, 1.86, -1.15], target: [-2.2, 1.45, 5.2], fov: 52 }, { pos: [-2.5, 1.85, -1.0], target: [-2.2, 1.45, 5.2], fov: 50 });
    W.set.state.focus = [-2.5, C, 3.5]; W.set.state.shadowSize = 8;
    you.p.shoulderUp = 1;
    const names = ['man', 'lady', 'extra0', 'extra1', 'extra2', 'extra3', 'extra4'];
    for (const [i, n] of names.entries()) {
      const ch = W.cast[n];
      if (t < 9.3) { ch.p.lookAt = null; ch.p.headYaw = i % 2 ? 0.75 : -0.75; ch.p.mouth = 'neutral'; ch.p.eyes = 'open'; }
    }
    punch(ctx, 9.45, 1.12);
    stinkPoop(ctx, 0.6, { height: 0.8, spread: 0.25 });
  } },
  s08: { update(ctx) { // "A man stops."
    const { W, t } = ctx, man = W.cast.man, cup = W.set.props.coffee, sp = SPOTS.man, d = dirOf(sp.rotY);
    move(ctx, { pos: at(sp.pos, -0.3, 2.7, 1.45, d), target: [-0.2, 1.08, 4.6], fov: 46 }, { pos: at(sp.pos, -0.3, 2.45, 1.45, d), target: [-0.2, 1.1, 4.6], fov: 45 });
    W.set.state.focus = [-0.2, C, 4.6]; W.set.state.shadowSize = 4;
    lookCam(ctx, man); face(man, 'wide', 'raised', 'o');
    // frozen mid-step: right foot in the air
    man.p.footR = at(sp.pos, 0.1, 0.34, C + 0.075 * 1.01 + 0.18, d); man.p.footL = at(sp.pos, -0.1, -0.16, C, d);
    const jolt = t >= 10.62 ? Math.exp(-(t - 10.62) * 7) * Math.sin((t - 10.62) * 30) * 0.25 : 0;
    const cp = at(sp.pos, 0.2, 0.3, 1.1 + (t >= 10.62 ? 0.03 * Math.exp(-(t - 10.62) * 5) : 0), d);
    cup.visible = true; cup.position.set(cp[0], cp[1], cp[2]); cup.rotation.set(jolt, sp.rotY, jolt * 0.6);
    man.p.gripR = { prop: cup, up: d.r };
    // splash drops
    const top = [cp[0], cp[1] + 0.15, cp[2]];
    W.set.props.splash.forEach((m, i) => {
      const tau = t - 10.62; if (tau < 0 || tau > 0.65) return;
      const a = hash1(i * 3.3) * 6.28, s = 0.3 + hash1(i * 1.7) * 0.5, vy = 0.9 + hash1(i * 7.1) * 0.9;
      m.visible = true; m.position.set(top[0] + Math.cos(a) * s * tau, Math.max(C + 0.01, top[1] + vy * tau - 4.9 * tau * tau), top[2] + Math.sin(a) * s * tau);
    });
    punch(ctx, 10.5, 1.12);
  } },
  s09: { update(ctx) { // "A lady drops her shopping bag."
    const { W, t } = ctx, lady = W.cast.lady, bag = W.set.props.bag, sp = SPOTS.lady, d = dirOf(sp.rotY);
    move(ctx, { pos: at(sp.pos, 0.25, 2.45, 1.3, d), target: [-4.45, 0.92, 3.45], fov: 50 }, { pos: at(sp.pos, 0.25, 2.3, 1.28, d), target: [-4.45, 0.92, 3.45], fov: 49 });
    W.set.state.focus = [-4.4, C, 3.3]; W.set.state.shadowSize = 4;
    lookCam(ctx, lady, [1.2, 0, 0]); face(lady, 'wide', 'raised', 'o');
    const hand = at(sp.pos, 0.24, 0.1, 0.82, d);
    const fallU = clamp((t - 12.0) / 0.62), drop = fallU * fallU;
    const by = lerp(hand[1] - 0.4, C, drop);
    bag.visible = true; bag.rotation.set(0, sp.rotY, 0);
    if (t >= 12.0) bag.rotateX(-1.2 * smooth(invLerp(12.35, 12.75, t)));
    bag.position.set(hand[0] + d.f[0] * 0.12 * fallU, by, hand[2] + d.f[2] * 0.12 * fallU);
    if (t < 12.0) lady.p.gripR = bag;
    else { lady.p.handR = at(sp.pos, 0.14, 0.12, 1.5, d); lady.p.handL = at(sp.pos, -0.14, 0.12, 1.5, d); lady.p.handPoseR = lady.p.handPoseL = 'open'; }
    // oranges
    const start = [bag.position.x, Math.max(bag.position.y + 0.3, C + 0.2), bag.position.z];
    const s0 = [hand[0] + d.f[0] * 0.08, 0.6, hand[2] + d.f[2] * 0.08];
    W.set.props.oranges.forEach((o, i) => { const r = orangeAt(i, t, s0); if (!r) return; o.visible = true; o.position.set(...r.pos); o.rotation.set(r.rot, i, r.rot * 0.5); });
    void start;
    if (t >= 12.62) W.fx.impact({ at: [bag.position.x, C + 0.01, bag.position.z], t0: 12.62, t, size: 0.6 });
  } },
  s10: { update(ctx) { // "A kid points."
    const { W, t } = ctx, kid = W.cast.kid, sp = SPOTS.kid, d = dirOf(sp.rotY);
    const camPos = at(sp.pos, 0.05, 1.05, 1.18, d);
    move(ctx, { pos: camPos, target: [-3.99, 1.05, -2.39], fov: 42 }, { pos: at(sp.pos, 0.05, 0.92, 1.18, d), target: [-3.99, 1.07, -2.39], fov: 41 });
    W.set.state.focus = [-4, C, -2.4]; W.set.state.shadowSize = 3;
    lookCam(ctx, kid); face(kid, 'wide', 'raised', 'laugh'); kid.p.talk = 1;
    const sh = v3(at(sp.pos, 0.12, 0.02, 1.05, d)), dir = v3(camPos).sub(sh).normalize();
    kid.p.handR = sh.clone().addScaledVector(dir, 0.34).toArray(); kid.p.handPoseR = 'point';
    // balloon on a string in the left hand
    const hl = at(sp.pos, -0.2, 0.05, 0.9, d); kid.p.handL = hl; kid.p.handPoseL = 'fist';
    const bal = W.set.props.balloon, str = W.set.props.balloonString;
    const bp = [hl[0] + 0.12 + noise1(t * 0.8, 3) * 0.05, hl[1] + 0.85 + noise1(t * 0.6, 5) * 0.03, hl[2] - 0.05];
    bal.visible = true; bal.position.set(...bp);
    str.visible = true; str.geometry.attributes.position.setXYZ(0, hl[0], hl[1] + 0.03, hl[2]); str.geometry.attributes.position.setXYZ(1, bp[0], bp[1] - 0.2, bp[2]); str.geometry.attributes.position.needsUpdate = true;
    punch(ctx, 13.9, 1.18); shake(ctx, 13.9, 14.2, 0.004);
  } },
};
