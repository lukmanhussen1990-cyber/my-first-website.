// S2: the storyteller. A golden afternoon on the shore of the lake: Jesus sits in a small boat just off the
// beach and teaches; the whole crowd stands on the sand (Matthew 13:2). A long lens over their heads.
import {useMemo} from 'react';
import * as THREE from 'three';
import {blend, idle, talk} from '../characters/acting';
import {Person} from '../characters/Puppet';
import {PoseSprite} from '../characters/Character';
import {easeInOut, lerp, seg} from '../lib/ease';
import {fbm2, hash} from '../lib/random';
import {SPRITES} from '../lib/textures';
import {B} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Sky} from '../world/atmosphere';
import {cached} from '../world/cache';
import {MoodLights} from '../world/Lights';
import {cloud, gridLine, mergePlaced, paintFaces, rock, terrainGrid} from '../world/lowpoly';
import {GALILEE, Mood, skyFromMood} from '../world/mood';
import {faceCam, fogOf, GOLDEN_GRADE, lookIn, screenLight} from './common';

const dirOf = (azDeg: number, elDeg: number): Vec3 => {
	const a = (azDeg * Math.PI) / 180;
	const e = (elDeg * Math.PI) / 180;
	return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};

// golden afternoon over the water, the sun low on the left so the lake glitters
const SHORE: Mood = {
	...GALILEE,
	skyTop: '#7f9cc8',
	skyMid: '#d6c3b4',
	skyHorizon: '#ffd49a',
	skyBottom: '#e9c49a',
	sunDir: dirOf(-38, 13),
	sunGlow: 0.24,
	sunSize: 2.2,
	light: '#ffdcae',
	lightI: 2.2,
	fog: '#f0d6b4',
	fogNear: 50,
	fogFar: 520,
};

// beach: dry sand up the slope, wet darker sand at the edge, the floor dropping away under the water
const shoreHeight = (x: number, z: number) => {
	const slope = 0.09 * (z + 1.5) + 0.06 * fbm2(x * 0.08, z * 0.08, 4);
	const back = Math.max(0, z - 10) * 0.25 + Math.max(0, z - 18) * 0.6 * (fbm2(x * 0.03, 2, 5) + 0.8);
	return Math.min(slope, 0.1 * (z + 1.5)) + back - Math.max(0, -z - 2) * 0.12;
};
const SAND = new THREE.Color('#e3c79a');
const WET = new THREE.Color('#b79a72');
const GRASS = new THREE.Color('#9a9a58');

const buildShore = () => {
	const ground = terrainGrid({
		xs: gridLine(-160, 160, 0, 0.6, 12, 60),
		zs: gridLine(-40, 120, 2, 0.5, 12, 50),
		height: shoreHeight,
		seed: 61,
		wobble: 0.25,
		color: (x, y, z) => {
			if (y < 0.06) return WET.clone().lerp(SAND, Math.max(0, y / 0.06));
			if (z > 12) return SAND.clone().lerp(GRASS, Math.min(1, (z - 12) / 8));
			return SAND.clone().multiplyScalar(0.95 + 0.1 * fbm2(x, z, 9));
		},
	});
	// the far shore: hills across the lake, hazy
	const far = terrainGrid({
		xs: gridLine(-700, 700, 0, 18, 40, 400),
		zs: gridLine(-700, -260, -300, 14, 30, 200),
		height: (x, z) => Math.max(0, 22 + 46 * (fbm2(x * 0.004, z * 0.006, 12) + 0.35) * Math.min(1, (-z - 260) / 60)),
		seed: 62,
		color: (x, y) => new THREE.Color('#8f8a66').lerp(new THREE.Color('#6f7a58'), Math.min(1, y / 60)),
	});
	const rocks: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 26; i++) {
		const x = (hash(63, i) - 0.5) * 60;
		const z = -1.5 + hash(64, i) * 14;
		if (Math.abs(x) < 6 && z < 8) continue;
		rocks.push({geo: rock(400 + i, '#a8977c'), pos: [x, shoreHeight(x, z), z], rot: hash(65, i) * 6, scale: 0.4 + hash(66, i) * 0.7});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 9; i++) {
		const a = -1.0 + (i / 8) * 2.0;
		clouds.push({geo: cloud(940 + i, '#fff3e0', '#efc0a0'), pos: [Math.sin(a) * 420, 70 + hash(67, i) * 60, -Math.cos(a) * 420], rot: hash(68, i), scale: 3 + hash(69, i) * 3});
	}
	return {ground, far, rocks: mergePlaced(rocks), clouds: mergePlaced(clouds)};
};

// A small fishing boat: a curved hull of planks, a gunwale and two thwarts.
const buildBoat = () => {
	const L = 5.2;
	const W = 1.7;
	const D = 0.75;
	const nx = 14;
	const ny = 6;
	const pos: number[] = [];
	const at = (i: number, j: number): [number, number, number] => {
		const u = i / nx - 0.5; // along
		const v = j / ny; // 0 keel .. 1 gunwale (one side)
		const half = (W / 2) * Math.pow(Math.max(0, 1 - Math.pow(2 * Math.abs(u), 2.6)), 0.6);
		const sheer = 0.18 * Math.pow(2 * Math.abs(u), 2);
		const y = -D * (1 - v * v) * (1 - 0.35 * Math.pow(2 * Math.abs(u), 3)) + sheer * v;
		return [u * L, y, half * Math.sin((v * Math.PI) / 2)];
	};
	for (const side of [-1, 1]) {
		for (let i = 0; i < nx; i++) {
			for (let j = 0; j < ny; j++) {
				const p = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)].map((q) => [q[0], q[1], q[2] * side]);
				const tri = side > 0 ? [p[0], p[1], p[2], p[0], p[2], p[3]] : [p[0], p[2], p[1], p[0], p[3], p[2]];
				for (const q of tri) pos.push(...q);
			}
		}
	}
	const hull = new THREE.BufferGeometry();
	hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	const parts = [paintFaces(hull, (x, y) => new THREE.Color(y > -0.12 ? '#8a5a36' : '#6e4a2e').multiplyScalar(0.92 + 0.12 * Math.sin(y * 40)), 0.06, 3)];
	for (const side of [-1, 1]) {
		const rail = new THREE.BoxGeometry(L * 0.94, 0.08, 0.1);
		rail.translate(0, 0.02, side * (W / 2 - 0.02));
		parts.push(paintFaces(rail, () => '#5e3c22', 0.04, 4 + side));
	}
	for (const x of [-0.9, 0.9]) {
		const th = new THREE.BoxGeometry(0.28, 0.06, W * 0.92);
		th.translate(x, -0.18, 0);
		parts.push(paintFaces(th, () => '#7a5232', 0.04, 7));
	}
	return mergePlaced(parts.map((geo) => ({geo, pos: [0, 0, 0] as Vec3})));
};

// The lake: deep teal far out, turquoise over the shallows, the sky's colour at grazing angles, a path of
// glitter toward the sun, all from moving noise (no textures).
const lakeMaterial = () =>
	new THREE.ShaderMaterial({
		uniforms: {uT: {value: 0}, uSun: {value: new THREE.Vector3()}, uSunC: {value: new THREE.Color()}, uSky: {value: new THREE.Color()}, uHorizon: {value: new THREE.Color()}, uFog: {value: new THREE.Color()}},
		vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
		fragmentShader: `
			uniform float uT; uniform vec3 uSun, uSunC, uSky, uHorizon, uFog; varying vec3 vW;
			float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
			float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
				return mix(mix(h21(i),h21(i+vec2(1,0)),u.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y); }
			float waves(vec2 p){ return vn(p * 1.3 + vec2(uT * 0.35, uT * 0.2)) * 0.6 + vn(p * 3.1 - vec2(uT * 0.5, -uT * 0.3)) * 0.3 + vn(p * 7.0 + vec2(0., uT * 0.8)) * 0.1; }
			void main(){
				vec2 p = vW.xz;
				float e = 0.08;
				float h0 = waves(p);
				vec3 n = normalize(vec3((h0 - waves(p + vec2(e, 0.))) * 1.6, 1.0, (h0 - waves(p + vec2(0., e))) * 1.6));
				vec3 V = normalize(cameraPosition - vW);
				float fres = pow(1.0 - max(0.0, dot(n, V)), 4.0);
				float shallow = smoothstep(-6.0, 0.5, vW.z);
				vec3 deep = mix(vec3(0.07, 0.24, 0.3), vec3(0.2, 0.46, 0.46), shallow);
				vec3 col = mix(deep, mix(uHorizon, uSky, 0.35), 0.25 + 0.6 * fres);
				vec3 R = reflect(-V, n);
				float sp = pow(max(0.0, dot(R, normalize(uSun))), 220.0);
				float glint = step(0.78, vn(p * 9.0 + vec2(uT * 2.0, -uT))) * pow(max(0.0, dot(R, normalize(uSun))), 18.0);
				col += uSunC * (sp * 3.0 + glint * 1.6);
				// a soft line of foam where the water meets the sand
				float foam = smoothstep(0.35, 0.0, abs(vW.z + 1.55 + 0.25 * sin(p.x * 0.7 + uT * 0.9) * 0.4)) * (0.5 + 0.5 * vn(p * 4.0 + uT));
				col = mix(col, vec3(0.98, 0.96, 0.9), foam * 0.6);
				float d = length(cameraPosition - vW);
				col = mix(col, uFog, smoothstep(60.0, 520.0, d) * 0.85);
				gl_FragColor = vec4(col, 1.0);
				#include <colorspace_fragment>
			}`,
		toneMapped: false,
	});

const CROWD = Object.keys(SPRITES)
	.filter((k) => k.startsWith('crowd/') && k.endsWith('_back'))
	.map((k) => k.replace('_back', ''));

type CrowdSpot = {name: string; view: 'back' | 'tq'; x: number; z: number; facing: number; seed: number};
const crowdSpots = (): CrowdSpot[] => {
	const out: CrowdSpot[] = [];
	const rows = [
		{z: 5.2, n: 6, w: 4.6},
		{z: 3.6, n: 6, w: 4.2},
		{z: 2.1, n: 5, w: 3.8},
		{z: 0.8, n: 4, w: 3.0},
	];
	let k = 0;
	rows.forEach((r, ri) => {
		for (let i = 0; i < r.n; i++) {
			const name = CROWD[(k * 7 + ri * 3) % CROWD.length];
			const x = (i / (r.n - 1) - 0.5) * r.w * 2 + (hash(71, k) - 0.5) * 0.5;
			out.push({name, view: hash(72, k) > 0.8 ? 'tq' : 'back', x, z: r.z + (hash(73, k) - 0.5) * 0.6, facing: hash(74, k) > 0.5 ? 1 : -1, seed: k});
			k++;
		}
	});
	return out;
};

const BOAT_AT: Vec3 = [0.4, 0, -6.2];
const shoreCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.s2 - 0.3, B.s3 + 0.3, (x) => x));
	return {pos: [lerp(1.6, 0.9, k), 2.25, lerp(17.5, 16.6, k)], target: [lerp(0.6, 0.4, k), 1.05, BOAT_AT[2]], fov: 19, drift: 0.8};
};

const ShoreContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const g = cached('shoreGeo', buildShore);
	const boat = cached('boatGeo', buildBoat);
	const cam = shoreCam(t);
	const mats = useMemo(
		() => ({
			lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
			boat: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, side: THREE.DoubleSide}),
			cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.92}),
			lake: lakeMaterial(),
		}),
		[],
	);
	const u = mats.lake.uniforms;
	u.uT.value = t;
	u.uSun.value.set(...SHORE.sunDir);
	u.uSunC.value.set(SHORE.sunColor);
	u.uSky.value.set(SHORE.skyMid!);
	u.uHorizon.value.set(SHORE.skyHorizon);
	u.uFog.value.set(SHORE.fog);
	// the boat rides the small waves
	const bob = 0.05 * Math.sin(t * 1.4) + 0.02 * Math.sin(t * 2.3 + 1);
	const roll = 0.035 * Math.sin(t * 1.1 + 0.5);
	const pitch = 0.02 * Math.sin(t * 0.9 + 2);
	const spots = useMemo(crowdSpots, []);
	const L = screenLight(cam, SHORE.sunDir);
	const jesusPos: Vec3 = [BOAT_AT[0] + 0.35, BOAT_AT[1] - 0.42 + bob, BOAT_AT[2] + 0.05];
	const fc = faceCam(cam, jesusPos);
	const pose = blend(idle(t, 8), talk(t, {amount: 0.9, seed: 1}), {angles: {thigh_near: 78, thigh_far: 74, shin_near: -82, shin_far: -80, torso: 2}});
	return (
		<>
			<Sky {...skyFromMood(SHORE, t)} curve={0.6} />
			<MoodLights mood={SHORE} center={[0, 0, -2]} span={12} lite={lite} />
			<mesh geometry={g.ground} material={mats.lambert} receiveShadow />
			<mesh geometry={g.far} material={mats.lambert} />
			<mesh geometry={g.rocks} material={mats.lambert} castShadow receiveShadow />
			<mesh geometry={g.clouds} material={mats.cloud} rotation-y={t * 0.002} />
			<mesh rotation-x={-Math.PI / 2} position={[0, -0.02, -200]} material={mats.lake} renderOrder={-10}>
				<planeGeometry args={[1400, 400, 1, 1]} />
			</mesh>
			<group position={[BOAT_AT[0], BOAT_AT[1] + bob, BOAT_AT[2]]} rotation={[pitch, 0.18, roll]}>
				<mesh geometry={boat} material={mats.boat} castShadow receiveShadow />
			</group>
			<Person id="jesus" view="tq" position={jesusPos} pose={pose} t={t} facing={-1} yaw={fc.yaw} lean={fc.lean * 0.5} look={lookIn(SHORE, cam, {rimLight: 0.5, rimColor: '#ffd9a0', rimDir: [-0.7, 0.4]})} blinkSeed={4} renderOrder={25} shadow={null} />
			{spots.map((s) => {
				const m = SPRITES[`${s.name}_${s.view}`];
				const y = shoreHeight(s.x, s.z);
				const f = faceCam(cam, [s.x, y, s.z], 0.3);
				const sway = Math.sin(t * (0.8 + hash(75, s.seed) * 0.5) + s.seed) * 0.006;
				return (
					<group key={s.seed} position={[s.x, y - 0.02, s.z]} rotation-y={f.yaw}>
						<group rotation-x={-f.lean} scale={[s.facing / 550, 1 / 550, 1 / 550]}>
							<PoseSprite sprite={`${s.name}_${s.view}`} look={{tint: SHORE.tint, outline: 4, solid: true, cel: {dir: [L[0] * s.facing, L[1]], amount: 0.7, radius: 24}}} warp={{breath: sway}} renderOrder={40 + s.seed} segs={[2, 6]} anchor={m.foot} />
						</group>
					</group>
				);
			})}
		</>
	);
};

export const SHORE_SHOT: ShotDef = {
	id: 'SHORE',
	start: B.s2 - 0.3,
	end: B.s3 + 0.3,
	Content: ShoreContent,
	camera: shoreCam,
	grade: () => ({...GOLDEN_GRADE, exposure: 1.0}),
	fog: () => fogOf(SHORE),
	anchors: () => ({boat: [BOAT_AT[0] + 0.3, 1.6, BOAT_AT[2]]}),
	dof: () => ({focus: 23.5, range: 3, aperture: 7, max: 12}),
};
