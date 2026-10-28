// Jointed string puppets, built from separate flat SVG parts.
// Every puppet: a body group (with its own cream glow filter), nested part
// groups that rotate at their joints, and a strings path in scene space that
// is recomputed from forward kinematics each frame.

let _uid = 0;
const uid = p => p + (_uid++);
const defs = () => document.getElementById('defs');
const shade = (c, k = 0.2) => mixColor(c, '#000000', k);

function glowFilter(color = PAL.cream, op = 0.45, dev = 9) {
  const id = uid('glow');
  const f = el('filter', { id, x: '-60%', y: '-40%', width: '220%', height: '180%', 'color-interpolation-filters': 'sRGB' }, defs());
  el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: dev, result: 'b' }, f);
  const ct = el('feComponentTransfer', { in: 'b', result: 'b2' }, f);
  el('feFuncA', { type: 'linear', slope: 1.7 }, ct);
  const flood = el('feFlood', { 'flood-color': color, 'flood-opacity': op, result: 'c' }, f);
  el('feComposite', { in: 'c', in2: 'b2', operator: 'in', result: 'g' }, f);
  const mg = el('feMerge', {}, f);
  el('feMergeNode', { in: 'g' }, mg);
  el('feMergeNode', { in: 'SourceGraphic' }, mg);
  return { url: `url(#${id})`, flood, op };
}

// Round wooden joint peg.
function joint(p, x, y, r = 9) {
  const g = el('g', {}, p);
  el('circle', { cx: x, cy: y, r, fill: PAL.wood, class: 'o', 'stroke-width': 2 }, g);
  el('path', { d: `M${x - r * 0.62} ${y - r * 0.1}A${r * 0.62} ${r * 0.62} 0 0 1 ${x + r * 0.1} ${y - r * 0.62}`, fill: 'none', stroke: '#D9AE73', 'stroke-width': Math.max(1.4, r * 0.22), 'stroke-linecap': 'round' }, g);
  el('circle', { cx: x, cy: y, r: r * 0.24, fill: PAL.woodDark }, g);
  return g;
}

// A rotating part: translate(x,y) rotate(r) [scale].
function part(parent, x, y) {
  const P = { g: el('g', {}, parent), x, y, r: 0, sx: 1, sy: 1 };
  applyPart(P);
  return P;
}
function applyPart(P) {
  let t = `translate(${P.x.toFixed(2)} ${P.y.toFixed(2)}) rotate(${P.r.toFixed(3)})`;
  if (P.sx !== 1 || P.sy !== 1) t += ` scale(${P.sx.toFixed(4)} ${P.sy.toFixed(4)})`;
  setT(P.g, t);
}
const partM = P => M2.T(P.x, P.y).mul(M2.R(P.r)).mul(M2.S(P.sx, P.sy));

function stringsPath(attach, cx, topY = -320, spread = 0.55) {
  let d = '';
  for (const [x, y] of attach) {
    const tx = cx + (x - cx) * spread;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}L${tx.toFixed(1)} ${topY}`;
  }
  return d;
}

// ---------------------------------------------------------------- heads ----
// Head local space: origin at the neck base, facing +x, up is -y.
const FACE = 'M-14 -26C-36 -36 -46 -70 -42 -98C-38 -128 -10 -142 16 -138C34 -134 44 -122 45 -106' +
  'C46 -100 46 -96 50 -90L60 -74C62 -70 58 -66 52 -67L49 -66C50 -62 50 -60 47 -58C50 -56 49 -52 45 -50' +
  'C46 -44 42 -38 34 -36C24 -34 18 -30 16 -24C4 -20 -6 -20 -14 -26Z';

function drawHead(g, o) {
  const skin = o.skin;
  // hair at the nape (under headwear)
  if (o.hair) shape(g, 'M-44 -96C-50 -70 -40 -44 -20 -34L-10 -60L-14 -98Z', o.hair);
  shape(g, FACE, skin);
  // ear
  shape(g, 'M-2 -90C-12 -92 -15 -74 -6 -68C-1 -70 0 -84 -2 -90Z', shade(skin, 0.08));
  el('path', { d: 'M-5 -84Q-9 -80 -6 -74', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.5 }, g);
  // cheek blush
  el('circle', { cx: 22, cy: -70, r: o.child ? 9 : 8, fill: '#D9785A', opacity: 0.38 }, g);
  // nostril + mouth
  el('path', { d: 'M50 -70Q53 -68 55 -70', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.6 }, g);
  if (o.cry) {
    shape(g, 'M40 -58Q46 -60 50 -56Q48 -49 42 -50Q38 -53 40 -58Z', '#5A2018', { 'stroke-width': 1.6 });
  } else {
    el('path', { d: 'M41 -58Q45 -56 48 -58', fill: 'none', stroke: PAL.ink, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
  }
  // eye: big almond, or closed/crying arcs
  if (o.eyes === 'closed') {
    el('path', { d: 'M14 -91Q26 -84 38 -91', fill: 'none', stroke: PAL.ink, 'stroke-width': 2.8, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M17 -89l-2 4M23 -87l-1 4M29 -87l0 4M35 -88l1 4', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.3 }, g);
  } else if (o.eyes === 'cry') {
    el('path', { d: 'M14 -90Q26 -98 38 -90', fill: 'none', stroke: PAL.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    el('path', { d: 'M16 -88Q26 -84 36 -88', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.6, 'stroke-linecap': 'round' }, g);
  } else {
    const eg = el('g', { transform: 'translate(26 -92) scale(1.28) translate(-26 92)' }, g);
    shape(eg, 'M13 -92Q26 -102 39 -93Q28 -84 13 -92Z', '#FBF6EA', { 'stroke-width': 1.8 });
    el('circle', { cx: 29.5, cy: -92.5, r: 4.6, fill: '#1A100A' }, eg);
    el('circle', { cx: 31.2, cy: -94.4, r: 1.5, fill: '#fff' }, eg);
    el('path', { d: 'M12 -92Q26 -103 40 -93L45 -96', fill: 'none', stroke: '#1A100A', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, eg);
  }
  const brow = o.eyes === 'cry' ? 'M14 -106Q26 -108 40 -114' : 'M12 -108Q28 -116 44 -107';
  el('path', { d: brow, fill: 'none', stroke: o.browColor || '#24160E', 'stroke-width': 4, 'stroke-linecap': 'round' }, g);

  // beards
  const B = o.beard;
  if (B === 'short') {
    shape(g, 'M-6 -88C-10 -64 2 -42 20 -32C32 -26 46 -30 49 -44C49 -50 47 -52 44 -50C40 -45 31 -45 26 -50C20 -57 8 -66 2 -88Z', o.beardColor);
    shape(g, 'M35 -61C41 -66 48 -65 53 -61C48 -58 41 -58 35 -61Z', o.beardColor, { 'stroke-width': 1.5 });
  } else if (B === 'neat') {
    shape(g, 'M-6 -90C-12 -60 -2 -30 18 -20C32 -14 46 -20 50 -36C51 -46 49 -52 45 -51C40 -46 31 -46 26 -51C18 -58 8 -68 2 -90Z', o.beardColor);
    shape(g, 'M34 -61C41 -67 49 -66 54 -61C49 -57 41 -57 34 -61Z', o.beardColor, { 'stroke-width': 1.5 });
    el('path', { d: 'M6 -60Q12 -44 26 -34M14 -66Q20 -50 34 -40', fill: 'none', stroke: shade(o.beardColor, 0.3), 'stroke-width': 1.4 }, g);
  } else if (B === 'long') {
    shape(g, 'M-8 -92C-16 -60 -6 -24 10 0C18 12 28 22 34 30C38 14 44 -2 48 -20C52 -34 51 -48 46 -51C41 -46 31 -46 26 -51C18 -58 8 -70 2 -92Z', o.beardColor);
    shape(g, 'M33 -61C40 -68 50 -67 56 -60C50 -56 40 -56 33 -61Z', o.beardColor, { 'stroke-width': 1.5 });
    el('path', { d: 'M4 -60Q8 -30 22 4M14 -52Q20 -24 30 14M24 -44Q30 -20 38 -6', fill: 'none', stroke: '#A9A49B', 'stroke-width': 1.5 }, g);
  } else if (B === 'stubble') {
    const pts = [];
    const r = rng(7);
    for (let i = 0; i < 46; i++) {
      const u = r(), v = r();
      const x = lerp(-2, 44, u), y = lerp(-80, -34, v);
      if (y > -76 + u * 26 - 6 && y < -36 - (1 - u) * 6 && !(x > 36 && y < -54)) pts.push([x, y]);
    }
    el('path', { d: dotPath(pts, 1.1), fill: '#3A2A20', opacity: 0.75 }, g);
  }

  // headwear
  const H = o.hat;
  if (H === 'turban' || H === 'turbanBand') {
    shape(g, 'M-50 -94C-66 -126 -46 -182 4 -182C52 -182 68 -140 50 -100C30 -90 -30 -88 -50 -94Z', o.hatColor);
    const L = o.hatLine;
    el('path', { d: 'M-52 -110C-20 -98 20 -102 55 -120M-52 -130C-14 -116 24 -122 58 -144M-42 -154C-10 -140 20 -146 46 -166', fill: 'none', stroke: L, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, g);
    if (H === 'turbanBand') {
      shape(g, 'M-54 -112C-20 -100 20 -104 56 -122L57 -108C22 -92 -20 -88 -52 -98Z', PAL.gold, { 'stroke-width': 1.8 });
      el('path', { d: dotPath(samplePath('M-48 -104C-16 -94 18 -98 52 -114', 9), 1.6), fill: PAL.maroon }, g);
      shape(g, 'M42 -128l7 -9l7 9l-7 9Z', PAL.gold, { 'stroke-width': 1.6 });
      el('circle', { cx: 49, cy: -128, r: 3, fill: PAL.maroon }, g);
    } else {
      el('path', { d: dotPath(samplePath('M-48 -100C-16 -90 18 -94 52 -108', 10), 1.5), fill: shade(o.hatColor, 0.25) }, g);
    }
  } else if (H === 'wrap') {
    shape(g, 'M-42 -102C-60 -96 -66 -70 -58 -46L-46 -50C-50 -70 -46 -86 -34 -100Z', shade(o.hatColor, 0.08));
    shape(g, 'M-50 -96C-60 -124 -38 -154 4 -154C46 -154 60 -128 50 -102C30 -94 -30 -92 -50 -96Z', o.hatColor);
    el('path', { d: 'M-50 -112C-20 -102 20 -106 54 -120M-44 -134C-12 -122 22 -128 50 -142', fill: 'none', stroke: shade(o.hatColor, 0.22), 'stroke-width': 2.2 }, g);
  } else if (H === 'cap') {
    shape(g, 'M-40 -106C-44 -136 -18 -152 8 -150C34 -148 48 -132 44 -110C20 -102 -16 -100 -40 -106Z', o.hatColor);
    el('path', { d: dotPath(samplePath('M-38 -112C-14 -106 18 -106 42 -116', 9), 1.6), fill: shade(o.hatColor, 0.3) }, g);
  } else if (H === 'scarf') {
    // head covering: frames the face and drapes behind the neck
    shape(g, 'M44 -110C46 -132 28 -150 2 -152C-30 -154 -54 -132 -56 -98C-58 -70 -54 -40 -62 -8L-30 2C-26 -14 -20 -26 -12 -34C-2 -44 4 -60 4 -78C10 -96 26 -104 44 -110Z', o.hatColor);
    el('path', { d: 'M40 -112C26 -106 10 -98 6 -80C4 -60 -4 -44 -14 -32', fill: 'none', stroke: shade(o.hatColor, 0.3), 'stroke-width': 2 }, g);
    el('path', { d: dotPath(samplePath('M40 -116C22 -110 6 -100 2 -80C0 -62 -8 -46 -18 -34', 9), 1.6), fill: o.scarfDot || PAL.dot }, g);
  }
}

// ---------------------------------------------------------- characters ----
const CHAR = {
  man1: { skin: '#D9A06B', robe: '#B08A5E', trim: '#E9DCC0', trimDot: '#7A5A3A', edgeDot: PAL.dot, sash: '#24533D', sashDot: PAL.dot,
    trouser: '#E6D8BA', hat: 'turban', hatColor: '#F4F0E6', hatLine: '#BDB29E', beard: 'short', beardColor: '#1C130E', hair: '#1C130E', shoe: 'sandal' },
  man2: { skin: '#CF9564', robe: '#2F6B4F', trim: PAL.cream, trimDot: '#2F6B4F', edgeDot: PAL.cream, sash: PAL.maroon, sashDot: PAL.cream,
    trouser: '#DCCDAA', hat: 'turban', hatColor: PAL.maroon, hatLine: '#4E1A1A', beard: 'neat', beardColor: '#3B2416', hair: '#3B2416', shoe: 'sandal' },
  man3: { skin: '#E1B07E', robe: '#33407A', trim: PAL.gold, trimDot: '#5A4410', edgeDot: PAL.gold, sash: PAL.maroon, sashDot: PAL.gold,
    trouser: '#E9DFC8', hat: 'turbanBand', hatColor: PAL.cream, hatLine: '#C8B78F', beard: 'long', beardColor: '#E8E4DC', hair: '#CFCAC0',
    browColor: '#BDB7AC', shoe: 'slipper', robeDots: PAL.gold },
  worker: { skin: '#B57A4C', robe: '#C2A47C', trim: '#A88B62', trimDot: '#E6D6B4', edgeDot: '#EFE3C8', sash: '#7E6142', sashDot: '#D8C6A0',
    trouser: '#B9A47E', hat: 'wrap', hatColor: '#DCCDA8', beard: 'stubble', hair: '#2A1C14', shoe: 'bare', thin: true, patches: true, bundle: true },
};

const D = { WAIST: -262, HIP_Y: 20, HIP_XF: 12, HIP_XB: -12, THIGH: 140, SHIN: 78, SH_Y: -140, SH_XF: 6, SH_XB: -12, UA: 100, FA: 88, NECK: [6, -158] };

class Human {
  constructor(parent, key, opts = {}) {
    this.o = Object.assign({}, CHAR[key], opts);
    this.key = key;
    this.wrap = el('g', {}, parent);
    this.shadowEl = el('ellipse', { rx: 80, ry: 15, fill: 'url(#shadowGrad)' }, this.wrap);
    this.glow = glowFilter(PAL.cream, 0.42, 9);
    this.body = el('g', { filter: this.glow.url }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.P = {};
    this.build();
    this.pose = Human.rest();
  }

  static rest() {
    return { x: 0, y: 0, s: 1, dir: 1, sway: 0, bob: 0, lift: 0, lean: 0, head: 0,
      armF: [-8, -10, 0], armB: [8, -8, 0], legF: [0, 0], legB: [0, 0], open: false, hold: false,
      glow: 0.42, alpha: 1, strings: true };
  }

  build() {
    const o = this.o, P = this.P, b = this.body;
    P.legB = this.leg(b, D.HIP_XB, true);
    P.legF = this.leg(b, D.HIP_XF, false);
    P.torso = part(b, 0, D.WAIST);
    const T = P.torso.g;
    P.armB = this.arm(T, D.SH_XB, D.SH_Y, true);
    if (o.bundle) this.bundle(T, 'back');
    this.robe(T);
    // neck + collar sit on the torso so a long beard can overlap them
    shape(T, 'M-10 -150L-10 -192L22 -192L22 -150Z', shade(o.skin, 0.12));
    shape(T, 'M-26 -164Q0 -146 24 -166L28 -154Q0 -132 -30 -152Z', o.trim, { 'stroke-width': 2 });
    el('path', { d: dotPath(samplePath('M-26 -156Q0 -140 24 -158', 8), 1.6), fill: o.trimDot }, T);
    if (o.bundle) this.bundle(T, 'strap');
    P.head = part(T, D.NECK[0], D.NECK[1]);
    drawHead(P.head.g, o);
    P.armF = this.arm(T, D.SH_XF, D.SH_Y, false);
    if (o.bowl) this.bowl(P.armF.wr.g);
  }

  robe(T) {
    const o = this.o;
    const g = el('g', {}, T);
    if (o.thin) setT(g, 'scale(0.86 1)');
    const body = 'M-24 -162C-40 -160 -54 -152 -56 -138C-60 -100 -56 -40 -50 -6C-60 40 -70 100 -78 142' +
      'Q2 156 82 142C76 100 66 40 54 -4C64 -40 66 -100 52 -140C46 -154 34 -162 22 -164Q0 -150 -24 -162Z';
    shape(g, body, o.robe);
    // soft fold shading on the back half
    el('path', { d: 'M-50 -6C-60 40 -70 100 -78 142Q-50 147 -30 149C-34 100 -34 40 -30 -4Z', fill: '#000', opacity: 0.12 }, g);
    el('path', { d: 'M8 10C10 60 14 100 18 146M-14 12C-16 60 -18 100 -20 148', fill: 'none', stroke: shade(o.robe, 0.28), 'stroke-width': 2 }, g);
    if (o.robeDots) {
      const pts = [];
      for (let y = -120; y < 130; y += 26) for (let x = -44; x < 60; x += 24) pts.push([x + ((y / 26) % 2 ? 12 : 0), y]);
      el('path', { d: dotPath(pts.filter(([x, y]) => y < -20 || y > 22), 2), fill: o.robeDots, opacity: 0.9 }, g);
    }
    if (o.patches) {
      shape(g, 'M-40 40L-12 36L-10 66L-38 70Z', '#A88B62', { 'stroke-width': 1.8 });
      el('path', { d: 'M-36 44L-14 41M-34 64L-14 61', fill: 'none', stroke: '#EFE3C8', 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, g);
      shape(g, 'M24 -96L46 -98L48 -74L26 -72Z', '#D6BF94', { 'stroke-width': 1.8 });
      el('path', { d: 'M28 -92L44 -94M30 -76L44 -78', fill: 'none', stroke: '#6E5434', 'stroke-width': 1.4, 'stroke-dasharray': '3 3' }, g);
      shape(g, 'M30 90L56 86L60 112L34 116Z', '#9E8158', { 'stroke-width': 1.8 });
    }
    // hem band + dots
    shape(g, 'M-76 126Q2 140 80 126L82 142Q2 156 -78 142Z', o.trim, { 'stroke-width': 2 });
    el('path', { d: dotPath(samplePath('M-72 134Q2 148 78 134', 10), 2), fill: o.trimDot }, g);
    // front edge dotted trim
    el('path', { d: dotPath(samplePath('M20 -156C46 -136 58 -90 48 -10C60 40 70 90 74 124', 11), 2), fill: o.edgeDot }, g);
    // sash
    shape(g, 'M-53 -16C-10 -6 30 -6 56 -18L57 8C30 18 -10 18 -54 10Z', o.sash, { 'stroke-width': 2.2 });
    el('path', { d: dotPath(samplePath('M-50 -3C-10 6 30 6 54 -5', 9), 1.9), fill: o.sashDot }, g);
    shape(g, 'M34 8L26 70L40 74L50 10Z', o.sash, { 'stroke-width': 2 });
    el('path', { d: dotPath([[27, 78], [33, 80], [39, 80]], 2.2), fill: o.sashDot }, g);
    el('path', { d: dotPath(samplePath('M38 16L33 62', 10), 1.7), fill: o.sashDot }, g);
    // chest motif
    el('path', { d: dotPath([[26, -96], [20, -88], [32, -88], [26, -80], [26, -88]], 2.1), fill: o.edgeDot }, g);
  }

  bundle(T, which) {
    if (which === 'back') {
      shape(T, 'M-48 -150C-96 -158 -112 -98 -98 -62C-86 -36 -52 -40 -44 -64C-40 -90 -38 -130 -48 -150Z', '#8F7A5A');
      el('path', { d: 'M-90 -126C-80 -110 -84 -84 -96 -72M-72 -144C-64 -120 -62 -90 -70 -56', fill: 'none', stroke: '#6B5A40', 'stroke-width': 2 }, T);
      el('path', { d: dotPath(samplePath('M-92 -112C-84 -96 -86 -80 -92 -70', 8), 1.6), fill: '#D8C6A0' }, T);
    } else {
      shape(T, 'M-30 -158L-18 -160L40 -40L28 -36Z', '#7A6648', { 'stroke-width': 1.8 });
      shape(T, 'M30 -48C40 -56 50 -44 42 -36C36 -30 26 -38 30 -48Z', '#8F7A5A', { 'stroke-width': 1.8 });
    }
  }

  leg(parent, x, back) {
    const o = this.o;
    const L = part(parent, x, D.WAIST + D.HIP_Y);
    const tr = back ? shade(o.trouser, 0.18) : o.trouser;
    shape(L.g, `M-17 -6L17 -6L15 ${D.THIGH}L-15 ${D.THIGH}Z`, tr);
    L.knee = part(L.g, 0, D.THIGH);
    const K = L.knee.g;
    shape(K, `M-15 -4L15 -4L12 ${D.SHIN}L-12 ${D.SHIN}Z`, tr);
    shape(K, `M-13.5 ${D.SHIN - 18}L13.5 ${D.SHIN - 18}L12.5 ${D.SHIN}L-12.5 ${D.SHIN}Z`, back ? shade(o.trim, 0.18) : o.trim, { 'stroke-width': 1.8 });
    el('path', { d: dotPath([[-5, D.SHIN - 9], [1, D.SHIN - 9], [7, D.SHIN - 9]], 1.5), fill: o.trimDot }, K);
    L.foot = part(K, 0, D.SHIN);
    const F = L.foot.g, sk = back ? shade(o.skin, 0.15) : o.skin;
    if (o.shoe === 'slipper') {
      shape(F, 'M-12 -2C-14 10 -12 20 -8 24L44 24C54 22 60 14 62 4C56 10 50 12 44 10L12 2Z', back ? shade(PAL.maroon, 0.2) : PAL.maroon);
      el('path', { d: dotPath(samplePath('M-6 18L42 18', 8), 1.4), fill: PAL.gold }, F);
    } else {
      shape(F, 'M-10 -2C-13 8 -12 16 -8 20L40 20C47 20 47 11 40 10L10 3Z', sk);
      if (o.shoe === 'sandal') {
        shape(F, 'M-13 19L46 19Q52 22 46 25L-13 25Q-16 22 -13 19Z', '#6B4426', { 'stroke-width': 1.6 });
        el('path', { d: 'M8 6L16 19M20 10L24 19', fill: 'none', stroke: '#6B4426', 'stroke-width': 3, 'stroke-linecap': 'round' }, F);
      } else {
        el('path', { d: 'M30 12L31 19M36 12L37 19', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.2 }, F);
      }
    }
    joint(K, 0, 0, 10);
    return L;
  }

  arm(parent, x, y, back) {
    const o = this.o;
    const A = part(parent, x, y);
    const robe = back ? shade(o.robe, 0.2) : o.robe, trim = back ? shade(o.trim, 0.2) : o.trim;
    const sk = back ? shade(o.skin, 0.15) : o.skin;
    shape(A.g, `M-18 -6C-18 -18 18 -18 18 -6L15 ${D.UA - 2}C15 ${D.UA + 6} -15 ${D.UA + 6} -15 ${D.UA - 2}Z`, robe);
    A.el = part(A.g, 0, D.UA);
    const E = A.el.g;
    shape(E, `M-15 -6C-15 -12 15 -12 15 -6L13 ${D.FA}L-13 ${D.FA}Z`, robe);
    shape(E, `M-14 ${D.FA - 20}L14 ${D.FA - 20}L13.5 ${D.FA + 2}L-13.5 ${D.FA + 2}Z`, trim, { 'stroke-width': 1.8 });
    el('path', { d: dotPath([[-7, D.FA - 9], [0, D.FA - 9], [7, D.FA - 9]], 1.8), fill: o.trimDot }, E);
    A.wr = part(E, 0, D.FA);
    const W = A.wr.g;
    A.handClosed = el('g', {}, W);
    shape(A.handClosed, 'M-10 -2C-13 10 -13 24 -6 34C0 40 10 38 12 30C14 22 13 10 11 -2Z', sk);
    el('path', { d: 'M11 6C19 9 20 18 13 22', fill: sk, class: 'o' }, A.handClosed);
    el('path', { d: 'M-2 26L6 30', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.2 }, A.handClosed);
    A.handOpen = el('g', { style: 'display:none' }, W);
    shape(A.handOpen, 'M-12 -2C-16 12 -16 24 -12 34L-11 46Q-8 50 -5 46L-4 37L-2 50Q1 53 4 49L4 38L8 47Q11 50 12 46L11 34C14 26 14 12 11 -2Z', sk);
    shape(A.handOpen, 'M11 6C20 4 25 10 23 17C21 21 16 19 12 18Z', sk);
    joint(W, 0, 0, 7);
    joint(E, 0, 0, 8.5);
    joint(A.g, 0, 0, 10);
    return A;
  }

  // Wooden bowl of milk, kept upright in the front hand.
  bowl(W) {
    const g = el('g', {}, W);
    W.insertBefore(g, W.firstChild);
    this.bowlG = g;
    const b = el('g', {}, g);
    shape(b, 'M-44 -6Q-42 30 0 34Q42 30 44 -6Z', '#8A5A30');
    el('path', { d: 'M-40 8Q0 18 40 8', fill: 'none', stroke: '#5C3A1E', 'stroke-width': 2 }, b);
    el('path', { d: dotPath(samplePath('M-38 14Q0 24 38 14', 8), 1.8), fill: PAL.cream }, b);
    shape(b, 'M-44 -6C-44 -16 44 -16 44 -6C44 4 -44 4 -44 -6Z', '#FFFDF6', { 'stroke-width': 2 });
    el('ellipse', { cx: -10, cy: -8, rx: 14, ry: 2.4, fill: '#fff' }, b);
    shape(b, 'M-12 32L12 32L10 40L-10 40Z', '#6E4626', { 'stroke-width': 1.8 });
  }

  update(p) {
    const P = this.P;
    this.pose = p;
    const s = p.s, piv = -600 * s;
    const M0 = M2.T(p.x, p.y + p.bob - p.lift).mul(M2.T(0, piv)).mul(M2.R(p.sway)).mul(M2.T(0, -piv)).mul(M2.S(s * p.dir, s));
    setT(this.body, M0.str());
    P.torso.r = p.lean; P.head.r = p.head;
    P.armF.r = p.armF[0]; P.armF.el.r = p.armF[1]; P.armF.wr.r = p.armF[2];
    P.armB.r = p.armB[0]; P.armB.el.r = p.armB[1]; P.armB.wr.r = p.armB[2];
    P.legF.r = p.legF[0]; P.legF.knee.r = p.legF[1];
    P.legB.r = p.legB[0]; P.legB.knee.r = p.legB[1];
    for (const k of [P.torso, P.head, P.armF, P.armF.el, P.armF.wr, P.armB, P.armB.el, P.armB.wr, P.legF, P.legF.knee, P.legB, P.legB.knee]) applyPart(k);
    show(P.armF.handOpen, p.open); show(P.armF.handClosed, !p.open);
    show(P.armB.handOpen, p.open); show(P.armB.handClosed, !p.open);
    if (this.bowlG) {
      const tot = p.lean + p.armF[0] + p.armF[1] + p.armF[2];
      setT(this.bowlG, `translate(26 ${20}) rotate(${(-tot).toFixed(2)})`);
      show(this.bowlG, p.hold);
    }
    this.glow.flood.setAttribute('flood-opacity', p.glow.toFixed(3));
    this.wrap.setAttribute('opacity', p.alpha.toFixed(3));
    // shadow on the floor
    const lift = Math.max(0, p.lift - p.bob);
    this.shadowEl.setAttribute('cx', p.x.toFixed(1));
    this.shadowEl.setAttribute('cy', (p.y + 2).toFixed(1));
    this.shadowEl.setAttribute('rx', (85 * s * Math.max(0.35, 1 - lift / 700)).toFixed(1));
    this.shadowEl.setAttribute('ry', (16 * s).toFixed(1));
    this.shadowEl.setAttribute('opacity', (Math.max(0, 1 - lift / 900)).toFixed(3));
    // strings: head + both hands
    const Mt = M0.mul(partM(P.torso));
    const head = Mt.mul(partM(P.head)).ap(4, -182);
    const hand = A => Mt.mul(partM(A)).mul(partM(A.el)).mul(partM(A.wr)).ap(0, 24);
    this.attach = [head, hand(P.armF), hand(P.armB)];
    this.str.setAttribute('d', p.strings ? stringsPath(this.attach, head[0]) : '');
  }
}

// Idle life for a standing puppet: pendulum sway + bob + secondary limb lag.
function idle(p, t, seed = 0, amp = 1) {
  p.sway = 1.5 * amp * Math.sin(t * 1.25 + seed * 1.7) + 0.4 * noise1(t * 0.7, seed);
  p.bob = 3.5 * amp * Math.sin(t * 2.1 + seed);
  const lag = 1.6 * amp * Math.sin(t * 1.25 + seed * 1.7 - 0.9);
  p.armF[0] += lag; p.armB[0] += lag * 0.8; p.armF[1] += lag * 0.6;
  p.legF[0] += lag * 0.4; p.legB[0] -= lag * 0.3;
  p.head += 1.2 * Math.sin(t * 0.9 + seed * 2.3);
  return p;
}

// String-puppet hop walk: puppet is lifted and set down each step, legs stiff.
function hopWalk(p, t, t0, t1, x0, x1, opt = {}) {
  const period = opt.period || 0.42, height = opt.height || 26;
  const u = clamp((t - t0) / (t1 - t0));
  const steps = Math.max(1, Math.round((t1 - t0) / period));
  const k = u * steps, i = Math.min(steps - 1, Math.floor(k)), f = u >= 1 ? 1 : k - i;
  const prog = (i + smooth(f)) / steps;
  p.x = lerp(x0, x1, prog);
  const moving = t > t0 && t < t1;
  if (moving) {
    const hop = Math.sin(Math.PI * f);
    p.lift = height * hop;
    const sgn = i % 2 ? 1 : -1;
    const swing = 14 * Math.sin(Math.PI * f) * sgn;
    p.legF[0] = -swing; p.legB[0] = swing;
    p.armF[0] += swing * 0.8; p.armB[0] -= swing * 0.8;
    p.sway = -2.5 * Math.sign(x1 - x0) * hop;
    p.lean = 3 * Math.sign(x1 - x0) * (x1 > x0 ? 1 : -1) * p.dir;
  }
  return moving;
}

// Arm poses (upper, fore, hand) in degrees.
const POSE = {
  rest: { armF: [-8, -10, 0], armB: [8, -8, 0] },
  hold: { armF: [-32, -62, 4], armB: [-26, -70, 4] },
  dua: { armF: [-62, -88, -10], armB: [-50, -96, -10] },
  talk: { armF: [-48, -50, -10], armB: [8, -8, 0] },
  offer: { armF: [-92, -16, -12], armB: [8, -8, 0] },
};
function blendArms(p, a, b, k) {
  for (const side of ['armF', 'armB']) for (let i = 0; i < 3; i++) p[side][i] = lerp(a[side][i], b[side][i], k);
}
// 0..1 envelope that rises at t0, holds, falls.
function pulse(t, t0, up = 0.25, hold = 0.45, down = 0.5) {
  if (t < t0 || t > t0 + up + hold + down) return 0;
  if (t < t0 + up) return smooth((t - t0) / up);
  if (t < t0 + up + hold) return 1;
  return 1 - smooth((t - t0 - up - hold) / down);
}

// ---------------------------------------------------------------- child ----
class Child {
  constructor(parent, girl) {
    this.girl = girl;
    const o = girl
      ? { skin: '#D7A070', robe: PAL.maroon, trim: PAL.cream, dot: PAL.cream, hat: 'scarf', hatColor: PAL.emerald, scarfDot: PAL.cream }
      : { skin: '#D39A68', robe: '#5E7FA3', trim: PAL.cream, dot: PAL.cream, hat: 'cap', hatColor: '#F4F0E6', hair: '#1C130E' };
    this.o = o;
    this.wrap = el('g', {}, parent);
    this.shadowEl = el('ellipse', { rx: 80, ry: 12, fill: 'url(#shadowGrad)' }, this.wrap);
    this.glow = glowFilter(PAL.cream, 0.4, 7);
    this.body = el('g', { filter: this.glow.url }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.tears = el('path', { fill: '#BFE6F2', stroke: '#5A8FA8', 'stroke-width': 1 }, this.wrap);
    const b = this.body;
    // back arm
    this.armB = this.arm(b, -6, -118, true);
    // lap: robe over folded legs, little foot, wooden knee
    shape(b, 'M-58 0C-64 -30 -40 -52 -8 -54L52 -50C72 -48 80 -32 76 -14C74 -4 68 0 60 0Z', o.robe);
    shape(b, 'M-58 -10Q10 -2 76 -12L74 0L-58 0Z', o.trim, { 'stroke-width': 1.8 });
    el('path', { d: dotPath(samplePath('M-52 -5Q10 3 70 -6', 9), 1.7), fill: o.robe }, b);
    shape(b, 'M70 -14C82 -16 92 -10 92 -4C92 0 86 1 70 0Z', o.skin);
    joint(b, 48, -38, 9);
    // torso
    shape(b, 'M-32 -36C-38 -70 -36 -104 -24 -122C-10 -130 14 -130 26 -122C36 -104 36 -70 30 -36Z', o.robe);
    el('path', { d: dotPath(samplePath('M22 -118C30 -96 32 -66 28 -40', 9), 1.8), fill: o.dot }, b);
    shape(b, 'M-14 -124Q4 -112 20 -126L22 -116Q4 -102 -16 -116Z', o.trim, { 'stroke-width': 1.6 });
    this.head = part(b, 4, -122);
    this.head.sx = this.head.sy = 0.78;
    drawHead(this.head.g, { skin: o.skin, hat: o.hat, hatColor: o.hatColor, scarfDot: o.scarfDot, hair: o.hair, eyes: 'cry', cry: true, child: true });
    this.armF = this.arm(b, 8, -118, false);
  }

  arm(parent, x, y, back) {
    const o = this.o;
    const A = part(parent, x, y);
    const robe = back ? shade(o.robe, 0.2) : o.robe, sk = back ? shade(o.skin, 0.15) : o.skin;
    shape(A.g, 'M-12 -4C-12 -12 12 -12 12 -4L10 56L-10 56Z', robe);
    A.el = part(A.g, 0, 56);
    shape(A.el.g, 'M-10 -4L10 -4L9 46L-9 46Z', robe);
    shape(A.el.g, 'M-9.5 36L9.5 36L9 48L-9 48Z', o.trim, { 'stroke-width': 1.5 });
    A.wr = part(A.el.g, 0, 47);
    shape(A.wr.g, 'M-8 -2C-10 8 -9 18 -4 24C2 28 9 24 9 16C10 8 9 2 8 -2Z', sk);
    joint(A.wr.g, 0, 0, 5);
    joint(A.el.g, 0, 0, 6);
    joint(A.g, 0, 0, 7);
    return A;
  }

  update(t, x, y, s, dir, crying, seed) {
    const cry = +crying;
    const shake = cry * (1.6 * Math.sin(t * 31 + seed) + 1.2 * noise1(t * 9, seed));
    const sob = cry * Math.max(0, Math.sin(t * 5.5 + seed)) * 3;
    const sway = 1.2 * Math.sin(t * 1.3 + seed) + shake;
    const piv = -260 * s;
    const M0 = M2.T(x, y - sob).mul(M2.T(0, piv)).mul(M2.R(sway)).mul(M2.T(0, -piv)).mul(M2.S(s * dir, s));
    setT(this.body, M0.str());
    this.head.r = -12 * cry + 2 * Math.sin(t * 1.1 + seed) + shake * 0.8;
    // front hand reaches up (hungry, pleading), back hand on the lap
    const reach = cry * 7 * Math.sin(t * 6 + seed);
    this.armF.r = lerp(-10, -128, cry) + reach; this.armF.el.r = lerp(-10, -22, cry); this.armF.wr.r = lerp(0, -10, cry);
    this.armB.r = lerp(8, -36, cry); this.armB.el.r = lerp(-8, -48, cry); this.armB.wr.r = 0;
    for (const k of [this.head, this.armF, this.armF.el, this.armF.wr, this.armB, this.armB.el, this.armB.wr]) applyPart(k);
    this.shadowEl.setAttribute('cx', x); this.shadowEl.setAttribute('cy', y + 2);
    this.shadowEl.setAttribute('rx', 95 * s); this.shadowEl.setAttribute('ry', 14 * s);
    const head = M0.mul(partM(this.head)).ap(4, -182);
    const hand = A => M0.mul(partM(A)).mul(partM(A.el)).mul(partM(A.wr)).ap(0, 16);
    this.str.setAttribute('d', stringsPath([head, hand(this.armF), hand(this.armB)], head[0]));
    // tears fall from the eye
    let d = '';
    if (crying > 0.5) {
      const eye = M0.mul(partM(this.head)).ap(30, -86);
      for (let i = 0; i < 3; i++) {
        const ph = ((t - seed * 0.13) / 0.75 + i / 3) % 1;
        const tx = eye[0] + dir * (6 + ph * 10), ty = eye[1] + 8 + ph * ph * 120;
        const r = 4.5 * (1 - ph * 0.4);
        d += `M${tx} ${ty - r * 1.8}Q${tx + r} ${ty - r * 0.2} ${tx} ${ty + r}Q${tx - r} ${ty - r * 0.2} ${tx} ${ty - r * 1.8}Z`;
      }
    }
    this.tears.setAttribute('d', d);
  }
}

// ---------------------------------------------------------- parents bed ----
class ParentsBed {
  constructor(parent) {
    this.wrap = el('g', {}, parent);
    this.glow = glowFilter(PAL.cream, 0.32, 8);
    this.body = el('g', { filter: this.glow.url }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    const b = this.body;
    // low wooden bed (origin: floor under the head end)
    shape(b, 'M-10 -70L540 -70L540 -40L-10 -40Z', '#7A4E2C');
    el('path', { d: dotPath(samplePath('M4 -55L526 -55', 14), 2.2), fill: PAL.cream }, b);
    for (const x of [6, 500]) shape(b, `M${x} -42L${x + 26} -42L${x + 22} 0L${x + 4} 0Z`, '#6A4224');
    shape(b, 'M-26 -150L-4 -150L-4 0L-26 0Z', '#7A4E2C');
    joint(b, -15, -150, 11);
    // mattress
    shape(b, 'M-6 -96L536 -96L536 -70L-6 -70Z', '#E9DCC0');
    // pillows
    shape(b, 'M-4 -132C-6 -152 14 -158 40 -154L150 -146C166 -142 166 -104 150 -100L20 -96C0 -96 -2 -114 -4 -132Z', '#C9AE80');
    el('path', { d: dotPath(samplePath('M8 -104L148 -106', 12), 2), fill: PAL.cream }, b);
    const mother = el('g', {}, b), father = el('g', {}, b);
    this.fatherG = father; this.motherG = mother;
    setT(mother, 'translate(178 -166) rotate(-82) scale(0.74)');
    drawHead(mother, { skin: '#DDAE80', hat: 'scarf', hatColor: '#46557F', scarfDot: PAL.cream, eyes: 'closed' });
    drawHead(father, { skin: '#D2A272', hat: 'cap', hatColor: '#F4F0E6', beard: 'long', beardColor: '#E8E4DC', browColor: '#C9C3B8', eyes: 'closed' });
    // blanket over both, with dotted border
    this.blanket = el('g', {}, b);
    shape(this.blanket, 'M160 -100C170 -156 220 -184 290 -180C350 -176 390 -160 440 -158C490 -156 530 -132 540 -96L540 -70L160 -70Z', PAL.maroon);
    shape(this.blanket, 'M160 -100C170 -156 220 -184 290 -180C350 -176 390 -160 440 -158C490 -156 530 -132 540 -96L528 -96C516 -126 482 -144 440 -146C390 -148 350 -164 290 -168C230 -170 186 -148 174 -100Z', PAL.gold, { 'stroke-width': 1.6 });
    el('path', { d: dotPath(samplePath('M188 -114C214 -146 262 -158 300 -154C360 -148 400 -132 450 -130C490 -128 514 -116 526 -100', 15), 2.4), fill: PAL.cream }, this.blanket);
    const motif = [];
    for (let x = 230; x < 520; x += 44) for (const y of [-120, -90]) motif.push([x, y]);
    el('path', { d: motif.map(([x, y]) => `M${x} ${y - 7}l7 7l-7 7l-7 -7Z`).join(''), fill: PAL.gold, opacity: 0.85 }, this.blanket);
  }
  update(t, x, y, s) {
    const M0 = M2.T(x, y).mul(M2.S(s, s));
    setT(this.body, M0.str());
    const br = 1 + 0.02 * Math.sin(t * 1.6);
    setT(this.blanket, `translate(0 -70) scale(1 ${br.toFixed(4)}) translate(0 70)`);
    const sw = 0.4 * Math.sin(t * 0.9);
    setT(this.fatherG, `translate(176 -120) rotate(${-84 + sw}) scale(0.8)`);
    const a = [M0.ap(-15, -150), M0.ap(80, -150), M0.ap(70, -196), M0.ap(520, -110)];
    this.str.setAttribute('d', stringsPath(a, x + 260 * s, -320, 0.85));
  }
}

// --------------------------------------------------------------- animals ----
// Quadrupeds facing +x; origin at ground under the body centre.
const ANIMAL = {
  sheep: { body: [0, -100], hips: [[-46, -92], [-36, -88], [40, -92], [50, -88]], up: 32, low: 34, legW: 9, neck: [62, -112], strAt: [[0, -140]], col: '#3A2E2A', h: 200 },
  cow: { body: [0, -176], hips: [[-80, -160], [-64, -150], [62, -160], [78, -150]], up: 62, low: 66, legW: 16, neck: [100, -196], strAt: [[-10, -236]], col: '#E9DCC4', h: 320 },
  camel: { body: [0, -300], hips: [[-74, -282], [-60, -272], [58, -282], [74, -272]], up: 100, low: 112, legW: 15, neck: [92, -318], strAt: [[-6, -420]], col: '#C9A876', h: 520 },
};

class Animal {
  constructor(parent, kind, seed = 1) {
    this.kind = kind; this.seed = seed;
    const A = this.A = ANIMAL[kind];
    this.wrap = el('g', {}, parent);
    this.shadowEl = el('ellipse', { rx: 80, ry: 12, fill: 'url(#shadowGrad)' }, this.wrap);
    this.glow = glowFilter(PAL.cream, 0.38, 8);
    this.body = el('g', { filter: this.glow.url }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.legs = [];
    const back = el('g', {}, this.body);
    // far legs first (indices 0 and 2 are the far side)
    for (const i of [0, 2]) this.legs[i] = this.leg(back, A.hips[i], true);
    if (kind === 'cow') this.tail = this.cowTail(this.body);
    if (kind === 'sheep') this.sheepBody(this.body);
    if (kind === 'cow') this.cowBody(this.body);
    if (kind === 'camel') this.camelBody(this.body);
    for (const i of [1, 3]) this.legs[i] = this.leg(this.body, A.hips[i], false);
    this.head = part(this.body, A.neck[0], A.neck[1]);
    if (kind === 'sheep') this.sheepHead(this.head.g);
    if (kind === 'cow') this.cowHead(this.head.g);
    if (kind === 'camel') this.camelHead(this.head.g);
  }

  leg(parent, [x, y], far) {
    const A = this.A, w = A.legW;
    const col = this.kind === 'sheep' ? A.col : this.kind === 'cow' ? '#D9C7A8' : '#B89766';
    const c = far ? shade(col, 0.22) : col;
    const L = part(parent, x, y);
    shape(L.g, `M${-w / 2 - 2} -4L${w / 2 + 2} -4L${w / 2} ${A.up}L${-w / 2} ${A.up}Z`, c);
    L.knee = part(L.g, 0, A.up);
    shape(L.knee.g, `M${-w / 2} -2L${w / 2} -2L${w / 2 - 1} ${A.low}L${-w / 2 + 1} ${A.low}Z`, c);
    shape(L.knee.g, `M${-w / 2 - 1} ${A.low - 8}L${w / 2 + 2} ${A.low - 8}L${w / 2 + 3} ${A.low + 2}L${-w / 2 - 1} ${A.low + 2}Z`, '#2A1E18', { 'stroke-width': 1.6 });
    joint(L.knee.g, 0, 0, Math.max(5, w * 0.48));
    return L;
  }

  sheepBody(g) {
    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([Math.cos(a) * 82, -100 + Math.sin(a) * 50]);
    }
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i <= n; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, nx = mx * 0.22, ny = (my + 100) * 0.38;
      d += `Q${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    shape(g, d + 'Z', '#F3E6C8');
    let arcs = '';
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - (row === 1 ? 0 : 1); i++) {
      const x = -58 + i * 23 + (row === 1 ? -6 : 6), y = -128 + row * 24;
      arcs += `M${x} ${y}a9 9 0 0 1 18 0`;
    }
    el('path', { d: arcs, fill: 'none', stroke: '#C9B48E', 'stroke-width': 2 }, g);
    el('path', { d: 'M-80 -96C-92 -96 -96 -84 -88 -78', fill: 'none', stroke: PAL.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
  }
  sheepHead(g) {
    shape(g, 'M-14 -10C-10 -26 8 -32 24 -26C38 -20 46 -6 44 6C42 16 30 20 18 18C4 16 -10 6 -14 -10Z', '#3A2E2A');
    shape(g, 'M2 -18C-10 -30 -24 -24 -24 -14C-18 -10 -6 -10 2 -12Z', '#4A3C36');
    shape(g, 'M-6 -26C0 -40 22 -40 26 -28C18 -22 4 -22 -6 -26Z', '#F3E6C8', { 'stroke-width': 1.8 });
    shape(g, 'M18 -12Q25 -17 31 -11Q25 -7 18 -12Z', '#FBF6EA', { 'stroke-width': 1.4 });
    el('circle', { cx: 26, cy: -11.5, r: 2.4, fill: '#120A06' }, g);
    el('path', { d: 'M38 8Q42 10 44 6', fill: 'none', stroke: '#C9A876', 'stroke-width': 1.6 }, g);
  }
  cowTail(g) {
    const t = part(g, -112, -210);
    el('path', { d: 'M0 0C-14 30 -16 70 -12 110', fill: 'none', stroke: PAL.ink, 'stroke-width': 7, 'stroke-linecap': 'round' }, t.g);
    el('path', { d: 'M0 0C-14 30 -16 70 -12 110', fill: 'none', stroke: '#D9C7A8', 'stroke-width': 3.5, 'stroke-linecap': 'round' }, t.g);
    shape(t.g, 'M-20 104C-24 120 -14 132 -6 130C0 124 -2 110 -8 102Z', '#5A3A22');
    return t;
  }
  cowBody(g) {
    shape(g, 'M-110 -200C-120 -170 -116 -132 -96 -126L84 -126C110 -130 122 -160 116 -196C108 -226 70 -234 30 -230L-60 -232C-90 -230 -106 -220 -110 -200Z', '#E9DCC4');
    shape(g, 'M-96 -214C-80 -224 -56 -222 -50 -204C-46 -186 -66 -176 -84 -182C-98 -188 -102 -204 -96 -214Z', '#B98B5E', { 'stroke-width': 1.8 });
    shape(g, 'M60 -152C74 -160 92 -152 92 -138C88 -128 70 -128 62 -136Z', '#B98B5E', { 'stroke-width': 1.8 });
    // saddle blanket
    shape(g, 'M-50 -230L50 -230L58 -150L-58 -150Z', PAL.maroon);
    shape(g, 'M-58 -160L58 -160L58 -150L-58 -150Z', PAL.gold, { 'stroke-width': 1.6 });
    el('path', { d: dotPath(samplePath('M-42 -214L42 -214', 14), 2.6) + dotPath(samplePath('M-48 -186L48 -186', 14), 2.6), fill: PAL.gold }, g);
    el('path', { d: [-48, -24, 0, 24, 48].map(x => `M${x - 7} -150l7 14l7 -14Z`).join(''), fill: PAL.gold, class: 'o', 'stroke-width': 1.4 }, g);
  }
  cowHead(g) {
    shape(g, 'M-8 -30C-34 -24 -40 0 -24 10L-6 6Z', '#E9DCC4');
    shape(g, 'M-12 -34L-24 -60C-18 -64 -12 -60 -6 -38Z', '#F3E6C8', { 'stroke-width': 2 });
    shape(g, 'M4 -36C2 -58 14 -66 20 -62C16 -54 14 -44 14 -34Z', '#F3E6C8', { 'stroke-width': 2 });
    shape(g, 'M-14 -26C-8 -42 22 -44 34 -30C46 -16 58 4 56 22C54 36 40 40 26 36C10 32 -4 18 -10 2C-14 -10 -16 -18 -14 -26Z', '#E9DCC4');
    shape(g, 'M-14 -20C-30 -26 -42 -18 -42 -10C-32 -6 -20 -8 -12 -12Z', '#D9C7A8');
    shape(g, 'M30 22C40 14 56 14 58 24C58 34 46 40 36 36C30 34 28 28 30 22Z', '#D9A08A');
    el('circle', { cx: 46, cy: 26, r: 2.2, fill: PAL.ink }, g);
    shape(g, 'M8 -16Q20 -24 30 -15Q20 -9 8 -16Z', '#FBF6EA', { 'stroke-width': 1.6 });
    el('circle', { cx: 22, cy: -15.5, r: 3.4, fill: '#120A06' }, g);
    el('circle', { cx: 23.2, cy: -16.8, r: 1, fill: '#fff' }, g);
    el('path', { d: 'M6 -16Q19 -27 32 -16', fill: 'none', stroke: '#120A06', 'stroke-width': 2 }, g);
    // little bell on a cord
    el('path', { d: 'M-4 12Q4 30 14 30', fill: 'none', stroke: PAL.maroon, 'stroke-width': 3 }, g);
    shape(g, 'M8 28L20 28L22 40L6 40Z', PAL.gold, { 'stroke-width': 1.6 });
  }
  camelBody(g) {
    shape(g, 'M-104 -290C-110 -250 -96 -230 -70 -228L76 -228C104 -234 112 -262 104 -296C98 -320 80 -330 60 -330C40 -390 -40 -400 -70 -340C-90 -330 -102 -314 -104 -290Z', '#C9A876');
    el('path', { d: 'M-90 -262C-50 -250 50 -250 96 -262', fill: 'none', stroke: '#A88A5E', 'stroke-width': 2 }, g);
    // saddle cloth over the hump
    shape(g, 'M-70 -342C-50 -392 30 -392 52 -336L66 -270L-82 -270Z', PAL.maroon);
    shape(g, 'M-82 -282L66 -282L66 -270L-82 -270Z', PAL.gold, { 'stroke-width': 1.6 });
    el('path', { d: dotPath(samplePath('M-60 -340C-40 -378 24 -378 42 -336', 12), 2.6) + dotPath(samplePath('M-70 -300L58 -300', 13), 2.6), fill: PAL.gold }, g);
    el('path', { d: [-74, -46, -18, 10, 38, 62].map(x => `M${x - 6} -270l6 16l6 -16Z`).join(''), fill: PAL.gold, class: 'o', 'stroke-width': 1.4 }, g);
    el('path', { d: 'M-102 -290C-116 -280 -120 -256 -114 -236', fill: 'none', stroke: PAL.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
  }
  camelHead(g) {
    shape(g, 'M-12 18C10 -20 16 -80 30 -116C40 -136 62 -138 74 -128L60 -106C50 -96 46 -60 36 -20C30 4 20 20 12 30Z', '#C9A876');
    el('path', { d: dotPath(samplePath('M8 10C24 -26 30 -70 40 -104', 12), 2.2), fill: PAL.maroon }, g);
    shape(g, 'M40 -126C46 -146 80 -150 98 -134C110 -124 112 -108 102 -102C90 -98 72 -104 60 -106C48 -108 38 -116 40 -126Z', '#C9A876');
    shape(g, 'M44 -136C40 -150 46 -156 52 -152C52 -146 50 -140 48 -136Z', '#B89766', { 'stroke-width': 1.6 });
    shape(g, 'M62 -134Q72 -141 82 -133Q72 -127 62 -134Z', '#FBF6EA', { 'stroke-width': 1.4 });
    el('circle', { cx: 74, cy: -133.5, r: 2.8, fill: '#120A06' }, g);
    el('path', { d: 'M60 -134Q71 -144 84 -134', fill: 'none', stroke: '#120A06', 'stroke-width': 2 }, g);
    el('path', { d: 'M100 -112Q104 -108 102 -104M90 -102Q98 -100 104 -103', fill: 'none', stroke: PAL.ink, 'stroke-width': 1.6 }, g);
    // halter
    el('path', { d: 'M54 -110L96 -118M58 -132L62 -104', fill: 'none', stroke: PAL.maroon, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
    el('path', { d: dotPath([[66, -112], [78, -114], [90, -116]], 2), fill: PAL.gold }, g);
  }

  // pose: { x, y, s, dir, lift, walk (0..1 hop phase or -1), alpha, head }
  update(t, p) {
    const A = this.A, sd = this.seed;
    const sway = 1.2 * Math.sin(t * 1.1 + sd) + (p.sway || 0);
    const bob = 2.5 * Math.sin(t * 1.9 + sd);
    const piv = -A.h * p.s;
    const M0 = M2.T(p.x, p.y + bob - (p.lift || 0)).mul(M2.T(0, piv)).mul(M2.R(sway)).mul(M2.T(0, -piv)).mul(M2.S(p.s * p.dir, p.s));
    setT(this.body, M0.str());
    const sw = p.walk >= 0 ? 16 * Math.sin(Math.PI * p.walk) * (p.step % 2 ? 1 : -1) : 2 * Math.sin(t * 1.1 + sd);
    const ang = [sw, -sw * 0.7, -sw, sw * 0.7];
    this.legs.forEach((L, i) => { L.r = ang[i]; L.knee.r = (p.walk >= 0 ? -8 * Math.sin(Math.PI * p.walk) : 0); applyPart(L); applyPart(L.knee); });
    this.head.r = (p.head || 0) + 3 * Math.sin(t * 1.4 + sd * 2);
    applyPart(this.head);
    if (this.tail) { this.tail.r = 6 * Math.sin(t * 2.3 + sd); applyPart(this.tail); }
    this.wrap.setAttribute('opacity', (p.alpha ?? 1).toFixed(3));
    const lift = Math.max(0, (p.lift || 0));
    this.shadowEl.setAttribute('cx', p.x); this.shadowEl.setAttribute('cy', p.y + 2);
    this.shadowEl.setAttribute('rx', (A === ANIMAL.sheep ? 90 : 130) * p.s * Math.max(0.3, 1 - lift / 800));
    this.shadowEl.setAttribute('ry', 14 * p.s);
    this.shadowEl.setAttribute('opacity', Math.max(0, 1 - lift / 1000));
    const headTop = M0.mul(partM(this.head)).ap(this.kind === 'camel' ? 70 : this.kind === 'cow' ? 18 : 12, this.kind === 'camel' ? -146 : this.kind === 'cow' ? -40 : -34);
    const back = M0.ap(A.strAt[0][0], A.strAt[0][1]);
    this.str.setAttribute('d', stringsPath([headTop, back], (headTop[0] + back[0]) / 2, -320, 0.8));
  }
}

// ----------------------------------------------------------------- props ----
class Boulder {
  constructor(parent, r, inside) {
    this.r = r;
    this.wrap = el('g', {}, parent);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.g = el('g', {}, this.wrap);
    this.spin = el('g', {}, this.g);
    const g = this.spin, base = inside ? '#5E5B58' : '#8A8580';
    el('circle', { r, fill: base, class: 'o', 'stroke-width': 4 }, g);
    // flat facets: lighter top-left, darker bottom-right
    el('path', { d: `M${-r * 0.92} ${-r * 0.1}C${-r * 0.8} ${-r * 0.7} ${-r * 0.3} ${-r * 0.95} ${r * 0.2} ${-r * 0.94}C${-r * 0.1} ${-r * 0.6} ${-r * 0.5} ${-r * 0.3} ${-r * 0.92} ${-r * 0.1}Z`, fill: '#fff', opacity: 0.13 }, g);
    el('path', { d: `M${r * 0.95} ${r * 0.05}C${r * 0.9} ${r * 0.6} ${r * 0.4} ${r * 0.98} ${-r * 0.2} ${r * 0.96}C${r * 0.3} ${r * 0.7} ${r * 0.6} ${r * 0.4} ${r * 0.95} ${r * 0.05}Z`, fill: '#000', opacity: 0.2 }, g);
    // crack lines
    const cracks = [
      [[-0.2, -0.98], [-0.12, -0.6], [-0.26, -0.34], [-0.1, -0.05]],
      [[-0.1, -0.05], [0.3, 0.1], [0.42, 0.42], [0.7, 0.62]],
      [[-0.1, -0.05], [-0.42, 0.22], [-0.55, 0.6]],
      [[0.55, -0.72], [0.4, -0.4], [0.52, -0.2]],
      [[-0.85, -0.4], [-0.6, -0.42], [-0.5, -0.6]],
    ];
    el('path', { d: cracks.map(c => poly(c.map(([x, y]) => [x * r, y * r]))).join(''), fill: 'none', stroke: '#2B2622', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    // folk dot bands
    const dots = [];
    for (const k of [0.72, 0.56]) for (let a = 0; a < Math.PI * 2; a += 0.11 / k) {
      if (Math.sin(a * 3) > -0.2) dots.push([Math.cos(a) * r * k, Math.sin(a) * r * k]);
    }
    el('path', { d: dotPath(dots, r * 0.013 + 1.2), fill: '#D9D2C4', opacity: 0.55 }, g);
    const pits = [], R = rng(31);
    for (let i = 0; i < 26; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * r * 0.42; pits.push([Math.cos(a) * d, Math.sin(a) * d]); }
    el('path', { d: dotPath(pits, r * 0.012 + 1), fill: '#2B2622', opacity: 0.5 }, g);
    joint(this.g, 0, 0, r * 0.07 + 4);
  }
  update(x, y, rot, alpha = 1, swing = 0) {
    setT(this.g, `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    setT(this.spin, `rotate(${rot.toFixed(2)})`);
    this.wrap.setAttribute('opacity', alpha);
    this.str.setAttribute('d', `M${x} ${y}L${(x + swing).toFixed(1)} -320`);
  }
}

class Lantern {
  constructor(parent, s = 1) {
    this.s = s;
    this.wrap = el('g', {}, parent);
    this.halo = el('circle', { r: 260 * s, fill: 'url(#lampGlow)' }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.g = el('g', {}, this.wrap);
    const g = el('g', { transform: `scale(${s})` }, this.g);
    const brass = '#B8862E', brassD = '#8A6020';
    el('circle', { cx: 0, cy: 0, r: 8, fill: 'none', stroke: brassD, 'stroke-width': 4 }, g);
    shape(g, 'M-4 6L4 6L5 22L-5 22Z', brass);
    shape(g, 'M-34 52C-30 30 -14 20 0 18C14 20 30 30 34 52Z', brass);
    el('path', { d: dotPath(samplePath('M-28 46C-22 32 -10 26 0 25C10 26 22 32 28 46', 7), 1.6), fill: '#F3D38A' }, g);
    shape(g, 'M-38 52L38 52L36 62L-36 62Z', brassD);
    // glowing glass body with pointed-arch cut-outs
    shape(g, 'M-34 62L34 62L28 140L-28 140Z', '#FFD58A');
    el('path', { d: 'M-34 62L34 62L28 140L-28 140Z', fill: 'url(#flameGlow)' }, g);
    for (const x of [-18, 0, 18]) {
      el('path', { d: `M${x - 7} 132L${x - 7} 86Q${x} 72 ${x + 7} 86L${x + 7} 132Z`, fill: 'none', stroke: brassD, 'stroke-width': 3 }, g);
    }
    el('path', { d: 'M-31 100L31 100', stroke: brassD, 'stroke-width': 3 }, g);
    shape(g, 'M-30 140L30 140L20 160L-20 160Z', brass);
    shape(g, 'M-20 160L20 160L0 186Z', brassD);
    el('path', { d: dotPath(samplePath('M-24 148L24 148', 8), 1.6), fill: '#F3D38A' }, g);
    shape(g, 'M-4 186L4 186L0 200Z', brass);
    this.flame = el('path', { d: 'M0 94C8 104 8 118 0 124C-8 118 -8 104 0 94Z', fill: '#FFF6D6' }, g);
  }
  update(t, x, y, swing, glow = 1) {
    const a = swing;
    setT(this.g, `translate(${x} ${y}) rotate(${a.toFixed(2)})`);
    const fl = 0.85 + 0.1 * Math.sin(t * 9.1) + 0.05 * noise1(t * 6, 3);
    const [cx, cy] = M2.T(x, y).mul(M2.R(a)).ap(0, 110 * this.s);
    this.halo.setAttribute('cx', cx); this.halo.setAttribute('cy', cy);
    this.halo.setAttribute('opacity', (glow * fl).toFixed(3));
    setT(this.flame, `translate(0 ${124}) scale(${(0.9 + 0.12 * fl).toFixed(3)}) translate(0 -124)`);
    this.str.setAttribute('d', `M${x} ${y}L${x} -320`);
  }
}

class Moon {
  constructor(parent, r = 70) {
    this.wrap = el('g', {}, parent);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.g = el('g', {}, this.wrap);
    el('circle', { r: r * 1.9, fill: 'url(#moonGlow)' }, this.g);
    const d = `M${r * 0.2} ${-r}A${r} ${r} 0 1 0 ${r * 0.2} ${r}A${r * 0.8} ${r * 0.8} 0 1 1 ${r * 0.2} ${-r}Z`;
    shape(this.g, d, '#F3E6C8', { 'stroke-width': 2.4 });
    el('path', { d: dotPath(samplePath(`M${r * 0.05} ${-r * 0.82}A${r * 0.86} ${r * 0.86} 0 0 0 ${r * 0.05} ${r * 0.82}`, 10), 1.8), fill: PAL.gold }, this.g);
    this.r = r;
  }
  update(x, y, rot, topY = -320) {
    setT(this.g, `translate(${x} ${y}) rotate(${rot})`);
    const [ax, ay] = M2.T(x, y).mul(M2.R(rot)).ap(this.r * 0.2, -this.r);
    this.str.setAttribute('d', `M${ax} ${ay}L${ax} ${topY}`);
  }
}

class Stars {
  constructor(parent, list, seed = 3) {
    this.list = list.map(([x, y, s]) => ({ x, y, s }));
    this.g = el('g', {}, parent);
    this.str = el('path', { class: 'str', opacity: 0.8 }, this.g);
    this.seed = seed;
    for (const st of this.list) {
      st.g = el('g', {}, this.g);
      el('circle', { r: 22 * st.s, fill: 'url(#starGlow)' }, st.g);
      shape(st.g, star8(14 * st.s, 7 * st.s), PAL.gold, { 'stroke-width': 1.5 });
      el('circle', { r: 2.2 * st.s, fill: '#FFF3C4' }, st.g);
    }
  }
  update(t, dy = 0, alpha = 1) {
    let d = '';
    this.list.forEach((st, i) => {
      const a = 3.2 * Math.sin(t * (0.8 + i * 0.07) + i * 1.9 + this.seed);
      const L = st.y + 320 + dy;
      const x = st.x + Math.sin(a * Math.PI / 180) * L, y = st.y + dy;
      setT(st.g, `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(a * 3).toFixed(1)})`);
      d += `M${x.toFixed(1)} ${(y - 14 * st.s).toFixed(1)}L${st.x} -320`;
    });
    this.str.setAttribute('d', d);
    this.g.setAttribute('opacity', alpha);
  }
}

class Cloud {
  constructor(parent, w, seed = 1) {
    this.w = w;
    this.wrap = el('g', {}, parent);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.g = el('g', {}, this.wrap);
    const R = rng(seed), h = w * 0.42;
    // scalloped outline: round bumps riding a hill-shaped envelope, flat-ish base
    const n = 7 + Math.floor(R() * 2);
    const xs = [];
    for (let i = 0; i <= n; i++) xs.push(-w / 2 + w * i / n + (i > 0 && i < n ? (R() - 0.5) * w / n * 0.3 : 0));
    const env = x => { const u = (x + w / 2) / w; return -h * 0.62 * Math.pow(Math.sin(Math.PI * u), 0.7); };
    let d = `M${-w / 2} 0`;
    for (let i = 0; i < n; i++) {
      const x1 = xs[i + 1], y1 = i === n - 1 ? 0 : env(x1);
      const x0 = xs[i], y0 = i === 0 ? 0 : env(x0);
      const ch = Math.hypot(x1 - x0, y1 - y0), r = ch * (0.52 + R() * 0.08);
      d += `A${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    const m = 6;
    for (let i = m; i > 0; i--) {
      const x0 = -w / 2 + (w * i) / m, x1 = -w / 2 + (w * (i - 1)) / m;
      d += `Q${(x0 + x1) / 2} ${h * 0.14} ${x1} 0`;
    }
    shape(this.g, d + 'Z', '#4B505E', { 'stroke-width': 3 });
    el('path', { d: `M${-w * 0.46} ${h * 0.02}Q0 ${h * 0.18} ${w * 0.46} ${h * 0.02}L${w * 0.46} ${h * 0.08}Q0 ${h * 0.26} ${-w * 0.46} ${h * 0.08}Z`, fill: '#000', opacity: 0.18 }, this.g);
    // rows of small arcs + dotted lines inside
    let arcs = '';
    for (let row = 0; row < 2; row++) {
      const y = -h * (0.36 - row * 0.2), cnt = Math.floor(w / 52) - row * 2;
      for (let i = 0; i < cnt; i++) { const x = -cnt * 24 + i * 48 + row * 14; arcs += `M${x} ${y}a14 14 0 0 1 28 0`; }
    }
    el('path', { d: arcs, fill: 'none', stroke: '#6E7486', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, this.g);
    el('path', { d: dotPath(samplePath(`M${-w * 0.36} ${-h * 0.03}L${w * 0.36} ${-h * 0.03}`, 14), 2.2), fill: '#8D93A3' }, this.g);
    this.h = h;
  }
  update(x, y, rot, alpha = 1) {
    setT(this.g, `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(2)})`);
    const M = M2.T(x, y).mul(M2.R(rot));
    const a = M.ap(-this.w * 0.3, -this.h * 0.7), b = M.ap(this.w * 0.3, -this.h * 0.7);
    this.str.setAttribute('d', `M${a[0]} ${a[1]}L${a[0]} -320M${b[0]} ${b[1]}L${b[0]} -320`);
    this.wrap.setAttribute('opacity', alpha);
  }
}

class Pouch {
  constructor(parent) {
    this.wrap = el('g', {}, parent);
    this.glowC = el('circle', { r: 150, fill: 'url(#goldGlow)', opacity: 0 }, this.wrap);
    this.str = el('path', { class: 'str' }, this.wrap);
    this.glow = glowFilter('#F7D78A', 0.35, 6);
    this.g = el('g', { filter: this.glow.url }, this.wrap);
    const g = this.g;
    // spilled coins
    const coins = [[70, -8], [96, -4], [118, -10], [86, -20], [140, -6], [60, -26]];
    for (const [x, y] of coins) {
      el('ellipse', { cx: x, cy: y, rx: 15, ry: 7, fill: PAL.gold, class: 'o', 'stroke-width': 1.8 }, g);
      el('ellipse', { cx: x, cy: y, rx: 8, ry: 3.4, fill: 'none', stroke: '#8A6A12', 'stroke-width': 1.4 }, g);
    }
    // cloth pouch lying on its side
    shape(g, 'M-70 -4C-92 -20 -88 -82 -46 -96C-10 -106 26 -84 34 -56L52 -64C62 -60 64 -48 56 -42L36 -36C30 -10 4 4 -28 4C-46 4 -60 2 -70 -4Z', '#7A4A2A');
    el('path', { d: 'M28 -62C34 -52 36 -42 34 -34', fill: 'none', stroke: PAL.gold, 'stroke-width': 4, 'stroke-linecap': 'round' }, g);
    el('path', { d: dotPath(samplePath('M-66 -30C-60 -66 -30 -84 0 -80', 11), 2.2), fill: PAL.gold }, g);
    el('path', { d: 'M-50 -60C-30 -70 -6 -66 10 -54', fill: 'none', stroke: '#5A3218', 'stroke-width': 2 }, g);
    for (const [x, y] of [[44, -46], [52, -36]]) {
      el('ellipse', { cx: x, cy: y, rx: 12, ry: 6, fill: PAL.gold, class: 'o', 'stroke-width': 1.6 }, g);
    }
    this.sparkle = el('path', { d: '', fill: '#FFF6D0' }, this.wrap);
  }
  update(t, x, y, s, glint) {
    setT(this.g, `translate(${x} ${y}) scale(${s})`);
    this.glowC.setAttribute('cx', x + 30 * s); this.glowC.setAttribute('cy', y - 30 * s);
    this.glowC.setAttribute('opacity', (0.25 + 0.75 * glint).toFixed(3));
    const [ax, ay] = [x + 10 * s, y - 92 * s];
    this.str.setAttribute('d', `M${ax} ${ay}L${ax} -320`);
    let d = '';
    if (glint > 0.01) {
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.9 + i / 3) % 1, k = Math.sin(Math.PI * ph) * glint * 16;
        const cx = x + s * [80, 120, 50][i], cy = y + s * [-30, -20, -60][i] - ph * 30;
        d += `M${cx} ${cy - k}Q${cx} ${cy} ${cx + k} ${cy}Q${cx} ${cy} ${cx} ${cy + k}Q${cx} ${cy} ${cx - k} ${cy}Q${cx} ${cy} ${cx} ${cy - k}Z`;
      }
    }
    this.sparkle.setAttribute('d', d);
  }
}
