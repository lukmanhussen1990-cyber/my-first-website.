// Lighting, sky, fog, environment reflections and bloom presets for every place.
import React, {useLayoutEffect, useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {QUALITY} from './quality';

export type Look = {
	skyTop: string;
	skyMid: string;
	skyBottom: string;
	fog: string;
	fogNear: number;
	fogFar: number;
	hemiSky: string;
	hemiGround: string;
	hemi: number;
	ambient: number;
	sunColor: string;
	sun: number;
	sunDir: [number, number, number];
	shadowIntensity: number;
	env: number;
	exposure: number;
};

export const LOOKS: Record<string, Look> = {
	morning: {
		skyTop: '#4f9cf2', skyMid: '#9fd2ff', skyBottom: '#ffe3b8', fog: '#cfe6ff', fogNear: 40, fogFar: 170,
		hemiSky: '#cfe8ff', hemiGround: '#e8c9a0', hemi: 0.8, ambient: 0.1,
		sunColor: '#fff0d6', sun: 3.0, sunDir: [-0.55, 0.62, 0.55], shadowIntensity: 0.7, env: 0.45, exposure: 1.0,
	},
	day: {
		skyTop: '#3d8ef0', skyMid: '#8cc8ff', skyBottom: '#e6f4ff', fog: '#d6ecff', fogNear: 50, fogFar: 220,
		hemiSky: '#d8ecff', hemiGround: '#d9c7a8', hemi: 1.2, ambient: 0.25,
		sunColor: '#ffffff', sun: 2.7, sunDir: [-0.4, 0.8, 0.45], shadowIntensity: 0.6, env: 0.55, exposure: 1.0,
	},
	sunset: {
		skyTop: '#3b4fa8', skyMid: '#f08a5d', skyBottom: '#ffd27a', fog: '#f6b38a', fogNear: 30, fogFar: 160,
		hemiSky: '#ffb88a', hemiGround: '#6b4a6e', hemi: 1.0, ambient: 0.2,
		sunColor: '#ffb066', sun: 2.6, sunDir: [-0.8, 0.28, -0.35], shadowIntensity: 0.65, env: 0.45, exposure: 1.0,
	},
	night: {
		skyTop: '#040a3a', skyMid: '#0b1d78', skyBottom: '#2a3fa6', fog: '#0d1c63', fogNear: 30, fogFar: 140,
		hemiSky: '#4a62d8', hemiGround: '#1a1440', hemi: 0.75, ambient: 0.18,
		sunColor: '#a9bcff', sun: 0.9, sunDir: [0.4, 0.75, 0.3], shadowIntensity: 0.6, env: 0.25, exposure: 1.05,
	},
	interiorDay: {
		skyTop: '#9fd2ff', skyMid: '#cfe8ff', skyBottom: '#fff1d6', fog: '#f3ead8', fogNear: 60, fogFar: 200,
		hemiSky: '#fff6e8', hemiGround: '#d8b48a', hemi: 1.05, ambient: 0.35,
		sunColor: '#fff1d8', sun: 2.0, sunDir: [-0.5, 0.75, 0.6], shadowIntensity: 0.55, env: 0.6, exposure: 1.0,
	},
	interiorNight: {
		skyTop: '#040a3a', skyMid: '#0b1d78', skyBottom: '#1d2f8f', fog: '#10163f', fogNear: 40, fogFar: 160,
		hemiSky: '#5a6fe0', hemiGround: '#2a1a3a', hemi: 0.5, ambient: 0.12,
		sunColor: '#8fa6ff', sun: 0.55, sunDir: [0.6, 0.7, 0.4], shadowIntensity: 0.5, env: 0.2, exposure: 1.05,
	},
	castle: {
		skyTop: '#05040c', skyMid: '#0b0a1c', skyBottom: '#141228', fog: '#0a0914', fogNear: 8, fogFar: 60,
		hemiSky: '#3a3f7a', hemiGround: '#120d18', hemi: 0.35, ambient: 0.08,
		sunColor: '#6a7bd6', sun: 0.25, sunDir: [0.3, 0.9, 0.2], shadowIntensity: 0.6, env: 0.15, exposure: 1.1,
	},
	swamp: {
		skyTop: '#46803a', skyMid: '#8dbb5a', skyBottom: '#d9e6a2', fog: '#a9c97a', fogNear: 12, fogFar: 90,
		hemiSky: '#d8f0a0', hemiGround: '#3e5a26', hemi: 1.0, ambient: 0.22,
		sunColor: '#f2ffcf', sun: 1.8, sunDir: [-0.4, 0.7, 0.5], shadowIntensity: 0.55, env: 0.4, exposure: 1.0,
	},
	dream: {
		skyTop: '#2a1a6e', skyMid: '#7a4fd0', skyBottom: '#ffcf6e', fog: '#8a5fd6', fogNear: 30, fogFar: 120,
		hemiSky: '#ffe6b0', hemiGround: '#5a3a9a', hemi: 1.0, ambient: 0.25,
		sunColor: '#ffe2a8', sun: 2.0, sunDir: [-0.3, 0.8, 0.6], shadowIntensity: 0.55, env: 0.6, exposure: 1.0,
	},
};

export function mixLooks(a: Look, b: Look, t: number): Look {
	const c = (x: string, y: string) => '#' + new THREE.Color(x).lerp(new THREE.Color(y), t).getHexString();
	const n = (x: number, y: number) => x + (y - x) * t;
	return {
		skyTop: c(a.skyTop, b.skyTop), skyMid: c(a.skyMid, b.skyMid), skyBottom: c(a.skyBottom, b.skyBottom), fog: c(a.fog, b.fog),
		fogNear: n(a.fogNear, b.fogNear), fogFar: n(a.fogFar, b.fogFar), hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround),
		hemi: n(a.hemi, b.hemi), ambient: n(a.ambient, b.ambient), sunColor: c(a.sunColor, b.sunColor), sun: n(a.sun, b.sun),
		sunDir: [n(a.sunDir[0], b.sunDir[0]), n(a.sunDir[1], b.sunDir[1]), n(a.sunDir[2], b.sunDir[2])],
		shadowIntensity: n(a.shadowIntensity, b.shadowIntensity), env: n(a.env, b.env), exposure: n(a.exposure, b.exposure),
	};
}

// ------------------------------------------------------------------ sky dome
const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * p;
}`;
const skyFrag = /* glsl */ `
uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
varying vec3 vDir;
void main() {
  float h = vDir.y;
  vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.55, h)) : mix(mid, bottom, smoothstep(0.0, -0.25, h));
  c = mix(bottom, c, smoothstep(-0.02, 0.18, h) * 0.85 + 0.15);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export const SkyDome: React.FC<{look: Look; radius?: number}> = ({look, radius = 450}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {top: {value: new THREE.Color()}, mid: {value: new THREE.Color()}, bottom: {value: new THREE.Color()}},
				vertexShader: skyVert,
				fragmentShader: skyFrag,
				side: THREE.BackSide,
				depthWrite: false,
				fog: false,
			}),
		[],
	);
	mat.uniforms.top.value.set(look.skyTop);
	mat.uniforms.mid.value.set(look.skyMid);
	mat.uniforms.bottom.value.set(look.skyBottom);
	return (
		<mesh material={mat} renderOrder={-1000} frustumCulled={false}>
			<sphereGeometry args={[radius, 32, 16]} />
		</mesh>
	);
};

// ------------------------------------------------------- environment reflections
let envTex: THREE.Texture | null = null;
export const EnvSetup: React.FC<{intensity: number; exposure: number; background?: string | null; fog?: [string, number, number] | null}> = ({intensity, exposure, background, fog}) => {
	const {gl, scene} = useThree();
	if (!envTex) {
		const pmrem = new THREE.PMREMGenerator(gl);
		envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
		pmrem.dispose();
	}
	useLayoutEffect(() => {
		scene.environment = envTex;
		scene.environmentIntensity = intensity;
		gl.toneMappingExposure = exposure;
		scene.background = background ? new THREE.Color(background) : null;
		if (fog) {
			if (!(scene.fog instanceof THREE.Fog)) scene.fog = new THREE.Fog(fog[0], fog[1], fog[2]);
			const f = scene.fog as THREE.Fog;
			f.color.set(fog[0]);
			f.near = fog[1];
			f.far = fog[2];
		} else {
			scene.fog = null;
		}
	});
	return null;
};

// ------------------------------------------------------------------ the stage
export type StageProps = {
	look: Look;
	/** centre of the area that gets sun shadows */
	focus?: [number, number, number];
	/** half-size of the sun's shadow box */
	shadowSize?: number;
	sky?: boolean;
	fog?: boolean;
	sunShadow?: boolean;
	children?: React.ReactNode;
};

export const Stage: React.FC<StageProps> = ({look, focus = [0, 0, 0], shadowSize = 14, sky = true, fog = true, sunShadow = true, children}) => {
	const sunPos = useMemo(() => {
		const d = new THREE.Vector3(...look.sunDir).normalize().multiplyScalar(60);
		return [focus[0] + d.x, focus[1] + d.y, focus[2] + d.z] as [number, number, number];
	}, [look.sunDir, focus]);
	const target = useMemo(() => new THREE.Object3D(), []);
	target.position.set(...focus);
	target.updateMatrixWorld();
	return (
		<>
			<EnvSetup intensity={look.env} exposure={look.exposure} fog={fog ? [look.fog, look.fogNear, look.fogFar] : null} />
			{sky ? <SkyDome look={look} /> : null}
			<hemisphereLight args={[look.hemiSky, look.hemiGround, look.hemi]} />
			<ambientLight intensity={look.ambient} />
			<primitive object={target} />
			<directionalLight
				color={look.sunColor}
				intensity={look.sun}
				position={sunPos}
				target={target}
				castShadow={sunShadow}
				shadow-mapSize-width={QUALITY.shadowMap}
				shadow-mapSize-height={QUALITY.shadowMap}
				shadow-camera-left={-shadowSize}
				shadow-camera-right={shadowSize}
				shadow-camera-top={shadowSize}
				shadow-camera-bottom={-shadowSize}
				shadow-camera-near={1}
				shadow-camera-far={140}
				shadow-bias={-0.0004}
				shadow-normalBias={0.03}
				shadow-radius={4}
				shadow-intensity={look.shadowIntensity}
			/>
			{children}
		</>
	);
};
