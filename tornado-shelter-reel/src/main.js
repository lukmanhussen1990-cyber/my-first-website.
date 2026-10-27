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
import * as SKY from './sky.js';
import * as ENV from './env.js';
import * as SHELTER from './shelter.js';
import * as PEOPLE from './people.js';
import * as FX from './fx.js';
import * as OVERLAY from './overlay.js';

const { clamp, lerp, prog, smooth } = U;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const SCALE = +(params.get('scale') || 1); // <1 for quick previews
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);

// ---------------------------------------------------------------------------
// renderer
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = !params.get('noshadow');
renderer.shadowMap.type = params.get('sm') === 'basic' ? THREE.BasicShadowMap : params.get('sm') === 'pcf' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // updated once per frame (see AccumPass)
renderer.toneMapping = THREE.NoToneMapping; // the grade pass does the filmic (AgX) mapping
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();
// profiling: a 1-pixel read forces SwiftShader to finish the queued work
const _px1 = new Uint8Array(4);
const syncGL = () => { if (window.PROF_ON) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, _px1); };

const scene = new THREE.Scene();
scene.background = new THREE.Color(0.4, 0.45, 0.5);

// ---------------------------------------------------------------------------
// shift-lens camera: looks straight down -z so verticals stay vertical; the
// frame is moved with an off-axis frustum (architectural look)
// ---------------------------------------------------------------------------
class ShiftCamera extends THREE.PerspectiveCamera {
  constructor() {
    super(30, W / H, 0.5, 9000);
    this.fpx = 2600 * SCALE; // focal length in pixels
    this.vCenter = -800; // frame centre, pixels above the horizon line
    this.jx = 0;
    this.jy = 0;
    this.shx = 0; // hand-held shake (pixels)
    this.shy = 0;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    if (this.fpx === undefined) return super.updateProjectionMatrix();
    const n = this.near;
    const ox = this.jx + this.shx, oy = this.jy + this.shy;
    const l = ((-W / 2 + ox) / this.fpx) * n, r = ((W / 2 + ox) / this.fpx) * n;
    const b = ((this.vCenter - H / 2 + oy) / this.fpx) * n, t = ((this.vCenter + H / 2 + oy) / this.fpx) * n;
    this.projectionMatrix.makePerspective(l, r, t, b, n, this.far);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
  }
}
const camera = new ShiftCamera();
const F = 2600;
const camTrack = {};
for (const k of ['cx', 'row', 's', 'cy']) camTrack[k] = U.monotone(CAM.map((c) => [c.t, k === 's' ? Math.log(c[k]) : c[k]]));
export function camAt(t) {
  return { cx: camTrack.cx(t), row: camTrack.row(t), s: Math.exp(camTrack.s(t)), cy: camTrack.cy(t) };
}
// a little hand-held shake while the tornado passes
function shake(t) {
  const k = WD.engulf(t) * 0.6 + 0.25 * U.bump(t, T.hit - 0.02, T.hit + 0.5, 0.05) + 0.3 * U.bump(t, T.doorShut - 0.02, T.doorShut + 0.4, 0.04);
  if (k <= 0) return [0, 0];
  return [k * 0.006 * U.noise1(t * 9.0, 3), k * 0.004 * U.noise1(t * 11.0, 7)];
}
function updateCamera(t) {
  const c = camAt(t);
  const [sx, sy] = shake(t);
  const cz = F / c.s;
  camera.position.set(c.cx, c.cy, cz);
  camera.fpx = F * SCALE;
  const vLawn = (-camera.fpx * c.cy) / cz;
  camera.vCenter = vLawn + (c.row * SCALE - H / 2);
  camera.shx = sx * W;
  camera.shy = sy * H;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// light: a high afternoon sun from the front left (shadows fall back and to the
// right), sky light from many directions (accumulated, so it is soft and
// occluded), a little warm bounce. The storm hides the sun and turns the sky
// light dim and green-grey; afterwards a soft warm sun comes back.
// ---------------------------------------------------------------------------
const SUN_DIR = V(-0.48, 0.66, 0.58).normalize();
const SUN_DIR2 = V(-0.62, 0.5, 0.6).normalize(); // the low evening sun after the storm
const LIGHT_TARGET = V(1.4, -0.6, -4.2);
const SUN_COL = new THREE.Color(1.0, 0.93, 0.82), SUN_COL2 = new THREE.Color(1.0, 0.78, 0.55);
const SUN_I = 3.6;
const sun = new THREE.DirectionalLight(SUN_COL.clone(), SUN_I);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, { left: -10.5, right: 10.5, top: 10.5, bottom: -10.5, near: 20, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.025;
sun.target.position.copy(LIGHT_TARGET);
scene.add(sun, sun.target);

const SKY_COL = new THREE.Color(0.42, 0.55, 0.95), STORM_SKY = new THREE.Color(0.36, 0.44, 0.4);
const SKY_I = 0.95;
const skyLs = [0].map(() => {
  const l = new THREE.DirectionalLight(SKY_COL.clone(), SKY_I);
  l.castShadow = true;
  l.shadow.mapSize.set(768, 768);
  Object.assign(l.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 20, far: 140 });
  l.shadow.bias = -0.0005;
  l.shadow.normalBias = 0.03;
  l.target.position.copy(LIGHT_TARGET);
  scene.add(l, l.target);
  return l;
});
const HEMI_SKY = new THREE.Color(0.5, 0.58, 0.8), HEMI_GND = new THREE.Color(0.3, 0.25, 0.17);
const hemi = new THREE.HemisphereLight(HEMI_SKY.clone(), HEMI_GND.clone(), 0.36);
scene.add(hemi);
// sky directions (fixed per sub-frame index, so nothing flickers between frames)
const SKY_DIRS = [];
for (let i = 0; i < 24; i++) {
  const u = U.halton(i + 1, 2), v = U.halton(i + 1, 3);
  const phi = u * Math.PI * 2;
  const ct = 0.25 + 0.75 * Math.sqrt(v);
  const st = Math.sqrt(1 - ct * ct);
  const d = V(Math.cos(phi) * st, ct, Math.sin(phi) * st);
  d.z = Math.abs(d.z) * 0.8 + 0.2 * d.z; // most of the sky the diorama sees is in front
  SKY_DIRS.push(d.normalize());
}

// environments for reflections: the clear sky and the storm
function makeEnvMap(storm) {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: SUN_DIR }, storm: { value: storm } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sunDir; uniform float storm;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 zen = vec3(0.18, 0.32, 0.75), hor = vec3(0.75, 0.82, 0.95), gnd = vec3(0.12, 0.13, 0.08);
        vec3 c = h > 0.0 ? mix(hor, zen, smoothstep(0.0, 0.7, h)) : mix(hor * 0.5, gnd, smoothstep(0.0, 0.25, -h));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(30.0, 27.0, 22.0) * pow(s, 1500.0) + vec3(0.5, 0.45, 0.35) * pow(s, 10.0);
        vec3 st = h > 0.0 ? mix(vec3(0.2, 0.25, 0.22), vec3(0.1, 0.13, 0.12), h) : vec3(0.05, 0.06, 0.05);
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
  if (mat.userData?.depth) m.customDepthMaterial = mat.userData.depth;
  scene.add(m);
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function beginInst(im) {
  im.userData.n = 0;
}
function setInst(im, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0, order = 'XYZ') {
  if (!(sx > 1e-4 && sy > 1e-4 && sz > 1e-4) || im.userData.n >= im.userData.cap) return -1;
  _q.setFromEuler(_e.set(rx, ry, rz, order));
  _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  const i = im.userData.n++;
  im.setMatrixAt(i, _m4);
  return i;
}
function setInstQ(im, pos, quat, scl) {
  if (im.userData.n >= im.userData.cap) return -1;
  _m4.compose(pos, quat, scl);
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

// ---------------------------------------------------------------------------
// ground: the soil cut face (baked), the lawn top, the open pit's dug walls
// ---------------------------------------------------------------------------
const SOIL = MAT.bakeSoil(renderer, FullScreenQuad);
const PU = MAT.PIT_U;
PU.uPit.value.w = WD.OUT.zb;
const soilMat = (() => {
  const uniforms = { ...PU, uSoil: { value: SOIL.tex }, uSoilN: { value: SOIL.nrm }, uSoilRect: { value: SOIL.rect }, uDark: { value: 0 } };
  const frag = `${MAT.GLSL_PIT}\nuniform sampler2D uSoil, uSoilN; uniform vec4 uSoilRect; uniform float uDark;
    vec2 soilUV(vec3 p){ return (p.xy - uSoilRect.xy) / (uSoilRect.zw - uSoilRect.xy); }
    vec3 frontColor(vec3 p, vec3 n){ vec3 nn = texture2D(uSoilN, soilUV(p)).rgb; return texture2D(uSoil, soilUV(p)).rgb * nn.z; }
    vec3 frontNormal(vec3 p, vec3 n){ vec2 q = texture2D(uSoilN, soilUV(p)).rg * 2.0 - 1.0; return normalize(vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))))); }
    float frontRough(vec3 p, vec3 n){ return 0.93; }`;
  const discard = 'pitAt(vWPos.xy)';
  const m = MAT.patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93 }), { uniforms, colorFn: 'frontColor', normalFn: 'frontNormal', roughFn: 'frontRough', extraFrag: frag, discard, key: 'soilFront' });
  m.userData.depth = MAT.maskedDepth(uniforms, MAT.GLSL_PIT, discard, 'soil');
  return m;
})();
{
  const r = SOIL.rect;
  // the cut face and the lawn cast no shadows: the sun reaches into the open pit and
  // the room through the cut (diorama logic); the shelter's own walls shade it
  scene.add(mesh(G.placed(new THREE.PlaneGeometry(r.z - r.x, -r.y), (r.x + r.z) / 2, r.y / 2, 0), soilMat, false));
}
const lawnMat = (() => {
  const uniforms = { ...PU, uWind: { value: 0 }, uTime: { value: 0 }, uMess: { value: 0 } };
  const frag = MAT.GLSL_PIT + `uniform float uWind, uTime, uMess;
    bool lawnHole(vec3 p){
      bool inPit = uPit.z > 0.002 && p.x > uPit.x && p.x < uPit.y && p.z > uPit.w && p.z < 0.0;
      if (!inPit) return false;
      bool refilled = uFill > 0.0 && p.x > ${WD.STAIR.x0.toFixed(2)} && p.z < ${(WD.STAIR.zb - WD.WALL).toFixed(2)} && p.z < uPit.w + 1.2 * uFill;
      return !refilled;
    }
    vec3 lawnTop(vec3 p, vec3 n){
      vec3 c = mix(s2l(vec3(0.27, 0.42, 0.15)), s2l(vec3(0.36, 0.52, 0.2)), fbm(p.xz * 0.6));
      c *= 0.82 + 0.3 * fbm(p.xz * 3.1 + 4.0);
      c = mix(c, s2l(vec3(0.45, 0.42, 0.22)), 0.35 * smoothstep(0.66, 0.8, fbm(p.xz * 0.45 + 9.0)));
      c *= 0.9 + 0.16 * vnoise(p.xz * 37.0) * aaF(37.0);
      // after the tornado: mud splashes and broken leaves on the lawn
      c = mix(c, s2l(vec3(0.33, 0.27, 0.18)), uMess * 0.55 * smoothstep(0.5, 0.75, fbm(p.xz * 1.7 + 3.0)));
      return c;
    }
    float lawnRough(vec3 p, vec3 n){ return 0.88 + 0.1 * vnoise(p.xz * 7.0); }`;
  const discard = 'lawnHole(vWPos)';
  const m = MAT.patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), { uniforms, colorFn: 'lawnTop', roughFn: 'lawnRough', extraFrag: frag, discard, key: 'lawn' });
  m.userData.depth = MAT.maskedDepth(uniforms, frag, discard, 'lawn');
  return m;
})();
scene.add(mesh(G.placed(new THREE.PlaneGeometry(60, 40), 1, 0, -20, -Math.PI / 2, 0, 0), lawnMat, false));
// the pit's dug walls and floor (repositioned every frame)
const dugMat = MAT.patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), {
  uniforms: { ...PU }, key: 'dug', colorFn: 'dgC', bumpFn: 'dgB',
  extraFrag: MAT.GLSL_PIT + `vec3 dgC(vec3 p, vec3 n){ float h; return dugSoil(p, n, h) * mix(0.62, 1.0, smoothstep(-0.2, 1.2, p.y + uPit.z)); }
    float dgB(vec3 p, vec3 n){ float h; dugSoil(p, n, h); return h; }`,
});
const pitParts = {
  back: mesh(new THREE.PlaneGeometry(1, 1), dugMat, false),
  left: mesh(new THREE.PlaneGeometry(1, 1), dugMat, false),
  right: mesh(new THREE.PlaneGeometry(1, 1), dugMat, false),
  floor: mesh(new THREE.PlaneGeometry(1, 1), dugMat, false),
};
for (const k in pitParts) scene.add(pitParts[k]);
pitParts.left.rotation.y = Math.PI / 2;
pitParts.right.rotation.y = -Math.PI / 2;
pitParts.floor.rotation.x = -Math.PI / 2;
const PIT_HIDE = T.backfill1 + 0.5;
function updateGround(t) {
  const p = WD.pit(t);
  PU.uPit.value.set(p.x0, p.x1, p.d, WD.OUT.zb);
  PU.uFill.value = WD.backfillK(t);
  PU.uShelter.value = t > T.slab ? 1 : 0;
  const show = p.d > 0.004 && t < PIT_HIDE;
  const zb = WD.OUT.zb, w = p.x1 - p.x0;
  for (const k in pitParts) pitParts[k].visible = show;
  if (show) {
    pitParts.back.scale.set(w, p.d, 1);
    pitParts.back.position.set((p.x0 + p.x1) / 2, -p.d / 2, zb);
    for (const [o, x] of [[pitParts.left, p.x0], [pitParts.right, p.x1]]) {
      o.scale.set(-zb, p.d, 1);
      o.position.set(x, -p.d / 2, zb / 2);
    }
    pitParts.floor.scale.set(w, -zb, 1);
    pitParts.floor.position.set((p.x0 + p.x1) / 2, -p.d, zb / 2);
  }
  lawnMat.userData.uniforms.uWind.value = WD.wind(t);
  lawnMat.userData.uniforms.uTime.value = t;
  lawnMat.userData.uniforms.uMess.value = smooth(prog(t, T.hitT + 1.0, 5.0));
}

// ---------------------------------------------------------------------------
// interior lights: a caged bulb on the ceiling (dim and warm), the flashlight
// ---------------------------------------------------------------------------
const lamp = new THREE.PointLight(new THREE.Color(1.0, 0.72, 0.45), 0, 3.2, 1.6);
lamp.position.set(WD.LAMP.x, WD.LAMP.y - 0.12, WD.LAMP.z);
scene.add(lamp);
const torch = new THREE.SpotLight(new THREE.Color(1.0, 0.95, 0.85), 0, 6, 0.42, 0.55, 1.4);
torch.castShadow = true; // so it cannot shine through the floor slab
torch.shadow.mapSize.set(512, 512);
torch.shadow.bias = -0.0008;
scene.add(torch, torch.target);

// ---------------------------------------------------------------------------
// modules: the sky and the tornado, the yard, the shelter, the people, effects,
// the infographics
// ---------------------------------------------------------------------------
const ctx = {
  THREE, scene, renderer, camera, envMap, stormEnv, envMats, SCALE, W, H, T, WD, MAT, G, U, add, mesh, instanced, beginInst, setInst, setInstQ, endInst,
  sun, camAt, lamp, torch, SUN_DIR,
  anchors: {}, // people.js registers hand / head anchors here at build time
  FX: {},
};
const modules = [SKY.build(ctx), ENV.build(ctx), SHELTER.build(ctx), PEOPLE.build(ctx), FX.build(ctx)];
// profiling switches (?hide=grass,leaves,...)
const HIDE = (params.get('hide') || '').split(',').filter(Boolean);
if (HIDE.length) scene.traverse((o) => {
  const k = o.material?.customProgramCacheKey?.() || '';
  if ((HIDE.includes('grass') && k === 'grass') || (HIDE.includes('leaves') && k === 'leaf') || (HIDE.includes('lawn') && k === 'lawn') ||
      (HIDE.includes('concrete') && k === 'concrete') || (HIDE.includes('soil') && k === 'soilFront') || (HIDE.includes('tiles') && k === 'tile') ||
      (HIDE.includes('far') && (k === 'farCrown' || k === 'nWall' || k === 'nRoof')) || (HIDE.includes('fence') && k === 'fenceB') || (HIDE.includes('house') && (k === 'stucco' || k === 'trim' || k === 'shutter'))) o.visible = false;
});
const overlay = OVERLAY.build(ctx);

const grade = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null }, exposure: { value: 1.0 }, sat: { value: 1.08 }, punch: { value: 1.0 }, vig: { value: 0.2 },
    tint: { value: new THREE.Vector3(1, 1, 1) }, lift: { value: new THREE.Vector3(0.004, 0.004, 0.005) },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, punch, vig; uniform vec3 tint, lift; varying vec2 vUv;
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
      vec3 c = agx(texture2D(tDiffuse, vUv).rgb * exposure) * tint + lift;
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.62);
      c *= 1.0 - vig * smoothstep(0.2, 0.68, length(q));
      vec3 o = mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      o += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(o, 1.0);
    }`,
});
// the infographics (labels, measuring lines, arrows) drawn on a 2D canvas and laid over the graded frame
const overPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, tOver: { value: overlay.texture } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse, tOver; varying vec2 vUv;
    void main(){ vec3 b = texture2D(tDiffuse, vUv).rgb; vec4 o = texture2D(tOver, vec2(vUv.x, 1.0 - vUv.y)); gl_FragColor = vec4(mix(b, o.rgb, o.a), 1.0); }`,
});

// ShaderPass clones its uniforms: point it at the live canvas texture
overPass.uniforms.tOver.value = overlay.texture;

// weather on the lights and the grade
function updateLights(t) {
  const s = WD.storm(t), cl = WD.clearK(t), eg = WD.engulf(t);
  const sunK = (1 - 0.93 * s) * (1 - 0.6 * eg);
  sun.intensity = SUN_I * sunK * lerp(1, 0.78, cl);
  sun.color.copy(SUN_COL).lerp(SUN_COL2, cl);
  for (const l of skyLs) {
    l.color.copy(SKY_COL).lerp(STORM_SKY, s);
    l.intensity = SKY_I * (1 + 0.7 * s) * (1 - 0.55 * eg);
  }
  hemi.color.copy(HEMI_SKY).lerp(STORM_SKY, s);
  hemi.intensity = (0.36 + 0.3 * s) * (1 - 0.5 * eg);
  // lights that are off leave the shaders (fewer lights per pixel)
  lamp.visible = lamp.intensity > 0.001;
  torch.visible = torch.intensity > 0.001;
  grade.uniforms.exposure.value = (1.0 + 0.55 * s + 0.4 * eg) * (1 + 0.08 * cl);
  grade.uniforms.sat.value = 1.08 - 0.3 * s;
  // green-grey storm cast; warm after
  grade.uniforms.tint.value.set(lerp(1, 0.94, s) * lerp(1, 1.03, cl), lerp(1, 1.0, s), lerp(1, 0.93, s) * lerp(1, 0.96, cl));
}
function sunDirAt(t) {
  return SUN_DIR.clone().lerp(SUN_DIR2, WD.clearK(t)).normalize();
}

function update(t) {
  updateGround(t);
  for (const m of modules) m?.update?.(t);
  updateLights(t);
}

// ---------------------------------------------------------------------------
// accumulation renderer: sub-pixel jitter, soft sunlight, occluded sky light and
// motion blur are averaged over N sub-frames. Light jitter depends only on the
// sub-frame index, so still parts of the picture are identical frame to frame.
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
    const P = window.PROF;
    let t0 = performance.now();
    // once per frame, for the middle of the shutter: the sky picture
    update(this.frameTime);
    updateCamera(this.frameTime);
    camera.updateMatrixWorld();
    P.update += performance.now() - t0; t0 = performance.now();
    if (!params.get('nosky')) for (const m of modules) m?.prepare?.(this.frameTime);
    syncGL();
    P.sky += performance.now() - t0;
    renderer.setRenderTarget(readBuffer);
    for (let s = 0; s < N; s++) {
      const ts = this.frameTime + ((s + 0.5) / N - 0.5) * shutter;
      t0 = performance.now();
      update(ts);
      updateCamera(ts);
      P.update += performance.now() - t0;
      camera.jx = U.halton(s + 1, 2) - 0.5;
      camera.jy = U.halton(s + 1, 3) - 0.5;
      camera.updateProjectionMatrix();
      // the shadow maps are drawn once per frame (first sub-frame) and reused: the
      // lights hold still within the frame; PCF filtering softens the edges
      renderer.shadowMap.needsUpdate = s === 0;
      sun.position.copy(LIGHT_TARGET).addScaledVector(sunDirAt(this.frameTime), 70);
      skyLs.forEach((l) => l.position.copy(LIGHT_TARGET).addScaledVector(V(-0.25, 0.85, 0.47).normalize(), 80));
      const env = WD.storm(ts) > (s + 0.5) / N ? stormEnv : envMap;
      for (const m of envMats) m.envMap = env;
      renderer.setRenderTarget(this.rt);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      t0 = performance.now();
      renderer.render(scene, camera);
      syncGL();
      P[s === 0 ? 'main0' : 'mainN'] += performance.now() - t0;
      this.quad.material.uniforms.tex.value = this.rt.texture;
      this.quad.material.uniforms.w.value = 1 / N;
      renderer.setRenderTarget(readBuffer);
      this.quad.render(renderer);
    }
    renderer.autoClear = autoClear;
    // the overlay is drawn for the middle of the shutter, with the un-jittered camera
    update(this.frameTime);
    updateCamera(this.frameTime);
    camera.jx = camera.jy = 0;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    t0 = performance.now();
    overlay.draw(this.frameTime);
    P.overlay += performance.now() - t0;
  }
}

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
composer.setPixelRatio(1);
composer.setSize(W, H);
const accum = new AccumPass();
composer.addPass(accum);
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), 0.32, 0.55, 1.2);
if (!params.get('nobloom')) composer.addPass(bloom);
composer.addPass(grade);
if (!params.get('nooverlay')) composer.addPass(overPass);

const pixels = new Uint8Array(W * H * 4);
window.PROF = { update: 0, sky: 0, main0: 0, mainN: 0, overlay: 0, post: 0, read: 0, frames: 0 };
window.renderFrame = (frame, spp = 8) => {
  accum.frameTime = frame / FPS;
  accum.spp = spp;
  const t0 = performance.now();
  composer.render();
  syncGL();
  window.PROF.post += performance.now() - t0;
  window.PROF.frames++;
};
window.renderTime = (t, spp = 8) => {
  accum.frameTime = t;
  accum.spp = spp;
  composer.render();
};
window.readFrame = () => {
  const t0 = performance.now();
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  window.PROF.read += performance.now() - t0;
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
await Promise.all([overlay.ready, ...modules.map((m) => m?.ready)]);
update(0);
updateCamera(0);
renderer.shadowMap.needsUpdate = true;
renderer.compile(scene, camera);
window.READY = true;
