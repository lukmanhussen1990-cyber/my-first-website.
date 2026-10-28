import {Easing, interpolate} from 'remotion';

// Premium easing set. Nothing in a Grace reel moves linearly.
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.75, 0.06);
export const EASE_SOFT = Easing.bezier(0.45, 0, 0.55, 1);

/** Clamped interpolate from frame range [a, b] to [from, to] with easing. */
export const tween = (
	frame: number,
	[a, b]: [number, number],
	[from, to]: [number, number],
	ease: (t: number) => number = EASE_OUT,
): number =>
	interpolate(frame, [a, b], [from, to], {
		easing: ease,
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
	});

/** 0→1 progress over [a, b]. */
export const prog = (
	frame: number,
	a: number,
	b: number,
	ease: (t: number) => number = EASE_OUT,
): number => tween(frame, [a, b], [0, 1], ease);

/** Smooth bump: 0 at the edges, 1 at `center`, half-width `w` (frames). */
export const bump = (frame: number, center: number, w: number): number => {
	const x = (frame - center) / w;
	return Math.abs(x) >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * x);
};

/** Monotone cubic (Fritsch–Carlson) through [x, y] keys — no overshoot, smooth speed. */
export const monotoneCurve = (keys: [number, number][]) => {
	const n = keys.length;
	const xs = keys.map((k) => k[0]);
	const ys = keys.map((k) => k[1]);
	const d: number[] = [];
	for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
	const m: number[] = [d[0]];
	for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
	m.push(d[n - 2]);
	for (let i = 0; i < n - 1; i++) {
		if (d[i] === 0) {
			m[i] = 0;
			m[i + 1] = 0;
			continue;
		}
		const a = m[i] / d[i];
		const b = m[i + 1] / d[i];
		const s = a * a + b * b;
		if (s > 9) {
			const t = 3 / Math.sqrt(s);
			m[i] = t * a * d[i];
			m[i + 1] = t * b * d[i];
		}
	}
	return (x: number): number => {
		if (x <= xs[0]) return ys[0];
		if (x >= xs[n - 1]) return ys[n - 1];
		let i = 0;
		while (x > xs[i + 1]) i++;
		const h = xs[i + 1] - xs[i];
		const t = (x - xs[i]) / h;
		const t2 = t * t;
		const t3 = t2 * t;
		return (
			(2 * t3 - 3 * t2 + 1) * ys[i] +
			(t3 - 2 * t2 + t) * h * m[i] +
			(-2 * t3 + 3 * t2) * ys[i + 1] +
			(t3 - t2) * h * m[i + 1]
		);
	};
};
