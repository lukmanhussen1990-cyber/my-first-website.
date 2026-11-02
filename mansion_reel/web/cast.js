// The people of the mansion reel: YOU (homeless: beanie + patched coat; later soaking wet; at the end a gold
// bathrobe), the rich guy (gold bathrobe), 3 shopkeepers. Rig ported from thanksgiving_reel/characters.js + the
// bear reel's YOU (faces, cheeks, tongue, red face). Everything is a pure function of p + t (no frame state).
import * as THREE from 'three';
import { mat, clamp, lerp, smooth, hash1, noise1, ik3, placeBone, v3 } from './lib.js';
import { STREET, PORCH_SPOT, DOORWAY_SPOT } from './layout.js';
import { loftY, limbGeo, headGeo, noseGeo, earGeo, hairShell, tuft, buildHand, poseHand, gripPoint, shoeGeo, soleGeo, frontZ, merge, HEAD } from './char_geo.js';
import { fabricTex, torsoTex, makeFaceSet, skinTex, robeSkirtTex, coatSkirtTex } from './char_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const basis = (X, Y, Z) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z));

const YOU_BODY = { H: 1.72, skin: '#a8714a', hair: '#3a2416', shoulder: 0.185, waist: 0.14, chestD: 0.105, belly: 0 };
const SPECS = {
  you: { ...YOU_BODY, hairStyle: 'messy', hat: 'beanie', hatColor: '#3e6b4a',
    torso: { style: 'coat', main: '#6e5a3c', inner: '#8f8b7c', patch1: '#7a3428', patch2: '#3d4c6e' }, sleeve: ['worn', { color: '#6e5a3c', seed: 11 }],
    pants: ['denim', { color: '#3a4050', seed: 4 }], shoe: '#4a3a2a', shoeKind: 'boot', coatSkirt: true,
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 3, brow: '#24150c', blush: '#d65a5a', stubble: '#2a1a10', dirt: true } },
  youRobe: { ...YOU_BODY, hairStyle: 'messy',
    torso: { style: 'robe', main: '#f0c43a', trim: '#c08a24', skin: '#a8714a' }, sleeve: ['terry', { color: '#f0c43a', seed: 12 }],
    pants: ['cotton', { color: '#a8714a', seed: 4 }], shoe: '#f6d564', robe: true, slippers: true,
    face: { eyeW: 8, eyeH: 12, mouthW: 1, seed: 3, brow: '#24150c', blush: '#d65a5a', stubble: '#2a1a10' } },
  rich: { H: 1.8, skin: '#e0a982', hair: '#1e1612', hairStyle: 'slick', moustache: 'handlebar', mColor: '#1e1612', belly: 0.55,
    torso: { style: 'robe', main: '#f2c534', trim: '#c08a24', skin: '#e0a982', mono: true }, sleeve: ['terry', { color: '#f2c534', seed: 13 }],
    pants: ['cotton', { color: '#e0a982', seed: 8 }], shoe: '#f0c850', robe: true, slippers: true, shoulder: 0.205, waist: 0.17, chestD: 0.12,
    face: { eyeW: 7, eyeH: 10, mouthW: 1.1, seed: 7, brow: '#1a120c', browT: 4, blush: '#e07a6a' } },
  cafe: { H: 1.74, skin: '#d9a27a', hair: '#5a4030', hairStyle: 'bald', moustache: 'thick', mColor: '#4a3020', belly: 0.75,
    torso: { style: 'apron', main: '#3d5f9a', stripe: '#e8eef6', apron: '#f4f2ec' }, sleeve: ['stripes', { color: '#3d5f9a', color2: '#e8eef6', seed: 14, period: 6 }],
    pants: ['cotton', { color: '#2d2d33', seed: 9 }], shoe: '#2a2220', shoeKind: 'boot', apronSkirt: '#f4f2ec', shoulder: 0.2, waist: 0.18, chestD: 0.12,
    face: { eyeW: 7, eyeH: 10, mouthW: 1, seed: 9, brow: '#3a2416', browT: 4 } },
  chef: { H: 1.7, skin: '#c68a62', hair: '#2a1a12', hairStyle: 'short', hat: 'chef', moustache: 'thin', mColor: '#2a1a12', belly: 0.3,
    torso: { style: 'chef', main: '#f2f0ea' }, sleeve: ['cotton', { color: '#f2f0ea', seed: 15, amount: 7 }],
    pants: ['plaid', { color: '#e8e8e8', color2: '#2a2a2a', seed: 5, period: 4 }], shoe: '#222222', shoulder: 0.19, waist: 0.15, chestD: 0.11,
    face: { eyeW: 7, eyeH: 11, mouthW: 1, seed: 11, brow: '#2a1a12' } },
  clerk: { H: 1.68, skin: '#8a5a3a', hair: '#1a120c', hairStyle: 'short', hat: 'cap', hatColor: '#c8262a', belly: 0.1,
    torso: { style: 'polo', main: '#c8262a' }, sleeve: ['cotton', { color: '#c8262a', seed: 16 }],
    pants: ['cotton', { color: '#3a3530', seed: 10 }], shoe: '#f0f0ea', shoulder: 0.18, waist: 0.14, chestD: 0.1,
    face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 13, brow: '#1a120c' } },
};

// where each person stands by default (shots move them)
const HOME = {
  you: { pos: STREET.sit.pos, rotY: STREET.sit.rotY, y: STREET.sideY },
  youRobe: { pos: [0, 0], rotY: 0, y: 0 },
  rich: { pos: DOORWAY_SPOT.pos, rotY: DOORWAY_SPOT.rotY, y: 1.2 },
  cafe: { pos: [STREET.shops[0].x + 0.7, -0.4], rotY: Math.PI, y: STREET.sideY },
  chef: { pos: [STREET.shops[1].x + 0.7, -0.4], rotY: Math.PI, y: STREET.sideY },
  clerk: { pos: [STREET.shops[2].x + 0.7, -0.4], rotY: Math.PI, y: STREET.sideY },
};

class Character {
  constructor(name, spec, world) {
    this.name = name; this.spec = spec; this.world = world;
    const s = (this.s = spec.H / 1.75);
    this.root = new THREE.Group(); this.root.name = name;
    world.scene.add(this.root);
    this.headScale = 1.0;
    this.headRadius = HEAD.ry;
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
    if (spec.robe) { M.torso.roughness = 0.5; M.torso.metalness = 0.12; }
    M.sleeve = m(fabricTex(spec.sleeve[0], spec.sleeve[1], 32, [2, 2]));
    if (spec.robe) { M.sleeve.roughness = 0.5; M.sleeve.metalness = 0.12; }
    M.pants = m(fabricTex(spec.pants[0], spec.pants[1], 32, [2, 3]));
    M.shoe = m(fabricTex(spec.slippers ? 'terry' : 'cotton', { color: spec.shoe, amount: 8, seed: 3 }));
    M.sole = mat(spec.slippers ? spec.shoe : '#e8e4dc', { rough: 0.9 });
    M.hair = m(fabricTex('cotton', { color: spec.hair, amount: 16, seed: 5 }));
    if (spec.hairStyle === 'slick') { M.hair.roughness = 0.38; M.hair.metalness = 0.05; }
    M.must = spec.moustache ? m(fabricTex('cotton', { color: spec.mColor, amount: 14, seed: 6 })) : null;
    M.tongue = mat('#c2505c', { rough: 0.5 });
    if (spec.hat === 'beanie') M.hat = m(fabricTex('knit', { color: spec.hatColor, seed: 31 }, 32, [3, 2]));
    if (spec.hat === 'cap') M.hat = m(fabricTex('cotton', { color: spec.hatColor, amount: 10, seed: 32 }));
    if (spec.hat === 'chef') M.hat = m(fabricTex('cotton', { color: '#f6f5f0', amount: 6, seed: 33 }));
    this.faceSet = makeFaceSet({ skin: spec.skin, ...spec.face });
    M.face = mat(this.faceSet('open', 'neutral', 'neutral', 0, 0, 0, 0), { rough: 0.85 });
    M.face.emissive = new THREE.Color(spec.skin).multiplyScalar(0.1);
    // base colours (wet = darker cloth, shiny hair)
    this.dry = {};
    for (const k of ['torso', 'sleeve', 'pants', 'hair', 'hat', 'shoe']) if (M[k]) this.dry[k] = { c: M[k].color.clone(), r: M[k].roughness };
    this.build();
    this.p = this.defaults();
  }

  mk(geo, material, part, parent) {
    const me = new THREE.Mesh(geo, material); me.castShadow = true; me.receiveShadow = true; me.name = `${this.name}.${part}`;
    (parent || this.root).add(me); return me;
  }

  build() {
    const { spec, s, mats: M } = this;
    const sw = this.shoulderW, wa = spec.waist, cd = spec.chestD, b = spec.belly;
    this.pelvis = new THREE.Group(); this.root.add(this.pelvis);
    const hipW = Math.max(wa + 0.01, 0.15 * s);
    this.mk(loftY([{ y: -0.064 * s, w: hipW * 0.86, d: cd * 0.88 }, { y: -0.02 * s, w: hipW, d: cd * 0.95 + b * 0.03 }, { y: 0.06 * s, w: wa * 1.02, d: cd * 0.92 + b * 0.05 }], 10),
      spec.robe ? M.torso : M.pants, 'hips', this.pelvis);
    this.chest = new THREE.Group(); this.chest.position.y = 0.05 * s; this.pelvis.add(this.chest);
    const T = this.torsoH;
    const rings = [
      { y: 0.0, w: wa + 0.008, df: cd * 0.98 + b * 0.06, db: cd * 0.88 },
      { y: T * 0.22, w: wa + 0.02 + b * 0.05, df: cd + 0.006 + b * 0.15, db: cd * 0.9 },
      { y: T * 0.48, w: sw * 0.9 + b * 0.03, df: cd + 0.008 + b * 0.06, db: cd * 0.96 },
      { y: T * 0.78, w: sw * 0.98, df: cd * 0.96, db: cd * 0.96 },
      { y: T * 0.92, w: sw * 0.9, df: cd * 0.8, db: cd * 0.82 },
      { y: T * 1.0, w: 0.065 * s + 0.012, df: 0.052 * s, db: 0.052 * s },
    ];
    this.torso = this.mk(loftY(rings, 12, { n: 2.3 }), M.torso, 'torso', this.chest);
    this.bellyFront = cd + b * 0.15;
    const trimM = spec.torso.trim ? mat(fabricTex('terry', { color: spec.torso.trim, seed: 41 })) : null;
    if (spec.robe) {
      // shawl collar rolled around the back of the neck + belt with a knot
      const fz = (y) => (y < T * 0.3 ? cd + b * 0.12 : cd + b * 0.05) + 0.012;
      const path = new THREE.CatmullRomCurve3([
        V(-0.012, T * 0.36, fz(T * 0.36)), V(-0.04, T * 0.62, fz(T * 0.62) - 0.004), V(-0.066, T * 0.86, cd * 0.62), V(-0.07, T * 0.98, 0.0),
        V(0, T * 1.02, -0.06 * s), V(0.07, T * 0.98, 0.0), V(0.066, T * 0.86, cd * 0.62), V(0.04, T * 0.62, fz(T * 0.62) - 0.004), V(0.012, T * 0.36, fz(T * 0.36)),
      ]);
      const col = this.mk(new THREE.TubeGeometry(path, 40, 0.022 * s, 6, false), trimM, 'collar', this.chest);
      col.scale.set(1, 1, 1);
      const belt = this.mk(new THREE.TorusGeometry(1, 0.016 / (wa + 0.03), 4, 14), trimM, 'belt', this.chest);
      belt.scale.set(wa + 0.03 + b * 0.04, (cd + b * 0.1) * 1.05, wa + 0.03); belt.rotation.x = Math.PI / 2; belt.position.y = T * 0.12;
      const knot = this.mk(new THREE.BoxGeometry(0.05 * s, 0.035 * s, 0.03 * s), trimM, 'knot', this.chest);
      knot.position.set(0, T * 0.12, cd + b * 0.12 + 0.015);
      for (const sd of [-1, 1]) {
        const tail = this.mk(new THREE.BoxGeometry(0.02 * s, 0.16 * s, 0.012 * s), trimM, 'beltTail', this.chest);
        tail.position.set(sd * 0.018 * s, T * 0.12 - 0.08 * s, cd + b * 0.12 + 0.02); tail.rotation.z = sd * 0.15;
      }
      // the robe skirt: hips to just below the knees, slightly flared
      const L0 = this.legL[0];
      this.skirt = this.mk(loftY([
        { y: -L0 * 1.12, w: wa + 0.1 + b * 0.05, df: cd + 0.1 + b * 0.08, db: cd + 0.09 },
        { y: -L0 * 0.6, w: wa + 0.075 + b * 0.05, df: cd + 0.07 + b * 0.1, db: cd + 0.065 },
        { y: -0.02 * s, w: wa + 0.04 + b * 0.04, df: cd + 0.03 + b * 0.1, db: cd + 0.02 },
        { y: 0.07 * s, w: wa + 0.02 + b * 0.04, df: cd + 0.015 + b * 0.08, db: cd },
      ], 12, { n: 2.2, capBottom: false }), M.torso, 'robeSkirt', this.pelvis);
      this.skirt.material = mat(robeSkirtTex(spec.torso), { rough: 0.5, metal: 0.12, side: THREE.DoubleSide });
    }
    if (spec.coatSkirt) {
      this.skirt = this.mk(loftY([
        { y: -0.24 * s, w: wa + 0.07, df: cd + 0.06, db: cd + 0.07 },
        { y: -0.02 * s, w: wa + 0.045, df: cd + 0.03, db: cd + 0.035 },
        { y: 0.07 * s, w: wa + 0.025, df: cd + 0.012, db: cd + 0.01 },
      ], 12, { n: 2.2, capBottom: false }), M.torso, 'coatSkirt', this.pelvis);
      this.skirt.material = mat(coatSkirtTex(spec.torso), { rough: 0.85, side: THREE.DoubleSide });
    }
    if (spec.apronSkirt) {
      const ag = new THREE.PlaneGeometry(0.32 * s, 0.5 * s, 1, 3); ag.translate(0, -0.2 * s, 0);
      const ap = this.mk(ag, mat(fabricTex('cotton', { color: spec.apronSkirt, amount: 6, seed: 27 }), { side: THREE.DoubleSide }), 'apronSkirt', this.pelvis);
      ap.position.set(0, 0.05 * s, cd + b * 0.1 + 0.02); ap.rotation.x = -0.12;
      this.apron = ap;
    }
    this.mk(limbGeo(0.12 * s, 0.05 * s, 0.045 * s, 8), M.skin, 'neck', this.chest).position.set(0, T * 0.96, 0);
    this.head = new THREE.Group(); this.head.position.set(0, T * 0.96 + 0.06 * s + HEAD.ry * 0.82, 0.012 * s); this.chest.add(this.head);
    const hg = headGeo({ jaw: b > 0.6 ? 0.2 : 0.3, wide: b > 0.6 ? 1.05 : 1 });
    this.headMesh = this.mk(hg, [M.skin, M.face], 'head', this.head);
    const nz = frontZ(hg, 0, -0.022);
    const nose = this.mk(noseGeo({ len: 0.022 * (spec.moustache ? 1.15 : 1), w: 0.013, top: 0.01, bot: -0.03 }), M.skin, 'nose', this.head); nose.position.set(0, -0.004, nz - 0.003);
    for (const sd of [-1, 1]) { const e = this.mk(earGeo(sd), M.skin, 'ear', this.head); e.position.set(sd * HEAD.rx * 0.98, -0.008, -0.005); }
    this.buildHair(hg);
    this.buildHat();
    if (this.name === 'you') this.buildAccessories(T);
    if (spec.moustache) this.buildMoustache(hg);
    this.cheeks = [-1, 1].map((sd) => {
      const c = this.mk(new THREE.IcosahedronGeometry(1, 1), M.skin, 'cheek', this.head);
      c.position.set(sd * 0.042, -0.042, frontZ(hg, sd * 0.042, -0.042) - 0.02); c.userData.sd = sd; return c;
    });
    this.cheekZ = [-1, 1].map((sd) => frontZ(hg, sd * 0.046, -0.042));
    const tg = new THREE.BoxGeometry(0.026, 0.008, 0.04); tg.translate(0, 0, 0.02);
    this.tongue = this.mk(tg, M.tongue, 'tongue', this.head);
    this.tongue.position.set(0, -0.058, frontZ(hg, 0, -0.056) - 0.012);
    this.mouthLocal = V(0, -0.05, frontZ(hg, 0, -0.05) + 0.004);
    this.eyeLocalC = V(0, 0.004, frontZ(hg, 0, 0.004));
    this.shoulderLocal = { L: V(sw, T * 0.86, 0), R: V(-sw, T * 0.86, 0) }; // L = character's left (+X when facing +Z)
    this.arms = {};
    const robeCuff = spec.robe ? 1.45 : 1;
    for (const side of ['L', 'R']) {
      const up = this.mk(limbGeo(1, 0.05 * s * (1 + b * 0.25) * (spec.robe ? 1.12 : 1), 0.042 * s * (1 + b * 0.2) * (spec.robe ? 1.15 : 1), 7), M.sleeve, `upperArm${side}`);
      const lo = this.mk(limbGeo(1, 0.042 * s * (1 + b * 0.15) * (spec.robe ? 1.18 : 1), 0.034 * s * robeCuff, 7), M.sleeve, `forearm${side}`);
      const cuff = this.mk(limbGeo(1, 0.037 * s * robeCuff, 0.035 * s * robeCuff, 7), spec.robe ? trimM : M.sleeve, `cuff${side}`);
      const H = buildHand(M.skin, side, s, this.name); this.root.add(H.grp);
      this.arms[side] = { up, lo, cuff, H, side, sx: side === 'L' ? 1 : -1 };
    }
    this.legs = {};
    for (const side of ['L', 'R']) {
      const th = this.mk(limbGeo(1, this.thighR, 0.058 * s, 8), M.pants, `thigh${side}`);
      const sh = this.mk(limbGeo(1, 0.056 * s * (spec.robe ? 0.85 : 1), 0.045 * s * (spec.robe ? 0.8 : 1), 8), spec.robe ? M.skin : M.pants, `shin${side}`);
      const shoe = new THREE.Group(); this.root.add(shoe);
      this.mk(shoeGeo(this.ankleH, 0.27 * s, spec.shoeKind || 'sneaker'), M.shoe, `shoe${side}`, shoe);
      this.mk(soleGeo(this.ankleH, 0.27 * s), M.sole, `sole${side}`, shoe);
      if (spec.slippers) { // fluffy slipper puff over the toes
        const puff = this.mk(new THREE.IcosahedronGeometry(1, 1), M.shoe, `puff${side}`, shoe);
        puff.scale.set(0.05 * s, 0.03 * s, 0.07 * s); puff.position.set(0, -this.ankleH + 0.04 * s, 0.08 * s);
      }
      this.legs[side] = { th, sh, shoe, sx: side === 'L' ? 1 : -1 };
    }
  }

  buildHair(hg) {
    const { spec, mats: M } = this, st = spec.hairStyle;
    const add = (g, part = 'hair', material = M.hair) => this.mk(g, material, part, this.head);
    const notFace = (nx, ny, nz) => !(nz > 0.35 && ny < 0.42 && ny > -0.95);
    this.tufts = null; this.sideTufts = null;
    if (st === 'messy') {
      this.hairShell = add(hairShell((nx, ny, nz) => ny > -0.15 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.8 && ny < 0.25 && nz > -0.3), { thick: 0.013, chunk: 0.012, seed: 3 }));
      const tufts = [], side = [];
      const R = (i) => hash1(i * 7.7 + 3);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2, el = 0.35 + R(i) * 0.5;
        const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
        if (dir[2] > 0.55 && dir[1] < 0.6) continue;
        const base = [dir[0] * HEAD.rx * 0.95, dir[1] * HEAD.ry * 0.95, dir[2] * HEAD.rz * 0.95];
        tufts.push(tuft(base, [dir[0] + 0.3 * Math.cos(a + 1), dir[1] + 0.45, dir[2]], 0.055 + R(i + 9) * 0.035, 0.023, 4, R(i + 3) * 3));
      }
      for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.022; tufts.push(tuft([x, HEAD.ry * 0.62, HEAD.rz * 0.55], [x * 2 + 0.2 * (i % 2 ? 1 : -1), -0.6, 0.6], 0.048, 0.019, 4, i)); }
      this.tufts = add(merge(tufts), 'hairTufts');
      // scruffy bits that poke out under a beanie (sides + back + a little fringe)
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (0.18 + 0.64 * (i / 11)), sd = i % 2 ? 1 : -1;
        const dx = sd * Math.sin(a), dz = -Math.cos(a);
        const base = [dx * HEAD.rx * 0.97, HEAD.ry * 0.2, dz * HEAD.rz * 0.97];
        side.push(tuft(base, [dx * 0.35, -1, dz * 0.35], 0.026 + R(i + 5) * 0.014, 0.012, 4, R(i) * 2));
      }
      for (let i = 0; i < 3; i++) { const x = (i - 1) * 0.03; side.push(tuft([x, HEAD.ry * 0.36, HEAD.rz * 0.8], [x * 2, -1, 0.35], 0.026, 0.011, 4, i)); }
      this.sideTufts = add(merge(side), 'hairSide');
      // wet hair: a few flat strands stuck to the forehead (shown instead of the spiky tufts)
      const strands = [];
      for (let i = 0; i < 6; i++) { const x = (i - 2.5) * 0.02; strands.push(tuft([x, HEAD.ry * 0.62, HEAD.rz * 0.66], [x * 1.5, -1, 0.42], 0.05 + R(i + 40) * 0.025, 0.011, 4, i)); }
      for (let i = 0; i < 8; i++) { const a = Math.PI * (0.25 + 0.5 * (i / 7)), sd = i % 2 ? 1 : -1; const dx = sd * Math.sin(a), dz = -Math.cos(a);
        strands.push(tuft([dx * HEAD.rx * 0.98, HEAD.ry * 0.25, dz * HEAD.rz * 0.98], [dx * 0.2, -1, dz * 0.2], 0.04, 0.012, 4, i)); }
      this.wetStrands = add(merge(strands), 'hairWet');
    } else if (st === 'slick') {      // slicked back, grey temples, a little quiff
      add(hairShell((nx, ny, nz) => ny > 0.02 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.35 && nz > -0.4), { thick: 0.01, chunk: 0.003, seed: 7, back: 0.02 }));
      const q = new THREE.SphereGeometry(1, 8, 5); q.scale(0.06, 0.02, 0.03); q.rotateX(-0.5); q.translate(0, HEAD.ry * 0.8, HEAD.rz * 0.62); add(q, 'quiff');
      const grey = mat(fabricTex('cotton', { color: '#9a958e', amount: 14, seed: 9 }));
      for (const sd of [-1, 1]) { const g = new THREE.BoxGeometry(0.012, 0.03, 0.05); g.translate(sd * HEAD.rx * 0.97, HEAD.ry * 0.18, -0.01); add(g, 'temple', grey); }
    } else if (st === 'bald') {       // shiny top, fringe around the back and sides
      add(hairShell((nx, ny, nz) => ny > -0.25 && ny < 0.2 && nz < 0.15 && notFace(nx, ny, nz), { thick: 0.008, chunk: 0.006, seed: 12 }));
      this.mats.skin.roughness = 0.6;
    } else if (st === 'short') {
      add(hairShell((nx, ny, nz) => ny > 0.05 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.35 && nz > -0.4), { thick: 0.008, chunk: 0.005, seed: 7 }));
    }
  }

  buildHat() {
    const { spec, mats: M } = this;
    this.hat = null;
    if (!spec.hat) return;
    const g = new THREE.Group(); g.name = `${this.name}.hatGroup`; this.head.add(g);
    if (spec.hat === 'beanie') {
      const shell = hairShell((nx, ny) => ny > 0.12, { thick: 0.024, chunk: 0.004, seed: 21, scaleY: 1.12 });
      const m1 = this.mk(shell, M.hat, 'beanie', g);
      const cuff = new THREE.CylinderGeometry(HEAD.rx * 1.12, HEAD.rx * 1.16, 0.045, 14, 1, true);
      const m2 = this.mk(cuff, M.hat, 'beanieCuff', g); m2.position.set(0, HEAD.ry * 0.3, -0.004); m2.scale.set(1, 1, HEAD.rz / HEAD.rx * 1.0); m2.rotation.x = -0.12;
      m2.material = M.hat.clone(); m2.material.side = THREE.DoubleSide; m2.material.color.multiplyScalar(0.85);
      const top = this.mk(new THREE.IcosahedronGeometry(0.026, 0), M.hat, 'beanieTop', g); top.position.set(0, HEAD.ry * 1.16, -0.012);
    } else if (spec.hat === 'cap') {
      const shell = hairShell((nx, ny) => ny > 0.2, { thick: 0.016, chunk: 0.002, seed: 22, scaleY: 1.05 });
      this.mk(shell, M.hat, 'cap', g);
      const brim = new THREE.CylinderGeometry(0.075, 0.075, 0.008, 10, 1, false, -Math.PI / 2, Math.PI); brim.scale(1, 1, 1.1);
      const b = this.mk(brim, M.hat, 'brim', g); b.position.set(0, HEAD.ry * 0.42, HEAD.rz * 0.82); b.rotation.x = 0.12;
    } else if (spec.hat === 'chef') {
      const band = new THREE.CylinderGeometry(HEAD.rx * 1.1, HEAD.rx * 1.08, 0.07, 12);
      const m1 = this.mk(band, M.hat, 'chefBand', g); m1.position.set(0, HEAD.ry * 0.72, -0.005); m1.scale.set(1, 1, HEAD.rz / HEAD.rx);
      const puff = new THREE.SphereGeometry(1, 10, 6); puff.scale(HEAD.rx * 1.35, 0.075, HEAD.rz * 1.25);
      const m2 = this.mk(puff, M.hat, 'chefPuff', g); m2.position.set(0, HEAD.ry * 0.72 + 0.085, -0.008);
      const col = new THREE.CylinderGeometry(HEAD.rx * 1.18, HEAD.rx * 1.1, 0.07, 12);
      const m3 = this.mk(col, M.hat, 'chefTop', g); m3.position.set(0, HEAD.ry * 0.72 + 0.045, -0.006); m3.scale.set(1, 1, HEAD.rz / HEAD.rx);
    }
    this.hat = g;
    // a free copy of the hat for when it flies off (p.hatFly = {pos, rot})
    this.hatFly = g.clone(true); this.hatFly.name = `${this.name}.hatFly`; this.hatFly.visible = false;
    this.world.scene.add(this.hatFly);
  }

  buildAccessories(T) {
    const s = this.s, cd = this.spec.chestD;
    // white towel draped around the neck: a ribbon over both shoulders hanging down the front
    const path = new THREE.CatmullRomCurve3([
      V(-0.075, T * 0.34, cd + 0.03), V(-0.085, T * 0.62, cd + 0.03), V(-0.11, T * 0.9, cd * 0.4), V(-0.1, T * 1.0, -0.03),
      V(0, T * 1.03, -0.085), V(0.1, T * 1.0, -0.03), V(0.11, T * 0.9, cd * 0.4), V(0.085, T * 0.62, cd + 0.03), V(0.075, T * 0.34, cd + 0.03),
    ]);
    const N = 40, W = 0.085 * s, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N, p = path.getPointAt(u), tg = path.getTangentAt(u);
      const out = V(p.x, 0, p.z).normalize(); if (out.lengthSq() < 0.5) out.set(0, 0, 1);
      const side = V().crossVectors(tg, out).normalize();
      for (const k of [-1, 1]) { const q = p.clone().addScaledVector(side, k * W).addScaledVector(out, 0.012); pos.push(q.x, q.y, q.z); uv.push(u * 6, (k + 1) / 2); }
      if (i < N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const tg2 = new THREE.BufferGeometry(); tg2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg2.setIndex(idx); tg2.computeVertexNormals();
    this.towel = this.mk(tg2, mat(fabricTex('terry', { color: '#f6f4ee', seed: 82 }, 32, [1, 1]), { rough: 0.95, side: THREE.DoubleSide }), 'towel', this.chest);
    this.towel.visible = false;
    // spirit level balanced on the head (bubble slides along x)
    const lv = new THREE.Group(); lv.name = 'you.levelGroup'; lv.position.set(0, HEAD.ry * 1.08, -0.005); this.head.add(lv);
    this.mk(new THREE.BoxGeometry(0.62, 0.05, 0.045), mat('#e8c21e', { rough: 0.45, metal: 0.2 }), 'level', lv);
    const vial = this.mk(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), mat('#b8f07a', { rough: 0.1, emissive: '#6ab03a', emissiveIntensity: 0.4 }), 'levelVial', lv);
    vial.rotation.z = Math.PI / 2; vial.position.set(0, 0, 0.026);
    this.bubble = this.mk(new THREE.SphereGeometry(0.008, 8, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), 'levelBubble', lv);
    this.bubble.position.set(0, 0.003, 0.036);
    for (const x of [-0.016, 0.016]) { const ln = this.mk(new THREE.BoxGeometry(0.002, 0.026, 0.002), mat('#1a1a1a'), 'levelMark', lv); ln.position.set(x, 0, 0.039); }
    this.level = lv; lv.visible = false;
  }

  buildMoustache(hg) {
    const { spec, mats: M } = this;
    const z = frontZ(hg, 0, -0.036) + 0.004;
    const parts = [];
    const box = (w, h, d, x, y, zz, rz = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.rotateZ(rz); g.translate(x, y, zz); parts.push(g); };
    if (spec.moustache === 'handlebar') {
      box(0.036, 0.011, 0.012, 0, -0.035, z);
      for (const sd of [-1, 1]) {
        box(0.026, 0.009, 0.011, sd * 0.03, -0.037, z - 0.005, sd * -0.18);
        box(0.014, 0.008, 0.009, sd * 0.047, -0.034, z - 0.012, sd * -0.75);
        box(0.007, 0.012, 0.008, sd * 0.053, -0.026, z - 0.015, sd * 0.25);
      }
    } else if (spec.moustache === 'thick') {
      box(0.068, 0.022, 0.02, 0, -0.037, z);
      for (const sd of [-1, 1]) box(0.02, 0.03, 0.016, sd * 0.034, -0.046, z - 0.006, sd * 0.2);
    } else {
      box(0.05, 0.008, 0.01, 0, -0.035, z);
    }
    this.mk(merge(parts), M.must, 'moustache', this.head);
  }

  defaults() {
    const h = HOME[this.name];
    return {
      pos: h.pos.slice(), rotY: h.rotY, y: h.y, sit: 0, seatY: null, legs: 'chair', lean: 0, leanSide: 0, torsoYaw: 0,
      headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null,
      eyes: 'open', pupils: [0, 0], brows: 'neutral', mouth: 'neutral', talk: 0, blush: 0,
      handL: null, handR: null, handPoseL: 'relaxed', handPoseR: 'relaxed', handRotL: null, handRotR: null,
      gripL: null, gripR: null, poleL: null, poleR: null,
      gait: null, bounce: 0, bellyWobble: 0, cheeks: 0, red: 0, tongue: 0, shoulderUp: 0, hairBounce: 0,
      wet: 0, hatOn: true, hatFly: null, visible: false, feet: null, towel: false, level: false, bubble: 0,
    };
  }

  _w(local, obj) { obj.updateMatrixWorld(true); return local.clone().applyMatrix4(obj.matrixWorld); }
  headPos() { return this._w(V(), this.head); }
  eyePos() { return this._w(this.eyeLocalC, this.head); }
  mouthPos() { return this._w(this.mouthLocal, this.head); }
  nosePos() { return this._w(V(0, -0.015, this.eyeLocalC.z + 0.02), this.head); }
  hatTop() { return this._w(V(0, HEAD.ry * 1.2, 0), this.head); }
  chestPos() { return this._w(V(0, this.torsoH * 0.6, this.spec.chestD + 0.01), this.chest); }
  heartPos() { return this._w(V(0.055 * this.s, this.torsoH * 0.62, this.spec.chestD + 0.012), this.chest); }
  bellyPos() { return this._w(V(0, this.torsoH * 0.22, this.bellyFront + 0.012), this.chest); }
  hipPos() { return this._w(V(0, -0.02, 0), this.pelvis); }
  handPos(side = 'R') { const a = this.arms[side]; return this._w(V(0, a.H.L * 0.55, 0), a.H.grp); }
  palmPos(side = 'R') { const a = this.arms[side]; return this._w(V(0, a.H.L * 0.55, -a.H.T * 0.5 - 0.01), a.H.grp); }
  shoulderPos(side = 'R') { return this._w(this.shoulderLocal[side], this.chest); }
  // point in front of the character (local x right-handed: +x = character's left), world coords
  local(x, y, z) { this.root.updateMatrixWorld(true); return V(x, y, z).applyMatrix4(this.root.matrixWorld); }
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

// walk / run cycle: foot offset (forward z, lift y) for phase ph (cycles), swing fraction sw
function footCycle(ph, stride, lift, sw) {
  const f = ph - Math.floor(ph);
  if (f < 1 - sw) { const k = f / (1 - sw); return [lerp(stride / 2, -stride / 2, k), 0]; }       // stance: foot moves back
  const k = (f - (1 - sw)) / sw; return [lerp(-stride / 2, stride / 2, smooth(k)), Math.sin(k * Math.PI) * lift];
}

function solve(ch, t) {
  const p = ch.p, s = ch.s, spec = ch.spec;
  if (ch.hatFly) {
    ch.hatFly.visible = !!p.hatFly;
    if (p.hatFly) { ch.hatFly.position.set(...p.hatFly.pos); ch.hatFly.rotation.set(...(p.hatFly.rot || [0, 0, 0])); }
  }
  ch.root.visible = p.visible;
  if (!p.visible) return;
  ch.root.position.set(p.pos[0], p.y, p.pos[1]);
  ch.root.rotation.set(0, p.rotY, 0);
  const sit = clamp(p.sit);
  const g = p.gait;
  const run = g && g.kind === 'run';
  let bob = 0;
  if (g) bob = (run ? 0.045 : 0.02) * Math.abs(Math.sin(g.phase * Math.PI * 2)) - (run ? 0.03 : 0.01);
  const seatHip = (p.seatY != null ? p.seatY - p.y : 0.46) + ch.thighR * 0.92;
  const hipY = lerp(ch.hipStandY, seatHip, sit) + bob + p.bounce * 0.012 * Math.abs(Math.sin(t * 19));
  ch.pelvis.position.set(0, hipY, lerp(0, p.legs === 'floor' ? -0.04 : 0.02, sit));
  ch.pelvis.rotation.set(0, p.torsoYaw * 0.3, 0);
  const breathe = Math.sin(t * 1.6 + hash1(s * 13) * 6) * 0.008;
  const runLean = run ? 0.22 : g ? 0.04 : 0;
  ch.chest.rotation.set(p.lean + runLean + breathe - p.bounce * 0.08 * (0.5 + 0.5 * Math.sin(t * 19)), p.torsoYaw * 0.7 + (g ? Math.sin(g.phase * Math.PI * 2) * (run ? 0.12 : 0.06) : 0), p.leanSide, 'YXZ');
  ch.chest.scale.set(1, 1, 1 + p.bellyWobble * 0.06 * Math.sin(t * 23) + breathe * 0.4);
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
  const chestPitch = ch.chest.rotation.x;
  ch.head.rotation.set(-pitch - chestPitch * 0.8 - p.bounce * 0.2, yaw, p.headRoll, 'YXZ');
  const faceTex = ch.faceSet(p.eyes, p.brows, p.mouth, p.talk, pdx, pdy, 0, p.blush > 0.5);
  if (ch.mats.face.map !== faceTex) { ch.mats.face.map = faceTex; ch.mats.face.needsUpdate = true; }
  // red face / blush tint
  const red = clamp(p.red);
  const tint = new THREE.Color(1, 1 - red * 0.45, 1 - red * 0.5);
  ch.mats.face.color.copy(tint); ch.mats.skin.color.copy(tint);
  ch.mats.face.emissive.set(spec.skin).multiplyScalar(0.1).lerp(new THREE.Color(0.35, 0.02, 0.02), red * 0.5);
  ch.mats.skin.emissive.copy(ch.mats.face.emissive);
  // wet: darker cloth, shiny flat hair
  const wet = clamp(p.wet);
  for (const [k, d] of Object.entries(ch.dry)) {
    const m = ch.mats[k]; if (!m) continue;
    m.color.copy(d.c).multiplyScalar(1 - wet * (k === 'hair' ? 0.25 : 0.38));
    m.roughness = lerp(d.r, k === 'hair' ? 0.25 : 0.45, wet);
  }
  if (ch.skirt) { ch.skirt.material.color.setRGB(1, 1, 1).multiplyScalar(1 - wet * 0.38); ch.skirt.material.roughness = ch.mats.torso.roughness; }
  const ck = clamp(p.cheeks);
  for (const c of ch.cheeks) {
    c.visible = ck > 0.02;
    const r = 0.012 + 0.014 * ck;
    c.scale.set(r * 1.1, r, r * 0.9);
    c.position.set(c.userData.sd * (0.042 + 0.008 * ck), -0.042, ch.cheekZ[c.userData.sd > 0 ? 1 : 0] - 0.02 + 0.012 * ck);
  }
  ch.tongue.visible = p.tongue > 0.02;
  ch.tongue.scale.set(1, 1, clamp(p.tongue));
  ch.tongue.rotation.x = 0.35 + Math.sin(t * 20) * 0.08 * p.tongue;
  // hat + hair
  const hatOn = !!(ch.hat && p.hatOn);
  if (ch.hat) ch.hat.visible = hatOn;
  if (ch.tufts) {
    const wetHair = wet > 0.5;
    ch.tufts.visible = !hatOn && !wetHair;
    ch.sideTufts.visible = hatOn && !wetHair;
    ch.wetStrands.visible = wetHair;
    ch.tufts.rotation.set(Math.sin(t * 27) * 0.06 * p.hairBounce, 0, Math.sin(t * 23 + 1) * 0.08 * p.hairBounce);
  }
  if (ch.towel) ch.towel.visible = !!p.towel;
  if (ch.level) { ch.level.visible = !!p.level; ch.bubble.position.x = clamp(p.bubble, -1, 1) * 0.045; }
  if (ch.skirt) {
    ch.skirt.visible = sit < 0.5;
    if (g) ch.skirt.rotation.x = Math.sin(g.phase * Math.PI * 2) * 0.05;
    else ch.skirt.rotation.x = 0;
  }
  if (ch.apron) ch.apron.visible = sit < 0.5;

  ch.root.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(ch.root.matrixWorld).invert();
  const rootQi = ch.root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const fwdW = V(Math.sin(p.rotY), 0, Math.cos(p.rotY));

  for (const side of ['L', 'R']) {
    const a = ch.arms[side], H = a.H, sx = a.sx;
    const shW = ch.shoulderLocal[side].clone().applyMatrix4(ch.chest.matrixWorld);
    const gr = side === 'L' ? p.gripL : p.gripR;
    let pose = side === 'L' ? p.handPoseL : p.handPoseR;
    let wristW, handQ = null;
    if (gr) {
      const G = gripFrame(gr);
      const X = G.axis.clone().multiplyScalar(H.ts);
      const Z = G.up.clone().addScaledVector(X, -G.up.dot(X)).normalize();
      const Y = V().crossVectors(Z, X);
      handQ = basis(X, Y, Z);
      wristW = G.pos.clone().sub(gripPoint(H).applyQuaternion(handQ));
      pose = gr.pose || 'grip';
    } else {
      const tgt = side === 'L' ? p.handL : p.handR;
      const rot = side === 'L' ? p.handRotL : p.handRotR;
      if (tgt) {
        const T = v3(tgt);
        if (rot) handQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot, 'YXZ'));
        else if (pose === 'flat') {
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
      } else if (g) {                                   // arms swing / pump opposite to the legs
        const sw = Math.sin((g.phase + (side === 'L' ? 0.5 : 0)) * Math.PI * 2);
        if (run) wristW = V(sx * 0.2 * s, ch.pelvis.position.y + 0.3 * s + Math.max(0, sw) * 0.08, 0.06 + sw * 0.26).applyMatrix4(ch.root.matrixWorld);
        else wristW = V(sx * (ch.shoulderW + 0.03), ch.pelvis.position.y - 0.06 * s, 0.03 + sw * 0.16).applyMatrix4(ch.root.matrixWorld);
        pose = run ? 'fist' : pose;
      } else if (sit > 0.5) {                             // seated rest: hands on the thighs / knees
        wristW = V(sx * 0.1 * s, ch.pelvis.position.y + ch.thighR + 0.02, 0.17 * s + ch.pelvis.position.z).applyMatrix4(ch.root.matrixWorld);
        const Y = fwdW.clone(), Z = V(0, 1, 0), X = V().crossVectors(Y, Z);
        handQ = basis(X, Y, Z);
      } else {
        wristW = V(sx * (ch.shoulderW + 0.02), ch.pelvis.position.y - 0.07 * s, 0.03).applyMatrix4(ch.root.matrixWorld);
      }
    }
    const A = shW.clone().applyMatrix4(toLocal), Wl = wristW.clone().applyMatrix4(toLocal);
    const pl = side === 'L' ? p.poleL : p.poleR;
    const pole = A.clone().add(pl ? V(pl[0] * sx, pl[1], pl[2]) : run ? V(sx * 0.2, -0.6, -1.0) : V(sx * 0.28, -1.0, -0.05));
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
    let J, E;
    if (sit > 0.5 && p.legs === 'floor') {          // sitting on the ground, knees up, feet flat in front
      const foot = V(sx * (ch.hipW + 0.04), ch.ankleH, hip.z + 0.5 * s);
      ({ J, E } = ik3(hip, foot, ch.legL[0], ch.legL[1], hip.clone().add(V(sx * 0.15, 1.0, 0.6))));
    } else if (sit > 0.5) {                          // chair / toilet: thighs forward, shins down
      const floorY = p.feet != null ? p.feet - p.y : 0;
      const knee = V(hip.x + sx * 0.03, hip.y - 0.02, hip.z + ch.legL[0] * 0.97);
      const ankle = V(sx * (ch.hipW + 0.04), floorY + ch.ankleH, knee.z + 0.06 * s);
      const dd = ankle.clone().sub(knee); const len = dd.length();
      J = knee; E = knee.clone().add(dd.normalize().multiplyScalar(Math.min(len, ch.legL[1])));
    } else if (g) {
      const stride = (run ? 0.95 : 0.55) * s * (spec.robe ? 0.8 : 1);
      const [fz, fy] = footCycle(g.phase + (side === 'L' ? 0 : 0.5), stride, run ? 0.16 : 0.07, run ? 0.6 : 0.4);
      ({ J, E } = ik3(hip, V(sx * (ch.hipW + 0.005), ch.ankleH + fy, fz), ch.legL[0], ch.legL[1], hip.clone().add(V(0, -0.3, 1))));
    } else {
      ({ J, E } = ik3(hip, V(sx * (ch.hipW + 0.01), ch.ankleH, 0.02), ch.legL[0], ch.legL[1], hip.clone().add(V(0, -0.3, 1))));
    }
    placeBone(L.th, hip, J); placeBone(L.sh, J, E);
    L.th.visible = !(spec.robe && sit < 0.5);          // thighs are inside the robe
    L.shoe.position.copy(E);
    const toe = (sit > 0.5 && p.legs === 'floor') ? -0.25 : 0;
    L.shoe.rotation.set(toe, sx * 0.06, 0);
  }
}

// ------------------------------------------------------------------ cast
export function buildCast(world) {
  const chars = {};
  for (const [name, spec] of Object.entries(SPECS)) chars[name] = new Character(name, spec, world);
  const list = Object.values(chars);
  const helpers = {
    blink(ch, t) {
      const per = 2.6 + hash1(ch.s * 77 + ch.name.length) * 2.4, ph = ((t + hash1(ch.s * 13) * per) % per) / per;
      if (ph > 0.965 && ch.p.eyes === 'open') ch.p.eyes = 'closed';
    },
    talk(ch, t, intensity = 1) {
      const v = Math.max(0, noise1(t * 9, ch.s * 31) * 0.6 + noise1(t * 17, ch.s * 7) * 0.5 + 0.25);
      ch.p.talk = clamp(v * intensity);
    },
    laugh(ch, t, amount = 1) {
      ch.p.bounce = amount; ch.p.mouth = 'laugh'; ch.p.eyes = 'happy'; ch.p.brows = 'raised';
      ch.p.talk = clamp(0.5 + 0.5 * Math.sin(t * 19)) * amount;
      ch.p.headPitch += 0.18 * amount; ch.p.bellyWobble = amount;
    },
    // walk/run from a to b ([x,z]) over u; sets pos, rotY, gait
    go(ch, a, b, u, kind = 'walk', stride = null, phase0 = 0) {
      const x = lerp(a[0], b[0], u), z = lerp(a[1], b[1], u);
      ch.p.pos = [x, z]; ch.p.rotY = Math.atan2(b[0] - a[0], b[1] - a[1]);
      const st = stride ?? (kind === 'run' ? 1.9 : 1.15) * ch.s;
      ch.p.gait = { kind, phase: (Math.hypot(b[0] - a[0], b[1] - a[1]) * u) / st + phase0 };
    },
  };
  return {
    characters: list, ...chars, chars, helpers,
    reset(t) { for (const ch of list) { ch.p = ch.defaults(); helpers.blink(ch, t); } },
    commit(ctx) { for (const ch of list) solve(ch, ctx.t); },
  };
}
