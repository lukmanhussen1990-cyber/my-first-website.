// S04_dashboard (global frames 351-448): headline "An AI-powered health navigation" + the
// redrawn product dashboard window (Claude), tracked to the reference with per-frame homographies.
// Window layout is authored in "frame-384 space" (the window as it appears in reference frame 384).
'use strict';
const NS = 'http://www.w3.org/2000/svg';
const $ = (id) => document.getElementById(id);
function el(tag, attrs = {}, parent = null, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text !== null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}
const DATA = {};
const WIN = { x0: 158.5, y0: 452, x1: 1761, y1: 1349, r: 56 };

// ---------------------------------------------------------------- colours
const C = {
  white: '#ffffff',
  dark: 'rgb(22,22,26)',
  violet: 'rgb(97,84,246)',
  violetText: 'rgb(98,82,236)',
  violetSoft: 'rgb(132,120,236)',
  card: 'rgb(244,244,245)',
  card2: 'rgb(253,253,255)',
};

// ---------------------------------------------------------------- UI build (frame-384 space)
const G = {};   // animated groups
function textAt(parent, t, x, y, size, opts = {}) {
  return el('text', {
    x, y, 'font-size': size, 'font-family': opts.family || 'Inter Display', 'font-weight': opts.weight || 400,
    'font-style': opts.italic ? 'italic' : 'normal', fill: opts.fill || C.white,
    'letter-spacing': opts.ls || 0,
  }, parent, t);
}
function cornerGlyph(parent, x, y, s, color, w = 1.6) {
  // small "corner arrow" glyph: horizontal stroke then down (like a rotated L)
  return el('path', { d: `M${x} ${y} H${x + s} V${y + s}`, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'square' }, parent);
}
function buildUI() {
  const svg = $('ui');
  const defs = el('defs', {}, svg);
  // soft drop shadow for the white cards
  const fs = el('filter', { id: 'cardSh', x: '-20%', y: '-20%', width: '140%', height: '150%' }, defs);
  el('feDropShadow', { dx: 0, dy: 6, stdDeviation: 10, 'flood-color': 'rgb(20,16,70)', 'flood-opacity': 0.18 }, fs);
  const cp = el('clipPath', { id: 'winClip' }, defs);
  el('rect', { x: WIN.x0, y: WIN.y0, width: WIN.x1 - WIN.x0, height: WIN.y1 - WIN.y0, rx: WIN.r }, cp);

  // window frame (thin glass border)
  G.frame = el('g', {}, svg);
  el('rect', { x: WIN.x0, y: WIN.y0, width: WIN.x1 - WIN.x0, height: WIN.y1 - WIN.y0, rx: WIN.r, fill: 'none',
    stroke: 'rgba(255,255,255,0.62)', 'stroke-width': 2.6 }, G.frame);
  el('rect', { x: WIN.x0 + 1.6, y: WIN.y0 + 1.6, width: WIN.x1 - WIN.x0 - 3.2, height: WIN.y1 - WIN.y0 - 3.2, rx: WIN.r - 1.6, fill: 'none',
    stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 2 }, G.frame);

  const content = el('g', { 'clip-path': 'url(#winClip)' }, svg);

  // ---- top nav
  G.menu = el('g', {}, content);
  textAt(G.menu, 'Menu', 1221.9, 526.8, 16.1);
  for (const yy of [514.6, 520.6, 526.6]) el('line', { x1: 1272, x2: 1289, y1: yy, y2: yy, stroke: '#fff', 'stroke-width': 1.5 }, G.menu);
  G.doctors = el('g', {}, content);
  el('rect', { x: 1315.5, y: 498.5, width: 101, height: 43, rx: 21.5, fill: 'rgba(255,255,255,0.10)', stroke: 'rgba(255,255,255,0.50)', 'stroke-width': 1.5 }, G.doctors);
  textAt(G.doctors, 'Doctors', 1337.8, 526.8, 16.97);
  G.buddy = el('g', {}, content);
  el('rect', { x: 1433.5, y: 498.5, width: 101, height: 43, rx: 21.5, fill: 'rgba(255,255,255,0.13)', stroke: 'rgba(255,255,255,0.10)', 'stroke-width': 1 }, G.buddy);
  textAt(G.buddy, 'Buddy AI', 1450.8, 526.2, 16.71);
  G.logout = el('g', {}, content);
  el('rect', { x: 1553, y: 498, width: 114, height: 44, rx: 22, fill: '#000' }, G.logout);
  textAt(G.logout, 'Log out', 1579.7, 525.6, 18.69);

  // ---- heading (word tspans so single words can rise)
  G.h1a = textAt(content, '', 250.4, 698.0, 52.1);
  G.h1aW = ['Bringing', 'AI', 'to', 'the'].map((w, i) => el('tspan', {}, G.h1a, (i ? ' ' : '') + w));
  G.h1b = textAt(content, '', 250.3, 760.5, 52.2);
  G.h1bW = ['Heart', 'of', 'Healthcare'].map((w, i) => el('tspan', {}, G.h1b, (i ? ' ' : '') + w));
  G.sub = el('g', {}, content);
  textAt(G.sub, 'Where AI Meets', 249.8, 825.8, 18.7);
  textAt(G.sub, 'Holistic Health', 249.7, 846.8, 18.7);

  // ---- slider / audio widget
  G.wPill = el('g', {}, content);
  el('rect', { x: 1060.5, y: 689.5, width: 235, height: 63, rx: 31.5, fill: 'rgba(255,255,255,0.17)', stroke: 'rgba(255,255,255,0.36)', 'stroke-width': 1.5 }, G.wPill);
  G.wContent = el('g', {}, content);
  el('circle', { cx: 1085.5, cy: 721, r: 17, fill: 'rgb(247,247,250)' }, G.wContent);
  el('rect', { x: 1079.5, y: 715, width: 12, height: 12, rx: 2.5, fill: 'rgb(140,142,222)' }, G.wContent);
  const barsL = [[1118, 732], [1122, 729], [1126, 727], [1130, 723.5], [1134, 721], [1138, 719], [1142, 715.5], [1146, 713], [1150, 711], [1154.5, 708.5], [1159, 704.5], [1163, 707]];
  const barsR = [[1171, 711.5], [1175, 714.5], [1179, 716.5], [1183, 718.5], [1187, 721], [1191, 723], [1195, 724.5], [1199.5, 726.5], [1203.5, 727.5], [1208, 728.5], [1212, 730], [1216, 730], [1220, 728.5]];
  for (const [x, t] of barsL.concat(barsR)) el('rect', { x: x - 1.1, y: t, width: 2.2, height: 736.6 - t, fill: 'rgb(250,250,255)' }, G.wContent);
  el('rect', { x: 1165.4, y: 709, width: 2.4, height: 27.6, fill: 'rgb(108,104,222)' }, G.wContent);
  textAt(G.wContent, 'Healt', 1236.1, 713.9, 13.2);
  textAt(G.wContent, '96%+14', 1236.5, 734.9, 13.2);

  // ---- Consultation button (reference spelling)
  G.bBg = el('g', {}, content);
  el('rect', { x: 1332, y: 686, width: 156, height: 71, rx: 35.5, fill: C.violet }, G.bBg);
  G.bTxt = el('g', {}, content);
  textAt(G.bTxt, 'Consution', 1350.1, 729.8, 23.0);
  cornerGlyph(G.bTxt, 1463.5, 716.5, 9.5, '#fff', 1.8);

  // ---- card 1: Virtual Consultation
  G.c1 = el('g', {}, content);
  el('rect', { x: 249, y: 901, width: 320, height: 287, rx: 24, fill: C.card, filter: 'url(#cardSh)' }, G.c1);
  G.c1t = el('g', {}, content);
  textAt(G.c1t, 'Virtual', 276.8, 948.8, 22.5, { fill: C.dark });
  textAt(G.c1t, 'Consultation', 277.1, 976.8, 22.5, { fill: C.dark });
  textAt(G.c1t, '24/7', 512.5, 941.3, 13.6, { weight: 500, fill: C.violetText });
  G.c1b = el('g', {}, content);
  el('rect', { x: 275.6, y: 1004.6, width: 123.5, height: 34.5, rx: 17.25, fill: 'none', stroke: 'rgb(120,106,240)', 'stroke-width': 1.5 }, G.c1b);
  textAt(G.c1b, 'Consution', 290.4, 1027.8, 16.1, { fill: C.violetText });
  G.faces = el('g', {}, content);
  const fx = [313.5, 378.5, 439.5, 501.5];
  fx.forEach((cx, i) => {
    el('image', { href: `../../plates/S04_dashboard/face${i + 1}.png`, x: Math.round(cx - 34), y: Math.round(1092.5 - 34), width: 68, height: 68 }, G.faces);
  });
  fx.forEach((cx) => el('circle', { cx, cy: 1092.5, r: 31.3, fill: 'none', stroke: 'rgb(246,246,247)', 'stroke-width': 1.6 }, G.faces));

  // ---- card 2: Statistics
  G.c2 = el('g', {}, content);
  el('rect', { x: 593, y: 894, width: 195, height: 224, rx: 24, fill: C.card2, filter: 'url(#cardSh)' }, G.c2);
  G.c2t = el('g', {}, content);
  el('rect', { x: 650.6, y: 920.6, width: 80, height: 25, rx: 12.5, fill: 'none', stroke: 'rgba(110,95,240,0.55)', 'stroke-width': 1.2 }, G.c2t);
  textAt(G.c2t, 'Statistics', 668.5, 936.9, 13.1, { fill: C.violetText });
  el('circle', { cx: 692.6, cy: 1013.4, r: 50.4, fill: 'none', stroke: 'rgb(234,232,247)', 'stroke-width': 4 }, G.c2t);
  // violet arc: from 6 o'clock clockwise via 9 and 12 to 3 o'clock (270 deg)
  const cx2 = 692.6, cy2 = 1013.4, r2 = 50.4;
  el('path', { d: `M${cx2} ${cy2 + r2} A${r2} ${r2} 0 1 1 ${cx2 + r2} ${cy2}`, fill: 'none', stroke: 'rgb(104,90,234)', 'stroke-width': 4.2, 'stroke-linecap': 'round' }, G.c2t);
  textAt(G.c2t, '85%', 666.9, 1023.7, 26.8, { weight: 300, fill: 'rgb(122,108,232)' });
  textAt(G.c2t, 'Successful diagnosis', 627.5, 1091.0, 12.6, { weight: 500, fill: C.dark });
  cornerGlyph(G.c2t, 752.5, 1082.5, 6.5, C.dark, 1.2);

  // ---- card 3: caring Innovation
  G.c3 = el('g', {}, content);
  el('rect', { x: 814, y: 906, width: 196, height: 350, rx: 26, fill: C.card, filter: 'url(#cardSh)' }, G.c3);
  G.c3t = el('g', {}, content);
  textAt(G.c3t, 'caring', 834.3, 942.2, 23.6, { fill: C.dark });
  textAt(G.c3t, 'Innovation', 834.3, 962.8, 23.6, { fill: C.dark });
  el('rect', { x: 834, y: 983, width: 87, height: 25, rx: 12.5, fill: C.violet }, G.c3t);
  textAt(G.c3t, 'Explore', 854.1, 999.5, 13.0, { weight: 500 });
  el('rect', { x: 833.6, y: 1129.6, width: 63, height: 24, rx: 12, fill: 'none', stroke: 'rgb(130,118,240)', 'stroke-width': 1.2 }, G.c3t);
  textAt(G.c3t, 'About', 846.9, 1144.9, 12.75, { fill: C.violetText });
  textAt(G.c3t, 'In healthcare, the No. 1', 834.0, 1178.3, 14.1, { weight: 500, fill: C.dark });
  textAt(G.c3t, "problem isn't disease, it's", 834.2, 1196.3, 14.1, { weight: 500, fill: C.dark });
  textAt(G.c3t, 'cost.', 833.6, 1212.9, 14.1, { weight: 500, fill: C.dark });
  textAt(G.c3t, 'Read More', 835.8, 1234.9, 10.9, { weight: 500, italic: true, fill: C.dark });

  // ---- Medication + search
  G.med = el('g', {}, content);
  textAt(G.med, 'Medication', 249.6, 1236.8, 20.7, { fill: 'rgb(230,232,252)' });
  el('rect', { x: 248.5, y: 1259.5, width: 318, height: 67, rx: 33.5, fill: 'rgba(255,255,255,0.12)', stroke: 'rgba(255,255,255,0.36)', 'stroke-width': 1.5 }, G.med);
  el('circle', { cx: 271.5, cy: 1289.5, r: 8.2, fill: 'none', stroke: 'rgb(128,118,240)', 'stroke-width': 2 }, G.med);
  el('line', { x1: 277.5, y1: 1295.5, x2: 283.5, y2: 1301.5, stroke: 'rgb(128,118,240)', 'stroke-width': 2, 'stroke-linecap': 'round' }, G.med);
  textAt(G.med, 'Search...', 311.5, 1299.8, 18.1, { italic: true, fill: 'rgb(244,244,255)' });
  el('circle', { cx: 529, cy: 1293, r: 21, fill: 'rgb(246,246,250)' }, G.med);
  cornerGlyph(G.med, 524, 1288, 9, 'rgb(110,96,240)', 1.8);

  // ---- brain plate (real 3-D render, matted from the reference)
  G.brain = el('g', {}, content);
  el('image', { href: '../../plates/S04_dashboard/brain_lo.png', x: 1090, y: 870, width: 520, height: 370 }, G.brain);

  // ---- Claude label (replaces the reference brand label)
  const logo = claudeLogo({ size: 29.6, fill: '#ffffff' });
  logo.style.position = 'absolute';
  logo.style.left = '253.0px';
  logo.style.top = '495.7px';
  $('logoBox').appendChild(logo);
  G.logo = $('logoBox');
}

// ---------------------------------------------------------------- reveal animation data
// dy: rise offsets (frame-384 px, + = below final position); op: opacity. Measured from the reference.
const A = {
  logo: { dy: [[352, 68], [353, 58], [354, 48], [355, 38], [356, 32], [357, 26], [358, 22], [359, 17], [360, 14], [361, 10], [362, 6.5], [363, 4], [364, 2.5], [365, 1.5], [366, 0]],
          op: [[351, 0], [352, 0.25], [353, 0.45], [354, 0.65], [355, 0.8], [357, 1]] },
  the:  { dy: [[351, 12], [352, 10], [353, 8], [354, 6], [355, 4], [356, 2.5], [358, 1.5], [361, 0]] },
  heart: { dy: [[353, 18], [354, 14], [355, 12], [356, 8], [357, 6], [358, 4.5], [359, 3.5], [360, 2], [362, 0]], op: [[353, 0], [354, 0.6], [355, 0.85], [356, 1]] },
  of:   { dy: [[354, 28], [355, 22], [356, 16], [357, 12], [358, 8.5], [359, 6], [360, 4.5], [361, 3.5], [362, 2], [363, 0]], op: [[354, 0], [355, 0.6], [356, 0.85], [357, 1]] },
  hc:   { dy: [[355, 44], [356, 34], [357, 24], [358, 18], [359, 14], [360, 10], [361, 7.5], [362, 4.5], [363, 2], [364, 0]], op: [[355, 0], [356, 0.45], [357, 0.7], [358, 0.85], [359, 1]] },
  sub:  { op: [[356, 0], [357, 0.45], [358, 0.7], [359, 0.85], [361, 1]] },
  menu: { dy: [[355, 40], [356, 33], [357, 28], [358, 24], [359, 21], [360, 16], [361, 12], [362, 8], [363, 4.5], [364, 2], [365, 0]], op: [[354, 0], [356, 0.5], [358, 0.8], [360, 1]] },
  doctors: { dy: [[355, 68], [356, 54], [357, 44], [358, 36], [359, 30], [360, 25], [361, 20], [362, 14], [363, 10], [364, 6], [365, 3], [366, 1.5], [367, 0]], op: [[355, 0], [356, 0.35], [357, 0.6], [359, 0.9], [361, 1]] },
  buddy: { dy: [[356, 68], [357, 54], [358, 45], [359, 38], [360, 30], [361, 24], [362, 19], [363, 14], [364, 8.5], [365, 4.5], [366, 2.5], [368, 1.5], [370, 0]], op: [[355.5, 0], [357, 0.4], [358, 0.6], [360, 0.9], [362, 1]] },
  logout: { dy: [[356, 84], [357, 68], [358, 56], [359, 46], [360, 38], [361, 30], [362, 24], [363, 18], [364, 11], [365, 7], [366, 4.5], [368, 3.5], [369, 2], [371, 0]], op: [[356, 0], [357, 0.35], [358, 0.6], [360, 0.9], [362, 1]] },
  wContent: { op: [[365.5, 0], [366, 0.06], [367, 0.35], [368, 0.68], [369, 0.95], [370, 1]] },
  wPill: { dy: [[366, 72], [367, 62], [368, 52], [369, 43], [370, 36], [371, 30], [372, 25], [373, 21], [374, 17], [375, 14], [376, 10.5], [377, 8], [378, 6], [379, 4.5], [380, 3], [381, 2], [382, 1], [384, 0]], op: [[366, 0], [367, 0.3], [368, 0.6], [369, 0.85], [370, 1]] },
  bTxt: { op: [[367.5, 0], [368, 0.17], [369, 0.5], [370, 0.82], [371, 1]] },
  bBg:  { dy: [[368, 85], [369, 66], [370, 52], [371, 44], [372, 36], [373, 28], [374, 23], [375, 17.5], [376, 14], [377, 10.5], [378, 8], [379, 6], [380, 4], [381, 3], [382, 2], [383, 1], [384, 0]], op: [[367.5, 0], [368.5, 0.4], [369.5, 0.8], [370.5, 1]] },
  c1:   { dy: [[368, 100], [369, 81], [370, 63], [371, 50], [372, 41], [373, 33], [374, 27], [375, 22], [376, 17], [377, 13], [378, 10], [379, 7], [380, 5], [381, 3], [382, 1.5], [383, 0]], op: [[368, 0], [369, 0.5], [370, 0.85], [371, 1]] },
  c1t:  { op: [[368.5, 0], [369, 0.18], [370, 0.4], [371, 0.7], [372, 0.88], [373, 1]] },
  c1b:  { op: [[371, 0], [372, 0.6], [373, 0.85], [375, 1]] },
  c2:   { dy: [[369, 113], [370, 88], [371, 63], [372, 51], [373, 41], [374, 34], [375, 27], [376, 22], [377, 17], [378, 14], [379, 11], [380, 8], [381, 6], [382, 4], [383, 2], [384, 1], [386, 0]], op: [[369, 0], [370, 0.5], [371, 0.85], [372, 1]] },
  c2t:  { op: [[370.5, 0], [371, 0.25], [372, 0.7], [373, 0.95], [374, 1]] },
  c3:   { dy: [[369, 125], [370, 103], [371, 83], [372, 63], [373, 50], [374, 41], [375, 33], [376, 27], [377, 22], [378, 18], [379, 13], [380, 10], [381, 7], [382, 5], [383, 3], [384, 2], [385, 1], [386, 0]], op: [[369.5, 0], [370.5, 0.5], [371.5, 0.85], [372.5, 1]] },
  c3t:  { op: [[370.5, 0], [371, 0.16], [372, 0.4], [373, 0.62], [374, 0.78], [375, 0.88], [377, 1]] },
  brain: { dy: [[373, 30], [374, 26], [375, 24], [376, 22], [377, 20], [378, 16], [379, 14], [380, 10], [381, 8], [382, 5], [383, 4], [384, 2], [385, 0]], op: [[373, 0], [374, 0.2], [375, 0.45], [376, 0.7], [377, 0.85], [379, 1]] },
};
const val = (keys, f, d = 0) => keys ? kf(f, keys) : d;
function anim(g, a, f) {
  if (!g) return;
  const dy = val(a.dy, f, 0), op = (typeof MASK_MODE !== 'undefined' && MASK_MODE) ? 1 : val(a.op, f, 1);
  g.setAttribute('transform', dy ? `translate(0 ${dy.toFixed(2)})` : '');
  g.setAttribute('opacity', op.toFixed(3));
  g.style.display = op <= 0.001 ? 'none' : '';
}

// ---------------------------------------------------------------- headline animation
const HW = [
  { op: [[349, 0.08], [350, 0.33], [351, 0.46], [352, 0.53], [353, 0.64], [354, 0.71], [355, 0.75], [356, 0.78], [357, 0.83], [358, 0.88], [359, 0.89], [360, 0.92], [361, 0.95], [364, 0.97], [366, 0.99], [368, 1]],
    rise: [[350, 0]], blur: [[351, 2.0], [352, 1.6], [353, 1.4], [356, 0.9], [360, 0.6], [364, 0]] },
  { op: [[354, 0], [355, 0.15], [356, 0.36], [357, 0.51], [358, 0.61], [359, 0.70], [360, 0.76], [361, 0.80], [362, 0.84], [363, 0.88], [364, 0.91], [365, 0.93], [366, 0.95], [367, 0.97], [368, 0.98], [369, 0.99], [371, 1]],
    rise: [[355, 62], [356, 50], [357, 40], [358, 31.5], [359, 26], [360, 21], [361, 17.3], [362, 14.4], [363, 11.6], [364, 9.3], [365, 7.3], [366, 5.6], [367, 4.1], [368, 2.7], [369, 1.5], [370, 0.8], [371, 0.4], [372, 0]],
    blur: [[355, 2.0], [356, 1.5], [357, 1.0], [360, 0.9], [362, 0.4], [364, 0]] },
  { op: [[359, 0], [360, 0.18], [361, 0.46], [362, 0.60], [363, 0.71], [364, 0.80], [365, 0.84], [366, 0.88], [367, 0.92], [368, 0.95], [369, 0.98], [371, 0.99], [372, 1]],
    rise: [[359, 115], [360, 88], [361, 62], [362, 48], [363, 38.7], [364, 31], [365, 25], [366, 20], [367, 16], [368, 12.2], [369, 9], [370, 6.7], [371, 4.7], [372, 3.1], [373, 1.8], [374, 1.0], [375, 0.4], [376, 0]],
    blur: [[360, 3.0], [361, 1.2], [364, 0.8], [366, 0]] },
  { op: [[363.5, 0], [364, 0.2], [365, 0.50], [366, 0.68], [367, 0.79], [368, 0.89], [369, 0.97], [370, 1]],
    rise: [[364, 92], [365, 72], [366, 55], [367, 43], [368, 34.5], [369, 27], [370, 21.4], [371, 17], [372, 13.2], [373, 10], [374, 7.5], [375, 5.5], [376, 3.9], [377, 2.7], [378, 1.6], [379, 1.0], [380, 0.6], [381, 0.3], [382, 0]],
    blur: [[364, 2.4], [365, 2.0], [366, 1.5], [367, 1.0], [370, 0.8], [372, 0]],
    gain: [[369, 1.0], [372, 1.03], [373, 1.05], [378, 1.05], [381, 1.04], [384, 1.0]] },
];

// ---------------------------------------------------------------- motion blur / defocus (frame-384 px sigma)
const BLUR = [[351, 4.5, 7.0], [352, 4, 5.5], [353, 3, 6.5], [354, 3.6, 5.5], [355, 3.6, 5.5], [356, 3, 4.2], [357, 2.2, 4], [358, 2.2, 3.2], [359, 2.0, 3],
  [360, 1.4, 2.4], [361, 1.3, 2.2], [362, 0.8, 2.2], [366, 0.7, 2.0], [367, 0.6, 1.5], [369, 0.5, 1.3], [370, 0.2, 0.8], [376, 0.2, 0.6], [380, 0, 0.4], [381, 0, 0],
  [393, 0, 0], [394, 0.4, 0.5], [395, 0.5, 0.7], [396, 0.7, 1.3], [397, 0.8, 1.6], [398, 0.9, 2.2], [399, 1.4, 3], [400, 1.6, 4], [401, 2.2, 5.3], [402, 2.4, 5.5],
  [403, 2.8, 5.5], [404, 2.2, 4.2], [405, 1.5, 3], [406, 1.3, 2.8], [407, 0.8, 2.0], [408, 0.6, 1.4], [411, 0.5, 1.1], [412, 0.3, 0.5], [414, 0, 0],
  [436, 0, 0], [437, 0.9, 0.2], [440, 1.0, 0.4], [443, 1.1, 0.4], [444, 1.6, 0.5], [445, 1.8, 0.6], [448, 2.5, 1.0]];
function blurAt(f) {
  let i = 0;
  while (i < BLUR.length - 1 && BLUR[i + 1][0] <= f) i++;
  if (i >= BLUR.length - 1 || f <= BLUR[0][0]) { const b = f <= BLUR[0][0] ? BLUR[0] : BLUR[BLUR.length - 1]; return [b[1], b[2]]; }
  const a = BLUR[i], b = BLUR[i + 1], t = (f - a[0]) / (b[0] - a[0]);
  return [lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// ---------------------------------------------------------------- geometry helpers
function Hf(f) { const h = DATA.H[String(Math.min(448, Math.max(351, f)))]; return h; }
function proj(H, x, y) { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }
function winOutline(H, grow = 0, n = 14) {
  const { x0, y0, x1, y1, r } = WIN; const pts = [];
  const X0 = x0 - grow, Y0 = y0 - grow, X1 = x1 + grow, Y1 = y1 + grow, R = r + grow;
  for (const [cx, cy, a0] of [[X1 - R, Y0 + R, -90], [X1 - R, Y1 - R, 0], [X0 + R, Y1 - R, 90], [X0 + R, Y0 + R, 180]]) {
    for (let k = 0; k <= n; k++) { const a = (a0 + 90 * k / n) * Math.PI / 180; pts.push(proj(H, cx + R * Math.cos(a), cy + R * Math.sin(a))); }
  }
  return pts;
}
function localScale(H) {
  const c = proj(H, 960, 900), dx = proj(H, 961, 900), dy = proj(H, 960, 901);
  return [Math.hypot(dx[0] - c[0], dx[1] - c[1]), Math.hypot(dy[0] - c[0], dy[1] - c[1])];
}

// ---------------------------------------------------------------- background glow fields
const STOPS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0];
const PROF = [1.0, 0.93053, 0.74976, 0.52309, 0.316, 0.1653, 0.07487, 0.0];
function drawField(ctx, p) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgba([p[0], p[1], p[2]]);
  ctx.fillRect(0, 0, 1920, 1080);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (p.length - 3) / 9; i++) {
    const [x, y, rx, ry, rot, r, g, b, a] = p.slice(3 + 9 * i, 12 + 9 * i);
    if (a <= 0 || rx <= 1) continue;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.scale(1, ry / rx);
    const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    for (let k = 0; k < STOPS.length; k++) gr.addColorStop(STOPS[k], `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${Math.min(1, a * PROF[k]).toFixed(4)})`);
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function bgParams(f) {
  const B = DATA.bg; const ks = B.keys;
  if (f <= ks[0]) return B.frames[String(ks[0])];
  if (f >= ks[ks.length - 1]) return B.frames[String(ks[ks.length - 1])];
  return B.frames[String(f)] || B.frames[String(ks[0])];
}

// ---------------------------------------------------------------- transition into S05 (f444-448)
function drawFlash(f) {
  const cv = $('flash'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 1920, 1080);
  const T = DATA.flash;
  if (!T || f < 444) { cv.style.display = 'none'; return; }
  cv.style.display = '';
  const p = T[String(f)];
  if (!p) return;
  // grey/lavender veil (alpha) with a brighter soft blob at upper right
  ctx.fillStyle = `rgba(${p.veil[0]},${p.veil[1]},${p.veil[2]},${p.veil[3]})`;
  ctx.fillRect(0, 0, 1920, 1080);
  if (p.blob) {
    const [x, y, r, cr, cg, cb, a] = p.blob;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    for (let k = 0; k < STOPS.length; k++) g.addColorStop(STOPS[k], `rgba(${cr},${cg},${cb},${(a * PROF[k]).toFixed(4)})`);
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080); ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------- frame
const PLATE = new Image();
const MASK_MODE = location.search.includes('mask');
if (MASK_MODE) { document.documentElement.style.background = 'transparent'; document.body.style.background = 'transparent'; $('stage').style.background = 'transparent'; }
window.renderFrame = async (f) => {
  const H = Hf(f);
  // background
  // reference background, window glass and border with the original UI removed (rd/plates/S04)
  if (MASK_MODE) { $('bgOut').style.display = 'none'; $('head').style.visibility = 'hidden'; }
  else {
    await setImg(PLATE, `../../plates/S04_dashboard/bg_${String(f).padStart(4, '0')}.jpg`);
    const bo = $('bgOut').getContext('2d'); bo.drawImage(PLATE, 0, 0, 1920, 1080);
  }
  $('bgIn').style.display = 'none';
  // the redrawn border is only needed where the headline crossed the original border
  G.frame.style.display = (f >= 392 && f <= 404) ? '' : 'none';

  // window transform + reveal animation
  $('win').style.transform = homographyCSS([[H[0], H[1], H[2]], [H[3], H[4], H[5]], [H[6], H[7], H[8]]]);
  for (const k of ['menu', 'doctors', 'buddy', 'logout', 'sub', 'wContent', 'wPill', 'bTxt', 'bBg', 'c1', 'c1t', 'c1b', 'c2', 'c2t', 'c3', 'c3t', 'brain']) anim(G[k], A[k], f);
  anim(G.faces, A.c1b, f);
  // logo (HTML element)
  { const dy = kf(f, A.logo.dy), op = MASK_MODE ? 1 : kf(f, A.logo.op); G.logo.style.transform = `translateY(${dy.toFixed(2)}px)`; G.logo.style.opacity = op.toFixed(3); }
  // heading words (tspan dy chains)
  const d1 = [0, 0, 0, kf(f, A.the.dy)];
  G.h1aW.forEach((t, i) => t.setAttribute('dy', (d1[i] - (i ? d1[i - 1] : 0)).toFixed(2)));
  const d2 = [kf(f, A.heart.dy), kf(f, A.of.dy), kf(f, A.hc.dy)], o2 = [kf(f, A.heart.op), kf(f, A.of.op), kf(f, A.hc.op)];
  G.h1bW.forEach((t, i) => { t.setAttribute('dy', (d2[i] - (i ? d2[i - 1] : 0)).toFixed(2)); t.setAttribute('fill-opacity', o2[i].toFixed(3)); });

  // motion blur (sigma in frame-384 px -> screen px)
  const [bx, by] = blurAt(f); const [sx, sy] = localScale(H);
  const BX = bx * sx, BY = by * sy;
  const on = BX > 0.05 || BY > 0.05;
  $('mbG').setAttribute('stdDeviation', `${BX.toFixed(2)} ${BY.toFixed(2)}`);
  $('mbInG').setAttribute('stdDeviation', `${(BX * 0.8).toFixed(2)} ${(BY * 0.8).toFixed(2)}`);
  $('winWrap').style.filter = on ? 'url(#mb)' : 'none';
  $('bgIn').style.filter = on ? 'url(#mbIn)' : 'none';

  // headline
  const hx = DATA.head[String(Math.max(351, Math.min(404, f)))];
  const head = $('head');
  if (f > 404) head.style.display = 'none';
  else {
    head.style.display = '';
    const [s, px, py] = hx;
    $('headG').setAttribute('transform', `matrix(${s} 0 0 ${s} ${(px - s * 285).toFixed(3)} ${(py - s * 285).toFixed(3)})`);
    HW.forEach((w, i) => {
      const g = $('hw' + i), op = kf(f, w.op), rise = kf(f, w.rise), bl = kf(f, w.blur), gain = w.gain ? kf(f, w.gain) : 1;
      g.setAttribute('transform', rise ? `translate(0 ${(-rise).toFixed(2)})` : '');
      g.setAttribute('opacity', op.toFixed(3));
      $('hb' + i).firstElementChild.setAttribute('stdDeviation', (bl * s).toFixed(2));
      g.setAttribute('filter', bl > 0.05 ? `url(#hb${i})` : '');
      g.style.filter = gain > 1.001 ? `brightness(${gain.toFixed(3)})` : '';
      g.style.display = op <= 0.001 ? 'none' : '';
    });
    animateHead(f);
    // the headline sits behind the window: cut out the window area
    const poly2 = winOutline(H, 1.5);
    const path = 'M0 0H1920V1080H0Z M' + poly2.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') + 'Z';
    head.style.clipPath = `path(evenodd, '${path}')`;
    // shared defocus once the window starts to recede
    const hb = f >= 396 ? Math.max(BX, BY) * 0.8 : 0;
    $('hbAll').firstElementChild.setAttribute('stdDeviation', hb.toFixed(2));
    $('headAll').setAttribute('filter', hb > 0.05 ? 'url(#hbAll)' : '');
  }

};

// ---------------------------------------------------------------- S05 opening look (lavender field + "Build"), f446-448
function drawS05(f) {
  const S = DATA.s05;
  const box = $('s05');
  if (!S || f < 445) { box.style.opacity = 0; box.style.display = 'none'; return; }
  const p = S[String(f)];
  if (!p) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.style.opacity = p.opacity;
  drawField($('s05bg').getContext('2d'), p.bg);
  const t = $('buildT');
  t.setAttribute('x', p.build.x); t.setAttribute('y', p.build.y); t.setAttribute('font-size', p.build.size);
  t.setAttribute('fill', p.build.fill);
  t.setAttribute('opacity', p.build.op);
  $('bb').firstElementChild.setAttribute('stdDeviation', p.build.blur);
  t.setAttribute('filter', p.build.blur > 0.05 ? 'url(#bb)' : '');
}

// ---------------------------------------------------------------- livelier headline (client request)
// Each letter drops in with a small overshoot and a blur-to-sharp, a light sweeps across the line,
// the violet gradient flows along it, a soft glow pulses, and on the way out the letters drift up
// one after another. Word start times follow the reference so the beat is unchanged.
const WORD_T0 = [349.5, 354.5, 359, 363.5];
const LET = [];   // {g, blurNode, word, k, n}
function buildHeadLetters() {
  const svg = $('head'), defs = svg.querySelector('defs');
  defs.insertAdjacentHTML('beforeend', `
    <linearGradient id="shimG" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="380" y2="0">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="shimM" maskUnits="userSpaceOnUse" x="-500" y="-500" width="3400" height="2000">
      <rect id="shimR" x="0" y="-500" width="380" height="2000" fill="url(#shimG)"/></mask>
    <filter id="hglow" x="-15%" y="-80%" width="130%" height="260%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b"/>
      <feFlood id="hglowC" flood-color="rgb(150,120,255)" flood-opacity="0.0"/>
      <feComposite in2="b" operator="in" result="g"/>
      <feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  const shim = document.createElementNS(NS, 'g'); shim.setAttribute('id', 'headShim'); shim.setAttribute('mask', 'url(#shimM)');
  for (let i = 0; i < 4; i++) {
    const wg = $('hw' + i), t = wg.querySelector('text'), str = t.textContent;
    const xs = Array.from(str).map((_, k) => t.getStartPositionOfChar(k).x);
    const attrs = ['font-family', 'font-weight', 'font-size', 'fill'].map(a => [a, t.getAttribute(a)]);
    t.style.display = 'none';
    Array.from(str).forEach((ch, k) => {
      if (ch === ' ') return;
      const fid = `hl_${i}_${k}`;
      defs.insertAdjacentHTML('beforeend', `<filter id="${fid}" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="0"/></filter>`);
      const g = document.createElementNS(NS, 'g');
      const tt = el('text', { x: xs[k].toFixed(2), y: 360 }, g, ch); attrs.forEach(([a, v]) => tt.setAttribute(a, v));
      wg.appendChild(g);
      const sh = el('text', { x: xs[k].toFixed(2), y: 360, fill: 'rgb(255,250,255)' }, shim, ch); ['font-family', 'font-weight', 'font-size'].forEach(a => sh.setAttribute(a, t.getAttribute(a)));
      LET.push({ g, sh, blurNode: defs.querySelector('#' + fid).firstElementChild, fid, word: i, k, cx: xs[k] + 25 });
    });
  }
  $('headG').appendChild(shim);
}
const easeBack = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
function animateHead(f) {
  if (!LET.length) return;
  for (let i = 0; i < 4; i++) { const wg = $('hw' + i); wg.setAttribute('transform', ''); wg.setAttribute('filter', ''); wg.setAttribute('opacity', 1); wg.style.display = ''; wg.style.filter = ''; }
  const nAll = LET.length;
  LET.forEach((L, j) => {
    const t0 = WORD_T0[L.word] + L.k * 0.7;
    const u = clamp((f - t0) / 8);
    const y = -46 * (1 - easeBack(u));                         // drops in from above with a small bounce
    const sc = 1 + 0.28 * (1 - ease.outCubic(u));
    const rot = -10 * (1 - ease.outCubic(u));
    const op = clamp((f - t0) / 3);
    let bl = 7 * (1 - ease.outCubic(clamp((f - t0) / 6)));
    // exit: letters float up one after another as the camera pulls back
    const e = clamp((f - 393 - j * 0.12) / 9);
    const ey = -60 * ease.inCubic(e), eo = 1 - ease.inQuad(e); bl += 6 * ease.inQuad(e);
    const ox = L.cx, oy = 330;
    L.g.setAttribute('transform', `translate(0 ${(y + ey).toFixed(2)}) rotate(${rot.toFixed(2)} ${ox} ${oy}) translate(${ox} ${oy}) scale(${sc.toFixed(4)}) translate(${-ox} ${-oy})`);
    L.g.setAttribute('opacity', (op * eo).toFixed(3));
    L.g.style.display = op * eo <= 0.002 ? 'none' : '';
    L.blurNode.setAttribute('stdDeviation', bl.toFixed(2));
    L.g.setAttribute('filter', bl > 0.05 ? `url(#${L.fid})` : '');
    L.sh.setAttribute('transform', L.g.getAttribute('transform')); L.sh.setAttribute('opacity', (op * eo).toFixed(3));
  });
  // light sweep across the line (two passes)
  const sweep = (a, b) => (f >= a && f <= b) ? 150 + (f - a) / (b - a) * 1750 : null;
  const sx = sweep(373, 386) ?? sweep(387.5, 397);
  $('shimR').setAttribute('x', sx === null ? -2000 : (sx - 190).toFixed(1));
  $('shimG').setAttribute('x1', sx === null ? -2000 : (sx - 190).toFixed(1)); $('shimG').setAttribute('x2', sx === null ? -1620 : (sx + 190).toFixed(1));
  $('headShim').setAttribute('opacity', f >= 387.5 ? 0.7 : 1);
  // flowing gradient: violet slides along the words and back
  const gu = Math.sin(Math.PI * clamp((f - 366) / 30));
  const g = $('headGrad'); g.setAttribute('x1', (290 - 520 * gu).toFixed(1)); g.setAttribute('x2', (1637 - 520 * gu).toFixed(1));
  // soft violet glow that swells after the reveal
  const glow = kf(f, [[366, 0], [372, 0.28], [378, 0.38], [384, 0.26], [390, 0.34], [396, 0.18], [404, 0]]);
  $('hglowC').setAttribute('flood-opacity', glow.toFixed(3));
  $('headG').setAttribute('filter', glow > 0.01 ? 'url(#hglow)' : '');
}

window.sceneReady = (async () => {
  const [H, head, bg] = await Promise.all([loadJSON('win_H.json'), loadJSON('head_xform.json'), loadJSON('bg_params.json')]);
  DATA.H = H; DATA.head = head; DATA.bg = bg;
  try { DATA.flash = await loadJSON('flash.json'); } catch (e) { DATA.flash = null; }
  try { DATA.s05 = await loadJSON('s05.json'); } catch (e) { DATA.s05 = null; }
  buildUI();
  await document.fonts.ready;
  buildHeadLetters();
  const imgs = Array.from(document.querySelectorAll('image'));
  await Promise.all(imgs.map((im) => new Promise((res) => {
    const i = new Image(); i.onload = res; i.onerror = res; i.src = new URL(im.getAttribute('href'), location.href).href;
  })));
})();
