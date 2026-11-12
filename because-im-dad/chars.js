// chars.js — character rigs: Dad (construction worker), coworkers, Jake, Lily, crowd.
'use strict';

const mirrorD = d => d.replace(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g, (m, a, b) => `${n2(-parseFloat(a))},${b}`);

const PAL = {
  dad: {
    skin: '#ecb790', skinSh: '#d0936d', hair: '#5d3a22', beard: '#6c4328', brow: '#4a2c19', iris: '#3b2a20',
    hat: '#f4b223', hatSh: '#d68d10', hatHi: '#ffd769',
    shirt: 'url(#plaid)', sleeve: 'url(#plaid)', cuff: '#8f2b28',
    vest: '#d3ec3c', vestSh: '#afc72a', refl: '#edf2f6',
    jeans: '#4a6da6', jeansSh: '#3a5688', cuffJ: '#6a8cc4', belt: '#5a3a24',
    boot: '#bb8750', bootSh: '#94663a', sole: '#4a3326', tape: '#b3b8bf', tapeSh: '#8b9199',
    glove: '#cda66b', beardOn: true, flag: true,
  },
};
PAL.co1 = Object.assign({}, PAL.dad, { skin: '#9a6444', skinSh: '#7d4c31', hair: '#1f1a17', beard: '#1f1a17', brow: '#1f1a17', beardOn: false, mustache: true, hat: '#f3f3ef', hatSh: '#cfd0ca', hatHi: '#ffffff', shirt: '#3e6db4', sleeve: '#3e6db4', cuff: '#2e528b', flag: false, jeans: '#3d4f6e' });
PAL.co2 = Object.assign({}, PAL.dad, { skin: '#f2c6a3', skinSh: '#d8a27e', hair: '#d6a13e', beard: '#c48d34', brow: '#a8752a', hat: '#2f7ad8', hatSh: '#1f5db0', hatHi: '#82b6ff', shirt: '#6c7f3b', sleeve: '#6c7f3b', cuff: '#52612c', flag: false, beardOn: false, jeans: '#57534e' });
PAL.jake = { skin: '#f4c6a2', skinSh: '#dba37f', hair: '#7a4a2a', iris: '#3b2a20', tee: '#ffffff', sleeve: '#d8463c', pants: '#4f79b8', shoe: '#d8463c', sole: '#ffffff', pj: '#3d63a8', pjSh: '#2f4f8a' };
PAL.lily = { skin: '#f7cfb2', skinSh: '#e0ab8d', hair: '#f1bf4c', hairSh: '#d49d2e', iris: '#3d6e9a', dress: '#9a6ed2', dressSh: '#7c55b3', shoe: '#ff8fb5', sole: '#ffffff', band: '#ff5f97', pj: '#f39bbd', pjSh: '#d97aa0' };

/* ======================= DAD ======================= */
const FACE_D = 'M-52,-14 C-54,-46 -30,-60 0,-60 C30,-60 54,-46 52,-14 L50,16 C48,42 26,58 0,58 C-26,58 -48,42 -50,16 Z';
const BEARD_D = 'M-52.5,-22 L-50,16 C-48,42 -26,58 0,58 C26,58 48,42 50,16 L52.5,-22 L44,-22 L43,12 C41,32 24,46 0,47 C-24,46 -41,32 -43,12 L-44,-22 Z';
const MUST_D = 'M-21,24 C-15,14 -6,15 0,18 C6,15 15,14 21,24 C14,26 6,24 0,22 C-6,24 -14,26 -21,24 Z';

const DAD_EXPR = {
  neutral: { lid: 0.25, brow: 0, mouth: 'flat' },
  smile: { lid: 0.18, brow: 4, mouth: 'smile' },
  soft: { lid: 0.3, brow: 8, mouth: 'smile', bags: true },
  warm: { eyes: 'happy', brow: 6, mouth: 'smile' },
  tired: { lid: 0.5, brow: 9, mouth: 'flat', bags: true },
  sad: { lid: 0.38, brow: 16, mouth: 'frown', bags: true },
  determined: { lid: 0.3, brow: -12, mouth: 'flat' },
  strain: { eyes: 'squeeze', brow: -8, mouth: 'grit' },
  wince: { eyes: 'squeeze', brow: 10, mouth: 'grit' },
  shock: { lid: 0, brow: 12, browY: -6, mouth: 'o', eyes: 'wide' },
  cheer: { eyes: 'happy', brow: 8, browY: -3, mouth: 'big' },
  teary: { lid: 0.12, brow: 17, mouth: 'tremble', wet: true, blush: true },
  cry: { eyes: 'squeeze', brow: 17, mouth: 'cry', tears: true, blush: true },
  sleep: { eyes: 'shut', brow: 2, mouth: 'flat' },
  chew: { eyes: 'happy', brow: 6, mouth: 'chew' },
};

function lidSvg(cx, cy, rx, ry, lid, skin, sw = 2.6) {
  const yl = cy - ry + 2 * ry * lid;
  const u = clamp((yl - cy) / ry, -0.995, 0.995);
  const hw = rx * Math.sqrt(1 - u * u);
  return P(`M${n2(cx - hw - 0.8)},${n2(yl)} A${rx + 0.8},${ry + 0.8} 0 ${u > 0 ? 1 : 0} 1 ${n2(cx + hw + 0.8)},${n2(yl)} Z`, skin, 0) +
    PS(`M${n2(cx - hw - 1.6)},${n2(yl + 0.6)} Q${n2(cx)},${n2(yl - 1.6)} ${n2(cx + hw + 1.6)},${n2(yl + 0.6)}`, OUT, sw);
}

function dadEye(cx, cy, side, e, o, p) {
  const blink = o.blink || 0, look = o.look || [0, 0];
  const type = blink > 0.82 ? 'shut' : e.eyes || 'open';
  if (type === 'happy') return PS(`M${cx - 9},${cy + 3} Q${cx},${cy - 7} ${cx + 9},${cy + 3}`, OUT, 3.4);
  if (type === 'shut') return PS(`M${cx - 9},${cy} Q${cx},${cy + 5} ${cx + 9},${cy}`, OUT, 3.2);
  if (type === 'squeeze') {
    const d = side < 0 ? `M${cx - 9},${cy - 5} L${cx + 6},${cy} L${cx - 9},${cy + 5}` : `M${cx + 9},${cy - 5} L${cx - 6},${cy} L${cx + 9},${cy + 5}`;
    return PS(d, OUT, 3.2);
  }
  const wide = type === 'wide', rx = 10.5, ry = wide ? 11 : 9.5;
  const ix = cx + look[0] * 3.2, iy = cy + look[1] * 2.4 + 1, ir = wide ? 0.72 : 1;
  let s = E(cx, cy, rx, ry, '#fff', 2.4);
  s += E(ix, iy, 6 * ir, 7.2 * ir, p.iris, 0);
  s += C(ix + 2.2, iy - 2.6, 2.2, '#fff', 0);
  if (e.wet) {
    s += C(ix - 2.2, iy + 2.6, 1.4, '#fff', 0);
    s += PS(`M${cx - 8},${cy + 6} Q${cx},${cy + 10.5} ${cx + 8},${cy + 6}`, '#8fd0ff', 2.6);
  }
  const lid = clamp((e.lid || 0) + blink * (1 - (e.lid || 0)));
  if (lid > 0.02) s += lidSvg(cx, cy, rx, ry, lid, p.skin);
  return s;
}

function dadBrow(cx, cy, side, a, col) {
  return G(`translate(${cx},${cy}) rotate(${n2(side * a)}) scale(${side < 0 ? 1 : -1},1)`, P('M-12,2 Q-2,-5 12,-1 L12,3 Q-1,0 -12,6 Z', col, 1.8));
}

function dadMouth(kind, o) {
  switch (kind) {
    case 'smile': return PS('M-12,30 Q0,40 12,30', OUT, 3);
    case 'big': return P('M-15,28 Q0,30 15,28 Q13,46 0,46 Q-13,46 -15,28 Z', '#7c2632', 2.6) + P('M-8,41 Q0,35 8,41 Q4,45.5 0,45.5 Q-4,45.5 -8,41 Z', '#e0707a', 0) + R(-11, 28.6, 22, 5, 2, '#fff', 0);
    case 'o': return E(0, 35, 6, 7.5, '#7c2632', 2.6);
    case 'frown': return PS('M-11,37 Q0,29 11,37', OUT, 3);
    case 'grit': return P('M-13,30 L13,30 L12,38 L-12,38 Z', '#fff', 2.6) + PS('M-12.5,34 L12.5,34 M-6,30 L-6,38 M0,30 L0,38 M6,30 L6,38', OUT, 1.4);
    case 'tremble': return PS('M-11,35 q3.6,-3 7.3,0 t7.3,0 t7.3,0', OUT, 2.8);
    case 'cry': return P('M-14,29 Q-7,32 0,30 Q7,32 14,29 Q11,43 0,43 Q-11,43 -14,29 Z', '#7c2632', 2.6) + R(-10, 29.5, 20, 4, 2, '#fff', 0);
    case 'chew': { const m = o.mouthOpen || 0; return E(0, 34, 8 - m * 1.5, 1.6 + m * 5.5, '#7c2632', 2.6); }
    default: return PS('M-9,33 L9,33', OUT, 3);
  }
}

function flagSticker(x, y, rot, w = 18, h = 12) {
  let s = R(0, 0, w, h, 1.5, '#fff', 1.6);
  for (let i = 0; i < 4; i++) s += R(0, i * h / 3.5 + 0.6, w, h / 7, 0, '#d4383a', 0);
  s += R(0, 0, w * 0.45, h * 0.5, 1, '#2f4b9b', 0) + R(0, 0, w, h, 1.5, 'none', 1.6);
  return G(`translate(${x},${y}) rotate(${rot})`, s);
}

function hardHat(p, o) {
  let s = P('M-57,-28 C-58,-76 -30,-96 0,-96 C30,-96 58,-76 57,-28 Z', p.hat, 3);
  if (!o.back) s += P('M-9,-95.5 C-10,-80 -10,-50 -9,-30 L9,-30 C10,-50 10,-80 9,-95.5 Q0,-97 -9,-95.5 Z', p.hatHi, 2.2);
  else s += P('M-9,-95.5 C-10,-80 -10,-50 -9,-30 L9,-30 C10,-50 10,-80 9,-95.5 Q0,-97 -9,-95.5 Z', p.hatHi, 2.2);
  s += PS('M-42,-58 C-40,-75 -29,-85 -17,-88', '#fff', 4.5, 'opacity="0.5"');
  if (p.flag && !o.back) s += flagSticker(-44, -66, -16);
  if (o.hatDrawing && !o.back) s += G('translate(22,-70) rotate(12)', R(0, 0, 20, 16, 1, '#fffdf4', 1.6) + PS('M5,12 L5,6 M5,6 L2,9 M5,6 L8,9 M14,12 L14,7', '#d8463c', 1.4) + C(5, 4, 2.2, 'none', 0, 'stroke="#2f4b9b" stroke-width="1.2"') + C(14, 5, 1.8, 'none', 0, 'stroke="#ff5f97" stroke-width="1.2"'));
  s += P('M-68,-30 Q0,-42 68,-30 Q73,-21 62,-18 Q0,-29 -62,-18 Q-73,-21 -68,-30 Z', p.hatSh, 3);
  return s;
}

function dadHair(p) {
  return P('M-53,-12 C-58,-52 -34,-74 0,-74 C36,-74 60,-54 53,-12 L47,-34 L41,-28 L32,-44 L18,-38 L4,-50 L-10,-40 L-24,-46 L-36,-32 L-46,-38 Z', p.hair, 3) +
    PS('M-20,-62 Q-6,-68 10,-64', '#7a5034', 3, 'opacity="0.7"');
}

function dadHead(p, o) {
  const e = Object.assign({}, DAD_EXPR[o.expr || 'neutral'] || DAD_EXPR.neutral, o.face || {});
  let s = '';
  if (o.facing === 'back') {
    s += E(-53, 4, 9, 13, p.skin, 2.6) + E(53, 4, 9, 13, p.skin, 2.6);
    s += P(FACE_D, p.skin, 3);
    s += P('M-53,-14 C-56,-50 -32,-74 0,-74 C32,-74 56,-50 53,-14 L51,12 C46,30 24,38 0,38 C-24,38 -46,30 -51,12 Z', p.hair, 3);
    if (p.beardOn) s += P('M-50,16 C-48,40 -30,54 -14,57 L-20,44 C-34,38 -44,28 -47,10 Z', p.beard, 2) + P(mirrorD('M-50,16 C-48,40 -30,54 -14,57 L-20,44 C-34,38 -44,28 -47,10 Z'), p.beard, 2);
    if (o.hat !== false) s += hardHat(p, { back: true });
    return s;
  }
  // ears
  s += E(-53, 4, 9, 13, p.skin, 2.6) + E(53, 4, 9, 13, p.skin, 2.6);
  s += PS('M-55,-3 Q-50,4 -54,11', p.skinSh, 2.2) + PS('M55,-3 Q50,4 54,11', p.skinSh, 2.2);
  s += P(FACE_D, p.skin, 3);
  // soft cheek shading
  s += P('M-50,16 C-48,40 -26,56 0,57 C-20,50 -40,36 -44,10 Z', p.skinSh, 0, 'opacity="0.35"');
  if (p.beardOn) s += P(BEARD_D, p.beard, 2.6);
  if (e.blush) s += E(-31, 17, 9, 5, '#ff7a7a', 0, 'opacity="0.45"') + E(31, 17, 9, 5, '#ff7a7a', 0, 'opacity="0.45"');
  if (e.bags) s += PS('M-29,9 Q-21,13 -13,9', '#a77c86', 2, 'opacity="0.7"') + PS('M13,9 Q21,13 29,9', '#a77c86', 2, 'opacity="0.7"');
  s += dadEye(-21, -4, -1, e, o, p) + dadEye(21, -4, 1, e, o, p);
  const by = -21 + (e.browY || 0);
  s += dadBrow(-21, by, -1, e.brow || 0, p.brow) + dadBrow(21, by, 1, e.brow || 0, p.brow);
  s += P('M-7,10 Q0,-4 7,10 Q7,16 0,16 Q-7,16 -7,10 Z', p.skin, 2.3) + E(-2.5, 9, 2.2, 1.6, '#fff', 0, 'opacity="0.55"');
  s += dadMouth(e.mouth, o);
  if (p.beardOn || p.mustache) s += P(MUST_D, p.beard, 2.4);
  if (e.tears || o.tears) {
    const k = o.tearT === undefined ? 1 : o.tearT;
    for (const sd of [-1, 1]) {
      const x0 = sd * 21, len = 10 + 34 * k;
      s += P(`M${x0 - 5},2 Q${x0 + sd * 4},${2 + len * 0.5} ${x0 + sd * 2},${2 + len} Q${x0 + sd * 6},${2 + len * 0.55} ${x0 + 5},2 Z`, '#9fd8ff', 1.8, 'opacity="0.9"');
      s += drop(x0 + sd * 3, 8 + len + 4 + ((o.t || 0) * 40 % 14), 0.75);
    }
  }
  if (o.sweat) s += drop(40, -12 + (o.sweat % 1) * 30, 0.9) + drop(-44, 4 + ((o.sweat + 0.5) % 1) * 30, 0.7);
  s += o.hat === false ? dadHair(p) : hardHat(p, o);
  return s;
}

// legs
function bootFront(p, cx, lift, kind) {
  const y0 = -lift;
  const body = `M${cx - 17},${y0 - 27} L${cx + 17},${y0 - 27} L${cx + 19},${y0 - 9} Q${cx + 22},${y0} ${cx + 11},${y0 + 1} L${cx - 11},${y0 + 1} Q${cx - 22},${y0} ${cx - 19},${y0 - 9} Z`;
  let s = P(body, kind === 'new' ? '#c9915a' : p.boot, 3);
  s += P(`M${cx - 18},${y0 - 9} Q${cx},${y0 - 16} ${cx + 18},${y0 - 9} L${cx + 19},${y0 - 4} Q${cx},${y0 - 8} ${cx - 19},${y0 - 4} Z`, kind === 'new' ? '#a8733f' : p.bootSh, 0);
  s += PS(`M${cx - 6},${y0 - 25} L${cx + 6},${y0 - 19} M${cx + 6},${y0 - 25} L${cx - 6},${y0 - 19} M${cx - 6},${y0 - 19} L${cx + 6},${y0 - 13} M${cx + 6},${y0 - 19} L${cx - 6},${y0 - 13}`, '#f1e4c6', 2);
  s += P(`M${cx - 21},${y0 - 4} Q${cx},${y0 - 7} ${cx + 21},${y0 - 4} Q${cx + 21},${y0 + 1.5} ${cx + 11},${y0 + 2} L${cx - 11},${y0 + 2} Q${cx - 21},${y0 + 1.5} ${cx - 21},${y0 - 4} Z`, kind === 'new' ? '#3a2a20' : p.sole, 2.5);
  if (kind === 'old') {
    s += P(`M${cx - 20},${y0 - 13} L${cx + 20},${y0 - 15} L${cx + 21},${y0 - 6} L${cx - 21},${y0 - 4} Z`, p.tape, 2);
    s += PS(`M${cx - 14},${y0 - 9} L${cx + 12},${y0 - 10.5}`, p.tapeSh, 1.4);
    s += PS(`M${cx + 10},${y0 - 24} l3,4 M${cx - 13},${y0 - 18} l2,3`, '#7a5230', 1.6);
  } else {
    s += PS(`M${cx - 12},${y0 - 22} L${cx - 13},${y0 - 13}`, '#ffe7c2', 3, 'opacity="0.8"');
  }
  return s;
}

function dadLegsStand(p, o) {
  let liftL = 0, liftR = 0;
  if (o.legs === 'walk') {
    const ph = (o.walk || 0) * Math.PI * 2;
    liftL = Math.max(0, Math.sin(ph)) * 11; liftR = Math.max(0, -Math.sin(ph)) * 11;
  }
  const spread = o.spread || 0;
  let s = '';
  for (const side of [-1, 1]) {
    const lift = side < 0 ? liftL : liftR, bot = -24 - lift, sx = side * spread;
    const d = side < 0 ? `M-53,-104 L1,-104 L${-4 + sx},${bot} L${-47 + sx},${bot} Z` : `M-1,-104 L53,-104 L${47 + sx},${bot} L${4 + sx},${bot} Z`;
    s += P(d, p.jeans, 3);
    s += P(side < 0 ? `M-14,-96 L-3,-96 L${-6 + sx},${bot} L${-15 + sx},${bot} Z` : `M3,-96 L14,-96 L${15 + sx},${bot} L${6 + sx},${bot} Z`, p.jeansSh, 0);
    s += R(side * 25.5 - 23 + sx, bot - 8, 46, 11, 4, p.cuffJ, 2.6);
    s += bootFront(p, side * 25.5 + sx, lift, o.boots || 'old');
  }
  return s;
}

function dadLegsSit(p, o) {
  const sw = o.swing || 0;
  let back = '', front = '';
  for (const side of [-1, 1]) {
    const kx = side * 26, ang = side * sw;
    back += G(`translate(${kx},10) rotate(${n2(ang)})`, R(-19, 0, 38, 64, 10, p.jeans, 3) + R(-21, 52, 42, 11, 4, p.cuffJ, 2.6) + G('translate(0,92)', bootFront(p, 0, 0, o.boots || 'old')));
    front += E(kx, 6, 25, 17, p.jeans, 3) + E(kx - side * 4, 2, 9, 5, '#6a8cc4', 0, 'opacity="0.6"');
  }
  return { back, front };
}

function dadTorso(p, o) {
  let s = '';
  if (o.facing === 'back') {
    s += R(-14, -210, 28, 34, 8, p.skin, 3);
    s += P('M-52,-190 C-64,-188 -69,-178 -67,-160 L-57,-98 Q0,-90 57,-98 L67,-160 C69,-178 64,-188 52,-190 Q0,-198 -52,-190 Z', o.vest === false ? p.shirt : p.vest, 3);
    if (o.vest !== false) {
      s += P('M-65,-142 L65,-142 L64.4,-131 L-64.4,-131 Z', p.refl, 1.8) + P('M-62.5,-120 L62.5,-120 L61.6,-109 L-61.6,-109 Z', p.refl, 1.8);
      s += P('M-52,-190 Q0,-198 52,-190 L44,-176 Q0,-182 -44,-176 Z', p.shirt, 2.2);
    }
    s += P('M-57,-104 Q0,-96 57,-104 L57,-94 Q0,-86 -57,-94 Z', p.belt, 2.5);
    return s;
  }
  s += R(-14, -210, 28, 34, 8, p.skin, 3);
  s += P('M-52,-190 C-64,-188 -69,-178 -67,-160 L-57,-98 Q0,-90 57,-98 L67,-160 C69,-178 64,-188 52,-190 Q0,-198 -52,-190 Z', p.shirt, 3);
  s += P('M-16,-193 L-3,-176 L-23,-179 Z', p.shirt, 2.4) + P('M16,-193 L3,-176 L23,-179 Z', p.shirt, 2.4);
  s += PS('M0,-176 L0,-100', 'rgba(0,0,0,0.28)', 2) + C(0, -160, 2.2, '#f3e6d6', 1.2) + C(0, -140, 2.2, '#f3e6d6', 1.2) + C(0, -120, 2.2, '#f3e6d6', 1.2);
  s += P('M-57,-104 Q0,-96 57,-104 L57,-94 Q0,-86 -57,-94 Z', p.belt, 2.5) + R(-8, -104, 16, 12, 2, '#c9ccd3', 2);
  if (o.vest !== false) {
    const vl = 'M-52,-190 C-64,-188 -69,-178 -67,-160 L-57,-98 Q-36,-94 -15,-93 L-15,-150 Q-20,-178 -32,-193 Z';
    s += P(vl, p.vest, 3) + P(mirrorD(vl), p.vest, 3);
    s += P('M-66,-160 L-57,-98 Q-50,-96.5 -44,-95.5 L-52,-158 Z', p.vestSh, 0) + P(mirrorD('M-66,-160 L-57,-98 Q-50,-96.5 -44,-95.5 L-52,-158 Z'), p.vestSh, 0);
    const outer = yy => -67 + 10 * clamp((yy + 160) / 62);
    for (const [ya, yb] of [[-142, -131], [-120, -109]]) {
      const d = `M${n2(outer(ya) + 1.2)},${ya} L-15,${ya} L-15,${yb} L${n2(outer(yb) + 1.2)},${yb} Z`;
      s += P(d, p.refl, 1.8) + P(mirrorD(d), p.refl, 1.8);
    }
  }
  return s;
}

function dadHandPos(side, a1, a2) {
  const sx = side * 58, sy = -180;
  const r1 = -side * a1 * DEG, r2 = r1 + side * a2 * DEG;
  const ex = sx - Math.sin(r1) * 48, ey = sy + Math.cos(r1) * 48;
  return [ex - Math.sin(r2) * 48, ey + Math.cos(r2) * 48];
}

function dadArm(p, side, a, o) {
  const [a1, a2] = a;
  const sx = side * 58, sy = -180, r1 = -side * a1, r2 = side * a2;
  const hand = o.gloves ? p.glove : p.skin;
  const holdBack = side < 0 ? o.holdLBack : o.holdRBack, holdFront = side < 0 ? o.holdL : o.holdR;
  let fore = R(-12.5, 50, 25, 42, 12, p.skin, 3);
  fore += R(-15.5, 40, 31, 15, 7, p.cuff, 3);
  if (o.gloves) fore += R(-14, 80, 28, 12, 5, p.glove, 2.6);
  if (holdBack) fore += G('translate(0,96)', holdBack);
  fore += C(0, 96, 14, hand, 3) + E(-side * 10, 90, 6, 8.5, hand, 2.6) + PS(`M${-side * 5},101 Q0,104 ${side * 6},100`, 'rgba(0,0,0,0.25)', 1.6);
  if (holdFront) fore += G('translate(0,96)', holdFront);
  const upper = R(-15.5, -8, 31, 58, 15, p.sleeve, 3);
  const foreG = G(`translate(0,48) rotate(${n2(r2)}) translate(0,-48)`, fore);
  return G(`translate(${sx},${sy}) rotate(${n2(r1)})`, o.foreBack && o.foreBack.includes(side) ? foreG + upper : upper + foreG);
}

// o: x,y,s,facing,legs('stand'|'walk'|'sit'|'none'),walk,armL,armR,expr,look,blink,hat,vest,bob,lean,headTilt,holdL,holdR...
function dad(o = {}) {
  const p = Object.assign({}, PAL.dad, o.pal || {});
  const facing = o.facing || 'front';
  const oo = Object.assign({}, o, { facing });
  const aL = o.armL || [8, 12], aR = o.armR || [8, 12];
  let legsBack = '', legsFront = '', upShift = 0;
  if (o.legs === 'sit') { const L = dadLegsSit(p, oo); legsBack = L.back; legsFront = L.front; upShift = 96; }
  else if (o.legs !== 'none') legsBack = dadLegsStand(p, oo);
  const bob = (o.bob || 0) + upShift;
  const head = G(`translate(0,-202) rotate(${n2(o.headTilt || 0)}) translate(${n2(o.headX || 0)},-50)`, dadHead(p, oo));
  let arms = '';
  if (facing === 'back') arms = dadArm(p, -1, aL, oo) + dadArm(p, 1, aR, oo);
  else arms = dadArm(p, -1, aL, oo) + dadArm(p, 1, aR, oo);
  const body = G(`translate(0,${n2(bob)}) rotate(${n2(o.lean || 0)} 0 -96)`, facing === 'back' ? arms + dadTorso(p, oo) + head : dadTorso(p, oo) + head + (o.armsBehindKnees ? '' : ''));
  const armsG = facing === 'back' ? '' : G(`translate(0,${n2(bob)}) rotate(${n2(o.lean || 0)} 0 -96)`, arms);
  const inner = legsBack + body + legsFront + (o.mid || '') + armsG + (o.extra || '');
  const sx = (o.s || 1) * (o.flip ? -1 : 1), sy = o.s || 1;
  return `<g transform="translate(${n2(o.x || 0)},${n2(o.y || 0)}) rotate(${n2(o.rot || 0)}) scale(${n2(sx)},${n2(sy)})">${inner}</g>`;
}
// world position of a dad's hand (for placing props)
function dadHandWorld(o, side) {
  const a = side < 0 ? o.armL || [8, 12] : o.armR || [8, 12];
  const [hx, hy] = dadHandPos(side, a[0], a[1]);
  const s = o.s || 1, f = o.flip ? -1 : 1;
  const bob = (o.bob || 0) + (o.legs === 'sit' ? 96 : 0);
  return [(o.x || 0) + hx * s * f, (o.y || 0) + (hy + bob) * s];
}

/* ======================= KIDS ======================= */
const KID_EXPR = {
  smile: { mouth: 'smile', brow: 2 },
  big: { mouth: 'big', brow: 4, browY: -3 },
  happy: { eyes: 'happy', mouth: 'big', brow: 4 },
  grin: { eyes: 'happy', mouth: 'smile', brow: 3 },
  wow: { eyes: 'wide', mouth: 'o', brow: 8, browY: -5 },
  sad: { mouth: 'frown', brow: 14, lid: 0.15 },
  worried: { mouth: 'small', brow: 14, wet: true },
  determined: { mouth: 'flat', brow: -10, lid: 0.15 },
  sleep: { eyes: 'shut', mouth: 'small', brow: 2 },
  cry: { eyes: 'squeeze', mouth: 'big', brow: 14, tears: true },
  squeeze: { eyes: 'squeeze', mouth: 'flat', brow: -6 },
};

function kidEye(cx, cy, side, e, o, p) {
  const blink = o.blink || 0, look = o.look || [0, 0];
  const type = blink > 0.82 ? 'shut' : e.eyes || 'open';
  if (type === 'happy') return PS(`M${cx - 10},${cy + 4} Q${cx},${cy - 8} ${cx + 10},${cy + 4}`, OUT, 3.6);
  if (type === 'shut') return PS(`M${cx - 10},${cy + 1} Q${cx},${cy + 7} ${cx + 10},${cy + 1}`, OUT, 3.4);
  if (type === 'squeeze') {
    const d = side < 0 ? `M${cx - 10},${cy - 6} L${cx + 6},${cy} L${cx - 10},${cy + 6}` : `M${cx + 10},${cy - 6} L${cx - 6},${cy} L${cx + 10},${cy + 6}`;
    return PS(d, OUT, 3.4);
  }
  const wide = type === 'wide', rx = 11.5, ry = 13;
  const ix = cx + look[0] * 3.4, iy = cy + look[1] * 3 + 1, ir = wide ? 0.78 : 1;
  let s = E(cx, cy, rx, ry, '#fff', 2.6);
  s += E(ix, iy, 8 * ir, 9.6 * ir, p.iris, 0) + E(ix, iy + 1, 4.2 * ir, 5 * ir, '#1d1620', 0);
  s += C(ix + 2.8, iy - 3.6, 3, '#fff', 0) + C(ix - 3, iy + 3.6, 1.5, '#fff', 0);
  if (e.wet) s += PS(`M${cx - 9},${cy + 9} Q${cx},${cy + 14} ${cx + 9},${cy + 9}`, '#8fd0ff', 2.8);
  const lid = clamp((e.lid || 0) + blink * (1 - (e.lid || 0)));
  if (lid > 0.02) s += lidSvg(cx, cy, rx, ry, lid, p.skin, 2.8);
  return s;
}
function kidMouth(kind) {
  switch (kind) {
    case 'big': return P('M-12,20 Q0,22 12,20 Q10,36 0,36 Q-10,36 -12,20 Z', '#8a2a3a', 2.6) + P('M-6,32 Q0,27 6,32 Q3,35.5 0,35.5 Q-3,35.5 -6,32 Z', '#ef7b8a', 0);
    case 'o': return E(0, 27, 5.5, 7, '#8a2a3a', 2.6);
    case 'frown': return PS('M-8,29 Q0,23 8,29', OUT, 2.8);
    case 'small': return PS('M-4,26 Q0,24 4,26', OUT, 2.6);
    case 'flat': return PS('M-7,26 L7,26', OUT, 2.8);
    default: return PS('M-9,22 Q0,31 9,22', OUT, 2.8);
  }
}
function kidHead(p, who, o) {
  const e = Object.assign({}, KID_EXPR[o.expr || 'smile'] || KID_EXPR.smile, o.face || {});
  let s = '';
  if (who === 'lily') {
    s += E(0, -4, 50, 47, p.hair, 3);
    for (const sd of [-1, 1]) s += E(sd * 54, 12, 13, 21, p.hair, 3, `transform="rotate(${sd * -12} ${sd * 54} 12)"`) + C(sd * 46, -4, 5.5, p.band, 2.2);
  }
  s += E(-44, 6, 7, 10, p.skin, 2.6) + E(44, 6, 7, 10, p.skin, 2.6);
  s += P('M-45,-4 C-46,-34 -24,-44 0,-44 C24,-44 46,-34 45,-4 C45,24 26,42 0,42 C-26,42 -45,24 -45,-4 Z', p.skin, 3);
  s += E(-28, 17, 8.5, 5, '#ff8080', 0, 'opacity="0.42"') + E(28, 17, 8.5, 5, '#ff8080', 0, 'opacity="0.42"');
  s += kidEye(-17, 2, -1, e, o, p) + kidEye(17, 2, 1, e, o, p);
  const by = -18 + (e.browY || 0), ba = e.brow || 0, bc = who === 'lily' ? p.hairSh : '#5a3620';
  s += G(`translate(-17,${by}) rotate(${-ba})`, PS('M-7,1 Q0,-2 7,0', bc, 3.4)) + G(`translate(17,${by}) rotate(${ba})`, PS('M-7,0 Q0,-2 7,1', bc, 3.4));
  s += PS('M-2,13 Q2,16 4.5,13', p.skinSh, 2.4);
  s += kidMouth(e.mouth);
  if (e.tears) for (const sd of [-1, 1]) s += P(`M${sd * 17 - 5},10 Q${sd * 22},26 ${sd * 19},38 Q${sd * 25},26 ${sd * 17 + 5},10 Z`, '#9fd8ff', 1.6, 'opacity="0.9"');
  if (who === 'jake') {
    if (o.cap) {
      s += P('M-46,-12 C-47,-48 -22,-60 0,-60 C22,-60 47,-48 46,-12 Z', '#d8463c', 3) + C(0, -60, 4, '#b8352d', 2) + TX(0, -34, 'T', 18, '#fff', { weight: 900 });
      s += P('M-52,-14 Q0,-26 52,-14 Q60,-6 46,-3 Q0,-13 -46,-3 Q-60,-6 -52,-14 Z', '#b8352d', 3);
    } else {
      s += P('M-47,-2 C-52,-38 -26,-56 2,-55 C30,-56 53,-38 46,-2 L41,-14 L36,-6 L31,-22 L21,-15 L13,-28 L3,-17 L-7,-30 L-15,-17 L-27,-24 L-33,-10 L-42,-16 Z', p.hair, 3);
      s += P('M-6,-54 L2,-68 L8,-53 Z', p.hair, 2.6) + P('M8,-54 L20,-63 L19,-50 Z', p.hair, 2.6);
    }
  } else {
    s += P('M-45,-6 C-48,-38 -22,-55 0,-55 C22,-55 48,-38 45,-6 L38,-14 C34,-24 28,-28 22,-23 C16,-33 6,-35 0,-25 C-6,-35 -16,-33 -22,-23 C-28,-28 -34,-24 -38,-14 Z', p.hair, 3);
    s += PS('M-22,-44 Q-8,-50 8,-47', '#ffe08f', 3, 'opacity="0.8"');
  }
  return s;
}
function kidHandPos(side, a1, a2) {
  const sx = side * 31, sy = -92;
  const r1 = -side * a1 * DEG, r2 = r1 + side * a2 * DEG;
  const ex = sx - Math.sin(r1) * 26, ey = sy + Math.cos(r1) * 26;
  return [ex - Math.sin(r2) * 26, ey + Math.cos(r2) * 26];
}
function kidArm(p, side, a, o, who, outfit) {
  const sx = side * 31, sy = -92, r1 = -side * a[0], r2 = side * a[1];
  const sleeveCol = outfit === 'pj' ? p.pj : who === 'jake' ? (outfit === 'uniform' ? '#ffffff' : p.sleeve) : p.dress;
  const longSleeve = outfit === 'pj';
  const hold = side < 0 ? o.holdL : o.holdR, holdBack = side < 0 ? o.holdLBack : o.holdRBack;
  let fore = R(-8, 24, 16, 26, 8, longSleeve ? sleeveCol : p.skin, 2.8);
  if (holdBack) fore += G('translate(0,52)', holdBack);
  fore += C(0, 52, 9.5, p.skin, 2.8);
  if (hold) fore += G('translate(0,52)', hold);
  const upper = R(-10, -6, 20, 32, 10, sleeveCol, 2.8);
  return G(`translate(${sx},${sy}) rotate(${n2(r1)})`, upper + G(`translate(0,25) rotate(${n2(r2)}) translate(0,-25)`, fore));
}
// o: who('jake'|'lily'), outfit('tee'|'pj'|'uniform'|'dress'), x,y,s, armL, armR, expr, look, blink, cap, walk/jump, bob
function kid(o = {}) {
  const who = o.who || 'jake', p = PAL[who];
  const outfit = o.outfit || (who === 'jake' ? 'tee' : 'dress');
  const aL = o.armL || [10, 10], aR = o.armR || [10, 10];
  let legs = '', torso = '';
  const pantsCol = outfit === 'pj' ? p.pj : who === 'jake' ? (outfit === 'uniform' ? '#f4f1ea' : p.pants) : p.skin;
  for (const sd of [-1, 1]) {
    const lift = o.legs === 'walk' ? Math.max(0, Math.sin((o.walk || 0) * Math.PI * 2) * sd) * 7 : 0;
    const long = outfit === 'pj' || outfit === 'uniform';
    legs += R(sd * 15 - 11, -58, 22, long ? 46 - lift : 46 - lift, 8, long ? pantsCol : p.skin, 2.8);
    if (who === 'jake' && outfit === 'tee') legs += R(sd * 15 - 13, -60, 26, 26, 6, p.pants, 2.8);
    if (outfit === 'uniform') legs += R(sd * 15 - 12, -26 - lift, 24, 9, 3, '#d8463c', 2.4);
    const shoe = who === 'jake' ? p.shoe : p.shoe;
    legs += P(`M${sd * 15 - 13},${-14 - lift} L${sd * 15 + 13},${-14 - lift} Q${sd * 15 + 17},${-2 - lift} ${sd * 15 + 11},${1 - lift} L${sd * 15 - 11},${1 - lift} Q${sd * 15 - 17},${-2 - lift} ${sd * 15 - 13},${-14 - lift} Z`, outfit === 'pj' ? '#f2efe8' : shoe, 2.6);
    legs += R(sd * 15 - 15, -4 - lift, 30, 6, 3, outfit === 'pj' ? '#d6d0c4' : p.sole, 2.2);
  }
  const torsoD = 'M-28,-98 Q-38,-96 -38,-82 L-34,-54 Q0,-50 34,-54 L38,-82 Q38,-96 28,-98 Q0,-102 -28,-98 Z';
  if (who === 'jake') {
    const col = outfit === 'pj' ? p.pj : outfit === 'uniform' ? '#ffffff' : p.tee;
    torso += P(torsoD, col, 3);
    if (outfit === 'tee') torso += PS('M-12,-98 Q0,-90 12,-98', p.sleeve, 3.2) + TX(0, -74, '7', 22, p.sleeve, { weight: 900 });
    if (outfit === 'uniform') torso += PS('M-10,-98 L0,-86 L10,-98', '#d8463c', 3) + TX(0, -72, '7', 22, '#d8463c', { weight: 900 }) + PS('M-34,-56 Q0,-52 34,-56', '#d8463c', 3);
    if (outfit === 'pj') torso += C(-14, -82, 2.6, '#ffe58a', 0) + C(12, -70, 2.6, '#ffe58a', 0) + C(-4, -62, 2.2, '#ffe58a', 0) + C(18, -88, 2, '#ffe58a', 0);
  } else {
    if (outfit === 'pj') torso += P(torsoD, p.pj, 3) + C(-12, -80, 3, '#fff', 0, 'opacity=".8"') + C(12, -68, 3, '#fff', 0, 'opacity=".8"');
    else {
      torso += P('M-34,-58 Q0,-54 34,-58 L46,-28 Q0,-21 -46,-28 Z', p.dress, 3) + P(torsoD, p.dress, 3);
      torso += P('M-14,-99 Q0,-92 14,-99 Q8,-88 0,-90 Q-8,-88 -14,-99 Z', '#fff', 2.2);
    }
  }
  const head = G(`translate(0,-142) rotate(${n2(o.headTilt || 0)})`, kidHead(p, who, o));
  const arms = kidArm(p, -1, aL, o, who, outfit) + kidArm(p, 1, aR, o, who, outfit);
  const bob = o.bob || 0;
  const inner = legs + G(`translate(0,${n2(bob)})`, torso + head + arms);
  const sx = (o.s || 1) * (o.flip ? -1 : 1), sy = o.s || 1;
  return `<g transform="translate(${n2(o.x || 0)},${n2(o.y || 0)}) rotate(${n2(o.rot || 0)}) scale(${n2(sx)},${n2(sy)})">${inner}</g>`;
}
function kidHandWorld(o, side) {
  const a = side < 0 ? o.armL || [10, 10] : o.armR || [10, 10];
  const [hx, hy] = kidHandPos(side, a[0], a[1]);
  const s = o.s || 1, f = o.flip ? -1 : 1;
  return [(o.x || 0) + hx * s * f, (o.y || 0) + (hy + (o.bob || 0)) * s];
}
// head only (for close-ups / peeking / sleeping)
function kidHeadAt(who, x, y, s, o = {}) { return G(`translate(${n2(x)},${n2(y)}) rotate(${n2(o.rot || 0)}) scale(${n2(s)})`, kidHead(PAL[who], who, o)); }
function dadHeadAt(x, y, s, o = {}) { return G(`translate(${n2(x)},${n2(y)}) rotate(${n2(o.rot || 0)}) scale(${n2(s)})`, dadHead(Object.assign({}, PAL.dad, o.pal || {}), o)); }

/* ======================= CROWD (flat silhouettes) ======================= */
function crowdPerson(x, y, s, col, t = 0, ph = 0, cheer = 0) {
  const b = Math.abs(Math.sin(t * 6 + ph)) * 6 * cheer;
  let arms = '';
  if (cheer > 0.3) arms = PS(`M-26,-58 L-40,${-110 - b} M26,-58 L40,${-110 - b}`, col, 16);
  return G(`translate(${n2(x)},${n2(y - b)}) scale(${n2(s)})`, arms + P('M-34,0 L-34,-50 Q-34,-74 0,-74 Q34,-74 34,-50 L34,0 Z', col, 0) + C(0, -100, 26, col, 0));
}
