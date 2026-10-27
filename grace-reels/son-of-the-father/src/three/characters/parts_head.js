// Head part library (unit head space: origin = head pivot on top of the neck, facing +x, y up,
// skull ~0.36 tall; the design scales it). Every part is SVG path data + drawing elements.
// Views: 'side' (profile), 'threeQuarter', 'back'.
import { smooth, poly, ellipse, arc, mirrorX, shift, shift as shiftPath } from './svg.js';
import { F, L, shade, mixc, ink, lift, lum } from './paint.js';
const lerp = (a, b, t) => a + (b - a) * t;
import { mulberry32 } from '../../lib/util.js';

export const EYE_WHITE = '#f6dcbc';
export const IRIS = '#3b2516';
const LID_LINE = '#2c170d';

// ---------------------------------------------------------------- helpers
const mapPts = (pts, f) => pts.map((p) => { const q = f(p[0], p[1]); return p.length > 2 ? [q[0], q[1], p[2]] : q; });
const mirrorPts = (pts) => pts.map((p) => (p.length > 2 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]));
const wavy = (x0, y0, x1, y1, n, amp, seed) => { // jagged lock-tips between two points
  const r = mulberry32(seed), out = [];
  for (let i = 1; i < n; i++) { const t = i / n; const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1; const a = (i % 2 ? 1 : -0.35) * amp * (0.7 + 0.6 * r()); out.push([x0 + (x1 - x0) * t + nx / l * a, y0 + (y1 - y0) * t + ny / l * a, i % 2 ? 0.55 : 0.9]); }
  return out;
};

export function almond(hw, ht, hb) {
  return [[-hw, 0.001, 0], [-0.5 * hw, ht * 0.9], [0.1 * hw, ht], [0.62 * hw, ht * 0.72], [hw, -0.003, 0], [0.5 * hw, -hb * 0.86], [-0.15 * hw, -hb], [-0.68 * hw, -hb * 0.62]];
}

// ---------------------------------------------------------------- eye assembly (sits BEHIND the head; the head has an almond hole)
export function eyeParts(D, tag, E, hw, ht, hb, layer, extra = {}) {
  const skin = D.skin, old = D.age;
  const parts = [];
  const wh = ellipse(0, 0, hw * 1.25, (ht + hb) * 0.85);
  parts.push({ id: `eyeWhite${tag}`, pivot: `eye${tag}`, layer, outline: false, density: 'face', bulge: 0.35, rim: false, shape: wh,
    draw: [F(wh, EYE_WHITE), F(ellipse(0, ht * 1.05, hw * 1.5, ht * 0.85), shade(EYE_WHITE, 0.8), { a: 0.75, blur: ht * 0.35 }), F(ellipse(hw * 0.9, -hb * 0.1, hw * 0.35, hb * 0.6), '#e9b8a0', { a: 0.5, blur: hb * 0.4 })] });
  const r = hw * 0.37;
  const pu = ellipse(0, 0, r, r * 1.04);
  parts.push({ id: `pupil${tag}`, pivot: `pupil${tag}`, layer: layer + 0.2, outline: false, density: 'face', bulge: 0.2, rim: false, shape: pu,
    draw: [F(pu, D.eyeColor || IRIS), L(ellipse(0, 0, r * 0.82, r * 0.86), shade(D.eyeColor || IRIS, 1.35), r * 0.16, { a: 0.55 }), F(ellipse(0.0, 0.0, r * 0.52, r * 0.54), '#160c06'),
      F(ellipse(r * 0.34, r * 0.36, r * 0.2, r * 0.22), '#fff3de'), F(ellipse(-r * 0.32, -r * 0.34, r * 0.08, r * 0.08), '#fff3de', { a: 0.7 })] });
  // upper lid: skin with the dark lid line along its lower edge (the almond's upper arc, slightly lowered)
  const top = almond(hw, ht, hb).slice(0, 5).map(([x, y]) => [x, y - ht * 0.16]);
  const lidEdge = [[-hw * 1.28, -ht * 0.05], ...top.map(([x, y], i) => [x, y, i === 0 || i === 4 ? 0.6 : 1]), [hw * 1.28, -ht * 0.12]];
  const lidShape = smooth([...lidEdge, [hw * 1.3, ht + 0.075], [-hw * 1.3, ht + 0.075]].map((p, i, a) => (i >= a.length - 2 ? [p[0], p[1], 0] : p)), true);
  const edgeD = smooth(lidEdge, false);
  const crease = smooth(lidEdge.slice(1, -1).map(([x, y]) => [x * 0.95, y + ht * 0.62 + (old ? 0.003 : 0)]), false);
  const lidDraw = [F(lidShape, skin), L(edgeD, LID_LINE, hw * 0.24), L(crease, ink(skin, 0.68), hw * 0.07, { a: 0.75 })];
  if (old > 0.5) lidDraw.push(L(smooth(lidEdge.slice(1, -1).map(([x, y]) => [x * 0.9 - hw * 0.05, y + ht * 1.15]), false), ink(skin, 0.7), hw * 0.06, { a: 0.6 }));
  if (D.lashes) for (let i = 0; i < 3; i++) lidDraw.push(L(poly([[-hw * (0.95 - i * 0.18), -ht * 0.05 + i * ht * 0.18], [-hw * (1.18 - i * 0.16), ht * 0.18 + i * ht * 0.12]], false), LID_LINE, hw * 0.08));
  parts.push({ id: `lidU${tag}`, pivot: `lidU${tag}`, layer: layer + 0.4, outline: false, density: 'face', shape: lidShape, draw: lidDraw, shapeFrom: { id: extra.headId, dx: E[0], dy: E[1] } });
  const bot = almond(hw, ht, hb).slice(4).concat([almond(hw, ht, hb)[0]]).map(([x, y]) => [x, y + hb * 0.12]);
  const lowEdge = [[hw * 1.28, -hb * 0.05], ...bot, [-hw * 1.28, -hb * 0.02]];
  const lowShape = smooth([...lowEdge, [-hw * 1.3, -hb - 0.03, 0], [hw * 1.3, -hb - 0.03, 0]], true);
  parts.push({ id: `lidL${tag}`, pivot: `lidL${tag}`, layer: layer + 0.5, outline: false, density: 'face', shape: lowShape,
    draw: [F(lowShape, skin), L(smooth(lowEdge, false), ink(skin, 0.62), hw * 0.1, { a: 0.8 })], shapeFrom: { id: extra.headId, dx: E[0], dy: E[1] } });
  return parts;
}

// ---------------------------------------------------------------- head silhouettes
export function headSidePts(D) {
  const nz = D.nose ?? 1, dr = D.noseDroop ?? 0, j = D.jaw ?? 1, ch = D.chin ?? 1, cr = D.crown ?? 1, old = D.age ?? 0;
  const lip = old > 0.6 ? -0.006 : 0;
  return [
    [-0.04, -0.035], [-0.112, 0.045], [-0.158, 0.155], [-0.150, 0.262], [-0.098, 0.334 * cr], [-0.005, 0.362 * cr], [0.085, 0.343 * cr],
    [0.138, 0.290], [0.158, 0.232], [0.163 + 0.004 * (D.browRidge ?? 0), 0.208], [0.157, 0.188, 0.6],
    [0.163 + 0.02 * nz, 0.158 - 0.006 * dr], [0.168 + 0.036 * nz, 0.128 - 0.012 * dr, 0.62], [0.166 + 0.013 * nz, 0.107 - 0.008 * dr, 0.5],
    [0.160, 0.099, 0.6], [0.165 + lip, 0.084], [0.158 + lip, 0.069, 0.6], [0.163 * ch + lip * 0.5, 0.051], [0.158 * ch, 0.026],
    [0.130 * j, -0.002], [0.070 * j, -0.013], [0.025, -0.036],
  ];
}
export function head3qPts(D) {
  const nz = D.nose ?? 1, j = D.jaw ?? 1, cr = D.crown ?? 1;
  return [
    [-0.065, -0.03], [-0.128, 0.048], [-0.150, 0.118], [-0.165, 0.126], [-0.176, 0.162, 1.2], [-0.163, 0.205], [-0.151, 0.212],
    [-0.143, 0.268], [-0.090, 0.337 * cr], [0.005, 0.362 * cr], [0.090, 0.338 * cr], [0.137, 0.276], [0.150, 0.216], [0.146, 0.182, 0.7],
    [0.152 + 0.012 * nz, 0.152], [0.160 + 0.018 * nz, 0.128, 0.6], [0.147, 0.112, 0.6], [0.142, 0.088], [0.124 * j, 0.040], [0.082 * j, 0.004], [0.032, -0.012], [-0.012, -0.026],
  ];
}
export function headBackPts(D) {
  const cr = D.crown ?? 1;
  const half = [[0.0, -0.03], [0.07, -0.026], [0.128, 0.048], [0.150, 0.118], [0.166, 0.126], [0.176, 0.162, 1.2], [0.166, 0.204], [0.151, 0.212], [0.146, 0.268], [0.092, 0.337 * cr]];
  return [...half, [0.0, 0.362 * cr], ...mirrorPts(half.slice(1).reverse())];
}

export const EYE = {
  side: { E: [0.097, 0.192], hw: 0.040, ht: 0.021, hb: 0.016 },
  near: { E: [0.028, 0.190], hw: 0.036, ht: 0.020, hb: 0.016 },
  far: { E: [0.113, 0.190], hw: 0.022, ht: 0.018, hb: 0.014 },
};
const holeOf = (e, k = 1) => shift(smooth(almond(e.hw * k, e.ht * k, e.hb * k), true), e.E[0], e.E[1]);

function wrinkles(D, view) {
  const s = D.skin, old = D.age ?? 0, out = [], ln = ink(s, 0.6), deep = ink(s, 0.48);
  const W = (d, w, a = 0.85, c = ln) => out.push(L(d, c, w, { a }));
  const vold = Math.max(0, Math.min(1, (old - 0.85) / 0.15)); // the very old (Methuselah)
  if (vold > 0 && view === 'side') {
    W(smooth([[0.072, 0.336], [0.1, 0.341], [0.128, 0.336]], false), 0.0028, 0.75 * vold);
    W(smooth([[0.163, 0.122], [0.152, 0.1], [0.146, 0.074], [0.149, 0.052]], false), 0.0046, 0.95 * vold, deep);
    W(smooth([[0.068, 0.166], [0.09, 0.156], [0.116, 0.159]], false), 0.0034, 0.85 * vold, deep);
    W(smooth([[0.064, 0.152], [0.088, 0.141], [0.113, 0.145]], false), 0.0026, 0.6 * vold);
    W(smooth([[0.036, 0.135], [0.055, 0.106], [0.082, 0.084]], false), 0.003, 0.6 * vold);
    W(smooth([[0.118, 0.03], [0.1, 0.012], [0.078, 0.002]], false), 0.003, 0.5 * vold);
    W(smooth([[0.004, 0.262], [0.012, 0.238], [0.01, 0.222]], false), 0.0026, 0.55 * vold);
    W(smooth([[0.058, 0.208], [0.04, 0.222], [0.03, 0.234]], false), 0.0026, 0.7 * vold);
  } else if (vold > 0 && view === 'threeQuarter') {
    W(smooth([[-0.014, 0.334], [0.05, 0.342], [0.11, 0.334]], false), 0.0028, 0.7 * vold);
    W(smooth([[0.128, 0.124], [0.112, 0.1], [0.108, 0.072]], false), 0.0044, 0.9 * vold, deep);
    W(smooth([[0.006, 0.166], [0.03, 0.157], [0.058, 0.162]], false), 0.0032, 0.8 * vold, deep);
    W(smooth([[0.096, 0.168], [0.11, 0.16], [0.128, 0.165]], false), 0.0026, 0.6 * vold);
    W(smooth([[-0.06, 0.13], [-0.04, 0.1], [-0.015, 0.08]], false), 0.003, 0.55 * vold);
  }
  if (view === 'side') {
    if (old > 0.25) {
      W(smooth([[0.066, 0.166], [0.093, 0.158], [0.122, 0.165]], false), 0.0032, 0.7 * old);
      W(smooth([[0.073, 0.152], [0.098, 0.146], [0.118, 0.152]], false), 0.0026, 0.5 * old);
      W(smooth([[0.054, 0.198], [0.036, 0.205], [0.020, 0.214]], false), 0.003, old);
      W(smooth([[0.054, 0.188], [0.034, 0.186], [0.018, 0.186]], false), 0.003, old);
      W(smooth([[0.056, 0.178], [0.040, 0.168], [0.026, 0.160]], false), 0.0028, old);
    }
    if (old > 0.5) {
      for (let i = 0; i < 3; i++) W(smooth([[0.062 + i * 0.01, 0.268 + i * 0.022], [0.10, 0.274 + i * 0.022], [0.138 - i * 0.008, 0.270 + i * 0.022]], false), 0.0034 - i * 0.0004, 0.85);
      W(smooth([[0.158, 0.118], [0.148, 0.098], [0.142, 0.074]], false), 0.0034, 0.8);
      W(smooth([[0.128, 0.128], [0.110, 0.108], [0.104, 0.084]], false), 0.003, 0.55);
      W(smooth([[0.026, 0.238], [0.015, 0.22], [0.012, 0.2]], false), 0.0026, 0.45);
    }
  } else if (view === 'threeQuarter') {
    if (old > 0.25) {
      W(smooth([[0.004, 0.166], [0.028, 0.158], [0.054, 0.166]], false), 0.003, 0.7 * old);
      W(smooth([[-0.012, 0.198], [-0.03, 0.206], [-0.045, 0.214]], false), 0.003, old);
      W(smooth([[-0.012, 0.184], [-0.032, 0.18], [-0.046, 0.176]], false), 0.003, old);
    }
    if (old > 0.5) {
      for (let i = 0; i < 3; i++) W(smooth([[-0.02 + i * 0.006, 0.268 + i * 0.021], [0.05, 0.276 + i * 0.021], [0.118 - i * 0.008, 0.268 + i * 0.021]], false), 0.0032 - i * 0.0004, 0.8);
      W(smooth([[0.12, 0.122], [0.108, 0.1], [0.104, 0.078]], false), 0.003, 0.7);
      W(smooth([[0.064, 0.13], [0.05, 0.11], [0.048, 0.088]], false), 0.003, 0.5);
    }
  }
  if (D.scar) {                                          // an old scar through the near eyebrow
    const pale = lift(s, 0.38), edge = ink(s, 0.62);
    const sc = view === 'side' ? [[0.082, 0.283], [0.098, 0.247], [0.112, 0.214]] : view === 'threeQuarter' ? [[0.012, 0.281], [0.028, 0.246], [0.043, 0.213]] : null;
    if (sc) { W(smooth(sc.map(([x, y]) => [x + 0.004, y]), false), 0.0034, 0.55, edge); W(smooth(sc, false), 0.0052, 0.95, pale); }
  }
  return out;
}

export function headParts(D, view) {
  const s = D.skin, ln = ink(s, 0.58), old = D.age ?? 0;
  const blush = mixc(s, '#d0604a', 0.45);
  const parts = [];
  if (view === 'side') {
    const shape = smooth(headSidePts(D), true);
    const e = EYE.side;
    const draw = [F(shape, s)];
    draw.push(F(ellipse(0.108, 0.118, 0.042, 0.03), blush, { a: 0.22, blur: 0.016 }));
    draw.push(F(ellipse(0.098, 0.232, 0.05, 0.02), shade(s, 0.85), { a: 0.35, blur: 0.012 })); // brow shadow
    // ear
    const ear = smooth([[-0.004, 0.214], [0.016, 0.205], [0.022, 0.172], [0.012, 0.135], [-0.006, 0.122], [-0.022, 0.13], [-0.03, 0.16], [-0.026, 0.198]], true);
    draw.push(F(ear, shade(s, 0.94)), L(ear, ln, 0.0042));
    draw.push(L(smooth([[-0.004, 0.198], [0.008, 0.19], [0.010, 0.166], [0.002, 0.148]], false), ln, 0.0034, { a: 0.85 }));
    draw.push(F(ellipse(-0.008, 0.168, 0.008, 0.014), shade(s, 0.8), { a: 0.6 }));
    // nostril + nose wing
    const nz = D.nose ?? 1;
    draw.push(L(smooth([[0.166 + 0.006 * nz, 0.127], [0.158 + 0.006 * nz, 0.12], [0.16 + 0.01 * nz, 0.111]], false), ln, 0.0036, { a: 0.9 }));
    // mouth line (subtle)
    if (!D.beard || D.beard === 'none' || D.beard === 'stubble') draw.push(L(smooth([[0.157, 0.069], [0.145, 0.067], [0.136, 0.071]], false), ln, 0.0034, { a: 0.7 }));
    draw.push(L(smooth([[0.13, 0.002], [0.09, -0.012], [0.05, -0.02]], false), ln, 0.004, { a: 0.35 })); // under-jaw
    if (D.stubble) draw.push(F(smooth([[0.0, 0.14], [0.06, 0.1], [0.14, 0.085], [0.165, 0.05], [0.13, -0.004], [0.04, -0.02], [-0.01, 0.08]], true), D.stubble, { a: 0.35, blur: 0.006 }));
    if (old > 0.6 && D.hair === 'oldLong') for (const [x, y, r] of [[-0.02, 0.33, 0.014], [0.03, 0.345, 0.009], [-0.07, 0.31, 0.011], [0.06, 0.31, 0.007]]) draw.push(F(ellipse(x, y, r, r * 0.8), shade(s, 0.82), { a: 0.35, blur: r * 0.3 }));
    if (D.hair === 'oldLong') for (const [k, st] of [[[0.03, 0.352], [-0.04, 0.356], [-0.11, 0.33], [-0.15, 0.28]], [[0.0, 0.344], [-0.06, 0.345], [-0.12, 0.31]], [[0.05, 0.338], [-0.02, 0.348], [-0.09, 0.34], [-0.14, 0.3]], [[-0.03, 0.33], [-0.09, 0.322], [-0.13, 0.29]]].entries()) draw.push(L(smooth(st, false), D.hairColor || '#e8e3da', 0.0034 - k * 0.0003, { a: 0.85 }));
    if (D.gaunt) { const g = D.gaunt; draw.push(F(ellipse(0.072, 0.104, 0.048, 0.03), shade(s, 0.78), { a: 0.38 * g, blur: 0.02 }), F(ellipse(0.088, 0.152, 0.042, 0.013), lift(s, 0.22), { a: 0.4 * g, blur: 0.01 }), F(ellipse(0.022, 0.248, 0.03, 0.032), shade(s, 0.84), { a: 0.32 * g, blur: 0.016 })); }
    if (['wrap', 'turban'].includes(D.hair)) draw.push(F(smooth([[0.17, 0.262], [0.17, 0.235], [0.08, 0.222], [-0.02, 0.19], [-0.05, 0.215], [0.05, 0.25]], true), shade(s, 0.7), { a: 0.45, blur: 0.012 }));
    draw.push(...wrinkles(D, 'side'));
    parts.push({ id: 'head', pivot: 'head', layer: 28, density: 'face', bulge: 0.95, prof: 1.2, shape, holes: [holeOf(e)], draw, shadow: true, anchors: { eye: e.E, mouth: [0.152, 0.069], nose: [0.2, 0.128], chin: [0.14, 0.0], brow: [e.E[0], e.E[1] + 0.045], crown: [0.0, 0.362], ear: [-0.004, 0.168] } });
    parts.push(...eyeParts(D, 'N', e.E, e.hw, e.ht, e.hb, 26, { headId: 'head' }));
  } else if (view === 'threeQuarter') {
    const shape = smooth(head3qPts(D), true);
    const eN = EYE.near, eF = EYE.far;
    const draw = [F(shape, s)];
    draw.push(F(ellipse(0.04, 0.12, 0.04, 0.028), blush, { a: 0.2, blur: 0.016 }), F(ellipse(0.13, 0.118, 0.02, 0.022), blush, { a: 0.18, blur: 0.01 }));
    draw.push(F(ellipse(0.07, 0.232, 0.08, 0.02), shade(s, 0.85), { a: 0.3, blur: 0.012 }));
    // ear (left, in the silhouette bump)
    draw.push(L(smooth([[-0.152, 0.2], [-0.168, 0.188], [-0.17, 0.16], [-0.158, 0.136]], false), ln, 0.004), L(smooth([[-0.156, 0.186], [-0.162, 0.165], [-0.156, 0.148]], false), ln, 0.003, { a: 0.7 }));
    // nose: ridge + nostril
    const nz = D.nose ?? 1;
    draw.push(L(smooth([[0.084, 0.2], [0.11, 0.17], [0.135, 0.14], [0.142 + 0.01 * nz, 0.126]], false), ln, 0.0034, { a: 0.55 }));
    draw.push(L(smooth([[0.152 + 0.01 * nz, 0.124], [0.138, 0.115], [0.122, 0.118]], false), ln, 0.0036, { a: 0.9 }));
    if (!D.beard || D.beard === 'none' || D.beard === 'stubble') draw.push(L(smooth([[0.125, 0.07], [0.098, 0.066], [0.07, 0.07]], false), ln, 0.0034, { a: 0.7 }));
    if (D.stubble) draw.push(F(smooth([[-0.12, 0.13], [-0.08, 0.06], [0.0, 0.0], [0.08, -0.004], [0.13, 0.05], [0.142, 0.09], [0.1, 0.06], [0.0, 0.09], [-0.1, 0.16]], true), D.stubble, { a: 0.35, blur: 0.006 }));
    if (D.hair === 'oldLong') for (const [k, st] of [[[0.06, 0.352], [-0.02, 0.36], [-0.1, 0.338], [-0.15, 0.29]], [[0.02, 0.342], [-0.05, 0.348], [-0.12, 0.312]], [[0.09, 0.334], [0.02, 0.35], [-0.07, 0.345], [-0.13, 0.31]]].entries()) draw.push(L(smooth(st, false), D.hairColor || '#e8e3da', 0.0034 - k * 0.0003, { a: 0.85 }));
    if (D.gaunt) { const g = D.gaunt; draw.push(F(ellipse(0.0, 0.104, 0.05, 0.03), shade(s, 0.78), { a: 0.32 * g, blur: 0.02 }), F(ellipse(0.12, 0.1, 0.022, 0.03), shade(s, 0.8), { a: 0.3 * g, blur: 0.014 }), F(ellipse(0.02, 0.152, 0.05, 0.013), lift(s, 0.22), { a: 0.36 * g, blur: 0.01 })); }
    if (['wrap', 'turban'].includes(D.hair)) draw.push(F(smooth([[0.16, 0.262], [0.16, 0.236], [0.0, 0.244], [-0.16, 0.2], [-0.16, 0.225], [0.0, 0.27]], true), shade(s, 0.7), { a: 0.45, blur: 0.012 }));
    draw.push(...wrinkles(D, 'threeQuarter'));
    parts.push({ id: 'head', pivot: 'head', layer: 28, density: 'face3', bulge: 0.95, prof: 1.2, shape, holes: [holeOf(eN), holeOf(eF)], draw, shadow: true, anchors: { eye: eN.E, mouth: [0.1, 0.068], nose: [0.16, 0.128], chin: [0.08, 0.0], brow: [0.07, 0.235], crown: [0.0, 0.362], ear: [-0.16, 0.17] } });
    parts.push(...eyeParts(D, 'N', eN.E, eN.hw, eN.ht, eN.hb, 26, { headId: 'head' }));
    parts.push(...eyeParts(D, 'F', eF.E, eF.hw, eF.ht, eF.hb, 26.05, { headId: 'head' }));
  } else {
    const shape = smooth(headBackPts(D), true);
    const draw = [F(shape, s)];
    for (const sx of [-1, 1]) draw.push(L(smooth([[0.152 * sx, 0.2], [0.168 * sx, 0.188], [0.17 * sx, 0.16], [0.158 * sx, 0.136]], false), ln, 0.004));
    draw.push(L(smooth([[-0.05, 0.0], [0.0, -0.012], [0.05, 0.0]], false), ln, 0.003, { a: 0.4 }));
    parts.push({ id: 'head', pivot: 'head', layer: 28, density: 'face3', bulge: 0.95, prof: 1.2, shape, draw, shadow: true, anchors: { crown: [0, 0.362] } });
  }
  return parts;
}

// ---------------------------------------------------------------- brows
export function browParts(D, view) {
  const col = D.browColor || shade(D.hairColor || '#33251b', 0.85);
  const bushy = D.brows === 'bushy', thin = D.brows === 'thin';
  const ln = shade(col, bushy ? 0.78 : 0.7);
  const mk = (tag, w, k = 1) => {
    let shape, draw;
    if (bushy) {
      const pts = [[-w * 1.15, -0.008], [-w * 0.95, 0.012], [-w * 0.55, 0.022], [-w * 0.1, 0.027], [w * 0.4, 0.024], [w * 0.85, 0.016], [w * 1.05, 0.004], [w * 0.75, -0.006], [w * 0.2, -0.008], [-w * 0.4, -0.012], [-w * 0.95, -0.022, 0.5]];
      shape = smooth(pts.map(([x, y, kk]) => [x, y * k, kk ?? 1]), true);
      draw = [F(shape, col)];
      for (let i = 0; i < 6; i++) { const x0 = -w * 0.95 + i * w * 0.36; draw.push(L(smooth([[x0, -0.004 * k], [x0 + w * 0.12, 0.012 * k], [x0 + w * 0.3, 0.018 * k]], false), ln, 0.0028, { a: 0.85 })); }
      draw.push(L(smooth([[-w * 0.85, -0.016 * k], [-w * 1.05, -0.026 * k]], false), ln, 0.0026, { a: 0.7 }));
    } else {
      const h = thin ? 0.0065 : 0.0095;
      const pts = [[-w, -h * 0.4, 0.6], [-w * 0.4, h * 1.1], [w * 0.4, h * 1.2], [w, h * 0.2, 0.6], [w * 0.5, -h * 0.6], [-w * 0.5, -h * 0.8]];
      shape = smooth(pts.map(([x, y, kk]) => [x, y * k, kk ?? 1]), true);
      draw = [F(shape, col)];
      for (let i = 0; i < 3; i++) draw.push(L(smooth([[-w * 0.8 + i * w * 0.55, -h * 0.4], [-w * 0.55 + i * w * 0.55, h * 0.6]], false), ln, 0.002, { a: 0.6 }));
    }
    if (D.scar && tag === 'N') draw.push(L(poly([[-w * 0.05, 0.03], [w * 0.2, -0.03]], false), D.skin, 0.0085, { a: 1 }));   // the scar splits the brow
    return { id: `brow${tag}`, pivot: `brow${tag}`, layer: 31 + (tag === 'F' ? 0.01 : 0), outline: false, density: 'face', bulge: 0.4, rim: false, shape, draw };
  };
  if (view === 'side') return [mk('N', bushy ? 0.05 : 0.04)];
  if (view === 'threeQuarter') return [mk('N', bushy ? 0.046 : 0.037), mk('F', bushy ? 0.03 : 0.024, 0.9)];
  return [];
}

// ---------------------------------------------------------------- mouths (overlay at the mouth pivot)
export function mouthParts(D, view) {
  const k = view === 'threeQuarter' ? 0.9 : 1, dark = '#4a1912', teeth = '#f1e2cc', tongue = '#a2483c';
  const sh = (pts) => smooth(pts.map(([x, y, c]) => [x * k, y, c ?? 1]), true);
  const out = [];
  const add = (key, shape, draw) => out.push({ id: `mouth_${key}`, pivot: 'mouth', layer: 33, outline: false, density: 'face', bulge: 0.2, rim: false, shape, draw: [F(shape, dark), ...draw], toggle: `mouth:${key}` });
  const smile = sh([[-0.03, 0.012, 0.3], [-0.012, -0.004], [0.006, -0.006], [0.012, 0.0, 0.3], [0.004, -0.001], [-0.012, 0.001]]);
  add('smile', smile, []);
  const frown = sh([[-0.03, -0.008, 0.3], [-0.012, 0.007], [0.008, 0.006], [0.012, 0.0, 0.3], [0.004, 0.0018], [-0.012, 0.002]]);
  add('frown', frown, []);
  add('o', ellipse(-0.006, -0.008, 0.011, 0.014), [F(ellipse(-0.006, -0.014, 0.007, 0.006), tongue, { a: 0.8 })]);
  const open = sh([[-0.036, 0.004, 0.4], [-0.018, -0.026], [0.006, -0.03], [0.016, -0.008, 0.4], [0.006, 0.002], [-0.016, 0.004]]);
  add('open', open, [F(sh([[-0.032, 0.004], [0.014, 0.002], [0.012, -0.006], [-0.03, -0.004]]), teeth), F(ellipse(-0.008, -0.024, 0.016, 0.009), tongue, { a: 0.9 })]);
  const laugh = sh([[-0.04, 0.008, 0.4], [-0.022, -0.03], [0.004, -0.036], [0.018, -0.01, 0.4], [0.008, 0.004], [-0.02, 0.006]]);
  add('laugh', laugh, [F(sh([[-0.036, 0.006], [0.016, 0.004], [0.014, -0.006], [-0.034, -0.004]]), teeth), F(ellipse(-0.01, -0.028, 0.017, 0.01), tongue)]);
  add('talk', ellipse(-0.006, -0.008, 0.018, 0.014), [F(poly([[-0.022, -0.002], [0.01, -0.002], [0.008, 0.004], [-0.02, 0.004]]), teeth, { a: 0.9 })]);
  return out;
}


// ---------------------------------------------------------------- wrapped head-cloth (folds converge into a knot at the back)
// returns drawing elements for the main wrap, plus knot and tail specs (head space)
function clothWrap(view, wc, tall, lowerEdge) {
  const wl = ink(wc, 0.66), hi = lift(wc, 0.35), dk = shade(wc, 0.88);
  const cfg = {
    side: { K: [-0.192, 0.238], C: [-0.02, 0.27], ends: [[0.158, 0.292], [0.153, 0.33 + tall], [0.124, 0.366 + tall], [0.066, 0.396 + tall * 1.3], [-0.018, 0.408 + tall * 1.3], [-0.1, 0.392 + tall]] },
    threeQuarter: { K: [-0.198, 0.236], C: [-0.02, 0.28], ends: [[0.15, 0.29], [0.142, 0.33 + tall], [0.104, 0.37 + tall], [0.034, 0.4 + tall], [-0.048, 0.408 + tall], [-0.128, 0.385 + tall]] },
    back: { K: [0.0, 0.17], C: [0.0, 0.27], ends: [[0.192, 0.27], [0.17, 0.33], [0.105, 0.385 + tall], [0.0, 0.41 + tall], [-0.105, 0.385 + tall], [-0.17, 0.33], [-0.192, 0.27]] },
  }[view];
  const { K, C, ends } = cfg;
  const ctrl = (e, k = 0.026) => { const m = [(K[0] + e[0]) / 2, (K[1] + e[1]) / 2]; const dx = m[0] - C[0], dy = m[1] - C[1], l = Math.hypot(dx, dy) || 1; return [m[0] + dx / l * k, m[1] + dy / l * k]; };
  const draw = [];
  // soft alternating wedges between folds (cloth layers), then the fold lines with a highlight lip
  for (let i = 0; i + 1 < ends.length; i += 2) draw.push(F(smooth([[K[0], K[1], 0], ctrl(ends[i]), [ends[i][0], ends[i][1], 0.5], [ends[i + 1][0], ends[i + 1][1], 0.5], ctrl(ends[i + 1])], true), dk, { a: 0.75, blur: 0.005 }));
  ends.forEach((e, i) => {
    const c = ctrl(e);
    draw.push(L(smooth([K, c, e], false), wl, 0.0042, { a: 0.78 }));
    draw.push(L(smooth([[K[0] + 0.006, K[1] + 0.008], [c[0], c[1] + 0.007], [e[0] - 0.004, e[1] + 0.007]], false), hi, 0.0028, { a: i % 2 ? 0.55 : 0.35 }));
  });
  // brim: a narrow rolled edge along the lower boundary (not a stripe across the head)
  if (lowerEdge) {
    const up = lowerEdge.map(([x, y]) => [x - 0.004, y + 0.026]);
    draw.push(F(smooth([...lowerEdge.map(([x, y]) => [x, y - 0.01]), ...up.slice().reverse()].map((p, i, a) => (i === 0 || i === a.length - 1 || i === lowerEdge.length - 1 || i === lowerEdge.length ? [p[0], p[1], 0.4] : p)), true), dk));
    draw.push(L(smooth(up, false), wl, 0.0042, { a: 0.8 }), L(smooth(up.map(([x, y]) => [x, y + 0.006]), false), hi, 0.0028, { a: 0.5 }));
  }
  // knot (two lobes) + hanging tail
  let knot, tail;
  if (view === 'back') {
    knot = { pts: [[0.0, 0.205], [0.035, 0.205], [0.058, 0.18], [0.05, 0.145], [0.018, 0.135], [0.0, 0.15, 0.6], [-0.018, 0.135], [-0.05, 0.145], [-0.058, 0.18], [-0.035, 0.205]],
      lines: [[[0.0, 0.2], [0.004, 0.17], [0.0, 0.15]], [[0.04, 0.19], [0.03, 0.165], [0.012, 0.15]], [[-0.04, 0.19], [-0.03, 0.165], [-0.012, 0.15]]] };
    tail = { pts: [[-0.03, 0.17], [0.03, 0.17], [0.04, 0.05], [0.05, -0.06], [0.064, -0.15, 0.6], [-0.032, -0.155, 0.6], [-0.04, -0.05], [-0.038, 0.06]], lines: [[[0.0, 0.15], [0.006, 0.02], [0.016, -0.13]], [[0.024, 0.12], [0.032, -0.02], [0.046, -0.13]]], fringe: [[-0.03, -0.152], [0.06, -0.15]] };
  } else {
    const dx = view === 'side' ? 0 : -0.006;
    knot = { pts: [[-0.166 + dx, 0.262], [-0.19 + dx, 0.286], [-0.222 + dx, 0.278], [-0.24 + dx, 0.252], [-0.234 + dx, 0.222], [-0.212 + dx, 0.204], [-0.182 + dx, 0.21], [-0.165 + dx, 0.234]],
      lines: [[[-0.2 + dx, 0.282], [-0.206 + dx, 0.246], [-0.196 + dx, 0.212]], [[-0.17 + dx, 0.25], [-0.2 + dx, 0.244], [-0.234 + dx, 0.238]]] };
    tail = { pts: [[-0.208 + dx, 0.236], [-0.178 + dx, 0.228], [-0.17 + dx, 0.12], [-0.178 + dx, -0.02], [-0.194 + dx, -0.15, 0.6], [-0.242 + dx, -0.142, 0.6], [-0.24 + dx, -0.02], [-0.232 + dx, 0.12]],
      lines: [[[-0.2 + dx, 0.2], [-0.205 + dx, 0.05], [-0.218 + dx, -0.12]], [[-0.185 + dx, 0.15], [-0.188 + dx, 0.0], [-0.2 + dx, -0.13]]], fringe: [[-0.242 + dx, -0.142], [-0.194 + dx, -0.15]] };
  }
  return { draw, knot, tail, wl, hi };
}

// ---------------------------------------------------------------- hair
// returns parts on 'head' (caps) and on 'hairBack' (long hanging mass, deformable strip)
export function hairParts(D, view) {
  const st = D.hair || 'short', c = D.hairColor || '#33251b';
  if (st === 'none') return [];
  const ln = mixc(c, D.age > 0.5 ? '#9a948a' : '#000000', 0.32), hi = lift(c, 0.18);
  const P = [];
  const cap = (id, pts, strands, extra = {}) => {
    const shape = smooth(pts, true);
    const draw = [F(shape, extra.fill || c)];
    for (const s of strands) draw.push(L(smooth(s.pts, false), s.col || ln, s.w || 0.0036, { a: s.a ?? 0.85 }));
    if (extra.extraDraw) draw.push(...extra.extraDraw);
    P.push({ id, pivot: extra.pivot || 'head', layer: extra.layer ?? 30, density: extra.density || 'face', bulge: extra.bulge ?? 0.75, prof: 1.5, shape, draw, shadow: true, ...(extra.strip ? { strip: extra.strip } : {}), ...(extra.toggle ? { toggle: extra.toggle } : {}) });
  };
  const S = (pts, w, a, col) => ({ pts, w, a, col });
  const cloth = ['wrap', 'turban', 'veil', 'mitre', 'helmet'].includes(st);
  const TALL = { turban: 0.03, mitre: 0.15, helmet: -0.004 };
  const wc = D.wrap || '#d9c9a6', wl = ink(wc, 0.7);
  const knotAndTail = (W, dens, tailLayer) => {
    cap('wrapKnot', W.knot.pts, W.knot.lines.map((l) => S(l, 0.0038, 0.75, W.wl)), { fill: shade(wc, 0.96), layer: 30.7, bulge: 0.6, density: dens });
    if (D.wrapTail) {
      const fr = []; const [a, b] = W.tail.fringe; for (let i = 0; i <= 6; i++) { const x = a[0] + (b[0] - a[0]) * i / 6, y = a[1] + (b[1] - a[1]) * i / 6; fr.push(S([[x, y + 0.012], [x + 0.002, y + 0.002]], 0.0026, 0.7, W.wl)); }
      cap('wrapTail', W.tail.pts, [...W.tail.lines.map((l) => S(l, 0.0036, 0.7, W.wl)), S(W.tail.lines[0].map(([x, y]) => [x + 0.008, y]), 0.0026, 0.45, W.hi), ...fr], { fill: shade(wc, 0.93), pivot: 'hairBack', layer: tailLayer, strip: { bend: 'tail', cols: 3, w0: 0.1 }, density: dens });
    }
  };
  if (view === 'side') {
    if (st === 'short' || st === 'modern') {
      const q = st === 'modern' ? 0.012 : 0;
      cap('hair', [[0.128, 0.292], [0.118 + q, 0.338 + q], [0.06 + q, 0.381 + q], [-0.03, 0.39], [-0.11, 0.37], [-0.162, 0.31], [-0.176, 0.2], [-0.165, 0.09], [-0.12, 0.018, 0.6], [-0.088, 0.05], [-0.066, 0.11], [-0.04, 0.2], [0.0, 0.222], [0.03, 0.2, 0.6], [0.036, 0.14, 0.4], [0.052, 0.138, 0.4], [0.06, 0.215], [0.09, 0.268]],
        [S([[0.11, 0.33], [0.04, 0.36], [-0.06, 0.35], [-0.14, 0.29]]), S([[0.1, 0.3], [0.02, 0.33], [-0.08, 0.31], [-0.15, 0.22]]), S([[0.06, 0.25], [-0.02, 0.28], [-0.11, 0.23], [-0.15, 0.13]]), S([[-0.07, 0.36], [-0.13, 0.31], [-0.16, 0.24]], 0.003, 0.6, hi)]);
    } else if (st === 'long') {
      cap('hair', [[0.13, 0.292], [0.12, 0.34], [0.06, 0.382], [-0.03, 0.392], [-0.115, 0.372], [-0.168, 0.31], [-0.182, 0.2], [-0.15, 0.13], [-0.09, 0.12], [-0.035, 0.19], [0.0, 0.226], [0.06, 0.226], [0.092, 0.27]],
        [S([[0.11, 0.33], [0.04, 0.36], [-0.06, 0.35], [-0.15, 0.28]]), S([[0.09, 0.3], [0.0, 0.32], [-0.1, 0.29], [-0.16, 0.2]]), S([[0.05, 0.25], [-0.03, 0.27], [-0.1, 0.22]], 0.003, 0.7)]);
      const back = [[-0.05, 0.25], [-0.13, 0.24], [-0.178, 0.17], [-0.19, 0.05], [-0.185, -0.08], [-0.17, -0.2], ...wavy(-0.17, -0.2, -0.02, -0.21, 6, 0.03, D.seed || 3), [-0.02, -0.21], [-0.035, -0.08], [-0.04, 0.03], [-0.03, 0.14]];
      cap('hairBack', back, [S([[-0.15, 0.2], [-0.17, 0.05], [-0.15, -0.17]]), S([[-0.11, 0.2], [-0.13, 0.02], [-0.1, -0.18]]), S([[-0.07, 0.18], [-0.085, 0.0], [-0.06, -0.16]]), S([[-0.13, 0.12], [-0.155, -0.05], [-0.13, -0.19]], 0.0028, 0.6, hi)], { pivot: 'hairBack', layer: 18, strip: { bend: 'hair', cols: 4, w0: 0.25 } });
    } else if (st === 'oldLong') {
      // bald crown, a white fringe behind the ear, long thin hair falling to the shoulders
      const back = [[-0.035, 0.262], [-0.1, 0.27], [-0.162, 0.23], [-0.184, 0.14], [-0.184, 0.02], [-0.176, -0.12], [-0.16, -0.22], ...wavy(-0.16, -0.22, -0.035, -0.26, 7, 0.035, (D.seed || 1) + 4), [-0.035, -0.26], [-0.045, -0.12], [-0.04, 0.02], [-0.032, 0.12], [-0.034, 0.2]];
      cap('hairBack', back, [S([[-0.06, 0.25], [-0.15, 0.2], [-0.172, 0.04], [-0.15, -0.2]], 0.0034), S([[-0.07, 0.2], [-0.13, 0.14], [-0.14, -0.02], [-0.115, -0.22]], 0.003), S([[-0.05, 0.14], [-0.09, 0.06], [-0.095, -0.1], [-0.075, -0.23]], 0.003), S([[-0.165, 0.12], [-0.17, -0.06], [-0.145, -0.2]], 0.0026, 0.6), S([[-0.1, 0.24], [-0.16, 0.15], [-0.16, 0.0]], 0.0026, 0.5, shade(c, 1.04))],
        { pivot: 'hairBack', layer: 29.5, strip: { bend: 'hair', cols: 4, w0: 0.3 }, extraDraw: [
          F(smooth([[-0.04, 0.24], [-0.06, 0.1], [-0.07, -0.08], [-0.06, -0.22], [-0.035, -0.24], [-0.03, 0.0], [-0.03, 0.2]], true), shade(c, 0.8), { a: 0.55, blur: 0.018 }),
          F(ellipse(-0.1, 0.2, 0.06, 0.03), shade(c, 0.86), { a: 0.4, blur: 0.02 }),
          L(smooth([[-0.12, 0.22], [-0.158, 0.1], [-0.162, -0.08], [-0.135, -0.24]], false), mixc(c, '#8f897f', 0.45), 0.0024, { a: 0.6 }),
          L(smooth([[-0.085, 0.16], [-0.11, 0.0], [-0.1, -0.2]], false), mixc(c, '#8f897f', 0.45), 0.0024, { a: 0.55 }),
          L(smooth([[-0.14, 0.17], [-0.18, 0.0], [-0.168, -0.16]], false), lift(c, 0.6), 0.0024, { a: 0.6 })] });
      // wispy strands over the bald top
      // (thin crown strands are drawn on the head itself — see headParts)
    } else if (st === 'curly') {
      const outer = [[0.13, 0.29], [0.13, 0.335], [0.1, 0.37], [0.06, 0.39], [0.015, 0.405], [-0.035, 0.405], [-0.085, 0.395], [-0.125, 0.37], [-0.16, 0.335], [-0.185, 0.29], [-0.195, 0.24], [-0.195, 0.185], [-0.188, 0.13], [-0.17, 0.08], [-0.14, 0.04], [-0.1, 0.03]];
      const pts = outer.map(([x, y], i) => [x, y, i % 2 ? 1.4 : 0.35]).concat([[-0.075, 0.08], [-0.05, 0.16], [-0.015, 0.21], [0.03, 0.2, 0.5], [0.04, 0.15, 0.4], [0.055, 0.15, 0.4], [0.065, 0.225], [0.095, 0.27]]);
      const curls = [];
      for (let i = 0; i < 9; i++) { const a = 0.6 + i * 0.32, rx = -0.04 + Math.cos(a) * 0.11, ry = 0.24 + Math.sin(a) * 0.1; curls.push(S([[rx - 0.012, ry - 0.004], [rx, ry + 0.01], [rx + 0.012, ry]], 0.003, 0.75)); }
      cap('hair', pts, curls);
    } else if (st === 'bald') {
      cap('hair', [[-0.03, 0.225], [-0.1, 0.25], [-0.16, 0.2], [-0.172, 0.11], [-0.13, 0.03, 0.6], [-0.095, 0.06], [-0.1, 0.13], [-0.075, 0.19], [-0.035, 0.2]], [S([[-0.05, 0.22], [-0.13, 0.21], [-0.155, 0.12]], 0.003)]);
    } else if (cloth) {
      const tall = TALL[st] ?? 0;
      cap('hair', [[0.12, 0.25], [0.04, 0.28], [-0.05, 0.27], [-0.06, 0.2], [0.02, 0.22]], [], { fill: c, layer: 29.4, bulge: 0.3 });
      if (st === 'veil') {
        const pts = [[0.04, 0.392], [-0.06, 0.4], [-0.15, 0.36], [-0.205, 0.27], [-0.225, 0.12], [-0.232, -0.06], [-0.24, -0.2], [-0.25, -0.32], [-0.13, -0.33], [-0.05, -0.31], [-0.04, -0.14], [-0.03, -0.02], [0.02, 0.1], [0.06, 0.2], [0.11, 0.26], [0.142, 0.285], [0.13, 0.34], [0.1, 0.375]];
        cap('veil', pts, [S([[0.12, 0.32], [0.0, 0.36], [-0.14, 0.3], [-0.2, 0.14]], 0.004, 0.8, wl), S([[-0.06, 0.2], [-0.13, 0.05], [-0.16, -0.2]], 0.0038, 0.7, wl), S([[-0.13, 0.25], [-0.2, 0.05], [-0.21, -0.25]], 0.0038, 0.7, wl), S([[0.14, 0.285], [0.06, 0.24], [0.0, 0.14]], 0.006, 0.9, shade(wc, 0.86))], { fill: wc, pivot: 'hairBack', layer: 30, strip: { bend: 'hair', cols: 5, w0: 0.4 }, density: 'face' });
      } else {
        const pts = [[0.155, 0.268], [0.158, 0.31 + tall], [0.13, 0.36 + tall], [0.07, 0.398 + tall * 1.4], [-0.02, 0.41 + tall * 1.4], [-0.1, 0.395 + tall], [-0.165, 0.35], [-0.2, 0.27], [-0.205, 0.17], [-0.18, 0.08], [-0.14, 0.03, 0.6], [-0.09, 0.07], [-0.07, 0.15], [-0.04, 0.2], [0.03, 0.235], [0.1, 0.25]];
        const W = clothWrap('side', wc, tall, [[0.162, 0.268], [0.1, 0.25], [0.03, 0.235], [-0.04, 0.2], [-0.07, 0.15]]);
        cap('wrap', pts, [], { fill: wc, extraDraw: W.draw, bulge: 0.8 });
        if (st !== 'helmet' && st !== 'mitre') knotAndTail(W, 'face', 18);
        if (D.hairUnder) cap('hairUnder', [[-0.14, 0.05], [-0.1, 0.07], [-0.07, 0.0], [-0.09, -0.08], [-0.13, -0.1], [-0.17, -0.04]], [S([[-0.12, 0.04], [-0.12, -0.06]], 0.003, 0.7)], { fill: D.hairUnder, layer: 27.6 });
      }
    }
    if (D.headband) {
      const hb = D.headband;
      cap('headband', [[0.153, 0.262], [0.157, 0.288], [0.04, 0.322], [-0.08, 0.316], [-0.17, 0.275], [-0.18, 0.25], [-0.08, 0.288], [0.04, 0.296]], [S([[0.15, 0.275], [0.04, 0.308], [-0.08, 0.302], [-0.17, 0.262]], 0.0025, 0.6, lift(hb, 0.3))], { fill: hb, layer: 30.5, bulge: 0.5 });
    }
  } else if (view === 'threeQuarter') {
    if (st === 'short' || st === 'modern' || st === 'long' || st === 'curly') {
      const curly = st === 'curly';
      const pts = curly
        ? [[0.135, 0.28], [0.138, 0.33, 1.4], [0.1, 0.375, 0.35], [0.05, 0.4, 1.4], [-0.01, 0.41, 0.35], [-0.07, 0.4, 1.4], [-0.12, 0.375, 0.35], [-0.16, 0.33, 1.4], [-0.185, 0.27, 0.35], [-0.192, 0.2, 1.4], [-0.18, 0.13, 0.35], [-0.16, 0.12], [-0.142, 0.2], [-0.1, 0.27], [-0.02, 0.285], [0.06, 0.27], [0.11, 0.255]]
        : [[0.136, 0.28], [0.13, 0.33], [0.08, 0.377], [0.0, 0.392], [-0.08, 0.38], [-0.14, 0.34], [-0.172, 0.27], [-0.178, 0.19], [-0.16, 0.13], [-0.15, 0.2], [-0.12, 0.262], [-0.06, 0.283], [0.02, 0.277], [0.07, 0.262], [0.11, 0.258]];
      cap('hair', pts, [S([[0.1, 0.34], [0.0, 0.37], [-0.1, 0.35], [-0.16, 0.28]]), S([[0.06, 0.3], [-0.03, 0.33], [-0.12, 0.3], [-0.165, 0.22]]), S([[-0.02, 0.385], [-0.04, 0.33], [-0.03, 0.29]], 0.003, 0.6)], { density: 'face3' });
      if (st === 'long') {
        const back = [[-0.08, 0.26], [-0.16, 0.24], [-0.19, 0.12], [-0.192, 0.0], [-0.18, -0.16], ...wavy(-0.18, -0.16, -0.08, -0.18, 4, 0.025, (D.seed || 3) + 1), [-0.08, -0.18], [-0.1, -0.02], [-0.12, 0.12]];
        cap('hairBack', back, [S([[-0.16, 0.18], [-0.175, 0.0], [-0.16, -0.14]]), S([[-0.12, 0.16], [-0.14, 0.0], [-0.12, -0.15]])], { pivot: 'hairBack', layer: 18, strip: { bend: 'hair', cols: 4, w0: 0.3 }, density: 'face3' });
      }
    } else if (st === 'oldLong') {
      const back = [[-0.07, 0.258, 0.8], [-0.125, 0.268], [-0.172, 0.232], [-0.192, 0.16], [-0.198, 0.04], [-0.19, -0.1], [-0.17, -0.2], ...wavy(-0.17, -0.2, -0.09, -0.23, 5, 0.03, (D.seed || 1) + 5), [-0.09, -0.23], [-0.108, -0.1], [-0.118, 0.04], [-0.108, 0.14], [-0.085, 0.21]];
      cap('hairBack', back, [S([[-0.11, 0.26], [-0.17, 0.17], [-0.18, 0.0], [-0.16, -0.18]], 0.0032), S([[-0.15, 0.2], [-0.16, 0.05], [-0.14, -0.15]], 0.003), S([[-0.13, 0.12], [-0.12, -0.05], [-0.11, -0.2]], 0.003)], { pivot: 'hairBack', layer: 29.5, strip: { bend: 'hair', cols: 4, w0: 0.3 }, density: 'face3' });

    } else if (st === 'bald') {
      cap('hair', [[-0.12, 0.27], [-0.17, 0.22], [-0.178, 0.14], [-0.16, 0.08], [-0.145, 0.13], [-0.14, 0.2], [-0.11, 0.25]], [], { density: 'face3' });
    } else if (cloth) {
      if (st === 'veil') {
        const pts = [[0.13, 0.29], [0.11, 0.35], [0.04, 0.395], [-0.06, 0.4], [-0.15, 0.36], [-0.2, 0.27], [-0.22, 0.1], [-0.225, -0.1], [-0.235, -0.3], [-0.06, -0.32], [-0.08, -0.1], [-0.1, 0.05], [-0.12, 0.15], [-0.08, 0.25], [0.0, 0.29], [0.08, 0.285]];
        cap('veil', pts, [S([[0.1, 0.34], [-0.02, 0.37], [-0.15, 0.3], [-0.2, 0.12]], 0.004, 0.8, wl), S([[-0.15, 0.2], [-0.19, 0.0], [-0.2, -0.25]], 0.004, 0.7, wl)], { fill: wc, pivot: 'hairBack', layer: 30, strip: { bend: 'hair', cols: 5, w0: 0.4 }, density: 'face3' });
      } else {
        const tall = TALL[st] ?? 0;
        const pts = [[0.15, 0.255], [0.155, 0.31 + tall], [0.12, 0.36 + tall], [0.05, 0.4 + tall], [-0.04, 0.408 + tall], [-0.12, 0.385 + tall], [-0.175, 0.33], [-0.2, 0.25], [-0.2, 0.17], [-0.17, 0.14], [-0.15, 0.2], [-0.1, 0.25], [0.0, 0.27], [0.08, 0.262]];
        const W = clothWrap('threeQuarter', wc, tall, [[0.155, 0.256], [0.08, 0.263], [0.0, 0.27], [-0.1, 0.25], [-0.15, 0.2]]);
        cap('wrap', pts, [], { fill: wc, density: 'face3', extraDraw: W.draw, bulge: 0.8 });
        if (st !== 'helmet' && st !== 'mitre') knotAndTail(W, 'face3', 18);
      }
    }
    if (D.headband) cap('headband', [[0.148, 0.258], [0.152, 0.286], [0.0, 0.31], [-0.14, 0.29], [-0.18, 0.25], [-0.17, 0.225], [-0.06, 0.27], [0.06, 0.272]], [], { fill: D.headband, layer: 30.5, density: 'face3', bulge: 0.5 });
  } else { // back
    const cover = ['short', 'modern', 'long', 'curly'].includes(st);
    if (cover) {
      const curly = st === 'curly';
      const half = curly ? [[0.0, 0.41], [0.07, 0.4, 0.35], [0.13, 0.37, 1.4], [0.175, 0.31, 0.35], [0.195, 0.24, 1.4], [0.19, 0.16, 0.35], [0.165, 0.09, 1.4], [0.12, 0.04, 0.4]] : [[0.0, 0.392], [0.09, 0.378], [0.152, 0.33], [0.178, 0.25], [0.175, 0.15], [0.15, 0.07], [0.11, 0.035, 0.6]];
      const pts = [...half, [0.0, 0.05], ...mirrorPts(half.slice().reverse())].slice(0, -1);
      if (st === 'long') {
        const lh = [[0.0, 0.392], [0.09, 0.378], [0.152, 0.33], [0.18, 0.25], [0.184, 0.12], [0.176, -0.02], [0.162, -0.18]];
        const pl = [...lh, ...wavy(0.162, -0.18, -0.162, -0.18, 8, 0.025, (D.seed || 3) + 7), ...mirrorPts(lh.slice(1).reverse())];
        cap('hair', pl, [S([[0.0, 0.38], [0.01, 0.2], [0.0, -0.16]], 0.0035, 0.6), S([[0.1, 0.36], [0.13, 0.15], [0.1, -0.16]]), S([[-0.1, 0.36], [-0.13, 0.15], [-0.1, -0.16]]), S([[0.05, 0.37], [0.065, 0.1], [0.05, -0.17]], 0.003, 0.6), S([[-0.05, 0.37], [-0.065, 0.1], [-0.05, -0.17]], 0.003, 0.6)],
          { density: 'face3', layer: 30, strip: { bend: 'hair', cols: 5, w0: 0.55 }, extraDraw: [F(ellipse(0, 0.06, 0.13, 0.06), shade(c, 0.85), { a: 0.35, blur: 0.03 })] });
      } else cap('hair', pts, [S([[0.0, 0.38], [0.01, 0.25], [0.0, 0.1]], 0.0035, 0.6), S([[0.1, 0.36], [0.13, 0.25], [0.11, 0.1]]), S([[-0.1, 0.36], [-0.13, 0.25], [-0.11, 0.1]])], { density: 'face3', layer: 30 });
    } else if (st === 'oldLong' || st === 'bald') {
      const lng = st === 'oldLong';
      const pts = lng
        ? [[0.0, 0.265], [0.1, 0.262], [0.16, 0.22], [0.175, 0.12], [0.16, -0.05], [0.13, -0.2], ...wavy(0.13, -0.2, -0.13, -0.2, 9, 0.03, (D.seed || 1) + 9), [-0.13, -0.2], [-0.16, -0.05], [-0.175, 0.12], [-0.16, 0.22], [-0.1, 0.262]]
        : [[0.0, 0.2], [0.1, 0.2], [0.16, 0.17], [0.17, 0.1], [0.12, 0.03], [0.0, 0.02], [-0.12, 0.03], [-0.17, 0.1], [-0.16, 0.17], [-0.1, 0.2]];
      cap(lng ? 'hairBack' : 'hair', pts, [S([[0.1, 0.24], [0.13, 0.05], [0.11, -0.18]], 0.0032), S([[-0.1, 0.24], [-0.13, 0.05], [-0.11, -0.18]], 0.0032), S([[0.03, 0.25], [0.04, 0.05], [0.03, -0.18]], 0.003), S([[-0.04, 0.25], [-0.05, 0.05], [-0.04, -0.18]], 0.003)], lng ? { pivot: 'hairBack', layer: 30.2, strip: { bend: 'hair', cols: 6, w0: 0.25 }, density: 'face3' } : { density: 'face3' });
    } else if (cloth) {
      if (st === 'veil') {
        const pts = [[0.0, 0.4], [0.12, 0.38], [0.19, 0.3], [0.21, 0.15], [0.22, -0.05], [0.24, -0.32], [0.0, -0.33], [-0.24, -0.32], [-0.22, -0.05], [-0.21, 0.15], [-0.19, 0.3], [-0.12, 0.38]];
        cap('veil', pts, [S([[0.0, 0.38], [0.02, 0.1], [0.0, -0.3]], 0.004, 0.6, wl), S([[0.12, 0.3], [0.15, 0.0], [0.16, -0.28]], 0.004, 0.7, wl), S([[-0.12, 0.3], [-0.15, 0.0], [-0.16, -0.28]], 0.004, 0.7, wl)], { fill: wc, pivot: 'hairBack', layer: 30.2, strip: { bend: 'hair', cols: 6, w0: 0.4 }, density: 'face3' });
      } else {
        const tall = TALL[st] ?? 0;
        const half = [[0.0, 0.41 + tall], [0.1, 0.39 + tall], [0.17, 0.33], [0.2, 0.24], [0.19, 0.12], [0.15, 0.06, 0.6]];
        const pts = [...half, [0.0, 0.08], ...mirrorPts(half.slice().reverse())].slice(0, -1);
        const W = clothWrap('back', wc, tall, null);
        cap('wrap', pts, [], { fill: wc, density: 'face3', layer: 30, extraDraw: W.draw, bulge: 0.8 });
        if (st !== 'helmet' && st !== 'mitre') knotAndTail(W, 'face3', 30.3);
      }
    }
    if (D.headband && !cloth) cap('headband', [[0.17, 0.235], [0.172, 0.262], [0.0, 0.3], [-0.172, 0.262], [-0.17, 0.235], [0.0, 0.272]], [], { fill: D.headband, layer: 30.5, density: 'face3', bulge: 0.5 });
  }
  return P;
}

// ---------------------------------------------------------------- beards + moustaches (beard pivot on the head)
// beard pivot sits at BEARD_PIV (head space); shapes are given in head space and shifted.
export const BEARD_PIV = { side: [0.07, 0.06], threeQuarter: [0.03, 0.05], back: [0.0, 0.05] };
// organic edge: points from a to b with gentle lock bumps (k: smoothing per point)
const lockEdge = (a, b, n, amp, seed, out = 1) => {
  const r = mulberry32(seed), pts = [];
  for (let i = 1; i < n; i++) {
    const t = i / n, nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1;
    const bump = (i % 2 ? 1 : 0.25) * amp * (0.6 + 0.8 * r()) * out;
    pts.push([a[0] + (b[0] - a[0]) * t + nx / l * bump, a[1] + (b[1] - a[1]) * t + ny / l * bump, i % 2 ? 1.1 : 0.7]);
  }
  return pts;
};
const curveEdge = (xf, yf, t0, t1, n, amp, seed, out = 1) => {
  const r = mulberry32(seed), pts = [];
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push([xf(t) + out * (i % 2 ? 1 : 0.2) * amp * (0.6 + 0.8 * r()), yf(t), i % 2 ? 1.1 : 0.8]); }
  return pts;
};
export function beardParts(D, view, beardLenBody = 0) {
  const st = D.beard || 'none';
  if (st === 'none' || st === 'stubble' || view === 'back') return [];
  const c = D.beardColor || D.hairColor || '#33251b', light = lum(c) > 0.55;
  const ln = mixc(c, light ? '#857e74' : '#000000', light ? 0.42 : 0.3), hi = lift(c, light ? 0.6 : 0.22), sh = shade(c, light ? 0.8 : 0.75);
  const out = [];
  const piv = BEARD_PIV[view];
  const tipY = { trim: -0.045, short: -0.04, medium: -0.2, long: -0.42, knee: -(beardLenBody || 0.95) }[st] ?? -0.04;
  const seed = D.seed || 1;
  const r = mulberry32(seed * 7 + 3);
  let pts, strands = [], shadeEl = [];
  const L0 = -tipY;
  if (view === 'side') {
    const top = [[0.004, 0.18], [0.03, 0.15], [0.075, 0.118], [0.118, 0.1], [0.148, 0.084], [0.168, 0.058], [0.176, 0.03]];
    if (st === 'trim') {
      // a short, neat beard along the jaw and chin (the cheeks stay clear)
      pts = [[0.004, 0.13], [0.03, 0.095], [0.07, 0.07], [0.11, 0.054], [0.145, 0.047], [0.168, 0.036], [0.178, 0.014], [0.174, -0.008], [0.158, -0.03], [0.13, -0.042, 0.8], [0.095, -0.04], [0.06, -0.034, 0.8], [0.03, -0.018], [0.008, 0.01], [-0.008, 0.06], [-0.012, 0.11]];
      for (let i = 0; i < 4; i++) { const x = 0.05 + i * 0.03; strands.push({ pts: [[x - 0.006, 0.045 - i * 0.004], [x, 0.012], [x + 0.003, -0.022]], w: 0.0026, a: 0.55 }); }
      shadeEl.push(F(smooth([[-0.006, 0.11], [0.03, 0.04], [0.04, -0.02], [0.004, 0.0], [-0.01, 0.07]], true), sh, { a: 0.45, blur: 0.012 }));
    } else if (st === 'short') {
      pts = [...top, [0.17, -0.005], [0.15, -0.036], [0.12, -0.05, 0.8], [0.09, -0.044], [0.06, -0.05, 0.8], [0.035, -0.035], [0.012, -0.02], [-0.006, 0.03], [-0.016, 0.1], [-0.012, 0.15]];
      for (let i = 0; i < 5; i++) { const x = 0.03 + i * 0.03; strands.push({ pts: [[x - 0.01, 0.08 - i * 0.008], [x, 0.02], [x + 0.004, -0.03]], w: 0.003, a: 0.7 }); }
      shadeEl.push(F(smooth([[-0.01, 0.15], [0.03, 0.06], [0.04, -0.03], [0.0, -0.01], [-0.016, 0.08]], true), sh, { a: 0.5, blur: 0.012 }));
    } else {
      const yAt = (t) => -0.02 - L0 * t;
      const fx = (t) => 0.18 - (st === 'knee' ? 0.078 : 0.07) * Math.pow(t, 1.3);
      const rx = (t) => 0.018 + (st === 'knee' ? 0.036 : 0.03) * Math.pow(t, 1.15);
      const tipF = [fx(0.92), yAt(0.92)], tipR = [rx(0.95) + 0.01, yAt(0.96)];
      const front = [[0.18, -0.01], ...curveEdge(fx, yAt, 0.04, 0.88, 9, 0.006, seed + 21, 1)];
      const tip = wavy(tipF[0], tipF[1], tipR[0], tipY, 4, 0.02, seed + 11);
      const rear = curveEdge(rx, yAt, 0.92, 0.06, 8, 0.005, seed + 23, -1);
      pts = [...top, ...front, [tipF[0], tipF[1], 0.6], ...tip, [tipR[0], tipY, 0.6], ...rear, [0.006, -0.01], [-0.016, 0.06], [-0.012, 0.13]];
      // 9 strand lines (s-curves) + short tip flicks + highlights
      for (let i = 0; i < 9; i++) {
        const u = (i + 0.5) / 9, x0 = lerp(0.03, 0.165, u), sway = (i % 2 ? 1 : -1) * 0.007, end = 0.55 + 0.4 * r();
        const xe = lerp(rx(end), fx(end), 0.15 + 0.7 * u);
        strands.push({ pts: [[x0, 0.07 - u * 0.05], [lerp(x0, xe, 0.35) + sway, yAt(end * 0.35)], [lerp(x0, xe, 0.7) - sway, yAt(end * 0.7)], [xe, yAt(end)]], w: 0.0026 + 0.0012 * r(), a: 0.55 + 0.3 * r() });
      }
      for (let i = 0; i < 5; i++) { const u = 0.2 + i * 0.15, x = lerp(rx(0.85), fx(0.85), u); strands.push({ pts: [[x, yAt(0.8)], [x + 0.004, yAt(0.88)], [x - 0.002, yAt(0.96)]], w: 0.0024, a: 0.6 }); }
      strands.push({ pts: [[0.165, 0.0], [0.17, yAt(0.3)], [0.15, yAt(0.62)], [0.13, yAt(0.82)]], w: 0.003, a: light ? 0.8 : 0.55, col: hi });
      strands.push({ pts: [[0.12, 0.02], [0.125, yAt(0.25)], [0.11, yAt(0.5)]], w: 0.0026, a: light ? 0.7 : 0.45, col: hi });
      // soft inner shade: along the throat side, under the moustache, toward the tip
      shadeEl.push(F(smooth([[0.0, 0.14], [0.03, 0.05], [0.045, yAt(0.3)], [0.05, yAt(0.65)], [0.04, yAt(0.95)], [0.012, yAt(0.9)], [0.01, yAt(0.4)], [-0.014, 0.06]], true), sh, { a: 0.6, blur: 0.016 }));
      shadeEl.push(F(ellipse(0.14, 0.035, 0.045, 0.022), sh, { a: 0.55, blur: 0.012 }));
      shadeEl.push(F(ellipse(0.08, yAt(0.92), 0.06, L0 * 0.12), sh, { a: 0.35, blur: 0.03 }));
    }
    strands.push({ pts: [[0.02, 0.15], [0.05, 0.08], [0.06, 0.0]], w: 0.003, a: 0.7 }, { pts: [[0.07, 0.11], [0.1, 0.05], [0.11, -0.01]], w: 0.003, a: 0.7 });
  } else if (view === 'threeQuarter') {
    if (st === 'trim') {
      pts = [[-0.14, 0.15], [-0.125, 0.09], [-0.09, 0.02], [-0.04, -0.026], [0.0, -0.043, 0.8], [0.06, -0.038], [0.115, -0.005], [0.146, 0.044], [0.136, 0.066], [0.1, 0.052], [0.04, 0.05], [-0.02, 0.06], [-0.075, 0.085], [-0.115, 0.13]];
      for (let i = 0; i < 4; i++) { const x = -0.06 + i * 0.05; strands.push({ pts: [[x, 0.04], [x + 0.005, 0.005], [x + 0.003, -0.025]], w: 0.0026, a: 0.55 }); }
      shadeEl.push(F(smooth([[-0.14, 0.14], [-0.11, 0.04], [-0.05, -0.02], [-0.08, 0.04], [-0.11, 0.11]], true), sh, { a: 0.45, blur: 0.012 }));
    } else if (st === 'short') {
      pts = [[-0.14, 0.19], [-0.128, 0.12], [-0.09, 0.03], [-0.04, -0.03], [0.0, -0.05, 0.8], [0.06, -0.045], [0.12, 0.0], [0.15, 0.07], [0.14, 0.1], [0.1, 0.075], [0.04, 0.07], [-0.02, 0.09], [-0.08, 0.12], [-0.115, 0.18]];
      for (let i = 0; i < 5; i++) { const x = -0.08 + i * 0.045; strands.push({ pts: [[x, 0.06], [x + 0.006, 0.01], [x + 0.004, -0.03]], w: 0.003, a: 0.7 }); }
      shadeEl.push(F(smooth([[-0.14, 0.18], [-0.11, 0.05], [-0.05, -0.02], [-0.08, 0.05], [-0.11, 0.14]], true), sh, { a: 0.5, blur: 0.012 }));
    } else {
      const yAt = (t) => -0.02 - L0 * t;
      const tp = st === 'knee' ? 0.68 : 0.5, cx = (t) => 0.01 + 0.025 * t, hw = (t) => 0.145 * (1 - tp * Math.pow(t, 0.55)), lx = (t) => cx(t) - hw(t), rxx = (t) => cx(t) + hw(t) * 0.92;
      pts = [[-0.14, 0.19], [-0.138, 0.1], ...curveEdge(lx, yAt, 0.03, 0.86, 9, 0.006, seed + 31, -1), ...wavy(lx(0.88), yAt(0.9), rxx(0.88), yAt(0.9), 5, 0.02, seed + 13), ...curveEdge(rxx, yAt, 0.86, 0.03, 9, 0.006, seed + 33, 1), [0.155, 0.04], [0.146, 0.1], [0.1, 0.075], [0.04, 0.07], [-0.02, 0.09], [-0.08, 0.12], [-0.115, 0.18]];
      for (let i = 0; i < 9; i++) {
        const u = (i + 0.5) / 9, x0 = lerp(-0.11, 0.13, u), end = 0.6 + 0.35 * r(), xe = lerp(lx(end), rxx(end), 0.1 + 0.8 * u), sway = (i % 2 ? 1 : -1) * 0.008;
        strands.push({ pts: [[x0, 0.05], [lerp(x0, xe, 0.4) + sway, yAt(end * 0.4)], [lerp(x0, xe, 0.75) - sway, yAt(end * 0.75)], [xe, yAt(end)]], w: 0.0026 + 0.0012 * r(), a: 0.55 + 0.3 * r() });
      }
      strands.push({ pts: [[0.1, 0.03], [0.1, yAt(0.3)], [0.07, yAt(0.6)]], w: 0.003, a: light ? 0.75 : 0.5, col: hi });
      shadeEl.push(F(smooth([[-0.14, 0.18], [-0.12, 0.0], [-0.1, yAt(0.4)], [-0.06, yAt(0.85)], [-0.08, yAt(0.4)], [-0.1, 0.05]], true), sh, { a: 0.6, blur: 0.016 }));
      shadeEl.push(F(ellipse(0.09, 0.04, 0.06, 0.022), sh, { a: 0.5, blur: 0.012 }));
      shadeEl.push(F(ellipse(0.0, yAt(0.9), 0.07, L0 * 0.12), sh, { a: 0.3, blur: 0.03 }));
    }
  }
  const shape = smooth(pts.map((p) => [p[0] - piv[0], p[1] - piv[1], p[2] ?? 1]), true);
  const shiftEl = (e) => ({ ...e, d: shiftPath(e.d, -piv[0], -piv[1]) });
  const draw = [F(shape, c), ...shadeEl.map(shiftEl)];
  for (const s of strands) draw.push(L(smooth(s.pts.map(([x, y]) => [x - piv[0], y - piv[1]]), false), s.col || ln, s.w, { a: s.a }));
  const long = st !== 'short' && st !== 'trim';
  out.push({ id: 'beard', pivot: 'beard', layer: 32, density: long && st !== 'medium' ? 'beard' : 'face', bulge: 0.7, prof: 1.4, shape, draw, shadow: true, ...(long ? { strip: { bend: 'beard', cols: 5, w0: 0.16 } } : {}) });
  // moustache (on the head): droops from under the nose down into the beard
  let mp;
  if (st === 'trim') {
    // a slim moustache that stays inside the face outline (the lip line is at x ~0.16 in profile, ~0.142 in 3/4)
    // and flows down into the beard at the mouth corners; no outline, no extra strokes (it must never read as a pipe)
    mp = view === 'side' ? [[0.146, 0.1], [0.153, 0.095], [0.15, 0.088, 0.7], [0.138, 0.085, 0.6], [0.124, 0.079, 0.6], [0.114, 0.069, 0.5], [0.109, 0.073], [0.116, 0.085], [0.13, 0.094]]
      : [[0.116, 0.1], [0.126, 0.095], [0.123, 0.088, 0.7], [0.112, 0.085, 0.6], [0.098, 0.087], [0.083, 0.086], [0.066, 0.08, 0.6], [0.055, 0.07, 0.5], [0.05, 0.075], [0.06, 0.088], [0.078, 0.095], [0.1, 0.098]];
    const ms = smooth(mp, true);
    out.push({ id: 'moustache', pivot: 'head', layer: 34, outline: false, rim: false, density: 'face', bulge: 0.15, shape: ms, draw: [F(ms, c), L(smooth(view === 'side' ? [[0.146, 0.096], [0.13, 0.09], [0.118, 0.08]] : [[0.118, 0.096], [0.1, 0.093], [0.08, 0.091]], false), hi, 0.0022, { a: 0.35 })] });
    return out;
  } else if (view === 'side') {
    mp = D.age > 0.6
      ? [[0.166, 0.116], [0.178, 0.108], [0.182, 0.09], [0.178, 0.068], [0.168, 0.046, 0.8], [0.156, 0.03, 0.5], [0.148, 0.046], [0.138, 0.068], [0.128, 0.088], [0.146, 0.106]]
      : [[0.166, 0.116], [0.178, 0.106], [0.181, 0.09], [0.174, 0.072, 0.8], [0.16, 0.06, 0.5], [0.146, 0.068], [0.132, 0.086], [0.148, 0.106]];
  } else mp = [[0.136, 0.114], [0.154, 0.102], [0.152, 0.08, 0.7], [0.14, 0.054, 0.5], [0.124, 0.062], [0.11, 0.08], [0.096, 0.074], [0.072, 0.06], [0.048, 0.044, 0.5], [0.036, 0.06], [0.052, 0.082], [0.082, 0.098], [0.112, 0.106]];
  const ms = smooth(mp, true);
  const mDraw = [F(ms, c), F(ellipse(view === 'side' ? 0.16 : 0.09, 0.07, 0.03, 0.014), sh, { a: 0.45, blur: 0.01 })];
  if (view === 'side') mDraw.push(L(smooth([[0.17, 0.106], [0.174, 0.084], [0.166, 0.056]], false), ln, 0.0028, { a: 0.75 }), L(smooth([[0.156, 0.1], [0.16, 0.078], [0.154, 0.05]], false), ln, 0.0026, { a: 0.65 }), L(smooth([[0.142, 0.09], [0.144, 0.072]], false), ln, 0.0024, { a: 0.55 }), L(smooth([[0.176, 0.1], [0.178, 0.084]], false), hi, 0.0024, { a: 0.6 }));
  else mDraw.push(L(smooth([[0.145, 0.104], [0.13, 0.082], [0.11, 0.066]], false), ln, 0.0028, { a: 0.75 }), L(smooth([[0.1, 0.094], [0.085, 0.076], [0.07, 0.07]], false), ln, 0.0026, { a: 0.65 }), L(smooth([[0.13, 0.11], [0.12, 0.096]], false), hi, 0.0024, { a: 0.6 }));
  out.push({ id: 'moustache', pivot: 'head', layer: 34, density: 'face', bulge: 0.6, shape: ms, draw: mDraw });
  return out;
}
