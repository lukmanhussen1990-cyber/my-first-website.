// s24-s29: you stop eating, the table goes quiet, Grandma stares, the third plate, horror, "You look skinny."
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, placeProp, smooth, invLerp, lerp, clamp, easeOut, v3 } from './shotlib.js';
import { kf } from './shots_b.js';

export const shots = {
  s24: { update(ctx) { // "You stop eating."
    const { W, t } = ctx, you = W.cast.you, f = W.set.props.yourFork;
    move(ctx, { pos: [-0.16, 1.02, -0.06], target: [-0.01, 0.8, -0.38], fov: 38 }, { pos: [-0.15, 1.0, -0.09], target: [-0.01, 0.8, -0.38], fov: 36 });
    // fork lowered slowly and laid on the plate (tines on the plate, handle on the rim)
    const tip = kf(t, [[39.1, [-0.03, 0.96, -0.46]], [39.85, [0.0, 0.797, -0.34]]]);
    const axis = kf(t, [[39.1, [0.15, -0.35, 0.92]], [39.85, [0.16, -0.22, 0.96]]]);
    placeProp(f, tip, axis, [0, 1, 0], f.userData.tip);
    if (t < 39.95) you.p.gripR = f;
    else { you.p.handR = [-0.08, 0.7612, -0.52]; you.p.handPoseR = 'flat'; }
    youFace(ctx, 'wide', 'sad', 'tight');
    if (t >= 39.85) W.fx.lines({ at: [0.0, 0.8, -0.34], t0: 39.85, t, count: 3 });
    W.set.props.candles[0].visible = false;
  } },
  s25: { update(ctx) { // "The whole table goes quiet."
    const { W, t } = ctx;
    move(ctx, { pos: [0.22, 1.86, 2.3], target: [0, 0.92, -0.45], fov: 62 }, { pos: [0.2, 1.83, 2.16], target: [0, 0.92, -0.45], fov: 60 });
    ctx.cam.handheld(0.0008);
    W.fx.haze({ at: [0, 1.0, -0.82], radius: 0.5, amount: 0.55, t });
    stinkYou(ctx, 0.55, { height: 0.9 });
    youFace(ctx, 'wide', 'worried', 'tight'); W.cast.you.p.shoulderUp = 1;
    for (const n of ['mom', 'uncle', 'dad', 'cousinA', 'cousinB', 'grandma']) { const ch = W.cast[n]; ch.p.eyes = 'stare'; ch.p.mouth = 'neutral'; }
  } },
  s26: { update(ctx) { // "Grandma stares at you."
    const { W, t } = ctx, g = W.cast.grandma;
    move(ctx, { pos: [-0.02, 1.43, 0.0], target: [-0.4, 1.41, -0.72], fov: 30 }, { pos: [-0.06, 1.43, -0.06], target: [-0.4, 1.41, -0.72], fov: 28 }, (u) => u);
    ctx.cam.handheld(0);
    lookCam(ctx, g);
    g.p.eyes = 'stare'; g.p.brows = 'angry'; g.p.mouth = 'tight';
    if (t >= 42.9) {
      const head = v3(P.gmaHead), cam = v3(ctx.cam.spec.pos);
      const toCam = cam.clone().sub(head).normalize();
      const side = v3([toCam.z, 0, -toCam.x]).normalize();
      const at = head.clone().addScaledVector(toCam, 0.1).addScaledVector(side, -0.03).add(v3([0, 0.008, 0]));
      W.fx.glint({ at: at.toArray(), t0: 42.9, t });
    }
  } },
  s27: { update(ctx) { // "Then she serves you a third plate."
    const { W, t } = ctx, g = W.cast.grandma, you = W.cast.you, tp = W.set.props.thirdPlate;
    move(ctx, { pos: [-0.1, 1.55, 0.52], target: [-0.16, 1.1, -0.52], fov: 50 }, { pos: [-0.08, 1.53, 0.46], target: [-0.14, 1.1, -0.52], fov: 49 });
    if (t < 45.8) {
      W.set.state.thirdPlate = 'held';
      const home = tp.position.clone();
      const p = kf(t, [[44.05, [-0.32, 1.12, -0.36]], [45.0, [-0.18, 1.0, -0.36]], [45.62, [home.x, home.y + 0.06, home.z]], [45.8, [home.x, home.y, home.z]]], (u) => u * u * (3 - 2 * u));
      tp.position.set(p[0], p[1], p[2]);
      if (t > 45.55) W.set.state.plate = { turkey: false, potatoes: false, gravy: 0 }; // hidden under the new plate
    }
    if (t < 46.05) g.p.gripL = { prop: tp, which: 'L', up: [0, 1, 0] };
    g.p.lookAt = [0, 0.9, -0.33]; g.p.mouth = 'smile'; g.p.eyes = 'happy';
    you.p.lean = -0.12 * smooth(invLerp(45.0, 45.8, t)); youFace(ctx, 'wide', 'worried', 'tight'); you.p.lookAt = [0, 0.85, -0.33]; you.p.shoulderUp = 1;
    if (t >= 45.8) { W.fx.impact({ at: [0, 0.8, -0.33], t0: 45.8, t, size: 0.9 }); W.set.state.rattle = win(t, 45.8, 46.15, 0.02, 0.2); }
    shake(ctx, 45.8, 46.1, 0.006, 26);
    stinkYou(ctx, 0.5, { height: 0.8 });
    W.set.props.candles[0].visible = false;
  } },
  s28: { update(ctx) { // (pause) horror
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.02, 1.22, -0.36], target: [0, 1.15, -0.76], fov: 34 }, { pos: [0.02, 1.22, -0.39], target: [0, 1.15, -0.76], fov: 33 }, (u) => u);
    punch(ctx, 46.4, 1.25, 0.05);
    youFace(ctx, 'wide', 'worried', 'o');
    you.p.lookAt = [0, 0.85, -0.33]; you.p.lean = -0.1; you.p.shoulderUp = 1;
    sweatYou(ctx, 46.42, 'L', { count: 2 });
    stinkYou(ctx, 0.6);
    shake(ctx, 46.4, 47.2, 0.003, 18);
    W.set.props.candles[0].visible = false;
  } },
  s29: { update(ctx) { // "You look skinny." (Grandma)
    const { W, t } = ctx, g = W.cast.grandma, you = W.cast.you;
    move(ctx, { pos: [0.06, 1.44, 0.04], target: [-0.3, 1.33, -0.74], fov: 42 }, { pos: [0.02, 1.44, -0.04], target: [-0.3, 1.33, -0.74], fov: 40 });
    lookCam(ctx, g);
    g.p.eyes = 'happy'; g.p.brows = 'raised'; g.p.mouth = 'smile';
    if (t > 47.31 && t < 48.85) W.cast.helpers.talk(g, t, 0.9);
    // pats YOU's shoulder
    const pat = 0.022 * Math.abs(Math.sin((t - 47.3) * 8)) * win(t, 47.35, 49.4);
    g.p.handL = [-0.16, 1.07 + pat, -0.83]; g.p.handPoseL = 'flat';
    youFace(ctx, 'wide', 'worried', 'tight'); you.p.lookAt = v3(P.gmaHead).toArray(); you.p.shoulderUp = 1;
    stinkYou(ctx, 0.45, { height: 0.8 });
    punch(ctx, 49.05, 1.06, 0.06);
  } },
};
