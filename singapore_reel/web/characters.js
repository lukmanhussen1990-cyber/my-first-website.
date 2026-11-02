// The 7 low-poly people: rig, faces, poses, holding props, idle life + story continuity. API: CONTRACTS.md.
import * as THREE from 'three';
import { mat, clamp, lerp, smooth, hash1, noise1, ik3, placeBone, v3, chamferBox } from './lib.js';
import { SPOTS, STREET } from './layout.js';
const CHAIR = { seatY: 0.46 };
import { loftY, limbGeo, headGeo, noseGeo, earGeo, hairShell, tuft, buildHand, poseHand, gripPoint, shoeGeo, soleGeo, glassesGeo, lensGeo, frontZ, merge, HEAD } from './char_geo.js';
import { fabricTex, torsoTex, makeFaceSet, skinTex, sleeveSplitTex } from './char_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ cast specs
const SPECS = {
  you: { H: 1.74, skin: '#e9b993', hair: '#5b3a20', hairStyle: 'messy', torso: { style: 'tshirt', main: '#f2c230' }, sleeve: ['cotton', { color: '#f2c230', seed: 11, amount: 9 }],
    pants: ['cotton', { color: '#c8b48a', seed: 4, amount: 10 }], shorts: true, shoe: '#f2f2ee', shoulder: 0.18, waist: 0.135, chestD: 0.1, belly: 0, female: false, shortSleeve: true, extras: ['backpack', 'camera'],
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 3, brow: '#4a2e1a' } },
  officer: { H: 1.9, skin: '#c99068', hair: '#1e1612', hairStyle: 'short', torso: { style: 'uniform', main: '#22324f' }, sleeve: ['cotton', { color: '#22324f', seed: 13, amount: 7 }],
    pants: ['cotton', { color: '#1d2b44', seed: 6, amount: 7 }], shoe: '#141416', shoeKind: 'boot', shoeShiny: true, shoulder: 0.215, waist: 0.16, chestD: 0.115, belly: 0, female: false, shortSleeve: true, extras: ['cap'],
    face: { eyeW: 8, eyeH: 9, mouthW: 1.0, seed: 7, brow: '#120c0a', browT: 4 } },
  man: { H: 1.77, skin: '#e2ae88', hair: '#3a2a1e', hairStyle: 'short', torso: { style: 'shirtTie', main: '#f2f2ee', accent: '#2d4f9a' }, sleeve: ['cotton', { color: '#f2f2ee', seed: 15, amount: 6 }],
    pants: ['cotton', { color: '#5b5f66', seed: 10, amount: 8 }], shoe: '#1a1a1a', shoulder: 0.2, waist: 0.15, chestD: 0.105, belly: 0.1, female: false,
    face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 11, brow: '#2a1a10' } },
  lady: { H: 1.62, skin: '#d8a07a', hair: '#24160e', hairStyle: 'shoulder', torso: { style: 'blouse', main: '#3f9a5a' }, sleeve: ['cotton', { color: '#3f9a5a', seed: 14, amount: 8 }],
    pants: ['cotton', { color: '#2f2f3f', seed: 8, amount: 8 }], skirt: '#2f2f3f', shoe: '#7a3a2a', shoulder: 0.16, waist: 0.135, chestD: 0.1, belly: 0.15, female: true,
    face: { eyeW: 7, eyeH: 11, mouthW: 0.9, seed: 9, brow: '#24160e', blush: '#e08a80', lash: true } },
  kid: { H: 1.16, skin: '#e9b896', hair: '#4a2e1a', hairStyle: 'buzz', torso: { style: 'stripes', main: '#d8282a', accent: '#f6f4ee' }, sleeve: ['cotton', { color: '#d8282a', seed: 17, amount: 8 }],
    pants: ['cotton', { color: '#3a5a9a', seed: 14, amount: 8 }], shorts: true, shoe: '#d03a2a', shoulder: 0.125, waist: 0.105, chestD: 0.075, belly: 0.1, female: false, kid: true, shortSleeve: true,
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 15, brow: '#2a1a10', freckles: true } },
};
const EXTRA_LOOKS = [
  { H: 1.7, skin: '#c98d66', hair: '#1a1a1a', hairStyle: 'short', torso: { style: 'tshirt', main: '#3a7ac0' }, pants: ['denim', { color: '#33507a', seed: 3 }], female: false, shoulder: 0.19 },
  { H: 1.6, skin: '#f0c8a8', hair: '#8a5a2a', hairStyle: 'ponytail', torso: { style: 'tshirt', main: '#e07aa0' }, pants: ['cotton', { color: '#f0eee8', seed: 5, amount: 6 }], female: true, shoulder: 0.15 },
  { H: 1.78, skin: '#8a5a3a', hair: '#141010', hairStyle: 'buzz', torso: { style: 'tshirt', main: '#2a2a2e' }, pants: ['cotton', { color: '#8a7a5a', seed: 7, amount: 8 }], female: false, shoulder: 0.2 },
  { H: 1.66, skin: '#e8c09a', hair: '#d8c070', hairStyle: 'shoulder', torso: { style: 'blouse', main: '#d84a3a' }, pants: ['denim', { color: '#2c3a58', seed: 8 }], female: true, shoulder: 0.155 },
  { H: 1.72, skin: '#dca37c', hair: '#3a2a1e', hairStyle: 'short', torso: { style: 'shirtTie', main: '#cfe0f0', accent: '#8a2a2a' }, pants: ['cotton', { color: '#3a3f4a', seed: 9, amount: 7 }], female: false, shoulder: 0.19 },
];
for (const [i, L] of EXTRA_LOOKS.entries()) SPECS['extra' + i] = { waist: L.female ? 0.13 : 0.15, chestD: 0.1, belly: 0.05, shoe: '#2a2a2a', sleeve: ['cotton', { color: L.torso.main, seed: 30 + i, amount: 8 }], shortSleeve: true, face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 40 + i, brow: '#2a1a10', lash: L.female }, ...L };


const basis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

// ------------------------------------------------------------------ a character
class Character {
  constructor(name, spec, world, spot = null) {
    this.name = name; this.spec = spec; this.world = world; this.spot = spot;
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
    M.shoe = spec.shoeShiny ? mat(spec.shoe, { rough: 0.12, metal: 0.6 }) : m(fabricTex('cotton', { color: spec.shoe, amount: 8, seed: 3 }));
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
    if (spec.extras?.includes('backpack')) {
      const bp = this.mk(chamferBox(0.3 * s, 0.38 * s, 0.15 * s, 0.03), mat('#2f5fa8', { rough: 0.7 }), 'backpack', this.chest); bp.position.set(0, T * 0.55, -cd - 0.085 * s);
      const pk = this.mk(chamferBox(0.2 * s, 0.12 * s, 0.05 * s, 0.015), mat('#264f8c', { rough: 0.7 }), 'backpackPocket', this.chest); pk.position.set(0, T * 0.4, -cd - 0.17 * s);
      for (const sd of [-1, 1]) { const st = this.mk(new THREE.BoxGeometry(0.035 * s, 0.32 * s, 0.012), mat('#1f3f78'), 'strap', this.chest); st.position.set(sd * 0.1 * s, T * 0.72, cd * 0.86 + 0.01); st.rotation.x = -0.08; }
    }
    if (spec.extras?.includes('camera')) {
      const cam = this.mk(chamferBox(0.11 * s, 0.07 * s, 0.05 * s, 0.01), mat('#1c1c20', { rough: 0.4 }), 'camera', this.chest); cam.position.set(0.02, T * 0.6, cd + 0.04 * s);
      const lens = this.mk(new THREE.CylinderGeometry(0.022 * s, 0.024 * s, 0.035 * s, 10), mat('#2a2a30', { rough: 0.2, metal: 0.5 }), 'lens', this.chest); lens.rotation.x = Math.PI / 2; lens.position.set(0.02, T * 0.6, cd + 0.08 * s);
      for (const sd of [-1, 1]) { const st = this.mk(new THREE.BoxGeometry(0.01, 0.2 * s, 0.006), mat('#111'), 'camStrap', this.chest); st.position.set(sd * 0.055 * s, T * 0.77, cd * 0.86 + 0.012); st.rotation.z = -sd * 0.25; }
    }
    if (spec.skirt) {
      const sk = this.mk(new THREE.CylinderGeometry(wa * 1.05, wa * 1.6, 0.42 * s, 12, 1, true), mat(spec.skirt, { rough: 0.8, side: THREE.DoubleSide }), 'skirt', this.pelvis); sk.scale.z = 0.8; sk.position.y = -0.16 * s;
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
    if (spec.extras?.includes('cap')) {
      const capM = mat('#1d2b44', { rough: 0.6 }), brimM = mat('#0e0e10', { rough: 0.25, metal: 0.3 });
      const crown = this.mk(new THREE.CylinderGeometry(HEAD.rx * 1.25 * hs, HEAD.rx * 1.08 * hs, 0.075 * hs, 14), capM, 'cap', this.head); crown.scale.z = 1.12; crown.position.set(0, HEAD.ry * 0.78 * hs, -0.004);
      const band = this.mk(new THREE.CylinderGeometry(HEAD.rx * 1.1 * hs, HEAD.rx * 1.1 * hs, 0.022 * hs, 14), brimM, 'capBand', this.head); band.scale.z = 1.12; band.position.set(0, HEAD.ry * 0.62 * hs, -0.004);
      const brim = this.mk(new THREE.CylinderGeometry(HEAD.rx * 0.95 * hs, HEAD.rx * 0.95 * hs, 0.008, 12, 1, false, -Math.PI / 2, Math.PI), brimM, 'capBrim', this.head); brim.position.set(0, HEAD.ry * 0.58 * hs, HEAD.rz * 0.72 * hs); brim.rotation.x = 0.28;
      const badge = this.mk(new THREE.CircleGeometry(0.014, 8), mat('#d8b850', { metal: 0.7, rough: 0.3 }), 'capBadge', this.head); badge.position.set(0, HEAD.ry * 0.8 * hs, HEAD.rz * 1.17 * hs + 0.002); badge.rotation.x = -0.12;
    }
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
      const sh = this.mk(limbGeo(1, 0.05 * s, 0.04 * s, 8), spec.shorts || spec.skirt ? M.skin : M.pants, `shin${side}`);
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
    const s = SPOTS[this.name] || { pos: [this.spot[0], this.spot[1]], rotY: this.spot[2] };
    return {
      pos: s.pos.slice(), rotY: s.rotY || 0, sit: 0, y: STREET.curb, footL: null, footR: null, walkPhase: null, stride: 0.6, lean: 0, leanSide: 0, torsoYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null,
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
  ch.root.position.set(p.pos[0], p.y ?? 0, p.pos[1]);
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
    if (dist > reach && flat.dot(fwdW) > 0) extra = Math.max(extra, clamp((dist - reach) / (ch.torsoH * 0.8), 0, 0.42));
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
          // resting on a surface: fingertips touch, the wrist is lifted (a forearm is thicker than a hand)
          const dir = T.clone().sub(shW); dir.y = 0; if (dir.lengthSq() < 1e-6) dir.copy(fwdW); dir.normalize();
          const a = 0.27, ca = Math.cos(a), sa = Math.sin(a);
          const Y = dir.clone().multiplyScalar(ca).add(V(0, -sa, 0)), Z = V(0, ca, 0).addScaledVector(dir, sa), X = V().crossVectors(Y, Z);
          handQ = basis(X, Y, Z);
          T.y += 0.0035 + 0.13 * s * sa;
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
    let ankle = V(sx * (ch.hipW + 0.01), ch.ankleH, 0.02), pitch = 0;
    if (p.walkPhase != null) { // walk cycle: feet swing forward/back, lift on the swing
      const q = (p.walkPhase + (sx > 0 ? 0 : 0.5)) % 1, st = p.stride * s;
      if (q < 0.5) { ankle.z += st * (0.5 - q * 2) * 0.5; }
      else { const u = (q - 0.5) * 2; ankle.z += st * (-0.5 + u) * 0.5; ankle.y += Math.sin(u * Math.PI) * 0.1 * s; pitch = Math.sin(u * Math.PI) * 0.35; }
    }
    const lift = side === 'L' ? p.liftL : p.liftR;            // optional foot lift (m) for a stomp in place
    if (lift) { ankle.y += lift * s; ankle.z += lift * 0.4 * s; pitch = -lift * 1.5; }
    const ft = side === 'L' ? p.footL : p.footR;
    if (ft) { ankle = v3(ft).applyMatrix4(toLocal); ankle.y = Math.max(ankle.y, ch.ankleH); }
    const { J, E } = ik3(hip, ankle, ch.legL[0], ch.legL[1], hip.clone().add(V(0, -0.3, 1)));
    placeBone(L.th, hip, J); placeBone(L.sh, J, E);
    L.shoe.position.copy(E); L.shoe.rotation.set(pitch, 0, 0);
  }
  if (p.walkPhase != null) ch.pelvis.position.y += Math.abs(Math.sin(p.walkPhase * Math.PI * 2)) * 0.02 - 0.015;
}

// ------------------------------------------------------------------ cast
export function buildCast(world) {
  const chars = {};
  for (const [name, spec] of Object.entries(SPECS)) {
    const ch = new Character(name, spec, world, name.startsWith('extra') ? SPOTS.extras[Number(name.slice(5))] : null);
    chars[name] = ch;
  }
  const list = Object.values(chars);

  const helpers = {
    talk(ch, t, intensity = 1) {
      const v = Math.max(0, noise1(t * 9, ch.s * 31) * 0.6 + noise1(t * 17, ch.s * 7) * 0.5 + 0.25);
      ch.p.talk = clamp(v * intensity);
    },
    blink(ch, t) {
      const per = 2.6 + hash1(ch.s * 77) * 2.4, ph = ((t + hash1(ch.s * 13) * per) % per) / per;
      if (ph > 0.965) ch.p.eyes = 'closed';
    },
    // walk from a to b ([x,z]) between t0 and t1; stride in metres
    walk(ch, a, b, t0, t1, t, stride = 0.75) {
      const u = clamp((t - t0) / (t1 - t0));
      ch.p.pos = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
      ch.p.rotY = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const dist = Math.hypot(b[0] - a[0], b[1] - a[1]) * u;
      if (u < 1) { ch.p.walkPhase = (dist / (stride * 2)) % 1; ch.p.stride = stride * (1 - smooth(clamp((u - 0.8) / 0.2))); } // last steps shrink: feet end together
    },
  };

  function reset(t) {
    for (const ch of list) { ch.p = ch.defaults(); helpers.blink(ch, t); }
    const you = chars.you, off = chars.officer;
    you.p.brows = 'worried'; you.p.mouth = 'tight'; you.p.eyes = 'wide';
    // the officer appears with the footsteps, walks straight at YOU (3 heavy steps, 16.55-17.9; the last one shrinks so
    // his feet end together) and is standing at his spot, facing YOU, before the s13 cut (18.05)
    off.p.visible = t >= 16.55; off.p.brows = 'angry'; off.p.mouth = 'tight';
    if (t < 17.9) helpers.walk(off, SPOTS.officerStart.pos, SPOTS.officer.pos, 16.55, 17.9, t, 0.667);
    // everybody else stares at YOU once they notice (8.45 s)
    for (const n of ['man', 'lady', 'kid', 'extra0', 'extra1', 'extra2', 'extra3', 'extra4']) {
      const ch = chars[n];
      if (t >= 8.45) { ch.p.lookAt = [-2.0, 1.55, 0.0]; ch.p.mouth = 'o'; ch.p.eyes = 'wide'; }
    }
  }

  function commit(ctx) { for (const ch of list) solve(ch, ctx.t); }

  return { characters: list, ...chars, reset, commit, helpers, SPECS };
}
