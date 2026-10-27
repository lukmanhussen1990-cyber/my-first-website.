// The supporting cast of "Larry's Haunted House": 3 costumed kids, 3 goofy zombies, a witch on a
// broom, a vampire with a swooshing cape, a chicken, and crowd people for the long lines.
// All built with the shared toon rig so they match Larry and John.
import * as THREE from 'three';
import { Character } from '../../engine/toon/rig.js';
import { clay, cloth, glow, PAL } from '../../engine/toon/materials.js';
import { sphere, roundedBox, limb, blob, torus, capsule, cyl, cone, smoothLathe, weldSeamNormals } from '../../engine/toon/geom.js';
import { mulberry32, clamp, lerp, smooth } from '../../engine/toon/anim.js';

// ---- body templates -----------------------------------------------------------------------------
function kidBody(o) {
  return {
    name: o.name, seed: o.seed, skin: o.skin || '#f6c8a8', skinShade: o.skinShade || '#e6ab8a', faceSize: o.faceSize || 768,
    headR: 0.2, neck: 0.01, hipH: 0.25, hipX: 0.065, shoulderY: 0.25, shoulderX: 0.13,
    torso: o.torso || [{ name: 'shirt', color: o.shirt, profile: [[0, -0.04], [0.14, -0.04], [0.16, 0.05], [0.155, 0.16], [0.12, 0.24], [0.06, 0.275], [0, 0.28]] }],
    arm: { upper: 0.105, lower: 0.1, r0: 0.042, r1: 0.038, r2: 0.036, handR: 0.048, upperMat: clay(o.sleeve || o.shirt), lowerMat: o.bareArms ? undefined : clay(o.sleeve || o.shirt) },
    leg: { upper: 0.115, lower: 0.115, r0: 0.052, r1: 0.046, r2: 0.044, upperMat: clay(o.legs), lowerMat: clay(o.legs),
      shoe: (ch, foot) => { ch.mesh(roundedBox(0.09, 0.055, 0.15, 0.025, 3), clay(o.shoes || '#3a3a44'), foot, [0, -0.03, 0.03]); } },
    faceStyle: { eyeX: 0.34, eyeY: 0.1, eyeRX: 0.17, eyeRY: 0.21, pupilR: 0.09, mouthY: -0.4, mouthW: 0.26, browY: 0.42, ...(o.face || {}) },
    noseR: 0.12, noseY: -0.12, hair: o.hair, extras: o.extras,
  };
}
function adultBody(o) {
  return {
    name: o.name, seed: o.seed, skin: o.skin, skinShade: o.skinShade, faceSize: o.faceSize || 768,
    headR: 0.24, neck: 0.025, hipH: 0.5, hipX: 0.085, shoulderY: 0.42, shoulderX: 0.17,
    torso: o.torso || [{ name: 'shirt', color: o.shirt, profile: [[0, -0.06], [0.17, -0.06], [0.19, 0.05], [0.185, 0.2], [0.19, 0.31], [0.16, 0.4], [0.09, 0.44], [0, 0.45]], sz: 0.86 }],
    arm: { upper: 0.21, lower: 0.19, r0: 0.058, r1: 0.052, r2: 0.05, handR: 0.062, upperMat: clay(o.sleeve || o.shirt), lowerMat: o.bareArms ? undefined : clay(o.sleeve || o.shirt) },
    leg: { upper: 0.23, lower: 0.24, r0: 0.072, r1: 0.062, r2: 0.058, upperMat: clay(o.legs), lowerMat: clay(o.legs),
      shoe: (ch, foot) => { ch.mesh(roundedBox(0.11, 0.07, 0.2, 0.03, 3), clay(o.shoes || '#3b3436'), foot, [0, -0.035, 0.035]); } },
    faceStyle: { eyeX: 0.34, eyeY: 0.11, eyeRX: 0.15, eyeRY: 0.19, pupilR: 0.08, mouthY: -0.42, mouthW: 0.27, browY: 0.43, ...(o.face || {}) },
    noseR: o.noseR || 0.13, noseY: -0.1, noseColor: o.noseColor, hair: o.hair, extras: o.extras, ears: o.ears,
  };
}

// hair helpers
function capHair(color, { tilt = -0.5, cover = 0.55, scale = 1.04 } = {}) {
  return (ch, skull) => {
    const R = ch.spec.headR;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R * scale, 40, 20, 0, Math.PI * 2, 0, Math.PI * cover), clay(color));
    cap.rotation.x = tilt; cap.castShadow = true; skull.add(cap);
  };
}
function messyClumps(color, seed, n = 14, size = 0.06) {
  return (ch, skull) => {
    capHair(color, { tilt: -0.45, cover: 0.55 })(ch, skull);
    const R = ch.spec.headR, rnd = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, el = 0.2 + rnd() * 1.2;
      const d = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
      if (d[2] > 0.5 && d[1] < 0.7) continue;
      const m = ch.mesh(cone(size * (0.7 + rnd() * 0.6), size * (2 + rnd() * 1.5), 10), clay(color), skull, [d[0] * R * 1.0, d[1] * R * 1.0, d[2] * R * 1.0]);
      m.lookAt(m.position.clone().multiplyScalar(3).add(new THREE.Vector3(rnd() - 0.5, 0.5, rnd() - 0.5)));
      m.rotateX(Math.PI / 2);
    }
  };
}

// ---- kids ---------------------------------------------------------------------------------------
function pumpkinBody(r = 0.19, h = 0.3, ribs = 8) {
  const g = new THREE.SphereGeometry(1, 48, 32);
  const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const th = Math.atan2(v.x, v.z);
    const rib = 1 - 0.07 * Math.pow(Math.abs(Math.cos(th * ribs / 2)), 0.6);
    v.x *= r * rib; v.z *= r * rib; v.y *= h / 2;
    if (v.y > h * 0.42) v.y = h * 0.42 + (v.y - h * 0.42) * 0.4;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function makePumpkinKid() {
  const ch = new Character(kidBody({
    name: 'pumpkinKid', seed: 21, shirt: '#2d2a33', legs: '#2d2a33', shoes: '#4c8a3c',
    torso: [{ name: 'shirt', color: '#2d2a33', profile: [[0, -0.02], [0.1, -0.02], [0.11, 0.1], [0.1, 0.24], [0.06, 0.27], [0, 0.28]] }],
    hair: (ch, skull) => {
      capHair('#8a5532', { tilt: -0.55, cover: 0.5 })(ch, skull);
      // green stem hat with a leaf
      ch.mesh(cyl(0.05, 0.07, 0.07, 16), clay('#4c8a3c'), skull, [0, 0.21, 0]);
      ch.mesh(cyl(0.025, 0.035, 0.09, 12), clay('#6b4a2a'), skull, [0.01, 0.28, 0], [0, 0, 0.25]);
      const leaf = ch.mesh(sphere(0.05, 16, 10), clay('#5fae43'), skull, [0.07, 0.25, 0.02], [0, 0.4, -0.5], [1.4, 0.25, 0.8]);
    },
    extras: (ch) => {
      // the pumpkin costume around the body
      const pk = new THREE.Mesh(pumpkinBody(0.215, 0.33), clay('#f58a1f', { roughness: 0.6 }));
      pk.position.set(0, 0.13, 0); pk.castShadow = true; pk.receiveShadow = true; ch.joints.spine.add(pk);
      // jack-o'-lantern face on the costume
      const face = new THREE.Group(); face.position.set(0, 0.12, 0.2); ch.joints.spine.add(face);
      const dark = clay('#3a1d0c');
      for (const x of [-0.06, 0.06]) { const e = ch.mesh(cone(0.028, 0.04, 3), dark, face, [x, 0.05, 0.005], [Math.PI / 2, 0, 0], [1, 0.3, 1]); }
      ch.mesh(roundedBox(0.12, 0.03, 0.02, 0.01), dark, face, [0, -0.03, 0.0]);
    },
  }));
  ch.setFace('happy');
  return ch;
}

export function makeWitchKid() {
  const ch = new Character(kidBody({
    name: 'witchKid', seed: 22, shirt: '#7b4bb3', legs: '#3b2a4a', shoes: '#2a2230',
    torso: [{ name: 'dress', color: '#7b4bb3', attach: 'hips', profile: [[0, -0.14], [0.2, -0.14], [0.17, 0.0], [0.14, 0.12], [0.15, 0.28], [0.12, 0.38], [0.06, 0.42], [0, 0.43]] }],
    face: { lashes: true, blush: 'rgba(255,110,140,0.6)' },
    hair: (ch, skull) => {
      capHair('#c4561a', { tilt: -0.5, cover: 0.55 })(ch, skull);
      for (const side of [-1, 1]) ch.mesh(sphere(0.07, 16, 12), clay('#c4561a'), skull, [side * 0.19, -0.05, -0.05], [0, 0, 0], [0.8, 1.2, 0.8]);
      // pointy witch hat with a purple band
      ch.mesh(cyl(0.3, 0.3, 0.02, 32), clay('#2a2230'), skull, [0, 0.15, 0], [-0.1, 0, 0.05]);
      const hat = ch.mesh(cone(0.17, 0.42, 24), clay('#2a2230'), skull, [0, 0.36, -0.02], [-0.15, 0, 0.15]);
      ch.mesh(cyl(0.165, 0.17, 0.05, 24), clay('#a874e8'), skull, [0, 0.18, 0], [-0.1, 0, 0.05]);
    },
  }));
  ch.setFace('happy');
  return ch;
}

export function makeDinoKid() {
  const green = '#5cc25a';
  const ch = new Character(kidBody({
    name: 'dinoKid', seed: 23, shirt: green, legs: green, shoes: '#3f8f3d',
    torso: [{ name: 'suit', color: green, profile: [[0, -0.06], [0.15, -0.06], [0.17, 0.05], [0.165, 0.16], [0.13, 0.24], [0.06, 0.28], [0, 0.285]] }],
    hair: (ch, skull) => {
      const R = 0.2;
      // hood: covers the top, back and sides of the head, face showing in front
      const hood = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.72), clay(green));
      hood.rotation.x = -0.95; hood.castShadow = true; skull.add(hood);
      // spikes along the top and back
      for (let k = 0; k < 5; k++) {
        const a = -0.3 + k * 0.45;
        const m = ch.mesh(cone(0.045, 0.1, 12), clay('#f2c230'), skull, [0, Math.cos(a) * R * 1.13, -Math.sin(a) * R * 1.13], [-a, 0, 0]);
      }
      // little teeth on the hood brim
      for (let k = -3; k <= 3; k++) ch.mesh(cone(0.014, 0.03, 8), clay('#ffffff'), skull, [k * 0.045, 0.16, 0.14 - Math.abs(k) * 0.012], [Math.PI, 0, 0]);
    },
    extras: (ch) => {
      // tail and lighter belly
      const tail = ch.mesh(cone(0.08, 0.32, 16), clay(green), ch.joints.hips, [0, 0.0, -0.18], [-1.9, 0, 0]);
      ch.mesh(sphere(0.12, 20, 14), clay('#b6e68a'), ch.joints.spine, [0, 0.1, 0.07], [0, 0, 0], [0.9, 1.1, 0.6]);
      for (let k = 0; k < 3; k++) ch.mesh(cone(0.035, 0.07, 10), clay('#f2c230'), ch.joints.spine, [0, 0.18 - k * 0.09, -0.15 - k * 0.01], [-1.3, 0, 0]);
    },
  }));
  ch.setFace('happy');
  return ch;
}

// ---- zombies ------------------------------------------------------------------------------------
function tornHem(ch, parent, r, y, color, n = 11, seed = 1) {
  const rnd = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 0.05 + rnd() * 0.05;
    const m = ch.mesh(cone(0.045, h, 4), clay(color), parent, [Math.sin(a) * r, y - h / 2, Math.cos(a) * r], [Math.PI, a, 0], [1, 1, 0.35]);
  }
}
const ZOMBIES = [
  { shirt: '#5a8fc0', legs: '#6e5440', hair: '#3a2c3a', eyeScale: [1.15, 0.85], pupilSplay: [[-0.5, 0.3], [0.6, -0.4]] },
  { shirt: '#9a6bc0', legs: '#5d5d66', hair: '#5c3a22', eyeScale: [0.85, 1.1], pupilSplay: [[0.5, 0.5], [-0.3, -0.5]] },
  { shirt: '#d4a64a', legs: '#4d5a3f', hair: '#2a2a30', eyeScale: [1.0, 1.0], pupilSplay: [[0.6, 0.0], [-0.6, 0.0]] },
];
export function makeZombie(i = 0) {
  const z = ZOMBIES[i % 3];
  const ch = new Character(adultBody({
    name: 'zombie' + i, seed: 31 + i, skin: '#a7d98d', skinShade: '#8fc477', shirt: z.shirt, legs: z.legs, bareArms: true,
    sleeve: z.shirt, shoes: '#4b3d33',
    face: { eyeScale: z.eyeScale, pupilSplay: z.pupilSplay, blush: 'rgba(120,170,90,0.55)', lid: '#8fc477', browColor: '#3c4a30', mouthIn: '#5a2232' },
    hair: messyClumps(z.hair, 40 + i, 16, 0.055),
    extras: (ch) => {
      tornHem(ch, ch.joints.spine, 0.18, -0.03, z.shirt, 12, 7 + i);
      // torn sleeve edges
      for (const L of ['L', 'R']) tornHem(ch, ch.joints['sh' + L], 0.06, -0.12, z.shirt, 6, 3 + i);
      // a patch on the shirt (torn but clean)
      ch.mesh(roundedBox(0.07, 0.06, 0.02, 0.01), clay('#e8e1d0'), ch.joints.spine, [0.07, 0.22, 0.165], [0, 0.4, 0.3]);
    },
  }));
  // short sleeves: the upper arm is shirt, the forearm is green skin
  ch.setFace('tongue', { pupil: [0, 0] });
  return ch;
}

// ---- witch on a broom ---------------------------------------------------------------------------
export function makeWitch() {
  const ch = new Character(adultBody({
    name: 'witch', seed: 41, skin: '#b9e3a0', skinShade: '#a0cc88', shirt: '#6a3fa6', legs: '#2c2236', shoes: '#2a2230', noseR: 0.17, noseColor: '#a8d690',
    torso: [{ name: 'dress', color: '#6a3fa6', attach: 'hips', profile: [[0, -0.42], [0.3, -0.42], [0.25, -0.2], [0.19, 0.05], [0.19, 0.3], [0.18, 0.42], [0.16, 0.5], [0.09, 0.55], [0, 0.56]], sz: 0.9 }],
    face: { lashes: true, blush: 'rgba(120,180,90,0.5)', lid: '#a0cc88', browColor: '#3a2a20' },
    hair: (ch, skull) => {
      const R = 0.24;
      capHair('#e4652a', { tilt: -0.4, cover: 0.6 })(ch, skull);
      for (let k = 0; k < 9; k++) {
        const a = Math.PI + (k - 4) * 0.33;
        ch.mesh(blob(0.07, 2, 0.1, k + 3), clay('#e4652a'), skull, [Math.sin(a) * R * 1.0, -0.1 - (k % 3) * 0.05, Math.cos(a) * R * 1.0]);
      }
      ch.mesh(cyl(0.36, 0.36, 0.025, 40), clay('#241c2c'), skull, [0, 0.17, 0], [-0.08, 0, 0.06]);
      ch.mesh(cone(0.2, 0.55, 28), clay('#241c2c'), skull, [0.03, 0.43, -0.05], [-0.25, 0, -0.2]);
      ch.mesh(cyl(0.2, 0.205, 0.06, 28), clay('#f0a830'), skull, [0, 0.2, 0], [-0.08, 0, 0.06]);
    },
  }));
  // broom: stick + straw bundle; she sits on it
  const broom = new THREE.Group(); broom.name = 'broom';
  const stick = new THREE.Mesh(cyl(0.025, 0.025, 1.7, 12), clay('#9a6a3a')); stick.rotation.z = Math.PI / 2; stick.castShadow = true; broom.add(stick);
  const straw = new THREE.Mesh(cone(0.17, 0.42, 20), clay('#e6c25a', { roughness: 0.95 })); straw.rotation.z = Math.PI / 2; straw.position.x = -0.95; straw.castShadow = true; broom.add(straw);
  const tie = new THREE.Mesh(cyl(0.06, 0.06, 0.05, 16), clay('#c0392b')); tie.rotation.z = Math.PI / 2; tie.position.x = -0.73; broom.add(tie);
  ch.broom = broom;
  ch.setFace('happy');
  return ch;
}

// ---- vampire with a swooshing cape ------------------------------------------------------------
export class Cape extends THREE.Group {
  constructor() {
    super();
    this.rings = 30; this.segs = 40;
    const n = (this.rings + 1) * (this.segs + 1);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = [];
    for (let i = 0; i < this.rings; i++) for (let j = 0; j < this.segs; j++) {
      const a = i * (this.segs + 1) + j, b = a + this.segs + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    this.geo.setIndex(idx);
    const outer = clay('#1d1a24', { roughness: 0.6, side: THREE.FrontSide });
    const inner = clay('#b3122a', { roughness: 0.5, side: THREE.BackSide });
    this.outer = new THREE.Mesh(this.geo, outer); this.inner = new THREE.Mesh(this.geo, inner);
    for (const m of [this.outer, this.inner]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.add(m); }
    this.params = { open: 0.35, flare: 1, swoosh: 0, t: 0, up: 0 };
    this.update();
  }
  set(p) { Object.assign(this.params, p); this.update(); }
  update() {
    const P = this.params, pos = this.geo.attributes.position.array, R = this.rings, S = this.segs;
    let k = 0;
    // the cape hangs from the shoulders (y=0) down to the ankles (y=-1.0); wraps around the back
    const arc = Math.PI * 2 * (1 - P.open * 0.5);
    for (let i = 0; i <= R; i++) {
      const v = i / R;
      const y = -v * 1.0 + P.up * v * v * 0.8;
      const r = 0.2 + v * 0.22 * P.flare + P.swoosh * v * 0.35;
      for (let j = 0; j <= S; j++) {
        const u = j / S;
        const th = Math.PI + (u - 0.5) * arc;                // centred at the back
        const wave = Math.sin(u * 9 + P.t * 6) * 0.03 * v + P.swoosh * Math.sin(u * Math.PI) * v * 0.25;
        pos[k++] = Math.sin(th) * (r + wave);
        pos[k++] = y + P.swoosh * Math.sin(u * Math.PI * 2 + P.t * 4) * 0.08 * v;
        pos[k++] = Math.cos(th) * (r + wave) - 0.02;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }
}
export function makeVampire() {
  const ch = new Character(adultBody({
    name: 'vampire', seed: 51, skin: '#ece3f2', skinShade: '#d6c8e2', shirt: '#26222e', legs: '#26222e', shoes: '#151318',
    face: { fangs: true, blush: 'rgba(200,120,170,0.45)', lid: '#d6c8e2', browColor: '#141218' },
    hair: (ch, skull) => {
      const R = 0.24;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), clay('#141218', { roughness: 0.35 }));
      cap.rotation.x = -0.35; cap.castShadow = true; skull.add(cap);
      // widow's peak
      ch.mesh(cone(0.07, 0.12, 4), clay('#141218', { roughness: 0.35 }), skull, [0, R * 0.62, R * 0.8], [Math.PI + 0.65, 0, 0], [1, 1, 0.3]);
    },
    extras: (ch) => {
      // white shirt front + red bow tie + medallion
      ch.mesh(roundedBox(0.12, 0.2, 0.02, 0.01), clay('#f2eef4'), ch.joints.spine, [0, 0.3, 0.16], [-0.08, 0, 0]);
      ch.mesh(sphere(0.03, 12, 10), clay('#c0182c'), ch.joints.chest, [0, -0.02, 0.15], [0, 0, 0], [2.2, 1, 0.6]);
      // tall collar
      for (const side of [-1, 1]) ch.mesh(roundedBox(0.2, 0.26, 0.02, 0.01), clay('#b3122a'), ch.joints.chest, [side * 0.13, 0.12, -0.08], [0.25, side * -0.6, side * -0.25]);
      const cape = new Cape(); cape.position.set(0, 0.0, 0); ch.joints.chest.add(cape); ch.cape = cape;
    },
  }));
  ch.setFace('grin');
  return ch;
}

// ---- chicken ------------------------------------------------------------------------------------
export function makeChicken() {
  const g = new THREE.Group(); g.name = 'chicken';
  const white = clay('#fbf7ef'), red = clay('#e2332e'), yellow = clay('#f5b83a');
  const body = new THREE.Group(); g.add(body); body.position.y = 0.2;
  const add = (geo, mat, parent, p, r = [0, 0, 0], s = [1, 1, 1]) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); m.scale.set(...s); m.castShadow = true; parent.add(m); return m; };
  add(sphere(0.14, 28, 20), white, body, [0, 0, 0], [0, 0, 0], [1, 0.9, 1.25]);
  const head = new THREE.Group(); head.position.set(0, 0.15, 0.11); body.add(head);
  add(sphere(0.075, 24, 18), white, head, [0, 0, 0]);
  for (let k = 0; k < 3; k++) add(sphere(0.025, 12, 10), red, head, [0, 0.07 + (k === 1 ? 0.01 : 0), -0.025 + k * 0.025]);
  add(sphere(0.02, 12, 10), red, head, [0, -0.05, 0.06], [0, 0, 0], [1, 1.5, 1]);
  const beakT = add(cone(0.028, 0.06, 12), yellow, head, [0, 0.0, 0.085], [Math.PI / 2, 0, 0]);
  const beakB = add(cone(0.02, 0.04, 12), yellow, head, [0, -0.018, 0.08], [Math.PI / 2 + 0.3, 0, 0]);
  for (const side of [-1, 1]) add(sphere(0.012, 10, 8), clay('#1a1412'), head, [side * 0.045, 0.02, 0.055]);
  const wings = [];
  for (const side of [-1, 1]) { const w = add(sphere(0.09, 20, 14), white, body, [side * 0.12, 0.01, -0.01], [0, 0, side * 0.3], [0.35, 0.75, 1.0]); wings.push(w); }
  for (let k = 0; k < 3; k++) add(cone(0.04, 0.14, 10), white, body, [0, 0.09 + k * 0.02, -0.17], [-0.6 + k * 0.25, 0, 0], [1, 1, 0.5]);
  for (const side of [-1, 1]) {
    add(cyl(0.012, 0.012, 0.12, 8), yellow, g, [side * 0.05, 0.06, 0.0]);
    add(roundedBox(0.05, 0.012, 0.07, 0.005), yellow, g, [side * 0.05, 0.005, 0.02]);
  }
  g.userData = { head, beakB, wings, body };
  g.bawk = (t, amt) => {           // head bob, wing flap, beak open
    head.position.z = 0.11 + Math.sin(t * 22) * 0.02 * amt;
    head.rotation.x = -0.3 * amt;
    beakB.rotation.x = Math.PI / 2 + 0.3 + 0.5 * amt;
    wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * (0.3 + Math.abs(Math.sin(t * 25)) * 0.9 * amt); });
    body.position.y = 0.2 + Math.abs(Math.sin(t * 12)) * 0.05 * amt;
  };
  return g;
}

// ---- crowd people (simple costumes, small face textures) ---------------------------------------
const COSTUMES = [
  { shirt: '#f58a1f', legs: '#2d2a33', hat: 'pumpkin' }, { shirt: '#7b4bb3', legs: '#2c2236', hat: 'witch' },
  { shirt: '#5cc25a', legs: '#3f8f3d', hat: 'dino' }, { shirt: '#fbfbf6', legs: '#fbfbf6', hat: 'sheet' },
  { shirt: '#26222e', legs: '#26222e', hat: 'bat' }, { shirt: '#d94a4a', legs: '#2c3e8a', hat: 'devil' },
  { shirt: '#3a76c4', legs: '#d8c48a', hat: 'pirate' }, { shirt: '#f2d34a', legs: '#4a4a52', hat: 'cat' },
];
export function makeCrowdPerson(i, adult = false) {
  const rnd = mulberry32(100 + i);
  const c = COSTUMES[i % COSTUMES.length];
  const skins = ['#f6c8a8', '#e8b38c', '#c98d63', '#9b6a48', '#f2d0b8'];
  const o = { name: 'crowd' + i, seed: 200 + i, skin: skins[i % skins.length], shirt: c.shirt, legs: c.legs, faceSize: 256,
    face: { pupilSplay: [[0, 0], [0, 0]] },
    hair: (ch, skull) => {
      const R = ch.spec.headR;
      capHair(['#3a2618', '#8a5532', '#d9a44a', '#1c1c22'][i % 4], { tilt: -0.5, cover: 0.52 })(ch, skull);
      if (c.hat === 'witch') { ch.mesh(cyl(R * 1.5, R * 1.5, 0.02, 24), clay('#2a2230'), skull, [0, R * 0.75, 0]); ch.mesh(cone(R * 0.85, R * 2.0, 20), clay('#2a2230'), skull, [0, R * 1.7, -0.02], [-0.15, 0, 0.1]); }
      if (c.hat === 'pumpkin') ch.mesh(cyl(R * 0.2, R * 0.28, R * 0.35, 12), clay('#4c8a3c'), skull, [0, R * 1.1, 0]);
      if (c.hat === 'devil' || c.hat === 'cat' || c.hat === 'bat') for (const s of [-1, 1]) ch.mesh(cone(R * 0.22, R * 0.55, 12), clay(c.hat === 'devil' ? '#d92b2b' : '#26222e'), skull, [s * R * 0.55, R * 0.92, 0], [0, 0, -s * 0.35]);
      if (c.hat === 'pirate') ch.mesh(cyl(R * 1.25, R * 1.1, R * 0.4, 20), clay('#1c1c22'), skull, [0, R * 0.95, 0], [-0.1, 0, 0], [1, 1, 0.6]);
      if (c.hat === 'dino') for (let k = 0; k < 3; k++) ch.mesh(cone(R * 0.2, R * 0.45, 10), clay('#f2c230'), skull, [0, R * (1.0 - k * 0.12), -R * k * 0.4], [-k * 0.5, 0, 0]);
      if (c.hat === 'sheet') { const s = ch.mesh(sphere(R * 1.15, 24, 18), clay('#f6f4f1'), skull, [0, 0, 0]); }
    },
  };
  const ch = new Character(adult ? adultBody(o) : kidBody(o));
  ch.setFace(['happy', 'grin', 'neutral', 'happy'][Math.floor(rnd() * 4)]);
  return ch;
}
