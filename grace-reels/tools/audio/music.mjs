// Grace in Motion: the score, made in code. D major, about 70 BPM.
// Instruments: warm analog-style pads, felt piano, low drone, soft heartbeat pulse,
// synth choir ("ah") and small bells, all through one long synthetic hall.
// The arrangement is placed from the episode cues (sections + word times), and the timeline is
// circular: the closing chord rings across the loop point straight into the opening.

import {
  SR, TAU, Bus, rng, seedOf, rand, note, clamp, rise, dbToGain, polyblep, SVF, Biquad, Pink, Drift,
  automation, makeIR, convolveCircular, addCircular, rmsOf,
} from "./dsp.mjs";

// ---------------------------------------------------------------- instruments

function envelope(t, dur, attack, release) {
  let e = t < attack ? Math.pow(Math.sin((0.5 * Math.PI * t) / attack), 2) : 1;
  if (t > dur) e *= Math.pow(Math.cos(0.5 * Math.PI * Math.min(1, (t - dur) / release)), 2);
  return e;
}

// six detuned band-limited saws (3 per side) through a gentle low-pass, plus a sine body
function padVoice({ freq, dur, attack = 1.6, release = 2.2, cutoff = 1400, cutoffEnd, detune = 7, seed, body = 0.3 }) {
  const r = rng(seed);
  const n = Math.round((dur + release) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const osc = [];
  for (let side = 0; side < 2; side++) {
    for (let k = 0; k < 3; k++) {
      const cents = (k - 1) * detune + (side ? 2.1 : -2.1) + rand(r, -1.2, 1.2);
      osc.push({ side, inc: (freq * Math.pow(2, cents / 1200)) / SR, ph: r(), lfo: rand(r, 0.07, 0.16), lph: r() * TAU });
    }
  }
  const fl = new SVF();
  const fr = new SVF();
  const ce = cutoffEnd ?? cutoff;
  const lfo = r() * TAU;
  let bph = r() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = envelope(t, dur, attack, release);
    if ((i & 31) === 0) {
      const c = cutoff * Math.pow(ce / cutoff, Math.min(1, t / Math.max(dur, 0.01))) * (1 + 0.1 * Math.sin(TAU * 0.11 * t + lfo)) * (0.75 + 0.25 * env);
      fl.set(c, 0.65);
      fr.set(c * 1.03, 0.65);
    }
    let sl = 0;
    let sr = 0;
    for (let o = 0; o < 6; o++) {
      const os = osc[o];
      const dt = os.inc * (1 + 0.0011 * Math.sin(TAU * os.lfo * t + os.lph));
      os.ph += dt;
      if (os.ph >= 1) os.ph -= 1;
      const v = 2 * os.ph - 1 - polyblep(os.ph, dt);
      if (os.side) sr += v;
      else sl += v;
    }
    fl.tick(sl * 0.33);
    fr.tick(sr * 0.33);
    bph += (TAU * freq) / SR;
    const b = Math.sin(bph) * body;
    L[i] = (fl.lp + b) * env;
    R[i] = (fr.lp + b) * env;
  }
  return { L, R };
}

const VOWELS = {
  ah: [[750, 1.0, 90], [1150, 0.55, 110], [2600, 0.22, 160], [3300, 0.1, 200]],
  oh: [[480, 1.0, 80], [820, 0.5, 100], [2550, 0.12, 160], [3250, 0.06, 200]],
};

// a small synth choir: detuned saw voices with slow vibrato through vowel formants, plus breath
function choirVoice({ freq, dur, attack = 1.0, release = 2.6, seed, voices = 6, vowel = "ah" }) {
  const r = rng(seed);
  const n = Math.round((dur + release) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const vs = [];
  for (let v = 0; v < voices; v++) {
    vs.push({
      side: v % 2, inc: (freq * Math.pow(2, rand(r, -11, 11) / 1200)) / SR, ph: r(),
      vr: rand(r, 4.6, 5.6), vd: rand(r, 0.0025, 0.0045), vph: r() * TAU, amp: rand(r, 0.7, 1),
    });
  }
  const F = VOWELS[vowel];
  const mk = (mul) => F.map(([f, , bw]) => {
    const s = new SVF();
    s.set(f * mul, (f * mul) / bw);
    return s;
  });
  const fL = mk(1);
  const fR = mk(1.02);
  const bodyL = new SVF();
  const bodyR = new SVF();
  bodyL.set(900, 0.6);
  bodyR.set(950, 0.6);
  const nz = new Pink(r);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = envelope(t, dur, attack, release);
    const vib = rise((t - 0.25) / 0.8);
    let sl = 0;
    let sr = 0;
    for (let k = 0; k < vs.length; k++) {
      const v = vs[k];
      const dt = v.inc * (1 + v.vd * vib * Math.sin(TAU * v.vr * t + v.vph));
      v.ph += dt;
      if (v.ph >= 1) v.ph -= 1;
      const s = (2 * v.ph - 1 - polyblep(v.ph, dt)) * v.amp;
      if (v.side) sr += s;
      else sl += s;
    }
    const breath = nz.tick() * 0.25;
    let ol = 0;
    let or = 0;
    for (let k = 0; k < F.length; k++) {
      fL[k].tick(sl + breath);
      fR[k].tick(sr + breath);
      ol += fL[k].bp * F[k][1];
      or += fR[k].bp * F[k][1];
    }
    bodyL.tick(sl);
    bodyR.tick(sr);
    L[i] = (ol + bodyL.lp * 0.25) * env * 0.3;
    R[i] = (or + bodyR.lp * 0.25) * env * 0.3;
  }
  return { L, R };
}

// decaying sine via a rotating phasor (cheap, click-free), summed into x
function addDecay(x, f, amp, tau, attack, phase) {
  const w = (TAU * f) / SR;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const d = Math.exp(-1 / (tau * SR));
  const att = Math.max(1, attack * SR);
  let c = Math.cos(phase);
  let s = Math.sin(phase);
  let a = amp;
  for (let i = 0; i < x.length; i++) {
    x[i] += s * a * (i < att ? rise(i / att) : 1);
    const nc = c * cw - s * sw;
    s = c * sw + s * cw;
    c = nc;
    a *= d;
    if (a < 1e-6) break;
  }
}

// felt piano: soft hammer (dark, quick-fading highs), slightly stretched partials, two beating strings
function feltPiano({ freq, vel = 0.4, seed, hold = 4 }) {
  const r = rng(seed);
  const tau1 = clamp(3.6 * Math.pow(220 / freq, 0.5), 1.0, 7.5);
  const B = 0.00022 * Math.pow(freq / 220, 1.3);
  const nP = Math.max(3, Math.min(12, Math.floor(7000 / freq)));
  const len = Math.min(hold, tau1 * 2.6) + 0.3;
  const n = Math.round(len * SR);
  const x = new Float32Array(n);
  const dark = 0.55 - 0.25 * vel;
  for (let k = 1; k <= nP; k++) {
    const fk = k * freq * Math.sqrt(1 + B * k * k);
    if (fk > 15000) break;
    const amp = Math.pow(k, -1.15) * Math.exp(-(k - 1) * dark);
    const tau = tau1 / (1 + 0.65 * (k - 1));
    addDecay(x, fk - 0.18 * k, amp * 0.5, tau, 0.007, r() * TAU);
    addDecay(x, fk + 0.18 * k, amp * 0.5, tau * 0.96, 0.007, r() * TAU);
  }
  const lp = new Biquad("lowpass", Math.min(900, freq * 3), 0.7);
  for (let i = 0; i < Math.min(n, 0.05 * SR); i++) x[i] += lp.tick(r() * 2 - 1) * Math.exp(-i / SR / 0.012) * 0.05;
  const rel = Math.round((len - 0.3) * SR);
  for (let i = rel; i < n; i++) x[i] *= Math.pow(Math.cos((0.5 * Math.PI * (i - rel)) / (n - rel)), 2);
  const g = Math.pow(vel, 1.4);
  for (let i = 0; i < n; i++) x[i] *= g;
  return x;
}

// small bell for shimmer figures
function bellNote({ freq, vel = 0.3, seed }) {
  const r = rng(seed);
  const x = new Float32Array(Math.round(3.2 * SR));
  [[1, 1, 1.4], [2.0, 0.25, 0.7], [3.0, 0.08, 0.4], [4.1, 0.03, 0.25]].forEach(([k, a, tau]) => addDecay(x, freq * k, a * vel, tau, 0.002, r() * TAU));
  return x;
}

// low drone: sine + soft octave + filtered saw, slow breathing
function droneVoice({ freq, dur, attack = 3, release = 3, seed, saw = 0.22, cutoff = 320 }) {
  const r = rng(seed);
  const n = Math.round((dur + release) * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const lp = new SVF();
  lp.set(cutoff, 0.7);
  const br = new Drift(r, 0.08);
  let p1 = r() * TAU;
  let p2 = r() * TAU;
  let p3 = r() * TAU;
  let sp = r();
  const inc = freq / SR;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = envelope(t, dur, attack, release) * (0.85 + 0.15 * br.tick());
    p1 += (TAU * freq) / SR;
    p2 += (TAU * (freq + 0.15)) / SR;
    p3 += (TAU * freq * 2) / SR;
    sp += inc;
    if (sp >= 1) sp -= 1;
    lp.tick(2 * sp - 1 - polyblep(sp, inc));
    const common = 0.3 * Math.sin(p3) + saw * lp.lp;
    L[i] = (Math.sin(p1) + common) * env * 0.5;
    R[i] = (Math.sin(p2) + common) * env * 0.5;
  }
  return { L, R };
}

// soft heartbeat-like low pulse
function pulseHit({ vel = 1, seed }) {
  const r = rng(seed);
  const n = Math.round(0.9 * SR);
  const x = new Float32Array(n);
  const lp = new Biquad("lowpass", 200, 0.7);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (46 + 26 * Math.exp(-t / 0.05))) / SR;
    const env = rise(t / 0.005) * (0.8 * Math.exp(-t / 0.16) + 0.2 * Math.exp(-t / 0.45));
    x[i] = (Math.sin(ph) * env + lp.tick(r() * 2 - 1) * Math.exp(-t / 0.02) * 0.25) * vel;
  }
  return x;
}

// ---------------------------------------------------------------- score bookkeeping

class Score {
  constructor(N, silence) {
    this.N = N;
    this.silence = silence;
    this.A = { dry: new Bus(N), send: new Float32Array(N) }; // everything before the 0.5 s silence
    this.B = { dry: new Bus(N), send: new Float32Array(N) }; // everything after it (wraps into the intro)
  }
  part(t) {
    return t < this.silence.start ? this.A : this.B;
  }
  place(t, { L, R }, dry, send) {
    const p = this.part(t);
    const s = Math.round(t * SR);
    p.dry.addStereo(s, L, R, dry);
    const m = new Float32Array(L.length);
    for (let i = 0; i < L.length; i++) m[i] = 0.5 * (L[i] + R[i]);
    addCircular(p.send, s, m, send);
  }
  placeMono(t, x, gain, pan, dry, send) {
    const p = this.part(t);
    const s = Math.round(t * SR);
    p.dry.addMono(s, x, gain * dry, pan);
    addCircular(p.send, s, x, gain * send);
  }
}

const CH = {
  Dadd9: ["D3", "A3", "E4", "F#4"],
  Bm9: ["B2", "F#3", "C#4", "D4"],
  Gmaj7: ["G2", "D3", "F#3", "B3"],
  Asus4: ["A2", "E3", "A3", "D4"],
  A: ["A2", "E3", "A3", "C#4"],
  D: ["D3", "A3", "D4", "F#4"],
  Dopen: ["D3", "A3", "E4", "A4"],
  Bm: ["B2", "F#3", "B3", "D4"],
  DFs: ["F#2", "A2", "D3", "A3"],
  G: ["G2", "D3", "G3", "B3"],
  Em7: ["E2", "B2", "D3", "G3"],
  Dmaj9: ["D3", "F#3", "C#4", "E4"],
  Gmaj9: ["G2", "D3", "F#3", "A3"],
  Bm11: ["B2", "F#3", "A3", "E4"],
  Dbig: ["D2", "A2", "F#3", "D4", "A4"],
};

// ---------------------------------------------------------------- arrangement

export function renderMusic(cues, N) {
  const T = N / SR;
  const sec = Object.fromEntries(cues.music.sections.map((s) => [s.name, s]));
  const { boom, thinOut, peak } = cues.music.hits;
  const at = cues.at;
  const S = (id) => cues.scene(id).start;
  const romans = cues.cards.find((c) => c.beat === "b14").start;
  const score = new Score(N, sec.silence);

  const pad = (chord, start, end, o = {}) => {
    const { attack = 1.6, release = 2.2, gain = -18, cutoff = 1400, cutoffEnd, dry = 0.65, send = 0.6, body = 0.3 } = o;
    for (const nm of chord) {
      const f = note(nm);
      const v = padVoice({ freq: f, dur: Math.max(0.2, end - start), attack, release, cutoff, cutoffEnd, seed: seedOf("pad", nm, start.toFixed(3)), body: f < 160 ? body * 1.3 : body });
      const g = dbToGain(gain) * (f < 110 ? 0.7 : 1);
      score.place(start, v, g * dry, g * send);
    }
  };
  const choir = (chord, start, end, o = {}) => {
    const { attack = 1.0, release = 2.6, gain = -15, vowel = "ah", dry = 0.5, send = 0.75 } = o;
    for (const nm of chord) {
      const v = choirVoice({ freq: note(nm), dur: Math.max(0.2, end - start), attack, release, vowel, seed: seedOf("choir", nm, start.toFixed(3)) });
      score.place(start, v, dbToGain(gain) * dry, dbToGain(gain) * send);
    }
  };
  const piano = (t, nm, vel, o = {}) => {
    const f = note(nm);
    const x = feltPiano({ freq: f, vel, seed: seedOf("piano", nm, t.toFixed(3)) });
    const pan = clamp(Math.log2(f / 261.6) * 0.35, -0.6, 0.6);
    score.placeMono(t, x, dbToGain(o.gain ?? -6), pan, o.dry ?? 0.7, o.send ?? 0.5);
  };
  const bell = (t, nm, vel, pan = 0) => {
    score.placeMono(t, bellNote({ freq: note(nm), vel, seed: seedOf("bell", nm, t.toFixed(3)) }), dbToGain(-9), pan, 0.45, 0.9);
  };
  const drone = (nm, start, end, o = {}) => {
    const v = droneVoice({ freq: note(nm), dur: Math.max(0.2, end - start), attack: o.attack ?? 3, release: o.release ?? 3, seed: seedOf("drone", nm, start.toFixed(3)), cutoff: o.cutoff ?? 320 });
    score.place(start, v, dbToGain(o.gain ?? -20) * 0.85, dbToGain(o.gain ?? -20) * 0.2);
  };
  const pulse = (t, vel) => score.placeMono(t, pulseHit({ vel, seed: seedOf("pulse", t.toFixed(3)) }), dbToGain(-7), 0, 0.85, 0.15);

  const intro = sec.intro;
  const journey = sec.journey;
  const twist = sec.twist;
  const climb = sec.climb;
  const glory = sec.glory;
  const years = sec.years;
  const golg = sec.golgotha;
  const lamb = sec.lamb;
  const cta = sec.cta;
  const endS = sec.end;
  const S2 = S("S2");
  const S3 = S("S3");
  const S8 = S("S8");
  const beat = 60 / cues.music.bpm;

  // --- loop chord: starts in the ending and rings through the loop point into the opening
  pad(CH.Dadd9, endS.start + 0.15, T + S2 + 0.2, { attack: 1.6, release: 2.2, gain: -17, cutoff: 1500 });

  // --- intro: quiet, curious (dawn, the command, the question)
  pad(CH.Bm9, S2 - 0.1, S3 + 0.3, { attack: 1.4, release: 2.0, gain: -18, cutoff: 1100 });
  pad(CH.Gmaj7, S3, S3 + 2.3, { attack: 1.0, release: 1.8, gain: -18, cutoff: 1300 });
  pad(CH.Asus4, S3 + 2.1, at("b04", "three") + 0.1, { attack: 0.9, release: 0.9, gain: -18, cutoff: 1300 });
  pad(CH.A, at("b04", "three"), journey.start + 0.3, { attack: 0.5, release: 1.2, gain: -18, cutoff: 1400 });
  [[0.05, "A4", 0.42], [1.72, "F#4", 0.36], [3.42, "E4", 0.34], [5.12, "D4", 0.38],
    [S2 + 0.1, "B3", 0.36], [S2 + 1.8, "C#4", 0.28], [S2 + 3.5, "D4", 0.3],
    [S3 + 0.05, "G3", 0.3], [S3 + 0.07, "D4", 0.26], [S3 + 1.8, "F#4", 0.26],
    [at("b04", "three") - 0.02, "E4", 0.32], [at("b04", "three"), "A3", 0.28]].forEach(([t, n, v]) => piano(t, n, v));

  // --- journey: gentle motion in eighth notes, then the riser (sfx) carries into the twist
  pad(CH.Dopen, journey.start, twist.start - 0.08, { attack: 0.8, release: 0.35, gain: -17, cutoff: 1700, cutoffEnd: 2600 });
  const eighths = ["D4", "A4", "F#4", "A4", "E4", "A4", "F#4", "A4", "D5", "A4"];
  for (let k = 0, t = journey.start + 0.05; t < twist.start - 0.3; k++, t += beat / 2) piano(t, eighths[k % eighths.length], 0.16 + 0.1 * ((t - journey.start) / (twist.start - journey.start)), { gain: -8 });

  // --- twist: low tension and wonder
  drone("D2", twist.start, climb.end - 0.2, { attack: 1.2, release: 0.6, gain: -21 });
  pad(CH.Bm, twist.start, at("b06", "come") - 0.05, { attack: 1.8, release: 1.6, gain: -19, cutoff: 900 });
  pad(CH.DFs, at("b06", "come") - 0.15, at("b07", "we") + 0.2, { attack: 0.6, release: 1.4, gain: -18, cutoff: 1500 });
  pad(CH.G, at("b07", "we") - 0.1, at("b07", "isaac") + 0.3, { attack: 0.9, release: 1.5, gain: -19, cutoff: 1100 });
  pad(CH.Em7, at("b07", "isaac"), at("b07", "dead") + 0.1, { attack: 0.9, release: 1.2, gain: -19, cutoff: 1000 });
  pad(CH.Asus4, at("b07", "dead"), climb.start + 0.3, { attack: 0.6, release: 0.8, gain: -19, cutoff: 1100 });
  [[twist.start + 0.03, "D2", 0.5], [twist.start + 0.05, "A2", 0.42], [at("b06", "i"), "F#4", 0.24],
    [at("b06", "come"), "A4", 0.34], [at("b06", "come") + 0.012, "D5", 0.3], [at("b07", "we"), "B4", 0.28],
    [at("b07", "god"), "G4", 0.24], [at("b07", "dead"), "E4", 0.26], [at("b07", "dead") + 0.015, "A4", 0.24]].forEach(([t, n, v]) => piano(t, n, v));

  // --- climb: a slow soft low pulse on the beat, building; everything ends before the silence
  const climbEnd = climb.end - 0.18;
  const cc = [[CH.Bm, ["B3", "D4", "F#4", "D4"]], [CH.G, ["G3", "B3", "D4", "B3"]], [CH.D, ["A3", "D4", "F#4", "D4"]], [CH.A, ["A3", "C#4", "E4", "C#4"]]];
  const span = (climbEnd - climb.start) / cc.length;
  cc.forEach(([chord], k) => {
    const s = climb.start + k * span;
    pad(chord, s - (k ? 0.12 : 0), s + span, { attack: k ? 0.7 : 1.0, release: k === cc.length - 1 ? 0.25 : 0.9, gain: -19 + k * 1.3, cutoff: 1000 + k * 450, cutoffEnd: 1300 + k * 500 });
  });
  for (let t = climb.start + 0.02, k = 0; t < climbEnd - 0.2; t += beat, k++) {
    const x = (t - climb.start) / (climbEnd - climb.start);
    pulse(t, 0.35 + 0.65 * x);
    const arp = cc[Math.min(cc.length - 1, Math.floor((t - climb.start) / span))][1];
    if (t + beat * 0.5 < climbEnd - 0.25) piano(t + beat * 0.5, arp[k % 4], 0.14 + 0.12 * x, { gain: -9 });
  }

  // --- glory: warm choir after the held breath; the boom (sfx) lands on "stopped"
  const gChoir = ["D3", "A3", "D4", "F#4", "A4"];
  choir(gChoir, glory.start, at("b11", "ram") + 0.2, { attack: 0.45, release: 1.8, gain: -15 });
  choir(["D3", "G3", "B3", "D4", "G4"], at("b11", "ram"), at("b11", "place") + 0.1, { attack: 0.9, release: 1.6, gain: -16 });
  choir(gChoir, at("b11", "place") - 0.1, years.start + 1.4, { attack: 0.8, release: 2.8, gain: -16 });
  pad(CH.Dadd9, glory.start, years.start + 0.9, { attack: 0.8, release: 2.4, gain: -20, cutoff: 1800 });
  drone("D2", glory.start, years.end - 0.6, { attack: 0.6, release: 1.5, gain: -23 });
  piano(boom + 0.01, "D3", 0.36, { gain: -7, send: 0.7 });
  piano(boom + 0.02, "D4", 0.3, { gain: -7, send: 0.7 });

  // --- years: shimmer, cooling toward the cold hill
  pad(CH.Bm9, years.start + 1.0, golg.start + 0.3, { attack: 1.2, release: 1.4, gain: -20, cutoff: 900, cutoffEnd: 600 });
  [["A6", 0.0], ["F#6", 0.35], ["D6", 0.7], ["B5", 1.1], ["A5", 1.5], ["F#5", 1.95]].forEach(([n, d], k) => bell(years.start + d, n, 0.3 - k * 0.03, k % 2 ? 0.4 : -0.4));

  // --- golgotha: cold, grey, sparse; thins out at "And God did not stop it"
  drone("B1", golg.start, lamb.start + 0.4, { attack: 1.0, release: 1.5, gain: -20, cutoff: 220 });
  drone("F#2", golg.start + 0.4, thinOut + 0.3, { attack: 1.5, release: 1.0, gain: -25, cutoff: 260 });
  for (const [nm, pan] of [["F#5", -0.3], ["B5", 0.35]]) {
    const v = droneVoice({ freq: note(nm), dur: thinOut - golg.start, attack: 2.5, release: 0.8, seed: seedOf("cold", nm), saw: 0, cutoff: 4000 });
    score.place(golg.start + 0.3, { L: v.L.map((x) => x * (1 + pan)), R: v.R.map((x) => x * (1 - pan)) }, dbToGain(-34) * 0.6, dbToGain(-34) * 0.8);
  }
  [[golg.start + 0.05, "B2", 0.34], [at("b12", "golgotha"), "F#2", 0.3], [at("b13", "ram"), "D3", 0.24]].forEach(([t, n, v]) => piano(t, n, v));
  pad(CH.Bm11, romans - 0.1, lamb.start + 0.5, { attack: 1.6, release: 1.4, gain: -20, cutoff: 900 });
  [[romans + 0.15, "B2", 0.28], [romans + 0.17, "F#3", 0.24], [at("b14", "delivered"), "A3", 0.2]].forEach(([t, n, v]) => piano(t, n, v));

  // --- lamb: light breaks, warm major chords, peak on "Jesus"
  pad(CH.G, lamb.start, at("b15", "would") + 0.1, { attack: 1.0, release: 1.6, gain: -17, cutoff: 1500, cutoffEnd: 2000 });
  pad(CH.DFs, at("b15", "would"), at("b16", "the") + 0.15, { attack: 0.8, release: 1.4, gain: -17, cutoff: 1700 });
  pad(CH.A, at("b16", "the"), peak + 0.05, { attack: 0.8, release: 0.9, gain: -16, cutoff: 1900, cutoffEnd: 2400 });
  pad(CH.Dbig, peak - 0.04, cta.start + 1.4, { attack: 0.35, release: 2.4, gain: -15, cutoff: 2600 });
  choir(["D3", "A3", "D4", "F#4"], at("b15", "would"), peak - 0.1, { attack: 1.6, release: 1.0, gain: -21, vowel: "oh" });
  choir(["D3", "A3", "D4", "F#4", "A4"], peak - 0.08, cta.start + 1.0, { attack: 0.3, release: 2.6, gain: -16 });
  drone("D2", peak - 0.05, cta.start + 2.0, { attack: 0.3, release: 2.0, gain: -23 });
  [[lamb.start + 0.05, "G3", 0.32], [lamb.start + 0.07, "D4", 0.3], [at("b15", "would"), "F#4", 0.32],
    [at("b16", "the"), "E4", 0.3], [at("b16", "the") + 0.02, "A4", 0.3],
    [peak, "D4", 0.46], [peak + 0.015, "F#4", 0.42], [peak + 0.03, "A4", 0.42], [peak + 0.045, "D5", 0.44]].forEach(([t, n, v]) => piano(t, n, v));
  const arp = ["D6", "A5", "F#6", "A5", "E6", "A5", "F#6", "D6"];
  for (let t = lamb.start + 0.3, k = 0; t < peak + 1.3; t += beat / 2, k++) {
    const x = clamp((t - lamb.start) / (peak - lamb.start), 0, 1);
    const fade = t > peak ? Math.max(0.2, 1 - (t - peak) / 1.3) : 1;
    bell(t, arp[k % arp.length], (0.08 + 0.14 * x) * fade, k % 2 ? 0.45 : -0.45);
  }

  // --- call to action: gentle, warm, lower energy
  pad(CH.Dmaj9, cta.start + 0.9, at("b17", "which") + 0.1, { attack: 1.4, release: 1.6, gain: -19, cutoff: 1500 });
  pad(CH.Gmaj9, at("b17", "which"), at("b17", "tell") + 0.6, { attack: 0.9, release: 1.4, gain: -19, cutoff: 1400 });
  pad(CH.A, at("b17", "tell") + 0.4, endS.start + 0.25, { attack: 0.9, release: 1.0, gain: -19, cutoff: 1400 });
  [[at("b17", "faith"), "D5", 0.28], [at("b17", "love"), "C#5", 0.26], [at("b17", "which"), "B4", 0.24],
    [at("b17", "tell"), "A4", 0.24], [at("b17", "comments"), "F#4", 0.24]].forEach(([t, n, v]) => piano(t, n, v));

  // --- end: resolve and lead back into the opening note (loop)
  [[endS.start + 0.15, "D4", 0.32], [endS.start + 0.17, "F#4", 0.3], [endS.start + 1.15, "A4", 0.28], [endS.start + 2.1, "E4", 0.26]].forEach(([t, n, v]) => piano(t, n, v));

  // ---------------------------------------------------------------- hall, gating, dynamics
  const hall = makeIR({ seconds: 6, rt60: 4.2, rtLowMul: 1.2, rtHighMul: 0.55, predelay: 0.03, seed: 2024 });
  const out = new Bus(N);
  const silence = sec.silence;
  for (const [p, gated] of [[score.A, true], [score.B, false]]) {
    const wet = convolveCircular(p.send, hall);
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const g = gated ? (t < silence.start - 0.16 ? 1 : t >= silence.start ? 0 : rise((silence.start - t) / 0.16)) : 1;
      out.L[i] += (p.dry.L[i] + wet.L[i] * 0.55) * g;
      out.R[i] += (p.dry.R[i] + wet.R[i] * 0.55) * g;
    }
  }
  const auto = automation([
    [0, -2], [journey.start, -1.5], [twist.start - 0.14, 1.5], [twist.start - 0.02, -16], [twist.start + 0.7, -3.5],
    [climb.start, -3.5], [climb.end - 0.3, 0], [silence.start - 0.12, 0], [silence.start, -48], [silence.end - 0.04, -48],
    [silence.end + 0.06, 0], [years.start, -1], [years.end, -4], [golg.start, -5], [thinOut, -5], [thinOut + 0.5, -15],
    [romans - 0.1, -15], [romans + 0.8, -7], [lamb.start, -6], [peak - 0.05, 2], [peak + 1.0, 1], [cta.start + 0.5, -4],
    [endS.start, -3], [T, -2],
  ], N);
  out.scale(auto);
  // gentle 30 Hz high-pass: keep sub rumble out of phone speakers' way
  const hl = new Biquad("highpass", 30, 0.7);
  const hr = new Biquad("highpass", 30, 0.7);
  hl.process(out.L);
  hr.process(out.R);
  // calibrate: loudest-section RMS lands at a fixed reference, so the mixer's levels are stable
  const ref = Math.max(rmsOf(out.L), rmsOf(out.R)) || 1;
  out.gain(0.08 / ref);
  return out;
}
