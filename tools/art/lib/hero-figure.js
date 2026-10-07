/*
 * hero-figure — the lone survivor seen from behind (hooded parka, backpack,
 * shoulders slightly hunched, hands hanging by the thighs). Drawn as a smooth
 * Catmull-Rom silhouette with subtle fabric shading and a crimson rim light
 * cast by a light source above and in front of the figure.
 *
 * drawFigure(ctx, lights, { x, y, h, mirror, waterline })
 *   x, y   feet centre in canvas px, h figure height in px
 *   mirror draw only the dark silhouette (for reflections); `lights` is then
 *          an emissive ctx to erase behind the silhouette
 *   lights optional emissive ctx: lights behind the figure are occluded and a
 *          little of the rim is added for bloom
 */
import { layer, rng } from './paint.js';

/** Closed (or open) Catmull-Rom spline through points. */
export function spline(ctx, pts, closed = true, t = 1) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    ctx.bezierCurveTo(
      p1[0] + ((p2[0] - p0[0]) / 6) * t,
      p1[1] + ((p2[1] - p0[1]) / 6) * t,
      p2[0] - ((p3[0] - p1[0]) / 6) * t,
      p2[1] - ((p3[1] - p1[1]) / 6) * t,
      p2[0],
      p2[1],
    );
  }
  if (closed) ctx.closePath();
}

// Right half of the outline (units of figure height, feet at y = 0), from the
// hood crown clockwise down the arm, around the hand and down the leg.
const RIGHT = [
  [0, -1.0],
  [0.024, -0.997],
  [0.045, -0.986],
  [0.06, -0.966],
  [0.068, -0.94],
  [0.071, -0.914],
  [0.077, -0.893],
  [0.096, -0.876],
  [0.121, -0.861],
  [0.143, -0.846],
  [0.157, -0.823],
  [0.162, -0.793],
  [0.16, -0.745],
  [0.156, -0.69],
  [0.161, -0.632],
  [0.157, -0.572],
  [0.149, -0.518],
  [0.152, -0.494],
  [0.146, -0.47],
  [0.141, -0.436],
  [0.13, -0.418],
  [0.119, -0.428],
  [0.116, -0.466],
  [0.119, -0.5],
  [0.121, -0.535],
  [0.116, -0.53],
  [0.113, -0.506],
  [0.102, -0.498],
  [0.101, -0.47],
  [0.1, -0.4],
  [0.093, -0.31],
  [0.087, -0.262],
  [0.087, -0.18],
  [0.077, -0.095],
  [0.072, -0.062],
  [0.08, -0.042],
  [0.087, -0.014],
  [0.085, 0.004],
  [0.034, 0.004],
  [0.03, -0.036],
  [0.028, -0.12],
  [0.026, -0.26],
  [0.022, -0.38],
  [0.012, -0.462],
];

// left half: mirrored with a weight shift (left leg a touch wider, left hand slightly higher)
const LEFT = RIGHT.slice(1)
  .reverse()
  .map(([x, y]) => {
    let xx = -x;
    let yy = y;
    if (y > -0.3) xx *= 1 + (y + 0.3) * 0.3;
    if (y > -0.52 && y < -0.41 && x > 0.112) yy -= 0.01;
    return [xx, yy];
  });

const BODY = [...RIGHT, [0, -0.474], ...LEFT];

const PACK_R = [
  [0, -0.86],
  [0.05, -0.858],
  [0.083, -0.847],
  [0.098, -0.822],
  [0.104, -0.772],
  [0.107, -0.68],
  [0.104, -0.622],
  [0.097, -0.596],
  [0.075, -0.585],
  [0, -0.581],
];
const PACK = [...PACK_R, ...PACK_R.slice(1, -1).reverse().map(([x, y]) => [-x * 1.02, y])];

function path(ctx, pts, ox, oy, s, closed = true) {
  ctx.beginPath();
  spline(
    ctx,
    pts.map(([x, y]) => [ox + x * s, oy + y * s]),
    closed,
  );
}

function line(ctx, pts, ox, oy, s, w, color) {
  ctx.beginPath();
  spline(
    ctx,
    pts.map(([x, y]) => [ox + x * s, oy + y * s]),
    false,
  );
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function soft(ctx, x, y, rx, ry, color, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${color},${alpha})`);
  g.addColorStop(1, `rgba(${color},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();
}

/** Silhouette + detail into a ctx at (ox, oy) feet, scale s (px per figure height). */
function paintSilhouette(c, ox, oy, s, detail) {
  path(c, BODY, ox, oy, s);
  c.fillStyle = 'rgb(8,6,8)';
  c.fill();
  const px = ox + s * 0.003;
  if (!detail) {
    path(c, PACK, px, oy, s);
    c.fill();
    return;
  }
  const lw = Math.max(1, s * 0.003);
  c.save();
  path(c, BODY, ox, oy, s);
  c.clip();
  // ambient red from the sky on the upper body, darker legs
  const g = c.createLinearGradient(0, oy - s, 0, oy - s * 0.3);
  g.addColorStop(0, 'rgba(60,12,18,0.6)');
  g.addColorStop(0.3, 'rgba(30,7,11,0.35)');
  g.addColorStop(1, 'rgba(8,3,5,0)');
  c.fillStyle = g;
  c.fillRect(ox - s, oy - s * 1.1, s * 2, s * 1.2);
  // volume: hood crown and shoulder sheen (wet fabric), sides falling off
  soft(c, ox, oy - s * 0.975, s * 0.06, s * 0.035, '150,30,40', 0.35);
  soft(c, ox + s * 0.128, oy - s * 0.832, s * 0.035, s * 0.016, '170,34,44', 0.35);
  soft(c, ox - s * 0.128, oy - s * 0.832, s * 0.035, s * 0.016, '170,34,44', 0.3);
  const sg = c.createLinearGradient(ox - s * 0.16, 0, ox + s * 0.16, 0);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)');
  sg.addColorStop(0.3, 'rgba(0,0,0,0)');
  sg.addColorStop(0.7, 'rgba(0,0,0,0)');
  sg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = sg;
  c.fillRect(ox - s * 0.2, oy - s, s * 0.4, s);
  // hood seam and the hood's lower fold
  line(c, [[0, -0.998], [0.003, -0.95], [0.001, -0.9]], ox, oy, s, lw, 'rgba(70,20,26,0.35)');
  line(c, [[-0.07, -0.886], [-0.03, -0.872], [0.03, -0.873], [0.07, -0.887]], ox, oy, s, lw * 1.6, 'rgba(0,0,0,0.55)');
  // arm/body separation and sleeve creases
  for (const sx of [1, -1]) {
    line(c, [[0.123 * sx, -0.78], [0.12 * sx, -0.66], [0.121 * sx, -0.54]], ox, oy, s, lw * 1.2, 'rgba(0,0,0,0.5)');
    line(c, [[0.132 * sx, -0.645], [0.146 * sx, -0.638], [0.157 * sx, -0.645]], ox, oy, s, lw, 'rgba(60,16,22,0.35)');
    line(c, [[0.128 * sx, -0.6], [0.142 * sx, -0.592], [0.154 * sx, -0.598]], ox, oy, s, lw, 'rgba(60,16,22,0.28)');
    line(c, [[0.12 * sx, -0.515], [0.15 * sx, -0.512]], ox, oy, s, lw * 1.5, 'rgba(0,0,0,0.55)');
    // knee creases and boot cuffs
    line(c, [[0.032 * sx, -0.27], [0.058 * sx, -0.262], [0.085 * sx, -0.27]], ox, oy, s, lw, 'rgba(50,14,20,0.3)');
    line(c, [[0.03 * sx, -0.045], [0.08 * sx, -0.045]], ox, oy, s, lw * 1.3, 'rgba(0,0,0,0.5)');
  }
  // jacket hem band
  line(c, [[-0.115, -0.512], [0, -0.504], [0.115, -0.512]], ox, oy, s, lw * 1.4, 'rgba(50,14,20,0.4)');
  c.restore();

  // backpack
  path(c, PACK, px, oy, s);
  const pg = c.createLinearGradient(0, oy - s * 0.86, 0, oy - s * 0.58);
  pg.addColorStop(0, 'rgb(34,10,14)');
  pg.addColorStop(0.3, 'rgb(15,6,9)');
  pg.addColorStop(1, 'rgb(7,4,6)');
  c.fillStyle = pg;
  c.fill();
  c.save();
  path(c, PACK, px, oy, s);
  c.clip();
  // front pocket
  c.beginPath();
  spline(
    c,
    [[-0.07, -0.728], [0, -0.736], [0.07, -0.728], [0.076, -0.665], [0.07, -0.612], [0, -0.606], [-0.07, -0.612], [-0.076, -0.665]].map(([x, y]) => [px + x * s, oy + y * s]),
  );
  c.fillStyle = 'rgba(0,0,0,0.3)';
  c.fill();
  c.lineWidth = lw;
  c.strokeStyle = 'rgba(80,22,28,0.22)';
  c.stroke();
  // zipper arc + puller
  line(c, [[-0.092, -0.806], [-0.045, -0.838], [0.045, -0.838], [0.092, -0.806]], px, oy, s, lw, 'rgba(100,28,34,0.35)');
  c.fillStyle = 'rgba(140,34,40,0.6)';
  c.fillRect(px + s * 0.046, oy - s * 0.838, s * 0.005, s * 0.02);
  // compression straps
  for (const yy of [-0.765, -0.69]) {
    line(c, [[-0.11, yy], [-0.05, yy - 0.004], [0.05, yy - 0.004], [0.11, yy]], px, oy, s, lw * 2.2, 'rgba(0,0,0,0.5)');
    line(c, [[-0.11, yy - 0.006], [0.11, yy - 0.006]], px, oy, s, lw * 0.6, 'rgba(90,24,30,0.25)');
  }
  // fabric falling off toward the sides
  const bg = c.createLinearGradient(px - s * 0.11, 0, px + s * 0.11, 0);
  bg.addColorStop(0, 'rgba(0,0,0,0.6)');
  bg.addColorStop(0.28, 'rgba(0,0,0,0)');
  bg.addColorStop(0.72, 'rgba(0,0,0,0)');
  bg.addColorStop(1, 'rgba(0,0,0,0.6)');
  c.fillStyle = bg;
  c.fillRect(px - s * 0.2, oy - s * 0.9, s * 0.4, s * 0.4);
  // wet sheen on the top of the pack
  soft(c, px, oy - s * 0.85, s * 0.07, s * 0.018, '190,40,50', 0.35);
  c.restore();
  // top grab handle
  line(c, [[-0.022, -0.859], [-0.016, -0.874], [0.016, -0.874], [0.022, -0.859]], px, oy, s, lw * 2, 'rgb(12,6,8)');
  // shoulder straps over the shoulders, dangling strap ends
  for (const sx of [1, -1]) {
    line(c, [[0.055 * sx, -0.862], [0.092 * sx, -0.857], [0.122 * sx, -0.842]], ox, oy, s, lw * 4, 'rgb(13,6,9)');
    line(c, [[0.094 * sx, -0.6], [0.098 * sx, -0.57], [0.093 * sx, -0.545]], px, oy, s, lw * 1.6, 'rgb(9,5,7)');
  }
  // side bottle pocket bulge
  c.beginPath();
  spline(
    c,
    [[0.1, -0.69], [0.117, -0.684], [0.12, -0.63], [0.112, -0.604], [0.099, -0.612]].map(([x, y]) => [px + x * s, oy + y * s]),
  );
  c.fillStyle = 'rgb(11,6,8)';
  c.fill();
}

export function drawFigure(ctx, lights, { x, y, h, mirror = false, waterline = 0.022 }) {
  const pad = h * 0.12;
  const bw = Math.ceil(h * 0.5 + pad * 2);
  const bh = Math.ceil(h * 1.06 + pad);
  const ox = bw / 2;
  const oy = bh - pad * 0.5;
  const clipY = oy - waterline * h;

  if (mirror) {
    const l = layer(bw, bh);
    paintSilhouette(l.ctx, ox, oy, h, false);
    l.ctx.globalCompositeOperation = 'destination-out';
    l.ctx.fillRect(0, clipY, bw, bh);
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(l.c, x - ox, y - oy);
    ctx.restore();
    if (lights) {
      lights.save();
      lights.globalCompositeOperation = 'destination-out';
      lights.drawImage(l.c, x - ox, y - oy);
      lights.restore();
    }
    return;
  }

  // 1. silhouette with detail, cut at the water line
  const fig = layer(bw, bh);
  paintSilhouette(fig.ctx, ox, oy, h, true);
  fig.ctx.globalCompositeOperation = 'destination-out';
  fig.ctx.fillRect(0, clipY, bw, bh);

  // 2. alpha mask
  const mask = layer(bw, bh);
  mask.ctx.drawImage(fig.c, 0, 0);
  mask.ctx.globalCompositeOperation = 'source-in';
  mask.ctx.fillStyle = '#fff';
  mask.ctx.fillRect(0, 0, bw, bh);

  // 3. rim: edges facing the light (above), weaker on the sides
  const rim = layer(bw, bh);
  const R = rim.ctx;
  const edge = (dx, dy, alpha) => {
    const e = layer(bw, bh);
    e.ctx.drawImage(mask.c, 0, 0);
    e.ctx.globalCompositeOperation = 'destination-out';
    e.ctx.drawImage(mask.c, dx, dy);
    R.globalAlpha = alpha;
    R.globalCompositeOperation = 'lighter';
    R.drawImage(e.c, 0, 0);
  };
  const d = Math.max(1.5, h * 0.0042);
  edge(0, d, 1);
  edge(d * 0.8, d * 0.5, 0.4);
  edge(-d * 0.8, d * 0.5, 0.4);
  edge(0, d * 2.4, 0.16);
  // break the rim up with noise so it reads as light on cloth, not an outline
  {
    const r = rng(17);
    const n = layer(bw, bh);
    n.ctx.fillStyle = 'rgba(255,255,255,0.6)';
    n.ctx.fillRect(0, 0, bw, bh);
    for (let i = 0; i < 160; i++) {
      const rx = (0.01 + r() * 0.05) * h;
      const gx = r() * bw;
      const gy = r() * bh * 0.7;
      const g = n.ctx.createRadialGradient(gx, gy, 0, gx, gy, rx);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      n.ctx.fillStyle = g;
      n.ctx.fillRect(gx - rx, gy - rx, rx * 2, rx * 2);
    }
    R.globalAlpha = 1;
    R.globalCompositeOperation = 'destination-in';
    R.drawImage(n.c, 0, 0);
  }
  // colour: hot at the crown, fading toward the legs
  R.globalCompositeOperation = 'source-in';
  const g = R.createLinearGradient(0, oy - h, 0, oy);
  g.addColorStop(0, 'rgb(255,150,156)');
  g.addColorStop(0.16, 'rgb(255,70,80)');
  g.addColorStop(0.45, 'rgb(180,20,32)');
  g.addColorStop(0.7, 'rgb(80,8,14)');
  g.addColorStop(1, 'rgb(50,5,10)');
  R.fillStyle = g;
  R.fillRect(0, 0, bw, bh);

  // soft light wrap
  const wrap = layer(bw, bh);
  wrap.ctx.filter = `blur(${h * 0.008}px)`;
  wrap.ctx.drawImage(rim.c, 0, 0);

  ctx.drawImage(fig.c, x - ox, y - oy);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.9;
  ctx.drawImage(rim.c, x - ox, y - oy);
  ctx.globalAlpha = 0.5;
  ctx.drawImage(wrap.c, x - ox, y - oy);
  ctx.restore();
  if (lights) {
    lights.save();
    lights.globalCompositeOperation = 'destination-out';
    lights.drawImage(mask.c, x - ox, y - oy);
    lights.globalCompositeOperation = 'source-over';
    lights.globalAlpha = 0.3;
    lights.drawImage(rim.c, x - ox, y - oy);
    lights.restore();
  }
}
