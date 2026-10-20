import * as THREE from 'three';
import { Tube } from './tube.js';
import { furMaterial, eyeMaterial, makeEye, FUR_SHELLS } from './charmat.js';
import { clamp, lerp, smoothstep } from './util.js';

// The cheetah: a cute, stylized but unmistakable cheetah - golden coat with
// solid black spots, black tear marks from the eyes to the mouth, a long tail
// with black rings and a white tip, a deep chest and a tucked waist.
// Procedural rig: spine curve -> body tube, 2-bone IK legs, tail chain and a
// rigid head with expressive eyes, lids, brows, ears and mouth.
// Local frame: +x forward, +y up, +z right; root origin on the ground.

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------- head shape: deformed ellipsoid, radius as a function of direction
const HEAD = { a: 0.168, b: 0.152, c: 0.178 };
const MUZ = V3(1, -0.42, 0).normalize();
const bumps = [
  [MUZ, 0.42, 0.055],
  [V3(1, -0.5, 0.33).normalize(), 0.22, 0.02], [V3(1, -0.5, -0.33).normalize(), 0.22, 0.02],
  [V3(0.2, -0.35, 1).normalize(), 0.42, 0.022], [V3(0.2, -0.35, -1).normalize(), 0.42, 0.022],
  [V3(0.75, -0.85, 0).normalize(), 0.26, 0.014],
  [V3(0.82, 0.16, 0.46).normalize(), 0.16, -0.014], [V3(0.82, 0.16, -0.46).normalize(), 0.16, -0.014],
  [V3(0.45, 0.8, 0).normalize(), 0.5, 0.01],
];
function headR(d) {
  const { a, b, c } = HEAD;
  let r = 1 / Math.sqrt((d.x / a) ** 2 + (d.y / b) ** 2 + (d.z / c) ** 2);
  for (const [cn, w, amp] of bumps) { const ang = Math.acos(clamp(d.dot(cn), -1, 1)); r += amp * Math.exp(-((ang / w) ** 2)); }
  return r;
}
const onHead = (d, lift = 0) => { const n = d.clone().normalize(); return n.multiplyScalar(headR(n) + lift); };
export const EYE_DIR = [V3(0.8, 0.16, 0.46).normalize(), V3(0.8, 0.16, -0.46).normalize()];

function headGeometry() {
  const g = new THREE.SphereGeometry(1, 72, 54);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // SphereGeometry's pole is +y; keep it so the seam is at the back
    const d = v.clone().normalize();
    // rotate so the seam (at -x... sphere seam is along +x?) sits at the back of the head
    const w = onHead(d);
    p.setXYZ(i, w.x, w.y, w.z);
  }
  g.computeVertexNormals();
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = g.index; ig.attributes = g.attributes; ig.instanceCount = FUR_SHELLS + 1;
  ig.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0.25);
  return ig;
}

// smooth path on the head surface through directions
function surfacePath(dirs, lift, n = 24) {
  const pts = [];
  for (let i = 0; i < dirs.length - 1; i++) for (let k = 0; k < n; k++) {
    const t = k / n;
    pts.push(onHead(dirs[i].clone().lerp(dirs[i + 1], t), lift));
  }
  pts.push(onHead(dirs[dirs.length - 1], lift));
  return new THREE.CatmullRomCurve3(pts);
}

// ---------- spine rest pose and flex offsets (root space)
const SP = [[-0.5, 0.6], [-0.38, 0.625], [-0.18, 0.625], [0.04, 0.62], [0.27, 0.655], [0.37, 0.69], [0.44, 0.74], [0.49, 0.79]];
const GATHER = { dx: [0.1, 0.08, 0.04, 0, -0.03, -0.04, -0.04, -0.04], dy: [-0.05, 0.0, 0.05, 0.06, 0.02, 0.0, 0, 0] };
const EXTEND = { dx: [-0.1, -0.08, -0.04, 0, 0.04, 0.06, 0.07, 0.08], dy: [0.01, 0.0, -0.015, -0.02, -0.01, 0, 0, 0] };
// sitting upright in a car seat (root at the seat cushion)
const SIT = [[-0.1, 0.05], [-0.09, 0.12], [-0.065, 0.21], [-0.035, 0.29], [-0.005, 0.36], [0.025, 0.41], [0.05, 0.45], [0.075, 0.48]];
// body cross-section along the spine
const PROF = [
  [0.0, 0.1, 0.11, -0.01], [0.1, 0.14, 0.15, -0.04], [0.25, 0.125, 0.13, -0.035], [0.42, 0.105, 0.115, -0.03],
  [0.58, 0.205, 0.165, -0.105], [0.7, 0.18, 0.155, -0.08], [0.8, 0.13, 0.12, -0.035], [0.9, 0.105, 0.1, -0.012], [1.0, 0.095, 0.092, 0.0],
];
function profAt(t) {
  let i = 1;
  while (i < PROF.length - 1 && PROF[i][0] < t) i++;
  const a = PROF[i - 1], b = PROF[i];
  const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1), s = u * u * (3 - 2 * u);
  return { ry: lerp(a[1], b[1], s), rz: lerp(a[2], b[2], s), oy: lerp(a[3], b[3], s) };
}

const LEGS = {
  FL: { front: true, side: -1, l1: 0.2, l2: 0.235, l3: 0.07, rTop: 0.07, rMid: 0.045, rLow: 0.038 },
  FR: { front: true, side: 1, l1: 0.2, l2: 0.235, l3: 0.07, rTop: 0.07, rMid: 0.045, rLow: 0.038 },
  HL: { front: false, side: -1, l1: 0.235, l2: 0.255, l3: 0.16, rTop: 0.09, rMid: 0.05, rLow: 0.035 },
  HR: { front: false, side: 1, l1: 0.235, l2: 0.255, l3: 0.16, rTop: 0.09, rMid: 0.05, rLow: 0.035 },
};

export function defaultPose() {
  return {
    spineFlex: 0, bodyY: 0, bodyPitch: 0, bodyRoll: 0, crouch: 0, sit: 0, breath: 0,
    legs: {
      FL: { x: 0.3, y: 0, z: -0.085, foot: 0.05 }, FR: { x: 0.3, y: 0, z: 0.085, foot: 0.05 },
      HL: { x: -0.31, y: 0, z: -0.085, foot: 0.32 }, HR: { x: -0.31, y: 0, z: 0.085, foot: 0.32 },
    },
    neckLift: 0, neckFwd: 0, headYaw: 0, headPitch: 0, headRoll: 0,
    tailUp: 0.15, tailSide: 0, tailCurl: 0.25, tailWave: 0.15, tailPhase: 0,
    blink: 0, lidL: 0.08, lidR: 0.08, lowL: 0.08, lowR: 0.08, gaze: V3(1, 0, 0),
    browL: 0, browR: 0, mouthOpen: 0, tongue: 0, grin: 0, grinSide: 0, earsBack: 0, earsPerk: 0,
    glasses: 0, glassesDrop: 0,
  };
}

export function makeCheetah(env) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const bodyMat = furMaterial({ mode: 0, circ: 0.62, len: 1.25, furLen: 0.011 });
  const legMat = furMaterial({ mode: 1, circ: 0.24, len: 0.72, furLen: 0.007 });
  const tailMat = furMaterial({ mode: 2, circ: 0.2, len: 0.86, furLen: 0.01 });
  const headMat = furMaterial({ mode: 3, furLen: 0.008 });
  for (const m of [bodyMat, legMat, tailMat, headMat]) m.envMap = env;

  const body = new Tube({ nu: 30, nv: 22, restLength: 1.25, shells: FUR_SHELLS, capRings: 6 });
  const bodyMesh = new THREE.Mesh(body.geo, bodyMat); bodyMesh.userData.part = 'body';
  rig.add(bodyMesh);
  const legs = {};
  for (const k of Object.keys(LEGS)) {
    const t = new Tube({ nu: 22, nv: 12, restLength: 0.72, shells: FUR_SHELLS, capStart: true, capEnd: true, capRings: 4 });
    const m = new THREE.Mesh(t.geo, legMat); m.userData.part = 'legs';
    rig.add(m);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.66, 0.34), roughness: 0.8 }));
    rig.add(paw);
    legs[k] = { tube: t, mesh: m, paw, def: LEGS[k] };
  }
  const tail = new Tube({ nu: 30, nv: 12, restLength: 0.86, shells: FUR_SHELLS, capRings: 4 });
  const tailMesh = new THREE.Mesh(tail.geo, tailMat); tailMesh.userData.part = 'tail';
  rig.add(tailMesh);

  // ---------- head
  const head = new THREE.Group();
  rig.add(head);
  const headMesh = new THREE.Mesh(headGeometry(), headMat);
  head.add(headMesh);
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0807, roughness: 0.6 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x2a1c19, roughness: 0.35, clearcoat: 0.5 }));
  {
    const d = V3(1, -0.19, 0).normalize();
    nose.position.copy(onHead(d, 0.003));
    nose.scale.set(0.022, 0.016, 0.036);
    nose.quaternion.setFromUnitVectors(V3(1, 0, 0), d);
    head.add(nose);
  }
  // tear marks are painted into the head coat (charmat.js tearMark)
  // eyes
  const eyeMatC = eyeMaterial({ iris: new THREE.Color(0.98, 0.66, 0.14), irisR: 0.68, pupilR: 0.36 });
  const lidMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.6, 0.27), roughness: 0.8 });
  const eyes = [];
  const EYE_R = 0.056;
  for (let i = 0; i < 2; i++) {
    const s = i === 0 ? 1 : -1;
    const e = makeEye(EYE_R, eyeMatC, lidMat);
    const d = EYE_DIR[i];
    e.group.position.copy(onHead(d, -0.026));
    // eye looks forward and a little outward
    const fwd = V3(1, 0.03, 0.2 * s).normalize();
    e.group.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(V3(0, 0, 0), fwd.clone().negate(), V3(0, 1, 0)));
    head.add(e.group);
    // dark rim (eyeliner) where the eye meets the face
    const rim = new THREE.Mesh(new THREE.TorusGeometry(EYE_R * 0.9, 0.0055, 8, 40), black);
    rim.position.set(0, 0, EYE_R * 0.44);
    e.group.add(rim);
    eyes.push({ ...e, side: s, fwd });
  }
  // brows: soft fur ridges above the eyes
  const browMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.6, 0.37, 0.14), roughness: 0.9 });
  const brows = [];
  for (const s of [1, -1]) {
    const g = new THREE.CapsuleGeometry(0.009, 0.05, 4, 10); g.rotateZ(Math.PI / 2); g.scale(1, 0.75, 0.7);
    const b = new THREE.Mesh(g, browMat);
    const piv = new THREE.Group();
    piv.position.copy(onHead(V3(0.7, 0.42, 0.42 * s), 0.002));
    piv.add(b);
    piv.lookAt(piv.position.clone().multiplyScalar(2));
    head.add(piv);
    brows.push({ piv, mesh: b, side: s, base: piv.position.clone() });
  }
  // ears
  const earShape = new THREE.Shape();
  earShape.moveTo(-0.04, 0); earShape.quadraticCurveTo(-0.045, 0.06, 0, 0.065); earShape.quadraticCurveTo(0.045, 0.06, 0.04, 0); earShape.lineTo(-0.04, 0);
  earShape.getPoints(); const earGeo = new THREE.ExtrudeGeometry(earShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3 });
  const innerShape = new THREE.Shape();
  innerShape.moveTo(-0.028, 0.004); innerShape.quadraticCurveTo(-0.03, 0.045, 0, 0.05); innerShape.quadraticCurveTo(0.03, 0.045, 0.028, 0.004); innerShape.lineTo(-0.028, 0.004);
  const innerGeo = new THREE.ExtrudeGeometry(innerShape, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 });
  const earOuter = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.75, 0.48, 0.2), roughness: 0.85 });
  const earInner = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.96, 0.88, 0.76), roughness: 0.9 });
  const ears = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group();
    piv.position.copy(onHead(V3(-0.05, 0.74, 0.68 * s), -0.012));
    const outer = new THREE.Mesh(earGeo, earOuter);
    const inner = new THREE.Mesh(innerGeo, earInner); inner.position.z = 0.011;
    const ear = new THREE.Group(); ear.add(outer, inner);
    ear.scale.setScalar(1.05);
    ear.rotation.y = Math.PI / 2; // shape normal (+z) -> forward (+x)
    piv.add(ear);
    head.add(piv);
    ears.push({ piv, ear, side: s });
  }
  // mouth: closed line (philtrum + two arcs), open mouth + tongue
  const mouthGroup = new THREE.Group(); head.add(mouthGroup);
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x120807, roughness: 0.7 });
  let closedMouth = null;
  function buildClosedMouth(grin, side) {
    if (closedMouth) { mouthGroup.remove(closedMouth); closedMouth.traverse((o) => o.geometry && o.geometry.dispose()); }
    closedMouth = new THREE.Group();
    const top = V3(1, -0.3, 0), mid = V3(0.98, -0.4, 0);
    closedMouth.add(new THREE.Mesh(new THREE.TubeGeometry(surfacePath([top, mid], 0.003, 8), 8, 0.0035, 5), mouthMat));
    for (const s of [1, -1]) {
      const g = grin * (1 + side * s * 0.9);
      const a = V3(0.97, -0.44 - 0.02 * g, 0.1 * s), b = V3(0.9, -0.46 + 0.1 * g, 0.2 * s + 0.05 * g * s), c = V3(0.8, -0.38 + 0.3 * g, 0.28 * s + 0.1 * g * s);
      closedMouth.add(new THREE.Mesh(new THREE.TubeGeometry(surfacePath([mid, a, b, c], 0.003, 10), 24, 0.0038, 5), mouthMat));
    }
    mouthGroup.add(closedMouth);
  }
  buildClosedMouth(0, 0);
  let lastMouthKey = '';
  const openMouth = new THREE.Group();
  // panting mouth: a wide "D" (flat top under the nose, round dropped jaw)
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3e0c0f, roughness: 0.6 }));
  openMouth.add(cavity);
  // flat, wide tongue lolling out over the lower lip
  const tongueGeo = new THREE.CapsuleGeometry(0.02, 0.06, 6, 14);
  tongueGeo.translate(0, -0.04, 0);
  tongueGeo.scale(1.25, 1, 0.38);
  const tongue = new THREE.Mesh(tongueGeo, new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.93, 0.36, 0.42), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  const tonguePiv = new THREE.Group(); tonguePiv.add(tongue); openMouth.add(tonguePiv);
  {
    // explicit frame: x across the face, y up the face, z out of the face
    const d = V3(0.96, -0.47, 0).normalize();
    openMouth.position.copy(onHead(d, -0.004));
    const xm = V3(0, 0, -1), ym = V3(-d.y, d.x, 0).normalize();
    openMouth.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xm, ym, d));
  }
  head.add(openMouth);
  // whiskers
  const whiskMat = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.5 });
  for (const s of [1, -1]) for (let k = 0; k < 3; k++) {
    const base = onHead(V3(1, -0.33 - k * 0.04, 0.2 * s), 0.0);
    const tip = base.clone().add(V3(-0.02 + k * 0.01, -0.012 * k + 0.012, 0.13 * s));
    const c = new THREE.QuadraticBezierCurve3(base, base.clone().lerp(tip, 0.5).add(V3(0.02, 0.008, 0)), tip);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(c, 8, 0.0011, 3), whiskMat));
  }
  // sunglasses (John's spare pair) - hidden until the end
  const glasses = new THREE.Group();
  {
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.05, metalness: 0.2, clearcoat: 1, envMap: env, envMapIntensity: 2.0 });
    const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x111111, roughness: 0.25, clearcoat: 0.8, envMap: env });
    const ls = new THREE.Shape();
    const w = 0.062, h = 0.046, r = 0.016;
    ls.moveTo(-w / 2 + r, -h / 2); ls.lineTo(w / 2 - r, -h / 2); ls.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    ls.lineTo(w / 2, h / 2 - r * 0.4); ls.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); ls.lineTo(-w / 2 + r, h / 2);
    ls.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); ls.lineTo(-w / 2, -h / 2 + r); ls.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const lensGeo = new THREE.ExtrudeGeometry(ls, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3 });
    for (const s of [1, -1]) {
      const lens = new THREE.Mesh(lensGeo, lensMat);
      const p = onHead(EYE_DIR[s > 0 ? 0 : 1], 0.03);
      lens.position.copy(p);
      lens.lookAt(p.clone().add(V3(1, 0.05, 0.12 * s)));
      glasses.add(lens);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.006, 0.006), frameMat);
      arm.position.copy(onHead(V3(0.35, 0.18, 0.95 * s), 0.012)); arm.rotation.y = s * 0.12;
      glasses.add(arm);
    }
    const bridge = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 16, Math.PI), frameMat);
    bridge.position.copy(onHead(V3(1, 0.12, 0), 0.03)); bridge.rotation.set(0, Math.PI / 2, 0); bridge.scale.set(1, 0.7, 1);
    glasses.add(bridge);
  }
  glasses.visible = false;
  head.add(glasses);

  rig.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------- pose application
  const tmp = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  const spinePts = SP.map(() => new THREE.Vector3());
  let spineCurve = null;

  function legIK(key, hip, P, foot) {
    const L = LEGS[key];
    // ankle above the paw, offset by the foot angle (positive = ankle behind the paw)
    const ankle = V3(P.x - Math.sin(foot) * L.l3, P.y + Math.cos(foot) * L.l3, P.z);
    const d = ankle.clone().sub(hip);
    let dist = d.length();
    const maxR = L.l1 + L.l2 - 0.002, minR = Math.abs(L.l1 - L.l2) + 0.02;
    dist = clamp(dist, minR, maxR);
    const dir = d.normalize();
    const reach = hip.clone().addScaledVector(dir, dist);
    const ankleC = reach;
    const cosA = clamp((L.l1 * L.l1 + dist * dist - L.l2 * L.l2) / (2 * L.l1 * dist), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    // knee bends forward for hind legs, elbow backward for front legs
    const pole = V3(L.front ? -1 : 1, 0, 0);
    const perp = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
    const knee = hip.clone().addScaledVector(dir, L.l1 * cosA).addScaledVector(perp, L.l1 * sinA);
    const pawC = ankleC.clone().add(V3(Math.sin(foot) * L.l3, -Math.cos(foot) * L.l3, 0));
    return { knee, ankle: ankleC, paw: pawC };
  }

  function apply(P, time = 0) {
    rig.position.set(0, P.bodyY - P.crouch * 0.2, 0);
    rig.rotation.set(P.bodyRoll, 0, P.bodyPitch, 'YXZ');
    // spine
    const f = P.spineFlex;
    for (let i = 0; i < SP.length; i++) {
      const tb = f >= 0 ? GATHER : EXTEND, k = Math.abs(f);
      let x = SP[i][0] + tb.dx[i] * k, y = SP[i][1] + tb.dy[i] * k;
      // crouch: chest and head go low and forward, hips stay higher
      y -= P.crouch * (i >= 4 ? 0.02 : -0.03);
      if (i >= 5) { y += P.neckLift * (i - 4) * 0.035; x += P.neckFwd * (i - 4) * 0.03; }
      if (P.sit > 0) { x = lerp(x, SIT[i][0], P.sit); y = lerp(y, SIT[i][1], P.sit); }
      spinePts[i].set(x, y, 0);
    }
    spineCurve = new THREE.CatmullRomCurve3(spinePts, false, 'centripetal');
    const breath = 1 + P.breath;
    // when sitting the spine is upright, so "up" for the cross-section is forward
    const upHint = V3(0, 1, 0).lerp(V3(1, 0.1, 0), smoothstep(0.3, 0.8, P.sit)).normalize();
    body.update((t) => spineCurve.getPoint(t), (t) => {
      const p = profAt(t);
      const chest = Math.exp(-(((t - 0.58) / 0.18) ** 2));
      return { ry: p.ry * (1 + (breath - 1) * chest), rz: p.rz * (1 + (breath - 1) * chest), oy: p.oy * (1 - P.sit) };
    }, upHint);
    // legs
    const shoulderT = 0.62, hipT = 0.1;
    const sh = spineCurve.getPoint(shoulderT), hp = spineCurve.getPoint(hipT);
    for (const k of Object.keys(LEGS)) {
      const L = LEGS[k], lg = legs[k];
      const anchor = (L.front ? sh : hp).clone().add(V3(L.front ? -0.01 : 0.0, L.front ? -0.13 : -0.085, L.side * 0.04));
      const tg = P.legs[k];
      // paw targets are in root space; convert into rig space
      const target = V3(tg.x, tg.y + 0.035 - rig.position.y, tg.z);
      // undo rig pitch for the target (small angles)
      target.applyAxisAngle(V3(0, 0, 1), -P.bodyPitch);
      const { knee, ankle, paw } = legIK(k, anchor, target, tg.foot);
      const pts = [anchor.clone().add(V3(0, 0.05, 0)), anchor, knee, ankle, paw];
      const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
      lg.tube.update((t) => c.getPoint(t), (t) => {
        const r = t < 0.35 ? lerp(L.rTop, L.rMid, smoothstep(0.05, 0.35, t)) : t < 0.75 ? lerp(L.rMid, L.rLow, smoothstep(0.35, 0.75, t)) : L.rLow * (1 + 0.35 * smoothstep(0.85, 1, t));
        return { ry: r, rz: r * 0.9, oy: 0 };
      }, V3(L.front ? 1 : -1, 0, 0));
      lg.paw.position.copy(paw).add(V3(0.016, -0.014, 0));
      lg.paw.scale.set(0.058, 0.033, 0.048);
    }
    // tail: chain from the rump
    {
      const base = spineCurve.getPoint(0).clone().add(V3(0.02, 0.0, 0));
      const pts = [base];
      let dir = V3(-1, 0, 0).applyAxisAngle(V3(0, 0, 1), 0.6 - P.tailUp);
      const segs = 10, segL = 0.86 / segs;
      let p = base.clone();
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const wave = P.tailWave * Math.sin(time * 6.0 + P.tailPhase - t * 3.5) * t;
        const yawStep = (P.tailSide * 1.0 / segs) * (1.6 - t) + wave * 0.35;
        const pitchStep = (P.tailCurl * 1.4 / segs) * t * t * 3 + wave * 0.2;
        dir.applyAxisAngle(V3(0, 1, 0), yawStep);
        dir.applyAxisAngle(V3(0, 0, 1), dir.x < 0 ? -pitchStep : pitchStep);
        dir.normalize();
        p = p.clone().addScaledVector(dir, segL);
        pts.push(p);
      }
      const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      tail.update((t) => c.getPoint(t), (t) => { const r = lerp(0.045, 0.026, t) * (t > 0.92 ? 1 + (t - 0.92) * 2.5 : 1); return { ry: r, rz: r, oy: 0 }; }, V3(0, 1, 0));
    }
    // head
    {
      const neckEnd = spineCurve.getPoint(1), neckDir = spineCurve.getTangent(1);
      const hp2 = neckEnd.clone().addScaledVector(neckDir, 0.07).add(V3(0.04, 0.05, 0));
      head.position.copy(hp2);
      // keep the head level (cheetahs stabilise their gaze), then add animation
      head.rotation.set(P.headRoll, P.headYaw, P.headPitch - P.bodyPitch * 0.9, 'YXZ');
      // eyes
      const g = P.gaze.clone().normalize();
      eyes.forEach((e, i) => {
        // gaze in head space; convert into the eye group's local frame
        const qInv = e.group.quaternion.clone().invert();
        const local = g.clone().applyQuaternion(qInv);
        if (local.z < 0.3) { local.z = 0.3; }
        const up = i === 0 ? P.lidR : P.lidL, low = i === 0 ? P.lowR : P.lowL;
        e.set({ up: Math.max(up, P.blink), low: Math.max(low, P.blink * 0.6), gaze: local });
      });
      brows.forEach((b) => {
        const v = b.side > 0 ? P.browR : P.browL;
        b.piv.position.copy(b.base).add(V3(0, 0.012 * v, 0));
        b.mesh.rotation.z = 0.35 * v * b.side;
      });
      ears.forEach((e) => {
        // tilt outward, fold back when earsBack, prick forward when earsPerk
        e.piv.rotation.set(e.side * (0.38 + P.earsBack * 0.35 - P.earsPerk * 0.12), e.side * 0.25, P.earsBack * 0.9 - P.earsPerk * 0.15, 'XYZ');
      });
      // mouth
      const key = `${P.grin.toFixed(2)}|${P.grinSide.toFixed(2)}`;
      if (key !== lastMouthKey) { buildClosedMouth(P.grin, P.grinSide); lastMouthKey = key; }
      closedMouth.visible = P.mouthOpen < 0.15;
      openMouth.visible = P.mouthOpen >= 0.15;
      cavity.scale.set(0.058, 0.05 * P.mouthOpen + 0.006, 0.03);
      // tongue root sits in the lower jaw, the blade hangs forward and down
      tonguePiv.position.set(0, -0.026 * P.mouthOpen, 0.006);
      tonguePiv.rotation.x = -0.8 - 0.12 * Math.sin(time * 9.0) * P.tongue;
      // smug end beat: the shades slide down the nose
      glasses.position.set(0.006 * P.glassesDrop, -0.024 * P.glassesDrop, 0);
      tongue.scale.setScalar(Math.max(0.001, P.tongue));
      glasses.visible = P.glasses > 0.5;
    }
  }
  apply(defaultPose());
  return { root, rig, head, apply, eyes, glasses, mats: [bodyMat, legMat, tailMat, headMat] };
}
