import {useFrame, useThree} from '@react-three/fiber';
import {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  VignetteEffect,
  KernelSize,
} from 'postprocessing';

// Own composer, built synchronously so the very first advance() of a render tab already
// goes through it (the @react-three/postprocessing wrapper attaches its passes too late
// for Remotion's one-shot advance and the first frame of each tab came out black).
export const PostFX: React.FC<{bloom?: number; threshold?: number; vignette?: number; enabled?: boolean}> = ({
  bloom = 1.0,
  threshold = 0.72,
  vignette = 0.45,
  enabled = true,
}) => {
  const {gl, scene, camera, size} = useThree();
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, {frameBufferType: THREE.UnsignedByteType, multisampling: 0});
    c.addPass(new RenderPass(scene, camera));
    const bloomFx = new BloomEffect({
      intensity: bloom,
      luminanceThreshold: threshold,
      luminanceSmoothing: 0.25,
      mipmapBlur: true,
      kernelSize: KernelSize.LARGE,
    });
    c.addPass(new EffectPass(camera, bloomFx, new VignetteEffect({darkness: vignette, offset: 0.32}), new SMAAEffect()));
    return c;
  }, [gl, scene, camera, bloom, threshold, vignette]);
  useLayoutEffect(() => {
    composer.setSize(size.width, size.height);
  }, [composer, size.width, size.height]);
  useLayoutEffect(() => () => composer.dispose(), [composer]);
  useFrame(() => {
    if (enabled) composer.render();
    else gl.render(scene, camera);
  }, 1);
  return null;
};
