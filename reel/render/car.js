// The 2026 Roadster, built procedurally from cross-sections to match the
// reference photos: wedge nose with a full-width light bar, long flat hood,
// huge bronze glass canopy, crisp rising shoulder crease, black sills,
// tight angular arches, white "turbine" wheels with black star spokes and a
// tall Kammback tail. No logos or badges.
//
// Car space: +x forward, +y up, +z = right side. The camera sees the LEFT
// side (-z) for most of the film, so the driver (John) and the opening door
// are on -z.
import * as THREE from 'three';
import { table, smoothTable, buildGrouped, clamp, lerp, ribbon } from './lib/util.js';

export const CAR = {
  length: 4.5, nose: 2.25, tail: -2.25,
  frontAxle: 1.0, rearAxle: -1.65,
  wheelRF: 0.365, wheelRR: 0.372, wheelZ: 0.848,
  archRF: 0.405, archRR: 0.415,
  roof: 1.175,
};

// ---------------------------------------------------------------- profile
const hoodTop = (x) => 0.545 + (0.855 - 0.545) * Math.pow(clamp((2.25 - x) / (2.25 - 0.87)), 0.95);
const canopyTop = smoothTable([[0.87, 0.855], [0.6, 0.955], [0.3, 1.06], [0.0, 1.148], [-0.3, 1.19],
  [-0.6, 1.205], [-0.9, 1.196], [-1.2, 1.16], [-1.45, 1.108]]);
const deckTop = smoothTable([[-1.45, 1.105], [-1.7, 1.055], [-2.0, 0.99], [-2.25, 0.955]]);
const yTop = (x) => (x > 0.87 ? hoodTop(x) : x >= -1.45 ? canopyTop(x) : deckTop(x));

const wRail = table([[2.25, 0.36], [1.5, 0.43], [0.87, 0.50], [0.6, 0.56], [0.2, 0.61], [-0.5, 0.625],
  [-1.0, 0.61], [-1.45, 0.565], [-1.8, 0.48], [-2.25, 0.44]]);
const dRail = table([[2.25, 0.006], [0.87, 0.006], [0.6, 0.03], [0.3, 0.04], [0.0, 0.03], [-0.5, 0.032],
  [-1.45, 0.028], [-1.6, 0.012], [-2.25, 0.008]]);

const yBeltCabin = table([[0.87, 0.85], [0.40, 0.848], [0.0, 0.868], [-0.52, 0.905],
  [-0.9, 0.99], [-1.25, 1.10], [-1.45, 1.09], [-1.8, 1.035], [-2.25, 0.962]]);
// Hood region: the belt is the hood's outer edge, a touch below the centre line.
const yBelt = (x) => (x > 0.87 ? hoodTop(x) - lerp(0.015, 0.004, (2.25 - x) / 1.38) : yBeltCabin(x));
const wBelt = table([[2.25, 0.82], [2.1, 0.87], [1.8, 0.895], [1.2, 0.905], [0.87, 0.90], [0.40, 0.866],
  [0.0, 0.836], [-0.52, 0.822], [-1.0, 0.836], [-1.25, 0.852], [-1.6, 0.89], [-1.9, 0.905], [-2.25, 0.895]]);

const yCrease = table([[2.25, 0.515], [2.0, 0.575], [1.6, 0.655], [1.0, 0.718], [0.52, 0.737], [-0.63, 0.86],
  [-1.36, 0.946], [-1.9, 0.935], [-2.25, 0.915]]);
const wCrease = table([[2.25, 0.86], [2.1, 0.95], [1.8, 0.99], [1.4, 1.005], [1.0, 1.012], [0.5, 1.0],
  [-0.3, 0.99], [-1.0, 1.0], [-1.6, 1.026], [-2.0, 1.016], [-2.25, 0.975]]);

const yPanel = table([[2.25, 0.47], [2.15, 0.43], [1.9, 0.355], [1.5, 0.325], [0.5, 0.305], [-0.5, 0.305],
  [-1.2, 0.33], [-2.0, 0.37], [-2.25, 0.40]]);
const wPanel = table([[2.25, 0.84], [2.1, 0.91], [1.8, 0.955], [1.0, 0.966], [0.0, 0.956], [-1.0, 0.96],
  [-1.6, 0.986], [-2.25, 0.946]]);
const wSill = table([[2.25, 0.78], [2.0, 0.86], [1.5, 0.90], [0.0, 0.92], [-1.5, 0.92], [-2.25, 0.86]]);
const ySill = table([[2.25, 0.2], [2.0, 0.18], [1.5, 0.17], [-1.5, 0.17], [-2.25, 0.22]]);

// Window graphics in the side view.
const A_BASE = 0.40, A_TOP = 0.0, CANOPY_FRONT = 0.87, CANOPY_END = -1.45, QUARTER_TIP = -1.25;
const RAIL_STRIP = 0.026; // thin body-coloured roof rail above the side glass

function arches() {
  return [
    { xc: CAR.frontAxle, yc: CAR.wheelRF, R: CAR.archRF },
    { xc: CAR.rearAxle, yc: CAR.wheelRR, R: CAR.archRR },
  ];
}
function archHeight(x) {
  for (const a of arches()) {
    const d = Math.abs(x - a.xc) / a.R;
    if (d <= 1) return a.yc + a.R * Math.pow(1 - Math.pow(d, 2.7), 1 / 2.7);
  }
  return -1;
}

// Half profile at station x: 10 points, bottom-centre -> side -> top-centre.
function profile(x) {
  const yt = yTop(x);
  const p9 = [x, yt, 0];
  const p8 = [x, yt - dRail(x), wRail(x)];
  const p5 = [x, yBelt(x), wBelt(x)];
  const p4 = [x, yCrease(x), wCrease(x)];
  const p3 = [x, yPanel(x), wPanel(x)];
  const p2 = [x, ySill(x), wSill(x)];
  const p1 = [x, 0.15, 0.6];
  const p0 = [x, 0.15, 0];
  let p6, p7;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  if (x > CANOPY_FRONT) { // hood: 6,7 collapse onto the hood crease
    p6 = p8.slice(); p7 = p8.slice();
  } else if (x > A_TOP) { // windshield sweeps round the corners
    p6 = p5.slice(); p7 = p8.slice();
  } else if (x > QUARTER_TIP) { // side glass + thin roof rail
    p6 = p5.slice();
    // glass top: just below the rail, closing onto the belt at the quarter-window tip
    const close = clamp((x - (-0.75)) / (QUARTER_TIP - (-0.75)));
    const top = mix(p8, p5, RAIL_STRIP / Math.max(0.05, p8[1] - p5[1]));
    p7 = mix(top, p5, Math.pow(close, 1.25));
  } else { // C-pillar and deck: no side glass
    p6 = p5.slice(); p7 = p5.slice();
  }
  const pts = [p0, p1, p2, p3, p4, p5, p6, p7, p8, p9];
  // Front: the lower face recedes under the light bar.
  if (x >= 2.249) {
    pts[3] = [2.215, 0.455, 0.83]; pts[2] = [2.16, 0.2, 0.77]; pts[1] = [2.14, 0.15, 0.6]; pts[0] = [2.14, 0.15, 0];
  }
  // Wheel arches: lift the side points up to the arch line.
  const ya = archHeight(x);
  let inArch = false;
  if (ya > 0) {
    inArch = true;
    // walk up the side polyline (points 2..5) to the arch height
    const side = [2, 3, 4, 5];
    let hit = null;
    for (let k = 0; k < side.length - 1; k++) {
      const a = pts[side[k]], b = pts[side[k + 1]];
      if (a[1] <= ya && b[1] >= ya) { const t = (ya - a[1]) / Math.max(1e-6, b[1] - a[1]); hit = mix(a, b, t); break; }
    }
    if (hit) for (const k of side) if (pts[k][1] < ya) pts[k] = hit.slice();
  }
  return { x, pts, inArch };
}

function stationList() {
  const xs = new Set();
  for (let x = 2.25; x >= -2.25 - 1e-9; x -= 0.06) xs.add(+x.toFixed(4));
  const keys = [2.25, 2.235, 2.21, 2.16, 2.1, CANOPY_FRONT, A_BASE, A_TOP, -0.52, -0.75, QUARTER_TIP, CANOPY_END,
    0.48, -0.56, -2.2, -2.24, -2.25];
  for (const k of keys) xs.add(k);
  for (const a of arches()) {
    for (let t = -1; t <= 1.0001; t += 1 / 9) xs.add(+(a.xc + a.R * t).toFixed(4));
    xs.add(+(a.xc + a.R + 0.006).toFixed(4)); xs.add(+(a.xc - a.R - 0.006).toFixed(4));
  }
  const sorted = [...xs].filter((x) => x <= 2.25 && x >= -2.25).sort((a, b) => b - a);
  const out = [];
  for (const x of sorted) if (!out.length || out[out.length - 1] - x > 0.003) out.push(x);
  return out;
}

// Materials index: 0 paint, 1 black trim, 2 glass, 3 dark (wells/underbody), 4 light bar, 5 tail light
const M = { PAINT: 0, TRIM: 1, GLASS: 2, DARK: 3, LIGHT: 4, TAIL: 5, SIDEGLASS: 6 };
const DOOR_FRONT = 0.48, DOOR_REAR = -0.56;

function bandMaterial(x0, x1, j, inArch) {
  const xm = (x0 + x1) / 2;
  switch (j) {
    case 0: return M.DARK; // floor
    case 1: return inArch ? -1 : M.DARK; // under-sill (closed by wheel wells inside arches)
    case 2: return M.TRIM; // black sill / lower front
    case 3: return M.PAINT; // lower side
    case 4: return M.PAINT; // shoulder band
    case 5: return M.PAINT; // (collapsed in the cabin)
    case 6: return xm <= A_BASE && xm > QUARTER_TIP ? M.SIDEGLASS : xm <= CANOPY_FRONT && xm > A_BASE ? M.GLASS : M.PAINT;
    case 7: return xm <= CANOPY_FRONT && xm > A_TOP ? M.GLASS : M.PAINT; // roof rail strip
    case 8: return xm <= CANOPY_FRONT && xm > CANOPY_END ? M.GLASS : M.PAINT; // windshield / roof
    default: return M.PAINT;
  }
}

// ---------------------------------------------------------------- materials
export function makeGlassMaterial(opts = {}) {
  // Bronze-tinted glass that keeps full-strength reflections while letting the
  // cabin show through (specular is not faded by opacity).
  const m = new THREE.MeshPhysicalMaterial({
    color: opts.color ?? 0x2b1a10, metalness: 0.0, roughness: opts.roughness ?? 0.16, transparent: true,
    opacity: opts.opacity ?? 0.86, envMapIntensity: opts.envMapIntensity ?? 1.4, specularIntensity: 0.8,
    side: THREE.DoubleSide, depthWrite: false,
  });
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      vec3 glassSpec = totalSpecular;
      gl_FragColor = vec4( max(outgoingLight - glassSpec, 0.0) * diffuseColor.a + glassSpec, diffuseColor.a );
    `);
  };
  m.customProgramCacheKey = () => 'roadster-glass';
  m.userData.isGlass = true;
  return m;
}

export function makeCarMaterials() {
  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xf0eee8, roughness: 0.34, metalness: 0.03, clearcoat: 1.0, clearcoatRoughness: 0.16,
    envMapIntensity: 1.0, iridescence: 0.12, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 420],
  });
  const trim = new THREE.MeshPhysicalMaterial({ color: 0x121417, roughness: 0.42, metalness: 0.1,
    clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.8 });
  const glass = makeGlassMaterial();
  const sideGlass = makeGlassMaterial({ color: 0x4a3020, opacity: 0.42, envMapIntensity: 0.7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.9, metalness: 0.0 });
  const light = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 0.97, 0.92),
    emissiveIntensity: 3.6, roughness: 0.3 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(1, 0.05, 0.03),
    emissiveIntensity: 3.0, roughness: 0.3 });
  return { paint, trim, glass, dark, light, tail, sideGlass, list: [paint, trim, glass, dark, light, tail, sideGlass] };
}

// ---------------------------------------------------------------- body
function buildBody(mats) {
  const xs = stationList();
  const st = xs.map(profile);
  const body = new Map(), door = new Map();
  const add = (buckets, m, a, b, c) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cr = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    if (cr[0] * cr[0] + cr[1] * cr[1] + cr[2] * cr[2] < 1e-12) return;
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m).push(...a, ...b, ...c);
  };
  const mir = (p) => [p[0], p[1], -p[2]];
  for (let i = 0; i < st.length - 1; i++) {
    const A = st[i].pts, B = st[i + 1].pts;
    const inArch = st[i].inArch || st[i + 1].inArch;
    const xm = (st[i].x + st[i + 1].x) / 2;
    for (let j = 0; j < A.length - 1; j++) {
      const m = bandMaterial(st[i].x, st[i + 1].x, j, inArch && st[i].inArch && st[i + 1].inArch);
      if (m < 0) continue;
      const a = A[j], b = A[j + 1], c = B[j + 1], d = B[j];
      // right side (+z)
      add(body, m, a, b, c); add(body, m, a, c, d);
      // left side (-z): the driver's door is a separate mesh so it can open
      const isDoor = xm < DOOR_FRONT && xm > DOOR_REAR && j >= 3 && j <= 6;
      const tgt = isDoor ? door : body;
      add(tgt, m, mir(a), mir(c), mir(b)); add(tgt, m, mir(a), mir(d), mir(c));
    }
  }
  // Front face (black, receding) with the light bar on its top edge.
  const f = st[0].pts;
  for (let j = 0; j < f.length - 1; j++) {
    const cen = [f[0][0], (f[0][1] + f[9][1]) / 2, 0];
    add(body, M.TRIM, cen, f[j + 1], f[j]);
    add(body, M.TRIM, cen, mir(f[j]), mir(f[j + 1]));
  }
  // Tail face: body colour, tail light and black diffuser added as overlays.
  const r = st[st.length - 1].pts;
  for (let j = 0; j < r.length - 1; j++) {
    const cen = [r[0][0], (r[0][1] + r[9][1]) / 2, 0];
    add(body, M.PAINT, cen, r[j], r[j + 1]);
    add(body, M.PAINT, cen, mir(r[j + 1]), mir(r[j]));
  }
  const bodyGeo = buildGrouped(body, 30);
  const doorGeo = buildGrouped(door, 30);
  const bodyMesh = new THREE.Mesh(bodyGeo, mats.list);
  const doorMesh = new THREE.Mesh(doorGeo, mats.list);
  // inside of the door: dark trim panel, seen only when the door is open
  const doorInner = new THREE.Mesh(doorGeo, new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.7, side: THREE.BackSide }));
  doorMesh.add(doorInner);
  return { bodyMesh, doorMesh, stations: st };
}

// Lines drawn on the body: light bar, seams, side marker, tail light.
function surfacePoint(x, frac, side = 1) {
  // A point on the outer surface at station x, `frac` along the side polyline 3..9.
  const p = profile(x).pts;
  const chain = [p[3], p[4], p[5], p[8], p[9]];
  const lens = []; let L = 0;
  for (let i = 0; i < chain.length - 1; i++) {
    const d = Math.hypot(chain[i + 1][1] - chain[i][1], chain[i + 1][2] - chain[i][2]);
    lens.push(d); L += d;
  }
  let target = frac * L;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i] || i === lens.length - 1) {
      const t = clamp(target / lens[i]);
      const a = chain[i], b = chain[i + 1];
      return new THREE.Vector3(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t) * side);
    }
    target -= lens[i];
  }
}

function lineOnProfile(x0, x1, pickY, side, n = 24) {
  // Points that follow the outer surface at the given height function (side view).
  const pts = [], nors = [];
  for (let i = 0; i <= n; i++) {
    const x = lerp(x0, x1, i / n);
    const y = pickY(x);
    const p = profile(x).pts;
    const chain = [p[2], p[3], p[4], p[5], p[7], p[8], p[9]];
    let found = null, nor = null;
    for (let k = 0; k < chain.length - 1; k++) {
      const a = chain[k], b = chain[k + 1];
      if ((a[1] - y) * (b[1] - y) <= 0 && Math.abs(b[1] - a[1]) > 1e-6) {
        const t = (y - a[1]) / (b[1] - a[1]);
        found = new THREE.Vector3(x, y, lerp(a[2], b[2], t) * side);
        nor = new THREE.Vector3(0, -(b[2] - a[2]), (b[1] - a[1])).normalize();
        nor.z *= side; if (nor.z * side < 0) nor.multiplyScalar(-1);
        break;
      }
    }
    if (found) { pts.push(found); nors.push(nor); }
  }
  return { pts, nors };
}

function buildDetails(mats, group) {
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  // Light bar: along the nose edge, kinking up the front corners ("hockey stick").
  {
    const pts = [], nors = [];
    const front = profile(2.25).pts;
    const edge = [front[4], front[5], front[8], front[9]];
    const half = [];
    for (let i = edge.length - 1; i >= 0; i--) half.push(edge[i]);
    const full = [...half.map((p) => [p[0], p[1], -p[2]]).reverse(), ...half.slice(1)];
    // sort by z
    full.sort((a, b) => a[2] - b[2]);
    for (const p of full) { pts.push(new THREE.Vector3(p[0] + 0.004, p[1] - 0.012, p[2] * 0.995)); nors.push(new THREE.Vector3(1, 0.25, 0).normalize()); }
    const bar = new THREE.Mesh(ribbon(pts, nors, 0.016, 0.002), mats.light);
    group.add(bar);
    for (const side of [1, -1]) { // corner kick-ups onto the fender
      const kp = [], kn = [];
      for (let i = 0; i <= 8; i++) {
        const x = lerp(2.235, 1.93, i / 8);
        const y = lerp(0.505, 0.585, Math.pow(i / 8, 0.8));
        const p = profile(x).pts;
        const z = lerp(p[3][2], p[4][2], clamp((y - p[3][1]) / Math.max(1e-3, p[4][1] - p[3][1]))) + 0.004;
        kp.push(new THREE.Vector3(x, y, z * side)); kn.push(new THREE.Vector3(0.3, 0.1, side).normalize());
      }
      group.add(new THREE.Mesh(ribbon(kp, kn, 0.014, 0.003), mats.light));
    }
  }
  // A-pillar and B-pillar seams on the glass (thin black lines), both sides.
  for (const side of [1, -1]) {
    const seam = (xb, yb, xt, yt) => {
      const pts = [], nors = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, x = lerp(xb, xt, t), y = lerp(yb, yt, t);
        const p = profile(x).pts;
        const a = p[5], b = p[8];
        const u = clamp((y - a[1]) / Math.max(1e-3, b[1] - a[1]));
        const z = lerp(a[2], b[2], u);
        pts.push(new THREE.Vector3(x, y, z * side));
        nors.push(new THREE.Vector3(0, b[2] - a[2], -(b[1] - a[1])).normalize().multiplyScalar(-1).setZ(side * Math.abs(b[1] - a[1])).normalize());
      }
      group.add(new THREE.Mesh(ribbon(pts, nors, 0.014, 0.004), seamMat));
    };
    seam(A_BASE, yBelt(A_BASE) + 0.004, A_TOP - 0.01, yTop(A_TOP - 0.01) - dRail(A_TOP) - 0.004);
    seam(-0.52, yBelt(-0.52) + 0.004, -0.75, yTop(-0.75) - dRail(-0.75) - RAIL_STRIP);
  }
  // Door gaps (left side) and fender gap lines.
  const gap = (x0, y0, x1, y1, side) => {
    const pts = [], nors = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
      const p = profile(x).pts;
      let z = p[4][2];
      if (y < p[4][1]) z = lerp(p[3][2], p[4][2], clamp((y - p[3][1]) / Math.max(1e-3, p[4][1] - p[3][1])));
      else z = lerp(p[4][2], p[5][2], clamp((y - p[4][1]) / Math.max(1e-3, p[5][1] - p[4][1])));
      pts.push(new THREE.Vector3(x, y, (z + 0.002) * side)); nors.push(new THREE.Vector3(0, 0, side));
    }
    return new THREE.Mesh(ribbon(pts, nors, 0.006, 0.002), seamMat);
  };
  for (const side of [1, -1]) {
    group.add(gap(0.52, yBelt(0.52) - 0.01, 0.43, yPanel(0.43) + 0.01, side));
    group.add(gap(-0.63, yBelt(-0.63) - 0.01, -0.49, yPanel(-0.49) + 0.01, side));
  }
  // Side marker (amber) just behind the front arch, below the crease.
  const markerMat = new THREE.MeshStandardMaterial({ color: 0x331000, emissive: new THREE.Color(1.0, 0.32, 0.05),
    emissiveIntensity: 1.6, roughness: 0.3 });
  for (const side of [1, -1]) {
    const l = lineOnProfile(0.62, 0.47, () => 0.69, side, 6);
    group.add(new THREE.Mesh(ribbon(l.pts, l.nors, 0.018, 0.003), markerMat));
  }
  // Tail: full-width red light bar and black diffuser with the thruster nozzles.
  {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 1.78), mats.tail);
    tl.position.set(-2.252, 0.87, 0); group.add(tl);
    const diff = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.29, 1.82), mats.trim);
    diff.position.set(-2.24, 0.31, 0); group.add(diff);
  }
  // Front splitter.
  {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.022, 1.62), mats.trim);
    sp.position.set(2.13, 0.168, 0); group.add(sp);
  }
}

// ---------------------------------------------------------------- wheels
function buildWheel(radius, width, mats) {
  const g = new THREE.Group();
  const rimR = radius * 0.73;
  // Tyre: lathe of a rounded rectangle, axis along z.
  const prof = [];
  const hw = width / 2, sidewall = radius - rimR;
  const rr = Math.min(0.045, sidewall * 0.45);
  prof.push(new THREE.Vector2(rimR, -hw * 0.92));
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(radius - rr + Math.cos(a) * rr, -hw + rr + Math.sin(a) * rr)); }
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(radius - rr + Math.cos(a) * rr, hw - rr + Math.sin(a) * rr)); }
  prof.push(new THREE.Vector2(rimR, hw * 0.92));
  const tyreGeo = new THREE.LatheGeometry(prof.map((p) => new THREE.Vector2(p.x, p.y)), 64);
  tyreGeo.rotateX(Math.PI / 2);
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.82, metalness: 0.0 });
  const tyre = new THREE.Mesh(tyreGeo, tyreMat); g.add(tyre);
  // Rim lip (gloss black) and the white aero disc.
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.012, 8, 64), mats.trim);
  lip.position.z = hw * 0.86; g.add(lip);
  const discMat = new THREE.MeshPhysicalMaterial({ color: 0xe9e9e6, roughness: 0.3, metalness: 0.35,
    clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.98, 64), discMat);
  disc.position.z = hw * 0.8; g.add(disc);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(rimR, 48), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.8 }));
  inner.position.z = -hw * 0.8; inner.rotation.y = Math.PI; g.add(inner);
  // Six black star spokes, slightly swept, tapering to points at the rim.
  const spokeMat = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0d, roughness: 0.25, metalness: 0.5,
    clearcoat: 1.0, clearcoatRoughness: 0.08 });
  for (let k = 0; k < 6; k++) {
    const s = new THREE.Shape();
    const pt = (r, a) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
    const a0 = (k / 6) * Math.PI * 2;
    // Kite-shaped arm: wide at the hub, swept, tapering to a point at the rim.
    const P = [pt(rimR * 0.2, a0 - 0.36), pt(rimR * 0.5, a0 + 0.02 - 0.16), pt(rimR * 0.985, a0 + 0.22 - 0.015),
      pt(rimR * 0.985, a0 + 0.22 + 0.03), pt(rimR * 0.5, a0 + 0.08 + 0.14), pt(rimR * 0.2, a0 + 0.36)];
    s.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) s.lineTo(P[i].x, P[i].y); s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 2 });
    const m = new THREE.Mesh(geo, spokeMat);
    m.position.z = hw * 0.8; g.add(m);
  }
  // Hub with a small chrome cap (no logo).
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.24, rimR * 0.27, 0.05, 32), spokeMat);
  hub.rotation.x = Math.PI / 2; hub.position.z = hw * 0.82; g.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(rimR * 0.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd8d8d8, metalness: 1.0, roughness: 0.15 }));
  cap.rotation.x = Math.PI / 2; cap.position.z = hw * 0.85 + 0.02; g.add(cap);
  return g;
}

function buildWheelWell(a, side, mats) {
  // Dark half-tub around the wheel so the arch never shows the void.
  const geo = new THREE.CylinderGeometry(a.R + 0.015, a.R + 0.015, 0.42, 32, 1, true, -Math.PI * 0.05, Math.PI * 1.1);
  geo.rotateX(Math.PI / 2);
  geo.rotateZ(-Math.PI * 0.5);
  const m = new THREE.Mesh(geo, mats.dark);
  m.material = mats.dark;
  m.position.set(a.xc, a.yc, side * 0.79);
  return m;
}

// ---------------------------------------------------------------- interior
function buildInterior(mats) {
  const g = new THREE.Group();
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.7 });
  const tub = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 1.5), mats.dark);
  tub.position.set(-0.35, 0.42, 0); g.add(tub);
  for (const z of [-0.38, 0.38]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.5), seatMat);
    base.position.set(-0.28, 0.48, z); g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.5), seatMat);
    back.position.set(-0.58, 0.78, z); back.rotation.z = -0.42; g.add(back);
  }
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 1.5), seatMat);
  dash.position.set(0.5, 0.7, 0); dash.rotation.z = 0.25; g.add(dash);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.13), new THREE.MeshStandardMaterial({
    color: 0x000000, emissive: new THREE.Color(0.35, 0.6, 1.0), emissiveIntensity: 0.6 }));
  screen.position.set(0.36, 0.79, 0); screen.rotation.y = -Math.PI / 2; screen.rotation.x = 0; screen.rotation.z = 0;
  screen.rotateX(-0.2);
  g.add(screen);
  // Steering yoke in front of John.
  const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 24, Math.PI * 1.25), seatMat);
  yoke.position.set(0.22, 0.72, -0.38); yoke.rotation.y = Math.PI / 2; yoke.rotation.z = Math.PI * 1.375;
  g.add(yoke);
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.18), seatMat);
  console_.position.set(0.0, 0.5, 0); g.add(console_);
  return g;
}

// ---------------------------------------------------------------- thrusters
function buildThrusters(mats) {
  const g = new THREE.Group();
  const nozzleMat = new THREE.MeshPhysicalMaterial({ color: 0x6d6f73, metalness: 1.0, roughness: 0.32 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0x050608, emissive: new THREE.Color(0.4, 0.75, 1.0),
    emissiveIntensity: 0.0, roughness: 0.6 });
  const nozzles = [];
  const prof = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push(new THREE.Vector2(0.022 + 0.032 * t * t, t * 0.075)); }
  const bell = new THREE.LatheGeometry(prof, 28);
  bell.rotateZ(Math.PI / 2); // axis along -x
  for (const z of [-0.6, -0.25, 0.25, 0.6]) {
    const n = new THREE.Group();
    const outer = new THREE.Mesh(bell, nozzleMat); n.add(outer);
    const throat = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), innerMat);
    throat.rotation.y = -Math.PI / 2; throat.position.x = -0.02; n.add(throat);
    n.position.set(-2.27, 0.31, z);
    g.add(n);
    nozzles.push({ group: n, exit: new THREE.Vector3(-2.345, 0.31, z) });
  }
  return { group: g, nozzles, innerMat };
}

// ---------------------------------------------------------------- assemble
export function buildCar() {
  const mats = makeCarMaterials();
  const root = new THREE.Group(); root.name = 'roadster';
  const { bodyMesh, doorMesh } = buildBody(mats);
  root.add(bodyMesh);
  // Door hinged at its front top so it can swing up (scissor style).
  const hinge = new THREE.Vector3(DOOR_FRONT - 0.02, 0.86, -0.86);
  const doorPivot = new THREE.Group();
  doorPivot.position.copy(hinge);
  doorMesh.position.copy(hinge).multiplyScalar(-1);
  doorPivot.add(doorMesh);
  root.add(doorPivot);
  const details = new THREE.Group(); buildDetails(mats, details); root.add(details);
  // Wheels.
  const wheels = [];
  for (const [x, r, w] of [[CAR.frontAxle, CAR.wheelRF, 0.255], [CAR.rearAxle, CAR.wheelRR, 0.3]]) {
    for (const side of [1, -1]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, r, side * CAR.wheelZ);
      const wheel = buildWheel(r, w, mats);
      if (side < 0) wheel.rotation.y = Math.PI; // face outward
      const spin = new THREE.Group(); spin.add(wheel); pivot.add(spin);
      root.add(pivot);
      wheels.push({ pivot, spin, side, x, r });
    }
  }
  for (const a of arches()) for (const side of [1, -1]) root.add(buildWheelWell(a, side, mats));
  const interior = buildInterior(mats); root.add(interior);
  // soft cabin light so John reads through the tinted glass
  const cabinLight = new THREE.PointLight(0xffe2c4, 1.8, 2.4, 1.4);
  cabinLight.position.set(0.1, 1.0, -0.55); root.add(cabinLight);
  const thrusters = buildThrusters(mats); root.add(thrusters.group);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  bodyMesh.castShadow = true;
  return {
    root, mats, doorPivot, wheels, interior, thrusters, cabinLight,
    anchors: {
      nose: new THREE.Vector3(CAR.nose, 0.42, 0),
      johnSeat: new THREE.Vector3(-0.3, 0.52, -0.38),
      dash: new THREE.Vector3(0.42, 0.86, -0.18),
      tail: new THREE.Vector3(CAR.tail, 0.6, 0),
    },
    setWheelSpin(angle) { for (const w of wheels) w.spin.rotation.z = -angle * (w.side > 0 ? 1 : 1); },
    setDoorOpen(t) { // 0 closed .. 1 fully up
      doorPivot.rotation.set(0.22 * t, 0, -1.55 * t); // scissor door, swings up to vertical
    },
  };
}

// Offset copy of the painted body for the silver heat shield.
export function shieldGeometry() {
  const xs = stationList();
  const st = xs.map(profile);
  const buckets = new Map([[0, []]]);
  const arr = buckets.get(0);
  const push = (a, b, c) => arr.push(...a, ...b, ...c);
  const mir = (p) => [p[0], p[1], -p[2]];
  for (let i = 0; i < st.length - 1; i++) {
    const A = st[i].pts, B = st[i + 1].pts;
    for (let j = 2; j < A.length - 1; j++) {
      const m = bandMaterial(st[i].x, st[i + 1].x, j, st[i].inArch && st[i + 1].inArch);
      if (m === M.GLASS || m === M.SIDEGLASS || m < 0) continue;
      const a = A[j], b = A[j + 1], c = B[j + 1], d = B[j];
      push(a, b, c); push(a, c, d);
      push(mir(a), mir(c), mir(b)); push(mir(a), mir(d), mir(c));
    }
  }
  const geo = buildGrouped(buckets, 35);
  // Push out along normals so it wraps just over the paint.
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) + nor.getX(i) * 0.03, pos.getY(i) + nor.getY(i) * 0.03, pos.getZ(i) + nor.getZ(i) * 0.03);
  }
  geo.computeBoundingSphere();
  return geo;
}

export { profile as carProfile, yTop as carTop };
