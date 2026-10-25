#!/usr/bin/env node
// Grace in Motion: renders music + effects + ambience from the episode cues, processes the voice,
// ducks everything under the narrator and masters to -14 LUFS / -1 dBTP (two-pass ffmpeg loudnorm).
//
//   node tools/audio/mix.mjs --episode the-mountain [--no-stems]
//
// In:  episodes/<ep>/audio/voice.wav, episodes/<ep>/timeline.json, src/episodes/<ep>/cues.js
// Out: episodes/<ep>/audio/final_mix.wav (48 kHz stereo 24-bit), audio/mix_report.json, audio/stems/*.wav

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import {
  SR, Bus, rng, seedOf, dbToGain, gainToDb, readWav, writeWav, filter, compress, OnePole, makeIR,
  convolveCircular, addCircular, limit, loudnessLUFS, rmsOf, peakOf, spanEnvelope,
} from "./dsp.mjs";
import { SFX, ambienceBed } from "./sfx.mjs";
import { renderMusic } from "./music.mjs";

const LEVELS = {
  musicUnderVoiceDb: -8, // un-ducked music RMS relative to the narrator's RMS
  musicDuckDb: -8, // extra dip while the narrator speaks
  sfxOffsetDb: -2, // cue gains are relative to a -6 dBFS effect peak
  sfxDuckDb: -7, // regular effects step aside under words
  hitDuckDb: { boom: 0, chime: -2, thunder: -3, shimmer: -4 }, // designed hits stay mostly put
  ambOffsetDb: -4, // beds support, the score leads
  ambDuckDb: -5,
  voiceVerbDb: -16,
  target: { I: -14, TP: -1, LRA: 18 },
  limiterCeilingDb: -1.6, // true-peak ceiling after loudness gain, so loudnorm can stay linear
};

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : def;
};
const episode = arg("episode", "the-mountain");
const writeStems = !process.argv.includes("--no-stems");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const epDir = join(root, "episodes", episode);
const audioDir = join(epDir, "audio");
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

const tl = JSON.parse(readFileSync(join(epDir, "timeline.json"), "utf8"));
const { buildCues } = await import(pathToFileURL(join(root, "src/episodes", episode, "cues.js")).href);
const cues = buildCues(tl);
const N = Math.round(tl.durationSeconds * SR);

// ---------------------------------------------------------------- voice
const vf = readWav(join(audioDir, "voice.wav"));
if (vf.sampleRate !== SR) throw new Error(`voice.wav must be ${SR} Hz`);
const voiceRaw = new Float32Array(N);
voiceRaw.set(vf.channels[0].subarray(0, N));

function deEss(x, { freq = 5500, threshold = -32, ratio = 3 } = {}) {
  const hi = Float32Array.from(x);
  filter(hi, "highpass", freq, 0.7);
  filter(hi, "highpass", freq, 0.7);
  const env = new OnePole(0.003);
  const rel = new OnePole(0.06);
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const e = Math.sqrt(env.tick(hi[i] * hi[i]) + 1e-12) * Math.SQRT2;
    const over = gainToDb(e) - threshold;
    const gr = over > 0 ? over * (1 - 1 / ratio) : 0;
    const g = dbToGain(-rel.tick(gr));
    out[i] = x[i] - hi[i] + hi[i] * g;
  }
  return out;
}

// broadcast-style chain: clean-up EQ, de-ess, levelling compressor, fast peak compressor, then a
// voice-only look-ahead limiter so syllable peaks sit ~12 dB over the speech level (music never pumps)
function processVoice(x, speechMask) {
  const y = Float32Array.from(x);
  filter(y, "highpass", 70, 0.707);
  filter(y, "highpass", 70, 0.707);
  filter(y, "lowshelf", 150, 0.7, 1.5); // warmth
  filter(y, "peak", 320, 1.1, -1.5); // less box
  filter(y, "peak", 3200, 0.8, 2.0); // presence
  filter(y, "highshelf", 8500, 0.7, 2.0); // air
  const lev = compress(deEss(y), { threshold: -26, ratio: 2.8, knee: 8, attack: 0.008, release: 0.15, makeup: 4 });
  const speechDb = () => {
    let e = 0;
    let c = 0;
    for (let i = 0; i < lev.length; i++) if (speechMask[i] > 0.9) {
      e += lev[i] * lev[i];
      c++;
    }
    return gainToDb(Math.sqrt(e / Math.max(1, c)));
  };
  const fast = compress(lev, { threshold: speechDb() + 7, ratio: 4, knee: 4, attack: 0.001, release: 0.06, detector: 0.0003 });
  const copy = Float32Array.from(fast);
  limit(fast, copy, { ceilingDb: speechDb() + 12.5, lookahead: 0.002, release: 0.05 });
  return fast;
}

// 0..1 "narrator is speaking" curve: framed RMS gate, opened a little early, smoothed both ways
function voiceActivity(x) {
  const hop = 480;
  const frames = Math.ceil(x.length / hop);
  const rms = new Float32Array(frames);
  for (let f = 0; f < frames; f++) rms[f] = rmsOf(x, f * hop, Math.min(x.length, (f + 1) * hop));
  const thr = Math.max(...rms) * dbToGain(-38);
  const on = new Uint8Array(frames);
  const ahead = 12;
  const hold = 18;
  for (let f = 0; f < frames; f++) if (rms[f] > thr) for (let k = Math.max(0, f - ahead); k <= Math.min(frames - 1, f + hold); k++) on[k] = 1;
  const aAtt = Math.exp(-1 / (0.05 * SR));
  const aRel = Math.exp(-1 / (0.35 * SR));
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const g = on[Math.floor(i / hop)];
    y = g + (g > y ? aAtt : aRel) * (y - g);
    out[i] = y;
  }
  return out;
}

log("voice: processing");
const speaking = voiceActivity(voiceRaw);
const voice = processVoice(voiceRaw, speaking);
const plate = makeIR({ seconds: 1.4, rt60: 0.75, rtLowMul: 0.9, rtHighMul: 0.6, predelay: 0.018, seed: 31, early: 8, bright: 6500 });
const voiceVerb = convolveCircular(voice, plate);
const voiceBus = new Bus(N);
const vv = dbToGain(LEVELS.voiceVerbDb);
for (let i = 0; i < N; i++) {
  voiceBus.L[i] = voice[i] + voiceVerb.L[i] * vv;
  voiceBus.R[i] = voice[i] + voiceVerb.R[i] * vv;
}
let vAct = 0;
let vCount = 0;
for (let i = 0; i < N; i++) if (speaking[i] > 0.9) {
  vAct += voice[i] * voice[i];
  vCount++;
}
const voiceRms = Math.sqrt(vAct / Math.max(1, vCount));

// ---------------------------------------------------------------- music
log("music: rendering score");
const music = renderMusic(cues, N);
const musicRms = Math.max(rmsOf(music.L), rmsOf(music.R));
const musicGain = (voiceRms * dbToGain(LEVELS.musicUnderVoiceDb)) / musicRms;

// ---------------------------------------------------------------- effects
log(`sfx: ${cues.sfx.length} cues`);
const sfxRegular = new Bus(N);
const sfxHits = Object.fromEntries(Object.keys(LEVELS.hitDuckDb).map((k) => [k, new Bus(N)]));
const sfxSend = new Float32Array(N);
cues.sfx.forEach((e, idx) => {
  const gen = SFX[e.name];
  if (!gen) throw new Error(`no SFX generator for "${e.name}"`);
  const out = gen(e, rng(seedOf("sfx", e.name, e.seed ?? idx, e.t.toFixed(3))));
  const g = dbToGain(e.gain + LEVELS.sfxOffsetDb);
  const start = Math.round(e.t * SR);
  (sfxHits[e.name] ?? sfxRegular).addStereo(start, out.L, out.R, g);
  const m = new Float32Array(out.L.length);
  for (let i = 0; i < m.length; i++) m[i] = 0.5 * (out.L[i] + out.R[i]);
  addCircular(sfxSend, start, m, g * out.send);
});
const hall = makeIR({ seconds: 3.6, rt60: 2.4, predelay: 0.022, seed: 11 });
const sfxVerb = convolveCircular(sfxSend, hall);

// ---------------------------------------------------------------- ambience
log(`ambience: ${cues.ambience.length} beds`);
const amb = new Bus(N);
const ambSend = new Float32Array(N);
for (const a of cues.ambience) {
  const len = Math.max(1, Math.round((a.end - a.start) * SR));
  const bed = ambienceBed(a.name, len, rng(seedOf("amb", a.name, a.start.toFixed(3))));
  const env = spanEnvelope(len, Math.min(0.8, (a.end - a.start) / 3), Math.min(1.0, (a.end - a.start) / 3));
  const g = dbToGain(a.gain + LEVELS.ambOffsetDb);
  for (let i = 0; i < len; i++) {
    bed.L[i] *= env[i] * g;
    bed.R[i] *= env[i] * g;
  }
  const start = Math.round(a.start * SR);
  amb.addStereo(start, bed.L, bed.R, 1);
  const m = new Float32Array(len);
  for (let i = 0; i < len; i++) m[i] = 0.5 * (bed.L[i] + bed.R[i]);
  addCircular(ambSend, start, m, a.name === "dawn" ? 0.35 : 0.12);
}
const ambVerb = convolveCircular(ambSend, hall);

// ---------------------------------------------------------------- mix
log("mix: ducking and summing");
const stems = { voice: new Bus(N), music: new Bus(N), sfx: new Bus(N), ambience: new Bus(N) };
for (let i = 0; i < N; i++) {
  const s = speaking[i];
  const gm = musicGain * dbToGain(LEVELS.musicDuckDb * s);
  const gs = dbToGain(LEVELS.sfxDuckDb * s);
  const ga = dbToGain(LEVELS.ambDuckDb * s);
  stems.voice.L[i] = voiceBus.L[i];
  stems.voice.R[i] = voiceBus.R[i];
  stems.music.L[i] = music.L[i] * gm;
  stems.music.R[i] = music.R[i] * gm;
  let sl = (sfxRegular.L[i] + sfxVerb.L[i] * 0.5) * gs;
  let sr = (sfxRegular.R[i] + sfxVerb.R[i] * 0.5) * gs;
  for (const [name, bus] of Object.entries(sfxHits)) {
    const gh = dbToGain(LEVELS.hitDuckDb[name] * s);
    sl += bus.L[i] * gh;
    sr += bus.R[i] * gh;
  }
  stems.sfx.L[i] = sl;
  stems.sfx.R[i] = sr;
  stems.ambience.L[i] = (amb.L[i] + ambVerb.L[i] * 0.4) * ga;
  stems.ambience.R[i] = (amb.R[i] + ambVerb.R[i] * 0.4) * ga;
}
const L = new Float32Array(N);
const R = new Float32Array(N);
for (const b of Object.values(stems)) for (let i = 0; i < N; i++) {
  L[i] += b.L[i];
  R[i] += b.R[i];
}

// infrasonic clean-up: brown-noise rumbles and drones carry useless energy below 20 Hz
for (const ch of [L, R]) {
  filter(ch, "highpass", 28, 0.707);
  filter(ch, "highpass", 28, 0.707);
}

// the 0.5 s held breath before "God stopped Abraham's hand" must be near silent (bed only)
const sil = cues.music.sections.find((s) => s.name === "silence");
const bedOnly = (from, to) => {
  let e = 0;
  for (let i = Math.round(from * SR); i < Math.round(to * SR); i++) {
    const l = stems.music.L[i] + stems.sfx.L[i] + stems.ambience.L[i];
    const r = stems.music.R[i] + stems.sfx.R[i] + stems.ambience.R[i];
    e += (l * l + r * r) / 2;
  }
  return gainToDb(Math.sqrt(e / Math.max(1, Math.round((to - from) * SR))));
};

// ---------------------------------------------------------------- master
// limiting lowers loudness a little, so settle the ceiling over two passes on a copy, then apply
const pre = loudnessLUFS(L, R);
let gainToTarget = LEVELS.target.I - pre;
{
  const tL = Float32Array.from(L);
  const tR = Float32Array.from(R);
  limit(tL, tR, { ceilingDb: LEVELS.limiterCeilingDb - gainToTarget });
  gainToTarget = LEVELS.target.I - loudnessLUFS(tL, tR);
}
log(`master: pre-limit loudness ${pre.toFixed(2)} LUFS, true-peak limiting at ${(LEVELS.limiterCeilingDb - gainToTarget).toFixed(2)} dBFS`);
const lim = limit(L, R, { ceilingDb: LEVELS.limiterCeilingDb - gainToTarget });
const g = dbToGain(gainToTarget);
for (let i = 0; i < N; i++) {
  L[i] *= g;
  R[i] *= g;
}
const premaster = join(audioDir, "_premaster.wav");
const tail = Math.round(1.0 * SR); // circular continuation: loudnorm/resampler latency never eats the ending
const wrapTail = (x) => {
  const y = new Float32Array(N + tail);
  y.set(x);
  y.set(x.subarray(0, tail), N);
  return y;
};
writeWav(premaster, [wrapTail(L), wrapTail(R)], SR, { float: true });

function ffmpeg(args) {
  const p = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (p.status !== 0) throw new Error(`ffmpeg failed: ${p.stderr.slice(-2000)}`);
  return p.stderr;
}
const lastJson = (s) => JSON.parse(s.slice(s.lastIndexOf("{"), s.lastIndexOf("}") + 1));
const { I, TP, LRA } = LEVELS.target;
log("loudnorm pass 1");
const m1 = lastJson(ffmpeg(["-i", premaster, "-af", `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`, "-f", "null", "-"]));
log("loudnorm pass 2");
const finalPath = join(audioDir, "final_mix.wav");
const m2 = lastJson(ffmpeg([
  "-y", "-i", premaster, "-af",
  `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${m1.input_i}:measured_TP=${m1.input_tp}:measured_LRA=${m1.input_lra}:measured_thresh=${m1.input_thresh}:offset=${m1.target_offset}:linear=true:print_format=json,aresample=${SR}:resampler=soxr:precision=28,atrim=end_sample=${N}`,
  "-ar", String(SR), "-ac", "2", "-c:a", "pcm_s24le", finalPath,
]));
unlinkSync(premaster);

// ---------------------------------------------------------------- verify
log("verify");
const eb = ffmpeg(["-i", finalPath, "-filter_complex", "ebur128=peak=true", "-f", "null", "-"]);
const summary = eb.slice(eb.lastIndexOf("Summary:"));
const num = (re) => Number((re.exec(summary) || [])[1]);
const fin = readWav(finalPath);
let finite = true;
let dc = 0;
for (const ch of fin.channels) for (let i = 0; i < ch.length; i++) {
  if (!Number.isFinite(ch[i])) finite = false;
  dc += ch[i];
}
const report = {
  episode,
  durationSeconds: fin.channels[0].length / SR,
  expectedSeconds: tl.durationSeconds,
  sampleRate: fin.sampleRate,
  channels: fin.channels.length,
  integratedLUFS: num(/I:\s+(-?[\d.]+) LUFS/),
  truePeakDBTP: num(/Peak:\s+(-?[\d.]+) dBFS/),
  loudnessRangeLU: num(/LRA:\s+(-?[\d.]+) LU/),
  loudnormType: m2.normalization_type,
  loudnorm: { pass1: m1, pass2: m2 },
  samplePeak: peakOf(...fin.channels),
  dcOffset: dc / (fin.channels.length * fin.channels[0].length),
  finite,
  limiter: { over1dB: Number(lim.over1dB.toFixed(4)), over3dB: Number(lim.over3dB.toFixed(4)), maxReductionDb: Number(lim.maxReductionDb.toFixed(2)) },
  // measured on the music+sfx+ambience stems, at final (post-master) level
  nearSilence: { start: sil.start, end: sil.end, bedRmsDbfs: Number((bedOnly(sil.start + 0.05, sil.end - 0.05) + gainToTarget + Number(m2.target_offset)).toFixed(1)) },
  levels: LEVELS,
  voiceRmsDbfs: Number(gainToDb(voiceRms).toFixed(1)),
  musicGainDb: Number(gainToDb(musicGain).toFixed(1)),
  cues: { sfx: cues.sfx.length, ambience: cues.ambience.length, musicSections: cues.music.sections.length },
  renderSeconds: (Date.now() - t0) / 1000,
};
writeFileSync(join(audioDir, "mix_report.json"), JSON.stringify(report, null, 2));

if (writeStems) {
  const dir = join(audioDir, "stems");
  mkdirSync(dir, { recursive: true });
  const k = dbToGain(gainToTarget);
  for (const [name, b] of Object.entries(stems)) writeWav(join(dir, `${name}.wav`), [b.L.map((x) => x * k), b.R.map((x) => x * k)]);
}
log(`done: ${report.integratedLUFS} LUFS, TP ${report.truePeakDBTP} dBTP, ${report.durationSeconds.toFixed(3)} s, loudnorm ${report.loudnormType}, held-breath bed ${report.nearSilence.bedRmsDbfs} dBFS`);
