// s06-s10: Grandma serves turkey, it lands on the plate, the first bite, the stomach rumbles, LOUD.
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, placeProp, propPoint, smooth, invLerp, lerp, clamp, easeOut, v3 } from './shotlib.js';

// piecewise-linear keyframes [[t, value], ...] for numbers or [x,y,z] arrays
function kf(t, keys, ease = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, a] = keys[i - 1], [t1, b] = keys[i], u = ease((t - t0) / (t1 - t0));
      return Array.isArray(a) ? a.map((v, k) => lerp(v, b[k], u)) : lerp(a, b, u);
    }
  }
  return keys[keys.length - 1][1];
}
export { kf };

// Grandma holds the serving fork (left hand), tines down, with the turkey slice on it
function serveFork(ctx, tip, sliceOn = true) {
  const { W } = ctx, sf = W.set.props.servingFork, g = W.cast.grandma;
  const away = v3(tip).sub(v3([g.p.pos[0], 0, g.p.pos[1]])); away.y = 0; away.normalize();
  const axis = v3([away.x * 0.35, -0.9, away.z * 0.35]);
  placeProp(sf, tip, axis, [away.x, 0.2, away.z], sf.userData.tip);
  g.p.gripL = { prop: sf, up: [-away.x, 0.35, -away.z] };
  const sl = W.set.props.turkeySlice;
  if (sliceOn) { const at = propPoint(sf, sf.userData.skewer); sl.position.copy(at).add(v3([0, -0.014, 0])); sl.rotation.set(0.12, 0.6, 0.05); sl.visible = true; }
  g.p.lookAt = P.youPlate; g.p.mouth = 'smile'; g.p.eyes = 'happy';
}

// YOU eats one bite from his plate (phase keys map shot time -> bite phase), food shows on the fork until the bite
function youBite(ctx, keys, food, from) {
  const { W, t } = ctx, you = W.cast.you;
  const ph = kf(t, keys, (u) => u);
  W.cast.helpers.eat(you, ph, { fork: W.set.props.yourFork, from });
  W.set.state.forkFood = ph < 0.6 ? food : null;
  return ph;
}
export { youBite };

export const shots = {
  s06: { update(ctx) { // "Then Grandma puts turkey…"
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-0.12, 1.5, 0.5], target: [-0.2, 1.12, -0.55], fov: 50 }, { pos: [-0.1, 1.48, 0.44], target: [-0.18, 1.12, -0.55], fov: 49 });
    W.cast.grandma.p.rotY = Math.PI * 0.16;
    const tip = kf(t, [[9.72, [-0.31, 0.97, -0.16]], [10.3, [-0.27, 1.06, -0.2]], [11.25, [-0.04, 0.97, -0.31]]]);
    serveFork(ctx, tip);
    you.p.lookAt = [-0.15, 1.0, -0.25]; youFace(ctx, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1;
    stinkYou(ctx, 0.3, { height: 0.7 });
    W.set.props.candles[0].visible = false;
  } },
  s07: { update(ctx) { // "…on your plate."
    const { W, t } = ctx, sl = W.set.props.turkeySlice;
    move(ctx, { pos: [0.16, 1.28, 0.16], target: [-0.02, 0.84, -0.33], fov: 42 }, { pos: [0.15, 1.26, 0.13], target: [-0.02, 0.84, -0.33], fov: 41 });
    ctx.cam.handheld(0.001);
    W.cast.grandma.p.rotY = Math.PI * 0.16;
    const tip = kf(t, [[11.25, [-0.16, 0.99, -0.3]], [11.72, [-0.01, 0.865, -0.335]], [11.9, [-0.01, 0.86, -0.335]], [12.45, [-0.2, 1.06, -0.36]]]);
    if (t < 11.9) serveFork(ctx, tip, true);
    else {
      serveFork(ctx, tip, false);
      // slice falls the last few cm onto the plate with a tiny bounce
      const home = sl.position.clone(), u = clamp((t - 11.9) / 0.1);
      const drop = (1 - easeOut(u)) * 0.02 + Math.max(0, Math.sin((t - 12.0) * 30)) * 0.004 * Math.exp(-(t - 12.0) * 12) * (t > 12.0 ? 1 : 0);
      sl.position.copy(home).add(v3([0, drop, 0]));
    }
    if (t >= 11.9) W.fx.impact({ at: [-0.03, 0.79, -0.34], t0: 11.9, t, size: 0.6 });
    W.set.props.candles[0].visible = false;
  } },
  s08: { update(ctx) { // "You take one bite."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.06, 1.27, 0.36], target: [0, 1.06, -0.74], fov: 32 }, { pos: [0.05, 1.26, 0.3], target: [0, 1.07, -0.74], fov: 31 });
    youFace(ctx, 'wide', 'worried', 'neutral');
    youBite(ctx, [[12.45, 0.12], [13.3, 0.56], [13.92, 0.92]], 'turkey', [-0.035, 0.8, -0.35]);
    if (t < 12.95) you.p.lookAt = [0, 0.78, -0.35]; else lookCam(ctx, you);
    stinkYou(ctx, 0.35);
    W.set.props.candles[0].visible = false;
  } },
  s09: { update(ctx) { // "Your stomach rumbles."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.6, 0.87, -0.5], target: [0.0, 0.76, -0.76], fov: 47 }, { pos: [0.58, 0.86, -0.51], target: [0.0, 0.76, -0.76], fov: 44 });
    const rum = win(t, 14.55, 15.4, 0.08, 0.2);
    you.p.bellyWobble = rum; you.p.lean = 0.06;
    you.p.handL = [0.075, 0.7, -0.735]; you.p.handPoseL = 'flat'; you.p.handRotL = [0, 0, Math.PI / 2];
    you.p.handR = [-0.075, 0.7, -0.735]; you.p.handPoseR = 'flat'; you.p.handRotR = [0, 0, -Math.PI / 2];
    youFace(ctx, 'wide', 'worried', 'tight');
    if (rum > 0) W.fx.rumble({ at: [0, 0.69, -0.71], amount: 0.55 * rum, t });
    shake(ctx, 14.55, 15.4, 0.005, 26);
    stinkYou(ctx, 0.3, { at: [0, 0.55, -0.92], height: 0.45, spread: 0.25, gap: 0.2 });
  } },
  s10: { update(ctx) { // "Loud."
    const { W, t } = ctx;
    move(ctx, { pos: [0.07, 0.97, 0.2], target: [-0.12, 0.82, -0.22], fov: 46 }, { pos: [0.06, 0.97, 0.18], target: [-0.12, 0.82, -0.22], fov: 45 });
    const k = win(t, 15.55, 16.4, 0.05, 0.15);
    W.set.state.rattle = k; W.set.state.glassRipple = k; W.set.state.candleFlicker = k;
    punch(ctx, 15.65, 1.22); shake(ctx, 15.55, 16.4, 0.012, 24);
  } },
};
