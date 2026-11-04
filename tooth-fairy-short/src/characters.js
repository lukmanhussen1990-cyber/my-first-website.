// Blocky papercraft characters on a shared poseable rig.
import * as THREE from 'three';
import { bx, cyl, at, chamferBox, extrude, starShape, sackGeo, shade } from './build.js';
import { FaceRig, MAN_SKIN } from './faces.js';
import * as T from './tex.js';
import { rng } from './util.js';

const HAND_POSES = {
  relax: [0.35, 0.3, 0.25],
  grip: [1.45, 1.35, 0.9],
  point: [1.6, 0.0, 0.85],
  open: [0.05, 0.05, 0.1],
  pinch: [1.25, 0.95, 1.05],
  fist: [1.7, 1.7, 1.1],
};

function makeHand(parent, sx, k, mat) {
  const hand = new THREE.Group();
  parent.add(hand);
  const palm = bx(0.055 * k, 0.1 * k, 0.1 * k, mat); palm.position.y = -0.05 * k; hand.add(palm);
  const fingers = new THREE.Group(); fingers.position.set(0, -0.1 * k, -0.014 * k); hand.add(fingers);
  const fm = bx(0.05 * k, 0.07 * k, 0.068 * k, mat); fm.position.y = -0.035 * k; fingers.add(fm);
  const index = new THREE.Group(); index.position.set(0, -0.1 * k, 0.034 * k); hand.add(index);
  const im = bx(0.045 * k, 0.078 * k, 0.03 * k, mat); im.position.y = -0.039 * k; index.add(im);
  const thumb = new THREE.Group(); thumb.position.set(-sx * 0.012 * k, -0.025 * k, 0.05 * k); hand.add(thumb);
  const tm = bx(0.036 * k, 0.062 * k, 0.034 * k, mat); tm.position.y = -0.031 * k; thumb.add(tm);
  const grip = new THREE.Object3D(); grip.position.set(-sx * 0.05 * k, -0.09 * k, 0.012 * k); hand.add(grip);
  return { hand, fingers, index, thumb, grip, sx };
}
function setHand(h, pose) {
  const P = typeof pose === 'string' ? HAND_POSES[pose] : pose;
  const c = -h.sx;
  h.fingers.rotation.set(0, 0, c * P[0]);
  h.index.rotation.set(0, 0, c * P[1]);
  h.thumb.rotation.set(0.35, 0, c * P[2] * 0.6);
}

class Rig {
  constructor(name) {
    this.root = new THREE.Group();
    this.root.name = name;
    this.arms = {};
    this.legs = {};
  }
  makeArm(torso, side, S) {
    const sx = side === 'R' ? -1 : 1;
    const sh = new THREE.Group(); sh.position.set(sx * S.shX, S.shY, 0); torso.add(sh);
    const up = bx(S.upW, S.upL, S.upD, S.armMat, S.armUV); up.position.y = -S.upL / 2 + 0.02; sh.add(up);
    if (S.puff) { const p = bx(S.upW * 1.6, S.upW * 1.2, S.upD * 1.6, S.puff); p.position.y = -S.upW * 0.3; sh.add(p); }
    const el = new THREE.Group(); el.position.y = -S.upL; sh.add(el);
    const fo = bx(S.foW, S.foL, S.foD, S.foMat || S.armMat, S.armUV); fo.position.y = -S.foL / 2; el.add(fo);
    if (S.cuffMat) { const cf = bx(S.foW * 1.1, 0.035, S.foD * 1.1, S.cuffMat); cf.position.y = -S.foL + 0.02; el.add(cf); }
    const wr = new THREE.Group(); wr.position.y = -S.foL; el.add(wr);
    const hand = makeHand(wr, sx, S.handK, S.handMat);
    this.arms[side] = { sh, el, wr, hand, sx };
    this.armLen = { up: S.upL, fo: S.foL + 0.09 * S.handK };
  }
  // Two-bone IK: put the hand grip on a world target, elbow bending toward
  // the world-space pole point. Wrist/hand pose optional.
  ik(side, target, pole, hand = 'grip', wrist = [0, 0, 0]) {
    const a = this.arms[side];
    this.root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(a.sh.parent.matrixWorld).invert();
    const T = target.clone().applyMatrix4(inv).sub(a.sh.position);
    const P = pole.clone().applyMatrix4(inv).sub(a.sh.position);
    const L1 = this.armLen.up, L2 = this.armLen.fo;
    const d = Math.min(Math.max(T.length(), Math.abs(L1 - L2) + 1e-3), L1 + L2 - 1e-3);
    const Tn = T.clone().normalize();
    const A = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    const n = new THREE.Vector3().crossVectors(Tn, P);
    if (n.lengthSq() < 1e-10) n.set(1, 0, 0);
    n.normalize();
    const u = Tn.clone().applyAxisAngle(n, A);
    const f = Tn.clone().multiplyScalar(d).sub(u.clone().multiplyScalar(L1)).normalize();
    const yAx = u.clone().negate();
    const zAx = f.clone().sub(u.clone().multiplyScalar(f.dot(u)));
    if (zAx.lengthSq() < 1e-10) zAx.crossVectors(n, u);
    zAx.normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx);
    a.sh.rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx), 'XYZ');
    a.el.rotation.set(Math.atan2(-f.dot(zAx), -f.dot(yAx)), 0, 0);
    a.wr.rotation.set(wrist[0], wrist[1], wrist[2]);
    setHand(a.hand, hand);
  }
  // root-local point -> world
  local(x, y, z) {
    this.root.updateMatrixWorld(true);
    return this.root.localToWorld(new THREE.Vector3(x, y, z));
  }
  headLocal(x, y, z) {
    this.root.updateMatrixWorld(true);
    return this.head.localToWorld(new THREE.Vector3(x, y, z));
  }
  // arm(side, [shoulder xyz], elbowX, [wrist xyz], handPose)
  arm(side, sh, el = 0, wr = [0, 0, 0], hand = 'relax') {
    const a = this.arms[side];
    a.sh.rotation.set(sh[0], sh[1], sh[2]);
    a.el.rotation.set(el, 0, 0);
    a.wr.rotation.set(wr[0], wr[1], wr[2]);
    setHand(a.hand, hand);
  }
  restPose() {
    for (const s of ['R', 'L']) {
      const a = this.arms[s];
      this.arm(s, [0.05, 0, a.sx * 0.12], -0.22, [0, 0, 0], 'relax');
      this.legs[s].rotation.set(0, 0, 0);
    }
    this.hips.rotation.set(0, 0, 0);
    this.hips.position.y = this.hipY;
    this.torso.rotation.set(0, 0, 0);
    this.torso.scale.set(1, 1, 1);
    this.neck.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
  }
  reset() {
    this.root.visible = false;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.root.scale.setScalar(this.baseScale || 1);
    this.restPose();
    this.face.set({});
    if (this.extraReset) this.extraReset();
  }
  // world-space position of a hand grip
  gripWorld(side, v = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.arms[side].hand.grip.getWorldPosition(v);
  }
  breathe(t, amt = 1) {
    this.torso.scale.y = 1 + 0.01 * amt * Math.sin(t * 2.4);
  }
}

// --------------------------------------------------------------------------
export class Man extends Rig {
  constructor(M) {
    super('man');
    this.hipY = 0.34;
    this.hips = new THREE.Group(); this.hips.position.y = this.hipY; this.root.add(this.hips);
    for (const side of ['R', 'L']) {
      const sx = side === 'R' ? -1 : 1;
      const leg = new THREE.Group(); leg.position.x = sx * 0.15; this.hips.add(leg);
      const calf = bx(0.15, 0.3, 0.16, M.manSkin); calf.position.y = -0.14; leg.add(calf);
      const sl = bx(0.19, 0.08, 0.3, M.slipper); sl.position.set(0, -0.3, 0.045); leg.add(sl);
      const pom = bx(0.09, 0.06, 0.07, M.slipperPom); pom.position.set(0, -0.25, 0.17); leg.add(pom);
      this.legs[side] = leg;
    }
    const torso = (this.torso = new THREE.Group()); this.hips.add(torso);
    const W = { uv: 'world', density: 2.6 };
    const shirt = bx(0.76, 0.66, 0.52, M.gingham, W); shirt.position.y = 0.26; torso.add(shirt);
    const belly = bx(0.62, 0.38, 0.1, M.gingham, W); belly.position.set(0, 0.15, 0.3); torso.add(belly);
    const hem = bx(0.775, 0.035, 0.535, M.shirtTrim); hem.position.y = -0.055; torso.add(hem);
    const hemB = bx(0.635, 0.035, 0.11, M.shirtTrim); hemB.position.set(0, -0.022, 0.3); torso.add(hemB);
    const pl1 = bx(0.07, 0.26, 0.012, M.shirtTrim); pl1.position.set(0, 0.46, 0.262); torso.add(pl1);
    const pl2 = bx(0.07, 0.36, 0.012, M.shirtTrim); pl2.position.set(0, 0.15, 0.352); torso.add(pl2);
    for (const [y, z] of [[0.53, 0.27], [0.41, 0.27], [0.25, 0.36], [0.07, 0.36]]) {
      const b = cyl(0.017, 0.017, 0.012, 8, M.button); b.rotation.x = Math.PI / 2; b.position.set(0, y, z); torso.add(b);
    }
    const pocket = bx(0.14, 0.13, 0.012, M.gingham, W); pocket.position.set(0.2, 0.43, 0.264); torso.add(pocket);
    const ptrim = bx(0.145, 0.025, 0.016, M.shirtTrim); ptrim.position.set(0.2, 0.495, 0.265); torso.add(ptrim);
    for (const s of [-1, 1]) {
      const c = bx(0.18, 0.03, 0.14, M.shirtTrim); at(c, s * 0.085, 0.585, 0.21, 0.4, -s * 0.45, s * 0.18); torso.add(c);
    }
    this.neck = new THREE.Group(); this.neck.position.y = 0.59; torso.add(this.neck);
    const nk = bx(0.24, 0.09, 0.24, M.manSkin); nk.position.y = 0.02; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = 0.05; this.neck.add(this.head);
    this.buildHead(M);
    const S = { shX: 0.45, shY: 0.53, upW: 0.17, upL: 0.27, upD: 0.18, foW: 0.155, foL: 0.24, foD: 0.165, armMat: M.gingham, armUV: W, cuffMat: M.shirtTrim, handK: 1.05, handMat: M.manSkin };
    this.makeArm(torso, 'R', S);
    this.makeArm(torso, 'L', S);
    this.root.traverse((o) => { if (o.isMesh) o.userData.char = 'man'; });
  }
  buildHead(M) {
    const HW = 0.64, HH = 0.56, HD = 0.56, C = 0.09;
    this.dims = { HW, HH, HD, C };
    this.face = new FaceRig('man', 1024, 1248);
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.tex, roughness: 0.85, flatShading: true });
    // side + back hair textures
    const side = (mirror) => {
      const c = T.mk(512, 448), g = c.getContext('2d');
      g.fillStyle = MAN_SKIN; g.fillRect(0, 0, 512, 448);
      const x0 = mirror ? 0 : 150, x1 = mirror ? 362 : 512;
      T.scribble(g, x0, 90, x1, 250, 260, mirror ? 501 : 502, 'rgba(48,34,26,0.95)', 5, 16);
      T.scribble(g, x0, 60, x1, 110, 40, mirror ? 503 : 504, 'rgba(48,34,26,0.8)', 4, 18);
      g.strokeStyle = 'rgba(27,21,17,0.7)'; g.lineWidth = 5; g.strokeRect(2, 2, 508, 444);
      return c;
    };
    const back = T.mk(512, 448), bg = back.getContext('2d');
    bg.fillStyle = MAN_SKIN; bg.fillRect(0, 0, 512, 448);
    T.scribble(bg, 0, 90, 512, 260, 380, 505, 'rgba(48,34,26,0.95)', 5, 16);
    const top = T.mk(512), tg = top.getContext('2d');
    tg.fillStyle = MAN_SKIN; tg.fillRect(0, 0, 512, 512);
    const shine = tg.createRadialGradient(220, 230, 10, 220, 230, 170);
    shine.addColorStop(0, 'rgba(255,245,230,0.65)'); shine.addColorStop(1, 'rgba(255,245,230,0)');
    tg.fillStyle = shine; tg.fillRect(0, 0, 512, 512);
    T.ink(tg, [[250, 300], [265, 250], [240, 215], [262, 180]], 4, 506, { color: 'rgba(48,34,26,0.9)' });
    T.ink(tg, [[290, 310], [300, 270], [285, 240]], 4, 507, { color: 'rgba(48,34,26,0.9)' });
    const sk = (c) => new THREE.MeshStandardMaterial({ map: T.tex(c, { repeat: false }), roughness: 0.85, flatShading: true });
    const mats = [faceMat, M.manSkin, sk(side(false)), sk(back), sk(top), M.manSkin];
    // the two side faces need mirrored hair; use separate geometry groups via two meshes
    const geo = chamferBox(HW, HH, HD, C);
    // split group 2 (both sides) by remapping: right side first occurrence -> 2, left side -> 6
    let seen = 0;
    for (const gr of geo.groups) if (gr.materialIndex === 2) { if (seen++ === 1) gr.materialIndex = 6; }
    mats[6] = sk(side(true));
    const head = shade(new THREE.Mesh(geo, mats));
    head.position.y = HH / 2;
    this.head.add(head);
    this.headMesh = head;
    const hy = HH / 2;
    // ears, nose
    for (const s of [-1, 1]) { const e = bx(0.05, 0.12, 0.09, M.manSkin); e.position.set(s * (HW / 2 + 0.02), hy - 0.02, -0.01); this.head.add(e); }
    const nose = bx(0.085, 0.09, 0.075, M.manNose); nose.position.set(0, hy - 0.04, HD / 2 + 0.03); this.head.add(nose);
    // messy side tufts
    const R = rng(510);
    for (const s of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const t = bx(0.05 + R() * 0.03, 0.03 + R() * 0.03, 0.08 + R() * 0.06, M.hair);
        at(t, s * (HW / 2 + 0.012 + R() * 0.02), hy + 0.01 + R() * 0.15, -0.2 + R() * 0.3, (R() - 0.5) * 1.2, (R() - 0.5) * 0.8, s * (0.3 + R() * 0.9));
        this.head.add(t);
      }
    for (let i = 0; i < 6; i++) {
      const t = bx(0.08 + R() * 0.05, 0.03 + R() * 0.03, 0.04, M.hair);
      at(t, -0.22 + i * 0.09, hy + 0.04 + R() * 0.1, -HD / 2 - 0.012, 0, 0, (R() - 0.5) * 1.4);
      this.head.add(t);
    }
    // thick round glasses
    const ex = 0.105, ey = hy + 0.039, ez = HD / 2 + 0.034;
    this.eye = { x: ex, y: ey, z: HD / 2 };
    const ringG = new THREE.TorusGeometry(0.088, 0.017, 5, 14);
    this.glasses = new THREE.Group(); this.head.add(this.glasses);
    for (const s of [-1, 1]) {
      const r = shade(new THREE.Mesh(ringG, M.glasses)); r.position.set(s * ex, ey, ez); this.glasses.add(r);
      const tFront = bx(0.13, 0.018, 0.018, M.glasses); at(tFront, s * 0.255, ey + 0.012, HD / 2 + 0.02, 0, s * 0.45, 0); this.glasses.add(tFront);
      const temple = bx(0.016, 0.018, 0.3, M.glasses); temple.position.set(s * (HW / 2 + 0.008), ey + 0.012, 0.1); this.glasses.add(temple);
    }
    const bridge = bx(0.04, 0.018, 0.018, M.glasses); bridge.position.set(0, ey + 0.03, ez); this.glasses.add(bridge);
    // lens glints (additive, opacity driven by shots)
    const gc = T.mk(128), gg = gc.getContext('2d');
    gg.strokeStyle = 'rgba(255,255,255,0.95)'; gg.lineCap = 'round';
    gg.lineWidth = 14; gg.beginPath(); gg.moveTo(30, 70); gg.lineTo(70, 30); gg.stroke();
    gg.lineWidth = 7; gg.beginPath(); gg.moveTo(58, 92); gg.lineTo(92, 58); gg.stroke();
    this.glintMat = new THREE.MeshBasicMaterial({ map: T.tex(gc, { repeat: false }), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.glints = [];
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), this.glintMat); p.position.set(s * ex, ey, ez + 0.004); this.glasses.add(p); this.glints.push(p);
    }
  }
  extraReset() {
    this.glintMat.opacity = 0.12;
    this.glasses.position.set(0, 0, 0);
    this.glasses.rotation.set(0, 0, 0);
  }
  // world position of the face's eye midpoint / mouth
  facePoint(u, v, out = new THREE.Vector3()) {
    const { HW, HH, HD, C } = this.dims;
    const fw = HW - 2 * C;
    out.set((u - 0.5) * fw, HH / 2 + (0.5 - v) * HH, HD / 2 + 0.01);
    this.root.updateMatrixWorld(true);
    return this.head.localToWorld(out);
  }
}

// --------------------------------------------------------------------------
export class Officer extends Rig {
  constructor(M, opts = {}) {
    super('officer');
    this.hipY = 0.88;
    this.hips = new THREE.Group(); this.hips.position.y = this.hipY; this.root.add(this.hips);
    for (const side of ['R', 'L']) {
      const sx = side === 'R' ? -1 : 1;
      const leg = new THREE.Group(); leg.position.x = sx * 0.11; this.hips.add(leg);
      const l = bx(0.15, 0.8, 0.17, M.navy); l.position.y = -0.4; leg.add(l);
      const stripe = bx(0.012, 0.78, 0.04, M.navyLight); stripe.position.set(sx * 0.077, -0.4, 0); leg.add(stripe);
      const sh = bx(0.16, 0.09, 0.29, M.black); sh.position.set(0, -0.835, 0.05); leg.add(sh);
      this.legs[side] = leg;
    }
    const torso = (this.torso = new THREE.Group()); this.hips.add(torso);
    const jk = bx(0.5, 0.68, 0.3, M.navy); jk.position.y = 0.34; torso.add(jk);
    const belt = bx(0.52, 0.07, 0.32, M.black); belt.position.y = 0.04; torso.add(belt);
    const buckle = bx(0.07, 0.05, 0.02, M.brass); buckle.position.set(0, 0.04, 0.165); torso.add(buckle);
    const holster = bx(0.07, 0.14, 0.09, M.black); holster.position.set(-0.27, -0.02, 0.02); torso.add(holster);
    const vee = bx(0.13, 0.1, 0.012, M.shirtBlue); vee.position.set(0, 0.63, 0.151); torso.add(vee);
    const tie = bx(0.05, 0.24, 0.014, M.navyDark); tie.position.set(0, 0.52, 0.156); torso.add(tie);
    for (const s of [-1, 1]) {
      const lap = bx(0.1, 0.16, 0.014, M.navyDark); at(lap, s * 0.075, 0.6, 0.153, 0, 0, s * 0.35); torso.add(lap);
      const flap = bx(0.13, 0.045, 0.02, M.navyLight); flap.position.set(s * 0.13, 0.46, 0.158); torso.add(flap);
      const ep = bx(0.13, 0.025, 0.24, M.navyDark); ep.position.set(s * 0.2, 0.685, 0); torso.add(ep);
    }
    for (const y of [0.16, 0.28, 0.4]) { const b = bx(0.025, 0.025, 0.012, M.brass); b.position.set(0, y, 0.156); torso.add(b); }
    const shield = new THREE.Shape();
    shield.moveTo(0, 0.05); shield.lineTo(0.04, 0.035); shield.lineTo(0.035, -0.02); shield.lineTo(0, -0.05); shield.lineTo(-0.035, -0.02); shield.lineTo(-0.04, 0.035); shield.closePath();
    const badge = extrude(shield, 0.012, M.gold); badge.position.set(0.13, 0.54, 0.152); torso.add(badge);
    const radio = bx(0.06, 0.1, 0.045, M.black); radio.position.set(-0.15, 0.58, 0.168); torso.add(radio);
    const ant = cyl(0.006, 0.006, 0.08, 5, M.black); ant.position.set(-0.165, 0.66, 0.168); torso.add(ant);
    this.neck = new THREE.Group(); this.neck.position.y = 0.68; torso.add(this.neck);
    const nk = bx(0.15, 0.11, 0.15, M.offSkin); nk.position.y = 0.03; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = 0.08; this.neck.add(this.head);
    const HW = 0.4, HH = 0.6, HD = 0.4;
    this.dims = { HW, HH, HD };
    this.face = new FaceRig('officer', 720, 1080);
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.tex, roughness: 0.85, flatShading: true });
    const sideC = T.mk(256, 384), sg = sideC.getContext('2d');
    sg.fillStyle = '#e6c09d'; sg.fillRect(0, 0, 256, 384);
    T.scribble(sg, 0, 0, 256, 150, 160, 601, 'rgba(40,30,26,0.95)', 4, 12);
    sg.strokeStyle = 'rgba(27,21,17,0.7)'; sg.lineWidth = 4; sg.strokeRect(2, 2, 252, 380);
    const sideMat = new THREE.MeshStandardMaterial({ map: T.tex(sideC, { repeat: false }), roughness: 0.85, flatShading: true });
    const head = shade(new THREE.Mesh(new THREE.BoxGeometry(HW, HH, HD), [sideMat, sideMat, M.offHair, M.offSkin, faceMat, sideMat]));
    head.position.y = HH / 2; this.head.add(head);
    const hy = HH / 2;
    for (const s of [-1, 1]) { const e = bx(0.04, 0.11, 0.08, M.offSkin); e.position.set(s * (HW / 2 + 0.018), hy + 0.0, 0); this.head.add(e); }
    const nose = bx(0.06, 0.13, 0.085, M.offSkin); nose.position.set(0, hy - 0.012, HD / 2 + 0.035); this.head.add(nose);
    // thick moustache
    const ms = new THREE.Shape();
    ms.moveTo(-0.135, -0.02);
    ms.quadraticCurveTo(-0.14, 0.03, -0.09, 0.04);
    ms.quadraticCurveTo(-0.03, 0.05, 0, 0.03);
    ms.quadraticCurveTo(0.03, 0.05, 0.09, 0.04);
    ms.quadraticCurveTo(0.14, 0.03, 0.135, -0.02);
    for (let i = 0; i <= 8; i++) { const x = 0.135 - i * 0.03375; ms.lineTo(x - 0.017, -0.038 - (i % 2) * 0.01); ms.lineTo(x - 0.034, -0.025); }
    ms.closePath();
    this.moustache = extrude(ms, 0.035, M.moustache);
    this.moustache.position.set(0, hy - 0.105, HD / 2 - 0.004);
    this.head.add(this.moustache);
    // cap
    const cap = new THREE.Group(); cap.position.y = HH; this.head.add(cap); this.cap = cap;
    const crown = bx(0.44, 0.12, 0.44, M.navy); crown.position.y = 0.06; cap.add(crown);
    const topP = bx(0.48, 0.035, 0.48, M.navy); topP.position.y = 0.13; cap.add(topP);
    const band = bx(0.445, 0.055, 0.445, M.black); band.position.y = 0.025; cap.add(band);
    const visor = bx(0.4, 0.022, 0.17, M.visor); at(visor, 0, 0.005, 0.27, 0.3, 0, 0); cap.add(visor);
    const cb = extrude(starShape(0.035, 0.016, 6), 0.012, M.gold); cb.position.set(0, 0.07, 0.222); cap.add(cb);
    const hairBack = bx(0.41, 0.16, 0.04, M.offHair); hairBack.position.set(0, HH - 0.08, -HD / 2 - 0.01); this.head.add(hairBack);
    const S = { shX: 0.31, shY: 0.64, upW: 0.13, upL: 0.36, upD: 0.14, foW: 0.12, foL: 0.33, foD: 0.13, armMat: M.navy, cuffMat: M.navyDark, handK: 1.1, handMat: M.offSkin };
    this.makeArm(torso, 'R', S);
    this.makeArm(torso, 'L', S);
  }
  extraReset() {
    this.moustache.position.y = this.dims.HH / 2 - 0.105;
    this.cap.position.y = this.dims.HH;
    this.cap.rotation.set(0, 0, 0);
  }
  talk(open) {
    this.face.set({ mouth: 'talk', open });
    this.moustache.position.y = this.dims.HH / 2 - 0.105 + open * 0.008;
  }
}

// --------------------------------------------------------------------------
export class Fairy extends Rig {
  constructor(M) {
    super('fairy');
    this.baseScale = 0.3;
    this.hipY = 0.34;
    this.hips = new THREE.Group(); this.hips.position.y = this.hipY; this.root.add(this.hips);
    for (const side of ['R', 'L']) {
      const sx = side === 'R' ? -1 : 1;
      const leg = new THREE.Group(); leg.position.x = sx * 0.055; this.hips.add(leg);
      const l = bx(0.065, 0.3, 0.065, M.tights); l.position.y = -0.15; leg.add(l);
      const s = bx(0.08, 0.05, 0.12, M.fairyShoe); s.position.set(0, -0.31, 0.02); leg.add(s);
      this.legs[side] = leg;
    }
    const torso = (this.torso = new THREE.Group()); this.hips.add(torso);
    const bod = bx(0.24, 0.27, 0.16, M.fairyPink); bod.position.y = 0.15; torso.add(bod);
    // tutu: two ruffled layers
    const ruff = (rTop, rBot, h, mat, seed) => {
      const g = new THREE.CylinderGeometry(rTop, rBot, h, 16, 1, true);
      const p = g.attributes.position, R = rng(seed);
      for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) { const k = (i % 2 ? 0.86 : 1.06) * (0.95 + R() * 0.1); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, p.getY(i) - (i % 2) * 0.015); }
      g.computeVertexNormals();
      return shade(new THREE.Mesh(g, mat));
    };
    const t1 = ruff(0.13, 0.31, 0.12, M.tutu, 1); t1.position.y = 0.0; torso.add(t1);
    const t2 = ruff(0.13, 0.25, 0.1, M.tutu2, 2); t2.position.y = 0.035; torso.add(t2);
    this.tutu = [t1, t2];
    // lanyard + ID badge (night-shift office worker)
    for (const s of [-1, 1]) { const ly = bx(0.018, 0.17, 0.008, M.lanyard); at(ly, s * 0.045, 0.21, 0.083, 0, 0, s * 0.3); torso.add(ly); }
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.1, 0.006), [M.wand, M.wand, M.wand, M.wand, M.idCard, M.wand]);
    card.position.set(0, 0.1, 0.088); shade(card); torso.add(card);
    this.neck = new THREE.Group(); this.neck.position.y = 0.29; torso.add(this.neck);
    const nk = bx(0.07, 0.05, 0.07, M.fairySkin); nk.position.y = 0.01; this.neck.add(nk);
    this.head = new THREE.Group(); this.head.position.y = 0.03; this.neck.add(this.head);
    const HW = 0.38, HH = 0.36, HD = 0.33;
    this.dims = { HW, HH, HD };
    this.face = new FaceRig('fairy', 1024, 970);
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.tex, roughness: 0.85, flatShading: true });
    const head = shade(new THREE.Mesh(new THREE.BoxGeometry(HW, HH, HD), [M.fairySkin, M.fairySkin, M.auburn, M.fairySkin, faceMat, M.auburn]));
    head.position.y = HH / 2; this.head.add(head);
    const hy = HH / 2;
    for (const s of [-1, 1]) { const sd = bx(0.045, 0.31, 0.3, M.auburn); sd.position.set(s * (HW / 2 + 0.018), hy + 0.02, -0.02); this.head.add(sd); }
    const back = bx(HW + 0.07, 0.33, 0.045, M.auburn); back.position.set(0, hy + 0.02, -HD / 2 - 0.018); this.head.add(back);
    const topH = bx(HW + 0.07, 0.05, HD + 0.03, M.auburn); topH.position.set(0, HH + 0.012, -0.01); this.head.add(topH);
    const bun = shade(new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.auburn)); bun.position.set(0, HH + 0.1, -0.05); this.head.add(bun);
    const tie = shade(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 4, 10), M.fairyShoe)); at(tie, 0, HH + 0.045, -0.05, Math.PI / 2, 0, 0); this.head.add(tie);
    const pen = cyl(0.012, 0.012, 0.22, 6, M.pencil); at(pen, 0.02, HH + 0.13, -0.05, 0.2, 0, -0.9); this.head.add(pen);
    const er = cyl(0.013, 0.013, 0.03, 6, M.eraser); at(er, 0.115, HH + 0.195, -0.032, 0.2, 0, -0.9); this.head.add(er);
    const nose = bx(0.045, 0.05, 0.04, M.fairySkin); nose.position.set(0, hy - 0.035, HD / 2 + 0.015); this.head.add(nose);
    const S = { shX: 0.15, shY: 0.245, upW: 0.055, upL: 0.12, upD: 0.055, foW: 0.05, foL: 0.11, foD: 0.05, armMat: M.fairySkin, puff: M.fairyPink, handK: 0.48, handMat: M.fairySkin };
    this.makeArm(torso, 'R', S);
    this.makeArm(torso, 'L', S);
    // wings
    this.wings = {};
    const wingGeo = (len, wid) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.bezierCurveTo(wid * 0.9, len * 0.15, wid * 1.1, len * 0.75, wid * 0.45, len);
      s.bezierCurveTo(-wid * 0.05, len * 1.02, -wid * 0.15, len * 0.4, 0, 0);
      const g = new THREE.ShapeGeometry(s, 10);
      const p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (wid * 1.1), p.getY(i) / len);
      return g;
    };
    const wg = new THREE.Group(); wg.position.set(0, 0.2, -0.085); torso.add(wg); this.wingRoot = wg;
    for (const [k, len, wid, z] of [['upper', 0.44, 0.27, 0], ['lower', 0.3, 0.19, 0.01]])
      for (const s of [-1, 1]) {
        const piv = new THREE.Group(); wg.add(piv);
        const m = new THREE.Mesh(wingGeo(len, wid), M.wing); m.scale.x = s; m.castShadow = true; piv.add(m);
        this.wings[k + (s < 0 ? 'R' : 'L')] = { piv, s, k };
      }
    // wand (right hand) + coin bag (left hand)
    this.wand = new THREE.Group();
    const stick = cyl(0.012, 0.012, 0.26, 6, M.wand); stick.position.y = 0.11; this.wand.add(stick);
    const star = extrude(starShape(0.06, 0.026), 0.022, M.star); star.position.set(0, 0.25, -0.011); this.wand.add(star);
    this.wandStar = star;
    this.bag = new THREE.Group();
    const sack = shade(new THREE.Mesh(sackGeo(0.075, 0.14, 8, false), M.burlap)); sack.position.y = -0.15; this.bag.add(sack);
    const tieB = cyl(0.05, 0.05, 0.02, 8, M.burlapDark); tieB.position.y = -0.02; this.bag.add(tieB);
    const peek = cyl(0.03, 0.03, 0.008, 12, M.coinEdge); at(peek, 0.02, -0.005, 0, 0.6, 0, 0.3); this.bag.add(peek);
    this.root.scale.setScalar(this.baseScale);
  }
  extraReset() {
    const a = this.arms;
    a.R.hand.grip.add(this.wand); this.wand.position.set(0, 0, 0); this.wand.rotation.set(-1.4, 0, 0);
    a.L.hand.grip.add(this.bag); this.bag.position.set(0, 0, 0); this.bag.rotation.set(0, 0, 0);
    this.wand.visible = true; this.bag.visible = true;
    this.flap(0, 0.6, 0);
    this.tutu.forEach((t) => t.rotation.set(0, 0, 0));
  }
  // wing flap: t time, amp (0..1), droop (0..1)
  flap(t, amp = 1, droop = 0, speed = 9) {
    for (const key in this.wings) {
      const w = this.wings[key], up = w.k === 'upper';
      const base = up ? 0.55 : 2.35;
      const fl = Math.sin(t * speed * Math.PI * 2 + (up ? 0 : 0.6)) * 0.55 * amp;
      w.piv.rotation.set(0, w.s * (0.5 + fl), w.s * (up ? -base + droop * 1.2 : -base + droop * 0.5));
    }
  }
}

// --------------------------------------------------------------------------
export class Kid {
  constructor(M, { hair = '#6b4a2b', seed = 91, pigtails = false } = {}) {
    this.root = new THREE.Group();
    this.face = new FaceRig('kid', 512, 480, { hair, seed });
    const faceMat = new THREE.MeshStandardMaterial({ map: this.face.tex, roughness: 0.85, flatShading: true });
    const hairMat = M.std(hair, { r: 1 });
    const head = shade(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.3), [M.kidSkin, M.kidSkin, hairMat, M.kidSkin, faceMat, hairMat]));
    this.root.add(head);
    const fringe = bx(0.37, 0.07, 0.31, hairMat); fringe.position.y = 0.15; this.root.add(fringe);
    if (pigtails) for (const s of [-1, 1]) { const p = bx(0.08, 0.12, 0.08, hairMat); at(p, s * 0.22, 0.06, -0.04, 0, 0, s * 0.5); this.root.add(p); }
    else for (let i = 0; i < 4; i++) { const t = bx(0.06, 0.05, 0.06, hairMat); at(t, -0.12 + i * 0.08, 0.19, -0.02, 0, 0, (i - 1.5) * 0.4); this.root.add(t); }
    this.face.set({});
  }
}
