// THE OLDEST MAN: sound effects and ambience, placed from the shared plan (ctx.E events, ctx.SC scene
// spans, ctx.G time-lapse grid, plan.shots transitions). Hits land on the nearest video frame (ctx.q).
import * as D from './lib/dsp.mjs';
import * as X from './lib/sfx.mjs';
import { bell } from './lib/instruments.mjs';

const { SR, dB, nm, mtof, place, placeMoving, smp, lerp, clamp, ramp, cosRamp } = D;

export function renderSfx(ctx) {
  const { N, E, W, SC, G, plan, cue, q, dur } = ctx;
  const sfx = D.stereo(N), room = D.f32(N), hall = D.f32(N), big = D.f32(N);
  const SS = (r = 0, h = 0, b = 0) => [[room, r], [hall, h], [big, b]];
  const fadeSt = (s, fi, fo) => { D.fades(s.L, fi, fo); D.fades(s.R, fi, fo); return s; };
  // multiply a stereo signal (placed at t0) by a gain curve g(tAbs)
  const shape = (s, t0, g) => { for (let i = 0; i < s.L.length; i += 64) { const v = g(t0 + i / SR); for (let j = i; j < Math.min(s.L.length, i + 64); j++) { s.L[j] *= v; s.R[j] *= v; } } return s; };
  // continuous gain curve helper: 0 outside [a, b], cosine fades of fi / fo
  const win = (a, b, fi, fo) => (t) => (t < a || t > b ? 0 : Math.min(1, cosRamp((t - a) / fi), cosRamp((b - t) / fo)));

  // ================================================================ night ambience: wind, crickets, the lamp
  // S1 + S2 (from frame 0: it continues the loop), S8 + S9 until the lamp dies, and the loop tail
  const night = (a, b, { seed, lampAt, crkAt = () => 1, windAt = () => 1, gutter = 0, fi = 0, fo = 0.4 }) => {
    const d = b - a;
    const w = shape(X.wind({ dur: d, lo: 150, hi: 900, gust: 0.55, rate: 0.12, move: 0.6, seed: seed + 'w' }), a, (t) => windAt(t));
    const c = shape(X.crickets({ dur: d, count: 3, seed: seed + 'c' }), a, (t) => crkAt(t));
    const l = shape(X.lampFlame({ dur: d, gutter: (tt) => (typeof gutter === 'function' ? gutter(a + tt) : gutter), seed: seed + 'l' }), a, (t) => lampAt(t));
    for (const s of [w, c, l]) fadeSt(s, fi, fo);
    place(sfx, w, a, dB(-25), 0, null);
    place(sfx, c, a, dB(-34), 0, SS(0.1));
    place(sfx, l, a, dB(-24), 0.08, SS(0.18));
  };
  const S2 = SC.S2, S1end = SC.S3.t0 + 0.35;
  night(0, S1end, { seed: 'night1', lampAt: (t) => (t < S2.t0 ? 0.85 : 1.25), crkAt: (t) => (t < S2.t0 ? 1 : 0.8), fo: 0.6 });
  cue(0, 'night ambience: wind, crickets, lamp crackle (S1-S2)');
  // S8 -> lamp out: the flame gutters from the slam on and dies on "died"
  const gut = ramp([[0, 0.05], [E.slam, 0.1], [E.slam + 0.6, 0.35], [E.lampOut - 0.6, 0.85], [E.lampOut, 1]]);
  const tOut = q(E.lampOut);
  night(SC.S8.t0 - 0.15, tOut + 0.5, { seed: 'night2', gutter: gut, fi: 0.45, fo: 0.05,
    lampAt: (t) => (t < tOut ? (t < SC.S9.t0 ? 0.9 : 1.4) : Math.max(0, 1 - (t - tOut) / 0.05)),
    crkAt: (t) => (t < SC.S9.t0 ? 0.9 : 0.7) * (t < tOut ? 1 : Math.max(0, 1 - (t - tOut) / 0.45)),
    windAt: (t) => (t < tOut ? 1 : Math.max(0, 1 - (t - tOut) / 0.45)) });
  cue(SC.S8.t0, 'night ambience returns (S8-S9), the lamp gutters from the slam');
  // loop tail: the night of S1 fades in under the dissolve so the restart at 0 s is continuous
  night(E.loopBack, dur, { seed: 'nightLoop', lampAt: (t) => 0.85 * Math.pow(clamp((t - E.loopBack) / (dur - E.loopBack)), 0.7), crkAt: (t) => clamp((t - E.loopBack) / (dur - E.loopBack)), windAt: (t) => clamp((t - E.loopBack) / (dur - E.loopBack)), fo: 0 });
  cue(E.loopBack, 'night ambience fades in under the dissolve (continues at 0 s)');

  // ================================================================ S1 hook
  { const t = q(E.hookHit); place(sfx, X.deepHit({ seed: 'hookHit' }), t, dB(-8), 0, SS(0.05, 0.2, 0.1)); cue(t, 'HOOK HIT: deep D1 hit (title punches in)'); }
  { const t = q(E.hookOut), w = X.airySwish('hookOut', 0.9, 0.55); placeMoving(sfx, w, t - 0.28, dB(-33), 0.1, -0.3, SS(0.05, 0.15)); cue(t, 'soft swish: title flies to the caption spot'); }
  // ================================================================ S2 name + life-ribbon
  { const t = q(E.nameLabel); place(sfx, X.tick({ f: 1760, tau: 0.008, click: 0.2, seed: 'label' }), t, dB(-34), -0.2, SS(0.05, 0.2)); place(sfx, X.glint({ f: mtof(81), dur: 0.9, seed: 'labelGlint' }), t + 0.02, dB(-38), -0.2, SS(0, 0.4)); cue(t, 'label tick'); }
  {
    const t = q(E.ribbon);
    place(sfx, X.shimmer({ notes: ['A5', 'C6', 'F6', 'A6', 'C7', 'F7'], spacing: 0.16, dur: 2.4, bright: 0.3, air: 0.25, pan: [-0.8, 0.8], seed: 'ribbon' }), t, dB(-27), 0, SS(0, 0.5, 0.1));
    placeMoving(sfx, X.airySwish('ribbonAir', 1.2, 1.5), t, dB(-36), -0.8, 0.8, SS(0, 0.3));
    cue(t, 'life-ribbon shimmer (sweeps L -> R)');
  }
  // ================================================================ S3 Enoch: morning air, footsteps that stop, the airy shimmer
  {
    const a = SC.S3.t0 - 0.2, b = SC.S4.t0 + 0.4;
    place(sfx, fadeSt(X.wind({ dur: b - a, lo: 400, hi: 2600, gust: 0.4, rate: 0.15, seed: 'morning' }), 0.6, 0.5), a, dB(-33), 0, null);
    place(sfx, fadeSt(X.rustle({ dur: b - a, rate: 0.3, density: 90, seed: 'morningLeaves' }), 0.6, 0.5), a, dB(-37), 0, SS(0.05));
    const r = D.makeRng('enochSteps'), t0 = SC.S3.t0 + 0.25, tLast = E.enochGone - 0.32; let k = 0, t = t0;
    for (; t <= tLast; t += 0.56 + r.uni(-0.02, 0.02), k++) {
      const u = (t - t0) / (tLast - t0);
      place(sfx, X.stepSand({ weight: k % 2 ? 0.85 : 1, seed: 'st' + k }), q(t), dB(lerp(-27, -32, u)) * r.uni(0.85, 1), lerp(-0.25, 0.1, u) + (k % 2 ? 0.06 : -0.06), SS(0.12, 0.05));
    }
    cue(t0, `Enoch's footsteps on sand (${k}, last at ${(t - 0.56).toFixed(2)} s: they stop before "took")`);
    const tc = q(E.card524); place(sfx, X.shimmer({ notes: ['F6', 'A6', 'C7'], spacing: 0.05, dur: 1.5, bright: 0.25, air: 0.15, seed: 'card524' }), tc, dB(-32), 0.25, SS(0, 0.45)); cue(tc, 'card shimmer (Genesis 5:24)');
    const tg = q(E.enochGone); place(sfx, X.airyRise({ seed: 'enochGone' }), tg - 0.25, dB(-21), 0, SS(0, 0.35, 0.35)); cue(tg, 'ENOCH GONE: airy rising shimmer');
  }
  // ================================================================ S4 the parchment timeline
  {
    const t = q(SC.S4.t0); place(sfx, X.paperSlide({ dur: 0.9, seed: 'paper' }), t, dB(-21), 0.15, SS(0.15, 0.05)); cue(t, 'soft paper slide (timeline)');
    [[E.barMeth, 'D6', -0.3], [E.barAdam, 'F6', 0.1], [E.barNoah, 'A6', 0.35]].forEach(([t0, n, p], k) => {
      const tt = q(t0); place(sfx, X.goldGlow({ f: mtof(nm(n)), seed: 'glow' + k }), tt, dB(-29), p, SS(0, 0.45)); cue(tt, `gold glow ${n} (${['Methuselah bar', 'Adam overlap', 'Noah overlap'][k]})`);
    });
  }
  // ================================================================ S5-S7 the math
  {
    const s0 = SC.S5.t0 - 0.05, sw = X.lowSwell({ dur: 2.3, peak: 0.33, seed: 'mathSwell' });
    place(sfx, sw, s0, dB(-17), 0, SS(0, 0.12)); cue(s0, 'low swell (peaks on "math")');
    const tt = q(E.tracker); place(sfx, X.tick({ f: 1318.5, tau: 0.01, click: 0.25, seed: 'tracker' }), tt, dB(-31), 0, SS(0.05, 0.2)); place(sfx, X.glint({ f: mtof(76), dur: 1.0, seed: 'trackerGlint' }), tt + 0.01, dB(-35), 0, SS(0, 0.4)); cue(tt, 'tracker appears');
    // each number: dips 0.25 s before its word (inhale), lands with a deep wooden thock + a tone rising into D5 / F5 / A5
    [[E.n187, 'D2', 'D5'], [E.n182, 'F2', 'F5'], [E.n600, 'A2', 'A5']].forEach(([t0, low, tone], k) => {
      const t = q(t0);
      place(sfx, X.inhale({ dur: 0.25, seed: 'inhale' + k }), t - 0.25, dB(-29), 0, SS(0, 0.08));
      place(sfx, X.thock({ f: mtof(nm(low)), seed: 'thock' + k }), t, dB(-10.5), 0, SS(0.12, 0.12));
      place(sfx, X.riseTone({ target: mtof(nm(tone)), from: -7, glide: 0.42, seed: 'tone' + k }), t, dB(-25), [-0.2, 0.2, 0][k], SS(0, 0.45));
      cue(t - 0.25, `dip / inhale before ${['187', '182', '600'][k]}`); cue(t, `THOCK (${low}) + rising tone -> ${tone}`);
    });
  }
  // ================================================================ S8 line 9: numbers fly together, equals, SLAM
  {
    [[E.sum187, 'D5', -0.45], [E.sum182, 'F5', 0.45], [E.sum600, 'A5', 0]].forEach(([t0, n, p], k) => {
      const t = q(t0), w = X.whoosh({ dur: 0.32, peak: 0.72, f0: 700, f1: 4200, f2: 1500, q: 1.1, air: 0.4, rise: 2, fall: 0.05, seed: 'fly' + k });
      placeMoving(sfx, w, t - 0.32 * 0.72, dB(-31), p, 0, SS(0.05, 0.1));
      place(sfx, X.tick({ f: mtof(nm(n)) * 2, tau: 0.007, click: 0.3, seed: 'sumTick' + k }), t, dB(-30), p * 0.5, SS(0.05, 0.15));
      place(sfx, bell(mtof(nm(n)), { dur: 2.0, bright: 0.4, seed: 'sumBell' + k }), t, dB(-29), p * 0.5, SS(0, 0.5));
      cue(t, `number flies in + tick + bell ${n}`);
    });
    const te = q(E.equals), ts = q(E.slam);
    place(sfx, X.revSwell({ dur: ts - te, f0: 280, oct: 2.4, seed: 'suck' }), te, dB(-26), 0, SS(0, 0.1)); cue(te, 'equals: suck-in into the slam');
    place(sfx, X.warmBoom({ seed: 'slam' }), ts, dB(-7), 0, SS(0.05, 0.25, 0.2));
    place(sfx, X.shake({ seed: 'slamShake' }), ts + 0.01, dB(-21), 0, SS(0.1, 0.1));
    place(sfx, X.goldDust({ seed: 'slamDust' }), ts + 0.02, dB(-27), 0, SS(0, 0.4, 0.15));
    cue(ts, 'SLAM 969: big warm boom + shake + gold dust');
  }
  // ================================================================ S9 the lamp dies, near silence, one giant raindrop, far thunder
  {
    place(sfx, X.puff({ seed: 'puff' }), tOut, dB(-24), 0.05, SS(0.15, 0.1)); cue(tOut, 'lamp out: tiny puff (flame noise stops)');
    cue(E.silence, 'NEAR SILENCE (0.6 s)');
    const tf = q(E.dropFall), tsp = q(E.dropSplash);
    place(sfx, X.dropFall({ dur: tsp - tf, seed: 'dropFall' }), tf, dB(-32), 0, SS(0, 0.2, 0.2)); cue(tf, 'slow-motion drop falls');
    place(sfx, X.bigDrop({ seed: 'bigDrop' }), tsp, dB(-9), 0, SS(0.1, 0.3, 0.55)); cue(tsp, 'DROP SPLASH: huge amplified "plip"');
    const tt = q(E.thunderFar); place(sfx, X.thunder({ dur: 6, far: 1, rolls: [0, 0.8, 2.0], seed: 'farThunder' }), tt, dB(-15), -0.2, SS(0, 0.2, 0.15)); cue(tt, 'far thunder');
  }
  // ================================================================ S10 first soft rain, low wind
  {
    const a = q(E.dropSplash) + 0.25, b = SC.S11.t0 + 0.6;
    const I = ramp([[a, 0.03], [a + 1.0, 0.12], [W('B11', 'when'), 0.3], [b - 0.8, 0.42]]);
    place(sfx, shape(X.rain({ dur: b - a, intensity: (t) => I(a + t), rate: 90, hiss: 0.8, seed: 'firstRain' }), a, win(a, b, 0.3, 0.6)), a, dB(-8), 0, SS(0.08));
    place(sfx, fadeSt(X.wind({ dur: b - a + 0.4, lo: 110, hi: 600, gust: 0.5, rate: 0.1, seed: 'lowWind' }), 1.0, 0.6), a, dB(-29), 0, null);
    cue(a, 'first soft rain (sparse drops thickening) + low wind');
  }
  // ================================================================ S11 the time-lapse: hammers on the grid, crowd, seasons
  {
    const { bars, beat } = G, e8 = beat / 2, tStop = SC.S11.shots.find((s) => s.id === 'S11c')?.t0 ?? bars[3];
    const hammers = [
      { f: 760, pan: -0.15, g: -29, rs: 0.1, hs: 0.15, pat: [[0, 4], [0, 3, 4], [0, 2, 4, 6, 7]] },
      { f: 980, pan: 0.55, g: -34, rs: 0.15, hs: 0.3, pat: [[2, 6], [2, 5, 6], [1, 2, 5, 6]] },
      { f: 610, pan: -0.6, g: -36, rs: 0.15, hs: 0.35, pat: [[], [3, 7], [3, 7]] },
    ];
    const r = D.makeRng('hammers'); let nT = 0;
    hammers.forEach((h, j) => h.pat.forEach((p, bi) => p.forEach((k) => {
      const t = bars[bi] + k * e8; if (t > tStop - 0.05) return;
      place(sfx, X.hammerTap({ f: h.f * r.uni(0.98, 1.02), weight: r.uni(0.8, 1), seed: `ham${j}:${bi}:${k}` }), t, dB(h.g) * r.uni(0.8, 1), h.pan, SS(h.rs, h.hs)); nT++;
    })));
    cue(bars[0], `hammer taps on the 92 BPM grid (${nT}, until the ark is finished at ${tStop.toFixed(2)} s)`);
    const ma = bars[0] + 0.1, mb = tStop + 0.4;
    place(sfx, fadeSt(X.murmur({ dur: mb - ma, talkers: 10, pitchLo: 110, pitchHi: 240, lp: 1100, seed: 'crowd' }), 0.8, 0.6), ma, dB(-31), 0.1, SS(0.2, 0.1));
    [[51.8, 0.5, 190], [54.92, -0.45, 165], [56.7, 0.3, 210]].forEach(([t, p, f], k) => { if (t < mb - 0.3) place(sfx, X.laugh({ pitch: f, count: 4 + (k % 2), seed: 'laugh' + k }), t, dB(-36), p, SS(0.25, 0.2)); });
    cue(ma, 'crowd murmur + distant laughs (no words)');
    // seasons: green (leaves) -> dry (dusty gusts) -> green
    const segs = [[bars[0] - 0.25, bars[1] + 0.3, 'green'], [bars[1] - 0.3, bars[3] + 0.3, 'dry'], [bars[3] - 0.3, E.floodCrack + 0.2, 'green']];
    segs.forEach(([a, b, kind], k) => {
      const w = kind === 'dry' ? X.wind({ dur: b - a, lo: 140, hi: 1000, gust: 0.75, rate: 0.28, move: 0.9, seed: 'dry' + k }) : X.wind({ dur: b - a, lo: 260, hi: 1800, gust: 0.45, rate: 0.16, seed: 'green' + k });
      place(sfx, fadeSt(w, 0.5, 0.5), a, dB(kind === 'dry' ? -27 : -30), 0, null);
      if (kind === 'green') place(sfx, fadeSt(X.rustle({ dur: b - a, rate: 0.35, density: 130, seed: 'leaves' + k }), 0.5, 0.5), a, dB(-33), 0, SS(0.05));
      cue(a, `seasonal wind: ${kind}`);
    });
    const tc = q(E.card320); place(sfx, X.shimmer({ notes: ['D6', 'G6', 'Bb6', 'D7'], spacing: 0.07, dur: 2.2, bright: 0.3, air: 0.2, seed: 'card320' }), tc, dB(-27), 0.2, SS(0, 0.5)); cue(tc, 'warm card shimmer (1 Peter 3:20)');
  }
  // ================================================================ S12 the flood: the sky cracks with light, rain sheets, the ark lifts
  {
    const tc = q(E.floodCrack);
    place(sfx, X.revSwell({ dur: 0.3, f0: 600, oct: 3, seed: 'preCrack' }), tc - 0.3, dB(-28), 0, SS(0, 0.1));
    place(sfx, X.skyCrack({ seed: 'skyCrack' }), tc, dB(-11), 0, SS(0, 0.2, 0.25)); cue(tc, 'FLOOD CRACK: bright crack + deep rumble');
    const a = q(E.floodRain), b = E.city + 0.45;
    const I = ramp([[a, 0.1], [a + 0.6, 0.9], [E.arkLift, 1], [E.city, 0.95]]);
    place(sfx, shape(X.rain({ dur: b - a, intensity: (t) => I(a + t), rate: 650, hiss: 1.7, gust: 0.55, gustRate: 0.5, seed: 'sheets' }), a, win(a, b, 0.25, 0.4)), a, dB(-12), 0, SS(0.06, 0.05));
    cue(a, 'rain sheets');
    const tl = q(E.arkLift);
    place(sfx, X.waterSwell({ dur: 2.2, seed: 'lift' }), tl - 0.5, dB(-21), 0, SS(0, 0.15));
    place(sfx, X.creak({ dur: 1.3, seed: 'arkCreak' }), tl, dB(-28), 0.2, SS(0.1, 0.25));
    cue(tl, 'ark lifts: water swell + timber creak');
  }
  // ================================================================ S13 the city in the rain, the warm light
  {
    const a = E.city - 0.25, b = SC.S14.t0 + 0.35;
    const I = ramp([[a, 0.62], [E.warmLight, 0.55], [E.warmLight + 2.2, 0.28], [b, 0.24]]);
    place(sfx, shape(X.rain({ dur: b - a, intensity: (t) => I(a + t), surface: 'street', rate: 190, hiss: 1.1, gust: 0.2, seed: 'cityRain' }), a, win(a, b, 0.45, 0.55)), a, dB(-9), 0, SS(0.1, 0.04));
    place(sfx, fadeSt(X.trickle({ dur: b - a, seed: 'gutter' }), 0.8, 0.55), a, dB(-36), 0.3, SS(0.1));
    cue(a, 'soft rain on the streets (match cut), slowing after the warm light');
    const tw = q(E.warmLight);
    place(sfx, X.shimmer({ notes: ['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7'], spacing: 0.16, dur: 2.6, bright: 0.3, air: 0.3, seed: 'warmShim' }), tw + 0.1, dB(-27), 0, SS(0, 0.6));
    place(sfx, X.lowSwell({ dur: 3.4, f: 73.42, peak: 0.45, seed: 'warmSwell' }), tw - 0.6, dB(-24), 0, SS(0, 0.15));
    cue(tw, 'WARM LIGHT: light shimmer + warm swell');
    const tc = q(E.card39); place(sfx, X.shimmer({ notes: ['A6', 'D7', 'F#7'], spacing: 0.05, dur: 1.6, bright: 0.3, air: 0.2, seed: 'card39' }), tc, dB(-30), 0.2, SS(0, 0.5)); cue(tc, 'card shimmer (2 Peter 3:9)');
  }
  // ================================================================ S14 call to action
  {
    const td = q(E.dice); place(sfx, X.diceRattle({ seed: 'dice' }), td, dB(-26), -0.3, SS(0.12, 0.05)); cue(td, 'dice rattle');
    const th = q(E.hourglass); place(sfx, X.hourglass({ seed: 'hourglass' }), th, dB(-25), 0.3, SS(0, 0.45)); cue(th, 'golden hourglass chime + sand');
    const r = D.makeRng('typing'), nT = 8;               // "TIMING 🙏": six letters, a space, the emoji
    for (let k = 0; k < nT; k++) { const t = q(E.typeStart + k * (E.typeEnd - E.typeStart) / (nT - 1) + r.uni(-0.012, 0.012)); place(sfx, X.typeTick({ seed: 'ty' + k }), t, dB(-31) * r.uni(0.8, 1), 0.2, SS(0.05)); }
    cue(q(E.typeStart), `typing ticks x${nT} (${E.typeStart.toFixed(2)} -> ${E.typeEnd.toFixed(2)} s)`);
    [74, 76, 78, 81, 83, 86].forEach((m, k) => { if (k >= E.hearts.length) return; const t = q(E.hearts[k]); place(sfx, X.heartPop({ f: mtof(m), seed: 'hp' + k }), t, dB(-28), 0.25 + 0.06 * k, SS(0.06, 0.15)); cue(t, `heart pop ${k + 1}`); });
  }
  // ================================================================ S15 end card, loop whoosh
  {
    const t = q(E.endCard); place(sfx, X.chime({ seed: 'endChime' }), t, dB(-18), 0, SS(0, 0.5)); cue(t, 'end card chime');
    const tl = E.loopBack, w = X.loopWhoosh({ dur: dur - tl + E.hookHit, peak: (dur - tl) / (dur - tl + E.hookHit), seed: 'loop' });
    const cut = smp(dur - tl), A = w.subarray(0, cut), B = w.subarray(cut);
    placeMoving(sfx, A, tl, dB(-25), 0.4, 0, SS(0.05, 0.15)); placeMoving(sfx, B, 0, dB(-25), 0, -0.1, SS(0.05, 0.15));
    cue(tl, `loop whoosh (peaks on the seam, its tail plays at 0 s into the hook hit)`);
  }
  // ================================================================ shot transitions
  for (const s of plan.shots) {
    const t = q(s.t0);
    if (s.trans === 'whip') { const w = X.whipWhoosh('whip:' + s.id); placeMoving(sfx, w, t - w.length / SR * 0.63, dB(-19), -0.6, 0.6, SS(0.06)); cue(t, `whip whoosh -> ${s.id}`); }
    else if (s.trans === 'dust') { const w = X.dustSwish({ dur: 0.7, seed: 'dust:' + s.id }); place(sfx, w, t - 0.35, dB(-26), 0, SS(0.1, 0.1)); cue(t, `dust swish -> ${s.id}`); }
    else if (s.trans === 'flare') { if (s.id === 'S12') continue; const w = X.airySwish(`flare:${s.id}`, 1.15, 0.7); placeMoving(sfx, w, t - 0.35, dB(-27), 0.4, -0.4, SS(0.05, 0.2)); cue(t, `flare swish -> ${s.id}`); }
    else if (s.trans === 'push') { const w = X.pushWhoosh({ dur: 0.75, peak: 0.62, seed: 'push:' + s.id }); place(sfx, w, t - 0.75 * 0.62, dB(-19), 0, SS(0.05, 0.1)); cue(t, `push-through whoosh -> ${s.id}`); }
    else if (s.trans === 'match') { const w = X.whoosh({ dur: 0.7, peak: 0.5, f0: 200, f1: 1300, f2: 450, q: 0.8, air: 0.4, rise: 1.8, fall: 0.12, seed: 'match:' + s.id }); place(sfx, w, t - 0.35, dB(-30), 0, SS(0.05, 0.15)); cue(t, `match swish -> ${s.id}`); }
    // 'dissolve' (LOOP) is the loop whoosh above
  }
  return { sfx, room, hall, big };
}
