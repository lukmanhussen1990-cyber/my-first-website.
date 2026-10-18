// Terrain (analytic height field), river (animated pixel water with foam), river/shore stones.
// Layout per docs/DESIGN.md: acting area |x|<4, -3<z<1.6 is exactly flat (y=0); the river runs along X with
// water edges at z ~ 1.73 / 3.57 near the action, surface y = -0.12, and meanders further away.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, rng } from '../core/util.js';
import { noise2, fbm2, hash2, flatten, boxUV, faceColors, merge } from './wutil.js';
import { grassTexture, waterTexture, stoneTexture } from './textures.js';

export const RIVER = { z: 2.65, w: 1.0, water: -0.12, bed: -0.42 };

// Far hills that are part of the height field: [x, z, radius, height, plateauFrac]
export const CASTLE_POS = new THREE.Vector3(12, 0, 75);
const HILLS = [
  [CASTLE_POS.x, CASTLE_POS.z, 30, 11, 0.32],   // castle hill (flat top)
  [-24, 52, 24, 13, 0], [38, 58, 28, 16, 0], [-52, 82, 34, 22, 0], [66, 92, 40, 25, 0], [22, 128, 46, 28, 0],
  [-14, 112, 30, 18, 0],
  [-18, -40, 22, 10, 0], [24, -48, 26, 13, 0], [-52, -34, 28, 12, 0], [4, -84, 38, 20, 0], [58, -28, 28, 10, 0],
  [-38, -70, 30, 16, 0], [40, -84, 34, 18, 0],
  [-72, 6, 28, 9, 0], [76, 4, 28, 11, 0], [-95, 45, 40, 18, 0], [98, 40, 40, 16, 0],
];

export function riverCenter(x) {
  const a = smoothstep(5, 24, Math.abs(x));
  return RIVER.z + a * (3.4 * Math.sin(x * 0.045 + 0.4) + 1.5 * Math.sin(x * 0.11 + 2.1));
}
export function riverHalfWidth(x) {
  return RIVER.w + smoothstep(6, 40, Math.abs(x)) * (0.45 + 0.25 * Math.sin(x * 0.07));
}

// Weight of terrain undulation: 0 inside the flat acting zone (+ the near far-bank strip), 1 well outside.
function undulationWeight(x, z) {
  const dx = Math.max(0, Math.abs(x) - 4.6);
  const dzb = Math.max(0, -3.4 - z);
  const dzf = Math.max(0, z - 6.5);
  return smoothstep(0, 7, Math.hypot(dx, dzb, dzf));
}

function landHeight(x, z) {
  const wU = undulationWeight(x, z);
  let h = 0;
  if (wU > 0) {
    h += wU * (0.6 * fbm2(x * 0.06, z * 0.06, 1) + 0.18 * noise2(x * 0.22, z * 0.22, 4) + 0.25);
    // meadow behind rises gently toward the far hills; far side rises toward the castle hills
    h += smoothstep(-7, -70, z) * 5.5 + smoothstep(9, 70, z) * 3.0;
    h += smoothstep(10, 90, Math.abs(x)) * 2.5;
  }
  for (const [hx, hz, r, hh, plat] of HILLS) {
    const d = Math.hypot(x - hx, z - hz) / r;
    if (d >= 1) continue;
    const k = plat > 0 ? clamp((1 - d) / (1 - plat), 0, 1) : 1 - d;
    h += hh * (plat > 0 ? Math.pow(k, 0.8) * (0.6 + 0.4 * k) : Math.pow(k, 1.15) * (1 + 0.12 * noise2(x * 0.15, z * 0.15, 9)));
  }
  // river valley: land eases down to 0 near the banks
  const dR = Math.abs(z - riverCenter(x)) - riverHalfWidth(x);
  h *= smoothstep(0.15, 5.0, dR);
  return h;
}

// Exact analytic ground height (the mesh matches it at its vertices; exactly 0 in the acting area).
export function groundHeight(x, z) {
  const zc = riverCenter(x), w = riverHalfWidth(x);
  const d = Math.abs(z - zc);
  const land = landHeight(x, z);
  if (d >= w + 0.05) return land;
  const t = smoothstep(w - 0.38, w + 0.05, d);
  return lerp(RIVER.bed, land, t);
}

// ---------- terrain mesh: tensor grid in (x, v = z - riverCenter(x)), dense at the banks ----------
function axisCoords(stepFn, min, max) {
  const out = [0];
  let v = 0;
  while (v < max) { v += stepFn(v); out.push(Math.min(v, max)); }
  v = 0;
  while (v > min) { v -= stepFn(-v); out.unshift(Math.max(v, min)); }
  return out;
}

const COL = {
  grass: new THREE.Color(0xb6d63a), grassG: new THREE.Color(0x9ccc34), grassY: new THREE.Color(0xcadb48),
  bank: new THREE.Color(0x76a82c), mud: new THREE.Color(0x6d7550), hill: new THREE.Color(0xa7b84a), hillTop: new THREE.Color(0xc4cf62),
  far: new THREE.Color(0xb8c96a),
};

export function buildTerrain() {
  const xs = axisCoords((a) => (a < 6 ? 0.5 : 0.5 * Math.pow(1.085, (a - 6) / 0.62)), -135, 135);
  const vs = axisCoords((a) => {
    if (a < 0.75) return 0.12;
    if (a < 1.2) return 0.05;
    if (a < 1.7) return 0.12;
    if (a < 7.5) return 0.25;
    return 0.25 * Math.pow(1.09, (a - 7.5) / 0.55);
  }, -140, 150);
  const nx = xs.length, nv = vs.length;
  const pos = new Float32Array(nx * nv * 3);
  const col = new Float32Array(nx * nv * 3);
  const uv = new Float32Array(nx * nv * 2);
  const c = new THREE.Color();
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nx; i++) {
      let x = xs[i], v = vs[j];
      const z0 = riverCenter(x) + v;
      // irregular facets away from the acting area / banks
      const jw = undulationWeight(x, z0) * smoothstep(1.8, 4.0, Math.abs(v));
      if (jw > 0 && i > 0 && i < nx - 1 && j > 0 && j < nv - 1) {
        const sx = (xs[i + 1] - xs[i - 1]) * 0.5, sv = (vs[j + 1] - vs[j - 1]) * 0.5;
        x += (hash2(i, j, 1) - 0.5) * 0.55 * sx * jw;
        v += (hash2(i, j, 2) - 0.5) * 0.55 * sv * jw;
      }
      const z = riverCenter(x) + v;
      const y = groundHeight(x, z);
      const k = (j * nx + i);
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      uv[k * 2] = x / 3.2; uv[k * 2 + 1] = -z / 3.2;
      // colour
      const w = riverHalfWidth(x), d = Math.abs(v);
      const n1 = fbm2(x * 0.18, z * 0.18, 21), n2 = noise2(x * 0.6, z * 0.6, 22);
      c.copy(COL.grass).lerp(n1 > 0 ? COL.grassY : COL.grassG, Math.min(1, Math.abs(n1) * 1.6));
      c.multiplyScalar(0.97 + 0.06 * n2);
      const bankT = 1 - smoothstep(w - 0.05, w + 0.35, d);
      c.lerp(COL.bank, bankT * 0.75);
      if (y < RIVER.water + 0.02) c.lerp(COL.mud, smoothstep(RIVER.water + 0.02, RIVER.water - 0.1, y));
      const hillT = smoothstep(1.5, 9, y);
      if (hillT > 0) { c.lerp(COL.hill, hillT * 0.8); c.lerp(COL.hillTop, smoothstep(8, 20, y) * 0.6); }
      const dist = Math.hypot(x, z);
      c.lerp(COL.far, smoothstep(30, 110, dist) * 0.35);
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
  }
  const idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, cc = a + nx, d = cc + 1;
    // alternate diagonals for a less regular faceting
    if ((i + j) % 2 === 0) idx.push(a, cc, b, b, cc, d); else idx.push(a, cc, d, a, d, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const tex = grassTexture();
  const material = new THREE.MeshLambertMaterial({ map: tex, vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'terrain';
  mesh.receiveShadow = true;
  return { mesh, xs, vs, triangles: idx.length / 3 };
}

// ---------- stones (in the river and on the banks) ----------
// [x, z, radius, height above water/ground, inWater]
export const STONES = [
  // in the water near the action (stepping stones)
  [-3.35, 2.35, 0.26, 0.07, 1], [-2.25, 3.15, 0.22, 0.06, 1], [-1.15, 2.05, 0.2, 0.05, 1], [0.25, 2.95, 0.27, 0.08, 1],
  [1.35, 2.25, 0.21, 0.06, 1], [2.55, 3.2, 0.25, 0.07, 1], [3.6, 2.45, 0.3, 0.09, 1], [4.95, 2.05, 0.2, 0.05, 1],
  [-4.75, 3.05, 0.24, 0.06, 1], [6.3, 3.05, 0.28, 0.07, 1], [-6.1, 2.25, 0.25, 0.08, 1], [7.6, 2.55, 0.22, 0.05, 1],
  [-0.4, 3.35, 0.14, 0.04, 1], [2.0, 1.95, 0.13, 0.04, 1], [-2.9, 1.95, 0.15, 0.04, 1], [5.6, 3.35, 0.15, 0.04, 1],
  // half-submerged at the banks
  [-2.75, 1.62, 0.2, 0.08, 2], [2.35, 1.66, 0.17, 0.07, 2], [-1.7, 3.7, 0.22, 0.08, 2], [3.15, 3.66, 0.2, 0.07, 2],
  [0.95, 3.72, 0.16, 0.06, 2], [-4.2, 1.7, 0.24, 0.09, 2], [5.4, 1.7, 0.2, 0.08, 2], [-5.4, 3.65, 0.26, 0.09, 2],
  // on the grass
  [-2.55, -0.85, 0.16, 0.1, 0], [2.6, -1.3, 0.2, 0.12, 0], [-3.7, -1.9, 0.26, 0.15, 0], [3.9, -2.5, 0.22, 0.13, 0],
  [-1.6, 1.05, 0.1, 0.06, 0], [1.9, -0.55, 0.09, 0.05, 0], [-3.1, 0.6, 0.13, 0.08, 0], [6.5, -1.2, 0.3, 0.18, 0],
  [-6.4, -0.6, 0.32, 0.2, 0], [-1.2, 4.6, 0.18, 0.1, 0], [2.4, 5.1, 0.24, 0.12, 0], [-3.6, 5.4, 0.2, 0.11, 0],
];

export function stoneGeometry(rand, r, h, sink = 0.15) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const sx = 1 + (rand() - 0.5) * 0.35, sz = 1 + (rand() - 0.5) * 0.35;
  // jitter shared vertices consistently (by rounded position)
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = key(p.getX(i), p.getY(i), p.getZ(i));
    if (!jit.has(k)) jit.set(k, 0.82 + rand() * 0.3);
    const s = jit.get(k);
    let y = p.getY(i);
    y = y > 0 ? y * h / 1.0 : y * (sink + 0.05);
    p.setXYZ(i, p.getX(i) * r * sx * s, y * (0.8 + 0.4 * s), p.getZ(i) * r * sz * s);
  }
  return g;
}

export function buildStones() {
  const rand = rng(404);
  const geos = [];
  const foam = [];
  const dark = new THREE.Color(0x3a3940), dark2 = new THREE.Color(0x2b2a31), top = new THREE.Color(0x56545e), mossC = new THREE.Color(0x5f8a2c);
  for (const [x, z, r, h, kind] of STONES) {
    const baseY = kind === 1 ? RIVER.water : kind === 2 ? RIVER.water + 0.02 : groundHeight(x, z);
    let g = stoneGeometry(rand, r, h + (kind ? 0.04 : 0), kind ? 0.3 : 0.12);
    g.rotateY(rand() * Math.PI * 2);
    g.translate(x, baseY - (kind ? 0.03 : 0.0), z);
    g = flatten(g);
    boxUV(g, 1.6);
    const seed = rand() * 100;
    faceColors(g, (ctr, n) => {
      const c = dark.clone().lerp(dark2, hash2(Math.round(ctr.x * 50), Math.round(ctr.z * 50), 3));
      c.lerp(top, Math.max(0, n.y) * 0.45);
      if (kind === 0 && n.y > 0.6 && noise2(ctr.x * 9 + seed, ctr.z * 9, 5) > 0.25) c.lerp(mossC, 0.6);
      return c;
    });
    geos.push(g);
    if (kind > 0) foam.push(new THREE.Vector4(x, z, r * 0.95, kind));
  }
  const geo = merge(geos);
  const mat = new THREE.MeshLambertMaterial({ map: stoneTexture(), vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'stones';
  mesh.castShadow = true; mesh.receiveShadow = true;
  return { mesh, foam };
}

// ---------- water ----------
const WATER_VS = /* glsl */`
attribute float aDepth;
attribute vec2 aRiver;
varying float vDepth;
varying vec2 vRiver;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vDepth = aDepth; vRiver = aRiver;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const WATER_FS = /* glsl */`
uniform sampler2D uTex;
uniform float uTime;
uniform vec3 uTint;
uniform vec3 uFoam;
uniform vec3 uSunCol;
uniform float uSpark;
uniform vec3 uSunDir;
uniform vec4 uStones[NSTONES];
varying float vDepth;
varying vec2 vRiver;
varying vec3 vWorld;
#include <fog_pars_fragment>
float h21(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
void main() {
  float flow = uTime * 0.42;
  // two scrolling pixel layers (flow along +x of the river frame)
  vec2 uv1 = vec2((vRiver.x - flow) * 0.85, vRiver.y * 0.85);
  vec2 uv2 = vec2((vRiver.x - flow * 0.62) * 0.5 + 0.37, vRiver.y * 1.15 + 0.21);
  vec3 c1 = texture2D(uTex, uv1).rgb;
  vec3 c2 = texture2D(uTex, uv2).rgb;
  vec3 col = max(c1, c2 * 0.98);
  // slightly deeper colour mid-stream
  col *= mix(1.0, 0.86, smoothstep(0.15, 0.32, vDepth));
  // pixel cells (3.2 cm) for foam noise, advected with the flow
  vec2 cell = floor(vec2((vRiver.x - flow * 0.9) * 30.0, vRiver.y * 30.0));
  float n = h21(cell);
  float cellS = h21(floor(vWorld.xz * 30.0));
  // bank foam: solid line at the edge + broken dashes just inside
  float edge = 1.0 - smoothstep(0.03, 0.065, vDepth + (n - 0.5) * 0.03);
  float dashBand = smoothstep(0.04, 0.07, vDepth) * (1.0 - smoothstep(0.1, 0.16, vDepth));
  vec2 dcell = floor(vec2((vRiver.x - flow * 1.1) * 7.0, vRiver.y * 30.0));
  float dash = step(0.78, h21(dcell)) * dashBand;
  float foam = max(edge, dash * 0.9);
  // stones: foam ring + downstream wake streaks
  for (int i = 0; i < NSTONES; i++) {
    vec4 s = uStones[i];
    if (s.z <= 0.0) continue;
    vec2 d = vWorld.xz - s.xy;
    float dist = length(d) - s.z;
    float ring = 1.0 - smoothstep(0.0, 0.05 + 0.04 * n, dist);
    float wake = 0.0;
    if (d.x > 0.0 && d.x < s.z * 5.0) {
      float lane = abs(abs(d.y) - s.z * 0.75);
      float streak = step(0.55, h21(floor(vec2((vWorld.x - flow * 1.2) * 9.0, vWorld.z * 30.0))));
      wake = (1.0 - smoothstep(0.0, 0.05, lane)) * streak * (1.0 - d.x / (s.z * 5.0));
    }
    foam = max(foam, max(ring, wake * 0.85));
  }
  col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
  // specular sparkle: random pixel cells blinking
  vec2 sc = floor(vec2((vRiver.x - flow * 0.5) * 18.0, vRiver.y * 18.0));
  float hs = h21(sc + 17.0);
  float tw = pow(max(0.0, sin(uTime * (2.5 + hs * 4.0) + hs * 60.0)), 10.0);
  float spark = step(0.965, hs) * tw * (1.0 - foam);
  col *= uTint;
  col += uSunCol * spark * uSpark;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

export function buildWater(xs, stoneFoam) {
  const vFrac = [-1, -0.97, -0.93, -0.88, -0.82, -0.72, -0.55, -0.3, 0, 0.3, 0.55, 0.72, 0.82, 0.88, 0.93, 0.97, 1];
  const xsW = xs.filter((x) => Math.abs(x) <= 132);
  const nx = xsW.length, nv = vFrac.length;
  const pos = new Float32Array(nx * nv * 3), depth = new Float32Array(nx * nv), riv = new Float32Array(nx * nv * 2);
  for (let i = 0; i < nx; i++) {
    const x = xsW[i];
    const w = riverHalfWidth(x) + 0.06, zc = riverCenter(x);
    for (let j = 0; j < nv; j++) {
      const v = vFrac[j] * w, z = zc + v;
      const k = j * nx + i;
      pos[k * 3] = x; pos[k * 3 + 1] = RIVER.water; pos[k * 3 + 2] = z;
      depth[k] = RIVER.water - groundHeight(x, z);
      riv[k * 2] = x; riv[k * 2 + 1] = v;
    }
  }
  const idx = [];
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
  geo.setAttribute('aRiver', new THREE.BufferAttribute(riv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const N = 24;
  const stones = Array.from({ length: N }, (_, i) => stoneFoam[i] ? new THREE.Vector4(stoneFoam[i].x, stoneFoam[i].y, stoneFoam[i].z, 0) : new THREE.Vector4(0, 0, -1, 0));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTex: { value: null }, uTime: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) },
    uFoam: { value: new THREE.Color(0xf4fdff) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSpark: { value: 2.5 },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uStones: { value: stones },
  }]);
  uniforms.uTex.value = waterTexture();
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VS, fragmentShader: WATER_FS, fog: true, defines: { NSTONES: N } });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'river';
  mesh.receiveShadow = false;
  return { mesh, uniforms };
}
