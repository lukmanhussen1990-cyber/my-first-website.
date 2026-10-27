import * as THREE from 'three';
import {clamp, deg, lerp, monotone} from './math';

// The one sun of a reel. sunTime runs 0 (noon) -> 1 (dusk); every scene reads the same
// state, so sky, key light, ambient, fog, shadows and grade all set together.

type Key = {
	t: number;
	zenith: string;
	horizon: string;
	sun: string;
	glow: string;
	light: string;
	lightI: number;
	hemiSky: string;
	hemiGround: string;
	hemiI: number;
	cloudLit: string;
	cloudShade: string;
	icon: string;
	warmth: number;
	sat: number;
	exposure: number;
};

const KEYS: Key[] = [
	{t: 0.0, zenith: '#4F92DC', horizon: '#F4E3C4', sun: '#FFF7E2', glow: '#FFF0CC', light: '#FFF2DC', lightI: 2.6,
		hemiSky: '#E6E0D6', hemiGround: '#BE9A6C', hemiI: 1.2, cloudLit: '#FFFFFF', cloudShade: '#D6DCE6',
		icon: '#FFF1C9', warmth: 0.1, sat: 1.12, exposure: 1.0},
	{t: 0.3, zenith: '#4F88CF', horizon: '#F6D9A6', sun: '#FFEFC8', glow: '#FFE2A4', light: '#FFE4B8', lightI: 2.5,
		hemiSky: '#E2D8D0', hemiGround: '#BC9264', hemiI: 1.14, cloudLit: '#FFF6E6', cloudShade: '#D3CFD8',
		icon: '#FFE2A0', warmth: 0.16, sat: 1.12, exposure: 1.0},
	{t: 0.55, zenith: '#7882B9', horizon: '#F5B56C', sun: '#FFD486', glow: '#FFB45E', light: '#FFBE76', lightI: 2.25,
		hemiSky: '#C7BFD6', hemiGround: '#A67E58', hemiI: 1.05, cloudLit: '#FFDDB0', cloudShade: '#C3A8B0',
		icon: '#FFC266', warmth: 0.28, sat: 1.14, exposure: 1.0},
	{t: 0.8, zenith: '#56508C', horizon: '#F2744A', sun: '#FF9A52', glow: '#FF7442', light: '#FF8E56', lightI: 1.6,
		hemiSky: '#A491B6', hemiGround: '#87604A', hemiI: 0.9, cloudLit: '#FFAE84', cloudShade: '#8B6B88',
		icon: '#FF8A3D', warmth: 0.34, sat: 1.1, exposure: 0.98},
	{t: 0.9, zenith: '#3B386E', horizon: '#D65E48', sun: '#FF7A3E', glow: '#EE5C3E', light: '#E0744E', lightI: 0.95,
		hemiSky: '#7A73A6', hemiGround: '#68493F', hemiI: 0.78, cloudLit: '#E68C6E', cloudShade: '#5B5076',
		icon: '#EE6A36', warmth: 0.2, sat: 1.04, exposure: 0.94},
	{t: 1.0, zenith: '#1D244E', horizon: '#7B4E5E', sun: '#E0603A', glow: '#A14A4C', light: '#6B76B6', lightI: 0.0,
		hemiSky: '#4A5590', hemiGround: '#3A3042', hemiI: 0.72, cloudLit: '#6D6388', cloudShade: '#2D3257',
		icon: '#D9442C', warmth: -0.12, sat: 0.92, exposure: 0.88},
];

// A fresh sunrise for the loop back to noon (Lamentations 3:22-23, "new every morning").
export const SUNRISE: Key = {t: 0, zenith: '#88B3DA', horizon: '#FFD9A6', sun: '#FFF0C8', glow: '#FFD08A',
	light: '#FFE0B0', lightI: 2.0, hemiSky: '#D8E0EE', hemiGround: '#B79A78', hemiI: 1.1, cloudLit: '#FFE9CC',
	cloudShade: '#C9C3D6', icon: '#FFF1C9', warmth: 0.12, sat: 1.04, exposure: 1.0};

// Sun height above the horizon, in degrees. The visible disc has a radius of SUN_RADIUS_DEG,
// so it touches the horizon at t = 0.84 and its last sliver goes under at t ~ 0.98.
export const SUN_RADIUS_DEG = 2.4;
const elevation = monotone([0, 0.3, 0.55, 0.7, 0.84, 0.9, 0.98, 1.0], [55, 40, 18, 9, 2.4, 0.7, -2.5, -4]);

export type SunState = {
	t: number;
	elevationDeg: number;
	zenith: THREE.Color;
	horizon: THREE.Color;
	sunColor: THREE.Color;
	glow: THREE.Color;
	light: THREE.Color;
	lightIntensity: number;
	hemiSky: THREE.Color;
	hemiGround: THREE.Color;
	hemiIntensity: number;
	fog: THREE.Color;
	cloudLit: THREE.Color;
	cloudShade: THREE.Color;
	icon: string;
	warmth: number;
	saturation: number;
	exposure: number;
	// characters are unlit cut-outs; this tints them so they sit in the scene's light
	figureTint: THREE.Color;
};

const c = (hex: string) => new THREE.Color(hex);
const mixHex = (a: string, b: string, k: number) => '#' + c(a).lerp(c(b), k).getHexString();

const blend = (a: Key, b: Key, k: number): Omit<SunState, 't' | 'elevationDeg' | 'fog' | 'figureTint'> => ({
	zenith: c(a.zenith).lerp(c(b.zenith), k),
	horizon: c(a.horizon).lerp(c(b.horizon), k),
	sunColor: c(a.sun).lerp(c(b.sun), k),
	glow: c(a.glow).lerp(c(b.glow), k),
	light: c(a.light).lerp(c(b.light), k),
	lightIntensity: lerp(a.lightI, b.lightI, k),
	hemiSky: c(a.hemiSky).lerp(c(b.hemiSky), k),
	hemiGround: c(a.hemiGround).lerp(c(b.hemiGround), k),
	hemiIntensity: lerp(a.hemiI, b.hemiI, k),
	cloudLit: c(a.cloudLit).lerp(c(b.cloudLit), k),
	cloudShade: c(a.cloudShade).lerp(c(b.cloudShade), k),
	icon: mixHex(a.icon, b.icon, k),
	warmth: lerp(a.warmth, b.warmth, k),
	saturation: lerp(a.sat, b.sat, k),
	exposure: lerp(a.exposure, b.exposure, k),
});

const finish = (t: number, elevationDeg: number, s: ReturnType<typeof blend>): SunState => {
	const fog = s.horizon.clone().lerp(s.zenith, 0.12).lerp(s.hemiSky, 0.2);
	// cut-outs read ~ like a lit matte surface: key light + sky fill, normalised to ~1 at noon
	const up = clamp(Math.sin(deg(Math.max(elevationDeg, 0))) * 1.3);
	const figureTint = new THREE.Color(1, 1, 1)
		.multiplyScalar(0.55 + 0.45 * up)
		.lerp(s.light.clone().multiplyScalar(0.62 + 0.38 * up + 0.3), 0.28 * clamp(s.lightIntensity / 2))
		.lerp(s.hemiSky.clone().multiplyScalar(0.95), 0.35 * (1 - clamp(s.lightIntensity / 1.5)));
	return {t, elevationDeg, ...s, fog, figureTint};
};

export const sunAt = (tRaw: number): SunState => {
	const t = clamp(tRaw);
	let i = 0;
	while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
	const a = KEYS[i];
	const b = KEYS[i + 1];
	const k = clamp((t - a.t) / (b.t - a.t));
	return finish(t, elevation(t), blend(a, b, k));
};

// k = 0 -> dusk of the story, k = 1 -> fresh sunrise (used by the loop at the very end)
export const sunriseAt = (k: number): SunState => {
	const dusk = KEYS[KEYS.length - 1];
	return finish(0, lerp(-4, 6, k), blend(dusk, SUNRISE, clamp(k)));
};

// World-space unit vector toward the sun. azimuthDeg is measured from +Z toward +X in the
// scene's own coordinates, so each set can face its sun where the composition needs it.
export const sunDirection = (elevationDeg: number, azimuthDeg: number) => {
	const el = deg(elevationDeg);
	const az = deg(azimuthDeg);
	return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
};
