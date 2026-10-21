// Stylised toy-like characters built from smooth primitives.
// Gorilla (shell fur), Kid, Neighbour. Each exposes joints + face controls.
import * as THREE from 'three';
import { patch, limbGeo, sphereGeo, mesh, group, roundedBoxGeo, canvasTexture, lerp, clamp, mulberry32 } from './lib.js';

const ell = (rx, ry, rz, seg = 44) => sphereGeo(seg).scale(rx, ry, rz);
const lin = (hex) => new THREE.Color(hex);

function skinMat(hex, rough = 0.55, sheen = 0.45) {
  return new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, sheen, sheenRoughness: 0.5, sheenColor: new THREE.Color(hex).lerp(new THREE.Color(0xffffff), 0.35) });
}
function plastic(hex, rough = 0.35, cc = 0.5) {
  return new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, clearcoat: cc, clearcoatRoughness: 0.2 });
}
function cloth(hex, rough = 0.85) {
  return new THREE.MeshPhysicalMaterial({ color: hex, roughness: rough, sheen: 0.6, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffffff) });
}

const irisTex = (inner, outer) => canvasTexture(128, 128, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
  g.addColorStop(0, inner); g.addColorStop(0.75, outer); g.addColorStop(1, '#140c08');
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.25; c.strokeStyle = '#ffd9a0';
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2; c.beginPath(); c.moveTo(w / 2 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18); c.lineTo(w / 2 + Math.cos(a) * 50, h / 2 + Math.sin(a) * 50); c.stroke(); }
});

const scleraMat = new THREE.MeshPhysicalMaterial({ color: 0xfbf7f2, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
const pupilMat = new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.1, clearcoat: 1 });
const catchMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3) });

// Eye with look control and upper / lower lids.
function makeEye(parent, pos, r, irisMap, lidMat, side) {
  const eye = group(parent, pos);
  eye.add(mesh(sphereGeo(36).scale(r, r, r), scleraMat, { cast: false }));
  const look = group(eye);
  const irisM = new THREE.MeshPhysicalMaterial({ map: irisMap, roughness: 0.2, clearcoat: 1 });
  const iris = mesh(sphereGeo(32).scale(r * 0.64, r * 0.64, r * 0.26), irisM, { cast: false });
  iris.position.z = r * 0.79; look.add(iris);
  const pupil = mesh(sphereGeo(24).scale(r * 0.34, r * 0.34, r * 0.2), pupilMat, { cast: false });
  pupil.position.z = r * 0.86; look.add(pupil);
  const c1 = mesh(sphereGeo(12).scale(r * 0.13, r * 0.13, r * 0.06), catchMat, { cast: false });
  c1.position.set(-r * 0.28 * side - r * 0.05, r * 0.34, r * 1.0); eye.add(c1);
  const c2 = mesh(sphereGeo(10).scale(r * 0.06, r * 0.06, r * 0.04), catchMat, { cast: false });
  c2.position.set(r * 0.2, -r * 0.22, r * 1.0); eye.add(c2);
  const lidU = group(eye);
  lidU.add(mesh(new THREE.SphereGeometry(r * 1.09, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, { cast: false }));
  const lidL = group(eye);
  lidL.add(mesh(new THREE.SphereGeometry(r * 1.075, 36, 18, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), lidMat, { cast: false }));
  return { eye, look, lidU, lidL, side, r };
}
function setEye(E, { open = 1, lower = 0, tilt = 0, lookX = 0, lookY = 0 }) {
  E.lidU.rotation.set(lerp(1.62, -0.95, clamp(open)), 0, tilt * E.side);
  E.lidL.rotation.set(lerp(0.75, -0.6, clamp(lower)), 0, -tilt * 0.4 * E.side);
  E.look.rotation.set(-lookY * 0.45, lookX * 0.55, 0);
}

// Mouth line: quadratic tube rebuilt when its shape changes.
class Mouth {
  constructor(parent, mat, w, radius, depth) {
    this.mat = mat; this.w = w; this.radius = radius; this.depth = depth;
    this.m = mesh(new THREE.BufferGeometry(), mat, { cast: false }); parent.add(this.m);
    this.key = '';
  }
  set(curve, open = 0, widen = 0) {
    const key = curve.toFixed(2) + open.toFixed(2) + widen.toFixed(2);
    if (key === this.key) return; this.key = key;
    const w = this.w * (1 + widen * 0.25);
    const a = new THREE.Vector3(-w, curve * this.w * 0.45, -this.depth);
    const b = new THREE.Vector3(w, curve * this.w * 0.45, -this.depth);
    const c = new THREE.Vector3(0, -curve * this.w * 0.75 - open * this.w * 0.2, this.depth * 0.6);
    this.m.geometry.dispose();
    this.m.geometry = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 24, this.radius, 8);
  }
}

// ---------------------------------------------------------------------------
// Shell fur
const FUR_SHELLS = 14;
function furMaterials({ root, tip, len, density, silver = false, comb = [0, -0.4, 0] }) {
  const base = new THREE.MeshStandardMaterial({ color: root, roughness: 0.9 });
  patch(base, { fColor: `diffuseColor.rgb *= 0.9 + 0.2 * vnoise(vOPos * 40.0);` });
  const shells = [];
  for (let k = 1; k <= FUR_SHELLS; k++) {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, transparent: true, depthWrite: false });
    patch(m, {
      uniforms: {
        uH: { value: k / FUR_SHELLS }, uLen: { value: len }, uDen: { value: density },
        uRoot: { value: lin(root) }, uTip: { value: lin(tip) }, uSilver: { value: silver ? 1 : 0 },
        uSilverCol: { value: lin(0x9d9ca6) }, uComb: { value: new THREE.Vector3(...comb) },
      },
      vHead: `uniform float uH; uniform float uLen; uniform vec3 uComb;`,
      vMain: `transformed += objectNormal * uLen * uH + uComb * uLen * uH * uH;`,
      fHead: `uniform float uH; uniform float uDen; uniform vec3 uRoot; uniform vec3 uTip; uniform float uSilver; uniform vec3 uSilverCol;`,
      fColor: `
        vec3 fp = vOPos * uDen;
        vec3 c1 = floor(fp); vec3 f1 = fract(fp) - 0.5; vec3 j1 = (hash33(c1) - 0.5) * 0.45;
        vec3 fp2 = fp + vec3(0.5, 0.31, 0.77); vec3 c2 = floor(fp2); vec3 f2 = fract(fp2) - 0.5; vec3 j2 = (hash33(c2 + 7.0) - 0.5) * 0.45;
        float r = 0.38 * (1.0 - uH * 0.6);
        float a = max(smoothstep(r, r * 0.2, length(f1 - j1)), smoothstep(r, r * 0.2, length(f2 - j2)));
        a *= 1.0 - uH * 0.55;
        // soft clumping
        a *= smoothstep(0.15, 0.45, vnoise(vOPos * uDen * 0.18) + 0.35 - uH * 0.25);
        // anti-shimmer: when strands get smaller than a pixel, fade to their average coverage
        float cellsPerPx = length(fwidth(fp));
        a = mix(a, 0.26 * pow(1.0 - uH, 1.5), smoothstep(1.1, 2.8, cellsPerPx) * 0.9);
        if (a < 0.06) discard;
        vec3 col = mix(uRoot, uTip, pow(uH, 0.8));
        float sil = uSilver * smoothstep(0.08, -0.22, vOPos.z) * smoothstep(-0.55, -0.1, vOPos.y) * (1.0 - smoothstep(0.35, 0.62, vOPos.y));
        col = mix(col, uSilverCol * mix(0.65, 1.15, uH), sil);
        col *= 0.9 + 0.2 * hash13(c1);
        diffuseColor = vec4(col, a);
      `,
    });
    shells.push(m);
  }
  return { base, shells };
}
function furMesh(geo, fm) {
  const m = mesh(geo, fm.base);
  fm.shells.forEach((sm, i) => {
    const s = new THREE.Mesh(geo, sm); s.renderOrder = 10 + i; s.castShadow = false; s.receiveShadow = true;
    m.add(s);
  });
  return m;
}

// ---------------------------------------------------------------------------
export class Gorilla {
  constructor() {
    const R = this.root = new THREE.Group();
    const body = this.body = group(R); // bob / squash container
    const furMain = furMaterials({ root: 0x141317, tip: 0x4a4954, len: 0.04, density: 88, silver: true, comb: [0, -0.3, 0] });
    const furLimb = furMaterials({ root: 0x141317, tip: 0x47464f, len: 0.036, density: 95, comb: [0, -0.35, 0] });
    const furHead = furMaterials({ root: 0x16151a, tip: 0x4d4c57, len: 0.032, density: 110, comb: [0, 0.1, -0.3] });
    const skin = this.skin = skinMat(0x4b4044, 0.5);
    const skinL = skinMat(0x62555a, 0.5);
    const skinD = skinMat(0x342d31, 0.55);
    const lipMat = skinMat(0x2a2224, 0.4);
    this.mats = { skin, skinL, skinD };

    // legs
    this.hips = group(body, [0, 0.8, 0]);
    this.hips.add(furMesh(ell(0.52, 0.32, 0.42), furMain));
    const leg = (s) => {
      const hip = group(this.hips, [0.29 * s, -0.04, 0]);
      hip.add(furMesh(limbGeo(0.21, 0.17, 0.32), furLimb));
      const knee = group(hip, [0, -0.34, 0]);
      knee.add(furMesh(limbGeo(0.175, 0.14, 0.27), furLimb));
      const ankle = group(knee, [0, -0.3, 0]);
      const foot = mesh(ell(0.15, 0.085, 0.25), skinD); foot.position.set(0.02 * s, -0.08, 0.08); ankle.add(foot);
      for (let i = 0; i < 4; i++) ankle.add(mesh(ell(0.04, 0.04, 0.05), skinD, { pos: [(-0.08 + i * 0.05) * 1 + 0.02 * s, -0.11, 0.3] }));
      return { hip, knee, ankle };
    };
    this.legL = leg(-1); this.legR = leg(1);

    // torso
    this.waist = group(body, [0, 0.86, 0]);
    const W = this.waist;
    { const _m = furMesh(ell(0.66, 0.7, 0.53), furMain); _m.position.set(0, 0.5, -0.04); W.add(_m); }
    { const _m = furMesh(ell(0.9, 0.42, 0.54), furMain); _m.position.set(0, 0.9, -0.07); W.add(_m); }
    { const _m = furMesh(ell(0.52, 0.46, 0.42), furLimb); _m.position.set(0, 0.3, 0.12); W.add(_m); }
    this.chest = group(W, [0, 0.8, 0.33]);
    { const plate = mesh(ell(0.46, 0.27, 0.16), skin); this.chest.add(plate);
      for (const s of [-1, 1]) { const pec = mesh(ell(0.22, 0.15, 0.1), skin); pec.position.set(0.19 * s, 0.03, 0.06); pec.rotation.z = -0.25 * s; this.chest.add(pec); } }
    // arms
    const arm = (s) => {
      const sh = group(W, [0.82 * s, 0.92, -0.03]);
      sh.add(furMesh(ell(0.27, 0.25, 0.27), furMain));
      sh.add(furMesh(limbGeo(0.215, 0.18, 0.52), furLimb));
      const el = group(sh, [0, -0.56, 0]);
      el.add(furMesh(limbGeo(0.19, 0.25, 0.48), furLimb));
      const hand = group(el, [0, -0.62, 0]);
      const fist = mesh(roundedBoxGeo(0.4, 0.33, 0.42, 0.13, 4), skinD); fist.position.set(0, -0.06, 0.02); hand.add(fist);
      for (let i = 0; i < 4; i++) hand.add(mesh(ell(0.058, 0.05, 0.06), skinD, { pos: [-0.13 + i * 0.087, -0.2, 0.16] }));
      const thumb = mesh(ell(0.06, 0.09, 0.06), skinD); thumb.position.set(-0.17 * s, -0.02, 0.15); hand.add(thumb);
      const grip = group(hand, [0, -0.12, 0.25]); // where props attach
      return { sh, el, hand, grip };
    };
    this.armL = arm(-1); this.armR = arm(1);
    // armbands (hidden until the finale)
    const bandMat = plastic(0xff7a1a, 0.3, 0.8);
    const bandStripe = plastic(0xffffff, 0.3, 0.8);
    this.armbands = [this.armL, this.armR].map((a) => {
      const g = group(a.sh, [0, -0.2, 0]);
      const t1 = mesh(new THREE.TorusGeometry(0.21, 0.07, 18, 36), bandMat); t1.rotation.x = Math.PI / 2; g.add(t1);
      const t2 = mesh(new THREE.TorusGeometry(0.215, 0.025, 10, 36), bandStripe); t2.rotation.x = Math.PI / 2; t2.position.y = 0.0; t2.scale.set(1.02, 1.02, 1.6); g.add(t2);
      const valve = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10), bandStripe); valve.position.set(0, 0, 0.27); valve.rotation.x = Math.PI / 2; g.add(valve);
      g.visible = false; g.scale.setScalar(0.001);
      return g;
    });

    // head
    this.neck = group(W, [0, 1.13, 0.16]);
    const H = this.head = group(this.neck);
    { const _m = furMesh(ell(0.32, 0.31, 0.31), furHead); _m.position.set(0, 0.2, -0.02); H.add(_m); }
    { const _m = furMesh(ell(0.2, 0.23, 0.25), furHead); _m.position.set(0, 0.36, -0.06); H.add(_m); }
    for (const s of [-1, 1]) { const _m = furMesh(ell(0.12, 0.14, 0.12), furHead); _m.position.set(0.24 * s, 0.08, 0.05); H.add(_m); }
    const face = mesh(ell(0.27, 0.255, 0.17), skin); face.position.set(0, 0.14, 0.2); H.add(face);
    const muzzle = this.muzzle = mesh(ell(0.215, 0.145, 0.155), skinL); muzzle.position.set(0, 0.01, 0.27); H.add(muzzle);
    const nose = mesh(ell(0.11, 0.07, 0.065), skin); nose.position.set(0, 0.085, 0.385); H.add(nose);
    for (const s of [-1, 1]) H.add(mesh(ell(0.028, 0.02, 0.02), lipMat, { pos: [0.042 * s, 0.065, 0.437], cast: false }));
    for (const s of [-1, 1]) H.add(mesh(ell(0.05, 0.07, 0.035), skin, { pos: [0.305 * s, 0.17, 0.03] }));
    // brows
    this.brows = [-1, 1].map((s) => {
      const b = group(H, [0.095 * s, 0.262, 0.345]);
      b.add(mesh(ell(0.12, 0.048, 0.07), skinD, { cast: false }));
      return { b, s };
    });
    // eyes
    const gIris = irisTex('#b9772f', '#5a3214');
    this.eyes = [-1, 1].map((s) => makeEye(H, [0.092 * s, 0.185, 0.33], 0.063, gIris, skin, s));
    // mouth
    this.mouthG = group(H, [0, -0.045, 0.405]);
    this.mouth = new Mouth(this.mouthG, lipMat, 0.105, 0.013, 0.04);
    this.cavity = mesh(ell(0.08, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x1a0d0e, roughness: 0.6 }), { cast: false });
    this.cavity.position.set(0, -0.012, -0.005); this.mouthG.add(this.cavity);
    this.tongue = mesh(ell(0.05, 0.02, 0.025), skinMat(0xd06a70, 0.4)); this.tongue.position.set(0, -0.035, 0.005); this.mouthG.add(this.tongue);
    this.lip = mesh(ell(0.095, 0.034, 0.045), skinL); this.lip.position.set(0, -0.032, -0.012); this.mouthG.add(this.lip);
    // hard hat
    const hatMat = plastic(0xff8a1c, 0.32, 0.7);
    this.hat = group(H, [0.02, 0.555, -0.01], [-0.12, 0, 0.13]);
    this.hat.add(mesh(new THREE.SphereGeometry(0.16, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.1), hatMat));
    this.hat.add(mesh(new THREE.CylinderGeometry(0.205, 0.21, 0.022, 40), hatMat, { pos: [0, 0.005, 0.02] }));
    this.hat.add(mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34).translate(0, 0.12, 0), hatMat));
    const badge = mesh(new THREE.CircleGeometry(0.035, 20), plastic(0xffe14a, 0.3, 0.5), { cast: false }); badge.position.set(0, 0.07, 0.17); badge.rotation.x = -0.35; this.hat.add(badge);

    this.R = this.root;
    this.setPose({});
    this.setFace({});
  }

  // Pose: joint angles in radians. Missing values default to a relaxed stance.
  setPose(p) {
    const d = (k, v) => (p[k] !== undefined ? p[k] : v);
    this.body.position.y = d('bob', 0);
    this.body.scale.set(1 + d('squash', 0) * 0.5, 1 - d('squash', 0), 1 + d('squash', 0) * 0.5);
    this.waist.rotation.set(d('lean', 0.08), d('twist', 0), d('roll', 0));
    this.hips.rotation.set(d('hipPitch', 0), 0, 0);
    this.neck.rotation.set(d('headPitch', 0.05), d('headYaw', 0), d('headRoll', 0));
    this.waist.scale.setScalar(1 + d('breath', 0) * 0.04);
    const armSet = (A, s, pre) => {
      A.sh.rotation.set(d(pre + 'Pitch', 0.05), d(pre + 'Yaw', 0), d(pre + 'Roll', 0.22) * s);
      A.el.rotation.set(d(pre + 'Elbow', -0.15), 0, 0);
      A.hand.rotation.set(d(pre + 'Wrist', 0), 0, 0);
    };
    armSet(this.armL, -1, 'l'); armSet(this.armR, 1, 'r');
    const legSet = (L, s, pre) => {
      L.hip.rotation.set(d(pre + 'Hip', 0), 0, d(pre + 'HipRoll', 0.05) * s);
      L.knee.rotation.set(d(pre + 'Knee', 0), 0, 0);
      L.ankle.rotation.set(d(pre + 'Ankle', 0), 0, 0);
    };
    legSet(this.legL, -1, 'lL'); legSet(this.legR, 1, 'rL');
  }

  // brow: -1 angry .. +1 raised; mouth: -1 frown .. +1 smile; open 0..1; squint 0..1; blink 0..1
  setFace({ brow = -0.6, mouth = -0.5, open = 0, squint = 0, blink = 0, lookX = 0, lookY = 0, pout = 0.5, wide = 0 }) {
    const happy = Math.max(0, mouth);
    for (const { b, s } of this.brows) {
      b.rotation.z = -s * Math.min(0, brow) * 0.42 + s * happy * 0.12;
      b.position.y = 0.262 + Math.max(0, brow) * 0.035 + wide * 0.02 - squint * 0.012 * (1 - happy);
    }
    const opn = clamp((1 - blink) * (0.82 - squint * 0.55 * (1 - happy) + wide * 0.18 + Math.max(0, brow) * 0.1));
    for (const E of this.eyes) setEye(E, { open: opn, lower: squint * 0.7 + happy * 0.45, tilt: Math.max(0, -brow) * 0.42, lookX, lookY });
    this.mouth.set(mouth, open, Math.max(0, mouth));
    this.cavity.scale.set(1 + mouth * 0.2, Math.max(0.001, open), 1);
    this.cavity.visible = open > 0.02; this.tongue.visible = open > 0.3;
    this.tongue.scale.setScalar(Math.max(0.01, open));
    this.lip.position.z = -0.012 + pout * 0.03;
    this.lip.visible = pout > 0.05 && open < 0.4;
  }
}

// ---------------------------------------------------------------------------
export class Kid {
  constructor() {
    const R = this.root = new THREE.Group();
    const body = this.body = group(R);
    const skin = this.skin = skinMat(0xc98a62, 0.5, 0.4);
    const skinWet = skinMat(0xc98a62, 0.22, 0.4); skinWet.clearcoat = 0.6;
    this.skinWet = skinWet;
    const hairMat = this.hairMat = new THREE.MeshPhysicalMaterial({ color: 0x3a2416, roughness: 0.55, sheen: 0.8, sheenColor: new THREE.Color(0x9a6a40), sheenRoughness: 0.4 });
    const hairWetMat = new THREE.MeshPhysicalMaterial({ color: 0x24160d, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 });
    const stripe = patch(cloth(0xffffff), {
      fColor: `float st = step(0.5, fract(vOPos.y / 0.075)); diffuseColor.rgb = mix(vec3(0.82, 0.16, 0.12), vec3(0.95, 0.9, 0.8), st);`,
    });
    const shorts = cloth(0x3d5f8f, 0.8);
    const swim = patch(cloth(0x13a89e, 0.6), {
      fColor: `vec2 q = vec2(atan(vOPos.x, vOPos.z) * 0.25, vOPos.y) * 18.0; vec4 v = voronoi2(q); float dots = smoothstep(0.32, 0.24, v.x) * step(v.y, 0.55);
               diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.82, 0.2), dots);`,
    });
    const shoe = plastic(0xf5f5f5, 0.5, 0.2), sole = plastic(0xe2473a, 0.5, 0.2);
    this.mats = { skin, skinWet, stripe, swim };

    // legs
    this.hips = group(body, [0, 0.6, 0]);
    const leg = (s) => {
      const hip = group(this.hips, [0.088 * s, 0, 0]);
      const thigh = mesh(limbGeo(0.058, 0.052, 0.27), skin); hip.add(thigh);
      const cuff = mesh(limbGeo(0.085, 0.078, 0.1), shorts); cuff.position.y = -0.01; hip.add(cuff);
      const cuffS = mesh(limbGeo(0.087, 0.08, 0.08), swim); cuffS.position.y = -0.01; hip.add(cuffS); cuffS.visible = false;
      const knee = group(hip, [0, -0.28, 0]);
      knee.add(mesh(limbGeo(0.052, 0.045, 0.25), skin));
      const ankle = group(knee, [0, -0.27, 0]);
      const sh = mesh(roundedBoxGeo(0.12, 0.08, 0.21, 0.04, 3), shoe); sh.position.set(0, -0.025, 0.04); ankle.add(sh);
      const so = mesh(roundedBoxGeo(0.125, 0.025, 0.215, 0.012, 2), sole); so.position.set(0, -0.06, 0.04); ankle.add(so);
      return { hip, knee, ankle, thigh, cuff, cuffS, shoe: sh, sole: so };
    };
    this.legL = leg(-1); this.legR = leg(1);
    // torso
    this.waist = group(body, [0, 0.6, 0]);
    const prof = [[0.0, -0.06], [0.155, -0.05], [0.168, 0.05], [0.172, 0.22], [0.16, 0.33], [0.11, 0.4], [0.05, 0.43], [0.0, 0.435]].map(([r, y]) => new THREE.Vector2(r, y));
    const torsoGeo = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(30), 40);
    this.shirt = mesh(torsoGeo, stripe); this.waist.add(this.shirt);
    this.bare = mesh(torsoGeo.clone().scale(0.97, 1, 0.97), skin); this.waist.add(this.bare); this.bare.visible = false;
    this.shortsM = mesh(new THREE.CylinderGeometry(0.163, 0.172, 0.16, 32), shorts, { pos: [0, 0.0, 0] }); this.waist.add(this.shortsM);
    this.swimM = mesh(new THREE.CylinderGeometry(0.165, 0.175, 0.15, 32), swim, { pos: [0, -0.005, 0] }); this.waist.add(this.swimM); this.swimM.visible = false;
    const waistBand = mesh(new THREE.TorusGeometry(0.166, 0.012, 8, 32), plastic(0xffd23a, 0.5, 0.2)); waistBand.rotation.x = Math.PI / 2; waistBand.position.y = 0.07; this.swimM.add(waistBand);
    // arms
    const arm = (s) => {
      const sh = group(this.waist, [0.165 * s, 0.31, 0]);
      const sleeve = mesh(limbGeo(0.066, 0.06, 0.1), stripe); sh.add(sleeve);
      const shoulderSkin = mesh(sphereGeo(20).scale(0.056, 0.056, 0.056), skin); shoulderSkin.visible = false; sh.add(shoulderSkin);
      sh.add(mesh(limbGeo(0.045, 0.041, 0.18), skin));
      const el = group(sh, [0, -0.2, 0]);
      el.add(mesh(limbGeo(0.041, 0.037, 0.16), skin));
      const hand = group(el, [0, -0.18, 0]);
      hand.add(mesh(ell(0.048, 0.056, 0.042), skin, { pos: [0, -0.03, 0] }));
      hand.add(mesh(ell(0.02, 0.03, 0.02), skin, { pos: [0.035 * -s, -0.01, 0.03] }));
      const grip = group(hand, [0, -0.05, 0.03]);
      return { sh, el, hand, grip, sleeve, shoulderSkin };
    };
    this.armL = arm(-1); this.armR = arm(1);
    // head
    this.neck = group(this.waist, [0, 0.42, 0]);
    this.neck.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 16), skin, { pos: [0, 0.02, 0] }));
    const H = this.head = group(this.neck, [0, 0.03, 0]);
    H.add(mesh(ell(0.205, 0.215, 0.2), skin, { pos: [0, 0.19, 0] }));
    H.add(mesh(ell(0.13, 0.08, 0.1), skin, { pos: [0, 0.06, 0.08] })); // chin/cheeks volume
    for (const s of [-1, 1]) {
      H.add(mesh(ell(0.035, 0.052, 0.03), skin, { pos: [0.205 * s, 0.18, -0.005] }));
      H.add(mesh(ell(0.042, 0.026, 0.02), new THREE.MeshStandardMaterial({ color: 0xe07a6a, roughness: 0.7, transparent: true, opacity: 0.55 }), { pos: [0.115 * s, 0.115, 0.165], rot: [0, 0.5 * s, 0], cast: false }));
    }
    H.add(mesh(ell(0.026, 0.022, 0.024), skin, { pos: [0, 0.145, 0.205] }));
    // freckles
    const frk = new THREE.MeshStandardMaterial({ color: 0x8a5236, roughness: 0.8 });
    for (const [x, y] of [[-0.05, 0.155], [-0.035, 0.14], [-0.065, 0.135], [0.05, 0.155], [0.035, 0.14], [0.065, 0.135]]) H.add(mesh(ell(0.006, 0.006, 0.004), frk, { pos: [x, y, 0.198 - Math.abs(x) * 0.25], cast: false }));
    const kIris = irisTex('#8a5a2b', '#3b2210');
    this.eyes = [-1, 1].map((s) => makeEye(H, [0.074 * s, 0.205, 0.158], 0.055, kIris, skin, s));
    this.brows = [-1, 1].map((s) => { const b = group(H, [0.075 * s, 0.285, 0.18]); b.add(mesh(ell(0.042, 0.012, 0.014), hairMat, { cast: false })); return { b, s }; });
    this.mouthG = group(H, [0, 0.083, 0.19]);
    this.mouth = new Mouth(this.mouthG, skinMat(0x8a3b35, 0.5), 0.045, 0.008, 0.015);
    this.cavity = mesh(ell(0.04, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: 0x3a0f12, roughness: 0.6 }), { cast: false }); this.cavity.position.set(0, -0.012, -0.002); this.mouthG.add(this.cavity);
    this.tongue = mesh(ell(0.025, 0.012, 0.012), skinMat(0xe57a7a, 0.4), { cast: false }); this.tongue.position.set(0, -0.03, 0.004); this.mouthG.add(this.tongue);
    // hair (dry messy + wet flat)
    const rnd = mulberry32(77);
    this.hairDry = group(H);
    this.hairDry.add(mesh(ell(0.218, 0.17, 0.222), hairMat, { pos: [0, 0.255, -0.022] }));
    const tuftGeo = new THREE.SphereGeometry(1, 14, 10).scale(0.042, 0.085, 0.042).translate(0, 0.06, 0);
    { const tp = tuftGeo.attributes.position; for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); const k = 1 - Math.max(0, (y - 0.06) / 0.085) * 0.75; tp.setX(i, tp.getX(i) * k); tp.setZ(i, tp.getZ(i) * k); } tuftGeo.computeVertexNormals(); }
    for (let i = 0; i < 34; i++) {
      const th = rnd() * Math.PI * 2; const ph = 0.15 + rnd() * 1.05;
      const dir = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
      if (dir.z > 0.55 && dir.y < 0.75) dir.z *= 0.6;
      const tf = mesh(tuftGeo, hairMat, { cast: true });
      const c = new THREE.Vector3(dir.x * 0.2, 0.255 + dir.y * 0.155, -0.022 + dir.z * 0.2);
      tf.position.copy(c);
      const tilt = dir.clone().add(new THREE.Vector3((rnd() - 0.5) * 0.9, 0.25, (rnd() - 0.5) * 0.6 - 0.15)).normalize();
      tf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tilt);
      tf.scale.setScalar(0.7 + rnd() * 0.6);
      this.hairDry.add(tf);
    }
    for (let i = 0; i < 6; i++) { // bangs
      const tf = mesh(tuftGeo, hairMat);
      tf.position.set(-0.11 + i * 0.045, 0.33, 0.15);
      tf.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3((i - 2.5) * 0.25, -0.35, 1).normalize());
      tf.scale.set(0.8, 0.8 + (i % 2) * 0.25, 0.8); this.hairDry.add(tf);
    }
    this.hairWet = group(H); this.hairWet.visible = false;
    this.hairWet.add(mesh(ell(0.215, 0.135, 0.222), hairWetMat, { pos: [0, 0.26, -0.02] }));
    const strand = new THREE.ConeGeometry(0.03, 0.15, 8).translate(0, -0.075, 0);
    for (let i = 0; i < 9; i++) {
      const s = mesh(strand, hairWetMat);
      s.position.set(-0.13 + i * 0.033, 0.34, 0.16 - Math.abs(i - 4) * 0.012);
      s.rotation.set(-0.35, 0, (i - 4) * 0.05);
      this.hairWet.add(s);
    }
    // goggles (on forehead)
    this.goggles = group(H, [0, 0.33, 0.02]); this.goggles.visible = false;
    const strapM = plastic(0x1d3b8c, 0.5, 0.2);
    this.goggles.add(mesh(new THREE.TorusGeometry(0.215, 0.014, 8, 48), strapM, { rot: [Math.PI / 2 - 0.25, 0, 0], scale: [1, 1.03, 1] }));
    for (const s of [-1, 1]) {
      const lens = mesh(new THREE.SphereGeometry(0.05, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x5fd0ff, roughness: 0.05, clearcoat: 1, emissive: 0x0a3a60, emissiveIntensity: 0.4 }));
      lens.rotation.x = Math.PI / 2 - 0.25; lens.position.set(0.065 * s, 0.0, 0.2); this.goggles.add(lens);
      const rim = mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 24), plastic(0xffd23a, 0.4, 0.5)); rim.rotation.x = -0.25; rim.position.set(0.065 * s, 0.0, 0.198); this.goggles.add(rim);
    }
    this.setPose({}); this.setFace({});
  }

  setOutfit(swim, wet) {
    this.shirt.visible = !swim; this.bare.visible = swim;
    this.shortsM.visible = !swim; this.swimM.visible = swim;
    this.legL.cuff.visible = !swim; this.legR.cuff.visible = !swim;
    this.legL.cuffS.visible = swim; this.legR.cuffS.visible = swim;
    for (const a of [this.armL, this.armR]) { a.sleeve.visible = !swim; a.shoulderSkin.visible = swim; }
    for (const L of [this.legL, this.legR]) { L.shoe.visible = !swim; L.sole.visible = !swim; }
    this.goggles.visible = swim;
    this.hairDry.visible = !wet; this.hairWet.visible = wet;
    const sk = wet ? this.skinWet : this.skin;
    this.bare.material = sk;
  }

  setPose(p) {
    const d = (k, v) => (p[k] !== undefined ? p[k] : v);
    this.body.position.y = d('bob', 0);
    this.body.scale.set(1 + d('squash', 0) * 0.5, 1 - d('squash', 0), 1 + d('squash', 0) * 0.5);
    this.waist.rotation.set(d('lean', 0), d('twist', 0), d('roll', 0));
    this.neck.rotation.set(d('headPitch', 0), d('headYaw', 0), d('headRoll', 0));
    const armSet = (A, s, pre) => {
      A.sh.rotation.set(d(pre + 'Pitch', 0), d(pre + 'Yaw', 0), d(pre + 'Roll', 0.12) * s);
      A.el.rotation.set(d(pre + 'Elbow', -0.1), 0, 0);
      A.hand.rotation.set(d(pre + 'Wrist', 0), 0, 0);
    };
    armSet(this.armL, -1, 'l'); armSet(this.armR, 1, 'r');
    const legSet = (L, s, pre) => {
      L.hip.rotation.set(d(pre + 'Hip', 0), 0, d(pre + 'HipRoll', 0.02) * s);
      L.knee.rotation.set(d(pre + 'Knee', 0), 0, 0);
      L.ankle.rotation.set(d(pre + 'Ankle', 0), 0, 0);
    };
    legSet(this.legL, -1, 'lL'); legSet(this.legR, 1, 'rL');
  }

  setFace({ brow = 0.1, mouth = 0.4, open = 0, squint = 0, blink = 0, lookX = 0, lookY = 0, wide = 0 }) {
    for (const { b, s } of this.brows) {
      b.rotation.z = -s * Math.min(0, brow) * 0.35 + s * Math.max(0, mouth) * 0.08;
      b.position.y = 0.285 + brow * 0.02 + wide * 0.015;
    }
    const opn = clamp((1 - blink) * (0.9 - squint * 0.6 + wide * 0.1));
    for (const E of this.eyes) setEye(E, { open: opn, lower: squint * 0.6 + Math.max(0, mouth) * 0.2, tilt: Math.max(0, -brow) * 0.3, lookX, lookY });
    this.mouth.set(mouth, open, 0);
    this.cavity.scale.set(1 + Math.max(0, mouth) * 0.3, Math.max(0.001, open), 1);
    this.cavity.visible = open > 0.02; this.tongue.visible = open > 0.35;
  }
}

// ---------------------------------------------------------------------------
export class Neighbor {
  constructor() {
    const R = this.root = new THREE.Group();
    const skin = skinMat(0xe3b08f, 0.55, 0.4);
    const robe = patch(cloth(0x86b6dc, 0.95), { fColor: `diffuseColor.rgb *= 0.85 + 0.25 * vnoise(vOPos * 90.0);` });
    const robeTrim = cloth(0xf4f1ea, 0.95);
    const hair = new THREE.MeshStandardMaterial({ color: 0xc9c5bd, roughness: 0.8 });
    const body = this.body = group(R);
    // simple legs / pyjama trousers (mostly hidden behind the fence)
    const pj = cloth(0x445a7a);
    for (const s of [-1, 1]) body.add(mesh(limbGeo(0.08, 0.07, 0.75), pj, { pos: [0.1 * s, 0.85, 0] }));
    const prof = [[0.0, 0.0], [0.24, 0.02], [0.27, 0.25], [0.26, 0.45], [0.2, 0.62], [0.08, 0.68], [0.0, 0.69]].map(([r, y]) => new THREE.Vector2(r, y));
    this.torso = group(body, [0, 0.85, 0]);
    this.torso.add(mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(30), 40), robe));
    const collar = mesh(new THREE.TorusGeometry(0.12, 0.04, 10, 30), robeTrim); collar.position.set(0, 0.62, 0.04); collar.rotation.x = Math.PI / 2 - 0.4; collar.scale.set(1.1, 1, 0.8); this.torso.add(collar);
    const vneck = mesh(ell(0.07, 0.12, 0.03), skin); vneck.position.set(0, 0.55, 0.205); vneck.rotation.x = -0.25; this.torso.add(vneck);
    const belt = mesh(new THREE.TorusGeometry(0.265, 0.025, 8, 40), robeTrim); belt.rotation.x = Math.PI / 2; belt.position.y = 0.25; this.torso.add(belt);
    const knot = mesh(ell(0.05, 0.035, 0.03), robeTrim); knot.position.set(0.05, 0.25, 0.27); this.torso.add(knot);
    const arm = (s) => {
      const sh = group(this.torso, [0.24 * s, 0.56, 0]);
      sh.add(mesh(limbGeo(0.085, 0.08, 0.26), robe));
      const el = group(sh, [0, -0.28, 0]);
      el.add(mesh(limbGeo(0.08, 0.095, 0.2), robe));
      el.add(mesh(new THREE.TorusGeometry(0.085, 0.025, 8, 24), robeTrim, { pos: [0, -0.22, 0], rot: [Math.PI / 2, 0, 0] }));
      const hand = group(el, [0, -0.27, 0]);
      hand.add(mesh(ell(0.05, 0.06, 0.045), skin));
      return { sh, el, hand };
    };
    this.armL = arm(-1); this.armR = arm(1);
    // mug
    const mugMat = plastic(0xfaf7f0, 0.3, 0.6);
    this.mug = group(this.armR.hand, [0, -0.02, 0.06]);
    this.mug.add(mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.12, 24), mugMat));
    this.mug.add(mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.025, 24), plastic(0xd8433a, 0.4, 0.5), { pos: [0, 0.02, 0] }));
    this.mug.add(mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16, Math.PI), mugMat, { pos: [0.055, 0, 0], rot: [0, 0, -Math.PI / 2] }));
    this.mug.add(mesh(new THREE.CircleGeometry(0.048, 20), new THREE.MeshStandardMaterial({ color: 0x3b2112, roughness: 0.2 }), { pos: [0, 0.05, 0], rot: [-Math.PI / 2, 0, 0], cast: false }));
    // head
    this.neck = group(this.torso, [0, 0.66, 0.0]);
    const H = this.head = group(this.neck);
    H.add(mesh(ell(0.17, 0.185, 0.17), skin, { pos: [0, 0.17, 0] }));
    H.add(mesh(ell(0.12, 0.07, 0.09), skin, { pos: [0, 0.06, 0.06] }));
    for (const s of [-1, 1]) H.add(mesh(ell(0.032, 0.045, 0.025), skin, { pos: [0.172 * s, 0.16, 0] }));
    const ring = mesh(new THREE.TorusGeometry(0.155, 0.045, 12, 40, Math.PI * 1.25), hair); ring.rotation.set(Math.PI / 2 + 0.2, 0, Math.PI * 0.875 - Math.PI / 2 + Math.PI * 0.25 + Math.PI); ring.position.set(0, 0.2, -0.02); H.add(ring);
    H.add(mesh(ell(0.03, 0.03, 0.03), skin, { pos: [0, 0.13, 0.18] })); // nose
    H.add(mesh(ell(0.045, 0.04, 0.04), skin, { pos: [0, 0.12, 0.175] }));
    this.mustache = [-1, 1].map((s) => mesh(ell(0.052, 0.022, 0.025), hair, { pos: [0.04 * s, 0.083, 0.17], rot: [0, 0, 0.25 * s] }));
    this.mustache.forEach((m) => H.add(m));
    this.eyes = [-1, 1].map((s) => makeEye(H, [0.062 * s, 0.19, 0.13], 0.046, irisTex('#6a8fb0', '#2b4258'), skin, s));
    this.brows = [-1, 1].map((s) => { const b = group(H, [0.065 * s, 0.255, 0.155]); b.add(mesh(ell(0.04, 0.016, 0.018), hair, { cast: false })); return { b, s }; });
    this.mouthG = group(H, [0, 0.055, 0.16]);
    this.mouth = new Mouth(this.mouthG, skinMat(0x8a4a42, 0.5), 0.035, 0.007, 0.012);
    this.cavity = mesh(ell(0.03, 0.035, 0.02), new THREE.MeshStandardMaterial({ color: 0x2a0c0c, roughness: 0.6 }), { cast: false }); this.mouthG.add(this.cavity);
    this.setPose({}); this.setFace({});
  }
  setPose(p) {
    const d = (k, v) => (p[k] !== undefined ? p[k] : v);
    this.torso.rotation.set(d('lean', 0), d('twist', 0), 0);
    this.neck.rotation.set(d('headPitch', 0), d('headYaw', 0), d('headRoll', 0));
    this.armR.sh.rotation.set(d('rPitch', -0.5), 0, d('rRoll', 0.25));
    this.armR.el.rotation.set(d('rElbow', -1.6), 0, 0);
    this.armR.hand.rotation.set(d('rWrist', 0.4), 0, 0);
    this.armL.sh.rotation.set(d('lPitch', 0.0), 0, d('lRoll', -0.15));
    this.armL.el.rotation.set(d('lElbow', -0.3), 0, 0);
  }
  setFace({ brow = 0.1, mouth = 0.3, open = 0, blink = 0, wide = 0, lookX = 0, lookY = 0, squint = 0 }) {
    for (const { b, s } of this.brows) { b.rotation.z = brow * 0.3 * -s; b.position.y = 0.255 + Math.max(0, brow) * 0.03 + wide * 0.02; }
    const opn = clamp((1 - blink) * (0.75 + wide * 0.25 - squint * 0.5));
    for (const E of this.eyes) setEye(E, { open: opn, lower: squint * 0.5, tilt: 0, lookX, lookY });
    this.mouth.set(mouth, open, 0);
    this.cavity.scale.set(1, Math.max(0.001, open), 1); this.cavity.visible = open > 0.02;
    this.mustache.forEach((m, i) => { m.rotation.z = (0.25 + open * 0.3 - mouth * 0.1) * (i ? 1 : -1); });
  }
}
