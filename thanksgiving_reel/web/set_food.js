// Food, tableware and holdable props for set.js only. All geometry is low-poly + deterministic.
// Conventions: every builder returns a THREE.Group whose origin is the BOTTOM CENTRE of the object
// (so it can be placed directly at a surface height). Long tools (forks, spoons) lie along local +Z
// (handle at -Z, working end at +Z) with their underside at local y = 0.
import * as THREE from 'three';
import { rng, mesh, lowSphere, hash1, lerp, clamp, loftGeometry, chamferBox, mat } from './lib.js';
import { V, latheGeo, bandTex, polarDisc, leafGeo, flatten } from './set_util.js';

// position-hash in [0,1) (identical for duplicated seam vertices -> no cracks)
export const pn = (x, y, z, s = 0) => hash1(Math.round(x * 4001) * 0.013 + Math.round(y * 3989) * 0.071 + Math.round(z * 3967) * 0.137 + s * 1.7);

// ---------------------------------------------------------------- shared heights
export const H = {
  top: 0.76,           // cloth top surface
  runner: 0.0022,      // runner thickness above the cloth
  charger: 0.0035,     // charger plate top (local)
  plateWell: 0.007,    // plate well floor above plate base
};
H.plateY = H.top + 0.0005 + H.charger;   // plate base (sits on the charger)
H.foodY = H.plateY + H.plateWell;         // food on a plate sits here

// ---------------------------------------------------------------- generic shapes
export function moundGeo(r, h, seed = 1, w = 12, hs = 6, rough = 0.12, peak = 0.18, thetaLen = Math.PI / 2) {
  const g = new THREE.SphereGeometry(1, w, hs, 0, Math.PI * 2, 0, thetaLen);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = y < 0.02 ? 1 : 1 + (pn(x, y, z, seed) - 0.5) * rough * 2;
    const yy = y > 0.98 ? y * (1 + peak) : y * k;
    p.setXYZ(i, x * r * k, Math.max(0, yy) * h, z * r * k);
  }
  g.computeVertexNormals();
  return g;
}

export function pumpkinGeo(r, seed = 1, ribs = 8) {
  const g = new THREE.SphereGeometry(1, ribs * 2, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 - 0.09 * (0.5 - 0.5 * Math.cos(a * ribs)) + (pn(x, y, z, seed) - 0.5) * 0.04;
    x *= k; z *= k; y *= 0.68;
    if (Math.abs(p.getY(i)) > 0.99) y *= 0.72;          // dimples at the poles
    p.setXYZ(i, x * r, y * r, z * r);
  }
  g.computeBoundingBox();
  g.translate(0, -g.boundingBox.min.y, 0);
  g.computeVertexNormals();
  return g;
}
// returns [body, stem] meshes (origin bottom centre)
export function pumpkinMeshes(M, r, material, seed = 1) {
  const body = mesh(pumpkinGeo(r, seed), material);
  body.rotation.y = hash1(seed * 3.3) * 6.28;
  body.geometry.computeBoundingBox();
  const top = body.geometry.boundingBox.max.y;
  const sg = new THREE.CylinderGeometry(0.1 * r, 0.16 * r, 0.42 * r, 5); sg.translate(0, 0.21 * r, 0);
  const stem = mesh(sg, M.stem);
  stem.position.y = top * 0.82; stem.rotation.set((hash1(seed) - 0.5) * 0.5, 0, (hash1(seed + 1) - 0.5) * 0.5);
  return [body, stem];
}

// beam between two points with a w x d cross section
export function beam(a, b, w, d, material, o = {}) {
  const A = V(...a), B = V(...b), dir = B.clone().sub(A), len = dir.length();
  const g = new THREE.BoxGeometry(w, len, d); g.translate(0, len / 2, 0);
  const m = mesh(g, material, o);
  m.position.copy(A); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.normalize());
  return m;
}

// split a geometry into two by a face predicate (non-indexed) -> [yes, no]
export function splitFaces(geo, pred) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const p = g.attributes.position, A = [], B = [];
  for (let i = 0; i < p.count; i += 3) {
    const tri = [0, 1, 2].map((k) => V(p.getX(i + k), p.getY(i + k), p.getZ(i + k)));
    (pred(tri) ? A : B).push(...tri.flatMap((v) => [v.x, v.y, v.z]));
  }
  const mk = (arr) => { const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); o.computeVertexNormals(); return o; };
  return [mk(A), mk(B)];
}

// ---------------------------------------------------------------- tableware
const PLATE_PROFILE = [[0, 0.003], [0.068, 0.003], [0.072, 0], [0.08, 0], [0.112, 0.012], [0.13, 0.0175], [0.127, 0.019], [0.116, 0.0165], [0.104, 0.0135], [0.074, 0.0075], [0, 0.007]];
export const PLATE_R = 0.13;
let _plateMat = null, _plateMat2 = null;
export function plateMaterials() {
  if (!_plateMat) {
    _plateMat = mat(bandTex(['#e9e3d6', '#ddd5c4', '#cfc6b4', '#e6dfcf', '#b8913e', '#d4ab52', '#f6f1e6', '#b5562f', '#f7f3ea', '#fbf8f1']), { rough: 0.3 });
    _plateMat2 = mat(bandTex(['#e9e3d6', '#ddd5c4', '#cfc6b4', '#e6dfcf', '#b8913e', '#d4ab52', '#f3ead6', '#c98a3a', '#f5eedd', '#f8f2e4']), { rough: 0.3 });
  }
  return [_plateMat, _plateMat2];
}
export function plateGeo(r = PLATE_R, seg = 22) {
  const k = r / PLATE_R;
  return latheGeo(PLATE_PROFILE.map(([a, b]) => [a * k, b]), seg);
}
// height of the plate's top surface at radius rr (plate-local)
export function plateTopAt(rr, r = PLATE_R) {
  const k = r / PLATE_R, q = rr / k;
  const top = [[0, 0.007], [0.074, 0.0075], [0.104, 0.0135], [0.116, 0.0165], [0.127, 0.019], [0.13, 0.0175]];
  if (q <= 0) return 0.007;
  for (let i = 1; i < top.length; i++) if (q <= top[i][0]) { const [a, ya] = top[i - 1], [b, yb] = top[i]; return lerp(ya, yb, (q - a) / (b - a)); }
  return 0.0175;
}
export function chargerMesh(M) {
  const g = latheGeo([[0, 0], [0.152, 0], [0.159, 0.003], [0.157, 0.0045], [0.15, 0.004], [0.133, 0.0035], [0, 0.0035]], 24);
  return mesh(g, M.charger, { cast: false });
}

export function forkGroup(M, len = 0.19, material = null) {
  const s = len / 0.19, m = material || M.steel;
  const g = new THREE.Group();
  const geos = [];
  const add = (w, h, d, x, y, z, rx = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateX(rx); b.translate(x, y, z); geos.push(b); };
  // handle (slightly wider at the end), neck, head + 4 tines curving up a little
  add(0.017 * s, 0.0035, 0.07 * s, 0, 0.0018, -0.065 * s);
  add(0.013 * s, 0.0035, 0.045 * s, 0, 0.0022, -0.008 * s, -0.04);
  add(0.009 * s, 0.0035, 0.03 * s, 0, 0.003, 0.03 * s, -0.08);
  add(0.024 * s, 0.0035, 0.014 * s, 0, 0.0045, 0.05 * s, -0.1);
  for (let i = 0; i < 4; i++) add(0.0042 * s, 0.003, 0.038 * s, (i - 1.5) * 0.0066 * s, 0.0065, 0.074 * s, -0.12);
  const merged = mergeList(geos);
  g.add(mesh(merged, m, { name: 'fork' }));
  g.userData.grip = { pos: [0, 0.002, -0.06 * s], axis: [0, 0, 1], up: [0, 1, 0] };
  g.userData.tip = [0, 0.008, 0.08 * s];
  return g;
}
export function knifeGroup(M) {
  const g = new THREE.Group(), geos = [];
  const b1 = new THREE.BoxGeometry(0.016, 0.006, 0.09); b1.translate(0, 0.003, -0.06); geos.push(b1);
  const s = new THREE.Shape(); s.moveTo(-0.0085, 0); s.lineTo(0.0085, 0); s.lineTo(0.0095, 0.08); s.quadraticCurveTo(0.004, 0.105, -0.0085, 0.1); s.closePath();
  const bl = new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false }); bl.rotateX(Math.PI / 2); bl.translate(0, 0.0035, -0.015); geos.push(bl);
  g.add(mesh(mergeList(geos), M.steel, { name: 'knife' }));
  return g;
}
// big carving fork (2 long tines), handle wood
export function servingForkGroup(M) {
  const g = new THREE.Group();
  const h = chamferBox(0.022, 0.016, 0.12, 0.004); h.translate(0, 0.008, -0.1);
  g.add(mesh(h, M.walnutDark, { name: 'servingFork.handle' }));
  const geos = [];
  const add = (w, hh, d, x, y, z, rx = 0) => { const b = new THREE.BoxGeometry(w, hh, d); b.rotateX(rx); b.translate(x, y, z); geos.push(b); };
  add(0.026, 0.02, 0.012, 0, 0.009, -0.034);   // bolster
  add(0.008, 0.006, 0.06, 0, 0.009, 0.0);       // shank
  add(0.034, 0.006, 0.01, 0, 0.009, 0.032);     // tine yoke
  for (const x of [-0.013, 0.013]) { add(0.005, 0.005, 0.11, x, 0.011, 0.09, -0.06); }
  g.add(mesh(mergeList(geos), M.steel, { name: 'servingFork.tines' }));
  g.userData.grip = { pos: [0, 0.008, -0.1], axis: [0, 0, 1], up: [0, 1, 0] };
  g.userData.tip = [0, 0.018, 0.14];
  g.userData.skewer = [0, 0.014, 0.1];            // point between the tines where a skewered slice sits
  return g;
}
export function bigSpoonGroup(M) {
  const g = new THREE.Group();
  const geos = [];
  const hb = new THREE.BoxGeometry(0.018, 0.005, 0.15); hb.translate(0, 0.012, -0.085); geos.push(hb);
  const nb = new THREE.BoxGeometry(0.011, 0.005, 0.03); nb.rotateX(0.25); nb.translate(0, 0.008, 0.0); geos.push(nb);
  g.add(mesh(mergeList(geos), M.steel, { name: 'bigSpoon.handle' }));
  // bowl: half ellipsoid opening upward
  const bowl = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  bowl.scale(0.032, 0.016, 0.045); bowl.translate(0, 0.016, 0.055);
  g.add(mesh(bowl, M.steelDS, { name: 'bigSpoon.bowl' }));
  g.userData.grip = { pos: [0, 0.012, -0.11], axis: [0, 0, 1], up: [0, 1, 0] };
  g.userData.tip = [0, 0.012, 0.055];
  return g;
}

export function glassGroup(M) {
  const g = new THREE.Group();
  const gl = mesh(latheGeo([[0, 0], [0.029, 0], [0.031, 0.004], [0.034, 0.115], [0.0318, 0.115], [0.027, 0.013], [0, 0.013]], 14), M.glassDS, { cast: false, receive: false, name: 'glass' });
  gl.renderOrder = 3; g.add(gl);
  const wb = mesh(latheGeo([[0, 0.0138], [0.0258, 0.0138], [0.0287, 0.078]], 14), M.water, { cast: false, receive: false, name: 'glass.water' });
  wb.renderOrder = 1; g.add(wb);
  const sg = polarDisc(0.0287, 3, 14);
  const surf = mesh(sg, M.waterTop, { cast: false, receive: false, name: 'glass.surface' });
  surf.position.y = 0.078; surf.renderOrder = 2; g.add(surf);
  g.userData.surface = surf;
  g.userData.radius = 0.034;
  return g;
}
// animate a polar-disc surface: amp in metres
export function rippleSurface(surf, t, amp, seed = 0) {
  const p = surf.geometry.attributes.position, rest = surf.geometry.userData.rest;
  for (let i = 0; i < p.count; i++) {
    const x = rest[i * 3], z = rest[i * 3 + 2], r = Math.hypot(x, z) / 0.0287;
    const w = Math.sin(r * 9 - t * 26 + seed) * 0.6 + Math.sin(x * 220 + t * 17 + seed) * 0.25 + Math.sin(z * 190 - t * 21) * 0.25;
    p.setY(i, w * amp * (1 - Math.pow(r, 6)));
  }
  p.needsUpdate = true;
  surf.geometry.computeVertexNormals();
}

export function napkinMesh(material, w = 0.1, l = 0.17) {
  const g = chamferBox(w, 0.007, l, 0.003); g.translate(0, 0.0035, 0);
  // a folded flap on top
  const f = chamferBox(w * 0.96, 0.003, l * 0.42, 0.0015); f.translate(0, 0.0085, -l * 0.22);
  return mesh(mergeList([g, f]), material, { name: 'napkin' });
}

// ---------------------------------------------------------------- turkey
export function turkeySliceGroup(M, seed = 1) {
  const g = new THREE.Group();
  const s = new THREE.Shape(), R = rng(seed);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, rx = 0.048 * (0.9 + R() * 0.15), rz = 0.032 * (0.9 + R() * 0.15);
    const x = Math.cos(a) * rx, z = Math.sin(a) * rz * (a > Math.PI ? 0.85 : 1);
    if (i === 0) s.moveTo(x, z); else s.lineTo(x, z);
  }
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.011, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1 });
  geo.rotateX(Math.PI / 2); geo.translate(0, 0.013, 0);
  // gentle curl
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, p.getY(i) + x * x * 2.2); }
  geo.computeVertexNormals();
  const meat = mesh(geo, M.meat, { name: 'turkeySlice' });
  g.add(meat);
  // browned skin strip along the +z edge
  const sk = new THREE.BoxGeometry(0.075, 0.012, 0.007); sk.translate(0, 0.0075, 0.03);
  const pp = sk.attributes.position; for (let i = 0; i < pp.count; i++) { const x = pp.getX(i); pp.setY(i, pp.getY(i) + x * x * 2.2); pp.setZ(i, pp.getZ(i) - x * x * 1.2); }
  sk.computeVertexNormals();
  g.add(mesh(sk, M.turkeySkin, { name: 'turkeySlice.skin' }));
  g.userData.skewer = [0, 0.012, 0];
  return g;
}

export function buildTurkey(M) {
  const g = new THREE.Group();
  // body
  const body = lowSphere(0.135, 0.088, 0.1, 12, 9);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < -0.055) y = -0.055 - (y + 0.055) * 0.2;
    if (y > 0) y += 0.016 * Math.max(0, 1 - Math.abs(z) / 0.07) * (y / 0.088);
    if (x < -0.07) { z *= 0.92; y *= 0.95; }
    const j = 1 + (pn(x, y, z, 3) - 0.5) * 0.05;
    p.setXYZ(i, x * j, y * j + 0.064, z * j);
  }
  body.computeVertexNormals();
  // carve the -Z front side (where slices were cut)
  const cutZ = -0.068;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z < cutZ && x > -0.035 && x < 0.1 && y > 0.04) p.setZ(i, cutZ);
  }
  const [cut, skin] = splitFaces(body, (tri) => tri.every((v) => Math.abs(v.z - cutZ) < 1e-5));
  g.add(mesh(skin, M.turkey, { name: 'turkey.body' }));
  const cm = mesh(cut, M.meat, { name: 'turkey.cut' }); g.add(cm);
  // thighs + drumsticks
  for (const sd of [-1, 1]) {
    const th = mesh(lowSphere(0.058, 0.046, 0.042, 8, 6), M.turkey); th.position.set(0.055, 0.072, sd * 0.078); th.rotation.set(sd * 0.3, 0, -0.35); g.add(th);
    const dg = latheGeo([[0, 0], [0.02, 0.0], [0.032, 0.025], [0.036, 0.06], [0.026, 0.095], [0.013, 0.118], [0, 0.12]], 8);
    const dm = mesh(dg, M.turkey);
    dm.position.set(0.075, 0.07, sd * 0.068);
    dm.quaternion.setFromUnitVectors(V(0, 1, 0), V(1, 0.62, -sd * 0.28).normalize()); g.add(dm);
    const tipP = V(0.075, 0.07, sd * 0.068).addScaledVector(V(1, 0.62, -sd * 0.28).normalize(), 0.118);
    const bone = mesh(lowSphere(0.011, 0.011, 0.011, 6, 4), M.bone); bone.position.copy(tipP).addScaledVector(V(1, 0.62, -sd * 0.28).normalize(), 0.012); g.add(bone);
    const fr = new THREE.CylinderGeometry(0.0155, 0.012, 0.024, 8, 1, true);
    const fp = fr.attributes.position; for (let i = 0; i < fp.count; i++) if (fp.getY(i) > 0) fp.setY(i, fp.getY(i) + (i % 2 ? 0.004 : -0.002));
    fr.computeVertexNormals();
    const fm = mesh(fr, M.frill); fm.position.copy(tipP).addScaledVector(V(1, 0.62, -sd * 0.28).normalize(), 0.004);
    fm.quaternion.copy(dm.quaternion); g.add(fm);
    // wing
    const w = mesh(lowSphere(0.055, 0.022, 0.03, 7, 5), M.turkey); w.position.set(-0.06, 0.06, sd * 0.088); w.rotation.set(sd * 0.5, 0.3 * sd, 0.2); g.add(w);
  }
  // neck-end nub
  const nub = mesh(lowSphere(0.03, 0.03, 0.04, 7, 5), M.turkey); nub.position.set(-0.13, 0.05, 0); g.add(nub);
  return g;
}

export function platterGroup(M, rx = 0.22, rz = 0.15) {
  const g = new THREE.Group();
  const prof = [[0, 0.002], [0.1, 0.002], [0.105, 0], [0.112, 0], [0.135, 0.012], [0.15, 0.018], [0.147, 0.02], [0.128, 0.013], [0.11, 0.007], [0, 0.006]];
  const geo = latheGeo(prof, 26); geo.scale(rx / 0.15, 1, rz / 0.15);
  g.add(mesh(geo, M.platter, { name: 'platter' }));
  g.userData.floor = 0.006;
  return g;
}

// garnish ring of parsley, orange slices and cranberries inside an oval of radii (ax, az)
export function garnish(M, g, ax, az, y, seed = 5, n = 14, skip = null) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.2;
    const x = Math.cos(a) * ax, z = Math.sin(a) * az;
    if (skip && skip(x, z)) continue;
    const k = i % 3;
    if (k === 0) { const m = mesh(lowSphere(0.022, 0.012, 0.022, 6, 4), M.parsley); m.position.set(x, y + 0.006, z); g.add(m);
      const m2 = mesh(lowSphere(0.014, 0.01, 0.014, 5, 3), M.parsley); m2.position.set(x + 0.012, y + 0.012, z + 0.006); g.add(m2); }
    else if (k === 1) { const o = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 8, 1, false, 0, Math.PI), M.orangeSlice); o.rotation.set(0.5, a, 0); o.position.set(x, y + 0.012, z); g.add(o); }
    else for (let j = 0; j < 3; j++) { const b = mesh(lowSphere(0.008, 0.008, 0.008, 5, 4), M.berry); b.position.set(x + (R() - 0.5) * 0.02, y + 0.008, z + (R() - 0.5) * 0.02); g.add(b); }
  }
}

// ---------------------------------------------------------------- bowls & dishes
export function bowlGeo(r = 0.09, h = 0.068, seg = 16) {
  const k = r / 0.09, kh = h / 0.068;
  return latheGeo([[0, 0], [0.045, 0], [0.047, 0.004], [0.045, 0.008], [0.07, 0.03], [0.085, 0.06], [0.09, 0.068], [0.086, 0.07], [0.08, 0.06], [0.065, 0.032], [0.04, 0.018], [0, 0.016]].map(([a, b]) => [a * k, b * kh]), seg);
}
export function potatoBowlGroup(M) {
  const g = new THREE.Group();
  g.add(mesh(bowlGeo(0.09, 0.068), M.bowlCream, { name: 'potatoesBowl' }));
  const md = mesh(moundGeo(0.08, 0.055, 7, 14, 6, 0.14, 0.25), M.potato, { name: 'potatoes' }); md.position.y = 0.046; g.add(md);
  const pat = mesh(chamferBox(0.03, 0.01, 0.03, 0.002), M.butter); pat.position.set(0.012, 0.106, -0.004); pat.rotation.set(0.15, 0.6, -0.1); g.add(pat);
  const melt = mesh(lowSphere(0.024, 0.004, 0.022, 8, 3), M.butterMelt); melt.position.set(0.014, 0.1, -0.002); g.add(melt);
  const R = rng(17);
  for (let i = 0; i < 9; i++) { const a = R() * 6.28, rr = 0.02 + R() * 0.04; const f = mesh(new THREE.BoxGeometry(0.004, 0.003, 0.004), M.parsley, { cast: false }); f.position.set(Math.cos(a) * rr, 0.046 + 0.055 * Math.sqrt(Math.max(0, 1 - (rr / 0.08) ** 2)) + 0.002, Math.sin(a) * rr); g.add(f); }
  return g;
}
export function gravyBoatGroup(M) {
  const g = new THREE.Group();
  const body = latheGeo([[0, 0], [0.026, 0], [0.028, 0.004], [0.022, 0.008], [0.024, 0.012], [0.04, 0.024], [0.048, 0.042], [0.05, 0.054], [0.0465, 0.054], [0.044, 0.043], [0.036, 0.027], [0, 0.02]], 16);
  body.scale(1.55, 1, 1);
  g.add(mesh(body, M.porcelain, { name: 'gravyBoat.body' }));
  // spout: V-trough
  const sp = new THREE.BufferGeometry();
  const P = [[-0.064, 0.054, 0.034], [-0.068, 0.043, 0], [-0.064, 0.054, -0.034], [-0.113, 0.067, 0.009], [-0.11, 0.061, 0], [-0.113, 0.067, -0.009]];
  const Q = P.map(([x, y, z]) => [x, y - 0.004, z * 1.08]);
  const vs = [...P, ...Q].flat();
  sp.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  sp.setIndex([0, 3, 1, 1, 3, 4, 1, 4, 2, 2, 4, 5, /* outer */ 6, 7, 9, 7, 10, 9, 7, 8, 10, 8, 11, 10, /* lip */ 0, 6, 3, 6, 9, 3, 2, 5, 8, 8, 5, 11, 3, 9, 4, 4, 9, 10, 4, 10, 5, 5, 10, 11]);
  sp.computeVertexNormals();
  g.add(mesh(sp, M.porcelainDS, { name: 'gravyBoat.spout' }));
  // handle
  const curve = new THREE.CatmullRomCurve3([V(0.068, 0.046, 0), V(0.097, 0.068, 0), V(0.12, 0.064, 0), V(0.123, 0.042, 0), V(0.075, 0.02, 0)]);
  g.add(mesh(new THREE.TubeGeometry(curve, 12, 0.0055, 5), M.porcelain, { name: 'gravyBoat.handle' }));
  // gravy surface
  const gs = mesh(polarDisc(1, 2, 14), M.gravy, { name: 'gravyBoat.gravy' }); gs.scale.set(0.0668, 1, 0.0425); gs.position.y = 0.045; g.add(gs);
  g.userData.grip = { pos: [0.108, 0.067, 0], axis: [-1, 0, 0], up: [0, 1, 0] };
  g.userData.tip = [-0.113, 0.064, 0];
  return g;
}
export function saucerGeo() {
  const g = latheGeo([[0, 0.002], [0.05, 0.002], [0.055, 0], [0.06, 0], [0.08, 0.008], [0.09, 0.012], [0.088, 0.013], [0.078, 0.009], [0.06, 0.005], [0, 0.005]], 20);
  g.scale(1.42, 1, 1.02);
  return g;
}
export function beansGroup(M) {
  const g = new THREE.Group();
  g.add(mesh(bowlGeo(0.08, 0.058), M.bowlBlue, { name: 'beansBowl' }));
  const R = rng(23), geos = [], al = [];
  for (let i = 0; i < 46; i++) {
    const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * 0.062;
    const dome = 0.038 + 0.032 * (1 - (rr / 0.068) ** 2);
    const b = new THREE.CylinderGeometry(0.0042, 0.0048, 0.065 + R() * 0.02, 5); b.rotateZ(Math.PI / 2 + (R() - 0.5) * 0.5); b.rotateY(R() * Math.PI);
    b.translate(Math.cos(a) * rr, dome + (R() - 0.5) * 0.008, Math.sin(a) * rr); geos.push(b);
  }
  for (let i = 0; i < 10; i++) { const a = R() * 6.28, rr = R() * 0.05; const s = new THREE.BoxGeometry(0.012, 0.002, 0.005); s.rotateY(R() * 3); s.translate(Math.cos(a) * rr, 0.071 + 0.006 * (1 - rr / 0.05), Math.sin(a) * rr); al.push(s); }
  g.add(mesh(mergeList(geos), M.bean, { name: 'beans' }));
  g.add(mesh(mergeList(al), M.almond, { name: 'almonds' }));
  return g;
}
export function cobGeo(len = 0.15, r = 0.021) {
  const k = len / 0.16, kr = r / 0.022;
  const g = latheGeo([[0, 0], [0.012, 0.002], [0.019, 0.016], [0.022, 0.05], [0.022, 0.11], [0.019, 0.145], [0.012, 0.158], [0, 0.16]].map(([a, b]) => [a * kr, b * k]), 10);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 3);
  g.translate(0, -len / 2, 0); g.rotateZ(Math.PI / 2);
  return g;
}
export function cornGroup(M) {
  const g = new THREE.Group();
  const dish = platterGroup(M, 0.13, 0.072); dish.children[0].material = M.platterGreen; g.add(dish);
  const y0 = 0.006 + 0.021;
  const cobs = [[0, y0, -0.024, 0.03], [0.01, y0, 0.024, -0.04], [-0.006, y0 + 0.034, 0.0, 0.08]];
  for (const [x, y, z, ry] of cobs) { const c = mesh(cobGeo(), M.corn, { name: 'corn.cob' }); c.position.set(x, y, z); c.rotation.y = ry; g.add(c); }
  const pat = mesh(chamferBox(0.022, 0.008, 0.02, 0.002), M.butter); pat.position.set(0.02, y0 + 0.034 + 0.021, 0.002); pat.rotation.set(0.1, 0.4, 0.05); g.add(pat);
  return g;
}
export function cranberryGroup(M) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0.002], [0.04, 0.002], [0.044, 0], [0.05, 0], [0.062, 0.012], [0.066, 0.016], [0.062, 0.016], [0.052, 0.008], [0, 0.006]], 16), M.porcelain, { name: 'cranberryDish' }));
  const prof = [[0, 0]];
  for (let i = 0; i <= 6; i++) { const y = 0.004 + i * 0.0128; prof.push([0.0295, y], [0.0315, y + 0.0064]); }
  prof.push([0.029, 0.084], [0, 0.084]);
  const log = latheGeo(prof, 12); log.translate(0, -0.042, 0); log.rotateZ(Math.PI / 2);
  const lm = mesh(log, M.cranberry, { name: 'cranberry.jelly' }); lm.position.set(-0.008, 0.006 + 0.0315, -0.006); lm.rotation.y = 0.25; g.add(lm);
  const sl = mesh(new THREE.CylinderGeometry(0.0305, 0.0305, 0.011, 12), M.cranberry); sl.position.set(0.034, 0.006 + 0.019, 0.022); sl.rotation.set(0.0, 0.25, 1.05); g.add(sl);
  return g;
}
export function rollsGroup(M) {
  const g = new THREE.Group();
  const bg = latheGeo([[0, 0], [0.075, 0], [0.078, 0.006], [0.105, 0.055], [0.112, 0.062], [0.104, 0.062], [0.097, 0.054], [0.07, 0.012], [0, 0.01]], 14);
  bg.scale(1.15, 1, 1);
  g.add(mesh(bg, M.wicker, { name: 'rolls.basket' }));
  // gingham liner, corners hanging over the rim
  const cl = new THREE.PlaneGeometry(0.3, 0.3, 10, 10); cl.rotateX(-Math.PI / 2); cl.rotateY(Math.PI / 4 + 0.15);
  const p = cl.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), e = Math.hypot(x / (0.112 * 1.15), z / 0.112);
    let y;
    if (e < 0.9) y = 0.016 + 0.05 * Math.pow(e / 0.9, 2.2);
    else if (e < 1.04) y = 0.068;
    else y = Math.max(0.012, 0.068 - (e - 1.04) * 0.32);
    p.setY(i, y + (pn(x, 0, z, 9) - 0.5) * 0.004);
  }
  cl.computeVertexNormals();
  g.add(mesh(cl, M.gingham, { name: 'rolls.cloth' }));
  const R = rng(29);
  const spots = [[-0.045, 0.06, -0.02], [0.03, 0.062, -0.035], [0.05, 0.06, 0.03], [-0.02, 0.06, 0.04], [0.0, 0.088, 0.0], [-0.07, 0.056, 0.03]];
  for (const [x, y, z] of spots) {
    const r = mesh(lowSphere(0.036, 0.026, 0.044, 8, 5), M.roll, { name: 'roll' }); r.position.set(x, y, z); r.rotation.set((R() - 0.5) * 0.4, R() * 3, (R() - 0.5) * 0.3); g.add(r);
    const s = mesh(lowSphere(0.02, 0.008, 0.03, 6, 3), M.rollLight); s.position.set(x, y + 0.022, z); s.rotation.copy(r.rotation); g.add(s);
  }
  return g;
}

// pie wedge(s): filling + crust + crimped rim; phi0/len in radians (lathe convention: dir = (sin phi, 0, cos phi))
export function pieWedge(M, phi0, len, { withDish = false, R0 = 0.095 } = {}) {
  const g = new THREE.Group();
  const k = R0 / 0.095;
  const fillProf = [[0, 0.011], [0.08, 0.011], [0.087, 0.028], [0, 0.03]].map(([a, b]) => [a * k, b]);
  const crustProf = [[0, 0.004], [0.078, 0.004], [0.092, 0.03], [0.087, 0.03], [0.08, 0.011], [0, 0.011]].map(([a, b]) => [a * k, b]);
  g.add(mesh(latheGeo(fillProf, Math.max(3, Math.round(24 * len / (Math.PI * 2))), phi0, len), M.pieFill, { name: 'pie.filling' }));
  g.add(mesh(latheGeo(crustProf, Math.max(3, Math.round(24 * len / (Math.PI * 2))), phi0, len), M.crust, { name: 'pie.crust' }));
  // crimped rim (torus arc)
  const segs = Math.max(4, Math.round(32 * len / (Math.PI * 2)));
  const tor = new THREE.TorusGeometry(0.093 * k, 0.0105, 5, segs, len);
  const tp = tor.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), y = tp.getY(i), a = Math.atan2(y, x);
    const c = 1 + 0.035 * Math.cos(a * 30);
    tp.setXY(i, x * c, y * c);
  }
  tor.rotateX(Math.PI / 2);           // torus arc from +X toward +Z ... -> map to lathe angle
  tor.rotateY(phi0 + len - Math.PI / 2); // torus angle a -> lathe phi = PI/2 - a + rotation
  tor.translate(0, 0.031, 0);
  tor.computeVertexNormals();
  g.add(mesh(tor, M.crust, { name: 'pie.rim' }));
  // cut faces (if not a full circle)
  if (len < Math.PI * 2 - 1e-3) {
    for (const phi of [phi0, phi0 + len]) {
      const mk = (prof) => { const s = new THREE.Shape(); prof.forEach(([a, b], i) => (i ? s.lineTo(a, b) : s.moveTo(a, b))); s.closePath(); const sg = new THREE.ShapeGeometry(s); sg.rotateY(phi - Math.PI / 2); return sg; };
      g.add(mesh(mk(fillProf), M.pieFillDS, { name: 'pie.cut' }));
      g.add(mesh(mk([[0, 0.004], [0.078 * k, 0.004], [0.0935 * k, 0.03], [0.087 * k, 0.03], [0.08 * k, 0.011], [0, 0.011]]), M.crustDS, { name: 'pie.cutCrust' }));
      // rim end cap
      const cap = mesh(lowSphere(0.0105, 0.0105, 0.0105, 6, 4), M.crust); cap.position.set(Math.sin(phi) * 0.093 * k, 0.031, Math.cos(phi) * 0.093 * k); g.add(cap);
    }
  }
  return g;
}
export function pieGroup(M) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0], [0.078, 0], [0.1, 0.03], [0.11, 0.033], [0.11, 0.036], [0.101, 0.036], [0.096, 0.03], [0.08, 0.006], [0, 0.005]], 24), M.pieDish, { name: 'pie.dish' }));
  const missing = Math.PI / 4, phi0 = Math.PI * 0.85;      // gap faces roughly -Z/+X (toward cousinA / the camera side)
  const w = pieWedge(M, phi0 + missing, Math.PI * 2 - missing);
  w.position.y = 0.001; g.add(w);
  // whipped cream dollops
  const R = rng(37);
  for (let i = 0; i < 3; i++) {
    const a = phi0 + missing + 0.6 + i * 1.6, rr = 0.05;
    const d = mesh(latheGeo([[0, 0], [0.017, 0], [0.019, 0.007], [0.012, 0.016], [0.006, 0.023], [0, 0.029]], 7), M.whip);
    d.position.set(Math.sin(a) * rr, 0.0295, Math.cos(a) * rr); d.rotation.y = R() * 3; g.add(d);
  }
  g.userData.gapPhi = phi0 + missing / 2;
  return g;
}

// ---------------------------------------------------------------- candles
export function candleGroup(M, flameMat, glowMat, height = 0.2, wax = null) {
  const g = new THREE.Group();
  g.add(mesh(latheGeo([[0, 0], [0.045, 0], [0.046, 0.007], [0.022, 0.016], [0.012, 0.03], [0.02, 0.05], [0.01, 0.068], [0.022, 0.082], [0.025, 0.088], [0.017, 0.088], [0.014, 0.083], [0, 0.083]], 12), M.brass, { name: 'candle.holder' }));
  const c = mesh(new THREE.CylinderGeometry(0.0108, 0.0118, height, 9), wax || M.candle, { name: 'candle.wax' }); c.position.y = 0.083 + height / 2; g.add(c);
  const drip = mesh(lowSphere(0.004, 0.012, 0.004, 4, 3), wax || M.candle); drip.position.set(0.0105, 0.083 + height - 0.016, 0.002); g.add(drip);
  const top = 0.083 + height;
  const wick = mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.01, 4), M.wick, { cast: false }); wick.position.y = top + 0.005; g.add(wick);
  const fl = new THREE.Group(); fl.position.y = top + 0.006; g.add(fl);
  const fg = latheGeo([[0, 0], [0.0055, 0.004], [0.0068, 0.011], [0.0045, 0.022], [0.0015, 0.033], [0, 0.037]], 7);
  const flame = mesh(fg, flameMat, { cast: false, receive: false, name: 'candle.flame' }); fl.add(flame);
  const core = mesh(lowSphere(0.0032, 0.0055, 0.0032, 5, 4), M.flameCore, { cast: false, receive: false }); core.position.y = 0.006; fl.add(core);
  const glow = new THREE.Sprite(glowMat); glow.scale.set(0.11, 0.11, 1); glow.position.y = 0.014; glow.userData.noAudit = true; fl.add(glow);
  flame.userData.noAudit = true; core.userData.noAudit = true;
  g.userData.flame = fl; g.userData.top = top; g.userData.glow = glow;
  return g;
}

// ---------------------------------------------------------------- chair
export function chairGroup(M, CH) {
  const g = new THREE.Group();
  const W = CH.seatW, D = CH.seatD, sy = CH.seatY, top = CH.backTopY;
  const fr = M.chairWood;
  const seat = mesh(chamferBox(W, 0.035, D, 0.008), fr); seat.position.y = sy - 0.02 - 0.0175; g.add(seat);
  const cush = chamferBox(W - 0.04, 0.02, D - 0.05, 0.007); cush.translate(0, sy - 0.01, 0.01);
  const cp = cush.attributes.position; for (let i = 0; i < cp.count; i++) { const x = cp.getX(i), z = cp.getZ(i); if (cp.getY(i) > sy - 0.011) cp.setY(i, cp.getY(i) - 0.006 * ((x / (W / 2)) ** 2 + (z / (D / 2)) ** 2)); }
  cush.computeVertexNormals();
  g.add(mesh(cush, M.cushion, { name: 'chair.cushion' }));
  // aprons
  const ay = sy - 0.0375 - 0.025;
  g.add(beam([-W / 2 + 0.03, ay, D / 2 - 0.03], [W / 2 - 0.03, ay, D / 2 - 0.03], 0.05, 0.02, fr));
  for (const sx of [-1, 1]) { const b = new THREE.BoxGeometry(0.02, 0.05, D - 0.06); const m = mesh(b, fr); m.position.set(sx * (W / 2 - 0.03), ay + 0.025, 0); g.add(m); }
  // front legs (tapered)
  for (const sx of [-1, 1]) {
    const lg = new THREE.CylinderGeometry(0.016, 0.012, sy - 0.0375, 4); lg.rotateY(Math.PI / 4); lg.translate(0, (sy - 0.0375) / 2, 0);
    const m = mesh(lg, fr); m.position.set(sx * (W / 2 - 0.03), 0, D / 2 - 0.03); g.add(m);
  }
  // back legs / posts with a slight rake
  const zb = -D / 2 + 0.02, rake = -0.04;
  const zAt = (y) => zb + rake * Math.max(0, (y - sy) / (top - sy));
  for (const sx of [-1, 1]) {
    g.add(beam([sx * (W / 2 - 0.025), 0, zb + 0.01], [sx * (W / 2 - 0.025), sy, zb], 0.035, 0.035, fr));
    g.add(beam([sx * (W / 2 - 0.025), sy, zb], [sx * (W / 2 - 0.025), top - 0.01, zAt(top)], 0.035, 0.035, fr));
    const fin = mesh(lowSphere(0.02, 0.02, 0.02, 6, 4), fr); fin.position.set(sx * (W / 2 - 0.025), top + 0.004, zAt(top)); g.add(fin);
  }
  // top rail (gently arched), mid rail and vase splat
  const tr = chamferBox(W - 0.06, 0.075, 0.028, 0.006); const tp = tr.attributes.position;
  for (let i = 0; i < tp.count; i++) if (tp.getY(i) > 0) tp.setY(i, tp.getY(i) + 0.018 * (1 - (tp.getX(i) / (W / 2)) ** 2));
  tr.computeVertexNormals();
  const trm = mesh(tr, fr); trm.position.set(0, top - 0.06, zAt(top - 0.06)); trm.rotation.x = -0.075; g.add(trm);
  const lr = mesh(chamferBox(W - 0.06, 0.035, 0.024, 0.005), fr); lr.position.set(0, sy + 0.1, zAt(sy + 0.1)); lr.rotation.x = -0.075; g.add(lr);
  const vs = new THREE.Shape();
  vs.moveTo(-0.035, 0); vs.bezierCurveTo(-0.07, 0.1, -0.02, 0.14, -0.04, 0.22); vs.bezierCurveTo(-0.07, 0.3, -0.06, 0.32, -0.05, 0.34);
  vs.lineTo(0.05, 0.34); vs.bezierCurveTo(0.06, 0.32, 0.07, 0.3, 0.04, 0.22); vs.bezierCurveTo(0.02, 0.14, 0.07, 0.1, 0.035, 0); vs.closePath();
  const sg = new THREE.ExtrudeGeometry(vs, { depth: 0.014, bevelEnabled: false, curveSegments: 3 }); sg.translate(0, 0, -0.007);
  const sm = mesh(sg, fr); sm.position.set(0, sy + 0.115, zAt(sy + 0.115)); sm.rotation.x = -0.075; g.add(sm);
  g.userData.backBox = new THREE.Box3(V(-W / 2, sy, zAt(top) - 0.035), V(W / 2, top + 0.025, zb + 0.022));
  g.userData.seatBox = new THREE.Box3(V(-W / 2, sy - 0.0575, -D / 2), V(W / 2, sy - 0.01, D / 2));
  return g;
}

// ---------------------------------------------------------------- utils
export function mergeList(geos) {
  const list = geos.map((x) => (x.index ? x.toNonIndexed() : x));
  const hasUV = list.every((x) => x.attributes.uv);
  let n = 0; for (const x of list) n += x.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = hasUV ? new Float32Array(n * 2) : null; let o = 0;
  for (const x of list) { pos.set(x.attributes.position.array, o * 3); if (uv) uv.set(x.attributes.uv.array, o * 2); o += x.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uv) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeVertexNormals();
  return out;
}
export { flatten, leafGeo, clamp };
