// 2.5D building blocks: a painted layer (any sprite) placed as a flat plane in the 3D scene, and a soft
// haze plane. The camera looks down -z, so layers further back sit at more negative z and move less.
import {useMemo} from 'react';
import * as THREE from 'three';
import {PoseSprite, SpriteWarp} from '../characters/Character';
import {meta} from '../lib/textures';
import type {SpriteLook} from '../render/spriteMaterial';

export type LayerProps = {
	sprite: string;
	position: [number, number, number]; // world position of the anchor point
	width?: number; // metres across (height follows the image); or give pxPerM
	pxPerM?: number;
	anchor?: 'bottom' | 'center' | 'top' | [number, number]; // pixel of the image placed at `position`
	look?: SpriteLook;
	warp?: SpriteWarp;
	renderOrder?: number;
	flipX?: boolean;
	rot?: number; // rotation about the view axis (radians)
	segs?: [number, number];
	visible?: boolean;
};

export const Layer: React.FC<LayerProps> = ({sprite, position, width, pxPerM, anchor = 'bottom', look, warp, renderOrder = 0, flipX, rot = 0, segs = [1, 1], visible = true}) => {
	const m = meta(sprite);
	const s = pxPerM ? 1 / pxPerM : (width ?? 1) / m.w;
	const a: [number, number] =
		anchor === 'bottom' ? [m.w / 2, m.h] : anchor === 'center' ? [m.w / 2, m.h / 2] : anchor === 'top' ? [m.w / 2, 0] : anchor;
	return (
		<group position={position} rotation-z={rot} scale={[s * (flipX ? -1 : 1), s, s]} visible={visible}>
			<PoseSprite sprite={sprite} anchor={a} look={look} warp={warp} renderOrder={renderOrder} segs={segs} />
		</group>
	);
};

// A soft band of haze (mist between layers, or a glow of light behind something).
// Vertical gradient: `bottom` alpha at the lower edge fading to `top` alpha at the upper edge.
export const Haze: React.FC<{
	position: [number, number, number];
	size: [number, number];
	color: THREE.ColorRepresentation;
	bottom?: number;
	top?: number;
	additive?: boolean;
	soft?: number; // fade the left and right edges
	renderOrder?: number;
}> = ({position, size, color, bottom = 0.4, top = 0, additive = false, soft = 0.15, renderOrder = 0}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uColor: {value: new THREE.Color()}, uB: {value: 0.4}, uT: {value: 0}, uSoft: {value: 0.15}},
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
				fragmentShader: `uniform vec3 uColor; uniform float uB, uT, uSoft; varying vec2 vUv;
					void main(){
						float a = mix(uB, uT, smoothstep(0.0, 1.0, vUv.y));
						// (smoothstep with equal edges is undefined in GLSL, so soft = 0 skips the edge fade)
						if (uSoft > 0.0) a *= smoothstep(0.0, uSoft, vUv.x) * smoothstep(1.0, 1.0 - uSoft, vUv.x);
						gl_FragColor = vec4(uColor, a);
					}`,
				transparent: true,
				depthWrite: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uColor.value.set(color);
	u.uB.value = bottom;
	u.uT.value = top;
	u.uSoft.value = soft;
	mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
	return (
		<mesh position={position} material={mat} renderOrder={renderOrder} frustumCulled={false}>
			<planeGeometry args={size} />
		</mesh>
	);
};

// A radial pool of light (or shade) drawn as a flat disc facing the camera: a lamp's halo on a wall,
// moonlight behind a head, the warm spot on Jesus' face. Normal blending darkens, additive brightens.
export const Pool: React.FC<{
	position: [number, number, number];
	size: [number, number];
	color: THREE.ColorRepresentation;
	intensity: number;
	additive?: boolean;
	falloff?: number;
	renderOrder?: number;
}> = ({position, size, color, intensity, additive = true, falloff = 2.2, renderOrder = 0}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uColor: {value: new THREE.Color()}, uI: {value: 1}, uF: {value: 2.2}},
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
				fragmentShader: `uniform vec3 uColor; uniform float uI, uF; varying vec2 vUv;
					void main(){ float r = length(vUv - 0.5) * 2.0; float g = pow(max(0.0, 1.0 - r), uF);
						gl_FragColor = vec4(uColor, min(1.0, g * uI)); }`,
				transparent: true,
				depthWrite: false,
			}),
		[],
	);
	const u = mat.uniforms;
	u.uColor.value.set(color);
	u.uI.value = intensity;
	u.uF.value = falloff;
	mat.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
	return (
		<mesh position={position} material={mat} renderOrder={renderOrder} frustumCulled={false} visible={intensity > 0.001}>
			<planeGeometry args={size} />
		</mesh>
	);
};
