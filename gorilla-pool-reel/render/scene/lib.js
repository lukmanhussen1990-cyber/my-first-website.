// Shared helpers: deterministic RNG, easing, keyframes, GLSL noise and
// material patching for procedural PBR surfaces.
import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (k) => k * k * (3 - 2 * k);
export const smoother = (k) => k * k * k * (k * (k * 6 - 15) + 10);
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeOutBack = (k, s = 1.9) => {
  if (k <= 0) return 0; if (k >= 1) return 1;
  const c3 = s + 1; return 1 + c3 * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
};
export const easeOutElastic = (k) => {
  if (k <= 0) return 0; if (k >= 1) return 1;
  return Math.pow(2, -9 * k) * Math.sin((k * 10 - 0.75) * (2 * Math.PI / 3.2)) + 1;
};
// 0 -> overshoot -> settle: scale for "pop in" with a small bounce
export const pop = (t, t0, dur = 0.35) => easeOutBack(seg(t, t0, t0 + dur), 2.2);
// smooth pulse: rises over [a,a+r], holds, falls over [b-r,b]
export const pulse = (t, a, b, r = 0.15) => smooth(seg(t, a, a + r)) * (1 - smooth(seg(t, b - r, b)));
// damped bump after an event (for squash / shake)
export const bump = (t, t0, dur = 0.4, freq = 2.5) => {
  if (t < t0 || t > t0 + dur) return 0;
  const k = (t - t0) / dur;
  return Math.sin(k * Math.PI * freq) * Math.pow(1 - k, 2);
};

// keyframes: [[t, value], ...] with per-segment easing (default easeInOut).
// value may be number or array.
export function keys(t, kf, ease = easeInOut) {
  if (t <= kf[0][0]) return kf[0][1];
  for (let i = 0; i < kf.length - 1; i++) {
    const [t0, v0] = kf[i], [t1, v1, e] = kf[i + 1];
    if (t <= t1) {
      const k = (e || ease)(seg(t, t0, t1));
      if (Array.isArray(v0)) return v0.map((v, j) => lerp(v, v1[j], k));
      return lerp(v0, v1, k);
    }
  }
  return kf[kf.length - 1][1];
}

export function smoothNoise1(x, seed = 0) {
  // cheap deterministic 1D value noise
  const h = (n) => { const s = Math.sin((n + seed * 17.13) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

export const GLSL_NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz+33.33); return fract((p3.xxy + p3.yxx)*p3.zyx); }
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); vec3 u = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), u.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), u.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), u.x), u.y), u.z);
}
float vnoise2(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y);
}
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm2(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a*vnoise2(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
// 2D voronoi: x = F1 distance, y = cell id, zw = vector to nearest feature point
vec4 voronoi2(vec2 p){
  vec2 i = floor(p), f = fract(p); float md = 8.0; float id = 0.0; vec2 mr = vec2(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y)); vec2 o = hash22(i + g); vec2 r = g + o - f; float d = dot(r, r);
    if (d < md){ md = d; id = hash12(i + g + 0.37); mr = r; }
  }
  return vec4(sqrt(md), id, mr);
}
// tileable-ish water caustics (after joltz0r / Dave Hoskins)
float causticPattern(vec2 uv, float time){
  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;
  vec2 i = p; float c = 1.0; float inten = 0.005;
  for (int n = 0; n < 4; n++){
    float t = time * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + t) / inten), p.y / (cos(i.y + t) / inten)));
  }
  c /= 4.0; c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 3.0);
}
`;
export const GLSL_FRAG = /* glsl */ `
vec3 perturbNormalH(vec3 surf_pos, vec3 surf_norm, float h, float faceDir){
  vec3 vSigmaX = dFdx(surf_pos); vec3 vSigmaY = dFdy(surf_pos);
  vec3 R1 = cross(vSigmaY, surf_norm); vec3 R2 = cross(surf_norm, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec2 dHdxy = vec2(dFdx(h), dFdy(h));
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;

let patchId = 0;
// Patch a built-in PBR material with procedural code.
// opts: uniforms, vHead, vMain (after begin_vertex, may modify `transformed`),
// fHead, fColor (after color_fragment: set diffuseColor, may declare vars),
// fRough (after roughnessmap_fragment), fNormal (after normal_fragment_maps),
// fEmissive (after emissivemap_fragment), fEnd (before output)
export function patch(mat, o) {
  const id = 'p' + (patchId++);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, o.uniforms || {});
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vOPos; varying vec3 vONrm;
${GLSL_NOISE}
${o.vHead || ''}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
${o.vPre || ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vOPos = position; vONrm = normal;
${o.vMain || ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
{ vec4 wp = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
#endif
  wp = modelMatrix * wp; vWPos = wp.xyz;
  vec3 wn = objectNormal;
#ifdef USE_INSTANCING
  wn = mat3(instanceMatrix) * wn;
#endif
  vWNrm = normalize(mat3(modelMatrix) * wn); }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNrm; varying vec3 vOPos; varying vec3 vONrm;
${GLSL_NOISE}
${GLSL_FRAG}
${o.fHead || ''}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
${o.fColor || ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
${o.fRough || ''}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
${o.fNormal || ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
${o.fEmissive || ''}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
${o.fEnd || ''}`);
    if (o.onShader) o.onShader(sh);
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

// ---------- geometry helpers ----------
// Capsule-like lathe along -Y from the pivot: radius r1 at the pivot end, r2 at the far end.
export function limbGeo(r1, r2, len, radial = 28, rings = 10) {
  const pts = [];
  for (let i = 0; i <= rings; i++) { // top cap (pivot end) at y=0, bulging upward
    const a = Math.PI / 2 - (i / rings) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r1 + 1e-4, Math.sin(a) * r1));
  }
  const mid = 8;
  for (let i = 1; i < mid; i++) {
    const k = i / mid; const kk = k; // straight taper
    pts.push(new THREE.Vector2(lerp(r1, r2, kk), -len * k));
  }
  for (let i = 0; i <= rings; i++) {
    const a = -(i / rings) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r2 + 1e-4, -len + Math.sin(a) * r2));
  }
  pts.reverse();
  const g = new THREE.LatheGeometry(pts, radial);
  g.computeVertexNormals();
  return g;
}

export function sphereGeo(seg = 40) { return new THREE.SphereGeometry(1, seg, Math.max(12, Math.round(seg * 0.66))); }

export function mesh(geo, mat, opts = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (opts.pos) m.position.set(...opts.pos);
  if (opts.scale) (typeof opts.scale === 'number' ? m.scale.setScalar(opts.scale) : m.scale.set(...opts.scale));
  if (opts.rot) m.rotation.set(...opts.rot);
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  return m;
}

export function group(parent, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const g = new THREE.Group(); g.position.set(...pos); g.rotation.set(...rot);
  if (parent) parent.add(g);
  return g;
}

// rounded box via BoxGeometry vertices pushed toward a superellipsoid (soft toy edges)
export function roundedBoxGeo(w, h, d, r = 0.1, seg = 6) {
  const g = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = g.attributes.position; const v = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const c = new THREE.Vector3(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
    const n = v.clone().sub(c);
    if (n.lengthSq() > 1e-12) { n.normalize().multiplyScalar(r); v.copy(c).add(n); }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

export function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}
