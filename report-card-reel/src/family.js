// Dad (a friendly, calm dad in a sweater and glasses, ~1.85 m toy-like) and the
// fluffy, happy dog, with all their acting as pure functions of time. Dad hums
// little glowing notes on his walk; the dog digs, steals the card, reaches into
// the hole, hides from the rain and keeps the kid company.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, sph, cap, onSph, std, objPatch, skinMat, cottonMat, knitMat, furMat, hairMat, faceMats, mesh, limb, tube, makeEye, setEye, makeMouths, showMouth, faceBits, blinkAt, swing } from './toy.js';

// ---------------------------------------------------------------------------
// Dad
// ---------------------------------------------------------------------------
function buildDad(ctx, F) {
  const M = {
    skin: skinMat('#e3a77c', 'dskin'),
    sweater: knitMat('#d9a23a', 'dsweater'),
    cuff: knitMat('#c48f2c', 'dcuff'),
    shirt: cottonMat('#f4f6fa', 'dshirt'),
    pants: cottonMat('#3c4a63', 'dpants', '', 0.85),
    shoe: std('#6b4630', 0.45),
    sole: std('#3a2a20', 0.7),
    hair: hairMat('#5a3a24', 'dhair'),
    grey: hairMat('#9a8b80', 'dgrey'),
    iris: std('#4f6b3a', 0.25),
    brow: std('#4a2c1c', 0.7),
    frame: std('#2a2624', 0.35, 0.2),
    lens: new THREE.MeshStandardMaterial({ color: new THREE.Color('#e6f2fa'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.22, envMap: ctx.envMap, envMapIntensity: 1.4, depthWrite: false }),
    glint: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    wood: objPatch(std('#9a6a3c', 0.6), { colorFn: 'dwoodC', key: 'dwood', extra: 'vec3 dwoodC(vec3 p){ return vec3(0.82 + 0.3 * chn(vec3(p.x * 40.0, p.y * 2.0, p.z * 40.0)) * oaa(40.0)); }' }),
    metal: std('#a6aeb6', 0.3, 0.9, { envMap: ctx.envMap, envMapIntensity: 1.0 }),
  };
  ctx.envMats.push(M.lens, M.metal);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.84;
  body.add(hips);
  // legs: thigh + shin with a knee, shoes
  const legs = [], knees = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.1, 0, 0);
    leg.add(limb(V(0, 0.02, 0), V(0, -0.38, 0), 0.082, M.pants));
    const knee = new THREE.Group();
    knee.position.y = -0.39;
    knee.add(limb(V(0, 0, 0), V(0, -0.34, 0), 0.07, M.pants));
    const shoe = mesh(new RoundedBoxGeometry(0.13, 0.085, 0.25, 3, 0.04), M.shoe);
    shoe.position.set(0, -0.395, 0.04);
    const sole = mesh(new RoundedBoxGeometry(0.135, 0.025, 0.255, 2, 0.01), M.sole, false);
    sole.position.set(0, -0.435, 0.04);
    knee.add(shoe, sole);
    leg.add(knee);
    hips.add(leg);
    legs.push(leg);
    knees.push(knee);
  }
  // torso: a cosy sweater over a round tummy, a shirt collar at the neck
  const torso = new THREE.Group();
  hips.add(torso);
  const trunk = mesh(sph(0.27, 36, 26), M.sweater);
  trunk.scale.set(1.0, 1.18, 0.78);
  trunk.position.y = 0.3;
  const band = mesh(new THREE.TorusGeometry(0.235, 0.035, 10, 36), M.cuff, false);
  band.rotation.x = Math.PI / 2;
  band.scale.set(1, 0.8, 1);
  band.position.y = 0.04;
  torso.add(trunk, band);
  for (const s of [-1, 1]) {
    const c = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), M.shirt, false);
    c.rotation.set(Math.PI - 0.5, 0, s * 0.6);
    c.position.set(s * 0.045, 0.6, 0.12);
    torso.add(c);
  }
  // arms: upper arm + forearm with an elbow; [0] right (-x), [1] left
  const arms = [], elbows = [], hands = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.27, 0.5, 0);
    sh.add(limb(V(0, 0.02, 0), V(0, -0.27, 0), 0.07, M.sweater));
    const el = new THREE.Group();
    el.position.y = -0.28;
    el.add(limb(V(0, 0, 0), V(0, -0.22, 0), 0.062, M.sweater));
    const cuff = mesh(new THREE.TorusGeometry(0.058, 0.016, 8, 20), M.cuff, false);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.235;
    const hand = new THREE.Group();
    hand.position.y = -0.3;
    const palm = mesh(sph(0.065, 18, 14), M.skin);
    palm.scale.set(1, 1.1, 0.8);
    hand.add(palm);
    const thumb = mesh(cap(0.022, 0.04, 4, 8), M.skin);
    thumb.position.set(-s * 0.045, 0.01, 0.035);
    thumb.rotation.set(0.6, 0, s * 0.5);
    hand.add(thumb);
    el.add(cuff, hand);
    sh.add(el);
    torso.add(sh);
    arms.push(sh);
    elbows.push(el);
    hands.push(hand);
  }
  // head
  const neck = new THREE.Group();
  neck.position.y = 0.6;
  torso.add(neck);
  neck.add(limb(V(0, -0.02, 0), V(0, 0.08, 0), 0.07, M.skin));
  const head = new THREE.Group();
  head.position.y = 0.21;
  neck.add(head);
  const R = 0.2;
  head.add(mesh(sph(R, 40, 30), M.skin));
  // short neat hair with a side part, a little grey at the temples
  const hc = sph(R * 1.05, 40, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
  hc.rotateX(-0.5);
  head.add(mesh(hc, M.hair));
  const swoop = mesh(sph(R * 0.55, 24, 14), M.hair);
  swoop.position.copy(onSph(R * 0.62, 0.35, 0.72));
  swoop.scale.set(1.25, 0.42, 0.9);
  swoop.rotation.z = -0.25;
  head.add(swoop);
  for (const s of [-1, 1]) {
    const g = mesh(sph(R * 0.2, 14, 10), M.grey);
    g.position.copy(onSph(R * 0.97, s * 1.25, 0.32));
    g.scale.set(0.5, 1.2, 0.9);
    head.add(g);
  }
  faceBits(head, R, F, M.skin);
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.052, M.iris, M.skin, F);
    e.g.position.copy(onSph(R - 0.025, s * 0.32, 0.07));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.05)));
    head.add(e.g);
    eyes.push(e);
    const b = new THREE.Group();
    b.position.copy(onSph(R + 0.006, s * 0.33, 0.42));
    b.lookAt(b.position.clone().multiplyScalar(2));
    const bm = mesh(cap(0.015, 0.07, 4, 8), M.brow, false);
    bm.rotation.z = Math.PI / 2;
    b.add(bm);
    head.add(b);
    b.userData.y0 = b.position.y;
    brows.push(b);
  }
  // glasses: round frames, lenses, a bridge, temples to the ears; a glint
  const glasses = new THREE.Group();
  for (const s of [-1, 1]) {
    const c = onSph(R + 0.035, s * 0.32, 0.07);
    const ring = mesh(new THREE.TorusGeometry(0.068, 0.009, 8, 32), M.frame, false);
    ring.position.copy(c);
    ring.lookAt(c.clone().multiplyScalar(2));
    const lens = mesh(new THREE.CircleGeometry(0.066, 32), M.lens, false);
    lens.position.copy(c);
    lens.lookAt(c.clone().multiplyScalar(2));
    lens.renderOrder = 4;
    glasses.add(ring, lens);
    glasses.add(tube([c.clone().add(V(s * 0.06, 0.01, -0.02)), onSph(R + 0.02, s * 1.0, 0.1), onSph(R + 0.005, s * 1.45, 0.05)], 0.007, M.frame, 12));
  }
  glasses.add(tube([onSph(R + 0.04, -0.13, 0.1), onSph(R + 0.05, 0, 0.12), onSph(R + 0.04, 0.13, 0.1)], 0.008, M.frame, 8));
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.09), M.glint);
  glint.position.copy(onSph(R + 0.045, 0.36, 0.14));
  glint.lookAt(glint.position.clone().multiplyScalar(2));
  glint.renderOrder = 6;
  glasses.add(glint);
  head.add(glasses);
  const mouths = makeMouths(head, R, F, -0.34);
  // Dad's shovel (right hand)
  const shovel = new THREE.Group();
  shovel.add(limb(V(0, 0.15, 0), V(0, -0.55, 0), 0.018, M.wood));
  const blade = mesh(sph(0.12, 20, 12, 0, Math.PI, 0, Math.PI), M.metal);
  blade.scale.set(0.95, 1.2, 0.3);
  blade.rotation.set(0, Math.PI / 2, 0);
  blade.position.y = -0.66;
  shovel.add(blade);
  hands[0].add(shovel);
  return { root, body, hips, legs, knees, torso, arms, elbows, hands, neck, head, eyes, brows, glasses, glint, mouths, shovel, M, R };
}

// ---------------------------------------------------------------------------
// the dog: fluffy, golden, floppy ears, a wagging plume of a tail
// ---------------------------------------------------------------------------
function buildDog(ctx, F) {
  const M = {
    fur: furMat('#e8b86e', 'dogfur', 1.4),
    cream: furMat('#f7e8cf', 'dogcream', 1.4),
    ear: furMat('#c98e48', 'dogear', 1.2),
    nose: std('#1b1515', 0.25),
    mouthIn: std('#4a1714', 0.6),
    tongue: std('#e2707a', 0.5),
    iris: std('#3b2416', 0.2),
    collar: std('#d33a33', 0.45),
    tag: std('#e8bc4c', 0.25, 0.9, { envMap: ctx.envMap, envMapIntensity: 1.2 }),
  };
  ctx.envMats.push(M.tag);
  const rnd = ctx.U.mulberry32(77);
  const root = new THREE.Group();
  const body = new THREE.Group(); // the trunk; pitches for digging and sitting
  body.position.y = 0.27;
  root.add(body);
  const trunk = mesh(sph(0.17, 30, 22), M.fur);
  trunk.scale.set(0.88, 0.8, 1.45);
  body.add(trunk);
  // fluff: soft tufts over the back, the chest ruff, the haunches
  const fluff = [];
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2, zz = (rnd() - 0.5) * 0.42;
    const r = 0.06 + 0.035 * rnd();
    const m = mesh(ctx.G.lumpyBlob(r, 2, 0.18, 900 + i), M.fur);
    m.position.set(Math.cos(a) * 0.12, Math.abs(Math.sin(a)) * 0.1 + 0.01, zz);
    body.add(m);
    fluff.push(m);
  }
  const ruff = mesh(ctx.G.lumpyBlob(0.13, 2, 0.16, 951), M.cream);
  ruff.scale.set(0.95, 1.05, 0.75);
  ruff.position.set(0, 0.02, 0.2);
  body.add(ruff);
  // legs at the corners of the trunk: [front right, front left, back right, back left]
  const legs = [];
  for (const [x, z] of [[-0.085, 0.17], [0.085, 0.17], [-0.09, -0.17], [0.09, -0.17]]) {
    const g = new THREE.Group();
    g.position.set(x, -0.03, z);
    const upper = mesh(cap(0.05, 0.12, 4, 12), M.fur);
    upper.position.y = -0.08;
    const paw = mesh(sph(0.05, 16, 12), M.cream);
    paw.scale.set(1, 0.7, 1.2);
    paw.position.set(0, -0.2, 0.02);
    g.add(upper, paw);
    body.add(g);
    legs.push(g);
  }
  // tail: a fluffy plume on a pivot
  const tail = new THREE.Group();
  tail.position.set(0, 0.07, -0.24);
  const tailPts = [V(0, 0, 0), V(0, 0.08, -0.06), V(0, 0.17, -0.05), V(0, 0.22, 0.02)];
  tail.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.04, 10), M.fur));
  const plume = mesh(ctx.G.lumpyBlob(0.065, 2, 0.2, 960), M.cream);
  plume.position.set(0, 0.21, 0.0);
  tail.add(plume);
  body.add(tail);
  // head on a neck, a jaw that opens, the collar with a tag
  const neck = new THREE.Group();
  neck.position.set(0, 0.08, 0.22);
  body.add(neck);
  const collar = mesh(new THREE.TorusGeometry(0.085, 0.018, 8, 26), M.collar);
  collar.rotation.x = Math.PI / 2 - 0.6;
  collar.position.set(0, 0.0, 0.01);
  const tag = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.006, 16), M.tag, false);
  tag.rotation.x = Math.PI / 2 - 0.3;
  tag.position.set(0, -0.07, 0.07);
  neck.add(collar, tag);
  const head = new THREE.Group();
  head.position.set(0, 0.1, 0.07);
  neck.add(head);
  const R = 0.13;
  head.add(mesh(sph(R, 36, 26), M.fur));
  for (const [x, y, z, r] of [[0, 0.09, -0.02, 0.07], [-0.06, 0.07, -0.05, 0.05], [0.06, 0.07, -0.05, 0.05]]) {
    const tf = mesh(ctx.G.lumpyBlob(r, 2, 0.2, 970 + Math.round(x * 100)), M.fur);
    tf.position.set(x, y, z);
    head.add(tf);
  }
  const muzzle = mesh(sph(0.075, 24, 18), M.cream);
  muzzle.scale.set(1.05, 0.75, 1.0);
  muzzle.position.set(0, -0.035, 0.1);
  const nose = mesh(sph(0.028, 16, 12), M.nose);
  nose.scale.set(1.25, 0.85, 0.9);
  nose.position.set(0, -0.005, 0.172);
  head.add(muzzle, nose);
  const jaw = new THREE.Group();
  jaw.position.set(0, -0.06, 0.06);
  const chin = mesh(sph(0.05, 18, 12), M.cream);
  chin.scale.set(1.0, 0.55, 1.2);
  chin.position.set(0, -0.012, 0.06);
  const tongue = mesh(sph(0.028, 14, 8), M.tongue, false);
  tongue.scale.set(1, 0.4, 1.4);
  tongue.position.set(0, 0.004, 0.07);
  jaw.add(chin, tongue);
  head.add(jaw);
  const mouthLine = tube([V(-0.035, -0.06, 0.14), V(-0.012, -0.072, 0.155), V(0, -0.064, 0.16), V(0.012, -0.072, 0.155), V(0.035, -0.06, 0.14)], 0.005, M.nose, 12);
  head.add(mouthLine);
  const mouth = new THREE.Object3D(); // the card is held here, crosswise
  mouth.position.set(0, -0.07, 0.16);
  head.add(mouth);
  const eyes = [], ears = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.036, M.iris, M.fur, F);
    e.g.position.copy(onSph(R - 0.012, s * 0.4, 0.14));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.04)));
    head.add(e.g);
    eyes.push(e);
    const ep = new THREE.Group();
    ep.position.copy(onSph(R * 0.9, s * 1.15, 0.6));
    const ear = mesh(cap(0.05, 0.11, 6, 12), M.ear);
    ear.scale.set(1, 1, 0.4);
    ear.position.set(s * 0.025, -0.075, 0);
    ep.add(ear);
    head.add(ep);
    ears.push(ep);
  }
  return { root, body, legs, tail, neck, head, jaw, mouth, eyes, ears, R };
}

export function build(ctx) {
  const { T, WD, U } = ctx;
  const { clamp, lerp, prog, smooth, popIn, easeOutBack, easeOutCubic, wobble, bump } = U;
  const F = faceMats();
  const dad = buildDad(ctx, F);
  const dog = buildDog(ctx, F);
  ctx.add(dad.root);
  ctx.add(dog.root);
  ctx.anchors.dadHandR = dad.hands[0];
  ctx.anchors.dadHandL = dad.hands[1];
  ctx.anchors.dadHead = dad.head;
  ctx.anchors.dadRoot = dad.root;
  ctx.anchors.dogMouth = dog.mouth;
  ctx.shared = ctx.shared || {};
  const ramp = (t, a, d) => smooth(prog(t, a, d));
  const win = (t, a, b, f = 0.2) => bump(t, a, b, f);
  const angLerp = (a, b, f) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * f;
  const { HOUSE, BACKDOOR, DOGHOUSE: D, LANE, HOLE } = WD;

  // ------------------------------------------------------------------ Dad
  // humming: little glowing music notes (an oval head, a stem, a flag)
  const noteMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.3, 0.7), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const notes = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const m = noteMat.clone();
    const headN = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), m);
    headN.scale.set(1.3, 0.95, 1);
    headN.rotation.z = 0.4;
    const stem = new THREE.Mesh(new THREE.PlaneGeometry(0.008, 0.11), m);
    stem.position.set(0.034, 0.055, 0);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.012), m);
    flag.position.set(0.05, 0.1, 0);
    flag.rotation.z = -0.6;
    g.add(headN, stem, flag);
    if (i % 2) {
      // a pair of joined notes
      const h2 = headN.clone(), s2 = stem.clone();
      h2.position.x = 0.07;
      s2.position.x = 0.104;
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.014), m);
      beam.position.set(0.069, 0.108, 0);
      g.add(h2, s2, beam);
      flag.visible = false;
    }
    g.traverse((o) => (o.renderOrder = 14));
    g.userData.mat = m;
    ctx.scene.add(g);
    notes.push(g);
  }
  // the path length (for the walk cycle)
  const PATH_L = (() => { let l = 0; const P = WD.DAD_PATH; for (let i = 1; i < P.length; i++) l += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return l; })();
  const porchY = (z) => HOUSE.floor * clamp((HOUSE.z + 1.05 + 0.72 - z) / 0.72);
  const FACE_BED = -Math.PI / 2 + 0.45; // at the flower bed: facing left, turned a little to the camera
  const _w = new THREE.Vector3(), _f = new THREE.Vector3();

  function poseDad(t) {
    const P = {
      x: BACKDOOR.x, y: HOUSE.floor, z: HOUSE.z - 0.35, ry: 0, walk: 0, walkPh: 0, lean: 0, roll: 0, crouch: 0,
      aR: [0.1, 0.12], aL: [0.1, 0.12], eR: 0.15, eL: 0.15,
      hYaw: 0, hPitch: 0, hRoll: 0, gx: 0, gy: 0, open: 1, wide: 0, browL: 0, browR: 0,
      mouth: 'smile', talk: 0, hum: 0, glint: 0, shovel: 0, shTilt: 0, det: 0,
    };
    // walking out of the door and across the lawn with the detector
    if (t >= T.dadOut) {
      const w = WD.dadWalk(t);
      P.x = w.x;
      P.z = w.z;
      P.y = porchY(w.z);
      const u = smooth(prog(t, T.dadOut, T.dadArrive - T.dadOut));
      P.walkPh = u * PATH_L * 5.2;
      P.walk = w.moving ? clamp(Math.min(prog(t, T.dadOut, 0.3), 1 - prog(t, T.dadArrive - 0.35, 0.35)) * 3) : 0;
      P.ry = w.moving ? w.dir : FACE_BED;
      if (t > T.dadArrive - 0.6) P.ry = angLerp(w.dir, FACE_BED, ramp(t, T.dadArrive - 0.6, 0.6));
      P.mouth = 'smile';
      P.hum = win(t, T.dadOut + 0.2, T.dadArrive - 0.1, 0.3);
      P.aL = [0.1 - 0.3 * Math.sin(P.walkPh) * P.walk, 0.12];
      P.eL = 0.25;
      P.det = 1;
      P.open = 0.85;
    }
    // the detector in the right hand, sweeping over the lawn
    if (t >= T.dadOut && t < T.dadDig0) {
      P.aR = [0.55, 0.1];
      P.eR = 0.35;
      P.hPitch = -0.3;
      P.gy = -0.2;
      // closer to the flowers the beeps get faster: he leans in, curious
      const cu = ramp(t, T.beep0, T.beep1 - T.beep0);
      P.lean = 0.15 * cu;
      P.browL = 0.7 * cu;
      P.browR = 0.7 * cu;
      P.wide = 0.3 * cu;
      P.hum *= 1 - ramp(t, T.beep0, 0.3);
      if (cu > 0.3) P.mouth = 'o';
      P.hPitch = lerp(-0.3, -0.5, cu);
    }
    // the dig: detector away, shovel in, a cartoon flurry inside the dust cloud
    if (t >= T.dadDig0 && t < T.boxUp) {
      P.x = WD.DAD_SPOT.x;
      P.z = LANE;
      P.y = 0;
      P.ry = FACE_BED;
      P.det = 0;
      P.shovel = popIn(t, T.dadDig0 + 0.05, 0.3, 2.4) * (1 - smooth(prog(t, T.dadDig1 - 0.05, 0.2)));
      const f = Math.sin((t - T.dadDig0) * 34);
      P.aR = [1.3 + 0.7 * f, -0.1];
      P.aL = [1.3 + 0.7 * f, -0.3];
      P.eR = 0.3;
      P.eL = 0.3;
      P.lean = 0.35 + 0.1 * Math.sin((t - T.dadDig0) * 17);
      P.roll = 0.06 * Math.sin((t - T.dadDig0) * 23);
      P.mouth = 'grin';
      P.hPitch = -0.4;
    }
    // holding the box, the lid, the card, reading, one eyebrow, the line
    if (t >= T.boxUp) {
      P.x = WD.DAD_SPOT.x;
      P.z = LANE;
      P.y = 0;
      P.ry = lerp(FACE_BED, -0.38, ramp(t, T.boxUp, 1.0));
      P.det = 0;
      // the box held in both hands at chest height
      P.aR = [0.55, -0.28];
      P.aL = [0.55, -0.28];
      P.eR = 1.1;
      P.eL = 1.1;
      P.hPitch = -0.42;
      P.gy = -0.3;
      P.mouth = 'smile';
      P.open = 0.9;
      // the lid: the right hand lifts it
      const lid = win(t, T.creak0 - 0.1, T.cardOut, 0.15);
      P.aR = [lerp(P.aR[0], 0.75, lid), lerp(P.aR[1], -0.2, lid)];
      P.eR = lerp(P.eR, 1.35, lid);
      // the card comes out, up beside the face; the box drops to the left hip
      const rd = ramp(t, T.cardOut - 0.05, 0.4);
      P.aR = [lerp(P.aR[0], 0.72, rd), lerp(P.aR[1], 0.1, rd)];
      P.eR = lerp(P.eR, 1.85, rd);
      P.aL = [lerp(P.aL[0], 0.18, rd), lerp(P.aL[1], 0.12, rd)];
      P.eL = lerp(P.eL, 0.45, rd);
      P.hPitch = lerp(P.hPitch, -0.15, rd);
      P.hYaw = lerp(P.hYaw, -0.35, rd);
      P.gx = -0.3 * rd;
      P.gy = lerp(P.gy, -0.12, rd);
      P.glint = win(t, T.read - 0.05, T.read + 0.45, 0.12);
      // one eyebrow up, a small smirk
      const br = easeOutBack(clamp(prog(t, T.brow, 0.3)), 2.0);
      P.browL = 1.2 * br;
      P.browR = -0.25 * clamp(prog(t, T.brow, 0.3));
      if (t > T.brow) P.mouth = 'smirk';
      // the line: "Hmm..." closed, "a C in science?" open
      const hm = win(t, 46.02, 46.3, 0.06);
      let op = 0;
      for (const [a, b] of [[46.29, 46.4], [46.4, 46.5], [46.5, 46.62], [46.7, 46.92], [46.94, 47.28]]) op = Math.max(op, win(t, a, b, 0.04));
      P.talk = op;
      P.hum = Math.max(P.hum, hm * 0.0);
      if (op > 0.1) P.mouth = 'o';
      // glances at the kid on "science?"
      const gl = win(t, 46.68, 48.6, 0.25);
      P.hYaw = lerp(P.hYaw, -0.75, gl);
      P.gx = lerp(P.gx, -0.45, gl);
      P.hPitch = lerp(P.hPitch, -0.02, gl);
    }
    return P;
  }

  function applyDad(t) {
    const P = poseDad(t);
    const d = dad;
    d.root.visible = t >= T.door + 0.08;
    if (!d.root.visible) return;
    d.root.position.set(P.x, P.y, P.z);
    d.root.rotation.set(0, P.ry, P.roll * 0.4);
    const bob = P.walk * 0.025 * Math.abs(Math.cos(P.walkPh));
    d.hips.position.y = 0.84 + bob - 0.12 * P.crouch;
    d.legs.forEach((leg, i) => {
      const ph = P.walkPh + (i ? Math.PI : 0);
      leg.rotation.set(-0.42 * Math.sin(ph) * P.walk, 0, 0);
      d.knees[i].rotation.x = Math.max(0, 0.55 * Math.sin(ph + 1.2)) * P.walk;
    });
    d.torso.rotation.set(P.lean, 0.08 * Math.sin(P.walkPh) * P.walk, P.roll * 0.6);
    d.arms[0].rotation.set(-P.aR[0], 0, -P.aR[1]);
    d.arms[1].rotation.set(-P.aL[0], 0, P.aL[1]);
    d.elbows[0].rotation.x = -P.eR;
    d.elbows[1].rotation.x = -P.eL;
    d.neck.rotation.set(-P.hPitch * 0.4, P.hYaw * 0.4, P.hRoll * 0.3);
    d.head.rotation.set(-P.hPitch * 0.6, P.hYaw * 0.6, P.hRoll * 0.7 + 0.04 * Math.sin(t * 2.3) * P.hum);
    const open = Math.min(P.open, 1 - blinkAt(U, t, 3.4, 0.13, 5));
    d.eyes.forEach((e) => setEye(e, open, P.gx, P.gy, P.wide));
    d.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      const raise = i === 0 ? P.browR : P.browL;
      b.position.y = b.userData.y0 + 0.03 * raise;
      b.rotation.z = s * (0.06 - 0.25 * Math.max(0, raise)) + s * 0.2 * Math.max(0, -raise);
    });
    showMouth(d.mouths, P.mouth);
    if (P.mouth === 'o') d.mouths.o.scale.set(1.1, 0.45 + 0.9 * P.talk + (P.talk > 0 ? 0 : 0.35), 0.35);
    d.M.glint.opacity = 0.9 * P.glint;
    d.glint.rotation.z = t * 2;
    d.glint.scale.setScalar(0.4 + P.glint);
    d.shovel.visible = P.shovel > 0.01;
    d.shovel.scale.setScalar(Math.max(0.001, P.shovel));
    d.shovel.rotation.x = 0.4;
    // where the detector's coil is (for props.js): ~0.95 m ahead of Dad, swept side to side
    d.root.updateMatrixWorld(true);
    const sweep = Math.sin((t - T.dadOut) * 2.6) * (0.45 - 0.2 * ramp(t, T.beep0, 1.5));
    const fx = Math.sin(P.ry + sweep), fz = Math.cos(P.ry + sweep);
    ctx.shared.coil = { x: P.x + fx * 0.95, y: 0.05, z: P.z + fz * 0.95, on: P.det };
    ctx.shared.dadFacing = P.ry;
    // humming notes float up from his head and fade
    d.head.getWorldPosition(_w);
    notes.forEach((g, i) => {
      const per = 0.85, life = 1.6;
      const ph = (t + i * (per / 2)) % (per * 2);
      const u = ph / life;
      const born = t - ph;
      const ok = P.hum > 0.05 && u < 1 && born > T.dadOut;
      g.visible = ok;
      if (!ok) return;
      g.position.set(_w.x + 0.12 + 0.22 * u + 0.04 * Math.sin(u * 8 + i), _w.y + 0.2 + 0.5 * u, _w.z + 0.12);
      g.rotation.z = 0.25 * Math.sin(u * 5 + i);
      g.scale.setScalar(1.6 * (0.6 + 0.5 * easeOutBack(clamp(u * 3), 2)));
      g.userData.mat.opacity = P.hum * smooth(clamp(u * 5)) * (1 - smooth(clamp((u - 0.55) / 0.45)));
    });
  }

  // ------------------------------------------------------------------ dog
  const DOOR = { x: D.x, z: D.z + D.d / 2 }; // the doghouse door (front wall)
  const INSIDE = { x: D.x, z: DOOR.z - 0.28 }; // lying just inside the door, chin on the paws
  const SPOT = WD.DOG_SPOT;
  const LIE = { x: D.x + 0.12, z: DOOR.z + 0.42 }; // lying in front of the doghouse, scenes 4-6
  const SIT7 = { x: -1.64, z: -0.8 }; // next to the kid in scene 7
  const RIM = { x: -0.6, z: LANE }; // lying at the hole's rim, reaching a paw in
  // trot between two spots over [t0, t1] -> {x, z, dir, k (0..1), moving}
  const trot = (a, b, t, t0, t1) => {
    const k = smooth(prog(t, t0, t1 - t0));
    return { x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), dir: Math.atan2(b.x - a.x, b.z - a.z), k, moving: k > 0 && k < 1, dist: k * Math.hypot(b.x - a.x, b.z - a.z) };
  };
  function poseDog(t) {
    const P = {
      x: INSIDE.x, z: INSIDE.z, ry: 0, lie: 1, sit: 0, pitch: 0, gait: 0, gaitPh: 0, dig: 0,
      hYaw: 0, hPitch: 0.35, hRoll: 0, jaw: 0, open: 0, wide: 0, gx: 0, gy: 0, ears: 0, wag: 0.1, reach: 0, breath: 1,
    };
    // asleep inside the doghouse; "Sort of.": the head pops out
    if (t < T.dogGo) {
      const pk = ramp(t, T.dogPeek, 0.25);
      P.z = lerp(INSIDE.z, INSIDE.z + 0.16, pk);
      P.hPitch = lerp(0.4, -0.1, pk);
      P.open = pk;
      P.ears = easeOutBack(clamp(prog(t, T.dogPeek + 0.05, 0.25)), 2.4);
      P.wide = 0.6 * pk;
      P.hYaw = 0.35 * pk;
      P.sniff = pk;
    }
    // trots out to the patch
    if (t >= T.dogGo && t < T.sniff[0]) {
      const w = trot({ x: INSIDE.x, z: INSIDE.z + 0.16 }, SPOT, t, T.dogGo, T.dogArrive);
      P.x = w.x;
      P.z = w.z;
      P.lie = 1 - ramp(t, T.dogGo, 0.15);
      P.ry = angLerp(0, w.dir, ramp(t, T.dogGo, 0.2));
      if (t > T.dogArrive - 0.15) P.ry = angLerp(w.dir, 1.25, ramp(t, T.dogArrive - 0.15, 0.25));
      P.gait = w.moving ? 1 : 0;
      P.gaitPh = w.dist * 16;
      P.open = 1;
      P.ears = 0.6;
      P.wag = 0.6;
      P.hPitch = 0.05;
      P.jaw = 0.25;
    }
    if (t >= T.sniff[0] && t < T.dogGo + 100) {
      if (t < T.snatch + 0.35) {
        P.x = SPOT.x;
        P.z = SPOT.z;
        P.lie = 0;
        P.ry = 1.25;
        P.open = 1;
        P.ears = 0.5;
        P.wag = 0.7;
        // sniffing the patch
        const sn = win(t, T.sniff[0] - 0.05, T.dogDig0 + 0.05, 0.08);
        P.hPitch = lerp(0.05, 0.75, sn);
        P.pitch = 0.12 * sn;
        // digging with the front paws, butt up
        const dg = win(t, T.dogDig0, T.dogDig1 + 0.05, 0.08);
        P.dig = dg;
        P.pitch = lerp(P.pitch, 0.35, dg);
        P.hPitch = lerp(P.hPitch, 0.55, dg);
        P.wag = lerp(P.wag, 1, dg);
        // grabs the card, lifts it proudly, barks
        const gr = win(t, T.dogGrab - 0.05, T.dogGrab + 0.3, 0.1);
        P.hPitch = lerp(P.hPitch, 1.0, gr);
        P.pitch = lerp(P.pitch, 0.3, gr);
        const proud = ramp(t, T.dogGrab + 0.25, 0.25);
        if (proud > 0) {
          P.hPitch = lerp(P.hPitch, -0.35, proud);
          P.pitch = lerp(P.pitch, -0.1, proud);
          P.hYaw = lerp(P.hYaw, -0.45, proud);
          P.wag = 1.4;
          P.jaw = 0.2;
          P.open = 1 - 0.45 * proud;
          const bk = win(t, T.bark - 0.05, T.bark + 0.25, 0.05);
          P.hPitch -= 0.25 * bk;
          P.jaw = lerp(P.jaw, 0.45, bk);
          P.ears = lerp(P.ears, 1.1, bk);
        }
        // the kid snatches it: the head follows, then it sits
        const sn2 = win(t, T.snatch - 0.05, T.snatch + 0.3, 0.08);
        P.hYaw = lerp(P.hYaw, 0.3, sn2);
        P.hPitch = lerp(P.hPitch, 0.0, sn2);
        P.wide = sn2;
      } else if (t < T.pawLine - 0.25) {
        // sits watching the kid jump in and dig
        P.x = SPOT.x;
        P.z = SPOT.z;
        P.lie = 0;
        P.sit = ramp(t, T.snatch + 0.35, 0.3);
        P.ry = 1.25;
        P.open = 1;
        P.ears = 0.5;
        P.wag = 0.4;
        P.hPitch = 0.35;
        P.hRoll = 0.3 * Math.sin((t - T.deep0) * 2.2);
        P.jaw = 0.25;
      } else if (t < T.cardDown + 0.3) {
        // lies at the rim and reaches a paw down into the hole: can't reach
        P.x = lerp(SPOT.x, RIM.x, ramp(t, T.pawLine - 0.25, 0.3));
        P.z = RIM.z;
        P.ry = Math.PI / 2;
        P.lie = ramp(t, T.pawLine - 0.25, 0.3);
        P.reach = win(t, T.pawLine - 0.1, T.cardDown + 0.2, 0.25);
        P.hPitch = 0.65;
        P.open = 1;
        P.wide = 0.3;
        P.ears = 0.2;
        P.wag = 0.25;
        P.hRoll = 0.15;
      } else if (t < T.storm1 - 0.2) {
        // sits again, watching the refill
        P.x = RIM.x + 0.04;
        P.z = RIM.z;
        P.ry = 1.3;
        P.lie = 1 - ramp(t, T.cardDown + 0.3, 0.3);
        P.sit = ramp(t, T.cardDown + 0.3, 0.3);
        P.open = 1;
        P.ears = 0.4;
        P.wag = 0.5;
        P.hPitch = 0.2;
        P.jaw = 0.25;
      } else if (t < T.storm3 + 0.3) {
        // the storm: runs back into the doghouse and peeks out, ears down
        const w = trot({ x: RIM.x + 0.04, z: RIM.z }, { x: DOOR.x, z: DOOR.z - 0.15 }, t, T.storm1 - 0.2, T.storm1 + 0.55);
        P.x = w.x;
        P.z = w.z;
        P.ry = w.moving ? w.dir : Math.PI;
        P.gait = w.moving ? 1.3 : 0;
        P.gaitPh = w.dist * 18;
        // inside: turned round, lying with the head out of the door
        const inn = ramp(t, T.storm1 + 0.55, 0.4);
        P.ry = angLerp(P.ry, 0, inn);
        P.z = lerp(P.z, INSIDE.z + 0.12, inn);
        P.lie = inn;
        P.hPitch = lerp(0.1, 0.15, inn);
        P.open = 1;
        P.wide = 0.2;
        P.ears = -0.3;
        P.wag = 0.05;
        P.hYaw = 0.4 * inn;
      } else if (t < T.kidWalk1) {
        // the sun is back: comes out and lies in front of the doghouse, watching
        const w = trot({ x: DOOR.x, z: INSIDE.z + 0.12 }, LIE, t, T.storm3 + 0.3, T.storm3 + 1.1);
        P.x = w.x;
        P.z = w.z;
        P.ry = w.moving ? w.dir : 0.9;
        if (!w.moving && w.k >= 1) P.ry = 0.9;
        P.gait = w.moving ? 0.8 : 0;
        P.gaitPh = w.dist * 16;
        P.lie = ramp(t, T.storm3 + 1.1, 0.3);
        P.open = 1 - 0.25 * Math.max(0, Math.sin(t * 0.7));
        P.ears = 0.2;
        P.wag = 0.3;
        P.hPitch = 0.15;
        P.hYaw = 0.25;
        P.jaw = 0.2;
        // pricks up at the lump and the roller
        const al = win(t, T.lump0, T.roll1 + 0.4, 0.3);
        P.ears = lerp(P.ears, 0.9, al);
        P.hPitch = lerp(P.hPitch, -0.05, al);
        P.wide = 0.4 * al;
      } else {
        // sits next to the kid for a pat, then watches Dad
        const w = trot(LIE, SIT7, t, T.kidWalk1 - 0.5, T.kidWalk1 + 0.2);
        P.x = w.x;
        P.z = w.z;
        P.ry = w.moving ? w.dir : 0.95;
        if (!w.moving) P.ry = 0.95;
        P.gait = w.moving ? 0.7 : 0;
        P.gaitPh = w.dist * 16;
        P.lie = 0;
        P.sit = ramp(t, T.kidWalk1 + 0.1, 0.3);
        P.open = 1;
        P.ears = 0.4;
        P.wag = 0.8;
        P.jaw = 0.3;
        const pat = win(t, T.kidWalk1 + 0.1, T.kidWalk1 + 1.2, 0.2);
        P.hPitch = 0.25 * pat;
        P.open = 1 - 0.85 * pat;
        P.hYaw = lerp(0.2, 0.0, pat);
        // the beeps: ears up, head turns to Dad
        const bp = ramp(t, T.beep0, 0.4);
        P.ears = lerp(P.ears, 1.0, bp);
        P.hYaw = lerp(P.hYaw, 0.35, bp);
        P.wide = 0.3 * bp;
        // the head tilt at the very end
        const tl = ramp(t, 48.55, 0.35);
        P.hRoll = 0.42 * tl;
        P.hYaw = lerp(P.hYaw, -0.2, tl);
        P.hPitch = lerp(P.hPitch, -0.05, tl);
      }
    }
    return P;
  }

  function applyDog(t) {
    const P = poseDog(t);
    const g = dog;
    g.root.position.set(P.x, 0, P.z);
    g.root.rotation.y = P.ry;
    const lie = clamp(P.lie), sit = clamp(P.sit);
    // trunk height and pitch: lying low, sitting tipped back, digging tipped forward
    const breath = 1 + 0.02 * Math.sin(t * (lie > 0.5 ? 1.8 : 3.0));
    const trotBob = P.gait * 0.025 * Math.abs(Math.sin(P.gaitPh));
    g.body.position.y = lerp(0.27, 0.13, lie) - 0.04 * sit + trotBob;
    g.body.rotation.x = P.pitch - 0.55 * sit;
    g.body.scale.set(1, breath, 1);
    // legs: trot (diagonal pairs), dig (front paws scrape), lying (folded), sitting
    g.legs.forEach((leg, i) => {
      const front = i < 2;
      const diag = i === 0 || i === 3 ? 0 : Math.PI;
      let rx = 0.55 * Math.sin(P.gaitPh + diag) * P.gait;
      if (front && P.dig > 0) rx += P.dig * (-0.9 + 0.8 * Math.sin(t * 34 + (i ? Math.PI : 0)));
      // lying: front legs forward along the ground, back legs tucked
      rx = lerp(rx, front ? -1.45 : 1.2, lie);
      // sitting: front legs straight down (against the tipped trunk), back legs folded forward
      rx = lerp(rx, front ? 0.55 : -1.1, sit);
      leg.rotation.set(rx, 0, 0);
      leg.scale.set(1, 1, 1);
    });
    // the reaching paw: the front leg nearest the camera stretches down into the hole
    if (P.reach > 0) {
      const leg = g.legs[0];
      const dip = 0.5 + 0.5 * Math.sin((t - T.pawLine) * 5.5);
      leg.rotation.set(lerp(-1.45, -0.55 - 0.25 * dip, P.reach), 0, 0);
      leg.scale.set(1, 1 + 1.4 * P.reach, 1);
    }
    // tail wag
    g.tail.rotation.set(-0.25 + 0.3 * sit, Math.sin(t * (6 + 10 * P.wag)) * (0.15 + 0.5 * P.wag), 0);
    // head
    g.neck.rotation.set(P.hPitch * 0.45, P.hYaw * 0.5, P.hRoll * 0.4);
    g.head.rotation.set(P.hPitch * 0.55 + 0.04 * Math.sin(t * 30) * (P.sniff || 0), P.hYaw * 0.5, P.hRoll * 0.6);
    g.jaw.rotation.x = 0.5 * clamp(P.jaw);
    const open = Math.min(P.open, 1 - blinkAt(U, t, 3.1, 0.12, 7));
    g.eyes.forEach((e) => setEye(e, open, P.gx, P.gy, P.wide));
    g.ears.forEach((ep, i) => {
      const s = i === 0 ? -1 : 1;
      ep.rotation.set(0, 0, s * (0.2 + 0.9 * P.ears) + 0.1 * s * Math.sin(P.gaitPh * 0.5) * P.gait);
    });
  }

  return {
    update(t) {
      applyDad(t);
      applyDog(t);
      dad.root.updateMatrixWorld(true);
      dog.root.updateMatrixWorld(true);
    },
    dad, dog,
  };
}
