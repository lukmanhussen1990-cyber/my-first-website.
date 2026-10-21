// Stylized toy-like characters (John, Dad, neighbors) built from smooth primitives with simple joints.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { knit, noiseTex } from './textures.js';
import { rng, canvas, tex, fbm } from './util.js';

const TAU = Math.PI * 2;

function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6, metalness: 0, ...o });
}
function phys(color, o = {}) {
  return new THREE.MeshPhysicalMaterial({ color: new THREE.Color(color), roughness: 0.5, metalness: 0, ...o });
}
function skinMat(color) {
  const c = new THREE.Color(color);
  return phys(color, { roughness: 0.48, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffb59a'), emissive: c.clone().multiplyScalar(0.06), clearcoat: 0.08, clearcoatRoughness: 0.6 });
}
function fabric(color, seed = 1, rough = 0.9) {
  const c = new THREE.Color(color);
  const srgb = c.clone().convertLinearToSRGB();
  const t = knit([srgb.r * 255, srgb.g * 255, srgb.b * 255], seed);
  return phys('#ffffff', { map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: rough, sheen: 0.5, sheenRoughness: 0.8, sheenColor: c.clone().lerp(new THREE.Color('#ffffff'), 0.3) });
}
function hairMat(color) {
  const t = noiseTex('hair' + color, [255, 255, 255], 8, 0.25, 2.5, 256, 12);
  return phys(color, { roughness: 0.45, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.8, 0.8), sheen: 0.6, sheenColor: new THREE.Color('#d9a066'), sheenRoughness: 0.4, clearcoat: 0.2, clearcoatRoughness: 0.5 });
}
function mesh(geo, mat, pos = [0, 0, 0], scale = null, rot = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  if (rot) m.rotation.set(...rot);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function joint(parent, pos) { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; }
const capsule = (r, l) => new THREE.CapsuleGeometry(r, l, 8, 20);
let LOD = 1;
const sphere = (r, w = 32, h = 24) => new THREE.SphereGeometry(r, Math.max(8, Math.round(w * LOD)), Math.max(6, Math.round(h * LOD)));

// ---------------- Face ----------------
function buildFace(head, c, R, opt) {
  const face = {};
  const white = phys('#ffffff', { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const irisMat = phys(opt.iris || '#5b3a1e', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 });
  const pupilMat = phys('#0b0a0a', { roughness: 0.1, clearcoat: 1 });
  const glint = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.95, 0.95) });
  const lidMat = opt.skin;
  const er = opt.eyeR ?? 0.07;
  const eyeX = opt.eyeX ?? 0.088;
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(c[0] + side * eyeX, c[1] + (opt.eyeY ?? -0.005), c[2] + R * 0.81);
    head.add(pivot);
    const ball = new THREE.Group(); pivot.add(ball);
    ball.add(mesh(sphere(er, 32, 24), white));
    const irisGeo = new THREE.SphereGeometry(er * 1.008, 32, 8, 0, TAU, 0, 0.66);
    irisGeo.rotateX(Math.PI / 2);
    const iris = mesh(irisGeo, irisMat); ball.add(iris);
    const pupGeo = new THREE.SphereGeometry(er * 1.016, 24, 6, 0, TAU, 0, 0.32);
    pupGeo.rotateX(Math.PI / 2);
    const pupil = mesh(pupGeo, pupilMat); ball.add(pupil);
    const g1 = new THREE.Mesh(sphere(er * 0.17, 12, 8), glint); g1.position.set(-er * 0.32, er * 0.38, er * 0.93); pivot.add(g1);
    const g2 = new THREE.Mesh(sphere(er * 0.08, 8, 6), glint); g2.position.set(er * 0.28, -er * 0.3, er * 0.97); pivot.add(g2);
    // eyelids (upper + lower), hemispheres rotated about x
    const lidGeo = new THREE.SphereGeometry(er * 1.07, 32, 12, 0, TAU, 0, Math.PI / 2);
    const lid = mesh(lidGeo, lidMat); pivot.add(lid);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(er * 1.075, er * 0.075, 6, 32, Math.PI * 0.92), new THREE.MeshStandardMaterial({ color: '#2a160c', roughness: 0.6 }));
    lash.rotation.x = Math.PI / 2; lash.rotation.z = Math.PI * 0.04; lid.add(lash);
    const lowGeo = new THREE.SphereGeometry(er * 1.06, 32, 12, 0, TAU, 0, Math.PI / 2);
    const low = mesh(lowGeo, lidMat); low.rotation.x = Math.PI; pivot.add(low);
    // eyebrow
    const brow = mesh(capsule(0.0145, 0.062), std(opt.brow || '#4a2a14', { roughness: 0.7 }));
    brow.rotation.z = Math.PI / 2;
    const browPivot = new THREE.Group();
    browPivot.position.set(c[0] + side * (eyeX + 0.005), c[1] + (opt.browY ?? 0.098), c[2] + R * 0.88);
    browPivot.rotation.x = -0.25;
    browPivot.add(brow); head.add(browPivot);
    const key = side < 0 ? 'R' : 'L';
    face['eye' + key] = ball; face['lid' + key] = lid; face['low' + key] = low; face['brow' + key] = browPivot; face['pivot' + key] = pivot;
    face['glints' + key] = [g1, g2];
  }
  // nose
  head.add(mesh(sphere(0.032, 20, 14), opt.nose || opt.skin, [c[0], c[1] - 0.035, c[2] + R * 0.98], [1, 0.85, 0.9]));
  // cheeks blush
  const blush = std('#f08a7a', { roughness: 0.7, transparent: true, opacity: 0.55, depthWrite: false });
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(sphere(0.042, 16, 10), blush);
    b.position.set(c[0] + s * 0.15, c[1] - 0.065, c[2] + R * 0.79); b.scale.set(1, 0.6, 0.35);
    const nrm = new THREE.Vector3(s * 0.15, -0.065, R * 0.79).normalize();
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    head.add(b);
  }
  // mouth group
  const mouth = new THREE.Group();
  mouth.position.set(c[0], c[1] - 0.115, c[2] + R * 0.9);
  mouth.rotation.x = 0.42;
  head.add(mouth);
  const lipMat = std('#7a2b22', { roughness: 0.5 });
  const smileGeo = new THREE.TorusGeometry(0.052, 0.0105, 8, 32, Math.PI * 0.85);
  smileGeo.rotateZ(Math.PI + Math.PI * 0.075);
  const smile = mesh(smileGeo, lipMat); smile.position.y = 0.035; mouth.add(smile);
  const open = new THREE.Group(); mouth.add(open);
  const inner = mesh(sphere(0.05, 24, 16), std('#4a0d12', { roughness: 0.6 }), [0, 0, -0.008], [1.15, 0.9, 0.45]);
  open.add(inner);
  const tongue = mesh(sphere(0.035, 16, 12), std('#e06a78', { roughness: 0.5 }), [0, -0.028, 0.008], [1.1, 0.5, 0.6]);
  open.add(tongue);
  const teeth = mesh(new RoundedBoxGeometry(0.07, 0.018, 0.02, 2, 0.006), std('#fbfbf6', { roughness: 0.3 }), [0, 0.03, 0.006]);
  open.add(teeth);
  face.mouth = mouth; face.smile = smile; face.open = open;
  return face;
}

export function setFace(face, p) {
  // p: { blink 0..1, lid 0..1 (upper lid closure), low 0..1, look:[yaw,pitch], brow: angle, browY, smile, open, wide }
  const lid = Math.min(1, Math.max(0, Math.max(p.lid ?? 0.12, p.blink ?? 0)));
  for (const k of ['L', 'R']) {
    const s = k === 'L' ? 1 : -1;
    face['lid' + k].rotation.x = -1.45 + lid * 2.85;
    face['low' + k].rotation.x = Math.PI - 1.35 + (p.low ?? 0.05) * 1.3;
    const look = p.look || [0, 0];
    face['eye' + k].rotation.set(-look[1], look[0], 0);
    const b = face['brow' + k];
    b.rotation.z = -s * (p.brow ?? 0); // brow>0: inner ends up (worried/surprised), brow<0: angry V
    b.position.y = (face._browY0 ??= b.position.y) + (p.browY ?? 0);
    const glints = face['glints' + k];
    const vis = lid < 0.75;
    glints.forEach((g) => (g.visible = vis));
  }
  const sm = p.smile ?? 0.6, op = p.open ?? 0;
  face.smile.visible = op < 0.45;
  face.smile.scale.set(0.7 + sm * 0.5, Math.max(0.05, sm), 1);
  face.open.visible = op >= 0.08;
  face.open.scale.set(0.75 + op * 0.25, Math.max(0.05, op), 1);
}

// ---------------- John ----------------
export function makeJohn() {
  const skin = skinMat('#e7a882');
  const hoodie = fabric('#d32a24', 3, 0.85);
  const hoodieDark = fabric('#a81d1a', 4, 0.88);
  const pants = fabric('#2b3446', 5, 0.9);
  const shoeWhite = phys('#f4f4f2', { roughness: 0.45, clearcoat: 0.3 });
  const shoeRed = phys('#e2342b', { roughness: 0.4, clearcoat: 0.4 });
  const sole = std('#c9cbd0', { roughness: 0.75 });
  const hair = hairMat('#5a3418');

  const root = new THREE.Group(); root.name = 'John';
  const J = {};
  J.hips = joint(root, [0, 0.468, 0]);
  J.hips.add(mesh(sphere(0.15), pants, [0, 0.0, 0], [1.15, 0.75, 0.9]));
  J.spine = joint(J.hips, [0, 0.04, 0]);
  J.spine.add(mesh(capsule(0.17, 0.15), hoodie, [0, 0.17, 0], [1.0, 1.0, 0.85]));
  // hoodie waistband & pocket & hood
  J.spine.add(mesh(new THREE.TorusGeometry(0.165, 0.03, 12, 40), hoodieDark, [0, 0.03, 0], [1, 0.85, 1], [Math.PI / 2, 0, 0]));
  J.spine.add(mesh(new RoundedBoxGeometry(0.2, 0.09, 0.03, 3, 0.012), hoodieDark, [0, 0.09, 0.142], null, [-0.18, 0, 0]));
  const hood = mesh(new THREE.TorusGeometry(0.115, 0.055, 14, 32, Math.PI * 1.25), hoodieDark, [0, 0.33, -0.07], [1.15, 1, 1], [Math.PI / 2 + 0.55, 0, Math.PI * 0.38]);
  J.spine.add(hood);
  const string = std('#f2f2f2', { roughness: 0.6 });
  for (const s of [-1, 1]) J.spine.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), string, [s * 0.04, 0.24, 0.15], null, [0.15, 0, 0]));
  J.neck = joint(J.spine, [0, 0.335, 0]);
  J.neck.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.09, 16), skin, [0, 0.02, 0]));
  J.head = joint(J.neck, [0, 0.055, 0.0]);
  const C = [0, 0.215, 0.01], R = 0.25;
  J.head.add(mesh(sphere(R, 48, 36), skin, C, [1.04, 0.98, 1.0]));
  for (const s of [-1, 1]) J.head.add(mesh(sphere(0.05, 16, 12), skin, [s * 0.255, C[1] - 0.01, C[2]], [0.45, 1, 0.8]));
  // hair: displaced cap + tufts
  const capGeo = new THREE.SphereGeometry(R * 1.06, 48, 24, 0, TAU, 0, 1.45);
  const pa = capGeo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i);
    const n = fbm(v.x * 9 + 5, v.z * 9 + 5, 64, 3, 2) - 0.5;
    v.multiplyScalar(1 + n * 0.12);
    pa.setXYZ(i, v.x, v.y, v.z);
  }
  capGeo.computeVertexNormals();
  const cap = mesh(capGeo, hair, [C[0], C[1] + 0.025, C[2] - 0.025], [1.05, 1.02, 1.05], [-0.22, 0, 0]);
  J.head.add(cap);
  const R2 = rng(42);
  // chunky swept tufts (messy, cartoon style)
  const tufts = [
    // [azimuth, elevation, length, radius, sweep]
    [1.2, 0.25, 0.2, 0.075, 0.5], [2.0, 0.35, 0.19, 0.07, 0.6], [0.4, 0.4, 0.18, 0.07, 0.5], [2.8, 0.55, 0.2, 0.075, 0.7],
    [-0.4, 0.55, 0.18, 0.07, 0.6], [3.6, 0.7, 0.19, 0.07, 0.8], [-1.2, 0.75, 0.17, 0.065, 0.7], [4.4, 0.85, 0.17, 0.065, 0.8],
    [1.6, 0.85, 0.16, 0.065, 0.9], [0.8, 1.0, 0.15, 0.06, 1.0], [2.4, 1.05, 0.15, 0.06, 1.0], [5.2, 1.1, 0.14, 0.06, 1.0],
  ];
  for (const [az, el, len, rad, sweep] of tufts) {
    const dir = new THREE.Vector3(Math.cos(az) * Math.sin(el), Math.cos(el), Math.sin(az) * Math.sin(el)).normalize();
    if (dir.z > 0.55) continue;
    const geo = new THREE.ConeGeometry(rad * 1.2, len * 0.8, 14, 3); geo.translate(0, len * 0.4, 0);
    const pa = geo.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k); const h = v.y / len; v.z -= h * h * len * 0.55; v.x *= 1.0; pa.setXYZ(k, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const tuft = mesh(geo, hair);
    tuft.position.set(C[0] + dir.x * R * 0.93, C[1] + 0.03 + dir.y * R * 0.93, C[2] + dir.z * R * 0.93 - 0.02);
    const up = dir.clone().add(new THREE.Vector3(0, 0.1, -0.85 * sweep)).normalize();
    tuft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    tuft.rotateY(az * 0.5);
    J.head.add(tuft);
  }
  // fringe: three chunky front tufts flicking up over the sweatband
  for (let i = 0; i < 3; i++) {
    const x = -0.09 + i * 0.09;
    const geo = new THREE.ConeGeometry(0.07, 0.17, 14, 3); geo.translate(0, 0.085, 0);
    const pa = geo.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k); const h = v.y / 0.17; v.z += h * h * 0.06; pa.setXYZ(k, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const t = mesh(geo, hair, [C[0] + x, C[1] + 0.21, C[2] + 0.1], null, [0.15, 0, -x * 3.2]);
    J.head.add(t);
  }
  // sweatband
  const bandC = canvas(256, 64); const bg = bandC.getContext('2d');
  bg.fillStyle = '#f7f7f4'; bg.fillRect(0, 0, 256, 64); bg.fillStyle = '#d8302a'; bg.fillRect(0, 26, 256, 12);
  for (let i = 0; i < 1200; i++) { bg.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; bg.fillRect(Math.random() * 256, Math.random() * 64, 2, 2); }
  const bandTex = tex(bandC, { repeat: [1, 1] });
  const band = mesh(new THREE.TorusGeometry(R * 0.98, 0.034, 16, 64), std('#ffffff', { map: bandTex, roughness: 0.95 }), [C[0], C[1] + 0.14, C[2] - 0.01], [1.0, 1.0, 1.0], [Math.PI / 2 - 0.08, 0, 0]);
  J.head.add(band); J.band = band;
  J.face = buildFace(J.head, C, R, { skin, iris: '#5a3a1c', brow: '#4a2a12', nose: skin });
  // sweat drop & rain drip anchors
  J.sweatAnchor = joint(J.head, [C[0] + 0.12, C[1] + 0.05, C[2] + 0.2]);

  // arms
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const sh = joint(J.spine, [s * 0.205, 0.275, 0]);
    sh.add(mesh(capsule(0.058, 0.12), hoodie, [0, -0.09, 0]));
    const el = joint(sh, [0, -0.19, 0]);
    el.add(mesh(capsule(0.052, 0.1), hoodie, [0, -0.07, 0]));
    el.add(mesh(new THREE.TorusGeometry(0.047, 0.018, 8, 20), hoodieDark, [0, -0.145, 0], null, [Math.PI / 2, 0, 0]));
    const hand = joint(el, [0, -0.18, 0]);
    hand.add(mesh(sphere(0.058, 20, 14), skin, [0, -0.02, 0.005], [0.9, 1.05, 0.95]));
    hand.add(mesh(sphere(0.024, 12, 8), skin, [-s * 0.045, -0.0, 0.03]));
    J['shoulder' + k] = sh; J['elbow' + k] = el; J['hand' + k] = hand;
  }
  // legs
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const hp = joint(J.hips, [s * 0.088, -0.035, 0]);
    hp.add(mesh(capsule(0.07, 0.12), pants, [0, -0.095, 0]));
    const kn = joint(hp, [0, -0.19, 0]);
    kn.add(mesh(capsule(0.063, 0.1), pants, [0, -0.085, 0]));
    const an = joint(kn, [0, -0.175, 0]);
    an.add(mesh(new RoundedBoxGeometry(0.115, 0.08, 0.215, 3, 0.035), shoeWhite, [0, -0.028, 0.035]));
    an.add(mesh(new RoundedBoxGeometry(0.122, 0.026, 0.226, 2, 0.012), sole, [0, -0.064, 0.035]));
    an.add(mesh(new RoundedBoxGeometry(0.118, 0.03, 0.11, 2, 0.012), shoeRed, [0, -0.02, 0.0], null, [0.35, 0, 0]));
    J['hip' + k] = hp; J['knee' + k] = kn; J['ankle' + k] = an;
  }
  root.userData.J = J;
  return { root, J, face: J.face, mats: { skin, hoodie, hoodieDark, pants, hair } };
}

// Pose John. Character faces +z locally. p contains blend weights / params.
export function poseJohn(J, p) {
  const ph = p.phase * TAU;
  const run = p.run ?? 0; // 0..1 blend into running
  const intensity = p.intensity ?? 1;
  const s = Math.sin(ph), c = Math.cos(ph);
  const A_h = 0.75 * intensity, A_s = 0.85 * intensity;
  const kneeFlex = (q) => 0.22 + 1.25 * intensity * Math.pow(Math.max(0, Math.cos(q - 0.35)), 1.5);
  const L = (a, b, t) => a + (b - a) * t;
  // run pose
  const r = {
    hipL: -A_h * s, hipR: A_h * s,
    kneeL: kneeFlex(ph), kneeR: kneeFlex(ph + Math.PI),
    ankleL: 0.25 * Math.sin(ph + 0.9), ankleR: 0.25 * Math.sin(ph + Math.PI + 0.9),
    shL: A_s * s * 0.9, shR: -A_s * s * 0.9,
    elL: -1.35 - 0.25 * Math.max(0, s), elR: -1.35 - 0.25 * Math.max(0, -s),
    lean: 0.16 + 0.12 * intensity, bob: 0.028 * intensity * Math.cos(2 * ph), twist: 0.12 * s * intensity,
  };
  const st = p.stand || {};
  const g = (k, d) => (st[k] ?? d);
  J.hipL.rotation.set(L(g('hipL', 0), r.hipL, run), 0, L(0.03, 0, run));
  J.hipR.rotation.set(L(g('hipR', 0), r.hipR, run), 0, L(-0.03, 0, run));
  J.kneeL.rotation.x = L(g('kneeL', 0.02), r.kneeL, run);
  J.kneeR.rotation.x = L(g('kneeR', 0.02), r.kneeR, run);
  J.ankleL.rotation.x = L(g('ankleL', 0), r.ankleL, run);
  J.ankleR.rotation.x = L(g('ankleR', 0), r.ankleR, run);
  J.shoulderL.rotation.set(L(g('shLx', 0.05), r.shL, run), L(g('shLy', 0), 0, run), L(g('shLz', 0.13), 0.18, run));
  J.shoulderR.rotation.set(L(g('shRx', 0.05), r.shR, run), L(g('shRy', 0), 0, run), L(g('shRz', -0.13), -0.18, run));
  J.elbowL.rotation.set(L(g('elLx', -0.12), r.elL, run), 0, L(g('elLz', 0), 0, run));
  J.elbowR.rotation.set(L(g('elRx', -0.12), r.elR, run), 0, L(g('elRz', 0), 0, run));
  J.spine.rotation.set(L(g('lean', 0), r.lean, run) + (p.extraLean ?? 0), L(g('twist', 0), r.twist, run), g('sideBend', 0) * (1 - run));
  J.hips.position.y = 0.468 + L(g('bob', 0), r.bob, run) + (p.lift ?? 0);
  J.hips.rotation.y = -r.twist * 0.5 * run;
  J.neck.rotation.set(-(L(g('lean', 0), r.lean, run)) * 0.7 + (p.headPitch ?? 0), p.headYaw ?? 0, p.headRoll ?? 0);
  J.head.rotation.set(0, 0, 0);
  if (p.pant) { J.spine.rotation.x += 0.04 * Math.sin(p.pant); J.neck.rotation.x += 0.05 * Math.sin(p.pant); }
}

// ---------------- Dad ----------------
export function makeDad() {
  const skin = skinMat('#eab08f');
  const sweater = fabric('#3f7a6e', 7, 0.92);
  const collar = std('#f4f1ea', { roughness: 0.7 });
  const pants = fabric('#b59a70', 8, 0.9);
  const hair = hairMat('#6b5a4a');
  const frame = phys('#3a2418', { roughness: 0.3, clearcoat: 0.6 });
  const lens = phys('#bcd8ff', { roughness: 0.05, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false });
  const slipper = fabric('#6b4a32', 9, 0.95);

  const root = new THREE.Group(); root.name = 'Dad';
  const J = {};
  J.hips = joint(root, [0, 0.0, 0]);
  J.hips.add(mesh(sphere(0.16), pants, [0, 0, 0], [1.15, 0.7, 1.0]));
  J.spine = joint(J.hips, [0, 0.04, 0]);
  J.spine.add(mesh(capsule(0.18, 0.15), sweater, [0, 0.17, 0], [1.02, 1, 0.9]));
  J.spine.add(mesh(new THREE.TorusGeometry(0.07, 0.022, 10, 24), collar, [0, 0.33, 0.035], [1, 1, 0.8], [Math.PI / 2 + 0.2, 0, 0]));
  J.spine.add(mesh(new THREE.TorusGeometry(0.172, 0.028, 12, 40), sweater, [0, 0.03, 0], [1, 0.9, 1], [Math.PI / 2, 0, 0]));
  J.neck = joint(J.spine, [0, 0.335, 0]);
  J.neck.add(mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 16), skin, [0, 0.02, 0]));
  J.head = joint(J.neck, [0, 0.05, 0]);
  const C = [0, 0.2, 0.01], R = 0.23;
  J.head.add(mesh(sphere(R, 48, 36), skin, C, [1.03, 1.0, 1.0]));
  for (const s of [-1, 1]) J.head.add(mesh(sphere(0.048, 16, 12), skin, [s * 0.236, C[1] - 0.01, C[2]], [0.45, 1, 0.8]));
  // neat short hair cap
  const cap = mesh(new THREE.SphereGeometry(R * 1.05, 48, 24, 0, TAU, 0, 1.2), hair, [C[0], C[1] + 0.01, C[2] - 0.03], [1.03, 1.0, 1.05], [-0.4, 0, 0]);
  J.head.add(cap);
  for (const s of [-1, 1]) J.head.add(mesh(sphere(0.07, 16, 12), hair, [s * 0.2, C[1] + 0.03, C[2] - 0.08], [0.6, 0.9, 1.1]));
  J.face = buildFace(J.head, C, R, { skin, iris: '#3d5a7a', brow: '#5a4a3c', eyeR: 0.058, eyeX: 0.082, nose: skin });
  // mustache
  J.head.add(mesh(capsule(0.022, 0.07), hair, [C[0], C[1] - 0.075, C[2] + R * 0.93], null, [0, 0, Math.PI / 2]));
  // glasses
  const gl = new THREE.Group(); gl.position.set(C[0], C[1] + 0.015, C[2] + R * 0.93); J.head.add(gl);
  for (const s of [-1, 1]) {
    gl.add(mesh(new THREE.TorusGeometry(0.06, 0.009, 10, 32), frame, [s * 0.082, 0, 0.02]));
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.058, 32), lens); l.position.set(s * 0.082, 0, 0.022); gl.add(l);
    gl.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6), frame, [s * 0.145, 0, -0.08], null, [Math.PI / 2, 0, 0]));
  }
  gl.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), frame, [0, 0.01, 0.02], null, [0, 0, Math.PI / 2]));
  J.glasses = gl;
  // arms
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const sh = joint(J.spine, [s * 0.215, 0.27, 0]);
    sh.add(mesh(capsule(0.06, 0.12), sweater, [0, -0.09, 0]));
    const el = joint(sh, [0, -0.19, 0]);
    el.add(mesh(capsule(0.054, 0.1), sweater, [0, -0.07, 0]));
    const hand = joint(el, [0, -0.17, 0]);
    hand.add(mesh(sphere(0.058, 20, 14), skin, [0, -0.02, 0], [0.9, 1.05, 0.95]));
    J['shoulder' + k] = sh; J['elbow' + k] = el; J['hand' + k] = hand;
  }
  // remote in right hand
  const remote = new THREE.Group();
  remote.add(mesh(new RoundedBoxGeometry(0.05, 0.022, 0.16, 2, 0.01), phys('#202226', { roughness: 0.35, clearcoat: 0.5 })));
  const btn = mesh(sphere(0.009, 10, 8), std('#e53935', { emissive: new THREE.Color('#e53935'), emissiveIntensity: 0.4 }), [0, 0.012, 0.05]);
  remote.add(btn);
  remote.position.set(0.0, -0.05, 0.05); remote.rotation.set(-0.3, 0, 0);
  J.handR.add(remote); J.remote = remote; J.remoteBtn = btn;
  // legs (seated)
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const hp = joint(J.hips, [s * 0.09, -0.03, 0]);
    hp.add(mesh(capsule(0.072, 0.13), pants, [0, -0.1, 0]));
    const kn = joint(hp, [0, -0.2, 0]);
    kn.add(mesh(capsule(0.064, 0.12), pants, [0, -0.09, 0]));
    const an = joint(kn, [0, -0.19, 0]);
    an.add(mesh(new RoundedBoxGeometry(0.11, 0.07, 0.2, 3, 0.03), slipper, [0, -0.02, 0.04]));
    J['hip' + k] = hp; J['knee' + k] = kn; J['ankle' + k] = an;
  }
  // seated pose defaults
  J.hipL.rotation.set(-1.5, 0.08, 0); J.hipR.rotation.set(-1.5, -0.08, 0);
  J.kneeL.rotation.x = 1.5; J.kneeR.rotation.x = 1.5;
  J.ankleL.rotation.x = 0.0; J.ankleR.rotation.x = 0.0;
  J.shoulderL.rotation.set(-0.35, 0, 0.2); J.elbowL.rotation.set(-0.9, 0, 0);
  J.shoulderR.rotation.set(-0.45, 0, -0.15); J.elbowR.rotation.set(-0.95, 0, 0);
  root.userData.J = J;
  return { root, J, face: J.face };
}

// ---------------- Neighbor (bust, in a window) ----------------
export function makeNeighbor(o) {
  LOD = 0.4;
  const out = makeNeighborHi(o);
  LOD = 1;
  out.root.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
  return out;
}
function makeNeighborHi(o) {
  const skin = skinMat(o.skin);
  const shirt = fabric(o.shirt, o.seed || 1, 0.9);
  const hair = hairMat(o.hair);
  const root = new THREE.Group();
  const J = {};
  J.spine = joint(root, [0, 0, 0]);
  J.spine.add(mesh(capsule(0.16, 0.12), shirt, [0, 0.12, 0], [1, 1, 0.85]));
  J.neck = joint(J.spine, [0, 0.29, 0]);
  J.neck.add(mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 14), skin, [0, 0.02, 0]));
  J.head = joint(J.neck, [0, 0.05, 0]);
  const C = [0, 0.19, 0.01], R = 0.215;
  J.head.add(mesh(sphere(R, 40, 30), skin, C));
  const style = o.style || 'short';
  if (style === 'bun') {
    J.head.add(mesh(new THREE.SphereGeometry(R * 1.06, 40, 20, 0, TAU, 0, 1.5), hair, [C[0], C[1] + 0.01, C[2] - 0.02], null, [-0.3, 0, 0]));
    J.head.add(mesh(sphere(0.09), hair, [C[0], C[1] + 0.2, C[2] - 0.1]));
  } else if (style === 'curly') {
    const Rr = rng(o.seed || 3);
    for (let i = 0; i < 26; i++) {
      const a = Rr() * TAU, el = Rr() * 1.4;
      const d = new THREE.Vector3(Math.cos(a) * Math.sin(el), Math.cos(el), Math.sin(a) * Math.sin(el) - 0.3).normalize();
      J.head.add(mesh(sphere(0.075, 14, 10), hair, [C[0] + d.x * R, C[1] + 0.03 + d.y * R, C[2] + d.z * R]));
    }
  } else if (style === 'long') {
    J.head.add(mesh(new THREE.SphereGeometry(R * 1.07, 40, 20, 0, TAU, 0, 1.55), hair, [C[0], C[1] + 0.01, C[2] - 0.03], null, [-0.35, 0, 0]));
    J.head.add(mesh(capsule(0.17, 0.2), hair, [C[0], C[1] - 0.12, C[2] - 0.1], [1.15, 1, 0.6]));
  } else if (style === 'bald') {
    for (const s of [-1, 1]) J.head.add(mesh(sphere(0.07), hair, [s * 0.19, C[1] - 0.0, C[2] - 0.05], [0.6, 0.9, 1.1]));
  } else {
    J.head.add(mesh(new THREE.SphereGeometry(R * 1.06, 40, 20, 0, TAU, 0, 1.25), hair, [C[0], C[1] + 0.01, C[2] - 0.02], null, [-0.35, 0, 0]));
  }
  J.face = buildFace(J.head, C, R, { skin, iris: o.iris || '#4a2e1a', brow: o.hair, eyeR: 0.058, eyeX: 0.078, nose: skin });
  // arms holding a candle
  for (const [k, s] of [['L', 1], ['R', -1]]) {
    const sh = joint(J.spine, [s * 0.19, 0.22, 0]);
    sh.add(mesh(capsule(0.052, 0.11), shirt, [0, -0.08, 0]));
    const el = joint(sh, [0, -0.17, 0]);
    el.add(mesh(capsule(0.047, 0.09), shirt, [0, -0.06, 0]));
    const hand = joint(el, [0, -0.15, 0]);
    hand.add(mesh(sphere(0.05, 16, 12), skin, [0, -0.015, 0]));
    J['shoulder' + k] = sh; J['elbow' + k] = el; J['hand' + k] = hand;
  }
  const candle = new THREE.Group();
  candle.add(mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.13, 16), std('#f6efe0', { roughness: 0.5 }), [0, 0.065, 0]));
  candle.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), phys('#c8a050', { metalness: 1, roughness: 0.3 }), [0, 0.0, 0]));
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 3.2, 1.0) });
  const flame = new THREE.Mesh(sphere(0.022, 16, 12), flameMat); flame.position.set(0, 0.165, 0); flame.scale.set(0.8, 1.9, 0.8);
  candle.add(flame);
  const core = new THREE.Mesh(sphere(0.01, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(8, 7, 5) })); core.position.set(0, 0.155, 0);
  candle.add(core);
  candle.userData.flame = flame;
  root.add(candle); J.candle = candle;
  root.userData.J = J;
  return { root, J, face: J.face, candle };
}
