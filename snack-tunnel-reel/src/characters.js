// Toy-like characters: the kid, Mom and the dog (round heads, big friendly eyes,
// soft PBR materials, the same design in every scene) and all their acting.
// Each one is a small rig of groups; update(t) poses it as a pure function of t.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as KITCHEN from './kitchen.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const sph = (r, ws = 28, hs = 20, ...rest) => new THREE.SphereGeometry(r, ws, hs, ...rest);
const cap = (r, l, cs = 6, rs = 16) => new THREE.CapsuleGeometry(r, l, cs, rs);
// point on a sphere of radius R from yaw / pitch (radians), front = +z
const onSph = (R, yaw, pitch) => V(R * Math.sin(yaw) * Math.cos(pitch), R * Math.sin(pitch), R * Math.cos(yaw) * Math.cos(pitch));
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// ---------------------------------------------------------------------------
// materials: soft vinyl-toy skin, fabrics with object-space detail (so patterns
// stick to the moving characters), glossy eyes with highlights
// ---------------------------------------------------------------------------
const NOISE = /* glsl */ `
float chh(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float chn(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(chh(i),chh(i+vec3(1,0,0)),u.x), mix(chh(i+vec3(0,1,0)),chh(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(chh(i+vec3(0,0,1)),chh(i+vec3(1,0,1)),u.x), mix(chh(i+vec3(0,1,1)),chh(i+vec3(1,1,1)),u.x),u.y), u.z); }
`;
let pid = 0;
function objPatch(mat, { colorFn = '', bumpFn = '', bump = 1, extra = '', key = '' }) {
  const id = key || `char${pid++}`;
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vOPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvOPos = position;');
    let fs = sh.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vOPos;\n${NOISE}\n${extra}`);
    if (colorFn) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= ${colorFn}(vOPos);`);
    if (bumpFn) {
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { float hh = ${bumpFn}(vOPos); vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx); float det = dot(dpx, r1);
          vec3 g = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          normal = normalize(abs(det) * normal - g * ${bump.toFixed(3)}); }`);
    }
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}
const col = (hex) => new THREE.Color(hex);
const std = (hex, rough = 0.55, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });

function makeMats(envMap) {
  const skin = (hex, key) => objPatch(std(hex, 0.5), {
    colorFn: 'skinC', key,
    extra: 'vec3 skinC(vec3 p){ return vec3(0.96 + 0.08 * chn(p * 18.0)); }',
  });
  // soft cotton: fine weave bump and a gentle tone variation (+ an optional print)
  const cotton = (hex, key, pattern = '') => objPatch(std(hex, 0.82), {
    colorFn: 'cotC', bumpFn: 'cotB', bump: 1, key,
    extra: `vec3 cotC(vec3 p){
        vec3 c = vec3(0.92 + 0.12 * chn(p * 9.0));
        ${pattern}
        return c; }
      float cotB(vec3 p){ return 0.0012 * chn(p * 160.0) + 0.0006 * sin(p.y * 420.0 + chn(p * 30.0) * 3.0); }`,
  });
  // fluffy terry cloth (Mom's robe, slippers)
  const fluffy = (hex, key) => objPatch(std(hex, 0.95), {
    colorFn: 'flC', bumpFn: 'flB', bump: 1, key,
    extra: `vec3 flC(vec3 p){ return vec3(0.88 + 0.16 * chn(p * 60.0)) * (0.94 + 0.1 * chn(p * 7.0)); }
      float flB(vec3 p){ return 0.0035 * chn(p * 95.0) + 0.002 * chn(p * 210.0); }`,
  });
  // short fur: soft fuzz
  const fur = (hex, key) => objPatch(std(hex, 0.78), {
    colorFn: 'furC', bumpFn: 'furB', bump: 1, key,
    extra: `vec3 furC(vec3 p){ return vec3(0.9 + 0.15 * chn(p * 40.0)) * (0.95 + 0.08 * chn(p * 6.0)); }
      float furB(vec3 p){ return 0.0025 * chn(p * 130.0); }`,
  });
  // pyjama print: little soft yellow dots-stars (big enough not to sparkle in the wide shots)
  const stars = `{
      vec3 q = p * 15.0; vec3 i = floor(q); vec3 f = fract(q) - 0.5;
      float h = chh(i);
      float d = length(f + vec3(h - 0.5, chh(i + 7.0) - 0.5, chh(i + 3.0) - 0.5) * 0.3);
      float star = (1.0 - smoothstep(0.16, 0.24, d)) * step(0.6, h);
      c = mix(c, vec3(2.0, 1.7, 0.6), star * 0.75);
    }`;
  return {
    kidSkin: skin('#f0b78f', 'kskin'),
    momSkin: skin('#dca07a', 'mskin'),
    blush: new THREE.MeshStandardMaterial({ color: col('#ff8e8e'), roughness: 0.6, transparent: true, opacity: 0.5, depthWrite: false }),
    pyjama: cotton('#4f7fd0', 'pyj', stars),
    pyjamaDark: cotton('#3c64ad', 'pyj2'),
    kidHair: objPatch(std('#4a2c1a', 0.6), {
      colorFn: 'hairC', bumpFn: 'hairB', bump: 1, key: 'khair',
      extra: 'vec3 hairC(vec3 p){ return vec3(0.85 + 0.25 * chn(vec3(p.x * 70.0, p.y * 9.0, p.z * 70.0))); } float hairB(vec3 p){ return 0.002 * chn(vec3(p.x * 90.0, p.y * 12.0, p.z * 90.0)); }',
    }),
    momHair: objPatch(std('#6b3326', 0.55), {
      colorFn: 'mhairC', bumpFn: 'mhairB', bump: 1, key: 'mhair',
      extra: 'vec3 mhairC(vec3 p){ return vec3(0.85 + 0.25 * chn(vec3(p.x * 60.0, p.y * 8.0, p.z * 60.0))); } float mhairB(vec3 p){ return 0.002 * chn(vec3(p.x * 80.0, p.y * 10.0, p.z * 80.0)); }',
    }),
    shoe: std('#e8e4dc', 0.6),
    sole: std('#9aa3b0', 0.7),
    robe: fluffy('#f3a6c3', 'robe'),
    robeLight: fluffy('#fbd2e1', 'robe2'),
    slipper: fluffy('#fff2f6', 'slip'),
    eyeWhite: std('#fbfbf7', 0.18),
    irisKid: std('#6b4128', 0.25),
    irisMom: std('#4f6b3a', 0.25),
    irisDog: std('#3b2416', 0.2),
    pupil: std('#0b0a0a', 0.15),
    hl: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2 }),
    hlMom: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.2 }),
    brow: std('#3a2216', 0.7),
    browMom: std('#4a2418', 0.7),
    mouth: std('#6e2a26', 0.5),
    mouthIn: std('#4a1714', 0.6),
    tongue: std('#e0707a', 0.5),
    teeth: std('#fffdf6', 0.3),
    lash: std('#1a1210', 0.6),
    dogFur: fur('#d49a58', 'dogfur'),
    dogCream: fur('#f5e3c8', 'dogcream'),
    dogEar: fur('#93592f', 'dogear'),
    dogNose: std('#1b1515', 0.25),
    collar: std('#d33a33', 0.45),
    tag: std('#e8bc4c', 0.3, 0.9, { envMap, envMapIntensity: 1.2 }),
    wood: objPatch(std('#a8743f', 0.6), {
      colorFn: 'woodC', key: 'shwood',
      extra: 'vec3 woodC(vec3 p){ return vec3(0.82 + 0.3 * chn(vec3(p.x * 40.0, p.y * 2.0, p.z * 40.0))); }',
    }),
    metal: std('#a9b0b8', 0.32, 0.85, { envMap, envMapIntensity: 1.0 }),
    spoon: std('#d9dde2', 0.18, 1.0, { envMap, envMapIntensity: 1.3 }),
    yellow: std('#f2c230', 0.45),
    grip: std('#2b2b2e', 0.7),
    lampBody: std('#2d3f63', 0.45),
    lampBand: std('#e05b43', 0.7),
    lens: new THREE.MeshStandardMaterial({ color: col('#fff1d0'), emissive: col('#ffd89a'), emissiveIntensity: 0.0, roughness: 0.15 }),
    cutterDisc: new THREE.MeshStandardMaterial({ color: col('#c9ccd2'), emissive: col('#ff8a2a'), emissiveIntensity: 0.0, roughness: 0.3, metalness: 0.7 }),
    sweat: new THREE.MeshStandardMaterial({ color: col('#bfe6ff'), roughness: 0.05, transparent: true, opacity: 0.85, envMap, envMapIntensity: 1.5 }),
    zzz: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.9, 1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    qmark: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.25, 0.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    bagFoil: std('#f0a82c', 0.35, 0.3),
    bagStripe: std('#d2382d', 0.45),
    chip: std('#f2c46a', 0.6),
    glass: new THREE.MeshStandardMaterial({ color: col('#dfeef5'), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, envMap, envMapIntensity: 1.4, depthWrite: false }),
    cookie: std('#c98a4a', 0.75),
    lid: std('#c94b3c', 0.5),
    puff: new THREE.MeshStandardMaterial({ color: col('#d8d2c8'), roughness: 1, transparent: true, opacity: 0, depthWrite: false }),
  };
}

// ---------------------------------------------------------------------------
// shared pieces
// ---------------------------------------------------------------------------
function mesh(g, m, cast = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = true;
  o.userData.cast = cast;
  return o;
}
// capsule between two points (in the parent's space)
function limb(a, b, r, m, cast = true) {
  const d = b.clone().sub(a);
  const g = cap(r, Math.max(0.001, d.length()));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize()));
  const o = mesh(g, m, cast);
  o.position.copy(a).add(b).multiplyScalar(0.5);
  return o;
}
// thin tube along points
const tube = (pts, r, m) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, r, 8, false), m, false);

// a big friendly eye: glossy white, iris, pupil, two highlights, upper + lower lids
function makeEye(r, irisMat, lidMat, M, hlMat) {
  const g = new THREE.Group();
  g.add(mesh(sph(r, 24, 18), M.eyeWhite, false));
  const look = new THREE.Group(); // gaze: iris + pupil + highlights turn together
  const iris = mesh(sph(r * 0.66, 22, 16), irisMat, false);
  iris.scale.z = 0.42;
  iris.position.z = r * 0.79;
  const pupil = mesh(sph(r * 0.42, 18, 12), M.pupil, false);
  pupil.scale.z = 0.4;
  pupil.position.z = r * 0.86;
  const h1 = mesh(sph(r * 0.17, 12, 8), hlMat, false);
  h1.position.set(-r * 0.27, r * 0.3, r * 1.0);
  const h2 = mesh(sph(r * 0.085, 10, 6), hlMat, false);
  h2.position.set(r * 0.24, -r * 0.2, r * 1.0);
  look.add(iris, pupil, h1, h2);
  g.add(look);
  // lids: hemisphere caps in skin colour that swing over the front
  const lid = mesh(sph(r * 1.07, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat, false);
  const lower = mesh(sph(r * 1.06, 26, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), lidMat, false);
  g.add(lid, lower);
  return { g, look, lid, lower, r };
}
// open: 1 = wide open, 0 = shut; gaze in radians; wide pops the eye a little bigger
function setEye(e, open, gazeX = 0, gazeY = 0, wide = 0) {
  const o = clamp01(open);
  e.lid.rotation.x = THREE.MathUtils.lerp(1.42, -0.42 - 0.2 * wide, o);
  e.lower.rotation.x = THREE.MathUtils.lerp(-0.25, 0.12 + 0.1 * wide, o);
  e.look.rotation.set(-gazeY, gazeX, 0);
  e.g.scale.setScalar(1 + 0.14 * wide);
}
// smile / frown arc across the face (bend > 0 smiles), optional wave and tilt
function arcPts(R, cx, cy, w, bend, n = 9, wav = 0, tilt = 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * 2 - 1;
    pts.push(onSph(R, cx + u * w, cy - bend * (1 - u * u) + wav * Math.sin(u * Math.PI * 2.5) + tilt * u));
  }
  return pts;
}

// a bag of chips and a cookie jar (stand-ins until kitchen.js provides its own)
function standInChips(M) {
  const g = new THREE.Group();
  const body = mesh(new RoundedBoxGeometry(0.17, 0.22, 0.07, 4, 0.03), M.bagFoil);
  body.position.y = 0.11;
  const band = mesh(new RoundedBoxGeometry(0.172, 0.05, 0.072, 2, 0.02), M.bagStripe, false);
  band.position.y = 0.12;
  const crimp = mesh(new RoundedBoxGeometry(0.18, 0.025, 0.03, 2, 0.01), M.bagFoil, false);
  crimp.position.y = 0.225;
  g.add(body, band, crimp);
  for (let i = 0; i < 3; i++) {
    const c = mesh(sph(0.03, 10, 6), M.chip, false);
    c.scale.set(1, 0.25, 0.8);
    c.position.set(-0.04 + i * 0.04, 0.245, 0.0);
    c.rotation.z = 0.4 - i * 0.3;
    g.add(c);
  }
  return g;
}
function standInJar(M) {
  const g = new THREE.Group();
  const jar = mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.16, 24), M.glass, false);
  jar.position.y = 0.08;
  const lid = mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.03, 24), M.lid);
  lid.position.y = 0.175;
  g.add(jar, lid);
  for (let i = 0; i < 4; i++) {
    const c = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.014, 18), M.cookie, false);
    c.position.set(Math.sin(i * 2.1) * 0.02, 0.025 + i * 0.03, Math.cos(i * 2.1) * 0.02);
    c.rotation.set(0.3 * Math.sin(i), 0, 0.25 * Math.cos(i * 1.7));
    g.add(c);
  }
  return g;
}
function chipsBag(ctx, M) {
  try {
    if (typeof KITCHEN.makeChipsBag === 'function') return KITCHEN.makeChipsBag(ctx);
  } catch (e) { /* fall back to the stand-in */ }
  return standInChips(M);
}
function cookieJar(ctx, M) {
  try {
    if (typeof KITCHEN.makeCookieJar === 'function') return KITCHEN.makeCookieJar(ctx);
  } catch (e) { /* fall back to the stand-in */ }
  return standInJar(M);
}
// face features of a round head: ears, cheeks, nose
function faceBits(head, R, M, skinMat) {
  for (const s of [-1, 1]) {
    const ear = mesh(sph(R * 0.24, 14, 10), skinMat);
    ear.position.copy(onSph(R * 0.96, s * 1.5, 0.0));
    ear.scale.set(0.6, 1, 0.9);
    head.add(ear);
    const bl = mesh(sph(R * 0.22, 16, 10), M.blush, false);
    bl.position.copy(onSph(R * 0.985, s * 0.62, -0.22));
    bl.scale.set(1, 0.62, 0.3);
    bl.lookAt(bl.position.clone().multiplyScalar(2));
    head.add(bl);
  }
  const nose = mesh(sph(R * 0.125, 14, 10), skinMat);
  nose.position.copy(onSph(R + 0.005, 0, -0.1));
  head.add(nose);
}

// ---------------------------------------------------------------------------
// the kid: ~0.95 m, head 0.38 m across, star pyjamas, headlamp
// ---------------------------------------------------------------------------
function buildKid(ctx, M) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // squash
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.3;
  body.add(hips);
  // legs pivot at the hips; feet
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.068, 0, 0);
    leg.add(limb(V(0, 0, 0), V(0, -0.21, 0), 0.058, M.pyjamaDark));
    const foot = mesh(new RoundedBoxGeometry(0.1, 0.075, 0.15, 3, 0.035), M.shoe);
    foot.position.set(0, -0.255, 0.025);
    const sole = mesh(new RoundedBoxGeometry(0.104, 0.022, 0.154, 2, 0.01), M.sole, false);
    sole.position.set(0, -0.285, 0.025);
    leg.add(foot, sole);
    hips.add(leg);
    legs.push(leg);
  }
  // torso pivots at the hips
  const torso = new THREE.Group();
  hips.add(torso);
  const trunk = mesh(sph(0.16, 28, 20), M.pyjama);
  trunk.scale.set(1.0, 1.08, 0.82);
  trunk.position.y = 0.13;
  const collar = mesh(new THREE.TorusGeometry(0.075, 0.018, 8, 24), M.pyjamaDark, false);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.285;
  torso.add(trunk, collar);
  // arms pivot at the shoulders, hanging along -y (front = +z). [0] right (-x), [1] left
  const arms = [], hands = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.15, 0.22, 0);
    sh.add(limb(V(0, 0, 0), V(0, -0.2, 0), 0.046, M.pyjama));
    const cuff = mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 18), M.pyjamaDark, false);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.2;
    const hand = new THREE.Group();
    hand.position.y = -0.245;
    hand.add(mesh(sph(0.052, 18, 14), M.kidSkin));
    sh.add(cuff, hand);
    torso.add(sh);
    arms.push(sh);
    hands.push(hand);
  }
  // head on a neck pivot
  const neck = new THREE.Group();
  neck.position.y = 0.3;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.17;
  neck.add(head);
  const R = 0.19;
  head.add(mesh(sph(R, 40, 30), M.kidSkin));
  // hair: cap over the top and back, a fringe and a cowlick
  const hairCap = sph(R * 1.055, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.45);
  hairCap.rotateX(-0.42);
  head.add(mesh(hairCap, M.kidHair));
  for (const [yaw, r, dy] of [[-0.42, 0.06, 0.0], [-0.12, 0.065, 0.02], [0.2, 0.062, 0.01], [0.48, 0.055, -0.01]]) {
    const f = mesh(sph(r, 16, 12), M.kidHair);
    f.position.copy(onSph(R * 0.98, yaw, 0.62 + dy));
    f.scale.set(1.2, 0.7, 0.9);
    head.add(f);
  }
  const lick = mesh(new THREE.ConeGeometry(0.03, 0.09, 10), M.kidHair);
  lick.position.copy(onSph(R * 1.02, -0.15, 1.15));
  lick.rotation.set(-0.5, 0, 0.5);
  head.add(lick);
  faceBits(head, R, M, M.kidSkin);
  // eyes and brows
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.058, M.irisKid, M.kidSkin, M, M.hl);
    e.g.position.copy(onSph(R - 0.03, s * 0.33, 0.06));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.05)));
    head.add(e.g);
    eyes.push(e);
    const b = new THREE.Group();
    b.position.copy(onSph(R + 0.004, s * 0.33, 0.38));
    b.lookAt(b.position.clone().multiplyScalar(2));
    const bm = mesh(cap(0.012, 0.055, 4, 8), M.brow, false);
    bm.rotation.z = Math.PI / 2;
    b.add(bm);
    head.add(b);
    b.userData.y0 = b.position.y;
    brows.push(b);
  }
  // mouths (one shown at a time)
  const mouths = {
    smile: tube(arcPts(R + 0.002, 0, -0.33, 0.24, 0.07), 0.0085, M.mouth),
    flat: tube(arcPts(R + 0.002, 0, -0.34, 0.16, 0.0), 0.008, M.mouth),
    nervous: tube(arcPts(R + 0.002, 0, -0.34, 0.27, 0.03, 16, 0.025), 0.0085, M.mouth),
  };
  {
    // open grin: dark half-disc with teeth and tongue
    const g = new THREE.Group();
    const m = mesh(sph(0.075, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.mouthIn, false);
    m.scale.set(1, 0.62, 0.35);
    const teeth = mesh(new RoundedBoxGeometry(0.1, 0.018, 0.02, 2, 0.008), M.teeth, false);
    teeth.position.set(0, -0.008, 0.012);
    const tongue = mesh(sph(0.035, 14, 8), M.tongue, false);
    tongue.scale.set(1.2, 0.45, 0.6);
    tongue.position.set(0, -0.035, 0.0);
    g.add(m, teeth, tongue);
    g.position.copy(onSph(R - 0.006, 0, -0.3));
    g.lookAt(g.position.clone().multiplyScalar(2));
    mouths.grin = g;
    const o = mesh(sph(0.032, 18, 12), M.mouthIn, false);
    o.position.copy(onSph(R - 0.004, 0, -0.34));
    o.lookAt(o.position.clone().multiplyScalar(2));
    mouths.o = o;
  }
  for (const k in mouths) head.add(mouths[k]);
  // headlamp: band, housing, lens, spot light, visible beam
  const band = mesh(new THREE.TorusGeometry(R * 1.02, 0.014, 8, 56), M.lampBand, false);
  band.rotation.x = Math.PI / 2 - 0.42;
  band.position.y = 0.035;
  head.add(band);
  const lamp = new THREE.Group();
  lamp.position.copy(onSph(R + 0.018, 0, 0.5));
  lamp.rotation.x = -0.25;
  const housing = mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.04, 20), M.lampBody);
  housing.rotation.x = Math.PI / 2;
  const lens = mesh(new THREE.CircleGeometry(0.03, 20), M.lens, false);
  lens.position.z = 0.021;
  lamp.add(housing, lens);
  head.add(lamp);
  const spot = new THREE.SpotLight(new THREE.Color(1.0, 0.86, 0.62), 0, 7, 0.36, 0.55, 2);
  spot.position.set(0, 0, 0.03);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -0.35, 2.0);
  lamp.add(spot, spotTarget);
  spot.target = spotTarget;
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { k: { value: 0 } },
    vertexShader: 'varying float vH; varying vec3 vN; varying vec3 vV; void main(){ vH = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float k; varying float vH; varying vec3 vN; varying vec3 vV; void main(){ float f = abs(dot(vN, vV)); float a = k * pow(vH, 1.6) * smoothstep(0.0, 0.6, f) * 0.16; gl_FragColor = vec4(vec3(1.0, 0.85, 0.6) * a, a); }',
  });
  const beamG = new THREE.ConeGeometry(0.42, 1.9, 32, 1, true);
  beamG.translate(0, -0.95, 0); // apex at the lamp
  beamG.rotateX(-Math.PI / 2 - 0.18); // forward, a little down
  const beam = new THREE.Mesh(beamG, beamMat);
  beam.renderOrder = 20;
  beam.position.z = 0.03;
  lamp.add(beam);
  // sweat drop
  const sweat = new THREE.Group();
  {
    const d = mesh(sph(0.022, 14, 10), M.sweat, false);
    const tip = mesh(new THREE.ConeGeometry(0.0205, 0.04, 14), M.sweat, false);
    tip.position.y = 0.026;
    sweat.add(d, tip);
    head.add(sweat);
  }
  // a glowing "?" over his head (the confused thought)
  const qmark = new THREE.Group();
  {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 1.05 - (i / 14) * Math.PI * 1.55;
      pts.push(V(Math.cos(a) * 0.055, 0.075 + Math.sin(a) * 0.055, 0));
    }
    pts.push(V(0.0, 0.0, 0), V(0.0, -0.02, 0));
    qmark.add(tube(pts, 0.012, M.qmark));
    const dot = mesh(sph(0.016, 10, 8), M.qmark, false);
    dot.position.y = -0.065;
    qmark.add(dot);
    qmark.position.set(0.05, R + 0.18, 0.05);
    head.add(qmark);
  }
  // tools (all in the right hand, reaching out along the arm)
  const shovel = new THREE.Group();
  {
    shovel.add(limb(V(0, 0.12, 0), V(0, -0.42, 0), 0.014, M.wood));
    const tgrip = mesh(cap(0.016, 0.07, 4, 8), M.grip);
    tgrip.rotation.z = Math.PI / 2;
    tgrip.position.y = 0.14;
    const neckS = mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.06, 10), M.metal);
    neckS.position.y = -0.43;
    const blade = mesh(sph(0.1, 20, 12, 0, Math.PI, 0, Math.PI), M.metal);
    blade.scale.set(0.95, 1.25, 0.32);
    blade.rotation.set(0, Math.PI / 2, 0);
    blade.position.y = -0.52;
    shovel.add(tgrip, neckS, blade);
    hands[0].add(shovel);
  }
  const spoon = new THREE.Group();
  {
    spoon.add(limb(V(0, 0.03, 0), V(0, -0.11, 0), 0.006, M.spoon));
    const bowl = mesh(sph(0.03, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.spoon);
    bowl.scale.set(0.8, 0.45, 1.15);
    bowl.rotation.x = Math.PI / 2;
    bowl.position.y = -0.14;
    spoon.add(bowl);
    spoon.rotation.x = 0.5;
    hands[0].add(spoon);
  }
  const cutter = new THREE.Group();
  {
    const handle = mesh(cap(0.018, 0.06, 4, 8), M.grip);
    handle.position.y = 0.01;
    const bodyC = mesh(new RoundedBoxGeometry(0.07, 0.14, 0.07, 3, 0.025), M.yellow);
    bodyC.position.y = -0.08;
    const disc = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 28), M.cutterDisc, false);
    disc.position.y = -0.17;
    const guard = mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.02, 20, 1, true, 0, Math.PI), M.metal, false);
    guard.position.y = -0.17;
    cutter.add(handle, bodyC, disc, guard);
    cutter.userData.disc = disc;
    hands[0].add(cutter);
  }
  const heldChips = new THREE.Group();
  const kidChips = chipsBag(ctx, M);
  kidChips.position.set(0, -0.06, 0.04);
  kidChips.scale.setScalar(0.9);
  heldChips.add(kidChips);
  hands[0].add(heldChips);
  const heldJar = new THREE.Group();
  const kidJar = cookieJar(ctx, M);
  kidJar.position.set(0, -0.08, 0.05);
  kidJar.scale.setScalar(0.85);
  heldJar.add(kidJar);
  hands[1].add(heldJar);
  // the snacks once he puts them down on the tunnel floor
  const floorChips = chipsBag(ctx, M), floorJar = cookieJar(ctx, M);
  floorChips.scale.setScalar(0.9);
  floorJar.scale.setScalar(0.85);
  // a chip on its way to the mouth, a puff when tools appear and vanish
  const chip = mesh(sph(0.026, 10, 6), M.chip, false);
  chip.scale.set(1, 0.25, 0.8);
  chip.position.set(0, -0.05, 0.05);
  hands[0].add(chip);
  const puff = mesh(sph(1, 16, 10), M.puff, false);
  root.add(puff);
  return { root, body, hips, legs, torso, arms, hands, neck, head, eyes, brows, mouths, lens, spot, beam, beamMat, sweat, qmark, shovel, spoon, cutter, heldChips, heldJar, floorChips, floorJar, chip, puff, R };
}

// ---------------------------------------------------------------------------
// Mom: sitting cross-legged in a fluffy robe, hair in a bun, a bag of chips
// ---------------------------------------------------------------------------
function buildMom(ctx, M) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // crossed legs under the robe, fluffy slippers peeking out
  const lap = mesh(sph(0.2, 30, 18), M.robe);
  lap.scale.set(1.35, 0.42, 1.05);
  lap.position.set(0, 0.075, 0.05);
  body.add(lap);
  for (const s of [-1, 1]) {
    body.add(limb(V(s * 0.2, 0.06, 0.02), V(-s * 0.06, 0.07, 0.2), 0.065, M.robe));
    const sl = mesh(sph(0.06, 16, 12), M.slipper);
    sl.scale.set(0.8, 0.62, 1.25);
    sl.position.set(-s * 0.11, 0.05, 0.24);
    sl.rotation.y = s * 0.5;
    const pom = mesh(sph(0.032, 12, 10), M.robeLight);
    pom.position.set(-s * 0.13, 0.085, 0.29);
    body.add(sl, pom);
  }
  // robe body, shawl collar, belt
  const torso = new THREE.Group();
  torso.position.y = 0.12;
  body.add(torso);
  const trunk = mesh(sph(0.18, 30, 22), M.robe);
  trunk.scale.set(1.0, 1.18, 0.82);
  trunk.position.y = 0.17;
  torso.add(trunk);
  for (const s of [-1, 1]) torso.add(limb(V(s * 0.1, 0.36, 0.08), V(-s * 0.02, 0.16, 0.15), 0.035, M.robeLight));
  const belt = mesh(new THREE.TorusGeometry(0.155, 0.02, 8, 30), M.robeLight, false);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.05, 0.85, 1);
  belt.position.y = 0.12;
  const knot = mesh(sph(0.03, 12, 10), M.robeLight, false);
  knot.position.set(0.04, 0.12, 0.15);
  torso.add(belt, knot);
  // arms: [0] right (-x), [1] left (+x)
  const arms = [], hands = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.165, 0.32, 0);
    sh.add(limb(V(0, 0, 0), V(0, -0.21, 0), 0.05, M.robe));
    const cuff = mesh(new THREE.TorusGeometry(0.05, 0.018, 8, 18), M.robeLight, false);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.21;
    const hand = new THREE.Group();
    hand.position.y = -0.255;
    hand.add(mesh(sph(0.045, 16, 12), M.momSkin));
    sh.add(cuff, hand);
    torso.add(sh);
    arms.push(sh);
    hands.push(hand);
  }
  // head
  const neck = new THREE.Group();
  neck.position.y = 0.38;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.y = 0.15;
  neck.add(head);
  const R = 0.165;
  head.add(mesh(sph(R, 40, 30), M.momSkin));
  const hairCap = sph(R * 1.06, 40, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
  hairCap.rotateX(-0.5);
  head.add(mesh(hairCap, M.momHair));
  for (const [yaw, pitch, r] of [[-0.5, 0.55, 0.06], [-0.2, 0.68, 0.065], [0.15, 0.7, 0.058], [0.5, 0.52, 0.05]]) {
    const f = mesh(sph(r, 16, 12), M.momHair);
    f.position.copy(onSph(R * 0.98, yaw, pitch));
    f.scale.set(1.3, 0.62, 0.9);
    head.add(f);
  }
  const bun = mesh(sph(0.085, 24, 18), M.momHair);
  bun.position.copy(onSph(R * 1.02, 0, 1.15)).add(V(0, 0.03, -0.03));
  const tie = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20), M.robe, false);
  tie.position.copy(bun.position).add(V(0, -0.045, 0.01));
  tie.rotation.x = Math.PI / 2 - 0.4;
  head.add(bun, tie);
  faceBits(head, R, M, M.momSkin);
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.05, M.irisMom, M.momSkin, M, M.hlMom);
    e.g.position.copy(onSph(R - 0.027, s * 0.34, 0.05));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.05)));
    head.add(e.g);
    const lash = mesh(cap(0.006, 0.03, 3, 6), M.lash, false);
    lash.position.copy(onSph(R + 0.004, s * 0.55, 0.15));
    lash.rotation.z = s * 1.0;
    head.add(lash);
    eyes.push(e);
    const b = new THREE.Group();
    b.position.copy(onSph(R + 0.004, s * 0.34, 0.37));
    b.lookAt(b.position.clone().multiplyScalar(2));
    const bm = mesh(cap(0.01, 0.05, 4, 8), M.browMom, false);
    bm.rotation.z = Math.PI / 2;
    b.add(bm);
    head.add(b);
    b.userData.y0 = b.position.y;
    brows.push(b);
  }
  const mouths = {
    smirk: tube(arcPts(R + 0.002, 0.03, -0.34, 0.2, 0.045, 9, 0, 0.06), 0.0075, M.mouth),
    smile: tube(arcPts(R + 0.002, 0, -0.33, 0.21, 0.07), 0.0075, M.mouth),
  };
  const talk = mesh(sph(0.032, 18, 12), M.mouthIn, false);
  talk.position.copy(onSph(R - 0.004, 0, -0.34));
  talk.lookAt(talk.position.clone().multiplyScalar(2));
  mouths.talk = talk;
  for (const k in mouths) head.add(mouths[k]);
  // her bag of chips (left hand) and a chip (right hand)
  const held = new THREE.Group();
  const bag = chipsBag(ctx, M);
  bag.position.set(0, -0.09, 0.05);
  held.add(bag);
  hands[1].add(held);
  const chip = mesh(sph(0.024, 10, 6), M.chip, false);
  chip.scale.set(1, 0.25, 0.8);
  chip.position.set(0, -0.03, 0.04);
  hands[0].add(chip);
  return { root, body, torso, arms, hands, neck, head, eyes, brows, mouths, held, chip, R };
}

// ---------------------------------------------------------------------------
// the dog: round toy dog lying in the doghouse, floppy ears, collar with a tag
// ---------------------------------------------------------------------------
function buildDog(ctx, M) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // breathing
  root.add(body);
  const trunk = mesh(sph(0.15, 30, 20), M.dogFur);
  trunk.scale.set(0.8, 0.68, 1.45);
  trunk.position.set(0, 0.105, -0.02);
  const chest = mesh(sph(0.1, 22, 16), M.dogCream);
  chest.scale.set(0.95, 0.85, 0.8);
  chest.position.set(0, 0.1, 0.13);
  body.add(trunk, chest);
  // front paws stretched forward, back legs tucked, a curled tail
  for (const s of [-1, 1]) {
    body.add(limb(V(s * 0.06, 0.05, 0.08), V(s * 0.065, 0.035, 0.27), 0.034, M.dogFur));
    const paw = mesh(sph(0.04, 16, 12), M.dogCream);
    paw.scale.set(1, 0.7, 1.15);
    paw.position.set(s * 0.065, 0.03, 0.29);
    const haunch = mesh(sph(0.075, 18, 12), M.dogFur);
    haunch.scale.set(0.8, 0.85, 1.1);
    haunch.position.set(s * 0.092, 0.07, -0.16);
    const bpaw = mesh(sph(0.035, 14, 10), M.dogCream);
    bpaw.scale.set(1, 0.65, 1.2);
    bpaw.position.set(s * 0.1, 0.025, -0.06);
    body.add(paw, haunch, bpaw);
  }
  const tailG = new THREE.Group();
  tailG.position.set(0, 0.12, -0.22);
  const tailPts = [V(0, 0, 0), V(0.06, -0.02, -0.08), V(0.14, -0.05, -0.05), V(0.17, -0.07, 0.05)];
  tailG.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tailPts), 20, 0.026, 10), M.dogFur));
  body.add(tailG);
  // head on a neck pivot, collar with a tag
  const neck = new THREE.Group();
  neck.position.set(0, 0.16, 0.2);
  body.add(neck);
  const collar = mesh(new THREE.TorusGeometry(0.07, 0.016, 8, 26), M.collar);
  collar.rotation.x = Math.PI / 2 - 0.5;
  collar.position.set(0, -0.02, -0.01);
  const tag = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 16), M.tag, false);
  tag.rotation.x = Math.PI / 2 - 0.3;
  tag.position.set(0, -0.075, 0.055);
  neck.add(collar, tag);
  const head = new THREE.Group();
  head.position.set(0, 0.035, 0.06);
  neck.add(head);
  const R = 0.12;
  head.add(mesh(sph(R, 36, 26), M.dogFur));
  const muzzle = mesh(sph(0.07, 24, 18), M.dogCream);
  muzzle.scale.set(1.05, 0.78, 0.95);
  muzzle.position.set(0, -0.035, 0.085);
  const nose = mesh(sph(0.026, 16, 12), M.dogNose);
  nose.scale.set(1.25, 0.85, 0.9);
  nose.position.set(0, -0.012, 0.15);
  const dmouth = tube([V(-0.03, -0.058, 0.132), V(-0.012, -0.068, 0.14), V(0, -0.06, 0.145), V(0.012, -0.068, 0.14), V(0.03, -0.058, 0.132)], 0.0045, M.dogNose);
  head.add(muzzle, nose, dmouth);
  const eyes = [], ears = [];
  for (const s of [-1, 1]) {
    const e = makeEye(0.034, M.irisDog, M.dogFur, M, M.hl);
    e.g.position.copy(onSph(R - 0.012, s * 0.4, 0.12));
    e.g.lookAt(e.g.position.clone().multiplyScalar(2).add(V(0, 0, 0.04)));
    head.add(e.g);
    eyes.push(e);
    // floppy ear: pivot at the top side of the head
    const ep = new THREE.Group();
    ep.position.copy(onSph(R * 0.92, s * 1.15, 0.55));
    const ear = mesh(cap(0.045, 0.1, 6, 12), M.dogEar);
    ear.scale.set(1, 1, 0.38);
    ear.position.set(s * 0.02, -0.07, 0);
    ep.add(ear);
    head.add(ep);
    ears.push(ep);
  }
  // Zzz (three glowing letters that float up in turn)
  const zs = [];
  const bar = (x0, y0, x1, y1, t) => {
    const g = new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0) + t, t, t * 0.5);
    g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    return g;
  };
  const zParts = [bar(-0.05, 0.05, 0.05, 0.05, 0.014), bar(0.05, 0.05, -0.05, -0.05, 0.014), bar(-0.05, -0.05, 0.05, -0.05, 0.014)];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const m = M.zzz.clone();
    for (const p of zParts) {
      const zm = new THREE.Mesh(p, m);
      zm.renderOrder = 15;
      g.add(zm);
    }
    g.userData.mat = m;
    zs.push(g);
    ctx.scene.add(g);
  }
  return { root, body, tailG, neck, head, eyes, ears, zs, R };
}

// ---------------------------------------------------------------------------
// acting
// ---------------------------------------------------------------------------
export function build(ctx) {
  const { T, WD, U } = ctx;
  const { clamp, lerp, prog, smooth, popIn, easeOutBack, easeInOutCubic, wobble, bump } = U;
  const M = makeMats(ctx.envMap);
  const kid = buildKid(ctx, M);
  const mom = buildMom(ctx, M);
  const dog = buildDog(ctx, M);
  for (const o of [kid.root, mom.root, dog.root, kid.floorChips, kid.floorJar]) ctx.add(o);
  const ramp = (t, a, d) => smooth(prog(t, a, d));
  const win = (t, a, b, f = 0.2) => bump(t, a, b, f);
  const FLOOR = WD.FLOOR, KID_H = WD.KID_H;
  const SCOOPS = [...WD.SCOOP_T.map((s) => s.t), T.clang].sort((a, b) => a - b);
  const SHAFT_SCOOPS = WD.SCOOP_T.filter((s) => s.kind === 'up').map((s) => s.t);
  const SPOONS = WD.SPOON_T;
  const shaftX = (WD.SHAFT.x0 + WD.SHAFT.x1) / 2;
  const dogX = (WD.DOG_UP.x0 + WD.DOG_UP.x1) / 2;
  const patchZ = (WD.PATCH.z0 + WD.PATCH.z1) / 2;
  const kitX = (WD.TILE.x0 + WD.TILE.x1) / 2, kitZ = (WD.TILE.z0 + WD.TILE.z1) / 2;
  const slabTop = WD.HOUSE.floor;
  const feetTop = WD.HOUSE.slab0 - KID_H - 0.02; // standing with the head just under the slab

  // natural blinks (pure function of time)
  function blinkAt(t, period, dur, seed = 0) {
    const x = (t + seed * 1.7) / period;
    const i = Math.floor(x);
    const off = 0.3 + 0.5 * U.hash1(i + seed * 13);
    const u = (x - i - off) * period;
    return u > 0 && u < dur ? Math.sin((u / dur) * Math.PI) : 0;
  }
  // a shovel stroke round strike time s: wind up, chop down, pull, return
  function swing(t, list, dur = 0.62) {
    let best = null;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const prev = i > 0 ? list[i - 1] : -1e9, next = i + 1 < list.length ? list[i + 1] : 1e9;
      const d = Math.min(dur, (s - prev) * 0.95, (next - s) * 0.95 + 0.25);
      if (t >= s - d * 0.55 && t <= s + d * 0.45) best = { s, d };
    }
    if (!best) return { lift: 0, chop: 0 };
    const u = (t - best.s) / best.d; // -0.55 .. 0.45
    let lift = 0, chop = 0;
    if (u < -0.08) lift = smooth(clamp((u + 0.55) / 0.47));
    else if (u < 0) lift = 1 - smooth(clamp((u + 0.08) / 0.08));
    if (u >= -0.02) chop = Math.sin(clamp(u / 0.45) * Math.PI) * (u < 0.2 ? 1 : 0.6);
    return { lift, chop };
  }

  // ---------------- kid ----------------
  function poseKid(t) {
    const P = {
      x: shaftX, y: 0, z: -0.62, ry: -0.35,
      crouch: 0, lean: 0, roll: 0, spread: 0, kneel: 0, sit: 0, step: 0,
      aR: [0.25, -0.08], aL: [0.25, 0.08], // [forward, side]; side < 0 moves an arm towards -x
      hYaw: 0, hPitch: 0, hRoll: 0,
      open: 1, wide: 0, gx: 0, gy: 0, browL: 0, browR: 0, worry: 0,
      mouth: 'smile', tool: 'shovel', lamp: 0, shake: 0, squash: 0, q: 0, sweat: -1, chip: 0,
    };
    // ---- 1: sneaky on the lawn, down the shaft, then sideways ----
    if (t < T.shaft0) {
      P.hYaw = 0.35 * Math.sin(t * 2.4);
      P.aR = [0.55, -0.05];
      P.aL = [0.6, 0.12];
    }
    if (t >= T.shaft0 && t < T.tunA0 + 0.25) {
      P.y = WD.shaftY(t);
      P.ry = -0.55;
      P.crouch = 0.25;
      const sw = swing(t, SHAFT_SCOOPS, 0.5);
      // stab down, toss up over the shoulder towards the pile
      P.aR = [lerp(0.35, 2.4, sw.lift) - 0.15 * sw.chop, -0.1];
      P.aL = [lerp(0.4, 2.2, sw.lift) - 0.1 * sw.chop, 0.25];
      P.lean = 0.25 - 0.3 * sw.lift;
      P.hPitch = -0.25 + 0.35 * sw.lift;
      P.mouth = 'grin';
    }
    if (t >= T.tunA0) {
      P.x = Math.max(shaftX, WD.tunX(t - 0.25) - 0.42);
      P.y = FLOOR;
      P.z = -0.68;
      P.ry = lerp(-0.55, 1.0, ramp(t, T.tunA0 - 0.1, 0.35));
      P.crouch = 0.45;
      const sw = swing(t, SCOOPS, 0.6);
      P.aR = [lerp(0.55, 2.3, sw.lift) - 0.25 * sw.chop, -0.12];
      P.aL = [lerp(0.6, 2.1, sw.lift) - 0.2 * sw.chop, 0.18];
      P.lean = 0.32 - 0.35 * sw.lift + 0.12 * sw.chop;
      P.hPitch = -0.08 + 0.12 * sw.lift;
      // the snack dream: looks up at the bubble, dreamy; "Sort of." shrug
      const dream = win(t, T.dream - 0.1, T.dreamPop + 0.35, 0.25);
      P.hPitch += 0.55 * dream;
      P.hYaw += -0.6 * dream;
      P.gy += 0.2 * dream;
      if (dream > 0.3 && t < T.dreamPop) P.mouth = 'grin';
      const shrug = win(t, T.dreamPop + 0.05, T.dreamPop + 0.75, 0.15);
      P.browL += 0.6 * shrug;
      P.browR += 0.6 * shrug;
      if (shrug > 0.2) P.mouth = 'flat';
    }
    // ---- 2: cave-in (duck, bonk, shake off), admire the frames and the lantern ----
    {
      const duck = win(t, T.cave0 - 0.05, T.cave1 + 0.25, 0.22);
      if (duck > 0) {
        P.crouch = lerp(P.crouch, 0.85, duck);
        P.aR = [lerp(P.aR[0], 2.75, duck), lerp(P.aR[1], 0.32, duck)];
        P.aL = [lerp(P.aL[0], 2.75, duck), lerp(P.aL[1], -0.32, duck)];
        P.ry = lerp(P.ry, 0.45, duck);
        P.open = lerp(1, 0.08, duck);
        P.mouth = 'o';
        P.lean = lerp(P.lean, 0.35, duck);
        P.hPitch = lerp(P.hPitch, -0.3, duck);
      }
      // the clump from the third bite lands on his head
      const bonkT = T.cave0 + 1.05;
      if (t > bonkT) P.squash += 0.14 * Math.max(0, wobble(t, bonkT, 3.2, 6)) + (t < bonkT + 0.08 ? 0.1 : 0);
      const shake = win(t, T.cave1 + 0.1, T.cave1 + 0.75, 0.1);
      if (shake > 0) {
        P.hRoll += 0.32 * Math.sin((t - T.cave1) * 34) * shake;
        P.roll += 0.12 * Math.sin((t - T.cave1) * 30 + 1) * shake;
        P.open = lerp(P.open, 0.15, shake);
        P.mouth = 'flat';
      }
      const look = win(t, T.frames0 - 0.1, T.lantern + 1.1, 0.35);
      P.hPitch += 0.35 * look;
      P.hYaw += -0.5 * look;
      const wow = win(t, T.lantern, T.lantern + 1.2, 0.2);
      if (wow > 0.3) P.mouth = 'grin';
      P.wide += 0.4 * wow;
    }
    // ---- 3: the clang, a worried look at the doghouse, the spoon ----
    {
      const sh = t > T.clang && t < T.clang + 0.9 ? Math.exp(-(t - T.clang) * 4.2) : 0;
      P.shake += sh;
      if (t > T.clang && t < T.clang + 1.0) {
        P.wide = Math.max(P.wide, 1 - smooth(prog(t, T.clang + 0.6, 0.4)));
        P.mouth = 'o';
        P.browL += 0.8;
        P.browR += 0.8;
        P.aR = [P.aR[0] + 0.18 * Math.sin(t * 160) * sh, P.aR[1]];
        P.aL = [P.aL[0] + 0.18 * Math.sin(t * 160 + 1.3) * sh, P.aL[1]];
      }
      const up = win(t, T.clang + 0.75, T.spoonSwap - 0.05, 0.3);
      if (up > 0) {
        P.hPitch = lerp(P.hPitch, 0.6, up);
        P.hYaw = lerp(P.hYaw, 0.45, up);
        P.worry += up;
        P.gy += 0.25 * up;
        P.mouth = 'nervous';
        P.aR = [lerp(P.aR[0], 0.5, up), P.aR[1]];
        P.aL = [lerp(P.aL[0], 0.5, up), P.aL[1]];
      }
    }
    if (t >= T.spoonSwap) P.tool = 'spoon';
    if (t >= T.spoon0 && t < T.dogUp0 - 0.3) {
      // tiny scrapes, droopier as the weeks go by
      const tired = ramp(t, T.spoon0 + 0.4, T.spoon1 - T.spoon0);
      let k = 0;
      for (const s of SPOONS) if (t > s - 0.06 && t < s + 0.09) k = Math.sin(((t - s + 0.06) / 0.15) * Math.PI);
      P.aR = [0.95 + 0.28 * k - 0.15 * tired, -0.08];
      P.aL = [0.45, 0.25];
      P.crouch = 0.5;
      P.lean = 0.45 + 0.1 * tired;
      P.hPitch = -0.2 - 0.15 * tired;
      P.open = lerp(1, 0.5, tired);
      P.mouth = tired > 0.5 ? 'flat' : 'smile';
      P.worry += 0.4 * tired;
    }
    {
      // an unimpressed look at the spoon right after the swap
      const lookSp = win(t, T.spoonSwap + 0.02, T.spoon0 + 0.35, 0.12);
      if (lookSp > 0) {
        P.aR = [lerp(P.aR[0], 1.25, lookSp), lerp(P.aR[1], 0.1, lookSp)];
        P.hPitch = lerp(P.hPitch, -0.35, lookSp);
        P.hYaw = lerp(P.hYaw, 0.25, lookSp);
        P.browL -= 0.6 * lookSp;
        P.browR += 0.3 * lookSp;
        P.mouth = 'flat';
      }
    }
    // ---- 4: up into the doghouse, face to face, the slow sink ----
    if (t >= T.dogUp0 - 0.3 && t < T.sink1 + 0.6) {
      const head = WD.dogPopHead(t);
      const into = ramp(t, T.dogUp0 - 0.3, 0.3);
      P.x = lerp(Math.max(shaftX, WD.tunX(t - 0.25) - 0.42), dogX, into);
      P.z = lerp(-0.68, patchZ, into);
      P.y = lerp(FLOOR, head - KID_H, into);
      P.ry = lerp(1.0, 1.0, into);
      P.crouch = lerp(0.5, 0, into);
      P.lean = lerp(0.45, 0, into);
      P.spread = into * (1 - 0.5 * ramp(t, T.popUp - 0.1, 0.2));
      // scratching upwards with the spoon while climbing
      const climbing = win(t, T.dogUp0 - 0.1, T.popUp, 0.1);
      P.aR = [lerp(0.95, 2.7 + 0.25 * (Math.sin(t * 26) + 1) / 2, into), -0.2];
      P.aL = [lerp(0.45, 2.6, into), 0.3];
      P.hPitch = 0.45 * climbing;
      P.hYaw = 0;
      P.open = 1;
      P.mouth = 'smile';
      P.worry = 0;
      if (t >= T.popUp) {
        // frozen, face to face with the dog
        P.aR = [0.15, -0.1];
        P.aL = [0.15, 0.1];
        P.hPitch = 0.02;
        P.hYaw = 0.05;
        P.wide = 1 - 0.4 * ramp(t, T.popUp + 0.6, 0.6);
        P.worry = 0.3;
        // a slow sideways glance at the camera
        const glance = win(t, T.popUp + 0.62, T.sink0 - 0.12, 0.12);
        P.gx = -0.42 * glance;
        P.gy = -0.05 * glance;
      }
      if (t >= T.sink0) {
        P.mouth = 'nervous';
        P.worry = 1;
        P.wide = 0.25;
      }
      if (t >= T.sink1) {
        const k = ramp(t, T.sink1, 0.25);
        P.aR = [lerp(0.15, 2.6, k), -0.2];
        P.aL = [lerp(0.15, 2.6, k), 0.2];
      }
    }
    // drop back to the tunnel floor and measure, kneeling by the tape case
    if (t >= T.sink1 + 0.6 && t < T.tunB0 + 0.05) {
      const land = ramp(t, T.sink1 + 0.6, 0.18);
      const move = ramp(t, T.sink1 + 0.75, 0.3);
      P.x = lerp(dogX, -0.95, move);
      P.z = lerp(patchZ, -0.66, move);
      P.y = lerp(WD.dogPopHead(t) - KID_H, FLOOR, land);
      P.ry = lerp(1.0, 0.9, move);
      P.spread = 1 - land;
      if (t > T.sink1 + 0.78) P.squash += 0.1 * Math.max(0, wobble(t, T.sink1 + 0.78, 3, 7));
      const kn = ramp(t, T.sink1 + 0.85, 0.3) * (1 - ramp(t, T.tunB0 - 0.15, 0.2));
      P.kneel = kn;
      P.aR = [lerp(2.6, lerp(0.4, 0.75, kn), land), -0.12];
      P.aL = [lerp(2.6, lerp(0.4, 0.7, kn), land), 0.12];
      const tip = ramp(t, T.tape0, T.tape1 - T.tape0);
      P.hYaw = -0.15 + 0.45 * tip;
      P.hPitch = -0.15;
      P.mouth = t > T.steps0 ? 'grin' : 'smile';
      const nod = win(t, T.tape1 - 0.25, T.tape1 + 0.2, 0.08);
      P.hPitch += -0.2 * nod * Math.sin((t - T.tape1) * 25);
      P.worry = 0.6 * (1 - move);
    }
    // ---- dig on under the house, fast ----
    if (t >= T.tunB0 + 0.05 && t < T.kitUp0) {
      const go = ramp(t, T.tunB0 + 0.05, 0.2);
      P.x = Math.max(-0.95, WD.tunX(t - 0.15) - 0.42);
      P.y = FLOOR;
      P.z = -0.68;
      P.ry = lerp(0.9, 1.05, go);
      P.crouch = 0.45 * go;
      P.lean = 0.5 * go;
      let k = 0;
      for (const s of SCOOPS) if (t > s - 0.07 && t < s + 0.1) k = Math.sin(((t - s + 0.07) / 0.17) * Math.PI);
      P.aR = [lerp(0.75, 1.0 + 0.5 * k, go), -0.08];
      P.aL = [lerp(0.7, 0.7 + 0.2 * Math.sin(t * 18), go), 0.2];
      P.hPitch = -0.1;
      P.browL = -0.4;
      P.browR = -0.4;
      P.mouth = 'grin';
      P.step = Math.sin(t * 22) * go;
    }
    // ---- 5: up under the kitchen tile ----
    if (t >= T.kitUp0 && t < 37.8) {
      const into = ramp(t, T.kitUp0, 0.4);
      P.x = lerp(WD.tunX(T.kitUp0 - 0.15) - 0.42, kitX, into);
      P.z = lerp(-0.68, kitZ + 0.05, into);
      P.y = clamp(WD.kitUpY(t) - KID_H - 0.03, FLOOR, feetTop);
      P.ry = lerp(1.05, 0.3, into);
      P.spread = into;
      P.crouch = lerp(0.45, 0, into);
      P.lean = lerp(0.5, 0, into);
      const climbing = win(t, T.kitUp0, T.kitUp1 + 0.25, 0.12);
      P.aR = [lerp(0.6, 2.85 + 0.12 * Math.sin(t * 24), climbing), -0.15];
      P.aL = [lerp(0.6, 2.7, climbing), 0.2];
      P.hPitch = 0.5;
      P.mouth = 'smile';
      if (t > T.kitUp1 + 0.25) {
        const k = ramp(t, T.kitUp1 + 0.25, 0.2);
        P.aR = [lerp(2.85, 0.6, k), -0.1];
        P.aL = [lerp(2.7, 0.6, k), 0.1];
        P.hPitch = 0.55;
      }
      // two taps: "solid tile", then a sore hand
      for (const tt of [T.tap1, T.tap2]) {
        const k = win(t, tt - 0.22, tt + 0.12, 0.1);
        if (k > 0) P.aR = [lerp(P.aR[0], t < tt ? 2.65 : 2.95, k), -0.12];
      }
      const ouch = win(t, T.tap2 + 0.1, T.tap2 + 0.8, 0.12);
      if (ouch > 0) {
        P.aR = [lerp(P.aR[0], 1.1 + 0.25 * Math.sin(t * 40), ouch), -0.3];
        P.open = lerp(1, 0.25, ouch);
        P.mouth = 'o';
      }
      // thinking, then the tile cutter traces round the tile above
      const think = win(t, T.tap2 + 0.8, T.cut0 - 0.15, 0.2);
      P.hRoll += 0.18 * think;
      P.aL = [lerp(P.aL[0], 1.55, think), lerp(P.aL[1], -0.3, think)];
      if (t >= T.cut0 - 0.3 && t < T.cut1 + 0.2) P.tool = 'cutter';
      const cut = win(t, T.cut0 - 0.12, T.cut1 + 0.1, 0.12);
      if (cut > 0) {
        const a = prog(t, T.cut0, T.cut1 - T.cut0) * Math.PI * 2;
        P.aR = [lerp(P.aR[0], 2.85 + 0.12 * Math.sin(a), cut), lerp(P.aR[1], 0.05 + 0.2 * Math.cos(a), cut)];
        P.shake += 0.25 * cut;
        P.hPitch = 0.6;
        P.browL = -0.5;
        P.browR = -0.5;
        P.mouth = 'grin';
      }
      if (t > T.hinge1 - 0.1 && t < T.trapOpen) P.hPitch = 0.65;
      // the trapdoor opens: yay!
      const yay = win(t, T.trapOpen + 0.05, 37.0, 0.18);
      if (yay > 0) {
        P.aR = [lerp(P.aR[0], 2.85, yay), lerp(P.aR[1], -0.55, yay)];
        P.aL = [lerp(P.aL[0], 2.85, yay), lerp(P.aL[1], 0.55, yay)];
        P.mouth = 'grin';
        P.open = lerp(1, 0.55, yay);
        P.hPitch = 0.7;
        P.squash -= 0.06 * Math.max(0, Math.sin((t - T.trapOpen) * 11)) * yay;
      }
      // climb back down to wait for the basket
      const down = ramp(t, 37.0, 0.8);
      if (down > 0) {
        P.y = lerp(P.y, FLOOR, down);
        P.x = lerp(P.x, 3.02, down);
        P.z = lerp(P.z, -0.72, down);
        P.ry = lerp(P.ry, 0.7, down);
        P.spread *= 1 - down;
        P.hPitch = lerp(P.hPitch, 0.55, down);
      }
    }
    // ---- 6: wait, the basket, the snacks, munch, shut the trapdoor, sit ----
    if (t >= 37.8 && t < 48.3) {
      P.x = 3.02;
      P.y = FLOOR;
      P.z = -0.72;
      P.ry = 0.7;
      P.tool = 'none';
      P.hPitch = 0.55;
      P.hYaw = 0.15;
      const rub = win(t, 38.0, T.pulley0 - 0.2, 0.3);
      P.aR = [lerp(0.25, 1.05, rub), lerp(-0.08, 0.35 + 0.08 * Math.sin(t * 16), rub)];
      P.aL = [lerp(0.25, 1.05, rub), lerp(0.08, -0.35 - 0.08 * Math.sin(t * 16), rub)];
      P.mouth = 'grin';
      P.wide = 0.3 * win(t, T.shelfGlow, T.shelfGlow + 1.2, 0.2);
      const fol = ramp(t, T.lower0, T.lower1 - T.lower0);
      P.hPitch = lerp(0.6, 0.05, fol);
      const reach = win(t, T.lower1 - 0.4, T.lower1 + 0.25, 0.15);
      P.aR = [lerp(P.aR[0], 1.9, reach), lerp(P.aR[1], -0.05, reach)];
      P.aL = [lerp(P.aL[0], 1.9, reach), lerp(P.aL[1], 0.05, reach)];
      if (t >= T.lower1 + 0.15) P.tool = 'snacks';
      const hold = win(t, T.lower1 + 0.15, T.basketUp0 + 0.15, 0.15);
      if (hold > 0) {
        P.aR = [lerp(P.aR[0], 0.95, hold), -0.1];
        P.aL = [lerp(P.aL[0], 0.9, hold), 0.25];
        P.hPitch = lerp(P.hPitch, -0.1, hold);
        P.hYaw = lerp(P.hYaw, -0.35, hold);
      }
      // munch: a chip to the mouth, eyes shut with bliss
      const m = win(t, T.munch - 0.25, T.munch + 0.4, 0.12);
      if (m > 0) {
        P.aR = [lerp(P.aR[0], 2.05, m), lerp(P.aR[1], 0.38, m)];
        P.open = lerp(1, 0.12, m);
        P.mouth = t > T.munch ? 'smile' : 'o';
        P.chip = t < T.munch ? m : 0;
        P.hYaw = lerp(P.hYaw, -0.5, m);
      }
      // put the snacks down, climb up, pull the trapdoor shut, climb down
      if (t >= T.basketUp0) {
        P.tool = 'none';
        const up = ramp(t, T.basketUp0 + 0.2, T.trapClose0 - T.basketUp0 - 0.25);
        const dn = ramp(t, T.trapClose1 + 0.05, 0.6);
        const k = up * (1 - dn);
        P.x = lerp(3.02, kitX, k) - 0.12 * dn;
        P.z = lerp(-0.72, kitZ + 0.05, k);
        P.y = lerp(FLOOR, feetTop, k);
        P.ry = lerp(0.7, 0.3, k);
        P.spread = k;
        P.aR = [lerp(0.4, 2.85, k), lerp(-0.1, 0.05, k)];
        P.aL = [lerp(0.4, 2.8, k), lerp(0.1, -0.05, k)];
        P.hPitch = 0.55 * k;
        const pull = win(t, T.trapClose0, T.trapClose1 + 0.1, 0.1);
        if (pull > 0) {
          const pk = ramp(t, T.trapClose0, T.trapClose1 - T.trapClose0);
          P.aR = [2.95 - 0.25 * pk, 0.05];
          P.aL = [2.95 - 0.25 * pk, -0.05];
        }
      }
      // sit down by the snacks and munch, content (the wide shot)
      const sit = ramp(t, T.trapClose1 + 0.7, 0.4);
      if (sit > 0) {
        P.sit = sit;
        P.x = lerp(P.x, 2.92, sit);
        P.z = lerp(P.z, -0.62, sit);
        P.ry = lerp(P.ry, 0.35, sit);
        P.hPitch = lerp(P.hPitch, -0.05, sit);
        P.hYaw = lerp(P.hYaw, -0.25, sit);
        P.mouth = 'smile';
        if (sit > 0.5) P.tool = 'chips';
        P.aR = [lerp(P.aR[0], 0.9, sit), lerp(P.aR[1], -0.25, sit)];
        P.aL = [lerp(P.aL[0], 0.75, sit), lerp(P.aL[1], 0.25, sit)];
        for (const mt of [47.1, 47.85]) {
          const mm = win(t, mt - 0.22, mt + 0.3, 0.1);
          if (mm > 0) {
            P.aR = [lerp(P.aR[0], 2.0, mm), lerp(P.aR[1], 0.38, mm)];
            P.open = lerp(1, 0.3, mm);
          }
        }
      }
    }
    // ---- 7: the empty basket lands overhead, confused, peek, Mom! ----
    if (t >= 48.3) {
      P.x = 2.92;
      P.y = FLOOR;
      P.z = -0.62;
      P.ry = 0.35;
      P.sit = 1;
      P.tool = 'chips';
      P.aR = [0.9, -0.25];
      P.aL = [0.75, 0.25];
      P.mouth = 'smile';
      const look = ramp(t, T.basket2_1 + 0.03, 0.15);
      P.hPitch = 0.55 * look;
      P.hYaw = 0.25 * look;
      const conf = win(t, T.confused, T.peek0 + 0.1, 0.12);
      P.hRoll += 0.3 * conf;
      P.browL += 0.7 * conf;
      P.browR -= 0.2 * conf;
      P.q = conf;
      if (conf > 0.2) P.mouth = 'o';
      const rise = ramp(t, T.confused + 0.1, 0.3);
      P.sit = 1 - rise;
      if (rise > 0.5) P.tool = 'none';
      const climb = ramp(t, T.confused + 0.3, T.peek0 - T.confused - 0.3);
      const peek = ramp(t, T.peek0, T.peek1 - T.peek0);
      const sinkA = ramp(t, T.close0, T.close1 - T.close0);
      const top0 = lerp(FLOOR + KID_H, WD.HOUSE.slab0 - 0.02, climb);
      const headTop = sinkA > 0 ? lerp(slabTop + 0.35, WD.HOUSE.slab0 - 0.15, sinkA) : lerp(top0, slabTop + 0.35, peek);
      if (climb > 0) {
        P.x = lerp(2.92, kitX, climb);
        P.z = lerp(-0.62, kitZ, climb);
        P.y = lerp(FLOOR, headTop - KID_H, Math.min(1, climb * 3));
        P.ry = lerp(0.35, 0.62, climb);
        P.spread = climb * (1 - 0.6 * peek);
        P.aR = [lerp(0.9, 2.85, climb), lerp(-0.25, 0.05, climb)];
        P.aL = [lerp(0.75, 2.8, climb), lerp(0.25, -0.05, climb)];
        P.hPitch = lerp(P.hPitch, 0.35, climb);
      }
      if (t >= T.peek0) {
        P.aR = [2.9, 0.05];
        P.aL = [2.9, -0.05];
        P.lamp = ramp(t, T.peek0 + 0.05, 0.12) * (1 - ramp(t, T.close1 - 0.05, 0.12));
        // look round the dark kitchen; the beam sweeps
        const sweep = prog(t, T.peek1 - 0.1, T.fridgeOn - T.peek1 + 0.05);
        P.hPitch = 0.05 - 0.05 * Math.sin(sweep * Math.PI);
        P.hYaw = lerp(-0.55, -0.15, smooth(sweep)) + 0.2 * Math.sin(sweep * Math.PI * 2) * (1 - sweep);
        P.mouth = 'smile';
        P.open = 1;
        P.q = 0;
        // the fridge light: snap round to Mom, eyes wide, frozen
        const snap = ramp(t, T.fridgeOn + 0.04, 0.16);
        P.hYaw = lerp(P.hYaw, 0.5, snap);
        P.hPitch = lerp(P.hPitch, 0.12, snap);
        P.wide = snap * (1 - 0.5 * ramp(t, T.fridgeOn + 0.9, 0.5));
        P.gx = 0.12 * snap;
        if (snap > 0.5) P.mouth = 'o';
        if (t > T.brow) P.mouth = 'flat';
        if (t > T.musicStop) P.worry = 0.5;
        P.squash += 0.05 * win(t, T.musicStop + 0.05, T.musicStop + 0.3, 0.1);
        if (t > T.nervous) {
          P.mouth = 'nervous';
          P.worry = 1;
          P.browL = 0.45;
          P.browR = 0.45;
          P.sweat = prog(t, T.nervous + 0.1, 1.4);
          P.wide = 0.15;
        }
      }
    }
    return P;
  }

  const _hp = new THREE.Vector3();
  function applyKid(t) {
    const P = poseKid(t);
    const k = kid;
    const sh = P.shake;
    k.root.position.set(P.x + 0.012 * sh * Math.sin(t * 97), P.y, P.z + 0.008 * sh * Math.cos(t * 83));
    k.root.rotation.set(0, P.ry, P.roll * 0.4);
    const sq = P.squash;
    k.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
    // legs: the crouch lowers the hips and keeps the feet down; spread braces in a shaft
    const crouch = clamp(P.crouch);
    k.hips.position.y = 0.3 - 0.11 * crouch - 0.15 * P.kneel - 0.22 * P.sit + 0.004 * Math.sin(t * 2.2);
    const legA = Math.acos(clamp(1 - (0.11 * crouch) / 0.27, -1, 1));
    k.legs.forEach((leg, i) => {
      const s = i === 0 ? -1 : 1;
      leg.rotation.set(-legA + 1.25 * P.kneel - 1.45 * P.sit + P.step * 0.35 * s, 0, s * 0.55 * P.spread);
      leg.position.y = 0.06 * P.kneel;
    });
    k.torso.rotation.set(P.lean + 0.25 * crouch, 0, P.roll * 0.6);
    // arms: forward angle (0 down, pi/2 forward, pi up) and sideways
    k.arms[0].rotation.set(-P.aR[0], 0, P.aR[1]);
    k.arms[1].rotation.set(-P.aL[0], 0, P.aL[1]);
    // head
    k.neck.rotation.set(-P.hPitch * 0.4, P.hYaw * 0.4, P.hRoll * 0.3);
    k.head.rotation.set(-P.hPitch * 0.6, P.hYaw * 0.6, P.hRoll * 0.7);
    // face
    const open = Math.min(P.open, 1 - blinkAt(t, 2.9, 0.13));
    k.eyes.forEach((e) => setEye(e, open, P.gx, P.gy, P.wide));
    k.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      b.position.y = b.userData.y0 + 0.016 * (i === 0 ? P.browR : P.browL) + 0.006 * P.wide;
      b.rotation.z = s * 0.35 * P.worry;
    });
    for (const m in k.mouths) k.mouths[m].visible = m === P.mouth;
    if (P.mouth === 'o') k.mouths.o.scale.set(0.85, 1 + 0.25 * P.wide, 0.35);
    // tools
    const shovelS = t < T.spoonSwap ? 1 : 1 - smooth(prog(t, T.spoonSwap, 0.16));
    k.shovel.visible = shovelS > 0.01;
    k.shovel.scale.setScalar(Math.max(0.001, shovelS));
    const spoonS = popIn(t, T.spoonSwap + 0.06, 0.32, 2.6);
    k.spoon.visible = P.tool === 'spoon' && spoonS > 0.01;
    k.spoon.scale.setScalar(Math.max(0.001, spoonS) * 1.2);
    const cutS = popIn(t, T.cut0 - 0.3, 0.28, 2.4) * (1 - smooth(prog(t, T.cut1 + 0.05, 0.15)));
    k.cutter.visible = P.tool === 'cutter' && cutS > 0.01;
    k.cutter.scale.setScalar(Math.max(0.001, cutS));
    k.cutter.userData.disc.material.emissiveIntensity = 3.5 * win(t, T.cut0, T.cut1, 0.06) * (0.75 + 0.25 * Math.sin(t * 90));
    k.cutter.userData.disc.rotation.y = t * 60;
    // a little puff where a tool vanishes
    const pfA = win(t, T.spoonSwap - 0.02, T.spoonSwap + 0.35, 0.05), pfB = win(t, T.cut1 + 0.05, T.cut1 + 0.4, 0.05);
    k.puff.visible = pfA + pfB > 0.01;
    if (k.puff.visible) {
      k.root.updateMatrixWorld(true);
      k.hands[0].getWorldPosition(_hp);
      k.root.worldToLocal(_hp);
      k.puff.position.copy(_hp);
      const u = pfA > 0 ? prog(t, T.spoonSwap, 0.35) : prog(t, T.cut1 + 0.05, 0.35);
      k.puff.scale.setScalar(0.04 + 0.1 * u);
      k.puff.material.opacity = 0.55 * (1 - u);
    }
    // snacks
    k.heldChips.visible = P.tool === 'snacks' || P.tool === 'chips';
    k.heldJar.visible = P.tool === 'snacks';
    k.chip.visible = P.chip > 0.05;
    const down = t >= T.basketUp0 + 0.05;
    k.floorChips.visible = down && P.tool !== 'chips';
    k.floorJar.visible = down;
    k.floorChips.position.set(2.66, FLOOR, -0.42);
    k.floorChips.rotation.set(0, 0.5, 0);
    k.floorJar.position.set(2.5, FLOOR, -0.66);
    // headlamp
    k.lens.material.emissiveIntensity = 6 * P.lamp;
    k.spot.intensity = 9 * P.lamp;
    k.beamMat.uniforms.k.value = P.lamp * (t > T.fridgeOn ? 0.55 : 1);
    k.beam.visible = P.lamp > 0.01;
    // the sweat drop slides down the side of his head
    k.sweat.visible = P.sweat >= 0 && P.sweat < 1;
    if (k.sweat.visible) {
      const u = P.sweat;
      k.sweat.position.copy(onSph(k.R + 0.012, 0.92, 0.42 - 0.75 * easeInOutCubic(u)));
      k.sweat.scale.setScalar(Math.max(0.001, popIn(t, T.nervous + 0.1, 0.25, 2.2) * (1 - smooth(clamp((u - 0.8) / 0.2)))));
    }
    k.qmark.visible = P.q > 0.02;
    k.qmark.scale.setScalar(Math.max(0.001, easeOutBack(clamp(P.q * 1.4), 2.2)));
    k.qmark.children.forEach((c) => (c.material.opacity = 0.9 * P.q));
    k.qmark.position.y = k.R + 0.16 + 0.02 * Math.sin(t * 6);
  }

  // ---------------- Mom ----------------
  const MOM_RY = -0.62;
  const CRUNCH = [T.crunch1, T.crunch2, T.crunch3];
  function applyMom(t) {
    const m = mom;
    m.root.visible = t >= T.momIn;
    if (!m.root.visible) return;
    m.root.position.set(WD.MOM_POS.x, WD.HOUSE.floor, WD.MOM_POS.z);
    m.root.rotation.y = MOM_RY;
    m.torso.position.y = 0.12 + 0.01 * Math.sin(t * 1.9);
    // chips: the right hand dips into the bag, up to the mouth, crunch
    let toMouth = 0;
    for (const c of CRUNCH) toMouth = Math.max(toMouth, win(t, c - 0.32, c + 0.2, 0.14));
    m.chip.visible = CRUNCH.some((c) => t > c - 0.24 && t < c + 0.01);
    const lift = ramp(t, T.these - 0.12, 0.25) * (1 - ramp(t, T.these + 0.95, 0.4));
    const shakeBag = win(t, T.these + 0.1, T.these + 0.6, 0.08) * Math.sin((t - T.these) * 30);
    m.arms[0].rotation.set(-lerp(0.85, 2.05, toMouth), 0, lerp(0.45, 0.62, toMouth));
    m.arms[1].rotation.set(-lerp(0.85, 1.75, lift) - 0.08 * shakeBag, 0, lerp(-0.5, -0.15, lift));
    m.held.rotation.set(lerp(0.2, -0.4, lift), 0, 0.15 * shakeBag);
    // head: watching the trapdoor, turned to the kid once he peeks; a tilt with the brow
    const atKid = ramp(t, T.peek0 + 0.2, 0.6);
    const tilt = ramp(t, T.brow, 0.3);
    m.head.rotation.set(-0.08 * (1 - atKid) + 0.06 * toMouth - 0.05 * lift, -0.25 * atKid + 0.1 * (1 - atKid), 0.12 * tilt);
    m.neck.rotation.set(0.05, -0.1 * atKid, 0.04 * tilt);
    // eyes: the highlights only come on with the fridge light (in the dark she's a shape)
    m.eyes.forEach((e, i) => {
      const openK = (i === 1 ? 1 - 0.18 * tilt : 1) * (1 - 0.35 * win(t, T.crunch3 + 0.05, T.crunch3 + 1.2, 0.2));
      setEye(e, Math.min(openK, 1 - blinkAt(t, 3.3, 0.13, 3)), -0.25 * atKid, 0.05, 0);
    });
    M.hlMom.emissiveIntensity = 0.9 * ramp(t, T.fridgeOn, 0.12);
    // one eyebrow goes up and stays up
    m.brows.forEach((b, i) => {
      const s = i === 0 ? -1 : 1;
      const up = i === 0 ? easeOutBack(clamp(prog(t, T.brow, 0.28)), 2.0) : 0;
      b.position.y = b.userData.y0 + 0.028 * up;
      b.rotation.z = s * (0.12 - 0.3 * up) + (i === 1 ? -0.12 * tilt : 0);
    });
    // mouth: chewing, the smirk, talking on her words
    let open = 0;
    for (const w of [52.79, 53.05, 53.27]) open = Math.max(open, win(t, w - 0.02, w + 0.22, 0.06));
    open *= win(t, 52.72, 53.9, 0.05);
    let chew = 0;
    for (const c of CRUNCH) chew = Math.max(chew, win(t, c, c + 0.55, 0.05) * Math.abs(Math.sin((t - c) * 16)));
    m.mouths.talk.visible = open > 0.15 || chew > 0.4;
    m.mouths.talk.scale.set(1, 0.4 + 0.9 * Math.max(open, chew * 0.5), 0.35);
    m.mouths.smirk.visible = !m.mouths.talk.visible && t > T.brow - 0.4;
    m.mouths.smile.visible = !m.mouths.talk.visible && !m.mouths.smirk.visible;
  }

  // ---------------- dog ----------------
  const DOG_POS = { x: -0.59, z: -0.9 };
  function applyDog(t) {
    const d = dog;
    d.root.position.set(DOG_POS.x, WD.DOGHOUSE.floor, DOG_POS.z);
    d.root.rotation.y = 0.12;
    const awake = ramp(t, T.dogEyes, 0.12) * (1 - ramp(t, T.dogSleep2, 0.6));
    const asleep = 1 - awake;
    d.body.scale.set(1, 1 + (0.025 * asleep + 0.012 * awake) * Math.sin(t * (asleep > 0.5 ? 1.8 : 3.4)), 1);
    // head: on the paws asleep, up and looking about once awake
    let yaw = -0.35, pitch = 0.42 * asleep - 0.05 * awake, roll = 0.08 * asleep;
    if (awake > 0) {
      const ar = prog(t, T.dogEars + 0.15, 1.9);
      yaw += -0.55 * Math.sin(ar * Math.PI * 1.5) * (1 - ar) * awake;
      // suspicious stare at the floor once the spoon starts
      const sus = ramp(t, T.spoonSwap, 1.0) * (1 - ramp(t, T.popUp - 0.05, 0.12));
      yaw = lerp(yaw, -0.95, sus);
      pitch = lerp(pitch, 0.32, sus);
      // face to face with the kid
      const face = ramp(t, T.popUp, 0.15) * (1 - ramp(t, T.sink1, 0.4));
      yaw = lerp(yaw, -1.05, face);
      pitch = lerp(pitch, 0.08, face);
      // head tilt after he sinks
      const tl = win(t, T.sink1 - 0.1, T.dogSleep2 + 0.1, 0.25);
      roll = lerp(roll, 0.38, tl);
      yaw = lerp(yaw, -0.9, tl);
      pitch = lerp(pitch, 0.18, tl);
    }
    d.neck.rotation.set(pitch * 0.5, yaw * 0.5, roll * 0.4);
    d.head.rotation.set(pitch * 0.5, yaw * 0.5, roll * 0.6);
    // eyes: shut asleep, pop open, a slow blink during the stare
    const pop = easeOutBack(clamp(prog(t, T.dogEyes, 0.18)), 2.6);
    const slowBlink = win(t, T.popUp + 0.75, T.popUp + 1.3, 0.22);
    const quick = blinkAt(t, 3.1, 0.12, 7) * (t > T.dogEars + 2 && t < T.popUp ? 1 : 0);
    const open = clamp(pop * (1 - ramp(t, T.dogSleep2 + 0.1, 0.5)) - slowBlink - quick);
    const wide = clamp((t > T.dogEyes ? 1 - ramp(t, T.dogEyes + 0.5, 0.6) : 0) + 0.8 * win(t, T.popUp, T.sink1, 0.1));
    d.eyes.forEach((e) => setEye(e, open, 0.08 * awake, 0.05, wide));
    // ears: floppy down, perk up on "up", twitch at the pop
    const ears = easeOutBack(clamp(prog(t, T.dogEars, 0.22)), 2.4) * (1 - ramp(t, T.dogSleep2, 0.5));
    d.ears.forEach((ep, i) => {
      const s = i === 0 ? -1 : 1;
      ep.rotation.set(0, 0, s * (0.18 + 1.2 * ears + 0.12 * wobble(t, T.popUp + 0.1, 5, 6)) - s * 0.12 * asleep);
    });
    // tail: lazy sway asleep, a little wag at the stare
    d.tailG.rotation.y = 0.12 * Math.sin(t * 1.3) * asleep + 0.35 * Math.sin(t * 13) * win(t, T.popUp + 1.2, T.sink0, 0.2);
    // Zzz floating up while asleep
    d.zs.forEach((z, i) => {
      const per = 1.9, life = 2.6;
      const ph = (t + i * (per / 3)) % per;
      const born = t - ph;
      const u = ph / life;
      const ok = born > 0 && (born < T.dogEyes - 0.2 || born > T.dogSleep2 + 0.9) && u < 1;
      z.visible = ok;
      if (!ok) return;
      z.position.set(DOG_POS.x - 0.1 + 0.18 * u + 0.03 * Math.sin(u * 7), 0.62 + 0.75 * u, 0.06);
      z.scale.setScalar(0.55 + 0.75 * u);
      z.rotation.z = 0.25 * Math.sin(u * 4 + i);
      z.userData.mat.opacity = 0.75 * smooth(clamp(u * 5)) * (1 - smooth(clamp((u - 0.55) / 0.45)));
    });
  }

  return {
    update(t) {
      applyKid(t);
      applyMom(t);
      applyDog(t);
    },
    kid, mom, dog,
  };
}
