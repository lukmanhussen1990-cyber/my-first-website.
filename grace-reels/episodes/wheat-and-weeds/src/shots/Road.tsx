// S11: Saul. A dusty road through dry hills: young Saul marches proudly with two soldiers, the arrest
// letters in his hand. A light from heaven (Acts 9:3), he throws up his arms and falls; the light takes
// the whole screen. Then old Paul writing letters by lamplight, the scrolls stacking up.
import {useMemo} from 'react';
import * as THREE from 'three';
import {blend, idle, march, shield, write} from '../characters/acting';
import {Person, Pose} from '../characters/Puppet';
import {Flame, FlameLight, Glow} from '../fx/Flame';
import {Particles, ParticleSpec} from '../fx/Particles';
import {clamp, easeIn, easeInOut, easeOut, lerp, seg, smooth} from '../lib/ease';
import {fbm2, hash} from '../lib/random';
import {B, WALK} from '../lib/timeline';
import type {CamState, ShotDef, Vec3} from '../render/types';
import {Dust, LightBeam, LightPool, Sky} from '../world/atmosphere';
import {cached} from '../world/cache';
import {MoodLights} from '../world/Lights';
import {bush, cloud, gridLine, mergePlaced, paintFaces, rock, terrainGrid} from '../world/lowpoly';
import {FIELD_DAY, Mood, skyFromMood} from '../world/mood';
import {faceCam, fogOf, lookIn} from './common';

const dirOf = (azDeg: number, elDeg: number): Vec3 => {
	const a = (azDeg * Math.PI) / 180;
	const e = (elDeg * Math.PI) / 180;
	return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
};

// hot, dusty midday
const ROAD_MOOD: Mood = {
	...FIELD_DAY,
	skyTop: '#7aa3cf',
	skyMid: '#bcd0de',
	skyHorizon: '#f1dfbd',
	skyBottom: '#e3cc9e',
	sunDir: dirOf(-35, 48),
	sunGlow: 0.08,
	light: '#fff0d2',
	lightI: 2.5,
	hemiSky: '#efe6d8',
	hemiGround: '#b08d62',
	fog: '#ecd9b8',
	fogNear: 40,
	fogFar: 420,
	tint: '#fff6ea',
};

const roadHeight = (x: number, z: number) => {
	const hills = 3.2 * (fbm2(x * 0.02, z * 0.02, 31) + 0.4) * Math.min(1, Math.abs(z) / 14) + Math.max(0, -z - 30) * 0.18 * (fbm2(x * 0.01, 3, 32) + 0.8);
	return 0.12 * fbm2(x * 0.3, z * 0.3, 33) + hills;
};

const buildRoad = () => {
	const ground = terrainGrid({
		xs: gridLine(-200, 260, 0, 0.6, 14, 70),
		zs: gridLine(-400, 120, 0, 0.5, 14, 60),
		height: roadHeight,
		seed: 34,
		wobble: 0.3,
		color: (x, y, z, ny) => {
			const road = Math.abs(z + 0.1 * Math.sin(x * 0.05)) < 1.6;
			if (road) return new THREE.Color('#d9c09a').multiplyScalar(0.95 + 0.08 * fbm2(x * 2, z * 2, 35));
			const dry = new THREE.Color('#c7a473').lerp(new THREE.Color('#a8915e'), Math.min(1, Math.max(0, fbm2(x * 0.08, z * 0.08, 36) + 0.5)));
			return ny < 0.85 ? dry.multiplyScalar(0.86) : dry;
		},
	});
	const props: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 70; i++) {
		const x = -40 + hash(37, i) * 120;
		const z = (hash(38, i) > 0.5 ? 1 : -1) * (2.6 + hash(39, i) * 26);
		const geo = hash(40, i) > 0.45 ? rock(500 + (i % 30), '#b39c7e') : bush(520 + (i % 20), {a: '#8a8a4a', b: '#9d9a5a'});
		props.push({geo, pos: [x, roadHeight(x, z) - 0.05, z], rot: hash(41, i) * 6, scale: 0.5 + hash(42, i) * 0.9});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 7; i++) {
		const a = -1.1 + (i / 6) * 2.2;
		clouds.push({geo: cloud(960 + i), pos: [Math.sin(a) * 430, 90 + hash(43, i) * 60, -Math.cos(a) * 430], rot: hash(44, i), scale: 3 + hash(45, i) * 3});
	}
	return {ground, props: mergePlaced(props), clouds: mergePlaced(clouds)};
};

// Saul and the soldiers march along +x on the road (z = 0)
const SPEED = 1.05;
const saulX = (t: number) => -3 + (Math.min(t, B.lightFlash) - B.s11) * SPEED + Math.max(0, Math.min(t, B.lightFlash + 0.3) - B.lightFlash) * SPEED * 0.4;
const roadCam = (t: number): CamState => {
	const x = saulX(t);
	const flash = seg(t, B.lightFlash, B.whiteOut + 0.5, (u) => u);
	return {pos: [x + 0.4 - flash * 0.3, 1.25 + flash * 0.25, 6.4 - flash * 0.8], target: [x + 0.55, 1.35 + flash * 0.15, 0], fov: 38, drift: 1, shake: smooth((t - B.lightFlash) / 0.15) * (1 - smooth((t - B.whiteOut - 0.4) / 0.4)) * 0.6};
};

// kicked-up dust at every step of the three marchers
const roadDust = (() => {
	const out: ParticleSpec[] = [];
	for (let k = 0; k < 3; k++) {
		const ph = k === 0 ? 0 : k === 1 ? 0.25 : 0.6;
		for (let s = 0; s < 14; s++) {
			const t0 = B.s11 - 0.4 + (s / 2) * WALK.saul.period + ph * WALK.saul.period;
			if (t0 > B.lightFlash) break;
			const x = saulX(t0) - (k === 0 ? 0 : k === 1 ? 1.25 : 2.3);
			for (let i = 0; i < 5; i++) {
				out.push({birth: t0 + hash(k * 31 + s, i) * 0.05, pos: [x + (hash(47, s * 5 + i) - 0.3) * 0.25, 0.05, (k === 2 ? -0.7 : k === 1 ? 0.65 : 0) + (hash(48, s * 5 + i) - 0.5) * 0.3], vel: [(hash(49, s * 5 + i) - 0.7) * 0.4, 0.2 + hash(50, s * 5 + i) * 0.25, (hash(51, s * 5 + i) - 0.5) * 0.3], life: 0.9 + hash(52, s * 5 + i) * 0.6, size: 0.8 + hash(53, s * 5 + i), seed: hash(54, s * 5 + i)});
			}
		}
	}
	return out;
})();

const RoadContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const g = cached('roadGeo', buildRoad);
	const mats = useMemo(() => ({lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.9})}), []);
	const cam = roadCam(t);
	const x = saulX(t);
	const phase = (t - B.s11) / WALK.saul.period;
	const struck = smooth((t - B.lightFlash) / 0.18);
	const fall = easeIn(seg(t, B.fall, B.fall + 0.55, (u) => u));
	const saulPose: Pose = blend(
		march(phase, {amount: 1 - struck, proud: 1.2}),
		idle(t, 6, {sway: 0.4}),
		shield(struck, t),
		{variants: {mouth: t < B.lightFlash ? 'rest' : 'open'}, angles: {head: 3 * (1 - struck)}},
		// the letters in his far hand until he falls
		{props: t < B.fall + 0.2 ? [{part: 'hand_far', sprite: 'props/scroll', angle: 70, scale: 0.8}] : []},
		{angles: {thigh_near: 25 * fall, shin_near: -40 * fall, thigh_far: 30 * fall, shin_far: -45 * fall}, lift: [0, -120 * fall]},
	);
	const light = smooth((t - (B.lightFlash - 0.05)) / 0.25);
	const soldiers: {at: Vec3; ph: number}[] = [
		{at: [x - 1.25, 0, 0.65], ph: WALK.soldier.phase},
		{at: [x - 2.3, 0, -0.7], ph: 0.6},
	];
	const look = lookIn(ROAD_MOOD, cam);
	const fc = faceCam(cam, [x, 0, 0]);
	return (
		<>
			<Sky {...skyFromMood(ROAD_MOOD, t)} />
			<MoodLights mood={ROAD_MOOD} center={[x, 0, 0]} span={8} lite={lite} />
			<mesh geometry={g.ground} material={mats.lambert} receiveShadow />
			<mesh geometry={g.props} material={mats.lambert} castShadow receiveShadow />
			<mesh geometry={g.clouds} material={mats.cloud} />
			{soldiers.map((s, i) => {
				const recoil = smooth((t - B.lightFlash - 0.1 - i * 0.08) / 0.3);
				const sx = s.at[0] + (t > B.lightFlash ? -(t - B.lightFlash) * SPEED * 0.6 * recoil : 0);
				const pose = blend(march(phase + s.ph, {amount: 1 - recoil, proud: 0.6}), shield(recoil * 0.7, t + i), {props: [{part: 'hand_near', sprite: 'props/spear', angle: 10, scale: 1.0, behind: true}]});
				const f = faceCam(cam, [sx, 0, s.at[2]]);
				return <Person key={i} id="soldier" view="side" position={[sx, roadHeight(sx, s.at[2]) * 0, s.at[2]]} pose={pose} t={t} yaw={f.yaw} lean={f.lean * 0.5} look={{...look, light: light * 0.35, lightColor: '#fff8e6'}} blinkSeed={70 + i} renderOrder={28 - i} heightM={1.74} shadow={{w: 0.7, d: 0.28, opacity: 0.3}} />;
			})}
			<Person id="saul" view="side" position={[x, 0, 0]} pose={saulPose} t={t} yaw={fc.yaw} lean={fc.lean * 0.5} tilt={fall * 0.95} look={{...look, light: light * 0.45, lightColor: '#fffaf0'}} blinkSeed={9} renderOrder={32} shadow={{w: 0.8, d: 0.32, opacity: 0.32 * (1 - light)}} />
			<Particles specs={roadDust} t={t} gravity={-0.15} drag={1.2} additive={false} colors={['#d8c4a0', '#c8b088', '#b39a74']} opacity={0.55} px={22} swirl={0.04} />
			{/* the light from heaven: a column of white-gold light on him, the ground glowing */}
			<LightBeam position={[saulX(B.lightFlash) + 0.1, 0, 0]} height={60} rTop={4.5} rBottom={1.6} intensity={light * 1.4} t={t} color="#fff4d8" core={1.2} />
			<LightPool position={[saulX(B.lightFlash) + 0.1, 0.02, 0]} radius={2.6} intensity={light * 1.3} t={t} color="#fff1cf" />
			<Dust count={160} center={[saulX(B.lightFlash), 2.5, 0]} size={[5, 5, 4]} t={t} color="#fff4d8" opacity={light} px={6} rise={0.3} />
		</>
	);
};

export const ROAD: ShotDef = {
	id: 'ROAD',
	start: B.s11 - 0.3,
	end: B.paulCut + 0.6,
	Content: RoadContent,
	camera: roadCam,
	grade: (t) => {
		const w = smooth((t - B.lightFlash) / 0.2) * 0.35 + smooth((t - B.whiteOut) / 0.7) * 1.3;
		return {exposure: 1.0, contrast: 1.06, saturation: 1.0, gain: [1.04, 1.0, 0.95], vignette: 0.36, bloom: 0.35 + w * 0.6, bloomThreshold: 0.92 - w * 0.25, grain: 0.015, flash: w, flashColor: [1, 0.97, 0.88]};
	},
	fog: () => fogOf(ROAD_MOOD),
	anchors: (t) => ({saul: [saulX(t) + 0.1, 1.95, 0]}),
	rays: (t) => ({at: [saulX(B.lightFlash), 40, 0], strength: 0.9 * smooth((t - B.lightFlash) / 0.25), color: [1, 0.95, 0.82]}),
	dof: (t) => ({focus: 6.4, range: 1.6, aperture: 6, max: 10}),
};

// ------------------------------------------------------------------------------------------------
// PAUL: years later, by lamplight, the letters
// ------------------------------------------------------------------------------------------------
const ROOM: Mood = {
	...FIELD_DAY,
	skyTop: '#101629',
	skyMid: '#1b2238',
	skyHorizon: '#2a3352',
	skyBottom: '#141826',
	sunDir: [0.4, 0.6, -0.7],
	sunGlow: 0,
	light: '#5c6c9a',
	lightI: 0.35,
	hemiSky: '#4a3a3a',
	hemiGround: '#2a1a14',
	hemiI: 0.45,
	fog: '#1a1210',
	fogNear: 8,
	fogFar: 40,
	stars: 0,
	tint: '#ffe2c4',
};

const buildRoom = () => {
	const parts: THREE.BufferGeometry[] = [];
	const add = (g: THREE.BufferGeometry, c: string, seed: number, j = 0.06) => parts.push(paintFaces(g, (x, y, z, ny) => new THREE.Color(c).multiplyScalar(0.85 + 0.15 * Math.abs(ny) + 0.06 * Math.sin(x * 9 + y * 7)), j, seed));
	// stone walls (blocks), the floor, a deep window with the night outside
	for (let row = 0; row < 9; row++) {
		for (let col = 0; col < 12; col++) {
			const x = -3.3 + col * 0.6 + (row % 2) * 0.3;
			const y = row * 0.38 + 0.19;
			if (x > 0.9 && x < 2.1 && y > 1.2 && y < 2.4) continue; // the window
			const b = new THREE.BoxGeometry(0.58, 0.36, 0.3);
			b.translate(x, y, -1.6);
			add(b, hash(80, row * 12 + col) > 0.5 ? '#b48f68' : '#a6825e', row * 12 + col, 0.08);
		}
	}
	for (let row = 0; row < 9; row++) {
		for (let col = 0; col < 7; col++) {
			const z = -1.45 + col * 0.6 + (row % 2) * 0.3;
			const b = new THREE.BoxGeometry(0.3, 0.36, 0.58);
			b.translate(-3.4, row * 0.38 + 0.19, z);
			add(b, hash(81, row * 7 + col) > 0.5 ? '#a8845f' : '#9c7a57', 200 + row * 7 + col, 0.08);
		}
	}
	const floor = new THREE.BoxGeometry(8, 0.1, 6);
	floor.translate(0, -0.05, 1.2);
	add(floor, '#6e5038', 300);
	// a low desk and a stool
	const desk = new THREE.BoxGeometry(1.3, 0.08, 0.7);
	desk.translate(0.35, 0.62, -0.25);
	add(desk, '#6a4428', 301);
	for (const [x, z] of [[-0.25, -0.55], [0.95, -0.55], [-0.25, 0.05], [0.95, 0.05]]) {
		const leg = new THREE.BoxGeometry(0.07, 0.6, 0.07);
		leg.translate(x, 0.3, z);
		add(leg, '#5a3a22', 302);
	}
	// a shelf with jars
	const shelf = new THREE.BoxGeometry(1.4, 0.06, 0.3);
	shelf.translate(-2.2, 1.6, -1.35);
	add(shelf, '#5e3e26', 303);
	for (let i = 0; i < 4; i++) {
		const jar = new THREE.CylinderGeometry(0.08, 0.1, 0.24, 7);
		jar.translate(-2.75 + i * 0.36, 1.75, -1.35);
		add(jar, i % 2 ? '#a0603a' : '#8a5634', 304 + i);
	}
	return mergePlaced(parts.map((geo) => ({geo, pos: [0, 0, 0] as Vec3})));
};

const PAUL_AT: Vec3 = [-0.55, 0, -0.1];
const LAMP: Vec3 = [0.85, 0.72, -0.4];
const paulCam = (t: number): CamState => {
	const k = easeInOut(seg(t, B.paulCut - 0.4, B.s12 + 0.3, (u) => u));
	return {pos: [lerp(1.4, 1.05, k), lerp(1.45, 1.35, k), lerp(3.4, 2.7, k)], target: [lerp(0.1, 0.15, k), 0.95, -0.4], fov: 40, drift: 0.7};
};

// each new letter: a rolled scroll slides from the desk onto the growing pile
const SCROLL_PILE: Vec3 = [1.25, 0.66, -0.15];
const scrollSlot = (i: number): Vec3 => {
	const row = i < 3 ? 0 : i < 5 ? 1 : 2;
	const inRow = i < 3 ? i : i < 5 ? i - 3 : 0;
	return [SCROLL_PILE[0], SCROLL_PILE[1] + 0.045 + row * 0.075, SCROLL_PILE[2] - 0.09 * (row === 0 ? 1 : row === 1 ? 0.5 : 0) + inRow * 0.09];
};

const PaulContent: React.FC<{t: number; lite: boolean}> = ({t, lite}) => {
	const room = cached('roomGeo', buildRoom);
	const mats = useMemo(
		() => ({
			lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
			parch: new THREE.MeshLambertMaterial({color: '#e9d7b0', emissive: '#3a2a14', emissiveIntensity: 0.2}),
			rod: new THREE.MeshLambertMaterial({color: '#6a4428'}),
			lamp: new THREE.MeshLambertMaterial({color: '#a0603a', flatShading: true}),
			night: new THREE.MeshBasicMaterial({color: '#25315a', fog: false}),
		}),
		[],
	);
	const cam = paulCam(t);
	const pose = blend(write(t), idle(t, 12, {sway: 0.3}), {
		angles: {thigh_near: 80, thigh_far: 76, shin_near: -84, shin_far: -80},
		props: [{part: 'hand_near', sprite: 'props/quill', angle: -20, scale: 0.7}],
		lift: [0, -520],
	});
	const fc = faceCam(cam, PAUL_AT);
	return (
		<>
			<MoodLights mood={ROOM} center={[0, 0, 0]} span={4} lite={lite} />
			<mesh geometry={room} material={mats.lambert} castShadow receiveShadow />
			{/* the night through the window */}
			<mesh position={[1.5, 1.8, -1.75]} material={mats.night}>
				<planeGeometry args={[1.25, 1.25]} />
			</mesh>
			<Glow position={[1.5, 2.2, -1.7]} size={0.25} color="#dfe8ff" intensity={0.7} />
			{/* the open scroll he writes on */}
			<mesh position={[0.15, 0.665, -0.2]} rotation-x={-Math.PI / 2} material={mats.parch} receiveShadow>
				<planeGeometry args={[0.55, 0.4]} />
			</mesh>
			{/* the oil lamp */}
			<mesh position={[LAMP[0], LAMP[1] - 0.03, LAMP[2]]} material={mats.lamp} castShadow>
				<sphereGeometry args={[0.07, 7, 5]} />
			</mesh>
			<Flame position={[LAMP[0] + 0.07, LAMP[1] + 0.02, LAMP[2]]} t={t} seed={3} height={0.09} intensity={1.2} glow={0} />
			<FlameLight position={[LAMP[0], LAMP[1] + 0.25, LAMP[2] + 0.1]} t={t} seed={3} intensity={9} distance={6} />
			<Glow position={[LAMP[0] + 0.07, LAMP[1] + 0.08, LAMP[2]]} size={0.9} color="#ffb060" intensity={0.5} />
			<Person id="paul" view="tq" position={PAUL_AT} pose={pose} t={t} facing={1} yaw={fc.yaw} lean={fc.lean * 0.5} look={lookIn(ROOM, cam, {lightDir: [0.9, 0.3], rimLight: 0.6, rimColor: '#ffb36a', rimDir: [1, 0.2]})} blinkSeed={14} renderOrder={30} shadow={{w: 0.8, d: 0.4, opacity: 0.3}} />
			{B.scrolls.map((at, i) => {
				const k = easeOut(seg(t, at - 0.35, at, (u) => u));
				if (t < at - 0.35) return null;
				const from: Vec3 = [0.3, 0.7, -0.1];
				const to = scrollSlot(i);
				const p: Vec3 = [lerp(from[0], to[0], k), lerp(from[1], to[1], k) + Math.sin(Math.PI * k) * 0.06, lerp(from[2], to[2], k)];
				return (
					<group key={i} position={p} rotation={[0, 0, Math.PI / 2]}>
						<mesh material={mats.parch} castShadow>
							<cylinderGeometry args={[0.035, 0.035, 0.32, 10]} />
						</mesh>
						{[-1, 1].map((s) => (
							<mesh key={s} position={[0, s * 0.18, 0]} material={mats.rod}>
								<cylinderGeometry args={[0.012, 0.012, 0.05, 6]} />
							</mesh>
						))}
					</group>
				);
			})}
			<Dust count={80} center={[0.6, 1.3, -0.4]} size={[2.4, 1.6, 1.6]} t={t} color="#ffc98a" opacity={0.5} px={3} rise={0.04} />
		</>
	);
};

export const PAUL: ShotDef = {
	id: 'PAUL',
	start: B.paulCut - 0.6,
	end: B.s12 + 0.3,
	Content: PaulContent,
	camera: paulCam,
	grade: () => ({exposure: 1.05, contrast: 1.1, saturation: 1.05, gain: [1.08, 0.98, 0.88], lift: [0.012, 0.008, 0.01], vignette: 0.6, bloom: 0.45, bloomThreshold: 0.85, grain: 0.02}),
	fog: () => fogOf(ROOM),
	dof: () => ({focus: 2.9, range: 0.5, aperture: 10, max: 14}),
};

void clamp;
void easeInOut;
