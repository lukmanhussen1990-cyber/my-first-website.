// Body animation as pure functions of time -> joint angles.
// Conventions (character faces +Z, Y up; character's LEFT is +X):
//   arm/leg rotation.x < 0  -> limb swings forward / up
//   armL.z > 0 / armR.z < 0 -> arm raised out to the side
import {V3} from '../lib/anim';

export type Pose = {
	y: number; // hip height offset (bob, jump, sit)
	fwd: number; // hip forward offset
	lean: number; // torso pitch, + = forward
	turn: number; // torso yaw
	tilt: number; // torso roll
	head: V3;
	armL: V3;
	armR: V3;
	legL: V3;
	legR: V3;
};

export const REST: Pose = {
	y: 0, fwd: 0, lean: 0, turn: 0, tilt: 0,
	head: [0, 0, 0], armL: [0, 0, 0.06], armR: [0, 0, -0.06], legL: [0, 0, 0], legR: [0, 0, 0],
};

const TAU = Math.PI * 2;
const s = Math.sin;
const c = Math.cos;

export const mixPose = (a: Pose, b: Pose, w: number): Pose => {
	const l = (x: number, y: number) => x + (y - x) * w;
	const l3 = (x: V3, y: V3): V3 => [l(x[0], y[0]), l(x[1], y[1]), l(x[2], y[2])];
	return {
		y: l(a.y, b.y), fwd: l(a.fwd, b.fwd), lean: l(a.lean, b.lean), turn: l(a.turn, b.turn), tilt: l(a.tilt, b.tilt),
		head: l3(a.head, b.head), armL: l3(a.armL, b.armL), armR: l3(a.armR, b.armR), legL: l3(a.legL, b.legL), legR: l3(a.legR, b.legR),
	};
};

export const withPose = (p: Pose, o: Partial<Pose>): Pose => ({...p, ...o});

/** idle breathing bob, tiny arm sway */
export function idle(t: number, seed = 0): Pose {
	const ph = t * TAU * 0.32 + seed * 1.7;
	return {
		...REST,
		y: s(ph) * 0.025,
		lean: s(ph) * 0.012,
		head: [s(ph + 0.6) * 0.03, s(t * 0.5 + seed) * 0.06, s(t * 0.7 + seed) * 0.025],
		armL: [s(ph) * 0.03, 0, 0.07 + s(ph) * 0.025],
		armR: [s(ph + 0.4) * 0.03, 0, -0.07 - s(ph) * 0.025],
	};
}

/** walk cycle: arms and legs swing, body bobs. speed ~ steps per second / 2 */
export function walk(t: number, speed = 1, amp = 1): Pose {
	const ph = t * TAU * 0.95 * speed;
	const sw = s(ph) * 0.6 * amp;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.09 * amp,
		lean: 0.04,
		turn: s(ph) * 0.06 * amp,
		head: [0, -s(ph) * 0.04, 0],
		armL: [-sw * 0.85, 0, 0.07],
		armR: [sw * 0.85, 0, -0.07],
		legL: [sw, 0, 0],
		legR: [-sw, 0, 0],
	};
}

/** run: bigger swings, forward lean */
export function run(t: number, speed = 1): Pose {
	const ph = t * TAU * 1.7 * speed;
	const sw = s(ph);
	return {
		...REST,
		y: Math.abs(sw) * 0.22,
		lean: 0.22,
		turn: sw * 0.1,
		head: [-0.12, -sw * 0.05, 0],
		armL: [-sw * 1.1, 0, 0.12],
		armR: [sw * 1.1, 0, -0.12],
		legL: [sw * 0.95, 0, 0],
		legR: [-sw * 0.95, 0, 0],
	};
}

/** panicked run with arms flailing up */
export function panicRun(t: number): Pose {
	const p = run(t, 1.1);
	const ph = t * TAU * 3.2;
	return {...p, armL: [-2.6 + s(ph) * 0.5, 0, 0.5], armR: [-2.6 - s(ph) * 0.5, 0, -0.5], head: [0.05, s(ph * 0.5) * 0.15, 0]};
}

/** jump for joy: hops with arms up */
export function jumpJoy(t: number, seed = 0): Pose {
	const ph = t * TAU * 1.25 + seed;
	const h = Math.max(0, s(ph));
	const tuck = Math.max(0, s(ph)) * 0.5;
	return {
		...REST,
		y: h * 1.0,
		lean: -0.05,
		head: [-0.15, 0, s(ph * 0.5) * 0.08],
		armL: [-0.3, 0, 2.5 + s(ph) * 0.25],
		armR: [-0.3, 0, -2.5 - s(ph) * 0.25],
		legL: [-tuck, 0, 0.08],
		legR: [-tuck * 0.6, 0, -0.08],
	};
}

/** cheering: arms up in a V, bouncing */
export function cheer(t: number, seed = 0): Pose {
	const ph = t * TAU * 1.6 + seed * 2.1;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.18,
		head: [-0.12, s(ph * 0.5) * 0.1, 0],
		armL: [-0.25, 0, 2.45 + s(ph) * 0.25],
		armR: [-0.25, 0, -2.45 + s(ph + 1) * 0.25],
	};
}

/** clapping */
export function clap(t: number, seed = 0): Pose {
	const ph = t * TAU * 3.0 + seed;
	const k = (s(ph) + 1) / 2;
	return {
		...idle(t, seed),
		armL: [-1.25, 0, -0.18 - k * 0.32],
		armR: [-1.25, 0, 0.18 + k * 0.32],
	};
}

/** hug: arms wrapped forward; gentle sway */
export function hug(t: number, seed = 0): Pose {
	const ph = t * TAU * 0.5 + seed;
	return {
		...REST,
		lean: 0.12,
		tilt: s(ph) * 0.05,
		head: [0.1, 0, s(ph) * 0.12],
		armL: [-1.35, 0, -0.75],
		armR: [-1.35, 0, 0.75],
	};
}

/** dragging something heavy behind: leaning hard forward, arms back on the rope, slow short steps */
export function drag(t: number): Pose {
	const ph = t * TAU * 0.7;
	const sw = s(ph) * 0.38;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.05 - 0.05,
		lean: 0.55 + s(ph * 2) * 0.03,
		head: [-0.35, 0, s(ph) * 0.05],
		armL: [0.95, 0, 0.18],
		armR: [0.95, 0, -0.18],
		legL: [sw - 0.15, 0, 0],
		legR: [-sw - 0.15, 0, 0],
	};
}

/** sitting (Roblox style: legs straight forward). seat = hip drop below standing */
export function sit(t: number, seed = 0, seatDrop = 2.0): Pose {
	const ph = t * TAU * 0.3 + seed;
	return {
		...REST,
		y: -seatDrop + s(ph) * 0.015,
		fwd: 0,
		lean: -0.04,
		head: [s(ph) * 0.03, 0, 0],
		armL: [-0.55, 0, 0.12],
		armR: [-0.55, 0, -0.12],
		legL: [-Math.PI / 2, 0, 0.05],
		legR: [-Math.PI / 2, 0, -0.05],
	};
}

/** raise one hand (right) high, small wave */
export function raiseHand(t: number, eager = 1): Pose {
	const ph = t * TAU * 1.4;
	return {
		...idle(t),
		y: Math.abs(s(ph)) * 0.05 * eager,
		tilt: -0.08,
		head: [-0.1, 0, -0.05],
		armR: [-2.95, 0, -0.12 + s(ph) * 0.12 * eager],
	};
}

/** point forward with the right arm */
export function point(t: number, seed = 0, at: number = 0): Pose {
	const ph = t * TAU * 2 + seed;
	return {
		...idle(t, seed),
		lean: -0.05,
		armR: [-1.5 + s(ph) * 0.1, 0, -0.05 + at],
	};
}

/** laughing and pointing: body shakes */
export function laughPoint(t: number, seed = 0): Pose {
	const ph = t * TAU * 3.5 + seed;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.06,
		lean: -0.1 + s(ph) * 0.04,
		head: [-0.2 + s(ph) * 0.06, 0, 0],
		armR: [-1.45 + s(ph) * 0.1, 0, -0.08],
		armL: [-0.6, 0, 0.6 + s(ph) * 0.1],
	};
}

/** both arms forward-up, holding an object up toward the camera */
export function holdUp(t: number, height = 1): Pose {
	const ph = t * TAU * 0.4;
	return {
		...REST,
		y: s(ph) * 0.02,
		lean: -0.03,
		armL: [-1.25 - height * 0.35, 0, -0.32],
		armR: [-1.25 - height * 0.35, 0, 0.32],
	};
}

/** holding an object in front at waist/chest level */
export function holdFront(t: number, seed = 0): Pose {
	const p = idle(t, seed);
	return {...p, armL: [-0.95, 0, -0.32], armR: [-0.95, 0, 0.32]};
}

/** walking while holding the nose (swamp) */
export function holdNoseWalk(t: number): Pose {
	const p = walk(t, 0.85, 0.8);
	return {...p, armR: [-2.55, 0, 0.62], head: [0.05, p.head[1], 0]};
}

export function shrug(t: number): Pose {
	const ph = Math.min(1, t * 3);
	const k = Math.sin(ph * Math.PI * 0.5);
	return {
		...REST,
		y: 0.05 * k,
		head: [0, 0, 0.12 * k],
		armL: [-0.45 * k, 0, 0.75 * k],
		armR: [-0.45 * k, 0, -0.75 * k],
	};
}

/** whisper: hand next to the mouth, leaning in */
export function whisperPose(t: number): Pose {
	const p = idle(t);
	return {...p, lean: 0.12, head: [0.08, 0.15, 0.06], armR: [-2.5, 0, 0.55]};
}

/** climbing a steep slope: lean, big slow steps */
export function climb(t: number): Pose {
	const ph = t * TAU * 0.6;
	const sw = s(ph) * 0.75;
	return {
		...REST,
		y: Math.abs(s(ph)) * 0.08,
		lean: 0.38,
		head: [-0.3, 0, 0],
		armL: [-sw * 0.8 - 0.4, 0, 0.12],
		armR: [sw * 0.8 - 0.4, 0, -0.12],
		legL: [sw - 0.35, 0, 0],
		legR: [-sw - 0.35, 0, 0],
	};
}

/** pulling curtains closed: both arms out to the sides moving inward */
export function pullCurtains(k: number): Pose {
	return {
		...REST,
		armL: [-1.45, 0, 1.25 - k * 1.0],
		armR: [-1.45, 0, -1.25 + k * 1.0],
		head: [-0.15, 0, 0],
	};
}

/** shouting: lean forward, arms out */
export function shoutPose(t: number): Pose {
	const ph = t * TAU * 4;
	return {
		...REST,
		lean: 0.15,
		head: [-0.2 + s(ph) * 0.03, 0, 0],
		armL: [-0.9, 0, 0.6],
		armR: [-2.3 + s(ph) * 0.2, 0, -0.35],
	};
}

/** ringing a hand bell held in the right hand */
export function ringBell(t: number): Pose {
	const ph = t * TAU * 3;
	return {armR: [-1.9 + s(ph) * 0.35, 0, -0.25]} as Pose;
}

/** reading (holding a newspaper in front with both hands) */
export function reading(t: number): Pose {
	return {armL: [-1.25, 0, -0.42], armR: [-1.25, 0, 0.42]} as Pose;
}

/** knocking on a door with the right hand: knuckles tap in little bursts of three */
export function knock(t: number, start = 0): Pose {
	const tt = Math.max(0, t - start);
	const ph = tt % 1.1; // a burst every 1.1 s
	const tap = ph < 0.6 ? Math.max(0, Math.sin(ph * Math.PI * 5)) : 0;
	return {
		...idle(t, 2),
		lean: 0.03,
		head: [-0.04, 0, 0],
		armR: [-1.75 + tap * 0.22, 0, 0.12],
	};
}

/** stirring a bowl held against the tummy with the left arm */
export function stir(t: number, seed = 0): Pose {
	const ph = t * Math.PI * 2 * 1.3 + seed;
	return {
		...idle(t, seed),
		lean: 0.08,
		head: [0.32, 0, 0.04],
		armL: [-0.95, 0, -0.42],
		armR: [-1.0 + Math.sin(ph) * 0.1, 0, 0.3 + Math.cos(ph) * 0.12],
	};
}

/** carrying something precious with both hands in front: slow, careful steps */
export function carryCake(t: number, walking = 1): Pose {
	const w = walk(t, 0.55, 0.45 * walking);
	return {
		...w,
		lean: -0.02,
		turn: w.turn * 0.3,
		head: [0.22, 0, 0],
		armL: [-1.38, 0, -0.26],
		armR: [-1.38, 0, 0.26],
	};
}

/** walking behind someone with both hands over their eyes (arms reach up and forward) */
export function coverEyes(t: number, walking = 1, reach = 2.35): Pose {
	const w = walk(t, 0.5, 0.4 * walking);
	return {
		...w,
		lean: 0.02,
		turn: 0,
		head: [-0.12, 0, 0],
		armL: [-reach, 0, -0.32],
		armR: [-reach, 0, 0.32],
	};
}

/** a very old man's slow walk with a stick in the right hand */
export function elderWalk(t: number, walking = 1): Pose {
	const w = walk(t, 0.42, 0.35 * walking);
	return {
		...w,
		lean: 0.12,
		head: [-0.08, w.head[1], 0],
		armR: [-0.42 + w.armR[0] * 0.2, 0, -0.12],
		armL: [w.armL[0] * 0.6, 0, 0.1],
	};
}

/** old man standing, a little hunched */
export function elderIdle(t: number, seed = 0): Pose {
	const p = idle(t * 0.8, seed);
	return {...p, lean: 0.1 + p.lean, head: [-0.06 + p.head[0], p.head[1], p.head[2]], armR: [-0.38, 0, -0.1]};
}

/** big breath in: shoulders rise, chest up, head tips back (k 0..1) */
export function breathIn(k: number, base: Pose = REST): Pose {
	return {
		...base,
		y: base.y + 0.06 * k,
		lean: base.lean - 0.12 * k,
		head: [base.head[0] - 0.22 * k, base.head[1], base.head[2]],
		armL: [base.armL[0] + 0.1 * k, base.armL[1], base.armL[2] + 0.22 * k],
		armR: [base.armR[0] + 0.1 * k, base.armR[1], base.armR[2] - 0.22 * k],
	};
}

/** blowing: lean in toward the candles, arms back a little (k 0..1) */
export function blowCandles(k: number, base: Pose = REST): Pose {
	return {
		...base,
		y: base.y - 0.05 * k,
		lean: base.lean + 0.3 * k,
		head: [base.head[0] + 0.18 * k, base.head[1], base.head[2]],
		armL: [base.armL[0] + 0.35 * k, base.armL[1], base.armL[2] + 0.12 * k],
		armR: [base.armR[0] + 0.35 * k, base.armR[1], base.armR[2] - 0.12 * k],
	};
}

/** holding a small thing (photo) up in front of the face with both hands */
export function holdPhoto(t: number, height = 0.5): Pose {
	const p = idle(t, 4);
	return {...p, head: [0.18, 0, 0], armL: [-1.25 - height * 0.4, 0, -0.42], armR: [-1.25 - height * 0.4, 0, 0.42]};
}

/** squeezing through a low window: bent forward, arms reaching in */
export function squeeze(t: number, k = 1): Pose {
	const ph = t * Math.PI * 2 * 0.8;
	return {
		...REST,
		y: -0.5 * k,
		lean: 1.05 * k,
		head: [-0.55 * k, Math.sin(ph) * 0.05, 0],
		armL: [-2.6 * k + Math.sin(ph) * 0.2, 0, -0.15],
		armR: [-2.6 * k - Math.sin(ph) * 0.2, 0, 0.15],
		legL: [-0.6 * k + Math.sin(ph) * 0.15, 0, 0.05],
		legR: [0.35 * k, 0, -0.05],
	};
}

/** sitting in a rocking chair, hands on the armrests, head following the rock */
export function sitRock(t: number, seatDrop = 2.0, rock = 0): Pose {
	const p = sit(t, 5, seatDrop);
	return {...p, lean: p.lean - rock * 0.3, armL: [-0.75, 0, 0.18], armR: [-0.75, 0, -0.18], legL: [-1.52, 0, 0.05], legR: [-1.52, 0, -0.05]};
}

export const armsOnly = (base: Pose, arms: Partial<Pose>): Pose => ({...base, ...arms});
export const deg = (d: number) => (d * Math.PI) / 180;
export {c as cos, s as sin};
