// Deterministic secondary motion: a damped spring that follows a driver signal.
// It is integrated from t0 up to t with a fixed step, so the result depends only on t (no frame history).

const cache = new Map<string, number>();

export const follow = (
	key: string,
	driver: (t: number) => number,
	t: number,
	{t0 = 0, stiffness = 60, damping = 9, dt = 1 / 120} = {},
): number => {
	const ck = `${key}|${t.toFixed(4)}`;
	const hit = cache.get(ck);
	if (hit !== undefined) return hit;
	let x = driver(t0);
	let v = 0;
	const steps = Math.max(0, Math.floor((t - t0) / dt));
	let time = t0;
	for (let i = 0; i < steps; i++) {
		time += dt;
		const a = stiffness * (driver(time) - x) - damping * v;
		v += a * dt;
		x += v * dt;
	}
	if (cache.size > 20000) cache.clear();
	cache.set(ck, x);
	return x;
};
