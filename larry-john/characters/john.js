// JOHN: the builder. Friendly young guy, messy brown hair, red hoodie, jeans, running shoes,
// yellow tool belt. Calm and patient; does a tired facepalm when Larry messes up.
import * as THREE from 'three';
import { Character } from '../engine/toon/rig.js';
import { clay, cloth, metal, PAL } from '../engine/toon/materials.js';
import { sphere, roundedBox, limb, blob, torus, capsule, cyl, cone } from '../engine/toon/geom.js';
import { mulberry32 } from '../engine/toon/anim.js';

export const JOHN_SPEC = {
  name: 'john', seed: 3,
  skin: '#f1bf98', skinShade: '#dfa27f',
  headR: 0.245, neck: 0.03,
  hipH: 0.53, hipX: 0.085,
  shoulderY: 0.43, shoulderX: 0.175,
  torso: [
    // red hoodie
    { name: 'hoodie', color: PAL.hoodie, profile: [[0.0, -0.06], [0.175, -0.055], [0.198, 0.03], [0.192, 0.17], [0.2, 0.31], [0.172, 0.405], [0.1, 0.45], [0.0, 0.46]], sz: 0.85 },
    // jeans seat
    { name: 'jeansTop', color: PAL.jeans, attach: 'hips', profile: [[0.0, -0.09], [0.15, -0.09], [0.182, -0.04], [0.185, 0.0], [0.0, 0.0]], sz: 0.85 },
  ],
  arm: { upper: 0.22, lower: 0.2, r0: 0.062, r1: 0.056, r2: 0.054, handR: 0.066,
    upperMat: clay(PAL.hoodie), lowerMat: clay(PAL.hoodie),
    cuff: { r0: 0.062, r1: 0.06, len: 0.045, color: '#c42a2e' } },
  leg: { upper: 0.24, lower: 0.25, r0: 0.075, r1: 0.064, r2: 0.06,
    upperMat: clay(PAL.jeans), lowerMat: clay(PAL.jeans),
    sock: { r0: 0.066, r1: 0.066, len: 0.03, color: '#5c84c4' },
    shoe: (ch, foot, side) => runningShoe(ch, foot, side) },
  faceStyle: {
    eyeX: 0.34, eyeY: 0.12, eyeRX: 0.15, eyeRY: 0.185, pupilR: 0.08,
    mouthY: -0.42, mouthW: 0.27, browColor: '#4a2a16', browY: 0.43, lineW: 0.032,
    blush: 'rgba(255,120,120,0.42)', blushX: 0.54, blushY: -0.2,
    freckles: [[-0.2, -0.13, 0.012], [-0.26, -0.1, 0.011], [0.2, -0.13, 0.012], [0.26, -0.1, 0.011]],
  },
  noseR: 0.13, noseY: -0.1, noseColor: '#eeb08e',
  hair: (ch, skull) => messyHair(ch, skull),
  extras: (ch) => johnExtras(ch),
};

function runningShoe(ch, foot, side) {
  const white = clay(PAL.shoe, { roughness: 0.55 }), blue = clay(PAL.shoeAccent), sole = clay('#d9d9d9');
  ch.mesh(roundedBox(0.12, 0.075, 0.23, 0.035, 4), white, foot, [0, -0.03, 0.045]);
  ch.mesh(roundedBox(0.128, 0.025, 0.24, 0.012, 3), sole, foot, [0, -0.07, 0.045]);
  ch.mesh(roundedBox(0.13, 0.02, 0.12, 0.008, 2), blue, foot, [0, -0.025, 0.03], [0.35, 0, 0]);
}

function messyHair(ch, skull) {
  const R = JOHN_SPEC.headR;
  const mats = [clay(PAL.johnHair), clay('#7c4826'), clay('#56301a')];
  const rnd = mulberry32(17);
  // base: a cap over the top and back of the head
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.035, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), mats[0]);
  cap.rotation.x = -0.56; cap.position.set(0, 0.014, -0.012); cap.castShadow = true; cap.receiveShadow = true; skull.add(cap);
  // tufts lying along the head, swept forward and to the right, tips lifting off
  const up = new THREE.Vector3(0, 1, 0);
  const tuft = (dir, sweep, len, wid, lift, mat) => {
    const n = new THREE.Vector3(...dir).normalize();
    const t = new THREE.Vector3(...sweep).projectOnPlane(n).normalize();
    const b = new THREE.Vector3().crossVectors(n, t);
    const m = ch.mesh(blob(1, 2, 0.06, 3), mat, skull);
    m.matrixAutoUpdate = true;
    const basis = new THREE.Matrix4().makeBasis(b, n, t);
    m.quaternion.setFromRotationMatrix(basis);
    m.rotateX(-lift);                                     // tip lifts away from the scalp
    m.scale.set(wid, wid * 0.5, len);
    m.position.copy(n.clone().multiplyScalar(R * 1.02)).addScaledVector(t, len * 0.45);
  };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, el = 0.25 + rnd() * 1.2;
    const dir = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
    if (dir[2] > 0.45 && dir[1] < 0.75) continue;          // keep the face clear
    const sweep = [0.6 + rnd() * 0.5, 0.5 + rnd() * 0.4, 0.8];
    tuft(dir, sweep, 0.075 + rnd() * 0.04, 0.045 + rnd() * 0.015, 0.25 + rnd() * 0.45, mats[i % 3]);
  }
  // messy fringe falling over the forehead to his right
  for (const [x, y, l] of [[-0.35, 0.8, 0.09], [-0.12, 0.88, 0.1], [0.12, 0.88, 0.09], [0.35, 0.78, 0.08]]) {
    tuft([x, y, 0.5], [-0.55, -0.45, 0.6], l, 0.05, 0.18, mats[1]);
  }
  // cowlick on the crown
  tuft([0.1, 1, -0.15], [0.2, 0.6, -1], 0.09, 0.04, 0.9, mats[2]);
  tuft([-0.05, 1, -0.05], [-0.4, 0.8, 0.6], 0.08, 0.04, 0.8, mats[0]);
}

function johnExtras(ch) {
  const J = ch.joints;
  const red = clay(PAL.hoodie), dark = clay('#b92b2f');
  // hood bunched behind the neck
  ch.mesh(torus(0.13, 0.055, 14, 32, Math.PI * 1.25), red, J.chest, [0, 0.03, -0.06], [Math.PI / 2 + 0.25, 0, Math.PI * 0.125 + Math.PI]);
  // collar + drawstrings
  ch.mesh(torus(0.1, 0.03, 10, 28), red, J.chest, [0, 0.02, 0.0], [Math.PI / 2, 0, 0], [1, 0.9, 1]);
  for (const side of [-1, 1]) {
    ch.mesh(capsule(0.009, 0.12, 4, 8), clay('#ffffff'), J.chest, [side * 0.045, -0.06, 0.15], [0.12, 0, 0]);
  }
  // kangaroo pocket
  ch.mesh(roundedBox(0.24, 0.1, 0.03, 0.014, 3), dark, J.spine, [0, 0.1, 0.17], [-0.06, 0, 0]);
  // waistband
  ch.mesh(torus(0.178, 0.02, 10, 40), dark, J.spine, [0, -0.04, 0], [Math.PI / 2, 0, 0], [1, 0.85, 1]);
  // yellow tool belt with pouches, a hammer and a tape measure
  const belt = clay(PAL.toolBelt, { roughness: 0.6 });
  ch.mesh(torus(0.19, 0.026, 10, 44), belt, J.hips, [0, -0.005, 0], [Math.PI / 2, 0, 0], [1, 0.87, 1], 'toolBelt');
  ch.mesh(roundedBox(0.045, 0.04, 0.012, 0.005), metal('#c9c9c9'), J.hips, [0, -0.005, 0.168]);
  const pouch = clay('#e4a321', { roughness: 0.6 });
  for (const side of [-1, 1]) {
    ch.mesh(roundedBox(0.09, 0.11, 0.06, 0.02, 3), pouch, J.hips, [side * 0.16, -0.06, 0.06], [0, side * 0.6, 0]);
  }
  // hammer on the right side
  const hammer = new THREE.Group(); hammer.position.set(-0.2, -0.08, -0.02); hammer.rotation.set(0.1, 0, 0.12); J.hips.add(hammer);
  ch.mesh(capsule(0.014, 0.16, 4, 10), clay('#b07a45'), hammer, [0, -0.06, 0]);
  ch.mesh(roundedBox(0.03, 0.03, 0.1, 0.008), metal('#8d939c'), hammer, [0, 0.04, 0.0]);
  // tape measure on the left
  ch.mesh(roundedBox(0.06, 0.06, 0.035, 0.012), clay('#f7d02c'), J.hips, [0.2, -0.05, -0.05], [0, 1.2, 0]);
}

export function makeJohn() {
  return new Character(JOHN_SPEC);
}
