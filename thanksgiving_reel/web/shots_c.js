// s11-s15: Uncle looks up, "Somebody's hungry!", everyone laughs, YOU laughs too, Grandma adds mashed potatoes.
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, placeProp, propPoint, smooth, invLerp, lerp, clamp, easeOut, noise1, v3 } from './shotlib.js';
import { kf } from './shots_b.js';

// uncle's fork resting in his right hand above his plate (tines down toward the plate)
function uncleForkRest(ctx, lift = 0) {
  const { W } = ctx, u = W.cast.uncle, f = W.set.props.places.uncle.fork;
  placeProp(f, [0.07, 0.83 + lift, 0.4], [0.0, -0.55, -0.85], [0.25, 0.8, -0.5], f.userData.tip);
  u.p.gripR = f;
}

export const shots = {
  s11: { update(ctx) { // "Your uncle looks up."
    const { W, t } = ctx, u = W.cast.uncle;
    move(ctx, { pos: [0.04, 1.33, -0.1], target: [0, 1.04, 0.85], fov: 42 }, { pos: [0.04, 1.32, -0.04], target: [0, 1.04, 0.85], fov: 41 });
    u.p.eat = null; uncleForkRest(ctx);
    if (t < 17.25) { u.p.headPitch = -0.42; u.p.mouth = 'chew'; u.p.chewPh = Math.floor(t * 7) % 2; u.p.lookAt = null; u.p.eyes = 'open'; }
    else {
      const k = smooth((t - 17.25) / 0.18);
      if (k < 1) { u.p.headPitch = -0.42 * (1 - k); u.p.lookAt = null; } else lookCam(ctx, u);
      u.p.mouth = 'neutral'; u.p.brows = 'raised'; u.p.eyes = 'open';
    }
    W.set.props.candles[0].visible = false;
  } },
  s12: { update(ctx) { // "Somebody's hungry!" (Uncle)
    const { W, t } = ctx, u = W.cast.uncle, f = W.set.props.places.uncle.fork;
    move(ctx, { pos: [0.03, 1.28, 0.1], target: [0.02, 1.11, 0.87], fov: 38 }, { pos: [0.03, 1.27, 0.15], target: [0.02, 1.11, 0.87], fov: 37 });
    u.p.eat = null; lookCam(ctx, u);
    u.p.mouth = 'grin'; u.p.eyes = 'open'; u.p.brows = 'raised';
    if (t > 18.14 && t < 19.88) W.cast.helpers.talk(u, t, 1.0);
    // points at YOU (the camera) with his index finger, little jabs on the words
    const jab = 0.025 * Math.max(0, Math.sin((t - 18.1) * 9)) * win(t, 18.14, 19.88);
    uncleForkRest(ctx);
    u.p.gripR = null; u.p.handR = [0.13, 1.08 + jab * 0.3, 0.56 - jab]; u.p.handPoseR = 'point';
    u.p.lean = 0.08;
    punch(ctx, 19.08, 1.2);
  } },
  s13: { update(ctx) { // "Everyone laughs."
    const { W, t } = ctx, h = W.cast.helpers;
    move(ctx, { pos: [0.02, 1.74, -1.62], target: [0.02, 0.98, 0.8], fov: 70 }, { pos: [0.02, 1.72, -1.55], target: [0.02, 0.98, 0.8], fov: 68 });
    ctx.cam.handheld(0.002);
    for (const [i, n] of ['mom', 'uncle', 'dad', 'cousinA', 'cousinB', 'grandma'].entries()) {
      const ch = W.cast[n]; ch.p.eat = null; h.laugh(ch, t + i * 0.13, n === 'uncle' ? 1 : 0.75);
    }
    // uncle slaps the table
    const u = W.cast.uncle; u.p.handR = [0.24, 0.7612 + 0.06 * Math.max(0, Math.sin(t * 13)), 0.46]; u.p.handPoseR = 'flat';
    const you = W.cast.you; youFace(ctx, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1;
    stinkYou(ctx, 0.4, { height: 0.75 });
  } },
  s14: { update(ctx) { // "You laugh too."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-0.05, 1.28, 0.32], target: [0, 1.08, -0.74], fov: 31 }, { pos: [-0.04, 1.27, 0.26], target: [0, 1.08, -0.74], fov: 30 });
    lookCam(ctx, you, [0.3, 0, 0]);
    youFace(ctx, 'wide', 'worried', 'grimace');
    you.p.bounce = 0.35; you.p.shoulderUp = 1;
    sweatYou(ctx, 21.5, 'L'); sweatYou(ctx, 21.95, 'R');
    stinkYou(ctx, 0.45);
    W.set.props.candles[0].visible = false;
  } },
  s15: { update(ctx) { // "Grandma adds mashed potatoes."
    const { W, t } = ctx, g = W.cast.grandma, sp = W.set.props.bigSpoon, you = W.cast.you;
    move(ctx, { pos: [-0.1, 1.55, 0.5], target: [-0.18, 1.14, -0.55], fov: 50 }, { pos: [-0.08, 1.53, 0.44], target: [-0.16, 1.14, -0.55], fov: 49 });
    const tip = kf(t, [[22.65, [-0.2, 1.06, -0.2]], [23.7, [0.03, 0.9, -0.31]], [24.05, [0.035, 0.87, -0.315]], [24.75, [-0.15, 1.05, -0.25]]]);
    const roll = smooth(invLerp(23.85, 24.12, t));      // tip the spoon over to drop the potatoes
    const toward = v3([0.03, 0.85, -0.31]).sub(v3([g.p.pos[0], 0.85, g.p.pos[1]])).normalize();
    const axis = toward.clone().add(v3([0, -0.35 - 0.3 * roll, 0])).normalize();
    const side = v3([-toward.z, 0, toward.x]);
    const up = v3([0, 1, 0]).lerp(side.clone().multiplyScalar(-1), roll * 0.9).normalize();
    placeProp(sp, tip, axis, up, sp.userData.tip);
    W.set.state.spoonPotato = t < 24.15;
    g.p.gripL = { prop: sp, up: [-toward.x, 0.6, -toward.z] };
    g.p.lookAt = P.youPlate; g.p.mouth = 'smile'; g.p.eyes = 'happy';
    you.p.lookAt = [0.03, 0.82, -0.33]; youFace(ctx, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1;
    if (t >= 24.15) W.fx.impact({ at: [0.035, 0.81, -0.315], t0: 24.15, t, size: 0.5 });
    stinkYou(ctx, 0.45, { height: 0.8 });
    W.set.props.candles[0].visible = false;
  } },
};
