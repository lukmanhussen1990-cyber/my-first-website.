// S10 "Then one night… it invites its four hundred fucking cousins." — the parade.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, pop, rgb, hex, hash, rng } from '../core.mjs';
import { setLight, glow, softShadow, drawMesh, cached, ellipseBlob } from '../poly.mjs';
import { tileWall, floorPersp, toiletSide, nightLight, moonBeam, bathLighting, BC } from '../env_bath.mjs';
import { drawRoach, suitcase, blink } from '../roach.mjs';
import { camera, camPoint, callout, badge } from '../fx.mjs';
import { layer, dust } from '../layers.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.parade, t1 = CUTS.hotel;
const tInv = ws('invites'), t400 = ws('400'), tCous = ws('cousins');
const HATS = ['top', 'cap', 'party', 'cowboy', 'beanie', 'chef', 'bow', null, null];
const HATC = ['#2b2b38', '#e63946', '#3a86ff', '#8d5524', '#06d6a0', '#f4f4f4', '#ff5fa2', '#ffbe0b'];
const SPEED = 230;
const HOST = [2480, 1505];

function set(g) {
  const gr = g.createLinearGradient(0, 0, 0, 1400); gr.addColorStop(0, '#0a1330'); gr.addColorStop(1, '#273e6c');
  g.fillStyle = '#0a1330'; g.fillRect(0, 0, 4200, 3300); g.translate(0, 700); g.fillStyle = gr; g.fillRect(0, -700, 4200, 3300);
  bathLighting({ x: 2100, y: 1300, zoom: 1, x0: 2100, y0: 1300 }, null, { amb: [0.26, 0.31, 0.48], extra: [{ x: 3400, y: 700, r: 1500, col: [1, 0.68, 0.3], k: 0.7 }] });
  tileWall(g, 0, 420, 4200, 800, 130, 31);
  g.fillStyle = 'rgba(6,12,30,0.35)'; g.fillRect(0, 0, 4200, 1220);
  g.fillStyle = '#c8d8ee'; g.fillRect(0, 410, 4200, 16);
  g.fillStyle = '#1b2a4d'; g.fillRect(0, 1220, 4200, 1400);
  floorPersp(g, 2100, 1220, 2700, -1600, 5800, { rows: 7, cols: 26, spread: 2.6, pow: 1.5 });
  g.fillStyle = 'rgba(5,10,25,0.45)'; g.fillRect(0, 1212, 4200, 16);
  nightLight(g, 3380, 640, 0, 1.3);
  for (const x of [300, 1500, 2700]) moonBeam(g, [[x, 0], [x + 380, 0], [x + 900, 2600], [x + 200, 2600]], 0.12);
}

function cousin(ctx, t, i, row, x, y, s, k) {
  const h = (n) => hash(i * 977 + row * 131 + n);
  const kid = h(1) < 0.16;
  const sc = s * (kid ? 0.62 : 1) * (0.92 + h(2) * 0.16);
  const hat = HATS[Math.floor(h(3) * HATS.length)];
  const lug = !kid && h(4) < 0.5;
  drawRoach(ctx, {
    x, y, s: sc, t: t + i * 0.37, walk: (t * 1.9 + h(5)) % 1, turn: 0.55, dim: k, shadowA: 0.4 * k,
    acc: { hat, hatCol: HATC[Math.floor(h(6) * HATC.length)], mustache: !kid && h(7) < 0.3, sunglasses: h(8) < 0.14 ? 1 : 0, bowtie: h(9) < 0.2 ? '#e63946' : null },
    mouth: h(10) < 0.5 ? 'grin' : 'open', grin: 0.8, mouthOpen: 0.3 + 0.3 * Math.sin(t * 8 + i), eyeOpen: blink(t, i, 2.3 + h(11)), brow: 0.5,
    arms: lug ? [[-0.75, 0.35], [0.2, 0.0]] : [[-0.9 + Math.sin(t * 12 + i) * 0.3, 0.3], [0.9 - Math.sin(t * 12 + i) * 0.3, -0.3]],
    holdR: lug ? (g) => suitcase(g, 70, 46, ['#8a4b2a', '#3a86ff', '#e63946', '#2a9d8f'][Math.floor(h(12) * 4)], h(13) < 0.5) : null,
    antWig: 0.2, headScale: kid ? 1.4 : 1.22,
  });
}

export const s10 = {
  name: 'parade', t0, t1,
  draw(ctx, t) {
    const lt = t - t0;
    const pan = tw(t, t0, tInv + 0.2, E.inOutSine);
    const pull = tw(t, t400 - 0.1, t1, E.inOutCubic);
    const [sx, sy] = shake(t, t400 + 0.48, 18, 6, 20, 5);
    const cam = { x: lerp(lerp(500, 2150, pan), 1900, pull) + noise1(t * 0.4, 1) * 10, y: lerp(1260, 1150, pull) + noise1(t * 0.4, 2) * 8, zoom: lerp(1.05, 0.62, pull), rot: noise1(t * 0.3, 3) * 0.01, sx, sy, x0: 540, y0: 960 };
    const B = layer('s10set', 4200, 3300, set, 3);
    ctx.save(); camera(ctx, cam, 0.8); ctx.drawImage(B, -1300, -760); ctx.restore();
    const [lx, ly] = camPoint(cam, 2900, 700);
    setLight({ dir: [-0.6, -0.55, 0.6], key: [0.78, 0.9, 1.12], amb: [0.36, 0.38, 0.55], rim: [255, 190, 90], rimDir: [1, -0.2], points: [{ x: lx, y: ly, r: 1800 * cam.zoom, col: [1, 0.68, 0.3], k: 0.6 }] });
    ctx.save(); camera(ctx, cam, 1);
    toiletSide(ctx, 2860, 1540, 1.7);
    // visible-range culling
    const halfW = (W / 2) / cam.zoom + 200;
    const rows = [
      { y: 1290, s: 0.3, k: 0.55, gap: 70, n: 70, off: 37 },
      { y: 1390, s: 0.42, k: 0.75, gap: 100, n: 50, off: 11 },
      { y: 1560, s: 0.58, k: 1.0, gap: 150, n: 32, off: 0 },
    ];
    rows.forEach((r, ri) => {
      for (let i = 0; i < r.n; i++) {
        let x = -900 + i * r.gap + r.off + SPEED * (0.7 + ri * 0.15) * lt - (hash(i + ri * 50) * 30);
        if (x > HOST[0] - 120 - ri * 40) continue; // reached the toilet: disappear behind host
        if (Math.abs(x - cam.x) > halfW) continue;
        const bob = Math.abs(Math.sin((t * 1.9 + hash(i * 977 + ri * 131 + 5)) * Math.PI)) * 0;
        cousin(ctx, t, i, ri, x, r.y + bob, r.s, r.k);
      }
    });
    // host roach (sunglasses) waving everyone in
    const inv = tw(t, tInv - 0.1, tInv + 0.15, E.outBack);
    const wave = Math.sin(t * 9);
    drawRoach(ctx, {
      x: HOST[0], y: HOST[1], s: 0.82, t: t + 3, turn: -0.4, acc: { sunglasses: 1 }, mouth: 'grin', grin: 1, brow: 0.3, eyeOpen: 1,
      arms: [[-2.5 + wave * 0.3, -3.2 + wave * 0.3], [0.75 + inv * 1.6, -0.35 + inv * 2.4]],
      holdR: inv > 0.05 ? (g) => { g.save(); g.rotate(-0.4); g.scale(inv, inv); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-44, -90, 100, 70); g.fillStyle = '#fff6d8'; g.fillRect(-50, -96, 100, 70); g.strokeStyle = '#d9203a'; g.lineWidth = 4; g.strokeRect(-50, -96, 100, 70); g.fillStyle = '#d9203a'; g.font = '20px "Luckiest Guy"'; g.textAlign = 'center'; g.fillText('PARTY', 0, -66); g.fillText('AT MINE', 0, -42); g.restore(); } : null,
    });
    // confetti from invite
    if (t > tInv) {
      const R = rng(55);
      for (let i = 0; i < 60; i++) {
        const k = (t - tInv) * (0.8 + R() * 0.6);
        const a = -Math.PI / 2 + (R() - 0.5) * 2.4, sp = 500 + R() * 600;
        const px = HOST[0] + 60 + Math.cos(a) * sp * k, py = HOST[1] - 360 + Math.sin(a) * sp * k + 900 * k * k;
        ctx.save(); ctx.translate(px, py); ctx.rotate(k * 10 + i);
        ctx.fillStyle = ['#ff3d9a', '#ffe14d', '#4cd964', '#3a86ff', '#ff9f1c'][i % 5]; ctx.fillRect(-8, -4, 16, 8); ctx.restore();
      }
    }
    dust(ctx, t, cam.x - 1400, 0, 2800, 1800, 50, 41, [210, 225, 255], 0.35);
    ctx.restore();
  },
  ui(ctx, t) {
    // 0 -> 400 counter
    if (t > t400 - 0.08) {
      const k = tw(t, t400 - 0.05, t400 + 0.45, E.outCubic);
      const n = Math.round(400 * k);
      const slam = t > t400 + 0.45 ? 1 + wobble(t, t400 + 0.45, 4, 7) * 0.25 : pop(t, t400 - 0.08, 0.25);
      ctx.save(); ctx.translate(W / 2, 380); ctx.scale(slam, slam); ctx.rotate(-0.04);
      ctx.font = '300px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(String(n), 10, 22);
      ctx.lineWidth = 46; ctx.strokeStyle = '#111'; ctx.strokeText(String(n), 0, 0);
      ctx.lineWidth = 18; ctx.strokeStyle = '#ff3d9a'; ctx.strokeText(String(n), 0, 0);
      ctx.fillStyle = '#ffe14d'; ctx.fillText(String(n), 0, 0);
      ctx.restore();
      if (t > t400 + 0.4) badge(ctx, W / 2, 590, 'COUSINS', { size: 64, s: pop(t, t400 + 0.4, 0.3), bg: '#ff3d9a', fg: '#fff', rot: 0.03 });
    }
    callout(ctx, t, tInv, "YOU'RE INVITED!", 600, 520, { dur: 0.75, scale: 0.55, rot: -0.1, edge: '#ff9f1c' });
  },
};
