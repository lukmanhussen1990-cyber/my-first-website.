import {quality} from '../lib/lite';
import {useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
  BloomEffect, BrightnessContrastEffect, DepthOfFieldEffect, EffectComposer, EffectPass, GodRaysEffect,
  HueSaturationEffect, KernelSize, RenderPass, VignetteEffect,
} from 'postprocessing';

export type FX = {
  bloom?: number;
  bloomThreshold?: number;
  vignette?: number;
  dof?: {focus: number; range: number; bokeh: number} | null;
  godRays?: {position: [number, number, number]; size: number; color: string; density?: number; weight?: number} | null;
  saturation?: number; // -1..1
  brightness?: number;
  contrast?: number;
  lite?: boolean;
};

// The composer is built synchronously so the very first rendered frame already has every pass.
// (The stock <EffectComposer> sizes itself in an effect, which left each render worker's first frame black.)
export const PostFX: React.FC<FX> = ({
  bloom = 0.9, bloomThreshold = 0.62, vignette = 0.45, dof = null, godRays = null,
  saturation = 0, brightness = 0, contrast = 0, lite = false,
}) => {
  const {gl, scene, camera, size} = useThree();
  const Q = quality();
  const hasDof = !!dof && !lite && Q.dof;
  const hasRays = !!godRays && !lite && Q.rays;
  const built = useMemo(() => {
    const composer = new EffectComposer(gl, {frameBufferType: THREE.HalfFloatType, multisampling: lite ? 0 : Q.msaa});
    composer.addPass(new RenderPass(scene, camera));
    let sun: THREE.Mesh | null = null;
    let rays: GodRaysEffect | null = null;
    if (hasRays) {
      sun = new THREE.Mesh(
        new THREE.SphereGeometry(godRays!.size, 16, 12),
        new THREE.MeshBasicMaterial({color: godRays!.color, fog: false, transparent: true, depthWrite: false}),
      );
      sun.position.set(...godRays!.position);
      scene.add(sun);
      rays = new GodRaysEffect(camera, sun, {
        samples: 48, density: godRays!.density ?? 0.92, decay: 0.93, weight: godRays!.weight ?? 0.42,
        exposure: 0.55, clampMax: 1, kernelSize: KernelSize.SMALL, blur: true, resolutionScale: 0.5,
      });
    }
    const dofEffect = hasDof ? new DepthOfFieldEffect(camera, {worldFocusDistance: dof!.focus, worldFocusRange: dof!.range, bokehScale: dof!.bokeh, resolutionScale: 0.5}) : null;
    const bloomEffect = new BloomEffect({intensity: bloom, luminanceThreshold: bloomThreshold, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.72});
    const hs = new HueSaturationEffect({saturation});
    const bc = new BrightnessContrastEffect({brightness, contrast});
    const vig = new VignetteEffect({darkness: vignette, offset: 0.32});
    if (dofEffect) composer.addPass(new EffectPass(camera, dofEffect));
    composer.addPass(new EffectPass(camera, ...(rays ? [rays] : []), bloomEffect, hs, bc, vig));
    composer.setSize(size.width, size.height);
    return {composer, sun, dofEffect, bloomEffect, hs, bc, vig};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, size.width, size.height, hasDof, hasRays, lite]);

  // per-frame values (cheap to update)
  built.bloomEffect.intensity = bloom;
  built.hs.saturation = saturation;
  built.bc.brightness = brightness;
  built.bc.contrast = contrast;
  built.vig.darkness = vignette;
  if (built.dofEffect && dof) {
    built.dofEffect.cocMaterial.worldFocusDistance = dof.focus;
    built.dofEffect.cocMaterial.worldFocusRange = dof.range;
    built.dofEffect.bokehScale = dof.bokeh;
  }
  if (built.sun && godRays) built.sun.position.set(...godRays.position);

  useFrame(({gl: r, scene: sc, camera: c}) => (Q.post ? built.composer.render() : r.render(sc, c)), 1);
  return null;
};
