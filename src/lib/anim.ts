import {random} from 'remotion';

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (t: number) => {
	const x = clamp(t);
	return x * x * (3 - 2 * x);
};
export const easeInOut = (t: number) => {
	const x = clamp(t);
	return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeIn = (t: number) => Math.pow(clamp(t), 3);
export const easeOutBack = (t: number, s = 1.70158) => {
	const x = clamp(t) - 1;
	return 1 + (s + 1) * x * x * x + s * x * x;
};
/** Map x in [a,b] → eased 0..1 */
export const seg = (x: number, a: number, b: number, ease = smooth) => ease(invLerp(a, b, x));

export type V3 = [number, number, number];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** Seeded random in [0,1). Deterministic across renders. */
export const rnd = (seed: string | number) => random(String(seed));
export const rndRange = (seed: string | number, a: number, b: number) => a + (b - a) * rnd(seed);

/** Smooth deterministic noise made of sines (for handheld camera etc.). */
export const wobble = (t: number, seed: number) => {
	const p1 = rnd(`w1${seed}`) * 6.28;
	const p2 = rnd(`w2${seed}`) * 6.28;
	const p3 = rnd(`w3${seed}`) * 6.28;
	return 0.55 * Math.sin(t * 0.83 + p1) + 0.3 * Math.sin(t * 1.71 + p2) + 0.15 * Math.sin(t * 3.13 + p3);
};

/** Keyframe interpolation: keys = [[time, value], ...] sorted by time. */
export const keys = (t: number, k: [number, number][], ease = smooth) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 0; i < k.length - 1; i++) {
		const [t0, v0] = k[i];
		const [t1, v1] = k[i + 1];
		if (t <= t1) return lerp(v0, v1, ease((t - t0) / Math.max(1e-6, t1 - t0)));
	}
	return k[k.length - 1][1];
};
export const keys3 = (t: number, k: [number, V3][], ease = smooth): V3 => [
	keys(t, k.map(([tt, v]) => [tt, v[0]] as [number, number]), ease),
	keys(t, k.map(([tt, v]) => [tt, v[1]] as [number, number]), ease),
	keys(t, k.map(([tt, v]) => [tt, v[2]] as [number, number]), ease),
];

/** Small bounce 0→1 pop. */
export const pop = (t: number, dur = 0.25) => (t <= 0 ? 0 : t >= dur ? 1 : easeOutBack(t / dur, 2.2));
