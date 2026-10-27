import React, {useLayoutEffect, useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {
	BloomEffect,
	BlendFunction,
	DepthOfFieldEffect,
	Effect,
	EffectComposer,
	EffectPass,
	FXAAEffect,
	KernelSize,
	RenderPass,
	ToneMappingEffect,
	ToneMappingMode,
	VignetteEffect,
} from 'postprocessing';

// Colour grade in a gamma-ish space: warmth, saturation, contrast, and a tint for the
// split screen (warm red vs. gold). Driven by the sun every frame.
const gradeFrag = /* glsl */ `
uniform float uWarmth; uniform float uSat; uniform float uContrast; uniform float uExposure;
uniform vec3 uTint; uniform float uTintAmt; uniform float uLift;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
	vec3 c = max(inputColor.rgb * uExposure, 0.0);
	c = pow(c, vec3(1.0 / 2.2));
	vec3 warm = uWarmth >= 0.0 ? vec3(1.0 + 0.09 * uWarmth, 1.0 + 0.015 * uWarmth, 1.0 - 0.11 * uWarmth)
	                           : vec3(1.0 + 0.06 * uWarmth, 1.0 + 0.01 * uWarmth, 1.0 - 0.1 * uWarmth);
	c *= warm;
	float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
	c = mix(vec3(l), c, uSat);
	c = (c - 0.5) * uContrast + 0.5;
	c = mix(c, c * uTint * 1.15 + uTint * 0.06, uTintAmt);
	c = c + uLift * (1.0 - c) * vec3(0.95, 0.9, 1.0);
	c = pow(clamp(c, 0.0, 1.0), vec3(2.2));
	outputColor = vec4(c, inputColor.a);
}`;

export class GradeEffect extends Effect {
	constructor() {
		super('GradeEffect', gradeFrag, {
			blendFunction: BlendFunction.NORMAL,
			uniforms: new Map<string, THREE.Uniform>([
				['uWarmth', new THREE.Uniform(0)],
				['uSat', new THREE.Uniform(1)],
				['uContrast', new THREE.Uniform(1)],
				['uExposure', new THREE.Uniform(1)],
				['uTint', new THREE.Uniform(new THREE.Color(1, 1, 1))],
				['uTintAmt', new THREE.Uniform(0)],
				['uLift', new THREE.Uniform(0)],
			]),
		});
	}
}

export type PostSettings = {
	bloom?: {intensity: number; threshold: number; smoothing?: number};
	dof?: {focusDistance: number; focusRange: number; bokehScale: number};
	vignette?: {offset: number; darkness: number};
	grade?: {warmth?: number; saturation?: number; contrast?: number; exposure?: number; tint?: THREE.ColorRepresentation; tintAmt?: number; lift?: number};
	fxaa?: boolean;
};

// Our own composer instead of @react-three/postprocessing: Remotion advances R3F once per
// frame from an effect that runs before that library attaches its passes, which gives a
// black still. Building the passes in useMemo makes them ready for that first advance.
export const Post: React.FC<{settings: PostSettings; frameBufferType?: THREE.TextureDataType; multisampling?: number}> = ({
	settings,
	frameBufferType = THREE.HalfFloatType,
	multisampling = 0, // MSAA costs ~0.45 s/frame on SwiftShader; FXAA does the job
}) => {
	const {gl, scene, camera, size} = useThree();
	const {bloom, dof, vignette, grade, fxaa = true} = settings;
	const hasDof = Boolean(dof);

	const pipe = useMemo(() => {
		const composer = new EffectComposer(gl, {frameBufferType, multisampling});
		composer.addPass(new RenderPass(scene, camera));
		const dofFx = hasDof ? new DepthOfFieldEffect(camera, {focusDistance: 10, focusRange: 5, bokehScale: 2, resolutionScale: 0.32}) : null;
		const bloomFx = new BloomEffect({mipmapBlur: true, intensity: 0.6, luminanceThreshold: 0.9, luminanceSmoothing: 0.25, kernelSize: KernelSize.LARGE, radius: 0.75});
		const toneFx = new ToneMappingEffect({mode: ToneMappingMode.ACES_FILMIC});
		const gradeFx = new GradeEffect();
		const vignetteFx = new VignetteEffect({offset: 0.32, darkness: 0.45});
		if (dofFx) composer.addPass(new EffectPass(camera, dofFx));
		composer.addPass(new EffectPass(camera, bloomFx, toneFx, gradeFx, vignetteFx));
		if (fxaa) composer.addPass(new EffectPass(camera, new FXAAEffect()));
		composer.setSize(size.width, size.height, false);
		return {composer, dofFx, bloomFx, gradeFx, vignetteFx};
	}, [gl, scene, camera, size.width, size.height, frameBufferType, multisampling, hasDof, fxaa]);

	// Layout effects run before Remotion's advance(), so per-frame values land in this frame.
	useLayoutEffect(() => {
		if (pipe.dofFx && dof) {
			pipe.dofFx.cocMaterial.focusDistance = dof.focusDistance;
			pipe.dofFx.cocMaterial.focusRange = dof.focusRange;
			pipe.dofFx.bokehScale = dof.bokehScale;
		}
		pipe.bloomFx.intensity = bloom?.intensity ?? 0;
		pipe.bloomFx.luminanceMaterial.threshold = bloom?.threshold ?? 1;
		pipe.bloomFx.luminanceMaterial.smoothing = bloom?.smoothing ?? 0.25;
		pipe.vignetteFx.offset = vignette?.offset ?? 0.5;
		pipe.vignetteFx.darkness = vignette?.darkness ?? 0;
		const u = pipe.gradeFx.uniforms;
		u.get('uWarmth')!.value = grade?.warmth ?? 0;
		u.get('uSat')!.value = grade?.saturation ?? 1;
		u.get('uContrast')!.value = grade?.contrast ?? 1;
		u.get('uExposure')!.value = grade?.exposure ?? 1;
		(u.get('uTint')!.value as THREE.Color).set(grade?.tint ?? '#ffffff');
		u.get('uTintAmt')!.value = grade?.tintAmt ?? 0;
		u.get('uLift')!.value = grade?.lift ?? 0;
	});

	useLayoutEffect(() => () => pipe.composer.dispose(), [pipe]);
	useFrame(() => pipe.composer.render(), 1);
	return null;
};
