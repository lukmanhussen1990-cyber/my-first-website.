// s16-s19: gravy, every bite, it gets worse, DUN: what you don't know.
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, placeProp, smooth, invLerp, lerp, clamp, v3 } from './shotlib.js';
import { kf, youBite } from './shots_b.js';
import * as THREE from 'three';

export const shots = {
  s16: { update(ctx) { // "And gravy."
    const { W, t } = ctx, g = W.cast.grandma, boat = W.set.props.gravyBoat;
    move(ctx, { pos: [0.24, 1.2, 0.04], target: [-0.03, 0.87, -0.32], fov: 46 }, { pos: [0.23, 1.18, 0.01], target: [-0.03, 0.87, -0.32], fov: 44 });
    // boat: spout toward +X (toward the plate from Grandma's side), tilts to pour
    const tilt = lerp(0.12, 0.62, smooth(invLerp(24.85, 25.1, t))) * (1 - smooth(invLerp(25.8, 25.95, t)) * 0.7);
    boat.rotation.set(0, Math.PI, tilt);
    boat.updateMatrixWorld(true);
    const tipW = kf(t, [[24.75, [-0.06, 0.95, -0.32]], [25.05, [0.0, 0.905, -0.315]], [25.85, [0.012, 0.9, -0.315]], [25.95, [-0.02, 0.93, -0.32]]]);
    const tipL = v3(boat.userData.tip).applyQuaternion(boat.quaternion);
    boat.position.copy(v3(tipW)).sub(tipL);
    W.set.state.gravyPour = win(t, 25.05, 25.85, 0.08, 0.1);
    g.p.gripL = { prop: boat, up: [0, 1, 0] };
    g.p.lookAt = P.youPlate; g.p.mouth = 'smile'; g.p.eyes = 'happy';
    W.set.props.candles[0].visible = false;
  } },
  s17: { update(ctx) { // "Every bite,"
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.05, 1.27, 0.3], target: [0, 1.07, -0.74], fov: 31 }, { pos: [0.05, 1.26, 0.24], target: [0, 1.07, -0.74], fov: 30 });
    youFace(ctx, 'wide', 'worried', 'neutral');
    youBite(ctx, [[25.95, 0.14], [26.4, 0.56], [27.2, 0.93]], 'potato', [0.03, 0.84, -0.32]);
    if (t > 26.6) { you.p.brows = 'sad'; }
    lookCam(ctx, you);
    sweatYou(ctx, 26.0, 'L', { count: 2 });
    stinkYou(ctx, 0.6, { burst: 26.5 });
    W.set.props.candles[0].visible = false;
  } },
  s18: { update(ctx) { // "it gets worse."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.62, 1.08, -1.85], target: [0.0, 0.78, -0.88], fov: 52 }, { pos: [0.58, 1.06, -1.78], target: [0.0, 0.78, -0.88], fov: 49 });
    const r = win(t, 27.3, 28.3, 0.06, 0.2);
    you.p.legBounce = 1; you.p.bellyWobble = r; you.p.shoulderUp = 1;
    youFace(ctx, 'wide', 'worried', 'grimace');
    W.fx.stink({ at: [0, 0.52, -0.96], amount: 1.0, spread: 0.34, gap: 0.2, height: 1.0, seed: 9, t, burst: [27.4, 27.9] });
    if (r > 0) W.fx.rumble({ at: [0, 0.69, -0.71], amount: 0.8 * r, t });
    shake(ctx, 27.3, 28.3, 0.008, 24);
  } },
  s19: { update(ctx) { // DUN. "What you don't know:"
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.0, 1.21, -0.28], target: [0, 1.17, -0.74], fov: 34 }, { pos: [0.0, 1.21, -0.33], target: [0, 1.17, -0.74], fov: 32 }, (u) => u);
    ctx.cam.handheld(0);
    punch(ctx, 28.5, 1.12, 0.05);
    lookCam(ctx, you);
    youFace(ctx, 'wide', 'worried', 'tight');
    ctx.post.vignette = 0.9; ctx.post.dim = 0.08;
    W.set.state.lightDim = 0.55;
    W.set.props.candles[0].visible = false;
  } },
};
