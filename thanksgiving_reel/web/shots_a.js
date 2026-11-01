// s01-s05: the opening. YOU frozen, the dining room, the family, sitting very still, nobody notices.
import { P, move, punch, shake, win, stinkYou, sweatYou, youFace, lookCam, smooth, invLerp, noise1, clamp } from './shotlib.js';

export const shots = {
  s01: { update(ctx) { // "You just pooped your pants."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [0.08, 1.33, 0.55], target: [0, 1.02, -0.72], fov: 36 }, { pos: [0.07, 1.32, 0.47], target: [0, 1.02, -0.72], fov: 35 });
    lookCam(ctx, you);
    if (t < 1.3) { youFace(ctx, 'open', 'neutral', 'neutral'); }
    else { youFace(ctx, 'wide', 'worried', 'tight'); you.p.shoulderUp = 1; you.p.lean = -0.04; }
    punch(ctx, 1.3, 1.18); shake(ctx, 1.3, 1.6, 0.006);
    if (t >= 1.3) { stinkYou(ctx, 0.25 + 0.2 * smooth(invLerp(1.3, 2.3, t)), { burst: 1.32 }); sweatYou(ctx, 1.38, 'L'); }
    W.set.props.candles[0].visible = false;
  } },
  s02: { update(ctx) { // "At Thanksgiving dinner."
    move(ctx, { pos: [2.35, 2.0, 2.2], target: [-0.15, 0.82, -0.3], fov: 52 }, { pos: [2.15, 1.92, 1.98], target: [-0.15, 0.85, -0.3], fov: 50 });
    ctx.cam.handheld(0.0015);
    const you = ctx.W.cast.you; you.p.shoulderUp = 1; youFace(ctx, 'wide', 'worried', 'tight');
    stinkYou(ctx, 0.3);
    for (const c of ['mom', 'uncle', 'dad', 'cousinA', 'cousinB', 'grandma']) if (!ctx.W.cast[c].p.eat) ctx.W.cast[c].p.mouth = 'smile';
  } },
  s03: { update(ctx) { // "The whole family is here."
    const { W, t } = ctx;
    move(ctx, { pos: [-1.95, 1.72, -1.6], target: [-0.1, 0.95, 0.5], fov: 60 }, { pos: [-1.8, 1.7, -1.62], target: [0.0, 0.95, 0.5], fov: 58 }, (u) => u);
    ctx.cam.handheld(0.001);
    // the family is happy: smiles, chatting, laughing a little
    for (const [i, n] of ['mom', 'uncle', 'dad', 'cousinB'].entries()) {
      const ch = W.cast[n];
      if (!ch.p.eat) { ch.p.mouth = i % 2 ? 'smile' : 'laugh'; ch.p.eyes = i % 2 ? 'open' : 'happy'; ch.p.headYaw = 0; }
    }
    W.set.props.candles[1].visible = false; W.set.props.candles[0].visible = false;
  } },
  s04: { update(ctx) { // "You sit very, very still."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-0.03, 1.46, 0.64], target: [0, 0.92, -0.6], fov: 50 }, { pos: [-0.03, 1.44, 0.55], target: [0, 0.93, -0.6], fov: 49 }, (u) => u);
    ctx.cam.handheld(0.0008);
    you.p.shoulderUp = 1; you.p.lean = -0.05;
    you.p.handL = [0.275, 0.7612, -0.49]; you.p.handPoseL = 'flat';
    you.p.handR = [-0.275, 0.7612, -0.49]; you.p.handPoseR = 'flat';
    youFace(ctx, 'wide', 'worried', 'tight');
    // only the eyes dart left and right
    const dart = Math.sign(noise1(t * 1.6, 4)) * (Math.abs(noise1(t * 1.6, 4)) > 0.25 ? 1 : 0);
    you.p.pupils = [dart, 0];
    sweatYou(ctx, 6.5, 'L');
    stinkYou(ctx, 0.3);
    W.set.props.candles[0].visible = false;
  } },
  s05: { update(ctx) { // "Nobody notices."
    const { W, t } = ctx;
    move(ctx, { pos: [-0.22, 1.36, -1.42], target: [0.12, 1.08, 0.9], fov: 46 }, { pos: [-0.21, 1.35, -1.38], target: [0.12, 1.08, 0.9], fov: 45 });
    ctx.cam.handheld(0.0015);
    const you = W.cast.you; you.p.shoulderUp = 1;
    // family chats among themselves, nobody looks at YOU
    const mom = W.cast.mom, uncle = W.cast.uncle, dad = W.cast.dad;
    mom.p.eat = null; mom.p.lookAt = [0, 1.24, 0.95]; mom.p.mouth = 'smile'; W.cast.helpers.talk(mom, t, 0.9);
    uncle.p.eat = null; uncle.p.lookAt = [-0.85, 1.17, 0.9]; uncle.p.mouth = 'grin'; W.cast.helpers.talk(uncle, t + 3, 1);
    dad.p.lookAt = [0, 1.24, 0.95]; dad.p.mouth = 'laugh'; dad.p.eyes = 'happy';
    if (dad.p.eat) dad.p.eat = null;
    stinkYou(ctx, 0.35, { height: 0.7 });
  } },
};
