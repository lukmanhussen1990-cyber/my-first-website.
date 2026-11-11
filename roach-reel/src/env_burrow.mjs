// The roach's cozy burrow (warm amber cutaway) + furniture props.
import { TAU, clamp, lerp, rgb, hex, mixc, rng, noise1, E } from './core.mjs';
import { blob, ellipsePts, ellipseBlob, slab, panel, cached, drawMesh, limb, glow, softShadow, path, setLight } from './poly.mjs';
import { camPoint } from './fx.mjs';

export const RC = {
  soil: hex('#4a2516'), soilDk: hex('#2a130b'), wall: hex('#d98a45'), wallDk: hex('#a85a2a'), wood: hex('#8a5230'), woodDk: hex('#5d3219'),
  floor: hex('#b0703c'), rug: hex('#c4384a'), lamp: [1.15, 0.82, 0.45],
};
export const ROOM = { x0: 40, x1: 1040, top: 560, floor: 1500 };
export const LAMP_B = [540, 700];

export function burrowLighting(cam, o = {}) {
  const [lx, ly, z] = camPoint(cam, LAMP_B[0], LAMP_B[1] + 40);
  const pts = [{ x: lx, y: ly, r: 1300 * z, col: [1.0, 0.72, 0.38], k: 0.95, z: 0.5 }];
  if (o.tv) { const [tx, ty] = camPoint(cam, o.tv[0], o.tv[1]); pts.push({ x: tx, y: ty, r: 600 * z, col: [0.4, 0.75, 1.1], k: o.tvK ?? 0.6 }); }
  if (o.extra) pts.push(...o.extra);
  setLight({ dir: [-0.2, -0.85, 0.5], key: [1.0, 0.82, 0.6], amb: [0.42, 0.28, 0.22], rim: [255, 170, 90], rimDir: [0.9, -0.3], points: pts });
}

function archPts(x0, x1, top, floor, n = 18) {
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = (floor - top) * 0.55;
  const pts = [[x0, floor]];
  for (let i = 0; i <= n; i++) { const a = Math.PI + (i / n) * Math.PI; pts.push([cx + Math.cos(a) * rx, top + ry + Math.sin(a) * ry]); }
  pts.push([x1, floor]);
  return pts;
}

/** room shell: soil, arch walls, ribs, floor, rug, window, decor. */
export function burrowRoom(ctx, t, o = {}) {
  // soil surround
  drawMesh(ctx, cached('b:soil', () => panel(-800, -800, 2700, 3600, { cols: 14, rows: 18, seed: 601, wob: 0.6, jitter: 0.6 })), { c: RC.soil, kd: 0.7, jit: 0.12 });
  // pebbles + roots
  const R = rng(4);
  for (let i = 0; i < 40; i++) {
    const x = -500 + R() * 2100, y = -400 + R() * 2900;
    if (x > ROOM.x0 - 40 && x < ROOM.x1 + 40 && y > ROOM.top - 60 && y < ROOM.floor + 200) continue;
    ctx.save(); ctx.translate(x, y);
    drawMesh(ctx, cached('peb' + (i % 6), () => ellipseBlob(20 + (i % 6) * 9, 14 + (i % 4) * 7, { n: 7, rings: [0.5], bulge: 0.6, seed: 610 + (i % 6) })), { c: mixc(RC.soil, [140, 110, 90], 0.45 + (i % 3) * 0.1), kd: 0.8, spec: 0.2 });
    ctx.restore();
  }
  ctx.strokeStyle = rgb(mixc(RC.soilDk, [120, 80, 40], 0.3)); ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const [x, y, a] of [[120, 400, 0.4], [900, 380, -0.5], [-60, 1100, 1.2], [1120, 1200, -1.3]]) {
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * 120, y + 80, x + Math.cos(a) * 220, y + 200); ctx.stroke();
  }
  // room cavity
  const A = archPts(ROOM.x0, ROOM.x1, ROOM.top, ROOM.floor);
  ctx.save();
  path(ctx, A); ctx.clip();
  drawMesh(ctx, cached('b:wall', () => panel(ROOM.x0 - 20, ROOM.top - 20, ROOM.x1 - ROOM.x0 + 40, ROOM.floor - ROOM.top + 40, { cols: 9, rows: 9, seed: 602, wob: 0.35 })), { c: RC.wall, kd: 0.6, jit: 0.06 });
  // wainscot planks
  ctx.fillStyle = rgb(RC.wallDk); ctx.fillRect(ROOM.x0, 1290, ROOM.x1 - ROOM.x0, 210);
  ctx.strokeStyle = 'rgba(70,30,10,0.35)'; ctx.lineWidth = 4;
  for (let x = ROOM.x0; x < ROOM.x1; x += 70) { ctx.beginPath(); ctx.moveTo(x, 1290); ctx.lineTo(x, 1500); ctx.stroke(); }
  ctx.fillStyle = rgb(RC.woodDk); ctx.fillRect(ROOM.x0, 1280, ROOM.x1 - ROOM.x0, 16);
  // round porthole window to the pipe tunnel
  if (o.window !== false) porthole(ctx, 830, 930, 120, t);
  // HOME sweet home frame
  if (o.frame !== false) homeFrame(ctx, 300, 900, t, o.frameSwing || 0);
  // shelf
  ctx.fillStyle = rgb(RC.woodDk); ctx.fillRect(560, 1060, 170, 14);
  for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#5bc0eb', '#9bc53d', '#fde74c'][i]; ctx.fillRect(580 + i * 50, 1010, 30, 50); ctx.fillStyle = '#7a4a2a'; ctx.fillRect(578 + i * 50, 1004, 34, 10); }
  ctx.restore();
  // wooden ribs along the arch
  ctx.save(); path(ctx, A, true); ctx.strokeStyle = rgb(RC.woodDk); ctx.lineWidth = 44; ctx.stroke();
  ctx.strokeStyle = rgb(RC.wood); ctx.lineWidth = 26; ctx.stroke(); ctx.restore();
  for (const x of [ROOM.x0 + 4, ROOM.x1 - 4]) { drawMesh(ctx, cached('b:post' + x, () => slab(x - 26, 1000, 52, 520, { bevel: 10, seed: 603, cols: 1, rows: 3 })), { c: RC.wood, kd: 0.8 }); }
  // floor
  drawMesh(ctx, cached('b:floor', () => slab(ROOM.x0 - 60, ROOM.floor, ROOM.x1 - ROOM.x0 + 120, 150, { bevel: 14, seed: 604, cols: 6, rows: 1 })), { c: RC.floor, kd: 0.75, spec: 0.2 });
  ctx.strokeStyle = 'rgba(70,35,15,0.4)'; ctx.lineWidth = 3;
  for (let x = ROOM.x0; x < ROOM.x1 + 60; x += 120) { ctx.beginPath(); ctx.moveTo(x, ROOM.floor + 6); ctx.lineTo(x - 20, ROOM.floor + 146); ctx.stroke(); }
  // rug
  ctx.save(); ctx.translate(540, ROOM.floor + 40); ctx.scale(1, 0.22);
  ctx.fillStyle = rgb(RC.rug); ctx.beginPath(); ctx.arc(0, 0, 330, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 20; ctx.beginPath(); ctx.arc(0, 0, 270, 0, TAU); ctx.stroke();
  ctx.restore();
}

export function porthole(ctx, x, y, r, t) {
  ctx.save(); ctx.translate(x, y);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, '#3d2a4a'); g.addColorStop(1, '#120c18');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  // pipe tunnel rings receding with a distant warm light
  for (let i = 5; i >= 1; i--) { ctx.strokeStyle = `rgba(255,170,90,${0.08 + 0.06 * (5 - i)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(10, -6, r * i / 6, 0, TAU); ctx.stroke(); }
  glow(ctx, 12, -6, r * 0.5, [255, 190, 110], 0.6 + 0.2 * Math.sin(t * 2));
  ctx.strokeStyle = '#6b4325'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#c99050'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.stroke();
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.fillStyle = '#e8c27a'; ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 6, 0, TAU); ctx.fill(); }
  ctx.restore();
}

function homeFrame(ctx, x, y, t, swing) {
  ctx.save(); ctx.translate(x, y - 90); ctx.rotate(swing);
  ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-50, 30); ctx.lineTo(0, 0); ctx.lineTo(50, 30); ctx.stroke();
  ctx.translate(0, 90);
  drawMesh(ctx, cached('frame', () => slab(-110, -70, 220, 150, { bevel: 14, seed: 620, cols: 2, rows: 1 })), { c: hex('#7b4a2a'), kd: 0.8, spec: 0.3 });
  ctx.fillStyle = '#f6ecd6'; ctx.fillRect(-90, -50, 180, 110);
  ctx.fillStyle = '#c4384a'; ctx.font = '34px "Luckiest Guy"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('HOME', 0, -14); ctx.font = '22px "Luckiest Guy"'; ctx.fillStyle = '#4a7c59'; ctx.fillText('SWEET HOME', 0, 22);
  ctx.restore();
}

export function lamp(ctx, x, y, t) {
  ctx.save(); ctx.translate(x, y);
  const sw = Math.sin(t * 1.3) * 0.04;
  ctx.rotate(sw);
  ctx.strokeStyle = '#2a160b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -200); ctx.lineTo(0, 0); ctx.stroke();
  glow(ctx, 0, 40, 520, [255, 190, 100], 0.55);
  drawMesh(ctx, cached('lampshade', () => blob([[-70, 30], [-40, -20], [40, -20], [70, 30]], { rings: [0.5], bulge: 0.4, seed: 630 })), { c: hex('#e9a13b'), kd: 0.7, emit: 0.3 });
  ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.ellipse(0, 34, 26, 16, 0, 0, TAU); ctx.fill();
  glow(ctx, 0, 40, 160, [255, 230, 160], 0.8);
  ctx.restore();
}

export function sofa(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  softShadow(ctx, 0, 0, 280, 26, 0.5);
  const m = { c: hex('#b8324a'), kd: 0.8, spec: 0.15, jit: 0.06 };
  drawMesh(ctx, cached('sofa:back', () => slab(-230, -300, 460, 190, { bevel: 30, seed: 640, cols: 3, rows: 1, chamfer: 30 })), m);
  drawMesh(ctx, cached('sofa:seat', () => slab(-220, -150, 440, 100, { bevel: 22, seed: 641, cols: 2, rows: 1, chamfer: 18 })), { ...m, c: hex('#cc3c55') });
  ctx.strokeStyle = 'rgba(80,10,20,0.5)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -146); ctx.lineTo(0, -52); ctx.stroke();
  for (const sd of [-1, 1]) drawMesh(ctx, cached('sofa:arm' + sd, () => slab(sd > 0 ? 180 : -270, -210, 90, 170, { bevel: 26, seed: 642 + sd, cols: 1, rows: 2, chamfer: 26 })), m);
  ctx.fillStyle = '#5d3219'; ctx.fillRect(-230, -50, 30, 50); ctx.fillRect(200, -50, 30, 50);
  // cushion
  ctx.save(); ctx.translate(-150, -190); ctx.rotate(-0.2);
  drawMesh(ctx, cached('cushion', () => slab(-55, -50, 110, 100, { bevel: 22, seed: 645, cols: 1, rows: 1, chamfer: 22 })), { c: hex('#f2c14e'), kd: 0.8 });
  ctx.restore();
  ctx.restore();
}

export function tv(ctx, x, y, s = 1, t = 0, on = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  softShadow(ctx, 0, 0, 160, 18, 0.5);
  // stand
  drawMesh(ctx, cached('tv:stand', () => slab(-120, -110, 240, 110, { bevel: 12, seed: 650, cols: 2, rows: 1 })), { c: hex('#6b4325'), kd: 0.8 });
  // antennas
  ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -330); ctx.lineTo(-70, -440); ctx.moveTo(0, -330); ctx.lineTo(80, -430); ctx.stroke();
  ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(-70, -440, 9, 0, TAU); ctx.arc(80, -430, 9, 0, TAU); ctx.fill();
  drawMesh(ctx, cached('tv:body', () => slab(-150, -340, 300, 230, { bevel: 26, seed: 651, cols: 2, rows: 2, chamfer: 30 })), { c: hex('#8c8f99'), kd: 0.75, spec: 0.4 });
  // screen
  ctx.save();
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-118, -312, 200, 172, 24) : ctx.rect(-118, -312, 200, 172); ctx.clip();
  if (on > 0) {
    const g = ctx.createLinearGradient(0, -312, 0, -140); g.addColorStop(0, '#5fd3ff'); g.addColorStop(1, '#2a6fdb');
    ctx.fillStyle = g; ctx.fillRect(-118, -312, 200, 172);
    // tiny show: a roach news anchor silhouette + scrolling ticker
    ctx.fillStyle = 'rgba(20,30,60,0.75)'; ctx.beginPath(); ctx.ellipse(-18, -200, 34, 30, 0, 0, TAU); ctx.fill(); ctx.fillRect(-60, -180, 84, 50);
    ctx.strokeStyle = 'rgba(20,30,60,0.75)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-28, -226); ctx.quadraticCurveTo(-50, -270, -80, -262); ctx.moveTo(-8, -226); ctx.quadraticCurveTo(10, -272, 40, -262); ctx.stroke();
    ctx.fillStyle = '#ffd34d'; ctx.fillRect(-118, -162, 200, 22);
    ctx.fillStyle = '#111'; ctx.font = '16px "Luckiest Guy"'; ctx.fillText('CRUMB PRICES SOAR • TOILET SURF REPORT •', 80 - ((t * 120) % 420), -146);
    // static burst at power on
    if (on < 1) { const R = rng(Math.floor(t * 60)); for (let i = 0; i < 260; i++) { ctx.fillStyle = `rgba(255,255,255,${R() * (1 - on)})`; ctx.fillRect(-118 + R() * 200, -312 + R() * 172, 5, 3); } }
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = -312; y < -140; y += 6) ctx.fillRect(-118, y, 200, 2);
  } else { ctx.fillStyle = '#1b2230'; ctx.fillRect(-118, -312, 200, 172); }
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-60, -280, 50, 18, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
  // knobs
  ctx.fillStyle = '#3a3d45'; ctx.beginPath(); ctx.arc(116, -280, 14, 0, TAU); ctx.arc(116, -235, 14, 0, TAU); ctx.fill();
  if (on > 0) glow(ctx, -18, -226, 260, [90, 190, 255], 0.35 * on);
  ctx.restore();
}

export function fridge(ctx, x, y, s = 1, t = 0, door = 0, hum = 0) {
  ctx.save(); ctx.translate(x + Math.sin(t * 90) * 2.5 * hum, y); ctx.scale(s, s);
  softShadow(ctx, 0, 0, 140, 18, 0.5);
  const m = { c: hex('#8fd3c1'), kd: 0.75, spec: 0.45, shin: 26 };
  drawMesh(ctx, cached('fr:body', () => slab(-110, -420, 220, 420, { bevel: 26, seed: 660, cols: 2, rows: 3, chamfer: 34 })), m);
  ctx.strokeStyle = 'rgba(30,70,60,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-100, -280); ctx.lineTo(100, -280); ctx.stroke();
  ctx.fillStyle = '#d9d9d9'; ctx.fillRect(70, -390, 14, 80); ctx.fillRect(70, -250, 14, 110);
  // door swing
  if (door > 0.01) {
    ctx.fillStyle = '#fff6d8'; ctx.fillRect(-96, -266, 192, 250);
    glow(ctx, 0, -150, 240, [255, 245, 200], 0.6 * door);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-60, -110, 24, 46); ctx.fillStyle = '#3498db'; ctx.fillRect(-20, -100, 22, 36); ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(40, -90, 20, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(-110, 0); ctx.scale(Math.max(0.12, Math.cos(door * 1.3)), 1);
    drawMesh(ctx, cached('fr:door', () => slab(0, -276, 220, 270, { bevel: 18, seed: 661, cols: 2, rows: 2, chamfer: 20 })), m);
    ctx.restore();
  }
  // sticker
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(-40, -350, 22, 0, TAU); ctx.fill();
  if (hum > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * hum})`; ctx.lineWidth = 5; ctx.lineCap = 'round'; for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const r = 140 + i * 26 + Math.sin(t * 20 + i) * 4; ctx.beginPath(); ctx.arc(0, -220, r, sd > 0 ? -0.4 : Math.PI - 0.4, sd > 0 ? 0.4 : Math.PI + 0.4); ctx.stroke(); } }
  ctx.restore();
}

export function smallDoor(ctx, x, y, s = 1, open = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#2a140a'; ctx.beginPath(); ctx.moveTo(-80, 0); ctx.lineTo(-80, -150); ctx.arc(0, -150, 80, Math.PI, 0); ctx.lineTo(80, 0); ctx.closePath(); ctx.fill();
  drawMesh(ctx, cached('sdoor', () => blob([[-70, -4], [-70, -150], [-50, -205], [0, -224], [50, -205], [70, -150], [70, -4]], { rings: [0.6], bulge: 0.3, seed: 670 })), { c: hex('#3f8f5a'), kd: 0.8, spec: 0.25 });
  ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(40, -100, 10, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 4; for (const xx of [-24, 24]) { ctx.beginPath(); ctx.moveTo(xx, -10); ctx.lineTo(xx, -190); ctx.stroke(); }
  // gap under door
  ctx.fillStyle = 'rgba(255,220,150,0.9)'; ctx.fillRect(-68, -6, 136, 6);
  ctx.restore();
}
