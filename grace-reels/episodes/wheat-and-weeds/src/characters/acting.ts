// Acting for the cut-out rigs, as pure functions of time. Angles are degrees, counter-clockwise on
// screen for a figure facing right: a positive arm angle swings the hand forward, a positive thigh
// angle swings the foot forward, a negative torso angle leans forward, a positive head angle looks up.
import {clamp, easeInOut, easeOut, lerp, smooth} from '../lib/ease';
import {noise1} from '../lib/random';
import type {Pose} from './Puppet';

// Gait over one cycle (two steps): the near foot's forward position (-1..1) and lift (0..1); the far
// foot is the same half a cycle later. In stance the planted foot moves back at constant speed.
export const gait = (p: number) => {
	const q = ((p % 1) + 1) % 1;
	if (q < 0.5) return {x: 1 - 4 * q, lift: 0};
	const s = (q - 0.5) / 0.5;
	return {x: -1 + 2 * easeInOut(s), lift: Math.sin(Math.PI * s)};
};
const bob = (p: number) => (1 - Math.cos(4 * Math.PI * p)) / 2;

// Merge poses: angles and offsets add, later variants/props/warps win.
export const blend = (...poses: (Pose | null | undefined)[]): Pose => {
	const out: Pose = {angles: {}, offsets: {}, variants: {}, warps: {}, props: [], lift: [0, 0], hide: []};
	for (const p of poses) {
		if (!p) continue;
		for (const [k, v] of Object.entries(p.angles ?? {})) out.angles![k] = (out.angles![k] ?? 0) + v;
		for (const [k, v] of Object.entries(p.offsets ?? {})) {
			const o = out.offsets![k] ?? [0, 0];
			out.offsets![k] = [o[0] + v[0], o[1] + v[1]];
		}
		Object.assign(out.variants!, p.variants ?? {});
		Object.assign(out.warps!, p.warps ?? {});
		out.props!.push(...(p.props ?? []));
		out.hide!.push(...(p.hide ?? []));
		if (p.lift) out.lift = [out.lift![0] + p.lift[0], out.lift![1] + p.lift[1]];
		if (p.shut !== undefined) out.shut = Math.max(out.shut ?? 0, p.shut);
	}
	return out;
};
// Scale a pose's angles (to fade an action in or out).
export const amount = (p: Pose, k: number): Pose => ({
	...p,
	angles: Object.fromEntries(Object.entries(p.angles ?? {}).map(([n, a]) => [n, a * k])),
	offsets: Object.fromEntries(Object.entries(p.offsets ?? {}).map(([n, o]) => [n, [o[0] * k, o[1] * k] as [number, number]])),
	lift: p.lift ? [p.lift[0] * k, p.lift[1] * k] : undefined,
});

// Breathing and a little life for anyone standing.
export const idle = (t: number, seed: number, o: {sway?: number} = {}): Pose => {
	const s = o.sway ?? 1;
	return {
		angles: {
			torso: 0.8 * s * noise1(t * 0.35, seed),
			head: 1.6 * s * noise1(t * 0.42, seed + 3),
			arm_upper_near: 2 * s * noise1(t * 0.5, seed + 5),
			arm_upper_far: 2 * s * noise1(t * 0.47, seed + 7),
			forearm_near: 4 + 2 * noise1(t * 0.6, seed + 9),
			forearm_far: 4 + 2 * noise1(t * 0.55, seed + 11),
		},
		warps: {torso: {breath: 0.006 * Math.sin(t * 1.8 + seed)}},
	};
};

// Walking (side view). `stride` degrees at the hip; the hem of a robe swings with the legs.
export const walk = (p: number, o: {amount?: number; stride?: number; knee?: number; arms?: number; lean?: number; bounce?: number; t?: number} = {}): Pose => {
	const a = o.amount ?? 1;
	const n = gait(p);
	const f = gait(p + 0.5);
	const stride = (o.stride ?? 22) * a;
	const knee = (o.knee ?? 34) * a;
	const arms = (o.arms ?? 16) * a;
	const tn = n.x * stride;
	const tf = f.x * stride;
	const sn = -n.lift * knee - Math.max(0, -n.x) * 6 * a;
	const sf = -f.lift * knee - Math.max(0, -f.x) * 6 * a;
	return {
		angles: {
			torso: -(o.lean ?? 2) * a,
			head: 1.2 * a * Math.cos(4 * Math.PI * p),
			thigh_near: tn,
			thigh_far: tf,
			shin_near: sn,
			shin_far: sf,
			foot_near: -(tn + sn) * 0.85 + n.lift * 12 * a,
			foot_far: -(tf + sf) * 0.85 + f.lift * 12 * a,
			arm_upper_near: -n.x * arms,
			arm_upper_far: n.x * arms * 0.85,
			forearm_near: 10 + Math.max(0, -n.x) * 10 * a,
			forearm_far: 8 + Math.max(0, n.x) * 10 * a,
		},
		lift: [0, -(o.bounce ?? 14) * a * bob(p)],
		warps: {skirt: {hem: [-16 * a * n.x, 0.35, 1]}},
	};
};

// Sowing: each cycle the near hand dips into the bag, then flings the seed out in a wide arc.
// release(p) is the moment of the fling (phase 0.62 of the cycle).
export const SOW_RELEASE = 0.62;
export const sow = (p: number, o: {amount?: number} = {}): Pose => {
	const a = o.amount ?? 1;
	const q = ((p % 1) + 1) % 1;
	// 0..0.35 reach back into the bag, 0.35..0.62 wind up, 0.62..0.8 fling forward and up, then settle
	const back = smooth(q / 0.35);
	const wind = smooth((q - 0.35) / 0.27);
	const fling = easeOut((q - 0.6) / 0.18);
	const settle = smooth((q - 0.8) / 0.2);
	const arm = lerp(lerp(lerp(-8, -38, back), -55, wind), 105, fling) * (1 - settle) + -8 * settle;
	const fore = lerp(lerp(lerp(15, 45, back), 60, wind), 10, fling) * (1 - settle) + 15 * settle;
	const open = q > SOW_RELEASE - 0.02 && q < 0.86;
	return {
		angles: {arm_upper_near: arm * a, forearm_near: fore * a, hand_near: (open ? -10 : 15) * a, torso: lerp(0, 4, fling) * (1 - settle) * a, head: lerp(0, 6, fling) * (1 - settle) * a},
		variants: {hand_near: open ? 'throw' : 'fist'},
	};
};

// Storytelling hands: both arms rise and open in turns, the head tilts, the mouth moves.
export const talk = (t: number, o: {amount?: number; seed?: number; mouth?: boolean} = {}): Pose => {
	const a = o.amount ?? 1;
	const s = o.seed ?? 1;
	const g1 = 0.5 + 0.5 * Math.sin(t * 2.1 + s);
	const g2 = 0.5 + 0.5 * Math.sin(t * 1.7 + s + 2.0);
	const beat = 0.5 + 0.5 * Math.sin(t * 5.2 + s);
	const mouthOpen = o.mouth !== false && noise1(t * 7.0, s + 3) > -0.05;
	return {
		angles: {
			arm_upper_near: (25 + 35 * g1) * a,
			forearm_near: (45 + 30 * g1 + 8 * beat) * a,
			hand_near: (-20 + 15 * beat) * a,
			arm_upper_far: (18 + 30 * g2) * a,
			forearm_far: (40 + 25 * g2) * a,
			head: (3 * Math.sin(t * 1.3 + s) + 2 * beat) * a,
			torso: 1.5 * Math.sin(t * 0.9 + s) * a,
		},
		variants: {hand_near: 'open', hand_far: 'open', mouth: o.mouth === false ? 'smile' : mouthOpen ? 'talk' : 'smile'},
		offsets: {brow_near: [0, -4 * beat * a], brow_far: [0, -3 * beat * a]},
	};
};

// The gentle "no": the near hand comes up, palm out, with a slow shake of the head.
export const noHand = (t: number, t0: number, o: {amount?: number} = {}): Pose => {
	const k = easeOut(clamp((t - t0) / 0.35)) * (o.amount ?? 1);
	const shake = Math.sin((t - t0) * 9) * Math.exp(-Math.max(0, t - t0) * 1.6) * 6;
	return {
		angles: {arm_upper_near: 62 * k, forearm_near: 88 * k, hand_near: -12 * k, head: -2 * k + shake * k, torso: 2 * k},
		variants: {hand_near: k > 0.3 ? 'open' : 'relaxed', mouth: 'rest'},
		offsets: {brow_near: [0, -3 * k], brow_far: [0, -3 * k]},
	};
};

// Pointing at something ahead (and a little down).
export const pointAt = (k: number, o: {down?: number} = {}): Pose => ({
	angles: {arm_upper_near: (78 - (o.down ?? 0)) * k, forearm_near: 6 * k, hand_near: 0},
	variants: {hand_near: k > 0.35 ? 'point' : 'relaxed'},
});

// Confused: head tilted, brows up, shoulders lifted.
export const puzzled = (t: number, k: number): Pose => ({
	angles: {head: (7 + 1.5 * Math.sin(t * 2)) * k, torso: 1.5 * k},
	offsets: {brow_near: [0, -9 * k], brow_far: [0, -6 * k]},
	variants: {mouth: k > 0.4 ? 'open' : 'rest'},
});

// The servant's pull: lean back (anticipation), lunge down, grip, then heave back.
export const grabPull = (t: number, b: {lean: number; grab: number; pull: number}): Pose => {
	const ant = smooth((t - b.lean) / 0.35) * (1 - smooth((t - (b.lean + 0.35)) / 0.25));
	const down = easeOut((t - (b.lean + 0.35)) / 0.35);
	const grip = t > b.grab;
	const heave = easeInOut((t - b.pull) / 0.7);
	const strain = t > b.pull ? 2.5 * Math.sin((t - b.pull) * 30) * (1 - heave) : 0;
	return {
		angles: {
			torso: 6 * ant - 38 * down * (1 - heave) + 12 * heave,
			head: -6 * down * (1 - heave) + 4 * heave,
			arm_upper_near: -10 * ant + 70 * down * (1 - 0.6 * heave) + strain,
			forearm_near: 10 + 25 * down * (1 - heave) + 40 * heave,
			arm_upper_far: -8 * ant + 60 * down * (1 - 0.6 * heave),
			forearm_far: 8 + 20 * down,
			thigh_near: 14 * down * (1 - heave) - 6 * heave,
			shin_near: -24 * down * (1 - heave),
			thigh_far: -10 * down,
			shin_far: -10 * down,
		},
		variants: {hand_near: grip ? 'fist' : 'open', hand_far: grip ? 'fist' : 'open', mouth: t > b.pull ? 'open' : 'rest'},
		lift: [0, -60 * down * (1 - heave)],
	};
};

// Marching (Saul, the soldiers): bigger, prouder steps, chest out.
export const march = (p: number, o: {amount?: number; proud?: number} = {}): Pose => {
	const a = o.amount ?? 1;
	const w = walk(p, {amount: a, stride: 25, knee: 38, arms: 22, lean: -2.5 * (o.proud ?? 1), bounce: 16});
	return blend(w, {angles: {head: 3 * (o.proud ?? 1) * a}});
};

// Saul struck by the light: arms thrown up to shield the eyes, then he falls (the shot tilts the body).
export const shield = (k: number, t: number): Pose => ({
	angles: {arm_upper_near: 140 * k, forearm_near: 70 * k, arm_upper_far: 120 * k, forearm_far: 60 * k, head: -12 * k, torso: 10 * k + 1.5 * Math.sin(t * 25) * k},
	variants: {hand_near: 'open', hand_far: 'open', mouth: k > 0.4 ? 'open' : 'rest'},
	offsets: {brow_near: [0, -10 * k], brow_far: [0, -8 * k]},
	shut: 0.85 * k,
});

// Writing at a low desk: head down, the near hand making small strokes.
export const write = (t: number, o: {amount?: number} = {}): Pose => {
	const a = o.amount ?? 1;
	const stroke = Math.sin(t * 7.5) * 4 + Math.sin(t * 2.3) * 3;
	return {
		angles: {head: -14 * a + 1.5 * Math.sin(t * 0.8), torso: -6 * a, arm_upper_near: 32 * a + stroke * 0.4, forearm_near: 62 * a + stroke, hand_near: -8 * a, arm_upper_far: 26 * a, forearm_far: 58 * a},
		variants: {hand_near: 'hold', hand_far: 'relaxed', mouth: 'smile'},
		offsets: {brow_near: [0, 2], brow_far: [0, 2]},
	};
};

// Reaping: a rhythmic swing of the sickle low through the wheat, the other hand gathering.
export const reap = (p: number, o: {amount?: number} = {}): Pose => {
	const a = o.amount ?? 1;
	const q = ((p % 1) + 1) % 1;
	const swing = q < 0.4 ? easeInOut(q / 0.4) : 1 - easeInOut((q - 0.4) / 0.6);
	return {
		angles: {torso: -24 * a + 4 * swing, head: -8 * a, arm_upper_near: (-30 + 95 * swing) * a, forearm_near: (40 - 30 * swing) * a, arm_upper_far: (50 - 20 * swing) * a, forearm_far: 30 * a, thigh_near: 10 * a, shin_near: -14 * a, thigh_far: -6 * a},
		variants: {hand_near: 'hold', hand_far: 'fist'},
		lift: [0, -30 * a],
	};
};

// Carrying a sheaf in both arms in front of the chest.
export const carry = (k: number): Pose => ({
	angles: {arm_upper_near: 40 * k, forearm_near: 70 * k, arm_upper_far: 34 * k, forearm_far: 64 * k, torso: 3 * k},
	variants: {hand_near: 'hold', hand_far: 'hold', mouth: 'smile'},
});

// A joyful little beat in the shoulders and head (reapers, crowd).
export const happy = (t: number, seed: number): Pose => ({
	angles: {head: 3 * Math.sin(t * 3 + seed), torso: 1.2 * Math.sin(t * 3 + seed + 1)},
	variants: {mouth: 'smile'},
});
