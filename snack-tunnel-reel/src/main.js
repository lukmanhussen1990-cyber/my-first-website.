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
import * as KITCHEN from './kitchen.js';
import * as PROPS from './props.js';
import * as CHARS from './characters.js';

const { clamp, lerp, prog, popIn, popOut, smooth, easeOutCubic, easeInQuad, easeOutBack, wobble, bump } = U;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const SCALE = +(params.get('scale') || 1); // <1 for quick previews
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const { W: TW, ROOF, FLOOR, SHAFT, DOG_UP, KIT_UP } = WD;

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
scene.background = new THREE.Color(0.02, 0.03, 0.08);

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
// night lighting: cool moonlight from the top left, a soft occluded sky, a dim
// fill from the camera side; warm practicals (lanterns, fridge, headlamp) live
// in the modules
// ---------------------------------------------------------------------------
const MOON_DIR = V(-0.5, 0.74, 0.45).normalize();
const LIGHT_TARGET = V(0.3, -0.8, -2.5);
const moon = new THREE.DirectionalLight(new THREE.Color(0.62, 0.74, 1.0), 2.4);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
Object.assign(moon.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 90 });
moon.shadow.bias = -0.0003;
moon.shadow.normalBias = 0.02;
moon.target.position.copy(LIGHT_TARGET);
scene.add(moon, moon.target);

const skyL = new THREE.DirectionalLight(new THREE.Color(0.33, 0.43, 0.9), 0.9);
skyL.castShadow = true;
skyL.shadow.mapSize.set(1024, 1024);
Object.assign(skyL.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 100 });
skyL.shadow.bias = -0.0004;
skyL.shadow.normalBias = 0.025;
skyL.target.position.copy(LIGHT_TARGET);
scene.add(skyL, skyL.target);

const hemi = new THREE.HemisphereLight(new THREE.Color(0.24, 0.31, 0.62), new THREE.Color(0.11, 0.085, 0.065), 0.55);
scene.add(hemi);
const fill = new THREE.DirectionalLight(new THREE.Color(0.55, 0.62, 0.86), 0.32);
fill.position.set(0.25, 0.3, 1).multiplyScalar(40);
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

// night environment for reflections (metal, glass, tiles)
function makeEnvMap() {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { moonDir: { value: MOON_DIR } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 moonDir;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 zen = vec3(0.03,0.05,0.16), hor = vec3(0.09,0.13,0.3), gnd = vec3(0.03,0.035,0.03);
        vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.6)) : mix(hor*0.5, gnd, pow(-h, 0.4));
        float s = max(dot(d, moonDir), 0.0);
        c += vec3(6.0, 6.5, 7.5) * pow(s, 1500.0) + vec3(0.2, 0.25, 0.4) * pow(s, 18.0);
        c += vec3(0.6, 0.45, 0.25) * smoothstep(0.06, 0.0, abs(h - 0.08)) * smoothstep(0.2, 0.9, d.z) * 0.3;
        gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), m));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02);
  pm.dispose();
  return rt.texture;
}
const envMap = makeEnvMap();

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

// ---------------------------------------------------------------------------
// ground: soil cut face (baked), lawn, tunnel surfaces driven by the dig field
// ---------------------------------------------------------------------------
const SOIL = MAT.bakeSoil(renderer, FullScreenQuad);
const DIG = (() => {
  const r = WD.digRaster(200);
  const half = new Uint16Array(r.data.length);
  for (let i = 0; i < r.data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(r.data[i]);
  const tex = new THREE.DataTexture(half, r.w, r.h, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const R = WD.DIG_RECT;
  return { tex, rect: new THREE.Vector4(R.x0, R.y0, R.x1, R.y1) };
})();
const soilMat = MAT.soilFrontMaterial(SOIL, DIG);
{
  // the cut face: full height in the yard and past the house, under the house it
  // stops at the bottom of the floor slab (the slab has its own cut face)
  const r = SOIL.rect, H0 = WD.HOUSE;
  const part = (x0, x1, top) => scene.add(mesh(G.placed(quad(x1 - x0, top - r.y), (x0 + x1) / 2, (top + r.y) / 2, 0), soilMat));
  part(r.x, H0.x0, 0);
  part(H0.x0, H0.x1, H0.slab0);
  part(H0.x1, r.z, 0);
  const R = WD.DIG_RECT;
  scene.add(mesh(G.placed(quad(R.x1 - R.x0, R.y1 - R.y0), (R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2, -TW), MAT.tunnelBackMaterial(DIG)));
  // soil right behind it, so hairline seams between the tunnel surfaces never show the sky
  scene.add(mesh(G.placed(quad(R.x1 - R.x0, -0.004 - R.y0), (R.x0 + R.x1) / 2, (R.y0 - 0.004) / 2, -TW - 0.012), MAT.seamMaterial(), false, true));
}
const lawnMat = MAT.lawnMaterial({ shaft: new THREE.Vector4(SHAFT.x0, SHAFT.x1, -TW, 0.01), open: T.shaft0 + 0.02 });
{
  // the yard: lawn top from far left up to the house's left wall
  const x0 = -16, x1 = WD.HOUSE.x0, z0 = -14;
  scene.add(mesh(G.placed(quad(x1 - x0, -z0), (x0 + x1) / 2, 0, z0 / 2, -Math.PI / 2, 0, 0), lawnMat));
  // a strip of lawn on the far side of the house
  scene.add(mesh(G.placed(quad(6, -z0), WD.HOUSE.x1 + 3, 0, z0 / 2, -Math.PI / 2, 0, 0), lawnMat));
}
const floorMat = MAT.tunnelBoundaryMaterial(DIG);
const wallSideMat = MAT.tunnelBoundaryMaterial(DIG, 'tunnelColor', 'tunnelBump');
// strip of floor along a polyline [[x,y],...], from the back wall to the cut face
function floorStrip(pts, mat) {
  const pos = [], nrm = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    const nx = -dy / l, ny = dx / l;
    const A = [x0, y0, -TW], B = [x1, y1, -TW], C = [x1, y1, 0], D = [x0, y0, 0];
    pos.push(...D, ...C, ...B, ...D, ...B, ...A);
    for (let k = 0; k < 6; k++) nrm.push(nx, ny, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  return scene.add(mesh(g, mat));
}
floorStrip([[SHAFT.x0, FLOOR], [KIT_UP.x1, FLOOR]], floorMat);
// side walls facing into the shafts (both directions; each shows only where it bounds the hole)
{
  const wall = (x, y0, y1, ry) => scene.add(mesh(G.placed(quad(TW, y1 - y0), x, (y0 + y1) / 2, -TW / 2, 0, ry, 0), wallSideMat));
  wall(SHAFT.x0, FLOOR, 0, Math.PI / 2);
  wall(SHAFT.x1, ROOF, 0, -Math.PI / 2);
  wall(DOG_UP.x0, ROOF, 0.02, Math.PI / 2);
  wall(DOG_UP.x1, ROOF, 0.02, -Math.PI / 2);
  wall(KIT_UP.x0, ROOF, WD.HOUSE.slab0, Math.PI / 2);
  wall(KIT_UP.x1, FLOOR, WD.HOUSE.slab0, -Math.PI / 2);
}
// moving dig faces: bottom of the shaft while it goes down, the rounded tunnel face
const shaftFace = mesh(G.placed(quad(SHAFT.x1 - SHAFT.x0, TW), (SHAFT.x0 + SHAFT.x1) / 2, 0, -TW / 2, -Math.PI / 2, 0, 0), floorMat);
scene.add(shaftFace);
const TF_N = 20;
const tunFace = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TF_N * 18), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(TF_N * 18), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(TF_N * 12), 2));
  const m = mesh(g, wallSideMat);
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();
function updateDigFaces(t) {
  const sy = WD.shaftY(t);
  shaftFace.visible = t > T.shaft0 && sy > FLOOR + 0.01;
  shaftFace.position.y = sy;
  const xa = WD.tunX(t);
  tunFace.visible = t > T.tunA0 && xa < KIT_UP.x1 - 0.02;
  if (!tunFace.visible) return;
  const P = tunFace.geometry.attributes.position.array, N = tunFace.geometry.attributes.normal.array;
  let o = 0;
  for (let i = 0; i < TF_N; i++) {
    const ya = FLOOR + ((ROOF - FLOOR) * i) / TF_N, yb = FLOOR + ((ROOF - FLOOR) * (i + 1)) / TF_N;
    const qa = (ya - WD.MID) / WD.HALF, qb = (yb - WD.MID) / WD.HALF;
    const x0 = xa - 0.13 * qa * qa, x1 = xa - 0.13 * qb * qb;
    const l = Math.hypot(x1 - x0, yb - ya), nx = -(yb - ya) / l, ny = (x1 - x0) / l;
    for (const [x, y, z] of [[x0, ya, 0], [x1, yb, 0], [x1, yb, -TW], [x0, ya, 0], [x1, yb, -TW], [x0, ya, -TW]]) {
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      N[o] = nx; N[o + 1] = ny; N[o + 2] = 0; // into the open tunnel
      o += 3;
    }
  }
  tunFace.geometry.attributes.position.needsUpdate = true;
  tunFace.geometry.attributes.normal.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// digging effects: dirt chunks, dust puffs, the growing pile, falling clumps
// ---------------------------------------------------------------------------
const dirtMat = MAT.patch(MAT.std('#6b4a30', 0.95), {
  colorFn: 'dirtCol', bumpFn: 'dirtBump', key: 'dirt',
  extraFrag: `vec3 dirtCol(vec3 p, vec3 n){ return mix(vec3(0.62), vec3(1.15), vnoise3(p * 9.0)) * (0.85 + 0.3 * vnoise3(p * 31.0)); }
    float dirtBump(vec3 p, vec3 n){ return 0.01 * vnoise3(p * 14.0) + 0.004 * vnoise3(p * 40.0); }`,
});
const chunkGeo = G.lumpyBlob(1, 1, 0.32, 7);
const chunks = instanced(chunkGeo, dirtMat, 160);
// dust: soil-coloured, thin, and fading out towards its silhouette so it reads as
// a soft cloud instead of solid balls
const puffMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.3, 0.22, 0.15), roughness: 1, transparent: true, opacity: 0.3, depthWrite: false });
puffMat.onBeforeCompile = (sh) => {
  sh.fragmentShader = sh.fragmentShader.replace(
    '#include <opaque_fragment>',
    '{ float f = abs(dot(normalize(normal), normalize(vViewPosition))); diffuseColor.a *= pow(smoothstep(0.0, 0.95, f), 2.2); }\n#include <opaque_fragment>'
  );
};
puffMat.customProgramCacheKey = () => 'puff';
const puffs = instanced(G.lumpyBlob(1, 2, 0.22, 3), puffMat, 90, false);
const pile = mesh(G.lumpyBlob(1, 3, 0.16, 11), dirtMat);
pile.position.set(WD.PILE.x, 0, WD.PILE.z);
scene.add(pile);
const rnd = U.mulberry32(1234);
// scoop events (world.js SCOOP_T): when and where each shovelful of dirt flies
const SCOOPS = WD.SCOOP_T.map((s) => ({ ...s, parts: Array.from({ length: s.kind === 'up' ? 5 : 4 }, () => ({ a: rnd(), b: rnd(), c: rnd(), d: rnd() })) }));
// dirt that falls from the roof in scene 2 (from the cave bites)
const CLUMPS = [];
for (const c of WD.CAVES) for (let k = 0; k < 5; k++) CLUMPS.push({ x: c.x + (rnd() - 0.5) * c.w * 0.8, z: -0.2 - rnd() * (TW - 0.4), t0: c.t + rnd() * 0.3, s: 0.035 + rnd() * 0.05, r: rnd() * 6 });
const GRAV = 9.8;
function updateDirt(t) {
  beginInst(chunks);
  beginInst(puffs);
  for (const s of SCOOPS) {
    const dt = t - s.t;
    if (dt < 0 || dt > 1.4) continue;
    const face = s.kind === 'up' ? { x: (SHAFT.x0 + SHAFT.x1) / 2, y: WD.shaftY(s.t) } : { x: WD.tunX(s.t), y: FLOOR };
    for (const q of s.parts) {
      let x, y, z, sc;
      if (s.kind === 'up') {
        // tossed out of the shaft onto the pile
        const T0 = 0.75 + 0.2 * q.a;
        const u = clamp(dt / T0);
        x = lerp(face.x, WD.PILE.x + (q.b - 0.5) * 0.5, u);
        z = lerp(-0.5, WD.PILE.z + (q.c - 0.5) * 0.5, u);
        const y0 = face.y + 0.3, y1 = 0.12 + pileH(t) * 0.6;
        y = lerp(y0, y1, u) + (2.4 + 0.6 * q.d) * u * (1 - u) * 1.6;
        sc = (0.07 + 0.05 * q.a) * (dt < T0 ? 1 : 1 - smooth(clamp((dt - T0) / 0.35)));
      } else {
        // flung back along the tunnel floor, bounce and crumble away
        const vx = -(1.0 + 1.3 * q.a), vy = 1.6 + 1.4 * q.b;
        const tl = (2 * vy) / GRAV;
        const tt = Math.min(dt, tl);
        x = face.x - 0.15 + vx * tt * 0.7;
        y = FLOOR + 0.25 + vy * tt - 0.5 * GRAV * tt * tt;
        y = Math.max(FLOOR + 0.04, y);
        z = -0.25 - q.c * (TW - 0.5);
        sc = (0.05 + 0.045 * q.d) * (1 - smooth(clamp((dt - tl - 0.2) / 0.45)));
        if (dt > tl && dt < tl + 0.6) {
          const pu = (dt - tl) / 0.6;
          const ps = (0.05 + 0.15 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.55) / 0.45)));
          setInst(puffs, x, FLOOR + 0.05 + 0.1 * pu, z, ps, ps * 0.7, ps, 0, q.a * 6, 0);
        }
      }
      setInst(chunks, x, y, z, sc, sc * 0.8, sc, q.a * 9 + dt * 5, q.b * 9, q.c * 9);
    }
  }
  for (const c of CLUMPS) {
    const dt = t - c.t0;
    if (dt < 0 || dt > 1.5) continue;
    const tf = Math.sqrt((2 * (ROOF - FLOOR - 0.1)) / GRAV);
    const y = dt < tf ? ROOF - 0.5 * GRAV * dt * dt : FLOOR + c.s * 0.8 + 0.05 * Math.max(0, Math.sin((dt - tf) * 12)) * Math.exp(-(dt - tf) * 6);
    const sc = c.s * (1 - smooth(clamp((dt - 1.0) / 0.45)));
    setInst(chunks, c.x, y, c.z, sc, sc * 0.8, sc, c.r + dt * 4, c.r * 2, c.r);
    if (dt > tf && dt < tf + 0.7) {
      const pu = (dt - tf) / 0.7;
      const ps = (0.06 + 0.16 * easeOutCubic(pu)) * (1 - smooth(clamp((pu - 0.5) / 0.5)));
      setInst(puffs, c.x, FLOOR + 0.06 + 0.06 * pu, c.z, ps, ps * 0.65, ps, 0, c.r, 0);
    }
  }
  endInst(chunks);
  endInst(puffs);
  const h = pileH(t);
  pile.visible = h > 0.01;
  pile.scale.set(0.2 + 0.55 * h, Math.max(0.01, 0.42 * h), 0.18 + 0.42 * h);
  pile.position.y = -0.05;
}
// pile height grows with what has been dug
function pileH(t) {
  const shaft = clamp(-WD.shaftY(t) / -FLOOR);
  const tun = clamp((WD.tunX(t) - SHAFT.x1) / (KIT_UP.x1 - SHAFT.x1));
  return 0.45 * shaft + 0.75 * Math.sqrt(tun);
}

// ---------------------------------------------------------------------------
// glowing "invisible things": the snack dream bubble, sound rings
// ---------------------------------------------------------------------------
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.0, 1.4), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
const RINGS = [0, 1, 2].map((k) => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.0, 96), ringMat.clone());
  m.position.set(WD.ROCK.x, WD.ROCK.y, 0.02);
  m.renderOrder = 10;
  scene.add(m);
  return m;
});
function updateRings(t) {
  RINGS.forEach((m, k) => {
    const u = prog(t, T.clang + 0.03 + k * 0.2, 1.25);
    m.visible = u > 0 && u < 1;
    const r = 0.15 + 2.4 * easeOutCubic(u);
    m.scale.setScalar(r);
    m.material.opacity = 2.2 * (1 - u) * smooth(clamp(u * 8));
  });
}
const dream = new THREE.Group();
{
  const bub = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 0.85, 1.25), transparent: true, opacity: 0.55, depthWrite: false });
  const rim = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.35, 1.8), transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
  const cloud = new THREE.Group();
  for (const [x, y, r] of [[0, 0, 0.26], [-0.22, -0.04, 0.17], [0.23, -0.03, 0.18], [-0.1, 0.14, 0.17], [0.13, 0.15, 0.16]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r, 40), bub);
    c.position.set(x, y, 0);
    cloud.add(c);
    const e = new THREE.Mesh(new THREE.RingGeometry(r * 0.95, r * 1.04, 40), rim);
    e.position.set(x, y, 0.001);
    cloud.add(e);
  }
  dream.add(cloud);
  for (const [x, y, r] of [[-0.3, -0.36, 0.05], [-0.4, -0.5, 0.032]]) {
    const c = new THREE.Mesh(new THREE.CircleGeometry(r, 24), bub);
    c.position.set(x, y, 0);
    dream.add(c);
  }
  // a little bag of chips and a cookie inside
  const bag = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.9, 0.15), transparent: true, depthWrite: false }));
  bag.position.set(-0.06, 0.03, 0.004);
  bag.rotation.z = 0.15;
  const cookie = new THREE.Mesh(new THREE.CircleGeometry(0.07, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 0.62, 0.3), transparent: true, depthWrite: false }));
  cookie.position.set(0.1, -0.02, 0.005);
  dream.add(bag, cookie);
  for (const [x, y] of [[0.08, 0.0], [0.12, -0.04], [0.09, -0.06]]) {
    const ch = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.15, 0.08), transparent: true, depthWrite: false }));
    ch.position.set(x, y, 0.006);
    dream.add(ch);
  }
  dream.renderOrder = 12;
  dream.traverse((o) => (o.renderOrder = 12));
  scene.add(dream);
}
function updateDream(t) {
  const k = popIn(t, T.dream, 0.45, 2.2);
  const out = t > T.dreamPop ? 1 - easeInQuad(prog(t, T.dreamPop + 0.18, 0.22)) : 1;
  const sag = t > T.dreamPop ? Math.min(1, (t - T.dreamPop) / 0.18) : 0;
  const s = k * out;
  dream.visible = s > 0.01;
  const kid = WD.digFace(t);
  dream.position.set(kid.x - 0.45, -0.75 + 0.03 * Math.sin(t * 2.4), 0.05);
  dream.scale.set(s * (1 + 0.15 * sag), s * (1 - 0.25 * sag), 1);
}

// ---------------------------------------------------------------------------
// modules: the world's dressing, kitchen, tunnel props, characters
// ---------------------------------------------------------------------------
const ctx = { THREE, scene, renderer, camera, envMap, SCALE, T, WD, MAT, G, U, add, mesh, instanced, beginInst, setInst, endInst, moon, camAt };
const modules = [ENV.build(ctx), KITCHEN.build(ctx), PROPS.build(ctx), CHARS.build(ctx)];

function update(t) {
  MAT.digTime.value = t;
  updateDigFaces(t);
  updateDirt(t);
  updateRings(t);
  updateDream(t);
  for (const m of modules) m?.update?.(t);
}

// ---------------------------------------------------------------------------
// accumulation renderer (Eevee-style): sub-pixel jitter, soft moonlight,
// occluded sky light and motion blur are averaged over N sub-frames
// ---------------------------------------------------------------------------
const EXPOSURE = 1.0;
class AccumPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, depthBuffer: true });
    this.quad = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { tex: { value: null }, w: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
        fragmentShader: 'uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex, vUv).rgb * w, 1.0); }',
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
    const tang = V(-MOON_DIR.z, 0, MOON_DIR.x).normalize();
    const bit = MOON_DIR.clone().cross(tang).normalize();
    for (let s = 0; s < N; s++) {
      const ts = this.frameTime + ((s + 0.5) / N - 0.5) * shutter;
      update(ts);
      updateCamera(ts);
      camera.jx = U.halton(s + 1, 2) - 0.5;
      camera.jy = U.halton(s + 1, 3) - 0.5;
      camera.updateProjectionMatrix();
      const a = U.halton(s + 1, 5) * Math.PI * 2, r = Math.sqrt(U.halton(s + 1, 7)) * 0.035;
      const d = MOON_DIR.clone().addScaledVector(tang, Math.cos(a) * r).addScaledVector(bit, Math.sin(a) * r).normalize();
      moon.position.copy(LIGHT_TARGET).addScaledVector(d, 60);
      skyL.position.copy(LIGHT_TARGET).addScaledVector(SKY_DIRS[(s * 3) % SKY_DIRS.length], 70);
      renderer.setRenderTarget(this.rt);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      this.quad.material.uniforms.tex.value = this.rt.texture;
      this.quad.material.uniforms.w.value = EXPOSURE / N;
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
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), 0.55, 0.62, 0.95);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, sat: { value: 1.12 }, punch: { value: 1.0 }, vig: { value: 0.24 }, lift: { value: new THREE.Vector3(0.004, 0.006, 0.014) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, punch, vig; uniform vec3 lift; varying vec2 vUv;
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
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.62);
      c *= 1.0 - vig * smoothstep(0.18, 0.66, length(q));
      vec3 o = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
      o += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(o, 1.0);
    }`,
});
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
window.LIGHTS = { moon, skyL, hemi, fill };
update(0);
updateCamera(0);
renderer.compile(scene, camera);
window.READY = true;
