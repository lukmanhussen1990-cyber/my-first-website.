// The score for "The Face of God": deep pads, low strings, choir, felt piano, timpani-like hits and a
// long hall. Tense on the mountain (D minor), tender at the camp, a warm lift into D major at
// beats.keyChange ("Now here's the best part") and warmest at Jesus' face. Every entry is tied to a beat
// from src/beats.mjs or to a word of the narration, so the music follows the picture.
import { SR, Bus, Biquad, curve, fdnReverb } from './dsp.mjs';
import {
  padChord, strings, choir, piano, arp, pluck, subHit, crash, reverseCymbal, riser, drone, reverseSwell, formantChoir,
} from './instruments.mjs';

// ---------------- chord voicings (MIDI) ----------------
const CH = {
  // D minor
  Dm9: [50, 57, 64, 65], Dm: [50, 57, 62, 65], Dmlow: [38, 50, 57, 62, 65], Bbmaj7: [46, 53, 57, 62], Gm9Bb: [46, 55, 57, 62],
  Gm: [43, 50, 55, 58], A: [45, 52, 57, 61], Asus4: [45, 52, 57, 62], A7sus4: [45, 52, 55, 62], EbD: [50, 51, 55, 58],
  Bb: [46, 53, 58, 62], BbLyd: [46, 53, 57, 62, 64, 69], Fadd9: [41, 53, 57, 60, 67], CE: [40, 52, 55, 60, 64], Dm7: [50, 57, 60, 65],
  FA: [45, 53, 57, 60], Gm7: [43, 53, 58, 62],
  // D major
  Dbig: [38, 50, 57, 62, 66, 69], D: [50, 57, 62, 66], AC: [49, 52, 57, 61, 64], Bm7: [47, 54, 57, 62, 66], G: [43, 50, 55, 59, 62],
  DF: [42, 54, 57, 62, 66], Em7: [40, 52, 55, 59, 62], GB: [47, 55, 59, 62], Gmaj7: [43, 50, 54, 59, 62], Dsus: [50, 57, 62, 67],
};

// timpani: a low pitched hit with a skin thump (and an optional roll)
const timp = (bus, t, gain, f = 73) => subHit(bus, t, { gain, f0: f * 1.35, f1: f, sweep: 0.05, decay: 1.4, click: 0.35 });
function roll(bus, t0, t1, gain, f = 73) {
  for (let t = t0, k = 0; t < t1; t += 0.065, k++) {
    const u = (t - t0) / (t1 - t0);
    subHit(bus, t, { gain: gain * (0.25 + 0.75 * u * u) * (k % 2 ? 0.85 : 1), f0: f * 1.25, f1: f, sweep: 0.03, decay: 0.35, click: 0.3 });
  }
}

export function renderMusic(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const mk = () => new Bus(T, pre);
  const pads = mk(), str = mk(), cho = mk(), pno = mk(), low = mk(), fx = mk();
  const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  const w = (sid, text, nth = 0) => tl.words.filter((x) => x.sid === sid && norm(x.text) === text)[nth].start;
  const block = (rows, o = {}, lowO = {}) => {
    for (const [t0, t1, c] of rows) {
      padChord(pads, c, t0 - 0.08, t1, { att: 0.5, rel: 1.3, gain: 0.04, cutoff: 1500, ...o });
      strings(low, [c[0] - 12], t0 - 0.06, t1, { att: 0.45, rel: 1.1, gain: 0.024, cutoff: 800, ...lowO });
    }
  };
  const kc = b.keyChange;

  // ---- S1–S2 the storm: a dark pad, low tremolo strings growing, timpani on the lightning; a riser into
  // "you will die", then a hard cut (the intensity curve below drops everything to zero) ----
  padChord(pads, CH.Dmlow, -pre, b.hardCut, { att: 0.3, rel: 0.05, gain: 0.04, cutoff: 900 });
  const cres = curve([[-pre, 0.35], [b.s2, 0.55], [b.swellStart, 0.6], [b.hardCut - 0.05, 1]]);
  strings(str, [38, 45, 50], -pre, b.hardCut, { att: 0.25, rel: 0.05, gain: 0.03, trem: 8, cresc: cres, cutoff: 1500, hard: true });
  choir(cho, [57, 62, 65], 0.3, b.hardCut, { gain: 0.012, att: 1.2, rel: 0.05, cresc: cres });
  timp(fx, b.lightning1 + 0.05, 0.55, 55);
  timp(fx, b.lightning2 + 0.05, 0.42, 55);
  timp(fx, b.lightning3 + 0.05, 0.36, 61);
  roll(fx, b.swellStart + 0.4, b.hardCut, 0.3, 55);
  riser(fx, b.swellStart, b.hardCut, 0.09);
  reverseCymbal(fx, b.hardCut, 1.6, 0.14);
  // (near silence until the montage)

  // ---- S3 montage: a driving low pulse, a hit on every whip cut; the sea splits on a big D minor ----
  const S3 = [[b.s3, b.fire, CH.Dm], [b.fire, b.whipPlagues, CH.Bb], [b.whipPlagues, b.whipSea, CH.Gm], [b.whipSea, b.split, CH.A], [b.split, b.s4, CH.Dmlow]];
  for (const [t0, t1, c] of S3) padChord(pads, c, t0 - 0.02, t1, { att: 0.06, rel: 0.25, gain: 0.04, cutoff: 1700 });
  const rootAt3 = (t) => (t < b.fire ? 38 : t < b.whipPlagues ? 34 : t < b.whipSea ? 31 : t < b.split ? 33 : 26);
  for (let t = b.s3, k = 0; t < b.s4 - 0.1; t += 0.2, k++) {
    const r = rootAt3(t) + 12;
    pluck(low, [r, r + 12, r + 7, r + 12][k % 4], t, k % 4 === 0 ? 0.6 : 0.42, { pan: [-0.2, 0.2, -0.1, 0.25][k % 4], bright: 0.55 });
  }
  strings(str, [50, 57, 62], b.s3, b.s4, { att: 0.15, rel: 0.6, gain: 0.02, trem: 10, cutoff: 2200, cresc: curve([[b.s3, 0.4], [b.split, 1], [b.s4, 0.6]]) });
  for (const t of [b.s3, b.fire, b.whipPlagues, b.whipSea]) timp(fx, t, 0.42, 58);
  timp(fx, b.split, 0.7, 49);
  subHit(fx, b.split, { gain: 0.45, f0: 70, f1: 30, decay: 1.6, click: 0.15 });
  crash(fx, b.split, 0.06, 2.6);

  // ---- S4 the ask: low pad and strings; the request rises; "glory" opens onto a bright F ----
  block([
    [b.s4, w('04', 'asked'), CH.Dm9], [w('04', 'asked'), b.cardGloryIn, CH.Gm9Bb], [b.cardGloryIn, w('04', 'shew'), CH.Bbmaj7],
    [w('04', 'shew'), b.glory, CH.A7sus4], [b.glory, b.s5, CH.Fadd9],
  ], { gain: 0.04, cutoff: 1400 });
  strings(str, [62, 65], b.cardGloryIn, b.glory, { att: 0.8, rel: 0.6, gain: 0.018, cutoff: 2600, cresc: curve([[b.cardGloryIn, 0.4], [b.glory, 1]]) });
  strings(str, [69, 72], b.glory - 0.05, b.s5 + 0.2, { att: 0.25, rel: 0.9, gain: 0.02, cutoff: 3000 });
  choir(cho, [60, 65, 69], b.glory - 0.08, b.s5 + 0.3, { gain: 0.016, att: 0.4, rel: 1.0 });
  timp(fx, b.lightning4 + 0.05, 0.35, 55);
  timp(fx, b.lightning5 + 0.05, 0.3, 55);
  piano(pno, 69, b.cardGloryIn, 0.26, { dur: 0.8 });
  piano(pno, 70, w('04', 'beseech'), 0.24, { dur: 0.6 });
  piano(pno, 69, w('04', 'thee'), 0.24, { dur: 0.6 });
  piano(pno, 72, b.glory, 0.3, { dur: 1.2 });

  // ---- S5 the answer: dark (E-flat over D), a timpani roll grows to "live" ----
  block([
    [b.s5, b.cardLiveIn, CH.Dm], [b.cardLiveIn, w('05', 'see'), CH.EbD], [w('05', 'see'), b.live, CH.Gm], [b.live, b.s6, CH.A],
  ], { gain: 0.042, cutoff: 1100 });
  roll(fx, w('05', 'see'), b.live, 0.26, 55);
  timp(fx, b.live, 0.55, 55);
  timp(fx, b.lightning6 + 0.05, 0.3, 61);
  piano(pno, 38, b.live, 0.42, { dur: 1.8 });
  piano(pno, 45, b.live + 0.01, 0.3, { dur: 1.8 });

  // ---- S6 the clift: quiet tension, then the river of light: choir and strings swell on a luminous
  // B-flat (lydian), with a long echo ----
  block([[b.s6, b.inside, CH.Dm9], [b.inside, b.gloryRush, CH.Gm9Bb]], { gain: 0.034, cutoff: 1100 });
  strings(str, [81], b.s6 + 0.3, b.gloryRush, { att: 1.2, rel: 0.6, gain: 0.008, cutoff: 5000, vibDepth: 0.004 });
  const rush = curve([[b.gloryRush, 0.2], [b.gloryPeak, 1], [b.gloryGone, 0.5], [b.s7 + 1.2, 0.2]]);
  padChord(pads, CH.BbLyd, b.gloryRush - 0.1, b.s7 + 0.8, { att: 0.3, rel: 1.8, gain: 0.05, cutoff: 3200 });
  choir(cho, [62, 65, 69, 74, 77], b.gloryRush - 0.15, b.s7 + 0.6, { gain: 0.024, att: 0.35, rel: 2.0, cresc: rush });
  strings(str, [58, 65, 69, 74], b.gloryRush - 0.1, b.s7 + 0.5, { att: 0.3, rel: 1.8, gain: 0.022, cutoff: 3600, cresc: rush });
  reverseSwell(fx, [58, 62, 65, 69], b.gloryRush + 0.05, 1.0, 0.05);
  timp(fx, b.gloryRush + 0.05, 0.45, 47);

  // ---- S7 his back: hushed high strings while the light trails fade ----
  block([[b.s7, b.dawn, CH.Gm9Bb]], { gain: 0.026, cutoff: 1000 });
  strings(str, [74, 81], b.s7 + 0.2, b.dawn + 0.4, { att: 0.9, rel: 1.4, gain: 0.01, cutoff: 4200 });

  // ---- S8 coming down: tender morning; a soft piano line; the shine twinkles on "shining" ----
  block([
    [b.dawn, w('08a', 'next'), CH.Fadd9], [w('08a', 'next'), b.walkStart + 1.6, CH.CE], [b.walkStart + 1.6, b.shining, CH.Dm7],
    [b.shining, b.faceCU, CH.Bbmaj7], [b.faceCU, b.s9, CH.Fadd9],
  ], { gain: 0.034, cutoff: 1700 }, { gain: 0.016 });
  [[b.dawn + 0.1, 72], [w('08a', 'happened'), 69], [w('08a', 'next'), 67], [b.walkStart + 1.6, 65], [w('08b', 'came'), 67], [w('08b', 'down'), 69]]
    .forEach(([t, m]) => piano(pno, m, t, 0.26, { dur: 0.9 }));
  arp(pno, [77, 81, 84, 86, 89], b.shining, 0.09, 0.14, { dur: 1.6 });
  piano(pno, 81, b.faceCU + 0.1, 0.22, { dur: 1.4 });
  strings(str, [65, 72], b.faceCU, b.s9 + 0.2, { att: 0.5, rel: 1.0, gain: 0.012, cutoff: 3000 });

  // ---- S9 the camp: warm strings, a darker turn on "afraid" ----
  block([
    [b.s9, w('09b', 'skin'), CH.Bbmaj7], [w('09b', 'skin'), w('09b', 'shone'), CH.Fadd9], [w('09b', 'shone'), w('10', 'the'), CH.CE],
    [w('10', 'the'), b.gasp2, CH.Gm9Bb], [b.gasp2, b.s10, CH.A7sus4],
  ], { gain: 0.034, cutoff: 1600 }, { gain: 0.018 });
  strings(str, [62, 65, 69], b.s9 + 0.1, b.gasp2, { att: 0.9, rel: 1.0, gain: 0.014, cutoff: 2600 });
  piano(pno, 74, b.s9 + 0.05, 0.24, { dur: 0.8 });
  piano(pno, 72, w('09b', 'shone'), 0.26, { dur: 0.9 });
  piano(pno, 70, b.gasp2, 0.24, { dur: 0.9 });
  piano(pno, 69, b.childPeek, 0.22, { dur: 1.2 });

  // ---- S10 the veil: intimate, suspended, waiting ----
  block([[b.s10, b.veilOn, CH.Dm9], [b.veilOn, kc - 0.05, CH.Asus4]], { gain: 0.03, cutoff: 1300 }, { gain: 0.014 });
  piano(pno, 62, b.veilOn, 0.24, { dur: 1.6 });
  piano(pno, 57, b.veilOn + 0.01, 0.18, { dur: 1.6 });
  piano(pno, 64, w('11', 'god'), 0.2, { dur: 1.0 });

  // ---- S11 the best part: a warm swell into D major; the light streak; the upper room ----
  padChord(pads, CH.Dbig, kc - 0.06, b.room, { att: 0.25, rel: 1.0, gain: 0.046, cutoff: 2200 });
  strings(str, [50, 57, 62, 66, 69], kc - 0.04, b.room, { att: 0.4, rel: 1.0, gain: 0.02, cutoff: 3000 });
  choir(cho, [62, 66, 69, 74], kc, b.room + 0.2, { gain: 0.018, att: 0.5, rel: 1.2 });
  arp(pno, [50, 57, 62, 66, 69, 74], kc, 0.09, 0.3, { dur: 2.0 });
  timp(fx, kc, 0.3, 73);
  reverseSwell(fx, [62, 66, 69, 74], b.room, b.room - b.streakStart, 0.045);
  block([
    [b.room, w('12b', 'said'), CH.D], [w('12b', 'said'), b.me, CH.GB], [b.me, b.father, CH.Em7], [b.father, b.s12, CH.Gmaj7],
  ], { gain: 0.036, cutoff: 1900 }, { gain: 0.016 });
  arp(pno, [62, 66, 69, 74], b.room + 0.05, 0.14, 0.2, { dur: 1.2 });
  piano(pno, 78, b.me, 0.28, { dur: 1.0 });
  piano(pno, 74, b.me + 0.01, 0.22, { dur: 1.0 });
  piano(pno, 79, b.father, 0.3, { dur: 1.4 });
  piano(pno, 71, b.father + 0.01, 0.22, { dur: 1.4 });

  // ---- S12 no more hiding: the split builds; a bright chord when the FACE badge fills ----
  block([[b.s12, w('13', 'rock'), CH.Bm7], [w('13', 'rock'), b.faceFill, CH.A], [b.faceFill, b.s13, CH.Dsus]], { gain: 0.038, cutoff: 2000 }, { gain: 0.018 });
  strings(str, [62, 66, 69, 74], b.s12, b.s13, { att: 0.8, rel: 0.8, gain: 0.016, cutoff: 3200, cresc: curve([[b.s12, 0.4], [b.s13, 1]]) });
  arp(pno, [74, 78, 81, 86], b.faceFill, 0.07, 0.24, { dur: 1.6 });

  // ---- S13 the face: the warmest moment, full D major, peaking on "Christ" ----
  const glory2 = w('14', 'glory'), faceOf = w('14', 'face');
  const S13 = [[b.s13, glory2, CH.D], [glory2, faceOf, CH.G], [faceOf, w('14', 'jesus'), CH.DF], [w('14', 'jesus'), b.christ, CH.AC],
    [b.christ, b.s14, CH.Dbig]];
  for (const [t0, t1, c] of S13) padChord(pads, c, t0 - 0.06, t1, { att: 0.35, rel: 1.2, gain: 0.044, cutoff: 2400 });
  strings(low, [38], b.s13, b.s14, { att: 0.6, rel: 1.4, gain: 0.026, cutoff: 700 });
  strings(str, [62, 66, 69, 74, 78], b.s13 - 0.05, b.s14 + 0.3, { att: 0.9, rel: 1.6, gain: 0.02, cutoff: 3400, cresc: curve([[b.s13, 0.5], [b.christ, 1], [b.s14, 0.7]]) });
  choir(cho, [62, 66, 69, 74], b.s13, b.s14 + 0.4, { gain: 0.02, att: 0.9, rel: 1.8, cresc: curve([[b.s13, 0.4], [b.christ, 1]]) });
  piano(pno, 74, w('14', 'you'), 0.26, { dur: 0.8 });
  piano(pno, 78, glory2, 0.3, { dur: 1.0 });
  piano(pno, 81, faceOf, 0.3, { dur: 0.8 });
  piano(pno, 86, b.christ, 0.32, { dur: 1.8 });
  piano(pno, 74, b.christ + 0.01, 0.26, { dur: 1.8 });
  timp(fx, b.christ, 0.32, 73);
  crash(fx, b.christ, 0.035, 2.4);

  // ---- S14 call to action: soft and reflective ----
  const oneLine = w('15b', 'one');
  const S14 = [[b.s14, w('15a', 'face'), CH.G], [w('15a', 'face'), w('15a', 'say'), CH.DF], [w('15a', 'say'), oneLine, CH.Em7],
    [oneLine, b.typingStart, CH.Asus4], [b.typingStart, b.hearts, CH.D], [b.hearts, b.s15, CH.Gmaj7]];
  for (const [t0, t1, c] of S14) {
    padChord(pads, c, t0 - 0.08, t1, { att: 0.5, rel: 1.2, gain: 0.034, cutoff: 1600 });
    arp(pno, c.slice(0, 4).map((m) => m + 12), t0 + 0.05, 0.16, 0.16, { dur: 1.3 });
  }
  strings(low, [43], b.s14, oneLine, { att: 0.6, rel: 1.0, gain: 0.018, cutoff: 700 });

  // ---- S15 resolve on D major, then the storm's pre-roll fades in on top for the loop ----
  padChord(pads, CH.Dbig, b.s15 - 0.05, b.loopOut - 0.3, { att: 0.3, rel: 1.0, gain: 0.04, cutoff: 1800 });
  strings(str, CH.Dbig, b.s15 - 0.05, b.loopOut - 0.3, { att: 0.4, rel: 1.0, gain: 0.018, cutoff: 2400 });
  choir(cho, [62, 66, 69, 74], b.s15, b.loopOut - 0.3, { gain: 0.012, att: 0.6, rel: 1.0 });
  arp(pno, [38, 50, 57, 62, 66, 69], b.s15, 0.07, 0.36, { dur: 2.3 });

  // ---- drone: D pedal under the mountain (gone in the near silence, soft at the camp, off in major) ----
  const droneLvl = curve([
    [-pre, 0.08], [b.hardCut - 0.02, 0.1], [b.hardCut, 0], [b.s3, 0], [b.s3 + 0.1, 0.06], [b.s4, 0.08], [b.s5, 0.1], [b.live, 0.11],
    [b.s6, 0.07], [b.gloryRush, 0.05], [b.s7, 0.04], [b.dawn, 0.02], [b.s9, 0.015], [b.s10, 0.03], [kc - 0.1, 0.03], [kc + 0.5, 0.0],
    [b.loopOut - 0.3, 0.0], [T, 0.08],
  ]);
  drone(low, -pre, T, droneLvl, (t) => (t < b.hardCut ? 260 : 200));

  // ---- bus processing, reverb, master ----
  formantChoir(cho);
  const eq = (bus, specs) => { for (const ch of [bus.L, bus.R]) for (const s of specs) new Biquad(...s).run(ch); };
  eq(pads, [['highpass', 60, 0.7], ['lowpass', 6500, 0.7]]);
  eq(str, [['highpass', 40, 0.7], ['peaking', 350, 1, 2], ['peaking', 3000, 1, -3], ['highshelf', 7000, 0.7, -3]]);
  eq(cho, [['highpass', 120, 0.7], ['highshelf', 6000, 0.7, -4]]);
  eq(pno, [['highpass', 40, 0.7], ['highshelf', 5000, 0.7, -2]]);
  eq(low, [['highpass', 25, 0.7], ['lowpass', 2500, 0.7]]);
  eq(fx, [['highpass', 25, 0.7], ['highshelf', 8000, 0.7, -3]]);

  const send = mk();
  for (const [bus, amt] of [[pads, 0.38], [str, 0.42], [cho, 0.6], [pno, 0.5], [low, 0.1], [fx, 0.35]]) send.mixFrom(bus, amt);
  const [wl, wr] = fdnReverb(send.L, send.R, { t60: 5.2, damp: 4800, predelay: 0.04, size: 1.25, seed: 'hall' });

  const out = mk();
  for (const bus of [pads, str, cho, pno, low, fx]) out.mixFrom(bus, 1);
  for (let i = 0; i < out.n; i++) {
    out.L[i] += wl[i] * 0.6;
    out.R[i] += wr[i] * 0.6;
  }
  eq(out, [['highpass', 28, 0.7], ['highshelf', 7000, 0.7, -3], ['lowpass', 14000, 0.7]]);

  // section dynamics, including the hard cut on "die" and the near silence after it
  const intensity = curve([
    [-pre, 0.8], [b.s2, 0.82], [b.swellStart, 0.86], [b.hardCut - 0.03, 1.0], [b.hardCut, 0.0], [b.s3 - 0.02, 0.0], [b.s3, 0.86],
    [b.split, 1.0], [b.s4, 0.72], [b.glory, 0.82], [b.s5, 0.74], [b.live, 0.88], [b.s6, 0.56], [b.gloryRush - 0.05, 0.6],
    [b.gloryPeak, 1.0], [b.gloryGone, 0.72], [b.s7 + 0.5, 0.48], [b.dawn, 0.52], [b.s9, 0.6], [b.s10, 0.5], [kc - 0.05, 0.5],
    [kc + 0.4, 0.9], [b.room, 0.72], [b.room + 0.6, 0.58], [b.s12, 0.66], [b.faceFill, 0.8], [b.s13, 0.82], [b.christ, 1.0],
    [b.s14, 0.7], [b.s14 + 0.8, 0.56], [b.s15, 0.64], [b.loopOut - 0.2, 0.55], [T, 0.8],
  ]);
  for (let i = 0; i < out.n; i++) {
    const g = intensity(i / SR - pre);
    out.L[i] *= g;
    out.R[i] *= g;
  }
  return { bus: out, pre };
}
