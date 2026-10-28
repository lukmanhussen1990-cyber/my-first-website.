// Renders the music and SFX stems, mixes them under the narration and normalizes the final mix.
// Run from the episode folder: npm run audio   (= node tools/synth/build_audio.mjs; needs ffmpeg)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeBeats } from '../../src/beats.mjs';
import { SR, TAU, readAudio, writeWavFloat, integratedLufs, limitTruePeak, truePeakDb, db, toDb } from './dsp.mjs';
import { renderMusic } from './music.mjs';
import { renderSfx } from './sfx.mjs';

const EP = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const P = (...p) => join(EP, ...p);
const TARGET_I = -14, TARGET_TP = -1, TARGET_LRA = 15;
const MUSIC_UNDER_VOICE = 2.5;   // LU below the voice before ducking
const SFX_UNDER_VOICE = 6.5;     // LU below the voice (gated, so this is set by the loud moments)
const DUCK = { music: 8, beds: 10, hits: 5 }; // dB of reduction while the voice speaks
const GUARD = 12;                // music and SFX each stay at least this many dB under the voice while it speaks
const GUARD_MAX = 10;             // ...but never pull more than this on top of the ducking (no pumping)
const HOP = 480;                 // 10 ms analysis hop
const log = (...a) => console.log(...a);

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr.slice(-2000)}`);
  return r.stderr;
}
const lastJson = (txt) => JSON.parse(txt.slice(txt.lastIndexOf('{'), txt.lastIndexOf('}') + 1));

// Move the pre-roll (t in [-pre, 0)) onto the end with an equal-power crossfade, so the last sample
// flows straight into the first one when the reel loops.
function foldPreroll(bus, N) {
  const preN = bus.index(0);
  if (preN + N > bus.n) throw new Error(`bus shorter than timeline (${bus.n} < ${preN + N})`);
  const L = bus.L.slice(preN, preN + N), R = bus.R.slice(preN, preN + N);
  for (let k = 0; k < preN; k++) {
    const i = N - preN + k, w = (k + 0.5) / preN;
    const a = Math.cos((w * Math.PI) / 2), c = Math.sin((w * Math.PI) / 2);
    L[i] = L[i] * a + bus.L[k] * c;
    R[i] = R[i] * a + bus.R[k] * c;
  }
  return [L, R];
}

// Gentle VO compressor (peak detector with 2 ms look-ahead, soft knee). TTS peaks are spiky; taming
// them here means the master limiter barely has to work.
function compressVoice(v, { thr = -19, ratio = 3, knee = 6, att = 0.002, rel = 0.12, look = 0.002 } = {}) {
  const n = v.length, out = new Float32Array(n), L = Math.round(look * SR);
  const aa = Math.exp(-1 / (att * SR)), ra = Math.exp(-1 / (rel * SR));
  let env = 0, maxGr = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.abs(v[Math.min(n - 1, i + L)]);
    env = x > env ? aa * env + (1 - aa) * x : ra * env + (1 - ra) * x;
    const over = toDb(env) - thr;
    let gr = 0;
    if (over > knee / 2) gr = over * (1 - 1 / ratio);
    else if (over > -knee / 2) gr = ((over + knee / 2) ** 2 / (2 * knee)) * (1 - 1 / ratio);
    out[i] = v[i] * db(-gr);
    if (gr > maxGr) maxGr = gr;
  }
  return { out, maxGr };
}

// Voice activity per 10 ms hop, plus a smoothed per-sample version (40 ms look-ahead, ~80 ms attack,
// ~350 ms release) that drives the ducking.
function voiceActivity(v, N) {
  const frames = Math.ceil(N / HOP), act = new Uint8Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const a = f * HOP, e = Math.min(N, a + HOP);
    for (let i = a; i < e; i++) s += v[i] * v[i];
    act[f] = toDb(Math.sqrt(s / Math.max(1, e - a))) > -50 ? 1 : 0;
  }
  const look = Math.round(0.04 * SR), d = new Float32Array(N);
  const at = 1 - Math.exp(-1 / (0.08 * SR)), rt = 1 - Math.exp(-1 / (0.35 * SR));
  let y = 0;
  for (let i = 0; i < N; i++) {
    const x = act[Math.min(frames - 1, Math.floor(Math.min(N - 1, i + look) / HOP))];
    y += (x > y ? at : rt) * (x - y);
    d[i] = y;
  }
  return { act, d };
}

// Short-term level (dB RMS over a 0.3 s centered window) per hop, averaged over channels.
function shortTermDb(chs, N, win = Math.round(0.3 * SR)) {
  const pre = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    let p = 0;
    for (const c of chs) p += c[i] * c[i];
    pre[i + 1] = pre[i] + p / chs.length;
  }
  const frames = Math.ceil(N / HOP), out = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const c = f * HOP + HOP / 2, a = Math.max(0, Math.round(c - win / 2)), e = Math.min(N, Math.round(c + win / 2));
    out[f] = 10 * Math.log10(Math.max(1e-12, (pre[e] - pre[a]) / Math.max(1, e - a)));
  }
  return out;
}

// Voice level while it speaks: average power of the active 10 ms frames within ±0.5 s (silent gaps
// between words don't count), so the guard follows phrases, not syllables.
function phraseDb(v, act, N) {
  const frames = act.length, pw = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    let s2 = 0;
    const a = f * HOP, e = Math.min(N, a + HOP);
    for (let i = a; i < e; i++) s2 += v[i] * v[i];
    pw[f] = s2 / Math.max(1, e - a);
  }
  const out = new Float32Array(frames), W = 50;
  for (let f = 0; f < frames; f++) {
    let sum = 0, n = 0;
    for (let k = Math.max(0, f - W); k <= Math.min(frames - 1, f + W); k++) if (act[k]) { sum += pw[k]; n++; }
    out[f] = n ? 10 * Math.log10(sum / n) : -120;
  }
  return out;
}

// Extra gain reduction (dB, per sample) so a bed never comes within GUARD dB of the voice while it speaks.
function guardCurve(vdb, bdb, act, N) {
  const frames = vdb.length, need = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const speaking = act[f] || act[Math.min(frames - 1, f + 4)];
    need[f] = speaking ? Math.min(GUARD_MAX, Math.max(0, bdb[f] - (vdb[f] - GUARD))) : 0;
  }
  const g = new Float32Array(N), at = 1 - Math.exp(-1 / (0.06 * SR)), rt = 1 - Math.exp(-1 / (0.5 * SR));
  let y = 0;
  for (let i = 0; i < N; i++) {
    const x = need[Math.min(frames - 1, Math.floor((i + Math.round(0.03 * SR)) / HOP))];
    y += (x > y ? at : rt) * (x - y);
    g[i] = y;
  }
  return g;
}

function goertzelPower(x, from, to, f) {
  const w = (TAU * f) / SR, c = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = from; i < to; i++) {
    const s = x[i] + c * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  return s1 * s1 + s2 * s2 - c * s1 * s2;
}

function main() {
  const tl = JSON.parse(readFileSync(P('timeline.json'), 'utf8'));
  const b = computeBeats(tl);
  const N = Math.round((tl.durationInFrames / tl.fps) * SR);
  mkdirSync(P('audio', 'stems'), { recursive: true });
  mkdirSync(P('audio', 'work'), { recursive: true });
  mkdirSync(P('public', 'audio'), { recursive: true });

  // ---- voice ----
  const vRaw = readAudio(P('audio', 'voice_track.wav'), 1)[0];
  const vPad = new Float32Array(N);
  vPad.set(vRaw.subarray(0, Math.min(N, vRaw.length)));
  const comp = compressVoice(vPad);
  const voice = comp.out;
  const Lv = integratedLufs([voice, voice]);
  log(`voice: ${(vRaw.length / SR).toFixed(3)} s -> ${N} samples, compressor max ${comp.maxGr.toFixed(1)} dB, centered loudness ${Lv.toFixed(2)} LUFS`);

  // ---- stems ----
  log('rendering music...');
  const m = renderMusic(b, tl);
  const [mL, mR] = foldPreroll(m.bus, N);
  log('rendering sfx...');
  const s = renderSfx(b, tl);
  const [bL, bR] = foldPreroll(s.beds, N);
  const [hL, hR] = foldPreroll(s.hits, N);

  const Lm = integratedLufs([mL, mR]);
  const gm = db(Lv - MUSIC_UNDER_VOICE - Lm);
  const sumL = new Float32Array(N), sumR = new Float32Array(N);
  for (let i = 0; i < N; i++) { sumL[i] = bL[i] + hL[i]; sumR[i] = bR[i] + hR[i]; }
  const Ls = integratedLufs([sumL, sumR]);
  const gs = db(Lv - SFX_UNDER_VOICE - Ls);
  log(`music ${Lm.toFixed(2)} LUFS (gain ${toDb(gm).toFixed(1)} dB), sfx ${Ls.toFixed(2)} LUFS (gain ${toDb(gs).toFixed(1)} dB)`);

  // ---- duck (voice sidechain) + intelligibility guard ----
  const { act, d } = voiceActivity(voice, N);
  const base = (aL, aR, g, duck) => {
    const oL = new Float32Array(N), oR = new Float32Array(N);
    for (let i = 0; i < N; i++) { const k = g * db(-duck * d[i]); oL[i] = aL[i] * k; oR[i] = aR[i] * k; }
    return [oL, oR];
  };
  const [mdL, mdR] = base(mL, mR, gm, DUCK.music);
  const [bdL, bdR] = base(bL, bR, gs, DUCK.beds);
  const [hdL, hdR] = base(hL, hR, gs, DUCK.hits);
  const vdb = phraseDb(voice, act, N);
  const guardM = guardCurve(vdb, shortTermDb([mdL, mdR], N, Math.round(0.4 * SR)), act, N);
  const sfxSum = [new Float32Array(N), new Float32Array(N)];
  for (let i = 0; i < N; i++) { sfxSum[0][i] = bdL[i] + hdL[i]; sfxSum[1][i] = bdR[i] + hdR[i]; }
  const guardS = guardCurve(vdb, shortTermDb(sfxSum, N, Math.round(0.4 * SR)), act, N);
  let gmMax = 0, gsMax = 0;
  const L = new Float32Array(N), R = new Float32Array(N), musicMix = new Float32Array(N), sfxMix = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const kM = db(-guardM[i]), kS = db(-guardS[i]);
    gmMax = Math.max(gmMax, guardM[i]);
    gsMax = Math.max(gsMax, guardS[i]);
    const ml = mdL[i] * kM, mr = mdR[i] * kM, sl = (bdL[i] + hdL[i]) * kS, sr = (bdR[i] + hdR[i]) * kS;
    L[i] = voice[i] + ml + sl;
    R[i] = voice[i] + mr + sr;
    musicMix[i] = 0.5 * (ml + mr);
    sfxMix[i] = 0.5 * (sl + sr);
  }
  log(`ducking: music -${DUCK.music} dB, beds -${DUCK.beds} dB, hits -${DUCK.hits} dB; guard extra max: music ${gmMax.toFixed(1)} dB, sfx ${gsMax.toFixed(1)} dB`);

  // ---- pre-master: level to target, true-peak limit so loudnorm can stay linear ----
  const L0 = integratedLufs([L, R]);
  const gPre = db(TARGET_I - L0);
  for (let i = 0; i < N; i++) { L[i] *= gPre; R[i] *= gPre; }
  const tpBefore = truePeakDb([L, R]);
  const limited = limitTruePeak([L, R], -1.6, 0.005, 0.09);
  // matching 8 ms fades at both ends: playback starts from silence without a click, and the loop
  // seam becomes a tiny 16 ms dip instead of a step
  const fade = Math.round(0.008 * SR);
  for (let k = 0; k < fade; k++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * (k + 0.5)) / fade);
    L[k] *= g; R[k] *= g;
    L[N - 1 - k] *= g; R[N - 1 - k] *= g;
  }
  log(`pre-master: ${L0.toFixed(2)} -> ${TARGET_I} LUFS (gain ${toDb(gPre).toFixed(2)} dB), TP before limit ${tpBefore.toFixed(2)} dBTP, limiter max ${limited.maxGrDb.toFixed(2)} dB at ${limited.maxAt.toFixed(2)}s, >0.5 dB on ${(limited.over05 * 100).toFixed(2)}% of samples`);
  const premaster = P('audio', 'work', 'premaster.wav');
  writeWavFloat(premaster, [L, R]);

  // stems at their mix level (before ducking), float WAV so nothing clips
  const stem = (a, g) => { const o = new Float32Array(N); for (let i = 0; i < N; i++) o[i] = a[i] * g * gPre; return o; };
  writeWavFloat(P('audio', 'stems', 'music.wav'), [stem(mL, gm), stem(mR, gm)]);
  writeWavFloat(P('audio', 'stems', 'sfx.wav'), [stem(sumL, gs), stem(sumR, gs)]);

  // ---- loudnorm, two passes ----
  const ln = `loudnorm=I=${TARGET_I}:TP=${TARGET_TP}:LRA=${TARGET_LRA}`;
  const p1 = lastJson(ffmpeg(['-i', premaster, '-af', `${ln}:print_format=json`, '-f', 'null', '-']));
  const measured = `measured_I=${p1.input_i}:measured_TP=${p1.input_tp}:measured_LRA=${p1.input_lra}:measured_thresh=${p1.input_thresh}:offset=${p1.target_offset}`;
  const finalMix = P('audio', 'final_mix.wav');
  const p2 = lastJson(ffmpeg(['-y', '-i', premaster, '-af',
    `${ln}:${measured}:linear=true:print_format=json,aresample=${SR}:resampler=soxr,apad=whole_len=${N},atrim=end_sample=${N}`,
    '-ar', String(SR), '-c:a', 'pcm_s24le', finalMix]));
  log(`loudnorm pass 1: I ${p1.input_i} TP ${p1.input_tp} LRA ${p1.input_lra}; pass 2 mode: ${p2.normalization_type}`);

  // ---- verify ----
  const eb = ffmpeg(['-i', finalMix, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
  const summary = eb.slice(eb.lastIndexOf('Summary:'));
  const num = (re) => parseFloat(summary.match(re)?.[1]);
  const I = num(/I:\s+(-?[\d.]+) LUFS/), LRA = num(/LRA:\s+([\d.]+) LU/), TP = num(/Peak:\s+(-?[\d.]+) dBFS/);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=sample_rate,channels,codec_name,duration_ts', '-of', 'json', finalMix], { encoding: 'utf8' });
  const st = JSON.parse(probe.stdout).streams[0];
  const [fL, fR] = readAudio(finalMix, 2);

  let peak = 0, dcL = 0, dcR = 0;
  for (let i = 0; i < fL.length; i++) { peak = Math.max(peak, Math.abs(fL[i]), Math.abs(fR[i])); dcL += fL[i]; dcR += fR[i]; }
  dcL /= fL.length; dcR /= fR.length;

  // voice vs music and vs sfx while speaking (speech spans from the word timings)
  const spans = [];
  for (const w of tl.words) {
    const last = spans[spans.length - 1];
    if (last && w.start - last[1] < 0.25) last[1] = w.end; else spans.push([w.start, w.end]);
  }
  const rmsDb = (x, i0, i1) => { let s2 = 0; for (let i = i0; i < i1; i++) s2 += x[i] * x[i]; return toDb(Math.sqrt(s2 / (i1 - i0))); };
  const spanDiffs = spans.map(([a, e]) => {
    const i0 = Math.round(a * SR), i1 = Math.round(e * SR), v = rmsDb(voice, i0, i1);
    return { a, e, music: v - rmsDb(musicMix, i0, i1), sfx: v - rmsDb(sfxMix, i0, i1) };
  });
  const sorted = (k) => spanDiffs.map((x) => x[k]).sort((x, y) => x - y);
  const med = (k) => sorted(k)[Math.floor(spanDiffs.length / 2)], worst = (k) => sorted(k)[0];
  const worstSpan = (k) => spanDiffs.reduce((p, c) => (c[k] < p[k] ? c : p));

  const gaps = [];
  for (let k = 0; k + 1 < spans.length; k++) if (spans[k + 1][0] - spans[k][1] >= 0.5) gaps.push([spans[k][1] + 0.1, spans[k + 1][0] - 0.1]);
  const voiceMed = spanDiffs.map(({ a, e }) => rmsDb(voice, Math.round(a * SR), Math.round(e * SR))).sort((x, y) => x - y)[Math.floor(spans.length / 2)];
  const pauseMusic = gaps.map(([a, e]) => rmsDb(musicMix, Math.round(a * SR), Math.round(e * SR)) - voiceMed).sort((x, y) => x - y);
  const pauseMed = pauseMusic[Math.floor(pauseMusic.length / 2)];

  // key change: minor third (F) vs major third (F#) of D in the music stem
  const mono = new Float32Array(N);
  for (let i = 0; i < N; i++) mono[i] = mL[i] + mR[i];
  const thirds = (t0, t1) => {
    const i0 = Math.round(t0 * SR), i1 = Math.round(t1 * SR);
    const pc = (m0) => [0, 1, 2].reduce((acc, o) => acc + goertzelPower(mono, i0, i1, 440 * 2 ** ((m0 + 12 * o - 69) / 12)), 0);
    return { F: pc(53), Fs: pc(54) };
  };
  const minorWin = thirds(b.s7 + 2.0, b.cloakFloat - 0.3), majorWin = thirds(b.keyChange + 0.3, b.keyChange + 3.8);
  const justBefore = thirds(b.keyChange - 0.6, b.keyChange - 0.1), justAfter = thirds(b.keyChange + 0.1, b.keyChange + 0.6);
  const minorRatio = toDb(Math.sqrt(minorWin.F / minorWin.Fs)), majorRatio = toDb(Math.sqrt(majorWin.Fs / majorWin.F));
  const fsJump = toDb(Math.sqrt(justAfter.Fs / justBefore.Fs));
  const keyOk = minorRatio > 6 && majorRatio > 6 && fsJump > 6;

  // clicks: in the music and SFX stems, biggest second-difference spike near each hit vs its surroundings
  const hitsList = ['hookTitleIn', 'cloakWipe', 'enochVanish', 'badge1', 'chariotBurst', 'freeze', 'redX', 'rewind', 'heaven', 'cloakLand', 's8', 'keyChange', 'typingStart', 's11', 'loopOut'];
  const sfxMono = new Float32Array(N);
  for (let i = 0; i < N; i++) sfxMono[i] = sumL[i] + sumR[i];
  const clickRatio = (x, t) => {
    const c = Math.round(t * SR), w0 = Math.max(2, c - 2400), w1 = Math.min(N - 2, c + 2400);
    let spike = 0, ref = 0;
    for (let i = w0; i < w1; i++) { const d2 = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]); spike = Math.max(spike, d2); ref += d2 * d2; }
    return spike / Math.sqrt(ref / (w1 - w0) + 1e-30);
  };
  const clicks = hitsList.map((k) => [k, clickRatio(mono, b[k]), clickRatio(sfxMono, b[k])]);
  const clickMax = Math.max(...clicks.map(([, a, c]) => Math.max(a, c)));
  const seam = Math.max(Math.abs(fL[0] - fL[N - 1]), Math.abs(fR[0] - fR[N - 1]));

  // per-scene balance (integrated over each scene, final-mix scale)
  const sceneRows = tl.scenes.map((sc) => {
    const i0 = Math.round(sc.start * SR), i1 = Math.round(sc.end * SR), g = gPre;
    const part = (x) => { const o = x.subarray(i0, i1).map((y) => y * g); return integratedLufs([o, o]); };
    const f = (x) => (Number.isFinite(x) ? x.toFixed(1) : '—');
    return `| ${sc.id} ${sc.name} | ${sc.start.toFixed(2)}–${sc.end.toFixed(2)} | ${f(part(voice))} | ${f(part(musicMix))} | ${f(part(sfxMix))} |`;
  });

  const ok = Math.abs(I - TARGET_I) <= 0.3 && TP <= TARGET_TP + 1e-9 && st.duration_ts === N && peak < 1 && keyOk && Math.abs(dcL) < 1e-3 && Math.abs(dcR) < 1e-3;
  log(`final: I ${I} LUFS, TP ${TP} dBTP, LRA ${LRA} LU, ${st.codec_name} ${st.sample_rate} Hz ${st.channels} ch, ${st.duration_ts} samples (${(st.duration_ts / SR).toFixed(4)} s)`);
  log(`while speaking, voice over music: median ${med('music').toFixed(1)} dB, worst ${worst('music').toFixed(1)} dB (${worstSpan('music').a.toFixed(2)}s); over sfx: median ${med('sfx').toFixed(1)} dB, worst ${worst('sfx').toFixed(1)} dB (${worstSpan('sfx').a.toFixed(2)}s)`);
  log(`in the ${gaps.length} pauses >= 0.5 s, music sits a median ${(-pauseMed).toFixed(1)} dB under the voice's speaking level`);
  const fz = Math.round(b.freeze * SR), w300 = Math.round(0.3 * SR), w50 = Math.round(0.05 * SR);
  const freezeDrop = rmsDb(musicMix, fz - w300, fz - w50) - rmsDb(musicMix, fz + w50, fz + w300);
  log(`freeze at ${b.freeze}s: music drops ${freezeDrop.toFixed(1)} dB`);
  log(`key: S7 F over F# ${minorRatio.toFixed(1)} dB, S9 F# over F ${majorRatio.toFixed(1)} dB, F# jump at ${b.keyChange}s ${fsJump.toFixed(1)} dB -> ${keyOk ? 'D minor -> D major OK' : 'CHECK'}`);
  log(`sample peak ${toDb(peak).toFixed(2)} dBFS, DC L ${dcL.toExponential(1)} R ${dcR.toExponential(1)}, loop seam step ${seam.toExponential(2)}`);
  log(`click ratios music/sfx (max |d2| / rms |d2| in ±50 ms): ${clicks.map(([k, a, c]) => `${k} ${a.toFixed(1)}/${c.toFixed(1)}`).join(', ')}`);
  log(['| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |', '|---|---|---|---|---|', ...sceneRows].join('\n'));
  if (!ok) throw new Error('final mix failed a check (see above)');

  copyFileSync(finalMix, P('public', 'audio', 'final_mix.wav'));

  writeFileSync(P('audio', 'MIX_NOTES.md'), `# Mix notes: They Never Died

Built by \`npm run audio\` (tools/synth/build_audio.mjs). It is deterministic: seeded noise and no
timers, so the same inputs always give the same file. Every hit comes from \`src/beats.mjs\`, so re-run
after changing beats or the timeline.

## Stems (48 kHz stereo, 32-bit float, at mix level before ducking)

- \`audio/stems/music.wav\`: the score. It has pads, felt piano, a low D drone, strings (tremolo in S4),
  a formant choir, a brass-like stab, sub hits, cymbal swells and a 4.4 s hall reverb.
  - It is in D minor until **${b.keyChange.toFixed(2)} s** ("And Jesus made a promise"), then D major.
  - S4 drives with an ostinato and taiko-like hits into a hard stop at the freeze (${b.freeze.toFixed(2)} s).
  - The S5 freeze has a filtered drone and a reverse swell into the rewind (${b.rewind.toFixed(2)} s).
  - S6 is a slow replay, then a crescendo that peaks in F major on "heaven" (${b.heaven.toFixed(2)} s).
  - S7 is near silence while the cloak falls. S8 is a bright choir on D (sus2 / G-over-D, a hint of F#).
  - S9 is a full D-major swell on "never die". S11 resolves on D major.
- \`audio/stems/sfx.wav\`:
  - S1: the hook whirlwind and cloak flutters.
  - S2: Enoch's steps, which simply stop, a light shimmer and badge chimes.
  - S3–S4: Jordan river and wind, plus heavy Elijah and light Elisha steps.
  - Chariot: a whoosh, a boom, a fire roar, crackles and two horses galloping. The thumps use a 0.45 s
    stride from chariotBurst. Everything cuts at the freeze.
  - S5: paper whoosh, stamp hit and tape rewind.
  - S6: slowed roar and hooves during the replay, then the whirlwind howl and a circling rumble.
  - S7: soft wind, the cloak's flutter and a soft landing, then a shimmer into S8.
  - S10: typing taps (${b.typingCps} per second, spaces skipped) and heart pops.

## Loop seam

The opening whirlwind, pad and drone start 0.6 s before t = 0. That pre-roll is cross-faded onto the
last 0.6 s (from loopOut = ${b.loopOut.toFixed(2)} s), so the end flows into the start. Matching 8 ms
fades at both ends avoid a click on first play; at the loop point they make a 16 ms dip.

## Mix

- **Voice:** a gentle compressor (3:1, soft knee, −19 dBFS threshold, max ${comp.maxGr.toFixed(1)} dB), centered.
- **Levels:** music sits ${MUSIC_UNDER_VOICE} LU under the voice and SFX sit ${SFX_UNDER_VOICE} LU under (gated).
- **Ducking from the voice:** 40 ms look-ahead, about 80 ms attack and 350 ms release. Music drops
  ${DUCK.music} dB, ambience beds ${DUCK.beds} dB and hits ${DUCK.hits} dB.
- **Intelligibility guard:** music and SFX each stay at least ${GUARD} dB under the voice's phrase level while
  it speaks, capped at ${GUARD_MAX} dB extra. Measured extra: up to ${gmMax.toFixed(1)} dB for music and ${gsMax.toFixed(1)} dB for SFX.
- **While speaking:** the voice is a median ${med('music').toFixed(1)} dB over the music (worst phrase
  ${worst('music').toFixed(1)} dB) and ${med('sfx').toFixed(1)} dB over the SFX (worst ${worst('sfx').toFixed(1)} dB).
- **In the pauses** (${gaps.length} gaps of 0.5 s or more) the music comes up to a median ${(-pauseMed).toFixed(1)} dB under the voice's speaking level.
- **Pre-master:** levelled to −14 LUFS, then a true-peak limiter at −1.6 dBTP (max ${limited.maxGrDb.toFixed(1)} dB
  of reduction, more than 0.5 dB on ${(limited.over05 * 100).toFixed(2)}% of samples).
- **Loudnorm:** two passes (I −14, TP −1, LRA ${TARGET_LRA}). Pass 2 ran in **${p2.normalization_type}** mode.

## Final mix (\`audio/final_mix.wav\`, copied to \`public/audio/final_mix.wav\`)

| Measure | Value |
|---|---|
| Integrated loudness | ${I} LUFS |
| True peak | ${TP} dBTP |
| Loudness range | ${LRA} LU |
| Format | ${st.codec_name}, ${st.sample_rate} Hz, ${st.channels} channels |
| Length | ${st.duration_ts} samples = ${(st.duration_ts / SR).toFixed(4)} s (timeline ${tl.durationInSeconds} s, ${tl.durationInFrames} frames) |
| Sample peak | ${toDb(peak).toFixed(2)} dBFS |
| DC offset | ${dcL.toExponential(1)} / ${dcR.toExponential(1)} |
| Key check | F over F# in S7 is ${minorRatio.toFixed(1)} dB; F# over F after ${b.keyChange.toFixed(2)} s is ${majorRatio.toFixed(1)} dB; F# rises ${fsJump.toFixed(1)} dB across the change |
| Freeze | music drops ${freezeDrop.toFixed(1)} dB across the hard stop at ${b.freeze.toFixed(2)} s |
| Clicks | largest second-difference spike near any hit is ${clickMax.toFixed(1)}× its local RMS (no hard discontinuities) |

## Balance per scene (integrated, final scale)

| Scene | Time (s) | Voice LUFS | Music LUFS | SFX LUFS |
|---|---|---|---|---|
${sceneRows.join('\n')}
`);
  log('wrote audio/final_mix.wav, public/audio/final_mix.wav, audio/stems/*.wav, audio/MIX_NOTES.md');
}

main();
