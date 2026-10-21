// John: cute toy-like figure. buildJohn({old}) returns { root, update(pose) }.
// Faces +z (towards the camera). Feet at y = 0. ~1.35 units tall when young.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { std, phys, glowMaterial } from '../lib/materials.js';
import { fbm2, lerp, clamp } from '../lib/util.js';

let C = null;
function mats() {
  if (C) return C;
  C = {
    skin: phys({ color: 0xf2c3a0, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#ffb59a'), sheenRoughness: 0.6 }, 'skin'),
    skinOld: phys({ color: 0xe9b998, roughness: 0.62, sheen: 0.3, sheenColor: new THREE.Color('#ffb59a') }, 'skinold'),
    blush: std({ color: 0xff8f86, roughness: 0.6, transparent: true, opacity: 0.45 }, 'blush'),
    hoodie: phys({ color: 0xd62a2a, roughness: 0.85, sheen: 1.0, sheenColor: new THREE.Color('#ff7b6e'), sheenRoughness: 0.5 }, 'hoodie'),
    hoodieDark: phys({ color: 0xa81e1f, roughness: 0.9, sheen: 0.8, sheenColor: new THREE.Color('#ff7b6e') }, 'hoodie2'),
    string: std({ color: 0xf4f0e8, roughness: 0.7 }, 'string'),
    jeans: phys({ color: 0x35517e, roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color('#8fb0e0') }, 'jeans'),
    shoe: std({ color: 0xf2f2f2, roughness: 0.5 }, 'shoe'),
    sole: std({ color: 0x3a3a3a, roughness: 0.7 }, 'sole'),
    hair: phys({ color: 0x5a341c, roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#b5784a') }, 'hair'),
    hairOld: phys({ color: 0xd9d6d0, roughness: 0.6, sheen: 1.0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4 }, 'hairold'),
    beard: phys({ color: 0xcfcac2, roughness: 0.7, sheen: 1.0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 }, 'beard'),
    eyeW: phys({ color: 0xffffff, roughness: 0.08, clearcoat: 1 }, 'eyew'),
    iris: phys({ color: 0x5b3a1e, roughness: 0.1, clearcoat: 1 }, 'iris'),
    pupil: std({ color: 0x050505, roughness: 0.1 }, 'pupil'),
    spec: glowMaterial('#ffffff', 2.2, 'spec'),
    mouth: std({ color: 0x5a1a1a, roughness: 0.6 }, 'mouth'),
    tongue: std({ color: 0xd9646a, roughness: 0.6 }, 'tongue'),
    goggleBand: std({ color: 0x1f1f1f, roughness: 0.6 }, 'gband'),
    goggleRim: std({ color: 0xc9cdd2, metalness: 1, roughness: 0.2 }, 'grim'),
    goggleLens: phys({ color: 0xff9a2a, roughness: 0.05, metalness: 0.3, clearcoat: 1, envMapIntensity: 2 }, 'glens'),
    stick: std({ color: 0x7a4a26, roughness: 0.55 }, 'stick'),
    popRed: std({ color: 0xe0262b, roughness: 0.5 }, 'popred'),
    popWhite: std({ color: 0xfaf6ee, roughness: 0.5 }, 'popwhite'),
    corn: std({ color: 0xfff1c4, roughness: 0.7 }, 'corn'),
    brow: std({ color: 0x3b2414, roughness: 0.7 }, 'brow'),
    browOld: std({ color: 0xeeeeea, roughness: 0.8 }, 'browold'),
    wrinkle: std({ color: 0xb98a6c, roughness: 0.8 }, 'wrinkle'),
  };
  return C;
}

const M = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);

function limb(parent, r, l, mat, x, y, z) {
  // pivot at the top, hangs down -y
  const pivot = new THREE.Group(); pivot.position.set(x, y, z); parent.add(pivot);
  const g = cap(r, l); g.translate(0, -l / 2 - r * 0.2, 0);
  M(g, mat, pivot);
  return pivot;
}

function popcorn(parent) {
  const g = new THREE.Group(); parent.add(g);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const seg = new THREE.CylinderGeometry(0.11, 0.08, 0.2, 2, 1, true, a0, a1 - a0);
    M(seg, i % 2 ? C.popRed : C.popWhite, g, 0, 0, 0).material.side = THREE.DoubleSide;
  }
  for (let i = 0; i < 9; i++) { const a = i * 2.4; M(new THREE.IcosahedronGeometry(0.045, 1), C.corn, g, Math.cos(a) * 0.06 * (i % 3) / 2, 0.11 + (i % 3) * 0.025, Math.sin(a) * 0.06 * (i % 3) / 2); }
  return g;
}

// one tapered, wavy strand of beard hanging down from the chin
function strandGeometry(len, r0, phase, sway) {
  const pts = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    pts.push(new THREE.Vector3(Math.sin(v * 7 + phase) * 0.025 * (0.3 + v) + sway * v * v, -v * len, 0.05 * Math.sin(v * 3.1) + 0.06 * v - 0.12 * v * v));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 40, 1, 10, false);
  // taper: scale each ring around its curve point
  const p = g.attributes.position;
  const frames = 41, ring = 11;
  for (let j = 0; j < frames; j++) {
    const v = j / (frames - 1);
    const c = curve.getPointAt(v);
    const r = r0 * (1 - 0.82 * Math.pow(v, 1.3)) * (0.9 + 0.12 * Math.sin(v * 19 + phase));
    for (let k = 0; k < ring; k++) {
      const idx = j * ring + k;
      const x = p.getX(idx), y = p.getY(idx), z = p.getZ(idx);
      p.setXYZ(idx, c.x + (x - c.x) * r, c.y + (y - c.y) * r, c.z + (z - c.z) * r * 0.75);
    }
  }
  g.computeVertexNormals();
  return g;
}

export function buildJohn({ old = false } = {}) {
  const c = mats();
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.42; root.add(hips);
  const skin = old ? c.skinOld : c.skin;

  // legs + shoes
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = limb(hips, 0.085, 0.22, c.jeans, s * 0.1, 0, 0);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.11, 0.27, 3, 0.05), c.shoe); shoe.position.set(0, -0.37, 0.04); shoe.castShadow = true; leg.add(shoe);
    const sole = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.04, 0.28, 2, 0.02), c.sole); sole.position.set(0, -0.42, 0.04); leg.add(sole);
    legs.push(leg);
  }
  // torso (hoodie)
  const spine = new THREE.Group(); spine.position.y = 0.02; hips.add(spine);
  const torsoG = cap(0.2, 0.2); torsoG.scale(1.08, 1, 0.82);
  M(torsoG, c.hoodie, spine, 0, 0.22, 0);
  M(new THREE.TorusGeometry(0.17, 0.06, 10, 24), c.hoodieDark, spine, 0, 0.45, -0.04).rotation.x = Math.PI / 2.4; // hood around the neck
  M(new RoundedBoxGeometry(0.22, 0.1, 0.05, 2, 0.02), c.hoodieDark, spine, 0, 0.12, 0.165);                     // pocket
  for (const s of [-1, 1]) { const st = M(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), c.string, spine, s * 0.05, 0.33, 0.17); M(new THREE.SphereGeometry(0.015, 8, 6), c.string, spine, s * 0.05, 0.25, 0.172); }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.38, 0); spine.add(sh);
    const upper = cap(0.065, 0.13); upper.translate(0, -0.1, 0);
    M(upper, c.hoodie, sh);
    const elbow = new THREE.Group(); elbow.position.y = -0.2; sh.add(elbow);
    const fore = cap(0.06, 0.1); fore.translate(0, -0.08, 0);
    M(fore, c.hoodie, elbow);
    const hand = M(new THREE.SphereGeometry(0.065, 16, 12), skin, elbow, 0, -0.2, 0);
    arms.push({ sh, elbow, hand });
  }
  // head
  const neck = new THREE.Group(); neck.position.y = 0.5; spine.add(neck);
  const head = new THREE.Group(); head.position.y = 0.27; neck.add(head);
  const headG = new THREE.SphereGeometry(0.31, 40, 28); headG.scale(1.0, 0.95, 0.94);
  M(headG, skin, head);
  for (const s of [-1, 1]) M(new THREE.SphereGeometry(0.07, 14, 10), skin, head, s * 0.3, -0.01, -0.01).scale.set(0.5, 1, 0.8); // ears
  M(new THREE.SphereGeometry(0.04, 14, 10), skin, head, 0, -0.04, 0.295);                                                      // nose
  for (const s of [-1, 1]) { const b = M(new THREE.CircleGeometry(0.05, 16), c.blush, head, s * 0.17, -0.07, 0.262); b.rotation.y = s * 0.55; }
  // eyes: big and expressive
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.115, 0.04, 0.24); head.add(e);
    M(new THREE.SphereGeometry(0.085, 24, 18), c.eyeW, e).scale.set(1, 1.12, 0.6);
    const look = new THREE.Group(); e.add(look);
    M(new THREE.SphereGeometry(0.055, 20, 14), c.iris, look, 0, 0, 0.033).scale.set(1, 1.08, 0.5);
    M(new THREE.SphereGeometry(0.03, 16, 12), c.pupil, look, 0, 0, 0.052).scale.set(1, 1, 0.4);
    M(new THREE.SphereGeometry(0.014, 10, 8), c.spec, look, 0.018, 0.024, 0.066);
    // eyelid (skin) for blinks / old droopy lids
    const lid = new THREE.Group(); e.add(lid);
    const lidG = new THREE.SphereGeometry(0.092, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); lidG.scale(1, 1.12, 0.66);
    M(lidG, skin, lid);
    eyes.push({ look, lid });
  }
  const brows = [];
  for (const s of [-1, 1]) {
    const bg = old ? cap(0.035, 0.1) : cap(0.018, 0.08);
    bg.rotateZ(Math.PI / 2);
    const b = M(bg, old ? c.browOld : c.brow, head, s * 0.12, old ? 0.17 : 0.16, 0.26);
    b.rotation.z = s * (old ? -0.25 : 0.12); brows.push(b);
  }
  // mouth: smile arc + open mouth
  const smile = M(new THREE.TorusGeometry(0.07, 0.014, 8, 20, Math.PI), c.mouth, head, 0, -0.12, 0.27);
  smile.rotation.z = Math.PI; smile.scale.set(1, 0.8, 1);
  const open = new THREE.Group(); open.position.set(0, -0.13, 0.268); head.add(open);
  M(new THREE.SphereGeometry(0.055, 18, 12), c.mouth, open).scale.set(1.0, 1, 0.35);
  M(new THREE.SphereGeometry(0.03, 12, 8), c.tongue, open, 0, -0.025, 0.01).scale.set(1.2, 0.6, 0.4);
  open.visible = false;

  // hair
  const hairMat = old ? c.hairOld : c.hair;
  if (!old) {
    const capG = new THREE.SphereGeometry(0.325, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42); capG.scale(1.02, 0.98, 0.96);
    M(capG, hairMat, head, 0, 0.02, -0.015);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, el = 0.35 + 0.35 * ((i * 7) % 5) / 5;
      const tuft = new THREE.ConeGeometry(0.075, 0.2, 10); tuft.translate(0, 0.1, 0);
      const m = M(tuft, hairMat, head, Math.cos(a) * 0.2 * Math.cos(el), 0.24 + 0.05 * Math.sin(el), Math.sin(a) * 0.19 - 0.02);
      m.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    }
    for (let i = 0; i < 5; i++) { const f = new THREE.ConeGeometry(0.06, 0.16, 8); f.translate(0, -0.08, 0); const m = M(f, hairMat, head, -0.14 + i * 0.07, 0.22, 0.2); m.rotation.set(-0.5, 0, (i - 2) * 0.25); } // fringe
  } else {
    // bald top, fluffy white tufts at the sides and back
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.15 + (i / 11) * Math.PI * 0.7;
      for (const s of [-1, 1]) M(new THREE.IcosahedronGeometry(0.075, 1), hairMat, head, s * Math.sin(a) * 0.29, 0.05 + Math.cos(a * 2) * 0.03 - 0.02 * i / 11, -Math.cos(a) * 0.25);
    }
    // wrinkles on the forehead
    for (let i = 0; i < 3; i++) { const w = M(new THREE.TorusGeometry(0.12 - i * 0.015, 0.005, 6, 20, Math.PI * 0.6), c.wrinkle, head, 0, 0.13 + i * 0.035, 0.245 - i * 0.012); w.rotation.z = Math.PI * 0.2; w.rotation.x = -0.35; }
    // moustache
    for (const s of [-1, 1]) { const mg = cap(0.035, 0.1); mg.rotateZ(Math.PI / 2 + s * 0.5); M(mg, c.beard, head, s * 0.06, -0.085, 0.29); }
  }
  // goggles pushed up on the head
  const gog = new THREE.Group(); gog.position.set(0, 0.17, 0.0); gog.rotation.x = -0.55; head.add(gog);
  M(new THREE.TorusGeometry(0.318, 0.022, 8, 48), c.goggleBand, gog).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    const lens = new THREE.Group(); lens.position.set(s * 0.11, 0.0, 0.3); gog.add(lens);
    const rim = new THREE.TorusGeometry(0.07, 0.022, 10, 24); M(rim, c.goggleRim, lens);
    const lg = new THREE.SphereGeometry(0.068, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.5); lg.rotateX(Math.PI / 2);
    M(lg, c.goggleLens, lens, 0, 0, -0.01);
  }
  // beard (old) down to the knees
  let beard = null;
  if (old) {
    beard = new THREE.Group(); beard.position.set(0, -0.16, 0.2); head.add(beard);
    const beardDark = phys({ color: 0xa9a49c, roughness: 0.75, sheen: 1.0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 }, 'beard2');
    const strands = [[-0.12, 0.62, 0.06, 0.4, -0.04], [-0.07, 0.74, 0.075, 1.3, -0.02], [-0.02, 0.8, 0.085, 2.2, 0.0], [0.035, 0.78, 0.08, 3.1, 0.015], [0.09, 0.7, 0.07, 4.0, 0.03], [0.13, 0.58, 0.055, 5.2, 0.05], [0.0, 0.66, 0.07, 0.9, 0.0]];
    strands.forEach(([x, len, r0, ph, sw], i) => { const m = M(strandGeometry(len, r0, ph, sw), i % 2 ? beardDark : c.beard, beard, x, 0, i === 6 ? 0.03 : 0); });
    // fluffy cheeks and chin
    for (let i = 0; i < 9; i++) { const a = -1.1 + i * 0.275; M(new THREE.IcosahedronGeometry(0.075, 1), c.beard, beard, Math.sin(a) * 0.19, 0.06 + Math.cos(a) * 0.05 - 0.05, -0.04 + Math.cos(a) * 0.05); }
  }
  // props
  const snack = popcorn(arms[0].elbow); snack.position.set(0.0, -0.27, 0.07); snack.visible = !old;
  let stick = null;
  if (old) {
    stick = new THREE.Group(); arms[1].elbow.add(stick); stick.position.set(0, -0.2, 0.02);
    M(new THREE.CylinderGeometry(0.018, 0.022, 0.78, 10), c.stick, stick, 0, -0.36, 0);
    const handle = M(new THREE.TorusGeometry(0.06, 0.02, 8, 16, Math.PI), c.stick, stick, 0.06, 0.02, 0); handle.rotation.z = 0;
  }

  const J = { root, hips, spine, neck, head, arms, legs, eyes, brows, smile, open, beard, snack, stick, old };
  // pose: { wave, walk (phase), hunch, headYaw, headPitch, lookX, lookY, blink, talk, armSwing, stickPlant }
  J.update = (p = {}) => {
    const walk = p.walk ?? 0, walking = p.walking ?? 0;
    const hunch = p.hunch ?? (old ? 0.32 : 0);
    spine.rotation.x = hunch + Math.sin(walk * 2) * 0.03 * walking;
    neck.rotation.x = -hunch * 0.75 + (p.headPitch ?? 0);
    neck.rotation.y = p.headYaw ?? 0;
    neck.rotation.z = p.headTilt ?? 0;
    hips.position.y = 0.42 - (old ? 0.04 : 0) + Math.abs(Math.sin(walk)) * 0.025 * walking;
    legs[0].rotation.x = Math.sin(walk) * 0.45 * walking; legs[1].rotation.x = -Math.sin(walk) * 0.45 * walking;
    // arms
    const [L, R] = arms; // L = -x side (holds snack), R = +x side (waves / holds stick)
    L.sh.rotation.set(-0.5 + (p.snackUp ?? 0) * -0.4, 0, -0.25);
    L.elbow.rotation.set(-1.0, 0, 0.0);
    if (p.wave) {
      R.sh.rotation.set(0, 0, 2.5);
      R.elbow.rotation.set(0, 0, 0.35 + Math.sin(p.wave) * 0.55);
    } else if (old) {
      R.sh.rotation.set(-0.55 + (p.stickLift ?? 0) * -0.25, 0, 0.18);
      R.elbow.rotation.set(-0.35, 0, 0);
    } else {
      R.sh.rotation.set(Math.sin(walk) * 0.4 * walking, 0, 0.18); R.elbow.rotation.set(-0.3, 0, 0);
    }
    for (const e of eyes) {
      e.look.position.set((p.lookX ?? 0) * 0.025, (p.lookY ?? 0) * 0.02, 0);
      const lidDown = clamp((old ? 0.4 : 0.0) + (p.blink ?? 0) + (p.squint ?? 0), 0, 1);
      e.lid.rotation.x = lerp(-1.6, 1.45, lidDown); // rotate the half-sphere lid forward over the eye
    }
    brows.forEach((b, i) => { b.position.y = (old ? 0.17 : 0.16) + (p.browUp ?? 0) * 0.03; });
    const talk = p.talk ?? 0;
    open.visible = talk > 0.05; open.scale.set(1, Math.max(0.1, talk), 1);
    smile.visible = !open.visible;
    smile.scale.set(1, (p.smile ?? 1) * 0.8, 1);
    if (beard) beard.rotation.x = -hunch * 0.6 + Math.sin(walk) * 0.04 * walking + (p.talk ?? 0) * 0.04;
  };
  J.update({});
  return J;
}
