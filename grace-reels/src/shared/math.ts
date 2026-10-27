// Small deterministic math kit. Everything in a reel must be a pure function of the frame,
// so randomness is always seeded and noise is hashed, never Math.random().

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const remap = (v: number, a: number, b: number, c: number, d: number) => lerp(c, d, invLerp(a, b, v));
export const smooth = (t: number) => {
	const x = clamp(t);
	return x * x * (3 - 2 * x);
};
export const smoothstep = (a: number, b: number, v: number) => smooth((v - a) / (b - a));
export const deg = (d: number) => (d * Math.PI) / 180;

export const ease = {
	inOut: (t: number) => {
		const x = clamp(t);
		return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
	},
	out: (t: number) => 1 - Math.pow(1 - clamp(t), 3),
	in: (t: number) => Math.pow(clamp(t), 3),
	outBack: (t: number, s = 1.70158) => {
		const x = clamp(t) - 1;
		return 1 + (s + 1) * x * x * x + s * x * x;
	},
	outQuint: (t: number) => 1 - Math.pow(1 - clamp(t), 5),
	inOutSine: (t: number) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2,
};

// mulberry32: tiny seeded PRNG
export const rng = (seed: number) => {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

export const hash1 = (n: number) => {
	const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
	return s - Math.floor(s);
};

// 1D value noise in [-1, 1], smooth in x
export const noise1 = (x: number, seed = 0) => {
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return lerp(hash1(i + seed * 57.3), hash1(i + 1 + seed * 57.3), u) * 2 - 1;
};

// sum of octaves, roughly [-1, 1]
export const fbm1 = (x: number, seed = 0, oct = 3) => {
	let v = 0;
	let amp = 0.5;
	let fr = 1;
	let norm = 0;
	for (let o = 0; o < oct; o++) {
		v += noise1(x * fr, seed + o * 13) * amp;
		norm += amp;
		amp *= 0.5;
		fr *= 2.03;
	}
	return v / norm;
};

// 2D value noise in [-1, 1]
const hash2 = (x: number, y: number, seed: number) => hash1(x * 157.31 + y * 113.97 + seed * 71.13);
export const noise2 = (x: number, y: number, seed = 0) => {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const u = xf * xf * (3 - 2 * xf);
	const v = yf * yf * (3 - 2 * yf);
	const a = hash2(xi, yi, seed);
	const b = hash2(xi + 1, yi, seed);
	const c = hash2(xi, yi + 1, seed);
	const d = hash2(xi + 1, yi + 1, seed);
	return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
};
export const fbm2 = (x: number, y: number, seed = 0, oct = 4) => {
	let v = 0;
	let amp = 0.5;
	let fr = 1;
	let norm = 0;
	for (let o = 0; o < oct; o++) {
		v += noise2(x * fr, y * fr, seed + o * 7) * amp;
		norm += amp;
		amp *= 0.5;
		fr *= 2.01;
	}
	return v / norm;
};

// Monotone cubic (Fritsch-Carlson) through (xs, ys): smooth and never overshoots.
export const monotone = (xs: number[], ys: number[]) => {
	const n = xs.length;
	const d: number[] = [];
	const m: number[] = new Array(n).fill(0);
	for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
	m[0] = d[0];
	m[n - 1] = d[n - 2];
	for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
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
	return (x: number) => {
		if (x <= xs[0]) return ys[0];
		if (x >= xs[n - 1]) return ys[n - 1];
		let i = 0;
		while (i < n - 2 && x > xs[i + 1]) i++;
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

// Piecewise keyframes on [0..1]-style time with per-segment easing
export const keys = (pairs: [number, number][], e: (t: number) => number = ease.inOut) => (x: number) => {
	if (x <= pairs[0][0]) return pairs[0][1];
	for (let i = 0; i < pairs.length - 1; i++) {
		const [x0, y0] = pairs[i];
		const [x1, y1] = pairs[i + 1];
		if (x <= x1) return lerp(y0, y1, e((x - x0) / (x1 - x0)));
	}
	return pairs[pairs.length - 1][1];
};
