// The new Roadster, built to match the reference photos: low faceted wedge, full-width
// front light bar, bronze glass canopy (windshield + roof + side glass), sharp shoulder
// crease linking angular wheel arches, gloss-black sills, silver aero wheels with six
// black blades, red rear light bar. No logos or badges.
// Extra: SpaceX-style cold-gas thruster nozzles (rear, sides, underside) and a suction fan.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GB, merge, xf } from './geo.js';
import { wheelFaceTex } from './tex.js';
import { WHEEL_POS, WHEEL_N } from './john.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Monotone cubic (Fritsch-Carlson) interpolation of y(x), z(x) through keyed points.
function curve(keys) {
  const k = keys.slice().sort((a, b) => a[0] - b[0]);
  const xs = k.map((p) => p[0]);
  const comp = (ci) => {
    const ys = k.map((p) => p[ci]); const n = ys.length;
    const d = []; const m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return (x) => {
      if (x <= xs[0]) return ys[0]; if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (xs[i + 1] < x) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  };
  return { front: k[k.length - 1][0], rear: k[0][0], y: comp(1), z: comp(2) };
}

// ---- feature lines of the right half (z >= 0); x forward (+2.24 nose .. -2.24 tail) ----
export const CAR = { length: 4.48, width: 1.97, height: 1.16, wheelR: 0.37, wheelBase: [1.42, -1.45], track: 0.84, com: 0.55 };
const LINES = {
  keel:  [[2.02, 0.14, 0], [0, 0.13, 0], [-2.10, 0.15, 0]],
  sillB: [[2.07, 0.16, 0.70], [1.95, 0.155, 0.80], [1.8, 0.15, 0.82], [0, 0.145, 0.835], [-1.8, 0.15, 0.82], [-2.13, 0.17, 0.76]],
  sillT: [[2.14, 0.25, 0.77], [2.02, 0.26, 0.86], [1.85, 0.27, 0.875], [0, 0.30, 0.885], [-1.85, 0.30, 0.875], [-2.0, 0.31, 0.865], [-2.19, 0.34, 0.80]],
  crease:[[2.22, 0.50, 0.88], [2.05, 0.62, 0.955], [1.80, 0.765, 0.98], [1.42, 0.785, 0.985], [0.0, 0.79, 0.985], [-1.45, 0.805, 0.985], [-1.95, 0.81, 0.975], [-2.24, 0.80, 0.90]],
  belt:  [[2.24, 0.52, 0.80], [2.0, 0.62, 0.83], [1.8, 0.745, 0.85], [1.6, 0.788, 0.855], [1.2, 0.795, 0.855], [0.95, 0.80, 0.855], [0.4, 0.82, 0.855], [-0.6, 0.85, 0.85], [-1.5, 0.885, 0.83], [-1.98, 0.905, 0.80], [-2.235, 0.87, 0.74]],
  winTop:[[2.24, 0.53, 0.55], [1.8, 0.72, 0.63], [1.6, 0.762, 0.68], [1.2, 0.785, 0.77], [0.95, 0.806, 0.845], [0.6, 0.93, 0.765], [0.25, 1.04, 0.695], [-0.05, 1.105, 0.66], [-0.6, 1.13, 0.648], [-1.2, 1.105, 0.655], [-1.6, 1.035, 0.69], [-1.85, 0.965, 0.75], [-1.98, 0.915, 0.80], [-2.23, 0.875, 0.738]],
  rail:  [[2.24, 0.535, 0.45], [1.8, 0.722, 0.53], [1.6, 0.765, 0.575], [1.2, 0.787, 0.67], [0.95, 0.805, 0.75], [0.6, 0.928, 0.705], [0.25, 1.037, 0.648], [-0.05, 1.107, 0.613], [-0.6, 1.134, 0.602], [-1.2, 1.114, 0.597], [-1.6, 1.05, 0.58], [-1.95, 0.965, 0.55], [-2.225, 0.885, 0.50]],
  top:   [[2.24, 0.545, 0], [1.8, 0.726, 0], [1.6, 0.768, 0], [1.2, 0.79, 0], [0.95, 0.806, 0], [0.6, 0.936, 0], [0.25, 1.05, 0], [-0.05, 1.125, 0], [-0.5, 1.158, 0], [-1.2, 1.14, 0], [-1.6, 1.07, 0], [-1.95, 0.985, 0], [-2.22, 0.895, 0]],
};
const ORDER = ['keel', 'sillB', 'sillT', 'crease', 'belt', 'winTop', 'rail', 'top'];
// material of the strip between ORDER[i] and ORDER[i+1] at longitudinal position x
function stripMat(i, x) {
  if (i === 0) return 'under';
  if (i === 1) return 'trim';
  if (i === 4) return x < 0.95 && x > -1.98 ? 'glass' : 'paint';
  if (i === 6) return x < 0.95 && x > -2.08 ? 'glass' : 'paint';
  return 'paint';
}
function archY(x) {
  let y = -1;
  for (const xc of CAR.wheelBase) {
    const dx = Math.abs(x - xc);
    let a = -1;
    if (dx <= 0.35) a = 0.775; else if (dx < 0.58) a = 0.775 + (0.30 - 0.775) * ((dx - 0.35) / 0.23);
    y = Math.max(y, a);
  }
  return y;
}

function buildBodyGeometry() {
  const curves = Object.fromEntries(Object.entries(LINES).map(([k, v]) => [k, curve(v)]));
  const NS = 180;
  // sample stations
  const pts = ORDER.map((name, li) => {
    const c = curves[name];
    const arr = [];
    for (let s = 0; s < NS; s++) {
      const u = s / (NS - 1);
      const x = c.front + (c.rear - c.front) * u;
      let y = c.y(x); const z = c.z(x);
      if (li <= 2) { const ay = li === 0 ? Math.min(archY(x), 0.42) : archY(x); if (ay > y) y = ay; }
      arr.push(V(x, y, z));
    }
    return arr;
  });
  const builders = { paint: new GB(), glass: new GB(), trim: new GB(), under: new GB() };
  for (const side of [1, -1]) {
    for (let li = 0; li < ORDER.length - 1; li++) {
      const A = pts[li], Bp = pts[li + 1];
      // per-strip smooth normals along x
      const P = (arr, s) => V(arr[s].x, arr[s].y, arr[s].z * side);
      const faceN = [];
      for (let s = 0; s < NS - 1; s++) {
        const a = P(A, s), b = P(A, s + 1), c = P(Bp, s + 1), d = P(Bp, s);
        const n = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(d, b));
        const mid = a.clone().add(b).add(c).add(d).multiplyScalar(0.25);
        const out = V(mid.x - Math.max(-1.6, Math.min(1.6, mid.x)), mid.y - 0.45, mid.z); if (n.dot(out) < 0) n.negate();
        faceN.push(n.lengthSq() > 1e-12 ? n.normalize() : out.normalize());
      }
      const vn = (s) => { const n = new THREE.Vector3(); if (s > 0) n.add(faceN[s - 1]); if (s < NS - 1) n.add(faceN[s]); return n.normalize(); };
      for (let s = 0; s < NS - 1; s++) {
        const a = P(A, s), b = P(A, s + 1), c = P(Bp, s + 1), d = P(Bp, s);
        const xm = (a.x + b.x) / 2;
        const gb = builders[stripMat(li, xm)];
        const na = vn(s), nb = vn(s + 1);
        const ua = [a.x, a.y], ub = [b.x, b.y], uc = [c.x, c.y], ud = [d.x, d.y];
        // orientation: make triangle winding agree with outward normal
        const geomN = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
        const flip = geomN.dot(faceN[s]) < 0;
        const tri = (p, q, r, np, nq, nr, up, uq, ur) => { if (flip) { gb.vert(p, np, up); gb.vert(r, nr, ur); gb.vert(q, nq, uq); } else { gb.vert(p, np, up); gb.vert(q, nq, uq); gb.vert(r, nr, ur); } };
        tri(a, b, c, na, nb, nb, ua, ub, uc);
        tri(a, c, d, na, nb, na, ua, uc, ud);
      }
    }
  }
  // end caps (front fascia and tail) split horizontally into paint (upper) and trim (lower)
  const cap = (s, splitY, face) => {
    const ring = [];
    for (let li = 0; li < ORDER.length; li++) ring.push(pts[li][s].clone());
    for (let li = ORDER.length - 1; li >= 0; li--) { const p = pts[li][s].clone(); p.z = -p.z; ring.push(p); }
    const clip = (poly, keepAbove) => {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const pin = keepAbove ? p.y >= splitY : p.y < splitY, qin = keepAbove ? q.y >= splitY : q.y < splitY;
        if (pin) out.push(p);
        if (pin !== qin) { const t = (splitY - p.y) / (q.y - p.y); out.push(p.clone().lerp(q, t)); }
      }
      return out;
    };
    for (const [keep, mat] of [[true, 'paint'], [false, 'trim']]) {
      const poly = clip(ring, keep);
      if (poly.length < 3) continue;
      const tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p.z, p.y)), []);
      for (const t of tris) builders[mat].tri(poly[t[0]], poly[t[1]], poly[t[2]], [poly[t[0]].z, poly[t[0]].y], [poly[t[1]].z, poly[t[1]].y], [poly[t[2]].z, poly[t[2]].y], face);
    }
  };
  cap(0, 0.60, V(1, 0, 0));
  cap(NS - 1, 0.50, V(-1, 0, 0));
  const geos = {};
  for (const [k, gb] of Object.entries(builders)) geos[k] = gb.build();
  return { geos, pts, curves };
}

// ---------- materials ----------
function paintMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.87, 0.87, 0.86), roughness: 0.3, metalness: 0.08,
    clearcoat: 1.0, clearcoatRoughness: 0.045, envMapIntensity: 1.05, side: THREE.DoubleSide,
  });
  m.userData.uniforms = { uDirt: { value: 0 }, uShine: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocalP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocalP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLocalP; uniform float uDirt; uniform float uShine;
      float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float vn3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h3(i+vec3(0,0,0)),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      float sootN = vn3(vLocalP * vec3(1.6, 9.0, 1.6)) * 0.55 + vn3(vLocalP * vec3(6.0, 22.0, 6.0)) * 0.45;
      float sootG = smoothstep(1.05, 0.2, vLocalP.y) * 0.75 + smoothstep(-1.2, -2.3, vLocalP.x) * 0.35;
      float soot = uDirt * clamp(sootG * (0.55 + 0.6 * sootN), 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.16, 0.135, 0.12), soot * 0.85);
      if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.035);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(roughnessFactor, 0.85, soot);`)
      .replace('#include <clearcoat_normal_fragment_begin>', `#include <clearcoat_normal_fragment_begin>`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      material.clearcoat *= (1.0 - soot) * (gl_FrontFacing ? 1.0 : 0.0);`)
      .replace('#include <opaque_fragment>', `outgoingLight *= 1.0 + uShine * 0.25;\n#include <opaque_fragment>`);
  };
  return m;
}

function glassMaterial() {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.30, 0.19, 0.11), roughness: 0.03, metalness: 0.0, transparent: true,
    envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1.0, ior: 1.5,
  });
  m.userData.uniforms = { uMinA: { value: 0.22 }, uMaxA: { value: 0.72 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.uniforms);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uMinA; uniform float uMaxA;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float fr = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.0);
        gl_FragColor.a = mix(uMinA, uMaxA, fr);
        gl_FragColor.rgb = outgoingLight;`);
  };
  return m;
}

export function buildRoadster(ctx) {
  const root = new THREE.Group();          // world transform (origin = centre of mass)
  const body = new THREE.Group();          // car local frame: ground at y=0
  body.position.y = -CAR.com;
  root.add(body);

  const { geos, curves } = buildBodyGeometry();
  const mats = {
    paint: paintMaterial(),
    glass: glassMaterial(),
    trim: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.018, 0.018, 0.02), roughness: 0.22, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.08, side: THREE.DoubleSide }),
    under: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.012, 0.012, 0.013), roughness: 0.85, side: THREE.DoubleSide }),
    interior: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.06, 0.065), roughness: 0.75 }),
    interiorLight: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.68, 0.64), roughness: 0.5 }),
    lightBar: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.97, 0.94).multiplyScalar(16) }),
    tailBar: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.03, 0.02).multiplyScalar(9) }),
    amber: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.35, 0.02).multiplyScalar(6) }),
    tire: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.035, 0.038), roughness: 0.62 }),
    wheelFace: new THREE.MeshPhysicalMaterial({ map: wheelFaceTex(), roughness: 0.28, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
    titanium: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.43, 0.47), roughness: 0.28, metalness: 1.0 }),
    nozzleGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.0), toneMapped: false }),
    fanGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.9, 1.0) }),
  };
  const addMesh = (geo, mat, cast = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; body.add(m); return m; };
  addMesh(geos.paint, mats.paint);
  addMesh(geos.trim, mats.trim);
  addMesh(geos.under, mats.under);
  const glassMesh = addMesh(geos.glass, mats.glass, false);
  glassMesh.renderOrder = 5;

  // front light bar following the nose edge, and red tail bar
  {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const z = -0.86 + (1.72 * i) / 24;
      const az = Math.abs(z);
      const x = 2.238 - Math.pow(az / 0.88, 6) * 0.05;
      const y = 0.508 + 0.02 * (1 - Math.pow(az / 0.88, 2));
      pts.push(V(x, y, z));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.011, 6, false);
    addMesh(tube, mats.lightBar, false);
    const tpts = [];
    for (let i = 0; i <= 16; i++) { const z = -0.74 + (1.48 * i) / 16; tpts.push(V(-2.236 + Math.pow(Math.abs(z) / 0.74, 4) * 0.01, 0.80, z)); }
    addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tpts), 32, 0.016, 6, false), mats.tailBar, false);
    // amber side markers on the front fenders (just behind the arch, on the crease)
    for (const s of [1, -1]) {
      const m = addMesh(new RoundedBoxGeometry(0.16, 0.022, 0.02, 2, 0.008), mats.amber, false);
      m.position.set(0.86, 0.79, 0.987 * s);
    }
  }

  // wheel well liners (half shells over each wheel, block see-through under the arches)
  for (const xc of CAR.wheelBase) {
    for (const sd of [1, -1]) {
      const g = new THREE.CylinderGeometry(0.395, 0.395, 0.29, 24, 1, true, Math.PI / 2, Math.PI);
      g.rotateX(Math.PI / 2);
      const m = addMesh(g, mats.under, false);
      m.position.set(xc, 0.37, 0.84 * sd);
    }
  }

  // wheels
  const wheels = [];
  const tireProfile = [];
  { const r0 = 0.262, r1 = CAR.wheelR, w = 0.128, c = 0.055;
    const pts = [[r0, -w], [r1 - c, -w], [r1 - c * 0.3, -w + c * 0.3], [r1, -w + c], [r1, w - c], [r1 - c * 0.3, w - c * 0.3], [r1 - c, w], [r0, w]];
    for (const [r, y] of pts) tireProfile.push(new THREE.Vector2(r, y)); }
  const tireGeo = new THREE.LatheGeometry(tireProfile, 48); tireGeo.rotateX(Math.PI / 2);
  const faceGeo = new THREE.CircleGeometry(0.30, 48);
  const barrel = new THREE.CylinderGeometry(0.262, 0.262, 0.2, 32, 1, true); barrel.rotateX(Math.PI / 2);
  for (const xc of CAR.wheelBase) {
    for (const s of [1, -1]) {
      const pivot = new THREE.Group();   // suspension / steering pivot
      pivot.position.set(xc, CAR.wheelR, CAR.track * s);
      const spin = new THREE.Group();
      pivot.add(spin);
      const t = new THREE.Mesh(tireGeo, mats.tire); t.castShadow = true; t.receiveShadow = true; spin.add(t);
      const f = new THREE.Mesh(faceGeo, mats.wheelFace); f.position.z = 0.112 * s; if (s < 0) f.rotation.y = Math.PI; spin.add(f);
      const bm = new THREE.Mesh(barrel, mats.under); spin.add(bm);
      body.add(pivot);
      wheels.push({ pivot, spin, x: xc, side: s, baseY: CAR.wheelR });
    }
  }

  // interior: central driving seat (McLaren-F1 style), dash, steering wheel
  const interior = new THREE.Group(); body.add(interior);
  {
    const im = mats.interior;
    const parts = [
      [new RoundedBoxGeometry(0.62, 0.14, 0.62, 3, 0.05), [-0.22, 0.36, 0], [0, 0, 0]],
      [new RoundedBoxGeometry(0.16, 0.66, 0.6, 3, 0.06), [-0.55, 0.66, 0], [0, 0, -0.32]],
      [new RoundedBoxGeometry(0.5, 0.16, 1.5, 3, 0.06), [0.66, 0.64, 0], [0, 0, -0.35]],
      [new RoundedBoxGeometry(1.1, 0.4, 1.66, 2, 0.05), [0.4, 0.3, 0], [0, 0, 0]],
      [new RoundedBoxGeometry(0.9, 0.36, 1.5, 2, 0.05), [-1.45, 0.5, 0], [0, 0, 0]],
      [new RoundedBoxGeometry(3.8, 0.12, 1.66, 2, 0.04), [0.0, 0.2, 0], [0, 0, 0]],
    ];
    for (const [g, p, r] of parts) { const m = new THREE.Mesh(g, im); m.position.set(...p); m.rotation.set(...r); m.receiveShadow = true; interior.add(m); }
    // side seats (passenger pods) left & right of the driver
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.5, 0.42, 3, 0.06), im); m.position.set(-0.35, 0.5, 0.55 * s); interior.add(m);
    }
    // steering wheel facing the driver
    const swN = WHEEL_N.clone();
    const swQ = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), swN);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 28), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.5 }));
    sw.position.copy(WHEEL_POS); sw.quaternion.copy(swQ);
    const swHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 14), mats.interior);
    swHub.quaternion.setFromUnitVectors(V(0, 1, 0), swN); swHub.position.copy(sw.position);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.3, 8), mats.interior);
    column.quaternion.setFromUnitVectors(V(0, 1, 0), swN); column.position.copy(sw.position).addScaledVector(swN, -0.15);
    interior.add(sw, swHub, column);
    interior.userData.steering = sw;
    // dashboard screen glow
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.55, 1.0).multiplyScalar(1.6) }));
    scr.position.set(0.5, 0.79, 0.0); scr.rotation.y = -Math.PI / 2; scr.rotateX(-0.6); interior.add(scr);
  }

  // ---- thruster nozzles ----
  const bell = (() => {
    const p = [];
    const N = 12;
    for (let i = 0; i <= N; i++) { const t = i / N; p.push(new THREE.Vector2(0.028 + 0.05 * Math.pow(t, 1.6), t * 0.15)); }
    for (let i = N; i >= 0; i--) { const t = i / N; p.push(new THREE.Vector2(0.034 + 0.05 * Math.pow(t, 1.6) + 0.006, t * 0.15)); }
    return new THREE.LatheGeometry(p, 20);
  })();
  const glowRing = new THREE.CircleGeometry(0.07, 20); glowRing.rotateX(-Math.PI / 2); glowRing.translate(0, 0.02, 0);
  const nozzleMat = mats.titanium;
  const makeNozzle = (pos, dirLocal, scale = 1) => {
    const g = new THREE.Group();
    g.position.copy(pos);
    const aim = new THREE.Group(); g.add(aim);
    const m = new THREE.Mesh(bell, nozzleMat); m.castShadow = true; m.scale.setScalar(scale); aim.add(m);
    const glow = new THREE.Mesh(glowRing, mats.nozzleGlow.clone()); glow.scale.setScalar(scale); glow.material.color.setRGB(0, 0, 0); aim.add(glow);
    // default exhaust along +Y of aim; orient to dirLocal
    aim.quaternion.setFromUnitVectors(V(0, 1, 0), dirLocal.clone().normalize());
    body.add(g);
    return { group: g, aim, glow, dir: dirLocal.clone().normalize(), scale, exit: V(0, 0.15 * scale, 0) };
  };
  const nozzles = {
    rear: [makeNozzle(V(-2.20, 0.40, 0.42), V(-1, 0, 0), 1.25), makeNozzle(V(-2.20, 0.40, -0.42), V(-1, 0, 0), 1.25)],
    side: [makeNozzle(V(0.62, 0.23, 0.86), V(0, 0, 1), 0.55), makeNozzle(V(-0.70, 0.23, 0.86), V(0, 0, 1), 0.55),
           makeNozzle(V(0.62, 0.23, -0.86), V(0, 0, -1), 0.55), makeNozzle(V(-0.70, 0.23, -0.86), V(0, 0, -1), 0.55)],
    under: [makeNozzle(V(0.78, 0.235, 0.48), V(0, -1, 0), 0.7), makeNozzle(V(0.78, 0.235, -0.48), V(0, -1, 0), 0.7),
            makeNozzle(V(-0.88, 0.235, 0.48), V(0, -1, 0), 0.7), makeNozzle(V(-0.88, 0.235, -0.48), V(0, -1, 0), 0.7)],
  };
  // rear nozzle tilt helper: angle (radians) below horizontal, exhaust pointing down-back
  const setRearTilt = (a) => {
    for (const n of nozzles.rear) {
      const d = V(-Math.cos(a), -Math.sin(a), 0);
      n.dir.copy(d);
      n.aim.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    }
  };

  // ---- suction fan (rear, in the black diffuser) ----
  const fan = new THREE.Group();
  fan.position.set(-2.16, 0.31, 0);
  {
    const duct = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 10, 32), mats.titanium); duct.rotation.y = Math.PI / 2; fan.add(duct);
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), mats.under); back.rotation.y = -Math.PI / 2; back.position.x = 0.03; fan.add(back);
    const blades = new THREE.Group(); fan.add(blades);
    for (let i = 0; i < 7; i++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.15, 0.045), mats.titanium);
      const a = (i / 7) * Math.PI * 2;
      bl.position.set(-0.01, Math.cos(a) * 0.085, Math.sin(a) * 0.085); bl.rotation.x = -a; bl.rotateY(0.5);
      blades.add(bl);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mats.titanium); hub.position.x = -0.01; blades.add(hub);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.006, 6, 40), mats.fanGlow.clone()); ring.rotation.y = Math.PI / 2; ring.position.x = -0.01; fan.add(ring);
    fan.userData = { blades, ring };
    ring.material.color.setRGB(0, 0, 0);
  }
  body.add(fan);

  return { root, body, wheels, nozzles, setRearTilt, fan, mats, interior, curves, glassMesh };
}
