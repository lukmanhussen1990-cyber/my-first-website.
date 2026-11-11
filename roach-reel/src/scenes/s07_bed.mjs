// S7b "Two crumbs a fucking month." — man on his bed staring at two crumbs on his palm.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, pop, rgb, hex } from '../core.mjs';
import { setLight, glow, drawMesh, slab, cached, blob } from '../poly.mjs';
import { drawManFront } from '../man.mjs';
import { camera, camPoint, callout, badge } from '../fx.mjs';
import { crumb, envelope } from '../icons.mjs';
import { layer, dust } from '../layers.mjs';
import { vo } from '../audioenv.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.bed, t1 = CUTS.surf;
const tTwo = ws('two'), tCrumbs = ws('crumbs'), tMonth = ws('month');
const MAN = [520, 1800, 1.75];
const PALM = [150, -360];

function bg(g) {
  const gr = g.createLinearGradient(0, 0, 0, 2600); gr.addColorStop(0, '#121d3d'); gr.addColorStop(1, '#2a3a6a');
  g.fillStyle = gr; g.fillRect(0, 0, 1500, 2600);
  setLight({ dir: [-0.5, -0.6, 0.6], key: [0.6, 0.75, 1.05], amb: [0.32, 0.36, 0.55], points: [{ x: 1250, y: 1150, r: 900, col: [1, 0.7, 0.35], k: 0.9 }] });
  // window with curtains + moon
  g.fillStyle = '#0b1530'; g.fillRect(140, 300, 460, 560);
  g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(440, 450, 60, 0, TAU); g.fill();
  g.fillStyle = 'rgba(200,220,255,0.25)'; g.beginPath(); g.arc(440, 450, 140, 0, TAU); g.fill();
  g.fillStyle = '#e3ebf7'; g.fillRect(140, 570, 460, 14); g.fillRect(363, 300, 14, 560);
  drawMesh(g, blob([[80, 260], [230, 260], [210, 600], [250, 960], [60, 960]], { rings: [0.5], bulge: 0.3, seed: 701 }), { c: hex('#5a6fb5'), kd: 0.7 });
  drawMesh(g, blob([[520, 260], [680, 260], [700, 960], [500, 960], [540, 600]], { rings: [0.5], bulge: 0.3, seed: 702 }), { c: hex('#5a6fb5'), kd: 0.7 });
  // headboard + pillows
  drawMesh(g, slab(220, 1000, 1060, 520, { bevel: 30, seed: 703, cols: 4, rows: 2, chamfer: 40 }), { c: hex('#8a5a3a'), kd: 0.75, spec: 0.2 });
  drawMesh(g, slab(330, 1330, 380, 220, { bevel: 50, seed: 704, cols: 2, rows: 1, chamfer: 60 }), { c: hex('#eef2fb'), kd: 0.7 });
  drawMesh(g, slab(790, 1330, 380, 220, { bevel: 50, seed: 705, cols: 2, rows: 1, chamfer: 60 }), { c: hex('#eef2fb'), kd: 0.7 });
  drawMesh(g, slab(150, 1520, 1200, 1100, { bevel: 40, seed: 706, cols: 5, rows: 3 }), { c: hex('#4c6fd1'), kd: 0.75 });
  // nightstand lamp
  drawMesh(g, slab(1180, 1250, 240, 300, { bevel: 18, seed: 707, cols: 2, rows: 2 }), { c: hex('#6b4325'), kd: 0.8 });
  g.fillStyle = '#ffcf7a'; g.beginPath(); g.moveTo(1230, 1150); g.lineTo(1370, 1150); g.lineTo(1340, 1050); g.lineTo(1260, 1050); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,200,110,0.35)'; g.beginPath(); g.arc(1300, 1120, 260, 0, TAU); g.fill();
}

export const s07b = {
  name: 'bed', t0, t1,
  draw(ctx, t) {
    const cam = { x: 540 + noise1(t * 0.5, 1) * 8, y: lerp(980, 940, tw(t, t0, t1)) + noise1(t * 0.5, 2) * 6, zoom: lerp(1.0, 1.08, tw(t, t0, t1, E.inOutSine)), rot: noise1(t * 0.3, 3) * 0.01, x0: 540, y0: 960 };
    const B = layer('bedbg', 1500, 2600, bg, 14);
    ctx.save(); camera(ctx, cam, 0.35); ctx.drawImage(B, -210, -340); ctx.restore();
    const [lx, ly] = camPoint(cam, 1200, 1100);
    const [wx, wy] = camPoint(cam, 200, 300);
    setLight({ dir: [-0.6, -0.5, 0.6], key: [0.75, 0.88, 1.15], amb: [0.5, 0.5, 0.62], rim: [140, 175, 255], rimDir: [-1, -0.3],
      points: [{ x: lx, y: ly, r: 1500, col: [1, 0.72, 0.36], k: 0.85 }] });
    ctx.save(); camera(ctx, cam, 1);
    const confused = tw(t, tCrumbs + 0.1, tCrumbs + 0.4, E.outBack);
    const v = vo(t);
    const palm = [PALM[0], PALM[1] + wobble(t, tTwo, 5, 6) * 6 + wobble(t, tCrumbs + 0.02, 5, 6) * 6];
    drawManFront(ctx, {
      x: MAN[0], y: MAN[1], s: MAN[2], t,
      headRot: 0.1 * confused + noise1(t * 0.6, 4) * 0.02, headX: 0,
      eyeOpen: lerp(0.62, 0.95, tw(t, tTwo, tTwo + 0.2)), look: [0.55, 0.85], pupil: 0.9,
      browL: 0.9 * confused, browR: -0.15 * confused, browTilt: 0,
      mouthOpen: v * 0.3, smile: -0.25 * confused, mouthSkew: confused,
      armR: { ik: palm, hand: 'palm' }, armL: { ik: [-175, -335], hand: 'fist' },
    });
    // crumbs drop onto the palm (local coords of the man)
    ctx.save(); ctx.translate(MAN[0], MAN[1]); ctx.scale(MAN[2], MAN[2]);
    for (const [ta, dx, seed, rot] of [[tTwo, -6, 1, 0.3], [tCrumbs + 0.02, 20, 2, -0.5]]) {
      if (t < ta - 0.25) continue;
      const k = tw(t, ta - 0.25, ta, E.inQuad);
      const bounce = t > ta ? Math.abs(wobble(t, ta, 3, 9)) * 18 : 0;
      crumb(ctx, palm[0] + dx, palm[1] - 26 - (1 - k) * 420 - bounce, 0.75, seed, rot + (1 - k) * 4);
    }
    // envelope in left hand
    envelope(ctx, -190, -380, 0.5, -0.3, 1);
    ctx.restore();
    dust(ctx, t, -100, 0, 1300, 1900, 30, 31, [210, 225, 255], 0.3);
    ctx.restore();
  },
  ui(ctx, t) {
    // big ? over his head
    if (t > tCrumbs + 0.25) {
      const s = pop(t, tCrumbs + 0.25, 0.3);
      ctx.save(); ctx.translate(820, 420); ctx.rotate(0.15 + Math.sin(t * 4) * 0.05); ctx.scale(s, s);
      ctx.font = '190px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      ctx.lineWidth = 26; ctx.strokeStyle = '#111'; ctx.strokeText('?', 0, 0); ctx.fillStyle = '#ffe14d'; ctx.fillText('?', 0, 0);
      ctx.restore();
    }
    const ps = pop(t, tMonth - 0.12, 0.3);
    if (t > tMonth - 0.12) badge(ctx, 310, 470, '2 CRUMBS / MONTH', { size: 46, rot: -0.08 + Math.sin(t * 3) * 0.02, s: ps, bg: '#ffffff', fg: '#d9203a' });
  },
};
