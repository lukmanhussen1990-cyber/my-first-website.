import * as THREE from 'three';

// sRGB hex -> linear THREE.Color
export const col = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------------------
// GLSL helpers shared by the procedural materials. Patterns are computed in
// world space so neighbouring meshes line up.
// ---------------------------------------------------------------------------
export const GLSL_NOISE = /* glsl */ `
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
// Voronoi: x = distance to the nearest point, y = to the second nearest, z = nearest cell id
vec3 voro(vec2 p){ vec2 i=floor(p), f=fract(p); float d1=8., d2=8.; float id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y));
    vec2 o=vec2(h21(i+g), h21(i+g+17.31))*0.85+0.075; vec2 r=g+o-f; float dd=dot(r,r);
    if(dd<d1){ d2=d1; d1=dd; id=h21(i+g+3.17);} else if(dd<d2){ d2=dd; } }
  return vec3(sqrt(d1), sqrt(d2), id); }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
// planar uv for a world-space surface, picked by its normal
vec2 puv(vec3 p, vec3 n){ return abs(n.y) > 0.6 ? p.xz : (abs(n.x) > 0.6 ? p.zy : p.xy); }
`;
export const GLSL_COMMON = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
${GLSL_NOISE}
// fade a pattern of spatial frequency f (cycles per metre) before it aliases
float aaF(float f){ float fw = max(length(fwidth(vWPos)), 1e-5); return 1.0 - smoothstep(0.22, 0.55, fw * f); }
`;

// ---------------------------------------------------------------------------
// patch(): add world-space colour, roughness, metalness, bump (or a full normal)
// and glow functions (and an optional discard) to a built-in material, so it
// stays physically lit.
//   colorFn(p, n)  -> vec3 multiplier of the base colour
//   roughFn(p, n)  -> float roughness;  metalFn(p, n) -> float metalness
//   bumpFn(p, n)   -> float height in metres (normal perturbed with derivatives)
//   normalFn(p, n) -> vec3 world-space normal (replaces the bump)
//   emissiveFn(p, n, albedo) -> vec3 added radiance
// ---------------------------------------------------------------------------
let patchId = 0;
export function patch(mat, { uniforms = {}, colorFn = '', roughFn = '', metalFn = '', bumpFn = '', normalFn = '', bump = 1.0, extraFrag = '', discard = '', emissiveFn = '', key = '', vertex = '' }) {
  mat.userData.uniforms = uniforms;
  const id = key || `p${patchId++}`;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n' + (vertex ? vertex.split('@@')[0] : ''))
      .replace(
        '#include <project_vertex>',
        `${vertex ? vertex.split('@@')[1] || '' : ''}
        #include <project_vertex>
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
    if (metalFn) fs = fs.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n metalnessFactor = ${metalFn}(vWPos, normalize(vWNrm));`);
    if (normalFn) {
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 nw = ${normalFn}(vWPos, normalize(vWNrm)); vec3 nv = normalize((viewMatrix * vec4(nw, 0.0)).xyz);
          normal = faceDirection * nv; }`);
    } else if (bumpFn) {
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
export function maskedDepth(uniforms, extraFrag, discard, key = '') {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wpp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wpp = instanceMatrix * wpp;
          #endif
          vWPos = (modelMatrix * wpp).xyz; vWNrm = vec3(0.0, 1.0, 0.0); }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}\n${extraFrag}`)
      .replace('void main() {', `void main() {\n if (${discard}) discard;`);
  };
  d.customProgramCacheKey = () => 'depth' + key + discard;
  return d;
}

// ---------------------------------------------------------------------------
// soil: the excavated face of a real backyard: dark humus with fine roots under
// the turf, brown loam, a warmer clay-rich band, paler stony subsoil; vertical
// gouges and ridges left by the digging, dry cracks, clods, pebbles and stones
// ---------------------------------------------------------------------------
export const GLSL_SOIL = /* glsl */ `
vec3 soilAt(vec2 p, out float h){
  float d = -p.y; // depth below the lawn
  float wob = (fbm(vec2(p.x * 0.3, 1.7)) - 0.5) * 0.55 + (vnoise(vec2(p.x * 1.7, 4.1)) - 0.5) * 0.14;
  float b = d + wob;
  vec3 humus = s2l(vec3(0.22, 0.155, 0.105));
  vec3 loam = s2l(vec3(0.43, 0.3, 0.2));
  vec3 clay = s2l(vec3(0.48, 0.32, 0.21));
  vec3 sub = s2l(vec3(0.5, 0.39, 0.28));
  vec3 deep = s2l(vec3(0.44, 0.36, 0.28));
  vec3 c = mix(humus, loam, smoothstep(0.16, 0.7, b));
  c = mix(c, clay, smoothstep(1.5, 2.4, b));
  c = mix(c, sub, smoothstep(3.4, 4.4, b));
  c = mix(c, deep, smoothstep(5.6, 6.8, b));
  h = 0.0;
  float below = smoothstep(0.08, 0.35, d);
  // vertical gouges and ridges left by the digging (long, wavy, irregular)
  float wx = p.x + 0.3 * (fbm(vec2(p.y * 0.7, p.x * 0.45 + 3.0)) - 0.5);
  float f1 = fbm(vec2(wx * 2.3, p.y * 0.22 + 5.0));
  float f2 = fbm(vec2(wx * 6.8 + 11.0, p.y * 0.55));
  float f3 = vnoise(vec2(wx * 19.0 + 3.0, p.y * 1.6));
  float r1 = 1.0 - abs(f1 * 2.0 - 1.0), r2 = 1.0 - abs(f2 * 2.0 - 1.0);
  h += below * (0.11 * (r1 - 0.55) + 0.04 * (r2 - 0.5) + 0.012 * (f3 - 0.5));
  c *= mix(1.0, 0.74 + 0.4 * r1 + 0.16 * (r2 - 0.5), below);
  // ledges where a slab of soil broke away (lighter, fresher soil below a lip)
  float lv = fbm(vec2(p.x * 0.9 + 4.0, p.y * 2.6));
  float ledge = smoothstep(0.62, 0.7, lv) * below;
  c *= 1.0 + 0.12 * ledge;
  h += 0.02 * ledge;
  // clods and crumbs
  vec3 vc = voro(p * 10.0);
  float clod = smoothstep(0.0, 0.32, vc.y - vc.x);
  h += 0.006 * clod + 0.0025 * vnoise(p * 70.0);
  c *= 0.9 + 0.12 * clod + 0.12 * (vnoise(p * 26.0) - 0.5);
  // damp blotches and lighter dry crust
  c *= 0.86 + 0.26 * fbm(p * 0.8 + 7.0);
  c = mix(c, c * vec3(1.12, 1.1, 1.06), 0.35 * smoothstep(0.55, 0.8, fbm(p * 2.2 + 31.0)) * below);
  // dry cracks along cell edges, broken up, mostly in the loam and the clay
  // (sparse: a few long fissures, mostly vertical, not a mud-plate network)
  vec3 cr = voro(p * vec2(1.1, 0.55) + vec2((fbm(p * 1.9) - 0.5) * 1.2, 0.0));
  float crk = (1.0 - smoothstep(0.008, 0.024, cr.y - cr.x)) * smoothstep(0.6, 0.72, fbm(p * 0.9 + 17.0)) * smoothstep(0.35, 0.9, d) * (1.0 - smoothstep(4.8, 6.0, d));
  c *= 1.0 - 0.5 * crk;
  h -= 0.02 * crk;
  vec3 cr2 = voro(p * vec2(4.0, 2.2) + 3.1);
  float crk2 = (1.0 - smoothstep(0.004, 0.012, cr2.y - cr2.x)) * smoothstep(0.66, 0.76, vnoise(p * 2.2 + 9.0)) * smoothstep(0.25, 0.6, d);
  c *= 1.0 - 0.3 * crk2;
  h -= 0.005 * crk2;
  // roots: fine dark threads hanging from the turf, a few long ones, branching
  if (d > 0.04 && d < 1.7) {
    float rr = 0.0;
    for (int L = 0; L < 3; L++) {
      float cw = L == 0 ? 0.31 : (L == 1 ? 0.17 : 0.83);
      float maxD = L == 0 ? 0.75 : (L == 1 ? 0.42 : 1.6);
      float ci = floor(p.x / cw);
      for (int k = -1; k <= 1; k++) {
        float cc = ci + float(k);
        float id = h21(vec2(cc, float(L) * 7.0 + 1.3));
        if (id < 0.35) continue;
        float len = maxD * (0.4 + 0.6 * fract(id * 7.7));
        float u = (d - 0.04) / len;
        if (u > 1.0) continue;
        float x0 = (cc + 0.15 + 0.7 * fract(id * 3.3)) * cw;
        float xr = x0 + (0.06 * sin(d * (4.0 + 3.0 * id) + id * 20.0) + 0.025 * sin(d * 15.0 + id * 9.0) + 0.012 * sin(d * 41.0 + id * 3.0)) * (0.3 + u);
        float w = mix(L == 2 ? 0.011 : 0.006, 0.0015, u);
        rr = max(rr, (1.0 - smoothstep(w * 0.4, w, abs(p.x - xr))) * (1.0 - smoothstep(0.75, 1.0, u)));
        for (int s = 0; s < 2; s++) {
          float bd = len * (0.2 + 0.3 * fract(id * (5.1 + float(s) * 2.3)));
          float bu = (d - 0.04 - bd) / (0.18 + 0.2 * fract(id * 1.7 + float(s)));
          if (bu > 0.0 && bu < 1.0) {
            float xb = xr + (fract(id * 9.3 + float(s) * 0.5) > 0.5 ? 1.0 : -1.0) * bu * 0.12 + 0.012 * sin(bu * 11.0 + id);
            float wb = mix(w * 0.6, 0.001, bu);
            rr = max(rr, (1.0 - smoothstep(wb * 0.4, wb, abs(p.x - xb))) * (1.0 - bu));
          }
        }
      }
    }
    c = mix(c, s2l(vec3(0.2, 0.14, 0.09)) * (0.85 + 0.3 * vnoise(p * 40.0)), rr * 0.85);
    h += 0.003 * rr;
  }
  // gravel and stones (more and bigger with depth), grey, beige and rusty
  {
    vec4 ce = cellv(p * 6.5);
    float r = 0.025 + 0.035 * fract(ce.w * 5.7);
    float on = step(mix(0.95, 0.84, smoothstep(0.5, 4.0, d)), ce.w) * smoothstep(0.2, 0.4, d);
    float m = (1.0 - smoothstep(r - 0.006, r, ce.z / 6.5 * (1.0 + 0.25 * (vnoise(p * 60.0) - 0.5)))) * on;
    vec3 pc = mix(s2l(vec3(0.42, 0.38, 0.33)), s2l(vec3(0.58, 0.51, 0.42)), fract(ce.w * 7.3));
    pc = mix(pc, s2l(vec3(0.5, 0.36, 0.26)), step(0.8, fract(ce.w * 13.1)));
    pc = mix(pc, c, 0.25);
    float dome = sqrt(max(0.0, 1.0 - pow(ce.z / 6.5 / max(r, 1e-4), 2.0)));
    pc *= 0.75 + 0.35 * dome + 0.12 * vnoise(p * 90.0);
    c = mix(c * (1.0 - 0.3 * on * (1.0 - smoothstep(r, r + 0.012, ce.z / 6.5))), pc, m);
    h += 0.018 * m * dome * (r / 0.05);
    vec4 cf = cellv(p * 19.0 + 3.3);
    float rf = 0.009 + 0.006 * fract(cf.w * 3.0);
    float mf = (1.0 - smoothstep(rf - 0.003, rf, cf.z / 19.0)) * step(0.88, cf.w) * smoothstep(0.15, 0.3, d);
    c = mix(c, mix(c, s2l(vec3(0.55, 0.5, 0.43)), 0.6) * (0.75 + 0.4 * fract(cf.w * 11.0)), mf);
    h += 0.004 * mf;
    // a few big rounded rocks deep down
    vec4 cb = cellv(p * 0.9 + 7.0);
    float rb = 0.13 + 0.09 * fract(cb.w * 3.1);
    float onb = step(0.8, cb.w) * smoothstep(2.4, 3.2, d);
    vec2 q = -cb.xy / 0.9;
    float mb = (1.0 - smoothstep(rb - 0.012, rb, length(q))) * onb;
    float db = sqrt(max(0.0, 1.0 - dot(q, q) / (rb * rb)));
    vec3 bc = mix(s2l(vec3(0.56, 0.53, 0.49)), s2l(vec3(0.66, 0.6, 0.52)), fract(cb.w * 9.0)) * (0.7 + 0.35 * db) * (0.85 + 0.25 * fbm(p * 14.0));
    c = mix(c * (1.0 - 0.35 * onb * (1.0 - smoothstep(rb, rb + 0.04, length(q)))), bc, mb);
    h += 0.06 * mb * db;
  }
  // the turf at the very top: dense dark root mat
  float turf = 1.0 - smoothstep(0.05, 0.13 + 0.04 * vnoise(vec2(p.x * 9.0, 1.0)), d);
  c = mix(c, s2l(vec3(0.17, 0.13, 0.08)) * (0.8 + 0.4 * vnoise(p * vec2(70.0, 25.0))), turf);
  h += 0.006 * turf * vnoise(p * vec2(60.0, 20.0));
  return c;
}
`;

// Bake the soil cut face (z = 0) once: colour + height, then a normal map and a
// cavity term from the height, so the frame shader only does texture fetches.
export function bakeSoil(renderer, FullScreenQuad, rect = new THREE.Vector4(-6.0, -8.0, 8.0, 0.05), pxPerM = 220) {
  const w = Math.round((rect.z - rect.x) * pxPerM), h = Math.round((rect.w - rect.y) * pxPerM);
  const opts = { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const rtC = new THREE.WebGLRenderTarget(w, h, opts);
  const rtN = new THREE.WebGLRenderTarget(w, h, opts);
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  rtC.texture.anisotropy = rtN.texture.anisotropy = aniso;
  const vs = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const q1 = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { uRect: { value: rect } },
    vertexShader: vs,
    fragmentShader: `${GLSL_NOISE}\n${GLSL_SOIL}
      uniform vec4 uRect; varying vec2 vUv;
      void main(){ vec2 p = mix(uRect.xy, uRect.zw, vUv); float hh; vec3 c = soilAt(p, hh); gl_FragColor = vec4(c, hh); }`,
  }));
  renderer.setRenderTarget(rtC);
  q1.render(renderer);
  const q2 = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: rtC.texture }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uM: { value: 1 / pxPerM } },
    vertexShader: vs,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uM; varying vec2 vUv;
      float H(vec2 o){ return texture2D(tSrc, vUv + o * uTexel).a; }
      void main(){
        float hl = H(vec2(-1.0, 0.0)), hr = H(vec2(1.0, 0.0)), hd = H(vec2(0.0, -1.0)), hu = H(vec2(0.0, 1.0));
        vec3 n = normalize(vec3(-(hr - hl) / (2.0 * uM), -(hu - hd) / (2.0 * uM), 1.0));
        // cavity: lower than the neighbourhood -> darker
        float h0 = H(vec2(0.0)), avg = 0.0;
        for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; avg += H(vec2(cos(a), sin(a)) * 9.0) + H(vec2(cos(a + 0.26), sin(a + 0.26)) * 22.0); }
        avg /= 24.0;
        float ao = clamp(1.0 + (h0 - avg) * 9.0, 0.45, 1.12);
        gl_FragColor = vec4(n.xy * 0.5 + 0.5, ao, 1.0);
      }`,
  }));
  renderer.setRenderTarget(rtN);
  q2.render(renderer);
  renderer.setRenderTarget(null);
  q1.material.dispose();
  q2.material.dispose();
  return { tex: rtC.texture, nrm: rtN.texture, rect, pxPerM };
}

// ---------------------------------------------------------------------------
// the pit (scene 2): the soil face is open where it has been dug; the pit's own
// walls show freshly dug soil with spade marks
// ---------------------------------------------------------------------------
export const PIT_U = {
  uPit: { value: new THREE.Vector4(0, 0, 0, 0) }, // x0, x1, depth, back z (negative)
  uFill: { value: 0 }, // backfill of the spare pit behind the stairs (0..1)
  uShelter: { value: 0 }, // 1 once the shelter stands in the pit
};
export const GLSL_PIT = /* glsl */ `
uniform vec4 uPit; uniform float uFill; uniform float uShelter;
// inside the open pit on the cut face (x, y)
bool pitAt(vec2 p){ return uPit.z > 0.002 && p.x > uPit.x && p.x < uPit.y && p.y > -uPit.z && p.y < 0.01; }
// freshly dug soil: spade marks, crumbs; c = the soil colour of the cut face at that depth
vec3 dugSoil(vec3 p, vec3 n, out float h){
  vec2 uv = puv(p, n);
  float d = -p.y;
  vec3 c = mix(s2l(vec3(0.3, 0.2, 0.125)), s2l(vec3(0.46, 0.3, 0.18)), smoothstep(0.1, 0.8, d));
  c = mix(c, s2l(vec3(0.52, 0.33, 0.2)), smoothstep(1.4, 2.3, d));
  // spade cuts: long flat facets down the wall, crumbs and small clods
  vec2 su = vec2(uv.x + 0.06 * fbm(vec2(uv.y * 2.0, uv.x)), uv.y);
  vec3 vc = voro(su * vec2(5.5, 1.3));
  float facet = vc.z;
  float ridge = 1.0 - smoothstep(0.0, 0.12, vc.y - vc.x);
  float dn = abs(n.y) > 0.6 ? 0.0 : 1.0;
  h = 0.012 * dn * (facet - 0.5) + 0.01 * ridge * dn + 0.005 * vnoise(uv * 40.0) + 0.0025 * vnoise(uv * 120.0);
  c *= 0.82 + 0.26 * facet * dn + 0.1 * (1.0 - dn);
  c *= 1.0 + 0.12 * ridge * dn;
  c *= 0.86 + 0.22 * vnoise(uv * 17.0) + 0.12 * (fbm(uv * 3.0) - 0.5);
  vec4 cl = cellv(uv * 22.0);
  float clod = (1.0 - smoothstep(0.12, 0.3, cl.z)) * step(0.82, cl.w);
  c *= 1.0 - 0.22 * clod;
  h += 0.004 * clod;
  return c;
}
`;

// ---------------------------------------------------------------------------
// concrete. Faces cut by the cutaway (z = 0, facing the camera) show the
// section: grey aggregate in the cement and the steel bars cut across (dots) or
// along (lines). Formed faces show plywood formwork joints, tie holes, small
// pores and mottling; the roof top a broom finish.
// uElem: x = 0 wall (thickness along x) / 1 slab (thickness along y),
//        y, z = the two faces along that axis, w = glow of the bars (0..1)
// ---------------------------------------------------------------------------
export const GLSL_CONCRETE = /* glsl */ `
uniform vec4 uElem; uniform float uWet;
// steel bars in the section: returns 0..1 coverage, sets the bar's shading
float bars(vec2 p, out float shade){
  float a = uElem.y, b = uElem.z;
  float cov = 0.0; shade = 1.0;
  float r = 0.009, cv = 0.055;
  if (uElem.x < 0.5) {
    // wall: vertical bars along the cut (lines), horizontal bars across it (dots)
    for (int k = 0; k < 2; k++) {
      float xl = k == 0 ? a + cv : b - cv;
      float dl = abs(p.x - xl);
      float line = 1.0 - smoothstep(r * 0.85, r, dl);
      if (line > cov) { cov = line; shade = 0.8 + 0.35 * (1.0 - dl / r) + 0.15 * sin(p.y * 260.0); }
      float xd = k == 0 ? a + cv + 0.021 : b - cv - 0.021;
      vec2 q = vec2(p.x - xd, mod(p.y + 0.05, 0.2) - 0.1);
      float dot1 = 1.0 - smoothstep(r * 0.85, r, length(q));
      if (dot1 > cov) { cov = dot1; shade = 0.75 + 0.5 * clamp(dot(normalize(q + 1e-5), vec2(-0.6, 0.7)) * 0.5 + 0.5, 0.0, 1.0); }
    }
  } else {
    // slab: bars along x (lines) and along z (dots), top and bottom mats
    for (int k = 0; k < 2; k++) {
      float yl = k == 0 ? a + cv : b - cv;
      float dl = abs(p.y - yl);
      float line = 1.0 - smoothstep(r * 0.85, r, dl);
      if (line > cov) { cov = line; shade = 0.8 + 0.35 * (1.0 - dl / r) + 0.15 * sin(p.x * 260.0); }
      float yd = k == 0 ? a + cv + 0.021 : b - cv - 0.021;
      vec2 q = vec2(mod(p.x + 0.07, 0.2) - 0.1, p.y - yd);
      float dot1 = 1.0 - smoothstep(r * 0.85, r, length(q));
      if (dot1 > cov) { cov = dot1; shade = 0.75 + 0.5 * clamp(dot(normalize(q + 1e-5), vec2(-0.6, 0.7)) * 0.5 + 0.5, 0.0, 1.0); }
    }
  }
  return cov * aaF(25.0) + (1.0 - aaF(25.0)) * 0.0;
}
bool isSection(vec3 p, vec3 n){ return n.z > 0.9 && p.z > -0.004; }
vec3 aggregate(vec2 q, out float h){
  vec3 paste = s2l(vec3(0.6, 0.585, 0.55)) * (0.9 + 0.14 * vnoise(q * 40.0) * aaF(40.0)) * (0.92 + 0.1 * fbm(q * 6.0));
  // coarse aggregate: angular grey / beige / brown stones
  vec3 v = voro(q * 38.0);
  float rr = 0.33 + 0.14 * fract(v.z * 7.1);
  float st = (1.0 - smoothstep(rr - 0.06, rr, v.x)) * step(0.22, v.z) * aaF(38.0);
  vec3 sc = mix(s2l(vec3(0.42, 0.41, 0.4)), s2l(vec3(0.64, 0.57, 0.48)), fract(v.z * 3.3));
  sc = mix(sc, s2l(vec3(0.3, 0.29, 0.29)), step(0.75, fract(v.z * 5.9)));
  sc = mix(sc, s2l(vec3(0.55, 0.42, 0.33)), step(0.88, fract(v.z * 9.7)));
  sc *= 0.85 + 0.25 * vnoise(q * 160.0) * aaF(160.0);
  vec3 c = mix(paste, sc, st * 0.9);
  // fine sand speckle and a few air voids
  c *= 0.93 + 0.12 * (h21(floor(q * 900.0)) - 0.5) * aaF(450.0);
  vec4 vv = cellv(q * 22.0);
  float vd = (1.0 - smoothstep(0.06, 0.1, vv.z)) * step(0.93, vv.w) * aaF(22.0);
  c *= 1.0 - 0.55 * vd;
  h = 0.0006 * st - 0.0012 * vd;
  return c;
}
vec3 formFace(vec3 p, vec3 n, out float h){
  vec2 uv = puv(p, n);
  vec3 c = s2l(vec3(0.63, 0.62, 0.59));
  h = 0.0;
  if (n.y > 0.6) {
    // a slab top: broom finish across x, a little weathering
    float br = vnoise(vec2(p.x * 3.0, p.z * 220.0)) * aaF(220.0);
    c *= 0.93 + 0.1 * br + 0.12 * (fbm(p.xz * 1.6) - 0.5);
    h = 0.0004 * br;
  } else {
    // plywood formwork panels 1.2 x 0.6 m: joint fins, tie holes, faint grain
    vec2 pan = uv / vec2(1.2, 0.6);
    vec2 f = fract(pan), pid = floor(pan);
    float jd = min(min(f.x, 1.0 - f.x) * 1.2, min(f.y, 1.0 - f.y) * 0.6);
    float joint = (1.0 - smoothstep(0.0015, 0.005, jd)) * aaF(3.0);
    vec2 tq = (fract(pan * vec2(2.0, 1.0) + vec2(0.5, 0.5)) - 0.5) * vec2(0.6, 0.6);
    float tie = (1.0 - smoothstep(0.008, 0.012, length(tq))) * aaF(6.0);
    c *= 0.92 + 0.1 * h21(pid) + 0.05 * (vnoise(vec2(uv.x * 2.0, uv.y * 40.0)) - 0.5) * aaF(40.0);
    c *= 1.0 + 0.06 * joint;
    c *= 1.0 - 0.5 * tie;
    h = 0.0012 * joint - 0.004 * tie;
  }
  // mottling, pores (bug holes), faint water stains running down
  c *= 0.9 + 0.16 * fbm(uv * 2.5 + 3.0);
  vec4 pr = cellv(uv * 45.0);
  float pore = (1.0 - smoothstep(0.08, 0.14, pr.z)) * step(0.86, pr.w) * aaF(45.0);
  c *= 1.0 - 0.4 * pore;
  h -= 0.001 * pore;
  c *= 1.0 - 0.08 * smoothstep(0.6, 0.85, fbm(vec2(uv.x * 4.0, uv.y * 0.4) + 5.0)) * step(n.y, 0.6);
  return c;
}
vec3 concreteColor(vec3 p, vec3 n){
  float h, sh;
  if (isSection(p, n)) {
    vec3 c = aggregate(p.xy, h);
    float b = bars(p.xy, sh);
    vec3 steel = s2l(vec3(0.5, 0.5, 0.52)) * sh;
    return mix(c, steel, b);
  }
  return formFace(p, n, h) * mix(1.0, 0.7, uWet * step(0.6, n.y));
}
float concreteBump(vec3 p, vec3 n){ float h, sh; if (isSection(p, n)) { aggregate(p.xy, h); return h; } formFace(p, n, h); return h; }
float concreteRough(vec3 p, vec3 n){ float sh; if (isSection(p, n)) return mix(0.88, 0.35, bars(p.xy, sh)); return mix(0.86, 0.45, uWet * step(0.6, n.y)); }
float concreteMetal(vec3 p, vec3 n){ float sh; if (isSection(p, n)) return 0.85 * bars(p.xy, sh); return 0.0; }
vec3 concreteGlow(vec3 p, vec3 n, vec3 alb){ float sh; if (uElem.w <= 0.0 || !isSection(p, n)) return vec3(0.0); return vec3(1.6, 0.75, 0.2) * uElem.w * bars(p.xy, sh); }
`;
export function concreteMaterial(elem) {
  const uniforms = { uElem: { value: elem }, uWet: { value: 0 } };
  return patch(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 }), {
    uniforms, colorFn: 'concreteColor', bumpFn: 'concreteBump', roughFn: 'concreteRough', metalFn: 'concreteMetal', emissiveFn: 'concreteGlow',
    extraFrag: GLSL_CONCRETE, key: 'concrete',
  });
}

// ---------------------------------------------------------------------------
// steel kit: ribbed rebar with rust, galvanised pipe, painted steel with wear,
// diamond tread plate
// ---------------------------------------------------------------------------
export function rebarMaterial() {
  return patch(new THREE.MeshStandardMaterial({ color: col('#6a6560'), roughness: 0.62, metalness: 0.75 }), {
    key: 'rebar', colorFn: 'rbC', roughFn: 'rbR', metalFn: 'rbM',
    extraFrag: `float rust(vec3 p){ return smoothstep(0.5, 0.75, fbm3(p * 9.0) * 0.8 + 0.25 * vnoise3(p * 41.0)); }
      vec3 rbC(vec3 p, vec3 n){ float r = rust(p); return mix(vec3(0.95 + 0.1 * vnoise3(p * 60.0)), vec3(1.25, 0.62, 0.32), r); }
      float rbR(vec3 p, vec3 n){ return mix(0.55, 0.9, rust(p)); }
      float rbM(vec3 p, vec3 n){ return mix(0.8, 0.15, rust(p)); }`,
  });
}
export function galvMaterial(key = 'galv', hex = '#a9aeb2') {
  return patch(new THREE.MeshStandardMaterial({ color: col(hex), roughness: 0.42, metalness: 0.9 }), {
    key, colorFn: key + 'C', roughFn: key + 'R',
    extraFrag: `vec3 ${key}C(vec3 p, vec3 n){ vec4 sp = cellv(p.xy * 26.0 + p.z * 13.0); return vec3(0.9 + 0.16 * sp.w * aaF(26.0)) * (0.92 + 0.12 * fbm3(p * 6.0)); }
      float ${key}R(vec3 p, vec3 n){ vec4 sp = cellv(p.xy * 26.0 + p.z * 13.0); return 0.32 + 0.22 * sp.w * aaF(26.0) + 0.15 * fbm3(p * 4.0); }`,
  });
}
// painted steel: a dark green-grey coat, worn to bare metal on edges and scuffs
export function paintedSteel(key, hex = '#4a524c') {
  return patch(new THREE.MeshStandardMaterial({ color: col(hex), roughness: 0.5, metalness: 0.2 }), {
    key, colorFn: key + 'C', roughFn: key + 'R', metalFn: key + 'M', bumpFn: key + 'B',
    extraFrag: `float ${key}W(vec3 p){ return smoothstep(0.62, 0.78, fbm3(p * 7.0) * 0.75 + 0.3 * vnoise3(p * 37.0)); }
      vec3 ${key}C(vec3 p, vec3 n){ float w = ${key}W(p); return mix(vec3(0.93 + 0.1 * fbm3(p * 20.0)), vec3(1.55, 1.5, 1.45), w); }
      float ${key}R(vec3 p, vec3 n){ return mix(0.48 + 0.12 * fbm3(p * 9.0), 0.35, ${key}W(p)); }
      float ${key}M(vec3 p, vec3 n){ return mix(0.15, 0.9, ${key}W(p)); }
      float ${key}B(vec3 p, vec3 n){ return 0.0003 * vnoise3(p * 140.0) * aaF(140.0); }`,
  });
}

// ---------------------------------------------------------------------------
// weathered wood: boards with grain, knots, grey sun-bleaching
// along: GLSL expression giving vec2(u along the grain, v across the boards)
// ---------------------------------------------------------------------------
export const GLSL_WOOD = /* glsl */ `
vec3 woodGrain(float u, float v, float bw, float seed, out float h){
  float bi = floor(v / bw), fv = fract(v / bw);
  float id = h21(vec2(bi, seed));
  float sd = min(fv, 1.0 - fv) * bw;
  float seam = (1.0 - smoothstep(0.0, 0.004, sd)) * aaF(1.0 / max(bw, 0.02));
  float vv = v * 1.0 + id * 13.0;
  // growth rings stretched along the grain, wobbled
  float ring = fract((vv * 38.0 + fbm(vec2(u * 0.9 + id * 7.0, vv * 6.0)) * 6.0));
  float rl = smoothstep(0.0, 0.25, ring) * (1.0 - smoothstep(0.55, 1.0, ring));
  float fine = vnoise(vec2(u * 2.0 + id * 5.0, vv * 160.0)) * aaF(160.0);
  // knots
  vec2 kq = vec2(fract(u / 0.9 + id) - 0.5, (fv - 0.5) * bw / 0.9);
  float kn = (1.0 - smoothstep(0.012, 0.03, length(kq * vec2(0.9, 1.6)))) * step(0.55, h21(vec2(floor(u / 0.9 + id), bi)));
  vec3 c = vec3(0.85 + 0.25 * id) * (0.82 + 0.2 * rl * aaF(38.0) + 0.1 * (1.0 - aaF(38.0))) * (0.92 + 0.12 * fine);
  c *= 1.0 - 0.45 * kn;
  c *= 1.0 - 0.55 * seam;
  h = -0.0025 * seam + 0.0004 * rl * aaF(38.0) + 0.0003 * fine - 0.001 * kn;
  return c;
}
`;
export function woodMaterial(key, hex, along, bw = 0.14, rough = 0.8) {
  return patch(new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: 0 }), {
    key, colorFn: key + 'C', bumpFn: key + 'B',
    extraFrag: `${GLSL_WOOD}
      vec2 ${key}UV(vec3 p, vec3 n){ return ${along}; }
      vec3 ${key}C(vec3 p, vec3 n){ float h; vec2 uv = ${key}UV(p, n); return woodGrain(uv.x, uv.y, ${bw.toFixed(3)}, 3.0, h) * (0.9 + 0.15 * fbm(p.xz * 0.7 + p.y)); }
      float ${key}B(vec3 p, vec3 n){ float h; vec2 uv = ${key}UV(p, n); woodGrain(uv.x, uv.y, ${bw.toFixed(3)}, 3.0, h); return h; }`,
  });
}

export const std = (hex, rough = 0.7, metal = 0, extra = {}) => new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });
