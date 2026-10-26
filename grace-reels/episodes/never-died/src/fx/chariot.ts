// Choreography of the chariot of fire in story time τ (seconds on the S4 clock; S6 replays it slowed).
// It appears as a fireball high in the sky, dives in on the burst, hovers between Elijah and Elisha
// with the horses rearing, then launches away up into the sky.
import {easeOut, keys, pulse, seg} from '../lib/ease';
import {hash} from '../lib/random';
import {Key3, pathAt} from '../lib/path';
import {B} from '../lib/timeline';
import type {ParticleSpec} from './Particles';
import {HORSE_OFFSETS, STRIDE, TeamPose} from './team';

export const TEAM_SCALE = 0.82;
const BURST = B.chariotBurst;
export const HOVER_END = BURST + 1.55; // launches away after this

export const TEAM_KEYS: Key3[] = [
	[BURST - 1.4, 1.5, 24, -62],
	[BURST - 0.65, 0.2, 10, -27],
	[BURST - 0.25, -3.6, 4.6, -9],
	[BURST, -3.2, 2.0, -2.6],
	[BURST + 0.26, -0.35, 0.3, 0],
	[BURST + 0.7, 0.05, 0.42, -0.05],
	[BURST + 1.2, 0.3, 0.36, -0.12],
	[HOVER_END, 0.55, 0.5, -0.2],
	[HOVER_END + 0.5, 1.6, 2.6, -2.2],
	[HOVER_END + 1.1, 2.4, 5.2, -6.5],
	[HOVER_END + 1.8, 1.6, 7.2, -11.5],
	[HOVER_END + 2.6, 0.2, 8.6, -16],
	[HOVER_END + 3.6, -2.0, 12, -26],
	[HOVER_END + 5.0, -5, 18, -45],
];

export const TURN_AT = Infinity; // it keeps facing right as it climbs away

export const teamState = (τ: number) => {
	const pos = pathAt(TEAM_KEYS, τ);
	const hover = seg(τ, BURST + 0.2, BURST + 0.5) * (1 - seg(τ, HOVER_END - 0.1, HOVER_END + 0.3));
	pos[1] += hover * 0.08 * Math.sin((τ - BURST) * 5.2);
	const rear = keys(τ, [
		[BURST + 0.1, 0],
		[BURST + 0.38, 1],
		[BURST + 0.8, 0.45],
		[BURST + 1.25, 0.7],
		[HOVER_END - 0.05, 0.35],
		[HOVER_END + 0.3, -0.15],
		[HOVER_END + 0.9, 0],
	]);
	const pose: TeamPose = {
		phases: [(τ - (BURST + 0.15 + HORSE_OFFSETS[0])) / STRIDE, (τ - (BURST + 0.15 + HORSE_OFFSETS[1])) / STRIDE],
		rear,
		wheel: -τ * 9,
		t: τ,
	};
	const appear = seg(τ, BURST - 1.4, BURST - 1.0);
	const leave = 1 - seg(τ, HOVER_END + 4.2, HOVER_END + 5.0);
	return {
		pos,
		pose,
		facing: τ < TURN_AT ? 1 : -1,
		opacity: appear * leave,
		intensity: 0.78 + 0.18 * pulse(τ, BURST + 0.05, 0.05, 0.5),
		hover,
		active: appear * leave > 0.001,
	};
};

// How strongly the fire lights the two men (1 when it hovers between them).
export const fireNear = (τ: number) => seg(τ, BURST - 0.15, BURST + 0.25) * (1 - seg(τ, HOVER_END + 0.2, HOVER_END + 1.0));

// Sparks shed along the path (they stay where they were born and float up, so they trail behind).
export const sparkSpecs = (count: number, seed = 7): ParticleSpec[] => {
	const out: ParticleSpec[] = [];
	const t0 = BURST - 0.7;
	const t1 = HOVER_END + 2.4;
	for (let i = 0; i < count; i++) {
		const b = t0 + ((i + hash(seed, i)) / count) * (t1 - t0);
		const p = pathAt(TEAM_KEYS, b);
		const f = b < TURN_AT ? 1 : -1;
		const ox = (hash(seed, i, 1) * 3.8 - 2.1) * TEAM_SCALE * f;
		const oy = (0.25 + hash(seed, i, 2) * 2.0) * TEAM_SCALE;
		out.push({
			birth: b,
			pos: [p[0] + ox, p[1] + oy, p[2] + (hash(seed, i, 3) - 0.5) * 0.6],
			vel: [(hash(seed, i, 4) - 0.6) * 2.2 * f, 0.6 + hash(seed, i, 5) * 2.4, (hash(seed, i, 6) - 0.5) * 1.6],
			life: 0.5 + hash(seed, i, 7) * 0.9,
			size: 0.5 + hash(seed, i, 8) * 0.9,
			seed: hash(seed, i, 9),
		});
	}
	return out;
};

// A ring of dust thrown out along the ground when the team lands between them.
export const dustRingSpecs = (count: number, center: [number, number, number], at: number, seed = 11): ParticleSpec[] =>
	Array.from({length: count}, (_, i) => {
		const a = (i / count) * Math.PI * 2 + hash(seed, i) * 0.3;
		const sp = 2.2 + hash(seed, i, 1) * 2.6;
		return {
			birth: at + hash(seed, i, 2) * 0.12,
			pos: [center[0] + Math.cos(a) * 0.4, center[1] + 0.1 + hash(seed, i, 3) * 0.2, center[2] + Math.sin(a) * 0.4] as [number, number, number],
			vel: [Math.cos(a) * sp, 0.3 + hash(seed, i, 4) * 0.6, Math.sin(a) * sp] as [number, number, number],
			life: 1.2 + hash(seed, i, 5) * 0.9,
			size: 2.2 + hash(seed, i, 6) * 2.2,
			seed: hash(seed, i, 7),
		};
	});

export const recoil = (τ: number) => seg(τ, BURST + 0.1, BURST + 0.62, easeOut);
