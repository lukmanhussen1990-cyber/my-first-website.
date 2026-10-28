import * as THREE from 'three';
import {sunAt, sunriseAt, type SunState} from '../../../src/shared/sun';

// Light moods for each place. Built from the shared sun model, then nudged.
const C = (hex: string) => new THREE.Color(hex);
export const mood = (base: SunState, o: Partial<SunState>): SunState => ({...base, ...o});
export const mixMood = (a: SunState, b: SunState, k: number): SunState => {
	const out = {...a} as Record<string, unknown>;
	for (const key of Object.keys(a) as (keyof SunState)[]) {
		const va = a[key];
		const vb = b[key];
		if (va instanceof THREE.Color && vb instanceof THREE.Color) out[key] = va.clone().lerp(vb, k);
		else if (typeof va === 'number' && typeof vb === 'number') out[key] = va + (vb - va) * k;
		else out[key] = k < 0.5 ? va : vb;
	}
	return out as unknown as SunState;
};

// Daniel's upper room: a low, warm afternoon sun pouring through the window
export const goldRoom = (): SunState => mood(sunAt(0.6), {elevationDeg: 22, lightIntensity: 2.6, hemiIntensity: 0.62, exposure: 1.0, warmth: 0.3, figureTint: C('#F4E2C8')});
// Babylon's throne hall: bright, warm, a little hazy
export const hall = (): SunState => mood(sunAt(0.42), {elevationDeg: 40, lightIntensity: 2.2, hemiIntensity: 0.95, figureTint: C('#F2E4CE')});
// a shadowed corner of the court and the lamp-lit table
export const intrigue = (): SunState => mood(sunAt(0.86), {elevationDeg: 10, lightIntensity: 0.55, hemiIntensity: 0.42, exposure: 0.82, warmth: 0.18, saturation: 0.9, figureTint: C('#A88E7E')});
// the lions' den: night, the eyes are the only light
export const den = (): SunState => mood(sunAt(1), {elevationDeg: 30, light: C('#8FA0D8'), lightIntensity: 0.5, hemiIntensity: 0.3, exposure: 0.8, saturation: 0.75, figureTint: C('#4A4E66')});
// the modern living room at night: cold, the phone is the light
export const night = (): SunState => mood(sunAt(1), {lightIntensity: 0, hemiIntensity: 0.3, exposure: 0.8, warmth: -0.24, saturation: 0.8, figureTint: C('#56607E')});
// the quiet room once the phone is down: a warm lamp
export const warmRoom = (): SunState => mood(sunAt(0.9), {elevationDeg: 6, lightIntensity: 0.4, hemiIntensity: 0.62, exposure: 0.95, warmth: 0.32, figureTint: C('#E6C6A2')});
// the three times of prayer (S11)
export const evening = (): SunState => sunAt(0.88);
export const morning = (): SunState => sunriseAt(1);
export const noon = (): SunState => sunAt(0.04);
