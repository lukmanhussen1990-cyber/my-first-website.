// The score for "Friend": soft pads, felt piano, a low cello-like drone, gentle strings and a long hall
// reverb. D minor until beats.keyChange ("That's who Jesus is"), then D major. Every entry is tied to a
// beat from src/beats.mjs or to a word of the narration, so the music follows the picture.
import { SR, Bus, Biquad, curve, fdnReverb } from './dsp.mjs';
import {
  padChord, strings, choir, piano, arp, pluck, subHit, crash, reverseCymbal, riser, drone, reverseSwell, formantChoir, noiseShape,
} from './instruments.mjs';

// ---------------- chord voicings (MIDI) ----------------
const CH = {
  // D minor
  Dm9: [50, 57, 64, 65], Dm: [50, 57, 62, 65], Bbmaj7: [46, 53, 57, 62], FA: [45, 53, 57, 60],
  Gm9Bb: [46, 55, 57, 62], Asus4: [45, 52, 57, 62], A: [45, 52, 57, 61], A7sus4: [45, 52, 55, 62],
  EbD: [50, 51, 55, 58], Gm: [43, 50, 55, 58], Gm7: [43, 53, 58, 62], Bb: [46, 53, 58, 62],
  BbE: [46, 53, 57, 64], Dmlow: [38, 50, 57, 62, 65],
  // D major
  Dbig: [38, 50, 57, 62, 66, 69], D: [50, 57, 62, 66], AC: [49, 52, 57, 61, 64], Bm7: [47, 54, 57, 62, 66],
  G: [43, 50, 55, 59, 62], DF: [42, 54, 57, 62, 66], Em7: [40, 52, 55, 59, 62], GB: [47, 55, 59, 62],
};
// D natural minor up to the octave and beyond, for the twelve dots
const DOT_NOTES = [62, 64, 65, 67, 69, 70, 72, 74, 76, 77, 79];

function tambourine(bus, t, gain, seed) {
  // a soft jingle: a few detuned high bandpassed noise bursts
  const fl = [new Biquad('bandpass', 7200, 4), new Biquad('highpass', 4000, 0.7)];
  const fr = [new Biquad('bandpass', 7600, 4), new Biquad('highpass', 4000, 0.7)];
  noiseShape(bus, t, t + 0.22, `tamb${seed}`, (tt) => gain * Math.min(1, tt / 0.002) * (Math.exp(-tt / 0.035) + 0.35 * Math.exp(-tt / 0.11)), { fl, fr });
}
function frameDrum(bus, t, gain) {
  subHit(bus, t, { gain, f0: 140, f1: 82, sweep: 0.025, decay: 0.28, click: 0.45 });
}

export function renderMusic(b, tl) {
  const pre = Math.round((b.total - b.loopOut) * 1000) / 1000;
  const T = b.total;
  const mk = () => new Bus(T, pre);
  const pads = mk(), str = mk(), cho = mk(), pno = mk(), low = mk(), fx = mk(), perc = mk();
  const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');
  const w = (sid, text, nth = 0) => tl.words.filter((x) => x.sid === sid && norm(x.text) === text)[nth].start;
  const block = (rows, o = {}, lowO = {}) => {
    for (const [t0, t1, c] of rows) {
      padChord(pads, c, t0 - 0.08, t1, { att: 0.5, rel: 1.3, gain: 0.04, cutoff: 1500, ...o });
      strings(low, [c[0] - 12], t0 - 0.06, t1, { att: 0.45, rel: 1.1, gain: 0.024, cutoff: 800, ...lowO });
    }
  };

  // ---- S1 the kiss (starts in the pre-roll so t = 0 is already mid-moment) ----
  padChord(pads, CH.Dm9, -pre, b.s2 + 0.1, { att: 0.35, rel: 1.4, gain: 0.045, cutoff: 1200 });
  strings(low, [38, 45], -pre, b.s2, { att: 0.35, rel: 1.2, gain: 0.03, cutoff: 800 });
  piano(pno, 69, b.kissTouch, 0.34, { dur: 1.2 });
  piano(pno, 65, b.kissTouch + 0.45, 0.28, { dur: 1.4 });
  piano(pno, 64, w('01b', 'answered'), 0.27, { dur: 0.8 });
  piano(pno, 62, b.hookWord, 0.34, { dur: 1.6 });
  piano(pno, 50, b.hookWord + 0.01, 0.2, { dur: 1.6 });

  // ---- S2 the rewind: a reversed chord swells into the landing; then the warm upper room ----
  reverseSwell(fx, [62, 65, 69, 74], b.rewindLand, b.rewindLand - b.rewindStart - 0.05, 0.05);
  subHit(fx, b.rewindLand, { gain: 0.3, f0: 70, f1: 38, decay: 1.0, click: 0.1 });

  // ---- S3 the towel ----
  block([
    [b.rewindLand, b.robeOff, CH.Bbmaj7], [b.robeOff, b.towelTie, CH.FA], [b.towelTie, b.pourStart, CH.Gm9Bb],
    [b.pourStart, b.washStart, CH.Dm9], [b.washStart, 11.7, CH.Bbmaj7], [11.7, 12.0, CH.Asus4], [12.0, b.dots[0], CH.A],
  ]);
  arp(pno, [46, 53, 57, 62, 65], b.rewindLand + 0.05, 0.12, 0.3, { dur: 2.0 });
  piano(pno, 74, b.jesusRise, 0.34, { dur: 0.7 });
  piano(pno, 72, w('03', 'jesus'), 0.3, { dur: 0.5 });
  piano(pno, 69, w('03', 'took'), 0.3, { dur: 0.4 });
  piano(pno, 70, b.towelTie, 0.32, { dur: 0.7 });
  piano(pno, 69, b.pourStart + 0.05, 0.3, { dur: 0.5 });
  piano(pno, 65, w('03', 'down'), 0.28, { dur: 0.6 });
  arp(pno, [74, 76, 77, 81], b.pourStart + 0.3, 0.16, 0.18, { dur: 1.4 });
  piano(pno, 74, b.washStart, 0.32, { dur: 0.5 });
  piano(pno, 72, w('03', 'disciples'), 0.28, { dur: 0.5 });
  piano(pno, 69, w('03', 'feet'), 0.32, { dur: 0.8 });
  piano(pno, 73, 12.02, 0.26, { dur: 0.5 });

  // ---- S4 twelve: one pizzicato note per dot, rising; the 12th (Judas) falls to a dark low cluster ----
  b.dots.slice(0, 11).forEach((t, k) => pluck(low, DOT_NOTES[k] - 12, t, 0.5, { pan: -0.3 + 0.06 * k, bright: 0.45 }));
  padChord(pads, CH.Dm, b.dots[0] - 0.05, b.dots[11], { att: 0.3, rel: 0.6, gain: 0.032, cutoff: 1500 });
  piano(pno, 39, b.dots[11], 0.42, { dur: 2.2 });
  piano(pno, 50, b.dots[11] + 0.01, 0.34, { dur: 2.2 });
  subHit(fx, b.dots[11], { gain: 0.26, f0: 64, f1: 36, decay: 1.0, click: 0.08 });

  // ---- S5 Judas ----
  block([
    [b.dots[11], b.touch, CH.EbD], [b.touch, b.lookUp, CH.Gm9Bb], [b.lookUp, w('05', 'for'), CH.A7sus4],
    [w('05', 'for'), b.betray, CH.Dm], [b.betray, w('05', 'him'), CH.BbE], [w('05', 'him'), b.s6, CH.A],
  ], { gain: 0.036, cutoff: 1300 });
  piano(pno, 62, b.touch, 0.24, { dur: 0.8 });
  piano(pno, 81, b.pouchGlint, 0.12, { dur: 0.6 });
  piano(pno, 69, b.lookUp, 0.3, { dur: 0.5 });
  piano(pno, 70, b.lookUp + 0.38, 0.26, { dur: 0.5 });
  piano(pno, 69, b.lookUp + 0.76, 0.26, { dur: 0.8 });
  piano(pno, 58, b.betray, 0.32, { dur: 1.0 });
  piano(pno, 64, b.betray + 0.01, 0.3, { dur: 1.0 });

  // ---- S6 the deal: filtered and tense, low tremolo strings growing to "silver" ----
  padChord(pads, CH.Dm, b.s6 - 0.1, w('06', 'thirty'), { att: 0.4, rel: 0.6, gain: 0.036, cutoff: 800 });
  padChord(pads, CH.EbD, w('06', 'thirty'), b.silver, { att: 0.2, rel: 0.4, gain: 0.038, cutoff: 900 });
  const cres6 = curve([[b.s6, 0.25], [b.silver - 0.05, 1]]);
  strings(str, [38, 50, 51], b.s6, b.silver + 0.02, { att: 0.3, rel: 0.08, gain: 0.03, trem: 9, cresc: cres6, cutoff: 1800, hard: true });
  piano(pno, 38, b.silver, 0.48, { dur: 1.6 });
  piano(pno, 26, b.silver + 0.005, 0.34, { dur: 1.6 });
  subHit(fx, b.silver, { gain: 0.5, f0: 76, f1: 32, decay: 1.3, click: 0.2 });
  padChord(pads, [45, 52, 57], b.silver + 0.05, b.s7 + 0.3, { att: 0.3, rel: 1.0, gain: 0.022, cutoff: 900 });

  // ---- S7 but notice: sparse; the scale settles on "slave" with a low A ----
  block([
    [b.butNotice, b.shekels, CH.Gm], [b.shekels, w('07', 'was'), CH.Bb], [w('07', 'was'), b.scaleLevel, CH.A7sus4],
    [b.scaleLevel, b.s8, CH.A],
  ], { gain: 0.034, cutoff: 1300 });
  piano(pno, 74, b.butNotice, 0.3, { dur: 1.2 });
  piano(pno, 70, b.shekels, 0.26, { dur: 0.5 });
  piano(pno, 69, w('07', 'shekels'), 0.24, { dur: 0.5 });
  piano(pno, 67, w('07', 'silver'), 0.26, { dur: 0.8 });
  piano(pno, 33, b.scaleLevel, 0.4, { dur: 1.6 });
  piano(pno, 45, b.scaleLevel + 0.01, 0.32, { dur: 1.6 });
  subHit(fx, b.scaleLevel, { gain: 0.32, f0: 66, f1: 34, decay: 1.1, click: 0.1 });

  // ---- S8 worth: near silence, one high string note; a low D when the coin falls flat ----
  strings(str, [81], b.s8, b.coinFlat, { att: 0.6, rel: 0.6, gain: 0.006, cutoff: 3200, voices: 3 });
  piano(pno, 38, b.coinFlat, 0.26, { dur: 1.5 });
  piano(pno, 50, b.coinFlat + 0.01, 0.18, { dur: 1.5 });

  // ---- S9 the garden: a creeping tremolo cello, distant drum pulse, choir on "torches and swords" ----
  block([
    [b.s9, w('09', 'garden'), CH.Dm], [w('09', 'garden'), w('09', 'crowd'), CH.Bbmaj7],
    [w('09', 'crowd'), w('09', 'torches'), CH.Gm], [w('09', 'torches'), b.swordsUp, CH.A7sus4], [b.swordsUp, b.s10, CH.A],
  ], { gain: 0.034, cutoff: 1000 });
  const cres9 = curve([[b.s9, 0.3], [b.swordsUp, 1], [b.s10, 0.9]]);
  strings(str, [38, 45], b.s9, b.s10 + 0.05, { att: 0.6, rel: 0.4, gain: 0.03, trem: 7, cresc: cres9, cutoff: 1500 });
  for (let t = b.s9 + 0.6, k = 0; t < b.s10 - 0.3; t += 1.04, k++) subHit(perc, t, { gain: 0.16 + 0.012 * k, f0: 62, f1: 40, decay: 0.5, click: 0.06 });
  choir(cho, [57, 62, 65], w('09', 'torches') - 0.1, b.s10 + 0.2, { gain: 0.016, cresc: cres9 });
  piano(pno, 62, w('09', 'later'), 0.26, { dur: 0.8 });
  piano(pno, 65, w('09', 'garden'), 0.24, { dur: 0.8 });
  piano(pno, 64, w('09', 'judas'), 0.24, { dur: 0.8 });

  // ---- S10 the kiss: everything falls away (the heartbeat is in the SFX) ----
  strings(str, [69, 74], b.s10, b.kissLean, { att: 0.3, rel: 1.2, gain: 0.005, cutoff: 3000, voices: 3 });

  // ---- S11 friend: one second of silence, then one warm piano note and a soft swell ----
  piano(pno, 62, b.friendWord, 0.44, { dur: 3.2, bright: 0.8 });
  piano(pno, 50, b.friendWord + 0.005, 0.16, { dur: 3.2, bright: 0.7 });
  const swell = curve([[b.friendWord, 0.15], [b.friendWord + 1.8, 1], [b.keyChange, 0.9]]);
  const S11 = [
    [b.friendWord + 0.1, w('11b', 'come'), CH.Bbmaj7], [w('11b', 'come'), w('12b', 'to'), CH.FA],
    [w('12b', 'to'), w('12b', 'him'), CH.Gm7], [w('12b', 'him'), w('12b', 'him') + 0.45, CH.Asus4], [w('12b', 'him') + 0.45, b.keyChange, CH.A],
  ];
  for (const [t0, t1, c] of S11) {
    padChord(pads, c, t0, t1, { att: 1.0, rel: 1.3, gain: 0.034, cutoff: 1400 });
    strings(str, c, t0, t1, { att: 1.2, rel: 1.2, gain: 0.02, cutoff: 2200, cresc: swell });
  }
  choir(cho, [62, 65, 69], b.friendWord + 0.4, w('11b', 'come'), { gain: 0.012, cresc: swell, att: 1.4 });
  piano(pno, 65, w('11b', 'wherefore'), 0.22, { dur: 0.6 });
  piano(pno, 64, w('11b', 'thou'), 0.2, { dur: 0.4 });
  piano(pno, 62, w('11b', 'come'), 0.24, { dur: 0.8 });
  piano(pno, 69, w('12a', 'friend'), 0.3, { dur: 0.8 });
  piano(pno, 67, w('12b', 'to'), 0.24, { dur: 0.4 });
  piano(pno, 65, w('12b', 'betraying'), 0.26, { dur: 0.6 });
  piano(pno, 64, w('12b', 'him'), 0.26, { dur: 0.5 });
  piano(pno, 61, w('12b', 'him') + 0.45, 0.26, { dur: 0.6 });

  // ---- S12 the same night: D major ----
  const kc = b.keyChange;
  const S12 = [[kc, w('13a', 'is') + 0.42, CH.Dbig], [w('13a', 'is') + 0.42, b.warmTakesOver, CH.AC], [b.warmTakesOver, w('13b', 'people') - 0.15, CH.Bm7],
    [w('13b', 'people') - 0.15, w('13b', 'hurt'), CH.G], [w('13b', 'hurt'), b.s13 + 0.15, CH.DF]];
  const cres12 = curve([[kc, 0.8], [b.warmTakesOver, 0.9], [b.s13, 0.85]]);
  for (const [t0, t1, c] of S12) {
    padChord(pads, c, t0 - 0.05, t1, { att: 0.35, rel: 1.3, gain: 0.04, cutoff: 1900 });
    strings(str, c, t0 - 0.05, t1, { att: 0.45, rel: 1.3, gain: 0.022, cutoff: 2800, cresc: cres12 });
  }
  arp(pno, [50, 57, 62, 66, 69, 74], kc, 0.09, 0.4, { dur: 2.0 });
  piano(pno, 78, w('13a', 'jesus'), 0.34, { dur: 0.6 });
  piano(pno, 76, w('13a', 'is'), 0.3, { dur: 0.4 });
  piano(pno, 74, w('13a', 'is') + 0.36, 0.3, { dur: 0.6 });
  piano(pno, 74, b.warmTakesOver, 0.3, { dur: 0.5 });
  piano(pno, 78, w('13b', 'feet'), 0.32, { dur: 0.7 });
  piano(pno, 76, w('13b', 'people'), 0.28, { dur: 0.5 });
  piano(pno, 74, w('13b', 'hurt'), 0.3, { dur: 0.5 });
  piano(pno, 73, w('13b', 'him'), 0.26, { dur: 0.4 });
  piano(pno, 74, w('13b', 'him') + 0.3, 0.26, { dur: 0.8 });

  // ---- S13 enemies: a warm rise into "enemies", then reconciled ----
  riser(fx, b.s13 - 0.2, b.enemies, 0.045);
  reverseCymbal(fx, b.enemies, 1.0, 0.06);
  const cres13 = curve([[b.s13, 0.6], [b.enemies, 1], [w('14', 'reconciled'), 0.85], [w('14', 'son'), 1], [b.s14, 0.85]]);
  const S13 = [[b.s13, w('14', 'we', 1), CH.G], [w('14', 'we', 1), w('14', 'god'), CH.DF], [w('14', 'god'), w('14', 'death'), CH.Bm7],
    [w('14', 'death'), w('14', 'son'), CH.G], [w('14', 'son'), w('14', 'son') + 0.42, CH.Asus4], [w('14', 'son') + 0.42, b.s14, CH.A]];
  for (const [t0, t1, c] of S13) {
    padChord(pads, c, t0 - 0.05, t1, { att: 0.4, rel: 1.2, gain: 0.04, cutoff: 2000 });
    strings(str, c, t0 - 0.05, t1, { att: 0.45, rel: 1.2, gain: 0.024, cutoff: 2900, cresc: cres13 });
  }
  choir(cho, [62, 66, 69, 74], b.enemies - 0.2, b.s14, { gain: 0.016, cresc: cres13 });
  piano(pno, 74, b.enemies, 0.32, { dur: 0.9 });
  piano(pno, 78, b.enemies + 0.01, 0.3, { dur: 0.9 });
  piano(pno, 81, w('14', 'reconciled'), 0.3, { dur: 0.7 });
  piano(pno, 78, w('14', 'god'), 0.3, { dur: 0.6 });
  piano(pno, 76, w('14', 'death'), 0.28, { dur: 0.6 });
  piano(pno, 74, w('14', 'son'), 0.34, { dur: 0.9 });

  // ---- S14 the feast: bright, lilting plucks, a soft frame drum and tambourine ----
  const S14 = [[b.s14, b.labelSinners, CH.D], [b.labelSinners, w('15a', 'publicans') + 0.45, CH.G], [w('15a', 'publicans') + 0.45, w('15a', 'sinners'), CH.DF],
    [w('15a', 'sinners'), w('15b', 'they'), CH.Em7], [w('15b', 'they'), b.right, CH.Asus4], [b.right, b.s15, CH.Dbig]];
  for (const [t0, t1, c] of S14) padChord(pads, c, t0 - 0.05, t1, { att: 0.25, rel: 1.0, gain: 0.034, cutoff: 2200 });
  const rootAt14 = (t) => ({ 50: 38, 43: 43, 42: 42, 40: 40, 45: 45, 38: 38 }[S14.find(([a, c]) => t >= a && t < c)?.[2][0]] ?? 38);
  const step = 0.27;
  for (let t = b.s14 + 0.05, k = 0; t < b.s15 - 0.1; t += step, k++) {
    const r = rootAt14(t) + 12;
    pluck(low, [r, r + 7, r + 12][k % 3], t, k % 3 === 0 ? 0.55 : 0.4, { pan: [-0.2, 0.15, 0.3][k % 3], bright: 0.5 });
    if (k % 3 === 0) frameDrum(perc, t, 0.14);
    else tambourine(perc, t, k % 3 === 1 ? 0.05 : 0.035, k);
  }
  piano(pno, 74, w('15a', 'they'), 0.3, { dur: 0.5 });
  piano(pno, 78, b.labelSinners, 0.32, { dur: 0.5 });
  piano(pno, 79, w('15a', 'publicans'), 0.3, { dur: 0.6 });
  piano(pno, 76, w('15a', 'sinners'), 0.3, { dur: 0.7 });
  piano(pno, 74, b.right, 0.34, { dur: 1.0 });
  piano(pno, 78, b.right + 0.01, 0.32, { dur: 1.0 });
  crash(fx, b.right, 0.05, 2.0);

  // ---- S15 call to action: soft ----
  const S15 = [[b.s15, w('16a', 'of'), CH.G], [w('16a', 'of'), w('16a', 'betrayed'), CH.DF], [w('16a', 'betrayed'), b.yes, CH.Em7],
    [b.yes, b.typingStart - 0.1, CH.Asus4], [b.typingStart - 0.1, 67.6, CH.D], [67.6, 68.3, CH.GB], [68.3, b.s16, CH.A]];
  for (const [t0, t1, c] of S15) {
    padChord(pads, c, t0 - 0.08, t1, { att: 0.5, rel: 1.2, gain: 0.034, cutoff: 1600 });
    arp(pno, c.slice(0, 4).map((m) => m + 12), t0 + 0.05, 0.14, 0.18, { dur: 1.2 });
  }
  strings(low, [43], b.s15, w('16a', 'of'), { att: 0.6, rel: 1.0, gain: 0.02, cutoff: 700 });

  // ---- S16 resolve on D major; the opening pre-roll fades in on top for the loop ----
  padChord(pads, CH.Dbig, b.s16 - 0.05, b.loopOut - 0.3, { att: 0.3, rel: 1.0, gain: 0.04, cutoff: 1800 });
  strings(str, CH.Dbig, b.s16 - 0.05, b.loopOut - 0.3, { att: 0.4, rel: 1.0, gain: 0.02, cutoff: 2400 });
  choir(cho, [62, 66, 69, 74], b.s16, b.loopOut - 0.3, { gain: 0.013, att: 0.6, rel: 1.0 });
  arp(pno, [38, 50, 57, 62, 66, 69], b.s16, 0.07, 0.4, { dur: 2.3 });

  // ---- drone: D pedal through the minor section (soft in the warm room, gone in the silences) ----
  const droneLvl = curve([
    [-pre, 0.075], [b.s2 - 0.2, 0.075], [b.rewindLand, 0.03], [b.s4, 0.03], [b.dots[11], 0.05], [b.s5 + 0.8, 0.035],
    [b.s6, 0.05], [b.silver, 0.08], [b.s7 + 0.2, 0.035], [b.s8, 0.02], [b.s8 + 0.4, 0.0], [b.s9 - 0.2, 0.0],
    [b.s9 + 0.6, 0.06], [b.swordsUp, 0.08], [b.s10, 0.06], [b.s10 + 0.8, 0.0], [b.loopOut - 0.3, 0.0], [T, 0.0],
  ]);
  drone(low, -pre, T, droneLvl, () => 230);

  // ---- bus processing, reverb, master ----
  formantChoir(cho);
  const eq = (bus, specs) => { for (const ch of [bus.L, bus.R]) for (const s of specs) new Biquad(...s).run(ch); };
  eq(pads, [['highpass', 70, 0.7], ['lowpass', 6500, 0.7]]);
  eq(str, [['highpass', 45, 0.7], ['peaking', 350, 1, 2], ['peaking', 3000, 1, -3], ['highshelf', 7000, 0.7, -3]]);
  eq(cho, [['highpass', 120, 0.7], ['highshelf', 6000, 0.7, -4]]);
  eq(pno, [['highpass', 40, 0.7], ['highshelf', 5000, 0.7, -2]]);
  eq(low, [['highpass', 25, 0.7], ['lowpass', 2500, 0.7]]);
  eq(fx, [['highpass', 25, 0.7], ['highshelf', 8000, 0.7, -3]]);
  eq(perc, [['highpass', 35, 0.7]]);

  const send = mk();
  for (const [bus, amt] of [[pads, 0.35], [str, 0.38], [cho, 0.55], [pno, 0.5], [low, 0.08], [fx, 0.3], [perc, 0.12]]) send.mixFrom(bus, amt);
  const [wl, wr] = fdnReverb(send.L, send.R, { t60: 4.6, damp: 5000, predelay: 0.035, size: 1.15, seed: 'hall' });

  const out = mk();
  for (const bus of [pads, str, cho, pno, low, fx, perc]) out.mixFrom(bus, 1);
  for (let i = 0; i < out.n; i++) {
    out.L[i] += wl[i] * 0.55;
    out.R[i] += wr[i] * 0.55;
  }
  eq(out, [['highpass', 30, 0.7], ['highshelf', 7000, 0.7, -3], ['lowpass', 14000, 0.7]]);

  // section dynamics, including the near silences of S8 and S10 and the full second of silence in S11
  const intensity = curve([
    [-pre, 0.8], [b.s2 - 0.05, 0.8], [b.rewindLand, 0.68], [b.s3 + 0.3, 0.6], [b.s4, 0.62], [b.dots[11], 0.72],
    [b.s5 + 0.4, 0.55], [b.s6, 0.6], [b.silver, 0.85], [b.silver + 0.4, 0.62], [b.s7 + 0.2, 0.5], [b.butNotice, 0.46],
    [b.scaleLevel, 0.62], [b.s8 - 0.05, 0.5], [b.s8 + 0.3, 0.2], [b.coinFlat, 0.24], [b.s9, 0.55], [b.swordsUp, 0.78],
    [b.s10 - 0.05, 0.66], [b.s10 + 0.6, 0.14], [b.kissTouch2, 0.1], [b.freeze - 0.35, 0.08], [b.freeze, 0.0],
    [b.friendWord - 0.01, 0.0], [b.friendWord + 0.03, 0.8], [kc - 0.2, 0.74], [kc + 0.4, 0.92], [b.s13, 0.86],
    [b.enemies, 1.0], [b.s14, 0.86], [b.right, 0.96], [b.s15 + 0.3, 0.6], [b.s16, 0.66], [b.loopOut - 0.2, 0.55], [T, 0.8],
  ]);
  for (let i = 0; i < out.n; i++) {
    const g = intensity(i / SR - pre);
    out.L[i] *= g;
    out.R[i] *= g;
  }
  return { bus: out, pre };
}
