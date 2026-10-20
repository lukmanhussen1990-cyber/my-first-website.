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
          normal = normalize(abs(det) * normal - g * ${bump.toFixed(3)});
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
  return c;
}
`;

// Bake the soil cut face (z = 0) into a half-float texture once: rgb = colour,
// a = height (for bump), so the frame shader only does a texture fetch.
export function bakeSoil(renderer, FullScreenQuad, rect = new THREE.Vector4(-7.0, -9.8, 7.0, 0.1), pxPerM = 200) {
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
// dig-masked surfaces of the tunnel (see world.js)
// ---------------------------------------------------------------------------
export const digTime = { value: 0 };
export const GLSL_DIG = /* glsl */ `
uniform sampler2D uDig; uniform vec4 uDigRect; uniform float uTime;
float digT(vec2 p){
  vec2 uv = (p - uDigRect.xy) / (uDigRect.zw - uDigRect.xy);
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 200.0;
  return texture2D(uDig, uv).r;
}
bool dug(vec2 p){ return digT(p) <= uTime; }
// ambient occlusion from the dig field: corners and the roof edge go darker
float digAO(vec2 p){
  float a = 0.0;
  a += dug(p + vec2(0.0, 0.10)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.0, 0.26)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.13, 0.04)) ? 1.0 : 0.0;
  a += dug(p + vec2(-0.13, 0.04)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.28, 0.14)) ? 1.0 : 0.0;
  a += dug(p + vec2(-0.28, 0.14)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.0, -0.09)) ? 1.0 : 0.0;
  return a / 7.0;
}
`;
const digUniforms = (dig) => ({ uDig: { value: dig.tex }, uDigRect: { value: dig.rect }, uTime: digTime });

// inside of the tunnel: hand-dug soil with scoop marks
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
  vec4 ce = cellv(uv * vec2(2.4, 3.6));
  return 0.02 * smoothstep(0.1, 0.6, ce.z) + 0.006 * vnoise(uv * 17.0) + 0.002 * vnoise(uv * 51.0);
}
vec3 floorColor(vec3 p, vec3 n){
  vec3 c = mix(s2l(vec3(0.40, 0.27, 0.16)), s2l(vec3(0.55, 0.38, 0.24)), fbm(p.xz * 3.1 + p.y));
  c *= 0.85 + 0.25 * vnoise(p.xz * 21.0 + p.y * 3.0);
  return c;
}
float floorBump(vec3 p, vec3 n){ return 0.006 * fbm(p.xz * 6.0) + 0.002 * vnoise(p.xz * 40.0); }
// turf and roots along the top of the shafts, matching the cut face's top band
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

// soil cut face: baked strata with bump, holes wherever the tunnel is open
export function soilFrontMaterial(soil, dig) {
  const uniforms = { ...digUniforms(dig), uSoil: { value: soil.tex }, uSoilRect: { value: soil.rect } };
  const frag = `${GLSL_DIG}\nuniform sampler2D uSoil; uniform vec4 uSoilRect;
    vec2 soilUV(vec3 p){ return (p.xy - uSoilRect.xy) / (uSoilRect.zw - uSoilRect.xy); }
    vec3 frontColor(vec3 p, vec3 n){ return texture2D(uSoil, soilUV(p)).rgb; }
    float frontBump(vec3 p, vec3 n){ return texture2D(uSoil, soilUV(p)).a / 20.0; }
    float frontRough(vec3 p, vec3 n){ return 0.9 - 0.25 * smoothstep(0.004, 0.02, texture2D(uSoil, soilUV(p)).a / 20.0); }`;
  const discard = 'dug(vWPos.xy)';
  const m = patch(soilStd(), { uniforms, colorFn: 'frontColor', bumpFn: 'frontBump', bump: 1.0, roughFn: 'frontRough', extraFrag: frag, discard, key: 'soilFront' });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// back wall of the tunnel (z = -W): only where it is open
export function tunnelBackMaterial(dig) {
  const uniforms = digUniforms(dig);
  const discard = '!dug(vWPos.xy) || vWPos.y > 0.0';
  const frag = GLSL_DIG + GLSL_TUNNEL + 'vec3 backColor(vec3 p, vec3 n){ return turfBand(p, n, tunnelColor(p, n) * mix(0.35, 1.0, digAO(p.xy))); }';
  const m = patch(soilStd(), { uniforms, colorFn: 'backColor', bumpFn: 'tunnelBump', extraFrag: frag, discard, key: 'tunBack' });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// floors, dig faces and side walls: drawn where they bound the open tunnel
// (open on the side the normal points to, still solid behind)
export function tunnelBoundaryMaterial(dig, colorFn = 'floorColor', bumpFn = 'floorBump') {
  const uniforms = digUniforms(dig);
  const discard = '!(dug(vWPos.xy + normalize(vWNrm.xy + vec2(1e-5)) * 0.035) && !dug(vWPos.xy - normalize(vWNrm.xy + vec2(1e-5)) * 0.035))';
  const frag = GLSL_DIG + GLSL_TUNNEL + `vec3 bColor(vec3 p, vec3 n){ return turfBand(p, n, ${colorFn}(p, n) * mix(0.45, 1.0, digAO(p.xy + n.xy * 0.05))); }`;
  const m = patch(soilStd(), { uniforms, colorFn: 'bColor', bumpFn, extraFrag: frag, discard, key: 'tunB' + colorFn });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// dark soil just behind the tunnel's back wall (catches rays through hairline seams)
export function seamMaterial() {
  return patch(soilStd(), { colorFn: 'seamColor', extraFrag: GLSL_TUNNEL + 'vec3 seamColor(vec3 p, vec3 n){ return tunnelColor(p, n) * 0.45; }', key: 'seam' });
}

// ---------------------------------------------------------------------------
// lawn top: mowing stripes, with the shaft opening and spilled dirt
// ---------------------------------------------------------------------------
export function lawnMaterial(holes) {
  const uniforms = { uTime: digTime, uShaft: { value: holes.shaft }, uOpen: { value: holes.open } };
  const frag = `uniform float uTime; uniform vec4 uShaft; uniform float uOpen;
    vec3 lawnTop(vec3 p, vec3 n){
      float s = smoothstep(0.46, 0.54, abs(fract(p.x / 1.6) - 0.5) * 2.0);
      vec3 c = mix(s2l(vec3(0.22, 0.40, 0.17)), s2l(vec3(0.30, 0.49, 0.21)), s);
      c *= 0.85 + 0.25 * fbm(p.xz * 0.9);
      c *= 0.9 + 0.18 * vnoise(p.xz * 13.0);
      // loose dirt spilled round the shaft opening
      vec2 q = vec2(max(uShaft.x - p.x, p.x - uShaft.y), uShaft.z - p.z);
      float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float k = smoothstep(uOpen, uOpen + 1.6, uTime);
      if (k > 0.0 && d < 0.45) {
        float w = (0.07 + 0.16 * k) * (0.75 + 0.5 * vnoise(p.xz * 9.0)) + 0.05 * (vnoise(p.xz * 31.0) - 0.5);
        float m = 1.0 - smoothstep(w - 0.02, w + 0.02, d);
        vec3 dirt = mix(s2l(vec3(0.36, 0.24, 0.14)), s2l(vec3(0.5, 0.34, 0.21)), vnoise(p.xz * 17.0));
        c *= 1.0 - 0.3 * k * (1.0 - smoothstep(0.0, 0.35, d));
        c = mix(c, dirt, m * smoothstep(0.0, 0.25, k));
      }
      return c;
    }
    float lawnRough(vec3 p, vec3 n){ return 0.88 + 0.1 * vnoise(p.xz * 7.0); }
    bool hole(vec3 p){
      // the doghouse floor patch's opening (always there, hidden under the patch at rest)
      if (p.x > -1.22 && p.x < -0.78 && p.z > -0.86 && p.z < -0.42) return true;
      return uTime >= uOpen && p.x > uShaft.x && p.x < uShaft.y && p.z > uShaft.z && p.z < uShaft.w; }`;
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
