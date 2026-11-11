// S1 "What happens if a cockroach crawls into your fucking dick?" — extreme close-up hook.
import { W, H, E, tw, kf, clamp, lerp, shake, wobble, noise1, TAU } from '../core.mjs';
import { drawRoach, blink } from '../roach.mjs';
import { setLight, glow, softShadow } from '../poly.mjs';
import { bathLighting, tileWall, floorPersp, toilet, nightLight, moonBeam, BC } from '../env_bath.mjs';
import { camera, camPoint, flash } from '../fx.mjs';
import { layer, dust } from '../layers.mjs';
import { CUTS, ws } from '../timeline.mjs';

const tCock = ws('cockroach'), tCrawl = ws('crawls'), tDick = ws('dick');

function bg(g) {
  const gr = g.createLinearGradient(0, 0, 0, 1300);
  gr.addColorStop(0, '#0b1430'); gr.addColorStop(1, '#22365f');
  g.fillStyle = gr; g.fillRect(0, 0, 1400, 2400);
  bathLighting({ x: 700, y: 1200, zoom: 1, x0: 700, y0: 1200 }, null, { amb: [0.22, 0.27, 0.42], key: [0.55, 0.65, 0.9], extra: [{ x: 300, y: 700, r: 900, col: [1, 0.7, 0.3], k: 0.9 }] });
  tileWall(g, -40, 500, 1500, 900, 150, 3);
  g.fillStyle = 'rgba(8,14,32,0.45)'; g.fillRect(0, 0, 1400, 1400);
  floorPersp(g, 700, 1380, 2600, -500, 1900, { rows: 7, cols: 10, spread: 4.2, pow: 1.6 });
  toilet(g, 120, 1400, 2.3);
  nightLight(g, 330, 560, 0, 1.2);
  // bokeh
  for (const [x, y, r, a] of [[260, 480, 70, 0.35], [420, 620, 40, 0.3], [1180, 380, 55, 0.18], [980, 880, 34, 0.2], [180, 820, 46, 0.25]]) {
    g.fillStyle = `rgba(255,200,110,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  moonBeam(g, [[1100, 0], [1400, 0], [700, 2400], [200, 2400]], 0.14);
}

export const s01 = {
  name: 'hook', t0: CUTS.hook, t1: CUTS.clock,
  draw(ctx, t, lt) {
    // camera: slow push, punch on "dick"
    const push = lerp(1.0, 1.12, tw(t, 0, tDick, E.inOutSine));
    const punch = tw(t, tDick - 0.03, tDick + 0.16, E.outExpo) * 0.32 - tw(t, tDick + 0.16, CUTS.clock, E.inOutSine) * 0.06;
    const [sx, sy, sr] = shake(t, tDick, 34, 6, 24, 3);
    const drift = [noise1(t * 0.5, 1) * 14, noise1(t * 0.5, 2) * 10];
    const cam = { x: 540 + drift[0], y: 900 + drift[1] - punch * 160, zoom: push + punch, rot: noise1(t * 0.3, 5) * 0.01, sx, sy, sr, x0: 540, y0: 960 };
    // background (blurred, parallax)
    const B = layer('s01bg', 1400, 2400, bg, 12);
    ctx.save(); camera(ctx, cam, 0.35); ctx.drawImage(B, -160, -440); ctx.restore();
    ctx.save(); camera(ctx, cam, 0.6); dust(ctx, t, -200, -200, 1500, 2300, 50, 11, [200, 220, 255], 0.45); ctx.restore();

    // light: cool moon key + warm rim + red flash light
    const red = clamp(1 - (t - tDick) / 0.5) * (t >= tDick ? 1 : 0);
    const [lx, ly] = camPoint(cam, 160, 600);
    setLight({ dir: [-0.5, -0.65, 0.6], key: [0.8, 0.92, 1.15], amb: [0.3, 0.33, 0.5], rim: [255, 180, 80], rimDir: [-1, -0.1],
      points: [{ x: lx, y: ly, r: 1100, col: [1, 0.66, 0.3], k: 0.7 }, ...(red > 0 ? [{ x: W / 2, y: 300, r: 1600, col: [1.3, 0.1, 0.1], k: red * 0.9 }] : [])] });

    ctx.save(); camera(ctx, cam, 1);
    // expression keyframes
    const open = kf(t, [[0, 0.55], [tCock - 0.05, 0.55], [tCock + 0.12, 1.0, E.outBack]]) * blink(t + 0.6, 2, 2.6);
    const grin = kf(t, [[0, 0.25], [tCrawl, 0.35], [tCrawl + 0.35, 0.95, E.outBack], [tDick, 1.0]]);
    const brow = kf(t, [[0, 0], [tCock, 0.2], [tCock + 0.2, 0.6, E.outBack], [tCrawl, 0.6], [tCrawl + 0.3, -1, E.outBack]]);
    const rub = t > tCrawl ? Math.sin((t - tCrawl) * 22) * 0.18 : 0;
    const handsIn = tw(t, tCrawl - 0.1, tCrawl + 0.25, E.outBack);
    const antKick = wobble(t, tCock, 5, 5) * 0.25 + wobble(t, tDick, 6, 4) * 0.5;
    drawRoach(ctx, {
      x: 540, y: 1960, s: 4.6, t: t + 3, shadowA: 0.55,
      headRot: noise1(t * 0.8, 9) * 0.04 + wobble(t, tDick, 4, 5) * 0.06,
      eyeOpen: open, lowerLid: brow < 0 ? -brow * 0.28 : 0, pupil: lerp(1, 0.8, tw(t, tCrawl, tCrawl + 0.3)),
      look: [noise1(t * 0.7, 4) * 0.15, -0.55 + (t > tCrawl ? 0.25 : 0)],
      brow, mouth: grin > 0.5 ? 'evil' : 'smile', grin, mouthOpen: t > tDick ? 0.4 : 0,
      evilGlow: red, antWig: 0.16, antL: antKick - 0.05 + Math.sin(t * 13) * 0.04 * (t < tCock ? 1 : 0.3), antR: -antKick + 0.05,
      arms: [[lerp(-0.75, -0.05, handsIn), lerp(0.35, 1.5 + rub, handsIn)], [lerp(0.75, 0.05, handsIn), lerp(-0.35, -1.5 + rub, handsIn)]],
      midWig: 0.2,
    });
    ctx.restore();
    // red flash + red vignette
    flash(ctx, '#ff1530', red * 0.55);
    if (t > tDick) {
      const v = clamp(1 - (t - tDick) / 0.6) * 0.5 + 0.15;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.7);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, `rgba(140,0,10,${v})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // fade in from black (2 frames) for a clean start
    flash(ctx, '#000', 1 - clamp(t / 0.06));
  },
};
