// Shader injections shared by many materials: wind sway, cut-hole in the soil.
import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  // hole at the pole (cutaway). open = depth of open cavity, disturbed = deepest dig so far
  uHoleX: { value: 0 },
  uHoleZ: { value: 0.3 },
  uHoleR: { value: 0.2 },
  uHoleOpen: { value: 0 },
  uHoleDisturbed: { value: 0 },
  uBushShake: { value: new THREE.Vector4(0, 0, 0, 0) }, // per-bush shake amounts
};

const WIND_GLSL = /* glsl */`
uniform float uTime;
uniform float uWind;
uniform float uSwayAmp;
uniform float uSwayRef;
#ifdef SWAY_ATTR
attribute float aSway;
#endif
vec3 windOffset(vec3 wp, float w) {
  float ph = dot(wp.xz, vec2(0.83, 0.57));
  float gust = 0.65 + 0.35 * sin(uTime * 0.55 + wp.x * 0.21 - wp.z * 0.13);
  vec2 d = vec2(sin(uTime * 1.7 + ph * 1.3) + 0.35 * sin(uTime * 3.3 + ph * 2.7),
                0.45 * cos(uTime * 1.25 + ph * 0.9));
  return vec3(d.x, -0.12 * abs(d.x) * w, d.y) * uSwayAmp * uWind * gust * w * w;
}
`;

function windProjectChunk() {
  return /* glsl */`
  vec4 swp = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    swp = instanceMatrix * swp;
  #endif
  swp = modelMatrix * swp;
  #ifdef SWAY_ATTR
    float sw = aSway;
  #else
    float sw = clamp(transformed.y / uSwayRef, 0.0, 1.5);
  #endif
  swp.xyz += windOffset(swp.xyz, sw);
  vec4 mvPosition = viewMatrix * swp;
  gl_Position = projectionMatrix * mvPosition;
  `;
}

function injectWind(shader, amp, ref, attr) {
  shader.uniforms.uTime = U.uTime;
  shader.uniforms.uWind = U.uWind;
  shader.uniforms.uSwayAmp = { value: amp };
  shader.uniforms.uSwayRef = { value: ref };
  if (attr) shader.defines = { ...(shader.defines || {}), SWAY_ATTR: '' };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n' + WIND_GLSL)
    .replace('#include <project_vertex>', windProjectChunk());
}

// Make a material sway in the wind. Returns { material, depth } (depth for shadow casting).
export function windy(material, { amp = 0.05, ref = 1, attr = false } = {}) {
  const key = `wind-${amp}-${ref}-${attr}`;
  material.onBeforeCompile = (sh) => injectWind(sh, amp, ref, attr);
  material.customProgramCacheKey = () => key;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: material.side });
  depth.onBeforeCompile = (sh) => injectWind(sh, amp, ref, attr);
  depth.customProgramCacheKey = () => key + '-d';
  return { material, depth };
}

// Soil hole: discard the open cavity on the cut face (mode 0) or the top surface (mode 1),
// and tint the disturbed (backfilled) soil.
const HOLE_FRAG_PARS = /* glsl */`
uniform float uHoleX, uHoleZ, uHoleR, uHoleOpen, uHoleDisturbed;
varying vec3 vWPos;
float hnoise(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hnoise(i), hnoise(i + vec2(1, 0)), f.x), mix(hnoise(i + vec2(0, 1)), hnoise(i + vec2(1, 1)), f.x), f.y); }
// signed distance to U-shaped hole profile of given depth (negative inside)
float holeSD(vec2 p, float depth, float r) {
  if (depth <= 0.001) return 1.0;
  float rr = r * (1.0 - 0.18 * smoothstep(0.0, 1.3, -p.y)); // slightly tapered
  float yc = -depth + rr;
  if (p.y > yc) return max(abs(p.x) - rr, p.y - 0.02);
  return length(vec2(p.x, p.y - yc)) - rr;
}
`;

export function holeMaterial(material, mode) {
  const key = 'hole' + mode;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    for (const k of ['uHoleX', 'uHoleZ', 'uHoleR', 'uHoleOpen', 'uHoleDisturbed']) sh.uniforms[k] = U[k];
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const body = mode === 0 ? /* glsl */`
      vec2 hp = vec2(vWPos.x - uHoleX, vWPos.y);
      float wob = (vn(hp * 18.0) - 0.5) * 0.025;
      float dOpen = holeSD(hp, uHoleOpen, uHoleR) + wob;
      if (dOpen < 0.0) discard;
      float dDist = holeSD(hp, uHoleDisturbed, uHoleR * 1.05) + wob;
      float fillMask = 1.0 - smoothstep(-0.008, 0.008, dDist);
      if (fillMask > 0.0) {
        float n = vn(hp * 34.0) * 0.6 + vn(hp * 90.0) * 0.4;
        vec3 fillCol = mix(vec3(0.11, 0.068, 0.04), vec3(0.2, 0.125, 0.075), n);
        diffuseColor.rgb = mix(diffuseColor.rgb, fillCol, fillMask);
      }
      // dark rim around the open cavity
      diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.03, dOpen));
      // occlusion under the turf lip and a gentle darkening with depth
      diffuseColor.rgb *= mix(0.45, 1.0, smoothstep(-0.015, -0.16, vWPos.y)) * mix(1.0, 0.62, smoothstep(-0.3, -4.2, vWPos.y));
    ` : /* glsl */`
      vec2 hp = vec2(vWPos.x - uHoleX, vWPos.z - uHoleZ);
      float rad = length(hp);
      float wob = (vn(hp * 20.0) - 0.5) * 0.03;
      if (uHoleOpen > 0.02 && rad < uHoleR * 1.0 + wob) discard;
      float dist = smoothstep(uHoleR * 2.2, uHoleR * 1.1, rad + wob) * step(0.001, uHoleDisturbed);
      if (dist > 0.0) {
        float n = vn(hp * 40.0) * 0.6 + vn(hp * 110.0) * 0.4;
        vec3 fillCol = mix(vec3(0.15, 0.09, 0.05), vec3(0.28, 0.18, 0.1), n);
        diffuseColor.rgb = mix(diffuseColor.rgb, fillCol, dist);
      }
      if (uHoleOpen > 0.02) diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(uHoleR, uHoleR * 1.35, rad));
    `;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + HOLE_FRAG_PARS)
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + body);
  };
  material.customProgramCacheKey = () => key;
  return material;
}
