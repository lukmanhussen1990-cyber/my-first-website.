// Night bathroom set pieces (cool blue moonlight + warm yellow toilet light) and the cartoon stream.
import { TAU, clamp, lerp, rgb, hex, mixc, rng, noise1, E } from './core.mjs';
import { blob, ellipsePts, ellipseBlob, slab, panel, cached, drawMesh, limb, glow, softShadow, path, fillPoly, LIGHT, setLight, bezierPts } from './poly.mjs';
import { camPoint } from './fx.mjs';

export const BC = {
  wall: hex('#5d7fb3'), wallUp: hex('#3d5786'), tile: hex('#a9c4e6'), grout: hex('#4f6b99'), floorA: hex('#8eaad2'), floorB: hex('#48618f'),
  porcelain: hex('#f2f6fb'), water: hex('#69b8e8'), pee: hex('#ffd23a'), peeLt: hex('#fff3a6'), peeDk: hex('#e9a516'),
  moon: hex('#fff7d6'), warm: [1.0, 0.72, 0.32],
};

export function bathLighting(cam, lampXY, o = {}) {
  const pts = [];
  if (lampXY) {
    const [sx, sy, z] = camPoint(cam, lampXY[0], lampXY[1]);
    pts.push({ x: sx, y: sy, r: (o.lampR || 760) * z, col: [1.0, 0.68, 0.28], k: o.lampK ?? 1.0, z: 0.5 });
  }
  if (o.extra) pts.push(...o.extra);
  setLight({
    dir: o.dir || [-0.55, -0.6, 0.58],
    key: o.key || [0.72, 0.86, 1.12],
    amb: o.amb || [0.3, 0.35, 0.52],
    rim: o.rim || [255, 186, 90],
    rimDir: o.rimDir || [1, -0.15],
    points: pts,
  });
}

/** Tiled wall section: tiles are bevelled slabs with grout between. */
export function tileWall(ctx, x, y, w, h, tile = 96, seed = 1, col = BC.tile) {
  ctx.fillStyle = rgb(mixc(BC.grout, [0, 0, 0], 0.2));
  ctx.fillRect(x, y, w, h);
  const cols = Math.ceil(w / tile), rows = Math.ceil(h / tile);
  const R = rng(seed);
  const m = { c: col, kd: 0.7, spec: 0.35, shin: 30, jit: 0.07 };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const tx = x + c * tile + 3, ty = y + r * tile + 3;
    const key = `tile:${tile}:${(r * 7 + c * 3 + seed) % 5}`;
    ctx.save(); ctx.translate(tx, ty);
    drawMesh(ctx, cached(key, () => slab(0, 0, tile - 6, tile - 6, { bevel: tile * 0.1, seed: (r * 7 + c * 3 + seed) % 5 + 1, cols: 1, rows: 1, jitter: 0.3 })), { ...m, c: mixc(col, [255, 255, 255], (R() - 0.5) * 0.08) });
    ctx.restore();
  }
}

/** Perspective checker floor between yTop (horizon side) and yBot, converging to vx. */
export function floorPersp(ctx, vx, yTop, yBot, xL, xR, o = {}) {
  const rows = o.rows || 9, colsN = o.cols || 14, spread = o.spread || 3.2;
  const A = o.a || BC.floorA, B = o.b || BC.floorB;
  const depthAt = (i) => { const u = i / rows; return yTop + (yBot - yTop) * Math.pow(u, o.pow || 1.8); };
  const m = { kd: 0.6, spec: 0.5, shin: 40, jit: 0.06, underlay: false };
  for (let i = 0; i < rows; i++) {
    const y0 = depthAt(i), y1 = depthAt(i + 1);
    const k0 = 1 + (spread - 1) * ((y0 - yTop) / (yBot - yTop)), k1 = 1 + (spread - 1) * ((y1 - yTop) / (yBot - yTop));
    for (let j = -colsN / 2; j < colsN / 2; j++) {
      const w = (xR - xL) / colsN;
      const xa0 = vx + (xL - vx + (j + colsN / 2) * w) * k0 - (xL - vx) * 0, xb0 = xa0 + w * k0;
      const xa1 = vx + (xL - vx + (j + colsN / 2) * w) * k1, xb1 = xa1 + w * k1;
      const col = (i + j) % 2 ? A : B;
      const tri = (pts, n) => ({ p: pts.flat(), n, cx: (pts[0][0] + pts[1][0] + pts[2][0]) / 3, cy: (pts[0][1] + pts[1][1] + pts[2][1]) / 3, j: ((i * 31 + j * 17) % 7) / 7 - 0.5 });
      drawMesh(ctx, { tris: [tri([[xa0, y0], [xb0, y0], [xb1, y1]], [0.06, -0.5, 0.86]), tri([[xa0, y0], [xb1, y1], [xa1, y1]], [-0.06, -0.42, 0.9])] }, { ...m, c: col });
    }
  }
  // grout lines
  ctx.strokeStyle = 'rgba(20,30,60,0.35)'; ctx.lineWidth = 2;
}

export function toilet(ctx, x, y, s = 1, o = {}) {
  // origin: floor contact centre. Front view from slightly above.
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  softShadow(ctx, 0, 0, 170, 30, 0.5);
  const m = { c: BC.porcelain, kd: 0.62, amb: 1.05, spec: 0.55, shin: 40, jit: 0.035 };
  // tank
  drawMesh(ctx, cached('toilet:tank', () => slab(-120, -430, 240, 190, { bevel: 18, seed: 71, cols: 3, rows: 2, chamfer: 14 })), m);
  drawMesh(ctx, cached('toilet:lid', () => slab(-132, -452, 264, 34, { bevel: 10, seed: 72, cols: 3, rows: 1, chamfer: 10 })), m);
  // flush button
  ctx.fillStyle = rgb(mixc(BC.porcelain, [140, 160, 190], 0.5)); ctx.beginPath(); ctx.ellipse(70, -400, 18, 9, 0, 0, TAU); ctx.fill();
  // pedestal
  drawMesh(ctx, cached('toilet:ped', () => blob([[-70, -150], [70, -150], [80, -60], [96, 0], [-96, 0], [-80, -60]], { rings: [0.6], bulge: 0.5, seed: 73 })), m);
  // bowl outer
  drawMesh(ctx, cached('toilet:bowl', () => blob(ellipsePts(150, 100, 18, 0, 0, -190).map(([px, py]) => [px * (py > -190 ? 1 - 0.35 * ((py + 190) / 100) : 1), py]), { rings: [0.7, 0.35], bulge: 0.6, seed: 74, apex: [-0.1, -0.3] })), m);
  // seat ring + water
  drawMesh(ctx, cached('toilet:seat', () => ellipseBlob(142, 52, { n: 18, rings: [0.75], bulge: 0.3, seed: 75, cy: -236 })), { ...m, c: mixc(BC.porcelain, [210, 225, 245], 0.4) });
  ctx.fillStyle = rgb(mixc(BC.water, [10, 30, 60], 0.35)); ctx.beginPath(); ctx.ellipse(0, -234, 104, 34, 0, 0, TAU); ctx.fill();
  const wg = ctx.createLinearGradient(0, -268, 0, -200); wg.addColorStop(0, rgb(mixc(BC.water, [20, 40, 80], 0.6))); wg.addColorStop(1, rgb(BC.water, 0.9));
  ctx.fillStyle = wg; ctx.beginPath(); ctx.ellipse(0, -228, 84, 24, 0, 0, TAU); ctx.fill();
  if (o.ripple != null) {
    for (let i = 0; i < 3; i++) {
      const ph = (o.ripple + i / 3) % 1;
      ctx.strokeStyle = `rgba(230,250,255,${0.55 * (1 - ph)})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(o.rippleX || 0, -226, 12 + ph * 60, 4 + ph * 16, 0, 0, TAU); ctx.stroke();
    }
  }
  // seat lid up (raised, behind) hint
  ctx.restore();
}

export function windowMoon(ctx, x, y, w, h, t, cam) {
  // night sky
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#0c1633'); g.addColorStop(1, '#22386a');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // stars
  const R = rng(5);
  for (let i = 0; i < 26; i++) { const sx = x + R() * w, sy = y + R() * h * 0.8, tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7); ctx.fillStyle = `rgba(255,255,240,${0.3 + 0.6 * tw})`; ctx.beginPath(); ctx.arc(sx, sy, 1.5 + R() * 1.8, 0, TAU); ctx.fill(); }
  // moon
  const mx = x + w * 0.62, my = y + h * 0.32;
  glow(ctx, mx, my, w * 0.75, [200, 220, 255], 0.55);
  drawMesh(ctx, cached('moon', () => ellipseBlob(46, 46, { n: 14, rings: [0.65, 0.3], bulge: 0.5, seed: 81 })), { c: BC.moon, kd: 0.25, amb: 0.2, emit: 0.95, spec: 0, jit: 0.04 });
  ctx.save(); ctx.translate(mx, my);
  ctx.fillStyle = 'rgba(200,190,150,0.45)'; for (const [cx, cy, r] of [[-14, -10, 9], [12, 8, 7], [-4, 18, 5]]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
  // frame
  const fm = { c: hex('#dfe8f5'), kd: 0.6, spec: 0.3 };
  drawMesh(ctx, cached(`winframe:${w}:${h}`, () => frameMesh(x, y, w, h, 22)), fm);
  ctx.fillStyle = rgb(hex('#dfe8f5')); ctx.fillRect(x + w / 2 - 7, y, 14, h); ctx.fillRect(x, y + h / 2 - 7, w, 14);
}
function frameMesh(x, y, w, h, b) {
  const A = slab(x - b, y - b, w + 2 * b, b * 2, { bevel: 6, seed: 82, cols: 2, rows: 1 });
  const B = slab(x - b, y + h - b, w + 2 * b, b * 2, { bevel: 6, seed: 83, cols: 2, rows: 1 });
  const L = slab(x - b, y - b, b * 2, h + 2 * b, { bevel: 6, seed: 84, cols: 1, rows: 2 });
  const Rr = slab(x + w - b, y - b, b * 2, h + 2 * b, { bevel: 6, seed: 85, cols: 1, rows: 2 });
  return { tris: [...A.tris, ...B.tris, ...L.tris, ...Rr.tris] };
}

/** volumetric moonbeam (screen-blend quad) */
export function moonBeam(ctx, pts, a = 0.18, col = [170, 200, 255]) {
  const g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[3][0], pts[3][1]);
  g.addColorStop(0, rgb(col, a)); g.addColorStop(1, rgb(col, 0));
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  path(ctx, pts); ctx.fillStyle = g; ctx.fill();
  ctx.restore();
}

export function nightLight(ctx, x, y, t, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const flick = 0.92 + 0.08 * noise1(t * 6, 3);
  glow(ctx, 0, 0, 420, [255, 190, 90], 0.45 * flick);
  drawMesh(ctx, cached('nl:plate', () => slab(-34, -46, 68, 92, { bevel: 8, seed: 86, cols: 1, rows: 2, chamfer: 8 })), { c: hex('#e9e2d4'), kd: 0.6 });
  drawMesh(ctx, cached('nl:bulb', () => blob([[-26, -10], [-20, -34], [0, -42], [20, -34], [26, -10], [16, 14], [-16, 14]], { rings: [0.5], bulge: 0.5, seed: 87 })), { c: hex('#ffd77a'), kd: 0.2, amb: 0.3, emit: 1.0 * flick, spec: 0.2 });
  glow(ctx, 0, -14, 110, [255, 220, 140], 0.8 * flick);
  ctx.restore();
}

export function wallClock(ctx, x, y, r, t, o = {}) {
  ctx.save(); ctx.translate(x, y);
  softShadow(ctx, 10, 16, r * 1.08, r * 1.08, 0.35);
  drawMesh(ctx, cached(`clock:rim:${r}`, () => ellipseBlob(r, r, { n: 20, rings: [0.9, 0.5], bulge: 0.35, seed: 88 })), { c: hex('#d94848'), kd: 0.8, spec: 0.6, shin: 30 });
  drawMesh(ctx, cached(`clock:face:${r}`, () => ellipseBlob(r * 0.84, r * 0.84, { n: 20, rings: [0.6], bulge: 0.12, seed: 89 })), { c: hex('#fbf6e8'), kd: 0.45, amb: 1.2, emit: 0.2 });
  // ticks + numbers
  ctx.fillStyle = '#26324a';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.save(); ctx.rotate(a);
    ctx.fillRect(-4, -r * 0.78, 8, i % 3 === 0 ? r * 0.14 : r * 0.08);
    ctx.restore();
  }
  ctx.font = `${r * 0.26}px "Luckiest Guy"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [n, a] of [[12, 0], [3, 0.25], [6, 0.5], [9, 0.75]]) ctx.fillText(String(n), Math.sin(a * TAU) * r * 0.52, -Math.cos(a * TAU) * r * 0.52 + 4);
  ctx.font = `${r * 0.13}px "Luckiest Guy"`; ctx.fillStyle = '#d94848'; ctx.fillText('AM', 0, r * 0.3);
  // hands at 3:00 (minute hand trembles to 12)
  const hourA = 0.25 * TAU, minA = 0 + (o.minWob || 0);
  const secA = (Math.floor(t * 2) / 2) * (TAU / 60) * 8 + (o.secOff || 0);
  ctx.strokeStyle = '#1b2233'; ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.07; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(hourA) * r * 0.42, -Math.cos(hourA) * r * 0.42); ctx.stroke();
  ctx.lineWidth = r * 0.05; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(minA) * r * 0.66, -Math.cos(minA) * r * 0.66); ctx.stroke();
  ctx.strokeStyle = '#d94848'; ctx.lineWidth = r * 0.022; ctx.beginPath(); ctx.moveTo(-Math.sin(secA) * r * 0.15, Math.cos(secA) * r * 0.15); ctx.lineTo(Math.sin(secA) * r * 0.72, -Math.cos(secA) * r * 0.72); ctx.stroke();
  ctx.fillStyle = '#1b2233'; ctx.beginPath(); ctx.arc(0, 0, r * 0.06, 0, TAU); ctx.fill();
  // glass glint
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.14, -0.7, 0, TAU); ctx.fill();
  ctx.restore();
}

export function towel(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#c9d3e3'; ctx.fillRect(-110, -10, 220, 14);
  drawMesh(ctx, cached('towel', () => blob([[-90, 0], [90, 0], [96, 120], [80, 260], [-84, 250], [-96, 120]], { rings: [0.6], bulge: 0.4, seed: 91 })), { c: hex('#e86f8f'), kd: 0.8, jit: 0.07 });
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-88, 200, 172, 14);
  ctx.restore();
}

export function plant(ctx, x, y, s = 1, t = 0) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  for (let i = 0; i < 7; i++) {
    const a = -1.1 + i * 0.37 + Math.sin(t * 1.3 + i) * 0.03;
    ctx.save(); ctx.translate(0, -60); ctx.rotate(a);
    drawMesh(ctx, cached('leaf' + (i % 3), () => blob([[0, 0], [-22, -60], [0, -150 - (i % 3) * 20], [22, -60]], { rings: [0.5], bulge: 0.4, seed: 92 + (i % 3) })), { c: hex(i % 2 ? '#3f9a5b' : '#2f7d48'), kd: 0.8 });
    ctx.restore();
  }
  drawMesh(ctx, cached('pot', () => blob([[-50, -80], [50, -80], [40, 0], [-40, 0]], { rings: [0.5], bulge: 0.4, seed: 95 })), { c: hex('#d07a4a'), kd: 0.8 });
  ctx.restore();
}

export function tpRoll(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#9fb0c8'; ctx.fillRect(-60, -6, 120, 12);
  drawMesh(ctx, cached('tp', () => slab(-46, 6, 92, 80, { bevel: 14, seed: 96, cols: 2, rows: 1, chamfer: 12 })), { c: hex('#f7f7f2'), kd: 0.6 });
  ctx.fillStyle = '#f7f7f2'; ctx.fillRect(-30, 80, 60, 70);
  ctx.restore();
}

// ----------------------------------------------------------------- the stream
/** pts: bezier [p0,p1,p2,p3]; t: time; o: {w0, w1, alpha, reveal(0..1), from(0..1)} */
export function stream(ctx, P, t, o = {}) {
  const w0 = o.w0 ?? 26, w1 = o.w1 ?? 18, rev = o.reveal ?? 1, from = o.from ?? 0;
  if (rev <= from + 0.001) return null;
  const all = bezierPts(P[0], P[1], P[2], P[3], 48);
  const i0 = Math.floor(from * 48), i1 = Math.max(i0 + 2, Math.ceil(rev * 48));
  const pts = all.slice(i0, i1 + 1);
  const n = pts.length;
  const wob = o.wob ?? 1;
  // per-point widths with flowing bulges
  const widths = pts.map((_, i) => {
    const u = (i0 + i) / 48;
    return lerp(w0, w1, u) * (1 + 0.12 * Math.sin(u * 28 - t * 22) * wob) * (i === n - 1 && rev < 1 ? 0.8 : 1);
  });
  const L = [], C1 = [], C2 = [], Rr = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = widths[i] / 2;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]);
    C1.push([pts[i][0] - dy * w * 0.25, pts[i][1] + dx * w * 0.25]);
    C2.push([pts[i][0] + dy * w * 0.45, pts[i][1] - dx * w * 0.45]);
    Rr.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  ctx.save();
  ctx.globalAlpha *= o.alpha ?? 1;
  // glow
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= 0.22;
  ctx.strokeStyle = rgb([255, 200, 60]); ctx.lineWidth = w0 * 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
  ctx.restore();
  const strip = (A, B, col) => { ctx.beginPath(); ctx.moveTo(A[0][0], A[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(A[i][0], A[i][1]); for (let i = n - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke(); };
  strip(L, C1, rgb(BC.peeLt));
  strip(C1, C2, rgb(BC.pee));
  strip(C2, Rr, rgb(BC.peeDk));
  // flowing glints
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let k = 0; k < 9; k++) {
    const u = ((k / 9 + t * (o.speed ?? 1.6)) % 1);
    const idx = Math.floor(u * (n - 3));
    if (idx < 1 || idx >= n - 2) continue;
    const p = C1[idx], q = C1[idx + 2];
    ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(Math.atan2(q[1] - p[1], q[0] - p[0]));
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 2.6, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  return { end: pts[n - 1], start: pts[0], pts, all };
}

export function splashDrops(ctx, x, y, t, o = {}) {
  const n = o.n || 14, sc = o.s || 1, R = rng(o.seed || 9);
  for (let i = 0; i < n; i++) {
    const per = 0.45 + R() * 0.3, ph = (t / per + R()) % 1;
    const ang = -Math.PI / 2 + (R() - 0.5) * 2.2;
    const sp = (160 + R() * 220) * sc;
    const px = x + Math.cos(ang) * sp * ph, py = y + Math.sin(ang) * sp * ph + 520 * sc * ph * ph;
    const r = (4 + R() * 6) * sc * (1 - ph * 0.5);
    ctx.fillStyle = rgb(i % 3 ? BC.pee : BC.peeLt, 1 - ph * 0.7);
    ctx.beginPath(); ctx.arc(px, py, r, 0, TAU); ctx.fill();
    if (o.sparkle && i % 3 === 0) {
      ctx.fillStyle = `rgba(255,255,255,${(1 - ph) * 0.9})`;
      ctx.beginPath(); ctx.moveTo(px, py - r * 2.2); ctx.lineTo(px + r * 0.5, py); ctx.lineTo(px, py + r * 2.2); ctx.lineTo(px - r * 0.5, py); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px - r * 2.2, py); ctx.lineTo(px, py + r * 0.5); ctx.lineTo(px + r * 2.2, py); ctx.lineTo(px, py - r * 0.5); ctx.closePath(); ctx.fill();
    }
  }
}

/** Full bathroom wide set (world coords ~ 1080 x 1920 frame). */
export function bathroomSet(ctx, t, o = {}) {
  // upper wall
  const wg = ctx.createLinearGradient(0, -400, 0, 760);
  wg.addColorStop(0, rgb(mixc(BC.wallUp, [0, 0, 0], 0.35))); wg.addColorStop(1, rgb(BC.wallUp));
  ctx.fillStyle = wg; ctx.fillRect(-600, -600, 2400, 1400);
  drawMesh(ctx, cached('bath:upper', () => panel(-600, -600, 2400, 1380, { cols: 10, rows: 8, seed: 101, wob: 0.25 })), { c: BC.wallUp, kd: 0.55, jit: 0.04, alpha: 0.85 });
  windowMoon(ctx, 90, 120, 330, 420, t);
  // tiled lower wall
  tileWall(ctx, -600, 760, 2400, 500, 100, 7);
  ctx.fillStyle = rgb(hex('#c8d8ee')); ctx.fillRect(-600, 748, 2400, 18);
  // floor
  ctx.fillStyle = rgb(mixc(BC.floorB, [0, 0, 0], 0.3)); ctx.fillRect(-600, 1250, 2400, 1600);
  floorPersp(ctx, 540, 1250, 2500, -300, 1380, { rows: 8, cols: 12, spread: 2.6 });
  ctx.fillStyle = 'rgba(10,20,40,0.35)'; ctx.fillRect(-600, 1244, 2400, 14);
  towel(ctx, 960, 640, 0.9);
  tpRoll(ctx, 900, 980, 0.8);
  plant(ctx, 120, 1250, 0.9, t);
  // moon beam from window
  moonBeam(ctx, [[110, 160], [420, 120], [900, 1900], [200, 2000]], 0.12);
}

/** Toilet in side profile, bowl pointing left. origin = pedestal floor contact. rim opening ~(-200..40, -300). */
export function toiletSide(ctx, x, y, s = 1, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (o.flip ? -1 : 1), s);
  if (o.shadow !== false) softShadow(ctx, -40, 0, 210, 30, 0.5);
  const m = { c: BC.porcelain, kd: 0.62, amb: 1.05, spec: 0.6, shin: 40, jit: 0.035 };
  drawMesh(ctx, cached('ts:tank', () => slab(40, -600, 140, 260, { bevel: 18, seed: 171, cols: 2, rows: 3, chamfer: 16 })), m);
  drawMesh(ctx, cached('ts:tlid', () => slab(28, -626, 166, 34, { bevel: 9, seed: 172, cols: 2, rows: 1, chamfer: 10 })), m);
  ctx.fillStyle = rgb(mixc(BC.porcelain, [140, 160, 190], 0.45)); ctx.fillRect(176, -560, 14, 30);
  // raised lid leaning on tank
  drawMesh(ctx, cached('ts:lid', () => blob([[10, -560], [40, -570], [46, -300], [18, -296]], { rings: [0.5], bulge: 0.35, seed: 173 })), { ...m, c: mixc(BC.porcelain, [200, 215, 240], 0.3) });
  drawMesh(ctx, cached('ts:ped', () => blob([[-70, -170], [60, -170], [70, -60], [90, 0], [-90, 0], [-74, -60]], { rings: [0.6], bulge: 0.5, seed: 174 })), m);
  drawMesh(ctx, cached('ts:bowl', () => blob([[-214, -300], [-120, -306], [0, -306], [60, -300], [66, -250], [40, -190], [-30, -150], [-110, -150], [-180, -190], [-216, -246]], { rings: [0.7, 0.36], bulge: 0.55, seed: 175, apex: [-0.1, -0.35] })), m);
  // seat (top edge)
  drawMesh(ctx, cached('ts:seat', () => slab(-226, -326, 292, 30, { bevel: 9, seed: 176, cols: 3, rows: 1, chamfer: 12 })), { ...m, c: mixc(BC.porcelain, [205, 220, 245], 0.35) });
  // dark opening hint
  ctx.fillStyle = 'rgba(30,60,100,0.55)'; ctx.beginPath(); ctx.ellipse(-82, -327, 120, 6, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

/** floor puddle with ripples */
export function puddle(ctx, x, y, rx, ry, t, a = 1) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.fillStyle = rgb(BC.peeDk, 0.75); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = rgb(BC.pee, 0.9); ctx.beginPath(); ctx.ellipse(x - rx * 0.05, y - ry * 0.12, rx * 0.86, ry * 0.7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,230,0.6)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.35, y - ry * 0.3, rx * 0.25, ry * 0.18, 0, 0, TAU); ctx.fill();
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.4 + i / 3) % 1;
    ctx.strokeStyle = `rgba(255,250,210,${0.7 * (1 - ph)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, rx * 0.15 + ph * rx * 0.8, ry * 0.15 + ph * ry * 0.8, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
