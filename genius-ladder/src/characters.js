import * as THREE from 'three';
import { mat, box, at, group } from './materials.js';
import { JOINTS } from './poses.js';
import { DEG, clamp } from './anim.js';
import { CONFIG } from './config.js';

const HIP_H = 0.86;
const BLACK = '#121212';

// ---------------------------------------------------------------------------
// Human puppet: boxes for body/limbs, faceted icosahedron head, box features.
// Hierarchy: root(pos) > squash(scale, world-aligned) > yaw(ry) > tilt(rx,rz) > hips > ...
// ---------------------------------------------------------------------------
export function makeHuman(look) {
  const { skin, shirt, pants, shoes } = look;
  const root = new THREE.Group();
  const squash = new THREE.Group();
  const yaw = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(squash); squash.add(yaw); yaw.add(tilt);

  const pantsMat = new THREE.MeshLambertMaterial({ color: pants, flatShading: true });
  const hips = at(new THREE.Group(), 0, HIP_H, 0);
  tilt.add(hips);
  hips.add(at(box(0.4, 0.17, 0.24, pantsMat), 0, 0.0, 0));
  // cartoon "puffy pants": a little tent (with a flag) and a big balloon, both pants fabric
  const tent = new THREE.Group();
  const tentBody = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.2, 4), pantsMat);
  tentBody.rotation.set(Math.PI / 2, Math.PI / 4, 0);
  tentBody.position.set(0, -0.05, 0.2);
  tent.add(tentBody, at(box(0.012, 0.16, 0.012, '#e8e8e8'), 0, 0.03, 0.3), at(box(0.07, 0.045, 0.006, '#e23b2e'), 0.035, 0.09, 0.3));
  hips.add(tent);
  // a straight "extra pant leg": fabric tube along +Z with a hem cuff at the far end
  const puffG = new THREE.Group();
  const tubeMat = new THREE.MeshLambertMaterial({ color: '#8b5a3a', flatShading: true });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 8), tubeMat);
  tube.rotation.x = Math.PI / 2;
  tube.castShadow = true;
  const cuffMat = new THREE.MeshLambertMaterial({ color: pants, flatShading: true });
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, 1, 8), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.castShadow = true;
  puffG.add(tube, cuff);
  hips.add(puffG);
  const axis = new THREE.Vector3();

  // legs
  const leg = (side) => {
    const hip = at(new THREE.Group(), 0.105 * side, -0.03, 0);
    hip.add(at(box(0.175, 0.44, 0.2, pantsMat), 0, -0.21, 0));
    const knee = at(new THREE.Group(), 0, -0.42, 0);
    knee.add(at(box(0.16, 0.38, 0.18, pantsMat), 0, -0.18, 0));
    knee.add(at(box(0.175, 0.085, 0.3, shoes), 0, -0.37, 0.055));
    hip.add(knee);
    hips.add(hip);
    return { hip, knee };
  };
  const legL = leg(1), legR = leg(-1);

  // torso
  const spine = at(new THREE.Group(), 0, 0.06, 0);
  hips.add(spine);
  spine.add(at(box(0.5, 0.58, 0.28, shirt), 0, 0.28, 0));
  const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), mat(shirt));
  belly.position.set(0, 0.2, 0.1);
  belly.scale.set(1, 0.95, 1);
  belly.castShadow = true;
  spine.add(belly);
  if (look.tie) {
    spine.add(at(box(0.16, 0.26, 0.02, '#f4f4f4'), 0, 0.45, 0.142));
    spine.add(at(box(0.07, 0.34, 0.025, look.tie), 0, 0.38, 0.152));
  }
  const pockets = new THREE.Group();
  for (const sx of [-1, 1]) pockets.add(at(box(0.07, 0.13, 0.11, '#f2f2f2'), 0.235 * sx, -0.1, 0.03));
  hips.add(pockets);

  // arms
  const arm = (side) => {
    const sh = at(new THREE.Group(), 0.315 * side, 0.5, 0);
    sh.rotation.order = 'XZY'; // twist first, then out, then forward swing
    sh.add(at(box(0.17, 0.19, 0.17, shirt), 0, -0.06, 0)); // short sleeve
    sh.add(at(box(0.125, 0.16, 0.125, skin), 0, -0.2, 0));
    const el = at(new THREE.Group(), 0, -0.28, 0);
    el.add(at(box(0.12, 0.27, 0.12, skin), 0, -0.13, 0));
    el.add(at(box(0.13, 0.11, 0.135, skin), 0, -0.31, 0.0));
    const hand = at(new THREE.Group(), 0, -0.32, 0);
    el.add(hand);
    sh.add(el);
    spine.add(sh);
    return { sh, el, hand };
  };
  const armL = arm(1), armR = arm(-1);

  // thumb (for thumbs-up)
  const thumb = at(box(0.045, 0.1, 0.05, skin), -0.05, 0.05, 0.04);
  armR.hand.add(thumb);

  // neck & head
  const neck = at(new THREE.Group(), 0, 0.585, 0);
  spine.add(neck);
  neck.add(at(box(0.11, 0.12, 0.11, skin), 0, 0.03, 0));
  const head = at(new THREE.Group(), 0, 0.07, 0);
  neck.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.178, 1), mat(skin));
  skull.scale.set(0.95, 1.08, 0.98);
  skull.position.y = 0.17;
  skull.castShadow = true;
  head.add(skull);
  // ears + nose
  head.add(at(box(0.04, 0.07, 0.05, skin), 0.17, 0.16, 0));
  head.add(at(box(0.04, 0.07, 0.05, skin), -0.17, 0.16, 0));
  head.add(at(box(0.04, 0.065, 0.05, skin), 0, 0.145, 0.168));

  // face features
  const face = at(new THREE.Group(), 0, 0, 0);
  head.add(face);
  const eyes = new THREE.Group();
  face.add(eyes);
  const eyeL = at(box(0.032, 0.05, 0.03, BLACK), 0.062, 0.19, 0.158);
  const eyeR = at(box(0.032, 0.05, 0.03, BLACK), -0.062, 0.19, 0.158);
  eyes.add(eyeL, eyeR);
  const browL = at(box(0.075, 0.02, 0.03, look.brow || '#3a2414'), 0.064, 0.255, 0.152);
  const browR = at(box(0.075, 0.02, 0.03, look.brow || '#3a2414'), -0.064, 0.255, 0.152);
  face.add(browL, browR);
  const mouths = {
    line: at(box(0.085, 0.016, 0.03, BLACK), 0, 0.085, 0.158),
    wide: at(box(0.11, 0.02, 0.03, BLACK), 0, 0.085, 0.158),
    o: at(box(0.045, 0.055, 0.03, BLACK), 0, 0.08, 0.156),
    smirk: at(box(0.07, 0.016, 0.03, BLACK), 0.018, 0.088, 0.158),
    smile: group(
      at(box(0.06, 0.016, 0.03, BLACK), 0, 0.08, 0.158),
      at(box(0.03, 0.016, 0.03, BLACK), 0.04, 0.088, 0.155),
      at(box(0.03, 0.016, 0.03, BLACK), -0.04, 0.088, 0.155)
    ),
  };
  mouths.smirk.rotation.z = 10 * DEG;
  mouths.smile.children[1].rotation.z = 35 * DEG;
  mouths.smile.children[2].rotation.z = -35 * DEG;
  for (const m of Object.values(mouths)) face.add(m);

  // grass stuck in the mouth (gag)
  const grass = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.09, 3), mat(i % 2 ? CONFIG.palette.grass : CONFIG.palette.grassLight));
    c.position.set(-0.03 + i * 0.015, 0.085, 0.17);
    c.rotation.set(1.2 + (i % 3) * 0.2, 0, (i - 2) * 0.25);
    grass.add(c);
  }
  face.add(grass);

  // hair / hat
  if (look.hair) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.192, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(look.hair));
    h.scale.set(0.97, 0.9, 1.02);
    h.position.set(0, 0.2, -0.012);
    h.rotation.x = -0.32;
    h.castShadow = true;
    head.add(h);
    head.add(at(box(0.3, 0.14, 0.08, look.hair), 0, 0.15, -0.135)); // back of head
  }
  if (look.bun) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(look.hair));
    b.position.set(0, 0.36, -0.1);
    b.castShadow = true;
    head.add(b);
  }
  if (look.hat) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(look.hat));
    h.scale.set(1, 1.15, 1.02);
    h.position.set(0, 0.215, -0.005);
    h.rotation.x = -0.12;
    h.castShadow = true;
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.198, 0.2, 0.075, 10), mat(look.hat));
    cuff.position.set(0, 0.225, -0.005);
    cuff.rotation.x = -0.12;
    cuff.scale.set(1, 1, 1.02);
    head.add(h, cuff);
  }

  // hand props
  const props = makeHandProps();
  armR.hand.add(props.hammer, props.glue, props.phone, props.rubber, props.butter, props.net, props.keys);
  head.add(props.bino);

  const api = {
    root, head, skull, hips, armL, armR, legL, legR,
    // world-space box of the censored tube (null when hidden) — used for the blur
    censorMesh() {
      return root.visible && puffG.visible ? tube : null;
    },
    apply(s) {
      root.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
      const sq = s.sq ?? 1;
      const sxz = 1 / Math.sqrt(Math.max(0.2, sq));
      squash.scale.set(sxz * (s.sx ?? 1), sq, sxz * (s.sx ?? 1));
      yaw.rotation.y = (s.ry ?? 0) * DEG;
      const wad = (s.waddle ?? 0) * Math.sin((s.walk ?? 0) * Math.PI * 2);
      tilt.rotation.set((s.rx ?? 0) * DEG, 0, ((s.rz ?? 0) + wad) * DEG);
      belly.visible = (s.belly ?? 0) > 0.01;
      belly.scale.setScalar(Math.max(0.01, s.belly ?? 0));
      pockets.visible = !!s.pockets;
      pantsMat.color.set(s.pants || pants);
      tent.visible = (s.tent ?? 0) > 0.01;
      tent.scale.setScalar(Math.max(0.01, s.tent ?? 0));
      const pf = s.puff ?? 0;
      puffG.visible = pf > 0.01;
      const len = 1.1 * pf, rad = 0.07 + 0.08 * pf;
      const yawP = (s.puffYaw ?? 0) * DEG, pitchP = (s.puffPitch ?? 0) * DEG;
      puffG.rotation.set(-pitchP, yawP, 0, 'YXZ');
      axis.set(0, 0, 1).applyEuler(puffG.rotation);
      const po = s.puffOff || [axis.x * (0.08 + len / 2), -0.12 + axis.y * (0.08 + len / 2), 0.08 + axis.z * (0.08 + len / 2)];
      puffG.position.set(po[0], po[1], po[2]);
      tube.scale.set(rad, len, rad);
      cuff.scale.set(rad, Math.min(0.12, len * 0.15), rad);
      cuff.position.set(0, 0, len / 2 - Math.min(0.12, len * 0.15) / 2);
      cuff.visible = false;
      tubeMat.color.set(s.puffColor || '#8b5a3a');
      root.visible = s.vis !== false;

      const j = { ...JOINTS };
      for (const k in JOINTS) if (s[k] !== undefined) j[k] = s[k];

      // procedural walk / climb cycle overlay
      const amp = s.walkAmp ?? 0;
      if (amp > 0) {
        const ph = (s.walk ?? 0) * Math.PI * 2;
        const sw = Math.sin(ph);
        j.hipLx += 30 * sw * amp; j.hipRx -= 30 * sw * amp;
        j.kneeL += Math.max(0, -Math.cos(ph)) * 35 * amp;
        j.kneeR += Math.max(0, Math.cos(ph)) * 35 * amp;
        j.shLx -= 24 * sw * amp; j.shRx += 24 * sw * amp;
      }
      const bob = amp > 0 ? Math.abs(Math.sin((s.walk ?? 0) * Math.PI * 2)) * 0.035 * amp : 0;

      hips.position.y = HIP_H + j.hipY + bob;
      spine.rotation.set(j.spine * DEG, j.spineY * DEG, j.spineZ * DEG);
      neck.rotation.set(j.neckX * DEG, j.neckY * DEG, j.neckZ * DEG);
      armL.sh.rotation.set(-j.shLx * DEG, j.shLy * DEG, j.shLz * DEG);
      armR.sh.rotation.set(-j.shRx * DEG, -j.shRy * DEG, -j.shRz * DEG);
      armL.el.rotation.x = -j.elL * DEG;
      armR.el.rotation.x = -j.elR * DEG;
      legL.hip.rotation.set(-j.hipLx * DEG, 0, j.hipLz * DEG);
      legR.hip.rotation.set(-j.hipRx * DEG, 0, -j.hipRz * DEG);
      legL.knee.rotation.x = j.kneeL * DEG;
      legR.knee.rotation.x = j.kneeR * DEG;

      setFace(s.face || 'neutral', s.eyeX ?? 0, s.eyeY ?? 0, s.blink ?? 0);
      thumb.visible = !!s.thumb;
      grass.visible = !!s.grass;
      props.hammer.visible = s.hold === 'hammer';
      props.glue.visible = s.hold === 'glue';
      props.phone.visible = s.hold === 'phone';
      props.rubber.visible = s.hold === 'rubber';
      props.butter.visible = s.hold === 'butter';
      props.net.visible = s.hold === 'net';
      props.keys.visible = s.hold === 'keys';
      props.bino.visible = !!s.bino;
    },
  };

  function setFace(name, ex, ey, blink) {
    const F = FACES[name] || FACES.neutral;
    eyes.position.set(ex * 0.02, ey * 0.02, 0);
    const eh = blink > 0.5 ? 0.18 : F.eye[1];
    eyeL.scale.set(F.eye[0], eh, 1);
    eyeR.scale.set(F.eye[0], eh, 1);
    browL.position.y = 0.255 + F.brow[0];
    browR.position.y = 0.255 + F.brow[0];
    browL.rotation.z = F.brow[1] * DEG;
    browR.rotation.z = -F.brow[1] * DEG + (F.brow[2] || 0) * DEG;
    browR.position.y += F.brow[3] || 0;
    for (const [k, m] of Object.entries(mouths)) m.visible = k === F.mouth;
  }

  return api;
}

// eye [w, h] scale, brow [dy, angle(+ = angry inner-down), extra right angle, extra right dy], mouth
const FACES = {
  neutral: { eye: [1, 1], brow: [0, 0], mouth: 'line' },
  bored: { eye: [1, 0.45], brow: [-0.012, 0], mouth: 'line' },
  smug: { eye: [1.05, 0.5], brow: [-0.006, 10, -26, 0.018], mouth: 'smirk' },
  proud: { eye: [1.15, 0.2], brow: [0.02, -8], mouth: 'smile' },
  happy: { eye: [1, 1], brow: [0.018, -6], mouth: 'smile' },
  shock: { eye: [1.25, 1.55], brow: [0.032, -12], mouth: 'o' },
  dazed: { eye: [1.2, 0.18], brow: [0.008, -16], mouth: 'o' },
  serious: { eye: [1, 0.8], brow: [-0.016, 14], mouth: 'line' },
  strain: { eye: [1.2, 0.18], brow: [-0.01, 18], mouth: 'wide' },
  focus: { eye: [1, 0.7], brow: [-0.012, 10], mouth: 'smirk' },
  blank: { eye: [1, 1], brow: [0.01, 0], mouth: 'line' },
  sad: { eye: [1, 0.75], brow: [0.006, -18], mouth: 'line' },
};

function makeHandProps() {
  const pal = CONFIG.palette;
  // hammer: handle along -Y from the grip, head at the far end
  const hammer = new THREE.Group();
  hammer.add(at(box(0.04, 0.34, 0.045, pal.woodDark), 0, -0.08, 0.02));
  const head = at(box(0.065, 0.065, 0.17, '#6f7780'), 0, -0.24, 0.05);
  hammer.add(head);
  hammer.rotation.x = -Math.PI / 2; // points forward out of the fist
  hammer.position.set(0, -0.03, 0.03);

  const glue = new THREE.Group();
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.15, 8), mat('#f2f2f2'));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 8), mat('#e2382c'));
  cap.position.y = -0.11;
  cap.rotation.x = Math.PI;
  glue.add(bottle, cap);
  glue.add(at(box(0.085, 0.06, 0.004, '#2a7fd8'), 0, 0.01, 0.043));
  glue.position.set(0, -0.06, 0.03);

  const phone = at(box(0.075, 0.14, 0.015, '#1b1b25'), 0.03, -0.04, 0.06);
  phone.rotation.x = -0.4;

  const rubber = at(box(0.12, 0.08, 0.12, pal.rubber), 0, -0.07, 0.04);

  const bino = new THREE.Group();
  for (const s of [-1, 1]) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.052, 0.14, 8), mat('#202024'));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0.055 * s, 0.19, 0.24);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.01, 8), mat('#6fa8ff', { emissive: '#1d3d8a' }));
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.055 * s, 0.19, 0.312);
    bino.add(tube, lens);
  }
  bino.add(at(box(0.06, 0.03, 0.05, '#202024'), 0, 0.2, 0.22));
  const butter = at(box(0.11, 0.07, 0.17, '#ffe066'), 0, -0.07, 0.05);
  const net = new THREE.Group();
  net.add(at(box(0.035, 0.035, 2.0, '#d9d9d9'), 0, 0, 0.75));
  net.add(at(box(0.4, 0.03, 0.34, '#4fb3ff', { transparent: true, opacity: 0.7 }), 0, 0, 1.9));
  net.position.set(0, -0.05, 0);
  const keys = new THREE.Group();
  keys.add(at(box(0.05, 0.05, 0.01, '#f2c230'), 0, -0.1, 0.05), at(box(0.03, 0.09, 0.01, '#f2c230'), 0.04, -0.15, 0.05), at(box(0.03, 0.08, 0.01, '#cfd6dd'), -0.03, -0.14, 0.05));
  for (const o of [hammer, glue, phone, rubber, bino, butter, net, keys]) o.traverse((m) => m.isMesh && (m.castShadow = true));
  return { hammer, glue, phone, rubber, bino, butter, net, keys };
}

// ---------------------------------------------------------------------------
// Dog: boxes on four pivoting legs + wagging tail.
// ---------------------------------------------------------------------------
export function makeDog() {
  const c = CONFIG.dog;
  const root = new THREE.Group();
  const yaw = new THREE.Group();
  root.add(yaw);
  const body = at(new THREE.Group(), 0, 0.4, 0);
  yaw.add(body);
  body.add(box(0.3, 0.26, 0.58, c.body));
  body.add(at(box(0.31, 0.06, 0.2, c.collar), 0, 0.06, 0.24));

  const headPivot = at(new THREE.Group(), 0, 0.14, 0.3);
  body.add(headPivot);
  headPivot.add(at(box(0.26, 0.24, 0.24, c.body), 0, 0.06, 0.06));
  headPivot.add(at(box(0.15, 0.12, 0.16, c.snout), 0, 0.0, 0.24));
  headPivot.add(at(box(0.06, 0.05, 0.04, '#141414'), 0, 0.04, 0.33));
  headPivot.add(at(box(0.04, 0.045, 0.02, '#141414'), 0.065, 0.11, 0.18));
  headPivot.add(at(box(0.04, 0.045, 0.02, '#141414'), -0.065, 0.11, 0.18));
  const tongue = at(box(0.06, 0.02, 0.07, '#e5606e'), 0, -0.065, 0.27);
  headPivot.add(tongue);
  for (const s of [-1, 1]) {
    const ear = at(box(0.06, 0.16, 0.1, c.ears), 0.14 * s, 0.1, 0.03);
    ear.rotation.z = 0.35 * s;
    headPivot.add(ear);
  }

  const legs = [];
  for (const [x, z] of [[0.1, 0.22], [-0.1, 0.22], [0.1, -0.22], [-0.1, -0.22]]) {
    const pivot = at(new THREE.Group(), x, -0.08, z);
    pivot.add(at(box(0.085, 0.32, 0.09, c.body), 0, -0.15, 0));
    pivot.add(at(box(0.095, 0.05, 0.12, c.snout), 0, -0.3, 0.02));
    body.add(pivot);
    legs.push(pivot);
  }
  const tail = at(new THREE.Group(), 0, 0.08, -0.29);
  const tailMesh = at(box(0.06, 0.06, 0.26, c.body), 0, 0, -0.12);
  tail.add(tailMesh);
  tail.rotation.x = -0.7;
  body.add(tail);

  return {
    root,
    apply(s) {
      root.visible = s.vis !== false;
      root.position.set(s.x ?? 0, s.y ?? 0, s.z ?? 0);
      yaw.rotation.y = (s.ry ?? 0) * DEG;
      const ph = (s.walk ?? 0) * Math.PI * 2;
      const amp = s.walkAmp ?? 0;
      const sw = Math.sin(ph) * 32 * DEG * amp;
      legs[0].rotation.x = sw; legs[3].rotation.x = sw;
      legs[1].rotation.x = -sw; legs[2].rotation.x = -sw;
      body.position.y = 0.4 + Math.abs(Math.cos(ph)) * 0.03 * amp;
      // leg lift (pee): rear-right leg swings out sideways
      const lift = clamp(s.leg ?? 0);
      legs[3].rotation.z = -lift * 80 * DEG;
      body.rotation.z = lift * 8 * DEG;
      tail.rotation.y = Math.sin((s.wag ?? 0) * Math.PI * 2) * 0.6;
      tail.rotation.x = -0.7 - lift * 0.3;
      headPivot.rotation.set((s.headX ?? 0) * DEG, (s.headY ?? 0) * DEG, (s.headZ ?? 0) * DEG);
      tongue.visible = !!s.tongue;
    },
    // rear of the dog in world space (pee stream origin)
    rearWorld(target) {
      body.updateWorldMatrix(true, false);
      return target.set(0.05, -0.1, -0.12).applyMatrix4(body.matrixWorld);
    },
  };
}
