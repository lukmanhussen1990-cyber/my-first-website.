// SON OF THE FATHER: sound effects and ambience, placed from the shared plan (ctx.E events, ctx.W words,
// plan.shots transitions). Hits land on the nearest video frame (ctx.q). The crowd is wordless throughout
// (layered noise + formant shouts with chant-like pulses); no violence is ever heard, only fire and running.
import * as D from './lib/dsp.mjs';
import * as X from './lib/sfx.mjs';
import { bell } from './lib/instruments.mjs';

const { SR, dB, nm, mtof, place, placeMoving, smp, lerp, clamp, ramp, cosRamp } = D;

export function renderSfx(ctx) {
  const { N, E, W, plan, cue, q, dur } = ctx;
  const S = Object.fromEntries(plan.shots.map((s) => [s.id, s]));
  const sfx = D.stereo(N), room = D.f32(N), hall = D.f32(N), big = D.f32(N);
  const SS = (r = 0, h = 0, b = 0) => [[room, r], [hall, h], [big, b]];
  const fadeSt = (s, fi, fo) => { D.fades(s.L, fi, fo); D.fades(s.R, fi, fo); return s; };
  // multiply a stereo signal (placed at t0) by a gain curve g(tAbs)
  const shape = (s, t0, g) => { for (let i = 0; i < s.L.length; i += 64) { const v = g(t0 + i / SR); for (let j = i; j < Math.min(s.L.length, i + 64); j++) { s.L[j] *= v; s.R[j] *= v; } } return s; };
  const dbCurve = (keys) => { const f = ramp(keys); return (t) => 10 ** (f(t) / 20); };
  // time-varying low-pass on a stereo signal placed at t0 (keys [[tAbs, Hz]], interpolated in octaves)
  const lowpass = (s, t0, keys) => { const f = ramp(keys.map(([t, hz]) => [t, Math.log2(hz)])); for (const ch of ['L', 'R']) D.svf(s[ch], (i) => 2 ** f(t0 + i / SR), 0.7, 'lp', 16); return s; };
  // a gentle dip around 1.5 kHz on the crowd beds, so the narration always sits on top of them
  const scoop = (s, g = -4) => { for (const ch of ['L', 'R']) D.filt(s[ch], 'peak', 1600, 0.6, g); return s; };
  const RS = E.rampSlow, RV = E.reveal, CK = E.chainClank, SH = E.shout, SR0 = E.shoutRise;
  const label = (t, f, seed, pan = -0.2) => { const tt = q(t); place(sfx, X.tick({ f, tau: 0.008, click: 0.2, seed }), tt, dB(-34), pan, SS(0.05, 0.2)); place(sfx, X.glint({ f: f / 2, dur: 0.9, seed: seed + 'g' }), tt + 0.02, dB(-38), pan, SS(0, 0.4)); return tt; };
  const steps = (t0, t1, every, { gen = 'stone', hard = 0.5, g0 = -24, g1 = g0, p0 = 0, p1 = p0, sends = SS(0.12, 0.2), seed = 'st', jit = 0.02, bus = sfx, off = 0 } = {}) => {
    const r = D.makeRng(seed); let k = 0;
    for (let t = t0; t < t1; t += every * r.uni(1 - jit, 1 + jit), k++) {
      const u = (t - t0) / Math.max(0.01, t1 - t0), w = k % 2 ? 0.85 : 1;
      const x = gen === 'sand' ? X.stepSand({ weight: w, seed: seed + k }) : X.stepStone({ weight: w, hard, seed: seed + k });
      place(bus, x, q(t) - off, dB(lerp(g0, g1, u)) * r.uni(0.85, 1), lerp(p0, p1, u) + (k % 2 ? 0.05 : -0.05), sends);
    }
    return k;
  };
  const chantPhase = (per, tShift) => ((E.hookHit + tShift) % per + per) % per;

  // ================================================================ S1 + S2: the roaring crowd, "underwater" in the slow motion
  const CHANT = 1.75, PER = 1 / CHANT;
  {
    const a = 0, b = S.S3.t0 + 0.4;
    const en = ramp([[0, 0.95], [RS, 0.95], [RV - 0.2, 0.85], [RV + 0.4, 0.62], [S.S3.t0, 0.55]]);
    const roar = X.crowdRoar({ dur: b - a, energy: (t) => en(a + t), voices: 28, chant: { rate: CHANT, sync: 0.55, depth: 0.8, phase: chantPhase(PER, 0) }, seed: 'roarA' });
    scoop(roar);
    lowpass(roar, a, [[0, 9000], [RS - 0.06, 9000], [RS + 0.28, 380], [RV - 0.32, 380], [RV - 0.02, 3800], [RV + 0.4, 5200]]);
    shape(roar, a, dbCurve([[0, 0], [RS - 0.05, 0], [RS + 0.3, -9], [RV - 0.3, -9], [RV, -3], [RV + 0.5, -6], [S.S3.t0 - 0.1, -7], [b, -40]]));
    fadeSt(roar, 0, 0.3);
    place(sfx, roar, a, dB(-13.5), 0, SS(0.12, 0.12));
    cue(0, 'crowd roar with chant-like pulses (no words), continuing from the loop');
    cue(RS, 'speed ramp: the roar drops "underwater" (low-pass 9 kHz -> 380 Hz, -9 dB)');
    cue(RV, 'reveal: the roar surfaces again, behind the narration');
    // wind across the court stays clear (it is what is left in the slow motion)
    const w = X.wind({ dur: b - a, lo: 220, hi: 1500, gust: 0.6, rate: 0.18, move: 0.7, seed: 'windA' });
    shape(w, a, dbCurve([[0, -3], [RS, -3], [RS + 0.3, 3], [RV - 0.3, 3], [RV, -1], [b, -1]]));
    place(sfx, fadeSt(w, 0, 0.35), a, dB(-26), 0, null);
    for (let k = 0, t = RS + 0.25; t < RV - 0.2; k++, t += 0.92) { const tt = q(t); place(sfx, X.heartbeat({ seed: 'hb' + k }), tt, dB(-11), 0, SS(0.04)); cue(tt, `heartbeat ${k + 1} (slow motion)`); }
  }
  { const t = q(E.hookHit); place(sfx, X.deepHit({ seed: 'hookHit' }), t, dB(-10), 0, SS(0.05, 0.2, 0.1)); cue(t, 'HOOK HIT: deep D1 hit (title punches in)'); }
  { const t = q(E.hookOut), w = X.airySwish('hookOut', 0.9, 0.55); placeMoving(sfx, w, t - 0.28, dB(-33), 0.1, -0.3, SS(0.05, 0.15)); cue(t, 'soft swish: title flies to the caption spot'); }
  { const t = q(RS); place(sfx, X.revSwell({ dur: 0.32, f0: 700, oct: 2.4, seed: 'rampSuck' }), t - 0.32, dB(-24), 0, SS(0, 0.1)); place(sfx, X.subBoom({ seed: 'rampBoom' }), t, dB(-15), 0, SS(0, 0.15, 0.1)); cue(t, 'speed ramp: suck-in + soft sub boom'); }
  cue(label(Math.max(E.jesusLabel, E.hookOut + 0.45), 1760, 'jesusLabel'), 'label tick: JESUS');
  { const t = q(E.eyesLift); place(sfx, X.glint({ f: mtof(81), dur: 1.4, swell: 0.3, seed: 'eyes' }), t - 0.2, dB(-33), 0, SS(0, 0.5)); cue(t, 'He lifts His eyes: soft glint'); }

  // ================================================================ S2 the reveal: Barabbas in chains, the locked name card
  { const t = q(CK); place(sfx, X.chainClank({ links: 10, spread: 0.35, weight: 1, seed: 'clankReveal' }), t, dB(-7), 0.1, SS(0.15, 0.18)); cue(t, 'REVEAL: heavy chain clank (the chains jerk taut)'); }
  { const t = q(E.barabbasLabel + 1.1); place(sfx, X.chainDrag({ dur: 0.9, rate: 11, seed: 'shift' }), t, dB(-25), 0.15, SS(0.1, 0.1)); cue(t, 'chains shift'); }
  cue(label(E.barabbasLabel, 1318.5, 'barabbasLabel'), 'label tick: BARABBAS');
  { const t = q(E.nameCard); place(sfx, X.lockClunk({ seed: 'nameLock' }), t, dB(-19), 0, SS(0.05, 0.2)); place(sfx, X.glint({ f: mtof(74), dur: 1.1, seed: 'nameGlint' }), t + 0.03, dB(-36), 0, SS(0, 0.4)); cue(t, 'name card "BARABBAS = ???": padlock clunk'); }

  // ================================================================ S3 Passover over Jerusalem: city bustle, distant horn calls
  {
    const a = S.S3.t0 - 0.2, b = S.S4.t0 + 0.3;
    place(sfx, fadeSt(X.murmur({ dur: b - a, talkers: 16, pitchLo: 100, pitchHi: 260, lp: 1500, seed: 'bustle' }), 0.4, 0.3), a, dB(-26), 0, SS(0.05, 0.1));
    place(sfx, fadeSt(X.wind({ dur: b - a, lo: 320, hi: 2600, gust: 0.4, rate: 0.15, seed: 'cityWind' }), 0.4, 0.3), a, dB(-29), 0, null);
    place(sfx, fadeSt(X.birds({ dur: b - a, count: 3, rate: 1.2, seed: 'swifts' }), 0.3, 0.3), a, dB(-33), 0, SS(0, 0.15));
    const r = D.makeRng('market');
    for (let t = a + 0.3; t < b - 0.3; t += r.uni(0.25, 0.7)) place(sfx, X.hammerTap({ f: r.uni(800, 1500), weight: r.uni(0.5, 1), seed: 'mk' + t.toFixed(2) }), t, dB(-40) * r.uni(0.6, 1), r.uni(-0.8, 0.8), SS(0.15, 0.25));
    cue(a, 'city bustle: murmur, market taps, swifts, open wind');
    [[S.S3.t0 + 0.3, 233.08, 1.7, 1.5, -0.5], [W('B03', 'set') + 0.05, 196.0, 1.5, 1.5, 0.55], [W('B03', 'free') + 0.1, 233.08, 1.1, 1.335, -0.2]].forEach(([t, f0, d, jump, pan], k) => {
      const h = X.hornCall({ f0, dur: d, jump, seed: 'horn' + k }); D.lp4(h, 2600);
      place(sfx, h, q(t), dB(-25), pan, SS(0, 0.3, 0.55)); cue(q(t), `distant horn call ${k + 1}`);
    });
  }
  cue(label(E.passover, 1568, 'passoverLabel'), 'label tick: PASSOVER CUSTOM');

  // ================================================================ S4 Pilate: marble court, soldiers' steps, the chain dragging
  {
    const a = S.S4.t0 - 0.1, b = E.mem1 + 0.15;
    const mur = X.crowdRoar({ dur: b - a, energy: () => 0.28, voices: 18, seed: 'crowdB' }); scoop(mur, -6); D.lp4(mur.L, 2600); D.lp4(mur.R, 2600);
    place(sfx, fadeSt(mur, 0.15, 0.25), a, dB(-17), 0, SS(0.2, 0.3));
    place(sfx, fadeSt(X.murmur({ dur: b - a, talkers: 14, lp: 1300, seed: 'courtMurmur' }), 0.15, 0.25), a, dB(-29), 0, SS(0.2, 0.3));
    cue(a, 'the court: a gathered crowd murmuring (marble echo)');
    const s0 = S.S4.t0 + 0.12, s1 = S.S5.t0 - 0.1;
    const nS = steps(s0, s1, 0.56, { hard: 0.85, g0: -25, g1: -21, p0: -0.25, p1: -0.15, sends: SS(0.2, 0.45), seed: 'soldierA' });
    steps(s0 + 0.29, s1, 0.56, { hard: 0.85, g0: -27, g1: -23, p0: 0.3, p1: 0.2, sends: SS(0.2, 0.45), seed: 'soldierB' });
    steps(s0 + 0.14, s1, 0.6, { hard: 0.35, g0: -28, g1: -24, p0: -0.08, sends: SS(0.2, 0.4), seed: 'jesusSteps' });
    const bR = D.makeRng('bSteps');
    for (let t = s0 + 0.42; t < s1; t += 0.6 * bR.uni(0.97, 1.03)) {
      place(sfx, X.stepStone({ weight: 0.9, hard: 0.35, seed: 'bs' + t.toFixed(2) }), q(t), dB(-25), 0.1, SS(0.2, 0.4));
      place(sfx, X.chainClank({ links: 4, spread: 0.12, weight: 0.35, seed: 'bc' + t.toFixed(2) }), q(t) + 0.02, dB(-27), 0.12, SS(0.15, 0.35));
    }
    place(sfx, X.chainDrag({ dur: s1 - s0, rate: 9, seed: 'drag' }), s0, dB(-30), 0.1, SS(0.15, 0.3));
    cue(s0, `soldiers' steps on marble (${nS} each) + the two men; Barabbas' chain drags`);
  }
  cue(label(E.pilateLabel, 1396.9, 'pilateLabel'), 'label tick: PONTIUS PILATE');

  // ================================================================ S5 who Jesus is: three glowing memories
  {
    const a = E.mem1 - 0.25, b = S.S6.t0 + 0.1;
    place(sfx, fadeSt(X.wind({ dur: b - a, lo: 450, hi: 3200, gust: 0.3, rate: 0.12, seed: 'memAir' }), 0.3, 0.1), a, dB(-33), 0, null);
    place(sfx, fadeSt(X.birds({ dur: b - a, count: 2, rate: 1.4, seed: 'memBirds' }), 0.3, 0.1), a, dB(-31), 0, SS(0, 0.2));
    [[E.mem1, ['F6', 'A6', 'C7', 'F7'], 'the blind man sees'], [E.mem2, ['C6', 'E6', 'G6', 'C7'], 'the child, well again'], [E.mem3, ['F6', 'A6', 'C7', 'E7', 'F7'], 'Lazarus walks out']].forEach(([t0, notes, what], k) => {
      const t = q(t0); place(sfx, X.shimmer({ notes, spacing: 0.06, dur: 1.8, bright: 0.3, air: 0.2, pan: [-0.5, 0.5], seed: 'mem' + k }), t, dB(-25), 0, SS(0, 0.5)); cue(t, `memory shimmer ${k + 1}: ${what}`);
    });
    const te = q(E.mem1 + 0.38); place(sfx, X.glint({ f: mtof(88), dur: 1.0, seed: 'eyesOpen' }), te, dB(-34), 0.1, SS(0, 0.5)); cue(te, 'his eyes open: glint');
  }

  // ================================================================ S6 who Barabbas is: the night riot (muffled, no violence: fire and running)
  {
    const a = S.S6.t0 - 0.1, b = S.S7.t0 + 0.15, rb = D.stereo(smp(b - a));
    const rp = (sig, t, g, pan = 0) => place(rb, sig, t - a, g, pan, null);
    rp(fadeSt(X.torchFire({ dur: b - a, size: 1, seed: 'torch' }), 0.15, 0.2), a, dB(-9), 0.05);
    rp(fadeSt(X.torchFire({ dur: b - a, size: 0.7, seed: 'fires' }), 0.15, 0.2), a, dB(-16), -0.4);
    const far = X.crowdRoar({ dur: b - a, energy: (t) => 0.55 + 0.15 * Math.sin(t * 1.3), voices: 16, seed: 'riotShouts' });
    rp(fadeSt(far, 0.15, 0.2), a, dB(-14), 0);
    steps(S.S6.t0 + 0.2, S.S7.t0 - 0.2, 0.52, { g0: -12, g1: -10, p0: -0.1, p1: 0.1, sends: null, seed: 'barabbasRiot', bus: rb, off: a });
    const runs = [[19.6, -0.9, 0.9], [20.55, 0.8, -0.8], [22.0, -0.85, 0.7], [23.25, 0.9, -0.6]];
    runs.forEach(([t0, p0, p1], k) => { for (let j = 0; j < 2 + (k % 2); j++) steps(t0 + j * 0.09, t0 + j * 0.09 + 1.25, 0.17, { gen: 'sand', g0: -14, g1: -18, p0, p1, sends: null, seed: `run${k}:${j}`, jit: 0.06, bus: rb, off: a }); });
    D.lp4(rb.L, 1500); D.lp4(rb.R, 1500);
    place(sfx, rb, a, 1, 0, SS(0.08, 0.12));
    cue(a, 'riot (muffled, as a memory): torch roar, fires, distant shouts, Barabbas walking, runners crossing');
  }
  cue(label(E.riotLabel, 1174.7, 'riotLabel'), 'label tick: THE INSURRECTION');

  // ================================================================ S7 the question: the crowd hushes, whispers; S8 the crowd rises
  {
    const a = S.S7.t0 - 0.05, b = SH + 0.02;
    const en = ramp([[a, 0.32], [E.hush, 0.3], [E.hush + 0.9, 0.05], [SR0 - 0.3, 0.06], [SR0 + 0.2, 0.22], [SH - 0.35, 0.8], [SH, 0.95]]);
    const c = X.crowdRoar({ dur: b - a, energy: (t) => en(a + t), voices: 26, chant: { rate: 2.2, sync: 0.5, depth: 0.7, phase: 0 }, seed: 'crowdC' });
    scoop(c); fadeSt(c, 0.12, 0.02);
    place(sfx, c, a, dB(-13.5), 0, SS(0.15, 0.25));
    cue(a, 'the court crowd (marble)'); cue(E.hush, 'the crowd hushes'); cue(SR0, 'the crowd rises (chant pulses build into the shout)');
    // the hush: a ripple of "shh" across the crowd
    const r = D.makeRng('hush'), hn = smp(1.6), hs = D.stereo(hn);
    for (let k = 0; k < 10; k++) {
      const t0 = r.uni(0, 0.7), m = smp(r.uni(0.35, 0.7)), x = D.white(m, r), i0 = smp(t0), [gl, gr] = D.panGains(r.uni(-0.9, 0.9));
      D.bp2(x, r.uni(2600, 3600), 9000); D.normRms(x, 1);
      for (let i = 0; i < m && i0 + i < hn; i++) { const u = i / m, e = D.smooth(u / 0.18) * (u > 0.4 ? cosRamp((1 - u) / 0.6) : 1) * r.uni(0.6, 1); hs.L[i0 + i] += x[i] * e * gl; hs.R[i0 + i] += x[i] * e * gr; }
    }
    place(sfx, X.normStereoRms(hs, 0.1), q(E.hush) + 0.1, dB(-27), 0, SS(0.15, 0.25)); cue(q(E.hush) + 0.1, '"shh" ripple through the crowd');
    const wa = E.whisper, wb = S.S8.t0 + 0.6;
    place(sfx, fadeSt(X.whispers({ dur: wb - wa, voices: 9, seed: 'whispers' }), 0.5, 0.4), wa, dB(-24), 0, SS(0.15, 0.15)); cue(wa, 'whisper textures (no words)');
    for (let k = 0, t = W('B07', 'will'); t < S.S8.t0 + 0.5; k++, t += 0.85) place(sfx, X.heartbeat({ weight: 0.8, seed: 'hbQ' + k }), q(t), dB(-17), 0, SS(0.04));
    cue(W('B07', 'will'), 'soft heartbeat under the question');
    const tc = q(E.card2721); place(sfx, X.airySwish('card2721', 0.7, 0.6), tc - 0.25, dB(-31), 0, SS(0, 0.2)); place(sfx, X.glint({ f: mtof(69), dur: 1.4, seed: 'card2721g' }), tc, dB(-33), 0, SS(0, 0.4)); cue(tc, 'verse card (Matthew 27:21)');
  }
  cue(label(E.whisper + 0.3, 1046.5, 'whisperLabel', 0.2), 'label tick: WHISPERS IN THE CROWD');
  // ================================================================ S8 THE SHOUT: massive crowd hit + camera-shake boom, then near silence
  {
    place(sfx, X.riser({ dur: SH - SR0 - 0.3, target: 293.66, soft: true, seed: 'shoutRiser' }), SR0 + 0.3, dB(-26), 0, SS(0, 0.15));
    place(sfx, X.revSwell({ dur: 0.45, f0: 400, oct: 3, seed: 'shoutSuck' }), q(SH) - 0.45, dB(-22), 0, SS(0, 0.1));
    const t = q(SH);
    const burst = X.crowdRoar({ dur: 1.9, energy: (u) => (u < 0.03 ? u / 0.03 : Math.exp(-(u - 0.03) / 0.5)) * 1.15, voices: 40, burst: true, bright: 1.15, seed: 'shoutBurst' });
    scoop(burst, -7);
    place(sfx, burst, t - 0.01, dB(-12.5), 0, SS(0.1, 0.25, 0.15));
    place(sfx, X.subBoom({ seed: 'shoutBoom' }), t, dB(-8), 0, SS(0.05, 0.2, 0.2));
    place(sfx, X.shake({ dur: 1.2, seed: 'shoutShake' }), t + 0.01, dB(-16), 0, SS(0.1, 0.1));
    place(sfx, X.taiko({ f: 46, vel: 1, seed: 'shoutTaiko' }), t, dB(-12), 0, SS(0.1, 0.3));
    cue(t, 'THE SHOUT: massive crowd hit (wordless burst) + sub boom + camera-shake rumble + big drum');
    cue(E.silence, 'NEAR SILENCE (until the freeze)');
  }

  // ================================================================ S9 but notice his name: the card unlocks, splits, turns to gold
  {
    const tf = q(E.freeze); place(sfx, X.lowSwell({ dur: 2.4, f: 36.71, peak: 0.3, seed: 'drain' }), tf, dB(-25), 0, SS(0, 0.2)); cue(tf, 'freeze: the world drains to dark (low swell)');
    const tc = q(E.cardCenter); place(sfx, X.pushWhoosh({ dur: 0.75, peak: 0.75, seed: 'cardFly' }), tc - 0.1, dB(-25), 0, SS(0.05, 0.15)); cue(tc, 'name card flies to the centre and grows');
    const r = D.makeRng('cracks');
    for (let k = 0; k < 4; k++) { const t = q(E.lockBreak - 0.18) + k * 0.045; place(sfx, X.tick({ f: r.uni(2600, 3600), tau: 0.004, click: 0.5, seed: 'crk' + k }), t, dB(-30), r.uni(-0.3, 0.3), SS(0, 0.15)); }
    const tl = q(E.lockBreak);
    place(sfx, X.lockCrack({ seed: 'lockBreak' }), tl, dB(-10.5), 0, SS(0.05, 0.25, 0.15));
    place(sfx, X.subBoom({ seed: 'lockBoom' }), tl, dB(-9), 0, SS(0, 0.2, 0.25));
    cue(tl, 'LOCK BREAKS: crack + the halves ringing apart + deep sub boom');
    const ts = q(E.splitBar);
    placeMoving(sfx, X.airySwish('splitL', 0.8, 0.6), ts - 0.15, dB(-31), 0, -0.7, SS(0, 0.2)); placeMoving(sfx, X.airySwish('splitR', 0.85, 0.6), ts - 0.15, dB(-31), 0, 0.7, SS(0, 0.2));
    place(sfx, X.tick({ f: 1975.5, tau: 0.006, click: 0.3, seed: 'split' }), ts, dB(-31), 0, SS(0, 0.2)); cue(ts, 'BAR | ABBA split apart');
    [[E.tagSon, 81, -0.35, 'SON'], [E.tagFather, 86, 0.35, 'FATHER']].forEach(([t0, m, pan, what], k) => {
      const t = q(t0); place(sfx, bell(mtof(m), { dur: 2.6, bright: 0.35, seed: 'tag' + k }), t, dB(-26), pan, SS(0, 0.5)); place(sfx, X.glint({ f: mtof(m), dur: 1.2, seed: 'tagg' + k }), t + 0.02, dB(-34), pan, SS(0, 0.4)); cue(t, `tag ${what}: bell tone`);
    });
    const tr = q(E.reform); place(sfx, X.airyRise({ dur: E.goldName - E.reform + 0.4, seed: 'reform' }), tr - 0.05, dB(-24), 0, SS(0, 0.35, 0.2)); cue(tr, 'the letters re-form (airy rise)');
    const tg = q(E.goldName);
    place(sfx, X.warmBoom({ seed: 'goldBoom' }), tg, dB(-10.5), 0, SS(0.05, 0.25, 0.2));
    place(sfx, X.shimmer({ notes: ['Bb5', 'D6', 'F6', 'A6', 'C7', 'D7'], spacing: 0.05, dur: 3.2, bright: 0.35, air: 0.25, pan: [-0.6, 0.6], seed: 'goldChime' }), tg + 0.01, dB(-21), 0, SS(0, 0.5, 0.15));
    place(sfx, X.goldDust({ seed: 'goldDust' }), tg + 0.03, dB(-25), 0, SS(0, 0.4, 0.15));
    cue(tg, 'GOLD NAME "SON OF THE FATHER": big warm hit + golden chime chord (Bbmaj9) + gold dust');
  }

  // ================================================================ S10 the swap: the key, the shackles fall, Barabbas walks free, Jesus is led away
  {
    const a = S.S10.t0 - 0.3, b = S.S11.t0 + 0.4;
    const w = X.wind({ dur: b - a, lo: 200, hi: 1300, gust: 0.6, rate: 0.16, seed: 'windSwap' });
    shape(w, a, dbCurve([[a, -4], [E.jesusLed, -2], [b, 2]]));
    place(sfx, fadeSt(w, 0.6, 0.4), a, dB(-26), 0, null);
    place(sfx, fadeSt(X.murmur({ dur: b - a, talkers: 12, lp: 1100, seed: 'swapMurmur' }), 0.6, 0.4), a, dB(-34), 0, SS(0.15, 0.2));
    const rb = X.rumble({ dur: b - E.jesusLed, seed: 'stormBuild' }); shape(rb, E.jesusLed, dbCurve([[E.jesusLed, -18], [b, 0]]));
    place(sfx, fadeSt(rb, 0.5, 0.4), E.jesusLed, dB(-28), -0.2, null);
    cue(a, 'S10: wind, a low murmur; the storm starts to build as Jesus is led away');
    const td = q(S.S10.t0 + 0.4); place(sfx, X.airySwish('dock', 0.7, 0.7), td, dB(-35), 0, SS(0, 0.15));
    const tk = q(E.unlock); place(sfx, X.keyTurn({ seed: 'unlock' }), tk - 0.42, dB(-16), 0.1, SS(0.15, 0.25)); cue(tk, 'a guard turns the key (the bolt clunks on "day")');
    const tf = q(E.shacklesFall); place(sfx, X.lockClunk({ seed: 'cuffsOpen' }), tf, dB(-22), 0.1, SS(0.1, 0.25)); place(sfx, X.chainDrag({ dur: 0.5, rate: 16, seed: 'cuffSlide' }), tf + 0.03, dB(-27), 0.1, SS(0.1, 0.2));
    place(sfx, X.whoosh({ dur: E.shacklesLand - E.shacklesFall, peak: 0.85, f0: 160, f1: 700, f2: 300, q: 0.8, air: 0.2, seed: 'fallAir' }), tf, dB(-33), 0.1, SS(0, 0.1)); cue(tf, 'the cuffs open, the shackles fall (slow motion)');
    const tland = q(E.shacklesLand); place(sfx, X.ironOnStone({ seed: 'land' }), tland, dB(-8.5), 0.05, SS(0.2, 0.4, 0.2)); cue(tland, 'SHACKLES HIT THE STONE: heavy iron clank, echoing');
    const nb = steps(E.barabbasWalks, S.S11.t0 - 0.15, 0.58, { hard: 0.4, g0: -21, g1: -28, p0: 0.1, p1: 0.4, sends: SS(0.15, 0.3), seed: 'freeSteps' });
    cue(E.barabbasWalks, `Barabbas walks free (${nb} steps on stone)`);
    const nj = steps(E.jesusLed + 0.1, S.S11.t0 - 0.15, 0.75, { hard: 0.8, g0: -25, g1: -34, p0: -0.2, p1: -0.5, sends: SS(0.15, 0.35), seed: 'ledSoldiers' });
    steps(E.jesusLed + 0.45, S.S11.t0 - 0.15, 0.75, { hard: 0.3, g0: -27, g1: -35, p0: -0.15, p1: -0.45, sends: SS(0.15, 0.35), seed: 'ledJesus' });
    cue(E.jesusLed, `Jesus is led away with the soldiers (${nj} steps each, receding)`);
    const tm = q(E.majorLift); place(sfx, X.lowSwell({ dur: 3.2, f: 73.42, peak: 0.35, seed: 'liftSwell' }), tm - 0.8, dB(-25), 0, SS(0, 0.15)); place(sfx, X.shimmer({ notes: ['D6', 'F#6', 'A6', 'D7'], spacing: 0.09, dur: 2.4, bright: 0.25, air: 0.2, seed: 'liftShim' }), tm + 0.05, dB(-31), 0, SS(0, 0.55));
    cue(tm, 'major lift: warm swell + soft D-major shimmer');
  }

  // ================================================================ S11 Matthew 27:26 (full-screen card)
  {
    const tin = E.card2726 - 0.2; place(sfx, X.paperSlide({ dur: 0.7, seed: 'card2726' }), tin, dB(-20), -0.2, SS(0.1, 0.1)); cue(tin, 'paper slide: the parchment card comes in');
    const tb = q(W('B13', 'Barabbas')); place(sfx, X.chime({ notes: ['D6', 'F#6', 'A6'], spacing: 0.05, dur: 2.4, seed: 'cardGold' }), tb, dB(-25), 0.1, SS(0, 0.5)); cue(tb, 'soft chime: BARABBAS lands in gold');
    place(sfx, fadeSt(X.wind({ dur: S.S12.t0 - S.S11.t0 + 0.4, lo: 180, hi: 900, gust: 0.4, seed: 'cardWind' }), 0.4, 0.3), S.S11.t0, dB(-36), 0, null);
  }

  // ================================================================ S12 he looks back: wind, thunder over the hill, his face softens
  {
    const a = S.S12.t0 - 0.3, b = S.S14b.t0 + 0.1;
    const w = X.wind({ dur: b - a, lo: 150, hi: 1100, gust: 0.75, rate: 0.25, move: 0.9, seed: 'stormWind' });
    shape(w, a, dbCurve([[a, 0], [E.lightBreaks, 0], [E.lightBreaks + 2.5, -5], [S.S14a.t0, -6], [b, -8]]));
    place(sfx, fadeSt(w, 0.4, 0.15), a, dB(-23), 0, null);
    const rm = X.rumble({ dur: b - a, rolls: [], seed: 'stormLow' }); shape(rm, a, dbCurve([[a, 0], [E.lightBreaks, 0], [E.lightBreaks + 3, -8], [b, -10]]));
    place(sfx, fadeSt(rm, 0.4, 0.15), a, dB(-29), 0, null);
    cue(a, 'storm wind + low rumble (S12-S14a)');
    [[E.thunder1, [0, 0.9, 2.1], -0.15], [E.thunder2, [0, 0.7, 1.8], 0.1]].forEach(([t0, rolls, pan], k) => { const t = q(t0); place(sfx, X.thunder({ dur: 6, far: 1, rolls, seed: 'thunder' + k }), t, dB(-13), pan, SS(0, 0.2, 0.15)); cue(t, `distant thunder ${k + 1} over the hill`); });
    steps(S.S12.t0 + 0.05, E.turnBack - 0.2, 0.58, { hard: 0.4, g0: -23, sends: SS(0.1, 0.15), seed: 'gateSteps' });
    const tt = q(E.turnBack); place(sfx, X.rustle({ dur: 0.6, rate: 2, density: 90, seed: 'turn' }), tt, dB(-30), 0.1, SS(0.05)); place(sfx, X.stepStone({ weight: 0.6, hard: 0.3, seed: 'pivot' }), tt + 0.18, dB(-28), 0.05, SS(0.1, 0.15));
    cue(tt, 'he stops at the gate and turns (cloth rustle, a pivot step)');
    const ts = q(E.soften); place(sfx, X.lowSwell({ dur: 4.2, f: 73.42, peak: 0.6, seed: 'softSwell' }), ts, dB(-24), 0, SS(0, 0.2)); cue(ts, 'his face softens: warm low swell begins');
    place(sfx, X.thunder({ dur: 5, far: 1, rolls: [0, 1.1], seed: 'thunderAway' }), q(S.S14a.t0 + 0.2), dB(-20), -0.2, SS(0, 0.2, 0.1));
  }

  // ================================================================ S13 1 Peter 3:18: the light breaks through the storm
  {
    const tc = q(E.card318); place(sfx, X.shimmer({ notes: ['A6', 'D7', 'F#7'], spacing: 0.05, dur: 1.6, bright: 0.3, air: 0.2, seed: 'card318' }), tc, dB(-30), 0.2, SS(0, 0.5)); cue(tc, 'card shimmer (1 Peter 3:18)');
    const tl = q(E.lightBreaks);
    place(sfx, X.airyRise({ dur: 3.0, notes: ['D5', 'A5', 'D6', 'F#6', 'A6', 'D7'], seed: 'lightBreaks' }), tl - 0.1, dB(-22), 0, SS(0, 0.4, 0.3));
    place(sfx, X.lowSwell({ dur: 4.0, f: 73.42, peak: 0.45, seed: 'lightSwell' }), tl - 0.4, dB(-24), 0, SS(0, 0.15));
    cue(tl, 'THE LIGHT BREAKS through the clouds: airy rise + warm swell');
  }

  // ================================================================ S14 "you are Barabbas. So am I." -> the city at night
  {
    const a = E.matchCut - 0.05, b = E.endCard + 0.3;
    const cn = X.cityNight({ dur: b - a, passes: 2, seed: 'cityNight' }); shape(cn, a, dbCurve([[a, 0], [S.S15.t0, 0], [S.S15.t0 + 1, -6], [E.endCard - 0.4, -10], [b, -40]]));
    place(sfx, fadeSt(cn, 0.25, 0.3), a, dB(-25), 0, SS(0, 0.1));
    cue(a, 'match cut: soft city night ambience (fades under the CTA)');
    const tw = q(E.warmLight);
    place(sfx, X.shimmer({ notes: ['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7'], spacing: 0.16, dur: 2.6, bright: 0.3, air: 0.3, seed: 'warmShim' }), tw + 0.1, dB(-27), 0, SS(0, 0.6));
    place(sfx, X.lowSwell({ dur: 3.4, f: 73.42, peak: 0.45, seed: 'warmSwell' }), tw - 0.6, dB(-25), 0, SS(0, 0.15));
    cue(tw, 'WARM LIGHT: light shimmer + warm swell');
  }

  // ================================================================ S15 call to action: typing, POSTED, hearts; S16 end card, loop
  {
    const tb = q(S.S15.t0 + 0.15); place(sfx, X.goldGlow({ f: mtof(86), seed: 'ctaGlow' }), tb, dB(-31), 0, SS(0, 0.4)); cue(tb, 'the gold name returns above the comment box');
    const TYPED = [...'Thank You for taking', 'm', 'y', ' ', 'p', 'l', 'a', 'c', 'e', ' ', '\u{1F64F}'], nT = TYPED.length, r = D.makeRng('typing');
    for (let k = 0; k < nT; k++) {
      const t = q(E.typeStart + k * (E.typeEnd - E.typeStart) / (nT - 1) + r.uni(-0.008, 0.008)), ch = TYPED[k];
      if (ch === ' ') place(sfx, X.thock({ f: 220, seed: 'space' + k }), t, dB(-36), 0.2, SS(0.05));
      else if (k === nT - 1) place(sfx, X.heartPop({ f: mtof(81), seed: 'emoji' }), t, dB(-30), 0.2, SS(0.05, 0.15));
      else place(sfx, X.typeTick({ seed: 'ty' + k }), t, dB(-32) * r.uni(0.8, 1), 0.2, SS(0.05));
    }
    cue(q(E.typeStart), `typing ticks x${nT} (${E.typeStart.toFixed(2)} -> ${E.typeEnd.toFixed(2)} s)`);
    const tp = q(E.typeEnd + 0.05); place(sfx, X.airySwish('posted', 1.1, 0.45), tp - 0.1, dB(-31), 0.2, SS(0, 0.2)); cue(tp, 'POSTED: soft send swish');
    [74, 76, 78, 81, 83, 86].forEach((m, k) => { if (k >= E.hearts.length) return; const t = q(E.hearts[k]); place(sfx, X.heartPop({ f: mtof(m), seed: 'hp' + k }), t, dB(-28), 0.25 + 0.06 * k, SS(0.06, 0.15)); cue(t, `heart pop ${k + 1}`); });
  }
  {
    const t = q(E.endCard); place(sfx, X.chime({ seed: 'endChime' }), t, dB(-18), 0, SS(0, 0.5)); cue(t, 'end card chime');
    // the loop: the roar of frame 0 fades in under the dissolve, chant pulses in phase with the start
    const a = E.loopBack, d = dur - a;
    const roar = X.crowdRoar({ dur: d, energy: () => 0.95, voices: 28, chant: { rate: CHANT, sync: 0.55, depth: 0.8, phase: chantPhase(PER, d) }, seed: 'roarLoop' });
    scoop(roar); shape(roar, a, (t) => Math.pow(clamp((t - a) / d), 1.6));
    place(sfx, roar, a, dB(-13.5), 0, SS(0.12, 0.12));
    const wl = X.wind({ dur: d, lo: 220, hi: 1500, gust: 0.6, rate: 0.18, seed: 'windLoop' }); shape(wl, a, (t) => clamp((t - a) / d) * dB(-3));
    place(sfx, wl, a, dB(-26), 0, null);
    cue(a, 'loop: the crowd roar of frame 0 fades in under the dissolve');
    const tl = E.loopBack, w = X.loopWhoosh({ dur: dur - tl + E.hookHit, peak: (dur - tl) / (dur - tl + E.hookHit), seed: 'loop' });
    const cut = smp(dur - tl), A = w.subarray(0, cut), B = w.subarray(cut);
    placeMoving(sfx, A, tl, dB(-25), 0.4, 0, SS(0.05, 0.15)); placeMoving(sfx, B, 0, dB(-25), 0, -0.1, SS(0.05, 0.15));
    cue(tl, 'loop whoosh (peaks on the seam, its tail plays at 0 s into the hook hit)');
  }
  // ================================================================ shot transitions
  for (const s of plan.shots) {
    const t = q(s.t0);
    if (s.trans === 'whip') { const w = X.whipWhoosh('whip:' + s.id); placeMoving(sfx, w, t - w.length / SR * 0.63, dB(-17), -0.6, 0.6, SS(0.06)); cue(t, `whip whoosh -> ${s.id}`); }
    else if (s.trans === 'dust') { const w = X.dustSwish({ dur: 0.7, seed: 'dust:' + s.id }); place(sfx, w, t - 0.35, dB(-26), 0, SS(0.1, 0.1)); cue(t, `dust swish -> ${s.id}`); }
    else if (s.trans === 'flare') { const w = X.airySwish(`flare:${s.id}`, 1.15, 0.7); placeMoving(sfx, w, t - 0.35, dB(-28), 0.4, -0.4, SS(0.05, 0.2)); cue(t, `flare swish -> ${s.id}`); }
    else if (s.trans === 'match') { const w = X.whoosh({ dur: 0.7, peak: 0.5, f0: 200, f1: 1300, f2: 450, q: 0.8, air: 0.4, rise: 1.8, fall: 0.12, seed: 'match:' + s.id }); place(sfx, w, t - 0.35, dB(-30), 0, SS(0.05, 0.15)); cue(t, `match swish -> ${s.id}`); }
    else if (s.trans === 'dissolve' && s.id !== 'LOOP') { const w = X.airySwish(`dissolve:${s.id}`, 0.6, 0.9); place(sfx, w, t - 0.45, dB(-35), 0, SS(0, 0.2)); cue(t, `soft air -> ${s.id}`); }
  }
  return { sfx, room, hall, big };
}
