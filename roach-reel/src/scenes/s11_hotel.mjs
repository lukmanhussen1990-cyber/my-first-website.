// S11 "Now your dick is a fucking hotel." — the burrow becomes HOTEL COCKROACH ★★★★★.
import { W, H, TAU, E, tw, kf, clamp, lerp, noise1, wobble, shake, pop, rgb, hex, hash, rng } from '../core.mjs';
import { setLight, glow, softShadow, drawMesh, cached, slab, panel, blob, path } from '../poly.mjs';
import { RC, porthole } from '../env_burrow.mjs';
import { drawRoach, suitcase, blink } from '../roach.mjs';
import { camera, camPoint, callout } from '../fx.mjs';
import { dust } from '../layers.mjs';
import { CUTS, ws } from '../timeline.mjs';

const t0 = CUTS.hotel, t1 = CUTS.genius;
const tHotel = ws('hotel'), tFreeze = t1 - 0.24;
const BX0 = 120, BX1 = 960;
const FLOORS = [ // [top, bottom, kind]
  [1130, 1500, 'lobby'], [820, 1130, 'rooms'], [510, 820, 'pool'], [200, 510, 'rooms'], [-110, 200, 'suite'],
];

function cave(ctx) {
  drawMesh(ctx, cached('h:soil', () => panel(-1400, -1800, 3900, 4400, { cols: 16, rows: 20, seed: 901, wob: 0.6, jitter: 0.6 })), { c: RC.soil, kd: 0.7, jit: 0.12 });
  const R = rng(91);
  for (let i = 0; i < 70; i++) {
    const x = -1200 + R() * 3500, y = -1600 + R() * 4000;
    if (x > BX0 - 80 && x < BX1 + 80 && y > -600 && y < 1700) continue;
    ctx.save(); ctx.translate(x, y);
    drawMesh(ctx, cached('peb' + (i % 6), () => blob([[-20, 0], [0, -14], [24, -4], [18, 12], [-12, 14]], { rings: [0.5], bulge: 0.6, seed: 910 + (i % 6) })), { c: [120, 90, 70], kd: 0.8, spec: 0.2 });
    ctx.restore();
  }
  // glowing mushrooms + tunnel pipes for a cozy cave
  for (const [x, y, s] of [[-200, 1480, 1], [1250, 1470, 1.2], [-420, 1460, 0.8], [1450, 1480, 0.9]]) {
    glow(ctx, x, y - 60 * s, 180 * s, [120, 255, 200], 0.4);
    ctx.fillStyle = '#f0e6d2'; ctx.fillRect(x - 10 * s, y - 60 * s, 20 * s, 60 * s);
    ctx.fillStyle = '#5ee6b0'; ctx.beginPath(); ctx.ellipse(x, y - 60 * s, 46 * s, 26 * s, 0, Math.PI, TAU); ctx.fill();
  }
  ctx.fillStyle = '#3a1d10'; ctx.fillRect(-1400, 1500, 3900, 1200);
}

function roomContents(ctx, kind, x0, x1, top, bot, t, idx) {
  const cx = (x0 + x1) / 2, h = bot - top;
  if (kind === 'rooms' || kind === 'suite') {
    // 3 rooms with dividers, beds, tiny tv glow, guests
    const n = kind === 'suite' ? 2 : 3;
    for (let r = 0; r < n; r++) {
      const rx0 = x0 + ((x1 - x0) * r) / n, rx1 = x0 + ((x1 - x0) * (r + 1)) / n, rc = (rx0 + rx1) / 2;
      ctx.fillStyle = r % 2 ? '#e7a35c' : '#dd9450'; ctx.fillRect(rx0, top, rx1 - rx0, h);
      // window
      porthole(ctx, rc, top + h * 0.36, 34, t + r);
      // bed (matchbox)
      drawMesh(ctx, cached('mbed', () => slab(-70, -46, 140, 46, { bevel: 8, seed: 920, cols: 2, rows: 1 })), { c: hex('#ef476f'), kd: 0.8 });
      ctx.save(); ctx.translate(rc - 30, bot);
      drawMesh(ctx, cached('mbed', () => slab(-70, -46, 140, 46, { bevel: 8, seed: 920, cols: 2, rows: 1 })), { c: hex(['#ef476f', '#118ab2', '#06d6a0'][(idx + r) % 3]), kd: 0.8 });
      ctx.fillStyle = '#fff'; ctx.fillRect(-66, -58, 40, 16);
      ctx.restore();
      const guest = hash(idx * 10 + r);
      drawRoach(ctx, { x: rc + 50, y: bot - 2, s: 0.28, t: t + idx + r, turn: guest > 0.5 ? 0.5 : -0.5, acc: { hat: guest > 0.6 ? 'party' : guest > 0.3 ? 'beanie' : null, hatCol: '#ffbe0b', sunglasses: guest < 0.2 ? 1 : 0 }, mouth: 'grin', grin: 0.8, eyeOpen: blink(t, idx + r, 2.4), arms: [[-0.9 + Math.sin(t * 6 + r) * 0.4, 0.3], [2.4 + Math.sin(t * 8 + r) * 0.3, 3.2]], shadow: false });
      if (r < n - 1) { ctx.fillStyle = '#7b4a2a'; ctx.fillRect(rx1 - 6, top, 12, h); }
    }
  } else if (kind === 'pool') {
    ctx.fillStyle = '#9fd8e8'; ctx.fillRect(x0, top, x1 - x0, h);
    // tiles
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let x = x0; x < x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bot); ctx.stroke(); }
    for (let y = top; y < bot; y += 40) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    // water
    const wy = top + h * 0.45;
    const g = ctx.createLinearGradient(0, wy, 0, bot); g.addColorStop(0, '#36c2f0'); g.addColorStop(1, '#1667b8');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, bot);
    for (let x = x0; x <= x1; x += 20) ctx.lineTo(x, wy + Math.sin(x * 0.03 + t * 4) * 8);
    ctx.lineTo(x1, bot); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) { const x = x0 + 60 + i * 130 + Math.sin(t * 2 + i) * 20; ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, wy + 30 + (i % 3) * 30, 50, 5); }
    // donut float with chilling roach
    const fx = cx + Math.sin(t * 1.5) * 80, fy = wy + Math.sin(fx * 0.03 + t * 4) * 8;
    ctx.save(); ctx.translate(fx, fy);
    ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.ellipse(0, 0, 70, 24, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#1e88c8'; ctx.beginPath(); ctx.ellipse(0, -2, 28, 9, 0, 0, TAU); ctx.fill();
    ctx.restore();
    drawRoach(ctx, { x: fx, y: fy - 2, s: 0.3, t: t + 5, turn: 0.4, acc: { sunglasses: 1 }, mouth: 'grin', grin: 1, arms: [[-2.6, -3.4], [2.6, 3.4]], legs: [[-1.3, -1.2], [1.3, 1.2]], shadow: false });
    // diving board + diver
    ctx.fillStyle = '#fff'; ctx.fillRect(x1 - 200, wy - 70, 170, 14); ctx.fillStyle = '#ccc'; ctx.fillRect(x1 - 60, wy - 56, 20, 60);
    const jump = (t * 0.9) % 1;
    drawRoach(ctx, { x: x1 - 150 - jump * 120, y: wy - 70 - Math.sin(jump * Math.PI) * 120 + (jump > 0.8 ? (jump - 0.8) * 400 : 0), s: 0.26, t, lean: -jump * 3, mouth: 'open', mouthOpen: 0.8, arms: [[-2.9, -3.1], [2.9, 3.1]], shadow: false });
  } else if (kind === 'lobby') {
    ctx.fillStyle = '#f2b66a'; ctx.fillRect(x0, top, x1 - x0, h);
    // marble floor stripes + chandelier
    ctx.fillStyle = '#d68a3c'; ctx.fillRect(x0, top, x1 - x0, 20);
    glow(ctx, cx, top + 80, 360, [255, 220, 150], 0.55);
    ctx.fillStyle = '#ffd77a'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(cx + i * 30, top + 70 + Math.abs(i) * -6, 10, 0, TAU); ctx.fill(); }
    // CHECK-IN sign
    ctx.fillStyle = '#7b2d26'; ctx.fillRect(cx + 40, top + 120, 260, 60);
    ctx.fillStyle = '#ffe14d'; ctx.font = '40px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CHECK-IN', cx + 170, top + 152);
    // reception desk + bell + receptionist
    drawRoach(ctx, { x: cx + 170, y: bot - 70, s: 0.42, t: t + 2, turn: -0.3, acc: { bowtie: '#e63946', hat: 'cap', hatCol: '#7b2d26' }, mouth: 'grin', grin: 1, eyeOpen: blink(t, 3, 2.1), arms: [[-0.75, 0.35], [1.4 + Math.max(0, Math.sin((t - tHotel) * 20)) * 0.4 * (t > tHotel && t < tHotel + 0.3 ? 1 : 0), 1.6]], shadow: false });
    drawMesh(ctx, cached('desk', () => slab(-170, -150, 340, 150, { bevel: 16, seed: 930, cols: 3, rows: 1 })), { c: hex('#8a5230'), kd: 0.8, spec: 0.3 });
    ctx.save(); ctx.translate(cx + 170, bot); drawMesh(ctx, cached('desk', () => slab(-170, -150, 340, 150, { bevel: 16, seed: 930, cols: 3, rows: 1 })), { c: hex('#8a5230'), kd: 0.8, spec: 0.3 });
    // bell
    const ring = t > tHotel ? wobble(t, tHotel, 9, 6) : 0;
    ctx.translate(-80, -150); ctx.rotate(ring * 0.15);
    ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(0, 0, 26, Math.PI, TAU); ctx.fill(); ctx.fillRect(-32, -2, 64, 8); ctx.fillRect(-4, -34, 8, 10);
    if (t > tHotel && t < tHotel + 0.5) glow(ctx, 0, -10, 110, [255, 240, 160], 0.8 * (1 - (t - tHotel) / 0.5));
    ctx.restore();
    // queue of guests with luggage
    for (let i = 0; i < 5; i++) {
      const qx = x0 + 80 + i * 105 + Math.sin(t * 3 + i) * 4;
      drawRoach(ctx, { x: qx, y: bot - 4, s: 0.36, t: t + i, turn: 0.55, walk: i === 4 ? (t * 2) % 1 : null, acc: { hat: ['top', 'cowboy', 'party', null, 'beanie'][i], hatCol: ['#2b2b38', '#8d5524', '#3a86ff', '#000', '#06d6a0'][i], mustache: i === 1 }, mouth: 'grin', grin: 0.7, eyeOpen: blink(t, i, 2.5), arms: [[-0.75, 0.35], [0.2, 0]], holdR: (g) => suitcase(g, 70, 46, ['#8a4b2a', '#3a86ff', '#e63946', '#2a9d8f', '#ffbe0b'][i], true), shadow: false });
    }
  }
}

function building(ctx, t) {
  // floors rise up one by one
  FLOORS.forEach(([top, bot, kind], i) => {
    const ta = i === 0 ? t0 - 0.4 : t0 + 0.02 + i * 0.16;
    if (t < ta) return;
    const k = tw(t, ta, ta + 0.28, E.outBack);
    ctx.save();
    ctx.translate(0, bot); ctx.scale(1, k); ctx.translate(0, -bot);
    softShadow(ctx, (BX0 + BX1) / 2, bot, 520, 30, 0.3);
    // facade frame
    drawMesh(ctx, cached('fl' + i, () => slab(BX0 - 30, top - 20, BX1 - BX0 + 60, bot - top + 20, { bevel: 26, seed: 940 + i, cols: 4, rows: 1 })), { c: hex('#7a3e22'), kd: 0.8, spec: 0.25 });
    ctx.save(); ctx.beginPath(); ctx.rect(BX0, top, BX1 - BX0 - 110, bot - top - 4); ctx.clip();
    roomContents(ctx, kind, BX0, BX1 - 110, top, bot - 4, t, i);
    ctx.restore();
    // elevator shaft
    ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.fillRect(BX1 - 100, top, 90, bot - top - 4);
    ctx.strokeStyle = '#3b1f10'; ctx.lineWidth = 6; ctx.strokeRect(BX1 - 100, top, 90, bot - top - 4);
    ctx.restore();
  });
  // elevator car
  const ey = lerp(1380, -60, (Math.sin(t * 1.6) * 0.5 + 0.5));
  if (t > t0 + 0.9) {
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(BX1 - 92, ey - 110, 74, 110);
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(BX1 - 84, ey - 100, 58, 70);
    drawRoach(ctx, { x: BX1 - 55, y: ey - 6, s: 0.2, t, mouth: 'grin', grin: 1, shadow: false });
  }
  // roof + neon sign
  const ts = t0 + 0.05 + FLOORS.length * 0.17;
  if (t > ts) {
    const k = tw(t, ts, ts + 0.3, E.outBack);
    ctx.save(); ctx.translate(540, -110); ctx.scale(k, k);
    drawMesh(ctx, cached('roof', () => blob([[-470, 0], [-380, -90], [380, -90], [470, 0]], { rings: [0.5], bulge: 0.3, seed: 950 })), { c: hex('#5d2e18'), kd: 0.8 });
    // sign frame
    ctx.fillStyle = '#1b1020'; ctx.fillRect(-380, -420, 760, 300);
    ctx.strokeStyle = '#3a2a40'; ctx.lineWidth = 10; ctx.strokeRect(-380, -420, 760, 300);
    ctx.fillStyle = '#3a2a40'; ctx.fillRect(-300, -120, 20, 40); ctx.fillRect(280, -120, 20, 40);
    // neon: flickers on at "hotel"
    const fl = t < tHotel ? 0.08 : t < tHotel + 0.25 ? (Math.floor((t - tHotel) * 40) % 3 === 1 ? 0.15 : 1) : 0.92 + 0.08 * noise1(t * 20, 4);
    neonText(ctx, 'HOTEL', 0, -345, 120, '#ff4fd8', fl);
    neonText(ctx, 'COCKROACH', 0, -238, 86, '#36e7ff', fl);
    const sf = t < tHotel + 0.12 ? fl * 0.2 : fl;
    for (let i = 0; i < 5; i++) {
      const on = t > tHotel + 0.12 + i * 0.05 ? sf : 0.15;
      neonStar(ctx, -160 + i * 80, -158, 26, on);
    }
    ctx.restore();
  }
}

function neonStar(ctx, x, y, r, on) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath();
  if (on > 0.3) { ctx.shadowColor = '#ffe14d'; ctx.shadowBlur = 30 * on; }
  ctx.fillStyle = on > 0.3 ? 'rgba(255,250,200,0.95)' : 'rgba(120,100,30,0.5)'; ctx.fill();
  ctx.strokeStyle = rgb([255, 225, 77], 0.3 + 0.7 * on); ctx.lineWidth = 5; ctx.stroke();
  ctx.restore();
  if (on > 0.3) glow(ctx, x, y, r * 3, [255, 225, 77], 0.3 * on);
}

function neonText(ctx, text, x, y, size, col, on) {
  ctx.save();
  ctx.font = `${size}px "Luckiest Guy"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const c = hex(col);
  if (on > 0.3) { ctx.shadowColor = col; ctx.shadowBlur = 40 * on; }
  ctx.strokeStyle = rgb(c, 0.25 + 0.75 * on); ctx.lineWidth = size * 0.12; ctx.strokeText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = on > 0.3 ? rgb([255, 255, 255], 0.9 * on) : rgb(c, 0.25); ctx.fillText(text, x, y);
  ctx.restore();
  if (on > 0.3) glow(ctx, x, y, size * 3.2, c, 0.32 * on);
}

function hotelCam(t) {
  const k = tw(t, t0 + 0.05, tHotel + 0.2, E.inOutCubic);
  return { x: lerp(560, 545, k) + noise1(t * 0.5, 1) * 8, y: lerp(1260, 470, k) + noise1(t * 0.5, 2) * 8, zoom: lerp(1.55, 0.84, k) + tw(t, tHotel, t1, E.inOutSine) * 0.05 + wobble(t, tHotel, 3, 5) * 0.03, rot: noise1(t * 0.3, 3) * 0.01, x0: 540, y0: 960 };
}

function drawHotel(ctx, t) {
  const cam = hotelCam(t);
  const [lx, ly] = camPoint(cam, 540, 1200);
  const [nx, ny] = camPoint(cam, 540, -380);
  const neonOn = t > tHotel ? 1 : 0;
  setLight({ dir: [-0.3, -0.8, 0.5], key: [1.0, 0.82, 0.6], amb: [0.44, 0.3, 0.24], rim: [255, 120, 220], rimDir: [0, -1],
    points: [{ x: lx, y: ly, r: 1400 * cam.zoom, col: [1, 0.72, 0.38], k: 0.8 }, ...(neonOn ? [{ x: nx, y: ny, r: 1600 * cam.zoom, col: [1.0, 0.35, 0.9], k: 0.55 }] : [])] });
  ctx.save(); camera(ctx, cam, 0.9); cave(ctx); ctx.restore();
  ctx.save(); camera(ctx, cam, 1);
  building(ctx, t);
  dust(ctx, t, -600, -1200, 2300, 2900, 70, 51, [255, 210, 150], 0.4);
  ctx.restore();
}

export const s11 = {
  name: 'hotel', t0, t1,
  draw(ctx, t) {
    if (t >= tFreeze) {
      // record-scratch freeze frame: hold, jolt, desaturate
      const k = t - tFreeze;
      ctx.save();
      ctx.translate(W / 2 + Math.sin(k * 120) * 14 * Math.exp(-k * 8), H / 2); ctx.scale(1 + k * 0.15, 1 + k * 0.15); ctx.translate(-W / 2, -H / 2);
      drawHotel(ctx, tFreeze);
      ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = clamp(k / 0.1) * 0.85; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H); ctx.restore();
      return;
    }
    drawHotel(ctx, t);
  },
  ui(ctx, t) {
    callout(ctx, t, tHotel + 0.02, 'DING!', 820, 1120, { dur: 0.6, scale: 0.7, rot: 0.12, edge: '#ffbe0b' });
  },
};
