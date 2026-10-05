// Uniforms shared by reference between many materials and passes, updated once
// per frame by the game loop.

import * as THREE from 'three';

export const U = {
  uTime: { value: 0 },
  uWetness: { value: 0.6 },
  uRain: { value: 0 },
  uWind: { value: new THREE.Vector2(0.6, 0.2) },
  // Centre of the two headlights in world space and the car's forward axis.
  uHeadPos: { value: new THREE.Vector3() },
  uHeadDir: { value: new THREE.Vector3(0, 0, -1) },
  uHeadOn: { value: 1 },
  uCarPos: { value: new THREE.Vector3() },
  // Planar road reflection.
  uReflTex: { value: null },
  uReflMatrix: { value: new THREE.Matrix4() },
  uReflStrength: { value: 1 },
  uLightning: { value: 0 },
};

/** GLSL for retro-reflective materials (road paint, signs, delineators). */
export const RETRO_GLSL = /* glsl */ `
uniform vec3 uHeadPos;
uniform vec3 uHeadDir;
uniform float uHeadOn;
float retroFactor(vec3 wp, vec3 wn) {
  vec3 L = wp - uHeadPos;
  float d = length(L);
  L /= max(d, 1e-3);
  float cone = smoothstep(0.78, 0.97, dot(L, uHeadDir));
  // Low beams cut off a little above the horizon (they still catch kerb-side signs).
  float rise = (wp.y - uHeadPos.y) / max(d, 1.0);
  float cut = mix(1.0, 0.12, smoothstep(0.03, 0.12, rise));
  float facing = clamp(dot(wn, -L), 0.0, 1.0);
  return uHeadOn * cone * cut * facing * 80.0 / (d * d + 30.0);
}
`;

/** Adds a world-position varying to a standard-material vertex shader (instancing aware). */
export function addWorldPosVarying(shader, name = 'vWPos') {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 ${name};`)
    .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec4 wp_ = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp_ = instanceMatrix * wp_;
        #endif
        ${name} = (modelMatrix * wp_).xyz;
      }`,
    );
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 ${name};`);
}

/**
 * Makes a MeshStandard/Physical material glow back toward the car's headlights
 * (retro-reflective sheeting). `strength` scales the effect.
 */
export function makeRetroReflective(material, strength = 1, key = 'retro') {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uHeadPos = U.uHeadPos;
    shader.uniforms.uHeadDir = U.uHeadDir;
    shader.uniforms.uHeadOn = U.uHeadOn;
    shader.uniforms.uRetroStrength = { value: strength };
    addWorldPosVarying(shader, 'vRetroWPos');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${RETRO_GLSL}\nuniform float uRetroStrength;`)
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          totalEmissiveRadiance += diffuseColor.rgb * retroFactor(vRetroWPos, wn) * uRetroStrength;
        }`,
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

/**
 * Wind sway for foliage geometry whose local Y runs 0..1 from root to tip.
 * Works for both instanced and regular meshes.
 */
export function makeSwaying(material, amount = 0.02, key = 'sway') {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uWind = U.uWind;
    shader.uniforms.uSway = { value: amount };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec2 uWind;\nuniform float uSway;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 base = vec3(0.0);
          #ifdef USE_INSTANCING
            base = instanceMatrix[3].xyz;
          #endif
          float ph = dot(base.xz, vec2(0.13, 0.17));
          float h = max(position.y, 0.0);
          float k = h * h * uSway * (0.6 + length(uWind));
          float gust = sin(uTime * 0.7 + ph * 0.3) * 0.5 + 0.5;
          transformed.x += (sin(uTime * 1.3 + ph) * 0.6 + gust * uWind.x) * k;
          transformed.z += (cos(uTime * 1.1 + ph * 1.3) * 0.6 + gust * uWind.y) * k;
        }`,
      );
  };
  material.customProgramCacheKey = () => key;
  return material;
}
