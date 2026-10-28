// 100% code sound design for the 1K thank-you reel.
// Renders public/audio/thank-you-1k.wav — 48 kHz stereo, −14 LUFS integrated, true peak ≤ −1 dBTP.
// Everything sits in D major so chimes, chord and pad agree. Seeded noise → identical output every run.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SR = 48000;
const DUR = 5.0;
const N = Math.round(SR * DUR);
const OUT = path.resolve('public/audio/thank-you-1k.wav');
const FPS = 30;
const at = (frame) => frame / FPS;

// ---------- buffers & helpers
const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N); // reverb send
const sendR = new Float32Array(N);

let seed = 1618;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const TAU = Math.PI * 2;

const add = (i, l, r, rev = 0) => {
	if (i < 0 || i >= N) return;
	L[i] += l;
	R[i] += r;
	sendL[i] += l * rev;
	sendR[i] += r * rev;
};
const pan = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

// One-pole lowpass/highpass state machines
const lp = (fc) => {
	const a = Math.exp((-TAU * fc) / SR);
	let y = 0;
	return (x, f2) => {
		const aa = f2 ? Math.exp((-TAU * f2) / SR) : a;
		y = (1 - aa) * x + aa * y;
		return y;
	};
};
// RBJ band-pass (constant skirt), retunable per sample
const bandpass = () => {
	let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
	return (x, f0, q) => {
		const w = (TAU * f0) / SR;
		const alpha = Math.sin(w) / (2 * q);
		const a0 = 1 + alpha;
		const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w)) / a0, a2 = (1 - alpha) / a0;
		const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
		x2 = x1; x1 = x; y2 = y1; y1 = y;
		return y;
	};
};

// ---------- instruments
/** Bell / chime: inharmonic partials, fast attack, exponential decay. */
const chime = (t0, f0, {gain = 0.3, decay = 1.2, p = 0, rev = 0.45, partials = [[1, 1, 1], [2.756, 0.45, 0.55], [5.404, 0.22, 0.35], [8.933, 0.08, 0.22]]} = {}) => {
	const [gl, gr] = pan(p);
	const s0 = Math.round(t0 * SR);
	const len = Math.min(N - s0, Math.round(decay * 5 * SR));
	for (let n = 0; n < len; n++) {
		const t = n / SR;
		const att = Math.min(1, t / 0.002);
		let v = 0;
		for (const [ratio, amp, dk] of partials) v += amp * Math.sin(TAU * f0 * ratio * t) * Math.exp(-t / (decay * dk));
		v *= gain * att;
		add(s0 + n, v * gl, v * gr, rev);
	}
};

/** Felt piano note: soft hammer, warm harmonics that decay faster up the series, felt lowpass. */
const feltNote = (t0, midi, {gain = 0.16, p = 0, decay = 2.6} = {}) => {
	const f0 = hz(midi);
	const [gl, gr] = pan(p);
	const s0 = Math.round(t0 * SR);
	const len = N - s0;
	const felt = lp(1800);
	const thump = lp(300);
	for (let n = 0; n < len; n++) {
		const t = n / SR;
		const att = 1 - Math.exp(-t / 0.006);
		let v = 0;
		for (let k = 1; k <= 8; k++) {
			const inh = Math.sqrt(1 + 0.0004 * k * k);
			v += (Math.sin(TAU * f0 * k * inh * t + k) / k ** 1.3) * Math.exp((-t * (0.6 + k * 0.55)) / decay * 2);
		}
		v = felt(v * att);
		if (t < 0.03) v += thump(noise()) * 0.25 * Math.exp(-t / 0.008);
		v *= gain;
		add(s0 + n, v * gl, v * gr, 0.35);
	}
};

/** Warm pad voice: detuned additive saw, slow attack, lowpassed. */
const padVoice = (t0, t1, midi, {gain = 0.05, p = 0, attack = 0.5, release = 0.6, bright = 900} = {}) => {
	const f0 = hz(midi);
	const [gl, gr] = pan(p);
	const s0 = Math.round(t0 * SR);
	const s1 = Math.min(N, Math.round((t1 + release) * SR));
	const filt = lp(bright);
	for (let n = s0; n < s1; n++) {
		const t = (n - s0) / SR;
		const tt = n / SR;
		const env = Math.min(1, t / attack) * (tt > t1 ? Math.exp(-(tt - t1) / (release / 3)) : 1);
		let v = 0;
		for (const det of [-0.12, 0.0, 0.11]) {
			const f = f0 * 2 ** (det / 12);
			for (let k = 1; k <= 6; k++) v += Math.sin(TAU * f * k * tt + k * 1.7 + det * 9) / k;
		}
		v = filt(v / 3) * env * gain;
		add(n, v * gl, v * gr, 0.25);
	}
};

// ---------- the cue sheet (frame-accurate to the picture)

// 0.00 s — sparkle: tiny bright chime + two micro pings on the pulses
chime(0.0, hz(86), {gain: 0.2, decay: 0.9, p: 0.1}); // D6
chime(0.0, hz(93), {gain: 0.08, decay: 0.6, p: -0.2}); // A6
chime(at(8), hz(98), {gain: 0.05, decay: 0.25, p: 0.3}); // D7 ping
chime(at(14), hz(97), {gain: 0.045, decay: 0.25, p: -0.3}); // C#7 ping

// 0.60 s — cloud reveal: airy whoosh (swept band-passed noise) + swell
{
	const t0 = at(17), t1 = at(46);
	const bpL = bandpass(), bpR = bandpass();
	const air = lp(6000);
	for (let n = Math.round(t0 * SR); n < Math.round(t1 * SR); n++) {
		const x = (n / SR - t0) / (t1 - t0);
		const env = Math.sin(Math.PI * Math.min(1, x * 1.6) ** 0.8) ** 2 * (x < 0.6 ? 1 : Math.exp(-(x - 0.6) * 6));
		const f = 350 + 3200 * x ** 0.7;
		const nz = air(noise());
		add(n, bpL(nz, f, 0.9) * env * 0.5, bpR(nz, f * 1.07, 0.9) * env * 0.5, 0.5);
	}
}
// warm music bed: D major swell → Gmaj7(9) under THANK YOU → home to D for the logo
const bed = [
	[at(18), at(80), [50, 57, 62, 66], 1100],
	[at(80), at(132), [43, 55, 59, 62, 66], 1300],
	[at(132), 5.0, [50, 57, 62, 69], 1500],
];
for (const [a, b, notes, bright] of bed) {
	notes.forEach((m, i) => padVoice(a, b, m, {gain: 0.034, p: (i / (notes.length - 1)) * 1.2 - 0.6, attack: a < 1 ? 0.7 : 0.25, release: 0.5, bright}));
}

// 1.40–2.50 s — counter ticks, timed off the same odometer curve as the picture
{
	const keys = [[46, 0], [49.5, 250], [53, 640], [56.5, 912], [60, 999], [67, 1000]];
	const curve = (fr) => {
		// piecewise-cubic ease between keys is close enough for tick timing
		for (let i = 0; i < keys.length - 1; i++) {
			const [x0, y0] = keys[i], [x1, y1] = keys[i + 1];
			if (fr <= x1) {
				const u = (fr - x0) / (x1 - x0);
				return y0 + (y1 - y0) * (u * u * (3 - 2 * u));
			}
		}
		return 1000;
	};
	let last = -1, prevV = 0, k = 0;
	for (let fr = 46; fr <= 67; fr += 1 / 60) {
		const v = curve(fr);
		const step = v < 990 ? 37 : 1;
		if (Math.floor(v / step) !== Math.floor(prevV / step) || fr === 46) {
			const t = at(fr);
			if (t - last > 0.028) {
				const s0 = Math.round(t * SR);
				const f = 2300 + (k % 3) * 260;
				const [gl, gr] = pan(((k % 5) - 2) * 0.12);
				const bp = bandpass();
				for (let n = 0; n < 0.03 * SR; n++) {
					const tt = n / SR;
					const v2 = (Math.sin(TAU * f * tt) * Math.exp(-tt / 0.006) * 0.6 + bp(noise(), 4200, 2) * Math.exp(-tt / 0.003)) * 0.12;
					add(s0 + n, v2 * gl, v2 * gr, 0.08);
				}
				last = t;
				k++;
			}
		}
		prevV = v;
	}
	// the landing click on 1,000
	chime(at(67), hz(81), {gain: 0.12, decay: 0.35, p: 0}); // A5
}

// 1K — warm deep hit (with harmonics so it reads on phone speakers) + bright shimmer
{
	const t0 = at(73);
	const s0 = Math.round(t0 * SR);
	const body = lp(900);
	let ph = 0;
	for (let n = 0; n < 1.4 * SR && s0 + n < N; n++) {
		const t = n / SR;
		const f = 73.4 + 60 * Math.exp(-t / 0.04); // D2 with a soft pitch drop
		ph += (TAU * f) / SR;
		const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / 0.42);
		let v = Math.tanh(Math.sin(ph) * 2.2) * 0.7 + Math.sin(ph * 2) * 0.25 + Math.sin(ph * 3) * 0.12;
		v = body(v) * env * 0.42;
		if (t < 0.02) v += noise() * 0.08 * Math.exp(-t / 0.005);
		add(s0 + n, v, v, 0.12);
	}
	[[86, -0.5], [90, 0.4], [93, -0.2], [98, 0.6], [102, -0.6]].forEach(([m, p], i) =>
		chime(t0 + 0.01 + i * 0.035, hz(m), {gain: 0.06, decay: 0.9, p, rev: 0.7}),
	);
	// sparkly air rising into the shimmer
	const hpS = lp(9000);
	for (let n = Math.round((t0 - 0.12) * SR); n < Math.round((t0 + 0.8) * SR); n++) {
		const t = n / SR - t0;
		const env = t < 0 ? (t + 0.12) / 0.12 : Math.exp(-t / 0.22);
		const x = noise();
		const v = (x - hpS(x)) * env * 0.05;
		add(n, v, v * 0.9, 0.6);
	}
}

// THANK YOU — one warm felt-piano chord (rolled), D major add9
[[38, -0.4], [50, -0.2], [57, 0.0], [62, 0.15], [66, 0.3], [69, 0.45], [76, 0.55]].forEach(([m, p], i) =>
	feltNote(at(80) + i * 0.018, m, {gain: m < 45 ? 0.13 : 0.11, p}),
);

// hearts — gentle twinkles on the D-major pentatonic
[[108, 93], [111, 98], [114, 90], [117, 95], [120, 100], [123, 97], [126, 93], [129, 102]].forEach(([fr, m], i) =>
	chime(at(fr), hz(m), {gain: 0.04, decay: 0.4, p: i % 2 ? 0.55 : -0.55, rev: 0.75}),
);

// LOGO — clean final chime
chime(at(132), hz(74), {gain: 0.17, decay: 1.4, p: -0.1, rev: 0.55}); // D5
chime(at(132) + 0.02, hz(81), {gain: 0.11, decay: 1.2, p: 0.15, rev: 0.55}); // A5
chime(at(132) + 0.04, hz(86), {gain: 0.08, decay: 1.0, p: 0.0, rev: 0.6}); // D6

// ---------- reverb (Freeverb-style: 8 combs + 4 allpasses per side)
const reverb = (inp, spread) => {
	const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((d) => Math.round(((d + spread) * SR) / 44100));
	const aps = [556, 441, 341, 225].map((d) => Math.round(((d + spread) * SR) / 44100));
	const out = new Float32Array(N);
	const fb = 0.84, damp = 0.3;
	for (const d of combs) {
		const buf = new Float32Array(d);
		let idx = 0, store = 0;
		for (let n = 0; n < N; n++) {
			const y = buf[idx];
			store = y * (1 - damp) + store * damp;
			buf[idx] = inp[n] + store * fb;
			out[n] += y;
			idx = (idx + 1) % d;
		}
	}
	for (const d of aps) {
		const buf = new Float32Array(d);
		let idx = 0;
		for (let n = 0; n < N; n++) {
			const bo = buf[idx];
			const x = out[n];
			out[n] = -x + bo;
			buf[idx] = x + bo * 0.5;
			idx = (idx + 1) % d;
		}
	}
	return out;
};
const wetL = reverb(sendL, 0);
const wetR = reverb(sendR, 23);
for (let n = 0; n < N; n++) {
	L[n] += wetL[n] * 0.05;
	R[n] += wetR[n] * 0.05;
}

// gentle fades so the file starts and ends on silence (no clicks)
for (let n = 0; n < N; n++) {
	const t = n / SR;
	const g = Math.min(1, t / 0.003) * Math.min(1, (DUR - t) / 0.06);
	L[n] *= g;
	R[n] *= g;
}

// ---------- loudness: −14 LUFS integrated, true peak ≤ −1 dBTP
const writeWav = (file, l, r) => {
	const data = Buffer.alloc(N * 4);
	for (let n = 0; n < N; n++) {
		data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, l[n])) * 32767), n * 4);
		data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, r[n])) * 32767), n * 4 + 2);
	}
	const h = Buffer.alloc(44);
	h.write('RIFF', 0);
	h.writeUInt32LE(36 + data.length, 4);
	h.write('WAVE', 8);
	h.write('fmt ', 12);
	h.writeUInt32LE(16, 16);
	h.writeUInt16LE(1, 20);
	h.writeUInt16LE(2, 22);
	h.writeUInt32LE(SR, 24);
	h.writeUInt32LE(SR * 4, 28);
	h.writeUInt16LE(4, 32);
	h.writeUInt16LE(16, 34);
	h.write('data', 36);
	h.writeUInt32LE(data.length, 40);
	fs.writeFileSync(file, Buffer.concat([h, data]));
};
const ffMeasure = (file) => {
	const res = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`]).toString();
	const summary = res.slice(res.lastIndexOf('Summary:'));
	const I = parseFloat(summary.match(/I:\s+(-?[\d.]+) LUFS/)[1]);
	const TP = parseFloat(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)[1]);
	return {I, TP};
};

/** Look-ahead limiter on 4× interpolated peaks (catches inter-sample overs). */
const limit = (l, r, ceilingDb) => {
	const ceil = 10 ** (ceilingDb / 20);
	const look = Math.round(0.0015 * SR);
	const rel = Math.exp(-1 / (0.06 * SR));
	const peak = new Float32Array(N);
	const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
	for (let n = 0; n < N; n++) {
		let m = Math.max(Math.abs(l[n]), Math.abs(r[n]));
		if (n > 0 && n < N - 2) {
			for (const t of [0.25, 0.5, 0.75]) {
				m = Math.max(m, Math.abs(cr(l[n - 1], l[n], l[n + 1], l[n + 2], t)), Math.abs(cr(r[n - 1], r[n], r[n + 1], r[n + 2], t)));
			}
		}
		peak[n] = m;
	}
	const need = new Float32Array(N);
	for (let n = 0; n < N; n++) need[n] = peak[n] > ceil ? ceil / peak[n] : 1;
	// look-ahead min, then smooth release
	const gain = new Float32Array(N);
	let g = 1;
	for (let n = 0; n < N; n++) {
		let target = 1;
		for (let k = 0; k <= look && n + k < N; k++) target = Math.min(target, need[n + k]);
		g = target < g ? target : target + (g - target) * rel;
		gain[n] = g;
	}
	for (let n = 0; n < N; n++) {
		l[n] *= gain[n];
		r[n] *= gain[n];
	}
};

fs.mkdirSync(path.dirname(OUT), {recursive: true});
const tmp = OUT.replace(/\.wav$/, '.tmp.wav');
let gainDb = 0;
let result;
for (let pass = 0; pass < 6; pass++) {
	const g = 10 ** (gainDb / 20);
	const l = L.map((x) => x * g);
	const r = R.map((x) => x * g);
	limit(l, r, -1.4);
	writeWav(tmp, l, r);
	result = ffMeasure(tmp);
	console.log(`pass ${pass}: gain ${gainDb.toFixed(2)} dB → ${result.I} LUFS, TP ${result.TP} dBTP`);
	if (Math.abs(result.I + 14) <= 0.3 && result.TP <= -1.0) break;
	gainDb += -14 - result.I;
}
fs.renameSync(tmp, OUT);
console.log(`wrote ${OUT}: ${result.I} LUFS integrated, ${result.TP} dBTP`);
