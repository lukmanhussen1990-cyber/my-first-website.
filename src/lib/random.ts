// Deterministic randomness. Every value depends only on the seed / index,
// so every render of every frame produces exactly the same picture.

export function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Stateless hash -> [0, 1). Same inputs always give the same output. */
export function hash(i: number, seed = 0): number {
	let h = (Math.floor(i) * 374761393 + Math.floor(seed) * 668265263) >>> 0;
	h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
	h = (h ^ (h >>> 16)) >>> 0;
	return h / 4294967296;
}

export function hashRange(i: number, seed: number, lo: number, hi: number) {
	return lo + (hi - lo) * hash(i, seed);
}

export function pick<T>(arr: readonly T[], i: number, seed = 0): T {
	return arr[Math.floor(hash(i, seed) * arr.length) % arr.length];
}

/** Smooth 1D value noise in [-1, 1]; t in "cycles". */
export function noise1(t: number, seed = 0): number {
	const i = Math.floor(t);
	const f = t - i;
	const a = hash(i, seed) * 2 - 1;
	const b = hash(i + 1, seed) * 2 - 1;
	const u = f * f * (3 - 2 * f);
	return a + (b - a) * u;
}

/** Fractal noise: a couple of octaves, still in about [-1, 1]. */
export function fbm1(t: number, seed = 0): number {
	return noise1(t, seed) * 0.65 + noise1(t * 2.17, seed + 11) * 0.35;
}
