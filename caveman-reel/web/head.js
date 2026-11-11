// Sculpted head: lofted skull + analytic facial features, 3-D eyes with lids, brows, ears,
// neat beard shell, wavy styled hair (tapered locks), and an expressive drawn mouth decal.
import * as THREE from 'three';
import { V3, clamp, lerp, ss, lin, rng, noise3, canvasTex, noiseFill, tube, curvePts, mesh, TAU, deg } from './util.js';

const gs = (v, s) => Math.exp(-(v / s) * (v / s));
const sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

// key cross-sections of the skull: y, half-width, front z, back z, squareness, centre z
const KEYS = [
  [-0.127, 0.008, 0.068, 0.036, 2.0, 0.052],
  [-0.122, 0.021, 0.083, 0.014, 2.2, 0.048],
  [-0.113, 0.0295, 0.0895, -0.010, 2.3, 0.040],
  [-0.100, 0.0385, 0.0915, -0.034, 2.35, 0.026],
  [-0.086, 0.0480, 0.0920, -0.052, 2.4, 0.012],
  [-0.070, 0.0570, 0.0925, -0.066, 2.4, 0.004],
  [-0.050, 0.0640, 0.0920, -0.078, 2.35, 0.0],
  [-0.025, 0.0700, 0.0900, -0.090, 2.3, 0.0],
  [0.000, 0.0735, 0.0890, -0.097, 2.25, 0.0],
  [0.028, 0.0745, 0.0905, -0.101, 2.2, 0.0],
  [0.056, 0.0740, 0.0890, -0.100, 2.2, 0.0],
  [0.080, 0.0690, 0.0790, -0.093, 2.12, 0.0],
  [0.098, 0.0570, 0.0610, -0.077, 2.05, 0.0],
  [0.110, 0.0395, 0.0390, -0.053, 2.0, 0.0],
  [0.1165, 0.0170, 0.0150, -0.022, 2.0, 0.0],
];
export const Y_BOT = KEYS[0][0], Y_TOP = KEYS[KEYS.length - 1][0];
function keyAt(y, col) {
  const n = KEYS.length; if (y <= KEYS[0][0]) return KEYS[0][col]; if (y >= KEYS[n - 1][0]) return KEYS[n - 1][col];
  let i = 0; while (i < n - 2 && y > KEYS[i + 1][0]) i++;
  const y0 = KEYS[i][0], y1 = KEYS[i + 1][0]; const t = (y - y0) / (y1 - y0);
  const p0 = KEYS[i][col], p1 = KEYS[i + 1][col];
  const m0 = i > 0 ? (KEYS[i + 1][col] - KEYS[i - 1][col]) / (KEYS[i + 1][0] - KEYS[i - 1][0]) : (p1 - p0) / (y1 - y0);
  const m1 = i < n - 2 ? (KEYS[i + 2][col] - KEYS[i][col]) / (KEYS[i + 2][0] - KEYS[i][0]) : (p1 - p0) / (y1 - y0);
  const h = y1 - y0, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
}

/** Head shape evaluator for a given set of face parameters. */
export function makeHeadShape(F = {}) {
  const jaw = F.jaw ?? 1, noseS = F.nose ?? 1, browS = F.brow ?? 1, cheek = F.cheek ?? 1, chin = F.chin ?? 1;
  const ring = (y) => {
    const lower = ss(-0.02, -0.09, y) * (1 - ss(-0.105, -0.125, y) * 0.3);
    return { rx: keyAt(y, 1) * (1 + (jaw - 1) * lower), zF: keyAt(y, 2), zB: keyAt(y, 3), pw: keyAt(y, 4), cz: keyAt(y, 5) };
  };
  const base = (th, y, out) => {
    const r = ring(y); const s = Math.sin(th), c = Math.cos(th); const e = 2 / r.pw;
    out.set(r.rx * sp(s, e), y, r.cz + (c >= 0 ? (r.zF - r.cz) : (r.cz - r.zB)) * sp(c, e));
    return out;
  };
  const feat = (x, y) => {
    const ax = Math.abs(x); let d = 0;
    d -= 0.0126 * gs(ax - 0.0305, 0.0180) * gs(y + 0.003, 0.0130);                        // eye sockets
    d += 0.0046 * browS * gs(y - 0.0215, 0.0085) * (1 - ss(0.050, 0.070, ax));              // brow ridge
    d -= 0.0016 * gs(x, 0.010) * gs(y - 0.016, 0.008);                                      // nasion dip
    const t = lin(0.022, -0.037, y);                                                        // nose bridge -> tip
    let prof = 0;
    if (y <= 0.022 && y > -0.037) prof = lerp(0.0030, 0.0245, Math.pow(t, 1.15));
    else if (y <= -0.037) prof = 0.0245 * (1 - ss(-0.037, -0.0525, y)) * (1 - ss(-0.037, -0.0525, y)) + 0.0025 * gs(y + 0.054, 0.006);
    const wid = lerp(0.0058, 0.0096, t) * (0.9 + 0.1 * noseS);
    d += noseS * prof * Math.exp(-Math.pow(ax / wid, 2.3));
    d += 0.0058 * noseS * gs(ax - 0.0118, 0.0056) * gs(y + 0.0440, 0.0064);                 // nostril wings
    d -= 0.0020 * gs(ax - 0.0175, 0.0048) * gs(y + 0.0470, 0.0060);                         // alar crease
    d += 0.0034 * gs(x, 0.027) * gs(y + 0.0735, 0.0150);                                    // muzzle / lips
    d += 0.0016 * gs(x, 0.018) * gs(y + 0.0700, 0.0045);                                    // upper lip
    d += 0.0020 * gs(x, 0.019) * gs(y + 0.0810, 0.0050);                                    // lower lip
    d -= 0.0022 * gs(x, 0.022) * gs(y + 0.0925, 0.0055);                                    // mentolabial crease
    d += 0.0042 * chin * gs(x, 0.021) * gs(y + 0.1090, 0.0120);                             // chin
    d += 0.0030 * cheek * gs(ax - 0.052, 0.017) * gs(y + 0.018, 0.015);                     // cheekbones
    d -= 0.0018 * gs(ax - 0.046, 0.016) * gs(y + 0.058, 0.018);                             // hollow under cheekbone
    return d;
  };
  const a = V3(), b = V3(), c0 = V3(), n = V3();
  const baseNormal = (th, y, out) => {
    const yy = clamp(y, Y_BOT + 0.002, Y_TOP - 0.002);
    base(th + 0.012, yy, a).sub(base(th - 0.012, yy, b));
    base(th, yy + 0.0015, b).sub(base(th, yy - 0.0015, c0));
    return out.crossVectors(a, b).normalize();
  };
  /** surface point at (theta, y) pushed out by `off` along the normal */
  const surf = (th, y, off = 0, out = V3()) => {
    base(th, y, out); baseNormal(th, y, n);
    const c = Math.cos(th); const fm = ss(-0.05, 0.4, c);
    out.addScaledVector(n, feat(out.x, y) * fm + off);
    return out;
  };
  const thetaForX = (x, y) => { const r = ring(y); const s = clamp(Math.abs(x) / r.rx, 0, 1); return Math.sign(x) * Math.asin(Math.pow(s, r.pw / 2)); };
  const front = (x, y, off = 0, out = V3()) => surf(thetaForX(x, clamp(y, Y_BOT + 0.004, Y_TOP)), clamp(y, Y_BOT + 0.004, Y_TOP), off, out);
  return { surf, base, baseNormal, feat, thetaForX, front, ring };
}

// jaw weight: lower face follows the jaw bone (narrow transition at the lips, wide at the cheeks)
export function jawWeight(x, y, z) {
  const f = ss(0.010, 0.036, Math.abs(x));
  const top = lerp(-0.0745, -0.052, f), bot = lerp(-0.0790, -0.104, f);
  return ss(top, bot, y) * ss(-0.035, 0.02, z);
}

function gridSurface(S, th0, th1, y0, y1, nt, ny, offFn, closedTheta = false, capTop = false) {
  const pos = [], uv = [], idx = [];
  const p = V3();
  for (let j = 0; j <= ny; j++) {
    const y = lerp(y0, y1, j / ny);
    for (let i = 0; i <= nt; i++) {
      const th = lerp(th0, th1, i / nt);
      S.surf(th, y, offFn ? offFn(th, y) : 0, p);
      pos.push(p.x, p.y, p.z); uv.push(i / nt, j / ny);
    }
  }
  const row = nt + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nt; i++) { const a = j * row + i, b = a + 1, c = a + row, d = c + 1; idx.push(a, b, d, a, d, c); }
  if (capTop) {
    let cx = 0, cy = 0, cz = 0; const b0 = ny * row;
    for (let i = 0; i < nt; i++) { cx += pos[(b0 + i) * 3]; cy += pos[(b0 + i) * 3 + 1]; cz += pos[(b0 + i) * 3 + 2]; }
    const ci = pos.length / 3; pos.push(cx / nt, cy / nt + 0.003, cz / nt); uv.push(0.5, 1);
    for (let i = 0; i < nt; i++) idx.push(b0 + i, b0 + i + 1, ci);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (closedTheta) {
    const nr = g.attributes.normal;
    for (let j = 0; j <= ny; j++) { const a = j * row, b = a + nt; const x = nr.getX(a) + nr.getX(b), y = nr.getY(a) + nr.getY(b), z = nr.getZ(a) + nr.getZ(b); const l = Math.hypot(x, y, z) || 1; nr.setXYZ(a, x / l, y / l, z / l); nr.setXYZ(b, x / l, y / l, z / l); }
  }
  g.setAttribute('rest', new THREE.Float32BufferAttribute(pos.slice(), 3));
  return g;
}
function addJawSkin(g) {
  const p = g.attributes.position; const si = new Uint16Array(p.count * 4), sw = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) { const w = jawWeight(p.getX(i), p.getY(i), p.getZ(i)); si[i * 4] = 0; si[i * 4 + 1] = 1; sw[i * 4] = 1 - w; sw[i * 4 + 1] = w; }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
}
/** make a material discard fragments by rest-space position (crisp hairlines, necklines, hems) */
export function cutMaterial(mat, glsl, key) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 rest;\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = rest;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRest;\nfloat hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }\n' + glsl)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (cutAway(vRest)) discard;');
  };
  mat.customProgramCacheKey = () => key;
  return mat;
}

function hairTex(base, hi, lo, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const R = rng(seed);
    for (let i = 0; i < 520; i++) {
      g.globalAlpha = 0.25 + 0.5 * R(); g.strokeStyle = R() < 0.42 ? hi : lo; g.lineWidth = 0.8 + R() * 2.2;
      const x = R() * w; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (R() - 0.5) * 14, h * 0.33, x + (R() - 0.5) * 14, h * 0.66, x, h); g.stroke();
    }
    g.globalAlpha = 1;
  });
}
function fuzzTex(base, hi, lo, seed) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const R = rng(seed); g.lineCap = 'round';
    for (let i = 0; i < 2600; i++) {
      g.globalAlpha = 0.3 + 0.5 * R(); g.strokeStyle = R() < 0.4 ? hi : lo; g.lineWidth = 0.8 + R() * 1.2;
      const x = R() * w, y = R() * h, a = Math.PI / 2 + (R() - 0.5) * 1.0, l = 5 + R() * 9;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.globalAlpha = 1;
  });
}
function eyeTex(iris, seed = 1) {
  return canvasTex(512, 256, (g, w, h) => {
    const sc = g.createRadialGradient(128, 128, 30, 128, 128, 150); sc.addColorStop(0, '#ffffff'); sc.addColorStop(0.55, '#f6f1ec'); sc.addColorStop(1, '#d9c7c0');
    g.fillStyle = sc; g.fillRect(0, 0, w, h);
    const cx = 128, cy = 128, r = 49;
    const col = new THREE.Color(iris); const hx = (c, m) => '#' + c.clone().multiplyScalar(m).getHexString();
    g.fillStyle = '#1a0f0a'; g.beginPath(); g.arc(cx, cy, r + 3.5, 0, TAU); g.fill();                    // limbal ring
    const ig = g.createRadialGradient(cx, cy + 6, 6, cx, cy, r); ig.addColorStop(0, hx(col, 1.75)); ig.addColorStop(0.55, hx(col, 1.15)); ig.addColorStop(1, hx(col, 0.55));
    g.fillStyle = ig; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    const R = rng(seed);
    for (let i = 0; i < 90; i++) { const a = R() * TAU; g.strokeStyle = R() < 0.5 ? hx(col, 2.1) : hx(col, 0.5); g.globalAlpha = 0.35; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + Math.cos(a) * 17, cy + Math.sin(a) * 17); g.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3)); g.stroke(); }
    g.globalAlpha = 1;
    g.fillStyle = '#080506'; g.beginPath(); g.arc(cx, cy, 21, 0, TAU); g.fill();                         // pupil
    g.fillStyle = 'rgba(255,255,255,0.20)'; g.beginPath(); g.ellipse(cx + 2, cy + 24, 24, 11, 0, 0, TAU); g.fill();   // lower iris glow
  }, { clamp: true });
}

function buildEye(side, P, mats) {
  const R = 0.0174; const e = new THREE.Group(); e.position.set(side * 0.0305, -0.0030, 0.0618);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 24), mats.eye); ball.castShadow = false; e.add(ball);
  const lidU = new THREE.Mesh(new THREE.SphereGeometry(R * 1.07, 30, 12, 0, TAU, 0, Math.PI / 2), mats.lid); lidU.castShadow = false;
  const lash = new THREE.Mesh(new THREE.TorusGeometry(R * 1.077, 0.0014, 6, 28, Math.PI), mats.lash); lash.rotation.x = Math.PI / 2; lash.castShadow = false; lidU.add(lash);
  const lidL = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 30, 12, 0, TAU, Math.PI / 2, Math.PI / 2), mats.lid); lidL.castShadow = false;
  e.add(lidU, lidL);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(0.0021, 10, 8), mats.glint); glint.position.copy(V3(-0.30, 0.34, 0.89).normalize().multiplyScalar(R * 1.012)); e.add(glint);
  const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.0010, 8, 6), mats.glint); glint2.position.copy(V3(0.26, -0.22, 0.94).normalize().multiplyScalar(R * 1.012)); e.add(glint2);
  return { g: e, ball, lidU, lidL, glint, glint2, side };
}

function buildBrow(side, S, P, mat) {
  const k = P.browThick ?? 1;
  const ctrl = [[0.0090, 0.0190], [0.0195, 0.0250], [0.0340, 0.0275], [0.0470, 0.0250], [0.0570, 0.0180]];
  const pts = [], nrm = [];
  const c = new THREE.CatmullRomCurve3(ctrl.map(([x, y]) => V3(x * side, y, 0)));
  const piv = S.front(0.032 * side, 0.0245, 0.0026);
  for (let i = 0; i <= 18; i++) {
    const q = c.getPoint(i / 18); const p = S.front(q.x, q.y, 0.0026); const n = V3(); S.baseNormal(S.thetaForX(q.x, q.y), q.y, n);
    pts.push(p.sub(piv)); nrm.push(n);
  }
  const geo = tube(pts, (u) => [0.0023, k * (0.0046 * (1 - Math.pow(u, 2.2)) * (0.75 + 0.25 * Math.sin(Math.min(1, u * 2.4) * Math.PI / 2)) + 0.0009)], 10, { normals: nrm });
  const m = new THREE.Mesh(geo, mat); m.castShadow = false;
  const g = new THREE.Group(); g.position.copy(piv); g.add(m);
  return { g, piv: piv.clone(), side };
}

// ---------- hair ----------
const SC = { c: V3(0, 0.010, -0.005), r: V3(0.0800, 0.1050, 0.1000) };
function scalp(az, el, lift, out = V3()) {
  const ce = Math.cos(el);
  return out.set(SC.c.x + SC.r.x * ce * Math.sin(az) * (1 + lift), SC.c.y + SC.r.y * Math.sin(el) * (1 + lift), SC.c.z + SC.r.z * ce * Math.cos(az) * (1 + lift));
}
function lockGeo(path, w0, w1, t0, t1, radial = 8) {
  // path: [{p:Vector3, n:Vector3}]
  const sm = new THREE.CatmullRomCurve3(path.map(q => q.p)); const N = 16;
  const pts = sm.getPoints(N); const nr = [];
  for (let i = 0; i <= N; i++) { const f = i / N * (path.length - 1); const a = Math.floor(f), b = Math.min(path.length - 1, a + 1); nr.push(path[a].n.clone().lerp(path[b].n, f - a).normalize()); }
  return tube(pts, (u) => { const k = Math.sin(Math.min(1, u * 5) * Math.PI / 2) * (1 - Math.pow(u, 3) * 0.75); return [lerp(t0, t1, u) * k + 0.0006, lerp(w0, w1, u) * k + 0.0008]; }, radial, { normals: nr, uvScale: 1 });
}
function buildHair(style, S, P, mats) {
  const g = new THREE.Group(); const R = rng(P.seed * 7 + 3);
  if (style === 'bald') return g;
  // sculpted hair volume over the skull: thickness profile + wavy clumps, cut crisply along the hairline
  const hl = P.hairline ?? 0.072, sb = P.sideburn ?? -0.030, vol = P.hairVol ?? 1;
  const mixf = (a, b, t) => a + (b - a) * t;
  const hairlineY = (a) => { let h = hl - 0.004 * Math.cos(a * 3); h = mixf(h, 0.034, ss(0.80, 1.10, a)); h = mixf(h, sb, ss(1.08, 1.22, a)); h = mixf(h, 0.016, ss(1.36, 1.50, a)); h = mixf(h, -0.050, ss(1.78, 2.05, a)); h = mixf(h, -0.074, ss(2.1, 2.9, a)); return h; };
  const keyed = (keys, x) => { if (x <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const t = (x - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]); return mixf(keys[i - 1][1], keys[i][1], t * t * (3 - 2 * t)); } return keys[keys.length - 1][1]; };
  const SH = {
    wavy: { prof: [[20, 0.030], [45, 0.037], [75, 0.034], [100, 0.028], [140, 0.023], [180, 0.020], [215, 0.015], [250, 0.008]], side: [[0, 1], [30, 0.96], [48, 0.62], [62, 0.38], [82, 0.27]], backMin: 0.62, N: 22, depth: 0.36, wav: 0.10, shift: -0.14 },
    mop: { prof: [[20, 0.040], [60, 0.040], [120, 0.036], [200, 0.034], [250, 0.022]], side: [[0, 1], [60, 0.95], [85, 0.8]], backMin: 0.9, N: 26, depth: 0.42, wav: 0.16, shift: 0 },
    short: { prof: [[20, 0.010], [60, 0.012], [140, 0.010], [250, 0.005]], side: [[0, 1], [50, 0.7], [85, 0.5]], backMin: 0.6, N: 40, depth: 0.25, wav: 0.03, shift: 0 },
    long: { prof: [[20, 0.022], [60, 0.024], [140, 0.026], [200, 0.030], [250, 0.030]], side: [[0, 1], [50, 0.9], [85, 0.8]], backMin: 0.95, N: 24, depth: 0.34, wav: 0.08, shift: 0 },
    spiky: { prof: [[20, 0.016], [60, 0.018], [140, 0.016], [250, 0.008]], side: [[0, 1], [50, 0.8], [85, 0.6]], backMin: 0.7, N: 30, depth: 0.3, wav: 0.02, shift: 0 },
    bun: { prof: [[20, 0.012], [60, 0.014], [140, 0.014], [250, 0.008]], side: [[0, 1], [50, 0.9], [85, 0.8]], backMin: 0.9, N: 44, depth: 0.3, wav: 0.01, shift: 0 },
  }[style] || null;
  const thick = (th, y) => {
    const p = S.base(th, y, V3()); const a = Math.atan2(Math.abs(p.x), p.z); const dh = y - hairlineY(a);
    if (dh < -0.006) return 0.0030;
    const ramp = ss(-0.003, 0.026, dh);
    const dx = (p.x - SC.c.x) / SC.r.x, dy = (p.y - SC.c.y) / SC.r.y, dz = (p.z - SC.c.z) / SC.r.z; const l = Math.hypot(dx, dy, dz) || 1;
    let ph = Math.atan2(dy / l, dz / l); if (ph < -Math.PI / 2) ph += TAU; const lam = Math.asin(clamp(dx / l, -1, 1));
    const phd = ph * 180 / Math.PI, lamd = Math.abs(lam + SH.shift * 0.5) * 180 / Math.PI;
    let side = keyed(SH.side, lamd); side = mixf(side, Math.max(side, SH.backMin), ss(100, 150, phd));
    let T = keyed(SH.prof, phd) * side * vol;
    const lw = lam + SH.shift * ss(30, 120, phd) + SH.wav * Math.sin(9 * ph + 0.8 + lam * 2) + SH.wav * 0.4 * Math.sin(17 * ph + 1.9);
    const gk = Math.abs(Math.sin(SH.N * lw / 2));
    T *= (1 - SH.depth * (1 - Math.pow(gk, 0.5))) * (1 + 0.10 * Math.sin(9 * ph + 2.4 + lam * 2));
    return 0.0046 + ramp * T;
  };
  const capGeo = gridSurface(S, -Math.PI, Math.PI, -0.092, Y_TOP - 0.0005, 200, 110, thick, true, true);
  { const t = mats.hair.map.clone(); t.repeat.set(16, 2.2); t.needsUpdate = true; mats.hairCap.map = t; mats.hairCap.roughness = 0.52; }
  const capMat = cutMaterial(mats.hairCap, `bool cutAway(vec3 r){
      float a = atan(abs(r.x), r.z);
      float h = ${hl.toFixed(4)} - 0.004*cos(a*3.0);
      h = mix(h, 0.034, smoothstep(0.80, 1.10, a));
      h = mix(h, ${sb.toFixed(4)}, smoothstep(1.08, 1.22, a));
      h = mix(h, 0.016, smoothstep(1.36, 1.50, a));
      h = mix(h, -0.050, smoothstep(1.78, 2.05, a));
      h = mix(h, -0.074, smoothstep(2.1, 2.9, a));
      float rag = 0.0005*sin(a*90.0);
      return r.y < h + rag; }`, 'haircap' + hl + sb);
  const cap = new THREE.Mesh(capGeo, capMat); cap.castShadow = true; cap.receiveShadow = true; g.add(cap);
  const add = (path, w0, w1, t0, t1) => { const m = new THREE.Mesh(lockGeo(path, w0, w1, t0, t1), mats.hair); m.castShadow = true; m.receiveShadow = false; g.add(m); };
  const pathFrom = (fn, n = 7) => { const out = []; for (let i = 0; i <= n; i++) { const u = i / n; const [az, el, lift] = fn(u); const p = scalp(az, el, lift); const nn = scalp(az, el, lift + 0.2).sub(p).normalize(); out.push({ p, n: nn }); } return out; };
  if (style === 'wavy') {
    // a soft strand curling over the forehead + a few flicks at the nape
    { const root = scalp(0.24, deg(37), 0.20); const path = [];
      for (let i = 0; i <= 6; i++) { const u = i / 6; path.push({ p: root.clone().add(V3(0.004 - 0.030 * u * u, 0.012 * Math.sin(u * Math.PI) - 0.022 * u * u, 0.010 * Math.sin(u * Math.PI * 0.9))), n: V3(0, 0.25, 1).normalize() }); }
      add(path, 0.011, 0.004, 0.0065, 0.003); }
    for (let i = 0; i < 5; i++) {
      const az0 = Math.PI + lerp(-0.62, 0.62, (i + 0.5) / 5) + (R() - 0.5) * 0.08; const ph = R() * TAU;
      add(pathFrom((u) => [az0 + 0.08 * Math.sin(u * 4 + ph), deg(-20) - deg(17) * u, 0.12 + 0.07 * u * u], 5), 0.015, 0.006, 0.008, 0.003);
    }
  } else if (style === 'spiky' || style === 'long' || style === 'mop' || style === 'bun') {
    const n = style === 'long' ? 34 : 46;
    for (let i = 0; i < n; i++) {
      const az0 = R() * TAU, el0 = deg(style === 'long' ? 35 + R() * 50 : 12 + R() * 76); const ph = R() * TAU;
      if (Math.abs(Math.atan2(Math.sin(az0), Math.cos(az0))) < 0.75 && el0 < deg(38)) continue;      // keep the face clear
      if (style === 'spiky') add(pathFrom((u) => [az0 + 0.05 * Math.sin(u * 4 + ph), el0 + 0.05 * u, 0.04 + 0.42 * u], 4), 0.011, 0.002, 0.008, 0.002);
      else if (style === 'mop') add(pathFrom((u) => [az0 + 0.5 * u * Math.sin(ph) + 0.12 * Math.sin(u * 9 + ph), el0 - 0.55 * u, 0.07 + 0.10 * Math.sin(u * Math.PI)], 6), 0.013, 0.006, 0.008, 0.004);
      else if (style === 'bun') add(pathFrom((u) => [az0 * (1 - u) + Math.PI * u * (az0 > Math.PI ? 1 : 0) + (az0 > Math.PI ? Math.PI * u : 0) * 0, lerp(el0, deg(86), u), 0.05 + 0.03 * Math.sin(u * Math.PI)], 5), 0.012, 0.007, 0.006, 0.004);
      else { const back = Math.cos(az0) < 0.25; if (!back) continue; add(pathFrom((u) => [az0 + 0.1 * Math.sin(u * 7 + ph), el0 - deg(150) * u, 0.06 + 0.5 * Math.pow(u, 2.2) * (el0 - deg(150) * u < -0.5 ? 1 : 0.4)], 8), 0.013, 0.006, 0.007, 0.003); }
    }
    if (style === 'bun') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), mats.hair); b.position.set(0, 0.137, -0.02); b.scale.set(1, 0.85, 1); g.add(b); const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 8), mats.bone); bone.rotation.z = Math.PI / 2; bone.position.set(0, 0.135, -0.02); g.add(bone); for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), mats.bone); k.position.set(s * 0.062, 0.135, -0.02); g.add(k); } }
  }
  return g;
}

// ---------- mouth (drawn each frame onto a decal that hugs the face) ----------
const MX0 = -0.042, MX1 = 0.042, MY0 = -0.134, MY1 = -0.050;       // decal extent in head space
const MW = 336, MH = 336;
function drawMouth(g, m, C) {
  g.clearRect(0, 0, MW, MH);
  const X = (x) => (x - MX0) / (MX1 - MX0) * MW, Y = (y) => (1 - (y - MY0) / (MY1 - MY0)) * MH; const S = MW / (MX1 - MX0);
  const sm = m.smile ?? 0, open = clamp(m.open ?? 0, 0, 1.3), o = m.o ?? 0, smirk = m.smirk ?? 0, wide = m.wide ?? 1, teeth = m.teeth ?? 1;
  const ps = Math.max(0, sm);
  const hw = 0.0235 * wide * (1 + 0.16 * ps) * (1 - 0.45 * o);
  const y0 = -0.0748;
  const cyL = y0 + sm * 0.0062 + smirk * 0.0045 - o * 0.0015, cyR = y0 + sm * 0.0062 - smirk * 0.0012 - o * 0.0015;   // corners (L = his left = +x)
  const tsm = teeth > 0 ? ss(0.4, 0.9, sm) : 0;
  const upIn = y0 - 0.0008 * ps + o * 0.0030 + Math.min(open, 0.3) * 0.004;
  const loIn = y0 - 0.0004 - tsm * 0.0054 - open * 0.0165 - o * 0.0040;
  const tU = 0.0037 * (1 - 0.25 * ps) + o * 0.0008, tL = 0.0052 * (1 - 0.22 * ps) + o * 0.0008;
  const upTop = upIn + tU, loBot = loIn - tL; const gap = upIn - loIn;
  // cubic from (xa,ya) to (xb,yb) whose midpoint passes through height mid
  const arc = (xa, ya, xb, yb, mid) => { const c = (mid - 0.125 * (ya + yb)) / 0.75; g.bezierCurveTo(X(lerp(xa, xb, 0.28)), Y(c), X(lerp(xa, xb, 0.72)), Y(c), X(xb), Y(yb)); };
  g.lineJoin = 'round'; g.lineCap = 'round';
  // lower lip
  g.fillStyle = C.lipL; g.beginPath(); g.moveTo(X(-hw), Y(cyR)); arc(-hw, cyR, hw, cyL, loBot); arc(hw, cyL, -hw, cyR, loIn); g.fill();
  g.fillStyle = C.lipHi; g.beginPath(); g.ellipse(X(0), Y(loIn - tL * 0.52), hw * 0.40 * S, tL * 0.20 * S, 0, 0, TAU); g.fill();
  // upper lip with a cupid's bow
  g.fillStyle = C.lipU; g.beginPath(); g.moveTo(X(-hw), Y(cyR));
  g.bezierCurveTo(X(-hw * 0.62), Y(lerp(cyR, upTop, 0.92) + 0.0004), X(-0.0075), Y(upTop + 0.0012), X(0), Y(upTop - 0.0007));
  g.bezierCurveTo(X(0.0075), Y(upTop + 0.0012), X(hw * 0.62), Y(lerp(cyL, upTop, 0.92) + 0.0004), X(hw), Y(cyL));
  arc(hw, cyL, -hw, cyR, upIn); g.fill();
  const inner = () => { g.beginPath(); g.moveTo(X(-hw * 0.97), Y(cyR)); arc(-hw * 0.97, cyR, hw * 0.97, cyL, upIn); arc(hw * 0.97, cyL, -hw * 0.97, cyR, loIn); g.closePath(); };
  if (gap > 0.0012) {
    g.save(); inner(); g.clip();
    g.fillStyle = C.inside; g.fillRect(0, 0, MW, MH);
    if (open > 0.3) { g.fillStyle = C.tongue; g.beginPath(); g.ellipse(X(0), Y(loIn + gap * 0.10), hw * 0.66 * S, gap * 0.40 * S, 0, 0, TAU); g.fill(); }
    if (teeth > 0) {
      const th = open > 0.25 ? Math.min(0.0058, gap * 0.36) : gap * 0.86;
      g.fillStyle = C.teeth; g.beginPath(); g.moveTo(X(-hw), Y(upTop + 0.01)); g.lineTo(X(hw), Y(upTop + 0.01)); g.lineTo(X(hw), Y(cyL)); arc(hw, cyL, -hw, cyR, upIn - th); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(170,150,140,0.55)'; g.lineWidth = 1.1; for (let i = -3; i <= 3; i++) { if (i === 0) continue; const x = (i - Math.sign(i) * 0.5) * 0.0058 + Math.sign(i) * 0.0029; g.beginPath(); g.moveTo(X(x), Y(upIn + 0.002)); g.lineTo(X(x), Y(upIn - th * 0.92)); g.stroke(); }
      g.beginPath(); g.moveTo(X(0), Y(upIn + 0.002)); g.lineTo(X(0), Y(upIn - th * 0.95)); g.stroke();
      if (open > 0.6) { g.fillStyle = C.teeth; g.beginPath(); g.moveTo(X(-hw * 0.72), Y(loBot)); arc(-hw * 0.72, loIn - 0.004, hw * 0.72, loIn - 0.004, loIn + 0.0034); g.lineTo(X(hw * 0.72), Y(loBot)); g.closePath(); g.fill(); }
    }
    g.restore();
    g.strokeStyle = C.line; g.lineWidth = 2.0; inner(); g.stroke();
  } else {
    g.strokeStyle = C.line; g.lineWidth = 3.0; g.beginPath(); g.moveTo(X(-hw), Y(cyR)); arc(-hw, cyR, hw, cyL, (upIn + loIn) / 2); g.stroke();
  }
  if (sm > 0.3) {  // smile creases
    g.strokeStyle = C.dimple; g.lineWidth = 2.2; g.globalAlpha = Math.min(1, (sm - 0.3) * 1.6);
    for (const [sx, cy] of [[1, cyL], [-1, cyR]]) { g.beginPath(); g.moveTo(X(sx * (hw + 0.0020)), Y(cy + 0.0042)); g.quadraticCurveTo(X(sx * (hw + 0.0046)), Y(cy), X(sx * (hw + 0.0024)), Y(cy - 0.0042)); g.stroke(); }
    g.globalAlpha = 1;
  }
}

const TEXC = {};
/** Build the full head. Returns a group to attach at the head bone plus controls. */
export function buildHead(P) {
  const S = makeHeadShape(P.face || {});
  const skin = new THREE.Color(P.skin);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, emissive: 0x3a160c, emissiveIntensity: 0.16 }),
    lid: new THREE.MeshStandardMaterial({ color: skin.clone().multiplyScalar(0.9), roughness: 0.6, emissive: 0x3a160c, emissiveIntensity: 0.16 }),
    lash: new THREE.MeshStandardMaterial({ color: 0x1c110c, roughness: 0.8 }),
    eye: new THREE.MeshStandardMaterial({ map: eyeTex(P.eye, P.seed), roughness: 0.18 }),
    glint: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    brow: new THREE.MeshStandardMaterial({ color: new THREE.Color(P.brow || P.hair).multiplyScalar(0.8), roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ map: (TEXC['h' + P.hair] ||= hairTex(P.hair, P.hairHi, P.hairLo, 5)), roughness: 0.5 }),
    hairCap: new THREE.MeshStandardMaterial({ map: (TEXC['c' + P.hair] ||= (() => { const t = fuzzTex(P.hair, P.hairHi, P.hairLo, 6); t.repeat.set(10, 5); return t; })()), roughness: 0.75, side: THREE.DoubleSide }),
    beard: new THREE.MeshStandardMaterial({ map: (TEXC['b' + P.beard] ||= (() => { const t = fuzzTex(P.beard, P.beardHi, P.beardLo, 8); t.repeat.set(6, 3.5); return t; })()), roughness: 0.85, side: THREE.DoubleSide }),
    bone: new THREE.MeshStandardMaterial({ color: 0xf1e8d2, roughness: 0.7 }),
  };
  const g = new THREE.Group(); g.name = 'head';
  // skull bones for the jaw
  const skull = new THREE.Bone(), jaw = new THREE.Bone(); skull.name = 'skull'; jaw.name = 'jaw'; jaw.position.set(0, -0.030, -0.008); skull.add(jaw); g.add(skull);
  g.updateMatrixWorld(true);
  const skel = new THREE.Skeleton([skull, jaw]);

  // head skin
  const NT = 176, NY = 112;
  const geo = gridSurface(S, -Math.PI, Math.PI, Y_BOT + 0.0005, Y_TOP - 0.0003, NT, NY, null, true);
  { // close top & bottom, vertex colours (blush, lips, socket shading)
    const p = geo.attributes.position; const col = new Float32Array(p.count * 3); const c = new THREE.Color();
    const blush = skin.clone().lerp(new THREE.Color('#d9705e'), 0.42), dark = skin.clone().multiplyScalar(0.78);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x); c.copy(skin);
      if (z > 0) {
        c.lerp(blush, 0.34 * gs(ax - 0.047, 0.020) * gs(y + 0.036, 0.020) + 0.16 * gs(x, 0.012) * gs(y + 0.038, 0.012));
        c.lerp(dark, 0.30 * gs(ax - 0.0315, 0.020) * gs(y + 0.001, 0.015) + 0.22 * gs(x, 0.016) * gs(y + 0.056, 0.005) + 0.18 * gs(x, 0.02) * gs(y + 0.093, 0.006));
      }
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  addJawSkin(geo);
  const headMesh = new THREE.SkinnedMesh(geo, mats.skin); headMesh.castShadow = true; headMesh.receiveShadow = true; headMesh.frustumCulled = false; g.add(headMesh); headMesh.bind(skel);
  // top cap (under the hair) + ears
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 8), mats.lid); capTop.position.set(0, Y_TOP - 0.02, -0.004); capTop.scale.set(1, 0.9, 1.1); g.add(capTop);
  const earMat = new THREE.MeshStandardMaterial({ color: skin.clone().lerp(new THREE.Color('#d9705e'), 0.16), roughness: 0.62, emissive: 0x3a160c, emissiveIntensity: 0.2 });
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), earMat); ear.scale.set(0.0075, 0.0250, 0.0150); ear.position.set(s * 0.0735, -0.011, -0.010); ear.rotation.set(-0.12, s * 0.30, s * -0.08); g.add(ear);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mats.lid); inner.scale.set(0.0035, 0.0155, 0.0085); inner.position.set(s * 0.0786, -0.012, -0.0070); inner.rotation.copy(ear.rotation); g.add(inner);
  }
  // eyes + brows
  const eyes = [buildEye(1, P, mats), buildEye(-1, P, mats)]; eyes.forEach(e => g.add(e.g));
  const brows = [buildBrow(1, S, P, mats.brow), buildBrow(-1, S, P, mats.brow)]; brows.forEach(b => g.add(b.g));
  // beard
  let beard = null; const bstyle = P.beardStyle ?? 'neat';
  const beardT = (x, y) => bstyle === 'none' ? 0 : (bstyle === 'big' ? 0.007 + 0.016 * ss(-0.060, -0.112, y) : 0.0022 + 0.0032 * ss(-0.072, -0.110, y));
  if (bstyle !== 'none') {
    const bg = gridSurface(S, -1.75, 1.75, Y_BOT + 0.0005, -0.004, 168, 96, (th, y) => { const p = S.base(th, y, V3()); return beardT(p.x, y) * (bstyle === 'big' ? 1 + 0.25 * noise3(th * 9, y * 60, 3) : 1); });
    addJawSkin(bg);
    const top = bstyle === 'big' ? [-0.004, -0.048, -0.0545] : [-0.029, -0.0690, -0.0570];
    const bm = cutMaterial(mats.beard, `bool cutAway(vec3 r){
      float ax = abs(r.x);
      float cheek = mix(${top[0].toFixed(4)}, ${top[1].toFixed(4)}, smoothstep(-0.005, 0.078, r.z));
      cheek += 0.004*sin(clamp((r.z-0.01)/0.07,0.0,1.0)*3.14159);
      float st = (1.0 - smoothstep(0.015, 0.034, ax)) * smoothstep(0.06, 0.08, r.z);
      cheek = mix(cheek, ${top[2].toFixed(4)}, st);
      float rag = 0.0004*sin(r.z*900.0);
      if (r.y > cheek + rag) return true;
      vec2 d = vec2(r.x/0.0268, (r.y + 0.0752)/(r.y > -0.0752 ? 0.0052 : 0.0074));
      if (dot(d,d) < 1.0 && r.z > 0.05) return true;
      return false; }`, 'beard' + bstyle);
    beard = new THREE.SkinnedMesh(bg, bm); beard.castShadow = false; beard.frustumCulled = false; g.add(beard); beard.bind(skel);
    if (bstyle === 'big') { // bushy chin mass that swings with the jaw
      const bush = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), mats.beard); bush.scale.set(0.052, 0.06, 0.04); bush.position.set(0, -0.105, 0.075); jaw.add(bush);
      const bush2 = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), mats.beard); bush2.scale.set(0.066, 0.04, 0.045); bush2.position.set(0, -0.068, 0.062); jaw.add(bush2);
    }
  }
  // hair
  const hair = buildHair(P.hairStyle ?? 'wavy', S, P, mats); g.add(hair);
  // mouth decal
  const cv = document.createElement('canvas'); cv.width = MW; cv.height = MH; const ctx = cv.getContext('2d');
  const mtex = new THREE.CanvasTexture(cv); mtex.colorSpace = THREE.SRGBColorSpace; mtex.anisotropy = 8;
  const NX = 36, NYm = 40; const mp = [], muv = [], mi = [];
  for (let j = 0; j <= NYm; j++) for (let i = 0; i <= NX; i++) {
    const x = lerp(MX0, MX1, i / NX), y = lerp(MY0, MY1, j / NYm); const yc = Math.max(y, -0.120);
    const p = S.front(x, yc, beardT(x, yc) * 1.0 + 0.0016); p.y = y; if (y < -0.120) p.z -= (-0.120 - y) * 0.35;
    mp.push(p.x, p.y, p.z); muv.push(i / NX, j / NYm);
  }
  for (let j = 0; j < NYm; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; mi.push(a, b, d, a, d, c); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); mgeo.setAttribute('uv', new THREE.Float32BufferAttribute(muv, 2)); mgeo.setIndex(mi); mgeo.computeVertexNormals();
  const mouthMesh = new THREE.Mesh(mgeo, new THREE.MeshStandardMaterial({ map: mtex, transparent: true, alphaTest: 0.35, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
  mouthMesh.castShadow = false; mouthMesh.receiveShadow = false; mouthMesh.renderOrder = 3; g.add(mouthMesh);
  const lipBase = skin.clone().lerp(new THREE.Color('#a3403c'), 0.50);
  const MC = { lipU: '#' + lipBase.clone().multiplyScalar(0.80).getHexString(), lipL: '#' + lipBase.getHexString(), lipHi: 'rgba(255,235,225,0.22)', inside: '#3a1210', tongue: '#cf6a66', teeth: '#fdfbf5', line: '#4a1f18', dimple: 'rgba(90,45,30,0.55)' };
  // optional glasses (stone-age specs)
  if (P.glasses) {
    const gm = new THREE.MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.6 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0022, 8, 28), gm); r.position.set(s * 0.032, -0.004, 0.094); g.add(r); const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.085, 6), gm); arm.rotation.x = Math.PI / 2; arm.position.set(s * 0.066, -0.002, 0.052); arm.rotation.y = s * 0.2; g.add(arm); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.026, 6), gm); br.rotation.z = Math.PI / 2; br.position.set(0, -0.002, 0.096); g.add(br);
  }

  let last = '';
  const state = { blink: 0 };
  /** f: {browL:[dy,rot], browR, lid:0..1.3, squint, lidTilt, eye:[x,y], mouth:{smile,open,o,smirk,wide,teeth}, blink:0..1} */
  function setFace(f) {
    const lid = (f.lid ?? 1) * (1 - (f.blink ?? 0)); const squint = f.squint ?? 0; const ex = clamp(f.eye?.[0] ?? 0, -1, 1), ey = clamp(f.eye?.[1] ?? 0, -1, 1);
    for (const e of eyes) {
      e.ball.rotation.set(-ey * 0.40, ex * 0.52, 0, 'YXZ');
      const o = clamp(lid, 0, 1);
      e.lidU.rotation.x = lerp(0.16, -0.47, o) - Math.max(0, lid - 1) * 1.05 - ey * 0.22;
      e.lidL.rotation.x = lerp(-0.14, 0.54, o) - squint * 0.34 - Math.min(0, ey) * 0.15;
      e.lidU.rotation.z = (f.lidTilt ?? 0) * e.side * 0.30;
      e.glint.visible = e.glint2.visible = lid > 0.3;
      e.glint.scale.setScalar(f.sparkle ?? 1);
    }
    const bset = (b, v) => { const dy = v?.[0] ?? 0, rot = v?.[1] ?? 0; b.g.position.set(b.piv.x, b.piv.y + dy * 0.010, b.piv.z + Math.max(0, dy) * 0.0012); b.g.rotation.z = rot * b.side * 0.30; };
    bset(brows[0], f.browL); bset(brows[1], f.browR);
    const m = f.mouth || {};
    jaw.rotation.x = clamp(m.open ?? 0, 0, 1.3) * 0.21 + (m.o ?? 0) * 0.05;
    const key = [m.smile, m.open, m.o, m.smirk, m.wide, m.teeth].map(v => (v ?? 0).toFixed(3)).join(',');
    if (key !== last) { last = key; drawMouth(ctx, m, MC); mtex.needsUpdate = true; }
  }
  setFace({});
  return { group: g, setFace, S, eyes, brows, jaw, mats };
}
