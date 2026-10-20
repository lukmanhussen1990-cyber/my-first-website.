import * as THREE from 'three';
import { spline, clamp } from './util.js';

// The new Roadster, built from the reference photos: a very low, wide,
// faceted wedge with a full-width LED light bar, a bronze-tinted glass canopy
// that runs from the hood to the tail, black lower skirts, big aero wheels with
// dark turbine blades and a small amber marker behind the front wheel.
// No logos or badges. Local frame: +x forward, +y up, +z right, origin on the
// ground midway between the axles.

export const CAR = {
  XN: 2.27, XT: -2.2,            // nose / tail
  FW: 1.36, RW: -1.32,           // axle x
  WR: 0.365,                     // tire radius
  AR: 0.425,                     // arch radius
  TRACK: 0.86,                   // wheel centre |z|
  XWS: 1.02, XRG: -1.5,          // windshield base / rear glass end
};
const { XN, XT, FW, RW, WR, AR, XWS, XRG } = CAR;

// ---------- rails (half section, z >= 0): piecewise splines of x -> [y, z]
function rail(pieces) {
  // pieces: [[x0, x1, [[x, y, z], ...]], ...] with knots sorted by x
  const ps = pieces.map(([x0, x1, k]) => ({ x0, x1, ky: k.map((p) => [p[0], p[1]]), kz: k.map((p) => [p[0], p[2]]) }));
  return (x, side = 0) => {
    // side: -1 prefer the piece below a boundary, +1 above
    let p = ps.find((q) => (side < 0 ? x > q.x0 && x <= q.x1 + 1e-9 : x >= q.x0 - 1e-9 && x < q.x1)) || (x <= ps[0].x0 ? ps[0] : ps[ps.length - 1]);
    return [spline(p.ky, x), spline(p.kz, x)];
  };
}

const R = {
  R0: rail([[XT, XN, [[XT, 0.2, 0.0], [XN, 0.16, 0.0]]]]),
  R1: rail([[XT, XN, [[XT, 0.23, 0.8], [-1.9, 0.17, 0.84], [0, 0.145, 0.87], [1.9, 0.16, 0.84], [XN, 0.19, 0.8]]]]),
  R2: rail([[XT, XN, [[XT, 0.37, 0.86], [-1.9, 0.34, 0.91], [0, 0.31, 0.935], [1.9, 0.27, 0.9], [XN, 0.245, 0.86]]]]),
  R3: rail([[XT, XN, [[XT, 0.6, 0.93], [-1.75, 0.615, 1.0], [-1.3, 0.605, 1.025], [0, 0.565, 1.012], [1.3, 0.5, 0.99], [1.9, 0.44, 0.965], [XN, 0.39, 0.92]]]]),
  R4: rail([[XT, XN, [[XT, 0.83, 0.9], [-1.75, 0.875, 0.965], [-1.3, 0.895, 0.985], [-0.7, 0.835, 0.975], [0.3, 0.795, 0.968], [1.0, 0.81, 0.958], [1.36, 0.83, 0.955], [1.8, 0.71, 0.94], [XN, 0.53, 0.9]]]]),
  R5: rail([
    [XT, XRG, [[XT, 0.85, 0.66], [-1.85, 0.885, 0.7], [XRG, 0.905, 0.76]]],
    [XRG, XWS, [[XRG, 0.905, 0.76], [-0.8, 0.86, 0.785], [0.1, 0.825, 0.785], [XWS, 0.8, 0.77]]],
    [XWS, XN, [[XWS, 0.8, 0.77], [1.36, 0.77, 0.75], [1.85, 0.665, 0.72], [XN, 0.512, 0.68]]],
  ]),
  R6: rail([
    [XT, XRG, [[XT, 0.862, 0.44], [-1.85, 0.893, 0.5], [XRG, 0.915, 0.56]]],
    [XRG, XWS, [[XRG, 0.915, 0.56], [-1.15, 1.0, 0.585], [-0.6, 1.085, 0.6], [0.0, 1.09, 0.6], [0.45, 1.02, 0.595], [0.8, 0.92, 0.58], [XWS, 0.812, 0.55]]],
    [XWS, XN, [[XWS, 0.812, 0.55], [1.36, 0.775, 0.5], [1.85, 0.665, 0.46], [XN, 0.505, 0.44]]],
  ]),
  R7: rail([
    [XT, XRG, [[XT, 0.866, 0], [-1.85, 0.898, 0], [XRG, 0.93, 0]]],
    [XRG, XWS, [[XRG, 0.93, 0], [-1.15, 1.02, 0], [-0.6, 1.115, 0], [0.0, 1.12, 0], [0.45, 1.05, 0], [0.8, 0.935, 0], [XWS, 0.82, 0]]],
    [XWS, XN, [[XWS, 0.82, 0], [1.36, 0.785, 0], [1.85, 0.675, 0], [XN, 0.51, 0]]],
  ]),
};

const ARCHES = [{ x: FW, y: WR, r: AR }, { x: RW, y: WR, r: AR + 0.01 }];

function archCutY(x) {
  for (const a of ARCHES) {
    const dx = x - a.x;
    if (Math.abs(dx) < a.r) return a.y + Math.sqrt(a.r * a.r - dx * dx);
  }
  return -Infinity;
}

// x samples for a band: uniform + dense around arches, with paired columns at
// arch ends so the cut-out edge is exactly vertical there.
function samples(x0, x1, step = 0.025, arches = false) {
  const xs = new Set();
  for (let x = x0; x <= x1 + 1e-9; x += step) xs.add(+Math.min(x, x1).toFixed(5));
  xs.add(+x0.toFixed(5)); xs.add(+x1.toFixed(5));
  if (arches) for (const a of ARCHES) for (let k = 0; k <= 48; k++) {
    const x = a.x - a.r * Math.cos((k / 48) * Math.PI);
    if (x > x0 && x < x1) xs.add(+x.toFixed(5));
  }
  return [...xs].sort((a, b) => a - b);
}

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  vert(p, n, uv = [0, 0]) { this.pos.push(...p); this.nor.push(...n); this.uv.push(...uv); return this.pos.length / 3 - 1; }
  tri(a, b, c) { this.idx.push(a, b, c); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

// Ruled band between rail A (lower/outer) and rail B (upper/inner), mirrored.
function band(builder, A, B, x0, x1, { vsub = 2, arches = false, side = 0, step = 0.025 } = {}) {
  const xs = samples(x0, x1, step, arches);
  const cols = [];
  const P = (x, s, sd) => {
    const [ya, za] = A(x, sd), [yb, zb] = B(x, sd);
    return [x, ya + (yb - ya) * s, za + (zb - za) * s];
  };
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const sd = i === 0 ? 1 : i === xs.length - 1 ? -1 : 0;
    const [ya] = A(x, sd), [yb] = B(x, sd);
    let lo = 0;
    if (arches) {
      const cy = archCutY(x);
      if (cy > -Infinity) lo = clamp((cy - ya) / Math.max(1e-6, yb - ya), 0, 1.0001);
      // exact vertical edge at an arch end: add the outside column first
      for (const a of ARCHES) if (Math.abs(Math.abs(x - a.x) - a.r) < 1e-4) {
        const inside = clamp((a.y - ya) / Math.max(1e-6, yb - ya), 0, 1.0001);
        if (x < a.x) { cols.push({ x, lo: 0, sd }); lo = inside; } else { cols.push({ x, lo: inside, sd }); lo = 0; }
      }
    }
    cols.push({ x, lo, sd });
  }
  const h = 1e-3;
  const ids = cols.map((c) => {
    if (c.lo >= 0.999) return null;
    const row = [];
    for (let k = 0; k <= vsub; k++) {
      const s = c.lo + (1 - c.lo) * (k / vsub);
      const p = P(c.x, s, c.sd);
      const xa = clamp(c.x - h, x0, x1), xb = clamp(c.x + h, x0, x1);
      const pa = P(xa, s, c.sd > 0 ? 1 : c.sd < 0 ? -1 : 0), pb = P(xb, s, c.sd > 0 ? 1 : c.sd < 0 ? -1 : 0);
      const px = new THREE.Vector3(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
      const q0 = P(c.x, 0, c.sd), q1 = P(c.x, 1, c.sd);
      const ps = new THREE.Vector3(q1[0] - q0[0], q1[1] - q0[1], q1[2] - q0[2]);
      const n = px.cross(ps).normalize();
      row.push({ p, n, uv: [c.x, s] });
    }
    return row;
  });
  for (const mirror of [1, -1]) {
    const vid = ids.map((row) => row && row.map((v) => builder.vert([v.p[0], v.p[1], v.p[2] * mirror], [v.n.x, v.n.y, v.n.z * mirror], v.uv)));
    for (let i = 0; i + 1 < vid.length; i++) {
      const a = vid[i], b = vid[i + 1];
      if (!a || !b || cols[i + 1].x - cols[i].x < 1e-7) continue;
      for (let k = 0; k < vsub; k++) {
        const v00 = a[k], v10 = b[k], v11 = b[k + 1], v01 = a[k + 1];
        if (mirror > 0) { builder.tri(v00, v10, v11); builder.tri(v00, v11, v01); }
        else { builder.tri(v00, v11, v10); builder.tri(v00, v01, v11); }
      }
    }
  }
}

// end cap at x (nose or tail) through all rail points, fan-triangulated
function cap(builder, x, dir) {
  const rails = [R.R1, R.R2, R.R3, R.R4, R.R5, R.R6, R.R7];
  const sd = dir > 0 ? -1 : 1;
  const pts = rails.map((r) => r(x, sd));
  const outline = [];
  for (let i = 0; i < pts.length; i++) outline.push([pts[i][1], pts[i][0]]); // right side, bottom->top (z, y)
  for (let i = pts.length - 2; i >= 0; i--) outline.push([-pts[i][1], pts[i][0]]); // left side, top->bottom
  const n = [dir, 0, 0];
  const c = builder.vert([x, 0.42, 0], n);
  const ids = outline.map(([z, y]) => builder.vert([x, y, z], n));
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i], b = ids[(i + 1) % ids.length];
    if (dir > 0) builder.tri(c, b, a); else builder.tri(c, a, b);
  }
}

// ---------- materials
export function carMaterials(env) {
  const paint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.86, 0.86, 0.84), metalness: 0.12, roughness: 0.3,
    clearcoat: 1.0, clearcoatRoughness: 0.035, envMapIntensity: 1.15,
    iridescence: 0.12, iridescenceIOR: 1.35, iridescenceThicknessRange: [250, 500],
  });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0b0c0e, metalness: 0.0, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.12 });
  const matteBlack = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.75 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.09, 0.045, 0.02), metalness: 0.0, roughness: 0.03, envMapIntensity: 1.7, ior: 1.75,
    transparent: true, opacity: 1, depthWrite: false, side: THREE.FrontSide,
  });
  // uClarity (0..1) thins the reflections for the cabin close-ups in scene 7
  glass.userData.uniforms = { uBaseAlpha: { value: 0.4 }, uClarity: { value: 0 } };
  glass.onBeforeCompile = (sh) => {
    sh.uniforms.uBaseAlpha = glass.userData.uniforms.uBaseAlpha;
    sh.uniforms.uClarity = glass.userData.uniforms.uClarity;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjG;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjG = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uBaseAlpha, uClarity;\nvarying vec3 vObjG;')
      .replace('#include <opaque_fragment>', `
        float fres = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 4.0);
        // stylised reflection streaks so the canopy always reads as glass
        float u = vObjG.x * 0.9 + vObjG.y * 2.2;
        float st = smoothstep(0.17, 0.0, abs(u - 2.05)) * 0.55 + smoothstep(0.05, 0.0, abs(u - 2.42)) * 0.5 + smoothstep(0.1, 0.0, abs(u - 1.45)) * 0.35;
        st *= 1.0 - 0.75 * uClarity;
        float alphaG = clamp(mix(uBaseAlpha * (1.0 - 0.6 * uClarity), mix(0.96, 0.55, uClarity), fres) + st * 0.25, 0.0, 1.0);
        // premultiplied: reflections stay at full strength, background is dimmed by alpha
        vec3 bronze = vec3(0.16, 0.085, 0.035);
        gl_FragColor = vec4(outgoingLight * (1.0 - 0.6 * uClarity) + bronze * alphaG + vec3(1.0, 0.8, 0.6) * st * 0.35, alphaG);`)
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  glass.blending = THREE.CustomBlending;
  glass.blendEquation = THREE.AddEquation;
  glass.blendSrc = THREE.OneFactor;
  glass.blendDst = THREE.OneMinusSrcAlphaFactor;
  const tire = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.82 });
  const rimWhite = new THREE.MeshPhysicalMaterial({ color: 0xe6e6e3, metalness: 0.35, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.08 });
  const rimBlade = new THREE.MeshPhysicalMaterial({ color: 0x0d0e10, metalness: 0.5, roughness: 0.3, clearcoat: 0.7 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.9, roughness: 0.25 });
  const lightBar = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1.0, 0.97, 0.92), emissiveIntensity: 9 });
  const tailBar = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(1.0, 0.05, 0.03), emissiveIntensity: 5 });
  const amber = new THREE.MeshStandardMaterial({ color: 0x331500, emissive: new THREE.Color(1.0, 0.42, 0.05), emissiveIntensity: 4 });
  const nozzle = new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, metalness: 0.9, roughness: 0.28 });
  const nozzleGlow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.35, 0.7, 1.0), emissiveIntensity: 0.4 });
  const interior = new THREE.MeshStandardMaterial({ color: 0x2c2d33, roughness: 0.8 });
  const seat = new THREE.MeshStandardMaterial({ color: 0x34363e, roughness: 0.6 });
  const seatAccent = new THREE.MeshStandardMaterial({ color: 0x8a1712, roughness: 0.55 });
  const screen = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.35, 0.6, 1.0), emissiveIntensity: 1.6 });
  const fanGlow = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(0.25, 0.85, 1.0), emissiveIntensity: 0.0 });
  for (const m of [paint, black, glass, rimWhite, rimBlade, hub, nozzle]) m.envMap = env;
  return { paint, black, matteBlack, glass, tire, rimWhite, rimBlade, hub, lightBar, tailBar, amber, nozzle, nozzleGlow, interior, seat, seatAccent, screen, fanGlow };
}

// ---------- wheel
function makeWheel(M, width) {
  const g = new THREE.Group();
  // tire: lathe profile around the axle (z)
  const rIn = 0.268, rOut = WR, hw = width / 2;
  const pts = [];
  const steps = 10, corner = 0.045;
  const addArc = (cx, cy, a0, a1) => { for (let k = 0; k <= steps; k++) { const a = a0 + (a1 - a0) * (k / steps); pts.push(new THREE.Vector2(cx + corner * Math.cos(a), cy + corner * Math.sin(a))); } };
  pts.push(new THREE.Vector2(rIn, -hw * 0.92));
  pts.push(new THREE.Vector2(rIn + 0.02, -hw));
  addArc(rOut - corner, -hw + corner, -Math.PI / 2, 0);
  addArc(rOut - corner, hw - corner, 0, Math.PI / 2);
  pts.push(new THREE.Vector2(rIn + 0.02, hw));
  pts.push(new THREE.Vector2(rIn, hw * 0.92));
  const lathe = new THREE.LatheGeometry(pts, 64);
  // lathe revolves around y; rotate so the axle is z
  lathe.rotateX(Math.PI / 2);
  const tire = new THREE.Mesh(lathe, M.tire);
  g.add(tire);
  // aero disc: slightly dished white face
  const face = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.272, 0.272, 0.03, 64, 1, false), M.rimWhite);
  disc.rotation.x = Math.PI / 2; disc.position.z = hw - 0.035;
  face.add(disc);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.271, 0.012, 8, 64), M.rimWhite);
  lip.position.z = hw - 0.02; face.add(lip);
  // six dark turbine blades, swept, tapering toward the rim
  const bladeShape = new THREE.Shape();
  const r0 = 0.065, r1 = 0.262;
  const sweep = 0.55;
  const bl = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12; const r = r0 + (r1 - r0) * t; const a = sweep * t * t; const w = 0.055 * (1 - t) + 0.016; bl.push([r, a, w]); }
  bladeShape.moveTo(bl[0][0] * Math.cos(bl[0][1] + bl[0][2] / bl[0][0]), bl[0][0] * Math.sin(bl[0][1] + bl[0][2] / bl[0][0]));
  for (const [r, a, w] of bl) bladeShape.lineTo(r * Math.cos(a + w / r), r * Math.sin(a + w / r));
  for (let k = bl.length - 1; k >= 0; k--) { const [r, a, w] = bl[k]; bladeShape.lineTo(r * Math.cos(a - w / r), r * Math.sin(a - w / r)); }
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 4 });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(bladeGeo, M.rimBlade);
    b.rotation.z = (i / 6) * Math.PI * 2;
    b.position.z = hw - 0.022;
    face.add(b);
  }
  const hubRing = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, 32), M.rimBlade);
  hubRing.rotation.x = Math.PI / 2; hubRing.position.z = hw - 0.012; face.add(hubRing);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.hub);
  cap.rotation.x = Math.PI / 2; cap.position.z = hw - 0.004; cap.scale.set(1, 0.35, 1); face.add(cap);
  g.add(face);
  // inner face (mirrored, simpler)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.02, 48), M.matteBlack);
  inner.rotation.x = Math.PI / 2; inner.position.z = -hw + 0.03; g.add(inner);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function roundedBox(w, h, d, r, seg = 3) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * r * 0.6, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: seg, curveSegments: seg * 2 });
  g.translate(0, 0, -(d - 2 * r * 0.6) / 2);
  return g;
}

// thruster nozzle: small bell with a glowing throat; points along +y locally
function makeNozzle(M) {
  const g = new THREE.Group();
  const bell = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.03, -0.05), new THREE.Vector2(0.034, -0.02), new THREE.Vector2(0.04, 0.0), new THREE.Vector2(0.052, 0.02),
    new THREE.Vector2(0.06, 0.035), new THREE.Vector2(0.056, 0.038), new THREE.Vector2(0.034, 0.006), new THREE.Vector2(0.022, -0.02)], 24), M.nozzle);
  bell.castShadow = true;
  g.add(bell);
  const throat = new THREE.Mesh(new THREE.CircleGeometry(0.026, 20), M.nozzleGlow);
  throat.rotation.x = -Math.PI / 2; throat.position.y = 0.0; g.add(throat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 6, 24), M.nozzle);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.036; g.add(ring);
  return g;
}

export function makeCar(env) {
  const M = carMaterials(env);
  const root = new THREE.Group();       // placed in the world
  const body = new THREE.Group();       // suspension motion (pitch/roll/squat)
  root.add(body);

  const bPaint = new GeoBuilder(), bBlack = new GeoBuilder(), bGlass = new GeoBuilder(), bCap = new GeoBuilder();
  // side bands (arch-clipped)
  band(bBlack, R.R1, R.R2, XT, XN, { arches: true, vsub: 1 });
  band(bPaint, R.R2, R.R3, XT, XN, { arches: true, vsub: 3 });
  band(bPaint, R.R3, R.R4, XT, XN, { arches: true, vsub: 3 });
  // shoulder / hood / canopy / deck
  band(bPaint, R.R4, R.R5, XT, XN, { vsub: 2 });
  for (const [x0, x1, glass] of [[XT, XRG, false], [XRG, XWS, true], [XWS, XN, false]]) {
    band(glass ? bGlass : bPaint, R.R5, R.R6, x0, x1, { vsub: 3 });
    band(glass ? bGlass : bPaint, R.R6, R.R7, x0, x1, { vsub: 4 });
  }
  // underbody
  band(bBlack, R.R0, R.R1, XT, XN, { vsub: 1, step: 0.2 });
  cap(bCap, XN, 1);
  cap(bPaint, XT, -1);

  const paintMesh = new THREE.Mesh(bPaint.build(), M.paint);
  const blackMesh = new THREE.Mesh(bBlack.build(), M.black);
  const capMesh = new THREE.Mesh(bCap.build(), M.black);
  const glassMesh = new THREE.Mesh(bGlass.build(), M.glass);
  glassMesh.renderOrder = 10;
  for (const m of [paintMesh, blackMesh, capMesh]) { m.castShadow = true; m.receiveShadow = true; body.add(m); }
  glassMesh.castShadow = false; body.add(glassMesh);

  // roof rail + A-pillar: thin body-coloured strips framing the glass
  const railPts = [];
  for (let x = XRG + 0.02; x <= XWS - 0.02; x += 0.05) { const [y, z] = R.R6(x); railPts.push(new THREE.Vector3(x, y + 0.004, z + 0.004)); }
  for (const s of [1, -1]) {
    const c = new THREE.CatmullRomCurve3(railPts.map((p) => new THREE.Vector3(p.x, p.y, p.z * s)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(c, 80, 0.011, 6, false), M.paint);
    m.castShadow = true; body.add(m);
    // B-pillar (dark seam in the side glass)
    const bx = -0.95;
    const [y5, z5] = R.R5(bx), [y6, z6] = R.R6(bx);
    const bp = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(bx - 0.04, y5 + 0.01, z5 * s), new THREE.Vector3(bx + 0.06, y6, z6 * s)), 4, 0.012, 6), M.black);
    body.add(bp);
  }

  // door seams (thin dark grooves on the side)
  const seam = (pts) => {
    for (const s of [1, -1]) {
      const c = new THREE.CatmullRomCurve3(pts.map(([x, y]) => {
        const z = sideZ(x, y) + 0.002;
        return new THREE.Vector3(x, y, z * s);
      }));
      body.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.0045, 4), M.matteBlack));
    }
  };
  seam([[0.93, 0.79], [0.86, 0.62], [0.78, 0.45], [0.74, 0.34]]);
  seam([[-0.62, 0.84], [-0.68, 0.62], [-0.73, 0.4], [-0.75, 0.33]]);

  // front light bar (full width, wraps the corners slightly) + lower intake + splitter
  {
    const [y4] = R.R4(XN - 0.001, -1), [y5] = R.R5(XN - 0.001, -1);
    const yb = Math.min(y4, y5) - 0.035;
    const lb = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 1.66), M.lightBar);
    lb.position.set(XN + 0.008, yb, 0); body.add(lb);
    for (const s of [1, -1]) {
      const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.03), M.lightBar);
      wrap.position.set(XN - 0.055, yb, s * 0.84); wrap.rotation.y = s * 0.55; body.add(wrap);
    }
    const intake = new THREE.Mesh(roundedBox(1.25, 0.15, 0.04, 0.03), M.matteBlack);
    intake.rotation.y = Math.PI / 2; intake.position.set(XN + 0.006, 0.3, 0); body.add(intake);
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.022, 1.7), M.black);
    split.position.set(XN - 0.01, 0.135, 0); split.castShadow = true; body.add(split);
  }
  // rear light bar + diffuser + suction fan
  const fan = new THREE.Group();
  {
    const [y4] = R.R4(XT + 0.001, 1);
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.024, 1.6), M.tailBar);
    tb.position.set(XT - 0.006, y4 - 0.05, 0); body.add(tb);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 1.5), M.black);
    diff.position.set(XT + 0.12, 0.17, 0); diff.rotation.z = 0.25; body.add(diff);
    // black rear panel around the fan and the lower tail
    const panel = new THREE.Mesh(roundedBox(1.62, 0.42, 0.03, 0.05), M.black);
    panel.rotation.y = Math.PI / 2; panel.position.set(XT - 0.004, 0.43, 0); body.add(panel);
    // fan housing (round duct in the tail)
    const duct = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 12, 48), M.nozzle);
    duct.rotation.y = Math.PI / 2; duct.position.set(XT - 0.012, 0.43, 0); body.add(duct);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), M.fanGlow);
    back.rotation.y = -Math.PI / 2; back.position.set(XT + 0.02, 0.43, 0); body.add(back);
    fan.position.set(XT - 0.002, 0.43, 0);
    for (let i = 0; i < 9; i++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 0.045), M.nozzle);
      bl.position.set(0, 0.08, 0); bl.rotation.y = 0.5;
      const arm = new THREE.Group(); arm.add(bl); arm.rotation.x = (i / 9) * Math.PI * 2; fan.add(arm);
    }
    const fhub = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 8), M.hub); fan.add(fhub);
    body.add(fan);
  }
  // amber side markers behind the front wheels
  for (const s of [1, -1]) {
    const x = FW - AR - 0.07, y = 0.47;
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.022, 0.012), M.amber);
    mk.position.set(x, y, (sideZ(x, y) + 0.004) * s); mk.rotation.y = 0; body.add(mk);
  }
  // wheel well liners
  for (const a of ARCHES) for (const s of [1, -1]) {
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(a.r - 0.005, a.r - 0.005, 0.34, 32, 1, true, -Math.PI / 2, Math.PI), M.matteBlack);
    liner.rotation.x = Math.PI / 2; liner.rotation.y = 0; liner.position.set(a.x, a.y, s * 0.8);
    liner.material = M.matteBlack; liner.material.side = THREE.DoubleSide;
    body.add(liner);
  }

  // thruster nozzles: back (2), sides (2 per side), front (2)
  const nozzles = { back: [], sideR: [], sideL: [], front: [] };
  const addNozzle = (list, pos, dir) => {
    const n = makeNozzle(M);
    n.position.copy(pos);
    n.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    body.add(n);
    list.push({ obj: n, pos: pos.clone(), dir: dir.clone().normalize() });
  };
  for (const s of [1, -1]) addNozzle(nozzles.back, new THREE.Vector3(XT - 0.01, 0.27, s * 0.62), new THREE.Vector3(-1, 0, 0));
  for (const s of [1, -1]) addNozzle(nozzles.front, new THREE.Vector3(XN + 0.012, 0.215, s * 0.6), new THREE.Vector3(1, 0, 0));
  for (const x of [FW - AR - 0.2, RW + AR + 0.2]) {
    const y = 0.31;
    addNozzle(nozzles.sideR, new THREE.Vector3(x, y, sideZ(x, y) + 0.01), new THREE.Vector3(0, 0, 1));
    addNozzle(nozzles.sideL, new THREE.Vector3(x, y, -(sideZ(x, y) + 0.01)), new THREE.Vector3(0, 0, -1));
  }

  // ---------- interior (seen through the canopy)
  const cabin = new THREE.Group();
  body.add(cabin);
  // inside-facing liner so the cabin reads as a dark tub through the glass
  const linerMat = M.interior.clone(); linerMat.side = THREE.BackSide;
  const liner = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.64, 1.74), linerMat);
  liner.position.set(-0.28, 0.5, 0); cabin.add(liner);
  const dash = new THREE.Mesh(roundedBox(0.55, 0.14, 1.5, 0.06), M.interior);
  dash.position.set(0.5, 0.72, 0); dash.rotation.z = -0.22; cabin.add(dash);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), M.screen);
  scr.position.set(0.3, 0.83, 0.0); cabin.add(scr);
  scr.lookAt(scr.position.clone().add(new THREE.Vector3(-1, 0.45, 0)));
  const console_ = new THREE.Mesh(roundedBox(0.95, 0.2, 0.22, 0.06), M.interior);
  console_.position.set(-0.1, 0.36, 0); cabin.add(console_);
  const seats = [];
  for (const s of [1, -1]) {
    const seatG = new THREE.Group();
    const base = new THREE.Mesh(roundedBox(0.5, 0.11, 0.5, 0.05), M.seat); seatG.add(base);
    const back = new THREE.Mesh(roundedBox(0.12, 0.7, 0.5, 0.06), M.seat); back.position.set(-0.29, 0.33, 0); back.rotation.z = 0.36; seatG.add(back);
    const stripe = new THREE.Mesh(roundedBox(0.02, 0.56, 0.12, 0.01), M.seatAccent); stripe.position.set(-0.22, 0.33, 0); stripe.rotation.z = 0.36; seatG.add(stripe);
    for (const w of [1, -1]) {
      const bol = new THREE.Mesh(roundedBox(0.42, 0.1, 0.07, 0.03), M.seat); bol.position.set(0, 0.07, w * 0.23); seatG.add(bol);
      const wing = new THREE.Mesh(roundedBox(0.1, 0.42, 0.07, 0.03), M.seat); wing.position.set(-0.24, 0.3, w * 0.24); wing.rotation.z = 0.36; seatG.add(wing);
    }
    seatG.position.set(-0.42, 0.24, s * 0.42);
    cabin.add(seatG);
    seats.push(seatG);
  }
  // steering yoke in front of the right (driver) seat
  const yoke = new THREE.Group();
  const yk = new THREE.Mesh(roundedBox(0.035, 0.15, 0.32, 0.017), M.interior);
  yoke.add(yk);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.32, 8), M.interior); col.rotation.z = Math.PI / 2 + 0.45; col.position.set(0.15, -0.06, 0); yoke.add(col);
  yoke.position.set(0.08, 0.66, 0.42); yoke.rotation.z = -0.45;
  cabin.add(yoke);

  // cabin fill light so John reads through the tinted glass
  const cabinLight = new THREE.PointLight(0xffd2a8, 3.2, 2.4, 2);
  cabinLight.position.set(0.35, 1.0, 0.1);
  cabin.add(cabinLight);

  // wheels
  const wheels = [];
  for (const [x, w] of [[FW, 0.255], [RW, 0.295]]) for (const s of [1, -1]) {
    const pivot = new THREE.Group(); // steering
    pivot.position.set(x, WR, s * CAR.TRACK);
    const spin = makeWheel(M, w);
    if (s < 0) spin.rotation.y = Math.PI; // face outward on the left side
    const spinner = new THREE.Group(); spinner.add(spin);
    pivot.add(spinner);
    root.add(pivot);
    wheels.push({ pivot, spinner, front: x > 0, side: s });
  }

  root.traverse((o) => { if (o.isMesh && o.material !== M.glass && o.castShadow === false && o.material !== M.lightBar) { o.castShadow = true; } });
  return { root, body, cabin, wheels, nozzles, fan, M, seats, yoke, cabinLight };
}

// z of the outer body surface at (x, y) on the right side (for decals)
function sideZ(x, y) {
  const pairs = [[R.R1, R.R2], [R.R2, R.R3], [R.R3, R.R4], [R.R4, R.R5]];
  for (const [A, B] of pairs) {
    const [ya, za] = A(x), [yb, zb] = B(x);
    if (y >= ya && y <= yb) return za + (zb - za) * ((y - ya) / Math.max(1e-6, yb - ya));
  }
  return R.R3(x)[1];
}
export { sideZ, R as RAILS };
