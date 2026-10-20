// Stylized cartoon characters built from simple shapes: the boy (headlamp,
// dusty face) and his friend's mom (saree, arms crossed, slipper in hand).
// Origin at the feet, facing +z. Each returns a small rig for animation.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeAll, placed } from './builders.js';

const mesh = (g, m, cast = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  return o;
};
const sph = (r, ws = 24, hs = 18) => new THREE.SphereGeometry(r, ws, hs);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 14);
// capsule between two points
function limb(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A);
  const g = cap(r, Math.max(0.001, d.length()));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  g.applyQuaternion(q);
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}
// thin tube along a list of points (mouths, brows)
const line = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 24, r, 6, false);
// put a point on a sphere of radius R (centre 0) from yaw/pitch (radians)
const onSphere = (R, yaw, pitch) => [R * Math.sin(yaw) * Math.cos(pitch), R * Math.sin(pitch), R * Math.cos(yaw) * Math.cos(pitch)];

// ---------------------------------------------------------------------------
// boy, about 1.05 m tall, big head
// ---------------------------------------------------------------------------
export function buildBoy(M) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // legs, shoes, shorts, shirt
  const skin = [], shoes = [], shorts = [], shirt = [], dirt = [];
  for (const s of [-1, 1]) {
    skin.push(limb([s * 0.07, 0.08, 0], [s * 0.07, 0.34, 0], 0.05));
    shoes.push(placed(new RoundedBoxGeometry(0.1, 0.07, 0.17, 2, 0.03), s * 0.072, 0.035, 0.03));
  }
  shorts.push(placed(new THREE.CylinderGeometry(0.13, 0.15, 0.16, 20), 0, 0.4, 0));
  shirt.push(placed(cap(0.14, 0.2), 0, 0.6, 0, 0, 0, 0, 1, 1, 0.8));
  shirt.push(placed(sph(0.075, 14, 10), 0.15, 0.7, 0, 0, 0, 0, 1, 0.8, 1), placed(sph(0.075, 14, 10), -0.15, 0.7, 0, 0, 0, 0, 1, 0.8, 1));
  skin.push(placed(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 12), 0, 0.79, 0));
  dirt.push(placed(sph(0.03, 10, 8), 0.06, 0.63, 0.105, 0, 0, 0, 1.3, 1, 0.4), placed(sph(0.025, 10, 8), -0.07, 0.55, 0.11, 0, 0, 0, 1.4, 1, 0.4), placed(sph(0.022, 10, 8), 0.07, 0.42, 0.13, 0, 0, 0, 1.2, 1, 0.4));
  body.add(mesh(mergeAll(skin), M.skinBoy), mesh(mergeAll(shoes), M.batGrip), mesh(mergeAll(shorts), M.shorts), mesh(mergeAll(shirt), M.shirt), mesh(mergeAll(dirt), M.dirtSmudge, false));
  // arms on shoulder pivots (rotate x: 0 = down, -PI = straight up)
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.17, 0.72, 0);
    sh.add(mesh(mergeAll([limb([0, 0, 0], [s * 0.02, -0.28, 0.0], 0.042)]), M.skinBoy));
    sh.add(mesh(placed(sph(0.075, 14, 10), 0, -0.02, 0, 0, 0, 0, 0.75, 0.8, 0.75), M.shirt)); // sleeve
    const hand = mesh(placed(sph(0.05, 14, 10), s * 0.02, -0.32, 0), M.skinBoy);
    sh.add(hand);
    body.add(sh);
    arms.push(sh);
  }
  // head on a neck pivot
  const head = new THREE.Group();
  head.position.set(0, 0.82, 0);
  body.add(head);
  const HC = new THREE.Vector3(0, 0.16, 0), R = 0.175;
  const face = new THREE.Group();
  face.position.copy(HC);
  head.add(face);
  face.add(mesh(sph(R, 32, 24), M.skinBoy));
  face.add(mesh(mergeAll([placed(sph(0.042, 12, 10), R * 0.97, -0.01, 0, 0, 0, 0, 0.6, 1, 1), placed(sph(0.042, 12, 10), -R * 0.97, -0.01, 0, 0, 0, 0, 0.6, 1, 1)]), M.skinBoy));
  // messy hair cap + tufts
  const hairG = [new THREE.SphereGeometry(R * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42)];
  hairG[0].rotateX(-0.32);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    hairG.push(placed(new THREE.ConeGeometry(0.045, 0.1, 6), Math.cos(a) * 0.09, R * 0.9 + 0.02, Math.sin(a) * 0.09 - 0.04, Math.sin(a) * 0.5 - 0.3, 0, -Math.cos(a) * 0.5));
  }
  face.add(mesh(mergeAll(hairG), M.hair));
  // eyes (pupils move to look around)
  const eyes = [], pupils = [];
  for (const s of [-1, 1]) {
    const e = mesh(placed(sph(0.046, 18, 14), ...onSphere(R - 0.02, s * 0.36, 0.06)), M.eyeWhite, false);
    face.add(e);
    eyes.push(e);
    const p = mesh(sph(0.023, 12, 10), M.pupil, false);
    p.userData.base = new THREE.Vector3(...onSphere(R + 0.012, s * 0.36, 0.06));
    p.position.copy(p.userData.base);
    face.add(p);
    pupils.push(p);
  }
  // eyebrows on little pivots (rotate z to look worried)
  const brows = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Group();
    b.position.set(...onSphere(R + 0.006, s * 0.36, 0.33));
    b.add(mesh(placed(cap(0.013, 0.06), 0, 0, 0, 0, 0, Math.PI / 2), M.brow, false));
    face.add(b);
    brows.push(b);
  }
  face.add(mesh(placed(sph(0.026, 12, 10), ...onSphere(R + 0.005, 0, -0.1)), M.skinBoy));
  // mouths: big grin, nervous wobbly smile
  const grin = new THREE.Group();
  {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = -0.5 + i / 16;
      pts.push(onSphere(R + 0.004, a * 0.75, -0.32 - 0.18 * Math.cos(a * Math.PI)));
    }
    const shape = new THREE.Shape();
    shape.moveTo(-0.075, 0);
    shape.quadraticCurveTo(0, -0.11, 0.075, 0);
    shape.quadraticCurveTo(0, -0.02, -0.075, 0);
    const g = new THREE.ShapeGeometry(shape, 12);
    const teeth = new THREE.Shape();
    teeth.moveTo(-0.062, -0.006);
    teeth.quadraticCurveTo(0, -0.03, 0.062, -0.006);
    teeth.quadraticCurveTo(0, -0.015, -0.062, -0.006);
    const tg = new THREE.ShapeGeometry(teeth, 12);
    tg.translate(0, 0, 0.002);
    const holder = new THREE.Group();
    holder.position.set(...onSphere(R + 0.002, 0, -0.27));
    holder.rotation.x = 0.27;
    holder.add(mesh(g, M.mouth, false), mesh(tg, M.teeth, false));
    grin.add(holder);
  }
  face.add(grin);
  const nervous = new THREE.Group();
  {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const u = i / 12;
      pts.push(onSphere(R + 0.006, (u - 0.5) * 0.62, -0.36 + 0.025 * Math.sin(u * Math.PI * 3)));
    }
    nervous.add(mesh(line(pts, 0.009), M.mouth, false));
  }
  nervous.visible = false;
  face.add(nervous);
  // dust smudges on the face
  const smudges = [[0.5, -0.12, 0.05], [-0.42, -0.16, 0.045], [0.12, 0.42, 0.04], [-0.2, -0.05, 0.03], [0.62, 0.22, 0.03]];
  face.add(mesh(mergeAll(smudges.map(([yaw, pitch, r]) => placed(sph(r, 12, 8), ...onSphere(R - 0.004, yaw, pitch), 0, yaw, 0, 1, 0.8, 0.35))), M.dirtSmudge, false));
  // headlamp: band, lamp, beam
  const band = new THREE.TorusGeometry(R * 1.02, 0.013, 8, 40);
  band.rotateX(Math.PI / 2 - 0.35);
  band.translate(0, 0.07, 0.0);
  face.add(mesh(band, M.headband, false));
  const lamp = new THREE.Group();
  lamp.position.set(...onSphere(R + 0.02, 0, 0.42));
  lamp.rotation.x = -0.42;
  lamp.add(mesh(placed(new THREE.CylinderGeometry(0.036, 0.036, 0.04, 16), 0, 0, 0, Math.PI / 2, 0, 0), M.headband, false));
  lamp.add(mesh(placed(new THREE.CircleGeometry(0.028, 16), 0, 0, 0.021), M.lamp, false));
  const beamG = new THREE.ConeGeometry(0.12, 0.95, 20, 1, true);
  beamG.rotateX(-Math.PI / 2);
  beamG.translate(0, 0, 0.5);
  const beam = mesh(beamG, M.beam.clone(), false);
  beam.renderOrder = 6;
  lamp.add(beam);
  const lampGlow = mesh(placed(new THREE.CircleGeometry(0.045, 20), 0, 0, 0.03), M.glowWarm.clone(), false);
  lampGlow.material.opacity = 0.55;
  lampGlow.renderOrder = 6;
  lamp.add(lampGlow);
  face.add(lamp);
  // sweat drop (pops in when he gets nervous)
  const sweat = new THREE.Group();
  sweat.position.set(...onSphere(R + 0.02, -0.75, 0.2));
  sweat.add(mesh(mergeAll([placed(sph(0.022, 12, 10), 0, 0, 0), placed(new THREE.ConeGeometry(0.019, 0.04, 12), 0, 0.03, 0)]), M.sweat, false));
  sweat.scale.setScalar(0.001);
  face.add(sweat);
  return { root, body, head, face, arms, eyes, pupils, brows, grin, nervous, beam, sweat, lamp };
}

// ---------------------------------------------------------------------------
// friend's mom in modern clothes (top, jeans, sneakers), about 1.65 m tall
// ---------------------------------------------------------------------------
export function buildMom(M) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // jeans + sneakers (the right foot taps)
  const jeans = [placed(new THREE.CylinderGeometry(0.155, 0.165, 0.16, 24), 0, 0.88, 0, 0, 0, 0, 1, 1, 0.82)];
  for (const s of [-1, 1]) jeans.push(limb([s * 0.083, 0.1, 0.0], [s * 0.088, 0.86, 0], 0.066));
  body.add(mesh(mergeAll(jeans), M.jeans));
  body.add(mesh(placed(new THREE.CylinderGeometry(0.158, 0.158, 0.035, 24), 0, 0.955, 0, 0, 0, 0, 1, 1, 0.83), M.belt, false));
  const shoe = () => mergeAll([placed(new RoundedBoxGeometry(0.1, 0.075, 0.2, 2, 0.035), 0, 0.037, 0.03), placed(new RoundedBoxGeometry(0.104, 0.022, 0.205, 2, 0.01), 0, 0.011, 0.03)]);
  const footL = mesh(shoe(), M.sneaker);
  footL.position.set(-0.085, 0, 0.0);
  const footR = new THREE.Group();
  footR.position.set(0.088, 0, -0.06);
  const fr = mesh(shoe(), M.sneaker);
  fr.position.z = 0.06;
  footR.add(fr);
  body.add(footL, footR);
  // fitted top with a short flared hem and short sleeves
  const top = [
    placed(cap(0.15, 0.2), 0, 1.15, 0, 0, 0, 0, 1, 1, 0.78),
    placed(new THREE.CylinderGeometry(0.152, 0.178, 0.1, 24), 0, 0.99, 0, 0, 0, 0, 1, 1, 0.8),
    placed(sph(0.075, 14, 10), 0.175, 1.29, 0, 0, 0, 0, 1, 0.85, 0.9), placed(sph(0.075, 14, 10), -0.175, 1.29, 0, 0, 0, 0, 1, 0.85, 0.9),
  ];
  body.add(mesh(mergeAll(top), M.momTop));
  body.add(mesh(placed(new THREE.TorusGeometry(0.06, 0.012, 6, 20, Math.PI), 0, 1.31, 0.075, -0.2, 0, Math.PI), M.momTopDark, false)); // neckline
  // crossed arms, a watch and a bangle, slipper in her right hand
  const arms = new THREE.Group();
  body.add(arms);
  const skinA = [
    limb([0.19, 1.26, 0.0], [0.2, 1.08, 0.06], 0.045), limb([-0.19, 1.26, 0.0], [-0.2, 1.08, 0.06], 0.045),
    limb([0.2, 1.08, 0.08], [-0.1, 1.13, 0.2], 0.042), limb([-0.2, 1.1, 0.08], [0.1, 1.17, 0.18], 0.042),
    placed(sph(0.05, 12, 10), -0.13, 1.15, 0.2), placed(sph(0.05, 12, 10), 0.13, 1.19, 0.17),
  ];
  arms.add(mesh(mergeAll(skinA), M.skinMom));
  const watch = new THREE.TorusGeometry(0.047, 0.011, 6, 18);
  watch.rotateY(Math.PI / 2);
  watch.rotateZ(0.17);
  watch.translate(-0.05, 1.125, 0.19);
  const bangle = new THREE.TorusGeometry(0.047, 0.007, 6, 18);
  bangle.rotateY(Math.PI / 2);
  bangle.rotateZ(-0.2);
  bangle.translate(0.05, 1.163, 0.17);
  arms.add(mesh(watch, M.batGrip, false), mesh(bangle, M.gold, false));
  // classic rubber flip-flop: white sole, blue V strap
  const slipper = new THREE.Group();
  slipper.position.set(-0.15, 1.17, 0.21); // in her right hand (camera left)
  const sole = new THREE.Shape();
  sole.moveTo(0, -0.12);
  sole.bezierCurveTo(0.05, -0.12, 0.045, -0.02, 0.05, 0.05);
  sole.bezierCurveTo(0.055, 0.13, 0.03, 0.16, 0.0, 0.16);
  sole.bezierCurveTo(-0.035, 0.16, -0.06, 0.13, -0.055, 0.05);
  sole.bezierCurveTo(-0.05, -0.02, -0.05, -0.12, 0, -0.12);
  const soleG = new THREE.ExtrudeGeometry(sole, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 10 });
  soleG.translate(0, 0, -0.011);
  const rim = soleG.clone();
  rim.scale(1.04, 1.03, 0.4);
  rim.translate(0, 0, -0.012);
  const fl = new THREE.Group();
  fl.rotation.z = 0.3;
  fl.position.y = 0.08;
  fl.add(mesh(soleG, M.chappalSole), mesh(rim, M.chappalStrap, false));
  const strapPts = [[-0.042, 0.0, 0.012], [-0.02, 0.07, 0.04], [0.0, 0.11, 0.02], [0.02, 0.07, 0.04], [0.042, 0.0, 0.012]];
  fl.add(mesh(line(strapPts, 0.011), M.chappalStrap, false));
  slipper.add(fl);
  arms.add(slipper);
  // neck + head
  body.add(mesh(placed(new THREE.CylinderGeometry(0.045, 0.052, 0.09, 12), 0, 1.36, 0), M.skinMom));
  const head = new THREE.Group();
  head.position.set(0, 1.4, 0);
  body.add(head);
  const R = 0.135;
  const face = new THREE.Group();
  face.position.set(0, 0.12, 0);
  head.add(face);
  face.add(mesh(placed(sph(R, 32, 24), 0, 0, 0, 0, 0, 0, 0.95, 1.05, 0.98), M.skinMom));
  face.add(mesh(mergeAll([placed(sph(0.032, 12, 10), R * 0.93, -0.005, 0, 0, 0, 0, 0.6, 1, 1), placed(sph(0.032, 12, 10), -R * 0.93, -0.005, 0, 0, 0, 0, 0.6, 1, 1)]), M.skinMom));
  // hair: shoulder-length cut with a side sweep, sunglasses pushed up on top
  const hairCap = new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.47);
  hairCap.rotateX(-0.36);
  hairCap.rotateZ(0.12);
  const hairBack = placed(sph(R * 1.02, 24, 18), 0, -0.07, -0.035, 0, 0, 0, 1.08, 1.12, 0.95);
  const sides = [-1, 1].map((sd) => placed(new RoundedBoxGeometry(0.06, 0.2, 0.15, 2, 0.03), sd * 0.122, -0.1, -0.02, 0, 0, sd * 0.08));
  const fringe = placed(sph(0.07, 16, 12), 0.05, 0.1, 0.09, 0, 0, -0.5, 1.4, 0.55, 0.8);
  face.add(mesh(mergeAll([hairCap, hairBack, ...sides, fringe]), M.hair));
  const shades = [];
  for (const sd of [-1, 1]) shades.push(placed(new RoundedBoxGeometry(0.075, 0.04, 0.02, 2, 0.012), sd * 0.048, R * 0.98, 0.06, -0.9, 0, 0));
  shades.push(placed(new THREE.BoxGeometry(0.02, 0.008, 0.012), 0, R * 0.99, 0.065, -0.9, 0, 0));
  face.add(mesh(mergeAll(shades), M.batGrip, false));
  // eyes, stern brows, nose, frown, bindi, earrings, nose stud
  const pupils = [], eyes = [];
  for (const s of [-1, 1]) {
    // eye white on its own pivot (scale y to narrow into a glare)
    const e = new THREE.Group();
    e.position.set(...onSphere(R - 0.014, s * 0.36, 0.04));
    e.add(mesh(placed(sph(0.034, 16, 12), 0, 0, 0, 0, 0, 0, 1, 0.82, 1), M.eyeWhite, false));
    face.add(e);
    eyes.push(e);
    const p = mesh(sph(0.017, 10, 8), M.pupil, false);
    p.userData.base = new THREE.Vector3(...onSphere(R + 0.008, s * 0.36, 0.04));
    p.position.copy(p.userData.base);
    face.add(p);
    pupils.push(p);
  }
  const brows = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Group();
    b.position.set(...onSphere(R + 0.006, s * 0.37, 0.27));
    b.add(mesh(placed(cap(0.012, 0.055), 0, 0, 0, 0, 0, Math.PI / 2), M.brow, false));
    b.rotation.z = s * 0.38; // stern: inner ends down
    face.add(b);
    brows.push(b);
  }
  face.add(mesh(placed(sph(0.022, 12, 10), ...onSphere(R + 0.004, 0, -0.1)), M.skinMom));
  const frownPts = [];
  for (let i = 0; i <= 10; i++) {
    const u = i / 10;
    frownPts.push(onSphere(R + 0.004, (u - 0.5) * 0.5, -0.36 - 0.05 * Math.sin(u * Math.PI)));
  }
  face.add(mesh(line(frownPts.map((p) => [p[0], p[1] + 0.0, p[2]]), 0.008), M.mouth, false));
  face.add(mesh(placed(sph(0.012, 10, 8), ...onSphere(R + 0.002, 0, 0.36)), M.bindi, false));
  face.add(mesh(mergeAll([placed(sph(0.016, 10, 8), R * 0.96, -0.06, 0.01), placed(sph(0.016, 10, 8), -R * 0.96, -0.06, 0.01), placed(sph(0.006, 8, 6), ...onSphere(R + 0.01, 0.12, -0.12))]), M.gold, false));
  return { root, body, head, face, arms, slipper, pupils, eyes, brows, footR };
}

// ---------------------------------------------------------------------------
// girl at the window: pigtails, wide eyes, open "O" mouth, hands that go from
// the sill to her cheeks to over her mouth. Origin a little below the sill;
// everything under `clip` (set to the sill height) is cut away, so she can rise
// up from behind it.
// ---------------------------------------------------------------------------
export function buildGirl(M) {
  const clip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const own = new Map();
  const cm = (m) => {
    if (!own.has(m)) {
      const c = m.clone();
      c.clippingPlanes = [clip];
      own.set(m, c);
    }
    return own.get(m);
  };
  const gm = (g, m) => mesh(g, cm(m), false);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(gm(placed(cap(0.17, 0.12), 0, -0.08, -0.05, 0, 0, 0, 1.15, 1, 0.75), M.girlTop));
  body.add(gm(placed(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 12), 0, 0.14, -0.03), M.skinBoy));
  const head = new THREE.Group();
  head.position.set(0, 0.15, 0);
  body.add(head);
  const R = 0.25;
  const face = new THREE.Group();
  face.position.set(0, 0.2, 0);
  head.add(face);
  face.add(gm(sph(R, 32, 24), M.skinBoy));
  // hair with a fringe and two pigtails tied with red ribbons
  const hairCap = new THREE.SphereGeometry(R * 1.05, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.46);
  hairCap.rotateX(-0.3);
  const pigtails = new THREE.Group(); // bounce on their own
  const pig = [];
  for (const s of [-1, 1]) pig.push(placed(sph(0.1, 16, 12), s * 0.29, 0.07, -0.04, 0, 0, 0, 0.8, 1.25, 0.8));
  pigtails.add(gm(mergeAll(pig), M.hair));
  pigtails.add(gm(mergeAll([-1, 1].map((s) => placed(sph(0.042, 12, 10), s * 0.255, 0.16, -0.03, 0, 0, 0, 1.2, 0.8, 0.8))), M.ribbon));
  face.add(pigtails);
  const fringe = [];
  for (let i = -2; i <= 2; i++) fringe.push(placed(sph(0.068, 12, 10), i * 0.062, 0.17, 0.15, 0, 0, 0, 1, 0.6, 0.6));
  face.add(gm(mergeAll([hairCap, ...fringe]), M.hair));
  // eyes on pivots (they pop wider), pupils in front, brows on pivots
  const eyes = [], pupils = [], brows = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(...onSphere(R - 0.03, s * 0.37, 0.08));
    e.add(gm(placed(sph(0.078, 18, 14), 0, 0, 0, 0, 0, 0, 1, 1.15, 1), M.eyeWhite));
    face.add(e);
    eyes.push(e);
    const p = gm(sph(0.022, 10, 8), M.pupil);
    p.userData.base = new THREE.Vector3(...onSphere(R + 0.03, s * 0.37, 0.08));
    p.userData.n = p.userData.base.clone().normalize();
    p.position.copy(p.userData.base);
    face.add(p);
    pupils.push(p);
    const b = new THREE.Group();
    b.position.set(...onSphere(R + 0.004, s * 0.38, 0.43));
    b.userData.base = b.position.clone();
    b.rotation.z = s * 0.35;
    b.add(gm(placed(cap(0.015, 0.075), 0, 0, 0, 0, 0, Math.PI / 2), M.brow));
    face.add(b);
    brows.push(b);
  }
  face.add(gm(placed(sph(0.022, 12, 10), ...onSphere(R + 0.004, 0, -0.08)), M.skinBoy));
  // mouths: small curious smile, then the big open "O" with a bit of tongue
  const smile = new THREE.Group();
  {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      pts.push(onSphere(R + 0.004, (u - 0.5) * 0.36, -0.31 - 0.05 * Math.sin(u * Math.PI)));
    }
    smile.add(gm(line(pts, 0.009), M.mouth));
  }
  face.add(smile);
  const mouth = new THREE.Group();
  mouth.position.set(...onSphere(R + 0.001, 0, -0.33));
  mouth.rotation.x = 0.33;
  mouth.add(gm(placed(new THREE.CircleGeometry(0.06, 24), 0, 0, 0, 0, 0, 0, 0.85, 1.3, 1), M.mouth));
  mouth.add(gm(placed(new THREE.CircleGeometry(0.036, 18), 0, -0.033, 0.002, 0, 0, 0, 1.1, 0.6, 1), M.tongue));
  face.add(mouth);
  // hands are children of the body, posed in world space each frame
  const hands = [-1, 1].map(() => {
    const h = new THREE.Group();
    h.add(gm(placed(sph(0.072, 14, 10), 0, 0, 0, 0, 0, 0, 0.75, 1.1, 0.9), M.skinBoy));
    body.add(h);
    return h;
  });
  return { root, body, head, face, eyes, pupils, brows, smile, mouth, hands, pigtails, clip, R };
}
