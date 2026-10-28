// The morning after: the ridge path Moses walks down (S8) with the valley and the camp far below, and
// the camp itself (S9–S10) with its tents under the mountain. Low-poly, flat-shaded, built once.
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {cloud, gridLine, mergePlaced, paintFaces, rock, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

const ridgeBand = (x: number, z: number, zc: number, w: number, h: number, seed: number) => {
	const n = fbm2(x * 0.012 + seed * 7.3, seed * 3.1, seed + 40) + 0.5;
	return h * (0.35 + 0.9 * n) * Math.exp(-(((z - zc) / w) ** 2));
};

// ---------------- the ridge path ----------------
// The path runs along x on the crest (z ~ 0), going down to the right; the ground falls away on both
// sides to the valley floor 60 m below; far mountains close the horizon.
export const ridgeY = (x: number) => -0.14 * x;
export const ridgeHeight = (x: number, z: number) => {
	const az = Math.abs(z);
	const fall = az > 0.85 ? -((az - 0.85) ** 1.32) * (z > 0 ? 0.62 : 0.8) : 0;
	const lumps = 0.16 * fbm2(x * 0.45, z * 0.45, 7) * Math.min(1, az / 1.3) + 0.025 * fbm2(x * 2.2, z * 2.2, 8);
	const slope = ridgeY(x) + fall + lumps;
	const floor = -62 + 4 * fbm2(x * 0.02, z * 0.02, 9) + Math.max(ridgeBand(x, z, -300, 40, 70, 2), ridgeBand(x, z, -400, 60, 110, 3), ridgeBand(x, z, 300, 60, 60, 4));
	return Math.max(floor, slope);
};

// the camp far below (seen from the ridge): many small tents on the valley floor
export const VALLEY_CAMP = {x: 40, z: -150, spreadX: 70, spreadZ: 34};

const TENT_COLORS = ['#4b3a30', '#5d4a3b', '#cdb38f', '#b8956c', '#d9c6a4', '#9c7556', '#6b5444', '#c4a27e'];

// A ridge tent (a low triangular prism) or a round tent (a low cone), with a darker doorway face.
export const tentGeo = (seed: number) => {
	const c = new THREE.Color(TENT_COLORS[Math.floor(hash(seed, 1) * TENT_COLORS.length)]);
	if (hash(seed, 2) > 0.35) {
		const w = 2.4 + hash(seed, 3) * 0.8;
		const h = 1.7 + hash(seed, 4) * 0.5;
		const l = 2.8 + hash(seed, 5) * 1.4;
		const sag = 0.12;
		const A = [-l / 2, 0, -w / 2];
		const Bv = [-l / 2, 0, w / 2];
		const Cv = [-l / 2, h, 0];
		const D = [l / 2, 0, -w / 2];
		const E = [l / 2, 0, w / 2];
		const F = [l / 2, h, 0];
		const M = [0, h - sag, 0]; // the ridge sags a little between the poles
		const tris = [A, Cv, Bv, D, E, F, Bv, Cv, M, Bv, M, E, E, M, F, A, D, M, A, M, Cv, D, F, M];
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
		return paintFaces(g, (x, y, z, ny, f) => (f === 0 ? c.clone().multiplyScalar(0.45) : c.clone().multiplyScalar(0.85 + 0.15 * Math.abs(ny))), 0.06, seed);
	}
	const r = 1.4 + hash(seed, 6) * 0.6;
	const h = 1.9 + hash(seed, 7) * 0.6;
	const g = new THREE.ConeGeometry(r, h, 7, 1);
	g.translate(0, h / 2, 0);
	return paintFaces(g, (x, y, z, ny, f) => (f === 3 ? c.clone().multiplyScalar(0.45) : c.clone().multiplyScalar(0.8 + 0.2 * ny)), 0.06, seed);
};

const buildRidge = () => {
	const cRock = new THREE.Color('#b59c80');
	const cRock2 = new THREE.Color('#9d8670');
	const cPath = new THREE.Color('#dcc6a2');
	const cFloor = new THREE.Color('#d2b88f');
	const cFar = new THREE.Color('#a8949a');
	const ground = terrainGrid({
		xs: gridLine(-320, 320, 0.5, 0.32, 16, 46),
		zs: gridLine(-470, 330, 0, 0.3, 16, 56),
		height: ridgeHeight,
		seed: 61,
		jitter: 0.035,
		wobble: 0.3,
		color: (x, y, z, ny) => {
			const n = fbm2(x * 0.2, z * 0.2, 5) + 0.5;
			let c = cRock.clone().lerp(cRock2, Math.min(1, Math.max(0, n)));
			if (y < -55) c = cFloor.clone().lerp(cRock2, 0.2 * n);
			if (y > -40 && z < -200) c = cFar.clone();
			if (Math.abs(z) < 0.85) c.lerp(cPath, 0.75);
			if (ny < 0.6) c.multiplyScalar(0.82);
			return c;
		},
	});
	const rocks: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 60; i++) {
		const x = -14 + hash(71, i) * 30;
		const side = hash(72, i) > 0.5 ? 1 : -1;
		const z = side * (1.0 + hash(73, i) ** 1.5 * 5);
		const s = 0.25 + hash(74, i) ** 2 * 1.3;
		rocks.push({geo: rock(700 + i, hash(75, i) > 0.5 ? '#b09a82' : '#97836f'), pos: [x, ridgeHeight(x, z) - 0.12 * s, z], rot: hash(76, i) * 6, scale: [s, s * 0.8, s]});
	}
	const tents: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 90; i++) {
		const x = VALLEY_CAMP.x + (hash(81, i) - 0.5) * VALLEY_CAMP.spreadX * 2;
		const z = VALLEY_CAMP.z + (hash(82, i) - 0.5) * VALLEY_CAMP.spreadZ * 2;
		tents.push({geo: tentGeo(800 + i), pos: [x, ridgeHeight(x, z) - 0.1, z], rot: hash(83, i) * 6, scale: 1});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 10; i++) {
		const a = -1.3 + (i / 9) * 2.6;
		const r = 360 + hash(91, i) * 140;
		clouds.push({geo: cloud(900 + i), pos: [Math.sin(a) * r, 40 + hash(92, i) * 70, -Math.cos(a) * r], rot: hash(93, i), scale: 3.2 + hash(94, i) * 3});
	}
	return {ground, rocks: mergePlaced(rocks), tents: mergePlaced(tents), clouds: mergePlaced(clouds)};
};

const mats = () =>
	cached('morningMats', () => ({
		lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		tent: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, side: THREE.DoubleSide}),
		cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.92}),
	}));

export const RidgeWorld: React.FC<{t: number; mood: Mood; lite: boolean; center: [number, number, number]}> = ({t, mood, lite, center}) => {
	const g = cached('ridgeGeo', buildRidge);
	const m = mats();
	m.cloud.color.set(mood.cloud);
	return (
		<>
			<Sky {...skyFromMood(mood, t)} curve={0.5} />
			<MoodLights mood={mood} center={center} span={12} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.rocks} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.tents} material={m.tent} />
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * 0.002} />
		</>
	);
};

// ---------------- the camp ----------------
// Flat sandy ground around the origin, tents in loose rows behind the people, the mountain behind.
export const campHeight = (x: number, z: number) => {
	const n = 0.08 * fbm2(x * 0.15, z * 0.15, 3) + 0.03 * fbm2(x * 0.8, z * 0.8, 4);
	const far = Math.max(ridgeBand(x, z, -260, 50, 30, 6), ridgeBand(x, z, -380, 70, 60, 7));
	// Sinai itself, a great dark-red mountain behind the camp
	const sinai = 190 * Math.exp(-(((x + 60) / 120) ** 2) - (((z + 330) / 90) ** 2)) * (0.85 + 0.3 * (fbm2(x * 0.03, z * 0.03, 8) + 0.5));
	return n + Math.max(far, sinai);
};

export const CAMP_TENTS: [number, number, number][] = [
	// x, z, rotation: a loose ring of tents behind and around the open ground where the people stand
	[-7.5, -6.5, 0.3], [-3.2, -8.2, -0.2], [1.5, -7.6, 0.5], [6.0, -8.8, 0.1], [10.5, -6.8, -0.4], [-11.5, -9.5, 0.6],
	[-6.0, -14, 0.1], [0.0, -15.5, -0.3], [6.5, -15, 0.4], [13, -13.5, 0.2], [-13, -16, -0.5], [-19, -12, 0.3],
	[-9, -22, 0.2], [3, -24, -0.1], [15, -22, 0.6], [-20, -25, 0.1], [24, -18, 0.4], [-27, -20, -0.2], [9, -32, 0.3],
	[-12.5, -2.5, 1.2], [14, -2.0, -1.1], [-16, 3.5, 0.9], [18, 4.0, -0.7],
];

const buildCamp = () => {
	const cSand = new THREE.Color('#d8bf96');
	const cSand2 = new THREE.Color('#c9aa80');
	const cMount = new THREE.Color('#9a6e5c');
	const cMount2 = new THREE.Color('#7d5a52');
	const ground = terrainGrid({
		xs: gridLine(-420, 420, 0, 0.6, 18, 60),
		zs: gridLine(-520, 160, -2, 0.6, 18, 60),
		height: campHeight,
		seed: 63,
		jitter: 0.03,
		color: (x, y, z, ny) => {
			const n = fbm2(x * 0.08, z * 0.08, 5) + 0.5;
			if (y > 6) return cMount.clone().lerp(cMount2, Math.min(1, Math.max(0, n + (1 - ny) * 0.6)));
			const c = cSand.clone().lerp(cSand2, Math.min(1, Math.max(0, n)));
			return ny < 0.8 ? c.multiplyScalar(0.85) : c;
		},
	});
	const tents: Parameters<typeof mergePlaced>[0] = CAMP_TENTS.map(([x, z, r], i) => ({geo: tentGeo(1000 + i), pos: [x, campHeight(x, z) - 0.05, z], rot: r, scale: 1}));
	for (let i = 0; i < 120; i++) {
		const a = hash(1101, i) * Math.PI * 2;
		const d = 36 + hash(1102, i) * 110;
		const x = Math.sin(a) * d;
		const z = -Math.abs(Math.cos(a) * d) - 10;
		tents.push({geo: tentGeo(1200 + i), pos: [x, campHeight(x, z) - 0.05, z], rot: hash(1103, i) * 6, scale: 1});
	}
	const stones: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 40; i++) {
		const x = (hash(1111, i) - 0.5) * 40;
		const z = 2 + hash(1112, i) * 10 - (hash(1113, i) > 0.6 ? 14 : 0);
		const s = 0.12 + hash(1114, i) ** 2 * 0.4;
		stones.push({geo: rock(1300 + i, '#b49c7e'), pos: [x, campHeight(x, z) - 0.05, z], rot: hash(1115, i) * 6, scale: s});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 9; i++) {
		const a = -1.2 + (i / 8) * 2.4;
		const r = 380 + hash(1121, i) * 120;
		clouds.push({geo: cloud(1400 + i), pos: [Math.sin(a) * r, 70 + hash(1122, i) * 60, -Math.cos(a) * r], rot: hash(1123, i), scale: 3 + hash(1124, i) * 3});
	}
	return {ground, tents: mergePlaced(tents), stones: mergePlaced(stones), clouds: mergePlaced(clouds)};
};

export const CampWorld: React.FC<{t: number; mood: Mood; lite: boolean; center?: [number, number, number]}> = ({t, mood, lite, center = [0, 0, 0]}) => {
	const g = cached('campGeo', buildCamp);
	const m = mats();
	m.cloud.color.set(mood.cloud);
	return (
		<>
			<Sky {...skyFromMood(mood, t)} curve={0.5} />
			<MoodLights mood={mood} center={center} span={14} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.tents} material={m.tent} castShadow receiveShadow />
			<mesh geometry={g.stones} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * 0.002} />
		</>
	);
};
