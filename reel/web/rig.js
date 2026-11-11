// Low-poly 3D cut-out characters (mannequin style) with FK/IK, face rig, shock hair, x-ray.
import * as THREE from './three.module.js';
import { mat, mesh, box, cyl, ico, cone, taperBox, at, group, facet } from './lowpoly.js';
import { clamp, lerp, spring, smooth, seg, hash } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), DOWN = V(0, -1, 0), FWD = V(0, 0, 1);

export const STYLES = {
  you: { skin: '#f0bf96', hair: '#4a2a18', hairStyle: 'messy', beard: null, shirt: '#8cc4ec', tie: '#1d2a5c',
    pants: '#7a818c', shoes: '#2a2930', belt: '#3a2f2a', hipH: 1.02, hipW: 0.34, thigh: 0.44, legR: 0.074,
    shin: 0.42, torsoH: 0.55, waist: 0.33, chest: 0.42, dBot: 0.21, dTop: 0.23, neck: 0.09, R: 0.152,
    ua: 0.29, armR: 0.052, fa: 0.27, hand: 1.0, eyeR: 0.033, pocket: true, seed: 1 },
  boss: { skin: '#dfa77e', hair: '#141418', hair2: '#a3a6ae', hairStyle: 'sidepart', beard: '#232126', shirt: '#f6f6f3',
    tie: '#d42a3c', pants: '#262a34', shoes: '#141417', belt: '#101012', hipH: 1.08, hipW: 0.38, thigh: 0.47,
    legR: 0.084, shin: 0.45, torsoH: 0.62, waist: 0.39, chest: 0.54, dBot: 0.25, dTop: 0.28, neck: 0.1, R: 0.158,
    ua: 0.31, armR: 0.062, fa: 0.29, hand: 1.12, eyeR: 0.028, pocket: false, seed: 2 },
  cw1: { skin: '#c88a60', hair: '#26170f', hairStyle: 'bun', beard: null, shirt: '#33b3a6', tie: null, pants: '#3c3f52',
    shoes: '#222', belt: '#2a2a2a', hipH: 1.0, hipW: 0.34, thigh: 0.43, legR: 0.07, shin: 0.41, torsoH: 0.52,
    waist: 0.3, chest: 0.38, dBot: 0.2, dTop: 0.21, neck: 0.09, R: 0.148, ua: 0.28, armR: 0.048, fa: 0.26, hand: 0.95,
    eyeR: 0.03, glasses: true, seed: 3 },
  cw2: { skin: '#f0c7a6', hair: '#c46a2c', hairStyle: 'curly', beard: null, shirt: '#f0b445', tie: '#33589c',
    pants: '#45475a', shoes: '#222', belt: '#2a2a2a', hipH: 1.04, hipW: 0.37, thigh: 0.45, legR: 0.078, shin: 0.43,
    torsoH: 0.57, waist: 0.38, chest: 0.44, dBot: 0.24, dTop: 0.24, neck: 0.09, R: 0.155, ua: 0.29, armR: 0.055,
    fa: 0.27, hand: 1.0, eyeR: 0.029, seed: 4 },
  kid1: { skin: '#f0bf96', hair: '#4a2a18', hairStyle: 'tuft', beard: null, shirt: '#8cc4ec', tie: '#1d2a5c',
    pants: '#7a818c', shoes: '#2a2930', belt: '#3a2f2a', hipH: 0.43, hipW: 0.2, thigh: 0.16, legR: 0.045, shin: 0.15,
    torsoH: 0.24, waist: 0.21, chest: 0.23, dBot: 0.15, dTop: 0.15, neck: 0.03, R: 0.125, ua: 0.12, armR: 0.032,
    fa: 0.11, hand: 0.62, eyeR: 0.03, kid: true, seed: 5 },
  kid2: { skin: '#e5ae86', hair: '#141418', hairStyle: 'kidpart', beard: null, shirt: '#f6f6f3', tie: '#d42a3c',
    pants: '#262a34', shoes: '#141417', belt: '#101012', hipH: 0.42, hipW: 0.2, thigh: 0.155, legR: 0.045,
    shin: 0.145, torsoH: 0.23, waist: 0.21, chest: 0.23, dBot: 0.15, dTop: 0.15, neck: 0.03, R: 0.122, ua: 0.115,
    armR: 0.032, fa: 0.105, hand: 0.6, eyeR: 0.03, kid: true, seed: 6 },
  kid3: { skin: '#ebb992', hair: '#3a2416', hairStyle: 'pigtails', beard: null, shirt: '#f4c64a', tie: '#24998b',
    pants: '#5b6889', shoes: '#2a2930', belt: '#3a2f2a', hipH: 0.41, hipW: 0.19, thigh: 0.15, legR: 0.043,
    shin: 0.14, torsoH: 0.22, waist: 0.2, chest: 0.22, dBot: 0.14, dTop: 0.14, neck: 0.03, R: 0.12, ua: 0.11,
    armR: 0.03, fa: 0.1, hand: 0.58, eyeR: 0.031, kid: true, seed: 7 },
};

function shapeHeadGeo(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = y < 0 ? 1 - 0.16 * Math.pow(-y / R, 1.3) : 1;
    p.setXYZ(i, x * k, y * 1.12, z * k);
  }
  return g;
}
// point on shaped head surface for direction (yaw, pitch)
function surf(R, yaw, pitch, out = 0) {
  let x = Math.sin(yaw) * Math.cos(pitch) * R, y = Math.sin(pitch) * R, z = Math.cos(yaw) * Math.cos(pitch) * R;
  const k = y < 0 ? 1 - 0.16 * Math.pow(-y / R, 1.3) : 1;
  const P = V(x * k, y * 1.12, z * k);
  const n = V(x * k, y / 1.12, z * k).normalize();
  return { p: P.addScaledVector(n, out), n };
}
function place(obj, R, yaw, pitch, out = 0.004) {
  const { p, n } = surf(R, yaw, pitch, out);
  obj.position.copy(p);
  obj.quaternion.setFromUnitVectors(FWD, n);
  return obj;
}
function hangGeo(wTop, wBot, h, d) { // box hanging down from y=0
  const g = new THREE.BoxGeometry(1, h, d, 1, 1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); const u = (y + h / 2) / h; p.setX(i, p.getX(i) * lerp(wBot, wTop, u)); }
  g.translate(0, -h / 2, 0); return g;
}

const XRAY = new THREE.MeshBasicMaterial({ color: new THREE.Color('#4fc3ff'), transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
const BONE = new THREE.MeshBasicMaterial({ color: new THREE.Color('#f4fbff'), toneMapped: false });

export class Char {
  constructor(kind) {
    this.kind = kind;
    const S = this.S = STYLES[kind];
    const R = S.R;
    this.root = new THREE.Group(); this.root.name = kind;
    this.hips = new THREE.Group(); this.root.add(this.hips);
    this.bones = [];
    const bone = (m) => { m.userData.bone = true; m.visible = false; m.castShadow = false; this.bones.push(m); return m; };
    // pelvis + belt
    const pel = taperBox(S.waist * 0.98, S.waist, 0.2, S.dBot * 0.95, S.dBot, S.pants); pel.position.y = -0.14; this.hips.add(pel);
    const belt = box(S.waist * 1.02, 0.035, S.dBot * 1.04, S.belt); belt.position.y = 0.045; this.hips.add(belt);
    const buckle = box(0.04, 0.03, 0.01, '#cfa93e', { metal: 0.6, rough: 0.35 }); buckle.position.set(0, 0.045, S.dBot * 0.53); this.hips.add(buckle);
    this.hips.add(bone(at(box(S.waist * 0.6, 0.08, 0.06, '#fff', { material: BONE }), 0, -0.06, 0)));
    // legs
    this.hip = {}; this.knee = {}; this.ankle = {};
    for (const [side, sx] of [['L', -1], ['R', 1]]) {
      const hj = new THREE.Group(); hj.position.set(sx * S.hipW * 0.26, -0.08, 0); this.hips.add(hj);
      const th = cyl(S.legR, S.legR * 0.88, S.thigh, 6, S.pants); th.position.y = -S.thigh / 2; hj.add(th);
      hj.add(bone(at(cyl(S.legR * 0.3, S.legR * 0.3, S.thigh, 5, '#fff', { material: BONE }), 0, -S.thigh / 2, 0)));
      const kn = new THREE.Group(); kn.position.y = -S.thigh; hj.add(kn);
      kn.add(ico(S.legR * 0.92, 0, S.pants));
      const sh = cyl(S.legR * 0.85, S.legR * 0.72, S.shin, 6, S.pants); sh.position.y = -S.shin / 2; kn.add(sh);
      kn.add(bone(at(cyl(S.legR * 0.28, S.legR * 0.28, S.shin, 5, '#fff', { material: BONE }), 0, -S.shin / 2, 0)));
      const an = new THREE.Group(); an.position.y = -S.shin; kn.add(an);
      const sz = S.kid ? 0.55 : 1;
      const shoe = box(0.105 * sz, 0.075 * sz, 0.25 * sz, S.shoes, { rough: 0.5 }); shoe.position.set(0, -0.03 * sz, 0.05 * sz); an.add(shoe);
      const sole = box(0.108 * sz, 0.018 * sz, 0.255 * sz, '#d9d4cc'); sole.position.set(0, -0.07 * sz, 0.05 * sz); an.add(sole);
      this.hip[side] = hj; this.knee[side] = kn; this.ankle[side] = an;
    }
    // spine / torso
    this.spine = new THREE.Group(); this.spine.position.y = 0.06; this.hips.add(this.spine);
    const torso = taperBox(S.waist, S.chest, S.torsoH, S.dBot, S.dTop, S.shirt); this.spine.add(torso);
    this.torso = torso;
    this.spine.add(bone(at(box(0.035, S.torsoH, 0.035, '#fff', { material: BONE }), 0, S.torsoH / 2, -0.02)));
    for (let k = 0; k < 4; k++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(S.chest * 0.36, 0.009, 3, 10, Math.PI * 1.15), BONE);
      rib.rotation.set(Math.PI / 2, 0, Math.PI * 0.92); rib.position.set(0, S.torsoH * (0.45 + k * 0.13), 0.0); this.spine.add(bone(rib));
    }
    this.chest = new THREE.Group(); this.chest.position.y = S.torsoH; this.spine.add(this.chest);
    // collar
    for (const sx of [-1, 1]) {
      const cl = box(0.07, 0.022, 0.06, S.tie ? '#ffffff' : S.shirt); cl.position.set(sx * 0.045, -0.005, S.dTop * 0.42); cl.rotation.set(0.3, 0, sx * 0.55); this.chest.add(cl);
    }
    if (S.pocket) { const pk = box(0.07, 0.075, 0.01, S.shirt, { jit: 0.08 }); pk.position.set(-S.chest * 0.25, -0.16, S.dTop * 0.5 + 0.004); this.chest.add(pk); }
    // tie
    this.tie = null;
    if (S.tie) {
      const kidk = S.kid ? 0.6 : 1;
      const knot = box(0.034 * kidk, 0.03 * kidk, 0.02, S.tie); knot.position.set(0, -0.035 * kidk, S.dTop * 0.5 + 0.01); this.chest.add(knot);
      this.tie = new THREE.Group(); this.tie.position.set(0, -0.05 * kidk, S.dTop * 0.5 + 0.012); this.chest.add(this.tie);
      this.tieLen = S.torsoH * 0.55;
      const b1 = mesh(hangGeo(0.034 * kidk, 0.06 * kidk, this.tieLen * 0.78, 0.012), S.tie, { jit: 0.05 }); this.tie.add(b1);
      this.tie2 = new THREE.Group(); this.tie2.position.y = -this.tieLen * 0.78; this.tie.add(this.tie2);
      const b2 = mesh(hangGeo(0.06 * kidk, 0.0, this.tieLen * 0.22, 0.012), S.tie, { jit: 0.05 }); this.tie2.add(b2);
    }
    // neck & head
    this.neck = new THREE.Group(); this.neck.position.y = -0.01; this.chest.add(this.neck);
    const nk = cyl(R * 0.33, R * 0.36, S.neck + 0.04, 6, S.skin); nk.position.y = (S.neck + 0.04) / 2 - 0.02; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = S.neck + R * 0.95; this.neck.add(this.head);
    this.buildHead();
    // arms
    this.sh = {}; this.el = {}; this.wr = {}; this.hands = {};
    for (const [side, sx] of [['L', -1], ['R', 1]]) {
      const sj = new THREE.Group(); sj.position.set(sx * (S.chest / 2 - S.armR * 0.6), -0.06, 0); this.chest.add(sj);
      sj.add(ico(S.armR * 1.15, 0, S.shirt));
      const ua = cyl(S.armR, S.armR * 0.9, S.ua, 6, S.shirt); ua.position.y = -S.ua / 2; sj.add(ua);
      sj.add(bone(at(cyl(S.armR * 0.25, S.armR * 0.25, S.ua, 5, '#fff', { material: BONE }), 0, -S.ua / 2, 0)));
      const ej = new THREE.Group(); ej.position.y = -S.ua; sj.add(ej);
      ej.add(ico(S.armR * 0.95, 0, S.shirt));
      const fa = cyl(S.armR * 0.9, S.armR * 0.78, S.fa, 6, S.shirt); fa.position.y = -S.fa / 2; ej.add(fa);
      const cuff = cyl(S.armR * 0.85, S.armR * 0.85, 0.035, 6, S.tie ? '#ffffff' : S.shirt); cuff.position.y = -S.fa + 0.02; ej.add(cuff);
      ej.add(bone(at(cyl(S.armR * 0.22, S.armR * 0.22, S.fa, 5, '#fff', { material: BONE }), 0, -S.fa / 2, 0)));
      const wj = new THREE.Group(); wj.position.y = -S.fa; ej.add(wj);
      const hs = S.hand;
      const mit = group(at(box(0.07 * hs, 0.095 * hs, 0.032 * hs, S.skin), 0, -0.05 * hs, 0),
        at(box(0.024 * hs, 0.05 * hs, 0.024 * hs, S.skin), -sx * 0.042 * hs, -0.035 * hs, 0.012 * hs, 0, 0, -sx * 0.5));
      const fist = group(at(box(0.07 * hs, 0.07 * hs, 0.062 * hs, S.skin), 0, -0.04 * hs, 0.01 * hs),
        at(box(0.022 * hs, 0.04 * hs, 0.022 * hs, S.skin), -sx * 0.04 * hs, -0.035 * hs, 0.03 * hs, 0, 0, -sx * 0.3));
      const point = group(at(box(0.07 * hs, 0.065 * hs, 0.06 * hs, S.skin), 0, -0.04 * hs, 0.01 * hs),
        at(box(0.02 * hs, 0.08 * hs, 0.02 * hs, S.skin), sx * 0.02 * hs, -0.105 * hs, 0.02 * hs));
      const hb = bone(new THREE.Group()); hb.visible = false;
      for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.08 * hs, 0.008), BONE); f.position.set((k - 1.5) * 0.016 * hs, -0.06 * hs, 0); hb.add(f); }
      wj.add(mit, fist, point, hb); fist.visible = false; point.visible = false;
      this.hands[side] = { mitten: mit, fist, point };
      this.sh[side] = sj; this.el[side] = ej; this.wr[side] = wj;
    }
    this.handLen = 0.1 * S.hand;
    this.root.traverse(o => { if (o.isMesh) o.userData.orig = o.material; });
    this.xray = false;
  }

  buildHead() {
    const S = this.S, R = S.R, h = this.head;
    const skull = mesh(shapeHeadGeo(new THREE.IcosahedronGeometry(R, 1), R), S.skin, { jit: 0.025 });
    h.add(skull); this.skull = skull;
    // ears
    for (const sx of [-1, 1]) { const e = ico(R * 0.24, 0, S.skin); e.scale.set(0.5, 1, 0.75); place(e, R, sx * 1.5, 0.0, -0.01); h.add(e); }
    // nose
    const nose = box(R * 0.15, R * 0.24, R * 0.18, S.skin, { jit: 0.06 }); place(nose, R, 0, -0.12, R * 0.05); h.add(nose);
    this.nose = nose;
    // beard
    if (S.beard) {
      const bg = shapeHeadGeo(new THREE.SphereGeometry(R * 1.035, 10, 4, Math.PI / 2 - 1.7, 3.4, Math.PI * 0.54, Math.PI * 0.38), R * 1.035);
      const bd = mesh(bg, S.beard, { jit: 0.08 }); h.add(bd);
      const patch = mesh(new THREE.CylinderGeometry(1, 1, 0.006, 10), S.skin, { jit: 0.02 });
      patch.geometry.rotateX(Math.PI / 2); patch.scale.set(R * 0.34, R * 0.16, 1); place(patch, R * 1.04, 0, -0.42, 0.002); h.add(patch);
      const st = box(R * 0.62, R * 0.1, R * 0.08, S.beard, { jit: 0.08 }); place(st, R * 1.04, 0, -0.27, 0.006); h.add(st);
      this.stache = st;
    }
    const mouthR = S.beard ? R * 1.045 : R;
    // eyes
    this.eyes = [];
    const er = S.eyeR;
    for (const sx of [-1, 1]) {
      const eg = new THREE.Group(); place(eg, R, sx * 0.36, 0.1, 0.002); h.add(eg);
      const inner = new THREE.Group(); eg.add(inner);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(er, er, 0.008, 12).rotateX(Math.PI / 2), mat('#111116', { rough: 0.25, vc: false, flat: true }));
      inner.add(disc);
      const hl = new THREE.Mesh(new THREE.CircleGeometry(er * 0.32, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      hl.position.set(-er * 0.32, er * 0.36, 0.0045); inner.add(hl);
      const hl2 = new THREE.Mesh(new THREE.CircleGeometry(er * 0.14, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      hl2.position.set(er * 0.34, -er * 0.3, 0.0045); inner.add(hl2);
      const closed = new THREE.Mesh(new THREE.TorusGeometry(er * 0.8, er * 0.16, 3, 8, Math.PI), mat('#111116', { vc: false }));
      closed.rotation.z = Math.PI; closed.position.y = er * 0.25; closed.visible = false; eg.add(closed);
      const happy = new THREE.Mesh(new THREE.TorusGeometry(er * 0.8, er * 0.2, 3, 8, Math.PI), mat('#111116', { vc: false }));
      happy.position.y = -er * 0.3; happy.visible = false; eg.add(happy);
      const stS = new THREE.Shape(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? er * 0.13 : er * 0.5, an = k * Math.PI / 4; k ? stS.lineTo(Math.sin(an) * rr, Math.cos(an) * rr) : stS.moveTo(Math.sin(an) * rr, Math.cos(an) * rr); }
      const star = new THREE.Mesh(new THREE.ShapeGeometry(stS), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      star.position.set(er * 0.3, -er * 0.1, 0.005); star.visible = false; inner.add(star);
      eg.userData = { sx, inner, closed, happy, star };
      this.eyes.push(eg);
    }
    // brows
    this.brows = [];
    for (const sx of [-1, 1]) {
      const b = box(R * 0.5, R * 0.11, R * 0.1, S.kid ? S.hair : '#141416', { jit: 0.02 });
      const g = new THREE.Group(); g.add(b); h.add(g); g.userData.sx = sx; this.brows.push(g);
    }
    // mouth
    this.mouthG = new THREE.Group(); place(this.mouthG, mouthR, 0, -0.4, 0.004); h.add(this.mouthG);
    const mOpen = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.006, 12).rotateX(Math.PI / 2), mat('#2a0d12', { vc: false }));
    const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.55, 8), mat('#e2636f', { vc: false }));
    tongue.position.set(0, -0.45, 0.0035);
    const teeth = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.35), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    teeth.position.set(0, 0.62, 0.0036);
    const mo = new THREE.Group(); mo.add(mOpen, tongue, teeth); this.mouthG.add(mo);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(R * 0.2, R * 0.035, 3, 8, Math.PI), mat('#2a0d12', { vc: false }));
    const line = new THREE.Mesh(new THREE.BoxGeometry(R * 0.36, R * 0.05, 0.006), mat('#2a0d12', { vc: false }));
    const grit = new THREE.Group();
    const gw = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.5, R * 0.17), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    const gb = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.56, R * 0.23), new THREE.MeshBasicMaterial({ color: '#2a0d12' }));
    gb.position.z = -0.0005; gw.position.z = 0.001;
    grit.add(gb, gw);
    for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.0022, R * 0.17), new THREE.MeshBasicMaterial({ color: '#555' })); l.position.set((k - 1.5) * R * 0.11, 0, 0.0015); grit.add(l); }
    const ll = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.5, 0.0022), new THREE.MeshBasicMaterial({ color: '#555' })); ll.position.z = 0.0015; grit.add(ll);
    this.mouthG.add(arc, line, grit);
    this.mouth = { mo, mOpen, tongue, teeth, arc, line, grit };
    // blush
    this.blush = [];
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(R * 0.2, 8), new THREE.MeshBasicMaterial({ color: '#ff4f9a', transparent: true, opacity: 0, depthWrite: false }));
      b.scale.set(1.3, 0.8, 1); place(b, R, sx * 0.56, -0.2, 0.006); h.add(b); this.blush.push(b);
    }
    // soot
    this.soot = [];
    for (const [yw, pt, s] of [[-0.5, -0.05, 0.22], [0.42, 0.3, 0.18], [0.15, -0.55, 0.15], [-0.25, 0.5, 0.15]]) {
      const b = new THREE.Mesh(new THREE.CircleGeometry(R * s, 6), new THREE.MeshBasicMaterial({ color: '#3a3438', transparent: true, opacity: 0, depthWrite: false }));
      place(b, R, yw, pt, 0.003); h.add(b); this.soot.push(b);
    }
    // sweat drops
    this.sweat = [];
    for (let k = 0; k < 3; k++) {
      const d = ico(R * 0.08, 0, '#9fe6ff', { emissive: '#5fb7d6', ei: 0.5, transparent: true, opacity: 0.9, unique: true, cast: false });
      d.scale.set(0.8, 1.25, 0.6); d.visible = false; h.add(d); this.sweat.push(d);
    }
    // hair
    this.hairN = new THREE.Group(); h.add(this.hairN);
    this.buildHair(S.hairStyle, this.hairN);
    this.hairS = new THREE.Group(); this.hairS.position.y = R * 0.7; h.add(this.hairS); this.hairS.visible = false;
    this.buildShock(this.hairS);
    if (S.glasses) {
      for (const sx of [-1, 1]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(S.eyeR * 1.6, 0.0045, 3, 8), mat('#202028', { vc: false }));
        place(ring, R, sx * 0.36, 0.1, 0.012); h.add(ring);
      }
      const br = box(0.035, 0.006, 0.006, '#202028'); place(br, R, 0, 0.12, 0.018); h.add(br);
    }
    // skull bones for x-ray
    const sk = ico(R * 0.86, 1, '#fff', { material: BONE }); sk.userData.bone = true; sk.visible = false; sk.scale.set(1, 1.08, 1); sk.position.y = R * 0.08; h.add(sk); this.bones.push(sk);
    for (const sx of [-1, 1]) {
      const so = new THREE.Mesh(new THREE.CircleGeometry(R * 0.2, 7), new THREE.MeshBasicMaterial({ color: '#0b2342' }));
      place(so, R * 0.9, sx * 0.34, 0.1, 0.06); so.userData.bone = true; so.visible = false; h.add(so); this.bones.push(so);
    }
    const jaw = box(R * 0.9, R * 0.35, R * 0.7, '#fff', { material: BONE }); jaw.position.set(0, -R * 0.62, R * 0.2); jaw.userData.bone = true; jaw.visible = false; h.add(jaw); this.bones.push(jaw);
  }

  buildHair(style, g) {
    const S = this.S, R = S.R, hc = S.hair;
    const cap = (rf = 1.08, th = 0.42, tilt = -0.32, color = hc, seg = 10) => {
      rf += 0.05;
      const m = mesh(shapeHeadGeo(new THREE.SphereGeometry(R * rf, seg, 4, 0, Math.PI * 2, 0, Math.PI * th), R * rf), color, { jit: 0.08 });
      m.rotation.x = tilt; g.add(m); return m;
    };
    const spike = (yaw, pitch, len, r, bias = [0, 0.6, 0], color = hc) => {
      const { p, n } = surf(R * 1.04, yaw, pitch, 0);
      const d = n.clone().add(V(...bias)).normalize();
      const c = cone(r, len, 4, color, { jit: 0.1 }); c.quaternion.setFromUnitVectors(UP, d);
      c.position.copy(p).addScaledVector(d, len * 0.38); g.add(c); return c;
    };
    if (style === 'messy') {
      cap(1.08, 0.44, -0.3);
      const sp = [[-0.9, 0.55, 0.1], [-0.4, 0.95, 0.12], [0.1, 1.05, 0.13], [0.6, 0.9, 0.12], [1.0, 0.55, 0.1], [2.5, 0.6, 0.1], [3.1, 0.8, 0.11], [-2.4, 0.7, 0.1], [0, 1.4, 0.11]];
      sp.forEach(([y, p, l], i) => spike(y, p, l, R * 0.2, [0, 0.5, 0]));
      [[-0.45, 0.62], [-0.15, 0.68], [0.15, 0.66], [0.42, 0.6]].forEach(([y, p]) => spike(y, p, 0.075, R * 0.18, [0, -0.9, 0.3]));
    } else if (style === 'sidepart') {
      cap(1.07, 0.4, -0.3);
      const sw = ico(R * 0.55, 0, hc, { jit: 0.06 }); sw.scale.set(1.6, 0.42, 1.25); sw.position.set(R * 0.18, R * 0.95, R * 0.32); sw.rotation.z = -0.15; g.add(sw);
      const part = box(R * 0.05, R * 0.04, R * 0.9, '#3a3a42'); part.position.set(-R * 0.36, R * 1.07, R * 0.05); part.rotation.z = 0.35; g.add(part);
      for (const ph of [0, Math.PI]) {
        const m = mesh(shapeHeadGeo(new THREE.SphereGeometry(R * 1.14, 4, 2, ph - 0.62, 1.24, Math.PI * 0.27, Math.PI * 0.2), R * 1.085), S.hair2, { jit: 0.06 });
        m.rotation.x = -0.3; g.add(m);
      }
    } else if (style === 'bun') {
      cap(1.07, 0.47, -0.25);
      const bun = ico(R * 0.42, 1, hc); bun.position.set(0, R * 1.05, -R * 0.45); g.add(bun);
    } else if (style === 'curly') {
      cap(1.08, 0.46, -0.3);
      for (let k = 0; k < 11; k++) { const yaw = -2.6 + k * 0.52; const pt = 0.5 + 0.35 * Math.sin(k * 1.7); const { p } = surf(R * 1.05, yaw, pt, 0); const b = ico(R * 0.25, 0, hc, { jit: 0.1 }); b.position.copy(p); g.add(b); }
    } else if (style === 'tuft') {
      cap(1.07, 0.38, -0.3);
      spike(0.0, 1.3, 0.09, R * 0.2, [0, 1, 0.2]); spike(0.3, 1.1, 0.07, R * 0.17, [0.2, 1, 0.2]);
    } else if (style === 'kidpart') {
      cap(1.07, 0.4, -0.32);
      const sw = ico(R * 0.5, 0, hc); sw.scale.set(1.6, 0.42, 1.2); sw.position.set(R * 0.15, R * 0.95, R * 0.3); g.add(sw);
    } else if (style === 'pigtails') {
      cap(1.07, 0.42, -0.3);
      for (const sx of [-1, 1]) { const b = ico(R * 0.32, 0, hc); b.scale.set(0.8, 1.3, 0.8); b.position.set(sx * R * 1.15, R * 0.15, -R * 0.2); b.rotation.z = sx * 0.4; g.add(b); }
    }
  }
  buildShock(g) {
    const S = this.S, R = S.R;
    const cap = mesh(shapeHeadGeo(new THREE.SphereGeometry(R * 1.13, 10, 4, 0, Math.PI * 2, 0, Math.PI * 0.42), R * 1.13), S.hair, { jit: 0.08 });
    cap.rotation.x = -0.3; cap.position.y = -R * 0.7; g.add(cap);
    const n = 15;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + 0.3, tilt = 0.25 + 0.5 * hash(S.seed, k);
      const d = V(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt)).normalize();
      const len = (S.kid ? 0.6 : 1) * (0.2 + 0.1 * hash(S.seed, k, 2));
      const col = (S.hair2 && Math.abs(Math.sin(a)) > 0.75) ? S.hair2 : S.hair;
      const c = cone(R * 0.2, len, 4, col, { jit: 0.1 }); c.quaternion.setFromUnitVectors(UP, d);
      c.position.set(d.x * R * 0.55, d.y * R * 0.3 - R * 0.05, d.z * R * 0.55).addScaledVector(d, len * 0.42); g.add(c);
    }
    const c0 = cone(R * 0.24, (S.kid ? 0.6 : 1) * 0.3, 4, S.hair, { jit: 0.1 }); c0.position.y = 0.13; g.add(c0);
  }

  setXray(on) {
    if (on === this.xray) return; this.xray = on;
    this.root.traverse(o => {
      if (!o.isMesh) return;
      if (o.userData.bone) { o.visible = on; return; }
      if (!o.userData.orig) o.userData.orig = o.material;
      o.material = on ? XRAY : o.userData.orig;
      o.castShadow = !on && o.userData.cast !== false;
    });
  }

  aim(obj, worldDir) {
    const pq = new THREE.Quaternion(); obj.parent.getWorldQuaternion(pq);
    const ld = worldDir.clone().normalize().applyQuaternion(pq.invert());
    obj.quaternion.setFromUnitVectors(DOWN, ld);
  }
  ik(side, target, pole) {
    this.root.updateMatrixWorld(true);
    const sj = this.sh[side], ej = this.el[side];
    const s = this.root.scale.x;
    const Sp = sj.getWorldPosition(V(0, 0, 0));
    const L1 = this.S.ua * s, L2 = (this.S.fa + this.handLen * 0.55) * s;
    const T = V(...target);
    let d = T.distanceTo(Sp);
    const dir = T.clone().sub(Sp).normalize();
    d = clamp(d, Math.abs(L1 - L2) + 1e-3, (L1 + L2) * 0.998);
    let pv = V(...pole).sub(Sp); pv.addScaledVector(dir, -pv.dot(dir)); if (pv.length() < 1e-5) pv = V(0, -1, 0); pv.normalize();
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const E = Sp.clone().addScaledVector(dir, a).addScaledVector(pv, h);
    this.aim(sj, E.clone().sub(Sp));
    sj.updateMatrixWorld(true);
    const Tc = Sp.clone().addScaledVector(dir, d);
    this.aim(ej, Tc.sub(E));
    ej.updateMatrixWorld(true);
  }

  // p: pose description
  apply(p, t) {
    const S = this.S, R = S.R;
    const r = this.root;
    r.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
    r.rotation.set(0, p.ry ?? 0, 0);
    r.scale.setScalar(p.s ?? 1);
    r.visible = p.visible ?? true;
    this.setXray(!!p.xray);
    this.hips.position.set(p.hx ?? 0, p.hipY ?? S.hipH, p.hz ?? 0);
    const hr = p.hipR ?? [0, 0, 0];
    this.hips.rotation.set(hr[0], hr[1], hr[2]);
    const br = Math.sin(2 * Math.PI * t / (p.bper ?? 3.0) + S.seed * 1.7) * (p.breathe ?? 1);
    const sp = p.spine ?? [0, 0, 0];
    this.spine.rotation.set(sp[0] - 0.012 * br, sp[1], sp[2]);
    this.chest.scale.set(1 + 0.012 * br, 1, 1 + 0.02 * br);
    const nk = p.neck ?? [0, 0, 0]; this.neck.rotation.set(nk[0], nk[1], nk[2]);
    const hd = p.head ?? [0, 0, 0]; this.head.rotation.set(hd[0], hd[1], hd[2]);
    const hsq = p.squash ?? 1; this.head.scale.set(1 / Math.sqrt(hsq), hsq, 1 / Math.sqrt(hsq));
    // legs
    for (const side of ['L', 'R']) {
      const l = p['leg' + side] ?? [0, 0, 0, 0];
      this.hip[side].rotation.set(l[0], l[1], l[2]);
      this.knee[side].rotation.set(l[3] ?? 0, 0, 0);
      const a = p['ankle' + side] ?? [0, 0, 0];
      this.ankle[side].rotation.set(a[0], a[1], a[2]);
    }
    // arms (angles first)
    for (const side of ['L', 'R']) {
      const a = p['arm' + side] ?? { sh: [0, 0, side === 'L' ? -0.12 : 0.12], el: -0.15 };
      if (!a.ik) {
        const s = a.sh ?? [0, 0, 0];
        this.sh[side].rotation.set(s[0], s[1], s[2]);
        this.el[side].rotation.set(a.el ?? 0, a.elY ?? 0, a.elZ ?? 0);
      }
      const w = a.wr ?? [0, 0, 0]; this.wr[side].rotation.set(w[0], w[1], w[2]);
      const hk = a.hand ?? 'mitten';
      for (const k of ['mitten', 'fist', 'point']) this.hands[side][k].visible = (k === hk) && !p.xray;
      if (this.wr[side].children[3]) this.wr[side].children[3].visible = !!p.xray;
    }
    for (const side of ['L', 'R']) {
      const a = p['arm' + side];
      if (a && a.ik) { this.ik(side, a.ik, a.pole ?? [0, -2, 0]); const w = a.wr ?? [0, 0, 0]; this.wr[side].rotation.set(w[0], w[1], w[2]); }
    }
    // tie
    if (this.tie) {
      this.root.updateMatrixWorld(true);
      if (p.tieTo) {
        const tp = this.tie.getWorldPosition(V(0, 0, 0));
        const T = V(...p.tieTo);
        this.aim(this.tie, T.clone().sub(tp));
        const d = T.distanceTo(tp) / r.scale.x;
        this.tie.scale.set(1, Math.max(1, d / (this.tieLen * 0.92)), 1);
        this.tie2.rotation.set(0, 0, 0);
      } else if (p.tieHang) {
        const swing = p.tieSwing ?? 0;
        this.aim(this.tie, V(Math.sin(swing) * 0.3, -1, Math.cos(swing) * 0.05 + 0.02));
        this.tie.scale.set(1, 1, 1);
        this.tie2.rotation.set(0, 0, p.tieSwing2 ?? 0);
      } else {
        const ta = p.tie ?? [0, 0, 0];
        this.tie.quaternion.identity(); this.tie.rotation.set(ta[0] - 0.08, ta[1], ta[2]);
        this.tie.scale.set(1, 1, 1);
        this.tie2.rotation.set(ta[3] ?? 0, 0, ta[4] ?? 0);
      }
    }
    this.face(p.face ?? {}, t);
  }

  face(f, t) {
    const S = this.S, R = S.R;
    const lid = clamp(Math.max(f.lid ?? 0, f.blink ?? 0));
    const es = f.eyeS ?? 1;
    const look = f.look ?? [0, 0];
    for (const eg of this.eyes) {
      const { sx, inner, closed, happy, star } = eg.userData;
      place(eg, R, sx * 0.36 + look[0] * 0.12, 0.1 + look[1] * 0.08, 0.002);
      eg.scale.setScalar(es);
      const hap = (f.happy ?? 0) > 0.5;
      const cl = !hap && lid > 0.9;
      inner.visible = !hap && !cl; closed.visible = cl; happy.visible = hap;
      inner.scale.set(1, Math.max(0.08, 1 - lid), 1);
      inner.position.y = -lid * S.eyeR * 0.5;
      star.visible = (f.dreamy ?? 0) > 0.3;
    }
    const raise = f.brow ?? 0, ang = f.browA ?? 0;
    for (const b of this.brows) {
      const sx = b.userData.sx;
      place(b, R, sx * 0.36 + look[0] * 0.08, 0.38 + raise * 0.09 + (es - 1) * 0.2, 0.012);
      b.rotateZ(sx * ang);
    }
    // mouth
    const o = clamp(f.mouth ?? 0), sm = f.smile ?? 0.25, mw = f.mw ?? 1;
    const m = this.mouth;
    const grit = (f.grit ?? 0) > 0.5;
    m.grit.visible = grit;
    m.mo.visible = !grit && o > 0.06;
    m.arc.visible = !grit && o <= 0.06 && Math.abs(sm) > 0.12;
    m.line.visible = !grit && o <= 0.06 && Math.abs(sm) <= 0.12;
    m.mo.scale.set(R * 0.24 * mw * (1 - 0.15 * o), R * 0.32 * o + 0.004, 1);
    m.mo.position.y = -R * 0.08 * o;
    m.teeth.visible = !!f.teeth;
    m.arc.rotation.z = sm > 0 ? Math.PI : 0;
    m.arc.scale.set(mw, Math.abs(sm) * 1.3, 1);
    m.arc.position.y = sm > 0 ? R * 0.05 : -R * 0.08;
    if (this.stache) this.stache.position.y = surf(R * 1.04, 0, -0.27, 0.006).p.y + o * R * 0.03;
    for (const b of this.blush) b.material.opacity = 0.8 * clamp(f.blush ?? 0);
    for (const b of this.soot) b.material.opacity = 0.6 * clamp(f.soot ?? 0);
    const sw = f.sweat ?? 0;
    this.sweat.forEach((d, k) => {
      d.visible = sw > 0.01;
      if (!d.visible) return;
      const per = 1.3 + 0.4 * k, u = ((t + k * 0.47) % per) / per;
      const yaw = [-0.62, 0.55, 0.2][k];
      const { p } = surf(R, yaw, lerp(0.55, -0.25, u), 0.006);
      d.position.copy(p);
      d.material.opacity = 0.9 * sw * Math.sin(Math.PI * clamp(u * 1.1));
    });
    // hair
    const shock = (f.shock ?? 0) > 0.5;
    this.hairN.visible = !shock; this.hairS.visible = shock;
    if (shock) {
      const st = f.shockT ?? 10;
      const sy = st < 10 ? lerp(0.15, 1, spring(st, 0, 2.4, 5.5)) : 1;
      const sxz = st < 10 ? lerp(1.3, 1, clamp(st / 0.3)) : 1;
      const wob = 1 + 0.03 * Math.sin(t * 11 + S.seed);
      this.hairS.scale.set(sxz, sy * wob, sxz);
    }
  }
}
