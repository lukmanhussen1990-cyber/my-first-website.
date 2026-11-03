// Low-poly wedding cast (adapted from thanksgiving_reel/web/characters.js): rig, faces, poses, holding props.
// makeChar(world, name, overrides) builds one person; shots pose them through ch.p and call solve(ch, t).
import * as THREE from 'three';
import { mat, clamp, lerp, smooth, hash1, noise1, ik3, placeBone, v3 } from './lib.js';
export const CHAIR = { seatY: 0.46 };
import { loftY, limbGeo, headGeo, noseGeo, earGeo, hairShell, tuft, buildHand, poseHand, gripPoint, shoeGeo, soleGeo, glassesGeo, lensGeo, frontZ, merge, HEAD } from './char_geo.js';
import { fabricTex, torsoTex, makeFaceSet, skinTex, sleeveSplitTex } from './char_tex.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ cast specs
const SUIT = (main, tie, o = {}) => ({ torso: { style: 'suit', main, tie, ...o }, sleeve: ['cotton', { color: main, seed: 31, amount: 9 }],
  pants: ['cotton', { color: main, seed: 32, amount: 9 }] });
export const SPECS = {
  // YOU: the "genius" content creator, like the reference reels: a plain brown-skinned mannequin, no clothes and
  // no body details at all (the pixel mosaic covers his hips in every shot), block hair, very confident
  you: { H: 1.78, skin: '#9a6440', hair: '#1e140c', hairStyle: 'short', torso: { style: 'skin', main: '#9a6440' },
    sleeve: ['cotton', { color: '#9a6440', seed: 11, amount: 6 }], pants: ['cotton', { color: '#9a6440', seed: 4, amount: 6 }], shoe: '#9a6440',
    shoulder: 0.19, waist: 0.145, chestD: 0.105, belly: 0, female: false,
    face: { eyeW: 8, eyeH: 11, mouthW: 1.0, seed: 3, brow: '#1e140c' } },
  // TV PRESENTER: smiling man in a blue suit
  presenter: { H: 1.8, skin: '#e0b48e', hair: '#5a3a22', hairStyle: 'slick', torso: { style: 'suit', main: '#2a4a8a', tie: '#e8b030' },
    sleeve: ['cotton', { color: '#2a4a8a', seed: 31, amount: 9 }], pants: ['cotton', { color: '#2a4a8a', seed: 32, amount: 9 }],
    shoe: '#141414', shoeKind: 'boot', shoulder: 0.2, waist: 0.15, chestD: 0.11, belly: 0.1, female: false,
    face: { eyeW: 8, eyeH: 11, mouthW: 1.05, seed: 21, brow: '#5a3a22' } },
  // PILOT: headset + sunglasses, olive flight suit, worried
  pilot: { H: 1.78, skin: '#d29a6c', hair: '#3a2a1a', hairStyle: 'buzz', torso: { style: 'quarterzip', main: '#5a6a3a' },
    sleeve: ['fleece', { color: '#5a6a3a', seed: 15 }], pants: ['cotton', { color: '#5a6a3a', seed: 32, amount: 9 }], shoe: '#2a2018', shoeKind: 'boot',
    shoulder: 0.2, waist: 0.15, chestD: 0.11, belly: 0.2, female: false, headphones: true, glasses: 'sun', mustache: '#2a1a10',
    face: { eyeW: 8, eyeH: 10, mouthW: 1, seed: 51, brow: '#3a2a1a' } },
  // NEWS ANCHOR: calm woman in a blazer
  anchor: { H: 1.68, skin: '#e8b892', hair: '#2a1a12', hairStyle: 'shoulder', torso: { style: 'suit', main: '#8a1a2a', tie: '#f2f0ea', bow: true },
    sleeve: ['cotton', { color: '#8a1a2a', seed: 31, amount: 9 }], pants: ['cotton', { color: '#2a2a30', seed: 32, amount: 9 }], shoe: '#141414',
    shoulder: 0.16, waist: 0.125, chestD: 0.1, belly: 0, female: true,
    face: { eyeW: 7, eyeH: 11, mouthW: 0.95, seed: 23, brow: '#2a1a12', blush: '#e08a80', lash: true } },
  // FOOTBALL PLAYER
  player: { H: 1.8, skin: '#8d5a3b', hair: '#120c09', hairStyle: 'buzz', torso: { style: 'jersey', main: '#2a6ad8', accent: '#ffffff', number: '7' },
    sleeve: ['jersey', { color: '#2a6ad8', seed: 17 }], pants: ['cotton', { color: '#f2f2f2', seed: 14, amount: 6 }], shoe: '#f0c020',
    shoulder: 0.19, waist: 0.14, chestD: 0.1, belly: 0, female: false, shortSleeve: true, shorts: true,
    face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 61, brow: '#120c09' } },
};
// bright-coloured crowd people (audience, street): t-shirts, hoodies, jerseys in flat bright colours
const BRIGHT = ['#e8402a', '#f2a01e', '#f2d030', '#3ab04a', '#2a8ad8', '#8a4ad8', '#e84a9a', '#20b0b0', '#f26a4a', '#4a5ad8'];
export function crowdSpec(i) {
  const h = (k) => hash1(i * 19.7 + k * 3.3);
  const female = h(1) > 0.5, skin = GUEST_SKIN[Math.floor(h(2) * GUEST_SKIN.length)], hair = GUEST_HAIR[Math.floor(h(3) * GUEST_HAIR.length)];
  const c = BRIGHT[Math.floor(h(4) * BRIGHT.length)], p = ['#2d3d5c', '#3a3a40', '#5a4a3a', '#2a5a8a'][Math.floor(h(5) * 4)];
  const style = ['hoodie', 'girltop', 'jersey', 'sweater'][Math.floor(h(6) * 4)];
  return { H: female ? 1.6 + h(7) * 0.1 : 1.7 + h(7) * 0.14, skin, hair, hairStyle: female ? (h(8) > 0.5 ? 'ponytail' : 'shoulder') : ['short', 'messy', 'buzz'][Math.floor(h(8) * 3)],
    torso: { style, main: c, accent: c, number: '' }, sleeve: ['cotton', { color: c, seed: 3 + i }], pants: ['denim', { color: p, seed: 5 }],
    shoe: '#f2f2ee', shoulder: female ? 0.155 : 0.19, waist: female ? 0.125 : 0.145, chestD: 0.1, belly: h(9) * 0.5, female,
    shortSleeve: style === 'girltop' || style === 'jersey', face: { eyeW: 8, eyeH: 11, mouthW: 1, seed: 300 + i, brow: hair, blush: female ? '#e08a80' : undefined, lash: female } };
}
// old Edinburgh street people (long coats + tricorn hats, or bonnets + shawls + long skirts)
const OLD_COATS = ['#5a3a2a', '#3a4a3a', '#4a3a5a', '#6a5a3a', '#2a3040', '#7a4a2a'];
export function oldSpec(i) {
  const h = (k) => hash1(i * 17.3 + k * 2.9);
  const female = h(1) > 0.55, skin = GUEST_SKIN[Math.floor(h(2) * GUEST_SKIN.length)], hair = GUEST_HAIR[Math.floor(h(3) * GUEST_HAIR.length)];
  const face = { eyeW: 8, eyeH: 11, mouthW: 1, seed: 200 + i, brow: hair, lash: female };
  if (female) {
    const d = OLD_COATS[Math.floor(h(4) * OLD_COATS.length)];
    return { H: 1.58 + h(5) * 0.08, skin, hair, hairStyle: 'bonnet', torso: { style: 'shawl', main: d, inner: '#8a8070' },
      sleeve: ['cotton', { color: '#8a8070', seed: 3 }], pants: ['cotton', { color: '#4a4038', seed: 7 }], shoe: '#2a1e16',
      shoulder: 0.15, waist: 0.13, chestD: 0.1, belly: 0, female: true, skirt: { len: 1.0, flare: 0.3, color: '#4a4038' }, face };
  }
  const c = OLD_COATS[Math.floor(h(6) * OLD_COATS.length)];
  return { H: 1.68 + h(7) * 0.14, skin, hair, hairStyle: 'short', torso: { style: 'coat', main: c, inner: '#8a6a3a' },
    sleeve: ['cotton', { color: c, seed: 31 }], pants: ['cotton', { color: '#6a5a44', seed: 32 }], shoe: '#1c1714', shoeKind: 'boot',
    shoulder: 0.19, waist: 0.15, chestD: 0.11, belly: h(8) * 0.6, female: false, hat: h(9) > 0.4 ? 'tricorn' : 'cap', face };
}
// generic guests: suits and party dresses in many colours
const GUEST_SKIN = ['#e9b993', '#c98d66', '#8d5a3b', '#f0c9aa', '#b07650', '#dca37c', '#6e4630', '#e2ae88'];
const GUEST_HAIR = ['#1a120d', '#5b3a20', '#2a1a12', '#8a3f22', '#a07a48', '#3a2416', '#d8d4cc', '#111111'];
const SUITS = ['#2a3a5c', '#3d4048', '#1d1d22', '#5a3a2a', '#284a3a', '#54565e', '#6a5a48'];
const TIES = ['#8a1c24', '#2c3e70', '#c9a03a', '#3a6a3a', '#6b2a6a', '#b04a2a'];
const DRESSES = ['#c0392b', '#2e86c1', '#8e44ad', '#16a085', '#d4a017', '#e67e9f', '#1f4e79', '#a04060', '#5b8c3a'];
export function guestSpec(i) {
  const h = (k) => hash1(i * 13.7 + k * 3.1);
  const female = h(1) > 0.5, skin = GUEST_SKIN[Math.floor(h(2) * GUEST_SKIN.length)], hair = GUEST_HAIR[Math.floor(h(3) * GUEST_HAIR.length)];
  const face = { eyeW: 8, eyeH: female ? 11 : 11, mouthW: 1, seed: 100 + i, brow: hair, blush: female ? '#e08a80' : undefined, lash: female };
  if (female) {
    const d = DRESSES[Math.floor(h(4) * DRESSES.length)];
    return { H: 1.6 + h(5) * 0.1, skin, hair, hairStyle: h(6) > 0.5 ? 'shoulder' : 'bun', bunTie: d, torso: { style: 'gown', main: d, skin, accent: d },
      sleeve: ['cotton', { color: skin, seed: 3, amount: 5 }], pants: ['cotton', { color: d, seed: 7, amount: 7 }], shoe: '#1e1a18',
      shoulder: 0.15, waist: 0.125, chestD: 0.095, belly: 0, female: true, bareArms: true, skirt: { len: 0.62, flare: 0.22, color: d }, face };
  }
  const st = SUITS[Math.floor(h(7) * SUITS.length)];
  return { H: 1.72 + h(8) * 0.12, skin, hair, hairStyle: ['short', 'messy', 'buzz', 'slick', 'bald'][Math.floor(h(9) * 5)],
    ...SUIT(st, TIES[Math.floor(h(10) * TIES.length)]), shoe: '#141414', shoeKind: 'boot', shoulder: 0.2, waist: 0.15 + h(11) * 0.04,
    chestD: 0.11, belly: h(12) * 0.8, female: false, beard: h(13) > 0.8 ? hair : undefined, face: { ...face, beard: h(13) > 0.8 ? hair : undefined } };
}

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
      const big = spec.glasses === 'big', gw = (big ? 0.054 : 0.04) * hs, gh = (big ? 0.046 : 0.03) * hs, gx = (big ? 0.035 : 0.031) * hs;
      this.mk(glassesGeo(gx, 0.004 * hs, ez + (big ? 0.006 : 0), { w: gw, h: gh, t: big ? 0.006 : 0.0035, earX: HEAD.rx * hs * 0.98, earZ: -0.01 * hs }), mat(big ? '#2a1c14' : '#c9a050', { rough: 0.35, metal: big ? 0.1 : 0.7 }), 'glasses', this.head);
      const sun = spec.glasses === 'sun';
      const lens = this.mk(lensGeo(gx, 0.004 * hs, ez + (big ? 0.006 : 0), { w: gw, h: gh }), sun ? mat('#0e0e12', { rough: 0.1, metal: 0.3 }) : mat('#e8f4ff', { rough: 0.05, transparent: true, opacity: big ? 0.28 : 0.18 }), 'lens', this.head);
      lens.castShadow = false; lens.userData.noAudit = true;
      this.glassesPosLocal = V(0.031 * hs, 0.012 * hs, ez + 0.004);
    }
    this._hg = hg;
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
      const sh = this.mk(limbGeo(1, 0.056 * s, 0.045 * s, 8), spec.shorts ? M.skin : M.pants, `shin${side}`);
      const shoe = new THREE.Group(); this.root.add(shoe);
      this.mk(shoeGeo(this.ankleH, 0.27 * s, spec.shoeKind || 'sneaker'), M.shoe, `shoe${side}`, shoe);
      this.mk(soleGeo(this.ankleH, 0.27 * s), M.sole, `sole${side}`, shoe);
      this.legs[side] = { th, sh, shoe, sx: side === 'L' ? 1 : -1 };
    }
    this.buildExtras(this.headScale, this._hg);
  }

  buildExtras(hs, hg) {
    const { spec, s } = this;
    if (spec.mustache) {
      const mm = mat(fabricTex('cotton', { color: spec.mustache, amount: 14, seed: 6 }), { rough: 0.9 });
      const mz = frontZ(hg, 0, -0.035 * hs);
      const parts = [new THREE.BoxGeometry(0.075, 0.02, 0.022).translate(0, -0.034, mz / hs + 0.004)];
      for (const sd of [-1, 1]) parts.push(new THREE.BoxGeometry(0.022, 0.024, 0.02).translate(sd * 0.036, -0.044, mz / hs - 0.002));
      const g = merge(parts); g.scale(hs, hs, hs); this.mk(g, mm, 'mustache', this.head);
    }
    if (spec.veil) {
      const vm = mat('#ffffff', { rough: 0.6, transparent: true, opacity: 0.55 }); vm.side = THREE.DoubleSide; vm.depthWrite = false;
      const g = new THREE.CylinderGeometry(0.07, 0.24, 0.85, 12, 1, true, Math.PI * 0.6, Math.PI * 0.8);
      g.translate(0, -0.33, -0.04); g.scale(hs, hs, hs);
      const v = this.mk(g, vm, 'veil', this.head); v.castShadow = false; v.userData.noAudit = true; v.position.set(0, HEAD.ry * hs * 0.85, -HEAD.rz * hs * 0.55);
      const comb = new THREE.TorusGeometry(0.05 * hs, 0.008 * hs, 4, 12, Math.PI); comb.rotateX(-0.6);
      const c = this.mk(comb, mat('#f6f0e2', { rough: 0.4 }), 'tiara', this.head); c.position.set(0, HEAD.ry * hs * 0.8, -HEAD.rz * hs * 0.1);
    }
    if (spec.headphones) {
      const hm = mat('#1b1b1f', { rough: 0.5 });
      const band = new THREE.TorusGeometry(HEAD.rx * hs * 1.12, 0.012, 5, 14, Math.PI); band.translate(0, 0.012, 0);
      this.mk(band, hm, 'headband', this.head);
      for (const sd of [-1, 1]) {
        const cup = new THREE.CylinderGeometry(0.042 * hs, 0.042 * hs, 0.032, 10); cup.rotateZ(Math.PI / 2);
        const c = this.mk(cup, hm, 'earcup', this.head); c.position.set(sd * HEAD.rx * hs * 1.12, -0.005, 0);
        const pad = new THREE.CylinderGeometry(0.03 * hs, 0.03 * hs, 0.006, 10); pad.rotateZ(Math.PI / 2);
        const pd = this.mk(pad, mat('#e8463a', { rough: 0.6 }), 'earcupRing', this.head); pd.position.set(sd * HEAD.rx * hs * 1.12 + sd * 0.018, -0.005, 0);
      }
    }
    if (spec.rose) {
      const r = this.mk(new THREE.IcosahedronGeometry(0.024 * s, 0), mat('#c41a2c', { rough: 0.6 }), 'rose', this.chest);
      r.position.set(-0.075 * s, this.torsoH * 0.7, spec.chestD + 0.012);
      const l = this.mk(new THREE.ConeGeometry(0.012, 0.03, 4), mat('#2f7a3a'), 'roseLeaf', this.chest); l.position.set(-0.06 * s, this.torsoH * 0.66, spec.chestD + 0.008); l.rotation.z = -0.8;
    }
    if (spec.watch) {
      const H = this.arms.L.H;
      const w = this.mk(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.022, 10, 1, true), mat('#d9a830', { rough: 0.25, metal: 0.9 }), 'watch', H.grp);
      w.material.side = THREE.DoubleSide; w.position.set(0, -0.012, 0);
      const face = this.mk(new THREE.BoxGeometry(0.026, 0.022, 0.012), mat('#f2e6b0', { rough: 0.2, metal: 0.6 }), 'watchFace', H.grp); face.position.set(0, -0.012, 0.028 * s);
    }
    if (spec.towel) {   // towel round the neck, two ends hanging down the chest
      const tm = mat(fabricTex('cotton', { color: spec.towel, amount: 14, seed: 9 }), { rough: 0.95 });
      const g = new THREE.TorusGeometry(0.085 * s, 0.036 * s, 6, 12); g.rotateX(Math.PI / 2); g.scale(1, 1, 1.05);
      this.mk(g, tm, 'towel', this.chest).position.set(0, this.torsoH * 0.97, 0.0);
      for (const sd of [-1, 1]) {
        const e = this.mk(new THREE.BoxGeometry(0.075 * s, 0.24 * s, 0.03 * s).translate(0, -0.12 * s, 0), tm, 'towelEnd', this.chest);
        e.position.set(sd * 0.065 * s, this.torsoH * 0.98, spec.chestD + 0.01); e.rotation.set(-0.12, 0, sd * 0.12);
      }
    }
    if (spec.apronSkirt) {   // the lower part of the apron (front of the hips / legs)
      const am = mat(fabricTex('cotton', { color: spec.apronSkirt, amount: 10, seed: 19 }), { rough: 0.9 }); am.side = THREE.DoubleSide;
      const ap = this.mk(new THREE.BoxGeometry(0.3 * s, 0.42 * s, 0.008).translate(0, -0.21 * s, 0), am, 'apron', this.pelvis);
      ap.position.set(0, 0.06 * s, spec.chestD + 0.045); this.apron = ap;
    }
    if (spec.hat) {
      const hm = mat(fabricTex('cotton', { color: spec.hatColor || (spec.hat === 'cap' ? '#4a3a2a' : '#1e1a18'), amount: 10, seed: 13 }), { rough: 0.9 });
      const hs2 = this.headScale;
      let g;
      if (spec.hat === 'tricorn') { g = new THREE.CylinderGeometry(0.075, 0.16, 0.08, 3, 1); g.rotateY(Math.PI / 6); g.translate(0, HEAD.ry * 0.95, -0.005); }
      else if (spec.hat === 'baseball') {
        const dome = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(HEAD.rx * 1.12, HEAD.ry * 0.62, HEAD.rz * 1.1);
        g = merge([dome.translate(0, HEAD.ry * 0.42, -0.004), new THREE.BoxGeometry(0.15, 0.012, 0.11).rotateX(0.18).translate(0, HEAD.ry * 0.46, HEAD.rz * 1.15),
          new THREE.BoxGeometry(0.018, 0.012, 0.018).translate(0, HEAD.ry * 1.05, -0.004)]);
      } else if (spec.hat === 'sunhat') {
        g = merge([new THREE.CylinderGeometry(0.07, 0.085, 0.06, 10).translate(0, HEAD.ry * 0.95, -0.005), new THREE.CylinderGeometry(0.17, 0.17, 0.01, 14).translate(0, HEAD.ry * 0.72, -0.005)]);
      } else { g = merge([new THREE.CylinderGeometry(0.085, 0.092, 0.05, 8).translate(0, HEAD.ry * 0.9, -0.005), new THREE.BoxGeometry(0.12, 0.012, 0.07).translate(0, HEAD.ry * 0.78, 0.085)]); }
      g.scale(hs2, hs2, hs2); this.hat = this.mk(g, hm, 'hat', this.head);
    }
    if (spec.skirt) {
      const k = spec.skirt, top = 0.07 * s, hipY = this.hipStandY;
      const L = hipY * k.len, rTop = spec.waist + 0.012, rBot = rTop + k.flare;
      const pts = [];
      for (let i = 0; i <= 6; i++) { const f = i / 6; pts.push(new THREE.Vector2(rTop + (rBot - rTop) * Math.pow(f, 1.4), top - f * L)); }
      const g = new THREE.LatheGeometry(pts.reverse(), 14); g.scale(1, 1, 0.82);
      const sm = mat(fabricTex('cotton', { color: k.color, amount: 7, seed: 44 }, 32, [3, 3]), { rough: 0.7 }); sm.side = THREE.DoubleSide;
      this.skirt = this.mk(g, sm, 'skirt', this.pelvis);
      this.skirtL = L;
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
      const tie = new THREE.TorusGeometry(0.03, 0.007, 4, 10); tie.rotateX(0.9); tie.translate(0, HEAD.ry * 0.7, -HEAD.rz * 0.68); add(tie, 'bunTie', mat(spec.bunTie || '#7e2633'));
    } else if (st === 'slick') {   // gelled back, shiny
      const g = hairShell((nx, ny, nz) => ny > -0.02 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.32 && nz > -0.4), { thick: 0.016, chunk: 0.003, seed: 31, scaleY: 1.05 });
      const hm = mat(fabricTex('cotton', { color: spec.hair, amount: 10, seed: 5 }), { rough: 0.5, metal: 0.0 });
      add(g, 'hair', hm);
    } else if (st === 'bald') {    // bald top, hair on the sides and back
      add(hairShell((nx, ny, nz) => ny < 0.4 && ny > -0.25 && nz < 0.15 && notFace(nx, ny, nz), { thick: 0.012, chunk: 0.007, seed: 33 }));
    } else if (st === 'combover') {
      add(hairShell((nx, ny, nz) => ny > 0.1 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.82 && ny < 0.35 && nz > -0.4), { thick: 0.006, chunk: 0.004, seed: 35 }));
      const strands = [];
      for (let i = 0; i < 5; i++) strands.push(tuft([0.05 - i * 0.004, HEAD.ry * 0.96, 0.03 - i * 0.022], [-1, 0.25, 0], 0.11, 0.009, 4, i));
      add(merge(strands), 'combover');
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
    } else if (st === 'bonnet') {   // white cloth cap with a frill round the face
      const bm = mat(fabricTex('cotton', { color: '#f2eee4', amount: 8, seed: 41 }), { rough: 0.9 });
      add(hairShell((nx, ny, nz) => ny > -0.2 && notFace(nx, ny, nz), { thick: 0.03, chunk: 0.004, seed: 41, scaleY: 1.08 }), 'bonnet', bm);
      const fr = new THREE.TorusGeometry(HEAD.rx * 1.05, 0.016, 4, 14, Math.PI * 1.2); fr.rotateZ(-Math.PI * 0.1); fr.rotateX(-0.25); fr.translate(0, 0.01, HEAD.rz * 0.42);
      add(fr, 'bonnetFrill', bm);
    } else if (st === 'wet') {      // soaking-wet messy hair: shiny, strands hanging down onto the forehead
      const wm = mat(fabricTex('cotton', { color: spec.hair, amount: 10, seed: 5 }), { rough: 0.15, metal: 0.25 });
      add(hairShell((nx, ny, nz) => ny > -0.1 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.8 && ny < 0.25 && nz > -0.3), { thick: 0.012, chunk: 0.01, seed: 3 }), 'hair', wm);
      const strands = [];
      for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.02; strands.push(tuft([x, HEAD.ry * 0.7, HEAD.rz * 0.55], [x * 1.5 + 0.15 * (i % 2 ? 1 : -1), -1, 0.35], 0.06 + 0.02 * (i % 3), 0.013, 4, i)); }
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; strands.push(tuft([Math.cos(a) * HEAD.rx * 0.9, HEAD.ry * 0.3, Math.sin(a) * HEAD.rz * 0.9 - 0.01], [Math.cos(a) * 0.3, -1, Math.sin(a) * 0.3], 0.07, 0.016, 4, i + 9)); }
      add(merge(strands), 'wetStrands', wm);
    } else if (st === 'pigtails') {   // two little pigtails on the sides
      add(hairShell((nx, ny, nz) => ny > -0.25 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.85 && ny < 0.2 && nz > -0.25), { thick: 0.01, chunk: 0.003, seed: 12 }));
      for (const sd of [-1, 1]) {
        const tail = new THREE.ConeGeometry(0.03, 0.13, 6); tail.rotateZ(sd * 2.4); tail.translate(sd * (HEAD.rx + 0.05), HEAD.ry * 0.1, -0.02); add(tail, 'pigtail');
        const tie = new THREE.TorusGeometry(0.016, 0.006, 4, 8); tie.rotateY(Math.PI / 2); tie.translate(sd * (HEAD.rx + 0.012), HEAD.ry * 0.25, -0.02); add(tie, 'tie', mat('#f07aa8'));
      }
    } else if (st === 'ponytail') {
      add(hairShell((nx, ny, nz) => ny > -0.25 && notFace(nx, ny, nz) && !(Math.abs(nx) > 0.85 && ny < 0.2 && nz > -0.25), { thick: 0.01, chunk: 0.003, seed: 11 }));
      const tie = new THREE.TorusGeometry(0.018, 0.006, 4, 8); tie.rotateX(1.2); tie.translate(0, HEAD.ry * 0.35, -HEAD.rz * 1.02); add(tie, 'tie', mat('#2aa39a'));
      const tail = new THREE.ConeGeometry(0.032, 0.17, 6); tail.rotateX(Math.PI + 0.35); tail.translate(0, HEAD.ry * 0.35 - 0.08, -HEAD.rz * 1.08 - 0.03); add(tail, 'ponytail');
    }
    if (spec.beard) {   // short beard along the jaw + under the chin (the mouth area stays free: big yells show)
      add(hairShell((nx, ny, nz) => ny < -0.3 && nz > -0.35 && (Math.abs(nx) > 0.46 || ny < -0.86), { thick: 0.009, chunk: 0.006, seed: 21 }), 'beard', M.beard);
      const mg = new THREE.BoxGeometry(0.06, 0.012, 0.016); mg.translate(0, -0.036, HEAD.rz * 0.93); add(mg, 'moustache', M.beard);
    }
  }

  defaults() {
    return {
      pos: [0, 0], rotY: 0, sit: 0, lean: 0, leanSide: 0, torsoYaw: 0, headYaw: 0, headPitch: 0, headRoll: 0, lookAt: null,
      eyes: 'open', pupils: [0, 0], brows: 'neutral', mouth: 'neutral', talk: 0, chewPh: 0,
      handL: null, handR: null, handPoseL: 'relaxed', handPoseR: 'relaxed', handRotL: null, handRotR: null, gripL: null, gripR: null,
      bounce: 0, bellyWobble: 0, legBounce: 0, visible: true, eat: null, shoulderUp: 0, walk: null, y: 0, chestPuff: 0,
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

export function solve(ch, t) {
  const p = ch.p, s = ch.s, spec = ch.spec;
  ch.root.visible = p.visible;
  if (!p.visible) return;
  ch.root.position.set(p.pos[0], p.y || 0, p.pos[1]);
  if (ch.skirt) ch.skirt.visible = p.sit < 0.5;
  ch.root.rotation.set(0, p.rotY, 0);
  const sit = clamp(p.sit);
  const seatHip = CHAIR.seatY + ch.thighR * 0.92;
  const hipY = lerp(ch.hipStandY, seatHip, sit) + p.bounce * 0.012 * Math.abs(Math.sin(t * 19)) - (p.walk != null ? 0.02 * s * (1 - Math.abs(Math.cos(p.walk))) : 0);
  ch.pelvis.position.set(0, hipY, lerp(0, 0.02, sit));
  ch.pelvis.rotation.set(0, p.torsoYaw * 0.3, 0);
  const breathe = Math.sin(t * 1.6 + hash1(s * 13) * 6) * 0.008;
  ch.chest.rotation.set(p.lean + (spec.hunch || 0) + breathe - p.bounce * 0.08 * (0.5 + 0.5 * Math.sin(t * 19)), p.torsoYaw * 0.7, p.leanSide, 'YXZ');
  ch.chest.scale.set(1 + p.chestPuff * 0.12, 1 + p.chestPuff * 0.05, 1 + p.bellyWobble * 0.06 * Math.sin(t * 23) + breathe * 0.4 + p.chestPuff * 0.35);
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
      } else { // standing rest: arms hang (and swing when walking)
        const sw = p.walk != null ? -Math.sin(p.walk + (sx > 0 ? 0 : Math.PI)) * 0.14 * s : 0;
        wristW = V(sx * (ch.shoulderW + 0.02), ch.pelvis.position.y - 0.07 * s, 0.03 + sw).applyMatrix4(ch.root.matrixWorld);
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
      let az = 0.02, ay = ch.ankleH;
      if (p.walk != null) {                       // walk cycle: phase in radians, legs opposite
        const ph = p.walk + (sx > 0 ? 0 : Math.PI);
        az += Math.sin(ph) * 0.2 * s;
        ay += Math.max(0, Math.cos(ph)) * 0.06 * s;
      }
      ({ J, E } = ik3(hip, V(sx * (ch.hipW + 0.01), ay, az), ch.legL[0], ch.legL[1], hip.clone().add(V(0, -0.3, 1))));
    }
    placeBone(L.th, hip, J); placeBone(L.sh, J, E);
    L.shoe.position.copy(E); L.shoe.rotation.set(0, 0, 0);
  }
}

// ------------------------------------------------------------------ cast
export function makeChar(world, name, over = {}) {
  const key = name.replace(/#\d+$/, '');   // 'oldman#2' = a second copy of the oldman spec
  const base = SPECS[key] || (key.startsWith('crowd') ? crowdSpec(Number(key.slice(5)) || 0) : key.startsWith('guest') ? guestSpec(Number(key.slice(5)) || 0) : oldSpec(Number(key.slice(3)) || 0));
  const spec = { ...base, ...over, face: { ...base.face, ...(over.face || {}) } };
  const ch = new Character(name, spec, world);
  return ch;
}

export const helpers = {
  talk(ch, t, intensity = 1) {
    const v = Math.max(0, noise1(t * 9, ch.s * 31) * 0.6 + noise1(t * 17, ch.s * 7) * 0.5 + 0.25);
    ch.p.talk = clamp(v * intensity);
  },
  blink(ch, t) {
    const per = 2.6 + hash1(ch.s * 77) * 2.4, ph = ((t + hash1(ch.s * 13) * per) % per) / per;
    if (ph > 0.965) ch.p.eyes = 'closed';
  },
};
