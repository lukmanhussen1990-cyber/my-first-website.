import * as THREE from 'three';

// sRGB hex -> linear THREE.Color
export const col = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------------------
// GLSL helpers shared by the procedural materials. All patterns are computed
// in world space so neighbouring meshes (lawn blocks, the turf roof, the pit
// fill) line up perfectly.
// ---------------------------------------------------------------------------
const GLSL_VARY = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNrm;
`;
const GLSL_COMMON = /* glsl */ `
float h21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h21(i),h21(i+vec2(1.,0.)),u.x), mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),u.x), u.y); }
float fbm(vec2 p){ float s=0., a=0.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.3); a*=0.5;} return s/0.9375; }
// nearest feature point: xy = vector to it, z = distance, w = cell id hash
vec4 cellv(vec2 p){ vec2 i=floor(p), f=fract(p); float d=8.; vec2 rv=vec2(0.); float id=0.;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y));
    vec2 o=vec2(h21(i+g), h21(i+g+17.31))*0.85+0.075; vec2 r=g+o-f; float dd=dot(r,r);
    if(dd<d){ d=dd; rv=r; id=h21(i+g+3.17);} }
  return vec4(rv, sqrt(d), id); }
vec3 s2l(vec3 c){ return pow(c, vec3(2.2)); }
`;

const GLSL_GROUND = /* glsl */ `
uniform float uTopY;   // lawn level of this object (top of the grass)
uniform float uMode;   // 0 ground, 1 loose dirt, 2 turf roof
uniform float uGrow;   // turf coverage 0..1
uniform float uWet;    // darkening when wet
#ifdef USE_BAKE
uniform sampler2D uFrontTex; uniform vec4 uFrontRect;
uniform sampler2D uLawnTex;  uniform vec4 uLawnRect;
#endif
vec3 lawnColor(vec2 xz){
  float s = step(0.5, fract(xz.x / 2.4));
  vec3 light = s2l(vec3(0.56, 0.76, 0.33));
  vec3 dark  = s2l(vec3(0.41, 0.62, 0.25));
  vec3 c = mix(dark, light, s);
  c *= 0.88 + 0.24 * fbm(xz * 0.55);
  c *= 0.9 + 0.2 * (vnoise(xz * 23.0) * 0.5 + vnoise(xz * 41.0) * 0.5);
  return c;
}
vec3 lawnLookup(vec2 xz){
#ifdef USE_BAKE
  vec2 uv = (xz - uLawnRect.xy) / (uLawnRect.zw - uLawnRect.xy);
  if (uv.x > 0.001 && uv.y > 0.001 && uv.x < 0.999 && uv.y < 0.999) return texture2D(uLawnTex, uv).rgb;
#endif
  return lawnColor(xz);
}
vec3 dirtTop(vec2 xz){
  float n = fbm(xz * 2.2);
  vec3 c = mix(s2l(vec3(0.47,0.31,0.18)), s2l(vec3(0.6,0.41,0.25)), n);
  c *= 0.8 + 0.4 * vnoise(xz * 19.0);
  vec4 ce = cellv(xz * 4.0);
  if (ce.w > 0.8) c = mix(c, s2l(vec3(0.33,0.21,0.12)), 1.0 - smoothstep(0.18, 0.3, ce.z));
  return c;
}
vec3 soilSide(vec2 uv, float d){
  float j = (vnoise(uv * vec2(5.0, 1.0)) - 0.5) * 0.07 + (vnoise(uv * vec2(19.0, 3.0)) - 0.5) * 0.03;
  float dd = d + j;
  vec3 grass = s2l(vec3(0.38,0.62,0.20));
  vec3 roots = s2l(vec3(0.31,0.21,0.12));
  vec3 top   = s2l(vec3(0.42,0.27,0.16));
  vec3 mid   = s2l(vec3(0.58,0.38,0.22));
  vec3 deep  = s2l(vec3(0.52,0.33,0.19));
  vec3 clay  = s2l(vec3(0.64,0.45,0.28));
  vec3 loam  = s2l(vec3(0.55,0.35,0.2));
  vec3 rust  = s2l(vec3(0.56,0.33,0.19));
  vec3 ochre = s2l(vec3(0.63,0.47,0.29));
  vec3 base  = s2l(vec3(0.46,0.36,0.28));
  vec3 c;
  float b = dd + (fbm(uv * vec2(0.45, 1.6)) - 0.5) * 0.7;
  if (dd < 0.11) c = mix(grass, grass * 0.62, smoothstep(0.0, 0.11, dd));
  else if (dd < 0.5) c = mix(roots, top, smoothstep(0.11, 0.5, dd));
  else {
    // cake-like strata with soft edges and a thin dark line on each boundary
    c = mix(top, loam, smoothstep(0.45, 1.0, b));
    c = mix(c, mid, smoothstep(1.5, 1.9, b));
    c = mix(c, rust, smoothstep(3.7, 4.1, b));
    c = mix(c, ochre, smoothstep(5.4, 5.8, b));
    c = mix(c, base, smoothstep(7.0, 7.5, b));
    float line = 0.0;
    for (int k = 0; k < 4; k++) {
      float edge = k == 0 ? 1.7 : k == 1 ? 3.9 : k == 2 ? 5.6 : 7.25;
      line = max(line, 1.0 - smoothstep(0.0, 0.05, abs(b - edge)));
    }
    c *= 1.0 - 0.16 * line;
    c = mix(c, deep, 0.25 * smoothstep(2.4, 3.2, b) * (1.0 - smoothstep(3.6, 4.0, b)));
  }
  c *= 0.84 + 0.32 * fbm(uv * 3.1);
  c *= 0.92 + 0.16 * vnoise(uv * 27.0);
  // darker specks + a few small stones
  float sp = step(0.86, vnoise(uv * 41.0)) * 0.22;
  c *= 1.0 - sp;
  if (dd > 0.6) {
    vec4 ce = cellv(uv * 2.6);
    float r = 0.06 + 0.1 * fract(ce.w * 5.7);
    float pb = 1.0 - smoothstep(r - 0.03, r, ce.z);
    if (ce.w > 0.86) {
      vec3 pc = mix(s2l(vec3(0.46,0.40,0.34)), s2l(vec3(0.62,0.55,0.47)), fract(ce.w * 7.3));
      pc *= 0.8 + 0.35 * smoothstep(r, 0.0, length(ce.xy + vec2(0.03, -0.04)));
      c = mix(c, pc, pb);
    }
  }
  return c;
}
vec3 groundColor(vec3 p, vec3 n){
  float d = uTopY - p.y;
#ifdef USE_BAKE
  if (uMode < 0.5 && n.z > 0.5 && abs(p.z) < 0.03) {
    vec2 uv = (p.xy - uFrontRect.xy) / (uFrontRect.zw - uFrontRect.xy);
    if (uv.x > 0.001 && uv.y > 0.001 && uv.x < 0.999 && uv.y < 0.999) return texture2D(uFrontTex, uv).rgb;
  }
#endif
  vec2 uv = abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y);
  if (uMode > 0.5 && uMode < 1.5) {
    return n.y > 0.45 ? dirtTop(p.xz) : soilSide(uv + vec2(3.7, 0.0), 1.2 + abs(d) * 0.3);
  }
  if (uMode > 1.5) {
    float m = smoothstep(0.0, 0.18, uGrow * 1.25 - fbm(p.xz * 1.6) * 0.95);
    if (n.y > 0.45) return mix(dirtTop(p.xz), lawnLookup(p.xz), m);
    vec3 sc = soilSide(uv, d);
    return mix(soilSide(uv, d + 0.3), sc, m);
  }
  if (n.y > 0.45) return d < 0.06 ? lawnLookup(p.xz) : dirtTop(p.xz);
  if (n.y < -0.5) return s2l(vec3(0.30,0.19,0.11));
  return soilSide(uv, d);
}
`;

const GLSL_CONCRETE = /* glsl */ `
vec3 concreteColor(vec3 p, vec3 n){
  vec2 uv = abs(n.y) > 0.5 ? p.xz : (abs(n.x) > 0.5 ? p.zy : p.xy);
  vec3 c = s2l(vec3(0.66, 0.65, 0.62));
  c *= 0.9 + 0.13 * fbm(uv * 2.3);
  c *= 0.95 + 0.08 * vnoise(uv * 31.0);
  float pore = step(0.94, h21(floor(uv * 85.0)));
  c *= 1.0 - 0.22 * pore;
  return c;
}
`;


// Dig-time field over the cut face (see world.js): a point of the tunnel is
// open once uTime has passed its dig time.
const GLSL_DIG = /* glsl */ `
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
  a += dug(p + vec2(0.0, 0.24)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.12, 0.05)) ? 1.0 : 0.0;
  a += dug(p + vec2(-0.12, 0.05)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.26, 0.14)) ? 1.0 : 0.0;
  a += dug(p + vec2(-0.26, 0.14)) ? 1.0 : 0.0;
  a += dug(p + vec2(0.0, -0.09)) ? 1.0 : 0.0;
  return a / 7.0;
}
`;

// Running-bond brickwork in world space (boundary wall, pilasters)
const GLSL_BRICK = /* glsl */ `
vec3 brickColor(vec3 p, vec3 n){
  vec2 uv = abs(n.x) > 0.5 ? vec2(p.z, p.y) : (abs(n.z) > 0.5 ? vec2(p.x, p.y) : vec2(p.x, p.z) * vec2(1.0, 3.0));
  vec2 bs = vec2(0.30, 0.10);
  float row = floor(uv.y / bs.y);
  vec2 cell = vec2(uv.x / bs.x + mod(row, 2.0) * 0.5, uv.y / bs.y);
  vec2 id = floor(cell), f = fract(cell);
  float edge = min(min(f.x, 1.0 - f.x) * bs.x, min(f.y, 1.0 - f.y) * bs.y);
  float mortar = 1.0 - smoothstep(0.005, 0.011, edge);
  float h = h21(id + vec2(31.7, 7.0));
  vec3 brick = mix(s2l(vec3(0.62, 0.27, 0.18)), s2l(vec3(0.76, 0.38, 0.25)), h);
  brick = mix(brick, s2l(vec3(0.50, 0.22, 0.16)), step(0.86, h21(id + 3.1)) * 0.7);
  brick *= 0.86 + 0.22 * vnoise(uv * 37.0 + id);
  brick *= 0.92 + 0.1 * smoothstep(0.0, 0.03, edge); // soft bevel
  return mix(brick, s2l(vec3(0.78, 0.74, 0.67)) * 0.85, mortar);
}
`;

// Inside of the tunnel: hand-dug soil with scoop marks
const GLSL_TUNNEL = /* glsl */ `
vec3 tunnelColor(vec3 p, vec3 n){
  vec2 uv = abs(n.y) > 0.5 ? p.xz : p.xy;
  vec3 c = mix(s2l(vec3(0.36, 0.23, 0.14)), s2l(vec3(0.48, 0.31, 0.19)), fbm(uv * 2.6));
  c *= 0.84 + 0.26 * vnoise(uv * 17.0);
  vec4 ce = cellv(uv * vec2(2.4, 3.6));
  c *= 0.86 + 0.16 * smoothstep(0.15, 0.55, ce.z);
  float sp = step(0.88, vnoise(uv * 43.0)) * 0.2;
  return c * (1.0 - sp);
}
vec3 floorColor(vec3 p, vec3 n){
  vec3 c = mix(s2l(vec3(0.45, 0.30, 0.18)), s2l(vec3(0.58, 0.40, 0.25)), fbm(p.xz * 3.1 + p.y));
  c *= 0.85 + 0.25 * vnoise(p.xz * 21.0 + p.y * 3.0);
  return c;
}
// turf and roots along the top of the shafts, matching the cut face's top band
vec3 turfBand(vec3 p, vec3 n, vec3 c){
  if (p.y < -0.65) return c;
  float u = abs(n.x) > 0.5 ? p.z : p.x;
  float d = -p.y + (vnoise(vec2(u * 6.0, 2.7)) - 0.5) * 0.05 + (vnoise(vec2(u * 21.0, 5.3)) - 0.5) * 0.025;
  vec3 grass = s2l(vec3(0.38, 0.62, 0.20));
  if (d < 0.09) return mix(grass, grass * 0.55, smoothstep(0.0, 0.09, d));
  vec3 roots = s2l(vec3(0.30, 0.20, 0.12)) * (0.8 + 0.4 * vnoise(vec2(u * 37.0, p.y * 19.0)));
  vec3 r = mix(roots, c, smoothstep(0.12, 0.5, d));
  // a few pale root threads hanging into the hole
  float th = smoothstep(0.8, 0.93, vnoise(vec2(u * 55.0, 0.3))) * (1.0 - smoothstep(0.1, 0.18 + 0.4 * vnoise(vec2(u * 13.0, 7.0)), d));
  return mix(r, s2l(vec3(0.6, 0.47, 0.33)), th * 0.75);
}
`;

function patch(mat, { uniforms = {}, colorFn, defines = '', extraFrag = '', perturb = '', discard = '', selfLit = null }) {
  if (selfLit) uniforms = { ...uniforms, uSelfLit: selfLit };
  mat.userData.uniforms = uniforms;
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
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${defines}\n${GLSL_VARY}\n${GLSL_COMMON}\n${extraFrag}`)
      .replace('#include <color_fragment>', colorFn ? `#include <color_fragment>\n diffuseColor.rgb *= ${colorFn}(vWPos, normalize(vWNrm));` : '#include <color_fragment>');
    if (discard) shader.fragmentShader = shader.fragmentShader.replace('void main() {', `void main() {\n if (${discard}) discard;`);
    if (selfLit) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSelfLit;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uSelfLit;');
    }
    if (perturb) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n ${perturb}`
      );
    }
  };
  // make each patched material compile into its own program variant
  mat.customProgramCacheKey = () => colorFn + (perturb ? 'p' : '') + defines + discard + (selfLit ? 's' : '');
  return mat;
}

// Shadow-map material that drops the same fragments as its colour material
function maskedDepth(uniforms, extraFrag, discard) {
  const d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  d.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * normal);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_VARY}\n${GLSL_COMMON}\n${extraFrag}`)
      .replace('void main() {', `void main() {\n if (${discard}) discard;`);
  };
  d.customProgramCacheKey = () => 'depth' + discard;
  return d;
}

// bake = { frontTex, frontRect: Vector4(x0,y0,x1,y1), lawnTex, lawnRect: Vector4(x0,z0,x1,z1) }
export function groundMaterial({ topY = 0, mode = 0, grow = 1, bake = null } = {}) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const uniforms = {
    uTopY: { value: topY },
    uMode: { value: mode },
    uGrow: { value: grow },
    uWet: { value: 0 },
  };
  if (bake) {
    uniforms.uFrontTex = { value: bake.frontTex };
    uniforms.uFrontRect = { value: bake.frontRect };
    uniforms.uLawnTex = { value: bake.lawnTex };
    uniforms.uLawnRect = { value: bake.lawnRect };
  }
  return patch(mat, {
    uniforms,
    colorFn: 'groundColor',
    extraFrag: GLSL_GROUND,
    defines: bake ? '#define USE_BAKE' : '',
  });
}

// Bake the static ground colours (soil cut face at z=0 and the lawn top) into
// half-float textures once, so the frame shader only does a texture fetch.
export function bakeGround(renderer, FullScreenQuad) {
  const make = (w, h, kind, rect) => {
    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const q = new FullScreenQuad(
      new THREE.ShaderMaterial({
        uniforms: { uTopY: { value: 0 }, uMode: { value: 0 }, uGrow: { value: 1 }, uWet: { value: 0 }, uRect: { value: rect }, uKind: { value: kind } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
        fragmentShader: `${GLSL_COMMON}\n${GLSL_GROUND}\nuniform vec4 uRect; uniform float uKind; varying vec2 vUv;
          void main(){ vec2 q = mix(uRect.xy, uRect.zw, vUv);
            vec3 c = uKind < 0.5 ? groundColor(vec3(q.x, q.y, 0.0), vec3(0.0, 0.0, 1.0)) : lawnColor(q);
            gl_FragColor = vec4(c, 1.0); }`,
      })
    );
    renderer.setRenderTarget(rt);
    q.render(renderer);
    renderer.setRenderTarget(null);
    q.material.dispose();
    return rt.texture;
  };
  const frontRect = new THREE.Vector4(-4.75, -7.9, 4.75, 0.12);
  const lawnRect = new THREE.Vector4(-14.0, -30.0, 14.0, 0.0);
  return {
    frontTex: make(2432, 2053, 0, frontRect), // 256 px per metre (sharp in the close-up)
    frontRect,
    lawnTex: make(2800, 3000, 1, lawnRect), // 100 px per metre
    lawnRect,
  };
}

// --- masked tunnel surfaces --------------------------------------------------
// dig = { tex, rect: Vector4(x0,y0,x1,y1) }; all of them share uTime
export const digTime = { value: 0 };
export const tunnelGlow = { value: 0.3 };
const digUniforms = (dig) => ({ uDig: { value: dig.tex }, uDigRect: { value: dig.rect }, uTime: digTime });

// soil cut face: baked strata, holes wherever the tunnel is open
export function soilFrontMaterial(bake, dig) {
  const uniforms = { ...digUniforms(dig), uFrontTex: { value: bake.frontTex }, uFrontRect: { value: bake.frontRect } };
  const frag = `${GLSL_DIG}\nuniform sampler2D uFrontTex; uniform vec4 uFrontRect;
    vec3 frontColor(vec3 p, vec3 n){ return texture2D(uFrontTex, (p.xy - uFrontRect.xy) / (uFrontRect.zw - uFrontRect.xy)).rgb; }`;
  const discard = 'dug(vWPos.xy)';
  const m = patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { uniforms, colorFn: 'frontColor', extraFrag: frag, discard });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// back wall of the tunnel (z = -W): only where it is open
export function tunnelBackMaterial(dig) {
  const uniforms = digUniforms(dig);
  // (the shafts' dig field reaches above the lawn so the openings stay clean; the wall stops at the lawn)
  const discard = '!dug(vWPos.xy) || vWPos.y > 0.0';
  const frag = GLSL_DIG + GLSL_TUNNEL + 'vec3 backColor(vec3 p, vec3 n){ return turfBand(p, n, tunnelColor(p, n) * mix(0.32, 1.0, digAO(p.xy))); }';
  const m = patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { uniforms, colorFn: 'backColor', extraFrag: frag, discard, selfLit: tunnelGlow });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// floors, dig faces and side walls: drawn where they bound the open tunnel
// (open on the side the normal points to, still solid behind)
export function tunnelBoundaryMaterial(dig, colorFn = 'floorColor') {
  const uniforms = digUniforms(dig);
  const discard = '!(dug(vWPos.xy + normalize(vWNrm.xy + vec2(1e-5)) * 0.035) && !dug(vWPos.xy - normalize(vWNrm.xy + vec2(1e-5)) * 0.035))';
  const frag = GLSL_DIG + GLSL_TUNNEL + `vec3 bColor(vec3 p, vec3 n){ return turfBand(p, n, ${colorFn}(p, n) * mix(0.45, 1.0, digAO(p.xy + n.xy * 0.05))); }`;
  const m = patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { uniforms, colorFn: 'bColor', extraFrag: frag, discard, selfLit: tunnelGlow });
  m.userData.depth = maskedDepth(uniforms, GLSL_DIG, discard);
  return m;
}
// dark soil just behind the tunnel's back wall: rays slipping through hairline
// seams between the masked tunnel surfaces land on soil instead of the sky
export function seamMaterial() {
  const frag = GLSL_TUNNEL + 'vec3 seamColor(vec3 p, vec3 n){ return tunnelColor(p, n) * 0.5; }';
  return patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { colorFn: 'seamColor', extraFrag: frag, selfLit: tunnelGlow });
}
// lawn with the shaft opening and the hatch hole
export function lawnMaterial(bake, holes) {
  const uniforms = { uLawnTex: { value: bake.lawnTex }, uLawnRect: { value: bake.lawnRect }, uTime: digTime, uShaft: { value: holes.shaft }, uHatch: { value: holes.hatch }, uOpen: { value: holes.open } };
  const frag = `uniform sampler2D uLawnTex; uniform vec4 uLawnRect; uniform float uTime; uniform vec4 uShaft; uniform vec3 uHatch; uniform vec2 uOpen;
    vec3 lawnTop(vec3 p, vec3 n){
      vec3 c = texture2D(uLawnTex, (p.xz - uLawnRect.xy) / (uLawnRect.zw - uLawnRect.xy)).rgb;
      // loose dirt spilled round the shaft opening (it builds up as the digging starts)
      vec2 q = vec2(max(uShaft.x - p.x, p.x - uShaft.y), uShaft.z - p.z);
      float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
      float k = smoothstep(uOpen.x, uOpen.x + 1.4, uTime);
      if (k > 0.0 && d < 0.4) {
        float w = (0.07 + 0.14 * k) * (0.75 + 0.5 * vnoise(p.xz * 9.0)) + 0.05 * (vnoise(p.xz * 31.0) - 0.5);
        float m = 1.0 - smoothstep(w - 0.02, w + 0.02, d);
        vec3 dirt = mix(s2l(vec3(0.47, 0.31, 0.18)), s2l(vec3(0.62, 0.43, 0.27)), vnoise(p.xz * 17.0));
        dirt *= 0.82 + 0.3 * vnoise(p.xz * 43.0);
        c *= 1.0 - 0.28 * k * (1.0 - smoothstep(0.0, 0.32, d)); // trampled, shaded grass round the hole
        c = mix(c, dirt, m * smoothstep(0.0, 0.25, k));
        // a few crumbs scattered further out
        vec4 ce = cellv(p.xz * 11.0);
        if (ce.w > 0.7 && d < 0.38 * k) c = mix(c, dirt * 0.85, (1.0 - smoothstep(0.05, 0.09, ce.z)) * k);
      }
      return c;
    }
    bool hole(vec3 p){
      if (uTime >= uOpen.x && p.x > uShaft.x && p.x < uShaft.y && p.z > uShaft.z && p.z < uShaft.w) return true;
      return uTime >= uOpen.y && length(p.xz - uHatch.xy) < uHatch.z;
    }`;
  const discard = 'hole(vWPos)';
  const m = patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { uniforms, colorFn: 'lawnTop', extraFrag: frag, discard });
  m.userData.depth = maskedDepth(uniforms, frag, discard);
  return m;
}
export function brickMaterial() {
  return patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { colorFn: 'brickColor', extraFrag: GLSL_BRICK });
}
export function tunnelWallMaterial() {
  return patch(new THREE.MeshLambertMaterial({ color: 0xffffff }), { colorFn: 'tunnelColor', extraFrag: GLSL_TUNNEL });
}

export function concreteMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  return patch(mat, { colorFn: 'concreteColor', extraFrag: GLSL_CONCRETE });
}

// Roof tiles: rows of rounded clay tiles driven by the geometry UVs
// (u along the eave in metres, v up the slope in metres).
export function roofTileMaterial(base = [0.74, 0.25, 0.14], key = 'red') {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTileUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvTileUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec2 vTileUv;\nfloat th(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }\nvec3 tPert;`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 t = vTileUv / vec2(0.34, 0.30);
          float row = floor(t.y);
          t.x += mod(row, 2.0) * 0.5;
          vec2 f = fract(t);
          vec2 id = vec2(floor(t.x), row);
          float var = th(id);
          vec3 base = pow(vec3(${base.join(', ')}), vec3(2.2)) * (0.82 + 0.3 * var);
          float curve = sin(f.x * 3.14159);
          float shade = 0.62 + 0.38 * curve;
          float lip = smoothstep(0.0, 0.16, f.y);
          diffuseColor.rgb *= base * shade * mix(0.45, 1.0, lip);
          tPert = vec3(cos(f.x * 3.14159) * 0.55, 0.0, 0.0);
        }`
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\n normal = normalize(normal + tPert * 0.6);'
      );
  };
  mat.customProgramCacheKey = () => 'rooftiles' + key;
  return mat;
}

// House walls: smooth sand render (beige house) or lap siding (green house),
// weathered: faint streaks, splash-back at the bottom, shadow under the eaves
const GLSL_HOUSE = /* glsl */ `
vec3 houseWall(vec3 p, vec3 n){
  vec2 uv = abs(n.x) > 0.5 ? p.zy : p.xy;
  float c = 1.0;
#ifdef SIDING
  float f = fract(uv.y / 0.15);
  c *= mix(0.72, 1.0, smoothstep(0.0, 0.16, f)) * (1.0 - 0.07 * f);
  c *= 0.95 + 0.08 * vnoise(vec2(uv.x * 0.7, floor(uv.y / 0.15) * 7.3));
  c *= 0.97 + 0.05 * vnoise(vec2(uv.x * 26.0, uv.y * 3.0));
#else
  c *= 0.95 + 0.08 * fbm(uv * 2.2);
  c *= 0.97 + 0.06 * vnoise(uv * 47.0);
#endif
  c *= 1.0 - 0.07 * smoothstep(0.6, 0.95, vnoise(vec2(uv.x * 2.7, uv.y * 0.25)));
  c *= mix(0.83, 1.0, smoothstep(0.3, 1.1, p.y));
  c *= mix(1.0, 0.85, smoothstep(3.9, 4.58, p.y));
  return vec3(c);
}
vec3 paver(vec3 p, vec3 n){
  vec2 uv = p.xz / 0.42 + vec2(0.5 * step(0.5, fract(p.z / 0.84)), 0.0);
  vec2 f = fract(uv);
  float e = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  return vec3((0.9 + 0.13 * h21(floor(uv))) * mix(0.72, 1.0, smoothstep(0.0, 0.06, e)) * (0.94 + 0.08 * vnoise(p.xz * 13.0)));
}
vec3 barkColor(vec3 p, vec3 n){
  float s = vnoise(vec2((p.x + p.z) * 15.0, p.y * 1.5)) * 0.6 + vnoise(vec2((p.x - p.z) * 37.0, p.y * 4.0)) * 0.4;
  return vec3(0.7 + 0.42 * smoothstep(0.3, 0.75, s)) * (0.9 + 0.15 * vnoise(p.xy * 3.0)) * mix(0.72, 1.0, smoothstep(0.0, 0.7, p.y));
}
`;
export function houseWallMaterial(hex, siding = false) {
  return patch(new THREE.MeshLambertMaterial({ color: col(hex) }), { colorFn: 'houseWall', extraFrag: GLSL_HOUSE, defines: siding ? '#define SIDING' : '' });
}
export function paverMaterial(hex) {
  return patch(new THREE.MeshLambertMaterial({ color: col(hex) }), { colorFn: 'paver', extraFrag: GLSL_HOUSE });
}
export function barkMaterial(hex) {
  return patch(new THREE.MeshLambertMaterial({ color: col(hex) }), { colorFn: 'barkColor', extraFrag: GLSL_HOUSE });
}

// Foliage: leafy clumps from world-space cell noise (bright clump centres, dark
// gaps, each clump bulging its normal out), per-vertex crown occlusion baked in
// uv.x and a per-cluster hue in uv.y (see shadeFoliage in builders.js)
export function foliageMaterial(hex, key) {
  const mat = new THREE.MeshLambertMaterial({ color: col(hex) });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\nvarying vec2 vFol;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);
        vFol = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_VARY}\nvarying vec2 vFol;\n${GLSL_COMMON}\nvec3 fPert = vec3(0.0);`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 p = vWPos, n = normalize(vWNrm), an = abs(n);
          vec4 cs = an.x > an.z ? cellv(p.zy * 5.0 + 1.7) : cellv(p.xy * 5.0);
          vec4 ct = cellv(p.xz * 5.0 + 4.1);
          float wt = smoothstep(0.35, 0.8, an.y);
          float e = mix(cs.z, ct.z, wt), id = mix(cs.w, ct.w, wt);
          float clump = 1.0 - smoothstep(0.25, 0.66, e);
          float ao = vFol.x;
          vec3 hue = mix(vec3(0.86, 0.96, 0.84), vec3(1.1, 1.04, 0.76), vFol.y);
          vec3 c = hue * (0.82 + 0.26 * id) * mix(0.68, 1.0, clump) * mix(0.38, 1.0, ao);
          c *= mix(vec3(1.0), vec3(1.08, 1.05, 0.84), smoothstep(0.35, 0.95, n.y) * ao);
          diffuseColor.rgb *= c;
          vec3 ps = an.x > an.z ? vec3(0.0, -cs.y, -cs.x) : vec3(-cs.x, -cs.y, 0.0);
          fPert = mix(ps, vec3(-ct.x, 0.0, -ct.y), wt) * 1.5;
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + (viewMatrix * vec4(fPert, 0.0)).xyz);`);
  };
  mat.customProgramCacheKey = () => 'foliage' + key;
  return mat;
}

// puffs (dust, stale air, smoke): fade out towards the silhouette so they read
// as soft clouds rather than solid balls
function softEdges(mat, power = 1.0) {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `{ float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
         diffuseColor.a *= pow(smoothstep(0.0, 0.85, facing), ${power.toFixed(2)}); }
       #include <opaque_fragment>`
    );
  };
  mat.customProgramCacheKey = () => 'soft' + power;
  return mat;
}

export function makeSimpleMats(envMap) {
  const std = (hex, rough = 0.7, metal = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal, ...extra });
  // matte surfaces: Lambert is visually identical at this roughness and much cheaper in software GL
  const mat = (hex, extra = {}) => new THREE.MeshLambertMaterial({ color: col(hex), ...extra });
  const glowMat = (c, opacity = 0) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  return {
    // houses
    wall: houseWallMaterial('#ebdcbd'),
    wallShade: mat('#cfc0a2'),
    trim: mat('#fbfaf6'),
    shutter: mat('#3c6aa8'),
    shutterDark: mat('#2f5690'),
    greenWall: houseWallMaterial('#b9daa2', true),
    room: mat('#3a3330'),
    curtain: mat('#f3a7b5'),
    greenShade: mat('#9fb98c'),
    houseGlass: new THREE.MeshPhysicalMaterial({ color: col('#1d2a3a'), roughness: 0.08, metalness: 0.0, envMap, envMapIntensity: 0.55 }),
    brick: mat('#a35a43'),
    chimneyBrick: brickMaterial(),
    patio: paverMaterial('#cdc6ba'),
    sillStone: mat('#ddd3c2'),
    gutter: mat('#eeede8'),
    curtainCream: mat('#efe4d0'),
    blind: mat('#e4d9c2'),
    doormat: mat('#5b4532'),
    lampGlass: new THREE.MeshLambertMaterial({ color: col('#f6e6bd'), emissive: col('#ffcf7a'), emissiveIntensity: 0.3 }),
    acUnit: mat('#d6d8d5'),
    grille: mat('#3a3d42'),
    hose: mat('#3f8f3a'),
    // garden
    trunk: barkMaterial('#6e5038'),
    leaf: foliageMaterial('#5fa443', 'leaf'),
    leafDark: foliageMaterial('#3f7f35', 'leafDark'),
    hedge: foliageMaterial('#4f9637', 'hedge'),
    flowerPink: mat('#f08bb0'),
    flowerYellow: mat('#f6d04d'),
    flowerWhite: mat('#fbf7ef'),
    flowerRed: mat('#e2483d'),
    farGround: mat('#5f9a3c'),
    tuft: mat('#5c9e33'),
    coping: mat('#d3cbbd'),
    stone: mat('#8b847a'),
    stoneDark: mat('#6f675d'),
    dust: softEdges(new THREE.MeshLambertMaterial({ color: col('#c9b195'), transparent: true, opacity: 0.6, depthWrite: false }), 1.2),
    // tunnel kit
    archBrick: mat('#ffffff'),
    mortar: mat('#c8bfb1'),
    wax: mat('#f3ead6'),
    brass: std('#c9a24a', 0.35, 0.8, { envMap, envMapIntensity: 0.9 }),
    flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.7, 0.35), transparent: true, opacity: 1, depthWrite: false }),
    pvc: std('#a7adb3', 0.45, 0.0, { envMap, envMapIntensity: 0.5 }),
    pvcDark: std('#7d848b', 0.5, 0.0),
    wire: std('#17181b', 0.5, 0.0),
    socket: std('#2a2b2f', 0.4, 0.3),
    bulb: new THREE.MeshStandardMaterial({ color: col('#fff4d6'), roughness: 0.2, metalness: 0, emissive: col('#ffb84a'), emissiveIntensity: 0.0, transparent: true, opacity: 0.92 }),
    steel: new THREE.MeshStandardMaterial({ color: col('#9aa1a8'), roughness: 0.3, metalness: 0.9, envMap, envMapIntensity: 1.1 }),
    sleeper: mat('#7a5536'),
    cartRed: std('#c8242b', 0.42, 0.15, { envMap, envMapIntensity: 0.6 }),
    iron: std('#2b2d31', 0.45, 0.6, { envMap, envMapIntensity: 0.7 }),
    batWood: mat('#ead29c'),
    batGrip: mat('#20201f'),
    lidWood: mat('#8a6440'),
    pot: mat('#c4643a'),
    potDark: mat('#9c4a2a'),
    soilDark: mat('#4a3020'),
    snailShell: mat('#c98a4b'),
    snailShellDark: mat('#8a5a2e'),
    snailBody: mat('#d9c39b'),
    // characters
    skinBoy: mat('#b97a46'),
    skinMom: mat('#a8693a'),
    hair: mat('#17110d'),
    shirt: mat('#2f7fd8'),
    shorts: mat('#3a3f4a'),
    dirtSmudge: new THREE.MeshLambertMaterial({ color: col('#6b4a2e'), transparent: true, opacity: 0.55, depthWrite: false }),
    eyeWhite: mat('#ffffff'),
    pupil: mat('#121212'),
    mouth: mat('#5a1f1a'),
    teeth: mat('#fffaf0'),
    brow: mat('#17110d'),
    girlTop: mat('#f2c94c'),
    ribbon: mat('#e2483d'),
    tongue: mat('#e2747a'),
    momTop: mat('#e4664c'),
    momTopDark: mat('#b84a34'),
    jeans: mat('#3a5687'),
    belt: mat('#3b2a1e'),
    sneaker: mat('#f1f1ee'),
    saree: mat('#c2185b'),
    sareeDark: mat('#9c1249'),
    sareeGold: mat('#e3b341'),
    blouse: mat('#e8b23c'),
    bindi: mat('#d1001f'),
    gold: std('#e3b341', 0.3, 0.9, { envMap, envMapIntensity: 1.0 }),
    slipper: mat('#4a3324'),
    chappalSole: mat('#f2f0ea'),
    chappalStrap: mat('#2f6fd0'),
    slipperStrap: mat('#c9a36d'),
    headband: mat('#26272b'),
    lamp: new THREE.MeshStandardMaterial({ color: col('#fff3c0'), roughness: 0.2, emissive: col('#ffe39a'), emissiveIntensity: 1.6 }),
    sweat: new THREE.MeshPhysicalMaterial({ color: col('#bfe6ff'), roughness: 0.05, transparent: true, opacity: 0.85, envMap, envMapIntensity: 1.2 }),
    // glowing helpers
    loadDot: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 0.95, 0.08) }),
    airDot: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.75, 3.4, 10.0) }),
    stale: softEdges(new THREE.MeshLambertMaterial({ color: col('#a3a7ad'), transparent: true, opacity: 0.32, depthWrite: false }), 1.0),
    smoke: softEdges(new THREE.MeshLambertMaterial({ color: col('#b9bbbe'), transparent: true, opacity: 0.6, depthWrite: false }), 1.0),
    glowWarm: glowMat(new THREE.Color(2.6, 1.45, 0.45)),
    glowCandle: glowMat(new THREE.Color(2.4, 1.2, 0.3)),
    beam: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.9, 0.6), transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  };
}
