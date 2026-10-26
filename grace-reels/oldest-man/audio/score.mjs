// THE OLDEST MAN: the score. D minor, slow and mysterious (warm pads, a low drone, a few felt-piano notes,
// a gentle synth string ensemble, a formant choir, long hall). It builds through the math (pulse, strings,
// timpani, three held tones D-F-A), lands the 969 slam on a choir chord, falls to near silence when the lamp
// goes out, comes back softly with the first rain, grows through the time-lapse (92 BPM grid, the hammer
// taps lock to it), darkens for the flood and resolves to D MAJOR on "but FOR you". Every time comes from
// the shared plan (ctx.E / ctx.W / ctx.SC / ctx.G); nothing here is reel-agnostic.
import * as D from './lib/dsp.mjs';
import * as I from './lib/instruments.mjs';

const { nm, clamp, lerp, ramp, smooth } = D;

// chord voicings (MIDI, mid register, voice-led) and bass roots
export const CH = {
  Dm: [57, 62, 65, 69], Bb: [58, 62, 65, 70], F: [57, 60, 65, 69], Gm: [55, 58, 62, 67], A: [57, 61, 64, 69],
  Asus: [57, 62, 64, 69], Bbmaj9: [58, 60, 65, 69],
  GmD: [50, 55, 58, 62], BbL: [50, 53, 58, 62],                      // dark, low, on a D pedal (the flood)
  D: [57, 62, 66, 69], G: [59, 62, 67, 71], Bm: [59, 62, 66, 71], Dadd9: [57, 62, 64, 66, 69],
  D5: [50, 57, 62, 69],                                               // open fifth: the loop seam (neither major nor minor)
};
export const ROOT = { Dm: 38, Bb: 34, F: 41, Gm: 43, A: 33, Asus: 33, Bbmaj9: 34, GmD: 38, BbL: 38, D: 38, G: 43, Bm: 35, Dadd9: 38, D5: 38 };

// merge a progression into note spans: a pitch held by consecutive chords is sustained, not re-struck.
// prog = [[t, chord, opts?], ...]; voicing(name) -> MIDI list
function spans(prog, tEnd, voicing = (c) => CH[c]) {
  const out = [];
  prog.forEach(([t0, name, opt], k) => {
    const t1 = k + 1 < prog.length ? prog[k + 1][0] : tEnd;
    for (const m of voicing(name)) {
      const open = out.find((s) => s.m === m && Math.abs(s.t1 - t0) < 1e-6);
      if (open) open.t1 = t1; else out.push({ m, t0, t1, k, opt: opt || {} });
    }
  });
  return out;
}
const chordAt = (prog, t) => { let c = prog[0][1]; for (const [t0, n] of prog) if (t >= t0 - 1e-6) c = n; return c; };

export function renderMusic(ctx) {
  const { N, E, W, SC, G, cue, dur } = ctx;
  const music = D.stereo(N), strings = D.stereo(N), choir = D.stereo(N), hall = D.f32(N);
  const MS = (amt) => [[hall, amt]];
  const notes = { pad: 0, strings: 0, choir: 0, piano: 0, pulse: 0, timp: 0, bass: 0 };

  const pad = (prog, tEnd, o) => {
    for (const s of spans(prog, tEnd, o.voicing)) {
      const first = s.k === 0;
      I.padNote(music, { midi: s.m, t0: s.t0, t1: s.t1, att: s.opt.att ?? (first ? o.att0 ?? o.att : o.att), rel: o.rel, amp: o.amp * (o.ampAt ? o.ampAt(s.t0) : 1),
        cutoff: o.cutoff, q: o.q ?? 0.62, voices: o.voices ?? 4, detune: o.detune ?? 9, spread: o.spread ?? 0.8, wave: o.wave ?? 'saw',
        sends: MS(o.send ?? 0.45), seed: o.seed, bloom: o.bloom ?? 0.45, lfo: o.lfo ?? 0.18 });
      notes.pad++;
    }
  };
  const str = (prog, tEnd, o) => {
    for (const s of spans(prog, tEnd, o.voicing)) {
      I.stringNote(strings, { midi: s.m, t0: s.t0, t1: s.t1, att: s.opt.att ?? o.att, rel: o.rel, amp: o.amp, cutoff: o.cutoff, ampAt: o.ampAt,
        voices: o.voices ?? 5, detune: o.detune ?? 10, sends: MS(o.send ?? 0.5), seed: o.seed, vib: o.vib });
      notes.strings++;
    }
  };
  const cho = (prog, tEnd, o) => {
    for (const s of spans(prog, tEnd, o.voicing)) {
      I.choirNote(choir, { midi: s.m, t0: s.t0, t1: s.t1, att: s.opt.att ?? o.att, rel: o.rel, amp: o.amp, ampAt: o.ampAt, voices: o.voices ?? 6, seed: o.seed });
      notes.choir++;
    }
  };
  const bass = (prog, tEnd, o) => prog.forEach(([t0, name], k) => {
    const t1 = k + 1 < prog.length ? prog[k + 1][0] : tEnd;
    I.bassNote(music, { midi: (o.root ?? ROOT)[name] + (o.oct ?? 0), t0, t1, amp: o.amp * (o.ampAt ? o.ampAt(t0) : 1), att: k ? o.att : o.att0 ?? o.att, rel: o.rel, sends: MS(0.06), seed: o.seed });
    notes.bass++;
  });
  const piano = (list, seed = 'felt', gain = 1) => {
    for (const [t, n, v, d = 2.4] of list) {
      const m = nm(n);
      I.pianoNote(music, { midi: m, t, vel: v, dur: d, pan: clamp((m - 66) / 24, -0.4, 0.4), gain: gain * 1.4, sends: MS(0.5), seed });
      notes.piano++;
    }
  };
  const pulse = (a, b, step, prog, o) => {
    for (let j = 0; a + j * step < b; j++) {
      const t = a + j * step, ch = chordAt(prog, t), root = ROOT[ch] % 12 + 48 + (ROOT[ch] % 12 > 7 ? -12 : 0);
      const onBeat = j % 2 === 0, fifth = j % 8 === 5, oct = o.oct && j % 4 === 3;
      const vel = (onBeat ? 0.55 : 0.32) * (o.velAt ? o.velAt(t) : 1) * (j === 0 ? 0.75 : 1);
      I.pluckNote(music, { midi: oct ? root + 12 : fifth ? root + 7 : root, t: t + 0.003 * Math.sin(j * 2.1), vel, cutoff: o.cutoffAt ? o.cutoffAt(t) : o.cutoff ?? 450,
        decay: o.decay ?? 0.13, pan: onBeat ? -0.12 : 0.12, gain: o.gain ?? 0.55, sends: MS(0.14), seed: o.seed });
      notes.pulse++;
    }
  };
  const timp = (t, n, vel, g = 1, dur = 3) => { D.place(music, D.scale(I.timpani(D.mtof(nm(n)), { dur, vel, seed: 'timp' + t.toFixed(2) }), 0.32 * g), t, 1, 0, MS(0.35)); notes.timp++; };

  // ================================================================ A) night, Enoch, timeline, the math (D minor)
  const t0A = E.hookHit + 0.18;
  const progA = [
    [t0A, 'Dm'],                                   // the hook: enters softly after the title hit
    [W('B01', 'flood'), 'Bb'],                     // "...the same year as the flood"
    [W('B01', 'Coincidence'), 'Asus'],             // "Coincidence?" (held question)
    [W('B01', 'Coincidence') + 0.75, 'A'],
    [SC.S2.t0, 'Dm'],                              // his face in the lamp light
    [E.ribbon, 'F'],                               // the life-ribbon draws: "He lived 969 years"
    [SC.S3.t0, 'Bb'],                              // golden morning
    [W('B03', 'walked'), 'F'],                     // "walked with God"
    [W('B03', 'and'), 'Gm'],                       // "and he was not"
    [E.enochGone, 'Bbmaj9'],                       // "for God TOOK him": open, airy
    [SC.S4.t0, 'Dm'],                              // parchment timeline
    [E.barMeth, 'Bb'], [E.barAdam, 'F'], [E.barNoah, 'A'],
    [SC.S5.t0, 'Dm'],                              // "Now watch the math."
    [E.n182, 'Bb'],                                // tones so far D, F: both in Bb
    [W('B07', 'Noah'), 'Gm'],
    [E.n600, 'F'],                                 // D F A held over F = Dm7/F
    [SC.S8.t0, 'Gm', { att: 0.5 }],                // line 9: iv
    [E.sum182, 'Bb'],                              // VI
    [E.sum600, 'Asus'],                            // V (sus)
    [E.equals, 'A', { att: 0.25 }],                // V
    [E.slam, 'Dm', { att: 0.08 }],                 // i: the slam
  ];
  const endA = E.lampOut + 0.2;
  const cutA = ramp([[0, 950], [SC.S2.t0, 1050], [SC.S3.t0, 2000], [SC.S4.t0 - 0.3, 1900], [SC.S4.t0 + 1, 1500], [SC.S5.t0, 1150], [E.n182, 1350], [E.n600, 1600], [SC.S8.t0, 1800], [E.equals, 2200], [E.slam, 2700], [E.slam + 2.5, 1600], [E.lampOut, 1100]]);
  const ampA = ramp([[0, 0.72], [SC.S2.t0, 0.8], [SC.S3.t0, 0.85], [SC.S5.t0, 0.75], [E.n187, 0.85], [E.n600, 0.95], [SC.S8.t0, 1.0], [E.sum600, 1.1], [E.slam, 1.25]]);
  pad(progA, endA, { att: 1.6, att0: 2.4, rel: 1.4, amp: 0.13, ampAt: ampA, cutoff: cutA, seed: 'padA' });
  for (const [t, n] of progA) cue(t, `chord ${n}`);
  // low drone: open fifth D2 + A2 (soft triangle) under the night and under the whole math (pedal)
  for (const [a, b, g] of [[E.hookHit + 0.1, SC.S3.t0 + 0.6, 1], [SC.S5.t0 - 0.4, E.lampOut + 0.1, 1.15]]) {
    for (const m of [38, 45]) I.padNote(music, { midi: m, t0: a, t1: b, att: 2.6, rel: 1.2, amp: (m === 38 ? 0.06 : 0.035) * g, cutoff: () => 420, wave: 'tri', voices: 1, detune: 0, spread: 0, sends: MS(0.15), seed: 'drone', bloom: 0.2, lfo: 0.1, drift: 0.8 });
  }
  // bass: the timeline walks, the math is anchored
  bass(progA.filter(([t]) => t >= SC.S4.t0 - 1e-6), endA, { amp: 0.07, att: 0.5, att0: 1.2, rel: 1.1, seed: 'bassA', ampAt: ramp([[SC.S4.t0, 0.8], [SC.S5.t0, 0.9], [SC.S8.t0, 1.1], [E.slam, 1.3]]) });

  // high, light strings in the golden morning (upper two chord tones, an octave up)
  str(progA.filter(([t]) => t >= SC.S3.t0 - 1e-6 && t < SC.S4.t0 + 1e-6), SC.S4.t0 + 0.3, { voicing: (c) => CH[c].slice(-2).map((m) => m + 12), att: 1.8, rel: 2.2, amp: 0.032, cutoff: 3200, seed: 'strMorning', send: 0.7 });
  cue(SC.S3.t0, 'high strings (golden morning)');

  // ---- the math: three held tones D5 / F5 / A5 (one per number) build the D minor triad
  const tones = [[E.n187, 74], [E.n182, 77], [E.n600, 81]];
  for (const [t, m] of tones) {
    I.stringNote(strings, { midi: m, t0: t + 0.25, t1: SC.S8.t0 + 0.4, att: 1.1, rel: 1.6, amp: 0.05, cutoff: 3600, voices: 5, detune: 8, sends: MS(0.6), seed: 'toneStr', vib: { rate: 5.0, cents: 7, delay: 0.6, att: 1.2 } });
    notes.strings++;
    cue(t, `held tone ${['D5', 'F5', 'A5'][tones.findIndex((x) => x[0] === t)]} enters`);
  }
  // low strings join at the second number (cello pedal D3 + A3), then the full section plays line 9
  for (const m of [50, 57]) { I.stringNote(strings, { midi: m, t0: E.n182 - 0.2, t1: SC.S8.t0 + 0.2, att: 1.6, rel: 1.0, amp: 0.05, cutoff: 1500, seed: 'cello', ampAt: ramp([[E.n182, 0.8], [E.n600, 1.1]]) }); notes.strings++; }
  const line9 = progA.filter(([t]) => t >= SC.S8.t0 - 1e-6);
  str(line9, endA - 0.3, { voicing: (c) => [CH[c][0] - 12, ...CH[c]], att: 0.7, rel: 1.4, amp: 0.05, cutoff: ramp([[SC.S8.t0, 1700], [E.equals, 3200], [E.slam, 4200], [E.slam + 2.5, 2200]]), seed: 'strLine9', send: 0.55,
    ampAt: ramp([[SC.S8.t0, 0.7], [E.sum600, 1.05], [E.equals, 1.3], [E.slam, 1.45], [E.slam + 1.5, 1.0], [E.lampOut, 0.55]]) });
  cue(SC.S8.t0, 'full strings: Gm - Bb - Asus - A - Dm (crescendo into the slam)');
  // the slam: choir "ah" on D minor (plus a low D under it), sustains and thins out until the lamp dies
  cho([[E.slam, 'Dm']], E.lampOut - 0.15, { voicing: () => [50, 57, 62, 65, 69, 74], att: 0.09, rel: 1.0, amp: 0.085, seed: 'choirSlam', ampAt: ramp([[E.slam, 1], [E.slam + 1.2, 0.8], [E.lampOut, 0.45]]) });
  cue(E.slam, 'choir "ah" D minor on the slam');

  // pulse: 80 BPM eighths from the tracker on, re-anchored on every number, resting in each anticipation dip
  const EIGHTH = 60 / 80 / 2;
  const anchors = [E.tracker, E.n187, E.n182, E.n600, E.sum187, E.sum182, E.sum600];
  anchors.forEach((a, k) => {
    const b = k + 1 < anchors.length ? anchors[k + 1] - 0.3 : E.equals - 0.02;
    pulse(a, b, EIGHTH, progA, { seed: 'pulseMath', oct: k >= 3, cutoffAt: ramp([[E.tracker, 380], [E.n187, 440], [E.n600, 560], [E.sum187, 650], [E.sum600, 800]]), velAt: ramp([[E.tracker, 0.65], [E.n187, 0.85], [E.n600, 0.95], [E.sum187, 1.0], [E.sum600, 1.08]]) });
  });
  cue(E.tracker, 'pulse 80 BPM (re-anchored on each number, rests in each dip)');
  // tension in line 9: a soft muted 16th ostinato (A4 / D5) between the sums
  for (let j = 0; SC.S8.t0 + 0.2 + j * EIGHTH / 2 < E.equals - 0.05; j++) {
    const t = SC.S8.t0 + 0.2 + j * EIGHTH / 2, u = (t - SC.S8.t0) / (E.equals - SC.S8.t0);
    I.pluckNote(music, { midi: j % 2 ? 74 : 69, t, vel: (0.1 + 0.12 * u) * (j % 4 === 0 ? 1.3 : 1), cutoff: 900 + 900 * u, decay: 0.05, pan: j % 2 ? 0.3 : -0.3, gain: 0.5, sends: MS(0.25), seed: 'ostinato' });
    notes.pulse++;
  }
  // timpani under the sums, a roll into the equals, the slam
  timp(E.sum187, 'D2', 0.45, 0.8); timp(E.sum182, 'Bb1', 0.5, 0.85); timp(E.sum600, 'A1', 0.55, 0.9);
  for (let j = 0, t = E.equals - 0.3; t < E.slam - 0.03; j++, t += 0.055) timp(t, 'A1', 0.18 + 0.4 * (t - E.equals + 0.3) / 0.65, 0.35 + 0.5 * (t - E.equals + 0.3) / 0.65, 0.8);
  timp(E.slam, 'D2', 0.95, 1.6, 4);
  cue(E.equals - 0.3, 'timpani roll into the slam');

  // felt piano: sparse, in the gaps where possible
  piano([
    [0.95, 'A4', 0.19, 3], [1.75, 'D5', 0.21], [2.55, 'F5', 0.21], [3.86, 'E5', 0.24, 3], [4.95, 'C#5', 0.2, 2.4],   // S1 lamp motif
    [5.36, 'D4', 0.2, 3], [5.38, 'A4', 0.2, 3], [6.92, 'F5', 0.22], [7.45, 'C5', 0.2], [8.25, 'A4', 0.2], [9.45, 'G4', 0.18],  // S2
    [10.0, 'F4', 0.2], [10.42, 'Bb4', 0.21], [10.84, 'D5', 0.22, 3], [12.0, 'C5', 0.21], [12.42, 'F5', 0.22, 3],          // S3 rising
    [13.5, 'D5', 0.2], [13.92, 'G5', 0.2, 2.6], [E.enochGone + 0.02, 'A5', 0.2, 3.5], [E.enochGone + 0.3, 'C6', 0.17, 3.5],
    [16.0, 'D4', 0.2], [16.6, 'A4', 0.2], [17.2, 'F4', 0.19], [18.6, 'E4', 0.17], [19.0, 'D5', 0.2], [19.6, 'Bb4', 0.18],   // S4 walking
    [20.6, 'A4', 0.17], [21.1, 'C5', 0.2], [21.6, 'F5', 0.19], [22.2, 'E5', 0.2], [22.55, 'C#5', 0.18],
    [E.slam, 'D2', 0.26, 3.2], [E.slam + 0.01, 'A2', 0.25, 3.2], [E.slam + 0.02, 'D3', 0.27, 3.2],                          // weight under the slam
    [42.05, 'A4', 0.17, 2], [42.95, 'F4', 0.16, 2], [E.lampOut, 'D4', 0.17, 2],                                           // "...died."
  ], 'feltA');

  // ================================================================ B) after the drop: rain, time-lapse, flood, city, D major
  const t10 = E.dropSplash + 0.3;
  const { bars, beat } = G;
  const progB = [
    [t10, 'Dm'],                                   // cold first rain
    [W('B11', 'when'), 'Bb'],                      // "when he dies..."
    [W('B11', 'sent'), 'Gm'],                      // "...it shall be sent"
    [bars[0], 'Dm'], [bars[1], 'Bb'], [bars[2], 'F'], [bars[3], 'Gm'], [bars[4], 'Asus'], [bars[4] + 2 * beat, 'A'],   // time-lapse
    [E.floodCrack, 'GmD', { att: 0.35 }],          // the sky cracks: dark, low
    [E.arkLift, 'BbL'],                            // the ark lifts
    [E.city, 'Dm'],                                // match cut: rain on the city
    [W('B14', 'Not'), 'Bb'],                       // "Not to punish you..."
    [W('B14', 'you', 0), 'Asus'],
    [E.warmLight - 0.4, 'A'],
    [E.warmLight, 'D', { att: 1.2 }],              // "...but FOR you": D MAJOR
    [W('B15', 'Lord'), 'G'], [W('B15', 'willing'), 'Bm'], [W('B15', 'perish'), 'G'], [W('B15', 'but'), 'Asus'], [W('B15', 'come'), 'A'], [W('B15', 'repentance'), 'D'],
    [E.cta, 'Bm'],                                 // "Coincidence..."
    [W('B16', 'or'), 'G'],                         // "...or God's
    [E.hourglass, 'D'],                            //  timing?" (IV -> I, amen)
    [W('B16', 'Comment'), 'A'],
    [E.endCard, 'Dadd9'],
    [E.loopBack, 'D5', { att: 0.5 }],              // the third falls away: D-A carries over the loop into the D minor hook
  ];
  const endB = dur + 0.3;
  const cutB = ramp([[t10, 750], [bars[0], 1000], [bars[2], 1500], [bars[4], 1800], [E.floodCrack, 1000], [E.city, 950], [E.warmLight, 1000], [E.warmLight + 3.6, 2600], [E.cta, 2400], [E.endCard, 2200], [dur, 2100]]);
  const ampB = ramp([[t10, 0.6], [bars[0], 0.72], [bars[2], 0.9], [bars[4], 1.0], [E.floodCrack, 0.85], [E.city, 0.7], [E.warmLight, 1.05], [E.cta, 0.95], [E.endCard, 0.85]]);
  pad(progB, endB, { att: 1.5, att0: 1.8, rel: 2.0, amp: 0.13, ampAt: ampB, cutoff: cutB, seed: 'padB', bloom: 0.35 });
  for (const [t, n] of progB) cue(t, `chord ${n}`);
  // drone back under the cold rain and the flood
  for (const [a, b, g] of [[t10, bars[0] + 1.2, 0.9], [E.floodCrack - 0.2, E.city + 1.5, 1.2]]) {
    for (const m of [38, 45]) I.padNote(music, { midi: m, t0: a, t1: b, att: 2.0, rel: 1.5, amp: (m === 38 ? 0.06 : 0.032) * g, cutoff: () => 400, wave: 'tri', voices: 1, detune: 0, spread: 0, sends: MS(0.15), seed: 'droneB', bloom: 0.2, lfo: 0.1, drift: 0.8 });
  }
  // thin glassy A6 (cold air) over the first rain
  I.padNote(music, { midi: 93, t0: t10 + 0.8, t1: bars[0], att: 2.2, rel: 1.5, amp: 0.016, cutoff: () => 5000, wave: 'sine', voices: 2, detune: 5, spread: 0.6, sends: MS(0.8), seed: 'glass', lfo: 0 });
  // bass: time-lapse, flood pedal, city, major
  bass(progB.filter(([t]) => t >= bars[0] - 1e-6), endB, { amp: 0.075, att: 0.35, att0: 1.0, rel: 1.2, seed: 'bassB', root: { ...ROOT, GmD: 38, BbL: 38 },
    ampAt: ramp([[bars[0], 0.7], [bars[2], 0.95], [E.floodCrack, 1.25], [E.city, 0.75], [E.warmLight, 1.05], [E.endCard, 0.9]]) });

  // time-lapse: pulse on the 92 BPM grid (eighths), growing bar by bar, stops on the crack
  pulse(bars[0], E.floodCrack - 0.04, beat / 2, progB, { seed: 'pulseTL', oct: true, cutoffAt: ramp([[bars[0], 420], [bars[2], 600], [bars[4], 780]]), velAt: ramp([[bars[0], 0.55], [bars[1], 0.75], [bars[3], 0.95], [bars[4], 1.05]]) });
  cue(bars[0], `time-lapse grid ${(60 / beat).toFixed(1)} BPM, bars at ${bars.map((b) => b.toFixed(2)).join(' ')}`);
  // strings enter on bar 2 and swell to the flood
  str(progB.filter(([t]) => t >= bars[1] - 1e-6 && t < E.floodCrack - 1e-6), E.floodCrack + 0.15, { voicing: (c) => [CH[c][0] - 12, ...CH[c].slice(1)], att: 1.4, rel: 0.9, amp: 0.045, cutoff: ramp([[bars[1], 1400], [bars[4], 2800], [E.floodCrack, 3400]]), seed: 'strTL',
    ampAt: ramp([[bars[1], 0.6], [bars[3], 0.9], [bars[4], 1.1], [E.floodCrack - 0.1, 1.3]]) });
  // choir "oo" for the card (God waited), into the flood
  cho(progB.filter(([t]) => t >= bars[3] - 1e-6 && t < E.city - 1e-6), E.city + 0.4, { voicing: (c) => CH[c].slice(0, 3), att: 1.4, rel: 1.6, amp: 0.05, seed: 'choirTL', ampAt: ramp([[bars[3], 0.7], [E.floodCrack, 1.0], [E.city, 0.6]]) });
  // timpani: a soft roll through the last bar into the crack, the crack itself, the ark lifting
  for (let t = bars[4] + 2 * beat; t < E.floodCrack - 0.03; t += 0.06) { const u = (t - bars[4] - 2 * beat) / (2 * beat); timp(t, 'A1', 0.15 + 0.35 * u, 0.25 + 0.45 * u, 0.8); }
  timp(E.floodCrack, 'D2', 0.8, 1.2, 4); timp(E.arkLift, 'Bb1', 0.5, 0.7, 3);
  // flood: low string tremolo on the dark chords (storm), not loud
  str([[E.floodCrack, 'GmD'], [E.arkLift, 'BbL']], E.city + 0.6, { voicing: (c) => CH[c].map((m) => m - 12).slice(0, 3), att: 0.4, rel: 1.4, amp: 0.05, cutoff: 1100, seed: 'tremolo',
    ampAt: (t) => (0.65 + 0.35 * Math.sin(2 * Math.PI * 9 * t)) * (t < E.city ? 1 : Math.max(0, 1 - (t - E.city) / 0.6)) });
  cue(E.floodCrack, 'flood: low string tremolo, choir "oo", timpani (dark, not loud)');

  // city at night: high soft strings, then the warm light: strings + choir swell into D major
  str([[E.city + 0.5, 'Dm'], [W('B14', 'Not'), 'Bb'], [W('B14', 'you', 0), 'Asus'], [E.warmLight - 0.4, 'A']], E.warmLight + 0.1, { voicing: (c) => CH[c].slice(-2).map((m) => m + 12), att: 2.0, rel: 1.2, amp: 0.022, cutoff: 3000, seed: 'strCity', send: 0.8 });
  const major = progB.filter(([t]) => t >= E.warmLight - 1e-6);
  str(major.filter(([t]) => t < E.loopBack - 1e-6), E.loopBack + 0.4, { voicing: (c) => [CH[c][0] - 12, ...CH[c].slice(1)], att: 1.6, rel: 2.0, amp: 0.045, cutoff: ramp([[E.warmLight, 1400], [E.warmLight + 3, 2800], [E.cta, 2400], [E.endCard, 2000]]), seed: 'strMajor',
    ampAt: ramp([[E.warmLight, 0.8], [E.warmLight + 3, 1.1], [E.cta, 0.8], [E.endCard, 0.65], [E.loopBack, 0.5]]) });
  cho(major.filter(([t]) => t < E.cta - 1e-6), E.cta + 0.5, { voicing: (c) => CH[c].slice(1).map((m) => m + 0), att: 1.8, rel: 2.2, amp: 0.06, seed: 'choirWarm', ampAt: ramp([[E.warmLight, 0.8], [E.warmLight + 2.5, 1.1], [W('B15', 'repentance'), 0.9], [E.cta, 0.5]]) });
  cue(E.warmLight, 'D MAJOR: warm pad bloom + choir "oo -> ah" + strings ("for you")');
  // glow layer: soft triangle an octave above the top of each major chord (light falling)
  const glowProg = major;
  glowProg.forEach(([t0, name], k) => {
    const t1 = k + 1 < glowProg.length ? glowProg[k + 1][0] : endB, top = CH[name].slice(-2);
    for (const m of top) I.padNote(music, { midi: m + 12, t0, t1, att: k ? 1.4 : 3.0, rel: 2.0, amp: 0.02, cutoff: () => 6000, wave: 'tri', voices: 2, detune: 6, spread: 0.9, sends: MS(0.9), seed: 'glow', lfo: 0, bloom: 0 });
  });
  // a light pulse returns for the question (80 BPM), and leaves for the end card
  pulse(E.cta + 0.2, E.endCard - 0.2, EIGHTH, progB, { seed: 'pulseCTA', cutoff: 400, decay: 0.15, velAt: ramp([[E.cta, 0.4], [E.cta + 1.5, 0.62], [E.endCard - 0.6, 0.45]]) });

  // loop pre-roll: the reel opens on the open fifth the end dissolves into (same voicing, level, filter and
  // glow), releasing under the hook hit while the hook's D minor enters, so the restart is continuous
  {
    const endAmp = 0.13 * ampB(dur), endCut = cutB(dur);
    for (const m of CH.D5) I.padNote(music, { midi: m, t0: 0, t1: E.hookHit + 0.1, att: 0.004, rel: 1.8, amp: endAmp, cutoff: () => endCut, seed: 'preroll', bloom: 0, sends: MS(0.45) });
    for (const m of CH.D5.slice(-2)) I.padNote(music, { midi: m + 12, t0: 0, t1: E.hookHit + 0.1, att: 0.004, rel: 1.6, amp: 0.02, cutoff: () => 6000, wave: 'tri', voices: 2, detune: 6, spread: 0.9, sends: MS(0.9), seed: 'prerollGlow', lfo: 0, bloom: 0 });
    I.bassNote(music, { midi: 38, t0: 0, t1: E.hookHit + 0.1, amp: 0.075 * 0.9, att: 0.004, rel: 1.0, sends: MS(0.06), seed: 'prerollBass' });
    cue(0, 'loop pre-roll: open fifth D-A (continues the end) releasing under the hook hit');
  }

  piano([
    [46.35, 'A5', 0.15, 3], [47.05, 'F5', 0.15, 3], [47.75, 'D5', 0.17, 3], [48.3, 'D5', 0.15], [49.08, 'F5', 0.15], [50.15, 'Bb4', 0.16, 2.6], [50.45, 'G4', 0.15, 2.6],  // S10 cold
    [bars[2], 'A4', 0.2], [bars[2] + beat, 'C5', 0.2], [bars[2] + 2 * beat, 'F5', 0.22, 2.6], [bars[2] + 3.5 * beat, 'E5', 0.2],                                        // time-lapse
    [bars[3], 'D5', 0.21], [bars[3] + beat, 'Bb4', 0.2], [bars[3] + 2 * beat, 'G4', 0.2, 2.6], [bars[4], 'E5', 0.21], [bars[4] + 2 * beat, 'C#5', 0.22, 2.4],
    [66.62, 'A4', 0.16, 3], [67.42, 'D5', 0.17, 3], [68.2, 'F5', 0.16, 3], [68.62, 'D5', 0.16], [69.3, 'E5', 0.17], [69.85, 'C#5', 0.17],                              // city
    [E.warmLight + 0.02, 'D5', 0.23, 3.5], [E.warmLight + 0.06, 'F#5', 0.24, 3.5], [E.warmLight + 0.1, 'A5', 0.22, 3.5],                                            // FOR you
    [71.32, 'B4', 0.2], [71.36, 'D5', 0.2, 2.6], [72.82, 'F#5', 0.21, 2.6], [73.96, 'G5', 0.2, 2.6], [75.1, 'E5', 0.2], [75.95, 'C#5', 0.21], [76.45, 'D5', 0.22, 3], [76.5, 'A5', 0.2, 3],
    [77.5, 'F#5', 0.2, 2.6], [78.7, 'B4', 0.2], [78.74, 'D5', 0.2, 2.4], [E.hourglass + 0.02, 'F#4', 0.2, 3], [E.hourglass + 0.04, 'D5', 0.2, 3], [80.1, 'C#5', 0.19], [80.14, 'E5', 0.18, 2.4],
    [E.endCard + 0.05, 'D4', 0.2, 3.5], [E.endCard + 0.45, 'A4', 0.2, 3.5], [E.endCard + 0.85, 'E5', 0.19, 3], [E.endCard + 1.25, 'F#5', 0.2, 3], [E.loopBack - 0.15, 'A4', 0.16, 2.5], [E.loopBack + 0.1, 'D5', 0.15, 2.5],
  ], 'feltB');

  // ================================================================ string ensemble chorus, choir formants, buses
  D.chorus(strings, { seed: 'strChorus', mix: 0.55 });
  const tw = (a, b, t) => smooth((t - a) / (b - a));
  I.formantChoir(choir, (t) => {
    if (t < E.lampOut + 1) return { ah: 1 };
    if (t < E.warmLight) return { oo: 1 };
    if (t < E.cta) { const u = tw(E.warmLight + 0.3, E.warmLight + 2.8, t); return { oo: 1 - u, ah: u * 0.6, oh: u * 0.4 }; }
    return { oh: 1 };
  });
  for (const [bus, g, send] of [[strings, 1, 0.5], [choir, 1, 0.65]]) {
    for (let i = 0; i < N; i++) { const l = bus.L[i] * g, r = bus.R[i] * g; music.L[i] += l; music.R[i] += r; hall[i] += (l + r) * 0.5 * send; }
  }
  return { music, hall, notes };
}
