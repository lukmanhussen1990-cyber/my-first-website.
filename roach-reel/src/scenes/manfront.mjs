// Front-facing man in the bathroom (waist-up): blurred background + lighting helper.
import { W, H, TAU, rgb, hex } from '../core.mjs';
import { setLight, glow } from '../poly.mjs';
import { tileWall, towel, bathLighting, BC } from '../env_bath.mjs';
import { camera, camPoint } from '../fx.mjs';
import { layer, dust } from '../layers.mjs';
import { drawMesh, slab, cached } from '../poly.mjs';

function bg(g) {
  const gr = g.createLinearGradient(0, 0, 0, 2600); gr.addColorStop(0, '#16244a'); gr.addColorStop(1, '#2b4372');
  g.fillStyle = gr; g.fillRect(0, 0, 1500, 2600);
  bathLighting({ x: 750, y: 1300, zoom: 1, x0: 750, y0: 1300 }, null, { amb: [0.3, 0.34, 0.5] });
  // doorway on the left, with warm hallway light leaking
  g.fillStyle = '#e9eef6'; g.fillRect(90, 380, 420, 1500);
  g.fillStyle = '#1b2440'; g.fillRect(120, 410, 360, 1470);
  const hl = g.createLinearGradient(120, 0, 480, 0); hl.addColorStop(0, 'rgba(255,190,110,0.55)'); hl.addColorStop(1, 'rgba(255,190,110,0.05)');
  g.fillStyle = hl; g.fillRect(120, 410, 360, 1470);
  tileWall(g, 510, 1150, 1000, 1450, 130, 21);
  g.fillStyle = '#c8d8ee'; g.fillRect(510, 1136, 1000, 18);
  // mirror cabinet
  drawMesh(g, slab(800, 340, 420, 520, { bevel: 20, seed: 501, cols: 2, rows: 2 }), { c: hex('#cfd9ea'), kd: 0.6, spec: 0.5 });
  g.fillStyle = '#5c78a8'; g.fillRect(830, 370, 360, 460);
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(860, 380); g.lineTo(980, 380); g.lineTo(880, 820); g.lineTo(840, 820); g.closePath(); g.fill();
  towel(g, 1300, 1000, 1.1);
  // light switch
  g.fillStyle = '#eef2f8'; g.fillRect(560, 900, 60, 96); g.fillStyle = '#c9d2e0'; g.fillRect(580, 930, 20, 36);
  for (const [x, y, r, a] of [[300, 700, 120, 0.25], [420, 1300, 80, 0.18], [1050, 300, 60, 0.15]]) { g.fillStyle = `rgba(255,200,120,${a})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
}

/** draws the blurred bathroom-from-the-front backdrop and sets the face lighting */
export function manFrontBackdrop(ctx, t, cam, o = {}) {
  const B = layer('manbg', 1500, 2600, bg, 16);
  ctx.save(); camera(ctx, cam, 0.35); ctx.drawImage(B, -210, -340); ctx.restore();
  ctx.save(); camera(ctx, cam, 0.6); dust(ctx, t, -200, -200, 1500, 2400, 40, 17, [210, 225, 255], 0.35); ctx.restore();
  const [ux, uy] = camPoint(cam, 560, 2500);
  setLight({
    dir: [-0.55, -0.55, 0.62], key: o.key || [0.78, 0.9, 1.12], amb: o.amb || [0.5, 0.5, 0.6],
    rim: [130, 170, 255], rimDir: [-1, -0.2],
    points: [{ x: ux, y: uy, r: 1700, col: [1.0, 0.7, 0.32], k: o.warm ?? 0.8, z: 0.4 }, ...(o.points || [])],
  });
}
