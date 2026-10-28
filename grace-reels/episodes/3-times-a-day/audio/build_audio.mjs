// 3 Times a Day: music + sound effects + final mix, all from code.
// The voice (audio/voice.wav) is the owner's ElevenLabs take, re-spaced by tools/build_timeline.py.
// usage (from grace-reels/): node episodes/3-times-a-day/audio/build_audio.mjs
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SR, Track, biquad, db, expDecay, mtof, noise, pad, piano, reverb, rng, strings, sub, bell, writeWav} from '../../../tools/audio/dsp.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(HERE, '../src/timeline.json'), 'utf8'));
const DUR = TL.duration;
const sc = Object.fromEntries(TL.scenes.map((s) => [s.id, s]));
const norm = (w) => w.toLowerCase().replace(/[^a-z0-9]/g, '');
const word = (scene, tok, nth = 0) => {
	const ws = TL.words.filter((w) => w.scene === scene && norm(w.tok).startsWith(norm(tok)));
	if (!ws.length) throw new Error(`no ${tok} in ${scene}`);
	return ws[Math.min(nth, ws.length - 1)];
};
const local = (scene, tok, nth = 0) => word(scene, tok, nth).start - sc[scene].start;

// picture timings (kept in step with the scene code)
const LANDS = [0.04, 0.4, 0.72]; // S1 numbers
const S5 = {seal: sc.S5.start + local('S5', 'signed') + 0.32, den: sc.S5.start + local('S5', 'and') - 0.12};
const SEAL_PRESS = S5.seal + 0.55;
const S6 = {open0: sc.S6.start + 1.0, open1: sc.S6.start + 1.55, street: sc.S6.start + local('S6', 'and', 1) + 0.15, back: sc.S6.start + local('S6', 'thanks') + 0.25};
const AGE_CUTS = [1.9, 3.8].map((x) => sc.S7.start + x);
const DOOR_CLICK = sc.S9.start + 2.35;
const PHONE_DOWN = sc.S10.start + 0.72;
const MATCH_CUT = sc.S10.start + 2.68;
const LIFT = word('S10', 'shut').start; // the warm lift into D major
const LOOP_T = TL.storyEnd + TL.endCard;

// ================= MUSIC =================
const music = new Track(DUR);
const M = (t0, dur, g, gain, pan = 0) => music.add(t0, dur, g, gain, pan);
const chord = (t0, dur, notes, amp = 0.15, o = {}) => M(t0, dur + (o.release ?? 2.4), pad(notes, dur, 1, o.attack ?? 1.4, o.release ?? 2.4, o.bright ?? 0.35), amp, o.pan ?? 0);
const keys = (t0, midi, vel = 0.42, pan = 0.1, seed = 1) => M(t0, 4.5, piano(midi, vel, seed), 0.3, pan);
const bow = (t0, dur, midi, amp = 0.09, pan = 0) => M(t0, dur + 1.2, strings(midi, dur, 1, 0.8, 1.2, midi), amp, pan);
// a soft "choir": harmonics shaped by "ah" vowel formants, slow vibrato
const choir = (midis, dur, attack = 1.4, release = 2.2) => {
	const formant = (f) => Math.exp(-(((f - 760) / 200) ** 2)) + 0.75 * Math.exp(-(((f - 1180) / 230) ** 2)) + 0.3 * Math.exp(-(((f - 2700) / 320) ** 2));
	const voices = [];
	for (const m of midis) for (const det of [-0.08, 0.07]) {
		const f0 = mtof(m + det * 0.12);
		const parts = [];
		for (let k = 1; k <= 14; k++) parts.push({k, a: (formant(f0 * k) + 0.12 / k) / 3});
		voices.push({f0, parts, ph: 0, vib: 4.6 + det * 3});
	}
	return (i, t) => {
		const env = Math.min(1, t / attack) * Math.min(1, Math.max(0, (dur + release - t) / release));
		let v = 0;
		for (const vo of voices) {
			const f = vo.f0 * (1 + 0.004 * Math.sin(2 * Math.PI * vo.vib * t));
			vo.ph += (2 * Math.PI * f) / SR;
			for (const p of vo.parts) v += p.a * Math.sin(vo.ph * p.k);
		}
		return (v / voices.length) * env;
	};
};

// S1 Daniel's beam: reverent, open D-A drone (no third yet), high soft strings
bow(0, sc.S1.end + 0.05, 38, 0.1, -0.2);
bow(0, sc.S1.end + 0.05, 45, 0.08, 0.2);
chord(0, sc.S1.end - 0.2, [50, 57, 62], 0.1, {attack: 0.08, release: 0.15, bright: 0.5});
bow(0.5, sc.S1.end - 0.5, 69, 0.03, 0.1);
// S2 hard cut: cold glassy air, then silence on the title
const titleT = word('S2', 'day').end + 0.08;
chord(sc.S2.start, titleT - sc.S2.start - 0.2, [76, 83], 0.04, {attack: 0.02, release: 0.3, bright: 0.9});
// S3 busy: a nervous ticking pulse in the low piano
for (let t = sc.S3.start + 0.02, k = 0; t < sc.S4.start - 0.35; t += 0.214, k++) keys(t, k % 4 === 3 ? 41 : 38, 0.26, -0.1, 200 + k);
// S4 the court: grand, calm. D minor - Bb - C - D minor
const s4 = sc.S4.start;
const d4 = (sc.S4.end - s4) / 4;
[[38, 50, 53, 57], [34, 50, 53, 58], [36, 48, 52, 55], [38, 50, 53, 57]].forEach((c, i) => chord(s4 + i * d4, d4 + 0.2, c, 0.13, {attack: 1.0}));
bow(s4, sc.S4.end - s4, 26, 0.09);
[[0.6, 62], [1.6, 65], [2.6, 69], [4.4, 67], [5.4, 65]].forEach(([dt, m], i) => keys(s4 + dt, m, 0.32, 0.12, 220 + i));
// S5 the law: a soft tension pulse and a held Eb against D
const s5 = sc.S5.start;
for (let t = s5 + 0.1; t < sc.S5.end; t += 0.66) M(t, 0.7, sub(0.42, 70, 38, 0.5), 0.36);
bow(s5, sc.S5.end - s5, 38, 0.09, -0.15);
bow(s5 + 0.3, sc.S5.end - s5 - 0.3, 51, 0.045, 0.25);
chord(S5.den, sc.S5.end - S5.den + 0.3, [26, 33], 0.08, {attack: 0.4});
// S6 the window opens: warm F major, then Bb, piano answers
const s6 = sc.S6.start;
chord(s6, S6.open1 - s6, [38, 45, 50], 0.07, {attack: 0.6, release: 0.6});
chord(S6.open1 - 0.1, 3.3, [41, 53, 57, 60], 0.13, {attack: 0.5, bright: 0.55});
chord(S6.open1 + 3.2, sc.S6.end - S6.open1 - 3.2 + 0.2, [46, 53, 58, 62], 0.12, {attack: 1.0, bright: 0.5});
[[0.2, 72], [0.9, 69], [1.6, 77], [3.4, 74], [4.4, 72], [5.6, 70]].forEach(([dt, m], i) => keys(S6.open1 + dt, m, 0.32, 0.12, 240 + i));
// S7 the years: flowing arpeggios, F - C - Dm - Bb
const s7 = sc.S7.start;
const d7 = (sc.S7.end - s7) / 4;
[[41, 53, 57, 60], [36, 52, 55, 60], [38, 50, 53, 57], [34, 50, 53, 58]].forEach((c, i) => {
	chord(s7 + i * d7, d7 + 0.1, c, 0.1, {attack: 0.4});
	for (let j = 0; j < 8; j++) keys(s7 + i * d7 + j * (d7 / 8), c[1 + (j % 3)] + 12, 0.2, (j % 2 ? 0.25 : -0.25), 260 + i * 8 + j);
});
// S8 attention: it thins out; one held note and a question in the piano (Gm)
const s8 = sc.S8.start;
chord(s8, sc.S8.end - s8, [43, 55, 58], 0.08, {attack: 0.8});
bow(s8, sc.S8.end - s8, 62, 0.04, 0.2);
[[0.5, 67], [1.5, 70], [3.1, 69]].forEach(([dt, m], i) => keys(s8 + dt, m, 0.26, -0.1, 300 + i));
// S9 the door: intimate piano, Dm - Bb - F - C
const s9 = sc.S9.start;
const d9 = (LIFT - s9) / 4;
[[38, 50, 53], [34, 50, 53], [41, 48, 53], [36, 48, 52]].forEach((c, i) => chord(s9 + i * d9, d9 + 0.1, c, 0.08, {attack: 0.9}));
[[0.4, 62], [1.4, 65], [2.6, 62], [3.6, 58], [4.8, 60], [5.9, 64]].forEach(([dt, m], i) => keys(s9 + dt, m, 0.28, 0.1, 320 + i));
// S10 "Shut the door. Put the phone down.": the warm lift into D major
chord(LIFT - 0.05, MATCH_CUT - LIFT + 0.6, [38, 50, 54, 57, 62], 0.16, {attack: 0.7, bright: 0.6});
bow(LIFT, sc.S11.end - LIFT, 38, 0.08);
bow(LIFT + 0.4, sc.S11.end - LIFT - 0.4, 57, 0.05, 0.25);
[[0.15, 66], [0.6, 69], [1.05, 74], [1.9, 78], [2.6, 74]].forEach(([dt, m], i) => keys(LIFT + dt, m, 0.36, 0.1, 340 + i));
// S11 the psalm: D - G - D/F# - A, a warm swell
const s11 = sc.S11.start;
const d11 = (sc.S11.end - s11) / 4;
[[38, 50, 54, 57], [43, 50, 55, 59], [42, 50, 54, 57], [45, 52, 57, 61]].forEach((c, i) => chord(s11 + i * d11, d11 + 0.2, c, 0.14, {attack: 0.8, bright: 0.5}));
[[0.3, 74], [1.4, 71], [2.8, 74], [4.4, 76]].forEach(([dt, m], i) => keys(s11 + dt, m, 0.3, 0.15, 360 + i));
// S12 he shall hear: the gold beam returns with a soft choir, D add9
const s12 = sc.S12.start;
M(s12 - 0.2, sc.S12.end - s12 + 2.4, choir([50, 57, 62, 64], sc.S12.end - s12 + 0.2, 0.9, 2.0), 0.18);
chord(s12, sc.S12.end - s12, [38, 50, 54, 57, 64], 0.1, {attack: 0.8, bright: 0.6});
// S13 the call: gentle D major, piano on the question
const s13 = sc.S13.start;
chord(s13, sc.S13.end - s13, [43, 50, 55, 59], 0.09, {attack: 0.8});
[[0.4, 71], [1.6, 74], [3.0, 69]].forEach(([dt, m], i) => keys(s13 + dt, m, 0.28, 0.1, 380 + i));
// S14 end card: resolve, then the open drone again so the loop joins S1
const s14 = sc.S14.start;
chord(s14, LOOP_T - s14, [38, 50, 54, 57, 62, 66], 0.15, {attack: 0.4, bright: 0.65});
keys(s14 + 0.2, 74, 0.36, 0, 400);
keys(s14 + 0.22, 66, 0.28, 0, 401);
bow(LOOP_T - 0.2, DUR - LOOP_T + 0.2, 38, 0.1, -0.2);
bow(LOOP_T - 0.2, DUR - LOOP_T + 0.2, 45, 0.08, 0.2);

// duck the music ~8 dB under the voice
const speech = [];
for (const w of TL.words) {
	const a = w.start - 0.06;
	const b = w.end + 0.12;
	if (speech.length && a < speech[speech.length - 1][1] + 0.25) speech[speech.length - 1][1] = b;
	else speech.push([a, b]);
}
const talk = new Float32Array(Math.ceil(DUR * 100) + 1);
for (const [a, b] of speech) for (let i = Math.floor(a * 100); i < Math.min(talk.length, Math.ceil(b * 100)); i++) talk[i] = 1;
const smooth = new Float32Array(talk.length);
let g = 0;
for (let i = 0; i < talk.length; i++) {
	g += (talk[i] - g) * (talk[i] > g ? 0.12 : 0.03);
	smooth[i] = g;
}
// the title holds in silence; the hard cut kills the warm drone
music.scale((t) => {
	const i = Math.min(smooth.length - 1, Math.floor(t * 100));
	const duck = 1 - smooth[i] * (1 - db(-8));
	const titleHush = t > titleT - 0.05 && t < sc.S3.start ? 0.15 : 1;
	const tail = t > DUR - 0.4 ? Math.max(0, (DUR - t) / 0.4) : 1;
	return duck * titleHush * tail;
});
reverb(music, {room: 0.9, damp: 0.38, wet: 0.34});

// ================= SOUND EFFECTS =================
const fx = new Track(DUR);
const F = (t0, dur, gen, gain, pan = 0) => fx.add(t0, dur, gen, gain, pan);
const band = (seed, f, q, env) => noise(seed, env, biquad('bp', f, q));
const lowN = (seed, f, env) => noise(seed, env, biquad('lp', f, 0.7));
const ramp = (dur, a = 0.3, r = 0.5) => (x) => Math.min(1, x / a) * Math.min(1, Math.max(0, (dur - x) / r));

// warm chimes for 1, 2, 3 (rising), each with a soft low swell (the light pulse)
LANDS.forEach((t, i) => {
	F(t, 4, bell([74, 78, 81][i], 1, 2.4), 0.16, (i - 1) * 0.25);
	F(t, 4, bell([62, 66, 69][i], 1, 1.6), 0.07, (i - 1) * 0.25);
	F(t, 1.0, sub(0.5, 70, 46, 0.8), 0.3);
});
// hard cut -> a rising flood of tiny notification pings while the counter races
{
	const r = rng(7);
	const t0 = sc.S2.start + 0.1;
	const t1 = word('S2', '100').start;
	let t = t0;
	while (t < t1) {
		const k = (t - t0) / (t1 - t0);
		const f = 1700 + r() * 2600;
		F(t, 0.25, (i, x) => (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(2 * Math.PI * f * 1.5 * x)) * expDecay(x, 0.035) * Math.min(1, x / 0.002), 0.05 + 0.05 * k, (r() - 0.5) * 1.6);
		t += lerpN(0.16, 0.022, k) * (0.6 + r() * 0.8);
	}
	F(t1, 0.6, (i, x) => Math.sin(2 * Math.PI * 2960 * x) * expDecay(x, 0.12), 0.1, 0.1);
}
function lerpN(a, b, k) {
	return a + (b - a) * Math.min(1, Math.max(0, k));
}
// montage: buzzes and taps, a whip on every cut
{
	const s3 = sc.S3.start;
	const len = (sc.S3.end - s3) / 5;
	for (let i = 0; i < 5; i++) {
		const t = s3 + i * len;
		if (i > 0) F(t - 0.03, 0.18, band(40 + i, 1800, 1.2, (x) => Math.sin(Math.PI * Math.min(1, x / 0.18)) ** 2), 0.45, 0.3);
		F(t + 0.05, 0.05, band(50 + i, 3000, 2, (x) => expDecay(x, 0.008)), 0.7, -0.2);
	}
	const buzz = (t, dur) => F(t, dur, (i, x) => Math.sign(Math.sin(2 * Math.PI * 160 * x)) * 0.5 * (0.5 + 0.5 * Math.sign(Math.sin(2 * Math.PI * 9 * x))) * Math.min(1, x / 0.01) * Math.min(1, (dur - x) / 0.02), 0.1, 0.15);
	buzz(s3 + 0.1, 0.35);
	buzz(s3 + 4 * len + 0.05, 0.4);
	buzz(s3 + 4 * len + 0.55, 0.25);
	for (let k = 0; k < 6; k++) F(s3 + 2 * len + 0.04 + k * 0.05, 0.05, band(60 + k, 2400, 2, (x) => expDecay(x, 0.006)), 0.18, -0.3);
	F(s3 + 2 * len + 0.22, 0.4, lowN(66, 400, (x) => expDecay(x, 0.05)), 0.4);
	F(s3 + 3 * len, 0.6, band(70, 600, 0.8, ramp(0.6, 0.1, 0.4)), 0.2, -0.5);
}
// the palace: big hall air and a soft crowd murmur
const murmurs = (t0, t1, gain, seed) => {
	const r = rng(seed);
	for (let v = 0; v < 5; v++) {
		const f = 140 + r() * 80;
		const f1 = biquad('bp', 600 + r() * 300, 3);
		const f2 = biquad('bp', 1100 + r() * 500, 4);
		let ph = 0;
		const rate = 3 + r() * 2;
		const pan = (r() - 0.5) * 1.4;
		F(t0, t1 - t0, (i, x) => {
			ph += (2 * Math.PI * f * (1 + 0.05 * Math.sin(x * 2.1 + v))) / SR;
			const buzzv = ((ph / Math.PI) % 2) - 1;
			const syl = Math.max(0, Math.sin(2 * Math.PI * rate * x + v * 2)) * (0.5 + 0.5 * Math.sin(x * 0.7 + v));
			return (f1(buzzv) + f2(buzzv) * 0.6) * syl * Math.min(1, x / 1) * Math.min(1, (t1 - t0 - x) / 1);
		}, gain, pan);
	}
};
F(sc.S4.start, sc.S4.end - sc.S4.start, lowN(80, 300, ramp(sc.S4.end - sc.S4.start, 1, 0.8)), 0.08);
murmurs(sc.S4.start, sc.S4.end, 0.03, 81);
// the law: whispers, a scroll, the seal's thump, a distant low rumble for the den
{
	const r = rng(90);
	for (let k = 0; k < 9; k++) {
		const t = sc.S5.start + 0.15 + k * 0.19 + r() * 0.08;
		F(t, 0.22, band(91 + k, 3800 + r() * 2200, 1.6, (x) => Math.sin(Math.PI * Math.min(1, x / 0.22)) ** 1.5), 0.08, (r() - 0.5) * 0.8);
	}
	F(S5.seal + 0.02, 0.5, band(100, 2600, 0.9, (x) => (0.6 + 0.4 * Math.sin(x * 90)) * Math.sin(Math.PI * Math.min(1, x / 0.5))), 0.12, 0.2);
	F(SEAL_PRESS, 1.0, sub(1.0, 120, 48, 0.7), 0.7, 0.1);
	F(SEAL_PRESS, 0.3, lowN(101, 900, (x) => expDecay(x, 0.03)), 0.5, 0.1);
	F(S5.den, sc.S5.end - S5.den + 0.4, lowN(102, 70, ramp(sc.S5.end - S5.den + 0.4, 0.6, 0.6)), 0.6);
	F(S5.den + 0.5, 1.6, (i, x) => Math.sin(2 * Math.PI * 48 * x) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 7 * x)) * Math.sin(Math.PI * Math.min(1, x / 1.6)), 0.1);
}
// the window: shutters creak and knock open; the street murmurs below
{
	const r = rng(110);
	let ph = 0;
	const bp = biquad('bp', 650, 4);
	F(S6.open0, S6.open1 - S6.open0 + 0.1, (i, x) => {
		ph += (2 * Math.PI * (95 + 50 * Math.sin(x * 8))) / SR;
		return bp((((ph / Math.PI) % 2) - 1) * (0.6 + 0.4 * r())) * Math.sin(Math.PI * Math.min(1, x / (S6.open1 - S6.open0 + 0.1)));
	}, 0.26, -0.2);
	for (const [dt, pan] of [[0.02, -0.3], [0.09, 0.3]]) {
		F(S6.open1 + dt, 0.4, band(111, 420, 2.5, (x) => expDecay(x, 0.04)), 0.7, pan);
		F(S6.open1 + dt, 0.5, sub(0.4, 150, 80, 0.3), 0.25, pan);
	}
	murmurs(sc.S6.start + 1.4, sc.S6.end, 0.025, 112);
	F(S6.street, S6.back - S6.street, band(113, 900, 0.5, ramp(S6.back - S6.street, 0.3, 0.3)), 0.05);
}
// the years: a gentle whoosh at each age, wind, and birds
{
	const s7 = sc.S7.start;
	const d7 = sc.S7.end - s7;
	F(s7, d7, lowN(120, 500, (x) => ramp(d7, 0.8, 0.8)(x) * (0.6 + 0.4 * Math.sin(x * 1.3))), 0.12);
	for (const t of AGE_CUTS) F(t - 0.35, 0.7, band(121, 1200, 0.9, (x) => Math.sin(Math.PI * Math.min(1, x / 0.7)) ** 2), 0.22);
	const r = rng(122);
	for (let b = 0; b < 14; b++) {
		const t = s7 + r() * (d7 - 0.4);
		const f = 3200 + r() * 1600;
		F(t, 0.18, (i, x) => Math.sin(2 * Math.PI * (f + 900 * Math.sin(x * 60)) * x) * Math.sin(Math.PI * Math.min(1, x / 0.18)), 0.025, (r() - 0.5) * 1.4);
	}
}
// the door: footsteps in, the latch click; then the room goes quiet
{
	for (let k = 0; k < 4; k++) F(sc.S9.start + 0.15 + k * 0.34, 0.2, lowN(130 + k, 700, (x) => expDecay(x, 0.03)), 0.18, 0.3);
	F(DOOR_CLICK - 0.08, 0.3, lowN(140, 500, (x) => expDecay(x, 0.05)), 0.35, 0.35);
	F(DOOR_CLICK, 0.12, band(141, 2800, 3, (x) => expDecay(x, 0.006)), 0.45, 0.35);
	F(DOOR_CLICK + 0.05, 0.1, band(142, 1900, 3, (x) => expDecay(x, 0.008)), 0.3, 0.35);
}
// the phone goes down: a soft thunk on wood
F(PHONE_DOWN, 0.6, sub(0.6, 140, 70, 0.35), 0.4, 0.15);
F(PHONE_DOWN, 0.2, lowN(150, 1200, (x) => expDecay(x, 0.018)), 0.35, 0.15);
// the match cut back to Daniel: a soft swell of air
F(MATCH_CUT - 0.4, 0.9, band(151, 900, 0.7, (x) => Math.sin(Math.PI * Math.min(1, x / 0.9)) ** 2), 0.1);
// the psalm card: a warm swell
F(sc.S11.start - 0.3, 3.0, (i, x) => (Math.sin(2 * Math.PI * mtof(62) * x) + 0.6 * Math.sin(2 * Math.PI * mtof(66) * x) + 0.5 * Math.sin(2 * Math.PI * mtof(69) * x)) * Math.sin(Math.PI * Math.min(1, x / 3.0)) ** 2 * 0.3, 0.12);
// the call: soft taps as the comment types "3 🙏"
{
	const at = word('S13', 'number').start + 0.2;
	for (let k = 0; k < 3; k++) F(at + k * 0.17, 0.08, band(160 + k, 2600, 2.2, (x) => expDecay(x, 0.008)), 0.3, 0.2);
	for (let k = 0; k < 5; k++) F(at + 0.7 + k * 0.18, 1.0, bell(86 + [0, 2, 4, 7, 9][k], 1, 0.6), 0.02, (k - 2) * 0.2);
}
// end card bells, and the loop: the first chime again as Daniel's beam returns
for (let i = 0; i < 5; i++) F(sc.S14.start + 0.1 + i * 0.07, 1.5, bell(86 + [0, 2, 4, 7, 9][i], 1, 0.9), 0.02, (i - 2) * 0.15);
F(LOOP_T + 0.05, 2, bell(74, 1, 1.2), 0.1);
fx.scale((t) => (t > DUR - 0.3 ? Math.max(0, (DUR - t) / 0.3) : 1));
reverb(fx, {room: 0.72, damp: 0.5, wet: 0.16});

// ================= MIX =================
const out = (f) => path.join(HERE, f);
console.log('music', writeWav(out('music.wav'), music, 0.6));
console.log('sfx  ', writeWav(out('sfx.wav'), fx, 0.8));
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-y', ...args], {stdio: ['ignore', 'pipe', 'pipe']}).toString();
// voice: gentle clean-up and a stereo copy padded to the reel length
ff(['-i', out(TL.voice.file), '-af', `aresample=${SR},highpass=f=75,acompressor=threshold=-20dB:ratio=2.6:attack=8:release=160:makeup=3,equalizer=f=3200:t=q:w=1.2:g=2,apad=whole_dur=${DUR.toFixed(3)},pan=stereo|c0=c0|c1=c0`, '-ar', String(SR), '-c:a', 'pcm_f32le', out('voice_fx.wav')]);
ff(['-i', out('voice_fx.wav'), '-i', out('music.wav'), '-i', out('sfx.wav'), '-filter_complex', `[0:a]volume=1.0[v];[1:a]volume=0.42[m];[2:a]volume=0.5[s];[v][m][s]amix=inputs=3:normalize=0,atrim=0:${DUR.toFixed(3)}[mix]`, '-map', '[mix]', '-ar', String(SR), '-c:a', 'pcm_f32le', out('premix.wav')]);
const measured = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${out('premix.wav')}" -af loudnorm=I=-14:TP=-1:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p'`]).toString();
const st = JSON.parse(measured);
const ln = `loudnorm=I=-14:TP=-1:LRA=9:measured_I=${st.input_i}:measured_TP=${st.input_tp}:measured_LRA=${st.input_lra}:measured_thresh=${st.input_thresh}:offset=${st.target_offset}:linear=true`;
ff(['-i', out('premix.wav'), '-af', ln + ',aresample=' + SR, '-ar', String(SR), '-c:a', 'pcm_s24le', out('final_mix.wav')]);
console.log('loudness in', st.input_i, 'LUFS -> final_mix.wav');
