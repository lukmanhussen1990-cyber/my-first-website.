// Painted backdrops, the Islamic proscenium frame and the curtains — all flat
// folk-art shapes drawn in code.
const FLOOR_Y = 1680; // where the painted backdrop meets the wooden stage floor

// Closed Catmull-Rom spline through points -> cubic bezier path.
function smoothClosed(pts) {
  const n = pts.length;
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

function linGrad(id, stops, x2 = 0, y2 = 1) {
  const g = el('linearGradient', { id, x1: 0, y1: 0, x2, y2 }, defs());
  stops.forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 }, g));
  return `url(#${id})`;
}
function radGrad(id, stops, extra) {
  const g = el('radialGradient', Object.assign({ id }, extra || {}), defs());
  stops.forEach(([o, c, a]) => el('stop', { offset: o, 'stop-color': c, 'stop-opacity': a ?? 1 }, g));
  return `url(#${id})`;
}

// Random rocky facets inside a region test.
function facets(parent, R, n, test, colors, rMin, rMax) {
  let d = colors.map(() => '');
  for (let i = 0; i < n; i++) {
    const cx = R() * 1080, cy = R() * 1700, r = lerp(rMin, rMax, R());
    if (!test(cx, cy, r)) continue;
    const k = 5 + Math.floor(R() * 3), pts = [];
    for (let j = 0; j < k; j++) {
      const a = (j / k) * Math.PI * 2 + R() * 0.5;
      pts.push([cx + Math.cos(a) * r * lerp(0.6, 1, R()), cy + Math.sin(a) * r * lerp(0.45, 0.8, R())]);
    }
    d[i % colors.length] += poly(pts, true);
  }
  colors.forEach((c, i) => el('path', { d: d[i], fill: c, stroke: shade(c, 0.35), 'stroke-width': 2, 'stroke-linejoin': 'round' }, parent));
}

// Date palm with dotted fronds and date clusters.
function palm(parent, x, y, h, C, seed) {
  const R = rng(seed);
  const g = el('g', {}, parent);
  const lean = (R() - 0.5) * 60, top = [x + lean, y - h];
  const trunk = `M${x - 20} ${y}Q${x - 8 + lean * 0.3} ${y - h * 0.5} ${top[0] - 9} ${top[1]}L${top[0] + 9} ${top[1]}Q${x + 8 + lean * 0.3} ${y - h * 0.5} ${x + 20} ${y}Z`;
  shape(g, trunk, C.trunk);
  let rings = '';
  for (let u = 0.05; u < 0.97; u += 0.055) {
    const cx = lerp(x, top[0], u * u * 0.5 + u * 0.5) , cy = lerp(y, top[1], u), w = lerp(19, 9, u);
    rings += `M${(cx - w).toFixed(1)} ${(cy - 4).toFixed(1)}Q${cx.toFixed(1)} ${(cy + 6).toFixed(1)} ${(cx + w).toFixed(1)} ${(cy - 4).toFixed(1)}`;
  }
  el('path', { d: rings, fill: 'none', stroke: shade(C.trunk, 0.35), 'stroke-width': 2.2 }, g);
  const fronds = 10, dots = [];
  let leaves = '', ticks = '';
  const order = [];
  for (let i = 0; i < fronds; i++) order.push(i);
  // side fronds first so the upright ones sit on top
  order.sort((a, b) => Math.abs(b - (fronds - 1) / 2) - Math.abs(a - (fronds - 1) / 2));
  for (const i of order) {
    const a = lerp(-Math.PI * 1.02, Math.PI * 0.02, i / (fronds - 1)) + (R() - 0.5) * 0.12;
    const L = h * lerp(0.34, 0.44, R());
    const side = Math.cos(a);
    // arch up and out, then droop
    const c1 = [top[0] + side * L * 0.45, top[1] + Math.sin(a) * L * 0.8 - L * 0.18];
    const ex = top[0] + side * L * 0.98, ey = top[1] + L * (0.32 + 0.25 * (1 - Math.abs(side))) + Math.sin(a) * L * 0.25;
    const N = 16, left = [], right = [];
    for (let j = 0; j <= N; j++) {
      const u = j / N, v = 1 - u;
      const px = v * v * top[0] + 2 * v * u * c1[0] + u * u * ex, py = v * v * top[1] + 2 * v * u * c1[1] + u * u * ey;
      const tx = 2 * v * (c1[0] - top[0]) + 2 * u * (ex - c1[0]), ty = 2 * v * (c1[1] - top[1]) + 2 * u * (ey - c1[1]);
      const tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      const w = L * 0.085 * Math.pow(Math.sin(Math.PI * u), 0.6);
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
      if (j > 1 && j < N - 1) {
        dots.push([px, py]);
        if (j % 2 === 0) ticks += `M${(px + nx * w * 0.25).toFixed(1)} ${(py + ny * w * 0.25).toFixed(1)}L${(px + nx * w + tx / tl * 6).toFixed(1)} ${(py + ny * w + ty / tl * 6).toFixed(1)}M${(px - nx * w * 0.25).toFixed(1)} ${(py - ny * w * 0.25).toFixed(1)}L${(px - nx * w + tx / tl * 6).toFixed(1)} ${(py - ny * w + ty / tl * 6).toFixed(1)}`;
      }
    }
    leaves += poly(left.concat(right.reverse()), true);
  }
  el('path', { d: leaves, fill: C.leaf, class: 'o', 'stroke-width': 2.2 }, g);
  el('path', { d: ticks, fill: 'none', stroke: shade(C.leaf, 0.35), 'stroke-width': 1.6 }, g);
  el('path', { d: dotPath(dots, 2), fill: C.dot }, g);
  // date clusters
  const dd = [];
  for (let k = 0; k < 2; k++) for (let j = 0; j < 9; j++) dd.push([top[0] + (k ? 14 : -18) + (j % 3) * 7 - 7, top[1] + 18 + Math.floor(j / 3) * 8]);
  el('path', { d: dotPath(dd, 4.2), fill: C.dates, class: 'o', 'stroke-width': 1.2 }, g);
  return g;
}

// Wooden stage floor strip between the backdrop and the apron.
function stageFloor(parent, tint) {
  const g = el('g', {}, parent);
  el('rect', { x: -60, y: FLOOR_Y, width: 1200, height: 100, fill: tint || '#3B2617' }, g);
  let d = '';
  for (let x = -280; x <= 1360; x += 74) d += `M${x} ${FLOOR_Y}L${(x - 540) * 1.18 + 540} ${FLOOR_Y + 100}`;
  el('path', { d, stroke: '#24160D', 'stroke-width': 2.4, fill: 'none' }, g);
  el('path', { d: `M-60 ${FLOOR_Y + 1}H1140`, stroke: '#1A0F08', 'stroke-width': 3 }, g);
  el('rect', { x: -60, y: FLOOR_Y, width: 1200, height: 30, fill: '#000', opacity: 0.22 }, g);
  return g;
}

// --------------------------------------------------------- proscenium ----
function buildFrame(parent) {
  const g = el('g', {}, parent);
  const opening = 'M48 1760L48 380C48 230 320 112 540 62C760 112 1032 230 1032 380L1032 1760Z';
  const wood = '#2B1A10';
  el('path', { d: 'M-80 -80H1160V1770H-80Z' + opening, fill: wood, 'fill-rule': 'evenodd' }, g);
  // spandrel star lattice (clipped to the spandrels)
  const cp = el('clipPath', { id: 'spandrelClip' }, defs());
  el('path', { d: 'M-80 -80H1160V1800H-80Z' + opening, 'clip-rule': 'evenodd' }, cp);
  const lat = el('g', { 'clip-path': 'url(#spandrelClip)' }, g);
  let st = '';
  for (let y = -10; y < 440; y += 84) for (let x = -20; x < 1120; x += 84) {
    const ox = ((y + 10) / 84) % 2 ? 42 : 0;
    st += star8(30, 17).replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, a, b) => `${(+a + x + ox).toFixed(1)} ${(+b + y).toFixed(1)}`);
  }
  el('path', { d: st, fill: 'none', stroke: PAL.gold, 'stroke-width': 1.6, opacity: 0.32 }, lat);
  // gold trims along the opening and the outer edge
  el('path', { d: 'M48 1770L48 380C48 230 320 112 540 62C760 112 1032 230 1032 380L1032 1770', fill: 'none', stroke: PAL.gold, 'stroke-width': 5 }, g);
  el('path', { d: 'M34 1770L34 376C34 220 316 96 540 46C764 96 1046 220 1046 376L1046 1770', fill: 'none', stroke: PAL.gold, 'stroke-width': 1.8, opacity: 0.8 }, g);
  el('path', { d: dotPath(samplePath('M41 1700L41 378C41 225 318 104 540 54C762 104 1039 225 1039 378L1039 1700', 18), 2.2), fill: '#F3D88A' }, g);
  // little star at the apex
  el('path', { d: star8(16, 8), transform: 'translate(540 34)', fill: PAL.gold, class: 'o', 'stroke-width': 1.5 }, g);

  // apron: stage lip, gold geometric band, plank front
  const ap = el('g', {}, g);
  el('rect', { x: -80, y: 1760, width: 1240, height: 200, fill: '#24160D' }, ap);
  el('rect', { x: -80, y: 1760, width: 1240, height: 12, fill: '#6A4426' }, ap);
  el('rect', { x: -80, y: 1778, width: 1240, height: 62, fill: '#33200F' }, ap);
  el('path', { d: 'M-80 1780H1160M-80 1838H1160', stroke: PAL.gold, 'stroke-width': 3 }, ap);
  let band = '', dia = '';
  for (let x = 0; x <= 1100; x += 66) {
    band += star8(20, 11).replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, a, b) => `${(+a + x).toFixed(1)} ${(+b + 1809).toFixed(1)}`);
    dia += `M${x + 33} 1799l10 10l-10 10l-10 -10Z`;
  }
  el('path', { d: band, fill: 'none', stroke: PAL.gold, 'stroke-width': 2 }, ap);
  el('path', { d: dia, fill: PAL.gold, opacity: 0.85 }, ap);
  let planks = '';
  for (let x = 30; x < 1080; x += 96) planks += `M${x} 1842V1920`;
  el('path', { d: planks, stroke: '#140B05', 'stroke-width': 2.5 }, ap);
  el('path', { d: dotPath(Array.from({ length: 12 }, (_, i) => [78 + i * 96, 1860]), 2.4), fill: '#8A6A3A' }, ap);
  return g;
}

// ---------------------------------------------------------- cave outside --
const OUT_PAL = {
  night: { sky: [['0', '#10172C'], ['0.55', '#1E2A4A'], ['1', '#33416B']], dune: '#363E60', mtn: '#463B4C', fac: ['#52444F', '#3A3142', '#5C4B55'],
    ramp: '#6F6068', mouth: '#06070C', ground: '#4C4660', gdot: '#6A6280', trunk: '#3A2E2C', leaf: '#2A4A44', ldot: '#7FA894', dates: '#9A6A3A', rim: '#6C5A62' },
  dawn: { sky: [['0', '#4A5A8C'], ['0.45', '#C88A62'], ['0.8', '#F0BE7E'], ['1', '#F7D9A0']], dune: '#D9AE78', mtn: '#8A6448', fac: ['#A07650', '#6E4E3A', '#B4865A'],
    ramp: '#C9A876', mouth: '#1C120D', ground: '#C9A876', gdot: '#A88A5E', trunk: '#6E4E34', leaf: '#2F6B4F', ldot: '#D5E8B8', dates: '#E8A85C', rim: '#C9946A' },
};

function bgCaveOutside(parent, mode) {
  const P = OUT_PAL[mode];
  const g = el('g', {}, parent);
  el('rect', { x: -60, y: -60, width: 1200, height: 1760, fill: linGrad(uid('sky'), P.sky.map(([o, c]) => [o, c])) }, g);
  if (mode === 'dawn') el('circle', { cx: 300, cy: 1420, r: 520, fill: radGrad(uid('sun'), [['0', '#FFF2C8', 0.85], ['0.4', '#F7C878', 0.35], ['1', '#E8A85C', 0]]) }, g);
  const sky = el('g', {}, g); // moon, stars, clouds go here
  shape(g, 'M-60 1470C120 1420 260 1460 420 1430C600 1400 760 1450 1140 1420L1140 1700L-60 1700Z', P.dune, { 'stroke-width': 2 });
  const mtn = 'M-60 1330C60 1300 170 1250 250 1190C300 1110 340 1010 420 965C520 905 600 860 690 760C770 660 850 560 950 515C1020 492 1070 508 1140 540L1140 1700L-60 1700Z';
  shape(g, mtn, P.mtn, { 'stroke-width': 3 });
  const cp = el('clipPath', { id: uid('mtnclip') }, defs());
  el('path', { d: mtn }, cp);
  const fg = el('g', { 'clip-path': `url(#${cp.id})` }, g);
  facets(fg, rng(mode === 'night' ? 5 : 6), 120, () => true, P.fac, 40, 120);
  el('path', { d: 'M300 1300C420 1200 520 1150 640 1100M760 900C840 860 900 820 1000 800M180 1480C300 1440 360 1380 420 1320', fill: 'none', stroke: shade(P.mtn, 0.4), 'stroke-width': 3 }, fg);
  el('path', { d: dotPath(Array.from({ length: 70 }, (_, i) => { const r = rng(90 + i); return [r() * 1080, 700 + r() * 900]; }), 2.4), fill: P.rim, opacity: 0.6 }, fg);
  // the slope the boulder rolls down
  shape(g, 'M1140 560C1000 640 900 760 820 880C760 970 720 1080 712 1240L760 1250C772 1110 812 1000 872 908C950 790 1040 690 1140 628Z', P.ramp, { 'stroke-width': 2.6 });
  el('path', { d: dotPath(samplePath('M1120 600C1000 680 900 790 838 900C786 990 752 1090 740 1220', 22), 2.6), fill: shade(P.ramp, 0.3) }, g);
  // cave mouth with rim stones
  const mouth = 'M372 1682C368 1540 380 1420 420 1340C460 1272 500 1252 540 1250C584 1252 626 1274 662 1336C702 1410 716 1540 712 1682Z';
  shape(g, 'M344 1682C338 1530 352 1404 400 1322C446 1246 496 1222 540 1220C590 1222 642 1248 686 1320C734 1400 746 1530 742 1682Z', P.rim, { 'stroke-width': 3 });
  let stones = '';
  for (let i = 0; i < 15; i++) {
    const u = i / 14, a = Math.PI * (1.0 + u);
    const cx = 543 + Math.cos(a) * 185, cy = 1470 + Math.sin(a) * 236 * (u > 0.08 && u < 0.92 ? 1 : 0.6);
    const rot = (a * 180) / Math.PI + 90, ca = Math.cos(rot * Math.PI / 180) * 17, sa = Math.sin(rot * Math.PI / 180) * 17;
    stones += `M${(cx - ca).toFixed(1)} ${(cy - sa).toFixed(1)}a17 10 ${rot.toFixed(1)} 1 0 ${(2 * ca).toFixed(1)} ${(2 * sa).toFixed(1)}a17 10 ${rot.toFixed(1)} 1 0 ${(-2 * ca).toFixed(1)} ${(-2 * sa).toFixed(1)}`;
  }
  el('path', { d: stones, fill: shade(P.rim, 0.15), class: 'o', 'stroke-width': 1.8 }, g);
  shape(g, mouth, P.mouth, { 'stroke-width': 3 });
  el('path', { d: 'M392 1682C392 1540 404 1430 440 1360C470 1300 505 1280 540 1278C560 1279 580 1284 598 1294C540 1300 470 1340 440 1440C420 1520 418 1600 420 1682Z', fill: '#fff', opacity: mode === 'night' ? 0.03 : 0.06 }, g);
  // sand ground
  shape(g, 'M-60 1590C140 1572 300 1600 372 1600L372 1682L-60 1682Z', P.ground, { 'stroke-width': 2 });
  shape(g, 'M712 1600C820 1590 980 1560 1140 1580L1140 1682L712 1682Z', P.ground, { 'stroke-width': 2 });
  const gd = [], r = rng(44);
  for (let i = 0; i < 60; i++) { const x = r() * 1080; if (x > 360 && x < 724) continue; gd.push([x, 1610 + r() * 66]); }
  el('path', { d: dotPath(gd, 2.2), fill: P.gdot }, g);
  // palms in front of the left shoulder
  palm(g, 330, 1640, 520, { trunk: P.trunk, leaf: shade(P.leaf, 0.12), dot: P.ldot, dates: P.dates }, 12);
  palm(g, 118, 1700, 780, { trunk: P.trunk, leaf: P.leaf, dot: P.ldot, dates: P.dates }, 7);
  stageFloor(g, mode === 'night' ? '#2E1F15' : '#4A3020');
  return { g, sky };
}

// ----------------------------------------------------------- cave inside --
const HOLE = { x: 540, y: 880, r: 330 };
function holePath() {
  const pts = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const r = HOLE.r + 5 * Math.sin(3 * a + 0.4) + 3 * Math.sin(5 * a + 1.3) + 2.5 * Math.sin(9 * a);
    pts.push([HOLE.x + Math.cos(a) * r, HOLE.y + Math.sin(a) * r * 0.98]);
  }
  return smoothClosed(pts);
}

function bgCaveInside(parent) {
  const g = el('g', {}, parent);
  const hole = holePath();
  // the bright world outside (only visible through the entrance)
  const cp = el('clipPath', { id: 'holeClip' }, defs());
  el('path', { d: hole }, cp);
  const out = el('g', { 'clip-path': 'url(#holeClip)' }, g);
  el('rect', { x: 180, y: 520, width: 720, height: 720, fill: linGrad('outSky', [['0', '#FFF6DC'], ['0.55', '#F7D9A0'], ['1', '#E8A85C']]) }, out);
  el('circle', { cx: 470, cy: 940, r: 220, fill: radGrad('outSun', [['0', '#FFFFFF', 0.95], ['0.3', '#FFF1C8', 0.7], ['1', '#FFE2A0', 0]]) }, out);
  el('circle', { cx: 470, cy: 960, r: 70, fill: '#FFF4D2', stroke: '#F7C878', 'stroke-width': 4 }, out);
  palm(out, 760, 1100, 300, { trunk: '#A07A52', leaf: '#6E9A6E', dot: '#F3E6C8', dates: '#E8A85C' }, 51);
  palm(out, 300, 1110, 240, { trunk: '#A07A52', leaf: '#7FA67E', dot: '#F3E6C8', dates: '#E8A85C' }, 52);
  shape(out, 'M180 1080C300 1040 420 1070 540 1050C660 1030 780 1060 900 1040L900 1240L180 1240Z', '#E8BF84', { 'stroke-width': 2 });
  shape(out, 'M180 1140C320 1110 460 1140 600 1120C740 1100 820 1130 900 1120L900 1240L180 1240Z', '#D9A86A', { 'stroke-width': 2 });
  const boulderLayer = el('g', {}, g);
  // rock walls with the entrance cut out
  const walls = el('g', {}, g);
  const outer = 'M-80 -80H1160V1700H-80Z';
  el('path', { d: outer + hole, fill: '#2A2230', 'fill-rule': 'evenodd' }, walls);
  const wc = el('clipPath', { id: 'wallClip' }, defs());
  el('path', { d: outer + hole, 'clip-rule': 'evenodd' }, wc);
  const wf = el('g', { 'clip-path': 'url(#wallClip)' }, walls);
  facets(wf, rng(21), 260, (x, y, r) => Math.hypot(x - HOLE.x, y - HOLE.y) > HOLE.r + r * 0.4, ['#362C3A', '#241C28', '#3F3442', '#2E2533'], 50, 150);
  el('path', { d: 'M-40 320C200 380 300 520 330 700M760 600C860 480 960 420 1120 400M-40 1180C120 1150 200 1230 260 1320M820 1260C900 1220 1000 1240 1120 1200', fill: 'none', stroke: '#17111A', 'stroke-width': 4 }, wf);
  const sd = [], r = rng(8);
  for (let i = 0; i < 180; i++) { const x = r() * 1080, y = r() * 1500; if (Math.hypot(x - HOLE.x, y - HOLE.y) > HOLE.r + 30) sd.push([x, y]); }
  el('path', { d: dotPath(sd, 2.3), fill: '#5A4A58', opacity: 0.7 }, wf);
  // stalactites
  let st = '';
  for (const [x, w, h] of [[120, 50, 150], [210, 34, 90], [330, 60, 180], [690, 54, 160], [800, 36, 110], [930, 60, 200], [1010, 30, 90]]) {
    st += `M${x - w / 2} 0L${x + w / 2} 0L${x + w * 0.1} ${h * 0.7}L${x} ${h}L${x - w * 0.12} ${h * 0.6}Z`;
  }
  el('path', { d: st, fill: '#33293A', class: 'o', 'stroke-width': 2.4, transform: 'translate(0 80)' }, walls);
  // entrance rim catches the light
  el('path', { d: hole, fill: 'none', stroke: '#4B3D48', 'stroke-width': 30 }, walls);
  const rimLight = el('path', { d: hole, fill: 'none', stroke: '#F7C878', 'stroke-width': 5, opacity: 0 }, walls);
  el('path', { d: hole, fill: 'none', stroke: PAL.ink, 'stroke-width': 3 }, walls);
  // sandy floor
  shape(g, 'M-80 1330C120 1290 300 1300 440 1280C640 1260 860 1300 1160 1290L1160 1700L-80 1700Z', '#5A4836', { 'stroke-width': 2.4 });
  const fd = [], fr = rng(15);
  for (let i = 0; i < 110; i++) fd.push([fr() * 1080, 1320 + fr() * 360]);
  el('path', { d: dotPath(fd, 2), fill: '#7A6450', opacity: 0.8 }, g);
  el('path', { d: 'M60 1500a40 18 0 1 0 80 0a40 18 0 1 0 -80 0M900 1440a52 22 0 1 0 104 0a52 22 0 1 0 -104 0M760 1600a30 14 0 1 0 60 0a30 14 0 1 0 -60 0', fill: '#3E3240', class: 'o', 'stroke-width': 2 }, g);
  stageFloor(g, '#33231A');
  // a dusting of sand on the stage floor
  const sf = [], sr = rng(19);
  for (let i = 0; i < 90; i++) sf.push([sr() * 1080, FLOOR_Y + 8 + sr() * 80]);
  el('path', { d: dotPath(sf, 1.8), fill: '#7A6450', opacity: 0.7 }, g);
  return { g, boulderLayer, rimLight, hole };
}

// ------------------------------------------------------------------ home --
function bgHome(parent, variant) {
  const g = el('g', {}, parent);
  const win = 'M400 1010L400 720C400 640 470 588 540 556C610 588 680 640 680 720L680 1010Z';
  // sky behind the window
  const cp = el('clipPath', { id: uid('winClip') }, defs());
  el('path', { d: win }, cp);
  const sky = el('g', { 'clip-path': `url(#${cp.id})` }, g);
  const night = el('rect', { x: 380, y: 540, width: 320, height: 480, fill: linGrad(uid('hsky'), [['0', '#10172C'], ['1', '#2C3A63']]) }, sky);
  const dawn = el('rect', { x: 380, y: 540, width: 320, height: 480, fill: linGrad(uid('hdawn'), [['0', '#7E86B0'], ['0.5', '#F0B878'], ['1', '#F9DFA6']]), opacity: 0 }, sky);
  const skyObjects = el('g', {}, sky);
  shape(sky, 'M380 960C450 940 520 970 600 950C650 940 680 950 700 948L700 1020L380 1020Z', '#2A2C44', { 'stroke-width': 2 });
  // mud-brick wall
  const wallCol = variant === 'dim' ? '#6E5340' : '#8A6A4E';
  const wall = el('path', { d: 'M-80 -80H1160V1700H-80Z' + win, fill: wallCol, 'fill-rule': 'evenodd' }, g);
  let bricks = '';
  for (let y = 150, row = 0; y < 1520; y += 46, row++) {
    bricks += `M-80 ${y}H1160`;
    for (let x = (row % 2) * 60 - 80; x < 1160; x += 120) bricks += `M${x} ${y}v46`;
  }
  const bc = el('clipPath', { id: uid('brickClip') }, defs());
  el('path', { d: 'M-80 -80H1160V1700H-80Z' + win, 'clip-rule': 'evenodd' }, bc);
  el('path', { d: bricks, stroke: shade(wallCol, 0.25), 'stroke-width': 2, fill: 'none', 'clip-path': `url(#${bc.id})` }, g);
  // plaster patches
  el('path', { d: 'M90 640c60 -20 140 0 150 50c10 60 -80 80 -150 60c-50 -20 -40 -90 0 -110ZM820 1180c50 -10 120 10 120 50s-90 50 -130 30s-30 -70 10 -80Z', fill: '#fff', opacity: 0.06 }, g);
  // window frame + tile-arch border
  el('path', { d: win, fill: 'none', stroke: '#5A3A22', 'stroke-width': 22 }, g);
  el('path', { d: win, fill: 'none', stroke: PAL.gold, 'stroke-width': 3 }, g);
  el('path', { d: 'M382 1010L382 716C382 628 458 572 540 536C622 572 698 628 698 716L698 1010', fill: 'none', stroke: PAL.gold, 'stroke-width': 2, opacity: 0.8 }, g);
  el('path', { d: dotPath(samplePath('M390 1004L390 718C390 634 464 580 540 546C616 580 690 634 690 718L690 1004', 16), 2.2), fill: PAL.cream }, g);
  shape(g, 'M368 1010L712 1010L722 1036L358 1036Z', '#6A4426');
  // geometric tile borders: under the ceiling and along the wall base
  const tiles = (y, h) => {
    const tg = el('g', {}, g);
    el('rect', { x: -80, y, width: 1240, height: h, fill: '#1F3A4A' }, tg);
    el('path', { d: `M-80 ${y}H1160M-80 ${y + h}H1160`, stroke: PAL.gold, 'stroke-width': 3 }, tg);
    let s = '', c = '';
    for (let x = -40; x < 1140; x += h) {
      s += star8(h * 0.36, h * 0.2).replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, a, b) => `${(+a + x).toFixed(1)} ${(+b + y + h / 2).toFixed(1)}`);
      c += `M${x + h / 2} ${y + 6}l${h / 2 - 6} ${h / 2 - 6}l${-(h / 2 - 6)} ${h / 2 - 6}l${-(h / 2 - 6)} ${-(h / 2 - 6)}Z`;
    }
    el('path', { d: c, fill: PAL.emerald, opacity: 0.8 }, tg);
    el('path', { d: s, fill: PAL.cream, stroke: PAL.gold, 'stroke-width': 1.4 }, tg);
  };
  tiles(300, 54);
  tiles(1442, 62);
  // lamp niche (left)
  shape(g, 'M110 1250L110 1110C110 1060 140 1030 170 1016C200 1030 230 1060 230 1110L230 1250Z', '#3A2618', { 'stroke-width': 3 });
  el('path', { d: 'M100 1250L100 1104C100 1050 136 1018 170 1002C204 1018 240 1050 240 1104L240 1250', fill: 'none', stroke: PAL.gold, 'stroke-width': 2.4 }, g);
  shape(g, 'M126 1236C130 1210 210 1210 214 1236C200 1250 140 1250 126 1236Z', '#9A5A30');
  shape(g, 'M208 1226L232 1214L226 1230Z', '#9A5A30', { 'stroke-width': 1.6 });
  el('path', { d: dotPath(samplePath('M136 1234L204 1234', 10), 1.7), fill: PAL.cream }, g);
  const lampGlow = el('circle', { cx: 222, cy: 1196, r: 420, fill: 'url(#lampGlow)' }, g);
  const flame = el('path', { d: 'M226 1180C236 1194 234 1208 226 1212C218 1208 216 1194 226 1180Z', fill: '#FFF2C4', stroke: '#E8903C', 'stroke-width': 2 }, g);
  // floor + rug
  shape(g, 'M-80 1504H1160V1700H-80Z', variant === 'dim' ? '#4E3A2C' : '#5E4634', { 'stroke-width': 2.4 });
  const fd = [], fr = rng(variant === 'dim' ? 3 : 4);
  for (let i = 0; i < 80; i++) fd.push([fr() * 1080, 1520 + fr() * 150]);
  el('path', { d: dotPath(fd, 2), fill: '#7A604A', opacity: 0.7 }, g);
  if (variant === 'dim') {
    // doorway with a hanging curtain on the right (no one is ever shown)
    shape(g, 'M850 1504L850 1110C850 1040 900 1000 950 980C1000 1000 1050 1040 1050 1110L1050 1504Z', '#1E140E', { 'stroke-width': 3 });
    el('path', { d: 'M838 1504L838 1104C838 1032 894 990 950 966C1006 990 1062 1032 1062 1104L1062 1504', fill: 'none', stroke: PAL.gold, 'stroke-width': 2.6 }, g);
    const cur = el('g', {}, g);
    shape(cur, 'M860 1080C880 1060 1020 1060 1040 1080L1048 1500C1000 1480 980 1510 950 1494C920 1510 900 1480 852 1500Z', PAL.maroon);
    el('path', { d: 'M900 1080C904 1240 896 1380 900 1490M950 1076C946 1240 954 1380 950 1494M1000 1080C996 1240 1004 1380 1000 1490', fill: 'none', stroke: '#4E1A1A', 'stroke-width': 2.4 }, cur);
    el('path', { d: dotPath(samplePath('M864 1460C910 1450 990 1450 1040 1460', 12), 2.2), fill: PAL.gold }, cur);
    // rug
    shape(g, 'M140 1600L640 1600L700 1676L80 1676Z', '#5A2424');
    el('path', { d: 'M156 1610L626 1610L678 1668L102 1668Z', fill: 'none', stroke: PAL.gold, 'stroke-width': 2.4 }, g);
    el('path', { d: dotPath(samplePath('M200 1640L600 1640', 22), 3), fill: PAL.gold }, g);
  } else {
    shape(g, 'M40 1600L520 1600L560 1676L0 1676Z', '#6A2A2A');
    el('path', { d: 'M56 1610L506 1610L540 1668L16 1668Z', fill: 'none', stroke: PAL.gold, 'stroke-width': 2.4 }, g);
    el('path', { d: dotPath(samplePath('M90 1640L480 1640', 22), 3), fill: PAL.gold }, g);
  }
  stageFloor(g, variant === 'dim' ? '#2E1F15' : '#3B2617');
  return { g, sky, night, dawn, skyObjects, lampGlow, flame, wall };
}

// ---------------------------------------------------------------- valley --
function bgValley(parent) {
  const g = el('g', {}, parent);
  el('rect', { x: -60, y: -60, width: 1200, height: 1760, fill: linGrad('valSky', [['0', '#56679A'], ['0.42', '#C9927A'], ['0.62', '#EDB574'], ['0.75', '#F7D9A0'], ['1', '#F7D9A0']]) }, g);
  const sky = el('g', {}, g);
  const hill = (d, c, seed, dots) => {
    shape(g, d, c, { 'stroke-width': 2.6 });
    if (dots) {
      const r = rng(seed), pts = [];
      let arcs = '';
      for (let i = 0; i < dots; i++) {
        const x = r() * 1080, y = dots > 60 ? 1300 + r() * 380 : 1200 + r() * 200;
        pts.push([x, y]);
        if (i % 3 === 0) arcs += `M${x - 8} ${y + 10}q8 -14 16 0`;
      }
      const cp = el('clipPath', { id: uid('hill') }, defs());
      el('path', { d }, cp);
      const hg = el('g', { 'clip-path': `url(#${cp.id})` }, g);
      el('path', { d: dotPath(pts, 2.2), fill: mixColor(c, '#F3E6C8', 0.45), opacity: 0.8 }, hg);
      el('path', { d: arcs, fill: 'none', stroke: shade(c, 0.3), 'stroke-width': 2 }, hg);
    }
  };
  hill('M-60 1260C120 1180 260 1170 420 1210C560 1240 700 1160 860 1150C980 1145 1080 1190 1140 1200L1140 1700L-60 1700Z', '#7FA67E', 5, 40);
  const palms = el('g', {}, g);
  hill('M-60 1360C140 1300 330 1320 520 1350C700 1380 860 1300 1140 1320L1140 1700L-60 1700Z', '#4F8762', 9, 50);
  hill('M-60 1470C200 1440 420 1460 640 1450C840 1440 980 1420 1140 1440L1140 1700L-60 1700Z', '#3D7A55', 13, 90);
  palm(palms, 420, 1230, 300, { trunk: '#7A5A3E', leaf: '#4A8763', dot: '#D5E8B8', dates: '#E8A85C' }, 23);
  palm(palms, 140, 1330, 600, { trunk: '#6E4E34', leaf: '#2F6B4F', dot: '#D5E8B8', dates: '#E8A85C' }, 31);
  palm(palms, 975, 1320, 660, { trunk: '#6E4E34', leaf: '#2F6B4F', dot: '#D5E8B8', dates: '#E8A85C' }, 17);
  // wooden fence
  const f = el('g', {}, g);
  let posts = '';
  for (let x = -20; x < 1120; x += 96) posts += `M${x} 1452L${x + 18} 1452L${x + 16} 1560L${x + 2} 1560Z`;
  el('path', { d: 'M-60 1478H1140V1494H-60ZM-60 1520H1140V1536H-60Z', fill: '#8A5A30', class: 'o', 'stroke-width': 2 }, f);
  el('path', { d: posts, fill: '#7A4E2C', class: 'o', 'stroke-width': 2 }, f);
  el('path', { d: dotPath(Array.from({ length: 12 }, (_, i) => [-11 + i * 96, 1466]), 2.4), fill: PAL.cream }, f);
  // meadow
  shape(g, 'M-60 1560C200 1548 500 1566 760 1556C900 1550 1040 1556 1140 1552L1140 1700L-60 1700Z', '#3F7F55', { 'stroke-width': 2.4 });
  const fl = [], fr = rng(77);
  for (let i = 0; i < 60; i++) fl.push([fr() * 1080, 1570 + fr() * 100]);
  el('path', { d: dotPath(fl, 3), fill: PAL.cream, opacity: 0.85 }, g);
  el('path', { d: dotPath(fl.map(([x, y]) => [x + 7, y + 4]), 2), fill: PAL.amber }, g);
  stageFloor(g, '#3B2617');
  return { g, sky };
}

// Folk-art sun with rays, on a string.
class Sun {
  constructor(parent, r = 90) {
    this.r = r;
    this.wrap = el('g', {}, parent);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.g = el('g', {}, this.wrap);
    el('circle', { r: r * 3.2, fill: radGrad(uid('sunh'), [['0', '#FFF4CC', 0.8], ['0.35', '#FFD98A', 0.35], ['1', '#F7C878', 0]]) }, this.g);
    this.rays = el('g', {}, this.g);
    let rays = '';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, a1 = a - 0.11, a2 = a + 0.11, L = i % 2 ? r * 1.42 : r * 1.65;
      rays += `M${Math.cos(a1) * r * 1.05} ${Math.sin(a1) * r * 1.05}L${Math.cos(a) * L} ${Math.sin(a) * L}L${Math.cos(a2) * r * 1.05} ${Math.sin(a2) * r * 1.05}Z`;
    }
    el('path', { d: rays, fill: PAL.gold, class: 'o', 'stroke-width': 2 }, this.rays);
    el('circle', { r, fill: '#F7C64E', class: 'o', 'stroke-width': 2.6 }, this.g);
    el('circle', { r: r * 0.78, fill: 'none', stroke: '#E8A23C', 'stroke-width': 3 }, this.g);
    el('path', { d: dotPath(samplePath(`M${-r * 0.62} 0a${r * 0.62} ${r * 0.62} 0 1 0 ${r * 1.24} 0a${r * 0.62} ${r * 0.62} 0 1 0 ${-r * 1.24} 0`, 12), 2.6), fill: '#FFF1C0' }, this.g);
  }
  update(t, x, y) {
    setT(this.g, `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    setT(this.rays, `rotate(${(t * 4).toFixed(2)})`);
    this.str.setAttribute('d', `M${x} ${y - this.r}L${x} -320`);
  }
}

// Small birds on strings, flapping.
class Birds {
  constructor(parent, n, seed) {
    this.g = el('g', {}, parent);
    this.str = el('path', { class: 'str' }, this.g);
    this.body = el('path', { fill: '#3B2414' }, this.g);
    this.R = rng(seed);
    this.b = Array.from({ length: n }, () => ({ y: 360 + this.R() * 380, sp: 70 + this.R() * 50, ph: this.R() * 6, x0: -200 - this.R() * 600, s: 0.8 + this.R() * 0.5 }));
  }
  update(t, t0, alpha = 1) {
    let d = '', s = '';
    for (const b of this.b) {
      const x = b.x0 + (t - t0) * b.sp, y = b.y + 18 * Math.sin((t - t0) * 1.4 + b.ph);
      if (x < -80 || x > 1160) continue;
      const f = Math.sin((t - t0) * 9 + b.ph) * 14 * b.s, w = 22 * b.s;
      d += `M${x - w} ${y - f}Q${x - w * 0.4} ${y - 4 * b.s} ${x} ${y + 2}Q${x + w * 0.4} ${y - 4 * b.s} ${x + w} ${y - f}Q${x + w * 0.4} ${y + 2 * b.s} ${x} ${y + 6 * b.s}Q${x - w * 0.4} ${y + 2 * b.s} ${x - w} ${y - f}Z`;
      s += `M${x} ${y}L${x - 30} -320`;
    }
    this.body.setAttribute('d', d);
    this.str.setAttribute('d', s);
    this.g.setAttribute('opacity', alpha);
  }
}

// ------------------------------------------------------------ title card --
function bgTitle(parent) {
  const g = el('g', {}, parent);
  el('rect', { x: -60, y: -60, width: 1200, height: 1840, fill: radGrad('titleBg', [['0', '#2A3762'], ['0.6', '#1E2A4A'], ['1', '#0E1428']], { cx: 0.5, cy: 0.42, r: 0.75 }) }, g);
  let lat = '';
  for (let y = 60; y < 1760; y += 120) for (let x = 0; x < 1140; x += 120) {
    const ox = (y / 120) % 2 ? 60 : 0;
    lat += star8(46, 26).replace(/(-?\d+\.?\d*) (-?\d+\.?\d*)/g, (m, a, b) => `${(+a + x + ox).toFixed(1)} ${(+b + y).toFixed(1)}`);
  }
  el('path', { d: lat, fill: 'none', stroke: PAL.gold, 'stroke-width': 1.5, opacity: 0.13 }, g);
  const sky = el('g', {}, g);
  const text = el('g', {}, g);
  const T = (txt, y, attrs) => { const e = el('text', Object.assign({ x: 540, y, 'text-anchor': 'middle' }, attrs), text); e.textContent = txt; return e; };
  const goldFill = linGrad('titleGold', [['0', '#F7E3A0'], ['0.5', '#D4AF37'], ['1', '#A8801E']]);
  const tg = el('filter', { id: 'titleGlow', x: '-20%', y: '-40%', width: '140%', height: '180%' }, defs());
  el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 9, result: 'b' }, tg);
  const mg = el('feMerge', {}, tg); el('feMergeNode', { in: 'b' }, mg); el('feMergeNode', { in: 'SourceGraphic' }, mg);
  const small = T('QISSA THEATRE', 520, { 'font-family': 'Cinzel', 'font-weight': 700, 'font-size': 38, 'letter-spacing': 12, fill: PAL.gold });
  const div1 = el('g', {}, text);
  el('path', { d: 'M330 572H500M580 572H750', stroke: PAL.gold, 'stroke-width': 2 }, div1);
  el('path', { d: 'M540 556l16 16l-16 16l-16 -16Z', fill: PAL.gold }, div1);
  const arabic = T('أصحاب الغار', 790, { 'font-family': 'Aref Ruqaa', 'font-weight': 700, 'font-size': 190, fill: goldFill, filter: 'url(#titleGlow)', direction: 'rtl' });
  const en1 = T('The Three Men', 945, { 'font-family': 'Cinzel', 'font-weight': 700, 'font-size': 70, fill: PAL.cream });
  const en2 = T('in the Cave', 1030, { 'font-family': 'Cinzel', 'font-weight': 700, 'font-size': 70, fill: PAL.cream });
  const div2 = el('g', {}, text);
  el('path', { d: 'M360 1086H520M560 1086H720', stroke: PAL.gold, 'stroke-width': 2 }, div2);
  el('path', { d: star8(14, 7), transform: 'translate(540 1086)', fill: PAL.gold }, div2);
  return { g, sky, text, parts: [small, div1, arabic, en1, en2, div2] };
}

// --------------------------------------------------------------- curtains --
function buildCurtains(parent) {
  const g = el('g', {}, parent);
  const panel = (left) => {
    const p = el('g', {}, g);
    const W = 600;
    el('rect', { x: 0, y: -40, width: W, height: 1820, fill: '#7A1E22' }, p);
    let hi = '', lo = '';
    for (let i = 0; i < 8; i++) {
      const x = i * 75 + 10;
      hi += `M${x + 14} -40C${x + 22} 600 ${x + 10} 1200 ${x + 22} 1780L${x + 44} 1780C${x + 34} 1200 ${x + 46} 600 ${x + 38} -40Z`;
      lo += `M${x + 64} -40C${x + 70} 600 ${x + 60} 1200 ${x + 70} 1780`;
    }
    el('path', { d: hi, fill: '#A8363C', opacity: 0.55 }, p);
    el('path', { d: lo, stroke: '#3E0A0E', 'stroke-width': 6, fill: 'none', opacity: 0.8 }, p);
    // gold geometric border along the inner edge and the hem
    const ix = left ? W - 46 : 0;
    el('rect', { x: ix, y: -40, width: 46, height: 1820, fill: '#3A0E10' }, p);
    el('path', { d: `M${ix + 4} -40V1780M${ix + 42} -40V1780`, stroke: PAL.gold, 'stroke-width': 3 }, p);
    let ch = '';
    for (let y = 0; y < 1780; y += 46) ch += `M${ix + 23} ${y}l14 23l-14 23l-14 -23Z`;
    el('path', { d: ch, fill: 'none', stroke: PAL.gold, 'stroke-width': 2 }, p);
    el('path', { d: dotPath(Array.from({ length: 39 }, (_, i) => [ix + 23, i * 46 + 23]), 3), fill: PAL.gold }, p);
    el('rect', { x: 0, y: 1700, width: W, height: 40, fill: '#3A0E10' }, p);
    el('path', { d: `M0 1704H${W}M0 1736H${W}`, stroke: PAL.gold, 'stroke-width': 3 }, p);
    el('path', { d: dotPath(samplePath(`M10 1720H${W - 10}`, 22), 3.4), fill: PAL.gold }, p);
    el('path', { d: Array.from({ length: 13 }, (_, i) => `M${i * 46 + 10} 1740l10 26l10 -26Z`).join(''), fill: PAL.gold, class: 'o', 'stroke-width': 1.4 }, p);
    return p;
  };
  const L = panel(true), R = panel(false);
  // scalloped valance
  const v = el('g', {}, g);
  let sc = 'M-60 -40H1140V250';
  for (let x = 1140; x > -60; x -= 100) sc += `Q${x - 50} 330 ${x - 100} 250`;
  shape(v, sc + 'Z', '#6A161A', { 'stroke-width': 3 });
  el('path', { d: 'M-60 214H1140', stroke: PAL.gold, 'stroke-width': 4 }, v);
  el('path', { d: dotPath(samplePath('M-40 232H1120', 24), 3.4), fill: PAL.gold }, v);
  let tas = '';
  for (let x = 1090; x > -60; x -= 100) tas += `M${x - 6} 288l6 30l6 -30Z`;
  el('path', { d: tas, fill: PAL.gold, class: 'o', 'stroke-width': 1.4 }, v);
  return { g, L, R, v };
}
