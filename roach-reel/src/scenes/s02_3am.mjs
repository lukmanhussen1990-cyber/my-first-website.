// S2 "It's 3 a.m. You're peeing half asleep with your eyes closed."
import { W, H, E, tw, kf, clamp, lerp, noise1, wobble } from '../core.mjs';
import { wallClock } from '../env_bath.mjs';
import { camera, motionBlur, callout } from '../fx.mjs';
import { drawBathWide, MAN, BOWL, TOILET } from './bathwide.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.clock, tBath = CUTS.bath, tEnd = CUTS.salmon;
const tYawn = ws('peeing') - 0.05, tEyes = ws('eyes'), tClosed = ws('closed');
const CLOCK = [705, 420, 150];
const WALK_END = 4.95;

function camAt(t) {
  // clock close-up -> whip tilt -> wide follow
  const clockCam = { x: CLOCK[0] - 10 + noise1(t * 0.6, 1) * 6, y: CLOCK[1] + 20, zoom: lerp(2.35, 2.55, tw(t, t0, tBath, E.inOutSine)) };
  const wide = { x: lerp(480, 570, tw(t, tBath, tEnd, E.inOutSine)) + noise1(t * 0.4, 2) * 10, y: lerp(1330, 1290, tw(t, tBath, tEnd, E.inOutSine)) + noise1(t * 0.4, 3) * 8, zoom: lerp(1.02, 1.24, tw(t, tBath + 0.2, tEnd, E.inOutSine)) };
  const k = tw(t, tBath - 0.16, tBath + 0.22, E.inOutQuart);
  return { x: lerp(clockCam.x, wide.x, k), y: lerp(clockCam.y, wide.y, k), zoom: Math.exp(lerp(Math.log(clockCam.zoom), Math.log(wide.zoom), k)), rot: noise1(t * 0.3, 7) * 0.008, x0: 540, y0: 960 };
}

function manAt(t) {
  const p = tw(t, tBath - 0.05, WALK_END, E.outCubic);
  const x = lerp(170, MAN[0], p), y = lerp(2200, MAN[1], p), s = lerp(1.18, MAN[2], p);
  const walking = t < WALK_END;
  const walk = walking ? p * 3.2 : undefined;
  const sway = t > WALK_END - 0.2 ? Math.sin((t - WALK_END) * 2.3) * 0.028 + noise1(t * 0.8, 9) * 0.01 : 0;
  const yawn = tw(t, tYawn, tYawn + 0.35, E.outBack) - tw(t, tYawn + 0.9, tYawn + 1.3, E.inOutSine);
  return { x, y, s, walk, sway, headRot: -0.05 * yawn + sway * 0.6, headY: -12 * yawn };
}

function drawWorld(g, t) {
  const cam = camAt(t);
  const man = manAt(t);
  const on = tw(t, tEyes - 0.05, tEyes + 0.15, E.outQuad);
  // stream drifts off the bowl onto the floor as he sways (sets up the salmon shot)
  const miss = tw(t, tClosed - 0.05, tEnd, E.inOutCubic);
  const end = [lerp(BOWL[0], 600, miss) + Math.sin(t * 2.3) * 8, lerp(BOWL[1], 1650, miss)];
  drawBathWide(g, t, {
    cam, man, streamOn: on, streamEnd: end,
    puddle: miss > 0.5 ? [600, 1656, (miss - 0.5) * 2] : null,
    zzz: tw(t, tBath + 0.4, tBath + 0.8),
  });
  if (t < tBath + 0.25) {
    // clock layer drawn in world space over the set
    g.save(); camera(g, cam, 0.85);
    wallClock(g, CLOCK[0], CLOCK[1], CLOCK[2], t, { minWob: wobble(t, t0 + 0.05, 3, 3) * 0.05 });
    g.restore();
  } else {
    g.save(); camera(g, cam, 0.85); wallClock(g, CLOCK[0], CLOCK[1], CLOCK[2], t); g.restore();
  }
}

export const s02 = {
  name: '3am', t0, t1: tEnd,
  draw(ctx, t) {
    const fast = t > tBath - 0.16 && t < tBath + 0.2;
    if (fast) motionBlur(ctx, 6, 1 / 45, (g, dt) => drawWorld(g, t + dt));
    else drawWorld(ctx, t);
  },
  ui(ctx, t) {
    callout(ctx, t, tYawn + 0.1, 'YAWN~', 300, 520, { dur: 1.0, rot: -0.15, scale: 0.6, edge: '#7aa7ff', burst: false, rise: 60 });
  },
};
