// The Jordan valley: a sandy riverbank path, the river behind it with reeds and palms,
// the far bank, and desert ridges melting into the haze. Used by S1, S3–S7 in different moods.
import {useMemo} from 'react';
import * as THREE from 'three';
import {fbm2, hash} from '../lib/random';
import {River, Sky} from './atmosphere';
import {cached} from './cache';
import {MoodLights} from './Lights';
import {bush, cloud, gridLine, mergePlaced, palm, reeds, rock, roundTree, terrainGrid} from './lowpoly';
import {Mood, skyFromMood} from './mood';

// River centre line (z) as a function of x.
export const riverZ = (x: number) => -8.6 + 1.6 * Math.sin(x * 0.055 + 0.6) + 0.6 * Math.sin(x * 0.13 + 2.1);
const RIVER_HALF = 3.3;
export const WATER_Y = -0.42;

const ridgeBand = (x: number, z: number, zc: number, w: number, h: number, seed: number) => {
	const n = fbm2(x * 0.014 + seed * 5.1, seed * 2.3, seed + 70) + 0.5;
	return h * (0.35 + 0.85 * n) * Math.exp(-(((z - zc) / w) ** 2));
};

export const jordanHeight = (x: number, z: number) => {
	const path = Math.exp(-((z / 2.2) ** 2));
	const dz = z - riverZ(x);
	const channel = Math.exp(-((dz / RIVER_HALF) ** 4)) * 1.15;
	const bank = fbm2(x * 0.04, z * 0.05, 31) * 0.5;
	const front = z > 4 ? -(z - 4) * 0.05 : 0;
	const farBank = z < riverZ(x) - RIVER_HALF ? Math.min(-(z - riverZ(x) + RIVER_HALF), 40) * 0.035 : 0;
	const ridges =
		z < -30 ? Math.max(ridgeBand(x, z, -85, 16, 6, 1), ridgeBand(x, z, -150, 26, 13, 2), ridgeBand(x, z, -260, 42, 24, 3), ridgeBand(x, z, -390, 60, 38, 4)) : 0;
	return 0.1 + (bank + front + farBank) * (1 - path * 0.85) - channel + ridges;
};

export type JordanPalette = {sand: string; grass: string; grass2: string; mud: string; far: string; ridge: string; leaf: string; leaf2: string; trunk: string; rock: string; water: string; waterLight: string};

export const JORDAN_DAY: JordanPalette = {
	sand: '#e3c792',
	grass: '#aaa457',
	grass2: '#8e984a',
	mud: '#8a7652',
	far: '#b9a265',
	ridge: '#c49766',
	leaf: '#5f7c39',
	leaf2: '#7a9244',
	trunk: '#7a5838',
	rock: '#a8907a',
	water: '#5e8a9a',
	waterLight: '#cfe2e4',
};

const build = (pal: JordanPalette) => {
	const c = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, new THREE.Color(v)])) as Record<keyof JordanPalette, THREE.Color>;
	const ground = terrainGrid({
		xs: gridLine(-300, 300, 0, 0.8, 10, 60),
		zs: gridLine(-470, 36, -3, 0.75, 13, 70),
		height: jordanHeight,
		seed: 41,
		jitter: 0.018,
		color: (x, y, z, ny) => {
			const p = Math.exp(-((z / 1.5) ** 2)) * (0.85 + 0.15 * fbm2(x * 0.3, 2, 3));
			const n = fbm2(x * 0.035, z * 0.045, 7) * 1.6 + 0.5;
			const g = c.grass.clone().lerp(c.grass2, Math.min(1, Math.max(0, n)));
			const dz = Math.abs(z - riverZ(x));
			if (dz < RIVER_HALF + 1.2) g.lerp(c.mud, Math.min(1, (RIVER_HALF + 1.2 - dz) / 1.4));
			if (z < riverZ(x) - RIVER_HALF - 2) g.lerp(c.far, Math.min(1, (riverZ(x) - RIVER_HALF - 2 - z) / 25));
			if (z < -45) g.lerp(c.ridge, Math.min(1, (-45 - z) / 60));
			if (ny < 0.88) g.multiplyScalar(0.92);
			return g.lerp(c.sand, Math.min(1, p * 1.2));
		},
	});
	const trees: Parameters<typeof mergePlaced>[0] = [];
	// palms on the near bank, the far bank, and a few framing the foreground at the sides
	const palms: [number, number, number][] = [
		[-9, -3.6, 1.0], [-4.5, -4.2, 1.15], [3.5, -3.8, 0.95], [7.5, -4.5, 1.1], [12, -3.5, 1.0], [-14, -4, 1.1], [17, -4.4, 1.2],
		[-7, -15, 1.2], [-1.5, -16.5, 1.1], [5, -15.5, 1.25], [10, -17, 1.15], [-12, -16, 1.3], [15, -16, 1.2], [21, -15, 1.3],
		[-20, -14, 1.25], [1, -24, 1.3], [-9, -26, 1.4], [13, -27, 1.35], [-10.5, 6.5, 1.3], [11, 7, 1.35], [-24, -5, 1.2], [25, -6, 1.2],
	];
	palms.forEach(([x, z, s], i) => trees.push({geo: palm(700 + i, {leaf: pal.leaf, leaf2: pal.leaf2, trunk: pal.trunk}), pos: [x, jordanHeight(x, z) - 0.05, z], rot: hash(71, i) * 6.28, scale: s}));
	const rounds: [number, number, number][] = [[-17, -6, 1.1], [20, -7, 1.15], [-3, -30, 1.4], [8, -33, 1.4], [-16, -28, 1.3], [26, -26, 1.4]];
	rounds.forEach(([x, z, s], i) => trees.push({geo: roundTree(760 + i, {leaf: pal.leaf, leaf2: pal.leaf2, trunk: '#5e3f27'}), pos: [x, jordanHeight(x, z) - 0.05, z], rot: hash(72, i) * 6, scale: s}));
	const small: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 70; i++) {
		const x = (hash(81, i) - 0.5) * 70;
		const side = hash(82, i) > 0.5 ? 1 : -1;
		const z = riverZ(x) + side * (RIVER_HALF - 0.4 + hash(83, i) * 1.2);
		small.push({geo: reeds(800 + (i % 10), i % 3 ? '#7d8f45' : '#91a052'), pos: [x, jordanHeight(x, z) - 0.05, z], rot: hash(84, i) * 6, scale: 0.9 + hash(85, i) * 0.8});
	}
	for (let i = 0; i < 34; i++) {
		const x = (hash(91, i) - 0.5) * 64;
		const z = (hash(92, i) - 0.5) * 12 + (hash(93, i) > 0.5 ? -3.2 : 3.6);
		if (Math.abs(z) < 2.4) continue;
		const s = 0.3 + hash(94, i) ** 2 * 1.2;
		small.push({geo: rock(900 + i, hash(95, i) > 0.5 ? pal.rock : '#937c66'), pos: [x, jordanHeight(x, z) - 0.06 * s, z], rot: hash(96, i) * 6, scale: s});
	}
	for (let i = 0; i < 22; i++) {
		const x = (hash(97, i) - 0.5) * 56;
		const z = hash(98, i) > 0.45 ? -2.7 - hash(99, i) * 1.5 : 2.8 + hash(99, i) * 3;
		small.push({geo: bush(950 + i, {a: pal.leaf, b: pal.leaf2}), pos: [x, jordanHeight(x, z) - 0.05, z], rot: hash(100, i) * 6, scale: 0.7 + hash(101, i) * 0.6});
	}
	const clouds: Parameters<typeof mergePlaced>[0] = [];
	for (let i = 0; i < 10; i++) {
		const a = -1.2 + (i / 9) * 2.4;
		const r = 330 + hash(111, i) * 140;
		clouds.push({geo: cloud(1000 + i), pos: [Math.sin(a) * r, 55 + hash(112, i) * 60, -Math.cos(a) * r], rot: hash(113, i), scale: 3.4 + hash(114, i) * 3});
	}
	const curve = new THREE.CatmullRomCurve3(Array.from({length: 41}, (_, i) => new THREE.Vector3(-160 + i * 8, WATER_Y, riverZ(-160 + i * 8))));
	return {ground, trees: mergePlaced(trees), small: mergePlaced(small), clouds: mergePlaced(clouds), curve};
};

const mats = () =>
	cached('jordanMats', () => ({
		lambert: new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}),
		cloud: new THREE.MeshBasicMaterial({vertexColors: true, fog: false, transparent: true, opacity: 0.95}),
	}));

export const JordanWorld: React.FC<{
	t: number;
	mood: Mood;
	lite: boolean;
	lightCenter?: [number, number, number];
	palette?: JordanPalette;
	shadowSpan?: number;
	holeDir?: [number, number, number];
	water?: {color: string; light: string};
}> = ({t, mood, lite, lightCenter = [0, 0, 0], palette = JORDAN_DAY, shadowSpan = 28, holeDir, water}) => {
	const g = cached(`jordanGeo:${palette.sand}`, () => build(palette));
	const m = mats();
	m.cloud.color.set(mood.cloud);
	const curve = useMemo(() => g.curve, [g]);
	return (
		<>
			<Sky {...skyFromMood(mood, t, holeDir)} />
			<MoodLights mood={mood} center={lightCenter} span={shadowSpan} lite={lite} />
			<mesh geometry={g.ground} material={m.lambert} receiveShadow />
			<mesh geometry={g.trees} material={m.lambert} castShadow receiveShadow />
			<mesh geometry={g.small} material={m.lambert} castShadow receiveShadow />
			<River curve={curve} width={RIVER_HALF * 2 - 0.6} t={t} color={water?.color ?? palette.water} light={water?.light ?? palette.waterLight} />
			<mesh geometry={g.clouds} material={m.cloud} rotation-y={t * 0.002} />
		</>
	);
};
