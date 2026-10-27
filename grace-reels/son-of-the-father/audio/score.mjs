// SON OF THE FATHER: the score. D minor, tense and cinematic through the trial (low strings, low drums, a low
// brass hit on the reveal, an ostinato over Jerusalem, a dark Phrygian riot), HARD STOP on the crowd's shout,
// near silence, a mysterious drone as the name unlocks (a golden Bb chord on "son of the FATHER"), then the
// swap: emotional strings lift into D MAJOR on "the true SON of the Father", the biggest warm swell (choir) on
// 1 Peter 3:18 and the warmest bloom on "YOU are Barabbas". Every time comes from the shared plan (ctx.E /
// ctx.W / ctx.SC / plan.shots).
import * as D from './lib/dsp.mjs';
import * as I from './lib/instruments.mjs';
import * as X from './lib/sfx.mjs';

const { nm, clamp, lerp, ramp, smooth } = D;

// chord voicings (MIDI, mid register, voice-led) and bass roots
export const CH = {
  Dm: [57, 62, 65, 69], Bb: [58, 62, 65, 70], Bbmaj9: [58, 60, 65, 69], Gm: [55, 58, 62, 67], F: [57, 60, 65, 69], C: [55, 60, 64, 67],
  A: [57, 61, 64, 69], Asus: [57, 62, 64, 69],
  DmL: [50, 57, 62, 65], EbL: [51, 55, 58, 63],                       // the riot: dark, low, on a D pedal (Phrygian Eb/D)
  D: [57, 62, 66, 69], DF: [54, 57, 62, 66], G: [55, 59, 62, 67], Em: [55, 59, 64, 67], Bm: [54, 59, 62, 66], AC: [57, 61, 64, 69], DA: [57, 62, 66, 69],
  Dadd9: [57, 62, 64, 66, 69], D5: [50, 57, 62, 69],                  // open fifth: the loop seam (neither major nor minor)
};
export const ROOT = { Dm: 38, Bb: 34, Bbmaj9: 34, Gm: 43, F: 41, C: 36, A: 33, Asus: 33, DmL: 38, EbL: 38, D: 38, DF: 42, G: 43, Em: 40, Bm: 35, AC: 37, DA: 33, Dadd9: 38, D5: 38 };

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
  // buses run 4 s past the end: synth.mjs wraps that overflow onto the start, so whatever rings at the end
  // of the reel (the open-fifth D-A, its glow and bass) continues seamlessly into frame 0 of the loop
  const { NB, E, W, SC, cue, dur, plan } = ctx;
  const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const music = D.stereo(NB), strings = D.stereo(NB), choir = D.stereo(NB), hall = D.f32(NB);
  const MS = (amt) => [[hall, amt]];
  const notes = { pad: 0, strings: 0, choir: 0, piano: 0, pulse: 0, timp: 0, bass: 0, drums: 0, brass: 0 };

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
      I.stringNote(strings, { midi: s.m, t0: s.t0, t1: s.t1, att: s.opt.att ?? (s.k === 0 ? o.att0 ?? o.att : o.att), rel: o.rel, amp: o.amp, cutoff: o.cutoff, ampAt: o.ampAt,
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
  const timp = (t, n, vel, g = 1, d = 3) => { D.place(music, D.scale(I.timpani(D.mtof(nm(n)), { dur: d, vel, seed: 'timp' + t.toFixed(2) }), 0.23 * g), t, 1, 0, MS(0.35)); notes.timp++; };
  const roll = (a, b, n, v0, v1, g0, g1, step = 0.055) => { for (let t = a; t < b - 0.02; t += step) { const u = (t - a) / Math.max(0.01, b - a); timp(t, n, lerp(v0, v1, u), lerp(g0, g1, u), 0.8); } };
  const drum = (t, f, vel, g, { muffle = 0, pan = 0, send = 0.22, seed = 'tk' } = {}) => { D.place(music, D.scale(X.taiko({ f, vel, muffle, seed: seed + t.toFixed(3) }), 0.3 * g), t, 1, pan, MS(send)); notes.drums++; };
  const tap = (t, f, g, { bright = 0.5, pan = 0, lp = 0, seed = 'tp' } = {}) => { const x = X.frameTap({ f, bright, seed: seed + t.toFixed(3) }); if (lp) D.lp4(x, lp); D.place(music, D.scale(x, 0.12 * g), t, 1, pan, MS(0.18)); notes.drums++; };
  const brass = (o) => { I.brassStab(music, { sends: MS(o.send ?? 0.4), ...o }); notes.brass++; };
  const pulse = (a, b, step, prog, o) => {
    for (let j = 0; a + j * step < b; j++) {
      const t = a + j * step, tones = (o.tones ?? ((c) => CH[c]))(chordAt(prog, t)), pat = o.pattern ?? [0, 2, 1, 3, 0, 2, 3, 1];
      const m = tones[pat[j % pat.length] % tones.length] + (o.oct ?? 0), onBeat = j % 2 === 0;
      const vel = (onBeat ? 0.55 : 0.36) * (j % 4 === 0 ? 1.15 : 1) * (o.velAt ? o.velAt(t) : 1);
      I.pluckNote(music, { midi: m, t: t + 0.003 * Math.sin(j * 2.1), vel, cutoff: o.cutoffAt ? o.cutoffAt(t) : o.cutoff ?? 900, decay: o.decay ?? 0.14,
        pan: (j % 2 ? 0.18 : -0.18), gain: o.gain ?? 0.5, sends: MS(o.send ?? 0.2), seed: o.seed });
      notes.pulse++;
    }
  };

  // ================================================================ A) S1 the hook: drums in the fast orbit, then "underwater"
  const H0 = E.hookHit, RS = E.rampSlow, RV = E.reveal, CK = E.chainClank;
  {
    const step = (RS - H0) / 8;                                       // 8 sixteenths from the title hit to the speed ramp
    [[0, 1.0, 52], [3, 0.6, 62], [4, 0.85, 55], [6, 0.65, 62], [7, 0.9, 55]].forEach(([k, v, f]) => drum(H0 + k * step, f, v, v, { seed: 'hookDr' }));
    for (let k = 1; k < 8; k++) if (![3, 4, 6, 7].includes(k)) tap(H0 + k * step, 180, 0.6, { seed: 'hookTap' });
    brass({ midi: [38, 45, 50, 53], t: H0, dur: 0.35, rel: 0.9, amp: 0.075, peak: 2200, seed: 'hookBrass' });
    // low string tremolo under the fast orbit (D2 A2 D3), cut into the ramp
    for (const m of [38, 45, 50]) {
      I.stringNote(strings, { midi: m, t0: H0, t1: RS, att: 0.08, rel: 0.12, amp: 0.05, cutoff: 1600, seed: 'hookTrem', vib: { rate: 5, cents: 4, delay: 0.2, att: 0.4 },
        ampAt: (t) => (0.6 + 0.4 * Math.sin(2 * Math.PI * 12 * t)) * lerp(0.7, 1.1, clamp((t - H0) / (RS - H0))) });
      notes.strings++;
    }
    cue(H0, 'hook: low drums + low brass + string tremolo in the fast orbit');
    // the speed ramp: everything drops "underwater" -> one deep held note (D2 + D3), until the reveal
    I.padNote(music, { midi: 38, t0: RS - 0.03, t1: RV - 0.15, att: 0.25, rel: 0.4, amp: 0.075, cutoff: () => 520, wave: 'tri', voices: 2, detune: 4, spread: 0.3, sends: MS(0.3), seed: 'heldD', bloom: 0.1, lfo: 0.05 });
    I.stringNote(strings, { midi: 50, t0: RS - 0.03, t1: RV - 0.12, att: 0.35, rel: 0.4, amp: 0.034, cutoff: 900, voices: 3, seed: 'heldStr', vib: { rate: 4.6, cents: 5, delay: 0.6, att: 1.2 } });
    notes.pad++; notes.strings++;
    cue(RS, 'speed ramp: music drops to ONE deep held note (D2 + D3)');
    // He lifts His eyes: a soft "oo" (D5 + A5) blooms, then a string crescendo sucks into the whip
    cho([[E.eyesLift - 0.35, 'x']], RV - 0.1, { voicing: () => [74, 81], att: 0.9, rel: 0.25, amp: 0.032, seed: 'eyesOo' });
    str([[RV - 1.0, 'x']], RV - 0.02, { voicing: () => [50, 57, 62], att: 0.95, rel: 0.05, amp: 0.05, cutoff: 2600, seed: 'preWhip', ampAt: (t) => Math.pow(clamp((t - RV + 1.0) / 1.0), 1.6) * 1.2 });
    roll(RV - 0.55, RV - 0.02, 'A1', 0.15, 0.6, 0.2, 0.75);
    cue(E.eyesLift, 'eyes lift: soft choir "oo" D5/A5; string crescendo + timpani roll into the whip');
  }

  // ================================================================ B) S2 the reveal .. S4 Pilate (D minor, 84 BPM)
  const BEAT = 60 / 84, E8 = BEAT / 2;
  const progB = [
    [RV, 'Dm', { att: 0.3 }],                     // the whip lands on Barabbas
    [W('B02', 'name'), 'Bb'],                     // "...that murderer's NAME..."
    [W('B02', 'shock'), 'Gm'],                    // "...will SHOCK
    [W('B02', 'you'), 'A'],                       //  you."
    [S.S3.t0, 'F'],                               // crane-up over Jerusalem: brighter (relative major)
    [W('B03', 'governor'), 'C'],
    [W('B03', 'prisoner'), 'Dm'],
    [W('B03', 'free'), 'Bb'],
    [S.S4.t0, 'Gm'],                              // Pilate: cool
    [W('B04', 'two'), 'Bb'],
    [W('B04', 'men'), 'Asus'],
  ];
  const endB = S.S5.t0;
  pad(progB, endB + 0.1, { att: 0.9, att0: 0.4, rel: 1.2, amp: 0.12, seed: 'padB',
    cutoff: ramp([[RV, 800], [RV + 2, 1000], [S.S3.t0, 1500], [S.S3.t0 + 2, 2300], [S.S4.t0, 1100], [endB, 900]]),
    ampAt: ramp([[RV, 0.85], [S.S3.t0, 0.9], [S.S4.t0, 0.85]]) });
  for (const [t, n] of progB) cue(t, `chord ${n}`);
  // the reveal: low brass hit + big drum on the chain jerk
  brass({ midi: [38, 45, 50, 53, 57], t: CK, dur: 0.5, rel: 1.3, amp: 0.09, peak: 2600, floor: 320, seed: 'revealBrass' });
  drum(CK, 50, 1, 1.1, { seed: 'revealDr', send: 0.3 }); timp(CK, 'D2', 0.8, 0.8, 3.5);
  cue(CK, 'REVEAL: low brass hit (D minor) + big drum + timpani on the chain jerk');
  // strings: full section from the reveal; high and airy over the city; low and cool for Pilate
  str(progB.filter(([t]) => t < S.S3.t0 - 1e-6), S.S3.t0 + 0.05, { voicing: (c) => [CH[c][0] - 12, ...CH[c]], att: 0.7, att0: 0.25, rel: 0.6, amp: 0.045, cutoff: 1900, seed: 'strB',
    ampAt: ramp([[RV, 0.75], [RV + 1, 0.9], [S.S3.t0 - 0.6, 1.0], [S.S3.t0, 0.9]]) });
  str(progB.filter(([t]) => t >= S.S3.t0 - 1e-6 && t < S.S4.t0 - 1e-6), S.S4.t0 + 0.1, { voicing: (c) => CH[c].slice(-2).map((m) => m + 12), att: 1.0, rel: 1.0, amp: 0.03, cutoff: 3600, seed: 'strCity', send: 0.7 });
  str(progB.filter(([t]) => t >= S.S3.t0 - 1e-6), endB + 0.05, { voicing: (c) => [CH[c][0] - 12, CH[c][1], CH[c][2]], att: 0.9, rel: 0.7, amp: 0.035, cutoff: ramp([[S.S3.t0, 1800], [S.S4.t0, 1100]]), seed: 'strLow', send: 0.55 });
  bass(progB, endB + 0.05, { amp: 0.075, att: 0.2, att0: 0.05, rel: 0.6, seed: 'bassB', ampAt: ramp([[RV, 1], [S.S3.t0, 0.85], [S.S4.t0, 0.9]]) });
  // low drums (84 BPM) under the reveal: a heavy heartbeat-like figure, a pickup into the crane-up
  for (let t = CK + E8, k = 1; t < S.S3.t0 - 0.25; t += E8, k++) {
    const pos = k % 8, v = { 0: 0.9, 3: 0.5, 4: 0.75, 7: 0.4 }[pos];
    if (v) drum(t, pos === 0 ? 50 : 58, v, v * 0.85, { seed: 'revDr', muffle: 0.25 });
    else if (pos === 6) tap(t, 170, 0.5, { seed: 'revTap', lp: 2500 });
  }
  drum(S.S3.t0 - 0.18, 62, 0.5, 0.4, { seed: 'pick' }); drum(S.S3.t0 - 0.09, 62, 0.6, 0.5, { seed: 'pick' });
  // over Jerusalem: a bright plucked ostinato (84 BPM eighths) that turns muted and cool for Pilate
  pulse(S.S3.t0, endB - 0.05, E8, progB, { seed: 'ostinato', tones: (c) => CH[c].map((m) => m + 12), pattern: [0, 2, 1, 3, 0, 2, 3, 1], decay: 0.13,
    cutoffAt: ramp([[S.S3.t0, 1500], [S.S3.t0 + 2, 1900], [S.S4.t0, 750], [endB, 650]]), velAt: ramp([[S.S3.t0, 0.7], [S.S3.t0 + 1.5, 0.9], [S.S4.t0, 0.7], [endB, 0.55]]) });
  cue(S.S3.t0, 'over Jerusalem: bright ostinato (84 BPM eighths), high strings, light drums');
  for (let t = S.S3.t0, k = 0; t < S.S4.t0 - 0.1; t += 2 * BEAT, k++) drum(t, 55, k ? 0.55 : 0.85, k ? 0.5 : 0.8, { seed: 'cityDr', send: 0.35 });
  for (let t = S.S4.t0, k = 0; t < endB - 0.1; t += BEAT, k++) drum(t, 60, k % 2 ? 0.4 : 0.6, k % 2 ? 0.35 : 0.5, { seed: 'march', muffle: 0.55, send: 0.5 });
  cue(S.S4.t0, 'Pilate: cool Gm, muted ostinato, a slow processional drum, marble hall');
  timp(S.S4.t0, 'G1', 0.45, 0.5, 3);

  // ================================================================ C) S5 who Jesus is: warm F / Bb, one glow per memory
  const progC = [[S.S5.t0, 'Bbmaj9'], [E.mem1, 'F'], [E.mem2, 'C'], [E.mem3, 'F']];
  const endC = S.S6.t0;
  pad(progC, endC, { att: 0.7, att0: 0.5, rel: 0.5, amp: 0.13, cutoff: ramp([[S.S5.t0, 1300], [E.mem1, 1800], [E.mem3, 2200], [endC, 2000]]), seed: 'padC', bloom: 0.55 });
  for (const [t, n] of progC) cue(t, `chord ${n}`);
  str(progC, endC + 0.02, { voicing: (c) => CH[c].slice(-2).map((m) => m + 12), att: 0.6, rel: 0.25, amp: 0.032, cutoff: 3800, seed: 'strMem', send: 0.7 });
  str(progC, endC + 0.02, { voicing: (c) => [CH[c][0] - 12, CH[c][1]], att: 0.8, rel: 0.25, amp: 0.03, cutoff: 1500, seed: 'strMemLo' });
  cho(progC.slice(1), endC, { voicing: (c) => CH[c].slice(1, 3), att: 0.5, rel: 0.25, amp: 0.035, seed: 'choirMem' });
  bass(progC, endC, { amp: 0.06, att: 0.4, rel: 0.2, seed: 'bassC' });
  piano([
    [S.S5.t0 + 0.06, 'D5', 0.19, 3], [S.S5.t0 + 0.5, 'F5', 0.17, 2.6],
    [E.mem1 + 0.02, 'A5', 0.21, 2.6], [E.mem1 + 0.3, 'C6', 0.17, 2.4],
    [E.mem2 + 0.02, 'G5', 0.2, 2.4], [E.mem2 + 0.28, 'E6', 0.17, 2.4],
    [E.mem3 + 0.02, 'A5', 0.21, 3], [E.mem3 + 0.3, 'C6', 0.18, 3], [W('B05', 'dead'), 'F6', 0.17, 3],
  ], 'feltMem');
  cue(S.S5.t0, 'memories: warm Bbmaj9 -> F -> C -> F, high strings, choir "oo", piano glints');

  // ================================================================ D) S6 who Barabbas is: the night riot (dark Phrygian, muffled drums)
  const progD = [[S.S6.t0, 'DmL'], [W('B06', 'A'), 'EbL'], [W('B06', 'committed'), 'DmL'], [W('B06', 'murder'), 'EbL'], [W('B06', 'in'), 'DmL']];
  const endD = S.S7.t0;
  pad(progD, endD + 0.15, { att: 0.5, att0: 0.15, rel: 0.6, amp: 0.11, cutoff: () => 650, seed: 'padD', bloom: 0.2 });
  for (const [t, n] of progD) cue(t, `chord ${n} (riot)`);
  for (const m of [38, 45]) { I.padNote(music, { midi: m, t0: S.S6.t0 - 0.05, t1: endD + 0.2, att: 0.4, rel: 0.8, amp: m === 38 ? 0.06 : 0.035, cutoff: () => 420, wave: 'tri', voices: 1, detune: 0, spread: 0, sends: MS(0.15), seed: 'droneD', bloom: 0.2, lfo: 0.1, drift: 0.8 }); notes.pad++; }
  str(progD, endD + 0.1, { voicing: (c) => CH[c], att: 0.25, att0: 0.1, rel: 0.5, amp: 0.035, cutoff: 1100, seed: 'tremD', ampAt: (t) => 0.62 + 0.38 * Math.sin(2 * Math.PI * 11 * t) });
  brass({ midi: [39, 46, 51], t: W('B06', 'murder') - 0.45, dur: 0.5, rel: 0.9, amp: 0.045, swell: 0.45, peak: 1300, floor: 300, seed: 'riotBrass', send: 0.3 });
  // drums: low and muffled, as if heard through walls (84 BPM, 16th ghost taps)
  for (let t = S.S6.t0, k = 0; t < endD - 0.2; t += E8 / 2, k++) {
    const pos = k % 16;
    if (pos === 0 || pos === 10) drum(t, 52, pos ? 0.6 : 0.85, pos ? 0.55 : 0.8, { muffle: 0.8, seed: 'riotDr', send: 0.15 });
    else if (pos === 8) drum(t, 60, 0.6, 0.55, { muffle: 0.8, seed: 'riotDr2', send: 0.15 });
    else if ([2, 3, 6, 11, 14, 15].includes(pos)) tap(t, 150 + 20 * (pos % 3), 0.45 + 0.1 * (pos === 14), { bright: 0.2, lp: 1100, seed: 'riotTap', pan: pos % 2 ? 0.2 : -0.2 });
  }
  timp(W('B06', 'murder'), 'D2', 0.6, 0.7, 3);
  cue(S.S6.t0, 'riot: D-A drone, Eb/D Phrygian tremolo, muffled 16th drums, a dark low brass swell on "murder"');

  // ================================================================ E) S7 the question, S8 the shout (tension -> HARD STOP)
  const progE = [[S.S7.t0, 'Dm'], [W('B07', 'Whether'), 'Bb'], [W('B07', 'will'), 'Gm'], [W('B07', 'release'), 'Asus']];
  const endE = S.S8.t0;
  pad(progE, endE + 0.02, { att: 1.2, att0: 0.8, rel: 0.4, amp: 0.1, cutoff: () => 620, seed: 'padE', bloom: 0.25 });
  for (const [t, n] of progE) cue(t, `chord ${n}`);
  str(progE, endE + 0.02, { voicing: (c) => CH[c].map((m) => m - 12), att: 0.6, att0: 0.4, rel: 0.3, amp: 0.034, cutoff: 950, seed: 'tremE', ampAt: (t) => (0.58 + 0.42 * Math.sin(2 * Math.PI * 8 * t)) * lerp(0.75, 1.05, clamp((t - S.S7.t0) / (endE - S.S7.t0))) });
  I.stringNote(strings, { midi: 81, t0: W('B07', 'Whether'), t1: E.shout - 0.02, att: 2.6, rel: 0.05, amp: 0.017, cutoff: 5200, voices: 3, detune: 5, seed: 'highA', vib: { rate: 5.5, cents: 3, delay: 1, att: 1 } }); notes.strings++;
  bass(progE, endE, { amp: 0.055, att: 0.6, rel: 0.3, seed: 'bassE' });
  piano([[W('B07', 'Whether'), 'D4', 0.15, 2.6], [W('B07', 'twain'), 'F4', 0.13, 2.4], [W('B07', 'release'), 'E4', 0.15, 2.4], [W('B07', 'you'), 'A3', 0.14, 2]], 'feltQ');
  cue(S.S7.t0, 'the question: low string tremolo, a thin high A, sparse low piano (unresolved Asus)');
  // S8: the crowd rises -> everything crescendos into the shout and STOPS dead on it
  const SH = E.shout, SR0 = E.shoutRise;
  const progF = [[S.S8.t0, 'Bb'], [SR0, 'Asus'], [SH - 0.55, 'A']];
  pad(progF, SH, { att: 0.4, att0: 0.15, rel: 0.04, amp: 0.12, cutoff: ramp([[S.S8.t0, 800], [SR0, 1100], [SH, 3200]]), seed: 'padF', bloom: 0.2 });
  str(progF, SH, { voicing: (c) => [CH[c][0] - 12, ...CH[c]], att: 0.3, att0: 0.15, rel: 0.04, amp: 0.05, seed: 'strF', cutoff: ramp([[S.S8.t0, 1500], [SR0, 2000], [SH, 4600]]),
    ampAt: ramp([[S.S8.t0, 0.55], [SR0, 0.7], [SH - 0.2, 1.3], [SH, 1.35]]) });
  cho([[SR0, 'Asus'], [SH - 0.55, 'A']], SH, { voicing: (c) => CH[c], att: 0.5, rel: 0.04, amp: 0.06, seed: 'choirShout', ampAt: ramp([[SR0, 0.4], [SH - 0.3, 1.1], [SH, 1.2]]) });
  brass({ midi: [33, 45, 52, 57], t: SR0, dur: SH - SR0, rel: 0.035, amp: 0.07, swell: SH - SR0, peak: 2600, floor: 300, seed: 'shoutBrass', send: 0.35 });
  bass([[S.S8.t0, 'Bb'], [SR0, 'A']], SH, { amp: 0.07, att: 0.3, rel: 0.04, seed: 'bassF' });
  roll(SR0 + 0.25, SH - 0.02, 'A1', 0.12, 0.75, 0.15, 0.95, 0.05);
  for (let t = SH - 0.62, k = 0; t < SH - 0.03; t += 0.62 / 8, k++) drum(t, 56 + 2 * (k % 2), 0.4 + 0.07 * k, 0.35 + 0.08 * k, { seed: 'shoutDr' });
  cue(SR0, 'crowd rises: strings + choir "ah" + brass swell + timpani roll + drums crescendo');
  cue(SH, 'THE SHOUT: the music stops dead (hard stop; synth.mjs mutes the tails too)');

  // ================================================================ F) S9 notice his name: drone, the unlock, the gold name (Bbmaj9)
  const FZ = E.freeze, GN = E.goldName;
  for (const [m, a] of [[38, 0.04], [45, 0.022]]) { I.padNote(music, { midi: m, t0: FZ, t1: GN + 0.2, att: 1.4, rel: 1.4, amp: a, cutoff: () => 380, wave: 'sine', voices: 1, detune: 0, spread: 0, sends: MS(0.3), seed: 'droneS9', bloom: 0, lfo: 0, drift: 0.6 }); notes.pad++; }
  for (const [m, a] of [[81, 0.011], [88, 0.007]]) { I.padNote(music, { midi: m, t0: FZ + 0.3, t1: E.lockBreak + 0.2, att: 1.0, rel: 1.6, amp: a, cutoff: () => 7000, wave: 'sine', voices: 2, detune: 4, spread: 0.9, sends: MS(0.9), seed: 'glassS9', bloom: 0, lfo: 0 }); notes.pad++; }
  cue(FZ, 'freeze: a soft low D-A drone and two glassy high tones (mystery)');
  const progG = [
    [E.lockBreak, 'Dm'], [E.splitBar, 'Bb'], [E.tagSon, 'F'], [W('B09', 'Abba'), 'C'], [E.tagFather, 'Dm'],
    [W('B10', 'Barabbas'), 'Gm'], [E.reform, 'Asus'], [E.reform + 0.5, 'A'], [GN, 'Bbmaj9', { att: 0.12 }],
  ];
  const endG = S.S10.t0 + 0.25;
  pad(progG, endG, { att: 1.0, att0: 1.4, rel: 1.0, amp: 0.11, seed: 'padG', bloom: 0.4,
    cutoff: ramp([[E.lockBreak, 700], [E.tagSon, 1000], [E.tagFather, 1200], [E.reform, 1600], [GN, 3000], [endG, 2200]]),
    ampAt: ramp([[E.lockBreak, 0.75], [E.tagFather, 0.9], [E.reform, 1.0], [GN, 1.15]]) });
  for (const [t, n] of progG) cue(t, `chord ${n}`);
  str(progG.filter(([t]) => t < GN - 1e-6), GN, { voicing: (c) => [CH[c][0] - 12, CH[c][0], CH[c][2]], att: 1.4, att0: 1.8, rel: 0.25, amp: 0.035, cutoff: ramp([[E.lockBreak, 1000], [E.reform, 2200], [GN, 3000]]), seed: 'strG',
    ampAt: ramp([[E.lockBreak, 0.6], [E.tagFather, 0.85], [E.reform, 1.0], [GN - 0.1, 1.25]]) });
  bass(progG.filter(([t]) => t >= E.tagFather - 1e-6), endG, { amp: 0.065, att: 0.5, rel: 1.0, seed: 'bassG' });
  piano([
    [E.lockBreak + 0.7, 'D4', 0.15, 3], [E.lockBreak + 1.3, 'A4', 0.14, 3],
    [E.splitBar, 'Bb4', 0.17, 2.6], [E.splitBar + 0.03, 'F5', 0.16, 2.6],
    [E.tagSon, 'A5', 0.21, 3], [W('B09', 'Abba'), 'G5', 0.17, 2.6],
    [E.tagFather, 'F5', 0.19, 3], [E.tagFather + 0.03, 'D6', 0.18, 3],
    [W('B10', 'Barabbas'), 'Bb4', 0.16, 2.4], [E.reform, 'E5', 0.17, 2], [E.reform + 0.5, 'C#5', 0.18, 2],
    [GN, 'D5', 0.25, 4], [GN + 0.02, 'F5', 0.24, 4], [GN + 0.04, 'A5', 0.23, 4], [GN, 'Bb2', 0.2, 4],
  ], 'feltS9');
  // the gold name: choir "ah" + high strings on Bbmaj9, timpani roll into it
  cho([[GN - 0.12, 'Bbmaj9']], S.S10.t0 + 0.5, { voicing: () => [58, 62, 65, 69, 72], att: 0.28, rel: 1.4, amp: 0.06, seed: 'choirGold', ampAt: ramp([[GN, 1], [GN + 0.6, 1.1], [S.S10.t0, 0.7]]) });
  str([[GN, 'Bbmaj9']], S.S10.t0 + 0.3, { voicing: () => [70, 74, 77, 81], att: 0.35, rel: 1.4, amp: 0.035, cutoff: 4600, seed: 'strGold', send: 0.7 });
  roll(E.reform + 0.1, GN - 0.02, 'A1', 0.12, 0.6, 0.15, 0.8, 0.06);
  timp(GN, 'Bb1', 0.8, 0.85, 4);
  cue(GN, 'GOLD NAME: Bbmaj9 bloom: choir "ah", high strings, piano, timpani');

  // ================================================================ G) S10 the swap: emotional strings lift into D MAJOR
  const ML = E.majorLift;
  const progH = [
    [S.S10.t0, 'Dm'], [W('B11', 'guilty'), 'Bb'], [W('B11', 'father'), 'Gm'], [W('B11', 'walked'), 'Asus'], [W('B11', 'free'), 'A'],
    [ML, 'D', { att: 0.5 }],                      // "...and the true SON of the Father": D MAJOR
    [W('B12', 'Father'), 'AC'], [W('B12', 'died'), 'Bm'], [W('B12', 'his'), 'G'], [W('B12', 'place') + 0.45, 'Asus'], [S.S11.t0 - 0.3, 'A'],
    [S.S11.t0, 'D'],                              // S11 Matthew 27:26 (soft)
    [W('B13', 'released'), 'AC'], [W('B13', 'Barabbas'), 'Bm'], [W('B13', 'unto'), 'G'],
  ];
  const endH = S.S12.t0;
  pad(progH, endH + 0.1, { att: 1.0, att0: 0.6, rel: 1.0, amp: 0.12, seed: 'padH', bloom: 0.4,
    cutoff: ramp([[S.S10.t0, 1000], [W('B11', 'free'), 1300], [ML, 1500], [ML + 1.5, 2600], [S.S11.t0, 2200], [endH, 1800]]),
    ampAt: ramp([[S.S10.t0, 0.85], [ML, 1.05], [S.S11.t0, 0.8], [endH, 0.75]]) });
  for (const [t, n] of progH) cue(t, `chord ${n}`);
  str(progH.filter(([t]) => t < S.S11.t0 - 1e-6), S.S11.t0 + 0.2, { voicing: (c) => [CH[c][0] - 12, ...CH[c].slice(0, 3)], att: 0.9, att0: 0.6, rel: 1.2, amp: 0.045, seed: 'strH',
    cutoff: ramp([[S.S10.t0, 1500], [ML, 2000], [ML + 1.2, 3000], [S.S11.t0, 2400]]), ampAt: ramp([[S.S10.t0, 0.7], [E.jesusLed, 0.85], [ML, 1.1], [ML + 2, 1.15], [S.S11.t0, 0.8]]) });
  str(progH.filter(([t]) => t >= S.S11.t0 - 1e-6), endH + 0.2, { voicing: (c) => CH[c].slice(-2).map((m) => m + 12), att: 1.0, rel: 1.4, amp: 0.026, cutoff: 3600, seed: 'strCard', send: 0.75 });
  // the melody (violins): rises through the minor, leaps to F# (the major third) on the lift, resolves on D
  const mel = [
    [S.S10.t0 + 0.25, W('B11', 'guilty'), 69], [W('B11', 'guilty'), W('B11', 'father'), 77], [W('B11', 'father'), W('B11', 'walked'), 74],
    [W('B11', 'walked'), W('B11', 'free'), 76], [W('B11', 'free'), ML - 0.02, 73], [ML, W('B12', 'Father'), 78], [W('B12', 'Father'), W('B12', 'died'), 76],
    [W('B12', 'died'), W('B12', 'his'), 74], [W('B12', 'his'), W('B12', 'place') + 0.45, 71], [W('B12', 'place') + 0.45, S.S11.t0 - 0.3, 76], [S.S11.t0 - 0.3, S.S11.t0, 73], [S.S11.t0, S.S11.t0 + 1.2, 74],
  ];
  for (const [a, b, m] of mel) { I.stringNote(strings, { midi: m, t0: a, t1: b, att: 0.28, rel: 0.5, amp: 0.034, cutoff: 3400, voices: 3, detune: 6, seed: 'melody', vib: { rate: 5.4, cents: 12, delay: 0.25, att: 0.5 } }); notes.strings++; }
  cue(S.S10.t0 + 0.25, 'S10 violin melody (A4 F5 D5 E5 C#5 -> F#5 on the lift -> E5 D5 B4 E5 C#5 D5)');
  cho(progH.filter(([t]) => t >= ML - 1e-6 && t < S.S11.t0 - 1e-6), S.S11.t0 + 0.6, { voicing: (c) => CH[c].slice(1), att: 1.0, rel: 1.6, amp: 0.05, seed: 'choirLift', ampAt: ramp([[ML, 0.8], [ML + 1.5, 1.05], [S.S11.t0, 0.6]]) });
  bass(progH, endH + 0.1, { amp: 0.07, att: 0.4, att0: 0.6, rel: 1.0, seed: 'bassH', ampAt: ramp([[S.S10.t0, 0.8], [ML, 1.05], [S.S11.t0, 0.75]]) });
  roll(E.jesusLed + 0.1, ML - 0.02, 'A1', 0.1, 0.45, 0.12, 0.5, 0.07);
  timp(ML, 'D2', 0.65, 0.7, 4);
  // glow layer: soft triangle an octave above the top of each major chord (light breaking through)
  const glow = (prog, tEnd, amp, seed) => prog.forEach(([t0, name], k) => {
    const t1 = k + 1 < prog.length ? prog[k + 1][0] : tEnd;
    for (const m of CH[name].slice(-2)) { I.padNote(music, { midi: m + 12, t0, t1, att: k ? 1.2 : 2.4, rel: 1.8, amp, cutoff: () => 6000, wave: 'tri', voices: 2, detune: 6, spread: 0.9, sends: MS(0.9), seed, lfo: 0, bloom: 0 }); notes.pad++; }
  });
  glow(progH.filter(([t]) => t >= ML - 1e-6), endH, 0.018, 'glowH');
  piano([
    [S.S10.t0 + 0.05, 'D4', 0.16, 3], [W('B11', 'guilty'), 'D4', 0.15, 2.6], [W('B11', 'guilty') + 0.36, 'F4', 0.14, 2.4], [W('B11', 'father'), 'Bb3', 0.15, 2.6], [W('B11', 'free'), 'E4', 0.15, 2.4],
    [ML + 0.02, 'D4', 0.2, 3.5], [ML + 0.06, 'F#4', 0.2, 3.5], [ML + 0.1, 'A4', 0.19, 3.5],
    [W('B12', 'died'), 'B3', 0.17, 3], [W('B12', 'died') + 0.04, 'F#4', 0.16, 3], [W('B12', 'his'), 'G3', 0.16, 3], [W('B12', 'his') + 0.04, 'D4', 0.15, 3],
    [S.S11.t0 + 0.03, 'F#5', 0.17, 3], [S.S11.t0 + 0.45, 'A5', 0.15, 3], [W('B13', 'released'), 'E5', 0.16, 2.6], [W('B13', 'Barabbas'), 'D5', 0.17, 3], [W('B13', 'unto'), 'B4', 0.15, 3],
  ], 'feltSwap');
  cue(ML, 'MAJOR LIFT: D major bloom, choir "oo", glow, timpani; the melody leaps to F#5');

  // ================================================================ H) S12 he looks back (reflective) -> S13 1 Peter 3:18 (the biggest warm swell)
  const progI = [
    [S.S12.t0, 'Bm'], [W('B14', 'earn'), 'G'], [W('B14', 'He'), 'D'], [W('B14', 'ask'), 'A'],
    [W('B15', 'He'), 'Bm'], [W('B15', 'because'), 'G'], [W('B15', 'Jesus'), 'Asus'], [W('B15', 'walked', 1), 'A'], [W('B15', 'in'), 'D'],
    [S.S13.t0, 'G'],                              // 1 Peter 3:18
    [W('B16', 'hath'), 'DF'], [W('B16', 'suffered'), 'Em'], [W('B16', 'sins'), 'A'], [W('B16', 'just'), 'Bm'], [W('B16', 'unjust'), 'G'],
    [W('B16', 'that'), 'DA'], [W('B16', 'bring'), 'A'], [W('B16', 'to'), 'D'],
  ];
  const endI = S.S14a.t0;
  pad(progI, endI + 0.2, { att: 1.3, att0: 1.0, rel: 1.4, amp: 0.12, seed: 'padI', bloom: 0.4,
    cutoff: ramp([[S.S12.t0, 900], [E.soften, 1000], [S.S13.t0, 1300], [E.lightBreaks + 1, 2000], [W('B16', 'to'), 3000], [endI, 2200]]),
    ampAt: ramp([[S.S12.t0, 0.75], [E.soften, 0.85], [S.S13.t0, 0.95], [W('B16', 'to'), 1.15], [endI, 0.85]]) });
  for (const [t, n] of progI) cue(t, `chord ${n}`);
  str(progI.filter(([t]) => t < S.S13.t0 - 1e-6), S.S13.t0 + 0.1, { voicing: (c) => [CH[c][0] - 12, CH[c][1]], att: 1.4, att0: 1.6, rel: 0.8, amp: 0.034, cutoff: 1300, seed: 'strI',
    ampAt: ramp([[S.S12.t0, 0.6], [E.soften, 0.7], [S.S13.t0 - 0.5, 1.0]]) });
  str(progI.filter(([t]) => t >= S.S13.t0 - 1e-6), endI + 0.3, { voicing: (c) => [CH[c][0] - 12, ...CH[c]], att: 1.1, att0: 1.4, rel: 1.8, amp: 0.048, seed: 'strPeter',
    cutoff: ramp([[S.S13.t0, 1500], [E.lightBreaks + 1, 2400], [W('B16', 'to'), 4200], [endI, 2600]]), ampAt: ramp([[S.S13.t0, 0.7], [W('B16', 'just'), 1.0], [W('B16', 'to'), 1.3], [endI, 0.8]]) });
  cho(progI.filter(([t]) => t >= S.S13.t0 - 1e-6), endI + 0.4, { voicing: (c) => CH[c], att: 1.4, rel: 2.0, amp: 0.06, seed: 'choirPeter', ampAt: ramp([[S.S13.t0, 0.55], [W('B16', 'just'), 0.85], [W('B16', 'to'), 1.25], [W('B16', 'God') + 0.6, 1.1], [endI, 0.55]]) });
  glow(progI.filter(([t]) => t >= S.S13.t0 - 1e-6), endI, 0.02, 'glowI');
  bass(progI, endI + 0.2, { amp: 0.07, att: 0.6, att0: 0.8, rel: 1.2, seed: 'bassI', root: { ...ROOT, DF: 42, DA: 33 }, ampAt: ramp([[S.S12.t0, 0.75], [S.S13.t0, 0.95], [W('B16', 'to'), 1.1]]) });
  brass({ midi: [38, 50, 57, 62], t: W('B16', 'to') - 0.5, dur: 1.3, rel: 1.4, amp: 0.05, swell: 0.6, peak: 1700, floor: 300, seed: 'hornsGod', send: 0.5 });
  timp(E.lightBreaks, 'D2', 0.4, 0.45, 4); roll(W('B16', 'bring') - 0.1, W('B16', 'to') - 0.02, 'A1', 0.1, 0.5, 0.12, 0.6, 0.06); timp(W('B16', 'to'), 'D2', 0.75, 0.85, 4.5);
  piano([
    [S.S12.t0 + 0.12, 'D5', 0.16, 3], [S.S12.t0 + 0.14, 'F#4', 0.13, 3], [W('B14', 'earn'), 'B4', 0.16, 3], [W('B14', 'He'), 'A4', 0.15, 3], [W('B14', 'ask'), 'C#5', 0.16, 2.6],
    [W('B15', 'He'), 'D5', 0.17, 3], [W('B15', 'because'), 'B4', 0.16, 3], [W('B15', 'Jesus'), 'E5', 0.17, 2.6], [W('B15', 'walked', 1), 'C#5', 0.17, 2.4],
    [W('B15', 'in'), 'D5', 0.2, 3.5], [W('B15', 'in') + 0.04, 'F#5', 0.19, 3.5],
    [S.S13.t0 + 0.05, 'B5', 0.15, 3], [W('B16', 'hath'), 'A5', 0.15, 3], [W('B16', 'suffered'), 'G5', 0.15, 3], [W('B16', 'sins'), 'E5', 0.16, 2.6],
    [W('B16', 'just'), 'F#5', 0.17, 3], [W('B16', 'unjust'), 'D5', 0.16, 3], [W('B16', 'that'), 'F#5', 0.16, 2.6], [W('B16', 'bring'), 'E5', 0.17, 2.4],
    [W('B16', 'to') + 0.02, 'D5', 0.22, 4], [W('B16', 'to') + 0.06, 'A5', 0.21, 4], [W('B16', 'God'), 'D6', 0.19, 4],
  ], 'feltPeter');
  cue(E.soften, 'his face softens: the warm low swell begins');
  cue(S.S13.t0, '1 Peter 3:18: the biggest warm swell (strings + choir "oo -> ah" + glow + horns on "to God")');

  // ================================================================ I) S14 "you are Barabbas" (the warmest) -> S15 the question -> S16 end
  const progJ = [
    [S.S14a.t0, 'Bm', { att: 1.2 }], [W('B17', 'truth'), 'G'],
    [E.matchCut, 'D', { att: 0.6 }],              // "YOU are Barabbas": the warmest bloom
    [W('B17', 'Barabbas'), 'AC'], [W('B17', 'Barabbas') + 0.66, 'Bm'], [E.warmLight, 'G'], [W('B17', 'I'), 'D'],
    [S.S15.t0, 'G'], [W('B18', 'Barabbas'), 'D'], [W('B18', 'what'), 'Em'], [W('B18', 'Jesus'), 'A'], [W('B18', 'One'), 'G'],
    [E.endCard, 'Dadd9'],
    [E.loopBack, 'D5', { att: 0.5 }],             // the third falls away: D-A carries over the loop into the D minor hook
  ];
  const endJ = dur + 0.3;
  pad(progJ, endJ, { att: 1.3, att0: 1.2, rel: 2.0, amp: 0.12, seed: 'padJ', bloom: 0.4,
    cutoff: ramp([[S.S14a.t0, 800], [E.matchCut, 1200], [E.matchCut + 1.5, 2600], [E.warmLight + 1, 2800], [S.S15.t0, 2200], [E.endCard, 2100], [dur, 2000]]),
    ampAt: ramp([[S.S14a.t0, 0.6], [E.matchCut, 1.05], [E.warmLight, 1.1], [S.S15.t0, 0.9], [E.endCard, 0.85]]) });
  for (const [t, n] of progJ) cue(t, `chord ${n}`);
  const warm = progJ.filter(([t]) => t >= E.matchCut - 1e-6 && t < S.S15.t0 - 1e-6);
  str(warm, S.S15.t0 + 0.4, { voicing: (c) => [CH[c][0] - 12, ...CH[c].slice(1)], att: 1.2, att0: 0.9, rel: 1.6, amp: 0.045, seed: 'strWarm',
    cutoff: ramp([[E.matchCut, 1500], [E.matchCut + 2, 2800], [S.S15.t0, 2200]]), ampAt: ramp([[E.matchCut, 0.8], [E.matchCut + 1.5, 1.1], [S.S15.t0, 0.8]]) });
  cho(warm, S.S15.t0 + 0.6, { voicing: (c) => CH[c].slice(1), att: 1.2, rel: 2.2, amp: 0.065, seed: 'choirWarm', ampAt: ramp([[E.matchCut, 0.8], [E.matchCut + 1.5, 1.15], [W('B17', 'I'), 1.0], [S.S15.t0, 0.5]]) });
  glow(progJ.filter(([t]) => t >= E.matchCut - 1e-6), endJ, 0.02, 'glowJ');
  str(progJ.filter(([t]) => t >= S.S15.t0 - 1e-6 && t < E.loopBack - 1e-6), E.loopBack - 0.2, { voicing: (c) => [CH[c][0] - 12, ...CH[c].slice(1)], att: 1.4, rel: 2.0, amp: 0.032, cutoff: 2200, seed: 'strEnd',
    ampAt: ramp([[S.S15.t0, 0.8], [E.endCard, 0.65], [E.loopBack, 0.5]]) });
  bass(progJ, endJ, { amp: 0.07, att: 0.5, att0: 1.0, rel: 1.2, seed: 'bassJ', ampAt: ramp([[S.S14a.t0, 0.6], [E.matchCut, 1.0], [E.endCard, 0.85]]) });
  pulse(S.S15.t0 + 0.2, E.endCard - 0.2, E8, progJ, { seed: 'pulseCTA', tones: (c) => [48 + ROOT[c] % 12, CH[c][2], CH[c][1] + 12, CH[c][3]], cutoff: 700, decay: 0.15, gain: 0.45,
    velAt: ramp([[S.S15.t0, 0.4], [S.S15.t0 + 1.5, 0.6], [E.endCard - 0.6, 0.42]]) });
  piano([
    [S.S14a.t0 + 0.1, 'F#4', 0.13, 3], [S.S14a.t0 + 0.12, 'D5', 0.14, 3], [W('B17', 'truth'), 'B4', 0.14, 3],
    [E.matchCut + 0.02, 'D5', 0.23, 4], [E.matchCut + 0.06, 'F#5', 0.24, 4], [E.matchCut + 0.1, 'A5', 0.22, 4], [E.matchCut, 'D3', 0.2, 4],
    [W('B17', 'Barabbas'), 'E5', 0.18, 3], [W('B17', 'Barabbas') + 0.66, 'D5', 0.17, 3], [E.warmLight + 0.02, 'B4', 0.18, 3], [E.warmLight + 0.06, 'G5', 0.18, 3],
    [W('B17', 'I'), 'F#5', 0.2, 3.5], [W('B17', 'I') + 0.04, 'A5', 0.18, 3.5],
    [S.S15.t0 + 0.1, 'B4', 0.17, 2.6], [W('B18', 'Barabbas'), 'A4', 0.17, 2.6], [W('B18', 'what'), 'G4', 0.16, 2.6], [W('B18', 'Jesus'), 'E5', 0.18, 2.6], [W('B18', 'One'), 'D5', 0.17, 2.6],
    [E.endCard + 0.05, 'D4', 0.2, 3.5], [E.endCard + 0.45, 'A4', 0.2, 3.5], [E.endCard + 0.85, 'E5', 0.19, 3], [E.endCard + 1.25, 'F#5', 0.2, 3], [E.loopBack - 0.6, 'A4', 0.15, 2.5],
  ], 'feltEnd');
  cue(E.matchCut, '"YOU are Barabbas": the warmest bloom (choir, strings, glow, piano D-F#-A)');

  // ================================================================ string ensemble chorus, choir formants, buses
  D.chorus(strings, { seed: 'strChorus', mix: 0.55 });
  const tw = (a, b, t) => smooth((t - a) / (b - a));
  I.formantChoir(choir, (t) => {
    if (t < E.shoutRise - 0.2) return { oo: 1 };
    if (t < E.freeze) return { ah: 1 };                               // the crowd rises: "ah"
    if (t < E.goldName - 0.3) return { oo: 1 };
    if (t < S.S10.t0 + 0.6) return { ah: 0.7, oh: 0.3 };              // the gold name
    if (t < S.S13.t0) return { oo: 1 };
    if (t < S.S14a.t0) { const u = tw(W('B16', 'just'), W('B16', 'to'), t); return { oo: 1 - u, ah: u * 0.7, oh: u * 0.3 }; }
    if (t < E.matchCut) return { oo: 1 };
    { const u = tw(E.matchCut + 0.3, E.warmLight, t); return { oo: 1 - u * 0.6, oh: u * 0.6 }; }
  });
  const dry = process.env.AUDIO_DEBUG ? { L: Float32Array.from(music.L), R: Float32Array.from(music.R) } : null;  // pads, piano, pulse, bass, timpani, drums, brass
  for (const [bus, g, send] of [[strings, 2.5, 0.5], [choir, 3.5, 0.65]]) {
    for (let i = 0; i < NB; i++) { const l = bus.L[i] * g, r = bus.R[i] * g; music.L[i] += l; music.R[i] += r; hall[i] += (l + r) * 0.5 * send; }
  }
  return { music, hall, notes, layers: dry ? { 'pads+piano+pulse+bass+timp+drums+brass': dry, strings, choir } : null };
}
