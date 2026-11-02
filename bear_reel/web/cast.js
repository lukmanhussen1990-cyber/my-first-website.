// YOU: the low-poly guy (rig, face, poses, holding props). Ported from thanksgiving_reel/web/characters.js.
// API: CONTRACTS.md (cast.js). Everything is a pure function of p + t (no state between frames).
import * as THREE from 'three';
import { mat, clamp, lerp, hash1, noise1, ik3, placeBone, v3 } from './lib.js';
import { YOU_SPOT } from './layout.js';
import { loftY, limbGeo, headGeo, noseGeo, earGeo, hairShell, tuft, buildHand, poseHand, gripPoint, shoeGeo, soleGeo, frontZ, merge, HEAD } from './char_geo.js';
import { fabricTex, torsoTex, makeFaceSet, skinTex } from './char_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const basis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

const SPEC = {
  H: 1.72, skin: '#a8714a', hair: '#3a2416', hairStyle: 'messy',
  torso: { style: 'hoodie', main: '#c4242a', rib: '#a51c22' }, sleeve: ['fleece', { color: '#c4242a', seed: 11 }],
  pants: ['denim', { color: '#2c3b5c', seed: 4 }], shoe: '#f2f2ee', shoulder: 0.18, waist: 0.135, chestD: 0.1, belly: 0,
  extras: ['hood'],
  face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 3, brow: '#24150c', blush: '#d65a5a' },
};

class You {
  constructor(world) {
    const spec = (this.spec = SPEC);
    this.name = 'you'; this.world = world;
    const s = (this.s = spec.H / 1.75);
    this.root = new THREE.Group(); this.root.name = 'you';
    world.scene.add(this.root);
    this.headScale = 1.0;
    this.headRadius = HEAD.ry;
    this.legL = [0.455 * s, 0.445 * s];
    this.armL = [0.29 * s, 0.26 * s];
    this.ankleH = 0.075 * s;
    this.hipW = 0.09 * s;
    this.hipStandY = this.legL[0] + this.legL[1] + this.ankleH - 0.03 * s;
    this.thighR = 0.075 * s;
    this.torsoH = 0.5 * s;
    this.shoulderW = spec.shoulder;
    const M = (this.mats = {});
    const m = (map) => mat(map, { rough: 0.85 });
    M.skin = m(skinTex(spec.skin, 43));
    M.skin.emissive = new THREE.Color(spec.skin).multiplyScalar(0.1);
    M.torso = m(torsoTex(spec.torso.style, spec.torso));
    M.sleeve = m(fabricTex(spec.sleeve[0], spec.sleeve[1], 32, [2, 2]));
    M.pants = m(fabricTex(spec.pants[0], spec.pants[1], 32, [2, 3]));
    M.shoe = m(fabricTex('cotton', { color: spec.shoe, amount: 8, seed: 3 }));
    M.sole = mat('#e8e4dc', { rough: 0.9 });
    M.hair = m(fabricTex('cotton', { color: spec.hair, amount: 16, seed: 5 }));
    M.tongue = mat('#c2505c', { rough: 0.5 });
    this.faceSet = makeFaceSet({ skin: spec.skin, ...spec.face });
    M.face = mat(this.faceSet('open', 'neutral', 'neutral', 0, 0, 0, 0), { rough: 0.85 });
    M.face.emissive = new THREE.Color(spec.skin).multiplyScalar(0.1);
    this.baseSkin = new THREE.Color(1, 1, 1);
    this.build();
    this.p = this.defaults();
  }

  mk(geo, material, part, parent) {
    const me = new THREE.Mesh(geo, material); me.castShadow = true; me.receiveShadow = true; me.name = `you.${part}`;
    (parent || this.root).add(me); return me;
  }

  build() {
    const { spec, s, mats: M } = this;
    const sw = this.shoulderW, wa = spec.waist, cd = spec.chestD;
    this.pelvis = new THREE.Group(); this.root.add(this.pelvis);
    const hipW = Math.max(wa + 0.01, 0.15 * s);
    this.mk(loftY([{ y: -0.064 * s, w: hipW * 0.86, d: cd * 0.88 }, { y: -0.02 * s, w: hipW, d: cd * 0.95 }, { y: 0.06 * s, w: wa * 1.02, d: cd * 0.92 }], 10), M.pants, 'hips', this.pelvis);
    this.chest = new THREE.Group(); this.chest.position.y = 0.05 * s; this.pelvis.add(this.chest);
    const T = this.torsoH;
    const rings = [
      { y: 0.0, w: wa + 0.008, df: cd * 0.98, db: cd * 0.88 },
      { y: T * 0.22, w: wa + 0.02, df: cd + 0.006, db: cd * 0.9 },
      { y: T * 0.48, w: sw * 0.9, df: cd + 0.008, db: cd * 0.96 },
      { y: T * 0.78, w: sw * 0.98, df: cd * 0.96, db: cd * 0.96 },
      { y: T * 0.92, w: sw * 0.9, df: cd * 0.8, db: cd * 0.82 },
      { y: T * 1.0, w: 0.065 * s + 0.012, df: 0.052 * s, db: 0.052 * s },
    ];
    this.torso = this.mk(loftY(rings, 12, { n: 2.3 }), M.torso, 'torso', this.chest);
    // hood bunched behind the neck + drawstrings
    const hg = new THREE.TorusGeometry(0.078 * s, 0.032 * s, 5, 10, Math.PI * 1.2); hg.rotateX(Math.PI / 2); hg.rotateY(Math.PI * 0.4);
    const hood = this.mk(hg, M.sleeve, 'hood', this.chest); hood.position.set(0, T * 0.97, -0.036 * s); hood.rotation.x = -0.2;
    const strM = mat('#ecece8');
    for (const sd of [-1, 1]) { const st = this.mk(new THREE.BoxGeometry(0.006, 0.12 * s, 0.006), strM, 'string', this.chest); st.position.set(sd * 0.03 * s, T * 0.84, cd * 0.84 + 0.014); st.rotation.x = -0.12; }
    this.mk(limbGeo(0.12 * s, 0.05 * s, 0.045 * s, 8), M.skin, 'neck', this.chest).position.set(0, T * 0.96, 0);
    this.head = new THREE.Group(); this.head.position.set(0, T * 0.96 + 0.06 * s + HEAD.ry * 0.82, 0.012 * s); this.chest.add(this.head);
    const hgeo = headGeo({ jaw: 0.3, wide: 1 });
    this.headMesh = this.mk(hgeo, [M.skin, M.face], 'head', this.head);
    const nz = frontZ(hgeo, 0, -0.022);
    const nose = this.mk(noseGeo({ len: 0.022, w: 0.013, top: 0.01, bot: -0.03 }), M.skin, 'nose', this.head); nose.position.set(0, -0.004, nz - 0.003);
    for (const sd of [-1, 1]) { const e = this.mk(earGeo(sd), M.skin, 'ear', this.head); e.position.set(sd * HEAD.rx * 0.98, -0.008, -0.005); }
    this.buildHair();
    // puffable cheeks (hidden inside the head until p.cheeks > 0)
    this.cheeks = [-1, 1].map((sd) => {
      const c = this.mk(new THREE.IcosahedronGeometry(1, 1), M.skin, 'cheek', this.head);
      c.position.set(sd * 0.042, -0.042, frontZ(hgeo, sd * 0.042, -0.042) - 0.02); c.userData.sd = sd; return c;
    });
    this.cheekZ = [-1, 1].map((sd) => frontZ(hgeo, sd * 0.046, -0.042));
    // tongue (sticks out when p.tongue > 0)
    const tg = new THREE.BoxGeometry(0.026, 0.008, 0.04); tg.translate(0, 0, 0.02);
    this.tongue = this.mk(tg, M.tongue, 'tongue', this.head);
    this.tongue.position.set(0, -0.058, frontZ(hgeo, 0, -0.056) - 0.012);
    this.mouthLocal = V(0, -0.05, frontZ(hgeo, 0, -0.05) + 0.004);
    this.eyeLocalC = V(0, 0.004, frontZ(hgeo, 0, 0.004));
    this.shoulderLocal = { L: V(sw, T * 0.86, 0), R: V(-sw, T * 0.86, 0) }; // L = character's left (+X when facing +Z)
    this.arms = {};
    for (const side of ['L', 'R']) {
      const up = this.mk(limbGeo(1, 0.05 * s, 0.042 * s, 7), M.sleeve, `upperArm${side}`);
      const lo = this.mk(limbGeo(1, 0.042 * s, 0.034 * s, 7), M.sleeve, `forearm${side}`);
      const cuff = this.mk(limbGeo(1, 0.037 * s, 0.035 * s, 7), M.sleeve, `cuff${side}`);
      const H = buildHand(M.skin, side, s, 'you'); this.root.add(H.grp);
      this.arms[side] = { up, lo, cuff, H, side, sx: side === 'L' ? 1 : -1 };
    }
    this.legs = {};
    for (const side of ['L', 'R']) {
      const th = this.mk(limbGeo(1, this.thighR, 0.058 * s, 8), M.pants, `thigh${side}`);
      const sh = this.mk(limbGeo(1, 0.056 * s, 0.045 * s, 8), M.pants, `shin${side}`);
      const shoe = new THREE.Group(); this.root.add(shoe);
      this.mk(shoeGeo(this.ankleH, 0.27 * s, 'sneaker'), M.shoe, `shoe${side}`, shoe);
      this.mk(soleGeo(this.ankleH, 0.27 * s), M.sole, `sole${side}`, shoe);
      this.legs[side] = { th, sh, shoe, sx: side === 'L' ? 1 : -1 };
    }
  }

  buildHair() {
    const M = this.mats;
    const add = (g, part = 'hair') => this.mk(g, M.hair, part, this.head);
    const notFace = (nx, ny, nz) => !(nz > 0.35 && ny < 0.42 && ny > -0.95);
    add(hairShell((nx, ny, nz) => ny > -0.15 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.8 && ny < 0.25 && nz > -0.3), { thick: 0.013, chunk: 0.012, seed: 3 }));
    const tufts = [];
    const R = (i) => hash1(i * 7.7 + 3);
    for (let i = 0; i < 18; i++) {   // messy spiky tufts all over the top
      const a = (i / 18) * Math.PI * 2, el = 0.35 + R(i) * 0.5;
      const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
      if (dir[2] > 0.55 && dir[1] < 0.6) continue;
      const base = [dir[0] * HEAD.rx * 0.95, dir[1] * HEAD.ry * 0.95, dir[2] * HEAD.rz * 0.95];
      tufts.push(tuft(base, [dir[0] + 0.3 * Math.cos(a + 1), dir[1] + 0.45, dir[2]], 0.055 + R(i + 9) * 0.035, 0.023, 4, R(i + 3) * 3));
    }
    for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.022; tufts.push(tuft([x, HEAD.ry * 0.62, HEAD.rz * 0.55], [x * 2 + 0.2 * (i % 2 ? 1 : -1), -0.6, 0.6], 0.048, 0.019, 4, i)); }
    this.tufts = add(merge(tufts), 'hairTufts');
  }

  defaults() {
    return {
      pos: YOU_SPOT.pos.slice(), rotY: YOU_SPOT.rotY, crouch: 0, lean: 0, leanSide: 0, torsoYaw: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null,
      eyes: 'open', pupils: [0, 0], brows: 'worried', mouth: 'tight', talk: 0, blush: 0,
      handL: null, handR: null, handPoseL: 'relaxed', handPoseR: 'relaxed', handRotL: null, handRotR: null,
      gripL: null, gripR: null, poleL: null, poleR: null,
      cheeks: 0, red: 0, tongue: 0, shoulderUp: 0, hairBounce: 0, visible: true,
    };
  }

  _w(local, obj) { obj.updateMatrixWorld(true); return local.clone().applyMatrix4(obj.matrixWorld); }
  headPos() { return this._w(V(), this.head); }
  eyePos() { return this._w(this.eyeLocalC, this.head); }
  eyeLocal(side = 'L') { return V(side === 'L' ? 0.031 : -0.031, 0.004, this.eyeLocalC.z); }
  mouthPos() { return this._w(this.mouthLocal, this.head); }
  chestPos() { return this._w(V(0, this.torsoH * 0.6, this.spec.chestD), this.chest); }
  backPos() { return this._w(V(0, this.torsoH * 0.1, -this.spec.chestD - 0.04), this.chest); }   // lower back (scratch spot)
  hipPos() { return this._w(V(0, -0.02, 0), this.pelvis); }
  handPos(side = 'R') { const a = this.arms[side]; return this._w(V(0, a.H.L * 0.55, 0), a.H.grp); }
  shoulderPos(side = 'R') { return this._w(this.shoulderLocal[side], this.chest); }
}

// ------------------------------------------------------------------ solver (writes p into the meshes)
function gripFrame(g) {
  const prop = g.prop || g, grip = g.which ? prop.userData.grips[g.which] : prop.userData.grip;
  prop.updateMatrixWorld(true);
  const q = prop.getWorldQuaternion(new THREE.Quaternion());
  return {
    pos: V(...grip.pos).applyMatrix4(prop.matrixWorld),
    axis: V(...grip.axis).applyQuaternion(q).normalize(),
    up: V(...(g.up || grip.up || [0, 1, 0])).applyQuaternion(g.up ? new THREE.Quaternion() : q).normalize(),
  };
}

function solve(ch, t) {
  const p = ch.p, s = ch.s;
  ch.root.visible = p.visible;
  if (!p.visible) return;
  ch.root.position.set(p.pos[0], 0, p.pos[1]);
  ch.root.rotation.set(0, p.rotY, 0);
  const crouch = clamp(p.crouch);
  const hipY = ch.hipStandY - crouch * 0.42 * s;
  ch.pelvis.position.set(0, hipY, -crouch * 0.06);
  ch.pelvis.rotation.set(0, p.torsoYaw * 0.3, 0);
  const breathe = Math.sin(t * 1.6 + 2.0) * 0.008;
  ch.chest.rotation.set(p.lean + crouch * 0.22 + breathe, p.torsoYaw * 0.7, p.leanSide, 'YXZ');
  ch.chest.scale.set(1, 1, 1 + breathe * 0.4);
  ch.chest.position.y = 0.05 * s + p.shoulderUp * 0.025;
  ch.head.rotation.set(0, 0, 0);
  ch.root.updateMatrixWorld(true);
  let yaw = p.headYaw, pitch = p.headPitch, pdx = p.pupils[0], pdy = p.pupils[1];
  if (p.lookAt) {
    const inv = new THREE.Matrix4().copy(ch.chest.matrixWorld).invert();
    const d = v3(p.lookAt).applyMatrix4(inv).sub(ch.head.position);
    const wantYaw = Math.atan2(d.x, d.z), wantPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    yaw = clamp(wantYaw, -1.2, 1.2) + p.headYaw; pitch = clamp(wantPitch, -0.6, 0.55) + p.headPitch;
    pdx = clamp((wantYaw - clamp(wantYaw, -1.2, 1.2)) * 2, -1, 1) + p.pupils[0];
    pdy = clamp((wantPitch - clamp(wantPitch, -0.6, 0.55)) * 2, -1, 1) + p.pupils[1];
  }
  // chest pitch is compensated so the head pitch is relative to the world
  ch.head.rotation.set(-pitch - (p.lean + crouch * 0.22) * 0.8, yaw, p.headRoll, 'YXZ');
  const faceTex = ch.faceSet(p.eyes, p.brows, p.mouth, p.talk, pdx, pdy, 0, p.blush > 0.5);
  if (ch.mats.face.map !== faceTex) { ch.mats.face.map = faceTex; ch.mats.face.needsUpdate = true; }
  // red face (holding breath): tint skin + face
  const red = clamp(p.red);
  const tint = new THREE.Color(1, 1 - red * 0.45, 1 - red * 0.5);
  ch.mats.face.color.copy(tint); ch.mats.skin.color.copy(tint);
  ch.mats.face.emissive.set(ch.spec.skin).multiplyScalar(0.1).lerp(new THREE.Color(0.35, 0.02, 0.02), red * 0.5);
  ch.mats.skin.emissive.copy(ch.mats.face.emissive);
  // cheeks puff out of the face
  const ck = clamp(p.cheeks);
  for (const c of ch.cheeks) {          // round bulges on the sides of the mouth
    c.visible = ck > 0.02;
    const r = 0.012 + 0.014 * ck;
    c.scale.set(r * 1.1, r, r * 0.9);
    c.position.set(c.userData.sd * (0.042 + 0.008 * ck), -0.042, ch.cheekZ[c.userData.sd > 0 ? 1 : 0] - 0.02 + 0.012 * ck);
  }
  ch.tongue.visible = p.tongue > 0.02;
  ch.tongue.scale.set(1, 1, clamp(p.tongue));
  ch.tongue.rotation.x = 0.35 + Math.sin(t * 20) * 0.08 * p.tongue;
  // messy hair bounce (scratching, panic)
  ch.tufts.rotation.set(Math.sin(t * 27) * 0.06 * p.hairBounce, 0, Math.sin(t * 23 + 1) * 0.08 * p.hairBounce);

  ch.root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(ch.root.matrixWorld).invert();
  const rootQi = ch.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const fwdW = V(Math.sin(p.rotY), 0, Math.cos(p.rotY));

  for (const side of ['L', 'R']) {
    const a = ch.arms[side], H = a.H, sx = a.sx;
    const shW = ch.shoulderLocal[side].clone().applyMatrix4(ch.chest.matrixWorld);
    const g = side === 'L' ? p.gripL : p.gripR;
    let pose = side === 'L' ? p.handPoseL : p.handPoseR;
    let wristW, handQ = null;
    if (g) {
      const G = gripFrame(g);
      const X = G.axis.clone().multiplyScalar(H.ts);
      const Z = G.up.clone().addScaledVector(X, -G.up.dot(X)).normalize();
      const Y = V().crossVectors(Z, X);
      handQ = basis(X, Y, Z);
      wristW = G.pos.clone().sub(gripPoint(H).applyQuaternion(handQ));
      pose = g.pose || 'grip';
    } else {
      const tgt = side === 'L' ? p.handL : p.handR;
      const rot = side === 'L' ? p.handRotL : p.handRotR;
      if (tgt) {
        const T = v3(tgt);
        if (rot) handQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ'));
        else if (pose === 'flat') { // palm flat against a surface facing the character (e.g. hand on the bark)
          const Y = T.clone().sub(shW).normalize();
          const Z = fwdW.clone().negate().addScaledVector(Y, fwdW.dot(Y)).normalize();
          const X = V().crossVectors(Y, Z); handQ = basis(X, Y, Z);
        } else {
          const Y = T.clone().sub(shW).normalize();
          const out = pose === 'point' ? V(0, 1, 0) : V(fwdW.z, 0, -fwdW.x).multiplyScalar(sx).add(V(0, 0.8, 0)).normalize();
          const Z = out.addScaledVector(Y, -out.dot(Y)).normalize(); const X = V().crossVectors(Y, Z);
          handQ = basis(X, Y, Z);
        }
        const palmC = V(0, H.L * 0.5, 0);
        wristW = T.clone().sub(palmC.applyQuaternion(handQ));
      } else { // standing rest: arms hang
        wristW = V(sx * (ch.shoulderW + 0.02), ch.pelvis.position.y - 0.07 * s, 0.03).applyMatrix4(ch.root.matrixWorld);
      }
    }
    const A = shW.clone().applyMatrix4(toLocal), Wl = wristW.clone().applyMatrix4(toLocal);
    const pl = side === 'L' ? p.poleL : p.poleR;
    const pole = A.clone().add(pl ? V(pl[0] * sx, pl[1], pl[2]) : V(sx * 0.28, -1.0, -0.05));
    const { J, E } = ik3(A, Wl, ch.armL[0], ch.armL[1], pole);
    placeBone(a.up, A, J); placeBone(a.lo, J, E);
    const d = E.clone().sub(J).normalize(); placeBone(a.cuff, E.clone().addScaledVector(d, -0.03 * s), E.clone().addScaledVector(d, 0.006));
    H.grp.position.copy(E);
    if (!handQ) {
      const Y = E.clone().sub(J).normalize(); const out = V(sx, 0, 0.3).normalize(); const Z = out.addScaledVector(Y, -out.dot(Y)).normalize(); const X = V().crossVectors(Y, Z);
      H.grp.quaternion.copy(basis(X, Y, Z));
    } else H.grp.quaternion.copy(rootQi.clone().multiply(handQ));
    poseHand(H, pose);
  }

  for (const side of ['L', 'R']) {
    const L = ch.legs[side], sx = L.sx;
    const hip = V(sx * ch.hipW, 0, 0).applyMatrix4(ch.pelvis.matrixWorld).applyMatrix4(toLocal);
    const { J, E } = ik3(hip, V(sx * (ch.hipW + 0.02 + crouch * 0.05), ch.ankleH, 0.02), ch.legL[0], ch.legL[1], hip.clone().add(V(sx * 0.1, -0.3, 1)));
    placeBone(L.th, hip, J); placeBone(L.sh, J, E);
    L.shoe.position.copy(E); L.shoe.rotation.set(0, sx * 0.08, 0);
  }
}

// ------------------------------------------------------------------ cast (just YOU)
export function buildCast(world) {
  const you = new You(world);
  const helpers = {
    blink(t) { const per = 3.1, ph = ((t + 1.3) % per) / per; if (ph > 0.965 && you.p.eyes === 'open') you.p.eyes = 'closed'; },
    talk(t, intensity = 1) { you.p.talk = clamp(Math.max(0, noise1(t * 9, 31) * 0.6 + noise1(t * 17, 7) * 0.5 + 0.25) * intensity); },
  };
  return {
    characters: [you], you, helpers,
    reset(t) { you.p = you.defaults(); helpers.blink(t); },
    commit(ctx) { solve(you, ctx.t); },
  };
}
