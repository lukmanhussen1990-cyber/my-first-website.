// Head part library (unit head space: origin = head pivot on top of the neck, facing +x, y up,
// skull ~0.36 tall; the design scales it). Every part is SVG path data + drawing elements.
// Views: 'side' (profile), 'threeQuarter', 'back'.
import { smooth, poly, ellipse, arc, mirrorX, shift } from './svg.js';
import { F, L, shade, mixc, ink, lift } from './paint.js';
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
  const lidShape = smooth([...lidEdge, [hw * 1.3, ht + 0.03], [-hw * 1.3, ht + 0.03]].map((p, i, a) => (i >= a.length - 2 ? [p[0], p[1], 0] : p)), true);
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
  const s = D.skin, old = D.age ?? 0, out = [], ln = ink(s, 0.6);
  const W = (d, w, a = 0.85) => out.push(L(d, ln, w, { a }));
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
    if (old > 0.6 && D.hair === 'oldLong') for (const [x, y, r] of [[-0.02, 0.33, 0.014], [0.03, 0.345, 0.009], [-0.07, 0.31, 0.011]]) draw.push(F(ellipse(x, y, r, r * 0.8), shade(s, 0.82), { a: 0.35, blur: r * 0.3 }));
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
  const cloth = ['wrap', 'turban', 'veil'].includes(st);
  const wc = D.wrap || '#d9c9a6', wl = ink(wc, 0.7);
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
        { pivot: 'hairBack', layer: 29.5, strip: { bend: 'hair', cols: 4, w0: 0.3 } });
      // wispy strands over the bald top
      cap('hairWisp', [[0.02, 0.352], [-0.04, 0.37], [-0.1, 0.35], [-0.14, 0.3], [-0.12, 0.31], [-0.07, 0.338], [-0.02, 0.348]], [S([[0.01, 0.356], [-0.06, 0.355], [-0.12, 0.318]], 0.0025, 0.7)], { layer: 29.6, bulge: 0.3 });
    } else if (st === 'curly') {
      const outer = [[0.13, 0.29], [0.13, 0.335], [0.1, 0.37], [0.06, 0.39], [0.015, 0.405], [-0.035, 0.405], [-0.085, 0.395], [-0.125, 0.37], [-0.16, 0.335], [-0.185, 0.29], [-0.195, 0.24], [-0.195, 0.185], [-0.188, 0.13], [-0.17, 0.08], [-0.14, 0.04], [-0.1, 0.03]];
      const pts = outer.map(([x, y], i) => [x, y, i % 2 ? 1.4 : 0.35]).concat([[-0.075, 0.08], [-0.05, 0.16], [-0.015, 0.21], [0.03, 0.2, 0.5], [0.04, 0.15, 0.4], [0.055, 0.15, 0.4], [0.065, 0.225], [0.095, 0.27]]);
      const curls = [];
      for (let i = 0; i < 9; i++) { const a = 0.6 + i * 0.32, rx = -0.04 + Math.cos(a) * 0.11, ry = 0.24 + Math.sin(a) * 0.1; curls.push(S([[rx - 0.012, ry - 0.004], [rx, ry + 0.01], [rx + 0.012, ry]], 0.003, 0.75)); }
      cap('hair', pts, curls);
    } else if (st === 'bald') {
      cap('hair', [[-0.03, 0.225], [-0.1, 0.25], [-0.16, 0.2], [-0.172, 0.11], [-0.13, 0.03, 0.6], [-0.095, 0.06], [-0.1, 0.13], [-0.075, 0.19], [-0.035, 0.2]], [S([[-0.05, 0.22], [-0.13, 0.21], [-0.155, 0.12]], 0.003)]);
    } else if (cloth) {
      const tall = st === 'turban' ? 0.03 : 0;
      cap('hair', [[0.12, 0.25], [0.04, 0.28], [-0.05, 0.27], [-0.06, 0.2], [0.02, 0.22]], [], { fill: c, layer: 29.4, bulge: 0.3 });
      if (st === 'veil') {
        const pts = [[0.04, 0.392], [-0.06, 0.4], [-0.15, 0.36], [-0.205, 0.27], [-0.225, 0.12], [-0.232, -0.06], [-0.24, -0.2], [-0.25, -0.32], [-0.13, -0.33], [-0.05, -0.31], [-0.04, -0.14], [-0.03, -0.02], [0.02, 0.1], [0.06, 0.2], [0.11, 0.26], [0.142, 0.285], [0.13, 0.34], [0.1, 0.375]];
        cap('veil', pts, [S([[0.12, 0.32], [0.0, 0.36], [-0.14, 0.3], [-0.2, 0.14]], 0.004, 0.8, wl), S([[-0.06, 0.2], [-0.13, 0.05], [-0.16, -0.2]], 0.0038, 0.7, wl), S([[-0.13, 0.25], [-0.2, 0.05], [-0.21, -0.25]], 0.0038, 0.7, wl), S([[0.14, 0.285], [0.06, 0.24], [0.0, 0.14]], 0.006, 0.9, shade(wc, 0.86))], { fill: wc, pivot: 'hairBack', layer: 30, strip: { bend: 'hair', cols: 5, w0: 0.4 }, density: 'face' });
      } else {
        const pts = [[0.155, 0.268], [0.158, 0.31 + tall], [0.13, 0.36 + tall], [0.07, 0.398 + tall * 1.4], [-0.02, 0.41 + tall * 1.4], [-0.1, 0.395 + tall], [-0.165, 0.35], [-0.2, 0.27], [-0.205, 0.17], [-0.18, 0.08], [-0.14, 0.03, 0.6], [-0.09, 0.07], [-0.07, 0.15], [-0.04, 0.2], [0.03, 0.235], [0.1, 0.25]];
        const draw = [F(smooth([[0.16, 0.255], [0.162, 0.3], [-0.08, 0.3], [-0.205, 0.22], [-0.205, 0.17], [-0.09, 0.24], [0.04, 0.25]], true), shade(wc, 0.86))];
        const folds = [S([[0.15, 0.31], [0.04, 0.33], [-0.1, 0.3], [-0.19, 0.24]], 0.0042, 0.75, wl), S([[0.13, 0.355 + tall], [0.0, 0.37 + tall], [-0.13, 0.34], [-0.19, 0.27]], 0.004, 0.7, wl), S([[-0.15, 0.3], [-0.18, 0.18], [-0.15, 0.07]], 0.004, 0.6, wl)];
        if (tall) folds.push(S([[0.1, 0.39 + tall], [-0.02, 0.405 + tall], [-0.12, 0.37]], 0.004, 0.7, wl));
        cap('wrap', pts, folds, { fill: wc, extraDraw: draw.slice(1) });
        P[P.length - 1].draw.splice(1, 0, draw[0]);
        if (D.wrapTail) {
          const t = [[-0.17, 0.25], [-0.12, 0.24], [-0.14, 0.05], [-0.17, -0.14], [-0.2, -0.13], [-0.215, 0.02], [-0.2, 0.17]];
          cap('wrapTail', t, [S([[-0.16, 0.2], [-0.175, 0.0], [-0.19, -0.1]], 0.0035, 0.7, wl)], { fill: shade(wc, 0.93), pivot: 'hairBack', layer: 18, strip: { bend: 'tail', cols: 3, w0: 0.1 } });
        }
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
      const back = [[-0.09, 0.275], [-0.15, 0.25], [-0.188, 0.17], [-0.195, 0.04], [-0.188, -0.1], [-0.17, -0.2], ...wavy(-0.17, -0.2, -0.09, -0.23, 5, 0.03, (D.seed || 1) + 5), [-0.09, -0.23], [-0.11, -0.1], [-0.13, 0.04], [-0.15, 0.13], [-0.13, 0.22]];
      cap('hairBack', back, [S([[-0.11, 0.26], [-0.17, 0.17], [-0.18, 0.0], [-0.16, -0.18]], 0.0032), S([[-0.15, 0.2], [-0.16, 0.05], [-0.14, -0.15]], 0.003), S([[-0.13, 0.12], [-0.12, -0.05], [-0.11, -0.2]], 0.003)], { pivot: 'hairBack', layer: 29.5, strip: { bend: 'hair', cols: 4, w0: 0.3 }, density: 'face3' });
      const back2 = [[0.13, 0.25], [0.15, 0.2], [0.152, 0.12], [0.14, 0.12], [0.13, 0.2]];
      cap('hairWisp', back2, [], { layer: 29.6, density: 'face3', bulge: 0.3 });
    } else if (st === 'bald') {
      cap('hair', [[-0.12, 0.27], [-0.17, 0.22], [-0.178, 0.14], [-0.16, 0.08], [-0.145, 0.13], [-0.14, 0.2], [-0.11, 0.25]], [], { density: 'face3' });
    } else if (cloth) {
      if (st === 'veil') {
        const pts = [[0.13, 0.29], [0.11, 0.35], [0.04, 0.395], [-0.06, 0.4], [-0.15, 0.36], [-0.2, 0.27], [-0.22, 0.1], [-0.225, -0.1], [-0.235, -0.3], [-0.06, -0.32], [-0.08, -0.1], [-0.1, 0.05], [-0.12, 0.15], [-0.08, 0.25], [0.0, 0.29], [0.08, 0.285]];
        cap('veil', pts, [S([[0.1, 0.34], [-0.02, 0.37], [-0.15, 0.3], [-0.2, 0.12]], 0.004, 0.8, wl), S([[-0.15, 0.2], [-0.19, 0.0], [-0.2, -0.25]], 0.004, 0.7, wl)], { fill: wc, pivot: 'hairBack', layer: 30, strip: { bend: 'hair', cols: 5, w0: 0.4 }, density: 'face3' });
      } else {
        const tall = st === 'turban' ? 0.03 : 0;
        const pts = [[0.15, 0.255], [0.155, 0.31 + tall], [0.12, 0.36 + tall], [0.05, 0.4 + tall], [-0.04, 0.408 + tall], [-0.12, 0.385 + tall], [-0.175, 0.33], [-0.2, 0.25], [-0.2, 0.17], [-0.17, 0.14], [-0.15, 0.2], [-0.1, 0.25], [0.0, 0.27], [0.08, 0.262]];
        cap('wrap', pts, [S([[0.14, 0.3], [0.02, 0.33], [-0.12, 0.31], [-0.19, 0.25]], 0.0042, 0.75, wl), S([[0.12, 0.35 + tall], [-0.02, 0.37 + tall], [-0.15, 0.34]], 0.004, 0.7, wl)], { fill: wc, density: 'face3', extraDraw: [F(smooth([[0.152, 0.255], [0.155, 0.29], [0.0, 0.305], [-0.2, 0.25], [-0.2, 0.21], [0.0, 0.27]], true), shade(wc, 0.86))] });
      }
    }
    if (D.headband) cap('headband', [[0.148, 0.258], [0.152, 0.286], [0.0, 0.31], [-0.14, 0.29], [-0.18, 0.25], [-0.17, 0.225], [-0.06, 0.27], [0.06, 0.272]], [], { fill: D.headband, layer: 30.5, density: 'face3', bulge: 0.5 });
  } else { // back
    const cover = ['short', 'modern', 'long', 'curly'].includes(st);
    if (cover) {
      const curly = st === 'curly';
      const half = curly ? [[0.0, 0.41], [0.07, 0.4, 0.35], [0.13, 0.37, 1.4], [0.175, 0.31, 0.35], [0.195, 0.24, 1.4], [0.19, 0.16, 0.35], [0.165, 0.09, 1.4], [0.12, 0.04, 0.4]] : [[0.0, 0.392], [0.09, 0.378], [0.152, 0.33], [0.178, 0.25], [0.175, 0.15], [0.15, 0.07], [0.11, 0.035, 0.6]];
      const pts = [...half, [0.0, 0.05], ...mirrorPts(half.slice().reverse())].slice(0, -1);
      cap('hair', pts, [S([[0.0, 0.38], [0.01, 0.25], [0.0, 0.1]], 0.0035, 0.6), S([[0.1, 0.36], [0.13, 0.25], [0.11, 0.1]]), S([[-0.1, 0.36], [-0.13, 0.25], [-0.11, 0.1]])], { density: 'face3', layer: 30 });
      if (st === 'long') {
        const back = [[0.0, 0.2], [0.14, 0.15], [0.16, 0.0], [0.15, -0.18], ...wavy(0.15, -0.18, -0.15, -0.18, 8, 0.025, (D.seed || 3) + 7), [-0.15, -0.18], [-0.16, 0.0], [-0.14, 0.15]];
        cap('hairBack', back, [S([[0.08, 0.12], [0.09, -0.15]]), S([[-0.08, 0.12], [-0.09, -0.15]]), S([[0.0, 0.14], [0.0, -0.16]], 0.003, 0.6)], { pivot: 'hairBack', layer: 30.2, strip: { bend: 'hair', cols: 5, w0: 0.2 }, density: 'face3' });
      }
    } else if (st === 'oldLong' || st === 'bald') {
      const lng = st === 'oldLong';
      const pts = lng
        ? [[0.0, 0.265], [0.1, 0.262], [0.16, 0.22], [0.175, 0.12], [0.168, -0.05], [0.15, -0.2], ...wavy(0.15, -0.2, -0.15, -0.2, 9, 0.03, (D.seed || 1) + 9), [-0.15, -0.2], [-0.168, -0.05], [-0.175, 0.12], [-0.16, 0.22], [-0.1, 0.262]]
        : [[0.0, 0.2], [0.1, 0.2], [0.16, 0.17], [0.17, 0.1], [0.12, 0.03], [0.0, 0.02], [-0.12, 0.03], [-0.17, 0.1], [-0.16, 0.17], [-0.1, 0.2]];
      cap(lng ? 'hairBack' : 'hair', pts, [S([[0.1, 0.24], [0.13, 0.05], [0.11, -0.18]], 0.0032), S([[-0.1, 0.24], [-0.13, 0.05], [-0.11, -0.18]], 0.0032), S([[0.03, 0.25], [0.04, 0.05], [0.03, -0.18]], 0.003), S([[-0.04, 0.25], [-0.05, 0.05], [-0.04, -0.18]], 0.003)], lng ? { pivot: 'hairBack', layer: 30.2, strip: { bend: 'hair', cols: 6, w0: 0.25 }, density: 'face3' } : { density: 'face3' });
    } else if (cloth) {
      if (st === 'veil') {
        const pts = [[0.0, 0.4], [0.12, 0.38], [0.19, 0.3], [0.21, 0.15], [0.22, -0.05], [0.24, -0.32], [0.0, -0.33], [-0.24, -0.32], [-0.22, -0.05], [-0.21, 0.15], [-0.19, 0.3], [-0.12, 0.38]];
        cap('veil', pts, [S([[0.0, 0.38], [0.02, 0.1], [0.0, -0.3]], 0.004, 0.6, wl), S([[0.12, 0.3], [0.15, 0.0], [0.16, -0.28]], 0.004, 0.7, wl), S([[-0.12, 0.3], [-0.15, 0.0], [-0.16, -0.28]], 0.004, 0.7, wl)], { fill: wc, pivot: 'hairBack', layer: 30.2, strip: { bend: 'hair', cols: 6, w0: 0.4 }, density: 'face3' });
      } else {
        const tall = st === 'turban' ? 0.03 : 0;
        const half = [[0.0, 0.41 + tall], [0.1, 0.39 + tall], [0.17, 0.33], [0.2, 0.24], [0.19, 0.12], [0.15, 0.06, 0.6]];
        const pts = [...half, [0.0, 0.08], ...mirrorPts(half.slice().reverse())].slice(0, -1);
        cap('wrap', pts, [S([[0.18, 0.28], [0.0, 0.3], [-0.18, 0.28]], 0.0042, 0.75, wl), S([[0.15, 0.35], [0.0, 0.38], [-0.15, 0.35]], 0.004, 0.7, wl), S([[0.1, 0.2], [0.0, 0.12], [-0.1, 0.2]], 0.004, 0.6, wl)], { fill: wc, density: 'face3', layer: 30 });
        if (D.wrapTail) cap('wrapTail', [[0.0, 0.2], [0.05, 0.18], [0.06, 0.0], [0.07, -0.14], [-0.04, -0.15], [-0.05, 0.0], [-0.05, 0.18]], [S([[0.0, 0.15], [0.01, -0.12]], 0.0035, 0.6, wl)], { fill: shade(wc, 0.93), pivot: 'hairBack', layer: 30.3, strip: { bend: 'tail', cols: 3, w0: 0.1 }, density: 'face3' });
      }
    }
    if (D.headband && !cloth) cap('headband', [[0.17, 0.235], [0.172, 0.262], [0.0, 0.3], [-0.172, 0.262], [-0.17, 0.235], [0.0, 0.272]], [], { fill: D.headband, layer: 30.5, density: 'face3', bulge: 0.5 });
  }
  return P;
}

// ---------------------------------------------------------------- beards + moustaches (beard pivot on the head)
// beard pivot sits at BEARD_PIV (head space); shapes are given in head space and shifted.
export const BEARD_PIV = { side: [0.07, 0.06], threeQuarter: [0.03, 0.05], back: [0.0, 0.05] };
export function beardParts(D, view, beardLenBody = 0) {
  const st = D.beard || 'none';
  if (st === 'none' || st === 'stubble' || view === 'back') return [];
  const c = D.beardColor || D.hairColor || '#33251b', ln = mixc(c, D.age > 0.5 ? '#8f897f' : '#000000', 0.3), hi = lift(c, 0.2);
  const out = [];
  const piv = BEARD_PIV[view];
  // length of the hanging part in head units
  const tipY = { short: -0.04, medium: -0.2, long: -0.42, knee: -(beardLenBody || 0.95) }[st] ?? -0.04;
  const seed = D.seed || 1;
  let pts, strands = [];
  if (view === 'side') {
    const top = [[0.004, 0.18], [0.03, 0.15], [0.075, 0.118], [0.118, 0.1], [0.148, 0.084], [0.168, 0.058], [0.174, 0.03]];
    const back = [[-0.016, 0.1], [-0.006, 0.03], [0.012, -0.02]];
    if (st === 'short') pts = [...top, [0.166, -0.005], [0.14, -0.038], [0.095, -0.05], [0.045, -0.04], ...back.reverse(), [-0.012, 0.15]];
    else {
      const L = -tipY, wB = st === 'knee' ? 0.17 : 0.155;
      const front = [[0.178, -0.02], [0.18, -0.02 - L * 0.18], [0.172, -0.02 - L * 0.42], [0.15, -0.02 - L * 0.68], [0.12, -0.02 - L * 0.86]];
      const tip = wavy(0.115, tipY + 0.03, 0.055, tipY, 4, 0.018, seed + 11);
      const rear = [[0.04, -0.02 - L * 0.86], [0.02, -0.02 - L * 0.62], [0.016, -0.02 - L * 0.36], [0.02, -0.02 - L * 0.12]];
      pts = [...top, ...front, [0.115, tipY + 0.03, 0.6], ...tip, [0.055, tipY, 0.6], ...rear, [0.004, -0.01], [-0.016, 0.06], [-0.012, 0.13]];
      for (let i = 0; i < 5; i++) {
        const x0 = 0.05 + i * 0.026, sway = (i % 2 ? 1 : -1) * 0.008;
        strands.push({ pts: [[x0, 0.06 - i * 0.01], [x0 + 0.01 + sway, -0.02 - L * 0.3], [x0 - 0.01 - sway, -0.02 - L * 0.6], [0.06 + i * 0.012, tipY + 0.05 + (i % 3) * 0.02]], w: 0.0034 - i * 0.0002, a: 0.8 });
      }
      strands.push({ pts: [[0.16, 0.0], [0.165, -0.02 - L * 0.3], [0.14, -0.02 - L * 0.7]], w: 0.003, a: 0.6, col: hi });
      void wB;
    }
    strands.push({ pts: [[0.02, 0.15], [0.05, 0.08], [0.06, 0.0]], w: 0.003, a: 0.7 }, { pts: [[0.07, 0.11], [0.1, 0.05], [0.11, -0.01]], w: 0.003, a: 0.7 });
  } else if (view === 'threeQuarter') {
    const top = [[-0.135, 0.15], [-0.1, 0.08], [-0.04, 0.03], [0.04, 0.02], [0.1, 0.05], [0.138, 0.085], [0.146, 0.11], [0.15, 0.06]];
    if (st === 'short') pts = [[-0.14, 0.19], [-0.128, 0.12], [-0.09, 0.03], [-0.02, -0.04], [0.06, -0.045], [0.12, 0.0], [0.15, 0.07], [0.14, 0.1], [0.1, 0.075], [0.04, 0.07], [-0.02, 0.09], [-0.08, 0.12], [-0.115, 0.18]];
    else {
      const L = -tipY;
      pts = [[-0.14, 0.19], [-0.135, 0.1], [-0.12, -0.02 - L * 0.15], [-0.09, -0.02 - L * 0.45], [-0.03, -0.02 - L * 0.82], ...wavy(-0.03, tipY + 0.02, 0.07, tipY + 0.02, 4, 0.02, seed + 13), [0.07, tipY + 0.02], [0.12, -0.02 - L * 0.55], [0.15, -0.02 - L * 0.2], [0.155, 0.04], [0.146, 0.1], [0.1, 0.075], [0.04, 0.07], [-0.02, 0.09], [-0.08, 0.12], [-0.115, 0.18]];
      for (let i = 0; i < 5; i++) { const x0 = -0.09 + i * 0.045; strands.push({ pts: [[x0, 0.04], [x0 + 0.01, -0.02 - L * 0.35], [x0 * 0.6 + 0.02, -0.02 - L * 0.7], [0.02 + i * 0.01, tipY + 0.05]], w: 0.0034, a: 0.8 }); }
    }
    void top;
  }
  const shape = smooth(pts.map((p) => [p[0] - piv[0], p[1] - piv[1], p[2] ?? 1]), true);
  const draw = [F(shape, c)];
  for (const s of strands) draw.push(L(smooth(s.pts.map(([x, y]) => [x - piv[0], y - piv[1]]), false), s.col || ln, s.w, { a: s.a }));
  const long = st !== 'short';
  out.push({ id: 'beard', pivot: 'beard', layer: 32, density: long && st !== 'medium' ? 'beard' : 'face', bulge: 0.7, prof: 1.4, shape, draw, shadow: true, ...(long ? { strip: { bend: 'beard', cols: 5, w0: 0.16 } } : {}) });
  // moustache (on the head)
  let mp;
  if (view === 'side') mp = D.age > 0.6 ? [[0.19, 0.112], [0.196, 0.098], [0.186, 0.078], [0.168, 0.056], [0.15, 0.04], [0.135, 0.045], [0.142, 0.07], [0.15, 0.09], [0.168, 0.105]] : [[0.188, 0.112], [0.193, 0.1], [0.18, 0.08], [0.155, 0.066], [0.128, 0.068], [0.12, 0.08], [0.14, 0.092], [0.165, 0.106]];
  else mp = [[0.152, 0.118], [0.155, 0.098], [0.13, 0.075], [0.095, 0.07, 0.6], [0.06, 0.068, 0.6], [0.035, 0.08], [0.06, 0.096], [0.1, 0.104], [0.13, 0.112]];
  const ms = smooth(mp, true);
  out.push({ id: 'moustache', pivot: 'head', layer: 34, density: 'face', bulge: 0.6, shape: ms, draw: [F(ms, c), L(smooth(mp.slice(1, 5), false), ln, 0.003, { a: 0.7 }), L(smooth(mp.slice(2, 5).map(([x, y]) => [x, y + 0.008]), false), hi, 0.0025, { a: 0.5 })] });
  return out;
}
