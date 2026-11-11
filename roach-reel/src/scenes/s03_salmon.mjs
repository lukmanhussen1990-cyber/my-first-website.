// S3 "A cockroach sees the stream… and climbs up it like a fucking salmon." — low angle, nature-doc slow-mo.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, rgb, hex, rng } from '../core.mjs';
import { setLight, glow, softShadow, drawMesh, blob, cached, path } from '../poly.mjs';
import { tileWall, floorPersp, toiletSide, stream, splashDrops, puddle, nightLight, moonBeam, BC, bathLighting } from '../env_bath.mjs';
import { drawRoach, blink } from '../roach.mjs';
import { camera, camPoint, letterbox, callout, flash, speedLines } from '../fx.mjs';
import { layer, dust } from '../layers.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.salmon, t1 = CUTS.face;
const tSees = ws('sees'), tStream = ws('stream'), tAnd = ws('and', 1), tClimb = ws('climbs'), tSalmon = ws('salmon');
const STREAM = [[150, -900], [250, 100], [365, 900], [380, 1585]];
const PUD = [385, 1592];

function set(g) {
  const gr = g.createLinearGradient(0, 0, 0, 1500); gr.addColorStop(0, '#0a1430'); gr.addColorStop(1, '#2a4374');
  g.fillStyle = gr; g.fillRect(0, 0, 1800, 3900); g.translate(100, 500);
  bathLighting({ x: 800, y: 1600, zoom: 1, x0: 800, y0: 1600 }, null, { amb: [0.26, 0.31, 0.48], extra: [{ x: 1220, y: 900, r: 1300, col: [1, 0.68, 0.3], k: 0.75 }] });
  tileWall(g, 0, 300, 1600, 1260, 140, 11);
  g.fillStyle = 'rgba(6,12,30,0.35)'; g.fillRect(0, 0, 1600, 1560);
  g.fillStyle = '#1c2c50'; g.fillRect(0, 1560, 1600, 1700);
  floorPersp(g, 800, 1560, 3300, -900, 2500, { rows: 8, cols: 12, spread: 5.5, pow: 1.5 });
  g.fillStyle = 'rgba(5,10,25,0.45)'; g.fillRect(0, 1552, 1600, 18);
  nightLight(g, 1240, 760, 0, 1.6);
  moonBeam(g, [[0, 0], [500, 0], [1300, 3200], [400, 3200]], 0.16);
}

// roach motion: idle -> crouch -> slow-mo leap onto stream -> swim up
function roachPos(t) {
  const start = [700, 1795];
  if (t < tClimb) return { x: start[0], y: start[1], rot: 0, sq: 1 };
  const u = (t - tClimb);
  // leap arc into stream (0..0.55s), then ride up the stream (slow)
  const k = tw(t, tClimb, tClimb + 0.62, E.outCubic);
  const land = [395, 1060];
  const x = lerp(start[0], land[0], k), y = lerp(start[1], land[1], k) - Math.sin(k * Math.PI) * 120;
  if (t < tClimb + 0.62) return { x, y, rot: lerp(0, -0.55, E.outBack(clamp(k * 1.4))), sq: 1 + Math.sin(k * Math.PI) * 0.22 };
  const v = tw(t, tClimb + 0.62, t1 + 0.2, E.inOutSine);
  const sx = lerp(395, 255, v), sy = lerp(1060, 40, v);
  return { x: sx + Math.sin(u * 9) * 6, y: sy, rot: -0.32 + Math.sin(u * 9) * 0.12, sq: 1.18 + Math.sin(u * 18) * 0.05 };
}

function salmonGhost(ctx, x, y, s, a, t) {
  if (a <= 0) return;
  glow(ctx, x, y, 360 * s, [255, 150, 110], 0.35 * a);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2 - 0.25 + Math.sin(t * 6) * 0.1); ctx.scale(s, s);
  ctx.globalAlpha *= a;
  ctx.globalCompositeOperation = 'lighter';
  const body = cached('salmon', () => blob([[-170, 0], [-120, -40], [-20, -62], [80, -50], [150, -20], [170, 0], [150, 22], [80, 46], [-20, 56], [-120, 36]], { rings: [0.6, 0.3], bulge: 0.6, seed: 301 }));
  drawMesh(ctx, body, { c: hex('#ff8a6a'), kd: 0.4, amb: 0.4, emit: 0.6, spec: 0.5, shin: 20 });
  ctx.fillStyle = 'rgba(255,140,110,0.8)';
  path(ctx, [[-160, 0], [-250, -70], [-225, 0], [-250, 70]]); ctx.fill();
  path(ctx, [[-20, -58], [30, -110], [60, -50]]); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(120, -10, 9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(122, -10, 4.5, 0, TAU); ctx.fill();
  ctx.restore();
}

export const s03 = {
  name: 'salmon', t0, t1,
  draw(ctx, t) {
    const rp = roachPos(t);
    const slowmo = tw(t, tClimb - 0.08, tClimb + 0.18, E.outCubic);
    // camera: low angle, pushes in, then follows the roach up the stream
    const follow = tw(t, tClimb + 0.05, tClimb + 0.5, E.inOutSine);
    const lookUp = tw(t, tStream - 0.15, tStream + 0.35, E.inOutSine) - tw(t, tAnd - 0.1, tAnd + 0.25, E.inOutSine);
    const [sx, sy, sr] = shake(t, tClimb + 0.02, 14, 5, 16, 8);
    const cam = {
      x: lerp(lerp(560, 600, tw(t, t0, tClimb)), rp.x + 170, follow) + noise1(t * 0.5, 1) * 10,
      y: lerp(lerp(1330, 1360, tw(t, t0, tClimb)) - lookUp * 260, rp.y - 60, follow) + noise1(t * 0.5, 2) * 8,
      zoom: lerp(lerp(1.0, 1.14, tw(t, t0, tClimb, E.inOutSine)), 1.22, follow), rot: lerp(0, -0.05, follow) + noise1(t * 0.3, 3) * 0.01,
      sx, sy, sr, x0: 540, y0: 1300,
    };
    const B = layer('s03set', 1800, 3900, set, 5);
    ctx.save(); camera(ctx, cam, 0.7); ctx.drawImage(B, -360, -1500); ctx.restore();
    const [lx, ly] = camPoint(cam, 1100, 800);
    setLight({ dir: [-0.6, -0.55, 0.6], key: [0.8, 0.92, 1.15], amb: [0.32, 0.35, 0.52], rim: [255, 190, 90], rimDir: [1, -0.2],
      points: [{ x: lx, y: ly, r: 1400, col: [1, 0.68, 0.3], k: 0.6 }] });
    ctx.save(); camera(ctx, cam, 1);
    toiletSide(ctx, 980, 1600, 2.15, { shadow: true });
    puddle(ctx, PUD[0], PUD[1], 190, 40, t, 1);
    // waterfall-like stream with a slow-mo feel
    const st = t - t0;
    const tt = t < tClimb ? t : tClimb + (t - tClimb) * lerp(1, 0.28, slowmo);
    stream(ctx, STREAM, tt, { w0: 46, w1: 40, speed: 1.2 });
    splashDrops(ctx, PUD[0], PUD[1] - 6, tt, { n: 18, s: 1.0, seed: 12, sparkle: true });
    glow(ctx, PUD[0], PUD[1] - 20, 200, [255, 210, 90], 0.3);
    // salmon spirit
    salmonGhost(ctx, rp.x - 20, rp.y - 260, 1.7, tw(t, tSalmon - 0.1, tSalmon + 0.15) * (1 - tw(t, t1 - 0.15, t1)) * 0.8, t);
    // roach
    const eyes = kf(t, [[t0, 0.85], [tSees, 0.85], [tSees + 0.1, 1.15, E.outBack]]) * (t < tSees ? blink(t, 1, 2.2) : 1);
    const gog = tw(t, tAnd, tAnd + 0.25, E.outBack);
    const crouch = tw(t, tAnd + 0.2, tClimb - 0.02, E.inOutSine) * (t < tClimb ? 1 : 0);
    const leapT = t - tClimb;
    const flying = t >= tClimb;
    drawRoach(ctx, {
      x: rp.x, y: rp.y + crouch * 20, s: 1.45, t: t * (flying ? 0.35 : 1) + 5, flip: false,
      lean: flying ? rp.rot : -0.06 * crouch, squash: flying ? rp.sq : 1 - crouch * 0.22,
      turn: -0.55, look: flying ? [-0.4, -1] : [-0.85, t > tStream ? -0.9 : -0.3], eyeOpen: eyes, pupil: t > tSees ? 1.25 : 1,
      brow: t > tAnd ? -0.55 : t > tSees ? 0.9 : 0.1, mouth: flying ? 'open' : t > tAnd ? 'grin' : 'smile', grin: 0.7, mouthOpen: flying ? 0.6 : 0,
      antL: (t > tSees ? -0.25 : 0) + wobble(t, tSees, 5, 4) * 0.4 + (flying ? 0.5 : 0), antR: (t > tSees ? 0.25 : 0) - wobble(t, tSees, 5, 4) * 0.4 + (flying ? 0.6 : 0),
      antWig: flying ? 0.05 : 0.14,
      arms: flying ? [[-2.8, -3.0], [2.8, 3.0]] : t > tAnd && t < tAnd + 0.5 ? [[-2.4, -3.6], [2.4, 3.6]] : [[-0.9 - crouch * 0.6, 0.3], [0.9 + crouch * 0.6, -0.3]],
      legs: flying ? [[-0.25, 0.1], [0.25, -0.1]] : null,
      acc: { goggles: gog }, shadow: !flying, shadowA: 0.5,
    });
    if (!flying) softShadow(ctx, rp.x, rp.y + 4, 120, 18, 0.0);
    // exclamation on "sees"
    if (t > tSees && t < tAnd) {
      const s = kf(t, [[tSees, 0], [tSees + 0.15, 1.2, E.outBack], [tSees + 0.3, 1]]);
      ctx.save(); ctx.translate(rp.x + 40, rp.y - 640); ctx.scale(s, s);
      ctx.font = '150px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.lineWidth = 22; ctx.strokeStyle = '#111'; ctx.strokeText('!', 0, 0); ctx.fillStyle = '#ffe14d'; ctx.fillText('!', 0, 0);
      ctx.restore();
    }
    // slow-mo droplets around the roach
    if (flying) {
      const R = rng(77);
      for (let i = 0; i < 26; i++) {
        const a = R() * TAU, d = 60 + R() * 260 + leapT * 40 * (0.5 + R());
        const px = rp.x - 40 + Math.cos(a) * d, py = rp.y - 180 + Math.sin(a) * d * 0.8 + leapT * 18;
        const r = 4 + R() * 9, tw2 = 0.5 + 0.5 * Math.sin(t * 8 + i);
        ctx.fillStyle = rgb(i % 3 ? BC.pee : BC.peeLt, 0.85);
        ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
        if (i % 4 === 0) { glow(ctx, px, py, 26, [255, 255, 220], 0.5 * tw2); }
      }
    }
    dust(ctx, t, -200, -400, 1600, 2600, 40, 13, [210, 225, 255], 0.4);
    ctx.restore();
    // slow-mo grade + letterbox
    if (slowmo > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.35 * slowmo; ctx.fillStyle = '#ffb347'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    letterbox(ctx, tw(t, tClimb - 0.05, tClimb + 0.25, E.outCubic), 200);
    flash(ctx, '#fff', clamp(1 - (t - tClimb) / 0.12) * (t >= tClimb ? 0.5 : 0));
  },
  ui(ctx, t) {
    // nature documentary lower third
    const a = tw(t, tClimb + 0.25, tClimb + 0.6) * (1 - tw(t, t1 - 0.2, t1));
    if (a > 0) {
      const slide = (1 - E.outCubic(tw(t, tClimb + 0.25, tClimb + 0.7))) * -60;
      ctx.save(); ctx.globalAlpha = a; ctx.translate(70 + slide, 1620);
      ctx.fillStyle = '#ffe14d'; ctx.fillRect(0, -50, 8, 112);
      ctx.font = '700 50px "Fredoka"'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 10;
      ctx.fillText('Blattella salmonis', 28, -16);
      ctx.font = '600 32px "Fredoka"'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText('upstream migration  •  3:00 AM', 28, 34);
      ctx.restore();
      // REC-style slow-mo tag
      ctx.save(); ctx.globalAlpha = a; ctx.font = '600 30px "Fredoka"'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.textAlign = 'right';
      ctx.fillText('● 0.25×  SLOW MOTION', W - 60, 250); ctx.restore();
    }
    callout(ctx, t, tClimb + 0.02, 'SPLASH!', 760, 760, { dur: 0.8, rot: 0.12, scale: 0.9, edge: '#2fb3ff' });
  },
};
