// Tunnel props: mine cart, cricket bat, candle, bulbs, hatch lid with a flower
// pot, ladder, rails, snail. Geometry only; animation lives in main.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeAll, placed, boxMM, lumpyBlob } from './builders.js';

const mesh = (g, m, cast = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
};
const cyl = (r0, r1, h, seg = 16) => new THREE.CylinderGeometry(r0, r1, h, seg);

// ---------------------------------------------------------------------------
// mine cart: origin on the rail tops, centred between the wheels, +x = forward
// ---------------------------------------------------------------------------
export function buildCart(M) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // tips and bounces on its own
  root.add(body);
  const L = 0.62, Wd = 0.46, Hh = 0.34, y0 = 0.11, th = 0.03, flare = 0.06;
  const red = [], iron = [];
  red.push(boxMM(-L / 2 + 0.03, y0, -Wd / 2 + 0.03, L / 2 - 0.03, y0 + th, Wd / 2 - 0.03)); // floor
  for (const s of [-1, 1]) {
    // long sides lean out a little
    red.push(placed(new THREE.BoxGeometry(L + flare, Hh, th), 0, y0 + Hh / 2, s * (Wd / 2 + flare / 4), s * -0.12, 0, 0));
    // ends
    red.push(placed(new THREE.BoxGeometry(th, Hh, Wd + flare * 0.6), s * (L / 2 + flare / 4), y0 + Hh / 2, 0, 0, 0, s * 0.12));
  }
  // iron rim, corner straps, rivets
  for (const s of [-1, 1]) {
    iron.push(placed(new THREE.BoxGeometry(L + flare + 0.05, 0.035, 0.045), 0, y0 + Hh + 0.005, s * (Wd / 2 + flare / 2 - 0.005), s * -0.12, 0, 0));
    iron.push(placed(new THREE.BoxGeometry(0.045, 0.035, Wd + flare + 0.04), s * (L / 2 + flare / 2 - 0.005), y0 + Hh + 0.005, 0, 0, 0, s * 0.12));
    iron.push(placed(new THREE.BoxGeometry(L + 0.02, 0.03, 0.04), 0, y0 + 0.07, s * (Wd / 2 + 0.01), s * -0.06, 0, 0));
    for (const e of [-1, 1]) {
      iron.push(placed(new THREE.BoxGeometry(0.04, Hh + 0.02, 0.04), e * (L / 2 + 0.015), y0 + Hh / 2, s * (Wd / 2 + 0.015), s * -0.1, 0, e * 0.1));
      for (let k = 0; k < 3; k++) iron.push(placed(new THREE.SphereGeometry(0.012, 8, 6), e * (L / 2 - 0.08 - k * 0.09), y0 + Hh - 0.04, s * (Wd / 2 + flare / 2 + 0.012)));
    }
  }
  body.add(mesh(mergeAll(red), M.cartRed), mesh(mergeAll(iron), M.iron));
  // wheels on the rails (gauge 0.4)
  const wheels = [];
  const wg = mergeAll([
    placed(cyl(0.075, 0.075, 0.035, 20), 0, 0, 0, Math.PI / 2, 0, 0),
    placed(cyl(0.088, 0.088, 0.012, 20), 0, 0, -0.022, Math.PI / 2, 0, 0), // flange (inside)
    placed(cyl(0.025, 0.025, 0.05, 10), 0, 0, 0, Math.PI / 2, 0, 0),
  ]);
  const spoke = mergeAll([0, 1, 2].map((k) => placed(new THREE.BoxGeometry(0.13, 0.016, 0.01), 0, 0, 0.02, 0, 0, (k * Math.PI) / 3)));
  for (const [x, z] of [[0.19, 0.2], [-0.19, 0.2], [0.19, -0.2], [-0.19, -0.2]]) {
    const w = new THREE.Group();
    w.position.set(x, 0.075, z);
    w.add(mesh(wg, M.iron), mesh(spoke.clone(), M.steel, false));
    if (z < 0) w.rotation.y = Math.PI;
    root.add(w);
    wheels.push(w);
  }
  root.add(mesh(mergeAll([placed(cyl(0.018, 0.018, 0.46, 8), 0.19, 0.075, 0, Math.PI / 2, 0, 0), placed(cyl(0.018, 0.018, 0.46, 8), -0.19, 0.075, 0, Math.PI / 2, 0, 0)]), M.iron));
  return { root, body, wheels, R: 0.075, top: y0 + Hh };
}

// cricket bat: origin in the middle, blade along -y, handle along +y
export function buildBat(M) {
  const g = new THREE.Group();
  const blade = new RoundedBoxGeometry(0.115, 0.56, 0.045, 3, 0.02);
  placed(blade, 0, -0.2, 0);
  const shoulder = placed(new THREE.CylinderGeometry(0.03, 0.057, 0.06, 16), 0, 0.105, 0, 0, 0, 0, 1, 1, 0.4);
  const handle = placed(cyl(0.019, 0.019, 0.27, 12), 0, 0.27, 0);
  const grip = placed(cyl(0.022, 0.021, 0.22, 12), 0, 0.29, 0);
  const cap = placed(new THREE.SphereGeometry(0.023, 12, 8), 0, 0.405, 0);
  g.add(mesh(mergeAll([blade, shoulder, handle]), M.batWood), mesh(mergeAll([grip, cap]), M.batGrip));
  return g;
}

// candle on a little brass dish; origin on the floor
export function buildCandle(M) {
  const root = new THREE.Group();
  root.add(mesh(mergeAll([placed(cyl(0.075, 0.06, 0.022, 20), 0, 0.011, 0), placed(new THREE.TorusGeometry(0.03, 0.008, 6, 14), 0.08, 0.03, 0, 0, Math.PI / 2, 0)]), M.brass));
  root.add(mesh(mergeAll([placed(cyl(0.032, 0.034, 0.15, 18), 0, 0.097, 0), placed(lumpyBlob(0.02, 1, 0.3, 7), 0.028, 0.15, 0.01, 0, 0, 0, 0.6, 1.6, 0.6)]), M.wax));
  root.add(mesh(placed(cyl(0.003, 0.003, 0.025, 6), 0, 0.182, 0), M.wire, false));
  const flame = new THREE.Group();
  flame.position.set(0, 0.2, 0);
  flame.add(mesh(placed(new THREE.SphereGeometry(0.02, 14, 10), 0, 0.012, 0, 0, 0, 0, 1, 2.1, 1), M.flame, false));
  root.add(flame);
  return { root, flame };
}

// light bulb on a short cord; origin where the cord meets the wire
export function buildBulb(M) {
  const root = new THREE.Group();
  root.add(mesh(placed(cyl(0.005, 0.005, 0.1, 6), 0, -0.05, 0), M.wire, false));
  root.add(mesh(placed(cyl(0.022, 0.026, 0.045, 12), 0, -0.12, 0), M.socket, false));
  const glassG = mergeAll([placed(new THREE.SphereGeometry(0.048, 18, 14), 0, -0.19, 0), placed(cyl(0.02, 0.03, 0.04, 14), 0, -0.155, 0)]);
  const glass = mesh(glassG, M.bulb.clone(), false);
  root.add(glass);
  return { root, glass, center: new THREE.Vector3(0, -0.19, 0) };
}

// hatch lid: grass-topped wooden disc hinged at its left edge (origin on the hinge;
// rotate +z to flip it open sideways)
export function buildLid(M, r) {
  const hinge = new THREE.Group();
  const disc = new THREE.Group();
  disc.position.set(r, 0, 0); // centre of the disc to the right of the hinge
  hinge.add(disc);
  disc.add(mesh(placed(cyl(r, r, 0.07, 40), 0, -0.035, 0), M.lidWood));
  disc.add(mesh(placed(cyl(r - 0.015, r - 0.015, 0.035, 40), 0, 0.012, 0), M.tuft));
  // turf tufts on top
  const tufts = [];
  for (let i = 0; i < 120; i++) {
    const a = i * 2.399, rr = Math.sqrt((i + 0.5) / 120) * (r - 0.04);
    for (let k = 0; k < 3; k++) tufts.push(placed(new THREE.ConeGeometry(0.014, 0.08 + 0.03 * Math.sin(i * 3.1 + k), 4), Math.cos(a) * rr + Math.cos(k * 2.1) * 0.012, 0.06, Math.sin(a) * rr + Math.sin(k * 2.1) * 0.012, Math.cos(i + k) * 0.25, 0, Math.sin(i * 1.3 + k) * 0.25));
  }
  disc.add(mesh(mergeAll(tufts), M.tuft, false));
  // flower pot sitting on the lid (wobbles on its own)
  const pot = new THREE.Group();
  pot.position.set(0.04, 0.03, -0.02);
  const prof = [[0, 0], [0.09, 0], [0.12, 0.2], [0.135, 0.2], [0.135, 0.235], [0.11, 0.235], [0.105, 0.22]].map(([x, y]) => new THREE.Vector2(x, y));
  pot.add(mesh(new THREE.LatheGeometry(prof, 24), M.pot));
  pot.add(mesh(placed(cyl(0.106, 0.106, 0.02, 20), 0, 0.212, 0), M.soilDark, false));
  const stems = [], petals = { flowerRed: [], flowerYellow: [], flowerPink: [] }, leaves = [];
  const fl = [[0, 0.5, 0, 'flowerRed'], [0.06, 0.42, 0.03, 'flowerYellow'], [-0.06, 0.44, -0.02, 'flowerPink'], [0.02, 0.38, -0.06, 'flowerRed']];
  for (const [x, h, z, k] of fl) {
    stems.push(placed(cyl(0.006, 0.007, h - 0.2, 6), x * 0.6, 0.2 + (h - 0.2) / 2, z * 0.6, z * 0.5, 0, -x * 0.5));
    for (let p = 0; p < 6; p++) {
      const a = (p / 6) * Math.PI * 2;
      petals[k].push(placed(new THREE.SphereGeometry(0.03, 10, 8), x + Math.cos(a) * 0.035, h, z + Math.sin(a) * 0.035, 0, 0, 0, 1, 0.45, 1));
    }
    petals.flowerYellow.push(placed(new THREE.SphereGeometry(0.02, 10, 8), x, h + 0.008, z));
    leaves.push(placed(new THREE.SphereGeometry(0.04, 10, 8), x * 0.6 + 0.03, 0.28 + h * 0.15, z * 0.6, 0, 0, 0.6, 1, 0.3, 0.6));
  }
  pot.add(mesh(mergeAll(stems), M.leafDark, false), mesh(mergeAll(leaves), M.leaf, false));
  for (const [k, list] of Object.entries(petals)) pot.add(mesh(mergeAll(list), M[k], false));
  disc.add(pot);
  return { hinge, disc, pot };
}

// wooden ladder: origin at its foot, climbing +y, rungs along x
export function buildLadder(M, h, w = 0.36) {
  const parts = [];
  for (const s of [-1, 1]) parts.push(boxMM(s * w / 2 - 0.025, 0, -0.02, s * w / 2 + 0.025, h, 0.02));
  for (let y = 0.25; y < h - 0.05; y += 0.28) parts.push(placed(cyl(0.017, 0.017, w, 8), 0, y, 0, 0, 0, Math.PI / 2));
  return mesh(mergeAll(parts), M.sleeper);
}

// one steel rail: a strip of rectangular section following a polyline [[x, y], ...]
export function railGeom(pts, z, w = 0.035, h = 0.045) {
  const pos = [], nrm = [];
  const N = (i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    return [-dy / l, dx / l];
  };
  const quadP = (A, B, C, D, n) => {
    pos.push(...A, ...B, ...C, ...A, ...C, ...D);
    for (let k = 0; k < 6; k++) nrm.push(...n);
  };
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const [n0x, n0y] = N(i - 1), [n1x, n1y] = N(i);
    const t0 = [x0 + n0x * h, y0 + n0y * h], t1 = [x1 + n1x * h, y1 + n1y * h];
    quadP([t0[0], t0[1], z + w / 2], [t1[0], t1[1], z + w / 2], [t1[0], t1[1], z - w / 2], [t0[0], t0[1], z - w / 2], [n0x, n0y, 0]); // top
    quadP([x0, y0, z + w / 2], [x1, y1, z + w / 2], [t1[0], t1[1], z + w / 2], [t0[0], t0[1], z + w / 2], [0, 0, 1]); // side facing the camera
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return g;
}

// garden snail: origin under the body, facing +x; the eye stalks pivot on the head
export function buildSnail(M) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(mesh(mergeAll([
    placed(new THREE.CapsuleGeometry(0.045, 0.2, 6, 14), 0.02, 0.04, 0, 0, 0, Math.PI / 2, 1, 1, 0.8),
    placed(new THREE.SphereGeometry(0.058, 16, 12), 0.14, 0.078, 0),
  ]), M.snailBody));
  // googly eyes on wiggly stalks, pupils turned to the camera
  const stalks = [];
  for (const s of [-1, 1]) {
    const st = new THREE.Group();
    st.position.set(0.158, 0.118, s * 0.024);
    st.rotation.set(s * 0.28, 0, -0.32);
    st.add(mesh(placed(cyl(0.008, 0.011, 0.1, 6), 0, 0.05, 0), M.snailBody, false));
    st.add(mesh(placed(new THREE.SphereGeometry(0.023, 12, 10), 0, 0.106, 0), M.eyeWhite, false));
    st.add(mesh(placed(new THREE.SphereGeometry(0.0115, 10, 8), 0.011, 0.109, 0.016), M.pupil, false));
    body.add(st);
    stalks.push(st);
  }
  // spiral shell
  const shell = new THREE.Group();
  shell.position.set(-0.03, 0.135, 0);
  shell.add(mesh(placed(new THREE.SphereGeometry(0.095, 22, 16), 0, 0, 0, 0, 0, 0, 1, 1, 0.78), M.snailShell));
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const a = (i / 80) * Math.PI * 2 * 2.6;
    const r = 0.088 * (1 - i / 92);
    pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0.074 - 0.03 * (i / 80)));
  }
  shell.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.01, 6, false), M.snailShellDark, false));
  body.add(shell);
  return { root, body, shell, stalks };
}
