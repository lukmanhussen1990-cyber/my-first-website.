// The 7 low-poly people: rig, faces, poses, holding props, idle life + story continuity. API: CONTRACTS.md.
import * as THREE from 'three';
import { mat, clamp, lerp, smooth, hash1, noise1, ik3, placeBone, v3 } from './lib.js';
import { SEATS, CHAIR, GRANDMA_STAND, TABLE } from './layout.js';
import { loftY, limbGeo, headGeo, noseGeo, earGeo, hairShell, tuft, buildHand, poseHand, gripPoint, shoeGeo, soleGeo, glassesGeo, lensGeo, frontZ, merge, HEAD } from './char_geo.js';
import { fabricTex, torsoTex, makeFaceSet, skinTex, sleeveSplitTex } from './char_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ cast specs
const SPECS = {
  you: { H: 1.72, skin: '#e9b993', hair: '#5b3a20', hairStyle: 'messy', torso: { style: 'hoodie', main: '#7f8894', rib: '#6d747f' }, sleeve: ['fleece', { color: '#7f8894', seed: 11 }],
    pants: ['denim', { color: '#3d5b88', seed: 4 }], shoe: '#f2f2ee', shoulder: 0.18, waist: 0.135, chestD: 0.1, belly: 0, female: false, extras: ['hood'],
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 3, brow: '#4a2e1a' } },
  grandma: { H: 1.56, skin: '#f0c9aa', hair: '#ecebe6', hairStyle: 'bun', torso: { style: 'cardigan', main: '#7e2633', rib: '#6a1f2a', inner: '#efe6d6' }, sleeve: ['knit', { color: '#7e2633', seed: 12 }],
    pants: ['cotton', { color: '#6f6a66', seed: 9, amount: 8 }], shoe: '#3a2a22', shoulder: 0.165, waist: 0.15, chestD: 0.11, belly: 0.25, female: true, hunch: 0.1, glasses: true,
    face: { eyeW: 7, eyeH: 10, mouthW: 0.9, seed: 5, brow: '#b8b2a8', blush: '#e08a80', lash: false } },
  uncle: { H: 1.82, skin: '#dca37c', hair: '#4a3020', hairStyle: 'short', torso: { style: 'flannel', main: '#b3262a', dark: '#1e1416' }, sleeve: ['plaid', { color: '#b3262a', color2: '#1e1416', seed: 13, period: 10 }],
    pants: ['denim', { color: '#33507a', seed: 6 }], shoe: '#5a3a24', shoeKind: 'boot', shoulder: 0.215, waist: 0.2, chestD: 0.13, belly: 1.0, female: false, beard: '#4a3020',
    face: { eyeW: 8, eyeH: 11, mouthW: 1.1, seed: 7, brow: '#3a2416', beard: '#4a3020' } },
  mom: { H: 1.66, skin: '#f2caa8', hair: '#8a3f22', hairStyle: 'shoulder', torso: { style: 'sweater', main: '#c98a2a', rib: '#b47820' }, sleeve: ['knit', { color: '#c98a2a', seed: 14 }],
    pants: ['denim', { color: '#2c3a58', seed: 8 }], shoe: '#2a2220', shoulder: 0.16, waist: 0.13, chestD: 0.1, belly: 0, female: true,
    face: { eyeW: 7, eyeH: 11, mouthW: 0.9, seed: 9, brow: '#6a2e18', blush: '#e89080', lash: true } },
  dad: { H: 1.8, skin: '#e2ae88', hair: '#a07a48', hairStyle: 'short', torso: { style: 'quarterzip', main: '#2a3a5c', rib: '#223050' }, sleeve: ['fleece', { color: '#2a3a5c', seed: 15 }],
    pants: ['cotton', { color: '#b8a27a', seed: 10, amount: 9 }], shoe: '#4a3426', shoulder: 0.2, waist: 0.155, chestD: 0.11, belly: 0.2, female: false,
    face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 11, brow: '#7a5a34' } },
  cousinA: { H: 1.5, skin: '#c98d66', hair: '#3a2416', hairStyle: 'ponytail', torso: { style: 'girltop', main: '#6a3a8a', accent: '#2aa39a' }, sleeve: ['cotton', { color: '#6a3a8a', seed: 16, amount: 10 }],
    pants: ['denim', { color: '#4a6a9a', seed: 12 }], shoe: '#f4f0f2', shoulder: 0.145, waist: 0.115, chestD: 0.085, belly: 0, female: true, kid: true,
    face: { eyeW: 8, eyeH: 12, mouthW: 0.9, seed: 13, brow: '#2a1a10', blush: '#d87a6a', lash: true } },
  cousinB: { H: 1.3, skin: '#c98d66', hair: '#2e1c12', hairStyle: 'buzz', torso: { style: 'jersey', main: '#2f7a3a', accent: '#f2f2ea', number: '8' }, sleeve: ['jersey', { color: '#2f7a3a', seed: 17 }],
    pants: ['denim', { color: '#4a5a7a', seed: 14 }], shoe: '#d03a2a', shoulder: 0.13, waist: 0.11, chestD: 0.08, belly: 0.1, female: false, kid: true, shortSleeve: true,
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 15, brow: '#2a1a10', freckles: true } },
};

const basis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

// ------------------------------------------------------------------ a character
class Character {
  constructor(name, spec, world) {
    this.name = name; this.spec = spec; this.world = world;
    const s = (this.s = spec.H / 1.75);
    this.root = new THREE.Group(); this.root.name = name;
    world.scene.add(this.root);
    this.headScale = spec.kid ? 1.0 - (1.75 - spec.H) * 0.12 : 1.0;
    this.headRadius = HEAD.ry * this.headScale;
    this.legL = [0.455 * s, 0.445 * s];
    this.armL = [0.29 * s, 0.26 * s];
    this.ankleH = 0.075 * s;
    this.hipW = 0.09 * s;
    this.hipStandY = this.legL[0] + this.legL[1] + this.ankleH - 0.03 * s;
    this.thighR = 0.075 * s * (spec.belly > 0.6 ? 1.12 : 1);
    this.torsoH = 0.5 * s;
    this.shoulderW = spec.shoulder;
    const M = (this.mats = {});
    const m = (map) => mat(map, { rough: 0.85 });
    M.skin = m(skinTex(spec.skin, (spec.face.seed || 1) + 40));
    M.skin.emissive = new THREE.Color(spec.skin).multiplyScalar(0.1);
    M.torso = m(torsoTex(spec.torso.style, spec.torso));
    M.sleeve = m(fabricTex(spec.sleeve[0], spec.sleeve[1], 32, [2, 2]));
    M.sleeveUpper = spec.shortSleeve ? m(sleeveSplitTex(spec.sleeve[0], spec.sleeve[1], spec.skin, 0.45)) : M.sleeve;
    M.pants = m(fabricTex(spec.pants[0], spec.pants[1], 32, [2, 3]));
    M.shoe = m(fabricTex('cotton', { color: spec.shoe, amount: 8, seed: 3 }));
    M.sole = mat('#e8e4dc', { rough: 0.9 });
    M.hair = m(fabricTex('cotton', { color: spec.hair, amount: 16, seed: 5 }));
    M.beard = spec.beard ? m(fabricTex('cotton', { color: spec.beard, amount: 18, seed: 6 })) : null;
    this.faceSet = makeFaceSet({ skin: spec.skin, ...spec.face });
    M.face = mat(this.faceSet('open', 'neutral', 'neutral', 0, 0, 0, 0), { rough: 0.85 });
    M.face.emissive = new THREE.Color(spec.skin).multiplyScalar(0.1);
    this.build();
    this.p = this.defaults();
  }

  mk(geo, material, part, parent) {
    const me = new THREE.Mesh(geo, material); me.castShadow = true; me.receiveShadow = true; me.name = `${this.name}.${part}`;
    (parent || this.root).add(me); return me;
  }

  build() {
    const { spec, s, mats: M } = this;
    const sw = this.shoulderW, wa = spec.waist, cd = spec.chestD, b = spec.belly, fem = spec.female;
    this.pelvis = new THREE.Group(); this.root.add(this.pelvis);
    const hipW = Math.max(wa + 0.01, 0.15 * s) * (fem ? 1.05 : 1);
    this.mk(loftY([{ y: -0.064 * s, w: hipW * 0.86, d: cd * 0.88 }, { y: -0.02 * s, w: hipW, d: cd * 0.95 + b * 0.03 }, { y: 0.06 * s, w: wa * 1.02, d: cd * 0.92 + b * 0.05 }], 10), M.pants, 'hips', this.pelvis);
    this.chest = new THREE.Group(); this.chest.position.y = 0.05 * s; this.pelvis.add(this.chest);
    const T = this.torsoH;
    const rings = [
      { y: 0.0, w: wa, df: cd * 0.95 + b * 0.06, db: cd * 0.85 },
      { y: T * 0.22, w: wa + 0.012 + b * 0.05, df: cd + b * 0.15, db: cd * 0.88 },
      { y: T * 0.48, w: sw * 0.9 + b * 0.03, df: cd + (fem ? 0.02 : 0.005) + b * 0.06, db: cd * 0.95 },
      { y: T * 0.78, w: sw * 0.98, df: cd * 0.95, db: cd * 0.95 },
      { y: T * 0.92, w: sw * 0.9, df: cd * 0.78, db: cd * 0.8 },
      { y: T * 1.0, w: 0.065 * s + 0.01, df: 0.05 * s, db: 0.05 * s },
    ];
    this.torso = this.mk(loftY(rings, 12, { n: 2.3 }), M.torso, 'torso', this.chest);
    this.bellyFront = cd + b * 0.15;
    if (spec.extras?.includes('hood')) {
      const hg = new THREE.TorusGeometry(0.075 * s, 0.03 * s, 5, 10, Math.PI * 1.2); hg.rotateX(Math.PI / 2); hg.rotateY(Math.PI * 0.4);
      const hood = this.mk(hg, M.sleeve, 'hood', this.chest); hood.position.set(0, T * 0.97, -0.035 * s); hood.rotation.x = -0.2;
      const strM = mat('#ecece8');
      for (const sd of [-1, 1]) { const st = this.mk(new THREE.BoxGeometry(0.006, 0.12 * s, 0.006), strM, 'string', this.chest); st.position.set(sd * 0.03 * s, T * 0.84, cd * 0.82 + 0.014); st.rotation.x = -0.12; }
    }
    if (spec.torso.style === 'flannel') {
      for (const sd of [-1, 1]) { const c = this.mk(new THREE.BoxGeometry(0.06 * s, 0.012, 0.05 * s), M.torso, 'collar', this.chest); c.position.set(sd * 0.045 * s, T * 0.985, 0.025 * s); c.rotation.set(0.5, sd * 0.5, sd * 0.2); }
    }
    this.mk(limbGeo(0.12 * s, 0.05 * s, 0.045 * s, 8), M.skin, 'neck', this.chest).position.set(0, T * 0.96, 0);
    const hs = this.headScale;
    this.head = new THREE.Group(); this.head.position.set(0, T * 0.96 + 0.06 * s + HEAD.ry * hs * 0.82, 0.012 * s); this.chest.add(this.head);
    const hg = headGeo({ jaw: spec.belly > 0.6 ? 0.18 : fem ? 0.38 : 0.3, wide: spec.belly > 0.6 ? 1.06 : 1 });
    hg.scale(hs, hs, hs);
    this.headMesh = this.mk(hg, [M.skin, M.face], 'head', this.head);
    const nz = frontZ(hg, 0, -0.022 * hs);
    const nose = this.mk(noseGeo({ len: 0.022 * hs, w: 0.012 * hs, top: 0.01 * hs, bot: -0.03 * hs }), M.skin, 'nose', this.head); nose.position.set(0, -0.004 * hs, nz - 0.003);
    for (const sd of [-1, 1]) { const e = this.mk(earGeo(sd), M.skin, 'ear', this.head); e.scale.setScalar(hs); e.position.set(sd * HEAD.rx * hs * 0.98, -0.008 * hs, -0.005 * hs); }
    this.buildHair(hs);
    if (spec.glasses) {
      const ez = frontZ(hg, 0.031 * hs, 0.004 * hs) + 0.012 * hs;
      this.mk(glassesGeo(0.031 * hs, 0.004 * hs, ez, { w: 0.04 * hs, h: 0.03 * hs, earX: HEAD.rx * hs * 0.98, earZ: -0.01 * hs }), mat('#c9a050', { rough: 0.35, metal: 0.7 }), 'glasses', this.head);
      const lens = this.mk(lensGeo(0.031 * hs, 0.004 * hs, ez, { w: 0.04 * hs, h: 0.03 * hs }), mat('#e8f4ff', { rough: 0.05, transparent: true, opacity: 0.18 }), 'lens', this.head);
      lens.castShadow = false; lens.userData.noAudit = true;
      this.glassesPosLocal = V(0.031 * hs, 0.012 * hs, ez + 0.004);
    }
    this.mouthLocal = V(0, -0.05 * hs, frontZ(hg, 0, -0.05 * hs) + 0.004);
    this.eyeLocal = V(0, 0.004 * hs, frontZ(hg, 0, 0.004 * hs));
    this.shoulderLocal = { L: V(sw, T * 0.86, 0), R: V(-sw, T * 0.86, 0) }; // L = character's left (+X when facing +Z)
    this.arms = {};
    for (const side of ['L', 'R']) {
      const up = this.mk(limbGeo(1, 0.05 * s * (1 + b * 0.25), 0.042 * s * (1 + b * 0.2), 7), M.sleeveUpper, `upperArm${side}`);
      const lo = this.mk(limbGeo(1, 0.042 * s * (1 + b * 0.15), 0.034 * s, 7), spec.shortSleeve ? M.skin : M.sleeve, `forearm${side}`);
      const cuff = spec.shortSleeve ? null : this.mk(limbGeo(1, 0.037 * s, 0.035 * s, 7), M.sleeve, `cuff${side}`);
      const H = buildHand(M.skin, side, s, this.name); this.root.add(H.grp);
      this.arms[side] = { up, lo, cuff, H, side, sx: side === 'L' ? 1 : -1 };
    }
    this.legs = {};
    for (const side of ['L', 'R']) {
      const th = this.mk(limbGeo(1, this.thighR, 0.058 * s, 8), M.pants, `thigh${side}`);
      const sh = this.mk(limbGeo(1, 0.056 * s, 0.045 * s, 8), M.pants, `shin${side}`);
      const shoe = new THREE.Group(); this.root.add(shoe);
      this.mk(shoeGeo(this.ankleH, 0.27 * s, spec.shoeKind || 'sneaker'), M.shoe, `shoe${side}`, shoe);
      this.mk(soleGeo(this.ankleH, 0.27 * s), M.sole, `sole${side}`, shoe);
      this.legs[side] = { th, sh, shoe, sx: side === 'L' ? 1 : -1 };
    }
  }

  buildHair(hs) {
    const { spec, mats: M } = this, st = spec.hairStyle;
    const add = (g, part = 'hair', material = M.hair) => { g.scale(hs, hs, hs); return this.mk(g, material, part, this.head); };
    const notFace = (nx, ny, nz) => !(nz > 0.35 && ny < 0.42 && ny > -0.95);
    if (st === 'messy') {
      add(hairShell((nx, ny, nz) => ny > -0.15 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.8 && ny < 0.25 && nz > -0.3), { thick: 0.012, chunk: 0.012, seed: 3 }));
      const tufts = [];
      const R = (i) => hash1(i * 7.7 + 3);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, el = 0.35 + R(i) * 0.5;
        const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
        if (dir[2] > 0.55 && dir[1] < 0.6) continue;
        const base = [dir[0] * HEAD.rx * 0.95, dir[1] * HEAD.ry * 0.95, dir[2] * HEAD.rz * 0.95];
        tufts.push(tuft(base, [dir[0] + 0.3 * Math.cos(a + 1), dir[1] + 0.4, dir[2]], 0.05 + R(i + 9) * 0.03, 0.022, 4, R(i + 3) * 3));
      }
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.022; tufts.push(tuft([x, HEAD.ry * 0.62, HEAD.rz * 0.55], [x * 2 + 0.2 * (i % 2 ? 1 : -1), -0.6, 0.6], 0.045, 0.018, 4, i)); }
      add(merge(tufts), 'hairTufts');
    } else if (st === 'bun') {
      add(hairShell((nx, ny, nz) => ny > -0.25 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.85 && ny < 0.2 && nz > -0.25), { thick: 0.01, chunk: 0.004, seed: 5 }));
      const bun = new THREE.SphereGeometry(0.045, 8, 6); bun.translate(0, HEAD.ry * 0.78, -HEAD.rz * 0.75); add(bun, 'bun');
      const tie = new THREE.TorusGeometry(0.03, 0.007, 4, 10); tie.rotateX(0.9); tie.translate(0, HEAD.ry * 0.7, -HEAD.rz * 0.68); add(tie, 'bunTie', mat('#7e2633'));
    } else if (st === 'short') {
      add(hairShell((nx, ny, nz) => ny > 0.05 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.35 && nz > -0.4), { thick: 0.008, chunk: 0.005, seed: 7 }));
    } else if (st === 'buzz') {
      add(hairShell((nx, ny, nz) => ny > 0.0 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.35 && nz > -0.4), { thick: 0.004, chunk: 0.002, seed: 8 }));
    } else if (st === 'shoulder') {
      add(hairShell((nx, ny, nz) => ny > -0.35 && notFace(nx, ny, nz), { thick: 0.014, chunk: 0.006, seed: 9 }));
      const g = loftY([
        { y: -0.17, w: HEAD.rx + 0.04, df: HEAD.rz * 0.25, db: HEAD.rz + 0.015 },
        { y: -0.09, w: HEAD.rx + 0.026, df: HEAD.rz * 0.3, db: HEAD.rz + 0.025 },
        { y: 0.0, w: HEAD.rx + 0.018, df: HEAD.rz * 0.35, db: HEAD.rz + 0.02 },
      ], 12, { capTop: false, capBottom: true });
      g.translate(0, -0.005, -0.012); add(g, 'hairCurtain');
    } else if (st === 'ponytail') {
      add(hairShell((nx, ny, nz) => ny > -0.25 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.85 && ny < 0.2 && nz > -0.25), { thick: 0.01, chunk: 0.003, seed: 11 }));
      const tie = new THREE.TorusGeometry(0.018, 0.006, 4, 8); tie.rotateX(1.2); tie.translate(0, HEAD.ry * 0.35, -HEAD.rz * 1.02); add(tie, 'tie', mat('#2aa39a'));
      const tail = new THREE.ConeGeometry(0.032, 0.17, 6); tail.rotateX(Math.PI + 0.35); tail.translate(0, HEAD.ry * 0.35 - 0.08, -HEAD.rz * 1.08 - 0.03); add(tail, 'ponytail');
    }
    if (spec.beard) {
      add(hairShell((nx, ny, nz) => ny < -0.12 && nz > -0.35 && !(nz > 0.75 && ny > -0.62 && Math.abs(nx) < 0.38), { thick: 0.011, chunk: 0.008, seed: 21 }), 'beard', M.beard);
      const mg = new THREE.BoxGeometry(0.06, 0.012, 0.016); mg.translate(0, -0.036, HEAD.rz * 0.93); add(mg, 'moustache', M.beard);
    }
  }

  defaults() {
    const s = SEATS[this.name];
    return {
      pos: s.pos.slice(), rotY: s.rotY, sit: 1, lean: 0, leanSide: 0, torsoYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null,
      eyes: 'open', pupils: [0, 0], brows: 'neutral', mouth: 'neutral', talk: 0, chewPh: 0,
      handL: null, handR: null, handPoseL: 'relaxed', handPoseR: 'relaxed', handRotL: null, handRotR: null, gripL: null, gripR: null,
      bounce: 0, bellyWobble: 0, legBounce: 0, visible: true, eat: null, shoulderUp: 0,
    };
  }

  _w(local, obj) { obj.updateMatrixWorld(true); return local.clone().applyMatrix4(obj.matrixWorld); }
  headPos() { return this._w(V(), this.head); }
  eyePos() { return this._w(this.eyeLocal, this.head); }
  mouthPos() { return this._w(this.mouthLocal, this.head); }
  glassesPos(side = 1) { return this.glassesPosLocal ? this._w(V(this.glassesPosLocal.x * side, this.glassesPosLocal.y, this.glassesPosLocal.z), this.head) : this.eyePos(); }
  chestPos() { return this._w(V(0, this.torsoH * 0.6, this.spec.chestD), this.chest); }
  bellyPos() { return this._w(V(0, this.torsoH * 0.22, this.bellyFront + 0.01), this.chest); }
  handPos(side = 'R') { const a = this.arms[side]; return this._w(V(0, a.H.L * 0.55, 0), a.H.grp); }
  seatPos() { return V(this.p.pos[0], CHAIR.seatY, this.p.pos[1]); }
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
  const p = ch.p, s = ch.s, spec = ch.spec;
  ch.root.visible = p.visible;
  if (!p.visible) return;
  ch.root.position.set(p.pos[0], 0, p.pos[1]);
  ch.root.rotation.set(0, p.rotY, 0);
  const sit = clamp(p.sit);
  const seatHip = CHAIR.seatY + ch.thighR * 0.92;
  const hipY = lerp(ch.hipStandY, seatHip, sit) + p.bounce * 0.012 * Math.abs(Math.sin(t * 19));
  ch.pelvis.position.set(0, hipY, lerp(0, 0.02, sit));
  ch.pelvis.rotation.set(0, p.torsoYaw * 0.3, 0);
  const breathe = Math.sin(t * 1.6 + hash1(s * 13) * 6) * 0.008;
  ch.chest.rotation.set(p.lean + (spec.hunch || 0) + breathe - p.bounce * 0.08 * (0.5 + 0.5 * Math.sin(t * 19)), p.torsoYaw * 0.7, p.leanSide, 'YXZ');
  ch.chest.scale.set(1, 1, 1 + p.bellyWobble * 0.06 * Math.sin(t * 23) + breathe * 0.4);
  ch.chest.position.y = 0.05 * s + p.shoulderUp * 0.02;
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
  ch.head.rotation.set(-pitch - p.bounce * 0.2, yaw, p.headRoll, 'YXZ');
  const faceTex = ch.faceSet(p.eyes, p.brows, p.mouth, p.talk, pdx, pdy, p.chewPh);
  if (ch.mats.face.map !== faceTex) { ch.mats.face.map = faceTex; ch.mats.face.needsUpdate = true; }
  ch.root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(ch.root.matrixWorld).invert();
  const rootQi = ch.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const fwdW = V(Math.sin(p.rotY), 0, Math.cos(p.rotY));

  // eating: fork travels plate -> mouth -> plate, the right hand grips it
  if (p.eat) {
    const e = p.eat, fork = e.fork, ph = e.phase;
    const mouth = ch.mouthPos();
    const k = ph < 0.2 ? 0 : ph < 0.5 ? smooth((ph - 0.2) / 0.3) : ph < 0.62 ? 1 : ph < 0.9 ? 1 - smooth((ph - 0.62) / 0.28) : 0;
    const tip = v3(e.from).lerp(mouth.clone().addScaledVector(fwdW, 0.03), k);
    if (ph < 0.2) tip.y += Math.sin((ph / 0.2) * Math.PI) * 0.012;
    const leftW = V(fwdW.z, 0, -fwdW.x); // character's left
    const atPlate = fwdW.clone().multiplyScalar(0.8).addScaledVector(leftW, 0.25).add(V(0, -0.5, 0)).normalize();
    const atMouth = fwdW.clone().multiplyScalar(-0.8).addScaledVector(leftW, 0.45).add(V(0, 0.2, 0)).normalize();
    const Z = atPlate.clone().lerp(atMouth, k).normalize();
    const up = V(0, 1, 0).addScaledVector(leftW, -0.3).normalize();
    const X = V().crossVectors(up, Z).normalize(), Y = V().crossVectors(Z, X);
    fork.quaternion.copy(basis(X, Y, Z));
    fork.position.copy(tip).sub(V(...fork.userData.tip).applyQuaternion(fork.quaternion));
    p.gripR = fork;
    if (ph > 0.4 && ph < 0.66) { p.mouth = 'open'; p.talk = 0; }
  }

  // reach: lean the torso forward when a target is too far
  const targetOf = (side) => {
    const g = side === 'L' ? p.gripL : p.gripR;
    if (g) return gripFrame(g).pos;
    const h = side === 'L' ? p.handL : p.handR; return h ? v3(h) : null;
  };
  let extra = 0;
  for (const side of ['L', 'R']) {
    const tw = targetOf(side); if (!tw) continue;
    const sh = ch.shoulderLocal[side].clone().applyMatrix4(ch.chest.matrixWorld);
    const dist = sh.distanceTo(tw), reach = (ch.armL[0] + ch.armL[1]) * 0.92 + 0.04 * s;
    const flat = tw.clone().sub(sh); flat.y = 0;
    if (dist > reach && flat.dot(fwdW) > 0) extra = Math.max(extra, clamp((dist - reach) / (ch.torsoH * 0.8), 0, 0.55));
  }
  if (extra > 0) { ch.chest.rotation.x += extra; ch.root.updateMatrixWorld(true); }

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
        else if (pose === 'flat') {
          const dir = T.clone().sub(shW); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.copy(fwdW); dir.normalize();
          const Z = V(0, 1, 0), Y = dir, X = V().crossVectors(Y, Z);
          handQ = basis(X, Y, Z);
        } else {
          const Y = T.clone().sub(shW).normalize();
          const out = pose === 'point' ? V(0, 1, 0) : V(fwdW.z, 0, -fwdW.x).multiplyScalar(sx).add(V(0, 0.8, 0)).normalize();
          const Z = out.addScaledVector(Y, -out.dot(Y)).normalize(); const X = V().crossVectors(Y, Z);
          handQ = basis(X, Y, Z);
        }
        const palmC = V(0, H.L * 0.5, pose === 'flat' ? -H.T / 2 : 0);
        wristW = T.clone().sub(palmC.applyQuaternion(handQ));
      } else if (sit > 0.5) { // seated rest: hands on the thighs, palms down
        wristW = V(sx * 0.1 * s, ch.pelvis.position.y + ch.thighR + 0.02, 0.17 * s + ch.pelvis.position.z).applyMatrix4(ch.root.matrixWorld);
        const Y = fwdW.clone(), Z = V(0, 1, 0), X = V().crossVectors(Y, Z);
        handQ = basis(X, Y, Z); pose = pose === 'relaxed' ? 'relaxed' : pose;
      } else { // standing rest: arms hang
        wristW = V(sx * (ch.shoulderW + 0.02), ch.pelvis.position.y - 0.07 * s, 0.03).applyMatrix4(ch.root.matrixWorld);
      }
    }
    const A = shW.clone().applyMatrix4(toLocal), Wl = wristW.clone().applyMatrix4(toLocal);
    const pole = A.clone().add(V(sx * 0.28, -1.0, -0.05));
    const { J, E } = ik3(A, Wl, ch.armL[0], ch.armL[1], pole);
    placeBone(a.up, A, J); placeBone(a.lo, J, E);
    if (a.cuff) { const d = E.clone().sub(J).normalize(); placeBone(a.cuff, E.clone().addScaledVector(d, -0.03 * s), E.clone().addScaledVector(d, 0.006)); }
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
    const bounce = p.legBounce * Math.max(0, Math.sin(t * 18 + (sx > 0 ? 0 : 1.5))) * 0.035;
    let J, E;
    if (sit > 0.5) {
      const knee = V(hip.x + sx * 0.01, hip.y - 0.025 + bounce, hip.z + ch.legL[0] * 0.98);
      const ankle = V(sx * (ch.hipW + 0.02), ch.ankleH, knee.z + 0.05 * s);
      const d = ankle.clone().sub(knee); const len = d.length();
      J = knee; E = knee.clone().add(d.normalize().multiplyScalar(Math.min(len, ch.legL[1])));
    } else {
      ({ J, E } = ik3(hip, V(sx * (ch.hipW + 0.01), ch.ankleH, 0.02), ch.legL[0], ch.legL[1], hip.clone().add(V(0, -0.3, 1))));
    }
    placeBone(L.th, hip, J); placeBone(L.sh, J, E);
    L.shoe.position.copy(E); L.shoe.rotation.set(0, 0, 0);
  }
}

// ------------------------------------------------------------------ cast
export function buildCast(world) {
  const chars = {};
  for (const [name, spec] of Object.entries(SPECS)) chars[name] = new Character(name, spec, world);
  const list = Object.values(chars);

  const helpers = {
    // one bite cycle; phase 0..1 (0-0.2 scoop, 0.2-0.5 raise, 0.5-0.62 bite, 0.62-0.9 lower)
    eat(ch, phase, opts = {}) {
      const place = world.set?.props?.places?.[ch.name];
      const fork = opts.fork || place?.fork;
      if (!fork || !fork.userData.tip) return;
      const s = SEATS[ch.name];
      const toward = s.rotY === 0 ? -1 : s.rotY === Math.PI ? 1 : 0;
      const from = opts.from || [s.plate[0] + (s.rotY === -Math.PI / 2 ? 0.03 : 0.0), TABLE.topY + 0.03, s.plate[1] + toward * 0.03];
      ch.p.eat = { phase: clamp(phase), fork, from };
      if (phase > 0.66) helpers.chew(ch, phase * 6);
    },
    chew(ch, t) { ch.p.mouth = 'chew'; ch.p.chewPh = Math.floor(t * 7) % 2; },
    talk(ch, t, intensity = 1) {
      const v = Math.max(0, noise1(t * 9, ch.s * 31) * 0.6 + noise1(t * 17, ch.s * 7) * 0.5 + 0.25);
      ch.p.talk = clamp(v * intensity);
    },
    laugh(ch, t, amount = 1) {
      ch.p.bounce = amount; ch.p.mouth = 'laugh'; ch.p.eyes = 'happy'; ch.p.brows = 'raised';
      ch.p.talk = clamp(0.5 + 0.5 * Math.sin(t * 19)) * amount;
      ch.p.headPitch += 0.15 * amount;
    },
    blink(ch, t) {
      const per = 2.6 + hash1(ch.s * 77) * 2.4, ph = ((t + hash1(ch.s * 13) * per) % per) / per;
      if (ph > 0.965) ch.p.eyes = 'closed';
    },
  };

  function reset(t) {
    for (const ch of list) { ch.p = ch.defaults(); helpers.blink(ch, t); }
    const you = chars.you, g = chars.grandma;
    you.p.brows = 'worried'; you.p.mouth = 'tight';
    const eaters = ['mom', 'uncle', 'dad', 'cousinA', 'cousinB'];
    const quiet = t >= 40.38;
    if (!quiet) eaters.forEach((n, i) => {
      const ch = chars[n];
      const per = 4.2 + i * 0.7, ph = ((t + i * 1.37) % per) / per;
      if (ph < 0.62) helpers.eat(ch, (ph / 0.62) * 0.9);
      else { ch.p.headYaw = i % 2 ? 0.45 : -0.45; ch.p.mouth = 'smile'; helpers.talk(ch, t, 0.8); }
    });
    if (t < 9.72) {
      const ph = ((t + 2.2) % 5.0) / 5.0;
      if (ph < 0.6) helpers.eat(g, (ph / 0.6) * 0.9); else { g.p.headYaw = -0.4; g.p.mouth = 'smile'; }
    } else {
      g.p.sit = 0; g.p.pos = GRANDMA_STAND.pos.slice(); g.p.rotY = GRANDMA_STAND.rotY; g.p.mouth = 'smile';
    }
    if (quiet) for (const n of [...eaters, 'grandma']) { const ch = chars[n]; ch.p.lookAt = [0, 1.17, -0.93]; ch.p.mouth = 'neutral'; }
  }

  function commit(ctx) { for (const ch of list) solve(ch, ctx.t); }

  return { characters: list, ...chars, reset, commit, helpers, SPECS };
}
