import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as U from './util.js';
import { T, FPS, DURATION } from './timeline.js';
import * as WD from './world.js';
import {
  concreteMaterial, roofTileMaterial, makeSimpleMats, bakeGround, digTime, tunnelGlow, groundMaterial,
  soilFrontMaterial, tunnelBackMaterial, tunnelBoundaryMaterial, lawnMaterial, brickMaterial, seamMaterial,
} from './materials.js';
import { buildHouse, buildTree, buildBush, box, boxMM, placed, mergeAll, lumpyBlob } from './builders.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildCart, buildBat, buildCandle, buildBulb, buildLid, buildLadder, railGeom, buildSnail } from './props.js';
import { buildBoy, buildMom, buildGirl } from './characters.js';

const { clamp, lerp, prog, popIn, popOut, smooth, easeInOutCubic, easeOutCubic, easeInQuad, easeOutBack, wobble, bump } = U;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const SCALE = +(params.get('scale') || 1); // <1 for quick previews
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const { W: TW, FLOOR, ROOF, SHAFT_L, SHAFT_R, FOOT, STEM, WALL, LID, ARCHES } = WD;

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
    super(30, W / H, 0.3, 900);
    this.fpx = 2688 * SCALE; // focal length in pixels
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

// camera framings: x, height, distance to the cut face, focal length, and the
// pixel row where the lawn's front edge (y=0, z=0) sits
const CAM_WIDE = { cx: 0, cy: 5.7, cz: 21.0, f: 2688 * SCALE, lawnPx: 1000 * SCALE };
const CAM_CLOSE = { cx: 3.0, cy: 1.4, cz: 6.5, f: 2688 * SCALE, lawnPx: 1200 * SCALE };
function applyCam(c) {
  camera.position.set(c.cx, c.cy, c.cz);
  camera.fpx = c.f;
  const vLawn = (-c.f * c.cy) / c.cz;
  camera.vCenter = vLawn + (c.lawnPx - H / 2);
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------------------
// lights + environment
// ---------------------------------------------------------------------------
const SUN_DIR = V(-0.62, 0.42, 0.66).normalize();
const sunColA = new THREE.Color(1.0, 0.76, 0.5), sunColB = new THREE.Color(1.0, 0.62, 0.36);
const LIGHT_TARGET = V(0, -1.5, -9);
const sun = new THREE.DirectionalLight(sunColA.clone(), 4.8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 140 });
sun.shadow.bias = -0.00025;
sun.shadow.normalBias = 0.02;
sun.target.position.copy(LIGHT_TARGET);
scene.add(sun, sun.target);

const skyL = new THREE.DirectionalLight(new THREE.Color(0.55, 0.68, 1.0), 1.4);
skyL.castShadow = true;
skyL.shadow.mapSize.set(512, 512);
Object.assign(skyL.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 150 });
skyL.shadow.bias = -0.0006;
skyL.shadow.normalBias = 0.04;
skyL.target.position.copy(LIGHT_TARGET);
scene.add(skyL, skyL.target);

const hemi = new THREE.HemisphereLight(new THREE.Color(0.6, 0.7, 1.0), new THREE.Color(0.55, 0.45, 0.3), 0.78);
scene.add(hemi);
// soft fill from the camera side, so the inside of the tunnel never goes muddy
const fill = new THREE.DirectionalLight(new THREE.Color(1.0, 0.9, 0.8), 0.45);
fill.position.set(0.6, 0.35, 1).multiplyScalar(40);
scene.add(fill);

const SKY_DIRS = [];
for (let i = 0; i < 32; i++) {
  const u = U.halton(i + 1, 2), v = U.halton(i + 1, 3);
  const phi = u * Math.PI * 2;
  const ct = Math.sqrt(1 - v * 0.92);
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
// helpers
// ---------------------------------------------------------------------------
const add = (o, cast = true, recv = true) => {
  o.traverse?.((c) => {
    if (c.isMesh) {
      c.castShadow = cast;
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
  if (m.userData?.depth) o.customDepthMaterial = m.userData.depth;
  return o;
};
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
function setInst(im, x, y, z, sx, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) {
  if (!(sx > 1e-4 && sy > 1e-4 && sz > 1e-4)) return -1;
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
// ground: soil cut face + lawn (baked), tunnel surfaces driven by the dig field
// ---------------------------------------------------------------------------
const BAKE = bakeGround(renderer, FullScreenQuad);
function digTexture(back) {
  const r = WD.digRaster(200, back);
  const half = new Uint16Array(r.data.length);
  for (let i = 0; i < r.data.length; i++) half[i] = THREE.DataUtils.toHalfFloat(r.data[i]);
  const tex = new THREE.DataTexture(half, r.w, r.h, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const R = WD.DIG_RECT;
  return { tex, rect: new THREE.Vector4(R.x0, R.y0, R.x1, R.y1) };
}
const DIG_FRONT = digTexture(false), DIG_BACK = digTexture(true);
{
  const fr = BAKE.frontRect;
  const front = mesh(placed(quad(fr.z - fr.x, -fr.y), (fr.x + fr.z) / 2, fr.y / 2, 0), soilFrontMaterial(BAKE, DIG_FRONT));
  scene.add(front);
  const lr = BAKE.lawnRect;
  const lawn = mesh(placed(quad(lr.z - lr.x, lr.w - lr.y), (lr.x + lr.z) / 2, 0, (lr.y + lr.w) / 2, -Math.PI / 2, 0, 0), lawnMaterial(BAKE, {
    shaft: new THREE.Vector4(SHAFT_L.x0, SHAFT_L.x1, -TW, 0.01),
    hatch: new THREE.Vector3(LID.x, LID.z, LID.r),
    open: new THREE.Vector2(T.digStart + 0.02, T.breakThrough),
  }));
  scene.add(lawn);
  const R = WD.DIG_RECT;
  const back = mesh(placed(quad(R.x1 - R.x0, R.y1 - R.y0), (R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2, -TW), tunnelBackMaterial(DIG_BACK));
  scene.add(back);
  // soil right behind it, so hairline seams between the tunnel surfaces never show the sky
  scene.add(mesh(placed(quad(R.x1 - R.x0, -0.004 - R.y0), (R.x0 + R.x1) / 2, (R.y0 - 0.004) / 2, -TW - 0.012), seamMaterial(), false, true));
}
const boundaryMat = tunnelBoundaryMaterial(DIG_BACK);
const wallSideMat = tunnelBoundaryMaterial(DIG_BACK, 'tunnelColor');
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
  const m = mesh(g, mat);
  scene.add(m);
  return m;
}
// first tunnel floor, then the dip (starting where it drops below the first floor)
floorStrip([[SHAFT_L.x0, FLOOR], [FOOT.x0, FLOOR]], boundaryMat);
{
  const pts = [];
  let started = false;
  for (let x = -2.2; x <= WD.RIGHT_END + 1e-6; x += 0.02) {
    const y = WD.floorAt(x);
    if (!started && y > FLOOR - 0.03 && x < 0) continue;
    started = true;
    pts.push([x, x > 2.15 ? FLOOR : y]);
  }
  floorStrip(pts, boundaryMat);
}
// side walls of the two shafts that face the camera
{
  const left = mesh(placed(quad(TW, -FLOOR), SHAFT_L.x0, FLOOR / 2, -TW / 2, 0, Math.PI / 2, 0), wallSideMat);
  const right = mesh(placed(quad(TW, -FLOOR), SHAFT_R.x1, FLOOR / 2, -TW / 2, 0, -Math.PI / 2, 0), wallSideMat);
  scene.add(left, right);
}
// moving dig faces: bottom of the shaft while it goes down, front of the dip
const shaftFace = mesh(placed(quad(SHAFT_L.x1 - SHAFT_L.x0, TW), (SHAFT_L.x0 + SHAFT_L.x1) / 2, 0, -TW / 2, -Math.PI / 2, 0, 0), boundaryMat);
scene.add(shaftFace);
// rounded dig face of the first tunnel (same profile as in WD.digTime), rebuilt as it advances
const TF_N = 24;
const tunFace = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TF_N * 18), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(TF_N * 18), 3));
  const m = mesh(g, boundaryMat);
  m.frustumCulled = false;
  scene.add(m);
  return m;
})();
function updateTunFace(t) {
  const xa = WD.tunnelX(t);
  const r = 0.14 * (1 - smooth(clamp((xa + 1.25) / 0.4)));
  tunFace.visible = t > T.tunnelStart && r > 0.004;
  if (!tunFace.visible) return;
  const P = tunFace.geometry.attributes.position.array, N = tunFace.geometry.attributes.normal.array;
  let o = 0;
  for (let i = 0; i < TF_N; i++) {
    const ya = FLOOR + ((ROOF - FLOOR) * i) / TF_N, yb = FLOOR + ((ROOF - FLOOR) * (i + 1)) / TF_N;
    const qa = (ya - WD.YA) / WD.HALF, qb = (yb - WD.YA) / WD.HALF;
    const x0 = xa - r * qa * qa, x1 = xa - r * qb * qb;
    const l = Math.hypot(x1 - x0, yb - ya), nx = -(yb - ya) / l, ny = (x1 - x0) / l; // into the open tunnel
    for (const [x, y, z] of [[x0, ya, 0], [x1, yb, 0], [x1, yb, -TW], [x0, ya, 0], [x1, yb, -TW], [x0, ya, -TW]]) {
      P[o] = x; P[o + 1] = y; P[o + 2] = z;
      N[o] = nx; N[o + 1] = ny; N[o + 2] = 0;
      o += 3;
    }
  }
  tunFace.geometry.attributes.position.needsUpdate = true;
  tunFace.geometry.attributes.normal.needsUpdate = true;
}
const dipFace = mesh(placed(quad(WD.HALF * 2 + 0.06, TW), 0, 0, 0, -Math.PI / 2, 0, 0), boundaryMat);
const dipFaceG = new THREE.Group();
dipFaceG.add(dipFace);
dipFace.position.z = -TW / 2;
scene.add(dipFaceG);

// concrete foundation in the cut face (stem + footing), brick wall above
const concMat = concreteMaterial();
concMat.emissive = new THREE.Color(1.0, 0.85, 0.6);
concMat.emissiveIntensity = 0;
const footing = (() => {
  const s = new THREE.Shape();
  s.moveTo(FOOT.x0, FOOT.y0);
  s.lineTo(FOOT.x1, FOOT.y0);
  s.lineTo(FOOT.x1, FOOT.y1);
  s.lineTo(STEM.x1, FOOT.y1);
  s.lineTo(STEM.x1, STEM.y1);
  s.lineTo(STEM.x0, STEM.y1);
  s.lineTo(STEM.x0, FOOT.y1);
  s.lineTo(FOOT.x0, FOOT.y1);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.translate(0, 0, 0.003);
  return mesh(g, concMat, false, true);
})();
scene.add(footing);
const brickMat = brickMaterial();
const wallGroup = new THREE.Group();
{
  const parts = [boxMM(WALL.x0, 0, WALL.z0, WALL.x1, WALL.h, WALL.z1)];
  const caps = [boxMM(WALL.x0 - 0.05, WALL.h, WALL.z0, WALL.x1 + 0.05, WALL.h + 0.08, WALL.z1)];
  for (let z = -2.7; z > WALL.z0 + 1; z -= 3.6) {
    parts.push(boxMM(-0.29, 0, z - 0.26, 0.29, WALL.h + 0.22, z + 0.26));
    caps.push(boxMM(-0.34, WALL.h + 0.22, z - 0.31, 0.34, WALL.h + 0.31, z + 0.31));
  }
  wallGroup.add(mesh(mergeAll(parts), brickMat), mesh(mergeAll(caps), M.coping));
}
scene.add(wallGroup);

// ---------------------------------------------------------------------------
// backyards: two houses, trees, hedges, bushes, flowers, stones in the soil
// ---------------------------------------------------------------------------
const HOUSE_Z = -23.0, HOUSE_X = 4.55, HOUSE_S = 0.82;
const GIRL_WIN = new THREE.Vector3(); // centre of the open window in the friend's house
{
  const far = mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), M.farGround, false, true);
  far.position.set(0, -0.02, -30 - 450);
  scene.add(far);
  const houseL = buildHouse(M, roofTileMaterial());
  houseL.position.set(-HOUSE_X, 0, HOUSE_Z);
  houseL.scale.setScalar(HOUSE_S);
  add(houseL);
  const houseR = buildHouse(M, roofTileMaterial([0.36, 0.38, 0.43], 'slate'), { wall: 'greenWall', shade: 'greenShade', shutters: false, chimney: -1, open: [-3.15, 4.25] });
  GIRL_WIN.copy(houseR.userData.open).multiplyScalar(HOUSE_S).add(V(HOUSE_X, 0, HOUSE_Z));
  houseR.position.set(HOUSE_X, 0, HOUSE_Z);
  houseR.scale.setScalar(HOUSE_S);
  add(houseR);
  const hedgeParts = [];
  for (let i = -10; i <= 10; i++) hedgeParts.push(placed(lumpyBlob(1.1, 2, 0.07, 40 + i), i * 1.55, 0.85, -31.5, 0, 0, 0, 1, 0.95, 0.75));
  add(mesh(mergeAll(hedgeParts), M.hedge));
  const trees = [
    [-9.6, -21.5, 1.1, 3], [9.8, -22.0, 1.15, 5], [-0.2, -29.0, 1.5, 7], [-12.0, -27.0, 1.4, 9], [12.5, -27.5, 1.35, 11],
    [-5.5, -33.5, 1.8, 13], [5.0, -34.5, 1.9, 15], [-15.0, -35.0, 1.8, 17], [15.5, -36.0, 1.8, 19],
  ];
  const tl = { trunk: [], leaf: [], leafDark: [] };
  for (const [x, z, sc, seed] of trees) {
    const parts = buildTree(seed, sc);
    for (const k of Object.keys(tl)) tl[k].push(...parts[k].map((g) => placed(g, x, 0, z, 0, seed, 0)));
  }
  for (const k of Object.keys(tl)) add(mesh(mergeAll(tl[k]), M[k]));
  // bushes against the houses and along the wall
  const bushes = [
    [-8.2, -21.9, 0.9], [-1.4, -22.2, 0.8], [1.5, -22.0, 0.85], [8.3, -22.1, 0.9],
    [-0.75, -15.5, 0.7], [0.75, -11.0, 0.65], [-0.75, -6.5, 0.6], [0.8, -17.8, 0.7],
  ];
  const bl = { hedge: [], leafDark: [] };
  bushes.forEach(([x, z, sc], i) => bl[i % 2 ? 'leafDark' : 'hedge'].push(placed(buildBush(100 + i * 9, sc), x, 0, z)));
  for (const k of Object.keys(bl)) add(mesh(mergeAll(bl[k]), M[k]));
  // flower beds along both houses
  const fl = { flowerPink: [], flowerYellow: [], flowerWhite: [], flowerRed: [] };
  const rnd = U.mulberry32(77);
  for (const hx of [-HOUSE_X, HOUSE_X]) {
    for (let i = 0; i < 46; i++) {
      const x = hx - 3.6 + rnd() * 7.2;
      if (Math.abs(x - hx) < 1.9) continue;
      const k = ['flowerPink', 'flowerYellow', 'flowerWhite', 'flowerRed'][i % 4];
      fl[k].push(placed(new THREE.IcosahedronGeometry(0.085, 1), x, 0.12 + rnd() * 0.22, HOUSE_Z + 0.75 + rnd() * 0.5));
    }
  }
  for (const [k, list] of Object.entries(fl)) add(mesh(mergeAll(list), M[k]));
  // stones embedded in the lower cut face (clear of the tunnel)
  const rocks = { stone: [], stoneDark: [] };
  [[-3.9, -5.6, 0.32], [-2.4, -6.4, 0.24], [-1.1, -5.2, 0.18], [0.9, -6.1, 0.3], [2.6, -5.0, 0.22], [3.8, -6.6, 0.38],
   [-3.2, -4.4, 0.16], [1.9, -6.9, 0.2], [-0.2, -6.8, 0.34], [3.3, -4.4, 0.17], [-4.1, -3.6, 0.14], [4.1, -3.3, 0.15]]
    .forEach(([x, y, r], i) => rocks[i % 3 ? 'stone' : 'stoneDark'].push(placed(lumpyBlob(r, 2, 0.16, 300 + i), x, y, -0.06, i * 0.7, i * 1.3, i * 0.4, 1.25, 0.8, 0.55)));
  for (const k of Object.keys(rocks)) add(mesh(mergeAll(rocks[k]), M[k]));
}


// ---------------------------------------------------------------------------
// digging: dirt chunks out of the shaft, the pile, dust puffs
// ---------------------------------------------------------------------------
const ZC = -0.55; // middle of the tunnel depth (rails, cart, candle)
const dirtMat = groundMaterial({ mode: 1 });
const chunkGeom = lumpyBlob(0.11, 1, 0.22, 5);
const PILE = V(-2.05, 0, -2.85);
const DIG = [];
{
  const rnd = U.mulberry32(11);
  const hole = () => V(lerp(SHAFT_L.x0 + 0.12, SHAFT_L.x1 - 0.12, rnd()), 0, -0.15 - rnd() * 0.8);
  const toPile = () => {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    return V(PILE.x + Math.cos(a) * r * 1.0, 0, PILE.z + Math.sin(a) * r * 0.75);
  };
  const push = (t0, from, n, big = 1) => {
    for (let k = 0; k < n; k++) DIG.push({ t0: t0 + rnd() * 0.18, dur: 0.55 + rnd() * 0.2, from: from.clone().add(V((rnd() - 0.5) * 0.3, rnd() * 0.2, (rnd() - 0.5) * 0.3)), to: toPile(), s: (0.75 + rnd() * 0.6) * big, rot: V(rnd() * 6, rnd() * 6, rnd() * 6), spin: V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4), h: 1.2 + rnd() * 1.0 });
  };
  for (let i = 0; i < T.shaftSteps; i++) {
    const t0 = T.digStart + i * T.shaftStep + 0.04;
    const h = hole();
    h.y = Math.min(-0.05, WD.shaftY(t0 + 0.2) + 0.15);
    push(t0, h, 5);
  }
  for (let j = 0; j < 7; j++) {
    const h = hole();
    h.y = -0.6;
    push(T.tunnelStart + j * ((T.tunnelEnd - 0.3 - T.tunnelStart) / 6) + 0.2, h, 4, 0.9);
  }
  for (let j = 0; j < 6; j++) {
    const h = hole();
    h.y = -0.6;
    push(T.dipStart + j * ((T.exitShaft - T.dipStart) / 6) + 0.15, h, 3, 0.85);
  }
}
const digChunks = instanced(chunkGeom, dirtMat, DIG.length);
function pileScale(t) {
  let n = 0;
  for (const c of DIG) n += clamp((t - c.t0 - c.dur) / 0.25);
  const k = n / DIG.length;
  return Math.min(1, popIn(t, T.pileLand - 0.05, 0.35, 2.0)) * (0.3 + 0.7 * Math.pow(k, 0.6));
}
function pileHeightAt(x, z, t) {
  const s = Math.max(pileScale(t), 0.01);
  const dx = (x - PILE.x) / (1.25 * s), dz = (z - PILE.z) / (0.95 * s);
  const r2 = dx * dx + dz * dz;
  return r2 >= 1 ? 0 : Math.sqrt(1 - r2) * 0.75 * s;
}
const pile = (() => {
  const g = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const pa = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pa.count; i++) {
    v.fromBufferAttribute(pa, i);
    const a = Math.atan2(v.z, v.x);
    const lump = 1 + 0.08 * Math.sin(a * 5 + v.y * 6) + 0.06 * Math.sin(a * 11 - v.y * 9);
    pa.setXYZ(i, v.x * lump, v.y * (1 + 0.07 * Math.sin(a * 7)), v.z * lump);
  }
  g.computeVertexNormals();
  return mesh(g, dirtMat);
})();
scene.add(pile);
// small chunks that tumble off the dig face inside the tunnel
const FACE = [];
{
  const rnd = U.mulberry32(13);
  for (let j = 0; j < 7; j++) {
    const t0 = T.tunnelStart + j * ((T.tunnelEnd - 0.3 - T.tunnelStart) / 6) + 0.05;
    for (let k = 0; k < 4; k++) FACE.push({ t0: t0 + rnd() * 0.15, kind: 'a', y: FLOOR + 0.2 + rnd() * 0.6, z: -0.15 - rnd() * 0.8, vx: -0.6 - rnd() * 0.8, s: 0.45 + rnd() * 0.35, rot: rnd() * 6 });
  }
  for (let j = 0; j < 10; j++) {
    const t0 = T.dipStart + j * ((T.exitShaft - T.dipStart) / 10) + 0.05;
    for (let k = 0; k < 3; k++) FACE.push({ t0: t0 + rnd() * 0.15, kind: 'b', off: (rnd() - 0.5) * 0.6, z: -0.15 - rnd() * 0.8, vx: -0.5 - rnd() * 0.6, s: 0.4 + rnd() * 0.3, rot: rnd() * 6 });
  }
  // the clunk: bits bounce back off the concrete
  for (let k = 0; k < 11; k++) FACE.push({ t0: T.clunk + rnd() * 0.08, kind: 'c', y: -2.3 + rnd() * 0.3, z: -0.15 - rnd() * 0.8, vx: -1.2 - rnd() * 1.4, s: 0.4 + rnd() * 0.35, rot: rnd() * 6 });
}
const faceChunks = instanced(chunkGeom, dirtMat, FACE.length);
// grey chips knocked off the footing, and cartoon impact streaks
const CHIPS = [];
{
  const rnd = U.mulberry32(43);
  for (let k = 0; k < 7; k++) CHIPS.push({ t0: T.clunk + rnd() * 0.04, y: -2.28 + rnd() * 0.26, z: -0.1 - rnd() * 0.6, vx: -1.6 - rnd() * 1.6, vy: 1.0 + rnd() * 1.6, s: 0.016 + rnd() * 0.014, rot: V(rnd() * 6, rnd() * 6, rnd() * 6) });
}
const chips = instanced(new THREE.IcosahedronGeometry(1, 0), M.coping, CHIPS.length);
const STREAK_A = [-1.15, -0.62, -0.1, 0.42, 0.95].map((a) => Math.PI + a);
const streakGeom = new THREE.BufferGeometry(); // tapered dash: a thin diamond
streakGeom.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0, -0.5, 0, 0.5, 0, 0, -0.5, 0, 0, 0.5, 0, 0, 0, 0.5, 0], 3));
streakGeom.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
const streaks = instanced(streakGeom, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.32, 1.05), transparent: true, depthWrite: false }), STREAK_A.length * 3, false);
streaks.renderOrder = 4;
const puffGeom = lumpyBlob(1, 1, 0.12, 9);
const DUST = [];
{
  const rnd = U.mulberry32(41);
  const burst = (t0, p, n, r, spread = 0.4, up = 0.9, vx = 0, vz = 0) => {
    for (let i = 0; i < n; i++) DUST.push({ t0: t0 + rnd() * 0.12, life: 0.9 + rnd() * 0.5, p: p.clone().add(V((rnd() - 0.5) * spread, (rnd() - 0.5) * spread * 0.5, (rnd() - 0.5) * spread * 0.6)), v: V((rnd() - 0.5) * 1.2 + vx * (0.6 + 0.8 * rnd()), up * (0.5 + rnd() * 0.8), (rnd() - 0.5) * 0.4 + vz * rnd()), r: r * (0.7 + rnd() * 0.6) });
  };
  for (let i = 0; i < T.shaftSteps; i++) burst(T.digStart + i * T.shaftStep + 0.05, V(-3.2, 0.1, -0.5), 2, 0.22);
  burst(T.pileLand, V(PILE.x, 0.1, PILE.z), 4, 0.28, 1.2);
  // the clunk: a cloud that rolls back out along the tunnel and puffs out of the cut
  burst(T.clunk, V(FOOT.x0 - 0.14, -2.2, -0.25), 9, 0.22, 0.35, 0.45, -1.3);
  burst(T.clunk + 0.04, V(FOOT.x0 - 0.2, -2.35, 0.05), 6, 0.2, 0.4, 0.35, -0.9, 0.5);
  burst(T.knock1, V(FOOT.x0 - 0.1, -2.1, -0.2), 3, 0.14, 0.2, 0.5);
  burst(T.knock2, V(FOOT.x0 - 0.1, -2.2, -0.2), 3, 0.14, 0.2, 0.5);
  burst(T.breakThrough, V(LID.x, 0.08, LID.z), 7, 0.24, 0.7);
  burst(T.pileAway, V(PILE.x, 0.25, PILE.z), 7, 0.32, 1.5);
}
const dustPuffs = instanced(puffGeom, M.dust, DUST.length + 60, false);
dustPuffs.renderOrder = 3;
// turf + dirt thrown up where the exit breaks through the friend's lawn
const BREAK = [];
{
  const rnd = U.mulberry32(17);
  for (let i = 0; i < 14; i++) BREAK.push({ t0: T.breakThrough + rnd() * 0.1, p: V(LID.x + (rnd() - 0.5) * 0.5, 0.02, LID.z + (rnd() - 0.5) * 0.4), v: V((rnd() - 0.5) * 2.0, 2.2 + rnd() * 1.8, (rnd() - 0.5) * 1.2), s: 0.5 + rnd() * 0.4, rot: V(rnd() * 6, rnd() * 6, rnd() * 6), grass: i % 3 === 0 });
}
const breakChunks = instanced(chunkGeom, dirtMat, BREAK.length);
const breakTurf = instanced(new THREE.BoxGeometry(0.16, 0.05, 0.16), M.tuft, BREAK.length);

// ladders in both shafts, lid with a flower pot over the exit
const ladderL = buildLadder(M, -FLOOR + 0.35);
ladderL.position.set((SHAFT_L.x0 + SHAFT_L.x1) / 2, FLOOR, -TW + 0.12);
const ladderR = buildLadder(M, -FLOOR - 0.05);
ladderR.position.set(LID.x, FLOOR, -TW + 0.12);
scene.add(ladderL, ladderR);
const lid = buildLid(M, LID.r);
add(lid.hinge);

// ---------------------------------------------------------------------------
// brick arches: voussoirs fly in one by one, mortar behind, pilasters at the ribs
// ---------------------------------------------------------------------------
const BRICKS = [];
for (const a of ARCHES) {
  const Rm = a.R + WD.BAND / 2;
  const arc = Rm * (a.a0 - a.a1);
  const n = Math.max(5, Math.round(arc / 0.11));
  for (let i = 0; i < n; i++) {
    const th = a.a0 + ((a.a1 - a.a0) * (i + 0.5)) / n;
    BRICKS.push({ arch: a.k, x: a.ox + Rm * Math.cos(th), y: a.oy + Rm * Math.sin(th), rz: th - Math.PI / 2, w: arc / n - 0.013, wm: arc / n + 0.004 });
  }
}
BRICKS.sort((p, q) => p.x - q.x);
{
  const rnd = U.mulberry32(23);
  BRICKS.forEach((b, i) => {
    b.t = T.bricksStart + ((T.bricksEnd - T.bricksStart - 0.3) * i) / (BRICKS.length - 1);
    b.from = V(b.x + (rnd() - 0.5) * 1.6, b.y + 1.6 + rnd() * 1.4, 2.2 + rnd() * 1.2);
    b.spin = V(rnd() * 8 - 4, rnd() * 8 - 4, rnd() * 8 - 4);
    b.col = new THREE.Color().setHSL(0.025 + rnd() * 0.02, 0.62 + rnd() * 0.12, 0.36 + rnd() * 0.12).convertSRGBToLinear();
  });
}
const brickBox = new RoundedBoxGeometry(1, 1, 1, 1, 0.08);
const bricks = instanced(brickBox, M.archBrick, BRICKS.length);
const mortar = instanced(new THREE.BoxGeometry(1, 1, 1), M.mortar, BRICKS.length, false);
const PILASTERS = WD.ARCH_RIBS.map((xr, i) => {
  const x0 = i === 0 ? xr : i === WD.ARCH_RIBS.length - 1 ? xr - 0.18 : xr === FOOT.x0 ? xr - 0.18 : xr === FOOT.x1 ? xr : xr - 0.09;
  const xm = x0 + 0.09;
  const top = WD.ceilingAt(Math.min(Math.max(xm, SHAFT_L.x1 + 0.01), SHAFT_R.x0 - 0.01));
  const bot = WD.floorAt(xm);
  const m = mesh(boxMM(x0, bot, -TW, x0 + 0.18, top + 0.02, -TW + 0.13), brickMat);
  m.geometry.translate(0, -top, 0); // scale from the ceiling down
  m.position.y = top;
  scene.add(m);
  const near = BRICKS.reduce((best, b) => (Math.abs(b.x - xm) < Math.abs(best.x - xm) ? b : best), BRICKS[0]);
  return { m, t: near.t + 0.25 };
});
// dirt that drops from the roof before the bricks go in
const CLUMPS = [];
{
  const rnd = U.mulberry32(29);
  for (const a of ARCHES) {
    for (let i = 0; i < 9; i++) {
      const x = lerp(a.xa + 0.1, a.xb - 0.1, rnd());
      const top = WD.archY(a, x, a.R + WD.BAND) - 0.08, roof = WD.roofAt(x);
      const y0 = lerp(roof + 0.03, Math.max(roof + 0.05, top), rnd());
      const t0 = WD.CRUMBLE[a.k] + 0.5 * clamp((y0 - roof) / Math.max(0.05, top - roof)) + rnd() * 0.1;
      CLUMPS.push({ t0, x, y0, z: -0.12 - rnd() * 0.85, floor: WD.floorAt(x) + 0.05, s: 0.6 + rnd() * 0.6, rot: V(rnd() * 6, rnd() * 6, rnd() * 6), spin: V(rnd() * 6 - 3, rnd() * 6 - 3, rnd() * 6 - 3), away: T.clumpsAway + ((x + 3) / 6) * 0.25 });
    }
  }
}
const clumps = instanced(chunkGeom, dirtMat, CLUMPS.length);
// orange dots: weight of the soil, down onto each arch, along its curve, down the sides
const LOAD = [];
{
  const rnd = U.mulberry32(31);
  for (const a of ARCHES) {
    const xm = (a.xa + a.xb) / 2;
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const x0 = xm + side * (0.04 + rnd() * 0.32) * (a.xb - a.xa) * 0.5;
      const ext = (x) => WD.archY(a, x, a.R + WD.BAND) + 0.03;
      const pts = [[x0, ext(x0) + (a.k === 2 ? 1.05 : 0.75), 0.03]];
      const xe = side < 0 ? a.xa + 0.02 : a.xb - 0.02;
      for (let k = 0; k <= 10; k++) {
        const x = lerp(x0, xe, k / 10);
        pts.push([x, ext(x), 0.03]);
      }
      const yb = WD.floorAt(xe) - 0.35;
      pts.push([xe, yb, 0.03]);
      LOAD.push({ path: U.polyPath(pts), ph: i / 26 + rnd() * 0.03, sp: 1.15 + rnd() * 0.2 });
    }
  }
}
const loadDots = instanced(new THREE.SphereGeometry(0.045, 10, 8), M.loadDot, LOAD.length, false);

// ---------------------------------------------------------------------------
// stale air, candle, air pipe, fresh air
// ---------------------------------------------------------------------------
const CANDLE = V(0.22, WD.floorAt(0.22), -0.42);
const candle = buildCandle(M);
candle.root.position.copy(CANDLE);
add(candle.root, true, true);
const candleGlow = mesh(new THREE.CircleGeometry(0.13, 24), M.glowCandle, false, false);
candleGlow.renderOrder = 7;
scene.add(candleGlow);
const centerY = (x) => (WD.floorAt(x) + WD.ceilingAt(x)) / 2;
const STALE = [];
{
  const rnd = U.mulberry32(37);
  for (let i = 0; i < 46; i++) {
    const x = lerp(-3.3, 3.3, (i + rnd()) / 46);
    const fl = WD.floorAt(x), ce = WD.ceilingAt(x);
    STALE.push({ x, y: lerp(fl + 0.3, ce - 0.2, rnd()), z: -0.25 - rnd() * 0.7, r: 0.26 + rnd() * 0.18, ph: rnd() * 10, tin: T.staleStart + (Math.abs(x - CANDLE.x) / 3.5) * (T.staleFull - T.staleStart) * 0.85 + rnd() * 0.2 });
  }
  // nearest the shaft leaves first
  [...STALE].sort((p, q) => p.x - q.x).forEach((p, k) => (p.tout = T.staleOut + (k / STALE.length) * (T.airClear - T.staleOut - 1.0)));
}
const staleAir = instanced(puffGeom, M.stale, STALE.length, false);
staleAir.renderOrder = 3;
const SMOKE = [];
for (let i = 0; i < 9; i++) SMOKE.push({ t0: T.candleOut + i * 0.09, life: 1.2 + (i % 3) * 0.2, dx: Math.sin(i * 2.3) * 0.1 });
const smokeWisp = instanced(puffGeom, M.smoke, SMOKE.length, false);
smokeWisp.renderOrder = 4;
const PIPE_X = 1.3, PIPE_BOT = WD.ceilingAt(1.3) - 0.04, PIPE_TOP = 0.45;
const pipe = new THREE.Group();
{
  const len = PIPE_TOP - PIPE_BOT;
  const body = mesh(placed(new THREE.CylinderGeometry(0.06, 0.06, len, 18), 0, len / 2, 0), M.pvc);
  const rings = mesh(mergeAll([placed(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 18), 0, 0.03, 0), placed(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 18), 0, -PIPE_BOT - 0.02, 0)]), M.pvcDark);
  pipe.add(body, rings);
  pipe.position.set(PIPE_X, PIPE_BOT, -0.02);
}
scene.add(pipe);
const ventCap = new THREE.Group();
ventCap.add(mesh(mergeAll([placed(new THREE.ConeGeometry(0.16, 0.12, 22), 0, 0.12, 0), placed(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 18), 0, 0.035, 0)]), M.pvcDark));
ventCap.position.set(PIPE_X, PIPE_TOP, -0.02);
scene.add(ventCap);
const AIR_PATH = (() => {
  const pts = [[PIPE_X, PIPE_TOP + 0.35, 0.1], [PIPE_X, PIPE_BOT - 0.1, 0.1], [PIPE_X - 0.15, PIPE_BOT - 0.35, -0.25]];
  for (let x = 1.0; x >= -3.0; x -= 0.25) pts.push([x, centerY(x) + 0.05, -0.3]);
  pts.push([-3.2, -2.3, -0.35], [-3.2, -1.0, -0.35], [-3.15, 0.25, -0.4], [-2.9, 1.1, -0.45]);
  return U.polyPath(pts);
})();
const ADOTS = 70;
const airDots = instanced(new THREE.SphereGeometry(0.04, 10, 8), M.airDot, ADOTS, false);

// ---------------------------------------------------------------------------
// darkness, wire and bulbs
// ---------------------------------------------------------------------------
const BULBS = ARCHES.map((a) => {
  const x = (a.xa + a.xb) / 2 + (a.k === 3 ? 0.12 : 0);
  const b = buildBulb(M);
  b.root.position.set(x, WD.archY(a, x) - 0.035, -0.08);
  add(b.root, false, true);
  const glow = mesh(new THREE.CircleGeometry(0.14, 24), M.glowWarm.clone(), false, false);
  glow.renderOrder = 8;
  glow.position.set(x, WD.archY(a, x) - 0.035 - 0.19, -0.02);
  scene.add(glow);
  return { ...b, glow, x, y: WD.archY(a, x) - 0.225 };
});
const darkU = { uDark: { value: 0 }, uWarm: { value: 0 }, uBulbs: { value: [...BULBS.map(() => new THREE.Vector4()), new THREE.Vector4()] }, uDig: { value: DIG_BACK.tex }, uDigRect: { value: DIG_BACK.rect }, uTime: digTime };
const NL = BULBS.length + 1; // bulbs + the spark running along the wire
const darkFrag = `uniform sampler2D uDig; uniform vec4 uDigRect; uniform float uTime; uniform float uDark, uWarm; uniform vec4 uBulbs[${NL}];
  varying vec3 vP;
  float light(){ float l = 0.0; for (int i = 0; i < ${NL}; i++){ vec2 d = (vP.xy - uBulbs[i].xy) * vec2(0.8, 1.1); l += uBulbs[i].w * exp(-dot(d, d) / (i == ${NL - 1} ? 0.12 : 0.5)); } return l; }
  bool open(){ vec2 uv = (vP.xy - uDigRect.xy) / (uDigRect.zw - uDigRect.xy); return texture2D(uDig, uv).r <= uTime; }
  float shaftLight(){ return (vP.x < ${SHAFT_L.x1 + 0.05} || vP.x > ${SHAFT_R.x0 - 0.05}) ? smoothstep(-2.4, -1.2, vP.y) : 0.0; }`;
const darkVert = 'varying vec3 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vP, 1.0); }';
const darkMat = new THREE.ShaderMaterial({
  uniforms: darkU, transparent: true, depthWrite: false, vertexShader: darkVert,
  fragmentShader: `${darkFrag} void main(){ if (!open()) discard; float a = uDark * (1.0 - 0.88 * clamp(light(), 0.0, 1.0)) * (1.0 - shaftLight()); gl_FragColor = vec4(0.012, 0.008, 0.006, a); }`,
});
const warmMat = new THREE.ShaderMaterial({
  uniforms: darkU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: darkVert,
  fragmentShader: `${darkFrag} void main(){ if (!open()) discard; float l = light(); gl_FragColor = vec4(vec3(1.0, 0.62, 0.26) * uWarm * l * (1.0 - shaftLight()), 1.0); }`,
});
{
  const R = WD.DIG_RECT;
  const g = placed(quad(R.x1 - R.x0, R.y1 - R.y0), (R.x0 + R.x1) / 2, (R.y0 + R.y1) / 2, 0.015);
  const dark = new THREE.Mesh(g, darkMat), warmL = new THREE.Mesh(g, warmMat);
  dark.renderOrder = 5;
  warmL.renderOrder = 6;
  scene.add(dark, warmL);
}
const WIRE_PTS = [];
for (let x = SHAFT_L.x1 + 0.02; x <= SHAFT_R.x0 - 0.02; x += 0.04) WIRE_PTS.push(V(x, WD.ceilingAt(x) - 0.035, -0.08));
const WIRE_CURVE = new THREE.CatmullRomCurve3(WIRE_PTS);
const wire = mesh(new THREE.TubeGeometry(WIRE_CURVE, 300, 0.009, 6, false), M.wire, false, true);
const spark = mesh(new THREE.SphereGeometry(0.028, 12, 10), M.flame, false, false);
spark.renderOrder = 9;
const sparkGlow = mesh(new THREE.CircleGeometry(0.12, 20), M.glowWarm.clone(), false, false);
sparkGlow.renderOrder = 9;
scene.add(spark, sparkGlow);
wire.userData.total = wire.geometry.index.count;
scene.add(wire);

// ---------------------------------------------------------------------------
// rails, mine cart with a cricket bat, snail
// ---------------------------------------------------------------------------
const RAIL_PTS = [];
for (let x = -3.42; x <= 3.42 + 1e-6; x += 0.04) RAIL_PTS.push([x, WD.floorAt(x)]);
const offsetPts = (pts, d) => pts.map((p, i) => {
  const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
  return [p[0] - (dy / l) * d, p[1] + (dx / l) * d];
});
const SLEEPER_T = 0.04, RAIL_H = 0.045;
const RAIL_BASE = offsetPts(RAIL_PTS, SLEEPER_T);
const RAIL_TOP = offsetPts(RAIL_PTS, SLEEPER_T + RAIL_H);
const railPath = (() => {
  const P = RAIL_TOP;
  const s = [0];
  for (let i = 1; i < P.length; i++) s.push(s[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  return {
    L: s[s.length - 1],
    at(d) {
      d = clamp(d, 0, s[s.length - 1]);
      let i = 1;
      while (i < s.length - 1 && s[i] < d) i++;
      const k = (d - s[i - 1]) / (s[i] - s[i - 1]);
      const a = P[i - 1], b = P[i];
      return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    },
    sOfX(x) {
      for (let i = 0; i < P.length; i++) if (P[i][0] >= x) return s[i];
      return s[s.length - 1];
    },
  };
})();
const RAIL_SEGS = [];
{
  const n = 12;
  for (let k = 0; k < n; k++) {
    const i0 = Math.floor((k * (RAIL_BASE.length - 1)) / n), i1 = Math.floor(((k + 1) * (RAIL_BASE.length - 1)) / n);
    const seg = RAIL_BASE.slice(i0, i1 + 1);
    const g = new THREE.Group();
    g.add(mesh(mergeAll([railGeom(seg, ZC + 0.2), railGeom(seg, ZC - 0.2)]), M.steel, true, true));
    const sl = [];
    for (let i = i0; i < i1; i += 6) {
      const a = RAIL_PTS[i], b = RAIL_PTS[Math.min(RAIL_PTS.length - 1, i + 1)];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const [ox, oy] = [-Math.sin(ang) * SLEEPER_T / 2, Math.cos(ang) * SLEEPER_T / 2];
      sl.push(placed(new THREE.BoxGeometry(0.075, SLEEPER_T, 0.62), a[0] + ox, a[1] + oy, ZC, 0, 0, ang));
    }
    g.add(mesh(mergeAll(sl), M.sleeper, true, true));
    scene.add(g);
    RAIL_SEGS.push({ g, t: T.railsStart + ((T.railsEnd - T.railsStart - 0.3) * k) / (n - 1) });
  }
}
const cart = buildCart(M);
add(cart.root);
const bat = buildBat(M);
bat.position.set(-0.06, 0.36, 0.02);
bat.rotation.set(0.15, 0.2, 0.95);
cart.body.add(bat);
const CART_S0 = railPath.sOfX(-3.18), CART_S1 = railPath.sOfX(3.18);
const snail = buildSnail(M);
add(snail.root);
snail.root.scale.setScalar(1.25);

// ---------------------------------------------------------------------------
// the boy and his friend's mom
// ---------------------------------------------------------------------------
const boy = buildBoy(M);
add(boy.root);
const mom = buildMom(M);
add(mom.root);
const MOM_POS = V(LID.x + 0.4, 0, LID.z - 0.62);
const girl = buildGirl(M);
add(girl.root, false, true);
girl.clip.constant = -(GIRL_WIN.y - 0.7 * HOUSE_S); // keep only what is above the sill
renderer.localClippingEnabled = true;

// ---------------------------------------------------------------------------
// animation: everything is a function of time t
// ---------------------------------------------------------------------------
const camFwd = (o, y = 0) => o; // billboards: the camera always looks down -z, so flat discs facing +z work
const setGrow = (m, k) => {
  const n = Math.round(clamp(k) * (m.userData.total / 3)) * 3;
  m.geometry.setDrawRange(0, n);
  m.visible = n > 0;
};

function updateDigging(t) {
  digTime.value = t;
  updateTunFace(t);
  const ys = WD.shaftY(t);
  shaftFace.visible = t > T.digStart && ys > FLOOR + 0.01;
  shaftFace.position.y = ys;
  const s = WD.digS(t);
  const q = WD.bAt(Math.min(s, WD.BLEN));
  dipFaceG.visible = t > T.dipStart && t < T.dipUnder + 0.2;
  dipFaceG.position.set(q.x, q.y, 0);
  // face normal points back along the path, into the open tunnel
  dipFaceG.rotation.set(0, 0, Math.atan2(q.tx, -q.ty));
  // dirt flying out of the shaft onto the pile
  beginInst(digChunks);
  for (const c of DIG) {
    const u = (t - c.t0) / c.dur;
    if (u < 0 || t > T.pileAway + 0.3) continue;
    const k = Math.min(u, 1);
    const toY = pileHeightAt(c.to.x, c.to.z, c.t0 + c.dur) + 0.04;
    const x = lerp(c.from.x, c.to.x, easeOutCubic(k)), z = lerp(c.from.z, c.to.z, k);
    const y = lerp(c.from.y, toY, k) + Math.sin(k * Math.PI) * (c.h + Math.max(0, toY - c.from.y) * 0.3);
    const sc = c.s * Math.min(1, popIn(t, c.t0, 0.15, 2)) * (u > 1 ? 1 - smooth(clamp((u - 1) * c.dur / 0.35)) : 1);
    setInst(digChunks, x, y, z, sc, sc, sc, c.rot.x + c.spin.x * k, c.rot.y + c.spin.y * k, c.rot.z + c.spin.z * k);
  }
  endInst(digChunks);
  const ps = pileScale(t) * popOut(t, T.pileAway, 0.32);
  pile.visible = ps > 0.002;
  pile.position.copy(PILE);
  // "Sort of." - the pile gives a little shrug
  const shrug = bump(t, 5.5, 6.02, 0.1), shrugW = wobble(t, 6.0, 3.2, 6);
  pile.scale.set(
    1.25 * Math.max(ps, 0.001) * (1 - 0.05 * shrug + 0.03 * shrugW),
    0.75 * Math.max(ps, 0.001) * (1 - 0.12 * wobble(t, T.pileLand + 0.2, 3, 6) + 0.16 * shrug - 0.08 * shrugW),
    0.95 * Math.max(ps, 0.001) * (1 - 0.05 * shrug + 0.03 * shrugW)
  );
  pile.rotation.z = 0.07 * shrug * Math.sin((t - 5.5) * 11);
  // bits tumbling off the dig face
  beginInst(faceChunks);
  for (const c of FACE) {
    const dt = t - c.t0;
    if (dt < 0 || dt > 0.9) continue;
    let x, y0;
    if (c.kind === 'a') { x = WD.tunnelX(c.t0) - 0.08; y0 = c.y; }
    else if (c.kind === 'c') { x = FOOT.x0 - 0.06; y0 = c.y; }
    else { const p = WD.bAt(Math.min(WD.digS(c.t0), WD.BLEN)); x = p.x - p.tx * 0.12; y0 = p.y + c.off * 0.5; }
    const fl = WD.floorAt(x + c.vx * Math.min(dt, 0.5)) + 0.05;
    const y = Math.max(fl, y0 + (c.kind === 'c' ? 1.2 : 0.4) * dt - 4.9 * dt * dt);
    const sc = c.s * (1 - smooth(clamp((dt - 0.55) / 0.35))) * Math.min(1, dt / 0.06);
    setInst(faceChunks, x + c.vx * Math.min(dt, 0.5), y, c.z, sc, sc, sc, c.rot + dt * 6, c.rot * 0.5, dt * 4);
  }
  endInst(faceChunks);
  beginInst(chips);
  for (const c of CHIPS) {
    const dt = t - c.t0;
    if (dt < 0 || dt > 0.8) continue;
    const x = FOOT.x0 - 0.03 + c.vx * Math.min(dt, 0.45) * (1 - 0.6 * Math.min(dt, 0.45));
    const y = Math.max(FLOOR + c.s, c.y + c.vy * dt - 4.9 * dt * dt);
    const sc = c.s * (1 - smooth(clamp((dt - 0.5) / 0.3)));
    setInst(chips, x, y, c.z, sc, sc * 0.8, sc, c.rot.x + dt * 9, c.rot.y + dt * 7, c.rot.z);
  }
  endInst(chips);
  // impact streaks fan out from the hit, then a smaller pair of fans on the knocks
  beginInst(streaks);
  for (const [t0, amp, y0] of [[T.clunk, 1, -2.16], [T.knock1, 0.55, -2.1], [T.knock2, 0.55, -2.2]]) {
    const dt = t - t0;
    if (dt < 0 || dt > 0.26) continue;
    const u = dt / 0.26;
    STREAK_A.forEach((a, i) => {
      const r = (0.1 + 0.32 * easeOutCubic(u)) * amp, len = (0.2 * (1 - u) + 0.03) * amp * (i === 2 ? 1.25 : 1);
      setInst(streaks, FOOT.x0 - 0.02 + Math.cos(a) * (r + len / 2), y0 + Math.sin(a) * (r + len / 2), 0.03, len, 0.034 * amp * (1 - 0.5 * u), 1, 0, 0, a);
    });
  }
  endInst(streaks);
  streaks.material.opacity = 0.9;
  // breakthrough on the friend's lawn
  beginInst(breakChunks);
  beginInst(breakTurf);
  for (const c of BREAK) {
    const dt = t - c.t0;
    if (dt < 0 || dt > 1.0) continue;
    const y = Math.max(0.03, c.p.y + c.v.y * dt - 4.9 * dt * dt);
    const sc = c.s * (1 - smooth(clamp((dt - 0.6) / 0.4)));
    const im = c.grass ? breakTurf : breakChunks;
    setInst(im, c.p.x + c.v.x * dt * 0.5, y, c.p.z + c.v.z * dt * 0.5, sc, sc, sc, c.rot.x + dt * 7, c.rot.y + dt * 5, c.rot.z);
  }
  endInst(breakChunks);
  endInst(breakTurf);
  // the boundary wall shivers at the clunk and the knocks
  const shiver = 0.022 * wobble(t, T.clunk, 13, 8) + 0.008 * (wobble(t, T.knock1, 14, 10) + wobble(t, T.knock2, 14, 10));
  wallGroup.position.x = shiver;
  footing.position.x = 0.5 * shiver;
  const hit = (t0, a) => (t > t0 ? a * Math.exp(-14 * (t - t0)) : 0);
  concMat.emissiveIntensity = 0.35 * bump(t, 8.05, 9.2, 0.25) * (0.75 + 0.25 * Math.sin((t - 8.05) * 9)) + hit(T.clunk, 0.55) + hit(T.knock1, 0.2) + hit(T.knock2, 0.2);
  // ladders, lid, flower pot
  for (const [l, t0] of [[ladderL, 5.85], [ladderR, T.lidLand - 0.25]]) {
    const k = popIn(t, t0, 0.42, 2.0);
    l.visible = k > 0.002;
    l.scale.set(1, Math.max(k, 0.001), 1);
  }
}

function updateDust(t) {
  beginInst(dustPuffs);
  const puff = (p, v, r, dt, life) => {
    const u = dt / life;
    const rr = r * (0.35 + 0.9 * easeOutCubic(u)) * (1 - smooth(clamp((u - 0.55) / 0.45)));
    const drag = 1 - Math.exp(-dt * 2.2);
    setInst(dustPuffs, p.x + (v.x * drag) / 2.2, p.y + (v.y * drag) / 2.2, p.z + (v.z * drag) / 2.2, rr, rr * 0.9, rr);
  };
  for (const d of DUST) {
    const dt = t - d.t0;
    if (dt >= 0 && dt <= d.life) puff(d.p, d.v, d.r, dt, d.life);
  }
  // clumps landing (scene 3) and the cart landing / arriving (scene 6), lid closing (7)
  for (const c of CLUMPS) {
    const tl = c.t0 + Math.sqrt(Math.max(0, (c.y0 - c.floor) / 4.9));
    const dt = t - tl;
    if (dt >= 0 && dt < 0.8 && c.s > 0.85) puff(V(c.x, c.floor + 0.05, c.z), V(0, 0.5, 0), 0.16, dt, 0.8);
  }
  for (const [t0, x] of [[T.cartLand, -3.18], [T.cartArrive, 3.1]]) {
    const dt = t - t0;
    if (dt >= 0 && dt < 1.0) for (let k = 0; k < 3; k++) puff(V(x + (k - 1) * 0.25, WD.floorAt(x) + 0.08, ZC + 0.25), V((k - 1) * 0.6, 0.5, 0.2), 0.16, dt, 1.0);
  }
  {
    const dt = t - (T.lidClose + 0.12);
    if (dt >= 0 && dt < 1.0) for (let k = 0; k < 4; k++) puff(V(LID.x + Math.cos(k * 1.6) * 0.4, 0.05, LID.z + Math.sin(k * 1.6) * 0.3), V(Math.cos(k * 1.6) * 0.8, 0.3, Math.sin(k * 1.6) * 0.4), 0.13, dt, 1.0);
  }
  endInst(dustPuffs);
}

function updateLid(t) {
  // drops in after the breakthrough, opens for the boy, closes after him
  const land = U.easeOutBounce(prog(t, T.lidLand - 0.4, 0.55));
  lid.hinge.visible = t >= T.lidLand - 0.4;
  lid.hinge.position.set(LID.x - LID.r, (1 - land) * 1.6 + 0.0, LID.z);
  // flips open sideways on its left edge (the flower pot clings on), slams shut at the end
  let ang = 0;
  if (t >= T.lidOpen) ang = 1.75 * Math.min(1.08, easeOutBack(prog(t, T.lidOpen, 0.36), 1.6));
  if (t >= T.lidClose) ang = 1.75 * (1 - U.easeOutBounce(prog(t, T.lidClose, 0.42)));
  lid.hinge.rotation.z = ang;
  const potK = popIn(t, T.potLand, 0.4, 2.4);
  lid.pot.visible = potK > 0.002;
  lid.pot.scale.setScalar(Math.max(potK, 0.001));
  lid.pot.rotation.z = 0.12 * wobble(t, T.lidOpen + 0.1, 2.2, 3.5) + 0.1 * wobble(t, T.lidClose + 0.3, 2.6, 4) + 0.08 * wobble(t, T.potLand + 0.3, 3, 5);
}

function updateArches(t) {
  // dirt clumps fall from the roof, rest on the floor, then pop away
  beginInst(clumps);
  for (const c of CLUMPS) {
    const dt = t - c.t0;
    if (dt < 0) continue;
    const fallT = Math.sqrt(Math.max(0, (c.y0 - c.floor) / 4.9));
    const y = dt < fallT ? c.y0 - 4.9 * dt * dt : c.floor + 0.06 * Math.abs(wobble(t, c.t0 + fallT, 2.5, 7));
    const k = Math.min(dt, fallT) / Math.max(fallT, 0.01);
    const sc = c.s * Math.min(1, dt / 0.05) * popOut(t, c.away, 0.25);
    setInst(clumps, c.x, y, c.z, sc, sc * 0.85, sc, c.rot.x + c.spin.x * k, c.rot.y + c.spin.y * k, c.rot.z + c.spin.z * k);
  }
  endInst(clumps);
  // bricks fly in from the front and snap into the arches
  beginInst(bricks);
  beginInst(mortar);
  for (const b of BRICKS) {
    const f = 0.34;
    const u = prog(t, b.t - f, f);
    if (t < b.t - f) continue;
    const e = easeOutCubic(u);
    const x = lerp(b.from.x, b.x, e), y = lerp(b.from.y, b.y, e) + Math.sin(u * Math.PI) * 0.35, z = lerp(b.from.z, -0.12, e);
    const land = t >= b.t ? popIn(t, b.t, 0.24, 3.2) : 0.9;
    const r = 1 - e;
    const i = setInst(bricks, x, y, z, b.w * land, (WD.BAND - 0.014) * land, 0.24 * (t >= b.t ? 1 : 0.9), b.spin.x * r, b.spin.y * r, b.rz + b.spin.z * r);
    if (i >= 0) bricks.setColorAt(i, b.col);
    if (t >= b.t) setInst(mortar, b.x, b.y, -0.13, b.wm, WD.BAND - 0.002, 0.2, 0, 0, b.rz);
  }
  endInst(bricks);
  endInst(mortar);
  for (const pl of PILASTERS) {
    const k = popIn(t, pl.t, 0.4, 1.8);
    pl.m.visible = k > 0.002;
    pl.m.scale.y = Math.max(k, 0.001);
  }
  // load dots
  beginInst(loadDots);
  if (t > T.loadStart && t < T.loadEnd + 1.2) {
    for (const d of LOAD) {
      const travel = d.path.length / d.sp;
      const cyc = (t - T.loadStart) / travel + d.ph;
      const u = cyc - Math.floor(cyc);
      const emitted = t - u * travel;
      if (emitted < T.loadStart - travel * 0.1 || emitted > T.loadEnd) continue;
      const p = d.path.at(u);
      const fade = clamp(Math.min(u / 0.05, (1 - u) / 0.12)) * (1 - smooth(prog(t, T.loadEnd + 0.2, 0.7)));
      setInst(loadDots, p[0], p[1], p[2], fade);
    }
  }
  endInst(loadDots);
}

function updateAir(t) {
  // candle: lit, flickers as the air goes stale, fizzles out
  const ck = popIn(t, T.candleIn, 0.4, 2.2) * popOut(t, T.darkStart + 0.2, 0.3);
  candle.root.visible = ck > 0.002;
  candle.root.scale.setScalar(Math.max(ck, 0.001));
  const stale = smooth(prog(t, T.staleStart, T.staleFull - T.staleStart));
  const flick = t > T.flicker ? 0.35 * Math.sin(t * 37) * Math.sin(t * 23 + 1) * prog(t, T.flicker, 0.6) : 0;
  const lit = t < T.candleOut ? (1 - 0.45 * prog(t, T.flicker, T.candleOut - T.flicker)) * (1 + flick) : Math.max(0, 1 - (t - T.candleOut) / 0.12);
  candle.flame.visible = lit > 0.01 && ck > 0.01;
  candle.flame.scale.set(lit * (0.9 + 0.1 * Math.sin(t * 19)), lit * (1 + 0.15 * Math.sin(t * 13)), lit);
  candle.flame.rotation.z = 0.12 * Math.sin(t * 7.3) + flick * 0.4;
  candleGlow.visible = candle.flame.visible;
  candleGlow.position.set(CANDLE.x, CANDLE.y + 0.21 * ck, CANDLE.z + 0.05);
  M.glowCandle.opacity = 0.75 * lit * Math.min(1, ck);
  beginInst(smokeWisp);
  for (const p of SMOKE) {
    const dt = t - p.t0;
    if (dt < 0 || dt > p.life) continue;
    const u = dt / p.life;
    const r = 0.035 * (0.5 + 2.2 * u) * (1 - smooth(clamp((u - 0.6) / 0.4)));
    setInst(smokeWisp, CANDLE.x + p.dx * u + 0.03 * Math.sin(dt * 6), CANDLE.y + 0.21 + u * 0.55, CANDLE.z, r);
  }
  endInst(smokeWisp);
  // stale air fills the tunnel, then flows out of the shaft
  beginInst(staleAir);
  for (const p of STALE) {
    if (t < p.tin) continue;
    let k = smooth(prog(t, p.tin, 1.0));
    let x = p.x + 0.08 * Math.sin(t * 0.7 + p.ph), y = p.y + 0.05 * Math.sin(t * 1.1 + p.ph * 2), z = p.z;
    let r = p.r * (0.3 + 0.7 * k);
    const c = prog(t, p.tout, 1.5);
    if (c > 0) {
      // along the tunnel to the shaft, up and out into the garden
      const e = easeInQuad(c);
      const xs = lerp(x, -3.2, Math.min(1, e * 1.6));
      x = xs;
      y = e < 0.62 ? lerp(y, centerY(xs), Math.min(1, e * 2)) : lerp(centerY(-3.2), 1.4, (e - 0.62) / 0.38);
      r *= 1 + e * 0.6;
      k *= 1 - smooth(clamp((e - 0.8) / 0.2));
      if (c >= 1) continue;
    }
    if (k <= 0.01) continue;
    setInst(staleAir, x, y, z, r * k, r * k * 0.8, r * k);
  }
  endInst(staleAir);
  M.stale.opacity = 0.42 + 0.2 * stale;
  // air pipe pushes up through the soil and out of the lawn, cap pops on
  const pg = prog(t, T.pipeStart, T.pipeTop - T.pipeStart);
  const pk = pg > 0 ? Math.min(1.06, easeOutBack(pg, 1.4)) : 0;
  pipe.visible = pk > 0.002;
  pipe.scale.set(1, Math.max(pk, 0.001), 1);
  const cap = popIn(t, T.capPop, 0.35, 2.6);
  ventCap.visible = cap > 0.002;
  ventCap.scale.setScalar(Math.max(cap, 0.001));
  // fresh air dots
  beginInst(airDots);
  if (t > T.freshStart && t < T.airClear + 1.0) {
    const travel = AIR_PATH.length / 3.2;
    for (let i = 0; i < ADOTS; i++) {
      const cyc = (t - T.freshStart) / travel + i / ADOTS;
      const u = cyc - Math.floor(cyc);
      const emitted = t - u * travel;
      if (emitted < T.freshStart - travel * 0.02 || emitted > T.airClear - 0.5) continue;
      const p = AIR_PATH.at(u);
      const jy = Math.sin(i * 7.31) * 0.1 * clamp((u - 0.12) * 5), jz = Math.cos(i * 3.7) * 0.12 * clamp((u - 0.12) * 5);
      const fade = clamp(Math.min(u / 0.04, (1 - u) / 0.08)) * (1 - smooth(prog(t, T.airClear, 0.6)));
      setInst(airDots, p[0], p[1] + jy, p[2] + jz, fade);
    }
  }
  endInst(airDots);
}

function updateLights(t) {
  // pitch dark, then the wire runs along the roof and the bulbs come on one by one
  const dark = smooth(prog(t, T.darkStart, 0.45));
  const wk = smooth(prog(t, T.wireStart, T.wireEnd - T.wireStart));
  setGrow(wire, wk);
  const sp = t > T.wireStart && t < T.wireEnd + 0.25 ? Math.min(1, (t - T.wireStart) / 0.1) * (1 - smooth(prog(t, T.wireEnd, 0.25))) : 0;
  const tip = WIRE_CURVE.getPointAt(clamp(wk, 0.001, 0.999));
  spark.visible = sparkGlow.visible = sp > 0.01;
  spark.position.copy(tip);
  spark.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(t * 47)));
  sparkGlow.position.set(tip.x, tip.y, tip.z + 0.06);
  sparkGlow.material.opacity = 0.8 * sp;
  darkU.uBulbs.value[BULBS.length].set(tip.x, tip.y, 0, 0.9 * sp);
  let lit = 0;
  BULBS.forEach((b, i) => {
    const hang = popIn(t, T.bulbsHang + i * 0.08, 0.35, 2.4);
    b.root.visible = hang > 0.002;
    b.root.scale.setScalar(Math.max(hang, 0.001));
    const t0 = T.bulbsOn + i * T.bulbGap;
    const on = t < t0 ? 0 : Math.min(1, (t - t0) / 0.05) * (t - t0 < 0.12 ? 0.6 + 0.4 * Math.sin((t - t0) * 160) : 1);
    b.glass.material.emissiveIntensity = 2.6 * on;
    b.glow.visible = on > 0.01;
    b.glow.material.opacity = 0.75 * on;
    b.glow.scale.setScalar(1 + 0.06 * Math.sin(t * 9 + i));
    darkU.uBulbs.value[i].set(b.x, b.y, 0, Math.max(on, 0.18 * hang) * hang);
    lit += on / BULBS.length;
  });
  darkU.uDark.value = 0.93 * dark * (1 - 0.62 * lit);
  darkU.uWarm.value = 0.3 * dark;
  tunnelGlow.value = 0.3 * (1 - 0.8 * dark) + 0.32 * lit * dark;
}

function updateCart(t) {
  // rails drop onto the floor, segment by segment
  for (const r of RAIL_SEGS) {
    const k = U.easeOutBounce(prog(t, r.t, 0.4));
    r.g.visible = t >= r.t;
    r.g.position.y = (1 - k) * 0.5;
  }
  // the cart falls down the shaft, lands, zooms to the far end
  cart.root.visible = t >= T.cartDrop;
  let s = CART_S0, y0 = 0, squash = 1;
  if (t < T.cartLand) {
    const u = prog(t, T.cartDrop, T.cartLand - T.cartDrop);
    y0 = (1 - u * u) * 3.9;
  } else if (t < T.cartGo) {
    squash = 1 - 0.22 * Math.exp(-16 * (t - T.cartLand)) * Math.cos((t - T.cartLand) * 30);
  } else {
    const u = prog(t, T.cartGo, T.cartArrive - T.cartGo);
    // pick up speed, rush through the dip, brake at the end
    const e = u < 0.75 ? 0.82 * Math.pow(u / 0.75, 1.6) : 0.82 + 0.18 * easeOutCubic((u - 0.75) / 0.25);
    s = lerp(CART_S0, CART_S1, e);
    if (t > T.cartArrive) squash = 1 - 0.14 * Math.exp(-12 * (t - T.cartArrive)) * Math.cos((t - T.cartArrive) * 26);
  }
  const p = railPath.at(s);
  cart.root.position.set(p.x, p.y + y0, ZC);
  cart.root.rotation.set(0, 0, y0 > 0 ? 0.08 * Math.sin(t * 9) : p.ang);
  cart.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
  const brake = t > T.cartArrive ? Math.exp(-10 * (t - T.cartArrive)) : 0;
  cart.body.rotation.z = -0.15 * brake * Math.sin((t - T.cartArrive) * 18);
  for (const w of cart.wheels) w.rotation.z = -(s - CART_S0) / cart.R * (w.rotation.y ? -1 : 1);
  bat.rotation.z = 0.95 + 0.25 * wobble(t, T.cartArrive, 3, 4) + 0.15 * wobble(t, T.cartLand, 3, 5);
  // snail: crawls along very slowly; spins when the cart whooshes past
  const sk = popIn(t, T.snailIn, 0.4, 2.2) * popOut(t, T.momIn - 0.6, 0.3);
  snail.root.visible = sk > 0.002;
  const sx = -2.62 + 0.28 * prog(t, T.snailIn, 7.0);
  snail.root.position.set(sx, WD.floorAt(sx), -0.13);
  snail.root.scale.setScalar(1.25 * Math.max(sk, 0.001));
  snail.body.scale.set(1 + 0.08 * Math.max(0, Math.sin(t * 5)), 1, 1);
  const pass = railPath.sOfX(sx);
  const whoosh = t > T.cartGo ? Math.exp(-3 * Math.abs(s - pass)) * (t < T.cartArrive + 0.5 ? 1 : 0) : 0;
  snail.shell.rotation.z = 0.5 * whoosh * Math.sin(t * 20);
}

const _cv = new THREE.Vector3();
// IK for a single-segment arm: x-rotation that puts the hand at world height `y`
// (forward of the shoulder); NaN-safe, capped at straight up
function reachX(shoulderY, y, len) {
  return -Math.acos(clamp((shoulderY - y) / len, -1, 1));
}

function updateCharacters(t) {
  // --- Aunty: pops in with a squashy settle, arms crossed, taps her foot on the
  // beat, slaps the slipper on her arm now and then; leans into a glare when he
  // looks up, and lifts the slipper as he sinks away
  const mk = popIn(t, T.momIn, 0.45, 2.0);
  mom.root.visible = mk > 0.002;
  mom.root.position.copy(MOM_POS);
  mom.root.rotation.y = -0.42;
  const settle = t > T.momIn + 0.3 ? wobble(t, T.momIn + 0.3, 2.6, 6.5) : 0;
  const msc = Math.max(mk, 0.001);
  mom.root.scale.set(msc * (1 + 0.05 * settle), msc * (1 - 0.07 * settle), msc * (1 + 0.05 * settle));
  mom.arms.position.y = 0.025 * bump(t, T.momIn + 0.7, T.momIn + 1.25, 0.22); // huff
  const glare = smooth(prog(t, T.lookUp + 0.12, 0.55));
  const beat = (t - T.momIn) * 2.0;
  const ph = beat - Math.floor(beat);
  const toe = t > T.momIn + 0.5 && ph < 0.32 ? Math.sin((ph / 0.32) * Math.PI) : 0;
  mom.footR.rotation.x = -0.42 * toe * (1 - 0.75 * glare);
  mom.body.position.y = 0.006 * toe * (1 - glare);
  let slap = 0;
  for (const ts of [T.momIn + 1.05, T.momIn + 2.3, T.momIn + 3.45, T.momIn + 4.5]) {
    if (t > ts && ts < T.lookUp) slap += Math.exp(-9 * (t - ts)) * Math.sin(Math.min(Math.PI * 3, (t - ts) * 22));
  }
  const raise = smooth(prog(t, T.sink - 0.25, 0.55));
  mom.slipper.rotation.z = 0.3 * slap + 0.6 * raise + 0.05 * Math.sin(t * 17) * raise;
  mom.slipper.position.set(-0.15, 1.17 + 0.12 * raise, 0.21 + 0.03 * raise);
  mom.body.rotation.x = 0.11 * glare;
  mom.head.rotation.x = 0.16 + 0.14 * glare; // looking down at the hole
  mom.head.rotation.y = 0.22 - 0.06 * glare;
  for (const e of mom.eyes) e.scale.set(1, 1 - 0.36 * glare, 1);
  mom.brows.forEach((br, i) => (br.rotation.z = (i ? 1 : -1) * (0.38 + 0.2 * glare)));
  for (const p of mom.pupils) p.position.copy(p.userData.base).add(V(-0.012, -0.012 - 0.004 * glare, 0));

  // --- boy: climbs the ladder, tucks in, shoves the lid, pops out grinning, looks
  // up, goes nervous, waves sheepishly on "Hi, Aunty...", sinks with his eyes on her
  boy.root.visible = t >= T.boyIn;
  const OUT = -0.8, RIM = 0.0, ARM = 0.307;
  let y;
  if (t < T.boyCrouch) {
    let st = 0;
    for (let k = 0; k < 3; k++) st += easeOutCubic(prog(t, T.boyIn + 0.15 + k * 0.42, 0.28));
    y = -1.86 + (st * 0.74) / 3;
  } else if (t < T.lidOpen) y = -1.12 - 0.07 * smooth(prog(t, T.boyCrouch, T.lidOpen - T.boyCrouch));
  else if (t < T.headOut) y = lerp(-1.19, -1.08, easeOutCubic(prog(t, T.lidOpen, 0.15)));
  else y = lerp(-1.08, OUT, Math.min(1.05, easeOutBack(prog(t, T.headOut, 0.3), 2.2)));
  const proud = bump(t, T.headOut + 0.22, T.lookUp + 0.04, 0.1);
  y += 0.016 * Math.sin((t - T.headOut) * 13) * proud;
  const sinkK = easeInOutCubic(prog(t, T.sink, T.sinkBottom - T.sink));
  if (t >= T.sink) y = lerp(OUT, -1.38, sinkK);
  const nervK = smooth(prog(t, T.nervous, 0.3));
  boy.body.scale.y = 1 - 0.04 * nervK; // shrinks into his shoulders
  boy.root.position.set(LID.x, y, LID.z + 0.02);
  boy.root.rotation.y = -0.15;
  // arms: climbing -> tucked under the lid -> shove -> hands on the front rim
  const shoulderY = y + 0.72 * boy.body.scale.y;
  const climbPh = (t - T.boyIn) * 7.5;
  boy.arms.forEach((arm, i) => {
    const s = i ? 1 : -1;
    let rx, rz = 0;
    if (t < T.boyCrouch) rx = -2.55 + 0.35 * Math.sin(climbPh + i * Math.PI);
    else if (t < T.lidOpen) rx = lerp(-2.55, -2.15, smooth(prog(t, T.boyCrouch, 0.15)));
    else if (t < T.headOut + 0.05) rx = lerp(-2.15, -3.05, easeOutCubic(prog(t, T.lidOpen, 0.12)));
    else {
      // hands come down onto the front edge of the hole and hold on while he sinks
      const rim = reachX(shoulderY, RIM, ARM);
      const k = smooth(prog(t, T.headOut + 0.05, 0.2));
      rx = lerp(-3.05, rim, k);
      rz = s * 0.28 * k;
      if (t >= T.sink && shoulderY < RIM - ARM + 0.01) rx = -Math.PI + 0.05; // let go
    }
    arm.rotation.set(rx, 0, rz);
  });
  // sheepish wave with the right hand on "Hi, Aunty..."
  const wv = bump(t, T.wave, T.wave + 1.35, 0.22);
  if (wv > 0) {
    const ra = boy.arms[1];
    ra.rotation.x = lerp(ra.rotation.x, -2.35, wv);
    ra.rotation.z = lerp(ra.rotation.z, 0.42 + 0.3 * Math.sin((t - T.wave) * 15), wv);
  }
  // head: looking up the shaft, cheeky grin bob, the look up at Aunty
  const look = smooth(prog(t, T.lookUp, 0.28));
  const climbLook = t < T.headOut ? 1 - smooth(prog(t, T.lidOpen, 0.3)) : 0;
  boy.head.rotation.x = -0.32 * climbLook - (0.62 + 0.12 * sinkK) * look + 0.045 * Math.sin((t - T.headOut) * 6.5) * proud;
  boy.head.rotation.y = 0.5 * look;
  boy.head.rotation.z = 0.09 * Math.sin((t - T.headOut) * 6.5 + 0.8) * proud;
  boy.head.position.y = 0.82 - 0.02 * nervK;
  for (const p of boy.pupils) p.position.copy(p.userData.base).add(V(0.012 * look, 0.016 * look + 0.012 * climbLook, 0));
  // grin -> frozen grin -> nervous wobbly smile, brows, sweat drop
  const nerv = t >= T.nervous;
  boy.grin.visible = !nerv;
  boy.grin.scale.set(1, 1 - 0.45 * smooth(prog(t, T.lookUp + 0.2, 0.25)), 1);
  boy.nervous.visible = nerv;
  boy.nervous.scale.setScalar(nerv ? Math.max(popIn(t, T.nervous, 0.25, 2.0), 0.001) : 1);
  const cheeky = bump(t, T.headOut + 0.35, T.headOut + 0.75, 0.08) * Math.max(0, Math.sin((t - T.headOut - 0.35) * 15));
  boy.brows.forEach((br, i) => {
    if (!br.userData.base) br.userData.base = br.position.clone();
    br.position.copy(br.userData.base).add(V(0, 0.018 * cheeky + 0.008 * look, 0));
    br.rotation.z = (i ? -1 : 1) * 0.42 * nervK;
  });
  boy.sweat.scale.setScalar(Math.max(0.001, popIn(t, T.nervous + 0.15, 0.3, 2.2)));
  boy.sweat.position.y = 0.035 * prog(t, T.nervous + 0.3, 2.0);
  // the beam only shows once he looks up (towards the camera it would read as a flat disc)
  boy.beam.material.opacity = 0.075 * look;
  boy.beam.visible = look > 0.01;
}

function updateGirl(t) {
  // rises up behind the window sill as the boy's head comes out, glances away,
  // double-takes, then freezes in shock: eyes pop, mouth drops, hands to her
  // cheeks, then over her mouth on "Hi, Aunty..."; flinches when the lid slams
  girl.root.visible = t >= T.girlUp - 0.04;
  if (!girl.root.visible) return;
  const rise = Math.min(1.06, easeOutBack(prog(t, T.girlUp, 0.3), 1.9));
  const risePh = prog(t, T.girlUp, 0.3);
  const shockK = Math.min(1.12, easeOutBack(prog(t, T.girlShock, 0.14), 2.6));
  const jolt = t > T.girlShock ? Math.exp(-7 * (t - T.girlShock)) : 0;
  const freeze = smooth(prog(t, T.girlShock + 0.15, 0.25));
  const flinch = t > T.lidClose ? Math.exp(-7 * (t - T.lidClose)) * Math.min(1, (t - T.lidClose) / 0.04) : 0;
  const shiverX = 0.004 * Math.sin(t * 43) * freeze, shiverR = 0.028 * Math.sin(t * 37) * freeze;
  girl.root.position.copy(GIRL_WIN).add(V(shiverX, -0.42 - 0.85 * (1 - rise) + 0.045 * jolt, 0.03));
  girl.root.rotation.z = shiverR;
  // squash before the rise, stretch on the way up, settle; a jolt at the shock
  const pre = t < T.girlUp ? 0.82 : 1;
  const stretch = 0.14 * Math.sin(Math.PI * risePh) * (risePh < 1 ? 1 : 0);
  const sy = pre * (1 + stretch + 0.07 * jolt - 0.08 * flinch);
  girl.body.scale.set(1 / Math.sqrt(sy), sy, 1);
  // head: curious tilt, glance away, snap back, recoil at the shock
  const away = smooth(prog(t, T.girlAway, 0.1)) * (t < T.girlTake ? 1 : 0);
  const back = t >= T.girlTake ? Math.min(1.12, easeOutBack(prog(t, T.girlTake, 0.12), 2.4)) : 0;
  const yaw = t < T.girlTake ? lerp(0.1, -0.52, away) : lerp(-0.52, 0.1, back);
  girl.head.rotation.set(-0.07 - 0.14 * jolt + 0.05 * smooth(prog(t, T.girlCover, 0.25)) - 0.12 * flinch, yaw, 0.08 * Math.sin(t * 3.1) * (1 - freeze));
  // eyes pop wider, pupils shrink to dots; brows shoot up
  const wide = 1 + 0.32 * clamp(shockK, 0, 1.12) - 0.4 * flinch;
  girl.eyes.forEach((e) => e.scale.set(1 + 0.32 * clamp(shockK, 0, 1.12), wide, 1));
  const lookAt = t < T.girlAway ? V(0.006, -0.012, 0) : t < T.girlTake ? V(-0.02, -0.004, 0) : V(0.006, -0.013, 0);
  girl.pupils.forEach((p) => {
    p.position.copy(p.userData.base).addScaledVector(p.userData.n, 0.025 * clamp(shockK, 0, 1)).add(lookAt);
    p.scale.setScalar(1 - 0.3 * clamp(shockK, 0, 1));
  });
  girl.brows.forEach((br, i) => {
    const s = i ? 1 : -1;
    br.position.copy(br.userData.base).add(V(0, 0.04 * clamp(shockK, 0, 1.1), 0));
    br.rotation.z = -s * (0.12 + 0.26 * clamp(shockK, 0, 1));
  });
  // mouth: curious little smile, then the big O; gasps harder when the music cuts
  const shocked = t >= T.girlShock;
  girl.smile.visible = !shocked;
  girl.mouth.visible = shocked;
  const gasp = 1 + 0.28 * smooth(prog(t, T.musicStop - 0.1, 0.3));
  girl.mouth.scale.set(clamp(shockK, 0.001, 1.15), clamp(shockK, 0.001, 1.15) * gasp, 1);
  // pigtails bounce
  girl.pigtails.rotation.z = 0.12 * wobble(t, T.girlShock, 3.2, 4.5) + 0.06 * wobble(t, T.girlUp + 0.2, 3, 5);
  // hands: on the sill -> slapped to her cheeks -> over her mouth
  girl.root.updateMatrixWorld(true);
  const toCheeks = Math.min(1.1, easeOutBack(prog(t, T.girlShock + 0.02, 0.12), 2.0));
  const toMouth = smooth(prog(t, T.girlCover, 0.22));
  girl.hands.forEach((h, i) => {
    const s = i ? 1 : -1;
    const sill = _cv.set(s * 0.2, -0.125, 0.17);
    const sx = sill.x, sy2 = sill.y, sz = sill.z;
    const cheek = girl.face.localToWorld(new THREE.Vector3(s * 0.205, -0.07, 0.15));
    const overMouth = girl.face.localToWorld(new THREE.Vector3(s * 0.066, -0.112, 0.236));
    const target = cheek.lerp(overMouth, toMouth);
    girl.body.worldToLocal(target);
    h.position.set(lerp(sx, target.x, toCheeks), lerp(sy2, target.y, toCheeks), lerp(sz, target.z, toCheeks));
    // flatter, wider hands when they cover her mouth, so they read as two hands
    h.scale.set(1 + 0.3 * toMouth, 1 - 0.22 * toMouth, 1);
    h.rotation.z = -s * 0.35 * toMouth;
  });
}

function update(t) {
  updateDigging(t);
  updateDust(t);
  updateLid(t);
  updateArches(t);
  updateAir(t);
  updateLights(t);
  updateCart(t);
  updateCharacters(t);
  updateGirl(t);
  // light mood: golden hour deepening slightly in the finale
  const warm = smooth(prog(t, T.momIn, T.headOut - T.momIn)) * 0.6;
  sun.color.copy(sunColA).lerp(sunColB, warm);
  skyUniforms.warm.value = warm;
  grade.uniforms.warm.value = 0.35 + 0.65 * warm;
}

function updateCamera(t) {
  const k = easeInOutCubic(prog(t, T.pushIn, T.pushInEnd - T.pushIn));
  // zoom evenly: interpolate 1/distance, and keep the target framing consistent
  const iz = lerp(1 / CAM_WIDE.cz, 1 / CAM_CLOSE.cz, k);
  const c = {};
  for (const key of Object.keys(CAM_WIDE)) c[key] = lerp(CAM_WIDE[key], CAM_CLOSE[key], k);
  c.cz = 1 / iz;
  applyCam(c);
}

// ---------------------------------------------------------------------------
// accumulation renderer (Eevee-style): sub-pixel jitter, soft sun, occluded
// sky light and motion blur are averaged over N sub-frames
// ---------------------------------------------------------------------------
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
    renderer.autoClear = false;
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
update(0);
updateCamera(0);
renderer.compile(scene, camera);
window.READY = true;
