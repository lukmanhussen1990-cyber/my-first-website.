// Tiny deterministic audio kit for the reels: 48 kHz stereo float buffers, a few
// instruments built from sines and filtered noise, a Freeverb-style reverb, WAV out.
// Everything is seeded, so the same score always renders the same file.
import fs from 'node:fs';

export const SR = 48000;

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export class Track {
	constructor(seconds) {
		this.n = Math.ceil(seconds * SR);
		this.L = new Float32Array(this.n);
		this.R = new Float32Array(this.n);
	}
	// add a mono generator g(localSample, localSeconds) -> value at time t0 with pan -1..1
	add(t0, dur, g, gain = 1, pan = 0) {
		const i0 = Math.max(0, Math.floor(t0 * SR));
		const i1 = Math.min(this.n, Math.floor((t0 + dur) * SR));
		const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
		const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
		const off = Math.floor(t0 * SR);
		for (let i = i0; i < i1; i++) {
			const k = i - off;
			const v = g(k, k / SR);
			this.L[i] += v * gl;
			this.R[i] += v * gr;
		}
	}
	mix(other, gain = 1) {
		for (let i = 0; i < this.n; i++) {
			this.L[i] += other.L[i] * gain;
			this.R[i] += other.R[i] * gain;
		}
	}
	scale(env) {
		for (let i = 0; i < this.n; i++) {
			const g = env(i / SR);
			this.L[i] *= g;
			this.R[i] *= g;
		}
	}
}

// seeded noise
export const rng = (seed) => {
	let s = seed >>> 0 || 1;
	return () => {
		s ^= s << 13;
		s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 4294967296;
	};
};

// envelopes
export const adsr = (t, dur, a, d, s, r) => {
	if (t < 0) return 0;
	if (t < a) return t / a;
	if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
	if (t < dur) return s;
	if (t < dur + r) return s * (1 - (t - dur) / r);
	return 0;
};
export const expDecay = (t, tau) => (t < 0 ? 0 : Math.exp(-t / tau));

// simple filters as stateful closures
export const onePoleLP = (fc) => {
	const a = Math.exp((-2 * Math.PI * fc) / SR);
	let y = 0;
	return (x) => (y = (1 - a) * x + a * y);
};
export const onePoleHP = (fc) => {
	const lp = onePoleLP(fc);
	return (x) => x - lp(x);
};
export const biquad = (type, f, q = 0.707, gainDb = 0) => {
	const w = (2 * Math.PI * f) / SR;
	const cs = Math.cos(w);
	const sn = Math.sin(w);
	const al = sn / (2 * q);
	const A = Math.pow(10, gainDb / 40);
	let b0, b1, b2, a0, a1, a2;
	if (type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - cs) / 2, 1 - cs, (1 - cs) / 2, 1 + al, -2 * cs, 1 - al];
	else if (type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + cs) / 2, -(1 + cs), (1 + cs) / 2, 1 + al, -2 * cs, 1 - al];
	else if (type === 'bp') [b0, b1, b2, a0, a1, a2] = [al, 0, -al, 1 + al, -2 * cs, 1 - al];
	else [b0, b1, b2, a0, a1, a2] = [1 + al * A, -2 * cs, 1 - al * A, 1 + al / A, -2 * cs, 1 - al / A];
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	return (x) => {
		const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
		return y;
	};
};

// ---------- instruments ----------
// felt piano: slightly inharmonic partials, fast-decaying highs, soft felt thump
export const piano = (midi, vel = 0.5, seed = 1) => {
	const f = mtof(midi);
	const r = rng(seed);
	const lp = onePoleLP(2600);
	const thumpLP = onePoleLP(500);
	const parts = [1, 2, 3, 4, 5, 6, 7].map((k) => ({w: 2 * Math.PI * f * k * Math.sqrt(1 + 0.00035 * k * k), a: vel / Math.pow(k, 1.35), tau: 2.6 / (0.5 + 0.55 * k), ph: r() * 6.28}));
	return (i, t) => {
		let v = 0;
		for (const p of parts) v += p.a * Math.sin(p.w * t + p.ph) * Math.exp(-t / p.tau);
		const att = Math.min(1, t / 0.006);
		const thump = thumpLP((r() * 2 - 1) * Math.exp(-t / 0.018)) * vel * 0.6;
		return lp(v * att) + thump;
	};
};

// warm pad: detuned sine stacks with a slow swell, gentle motion
export const pad = (midis, dur, amp = 0.2, attack = 1.4, release = 2.2, bright = 0.35) => {
	const voices = [];
	for (const m of midis) for (const d of [-0.07, 0, 0.06]) voices.push({w: 2 * Math.PI * mtof(m + d * 0.15)});
	const lp = onePoleLP(1400 + bright * 1600);
	return (i, t) => {
		let v = 0;
		for (let j = 0; j < voices.length; j++) {
			const w = voices[j].w;
			v += Math.sin(w * t + j) + 0.22 * Math.sin(2 * w * t + j * 0.7) + 0.08 * Math.sin(3 * w * t);
		}
		const lfo = 1 + 0.12 * Math.sin(2 * Math.PI * 0.21 * t);
		return lp((v / voices.length) * amp * adsr(t, dur, attack, 0.6, 0.9, release) * lfo);
	};
};

// bowed strings: harmonic stack with vibrato and a slow bow attack
export const strings = (midi, dur, amp = 0.15, attack = 0.6, release = 1.0, seed = 3) => {
	const f = mtof(midi);
	const r = rng(seed);
	const ph = r() * 6.28;
	const lp = onePoleLP(2200);
	let phase = 0;
	return (i, t) => {
		const vib = 1 + 0.0028 * Math.sin(2 * Math.PI * 5.1 * t + ph) * Math.min(1, t / 0.8);
		phase += (2 * Math.PI * f * vib) / SR;
		let v = 0;
		for (let k = 1; k <= 9; k++) v += Math.sin(phase * k + k) / (k * (k > 4 ? 1.6 : 1));
		return lp(v * amp * adsr(t, dur, attack, 0.3, 0.85, release));
	};
};

// soft sub hit / heartbeat
export const sub = (amp = 0.6, f0 = 95, f1 = 40, len = 0.45) => {
	let ph = 0;
	return (i, t) => {
		const f = f1 + (f0 - f1) * Math.exp(-t / 0.05);
		ph += (2 * Math.PI * f) / SR;
		return Math.sin(ph) * amp * Math.exp(-t / (len * 0.4)) * Math.min(1, t / 0.003);
	};
};

// bell / chime: inharmonic partials
export const bell = (midi, amp = 0.2, tau = 2.4) => {
	const f = mtof(midi);
	const parts = [
		[1, 1],
		[2.0, 0.5],
		[2.76, 0.32],
		[5.4, 0.18],
		[8.93, 0.08],
	];
	return (i, t) => {
		let v = 0;
		for (const [k, a] of parts) v += a * Math.sin(2 * Math.PI * f * k * t) * Math.exp(-t / (tau / Math.sqrt(k)));
		return v * amp * Math.min(1, t / 0.002);
	};
};

// filtered noise with an envelope function
export const noise = (seed, env, filt) => {
	const r = rng(seed);
	return (i, t) => filt((r() * 2 - 1) * env(t));
};

// ---------- reverb (Freeverb-style) ----------
export const reverb = (track, {room = 0.86, damp = 0.35, wet = 0.3, pre = 0.02} = {}) => {
	const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round((d * SR) / 44100));
	const alls = [556, 441, 341, 225].map((d) => Math.round((d * SR) / 44100));
	const run = (input, spread) => {
		const out = new Float32Array(input.length);
		const preN = Math.round(pre * SR);
		const cb = combs.map((d) => ({buf: new Float32Array(d + spread), i: 0, store: 0}));
		const ab = alls.map((d) => ({buf: new Float32Array(d + spread), i: 0}));
		for (let n = 0; n < input.length; n++) {
			const x = (n >= preN ? input[n - preN] : 0) * 0.015;
			let s = 0;
			for (const c of cb) {
				const y = c.buf[c.i];
				c.store = y * (1 - damp) + c.store * damp;
				c.buf[c.i] = x + c.store * room;
				c.i = (c.i + 1) % c.buf.length;
				s += y;
			}
			for (const a of ab) {
				const b = a.buf[a.i];
				a.buf[a.i] = s + b * 0.5;
				s = b - s;
				a.i = (a.i + 1) % a.buf.length;
			}
			out[n] = s;
		}
		return out;
	};
	const wl = run(track.L, 0);
	const wr = run(track.R, 23);
	for (let n = 0; n < track.n; n++) {
		track.L[n] += wl[n] * wet * 3;
		track.R[n] += wr[n] * wet * 3;
	}
};

// ---------- WAV ----------
export const writeWav = (path, track, peakTo = null) => {
	let peak = 0;
	for (let i = 0; i < track.n; i++) peak = Math.max(peak, Math.abs(track.L[i]), Math.abs(track.R[i]));
	const g = peakTo && peak > 0 ? peakTo / peak : 1;
	const buf = Buffer.alloc(44 + track.n * 8);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + track.n * 8, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(3, 20); // IEEE float
	buf.writeUInt16LE(2, 22);
	buf.writeUInt32LE(SR, 24);
	buf.writeUInt32LE(SR * 8, 28);
	buf.writeUInt16LE(8, 32);
	buf.writeUInt16LE(32, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(track.n * 8, 40);
	for (let i = 0; i < track.n; i++) {
		buf.writeFloatLE(track.L[i] * g, 44 + i * 8);
		buf.writeFloatLE(track.R[i] * g, 48 + i * 8);
	}
	fs.writeFileSync(path, buf);
	return {peak, gain: g};
};
