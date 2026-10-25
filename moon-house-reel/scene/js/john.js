// John: a cute toy-like astronaut. Built from rounded primitives, rigged with
// simple joints, posed every frame from a flat "pose" object (easy to blend).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './util.js';
import { fabricNormal } from './textures.js';

export const DEFAULT_POSE = {
  x: 0, y: 0, z: 0, yaw: 0,
  hip: 0.53, lean: 0, roll: 0, bodyY: 0,
  lfx: 0.13, lfy: 0, lfz: 0.02, rfx: -0.13, rfy: 0, rfz: -0.02,
  tPitch: 0, tYaw: 0, tRoll: 0,
  hYaw: 0, hPitch: 0, hRoll: 0,
  laX: 0.05, laZ: 0.22, laY: 0, laE: 0.25,
  raX: 0.05, raZ: 0.22, raY: 0, raE: 0.25,
  blink: 0, happy: 0, half: 0, mSmile: 1, mOpen: 0, mFlat: 0, mO: 0, brow: 0, browTilt: 0, lookX: 0, lookY: 0,
  breathe: 0, squash: 0,
};

export function blendPose(a, b, k) {
  const o = {};
  for (const key in DEFAULT_POSE) {
    const va = a[key] ?? DEFAULT_POSE[key], vb = b[key] ?? DEFAULT_POSE[key];
    o[key] = va + (vb - va) * k;
  }
  return o;
}
export const pose = (over) => Object.assign({}, DEFAULT_POSE, over);

const L_THIGH = 0.235, L_SHIN = 0.225, ANKLE = 0.075;
// eyelid caps: sphere caps around +y covering more of the eye as the angle grows
const LID_GEOS = Array.from({ length: 17 }, (_, k) => new THREE.SphereGeometry(0.0435, 24, 16, 0, Math.PI * 2, 0, Math.max(0.01, (k / 16) * Math.PI)));

function capsule(r, len, mat, seg = 24) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 10, seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sphere(r, mat, ws = 32, hs = 24) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function rbox(w, h, d, r, mat) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function visorMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uSun: { value: new THREE.Vector3(-0.74, 0.5, 0.4).normalize() }, uFog: { value: 0 }, uTint: { value: new THREE.Color(0.75, 0.88, 1.0) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vNV;
      void main(){ vec4 wp = modelMatrix * vec4(position,1.0); vN = normalize(mat3(modelMatrix) * normal);
        vNV = normalize(normalMatrix * normal); vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uFog; uniform vec3 uTint; varying vec3 vN; varying vec3 vV; varying vec3 vNV;
      void main(){
        vec3 n = normalize(vN), v = normalize(vV);
        float fr = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.2);
        vec3 col = uTint * 0.35; float a = 0.05 + 0.55 * fr;
        // hard sun glint
        vec3 r = reflect(-normalize(uSun), n);
        float sp = pow(max(dot(r, v), 0.0), 220.0);
        col += vec3(1.0) * sp * 9.0; a += sp;
        // painted cartoon highlight (window-shaped) on the upper-left of the bubble
        vec3 nv = normalize(vNV);
        float h1 = smoothstep(0.86, 0.9, dot(nv, normalize(vec3(-0.55, 0.55, 0.62))));
        float h2 = smoothstep(0.965, 0.975, dot(nv, normalize(vec3(-0.28, 0.72, 0.62))));
        col += vec3(1.6) * (h1 * 0.55 + h2 * 0.6); a += h1 * 0.28 + h2 * 0.4;
        // dust haze on the visor
        col = mix(col, vec3(0.55), uFog * 0.5); a = mix(a, 0.6, uFog * 0.35);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
      }`,
  });
}

export function createJohn(scene) {
  const fab = fabricNormal(256);
  const M = {
    suit: new THREE.MeshStandardMaterial({ color: 0xf1efea, roughness: 0.66, normalMap: fab, normalScale: new THREE.Vector2(0.12, 0.12) }),
    suitShade: new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.7, normalMap: fab, normalScale: new THREE.Vector2(0.12, 0.12) }),
    accent: new THREE.MeshStandardMaterial({ color: 0xff8b3d, roughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xa7b1c2, roughness: 0.32, metalness: 0.75 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0xc5ccd6, roughness: 0.55 }),
    sole: new THREE.MeshStandardMaterial({ color: 0x4a4f58, roughness: 0.8 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xe2a77e, roughness: 0.58 }),
    cheek: new THREE.MeshBasicMaterial({ color: 0xff8f8f, transparent: true, opacity: 0.35, depthWrite: false }),
    eye: new THREE.MeshStandardMaterial({ color: 0x1b130e, roughness: 0.12 }),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    hair: new THREE.MeshStandardMaterial({ color: 0x3a2417, roughness: 0.62 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x5a1f1f, roughness: 0.5 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xe0676b, roughness: 0.5 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x2e1c12, roughness: 0.7 }),
    helmet: new THREE.MeshStandardMaterial({ color: 0xf6f5f2, roughness: 0.35, metalness: 0.0 }),
    led: (c) => new THREE.MeshStandardMaterial({ color: 0x111111, emissive: c, emissiveIntensity: 3.2 }),
    seal: new THREE.MeshStandardMaterial({ color: 0x8ea3c0, roughness: 0.3, metalness: 0.7, emissive: 0x38e0ff, emissiveIntensity: 0 }),
    dust: new THREE.MeshStandardMaterial({ color: 0x8a8a8d, roughness: 1 }),
  };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  // pelvis
  const pelvis = capsule(0.19, 0.12, M.suit); pelvis.rotation.z = Math.PI / 2; pelvis.scale.set(1, 1, 0.85); body.add(pelvis);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.035, 12, 40), M.metal); belt.rotation.x = Math.PI / 2; belt.position.y = 0.09; belt.castShadow = true; body.add(belt);
  // torso
  const torso = new THREE.Group(); body.add(torso);
  const chest = capsule(0.27, 0.2, M.suit, 32); chest.position.y = 0.32; chest.scale.set(1.05, 1, 0.86); torso.add(chest);
  const panel = rbox(0.24, 0.16, 0.06, 0.025, M.rubber); panel.position.set(0, 0.32, 0.225); panel.rotation.x = -0.12; torso.add(panel);
  const ledColors = [0xff4d4d, 0x46e07a, 0x46a8ff];
  ledColors.forEach((c, i) => { const l = sphere(0.016, M.led(c), 12, 8); l.position.set(-0.06 + i * 0.06, 0.345, 0.258); torso.add(l); });
  const screen = rbox(0.14, 0.035, 0.012, 0.006, M.led(0x9bf2ff)); screen.position.set(0, 0.29, 0.255); screen.rotation.x = -0.12; screen.material.emissiveIntensity = 1.4; torso.add(screen);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.018, 10, 48, Math.PI), M.accent); stripe.position.set(0, 0.2, 0); stripe.rotation.set(Math.PI / 2, 0, 0); stripe.scale.set(1.05, 0.86, 1); torso.add(stripe);
  // star patch on the left shoulder area
  const backpack = rbox(0.46, 0.52, 0.22, 0.07, M.suit); backpack.position.set(0, 0.36, -0.27); torso.add(backpack);
  const bpTop = rbox(0.38, 0.08, 0.18, 0.03, M.metal); bpTop.position.set(0, 0.63, -0.27); torso.add(bpTop);
  const thrusterL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.08, 16), M.metal); thrusterL.position.set(0.14, 0.08, -0.29); torso.add(thrusterL);
  const thrusterR = thrusterL.clone(); thrusterR.position.x = -0.14; torso.add(thrusterR);
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.4).multiplyScalar(4), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const flames = [thrusterL, thrusterR].map((th) => { const f = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 16), flameMat); f.rotation.x = Math.PI; f.position.set(th.position.x, -0.07, -0.29); torso.add(f); return f; });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 16, 48), M.metal); collar.rotation.x = Math.PI / 2; collar.position.y = 0.58; collar.castShadow = true; torso.add(collar);

  // head + helmet
  const neck = new THREE.Group(); neck.position.y = 0.6; torso.add(neck);
  const headG = new THREE.Group(); neck.add(headG);
  const HEAD_Y = 0.28;
  const head = sphere(0.235, M.skin, 48, 32); head.position.y = HEAD_Y; head.scale.set(1, 0.97, 0.95); headG.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.247, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
  hair.position.y = HEAD_Y + 0.012; hair.rotation.x = -0.38; hair.castShadow = true; headG.add(hair);
  const tuft = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 10, 20, Math.PI * 1.3), M.hair); tuft.position.set(0.03, HEAD_Y + 0.235, 0.09); tuft.rotation.set(0.3, 0.4, 0.6); headG.add(tuft);
  [[-0.11, 0.17, 0.16, 0.5], [-0.04, 0.2, 0.175, 0.15], [0.04, 0.2, 0.175, -0.15], [0.11, 0.17, 0.16, -0.5]].forEach(([x, y, z, rz], i) => {
    const b = sphere(0.062 - Math.abs(x) * 0.08, M.hair, 20, 14); b.position.set(x, HEAD_Y + y - 0.02, z - 0.02); b.scale.set(1.0, 0.62, 0.6); b.rotation.set(-0.5, 0, rz); headG.add(b);
  });
  const ears = [-1, 1].map((s) => { const e = sphere(0.045, M.skin, 16, 12); e.position.set(0.228 * s, HEAD_Y - 0.01, -0.01); e.scale.set(0.6, 1, 1); headG.add(e); return e; });
  const nose = sphere(0.022, M.skin, 16, 12); nose.position.set(0, HEAD_Y - 0.035, 0.228); headG.add(nose);
  // eyes
  const face = new THREE.Group(); face.position.y = HEAD_Y; headG.add(face);
  const eyes = [-1, 1].map((s) => {
    const g = new THREE.Group(); g.position.set(0.082 * s, 0.022, 0.205); g.rotation.y = 0.32 * s; face.add(g);
    const ball = sphere(0.043, M.eye, 24, 18); ball.scale.set(0.85, 1.12, 0.45); g.add(ball);
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 12, 8), M.white); hl1.position.set(-0.012, 0.02, 0.02); g.add(hl1);
    const hl2 = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 6), M.white); hl2.position.set(0.013, -0.016, 0.02); g.add(hl2);
    // happy closed eye: an arc
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 8, 20, Math.PI), M.eye); arc.position.set(0, -0.005, 0.016); arc.visible = false; g.add(arc);
    // upper lid (skin) for half-lidded / blink
    const lid = new THREE.Mesh(LID_GEOS[0], M.skin);
    lid.scale.set(0.85 * 1.1, 1.12 * 1.08, 0.45 * 1.35); lid.position.set(0, 0.0, 0.0); g.add(lid);
    const brow = capsule(0.0085, 0.05, M.brow, 8); brow.rotation.z = Math.PI / 2; brow.position.set(0, 0.072, 0.012); g.add(brow);
    return { g, ball, hl1, hl2, arc, lid, brow, s };
  });
  const cheeks = [-1, 1].map((s) => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), M.cheek); c.position.set(0.135 * s, -0.045, 0.186); c.rotation.y = 0.62 * s; face.add(c); return c; });
  // mouths
  const mSmile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0095, 10, 24, Math.PI * 0.8), M.mouth);
  mSmile.position.set(0, -0.058, 0.215); mSmile.rotation.set(-0.15, 0, Math.PI + Math.PI * 0.1); face.add(mSmile);
  const mOpen = new THREE.Group(); mOpen.position.set(0, -0.08, 0.212); face.add(mOpen);
  const mo1 = sphere(0.045, M.mouth, 24, 16); mo1.scale.set(1, 0.75, 0.35); mOpen.add(mo1);
  const mo2 = sphere(0.026, M.tongue, 16, 12); mo2.position.set(0, -0.016, 0.006); mo2.scale.set(1, 0.6, 0.4); mOpen.add(mo2);
  const mFlat = capsule(0.0085, 0.05, M.mouth, 8); mFlat.rotation.z = Math.PI / 2; mFlat.position.set(0, -0.065, 0.216); face.add(mFlat);
  const mO = sphere(0.024, M.mouth, 16, 12); mO.scale.set(1, 1.15, 0.4); mO.position.set(0, -0.072, 0.214); face.add(mO);

  // helmet: white shell with a big round visor opening facing forward
  const helmet = new THREE.Group(); helmet.position.y = HEAD_Y - 0.01; headG.add(helmet);
  const HR = 0.36;
  const shellGeo = new THREE.SphereGeometry(HR, 64, 40, 0, Math.PI * 2, 1.05, Math.PI - 1.05);
  shellGeo.rotateX(Math.PI / 2);
  const shell = new THREE.Mesh(shellGeo, M.helmet); shell.castShadow = true; shell.receiveShadow = true; helmet.add(shell);
  const shellIn = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ color: 0x9aa0aa, roughness: 0.8, side: THREE.BackSide })); shellIn.scale.setScalar(0.985); helmet.add(shellIn);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(HR * Math.sin(1.05), 0.026, 16, 64), M.metal);
  rim.position.z = HR * Math.cos(1.05); rim.castShadow = true; helmet.add(rim);
  const visorGeo = new THREE.SphereGeometry(HR * 0.995, 64, 32, 0, Math.PI * 2, 0, 1.08);
  visorGeo.rotateX(Math.PI / 2);
  const visorMat = visorMaterial();
  const visor = new THREE.Mesh(visorGeo, visorMat); visor.renderOrder = 5; helmet.add(visor);
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 16), M.metal); lamp.rotation.z = Math.PI / 2; lamp.position.set(0.36, 0.06, 0.02); helmet.add(lamp);
  const lampGlow = sphere(0.022, M.led(0xfff2c0), 12, 8); lampGlow.position.set(0.39, 0.06, 0.03); helmet.add(lampGlow);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.16, 8), M.metal); antenna.position.set(-0.24, 0.3, -0.1); antenna.rotation.z = 0.5; helmet.add(antenna);
  const antTip = sphere(0.02, M.led(0xff5a4a), 12, 8); antTip.position.set(-0.28, 0.37, -0.1); helmet.add(antTip);

  // arms (side +1 = his left, at +x since he faces +z)
  const mkArm = (s) => {
    const shoulder = new THREE.Group(); shoulder.position.set(0.31 * s, 0.47, 0); torso.add(shoulder);
    const pad = sphere(0.11, M.suit, 24, 18); shoulder.add(pad);
    const upper = capsule(0.085, 0.16, M.suit); upper.position.y = -0.11; shoulder.add(upper);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.087, 0.016, 8, 24), M.accent); band.rotation.x = Math.PI / 2; band.position.y = -0.08; shoulder.add(band);
    const elbow = new THREE.Group(); elbow.position.y = -0.22; shoulder.add(elbow);
    const ering = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.02, 8, 24), M.rubber); ering.rotation.x = Math.PI / 2; elbow.add(ering);
    const fore = capsule(0.078, 0.13, M.suit); fore.position.y = -0.09; elbow.add(fore);
    const hand = new THREE.Group(); hand.position.y = -0.2; elbow.add(hand);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.08, 0.05, 24), M.rubber); cuff.position.y = 0.01; cuff.castShadow = true; hand.add(cuff);
    const glove = sphere(0.085, M.rubber, 24, 18); glove.position.y = -0.07; glove.scale.set(0.95, 1.1, 0.85); hand.add(glove);
    const thumb = capsule(0.028, 0.04, M.rubber, 10); thumb.position.set(-0.06 * s, -0.05, 0.05); thumb.rotation.z = 0.6 * s; hand.add(thumb);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.02, 10, 28), M.seal); seal.rotation.x = Math.PI / 2; seal.position.y = 0.035; seal.visible = false; hand.add(seal);
    return { shoulder, elbow, hand, seal, s };
  };
  const armL = mkArm(1), armR = mkArm(-1);

  // legs
  const mkLeg = (s) => {
    const hipJ = new THREE.Group(); hipJ.position.set(0.115 * s, 0, 0); body.add(hipJ);
    const thigh = capsule(0.1, L_THIGH - 0.06, M.suit); thigh.position.y = -L_THIGH / 2; hipJ.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -L_THIGH; hipJ.add(knee);
    const kpad = sphere(0.075, M.suitShade, 16, 12); kpad.position.z = 0.04; kpad.scale.set(1, 1, 0.6); knee.add(kpad);
    const shin = capsule(0.095, L_SHIN - 0.07, M.suit); shin.position.y = -L_SHIN / 2; knee.add(shin);
    const ankle = new THREE.Group(); ankle.position.y = -L_SHIN; knee.add(ankle);
    const boot = rbox(0.19, 0.13, 0.29, 0.055, M.rubber); boot.position.set(0, -ANKLE + 0.065, 0.045); ankle.add(boot);
    const sole = rbox(0.2, 0.035, 0.3, 0.015, M.sole); sole.position.set(0, -ANKLE + 0.0175, 0.045); ankle.add(sole);
    const seal = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 28), M.seal); seal.rotation.x = Math.PI / 2; seal.position.y = 0.02; seal.visible = false; ankle.add(seal);
    return { hipJ, knee, ankle, seal, s };
  };
  const legL = mkLeg(1), legR = mkLeg(-1);

  // dust specks stuck to the suit (revealed progressively)
  const r = mulberry32(31);
  const speckGeo = new THREE.IcosahedronGeometry(0.0062, 0);
  const dustSets = [];
  const addDust = (parent, n, fn) => {
    const im = new THREE.InstancedMesh(speckGeo, M.dust, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const [x, y, z] = fn();
      m.makeRotationFromEuler(new THREE.Euler(r() * 6, r() * 6, r() * 6));
      m.scale(new THREE.Vector3(1 + r() * 1.4, 1 + r(), 1 + r()));
      m.setPosition(x, y, z);
      im.setMatrixAt(i, m);
    }
    im.count = 0; parent.add(im); dustSets.push({ im, n });
  };
  const onCapsule = (R, len, cy) => () => { const a = r() * Math.PI * 2, y = (r() - 0.5) * (len + R); return [Math.cos(a) * R * 1.02, cy + y, Math.sin(a) * R * 1.02]; };
  addDust(torso, 420, () => { const a = r() * Math.PI * 2, y = 0.12 + r() * 0.42; return [Math.cos(a) * 0.29, y, Math.sin(a) * 0.245]; });
  for (const leg of [legL, legR]) { addDust(leg.hipJ, 120, onCapsule(0.1, 0.18, -0.12)); addDust(leg.knee, 160, onCapsule(0.097, 0.15, -0.11)); }
  for (const arm of [armL, armR]) { addDust(arm.shoulder, 70, onCapsule(0.087, 0.16, -0.11)); addDust(arm.elbow, 70, onCapsule(0.08, 0.13, -0.09)); }

  root.traverse((o) => { if (o.isMesh && o.material !== visorMat && !o.material.transparent) { o.castShadow = true; } });
  scene.add(root);

  const ik = (leg, hipPos, foot) => {
    // planar 2-bone IK in the body's y-z plane; foot = target sole position relative to hip joint
    const ty = foot.y + ANKLE, tz = foot.z;
    let d = Math.hypot(ty, tz);
    const maxD = L_THIGH + L_SHIN - 0.002;
    if (d > maxD) d = maxD;
    const cosK = (L_THIGH * L_THIGH + L_SHIN * L_SHIN - d * d) / (2 * L_THIGH * L_SHIN);
    const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosK)));
    const a = Math.atan2(tz, -ty);
    const off = Math.acos(Math.max(-1, Math.min(1, (L_THIGH * L_THIGH + d * d - L_SHIN * L_SHIN) / (2 * L_THIGH * d))));
    const thighA = a + off;
    leg.hipJ.rotation.set(-thighA, 0, Math.atan2(foot.x, -ty) * 0.8);
    leg.knee.rotation.set(bend, 0, 0);
    leg.ankle.rotation.set(thighA - bend, 0, -leg.hipJ.rotation.z);
  };

  const state = { helmetOn: 1, helmetLift: 0, helmetCarry: null };

  function setPose(p, extra = {}) {
    root.position.set(p.x, p.y, p.z);
    root.rotation.set(0, p.yaw, 0);
    const sq = p.squash;
    body.position.set(0, p.hip + p.bodyY, 0);
    body.rotation.set(p.lean, 0, p.roll);
    torso.scale.set(1 + sq * 0.06, 1 - sq * 0.08, 1 + sq * 0.06);
    torso.rotation.set(p.tPitch, p.tYaw, p.tRoll);
    const br = 1 + p.breathe * 0.045;
    chest.scale.set(1.05 * br, 1 + p.breathe * 0.02, 0.86 * br);
    neck.rotation.set(p.hPitch, p.hYaw, p.hRoll);
    // arms
    const setArm = (arm, X, Z, Y, E) => {
      arm.shoulder.rotation.set(-X, Y * arm.s, Z * arm.s, 'XZY');
      arm.elbow.rotation.set(-E, 0, 0);
    };
    setArm(armL, p.laX, p.laZ, p.laY, p.laE);
    setArm(armR, p.raX, p.raZ, p.raY, p.raE);
    // legs: feet relative to root (in root space); convert to hip-joint space ignoring body lean
    const hipH = p.hip + p.bodyY;
    const toHip = (fx, fy, fz, s) => ({ x: fx - 0.115 * s, y: fy - hipH, z: fz });
    // account for body lean: rotate target by -lean around x
    const unLean = (v) => { const c = Math.cos(-p.lean), sn = Math.sin(-p.lean); return { x: v.x, y: v.y * c - v.z * sn, z: v.y * sn + v.z * c }; };
    ik(legL, null, unLean(toHip(p.lfx, p.lfy, p.lfz, 1)));
    ik(legR, null, unLean(toHip(p.rfx, p.rfy, p.rfz, -1)));
    // face
    const happy = p.happy > 0.5;
    for (const e of eyes) {
      e.ball.visible = e.hl1.visible = e.hl2.visible = !happy;
      e.arc.visible = happy;
      const closed = Math.min(1, Math.max(p.blink, p.half * 0.5));
      e.lid.visible = !happy && closed > 0.03;
      e.lid.geometry = LID_GEOS[Math.round(closed * 16)];
      e.g.position.x = 0.082 * e.s + p.lookX * 0.018;
      e.g.position.y = 0.022 + p.lookY * 0.015;
      e.hl1.position.x = -0.012 + p.lookX * 0.006; e.hl2.position.x = 0.013 + p.lookX * 0.006;
      e.brow.position.y = 0.072 + p.brow * 0.02;
      e.brow.rotation.z = Math.PI / 2 + e.s * p.browTilt * 0.4;
    }
    const mw = [p.mSmile, p.mOpen, p.mFlat, p.mO];
    const top = mw.indexOf(Math.max(...mw));
    mSmile.visible = top === 0; mOpen.visible = top === 1; mFlat.visible = top === 2; mO.visible = top === 3;
    mOpen.scale.setScalar(0.7 + 0.3 * Math.min(1, p.mOpen));
    // helmet
    helmet.visible = state.helmetOn > 0.001;
    helmet.position.set(0, HEAD_Y - 0.01 + state.helmetLift, 0);
    if (extra.dust !== undefined) {
      for (const d of dustSets) d.im.count = Math.floor(d.n * extra.dust);
      visorMat.uniforms.uFog.value = extra.dust * 0.25;
    }
    if (extra.seals !== undefined) {
      const sv = extra.seals;
      [armL, armR, legL, legR].forEach((part, i) => {
        const k = sv[i] || 0;
        part.seal.visible = k > 0.001;
        const sc = 1 + (1 - k) * 0.8;
        part.seal.scale.set(sc, sc, 1);
      });
      M.seal.emissiveIntensity = extra.sealGlow || 0;
    }
    flames.forEach((f) => { f.visible = (extra.jet || 0) > 0.01; f.scale.set(1, 0.4 + (extra.jet || 0) * 1.2, 1); });
  }

  return {
    root, body, torso, headG, helmet, head, armL, armR, legL, legR, visor, M, state, setPose,
    handR: armR.hand, handL: armL.hand,
  };
}
