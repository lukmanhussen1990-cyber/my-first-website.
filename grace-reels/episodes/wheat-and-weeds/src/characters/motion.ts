// Character motion as pure functions of time (seconds). Angles are degrees, CCW positive; characters
// face right, so a positive leg angle swings the foot forward and a positive head angle looks up.
import {clamp, easeInOut, lerp, smooth} from '../lib/ease';
import {noise1} from '../lib/random';
import {WALK} from '../lib/timeline';
import type {RigPose} from './Rig';

// Gait over one cycle (two steps). Returns the near foot's forward position (-1..1) and lift (0..1);
// the far foot is the same half a cycle later. Stance: the planted foot moves back at constant speed,
// so with the matching root speed it stays still on the ground (no foot sliding).
export const gait = (p: number) => {
	const q = ((p % 1) + 1) % 1;
	if (q < 0.5) return {x: 1 - 4 * q, lift: 0};
	const s = (q - 0.5) / 0.5;
	return {x: -1 + 2 * easeInOut(s), lift: Math.sin(Math.PI * s)};
};

export const walkPhase = (who: 'enoch' | 'elijah' | 'elisha', t: number, t0: number) => {
	const {period, phase} = WALK[who];
	return (t - t0) / period - phase;
};

// Body bob: lowest at each foot contact.
const bob = (p: number) => (1 - Math.cos(4 * Math.PI * p)) / 2;

export type WalkOpts = {amount?: number; talk?: number; lookUp?: number; point?: number; seed?: number; t?: number};

// --- Elijah: heavy, strong steps; cloak, hair and beard follow through. ---
export const ELIJAH_STRIDE_DEG = 19;
export const elijahWalk = (p: number, o: WalkOpts = {}): RigPose => {
	const a = o.amount ?? 1;
	const n = gait(p);
	const f = gait(p + 0.5);
	const legA = ELIJAH_STRIDE_DEG;
	const t = o.t ?? 0;
	const breathe = Math.sin(t * 1.6) * 0.6;
	const talk = o.talk ?? 0;
	const point = o.point ?? 0;
	const look = o.lookUp ?? 0;
	const armSwing = 15 * a;
	const nearArm = lerp(-n.x * armSwing, 62, point) + talk * (8 + 6 * Math.sin(t * 5.3));
	const nearFore = lerp(10 + Math.max(0, -n.x) * 10, 18, point) + talk * (14 + 10 * Math.sin(t * 4.1 + 1));
	return {
		angles: {
			torso: -3 * a + breathe * 0.2,
			head: look * 14 + talk * 2.5 * Math.sin(t * 3.3) + a * 1.5 * Math.cos(4 * Math.PI * p),
			leg_near: n.x * legA * a,
			leg_far: f.x * legA * a,
			arm_upper_near: nearArm,
			forearm_near: nearFore,
			arm_upper_far: n.x * armSwing * 0.8 + 4,
			forearm_far: 8 + Math.max(0, n.x) * 10,
			cloak: -4 * a - 3 * a * Math.sin(2 * Math.PI * (p - 0.15)),
			hair: -2 * a * Math.sin(2 * Math.PI * (p - 0.2)),
			beard: 1.5 * a * Math.sin(4 * Math.PI * (p - 0.1)),
		},
		lift: [0, -16 * a * bob(p) + breathe],
		offsets: {leg_near: [0, -16 * n.lift * a], leg_far: [0, -16 * f.lift * a]},
		warps: {
			torso: {hem: [-14 * a * n.x, 0.62, 1]},
			cloak: {wave: [10 + 8 * a, 7, t * 5 + p * 6.28, 0.25]},
			hair: {wave: [5, 6, t * 3, 0.35]},
			beard: {wave: [3, 7, t * 3.5 + 1, 0.3]},
		},
	};
};

// --- Enoch: calm, steady; long robe, so only the feet show under the hem. ---
export const enochWalk = (p: number, o: WalkOpts = {}): RigPose => {
	const a = o.amount ?? 1;
	const n = gait(p);
	const f = gait(p + 0.5);
	const t = o.t ?? 0;
	const look = o.lookUp ?? 0;
	const reach = o.point ?? 0; // here: both hands open toward the light
	return {
		angles: {
			torso: -2 * a + look * 2,
			head: look * 16 + a * 1.2 * Math.cos(4 * Math.PI * p),
			leg_near: n.x * 13 * a,
			leg_far: f.x * 13 * a,
			arm_upper_near: lerp(-n.x * 11 * a, 70, reach),
			forearm_near: lerp(8, 35, reach),
			arm_upper_far: lerp(n.x * 9 * a + 3, 55, reach),
			forearm_far: lerp(6, 30, reach),
			beard: 0,
		},
		lift: [0, -11 * a * bob(p) + Math.sin(t * 1.5) * 0.6],
		offsets: {leg_near: [0, -12 * n.lift * a], leg_far: [0, -12 * f.lift * a]},
		warps: {torso: {hem: [-16 * a * n.x, 0.55, 1]}},
	};
};

// --- Elisha (cut rig): lighter, quicker steps; feet slide under the hem, the sleeve swings. ---
export const ELISHA_FOOT_PX = 92;
export const elishaWalk = (p: number, o: WalkOpts = {}): RigPose => {
	const a = o.amount ?? 1;
	const n = gait(p);
	const f = gait(p + 0.5);
	const t = o.t ?? 0;
	const talk = o.talk ?? 0;
	const look = o.lookUp ?? 0;
	return {
		angles: {
			body: -1.5 * a + 2 * look,
			arm: -n.x * 9 * a + talk * (10 + 7 * Math.sin(t * 4.7)),
			foot_near: -n.lift * 10 * a,
			foot_far: -f.lift * 10 * a,
		},
		lift: [0, -9 * a * bob(p) + Math.sin(t * 1.7) * 0.5],
		offsets: {
			foot_near: [n.x * ELISHA_FOOT_PX * a, -14 * n.lift * a],
			foot_far: [f.x * ELISHA_FOOT_PX * a, -14 * f.lift * a],
		},
		// looking up: the head tilts back around the neck (mesh warp on the one-piece body)
		warps: {body: {hem: [-18 * a * n.x, 0.58, 1], tilt: [look * 0.2, 0.5, 0.205, 0.2]}},
	};
};

// Root speed (m/s) that keeps the planted foot still for each walker.
export const walkSpeed = {
	// stride: the foot travels from +x to -x during half a cycle
	enoch: (pxPerM: number, legPx: number) => (2 * legPx * Math.sin((13 * Math.PI) / 180)) / pxPerM / (WALK.enoch.period / 2),
	elijah: (pxPerM: number, legPx: number) => (2 * legPx * Math.sin((ELIJAH_STRIDE_DEG * Math.PI) / 180)) / pxPerM / (WALK.elijah.period / 2),
	elisha: (pxPerM: number) => (2 * ELISHA_FOOT_PX) / pxPerM / (WALK.elisha.period / 2),
};

// Distance walked since t0 at speed v, easing to a stop over `dur` after tStop (pure function of t).
export const walkedX = (t: number, t0: number, tStop: number, v: number, dur = 0.45) => {
	if (t <= tStop) return v * (t - t0);
	const s = Math.min(1, (t - tStop) / dur);
	return v * (tStop - t0) + v * dur * (s - (s * s * s - 0.5 * s * s * s * s));
};

// Smoothly bring a walk to a stop: amount goes 1 -> 0 and the phase eases to the nearest contact.
export const stopping = (t: number, tStop: number, dur = 0.45) => 1 - smooth((t - tStop) / dur);

// Gentle idle life for standing poses (breathing + tiny sway), seeded per character.
export const idle = (t: number, seed: number) => ({
	breath: 0.006 * Math.sin(t * 1.7 + seed),
	lean: 3 * noise1(t * 0.35, seed),
});

export const clamp01 = clamp;
