// s21-s29: didn't even use a toilet, writing, the receipt prints, piles, rolls down the street, reaches the airport, sunset.
import { P, C, OFF, offPt, move, punch, shake, win, kf, placeProp, propPoint, lookCam, face, stinkPoop, sweat, sparkles, smooth, invLerp, lerp, clamp, noise1, v3 } from './shotlib.js';
import { AIRPORT } from './layout.js';

const RECEIPT_ARRIVE = 42.29; // when the receipt's end reaches the plane's nose wheel (see set.receiptLength + path length)

// notebook open in his left hand, pen in his right hand scribbling (speed = scribble rate)
function writing(ctx, speed = 1) {
  const { W, t } = ctx, off = W.cast.officer, nb = W.set.props.notebook, pen = W.set.props.pen;
  const nbPos = offPt(-0.06, 1.24, 0.33);
  placeProp(nb, nbPos, OFF.f, [0, 1, 0]);
  off.p.gripL = { prop: nb, up: [0, -1, 0] };
  const row = Math.floor(t * 2.2 * speed) % 7, sx = Math.sin(t * 34 * speed) * 0.022 + ((t * 2.2 * speed) % 1 - 0.5) * 0.06;
  const tip = v3(nbPos).add(v3(OFF.r).multiplyScalar(sx)).add(v3(OFF.f).multiplyScalar(0.045 - row * 0.012)).add(v3([0, 0.008 + Math.max(0, Math.sin(t * 34 * speed)) * 0.004, 0]));
  const axis = v3([0, -1, 0]).multiplyScalar(0.75).add(v3(OFF.f).multiplyScalar(0.35)).add(v3(OFF.r).multiplyScalar(-0.2));
  placeProp(pen, tip.toArray(), axis.toArray(), OFF.f, pen.userData.tip);
  off.p.gripR = { prop: pen, up: OFF.r };
  off.p.lookAt = nbPos; face(off, 'open', 'angry', 'tight');
  return nbPos;
}

// printer in his right hand; the receipt comes out of the slot
function printing(ctx) {
  const { W } = ctx, off = W.cast.officer, pr = W.set.props.printer;
  const pos = offPt(0.12, 1.2, 0.33);
  pr.visible = true; pr.position.set(pos[0], pos[1] - 0.07, pos[2]); pr.rotation.set(0, Math.atan2(OFF.f[0], OFF.f[2]), 0); pr.updateMatrixWorld(true);
  off.p.gripR = { prop: pr, up: OFF.r.map((v) => -v) };
  const slot = propPoint(pr, pr.userData.slot);
  W.set.state.receiptStart = slot.toArray(); W.set.state.receiptDir = OFF.f;
  off.p.lookAt = pos; face(off, 'open', 'angry', 'tight');
  return pos;
}

export const shots = {
  s21: { update(ctx) { // "And you didn't even use a toilet."
    const { W, t } = ctx, you = W.cast.you;
    move(ctx, { pos: [-1.1, 1.05, 2.75], target: [-1.7, 0.95, 0.3], fov: 50 }, { pos: [-1.15, 1.02, 2.5], target: [-1.7, 0.95, 0.3], fov: 49 });
    W.set.state.focus = [-1.6, C, 0.4]; W.set.state.shadowSize = 4;
    face(you, 'wide', 'worried', 'grimace'); lookCam(ctx, you);
    you.p.handL = [-1.9, 1.89, 0.02]; you.p.handR = [-2.1, 1.89, 0.02]; you.p.handPoseL = you.p.handPoseR = 'flat';
    stinkPoop(ctx, 0.95, { height: 0.75, spread: 0.2, burst: 30.75 });
    sparkles(ctx, [-1.5, C, 0.8], 1.3, 14, { size: 1.0, avoidPoop: true, avoidR: 0.4 });
    punch(ctx, 30.75, 1.06); punch(ctx, 31.96, 1.1);
  } },
  s22: { update(ctx) { // "He starts writing."
    const { W } = ctx;
    const nbPos = writing(ctx, 1);
    move(ctx, { pos: offPt(-0.02, 1.62, 0.62), target: nbPos, fov: 38 }, { pos: offPt(-0.02, 1.58, 0.56), target: nbPos, fov: 36 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
  } },
  s23: { update(ctx) { // "And writing."
    const { W, t } = ctx;
    const nbPos = writing(ctx, 2.6);
    move(ctx, { pos: offPt(0.3, 1.7, 1.35), target: offPt(-0.02, 1.58, 0.1), fov: 44 }, { pos: offPt(0.28, 1.68, 1.25), target: offPt(-0.02, 1.58, 0.1), fov: 42 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
    W.fx.lines({ at: [nbPos[0], nbPos[1] + 0.05, nbPos[2]], t0: 33.95, t, count: 4 });
    shake(ctx, 33.95, 35.0, 0.004, 30);
  } },
  s24: { update(ctx) { // "The receipt starts printing."
    const { W } = ctx;
    const pos = printing(ctx);
    move(ctx, { pos: offPt(-0.1, 1.43, 0.82), target: [pos[0], pos[1] + 0.05, pos[2]], fov: 39 }, { pos: offPt(-0.1, 1.41, 0.74), target: [pos[0], pos[1] + 0.05, pos[2]], fov: 37 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
  } },
  s25: { update(ctx) { // "It's still printing."
    const { W } = ctx, you = W.cast.you;
    const pos = printing(ctx);
    move(ctx, { pos: [0.55, 1.42, -1.9], target: [-1.5, 1.0, 0.45], fov: 50 }, { pos: [0.62, 1.44, -2.0], target: [-1.5, 1.0, 0.45], fov: 52 });
    you.p.rotY = 0.78;
    W.set.state.focus = [-1.4, C, 0.5]; W.set.state.shadowSize = 4;
    you.p.lookAt = [pos[0], 0.7, pos[2]]; face(you, 'wide', 'raised', 'open'); you.p.talk = 1;
    stinkPoop(ctx, 0.6);
  } },
  s26: { update(ctx) { // "It touches the ground."
    const { W } = ctx;
    printing(ctx);
    move(ctx, { pos: offPt(0.75, 0.42, 0.95), target: offPt(0.12, 0.2, 0.42), fov: 46 }, { pos: offPt(0.7, 0.38, 0.85), target: offPt(0.12, 0.18, 0.42), fov: 44 });
    W.set.state.focus = [-1.05, C, 0.95]; W.set.state.shadowSize = 3;
  } },
  s27: { update(ctx) { // "It rolls down the street."
    const { W } = ctx;
    printing(ctx);
    move(ctx, { pos: [6.2, 4.3, 7.5], target: [4.0, 0.6, -60], fov: 40 }, { pos: [5.9, 3.9, 2.0], target: [4.0, 0.6, -60], fov: 40 }, (u) => u);
    W.set.state.focus = [3, 0, -10]; W.set.state.shadowSize = 30;
  } },
  s28: { update(ctx) { // "It reaches the airport."
    const { W } = ctx;
    printing(ctx);
    move(ctx, { pos: [-4.4, 3.4, AIRPORT.z + 18], target: [-6, 0.45, AIRPORT.z + 0.6], fov: 50 }, { pos: [-4.8, 2.6, AIRPORT.z + 15.5], target: [-6, 0.5, AIRPORT.z + 0.6], fov: 50 }, (u) => u);
    W.set.state.focus = [-5, 0, AIRPORT.z + 6]; W.set.state.shadowSize = 22;
    // the receipt's end bumps into the tyre
    if (ctx.t >= RECEIPT_ARRIVE) { W.fx.impact({ at: [AIRPORT.planeX - 12, 0.03, AIRPORT.z + 0.5], t0: RECEIPT_ARRIVE, t: ctx.t, size: 0.9 }); punch(ctx, RECEIPT_ARRIVE, 1.06); }
  } },
  s29: { update(ctx) { // "Enjoy your trip to Singapore."
    const { W, t } = ctx, S = W.set.state;
    printing(ctx);
    move(ctx, { pos: [30, 260, 470], target: [0, 120, -300], fov: 50, near: 1 }, { pos: [34, 280, 520], target: [0, 125, -300], fov: 52, near: 1 }, (u) => u);
    S.sunset = 1; S.giant = true; S.focus = [0, 0, -150]; S.shadowSize = 260;
    S.planeT = smooth(invLerp(42.9, 45.9, t));
    W.fx.stink({ at: [0, 160, -120], amount: 1, spread: 260, gap: 0, height: 260, seed: 21, t, thick: 2.2 });
    punch(ctx, 45.15, 1.04, 0.1);
  } },
};
