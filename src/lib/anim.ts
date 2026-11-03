// Frame-driven animation helpers. Everything is a pure function of the frame number.

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const remap = (v: number, a: number, b: number, c: number, d: number) => lerp(c, d, invLerp(a, b, v));

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
export const easeOutBack = (t: number, s = 1.70158) => {
	const c3 = s + 1;
	return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t: number) => {
	if (t <= 0) return 0;
	if (t >= 1) return 1;
	return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

/** progress 0..1 of a window [start, start+dur] */
export const prog = (frame: number, start: number, dur: number) => clamp((frame - start) / Math.max(dur, 1e-6));

/** a bump that goes 0 -> 1 -> 0 over [start, start+dur] */
export const bump = (frame: number, start: number, dur: number) => {
	const p = prog(frame, start, dur);
	return Math.sin(p * Math.PI);
};

export type V3 = [number, number, number];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

/** piecewise keyframes: [[frame, value], ...] with optional easing between keys */
export function keys(frame: number, kf: [number, number][], ease: (t: number) => number = easeInOut): number {
	if (frame <= kf[0][0]) return kf[0][1];
	for (let i = 0; i < kf.length - 1; i++) {
		const [f0, v0] = kf[i];
		const [f1, v1] = kf[i + 1];
		if (frame <= f1) return lerp(v0, v1, ease(clamp((frame - f0) / Math.max(f1 - f0, 1e-6))));
	}
	return kf[kf.length - 1][1];
}

export function keys3(frame: number, kf: [number, V3][], ease: (t: number) => number = easeInOut): V3 {
	if (frame <= kf[0][0]) return kf[0][1];
	for (let i = 0; i < kf.length - 1; i++) {
		const [f0, v0] = kf[i];
		const [f1, v1] = kf[i + 1];
		if (frame <= f1) return lerp3(v0, v1, ease(clamp((frame - f0) / Math.max(f1 - f0, 1e-6))));
	}
	return kf[kf.length - 1][1];
}
