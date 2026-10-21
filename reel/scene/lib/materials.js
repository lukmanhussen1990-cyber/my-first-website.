// Procedural materials: GLSL soil / lawn (injected into MeshStandardMaterial so they get
// full PBR lighting + shadows), instanced swaying grass, and canvas-generated textures.
import * as THREE from 'three';
import { mulberry32, makeNoise2D } from './util.js';

export const lin = (hex) => new THREE.Color(hex); // THREE.Color(hex) converts sRGB -> linear working space

export const GLSL_BUMP = /* glsl */`
vec3 bumpN(vec3 surf_pos, vec3 surf_norm, float h, float scale){
  vec3 sx = dFdx(surf_pos), sy = dFdy(surf_pos);
  vec3 R1 = cross(sy, surf_norm), R2 = cross(surf_norm, sx);
  float det = dot(sx, R1);
  if (abs(det) < 1e-14) return surf_norm;
  float dBs = dFdx(h)*scale, dBt = dFdy(h)*scale;
  vec3 grad = sign(det) * (dBs * R1 + dBt * R2);
  vec3 n = abs(det) * surf_norm - grad;
  float l = length(n);
  return l > 1e-14 ? n / l : surf_norm;
}
`;

export const GLSL_NOISE = /* glsl */`
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(h12(i),h12(i+vec2(1,0)),u.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),u.x),u.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s/0.96875; }
float fbm3(vec2 p){ float s=0., a=.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s/0.875; }
vec3 cellN(vec2 p){ vec2 i=floor(p), f=fract(p); float best=8.; float id=0.; vec2 bv=vec2(0.);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(float(x),float(y)); vec2 o=h22(i+g)*0.8+0.1; vec2 r=g+o-f; float d=dot(r,r);
    if(d<best){best=d; id=h12(i+g+17.3);} }
  return vec3(sqrt(best), id, 0.); }
`;

// ---------- shared dynamic uniforms (story drives these) ----------
export const U = {
  uTime: { value: 0 },
  // hole column (x0, x1, zBack) ; open cavity from y=openBottom up to y=0 when open
  uHoleX: { value: new THREE.Vector2(-0.3, 0.8) },
  uHoleZ: { value: -1.05 },
  uOpenBottom: { value: 0 },        // y of cavity floor (0 = no cavity)
  uSurfOpen: { value: 0 },          // 1 = lawn top is open over the hole
  uDisturbBottom: { value: 0 },     // y of bottom of loosened-soil column (0 = none)
  uPlantHole: { value: new THREE.Vector4(0, 0, 0, 0) }, // small first hole: x0,x1,depth,open
  // detector rings: center (x,y), start time, count spacing ; uRingParams: speed, maxR, width, intensity
  uRingCenter: { value: new THREE.Vector3(1.1, 0.0, -0.45) },
  uRingT0: { value: -100 },
  uRingT1: { value: -100 },
  uRingParams: { value: new THREE.Vector4(1.35, 1.9, 0.06, 0.0) },
  uChestGlow: { value: new THREE.Vector4(0, 0, 0, 0) }, // x,y,z, intensity (bounce glow on soil/lawn)
  uDogPatch: { value: new THREE.Vector4(0, 0, 0, 0) },  // x,z,radius,amount (scratched grass)
  uPatch: { value: 0 },             // bare refilled soil on the lawn over the hole (0 = grass regrown)
};

const RING_GLSL = /* glsl */`
uniform vec3 uRingCenter; uniform float uRingT0; uniform float uRingT1; uniform vec4 uRingParams; uniform float uTime;
vec3 ringGlow(vec3 wp){
  float d = length(wp - uRingCenter);
  float acc = 0.;
  for(int i=0;i<12;i++){
    float te = uRingT0 + float(i)*0.36;
    if(te > uRingT1 || te > uTime) continue;
    float r = (uTime - te) * uRingParams.x;
    float fade = 1. - smoothstep(uRingParams.y*0.55, uRingParams.y, r);
    float w = uRingParams.z * (1. + r*0.5);
    float q = (d - r)/w; float g = exp(-q*q) * fade * smoothstep(0., 0.15, r);
    acc += g;
  }
  return vec3(0.35, 1.0, 0.85) * acc * uRingParams.w;
}
`;

const HOLE_GLSL = /* glsl */`
uniform vec2 uHoleX; uniform float uHoleZ; uniform float uOpenBottom; uniform float uSurfOpen; uniform float uDisturbBottom;
uniform vec4 uPlantHole; uniform vec4 uChestGlow; uniform vec4 uDogPatch; uniform float uPatch;
float inHoleX(float x){ return step(uHoleX.x, x) * step(x, uHoleX.y); }
`;

function patchCommon(shader, extraUniforms) {
  Object.assign(shader.uniforms, U, extraUniforms || {});
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 _wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        _wp = instanceMatrix * _wp;
      #endif
      vWPos = (modelMatrix * _wp).xyz;`);
}

// ---------------------------------------------------------------- SOIL (cut face + cavity)
export function makeSoilMaterial({ interior = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, side: interior ? THREE.DoubleSide : THREE.FrontSide });
  const cols = {
    cTop: lin(0x5a3a24), cTop2: lin(0x3e2716), cClay: lin(0x7c4e31), cClay2: lin(0x936040),
    cDeep: lin(0x62503f), cDeep2: lin(0x7a6450), cRock: lin(0x7d7570), cRock2: lin(0x9b938a),
    cPeb1: lin(0x9c8c78), cPeb2: lin(0x7d7974), cPeb3: lin(0xb3a286), cRoot: lin(0xb08a5c), cLoose: lin(0x7a5434),
  };
  const uni = {}; for (const k in cols) uni[k] = { value: cols[k] };
  uni.uInterior = { value: interior ? 1 : 0 };
  m.onBeforeCompile = (shader) => {
    patchCommon(shader, uni);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; float gH; float gRough; float gPeb;
        ${Object.keys(cols).map((k) => `uniform vec3 ${k};`).join('\n')}
        uniform float uInterior;
        ${GLSL_NOISE}${GLSL_BUMP}${HOLE_GLSL}${RING_GLSL}`)
      .replace('#include <map_fragment>', `
        vec2 sp = uInterior > 0.5 ? vec2(vWPos.x + vWPos.z*1.3, vWPos.y + vWPos.z*0.7) : vWPos.xy;
        // ---- cavity cut-out on the front face
        if (uInterior < 0.5) {
          float hx = inHoleX(vWPos.x);
          if (hx > 0.5 && vWPos.y > uOpenBottom && uOpenBottom < -0.001) discard;
          float px = step(uPlantHole.x, vWPos.x) * step(vWPos.x, uPlantHole.y);
          if (uPlantHole.w > 0.5 && px > 0.5 && vWPos.y > -uPlantHole.z) discard;
        }
        float y = vWPos.y, x = sp.x;
        float b1 = -0.78 + 0.16*(fbm(vec2(x*0.45, 1.3))-0.5) ;
        float b2 = -2.15 + 0.38*(fbm(vec2(x*0.32+4.0, 2.7))-0.5);
        float b3 = -3.75 + 0.45*(fbm(vec2(x*0.28+9.0, 5.1))-0.5);
        float n1 = fbm(sp*vec2(3.0,4.0));
        float n2 = fbm(sp*vec2(11.0,13.0)+3.0);
        float n3 = vnoise(sp*vec2(38.0,42.0));
        vec3 c;
        float tTop = smoothstep(b1+0.06, b1-0.06, y);
        float tClay = smoothstep(b2+0.08, b2-0.08, y);
        float tDeep = smoothstep(b3+0.1, b3-0.1, y);
        vec3 top = mix(cTop2, cTop, n1);
        top = mix(top, cTop2*0.7, smoothstep(-0.10, -0.02, y));    // dark sod band under the grass
        vec3 clay = mix(cClay, cClay2, n1);
        clay = mix(clay, clay*0.82, smoothstep(0.45,0.5,fract(y*5.0 + n1*1.5))*0.35); // faint horizontal banding
        vec3 deep = mix(cDeep, cDeep2, n1);
        vec3 rock = mix(cRock, cRock2, n2);
        c = mix(top, clay, tTop); c = mix(c, deep, tClay); c = mix(c, rock, tDeep);
        c *= 0.82 + 0.36*n2;
        c *= 0.93 + 0.14*n3;
        float h = n2*0.25 + n3*0.12;
        float rough = 0.95;
        // ---- pebbles: two scales of cellular stones (more and bigger deeper down)
        float depthK = clamp(-y/4.0, 0.0, 1.0);
        vec3 cA = cellN(sp*vec2(3.4, 3.8) + vec2(5.0, 1.0));
        float rA = mix(0.16, 0.34, fract(cA.y*7.3)) * step(mix(0.86, 0.6, depthK), cA.y);
        float pA = rA > 0.0 ? clamp(1.0 - cA.x / rA, 0.0, 1.0) : 0.0;
        vec3 cB = cellN(sp*vec2(9.0, 10.0) + vec2(1.0, 9.0));
        float rB = mix(0.12, 0.3, fract(cB.y*5.1)) * step(0.72, cB.y);
        float pB = rB > 0.0 ? clamp(1.0 - cB.x / rB, 0.0, 1.0) : 0.0;
        vec3 pebCol = mix(mix(cPeb1, cPeb2, fract(cA.y*13.0)), cPeb3, fract(cA.y*29.0) > 0.7 ? 1.0 : 0.0);
        float pebMaskA = smoothstep(0.0, 0.12, pA);
        float pebMaskB = smoothstep(0.0, 0.18, pB);
        c = mix(c, c*0.55, smoothstep(0.0, 0.05, pA)*(1.0-pebMaskA)*1.0);   // contact darkening
        float domeA = sqrt(max(pA*(2.0-pA),0.0));
        c = mix(c, pebCol*(0.55+0.45*domeA)*(0.8+0.3*n3), pebMaskA);
        c = mix(c, mix(cPeb2, cPeb1, fract(cB.y*9.0))*(0.8+0.3*n2), pebMaskB*0.9);
        h += sqrt(max(pA,0.0))*1.6 + sqrt(max(pB,0.0))*0.6;
        rough = mix(rough, 0.62, max(pebMaskA, pebMaskB));
        // ---- fine roots in the top layer
        float rootN = abs(fbm(vec2(x*2.2, y*0.9 + 7.0)) - 0.5);
        float rootN2 = abs(fbm(vec2(x*4.5 + 3.0, y*1.6)) - 0.5);
        float rootMask = (1.0 - smoothstep(0.003, 0.008, rootN)) * smoothstep(-1.1, -0.12, y) * (1.0 - smoothstep(-0.04, 0.0, y));
        rootMask = max(rootMask, (1.0 - smoothstep(0.0025, 0.006, rootN2)) * smoothstep(-0.6, -0.05, y));
        c = mix(c, cRoot * (0.8 + 0.4*n3), rootMask * (1.0 - pebMaskA) * 0.75);
        h += rootMask * 0.5;
        // ---- loosened soil column (refilled hole): chunky mixed clods
        float inCol = (uInterior < 0.5 ? inHoleX(vWPos.x) : 0.0) * step(uDisturbBottom, y) * step(y, -0.0) * step(uDisturbBottom, -0.01);
        if (inCol > 0.5) {
          vec3 cl = cellN(sp*vec2(17.0, 17.0) + 2.0);
          vec3 loose = mix(cLoose, cTop, 0.35 + 0.4*fract(cl.y*3.7)) * (0.82 + 0.3*fract(cl.y*11.0));
          loose = mix(loose, c, 0.35);
          loose *= 0.85 + 0.2*smoothstep(0.05, 0.4, cl.x);
          float edge = min(vWPos.x - uHoleX.x, uHoleX.y - vWPos.x);
          float k = smoothstep(0.0, 0.04, edge);
          c = mix(c*0.8, loose, k);
          h = (1.0 - cl.x) * 0.7;
          rough = 0.98;
        }
        // interior faces of the open cavity are darker (occluded)
        if (uInterior > 0.5) { c *= 0.38 + 0.32*smoothstep(uOpenBottom, 0.0, vWPos.y); rough = 1.0; }
        gH = h; gRough = rough; gPeb = max(pebMaskA, pebMaskB);
        diffuseColor.rgb = c;
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = gRough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(-vViewPosition, normal, gH, 0.012);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += ringGlow(vWPos);
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.18) * uChestGlow.w * 0.08 / (1.0 + 6.0*dot(vWPos - uChestGlow.xyz, vWPos - uChestGlow.xyz)) * diffuseColor.rgb * 6.0;`);
  };
  m.customProgramCacheKey = () => 'soil' + (interior ? 'I' : 'F');
  return m;
}

// ---------------------------------------------------------------- LAWN ground (under grass)
export function makeLawnMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  const uni = { gA: { value: lin(0x4f8a2c) }, gB: { value: lin(0x3c7424) }, gN: { value: lin(0x6f8f2e) }, uFence: { value: 1.95 } };
  m.onBeforeCompile = (shader) => {
    patchCommon(shader, uni);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; float gH; uniform vec3 gA; uniform vec3 gB; uniform vec3 gN; uniform float uFence;
        ${GLSL_NOISE}${GLSL_BUMP}${HOLE_GLSL}${RING_GLSL}`)
      .replace('#include <map_fragment>', `
        vec2 p = vWPos.xz;
        if (uSurfOpen > 0.5 && inHoleX(p.x) > 0.5 && p.y > uHoleZ && p.y < 0.02) discard;
        if (uPlantHole.w > 0.5 && p.x > uPlantHole.x && p.x < uPlantHole.y && p.y > -0.42) discard;
        float stripe = smoothstep(0.42, 0.58, abs(fract(p.x/1.8) - 0.5)*2.0);
        vec3 g = mix(gA, gB, stripe);
        float n = fbm(p*1.3);
        g *= 0.78 + 0.4*n;
        g *= 0.9 + 0.2*vnoise(p*22.0);
        if (p.x > uFence) { g = mix(gN, gN*0.8, fbm(p*0.9+4.0)); }
        // scratched patch from the dog
        float dp = length(p - uDogPatch.xy);
        float dmask = (1.0 - smoothstep(uDogPatch.z*0.6, uDogPatch.z, dp)) * uDogPatch.w;
        g = mix(g, vec3(0.12,0.065,0.03)*(0.8+0.4*n), dmask);
        float hk = smoothstep(uHoleX.x - 0.06, uHoleX.x + 0.02, p.x) * (1.0 - smoothstep(uHoleX.y - 0.02, uHoleX.y + 0.06, p.x)) * smoothstep(uHoleZ - 0.06, uHoleZ + 0.02, p.y);
        float clod = vnoise(p*18.0);
        g = mix(g, vec3(0.10,0.055,0.028)*(0.7+0.6*clod), hk * uPatch);
        gH = n*0.4 + vnoise(p*22.0)*0.3 + hk*uPatch*clod;
        diffuseColor.rgb = g;
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = bumpN(-vViewPosition, normal, gH, 0.01);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += ringGlow(vWPos);`);
  };
  m.customProgramCacheKey = () => 'lawn';
  return m;
}

// ---------------------------------------------------------------- GRASS (instanced blades)
export function makeGrass({ count, x0, x1, z0, z1, seed = 3, bladeH = 0.14, bladeW = 0.022, fence = 1.95, densityFn = null }) {
  const segs = 4;
  const g = new THREE.BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const v = i / segs; const w = bladeW * (1 - v * 0.92) * 0.5;
    pos.push(-w, v, 0, w, v, 0); uv.push(0, v, 1, v);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setIndex(idx);
  const rnd = mulberry32(seed);
  const offs = new Float32Array(count * 4), attr2 = new Float32Array(count * 4);
  let n = 0, guard = 0;
  while (n < count && guard++ < count * 20) {
    const x = x0 + (x1 - x0) * rnd(), z = z0 + (z1 - z0) * rnd();
    if (densityFn && rnd() > densityFn(x, z)) continue;
    offs[n * 4] = x; offs[n * 4 + 1] = z; offs[n * 4 + 2] = rnd() * Math.PI * 2; offs[n * 4 + 3] = bladeH * (0.6 + 0.7 * rnd());
    attr2[n * 4] = rnd(); attr2[n * 4 + 1] = rnd(); attr2[n * 4 + 2] = (rnd() - 0.5) * 0.6; attr2[n * 4 + 3] = rnd();
    n++;
  }
  const ig = new THREE.InstancedBufferGeometry();
  ig.index = g.index; ig.attributes.position = g.attributes.position; ig.attributes.uv = g.attributes.uv; ig.attributes.normal = g.attributes.normal;
  ig.setAttribute('aOff', new THREE.InstancedBufferAttribute(offs.subarray(0, n * 4), 4));
  ig.setAttribute('aVar', new THREE.InstancedBufferAttribute(attr2.subarray(0, n * 4), 4));
  ig.instanceCount = n;
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  const uni = { gA: { value: lin(0x5c9a32) }, gB: { value: lin(0x447f28) }, gTip: { value: lin(0xb8c95a) }, gN: { value: lin(0x7f9a35) }, uFence: { value: fence }, uRegrow: { value: 1 } };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aOff; attribute vec4 aVar; varying vec3 vGCol; varying float vGv;
        uniform vec3 gA; uniform vec3 gB; uniform vec3 gTip; uniform vec3 gN; uniform float uFence; uniform float uRegrow;
        ${GLSL_NOISE}${HOLE_GLSL}
        uniform float uTime;`)
      .replace('#include <begin_vertex>', `
        vec3 transformed = vec3(position);
        float hgt = aOff.w;
        vec2 bp = aOff.xy;
        // hide blades over open hole / plant hole / mounds; regrow after refill
        float hide = 0.0;
        if (inHoleX(bp.x) > 0.5 && bp.y > uHoleZ - 0.03 && bp.y < 0.05) hide = max(hide, uSurfOpen > 0.5 ? 1.0 : smoothstep(aVar.w - 0.12, aVar.w + 0.12, uPatch * 1.3 - 0.15));
        if (uPlantHole.w > 0.5 && bp.x > uPlantHole.x - 0.03 && bp.x < uPlantHole.y + 0.03 && bp.y > -0.45) hide = 1.0;
        float dp = length(bp - uDogPatch.xy);
        hide = max(hide, (1.0 - smoothstep(uDogPatch.z*0.5, uDogPatch.z, dp)) * uDogPatch.w);
        float regrowDelay = aVar.w;
        hgt *= (1.0 - hide);
        float ca = cos(aOff.z), sa = sin(aOff.z);
        float v = position.y;
        float wind = sin(uTime*1.7 + bp.x*0.9 + bp.y*0.6) * 0.5 + sin(uTime*2.9 + bp.x*2.1 - bp.y*1.3 + aVar.x*6.0) * 0.25 + (vnoise(bp*0.4 + vec2(uTime*0.35, 0.0)) - 0.5) * 0.9;
        float bend = (0.10 + aVar.z) * v * v + wind * 0.13 * v * v;
        vec3 p = vec3(position.x, v * hgt, 0.0);
        p.z += bend * hgt * 2.2;
        p.y -= abs(bend) * hgt * 0.35;
        transformed = vec3(p.x*ca - p.z*sa, p.y, p.x*sa + p.z*ca) + vec3(bp.x, 0.0, bp.y);
        if (hide > 0.97) transformed = vec3(bp.x, -6.0, bp.y);
        transformed.y -= hide * 0.02;
        float stripe = smoothstep(0.42, 0.58, abs(fract(bp.x/1.8) - 0.5)*2.0);
        vec3 base = mix(gA, gB, stripe) * (0.75 + 0.5*aVar.y);
        if (bp.x > uFence) base = gN * (0.75 + 0.45*aVar.y);
        vGCol = mix(base*0.55, mix(base, gTip, 0.25 + 0.2*aVar.x), smoothstep(0.0, 1.0, v));
        vGv = v;
      `)
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0));`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGCol; varying float vGv;`)
      .replace('#include <map_fragment>', `diffuseColor.rgb = vGCol;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vGCol * 0.06 * vGv;`);
  };
  m.customProgramCacheKey = () => 'grass';
  const mesh = new THREE.Mesh(ig, m);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.userData.uni = uni; mesh.userData.noAO = true;
  return mesh;
}

// ---------------------------------------------------------------- CANVAS TEXTURES
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function finish(c, { srgb = true, repeat = [1, 1] } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true; return t;
}

// Wood planks (returns {map, bump}) - vertical grain along v
export function woodTextures({ w = 512, h = 512, planks = 4, base = [118, 74, 42], seed = 11, dark = 0.6, weather = 0.3 } = {}) {
  const rnd = mulberry32(seed); const N = makeNoise2D(seed);
  const [c, x] = canvas(w, h); const [cb, xb] = canvas(w, h);
  const img = x.createImageData(w, h), bimg = xb.createImageData(w, h);
  const pw = w / planks; const tints = Array.from({ length: planks }, () => 0.82 + rnd() * 0.3);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const pk = Math.floor(i / pw), lx = (i % pw) / pw;
    const u = i / w, v = j / h;
    const warp = N.fbm(u * 3 + pk * 7, v * 1.2, 3) * 3.0;
    const grain = Math.sin((lx * 9 + warp * 3 + pk * 1.7) * 6.2831 * 1.6) * 0.5 + 0.5;
    const fine = N.noise(u * 160, v * 9 + pk * 13);
    const knot = Math.max(0, 1 - Math.hypot((lx - 0.5) * 4, (v - (0.3 + 0.4 * ((pk * 0.37) % 1))) * 7));
    let k = tints[pk] * (0.78 + 0.22 * grain) * (0.85 + 0.2 * fine) * (1 - knot * 0.5);
    const weatherN = N.fbm(u * 6, v * 6, 4);
    k *= 1 - weather * Math.max(0, weatherN - 0.45);
    const edge = Math.min(lx, 1 - lx) * pw;
    const gap = edge < 2.2 ? dark * (1 - edge / 2.2) : 0;
    const f = k * (1 - gap);
    const o = (j * w + i) * 4;
    img.data[o] = base[0] * f; img.data[o + 1] = base[1] * f; img.data[o + 2] = base[2] * f; img.data[o + 3] = 255;
    const b = 255 * (0.55 + 0.25 * grain + 0.1 * fine) * (1 - gap * 1.4);
    bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = Math.max(0, b); bimg.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xb.putImageData(bimg, 0, 0);
  return { map: finish(c), bump: finish(cb, { srgb: false }) };
}

// Hammered, rusty iron
export function ironTextures({ seed = 21 } = {}) {
  const N = makeNoise2D(seed); const w = 256, h = 256;
  const [c, x] = canvas(w, h); const [cr, xr] = canvas(w, h);
  const img = x.createImageData(w, h), rim = xr.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h; const n = N.fbm(u * 8, v * 8, 5); const rust = Math.max(0, N.fbm(u * 4 + 9, v * 4, 4) - 0.5) * 2.2;
    const o = (j * w + i) * 4;
    const g = 55 + 40 * n;
    img.data[o] = g + rust * 80; img.data[o + 1] = g * 0.95 + rust * 35; img.data[o + 2] = g * 0.92 + rust * 10; img.data[o + 3] = 255;
    const r = 255 * Math.min(1, 0.45 + rust * 0.5 + n * 0.2);
    rim.data[o] = rim.data[o + 1] = rim.data[o + 2] = r; rim.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xr.putImageData(rim, 0, 0);
  return { map: finish(c), rough: finish(cr, { srgb: false }) };
}

export function stripeTexture({ a = '#e94b3c', b = '#fff6e8', n = 7, w = 256, h = 256, accent = null }) {
  const [c, x] = canvas(w, h); const N = makeNoise2D(5);
  const sh = h / n;
  for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; x.fillRect(0, i * sh, w, sh + 1); }
  if (accent) { x.fillStyle = accent; for (let i = 0; i < n; i += 2) x.fillRect(0, i * sh + sh * 0.42, w, sh * 0.16); }
  // subtle fabric weave
  const img = x.getImageData(0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const o = (j * w + i) * 4; const f = 0.92 + 0.08 * ((i + j) % 3 === 0 ? 1 : 0) + (N.noise(i * 0.3, j * 0.3) - 0.5) * 0.06;
    img.data[o] *= f; img.data[o + 1] *= f; img.data[o + 2] *= f;
  }
  x.putImageData(img, 0, 0);
  return finish(c);
}

export function knitTexture({ color = [150, 62, 52], w = 256, h = 256 } = {}) {
  const [c, x] = canvas(w, h); const [cb, xb] = canvas(w, h);
  const img = x.createImageData(w, h), bimg = xb.createImageData(w, h); const N = makeNoise2D(9);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const cu = (i % 16) / 16, cv = (j % 12) / 12;
    const vstitch = Math.abs(((cu * 2) % 1) - 0.5) * 2; // V shape
    const s = Math.sin((cv + (cu < 0.5 ? cu : 1 - cu) * 0.9) * Math.PI * 2) * 0.5 + 0.5;
    const k = 0.75 + 0.25 * s * (1 - vstitch * 0.3) + (N.noise(i * 0.2, j * 0.2) - 0.5) * 0.1;
    const o = (j * w + i) * 4;
    img.data[o] = color[0] * k; img.data[o + 1] = color[1] * k; img.data[o + 2] = color[2] * k; img.data[o + 3] = 255;
    bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = 255 * s; bimg.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xb.putImageData(bimg, 0, 0);
  return { map: finish(c, { repeat: [3, 3] }), bump: finish(cb, { srgb: false, repeat: [3, 3] }) };
}

export function sidingTexture({ base = [226, 204, 168], w = 512, h = 512, rows = 16 } = {}) {
  const [c, x] = canvas(w, h); const [cb, xb] = canvas(w, h); const N = makeNoise2D(31);
  const img = x.createImageData(w, h), bimg = xb.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const rv = (j / h * rows) % 1; const shade = 0.86 + 0.14 * rv; const lip = rv > 0.93 ? 0.7 : 1;
    const n = 0.95 + 0.05 * N.fbm(i / 40, j / 40, 3);
    const k = shade * lip * n; const o = (j * w + i) * 4;
    img.data[o] = base[0] * k; img.data[o + 1] = base[1] * k; img.data[o + 2] = base[2] * k; img.data[o + 3] = 255;
    bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = 255 * (rv * 0.8 + (rv > 0.93 ? -0.5 : 0) + 0.2); bimg.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xb.putImageData(bimg, 0, 0);
  return { map: finish(c), bump: finish(cb, { srgb: false }) };
}

export function shingleTexture({ base = [92, 70, 66], w = 512, h = 512 } = {}) {
  const [c, x] = canvas(w, h); const N = makeNoise2D(41); const rnd = mulberry32(41);
  const rows = 14, cols = 10; const rh = h / rows, cw = w / cols;
  for (let r = 0; r < rows; r++) for (let k = -1; k <= cols; k++) {
    const off = (r % 2) * cw * 0.5; const t = 0.75 + rnd() * 0.35;
    x.fillStyle = `rgb(${base[0] * t | 0},${base[1] * t | 0},${base[2] * t | 0})`;
    x.fillRect(k * cw + off + 1, r * rh, cw - 2, rh);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(k * cw + off, r * rh + rh - 3, cw, 3);
  }
  const img = x.getImageData(0, 0, w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const o = (j * w + i) * 4; const f = 0.9 + 0.2 * N.noise(i * 0.15, j * 0.15); img.data[o] *= f; img.data[o + 1] *= f; img.data[o + 2] *= f; }
  x.putImageData(img, 0, 0);
  return finish(c);
}

export function radialTexture({ size = 128, stops = [[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']] } = {}) {
  const [c, x] = canvas(size, size); const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, size, size); const t = finish(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function starTexture(size = 128) {
  const [c, x] = canvas(size, size); const m = size / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, m); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,250,220,0.8)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, m * 0.35, 0, 7); x.fill();
  x.globalCompositeOperation = 'lighter';
  for (const [w, l] of [[0.06, 1], [0.035, 0.6]]) {
    for (let k = 0; k < (l === 1 ? 2 : 2); k++) {
      x.save(); x.translate(m, m); x.rotate(k * Math.PI / 2 + (l === 1 ? 0 : Math.PI / 4));
      const lg = x.createLinearGradient(-m, 0, m, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,1)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = lg; x.beginPath(); x.ellipse(0, 0, m * l, m * w, 0, 0, 7); x.fill(); x.restore();
    }
  }
  const t = finish(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function noteTexture(size = 128) {
  const [c, x] = canvas(size, size);
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.lineWidth = size * 0.07;
  x.beginPath(); x.ellipse(size * 0.33, size * 0.74, size * 0.17, size * 0.12, -0.4, 0, 7); x.fill();
  x.beginPath(); x.moveTo(size * 0.47, size * 0.72); x.lineTo(size * 0.47, size * 0.15); x.quadraticCurveTo(size * 0.62, size * 0.32, size * 0.8, size * 0.36); x.stroke();
  const t = finish(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

export function furTexture({ base = [236, 196, 140], seed = 51 } = {}) {
  const w = 256, h = 256; const [c, x] = canvas(w, h); const [cb, xb] = canvas(w, h); const N = makeNoise2D(seed);
  const img = x.createImageData(w, h), bimg = xb.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const u = i / w, v = j / h; const strands = N.noise(u * 90, v * 14) * 0.6 + N.noise(u * 40 + 3, v * 7) * 0.4; const clump = N.fbm(u * 6, v * 6, 4);
    const k = 0.78 + 0.3 * strands * (0.6 + clump * 0.6); const o = (j * w + i) * 4;
    img.data[o] = Math.min(255, base[0] * k); img.data[o + 1] = Math.min(255, base[1] * k); img.data[o + 2] = Math.min(255, base[2] * k); img.data[o + 3] = 255;
    bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = 255 * strands; bimg.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xb.putImageData(bimg, 0, 0);
  return { map: finish(c, { repeat: [2, 2] }), bump: finish(cb, { srgb: false, repeat: [2, 2] }) };
}

export function ropeTexture() {
  const w = 64, h = 256; const [c, x] = canvas(w, h); const [cb, xb] = canvas(w, h);
  const img = x.createImageData(w, h), bimg = xb.createImageData(w, h); const N = makeNoise2D(61);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = Math.sin(((i / w) * 3 + (j / h) * 12) * Math.PI * 2) * 0.5 + 0.5; const n = N.noise(i * 0.5, j * 0.5);
    const k = 0.7 + 0.3 * s + (n - 0.5) * 0.15; const o = (j * w + i) * 4;
    img.data[o] = 196 * k; img.data[o + 1] = 160 * k; img.data[o + 2] = 106 * k; img.data[o + 3] = 255;
    bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = 255 * s; bimg.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); xb.putImageData(bimg, 0, 0);
  return { map: finish(c, { repeat: [1, 8] }), bump: finish(cb, { srgb: false, repeat: [1, 8] }) };
}

export function barkTexture() {
  const w = 256, h = 512; const [c, x] = canvas(w, h); const N = makeNoise2D(71);
  const img = x.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const r = Math.abs(N.fbm(i / 18, j / 90, 4) - 0.5) * 2; const k = 0.55 + 0.45 * Math.pow(r, 0.6); const o = (j * w + i) * 4;
    img.data[o] = 104 * k; img.data[o + 1] = 76 * k; img.data[o + 2] = 56 * k; img.data[o + 3] = 255;
  }
  x.putImageData(img, 0, 0); return finish(c, { repeat: [2, 1] });
}
