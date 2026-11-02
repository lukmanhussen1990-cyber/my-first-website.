// Toy-like characters and props: smooth plastic look, big round heads,
// dot eyes, rosy cheeks, chunky shoes. All built from primitives.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- material / geometry helpers ----------
const mcache = new Map();
export function mat(color, o = {}) {
  const key = color + '|' + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  if (!o.unique && mcache.has(key)) return mcache.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.42, metalness: o.metal ?? 0 });
  if (o.emissive) { m.emissive = new THREE.Color(o.emissive); m.emissiveIntensity = o.ei ?? 1; }
  if (o.opacity !== undefined) { m.transparent = true; m.opacity = o.opacity; m.depthWrite = o.depthWrite ?? false; }
  if (o.map) m.map = o.map;
  if (o.bump) { m.bumpMap = o.bump; m.bumpScale = o.bumpScale ?? 2; }
  if (o.side) m.side = o.side;
  if (!o.unique) mcache.set(key, m);
  return m;
}
const gcache = new Map();
const G = (key, fn) => { if (!gcache.has(key)) gcache.set(key, fn()); return gcache.get(key); };
export const sphere = (r, w = (r < 0.12 ? 12 : r < 0.3 ? 16 : 22), h = (r < 0.12 ? 8 : r < 0.3 ? 11 : 15)) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
export const capsule = (r, l, cs = 4, rs = 14) => G(`c${r}|${l}|${cs}|${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs));
export const cyl = (rt, rb, h, s = 18, open = false) => G(`y${rt}|${rb}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
export const rbox = (w, h, d, r = 0.05, s = 2) => G(`b${w}|${h}|${d}|${r}|${s}`, () => new RoundedBoxGeometry(w, h, d, s, Math.min(r, Math.min(w, h, d) / 2 - 1e-4)));
export const box = (w, h, d) => G(`x${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
export const torus = (R, r, arc = Math.PI * 2, rs = 8, ts = 20) => G(`t${R}|${r}|${arc}|${rs}|${ts}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
export const cone = (r, h, s = 24) => G(`n${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));

export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }
export function mesh(geo, material, o = {}) {
  const m = new THREE.Mesh(geo, material);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) typeof o.scale === 'number' ? m.scale.setScalar(o.scale) : m.scale.set(...o.scale);
  m.castShadow = o.cast ?? true; m.receiveShadow = o.receive ?? true;
  if (o.parent) o.parent.add(m);
  return m;
}
const Z = new THREE.Vector3(0, 0, 1);
// place an object on a sphere surface at (x,y) of the front face, +z along the normal
function onSphere(obj, R, x, y, lift = 0) {
  const z = Math.sqrt(Math.max(1e-4, R * R - x * x - y * y));
  const n = new THREE.Vector3(x, y, z).normalize();
  obj.position.copy(n).multiplyScalar(R + lift);
  obj.quaternion.setFromUnitVectors(Z, n);
  return obj;
}
function stroke(parent, x1, y1, x2, y2, r, material) {
  const l = Math.hypot(x2 - x1, y2 - y1), a = Math.atan2(y2 - y1, x2 - x1);
  return mesh(capsule(r, l, 4, 10), material, { parent, pos: [(x1 + x2) / 2, (y1 + y2) / 2, 0], rot: [0, 0, a - Math.PI / 2], cast: false });
}

// ---------- face ----------
const C = { white: '#ffffff', pupil: '#1b2133', cheek: '#ff8e8e', lip: '#c4372f', mouthIn: '#5c1414', tongue: '#ff6f7d', brow: '#4a2c1a' };
export function buildFace(head, R, o = {}) {
  const F = { eyes: [], pupils: [], brows: [], parts: {} };
  const white = mat(C.white, { rough: 0.25 }), pupil = mat(C.pupil, { rough: 0.2 }), dark = mat(o.browColor || C.brow);
  const lineM = mat('#1b2133', { rough: 0.4 });
  const ex = o.eyeX ?? 0.2, ey = o.eyeY ?? 0.08, es = o.eyeSize ?? 1;
  for (const s of [-1, 1]) {
    const eg = onSphere(new THREE.Group(), R, ex * s, ey, -0.03 * es); head.add(eg);
    const open = grp(eg);
    mesh(sphere(0.135 * es), white, { parent: open, scale: [0.9, 1.12, 0.5], cast: false });
    const pg = grp(open, 0, 0, 0.05 * es);
    mesh(sphere(0.068 * es), pupil, { parent: pg, scale: [1, 1.12, 0.6], cast: false });
    mesh(sphere(0.022 * es, 12, 8), white, { parent: pg, pos: [0.022 * es, 0.035 * es, 0.04 * es], cast: false });
    // > < squeezed eyes (vertex points toward the nose)
    const sq = grp(eg, 0, 0, 0.03); const v = -s; // eye at -x shows '>'
    stroke(sq, -0.07 * v, 0.05, 0.06 * v, 0, 0.024, lineM);
    stroke(sq, -0.07 * v, -0.05, 0.06 * v, 0, 0.024, lineM);
    // ^ ^ happy eyes
    const hp = grp(eg, 0, -0.02, 0.03);
    mesh(torus(0.07, 0.024, Math.PI, 8, 20), lineM, { parent: hp, cast: false });
    sq.visible = hp.visible = false;
    F.eyes.push({ g: eg, open, pupil: pg, sq, hp });
    const bg = onSphere(new THREE.Group(), R, ex * s, ey + 0.24 * es, 0.0); head.add(bg);
    const bm = mesh(capsule(0.036, 0.15, 4, 10), dark, { parent: bg, rot: [0, 0, Math.PI / 2], cast: false });
    F.brows.push({ g: bg, m: bm, s });
  }
  // nose
  const ng = onSphere(new THREE.Group(), R, 0, -0.06, -0.02); head.add(ng);
  mesh(sphere(0.085), mat(o.skin), { parent: ng, scale: [1, 0.9, 0.9] });
  // cheeks
  F.cheekMat = mat(C.cheek, { unique: true, rough: 0.6 });
  for (const s of [-1, 1]) {
    const cg = onSphere(new THREE.Group(), R, 0.31 * s, -0.13, -0.012); head.add(cg);
    mesh(sphere(0.105), F.cheekMat, { parent: cg, scale: [1, 0.8, 0.22], cast: false });
  }
  // mouths
  const mg = onSphere(new THREE.Group(), R, 0, -0.27, -0.005); head.add(mg);
  const lip = mat(C.lip, { rough: 0.3 });
  const smile = mesh(torus(0.1, 0.022, Math.PI, 8, 24), lip, { parent: mg, rot: [0, 0, Math.PI], pos: [0, 0.05, 0], cast: false });
  const oMouth = grp(mg, 0, -0.02, 0);
  mesh(sphere(0.1), mat(C.mouthIn, { rough: 0.5 }), { parent: oMouth, scale: [0.85, 1.1, 0.3], cast: false });
  mesh(sphere(0.05), mat(C.tongue), { parent: oMouth, pos: [0, -0.05, 0.012], scale: [1, 0.6, 0.4], cast: false });
  const grin = grp(mg, 0, 0.04, 0);
  mesh(new THREE.SphereGeometry(0.15, 16, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(C.mouthIn, { rough: 0.5 }), { parent: grin, scale: [1, 0.9, 0.3], cast: false });
  mesh(sphere(0.06), mat(C.tongue), { parent: grin, pos: [0, -0.08, 0.02], scale: [1.2, 0.6, 0.4], cast: false });
  const wavyCurve = new THREE.CatmullRomCurve3([-0.11, -0.055, 0, 0.055, 0.11].map((x, i) => new THREE.Vector3(x, i % 2 ? 0.025 : -0.02, 0)));
  const wavy = mesh(new THREE.TubeGeometry(wavyCurve, 30, 0.02, 8), lip, { parent: mg, cast: false });
  const tongueOut = mesh(capsule(0.045, 0.06), mat(C.tongue), { parent: mg, pos: [0.03, -0.08, 0.03], rot: [0.5, 0, 0.3], cast: false });
  F.parts = { smile, oMouth, grin, wavy, tongueOut };
  F.set = (mode, k = 1) => setFace(F, mode, k);
  F.look = (x, y) => { for (const e of F.eyes) e.pupil.position.set(x * 0.045, y * 0.05, 0.05); };
  F.set('smile');
  return F;
}
function setFace(F, mode, k) {
  const p = F.parts;
  for (const m of Object.values(p)) m.visible = false;
  const eyesOpen = !['squint', 'disgust', 'sick', 'joy'].includes(mode);
  for (const e of F.eyes) {
    e.open.visible = eyesOpen; e.sq.visible = ['squint', 'disgust', 'sick'].includes(mode); e.hp.visible = mode === 'joy';
    const big = mode === 'shock' ? 1.25 : 1;
    e.open.scale.setScalar(big);
    e.pupil.scale.setScalar(mode === 'shock' ? 0.55 : 1);
  }
  for (const b of F.brows) {
    b.g.position.y = 0; b.m.rotation.z = Math.PI / 2; b.m.position.y = 0;
    if (mode === 'shock') b.m.position.y = 0.06;
    if (mode === 'shout' || mode === 'angry') b.m.rotation.z = Math.PI / 2 + 0.35 * b.s;
    if (mode === 'squint' || mode === 'disgust' || mode === 'sick') b.m.rotation.z = Math.PI / 2 - 0.3 * b.s;
    if (mode === 'joy' || mode === 'happy') b.m.position.y = 0.03;
  }
  switch (mode) {
    case 'smile': p.smile.visible = true; break;
    case 'happy': case 'joy': p.grin.visible = true; break;
    case 'shock': p.oMouth.visible = true; p.oMouth.scale.setScalar(0.9 * k); break;
    case 'shout': p.oMouth.visible = true; p.oMouth.scale.set(1.5 * k, 1.55 * k, 1); break;
    case 'squint': p.oMouth.visible = true; p.oMouth.scale.setScalar(1.0 * k); break;
    case 'disgust': p.wavy.visible = true; break;
    case 'sick': p.wavy.visible = true; p.tongueOut.visible = true; break;
  }
}

// ---------- person ----------
const IK = { X: new THREE.Vector3(), Y: new THREE.Vector3(), Zv: new THREE.Vector3(), M: new THREE.Matrix4() };
function ik2(arm, elbow, S, T, pole, L1, L2) {
  const d = T.clone().sub(S); let dist = THREE.MathUtils.clamp(d.length(), 0.08, L1 + L2 - 1e-3);
  const dn = d.normalize();
  const n = new THREE.Vector3().crossVectors(dn, pole); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize();
  const a = Math.acos(THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
  const b = Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
  const u = dn.clone().applyAxisAngle(n, a);
  IK.Y.copy(u).negate(); IK.X.copy(n); IK.Zv.crossVectors(IK.X, IK.Y);
  IK.M.makeBasis(IK.X, IK.Y, IK.Zv); arm.quaternion.setFromRotationMatrix(IK.M);
  elbow.rotation.set(-(Math.PI - b), 0, 0);
}

export function makePerson(o = {}) {
  const P = { skin: '#f7c9a2', shirt: '#4f8fd6', pants: '#3d4d70', shoes: '#4a2f22', hair: '#6b4426', hairStyle: 'cap',
    belt: '#5a3b22', socks: null, longSleeve: false, ...o };
  const root = new THREE.Group(); root.name = o.name || 'person';
  const skinM = mat(P.skin, { rough: 0.5 }), shirtM = mat(P.shirt), pantsM = mat(P.pants), shoeM = mat(P.shoes, { rough: 0.3 }), soleM = mat('#f3efe6');
  const body = grp(root);            // whole-body bob / tilt
  const hips = grp(body, 0, 1.155, 0);
  mesh(rbox(0.66, 0.34, 0.44, 0.14), pantsM, { parent: hips, pos: [0, -0.02, 0] });
  const legs = {};
  for (const s of [-1, 1]) {
    const leg = grp(hips, 0.17 * s, -0.08, 0);
    mesh(capsule(0.145, 0.3), pantsM, { parent: leg, pos: [0, -0.23, 0] });
    const knee = grp(leg, 0, -0.48, 0);
    mesh(capsule(0.125, 0.28), P.socks ? mat(P.socks) : pantsM, { parent: knee, pos: [0, -0.2, 0] });
    const foot = grp(knee, 0, -0.42, 0);
    mesh(rbox(0.31, 0.2, 0.48, 0.09), shoeM, { parent: foot, pos: [0, -0.04, 0.07] });
    mesh(rbox(0.35, 0.07, 0.52, 0.03), soleM, { parent: foot, pos: [0, -0.14, 0.07] });
    legs[s] = { leg, knee, foot };
  }
  const torso = grp(hips, 0, 0.1, 0);
  mesh(capsule(0.37, 0.4), shirtM, { parent: torso, pos: [0, 0.43, 0], scale: [1, 1, 0.86] });
  if (P.tunic !== false) mesh(cyl(0.37, 0.45, 0.32, 28), shirtM, { parent: torso, pos: [0, 0.06, 0], scale: [1, 1, 0.86] });
  mesh(cyl(0.385, 0.385, 0.09, 28), mat(P.belt), { parent: torso, pos: [0, 0.22, 0], scale: [1, 1, 0.88] });
  if (P.apron) mesh(rbox(0.5, 0.6, 0.06, 0.03), mat(P.apron), { parent: torso, pos: [0, 0.25, 0.33], rot: [0.08, 0, 0] });
  const arms = {}; const L1 = 0.42, L2 = 0.42;
  for (const s of [-1, 1]) {
    const S = new THREE.Vector3(0.44 * s, 0.72, 0);
    const arm = grp(torso, S.x, S.y, S.z);
    mesh(capsule(0.115, 0.24), shirtM, { parent: arm, pos: [0, -0.2, 0] });
    const elbow = grp(arm, 0, -L1, 0);
    mesh(capsule(0.1, 0.22), P.longSleeve ? shirtM : skinM, { parent: elbow, pos: [0, -0.16, 0] });
    const hand = grp(elbow, 0, -L2, 0);
    mesh(sphere(0.155), skinM, { parent: hand });
    arms[s] = { arm, elbow, hand, S };
  }
  const head = grp(torso, 0, 1.46, 0);
  const R = 0.56;
  mesh(sphere(R, 28, 20), skinM, { parent: head });
  for (const s of [-1, 1]) mesh(sphere(0.13), skinM, { parent: head, pos: [0.54 * s, -0.04, -0.02], scale: [0.5, 1, 0.8] });
  const hairM = mat(P.hair, { rough: 0.55 });
  if (P.hairStyle !== 'bald') {
    const cap = mesh(new THREE.SphereGeometry(R + 0.03, 28, 12, 0, Math.PI * 2, 0, P.hairStyle === 'long' ? 1.6 : 1.22), hairM, { parent: head, rot: [-0.42, 0, 0] });
    if (P.hairStyle === 'long') { cap.rotation.x = -0.75; mesh(capsule(0.5, 0.35), hairM, { parent: head, pos: [0, -0.35, -0.22], scale: [1.05, 1, 0.6] }); }
    if (P.hairStyle === 'bun') mesh(sphere(0.22), hairM, { parent: head, pos: [0, 0.38, -0.42] });
    if (P.hairStyle === 'spiky') for (let i = 0; i < 5; i++) mesh(cone(0.11, 0.3), hairM, { parent: head, pos: [(i - 2) * 0.16, 0.56, -0.05 - Math.abs(i - 2) * 0.04], rot: [-0.3, 0, -(i - 2) * 0.3] });
  }
  if (P.mustache) for (const s of [-1, 1]) mesh(capsule(0.05, 0.12), hairM, { parent: head, pos: [0.08 * s, -0.17, 0.53], rot: [0, 0, Math.PI / 2 + 0.35 * s] });
  const hat = grp(head);
  if (P.hat === 'nightcap') {
    mesh(torus(0.5, 0.09), mat('#ffffff'), { parent: hat, pos: [0, 0.3, -0.05], rot: [Math.PI / 2 - 0.25, 0, 0] });
    const c = grp(hat, 0, 0.35, -0.08); c.rotation.set(-0.3, 0, -0.5);
    mesh(cone(0.48, 1.0), mat('#d8423a'), { parent: c, pos: [0, 0.45, 0] });
    mesh(sphere(0.13), mat('#ffffff'), { parent: c, pos: [0, 0.95, 0] });
  } else if (P.hat === 'cap') {
    mesh(new THREE.SphereGeometry(R + 0.06, 32, 12, 0, Math.PI * 2, 0, 1.1), mat(P.hatColor || '#c9772f'), { parent: hat, rot: [-0.25, 0, 0] });
    mesh(cyl(0.34, 0.34, 0.05, 24), mat(P.hatColor || '#c9772f'), { parent: hat, pos: [0, 0.32, 0.42], scale: [1, 1, 0.75], rot: [0.35, 0, 0] });
  } else if (P.hat === 'hood') {
    mesh(new THREE.SphereGeometry(R + 0.07, 32, 16, 0, Math.PI * 2, 0, 1.75), mat(P.hatColor || '#7b8f3a'), { parent: hat, rot: [-0.9, 0, 0] });
  } else if (P.hat === 'kerchief') {
    mesh(new THREE.SphereGeometry(R + 0.05, 32, 16, 0, Math.PI * 2, 0, 1.45), mat(P.hatColor || '#e7a2c0'), { parent: hat, rot: [-0.55, 0, 0] });
    mesh(sphere(0.12), mat(P.hatColor || '#e7a2c0'), { parent: hat, pos: [0, -0.2, -0.55] });
  }
  const face = buildFace(head, R, { skin: P.skin });
  Object.assign(root.userData, { P, body, hips, torso, head, legs, arms, face, hat, skinM });

  // ---- posing API (all absolute; call reset each frame) ----
  root.userData.reset = () => {
    body.position.set(0, 0, 0); body.rotation.set(0, 0, 0);
    hips.position.y = 1.155; torso.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0);
    for (const s of [-1, 1]) {
      const l = legs[s]; l.leg.rotation.set(0, 0, 0); l.knee.rotation.set(0, 0, 0); l.foot.rotation.set(0, 0, 0);
      const a = arms[s]; a.arm.quaternion.identity(); a.arm.rotation.set(0, 0, 0.12 * s); a.elbow.rotation.set(-0.2, 0, 0);
    }
    face.look(0, 0);
  };
  root.userData.walk = (phase, amt = 1) => {
    const sw = Math.sin(phase) * 0.55 * amt;
    for (const s of [-1, 1]) {
      const l = legs[s]; const ph = s < 0 ? sw : -sw;
      l.leg.rotation.x = ph; l.knee.rotation.x = Math.max(0, Math.sin(phase + (s < 0 ? 0 : Math.PI) + 1.6)) * 0.8 * amt;
      const a = arms[s]; a.arm.rotation.x = -ph * 0.9; a.elbow.rotation.x = -0.35 * amt;
    }
    hips.position.y = 1.155 + Math.abs(Math.cos(phase)) * 0.07 * amt;
    body.rotation.z = Math.sin(phase) * 0.04 * amt;
  };
  // reach hand toward a target expressed in torso-local space
  root.userData.reach = (s, target, pole) => {
    const a = arms[s]; ik2(a.arm, a.elbow, a.S, new THREE.Vector3(...target), new THREE.Vector3(...(pole || [0.6 * s, -0.4, -1])), L1, L2);
  };
  root.userData.reset();
  return root;
}

// ---------- bean-shaped crowd person ----------
export function makeBean(color, skin = '#f6c7a0', seed = 0) {
  const root = new THREE.Group();
  const bodyM = mat(color, { rough: 0.38 });
  const b = grp(root);
  mesh(capsule(0.42, 0.72), bodyM, { parent: b, pos: [0, 1.0, 0] });
  for (const s of [-1, 1]) mesh(capsule(0.1, 0.22), mat('#3b3b46'), { parent: b, pos: [0.17 * s, 0.25, 0] });
  for (const s of [-1, 1]) mesh(rbox(0.22, 0.12, 0.3, 0.05), mat('#3b3b46'), { parent: b, pos: [0.17 * s, 0.06, 0.05] });
  const head = grp(b, 0, 1.92, 0);
  mesh(sphere(0.36, 18, 12), mat(skin, { rough: 0.5 }), { parent: head });
  const eyeM = mat('#1b2133', { rough: 0.3 });
  const eyes = [], hp = [];
  for (const s of [-1, 1]) {
    const e = onSphere(new THREE.Group(), 0.36, 0.12 * s, 0.05, -0.005); head.add(e);
    eyes.push(mesh(sphere(0.045, 12, 8), eyeM, { parent: e, scale: [1, 1.3, 0.5], cast: false }));
    const h = mesh(torus(0.05, 0.016, Math.PI, 6, 14), eyeM, { parent: e, cast: false }); h.visible = false; hp.push(h);
  }
  const m = onSphere(new THREE.Group(), 0.36, 0, -0.13, 0); head.add(m);
  const smile = mesh(torus(0.07, 0.016, Math.PI, 6, 16), mat('#b83a32'), { parent: m, rot: [0, 0, Math.PI], pos: [0, 0.03, 0], cast: false });
  const open = mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#5c1414'), { parent: m, scale: [1, 1, 0.3], pos: [0, 0.03, 0], cast: false });
  open.visible = false;
  const arms = [];
  for (const s of [-1, 1]) {
    const a = grp(b, 0.4 * s, 1.25, 0); a.rotation.z = 0.25 * s;
    mesh(capsule(0.09, 0.3), bodyM, { parent: a, pos: [0, -0.2, 0] });
    mesh(sphere(0.11), mat(skin, { rough: 0.5 }), { parent: a, pos: [0, -0.42, 0] });
    arms.push({ a, s });
  }
  root.userData = { b, head, arms, eyes, hp, smile, open, seed,
    cheer(t, k = 1) {   // bouncing cheer, arms up
      const ph = t * 9 + seed * 2.1;
      b.position.y = Math.abs(Math.sin(ph)) * 0.45 * k;
      for (const { a, s } of arms) a.rotation.z = s * (0.25 + k * (2.4 + Math.sin(ph * 1.3) * 0.3));
      for (const e of eyes) e.visible = false; for (const h of hp) h.visible = true;
      smile.visible = false; open.visible = true;
    },
    idle(t) {
      b.position.y = 0; b.rotation.z = Math.sin(t * 2 + seed) * 0.04;
      for (const { a, s } of arms) a.rotation.z = 0.25 * s;
      for (const e of eyes) e.visible = true; for (const h of hp) h.visible = false; smile.visible = true; open.visible = false;
    },
    panic(t) {
      const ph = t * 14 + seed * 3;
      b.position.y = Math.abs(Math.sin(ph)) * 0.3;
      for (const { a, s } of arms) a.rotation.z = s * (2.6 + Math.sin(ph * 1.7 + s) * 0.4);
      for (const e of eyes) e.visible = true; for (const h of hp) h.visible = false; smile.visible = false; open.visible = true;
    },
  };
  return root;
}

// ---------- cute poop swirl ----------
const POOP = '#8a5530';
export function makePoop(withFace = false, scale = 1) {
  const g = new THREE.Group();
  const m = mat(POOP, { rough: 0.32 });
  mesh(sphere(0.27), m, { parent: g, pos: [0, 0.16, 0], scale: [1, 0.7, 1] });
  mesh(torus(0.27, 0.15, Math.PI * 2, 10, 22), m, { parent: g, pos: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0] });
  mesh(torus(0.18, 0.13, Math.PI * 2, 10, 20), m, { parent: g, pos: [0, 0.36, 0], rot: [Math.PI / 2, 0, 0.6] });
  mesh(torus(0.09, 0.1, Math.PI * 2, 8, 16), m, { parent: g, pos: [0, 0.54, 0], rot: [Math.PI / 2, 0, 1.2] });
  const tip = grp(g, 0, 0.62, 0); tip.rotation.z = -0.5;
  mesh(cone(0.1, 0.22, 16), m, { parent: tip, pos: [0, 0.08, 0] });
  if (withFace) {
    const white = mat('#ffffff', { rough: 0.25 }), pupil = mat('#1b2133');
    for (const s of [-1, 1]) {
      mesh(sphere(0.07, 16, 12), white, { parent: g, pos: [0.1 * s, 0.4, 0.2], scale: [1, 1.15, 0.6], cast: false });
      mesh(sphere(0.035, 12, 8), pupil, { parent: g, pos: [0.1 * s, 0.4, 0.245], cast: false });
    }
    mesh(torus(0.06, 0.014, Math.PI, 6, 14), mat('#ffb3b3'), { parent: g, pos: [0, 0.3, 0.4], rot: [0.3, 0, Math.PI], cast: false });
  }
  g.scale.setScalar(scale);
  return g;
}

// ---------- fly ----------
export function makeFly() {
  const g = new THREE.Group();
  mesh(sphere(0.07, 12, 8), mat('#202020', { rough: 0.3 }), { parent: g, cast: false });
  const wm = mat('#e8f4ff', { opacity: 0.7, rough: 0.2 });
  const wings = [];
  for (const s of [-1, 1]) { const w = grp(g, 0.03 * s, 0.05, 0); mesh(sphere(0.07, 10, 6), wm, { parent: w, pos: [0.06 * s, 0.02, 0], scale: [1, 0.25, 0.6], cast: false }); wings.push(w); }
  g.userData.flap = (t) => { for (const [i, w] of wings.entries()) w.rotation.z = (i ? -1 : 1) * Math.sin(t * 80) * 0.6; };
  return g;
}

// ---------- fish (pokes head up out of water, faces +z) ----------
export function makeFish(color = '#ff9a3c') {
  const g = new THREE.Group();
  const bodyM = mat(color, { unique: true, rough: 0.35 });
  const b = grp(g);
  mesh(sphere(0.55, 22, 16), bodyM, { parent: b, pos: [0, 0.55, 0], scale: [0.9, 1.25, 0.75] });
  mesh(sphere(0.38, 16, 12), mat('#fff1d6'), { parent: b, pos: [0, 0.42, 0.22], scale: [0.95, 1.2, 0.6] });
  for (const s of [-1, 1]) mesh(sphere(0.2, 16, 10), bodyM, { parent: b, pos: [0.5 * s, 0.45, 0], rot: [0, 0, 0.8 * s], scale: [0.35, 1, 0.8] });
  mesh(sphere(0.18, 16, 10), bodyM, { parent: b, pos: [0, 1.25, -0.05], scale: [0.3, 1, 1] }); // dorsal fin
  const tail = grp(b, 0, -0.1, 0);
  for (const s of [-1, 1]) mesh(sphere(0.25, 16, 10), bodyM, { parent: tail, pos: [0.15 * s, -0.2, 0], rot: [0, 0, 0.7 * s], scale: [0.6, 1, 0.25] });
  const head = grp(b, 0, 0.75, 0.05);
  const face = buildFace(head, 0.42, { skin: color, eyeX: 0.17, eyeY: 0.1, eyeSize: 1.15, browColor: '#3a2a20' });
  for (const br of face.brows) br.g.visible = false;
  g.userData = { b, face, bodyM, base: new THREE.Color(color), tail };
  return g;
}

// ---------- environment props ----------
export function makeTree(seed = 0, s = 1) {
  const g = new THREE.Group();
  mesh(cyl(0.22, 0.32, 2.4, 12), mat('#7a5232', { rough: 0.8 }), { parent: g, pos: [0, 1.2, 0] });
  const leaf = mat(['#4f9a2f', '#5aa836', '#478c2a'][seed % 3], { rough: 0.7 });
  const pts = [[0, 3.1, 0, 1.3], [0.8, 2.7, 0.2, 0.9], [-0.8, 2.75, -0.1, 0.95], [0.1, 2.6, 0.8, 0.85], [-0.2, 3.7, -0.3, 0.9]];
  for (const [x, y, z, r] of pts) mesh(sphere(r, 12, 9), leaf, { parent: g, pos: [x, y, z] });
  g.scale.setScalar(s);
  return g;
}
export function makeCloud(seed = 0, s = 1, color = '#ffffff') {
  const g = new THREE.Group();
  const m = mat(color, { rough: 1, emissive: color, ei: 0.35 });
  const blobs = [[0, 0, 0, 3], [3, -0.6, 0.3, 2.3], [-3, -0.7, 0, 2.2], [1.4, 1.4, -0.3, 2.2], [-1.5, 1.0, 0.2, 2], [4.8, -1.2, 0, 1.5], [-4.6, -1.3, 0.2, 1.4]];
  for (const [x, y, z, r] of blobs) mesh(sphere(r, 12, 8), m, { parent: g, pos: [x, y + (seed % 3) * 0.1, z], scale: [1, 0.85, 0.8], cast: false, receive: false });
  g.scale.setScalar(s);
  return g;
}
export function makeBucket() {
  const g = new THREE.Group();
  mesh(cyl(0.38, 0.3, 0.55, 20, true), mat('#9a6a3e', { side: THREE.DoubleSide }), { parent: g, pos: [0, 0.27, 0] });
  mesh(cyl(0.3, 0.3, 0.03, 20), mat('#9a6a3e'), { parent: g, pos: [0, 0.01, 0] });
  for (const y of [0.1, 0.45]) mesh(torus(0.3 + y * 0.15, 0.025, Math.PI * 2, 6, 24), mat('#555a60', { metal: 0.5 }), { parent: g, pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
  mesh(torus(0.38, 0.02, Math.PI, 6, 24), mat('#555a60', { metal: 0.5 }), { parent: g, pos: [0, 0.55, 0] });
  return g;
}
export function makeShovel() {
  const g = new THREE.Group();
  mesh(cyl(0.04, 0.04, 1.6, 8), mat('#a0703f'), { parent: g, pos: [0, 0.8, 0] });
  mesh(rbox(0.32, 0.4, 0.05, 0.03), mat('#9aa3ad', { metal: 0.6, rough: 0.35 }), { parent: g, pos: [0, -0.15, 0] });
  mesh(cyl(0.06, 0.06, 0.25, 8), mat('#a0703f'), { parent: g, pos: [0, 1.6, 0], rot: [0, 0, Math.PI / 2] });
  return g;
}
export function makeToilet() {
  const g = new THREE.Group();
  const white = mat('#fbfbf8', { rough: 0.15 });
  const prof = [[0, 0], [0.26, 0], [0.24, 0.1], [0.2, 0.25], [0.3, 0.45], [0.36, 0.55], [0.3, 0.58], [0, 0.58]].map(([x, y]) => new THREE.Vector2(x, y));
  mesh(new THREE.LatheGeometry(prof, 28), white, { parent: g, scale: [1, 1, 1.2] });
  mesh(torus(0.29, 0.06, Math.PI * 2, 10, 28), mat('#9b6b3d'), { parent: g, pos: [0, 0.6, 0.03], rot: [Math.PI / 2, 0, 0], scale: [1, 1.2, 1] });
  mesh(rbox(0.6, 0.4, 0.25, 0.06), mat('#9b6b3d'), { parent: g, pos: [0, 2.1, -0.35] });
  mesh(cyl(0.035, 0.035, 1.5, 8), mat('#9aa3ad', { metal: 0.5 }), { parent: g, pos: [0.2, 1.3, -0.4] });
  const chain = grp(g, 0.25, 1.9, -0.25);
  mesh(cyl(0.012, 0.012, 0.8, 6), mat('#c0c4c8', { metal: 0.6 }), { parent: chain, pos: [0, -0.4, 0] });
  mesh(capsule(0.04, 0.1), mat('#f0e6d2'), { parent: chain, pos: [0, -0.85, 0] });
  g.userData.chain = chain;
  return g;
}
export function makeLantern() {
  const g = new THREE.Group();
  mesh(rbox(0.26, 0.34, 0.26, 0.04), mat('#ffd36a', { emissive: '#ffb733', ei: 2.2, opacity: 0.95, depthWrite: true }), { parent: g, cast: false });
  mesh(rbox(0.3, 0.06, 0.3, 0.02), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, 0.2, 0] });
  mesh(rbox(0.3, 0.05, 0.3, 0.02), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, -0.19, 0] });
  mesh(torus(0.1, 0.015, Math.PI, 6, 14), mat('#3a3a3a', { metal: 0.6 }), { parent: g, pos: [0, 0.24, 0] });
  return g;
}
