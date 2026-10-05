// Wet asphalt: lane paint drawn analytically from (lateral, along) road coords,
// puddles collecting in the wheel ruts, rain ripples, and a blurred planar
// reflection of the world above.

import * as THREE from 'three';
import { U, RETRO_GLSL } from './shared.js';
import { asphaltTextures, roadMacroTexture } from '../core/textures.js';

export function createRoadMaterial({ reflection = true } = {}) {
  const { detail, normal } = asphaltTextures();
  const macro = roadMacroTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0,
    normalMap: normal,
  });
  // Normal map UVs repeat every 3.2 m of road.
  normal.repeat.set(1 / 3.2, 1 / 3.2);

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      uTime: U.uTime,
      uWetness: U.uWetness,
      uRain: U.uRain,
      uReflTex: U.uReflTex,
      uReflMatrix: U.uReflMatrix,
      uReflStrength: U.uReflStrength,
      uHeadPos: U.uHeadPos,
      uHeadDir: U.uHeadDir,
      uHeadOn: U.uHeadOn,
      tAsphalt: { value: detail },
      tMacro: { value: macro },
    });
    shader.defines = shader.defines || {};
    if (reflection) shader.defines.USE_PLANAR_REFL = '';

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aZone;
        uniform mat4 uReflMatrix;
        varying vec2 vRoad;
        varying float vZone;
        varying vec4 vReflCoord;
        varying vec3 vRoadW;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 w = modelMatrix * vec4(transformed, 1.0);
          vRoadW = w.xyz;
          vReflCoord = uReflMatrix * w;
          vRoad = uv;
          vZone = aZone;
        }`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        ${RETRO_GLSL}
        uniform float uTime;
        uniform float uWetness;
        uniform float uRain;
        uniform sampler2D uReflTex;
        uniform float uReflStrength;
        uniform sampler2D tAsphalt;
        uniform sampler2D tMacro;
        varying vec2 vRoad;
        varying float vZone;
        varying vec4 vReflCoord;
        varying vec3 vRoadW;

        float paintLine(float x, float c, float hw) {
          float fw = fwidth(x) * 0.75 + 1e-4;
          return 1.0 - smoothstep(hw - fw, hw + fw, abs(x - c));
        }

        // Expanding rings from raindrops in standing water.
        vec2 ripples(vec2 p, float t) {
          vec2 acc = vec2(0.0);
          for (int k = 0; k < 2; k++) {
            vec2 q = p * (k == 0 ? 1.0 : 1.7) + float(k) * 7.31;
            vec2 id = floor(q);
            vec2 f = fract(q) - 0.5;
            float h = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5453);
            vec2 o = vec2(fract(h * 17.13), fract(h * 41.77)) - 0.5;
            vec2 d = f - o * 0.6;
            float r = length(d);
            float ph = fract(t * (0.9 + h * 0.6) + h);
            float ring = sin((r - ph * 0.5) * 60.0) * smoothstep(0.08, 0.0, abs(r - ph * 0.5)) * (1.0 - ph);
            acc += d / max(r, 1e-3) * ring;
          }
          return acc;
        }

        float gPaint;
        float gPuddle;
        float gAsphalt;
        vec2 gRipple;
        vec3 gPaintColor;`,
      )
      .replace(
        '#include <map_fragment>',
        `
        float ad = abs(vRoad.x);
        vec2 microUv = vRoad / 3.2;
        vec4 micro = texture2D(tAsphalt, microUv);
        vec4 macro = texture2D(tMacro, vRoad / 46.0);
        vec4 macro2 = texture2D(tMacro, vRoad.yx / 117.0 + 0.31);
        gAsphalt = 1.0 - smoothstep(4.52, 4.68, ad);

        vec3 asphalt = vec3(0.062, 0.062, 0.066) * (0.72 + 0.56 * micro.g);
        asphalt = mix(asphalt, asphalt * 0.6, macro.g * 0.85);
        asphalt *= 0.8 + 0.4 * macro2.a;
        float crack = macro.b * smoothstep(0.35, 0.6, macro2.r);
        asphalt = mix(asphalt, vec3(0.012), crack * 0.9);
        // Oily centre of each lane and lighter worn wheel paths.
        asphalt *= 1.0 - 0.25 * exp(-pow((ad - 1.75) / 0.5, 2.0));
        vec3 gravel = vec3(0.105, 0.098, 0.088) * (0.55 + 0.9 * micro.r);
        vec3 base = mix(gravel, asphalt, gAsphalt);

        // Lane paint: double yellow (no-passing) or dashed centre, white edge lines.
        float wear = smoothstep(0.08, 0.42, micro.r * 0.7 + macro2.a * 0.6);
        float dash = step(fract(vRoad.y / 12.0), 0.3);
        float yellowSolid = paintLine(vRoad.x, -0.11, 0.05) + paintLine(vRoad.x, 0.11, 0.05);
        float yellowDash = paintLine(vRoad.x, 0.0, 0.06) * dash;
        float yellow = mix(yellowDash, yellowSolid, vZone) * wear;
        float white = paintLine(ad, 3.55, 0.065) * wear;
        gPaint = clamp(yellow + white, 0.0, 1.0);
        gPaintColor = yellow > white ? vec3(0.62, 0.43, 0.08) : vec3(0.62, 0.62, 0.6);
        base = mix(base, gPaintColor, gPaint);

        // Water: wet darkening, puddles pooling in the ruts and low spots.
        float rut = exp(-pow((ad - 0.9) / 0.33, 2.0)) + exp(-pow((ad - 2.62) / 0.33, 2.0));
        float water = macro.r * 1.15 + rut * 0.3 + (1.0 - gAsphalt) * 0.1 - 0.42;
        gPuddle = smoothstep(0.12, 0.22, water) * smoothstep(0.25, 0.75, uWetness);
        gPuddle *= 1.0 - gPaint * 0.6;
        base *= mix(1.0, 0.5, uWetness);
        base = mix(base, base * 0.55, gPuddle);
        diffuseColor.rgb = base;
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
        float dryRough = mix(0.86, 0.7, micro.b);
        float wetRough = mix(0.36, 0.2, micro.b);
        float roughnessFactor = mix(dryRough, wetRough, uWetness);
        roughnessFactor = mix(roughnessFactor, 0.035, gPuddle);
        roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.45), gPaint * (1.0 - uWetness * 0.5));
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `
        vec3 mapN = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
        mapN.xy *= mix(1.0, 0.45, uWetness) * (1.0 - gPuddle * 0.92);
        gRipple = ripples(vRoad * 1.6, uTime) * gPuddle * uRain;
        mapN.xy += gRipple * 0.5;
        normal = normalize(tbn * mapN);
        `,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        {
          // Glass beads in the paint bounce headlight back at the car.
          vec3 wn = inverseTransformDirection(normal, viewMatrix);
          totalEmissiveRadiance += gPaintColor * gPaint * retroFactor(vRoadW, wn) * 0.35;
        }`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        #ifdef USE_PLANAR_REFL
        {
          vec2 ruv = vReflCoord.xy / vReflCoord.w;
          ruv += mapN.xy * 0.018 + gRipple * 0.02;
          float lod = clamp(roughnessFactor * 9.0, 0.0, 6.0);
          vec3 refl = textureLod(uReflTex, ruv, lod).rgb;
          float NdV = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
          float gloss = 1.0 - roughnessFactor;
          float amt = F * gloss * gloss * uWetness * uReflStrength;
          // Fade where the reflection texture runs out at the screen edges.
          vec2 edge = smoothstep(vec2(0.0), vec2(0.04), ruv) * smoothstep(vec2(1.0), vec2(0.96), ruv);
          reflectedLight.indirectSpecular += refl * amt * edge.x * edge.y;
        }
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => `road-${reflection ? 1 : 0}`;
  return mat;
}
