// Stylised rounded characters built from primitives, with a simple joint rig,
// FK poses, analytic 2-bone arm IK, eyes that track targets, and face decals.
import * as THREE from 'three';
import { mesh, group, rbox, limb } from './util.js';
import * as TX from './textures.js';

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'elbowL', 'handL', 'shoulderR', 'upperArmR', 'elbowR', 'handR', 'thighL', 'kneeL', 'footL', 'thighR', 'kneeR', 'footR'];

function buildSkeleton(root, d) {
  const j = {};
  j.hips = group(root, { y: d.hipY, name: 'hips' });
  j.spine = group(j.hips, { y: 0.05 });
  j.chest = group(j.spine, { y: d.chestY });
  j.neck = group(j.chest, { y: d.neckY });
  j.head = group(j.neck, { y: d.headJointY });
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    j['shoulder' + s] = group(j.chest, { x: side * d.shoulderX, y: d.shoulderY });
    j['upperArm' + s] = group(j['shoulder' + s]);
    j['elbow' + s] = group(j['upperArm' + s], { y: -d.upperArm });
    j['hand' + s] = group(j['elbow' + s], { y: -d.foreArm });
    j['thigh' + s] = group(j.hips, { x: side * d.hipX, y: -0.03 });
    j['knee' + s] = group(j['thigh' + s], { y: -d.thigh });
    j['foot' + s] = group(j['knee' + s], { y: -d.shin });
  }
  const rest = {};
  for (const name of JOINTS) rest[name] = j[name].position.clone();
  return { j, rest };
}

// pose = { joint: { r: [x, y, z], p: [dx, dy, dz] } }, missing joints return to rest.
export function applyPose(rig, pose) {
  for (const name of JOINTS) {
    const jt = rig.j[name];
    const p = pose[name];
    jt.position.copy(rig.rest[name]);
    jt.rotation.set(0, 0, 0);
    if (!p) continue;
    if (p.r) jt.rotation.set(p.r[0] || 0, p.r[1] || 0, p.r[2] || 0);
    if (p.p) jt.position.add(new THREE.Vector3(p.p[0] || 0, p.p[1] || 0, p.p[2] || 0));
  }
}

// ---------- analytic two-bone IK for an arm ----------
const _t = new THREE.Vector3();
const _p = new THREE.Vector3();
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _pq = new THREE.Quaternion();

export function armIK(rig, side, target, pole) {
  const sh = rig.j['shoulder' + side];
  const ua = rig.j['upperArm' + side];
  const el = rig.j['elbow' + side];
  const l1 = rig.dims.upperArm;
  const l2 = rig.dims.foreArm;
  rig.root.updateMatrixWorld(true);
  // work in the shoulder's space
  const inv = new THREE.Matrix4().copy(sh.matrixWorld).invert();
  _t.copy(target).applyMatrix4(inv);
  _p.copy(pole).sub(new THREE.Vector3().setFromMatrixPosition(sh.matrixWorld));
  sh.getWorldQuaternion(_pq);
  _p.applyQuaternion(_pq.invert());
  const d = THREE.MathUtils.clamp(_t.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const tn = _t.clone().normalize();
  const a1 = Math.acos(THREE.MathUtils.clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const a2 = Math.acos(THREE.MathUtils.clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  const pp = _p.clone().sub(tn.clone().multiplyScalar(_p.dot(tn)));
  if (pp.lengthSq() < 1e-8) pp.set(0, 0, -1);
  pp.normalize();
  _u.copy(tn).multiplyScalar(Math.cos(a1)).add(pp.clone().multiplyScalar(Math.sin(a1))).normalize();
  const elbowPos = _u.clone().multiplyScalar(l1);
  _f.copy(tn).multiplyScalar(d).sub(elbowPos).normalize();
  _y.copy(_u).negate();
  _z.copy(_f).sub(_u.clone().multiplyScalar(_f.dot(_u)));
  if (_z.lengthSq() < 1e-8) _z.copy(pp).negate();
  _z.normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  ua.quaternion.copy(_q);
  el.rotation.set(-(Math.PI - a2), 0, 0);
}

// ---------- face decal conforming to an ellipsoid head ----------
function faceDecal(tex, size, radii, segs = 28) {
  const geo = new THREE.PlaneGeometry(size, size, segs, segs);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const [a, b, c] = radii;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const k = 1 - (x / a) ** 2 - (y / b) ** 2;
    const z = c * Math.sqrt(Math.max(0.0005, k)) + 0.0012;
    pos.setZ(i, z);
    const n = new THREE.Vector3(x / (a * a), y / (b * b), z / (c * c)).normalize();
    nrm.setXYZ(i, n.x, n.y, n.z);
  }
  pos.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -2 });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 1;
  m.castShadow = false;
  return m;
}

function makeEye(parent, { x, y, z, r, iris, irisR, pupilR, lid }) {
  const g = group(parent, { x, y, z });
  const look = group(g);
  mesh(new THREE.SphereGeometry(r, 28, 18), new THREE.MeshPhysicalMaterial({ color: 0xfbfbf6, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }), { parent: look, cast: false });
  if (iris) mesh(new THREE.CircleGeometry(irisR, 28), new THREE.MeshStandardMaterial({ color: iris, roughness: 0.3 }), { z: r * 0.985, parent: look, cast: false });
  mesh(new THREE.CircleGeometry(pupilR, 24), new THREE.MeshBasicMaterial({ color: 0x050505 }), { z: r * 0.995, parent: look, cast: false });
  mesh(new THREE.CircleGeometry(pupilR * 0.45, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5), toneMapped: false }), { x: r * 0.18, y: r * 0.2, z: r * 1.0, parent: look, cast: false });
  let lidUpper = null;
  if (lid) {
    lidUpper = group(g);
    mesh(new THREE.SphereGeometry(r * 1.07, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), lid, { parent: lidUpper, cast: false });
  }
  return { g, look, lidUpper, r };
}

function aimEye(eye, worldTarget, maxYaw = 0.45, maxPitch = 0.35) {
  const local = eye.g.worldToLocal(worldTarget.clone());
  const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -maxYaw, maxYaw);
  const pitch = THREE.MathUtils.clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -maxPitch, maxPitch);
  eye.look.rotation.set(-pitch, yaw, 0);
}

// ======================================================================
//  THE BOY ("you"): teen in a teal NIGHT OWL uniform + cap
// ======================================================================
export function makeBoy() {
  const d = { hipY: 0.86, chestY: 0.2, neckY: 0.19, headJointY: 0.05, shoulderX: 0.17, shoulderY: 0.135, upperArm: 0.27, foreArm: 0.25, hipX: 0.085, thigh: 0.38, shin: 0.38 };
  const root = new THREE.Group();
  root.name = 'boy';
  const { j, rest } = buildSkeleton(root, d);
  const skin = new THREE.MeshStandardMaterial({ color: 0xf0c4a2, roughness: 0.55 });
  const shirt = new THREE.MeshStandardMaterial({ color: 0x12707a, roughness: 0.72 });
  const apron = new THREE.MeshStandardMaterial({ color: 0x13203a, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x1b2232, roughness: 0.85 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.4 });
  const sole = new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.7 });
  const hairM = new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.6 });
  const capM = new THREE.MeshStandardMaterial({ color: 0x0f5a62, roughness: 0.6 });
  const brimM = new THREE.MeshStandardMaterial({ color: 0xe08a2c, roughness: 0.55 });

  // torso
  mesh(new THREE.CapsuleGeometry(0.15, 0.22, 8, 20), shirt, { y: 0.17, sx: 1.08, sz: 0.78, parent: j.spine });
  mesh(new THREE.CylinderGeometry(0.152, 0.16, 0.36, 24, 1, true, -1.1, 2.2), apron, { y: 0.06, sx: 1.08, sz: 0.8, parent: j.spine, cast: false });
  mesh(new THREE.TorusGeometry(0.062, 0.02, 8, 20), shirt, { y: 0.165, rx: Math.PI / 2 - 0.2, parent: j.chest });
  mesh(new THREE.PlaneGeometry(0.075, 0.03), new THREE.MeshStandardMaterial({ map: TX.nameTagTexture(), roughness: 0.4 }), { x: 0.075, y: 0.08, z: 0.118, rx: -0.15, ry: 0.35, parent: j.chest, cast: false });
  mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshStandardMaterial({ map: TX.uniformPatchTexture(), roughness: 0.6 }), { x: -0.08, y: 0.08, z: 0.115, rx: -0.15, ry: -0.35, parent: j.chest, cast: false });
  mesh(new THREE.SphereGeometry(0.15, 20, 14), pants, { y: -0.02, sx: 1.05, sy: 0.75, sz: 0.85, parent: j.hips });
  // neck + head
  mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 14), skin, { y: 0.02, parent: j.neck });
  const head = group(j.head, { y: 0.13, name: 'boyHead' });
  mesh(new THREE.SphereGeometry(0.155, 36, 28), skin, { parent: head });
  for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.034, 14, 10), skin, { x: s * 0.152, y: -0.005, sx: 0.55, sz: 0.9, parent: head });
  mesh(new THREE.SphereGeometry(0.024, 14, 10), skin, { y: -0.022, z: 0.152, sx: 1.1, parent: head });
  // hair (back + sides, under the cap)
  mesh(new THREE.SphereGeometry(0.162, 32, 18, Math.PI / 2 + 1.1, Math.PI * 2 - 2.2, 0.15, 1.6), hairM, { y: 0.0, z: -0.004, parent: head });
  for (const s of [-1, 1]) mesh(new THREE.CapsuleGeometry(0.018, 0.04, 4, 8), hairM, { x: s * 0.138, y: 0.02, z: 0.05, rz: s * 0.1, parent: head, cast: false });
  // cap
  const cap = group(head, { y: 0.088, z: -0.01, rx: -0.1 });
  mesh(new THREE.SphereGeometry(0.17, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), capM, { sy: 0.78, parent: cap });
  mesh(new THREE.SphereGeometry(0.014, 10, 8), capM, { y: 0.132, parent: cap });
  const brimShape = new THREE.Shape();
  brimShape.absellipse(0, 0, 0.13, 0.11, Math.PI, 0, true);
  const brim = mesh(new THREE.ExtrudeGeometry(brimShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 24 }), brimM, { y: 0.005, z: 0.13, rx: Math.PI / 2 - 0.12, parent: cap });
  brim.scale.set(1, 1, 1);
  mesh(new THREE.CircleGeometry(0.042, 24), new THREE.MeshStandardMaterial({ map: TX.uniformPatchTexture(), roughness: 0.6 }), { y: 0.06, z: 0.152, rx: -0.42, parent: cap, cast: false });
  // face decal + eyes + brows
  const faces = TX.boyFaceTextures();
  const decal = faceDecal(faces.neutral, 0.28, [0.155, 0.155, 0.155]);
  head.add(decal);
  const lidMat = new THREE.MeshStandardMaterial({ color: 0xe8b796, roughness: 0.6 });
  const eyes = [-1, 1].map((s) => makeEye(head, { x: s * 0.056, y: 0.022, z: 0.123, r: 0.04, iris: 0x4a2c18, irisR: 0.021, pupilR: 0.0115, lid: lidMat }));
  const browM = new THREE.MeshStandardMaterial({ color: 0x3b2417, roughness: 0.7 });
  const brows = [-1, 1].map((s) => {
    const g = group(head, { x: s * 0.058, y: 0.068, z: 0.131 });
    mesh(new THREE.CapsuleGeometry(0.009, 0.045, 4, 8), browM, { rz: Math.PI / 2, parent: g, cast: false });
    return { g, s };
  });
  // arms
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    mesh(new THREE.SphereGeometry(0.062, 16, 12), shirt, { parent: j['shoulder' + s] });
    limb(j['upperArm' + s], 0.14, 0.058, shirt);
    limb(j['upperArm' + s], d.upperArm, 0.044, skin);
    limb(j['elbow' + s], d.foreArm, 0.041, skin);
    const hand = group(j['hand' + s], { y: -0.04 });
    mesh(new THREE.SphereGeometry(0.04, 16, 12), skin, { sx: 0.85, sy: 1.15, sz: 0.62, parent: hand });
    mesh(new THREE.CapsuleGeometry(0.015, 0.03, 4, 8), skin, { x: side * -0.035, y: 0.01, z: 0.02, rz: side * 0.6, rx: -0.4, parent: hand });
    // legs
    limb(j['thigh' + s], d.thigh, 0.07, pants);
    limb(j['knee' + s], d.shin, 0.058, pants);
    const f = group(j['foot' + s]);
    mesh(rbox(0.11, 0.075, 0.24, 0.035), shoe, { y: -0.04, z: 0.04, parent: f });
    mesh(rbox(0.115, 0.02, 0.245, 0.008), sole, { y: -0.07, z: 0.04, parent: f, cast: false });
  }

  const rig = { root, j, rest, dims: d, head, eyes, brows, decal, faces, expression: 'neutral' };
  rig.setExpression = (name) => {
    if (rig.expression !== name && faces[name]) {
      decal.material.map = faces[name];
      rig.expression = name;
    }
  };
  // blink 0..1, wide 0..1 (eyes opened up), raise/worry for brows
  rig.setFace = ({ blink = 0, wide = 0, raise = 0, worry = 0, lookAt = null } = {}) => {
    for (const e of eyes) {
      const open = -0.95 - wide * 0.35;
      e.lidUpper.rotation.x = THREE.MathUtils.lerp(open, 1.5, blink);
      if (lookAt) aimEye(e, lookAt);
    }
    for (const b of brows) {
      b.g.position.y = 0.068 + raise * 0.014;
      b.g.rotation.z = b.s * (-worry * 0.35);
    }
  };
  rig.setFace();
  return rig;
}

// ======================================================================
//  HER: tall, thin, long dark dress, long black hair, pale face, huge smile
// ======================================================================
export function makeHer() {
  const d = { hipY: 1.0, chestY: 0.25, neckY: 0.2, headJointY: 0.08, shoulderX: 0.15, shoulderY: 0.13, upperArm: 0.31, foreArm: 0.29, hipX: 0.07, thigh: 0.45, shin: 0.45 };
  const root = new THREE.Group();
  root.name = 'her';
  const { j, rest } = buildSkeleton(root, d);
  const skin = new THREE.MeshStandardMaterial({ color: 0xe9e6e1, roughness: 0.48, emissive: 0x2a2a2e, emissiveIntensity: 0.45 });
  const dress = new THREE.MeshPhysicalMaterial({ color: 0x0b0e17, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0x40507a), sheenRoughness: 0.35 });
  const hairM = new THREE.MeshPhysicalMaterial({ color: 0x07080b, roughness: 0.5, clearcoat: 0.15, clearcoatRoughness: 0.5 });
  const hairCurtainM = hairM.clone();
  hairCurtainM.side = THREE.DoubleSide;
  const lace = new THREE.MeshStandardMaterial({ color: 0xd9d4cc, roughness: 0.8 });
  const stock = new THREE.MeshStandardMaterial({ color: 0x15161c, roughness: 0.5 });
  const patent = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: 0.15, clearcoat: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b15a, metalness: 1, roughness: 0.18 });

  // torso + skirt (skirt bends with uniform uSway for the jerky step sway)
  mesh(new THREE.CapsuleGeometry(0.105, 0.27, 8, 20), dress, { y: 0.2, sx: 1.0, sz: 0.76, parent: j.spine });
  const prof = [[0.0, 0.06], [0.11, 0.05], [0.135, -0.06], [0.16, -0.22], [0.2, -0.42], [0.26, -0.62], [0.33, -0.8], [0.385, -0.9], [0.395, -0.93], [0.37, -0.935]];
  const skirtGeo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 48);
  const skirtMat = dress.clone();
  const sway = { value: new THREE.Vector2(0, 0) };
  skirtMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSway = sway;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSway;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat hk = clamp(-position.y / 0.93, 0.0, 1.0);\ntransformed.xz += uSway * hk * hk;');
  };
  skirtMat.customProgramCacheKey = () => 'skirt';
  const skirt = mesh(skirtGeo, skirtMat, { parent: j.hips });
  skirt.material.side = THREE.DoubleSide;
  // neck + head
  mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.2, 14), skin, { y: 0.04, parent: j.neck });
  const head = group(j.head, { y: 0.12, name: 'herHead' });
  const radii = [0.118 * 0.94, 0.118 * 1.16, 0.118];
  mesh(new THREE.SphereGeometry(0.118, 36, 28), skin, { sx: 0.94, sy: 1.16, sz: 1.0, parent: head });
  head.add(faceDecal(TX.herFaceTexture(), 0.24, radii));
  const lashM = new THREE.MeshBasicMaterial({ color: 0x0a0809 });
  const eyes = [-1, 1].map((s) => {
    const e = makeEye(head, { x: s * 0.042, y: 0.02, z: 0.097, r: 0.026, iris: null, pupilR: 0.0052, lid: null });
    mesh(new THREE.TorusGeometry(0.0262, 0.0022, 6, 28), lashM, { z: 0.004, parent: e.g, cast: false });
    return e;
  });
  // hair: scalp shell, heavy bangs, long strands
  mesh(new THREE.SphereGeometry(0.124, 32, 20, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.66), hairM, { sx: 0.97, sy: 1.17, sz: 1.04, z: -0.004, parent: head });
  mesh(new THREE.SphereGeometry(0.127, 32, 12, Math.PI / 2 - 1.0, 2.0, 0, 0.98), hairM, { sx: 0.97, sy: 1.17, sz: 1.05, parent: head });
  // long straight hair: a smooth curtain down her back + two locks framing the face
  const strands = [];
  const curtain = group(head, { y: -0.02, z: -0.008 });
  mesh(new THREE.CylinderGeometry(0.119, 0.2, 0.74, 40, 8, true, 0.85, Math.PI * 2 - 1.7), hairCurtainM, { y: -0.37, sz: 0.84, parent: curtain });
  strands.push({ pivot: curtain, side: 0, follow: 0.45 });
  for (const sx of [-1, 1]) {
    const pivot = group(head, { x: sx * 0.097, y: -0.005, z: 0.03 });
    mesh(new THREE.CapsuleGeometry(0.03, 0.46, 4, 10), hairM, { y: -0.25, sx: 1.45, sz: 0.5, ry: sx * 1.2, parent: pivot });
    strands.push({ pivot, side: sx, follow: 0.7 });
  }
  // arms (long dark sleeves) + pale long-fingered hands with rings
  const fingers = { L: [], R: [] };
  for (const [s, side] of [['L', 1], ['R', -1]]) {
    mesh(new THREE.SphereGeometry(0.054, 16, 12), dress, { y: -0.012, sy: 0.85, parent: j['shoulder' + s] });
    mesh(new THREE.CylinderGeometry(0.036, 0.028, d.upperArm, 14), dress, { y: -d.upperArm / 2, parent: j['upperArm' + s] });
    mesh(new THREE.SphereGeometry(0.029, 12, 10), dress, { parent: j['elbow' + s] });
    mesh(new THREE.CylinderGeometry(0.028, 0.023, d.foreArm - 0.03, 14), dress, { y: -(d.foreArm - 0.03) / 2, parent: j['elbow' + s] });
    mesh(new THREE.TorusGeometry(0.024, 0.008, 8, 18), lace, { y: -d.foreArm + 0.035, rx: Math.PI / 2, parent: j['elbow' + s] });
    mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.05, 12), skin, { y: -d.foreArm + 0.01, parent: j['elbow' + s] });
    const hand = group(j['hand' + s], { name: 'hand' + s });
    mesh(new THREE.SphereGeometry(0.036, 16, 12), skin, { y: -0.042, sx: 0.95, sy: 1.3, sz: 0.45, parent: hand });
    for (let k = 0; k < 4; k++) {
      const fx = (k - 1.5) * 0.0145 * side;
      const base = group(hand, { x: fx, y: -0.085 });
      const l1 = [0.036, 0.042, 0.04, 0.032][k];
      limb(base, l1, 0.0072, skin);
      const tip = group(base, { y: -l1 });
      limb(tip, l1 * 0.85, 0.0066, skin);
      if (s === 'R' && (k === 1 || k === 2)) mesh(new THREE.TorusGeometry(0.0088, 0.0026, 8, 18), gold, { y: -0.012, rx: Math.PI / 2, parent: base, cast: false });
      if (s === 'L' && k === 2) mesh(new THREE.TorusGeometry(0.0088, 0.0026, 8, 18), gold, { y: -0.012, rx: Math.PI / 2, parent: base, cast: false });
      fingers[s].push({ base, tip });
    }
    const th = group(hand, { x: side * 0.03, y: -0.035, z: 0.012, rz: side * 0.7 });
    limb(th, 0.045, 0.0078, skin);
    // legs + heels
    mesh(new THREE.CapsuleGeometry(0.03, 0.12, 4, 10), stock, { y: 0.08, parent: j['foot' + s] });
    const f = group(j['foot' + s]);
    mesh(rbox(0.07, 0.05, 0.19, 0.025), patent, { y: -0.02, z: 0.045, rx: -0.12, parent: f });
    mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.07, 8), patent, { y: -0.035, z: -0.035, parent: f });
  }

  const rig = { root, j, rest, dims: d, head, eyes, strands, fingers, sway, radii };
  rig.lookAt = (target) => eyes.forEach((e) => aimEye(e, target, 0.55, 0.45));
  // Hair hangs with gravity: counter part of the head/torso tilt.
  rig.settleHair = (tilt, lean) => {
    for (const s of strands) {
      s.pivot.rotation.set(-lean * 0.6 * s.follow, 0, -tilt * s.follow + s.side * 0.05);
    }
  };
  return rig;
}

export { aimEye };
