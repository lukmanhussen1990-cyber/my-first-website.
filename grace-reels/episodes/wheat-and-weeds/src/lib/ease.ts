// Easing and interpolation helpers (pure functions of time).

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, x: number) => clamp((x - a) / (b - a));
export const smooth = (t: number) => {
	const x = clamp(t);
	return x * x * (3 - 2 * x);
};
export const smoother = (t: number) => {
	const x = clamp(t);
	return x * x * x * (x * (x * 6 - 15) + 10);
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
export const easeOutElastic = (t: number) => {
	const x = clamp(t);
	if (x === 0 || x === 1) return x;
	return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
};

// Map t from [t0, t1] to [0, 1] with an easing curve.
export const seg = (t: number, t0: number, t1: number, ease: (x: number) => number = smooth) => ease(invLerp(t0, t1, t));

// Piecewise keyframes: keys = [[time, value], ...] with smooth easing between them.
export const keys = (t: number, k: [number, number][], ease: (x: number) => number = easeInOut) => {
	if (t <= k[0][0]) return k[0][1];
	for (let i = 1; i < k.length; i++) {
		if (t <= k[i][0]) return lerp(k[i - 1][1], k[i][1], ease(invLerp(k[i - 1][0], k[i][0], t)));
	}
	return k[k.length - 1][1];
};

// Pulse that rises fast and decays (for flashes and impacts).
export const pulse = (t: number, at: number, attack = 0.05, decay = 0.4) => {
	if (t < at - attack) return 0;
	if (t < at) return smooth((t - (at - attack)) / attack);
	return Math.exp(-(t - at) / decay);
};

// Damped spring response to a step at time `at` (0 → 1 with overshoot), analytic.
export const springStep = (t: number, at: number, freq = 2.2, damping = 0.45) => {
	if (t <= at) return 0;
	const x = t - at;
	const w = 2 * Math.PI * freq;
	return 1 - Math.exp(-damping * w * x) * Math.cos(w * Math.sqrt(1 - damping * damping) * x);
};
