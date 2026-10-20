// Stylised rounded characters built from primitives. Local "front" is +z; limbs hang along -y.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as T from '../lib/textures.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });
const cap = (r, len, seg = 20) => new THREE.CapsuleGeometry(r, len, 6, seg);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function mesh(parent, geo, material, x = 0, y = 0, z = 0, o = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) m.scale.set(...o.scale);
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.receive !== false;
  parent.add(m);
  return m;
}

function group(parent, x = 0, y = 0, z = 0, name) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (name) g.name = name;
  parent.add(g);
  return g;
}

// ---------------------------------------------------------------- shared pieces
function buildFace(head, R, P, { eyeR = 0.032, smile = 0.034, blush = true }) {
  const face = {};
  const sclera = std(0xfdfbf7, { roughness: 0.25 });
  const iris = std(P.iris, { roughness: 0.3 });
  const pupil = std(0x0b0b0d, { roughness: 0.2 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff });
  face.eyes = [];
  for (const s of [-1, 1]) {
    const e = group(head, s * R * 0.36, R * 0.06, R * 0.83);
    e.rotation.y = s * 0.2;
    mesh(e, new THREE.SphereGeometry(eyeR, 24, 16), sclera, 0, 0, 0, { scale: [1, 1.18, 0.55], cast: false });
    const ir = mesh(e, new THREE.SphereGeometry(eyeR * 0.6, 20, 14), iris, 0, -eyeR * 0.05, eyeR * 0.36, { scale: [1, 1.1, 0.4], cast: false });
    const pu = mesh(e, new THREE.SphereGeometry(eyeR * 0.34, 16, 12), pupil, 0, -eyeR * 0.05, eyeR * 0.47, { scale: [1, 1.1, 0.4], cast: false });
    mesh(e, new THREE.SphereGeometry(eyeR * 0.13, 10, 8), glint, eyeR * 0.22, eyeR * 0.28, eyeR * 0.55, { cast: false });
    // eyelid (skin) for blinks: a squashed sphere cap that scales down over the eye
    const lid = mesh(e, new THREE.SphereGeometry(eyeR * 1.06, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(P.skin, { roughness: 0.6 }), 0, 0, 0.0, { scale: [1.04, 0.05, 0.62], cast: false });
    face.eyes.push({ root: e, iris: ir, pupil: pu, lid });
    const brow = mesh(head, cap(0.0065, eyeR * 1.2, 8), std(P.hair, { roughness: 0.8 }), s * R * 0.36, R * 0.38, R * 0.86, { rot: [0, 0, Math.PI / 2 + s * 0.12], cast: false });
    face.eyes[face.eyes.length - 1].brow = brow;
  }
  mesh(head, new THREE.SphereGeometry(R * 0.11, 14, 10), std(P.skinDark, { roughness: 0.55 }), 0, -R * 0.14, R * 0.98, { scale: [1, 0.85, 0.9], cast: false });
  // smile (torus arc) + open mouth (for laughing / talking)
  const smileMesh = mesh(head, new THREE.TorusGeometry(smile, R * 0.035, 8, 24, Math.PI * 0.82), std(0x6e2f2a, { roughness: 0.5 }), 0, -R * 0.33, R * 0.9, { rot: [0.25, 0, Math.PI + Math.PI * 0.09], cast: false });
  const mouthOpen = group(head, 0, -R * 0.36, R * 0.9);
  mouthOpen.rotation.x = 0.25;
  mesh(mouthOpen, new THREE.CircleGeometry(smile * 1.05, 24, Math.PI, Math.PI), std(0x4a1c1c, { roughness: 0.6, side: THREE.DoubleSide }), 0, 0.0, 0.004, { cast: false });
  mesh(mouthOpen, new THREE.CircleGeometry(smile * 0.55, 20, Math.PI, Math.PI), std(0xd9707a, { roughness: 0.6, side: THREE.DoubleSide }), 0, -smile * 0.42, 0.007, { cast: false });
  mouthOpen.visible = false;
  face.smile = smileMesh; face.mouthOpen = mouthOpen;
  if (blush) {
    const bl = new THREE.MeshBasicMaterial({ color: 0xff7f78, map: T.radialSprite({ size: 64 }), transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    for (const s of [-1, 1]) mesh(head, new THREE.CircleGeometry(R * 0.16, 20), bl, s * R * 0.6, -R * 0.2, R * 0.8, { rot: [0, s * 0.62, 0], cast: false });
  }
  for (const s of [-1, 1]) mesh(head, new THREE.SphereGeometry(R * 0.2, 14, 10), std(P.skin, { roughness: 0.6 }), s * R * 0.97, -R * 0.05, 0, { scale: [0.5, 1, 0.8] });
  return face;
}

function makeArm(parent, side, P, M, { upper = 0.24, fore = 0.22, r1 = 0.052, r2 = 0.046, handR = 0.046 }) {
  const shoulder = group(parent, side * 0.0, 0, 0);
  mesh(shoulder, new THREE.SphereGeometry(r1 * 1.15, 16, 12), M.sleeve, 0, 0, 0);
  mesh(shoulder, cap(r1, upper - r1), M.sleeve, 0, -upper / 2, 0);
  const elbow = group(shoulder, 0, -upper, 0);
  mesh(elbow, new THREE.SphereGeometry(r1 * 0.95, 14, 10), M.sleeve, 0, 0, 0);
  mesh(elbow, cap(r2, fore - r2), M.sleeve, 0, -fore / 2, 0);
  mesh(elbow, new THREE.TorusGeometry(r2 * 0.92, r2 * 0.28, 8, 20), M.cuff || M.sleeve, 0, -fore + 0.01, 0, { rot: [Math.PI / 2, 0, 0] });
  const hand = group(elbow, 0, -fore - handR * 0.6, 0);
  mesh(hand, new THREE.SphereGeometry(handR, 18, 14), M.skin, 0, 0, 0, { scale: [0.95, 1.15, 0.72] });
  mesh(hand, cap(handR * 0.32, handR * 0.6, 10), M.skin, side * -handR * 0.85, handR * 0.2, handR * 0.25, { rot: [0.4, 0, side * 0.5] });
  return { shoulder, elbow, hand, upper, fore: fore + handR * 0.6 };
}

// Two-bone IK in the shoulder's parent space. target: Vector3 (world). pole: Vector3 (parent space dir).
const _q = new THREE.Quaternion(), _down = V(0, -1, 0);
export function solveArm(arm, targetWorld, poleLocal) {
  const parent = arm.shoulder.parent;
  parent.updateWorldMatrix(true, false);
  const T = parent.worldToLocal(targetWorld.clone());
  const S = arm.shoulder.position.clone();
  const a = arm.upper, b = arm.fore;
  const ST = T.clone().sub(S);
  const d = Math.min(Math.max(ST.length(), Math.abs(a - b) + 1e-3), a + b - 1e-3);
  const dir = ST.normalize();
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const A = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const n = new THREE.Vector3().crossVectors(dir, poleLocal).normalize();
  if (n.lengthSq() < 1e-6) n.set(1, 0, 0);
  const elbowDir = dir.clone().applyAxisAngle(n, -A);
  // make sure the elbow bends towards the pole
  if (elbowDir.dot(poleLocal) < dir.dot(poleLocal)) elbowDir.copy(dir).applyAxisAngle(n, A);
  arm.shoulder.quaternion.setFromUnitVectors(_down, elbowDir);
  const E = S.clone().add(elbowDir.clone().multiplyScalar(a));
  const foreDirParent = T.clone().sub(E).normalize();
  const inv = arm.shoulder.quaternion.clone().invert();
  arm.elbow.quaternion.setFromUnitVectors(_down, foreDirParent.applyQuaternion(inv));
}

// ---------------------------------------------------------------- MOM
export function buildMom({ shadowOnly = false } = {}) {
  const P = { skin: 0xf0c4a0, skinDark: 0xe2a582, hair: 0x3f2416, iris: 0x5a3b22 };
  const kn = T.knit({ base: 0xb5855a, seed: 81 });
  const M = {
    skin: std(P.skin, { roughness: 0.55 }),
    sleeve: std(0xffffff, { map: kn.map, bumpMap: kn.bump, bumpScale: 0.7, roughness: 0.95 }),
    cuff: std(0x9c6f48, { roughness: 0.95 }),
    jeans: std(0xffffff, { map: T.denim({ seed: 82 }), roughness: 0.85 }),
    apron: std(0x4f8a86, { roughness: 0.8 }),
    top: std(0x5d7f9a, { roughness: 0.8 }),
    hair: std(P.hair, { roughness: 0.55 }),
    slipper: std(0x8c5a3c, { roughness: 0.9 }),
    wood: std(0xc49260, { roughness: 0.5 }),
  };
  const root = new THREE.Group();
  root.name = 'mom';
  const hips = group(root, 0, 0.86, 0, 'hips');
  mesh(hips, new THREE.SphereGeometry(0.155, 24, 16), M.jeans, 0, 0.0, 0, { scale: [1.05, 0.72, 0.82] });
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = group(hips, s * 0.085, -0.02, 0);
    mesh(leg, cap(0.07, 0.3), M.jeans, 0, -0.2, 0);
    const knee = group(leg, 0, -0.4, 0);
    mesh(knee, cap(0.058, 0.3), M.jeans, 0, -0.18, 0);
    mesh(knee, new RoundedBoxGeometry(0.1, 0.07, 0.22, 3, 0.03), M.slipper, 0, -0.36, 0.04);
    legs.push({ leg, knee });
  }
  const spine = group(hips, 0, 0.06, 0, 'spine');
  const chest = group(spine, 0, 0.2, 0, 'chest');
  const torso = [[0.0, -0.36], [0.172, -0.355], [0.18, -0.33], [0.158, -0.2], [0.138, -0.08], [0.145, 0.02], [0.158, 0.1], [0.165, 0.15], [0.15, 0.19], [0.1, 0.225], [0.05, 0.24], [0.0, 0.243]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  mesh(chest, new THREE.LatheGeometry(torso, 36), M.sleeve, 0, 0, 0, { scale: [1.12, 1, 0.74] });
  for (const s of [-1, 1]) mesh(chest, new THREE.SphereGeometry(0.06, 16, 12), M.sleeve, s * 0.165, 0.15, 0, { scale: [1.15, 0.8, 0.95] });
  mesh(chest, new RoundedBoxGeometry(0.2, 0.2, 0.02, 3, 0.008), M.apron, 0, 0.07, 0.106, { rot: [-0.12, 0, 0] });
  mesh(chest, new THREE.TorusGeometry(0.058, 0.02, 10, 28), M.sleeve, 0, 0.215, 0.0, { rot: [Math.PI / 2 - 0.15, 0, 0], scale: [1.1, 1, 1] });
  // apron: wraps the front, neck strap, waist tie with a bow at the back
  mesh(chest, new THREE.CylinderGeometry(0.165, 0.2, 0.62, 28, 1, true, -0.95, 1.9), std(0x4f8a86, { roughness: 0.85, side: THREE.DoubleSide }), 0, -0.24, 0.006, { scale: [1.12, 1, 0.8] });
  mesh(chest, new THREE.TorusGeometry(0.155, 0.007, 6, 40), M.apron, 0, -0.1, 0, { rot: [Math.PI / 2, 0, 0], scale: [1.0, 0.76, 1] });
  mesh(chest, new THREE.TorusGeometry(0.075, 0.008, 6, 20, Math.PI), M.apron, 0, 0.165, 0.055, { rot: [-0.45, 0, 0] });
  const bow = group(chest, 0, -0.1, -0.118);
  for (const s of [-1, 1]) {
    mesh(bow, new THREE.TorusGeometry(0.03, 0.011, 8, 16), M.apron, s * 0.032, 0.005, 0, { scale: [1.2, 0.75, 0.6], rot: [0, 0, s * 0.3] });
    mesh(bow, new RoundedBoxGeometry(0.025, 0.11, 0.008, 2, 0.004), M.apron, s * 0.018, -0.06, -0.004, { rot: [0, 0, s * 0.25] });
  }
  mesh(bow, new THREE.SphereGeometry(0.014, 10, 8), M.apron, 0, 0.005, 0);
  const neck = group(chest, 0, 0.22, 0, 'neck');
  mesh(neck, new THREE.CylinderGeometry(0.045, 0.05, 0.09, 16), M.skin, 0, 0.04, 0);
  const head = group(neck, 0, 0.19, 0.0, 'head');
  const R = 0.135;
  mesh(head, new THREE.SphereGeometry(R, 40, 30), M.skin, 0, 0, 0, { scale: [1, 1.04, 0.98] });
  const face = buildFace(head, R, P, { eyeR: 0.033, smile: 0.036 });
  // hair: cap + bangs + ponytail
  mesh(head, new THREE.SphereGeometry(R * 1.06, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.52), M.hair, 0, R * 0.02, -R * 0.02, { rot: [-0.55, 0, 0] });
  for (const [bx, by, rz] of [[-0.055, 0.075, 0.5], [0.0, 0.088, 0.0], [0.055, 0.075, -0.5]])
    mesh(head, new THREE.SphereGeometry(0.06, 16, 12), M.hair, bx, by, R * 0.72, { scale: [1.1, 0.55, 0.5], rot: [0, 0, rz] });
  for (const s of [-1, 1]) mesh(head, new THREE.SphereGeometry(0.06, 14, 10), M.hair, s * R * 0.88, R * 0.25, -R * 0.1, { scale: [0.45, 1.0, 0.9] });
  const tieMat = std(0x241510, { roughness: 0.5 });
  const pony = group(head, 0, R * 0.3, -R * 1.02, 'pony');
  pony.rotation.x = 1.0;
  mesh(pony, new THREE.TorusGeometry(0.022, 0.01, 10, 20), tieMat, 0, 0, 0, { rot: [Math.PI / 2, 0, 0] });
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  mesh(pony, lathe([[0.0, 0.01], [0.022, 0.005], [0.032, -0.04], [0.04, -0.09], [0.0, -0.1]]), M.hair, 0, 0, 0, { scale: [1.1, 1, 0.8] });
  const pony2 = group(pony, 0, -0.09, 0);
  pony2.rotation.x = -0.8;
  mesh(pony2, lathe([[0.0, 0.02], [0.04, 0.0], [0.046, -0.05], [0.038, -0.11], [0.02, -0.17], [0.004, -0.2], [0.0, -0.202]]), M.hair, 0, 0, 0, { scale: [1.15, 1, 0.8] });
  // arms
  const arms = {};
  for (const [side, name] of [[-1, 'R'], [1, 'L']]) { // facing +z: her right arm is at -x
    const a = makeArm(chest, side, P, M, { r1: 0.046, r2: 0.04, handR: 0.042 });
    a.shoulder.position.set(side * 0.19, 0.145, 0);
    arms[name] = a;
  }
  // wooden spoon in her right hand
  const spoon = group(arms.R.hand, 0, -0.01, 0.02, 'spoon');
  mesh(spoon, new THREE.CylinderGeometry(0.008, 0.01, 0.3, 10), M.wood, 0, -0.1, 0);
  mesh(spoon, new THREE.SphereGeometry(0.03, 16, 10), M.wood, 0, -0.26, 0.0, { scale: [0.85, 1.35, 0.35] });
  const rig = { root, hips, spine, chest, neck, head, face, arms, legs, spoon, pony, pony2, materials: M };
  if (shadowOnly) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.colorWrite = false;
      o.material.depthWrite = false;
      o.receiveShadow = false;
      o.castShadow = true;
    });
  }
  return rig;
}

// ---------------------------------------------------------------- YOU (sitting, hoodie)
export function buildYou() {
  const P = { skin: 0xe9b995, skinDark: 0xdc9f7a, hair: 0x3b2618, iris: 0x3a2a1e };
  const fl = T.fleece({ base: 0xd99a2b, seed: 91 });
  const M = {
    skin: std(P.skin, { roughness: 0.55 }),
    sleeve: std(0xffffff, { map: fl, roughness: 0.95 }),
    cuff: std(0xc4871f, { roughness: 0.95 }),
    pants: std(0x3a3f47, { roughness: 0.9 }),
    sock: std(0xf1eee8, { roughness: 0.95 }),
    hair: std(P.hair, { roughness: 0.6 }),
    string: std(0xf3efe6, { roughness: 0.8 }),
  };
  const root = new THREE.Group();
  root.name = 'you';
  const hips = group(root, 0, 0.55, 0, 'hips');
  mesh(hips, new THREE.SphereGeometry(0.16, 20, 14), M.pants, 0, 0, 0, { scale: [1.05, 0.7, 0.9] });
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = group(hips, s * 0.09, -0.02, 0);
    leg.rotation.x = -Math.PI / 2 + 0.08; // thighs forward
    mesh(leg, cap(0.07, 0.28), M.pants, 0, -0.19, 0);
    const knee = group(leg, 0, -0.38, 0);
    knee.rotation.x = Math.PI / 2 - 0.05; // shins down
    mesh(knee, cap(0.06, 0.3), M.pants, 0, -0.2, 0);
    mesh(knee, new RoundedBoxGeometry(0.1, 0.08, 0.2, 3, 0.035), M.sock, 0, -0.42, 0.05);
    legs.push({ leg, knee });
  }
  const spine = group(hips, 0, 0.06, -0.02, 'spine');
  const chest = group(spine, 0, 0.2, 0, 'chest');
  mesh(chest, cap(0.17, 0.22, 24), M.sleeve, 0, 0, 0, { scale: [1.06, 1, 0.82] });
  mesh(chest, new RoundedBoxGeometry(0.22, 0.11, 0.05, 3, 0.02), M.sleeve, 0, -0.13, 0.12);
  for (const s of [-1, 1]) {
    mesh(chest, new THREE.CylinderGeometry(0.005, 0.005, 0.16, 6), M.string, s * 0.04, 0.08, 0.145, { rot: [0.1, 0, 0] });
    mesh(chest, new THREE.CylinderGeometry(0.008, 0.008, 0.025, 8), M.string, s * 0.04, -0.0, 0.153);
  }
  // hood bunched behind the neck
  mesh(chest, new THREE.TorusGeometry(0.11, 0.055, 12, 24, Math.PI * 1.3), M.sleeve, 0, 0.22, -0.02, { rot: [Math.PI / 2 + 0.25, 0, Math.PI * 0.85] });
  mesh(chest, new THREE.SphereGeometry(0.12, 16, 12), M.sleeve, 0, 0.24, -0.13, { scale: [1.15, 0.8, 0.6] });
  const neck = group(chest, 0, 0.2, 0, 'neck');
  mesh(neck, new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14), M.skin, 0, 0.03, 0);
  const head = group(neck, 0, 0.2, 0.01, 'head');
  const R = 0.15;
  mesh(head, new THREE.SphereGeometry(R, 40, 30), M.skin, 0, 0, 0, { scale: [1, 1.02, 0.98] });
  const face = buildFace(head, R, P, { eyeR: 0.037, smile: 0.034 });
  mesh(head, new THREE.SphereGeometry(R * 1.06, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair, 0, R * 0.04, -R * 0.03, { rot: [-0.28, 0, 0] });
  const tufts = [[-0.07, 0.13, 0.06], [0.0, 0.15, 0.07], [0.07, 0.13, 0.05], [-0.04, 0.16, -0.03], [0.05, 0.155, -0.02], [0.0, 0.14, -0.1]];
  for (const [x, y, z] of tufts) mesh(head, new THREE.SphereGeometry(0.055, 12, 10), M.hair, x, y, z, { scale: [1, 0.6, 1] });
  const arms = {};
  for (const [side, name] of [[-1, 'R'], [1, 'L']]) {
    const a = makeArm(chest, side, P, M, { upper: 0.22, fore: 0.2, r1: 0.055, r2: 0.05, handR: 0.045 });
    a.shoulder.position.set(side * 0.21, 0.12, 0);
    arms[name] = a;
  }
  // a few popcorn pieces in the right hand
  const handful = group(arms.R.hand, 0, -0.02, 0.03);
  const popMat = std(0xf3e2b0, { roughness: 0.8 });
  for (const [x, y, z] of [[0, 0, 0.02], [0.02, 0.012, 0.0], [-0.018, 0.008, 0.01]])
    mesh(handful, new THREE.IcosahedronGeometry(0.018, 1), popMat, x, y, z, { cast: false });
  return { root, hips, spine, chest, neck, head, face, arms, legs, handful, materials: M };
}

// ---------------------------------------------------------------- shared pose helpers
export function setBlink(face, amount) {
  // amount 0 = open, 1 = closed
  for (const e of face.eyes) { e.lid.visible = amount > 0.03; e.lid.scale.y = 0.05 + amount * 1.1; }
}

export function setMouth(face, open) {
  face.mouthOpen.visible = open > 0.05;
  face.smile.visible = open <= 0.05;
  face.mouthOpen.scale.set(1, 0.4 + open * 0.9, 1);
}

export function setPupils(face, scale) {
  for (const e of face.eyes) e.pupil.scale.set(scale, scale * 1.1, 0.4);
}

export function setLayer(root, layer) {
  root.traverse((o) => { o.layers.set(layer); });
}
