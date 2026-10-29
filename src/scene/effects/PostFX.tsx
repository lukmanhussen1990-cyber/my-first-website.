import { useFrame, useThree } from '@react-three/fiber';
import { BloomEffect, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect } from 'postprocessing';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { HalfFloatType, Vector3, type Camera, type Data3DTexture, type Scene, type WebGLRenderer } from 'three';
import { createHazeVolume } from '../../lib/textures';
import { syncBeamUniforms } from '../environment/Dust';
import { runtime } from '../runtime';
import { GrainEffect } from './GrainEffect';
import { VolumetricBeamEffect } from './VolumetricBeamEffect';

const lensPoint = new Vector3();
const toCamera = new Vector3();

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function createPipeline(gl: WebGLRenderer, scene: Scene, camera: Camera, noise: Data3DTexture, msaa: number, steps: number) {
  const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: msaa });
  const beam = new VolumetricBeamEffect({ steps, noise });
  const beamPass = new EffectPass(camera, beam);
  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 1.05,
    luminanceSmoothing: 0.35,
    intensity: 0.85,
    radius: 0.78,
    levels: 7,
  });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.62 });
  const grain = new GrainEffect(0.011);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(beamPass);
  composer.addPass(new EffectPass(camera, bloom, tone, vignette, grain));
  // Plain record view of the effect's uniforms for the shared sync helper.
  const beamUniforms = Object.fromEntries(beam.uniforms) as Record<string, { value: unknown }>;
  return { composer, beam, beamPass, beamUniforms };
}

type Pipeline = ReturnType<typeof createPipeline>;

/**
 * HDR pipeline: scene (half-float, optional MSAA) → volumetric beam + glare →
 * bloom → AgX tone mapping → vignette → grain/dither. Owns the render loop
 * (useFrame priority 1 disables R3F's default render).
 */
export function PostFX({ msaa, beamSteps }: { msaa: number; beamSteps: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);

  const noise = useMemo(() => createHazeVolume(48, 5), []);
  useEffect(() => () => noise.dispose(), [noise]);

  const pipeline = useRef<Pipeline | null>(null);
  const settings = useRef({ msaa, beamSteps });
  settings.current = { msaa, beamSteps };

  // Built in an effect (not useMemo) so every mount owns — and disposes — its own composer.
  useLayoutEffect(() => {
    const p = createPipeline(gl, scene, camera, noise, settings.current.msaa, settings.current.beamSteps);
    pipeline.current = p;
    if (import.meta.env.DEV) Object.assign(window, { __fx: p });
    return () => {
      p.composer.dispose();
      pipeline.current = null;
    };
  }, [gl, scene, camera, noise]);

  useEffect(() => {
    if (pipeline.current) pipeline.current.composer.multisampling = msaa;
  }, [msaa]);

  useEffect(() => {
    pipeline.current?.beam.setSteps(beamSteps);
  }, [beamSteps]);

  useLayoutEffect(() => {
    pipeline.current?.composer.setSize(size.width, size.height);
  }, [size.width, size.height, dpr, gl, scene, camera, noise]);

  useFrame((_, delta) => {
    const p = pipeline.current;
    if (!p) {
      gl.render(scene, camera);
      return;
    }
    const u = p.beamUniforms;
    syncBeamUniforms(u);

    // Glare: strongest when the camera sits inside the beam cone, looking into the lens.
    lensPoint.copy(runtime.lens).addScaledVector(runtime.axis, 0.035);
    toCamera.subVectors(camera.position, lensPoint);
    const dist = toCamera.length();
    toCamera.divideScalar(dist || 1);
    const cosView = toCamera.dot(runtime.axis);
    const inBeam = smoothstep(Math.cos(Math.min(1.45, runtime.halfAngle * 1.3 + 0.08)), Math.cos(runtime.halfAngle * 0.35), cosView);
    const glare = (runtime.output * inBeam * 2.6) / Math.max(1, dist * 0.42);
    lensPoint.project(camera);
    (u.uLensScreen.value as Vector3).set(lensPoint.x * 0.5 + 0.5, lensPoint.y * 0.5 + 0.5, lensPoint.z * 0.5 + 0.5);
    u.uGlare.value = lensPoint.z < 1 ? glare : 0;
    u.uGlareSize.value = 0.075 + 0.05 * runtime.output;

    p.composer.render(delta);
  }, 1);

  return null;
}
