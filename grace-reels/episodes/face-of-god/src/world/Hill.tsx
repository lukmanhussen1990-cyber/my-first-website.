// A green Galilee hillside at sunrise (S12–S13): soft grass where the people sit, olive trees, the slope
// falling away to the lake, and the hills of the far shore in the haze. Low-poly, built once.
import {useMemo} from 'react';
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {bush, cloud, gridLine, grassTuft, mergePlaced, oliveTree, rock, roundTree, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

const LAKE_Y = -23.5;

const band = (x: number, z: number, zc: number, w: number, h: number, seed: number) => {
	const n = fbm2(x * 0.01 + seed * 7.3, seed * 3.1, seed + 40) + 0.5;
	return h * (0.35 + 0.9 * n) * Math.exp(-(((z - zc) / w) ** 2));
};

// Ground: nearly flat grass around the origin (where Jesus sits), rolling further out, falling away
// behind (-z) to the lake, rising a little behind the camera; the far shore hills beyond the water.
export const galHeight = (x: number, z: number) => {
	const roll = fbm2(x * 0.05, z * 0.05, 11) * 1.4 + fbm2(x * 0.22, z * 0.22, 12) * 0.12;
	const flat = Math.exp(-((x / 7) ** 2 + (z / 5) ** 2));
	const near = roll * (1 - 0.88 * flat);
	const down = z < -7 ? -Math.min(30, ((-z - 7) * 0.45) ** 1.18) : 0;
	const back = z > 9 ? (z - 9) * 0.1 : 0;
	const shore = Math.max(band(x, z, -300, 45, 34, 5), band(x, z, -420, 70, 60, 6));
	return Math.max(near + down + back, LAKE_Y - 3 + shore);
};

const build = () => {
	const cGrass = new THREE.Color('#8fa451');
	const cGrass2 = new THREE.Color('#6d8a3e');
	const cSoil = new THREE.Color('#a8865c');
	const cFar = new THREE.Color('#8c8aa0');
	const ground = terrainGrid({
		xs: gridLine(-420, 420, 0, 0.5, 16, 60),
		zs: gridLine(-520, 60, -1, 0.5, 16, 70),
		height: galHeight,
		seed: 71,
		jitter: 0.03,
		color: (x, y, z, ny) => {
			const n = fbm2(x * 0.06, z * 0.06, 5) * 1.5 + 0.5;
			const g = cGrass.clone().lerp(cGrass2, Math.min(1, Math.max(0, n)));
			if (ny < 0.85) g.lerp(cSoil, 0.3);
			if (z < -250) g.lerp(cFar, 0.55);
			return g;
		},
	});
	const trees: Parameters<typeof mergePlaced>[0] = [];
	const spots: [number, number, number, 'r' | 'o'][] = [
		[-6.5, -4.5, 1.1, 'o'], [7.5, -5.5, 1.2, 'o'], [-11, -2, 1.25, 'r'], [12, -1.5, 1.3, 'o'], [-15, -7, 1.3, 'o'],
		[16, -8, 1.2, 'r'], [-4, -10, 1.0, 'o'], [5, -12, 1.1, 'o'], [-20, 3, 1.4, 'o'], [21, 2, 1.3, 'r'],
		[-9, 7, 1.3, 'o'], [10, 8, 1.4, 'o'], [-26, -12, 1.3, 'r'], [27, -14, 1.3, 'o'],
	];
	spots.forEach(([x, z, s, k], i) =>
		trees.push({
			geo: k === 'r' ? roundTree(300 + i, {leaf: '#5f7d35', leaf2: '#76933f', trunk: '#5e3f27'}) : oliveTree(300 + i, {leaf: '#7f9160', leaf2: '#98a774', trunk: '#6a4a32'}),
			pos: [x, galHeight(x, z) - 0.05, z],
			rot: hash(15, i) * 6.28,
			scale: s,
		}),
	);
	const small: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 70; i++) {
		const x = (hash(41, i) - 0.5) * 30;
		const z = (hash(42, i) - 0.5) * 18 - 2;
		if (Math.hypot(x / 2.6, (z + 0.6) / 1.8) < 1) continue;
		small.push({geo: grassTuft(600 + i, '#9db35a'), pos: [x, galHeight(x, z) - 0.02, z], rot: hash(43, i) * 6, scale: 0.9 + hash(44, i) * 0.8});
	}
	for (let i = 0; i < 18; i++) {
		const x = (hash(51, i) - 0.5) * 40;
		const z = (hash(52, i) - 0.5) * 22 - 4;
		if (Math.hypot(x / 3.5, z / 2.5) < 1) continue;
		small.push({geo: hash(53, i) > 0.5 ? rock(650 + i, '#a8987e') : bush(670 + i, {a: '#6d8a3e', b: '#86a04a'}), pos: [x, galHeight(x, z) - 0.06, z], rot: hash(54, i) * 6, scale: 0.4 + hash(55, i) * 0.7});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 9; i++) {
		const a = -1.2 + (i / 8) * 2.4;
		const r = 380 + hash(61, i) * 120;
		clouds.push({geo: cloud(700 + i, '#fff1df', '#f1b9a0'), pos: [Math.sin(a) * r, 50 + hash(62, i) * 60, -Math.cos(a) * r], rot: hash(63, i), scale: 3 + hash(64, i) * 3});
	}
	return {ground, trees: mergePlaced(trees), small: mergePlaced(small), clouds: mergePlaced(clouds)};
};

// The lake: pale, hazy water, brighter toward the horizon, with a glitter path under the low sun.
const lakeMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uSun: {value: new THREE.Vector3(-0.62, 0.07, -0.78)}, uT: {value: 0}},
		vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader: `
			float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
			uniform vec3 uSun; uniform float uT; varying vec3 vW;
			void main(){
				vec3 v = normalize(vW - cameraPosition);
				float far = smoothstep(40.0, 420.0, length(vW.xz - cameraPosition.xz));
				vec3 deep = vec3(0.36, 0.55, 0.66), haze = vec3(0.93, 0.85, 0.76);
				vec3 c = mix(deep, haze, 0.25 + 0.7 * far);
				vec3 r = reflect(v, vec3(0.0, 1.0, 0.0));
				float s = max(0.0, dot(r, normalize(uSun)));
				float sparkle = step(0.82, h21(floor(vW.xz * vec2(1.4, 3.0)) + floor(uT * 6.0)));
				c += vec3(1.0, 0.9, 0.7) * (pow(s, 60.0) * 0.6 + pow(s, 400.0) * 1.2 * (0.4 + sparkle));
				gl_FragColor = vec4(c, 1.0);
			}`,
		fog: false,
	});

const mats = () =>
	cached('hillMats2', () => ({
		lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.92}),
	}));

export const GalileeWorld: React.FC<{t: number; mood: Mood; lite: boolean; center?: [number, number, number]}> = ({t, mood, lite, center = [0, 0, 0]}) => {
	const g = cached('galGeo', build);
	const m = mats();
	const lake = useMemo(lakeMaterial, []);
	lake.uniforms.uSun.value.set(...mood.sunDir);
	lake.uniforms.uT.value = t;
	m.cloud.color.set(mood.cloud);
	return (
		<>
			<Sky {...skyFromMood(mood, t)} curve={0.62} />
			<MoodLights mood={mood} center={center} span={12} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.trees} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.small} material={m.lambert} castShadow receiveShadow />
			<mesh position={[0, LAKE_Y, -260]} rotation-x={-Math.PI / 2} material={lake} renderOrder={-500}>
				<planeGeometry args={[1000, 420]} />
			</mesh>
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * 0.002} />
		</>
	);
};
