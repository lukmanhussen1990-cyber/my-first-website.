import * as THREE from 'three';

// sRGB hex -> linear THREE.Color
export const col = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------------------
// GLSL helpers shared by the procedural materials. Patterns are computed in
// world space so neighbouring meshes line up.
// ---------------------------------------------------------------------------
export const GLSL_COMMON = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float h31(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x), u.y); }
float vnoise3(vec3 p){ vec3 i=floor(p), f=fract(p); vec3 u=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),u.x), mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),u.x),u.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),u.x), mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),u.x),u.y), u.z); }
float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5;} return s/0.9375; }
float fbm3(vec3 p){ float s=0., a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise3(p); p=p*2.07+vec3(17.1,9.3,4.7); a*=0.5;} return s/0.875; }
// nearest feature point: xy = vector to it, z = distance, w = cell id hash
vec4 cellv(vec2 p){ vec2 i=floor(p), f=fract(p); float d=8.; vec2 rv=vec2(0.); float id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y));
    vec2 o=vec2(h21(i+g), h21(i+g+17.31))*0.85+0.075; vec2 r=g+o-f; float dd=dot(r,r);
    if(dd<d){ d=dd; rv=r; id=h21(i+g+3.17);} }
  return vec4(rv, sqrt(d), id); }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
// planar uv for a world-space surface, picked by its normal
vec2 puv(vec3 p, vec3 n){ return abs(n.y) > 0.6 ? p.xz : (abs(n.x) > 0.6 ? p.zy : p.xy); }
`;

// ---------------------------------------------------------------------------
// patch(): add world-space colour, roughness and bump functions (and optional
// discard / self-glow) to a built-in material, so it stays physically lit.
//   colorFn(p, n) -> vec3 multiplier of the base colour
//   roughFn(p, n) -> float roughness (MeshStandardMaterial only)
//   bumpFn(p, n)  -> float height in metres (normal perturbed with derivatives)
// ---------------------------------------------------------------------------
let patchId = 0;
export function patch(mat, { uniforms = {}, colorFn = '', roughFn = '', bumpFn = '', bump = 1.0, extraFrag = '', discard = '', emissiveFn = '', key = '' }) {
  mat.userData.uniforms = uniforms;
  const id = key || `p${patchId++}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 wpp = vec4(transformed, 1.0);
          vec3 wn = objectNormal;
          #ifdef USE_INSTANCING
            wpp = instanceMatrix * wpp;
            wn = mat3(instanceMatrix) * wn;
          #endif
          vWPos = (modelMatrix * wpp).xyz;
          vWNrm = normalize(mat3(modelMatrix) * wn);
        }`
      );
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${extraFrag}`);
    if (colorFn) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n diffuseColor.rgb *= ${colorFn}(vWPos, normalize(vWNrm));`);
    if (roughFn) fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n roughnessFactor = ${roughFn}(vWPos, normalize(vWNrm));`);
    if (bumpFn) {
      fs = fs.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          float hh = ${bumpFn}(vWPos, normalize(vWNrm));
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          vec3 g = sign(det) * (dFdx(hh) * r1 + dFdy(hh) * r2);
          vec3 nb = abs(det) * normal - g * ${bump.toFixed(3)};
          // degenerate derivatives (edge-on pixels) would normalise a zero vector into a NaN
          if (dot(nb, nb) > 1e-24) normal = normalize(nb);
        }`
      );
    }
    if (emissiveFn) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += ${emissiveFn}(vWPos, normalize(vWNrm), diffuseColor.rgb);`);
    if (discard) fs = fs.replace('void main() {', `void main() {\n if (${discard}) discard;`);
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => id;
  return mat;
}

// shadow-map material that drops the same fragments as its colour material
export function maskedDepth(uniforms, extraFrag, discard) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${extraFrag}`)
      .replace('void main() {', `void main() {\n if (${discard}) discard;`);
  };
  d.customProgramCacheKey = () => 'depth' + discard;
  return d;
}

// ---------------------------------------------------------------------------
// soil: rich brown strata like a slice of cake, small stones and roots
// ---------------------------------------------------------------------------
export const GLSL_SOIL = /* glsl */ `
// returns colour; h = surface height (stones stand out, roots are raised threads)
vec3 soilAt(vec2 p, out float h){
  float d = -p.y; // depth below the lawn
  float j = (vnoise(p * vec2(1.3, 0.7)) - 0.5) * 0.35 + (vnoise(p * vec2(5.0, 2.0)) - 0.5) * 0.08;
  float b = d + j; // wavy strata depth
  vec3 grass = s2l(vec3(0.24, 0.42, 0.16));
  vec3 topsoil = s2l(vec3(0.27, 0.17, 0.10));
  vec3 loam = s2l(vec3(0.40, 0.26, 0.15));
  vec3 brown = s2l(vec3(0.50, 0.33, 0.19));
  vec3 clay = s2l(vec3(0.58, 0.36, 0.21));
  vec3 rust = s2l(vec3(0.52, 0.29, 0.16));
  vec3 sandy = s2l(vec3(0.62, 0.48, 0.32));
  vec3 deep = s2l(vec3(0.42, 0.31, 0.22));
  vec3 c;
  h = 0.0;
  if (d < 0.08) {
    c = mix(grass, grass * 0.55, smoothstep(0.0, 0.08, d));
  } else {
    c = mix(topsoil, loam, smoothstep(0.25, 0.75, b));
    c = mix(c, brown, smoothstep(1.0, 1.35, b));
    c = mix(c, clay, smoothstep(2.7, 3.0, b));
    c = mix(c, rust, smoothstep(3.9, 4.2, b));
    c = mix(c, sandy, smoothstep(5.3, 5.6, b));
    c = mix(c, deep, smoothstep(7.0, 7.5, b));
    // thin darker line on each layer boundary, as in a slice of cake
    float line = 0.0;
    line = max(line, 1.0 - smoothstep(0.0, 0.04, abs(b - 1.18)));
    line = max(line, 1.0 - smoothstep(0.0, 0.04, abs(b - 2.85)));
    line = max(line, 1.0 - smoothstep(0.0, 0.04, abs(b - 4.05)));
    line = max(line, 1.0 - smoothstep(0.0, 0.05, abs(b - 5.45)));
    c *= 1.0 - 0.18 * line;
    h -= 0.002 * line;
  }
  // grain: crumbly soil, fine speckles
  float g1 = fbm(p * 3.3), g2 = vnoise(p * 29.0), g3 = vnoise(p * 71.0);
  c *= 0.82 + 0.3 * g1;
  c *= 0.9 + 0.16 * g2;
  c *= 1.0 - 0.18 * step(0.84, g3);
  h += 0.004 * g1 + 0.0018 * g2 - 0.002 * step(0.84, g3);
  // roots: hang down from the turf in thin threads that taper, wander and branch
  if (d > 0.06 && d < 1.3) {
    float rr = 0.0;
    for (int L = 0; L < 2; L++) {
      float cw = L == 0 ? 0.47 : 0.29;      // one root per cell this wide (some cells skip)
      float maxD = L == 0 ? 1.15 : 0.6;     // how deep they reach
      float ci = floor(p.x / cw);
      for (int k = -1; k <= 1; k++) {
        float cc = ci + float(k);
        float id = h21(vec2(cc, float(L) * 7.0 + 1.3));
        if (id < 0.42) continue;
        float len = maxD * (0.45 + 0.55 * fract(id * 7.7));
        float u = (d - 0.06) / len;
        if (u > 1.0) continue;
        float x0 = (cc + 0.2 + 0.6 * fract(id * 3.3)) * cw;
        float xr = x0 + (0.05 * sin(d * (5.0 + 3.0 * id) + id * 20.0) + 0.02 * sin(d * 17.0 + id * 9.0)) * (0.3 + u);
        float w = mix(0.012, 0.003, u) * (L == 0 ? 1.0 : 0.7);
        rr = max(rr, (1.0 - smoothstep(w * 0.45, w, abs(p.x - xr))) * (1.0 - smoothstep(0.8, 1.0, u)));
        // one side branch
        float bd = len * (0.3 + 0.35 * fract(id * 5.1));
        float bu = (d - 0.06 - bd) / 0.32;
        if (bu > 0.0 && bu < 1.0) {
          float xb = xr + (fract(id * 9.3) > 0.5 ? 1.0 : -1.0) * bu * 0.17 + 0.015 * sin(bu * 9.0);
          float wb = mix(0.0055, 0.0018, bu);
          rr = max(rr, (1.0 - smoothstep(wb * 0.45, wb, abs(p.x - xb))) * (1.0 - bu));
        }
      }
    }
    c = mix(c, s2l(vec3(0.38, 0.27, 0.17)) * (0.85 + 0.25 * g2), rr * 0.8);
    h += 0.004 * rr;
  }
  // small stones and pebbles
  if (d > 0.35) {
    vec4 ce = cellv(p * 3.2);
    float r = 0.055 + 0.075 * fract(ce.w * 5.7);
    float m = 1.0 - smoothstep(r - 0.012, r, ce.z);
    if (ce.w > 0.8 && m > 0.0) {
      vec3 pc = mix(s2l(vec3(0.42, 0.40, 0.38)), s2l(vec3(0.66, 0.60, 0.52)), fract(ce.w * 7.3));
      float dome = sqrt(max(0.0, 1.0 - (ce.z / r) * (ce.z / r)));
      pc *= 0.72 + 0.4 * smoothstep(0.0, 1.0, dot(normalize(vec2(0.55, -0.45)), -ce.xy / max(r, 1e-4)) * 0.5 + 0.5);
      c = mix(c, pc, m);
      h += 0.03 * r * dome * m / 0.1;
    }
    vec4 cf = cellv(p * 9.5 + 3.3);
    float rf = 0.035;
    if (cf.w > 0.86) {
      float mf = 1.0 - smoothstep(rf - 0.01, rf, cf.z);
      c = mix(c, s2l(vec3(0.58, 0.53, 0.47)) * (0.8 + 0.3 * fract(cf.w * 11.0)), mf);
      h += 0.004 * mf;
    }
  }
  // worm burrows: thin dark wiggly tunnels through the upper layers
  if (d > 0.2 && d < 3.4) {
    vec2 cs = vec2(0.85, 0.62);
    vec2 cid = floor(p / cs);
    float wid = h21(cid + 5.3);
    if (wid > 0.5) {
      vec2 o = (cid + vec2(0.2 + 0.6 * h21(cid + 1.1), 0.25 + 0.5 * h21(cid + 2.2))) * cs;
      vec2 q = p - o;
      float ang = (h21(cid + 3.3) - 0.5) * 2.2;
      vec2 dir = vec2(cos(ang), sin(ang));
      float along = dot(q, dir), across = dot(q, vec2(-dir.y, dir.x));
      float len = 0.2 + 0.2 * h21(cid + 4.4);
      float wig = 0.022 * sin(along * 34.0 + wid * 20.0) + 0.01 * sin(along * 71.0 + wid * 9.0);
      float tw = 0.0075;
      float m = (1.0 - smoothstep(tw * 0.55, tw, abs(across - wig))) * smoothstep(-0.01, 0.01, along) * (1.0 - smoothstep(len - 0.02, len, along));
      c = mix(c, c * 0.42, m * 0.85);
      h -= 0.003 * m;
    }
  }
  return c;
}
`;

// Bake the soil cut face (z = 0) into a half-float texture once: rgb = colour,
// a = height (for bump), so the frame shader only does a texture fetch.
export function bakeSoil(renderer, FullScreenQuad, rect = new THREE.Vector4(-6.5, -12.6, 9.5, 0.1), pxPerM = 200) {
  const w = Math.round((rect.z - rect.x) * pxPerM), h = Math.round((rect.w - rect.y) * pxPerM);
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
  });
  rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const q = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { uRect: { value: rect } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `${GLSL_COMMON.replace('varying vec3 vWPos;\nvarying vec3 vWNrm;', '')}\n${GLSL_SOIL}
      uniform vec4 uRect; varying vec2 vUv;
      void main(){ vec2 p = mix(uRect.xy, uRect.zw, vUv); float h; vec3 c = soilAt(p, h); gl_FragColor = vec4(c, h * 20.0); }`,
  }));
  renderer.setRenderTarget(rt);
  q.render(renderer);
  renderer.setRenderTarget(null);
  q.material.dispose();
  return { tex: rt.texture, rect, pxPerM };
}

// ---------------------------------------------------------------------------
// the hole (see world.js): analytic, driven by a few uniforms set every frame
// ---------------------------------------------------------------------------
export const HOLE_U = {
  uHole: { value: new THREE.Vector4(0, 0.3, 0.27, 2.5) }, // centre x, half width at the top / bottom, DEEP
  uHoleS: { value: new THREE.Vector4(0, 0, 0, 0.07) }, // fillTop, dugD, mud (0..1), bottom rounding
  uWet: { value: new THREE.Vector4(0, 0, 0, 0) }, // wet front depth, wetness, time, bare patch on the lawn (0..1)
  uHoleW: { value: 0.62 }, // the hole reaches back to z = -uHoleW
  uRain: { value: 0 },
  uBury: { value: [new THREE.Vector4(0, 0, 0, 0), new THREE.Vector4(0, 0, 0, 0)] }, // buried things: centre xy, half size xy (shadowed rim on the cut face)
};
export const GLSL_HOLE = /* glsl */ `
uniform vec4 uHole; uniform vec4 uHoleS; uniform vec4 uWet; uniform float uHoleW; uniform float uRain; uniform vec4 uBury[2];
float hwAt(float d){ return mix(uHole.y, uHole.z, clamp(d / uHole.w, 0.0, 1.0)); }
float botAt(float x, float D){ float q = clamp((x - uHole.x) / hwAt(D), -1.0, 1.0); return D - uHoleS.w * min(1.0, D / 0.3) * q * q; }
// 0 = untouched soil, 1 = open air, 2 = loose dirt / mud inside the hole
int holeAt(vec2 p){
  float d = -p.y;
  if (d < 0.0 || uHoleS.y <= 0.001 || abs(p.x - uHole.x) > hwAt(d) || d > botAt(p.x, uHoleS.y)) return 0;
  return d < uHoleS.x ? 1 : 2;
}
// fresh dug dirt (crumbly clumps) and mud (dark, wet, smooth with slow ripples)
vec3 looseColor(vec2 p, out float h, out float rough){
  vec4 ce = cellv(p * 14.0);
  float cl = smoothstep(0.05, 0.5, ce.z);
  vec3 dirt = mix(s2l(vec3(0.21, 0.135, 0.08)), s2l(vec3(0.37, 0.25, 0.155)), fract(ce.w * 3.7) * 0.55 + 0.45 * vnoise(p * 9.0));
  dirt *= 0.74 + 0.26 * cl;
  float hd = 0.012 * (1.0 - cl) + 0.004 * vnoise(p * 40.0);
  vec3 mud = s2l(vec3(0.3, 0.2, 0.125)) * (0.82 + 0.24 * vnoise(p * 5.0 + vec2(uWet.z * 0.25, 0.0)));
  float hm = 0.0025 * sin(p.x * 26.0 + uWet.z * 2.2 + 3.0 * vnoise(p * 4.0)) * sin(p.y * 21.0 - uWet.z * 1.4) + 0.0015 * vnoise(p * 22.0);
  float m = uHoleS.z;
  h = mix(hd, hm, m);
  rough = mix(0.97, 0.22, m);
  return mix(dirt, mud, m);
}
// soil darkened by the rain soaking down (a wavy front), 0..1
float wetAt(vec2 p){
  float front = uWet.x * (0.9 + 0.2 * vnoise(vec2(p.x * 1.7, 3.1))) - 0.15 * vnoise(vec2(p.x * 6.0, 1.7));
  return uWet.y * (1.0 - smoothstep(front - 0.3, front, -p.y));
}
// soft contact shadow on the cut face round things buried flush with it
float buryAO(vec2 p){
  float a = 1.0;
  for (int i = 0; i < 2; i++) {
    vec4 b = uBury[i];
    if (b.z <= 0.0) continue;
    vec2 q = abs(p - b.xy) - b.zw;
    float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
    a *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.06, d)) * step(0.0, d);
  }
  return a;
}
`;

// hand-dug soil on the hole's walls
export const GLSL_TUNNEL = /* glsl */ `
vec3 tunnelColor(vec3 p, vec3 n){
  vec2 uv = puv(p, n);
  vec3 c = mix(s2l(vec3(0.33, 0.21, 0.13)), s2l(vec3(0.47, 0.31, 0.19)), fbm(uv * 2.4));
  c *= 0.84 + 0.26 * vnoise(uv * 17.0);
  vec4 ce = cellv(uv * vec2(2.4, 3.6));
  c *= 0.86 + 0.16 * smoothstep(0.15, 0.55, ce.z);
  c *= 1.0 - 0.2 * step(0.88, vnoise(uv * 43.0));
  return c;
}
float tunnelBump(vec3 p, vec3 n){
  vec2 uv = puv(p, n);
  vec4 ce = cellv(uv * vec2(4.0, 5.0));
  return 0.012 * smoothstep(0.1, 0.6, ce.z) + 0.005 * vnoise(uv * 17.0) + 0.002 * vnoise(uv * 51.0);
}
// turf and roots along the top of the walls, matching the cut face's top band
vec3 turfBand(vec3 p, vec3 n, vec3 c){
  if (p.y < -0.65 || p.y > 0.02) return c;
  float u = abs(n.x) > 0.5 ? p.z : p.x;
  float d = -p.y + (vnoise(vec2(u * 6.0, 2.7)) - 0.5) * 0.05;
  vec3 grass = s2l(vec3(0.24, 0.42, 0.16));
  if (d < 0.08) return mix(grass, grass * 0.55, smoothstep(0.0, 0.08, d));
  vec3 roots = s2l(vec3(0.27, 0.17, 0.10)) * (0.8 + 0.4 * vnoise(vec2(u * 37.0, p.y * 19.0)));
  vec3 r = mix(roots, c, smoothstep(0.12, 0.5, d));
  float th = smoothstep(0.8, 0.93, vnoise(vec2(u * 55.0, 0.3))) * (1.0 - smoothstep(0.1, 0.18 + 0.4 * vnoise(vec2(u * 13.0, 7.0)), d));
  return mix(r, s2l(vec3(0.55, 0.42, 0.28)), th * 0.75);
}
`;
const soilStd = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0.0 });

// soil cut face: baked strata with bump; open where the hole is open, loose dirt or
// mud where it has been filled, darker where the rain has soaked in
export function soilFrontMaterial(soil) {
  const uniforms = { ...HOLE_U, uSoil: { value: soil.tex }, uSoilRect: { value: soil.rect } };
  const frag = `${GLSL_HOLE}\nuniform sampler2D uSoil; uniform vec4 uSoilRect;
    vec2 soilUV(vec3 p){ return (p.xy - uSoilRect.xy) / (uSoilRect.zw - uSoilRect.xy); }
    vec3 frontColor(vec3 p, vec3 n){
      float h, r;
      vec3 c = holeAt(p.xy) == 2 ? looseColor(p.xy, h, r) : texture2D(uSoil, soilUV(p)).rgb * mix(1.0, 0.68, wetAt(p.xy));
      return c * buryAO(p.xy);
    }
    float frontBump(vec3 p, vec3 n){ float h, r; if (holeAt(p.xy) == 2) { looseColor(p.xy, h, r); return h; } return texture2D(uSoil, soilUV(p)).a / 20.0; }
    float frontRough(vec3 p, vec3 n){ float h, r; if (holeAt(p.xy) == 2) { looseColor(p.xy, h, r); return r; }
      return mix(0.9 - 0.25 * smoothstep(0.004, 0.02, texture2D(uSoil, soilUV(p)).a / 20.0), 0.5, wetAt(p.xy)); }`;
  const discard = 'holeAt(vWPos.xy) == 1';
  const m = patch(soilStd(), { uniforms, colorFn: 'frontColor', bumpFn: 'frontBump', bump: 1.0, roughFn: 'frontRough', extraFrag: frag, discard, key: 'soilFront' });
  m.userData.depth = maskedDepth(uniforms, GLSL_HOLE, discard);
  return m;
}
// the hole's back wall (z = -W) and side walls: drawn only where the hole is open
// (side walls test a point just inside, along their inward normal)
export function holeWallMaterial() {
  const uniforms = { ...HOLE_U };
  const frag = GLSL_HOLE + GLSL_TUNNEL + `
    vec3 wallColor(vec3 p, vec3 n){
      float d = -p.y;
      float ao = mix(0.45, 1.0, smoothstep(0.0, 0.4, uHoleS.x - d)); // darker near the bottom of the open part
      ao *= mix(1.0, 0.72, smoothstep(0.55, 1.0, abs(p.x - uHole.x) / hwAt(d)) * step(0.5, abs(n.z))); // and in the back corners
      ao *= mix(1.0, 0.7, smoothstep(-uHoleW * 0.4, -uHoleW, p.z) * step(0.5, abs(n.x)));
      // the low sun comes from the left: the left part of the back wall and the left
      // wall itself are in the hole's own soft shade (the walls cast no real shadows)
      ao *= mix(0.55, 1.0, smoothstep(-0.05, 0.3, (p.x - uHole.x + hwAt(d)) / (2.0 * hwAt(d)) * step(0.5, abs(n.z)) + step(0.5, -n.x) * 2.0 + step(0.5, n.x) * 0.0));
      return turfBand(p, n, tunnelColor(p, n) * mix(1.0, 0.68, wetAt(p.xy)) * ao);
    }`;
  const discard = 'holeAt(vWPos.xy + vWNrm.xy * 0.012) != 1';
  const m = patch(soilStd(), { uniforms, colorFn: 'wallColor', bumpFn: 'tunnelBump', extraFrag: frag, discard, key: 'holeWall' });
  m.userData.depth = maskedDepth(uniforms, GLSL_HOLE, discard);
  return m;
}
// the top of the loose dirt / mud inside the open hole
export function fillTopMaterial() {
  const uniforms = { ...HOLE_U };
  const frag = GLSL_HOLE + `
    vec3 ftColor(vec3 p, vec3 n){ float h, r; vec3 c = looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r);
      float ao = mix(0.6, 1.0, smoothstep(0.0, 0.12, hwAt(uHoleS.x) - abs(p.x - uHole.x))) * mix(0.65, 1.0, smoothstep(-uHoleW, -uHoleW + 0.15, p.z));
      return c * ao; }
    float ftBump(vec3 p, vec3 n){ float h, r; looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r);
      // rain rings on the mud puddle
      float rr = 0.0;
      if (uRain > 0.0) { vec4 ce = cellv(p.xz * 9.0); float ph = fract(uWet.z * 1.7 + ce.w * 7.0); rr = sin((ce.z - ph * 0.5) * 60.0) * (1.0 - ph) * smoothstep(0.5, 0.0, abs(ce.z - ph * 0.5)) * uRain * uHoleS.z; }
      return h + 0.0015 * rr; }
    float ftRough(vec3 p, vec3 n){ float h, r; looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r); return r; }`;
  return patch(soilStd(), { uniforms, colorFn: 'ftColor', bumpFn: 'ftBump', roughFn: 'ftRough', extraFrag: frag, key: 'fillTop' });
}

// ---------------------------------------------------------------------------
// lawn top: mowing stripes; the hole's opening, the bare patch of fresh dirt and
// loose crumbs round it; darker and shinier while it rains
// ---------------------------------------------------------------------------
export function lawnMaterial() {
  const uniforms = { ...HOLE_U };
  const frag = GLSL_HOLE + `
    // distance outside the patch (the hole's opening, a little wider), <0 inside
    float patchD(vec3 p){ vec2 q = vec2(abs(p.x - uHole.x) - uHole.y, max(-uHoleW - p.z, p.z)); return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
    vec3 lawnTop(vec3 p, vec3 n){
      // mowing stripes in the yard (none past the back fence)
      float s = smoothstep(0.46, 0.54, abs(fract((p.x + 0.4) / 1.5) - 0.5) * 2.0) * smoothstep(-13.0, -12.0, p.z);
      vec3 c = mix(s2l(vec3(0.24, 0.43, 0.15)), s2l(vec3(0.33, 0.52, 0.19)), s);
      c *= 0.85 + 0.25 * fbm(p.xz * 0.9);
      c *= 0.9 + 0.18 * vnoise(p.xz * 13.0);
      float wet = uWet.y * smoothstep(0.0, 0.15, uWet.x);
      c *= 1.0 - 0.3 * wet;
      float k = uWet.w;
      if (k > 0.0) {
        float d = patchD(p) + 0.025 * (vnoise(p.xz * 23.0) - 0.5);
        // crumbs of dirt scattered on the grass round the patch
        float cr = step(0.8, vnoise(p.xz * 47.0)) * (1.0 - smoothstep(0.05, 0.35, d)) * k;
        float h, r;
        vec3 dirt = looseColor(p.xz * 1.3 + vec2(0.0, 2.3), h, r);
        c = mix(c, dirt * 0.9, max(cr * 0.8, (1.0 - smoothstep(-0.01, 0.015, d)) * k));
        c *= 1.0 - 0.18 * k * (1.0 - smoothstep(0.0, 0.1, d)) * step(0.0, d); // darker grass at the edge
      }
      return c;
    }
    float lawnRough(vec3 p, vec3 n){ return mix(0.88 + 0.1 * vnoise(p.xz * 7.0), 0.55, uWet.y * smoothstep(0.0, 0.15, uWet.x)); }
    bool hole(vec3 p){ return uHoleS.x > 0.004 && abs(p.x - uHole.x) < hwAt(0.0) && p.z > -uHoleW && p.z < 0.0; }`;
  const discard = 'hole(vWPos)';
  const m = patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), { uniforms, colorFn: 'lawnTop', roughFn: 'lawnRough', extraFrag: frag, discard, key: 'lawn' });
  m.userData.depth = maskedDepth(uniforms, frag, discard);
  return m;
}

// ---------------------------------------------------------------------------
// small material kit shared by the modules
// ---------------------------------------------------------------------------
export const std = (hex, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });
export const glow = (c, opacity = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
