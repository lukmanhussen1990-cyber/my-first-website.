// The kitchen: concrete floor slab with cozy tiles and the secret trapdoor, base
// cabinets and counter, the open top shelf with the snacks, the fridge and its
// light, twelve glowing footprints, and the little pulley that lowers the snacks
// into the tunnel. Everything is a pure function of t (see the T keys).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { T } from './timeline.js';
import * as WD from './world.js';
import * as U from './util.js';
import { patch, std, col } from './materials.js';
import { placed, box, boxMM, mergeAll } from './geom.js';

const { clamp, lerp, prog, popIn, smooth, easeOutBack, easeInOutCubic, easeOutCubic, easeInQuad, wobble, bump } = U;
const { HOUSE, TILE, PULLEY } = WD;
// env.js builds the back wall from HOUSE.z0 to HOUSE.z0 + wall, so everything that
// stands against it starts at its inner face
const ZW = HOUSE.z0 + HOUSE.wall;
const onWall = (o) => ({ ...o, z0: ZW, z1: ZW + (o.z1 - o.z0) });
const SHELF = onWall(WD.SHELF), COUNTER = onWall(WD.COUNTER), FRIDGE = onWall(WD.FRIDGE);
const FY = HOUSE.floor; // top of the tiles (0.18)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// shared GLSL: tiles, concrete, wood, painted wood, subway tiles
// ---------------------------------------------------------------------------
const GLSL_KIT = /* glsl */ `
float aaw(float x){ return max(fwidth(x), 1e-5); }
// 0.4 m tiles aligned with the trapdoor tile; warm cream / terracotta checker
vec3 tileCol(vec3 p, out float rough, out float h){
  vec2 q = (p.xz - vec2(3.25, -1.25)) / 0.4;
  vec2 id = floor(q), f = fract(q);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) * 0.4;
  float a = aaw(e);
  float grout = 1.0 - smoothstep(0.0042 - a, 0.0042 + a, e);
  float chk = mod(id.x + id.y, 2.0);
  vec3 cream = s2l(vec3(0.91, 0.85, 0.73)), terra = s2l(vec3(0.80, 0.53, 0.41));
  float hv = h21(id + 7.3);
  vec3 c = mix(cream, terra, chk) * (0.9 + 0.14 * hv);
  float fine = 1.0 - smoothstep(0.3, 0.8, aaw(p.x * 9.0));
  c *= 1.0 + 0.09 * (vnoise(p.xz * 9.0 + id * 3.1) - 0.5) * fine;
  c *= 1.0 - 0.05 * smoothstep(0.03, 0.0, e); // glaze pools darker at the edges
  c = mix(c, s2l(vec3(0.52, 0.48, 0.43)), grout);
  rough = mix(0.16 + 0.12 * hv, 0.92, grout);
  h = -0.0022 * grout + 0.0012 * smoothstep(0.0, 0.03, e) + 0.0003 * vnoise(p.xz * 23.0) * fine;
  return c;
}
vec3 concreteCol(vec3 p, vec3 n, out float h){
  vec2 uv = puv(p, n);
  float a = fbm(uv * 3.0);
  vec3 c = s2l(vec3(0.60, 0.59, 0.56)) * (0.84 + 0.22 * a);
  vec4 ce = cellv(uv * 20.0);
  float peb = (1.0 - smoothstep(0.16, 0.3, ce.z)) * step(0.55, ce.w);
  c = mix(c, s2l(vec3(0.46, 0.43, 0.39)) * (0.8 + 0.4 * fract(ce.w * 9.1)), peb * 0.55);
  float fine = 1.0 - smoothstep(0.25, 0.7, aaw(uv.x * 80.0));
  float pore = step(0.93, h21(floor(uv * 80.0))) * fine;
  c *= 1.0 - 0.22 * pore;
  h = 0.0022 * a + 0.0012 * peb - 0.001 * pore;
  return c;
}
uniform vec3 uWood; uniform float uGrain;
vec2 grainUV(vec3 p, vec3 n){
  if (uGrain < 0.5) return vec2(p.x, abs(n.y) > 0.5 ? p.z : p.y);
  if (uGrain < 1.5) return vec2(p.y, abs(n.x) > 0.5 ? p.z : p.x);
  return vec2(p.z, abs(n.y) > 0.5 ? p.x : p.y);
}
vec3 woodCol(vec3 p, vec3 n){
  vec2 g = grainUV(p, n);
  float streak = fbm(vec2(g.x * 1.6, g.y * 48.0));
  float fine = 1.0 - smoothstep(0.3, 0.8, aaw(g.y * 120.0));
  float ring = 0.5 + 0.5 * sin(g.y * 120.0 + fbm(vec2(g.x * 2.2, g.y * 5.0)) * 8.0);
  return uWood * (0.78 + 0.3 * streak) * (1.0 - 0.12 * ring * fine);
}
float woodBump(vec3 p, vec3 n){ vec2 g = grainUV(p, n); return 0.0014 * fbm(vec2(g.x * 1.6, g.y * 48.0)); }
float woodRough(vec3 p, vec3 n){ vec2 g = grainUV(p, n); return 0.55 + 0.25 * fbm(vec2(g.x * 3.0, g.y * 30.0)); }
uniform vec3 uPaint;
vec3 paintCol(vec3 p, vec3 n){ return uPaint * (0.95 + 0.07 * vnoise3(p * 31.0)); }
float paintRough(vec3 p, vec3 n){ return 0.42 + 0.12 * vnoise3(p * 17.0); }
float paintBump(vec3 p, vec3 n){ return 0.0004 * vnoise3(p * 60.0); }
// white subway tiles behind the counter
vec3 subwayCol(vec3 p, vec3 n, out float h){
  vec2 q = vec2(p.x / 0.15, (p.y - 1.1) / 0.075);
  q.x += 0.5 * mod(floor(q.y), 2.0);
  vec2 f = fract(q);
  float e = min(min(f.x, 1.0 - f.x) * 0.15, min(f.y, 1.0 - f.y) * 0.075);
  float a = aaw(e);
  float grout = 1.0 - smoothstep(0.003 - a, 0.003 + a, e);
  vec3 c = s2l(vec3(0.88, 0.89, 0.86)) * (0.94 + 0.08 * h21(floor(q)));
  h = -0.0015 * grout + 0.0008 * smoothstep(0.0, 0.012, e);
  return mix(c, s2l(vec3(0.6, 0.6, 0.57)), grout);
}
`;

// object-space variant of patch(): patterns stick to a moving part (its closed
// pose is `origin` + local position), so the trapdoor tile matches the floor
function patchObj(mat, origin) {
  const ob = mat.onBeforeCompile;
  mat.userData.uniforms.uOrigin = { value: origin };
  mat.onBeforeCompile = (shader) => {
    ob(shader);
    shader.uniforms.uOrigin = mat.userData.uniforms.uOrigin;
    shader.vertexShader = shader.vertexShader
      .replace('varying vec3 vWNrm;', 'varying vec3 vWNrm;\nuniform vec3 uOrigin;')
      .replace('vWPos = (modelMatrix * wpp).xyz;', 'vWPos = uOrigin + wpp.xyz;')
      .replace('vWNrm = normalize(mat3(modelMatrix) * wn);', 'vWNrm = normalize(wn);');
  };
  return mat;
}

const cutU = { value: 0 }; // dark seam round the trapdoor once it is cut
function slabMaterial(key, origin = null) {
  const m = patch(std('#ffffff', 0.8, 0, { envMapIntensity: 0.6 }), {
    key, bump: 1.0,
    uniforms: { uCut: cutU },
    extraFrag: GLSL_KIT + `uniform float uCut;
      bool isTop(vec3 p, vec3 n){ return n.y > 0.5 && p.y > 0.17; }
      bool isEdge(vec3 p, vec3 n){ return n.y < 0.5 && p.y > 0.149; }
      vec3 slabCol(vec3 p, vec3 n){
        float r, h;
        if (isTop(p, n)) {
          vec3 c = tileCol(p, r, h);
          vec2 d = abs(p.xz - vec2(3.45, -1.05)) - 0.2;
          float ring = 1.0 - smoothstep(0.0, 0.008, abs(max(d.x, d.y)));
          return c * (1.0 - 0.75 * uCut * ring);
        }
        if (isEdge(p, n)) return s2l(vec3(0.93, 0.89, 0.81)) * (0.95 + 0.05 * vnoise(p.xy * 40.0));
        return concreteCol(p, n, h);
      }
      float slabRough(vec3 p, vec3 n){ float r, h; if (isTop(p, n)) { tileCol(p, r, h); return r; } if (isEdge(p, n)) return 0.2; return 0.92; }
      float slabBump(vec3 p, vec3 n){ float r, h; if (isTop(p, n)) { tileCol(p, r, h); return h; } if (isEdge(p, n)) return 0.0; concreteCol(p, n, h); return h; }`,
    colorFn: 'slabCol', roughFn: 'slabRough', bumpFn: 'slabBump',
  });
  return origin ? patchObj(m, origin) : m;
}
function woodMaterial(hex, grain, key, origin = null) {
  const m = patch(std('#ffffff', 0.6, 0, { envMapIntensity: 0.5 }), {
    key, bump: 1.0,
    uniforms: { uWood: { value: col(hex) }, uGrain: { value: grain } },
    extraFrag: GLSL_KIT, colorFn: 'woodCol', bumpFn: 'woodBump', roughFn: 'woodRough',
  });
  return origin ? patchObj(m, origin) : m;
}
function paintMaterial(hex, key) {
  return patch(std('#ffffff', 0.45, 0, { envMapIntensity: 0.7 }), {
    key, uniforms: { uPaint: { value: col(hex) } }, extraFrag: GLSL_KIT, colorFn: 'paintCol', roughFn: 'paintRough', bumpFn: 'paintBump',
  });
}

// ---------------------------------------------------------------------------
// canvas textures (bag graphics, cookies, wicker, plaid): no text, no logos
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw, repeat = null) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  if (repeat) {
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(repeat[0], repeat[1]);
  }
  return tx;
}
function drawBag(g, w, h, pal) {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, pal.top);
  grd.addColorStop(1, pal.bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // sunburst behind the chip
  g.save();
  g.translate(w / 2, h * 0.5);
  g.fillStyle = pal.ray;
  for (let i = 0; i < 14; i++) {
    g.rotate((Math.PI * 2) / 14);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, -w * 0.13);
    g.lineTo(w, w * 0.13);
    g.closePath();
    g.fill();
  }
  g.restore();
  g.fillStyle = pal.disc;
  g.beginPath();
  g.arc(w / 2, h * 0.5, w * 0.31, 0, Math.PI * 2);
  g.fill();
  // a big wavy chip, slightly tilted, with a highlight and seasoning flecks
  g.save();
  g.translate(w / 2, h * 0.5);
  g.rotate(-0.35);
  g.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r = 1 + 0.06 * Math.sin(a * 7);
    const x = Math.cos(a) * w * 0.25 * r, y = Math.sin(a) * w * 0.17 * r;
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.closePath();
  g.fillStyle = pal.chip;
  g.fill();
  g.lineWidth = w * 0.018;
  g.strokeStyle = pal.chipEdge;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(-w * 0.07, -w * 0.05, w * 0.08, w * 0.03, -0.2, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 9; i++) {
    g.fillStyle = 'rgba(120,60,10,0.35)';
    g.beginPath();
    g.arc(Math.cos(i * 2.4) * w * 0.15, Math.sin(i * 1.7) * w * 0.09, w * 0.012, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // sparkles
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, s] of [[0.2, 0.22, 1], [0.8, 0.3, 0.7], [0.78, 0.74, 0.9], [0.24, 0.78, 0.6]]) {
    g.save();
    g.translate(x * w, y * h);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, r = (i % 2 ? 0.012 : 0.04) * w * s;
      if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    g.restore();
  }
  // crimped seals top and bottom
  for (const y0 of [0, h * 0.92]) {
    g.fillStyle = pal.crimp;
    g.fillRect(0, y0, w, h * 0.08);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < w; x += w / 24) g.fillRect(x, y0, w / 48, h * 0.08);
  }
}
const BAG_PAL = [
  { top: '#ff6a3d', bottom: '#d9302c', ray: 'rgba(255,214,90,0.45)', disc: '#ffd25a', chip: '#f7c25c', chipEdge: '#c98a2c', crimp: '#b52222' },
  { top: '#3fb6c9', bottom: '#2563b8', ray: 'rgba(255,255,255,0.28)', disc: '#9fe36b', chip: '#f4c86a', chipEdge: '#c48e35', crimp: '#1f4f96' },
];
function drawCookie(g, w, h) {
  const grd = g.createRadialGradient(w / 2, h / 2, w * 0.1, w / 2, h / 2, w / 2);
  grd.addColorStop(0, '#e3a75a');
  grd.addColorStop(0.8, '#c9873f');
  grd.addColorStop(1, '#9c5f27');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const r = U.mulberry32(9);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${150 + r() * 60},${90 + r() * 40},${40 + r() * 20},0.35)`;
    g.beginPath();
    g.arc(r() * w, r() * h, 1 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * w * 0.36;
    g.fillStyle = '#3b1f12';
    g.beginPath();
    g.ellipse(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, w * 0.045, w * 0.035, r() * 3, 0, Math.PI * 2);
    g.fill();
  }
}
function drawWicker(g, w, h) {
  g.fillStyle = '#7a5530';
  g.fillRect(0, 0, w, h);
  const rows = 8, cols = 8;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = (i / cols) * w, y = (j / rows) * h;
      const grd = g.createLinearGradient(0, y, 0, y + h / rows);
      const light = (i + j) % 2 ? '#d8a764' : '#c4914f';
      grd.addColorStop(0, '#6b4524');
      grd.addColorStop(0.5, light);
      grd.addColorStop(1, '#6b4524');
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(x + w / cols / 2, y + h / rows / 2, w / cols / 2, h / rows / 2.3, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}
function drawPlaid(g, w, h) {
  g.fillStyle = '#efe3cf';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(200,52,46,0.55)';
  for (let i = 0; i < 6; i++) {
    g.fillRect((i / 6) * w, 0, w / 14, h);
    g.fillRect(0, (i / 6) * h, w, h / 14);
  }
}

// ---------------------------------------------------------------------------
// snacks: shared builders (the kid and Mom hold identical copies)
// ---------------------------------------------------------------------------
const CACHE = {};
function bagGeo() {
  if (CACHE.bagGeo) return CACHE.bagGeo;
  // a puffy pillow with flat crimped seals; origin at the bottom centre
  const w = 0.16, h = 0.224, d = 0.06;
  const g = new THREE.BoxGeometry(w, h, d, 14, 18, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = x / (w / 2), v = y / (h / 2);
    const seal = smooth(clamp((Math.abs(v) - 0.84) / 0.08));
    const puff = Math.pow(Math.max(0, 1 - u * u), 0.5) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(v) / 0.92, 4)), 0.6);
    const zz = Math.sign(z) * (d / 2) * Math.max(0.06, puff * (1 - seal) + 0.06 * seal);
    const xx = x * (1 - 0.06 * (1 - Math.abs(v)) * (1 - seal)); // the sides pull in a little where it puffs
    p.setXYZ(i, xx, y + h / 2, zz);
  }
  g.computeVertexNormals();
  return (CACHE.bagGeo = g);
}
function bagMats(k) {
  CACHE.bagMats ??= [];
  if (!CACHE.bagMats[k]) {
    const map = canvasTex(256, 360, (g, w, h) => drawBag(g, w, h, BAG_PAL[k]));
    CACHE.bagMats[k] = new THREE.MeshStandardMaterial({ map, roughness: 0.32, metalness: 0.35, envMapIntensity: 1.2, emissive: new THREE.Color(0, 0, 0) });
  }
  return CACHE.bagMats[k];
}
// bag of chips (variant 0 red, 1 blue), 0.16 x 0.224 x 0.06 m, origin at the bottom centre
export function makeChipsBag(ctx, variant = 0) {
  const grp = new THREE.Group();
  const m = new THREE.Mesh(bagGeo(), bagMats(variant % 2));
  m.castShadow = true;
  m.receiveShadow = true;
  grp.add(m);
  grp.userData.size = { w: 0.16, h: 0.224, d: 0.06 };
  return grp;
}
function jarParts(envMap) {
  if (CACHE.jar) return CACHE.jar;
  const prof = [[0.0, 0.0], [0.058, 0.0], [0.064, 0.008], [0.066, 0.11], [0.06, 0.13], [0.046, 0.142], [0.046, 0.152]].map(([r, y]) => new THREE.Vector2(r, y));
  const glass = new THREE.MeshStandardMaterial({ color: col('#dff3f5'), roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide, envMap, envMapIntensity: 2.0 });
  const lid = new THREE.MeshStandardMaterial({ color: col('#b98552'), roughness: 0.5 });
  const cookie = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, drawCookie), roughness: 0.85 });
  const cookieSide = new THREE.MeshStandardMaterial({ color: col('#b9793a'), roughness: 0.9 });
  return (CACHE.jar = { glassGeo: new THREE.LatheGeometry(prof, 40), glass, lid, cookie, cookieSide });
}
// glass cookie jar with cookies, radius 0.066, height 0.18, origin at the bottom centre
export function makeCookieJar(ctx) {
  const P = jarParts(ctx.envMap);
  const grp = new THREE.Group();
  const cg = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24);
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(cg, [P.cookieSide, P.cookie, P.cookie]);
    const a = i * 2.1;
    c.position.set(Math.cos(a) * 0.022 * (i % 3), 0.012 + i * 0.014, Math.sin(a) * 0.022 * (i % 3));
    c.rotation.set(0.25 * Math.sin(i * 1.7), a, 0.25 * Math.cos(i * 2.3));
    c.castShadow = true;
    grp.add(c);
  }
  const g = new THREE.Mesh(P.glassGeo, P.glass);
  g.renderOrder = 3;
  g.userData.cast = false;
  grp.add(g);
  const lid = new THREE.Mesh(mergeAll([placed(new THREE.CylinderGeometry(0.052, 0.054, 0.016, 32), 0, 0.158, 0), placed(new THREE.SphereGeometry(0.016, 16, 12), 0, 0.172, 0)]), P.lid);
  lid.castShadow = true;
  grp.add(lid);
  grp.userData.size = { r: 0.066, h: 0.18 };
  return grp;
}

// ---------------------------------------------------------------------------
// motion: trapdoor angle and basket position (exported for the characters)
// ---------------------------------------------------------------------------
const OPEN = 1.75; // a little past upright, leaning back on its hinges
const PEEK = 1.12; // held open by the kid while he peeks
// trapdoor angle in radians (0 = closed); it swings up on its back edge (z = -1.25)
export function trapAngle(t) {
  let a = 0;
  if (t >= T.trapOpen) {
    const u = prog(t, T.trapOpen, 0.55);
    a = OPEN * Math.min(1.08, easeOutBack(u, 2.0));
    a -= 0.12 * wobble(t, T.trapOpen + 0.5, 3.5, 7);
  }
  if (t >= T.trapClose0) {
    const u = prog(t, T.trapClose0, T.trapClose1 - T.trapClose0);
    a = OPEN * (1 - easeInQuad(u));
    if (t > T.trapClose1) a = 0.05 * Math.abs(wobble(t, T.trapClose1, 5, 9));
  }
  if (t >= T.peek0) {
    const u = prog(t, T.peek0, T.peek1 - T.peek0);
    a = PEEK * easeOutCubic(u) + 0.04 * Math.sin((t - T.peek0) * 2.3) * smooth(clamp((t - T.peek1) / 0.3));
  }
  if (t >= T.close0) {
    const u = prog(t, T.close0, T.close1 - T.close0);
    const hold = PEEK + 0.04 * Math.sin((T.close0 - T.peek0) * 2.3);
    a = hold * (1 - U.easeInOutSine(u));
    if (t > T.close1) a = 0.03 * Math.abs(wobble(t, T.close1, 6, 10));
  }
  return a;
}
const WR = 0.09; // pulley wheel radius
const BX = PULLEY.x - WR, BZ = PULLEY.z; // the basket hangs from the wheel's left side
const UPY = 1.95, DOWNY = -1.85, LANDY = FY + 0.003;
const BUILT = () => T.pulley0 + 4 * T.pulleyGap;
// basket: x, y = bottom of the basket, z; tilt (radians about z); vis 0..1 (pops in when built)
export function basketAt(t) {
  const out = { x: BX, y: UPY, z: BZ, tilt: 0, vis: popIn(t, BUILT(), 0.4, 2.2) };
  if (t >= T.lower0) out.y = lerp(UPY, DOWNY, easeInOutCubic(prog(t, T.lower0, T.lower1 - T.lower0)));
  if (t >= T.lower1) out.y = DOWNY + 0.03 * wobble(t, T.lower1, 2.2, 4);
  if (t >= T.basketUp0) out.y = lerp(DOWNY, UPY, easeInOutCubic(prog(t, T.basketUp0, T.basketUp1 - T.basketUp0)));
  if (t >= T.basket2_0) {
    const u = prog(t, T.basket2_0, T.basket2_1 - T.basket2_0);
    out.y = lerp(UPY, LANDY, easeInQuad(u) * 0.35 + smooth(u) * 0.65);
    if (t >= T.basket2_1) out.y = LANDY + 0.05 * Math.abs(Math.sin((t - T.basket2_1) * 14)) * Math.exp(-(t - T.basket2_1) * 9);
  }
  // pushed off the trapdoor when the kid opens it: a little hop to the left, tips over
  const s0 = T.peek0 + 0.08;
  if (t >= s0) {
    const u = prog(t, s0, 0.45);
    out.x = lerp(BX, BX - 0.36, easeOutCubic(u));
    out.z = lerp(BZ, BZ + 0.05, u);
    out.y = LANDY + 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.1)) * (1 - u);
    out.tilt = 0.95 * easeOutBack(u, 1.6) + 0.06 * wobble(t, s0 + 0.45, 3, 7);
  }
  return out;
}
const wheelAngle = (t) => (UPY - clamp(basketAt(t).y, DOWNY, UPY)) / WR;

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
export function build(ctx) {
  const { scene, add, envMap } = ctx;
  const M = {
    slab: slabMaterial('kitSlab'),
    oak: woodMaterial('#b07a49', 0, 'kitOak'),
    oakY: woodMaterial('#a8723f', 1, 'kitOakY'),
    oakZ: woodMaterial('#a8723f', 2, 'kitOakZ'),
    pine: woodMaterial('#c89a63', 0, 'kitPine'),
    sage: paintMaterial('#8fae8f', 'kitSage'),
    sageDark: paintMaterial('#6f9070', 'kitSageD'),
    brass: std('#caa24f', 0.28, 0.95, { envMap, envMapIntensity: 1.4 }),
    iron: std('#2d2a28', 0.55, 0.7, { envMap }),
    enamel: std('#f1ebdd', 0.26, 0.05, { envMap, envMapIntensity: 0.9 }),
    chrome: std('#d9dde0', 0.18, 1.0, { envMap, envMapIntensity: 1.6 }),
    liner: std('#f4f3ee', 0.4, 0.0, { emissive: col('#fff1d6'), emissiveIntensity: 0 }),
    shelfGlass: new THREE.MeshStandardMaterial({ color: col('#e8f6f6'), roughness: 0.08, transparent: true, opacity: 0.35, depthWrite: false, envMap }),
    subway: patch(std('#ffffff', 0.25, 0, { envMap, envMapIntensity: 0.8 }), {
      key: 'kitSubway', extraFrag: GLSL_KIT + 'vec3 swCol(vec3 p, vec3 n){ float h; return subwayCol(p, n, h); } float swBump(vec3 p, vec3 n){ float h; subwayCol(p, n, h); return h; }',
      colorFn: 'swCol', bumpFn: 'swBump',
    }),
  };
  const meshOf = (geoms, mat, cast = true) => {
    const m = new THREE.Mesh(Array.isArray(geoms) ? mergeAll(geoms) : geoms, mat);
    m.castShadow = cast;
    m.userData.cast = cast;
    m.receiveShadow = true;
    return m;
  };

  // --- floor slab + tiles, with the trapdoor hole --------------------------
  const HX0 = TILE.x0, HX1 = TILE.x1, HZ0 = TILE.z0, HZ1 = TILE.z1;
  const SB = HOUSE.slab0, ZB = HOUSE.z0; // runs on under the back wall
  add(meshOf([
    boxMM(HOUSE.x0, SB, HZ1, HOUSE.x1, FY, 0), // front
    boxMM(HOUSE.x0, SB, ZB, HOUSE.x1, FY, HZ0), // back
    boxMM(HOUSE.x0, SB, HZ0, HX0, FY, HZ1), // left of the hole
    boxMM(HX1, SB, HZ0, HOUSE.x1, FY, HZ1), // right of the hole
  ], M.slab));

  // --- the trapdoor: tile on a little board, pivoting on its back edge ------
  const PIV = V((HX0 + HX1) / 2, FY + 0.008, HZ0);
  const trap = new THREE.Group();
  trap.position.copy(PIV);
  const g0 = 0.003; // hairline gap all round
  const tileMat = slabMaterial('kitTrapTile', PIV);
  const boardMat = woodMaterial('#8a5a34', 0, 'kitTrapBoard', PIV);
  trap.add(meshOf(box(0.4 - 2 * g0, 0.03, 0.4 - 2 * g0, 0, FY - 0.015 - PIV.y, 0.2), tileMat));
  trap.add(meshOf(box(0.37, 0.026, 0.37, 0, FY - 0.043 - PIV.y, 0.2), boardMat));
  trap.add(meshOf([box(0.04, 0.02, 0.34, -0.11, FY - 0.066 - PIV.y, 0.2), box(0.04, 0.02, 0.34, 0.11, FY - 0.066 - PIV.y, 0.2)], boardMat));
  add(trap);

  // hinges: a fixed leaf on the floor behind, a leaf on the trapdoor, the knuckle
  const hinges = [-0.13, 0.13].map((dx) => {
    const fixed = new THREE.Group();
    fixed.position.set(PIV.x + dx, PIV.y, PIV.z);
    fixed.add(meshOf([box(0.055, 0.004, 0.045, 0, -0.006, -0.026), placed(new THREE.CylinderGeometry(0.0075, 0.0075, 0.058, 12), 0, 0, 0, 0, 0, Math.PI / 2)], M.brass));
    const moving = new THREE.Group();
    moving.position.set(dx, 0, 0);
    moving.add(meshOf(box(0.055, 0.004, 0.045, 0, -0.006, 0.026), M.brass));
    trap.add(moving);
    add(fixed);
    return { fixed, moving };
  });

  // glowing cut line round the tile, sparks at its tip
  const cutMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.6, 0.55), transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const EDGE = [[HX0, HZ1, HX1, HZ1], [HX1, HZ1, HX1, HZ0], [HX1, HZ0, HX0, HZ0], [HX0, HZ0, HX0, HZ1]];
  const cutSegs = EDGE.map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.004, 0.014), cutMat);
    m.renderOrder = 9;
    scene.add(m);
    return m;
  });
  const sparkMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.0, 2.2, 0.8), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const sparks = ctx.instanced(new THREE.SphereGeometry(1, 6, 4), sparkMat, 40, false);
  sparks.renderOrder = 9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), sparkMat);
  scene.add(head);
  const perimeter = (u) => {
    // u in [0, 4): position along the four edges
    const k = Math.min(3, Math.floor(u)), f = u - k;
    const [x0, z0, x1, z1] = EDGE[k];
    return [lerp(x0, x1, f), lerp(z0, z1, f)];
  };

  // --- base cabinets, counter, backsplash -----------------------------------
  const C = COUNTER, ctop = FY + C.h;
  {
    const body = [boxMM(C.x0, FY + 0.09, C.z0, C.x1, ctop - 0.04, C.z1 - 0.025)];
    const fronts = [], frames = [], knobs = [];
    const n = 4, w = (C.x1 - C.x0) / n;
    for (let i = 0; i < n; i++) {
      const x0 = C.x0 + i * w + 0.006, x1 = C.x0 + (i + 1) * w - 0.006;
      const zf = C.z1 - 0.025;
      fronts.push(boxMM(x0, ctop - 0.235, zf, x1, ctop - 0.05, zf + 0.022)); // drawer
      // door with a raised shaker frame
      const y0 = FY + 0.1, y1 = ctop - 0.25;
      fronts.push(boxMM(x0, y0, zf, x1, y1, zf + 0.018));
      const r = 0.05;
      frames.push(boxMM(x0, y0, zf + 0.018, x1, y0 + r, zf + 0.03), boxMM(x0, y1 - r, zf + 0.018, x1, y1, zf + 0.03));
      frames.push(boxMM(x0, y0 + r, zf + 0.018, x0 + r, y1 - r, zf + 0.03), boxMM(x1 - r, y0 + r, zf + 0.018, x1, y1 - r, zf + 0.03));
      const kx = (x0 + x1) / 2;
      knobs.push(placed(new THREE.SphereGeometry(0.014, 14, 10), kx, ctop - 0.143, zf + 0.04));
      knobs.push(placed(new THREE.SphereGeometry(0.014, 14, 10), i % 2 ? x0 + 0.06 : x1 - 0.06, y1 - 0.1, zf + 0.045));
    }
    add(meshOf(body, M.sageDark));
    add(meshOf([...fronts, ...frames], M.sage));
    add(meshOf(knobs, M.brass));
    add(meshOf(boxMM(C.x0 + 0.03, FY, C.z0, C.x1 - 0.03, FY + 0.09, C.z1 - 0.07), M.iron)); // toe kick
    add(meshOf(boxMM(C.x0 - 0.02, ctop - 0.04, C.z0, C.x1 + 0.02, ctop, C.z1 + 0.03), M.oak));
    add(meshOf(boxMM(C.x0, ctop, C.z0, C.x1, ctop + 0.46, C.z0 + 0.012), M.subway, false));
  }
  // upper cabinet above the fridge
  {
    const F = FRIDGE, y0 = FY + F.h + 0.12, y1 = y0 + 0.56, z1 = F.z0 + 0.36;
    add(meshOf(boxMM(F.x0, y0, F.z0, F.x1, y1, z1 - 0.02), M.sageDark));
    const mid = (F.x0 + F.x1) / 2;
    add(meshOf([boxMM(F.x0 + 0.005, y0 + 0.005, z1 - 0.02, mid - 0.004, y1 - 0.005, z1), boxMM(mid + 0.004, y0 + 0.005, z1 - 0.02, F.x1 - 0.005, y1 - 0.005, z1)], M.sage));
    add(meshOf([placed(new THREE.SphereGeometry(0.013, 12, 8), mid - 0.05, y0 + 0.07, z1 + 0.012), placed(new THREE.SphereGeometry(0.013, 12, 8), mid + 0.05, y0 + 0.07, z1 + 0.012)], M.brass));
  }

  // --- the open top shelf ------------------------------------------------------
  const S = SHELF;
  add(meshOf(boxMM(S.x0, S.y, S.z0, S.x1, S.y + 0.03, S.z1), M.oak));
  for (const bx of [S.x0 + 0.14, S.x1 - 0.14]) {
    add(meshOf([boxMM(bx - 0.012, S.y - 0.2, S.z0, bx + 0.012, S.y, S.z0 + 0.025), boxMM(bx - 0.012, S.y - 0.025, S.z0, bx + 0.012, S.y, S.z1 - 0.03), placed(new THREE.BoxGeometry(0.02, 0.24, 0.02), bx, S.y - 0.09, S.z0 + 0.11, 0.82, 0, 0)], M.iron));
  }
  // a small herb pot and a stack of plates keep the shelf cozy once the snacks are gone
  const shelfTop = S.y + 0.03;
  add(meshOf(new THREE.LatheGeometry([[0, 0], [0.045, 0], [0.055, 0.09], [0.06, 0.1], [0.0, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 24).translate(S.x0 + 0.1, shelfTop, S.z0 + 0.14), std('#c2673f', 0.8)));
  add(meshOf([0, 1, 2].map((i) => placed(new THREE.SphereGeometry(0.04, 12, 10), S.x0 + 0.1 + (i - 1) * 0.03, shelfTop + 0.13 + 0.02 * (i % 2), S.z0 + 0.14 + 0.01 * i, 0, 0, 0, 1, 1.3, 1)), std('#4f8a3c', 0.7)));
  add(meshOf([0, 1, 2, 3].map((i) => placed(new THREE.CylinderGeometry(0.1, 0.085, 0.012, 32), S.x1 - 0.14, shelfTop + 0.006 + i * 0.013, S.z0 + 0.14)), std('#e8e4da', 0.3, 0, { envMap })));

  // snacks on the shelf
  const bagA = makeChipsBag(ctx, 0), bagB = makeChipsBag(ctx, 1), jar = makeCookieJar(ctx);
  const SA = V(3.12, shelfTop, S.z0 + 0.15), SBp = V(2.84, shelfTop, S.z0 + 0.15), SJ = V(3.66, shelfTop, S.z0 + 0.15);
  bagA.position.copy(SA);
  bagB.position.copy(SBp);
  bagB.rotation.y = 0.12;
  bagB.userData.ry0 = 0.12;
  jar.position.copy(SJ);
  add(bagA);
  add(bagB);
  add(jar);
  // soft halos behind the snacks for the "top shelf" beat
  const haloTex = canvasTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,240,190,1)');
    grd.addColorStop(0.4, 'rgba(255,214,130,0.45)');
    grd.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
  });
  const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: new THREE.Color(1.6, 1.4, 1.0), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const halos = [SA, SBp, SJ].map((p, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), haloMat);
    m.position.set(p.x, p.y + (i === 2 ? 0.09 : 0.11), S.z0 + 0.015);
    scene.add(m);
    return m;
  });

  // --- counter dressing: kettle, fruit bowl, herb pot, dish towel --------------
  {
    const kx = 2.52, kz = C.z0 + 0.27;
    const kettle = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.085, 0.03], [0.088, 0.08], [0.07, 0.13], [0.035, 0.15], [0.0, 0.15]].map(([r, y]) => new THREE.Vector2(r, y)), 32).translate(kx, ctop, kz);
    const spout = new THREE.CylinderGeometry(0.012, 0.02, 0.1, 10).rotateZ(-0.9).translate(kx + 0.1, ctop + 0.1, kz);
    add(meshOf([kettle, spout], std('#c8442f', 0.3, 0.1, { envMap, envMapIntensity: 1.2 })));
    add(meshOf([new THREE.TorusGeometry(0.06, 0.009, 8, 20, Math.PI).translate(kx, ctop + 0.15, kz), placed(new THREE.SphereGeometry(0.014, 10, 8), kx, ctop + 0.158, kz)], M.iron));
    const bx = 3.0, bz = C.z0 + 0.28;
    add(meshOf(new THREE.LatheGeometry([[0, 0.005], [0.05, 0.0], [0.11, 0.05], [0.12, 0.065], [0.112, 0.065], [0.1, 0.05], [0.0, 0.012]].map(([r, y]) => new THREE.Vector2(r, y)), 32).translate(bx, ctop, bz), std('#3b6fa8', 0.35, 0, { envMap })));
    const fruit = [[0.04, 0.05, 0.0, '#f08a24'], [-0.045, 0.048, 0.02, '#f08a24'], [0.0, 0.055, -0.04, '#d6382e'], [0.005, 0.09, 0.0, '#e9a22b']];
    for (const [fx, fy, fz, c] of fruit) add(meshOf(new THREE.SphereGeometry(0.036, 18, 14).translate(bx + fx, ctop + fy, bz + fz), std(c, 0.45)));
    const px = 4.22, pz = C.z0 + 0.24;
    add(meshOf(new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.065, 0.11], [0.07, 0.12], [0.0, 0.12]].map(([r, y]) => new THREE.Vector2(r, y)), 24).translate(px, ctop, pz), std('#c2673f', 0.8)));
    const leaves = [];
    for (let i = 0; i < 8; i++) {
      const a = i * 0.8;
      leaves.push(placed(new THREE.SphereGeometry(0.035, 10, 8), px + Math.cos(a) * 0.04, ctop + 0.17 + 0.03 * (i % 3), pz + Math.sin(a) * 0.03, 0.3 * Math.sin(a), a, 0.5 * Math.cos(a), 0.6, 1.6, 0.35));
    }
    add(meshOf(leaves, std('#4f8a3c', 0.6)));
    // dish towel over a bar on the cabinet front
    const tx = C.x0 + (C.x1 - C.x0) * 0.625, tz = C.z1 + 0.035;
    add(meshOf(new THREE.CylinderGeometry(0.007, 0.007, 0.3, 10).rotateZ(Math.PI / 2).translate(tx, ctop - 0.29, tz), M.chrome));
    const towel = new THREE.PlaneGeometry(0.22, 0.3, 6, 8);
    const tp = towel.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setZ(i, 0.012 * Math.sin(tp.getX(i) * 30) * (0.5 - tp.getY(i) / 0.3));
    towel.computeVertexNormals();
    const towelMat = new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, drawPlaid, [2, 2]), roughness: 0.95, side: THREE.DoubleSide });
    add(meshOf(towel.translate(tx, ctop - 0.44, tz + 0.012), towelMat));
  }

  // --- the fridge ----------------------------------------------------------------
  const F = FRIDGE, fTop = FY + F.h;
  const door = new THREE.Group();
  const linerMat = M.liner;
  let fridgeLight;
  {
    const wall = 0.04;
    add(meshOf([
      boxMM(F.x0, FY + 0.08, F.z0, F.x1, fTop, F.z0 + wall), // back
      boxMM(F.x0, FY + 0.08, F.z0, F.x0 + wall, fTop, F.z1), // left side
      boxMM(F.x1 - wall, FY + 0.08, F.z0, F.x1, fTop, F.z1), // right side
      boxMM(F.x0, fTop - wall, F.z0, F.x1, fTop, F.z1), // top
      boxMM(F.x0, FY + 0.08, F.z0, F.x1, FY + 0.12, F.z1), // floor of the cabinet
    ], M.enamel));
    add(meshOf(boxMM(F.x0 + 0.02, FY, F.z0 + 0.04, F.x1 - 0.02, FY + 0.08, F.z1 - 0.03), M.iron)); // feet / kick plate
    // the liner glows when the light is on
    const ix0 = F.x0 + wall, ix1 = F.x1 - wall, iy0 = FY + 0.12, iy1 = fTop - wall, iz0 = F.z0 + wall;
    add(meshOf([
      boxMM(ix0, iy0, iz0, ix1, iy1, iz0 + 0.005),
      boxMM(ix0, iy0, iz0, ix0 + 0.005, iy1, F.z1 - 0.01),
      boxMM(ix1 - 0.005, iy0, iz0, ix1, iy1, F.z1 - 0.01),
      boxMM(ix0, iy1 - 0.005, iz0, ix1, iy1, F.z1 - 0.01),
    ], linerMat, false));
    // glass shelves and a crisper drawer
    for (const sy of [0.72, 1.12, 1.52]) add(meshOf(boxMM(ix0, FY + sy, iz0, ix1, FY + sy + 0.008, F.z1 - 0.08), M.shelfGlass, false));
    add(meshOf(boxMM(ix0 + 0.02, iy0, iz0 + 0.02, ix1 - 0.02, FY + 0.4, F.z1 - 0.1), new THREE.MeshStandardMaterial({ color: col('#dfeee9'), roughness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }), false));
    // food: milk, bottles, a cake, jars, apples, eggs
    const shelf1 = FY + 0.728, shelf2 = FY + 1.128, shelf3 = FY + 1.528;
    add(meshOf([boxMM(4.56, shelf1, F.z0 + 0.18, 4.66, shelf1 + 0.22, F.z0 + 0.28), placed(new THREE.CylinderGeometry(0.001, 0.07, 0.05, 4, 1), 4.61, shelf1 + 0.245, F.z0 + 0.23, 0, Math.PI / 4, 0)], std('#f6f4ef', 0.5)));
    for (const [bx, c] of [[4.78, '#3f8f4a'], [4.86, '#c47b28']]) {
      add(meshOf(new THREE.LatheGeometry([[0, 0], [0.032, 0], [0.032, 0.17], [0.012, 0.22], [0.011, 0.26], [0, 0.26]].map(([r, y]) => new THREE.Vector2(r, y)), 20).translate(bx, shelf1, F.z0 + 0.2), std(c, 0.15, 0.0, { envMap })));
    }
    add(meshOf(new THREE.CylinderGeometry(0.11, 0.11, 0.09, 32).translate(4.95, shelf2 + 0.045, F.z0 + 0.25), std('#f3d9e4', 0.6)));
    add(meshOf(new THREE.CylinderGeometry(0.112, 0.112, 0.02, 32).translate(4.95, shelf2 + 0.1, F.z0 + 0.25), std('#d94e6f', 0.4)));
    add(meshOf(new THREE.SphereGeometry(0.025, 12, 10).translate(4.95, shelf2 + 0.13, F.z0 + 0.25), std('#c8102e', 0.3)));
    for (const [jx, c] of [[4.58, '#c33b2f'], [4.68, '#e2b13c']]) add(meshOf(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 16).translate(jx, shelf2 + 0.05, F.z0 + 0.22), std(c, 0.3)));
    for (let i = 0; i < 5; i++) add(meshOf(new THREE.SphereGeometry(0.038, 14, 10).translate(4.62 + i * 0.12, FY + 0.18, F.z0 + 0.3 + 0.03 * (i % 2)), std(i % 2 ? '#7ab845' : '#d6382e', 0.45)));
    add(meshOf(boxMM(4.6, shelf3, F.z0 + 0.15, 4.9, shelf3 + 0.06, F.z0 + 0.3), std('#d8c2a2', 0.9)));
    for (let i = 0; i < 6; i++) add(meshOf(new THREE.SphereGeometry(0.022, 10, 8).translate(4.63 + (i % 3) * 0.06, shelf3 + 0.075, F.z0 + 0.18 + Math.floor(i / 3) * 0.06), std('#f2ead8', 0.6)));

    // the door: pivots on its right edge at the front; bins on its inside
    door.position.set(F.x1, FY + 0.01, F.z1);
    const dw = F.x1 - F.x0, dh = F.h - 0.01;
    door.add(meshOf(new RoundedBoxGeometry(dw, dh, 0.065, 3, 0.025).translate(-dw / 2, dh / 2, 0.0325), M.enamel));
    door.add(meshOf(new RoundedBoxGeometry(0.035, 0.6, 0.035, 2, 0.012).translate(-dw + 0.07, 1.05, 0.09), M.chrome));
    door.add(meshOf([0.5, 0.95, 1.4].map((y) => boxMM(-dw + 0.06, y, -0.07, -0.06, y + 0.07, -0.005)), linerMat, false));
    for (let i = 0; i < 3; i++) door.add(meshOf(new THREE.CylinderGeometry(0.026, 0.026, 0.2, 14).translate(-dw + 0.18 + i * 0.12, 0.62, -0.04), std(['#e6c34a', '#e44f3a', '#5aa0d8'][i], 0.25, 0, { envMap })));
    add(door);
    // warm-white light inside that clicks on; it only exists from then on (no shadow cost before)
    fridgeLight = new THREE.SpotLight(new THREE.Color(1.0, 0.93, 0.8), 0, 7, 1.05, 0.65, 2.0);
    fridgeLight.position.set((F.x0 + F.x1) / 2, fTop - 0.18, F.z1 - 0.12);
    fridgeLight.target.position.set(WD.MOM_POS.x - 0.1, 0.35, WD.MOM_POS.z + 0.35);
    fridgeLight.castShadow = true;
    fridgeLight.shadow.mapSize.set(1024, 1024);
    fridgeLight.shadow.bias = -0.0006;
    fridgeLight.shadow.normalBias = 0.02;
    fridgeLight.shadow.camera.near = 0.08;
    fridgeLight.visible = false;
    scene.add(fridgeLight, fridgeLight.target);
  }

  // --- twelve glowing footprints from the back door to the tile ----------------
  const footGeo = (() => {
    const parts = [];
    const sole = new THREE.Shape();
    sole.absellipse(0.012, 0, 0.068, 0.033, 0, Math.PI * 2, false, 0);
    parts.push(new THREE.ShapeGeometry(sole, 24));
    const heel = new THREE.Shape();
    heel.absellipse(-0.05, 0.0, 0.038, 0.027, 0, Math.PI * 2, false, 0);
    parts.push(new THREE.ShapeGeometry(heel, 16));
    for (const [tx, ty, r] of [[0.098, 0.017, 0.016], [0.102, -0.008, 0.013], [0.096, -0.027, 0.011], [0.085, -0.042, 0.009], [0.071, -0.052, 0.008]]) {
      const s = new THREE.Shape();
      s.absarc(tx, ty, r, 0, Math.PI * 2, false);
      parts.push(new THREE.ShapeGeometry(s, 10));
    }
    return mergeAll(parts);
  })();
  const feet = [];
  for (let i = 0; i < 12; i++) {
    const u = i / 11;
    const x = lerp(1.02, 3.32, u), z = lerp(-1.52, -1.05, u) + (i % 2 ? 0.06 : -0.06);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.6, 2.3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const m = new THREE.Mesh(footGeo, mat);
    m.renderOrder = 8;
    const grp = new THREE.Group();
    grp.position.set(x, FY + 0.012, z);
    // tipped up towards the camera, so they read from the low camera of scene 4
    m.rotation.set(-Math.PI / 2 + 1.15, 0, 0);
    m.scale.set(1, i % 2 ? -1 : 1, 1);
    grp.add(m);
    grp.rotation.y = -0.19; // walking a little towards the cut face
    scene.add(grp);
    feet.push({ grp, m, t: T.steps0 + i * T.stepGap });
  }

  // --- the pulley: bracket, arm, wheel, rope, basket -----------------------------
  const P = PULLEY, yArm = 2.7;
  const pulley = [];
  const part = (obj, anchor) => {
    const g = new THREE.Group();
    g.position.copy(anchor);
    obj.position.sub(anchor);
    g.add(obj);
    add(g);
    pulley.push(g);
    return g;
  };
  // 0 bracket post with a brace, 1 the arm out over the trapdoor
  part(meshOf([boxMM(P.x - 0.018, shelfTop, S.z0 + 0.06, P.x + 0.018, yArm + 0.018, S.z0 + 0.095), placed(new THREE.BoxGeometry(0.03, 0.3, 0.03), P.x, yArm - 0.1, S.z0 + 0.2, -0.75, 0, 0)], M.oakY), V(P.x, shelfTop, S.z0 + 0.08));
  part(meshOf(boxMM(P.x - 0.018, yArm - 0.018, S.z0 + 0.06, P.x + 0.018, yArm + 0.018, P.z + 0.06), M.oakZ), V(P.x, yArm, S.z0 + 0.08));
  // 2 the wheel (axis along z, so its face shows), in a fork hanging from the arm
  const wheel = new THREE.Group();
  {
    const prof = [[0.012, -0.016], [0.092, -0.016], [0.092, -0.008], [0.078, -0.002], [0.078, 0.002], [0.092, 0.008], [0.092, 0.016], [0.012, 0.016]].map(([r, z]) => new THREE.Vector2(r, z));
    const rim = new THREE.Group();
    rim.add(meshOf(new THREE.LatheGeometry(prof, 36).rotateX(Math.PI / 2), M.pine));
    rim.add(meshOf([0, 1, 2].map((k) => placed(new THREE.BoxGeometry(0.15, 0.012, 0.03), 0, 0, 0, 0, 0, (k * Math.PI) / 3)), M.oak));
    wheel.add(rim);
    wheel.userData.rim = rim;
    wheel.add(meshOf([box(0.03, 0.15, 0.006, 0, 0.06, 0.027), box(0.03, 0.15, 0.006, 0, 0.06, -0.027), placed(new THREE.CylinderGeometry(0.008, 0.008, 0.07, 10), 0, 0, 0, Math.PI / 2, 0, 0)], M.iron));
    const g = new THREE.Group();
    g.position.set(P.x, yArm, P.z);
    wheel.position.set(0, P.y - yArm, 0);
    g.add(wheel);
    add(g);
    pulley.push(g);
  }
  // 3 rope: two strands from the wheel (the basket on the left, the kid's end on the right)
  const ropeMat = patch(std('#d8c39a', 0.9), {
    key: 'kitRope', extraFrag: 'vec3 ropeCol(vec3 p, vec3 n){ return vec3(0.85 + 0.25 * step(0.5, fract(p.y * 55.0 + atan(n.z, n.x) * 0.32))); }', colorFn: 'ropeCol',
  });
  const strand = () => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 8, 1, true), ropeMat);
    m.castShadow = true;
    m.userData.cast = true;
    return m;
  };
  const ropeGrp = new THREE.Group();
  const ropeL = strand(), ropeR = strand();
  const wrap = new THREE.Mesh(new THREE.TorusGeometry(WR - 0.006, 0.0085, 6, 24, Math.PI), ropeMat);
  wrap.position.set(P.x, P.y, P.z);
  ropeGrp.add(ropeL, ropeR, wrap);
  add(ropeGrp);
  // 4 the basket: wicker bowl, rim, two bridle cords up to a ring
  const basket = new THREE.Group();
  {
    const wick = canvasTex(128, 128, drawWicker, [6, 2]);
    const wmat = new THREE.MeshStandardMaterial({ map: wick, bumpMap: wick, bumpScale: 2.5, roughness: 0.85, side: THREE.DoubleSide });
    const bowl = new THREE.LatheGeometry([[0.0, 0.0], [0.08, 0.0], [0.1, 0.03], [0.108, 0.08], [0.11, 0.115]].map(([r, y]) => new THREE.Vector2(r, y)), 28);
    basket.add(meshOf(bowl, wmat));
    basket.add(meshOf(new THREE.TorusGeometry(0.11, 0.009, 8, 32).rotateX(Math.PI / 2).translate(0, 0.115, 0), std('#8b5d33', 0.8)));
    const ringY = 0.5;
    const cords = [-1, 1].map((s) => {
      const a = V(s * 0.108, 0.115, 0), b = V(0, ringY, 0);
      const d = b.clone().sub(a);
      const c = new THREE.CylinderGeometry(0.005, 0.005, d.length(), 6, 1, true);
      c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
      c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      return c;
    });
    basket.add(meshOf(cords, ropeMat));
    basket.add(meshOf(new THREE.TorusGeometry(0.016, 0.004, 6, 16).translate(0, ringY + 0.012, 0), M.iron));
    basket.userData.ringY = ringY + 0.024;
    add(basket);
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  const _up = V(0, 1, 0), _d = new THREE.Vector3(), _a = new THREE.Vector3(), _zAxis = V(0, 0, 1);
  const topL = V(P.x - WR, P.y, P.z), topR = V(P.x + WR, P.y, P.z), endR = V(P.x + WR, -1.62, P.z), _e = new THREE.Vector3();
  const placeStrand = (m, a, b) => {
    _d.subVectors(b, a);
    const l = _d.length();
    m.visible = l > 0.005;
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.scale.set(1, Math.max(l, 1e-4), 1);
    m.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / Math.max(l, 1e-6)));
  };
  const _to = new THREE.Vector3();
  // a snack waits on the shelf, hops into the basket on t0, rides it, and is hidden at keepUntil
  function snack(obj, from, t0, off, t, keepUntil) {
    const ry0 = obj.userData.ry0 ?? 0;
    if (t < t0) {
      obj.visible = true;
      obj.position.copy(from);
      obj.rotation.set(0, ry0, 0);
      obj.scale.setScalar(1);
      return;
    }
    obj.visible = t < keepUntil;
    if (!obj.visible) return;
    const b = basketAt(t), dur = 0.42;
    _to.set(b.x + off.x, b.y + 0.012, b.z + off.z);
    const u = prog(t, t0, dur);
    if (u < 1) {
      obj.position.set(lerp(from.x, _to.x, u), lerp(from.y, _to.y, u) + 0.32 * Math.sin(Math.PI * u), lerp(from.z, _to.z, u));
      obj.rotation.set(0.3 * Math.sin(Math.PI * u), ry0 + 0.6 * u, 0);
      const sq = u < 0.15 ? 1 - 0.18 * Math.sin((u / 0.15) * Math.PI) : 1 + 0.1 * Math.sin(((u - 0.15) / 0.85) * Math.PI);
      obj.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    } else {
      obj.position.copy(_to);
      obj.rotation.set(0, ry0 + 0.6, 0);
      const land = wobble(t, t0 + dur, 3.2, 8);
      obj.scale.set(1 + 0.12 * land, 1 - 0.18 * land, 1 + 0.12 * land);
    }
  }

  function update(t) {
    // --- trapdoor, cut line, hinges
    const cutP = prog(t, T.cut0, T.cut1 - T.cut0);
    cutU.value = smooth(prog(t, T.cut1, 0.4));
    trap.rotation.x = -trapAngle(t);
    const glowFade = t < T.cut1 ? 1 : 1 - smooth(prog(t, T.cut1, 0.45));
    const traced = 4 * cutP;
    cutSegs.forEach((m, k) => {
      const f = clamp(traced - k);
      m.visible = t >= T.cut0 && f > 0 && glowFade > 0.01;
      if (!m.visible) return;
      const [x0, z0, x1, z1] = EDGE[k];
      const len = Math.hypot(x1 - x0, z1 - z0) * f;
      m.position.set(x0 + (x1 - x0) * f * 0.5, FY + 0.0025, z0 + (z1 - z0) * f * 0.5);
      m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
      m.scale.set(Math.max(len, 1e-3), 1, 1);
    });
    cutMat.opacity = glowFade * (0.85 + 0.15 * Math.sin(t * 60));
    const tracing = t >= T.cut0 && t < T.cut1;
    head.visible = tracing;
    if (tracing) {
      const [hx, hz] = perimeter(traced);
      head.position.set(hx, FY + 0.01, hz);
      head.scale.setScalar(0.8 + 0.4 * Math.abs(Math.sin(t * 47)));
    }
    // sparks: spawned along the trace, ballistic, short-lived (deterministic per index)
    ctx.beginInst(sparks);
    for (let k = 0; k < 60; k++) {
      const ts = T.cut0 + k * 0.016;
      if (ts > T.cut1) break;
      const age = t - ts;
      if (age < 0 || age > 0.32) continue;
      const [sx, sz] = perimeter(4 * prog(ts, T.cut0, T.cut1 - T.cut0));
      const h1 = U.hash1(k * 3.1), h2 = U.hash1(k * 7.7 + 1), h3 = U.hash1(k * 1.9 + 2);
      const vx = (h1 - 0.5) * 1.6, vz = (h2 - 0.3) * 1.2, vy = 0.9 + 1.2 * h3;
      const y = FY + 0.01 + vy * age - 4.9 * age * age;
      if (y < FY) continue;
      ctx.setInst(sparks, sx + vx * age, y, sz + vz * age, 0.0055 * (1 - age / 0.32));
    }
    ctx.endInst(sparks);
    hinges.forEach((h, i) => {
      const k = popIn(t, i ? T.hinge2 : T.hinge1, 0.32, 2.6);
      const s = Math.max(k, 0.0001);
      h.fixed.visible = h.moving.visible = k > 0.001;
      h.fixed.scale.setScalar(s);
      h.fixed.position.y = PIV.y + 0.05 * (1 - Math.min(1, k));
      h.moving.scale.setScalar(s);
    });

    // --- shelf snacks: glow on "top shelf", one bag and the jar hop into the basket
    const glowK = bump(t, T.shelfGlow - 0.1, T.shelfGlow + 1.7, 0.35);
    haloMat.opacity = 0.75 * glowK * (0.85 + 0.15 * Math.sin(t * 6));
    for (const h of halos) h.visible = glowK > 0.001;
    for (const m of [bagMats(0), bagMats(1)]) m.emissive.setRGB(0.35 * glowK, 0.25 * glowK, 0.12 * glowK);
    snack(bagA, SA, T.hopChips, V(0, 0, -0.055), t, T.lower1 + 0.15);
    snack(jar, SJ, T.hopJar, V(0, 0, 0.045), t, T.lower1 + 0.15);
    const out = 1 - easeInQuad(prog(t, T.momIn, 0.14));
    bagB.visible = out > 0.01;
    bagB.scale.setScalar(Math.max(0.001, out));

    // --- pulley parts snap together, basket, rope, wheel
    pulley.forEach((g, k) => {
      const s = popIn(t, T.pulley0 + k * T.pulleyGap, 0.34, 2.4);
      g.visible = s > 0.001;
      g.scale.setScalar(Math.max(s, 0.0001));
    });
    const b = basketAt(t);
    basket.visible = b.vis > 0.001;
    basket.position.set(b.x, b.y, b.z);
    const travel = bump(t, T.lower0, T.lower1 + 0.3, 0.3) + bump(t, T.basketUp0, T.basketUp1 + 0.3, 0.3) + bump(t, T.basket2_0, T.basket2_1, 0.3);
    basket.rotation.set(0.06 * travel * Math.sin(t * 4.1), 0, b.tilt);
    basket.scale.setScalar(Math.max(b.vis, 0.0001));
    const ropeK = popIn(t, T.pulley0 + 3 * T.pulleyGap, 0.34, 1.8);
    ropeGrp.visible = ropeK > 0.001;
    wheel.userData.rim.rotation.z = wheelAngle(t);
    if (ropeGrp.visible) {
      // the basket's ring (after its tilt) up to the wheel's left side; the kid's end hangs down the shaft
      if (basket.visible) _a.set(0, basket.userData.ringY * b.vis, 0).applyAxisAngle(_zAxis, b.tilt).add(basket.position);
      else _a.set(BX, P.y - 0.4, BZ);
      const k = Math.min(1, ropeK);
      placeStrand(ropeL, topL, _e.copy(topL).lerp(_a, k));
      placeStrand(ropeR, topR, _e.copy(topR).lerp(endR, k));
      wrap.scale.setScalar(Math.max(ropeK, 0.0001));
    }

    // --- fridge door and light
    const dU = prog(t, T.fridgeOpen, 0.42);
    door.rotation.y = 1.85 * Math.min(1.05, easeOutBack(dU, 1.4)) - 0.04 * wobble(t, T.fridgeOpen + 0.42, 2.5, 6);
    const on = t >= T.fridgeOn ? 1 : 0;
    fridgeLight.visible = on > 0;
    fridgeLight.intensity = 26 * on;
    linerMat.emissiveIntensity = 1.6 * on;

    // --- footprints pop one by one, then fade out together
    const fadeT = T.steps0 + 12 * T.stepGap + 1.9;
    for (const [i, f] of feet.entries()) {
      const k = popIn(t, f.t, 0.3, 2.6);
      const fade = 1 - smooth(prog(t, fadeT + i * 0.05, 0.6));
      f.grp.visible = k > 0.001 && fade > 0.001;
      f.grp.scale.setScalar(Math.max(k, 0.0001));
      f.m.material.opacity = Math.min(1, k) * fade * (0.9 + 0.1 * Math.sin(t * 5 + i));
    }
  }
  update(0);
  return { update };
}
