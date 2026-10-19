import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as U from './util.js';
import { T, FPS, DURATION } from './timeline.js';
import {
  groundMaterial, concreteMaterial, gravelMaterial, platformMaterial, roofTileMaterial, makeSimpleMats, bakeGround,
} from './materials.js';
import {
  buildHouse, buildTree, buildBush, buildCar, subtractBox, boxesToGeometry, boxMM, box, placed, mergeAll, lumpyBlob,
} from './builders.js';

const { clamp, lerp, prog, popIn, popOut, smooth, easeInOutCubic, easeOutCubic, easeInQuad, easeOutBack, wobble, bump } = U;
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
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const gl = renderer.getContext();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0.6, 0.7, 0.9);

// ---------------------------------------------------------------------------
// shift-lens camera: looks straight down -z so verticals stay vertical; the
// frame is shifted down with an off-axis frustum (architectural look)
// ---------------------------------------------------------------------------
class ShiftCamera extends THREE.PerspectiveCamera {
  constructor() {
    super(30, W / H, 0.5, 900);
    this.fpx = 2560 * SCALE; // focal length in pixels
    this.vCenter = -830; // frame centre, pixels above the horizon line
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

// camera framings
const CAM_WIDE = { cy: 7.8, cz: 24.0, f: 2560 * SCALE, lawnPx: 1000 * SCALE };
const CAM_CLOSE = { cy: 5.4, cz: 17.2, f: 2560 * SCALE, lawnPx: 1130 * SCALE };
function applyCam(c) {
  camera.position.set(0, c.cy, c.cz);
  camera.fpx = c.f;
  // pixel row (from top) where the lawn front edge (y=0,z=0) should sit
  const vLawn = (-c.f * c.cy) / c.cz;
  camera.vCenter = vLawn + (c.lawnPx - H / 2);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// lights + environment
// ---------------------------------------------------------------------------
const SUN_DIR = V(-0.68, 0.37, 0.63).normalize();
const sunColA = new THREE.Color(1.0, 0.76, 0.5), sunColB = new THREE.Color(1.0, 0.58, 0.32);
const LIGHT_TARGET = V(0, -1.5, -9);
const sun = new THREE.DirectionalLight(sunColA.clone(), 4.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 140 });
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 2.5;

sun.target.position.copy(LIGHT_TARGET);
scene.add(sun, sun.target);

const skyL = new THREE.DirectionalLight(new THREE.Color(0.55, 0.68, 1.0), 1.4);
skyL.castShadow = true;
skyL.shadow.mapSize.set(512, 512);
Object.assign(skyL.shadow.camera, { left: -21, right: 21, top: 21, bottom: -21, near: 1, far: 150 });
skyL.shadow.bias = -0.0006;
skyL.shadow.normalBias = 0.04;
skyL.shadow.radius = 4;
skyL.target.position.copy(LIGHT_TARGET);
scene.add(skyL, skyL.target);

const hemi = new THREE.HemisphereLight(new THREE.Color(0.6, 0.7, 1.0), new THREE.Color(0.55, 0.45, 0.3), 0.78);
scene.add(hemi);

// stratified sky directions (upper hemisphere, weighted towards the open front)
const SKY_DIRS = [];
for (let i = 0; i < 32; i++) {
  const u = U.halton(i + 1, 2), v = U.halton(i + 1, 3);
  const phi = u * Math.PI * 2;
  const ct = Math.sqrt(1 - v * 0.92); // cosine-ish
  const st = Math.sqrt(1 - ct * ct);
  let d = V(Math.cos(phi) * st, ct, Math.sin(phi) * st);
  d.z = Math.abs(d.z) * 0.85 + 0.15 * d.z; // most sky reaching the diorama comes from the front
  d.normalize();
  SKY_DIRS.push(d);
}

function makeEnvMap() {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform vec3 sunDir;
      void main(){ vec3 d = normalize(vD); float h = d.y;
        vec3 zen = vec3(0.30,0.48,0.92), hor = vec3(1.35,1.0,0.72), gnd = vec3(0.18,0.24,0.12);
        vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.5)) : mix(hor*0.55, gnd, pow(-h, 0.35));
        float s = max(dot(d, sunDir), 0.0);
        c += vec3(30.0, 22.0, 14.0) * pow(s, 900.0) + vec3(0.9, 0.6, 0.3) * pow(s, 12.0);
        // soft studio strips: give the car paint and chrome long glossy highlights
        c += vec3(1.4, 1.3, 1.2) * smoothstep(0.035, 0.0, abs(h - 0.42)) * smoothstep(-0.2, 0.6, d.z);
        c += vec3(0.7, 0.68, 0.65) * smoothstep(0.05, 0.0, abs(h - 0.12)) * smoothstep(0.0, 0.8, -d.x);
        gl_FragColor = vec4(c, 1.0); }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(100, 64, 32), m));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.015);
  pm.dispose();
  return rt.texture;
}
const envMap = makeEnvMap();
const M = makeSimpleMats(envMap);
const roofMat = roofTileMaterial();

// visible sky dome
const skyUniforms = { warm: { value: 0 } };
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(420, 48, 24),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    uniforms: skyUniforms,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec3 vD; uniform float warm;
      void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.0);
        vec3 hor = mix(vec3(1.0, 0.72, 0.46), vec3(1.0, 0.52, 0.3), warm) * 2.4;
        vec3 mid = mix(vec3(0.95, 0.8, 0.72), vec3(0.98, 0.62, 0.55), warm) * 1.7;
        vec3 zen = mix(vec3(0.34, 0.54, 0.95), vec3(0.4, 0.42, 0.85), warm) * 1.6;
        vec3 c = mix(hor, mid, smoothstep(0.0, 0.05, h));
        c = mix(c, zen, smoothstep(0.03, 0.22, h));
        gl_FragColor = vec4(c, 1.0); }`,
  })
);
skyDome.renderOrder = 50;
scene.add(skyDome);

// ---------------------------------------------------------------------------
// world dimensions
// ---------------------------------------------------------------------------
const PIT = { x0: -3.6, x1: 3.6, z0: -3.4, z1: 0, y0: -3.3 };
const IN = { x0: -3.3, x1: 3.3, z0: -3.1, z1: 0, floor: -3.0 }; // interior of the finished room
const WALL_TOP = -0.2; // rebate for the turf roof
const CAR_Z = -1.55;
const LIFT_LOW = -2.75; // platform top when lowered
const LIFT_Z = -0.08; // piston axis (front, visible in the cutaway)
const SUMP = { x0: -3.5, x1: -2.3, y0: -4.95, y1: -3.8, z0: -0.9 };

const add = (o, cast = true, recv = true) => {
  o.traverse?.((c) => {
    if (c.isMesh) {
      if (c.castShadow === false || cast) c.castShadow = cast;
      c.receiveShadow = recv;
    }
  });
  scene.add(o);
  return o;
};
const mesh = (g, m, cast = true, recv = true) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = cast;
  o.receiveShadow = recv;
  return o;
};

// ---------------------------------------------------------------------------
// static ground: soil block with carved pit + sump recess
// ---------------------------------------------------------------------------
const BAKE = bakeGround(renderer, FullScreenQuad);
const groundMat = groundMaterial({ bake: BAKE });
// The big static surfaces (cut face at z=0, lawn at y=0) get plain textured
// materials sampling the baked colours; only the small leftover faces (pit
// walls, sump recess) run the procedural shader.
function splitGround(g, bake) {
  const pos = g.attributes.position.array, nrm = g.attributes.normal.array;
  const fr = bake.frontRect, lr = bake.lawnRect;
  const L = { front: [[], [], []], top: [[], [], []], rest: [[], [], []] };
  for (let i = 0; i < pos.length; i += 9) {
    let key = 'rest';
    if (nrm[i + 2] > 0.99 && Math.abs(pos[i + 2]) < 1e-3) key = 'front';
    else if (nrm[i + 1] > 0.99 && Math.abs(pos[i + 1]) < 1e-3) key = 'top';
    const l = L[key];
    for (let k = 0; k < 9; k++) {
      l[0].push(pos[i + k]);
      l[1].push(nrm[i + k]);
    }
    for (let v = 0; v < 3; v++) {
      const x = pos[i + v * 3], y = pos[i + v * 3 + 1], z = pos[i + v * 3 + 2];
      if (key === 'front') l[2].push((x - fr.x) / (fr.z - fr.x), (y - fr.y) / (fr.w - fr.y));
      else if (key === 'top') l[2].push((x - lr.x) / (lr.z - lr.x), (z - lr.y) / (lr.w - lr.y));
      else l[2].push(0, 0);
    }
  }
  const out = {};
  for (const [k, [p, n, uv]] of Object.entries(L)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out[k] = geo;
  }
  return out;
}
const frontMat = new THREE.MeshLambertMaterial({ map: BAKE.frontTex });
const lawnMat = new THREE.MeshLambertMaterial({ map: BAKE.lawnTex });
{
  let boxes = [new THREE.Box3(V(-18, -12, -27), V(18, 0, 0))];
  boxes = subtractBox(boxes, new THREE.Box3(V(PIT.x0, PIT.y0, PIT.z0), V(PIT.x1, 1, 1)));
  boxes = subtractBox(boxes, new THREE.Box3(V(SUMP.x0, SUMP.y0, SUMP.z0), V(SUMP.x1, SUMP.y1, 1)));
  const parts = splitGround(boxesToGeometry(boxes), BAKE);
  scene.add(mesh(parts.front, frontMat), mesh(parts.top, lawnMat), mesh(parts.rest, groundMat));
}
// far lawn + hedges + trees
{
  const far = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), M.farGround, false, true);
  far.position.set(0, -0.02, -27 - 450);
  scene.add(far);
  const house = buildHouse(M, roofMat);
  house.position.set(0, 0, -15.2);
  add(house);
  const hedgeParts = [];
  for (let i = -9; i <= 9; i++) hedgeParts.push(placed(lumpyBlob(1.1, 2, 0.07, 40 + i), i * 1.6, 0.85, -25.2, 0, 0, 0, 1, 0.95, 0.75));
  add(mesh(mergeAll(hedgeParts), M.hedge));
  const trees = [
    [-7.2, -13.6, 1.0, 3], [7.5, -17.2, 1.15, 5], [-9.8, -21.5, 1.3, 7], [10.5, -23.5, 1.25, 9],
    [-4.0, -30.5, 1.7, 11], [3.5, -32.0, 1.9, 13], [-13.0, -31.0, 1.8, 15], [13.5, -33.0, 1.8, 17], [0.0, -38.0, 2.2, 19],
  ];
  const tl = { trunk: [], leaf: [], leafDark: [] };
  for (const [x, z, sc, seed] of trees) {
    const parts = buildTree(seed, sc);
    for (const k of Object.keys(tl)) tl[k].push(...parts[k].map((g) => placed(g, x, 0, z, 0, seed, 0)));
  }
  for (const k of Object.keys(tl)) add(mesh(mergeAll(tl[k]), M[k]));
  const bushes = [[-5.3, -14.6, 1.0], [5.4, -14.8, 1.1], [-6.4, -9.5, 0.9], [6.6, -11.0, 1.0], [-2.6, -14.3, 0.7], [2.7, -14.3, 0.7]];
  const bl = { hedge: [], leafDark: [] };
  bushes.forEach(([x, z, sc], i) => bl[i % 2 ? 'leafDark' : 'hedge'].push(placed(buildBush(100 + i * 9, sc), x, 0, z)));
  for (const k of Object.keys(bl)) add(mesh(mergeAll(bl[k]), M[k]));
  // stones embedded in the lower cut face
  const rocks = { stone: [], stoneDark: [] };
  [[-4.6, -6.9, 0.36], [-3.0, -7.7, 0.26], [-1.5, -6.4, 0.19], [1.7, -7.2, 0.32], [3.3, -6.1, 0.23], [4.5, -7.9, 0.42],
   [-2.2, -8.5, 0.31], [0.9, -8.7, 0.24], [2.7, -9.0, 0.36], [-4.3, -5.5, 0.2], [4.6, -4.9, 0.24], [-0.9, -9.6, 0.4], [3.9, -9.9, 0.3]]
    .forEach(([x, y, r], i) => rocks[i % 3 ? 'stone' : 'stoneDark'].push(placed(lumpyBlob(r, 2, 0.16, 300 + i), x, y, -0.06, i * 0.7, i * 1.3, i * 0.4, 1.25, 0.8, 0.55)));
  for (const k of Object.keys(rocks)) add(mesh(mergeAll(rocks[k]), M[k]));
  // flowers along the house front
  const fl = { flowerPink: [], flowerYellow: [], flowerWhite: [] };
  const rnd = U.mulberry32(77);
  for (let i = 0; i < 70; i++) {
    const x = -4.6 + rnd() * 9.2;
    if (Math.abs(x) < 2.7) continue;
    const k = ['flowerPink', 'flowerYellow', 'flowerWhite'][i % 3];
    fl[k].push(placed(new THREE.IcosahedronGeometry(0.09, 1), x, 0.12 + rnd() * 0.25, -14.75 + rnd() * 0.5));
  }
  for (const [k, list] of Object.entries(fl)) add(mesh(mergeAll(list), M[k]));
}

// ---------------------------------------------------------------------------
// dynamic pieces
// ---------------------------------------------------------------------------
const unitBoxY = (x0, x1, z0, z1) => boxMM(x0, 0, z0, x1, 1, z1); // y in [0,1] -> scale.y = height

// pit fill (shrinks as the hole is dug)
const pitFill = mesh(unitBoxY(PIT.x0, PIT.x1, PIT.z0, PIT.z1), groundMat);
scene.add(pitFill);
// sump plug (soil until the sump appears)
const sumpPlug = mesh(boxMM(SUMP.x0, SUMP.y0, SUMP.z0, SUMP.x1, SUMP.y1, 0), groundMat);
scene.add(sumpPlug);

// dirt pile on the lawn
const dirtMat = groundMaterial({ mode: 1 });
const PILE = V(2.95, 0, -6.7);
const pile = (() => {
  const g = new THREE.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = Math.atan2(v.z, v.x);
    const lump = 1 + 0.08 * Math.sin(a * 5 + v.y * 6) + 0.06 * Math.sin(a * 11 - v.y * 9) + 0.05 * Math.sin(a * 17 + 1.3);
    v.x *= lump;
    v.z *= lump;
    v.y *= 1 + 0.07 * Math.sin(a * 7);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return mesh(g, dirtMat);
})();
scene.add(pile);

// chunk instancing helper
function instanced(geom, mat, count, cast = true) {
  const m = new THREE.InstancedMesh(geom, mat, count);
  m.castShadow = cast;
  m.receiveShadow = true;
  m.frustumCulled = false;
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.userData.n = 0;
  scene.add(m);
  return m;
}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
// only live instances are written; count/visibility are set in endInst()
function beginInst(im) {
  im.userData.n = 0;
}
function setInst(im, i, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  if (!(sx > 1e-4 && sy > 1e-4 && sz > 1e-4)) return;
  _q.setFromEuler(_e.set(rx, ry, rz));
  _m4.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  im.setMatrixAt(im.userData.n++, _m4);
}
function endInst(im) {
  im.count = im.userData.n;
  im.visible = im.userData.n > 0;
  im.instanceMatrix.needsUpdate = true;
}
const chunkGeom = lumpyBlob(0.2, 1, 0.22, 5);

// --- dig chunks: arc from the pit to the pile
const DIG = [];
{
  const rnd = U.mulberry32(11);
  for (let i = 0; i < 42; i++) {
    const step = i % T.digSteps;
    const t0 = T.digStart + step * T.digStep + rnd() * 0.22;
    const depth = (step + 0.5) * (PIT.y0 / T.digSteps);
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    DIG.push({
      t0,
      dur: 0.55 + rnd() * 0.2,
      from: V(PIT.x0 + 0.6 + rnd() * 6.0, depth, -0.5 - rnd() * 2.6),
      to: V(PILE.x + Math.cos(a) * r * 1.5, 0, PILE.z + Math.sin(a) * r * 1.2),
      s: 0.75 + rnd() * 0.7,
      rot: V(rnd() * 6, rnd() * 6, rnd() * 6),
      spin: V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4),
      h: 1.8 + rnd() * 1.6,
    });
  }
}
const digChunks = instanced(chunkGeom, dirtMat, DIG.length);
function pileScale(t) {
  // pile grows as chunks land
  let n = 0;
  for (const c of DIG) n += clamp((t - c.t0 - c.dur) / 0.25);
  const k = n / DIG.length;
  const first = popIn(t, T.pileLand - 0.05, 0.35, 2.0);
  return Math.min(first, 1) * (0.35 + 0.65 * Math.pow(k, 0.6));
}
function pileHeightAt(x, z, t) {
  const s = pileScale(t);
  const dx = (x - PILE.x) / (1.95 * Math.max(s, 0.01)), dz = (z - PILE.z) / (1.55 * Math.max(s, 0.01));
  const r2 = dx * dx + dz * dz;
  return r2 >= 1 ? 0 : Math.sqrt(1 - r2) * 1.15 * s;
}

// --- loose dirt heaps (scene 2) as extruded lumpy profiles, front face = cut
function heapGeom(side, seed) {
  const rnd = U.mulberry32(seed);
  const pts = [];
  const xw = side < 0 ? PIT.x0 : PIT.x1;
  const n = 18;
  // profile: from the wall (high) down to the middle (low)
  pts.push([0, PIT.y0]);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const dist = u * 3.75; // metres from the wall
    const y = PIT.y0 + 1.75 - 1.05 * Math.pow(u, 0.85) + (rnd() - 0.5) * 0.12 + 0.06 * Math.sin(u * 19 + seed);
    pts.push([dist, y]);
  }
  pts.push([3.75, PIT.y0]);
  const shape = new THREE.Shape();
  pts.forEach(([d, y], i) => (i ? shape.lineTo(d * -side, y) : shape.moveTo(d * -side, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: 3.38, bevelEnabled: false, curveSegments: 1 });
  // base on y=0 and origin at the wall, so it grows out from the wall and up from the floor
  g.translate(0, -PIT.y0, -3.39);
  g.computeVertexNormals();
  const m = mesh(g, dirtMat);
  m.position.set(xw, PIT.y0, 0);
  return m;
}
const heapL = heapGeom(-1, 3), heapR = heapGeom(1, 8);
scene.add(heapL, heapR);
const CRUMBLE = [];
{
  const rnd = U.mulberry32(21);
  for (let i = 0; i < 34; i++) {
    const side = i % 2 ? 1 : -1;
    const t0 = T.crumble + rnd() * 1.35;
    CRUMBLE.push({
      t0,
      from: V(side * (3.45 - rnd() * 0.2), -0.1 - rnd() * 0.5, -0.3 - rnd() * 2.9),
      to: V(side * (1.2 + rnd() * 1.9), PIT.y0 + 0.8 + rnd() * 0.6, -0.3 - rnd() * 2.9),
      s: 0.6 + rnd() * 0.8,
      rot: V(rnd() * 6, rnd() * 6, rnd() * 6),
      spin: V(rnd() * 10 - 5, rnd() * 10 - 5, rnd() * 10 - 5),
      popT: T.dirtPop + (side < 0 ? 0 : 0.18) + rnd() * 0.25,
    });
  }
}
const crumbleChunks = instanced(chunkGeom, dirtMat, CRUMBLE.length);
// burst chunks when the loose dirt pops away
const BURST = [];
{
  const rnd = U.mulberry32(31);
  for (let i = 0; i < 40; i++) {
    const side = i < 16 ? -1 : i < 32 ? 1 : 0;
    const t0 = side === 0 ? T.dirtPop + 0.35 + rnd() * 0.2 : T.dirtPop + (side < 0 ? 0 : 0.18) + rnd() * 0.2;
    const from = side === 0
      ? V(PILE.x + (rnd() - 0.5) * 2.4, 0.3 + rnd() * 0.7, PILE.z + (rnd() - 0.5) * 2.0)
      : V(side * (1.0 + rnd() * 2.4), PIT.y0 + 0.3 + rnd() * 1.1, -0.2 - rnd() * 3.0);
    BURST.push({ t0, from, vel: V((rnd() - 0.5) * 3, 3 + rnd() * 3.5, (rnd() - 0.5) * 2), s: 0.6 + rnd() * 0.6, rot: V(rnd() * 6, rnd() * 6, rnd() * 6) });
  }
}
const burstChunks = instanced(chunkGeom, dirtMat, BURST.length);

// --- puffs (dust, exhaust, vent smoke) share a blob geometry
const puffGeom = lumpyBlob(1, 1, 0.12, 9);
const DUST = [];
{
  const rnd = U.mulberry32(41);
  // landing dust (scene 1) + crumble dust (scene 2) + tyre dust (scene 4) + pile thud
  for (let i = 0; i < 10; i++) DUST.push({ t0: T.carNoseHit + rnd() * 0.45, life: 1.3 + rnd() * 0.6, p: V(-2.4 + rnd() * 3.2, PIT.y0 + 0.2, -0.4 - rnd() * 2.4), v: V((rnd() - 0.5) * 1.6, 0.8 + rnd() * 1.2, (rnd() - 0.5) * 0.4), r: 0.35 + rnd() * 0.35 });
  for (let i = 0; i < 26; i++) DUST.push({ t0: T.slideIn + 0.2 + rnd() * 1.4, life: 1.6 + rnd() * 0.8, p: V((rnd() - 0.5) * 6.2, PIT.y0 + 0.9 + rnd() * 1.2, -0.3 - rnd() * 2.8), v: V((rnd() - 0.5) * 1.2, 1.2 + rnd() * 1.6, (rnd() - 0.5) * 0.4), r: 0.45 + rnd() * 0.5 });
  for (let i = 0; i < 18; i++) DUST.push({ t0: T.spinStart + 0.1 + rnd() * 2.1, life: 0.9 + rnd() * 0.5, p: V(-1.12 + (rnd() - 0.5) * 0.3, IN.floor + 0.15, -0.6 - rnd() * 0.3), v: V(-1.5 - rnd() * 1.5, 0.5 + rnd() * 0.7, (rnd() - 0.5) * 0.3), r: 0.22 + rnd() * 0.2 });
  for (let i = 0; i < 8; i++) DUST.push({ t0: T.pileLand + rnd() * 0.15, life: 1.0 + rnd() * 0.4, p: V(PILE.x + (rnd() - 0.5) * 2.4, 0.15, PILE.z + (rnd() - 0.5) * 1.6), v: V((rnd() - 0.5) * 1.5, 0.5 + rnd() * 0.5, (rnd() - 0.5) * 1.0), r: 0.3 + rnd() * 0.25 });
}
const dustPuffs = instanced(puffGeom, M.dust, DUST.length, false);
dustPuffs.renderOrder = 3;

// --- concrete
const concMat = concreteMaterial();
const backWall = mesh(unitBoxY(PIT.x0, PIT.x1, PIT.z0, IN.z0), concMat);
const leftWall = mesh(unitBoxY(PIT.x0, IN.x0, IN.z0, 0), concMat);
const rightWall = mesh(unitBoxY(IN.x1, PIT.x1, IN.z0, 0), concMat);
const floorSlab = mesh(unitBoxY(IN.x0, IN.x1, IN.z0, 0), concMat);
for (const w of [backWall, leftWall, rightWall, floorSlab]) {
  w.position.y = PIT.y0;
  scene.add(w);
}

// --- car
const car = buildCar(M);
add(car.root);

// --- rain cloud + rain
const cloud = new THREE.Group();
{
  const parts = [], partsL = [];
  const blobs = [[0, 0, 0, 1.0], [-1.0, -0.15, 0.1, 0.75], [1.05, -0.12, 0.05, 0.8], [-0.45, 0.45, -0.1, 0.72], [0.55, 0.4, 0.0, 0.7], [1.7, -0.3, -0.1, 0.5], [-1.75, -0.32, -0.05, 0.5]];
  blobs.forEach(([x, y, z, r], i) => (i % 3 === 1 ? partsL : parts).push(placed(lumpyBlob(r, 2, 0.05, 60 + i), x, y, z, 0, 0, 0, 1, 0.82, 0.8)));
  cloud.add(mesh(mergeAll(parts), M.cloud, false, true), mesh(mergeAll(partsL), M.cloudLight, false, true));
}
const CLOUD_POS = V(0.5, 5.4, -1.9);
scene.add(cloud);
const RAIN = [];
{
  const rnd = U.mulberry32(51);
  for (let i = 0; i < 220; i++) RAIN.push({ x: CLOUD_POS.x - 2.2 + rnd() * 4.4, z: CLOUD_POS.z - 1.2 + rnd() * 2.4, ph: rnd(), sp: 9 + rnd() * 3, dens: rnd() });
}
const rainDrops = instanced(new THREE.BoxGeometry(0.022, 0.42, 0.022), M.rain, RAIN.length, false);
rainDrops.renderOrder = 4;

// --- water in the room
const water = mesh(unitBoxY(IN.x0, IN.x1, IN.z0, 0.0), M.water, false, false);
water.renderOrder = 2;
scene.add(water);
const waterTopGeom = new THREE.PlaneGeometry(IN.x1 - IN.x0, -IN.z0, 44, 20).rotateX(-Math.PI / 2);
waterTopGeom.translate(0, 0, IN.z0 / 2);
const waterTopBase = waterTopGeom.attributes.position.array.slice();
const waterTop = mesh(waterTopGeom, M.waterTop, false, false);
waterTop.renderOrder = 2;
scene.add(waterTop);

// --- drainage: gravel, grate, drain pipe, sump, pump, discharge pipe, outlet
const gravel = mesh(boxMM(-3.92, -3.75, -0.03, 3.92, PIT.y0, 0.006), gravelMaterial(), false, true);
scene.add(gravel);
const grate = new THREE.Group();
{
  const parts = [boxMM(-2.97, IN.floor - 0.02, -0.44, -2.53, IN.floor + 0.012, -0.02)];
  const bars = [];
  for (let i = 0; i < 6; i++) bars.push(boxMM(-2.94 + i * 0.075, IN.floor + 0.012, -0.42, -2.905 + i * 0.075, IN.floor + 0.03, -0.04));
  grate.add(mesh(mergeAll(parts), M.trimBlack, false), mesh(mergeAll(bars), M.grate, false));
}
scene.add(grate);

// rounded-corner polyline tube that can "grow" along its length via drawRange
function pipeTube(points, radius, mat, cornerR = 0.16, radial = 14) {
  const path = new THREE.CurvePath();
  const P = points.map((p) => V(...p));
  let prev = P[0].clone();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    const dir = b.clone().sub(a).normalize();
    if (i < P.length - 1) {
      const c = P[i + 1];
      const dir2 = c.clone().sub(b).normalize();
      const r = Math.min(cornerR, b.distanceTo(a) / 2, c.distanceTo(b) / 2);
      const p1 = b.clone().addScaledVector(dir, -r), p2 = b.clone().addScaledVector(dir2, r);
      path.add(new THREE.LineCurve3(prev, p1));
      path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2));
      prev = p2;
    } else {
      path.add(new THREE.LineCurve3(prev, b.clone()));
    }
  }
  const L = path.getLength();
  const segs = Math.max(24, Math.round(L * 30));
  const g = new THREE.TubeGeometry(path, segs, radius, radial, false);
  const m = mesh(g, mat, true, true);
  m.userData = { total: g.index.count, segs, path, L };
  scene.add(m);
  return m;
}
const setGrow = (tube, k) => {
  const per = tube.userData.total / tube.userData.segs;
  const n = Math.round(clamp(k) * tube.userData.segs) * per;
  tube.geometry.setDrawRange(0, n);
  tube.visible = n > 0;
};
const drainPipe = pipeTube([[-2.75, IN.floor, -0.02], [-2.75, SUMP.y1 + 0.05, -0.02]], 0.085, M.pvc, 0.1);
const DISCHARGE = [[-3.1, -4.45, -0.02], [-3.1, -4.12, -0.02], [-4.25, -4.12, -0.02], [-4.25, 0.22, -0.02], [-4.62, 0.22, -0.02]];
const dischargePipe = pipeTube(DISCHARGE, 0.095, M.pipe);
const outletNozzle = mesh(placed(new THREE.CylinderGeometry(0.13, 0.1, 0.12, 16), -4.66, 0.22, -0.02, 0, 0, Math.PI / 2), M.pipe);
scene.add(outletNozzle);
const sumpGroup = new THREE.Group();
{
  const { x0, x1, y0, y1, z0 } = SUMP;
  const th = 0.06;
  const liner = [
    boxMM(x0, y0, z0, x1, y1, z0 + th),
    boxMM(x0, y0, z0, x0 + th, y1, 0),
    boxMM(x1 - th, y0, z0, x1, y1, 0),
    boxMM(x0, y0, z0, x1, y0 + th, 0),
  ];
  sumpGroup.add(mesh(mergeAll(liner), M.sumpLiner, false, true));
  const sw = mesh(boxMM(x0 + th, y0 + th, z0 + th, x1 - th, y0 + 0.55, 0.0), M.water, false, false);
  sw.renderOrder = 2;
  sumpGroup.add(sw);
}
sumpGroup.position.set((SUMP.x0 + SUMP.x1) / 2, (SUMP.y0 + SUMP.y1) / 2, 0);
sumpGroup.children.forEach((c) => c.position.set(-(SUMP.x0 + SUMP.x1) / 2, -(SUMP.y0 + SUMP.y1) / 2, 0));
scene.add(sumpGroup);
const pump = new THREE.Group();
{
  pump.add(mesh(placed(new THREE.CylinderGeometry(0.19, 0.2, 0.36, 20), 0, 0.18, 0), M.pump));
  pump.add(mesh(placed(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 20), 0, 0.37, 0), M.pumpCap));
  pump.add(mesh(placed(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 12), 0, 0.43, 0), M.pumpCap));
  pump.position.set(-3.1, SUMP.y0 + 0.06, -0.3);
}
scene.add(pump);
// water flow dots (drain -> sump -> pump -> lawn)
const WATER_PATH = U.polyPath([
  [-1.6, -2.2, -0.18], [-2.75, IN.floor + 0.05, -0.16], [-2.75, IN.floor - 0.1, 0.11], [-2.75, SUMP.y1 + 0.02, 0.11],
  [-2.85, -4.5, -0.05], [-3.1, -4.55, -0.05], [-3.1, -4.12, 0.12], [-4.25, -4.12, 0.12], [-4.25, 0.22, 0.12], [-4.7, 0.22, 0.1],
]);
const WDOTS = 64;
const waterDots = instanced(new THREE.SphereGeometry(0.075, 8, 6), M.dot, WDOTS, false);
const SPLASH = [];
{
  const rnd = U.mulberry32(61);
  for (let i = 0; i < 26; i++) SPLASH.push({ ph: rnd(), vx: -1.4 - rnd() * 1.4, vz: -(rnd() * 0.9), vy: 0.8 + rnd() * 0.9 });
}
const splashDots = instanced(new THREE.SphereGeometry(0.06, 8, 5), M.dot, SPLASH.length, false);
const puddle = mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), M.waterTop, false, false);
puddle.position.set(-5.35, 0.012, -0.75);
puddle.renderOrder = 2;
scene.add(puddle);

// --- lift: casing, rod, platform
const casing = new THREE.Group();
{
  casing.add(mesh(placed(new THREE.CylinderGeometry(0.28, 0.28, 3.6, 28), 0, -1.8, 0), M.darkSteel));
  casing.add(mesh(placed(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 28), 0, -0.04, 0), M.steel));
  casing.position.set(0, IN.floor + 0.005, LIFT_Z);
}
scene.add(casing);
const ROD_LEN = 3.15;
const rod = mesh(placed(new THREE.CylinderGeometry(0.12, 0.12, ROD_LEN, 24), 0, -ROD_LEN / 2, 0), M.chrome);
scene.add(rod);
const platMat = platformMaterial();
const PLAT = { x0: -2.35, x1: 2.35, z0: -2.95, z1: 0.06, th: 0.25 };
const platform = mesh(boxMM(PLAT.x0, -PLAT.th, PLAT.z0, PLAT.x1, 0, PLAT.z1), platMat);
platMat.userData.uniforms.uHalf.value.set((PLAT.x1 - PLAT.x0) / 2, (PLAT.z1 - PLAT.z0) / 2);
scene.add(platform);

// --- exhaust + vent
const PUFFS = [];
{
  const rnd = U.mulberry32(71);
  const n = 70;
  for (let i = 0; i < n; i++) {
    const te = T.puffsStart + (i / n) * (T.puffsEnd - T.puffsStart) + rnd() * 0.05;
    PUFFS.push({
      te,
      rest: V(IN.x0 + 0.6 + rnd() * 5.4, IN.floor + 0.5 + Math.pow(rnd(), 0.7) * 2.2, -0.35 - rnd() * 2.5),
      r: 0.38 + rnd() * 0.32,
      ph: rnd() * 10,
      tc: 0,
    });
  }
  // clear order: puffs nearest the vent leave first
  const sorted = [...PUFFS].sort((a, b) => b.rest.x + b.rest.y * 0.6 - (a.rest.x + a.rest.y * 0.6));
  sorted.forEach((p, k) => (p.tc = T.smokeOut + (k / sorted.length) * (T.roomClear - T.smokeOut - 0.6)));
}
const exhaustPuffs = instanced(puffGeom, M.exhaust, PUFFS.length, false);
exhaustPuffs.renderOrder = 3;
const VENT_IN = V(IN.x1 - 0.15, -0.78, -0.02);
const VENT_PTS = [[IN.x1 - 0.12, -0.78, -0.02], [4.25, -0.78, -0.02], [4.25, 1.62, -0.02]];
const ventPipe = pipeTube(VENT_PTS, 0.13, M.pipe, 0.2);
const ventGrille = mesh(placed(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), IN.x1 - 0.1, -0.78, -0.02, 0, 0, Math.PI / 2), M.grate);
scene.add(ventGrille);
const fan = new THREE.Group();
const fanBlades = new THREE.Group();
{
  const housing = mesh(placed(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 32, 1, true), 0, 0, 0, Math.PI / 2, 0, 0), M.pipe);
  housing.material = M.pipe;
  const back = mesh(placed(new THREE.CircleGeometry(0.44, 32), 0, 0, -0.16), M.pipe);
  const ring = mesh(placed(new THREE.TorusGeometry(0.43, 0.035, 10, 40), 0, 0, 0.17), M.pipe);
  const guard = [];
  for (let k = 0; k < 4; k++) guard.push(placed(new THREE.BoxGeometry(0.86, 0.018, 0.018), 0, 0, 0.18, 0, 0, (k * Math.PI) / 4));
  const guardM = mesh(mergeAll(guard), M.pipe, false);
  const top = mesh(placed(new THREE.CylinderGeometry(0.12, 0.12, 0.45, 18), 0, 0.6, 0), M.pipe);
  const cap = mesh(placed(new THREE.ConeGeometry(0.28, 0.16, 20), 0, 0.92, 0), M.pipe);
  const neck = mesh(placed(new THREE.CylinderGeometry(0.13, 0.13, 0.3, 18), 0, -0.5, 0), M.pipe);
  fan.add(housing, back, ring, guardM, top, cap, neck);
  const bl = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    bl.push(placed(new THREE.BoxGeometry(0.15, 0.36, 0.02), Math.cos(a + Math.PI / 2) * 0.2, Math.sin(a + Math.PI / 2) * 0.2, 0, 0.45, 0, a));
  }
  fanBlades.add(mesh(mergeAll(bl), M.fanBlade, false));
  fanBlades.add(mesh(placed(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 16), 0, 0, 0, Math.PI / 2, 0, 0), M.fanHub, false));
  fanBlades.position.z = 0.04;
  fan.add(fanBlades);
}
const FAN_POS = V(4.25, 2.05, -0.02);
scene.add(fan);
const AIR_PATH = U.polyPath([
  [-2.9, 1.4, -0.45], [-2.9, 0.1, -0.45], [-2.95, IN.floor + 0.45, -0.4], [-2.2, IN.floor + 0.22, -0.32], [1.9, IN.floor + 0.22, -0.32], [2.75, -2.1, -0.32], [2.95, -1.25, -0.3],
]);
const ADOTS = 46;
const airDots = instanced(new THREE.SphereGeometry(0.075, 8, 6), M.dot, ADOTS, false);
const OUTSMOKE = [];
{
  const rnd = U.mulberry32(81);
  for (let i = 0; i < 26; i++) OUTSMOKE.push({ te: T.smokeOut + 0.45 + (i / 26) * (T.roomClear - T.smokeOut), life: 1.7 + rnd() * 0.6, dx: 0.4 + rnd() * 0.8, r: 0.28 + rnd() * 0.22 });
}
const outSmoke = instanced(puffGeom, M.smoke, OUTSMOKE.length, false);
outSmoke.renderOrder = 3;

// --- roof: four posts + steel plate + turf, grass tufts
const posts = [];
for (const [x, z] of [[-2.15, -0.28], [2.15, -0.28], [-2.15, -2.65], [2.15, -2.65]]) {
  const p = mesh(placed(new THREE.CylinderGeometry(0.075, 0.075, 1, 16), 0, 0.5, 0), M.chrome);
  p.position.set(x, 0, z);
  posts.push(p);
  scene.add(p);
}
const POST_LEN = -0.2 - LIFT_LOW; // 2.55
const turfMat = groundMaterial({ mode: 2, grow: 0, bake: BAKE });
const roof = new THREE.Group();
{
  roof.add(mesh(boxMM(PIT.x0, -0.2, PIT.z0, PIT.x1, -0.1, 0), M.steel));
  roof.add(mesh(boxMM(PIT.x0, -0.1, PIT.z0, PIT.x1, 0, 0), turfMat));
}
scene.add(roof);
// seam that appears around the hidden roof just before the lawn splits open
const seamMat = new THREE.MeshBasicMaterial({ color: 0x1a120b, transparent: true, opacity: 0, depthWrite: false });
const seam = new THREE.Mesh(
  mergeAll([
    boxMM(PIT.x0 - 0.02, 0.001, PIT.z0 - 0.02, PIT.x1 + 0.02, 0.006, PIT.z0 + 0.025),
    boxMM(PIT.x0 - 0.02, 0.001, PIT.z0, PIT.x0 + 0.025, 0.006, 0),
    boxMM(PIT.x1 - 0.025, 0.001, PIT.z0, PIT.x1 + 0.02, 0.006, 0),
  ]),
  seamMat
);
seam.renderOrder = 4;
scene.add(seam);
const TUFTS = [];
{
  const rnd = U.mulberry32(91);
  for (let i = 0; i < 520; i++) TUFTS.push({ x: PIT.x0 + 0.1 + rnd() * 7.0, z: PIT.z0 + 0.1 + rnd() * 3.2, t: rnd(), s: 0.7 + rnd() * 0.6, r: rnd() * 6.28 });
}
const tuftGeom = (() => {
  const parts = [];
  for (let k = 0; k < 4; k++) parts.push(placed(new THREE.ConeGeometry(0.028, 0.2, 4), Math.cos(k * 1.7) * 0.03, 0.1, Math.sin(k * 1.7) * 0.03, Math.cos(k * 2.1) * 0.25, 0, Math.sin(k * 2.1) * 0.25));
  return mergeAll(parts);
})();
const tufts = instanced(tuftGeom, M.tuft, TUFTS.length, false);

// ---------------------------------------------------------------------------
// animation: everything is a function of time t
// ---------------------------------------------------------------------------
const pitBottom = (t) => {
  let y = 0;
  for (let i = 0; i < T.digSteps; i++) {
    const k = popIn(t, T.digStart + i * T.digStep, 0.3, 1.6);
    y += k * (PIT.y0 / T.digSteps);
  }
  return Math.max(PIT.y0, y);
};

function liftTopY(t) {
  if (t < T.liftUp) return LIFT_LOW;
  const seg = (a, b) => easeInOutCubic(prog(t, a, b - a));
  if (t < T.liftDown) return lerp(LIFT_LOW, 0, seg(T.liftUp, T.liftTop));
  if (t < T.lift2Up) return lerp(0, LIFT_LOW, seg(T.liftDown, T.liftBottom));
  if (t < T.lift2Down) return lerp(LIFT_LOW, 0, seg(T.lift2Up, T.lift2Top));
  if (t < T.rise) return lerp(0, LIFT_LOW, seg(T.lift2Down, T.lift2Bottom));
  if (t < T.sink) return lerp(LIFT_LOW, 0, seg(T.rise, T.riseTop));
  return lerp(0, LIFT_LOW, seg(T.sink, T.sinkBottom));
}

function waterLevel(t) {
  const fill = smooth(prog(t, T.waterRise, T.waterFull - T.waterRise));
  const drain = smooth(prog(t, T.drainStart, T.drainEnd - T.drainStart));
  return IN.floor + 1.95 * fill * (1 - drain);
}

// rotate (x,y) by angle a about the z axis
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// S-curve across the lawn (from the back left) arriving diagonally at the pit edge
const EDGE_X = PIT.x0;
const X_EDGE = EDGE_X - car.WA; // car origin when the front axle reaches the edge
const P0 = [-8.8, -7.4], P1 = [-5.6, -7.6], P2 = [-6.6, -3.0], P3 = [X_EDGE, CAR_Z];
const YAW_EDGE = -Math.atan2(P3[1] - P2[1], P3[0] - P2[0]);
function carScene1(t, s) {
  if (t < T.carEdge) {
    const u = prog(t, T.carEnter, T.carEdge - T.carEnter);
    const k = u * (1.1 - 0.1 * u); // nearly constant speed, a touch of braking at the end
    const q = U.bezier2(P0, P1, P2, P3, k);
    const q2 = U.bezier2(P0, P1, P2, P3, Math.min(1, k + 0.01));
    s.x = q[0];
    s.z = q[1];
    s.yaw = k >= 0.99 ? YAW_EDGE : -Math.atan2(q2[1] - q[1], q2[0] - q[0]);
    s.spinDist = k * 9.0;
    return;
  }
  const c0 = 0.24; // underbody height
  if (t < T.carTipEnd) {
    const u = prog(t, T.carEdge, T.carTipEnd - T.carEdge);
    const th = -0.56 * u * u;
    const cx = lerp(car.WA, -0.15, u);
    const ex = EDGE_X, ey = c0 * (1 - u) + 0.02;
    const [rx, ry] = rot2(cx, c0, th);
    s.x = ex - rx;
    s.y = ey - ry;
    s.pitch = th;
    s.z = CAR_Z;
    s.yaw = YAW_EDGE * (1 - easeOutCubic(u));
    s.spinDist = 9.0 + u * 1.3;
    return;
  }
  // tip-end state
  const thTE = -0.56, cxTE = -0.15;
  const [rxT, ryT] = rot2(cxTE, c0, thTE);
  const oTE = [EDGE_X - rxT, 0.02 - ryT];
  const thNH = (-58 * Math.PI) / 180;
  const nose = [1.86, 0.55];
  const [nx, ny] = rot2(nose[0], nose[1], thNH);
  const oNH = [-1.4 - nx, PIT.y0 - ny];
  if (t < T.carNoseHit) {
    const u = prog(t, T.carTipEnd, T.carNoseHit - T.carTipEnd);
    s.x = lerp(oTE[0], oNH[0], u);
    s.y = lerp(oTE[1], oNH[1], easeInQuad(u));
    s.pitch = lerp(thTE, thNH, u);
    s.z = CAR_Z;
    return;
  }
  const oF = [-2.0, PIT.y0];
  if (t < T.carFlat) {
    const u = prog(t, T.carNoseHit, T.carFlat - T.carNoseHit);
    s.x = lerp(oNH[0], oF[0], 1 - Math.pow(1 - u, 3));
    s.y = lerp(oNH[1], oF[1], easeInQuad(u));
    s.pitch = lerp(thNH, 0, easeInQuad(u));
    s.z = CAR_Z;
    return;
  }
  // funny bounce + roll forward to the centre
  const u = prog(t, T.carFlat, T.carSettle + 0.25 - T.carFlat);
  s.x = lerp(oF[0], 0, easeOutCubic(u));
  const hop = Math.max(0, Math.sin(prog(t, T.carFlat + 0.06, 0.42) * Math.PI)) * 0.42 + Math.max(0, Math.sin(prog(t, T.carFlat + 0.5, 0.26) * Math.PI)) * 0.1;
  s.y = PIT.y0 + hop;
  s.pitch = 0.09 * wobble(t, T.carFlat, 2.6, 4.5);
  s.z = CAR_Z;
  const sq1 = Math.exp(-14 * Math.max(0, t - T.carFlat)) * (t >= T.carFlat ? 1 : 0);
  const sq2 = Math.exp(-16 * Math.max(0, t - (T.carFlat + 0.48))) * (t >= T.carFlat + 0.48 ? 1 : 0);
  s.squash = 1 - 0.2 * sq1 * (1 - hop) - 0.08 * sq2;
}

const carState = { x: 0, y: 0, z: CAR_Z, yaw: 0, pitch: 0, roll: 0, squash: 1, bodyY: 0, spin: null, spinDist: 0 };
function updateCar(t) {
  const s = carState;
  Object.assign(s, { x: 0, y: PIT.y0, z: CAR_Z, yaw: 0, pitch: 0, roll: 0, squash: 1, bodyY: 0, spin: null, spinDist: 10.3 });
  if (t < T.carSettle + 0.3) {
    s.y = 0;
    s.x = P0[0];
    s.z = P0[1];
    carScene1(t, s);
  } else {
    s.x = 0;
    s.y = PIT.y0;
  }
  // "sort of." deflate beat
  s.squash *= 1 - 0.06 * bump(t, T.sortOf - 0.05, T.sortOf + 0.45, 0.15);
  // crumble shudder
  s.x += 0.03 * Math.sin(t * 70) * bump(t, T.slideIn, T.buried, 0.2);
  // floor slab pushes the car up
  const slab = popIn(t, T.floor, 0.5, 1.8);
  if (t >= T.floor) s.y = PIT.y0 + 0.3 * slab;
  // floating
  if (t >= T.waterRise && t < T.spinStart) {
    const L = waterLevel(t);
    const floatY = Math.max(IN.floor, L - 0.62);
    const f = clamp((floatY - IN.floor) / 0.4);
    s.y = floatY + 0.05 * Math.sin(t * 4.6) * f;
    s.pitch = 0.05 * Math.sin(t * 2.3 + 1) * f;
    s.roll = 0.03 * Math.sin(t * 3.1) * f;
    s.x = 0.18 * Math.sin((t - T.waterRise) * 0.9) * f;
    s.squash *= 1 - 0.07 * Math.exp(-10 * Math.max(0, t - T.drainEnd)) * (t > T.drainEnd ? 1 : 0);
  }
  // stuck: wheels spin, nose tries to climb the wall
  if (t >= T.spinStart && t < T.casing) {
    s.y = IN.floor;
    const xBump = IN.x1 - 1.87;
    const a1 = prog(t, T.spinStart, T.bump1 - T.spinStart), b1 = prog(t, T.bump1, 0.45);
    const a2 = prog(t, T.bump1 + 0.45, T.bump2 - T.bump1 - 0.45), b2 = prog(t, T.bump2, 0.6);
    let x = 0, p = 0;
    if (t < T.bump1) x = lerp(0, xBump, easeInQuad(a1));
    else if (t < T.bump1 + 0.45) { x = lerp(xBump, xBump - 0.6, easeOutCubic(b1)); p = 0.2 * Math.sin(b1 * Math.PI); }
    else if (t < T.bump2) x = lerp(xBump - 0.6, xBump, easeInQuad(a2));
    else { x = lerp(xBump, 0, easeInOutCubic(b2)); p = 0.27 * Math.sin(Math.min(1, b2 * 2.2) * Math.PI); }
    s.x = x;
    s.pitch = p;
    s.spin = (t - T.spinStart) * 26 * (t < T.spinEnd ? 1 : Math.exp(-(t - T.spinEnd) * 3));
    s.y += 0.015 * Math.sin(t * 60) * bump(t, T.spinStart, T.spinEnd, 0.2);
  }
  // onto the platform, then ride the lift
  if (t >= T.platform) {
    const hopU = prog(t, T.platform, 0.38);
    const ly = liftTopY(t);
    s.y = t < T.platform + 0.38 ? lerp(IN.floor, LIFT_LOW, easeOutCubic(hopU)) + Math.sin(hopU * Math.PI) * 0.3 : ly;
    s.squash *= 1 - 0.08 * Math.exp(-12 * Math.max(0, t - T.platform - 0.38)) * (t > T.platform + 0.38 ? 1 : 0);
  }
  // engine running: idle shake
  const idle = bump(t, T.engineOn, T.engineOff, 0.15);
  s.bodyY += idle * 0.012 * Math.sin(t * 95);
  s.roll += idle * 0.006 * Math.sin(t * 77);

  car.root.position.set(s.x, s.y, s.z);
  car.root.rotation.set(0, s.yaw, 0);
  car.pitch.rotation.set(s.roll, 0, s.pitch);
  car.body.position.y = s.bodyY;
  const sq = s.squash;
  car.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  // wheel rotation from travelled distance (scene 1) or explicit spin
  let ang;
  if (s.spin !== null) ang = -s.spin;
  else if (t < T.carSettle + 0.3) ang = -(s.spinDist + Math.max(0, s.x + 2.0) * (t > T.carFlat ? 1 : 0)) / car.R;
  else ang = -(10.3 + 2.0) / car.R;
  for (const w of car.wheels) w.spin.rotation.z = ang;
  car.root.visible = t >= T.carEnter - 0.05;
  // lights
  const flash = t > T.rise ? Math.max(bump(t, T.flash1, T.flash1 + 0.28, 0.05), bump(t, T.flash2, T.flash2 + 0.34, 0.05)) : 0;
  const on = Math.max(flash, 0.25 * bump(t, T.riseTop - 0.6, T.sink + 0.5, 0.3));
  M.headlight.emissiveIntensity = 0.15 + 9 * on;
  M.glow.opacity = 0.95 * flash;
  M.beam.opacity = 0.16 * flash;
  car.glow.visible = flash > 0.001;
  car.beams.visible = flash > 0.001;
  M.taillight.emissiveIntensity = 0.25 + 1.6 * bump(t, T.engineOn, T.engineOff, 0.2);
}

const tmpV = new THREE.Vector3();
function update(t) {
  // --- digging
  const pb = pitBottom(t);
  const fillH = pb - PIT.y0;
  pitFill.visible = fillH > 0.005;
  pitFill.position.y = PIT.y0;
  pitFill.scale.y = Math.max(fillH, 0.001);
  beginInst(digChunks);
  DIG.forEach((c, i) => {
    const u = (t - c.t0) / c.dur;
    if (u < 0 || t > T.dirtPop + 0.6) return setInst(digChunks, i, 0, 0, 0, 0);
    const k = Math.min(u, 1);
    const fromY = Math.max(c.from.y, pitBottom(c.t0));
    const toY = pileHeightAt(c.to.x, c.to.z, c.t0 + c.dur) + 0.05;
    const x = lerp(c.from.x, c.to.x, k), z = lerp(c.from.z, c.to.z, k);
    const y = lerp(fromY, toY, k) + Math.sin(k * Math.PI) * (c.h + (toY - fromY) * 0.2);
    const sc = 0.2 + 0.8 * popIn(t, c.t0, 0.15, 2) * c.s * (t > T.dirtPop + 0.3 ? popOut(t, T.dirtPop + 0.3, 0.25) : 1);
    const r = Math.min(u, 1);
    setInst(digChunks, i, x, y, z, sc, sc, sc, c.rot.x + c.spin.x * r, c.rot.y + c.spin.y * r, c.rot.z + c.spin.z * r);
  });
  endInst(digChunks);
  const ps = pileScale(t) * popOut(t, T.dirtPop + 0.35, 0.3);
  pile.visible = ps > 0.002;
  pile.position.copy(PILE);
  pile.scale.set(1.95 * Math.max(ps, 0.001), 1.15 * Math.max(ps, 0.001) * (1 - 0.15 * wobble(t, T.pileLand + 0.2, 3, 6)), 1.55 * Math.max(ps, 0.001));

  // --- crumble heaps
  const slide = (side) => {
    const k = clamp(easeOutBack(prog(t, T.slideIn + (side > 0 ? 0.12 : 0), T.buried - T.slideIn), 1.2), 0, 1.1);
    const out = popOut(t, T.dirtPop + (side > 0 ? 0.18 : 0), 0.32);
    return k * out;
  };
  for (const [hm, side] of [[heapL, -1], [heapR, 1]]) {
    const k = slide(side);
    hm.visible = k > 0.003;
    hm.scale.set(Math.max(k, 0.001), Math.max(0.25 + 0.75 * k, 0.001), 1);
  }
  beginInst(crumbleChunks);
  CRUMBLE.forEach((c, i) => {
    const u = prog(t, c.t0, 0.55);
    if (t < c.t0) return setInst(crumbleChunks, i, 0, 0, 0, 0);
    const x = lerp(c.from.x, c.to.x, easeOutCubic(u));
    const y = lerp(c.from.y, c.to.y, easeInQuad(u)) + (u >= 1 ? 0.12 * Math.abs(wobble(t, c.t0 + 0.55, 2.4, 6)) : 0);
    const z = lerp(c.from.z, c.to.z, u);
    const sc = c.s * popIn(t, c.t0, 0.12, 1.5) * popOut(t, c.popT, 0.25);
    setInst(crumbleChunks, i, x, y, z, sc, sc, sc, c.rot.x + c.spin.x * u, c.rot.y + c.spin.y * u, c.rot.z + c.spin.z * u);
  });
  endInst(crumbleChunks);
  beginInst(burstChunks);
  BURST.forEach((c, i) => {
    const dt = t - c.t0;
    if (dt < 0 || dt > 0.75) return setInst(burstChunks, i, 0, 0, 0, 0);
    const sc = c.s * (dt < 0.08 ? dt / 0.08 : 1) * (1 - smooth(clamp((dt - 0.35) / 0.4)));
    setInst(burstChunks, i, c.from.x + c.vel.x * dt, c.from.y + c.vel.y * dt - 4.9 * dt * dt, c.from.z + c.vel.z * dt, sc, sc, sc, c.rot.x + dt * 7, c.rot.y + dt * 5, c.rot.z);
  });
  endInst(burstChunks);
  beginInst(dustPuffs);
  DUST.forEach((d, i) => {
    const dt = t - d.t0;
    if (dt < 0 || dt > d.life) return setInst(dustPuffs, i, 0, 0, 0, 0);
    const u = dt / d.life;
    const r = d.r * (0.35 + 0.9 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.55) / 0.45)));
    const drag = 1 - Math.exp(-dt * 2.2);
    setInst(dustPuffs, i, d.p.x + (d.v.x * drag) / 2.2, d.p.y + (d.v.y * drag) / 2.2, d.p.z + (d.v.z * drag) / 2.2, r, r * 0.9, r);
  });
  endInst(dustPuffs);

  // --- concrete rising
  const rise = (m, t0, h) => {
    const k = popIn(t, t0, 0.55, 1.5);
    m.visible = k > 0.002;
    m.scale.y = Math.max(k, 0.001) * h;
  };
  rise(backWall, T.backWall, WALL_TOP - PIT.y0);
  rise(leftWall, T.leftWall, WALL_TOP - PIT.y0);
  rise(rightWall, T.rightWall, WALL_TOP - PIT.y0);
  rise(floorSlab, T.floor, IN.floor - PIT.y0);

  // --- rain cloud
  const cIn = popIn(t, T.cloudIn, 0.5, 1.8), cOut = popOut(t, T.cloudOut, 0.45);
  const cs = cIn * cOut;
  cloud.visible = cs > 0.002;
  cloud.position.set(CLOUD_POS.x + 0.15 * Math.sin(t * 0.8), CLOUD_POS.y + 0.06 * Math.sin(t * 1.7), CLOUD_POS.z);
  cloud.scale.setScalar(Math.max(cs, 0.001) * (1 + 0.03 * Math.sin(t * 2.3)));
  const rainOn = bump(t, T.rainStart, T.rainEnd, 0.35);
  const L = waterLevel(t);
  beginInst(rainDrops);
  RAIN.forEach((d, i) => {
    if (rainOn <= d.dens * 0.98) return setInst(rainDrops, i, 0, 0, 0, 0);
    const inPit = Math.abs(d.x) < IN.x1 - 0.05 && d.z > IN.z0 + 0.05 && d.z < -0.05;
    const bottom = inPit ? Math.max(L, IN.floor) : 0;
    const top = CLOUD_POS.y - 0.4;
    const range = top - bottom;
    const y = top - ((t * d.sp + d.ph * 50) % range);
    setInst(rainDrops, i, d.x, y, d.z, 1);
  });
  endInst(rainDrops);

  // --- water in the room
  const wh = L - IN.floor;
  water.visible = wh > 0.01;
  water.position.y = IN.floor;
  water.scale.y = Math.max(wh, 0.001);
  waterTop.visible = water.visible;
  if (waterTop.visible) {
    const pa = waterTopGeom.attributes.position;
    const amp = 0.03 + 0.05 * rainOn;
    for (let i = 0; i < pa.count; i++) {
      const x = waterTopBase[i * 3], z = waterTopBase[i * 3 + 2];
      pa.array[i * 3 + 1] = L + 0.004 + amp * (Math.sin(x * 2.1 + t * 3.1) * 0.6 + Math.sin(z * 3.3 - t * 2.4 + x) * 0.4);
    }
    pa.needsUpdate = true;
    waterTopGeom.computeVertexNormals();
  }

  // --- drainage system
  const gk = popIn(t, T.gravel, 0.45, 1.6);
  gravel.visible = gk > 0.002;
  gravel.scale.set(Math.max(gk, 0.001), 1, 1);
  const gr = popIn(t, T.grate, 0.35, 2.4);
  grate.visible = gr > 0.002;
  grate.scale.setScalar(Math.max(gr, 0.001));
  grate.position.set(-2.75 * (1 - gr), IN.floor * (1 - gr), -0.23 * (1 - gr));
  setGrow(drainPipe, easeOutCubic(prog(t, T.drainPipe, 0.35)));
  const sk = popIn(t, T.sump, 0.42, 1.8);
  sumpPlug.visible = t < T.sump;
  sumpGroup.visible = sk > 0.002;
  sumpGroup.scale.setScalar(Math.max(sk, 0.001));
  const pk = popIn(t, T.pump, 0.4, 2.2);
  pump.visible = pk > 0.002;
  const pumping = bump(t, T.flowStart, T.flowEnd, 0.2);
  pump.scale.setScalar(Math.max(pk, 0.001) * (1 + 0.02 * Math.sin(t * 80) * pumping));
  setGrow(dischargePipe, easeInOutCubic(prog(t, T.dischargePipe, 0.55)));
  const ok = popIn(t, T.outlet, 0.3, 2.4);
  outletNozzle.visible = ok > 0.002;
  outletNozzle.scale.setScalar(Math.max(ok, 0.001));
  outletNozzle.position.set(0, 0, 0);
  // flow dots
  const speed = 3.1;
  beginInst(waterDots);
  for (let i = 0; i < WDOTS; i++) {
    const ph = i / WDOTS;
    const travel = WATER_PATH.length / speed;
    // each dot is re-emitted every `travel` seconds; emission window = flow window
    const cyc = (t - T.flowStart) / travel + ph;
    const u = cyc - Math.floor(cyc);
    const emitted = t - u * travel;
    const on = emitted >= T.flowStart - travel * 0.4 && emitted <= T.flowEnd - travel * 0.55 && t >= T.flowStart;
    if (!on) { setInst(waterDots, i, 0, 0, 0, 0); continue; }
    const p = WATER_PATH.at(u);
    // spread the first segment so the dots converge from the room water
    const spread = (1 - clamp(u / 0.12)) * 1.0;
    const jx = Math.sin(i * 12.9898) * 0.9 * spread, jy = Math.cos(i * 4.1414) * 0.35 * spread;
    const fade = Math.min(1, u / 0.03, (1 - u) / 0.03) * (1 - smooth(prog(t, T.flowEnd, 0.6)));
    setInst(waterDots, i, p[0] + jx, p[1] + jy, p[2], clamp(fade));
  }
  endInst(waterDots);
  const sp = bump(t, T.flowStart + 0.9, T.flowEnd + 0.4, 0.2);
  beginInst(splashDots);
  SPLASH.forEach((d, i) => {
    if (sp <= 0.001) return setInst(splashDots, i, 0, 0, 0, 0);
    const cyc = t * 1.6 + d.ph;
    const u = cyc - Math.floor(cyc);
    const dt = u * 0.55;
    const x = -4.78 + d.vx * dt, z = -0.02 + d.vz * dt, y = 0.22 + d.vy * dt - 4.9 * dt * dt;
    setInst(splashDots, i, x, Math.max(0.03, y), z, sp * (y < 0.04 ? 0.5 : 1));
  });
  endInst(splashDots);
  const pud = smooth(prog(t, T.flowStart + 1.0, 1.6)) * (1 - smooth(prog(t, T.flowEnd + 0.6, 1.4)));
  puddle.visible = pud > 0.01;
  puddle.scale.set(0.9 * pud + 0.01, 1, 0.55 * pud + 0.01);
  M.waterTop.opacity = 0.7;

  // --- lift
  const ck = popIn(t, T.casing, 0.45, 1.6);
  casing.visible = ck > 0.002;
  casing.scale.set(1, Math.max(ck, 0.001), 1);
  const ly = liftTopY(t);
  const pk2 = popIn(t, T.platform, 0.4, 2.0);
  platform.visible = pk2 > 0.002;
  platform.position.set(0, ly, 0);
  platform.scale.set(Math.max(pk2, 0.001), Math.max(pk2, 0.001), Math.max(pk2, 0.001));
  platform.position.z = -1.445 * (1 - pk2);
  platMat.userData.uniforms.uCenter.value.set(0, ly - PLAT.th / 2, (PLAT.z0 + PLAT.z1) / 2);
  const rk = popIn(t, T.rod, 0.35, 1.8);
  rod.visible = rk > 0.002;
  rod.position.set(0, ly - PLAT.th, LIFT_Z);
  rod.scale.set(Math.max(rk, 0.001), 1, Math.max(rk, 0.001));

  // --- exhaust puffs
  const tailWorld = tmpV.set(-1.9, 0.3, 0.45);
  car.body.updateWorldMatrix(true, false);
  tailWorld.applyMatrix4(car.body.matrixWorld);
  beginInst(exhaustPuffs);
  PUFFS.forEach((p, i) => {
    const dt = t - p.te;
    if (dt < 0) return setInst(exhaustPuffs, i, 0, 0, 0, 0);
    // out of the pipe, then drift to its resting place in the room
    const a = 1 - Math.exp(-dt * 1.4);
    const sx = tailWorld.x - 0.6 * Math.min(dt * 4, 1), sy = tailWorld.y + 0.1, sz = tailWorld.z;
    let x = lerp(sx, p.rest.x, a) + 0.15 * Math.sin(t * 0.9 + p.ph);
    let y = lerp(sy, p.rest.y, a) + 0.1 * Math.sin(t * 1.3 + p.ph * 2);
    let z = lerp(sz, p.rest.z, a);
    let r = p.r * (0.25 + 0.75 * easeOutCubic(clamp(dt / 1.2)));
    // sucked to the vent
    const c = prog(t, p.tc, 0.9);
    if (c > 0) {
      const k = easeInQuad(c);
      x = lerp(x, VENT_IN.x, k);
      y = lerp(y, VENT_IN.y, k) + Math.sin(c * Math.PI) * 0.2;
      z = lerp(z, VENT_IN.z, k);
      r *= 1 - k * 0.85;
      if (c >= 1) r = 0;
    }
    setInst(exhaustPuffs, i, x, y, z, r, r * 0.9, r);
  });
  endInst(exhaustPuffs);
  // vent pipe grows up through the soil and out of the lawn
  const vs = easeOutCubic(prog(t, T.ventStub, 0.3));
  const vp = prog(t, T.ventPipe, 0.6);
  const vg = vs * 0.32 + (vp > 0 ? 0.68 * easeOutBack(vp, 1.3) : 0);
  setGrow(ventPipe, Math.min(1, vg));
  ventGrille.visible = t >= T.ventStub;
  ventGrille.scale.setScalar(popIn(t, T.ventStub, 0.3, 2) + 1e-3);
  const fk = popIn(t, T.fanHousing, 0.42, 2.2);
  fan.visible = fk > 0.002;
  fan.position.copy(FAN_POS);
  fan.scale.setScalar(Math.max(fk, 0.001));
  // fan angle: ramp up to ~10 rev/s
  const fs = Math.max(0, t - T.fanSpin);
  const omega = 62;
  fanBlades.rotation.z = -(omega * (fs - (1 - Math.exp(-fs * 1.6)) / 1.6));
  // fresh air dots in low
  const airOn = (tt) => tt >= T.airStart && tt <= T.roomClear + 0.4;
  beginInst(airDots);
  for (let i = 0; i < ADOTS; i++) {
    const travel = AIR_PATH.length / 3.0;
    const cyc = (t - T.airStart) / travel + i / ADOTS;
    const u = cyc - Math.floor(cyc);
    const emitted = t - u * travel;
    if (t < T.airStart || !airOn(emitted) || emitted < T.airStart - travel * 0.25) { setInst(airDots, i, 0, 0, 0, 0); continue; }
    const p = AIR_PATH.at(u);
    const jz = Math.sin(i * 7.31) * 0.12, jy = Math.cos(i * 3.7) * 0.12 * clamp((u - 0.25) * 4);
    const fade = clamp(Math.min(u / 0.06, (1 - u) / 0.12)) * (1 - smooth(prog(t, T.roomClear, 0.7)));
    setInst(airDots, i, p[0], p[1] + jy, p[2] + jz, fade);
  }
  endInst(airDots);
  beginInst(outSmoke);
  OUTSMOKE.forEach((p, i) => {
    const dt = t - p.te;
    if (dt < 0 || dt > p.life) return setInst(outSmoke, i, 0, 0, 0, 0);
    const u = dt / p.life;
    const r = p.r * (0.4 + 1.2 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.6) / 0.4)));
    setInst(outSmoke, i, FAN_POS.x + p.dx * u + 0.08 * Math.sin(dt * 5 + i), FAN_POS.y + 1.0 + u * 2.4, FAN_POS.z, r);
  });
  endInst(outSmoke);

  // --- roof posts, roof drop, grass growth
  posts.forEach((p, i) => {
    const k = popIn(t, T.posts + i * 0.11, 0.4, 1.8);
    p.visible = k > 0.002;
    p.position.y = ly;
    p.scale.set(1, Math.max(k, 0.001) * POST_LEN, 1);
  });
  const roofTarget = ly + POST_LEN + 0.2; // roof top
  const dropU = prog(t, T.roofDrop, 0.55);
  const roofY = roofTarget + (1 - U.easeOutBounce(dropU)) * 2.2;
  roof.visible = t >= T.roofDrop;
  roof.position.y = roofY;
  turfMat.userData.uniforms.uTopY.value = roofY;
  const grow = smooth(prog(t, T.grassStart, T.grassEnd - T.grassStart));
  turfMat.userData.uniforms.uGrow.value = grow;
  beginInst(tufts);
  TUFTS.forEach((d, i) => {
    const t0 = T.grassStart + d.t * (T.grassEnd - T.grassStart - 0.35);
    const k = popIn(t, t0, 0.35, 2.2) * (1 - smooth(prog(t, T.grassEnd + d.t * 0.3, 0.6)));
    if (k <= 0.002 || !roof.visible) return setInst(tufts, i, 0, 0, 0, 0);
    setInst(tufts, i, d.x, roofY, d.z, d.s, d.s * k * 1.2, d.s, 0, d.r, 0);
  });
  endInst(tufts);

  // --- the lawn splits: a dark seam traces the roof edge, gone again once it closes
  const seamK = smooth(prog(t, T.split, T.rise - T.split + 0.15)) * (1 - smooth(prog(t, T.sinkBottom - 0.1, 0.5)));
  seamMat.opacity = 0.75 * seamK;
  seam.visible = seamK > 0.002 && roofY < 0.05;

  // --- lighting mood: golden hour deepening into sunset in the finale
  const warm = smooth(prog(t, T.pushIn, T.riseTop - T.pushIn)) * 0.85;
  sun.color.copy(sunColA).lerp(sunColB, warm);
  sun.intensity = 4.8 - 0.5 * warm;
  skyUniforms.warm.value = warm;
  hemi.intensity = 0.78 - 0.1 * warm;
  grade.uniforms.warm.value = 0.35 + 0.65 * warm;

  updateCar(t);
}

// camera path
function updateCamera(t) {
  const pin = easeInOutCubic(prog(t, T.pushIn, T.pushInEnd - T.pushIn));
  const pout = easeInOutCubic(prog(t, T.pullBack, T.pullBackEnd - T.pullBack));
  const k = pin * (1 - pout);
  const c = {};
  for (const key of Object.keys(CAM_WIDE)) c[key] = lerp(CAM_WIDE[key], CAM_CLOSE[key], k);
  applyCam(c);
}

// ---------------------------------------------------------------------------
// accumulation renderer (Eevee-style): sub-pixel jitter, soft sun, occluded
// sky light and motion blur are averaged over N sub-frames
// ---------------------------------------------------------------------------
// exposure is applied while accumulating, so bloom thresholds work in exposed units
const EXPOSURE = 0.38;
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
    renderer.autoClear = false; // we accumulate into readBuffer, never clear it between sub-frames
    renderer.setRenderTarget(readBuffer);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, true);
    const shutter = 0.5 / FPS;
    for (let s = 0; s < N; s++) {
      const ts = this.frameTime + ((s + 0.5) / N - 0.5) * shutter;
      update(ts);
      updateCamera(this.frameTime);
      camera.jx = U.halton(s + 1, 2) - 0.5;
      camera.jy = U.halton(s + 1, 3) - 0.5;
      camera.updateProjectionMatrix();
      // soft sun: jitter the light inside a small disk; the hard shadow maps average into a penumbra
      const a = U.halton(s + 1, 5) * Math.PI * 2, r = Math.sqrt(U.halton(s + 1, 7)) * 0.024;
      const tang = V(-SUN_DIR.z, 0, SUN_DIR.x).normalize();
      const bit = SUN_DIR.clone().cross(tang).normalize();
      const d = SUN_DIR.clone().addScaledVector(tang, Math.cos(a) * r).addScaledVector(bit, Math.sin(a) * r).normalize();
      sun.position.copy(LIGHT_TARGET).addScaledVector(d, 70);
      const sd = SKY_DIRS[(s * 3) % SKY_DIRS.length];
      skyL.position.copy(LIGHT_TARGET).addScaledVector(sd, 75);
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
const bloom = new UnrealBloomPass(new THREE.Vector2(W / 3, H / 3), 0.42, 0.5, 1.0);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1.0 }, sat: { value: 1.14 }, punch: { value: 1.0 }, warm: { value: 0.35 }, vig: { value: 0.1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float exposure, sat, punch, warm, vig; varying vec2 vUv;
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
      vec3 c = agx(texture2D(tDiffuse, vUv).rgb * exposure);
      c *= mix(vec3(1.0), vec3(1.05, 1.0, 0.92), warm);
      vec2 q = (vUv - 0.5) * vec2(1.0, 0.72);
      c *= 1.0 - vig * smoothstep(0.22, 0.72, length(q));
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
  const px = window.readFrame();
  await fetch(url, { method: 'POST', body: px });
};
window.sendTime = async (t, spp, url) => {
  window.renderTime(t, spp);
  const px = window.readFrame();
  await fetch(url, { method: 'POST', body: px });
};
window.META = { W, H, FPS, DURATION };
window.setGrade = (o) => { for (const [k, v] of Object.entries(o)) grade.uniforms[k].value = v; };
// warm up: compile all programs once
update(0);
updateCamera(0);
renderer.compile(scene, camera);
window.READY = true;
