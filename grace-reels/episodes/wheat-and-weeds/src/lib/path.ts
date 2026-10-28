// Smooth motion through timed keyframes (Catmull-Rom in time), for things that fly along a path.
export type Key3 = [number, number, number, number]; // time, x, y, z

const cr = (p0: number, p1: number, p2: number, p3: number, s: number, t01: number, t12: number, t23: number) => {
	// non-uniform Catmull-Rom tangents scaled to the middle segment duration
	const m1 = ((p2 - p0) / (t01 + t12)) * t12;
	const m2 = ((p3 - p1) / (t12 + t23)) * t12;
	const s2 = s * s;
	const s3 = s2 * s;
	return (2 * s3 - 3 * s2 + 1) * p1 + (s3 - 2 * s2 + s) * m1 + (-2 * s3 + 3 * s2) * p2 + (s3 - s2) * m2;
};

export const pathAt = (keys: Key3[], t: number): [number, number, number] => {
	if (t <= keys[0][0]) return [keys[0][1], keys[0][2], keys[0][3]];
	const n = keys.length;
	if (t >= keys[n - 1][0]) return [keys[n - 1][1], keys[n - 1][2], keys[n - 1][3]];
	let i = 0;
	while (t > keys[i + 1][0]) i++;
	const k0 = keys[Math.max(0, i - 1)];
	const k1 = keys[i];
	const k2 = keys[i + 1];
	const k3 = keys[Math.min(n - 1, i + 2)];
	const t01 = Math.max(1e-3, k1[0] - k0[0]);
	const t12 = Math.max(1e-3, k2[0] - k1[0]);
	const t23 = Math.max(1e-3, k3[0] - k2[0]);
	const s = (t - k1[0]) / t12;
	return [1, 2, 3].map((j) => cr(k0[j], k1[j], k2[j], k3[j], s, t01, t12, t23)) as [number, number, number];
};

export const velocityAt = (keys: Key3[], t: number, dt = 1 / 120): [number, number, number] => {
	const a = pathAt(keys, t - dt);
	const b = pathAt(keys, t + dt);
	return [(b[0] - a[0]) / (2 * dt), (b[1] - a[1]) / (2 * dt), (b[2] - a[2]) / (2 * dt)];
};
