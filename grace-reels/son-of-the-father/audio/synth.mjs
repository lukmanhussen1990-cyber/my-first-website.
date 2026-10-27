#!/usr/bin/env node
// Q.03 SON OF THE FATHER: the whole soundtrack (music, SFX and the final mix), synthesized in pure JS (no
// samples, no downloads). Every cue time comes from src/plan.js, the same plan that drives the picture;
// script.json's per-beat SFX notes are checked against the placed cues. ffmpeg is only used for the
// two-pass EBU R128 loudness normalisation and the final checks.
//
//   npm run audio  ->  audio/stems/music.wav, audio/stems/sfx.wav (float, post-duck: voice + stems = mix),
//                      audio/stems/duck_music_gain.wav (the music ducking gain, for QC)
//                      audio/mix_prenorm.wav (float), audio/final_mix.wav (48 kHz / 24-bit / stereo,
//                      -14 LUFS, <= -1 dBTP), public/final_mix.wav, audio/cuesheet.json
//
//   audio/score.mjs  the music (D minor -> hard stop -> D major)   audio/foley.mjs  the SFX + ambience
//   audio/lib/*      DSP, instruments, SFX generators       audio/qc.py      spectrogram / level / word checks
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildPlan } from '../src/plan.js';
import * as D from './lib/dsp.mjs';
import { renderMusic } from './score.mjs';
import { renderSfx } from './foley.mjs';

const { SR, dB, smp, lerp, cosRamp } = D;
const t00 = Date.now();
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const P = (...a) => path.join(ROOT, ...a);
const log = (...a) => console.log(`[${((Date.now() - t00) / 1000).toFixed(1).padStart(5)}s]`, ...a);

// ------------------------------------------------------------------ plan (single source of truth)
const T = JSON.parse(fs.readFileSync(P('timeline.json'), 'utf8'));
const SCRIPT = JSON.parse(fs.readFileSync(P('script.json'), 'utf8'));
const plan = buildPlan(T);
const E = plan.ev;
const dur = plan.dur, N = Math.round(dur * SR);
const NB = N + Math.round(4 * SR);                     // music renders 4 s past the end (wrapped onto the start: the reel loops)
const q = (t) => D.frameQ(t, plan.fps);                 // SFX land on the nearest video frame
// scene spans (first shot start .. last shot end) so the score survives shots being split or renamed
const SPANS = {};
for (const s of plan.shots) { if (s.id === 'LOOP') continue; const c = SPANS[s.scene] ??= { t0: s.t0, t1: s.t1, shots: [] }; c.t0 = Math.min(c.t0, s.t0); c.t1 = Math.max(c.t1, s.t1); c.shots.push(s); }
const SC = new Proxy(SPANS, { get: (o, id) => o[id] ?? { t0: T.scenes[id].start - 0.15, t1: T.scenes[id].end + 0.15, shots: [] } });
// word start (s) with a safe fallback, so a script edit can never break the audio build
const derived = {};
const W = (beat, w, nth = 0, fallback = null) => {
  try { const t = plan.word(beat, w, nth).start; derived[`${beat}:${w}${nth ? '#' + nth : ''}`] = +t.toFixed(3); return t; } catch {
    const b = plan.beats[beat], t = fallback ?? (b ? (b.start + b.end) / 2 : 0);
    console.warn(`  ! word "${w}"#${nth} not in ${beat}; using ${t.toFixed(2)} s`); return t;
  }
};
const cues = [];
const cue = (t, what) => { cues.push({ t: +t.toFixed(3), what }); return t; };
const ctx = { N, NB, E, W, SC, plan, cue, q, dur };

// voice (untouched): mono 48 kHz, padded/trimmed to the reel duration
const vw = D.readWav(P('voice', 'voice.wav'));
if (vw.sr !== SR) throw new Error(`voice.wav must be ${SR} Hz`);
const voice = new Float32Array(N); voice.set(vw.chans[0].subarray(0, N));
log(`plan: ${dur.toFixed(3)} s (${N} samples, ${plan.frames} frames), voice ${(vw.chans[0].length / SR).toFixed(3)} s`);

// ================================================================== render
const M = renderMusic(ctx);
log(`music: ${Object.entries(M.notes).map(([k, v]) => `${v} ${k}`).join(', ')}`);
if (M.layers) {                                         // AUDIO_DEBUG=1: dry loudness of each music layer per scene
  for (const [sc, sp] of Object.entries(SPANS)) console.log(`  ${sc.padEnd(4)} ` + Object.entries(M.layers).map(([k, b]) => `${k} ${D.loudness([b.L.subarray(smp(sp.t0), smp(sp.t1)), b.R.subarray(smp(sp.t0), smp(sp.t1))]).toFixed(1)}`).join(' | '));
}
const S = renderSfx(ctx);
log(`sfx: ${cues.length} cues placed`);

// ================================================================== reverbs
const hallIR = D.makeIR({ seconds: 3.6, rt60: 3.2, pre: 0.025, fadeIn: 0.08, damp0: 9500, damp1: 1300, hp: 150, seed: 'hall' });
const roomIR = D.makeIR({ seconds: 1.5, rt60: 1.0, pre: 0.012, fadeIn: 0.02, damp0: 8000, damp1: 2600, hp: 180, seed: 'room' });
const bigIR = D.makeIR({ seconds: 6.0, rt60: 5.2, pre: 0.04, fadeIn: 0.12, damp0: 8500, damp1: 900, hp: 120, seed: 'cathedral' });
// the reel loops, so every reverb tail that rings past the end wraps around onto the start
const addWet = (bus, send, ir) => {
  const n = bus.L.length, w = D.convolveMonoToStereo(send, ir, send.length + ir.L.length);
  for (let i = 0; i < w.L.length; i++) { const j = i < n ? i : n === N ? i - N : -1; if (j >= 0 && j < n) { bus.L[j] += w.L[i]; bus.R[j] += w.R[i]; } }
};
const music = M.music, sfx = S.sfx;
addWet(music, M.hall, hallIR);
addWet(sfx, S.room, roomIR);
addWet(sfx, S.hall, hallIR);
addWet(sfx, S.big, bigIR);
// loop wrap of the music (dry + wet): the 4 s rendered past the end continue at 0 s
for (const ch of ['L', 'R']) { const x = music[ch]; for (let i = N; i < NB; i++) x[i - N] += x[i]; music[ch] = x.subarray(0, N); }
cue(0, 'loop: the end (open fifth D-A, glow, bass, reverb tails) wraps onto the start under the hook');
for (const b of [music, sfx]) { D.dcBlock(b.L, 22); D.dcBlock(b.R, 22); }
log('reverbs done');

// ================================================================== automation (post-reverb, so the tails go too)
// the shout: a HARD STOP. The music (and its reverb tails) is cut to -60 dB within 60 ms of the crowd hit
// and stays out until the freeze; SFX dip 14 dB in the near silence (only the hit's tails live there)
const gainCurve = (keys) => { const f = D.ramp(keys); return (i) => f(i / SR); };
const mAuto = gainCurve([[0, 0], [E.shout - 0.004, 0], [E.shout + 0.06, -60], [E.freeze - 0.02, -60], [E.freeze + 0.02, 0]]);
const sAuto = gainCurve([[0, 0], [E.silence - 0.1, 0], [E.silence + 0.15, -14], [E.freeze - 0.05, -14], [E.freeze + 0.1, 0]]);
for (let i = smp(E.shout - 0.05); i < smp(E.freeze + 0.15); i++) {
  const gm = 10 ** (mAuto(i) / 20), gs = 10 ** (sAuto(i) / 20);
  music.L[i] *= gm; music.R[i] *= gm; sfx.L[i] *= gs; sfx.R[i] *= gs;
}
cue(E.shout, 'music HARD STOP (-60 dB until the freeze)');

// ================================================================== ducking + mix
// calibrate the music bed against the voice: un-ducked music sits 4 LU under the narration (integrated)
const Lvoice = D.loudness([voice, voice]);
const Lmusic0 = D.loudness([music.L, music.R]);
const musicGain = dB(Lvoice - 4.0 - Lmusic0);
// ducking from an envelope follower on the voice (70 ms attack, 500 ms release, smooth S-curve, 200 ms
// look-ahead: the dip starts ~120-130 ms before a word and is ~-7 dB on it); music -8 dB, SFX -3 dB
// (the detector sees the voice wrapped around the loop seam, so the end of the reel already dips for the
// first word after the restart, "This" at 0.05 s, and the level is continuous across the seam)
const vLoop = new Float32Array(N + SR); vLoop.set(voice); vLoop.set(voice.subarray(0, SR), N);
const act = D.voiceActivity(vLoop, { att: 0.07, rel: 0.5, look: 0.2 }).subarray(0, N);
// plus a gentle speech-band dip (-4 dB, broad, ~1 kHz) on the music while the narrator speaks
for (const x of [music.L, music.R]) D.dynEQ(x, 'peak', 1000, 0.6, (i) => -4 * act[i]);
const musicStem = D.stereo(N), sfxStem = D.stereo(N), mixL = new Float32Array(N), mixR = new Float32Array(N), duckG = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const dm = Math.pow(10, (-8 * act[i]) / 20), gm = musicGain * dm, gs = Math.pow(10, (-3 * act[i]) / 20);
  duckG[i] = dm;
  musicStem.L[i] = music.L[i] * gm; musicStem.R[i] = music.R[i] * gm;
  sfxStem.L[i] = sfx.L[i] * gs; sfxStem.R[i] = sfx.R[i] * gs;
  mixL[i] = voice[i] + musicStem.L[i] + sfxStem.L[i]; mixR[i] = voice[i] + musicStem.R[i] + sfxStem.R[i];
}
// loop seam: the music is continuous across it (wrap); 5 ms fade-in / 15 ms fade-out only guard the SFX beds
for (const x of [mixL, mixR, musicStem.L, musicStem.R, sfxStem.L, sfxStem.R]) D.fades(x, 0.005, 0.015);
log(`levels: voice ${Lvoice.toFixed(1)} LUFS, music (raw) ${Lmusic0.toFixed(1)} -> gain ${D.lin2db(musicGain).toFixed(1)} dB, sfx ${D.loudness([sfx.L, sfx.R]).toFixed(1)} LUFS`);
// per-shot balance (integrated loudness of each stem inside each shot; voice-free shots show '-')
{
  const seg = (b, a, z) => { const i0 = smp(a), i1 = Math.min(N, smp(z)); return i1 - i0 > SR * 0.4 ? D.loudness(b.R ? [b.L.subarray(i0, i1), b.R.subarray(i0, i1)] : [b.subarray(i0, i1), b.subarray(i0, i1)]) : NaN; };
  const f = (x) => (Number.isFinite(x) && x > -70 ? x.toFixed(1).padStart(6) : '     -');
  console.log('  shot     voice  music    sfx   (LUFS, post-duck)');
  for (const s of plan.shots) { const z = Math.min(dur, s.t1); console.log(`  ${s.id.padEnd(5)} ${f(seg(voice, s.t0, z))} ${f(seg(musicStem, s.t0, z))} ${f(seg(sfxStem, s.t0, z))}`); }
}

fs.mkdirSync(P('audio', 'stems'), { recursive: true });
D.writeWav(P('audio', 'stems', 'music.wav'), [musicStem.L, musicStem.R]);
D.writeWav(P('audio', 'stems', 'sfx.wav'), [sfxStem.L, sfxStem.R]);
D.writeWav(P('audio', 'stems', 'duck_music_gain.wav'), [duckG]);

// ================================================================== master: peak control so loudnorm can stay linear
// linear loudnorm needs (true peak - integrated) <= 13 dB (-1 dBTP at -14 LUFS); a transparent look-ahead
// limiter trims the few voice peaks that exceed that (target 12.8 dB, 0.2 dB safety)
const PLR = 12.8;
const L0 = D.loudness([mixL, mixR]), TP0 = D.lin2db(D.truePeak([mixL, mixR]));
let ceilDb = L0 + PLR, lim = null, L1 = L0, TP1 = TP0;
const orig = [Float32Array.from(mixL), Float32Array.from(mixR)];
for (let it = 0; it < 4; it++) {
  if (it) { mixL.set(orig[0]); mixR.set(orig[1]); }
  lim = D.limit([mixL, mixR], dB(ceilDb), { lookahead: 0.003, release: 0.09 });
  L1 = D.loudness([mixL, mixR]); TP1 = D.lin2db(D.truePeak([mixL, mixR]));
  if (TP1 - L1 <= PLR + 0.05) break;
  ceilDb -= TP1 - L1 - PLR + 0.05;
}
log(`master: ${L0.toFixed(2)} LUFS / ${TP0.toFixed(2)} dBTP -> limiter ceiling ${ceilDb.toFixed(2)} dBFS (max GR ${lim.maxReductionDb.toFixed(2)} dB, ${lim.limitedPct.toFixed(2)}% of samples) -> ${L1.toFixed(2)} LUFS / ${TP1.toFixed(2)} dBTP`);
const PRE = P('audio', 'mix_prenorm.wav');
D.writeWav(PRE, [mixL, mixR]);

// ================================================================== two-pass loudnorm (ffmpeg) -> final_mix.wav
const ff = (args) => { const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error('ffmpeg failed:\n' + (r.stderr || '').slice(-3000)); return r.stderr; };
const lastJson = (s) => JSON.parse(s.slice(s.lastIndexOf('{'), s.lastIndexOf('}') + 1));
const LRA = 20;
const LN = `loudnorm=I=-14:TP=-1:LRA=${LRA}`;
// (pass 1 pads 3 s of digital silence: it is gated out of every measurement, but stops loudnorm's
// end-of-stream look-ahead flush from biasing input_i on a reel that ends on sound)
const m1 = lastJson(ff(['-hide_banner', '-nostats', '-i', PRE, '-af', `apad=pad_dur=3,${LN}:print_format=json`, '-f', 'null', '-']));
log(`loudnorm pass 1: I ${m1.input_i} LUFS, TP ${m1.input_tp} dBTP, LRA ${m1.input_lra} LU, thresh ${m1.input_thresh}`);
const FINAL = P('audio', 'final_mix.wav');
const ebur = (file) => {
  const eb = ff(['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const sum = eb.slice(eb.lastIndexOf('Summary:'));
  return { I: parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(sum)?.[1]), TP: parseFloat(/Peak:\s+(-?[\d.]+) dBFS/.exec(sum)?.[1]), LRA: parseFloat(/LRA:\s+(-?[\d.]+) LU/.exec(sum)?.[1]) };
};
// pass 2 (linear). loudnorm's internal meter and ebur128 can differ by a few hundredths; if the verified
// integrated loudness misses -14.0 by more than 0.04 LU the measured value handed to pass 2 is nudged and
// pass 2 re-run (still a linear gain, still two-pass loudnorm)
let measI = parseFloat(m1.input_i), m2 = null, V = null;
for (let it = 0; it < 3; it++) {
  const af2 = `${LN}:measured_I=${measI.toFixed(2)}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=json`;
  m2 = lastJson(ff(['-hide_banner', '-nostats', '-y', '-i', PRE, '-af', `${af2},aresample=48000,apad,atrim=end_sample=${N}`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s24le', FINAL]));
  V = ebur(FINAL);
  log(`loudnorm pass 2 (${m2.normalization_type}, measured_I ${measI.toFixed(2)}): ebur128 I ${V.I} LUFS, TP ${V.TP} dBTP`);
  if (m2.normalization_type !== 'linear') console.warn('  ! loudnorm fell back to dynamic mode');
  if (Math.abs(V.I + 14) <= 0.04 || V.TP > -1.0) break;
  measI += V.I + 14;
}
fs.mkdirSync(P('public'), { recursive: true });
fs.copyFileSync(FINAL, P('public', 'final_mix.wav'));

// ================================================================== verification + cue sheet
const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a:0', '-count_packets', '-show_entries', 'stream=sample_rate,channels,bits_per_sample,duration_ts,duration', '-of', 'json', FINAL], { encoding: 'utf8' });
const st = JSON.parse(pr.stdout).streams[0];
const durOk = Math.abs(st.duration_ts / SR - dur) <= 1 / plan.fps;
// depth of the near silence: music stem RMS in [silence, freeze] vs. the 3 s before the shout, and the
// whole mix in the same window vs. its integrated loudness
const rmsDb = (st2, a, b) => { let e = 0; const i0 = smp(a), i1 = smp(b); for (let i = i0; i < i1; i++) e += st2.L[i] ** 2 + st2.R[i] ** 2; return 10 * Math.log10(e / (2 * (i1 - i0)) + 1e-30); };
const silDepth = rmsDb(musicStem, E.shout - 3, E.shout) - rmsDb(musicStem, E.silence, E.freeze);
const mixSil = rmsDb({ L: mixL, R: mixR }, E.silence + 0.05, E.freeze - 0.05) - 0.691;
const silDepthInt = D.loudness([mixL, mixR]) - mixSil;
cues.sort((a, b) => a.t - b.t);
// script.json SFX notes per beat, with the cues that fall inside each beat (start - 0.5 .. hold_end + 0.3)
const beats = SCRIPT.beats.map((b) => {
  const tb = plan.beats[b.id], a = tb ? tb.start - 0.5 : E.endCard - 0.1, z = tb ? (tb.hold_end ?? tb.end) + 0.3 : dur;
  return { id: b.id, scene: b.scene, t0: +a.toFixed(2), t1: +z.toFixed(2), sfxNotes: b.sfx, cues: cues.filter((c) => c.t >= a && c.t <= z).length };
});
for (const b of beats) if (b.sfxNotes?.length && !b.cues) console.warn(`  ! ${b.id}: script asks for ${JSON.stringify(b.sfxNotes)} but no cue falls in ${b.t0}-${b.t1} s`);
const evOut = Object.fromEntries(Object.entries(E).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => +x.toFixed(3)) : +v.toFixed(3)]));
fs.writeFileSync(P('audio', 'cuesheet.json'), JSON.stringify({
  reel: `${SCRIPT.episode} ${SCRIPT.title}`, duration: dur, samples: N, sampleRate: SR, lufs: V.I, truePeak: V.TP, lra: V.LRA,
  musicDepthInSilence_dB: +silDepth.toFixed(1), mixDepthInSilence_dB: +silDepthInt.toFixed(1), events: evOut, derived,
  shots: plan.shots.map((x) => ({ id: x.id, scene: x.scene, t0: +x.t0.toFixed(3), t1: +Math.min(dur, x.t1).toFixed(3), trans: x.trans })), beats, cues,
}, null, 1));
log(`final_mix.wav: ${st.sample_rate} Hz, ${st.channels} ch, ${st.bits_per_sample}-bit, ${st.duration_ts} samples = ${(st.duration_ts / SR).toFixed(4)} s (plan ${dur} s) ${durOk ? 'OK' : 'MISMATCH'}`);
log(`ebur128: I = ${V.I} LUFS, true peak = ${V.TP} dBTP, LRA = ${V.LRA} LU  ${Math.abs(V.I + 14) <= 0.05 && V.TP <= -1.0 ? 'OK' : 'CHECK'}`);
log(`near silence: music ${silDepth.toFixed(1)} dB below the 3 s before the shout; the whole mix sits ${silDepthInt.toFixed(1)} dB below its integrated loudness  ${silDepth >= 35 && silDepthInt >= 20 ? 'OK' : 'CHECK'}`);
log(`done -> audio/final_mix.wav + public/final_mix.wav (${((Date.now() - t00) / 1000).toFixed(1)} s)`);
