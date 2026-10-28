// Seeded randomness and noise. Never use Math.random(): every frame must be reproducible.

export const mulberry32 = (seed: number) => {
	let s = seed | 0;
	return () => {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

// Stateless hash in [0, 1) for (seed, i, j).
export const hash = (seed: number, i = 0, j = 0): number => {
	let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(i + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul(j + 0x165667b1, 0x27d4eb2d);
	h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
	h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
};

export const range = (seed: number, i: number, lo: number, hi: number) => lo + hash(seed, i) * (hi - lo);

// 2D gradient noise in about [-1, 1].
const grad = (seed: number, ix: number, iy: number, x: number, y: number) => {
	const a = hash(seed, ix, iy) * Math.PI * 2;
	return Math.cos(a) * x + Math.sin(a) * y;
};
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export const noise2 = (x: number, y: number, seed = 1) => {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const fx = x - ix;
	const fy = y - iy;
	const u = fade(fx);
	const v = fade(fy);
	const n00 = grad(seed, ix, iy, fx, fy);
	const n10 = grad(seed, ix + 1, iy, fx - 1, fy);
	const n01 = grad(seed, ix, iy + 1, fx, fy - 1);
	const n11 = grad(seed, ix + 1, iy + 1, fx - 1, fy - 1);
	return 1.41 * ((n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v);
};

export const fbm2 = (x: number, y: number, seed = 1, octaves = 4) => {
	let sum = 0;
	let amp = 0.5;
	let f = 1;
	for (let o = 0; o < octaves; o++) {
		sum += amp * noise2(x * f, y * f, seed + o * 17);
		f *= 2.03;
		amp *= 0.5;
	}
	return sum;
};

// Smooth 1D noise over time (for handheld drift, flicker).
export const noise1 = (t: number, seed = 1) => noise2(t, 0.5, seed);
