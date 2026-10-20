// The cut-open Earth: the big cut face (plane z = 0), the drilled tunnel's back
// wall, and the pit bottom. Every layer is painted procedurally in GLSL inside
// standard PBR materials, so lights and shadows still work.
import * as THREE from 'three';
import { NOISE } from './lib/glsl.js';
import { LAYOUT, PATH_GLSL, pathAtS } from './layout.js';

const L = LAYOUT;
const f = (v) => Number(v).toFixed(4);
// Everything inside the Earth is cut away in front of z = 0.
export const CUT_PLANE = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

// Shared GLSL: earth material at a world position.
export const EARTH_GLSL = /* glsl */`
${NOISE}
${PATH_GLSL}
uniform float uTime, uHeatBoost, uCoreBoost, uCrumble, uCrumbleS0, uCrumbleS1;
struct EarthMat { vec3 albedo; float rough; vec3 emis; float h; };

vec3 strata(float d, vec3 a, vec3 b, vec3 c, float freq, float n){
  float k = d * freq + n * 1.4;
  float s1 = 0.5 + 0.5 * sin(k), s2 = 0.5 + 0.5 * sin(k * 2.3 + 1.7);
  return mix(mix(a, b, smoothstep(0.25, 0.75, s1)), c, smoothstep(0.55, 0.95, s2) * 0.6);
}

// Sparse organic fracture lines (zero-crossings of warped noise).
float fracture(vec2 p, float px, float width){
  // bedding cracks: long, nearly horizontal
  float w1 = snoise(p * vec2(0.12, 0.5) + 4.1) * 0.35;
  float n1 = abs(snoise(p * vec2(0.18, 1.1) + vec2(0.0, w1)));
  float bed = (1.0 - smoothstep(width, width + 0.02 + px * 2.0, n1)) * smoothstep(0.1, 0.5, snoise(p * vec2(0.2, 0.6) + 2.0));
  // joints: short, steep
  float w2 = snoise(p * vec2(0.6, 0.15) - 7.3) * 0.3;
  float n2 = abs(snoise(p * vec2(1.3, 0.2) + vec2(w2, 0.0)));
  float joint = (1.0 - smoothstep(width * 0.8, width * 0.8 + 0.02 + px * 2.0, n2)) * smoothstep(0.35, 0.65, snoise(p * 0.45 + 9.0));
  return max(bed, joint);
}
// Warped polygonal cracks (cooling basalt / cracked crust): x = edge distance, y = cell random.
vec2 crackCells(vec2 p){
  vec2 w = vec2(snoise(p * 0.35), snoise(p * 0.35 + 17.0)) * 0.45;
  vec4 v = voronoi(p + w);
  return vec2(v.y - v.x, hash12(v.zw));
}
vec3 bandColor(float idx, vec3 c0, vec3 c1, vec3 c2, vec3 c3){
  float h = fract(sin(idx * 91.7) * 4375.85);
  return h < 0.25 ? c0 : h < 0.5 ? c1 : h < 0.75 ? c2 : c3;
}
vec3 rockStrata(float d, vec2 dp, float px, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float scale){
  float warp = fbm2(dp * vec2(0.08, 0.2), px * 0.2, 3) * 0.55 + snoise(dp * vec2(0.3, 1.2)) * 0.06;
  float k = d * scale + warp;
  float i0 = floor(k), fr = fract(k);
  vec3 a = bandColor(i0, c0, c1, c2, c3), b = bandColor(i0 + 1.0, c0, c1, c2, c3);
  vec3 col = mix(a, b, smoothstep(0.82, 1.0, fr));
  // fine lamination inside each band
  float lam = 0.5 + 0.5 * sin(k * 28.0 + snoise(dp * 2.0) * 2.0);
  col *= 0.93 + 0.07 * mix(lam, 0.5, smoothstep(0.1, 0.4, px * 4.0));
  // a darker seam line at band boundaries
  col *= 1.0 - (1.0 - smoothstep(0.0, 0.04 + px * scale * 2.0, abs(fr - 0.91))) * 0.35;
  return col;
}

EarthMat earthAt(vec3 p, vec3 dp, float px){
  // p: world position; dp: position used for fine detail (xy plane or 3D on the tube)
  EarthMat m;
  vec2 q = p.xy;
  float rC = length(q - vec2(0.0, ${f(L.CORE_Y)}));
  bool nearSide = q.y > ${f(L.CORE_Y)};
  float flatD = nearSide ? -q.y : (q.y - ${f(L.FAR_Y)});
  float sphD = nearSide ? (${f(-L.CORE_Y)} - rC) : (${f(L.CORE_Y - L.FAR_Y)} - rC);
  float depth = mix(flatD, sphD, smoothstep(6.0, 30.0, flatD));
  float n1 = fbm2(dp.xy * 0.35 + 3.1, px * 0.35, 3);
  float wob = n1 * 0.7 + snoise(dp.xy * 1.9) * 0.1;
  float d = depth + wob * smoothstep(0.25, 2.5, depth);
  float fine = fbm2(dp.xy * 6.0, px * 6.0, 4);
  float mid = fbm2(dp.xy * 1.6 + 7.3, px * 1.6, 4);
  vec4 vo = voronoi(dp.xy * 3.2);
  vec4 vo2 = voronoi(dp.xy * 0.9 + 11.0);
  m.rough = 0.92; m.emis = vec3(0.0); m.h = 0.0;
  if (rC < ${f(L.CORE_R)}) {
    // Core: a small sun. Boiling granulation, white-hot centre, orange limb.
    float t = uTime;
    vec2 cq = (q - vec2(0.0, ${f(L.CORE_Y)}));
    float gran = fbm2(cq * 0.45 + vec2(t * 0.35, -t * 0.22), px * 0.45, 5);
    vec4 cells = voronoi(cq * 1.1 + vec2(sin(t * 0.4), cos(t * 0.33)) * 0.8);
    float cellLight = smoothstep(0.0, 0.6, cells.y - cells.x);
    float rr = rC / ${f(L.CORE_R)};
    float limb = pow(1.0 - rr * rr, 0.35);
    vec3 hot = mix(vec3(1.0, 0.42, 0.06), vec3(1.0, 0.86, 0.45), limb);
    hot = mix(hot, vec3(1.0, 0.97, 0.85), smoothstep(0.55, 1.0, limb) * 0.7);
    // granules: bright cell centres, darker lanes, slow boiling
    vec4 g1 = voronoi(cq * 0.75 + vec2(t * 0.15, -t * 0.11) + gran * 0.4);
    float granule = smoothstep(0.0, 0.55, g1.y - g1.x);
    float tex = 0.55 + 0.45 * granule + 0.25 * gran;
    hot = mix(vec3(1.0, 0.32, 0.03), vec3(1.0, 0.62, 0.14), limb);
    hot = mix(hot, vec3(1.0, 0.8, 0.38), smoothstep(0.75, 1.0, limb) * granule);
    m.albedo = vec3(0.0); m.rough = 1.0;
    m.emis = hot * tex * (1.0 + 1.3 * limb) * uCoreBoost;
    m.h = gran * 0.02;
    return m;
  }
  if (nearSide) {
    if (d < ${f(L.NEAR.grass)}) {
      float blade = 0.5 + 0.5 * snoise(vec2(dp.x * 60.0, d * 4.0));
      m.albedo = mix(vec3(0.10, 0.30, 0.06), vec3(0.28, 0.55, 0.12), blade);
      m.rough = 0.8; m.h = blade * 0.01;
    } else if (d < ${f(L.NEAR.topsoil)}) {
      vec3 a = vec3(0.17, 0.11, 0.07), b = vec3(0.27, 0.18, 0.11);
      m.albedo = mix(a, b, 0.5 + 0.5 * mid) * (0.85 + 0.25 * fine);
      // roots: thin wavy lines fading with depth
      float rn = abs(snoise(vec2(dp.x * 2.2, d * 5.0 + snoise(dp.xy * 3.0) * 0.6)));
      float root = (1.0 - smoothstep(0.02, 0.05 + px * 3.0, rn)) * (1.0 - smoothstep(0.2, 1.2, d));
      m.albedo = mix(m.albedo, vec3(0.55, 0.42, 0.28), root * 0.9);
      m.h = fine * 0.02 + root * 0.01;
    } else if (d < ${f(L.NEAR.subsoil)}) {
      vec3 a = vec3(0.30, 0.20, 0.12), b = vec3(0.41, 0.29, 0.18);
      m.albedo = mix(a, b, 0.5 + 0.5 * mid) * (0.88 + 0.2 * fine);
      // pebbles: irregular, varied, only some cells
      vec4 pv = voronoi(dp.xy * 2.6 + vec2(snoise(dp.xy * 2.0) * 0.12));
      float keep = step(0.62, hash12(pv.zw + 9.0));
      float rad = 0.14 + 0.2 * hash12(pv.zw);
      float shape = pv.x * (1.0 + 0.12 * snoise(dp.xy * 4.0 + pv.zw));
      float peb = (1.0 - smoothstep(rad - 0.05 - px * 2.6, rad, shape)) * keep;
      float tone = hash12(pv.zw + 3.0);
      vec3 pc = tone < 0.4 ? vec3(0.36, 0.33, 0.30) : tone < 0.75 ? vec3(0.50, 0.43, 0.34) : vec3(0.28, 0.22, 0.17);
      float dome = clamp(1.0 - shape / rad, 0.0, 1.0);
      m.albedo = mix(m.albedo, pc * (0.75 + 0.35 * dome) * (0.9 + 0.2 * fine), peb);
      m.h = fine * 0.02 + peb * dome * 0.05;
    } else if (d < ${f(L.NEAR.clay)}) {
      vec3 base = strata(d, vec3(0.50, 0.30, 0.18), vec3(0.62, 0.40, 0.24), vec3(0.42, 0.25, 0.16), 2.2, mid);
      m.albedo = base * (0.9 + 0.18 * fine);
      float rad = 0.26 + 0.16 * hash12(vo2.zw);
      float shp = vo2.x * (1.0 + 0.3 * snoise(dp.xy * 4.0 + vo2.zw));
      float stone = (1.0 - smoothstep(rad - 0.04 - px * 1.0, rad, shp)) * step(0.68, hash12(vo2.zw + 2.0));
      float tn = hash12(vo2.zw + 5.0);
      vec3 sc = tn < 0.5 ? vec3(0.40, 0.38, 0.36) : vec3(0.52, 0.45, 0.36);
      float dome = clamp(1.0 - shp / rad, 0.0, 1.0);
      m.albedo = mix(m.albedo, sc * (0.7 + 0.4 * dome) * (0.9 + 0.2 * fine), stone);
      m.h = fine * 0.02 + stone * dome * 0.06;
    } else if (d < ${f(L.NEAR.rock)}) {
      // Grey rock strata: banded, laminated, a few sparse fractures and speckles.
      vec3 base = rockStrata(d, dp.xy, px, vec3(0.26, 0.27, 0.30), vec3(0.52, 0.51, 0.49),
        vec3(0.33, 0.37, 0.43), vec3(0.60, 0.55, 0.47), 0.62);
      float speck = smoothstep(0.55, 0.75, snoise(dp.xy * 13.0)) * (1.0 - smoothstep(0.3, 0.8, px * 13.0));
      float fr = fracture(dp.xy * vec2(0.55, 0.8), px * 0.8, 0.025);
      m.albedo = base * (0.9 + 0.16 * fine) * (1.0 - fr * 0.6) + speck * 0.06;
      m.rough = 0.72; m.h = fine * 0.012 + mid * 0.03 - fr * 0.03;
      // the last few metres start to warm up
      float warm = smoothstep(${f(L.NEAR.rock - 3)}, ${f(L.NEAR.rock)}, d);
      m.albedo = mix(m.albedo, m.albedo * vec3(0.8, 0.62, 0.55), warm);
      m.emis = vec3(1.0, 0.3, 0.05) * fr * warm * warm * 0.8;
    } else if (d < ${f(L.NEAR.hot)}) {
      // Hot rock: dark basalt with branching glowing veins, hotter with depth.
      float heat = smoothstep(${f(L.NEAR.rock)}, ${f(L.NEAR.hot)}, d);
      vec3 base = rockStrata(d, dp.xy, px, vec3(0.20, 0.18, 0.18), vec3(0.27, 0.23, 0.21),
        vec3(0.17, 0.15, 0.15), vec3(0.30, 0.25, 0.22), 0.6);
      vec2 cc = crackCells(dp.xy * 1.15);
      vec2 cc2 = crackCells(dp.xy * 3.1 + 5.0);
      float wv = 0.035 + 0.05 * hash12(floor(dp.xy * 1.15)) + 0.04 * heat;
      float vein = 1.0 - smoothstep(wv, wv + 0.03 + px * 1.6, cc.x);
      float vein2 = (1.0 - smoothstep(0.02, 0.04 + px * 4.0, cc2.x)) * smoothstep(0.4, 1.0, heat);
      float halo = 1.0 - smoothstep(0.0, 0.22 + 0.2 * heat, cc.x);
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + dp.y * 0.7 + cc.y * 6.0);
      m.albedo = base * (0.9 + 0.16 * fine) * (1.0 - vein * 0.85) * (0.85 + 0.3 * cc.y);
      m.rough = 0.65; m.h = fine * 0.03 + (1.0 - halo) * 0.04 - vein * 0.04;
      float g = (0.3 + 0.7 * heat) * (0.55 + 0.45 * uHeatBoost) * pulse;
      vec3 veinCol = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.62, 0.15), heat);
      m.emis = (veinCol * (vein * 4.5 + vein2 * 1.5) + vec3(0.8, 0.14, 0.02) * halo * halo * (0.4 + 1.2 * heat)) * g
             + vec3(0.45, 0.07, 0.02) * heat * heat * 0.5;
    } else {
      // Mantle: slow-flowing magma channels between dark crust plates.
      float t = uTime * 0.12;
      vec2 fq = dp.xy * 0.22;
      vec2 warp = vec2(fbm2(fq + vec2(0.0, t), px * 0.22, 3), fbm2(fq + vec2(5.2, -t * 0.7), px * 0.22, 3));
      float flow = fbm2(fq * 2.0 + warp * 1.6 + vec2(t * 0.5, t), px * 0.44, 4);
      float chan = smoothstep(0.12, 0.42, flow);
      float crust = 1.0 - chan;
      float hotc = smoothstep(0.35, 0.75, flow);
      vec3 lava = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.58, 0.1), hotc);
      lava = mix(lava, vec3(1.0, 0.88, 0.45), smoothstep(0.7, 0.95, flow));
      float crack = smoothstep(0.2, 0.0, abs(flow - 0.06)) * 0.6;
      m.albedo = vec3(0.07, 0.035, 0.025) * (0.8 + 0.4 * fine);
      float deep = smoothstep(${f(L.NEAR.hot)}, ${f(L.NEAR.mantle)}, d);
      m.emis = lava * chan * (3.2 + 1.6 * hotc) * (0.75 + 0.5 * deep)
             + vec3(0.55, 0.07, 0.01) * crust * (0.35 + 0.9 * crack) * (0.6 + 0.6 * deep);
      m.rough = mix(0.85, 0.4, chan); m.h = crust * 0.04 + fine * 0.01;
    }
  } else {
    if (d < ${f(L.FAR.sand)}) {
      float wet = smoothstep(0.6, 2.5, d);
      vec3 dry = vec3(0.82, 0.75, 0.61), wetc = vec3(0.62, 0.52, 0.38);
      vec3 base = mix(dry, wetc, wet) * (0.9 + 0.14 * fine);
      base = mix(base, base * 0.78, smoothstep(0.3, 0.9, 0.5 + 0.5 * sin(d * 7.0 + mid * 2.5)) * 0.6);
      base = mix(base, base * vec3(0.92, 0.86, 0.8), smoothstep(0.2, 0.7, snoise(dp.xy * vec2(0.4, 2.2))) * 0.5);
      float shell = (1.0 - smoothstep(0.08, 0.12 + px * 3.2, vo.x)) * step(0.85, hash12(vo.zw));
      m.albedo = mix(base, vec3(0.98, 0.94, 0.9), shell);
      float stone = smoothstep(4.0, ${f(L.FAR.sand)}, d);
      m.albedo = mix(m.albedo, strata(d, vec3(0.70, 0.60, 0.46), vec3(0.78, 0.68, 0.52), vec3(0.62, 0.52, 0.40), 3.0, mid), stone);
      m.rough = 0.95; m.h = fine * 0.015 + shell * 0.01;
    } else if (d < ${f(L.FAR.rock)}) {
      vec3 base = rockStrata(d, dp.xy, px, vec3(0.62, 0.55, 0.45), vec3(0.72, 0.65, 0.53),
        vec3(0.50, 0.46, 0.41), vec3(0.58, 0.50, 0.40), 0.8);
      float fr = fracture(dp.xy * vec2(0.55, 0.8), px * 0.8, 0.025);
      m.albedo = base * (0.9 + 0.16 * fine) * (1.0 - fr * 0.55);
      m.rough = 0.8; m.h = fine * 0.03 + mid * 0.02 - fr * 0.03;
    } else if (d < ${f(L.FAR.hot)}) {
      float heat = smoothstep(${f(L.FAR.rock)}, ${f(L.FAR.hot)}, d);
      vec3 base = rockStrata(d, dp.xy, px, vec3(0.22, 0.20, 0.19), vec3(0.30, 0.26, 0.23),
        vec3(0.19, 0.17, 0.16), vec3(0.33, 0.28, 0.24), 0.6);
      vec2 w = vec2(fbm2(dp.xy * 0.25, px * 0.25, 3), fbm2(dp.xy * 0.25 + 9.0, px * 0.25, 3));
      float v1 = abs(snoise(dp.xy * 0.42 + w * 1.4));
      float vein = 1.0 - smoothstep(0.02, 0.07 + px, v1);
      m.albedo = base * (0.9 + 0.16 * fine) * (1.0 - vein * 0.8);
      m.emis = vec3(1.0, 0.42, 0.07) * vein * 5.0 * (0.3 + 0.7 * heat) + vec3(0.5, 0.08, 0.02) * heat * heat * 0.5;
      m.rough = 0.65; m.h = fine * 0.03 - vein * 0.02;
    } else {
      float t = uTime * 0.12;
      vec2 fq = dp.xy * 0.22;
      vec2 warp = vec2(fbm2(fq + vec2(2.0, -t), px * 0.22, 3), fbm2(fq + vec2(9.2, t * 0.7), px * 0.22, 3));
      float flow = fbm2(fq * 2.0 + warp * 1.6 - vec2(t * 0.5, t), px * 0.44, 4);
      float chan = smoothstep(0.12, 0.42, flow);
      float hotc = smoothstep(0.35, 0.75, flow);
      vec3 lava = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.58, 0.1), hotc);
      lava = mix(lava, vec3(1.0, 0.88, 0.45), smoothstep(0.7, 0.95, flow));
      float crack = smoothstep(0.2, 0.0, abs(flow - 0.06)) * 0.6;
      m.albedo = vec3(0.07, 0.035, 0.025);
      float deep = smoothstep(${f(L.FAR.hot)}, ${f(L.FAR.mantle)}, d);
      m.emis = lava * chan * (3.2 + 1.6 * hotc) * (0.75 + 0.5 * deep)
             + vec3(0.55, 0.07, 0.01) * (1.0 - chan) * (0.35 + 0.9 * crack) * (0.6 + 0.6 * deep);
      m.rough = mix(0.85, 0.4, chan); m.h = (1.0 - chan) * 0.04;
    }
  }
  // Thin darker seams between layers emphasise the cake-slice look.
  return m;
}
`;

// Inject the earth shader into a MeshStandardMaterial.
function earthMaterial({ tube = false, uniforms }) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0,
    side: THREE.FrontSide });
  if (tube && new URLSearchParams(location.search).get('debug') === 'tube') mat.defines = { DEBUG_TUBE: 1 };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\n${tube ? 'attribute float aS; varying float vS;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${tube ? `vS = aS;
        // crumbling: the wall bulges inward in the crumble zone
        float cz = smoothstep(uCrumbleS0, uCrumbleS0 + 1.5, aS) * (1.0 - smoothstep(uCrumbleS1 - 1.5, uCrumbleS1, aS));
        float cn = snoise(position * 1.3) * 0.5 + 0.5;
        transformed += normal * cz * uCrumble * (0.12 + 0.35 * cn); // normals point inward` : ''}`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>\n${tube ? NOISE_VERT : ''}\nuniform float uCrumble, uCrumbleS0, uCrumbleS1;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\n${tube ? 'varying float vS;' : ''}\n${EARTH_GLSL}\nuniform float uTubeDark;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        ${tube ? `
          if (vWPos.z > 0.0 || vWPos.y > 0.0 || vWPos.y < ${f(L.FAR_Y)}) discard;
          float tipBase = uDrillLen > 0.0 ? uTipS - uDrillLen + 0.05 : uTipS;
          float limit = max(uHole > 0.5 ? uPitDepth : -1.0, tipBase);
          if (vS > limit) discard;
        ` : `
          if (vWPos.y > 0.0 || vWPos.y < ${f(L.FAR_Y)}) discard;
          if (holeInside(vWPos.xy, ${f(Math.sqrt(L.TUNNEL_R ** 2 - L.TUNNEL_Z ** 2))}) > 0.0) discard;
        `}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float pxw = length(fwidth(vWPos));
        ${tube ? `vec3 tpa = pathAtDepth(-vWPos.y);
        float tth = atan(vWPos.z - (${f(L.TUNNEL_Z)}), vWPos.x - tpa.x);
        vec3 detailP = vec3(tth * ${f(L.TUNNEL_R)} + 40.0, vWPos.y, 0.0);` : 'vec3 detailP = vWPos;'}
        EarthMat em = earthAt(vWPos, detailP, pxw);
        ${tube ? `
          // inside the tunnel: darker toward the back, plus crumble cracks
          float back = clamp((-vWPos.z) / 2.6, 0.0, 1.0);
          float farSide = step(vWPos.y, ${f(L.CORE_Y)});
          em.albedo *= mix(0.95, 0.42, back) * uTubeDark * mix(1.0, 0.7, farSide);
          float cz = smoothstep(uCrumbleS0, uCrumbleS0 + 1.5, vS) * (1.0 - smoothstep(uCrumbleS1 - 1.5, uCrumbleS1, vS)) * uCrumble;
          float cr = abs(snoise(vWPos * 2.2));
          em.albedo *= 1.0 - cz * (1.0 - smoothstep(0.02, 0.08, cr)) * 0.8;
        ` : ''}
        diffuseColor.rgb = em.albedo;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = em.rough;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // bump from the procedural height (screen-space derivatives)
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(em.h), dhy = dFdy(em.h);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1) * faceDirection;
          vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
          normal = normalize(abs(det) * normal - grad * 1.6);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance = em.emis;
        #ifdef DEBUG_TUBE
        totalEmissiveRadiance = em.albedo * 2.0; diffuseColor.rgb = vec3(0.0);
        #endif`);
  };
  mat.customProgramCacheKey = () => (tube ? 'earth-tube' : 'earth-face');
  return mat;
}

// Small noise for the vertex shader (crumble displacement).
const NOISE_VERT = NOISE.replace(/vec4 voronoi[\s\S]*$/, '');

export function buildEarth(scene) {
  const uniforms = {
    uTime: { value: 0 }, uHeatBoost: { value: 0 }, uCoreBoost: { value: 1 },
    uTipS: { value: 0 }, uDrillLen: { value: 0 }, uPitDepth: { value: L.PIT_DEPTH }, uHole: { value: 0 },
    uCrumble: { value: 0 }, uCrumbleS0: { value: 0 }, uCrumbleS1: { value: 0 }, uTubeDark: { value: 1 },
  };
  // Cut face: one tall plane covering both halves of the Earth.
  const faceGeo = new THREE.PlaneGeometry(110, -L.FAR_Y + 2, 1, 1);
  faceGeo.translate(0, L.FAR_Y / 2, 0);
  const face = new THREE.Mesh(faceGeo, earthMaterial({ uniforms }));
  face.receiveShadow = true;
  face.name = 'cutFace';
  scene.add(face);

  // Tunnel wall: a tube along the drilled path (back half visible).
  const sMax = -L.FAR_Y + 10, ds = 0.25, seg = 40;
  const pos = [], nor = [], sAttr = [], idx = [];
  const rings = Math.ceil(sMax / ds) + 1;
  for (let i = 0; i < rings; i++) {
    const s = i * ds;
    const p = pathAtS(s);
    const n1 = new THREE.Vector3(Math.cos(p.ang), Math.sin(p.ang), 0);
    for (let j = 0; j <= seg; j++) {
      const th = Math.PI * 0.75 + (j / seg) * Math.PI * 1.5; // skip the front quarter (always cut away)
      const c = Math.cos(th), sn = Math.sin(th);
      const nx = n1.x * c, ny = n1.y * c, nz = sn;
      pos.push(p.x + nx * L.TUNNEL_R, p.y + ny * L.TUNNEL_R, L.TUNNEL_Z + nz * L.TUNNEL_R);
      nor.push(-nx, -ny, -nz); // we look at the inside of the tube
      sAttr.push(s);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + 1, c = a + seg + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const tubeGeo = new THREE.BufferGeometry();
  tubeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  tubeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  tubeGeo.setAttribute('aS', new THREE.Float32BufferAttribute(sAttr, 1));
  tubeGeo.setIndex(idx);
  const tube = new THREE.Mesh(tubeGeo, earthMaterial({ tube: true, uniforms }));
  tube.receiveShadow = true; tube.castShadow = false;
  tube.name = 'tunnelWall';
  tube.frustumCulled = false;
  scene.add(tube);

  // Pit bottom (before the drill takes over).
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(L.TUNNEL_R, 40), new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1,
    clippingPlanes: [CUT_PLANE] }));
  bottom.visible = false;
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.set(0, -L.PIT_DEPTH, L.TUNNEL_Z);
  bottom.receiveShadow = true;
  scene.add(bottom);

  return { face, tube, bottom, uniforms };
}
