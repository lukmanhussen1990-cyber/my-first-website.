// Lighting/colour moods that a world can blend between over time.
import * as THREE from 'three';
import type {SkyParams} from './atmosphere';

export type Mood = {
	skyTop: string;
	skyHorizon: string;
	skyBottom: string;
	sunDir: [number, number, number];
	sunColor: string;
	sunGlow: number;
	sunSize: number;
	light: string; // directional light colour
	lightI: number;
	hemiSky: string;
	hemiGround: string;
	hemiI: number;
	fog: string;
	fogNear: number;
	fogFar: number;
	storm: number;
	stormA: string;
	stormB: string;
	hole: number;
	holeColor: string;
	cloud: string;
	cloudShade: string;
	tint: string; // multiplied onto the flat character sprites
};

const ca = new THREE.Color();
const cb = new THREE.Color();
const mixHex = (a: string, b: string, m: number) => '#' + ca.set(a).lerp(cb.set(b), m).getHexString();
const mixN = (a: number, b: number, m: number) => a + (b - a) * m;

export const mixMood = (a: Mood, b: Mood, m: number): Mood => {
	if (m <= 0) return a;
	if (m >= 1) return b;
	const out = {} as Record<string, unknown>;
	for (const k of Object.keys(a) as (keyof Mood)[]) {
		const va = a[k];
		const vb = b[k];
		if (typeof va === 'number') out[k] = mixN(va, vb as number, m);
		else if (typeof va === 'string') out[k] = mixHex(va, vb as string, m);
		else out[k] = (va as number[]).map((x, i) => mixN(x, (vb as number[])[i], m));
	}
	return out as Mood;
};

export const skyFromMood = (m: Mood, t: number, holeDir: [number, number, number] = [0, 1, 0]): SkyParams => ({
	top: m.skyTop,
	horizon: m.skyHorizon,
	bottom: m.skyBottom,
	sunDir: m.sunDir,
	sunColor: m.sunColor,
	sunGlow: m.sunGlow,
	sunSize: m.sunSize,
	storm: m.storm,
	stormA: m.stormA,
	stormB: m.stormB,
	hole: m.hole,
	holeDir,
	holeColor: m.holeColor,
	t,
});

// Golden hour on Enoch's hill (sun low on the left, warm haze).
export const GOLDEN: Mood = {
	skyTop: '#b08c8e',
	skyHorizon: '#f2d2a0',
	skyBottom: '#ecc790',
	sunDir: [-0.86, 0.4, -0.32],
	sunColor: '#ffe0a8',
	sunGlow: 0.32,
	sunSize: 3.2,
	light: '#ffe2b4',
	lightI: 2.6,
	hemiSky: '#f4e4c8',
	hemiGround: '#8a6a40',
	hemiI: 1.0,
	fog: '#f2d6a6',
	fogNear: 24,
	fogFar: 140,
	storm: 0,
	stormA: '#3b3a52',
	stormB: '#6b5a6e',
	hole: 0,
	holeColor: '#ffd27a',
	cloud: '#ffe9cc',
	cloudShade: '#e6b088',
	tint: '#fff3e2',
};

// Sunrise for the promise (pink-gold, brighter, sun at the horizon).
export const SUNRISE: Mood = {
	...GOLDEN,
	skyTop: '#9fb3cf',
	skyHorizon: '#ffd9a6',
	skyBottom: '#f3bf8e',
	sunDir: [-0.25, 0.05, -0.97],
	sunColor: '#fff0c2',
	sunGlow: 1.05,
	sunSize: 4.5,
	light: '#ffe2b8',
	lightI: 2.2,
	hemiSky: '#ffeccc',
	fog: '#f8d6a8',
	fogNear: 30,
	fogFar: 260,
	cloud: '#fff1df',
	cloudShade: '#f1b9a0',
	tint: '#fff4e4',
};

// Warm hazy afternoon in the Jordan valley.
export const AFTERNOON: Mood = {
	skyTop: '#8eaac2',
	skyHorizon: '#efdcb6',
	skyBottom: '#e6cb98',
	sunDir: [-0.75, 0.55, -0.35],
	sunColor: '#fff0cc',
	sunGlow: 0.35,
	sunSize: 1.6,
	light: '#fff0d2',
	lightI: 2.3,
	hemiSky: '#e9e4d0',
	hemiGround: '#8c7650',
	hemiI: 1.1,
	fog: '#ead9b6',
	fogNear: 30,
	fogFar: 260,
	storm: 0,
	stormA: '#3b3a52',
	stormB: '#6b5a6e',
	hole: 0,
	holeColor: '#ffd27a',
	cloud: '#fff8ec',
	cloudShade: '#d9c4a8',
	tint: '#fff7ea',
};

// The whirlwind storm (slate and purple, golden opening above).
export const STORM: Mood = {
	skyTop: '#26263a',
	skyHorizon: '#6e5c68',
	skyBottom: '#4a3c3c',
	sunDir: [0.1, 0.95, -0.2],
	sunColor: '#ffcf7a',
	sunGlow: 0.2,
	sunSize: 0.5,
	light: '#ffc98a',
	lightI: 0.75,
	hemiSky: '#7d7896',
	hemiGround: '#3a2e28',
	hemiI: 0.8,
	fog: '#5e5058',
	fogNear: 16,
	fogFar: 150,
	storm: 1,
	stormA: '#232436',
	stormB: '#574760',
	hole: 1,
	holeColor: '#ffcf6e',
	cloud: '#45405a',
	cloudShade: '#2b2a3c',
	tint: '#e6d8cc',
};

// Calm after the storm: dusk, soft purple-peach.
export const DUSK: Mood = {
	skyTop: '#6f6f96',
	skyHorizon: '#f2b991',
	skyBottom: '#c98e74',
	sunDir: [0.72, 0.1, -0.68],
	sunColor: '#ffc48a',
	sunGlow: 0.6,
	sunSize: 2.6,
	light: '#ffc89a',
	lightI: 1.55,
	hemiSky: '#c9b4c4',
	hemiGround: '#6b4c3e',
	hemiI: 0.95,
	fog: '#d7a28c',
	fogNear: 22,
	fogFar: 210,
	storm: 0.25,
	stormA: '#4a4a68',
	stormB: '#8a6a7a',
	hole: 0.15,
	holeColor: '#ffd39a',
	cloud: '#f2c7b0',
	cloudShade: '#9c7b8e',
	tint: '#ffe9dc',
};

// The bright mountain top (high key, cream-gold).
export const GLORY: Mood = {
	skyTop: '#d9d4e6',
	skyHorizon: '#fff4dc',
	skyBottom: '#f6e2c0',
	sunDir: [0.0, 0.55, -0.83],
	sunColor: '#fff6dc',
	sunGlow: 1.2,
	sunSize: 6,
	light: '#fff4dc',
	lightI: 2.1,
	hemiSky: '#fff6e6',
	hemiGround: '#b89a7c',
	hemiI: 1.35,
	fog: '#fbeedd',
	fogNear: 30,
	fogFar: 260,
	storm: 0,
	stormA: '#3b3a52',
	stormB: '#6b5a6e',
	hole: 0.6,
	holeColor: '#fff2c8',
	cloud: '#ffffff',
	cloudShade: '#e8d9cc',
	tint: '#fff8ee',
};
