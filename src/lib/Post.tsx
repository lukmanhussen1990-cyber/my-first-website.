// Post-processing built directly on the `postprocessing` library, created synchronously so the
// very first frame Remotion captures is already processed (deterministic, no async setup).
// Soft bloom on bright things + tone mapping + gentle vignette, with 4x MSAA.
import React, {useEffect, useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode} from 'postprocessing';

export type PostProps = {
	bloom?: number;
	threshold?: number;
	smoothing?: number;
	radius?: number;
	vignette?: number;
	/** extra blur (0..1) used during whip pans */
	exposure?: number;
	samples?: number;
};

export const Post: React.FC<PostProps> = ({bloom = 0.75, threshold = 0.85, smoothing = 0.3, radius = 0.7, vignette = 0.35, samples = 4}) => {
	const {gl, scene, camera, size} = useThree();
	const fx = useMemo(() => {
		const composer = new EffectComposer(gl, {frameBufferType: THREE.HalfFloatType, multisampling: samples});
		composer.addPass(new RenderPass(scene, camera));
		const bloomFx = new BloomEffect({mipmapBlur: true, intensity: bloom, luminanceThreshold: threshold, luminanceSmoothing: smoothing, radius});
		const tone = new ToneMappingEffect({mode: ToneMappingMode.NEUTRAL});
		const vig = new VignetteEffect({offset: 0.3, darkness: vignette});
		composer.addPass(new EffectPass(camera, bloomFx, tone, vig));
		return {composer, bloomFx, vig};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [gl, scene, camera, samples]);

	// live parameters
	fx.bloomFx.intensity = bloom;
	fx.bloomFx.luminanceMaterial.threshold = threshold;
	fx.bloomFx.luminanceMaterial.smoothing = smoothing;
	fx.vig.darkness = vignette;

	useMemo(() => fx.composer.setSize(size.width, size.height), [fx, size.width, size.height]);
	useEffect(() => () => fx.composer.dispose(), [fx]);

	useFrame(() => {
		fx.composer.render(1 / 30);
	}, 1);
	return null;
};
