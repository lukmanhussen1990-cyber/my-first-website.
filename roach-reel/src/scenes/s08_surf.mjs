// S8 "Every time you pee… it surfs out on a tiny fucking surfboard…" + S9 wave / wave back / dive back in.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, pop, rgb, hex, rng } from '../core.mjs';
import { glow, drawMesh, slab, blob, cached, path, bezierPts } from '../poly.mjs';
import { BC, stream } from '../env_bath.mjs';
import { drawRoach, blink } from '../roach.mjs';
import { drawManFront } from '../man.mjs';
import { camera, callout, flash, speedLines } from '../fx.mjs';
import { drawBathWide, arc, MAN, BOWL } from './bathwide.mjs';
import { manFrontBackdrop } from './manfront.mjs';
import { vo } from '../audioenv.mjs';
import { CUTS, ws } from '../timeline.mjs';

const tS = CUTS.surf, tW = CUTS.wave, tWB = CUTS.waveBack, tD = CUTS.dive, tP = CUTS.parade;
const tTime = ws('time'), tSurfs = ws('surfs'), tBoard = ws('surfboard'), tWaves = ws('waves'), tBack = ws('back');
const STREAM_W = { w0: 26, w1: 21 };

function bez(P, u) {
  const v = 1 - u;
  return [v * v * v * P[0][0] + 3 * v * v * u * P[1][0] + 3 * v * u * u * P[2][0] + u * u * u * P[3][0], v * v * v * P[0][1] + 3 * v * v * u * P[1][1] + 3 * v * u * u * P[2][1] + u * u * u * P[3][1]];
}
function surfU(t) {
  // param along the arc: emerges from behind the hip, carves outward, hangs near the apex for the wave
  if (t < tSurfs) return -0.1;
  const base = kf(t, [[tSurfs, 0.02], [tSurfs + 0.5, 0.3, E.outCubic], [tBoard, 0.46, E.inOutSine], [tW, 0.5, E.inOutSine]]);
  return base + Math.sin((t - tSurfs) * 5.5) * 0.035 * tw(t, tSurfs + 0.3, tSurfs + 0.6);
}

function surfboard(ctx, len = 160) {
  drawMesh(ctx, cached('board', () => blob([[-len / 2, 0], [-len * 0.38, -12], [0, -16], [len * 0.42, -10], [len / 2, -2], [len * 0.44, 8], [0, 12], [-len * 0.4, 9]], { rings: [0.5], bulge: 0.35, seed: 801 })), { c: hex('#ff5a5f'), kd: 0.7, spec: 0.7, shin: 30 });
  ctx.fillStyle = '#fff'; ctx.fillRect(-len * 0.45, -3, len * 0.9, 6);
  ctx.fillStyle = '#ffd34d'; path(ctx, [[-20, -10], [10, -2], [-10, 8]]); ctx.fill();
}

function surfer(ctx, t, P, u, o = {}) {
  const p = bez(P, clamp(u, 0, 1)), q = bez(P, clamp(u + 0.02, 0, 1));
  const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
  ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
  const carve = Math.sin((t - tSurfs) * 5.5);
  ctx.rotate(carve * 0.12);
  // spray off the tail
  const R = rng(Math.floor(t * 30));
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (R() - 0.5) * 1.6 - 0.5, d = 30 + R() * 90;
    ctx.fillStyle = rgb(i % 2 ? BC.peeLt : [255, 255, 255], 0.85);
    ctx.beginPath(); ctx.arc(-40 + Math.cos(a) * d, -10 + Math.sin(a) * d, 2 + R() * 4.5, 0, TAU); ctx.fill();
  }
  ctx.translate(0, -16);
  surfboard(ctx, 150);
  if (o.glint) glow(ctx, 40, -6, 90, [255, 255, 230], o.glint);
  // roach stands on board, counter-rotated a bit so it stays mostly upright
  ctx.rotate(-ang * 0.55 - carve * 0.1);
  drawRoach(ctx, {
    x: 0, y: 2, s: 0.21, t: t + 21, turn: 0.35, flip: false, lean: 0.08 * carve,
    acc: { sunglasses: 1 }, mouth: 'grin', grin: 1, brow: 0.2, eyeOpen: 1,
    arms: o.arms || [[-1.9 + carve * 0.2, -1.4], [1.9 + carve * 0.2, 1.4]], legs: [[-0.9, 0.4], [0.9, -0.4]], shadow: false, antWig: 0.25, antL: -0.4, antR: 0.5,
  });
  ctx.restore();
  return p;
}

function surfWide(ctx, t) {
  const u = surfU(t);
  const P0 = arc(t, BOWL, 0);
  const pos = bez(P0, clamp(u, 0, 1));
  const push = tw(t, tSurfs - 0.25, tSurfs + 0.45, E.inOutCubic);
  const [sx, sy] = shake(t, tSurfs, 10, 5, 18, 3);
  const cam = {
    x: lerp(560, pos[0] + 40, push) + noise1(t * 0.5, 1) * 8, y: lerp(1290, pos[1] - 30, push) + noise1(t * 0.5, 2) * 6,
    zoom: lerp(1.18, 2.7, push) + wobble(t, tBoard, 3, 5) * 0.12 + lerp(0, 0.25, tw(t, tBoard, tW, E.inOutSine)), rot: lerp(0, -0.04, push) + noise1(t * 0.3, 4) * 0.012, sx, sy, x0: 540, y0: 960,
  };
  const on = tw(t, tTime - 0.05, tTime + 0.12, E.outQuad);
  drawBathWide(ctx, t, {
    cam, man: { x: MAN[0], y: MAN[1], s: MAN[2], sway: Math.sin(t * 2.1) * 0.012 },
    streamOn: on, streamEnd: BOWL, w0: STREAM_W.w0, w1: STREAM_W.w1,
    behindMan: (g) => { if (u > -0.05) surfer(g, t, arc(t, BOWL, Math.sin(t * 2.1) * 0.012), u, { glint: t > tBoard ? clamp(1 - (t - tBoard) / 0.4) * 0.9 : 0 }); },
  });
}

function waveCloseup(ctx, t) {
  // tight on the roach at the apex, waving to camera, slow drift
  const P0 = arc(t, BOWL, 0);
  const u = 0.5 + (t - tW) * 0.03;
  const pos = bez(P0, u);
  const cam = { x: pos[0] + 10 + noise1(t, 1) * 4, y: pos[1] - 40 + noise1(t, 2) * 4, zoom: lerp(5.2, 5.6, tw(t, tW, tWB)), rot: -0.03, x0: 540, y0: 960 };
  drawBathWide(ctx, t, {
    cam, man: { x: MAN[0], y: MAN[1], s: MAN[2], sway: 0 }, streamOn: 1, streamEnd: BOWL, w0: STREAM_W.w0, w1: STREAM_W.w1,
    behindMan: (g) => {
      const wv = Math.sin((t - tW) * 16);
      surfer(g, t * 0.4 + tW * 0.6, P0, u, { arms: [[-1.9, -1.4], [2.25 + wv * 0.15, 2.95 + wv * 0.55]] });
    },
  });
}

function waveBack(ctx, t) {
  const cam = { x: 540 + noise1(t * 0.5, 1) * 6, y: 960 + noise1(t * 0.5, 2) * 6, zoom: lerp(1.04, 1.1, tw(t, tWB, tD)), rot: 0, x0: 540, y0: 960 };
  manFrontBackdrop(ctx, t, cam);
  ctx.save(); camera(ctx, cam, 1);
  const raise = tw(t, tWB + 0.05, tWB + 0.4, E.inOutSine);
  const wv = Math.sin((t - tWB) * 7) * raise;
  drawManFront(ctx, {
    x: 540, y: 1960, s: 2.2, t, eyeOpen: 1.1, pupil: 0.5, look: [0, -0.1], brow: 0.6, mouthOpen: 0.35 + vo(t) * 0.2, smile: 0,
    armR: raise > 0.02 ? { ik: [lerp(200, 150 + wv * 30, raise), lerp(-80, -600, raise)], hand: raise > 0.5 ? 'wave' : 'fist' } : undefined, hairUp: 0.4, sweat: 0.6,
  });
  ctx.restore();
}

function diveBack(ctx, t) {
  const P0 = arc(t, BOWL, 0);
  const k = tw(t, tD, tBack + 0.05, E.inQuad);
  const swim = tw(t, tBack + 0.05, tP, E.inOutSine);
  const uDive = 0.5;
  const pos = bez(P0, uDive);
  const cam = { x: pos[0] - 10 + noise1(t * 0.5, 1) * 6, y: pos[1] - 10, zoom: lerp(2.9, 2.5, tw(t, tD, tP, E.inOutSine)), rot: -0.03, x0: 540, y0: 960 };
  drawBathWide(ctx, t, {
    cam, man: { x: MAN[0], y: MAN[1], s: MAN[2], sway: Math.sin(t * 2.1) * 0.012 }, streamOn: 1, streamEnd: BOWL, w0: STREAM_W.w0, w1: STREAM_W.w1,
    behindMan: (g) => {
      if (t < tBack + 0.05) {
        // jump up and dive (board flips away)
        const hop = Math.sin(k * Math.PI) * 120;
        const p = [pos[0] + k * 20, pos[1] - 30 - hop];
        g.save(); g.translate(pos[0] + 90 * k, pos[1] - 20 - Math.sin(k * Math.PI) * 60 + k * 120); g.rotate(k * 7); surfboard(g, 150); g.restore();
        drawRoach(g, { x: p[0], y: p[1], s: 0.21, t: t + 21, lean: lerp(0, 3.0, k), acc: { sunglasses: 1 }, mouth: 'open', mouthOpen: 0.8, brow: 1, arms: [[-2.9, -3.1], [2.9, 3.1]], shadow: false, squash: 1.15 });
      } else {
        // swims back up the stream and disappears behind the hip
        const u = lerp(0.48, 0.0, swim);
        const p = bez(P0, u), q = bez(P0, u + 0.02);
        g.save(); g.translate(p[0], p[1]); g.rotate(Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI);
        g.rotate(Math.PI / 2);
        drawRoach(g, { x: 0, y: 40, s: 0.19, t: t + 21, acc: { sunglasses: 1 }, mouth: 'grin', grin: 1, arms: [[-2.6 + Math.sin(t * 20) * 0.5, -3.0], [2.6 - Math.sin(t * 20) * 0.5, 3.0]], legs: [[-0.2 + Math.sin(t * 20) * 0.3, 0.1], [0.2 - Math.sin(t * 20) * 0.3, -0.1]], shadow: false });
        g.restore();
      }
    },
    extra: (g) => {
      if (t > tBack - 0.02 && t < tBack + 0.6) {
        const kk = (t - tBack + 0.02) / 0.6;
        for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + (i / 13 - 0.5) * 2.4; const d = 20 + kk * 120; g.fillStyle = rgb(i % 2 ? BC.pee : BC.peeLt, 1 - kk); g.beginPath(); g.arc(pos[0] + Math.cos(a) * d, pos[1] - 10 + Math.sin(a) * d + kk * kk * 160, 6 * (1 - kk * 0.5), 0, TAU); g.fill(); }
      }
    },
  });
}

export const s08 = { name: 'surf', t0: tS, t1: tW, draw: surfWide,
  ui(ctx, t) { callout(ctx, t, tBoard + 0.05, 'TINY!', 800, 560, { dur: 0.7, scale: 0.7, rot: 0.15, edge: '#ff5a5f' }); } };
export const s09a = { name: 'wave', t0: tW, t1: tWB, draw: waveCloseup,
  ui(ctx, t) {
    if (t > tWaves) {
      const s = pop(t, tWaves, 0.25);
      ctx.save(); ctx.translate(790, 520); ctx.scale(s, s); ctx.rotate(0.08);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(8, 12, 150, 92, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 150, 92, 0, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-90, 50); ctx.lineTo(-150, 140); ctx.lineTo(-30, 70); ctx.fill();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 8; ctx.beginPath(); ctx.ellipse(0, 0, 150, 92, 0, 0, TAU); ctx.stroke();
      ctx.font = '96px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#111'; ctx.fillText('HEY!', 0, 8);
      ctx.restore();
    }
  } };
export const s09b = { name: 'waveBack', t0: tWB, t1: tD, draw: waveBack };
export const s09c = { name: 'dive', t0: tD, t1: tP, draw: diveBack,
  ui(ctx, t) { callout(ctx, t, tBack - 0.02, 'SPLASH!', 740, 640, { dur: 0.7, scale: 0.85, rot: -0.1, edge: '#2fb3ff' }); } };
