// Body part library: garments (robe / tunic / shirt / hoodie / coat) in 3 views, shawl, limbs,
// mitten hands with a thumb (open / grip / point), feet (bare with toes / sandal / shoe / sneaker),
// accessories (sash, belt, satchel, bracelet, apron, tool) and hand props (cane, staff, hammer, adze,
// oil lamp, bowl, cup, fruit). Torso space: origin = hip pivot, y up, facing +x.
import { smooth, poly, ellipse, capsule, rrect, mirrorX, shift } from './svg.js';
import { F, L, shade, mixc, ink, lift, lum } from './paint.js';
import { mulberry32 } from '../../lib/util.js';

const mirrorPts = (pts) => pts.map((p) => (p.length > 2 ? [-p[0], p[1], p[2]] : [-p[0], p[1]]));
const fringe = (x0, x1, y, n, len, col, w) => { const out = []; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * (i / n); out.push(L(poly([[x, y + 0.004], [x + (i % 2 ? 0.003 : -0.002), y - len]], false), col, w, { a: 0.85 })); } return out; };
const stitches = (pts, col, w = 0.0028, dash = [0.009, 0.007]) => L(poly(pts, true), col, w, { dash, a: 0.9 });

// ---------------------------------------------------------------- garment silhouettes
function robeSidePts(D) {
  const sy = D.torsoLen, b = D.build, hy = D.hemY, h = D.hunch || 0, belly = D.belly || 0;
  const fl = (D.outfit === 'robe' ? 0.26 : 0.22) * b + (D.outfit === 'coat' ? -0.02 : 0);
  const short = hy > -0.2;
  const hemPts = short
    ? [[0.17 * b, hy + 0.03, 0.4], [0.06, hy - 0.004], [-0.08, hy - 0.004], [-0.175 * b, hy + 0.03, 0.4]]
    : [[fl, hy + 0.025, 0.4], [fl * 0.45, hy - 0.004], [-fl * 0.1, hy - 0.012], [-fl * 0.6, hy - 0.004], [-fl - 0.012, hy + 0.025, 0.4]];
  return [
    [0.075 * b, sy + 0.082], [0.14 * b, sy + 0.035], [0.158 * b + belly * 0.3, sy - 0.12], [0.165 * b + belly, 0.14], [0.168 * b + belly * 0.6, 0.05],
    ...(short ? [] : [[0.19 * b, hy * 0.42]]),
    ...hemPts,
    ...(short ? [] : [[-0.198 * b, hy * 0.42]]),
    [-0.172 * b, 0.05], [-0.168 * b - h * 0.035, sy - 0.16], [-0.155 * b - h * 0.05, sy - 0.03], [-0.105 * b - h * 0.03, sy + 0.074],
  ];
}
function robe3qPts(D) {
  const sy = D.torsoLen, b = D.build, hy = D.hemY, belly = D.belly || 0;
  const fl = (D.outfit === 'robe' ? 0.29 : 0.25) * b;
  const short = hy > -0.2;
  const hem = short ? [[0.2 * b, hy + 0.03, 0.4], [0.05, hy - 0.006], [-0.21 * b, hy + 0.03, 0.4]] : [[fl, hy + 0.02, 0.4], [0.05, hy - 0.012], [-fl - 0.02, hy + 0.02, 0.4]];
  return [[0.06 * b, sy + 0.085], [0.17 * b, sy + 0.045], [0.195 * b, sy - 0.08], [0.19 * b + belly, 0.12], [0.19 * b + belly * 0.5, 0.05], ...(short ? [] : [[0.22 * b, hy * 0.42]]), ...hem, ...(short ? [] : [[-0.235 * b, hy * 0.42]]), [-0.2 * b, 0.05], [-0.205 * b, sy - 0.12], [-0.19 * b, sy + 0.04], [-0.08 * b, sy + 0.085]];
}
function robeBackPts(D) {
  const sy = D.torsoLen, b = D.build, hy = D.hemY;
  const fl = (D.outfit === 'robe' ? 0.29 : 0.25) * b;
  const short = hy > -0.2;
  const half = [[0.0, sy + 0.08], [0.1 * b, sy + 0.082], [0.2 * b, sy + 0.03], [0.21 * b, sy - 0.1], [0.195 * b, 0.05], ...(short ? [[0.21 * b, hy + 0.03, 0.4]] : [[0.225 * b, hy * 0.42], [fl, hy + 0.02, 0.4]]), [0.0, hy - 0.01]];
  return [...half, ...mirrorPts(half.slice(1, -1).reverse())];
}

function garmentDraw(D, view, shape, pts) {
  const sy = D.torsoLen, b = D.build, hy = D.hemY, c = D.cloth, ln = ink(c, 0.66), dl = ink(c, 0.78), hi = lift(c, 0.22);
  const draw = [F(shape, c)];
  const xs = view === 'side' ? 1 : 0;
  const ctr = view === 'threeQuarter' ? 0.035 : 0;
  const modern = D.outfit === 'hoodie' || D.outfit === 'coat';
  // hem band / trim
  if (D.trim && !modern) draw.push(F(poly([[-0.5, hy + 0.045], [0.5, hy + 0.045], [0.5, hy - 0.05], [-0.5, hy - 0.05]]), D.trim), L(poly([[-0.5, hy + 0.045], [0.5, hy + 0.045]], false), ink(D.trim, 0.7), 0.004, { a: 0.7 }));
  else if (!modern) draw.push(L(poly([[-0.5, hy + 0.03], [0.5, hy + 0.03]], false), dl, 0.0045, { a: 0.55 }));
  // faded / worn cloth: a soft lighter wash near the top
  if (D.worn) draw.push(F(ellipse(0.02, sy - 0.1, 0.18, 0.2), lift(c, 0.12), { a: 0.5, blur: 0.06 }), F(ellipse(-0.05, hy * 0.6, 0.2, 0.18), shade(c, 0.92), { a: 0.6, blur: 0.08 }));
  // folds (2-3 long folds below the belt, short gathers, chest fold)
  const fold = (p, w = 0.0048, a = 0.7, col = ln) => draw.push(L(smooth(p, false), col, w, { a }));
  if (view === 'side') {
    if (!modern || D.outfit === 'coat') {
      fold([[0.06, 0.0], [0.085, hy * 0.45], [0.13, hy + 0.04]]);
      fold([[-0.04, -0.01], [-0.06, hy * 0.5], [-0.1, hy + 0.04]]);
      fold([[0.12 * b, -0.02], [0.15 * b, hy * 0.4], [0.18 * b, hy * 0.75]], 0.004, 0.55);
      fold([[0.065, -0.005], [0.09, hy * 0.45], [0.135, hy + 0.04]], 0.003, 0.4, hi);
      for (let i = 0; i < 4; i++) fold([[-0.12 + i * 0.07, 0.0], [-0.115 + i * 0.07, -0.05]], 0.003, 0.5);
      fold([[0.02, sy - 0.02], [0.06, sy - 0.2], [0.07, 0.12]], 0.0042, 0.45);
    } else {
      fold([[0.0, sy - 0.05], [0.05, sy - 0.2], [0.04, 0.2]], 0.0042, 0.45);
    }
  } else if (view === 'threeQuarter') {
    fold([[ctr + 0.07, 0.0], [ctr + 0.1, hy * 0.5], [ctr + 0.14, hy + 0.04]]);
    fold([[ctr - 0.08, 0.0], [ctr - 0.1, hy * 0.5], [ctr - 0.15, hy + 0.04]]);
    fold([[ctr + 0.0, -0.01], [ctr - 0.005, hy * 0.5], [ctr + 0.01, hy + 0.04]], 0.004, 0.45);
    fold([[-0.12, sy - 0.04], [-0.1, sy - 0.2], [-0.08, 0.15]], 0.004, 0.45);
    fold([[0.15, sy - 0.04], [0.13, sy - 0.2], [0.12, 0.15]], 0.004, 0.45);
  } else {
    fold([[0.0, sy + 0.05], [0.0, 0.1]], 0.004, 0.45);
    fold([[0.08, 0.0], [0.1, hy * 0.5], [0.14, hy + 0.04]]);
    fold([[-0.08, 0.0], [-0.1, hy * 0.5], [-0.14, hy + 0.04]]);
    fold([[0.12, sy - 0.05], [0.1, sy - 0.25]], 0.004, 0.4);
    fold([[-0.12, sy - 0.05], [-0.1, sy - 0.25]], 0.004, 0.4);
  }
  // neckline / opening
  if (view === 'side') {
    if (D.outfit === 'hoodie') draw.push(L(smooth([[0.075 * b, sy + 0.082], [0.11, sy + 0.0], [0.14 * b, sy - 0.04]], false), ln, 0.006, { a: 0.8 }));
    else draw.push(L(smooth([[0.075 * b, sy + 0.082], [0.1 * b, sy + 0.0], [0.14 * b, sy - 0.07]], false), D.trim || ln, D.trim ? 0.014 : 0.006, { a: 0.85 }));
  } else if (view === 'threeQuarter') {
    if (D.outfit === 'hoodie') draw.push(L(smooth([[-0.06, sy + 0.08], [ctr, sy + 0.02], [0.1, sy + 0.08]], false), ln, 0.006, { a: 0.8 }));
    else draw.push(L(smooth([[-0.06, sy + 0.085], [ctr, sy - 0.1], [0.1, sy + 0.085]], false), D.trim || ln, D.trim ? 0.014 : 0.006, { a: 0.85 }), L(poly([[ctr, sy - 0.1], [ctr, hy + 0.05]], false), D.trim || ln, D.trim ? 0.008 : 0.004, { a: 0.6 }));
  }
  // modern garments
  if (D.outfit === 'hoodie') {
    if (view !== 'back') {
      const px = view === 'side' ? 0.04 : ctr;
      draw.push(F(rrect(px - 0.09, hy + 0.06, px + 0.11, hy + 0.2, 0.03), shade(c, 0.93)), L(rrect(px - 0.09, hy + 0.06, px + 0.11, hy + 0.2, 0.03), ln, 0.004, { a: 0.7 }));
      draw.push(L(poly([[px + 0.02, sy - 0.02], [px + 0.025, sy - 0.16]], false), '#e8e1d4', 0.007), L(poly([[px + 0.055, sy - 0.02], [px + 0.06, sy - 0.14]], false), '#e8e1d4', 0.007));
    }
    draw.push(F(poly([[-0.5, hy + 0.05], [0.5, hy + 0.05], [0.5, hy - 0.05], [-0.5, hy - 0.05]]), shade(c, 0.86)), L(poly([[-0.5, hy + 0.05], [0.5, hy + 0.05]], false), ln, 0.004, { a: 0.6 }));
  }
  if (D.outfit === 'coat') {
    const bx = view === 'side' ? 0.13 * b : view === 'threeQuarter' ? ctr + 0.02 : null;
    if (bx != null) for (let i = 0; i < 3; i++) draw.push(F(ellipse(bx, sy - 0.12 - i * 0.14, 0.013, 0.013), shade(c, 0.6)));
    if (view !== 'back') draw.push(F(rrect(xs ? -0.02 : ctr - 0.12, -0.08, xs ? 0.12 : ctr - 0.01, -0.03, 0.01), shade(c, 0.88)));
    draw.push(F(smooth(view === 'side' ? [[0.07, sy + 0.085], [0.15, sy + 0.03], [0.13, sy - 0.12], [0.08, sy - 0.02]] : [[-0.07, sy + 0.085], [ctr, sy - 0.15], [0.11, sy + 0.085], [0.05, sy + 0.02], [ctr, sy - 0.05], [-0.03, sy + 0.02]], true), shade(c, 0.85)));
  }
  // apron (worker)
  if (D.apron && view !== 'back') {
    const ax = view === 'side' ? 0.06 : ctr;
    const ap = view === 'side' ? [[ax - 0.04, 0.06], [0.17 * b, 0.06], [0.2 * b, hy * 0.75], [ax, hy * 0.78]] : [[ax - 0.12, 0.06], [ax + 0.12, 0.06], [ax + 0.14, hy * 0.78], [ax - 0.14, hy * 0.78]];
    draw.push(F(poly(ap), D.apron), L(poly(ap), ink(D.apron, 0.7), 0.004, { a: 0.6 }), L(smooth([[ap[0][0] + 0.03, 0.0], [ap[0][0] + 0.05, hy * 0.5]], false), ink(D.apron, 0.7), 0.0035, { a: 0.5 }));
  }
  // patches on worn cloth
  if (D.patches && !modern) {
    const r = mulberry32(D.seed * 13 + 7);
    const spots = view === 'back' ? [[0.06, hy * 0.55], [-0.1, sy - 0.25]] : view === 'side' ? [[-0.08, hy * 0.62], [0.09, hy * 0.3]] : [[ctr - 0.1, hy * 0.6], [ctr + 0.1, hy * 0.35]];
    spots.forEach(([x, y], i) => {
      const w = 0.045 + r() * 0.025, h = 0.04 + r() * 0.03, rot = (r() - 0.5) * 0.3;
      const pp = [[x - w, y - h], [x + w, y - h + rot * w], [x + w, y + h], [x - w, y + h - rot * w]];
      const pc = D.patches[i % D.patches.length];
      draw.push(F(poly(pp), pc), stitches(pp.map(([px, py]) => [px * 0.92 + x * 0.08, py * 0.88 + y * 0.12]), lift(pc, 0.45)));
    });
  }
  // belt / sash / strap
  if (D.belt && D.outfit !== 'hoodie') {
    const by = 0.04, bw = D.beltW || 0.032;
    draw.push(F(poly([[-0.5, by - bw], [0.5, by - bw], [0.5, by + bw], [-0.5, by + bw]]), D.belt), L(poly([[-0.5, by + bw], [0.5, by + bw]], false), ink(D.belt, 0.7), 0.0035, { a: 0.6 }), L(poly([[-0.5, by - bw], [0.5, by - bw]], false), ink(D.belt, 0.6), 0.004, { a: 0.6 }));
    const kx = view === 'side' ? 0.14 * b : view === 'threeQuarter' ? ctr + 0.02 : null;
    if (kx != null) {
      draw.push(F(ellipse(kx, by, 0.022, 0.026), shade(D.belt, 0.9)), L(ellipse(kx, by, 0.022, 0.026), ink(D.belt, 0.6), 0.003, { a: 0.7 }));
      draw.push(F(smooth([[kx - 0.01, by - 0.02], [kx + 0.004, by - 0.02], [kx + 0.012, by - 0.13], [kx - 0.004, by - 0.135]], true), shade(D.belt, 0.95)), F(smooth([[kx + 0.004, by - 0.02], [kx + 0.018, by - 0.02], [kx + 0.032, by - 0.1], [kx + 0.018, by - 0.104]], true), shade(D.belt, 0.88)));
    }
  }
  if (D.sash) {
    const s = D.sash;
    const pts = view === 'back' ? [[0.2, sy + 0.04], [0.2, sy - 0.04], [-0.2, 0.0], [-0.2, 0.08]] : view === 'side' ? [[0.12, sy + 0.06], [0.16, sy - 0.04], [-0.12, 0.0], [-0.18, 0.08]] : [[-0.18, sy + 0.06], [-0.2, sy - 0.03], [0.18, 0.0], [0.2, 0.08]];
    draw.push(F(poly(pts), s), L(poly([pts[0], pts[3]], false), ink(s, 0.7), 0.0035, { a: 0.6 }), L(poly([pts[1], pts[2]], false), ink(s, 0.7), 0.0035, { a: 0.6 }));
  }
  if (D.strap) {
    const s = D.strap;
    const pts = view === 'back' ? [[-0.2, sy + 0.04], [-0.2, sy - 0.02], [0.2, 0.02], [0.2, 0.06]] : view === 'side' ? [[0.06, sy + 0.08], [0.1, sy + 0.06], [-0.12, 0.0], [-0.15, 0.02]] : [[0.12, sy + 0.07], [0.15, sy + 0.04], [-0.17, 0.0], [-0.19, 0.03]];
    draw.push(F(poly(pts), s), L(poly([pts[1], pts[2]], false), ink(s, 0.65), 0.003, { a: 0.6 }));
  }
  return draw;
}

export function torsoParts(D, view) {
  const parts = [];
  let pts = view === 'side' ? robeSidePts(D) : view === 'threeQuarter' ? robe3qPts(D) : robeBackPts(D);
  const shape = smooth(pts, true);
  const long = D.hemY < -0.3;
  const w0 = long ? Math.max(0.2, (D.torsoLen + 0.08 - 0.0) / (D.torsoLen + 0.08 - D.hemY)) : 0.85;
  parts.push({ id: 'robe', pivot: 'torso', layer: 20, density: view === 'side' ? 'body' : 'body3', bulge: 0.85, prof: 1.6, shape, draw: garmentDraw(D, view, shape, pts), shadow: true, strip: { bend: 'robe', cols: 6, w0 } });
  if (D.outfit === 'hoodie' && view !== 'threeQuarter') {
    const sy = D.torsoLen, c = D.cloth;
    const hp = view === 'side' ? [[-0.02, sy + 0.12], [-0.1, sy + 0.11], [-0.17, sy + 0.04], [-0.17, sy - 0.06], [-0.1, sy - 0.04], [-0.05, sy + 0.04]] : [[0.0, sy + 0.12], [0.14, sy + 0.1], [0.16, sy - 0.02], [0.0, sy - 0.12], [-0.16, sy - 0.02], [-0.14, sy + 0.1]];
    const hs = smooth(hp, true);
    parts.push({ id: 'hood', pivot: 'torso', layer: view === 'back' ? 21 : 24.5, density: 'body', bulge: 0.8, shape: hs, draw: [F(hs, shade(c, 0.95)), L(smooth(hp.slice(1, 5).map(([x, y]) => [x * 0.75, y - 0.01]), false), ink(c, 0.65), 0.005, { a: 0.6 })] });
  }
  return parts;
}

// ---------------------------------------------------------------- shawl (patched wool, fringe)
export function shawlParts(D, view) {
  if (!D.shawl) return [];
  const sy = D.torsoLen, b = D.build, c = D.shawl, ln = ink(c, 0.62), stripe = shade(c, 0.78), hi = lift(c, 0.25);
  const out = [];
  const deco = (draw, x0, x1, yb, patchSpots) => {
    draw.push(F(poly([[x0 - 0.1, yb + 0.05], [x1 + 0.1, yb + 0.05], [x1 + 0.1, yb + 0.035], [x0 - 0.1, yb + 0.035]]), stripe), F(poly([[x0 - 0.1, yb + 0.07], [x1 + 0.1, yb + 0.07], [x1 + 0.1, yb + 0.062], [x0 - 0.1, yb + 0.062]]), stripe));
    draw.push(...fringe(x0, x1, yb + 0.02, Math.round((x1 - x0) / 0.012), 0.03, ln, 0.003));
    const pc = D.patchColors || ['#6f7d5a', '#a07a4c', '#7c5b48'];
    if (D.worn) patchSpots.forEach(([x, y, w, h, rot], i) => {
      const pp = [[x - w, y - h], [x + w, y - h + rot], [x + w, y + h], [x - w, y + h - rot]];
      draw.push(F(poly(pp), pc[i % pc.length]), stitches(pp.map(([px, py]) => [px * 0.9 + x * 0.1, py * 0.86 + y * 0.14]), lift(pc[i % pc.length], 0.5)));
    });
  };
  if (view === 'side') {
    const yb = sy - 0.46;
    const pts = [[0.07 * b, sy + 0.095], [0.1 * b, sy + 0.05], [0.07 * b, sy - 0.12], [0.02, sy - 0.3], [-0.03, yb + 0.02], ...[...Array(8)].map((_, i) => [-0.04 - i * 0.026, yb - (i % 2 ? 0.006 : 0), i % 2 ? 1 : 0.5]), [-0.25 * b, yb + 0.01], [-0.235 * b, sy - 0.2], [-0.2 * b, sy - 0.02], [-0.13 * b, sy + 0.075], [-0.04, sy + 0.1]];
    const shape = smooth(pts, true);
    const draw = [F(shape, c)];
    draw.push(L(smooth([[0.06, sy + 0.06], [0.0, sy - 0.15], [-0.04, yb + 0.06]], false), ln, 0.0045, { a: 0.6 }), L(smooth([[-0.06, sy + 0.08], [-0.13, sy - 0.15], [-0.16, yb + 0.06]], false), ln, 0.0045, { a: 0.6 }), L(smooth([[-0.02, sy + 0.07], [-0.08, sy - 0.1]], false), hi, 0.004, { a: 0.5 }));
    deco(draw, -0.26, 0.0, yb, [[-0.13, sy - 0.27, 0.045, 0.04, 0.008], [-0.03, sy - 0.08, 0.035, 0.032, -0.006]]);
    out.push({ id: 'shawl', pivot: 'torso', layer: 25, density: 'body', bulge: 0.8, prof: 1.4, shape, draw, shadow: true, strip: { bend: 'shawl', cols: 5, w0: 0.25 } });
    const fy = sy - 0.5;
    const fp = [[0.1 * b, sy + 0.08], [0.16 * b, sy + 0.0], [0.19 * b, sy - 0.25], [0.2 * b, fy + 0.02], [0.175 * b, fy - 0.004], [0.15 * b, fy + 0.002], [0.125 * b, fy - 0.004], [0.1 * b, fy + 0.02], [0.105 * b, sy - 0.2], [0.08 * b, sy + 0.02]];
    const fs = smooth(fp, true);
    const fd = [F(fs, c), L(smooth([[0.12, sy + 0.0], [0.15, sy - 0.25], [0.15, fy + 0.06]], false), ln, 0.004, { a: 0.6 })];
    deco(fd, 0.09, 0.21, fy, [[0.15, sy - 0.18, 0.03, 0.035, 0.005]]);
    out.push({ id: 'shawlFront', pivot: 'torso', layer: 31.5, density: 'body', bulge: 0.8, prof: 1.4, shape: fs, draw: fd, strip: { bend: 'shawl', cols: 3, w0: 0.2 } });
  } else if (view === 'threeQuarter') {
    const yb = sy - 0.42;
    const pts = [[0.0, sy + 0.1], [0.16 * b, sy + 0.07], [0.22 * b, sy - 0.02], [0.215 * b, sy - 0.2], [0.14, yb + 0.06], [0.1, yb + 0.04], [0.08, sy - 0.18], [0.03, sy - 0.02], [-0.06, sy - 0.04], [-0.12, sy - 0.2], [-0.14, yb + 0.03], [-0.2, yb], [-0.235 * b, sy - 0.2], [-0.22 * b, sy + 0.01], [-0.14 * b, sy + 0.085]];
    const shape = smooth(pts, true);
    const draw = [F(shape, c), L(smooth([[0.12, sy + 0.05], [0.16, sy - 0.15], [0.15, yb + 0.08]], false), ln, 0.0045, { a: 0.6 }), L(smooth([[-0.12, sy + 0.05], [-0.18, sy - 0.15], [-0.18, yb + 0.06]], false), ln, 0.0045, { a: 0.6 })];
    deco(draw, -0.24, 0.22, yb, [[-0.16, sy - 0.2, 0.035, 0.035, 0.006], [0.17, sy - 0.1, 0.03, 0.03, -0.005]]);
    out.push({ id: 'shawl', pivot: 'torso', layer: 25, density: 'body3', bulge: 0.8, prof: 1.4, shape, draw, shadow: true });
  } else {
    const yb = sy - 0.5;
    const half = [[0.0, sy + 0.1], [0.14 * b, sy + 0.085], [0.23 * b, sy + 0.0], [0.245 * b, sy - 0.25], [0.22 * b, yb + 0.02]];
    const tips = [...Array(13)].map((_, i) => [0.2 * b - i * 0.4 * b / 12, yb - (i % 2 ? 0.008 : 0), i % 2 ? 1 : 0.5]);
    const pts = [...half, ...tips, ...mirrorPts(half.slice(1).reverse())];
    const shape = smooth(pts, true);
    const draw = [F(shape, c), L(smooth([[0.0, sy + 0.06], [0.0, yb + 0.05]], false), ln, 0.004, { a: 0.4 }), L(smooth([[0.12, sy + 0.04], [0.15, yb + 0.06]], false), ln, 0.0045, { a: 0.55 }), L(smooth([[-0.12, sy + 0.04], [-0.15, yb + 0.06]], false), ln, 0.0045, { a: 0.55 })];
    deco(draw, -0.24, 0.24, yb, [[0.08, sy - 0.22, 0.05, 0.045, 0.01], [-0.12, sy - 0.38, 0.04, 0.035, -0.008], [-0.05, sy - 0.04, 0.03, 0.03, 0.004]]);
    out.push({ id: 'shawl', pivot: 'torso', layer: 25, density: 'body3', bulge: 0.8, prof: 1.4, shape, draw, shadow: true, strip: { bend: 'shawl', cols: 7, w0: 0.25 } });
  }
  return out;
}

// ---------------------------------------------------------------- neck
export function neckParts(D, view) {
  const s = D.skin, w = (D.neckW || 0.052) * (view === 'side' ? 1 : 1.25);
  const shape = smooth([[-w, -0.07, 0.3], [w, -0.07, 0.3], [w * 0.92, 0.07], [-w * 0.92, 0.07]], true);
  const draw = [F(shape, s), F(ellipse(0.0, 0.06, w * 1.6, 0.03), shade(s, 0.78), { a: 0.6, blur: 0.012 })];
  if (D.age > 0.5 && view !== 'back') draw.push(L(smooth([[w * 0.5, 0.04], [w * 0.2, -0.02], [w * 0.3, -0.06]], false), ink(s, 0.6), 0.003, { a: 0.6 }), L(smooth([[-w * 0.2, 0.04], [-w * 0.4, -0.03]], false), ink(s, 0.6), 0.003, { a: 0.45 }));
  return [{ id: 'neck', pivot: 'neck', layer: 24, outline: false, density: 'body', bulge: 0.9, shape, draw }];
}

// ---------------------------------------------------------------- limbs
export function limbParts(D) {
  const b = D.build, s = D.skin, out = {};
  const legCol = D.legs || s, ll = ink(legCol, 0.65);
  const jeans = D.jeans;
  const legDraw = (shape, len, thigh) => {
    const d = [F(shape, legCol)];
    if (jeans) d.push(L(poly([[0.018, 0.0], [0.016, -len]], false), lift(legCol, 0.35), 0.003, { dash: [0.012, 0.008], a: 0.8 }), F(ellipse(0.0, -len * 0.45, 0.04, len * 0.3), lift(legCol, 0.18), { a: 0.5, blur: 0.02 }));
    else if (legCol === s) d.push(L(smooth(thigh ? [[0.03, -len * 0.85], [0.0, -len * 0.98], [-0.03, -len * 0.9]] : [[0.025, -0.02], [0.03, -len * 0.4]], false), ll, 0.003, { a: thigh ? 0.35 : 0.3 }));
    return d;
  };
  const th = capsule(D.thighL, 0.067 * b, 0.058 * b);
  out.thigh = { id: 'thigh', shape: th, draw: legDraw(th, D.thighL, true), density: 'limb', bulge: 1, prof: 1, shadow: true };
  const sh = capsule(D.shinL, 0.056 * b, 0.047 * b);
  out.shin = { id: 'shin', shape: sh, draw: legDraw(sh, D.shinL, false), density: 'limb', bulge: 1, prof: 1, shadow: true };
  // arms: sleeve (fitted or wide) + forearm (skin / cuff / bracelet)
  const sl = D.sleeve || D.cloth, sll = ink(sl, 0.65);
  const U = D.upperL, Fo = D.foreL;
  let ua;
  if (D.sleeveStyle === 'wide') ua = smooth([[-0.062 * b, 0.0, 0.5], [0.0, 0.066 * b], [0.062 * b, 0.0, 0.5], [0.07 * b, -U * 0.7], [0.085 * b, -U - 0.04, 0.4], [0.0, -U - 0.06, 0.4], [-0.075 * b, -U - 0.02, 0.4], [-0.064 * b, -U * 0.6]], true);
  else ua = capsule(U, 0.063 * b, 0.054 * b);
  const uaDraw = [F(ua, sl), L(smooth([[0.03, -0.03], [0.035, -U * 0.5], [0.025, -U * 0.85]], false), sll, 0.004, { a: 0.5 }), L(smooth([[-0.035, -U * 0.55], [-0.02, -U * 0.7]], false), sll, 0.0035, { a: 0.45 })];
  if (D.sleeveStyle === 'wide') uaDraw.push(L(smooth([[-0.07, -U - 0.015], [0.0, -U - 0.04], [0.08, -U - 0.03]], false), D.trim || sll, D.trim ? 0.012 : 0.004, { a: 0.7 }));
  if (D.bareArms) { uaDraw.length = 0; uaDraw.push(F(ua, s), L(smooth([[0.02, -0.05], [0.035, -U * 0.4]], false), ink(s, 0.62), 0.003, { a: 0.35 })); }
  out.upper = { id: 'upper', shape: ua, draw: uaDraw, density: 'limb', bulge: 1, prof: 1, shadow: true };
  const fa = capsule(Fo, 0.05 * b, 0.043 * b);
  const longSleeve = D.longSleeve;
  const faCol = longSleeve ? sl : s;
  const faDraw = [F(fa, faCol)];
  if (longSleeve) faDraw.push(F(poly([[-0.1, -Fo + 0.045], [0.1, -Fo + 0.045], [0.1, -Fo - 0.06], [-0.1, -Fo - 0.06]]), D.cuff || shade(sl, 0.85)), L(smooth([[0.02, -0.03], [0.025, -Fo * 0.6]], false), sll, 0.0035, { a: 0.5 }));
  else {
    faDraw.push(L(smooth([[0.022, -0.02], [0.028, -Fo * 0.55]], false), ink(s, 0.62), 0.003, { a: 0.3 }));
    if (D.age > 0.5) faDraw.push(L(smooth([[-0.01, -Fo * 0.3], [0.005, -Fo * 0.5], [-0.006, -Fo * 0.75]], false), mixc(s, '#5a6a80', 0.35), 0.003, { a: 0.5 }), L(smooth([[0.015, -Fo * 0.62], [0.03, -Fo * 0.66]], false), ink(s, 0.6), 0.0025, { a: 0.6 }));
  }
  if (D.bracelet) faDraw.push(F(poly([[-0.1, -Fo + 0.03], [0.1, -Fo + 0.03], [0.1, -Fo + 0.005], [-0.1, -Fo + 0.005]]), D.bracelet), L(poly([[-0.1, -Fo + 0.018], [0.1, -Fo + 0.018]], false), lift(D.bracelet, 0.4), 0.003, { a: 0.8 }));
  out.fore = { id: 'fore', shape: fa, draw: faDraw, density: 'limb', bulge: 1, prof: 1, shadow: true };
  return out;
}

// ---------------------------------------------------------------- hands (mitten with a thumb). Wrist pivot; fingers point down (-y), thumb forward (+x)
export function handParts(D) {
  const s = D.glove || D.skin, k = Math.sqrt(D.build) * (D.handK || 1), ln = ink(s, 0.6), old = D.age > 0.5;
  const sc = (pts) => pts.map(([x, y, c]) => [x * k, y * k, c ?? 1]);
  const H = {};
  const open = sc([[-0.034, 0.016], [0.032, 0.016], [0.04, -0.012], [0.054, -0.022], [0.063, -0.04, 1.2], [0.058, -0.058, 0.8], [0.047, -0.062], [0.039, -0.053, 0.35], [0.036, -0.074], [0.03, -0.095], [0.008, -0.11], [-0.016, -0.106], [-0.032, -0.088], [-0.04, -0.05], [-0.038, -0.01]]);
  const os = smooth(open, true);
  const od = [F(os, s), L(smooth(sc([[0.038, -0.052], [0.03, -0.035], [0.026, -0.02]]), false), ln, 0.0032 * k, { a: 0.75 }), L(smooth(sc([[0.01, -0.106], [0.012, -0.085]]), false), ln, 0.0026 * k, { a: 0.45 }), L(smooth(sc([[-0.012, -0.104], [-0.012, -0.084]]), false), ln, 0.0026 * k, { a: 0.4 })];
  if (old) od.push(L(smooth(sc([[-0.03, -0.06], [-0.01, -0.064], [0.015, -0.06]]), false), ln, 0.0026 * k, { a: 0.65 }), L(smooth(sc([[-0.028, -0.07], [-0.008, -0.074], [0.012, -0.07]]), false), ln, 0.0024 * k, { a: 0.5 }), L(smooth(sc([[-0.02, -0.01], [-0.012, -0.03], [-0.016, -0.045]]), false), mixc(s, '#5a6a80', 0.35), 0.0028 * k, { a: 0.5 }));
  H.open = { shape: os, draw: od };
  const grip = sc([[-0.038, 0.014], [0.03, 0.016], [0.048, -0.008], [0.054, -0.042, 1.1], [0.044, -0.074], [0.004, -0.084], [-0.034, -0.074], [-0.046, -0.034]]);
  const gs = smooth(grip, true);
  const gd = [F(gs, s), L(smooth(sc([[0.05, -0.03], [0.03, -0.042], [0.0, -0.04]]), false), ln, 0.0034 * k, { a: 0.8 }), L(smooth(sc([[-0.04, -0.048], [-0.028, -0.05]]), false), ln, 0.0028 * k, { a: 0.5 }), L(smooth(sc([[-0.036, -0.064], [-0.024, -0.066]]), false), ln, 0.0028 * k, { a: 0.5 })];
  if (old) gd.push(L(smooth(sc([[-0.03, -0.008], [-0.02, -0.022], [-0.026, -0.034]]), false), mixc(s, '#5a6a80', 0.35), 0.0028 * k, { a: 0.5 }), L(smooth(sc([[0.0, -0.075], [0.02, -0.07]]), false), ln, 0.0025 * k, { a: 0.6 }));
  H.grip = { shape: gs, draw: gd };
  const point = sc([[-0.036, 0.014], [0.03, 0.016], [0.046, -0.01], [0.05, -0.04], [0.04, -0.062], [0.024, -0.066], [0.022, -0.128, 0.6], [0.012, -0.138, 1.2], [0.002, -0.128, 0.6], [0.002, -0.07], [-0.032, -0.066], [-0.044, -0.03]]);
  const ps = smooth(point, true);
  H.point = { shape: ps, draw: [F(ps, s), L(smooth(sc([[0.046, -0.028], [0.025, -0.04], [0.004, -0.036]]), false), ln, 0.0032 * k, { a: 0.8 }), L(smooth(sc([[0.004, -0.11], [0.02, -0.11]]), false), ln, 0.0024 * k, { a: 0.5 })] };
  return H;
}

// ---------------------------------------------------------------- feet (ankle pivot; sole at y = -ankleH)
export function footParts(D, view) {
  const a = D.ankleH, s = D.skin, kind = D.feet || 'sandal', b = Math.sqrt(D.build);
  const ln = ink(s, 0.6);
  const sole = D.soleCol || '#5a3a22';
  const out = {};
  if (view === 'back') {
    const pts = [[-0.042, 0.0], [0.042, 0.0], [0.046, -a + 0.02], [0.03, -a, 0.6], [-0.03, -a, 0.6], [-0.046, -a + 0.02]].map(([x, y, c]) => [x * b, y, c ?? 1]);
    const shape = smooth(pts, true);
    const col = kind === 'bare' || kind === 'sandal' ? s : (kind === 'sneaker' ? '#ece7dd' : D.shoes || '#3a2a1e');
    const draw = [F(shape, col)];
    if (kind === 'sandal') draw.push(F(poly([[-0.1, -a + 0.014], [0.1, -a + 0.014], [0.1, -a - 0.01], [-0.1, -a - 0.01]]), sole), F(poly([[-0.1, -a + 0.04], [0.1, -a + 0.04], [0.1, -a + 0.028], [-0.1, -a + 0.028]]), sole));
    if (kind === 'sneaker') draw.push(F(poly([[-0.1, -a + 0.02], [0.1, -a + 0.02], [0.1, -a - 0.01], [-0.1, -a - 0.01]]), D.soleStripe || '#c8beb0'));
    out.foot = { id: 'foot', shape, draw, density: 'limb', bulge: 0.8, shadow: true };
    return out;
  }
  const k3 = view === 'threeQuarter' ? 0.68 : 1;
  const X = (pts) => pts.map(([x, y, c]) => [x > 0 ? x * k3 * b : x * b, y, c ?? 1]);
  if (kind === 'bare' || kind === 'sandal') {
    const pts = X([[-0.034, 0.012], [0.03, 0.01], [0.072, -0.02], [0.112, -0.032], [0.12, -0.031, 1.2], [0.127, -0.036, 0.25], [0.134, -0.033, 1.2], [0.14, -0.039, 0.25], [0.147, -0.037, 1.2], [0.157, -0.046, 0.6], [0.161, -0.058], [0.157, -a + 0.006, 0.6], [0.14, -a], [0.0, -a], [-0.048, -a + 0.004, 0.6], [-0.056, -a + 0.026], [-0.046, -0.022]]);
    const shape = smooth(pts, true);
    const draw = [F(shape, s)];
    const tx = (x) => (x > 0 ? x * k3 * b : x * b);
    for (const [x0, y0] of [[0.127, -0.038], [0.14, -0.041]]) draw.push(L(poly([[tx(x0), y0], [tx(x0 - 0.004), y0 - 0.014]], false), ln, 0.0028, { a: 0.8 }));
    draw.push(F(ellipse(tx(0.152), -0.05, 0.007 * k3, 0.005), lift(s, 0.35), { a: 0.7 }));
    draw.push(L(ellipse(tx(-0.002), -0.012, 0.012, 0.01), ln, 0.0028, { a: 0.35 }));
    if (D.age > 0.5) draw.push(L(smooth([[tx(0.04), -0.012], [tx(0.07), -0.026], [tx(0.1), -0.03]], false), mixc(s, '#5a6a80', 0.35), 0.0026, { a: 0.5 }));
    if (kind === 'sandal') {
      draw.push(F(poly([[tx(-0.07), -a + 0.012], [tx(0.18), -a + 0.012], [tx(0.18), -a - 0.02], [tx(-0.07), -a - 0.02]]), sole));
      draw.push(F(poly([[tx(0.06), -0.006], [tx(0.085), -0.022], [tx(0.03), -a + 0.012], [tx(0.008), -a + 0.012]]), sole), F(poly([[-0.03 * b, 0.006], [-0.012 * b, 0.004], [-0.02 * b, -a + 0.012], [-0.04 * b, -a + 0.012]]), sole));
      draw.push(L(poly([[tx(-0.06), -a + 0.006], [tx(0.17), -a + 0.006]], false), lift(sole, 0.3), 0.0025, { a: 0.6 }));
    }
    out.foot = { id: 'foot', shape: smooth(pts.concat(kind === 'sandal' ? [] : []), true), draw, density: 'limb', bulge: 0.8, shadow: true };
    if (kind === 'sandal') { // sole sticks out a little: widen the silhouette downwards
      const sp = X([[-0.034, 0.012], [0.03, 0.01], [0.072, -0.02], [0.112, -0.032], [0.12, -0.031, 1.2], [0.127, -0.036, 0.25], [0.134, -0.033, 1.2], [0.14, -0.039, 0.25], [0.147, -0.037, 1.2], [0.157, -0.046, 0.6], [0.163, -0.058], [0.17, -a + 0.01, 0.6], [0.166, -a - 0.006, 0.4], [-0.058, -a - 0.006, 0.4], [-0.062, -a + 0.012, 0.6], [-0.056, -a + 0.026], [-0.046, -0.022]]);
      out.foot.shape = smooth(sp, true); out.foot.draw[0] = F(out.foot.shape, s);
    }
  } else {
    const sneaker = kind === 'sneaker';
    const col = sneaker ? '#ece7dd' : D.shoes || '#3a2a1e';
    const pts = X([[-0.04, 0.02], [0.03, 0.016], [0.08, -0.016], [0.14, -0.03], [0.168, -0.046, 0.8], [0.172, -a + 0.006, 0.6], [0.15, -a - 0.004], [-0.05, -a - 0.004, 0.6], [-0.062, -a + 0.02], [-0.054, -0.01]]);
    const shape = smooth(pts, true);
    const tx = (x) => (x > 0 ? x * k3 * b : x * b);
    const draw = [F(shape, col)];
    if (sneaker) {
      draw.push(F(poly([[tx(-0.08), -a + 0.018], [tx(0.2), -a + 0.018], [tx(0.2), -a - 0.02], [tx(-0.08), -a - 0.02]]), D.soleStripe || '#c9bfb1'));
      draw.push(L(smooth([[tx(-0.03), -0.035], [tx(0.04), -0.03], [tx(0.1), -0.05]], false), D.shoeAccent || '#3b456f', 0.009, { a: 0.9 }));
      for (let i = 0; i < 3; i++) draw.push(L(poly([[tx(0.03 + i * 0.022), -0.004 - i * 0.008], [tx(0.045 + i * 0.022), -0.02 - i * 0.008]], false), '#7a7266', 0.003));
      draw.push(F(smooth([[tx(0.12), -0.03], [tx(0.172), -0.05], [tx(0.17), -a + 0.02], [tx(0.12), -a + 0.02]], true), '#f6f2ea', { a: 0.7 }));
    } else draw.push(L(poly([[tx(-0.06), -a + 0.01], [tx(0.17), -a + 0.01]], false), lift(col, 0.25), 0.004, { a: 0.6 }), L(smooth([[tx(0.02), 0.0], [tx(0.06), -0.02]], false), lift(col, 0.25), 0.003, { a: 0.5 }));
    out.foot = { id: 'foot', shape, draw, density: 'limb', bulge: 0.8, shadow: true };
  }
  return out;
}

// ---------------------------------------------------------------- body accessories (torso space)
export function accessoryParts(D, view) {
  const out = [];
  if (D.satchel && view !== 'back') {
    const c = D.satchel, x = view === 'side' ? -0.1 : -0.17, y = -0.02;
    const pts = [[x - 0.075, y + 0.06], [x + 0.075, y + 0.06], [x + 0.08, y - 0.1, 0.5], [x - 0.08, y - 0.1, 0.5]];
    const sh = smooth(pts.map(([px, py, k]) => [px, py, k ?? 0.3]), true);
    out.push({ id: 'satchel', pivot: 'torso', layer: 37, density: 'body', bulge: 0.8, shape: sh, shadow: true,
      draw: [F(sh, c), F(smooth([[x - 0.078, y + 0.06], [x + 0.078, y + 0.06], [x + 0.07, y - 0.02], [x, y - 0.035], [x - 0.07, y - 0.02]], true), shade(c, 0.88)), L(smooth([[x - 0.07, y - 0.02], [x, y - 0.035], [x + 0.07, y - 0.02]], false), ink(c, 0.6), 0.004, { a: 0.7 }), F(rrect(x - 0.012, y - 0.045, x + 0.012, y - 0.025, 0.004), '#c9a24a'), stitches([[x - 0.06, y + 0.045], [x + 0.06, y + 0.045], [x + 0.065, y - 0.085], [x - 0.065, y - 0.085]], lift(c, 0.35), 0.0025)] });
  }
  if (D.tool && view === 'side') {
    const wood = '#7a5232', iron = '#5f646a';
    const pts = [[-0.14, 0.09], [-0.12, 0.1], [-0.05, -0.2], [-0.07, -0.21]];
    const sh = smooth(pts.map((p) => [...p, 0.3]), true);
    out.push({ id: 'tool', pivot: 'torso', layer: 21, density: 'prop', bulge: 0.7, shape: sh, draw: [F(sh, wood), L(poly([[-0.125, 0.08], [-0.065, -0.19]], false), lift(wood, 0.3), 0.003, { a: 0.6 })] });
    const hs = smooth([[-0.17, 0.12, 0.3], [-0.1, 0.13, 0.3], [-0.095, 0.085, 0.3], [-0.17, 0.08, 0.3]], true);
    out.push({ id: 'toolHead', pivot: 'torso', layer: 21.1, density: 'prop', bulge: 0.5, shape: hs, draw: [F(hs, iron), L(poly([[-0.17, 0.09], [-0.1, 0.095]], false), lift(iron, 0.4), 0.003, { a: 0.7 })] });
  }
  return out;
}

// ---------------------------------------------------------------- hand props (prop pivot = grip point)
export function propParts(kind, D) {
  const wood = D && D.wood || '#7a5232', woodD = ink(wood, 0.6), woodL = lift(wood, 0.3);
  const P = [];
  const add = (id, shape, draw, x = {}) => P.push({ id, shape, draw: [F(shape, draw.fill || x.fill), ...(draw.list || [])], density: 'prop', bulge: x.bulge ?? 0.9, prof: 1, rim: true, shadow: true, layer: x.layer ?? 0, ...x });
  if (kind === 'cane') {
    const Lc = D.caneLen || 0.82, r = mulberry32((D.seed || 1) * 31);
    const knots = [0.25, 0.48, 0.7].map((t) => -Lc * t + (r() - 0.5) * 0.04);
    const right = [[0.016, 0.03], ...knots.flatMap((y) => [[0.015, y + 0.03], [0.021, y, 1.3], [0.014, y - 0.03]]), [0.011, -Lc + 0.02], [0.009, -Lc, 0.5]];
    const left = [[-0.009, -Lc, 0.5], [-0.012, -Lc + 0.02], ...knots.slice().reverse().flatMap((y) => [[-0.014, y - 0.02], [-0.018, y + 0.01, 1.3], [-0.015, y + 0.04]]), [-0.017, 0.03]];
    const handle = [[-0.02, 0.06], [-0.005, 0.085], [0.04, 0.09], [0.075, 0.07], [0.085, 0.035], [0.07, 0.02], [0.058, 0.045], [0.035, 0.06], [0.012, 0.055]];
    const pts = [...handle, ...right, ...left];
    const shape = smooth(pts, true);
    const list = [L(smooth([[0.002, 0.04], [0.004, -Lc * 0.3], [0.0, -Lc * 0.6], [0.002, -Lc * 0.95]], false), woodD, 0.0035, { a: 0.55 }), L(smooth([[0.008, 0.0], [0.009, -Lc * 0.5]], false), woodL, 0.003, { a: 0.4 }), L(smooth([[0.0, 0.07], [0.04, 0.078], [0.07, 0.055]], false), woodL, 0.004, { a: 0.5 })];
    for (const y of knots) list.push(L(ellipse(0.004, y, 0.008, 0.012), woodD, 0.003, { a: 0.6 }));
    list.push(F(poly([[-0.03, -Lc + 0.03], [0.03, -Lc + 0.03], [0.03, -Lc - 0.02], [-0.03, -Lc - 0.02]]), ink(wood, 0.55)));
    add('cane', shape, { fill: wood, list }, { tip: [0, -Lc], top: [0.03, 0.09] });
  } else if (kind === 'staff') {
    const top = 0.78, bot = -0.95;
    const pts = [[-0.02, top - 0.02], [-0.004, top + 0.03], [0.022, top + 0.02], [0.026, top - 0.03], [0.016, top - 0.07], [0.017, 0.2], [0.02, 0.02, 1.3], [0.015, -0.1], [0.012, bot + 0.02], [0.008, bot, 0.5], [-0.01, bot, 0.5], [-0.013, bot + 0.02], [-0.016, -0.1], [-0.018, 0.1, 1.2], [-0.016, top - 0.07]];
    const shape = smooth(pts, true);
    add('staff', shape, { fill: wood, list: [L(smooth([[0.002, top], [0.004, 0.3], [0.0, -0.3], [0.002, bot + 0.05]], false), woodD, 0.0035, { a: 0.55 }), L(smooth([[0.008, top - 0.05], [0.009, 0.1]], false), woodL, 0.003, { a: 0.4 }), L(ellipse(0.002, top - 0.02, 0.012, 0.016), woodD, 0.003, { a: 0.6 })] }, { tip: [0, bot], top: [0, top] });
  } else if (kind === 'spear') {
    const top = 1.02, bot = -0.95, iron = '#8a9098';
    const pts = [[-0.012, top - 0.12], [0.012, top - 0.12], [0.013, 0.2], [0.014, 0.0], [0.012, bot + 0.02], [0.008, bot, 0.5], [-0.009, bot, 0.5], [-0.012, bot + 0.02], [-0.014, 0.0], [-0.013, 0.2]];
    add('shaft', smooth(pts, true), { fill: wood, list: [L(smooth([[0.002, top - 0.14], [0.003, 0.3], [0.0, -0.3], [0.002, bot + 0.05]], false), woodD, 0.003, { a: 0.5 })] });
    const tip = smooth([[0.0, top + 0.17, 0.4], [0.03, top + 0.03], [0.022, top - 0.06], [0.012, top - 0.13], [-0.012, top - 0.13], [-0.022, top - 0.06], [-0.03, top + 0.03]], true);
    add('tip', tip, { fill: iron, list: [L(poly([[0.0, top + 0.15], [0.0, top - 0.1]], false), lift(iron, 0.5), 0.004, { a: 0.8 }), F(poly([[-0.016, top - 0.12], [0.016, top - 0.12], [0.016, top - 0.16], [-0.016, top - 0.16]]), shade(iron, 0.7))] }, { layer: 0.05, bulge: 0.5, tip: [0, bot], top: [0, top + 0.17] });
  } else if (kind === 'hammer' || kind === 'adze') {
    const len = 0.32, wd = 0.014, iron = '#5c6066';
    const hs = smooth([[-0.04, -0.045 + wd], [len, -0.045 + wd * 0.9], [len, -0.045 - wd * 0.9], [-0.04, -0.045 - wd], [-0.05, -0.045, 0.6]].map((p) => [...p.slice(0, 2), p[2] ?? 0.4]), true);
    add('handle', hs, { fill: wood, list: [L(poly([[-0.03, -0.044], [len - 0.02, -0.043]], false), woodL, 0.003, { a: 0.5 })] }, { bulge: 0.8 });
    if (kind === 'hammer') {
      const head = smooth([[len - 0.035, 0.02, 0.2], [len + 0.04, 0.02, 0.2], [len + 0.04, -0.12, 0.2], [len - 0.035, -0.12, 0.2]], true);
      add('head', head, { fill: iron, list: [L(poly([[len - 0.03, 0.012], [len + 0.035, 0.012]], false), lift(iron, 0.45), 0.004, { a: 0.7 }), F(poly([[len - 0.04, -0.105], [len + 0.045, -0.105], [len + 0.045, -0.125], [len - 0.04, -0.125]]), shade(iron, 0.75))] }, { layer: 0.05, bulge: 0.5 });
    } else {
      const head = smooth([[len - 0.03, 0.0, 0.3], [len + 0.03, 0.0, 0.3], [len + 0.03, -0.06], [len + 0.02, -0.14, 0.5], [len - 0.05, -0.17, 0.5], [len - 0.03, -0.12]], true);
      add('head', head, { fill: iron, list: [L(smooth([[len - 0.045, -0.155], [len + 0.015, -0.13]], false), lift(iron, 0.5), 0.004, { a: 0.8 })] }, { layer: 0.05, bulge: 0.5 });
    }
  } else if (kind === 'lamp') {
    const clay = D && D.clay || '#a8683e', cd = ink(clay, 0.62);
    const body = smooth([[-0.075, -0.02], [-0.06, 0.012], [-0.02, 0.026], [0.04, 0.022], [0.085, 0.012], [0.11, 0.016, 0.5], [0.116, 0.004, 0.5], [0.09, -0.012], [0.05, -0.034], [-0.02, -0.04], [-0.06, -0.034]], true);
    add('lamp', body, { fill: clay, list: [F(ellipse(-0.005, 0.018, 0.03, 0.008), shade(clay, 0.55)), L(smooth([[-0.06, -0.01], [0.0, -0.022], [0.06, -0.012]], false), cd, 0.003, { a: 0.6 }), L(smooth([[-0.05, 0.01], [0.02, 0.02], [0.08, 0.01]], false), lift(clay, 0.35), 0.003, { a: 0.5 }), F(ellipse(0.108, 0.012, 0.007, 0.004), '#3a2414')] }, { flame: [0.112, 0.02] });
    const hd = smooth([[-0.07, 0.004], [-0.105, 0.025], [-0.112, -0.005], [-0.09, -0.03], [-0.07, -0.025], [-0.085, -0.008], [-0.088, 0.006]], true);
    add('lampHandle', hd, { fill: shade(clay, 0.92) }, { layer: -0.1, bulge: 0.6 });
  } else if (kind === 'bowl') {
    const s = smooth([[-0.09, 0.0, 0.3], [0.09, 0.0, 0.3], [0.065, -0.055], [0.0, -0.068], [-0.065, -0.055]], true);
    add('bowl', s, { fill: '#8a6a46', list: [F(ellipse(0, 0, 0.088, 0.012), '#5a422c')] }, { offset: [0.02, 0.03] });
  } else if (kind === 'cup') {
    const s = smooth([[-0.04, 0.0, 0.3], [0.045, 0.0, 0.3], [0.055, 0.11, 0.3], [-0.05, 0.11, 0.3]], true);
    add('cup', s, { fill: '#c99a3a', list: [F(ellipse(0.002, 0.108, 0.05, 0.01), '#8a6a26'), L(poly([[-0.045, 0.04], [0.05, 0.04]], false), lift('#c99a3a', 0.4), 0.004, { a: 0.6 })] });
  } else if (kind === 'fruitGood' || kind === 'fruitBad') {
    const good = kind === 'fruitGood';
    const s = good ? ellipse(0, 0, 0.055, 0.053) : smooth([[-0.055, 0.0], [-0.04, 0.035], [-0.01, 0.03], [0.012, 0.05], [0.045, 0.03], [0.058, -0.005], [0.04, -0.04], [0.01, -0.05], [-0.02, -0.035], [-0.048, -0.03]], true);
    add(kind, s, { fill: good ? '#e0742c' : '#6b5a2e', list: good ? [F(ellipse(0.02, 0.022, 0.014, 0.01), '#f6b067', { a: 0.8 }), F(poly([[-0.006, 0.05], [0.008, 0.05], [0.016, 0.078], [0.002, 0.078]]), '#4f6a2a')] : [F(ellipse(0.02, 0.01, 0.018, 0.014), '#3d3220')] });
  }
  return P;
}

// ---------------------------------------------------------------- baby (swaddled bundle; lies along x, head at +x, face looking UP)
export function babyParts(D) {
  const s = D.skin, c = D.cloth || '#efe3c8', ln = ink(c, 0.68), bl = mixc(s, '#d0604a', 0.5), sl = ink(s, 0.58);
  const band = D.band || '#b8894a';
  const P = [];
  // hood: frames the back and crown of the head, leaves the face (top) open
  const hood = smooth([[0.1, 0.02], [0.12, -0.07], [0.2, -0.098], [0.29, -0.07], [0.33, 0.0], [0.322, 0.07], [0.29, 0.11], [0.262, 0.1], [0.27, 0.04], [0.24, -0.03], [0.17, -0.04]], true);
  P.push({ id: 'hood', pivot: 'body', layer: 10, density: 'face', bulge: 0.8, shape: hood, shadow: true,
    draw: [F(hood, shade(c, 0.94)), L(smooth([[0.13, -0.06], [0.22, -0.082], [0.3, -0.05], [0.316, 0.03]], false), ln, 0.004, { a: 0.6 }), L(smooth([[0.285, 0.1], [0.3, 0.06], [0.296, 0.0]], false), lift(c, 0.4), 0.004, { a: 0.6 })] });
  // head in profile, looking up: chin (-x) .. lips .. nose (top) .. brow .. forehead .. crown (+x)
  const hp = [[0.13, 0.03], [0.142, 0.062], [0.16, 0.074, 0.6], [0.168, 0.07], [0.178, 0.082], [0.19, 0.104, 0.5], [0.204, 0.096, 0.6], [0.222, 0.092], [0.25, 0.088], [0.275, 0.07], [0.288, 0.035], [0.282, -0.01], [0.258, -0.04], [0.21, -0.052], [0.165, -0.04], [0.138, -0.01]];
  const head = smooth(hp, true);
  P.push({ id: 'babyHead', pivot: 'babyHead', layer: 12, density: 'face', bulge: 0.95, shape: head, shadow: true,
    draw: [F(head, s), F(ellipse(0.175, 0.04, 0.026, 0.018), bl, { a: 0.4, blur: 0.01 }), F(ellipse(0.205, 0.0, 0.016, 0.02), shade(s, 0.9)), L(smooth([[0.198, 0.012], [0.21, 0.008], [0.212, -0.008]], false), sl, 0.003, { a: 0.7 }),
      L(smooth([[0.27, 0.07], [0.282, 0.05], [0.29, 0.03]], false), D.hairColor || '#3a2a1c', 0.006, { a: 0.85 }), L(smooth([[0.262, 0.08], [0.276, 0.062]], false), D.hairColor || '#3a2a1c', 0.004, { a: 0.7 }),
      L(smooth([[0.161, 0.072], [0.168, 0.068]], false), sl, 0.003, { a: 0.8 }), L(smooth([[0.2, 0.094], [0.208, 0.09]], false), sl, 0.0025, { a: 0.4 })] });
  const ec = smooth([[0.216, 0.066], [0.226, 0.058], [0.238, 0.064], [0.238, 0.068], [0.226, 0.063], [0.216, 0.07]], true);
  P.push({ id: 'babyEyeClosed', pivot: 'babyHead', layer: 12.2, outline: false, density: 'face', bulge: 0, rim: false, toggle: 'babyEye:closed', shape: ec, draw: [F(ec, '#2c170d')] });
  P.push({ id: 'babyEyeOpen', pivot: 'babyHead', layer: 12.2, outline: false, density: 'face', bulge: 0.2, rim: false, toggle: 'babyEye:open', shape: ellipse(0.228, 0.066, 0.009, 0.01), draw: [F(ellipse(0.228, 0.066, 0.009, 0.01), '#1d120a'), F(ellipse(0.231, 0.07, 0.003, 0.003), '#fff3de')] });
  // swaddle body with a folded-over top edge and a band
  const body = smooth([[-0.24, 0.0], [-0.225, 0.06], [-0.12, 0.09], [0.0, 0.098], [0.1, 0.09], [0.15, 0.06], [0.16, 0.0], [0.15, -0.06], [0.05, -0.088], [-0.1, -0.082], [-0.2, -0.056]], true);
  P.push({ id: 'swaddle', pivot: 'body', layer: 14, density: 'face', bulge: 0.85, prof: 1.2, shape: body, shadow: true,
    draw: [F(body, c), F(smooth([[0.03, 0.1], [0.155, 0.07], [0.15, -0.01], [0.04, 0.04]], true), shade(c, 0.93)), L(smooth([[0.04, 0.04], [0.1, 0.03], [0.15, -0.01]], false), ln, 0.004, { a: 0.6 }),
      L(smooth([[-0.1, 0.085], [-0.05, 0.0], [0.0, -0.08]], false), ln, 0.004, { a: 0.55 }), L(smooth([[-0.19, 0.05], [-0.16, -0.02], [-0.15, -0.07]], false), ln, 0.0035, { a: 0.5 }),
      F(poly([[-0.07, 0.1], [-0.03, 0.1], [-0.01, -0.09], [-0.05, -0.09]]), band), L(poly([[-0.048, 0.1], [-0.028, -0.09]], false), lift(band, 0.4), 0.003, { a: 0.6 }), L(smooth([[-0.2, 0.04], [-0.12, 0.07], [-0.02, 0.08]], false), lift(c, 0.4), 0.004, { a: 0.6 })] });
  const hand = smooth([[0.115, 0.075], [0.13, 0.098], [0.15, 0.094], [0.152, 0.076], [0.132, 0.066]], true);
  P.push({ id: 'babyHand', pivot: 'body', layer: 15, density: 'face', bulge: 0.9, shape: hand, draw: [F(hand, s), L(smooth([[0.135, 0.09], [0.142, 0.08]], false), ink(s, 0.6), 0.0025, { a: 0.6 })] });
  return P;
}
