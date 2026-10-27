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
