// Enoch's hill path at golden hour (also used for the sunrise of the promise).
// Seen from a high three-quarter camera like the reference diorama: smooth faceted ground,
// round trees on thin trunks, long soft shadows, far hills melting into the haze.
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {bush, cloud, gridLine, mergePlaced, oliveTree, rock, roundTree, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

// One band of distant hills: a ridge line along x at depth zc, height varying with seeded noise.
const ridgeBand = (x: number, z: number, zc: number, w: number, h: number, seed: number) => {
	const n = fbm2(x * 0.016 + seed * 7.3, seed * 3.1, seed + 40) + 0.5;
	return h * (0.4 + 0.8 * n) * Math.exp(-(((z - zc) / w) ** 2));
};

// Ground height: a flat sandy path along x at z≈0, gentle rolls, a soft rise behind,
// and layered ridges in the distance that melt into the haze.
export const hillHeight = (x: number, z: number) => {
	const path = Math.exp(-((z / 2.4) ** 2));
	const roll = fbm2(x * 0.03, z * 0.035, 11) * 1.1;
	const behind = z < -5 ? Math.min(-z - 5, 30) * 0.05 : 0;
	const front = z > 4 ? -(z - 4) * 0.06 : 0;
	const ridges =
		z < -22 ? Math.max(ridgeBand(x, z, -62, 13, 3.2, 1), ridgeBand(x, z, -118, 22, 7, 2), ridgeBand(x, z, -205, 38, 14, 3), ridgeBand(x, z, -330, 60, 22, 4)) : 0;
	return 0.012 * x + (roll + behind + front) * (1 - path * 0.92) + ridges;
};

export type HillPalette = {grass: string; grass2: string; path: string; soil: string; leaf: string; leaf2: string; trunk: string; rock: string; rock2: string};

export const HILL_GOLD: HillPalette = {
	grass: '#c6a65a',
	grass2: '#98984e',
	path: '#ecd5a3',
	soil: '#a8845a',
	leaf: '#76843f',
	leaf2: '#8d9a4c',
	trunk: '#5e3f27',
	rock: '#a8907a',
	rock2: '#8f7a66',
};

const build = (pal: HillPalette) => {
	const cGrass = new THREE.Color(pal.grass);
	const cGrass2 = new THREE.Color(pal.grass2);
	const cPath = new THREE.Color(pal.path);
	const cSoil = new THREE.Color(pal.soil);
	const ground = terrainGrid({
		xs: gridLine(-260, 260, 1, 0.8, 9, 60),
		zs: gridLine(-420, 34, -2, 0.8, 12, 70),
		height: hillHeight,
		seed: 21,
		jitter: 0.018,
		color: (x, y, z, ny) => {
			const p = Math.exp(-((z / 1.35) ** 2)) * (0.85 + 0.15 * fbm2(x * 0.3, 1, 3));
			const n = fbm2(x * 0.03, z * 0.04, 5) * 1.6 + 0.5;
			const g = cGrass.clone().lerp(cGrass2, Math.min(1, Math.max(0, n)));
			if (ny < 0.9) g.lerp(cSoil, 0.35);
			return g.lerp(cPath, Math.min(1, p * 1.15));
		},
	});
	const trees: Parameters<typeof mergePlaced>[0] = [];
	// Trees frame the path from the sides and sit low in the distance, keeping the sky behind the captions clear.
	const spots: [number, number, number, 'r' | 'o'][] = [
		[-6.5, -5.5, 1.0, 'r'], [-10, -9, 1.15, 'o'], [8.5, -6.5, 1.05, 'r'], [12.5, -4.8, 1.1, 'o'], [16, -10, 1.2, 'r'],
		[-14, -7, 1.2, 'r'], [-19, -5, 1.1, 'o'], [21, -6.5, 1.2, 'r'], [8, 6.2, 1.15, 'r'], [-5.5, 7.2, 1.25, 'o'],
		[-24, -13, 1.3, 'r'], [26, -15, 1.35, 'o'], [3, -24, 1.0, 'r'], [-4, -27, 1.1, 'o'], [11, -28, 1.15, 'r'],
		[-31, -9, 1.3, 'r'], [32, -10, 1.3, 'r'], [-12, -33, 1.2, 'r'], [19, -34, 1.3, 'r'], [-21, -31, 1.3, 'o'],
		[16, 9, 1.3, 'o'], [-15, 8, 1.2, 'r'], [0, -40, 1.2, 'r'], [7, -44, 1.1, 'o'],
	];
	spots.forEach(([x, z, s, k], i) =>
		trees.push({
			geo: k === 'r' ? roundTree(100 + i, {leaf: pal.leaf, leaf2: pal.leaf2, trunk: pal.trunk}) : oliveTree(100 + i, {leaf: pal.leaf2, leaf2: '#a3a873', trunk: pal.trunk}),
			pos: [x, hillHeight(x, z) - 0.05, z],
			rot: hash(5, i) * 6.28,
			scale: s,
		}),
	);
	const rocks: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 40; i++) {
		const x = (hash(31, i) - 0.5) * 64;
		const z = (hash(32, i) - 0.5) * 34 - 6;
		if (Math.abs(z) < 2.2) continue;
		const s = 0.35 + hash(33, i) ** 2 * 1.4;
		rocks.push({geo: rock(200 + i, hash(34, i) > 0.5 ? pal.rock : pal.rock2), pos: [x, hillHeight(x, z) - 0.08 * s, z], rot: hash(35, i) * 6, scale: s});
	}
	for (let i = 0; i < 26; i++) {
		const x = (hash(61, i) - 0.5) * 50;
		const side = hash(62, i) > 0.4 ? -1 : 1;
		const z = side * (2.6 + hash(63, i) * 3.5);
		rocks.push({geo: bush(500 + i, {a: pal.leaf, b: pal.leaf2}), pos: [x, hillHeight(x, z) - 0.05, z], rot: hash(64, i) * 6, scale: 0.8 + hash(65, i) * 0.7});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 9; i++) {
		const a = -1.1 + (i / 8) * 2.4;
		const r = 320 + hash(51, i) * 120;
		clouds.push({geo: cloud(400 + i), pos: [Math.sin(a) * r, 45 + hash(52, i) * 55, -Math.cos(a) * r], rot: hash(53, i), scale: 6 + hash(54, i) * 5});
	}
	return {ground, trees: mergePlaced(trees), rocks: mergePlaced(rocks), clouds: mergePlaced(clouds)};
};

const mats = () =>
	cached('hillMats', () => ({
		lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.95}),
	}));

export const HillWorld: React.FC<{t: number; mood: Mood; lite: boolean; lightCenter?: [number, number, number]; palette?: HillPalette; shadowSpan?: number}> = ({
	t,
	mood,
	lite,
	lightCenter = [0, 0, 0],
	palette = HILL_GOLD,
	shadowSpan = 30,
}) => {
	const g = cached(`hillGeo:${palette.grass}`, () => build(palette));
	const m = mats();
	m.cloud.color.set(mood.cloud);
	return (
		<>
			<Sky {...skyFromMood(mood, t)} />
			<MoodLights mood={mood} center={lightCenter} span={shadowSpan} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.trees} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.rocks} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * 0.002} />
		</>
	);
};
