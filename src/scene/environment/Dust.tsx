import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { AdditiveBlending, BufferGeometry, Color, DepthTexture, Float32BufferAttribute, LessEqualCompare, Matrix4, Points, ShaderMaterial, Vector3 } from 'three';
import { mulberry32 } from '../../lib/noise';
import { beamFunctionsGLSL, beamUniformsGLSL } from '../effects/beamGLSL';
import { runtime } from '../runtime';
import { FLOOR_Y } from './Studio';

const MAX_MOTES = 3000;

const vertexShader = /* glsl */ `
${beamUniformsGLSL}
attribute vec4 aSeed;
uniform float uTime;
uniform float uViewportHeight;
uniform float uSize;
uniform float uFocus;
uniform float uGain;
varying float vBrightness;
varying float vSoft;

${beamFunctionsGLSL}

void main() {
  vec3 p = position;
  float t = uTime;
  // Slow Brownian-like drift plus a gentle settling motion.
  p += vec3(
    sin(t * (0.05 + 0.06 * aSeed.x) + aSeed.y * 6.2831),
    sin(t * (0.04 + 0.05 * aSeed.z) + aSeed.w * 6.2831) * 0.55 - mod(t * 0.012 * (0.5 + aSeed.x), 2.0) + 1.0,
    cos(t * (0.05 + 0.05 * aSeed.w) + aSeed.x * 6.2831)
  ) * 0.32;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  float depth = max(-mv.z, 0.05);

  vec3 lightDir;
  float field = beamField(world.xyz, lightDir);
  float lit = 0.0;
  if (field > 0.0 && uIntensity > 0.0) {
    vec3 toCam = normalize(cameraPosition - world.xyz);
    float phase = henyeyGreenstein(dot(lightDir, toCam), 0.55);
    float twinkle = 0.55 + 0.45 * sin(t * (1.3 + aSeed.y * 2.7) + aSeed.z * 40.0);
    lit = uIntensity * field * beamShadow(world.xyz) * phase * twinkle * uGain;
  }

  // Out-of-focus motes grow into soft bokeh discs while conserving energy.
  float coc = clamp(abs(depth - uFocus) / depth, 0.0, 1.5);
  float grow = 1.0 + coc * 7.0;
  float size = uSize * (0.6 + 0.8 * aSeed.w) * grow;
  gl_PointSize = clamp(size * uViewportHeight / depth, 1.0, 48.0);
  vBrightness = (isnan(lit) || isinf(lit)) ? 0.0 : lit / (grow * grow);
  vSoft = clamp(coc * 1.4, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  if (lit <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // cull motes outside the beam
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uBeamColor;
varying float vBrightness;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float sharp = 1.0 - smoothstep(0.35, 1.0, r);
  float bokeh = (1.0 - smoothstep(0.82, 1.0, r)) * (0.75 + 0.25 * smoothstep(0.5, 0.95, r));
  float shape = mix(sharp, bokeh, vSoft);
  if (shape * vBrightness < 1e-4) discard;
  gl_FragColor = vec4(uBeamColor * vBrightness * shape, 1.0);
}
`;

export function Dust({ count }: { count: number }) {
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const { points, material, geometry } = useMemo(() => {
    const rnd = mulberry32(99);
    const positions = new Float32Array(MAX_MOTES * 3);
    const seeds = new Float32Array(MAX_MOTES * 4);
    for (let i = 0; i < MAX_MOTES; i++) {
      // Denser near the torch where the beam is narrow and bright.
      const r = 0.45 + 10.5 * Math.pow(rnd(), 1.55);
      const theta = rnd() * Math.PI * 2;
      const y = FLOOR_Y + 0.05 + rnd() * 6.2;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.max(FLOOR_Y + 0.05, Math.min(5, y * (0.4 + 0.6 * (r / 11)) + (rnd() - 0.5) * 0.8));
      positions[i * 3 + 2] = Math.sin(theta) * r;
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = rnd();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new Float32BufferAttribute(seeds, 4));
    const material = new ShaderMaterial({
      name: 'dust-motes',
      vertexShader,
      fragmentShader,
      uniforms: {
        uApex: { value: new Vector3() },
        uAxis: { value: new Vector3(0, 0, 1) },
        uHalfAngle: { value: 0.25 },
        uTanHalf: { value: 0.25 },
        uCosHalf: { value: 0.97 },
        uLensDist: { value: 0.6 },
        uBeamLength: { value: 36 },
        uHotspot: { value: 0.5 },
        uSpill: { value: 0.16 },
        uSoftness: { value: 0.4 },
        uRings: { value: 0.5 },
        uIntensity: { value: 0 },
        uBeamColor: { value: new Color() },
        uShadowMatrix: { value: new Matrix4() },
        uShadowBias: { value: 0.0008 },
        uHasShadow: { value: 0 },
        uShadowMap: { value: fallbackShadowMap },
        uTime: { value: 0 },
        uViewportHeight: { value: 800 },
        uSize: { value: 0.011 },
        uFocus: { value: 4 },
        uGain: { value: 0.0016 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    return { points, material, geometry };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useEffect(() => {
    geometry.setDrawRange(0, Math.min(MAX_MOTES, count));
  }, [geometry, count]);

  useEffect(() => {
    material.uniforms.uViewportHeight.value = size.height * dpr;
  }, [material, size.height, dpr]);

  useFrame((state, dt) => {
    const u = material.uniforms;
    u.uTime.value += Math.min(dt, 0.05);
    syncBeamUniforms(u);
    u.uFocus.value = state.camera.position.distanceTo(runtime.lens) * 0.92;
    points.visible = runtime.intensity > 1e-3;
  });

  return <primitive object={points} />;
}

type UniformMap = Record<string, { value: unknown }>;

/**
 * Valid depth-compare texture for shadow samplers until the spotlight's map
 * exists (it is created inside the first render, after uniforms are synced).
 * three's own fallback is never uploaded, so it binds a colour texture to the
 * shadow sampler and WebGL rejects the draw. `needsUpdate` forces a real depth
 * upload with compare mode. Never actually sampled: uHasShadow gates it.
 */
export const fallbackShadowMap = (() => {
  const tex = new DepthTexture(1, 1);
  tex.compareFunction = LessEqualCompare;
  tex.needsUpdate = true;
  return tex;
})();

/** Copies the current beam frame/profile/shadow into a beam-uniform block. */
export function syncBeamUniforms(u: UniformMap) {
  const lensDist = runtime.lensRadius / Math.tan(runtime.halfAngle);
  (u.uApex.value as Vector3).copy(runtime.apex);
  (u.uAxis.value as Vector3).copy(runtime.axis);
  u.uHalfAngle.value = runtime.halfAngle;
  u.uTanHalf.value = Math.tan(runtime.halfAngle);
  u.uCosHalf.value = Math.cos(runtime.halfAngle);
  u.uLensDist.value = lensDist;
  u.uHotspot.value = runtime.hotspot;
  u.uSpill.value = runtime.spill;
  u.uSoftness.value = runtime.softness;
  u.uRings.value = runtime.rings;
  u.uIntensity.value = runtime.intensity;
  (u.uBeamColor.value as Color).copy(runtime.color);
  const light = runtime.light;
  const map = light?.shadow.map?.depthTexture ?? null;
  u.uShadowMap.value = map ?? fallbackShadowMap;
  u.uHasShadow.value = map ? 1 : 0;
  if (light && map) {
    // The renderer refreshes this during render(); do it now so this frame's pose is used.
    light.shadow.updateMatrices(light);
    (u.uShadowMatrix.value as Matrix4).copy(light.shadow.matrix);
  }
}
