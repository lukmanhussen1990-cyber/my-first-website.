import {clamp, ease, lerp, rng} from '../../../src/shared/math';
import type {Vec3} from '../../../src/shared/three/shot';
import type {CoinXf} from '../../../src/shared/three/props';

// Deterministic "physics": every position is a closed-form function of time, so any frame
// can be rendered on its own, in any order, by any worker.

const G = 9.8;

// speed ramp: real time for `fastUntil`, then slow motion (`slow` x), then back to 1x.
export const timeWarp = (t: number, fastUntil = 0.3, rampTo = 0.75, slow = 0.28, backFrom = 99, backTo = 100) => {
	const speed = (x: number) => {
		if (x < fastUntil) return 1;
		if (x < rampTo) return lerp(1, slow, ease.inOutSine((x - fastUntil) / (rampTo - fastUntil)));
		if (x < backFrom) return slow;
		if (x < backTo) return lerp(slow, 1, ease.inOutSine((x - backFrom) / (backTo - backFrom)));
		return 1;
	};
	// integrate with a fixed small step (pure function of t)
	const n = Math.max(1, Math.ceil(t / 0.01));
	const h = t / n;
	let s = 0;
	for (let i = 0; i < n; i++) s += speed((i + 0.5) * h) * h;
	return s;
};

// Table flip: anticipation (tips back), then over toward +Z, lands, small bounce.
// Returns rotation about the table's front edge in radians.
export const flipAngle = (tau: number, start = 0.12) => {
	const x = tau - start;
	if (x < 0) return 0;
	if (x < 0.16) return -0.13 * Math.sin((x / 0.16) * Math.PI); // tip back
	const y = x - 0.16;
	const land = 0.78;
	if (y < land) return (ease.in(y / land) * 0.55 + (y / land) * 0.45) * (Math.PI * 0.53);
	const b = y - land;
	return Math.PI * 0.53 - Math.abs(Math.sin(b * 9)) * Math.exp(-b * 7) * 0.12;
};

// Ballistic coin with ground bounces; tau is action time, t0 the launch.
export const coinPath = (tau: number, t0: number, p0: Vec3, v0: Vec3, spin: Vec3, rest = 0.36): {p: Vec3; r: Vec3; landed: boolean} => {
	let t = tau - t0;
	if (t <= 0) return {p: p0, r: [0, 0, 0], landed: false};
	let [x, y, z] = p0;
	let [vx, vy, vz] = v0;
	let spinK = 1;
	let landed = false;
	for (let bounce = 0; bounce < 4; bounce++) {
		// time until y hits the ground (y = 0.006)
		const a = -0.5 * G;
		const b = vy;
		const c = y - 0.006;
		const disc = b * b - 4 * a * c;
		const tHit = (-b - Math.sqrt(Math.max(disc, 0))) / (2 * a);
		if (t < tHit) {
			x += vx * t;
			z += vz * t;
			y += vy * t - 0.5 * G * t * t;
			break;
		}
		x += vx * tHit;
		z += vz * tHit;
		y = 0.006;
		t -= tHit;
		vy = -(vy - G * tHit) * rest;
		vx *= 0.55;
		vz *= 0.55;
		spinK *= 0.6;
		if (vy < 0.35) {
			// rolls a little, then lies flat
			const slide = 1 - Math.exp(-t * 6);
			x += (vx / 6) * slide;
			z += (vz / 6) * slide;
			landed = true;
			break;
		}
	}
	const age = tau - t0;
	const r: Vec3 = landed ? [Math.PI / 2 * 0, spin[1] * 0.3, 0] : [spin[0] * age * spinK, spin[1] * age * spinK, spin[2] * age * spinK];
	return {p: [x, Math.max(y, 0.006), z], r: landed ? [0, r[1], 0] : r, landed};
};

// A burst of coins off a table top (table front edge at `edge`, flipping toward +Z).
export const coinBurst = (tau: number, seed: number, origin: Vec3, n: number, launch: number, spread = 1): CoinXf[] => {
	const r = rng(seed);
	const out: CoinXf[] = [];
	for (let i = 0; i < n; i++) {
		const p0: Vec3 = [origin[0] + (r() - 0.5) * 1.3, origin[1] + 0.05 + r() * 0.05, origin[2] + (r() - 0.5) * 0.5];
		const v0: Vec3 = [(r() - 0.5) * 2.4 * spread, 2.2 + r() * 2.6, 0.6 + r() * 2.2 * spread];
		const spin: Vec3 = [(r() - 0.5) * 30, (r() - 0.5) * 18, (r() - 0.5) * 30];
		const t0 = launch + r() * 0.08;
		const {p, r: rr} = coinPath(tau, t0, p0, v0, spin);
		out.push({p: tau < t0 ? p0 : p, r: tau < t0 ? [0, r() * 6, 0] : rr, bronze: i % 3 === 0});
	}
	return out;
};

// Doves bursting up out of cages and away.
export type DoveXf = {p: Vec3; yaw: number; flap: number; bank: number; s: number};
export const doveBurst = (tau: number, seed: number, origin: Vec3, n: number, launch: number, dirAz = 0.4): DoveXf[] => {
	const r = rng(seed);
	const out: DoveXf[] = [];
	for (let i = 0; i < n; i++) {
		const t0 = launch + r() * 0.25;
		const az = dirAz + (r() - 0.5) * 2.2;
		const sp = 1.4 + r() * 1.6;
		const climb = 1.6 + r() * 1.4;
		const p0: Vec3 = [origin[0] + (r() - 0.5) * 1.4, origin[1] + r() * 0.5, origin[2] + (r() - 0.5) * 1.0];
		const a = clamp((tau - t0) * 1.0, 0, 10);
		const wob = Math.sin(a * 3 + i) * 0.15 * a;
		out.push({
			p: [p0[0] + Math.sin(az) * sp * a + wob, p0[1] + climb * a + 0.4 * a * a, p0[2] + Math.cos(az) * sp * a],
			yaw: -az + Math.PI / 2,
			flap: tau < t0 ? 0 : (tau - t0) * (4.5 + r() * 1.5) + r(),
			bank: Math.sin(a * 2 + i) * 0.35,
			s: 0.9 + r() * 0.3,
		});
	}
	return out;
};
