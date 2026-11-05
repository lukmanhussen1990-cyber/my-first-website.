// Music + sound effects made entirely in code, mixed UNDER the user's voiceover.
// The voiceover samples are added unchanged (no speed, pitch, EQ or level change).
// Writes public/audio/music.wav, public/audio/sfx.wav and public/audio/mix.wav (voice + music + sfx, + 1 s tail).
//
// Usage: node scripts/make-audio.mjs [--no-music]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const SR = 44100;
const words = JSON.parse(fs.readFileSync('words.json', 'utf8'));
const TOTAL = words.duration + 1;
const N = Math.ceil(TOTAL * SR);
const NO_MUSIC = process.argv.includes('--no-music');

/* ---------- helpers ---------- */
let seed = 12345;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rand() * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = {C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11};
const n = (s) => {
	const m = s.match(/^([A-G]#?)(\d)$/);
	return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
};
const dbToGain = (db) => Math.pow(10, db / 20);

const music = new Float32Array(N);
const sfx = new Float32Array(N);

/** Add a synthesized voice into buf at time t0 (s), dur seconds, with fn(tt) -> sample. */
const add = (buf, t0, dur, fn, gain = 1) => {
	const s0 = Math.max(0, Math.floor(t0 * SR));
	const s1 = Math.min(buf.length, Math.floor((t0 + dur) * SR));
	for (let i = s0; i < s1; i++) buf[i] += fn((i - t0 * SR) / SR) * gain;
};

/* ---------- instruments ---------- */
const marimba = (f, g = 1) => (t) => {
	const a = Math.min(1, t / 0.003);
	return a * g * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5.5) + 0.32 * Math.sin(2 * Math.PI * f * 3.93 * t) * Math.exp(-t * 18) + 0.08 * Math.sin(2 * Math.PI * f * 9.2 * t) * Math.exp(-t * 40));
};
const bell = (f, g = 1) => (t) => {
	const a = Math.min(1, t / 0.004);
	return a * g * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 2.2) + 0.45 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 4) + 0.2 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 7));
};
const pluckBass = (f, g = 1) => (t) => {
	const a = Math.min(1, t / 0.006);
	return a * g * (Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 3.2) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 6));
};
const tuba = (f, dur, g = 1) => (t) => {
	const env = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (dur - t) / 0.12));
	const v = 1 + 0.004 * Math.sin(2 * Math.PI * 5 * t);
	const ph = 2 * Math.PI * f * v * t;
	return g * env * (Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph));
};
const pad = (freqs, dur, g = 1) => (t) => {
	const env = Math.min(1, t / 1.2) * Math.min(1, Math.max(0, (dur - t) / 1.2));
	let s = 0;
	for (const f of freqs) {
		s += Math.sin(2 * Math.PI * f * 1.003 * t + 0.3) + Math.sin(2 * Math.PI * f * 0.997 * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
	}
	return (g * env * s) / (freqs.length * 2.3);
};

/* ---------- MUSIC ---------- */
const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;

// 8-bar playful theme (C major: C  Am  F  G | C  Am  F  G). '.' = rest.
const THEME = [
	'E5 G5 C6 G5 E5 G5 A5 G5',
	'E5 . C5 E5 A5 G5 E5 .',
	'F5 A5 C6 A5 F5 G5 A5 F5',
	'G5 . D5 G5 B5 A5 G5 .',
	'C6 B5 A5 G5 E5 G5 C6 .',
	'A5 G5 E5 C5 E5 . A5 .',
	'F5 E5 F5 A5 C6 . A5 F5',
	'G5 A5 B5 D6 C6 . . .',
].map((b) => b.split(' '));
const ROOTS = ['C3', 'A2', 'F2', 'G2', 'C3', 'A2', 'F2', 'G2'];
const CHORDS = {C3: ['C4', 'E4', 'G4'], A2: ['A3', 'C4', 'E4'], F2: ['F3', 'A3', 'C4'], G2: ['G3', 'B3', 'D4']};

const playTheme = (t0, t1, level = 1, melody = true) => {
	let bar = 0;
	for (let bt = t0; bt < t1 - 0.01; bt += BAR, bar++) {
		const k = bar % 8;
		const root = ROOTS[k];
		// bass on beats 1 and 3
		add(music, bt, 1.2, pluckBass(midi(n(root)), 0.55 * level));
		add(music, bt + 2 * BEAT, 1.2, pluckBass(midi(n(root) + 7), 0.4 * level));
		// soft offbeat chord stabs
		for (const b of [1, 3]) for (const c of CHORDS[root]) if (bt + b * BEAT < t1) add(music, bt + b * BEAT, 0.6, marimba(midi(n(c)), 0.12 * level));
		// shaker on eighths
		for (let e = 0; e < 8; e++) {
			const st = bt + (e * BEAT) / 2;
			if (st < t1) add(music, st, 0.05, (t) => noise() * Math.exp(-t * 90) * (e % 2 ? 0.05 : 0.025) * level);
		}
		if (!melody) continue;
		THEME[k].forEach((note, e) => {
			const st = bt + (e * BEAT) / 2;
			if (note !== '.' && st < t1) add(music, st, 1.4, marimba(midi(n(note)), 0.34 * level));
		});
	}
};

if (!NO_MUSIC) {
	// 1) Playful theme: 0 – 56.3 s
	playTheme(0, 56.3, 1);
	// 2) Grumpy old mayor: 56.3 – 64.96 (A minor, low "tuba" steps)
	const grumpy = ['A2', 'E2', 'A2', 'E2', 'F2', 'E2', 'D2', 'E2', 'A2', 'G#2', 'A2', 'E2', 'F2', 'E2', 'D2', 'E2'];
	grumpy.forEach((m, i) => {
		const t = 56.3 + i * BEAT;
		if (t < 64.9) add(music, t, BEAT * 0.8, tuba(midi(n(m)), BEAT * 0.8, 0.32));
	});
	// sad "wah wah wah" at "ears down"
	['G4', 'F#4', 'F4', 'E4'].forEach((m, i) => add(music, 64.96 + i * 0.42, i === 3 ? 1.1 : 0.4, tuba(midi(n(m)), i === 3 ? 1.1 : 0.4, 0.22)));
	add(music, 66.6, 1.8, pad([midi(n('A3')), midi(n('C4')), midi(n('E4'))], 1.8, 0.25));
	// 3) Night forest: 68.38 – 83.94, soft and slow (pads + sparse bells)
	const night = [
		['A3', 'C4', 'E4'],
		['F3', 'A3', 'C4'],
		['C3', 'E3', 'G3'],
		['G3', 'B3', 'D4'],
	];
	for (let i = 0; i < 4; i++) add(music, 68.38 + i * 3.9, 4.6, pad(night[i].map((x) => midi(n(x))), 4.6, 0.32));
	const penta = ['A4', 'C5', 'D5', 'E5', 'G5', 'A5'];
	for (let t = 69; t < 83.5; t += 1.3) add(music, t, 2.5, bell(midi(n(penta[Math.floor(rand() * penta.length)])), 0.09));
	// 4) Hope: 83.94 – 93.44 (major, rising)
	const hope = [
		['F3', 'A3', 'C4'],
		['C3', 'E3', 'G3'],
		['G3', 'B3', 'D4'],
	];
	for (let i = 0; i < 3; i++) add(music, 83.94 + i * 3.2, 3.8, pad(hope[i].map((x) => midi(n(x))), 3.8, 0.34));
	['C5', 'E5', 'G5', 'C6', 'E6', 'G5', 'C6', 'E6', 'G6'].forEach((m, i) => add(music, 84.1 + i * 0.95, 2.4, bell(midi(n(m)), 0.11)));
	// 5) Tender belly rub: 93.44 – 100 (slow marimba arpeggios)
	const arp = ['C4', 'E4', 'G4', 'C5', 'A3', 'C4', 'E4', 'A4', 'F3', 'A3', 'C4', 'F4', 'G3', 'B3', 'D4', 'G4'];
	arp.forEach((m, i) => {
		const t = 93.44 + i * 0.4;
		if (t < 100) add(music, t, 1.5, marimba(midi(n(m)), 0.22));
	});
	add(music, 93.44, 6.6, pad([midi(n('C4')), midi(n('E4')), midi(n('G4'))], 6.6, 0.16));
	// 6) Happy finale: 100 – end
	playTheme(100, 107.55, 1.05);
	// final chord ringing out
	for (const c of ['C4', 'E4', 'G4', 'C5', 'E5']) add(music, 107.55, 1.2, marimba(midi(n(c)), 0.22));
	add(music, 107.55, 1.0, pluckBass(midi(n('C2')), 0.6));
}

/* ---------- SFX ---------- */
const click = (t0, g = 1) => {
	add(sfx, t0, 0.02, (t) => noise() * Math.exp(-t * 300) * 0.9 * g);
	add(sfx, t0 + 0.004, 0.12, (t) => Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t * 45) * 0.18 * g);
};
const whoosh = (t0, dur = 0.3, g = 1) => {
	let lp = 0;
	add(sfx, t0, dur, (t) => {
		const x = t / dur;
		const k = 0.05 + 0.5 * x;
		lp += (noise() - lp) * k;
		return lp * Math.sin(Math.PI * x) * 0.9 * g;
	});
};
const thunk = (t0, g = 1) => {
	add(sfx, t0, 0.35, (t) => Math.sin(2 * Math.PI * (55 + 70 * Math.exp(-t * 25)) * t) * Math.exp(-t * 11) * 1.0 * g);
	let lp = 0;
	add(sfx, t0, 0.06, (t) => {
		lp += (noise() - lp) * 0.3;
		return lp * Math.exp(-t * 60) * 0.9 * g;
	});
};
const flip = (t0, g = 1) => add(sfx, t0, 0.03, (t) => (noise() * 0.6 + Math.sin(2 * Math.PI * 1800 * t)) * Math.exp(-t * 160) * 0.35 * g);
const snore = (t0, dur, pitch = 1, g = 1) => {
	let lp = 0;
	add(sfx, t0, dur, (t) => {
		const cyc = (t * 0.55) % 1; // one breath ~1.8 s
		const inhale = cyc < 0.45 ? Math.sin((cyc / 0.45) * Math.PI) : 0;
		const exhale = cyc >= 0.5 ? Math.sin(((cyc - 0.5) / 0.5) * Math.PI) : 0;
		lp += (noise() - lp) * 0.06;
		const buzz = (Math.sin(2 * Math.PI * 38 * pitch * t) > 0 ? 1 : -1) * 0.5 + lp * 2;
		return (inhale * buzz * 0.5 + exhale * Math.sin(2 * Math.PI * (700 + 300 * (cyc - 0.5)) * pitch * t) * 0.12) * g;
	});
};
const crowdCheer = (t0, dur, g = 1) => {
	let b1 = 0;
	let b2 = 0;
	add(sfx, t0, dur, (t) => {
		const env = Math.min(1, t / 0.25) * Math.min(1, Math.max(0, (dur - t) / 0.5));
		b1 += (noise() - b1) * 0.25;
		b2 += (b1 - b2) * 0.25;
		const voice = (b1 - b2) * (1 + 0.5 * Math.sin(2 * Math.PI * 3.1 * t) * Math.sin(2 * Math.PI * 0.7 * t));
		return voice * env * 1.4 * g;
	});
	// claps
	for (let i = 0; i < dur * 22; i++) {
		const ct = t0 + rand() * dur;
		let lp = 0;
		add(sfx, ct, 0.04, (t) => {
			lp += (noise() - lp) * 0.6;
			return (noise() - lp) * Math.exp(-t * 110) * 0.32 * g;
		});
	}
};
const ding = (t0, f = 1046, g = 1) => add(sfx, t0, 2.0, bell(f, 0.4 * g));
const boing = (t0, g = 1) => add(sfx, t0, 0.35, (t) => Math.sin(2 * Math.PI * (300 + 500 * t + 60 * Math.sin(2 * Math.PI * 18 * t)) * t) * Math.exp(-t * 8) * 0.35 * g);
const pop = (t0, g = 1) => add(sfx, t0, 0.12, (t) => Math.sin(2 * Math.PI * (900 - 3000 * t) * t) * Math.exp(-t * 30) * 0.5 * g);
const slap = (t0, g = 1) => {
	add(sfx, t0, 0.12, (t) => noise() * Math.exp(-t * 45) * 0.9 * g);
	add(sfx, t0, 0.25, (t) => Math.sin(2 * Math.PI * (80 + 60 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * 0.8 * g);
};
const tick = (t0, g = 1) => add(sfx, t0, 0.02, (t) => Math.sin(2 * Math.PI * 2600 * t) * Math.exp(-t * 300) * 0.4 * g);
const crickets = (t0, t1, g = 1) => {
	for (let t = t0; t < t1; t += 0.9 + rand() * 0.6) {
		const f = 4200 + rand() * 600;
		for (let k = 0; k < 3; k++) add(sfx, t + k * 0.06, 0.04, (tt) => Math.sin(2 * Math.PI * f * tt) * Math.sin(Math.PI * (tt / 0.04)) * 0.05 * g);
	}
};
const unroll = (t0, dur, g = 1) => add(sfx, t0, dur, (t) => noise() * (0.5 + 0.5 * Math.sin(2 * Math.PI * 22 * t)) * 0.1 * Math.min(1, (dur - t) * 3) * g);

// camera flashes (same times as the flashes in the podium shots)
[0.15, 1.05, 2.2, 0.45, 1.6, 2.65, 0.75, 1.9, 1.25, 2.45, 0.3, 1.4, 2.9].forEach((t) => click(t, 0.8));
// whip-pans
[4.14, 29.4, 63.88].forEach((t) => whoosh(t - 0.16, 0.32, 0.6));
// speech paper unrolling
unroll(10.05, 1.8, 0.8);
// crowd asleep standing up
snore(12.0, 2.0, 1, 0.22);
snore(12.6, 1.4, 1.3, 0.16);
pop(13.0, 0.6); // the guy tipping over
boing(17.98, 0.7); // head tilt at "Biscuit"
// ballots dropping
for (let i = 0; i < 7; i++) add(sfx, 22.68 + i * 0.3 + 0.55, 0.06, (t) => noise() * Math.exp(-t * 80) * 0.25);
// results board flipping
for (let t = 25.1; t < 26.75; t += 0.045 + (t - 25.1) * 0.03) flip(t, 0.7);
for (let t = 28.12; t < 28.52; t += 0.05) flip(t, 0.7);
// crowd shocked → cheering, Biscuit happy hop
crowdCheer(29.7, 1.4, 0.55);
boing(30.37, 0.7);
// paw stamps
[35.27, 35.97, 36.67, 37.37].forEach((t) => thunk(t, 0.5));
[38.48, 44.76, 50.64].forEach((t) => thunk(t, 0.85));
// clock hits 2:00
ding(40.38, 784, 0.7);
ding(40.9, 784, 0.4);
// nap time snores
snore(40.9, 1.6, 1, 0.22);
snore(41.0, 1.4, 1.4, 0.16);
snore(41.7, 0.8, 1.8, 0.2); // Biscuit's tiny snore
snore(42.44, 1.5, 0.8, 0.24); // bus driver
// belly rubs: happy pops for hearts
[45.5, 45.9, 46.4, 46.9].forEach((t) => pop(t, 0.35));
// fetch day boings
[51.2, 51.7, 52.2].forEach((t) => boing(t, 0.35));
crowdCheer(54.3, 1.9, 0.4);
// newspaper slam
slap(56.8, 0.9);
// stomps
[59.59, 59.98, 60.36, 60.75, 61.13, 61.51, 61.9].forEach((t) => thunk(t, 0.45));
// night forest crickets
crickets(68.6, 86.8, 0.7);
// clock spinning ticks
for (let t = 81.6; t < 83.8; t += 0.06) tick(t, 0.5);
// the reunion cheer
crowdCheer(91.8, 1.6, 0.45);
// belly rub: pops for hearts
[98.8, 99.2, 99.6].forEach((t) => pop(t, 0.35));
// the NEW LAW stamp
thunk(103.1, 1.0);
ding(103.8, 1568, 0.35);
// confetti + cheering finale
pop(105.54, 0.8);
pop(106.3, 0.8);
crowdCheer(105.6, 2.95, 0.5);

/* ---------- MIX ---------- */
const decode = (file) => {
	const buf = execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-i', file, '-f', 'f32le', '-ac', '1', '-ar', String(SR), '-'], {maxBuffer: 1 << 30});
	return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
const voice = decode('public/voiceover.mp3');

// Voice envelope (for ducking music/sfx under speech).
const env = new Float32Array(N);
{
	let e = 0;
	for (let i = 0; i < N; i++) {
		const v = i < voice.length ? Math.abs(voice[i]) : 0;
		e = v > e ? e + (v - e) * 0.01 : e + (v - e) * 0.0004;
		env[i] = e;
	}
}
const normalizeTo = (buf, peakDb) => {
	let p = 0;
	for (const v of buf) p = Math.max(p, Math.abs(v));
	const g = p > 0 ? dbToGain(peakDb) / p : 1;
	for (let i = 0; i < buf.length; i++) buf[i] *= g;
};
normalizeTo(music, -16); // music bed peaks at -16 dBFS (voice peaks at -0.5 dBFS)
normalizeTo(sfx, -12);
for (let i = 0; i < N; i++) {
	const speaking = Math.min(1, env[i] / 0.06);
	music[i] *= 1 - 0.55 * speaking; // ~ -7 dB more while I talk
	sfx[i] *= 1 - 0.4 * speaking;
}
const mix = new Float32Array(N);
let clipFixes = 0;
for (let i = 0; i < N; i++) {
	const v = i < voice.length ? voice[i] : 0;
	let bed = music[i] + sfx[i];
	// never let the bed push the voice into clipping: shrink the bed, never the voice
	const limit = 0.985;
	if (Math.abs(v + bed) > limit) {
		const room = Math.max(0, limit - Math.abs(v));
		bed = Math.sign(bed) * Math.min(Math.abs(bed), room);
		clipFixes++;
	}
	mix[i] = v + bed;
}

const writeWav = (file, data) => {
	const b = Buffer.alloc(44 + data.length * 2);
	b.write('RIFF', 0);
	b.writeUInt32LE(36 + data.length * 2, 4);
	b.write('WAVE', 8);
	b.write('fmt ', 12);
	b.writeUInt32LE(16, 16);
	b.writeUInt16LE(1, 20);
	b.writeUInt16LE(1, 22);
	b.writeUInt32LE(SR, 24);
	b.writeUInt32LE(SR * 2, 28);
	b.writeUInt16LE(2, 32);
	b.writeUInt16LE(16, 34);
	b.write('data', 36);
	b.writeUInt32LE(data.length * 2, 40);
	for (let i = 0; i < data.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(data[i] * 32767))), 44 + i * 2);
	fs.writeFileSync(file, b);
};
fs.mkdirSync('public/audio', {recursive: true});
writeWav('public/audio/music.wav', music);
writeWav('public/audio/sfx.wav', sfx);
writeWav('public/audio/mix.wav', mix);
console.log(`mix: ${TOTAL.toFixed(3)} s, voice ${(voice.length / SR).toFixed(3)} s, bed limited on ${clipFixes} samples${NO_MUSIC ? ' (no music)' : ''}`);
