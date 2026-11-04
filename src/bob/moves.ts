// Bob body animation: the synced robot walk, eating the sandwich, staring, gasping, and the free moves at the end.
import {Pose, REST, idle, walk, withPose} from '../characters/poses';
import {clamp, easeInOut, easeOut} from '../lib/anim';

const TAU = Math.PI * 2;
const s = Math.sin;

/** stiff, perfectly regular robot walk (everyone shares the same t => perfect sync) */
export function robotWalk(t: number, speed = 1): Pose {
	const ph = t * TAU * 0.9 * speed;
	const sw = s(ph) * 0.52;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.07,
		armL: [-sw, 0, 0.05],
		armR: [sw, 0, -0.05],
		legL: [sw, 0, 0],
		legR: [-sw, 0, 0],
	};
}
/** distance covered by robotWalk per second (world units at scale 1) */
export const ROBOT_SPEED = 2.1;

/** the sandwich routine. k = seconds since "everyone eats", bite at biteT seconds */
export function eatPose(k: number, biteT: number): {pose: Pose; sandwich: 0 | 1 | 2} {
	// 0-0.6 s pull the sandwich out, then hold it in front, then lift to the mouth, bite, chew
	const pull = easeOut(clamp(k / 0.6));
	const lift = easeInOut(clamp((k - (biteT - 1.6)) / 1.3));
	const bite = k >= biteT - 0.08 && k < biteT + 0.18 ? Math.sin(clamp((k - biteT + 0.08) / 0.26) * Math.PI) : 0;
	const chew = k > biteT + 0.2 ? Math.abs(s((k - biteT) * TAU * 2.4)) : 0;
	const armX = -0.3 - pull * 1.0 - lift * 0.62;
	const pose: Pose = {
		...REST,
		y: chew * 0.02,
		head: [bite * 0.32 + chew * 0.05, 0, 0],
		lean: bite * 0.08,
		armL: [0, 0, 0.06],
		armR: [armX, 0, 0.1 + pull * 0.25 + lift * 0.3],
	};
	return {pose, sandwich: k < 0.25 ? 0 : k >= biteT ? 2 : 1};
}

/** everyone turns their head together (yaw radians, k 0..1) */
export const headTurn = (base: Pose, yaw: number, k: number): Pose => withPose(base, {head: [base.head[0], yaw * easeInOut(clamp(k)), base.head[2]], turn: yaw * 0.25 * easeInOut(clamp(k))});

/** gasp: lean back, arms out (k 0..1) */
export function gasp(k: number, base: Pose = REST): Pose {
	const e = easeOut(clamp(k));
	return {...base, lean: -0.12 * e, head: [-0.15 * e, 0, 0], armL: [-0.5 * e, 0, 0.5 * e], armR: [-0.5 * e, 0, -0.5 * e]};
}

/** the free moves at the end: everyone their own way */
export function freeMove(t: number, seed: number): Pose {
	const kind = seed % 6;
	const sp = 0.7 + ((seed * 37) % 100) / 100 * 0.8;
	const ph = t * sp + seed * 0.37;
	switch (kind) {
		case 0:
			return walk(ph, 0.9, 1.1);
		case 1: {
			// skip / hop
			const h = Math.max(0, s(ph * TAU * 1.3));
			return withPose(walk(ph, 1.3, 1.2), {y: h * 0.45, armL: [-0.4, 0, 0.9 + h * 0.6], armR: [-0.4, 0, -0.9 - h * 0.6]});
		}
		case 2: {
			// dance
			const d = s(ph * TAU * 1.6);
			return {...idle(ph, seed), y: Math.abs(d) * 0.15, tilt: d * 0.15, turn: d * 0.3, armL: [-1.2, 0, 1.4 + d * 0.5], armR: [-1.2, 0, -1.4 + d * 0.5], legL: [d * 0.3, 0, 0], legR: [-d * 0.3, 0, 0]};
		}
		case 3:
			// strut
			return withPose(walk(ph, 0.75, 1.4), {lean: -0.06, head: [-0.12, 0.2, 0]});
		case 4: {
			// wave
			const w = s(ph * TAU * 2);
			return {...idle(ph, seed), armR: [-0.2, 0, -2.6 + w * 0.3], head: [-0.1, 0, w * 0.06]};
		}
		default: {
			// spin
			const d = s(ph * TAU * 1.1);
			return {...idle(ph, seed), turn: d * 0.8, armL: [-0.3, 0, 1.3], armR: [-0.3, 0, -1.3], y: Math.abs(d) * 0.08};
		}
	}
}
