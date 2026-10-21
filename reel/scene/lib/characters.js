// Toy-like stylized characters built from primitives, with a small IK rig and an expressive face.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { solveIK, mulberry32, clamp, lerp } from './util.js';
import { stripeTexture, knitTexture, furTexture, lin } from './materials.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();

export function skinMat(hex) {
  return new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.48, metalness: 0, sheen: 0.6, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffb0a0), clearcoat: 0.12, clearcoatRoughness: 0.6 });
}
export function clothMat(hex, map = null, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ color: map ? 0xffffff : hex, map, roughness: 0.85, sheen: 0.5, sheenRoughness: 0.8, sheenColor: new THREE.Color(0xffffff), ...extra });
}
function plastic(hex, rough = 0.35) { return new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, clearcoat: 0.5, clearcoatRoughness: 0.3 }); }

function capsuleY(r, len, mat, segs = 16) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, segs); g.translate(0, -len / 2, 0);
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function sphere(r, mat, w = 32, h = 20) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat); m.castShadow = true; m.receiveShadow = true; return m; }

// geometry projected onto the head sphere (for mouth / blush decals)
function projectToSphere(geo, R, lift) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const z = Math.sqrt(Math.max(0, R * R - x * x - y * y)) + lift; p.setZ(i, z); }
  geo.computeVertexNormals(); return geo;
}

// ------------------------------------------------------------ FACE
function buildFace(head, R, o) {
  const face = {};
  const eyeR = R * (o.eyeScale || 0.3);
  const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 });
  const irisM = new THREE.MeshPhysicalMaterial({ color: o.iris || 0x4a2c18, roughness: 0.2, clearcoat: 1 });
  const pupilM = new THREE.MeshBasicMaterial({ color: 0x050302 });
  const hiM = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lidM = o.skin;
  face.eyes = [];
  for (const s of [-1, 1]) {
    const ex = s * R * (o.eyeSpread || 0.36), ey = R * (o.eyeY ?? 0.08);
    const ez = Math.sqrt(R * R - ex * ex - ey * ey) - eyeR * 0.45;
    const eg = new THREE.Group(); eg.position.set(ex, ey, ez); head.add(eg);
    const w = sphere(eyeR, white); w.scale.set(1, 1.08, 0.75); eg.add(w);
    const look = new THREE.Group(); eg.add(look);
    const iris = sphere(eyeR * 0.62, irisM, 24, 16); iris.scale.set(1, 1.08, 0.45); iris.position.z = eyeR * 0.58; look.add(iris);
    const pupil = sphere(eyeR * 0.34, pupilM, 20, 12); pupil.scale.set(1, 1.08, 0.4); pupil.position.z = eyeR * 0.72; look.add(pupil);
    const h1 = sphere(eyeR * 0.13, hiM, 10, 8); h1.position.set(eyeR * 0.22, eyeR * 0.28, eyeR * 0.83); look.add(h1);
    const h2 = sphere(eyeR * 0.06, hiM, 8, 6); h2.position.set(-eyeR * 0.18, -eyeR * 0.2, eyeR * 0.83); look.add(h2);
    [iris, pupil, h1, h2].forEach((m) => (m.castShadow = false));
    // eyelids: upper + lower hemispheres in skin colour
    const lidGeo = new THREE.SphereGeometry(eyeR * 1.1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const upper = new THREE.Mesh(lidGeo, lidM); upper.scale.set(1, 1.08, 0.8); eg.add(upper);
    const lower = new THREE.Mesh(lidGeo, lidM); lower.scale.set(1, 1.08, 0.8); lower.rotation.x = Math.PI; eg.add(lower);
    // brow
    const brow = capsuleY(eyeR * 0.16, eyeR * 1.2, o.browMat || new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 }));
    brow.geometry.translate(0, eyeR * 0.6, 0); brow.rotation.z = Math.PI / 2;
    const bg = new THREE.Group(); bg.position.set(ex, ey + eyeR * 1.35, Math.sqrt(Math.max(0, R * R - ex * ex - (ey + eyeR * 1.35) ** 2)) + eyeR * 0.12); bg.add(brow); head.add(bg);
    if (o.bushyBrows) brow.scale.set(1.6, 1.05, 1.4);
    face.eyes.push({ group: eg, look, upper, lower, brow: bg, s, eyeR, ey });
  }
  // nose
  const nose = sphere(R * (o.noseR || 0.1), o.noseMat || o.skin, 20, 14); nose.position.set(0, -R * 0.08, R * 0.98); head.add(nose);
  // blush
  const blushM = new THREE.MeshBasicMaterial({ color: 0xff6f6f, transparent: true, opacity: o.blush ?? 0.28, depthWrite: false });
  for (const s of [-1, 1]) {
    const g = projectToSphere(new THREE.CircleGeometry(R * 0.13, 20).translate(s * R * 0.55, -R * 0.2, 0), R, 0.002);
    const b = new THREE.Mesh(g, blushM); b.renderOrder = 2; head.add(b);
  }
  // mouth (rebuilt each frame from expression params)
  const mouthM = new THREE.MeshStandardMaterial({ color: 0x4a1410, roughness: 0.6, side: THREE.DoubleSide });
  const tongueM = new THREE.MeshStandardMaterial({ color: 0xe5737a, roughness: 0.5, side: THREE.DoubleSide });
  const teethM = new THREE.MeshStandardMaterial({ color: 0xfaf6ee, roughness: 0.3, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(new THREE.BufferGeometry(), mouthM);
  const tongue = new THREE.Mesh(new THREE.BufferGeometry(), tongueM);
  const teeth = new THREE.Mesh(new THREE.BufferGeometry(), teethM);
  head.add(mouth, tongue, teeth);
  face.mouthY = -R * (o.mouthY ?? 0.36);
  face.setMouth = ({ smile = 0.5, open = 0, wide = 1, teethShow = 0 }) => {
    const cy = face.mouthY; const w = R * 0.22 * wide * (1 - open * 0.25);
    const corner = cy + R * 0.09 * smile;
    const thick = R * 0.022;
    const up = cy - R * 0.02 * smile + R * 0.05 * open * (1 - smile * 0.5);
    const lo = cy - R * 0.1 * smile - R * 0.22 * open - thick;
    const mk = (uy, ly, wx, yOff = 0) => {
      const sh = new THREE.Shape(); sh.moveTo(-wx, corner + yOff);
      sh.quadraticCurveTo(0, uy * 2 - corner + yOff * 0, wx, corner + yOff);
      sh.quadraticCurveTo(0, ly * 2 - corner, -wx, corner + yOff);
      return projectToSphere(new THREE.ShapeGeometry(sh, 12), R, 0.004);
    };
    mouth.geometry.dispose(); mouth.geometry = mk(up, lo, w);
    tongue.geometry.dispose(); tongue.visible = open > 0.15;
    if (tongue.visible) { const tl = lo + R * 0.02; tongue.geometry = mk(lerp(lo, up, 0.45), tl, w * 0.55); tongue.geometry.translate(0, 0, 0.002); }
    teeth.geometry.dispose(); teeth.visible = teethShow > 0.05 && open > 0.05;
    if (teeth.visible) { teeth.geometry = mk(up, lerp(up, lo, 0.28 * teethShow), w * 0.9); teeth.geometry.translate(0, 0, 0.003); }
  };
  face.setEyes = ({ open = 1, browUp = 0, browAngle = 0, gaze = null, pupil = 1 }) => {
    for (const e of face.eyes) {
      const o2 = clamp(open, 0, 1.25);
      e.upper.rotation.x = -lerp(0.0, 1.45, clamp(o2, 0, 1)) - (o2 > 1 ? (o2 - 1) * 0.6 : 0);
      e.lower.rotation.x = Math.PI + lerp(0.0, 1.2, clamp(o2, 0, 1)) + (o2 > 1 ? (o2 - 1) * 0.3 : 0);
      e.brow.position.y = e.ey + e.eyeR * (1.35 + browUp * 0.45);
      e.brow.rotation.z = -e.s * browAngle;
      if (gaze) {
        // gaze in head-local space
        _v.copy(gaze); e.group.worldToLocal(_v);
        const yaw = clamp(Math.atan2(_v.x, Math.max(0.01, _v.z)), -0.6, 0.6), pitch = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.45, 0.45);
        e.look.rotation.set(-pitch, yaw, 0);
      } else e.look.rotation.set(0, 0, 0);
      e.look.children[1].scale.set(pupil, pupil * 1.08, 0.4);
    }
  };
  return face;
}

// ------------------------------------------------------------ HUMANOID
export function makeHuman(o) {
  const root = new THREE.Group();
  const hips = new THREE.Group(); root.add(hips);
  const spine = new THREE.Group(); hips.add(spine);
  const neck = new THREE.Group(); neck.position.y = o.torsoH; spine.add(neck);
  const head = new THREE.Group(); head.position.y = o.neck + o.headR * 0.92; neck.add(head);
  // torso
  const rB = o.torsoR, rT = o.torsoR * (o.shoulderK || 0.92), h = o.torsoH;
  const prof = [[0.0, -0.06], [rB * 0.8, -0.05], [rB * 1.0, 0.02], [rB * 1.04, h * 0.35], [rT, h * 0.75], [rT * 0.85, h * 0.93], [rT * 0.4, h * 1.02], [0.0, h * 1.04]].map(([x, y]) => new THREE.Vector2(x, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), o.shirt); torso.castShadow = true; torso.receiveShadow = true;
  torso.scale.z = o.torsoDepth || 0.82; spine.add(torso);
  const pelvis = sphere(rB * 0.98, o.pants); pelvis.scale.set(1, 0.62, (o.torsoDepth || 0.82)); pelvis.position.y = 0.0; hips.add(pelvis);
  // head
  const headMesh = sphere(o.headR, o.skin, 48, 32); headMesh.scale.set(1, o.headSquash || 0.97, 0.98); head.add(headMesh);
  for (const s of [-1, 1]) { const ear = sphere(o.headR * 0.2, o.skin, 16, 12); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * o.headR * 0.97, -o.headR * 0.02, -o.headR * 0.05); head.add(ear); }
  const face = buildFace(head, o.headR, o);
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * rT * 0.98, h * 0.82, 0); spine.add(sh);
    const upper = capsuleY(o.armR, o.armA, o.sleeveFull ? o.shirt : o.skin); sh.add(upper);
    if (!o.sleeveFull) { const sl = capsuleY(o.armR * 1.35, o.armA * 0.45, o.shirt); sl.position.y = 0.0; sh.add(sl); }
    else if (o.cuff) { /* long sleeves */ }
    const el = new THREE.Group(); el.position.y = -o.armA; sh.add(el);
    const lower = capsuleY(o.armR * 0.95, o.armB, o.sleeveFull ? o.shirt : o.skin); el.add(lower);
    const hand = new THREE.Group(); hand.position.y = -o.armB - o.handR * 0.6; el.add(hand);
    const palm = sphere(o.handR, o.skin, 20, 14); palm.scale.set(0.95, 1.05, 0.8); hand.add(palm);
    const thumb = sphere(o.handR * 0.42, o.skin, 12, 8); thumb.position.set(-s * o.handR * 0.75, o.handR * 0.2, o.handR * 0.35); hand.add(thumb);
    arms.push({ s, sh, el, hand });
  }
  // legs
  const legs = [];
  const legA = (o.legLen - o.footH) * 0.5, legB = (o.legLen - o.footH) * 0.5;
  for (const s of [-1, 1]) {
    const hp = new THREE.Group(); hp.position.set(s * rB * 0.48, 0, 0); hips.add(hp);
    const thigh = capsuleY(o.legR, legA, o.pants); hp.add(thigh);
    const kn = new THREE.Group(); kn.position.y = -legA; hp.add(kn);
    const shin = capsuleY(o.legR * 0.92, legB, o.shinMat || o.skin); kn.add(shin);
    if (o.sock) { const sk = capsuleY(o.legR * 0.98, legB * 0.3, o.sock); sk.position.y = -legB * 0.7; kn.add(sk); }
    const foot = new THREE.Group(); foot.position.y = -legB; kn.add(foot);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(o.legR * 2.3, o.footH * 1.5, o.legR * 3.6, 3, o.footH * 0.55), o.shoe);
    shoe.position.set(0, -o.footH * 0.35, o.legR * 0.6); shoe.castShadow = true; foot.add(shoe);
    if (o.sole) { const so = new THREE.Mesh(new RoundedBoxGeometry(o.legR * 2.4, o.footH * 0.4, o.legR * 3.7, 2, o.footH * 0.18), o.sole); so.position.set(0, -o.footH * 0.95, o.legR * 0.6); foot.add(so); }
    legs.push({ s, hp, kn, foot });
  }
  const ch = { root, hips, spine, neck, head, face, arms, legs, o, legA, legB, props: {} };
  if (o.extras) o.extras(ch);
  ch.pose = (p) => applyPose(ch, p);
  return ch;
}

const UP = new THREE.Vector3(0, 1, 0);
function applyPose(ch, p) {
  const o = ch.o;
  ch.root.position.set(p.x, p.y || 0, p.z);
  ch.root.rotation.set(0, p.yaw || 0, 0);
  const crouch = p.crouch || 0;
  ch.hips.position.set(p.hipX || 0, o.legLen * (1 - crouch) + (p.bob || 0), p.hipZ || 0);
  ch.hips.rotation.set(p.hipPitch || 0, p.hipYaw || 0, p.hipRoll || 0);
  ch.spine.rotation.set(p.lean || 0, p.twist || 0, p.side || 0);
  ch.neck.rotation.set((p.headPitch || 0) * 0.4, (p.headYaw || 0) * 0.4, (p.headRoll || 0) * 0.4);
  ch.head.rotation.set((p.headPitch || 0) * 0.6, (p.headYaw || 0) * 0.6, (p.headRoll || 0) * 0.6);
  const sq = p.squash || 0; ch.root.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  ch.root.updateMatrixWorld(true);
  const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, p.yaw || 0);
  const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, p.yaw || 0);
  // legs
  for (const L of ch.legs) {
    const key = L.s < 0 ? 'footL' : 'footR';
    let tgt = p[key];
    const hipW = L.hp.getWorldPosition(new THREE.Vector3());
    if (!tgt) tgt = hipW.clone().setY((p.y || 0) + o.footH * 0.9).addScaledVector(right, L.s * 0.0);
    const pole = hipW.clone().addScaledVector(fwd, 1).addScaledVector(right, L.s * 0.15).add(new THREE.Vector3(0, -0.2, 0));
    solveIK(L.hp, L.kn, ch.legA, ch.legB, tgt, pole);
    // keep foot level and pointing forward
    L.kn.updateWorldMatrix(true, false);
    L.kn.getWorldQuaternion(_q).invert();
    const want = new THREE.Quaternion().setFromAxisAngle(UP, (p.yaw || 0) + L.s * 0.12).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p[key + 'Pitch'] || 0));
    L.foot.quaternion.copy(_q.multiply(want));
  }
  // arms
  ch.spine.updateMatrixWorld(true);
  for (const A of ch.arms) {
    const key = A.s < 0 ? 'handL' : 'handR';
    const shW = A.sh.getWorldPosition(new THREE.Vector3());
    let tgt = p[key];
    if (!tgt) {
      const swing = p[key + 'Swing'] || 0, out = p.armsOut || 0.12;
      tgt = shW.clone().add(new THREE.Vector3(0, -(o.armA + o.armB) * 0.92, 0)).addScaledVector(right, A.s * out).addScaledVector(fwd, swing + 0.03);
    }
    const pole = shW.clone().addScaledVector(fwd, -1.0).addScaledVector(right, A.s * 0.6).add(new THREE.Vector3(0, -0.5, 0));
    if (p[key + 'Pole']) pole.copy(p[key + 'Pole']);
    solveIK(A.sh, A.el, o.armA, o.armB + o.handR * 0.6, tgt, pole);
  }
  // face
  const e = p.expr || {};
  ch.face.setMouth({ smile: e.smile ?? 0.5, open: e.open ?? 0, wide: e.wide ?? 1, teethShow: e.teeth ?? 0 });
  ch.face.setEyes({ open: e.eyeOpen ?? 1, browUp: e.browUp ?? 0, browAngle: e.browAngle ?? 0, gaze: e.gaze || null, pupil: e.pupil ?? 1 });
  if (ch.onPose) ch.onPose(p);
}

// walking helper -> foot targets + bob for a given phase (radians) along heading
export function walkCycle(pos, yaw, phase, { stride = 0.22, lift = 0.07, footH = 0.05, width = 0.09 } = {}) {
  const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const f = (s, ph) => {
    const c = Math.cos(ph), sn = Math.sin(ph);
    const v = new THREE.Vector3(pos.x, footH * 0.9 + Math.max(0, sn) * lift, pos.z).addScaledVector(fwd, c * stride * 0.5).addScaledVector(right, s * width);
    return v;
  };
  return {
    footL: f(-1, phase), footR: f(1, phase + Math.PI),
    bob: Math.abs(Math.sin(phase)) * 0.025 - 0.012,
    handLSwing: -Math.cos(phase) * 0.12, handRSwing: Math.cos(phase) * 0.12,
  };
}

// ------------------------------------------------------------ CAST
export function makeKid() {
  const skin = skinMat(0xc98d6a);
  const shirt = clothMat(0xffffff, stripeTexture({ a: '#e2483a', b: '#fff3e0', n: 9 }));
  shirt.map.repeat.set(1, 1);
  const hairM = new THREE.MeshPhysicalMaterial({ color: 0x3b2316, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0x8a5a3a), clearcoat: 0.2 });
  const ch = makeHuman({
    headR: 0.25, neck: 0.02, torsoH: 0.33, torsoR: 0.155, legLen: 0.36, footH: 0.05, legR: 0.055, armR: 0.042, armA: 0.15, armB: 0.14, handR: 0.05,
    skin, shirt, pants: clothMat(0x2f4d7a), sock: clothMat(0xf4f1ea), shoe: plastic(0xd8433a, 0.4), sole: plastic(0xf6f3ee, 0.5),
    browMat: new THREE.MeshStandardMaterial({ color: 0x2e1a10, roughness: 0.7 }), eyeScale: 0.3, iris: 0x5a3416,
    extras: (c) => {
      const R = 0.25; const rnd = mulberry32(5); const hair = new THREE.Group(); c.head.add(hair);
      // rounded cap covering the top/back of the head, ending above the brows
      const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), hairM);
      cap.rotation.x = -0.42; cap.position.set(0, R * 0.04, -R * 0.03); cap.castShadow = true; hair.add(cap);
      // messy chunky tufts: elongated, slightly bent ellipsoids sticking out at random angles
      const tuftGeo = new THREE.SphereGeometry(1, 16, 12);
      for (let i = 0; i < 15; i++) {
        const a = rnd() * Math.PI * 2, e = 0.2 + rnd() * 0.85;
        const dir = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e));
        if (dir.z > 0.35 && dir.y < 0.75) continue;
        const t = new THREE.Mesh(tuftGeo, hairM);
        const len = R * (0.22 + rnd() * 0.18), wid = R * (0.15 + rnd() * 0.06);
        t.scale.set(wid, len, wid * 0.8);
        const out = dir.clone().multiplyScalar(1.4).add(new THREE.Vector3((rnd() - 0.5) * 0.9, 0.15, (rnd() - 0.5) * 0.5 - 0.35)).normalize();
        t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out);
        t.position.copy(dir.clone().multiplyScalar(R * 0.98)).add(out.clone().multiplyScalar(len * 0.45)).add(new THREE.Vector3(0, R * 0.05, -R * 0.04));
        t.castShadow = true; hair.add(t);
      }
      // side-swept bangs over the forehead (above the brows)
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(tuftGeo, hairM); const x = (i - 1.2) * R * 0.32;
        b.scale.set(R * 0.2, R * 0.12, R * 0.34);
        b.position.set(x, R * 0.74 - Math.abs(x) * 0.15, R * 0.55 - Math.abs(x) * 0.25);
        b.rotation.set(-0.6, -0.3 + i * 0.12, -0.5 - i * 0.12); b.castShadow = true; hair.add(b);
      }
    },
  });
  ch.root.name = 'kid';
  return ch;
}

export function makeNeighbor() {
  const skin = skinMat(0xe7b48f);
  const shirt = clothMat(0x7fb3d8);
  const hatM = new THREE.MeshPhysicalMaterial({ color: 0xe6cf98, roughness: 0.9, sheen: 0.4 });
  const ch = makeHuman({
    headR: 0.235, neck: 0.04, torsoH: 0.58, torsoR: 0.2, shoulderK: 0.95, legLen: 0.74, footH: 0.06, legR: 0.07, armR: 0.05, armA: 0.27, armB: 0.25, handR: 0.06,
    skin, shirt, pants: clothMat(0xc8b58a), shoe: plastic(0x6b4a33, 0.6), sock: null, eyeScale: 0.28, iris: 0x2d5a3a, noseR: 0.15, eyeSpread: 0.35,
    browMat: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.7 }), blush: 0.18,
    extras: (c) => {
      const R = 0.235;
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(R * 2.0, R * 2.05, 0.02, 48), hatM); brim.position.y = R * 0.5; brim.rotation.x = -0.08; brim.castShadow = true; c.head.add(brim);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), hatM); crown.scale.set(1, 0.95, 1); crown.position.y = R * 0.42; crown.castShadow = true; c.head.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.03, R * 1.03, R * 0.16, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x3f6f4a, roughness: 0.7 })); band.position.y = R * 0.52; c.head.add(band);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 24), shirt); collar.rotation.x = Math.PI / 2; collar.position.y = 0.58; c.spine.add(collar);
    },
  });
  ch.root.name = 'neighbor';
  return ch;
}

export function makeGrandpa() {
  const skin = skinMat(0xd69f7b);
  const knit = knitTexture({ color: [128, 116, 74] });
  const cardigan = clothMat(0xffffff, knit.map, { bumpMap: knit.bump, bumpScale: 1.5 });
  const whiteHair = new THREE.MeshPhysicalMaterial({ color: 0xf3f0ea, roughness: 0.6, sheen: 1, sheenColor: new THREE.Color(0xffffff) });
  const ch = makeHuman({
    headR: 0.255, neck: 0.03, torsoH: 0.5, torsoR: 0.205, shoulderK: 0.88, legLen: 0.6, footH: 0.06, legR: 0.068, armR: 0.05, armA: 0.22, armB: 0.21, handR: 0.06,
    skin, shirt: cardigan, sleeveFull: true, pants: clothMat(0x6d5240), shinMat: clothMat(0x6d5240), shoe: plastic(0x4a2f22, 0.5),
    eyeScale: 0.25, iris: 0x3a5a7a, noseR: 0.14, eyeY: 0.1, bushyBrows: true, browMat: whiteHair, blush: 0.3, mouthY: 0.4,
    extras: (c) => {
      const R = 0.255; const rnd = mulberry32(8);
      // white hair ring around the back/sides (bald top)
      for (let i = 0; i < 16; i++) {
        const a = Math.PI * 0.25 + (i / 15) * Math.PI * 1.5; const t = sphere(R * 0.2, whiteHair, 14, 10);
        t.position.set(Math.cos(a + Math.PI / 2) * R * 0.92 * -1, R * (0.05 + rnd() * 0.12), Math.sin(a + Math.PI / 2) * R * 0.92 * -1);
        if (t.position.z > R * 0.3) continue; t.scale.set(1.1, 0.9, 1); c.head.add(t);
      }
      // mustache
      for (const s of [-1, 1]) {
        const m = sphere(R * 0.2, whiteHair, 24, 16); m.scale.set(1.5, 0.62, 0.7); m.position.set(s * R * 0.17, -R * 0.25, R * 0.92); m.rotation.z = s * 0.35; c.head.add(m);
        const m2 = sphere(R * 0.13, whiteHair, 16, 12); m2.scale.set(1.4, 0.7, 0.7); m2.position.set(s * R * 0.38, -R * 0.34, R * 0.8); m2.rotation.z = s * 0.8; c.head.add(m2);
      }
      // round glasses
      const frameM = new THREE.MeshStandardMaterial({ color: 0x5a3a24, roughness: 0.4, metalness: 0.3 });
      const lensM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false });
      for (const s of [-1, 1]) {
        const x = s * R * 0.36, y = R * 0.1; const z = Math.sqrt(R * R - x * x - y * y) + R * 0.12;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.26, R * 0.03, 10, 32), frameM); ring.position.set(x, y, z); c.head.add(ring);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(R * 0.25, 28), lensM); lens.position.set(x, y, z); c.head.add(lens);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(R * 0.03, R * 0.03, R * 0.9), frameM); arm.position.set(s * R * 0.62, y, z - R * 0.45); arm.rotation.y = s * 0.18; c.head.add(arm);
      }
      const bridge = new THREE.Mesh(new THREE.TorusGeometry(R * 0.07, R * 0.025, 8, 16, Math.PI), frameM); bridge.position.set(0, R * 0.13, R * 1.08); c.head.add(bridge);
      // shirt collar + buttons
      const collarM = clothMat(0xf7f3ea);
      for (const s of [-1, 1]) { const cl = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 3), collarM); cl.rotation.set(Math.PI * 0.55, 0, s * 0.5); cl.position.set(s * 0.06, 0.49, 0.1); c.spine.add(cl); }
      const v = new THREE.Mesh(new THREE.CircleGeometry(0.08, 3), collarM); v.position.set(0, 0.43, 0.165); v.rotation.z = Math.PI / 2 + Math.PI / 6; v.scale.set(1.3, 0.8, 1); c.spine.add(v);
      for (let i = 0; i < 4; i++) { const b = sphere(0.018, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.3 }), 10, 8); b.position.set(0, 0.36 - i * 0.09, 0.168 + Math.sin(i * 0.5) * 0.005); b.scale.z = 0.5; c.spine.add(b); }
    },
  });
  ch.root.name = 'grandpa';
  return ch;
}

// ------------------------------------------------------------ DOG
export function makeDog() {
  const fur = furTexture({ base: [238, 200, 146] });
  const furM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: fur.map, bumpMap: fur.bump, bumpScale: 2.5, roughness: 0.9, sheen: 1.0, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xfff0d8) });
  const furLight = new THREE.MeshPhysicalMaterial({ color: 0xfff4e2, roughness: 0.9, sheen: 1.0, sheenColor: new THREE.Color(0xffffff) });
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const rnd = mulberry32(12);
  // fluffy torso: big ellipsoid + many fur puffs
  const torso = sphere(0.24, furM, 40, 28); torso.scale.set(0.95, 0.85, 1.35); torso.position.y = 0.36; body.add(torso);
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const puffs = new THREE.InstancedMesh(puffGeo, furM, 90); const d = new THREE.Object3D();
  for (let i = 0; i < 90; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
    const n = new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a));
    if (n.y < -0.55) { i--; continue; }
    d.position.set(n.x * 0.22, 0.36 + n.y * 0.19, n.z * 0.31); const s = 0.05 + rnd() * 0.05; d.scale.setScalar(s); d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); d.updateMatrix(); puffs.setMatrixAt(i, d.matrix);
  }
  puffs.castShadow = true; body.add(puffs);
  const chest = sphere(0.15, furLight, 24, 16); chest.position.set(0, 0.36, 0.26); chest.scale.set(1, 1.1, 0.8); body.add(chest);
  // head
  const neck = new THREE.Group(); neck.position.set(0, 0.48, 0.28); body.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.06); neck.add(head);
  const skull = sphere(0.17, furM, 36, 24); skull.scale.set(1.05, 0.95, 1); head.add(skull);
  for (let i = 0; i < 14; i++) { const a = rnd() * 6.28, e = rnd() * 1.4 - 0.3; const p = sphere(0.055 + rnd() * 0.03, furM, 12, 8); p.position.set(Math.cos(a) * Math.cos(e) * 0.15, Math.sin(e) * 0.14, Math.sin(a) * Math.cos(e) * 0.13 - 0.03); if (p.position.z > 0.08) continue; head.add(p); }
  const snout = sphere(0.09, furLight, 24, 16); snout.scale.set(1.1, 0.8, 1.1); snout.position.set(0, -0.04, 0.14); head.add(snout);
  const nose = sphere(0.035, new THREE.MeshPhysicalMaterial({ color: 0x1a1210, roughness: 0.2, clearcoat: 1 }), 16, 12); nose.scale.set(1.3, 0.9, 1); nose.position.set(0, -0.005, 0.235); head.add(nose);
  const tongue = sphere(0.04, new THREE.MeshPhysicalMaterial({ color: 0xf07a86, roughness: 0.35, clearcoat: 0.6 }), 16, 12); tongue.scale.set(1, 0.4, 1.4); tongue.position.set(0.0, -0.1, 0.17); head.add(tongue);
  const mouthLine = sphere(0.07, new THREE.MeshStandardMaterial({ color: 0x3a1a12 }), 16, 8); mouthLine.scale.set(1.0, 0.18, 0.6); mouthLine.position.set(0, -0.08, 0.15); head.add(mouthLine);
  const eyes = [];
  const white = new THREE.MeshPhysicalMaterial({ color: 0x1b120c, roughness: 0.1, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = sphere(0.04, white, 20, 14); e.position.set(s * 0.075, 0.04, 0.135); head.add(e);
    const hl = sphere(0.012, new THREE.MeshBasicMaterial({ color: 0xffffff }), 8, 6); hl.position.set(s * 0.075 + 0.012, 0.055, 0.172); head.add(hl);
    eyes.push(e);
  }
  const ears = [];
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.13, 0.08, -0.02); head.add(eg);
    const ear = sphere(0.08, new THREE.MeshPhysicalMaterial({ color: 0xc98a52, roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(0xffd8a8) }), 20, 14); ear.scale.set(0.55, 1.15, 0.9); ear.position.set(s * 0.02, -0.07, 0); eg.add(ear);
    ears.push(eg);
  }
  // legs
  const legs = [];
  for (const [x, z] of [[-0.11, 0.2], [0.11, 0.2], [-0.11, -0.2], [0.11, -0.2]]) {
    const lg = new THREE.Group(); lg.position.set(x, 0.26, z); body.add(lg);
    const leg = capsuleY(0.055, 0.17, furM); lg.add(leg);
    const paw = sphere(0.065, furLight, 16, 12); paw.scale.set(1, 0.7, 1.25); paw.position.set(0, -0.23, 0.02); lg.add(paw);
    legs.push(lg);
  }
  // tail plume
  const tail = new THREE.Group(); tail.position.set(0, 0.46, -0.3); body.add(tail);
  for (let i = 0; i < 5; i++) { const p = sphere(0.06 + i * 0.012, furLight, 14, 10); p.position.set(0, 0.04 + i * 0.045, -i * 0.03); tail.add(p); }
  // bone held in mouth (hidden by default)
  const dog = { root, body, neck, head, legs, tail, ears, tongue };
  dog.pose = (p) => {
    root.position.set(p.x, 0, p.z); root.rotation.y = p.yaw || 0;
    const run = p.run || 0, walk = p.walk || 0, ph = p.phase || 0;
    body.position.y = (p.bob || 0) + Math.abs(Math.sin(ph)) * 0.03 * (walk + run * 2);
    body.rotation.x = (p.pitch || 0) + Math.sin(ph * 2) * 0.04 * run;
    neck.rotation.x = p.headPitch || 0; neck.rotation.y = p.headYaw || 0; head.rotation.z = p.headRoll || 0;
    const amp = 0.45 * walk + 0.9 * run;
    legs[0].rotation.x = Math.sin(ph) * amp + (p.frontDig || 0) * Math.sin(ph * 3.0) * 1.0 - (p.frontDig || 0) * 0.6;
    legs[1].rotation.x = Math.sin(ph + Math.PI) * amp + (p.frontDig || 0) * Math.sin(ph * 3.0 + Math.PI) * 1.0 - (p.frontDig || 0) * 0.6;
    legs[2].rotation.x = Math.sin(ph + Math.PI * (run ? 0.3 : 1)) * amp;
    legs[3].rotation.x = Math.sin(ph + Math.PI * (run ? 1.3 : 0)) * amp;
    tail.rotation.z = Math.sin((p.t || 0) * (p.wagSpeed || 14)) * (p.wag ?? 0.5);
    tail.rotation.x = -0.4;
    for (const [i, e] of ears.entries()) e.rotation.z = (i ? -1 : 1) * (0.15 + (p.earFlop || 0) * 0.4 + Math.sin(ph) * 0.15 * run);
    tongue.visible = (p.tongue ?? 1) > 0.5;
    const sq = p.squash || 0; root.scale.set(1 + sq * 0.4, 1 - sq, 1 + sq * 0.4);
  };
  return dog;
}
