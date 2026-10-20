import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as U from './util.js';
import { T, FPS, DURATION, CAM } from './timeline.js';
import * as WD from './world.js';
import * as MAT from './materials.js';
import * as G from './geom.js';
import * as ENV from './env.js';
import * as KID from './kid.js';
import * as FAMILY from './family.js';
import * as PROPS from './props.js';

const { clamp, lerp, prog, popIn, smooth, easeOutCubic, bump } = U;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const SCALE = +(params.get('scale') || 1); // <1 for quick previews
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const { HOLE, LANE } = WD;

// ---------------------------------------------------------------------------
// renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // softness comes from jittering the lights between sub-frames
renderer.toneMapping = THREE.NoToneMapping; // the grade pass does the filmic (AgX) mapping
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0.5, 0.4, 0.4);

// ---------------------------------------------------------------------------
// shift-lens camera: looks straight down -z so verticals stay vertical; the
// frame is moved with an off-axis frustum (architectural look)
// ---------------------------------------------------------------------------
class ShiftCamera extends THREE.PerspectiveCamera {
  constructor() {
    super(30, W / H, 0.3, 900);
    this.fpx = 2600 * SCALE; // focal length in pixels
    this.vCenter = -800; // frame centre, pixels above the horizon line
    this.jx = 0;
    this.jy = 0;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    if (this.fpx === undefined) return super.updateProjectionMatrix();
    const n = this.near;
    const l = ((-W / 2 + this.jx) / this.fpx) * n, r = ((W / 2 + this.jx) / this.fpx) * n;
    const b = ((this.vCenter - H / 2 + this.jy) / this.fpx) * n, t = ((this.vCenter + H / 2 + this.jy) / this.fpx) * n;
    this.projectionMatrix.makePerspective(l, r, t, b, n, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}
const camera = new ShiftCamera();
// camera path (timeline.js CAM): monotone splines, so holds stay still and moves ease
const F = 2600;
const camTrack = {};
for (const k of ['cx', 'row', 's', 'cy']) camTrack[k] = U.monotone(CAM.map((c) => [c.t, k === 's' ? Math.log(c[k]) : c[k]]));
export function camAt(t) {
  return { cx: camTrack.cx(t), row: camTrack.row(t), s: Math.exp(camTrack.s(t)), cy: camTrack.cy(t) };
}
function updateCamera(t) {
  const c = camAt(t);
  const cz = F / c.s;
  camera.position.set(c.cx, c.cy, cz);
  camera.fpx = F * SCALE;
  const vLawn = (-camera.fpx * c.cy) / cz;
  camera.vCenter = vLawn + (c.row * SCALE - H / 2);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// golden hour: a low warm sun from the front left (long soft shadows to the
// back right), a cool occluded sky light, a little warm bounce. The storm in
// scene 3 hides the sun and turns the sky light grey.
// ---------------------------------------------------------------------------
const SUN_DIR = V(-0.6, 0.34, 0.72).normalize();
const LIGHT_TARGET = V(1.2, 0.0, -3.0);
const SUN_COL = new THREE.Color(1.0, 0.64, 0.36);
const SUN_I = 3.3;
const sun = new THREE.DirectionalLight(SUN_COL.clone(), SUN_I);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 90 });
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.02;
sun.target.position.copy(LIGHT_TARGET);
scene.add(sun, sun.target);

const SKY_COL = new THREE.Color(0.36, 0.46, 0.95), STORM_SKY = new THREE.Color(0.62, 0.68, 0.8);
const SKY_I = 0.95;
const skyL = new THREE.DirectionalLight(SKY_COL.clone(), SKY_I);
skyL.castShadow = true;
skyL.shadow.mapSize.set(1024, 1024);
Object.assign(skyL.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 100 });
skyL.shadow.bias = -0.0004;
skyL.shadow.normalBias = 0.025;
skyL.target.position.copy(LIGHT_TARGET);
scene.add(skyL, skyL.target);

const HEMI_SKY = new THREE.Color(0.42, 0.45, 0.7), HEMI_GND = new THREE.Color(0.32, 0.22, 0.12);
const hemi = new THREE.HemisphereLight(HEMI_SKY.clone(), HEMI_GND.clone(), 0.32);
scene.add(hemi);
const fill = new THREE.DirectionalLight(new THREE.Color(1.0, 0.72, 0.5), 0.2); // warm bounce from the front right
fill.position.set(0.55, 0.25, 1).multiplyScalar(40);
scene.add(fill);

const SKY_DIRS = [];
for (let i = 0; i < 32; i++) {
  const u = U.halton(i + 1, 2), v = U.halton(i + 1, 3);
  const phi = u * Math.PI * 2;
  const ct = Math.sqrt(1 - v * 0.9);
  const st = Math.sqrt(1 - ct * ct);
  const d = V(Math.cos(phi) * st, ct, Math.sin(phi) * st);
  d.z = Math.abs(d.z) * 0.85 + 0.15 * d.z; // most sky reaching the diorama comes from the front
  SKY_DIRS.push(d.normalize());
}

// environments for reflections (metal box, detector, glasses, eyes): the golden
// sky and the storm. Shiny materials go in ctx.envMats; the accumulation dithers
// between the two maps over the sub-frames while the storm comes and goes.
function makeEnvMap(storm) {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: SUN_DIR }, storm: { value: storm } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sunDir; uniform float storm;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 zen = vec3(0.12, 0.2, 0.52), mid = vec3(0.62, 0.48, 0.62), hor = vec3(1.7, 0.86, 0.42), gnd = vec3(0.1, 0.12, 0.05);
        vec3 c = h > 0.0 ? mix(mix(hor, mid, smoothstep(0.0, 0.25, h)), zen, smoothstep(0.2, 0.9, h)) : mix(hor * 0.4, gnd, smoothstep(0.0, 0.3, -h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(30.0, 18.0, 9.0) * pow(s, 1800.0) + vec3(1.2, 0.6, 0.25) * pow(s, 12.0);
        vec3 st = h > 0.0 ? mix(vec3(0.32, 0.34, 0.38), vec3(0.2, 0.22, 0.26), h) : vec3(0.06, 0.07, 0.06);
        gl_FragColor = vec4(mix(c, st, storm), 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), m));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
}
const envMap = makeEnvMap(0);
const stormEnv = makeEnvMap(1);
const envMats = [];

// ---------------------------------------------------------------------------
// helpers shared with the modules
// ---------------------------------------------------------------------------
const mesh = (g, m, cast = true, recv = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = recv;
  if (m.userData?.depth) o.customDepthMaterial = m.userData.depth;
  return o;
};
const add = (o, cast = true, recv = true) => {
  o.traverse?.((c) => {
    if (c.isMesh) {
      if (c.userData.cast === undefined) c.castShadow = cast;
      c.receiveShadow = recv;
      if (c.material?.userData?.depth) c.customDepthMaterial = c.material.userData.depth;
    }
  });
  scene.add(o);
  return o;
};
function instanced(geom, mat, count, cast = true) {
  const m = new THREE.InstancedMesh(geom, mat, count);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.userData.n = 0;
  m.userData.cap = count;
  scene.add(m);
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function beginInst(im) {
  im.userData.n = 0;
}
function setInst(im, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  if (!(sx > 1e-4 && sy > 1e-4 && sz > 1e-4) || im.userData.n >= im.userData.cap) return -1;
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  const i = im.userData.n++;
  im.setMatrixAt(i, _m4);
  return i;
}
function endInst(im) {
  im.count = im.userData.n;
  im.visible = im.userData.n > 0;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
}
const quad = (w, h) => new THREE.PlaneGeometry(w, h);
// additive glow sprite on a unit plane: a soft round dot (or a ring with ring > 0)
function glowMat(color, { ring = 0, width = 0.18 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uC: { value: color }, uA: { value: 1 }, uRing: { value: ring }, uW: { value: width } },
    vertexShader: `varying vec2 vUv;
      void main(){ vUv = uv * 2.0 - 1.0;
        #ifdef USE_INSTANCING
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        #else
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #endif
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uA, uRing, uW; varying vec2 vUv;
      void main(){ float r = length(vUv);
        float g = uRing > 0.0 ? exp(-pow((r - uRing) / uW, 2.0) * 2.0) : exp(-r * r * 5.5) + 0.35 * exp(-r * r * 1.4);
        g *= 1.0 - smoothstep(0.85, 1.0, r);
        gl_FragColor = vec4(uC * g * uA, 1.0); }`,
  });
}

// ---------------------------------------------------------------------------
// ground: the soil cut face (baked strata), the lawn, the hole's walls and the
// top of whatever loose dirt or mud is in it
// ---------------------------------------------------------------------------
const SOIL = MAT.bakeSoil(renderer, FullScreenQuad);
const HU = MAT.HOLE_U;
HU.uHole.value.set(HOLE.x, HOLE.hw0, HOLE.hw1, HOLE.DEEP);
HU.uHoleS.value.w = HOLE.round;
HU.uHoleW.value = HOLE.W;
const soilMat = MAT.soilFrontMaterial(SOIL);
{
  const r = SOIL.rect;
  // the cut face and the lawn cast no shadows: the sun reaches into the open hole
  // through the cut (diorama logic), only the hole's own walls shade it
  scene.add(mesh(G.placed(quad(r.z - r.x, -r.y), (r.x + r.z) / 2, r.y / 2, 0), soilMat, false));
}
const lawnMat = MAT.lawnMaterial();
scene.add(mesh(G.placed(quad(36, 18), 1, 0, -9, -Math.PI / 2, 0, 0), lawnMat, false));
const wallMat = MAT.holeWallMaterial();
{
  const { hw0, hw1, W: HW, DEEP } = HOLE;
  const bottom = -DEEP - 0.12;
  // the walls cast no shadows either (the low sun would black out the whole hole);
  // the wall shader fakes the shading instead
  scene.add(mesh(G.placed(quad(2 * hw0 + 0.04, -bottom), HOLE.x, bottom / 2, -HW), wallMat, false));
  // side walls, slanting in a little towards the bottom, normals pointing into the hole
  for (const sd of [-1, 1]) {
    const xt = HOLE.x + sd * hw0, xb = HOLE.x + sd * (hw0 + (hw1 - hw0) * (-bottom / DEEP));
    const pos = [xt, 0.02, -HW, xt, 0.02, 0, xb, bottom, 0, xt, 0.02, -HW, xb, bottom, 0, xb, bottom, -HW];
    const nx = -sd, ny = (-sd * (xt - xb)) / -bottom;
    const l = Math.hypot(nx, ny);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [nx / l, ny / l, 0]).flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12), 2));
    const m = mesh(g, wallMat, false);
    scene.add(m);
  }
  wallMat.side = THREE.DoubleSide;
}
// top of the loose dirt / mud in the open hole: a strip across x that follows the
// rounded bottom, from the back wall to the cut face
const FT_N = 18;
const fillTop = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(FT_N * 18), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(FT_N * 18), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(FT_N * 12), 2));
  const m = mesh(g, MAT.fillTopMaterial());
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();
function updateHole(t) {
  const ft = WD.fillTop(t), dd = WD.dugD(t);
  HU.uHoleS.value.set(ft, dd, WD.mudK(t), HOLE.round);
  HU.uWet.value.set(WD.wetD(t), t < T.soak0 ? 0 : WD.wetK(t), t, WD.patchK(t));
  HU.uRain.value = WD.rainK(t);
  fillTop.visible = ft > 0.004;
  if (!fillTop.visible) return;
  const P = fillTop.geometry.attributes.position.array, N = fillTop.geometry.attributes.normal.array;
  const hw = WD.holeHW(ft) + 0.01;
  const yAt = (x) => -Math.min(ft, WD.holeBottom(x, dd));
  let o = 0;
  for (let i = 0; i < FT_N; i++) {
    const xa = HOLE.x - hw + (2 * hw * i) / FT_N, xb = HOLE.x - hw + (2 * hw * (i + 1)) / FT_N;
    const ya = yAt(xa), yb = yAt(xb);
    const l = Math.hypot(xb - xa, yb - ya), nx = -(yb - ya) / l, ny = (xb - xa) / l;
    for (const [x, y, z] of [[xa, ya, 0], [xb, yb, 0], [xb, yb, -HOLE.W], [xa, ya, 0], [xb, yb, -HOLE.W], [xa, ya, -HOLE.W]]) {
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      N[o] = nx; N[o + 1] = ny; N[o + 2] = 0;
      o += 3;
    }
  }
  fillTop.geometry.attributes.position.needsUpdate = true;
  fillTop.geometry.attributes.normal.needsUpdate = true;
}

// the lump (scene 5): a dome of fresh dirt over the patch, pressed flat by the roller
const moundMat = MAT.patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), {
  uniforms: { ...HU }, key: 'mound',
  extraFrag: MAT.GLSL_HOLE + `
    vec3 mdColor(vec3 p, vec3 n){ float h, r; return looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r) * (0.9 + 0.25 * clamp(p.y * 8.0, 0.0, 1.0)); }
    float mdBump(vec3 p, vec3 n){ float h, r; looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r); return h; }`,
  colorFn: 'mdColor', bumpFn: 'mdBump',
});
const MD_N = 22;
const mound = (() => {
  const { rx, rz } = WD.MOUND;
  const g = new THREE.PlaneGeometry(2 * rx, 2 * rz, MD_N, MD_N);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + WD.MOUND.x, 0, Math.min(-0.002, p.getZ(i) + WD.MOUND.z));
  const m = mesh(g, moundMat);
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();
function updateMound(t) {
  const h = WD.lumpH(t);
  mound.visible = h > 0.002 && t < T.dadDig0;
  if (!mound.visible) return;
  const p = mound.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, WD.groundY(p.getX(i), p.getZ(i), t) + 0.003);
  p.needsUpdate = true;
  mound.geometry.computeVertexNormals();
}

// ---------------------------------------------------------------------------
// digging effects: dirt chunks, dust puffs, the piles, Dad's dust cloud
// ---------------------------------------------------------------------------
const dirtMat = MAT.patch(MAT.std('#5c3d25', 0.95), {
  colorFn: 'dirtCol', bumpFn: 'dirtBump', key: 'dirt',
  extraFrag: `vec3 dirtCol(vec3 p, vec3 n){ return mix(vec3(0.62), vec3(1.15), vnoise3(p * 9.0)) * (0.85 + 0.3 * vnoise3(p * 31.0)); }
    float dirtBump(vec3 p, vec3 n){ return 0.01 * vnoise3(p * 14.0) + 0.004 * vnoise3(p * 40.0); }`,
});
const chunkGeo = G.lumpyBlob(1, 1, 0.32, 7);
const chunks = instanced(chunkGeo, dirtMat, 220);
// dust: soft lit blobs that fade out towards their silhouette, so they read as clouds
function softMat(color, opacity, key) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, transparent: true, opacity, depthWrite: false });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      '{ float f = abs(dot(normalize(normal), normalize(vViewPosition))); diffuseColor.a *= pow(smoothstep(0.0, 0.95, f), 2.4); }\n#include <opaque_fragment>'
    );
  };
  m.customProgramCacheKey = () => key;
  return m;
}
const puffMat = softMat(new THREE.Color(0.5, 0.38, 0.26), 0.32, 'puff');
const puffGeo = G.lumpyBlob(1, 2, 0.22, 3);
const puffs = instanced(puffGeo, puffMat, 120, false);
const cloudMat = softMat(new THREE.Color(0.6, 0.47, 0.33), 0.85, 'cloud');
const cloud = instanced(G.lumpyBlob(1, 2, 0.2, 21), cloudMat, 60, false);
const pile = mesh(G.lumpyBlob(1, 3, 0.16, 11), dirtMat);
scene.add(pile);
const dadPile = mesh(G.lumpyBlob(1, 3, 0.18, 17), dirtMat);
scene.add(dadPile);
const rnd = U.mulberry32(1234);
const SCOOPS = WD.SCOOPS.map((s) => ({ ...s, parts: Array.from({ length: s.kind === 'pour' ? 12 : s.kind === 'dad' ? 6 : 5 }, () => ({ a: rnd(), b: rnd(), c: rnd(), d: rnd() })) }));
function updateDirt(t) {
  beginInst(chunks);
  beginInst(puffs);
  const holeTop = (tt) => -WD.fillTop(tt);
  for (const s of SCOOPS) {
    const dt = t - s.t;
    if (dt < 0 || dt > 1.6) continue;
    for (const q of s.parts) {
      let x0, y0, z0, x1, y1, z1, T0, hgt, sc = 0.05 + 0.04 * q.a;
      if (s.kind === 'out' || s.kind === 'deep') {
        // from the hole up over the kid's shoulder onto the pile
        x0 = HOLE.x + (q.b - 0.5) * 0.3; y0 = holeTop(s.t) + 0.12; z0 = LANE + (q.c - 0.5) * 0.3;
        x1 = WD.PILE.x + (q.b - 0.5) * 0.45; y1 = 0.06 + 0.3 * WD.pileK(s.t + 0.6); z1 = WD.PILE.z + (q.c - 0.5) * 0.4;
        T0 = (s.kind === 'deep' ? 0.85 : 0.62) + 0.15 * q.d;
        hgt = (s.kind === 'deep' ? 1.0 : 0.75) + 0.3 * q.a;
      } else if (s.kind === 'in' || s.kind === 'pour') {
        // from the pile into the hole (the pour tumbles down the deep hole)
        x0 = WD.PILE.x - 0.2 + (q.b - 0.5) * 0.4; y0 = 0.15 + 0.15 * q.d; z0 = WD.PILE.z + (q.c - 0.5) * 0.3;
        x1 = HOLE.x + (q.b - 0.5) * 0.36; y1 = holeTop(s.t + 0.5) + 0.03; z1 = LANE + (q.c - 0.5) * 0.36;
        T0 = s.kind === 'pour' ? 0.5 + 0.25 * q.a : 0.5;
        hgt = s.kind === 'pour' ? 0.15 : 0.35;
        sc = s.kind === 'pour' ? 0.06 + 0.06 * q.a : sc;
      } else if (s.kind === 'paw') {
        // the dog's front paws spray it back between its legs to the left
        x0 = HOLE.x - 0.2; y0 = holeTop(s.t) + 0.08; z0 = LANE + (q.c - 0.5) * 0.25;
        x1 = HOLE.x - 0.95 - 0.7 * q.b; y1 = 0.02; z1 = LANE + (q.c - 0.5) * 0.6;
        T0 = 0.45 + 0.15 * q.d; hgt = 0.3 + 0.25 * q.a; sc = 0.03 + 0.03 * q.a;
      } else {
        // Dad's flurry: everywhere, mostly onto his pile on the left
        const left = q.b < 0.75;
        x0 = HOLE.x + (q.c - 0.5) * 0.3; y0 = holeTop(s.t) + 0.1; z0 = LANE + (q.d - 0.5) * 0.3;
        x1 = left ? WD.DAD_PILE.x + (q.c - 0.5) * 0.5 : 1.3 + q.c * 0.6; y1 = 0.05; z1 = (left ? WD.DAD_PILE.z : -0.5) + (q.d - 0.5) * 0.5;
        T0 = 0.55 + 0.2 * q.a; hgt = 0.9 + 0.5 * q.a;
      }
      const u = clamp(dt / T0);
      const x = lerp(x0, x1, u), z = lerp(z0, z1, u);
      // a parabola through both ends that peaks hgt above the higher one
      const top = Math.max(y0, y1) + hgt;
      const y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * (2 * top - (y0 + y1) / 2) + u * u * y1;
      const k = dt < T0 ? smooth(clamp(dt / 0.08)) : 1 - smooth(clamp((dt - T0) / 0.3));
      setInst(chunks, x, y, z, sc * k, sc * 0.8 * k, sc * k, q.a * 9 + dt * 7, q.b * 9, q.c * 9);
      if (dt > T0 && dt < T0 + 0.6 && q.a < 0.6) {
        const pu = (dt - T0) / 0.6;
        const ps = (0.04 + 0.13 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.5) / 0.5)));
        setInst(puffs, x1, Math.max(y1, 0) + 0.04 + 0.08 * pu, z1, ps, ps * 0.7, ps, 0, q.a * 6, 0);
      }
    }
  }
  // a puff where each scoop bites
  for (const s of SCOOPS) {
    if (s.kind === 'in' || s.kind === 'pour') continue;
    const pu = (t - s.t + 0.12) / 0.55;
    if (pu < 0 || pu > 1) continue;
    const ps = (0.05 + 0.12 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.45) / 0.55)));
    setInst(puffs, HOLE.x + (s.kind === 'paw' ? -0.2 : 0), -WD.fillTop(s.t) + 0.06, LANE + 0.05, ps, ps * 0.6, ps);
  }
  endInst(chunks);
  endInst(puffs);
  const k = WD.pileK(t);
  pile.visible = k > 0.01;
  pile.scale.set(0.16 + 0.32 * k, Math.max(0.01, 0.3 * k), 0.14 + 0.26 * k);
  pile.position.set(WD.PILE.x, -0.03, WD.PILE.z);
  const kd = WD.dadPileK(t);
  dadPile.visible = kd > 0.01;
  dadPile.scale.set(0.16 + 0.3 * kd, Math.max(0.01, 0.27 * kd), 0.14 + 0.24 * kd);
  dadPile.position.set(WD.DAD_PILE.x, -0.03, WD.DAD_PILE.z);
  // Dad's flurry: a big swirling cartoon dust cloud that hides the impossible part
  beginInst(cloud);
  const c0 = T.dadDig0 + 0.1, c1 = T.boxUp;
  if (t > c0 && t < c1 + 0.6) {
    const grow = smooth(prog(t, c0, 0.35)), fade = 1 - smooth(prog(t, c1 - 0.15, 0.7));
    for (let i = 0; i < 46; i++) {
      // puffs tumbling round the dig on a few rings, bigger in the middle
      const a = (i / 46) * Math.PI * 2 * 3 + t * (2.4 + 0.8 * U.hash1(i)) * (i % 2 ? 1 : -1);
      const ring = 0.25 + 0.45 * U.hash1(i + 3);
      const x = 0.4 + Math.cos(a) * ring * 1.15;
      const y = 0.75 + Math.sin(a * 1.3 + i) * (0.55 - 0.3 * ring) + 0.25 * (U.hash1(i + 9) - 0.5);
      const z = LANE + 0.05 + Math.sin(a) * 0.3;
      const sc = (0.13 + 0.15 * U.hash1(i + 5)) * (1.25 - 0.5 * ring) * grow * (1 + 0.1 * Math.sin(t * 9 + i)) * (0.4 + 0.6 * fade);
      if (fade > 0.02) setInst(cloud, x, Math.max(0.06, y + (1 - fade) * 0.3), z, sc, sc * 0.9, sc, 0, a, 0);
    }
  }
  endInst(cloud);
  cloudMat.opacity = 0.92 * (1 - smooth(prog(t, c1 - 0.1, 0.6)));
}

// ---------------------------------------------------------------------------
// rain: falling streaks behind the cut plane, little splashes on the lawn
// ---------------------------------------------------------------------------
const rainMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uA; varying vec2 vUv;
    void main(){ float a = smoothstep(0.0, 0.7, vUv.y) * (1.0 - smoothstep(0.92, 1.0, vUv.y)) * (1.0 - pow(abs(vUv.x * 2.0 - 1.0), 2.0));
      gl_FragColor = vec4(vec3(0.62, 0.7, 0.85) * a * uA, 1.0); }`,
});
const RAIN_N = 1500;
const rain = instanced(new THREE.PlaneGeometry(0.008, 0.34), rainMat, RAIN_N, false);
const RAIN = Array.from({ length: RAIN_N }, () => ({ x: rnd(), y: rnd(), z: rnd(), v: 0.85 + 0.3 * rnd() }));
const splashMat = glowMat(new THREE.Color(0.55, 0.62, 0.75), { ring: 0.6, width: 0.16 });
const splashes = instanced(new THREE.PlaneGeometry(1, 1), splashMat, 160, false);
const SPL = Array.from({ length: 160 }, () => ({ x: rnd(), z: rnd(), p: rnd() }));
function updateRain(t) {
  const k = WD.rainK(t);
  rainMat.uniforms.uA.value = 0.5 * k;
  splashMat.uniforms.uA.value = 0.5 * k;
  beginInst(rain);
  beginInst(splashes);
  if (k > 0.001) {
    const c = camAt(t);
    const span = 1080 / c.s + 3;
    const x0 = c.cx - span / 2;
    const yTop = 5.5 + (c.cy - 2.4) * 0.5;
    for (const r of RAIN) {
      const z = -0.05 - r.z * 9;
      const y = yTop - ((((t * 7.2 * r.v + r.y * yTop) % yTop) + yTop) % yTop);
      const x = x0 + r.x * span * (1 + -z * 0.08) + (yTop - y) * 0.12;
      if (y < 0.1) continue;
      setInst(rain, x, y, z, 1, 1 + 0.4 * r.v, 1, 0, 0, 0.12);
    }
    for (const s of SPL) {
      const per = 0.45;
      const ph = ((t + s.p * per) % per) / per;
      const x = c.cx + (s.x - 0.5) * (span - 2), z = -0.08 - s.z * 4.0;
      if (Math.abs(x - HOLE.x) < HOLE.hw0 + 0.05 && z > -HOLE.W - 0.05) continue;
      const sc = 0.02 + 0.07 * easeOutCubic(ph);
      setInst(splashes, x, 0.012, z, sc * (1 - ph * 0.3), sc, 1, -Math.PI / 2, 0, 0);
    }
  }
  endInst(rain);
  endInst(splashes);
}

// ---------------------------------------------------------------------------
// water soaking down through the soil: glowing blue dots on the cut face; near
// the hole they are drawn into the loose dirt, which turns to mud
// ---------------------------------------------------------------------------
const dotMat = glowMat(new THREE.Color(0.35, 0.75, 1.6));
const DOT_N = 260;
const dots = instanced(new THREE.PlaneGeometry(1, 1), dotMat, DOT_N, false);
const DOTS = Array.from({ length: DOT_N }, () => ({ x: (rnd() - 0.5) * 6, t0: rnd(), v: 0.8 + 0.6 * rnd(), w: rnd() * 6.28, s: 0.6 + 0.6 * rnd() }));
function updateDots(t) {
  beginInst(dots);
  const fade = 1 - smooth(prog(t, T.mud1 + 0.6, 1.0));
  if (t > T.soak0 && fade > 0) {
    const c = camAt(t);
    for (const d of DOTS) {
      const dt = t - (T.soak0 + d.t0 * 1.1);
      if (dt < 0) continue;
      const depth = dt * 1.7 * d.v;
      if (depth > 3.2) continue;
      const x0 = c.cx + d.x;
      // drawn sideways into the hole as they sink
      const near = Math.exp(-Math.pow((x0 - HOLE.x) / 1.0, 2));
      const x = lerp(x0, HOLE.x + (x0 - HOLE.x) * 0.25, near * smooth(clamp(depth / 1.2))) + 0.03 * Math.sin(dt * 5 + d.w);
      const a = smooth(clamp(dt / 0.2)) * (1 - smooth(clamp((depth - 2.4) / 0.8))) * fade;
      const sc = 0.055 * d.s * a;
      setInst(dots, x, -0.04 - depth, 0.006, sc, sc * 1.25, 1);
    }
  }
  endInst(dots);
}

// ---------------------------------------------------------------------------
// worms: little pink worms half sunk into the cut face, slowly wiggling (more in
// the rain, when they wriggle up a bit)
// ---------------------------------------------------------------------------
const WORMS = [[-1.25, -0.62, 0.2], [1.05, -1.38, -0.3], [-0.95, -1.95, 0.1], [1.75, -0.72, 2.9], [-2.05, -1.32, 3.3], [0.82, -2.75, 0.4], [-1.6, -2.9, 2.8]];
const wormU = { uT: { value: 0 }, uRain: { value: 0 } };
const wormList = WORMS.map(([x, y, rot], i) => {
  const L = 0.19, R = 0.0145, NS = 40, NR = 10;
  const g = new THREE.CylinderGeometry(1, 1, 1, NR, NS, false);
  g.rotateZ(Math.PI / 2); // along x, from -0.5 to 0.5
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const u = p.getX(k) + 0.5;
    const taper = Math.pow(Math.sin(Math.PI * clamp(u * 0.94 + 0.03)), 0.45) * (1 + 0.12 * Math.max(0, 1 - Math.abs(u - 0.32) / 0.07)); // a little band (the saddle)
    p.setXYZ(k, (u - 0.5) * L, p.getY(k) * R * taper, p.getZ(k) * R * taper);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.75, 0.26, 0.27), roughness: 0.35 });
  const u = { ...wormU, uPh: { value: i * 1.7 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT, uRain, uPh;\nvarying float vU;')
      .replace('#include <begin_vertex>', `vec3 transformed = position;
        float s = position.x / ${L.toFixed(3)};
        float sp = 1.0 + 1.6 * uRain;
        transformed.y += (0.018 + 0.01 * uRain) * sin(s * 9.0 - uT * 2.4 * sp + uPh);
        transformed.x += 0.008 * sin(uT * 1.3 * sp + uPh) * (s + 0.5);
        vU = s;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vU;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.86 + 0.14 * smoothstep(0.2, 0.8, abs(fract(vU * 26.0) - 0.5) * 2.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.24, 0.24), 1.0 - smoothstep(0.03, 0.08, abs(vU + 0.18)));`);
  };
  m.customProgramCacheKey = () => 'worm';
  const w = new THREE.Mesh(g, m);
  w.position.set(x, y, 0.0);
  w.rotation.z = rot;
  w.castShadow = false;
  w.receiveShadow = true;
  scene.add(w);
  return { w, x, y };
});
function updateWorms(t) {
  wormU.uT.value = t;
  wormU.uRain.value = WD.wetK(t) * smooth(prog(t, T.soak0 + 0.4, 0.8)) * (1 - smooth(prog(t, T.dry0, 2.0)));
  for (const o of wormList) o.w.position.y = o.y + 0.05 * wormU.uRain.value;
}

// ---------------------------------------------------------------------------
// glowing "invisible things": the dog's paw reach (a dashed line + a paw print
// in the cut face), the suspicious patch outline, the perfectly-flat twinkle
// ---------------------------------------------------------------------------
const pawMat = glowMat(new THREE.Color(0.55, 0.95, 1.5));
const paw = instanced(new THREE.PlaneGeometry(1, 1), pawMat, 40, false);
function updatePaw(t) {
  beginInst(paw);
  const out = 1 - smooth(prog(t, T.refill0 - 0.2, 0.4));
  const k = popIn(t, T.pawLine, 0.4, 2.2) * out;
  if (k > 0.01) {
    const y = -HOLE.PAW - 0.02;
    const n = 13;
    for (let i = 0; i < n; i++) {
      const x = HOLE.x - 0.62 + (i / (n - 1)) * 1.24;
      const ki = clamp(k * 1.6 - (i / n) * 0.6);
      setInst(paw, x, y, 0.008, 0.07 * ki, 0.03 * ki, 1);
    }
    // a paw print just left of the line: a pad and four toes
    const px = HOLE.x - 0.88, py = y;
    const pk = popIn(t, T.pawLine + 0.15, 0.4, 2.5) * out;
    setInst(paw, px, py - 0.02, 0.008, 0.11 * pk, 0.095 * pk, 1);
    for (const [dx, dy] of [[-0.055, 0.055], [-0.02, 0.08], [0.02, 0.08], [0.055, 0.055]]) setInst(paw, px + dx, py + dy, 0.008, 0.05 * pk, 0.055 * pk, 1);
  }
  endInst(paw);
  pawMat.uniforms.uA.value = 0.9 + 0.1 * Math.sin(t * 5);
}
// outline round the patch: a soft glowing rounded rectangle on the lawn
const susMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 0 }, uC: { value: new THREE.Color(1.6, 0.85, 0.3) } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uA; uniform vec3 uC; varying vec2 vP;
    void main(){ vec2 q = abs(vP) - vec2(${(HOLE.hw0 + 0.03).toFixed(3)}, ${(HOLE.W / 2 + 0.03).toFixed(3)}) + 0.06;
      float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.06;
      float g = exp(-pow(d / 0.025, 2.0)) + 0.3 * exp(-pow(d / 0.08, 2.0));
      gl_FragColor = vec4(uC * g * uA, 1.0); }`,
});
const sus = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), susMat);
sus.rotation.x = -Math.PI / 2;
sus.position.set(HOLE.x, 0.01, -HOLE.W / 2);
sus.renderOrder = 5;
scene.add(sus);
// four-point twinkle
const twMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uA: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uA; varying vec2 vUv;
    void main(){ vec2 a = abs(vUv); float g = exp(-a.x * 22.0) * exp(-a.y * 3.0) + exp(-a.y * 22.0) * exp(-a.x * 3.0) + 0.6 * exp(-dot(vUv, vUv) * 18.0);
      gl_FragColor = vec4(vec3(1.6, 1.4, 1.0) * g * uA, 1.0); }`,
});
const twinkle = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), twMat);
twinkle.renderOrder = 6;
scene.add(twinkle);
function updateGlows(t) {
  const p1 = bump(t, T.sus - 0.1, T.sus + 0.55, 0.12), p2 = bump(t, T.sus + 0.65, T.sus + 1.35, 0.15);
  susMat.uniforms.uA.value = 0.9 * Math.max(p1, p2 * 0.8);
  sus.visible = susMat.uniforms.uA.value > 0.003;
  const k = popIn(t, T.sparkle, 0.25, 2.5) * (1 - smooth(prog(t, T.sparkle + 0.4, 0.4)));
  twMat.uniforms.uA.value = k;
  twinkle.visible = k > 0.003;
  twinkle.position.set(HOLE.x + 0.18, 0.12, LANE + 0.2);
  twinkle.rotation.z = t * 1.5;
  twinkle.scale.setScalar(0.6 + 0.6 * k);
}

// ---------------------------------------------------------------------------
// modules: the world's dressing, the characters, the props
// ---------------------------------------------------------------------------
const ctx = {
  THREE, scene, renderer, camera, envMap, stormEnv, envMats, SCALE, T, WD, MAT, G, U, add, mesh, instanced, beginInst, setInst, endInst, sun, camAt,
  anchors: {}, // characters.js registers hand / mouth / head anchors here at build time
  buried: [null, null], // props.js: {x, y, hw, hh} of things buried flush with the cut face
  FX: { dirtMat, chunkGeo, puffMat, puffGeo, glowMat },
};
const modules = [ENV.build(ctx), KID.build(ctx), FAMILY.build(ctx), PROPS.build(ctx)];

const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, sat: { value: 1.1 }, punch: { value: 1.0 }, vig: { value: 0.22 }, warm: { value: 1.0 }, lift: { value: new THREE.Vector3(0.006, 0.004, 0.008) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, punch, vig, warm; uniform vec3 lift; varying vec2 vUv;
    const mat3 R2S = mat3(vec3(1.6605,-0.1246,-0.0182), vec3(-0.5876,1.1329,-0.1006), vec3(-0.0728,-0.0083,1.1187));
    const mat3 S2R = mat3(vec3(0.6274,0.0691,0.0164), vec3(0.3293,0.9195,0.0880), vec3(0.0433,0.0113,0.8956));
    const mat3 INSET = mat3(vec3(0.856627153315983,0.137318972929847,0.11189821299995), vec3(0.0951212405381588,0.761241990602591,0.0767994186031903), vec3(0.0482516061458583,0.101439036467562,0.811302368396859));
    const mat3 OUTSET = mat3(vec3(1.1271005818144368,-0.1413297634984383,-0.14132976349843826), vec3(-0.11060664309660323,1.157823702216272,-0.11060664309660294), vec3(-0.016493938717834573,-0.016493938717834257,1.2519364065950405));
    vec3 curve(vec3 x){ vec3 x2 = x*x, x4 = x2*x2; return 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
    vec3 agx(vec3 c){
      c = INSET * (S2R * c);
      c = clamp((log2(max(c, 1e-10)) + 12.47393) / 16.499999, 0.0, 1.0);
      c = curve(c);
      c = pow(max(c, 0.0), vec3(punch));
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = l + sat * (c - l);
      c = OUTSET * c;
      c = pow(max(vec3(0.0), c), vec3(2.2));
      return clamp(R2S * c, 0.0, 1.0);
    }
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec3 c = agx(texture2D(tDiffuse, vUv).rgb * exposure) + lift;
      // golden-hour split: warm highlights, a touch of teal in the shadows
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c *= mix(vec3(1.0), mix(vec3(0.97, 1.0, 1.04), vec3(1.04, 1.0, 0.94), smoothstep(0.1, 0.7, l)), warm);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.62);
      c *= 1.0 - vig * smoothstep(0.18, 0.66, length(q));
      vec3 o = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      o += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(o, 1.0);
    }`,
});

// golden hour <-> storm
function updateLights(t) {
  const s = WD.storm(t);
  sun.intensity = SUN_I * (1 - 0.94 * s);
  skyL.color.copy(SKY_COL).lerp(STORM_SKY, s);
  skyL.intensity = SKY_I * (1 + 1.3 * s);
  hemi.color.copy(HEMI_SKY).lerp(STORM_SKY, s);
  hemi.intensity = 0.32 + 0.5 * s;
  fill.intensity = 0.2 * (1 - 0.3 * s);
  grade.uniforms.exposure.value = 1.0 + 0.12 * s;
  grade.uniforms.sat.value = 1.1 - 0.42 * s;
  grade.uniforms.warm.value = 1 - s;
}

function update(t) {
  updateHole(t);
  updateMound(t);
  for (const m of modules) m?.update?.(t);
  updateDirt(t);
  updateRain(t);
  updateDots(t);
  updateWorms(t);
  updatePaw(t);
  updateGlows(t);
  for (let i = 0; i < 2; i++) {
    const b = ctx.buried[i];
    HU.uBury.value[i].set(b ? b.x : 0, b ? b.y : 0, b ? b.hw : 0, b ? b.hh : 0);
  }
  updateLights(t);
}

// ---------------------------------------------------------------------------
// accumulation renderer (Eevee-style): sub-pixel jitter, soft sunlight,
// occluded sky light and motion blur are averaged over N sub-frames
// ---------------------------------------------------------------------------
class AccumPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true });
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tex: { value: null }, w: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
        // a NaN or Inf from any material must never blank the frame (bloom would spread it)
        fragmentShader: `uniform sampler2D tex; uniform float w; varying vec2 vUv;
          void main(){ vec3 c = texture2D(tex, vUv).rgb;
            if (!(c.r == c.r && c.g == c.g && c.b == c.b) || max(c.r, max(c.g, c.b)) > 6.0e4) c = vec3(0.0);
            gl_FragColor = vec4(min(c, vec3(512.0)) * w, 1.0); }`,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthTest: false,
        depthWrite: false,
      })
    );
    this.frameTime = 0;
    this.spp = 8;
  }
  render(renderer, writeBuffer, readBuffer) {
    const N = this.spp;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(readBuffer);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    const shutter = 0.5 / FPS;
    const tang = V(-SUN_DIR.z, 0, SUN_DIR.x).normalize();
    const bit = SUN_DIR.clone().cross(tang).normalize();
    const f0 = Math.round(this.frameTime * FPS);
    for (let s = 0; s < N; s++) {
      const ts = this.frameTime + ((s + 0.5) / N - 0.5) * shutter;
      update(ts);
      updateCamera(ts);
      camera.jx = U.halton(s + 1, 2) - 0.5;
      camera.jy = U.halton(s + 1, 3) - 0.5;
      camera.updateProjectionMatrix();
      const a = U.halton(s + 1, 5) * Math.PI * 2, r = Math.sqrt(U.halton(s + 1, 7)) * 0.04;
      const d = SUN_DIR.clone().addScaledVector(tang, Math.cos(a) * r).addScaledVector(bit, Math.sin(a) * r).normalize();
      sun.position.copy(LIGHT_TARGET).addScaledVector(d, 60);
      skyL.position.copy(LIGHT_TARGET).addScaledVector(SKY_DIRS[(s * 3 + f0 * 7) % SKY_DIRS.length], 70);
      const env = WD.storm(ts) > (s + 0.5) / N ? stormEnv : envMap;
      for (const m of envMats) m.envMap = env;
      renderer.setRenderTarget(this.rt);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      this.quad.material.uniforms.tex.value = this.rt.texture;
      this.quad.material.uniforms.w.value = 1 / N;
      renderer.setRenderTarget(readBuffer);
      this.quad.render(renderer);
    }
    renderer.autoClear = autoClear;
  }
}

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1);
composer.setSize(W, H);
const accum = new AccumPass();
composer.addPass(accum);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), 0.45, 0.6, 1.05);
composer.addPass(bloom);
composer.addPass(grade);

const pixels = new Uint8Array(W * H * 4);
window.renderFrame = (frame, spp = 8) => {
  accum.frameTime = frame / FPS;
  accum.spp = spp;
  composer.render();
};
window.renderTime = (t, spp = 8) => {
  accum.frameTime = t;
  accum.spp = spp;
  composer.render();
};
window.readFrame = () => {
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
};
window.sendFrame = async (frame, spp, url) => {
  window.renderFrame(frame, spp);
  await fetch(url, { method: 'POST', body: window.readFrame() });
};
window.sendTime = async (t, spp, url) => {
  window.renderTime(t, spp);
  await fetch(url, { method: 'POST', body: window.readFrame() });
};
window.META = { W, H, FPS, DURATION };
window.setGrade = (o) => { for (const [k, v] of Object.entries(o)) grade.uniforms[k].value = v; };
window.LIGHTS = { sun, skyL, hemi, fill };
update(0);
updateCamera(0);
renderer.compile(scene, camera);
window.READY = true;
