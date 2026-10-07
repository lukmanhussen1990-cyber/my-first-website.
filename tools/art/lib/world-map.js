/*
 * world-map — procedural aerial city map for Border Trials (map-city.webp).
 *
 * Oblique aerial projection: a point (x, y, z) on the design plane (1800×2400,
 * y pointing south) lands on screen at (x + z·KX, y − z·KY). The camera sits
 * south-west, so south and west facades are visible. Moon/ambient light comes
 * from the south-east and shadows fall toward the north-west.
 *
 * Landmark positions (percent of the image) are contractual — zone pins in the
 * app are placed on them (see src/data/zones.ts).
 */
import {
  rand, layer, clamp, lerp, smooth, rgba, mix, shade, TAU, sampleSpline, distToPolyline,
  distToSegment, inPoly, light, noiseLayer, bloom, blurred, gradePixels, rainLit, noiseField, particles,
} from './world-kit.js';

const KX = 0.11, KY = 0.48; // roof displacement per unit of height
const SX = -0.6, SY = -0.48; // shadow displacement per unit of height (light from the SE)
const LX = 0.55, LY = 0.835; // ground direction toward the light
const P = (x, y, z = 0) => [x + z * KX, y - z * KY];
const SPIRE_TIERS = [[0, 112, 50, 46], [112, 200, 42, 38], [200, 268, 35, 30], [268, 318, 27, 22], [318, 350, 19, 14], [350, 366, 11, 8]];
const SPIRE_TOP = 366, SPIRE_NEEDLE = 462;
const depthOf = (x, y) => x * KX - y * KY;

const C = {
  asphalt: [19, 21, 23], walk: [31, 33, 35], lot: [23, 24, 26], grass: [16, 21, 18],
  water: [8, 12, 15], sea: [6, 10, 13], plaza: [35, 36, 38],
  red: [255, 36, 48], amber: [255, 148, 60], cold: [170, 205, 255], white: [236, 228, 214], teal: [150, 230, 225],
};

/* ------------------------------------------------------------------ helpers */
function area(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
const cw = (poly) => (area(poly) >= 0 ? poly : poly.slice().reverse());
const rectPoly = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
function rotRect(cx, cy, len, wid, ux, uy) {
  const vx = -uy, vy = ux, a = len / 2, b = wid / 2;
  return cw([
    [cx - ux * a - vx * b, cy - uy * a - vy * b],
    [cx + ux * a - vx * b, cy + uy * a - vy * b],
    [cx + ux * a + vx * b, cy + uy * a + vy * b],
    [cx - ux * a + vx * b, cy - uy * a + vy * b],
  ]);
}
function ellPoly(cx, cy, rx, ry, n = 32, rot = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + rot;
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
function path(ctx, poly, z = 0, dx = 0, dy = 0) {
  ctx.beginPath();
  for (let i = 0; i < poly.length; i++) {
    const X = poly[i][0] + z * KX + dx, Y = poly[i][1] - z * KY + dy;
    if (i) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
  }
  ctx.closePath();
}
function bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}
function ribbon(line, w) {
  const L = [], R = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[Math.max(0, i - 1)], q = line[Math.min(line.length - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const ww = (typeof w === 'function' ? w(line[i]) : w) / 2;
    L.push([line[i][0] - dy * ww, line[i][1] + dx * ww]);
    R.push([line[i][0] + dy * ww, line[i][1] - dx * ww]);
  }
  return [...L, ...R.reverse()];
}
function offsetLine(line, off) {
  return line.map((pt, i) => {
    const p = line[Math.max(0, i - 1)], q = line[Math.min(line.length - 1, i + 1)];
    let dx = q[0] - p[0], dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    return [pt[0] - dy * off, pt[1] + dx * off];
  });
}
function strokeLine(ctx, line, z = 0) {
  ctx.beginPath();
  line.forEach(([x, y], i) => (i ? ctx.lineTo(x + z * KX, y - z * KY) : ctx.moveTo(x + z * KX, y - z * KY)));
}
function lineLength(line) {
  let L = 0;
  for (let i = 1; i < line.length; i++) L += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
  return L;
}
/** Walk a polyline at a fixed spacing → [{x,y,dx,dy}] */
function walk(line, step, start = 0) {
  const out = [];
  let acc = start;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1], [bx, by] = line[i];
    const L = Math.hypot(bx - ax, by - ay);
    if (L === 0) continue;
    while (acc <= L) {
      const t = acc / L;
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, dx: (bx - ax) / L, dy: (by - ay) / L });
      acc += step;
    }
    acc -= L;
  }
  return out;
}

/* ================================================================== paint */
export function paintMap(ctx, W, H) {
  const R = rand(4242);
  const E = layer(W, H); // emissive (bloom source)
  const e = E.ctx;
  const SH = layer(W, H); // cast shadows
  const sh = SH.ctx;
  sh.fillStyle = '#000';
  sh.strokeStyle = '#000';
  const AO = layer(W, H); // contact darkening
  const ao = AO.ctx;
  ao.fillStyle = '#000';
  const district = noiseField(W, H, { seed: 77, scale: 0.0024, octaves: 3 });
  // tileable-ish grime texture for roofs: stains, streaks and speckle
  const grimePat = (() => {
    const G = layer(512, 512);
    const stains = noiseLayer(512, 512, { seed: 5, scale: 0.035, octaves: 5, step: 1, lo: 0.45, hi: 0.8, color: [0, 0, 0], alpha: 0.55 });
    const light2 = noiseLayer(512, 512, { seed: 6, scale: 0.05, octaves: 4, step: 1, lo: 0.6, hi: 0.9, color: [150, 160, 165], alpha: 0.12 });
    G.ctx.drawImage(stains, 0, 0);
    G.ctx.drawImage(light2, 0, 0);
    const rr = rand(7);
    for (let i = 0; i < 2600; i++) {
      const v = rr() < 0.5 ? 0 : 200;
      G.ctx.fillStyle = `rgba(${v},${v},${v},${0.05 + rr() * 0.12})`;
      G.ctx.fillRect(rr() * 512, rr() * 512, 1 + rr() * 1.5, 1 + rr() * 1.5);
    }
    for (let i = 0; i < 60; i++) {
      G.ctx.strokeStyle = `rgba(0,0,0,${0.08 + rr() * 0.12})`;
      G.ctx.lineWidth = 1 + rr() * 3;
      const x = rr() * 512, y = rr() * 512;
      G.ctx.beginPath(); G.ctx.moveTo(x, y); G.ctx.lineTo(x + (rr() - 0.5) * 30, y + 10 + rr() * 40); G.ctx.stroke();
    }
    return ctx.createPattern(G.c, 'repeat');
  })();

  /* ---------------------------------------------------------------- layout */
  const CX = 872, CY = 1440; // Crimson Crossing (heart of the city)
  const SPIRE = { x: 852, y: 262 };
  const ARENA = { x: 1090, y: 468, rx: 160, ry: 124 };
  const ROOFTOP = { x0: 600, y0: 788, x1: 716, y1: 878, h: 236 };
  const VAULT = { x: 252, y: 800 };
  const WHEEL = { x: 1318, y: 1064, R: 116 };
  const HOSP = { x: 1467, y: 1428 };
  const METRO = { x: 396, y: 1872 };
  const SIGNAL = { x: 1560, y: 566 };
  const IC = { x: 1260, y: 1728 }; // interchange
  // zone pin anchors (percent of the image → px) — keep them readable
  const PINS = [[47, 8], [60, 19], [38, 30], [87, 22], [14, 33], [74, 41], [27, 50], [82, 58], [50, 60], [70, 72], [22, 78]].map(([a, b]) => [a * 18, b * 24]);

  const coast = sampleSpline([[1120, -80], [1165, 60], [1235, 170], [1325, 250], [1420, 300], [1505, 334], [1596, 372], [1682, 420], [1742, 478], [1758, 540], [1720, 602], [1644, 642], [1576, 670], [1534, 712], [1524, 768], [1562, 808], [1640, 830], [1730, 845], [1880, 856]], 10);
  const seaPoly = [...coast, [1880, -80]];
  const river = sampleSpline([[-90, 1034], [150, 1010], [330, 977], [480, 966], [620, 990], [760, 1048], [900, 1072], [1030, 1040], [1130, 972], [1240, 884], [1350, 818], [1450, 778], [1540, 762], [1660, 750]], 14);
  const riverHW = (x) => 38 + smooth(1250, 1560, x) * 24;
  const diagA = [[-90, CY + (CX + 90) * 0.915], [1186, CY - (1186 - CX) * 0.915]];
  const diagB = [[-90, CY - (CX + 90) * 1.039], [CX, CY]];
  const H1 = sampleSpline([[1890, 1744], [1560, 1736], [1260, 1728], [1010, 1732], [870, 1772], [770, 1858], [708, 2010], [672, 2200], [664, 2490]], 12);
  const H2 = sampleSpline([[1262, 1594], [1260, 1728], [1258, 1900], [1263, 2150], [1270, 2490]], 12);
  const loops = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => ({ x: IC.x + sx * 92, y: IC.y + sy * 92, r: 56 }));
  const parkW = rectPoly(26, 1496, 300, 1766);
  const fair = [[1165, 962], [1240, 926], [1320, 906], [1420, 872], [1500, 852], [1546, 882], [1552, 1010], [1536, 1142], [1380, 1160], [1200, 1166], [1160, 1080]];
  const hospital = rectPoly(1326, 1256, 1648, 1568);
  const metroPlaza = rectPoly(262, 1774, 534, 1974);
  const rail = { y0: 1990, y1: 2054, x1: 640 };
  const yard = rectPoly(1568, 872, 1800, 1012);
  const arenaLot = rectPoly(906, 318, 1286, 618);
  // shopping arcades follow diagonal B
  const bdx = 0.6935, bdy = 0.7205, bnx = -0.7205, bny = 0.6935; // along / perpendicular (SW)
  const B0 = diagB[0];
  const AP = (along, perp) => [B0[0] + bdx * along + bnx * perp, B0[1] + bdy * along + bny * perp];
  const shopPoly = [AP(760, 30), AP(1105, 30), AP(1105, 204), AP(760, 204)];

  function inSpecial(x, y, m = 0) {
    if (inPoly(x, y, seaPoly)) return true;
    if (distToPolyline(x, y, coast).d < 24 + m) return true;
    if (distToPolyline(x, y, river).d < riverHW(x) + 12 + m) return true;
    if (Math.hypot(x - SPIRE.x, y - SPIRE.y) < 120 + m) return true;
    if (x > arenaLot[0][0] - m && x < arenaLot[1][0] + m && y > arenaLot[0][1] - m && y < arenaLot[2][1] + m) return true;
    if (Math.hypot(x - VAULT.x, y - VAULT.y) < 150 + m) return true;
    if (distToSegment(x, y, 210, 742, 20, 578) < 46 + m) return true;
    if (inPoly(x, y, fair) || inPoly(x, y, hospital) || inPoly(x, y, metroPlaza) || inPoly(x, y, yard) || inPoly(x, y, shopPoly)) return true;
    if (x > 22 - m && x < 304 + m && y > 1492 - m && y < 1770 + m) return true;
    if (y > rail.y0 - 6 - m && y < rail.y1 + 6 + m && x < rail.x1 + 30) return true;
    if (Math.hypot(x - IC.x, y - IC.y) < 182 + m) return true;
    if (distToPolyline(x, y, H1).d < 46 + m) return true;
    if (distToPolyline(x, y, H2).d < 46 + m) return true;
    if (x > 1452 && y < 730) return true; // headland / signal station
    if (x > ROOFTOP.x0 - 8 - m && x < ROOFTOP.x1 + 8 + m && y > ROOFTOP.y0 - 8 - m && y < ROOFTOP.y1 + 8 + m) return true;
    return false;
  }
  function blocked(x, y, m = 0) {
    if (inSpecial(x, y, m)) return true;
    if (distToSegment(x, y, ...diagA[0], ...diagA[1]) < 30 + m) return true;
    if (distToSegment(x, y, ...diagB[0], ...diagB[1]) < 28 + m) return true;
    if (Math.abs(x - CX) < 140 && Math.abs(y - CY) < 130) return true;
    return false;
  }

  /* street grid */
  const xs = [CX], ys = [CY];
  for (let x = CX; x > -120;) { x -= R.range(148, 200); xs.unshift(x); }
  for (let x = CX; x < 1920;) { x += R.range(148, 200); xs.push(x); }
  for (let y = CY; y > -120;) { y -= R.range(122, 168); ys.unshift(y); }
  for (let y = CY; y < 2520;) { y += R.range(122, 168); ys.push(y); }
  const wx = xs.map((x) => (x === CX ? 62 : R.chance(0.25) ? 36 : R.range(22, 28)));
  const wy = ys.map((y) => (y === CY ? 62 : R.chance(0.25) ? 34 : R.range(22, 28)));

  /* ================================================================ GROUND */
  ctx.fillStyle = rgba(C.asphalt);
  ctx.fillRect(0, 0, W, H);

  const lots = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + wx[i] / 2, x1 = xs[i + 1] - wx[i + 1] / 2;
      const y0 = ys[j] + wy[j] / 2, y1 = ys[j + 1] - wy[j + 1] / 2;
      // sidewalk + curb
      ctx.fillStyle = rgba(C.walk);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.strokeStyle = 'rgba(70,74,78,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      const s = 5;
      ctx.fillStyle = rgba(C.lot);
      ctx.fillRect(x0 + s, y0 + s, x1 - x0 - 2 * s, y1 - y0 - 2 * s);
      subdivide(x0 + s, y0 + s, x1 - s, y1 - s, 0);
    }
  }
  function subdivide(x0, y0, x1, y1, depth) {
    const w = x1 - x0, h = y1 - y0;
    if (w < 14 || h < 14) return;
    const samples = [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, (y0 + y1) / 2], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1], [x0, (y0 + y1) / 2], [x1, (y0 + y1) / 2]];
    const hit = samples.some(([x, y]) => blocked(x, y, 2));
    if (hit) {
      if (w > 34 && h > 34 && depth < 3) {
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, g = 2;
        subdivide(x0, y0, mx - g, my - g, depth + 1);
        subdivide(mx + g, y0, x1, my - g, depth + 1);
        subdivide(x0, my + g, mx - g, y1, depth + 1);
        subdivide(mx + g, my + g, x1, y1, depth + 1);
      }
      return;
    }
    if (depth === 0) {
      const cols = w > 120 ? R.int(1, 3) : w > 70 ? R.int(1, 2) : 1;
      const rows = h > 110 ? R.int(1, 3) : h > 70 ? R.int(1, 2) : 1;
      const gap = R.range(4, 7);
      // irregular splits
      const cx = [x0], cy = [y0];
      for (let c = 1; c < cols; c++) cx.push(lerp(x0, x1, (c + R.range(-0.2, 0.2)) / cols));
      cx.push(x1);
      for (let r = 1; r < rows; r++) cy.push(lerp(y0, y1, (r + R.range(-0.2, 0.2)) / rows));
      cy.push(y1);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          lots.push([cx[c] + (c ? gap / 2 : 0), cy[r] + (r ? gap / 2 : 0), cx[c + 1] - (c < cols - 1 ? gap / 2 : 0), cy[r + 1] - (r < rows - 1 ? gap / 2 : 0)]);
        }
      }
    } else lots.push([x0, y0, x1, y1]);
  }

  // asphalt texture + patching over everything at ground level
  {
    const n1 = noiseLayer(W, H, { seed: 3, scale: 0.02, octaves: 4, step: 2, lo: 0.35, hi: 0.85, color: [0, 0, 0], alpha: 0.32 });
    ctx.drawImage(n1, 0, 0);
    const n2 = noiseLayer(W, H, { seed: 4, scale: 0.05, octaves: 3, step: 2, lo: 0.55, hi: 0.95, color: [120, 126, 130], alpha: 0.07 });
    ctx.drawImage(n2, 0, 0);
  }

  // diagonal avenues
  function avenue(a, b, w) {
    const line = [a, b];
    ctx.fillStyle = rgba(C.walk);
    path(ctx, ribbon(line, w + 12));
    ctx.fill();
    ctx.fillStyle = rgba(C.asphalt);
    path(ctx, ribbon(line, w));
    ctx.fill();
    ctx.strokeStyle = 'rgba(70,74,78,0.35)';
    ctx.lineWidth = 1;
    strokeLine(ctx, offsetLine(line, w / 2 + 6));
    ctx.stroke();
    strokeLine(ctx, offsetLine(line, -w / 2 - 6));
    ctx.stroke();
  }
  avenue(diagA[0], diagA[1], 48);
  avenue(diagB[0], diagB[1], 44);
  // boulevard median trees + markings later

  /* ---------------------------------------------------- special ground areas */
  const ground = (poly, col) => {
    ctx.fillStyle = rgba(col);
    path(ctx, poly);
    ctx.fill();
  };
  // arena car park
  {
    const [a, , c] = [arenaLot[0], 0, arenaLot[2]];
    ctx.fillStyle = 'rgb(24,25,27)';
    ctx.fillRect(a[0], a[1], c[0] - a[0], c[1] - a[1]);
    ctx.strokeStyle = 'rgba(150,150,150,0.13)';
    ctx.lineWidth = 1;
    for (let y = a[1] + 12; y < c[1] - 8; y += 22) {
      for (let x = a[0] + 8; x < c[0] - 8; x += 9) {
        const dx = (x - ARENA.x) / (ARENA.rx + 22), dy = (y - ARENA.y) / (ARENA.ry + 22);
        if (dx * dx + dy * dy < 1) continue;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke();
      }
    }
    // concourse ring
    ctx.fillStyle = 'rgb(36,37,39)';
    ctx.beginPath(); ctx.ellipse(ARENA.x, ARENA.y, ARENA.rx + 22, ARENA.ry + 20, 0, 0, TAU); ctx.fill();
  }
  // spire plaza
  {
    const { x, y } = SPIRE;
    ctx.fillStyle = rgba(C.walk);
    ctx.beginPath(); ctx.arc(x, y, 118, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x, y, 20, x, y, 112);
    g.addColorStop(0, 'rgb(46,47,50)');
    g.addColorStop(1, 'rgb(30,31,33)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 112, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(10,10,12,0.55)';
    for (let r = 60; r <= 110; r += 14) { ctx.lineWidth = r % 28 === 4 ? 2 : 1; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    // radiating lines (sundial)
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      ctx.lineWidth = i % 4 === 0 ? 2 : 0.8;
      ctx.strokeStyle = i % 4 === 0 ? 'rgba(8,8,10,0.6)' : 'rgba(12,12,14,0.4)';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * 56, y + Math.sin(a) * 56);
      ctx.lineTo(x + Math.cos(a) * 110, y + Math.sin(a) * 110);
      ctx.stroke();
    }
    // red inlay ring
    ctx.strokeStyle = 'rgba(160,20,28,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 72, 0, TAU); ctx.stroke();
    e.strokeStyle = 'rgba(255,30,40,0.35)';
    e.lineWidth = 2;
    e.beginPath(); e.arc(x, y, 72, 0, TAU); e.stroke();
  }
  // metro plaza paving: tiles, a glass oculus over the station hall, planters
  {
    ground(metroPlaza, [36, 37, 39]);
    const rr = rand(1717);
    for (let x = 262; x < 534; x += 12) {
      for (let y = 1774; y < 1974; y += 12) {
        const v = rr();
        if (v < 0.3) { ctx.fillStyle = `rgba(0,0,0,${0.08 + rr() * 0.12})`; ctx.fillRect(x, y, 12, 12); }
        else if (v > 0.93) { ctx.fillStyle = 'rgba(160,170,175,0.05)'; ctx.fillRect(x, y, 12, 12); }
      }
    }
    ctx.strokeStyle = 'rgba(10,10,12,0.5)';
    ctx.lineWidth = 1;
    for (let x = 262; x <= 534; x += 12) { ctx.beginPath(); ctx.moveTo(x, 1774); ctx.lineTo(x, 1974); ctx.stroke(); }
    for (let y = 1774; y <= 1974; y += 12) { ctx.beginPath(); ctx.moveTo(262, y); ctx.lineTo(534, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(120,124,128,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(263, 1775, 270, 198);
    // oculus: glass grid with the station hall glowing below
    const { x, y } = METRO;
    ctx.fillStyle = 'rgb(54,56,58)';
    ctx.beginPath(); ctx.arc(x, y, 50, 0, TAU); ctx.fill();
    const og = ctx.createRadialGradient(x - 6, y + 6, 4, x, y, 44);
    og.addColorStop(0, 'rgb(120,40,36)');
    og.addColorStop(0.6, 'rgb(48,22,22)');
    og.addColorStop(1, 'rgb(14,12,13)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(x, y, 44, 0, TAU); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 44, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(10,10,12,0.8)';
    ctx.lineWidth = 1.2;
    for (let k = -44; k <= 44; k += 7) {
      ctx.beginPath(); ctx.moveTo(x + k, y - 44); ctx.lineTo(x + k, y + 44); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 44, y + k); ctx.lineTo(x + 44, y + k); ctx.stroke();
    }
    for (let k = 0; k < 14; k++) {
      ctx.fillStyle = 'rgba(3,3,4,0.9)';
      ctx.fillRect(x - 42 + Math.floor(rr() * 12) * 7, y - 42 + Math.floor(rr() * 12) * 7, 6, 6);
    }
    ctx.restore();
    e.fillStyle = 'rgba(255,60,50,0.22)';
    e.beginPath(); e.arc(x, y, 40, 0, TAU); e.fill();
    ctx.strokeStyle = 'rgba(190,30,36,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 52, 0, TAU); ctx.stroke();
    // planters with trees and benches
    for (const [px, py] of [[290, 1800], [506, 1800], [290, 1948], [506, 1948], [330, 1874], [462, 1874]]) {
      ctx.fillStyle = 'rgb(48,48,50)';
      ctx.fillRect(px - 9, py - 9, 18, 18);
      ctx.fillStyle = 'rgb(18,22,19)';
      ctx.fillRect(px - 7, py - 7, 14, 14);
    }
    ctx.fillStyle = 'rgba(70,64,58,0.9)';
    for (let k = 0; k < 10; k++) ctx.fillRect(300 + k * 22, 1840 + (k % 2) * 70, 9, 2.5);
  }
  // rail corridor
  {
    const { y0, y1, x1 } = rail;
    ctx.fillStyle = 'rgb(26,24,23)';
    ctx.fillRect(-10, y0 - 6, x1 + 10, y1 - y0 + 12);
    ctx.drawImage(noiseLayer(x1 + 20, 90, { seed: 12, scale: 0.25, octaves: 2, step: 1, lo: 0.3, hi: 0.9, color: [70, 62, 56], alpha: 0.35 }), -10, y0 - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-10, y0 - 6, x1 + 10, 3);
    ctx.fillRect(-10, y1 + 3, x1 + 10, 3);
    for (const ty of [y0 + 10, y0 + 32, y0 + 54]) {
      ctx.fillStyle = 'rgba(48,40,34,0.9)';
      for (let x = -6; x < x1; x += 5) ctx.fillRect(x, ty - 5, 2.4, 10);
      ctx.fillStyle = 'rgba(150,152,155,0.55)';
      ctx.fillRect(-10, ty - 3, x1 + 10, 1);
      ctx.fillRect(-10, ty + 2, x1 + 10, 1);
    }
    // tunnel portal
    ctx.fillStyle = 'rgb(44,44,46)';
    ctx.fillRect(x1 - 4, y0 - 14, 20, y1 - y0 + 28);
    ctx.fillStyle = '#020203';
    ctx.fillRect(x1 + 2, y0 - 6, 30, y1 - y0 + 12);
    for (const ty of [y0 + 10, y0 + 54]) {
      ctx.fillStyle = rgba(C.red);
      ctx.fillRect(x1 - 8, ty - 1, 3, 3);
      e.fillStyle = rgba(C.red);
      e.fillRect(x1 - 8, ty - 1, 3, 3);
    }
  }
  // west park
  {
    ground(parkW, [17, 22, 19]);
    ctx.save();
    path(ctx, parkW);
    ctx.clip();
    ctx.drawImage(noiseLayer(W, H, { seed: 31, scale: 0.03, octaves: 4, step: 3, lo: 0.3, hi: 0.9, color: [30, 40, 32], alpha: 0.5, mask: (x, y) => (x < 320 && y > 1480 && y < 1780 ? 1 : 0) }), 0, 0);
    // paths
    ctx.strokeStyle = 'rgba(58,60,58,0.7)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(20, 1560); ctx.bezierCurveTo(120, 1580, 150, 1660, 300, 1700); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(160, 1490); ctx.bezierCurveTo(140, 1580, 210, 1640, 190, 1770); ctx.stroke();
    // pond
    ctx.fillStyle = 'rgb(9,13,16)';
    ctx.beginPath(); ctx.ellipse(96, 1690, 52, 30, -0.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(80,90,95,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  // fairground ground
  {
    ground(fair, [20, 23, 22]);
    ctx.save();
    path(ctx, fair);
    ctx.clip();
    ctx.drawImage(noiseLayer(W, H, { seed: 41, scale: 0.035, octaves: 3, step: 3, lo: 0.4, hi: 0.95, color: [40, 44, 40], alpha: 0.5, mask: (x, y) => (x > 1150 && y > 840 && y < 1180 ? 1 : 0) }), 0, 0);
    ctx.fillStyle = 'rgb(40,41,43)';
    ctx.beginPath(); ctx.ellipse(WHEEL.x, WHEEL.y, 92, 34, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(52,53,55,1)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(1188, 1160); ctx.bezierCurveTo(1230, 1110, 1260, 1090, WHEEL.x - 60, WHEEL.y + 18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(WHEEL.x + 70, WHEEL.y + 10); ctx.bezierCurveTo(1430, 1080, 1460, 1000, 1500, 900); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(1230, 1050); ctx.bezierCurveTo(1220, 1000, 1250, 960, 1300, 930); ctx.stroke();
    ctx.restore();
  }
  // hospital grounds + parking
  {
    ground(hospital, [27, 29, 31]);
    ctx.fillStyle = 'rgb(22,23,25)';
    ctx.fillRect(1334, 1500, 120, 60);
    ctx.fillRect(1560, 1268, 80, 110);
    ctx.strokeStyle = 'rgba(160,165,170,0.16)';
    ctx.lineWidth = 1;
    for (let x = 1338; x < 1452; x += 8) { ctx.beginPath(); ctx.moveTo(x, 1502); ctx.lineTo(x, 1514); ctx.moveTo(x, 1546); ctx.lineTo(x, 1558); ctx.stroke(); }
    for (let y = 1272; y < 1376; y += 8) { ctx.beginPath(); ctx.moveTo(1562, y); ctx.lineTo(1574, y); ctx.moveTo(1626, y); ctx.lineTo(1638, y); ctx.stroke(); }
    // driveway loop
    ctx.strokeStyle = 'rgb(21,22,24)';
    ctx.lineWidth = 14;
    ctx.beginPath(); ctx.ellipse(1470, 1540, 60, 16, 0, 0, TAU); ctx.stroke();
  }
  // shopping district pedestrian plaza
  {
    ground(shopPoly, [33, 33, 35]);
    ctx.save();
    path(ctx, shopPoly);
    ctx.clip();
    ctx.strokeStyle = 'rgba(10,10,12,0.35)';
    ctx.lineWidth = 1;
    for (let a = 760; a < 1110; a += 10) { const p = AP(a, 30), q = AP(a, 204); ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); }
    ctx.restore();
  }
  // container yard
  ground(yard, [28, 28, 29]);
  // headland (rocky ground)
  {
    const head = [[1452, 300], [1505, 334], [1596, 372], [1682, 420], [1742, 478], [1758, 540], [1720, 602], [1644, 642], [1576, 670], [1534, 712], [1452, 730]];
    ground(sampleSpline(head, 6), [27, 27, 26]);
    ctx.save();
    path(ctx, head);
    ctx.clip();
    ctx.drawImage(noiseLayer(W, H, { seed: 51, scale: 0.03, octaves: 5, step: 2, lo: 0.3, hi: 0.9, color: [52, 50, 46], alpha: 0.6, mask: (x, y) => (x > 1440 && y < 740 ? 1 : 0) }), 0, 0);
    ctx.drawImage(noiseLayer(W, H, { seed: 52, scale: 0.012, octaves: 3, step: 3, lo: 0.4, hi: 0.8, color: [16, 20, 16], alpha: 0.6, mask: (x, y) => (x > 1440 && y < 740 ? 1 : 0) }), 0, 0);
    // service road to the station
    ctx.strokeStyle = 'rgb(32,32,32)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(1460, 720); ctx.bezierCurveTo(1500, 660, 1520, 620, SIGNAL.x - 20, SIGNAL.y + 30); ctx.stroke();
    // compound pad + fence
    ctx.fillStyle = 'rgb(36,36,37)';
    ctx.fillRect(SIGNAL.x - 74, SIGNAL.y - 70, 150, 128);
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = 'rgba(150,150,150,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(SIGNAL.x - 80, SIGNAL.y - 76, 162, 140);
    ctx.setLineDash([]);
    ctx.restore();
  }
  // vault crater ground
  {
    const { x, y } = VAULT;
    const g = ctx.createRadialGradient(x, y, 40, x, y, 180);
    g.addColorStop(0, 'rgba(10,9,9,1)');
    g.addColorStop(0.6, 'rgba(24,22,21,0.9)');
    g.addColorStop(1, 'rgba(24,22,21,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 180, 0, TAU); ctx.fill();
  }

  /* --------------------------------------------------------------- river */
  {
    const poly = ribbon(river, (p) => riverHW(p[0]) * 2);
    const bank = ribbon(river, (p) => riverHW(p[0]) * 2 + 18);
    ctx.fillStyle = 'rgb(36,36,37)';
    path(ctx, bank);
    ctx.fill();
    ctx.fillStyle = rgba(C.water);
    path(ctx, poly);
    ctx.fill();
    ctx.save();
    path(ctx, poly);
    ctx.clip();
    // wall shadow on water along the north bank (light from the SE)
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 16;
    strokeLine(ctx, offsetLine(river, -0).map((p, i) => [p[0], p[1] - riverHW(river[i][0])]));
    ctx.stroke();
    // ripples
    ctx.drawImage(noiseLayer(W, H, { seed: 61, scale: 0.06, octaves: 3, step: 2, lo: 0.55, hi: 0.9, color: [90, 110, 120], alpha: 0.12, warp: 30 }), 0, 0);
    ctx.restore();
    // embankment edges
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(120,124,128,0.4)';
    strokeLine(ctx, river.map((p) => [p[0], p[1] - riverHW(p[0])]));
    ctx.stroke();
    strokeLine(ctx, river.map((p) => [p[0], p[1] + riverHW(p[0])]));
    ctx.stroke();
  }

  /* ---------------------------------------------------------------- sea */
  {
    const g = ctx.createLinearGradient(1300, 0, 1800, 700);
    g.addColorStop(0, 'rgb(8,12,15)');
    g.addColorStop(1, 'rgb(5,8,11)');
    ctx.fillStyle = g;
    path(ctx, seaPoly);
    ctx.fill();
    ctx.save();
    path(ctx, seaPoly);
    ctx.clip();
    ctx.drawImage(noiseLayer(W, H, { seed: 71, scale: 0.012, octaves: 5, step: 2, lo: 0.45, hi: 0.85, color: [80, 100, 115], alpha: 0.24, warp: 80 }), 0, 0);
    // wave crests
    const rr = rand(72);
    ctx.lineCap = 'round';
    for (let i = 0; i < 1400; i++) {
      const x = 1100 + rr() * 800, y = rr() * 900;
      if (!inPoly(x, y, seaPoly)) continue;
      const L = 4 + rr() * 14;
      ctx.strokeStyle = `rgba(150,165,175,${0.04 + rr() * 0.1})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + L / 2, y - 1.5, x + L, y + 0.6); ctx.stroke();
    }
    // foam along the coast
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = `rgba(170,180,185,${0.16 - k * 0.045})`;
      ctx.lineWidth = 2 + k * 5;
      ctx.filter = `blur(${1 + k * 2}px)`;
      strokeLine(ctx, offsetLine(coast, -6 - k * 6));
      ctx.stroke();
    }
    ctx.filter = 'none';
    ctx.restore();
    // cliff band on the headland
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgb(44,41,38)';
    ctx.lineWidth = 12;
    const cliff = coast.filter(([x, y]) => x > 1430 && y < 760);
    strokeLine(ctx, offsetLine(cliff, 4));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(110,104,96,0.5)';
    ctx.lineWidth = 2;
    strokeLine(ctx, offsetLine(cliff, 9));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    strokeLine(ctx, offsetLine(cliff, -2));
    ctx.stroke();
    // quay edge elsewhere
    ctx.strokeStyle = 'rgba(120,124,128,0.4)';
    ctx.lineWidth = 2;
    strokeLine(ctx, coast.filter(([x, y]) => !(x > 1430 && y < 760)));
    ctx.stroke();
    // piers + breakwater
    for (const px of [1606, 1690, 1772]) {
      ctx.fillStyle = 'rgb(38,38,39)';
      ctx.fillRect(px - 9, 744, 18, 94);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(px - 15, 744, 6, 94);
      sh.fillRect(px - 9 + SX * 8, 744 + SY * 8, 18, 94);
    }
    ctx.strokeStyle = 'rgb(40,40,40)';
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(1800, 700); ctx.quadraticCurveTo(1700, 690, 1650, 718); ctx.stroke();
    // half-sunken hulk
    ctx.save();
    ctx.translate(1652, 776); ctx.rotate(-0.35);
    ctx.fillStyle = 'rgb(46,30,26)';
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgb(28,22,20)';
    ctx.fillRect(-10, -4, 16, 8);
    ctx.restore();
  }

  /* ------------------------------------------------------------- roads FX */
  // boulevard + avenue lane markings, crosswalks at intersections
  ctx.lineCap = 'butt';
  const dash = (x0, y0, x1, y1, a = 0.16, w = 1.2, d = [10, 12]) => {
    ctx.strokeStyle = `rgba(200,200,190,${a})`;
    ctx.lineWidth = w;
    ctx.setLineDash(d);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
  };
  for (const off of [-14, 14]) dash(CX + off, -40, CX + off, 2480);
  dash(CX - 2, -40, CX - 2, 2480, 0.2, 1, []);
  dash(CX + 2, -40, CX + 2, 2480, 0.2, 1, []);
  for (const off of [-14, 14]) dash(-40, CY + off, 1330, CY + off);
  for (let i = 0; i < xs.length; i++) if (wx[i] > 30 && xs[i] !== CX) dash(xs[i], -40, xs[i], 2480, 0.1);
  for (let j = 0; j < ys.length; j++) if (wy[j] > 30 && ys[j] !== CY) dash(-40, ys[j], 1900, ys[j], 0.1);
  dash(...diagA[0], ...diagA[1], 0.12);
  dash(...diagB[0], ...diagB[1], 0.12);
  // crosswalks
  const zebra = (x, y, ux, uy, len, depth, a = 0.22) => {
    // stripes across a road: u = road direction, stripes spaced along the perpendicular
    const vx = -uy, vy = ux;
    ctx.fillStyle = `rgba(205,205,200,${a})`;
    for (let s = -len / 2; s < len / 2; s += 5.5) {
      const cx = x + vx * s, cy = y + vy * s;
      ctx.beginPath();
      ctx.moveTo(cx - ux * depth / 2, cy - uy * depth / 2);
      ctx.lineTo(cx + ux * depth / 2, cy + uy * depth / 2);
      ctx.lineTo(cx + ux * depth / 2 + vx * 2.8, cy + uy * depth / 2 + vy * 2.8);
      ctx.lineTo(cx - ux * depth / 2 + vx * 2.8, cy - uy * depth / 2 + vy * 2.8);
      ctx.closePath();
      ctx.fill();
    }
  };
  for (let i = 0; i < xs.length; i++) {
    for (let j = 0; j < ys.length; j++) {
      const big = wx[i] > 30 || wy[j] > 30;
      if (!big || R.chance(0.35)) continue;
      const x = xs[i], y = ys[j];
      if (blocked(x, y, 10)) continue;
      zebra(x, y - wy[j] / 2 - 7, 0, 1, wx[i] - 4, 10, 0.14);
      zebra(x, y + wy[j] / 2 + 7, 0, 1, wx[i] - 4, 10, 0.14);
      zebra(x - wx[i] / 2 - 7, y, 1, 0, wy[j] - 4, 10, 0.14);
      zebra(x + wx[i] / 2 + 7, y, 1, 0, wy[j] - 4, 10, 0.14);
    }
  }

  /* ------------------------------------------------- CRIMSON CROSSING (ground) */
  {
    const pr = 112;
    ctx.fillStyle = 'rgb(22,20,21)';
    ctx.beginPath(); ctx.roundRect(CX - pr, CY - pr + 8, pr * 2, pr * 2 - 16, 26); ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,84,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // approach crosswalks
    zebra(CX, CY - pr + 2, 0, 1, 58, 18, 0.34);
    zebra(CX, CY + pr - 2, 0, 1, 58, 18, 0.34);
    zebra(CX - pr - 2, CY, 1, 0, 58, 18, 0.34);
    zebra(CX + pr + 2, CY, 1, 0, 58, 18, 0.34);
    const aU = [0.738, -0.675], bU = [0.694, 0.721];
    zebra(CX - 120, CY + 112, aU[0], aU[1], 46, 16, 0.3);
    zebra(CX + 118, CY - 112, aU[0], aU[1], 46, 16, 0.3);
    zebra(CX - 118, CY - 120, bU[0], bU[1], 42, 16, 0.3);
    // the scramble X
    const s2 = Math.SQRT1_2;
    for (const [ux, uy] of [[s2, s2], [s2, -s2]]) {
      const vx = -uy, vy = ux;
      ctx.fillStyle = 'rgba(210,205,205,0.3)';
      for (let s = -96; s < 96; s += 6) {
        if (Math.abs(s) < 8) continue;
        const cx = CX + ux * s, cy = CY + uy * s;
        ctx.beginPath();
        ctx.moveTo(cx - vx * 14, cy - vy * 14);
        ctx.lineTo(cx + vx * 14, cy + vy * 14);
        ctx.lineTo(cx + vx * 14 + ux * 3, cy + vy * 14 + uy * 3);
        ctx.lineTo(cx - vx * 14 + ux * 3, cy - vy * 14 + uy * 3);
        ctx.closePath();
        ctx.fill();
      }
    }
    // central red ring marking
    ctx.strokeStyle = 'rgba(190,20,30,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CX, CY, 22, 0, TAU); ctx.stroke();
    e.strokeStyle = 'rgba(255,40,50,0.5)';
    e.lineWidth = 3;
    e.beginPath(); e.arc(CX, CY, 22, 0, TAU); e.stroke();
  }

  /* -------------------------------------------------- wet sheen / puddles */
  {
    const wet = noiseLayer(W, H, { seed: 81, scale: 0.012, octaves: 5, step: 2, lo: 0.5, hi: 0.7, color: [120, 140, 152], alpha: 0.1, warp: 60 });
    ctx.drawImage(wet, 0, 0);
    // cracks
    const rr = rand(82);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    for (let i = 0; i < 520; i++) {
      let x = rr() * W, y = rr() * H;
      if (inPoly(x, y, seaPoly)) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      let a = rr() * TAU;
      for (let k = 0; k < 8; k++) {
        a += (rr() - 0.5) * 1.4;
        x += Math.cos(a) * 5;
        y += Math.sin(a) * 5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // manholes
    ctx.fillStyle = 'rgba(8,8,9,0.6)';
    for (let i = 0; i < 180; i++) {
      const x = R.pick(xs) + R.range(-6, 6), y = R.range(0, H);
      if (blocked(x, y)) continue;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill();
    }
  }

  /* ------------------------------------------------- ground clutter: cars, debris */
  const CAR = [[34, 36, 40], [58, 60, 64], [84, 24, 26], [24, 32, 42], [104, 106, 108], [130, 128, 122], [40, 44, 40], [70, 52, 40]];
  function car(x, y, ang, col, lit = false, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.roundRect(-5.2, -10, 10.4, 19, 3); ctx.fill();
    ctx.fillStyle = rgba(col);
    ctx.beginPath(); ctx.roundRect(-3.8, -8.2, 7.6, 16.4, 2.4); ctx.fill();
    ctx.fillStyle = rgba(shade(col, 0.35));
    ctx.fillRect(-3.1, -4.6, 6.2, 2.6);
    ctx.fillRect(-3.1, 3.2, 6.2, 1.8);
    ctx.fillStyle = rgba(mix(col, [200, 205, 210], 0.22));
    ctx.fillRect(-2.9, -2, 5.8, 5);
    if (lit) {
      ctx.fillStyle = rgba(C.red);
      ctx.fillRect(-3.6, 7.4, 1.6, 1);
      ctx.fillRect(2, 7.4, 1.6, 1);
    }
    ctx.restore();
    if (lit) {
      const c = Math.cos(ang), s = Math.sin(ang);
      e.fillStyle = 'rgba(255,40,40,0.9)';
      e.fillRect(x - s * 7.6 * scale - 3, y + c * 7.6 * scale - 1, 6, 2);
    }
  }
  {
    // along grid streets
    for (let i = 0; i < xs.length; i++) {
      for (let y = -20; y < H + 20; y += R.range(14, 70)) {
        const lane = R.pick([-1, 1]) * (wx[i] / 2 - 6 - R.range(0, 4));
        const x = xs[i] + lane;
        if (blocked(x, y, 4) && !(Math.abs(xs[i] - CX) < 2 && !inSpecial(x, y))) continue;
        if (Math.abs(y - CY) < 150 && Math.abs(xs[i] - CX) < 4 && R.chance(0.6)) continue;
        const crash = R.chance(0.12);
        car(x, y, (lane > 0 ? 0 : Math.PI) + (crash ? R.range(-1.2, 1.2) : R.range(-0.05, 0.05)), R.pick(CAR), R.chance(0.05));
      }
    }
    for (let j = 0; j < ys.length; j++) {
      for (let x = -20; x < W + 20; x += R.range(14, 70)) {
        const lane = R.pick([-1, 1]) * (wy[j] / 2 - 6 - R.range(0, 4));
        const y = ys[j] + lane;
        if (blocked(x, y, 4) && !(Math.abs(ys[j] - CY) < 2 && !inSpecial(x, y))) continue;
        if (Math.abs(x - CX) < 150 && Math.abs(y - CY) < 40) continue;
        const crash = R.chance(0.12);
        car(x, y, (lane > 0 ? -Math.PI / 2 : Math.PI / 2) + (crash ? R.range(-1.2, 1.2) : R.range(-0.05, 0.05)), R.pick(CAR), R.chance(0.05));
      }
    }
    for (const [a, b] of [diagA, diagB]) {
      const line = [a, b];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
      for (const p of walk(line, 26)) {
        if (R.chance(0.45)) continue;
        const side = R.pick([-1, 1]) * R.range(6, 16);
        const x = p.x - p.dy * side, y = p.y + p.dx * side;
        if (inSpecial(x, y) || (Math.abs(x - CX) < 120 && Math.abs(y - CY) < 120)) continue;
        car(x, y, ang + (side > 0 ? 0 : Math.PI) + (R.chance(0.15) ? R.range(-1, 1) : 0), R.pick(CAR), R.chance(0.05));
      }
    }
    // arena car park cars
    for (let i = 0; i < 70; i++) {
      const x = R.range(898, 1270), y = R.range(306, 616);
      const dx = (x - ARENA.x) / (ARENA.rx + 28), dy = (y - ARENA.y) / (ARENA.ry + 26);
      if (dx * dx + dy * dy < 1) continue;
      car(x, y, R.chance(0.8) ? R.pick([0, Math.PI]) : R.range(0, TAU), R.pick(CAR));
    }
    // a few abandoned in the crossing
    for (let i = 0; i < 9; i++) {
      const a = R.range(0, TAU), r = R.range(30, 100);
      car(CX + Math.cos(a) * r, CY + Math.sin(a) * r, R.range(0, TAU), R.pick(CAR), R.chance(0.3));
    }
  }
  // debris specks everywhere on the ground
  {
    const rr = rand(91);
    for (let i = 0; i < 2600; i++) {
      const x = rr() * W, y = rr() * H;
      if (inPoly(x, y, seaPoly) || distToPolyline(x, y, river).d < riverHW(x)) continue;
      const s = 0.8 + rr() * 2.6;
      const v = 40 + rr() * 50;
      ctx.fillStyle = `rgba(${v},${v - 4},${v - 8},${0.35 + rr() * 0.4})`;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rr() * TAU);
      ctx.fillRect(-s / 2, -s / 2, s, s * (0.5 + rr()));
      ctx.restore();
    }
  }

  /* ================================================================ OBJECTS */
  const objects = [];
  const WIN = {
    warm: [[C.amber, 5], [C.red, 4], [C.white, 1], [C.cold, 1]],
    red: [[C.red, 6], [C.amber, 2]],
    cold: [[C.cold, 5], [C.white, 3], [C.teal, 2]],
  };
  const pickW = (r, list) => {
    let t = 0;
    for (const [, w] of list) t += w;
    let v = r() * t;
    for (const [c, w] of list) { v -= w; if (v <= 0) return c; }
    return list[0][0];
  };
  const ROOFS = [[40, 43, 46], [34, 37, 40], [46, 47, 49], [30, 32, 34], [44, 38, 35], [34, 41, 40], [50, 50, 50], [28, 29, 31], [38, 36, 40], [48, 42, 38], [32, 38, 42]];

  function addShadow(poly, h, z0 = 0) {
    const n = poly.length;
    const s0x = SX * z0, s0y = SY * z0, s1x = SX * h, s1y = SY * h;
    sh.beginPath();
    for (let i = 0; i < n; i++) {
      const a = poly[i], c = poly[(i + 1) % n];
      sh.moveTo(a[0] + s0x, a[1] + s0y);
      sh.lineTo(c[0] + s0x, c[1] + s0y);
      sh.lineTo(c[0] + s1x, c[1] + s1y);
      sh.lineTo(a[0] + s1x, a[1] + s1y);
      sh.closePath();
      sh.fill();
      sh.beginPath();
    }
    path(sh, poly, 0, s1x, s1y);
    sh.fill();
    path(sh, poly, 0, s0x, s0y);
    sh.fill();
    // contact AO
    path(ao, poly);
    ao.fill();
  }

  function drawFace(b, f, z0, h) {
    const lit = 0.3 + 0.7 * Math.max(0, f.nx * LX + f.ny * LY);
    const base = shade(b.facade, lit);
    const A0 = P(f.a[0], f.a[1], z0), C0 = P(f.c[0], f.c[1], z0), A1 = P(f.a[0], f.a[1], h), C1 = P(f.c[0], f.c[1], h);
    ctx.beginPath();
    ctx.moveTo(...A0); ctx.lineTo(...C0); ctx.lineTo(...C1); ctx.lineTo(...A1);
    ctx.closePath();
    const mx = (f.a[0] + f.c[0]) / 2, my = (f.a[1] + f.c[1]) / 2;
    const g0 = P(mx, my, z0), g1 = P(mx, my, h);
    const g = ctx.createLinearGradient(g0[0], g0[1], g1[0], g1[1]);
    g.addColorStop(0, rgba(shade(base, 0.45)));
    g.addColorStop(Math.min(0.5, 30 / Math.max(1, h - z0)), rgba(shade(base, 0.8)));
    g.addColorStop(1, rgba(base));
    ctx.fillStyle = g;
    ctx.fill();
    if (!b.win || h - z0 < 10) return;
    const r = b.rnd;
    const fh = b.win.floorH;
    const cols = Math.max(1, Math.floor(f.L / b.win.spacing));
    const floors = Math.floor((h - z0 - 3) / fh);
    const ux = (f.c[0] - f.a[0]) / cols, uy = (f.c[1] - f.a[1]) / cols;
    const dark = new Path2D(), glint = new Path2D();
    const litP = new Map();
    const fw = b.win.fill ?? 0.56;
    for (let fl = 0; fl < floors; fl++) {
      const z = z0 + 2.5 + fl * fh, z1 = z + fh * 0.52;
      const rowLit = r() < b.win.rowBias;
      for (let c = 0; c < cols; c++) {
        const t0 = c + (1 - fw) / 2, t1 = c + (1 + fw) / 2;
        const x0 = f.a[0] + ux * t0, y0 = f.a[1] + uy * t0, x1 = f.a[0] + ux * t1, y1 = f.a[1] + uy * t1;
        const q = [P(x0, y0, z), P(x1, y1, z), P(x1, y1, z1), P(x0, y0, z1)];
        let target;
        const pr = b.win.rate * (rowLit ? 4 : 1);
        if (r() < pr) {
          const col = pickW(r, b.win.list);
          if (!litP.has(col)) litP.set(col, new Path2D());
          target = litP.get(col);
        } else target = r() < 0.12 ? glint : dark;
        target.moveTo(...q[0]); target.lineTo(...q[1]); target.lineTo(...q[2]); target.lineTo(...q[3]); target.closePath();
      }
    }
    ctx.fillStyle = rgba(shade(base, 0.5));
    ctx.fill(dark);
    ctx.fillStyle = rgba(mix(base, [120, 135, 150], 0.35));
    ctx.fill(glint);
    for (const [col, p] of litP) {
      ctx.fillStyle = rgba(col, 0.78);
      ctx.fill(p);
      e.fillStyle = rgba(col, b.win.glow ?? 0.7);
      e.fill(p);
    }
    // billboard screens near the crossing
    if (b.billboard && f.ny > 0.5 && f.L > 26 && h - z0 > 40) {
      const t0 = 0.12 + r() * 0.1, t1 = 0.88 - r() * 0.1;
      const za = z0 + (h - z0) * (0.35 + r() * 0.15), zb = za + Math.min(36, (h - z0) * 0.3);
      const pa = [lerp(f.a[0], f.c[0], t0), lerp(f.a[1], f.c[1], t0)], pb = [lerp(f.a[0], f.c[0], t1), lerp(f.a[1], f.c[1], t1)];
      const q = [P(...pa, za), P(...pb, za), P(...pb, zb), P(...pa, zb)];
      for (const c2 of [ctx, e]) {
        c2.beginPath();
        c2.moveTo(...q[0]); c2.lineTo(...q[1]); c2.lineTo(...q[2]); c2.lineTo(...q[3]);
        c2.closePath();
        const gg = c2.createLinearGradient(q[0][0], q[0][1], q[1][0], q[1][1]);
        gg.addColorStop(0, 'rgba(255,30,45,0.95)');
        gg.addColorStop(0.5, 'rgba(160,10,22,0.9)');
        gg.addColorStop(1, 'rgba(255,50,60,0.95)');
        c2.fillStyle = gg;
        c2.fill();
      }
      // scanlines + a glitch slice
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let z = za + 1; z < zb; z += 2) {
        const s0 = P(...pa, z), s1 = P(...pb, z);
        ctx.fillRect(Math.min(s0[0], s1[0]), s0[1], Math.abs(s1[0] - s0[0]), 0.6);
      }
      const gz = lerp(za, zb, r());
      const s0 = P(...pa, gz);
      ctx.fillStyle = 'rgba(255,220,225,0.6)';
      ctx.fillRect(s0[0] + 4, s0[1], Math.abs(pb[0] - pa[0]) * 0.4, 1.2);
    }
  }

  function drawBox(b) {
    const z0 = b.z0 || 0, h = b.h;
    const n = b.poly.length;
    const faces = [];
    for (let i = 0; i < n; i++) {
      const a = b.poly[i], c = b.poly[(i + 1) % n];
      const dx = c[0] - a[0], dy = c[1] - a[1];
      const L = Math.hypot(dx, dy);
      if (L < 0.4) continue;
      const nx = dy / L, ny = -dx / L;
      if (-nx * KX + ny * KY <= 0.0005) continue;
      faces.push({ a, c, nx, ny, L, d: depthOf((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) });
    }
    faces.sort((p, q) => q.d - p.d);
    for (const f of faces) drawFace(b, f, z0, h);
    // roof
    path(ctx, b.poly, h);
    ctx.fillStyle = rgba(b.roof);
    ctx.fill();
    const bb = bbox(b.poly);
    if (!b.clean && bb.w > 6 && bb.h > 6) {
      ctx.save();
      ctx.clip();
      const r = b.rnd || R;
      grimePat.setTransform(new DOMMatrix([1, 0, 0, 1, Math.floor(r() * 512), Math.floor(r() * 512)]));
      ctx.globalAlpha = 0.75 + r() * 0.25;
      ctx.fillStyle = grimePat;
      ctx.fill();
      ctx.fill();
      ctx.restore();
      path(ctx, b.poly, h);
    }
    if (bb.w > 8 && bb.h > 8 && !b.noParapet) {
      ctx.save();
      ctx.clip();
      const [gx0, gy0] = P(bb.x0, bb.y0, h), [gx1, gy1] = P(bb.x1, bb.y1, h);
      const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, 'rgba(0,0,0,0.22)');
      g.addColorStop(1, 'rgba(255,255,255,0.05)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.32)';
      ctx.stroke();
      ctx.restore();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = rgba(shade(b.roof, 1.45), 0.75);
      ctx.stroke();
    }
    if (b.neon) {
      // neon trim along the visible (south / west) roof edges
      e.lineWidth = 1.4;
      e.strokeStyle = 'rgba(255,40,55,0.9)';
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,70,80,0.95)';
      for (let i = 0; i < n; i++) {
        const a = b.poly[i], c = b.poly[(i + 1) % n];
        const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1;
        if (-(dy / L) * KX + (-dx / L) * KY <= 0) continue;
        for (const c2 of [ctx, e]) {
          c2.beginPath(); c2.moveTo(...P(a[0], a[1], h - 1)); c2.lineTo(...P(c[0], c[1], h - 1)); c2.stroke();
        }
      }
    }
    if (b.roofFn) b.roofFn(b);
  }

  /* ----- rooftop furniture (all in ground coords, projected at roof height) */
  function miniBox(x, y, w, d, z, hh, col, rot = 0) {
    const poly = rot ? rotRect(x, y, w, d, Math.cos(rot), Math.sin(rot)) : rectPoly(x - w / 2, y - d / 2, x + w / 2, y + d / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    // shadow on the roof
    ctx.beginPath();
    for (const off of [0, 1]) {
      poly.forEach(([px, py], i) => {
        const X = px + z * KX + SX * hh * off, Y = py - z * KY + SY * hh * off;
        if (i === 0 && off === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
    }
    ctx.closePath();
    ctx.fill();
    path(ctx, poly, z, SX * hh * 0.5, SY * hh * 0.5);
    ctx.fill();
    drawBox({ poly, h: z + hh, z0: z, facade: shade(col, 0.8), roof: col, noParapet: true, rnd: R });
  }
  function tank(x, y, z, r, hh, col) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    const [sx, sy] = P(x + SX * hh * 0.7, y + SY * hh * 0.7, z);
    ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.1, r, 0, 0, TAU); ctx.fill();
    const [bx, by] = P(x, y, z), [tx, ty] = P(x, y, z + hh);
    const g = ctx.createLinearGradient(bx - r, 0, bx + r, 0);
    g.addColorStop(0, rgba(shade(col, 0.45)));
    g.addColorStop(0.7, rgba(shade(col, 1.0)));
    g.addColorStop(1, rgba(shade(col, 0.75)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(bx - r, by); ctx.lineTo(tx - r, ty); ctx.lineTo(tx + r, ty); ctx.lineTo(bx + r, by);
    ctx.ellipse(bx, by, r, r * 0.9, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = rgba(shade(col, 1.25));
    ctx.beginPath(); ctx.ellipse(tx, ty, r, r * 0.9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  function antenna(x, y, z, L, tipLit) {
    const [bx, by] = P(x, y, z), [tx, ty] = P(x, y, z + L);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + SX * L, by + SY * L); ctx.stroke();
    ctx.strokeStyle = 'rgba(150,155,160,0.85)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    if (tipLit) {
      ctx.fillStyle = rgba(C.red);
      ctx.fillRect(tx - 1, ty - 1, 2.2, 2.2);
      e.fillStyle = rgba(C.red);
      e.beginPath(); e.arc(tx, ty, 2.2, 0, TAU); e.fill();
    }
  }
  function genericRoof(b) {
    const r = b.rnd;
    const bb = bbox(b.poly);
    const z = b.h;
    const inside = (x, y, m) => x > bb.x0 + m && x < bb.x1 - m && y > bb.y0 + m && y < bb.y1 - m && inPoly(x, y, b.poly);
    const A = bb.w * bb.h;
    // texture: roof membrane seams / gravel
    if (r() < 0.5 && bb.w > 20 && bb.h > 20) {
      ctx.save();
      path(ctx, b.poly, z);
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 0.8;
      const step = r() < 0.5 ? 5 : 8;
      for (let x = bb.x0; x < bb.x1; x += step) {
        ctx.beginPath(); ctx.moveTo(...P(x, bb.y0, z)); ctx.lineTo(...P(x, bb.y1, z)); ctx.stroke();
      }
      ctx.restore();
    }
    if (b.kind === 'industrial') {
      // sawtooth north-light roof
      ctx.save();
      path(ctx, b.poly, z);
      ctx.clip();
      for (let y = bb.y0 + 4; y < bb.y1; y += 9) {
        const [x0, y0] = P(bb.x0, y, z), [x1] = P(bb.x1, y, z);
        const g = ctx.createLinearGradient(0, y0 - 4, 0, y0 + 5);
        g.addColorStop(0, 'rgba(0,0,0,0.35)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, 'rgba(120,140,150,0.16)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, y0 - 4, x1 - x0, 9);
      }
      ctx.restore();
    }
    // puddle sheen
    if (r() < 0.45 && A > 600) {
      const x = lerp(bb.x0, bb.x1, 0.2 + r() * 0.6), y = lerp(bb.y0, bb.y1, 0.2 + r() * 0.6);
      const [px, py] = P(x, y, z);
      ctx.save();
      path(ctx, b.poly, z);
      ctx.clip();
      ctx.fillStyle = 'rgba(120,135,145,0.12)';
      ctx.beginPath(); ctx.ellipse(px, py, 4 + r() * bb.w * 0.2, 3 + r() * bb.h * 0.15, r() * 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (b.kind === 'ruinroof') {
      // a hole punched through the roof
      const x = lerp(bb.x0, bb.x1, 0.3 + r() * 0.4), y = lerp(bb.y0, bb.y1, 0.3 + r() * 0.4);
      const rad = Math.min(bb.w, bb.h) * (0.18 + r() * 0.15);
      ctx.fillStyle = 'rgb(5,5,6)';
      ctx.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU, rr = rad * (0.6 + r() * 0.6);
        const [px, py] = P(x + Math.cos(a) * rr, y + Math.sin(a) * rr, z);
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,85,80,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      for (let k = 0; k < 10; k++) {
        const a = r() * TAU, rr = rad * (1 + r() * 0.8);
        const [px, py] = P(x + Math.cos(a) * rr, y + Math.sin(a) * rr, z);
        ctx.fillStyle = `rgba(${60 + r() * 30},${58 + r() * 26},${55 + r() * 20},0.8)`;
        ctx.fillRect(px, py, 1 + r() * 3, 1 + r() * 2);
      }
    }
    // furniture
    const nAC = Math.floor(A / 900 * (0.5 + r()));
    for (let i = 0; i < nAC; i++) {
      const w = 4 + r() * 7, d = 3 + r() * 5;
      const x = lerp(bb.x0, bb.x1, r()), y = lerp(bb.y0, bb.y1, r());
      if (!inside(x, y, Math.max(w, d) * 0.7 + 2)) continue;
      miniBox(x, y, w, d, z, 2 + r() * 3, [62 + r() * 18, 64 + r() * 18, 66 + r() * 18]);
    }
    if (b.kind === 'old' && A > 700) {
      const nT = 1 + Math.floor(r() * 2.5);
      for (let i = 0; i < nT; i++) {
        const x = lerp(bb.x0, bb.x1, 0.2 + r() * 0.6), y = lerp(bb.y0, bb.y1, 0.2 + r() * 0.6);
        if (!inside(x, y, 8)) continue;
        tank(x, y, z, 4 + r() * 3, 7 + r() * 6, [72, 62, 54]);
      }
    }
    if (b.kind === 'tower' && A > 1200) {
      if (r() < 0.55) {
        const x = bb.cx, y = bb.cy, rad = Math.min(bb.w, bb.h) * 0.3;
        const [px, py] = P(x, y, z);
        ctx.fillStyle = 'rgba(20,21,23,0.95)';
        ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(190,190,185,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(px, py, rad * 0.78, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeRect(px - rad * 0.3, py - rad * 0.3, rad * 0.6, rad * 0.6);
        // perimeter lights
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          const lx = px + Math.cos(a) * rad, ly = py + Math.sin(a) * rad;
          const on = r() < 0.6;
          ctx.fillStyle = on ? rgba(C.red) : 'rgba(80,30,30,0.8)';
          ctx.fillRect(lx - 0.8, ly - 0.8, 1.6, 1.6);
          if (on) { e.fillStyle = rgba(C.red, 0.9); e.fillRect(lx - 1, ly - 1, 2, 2); }
        }
      } else {
        miniBox(bb.cx, bb.cy, bb.w * 0.4, bb.h * 0.35, z, 6 + r() * 6, [58, 60, 63]);
      }
    }
    if (r() < (b.kind === 'tower' ? 0.75 : 0.18)) {
      const nA = 1 + Math.floor(r() * 3);
      for (let i = 0; i < nA; i++) {
        const x = lerp(bb.x0, bb.x1, 0.15 + r() * 0.7), y = lerp(bb.y0, bb.y1, 0.15 + r() * 0.7);
        if (!inside(x, y, 3)) continue;
        antenna(x, y, z, 10 + r() * 22 * (b.kind === 'tower' ? 1.6 : 1), r() < 0.6);
      }
    }
    if (r() < 0.12 && A > 900) {
      // solar / skylight grid
      const x0 = lerp(bb.x0, bb.x1, 0.1), y0 = lerp(bb.y0, bb.y1, 0.1 + r() * 0.3);
      const nx = Math.floor(bb.w * 0.8 / 6), ny = Math.min(4, Math.floor(bb.h * 0.4 / 5));
      const sky = r() < 0.5;
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
        const x = x0 + i * 6, y = y0 + j * 5;
        if (!inside(x + 2, y + 2, 1)) continue;
        const [px, py] = P(x, y, z);
        ctx.fillStyle = sky ? 'rgba(90,110,120,0.5)' : 'rgba(30,38,52,0.95)';
        ctx.fillRect(px, py, 5, 4);
        if (sky && r() < 0.12) { ctx.fillStyle = rgba(C.amber, 0.5); ctx.fillRect(px, py, 5, 4); e.fillStyle = rgba(C.amber, 0.4); e.fillRect(px, py, 5, 4); }
      }
    }
  }

  /* ----- lots → buildings */
  const nearCross = (x, y) => Math.hypot(x - CX, y - CY);
  function hField(x, y) {
    const d1 = ((x - CX) / 420) ** 2 + ((y - 860) / 640) ** 2;
    const d2 = ((x - SPIRE.x) / 330) ** 2 + ((y - SPIRE.y - 60) / 280) ** 2;
    const d3 = ((x - CX) / 330) ** 2 + ((y - CY) / 240) ** 2;
    const d4 = ((x - 1450) / 260) ** 2 + ((y - 1250) / 300) ** 2;
    return 20 + 120 * Math.exp(-d1 * 1.3) + 110 * Math.exp(-d2) + 80 * Math.exp(-d3) + 30 * Math.exp(-d4) + (district(x, y) - 0.5) * 40;
  }
  const trees = [];
  for (const [lx0, ly0, lx1, ly1] of lots) {
    const w = lx1 - lx0, d = ly1 - ly0;
    if (w < 9 || d < 9) continue;
    const cx = (lx0 + lx1) / 2, cy = (ly0 + ly1) / 2;
    const roll = R();
    const harbour = cx > 1330 && cy < 1250 && cy > 1000;
    // parking / vacant lots
    if (roll < 0.06 && w > 30 && d > 30) {
      ctx.fillStyle = 'rgb(21,22,24)';
      ctx.fillRect(lx0, ly0, w, d);
      ctx.strokeStyle = 'rgba(160,160,160,0.12)';
      ctx.lineWidth = 1;
      for (let x = lx0 + 3; x < lx1 - 3; x += 7) { ctx.beginPath(); ctx.moveTo(x, ly0 + 2); ctx.lineTo(x, ly0 + 11); ctx.stroke(); }
      for (let k = 0; k < (w * d) / 300; k++) car(R.range(lx0 + 4, lx1 - 4), R.range(ly0 + 6, ly1 - 6), R.chance(0.7) ? 0 : R.range(0, TAU), R.pick(CAR));
      continue;
    }
    if (roll < 0.1 && w > 20 && d > 20) {
      // rubble field of a collapsed building
      const rr = R;
      ctx.fillStyle = 'rgb(30,28,27)';
      ctx.fillRect(lx0, ly0, w, d);
      for (let k = 0; k < (w * d) / 22; k++) {
        const x = rr.range(lx0 - 4, lx1 + 4), y = rr.range(ly0 - 4, ly1 + 4);
        const s = rr.range(1, 4.5);
        const v = rr.range(36, 84);
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 7})`;
        ctx.save(); ctx.translate(x, y); ctx.rotate(rr() * TAU);
        ctx.fillRect(-s / 2, -s / 2, s, s * rr.range(0.4, 1.2));
        ctx.restore();
      }
      // standing wall stubs
      const stubs = R.int(1, 3);
      for (let k = 0; k < stubs; k++) {
        const along = R.chance(0.5);
        const x = along ? R.range(lx0, lx1 - 10) : R.pick([lx0, lx1 - 3]);
        const y = along ? R.pick([ly0, ly1 - 3]) : R.range(ly0, ly1 - 10);
        const poly = along ? rectPoly(x, y, x + R.range(8, Math.min(30, w)), y + 2.5) : rectPoly(x, y, x + 2.5, y + R.range(8, Math.min(30, d)));
        const hh = R.range(8, 34);
        addShadow(poly, hh);
        objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox({ poly, h: hh, facade: [48, 46, 44], roof: [60, 58, 55], rnd: R, noParapet: true, win: { floorH: 8, spacing: 5, rate: 0, rowBias: 0, list: WIN.warm } }) });
      }
      continue;
    }
    if (roll < 0.13 && w > 16 && d > 16) {
      // courtyard with a dead tree
      ctx.fillStyle = 'rgb(19,22,20)';
      ctx.fillRect(lx0 + 2, ly0 + 2, w - 4, d - 4);
      trees.push([cx, cy, Math.min(w, d) * 0.3]);
      continue;
    }
    const inset = R.range(0.5, 3);
    const poly = rectPoly(lx0 + inset, ly0 + inset, lx1 - inset, ly1 - inset);
    let h = hField(cx, cy) * R.range(0.5, 1.3) * 1.25;
    if (R.chance(0.07)) h *= 1.6;
    if (harbour) h = R.range(14, 30);
    h = clamp(h, 9, 360);
    // never let a roof swing over a zone pin
    for (const [px, py] of PINS) {
      if (lx1 + 30 < px - 60 || lx0 - 30 > px + 60 || ly0 < py) continue;
      const room = (ly0 - py - 46) / KY;
      if (room < h) h = Math.max(9, room);
    }
    const footprint = w * d;
    if (footprint < 500) h = Math.min(h, 60);
    let kind = 'flat';
    if (harbour || (footprint > 2500 && h < 35 && R.chance(0.5))) kind = 'industrial';
    else if (h > 120) kind = 'tower';
    else if (h < 70 && R.chance(0.35)) kind = 'old';
    if (R.chance(0.05)) kind = 'ruinroof';
    const nc = nearCross(cx, cy);
    const tone = 0.82 + district(cx * 1.7, cy * 1.7) * 0.36;
    const rnd = rand(Math.floor(cx * 7 + cy * 13));
    const winRate = R.chance(0.3) ? 0 : R.chance(0.8) ? R.range(0.02, 0.08) : R.range(0.14, 0.32);
    const b = {
      poly, h, kind, rnd,
      facade: shade(R.pick([[34, 37, 41], [38, 38, 40], [30, 34, 38], [40, 36, 34], [28, 30, 32]]), tone),
      roof: shade(R.pick(ROOFS), tone),
      win: {
        floorH: kind === 'industrial' ? 14 : R.range(7.5, 10), spacing: R.range(4.5, 7.5), rate: winRate,
        rowBias: 0.04, list: nc < 420 ? WIN.red : WIN.warm, fill: R.range(0.45, 0.68),
      },
      billboard: nc < 330 && h > 50 && R.chance(0.55),
      neon: nc < 380 && R.chance(0.35),
      roofFn: genericRoof,
    };
    addShadow(poly, h);
    objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
  }

  /* ----- trees (boulevard, plaza, parks) */
  for (let y = 380; y < H; y += 26) {
    for (const x of [CX - 38, CX + 38]) {
      if (inSpecial(x, y, -10) || Math.abs(y - CY) < 150 || R.chance(0.2)) continue;
      trees.push([x + R.range(-2, 2), y, R.range(5, 8)]);
    }
  }
  for (let i = 0; i < 220; i++) {
    const x = R.range(30, 296), y = R.range(1500, 1762);
    if (Math.hypot((x - 96) / 58, (y - 1690) / 36) < 1) continue;
    trees.push([x, y, R.range(6, 13)]);
  }
  for (let i = 0; i < 60; i++) {
    const x = R.range(1170, 1545), y = R.range(900, 1160);
    if (!inPoly(x, y, fair) || Math.hypot((x - WHEEL.x) / 110, (y - WHEEL.y) / 50) < 1) continue;
    trees.push([x, y, R.range(4, 8)]);
  }
  for (const [px, py] of [[290, 1800], [506, 1800], [290, 1948], [506, 1948], [330, 1874], [462, 1874]]) trees.push([px, py, 8]);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    trees.push([SPIRE.x + Math.cos(a) * 100, SPIRE.y + Math.sin(a) * 100, 5.5]);
  }
  for (const [x, y, r] of trees) {
    sh.beginPath(); sh.ellipse(x + SX * r * 1.4, y + SY * r * 1.4, r, r * 0.9, 0, 0, TAU); sh.fill();
  }

  /* ----- composite shadows + AO onto the ground */
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.drawImage(blurred(AO.c, 7), 0, 0);
  ctx.globalAlpha = 0.62;
  ctx.drawImage(blurred(SH.c, 1.6), 0, 0);
  ctx.restore();

  /* ----- street lamps: pools + reflections (after shadows) */
  const lamps = [];
  {
    const addLamp = (x, y) => {
      if (inSpecial(x, y, 4)) return;
      if (!R.chance(0.2)) return;
      const t = R();
      const col = t < 0.55 ? C.amber : t < 0.85 ? C.red : C.cold;
      lamps.push([x, y, col, R.range(0.6, 1)]);
    };
    for (let i = 0; i < xs.length; i++) for (let y = R.range(0, 60); y < H; y += R.range(64, 92)) for (const s of [-1, 1]) addLamp(xs[i] + s * (wx[i] / 2 + 2), y + s * 20);
    for (let j = 0; j < ys.length; j++) for (let x = R.range(0, 60); x < W; x += R.range(64, 92)) for (const s of [-1, 1]) addLamp(x + s * 20, ys[j] + s * (wy[j] / 2 + 2));
    for (const [a, b, w] of [[...diagA, 48], [...diagB, 44]]) {
      for (const p of walk([a, b], 70)) for (const s of [-1, 1]) addLamp(p.x - p.dy * s * (w / 2 + 3), p.y + p.dx * s * (w / 2 + 3));
    }
    for (const [x, y, col, k] of lamps) {
      light(ctx, x, y, 34 * k + 10, col, 0.2 * k);
      light(ctx, x, y + 16, 20, col, 0.1 * k, 2.4);
    }
  }
  // crimson crossing glow + beacons
  {
    light(ctx, CX, CY, 220, [200, 20, 30], 0.32);
    light(ctx, CX, CY, 90, [255, 40, 50], 0.18);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const x = CX + dx * 104, y = CY + dy * 96;
      light(ctx, x, y, 60, C.red, 0.35);
      light(ctx, x, y + 26, 34, C.red, 0.2, 2.6);
      e.fillStyle = rgba(C.red);
      e.beginPath(); e.arc(x, y, 3.2, 0, TAU); e.fill();
      ctx.fillStyle = 'rgb(255,120,120)';
      ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
    }
  }

  /* ----- trees canopies */
  for (const [x, y, r] of trees) {
    const g = ctx.createRadialGradient(x + r * 0.35, y + r * 0.4, 0, x, y, r);
    g.addColorStop(0, 'rgb(38,48,40)');
    g.addColorStop(0.7, 'rgb(20,27,22)');
    g.addColorStop(1, 'rgba(12,16,13,0.9)');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, rr = r * (0.75 + R() * 0.35);
      ctx.moveTo(x + Math.cos(a) * rr * 0.5 + r * 0.45, y + Math.sin(a) * rr * 0.5);
      ctx.arc(x + Math.cos(a) * rr * 0.5, y + Math.sin(a) * rr * 0.5, r * 0.45, 0, TAU);
    }
    ctx.fill();
  }

  /* ----- lamp heads (emissive) */
  for (const [x, y, col, k] of lamps) {
    ctx.fillStyle = rgba(mix(col, [255, 255, 255], 0.4));
    ctx.fillRect(x - 1, y - 1, 2, 2);
    e.fillStyle = rgba(col, k);
    e.beginPath(); e.arc(x, y, 2.2, 0, TAU); e.fill();
  }

  /* ================================================================ LANDMARKS */

  // ---- interchange: H2 at grade with a flooded cut, loops, then H1 elevated
  {
    const deck = ribbon(H2, 62);
    ctx.fillStyle = 'rgb(24,25,27)';
    path(ctx, ribbon(H2, 74));
    ctx.fill();
    ctx.fillStyle = 'rgb(20,21,23)';
    path(ctx, deck);
    ctx.fill();
    for (const off of [-10, 10]) { ctx.setLineDash([10, 12]); ctx.strokeStyle = 'rgba(200,200,190,0.16)'; ctx.lineWidth = 1.2; strokeLine(ctx, offsetLine(H2, off)); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(150,150,140,0.25)';
    strokeLine(ctx, offsetLine(H2, 0)); ctx.stroke();
    // flooded cut and tunnel portal (north end)
    const top = 1588, bot = 1676;
    ctx.fillStyle = 'rgb(14,14,15)';
    ctx.fillRect(1222, top, 76, bot - top);
    const wg = ctx.createLinearGradient(0, top, 0, bot);
    wg.addColorStop(0, 'rgb(6,8,10)');
    wg.addColorStop(1, 'rgb(14,18,22)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(1226, top + 6);
    ctx.lineTo(1294, top + 6);
    ctx.bezierCurveTo(1300, bot - 20, 1290, bot, 1260, bot + 4);
    ctx.bezierCurveTo(1232, bot, 1222, bot - 20, 1226, top + 6);
    ctx.fill();
    // portal frame
    ctx.fillStyle = 'rgb(54,54,56)';
    ctx.fillRect(1214, top - 10, 92, 12);
    ctx.fillStyle = 'rgb(2,2,3)';
    ctx.fillRect(1226, top - 2, 68, 8);
    // retaining walls
    ctx.fillStyle = 'rgb(46,46,48)';
    ctx.fillRect(1214, top, 8, bot - top + 10);
    ctx.fillRect(1298, top, 8, bot - top + 10);
    // the stubborn terminal + its reflection
    ctx.fillStyle = 'rgb(255,70,70)';
    ctx.fillRect(1288, top + 2, 4, 5);
    e.fillStyle = rgba(C.red);
    e.fillRect(1287, top + 1, 6, 7);
    light(ctx, 1290, top + 4, 50, C.red, 0.4);
    light(ctx, 1286, top + 34, 30, C.red, 0.3, 3);
    ctx.strokeStyle = 'rgba(160,190,200,0.12)';
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 14; k++) {
      const y = top + 12 + k * 5;
      ctx.beginPath(); ctx.moveTo(1232 + R() * 10, y); ctx.lineTo(1288 - R() * 10, y + R()); ctx.stroke();
    }
    // loops
    for (const L of loops) {
      const z = 11;
      sh.lineWidth = 18;
      sh.beginPath(); sh.arc(L.x + SX * z, L.y + SY * z, L.r, 0, TAU); sh.stroke();
    }
  }
  // composite highway shadows drawn above, then decks
  {
    const z = 24;
    sh.globalCompositeOperation = 'copy';
    sh.fillStyle = 'rgba(0,0,0,0)';
    sh.fillRect(0, 0, W, H);
    sh.globalCompositeOperation = 'source-over';
    sh.fillStyle = '#000';
    path(sh, ribbon(H1, 66), 0, SX * z, SY * z);
    sh.fill();
    for (const L of loops) { sh.lineWidth = 18; sh.beginPath(); sh.arc(L.x + SX * 11, L.y + SY * 11, L.r, 0, TAU); sh.stroke(); }
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(blurred(SH.c, 3), 0, 0);
    ctx.restore();
    sh.clearRect(0, 0, W, H);
    // loop ramps
    for (const L of loops) {
      const zz = 11;
      const [x, y] = P(L.x, L.y, zz);
      ctx.lineWidth = 20;
      ctx.strokeStyle = 'rgb(30,31,33)';
      ctx.beginPath(); ctx.arc(x - 1, y + 4, L.r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 17;
      ctx.strokeStyle = 'rgb(25,26,28)';
      ctx.beginPath(); ctx.arc(x, y, L.r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(160,160,155,0.35)';
      ctx.beginPath(); ctx.arc(x, y, L.r + 8, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, L.r - 8, 0, TAU); ctx.stroke();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        const on = R.chance(0.5);
        if (!on) continue;
        const lx = x + Math.cos(a) * (L.r + 9), ly = y + Math.sin(a) * (L.r + 9);
        e.fillStyle = rgba(C.amber, 0.9);
        e.beginPath(); e.arc(lx, ly, 1.8, 0, TAU); e.fill();
        light(ctx, lx, ly, 18, C.amber, 0.14);
      }
    }
    // pillars
    for (const p of walk(H1, 46, 10)) {
      if (p.x < -10 || p.x > W + 10) continue;
      const poly = rectPoly(p.x - 4, p.y - 3, p.x + 4, p.y + 3);
      drawBox({ poly, h: z - 4, facade: [52, 52, 54], roof: [50, 50, 52], rnd: R, noParapet: true });
    }
    // deck fascia + deck
    ctx.fillStyle = 'rgb(44,45,47)';
    path(ctx, ribbon(H1, 68), z - 6);
    ctx.fill();
    ctx.fillStyle = 'rgb(26,27,29)';
    path(ctx, ribbon(H1, 66), z);
    ctx.fill();
    ctx.save();
    path(ctx, ribbon(H1, 66), z);
    ctx.clip();
    ctx.drawImage(noiseLayer(W, H, { seed: 101, scale: 0.03, octaves: 3, step: 3, lo: 0.45, hi: 0.9, color: [0, 0, 0], alpha: 0.35 }), 0, 0);
    ctx.restore();
    // barriers + lanes
    ctx.strokeStyle = 'rgba(170,170,165,0.45)';
    ctx.lineWidth = 1.4;
    for (const off of [-32, 32]) { strokeLine(ctx, offsetLine(H1, off), z); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(90,90,92,0.9)';
    ctx.lineWidth = 2.5;
    strokeLine(ctx, H1, z); ctx.stroke();
    ctx.setLineDash([9, 11]);
    ctx.strokeStyle = 'rgba(200,200,190,0.17)';
    ctx.lineWidth = 1.1;
    for (const off of [-20, -9, 9, 20]) { strokeLine(ctx, offsetLine(H1, off), z); ctx.stroke(); }
    ctx.setLineDash([]);
    // median lamps
    for (const p of walk(H1, 58, 20)) {
      const [x, y] = P(p.x, p.y, z + 8);
      const on = R.chance(0.55);
      ctx.fillStyle = on ? 'rgb(255,200,140)' : 'rgb(70,70,70)';
      ctx.fillRect(x - 1, y - 1, 2, 2);
      if (on) {
        e.fillStyle = rgba(C.amber, 0.95);
        e.beginPath(); e.arc(x, y, 2.4, 0, TAU); e.fill();
        light(ctx, x, y + 3, 34, C.amber, 0.14);
      }
    }
    // abandoned cars on the deck
    for (const p of walk(H1, 30, 12)) {
      if (R.chance(0.55)) continue;
      const side = R.pick([-26, -14, 14, 26]);
      const [x, y] = P(p.x - p.dy * side, p.y + p.dx * side, z);
      const ang = Math.atan2(p.dy, p.dx) - Math.PI / 2 + (side > 0 ? 0 : Math.PI) + (R.chance(0.2) ? R.range(-0.9, 0.9) : 0);
      car(x, y, ang, R.pick(CAR), R.chance(0.08));
    }
    // a jack-knifed truck at the interchange
    ctx.save();
    const [tx, ty] = P(IC.x + 80, IC.y - 6, z);
    ctx.translate(tx, ty); ctx.rotate(0.5);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-24, -6, 50, 14);
    ctx.fillStyle = 'rgb(70,64,58)'; ctx.fillRect(-22, -5, 36, 10);
    ctx.fillStyle = 'rgb(90,24,26)'; ctx.fillRect(16, -5, 9, 10);
    ctx.restore();
  }

  // ---- landmark objects into the depth-sorted list
  // THE SPIRE
  objects.push({
    key: depthOf(SPIRE.x - 50, SPIRE.y + 50),
    draw: () => {
      const { x, y } = SPIRE;
      const tiers = SPIRE_TIERS;
      const oct = (r, rot = Math.PI / 8) => ellPoly(x, y, r, r, 8, rot);
      for (const [z0, z1, r0, r1] of tiers) {
        const b0 = oct(r0), b1 = oct(r1);
        const faces = [];
        for (let i = 0; i < 8; i++) {
          const a = b0[i], c = b0[(i + 1) % 8];
          const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy);
          const nx = dy / L, ny = -dx / L;
          if (-nx * KX + ny * KY <= 0) continue;
          faces.push({ i, nx, ny, d: depthOf((a[0] + c[0]) / 2, (a[1] + c[1]) / 2) });
        }
        faces.sort((p, q) => q.d - p.d);
        for (const f of faces) {
          const i = f.i, j = (i + 1) % 8;
          const q = [P(...b0[i], z0), P(...b0[j], z0), P(...b1[j], z1), P(...b1[i], z1)];
          const lit = 0.28 + 0.72 * Math.max(0, f.nx * LX + f.ny * LY);
          const base = shade([52, 58, 66], lit);
          const g = ctx.createLinearGradient(...q[0], ...q[3]);
          g.addColorStop(0, rgba(shade(base, 0.5)));
          g.addColorStop(1, rgba(mix(base, [110, 120, 135], 0.25)));
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(...q[0]); ctx.lineTo(...q[1]); ctx.lineTo(...q[2]); ctx.lineTo(...q[3]); ctx.closePath(); ctx.fill();
          // mullions
          ctx.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx.lineWidth = 0.7;
          for (let t = 0.2; t < 1; t += 0.2) {
            const p0 = [lerp(q[0][0], q[1][0], t), lerp(q[0][1], q[1][1], t)], p1 = [lerp(q[3][0], q[2][0], t), lerp(q[3][1], q[2][1], t)];
            ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.stroke();
          }
          // floor lights
          const rr = rand(i * 31 + z0);
          for (let z = z0 + 6; z < z1 - 4; z += 7) {
            const tz = (z - z0) / (z1 - z0);
            for (let t = 0.1; t < 0.95; t += 0.2) {
              if (rr() > 0.16) continue;
              const pa = [lerp(lerp(q[0][0], q[1][0], t), lerp(q[3][0], q[2][0], t), tz), lerp(lerp(q[0][1], q[1][1], t), lerp(q[3][1], q[2][1], t), tz)];
              const col = rr() < 0.6 ? C.red : C.amber;
              ctx.fillStyle = rgba(col, 0.9);
              ctx.fillRect(pa[0], pa[1], 2.2, 1.4);
              e.fillStyle = rgba(col, 0.9);
              e.fillRect(pa[0], pa[1], 2.2, 1.4);
            }
          }
          // red band near the top of each tier
          const band = [P(...b1[i], z1 - 3), P(...b1[j], z1 - 3)];
          for (const c2 of [ctx, e]) {
            c2.strokeStyle = c2 === e ? 'rgba(255,40,52,0.55)' : 'rgba(255,60,70,0.75)';
            c2.lineWidth = 1.1;
            c2.beginPath(); c2.moveTo(...band[0]); c2.lineTo(...band[1]); c2.stroke();
          }
        }
        // tier roof
        path(ctx, b1, z1);
        ctx.fillStyle = 'rgb(58,62,68)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(170,175,185,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
        for (const v of b1) {
          const [px, py] = P(...v, z1 + 1);
          e.fillStyle = rgba(C.red);
          e.beginPath(); e.arc(px, py, 1.8, 0, TAU); e.fill();
        }
      }
      // needle + beacon
      const [nx0, ny0] = P(x, y, SPIRE_TOP), [nx1, ny1] = P(x, y, SPIRE_NEEDLE);
      ctx.strokeStyle = 'rgb(150,155,165)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(nx0, ny0); ctx.lineTo(nx1, ny1); ctx.stroke();
      ctx.lineWidth = 0.8;
      for (let z = SPIRE_TOP + 8; z < SPIRE_NEEDLE - 4; z += 9) {
        const [a, b] = P(x, y, z);
        ctx.beginPath(); ctx.moveTo(a - 2, b); ctx.lineTo(a + 2, b); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(nx1, ny1, 2.6, 0, TAU); ctx.fill();
      e.fillStyle = rgba(C.red);
      e.beginPath(); e.arc(nx1, ny1, 6, 0, TAU); e.fill();
      light(e, nx1, ny1, 40, C.red, 0.7);
      const [mx, my] = P(x, y, 250);
      light(e, mx, my, 14, C.red, 0.4);
    },
  });
  {
    // spire shadow (tapered) + needle shadow
    const tiers = SPIRE_TIERS;
    for (const [z0, z1, r0, r1] of tiers) {
      const b0 = ellPoly(SPIRE.x + SX * z0, SPIRE.y + SY * z0, r0, r0, 8, Math.PI / 8);
      const b1 = ellPoly(SPIRE.x + SX * z1, SPIRE.y + SY * z1, r1, r1, 8, Math.PI / 8);
      sh.beginPath();
      for (let i = 0; i < 8; i++) {
        const j = (i + 1) % 8;
        sh.moveTo(...b0[i]); sh.lineTo(...b0[j]); sh.lineTo(...b1[j]); sh.lineTo(...b1[i]); sh.closePath();
      }
      sh.fill();
    }
    sh.lineWidth = 2;
    sh.beginPath(); sh.moveTo(SPIRE.x + SX * SPIRE_TOP, SPIRE.y + SY * SPIRE_TOP); sh.lineTo(SPIRE.x + SX * SPIRE_NEEDLE, SPIRE.y + SY * SPIRE_NEEDLE); sh.stroke();
  }

  // DEAD ARENA
  objects.push({
    key: depthOf(ARENA.x - ARENA.rx, ARENA.y + ARENA.ry),
    draw: () => {
      const { x, y, rx, ry } = ARENA;
      const hw = 44, N = 120;
      const pt = (a, sx = 1, sy = 1) => [x + Math.cos(a) * rx * sx, y + Math.sin(a) * ry * sy];
      // outer wall faces
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
        const am = (a0 + a1) / 2;
        let nx = Math.cos(am) / rx, ny = Math.sin(am) / ry;
        const l = Math.hypot(nx, ny); nx /= l; ny /= l;
        if (-nx * KX + ny * KY <= 0) continue;
        const p0 = pt(a0), p1 = pt(a1);
        const lit = 0.3 + 0.7 * Math.max(0, nx * LX + ny * LY);
        const base = shade([58, 58, 60], lit);
        const q = [P(...p0, 0), P(...p1, 0), P(...p1, hw), P(...p0, hw)];
        const g = ctx.createLinearGradient(...q[0], ...q[3]);
        g.addColorStop(0, rgba(shade(base, 0.45)));
        g.addColorStop(1, rgba(base));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(...q[0]); ctx.lineTo(...q[1]); ctx.lineTo(...q[2]); ctx.lineTo(...q[3]); ctx.closePath(); ctx.fill();
        if (i % 3 === 0) {
          ctx.strokeStyle = 'rgba(0,0,0,0.45)';
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(...q[0]); ctx.lineTo(...q[3]); ctx.stroke();
        }
        if (i % 6 === 3) {
          // portal arches
          const m0 = P(...pt(a0 + 0.006), 2), m1 = P(...pt(a1 - 0.006), 2);
          ctx.fillStyle = 'rgba(4,4,5,0.9)';
          ctx.fillRect(Math.min(m0[0], m1[0]), m0[1] - 6, Math.abs(m1[0] - m0[0]) + 1, 6);
        }
      }
      // rim
      ctx.fillStyle = 'rgb(66,66,68)';
      ctx.beginPath(); ctx.ellipse(...P(x, y, hw), rx, ry, 0, 0, TAU); ctx.fill();
      // seating bowl (each ring a step lower → shifts down-left)
      const K = 8;
      for (let k = 0; k <= K; k++) {
        const s = 0.96 - k * 0.052;
        const z = hw - 2 - k * 3.4;
        const [cx2, cy2] = P(x, y, z);
        const north = 0.75 + 0.25 * (k / K);
        const col = k % 2 ? [46, 36, 38] : [40, 41, 43];
        ctx.fillStyle = rgba(shade(col, north));
        ctx.beginPath(); ctx.ellipse(cx2, cy2, rx * s, ry * s, 0, 0, TAU); ctx.fill();
        // seat rows
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.ellipse(cx2, cy2, rx * s - 2, ry * s - 2, 0, 0, TAU); ctx.stroke();
      }
      // aisles
      ctx.strokeStyle = 'rgba(10,10,12,0.5)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * TAU;
        const [ox, oy] = P(x + Math.cos(a) * rx * 0.95, y + Math.sin(a) * ry * 0.95, hw - 2);
        const [ix, iy] = P(x + Math.cos(a) * rx * 0.55, y + Math.sin(a) * ry * 0.55, hw - 2 - K * 3.4);
        ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ix, iy); ctx.stroke();
      }
      // pitch
      const zp = hw - 4 - K * 3.4;
      const [px, py] = P(x, y, zp);
      const pw = rx * 0.78, ph = ry * 0.74;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(px, py, rx * 0.5, ry * 0.5, 0, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgb(24,32,27)';
      ctx.fillRect(px - pw, py - ph, pw * 2, ph * 2);
      for (let s = -6; s < 6; s++) {
        ctx.fillStyle = s % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)';
        ctx.fillRect(px + s * 14, py - ph, 14, ph * 2);
      }
      ctx.strokeStyle = 'rgba(210,215,210,0.28)';
      ctx.lineWidth = 1;
      const fw = rx * 0.42, fh = ry * 0.4;
      ctx.strokeRect(px - fw, py - fh, fw * 2, fh * 2);
      ctx.beginPath(); ctx.moveTo(px, py - fh); ctx.lineTo(px, py + fh); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 12, 0, TAU); ctx.stroke();
      ctx.strokeRect(px - fw, py - 14, 14, 28);
      ctx.strokeRect(px + fw - 14, py - 14, 14, 28);
      // floodlit puddles
      light(ctx, px - 30, py - 10, 70, [200, 215, 230], 0.2);
      light(ctx, px + 40, py + 14, 50, [200, 215, 230], 0.12);
      ctx.restore();
      // half roof over the north stands
      const zr = hw + 18;
      const [rx0, ry0] = P(x, y, zr);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(rx0, ry0, rx + 6, ry + 6, 0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.ellipse(rx0, ry0, rx * 0.68, ry * 0.66, 0, Math.PI * 1.98, Math.PI * 1.02, true);
      ctx.closePath();
      // shadow of the roof onto the stands
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.translate(-6, 22);
      ctx.fill();
      ctx.translate(6, -22);
      const rg = ctx.createLinearGradient(rx0, ry0 - ry, rx0, ry0);
      rg.addColorStop(0, 'rgb(70,72,76)');
      rg.addColorStop(1, 'rgb(50,52,56)');
      ctx.fillStyle = rg;
      ctx.fill();
      ctx.clip();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i <= 30; i++) {
        const a = Math.PI * (1.02 + 0.96 * (i / 30));
        ctx.beginPath();
        ctx.moveTo(rx0 + Math.cos(a) * rx * 0.66, ry0 + Math.sin(a) * ry * 0.64);
        ctx.lineTo(rx0 + Math.cos(a) * (rx + 8), ry0 + Math.sin(a) * (ry + 8));
        ctx.stroke();
      }
      // missing panels
      const rr = rand(512);
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.08 + rr() * 0.84), s = 0.72 + rr() * 0.22;
        ctx.fillStyle = 'rgba(16,14,15,0.95)';
        ctx.beginPath();
        ctx.ellipse(rx0 + Math.cos(a) * rx * s, ry0 + Math.sin(a) * ry * s, 6 + rr() * 9, 3 + rr() * 5, a, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      // roof leading edge
      ctx.strokeStyle = 'rgba(160,165,170,0.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(rx0, ry0, rx * 0.68, ry * 0.66, 0, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
      // collapsed south roof: twisted ribs + debris on the seats
      ctx.strokeStyle = 'rgba(120,120,125,0.7)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.12 + rr() * 0.76);
        const [ox, oy] = P(x + Math.cos(a) * rx, y + Math.sin(a) * ry, hw);
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.quadraticCurveTo(ox - Math.cos(a) * 10, oy - Math.sin(a) * 6 + 4, ox - Math.cos(a) * (14 + rr() * 22), oy - Math.sin(a) * (10 + rr() * 14) + 8);
        ctx.stroke();
      }
      for (let i = 0; i < 160; i++) {
        const a = Math.PI * (0.05 + rr() * 0.9), s = 0.6 + rr() * 0.36;
        const [dx, dy] = P(x + Math.cos(a) * rx * s, y + Math.sin(a) * ry * s, hw - 10);
        const v = 50 + rr() * 50;
        ctx.fillStyle = `rgba(${v},${v},${v + 4},0.85)`;
        ctx.save(); ctx.translate(dx, dy); ctx.rotate(rr() * TAU);
        ctx.fillRect(-1, -1, 1.5 + rr() * 4, 1 + rr() * 2);
        ctx.restore();
      }
      // floodlight masts: NE and SW still burn
      const masts = [[0.82, -0.86, true], [-0.86, 0.84, true], [-0.84, -0.84, false], [0.86, 0.86, false]];
      for (const [mx, my, on] of masts) {
        const bx = x + mx * rx * 1.02, by = y + my * ry * 1.02;
        const top = 120;
        const [b0x, b0y] = P(bx, by, 0), [t0x, t0y] = P(bx, by, top);
        ctx.strokeStyle = 'rgb(84,86,90)';
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(b0x, b0y); ctx.lineTo(t0x, t0y); ctx.stroke();
        ctx.fillStyle = on ? 'rgb(240,245,255)' : 'rgb(60,62,66)';
        ctx.save(); ctx.translate(t0x, t0y); ctx.rotate(Math.atan2(-my, -mx) * 0.3);
        ctx.fillRect(-9, -4, 18, 8);
        ctx.restore();
        if (on) {
          e.fillStyle = 'rgba(235,242,255,1)';
          e.fillRect(t0x - 10, t0y - 5, 20, 10);
          light(e, t0x, t0y, 60, [220, 230, 255], 0.55);
          // throw light onto the bowl
          light(ctx, lerp(t0x, px, 0.55), lerp(t0y, py, 0.55), 160, [190, 205, 225], 0.11);
        }
      }
    },
  });
  {
    // arena shadow (wall ring + roof)
    path(sh, ellPoly(ARENA.x + SX * 44, ARENA.y + SY * 44, ARENA.rx, ARENA.ry, 64));
    sh.fill();
    path(sh, ellPoly(ARENA.x + SX * 22, ARENA.y + SY * 22, ARENA.rx, ARENA.ry, 64));
    sh.fill();
    for (const [mx, my] of [[0.82, -0.86], [-0.86, 0.84], [-0.84, -0.84], [0.86, 0.86]]) {
      const bx = ARENA.x + mx * ARENA.rx * 1.02, by = ARENA.y + my * ARENA.ry * 1.02;
      sh.lineWidth = 2.5;
      sh.beginPath(); sh.moveTo(bx, by); sh.lineTo(bx + SX * 120, by + SY * 120); sh.stroke();
    }
  }

  // ROOFTOP — antenna farm on the tallest block of the midtown
  {
    const { x0, y0, x1, y1, h } = ROOFTOP;
    const poly = rectPoly(x0, y0, x1, y1);
    addShadow(poly, h);
    const b = {
      poly, h, rnd: rand(909), facade: [42, 46, 52], roof: [62, 63, 66],
      win: { floorH: 9, spacing: 6, rate: 0.05, rowBias: 0.05, list: WIN.red, fill: 0.55 },
      roofFn: () => {
        const rr = rand(910);
        const z = h;
        // equipment pads
        miniBox(x0 + 22, y0 + 18, 26, 14, z, 7, [70, 72, 76]);
        miniBox(x1 - 20, y1 - 16, 22, 16, z, 9, [66, 68, 72]);
        // dishes
        for (const [dx, dy, r] of [[0.7, 0.3, 9], [0.3, 0.7, 7], [0.82, 0.72, 6], [0.18, 0.28, 5]]) {
          const [cx, cy] = P(lerp(x0, x1, dx), lerp(y0, y1, dy), z + 6);
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath(); ctx.ellipse(cx - 6, cy + 1, r, r * 0.7, -0.6, 0, TAU); ctx.fill();
          const g = ctx.createRadialGradient(cx + r * 0.3, cy + r * 0.3, 0, cx, cy, r);
          g.addColorStop(0, 'rgb(170,172,176)');
          g.addColorStop(1, 'rgb(70,72,76)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.75, -0.6, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(30,30,32,0.8)';
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.8, cy - r * 0.9); ctx.stroke();
        }
        // masts with cables between them
        const masts = [];
        for (let i = 0; i < 16; i++) {
          const mx = lerp(x0 + 6, x1 - 6, rr()), my = lerp(y0 + 6, y1 - 6, rr());
          masts.push([mx, my, 24 + rr() * 60]);
        }
        masts.sort((a, b2) => b2[1] - a[1] === 0 ? 0 : a[1] - b2[1]);
        ctx.strokeStyle = 'rgba(20,20,22,0.7)';
        ctx.lineWidth = 0.6;
        for (let i = 0; i < masts.length - 1; i++) {
          const a = masts[i], c = masts[i + 1];
          const pa = P(a[0], a[1], z + a[2] * 0.7), pc = P(c[0], c[1], z + c[2] * 0.7);
          ctx.beginPath(); ctx.moveTo(...pa); ctx.quadraticCurveTo((pa[0] + pc[0]) / 2, Math.max(pa[1], pc[1]) + 8, ...pc); ctx.stroke();
        }
        for (const [mx, my, L] of masts) {
          const [bx, by] = P(mx, my, z), [tx, ty] = P(mx, my, z + L);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + SX * L * 0.5, by + SY * L * 0.5); ctx.stroke();
          ctx.strokeStyle = 'rgb(150,152,158)';
          ctx.lineWidth = L > 60 ? 1.6 : 1;
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
          // cross arms
          ctx.lineWidth = 0.8;
          for (let k = 0.5; k < 1; k += 0.2) {
            const [ax, ay] = P(mx, my, z + L * k);
            ctx.beginPath(); ctx.moveTo(ax - 3, ay + 1); ctx.lineTo(ax + 3, ay - 1); ctx.stroke();
          }
          if (rr() < 0.75) {
            ctx.fillStyle = '#ff6b6b';
            ctx.fillRect(tx - 1, ty - 1, 2.4, 2.4);
            e.fillStyle = rgba(C.red);
            e.beginPath(); e.arc(tx, ty, 2.8, 0, TAU); e.fill();
          }
        }
        light(e, ...P((x0 + x1) / 2, (y0 + y1) / 2, z + 40), 70, C.red, 0.18);
      },
    };
    objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
  }

  // SILENT WARD — cross-shaped hospital, every light on
  {
    const { x, y } = HOSP;
    const a = 37, L1 = 132, L2 = 116;
    const poly = cw([
      [x - a, y - L2], [x + a, y - L2], [x + a, y - a], [x + L1, y - a], [x + L1, y + a], [x + a, y + a],
      [x + a, y + L2], [x - a, y + L2], [x - a, y + a], [x - L1, y + a], [x - L1, y - a], [x - a, y - a],
    ]);
    const h = 78;
    addShadow(poly, h);
    const b = {
      poly, h, rnd: rand(707), facade: [62, 66, 70], roof: [70, 73, 76],
      win: { floorH: 9, spacing: 5.5, rate: 0.7, rowBias: 0, list: WIN.cold, fill: 0.62, glow: 0.5 },
      roofFn: () => {
        const [px, py] = P(x, y, h);
        ctx.fillStyle = 'rgb(34,36,38)';
        ctx.beginPath(); ctx.arc(px, py, 26, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(220,225,230,0.55)';
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(px, py, 21, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2;
        ctx.strokeRect(px - 7, py - 7, 14, 14);
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * TAU;
          const lx = px + Math.cos(ang) * 26, ly = py + Math.sin(ang) * 26;
          ctx.fillStyle = 'rgb(200,240,235)';
          ctx.fillRect(lx - 1, ly - 1, 2, 2);
          e.fillStyle = rgba(C.teal, 0.9);
          e.fillRect(lx - 1.2, ly - 1.2, 2.4, 2.4);
        }
        for (const [dx, dy] of [[-96, -6], [96, 6], [-8, -90], [10, 88]]) miniBox(x + dx, y + dy, 18, 12, h, 6, [80, 82, 86]);
        for (const [dx, dy] of [[-110, -20], [112, 20], [-20, 100]]) antenna(x + dx, y + dy, h, 18, true);
        light(e, px, py, 140, [150, 210, 220], 0.08);
      },
    };
    objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
    // annex wings
    for (const [ax0, ay0, ax1, ay1, hh] of [[1340, 1272, 1410, 1330, 38], [1530, 1500, 1600, 1556, 34], [1580, 1400, 1638, 1470, 30]]) {
      const p2 = rectPoly(ax0, ay0, ax1, ay1);
      addShadow(p2, hh);
      const b2 = { poly: p2, h: hh, rnd: rand(ax0), facade: [56, 60, 64], roof: [64, 66, 70], win: { floorH: 9, spacing: 6, rate: 0.5, rowBias: 0, list: WIN.cold, fill: 0.6, glow: 0.45 }, roofFn: genericRoof, kind: 'flat' };
      objects.push({ key: Math.min(...p2.map((p) => depthOf(...p))), draw: () => drawBox(b2) });
    }
    // vans in the bays (white, red stripe — no emblem)
    for (let i = 0; i < 5; i++) {
      const vx = 1342 + i * 16, vy = 1508;
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(vx - 5, vy - 2, 11, 20);
      ctx.fillStyle = 'rgb(150,152,150)'; ctx.fillRect(vx - 4, vy, 9, 18);
      ctx.fillStyle = 'rgb(150,30,34)'; ctx.fillRect(vx - 4, vy + 8, 9, 1.6);
    }
    light(ctx, x, y + 140, 160, [140, 200, 210], 0.07);
  }

  // SHOPPING DISTRICT — glass-roofed arcades along diagonal B
  {
    const arc = (a0, a1, p, w, h) => {
      const c = AP((a0 + a1) / 2, p);
      return { poly: rotRect(c[0], c[1], a1 - a0, w, bdx, bdy), h, along: true };
    };
    const cross = (p0, p1, a, w, h) => {
      const c = AP(a, (p0 + p1) / 2);
      return { poly: rotRect(c[0], c[1], p1 - p0, w, bnx, bny), h, along: false };
    };
    const pieces = [
      arc(770, 1095, 112, 34, 44), cross(40, 196, 932, 34, 44),
      arc(800, 900, 58, 22, 34), arc(965, 1070, 60, 22, 32), arc(790, 895, 168, 24, 36), arc(970, 1080, 170, 22, 30),
    ];
    for (const pc of pieces) {
      addShadow(pc.poly, pc.h);
      const b = {
        poly: pc.poly, h: pc.h, rnd: rand(Math.floor(pc.poly[0][0])), facade: [50, 50, 54], roof: [44, 54, 60], noParapet: true,
        win: { floorH: 11, spacing: 7, rate: 0.12, rowBias: 0.2, list: [[C.amber, 5], [C.white, 2], [C.red, 1]], fill: 0.7 },
        roofFn: (bb) => glassRoof(bb, pc.along),
      };
      objects.push({ key: Math.min(...pc.poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
    }
    // rotunda dome at the crossing of the two main galleries
    const c = AP(932, 112);
    objects.push({
      key: depthOf(c[0] - 34, c[1] + 34),
      draw: () => {
        const z = 46;
        const [dx, dy] = P(c[0], c[1], z);
        const g = ctx.createRadialGradient(dx + 8, dy + 6, 2, dx, dy, 34);
        g.addColorStop(0, 'rgba(150,175,185,0.9)');
        g.addColorStop(0.5, 'rgba(56,72,80,0.95)');
        g.addColorStop(1, 'rgba(26,32,36,1)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(dx, dy, 34, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(10,12,14,0.7)';
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(a) * 34, dy + Math.sin(a) * 34); ctx.stroke();
        }
        for (const r of [12, 22, 30]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, TAU); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(190,200,205,0.5)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(dx, dy, 34, 0, TAU); ctx.stroke();
        light(ctx, dx, dy, 40, C.amber, 0.18);
        light(e, dx, dy, 26, C.amber, 0.25);
      },
    });
    sh.beginPath(); sh.arc(c[0] + SX * 46, c[1] + SY * 46, 34, 0, TAU); sh.fill();
  }
  function glassRoof(b, along) {
    const z = b.h;
    const poly = b.poly;
    ctx.save();
    path(ctx, poly, z);
    ctx.clip();
    const bb = bbox(poly);
    const [gx0, gy0] = P(bb.x0, bb.y0, z), [gx1, gy1] = P(bb.x1, bb.y1, z);
    // barrel-vault shading across the width
    const ux = along ? bnx : bdx, uy = along ? bny : bdy;
    const mid = [(gx0 + gx1) / 2, (gy0 + gy1) / 2];
    const g = ctx.createLinearGradient(mid[0] - ux * 18, mid[1] - uy * 18, mid[0] + ux * 18, mid[1] + uy * 18);
    g.addColorStop(0, 'rgba(20,26,30,1)');
    g.addColorStop(0.45, 'rgba(110,130,140,0.9)');
    g.addColorStop(0.55, 'rgba(70,88,96,0.95)');
    g.addColorStop(1, 'rgba(16,20,24,1)');
    ctx.fillStyle = g;
    ctx.fillRect(gx0 - 50, gy0 - 50, gx1 - gx0 + 100, gy1 - gy0 + 100);
    // warm interior leaking through
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,140,60,0.06)';
    ctx.fillRect(gx0 - 50, gy0 - 50, gx1 - gx0 + 100, gy1 - gy0 + 100);
    ctx.globalCompositeOperation = 'source-over';
    // ribs
    const vx = along ? bdx : bnx, vy = along ? bdy : bny;
    ctx.strokeStyle = 'rgba(8,10,12,0.75)';
    ctx.lineWidth = 1;
    const span = Math.hypot(bb.w, bb.h);
    for (let s = -span; s < span; s += 5) {
      const cx = mid[0] + vx * s, cy = mid[1] + vy * s;
      ctx.beginPath(); ctx.moveTo(cx - ux * 30, cy - uy * 30); ctx.lineTo(cx + ux * 30, cy + uy * 30); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180,195,200,0.35)';
    ctx.beginPath(); ctx.moveTo(mid[0] - vx * span, mid[1] - vy * span); ctx.lineTo(mid[0] + vx * span, mid[1] + vy * span); ctx.stroke();
    // broken panes
    const rr = b.rnd;
    for (let k = 0; k < 6; k++) {
      const s = (rr() - 0.5) * span * 0.8, o = (rr() - 0.5) * 12;
      const cx = mid[0] + vx * s + ux * o, cy = mid[1] + vy * s + uy * o;
      ctx.fillStyle = 'rgba(4,4,5,0.95)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + vx * 5, cy + vy * 5); ctx.lineTo(cx + vx * 3 + ux * 4, cy + vy * 3 + uy * 4); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(150,160,165,0.5)';
    ctx.lineWidth = 0.9;
    path(ctx, poly, z);
    ctx.stroke();
  }

  // FERRIS WHEEL + fairground rides
  {
    const { x: bx, y: by, R: WR } = WHEEL;
    const KYW = 0.64; // the wheel is drawn a little more frontal than the city so it reads at a glance
    const zc = WR + 14;
    const PW = (x, y, z) => [x + z * KX, y - z * KYW];
    // ground shadow of the wheel (rim + spokes)
    sh.lineWidth = 2.2;
    const rimS = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * TAU;
      const z = zc + Math.sin(a) * WR;
      rimS.push([bx + Math.cos(a) * WR + SX * z, by + SY * z]);
    }
    sh.beginPath(); rimS.forEach((p, i) => (i ? sh.lineTo(...p) : sh.moveTo(...p))); sh.stroke();
    sh.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      sh.beginPath(); sh.moveTo(bx + SX * zc, by + SY * zc);
      sh.lineTo(bx + Math.cos(a) * WR + SX * (zc + Math.sin(a) * WR), by + SY * (zc + Math.sin(a) * WR)); sh.stroke();
    }
    sh.lineWidth = 4;
    for (const s of [-1, 1]) { sh.beginPath(); sh.moveTo(bx + s * 46, by); sh.lineTo(bx + SX * zc, by + SY * zc); sh.stroke(); }

    objects.push({
      key: depthOf(bx - WR, by + 10),
      draw: () => {
        // A-frame legs (back pair)
        const hub = PW(bx, by, zc);
        const leg = (dx, dy, w, col) => {
          ctx.strokeStyle = col; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(...PW(bx + dx, by + dy, 0)); ctx.lineTo(hub[0], hub[1] + (dy < 0 ? -2 : 2)); ctx.stroke();
        };
        leg(-50, -8, 3, 'rgb(60,62,66)'); leg(50, -8, 3, 'rgb(60,62,66)');
        const rim = (dy, col, w) => {
          ctx.strokeStyle = col; ctx.lineWidth = w;
          ctx.beginPath();
          for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * TAU;
            const [sx, sy] = PW(bx + Math.cos(a) * WR, by + dy, zc + Math.sin(a) * WR);
            if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
          }
          ctx.stroke();
        };
        rim(-7, 'rgb(64,66,70)', 2.2);
        // spokes
        ctx.strokeStyle = 'rgba(120,124,130,0.75)';
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 32; i++) {
          const a = (i / 32) * TAU;
          const [sx, sy] = PW(bx + Math.cos(a) * WR, by, zc + Math.sin(a) * WR);
          ctx.beginPath(); ctx.moveTo(...hub); ctx.lineTo(sx, sy); ctx.stroke();
        }
        rim(0, 'rgb(150,154,160)', 2.6);
        rim(0, 'rgba(0,0,0,0.35)', 0.8);
        // inner ring
        ctx.strokeStyle = 'rgb(110,114,120)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * TAU;
          const [sx, sy] = PW(bx + Math.cos(a) * WR * 0.35, by, zc + Math.sin(a) * WR * 0.35);
          if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
        }
        ctx.stroke();
        // gondolas + rim lights
        const rr = rand(808);
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU + 0.1;
          const [gx, gy] = PW(bx + Math.cos(a) * WR, by + 3, zc + Math.sin(a) * WR);
          const lit = rr() < 0.45;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(gx - 4, gy + 1, 9, 9);
          ctx.fillStyle = lit ? 'rgb(120,40,40)' : 'rgb(52,54,58)';
          ctx.fillRect(gx - 4.5, gy, 9, 8);
          ctx.fillStyle = 'rgba(200,205,210,0.35)';
          ctx.fillRect(gx - 4.5, gy, 9, 1.3);
          if (lit) {
            const col = rr() < 0.7 ? C.red : C.amber;
            ctx.fillStyle = rgba(col, 0.95);
            ctx.fillRect(gx - 3, gy + 2.5, 6, 3);
            e.fillStyle = rgba(col, 0.9);
            e.fillRect(gx - 4, gy + 1.5, 8, 5);
          }
        }
        for (let i = 0; i < 72; i++) {
          const a = (i / 72) * TAU;
          if (rr() < 0.25) continue;
          const [lx, ly] = PW(bx + Math.cos(a) * WR, by + 1, zc + Math.sin(a) * WR);
          ctx.fillStyle = 'rgb(255,120,120)';
          ctx.fillRect(lx - 0.8, ly - 0.8, 1.6, 1.6);
          e.fillStyle = rgba(C.red, 0.95);
          e.beginPath(); e.arc(lx, ly, 1.8, 0, TAU); e.fill();
        }
        // hub
        ctx.fillStyle = 'rgb(130,134,140)';
        ctx.beginPath(); ctx.arc(hub[0], hub[1], 6, 0, TAU); ctx.fill();
        e.fillStyle = rgba(C.red);
        e.beginPath(); e.arc(hub[0], hub[1], 3, 0, TAU); e.fill();
        // front legs
        leg(-46, 8, 3.4, 'rgb(96,98,104)'); leg(46, 8, 3.4, 'rgb(96,98,104)');
        // boarding platform
        miniBox(bx, by + 12, 40, 12, 0, 6, [70, 70, 74]);
        light(ctx, hub[0], hub[1] + 20, 150, [200, 30, 40], 0.12);
        light(e, hub[0], hub[1], 120, [255, 40, 50], 0.1);
      },
    });
    // carousel
    const cx0 = 1222, cy0 = 1072;
    sh.beginPath(); sh.arc(cx0 + SX * 16, cy0 + SY * 16, 26, 0, TAU); sh.fill();
    objects.push({
      key: depthOf(cx0 - 26, cy0 + 26),
      draw: () => {
        const z = 16;
        const [x, y] = P(cx0, cy0, z);
        ctx.fillStyle = 'rgb(40,40,42)';
        ctx.beginPath(); ctx.ellipse(cx0 + 0.5, cy0 - 1, 26, 26, 0, 0, Math.PI); ctx.lineTo(x - 26, y); ctx.fill();
        for (let i = 0; i < 16; i++) {
          const a0 = (i / 16) * TAU, a1 = ((i + 1) / 16) * TAU;
          ctx.fillStyle = i % 2 ? 'rgb(110,34,38)' : 'rgb(120,116,110)';
          ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, 26, a0, a1); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.arc(x, y, 26, Math.PI * 1.1, Math.PI * 1.9); ctx.lineTo(x, y); ctx.fill();
        ctx.fillStyle = 'rgb(150,140,120)';
        ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          if (i % 3 === 0) continue;
          const lx = x + Math.cos(a) * 26, ly = y + Math.sin(a) * 26;
          e.fillStyle = rgba(C.amber, 0.9);
          e.beginPath(); e.arc(lx, ly, 1.5, 0, TAU); e.fill();
        }
        light(ctx, x, y, 60, C.amber, 0.1);
      },
    });
    // coaster track
    const track = sampleSpline([[1424, 932], [1490, 900], [1530, 940], [1528, 1010], [1500, 1070], [1528, 1122], [1470, 1140], [1416, 1110], [1440, 1050], [1400, 1000], [1424, 932]], 10);
    const tz = (i) => 14 + 12 * Math.sin(i * 0.11) + 8 * Math.sin(i * 0.037);
    sh.lineWidth = 3;
    sh.beginPath(); track.forEach((p, i) => { const z = tz(i); (i ? sh.lineTo : sh.moveTo).call(sh, p[0] + SX * z, p[1] + SY * z); }); sh.stroke();
    objects.push({
      key: depthOf(1400, 1140),
      draw: () => {
        ctx.strokeStyle = 'rgba(70,72,76,0.8)';
        ctx.lineWidth = 0.8;
        track.forEach((p, i) => {
          if (i % 3) return;
          const z = tz(i);
          ctx.beginPath(); ctx.moveTo(...P(p[0], p[1], 0)); ctx.lineTo(...P(p[0], p[1], z)); ctx.stroke();
        });
        for (const [off, col] of [[-2, 'rgb(130,40,44)'], [2, 'rgb(150,150,155)']]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.2;
          const L = offsetLine(track, off);
          ctx.beginPath();
          L.forEach((p, i) => { const [sx, sy] = P(p[0], p[1], tz(i)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
          ctx.stroke();
        }
      },
    });
    // stalls
    for (const [sx, sy, rot] of [[1250, 1130, 0.3], [1290, 1140, 0.1], [1410, 1150, -0.1], [1460, 960, 1.4], [1200, 1000, 0.9], [1360, 1120, 0]]) {
      const poly = rotRect(sx, sy, 16, 10, Math.cos(rot), Math.sin(rot));
      addShadow(poly, 8);
      const b = {
        poly, h: 8, rnd: rand(sx), facade: [60, 54, 50], roof: [96, 40, 42], noParapet: true,
        roofFn: (bb) => {
          ctx.save(); path(ctx, bb.poly, 8); ctx.clip();
          ctx.strokeStyle = 'rgba(200,190,180,0.4)'; ctx.lineWidth = 1.5;
          const bx2 = bbox(bb.poly);
          for (let x = bx2.x0 - 10; x < bx2.x1 + 10; x += 4) { ctx.beginPath(); ctx.moveTo(...P(x, bx2.y0 - 5, 8)); ctx.lineTo(...P(x + 6, bx2.y1 + 5, 8)); ctx.stroke(); }
          ctx.restore();
          if (bb.rnd() < 0.5) { const [lx, ly] = P(sx, sy, 9); e.fillStyle = rgba(C.amber, 0.7); e.fillRect(lx - 3, ly - 1, 6, 2); }
        },
      };
      objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
    }
  }

  // THE VAULT — crater of a collapsed tower
  {
    const { x, y } = VAULT;
    const rr = rand(606);
    // crater pit with terraces
    for (let k = 0; k < 7; k++) {
      const s = 1 - k * 0.12;
      const rX = 112 * s, rY = 98 * s;
      const v = 30 - k * 3.8;
      ctx.fillStyle = `rgb(${v},${v - 2},${v - 3})`;
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * TAU;
        const j = 1 + (rr() - 0.5) * 0.12;
        const px = x + Math.cos(a) * rX * j - k * 2, py = y + Math.sin(a) * rY * j + k * 5;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      // lit north inner wall (faces the SE light and the camera)
      ctx.strokeStyle = `rgba(110,100,92,${0.18 - k * 0.02})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x - k * 2, y + k * 5, rX * 0.98, rY * 0.98, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    }
    ctx.fillStyle = 'rgb(4,4,5)';
    ctx.beginPath(); ctx.ellipse(x - 14, y + 36, 34, 22, 0, 0, TAU); ctx.fill();
    // exposed vault block deep in the pit
    const vx = x - 14, vy = y + 36;
    const poly = rectPoly(vx - 16, vy - 12, vx + 16, vy + 12);
    drawBox({ poly, h: 12, facade: [70, 68, 66], roof: [84, 82, 80], rnd: rr, noParapet: false });
    const [dx, dy] = P(vx, vy, 12);
    ctx.fillStyle = 'rgb(40,40,42)';
    ctx.beginPath(); ctx.arc(dx, dy, 7, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgb(150,150,150)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = rgba(C.red);
    ctx.fillRect(dx + 9, dy - 2, 2, 2);
    e.fillStyle = rgba(C.red);
    e.beginPath(); e.arc(dx + 10, dy - 1, 2.6, 0, TAU); e.fill();
    light(ctx, dx, dy, 50, C.red, 0.22);
    // rubble ring
    for (let i = 0; i < 1500; i++) {
      const a = rr() * TAU, d = 0.82 + Math.pow(rr(), 1.6) * 0.7;
      const px = x + Math.cos(a) * 112 * d, py = y + Math.sin(a) * 98 * d;
      const s = 1 + rr() * 5 * (1.4 - d * 0.5);
      const v = 38 + rr() * 52;
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 7})`;
      ctx.save(); ctx.translate(px, py); ctx.rotate(rr() * TAU);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(-s / 2 - 1.2, -s / 2 - 1, s, s * 0.7);
      ctx.fillStyle = `rgb(${v},${v - 3},${v - 7})`;
      ctx.fillRect(-s / 2, -s / 2, s, s * 0.7);
      ctx.restore();
    }
    // rebar
    ctx.strokeStyle = 'rgba(110,70,50,0.6)';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 50; i++) {
      const a = rr() * TAU, d = 0.85 + rr() * 0.3;
      const px = x + Math.cos(a) * 112 * d, py = y + Math.sin(a) * 98 * d;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rr() - 0.5) * 14, py + (rr() - 0.5) * 14); ctx.stroke();
    }
    // the fallen tower lying toward the north-west, broken in segments
    const ux = -0.76, uy = -0.65;
    const segs = [[40, 64], [70, 116], [122, 176], [184, 236]];
    for (const [s0, s1] of segs) {
      const t = (s0 + s1) / 2;
      const cxs = 200 + ux * (t - 30), cys = 740 + uy * (t - 30);
      const rot = (rr() - 0.5) * 0.12;
      const c2 = Math.cos(Math.atan2(uy, ux) + rot), s2 = Math.sin(Math.atan2(uy, ux) + rot);
      const p = rotRect(cxs, cys, s1 - s0, 50, c2, s2);
      addShadow(p, 30);
      objects.push({
        key: Math.min(...p.map((q) => depthOf(...q))),
        draw: () => {
          drawBox({ poly: p, h: 30, facade: [46, 48, 52], roof: [50, 53, 57], rnd: rr, noParapet: true, win: { floorH: 8, spacing: 6, rate: 0, rowBias: 0, list: WIN.warm } });
          // window grid on the exposed facade (now facing the sky)
          ctx.save();
          path(ctx, p, 30);
          ctx.clip();
          ctx.fillStyle = 'rgba(8,9,10,0.75)';
          for (let a = -(s1 - s0) / 2 + 3; a < (s1 - s0) / 2 - 2; a += 6) {
            for (let b = -22; b < 22; b += 5.5) {
              const wxp = cxs + c2 * a - s2 * b, wyp = cys + s2 * a + c2 * b;
              const [sx, sy] = P(wxp, wyp, 30);
              if (rr() < 0.85) ctx.fillRect(sx - 1.4, sy - 1.2, 2.8, 2.2);
            }
          }
          ctx.restore();
        },
      });
    }
    // dust/rubble spill along the avenue
    for (let i = 0; i < 600; i++) {
      const t = rr() * 300;
      const px = 230 + ux * t + (rr() - 0.5) * 120, py = 760 + uy * t + (rr() - 0.5) * 120;
      const v = 40 + rr() * 40;
      ctx.fillStyle = `rgba(${v},${v - 2},${v - 6},0.8)`;
      ctx.fillRect(px, py, 1 + rr() * 3, 1 + rr() * 2);
    }
  }

  // SIGNAL STATION
  {
    const { x, y } = SIGNAL;
    const top = 270;
    // guy wire + tower shadow
    sh.lineWidth = 3;
    for (const [lx, ly] of [[-30, 20], [30, 20], [0, -34]]) { sh.beginPath(); sh.moveTo(x + lx, y + ly); sh.lineTo(x + SX * top, y + SY * top); sh.stroke(); }
    objects.push({
      key: depthOf(x - 40, y + 40),
      draw: () => {
        // bunkers + dishes
        for (const [dx, dy, w, d, hh] of [[-54, 28, 30, 20, 12], [44, -40, 26, 18, 10], [-50, -46, 18, 14, 8]]) miniBox(x + dx, y + dy, w, d, 0, hh, [70, 70, 72]);
        for (const [dx, dy, r] of [[50, 30, 14], [64, 0, 10], [-20, -60, 9]]) {
          const [cx, cy] = P(x + dx, y + dy, 8);
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.beginPath(); ctx.ellipse(cx - 7, cy - 4, r, r * 0.7, -0.5, 0, TAU); ctx.fill();
          const g = ctx.createRadialGradient(cx + r * 0.3, cy + r * 0.3, 0, cx, cy, r);
          g.addColorStop(0, 'rgb(190,192,196)');
          g.addColorStop(1, 'rgb(70,72,76)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.78, -0.5, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(30,30,30,0.8)';
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.9, cy - r); ctx.stroke();
        }
        // lattice tower: three legs converging
        const legs = [[-26, 18], [26, 18], [0, -28]];
        const lvl = (t) => legs.map(([lx, ly]) => P(x + lx * (1 - t * 0.88), y + ly * (1 - t * 0.88), t * top));
        ctx.strokeStyle = 'rgb(130,134,140)';
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          for (let t = 0; t <= 1.0001; t += 0.05) { const p = lvl(t)[i]; t ? ctx.lineTo(...p) : ctx.moveTo(...p); }
          ctx.stroke();
        }
        ctx.lineWidth = 0.7;
        ctx.strokeStyle = 'rgba(140,144,150,0.75)';
        for (let t = 0; t < 1; t += 0.05) {
          const a = lvl(t), b = lvl(t + 0.05);
          for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            ctx.beginPath(); ctx.moveTo(...a[i]); ctx.lineTo(...b[j]); ctx.moveTo(...a[j]); ctx.lineTo(...b[i]); ctx.moveTo(...a[i]); ctx.lineTo(...a[j]); ctx.stroke();
          }
        }
        // guy wires
        ctx.strokeStyle = 'rgba(160,165,170,0.35)';
        ctx.lineWidth = 0.6;
        const tp = P(x, y, top * 0.8);
        for (const [gx, gy] of [[-70, 60], [80, 50], [10, -90]]) { ctx.beginPath(); ctx.moveTo(...P(x + gx, y + gy, 0)); ctx.lineTo(...tp); ctx.stroke(); }
        // beacons along the mast
        for (const t of [0.35, 0.65, 1]) {
          const [bx, by] = P(x, y, top * t);
          ctx.fillStyle = '#ff8080';
          ctx.fillRect(bx - 1.5, by - 1.5, 3, 3);
          e.fillStyle = rgba(C.red);
          e.beginPath(); e.arc(bx, by, t === 1 ? 5 : 3, 0, TAU); e.fill();
          if (t === 1) light(e, bx, by, 60, C.red, 0.6);
        }
        // red reflection on the sea below the cliff
        light(ctx, x + 120, y + 30, 120, C.red, 0.08);
      },
    });
    // a cold floodlight on the pad
    light(ctx, x - 10, y + 20, 70, [180, 200, 220], 0.08);
  }

  // UNDERGROUND — metro entrances + abandoned train
  {
    for (const [dx, dy, rot] of [[-100, -66, 0], [92, -60, 0], [-96, 62, 0], [104, 70, 0]]) {
      const ex = METRO.x + dx, ey = METRO.y + dy;
      const poly = rotRect(ex, ey, 26, 13, Math.cos(rot), Math.sin(rot));
      addShadow(poly, 9);
      const b = {
        poly, h: 9, rnd: rand(ex), facade: [60, 64, 68], roof: [80, 96, 104], noParapet: true,
        roofFn: () => {
          const [px, py] = P(ex, ey, 9);
          ctx.fillStyle = 'rgba(160,190,200,0.25)';
          ctx.fillRect(px - 12, py - 5, 24, 10);
          ctx.strokeStyle = 'rgba(10,10,12,0.6)';
          ctx.lineWidth = 0.8;
          for (let k = -10; k < 12; k += 3) { ctx.beginPath(); ctx.moveTo(px + k, py - 5); ctx.lineTo(px + k, py + 5); ctx.stroke(); }
          e.fillStyle = rgba(C.red, 0.9);
          e.fillRect(px - 13, py + 5, 26, 1.6);
        },
      };
      objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
      // stair mouth glow
      light(ctx, ex, ey + 10, 30, C.red, 0.18);
    }
    // signage pylon in the center
    const pp = rectPoly(METRO.x - 3, METRO.y - 3, METRO.x + 3, METRO.y + 3);
    addShadow(pp, 30);
    objects.push({ key: depthOf(METRO.x - 3, METRO.y + 3), draw: () => {
      drawBox({ poly: pp, h: 30, facade: [70, 72, 76], roof: [90, 92, 96], rnd: R, noParapet: true });
      const [tx, ty] = P(METRO.x, METRO.y, 30);
      e.fillStyle = rgba(C.red); e.beginPath(); e.arc(tx, ty, 3.5, 0, TAU); e.fill();
      ctx.fillStyle = '#ff9a9a'; ctx.fillRect(tx - 1.5, ty - 1.5, 3, 3);
    } });
    // platform canopy along the tracks + train
    const cp = rectPoly(300, 2016, 560, 2028);
    addShadow(cp, 14);
    objects.push({ key: Math.min(...cp.map((p) => depthOf(...p))), draw: () => drawBox({ poly: cp, h: 14, facade: [60, 62, 66], roof: [66, 70, 74], rnd: R, noParapet: true, roofFn: (b) => {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.8;
      for (let x2 = 302; x2 < 560; x2 += 6) { ctx.beginPath(); ctx.moveTo(...P(x2, 2016, 14)); ctx.lineTo(...P(x2, 2028, 14)); ctx.stroke(); }
      for (let x2 = 320; x2 < 560; x2 += 40) { const [lx, ly] = P(x2, 2030, 12); e.fillStyle = rgba(b.rnd() < 0.5 ? C.amber : C.cold, 0.8); e.fillRect(lx - 2, ly, 4, 1.4); }
    } }) });
    for (let k = 0; k < 4; k++) {
      const x0 = 40 + k * 70;
      const tp = rectPoly(x0, 2036, x0 + 64, 2050);
      addShadow(tp, 10);
      const bk = { poly: tp, h: 10, rnd: rand(x0), facade: [70, 72, 76], roof: [84, 86, 90], noParapet: true, win: { floorH: 10, spacing: 5, rate: k === 2 ? 0.4 : 0.05, rowBias: 0, list: WIN.warm, fill: 0.6 }, roofFn: () => {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        for (let x2 = x0 + 6; x2 < x0 + 60; x2 += 14) { const [px, py] = P(x2, 2040, 10); ctx.fillRect(px, py, 6, 5); }
      } };
      objects.push({ key: Math.min(...tp.map((p) => depthOf(...p))), draw: () => drawBox(bk) });
    }
  }

  // HARBOUR — container yard + cranes
  {
    const COLS = [[96, 42, 32], [44, 70, 76], [74, 76, 80], [110, 28, 32], [34, 44, 62], [92, 84, 70]];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 7; col++) {
        if (R.chance(0.15)) continue;
        const x0 = 1578 + col * 31, y0 = 882 + row * 25;
        const poly = rectPoly(x0, y0, x0 + 28, y0 + 11);
        const stack = R.int(1, 3);
        const hh = stack * 8;
        addShadow(poly, hh);
        const c = R.pick(COLS);
        const b = { poly, h: hh, rnd: rand(x0 + y0), facade: shade(c, 0.85), roof: c, noParapet: true, roofFn: () => {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.6;
          for (let x2 = x0 + 2; x2 < x0 + 28; x2 += 2.5) { ctx.beginPath(); ctx.moveTo(...P(x2, y0, hh)); ctx.lineTo(...P(x2, y0 + 11, hh)); ctx.stroke(); }
        } };
        objects.push({ key: Math.min(...poly.map((p) => depthOf(...p))), draw: () => drawBox(b) });
      }
    }
    // gantry cranes on the quay with booms over the water
    for (const cx of [1640, 1730]) {
      const cy = 852;
      sh.lineWidth = 4;
      sh.beginPath(); sh.moveTo(cx + SX * 60, cy + SY * 60); sh.lineTo(cx + SX * 60, cy - 110 + SY * 60); sh.stroke();
      objects.push({ key: depthOf(cx - 10, cy + 12), draw: () => {
        for (const [lx, ly] of [[-10, -6], [10, -6], [-10, 8], [10, 8]]) {
          ctx.strokeStyle = 'rgb(120,60,40)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(...P(cx + lx, cy + ly, 0)); ctx.lineTo(...P(cx + lx, cy + ly, 56)); ctx.stroke();
        }
        const boom = rectPoly(cx - 4, cy - 110, cx + 4, cy + 24);
        drawBox({ poly: boom, h: 62, z0: 56, facade: [120, 58, 40], roof: [150, 74, 50], rnd: R, noParapet: true });
        const [lx, ly] = P(cx, cy - 108, 63);
        e.fillStyle = rgba(C.red); e.beginPath(); e.arc(lx, ly, 2.4, 0, TAU); e.fill();
      } });
    }
  }

  /* ----- composite the landmark shadows (second pass) */
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(blurred(SH.c, 2), 0, 0);
  ctx.restore();

  /* ----- draw all objects far → near */
  objects.sort((a, b) => b.key - a.key);
  for (const o of objects) o.draw();

  /* ----- bridges over the river (above water, below nothing tall) */
  {
    const bridges = [];
    for (let i = 0; i < xs.length; i++) {
      const x = xs[i];
      if (x < 0 || x > 1500 || R.chance(0.35)) continue;
      const hit = distToPolyline(x, river.find((p) => p[0] >= x)?.[1] ?? 0, river);
      bridges.push({ x, y: hit.y, w: wx[i] + 8, broken: R.chance(0.15) && x !== CX });
    }
    for (const br of bridges) {
      const hw = riverHW(br.x) + 14;
      const y0 = br.y - hw, y1 = br.y + hw;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(br.x - br.w / 2 - 8, y0 + 4, br.w, y1 - y0);
      const z = 6;
      const [bx, by] = P(br.x - br.w / 2, y0, z);
      ctx.fillStyle = 'rgb(40,40,42)';
      ctx.fillRect(bx, by + 2, br.w, y1 - y0);
      ctx.fillStyle = 'rgb(24,25,27)';
      ctx.fillRect(bx + 2, by, br.w - 4, y1 - y0);
      ctx.fillStyle = 'rgba(160,160,160,0.4)';
      ctx.fillRect(bx + 1, by, 1, y1 - y0);
      ctx.fillRect(bx + br.w - 2, by, 1, y1 - y0);
      if (br.broken) {
        ctx.fillStyle = rgba(C.water);
        ctx.fillRect(bx - 2, by + (y1 - y0) * 0.42, br.w + 4, (y1 - y0) * 0.18);
        for (let k = 0; k < 20; k++) {
          const v = 40 + R() * 40;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(bx + R() * br.w, by + (y1 - y0) * (0.4 + R() * 0.22), 1 + R() * 3, 1 + R() * 2);
        }
      } else {
        for (let k = 0; k < 2; k++) {
          const ly = by + 6 + k * (y1 - y0 - 12);
          if (R.chance(0.5)) { e.fillStyle = rgba(C.amber, 0.9); e.fillRect(bx, ly, 2, 2); e.fillRect(bx + br.w - 2, ly + 4, 2, 2); }
        }
      }
    }
    // diagonal B bridge
    const p = [415, 975];
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.rotate(Math.atan2(bdy, bdx));
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-70, -26, 140, 54);
    ctx.fillStyle = 'rgb(40,40,42)';
    ctx.fillRect(-66, -24, 132, 50);
    ctx.fillStyle = 'rgb(24,25,27)';
    ctx.fillRect(-66, -22, 132, 44);
    ctx.fillStyle = 'rgba(160,160,160,0.4)';
    ctx.fillRect(-66, -23, 132, 1);
    ctx.fillRect(-66, 22, 132, 1);
    ctx.restore();
  }

  /* ================================================================ LIGHT + ATMOSPHERE */
  // light reflections on the river from lamps on its banks
  {
    const wetMask = layer(W, H);
    wetMask.ctx.fillStyle = '#fff';
    path(wetMask.ctx, ribbon(river, (p) => riverHW(p[0]) * 2));
    wetMask.ctx.fill();
    path(wetMask.ctx, seaPoly);
    wetMask.ctx.fill();
    const refl = layer(W, H);
    for (const [x, y, col] of lamps) {
      const d = distToPolyline(x, y, river).d;
      if (d > riverHW(x) + 60) continue;
      light(refl.ctx, x, y + 30, 26, col, 0.4, 3.2);
    }
    light(refl.ctx, SIGNAL.x + 160, SIGNAL.y + 60, 120, C.red, 0.15, 2);
    refl.ctx.globalCompositeOperation = 'destination-in';
    refl.ctx.drawImage(wetMask.c, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(refl.c, 0, 0);
    ctx.restore();
  }

  // emissive + bloom
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55;
  ctx.drawImage(E.c, 0, 0);
  ctx.restore();
  bloom(ctx, E.c, W, H, [{ r: 2.5, a: 0.75 }, { r: 9, a: 0.6 }, { r: 30, a: 0.5 }, { r: 90, a: 0.4 }]);

  // atmospheric colour washes
  {
    light(ctx, CX, CY, 520, [150, 10, 22], 0.22);
    light(ctx, ARENA.x + 40, ARENA.y - 40, 260, [120, 140, 170], 0.06);
    light(ctx, HOSP.x, HOSP.y, 260, [90, 150, 160], 0.06);
    light(ctx, SPIRE.x + 50, SPIRE.y - 150, 260, [180, 20, 30], 0.12);
    light(ctx, WHEEL.x, WHEEL.y - 80, 240, [170, 20, 30], 0.1);
    light(ctx, IC.x, IC.y - 120, 160, [170, 20, 30], 0.08);
  }

  // fog banks
  {
    const fog = noiseLayer(W, H, { seed: 121, scale: 0.0026, octaves: 5, step: 4, lo: 0.46, hi: 0.86, color: [120, 128, 134], alpha: 0.26, warp: 140 });
    ctx.drawImage(fog, 0, 0);
    // low cloud drifting over the outskirts (thicker toward the edges, clear over the centre)
    const cloud = noiseLayer(W, H, {
      seed: 123, scale: 0.0018, octaves: 6, step: 4, lo: 0.42, hi: 0.8, color: [96, 104, 110], alpha: 0.42, warp: 220,
      mask: (x, y) => smooth(0.2, 0.62, Math.hypot((x - W * 0.5) / W, (y - H * 0.52) / H) * 1.25),
    });
    ctx.drawImage(cloud, 0, 0);
    const fogR = noiseLayer(W, H, {
      seed: 122, scale: 0.004, octaves: 4, step: 4, lo: 0.45, hi: 0.85, color: [190, 40, 50], alpha: 0.2,
      mask: (x, y) => Math.max(Math.exp(-(((x - CX) / 380) ** 2 + ((y - CY) / 320) ** 2)), 0.7 * Math.exp(-(((x - WHEEL.x) / 220) ** 2 + ((y - WHEEL.y + 80) / 200) ** 2))),
    });
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(fogR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    // river mist
    const mist = layer(W, H);
    mist.ctx.strokeStyle = 'rgba(140,150,160,0.12)';
    mist.ctx.lineWidth = 70;
    strokeLine(mist.ctx, river);
    mist.ctx.stroke();
    ctx.drawImage(blurred(mist.c, 30, 0.25), 0, 0);
  }

  // faint rain
  rainLit(ctx, W, H, { count: 5200, seed: 131, angle: 0.18, len: [6, 18], width: 0.8, color: [200, 210, 220], alpha: 0.09 });
  particles(ctx, W, H, { count: 900, seed: 132, size: [0.6, 1.6], color: [255, 120, 110], alpha: 0.18, lum: (x, y) => Math.exp(-(((x - CX) / 300) ** 2 + ((y - CY) / 300) ** 2)) });

  /* ================================================================ GRADE + EDGES */
  const edgeFog = noiseField(W, H, { seed: 141, scale: 0.006, octaves: 4 });
  gradePixels(ctx, W, H, (r, g, b, o, idx) => {
    const x = idx % W, y = (idx / W) | 0;
    const l = r * 0.2126 + g * 0.7152 + b * 0.0722;
    const redness = clamp((r - Math.max(g, b)) * 3);
    const sat = lerp(0.72, 1.05, redness);
    r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
    // gentle contrast + teal-black shadows
    r = Math.pow(clamp(r), 1.06) * 1.02;
    g = Math.pow(clamp(g), 1.06) * 1.02 + 0.004;
    b = Math.pow(clamp(b), 1.06) * 1.02 + 0.008;
    // edges fade into fog then darkness
    const ex = Math.min(x, W - 1 - x) / W, ey = Math.min(y, H - 1 - y) / H;
    const n = edgeFog(x, y);
    const fx = smooth(0, 0.085 + n * 0.04, ex), fy = smooth(0, 0.05 + n * 0.035, ey);
    const f = fx * fy;
    const fogC = 0.04 + n * 0.03;
    const k = Math.pow(f, 0.8);
    r = lerp(fogC * 0.8, r, k); g = lerp(fogC * 0.85, g, k); b = lerp(fogC * 0.95, b, k);
    const dark = smooth(0, 0.025, Math.min(ex * 1.4, ey * 2));
    o[0] = r * (0.15 + 0.85 * dark); o[1] = g * (0.15 + 0.85 * dark); o[2] = b * (0.15 + 0.85 * dark);
    return o;
  });
  // vignette
  {
    const g = ctx.createRadialGradient(W / 2, H * 0.48, W * 0.35, W / 2, H * 0.48, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}
