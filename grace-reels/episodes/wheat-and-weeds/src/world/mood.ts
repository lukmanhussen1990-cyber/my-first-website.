// Lighting/colour moods that a world can blend between over time (night garden, dawn, day feast).
import * as THREE from 'three';
import type {SkyParams} from './atmosphere';

export type Mood = {
	skyTop: string;
	skyMid?: string;
	skyHorizon: string;
	skyBottom: string;
	sunDir: [number, number, number]; // the moon at night
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
	stars: number;
	cloud: string;
	cloudShade: string;
	tint: string; // multiplied onto the flat character sprites
};

const ca = new THREE.Color();
const cb = new THREE.Color();
export const mixHex = (a: string, b: string, m: number) => '#' + ca.set(a).lerp(cb.set(b), m).getHexString();
const mixN = (a: number, b: number, m: number) => a + (b - a) * m;
const midOf = (m: Mood) => m.skyMid ?? mixHex(m.skyHorizon, m.skyTop, 0.3);

export const mixMood = (a: Mood, b: Mood, m: number): Mood => {
	if (m <= 0) return a;
	if (m >= 1) return b;
	const out = {} as Record<string, unknown>;
	for (const k of Object.keys(a) as (keyof Mood)[]) {
		if (k === 'skyMid') continue;
		const va = a[k];
		const vb = b[k];
		if (typeof va === 'number') out[k] = mixN(va, vb as number, m);
		else if (typeof va === 'string') out[k] = mixHex(va, vb as string, m);
		else out[k] = (va as number[]).map((x, i) => mixN(x, (vb as number[])[i], m));
	}
	if (a.skyMid || b.skyMid) out.skyMid = mixHex(midOf(a), midOf(b), m);
	return out as Mood;
};

export const skyFromMood = (m: Mood, t: number): SkyParams => ({
	top: m.skyTop,
	mid: m.skyMid,
	horizon: m.skyHorizon,
	bottom: m.skyBottom,
	sunDir: m.sunDir,
	sunColor: m.sunColor,
	sunGlow: m.sunGlow,
	sunSize: m.sunSize,
	stars: m.stars,
	t,
});

// The olive garden at night: deep blue sky, a big pale moon high on the right, blue-violet shadows.
// (Torchlight is added as point lights and glows by the shots.)
export const NIGHT: Mood = {
	skyTop: '#121a30',
	skyMid: '#1b2440',
	skyHorizon: '#32456b',
	skyBottom: '#1e2236',
	sunDir: [0.42, 0.52, -0.74],
	sunColor: '#f3ecdf',
	sunGlow: 0.42,
	sunSize: 7,
	light: '#9fb4d8',
	lightI: 1.15,
	hemiSky: '#4a5b85',
	hemiGround: '#2b2440',
	hemiI: 0.7,
	fog: '#1f2a45',
	fogNear: 14,
	fogFar: 90,
	stars: 1,
	cloud: '#3a4a70',
	cloudShade: '#222c48',
	tint: '#c9d2e6',
};

// Dawn rising behind the olive trees (Romans 5:10): warm gold low in the sky, the night lifting.
export const DAWN: Mood = {
	skyTop: '#3a4a74',
	skyMid: '#a27a86',
	skyHorizon: '#ffcf8f',
	skyBottom: '#c98e74',
	sunDir: [-0.15, 0.06, -0.99],
	sunColor: '#ffe2a6',
	sunGlow: 1.1,
	sunSize: 4.5,
	light: '#ffcf9a',
	lightI: 1.7,
	hemiSky: '#c7b4c4',
	hemiGround: '#5c4436',
	hemiI: 0.9,
	fog: '#b98d84',
	fogNear: 18,
	fogFar: 140,
	stars: 0,
	cloud: '#f2c7a6',
	cloudShade: '#8c6a7a',
	tint: '#ffe6d2',
};

// The bright feast courtyard (late morning, warm).
export const DAY: Mood = {
	skyTop: '#6f9fcc',
	skyMid: '#9cc2e0',
	skyHorizon: '#f2e4c8',
	skyBottom: '#e6cfa4',
	sunDir: [-0.55, 0.72, 0.42],
	sunColor: '#fff3d6',
	sunGlow: 0.25,
	sunSize: 1.4,
	light: '#fff0d2',
	lightI: 2.5,
	hemiSky: '#e9ecf0',
	hemiGround: '#a58660',
	hemiI: 1.15,
	fog: '#efe2c8',
	fogNear: 30,
	fogFar: 200,
	stars: 0,
	cloud: '#ffffff',
	cloudShade: '#dfd2c4',
	tint: '#fff8ee',
};

// Morning on Sinai after the storm: a clear pale sky, the low sun behind the ridge, warm haze below.
export const MORNING: Mood = {
	skyTop: '#6d92c0',
	skyMid: '#b8c3d3',
	skyHorizon: '#ffd9a4',
	skyBottom: '#e8c49c',
	sunDir: [-0.55, 0.14, -0.82],
	sunColor: '#fff0c8',
	sunGlow: 0.95,
	sunSize: 3.4,
	light: '#ffe2b4',
	lightI: 2.3,
	hemiSky: '#dfe3ec',
	hemiGround: '#9a7a5a',
	hemiI: 1.05,
	fog: '#ead3b6',
	fogNear: 70,
	fogFar: 900,
	stars: 0,
	cloud: '#fff1e0',
	cloudShade: '#e2b8a2',
	tint: '#fff2e2',
};

// The camp below the mountain later that morning: the same sun, higher, the valley floor bright.
export const CAMP_DAY: Mood = {
	...MORNING,
	skyTop: '#6e98c6',
	skyMid: '#a9c0d8',
	skyHorizon: '#f6dfba',
	skyBottom: '#e3caa2',
	sunDir: [-0.5, 0.32, -0.8],
	sunGlow: 0.6,
	lightI: 2.4,
	fog: '#ecdcc2',
	fogNear: 30,
	fogFar: 420,
};

// Sunrise on a Galilee hillside: pink-gold sky over the lake, the low sun off to the left.
export const GALILEE: Mood = {
	skyTop: '#8aa6cc',
	skyMid: '#d8c5c2',
	skyHorizon: '#ffd5a0',
	skyBottom: '#efc39a',
	sunDir: [-0.62, 0.07, -0.78],
	sunColor: '#fff0c4',
	sunGlow: 1.0,
	sunSize: 4,
	light: '#ffe0b0',
	lightI: 2.3,
	hemiSky: '#f1e6d6',
	hemiGround: '#7d7a4a',
	hemiI: 1.05,
	fog: '#f3d9b8',
	fogNear: 60,
	fogFar: 650,
	stars: 0,
	cloud: '#fff1df',
	cloudShade: '#f1b9a0',
	tint: '#fff3e4',
};

// ---- Wheat and Weeds ----
// Moonlit night over the field: a big silver moon, deep blue sky, the wheat glowing silver-gold.
export const FIELD_NIGHT: Mood = {
	skyTop: '#0a1124',
	skyMid: '#152040',
	skyHorizon: '#2d3c66',
	skyBottom: '#141a2c',
	sunDir: [0.3, 0.5, -0.81],
	sunColor: '#f6f0de',
	sunGlow: 0.022, // the halo adds in linear light: keep it faint or the night sky turns grey
	sunSize: 2.6,
	light: '#b4c6ee',
	lightI: 1.55,
	hemiSky: '#3e4f80',
	hemiGround: '#1c1a24',
	hemiI: 0.8,
	fog: '#1b2544',
	fogNear: 18,
	fogFar: 170,
	stars: 1,
	cloud: '#2c3a62',
	cloudShade: '#19223e',
	tint: '#b9c6e2',
};

// Sunrise: the sun just over the hills behind the farm, long warm light across the rows.
export const FIELD_SUNRISE: Mood = {
	skyTop: '#7896c0',
	skyMid: '#e4b8a2',
	skyHorizon: '#ffcf88',
	skyBottom: '#e6b48a',
	sunDir: [-0.42, 0.1, -0.9],
	sunColor: '#fff0c0',
	sunGlow: 1.1,
	sunSize: 4.2,
	light: '#ffd49c',
	lightI: 2.2,
	hemiSky: '#efd6c8',
	hemiGround: '#7d5f44',
	hemiI: 1.0,
	fog: '#f0c79e',
	fogNear: 40,
	fogFar: 320,
	stars: 0,
	cloud: '#ffe6d0',
	cloudShade: '#e9a98e',
	tint: '#ffeedd',
};

// A clear afternoon: the field in full, warm light.
export const FIELD_DAY: Mood = {
	skyTop: '#6a9bcb',
	skyMid: '#a6c5e2',
	skyHorizon: '#f2e2bc',
	skyBottom: '#e6cfa4',
	sunDir: [-0.62, 0.52, -0.38],
	sunColor: '#fff3d6',
	sunGlow: 0.3,
	sunSize: 1.6,
	light: '#fff0cf',
	lightI: 2.4,
	hemiSky: '#e8ecf2',
	hemiGround: '#a08060',
	hemiI: 1.1,
	fog: '#efe2c8',
	fogNear: 50,
	fogFar: 360,
	stars: 0,
	cloud: '#ffffff',
	cloudShade: '#dfd2c4',
	tint: '#fff7ec',
};

// Golden hour: the low sun turning everything amber (grow together, the hard truth, patience).
export const FIELD_GOLDEN: Mood = {
	skyTop: '#8098c0',
	skyMid: '#e2bea0',
	skyHorizon: '#ffcd86',
	skyBottom: '#e6b68a',
	sunDir: [-0.74, 0.17, -0.65],
	sunColor: '#ffe3a8',
	sunGlow: 0.95,
	sunSize: 3.6,
	light: '#ffd49a',
	lightI: 2.3,
	hemiSky: '#f0dac0',
	hemiGround: '#7a5a3a',
	hemiI: 1.0,
	fog: '#efcca0',
	fogNear: 40,
	fogFar: 300,
	stars: 0,
	cloud: '#ffe8cc',
	cloudShade: '#e6b090',
	tint: '#fff0de',
};
