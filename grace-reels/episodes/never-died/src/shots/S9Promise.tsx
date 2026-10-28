// S9 · "And Jesus made a promise for you." Sunrise over the hill path: a trail of footprints leads along
// the path into the rising light, rays fan out, mist drifts, birds cross. The John 11:26 card sits over it.
import {useMemo} from 'react';
import * as THREE from 'three';
import {Birds} from '../fx/Birds';
import {easeInOut, keys, pulse, seg} from '../lib/ease';
import {B, SCENE} from '../lib/timeline';
import type {CamState, ShotDef} from '../render/types';
import {Dust, Footprints} from '../world/atmosphere';
import {HILL_GOLD, hillHeight, HillWorld} from '../world/HillWorld';
import {Mood, SUNRISE} from '../world/mood';

const START = SCENE.S9.start - 0.6;
const END = SCENE.S10.start + 0.6;

// The sun climbs over the far end of the path as the promise is spoken.
const sunElev = (t: number) => keys(t, [[START, 0.035], [B.keyChange, 0.045], [B.cardJohnIn, 0.095], [END, 0.125]]);
const moodAt = (t: number): Mood => {
	const e = sunElev(t);
	const d = new THREE.Vector3(0.97, e, -0.22).normalize();
	return {
		...SUNRISE,
		sunDir: [d.x, Math.max(0.12, d.y), d.z] as [number, number, number],
		skyTop: '#5d74b4',
		skyMid: '#e9b49c',
		skyHorizon: '#ffcf96',
		skyBottom: '#f0b886',
		sunColor: '#fff0c0',
		sunGlow: 0.1 + 0.08 * seg(t, B.keyChange, B.cardJohnIn),
		sunSize: 1.6,
		light: '#ffdcae',
		lightI: 1.6 + 1.0 * seg(t, B.keyChange, B.cardJohnIn),
		fog: '#f7d3a6',
		fogNear: 30,
		fogFar: 230,
		tint: '#fff2e2',
		cloud: '#ffc8a2',
	};
};
const skySun = (t: number): [number, number, number] => {
	const d = new THREE.Vector3(0.97, sunElev(t), -0.22).normalize();
	return [d.x, d.y, d.z];
};

const camera9 = (t: number): CamState => {
	const x = keys(t, [[START, -24], [END, -19.5]], (k) => k);
	return {pos: [x, hillHeight(x, 0.6) + 1.45, 0.6], target: [x + 20, hillHeight(x + 20, 0) + 0.35 + 0.25 * seg(t, START, END, easeInOut), -0.6], fov: 36, drift: 0.8};
};

// Rays of light fanning out from the sun (an additive disc far away along the sun direction).
const SunRays: React.FC<{t: number; dir: [number, number, number]; intensity: number}> = ({t, dir, intensity}) => {
	const mat = useMemo(
		() =>
			new THREE.ShaderMaterial({
				uniforms: {uT: {value: 0}, uI: {value: 1}},
				vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
				fragmentShader: `uniform float uT, uI; varying vec2 vUv;
					float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
					void main(){
						vec2 p = vUv - 0.5; float r = length(p) * 2.; float a = atan(p.y, p.x);
						float k = a * 9. + uT * 0.05;
						float rays = 0.;
						for (int i = 0; i < 3; i++) { float fi = float(i); rays += pow(0.5 + 0.5 * sin(a * (7. + fi * 5.) + uT * (0.07 + fi * 0.04) + fi * 2.), 6. + fi * 4.) * (0.6 - fi * 0.15); }
						float fall = smoothstep(1., 0.05, r) * smoothstep(0., 0.08, r);
						float core = exp(-r * r * 90.) * 0.5;
						gl_FragColor = vec4(vec3(1., 0.88, 0.62) * (rays * fall * 0.6 + core) * uI, 1.);
					}`,
				transparent: true,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				depthTest: false,
				fog: false,
			}),
		[],
	);
	mat.uniforms.uT.value = t;
	mat.uniforms.uI.value = intensity;
	const D = 400;
	return (
		<mesh position={[dir[0] * D, dir[1] * D, dir[2] * D]} material={mat} renderOrder={980} onUpdate={(m) => m.lookAt(0, 0, 0)}>
			<planeGeometry args={[520, 520]} />
		</mesh>
	);
};

const trail = () => {
	const out: {x: number; y: number; z: number; at: number; flip: boolean}[] = [];
	for (let k = 0; k < 46; k++) {
		const x = -21.5 + k * 0.42;
		const z = (k % 2 ? 0.08 : -0.08) + 0.05 * Math.sin(k * 0.4);
		out.push({x, y: hillHeight(x, z), z, at: -10, flip: k % 2 === 1});
	}
	return out;
};

const Content: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const mood = moodAt(t);
	const prints = useMemo(trail, []);
	const rays = 0.12 + 0.35 * seg(t, B.keyChange, B.cardJohnIn + 0.5, easeInOut) + 0.25 * pulse(t, B.neverDie, 0.25, 1.5);
	const c = camera9(t);
	return (
		<>
			<HillWorld t={t} mood={mood} lite={lite} lightCenter={[c.pos[0] + 12, 0, 0]} palette={HILL_GOLD} skyCurve={0.85} />
			<SunRays t={t} dir={skySun(t)} intensity={rays} />
			<Footprints prints={prints} t={t} opacity={0.5} />
			<Dust count={lite ? 60 : 150} center={[c.pos[0] + 9, 2.2, 0]} size={[12, 4, 7]} t={t} rise={0.04} px={6} opacity={0.8} seed={41} color="#fff0c4" />
			<Birds t={t} t0={START} from={[c.pos[0] + 42, 13, 18]} vel={[0.4, 0.35, -4.2]} count={lite ? 4 : 6} size={0.55} seed={7} color="#5a3e30" />
		</>
	);
};

export const S9: ShotDef = {
	id: 'S9',
	start: START,
	end: END,
	Content,
	camera: camera9,
	fog: (t) => {
		const m = moodAt(t);
		return {color: m.fog, near: m.fogNear, far: m.fogFar};
	},
	grade: (t) => ({
		exposure: 0.92 + 0.12 * seg(t, B.keyChange, B.cardJohnIn),
		saturation: 1.06,
		contrast: 1.05,
		gain: [1.04, 1.0, 0.94],
		bloom: 0.45 + 0.15 * pulse(t, B.neverDie, 0.25, 1.4),
		bloomThreshold: 0.86,
		vignette: 0.4,
	}),
};
