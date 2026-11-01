// s20-s23: the science bit in x-ray, then back to the table: every bite pushes things along.
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, smooth, invLerp, clamp } from './shotlib.js';
import { youBite } from './shots_b.js';

export const shots = {
  s20: { update(ctx) { // "the moment food hits your stomach,"
    const { W, t } = ctx, X = W.xray.state;
    ctx.scene = W.xray.scene;
    move(ctx, { pos: [0, 1.0, 1.85], target: [0, 0.9, 0], fov: 44 }, { pos: [0.05, 0.93, 1.25], target: [0.04, 0.87, 0], fov: 41 });
    ctx.cam.handheld(0.001);
    X.foodDrop = t < 30.5 ? -1 : clamp((t - 30.5) / 1.1);
    if (t >= 31.6) { X.foodDrop = -1; X.splash = clamp((t - 31.6) / 0.5); }
  } },
  s21: { update(ctx) { // "your gut gets a signal to make space."
    const { W, t } = ctx, X = W.xray.state;
    ctx.scene = W.xray.scene;
    move(ctx, { pos: [0.09, 0.83, 1.0], target: [0.05, 0.77, 0], fov: 40 }, { pos: [0.08, 0.8, 0.86], target: [0.05, 0.76, 0], fov: 39 });
    ctx.cam.handheld(0.001);
    X.zap = clamp((t - 32.85) / 0.6);
    X.alert = smooth(invLerp(33.3, 33.6, t));
    X.glow = 0.8 * smooth(invLerp(33.2, 33.7, t));
    X.squeeze = 0.35 * smooth(invLerp(33.4, 34.2, t)); X.flow = Math.max(0, t - 33.4) * 0.8;
    if (t > 33.1 && t < 33.5) punch(ctx, 33.1, 1.08);
  } },
  s22: { update(ctx) { // "It's called the gastrocolic reflex."
    const { W, t } = ctx, X = W.xray.state;
    ctx.scene = W.xray.scene;
    move(ctx, { pos: [0.0, 0.74, 0.7], target: [0.0, 0.71, 0], fov: 40 }, { pos: [0.0, 0.73, 0.56], target: [0.0, 0.7, 0], fov: 39 });
    X.squeeze = 1; X.flow = (t - 34.48) * 1.1 + 0.6; X.glow = 0.55; X.alert = 1 - smooth(invLerp(34.48, 34.9, t));
  } },
  s23: { update(ctx) { // "Every bite pushes things along."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.4, 1.22, 0.08], target: [0, 1.0, -0.72], fov: 42 }, { pos: [0.37, 1.2, 0.02], target: [0, 1.0, -0.72], fov: 40 });
    youFace(ctx, 'wide', 'sad', 'neutral');
    youBite(ctx, [[36.88, 0.12], [37.4, 0.56], [37.95, 0.93]], 'potato', [0.03, 0.84, -0.32]);
    if (t > 37.95) W.cast.helpers.chew(you, t);
    lookCam(ctx, you, [-0.25, -0.05, 0]);
    const r = win(t, 37.7, 38.9, 0.06, 0.2);
    you.p.bellyWobble = r; you.p.shoulderUp = 1;
    stinkYou(ctx, 0.75, { burst: [37.55, 37.95, 38.35, 38.75], height: 0.95 });
    shake(ctx, 37.7, 38.9, 0.01, 24);
    sweatYou(ctx, 37.0, 'R', { count: 2 });
    W.set.props.candles[0].visible = false;
  } },
};
