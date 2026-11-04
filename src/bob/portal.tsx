// Render a little 3D scene into a texture (old photos), and show textures with a vintage photo look.
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {createPortal, useFrame} from '@react-three/fiber';
import {V3} from '../lib/anim';
import {plane} from '../lib/materials';
import {CameraRig} from '../lib/CameraRig';
import {QUALITY} from '../lib/quality';

export type Cam = {pos: V3; target: V3; fov: number};

export const useRT = (w: number, h: number) => {
	const dpr = QUALITY.dpr;
	return useMemo(() => new THREE.WebGLRenderTarget(Math.round(w * dpr), Math.round(h * dpr), {samples: 4, type: THREE.HalfFloatType}), [w, h, dpr]);
};

/** renders children into rt every frame (before the main scene), seen from cam */
export const RTPortal: React.FC<{rt: THREE.WebGLRenderTarget; cam: Cam; children: React.ReactNode}> = ({rt, cam, children}) => {
	const scene = useMemo(() => new THREE.Scene(), []);
	const camera = useMemo(() => new THREE.PerspectiveCamera(30, 1, 0.05, 900), []);
	camera.aspect = rt.width / rt.height;
	camera.fov = cam.fov;
	camera.position.set(...cam.pos);
	camera.up.set(0, 1, 0);
	camera.lookAt(new THREE.Vector3(...cam.target));
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	useFrame(({gl}) => {
		const prev = gl.getRenderTarget();
		gl.setRenderTarget(rt);
		gl.setClearColor('#000000', 1);
		gl.clear(true, true, true);
		gl.render(scene, camera);
		gl.setRenderTarget(prev);
	}, 0);
	return <>{createPortal(children, scene)}</>;
};

/** vintage photo look: soft shoulder, a touch of sepia, faded blacks, warm whites, vignette, grain, optional paper border */
export function vintageMaterial(tex: THREE.Texture, opts: {sepia?: number; border?: number; fade?: number} = {}) {
	return new THREE.ShaderMaterial({
		uniforms: {map: {value: tex}, border: {value: opts.border ?? 0.06}, sepia: {value: opts.sepia ?? 0.3}, fade: {value: opts.fade ?? 1}},
		vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
		fragmentShader: `
			uniform sampler2D map; uniform float border; uniform float sepia; uniform float fade; varying vec2 vUv;
			float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
			void main(){
				vec2 b = vec2(border * 0.75, border);
				vec2 inUv = (vUv - b) / (1.0 - 2.0 * b);
				if (inUv.x < 0.0 || inUv.x > 1.0 || inUv.y < 0.0 || inUv.y > 1.0) {
					gl_FragColor = vec4(vec3(0.93, 0.9, 0.82) * (0.93 + 0.05 * h(floor(vUv * 300.0))), 1.0);
					return;
				}
				vec3 c = texture2D(map, inUv).rgb;
				c = mix(c, 0.8 + 0.2 * (1.0 - exp(-(c - 0.8) / 0.2)), step(0.8, c));
				c = pow(max(c, 0.0), vec3(1.0 / 2.2));
				float l = dot(c, vec3(0.299, 0.587, 0.114));
				vec3 sep = vec3(l * 1.07 + 0.05, l * 0.93 + 0.03, l * 0.72);
				c = mix(c, sep, sepia);
				c = mix(c, mix(vec3(0.1, 0.08, 0.06), vec3(0.98, 0.94, 0.84), c), 0.55 * fade);
				vec2 q = inUv - 0.5;
				c *= 1.0 - dot(q, q) * 0.8;
				c += (h(floor(inUv * 420.0)) - 0.5) * 0.04;
				c = pow(max(c, 0.0), vec3(2.2));
				gl_FragColor = vec4(c, 1.0);
			}`,
	});
}

/** fills the whole frame with a texture (vintage look, no border) */
export const FullScreenRT: React.FC<{rt: THREE.WebGLRenderTarget; sepia?: number}> = ({rt, sepia = 0.25}) => {
	const mat = useMemo(() => vintageMaterial(rt.texture, {border: 0, sepia}), [rt, sepia]);
	const h = 2 * 10 * Math.tan((50 / 2) * (Math.PI / 180));
	const w = (h * 1080) / 1920;
	return (
		<>
			<mesh geometry={plane(w, h)} material={mat} />
			<CameraRig pos={[0, 0, 10]} target={[0, 0, 0]} fov={50} sway={0} />
		</>
	);
};
