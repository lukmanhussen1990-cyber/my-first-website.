// The score for "Wheat and Weeds": soft pads, felt piano, gentle strings, a low drone and a long hall.
// Mysterious and dark at night with the enemy (D minor), tense at "pull them up?", a warm lift into
// D major at "He's not slow. He's patient" (beats.keyChange), bright light on the Damascus road, and the
// brightest moment at the harvest. Every entry is tied to a beat from src/beats.mjs or to a word.
import { SR, Bus, Biquad, curve, fdnReverb } from './dsp.mjs';
import { padChord, strings, choir, piano, arp, pluck, subHit, crash, reverseCymbal, riser, drone, reverseSwell, formantChoir } from './instruments.mjs';

// ---------------- chord voicings (MIDI) ----------------
const CH = {
  // D minor
  Dmlow: [38, 50, 57, 62, 65], Dm9: [50, 57, 64, 65], Dm: [50, 57, 62, 65], Dm7: [50, 57, 60, 65], EbD: [50, 51, 55, 58],
  Gm9Bb: [46, 55, 57, 62], Gm: [43, 50, 55, 58], A7sus4: [45, 52, 55, 62], A: [45, 52, 57, 61], Asus4: [45, 52, 57, 62],
  Bbmaj7: [46, 53, 57, 62], Fadd9: [41, 53, 57, 60, 67], CE: [40, 52, 55, 60, 64], FA: [45, 53, 57, 60], Bb: [46, 53, 58, 62],
  // D major
  Dbig: [38, 50, 57, 62, 66, 69], D: [50, 57, 62, 66], DF: [42, 54, 57, 62, 66], G: [43, 50, 55, 59, 62], Gmaj7: [43, 50, 54, 59, 62],
  Em7: [40, 52, 55, 59, 62], Bm7: [47, 54, 57, 62, 66], AC: [49, 52, 57, 61, 64], Dsus: [50, 57, 62, 67], DLyd: [38, 50, 57, 62, 64, 66, 68],
};

// a soft low tom/timpani: a pitched hit with a felt thump
const timp = (bus, t, gain, f = 73) => subHit(bus, t, { gain, f0: f * 1.35, f1: f, sweep: 0.05, decay: 1.4, click: 0.3 });

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
      strings(low, [c[0] - 12], t0 - 0.06, t1, { att: 0.45, rel: 1.1, gain: 0.022, cutoff: 800, ...lowO });
    }
  };
  const kc = b.keyChange;

  // ---- S1 night: a dark low pad from the pre-roll (so the loop flows in), high shimmering strings, a
  // felt-piano note as the hand opens; a low swell under the weeds bursting up; a lift for the pull back ----
  padChord(pads, CH.Dmlow, -pre, b.s2, { att: 0.4, rel: 0.6, gain: 0.04, cutoff: 900 });
  strings(str, [74, 81], -pre, b.s2, { att: 0.6, rel: 0.6, gain: 0.006, cutoff: 5000, vibDepth: 0.004 });
  piano(pno, 62, b.throw1, 0.24, { dur: 1.6 });
  piano(pno, 57, b.throw1 + 0.01, 0.18, { dur: 1.6 });
  reverseSwell(fx, [38, 45, 50, 53], b.burst, 0.8, 0.05);
  timp(fx, b.burst, 0.4, 49);
  strings(str, [50, 57, 62, 65], b.burst, b.s2 + 0.3, { att: 0.5, rel: 0.6, gain: 0.016, cutoff: 1800, trem: 9, cresc: curve([[b.burst, 0.4], [b.titleOut, 1], [b.s2, 0.6]]) });
  piano(pno, 65, b.evil, 0.26, { dur: 1.2 });
  piano(pno, 50, b.evil + 0.01, 0.22, { dur: 1.8 });

  // ---- S2 the storyteller: warmer, a felt-piano motif ("once upon a time") ----
  block([[b.s2, b.field, CH.Fadd9], [b.field, b.s3, CH.Bbmaj7]], { gain: 0.034, cutoff: 1800 }, { gain: 0.016 });
  [[b.s2 + 0.05, 69], [w('02', 'story'), 72], [w('02', 'about'), 74], [b.field, 72]].forEach(([t, m]) => piano(pno, m, t, 0.24, { dur: 1.0 }));

  // ---- S3 good seed at sunrise: hopeful; a golden arpeggio on each throw ----
  block([[b.s3, b.seed, CH.FA], [b.seed, b.s4, CH.CE]], { gain: 0.036, cutoff: 2000 }, { gain: 0.016 });
  arp(pno, [65, 69, 72, 77], b.sow1, 0.06, 0.2, { dur: 1.2 });
  arp(pno, [67, 72, 76, 79], b.sow2, 0.06, 0.2, { dur: 1.4 });

  // ---- S4 while men slept: dark and sly. Low plucks on the enemy's steps, a cold E-flat over D ----
  block([[b.s4, b.enemy1, CH.Dm9], [b.enemy1, b.sowed, CH.EbD], [b.sowed, b.wentHisWay, CH.Gm], [b.wentHisWay, b.s5, CH.A7sus4]], { gain: 0.036, cutoff: 1000 });
  b.steps.enemy.forEach((t, k) => pluck(low, [38, 41, 38, 44][k % 4], t, 0.36, { pan: k % 2 ? 0.25 : -0.25, bright: 0.3 }));
  timp(fx, b.enemy1, 0.36, 55);
  strings(str, [62, 63], b.slept, b.wentHisWay + 0.6, { att: 1.0, rel: 0.8, gain: 0.008, cutoff: 3000 });

  // ---- S5 they look the same: a growing pulse through the time-lapse, then a minor turn as the
  // tares darken; puzzled plucks when the servants come ----
  block([[b.s5, b.tareTurn, CH.Fadd9], [b.tareTurn, b.servantsIn, CH.Dm7], [b.servantsIn, b.sir, CH.Gm9Bb], [b.sir, b.s6, CH.A7sus4]], { gain: 0.034, cutoff: 1500 });
  for (let t = b.growStart, k = 0; t < b.tareTurn; t += 0.16, k++) pluck(pno, [65, 69, 72, 74, 77][k % 5] + (k > 6 ? 0 : -12), t, 0.2 + 0.02 * Math.min(8, k), { pan: (k % 3 - 1) * 0.3, bright: 0.5 });
  piano(pno, 62, b.tareTurn, 0.22, { dur: 1.4 });
  piano(pno, 61, b.tareDark, 0.2, { dur: 1.4 });

  // ---- S6 "An enemy hath done this": a low hit on "enemy"; calm on "God didn't plant the evil" ----
  block([[b.s6, b.enemy2, CH.Gm], [b.enemy2, b.godDidnt, CH.Dm], [b.godDidnt, b.s7, CH.Bbmaj7]], { gain: 0.036, cutoff: 1300 });
  timp(fx, b.enemy2, 0.42, 55);
  piano(pno, 50, b.enemy2, 0.3, { dur: 1.6 });
  piano(pno, 69, b.godDidnt, 0.22, { dur: 1.2 });
  piano(pno, 65, b.plantEvil, 0.2, { dur: 1.6 });

  // ---- S7 pull them up?: tension builds (tremolo, a ticking pulse) to the NAY, which lands hard; then
  // a hushed, deep underground; strain under the pull; a sad fall as the wheat roots tear ----
  const tens = curve([[b.s7, 0.3], [b.shouldWe, 0.6], [b.nay - 0.05, 1], [b.nay, 0.2], [b.underground, 0.35], [b.taresRip, 0.8], [b.wheatRip, 1], [b.s8, 0.3]]);
  block([[b.s7, b.shouldWe, CH.Dm9], [b.shouldWe, b.nay, CH.A7sus4]], { gain: 0.036, cutoff: 1300 });
  strings(str, [57, 62, 64], b.shouldWe - 0.2, b.nay, { att: 0.3, rel: 0.05, gain: 0.02, trem: 11, cutoff: 2600, cresc: tens, hard: true });
  for (let t = b.shouldWe, k = 0; t < b.nay - 0.1; t += 0.25, k++) pluck(low, k % 2 ? 45 : 38, t, 0.3 + 0.03 * k, { bright: 0.4 });
  // the hit lands just after the word's attack, so "Nay" itself stays clear
  timp(fx, b.nay + 0.12, 0.45, 49);
  subHit(fx, b.nay + 0.12, { gain: 0.26, f0: 70, f1: 32, decay: 1.4, click: 0.2 });
  block([[b.nay, b.underground, CH.Dmlow], [b.underground, b.taresRip, CH.Gm], [b.taresRip, b.wheatRip, CH.EbD], [b.wheatRip, b.s8, CH.Gm9Bb]], { gain: 0.034, cutoff: 900 });
  strings(str, [62, 65], b.pull, b.wheatRip + 0.4, { att: 0.4, rel: 0.6, gain: 0.014, trem: 7, cutoff: 2400, cresc: tens });
  piano(pno, 74, b.wheatRip, 0.26, { dur: 1.0 });
  piano(pno, 72, b.wheatRip + 0.45, 0.22, { dur: 1.0 });
  piano(pno, 69, b.wheatRip + 0.9, 0.2, { dur: 1.6 });

  // ---- S8 grow together: a gentle sway ----
  block([[b.s8, b.grow, CH.Bb], [b.grow, b.harvest1, CH.Fadd9], [b.harvest1, b.s9, CH.CE]], { gain: 0.034, cutoff: 1800 }, { gain: 0.016 });
  arp(pno, [58, 62, 65, 69], b.s8 + 0.05, 0.18, 0.18, { dur: 1.4 });
  arp(pno, [60, 64, 67, 72], b.harvest1, 0.12, 0.2, { dur: 1.6 });

  // ---- S9 the hard truth: sparse single notes; a held breath after "who would be left?"; dark "sinned" ----
  block([[b.s9, b.pulledOut, CH.Dm9], [b.pulledOut, b.whoWouldBeLeft, CH.Gm9Bb], [b.whoWouldBeLeft, b.forAll, CH.A7sus4], [b.forAll, b.glory, CH.Dm], [b.glory, b.s10, CH.Bbmaj7]], { gain: 0.03, cutoff: 1100 });
  [[b.hardTruth, 69], [b.pulledOut, 65], [b.tonight1, 64], [b.whoWouldBeLeft, 62]].forEach(([t, m]) => piano(pno, m, t, 0.22, { dur: 1.4 }));
  piano(pno, 50, b.counterAll, 0.3, { dur: 2.0 });
  piano(pno, 57, b.sinned, 0.24, { dur: 1.6 });

  // ---- S10 patient: the warm lift into D major, the hourglass glowing ----
  padChord(pads, CH.Dbig, kc - 0.06, b.s11, { att: 0.35, rel: 1.0, gain: 0.044, cutoff: 2200 });
  strings(str, [50, 57, 62, 66, 69], kc - 0.04, b.s11, { att: 0.6, rel: 1.0, gain: 0.018, cutoff: 3000, cresc: curve([[kc, 0.5], [b.patient, 1], [b.s11, 0.7]]) });
  choir(cho, [62, 66, 69, 74], b.patient - 0.1, b.s11 + 0.2, { gain: 0.016, att: 0.8, rel: 1.4 });
  arp(pno, [50, 57, 62, 66, 69, 74], kc, 0.09, 0.26, { dur: 2.0 });
  timp(fx, b.patient, 0.28, 73);
  block([[b.patient + 1.2, b.perish, CH.G], [b.perish, b.repentance, CH.Em7], [b.repentance, b.s11, CH.Asus4]], { gain: 0.03, cutoff: 2000 }, { gain: 0.014 });
  piano(pno, 78, b.perish, 0.24, { dur: 1.2 });
  piano(pno, 81, b.repentance, 0.26, { dur: 1.6 });

  // ---- S11 Saul: a proud low march in D minor; the light from heaven is a huge bright swell; old Paul
  // writes by lamplight in D major ----
  block([[b.s11, b.hunted, CH.Dm], [b.hunted, b.metJesus, CH.Gm]], { gain: 0.034, cutoff: 1200 });
  b.steps.saul.forEach((t, k) => timp(fx, t, k % 2 ? 0.16 : 0.22, k % 2 ? 61 : 55));
  strings(str, [50, 53, 57], b.s11, b.lightFlash, { att: 0.2, rel: 0.1, gain: 0.014, trem: 6, cutoff: 1800, hard: true });
  riser(fx, b.metJesus - 0.6, b.lightFlash, 0.06);
  reverseSwell(fx, [62, 66, 69, 74], b.lightFlash, 0.9, 0.05);
  padChord(pads, CH.DLyd, b.lightFlash - 0.04, b.paulCut + 0.6, { att: 0.08, rel: 1.4, gain: 0.05, cutoff: 4200 });
  choir(cho, [62, 66, 69, 74, 78], b.lightFlash - 0.05, b.paulCut + 0.8, { gain: 0.026, att: 0.15, rel: 1.8 });
  strings(str, [74, 78, 81, 86], b.lightFlash - 0.05, b.paulCut + 0.6, { att: 0.12, rel: 1.6, gain: 0.02, cutoff: 5000 });
  crash(fx, b.lightFlash, 0.05, 3.0);
  subHit(fx, b.fall + 0.45, { gain: 0.3, f0: 60, f1: 35, decay: 0.9, click: 0.1 });
  block([[b.paulCut, b.paul + 0.4, CH.G], [b.paul + 0.4, b.pulledHimUp, CH.DF], [b.pulledHimUp, b.letters, CH.Em7], [b.letters, b.s12, CH.Asus4]], { gain: 0.032, cutoff: 1800 }, { gain: 0.014 });
  [[b.paul, 74], [b.scrolls[0], 76], [b.scrolls[1], 78], [b.scrolls[2], 76], [b.scrolls[3], 74], [b.letters, 81]].forEach(([t, m]) => piano(pno, m, t, 0.22, { dur: 1.0 }));

  // ---- S12 harvest: the brightest moment, full D major ----
  const H = [[b.s12, b.harvest2, CH.D], [b.harvest2, b.s13, CH.Dbig]];
  for (const [t0, t1, c] of H) padChord(pads, c, t0 - 0.06, t1, { att: 0.3, rel: 1.2, gain: 0.048, cutoff: 2600 });
  strings(low, [38], b.s12, b.s13, { att: 0.5, rel: 1.4, gain: 0.026, cutoff: 700 });
  strings(str, [62, 66, 69, 74, 78], b.s12 - 0.05, b.s13 + 0.4, { att: 0.5, rel: 1.6, gain: 0.022, cutoff: 3600, cresc: curve([[b.s12, 0.6], [b.barnGlow, 1], [b.s13, 0.7]]) });
  choir(cho, [62, 66, 69, 74], b.s12, b.s13 + 0.5, { gain: 0.022, att: 0.6, rel: 1.8, cresc: curve([[b.s12, 0.5], [b.barnGlow, 1]]) });
  arp(pno, [62, 66, 69, 74, 78, 81], b.s12 + 0.05, 0.08, 0.26, { dur: 1.8 });
  piano(pno, 86, b.harvest2, 0.3, { dur: 1.8 });
  timp(fx, b.harvest2, 0.34, 73);
  crash(fx, b.barnGlow, 0.04, 2.6);

  // ---- S13 the question: soft and reflective ----
  const S13 = [[b.s13, b.ready, CH.G], [b.ready, b.yes, CH.DF], [b.yes, b.notYet, CH.Em7], [b.notYet, b.typingStart, CH.Asus4], [b.typingStart, b.hearts, CH.D], [b.hearts, b.s14, CH.Gmaj7]];
  for (const [t0, t1, c] of S13) {
    padChord(pads, c, t0 - 0.08, t1, { att: 0.5, rel: 1.2, gain: 0.032, cutoff: 1600 });
    arp(pno, c.slice(0, 4).map((m) => m + 12), t0 + 0.05, 0.16, 0.15, { dur: 1.3 });
  }
  strings(low, [43], b.s13, b.s14, { att: 0.6, rel: 1.0, gain: 0.016, cutoff: 700 });

  // ---- S14 resolve on D major, then the night's pre-roll fades in on top for the loop ----
  padChord(pads, CH.Dbig, b.s14 - 0.05, b.loopOut - 0.3, { att: 0.3, rel: 1.0, gain: 0.038, cutoff: 1800 });
  strings(str, CH.Dbig, b.s14 - 0.05, b.loopOut - 0.3, { att: 0.4, rel: 1.0, gain: 0.016, cutoff: 2400 });
  arp(pno, [38, 50, 57, 62, 66, 69], b.s14, 0.07, 0.34, { dur: 2.3 });

  // ---- drone: a D pedal under the night and the tension; gone in the major ----
  const droneLvl = curve([
    [-pre, 0.09], [b.s2, 0.06], [b.s3, 0.03], [b.s4, 0.1], [b.s5, 0.06], [b.s7, 0.08], [b.nay, 0.11], [b.s8, 0.05], [b.s9, 0.07],
    [kc - 0.1, 0.06], [kc + 0.6, 0], [b.s11, 0.04], [b.lightFlash, 0], [b.loopOut - 0.3, 0], [T, 0.09],
  ]);
  drone(low, -pre, T, droneLvl, (t) => (t < kc ? 240 : 200));

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
  for (const [bus, amt] of [[pads, 0.4], [str, 0.45], [cho, 0.6], [pno, 0.55], [low, 0.1], [fx, 0.35]]) send.mixFrom(bus, amt);
  const [wl, wr] = fdnReverb(send.L, send.R, { t60: 5.4, damp: 4600, predelay: 0.04, size: 1.25, seed: 'hall' });

  const out = mk();
  for (const bus of [pads, str, cho, pno, low, fx]) out.mixFrom(bus, 1);
  for (let i = 0; i < out.n; i++) {
    out.L[i] += wl[i] * 0.62;
    out.R[i] += wr[i] * 0.62;
  }
  eq(out, [['highpass', 28, 0.7], ['highshelf', 7000, 0.7, -3], ['lowpass', 14000, 0.7]]);

  // section dynamics
  const intensity = curve([
    [-pre, 0.78], [b.burst, 0.86], [b.s2, 0.7], [b.s3, 0.74], [b.s4, 0.7], [b.s5, 0.66], [b.tareDark, 0.74], [b.s6, 0.7], [b.s7, 0.68],
    [b.nay - 0.05, 0.96], [b.nay + 0.3, 0.7], [b.wheatRip, 0.86], [b.s8, 0.7], [b.s9, 0.6], [b.whoWouldBeLeft + 0.3, 0.5], [kc - 0.05, 0.58],
    [kc + 0.5, 0.86], [b.s11, 0.72], [b.lightFlash - 0.05, 0.8], [b.lightFlash + 0.2, 1.0], [b.paulCut + 0.4, 0.66], [b.s12, 0.86],
    [b.barnGlow, 1.0], [b.s13, 0.74], [b.s14, 0.66], [b.loopOut - 0.2, 0.6], [T, 0.78],
  ]);
  for (let i = 0; i < out.n; i++) {
    const g = intensity(i / SR - pre);
    out.L[i] *= g;
    out.R[i] *= g;
  }
  return { bus: out, pre };
}
