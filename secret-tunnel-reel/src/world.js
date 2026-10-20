// World layout and the tunnel's shape (metres). x right, y up, z towards the
// camera; the cutaway face is the plane z = 0 and the lawn is y = 0. The tunnel
// lies just behind the cut face, so the cut opens it lengthwise.
//
// Digging is described by a "dig time" field over the cut face: every point of
// the cavity knows when the dig front reaches it (never dug = NEVER). The soil
// face, the tunnel's back wall and floors all read the same field, so the hole
// grows exactly the same way on every surface.
import { T } from './timeline.js';
import { clamp, smooth, easeOutCubic, prog } from './util.js';

export const NEVER = 200;
export const W = 1.1; // tunnel depth: back wall at z = -W
export const FLOOR = -2.95, ROOF = -2.0; // the first, straight tunnel
export const HALF = (ROOF - FLOOR) / 2; // half the tunnel height (0.475)
export const YA = (FLOOR + ROOF) / 2; // centre line of the straight tunnel
export const SHAFT_L = { x0: -3.55, x1: -2.85 };
export const SHAFT_R = { x0: 2.85, x1: 3.55 };
export const FOOT = { x0: -0.85, x1: 0.85, y0: -2.3, y1: -1.7 }; // concrete footing
export const STEM = { x0: -0.28, x1: 0.28, y0: -1.7, y1: 0 }; // foundation wall
export const WALL = { x0: -0.18, x1: 0.18, h: 2.0, z0: -25, z1: 0 }; // brick boundary wall
export const LID = { x: 3.2, z: -0.62, r: 0.4 }; // round hatch in the friend's lawn
export const LIP = -0.22; // the front of the hatch hole keeps a strip of turf (cut face is solid above this)
export const RIGHT_END = SHAFT_R.x1;

// --- the dip under the footing: centre line of the second dig -------------
const DIP_A = 2.15, DIP_B = 0.45, DIP_DEPTH = 0.975;
export function dipY(x) {
  const u = clamp((DIP_A - Math.abs(x)) / (DIP_A - DIP_B));
  return YA - DIP_DEPTH * (0.5 - 0.5 * Math.cos(Math.PI * u));
}
// centre line samples of the second dig: from the start of the dip to the right end
export const BPATH = (() => {
  const pts = [];
  const n = 260;
  for (let i = 0; i <= n; i++) {
    const x = -DIP_A + ((RIGHT_END - 0.35 + DIP_A) * i) / n;
    pts.push([x, dipY(x)]);
  }
  let s = 0;
  const out = [{ x: pts[0][0], y: pts[0][1], s: 0 }];
  for (let i = 1; i < pts.length; i++) {
    s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    out.push({ x: pts[i][0], y: pts[i][1], s });
  }
  return out;
})();
export const BLEN = BPATH[BPATH.length - 1].s;
export function bAt(s) {
  const P = BPATH;
  s = clamp(s, 0, BLEN);
  let lo = 0, hi = P.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (P[m].s < s) lo = m;
    else hi = m;
  }
  const a = P[lo], b = P[hi];
  const k = (s - a.s) / Math.max(1e-9, b.s - a.s);
  const tx = b.x - a.x, ty = b.y - a.y, l = Math.hypot(tx, ty) || 1;
  return { x: a.x + tx * k, y: a.y + ty * k, tx: tx / l, ty: ty / l };
}
const sOfX = (x) => {
  for (const p of BPATH) if (p.x >= x) return p.s;
  return BLEN;
};
// nearest centre-line point (brute force over a coarse grid, then refine)
function bNearest(x, y) {
  const P = BPATH;
  let best = 1e9, bi = 0;
  for (let i = 0; i < P.length; i += 4) {
    const d = (P[i].x - x) ** 2 + (P[i].y - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  for (let i = Math.max(0, bi - 4); i <= Math.min(P.length - 1, bi + 4); i++) {
    const d = (P[i].x - x) ** 2 + (P[i].y - y) ** 2;
    if (d < best) { best = d; bi = i; }
  }
  const p = P[bi];
  const q = bAt(p.s);
  // signed offset: + above the path (left of the travel direction)
  const off = (x - p.x) * -q.ty + (y - p.y) * q.tx;
  return { s: p.s, d: Math.sqrt(best), off };
}

// --- dig fronts ------------------------------------------------------------
// shaft: six scoops straight down
export function shaftY(t) {
  let y = 0;
  const step = -FLOOR / T.shaftSteps;
  for (let i = 0; i < T.shaftSteps; i++) y -= step * easeOutCubic(prog(t, T.digStart + i * T.shaftStep, 0.26));
  return y;
}
// first tunnel: scoops sideways from the shaft to the footing
const A_STEPS = 7;
export function tunnelX(t) {
  const x0 = SHAFT_L.x1 - 0.05, x1 = FOOT.x0;
  const gap = (T.tunnelEnd - 0.3 - T.tunnelStart) / (A_STEPS - 1);
  let x = x0;
  for (let i = 0; i < A_STEPS; i++) x += ((x1 - x0) / A_STEPS) * easeOutCubic(prog(t, T.tunnelStart + i * gap, 0.3));
  return x;
}
// second dig: arc length travelled along BPATH
const S_UNDER = sOfX(-DIP_B), S_UP = sOfX(DIP_A);
export function digS(t) {
  if (t < T.dipStart) return 0;
  if (t < T.dipUnder) return S_UNDER * smooth(prog(t, T.dipStart, T.dipUnder - T.dipStart)) ** 0.9;
  if (t < T.dipUp) return S_UNDER + (S_UP - S_UNDER) * prog(t, T.dipUnder, T.dipUp - T.dipUnder);
  // overshoot the end of the path so the far corner of the tunnel gets dug too
  return S_UP + (BLEN + 0.45 - S_UP) * easeOutCubic(prog(t, T.dipUp, T.exitShaft - T.dipUp));
}
// exit shaft: climbs from the tunnel roof to the lawn
export function exitY(t) {
  return ROOF + (0 - ROOF) * smooth(prog(t, T.exitShaft, T.breakThrough - T.exitShaft));
}

// --- brick arches over the passage -----------------------------------------
// roof of the passage after the two digs (before any dirt falls)
function bRoofAt(x) {
  // top of the swept band: highest point of all centre-line disks over x
  let top = -1e9;
  for (const p of BPATH) {
    const dx = x - p.x;
    if (Math.abs(dx) < HALF) top = Math.max(top, p.y + Math.sqrt(HALF * HALF - dx * dx));
  }
  return top;
}
export function bFloorAt(x) {
  let bot = 1e9;
  for (const p of BPATH) {
    const dx = x - p.x;
    if (Math.abs(dx) < HALF) bot = Math.min(bot, p.y - Math.sqrt(HALF * HALF - dx * dx));
  }
  return bot;
}
export function roofAt(x) {
  if (x <= FOOT.x0) return ROOF;
  return Math.max(bRoofAt(x), x >= DIP_A ? ROOF : -1e9);
}
export function floorAt(x) {
  if (x < -DIP_A || x > DIP_A) return FLOOR;
  return Math.min(x <= FOOT.x0 ? FLOOR : 1e9, bFloorAt(x));
}

export const BAND = 0.17; // arch ring thickness
const RIBS = [SHAFT_L.x1, -1.85, FOOT.x0, FOOT.x1, 1.85, SHAFT_R.x0];
// each arch: circular arc through its two springing points, bulging upwards
export const ARCHES = (() => {
  const out = [];
  for (let k = 0; k < RIBS.length - 1; k++) {
    const xa = RIBS[k], xb = RIBS[k + 1];
    const ya = k === 2 ? roofAt(xa + 0.02) : roofAt(xa + 0.01), yb = k === 1 ? ROOF : roofAt(xb - 0.01);
    // rise above the chord, enough to clear the roof everywhere along the span
    const chord = (x) => ya + ((yb - ya) * (x - xa)) / (xb - xa);
    let need = 0;
    for (let i = 1; i < 40; i++) {
      const x = xa + ((xb - xa) * i) / 40;
      need = Math.max(need, roofAt(x) - chord(x));
    }
    let rise = Math.max(k === 2 ? 0.12 : 0.2, need + 0.08);
    if (k === 2) rise = Math.min(rise, FOOT.y0 - BAND - 0.03 - Math.max(ya, yb));
    // circle through A, B with sagitta `rise` measured perpendicular to the chord
    const cx = (xa + xb) / 2, cy = (ya + yb) / 2;
    const L = Math.hypot(xb - xa, yb - ya);
    const nx = -(yb - ya) / L, ny = (xb - xa) / L; // chord normal (pointing up)
    const R = (rise * rise + (L / 2) ** 2) / (2 * rise);
    const ox = cx - nx * (R - rise), oy = cy - ny * (R - rise);
    const a0 = Math.atan2(ya - oy, xa - ox), a1 = Math.atan2(yb - oy, xb - ox);
    out.push({ k, xa, ya, xb, yb, rise, R, ox, oy, a0, a1 });
  }
  return out;
})();
export const ARCH_RIBS = RIBS;
// intrados height of arch k over x (inside its span)
export function archY(a, x, r = a.R) {
  const dx = x - a.ox;
  return a.oy + Math.sqrt(Math.max(0, r * r - dx * dx));
}
export function archAt(x) {
  for (const a of ARCHES) if (x >= a.xa - 1e-6 && x <= a.xb + 1e-6) return a;
  return null;
}
// passage ceiling once the arches are in (intrados)
export function ceilingAt(x) {
  const a = archAt(x);
  return a ? archY(a, x) : roofAt(x);
}
// dirt falls arch by arch, left to right
export const CRUMBLE = ARCHES.map((a, k) => T.crumbleStart + k * ((T.crumbleEnd - T.crumbleStart - 0.55) / (ARCHES.length - 1)));

// --- dig time over the cut face --------------------------------------------
// binary search: first t in [t0, t1] where dug(t) is true (dug is monotonic)
function firstTime(dug, t0, t1) {
  if (!dug(t1)) return NEVER;
  if (dug(t0)) return t0;
  for (let i = 0; i < 22; i++) {
    const m = (t0 + t1) / 2;
    if (dug(m)) t1 = m;
    else t0 = m;
  }
  return t1;
}
// back = true: the tunnel's back wall (the hatch hole goes all the way up there)
export function digTime(x, y, back = false) {
  let t = NEVER;
  // shaft in the left lawn
  if (x >= SHAFT_L.x0 && x <= SHAFT_L.x1 && y <= 0.3 && y >= FLOOR - 0.001) {
    t = Math.min(t, firstTime((tt) => y >= shaftY(tt) - 0.001 || y > -0.02, T.digStart - 0.01, T.digStart + T.shaftSteps * T.shaftStep + 0.4));
  }
  // first tunnel (rounded dig face that flattens out against the footing)
  if (x >= SHAFT_L.x1 - 0.06 && x <= FOOT.x0 + 1e-6 && y >= FLOOR && y <= ROOF) {
    const q = (y - YA) / HALF;
    t = Math.min(t, firstTime((tt) => {
      const xa = tunnelX(tt);
      const r = 0.14 * q * q * (1 - smooth(clamp((xa + 1.25) / 0.4)));
      return x <= xa - r;
    }, T.tunnelStart - 0.01, T.tunnelEnd + 0.4));
  }
  // second dig: down under the footing, back up and on to the right end
  if (x >= -DIP_A - HALF && x <= RIGHT_END && y < ROOF + 0.02 && y > YA - DIP_DEPTH - HALF - 0.02) {
    const n = bNearest(x, y);
    const inside = n.d <= HALF || (x > DIP_A && x <= RIGHT_END && y >= FLOOR && y <= ROOF);
    if (inside) {
      const sx = x > DIP_A ? Math.max(n.s, sOfX(Math.min(x, BPATH[BPATH.length - 1].x))) : n.s;
      const lead = x > DIP_A ? 0 : 0.14 * (n.off / HALF) ** 2;
      t = Math.min(t, firstTime((tt) => sx + lead <= digS(tt), T.dipStart - 0.01, T.exitShaft + 0.3));
    }
  }
  // exit shaft up to the friend's lawn
  if (x >= SHAFT_R.x0 && x <= SHAFT_R.x1 && y >= ROOF - 0.01 && y <= 0.3) {
    const top = back ? 0.3 : LIP;
    if (y <= top) t = Math.min(t, y <= ROOF + 0.02 ? T.exitShaft : firstTime((tt) => y <= exitY(tt), T.exitShaft, T.breakThrough + 0.05));
  }
  // hollows where the roof crumbles, later lined with the brick arches
  {
    const a = archAt(x);
    if (a) {
      const roof = roofAt(x);
      const top = archY(a, x, a.R + BAND) + 0.005;
      if (y > roof - 0.02 && y <= top) {
        const c = CRUMBLE[a.k];
        const u = clamp((y - roof) / Math.max(0.05, top - roof));
        t = Math.min(t, c + 0.5 * u + 0.08 * Math.sin(x * 23.1 + y * 11.7));
      }
    }
  }
  return t;
}

// raster of the dig-time field over the tunnel region (for the GPU)
export const DIG_RECT = { x0: -4.6, x1: 4.6, y0: -4.7, y1: 0.35 };
export function digRaster(pxPerM, back = false) {
  const { x0, x1, y0, y1 } = DIG_RECT;
  const w = Math.round((x1 - x0) * pxPerM), h = Math.round((y1 - y0) * pxPerM);
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const y = y0 + ((j + 0.5) / h) * (y1 - y0);
    for (let i = 0; i < w; i++) {
      const x = x0 + ((i + 0.5) / w) * (x1 - x0);
      // cheap reject: far outside every cavity
      if (y < -4.65 || (y > ROOF + 0.45 && !(x >= SHAFT_L.x0 - 0.05 && x <= SHAFT_L.x1 + 0.05) && !(x >= SHAFT_R.x0 - 0.05 && x <= SHAFT_R.x1 + 0.05))) {
        out[j * w + i] = NEVER;
        continue;
      }
      out[j * w + i] = digTime(x, y, back);
    }
  }
  return { data: out, w, h };
}
