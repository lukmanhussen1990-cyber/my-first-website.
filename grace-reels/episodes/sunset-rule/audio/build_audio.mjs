// The Sunset Rule: voice edit + music + sound effects + final mix, all from code.
// usage (from grace-reels/): node episodes/sunset-rule/audio/build_audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SR, Track, adsr, bell, biquad, db, expDecay, mtof, noise, onePoleHP, onePoleLP, pad, piano, reverb, rng, strings, sub, writeWav} from '../../../tools/audio/dsp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(HERE, '../src/timeline.json'), 'utf8'));
const DUR = TL.duration;
const sc = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const word = (scene, tok) => TL.words.find((w) => w.scene === scene && norm(w.tok).startsWith(tok));

// S1 speed ramp (same as the picture): real time -> action time, then invert
const timeWarp = (t, fastUntil = 0.28, rampTo = 0.75, slow = 0.3, backFrom = 3.7, backTo = 4.4) => {
	const ease = (x) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, x))) - 1) / 2;
	const speed = (x) => (x < fastUntil ? 1 : x < rampTo ? 1 + (slow - 1) * ease((x - fastUntil) / (rampTo - fastUntil)) : x < backFrom ? slow : x < backTo ? slow + (1 - slow) * ease((x - backFrom) / (backTo - backFrom)) : 1);
	const n = Math.max(1, Math.ceil(t / 0.01));
	let s = 0;
	for (let i = 0; i < n; i++) s += speed((i + 0.5) * (t / n)) * (t / n);
	return s;
};
const tauToT = (tau) => {
	let lo = 0;
	let hi = 6;
	for (let i = 0; i < 40; i++) {
		const mid = (lo + hi) / 2;
		if (timeWarp(mid) < tau) lo = mid;
		else hi = mid;
	}
	return (lo + hi) / 2;
};

// ================= MUSIC =================
const music = new Track(DUR);
const M = (t0, dur, g, gain, pan = 0) => music.add(t0, dur, g, gain, pan);
const chord = (t0, dur, notes, amp = 0.16, opts = {}) => M(t0, dur + (opts.release ?? 2.4), pad(notes, dur, 1, opts.attack ?? 1.4, opts.release ?? 2.4, opts.bright ?? 0.35), amp, opts.pan ?? 0);
const keys = (t0, midi, vel = 0.45, pan = 0.1, seed = 1) => M(t0, 4.5, piano(midi, vel, seed), 0.32, pan);
const bow = (t0, dur, midi, amp = 0.1, pan = 0) => M(t0, dur + 1.2, strings(midi, dur, 1, 0.7, 1.1, midi), amp, pan);

// S1: tense drone, heartbeat, (D minor)
const s1 = sc.S1;
bow(0, s1.end + 0.4, 38, 0.11, -0.2);
bow(0.0, s1.end + 0.4, 45, 0.08, 0.2);
bow(1.0, s1.end - 0.6, 50, 0.05, 0);
M(0.04, 1.2, sub(0.9, 120, 38, 0.9), 0.7); // the title punch
for (const t of [0.95, 1.85, 2.75, 3.65]) M(t, 0.8, sub(0.6, 80, 40, 0.5), 0.45);

// S2-S4 synagogue: felt piano over a soft pad, Dm - Bb - Gm - A
const s2 = sc.S2.start;
chord(s2, 2.6, [50, 53, 57], 0.14);
chord(s2 + 2.6, 2.6, [46, 50, 53], 0.14);
chord(s2 + 5.2, 2.4, [43, 46, 50], 0.14);
chord(s2 + 7.6, 2.0, [45, 49, 52], 0.13);
[[0.2, 62], [1.0, 65], [1.8, 69], [2.8, 62], [3.6, 65], [4.4, 70], [5.4, 62], [6.2, 67], [7.6, 64], [8.4, 61]].forEach(([dt, m], i) => keys(s2 + dt, m, 0.38, 0.15, i + 1));
// S3 anger: low strings lean in, faster pulse
const s3 = sc.S3.start;
bow(s3, sc.S3.end - s3 + 0.5, 38, 0.12, -0.1);
bow(s3 + 0.4, sc.S3.end - s3, 51, 0.05, 0.25); // Eb against D: tension
for (let t = s3 + 0.3; t < sc.S3.end; t += 0.62) M(t, 0.6, sub(0.45, 70, 38, 0.4), 0.38);
// S4 grief: descending piano, Gm - Bb - Dm
const s4 = sc.S4.start;
chord(s4, 3.0, [43, 50, 55], 0.13, {attack: 1.8});
chord(s4 + 3.0, 3.0, [46, 53, 58], 0.12);
chord(s4 + 6.0, 3.4, [50, 53, 57], 0.12);
[[0.6, 74], [1.4, 72], [2.2, 70], [3.2, 69], [4.0, 67], [4.8, 65], [6.2, 64], [7.0, 62]].forEach(([dt, m], i) => keys(s4 + dt, m, 0.33, -0.1, 20 + i));
// S5 healing: lift to F major / Bb add9
const s5 = sc.S5.start;
chord(s5, 1.6, [53, 57, 60, 64], 0.13, {bright: 0.6});
chord(s5 + 1.5, 1.8, [46, 53, 57, 60], 0.12, {bright: 0.6});
[[0.3, 72], [0.7, 76], [1.1, 77], [1.6, 81]].forEach(([dt, m], i) => keys(s5 + dt, m, 0.3, 0.3, 40 + i));

// S6-S7 temple: driving low ostinato (100 bpm eighths), Dm
const s6 = sc.S6.start;
for (let t = s6 + 0.2, k = 0; t < sc.S7.start + 0.4; t += 0.3, k++) {
	M(t, 0.5, strings(k % 4 === 3 ? 41 : 38, 0.18, 1, 0.02, 0.15, k), 0.12, -0.15);
	if (k % 2 === 0) M(t, 0.6, sub(0.5, 90, 42, 0.35), 0.32);
}
bow(s6 + 1.2, 3.4, 57, 0.06, 0.3);
bow(s6 + 1.2, 3.4, 62, 0.05, -0.3);
const s7 = sc.S7.start;
chord(s7, sc.S7.end - s7, [50, 53, 57, 62], 0.11, {attack: 0.6});
keys(s7 + 0.3, 62, 0.3, 0.1, 61);
keys(s7 + 1.3, 69, 0.28, 0.1, 62);

// S8 but notice: sparse, then build into the NEVER stamp
const s8 = sc.S8.start;
const never = word('S8', 'never').start;
bow(s8, never - s8, 38, 0.08);
bow(s8 + 0.2, never - s8 - 0.2, 69, 0.03, 0.3);
bow(s8 + 2.8, never - s8 - 2.8, 50, 0.06, -0.2);
bow(s8 + 3.6, never - s8 - 3.6, 57, 0.06, 0.2);
keys(s8 + 0.4, 62, 0.3, 0, 70);
keys(s8 + 2.6, 65, 0.3, 0, 71);
chord(never + 0.05, 1.6, [38, 45, 50], 0.1, {attack: 0.05, release: 1.6});

// S9 mocked: a low drone that thins out to near silence around Jesus
const s9 = sc.S9.start;
bow(s9, 3.0, 38, 0.06);
bow(s9, 2.6, 44, 0.03, 0.3);

// S10 "Father, forgive them": resolve to D major
const s10 = sc.S10.start;
const father = word('S10', 'father').start;
chord(s10, father - s10 + 0.2, [43, 50, 55], 0.08, {attack: 1.0});
chord(father - 0.1, sc.S10.end - father + 0.3, [50, 54, 57, 62], 0.16, {attack: 0.9, bright: 0.5});
bow(father, sc.S10.end - father + 1.0, 38, 0.08);
[[0.2, 66], [0.9, 69], [1.6, 74], [2.6, 73], [3.2, 71]].forEach(([dt, m], i) => keys(father + dt, m, 0.36, 0.1, 80 + i));

// S11: G - D/F# - Em - A, warm
const s11 = sc.S11.start;
const d11 = (sc.S11.end - s11) / 4;
[[43, 50, 55, 59], [42, 50, 54, 57], [40, 47, 52, 55], [45, 49, 52, 57]].forEach((c, i) => chord(s11 + i * d11, d11 + 0.2, c, 0.14, {attack: 0.9}));
[[0.2, 71], [1.2, 74], [2.2, 69], [3.2, 73]].forEach(([dt, m], i) => keys(s11 + dt, m, 0.32, 0.15, 90 + i));

// S12 the deadline at sunset: softest and warmest, then a swell on "sun"
const s12 = sc.S12.start;
const sunW = word('S12', 'sun').start;
chord(s12, 3.0, [50, 54, 57, 64], 0.12, {attack: 2.0, bright: 0.45});
chord(s12 + 3.0, 2.6, [43, 50, 55, 59], 0.12, {attack: 1.4});
chord(s12 + 5.6, sc.S12.end - s12 - 5.6 + 0.4, [47, 54, 57, 62], 0.13, {attack: 1.0});
bow(sunW - 0.6, sc.S13.end - sunW + 0.6, 50, 0.07);
bow(sunW - 0.4, sc.S13.end - sunW + 0.4, 57, 0.06, 0.25);
bow(sunW - 0.2, sc.S13.end - sunW + 0.2, 62, 0.05, -0.25);
[[0.6, 69], [2.0, 66], [3.4, 71], [4.8, 69], [6.2, 74]].forEach(([dt, m], i) => keys(s12 + dt, m, 0.28, -0.1, 100 + i));

// S13 reveal: the big warm swell
const s13 = sc.S13.start;
chord(s13, sc.S13.end - s13 + 0.4, [38, 50, 54, 57, 62, 66], 0.2, {attack: 1.6, bright: 0.7});
keys(s13 + 1.6, 74, 0.4, 0.2, 120);
keys(s13 + 1.62, 78, 0.3, 0.2, 121);

// S14: intimate piano alone
const s14 = sc.S14.start;
const send = s14 + 2.15;
chord(s14, 2.4, [50, 57, 62], 0.07, {attack: 1.2});
[[0.2, 62], [0.9, 66], [1.6, 69]].forEach(([dt, m], i) => keys(s14 + dt, m, 0.3, 0.1, 130 + i));
chord(send, 2.4, [50, 54, 57, 62, 64], 0.15, {attack: 0.25, bright: 0.65});

// S15 dusk + S16 end card cadence: Gmaj7 -> A sus -> D
const s15 = sc.S15.start;
chord(s15, sc.S15.end - s15, [43, 50, 54, 59], 0.1, {attack: 0.8});
const s16 = sc.S16.start;
chord(s16, 1.2, [45, 50, 52, 57], 0.12, {attack: 0.4});
chord(s16 + 1.2, 1.8, [38, 50, 54, 57, 62], 0.15, {attack: 0.5, release: 1.0});
keys(s16 + 1.25, 74, 0.38, 0, 140);
keys(s16 + 1.27, 66, 0.3, 0, 141);

// duck the music ~8 dB under the voice
const speech = [];
for (const w of TL.words) {
	const a = w.start - 0.06;
	const b = w.end + 0.12;
	if (speech.length && a < speech[speech.length - 1][1] + 0.25) speech[speech.length - 1][1] = b;
	else speech.push([a, b]);
}
const talk = new Float32Array(Math.ceil(DUR * 100));
for (const [a, b] of speech) for (let i = Math.floor(a * 100); i < Math.min(talk.length, Math.ceil(b * 100)); i++) talk[i] = 1;
const smooth = new Float32Array(talk.length);
let g = 0;
for (let i = 0; i < talk.length; i++) {
	const k = talk[i] > g ? 0.12 : 0.03; // 80 ms down, ~350 ms back up
	g += (talk[i] - g) * k;
	smooth[i] = g;
}
music.scale((t) => {
	const i = Math.min(smooth.length - 1, Math.floor(t * 100));
	const duck = 1 - smooth[i] * (1 - db(-8));
	// tail: fade the very end so the loop restarts clean
	const tail = t > DUR - 0.5 ? Math.max(0, (DUR - t) / 0.5) : 1;
	return duck * tail;
});
reverb(music, {room: 0.88, damp: 0.4, wet: 0.32});

// ================= SOUND EFFECTS =================
const fx = new Track(DUR);
const F = (t0, dur, gen, gain, pan = 0) => fx.add(t0, dur, gen, gain, pan);
const bandNoise = (seed, f, q, env) => noise(seed, env, biquad('bp', f, q));
const lowNoise = (seed, f, env) => noise(seed, env, biquad('lp', f, 0.7));

// table flip: creak on the tip-back, heavy wood slam, a cascade of coins
const woodSlam = (t, gain, slow = 1, seed = 1, pan = 0.2) => {
	F(t, 1.2 * slow, sub(1.0, 110 / slow, 45 / slow, 0.7 * slow), gain * 0.9, pan);
	F(t, 0.9 * slow, lowNoise(seed, 900 / slow, (x) => expDecay(x, 0.09 * slow) * Math.min(1, x / 0.002)), gain * 1.1, pan);
	for (const [f, a] of [[180, 1], [310, 0.7], [470, 0.5]]) {
		const bp = biquad('bp', f / slow, 9);
		const r = rng(seed + f);
		F(t, 0.7 * slow, (i, x) => bp((r() * 2 - 1) * expDecay(x, 0.06 * slow)) * 6, gain * a * 0.5, pan);
	}
};
const creak = (t, dur, gain, seed = 3) => {
	const r = rng(seed);
	let ph = 0;
	const bp = biquad('bp', 700, 4);
	F(t, dur, (i, x) => {
		ph += (2 * Math.PI * (110 + 40 * Math.sin(x * 9))) / SR;
		const saw = ((ph / Math.PI) % 2) - 1;
		return bp(saw * (0.6 + 0.4 * r())) * Math.sin(Math.PI * Math.min(1, x / dur));
	}, gain, 0.2);
};
const coinTing = (t, gain, seed, pan = 0) => {
	const r = rng(seed);
	const f = 2600 + r() * 2600;
	F(t, 0.35, (i, x) => (Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(2 * Math.PI * f * 2.43 * x) + 0.3 * Math.sin(2 * Math.PI * f * 3.9 * x)) * expDecay(x, 0.05 + r() * 0.08), gain, pan);
};
const coins = (t0, t1, n, gain, seed) => {
	const r = rng(seed);
	for (let i = 0; i < n; i++) coinTing(t0 + Math.pow(r(), 1.4) * (t1 - t0), gain * (0.4 + r() * 0.6), seed * 100 + i, (r() - 0.5) * 1.2);
};
const wings = (t, dur, gain, seed = 9, pan = -0.3) => {
	const bp = biquad('bp', 1500, 0.8);
	const r = rng(seed);
	F(t, dur, (i, x) => bp((r() * 2 - 1) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 13 * x)) * Math.exp(-x / (dur * 0.5)) * Math.min(1, x / 0.03)), gain, pan);
};
const whoosh = (t, dur, gain, f0 = 400, f1 = 2400, seed = 5, pan = 0) => {
	const r = rng(seed);
	let bp = biquad('bp', f0, 1.2);
	F(t, dur, (i, x) => {
		if (i % 64 === 0) bp = biquad('bp', f0 + (f1 - f0) * (x / dur), 1.2);
		return bp((r() * 2 - 1) * Math.sin(Math.PI * Math.min(1, x / dur)) ** 2);
	}, gain, pan);
};

// --- S1 hook (slow motion: the hits are pitched down and stretched)
const tipT = tauToT(0.18);
const slamT = tauToT(0.9);
creak(tipT - 0.05, 0.35, 0.25);
whoosh(0.0, 1.0, 0.35, 300, 1600, 11, -0.1);
woodSlam(slamT, 0.9, 1.6, 1, 0.25);
wings(tauToT(0.26), 1.4, 0.22, 4, -0.4);
coins(tauToT(0.72), tauToT(1.3), 38, 0.06, 2);

// --- S2-S5 synagogue: stone room tone + murmurs without words
const room = (t0, t1, gain) => F(t0, t1 - t0, lowNoise(21, 260, (x) => Math.min(1, x / 0.8) * Math.min(1, (t1 - t0 - x) / 0.6)), gain);
room(sc.S2.start, sc.S5.end, 0.05);
const murmurs = (t0, t1, gain, seed) => {
	const r = rng(seed);
	for (let v = 0; v < 4; v++) {
		const f = 150 + r() * 70;
		const f1 = biquad('bp', 600 + r() * 300, 3);
		const f2 = biquad('bp', 1100 + r() * 500, 4);
		let ph = 0;
		const rate = 3 + r() * 2;
		const pan = (r() - 0.5) * 1.4;
		F(t0, t1 - t0, (i, x) => {
			ph += (2 * Math.PI * f * (1 + 0.05 * Math.sin(x * 2.1 + v))) / SR;
			const buzz = ((ph / Math.PI) % 2) - 1;
			const syl = Math.max(0, Math.sin(2 * Math.PI * rate * x + v * 2)) * (0.5 + 0.5 * Math.sin(x * 0.7 + v));
			return (f1(buzz) + f2(buzz) * 0.6) * syl * Math.min(1, x / 1) * Math.min(1, (t1 - t0 - x) / 1);
		}, gain, pan);
	}
};
murmurs(sc.S2.start, sc.S3.start + 0.6, 0.035, 5);
// S3 anger: a low red rumble
F(sc.S3.start, sc.S3.end - sc.S3.start + 0.8, lowNoise(31, 90, (x) => Math.min(1, x / 1.2) * Math.min(1, (sc.S3.end - sc.S3.start + 0.8 - x) / 0.8)), 0.35);
F(sc.S3.start, sc.S3.end - sc.S3.start, (i, x) => Math.sin(2 * Math.PI * 41 * x) * Math.min(1, x / 1.5) * Math.min(1, (sc.S3.end - sc.S3.start - x) / 0.6), 0.12);
// S4 the tear shines: a soft sad chime
F(sc.S4.start + 2.0, 4, bell(81, 1, 2.6), 0.09, 0.2);
F(sc.S4.start + 2.25, 4, bell(76, 1, 2.2), 0.05, -0.2);
// S5 healing: a gentle rising shimmer
for (let i = 0; i < 9; i++) F(sc.S5.start + 0.35 + i * 0.16, 2.5, bell(74 + [0, 4, 7, 9, 12, 16, 19, 21, 24][i], 1, 1.2), 0.035, (i % 2 ? 0.3 : -0.3));
whoosh(sc.S5.start + 0.3, 1.8, 0.12, 2000, 7000, 12, 0.1);

// --- S6-S7 temple: market bustle, hooves, cords swishing, tables over, coins, doves
const s6t = sc.S6.start;
F(s6t, sc.S7.end - s6t, bandNoise(41, 900, 0.5, (x) => Math.min(1, x / 0.6) * Math.min(1, (sc.S7.end - s6t - x) / 0.8) * (0.7 + 0.3 * Math.sin(x * 3))), 0.06);
murmurs(s6t, sc.S6.end, 0.04, 9);
for (let t = s6t + 1.3, k = 0; t < sc.S6.end + 0.3; t += 0.13 + (k % 3) * 0.04, k++) F(t, 0.2, sub(0.4, 140, 70, 0.12), 0.18, ((k % 5) - 2) * 0.2);
for (let k = 0; k < 8; k++) whoosh(s6t + 1.15 + k * 0.419, 0.28, 0.13, 600, 3000, 50 + k, -0.2);
wings(s6t + 1.6, 1.5, 0.2, 7, 0.4);
const flip6 = s6t + 2.45 - 0.55 + 0.94;
woodSlam(flip6, 0.6, 1, 3, 0.3);
woodSlam(flip6 + 0.35, 0.45, 1, 5, 0.5);
coins(flip6 - 0.4, flip6 + 1.2, 44, 0.07, 6);

// --- S8 the NEVER stamp
F(never, 0.6, sub(1, 160, 50, 0.4), 0.7);
F(never, 0.3, lowNoise(61, 2500, (x) => expDecay(x, 0.025)), 0.6);
F(never, 0.4, bandNoise(62, 420, 3, (x) => expDecay(x, 0.05)), 0.5);

// --- S9 mocking: laughter texture (no words), then near silence around Jesus
const s9t = sc.S9.start;
const laughEnd = s9t + 3.0;
{
	const r = rng(71);
	for (let v = 0; v < 5; v++) {
		const f0 = 160 + r() * 140;
		const fa = biquad('bp', 750 + r() * 200, 4);
		const fb = biquad('bp', 1250 + r() * 300, 5);
		let ph = 0;
		const rate = 4.5 + r() * 1.5;
		const pan = (r() - 0.5) * 1.6 - 0.3;
		const start = s9t + r() * 0.4;
		F(start, laughEnd - start + 0.6, (i, x) => {
			ph += (2 * Math.PI * f0 * (1 + 0.08 * Math.sin(x * 11 + v))) / SR;
			const buzz = ((ph / Math.PI) % 2) - 1;
			const ha = Math.pow(Math.max(0, Math.sin(2 * Math.PI * rate * x + v)), 2);
			const fade = Math.min(1, x / 0.15) * Math.max(0, Math.min(1, (laughEnd - start + 0.6 - x) / 1.4));
			return (fa(buzz) + fb(buzz) * 0.5) * ha * fade;
		}, 0.05, pan);
	}
}

// --- S10 wind on the hill
F(sc.S10.start, sc.S11.end - sc.S10.start, noise(81, (x) => (0.6 + 0.4 * Math.sin(x * 0.9)) * Math.min(1, x / 1.2), biquad('bp', 500, 0.6)), 0.12, 0.2);

// --- S13 reveal: swell + a soft tick per flashback frame
whoosh(sc.S13.start - 0.6, 2.6, 0.12, 200, 1200, 91, 0);
for (let i = 0; i < 4; i++) {
	const t = sc.S13.start + 0.55 + i * 0.32;
	F(t, 0.12, bandNoise(92 + i, 3200, 2, (x) => expDecay(x, 0.012)), 0.4, (i % 2 ? 0.25 : -0.25));
	F(t, 0.5, bell(86, 1, 0.4), 0.025, (i % 2 ? 0.25 : -0.25));
}

// --- S14 phone: soft whoosh + (music has the warm chord)
whoosh(send - 0.05, 0.6, 0.22, 800, 4000, 101, 0.3);
F(send, 0.25, bandNoise(102, 1800, 2, (x) => expDecay(x, 0.02)), 0.15, 0.3);

// --- S15 crickets + the first star
const s15t = sc.S15.start;
for (let c = 0; c < 3; c++) {
	const f = 4300 + c * 260;
	const rate = 2.6 + c * 0.5;
	F(s15t - 0.3, sc.S16.start - s15t + 1.2, (i, x) => {
		const chirp = Math.pow(Math.max(0, Math.sin(2 * Math.PI * rate * x + c)), 8) * (Math.sin(2 * Math.PI * 30 * x) > 0 ? 1 : 0.3);
		return Math.sin(2 * Math.PI * f * x) * chirp * Math.min(1, x / 0.6) * Math.min(1, (sc.S16.start - s15t + 1.2 - x) / 1);
	}, 0.012, c - 1);
}
F(s15t + 0.35, 4, bell(86, 1, 2.8), 0.08, 0.2);

// --- S16 logo shimmer, then the sunrise chime that loops back to noon
for (let i = 0; i < 6; i++) F(sc.S16.start + 0.1 + i * 0.07, 1.6, bell(86 + [0, 2, 4, 7, 9, 12][i], 1, 0.9), 0.02, (i - 2.5) * 0.15);
const loopT = TL.storyEnd + TL.endCard;
for (let i = 0; i < 4; i++) F(loopT + i * 0.09, 1.2, bell(74 + [0, 4, 7, 12][i], 1, 0.8), 0.05, (i - 1.5) * 0.2);
fx.scale((t) => (t > DUR - 0.3 ? Math.max(0, (DUR - t) / 0.3) : 1));
reverb(fx, {room: 0.7, damp: 0.5, wet: 0.14});

// ================= WRITE + MIX =================
const out = (f) => path.join(HERE, f);
console.log('music', writeWav(out('music.wav'), music, 0.6));
console.log('sfx  ', writeWav(out('sfx.wav'), fx, 0.8));

// voice: insert the silences from the timeline, 48 kHz, light clean-up
const ins = TL.voice.inserts;
const cuts = [0, ...ins.map(([at]) => at), TL.voice.originalDuration ?? 72.05];
let filt = `[0:a]aresample=${SR},asplit=${cuts.length - 1}${cuts.slice(1).map((_, i) => `[a${i}]`).join('')};`;
const parts = [];
filt += `anullsrc=r=${SR}:cl=mono,atrim=0:${TL.voice.lead}[z0];`;
parts.push('[z0]');
for (let i = 0; i < cuts.length - 1; i++) {
	filt += `[a${i}]atrim=${cuts[i]}:${cuts[i + 1]},asetpts=PTS-STARTPTS[s${i}];`;
	parts.push(`[s${i}]`);
	if (i < ins.length) {
		filt += `anullsrc=r=${SR}:cl=mono,atrim=0:${ins[i][1]}[z${i + 1}];`;
		parts.push(`[z${i + 1}]`);
	}
}
filt += `${parts.join('')}concat=n=${parts.length}:v=0:a=1,highpass=f=75,acompressor=threshold=-20dB:ratio=2.6:attack=8:release=160:makeup=3,equalizer=f=3200:t=q:w=1.2:g=2,apad=whole_dur=${DUR.toFixed(3)},pan=stereo|c0=c0|c1=c0[v]`;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-y', ...args], {stdio: ['ignore', 'pipe', 'pipe']}).toString();
ff(['-i', path.join(HERE, TL.voice.file), '-filter_complex', filt, '-map', '[v]', '-ar', String(SR), '-c:a', 'pcm_f32le', out('voice.wav')]);

// premix, then two-pass loudnorm to -14 LUFS / -1 dBTP
ff(['-i', out('voice.wav'), '-i', out('music.wav'), '-i', out('sfx.wav'), '-filter_complex', '[0:a]volume=1.0[v];[1:a]volume=0.42[m];[2:a]volume=0.5[s];[v][m][s]amix=inputs=3:normalize=0,atrim=0:' + DUR.toFixed(3) + '[mix]', '-map', '[mix]', '-ar', String(SR), '-c:a', 'pcm_f32le', out('premix.wav')]);
const measured = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${out('premix.wav')}" -af loudnorm=I=-14:TP=-1:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`]).toString();
const stats = JSON.parse(measured);
const ln = `loudnorm=I=-14:TP=-1:LRA=9:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
ff(['-i', out('premix.wav'), '-af', ln + ',aresample=' + SR, '-ar', String(SR), '-c:a', 'pcm_s24le', out('final_mix.wav')]);
console.log('loudness in', stats.input_i, 'LUFS -> final_mix.wav');
