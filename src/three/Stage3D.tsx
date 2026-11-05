import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import {BloomEffect, EffectComposer, EffectPass, FXAAEffect, RenderPass, ToneMappingEffect, ToneMappingMode, VignetteEffect, BrightnessContrastEffect, HueSaturationEffect} from 'postprocessing';

// Anti-aliasing: 'fxaa' is much faster in software WebGL; 'msaa' (4x) is the slow, highest-quality option.
const AA = (typeof window !== 'undefined' && (window as unknown as {remotion_inputProps?: string}).remotion_inputProps?.includes('"msaa"')) ? 'msaa' : 'fxaa';
import React, {useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

export type FX = {
	bloom?: number; // bloom intensity
	bloomThreshold?: number;
	exposure?: number; // brightness multiplier
	saturation?: number; // -1..1
	contrast?: number; // -1..1
	vignette?: number; // darkness 0..1
	env?: number; // environment reflection intensity
	bg?: string; // clear colour
	fog?: {color: string; near: number; far: number} | {color: string; density: number} | null;
};

export const DEFAULT_FX: Required<Omit<FX, 'fog'>> & {fog: FX['fog']} = {
	bloom: 0.55,
	bloomThreshold: 0.82,
	exposure: 1.0,
	saturation: 0.12,
	contrast: 0.06,
	vignette: 0.35,
	env: 0.55,
	bg: '#8fd3ff',
	fog: null,
};

const Post: React.FC<{fx: typeof DEFAULT_FX}> = ({fx}) => {
	const {gl, scene, camera, size} = useThree();
	const parts = useMemo(() => {
		const composer = new EffectComposer(gl, {frameBufferType: THREE.HalfFloatType, multisampling: AA === 'msaa' ? 4 : 0});
		const bloom = new BloomEffect({intensity: 0.6, luminanceThreshold: 0.82, luminanceSmoothing: 0.25, mipmapBlur: true, radius: 0.75});
		const tone = new ToneMappingEffect({mode: ToneMappingMode.NEUTRAL});
		const vignette = new VignetteEffect({darkness: 0.35, offset: 0.32});
		const bc = new BrightnessContrastEffect({brightness: 0, contrast: 0.06});
		const hs = new HueSaturationEffect({saturation: 0.12});
		composer.addPass(new RenderPass(scene, camera));
		composer.addPass(new EffectPass(camera, bloom, tone, bc, hs, vignette));
		if (AA === 'fxaa') composer.addPass(new EffectPass(camera, new FXAAEffect()));
		return {composer, bloom, tone, vignette, bc, hs};
	}, [gl, scene, camera]);

	useLayoutEffect(() => () => parts.composer.dispose(), [parts]);

	parts.composer.setSize(size.width, size.height);
	parts.bloom.intensity = fx.bloom;
	parts.bloom.luminanceMaterial.threshold = fx.bloomThreshold;
	parts.vignette.darkness = fx.vignette;
	parts.bc.contrast = fx.contrast;
	parts.hs.saturation = fx.saturation;
	parts.bc.brightness = (fx.exposure - 1) * 0.5;

	useFrame(() => parts.composer.render(), 1);
	return null;
};

const Env: React.FC<{intensity: number; bg: string; fog: FX['fog']}> = ({intensity, bg, fog}) => {
	const {gl, scene} = useThree();
	const envTex = useMemo(() => {
		const pm = new THREE.PMREMGenerator(gl);
		const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
		pm.dispose();
		return t;
	}, [gl]);
	scene.environment = envTex;
	scene.environmentIntensity = intensity;
	scene.background = new THREE.Color(bg);
	if (fog && 'density' in fog) {
		scene.fog = new THREE.FogExp2(fog.color, fog.density);
	} else if (fog) {
		scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
	} else {
		scene.fog = null;
	}
	return null;
};

export const Stage3D: React.FC<{fx?: FX; children: React.ReactNode; width?: number; height?: number; dpr?: number}> = ({fx, children, width = 1080, height = 1920, dpr = 1}) => {
	const f = {...DEFAULT_FX, ...(fx ?? {})};
	return (
		<ThreeCanvas
			width={width}
			height={height}
			shadows={{type: THREE.PCFSoftShadowMap}}
			camera={{fov: 40, near: 0.1, far: 2000, position: [0, 5, 20]}}
			gl={{antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true}}
			dpr={dpr}
			style={{backgroundColor: f.bg}}
		>
			<Env intensity={f.env} bg={f.bg} fog={f.fog} />
			{children}
			<Post fx={f} />
		</ThreeCanvas>
	);
};
