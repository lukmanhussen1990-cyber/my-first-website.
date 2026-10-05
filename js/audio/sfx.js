// One-shot sounds. Each creates a handful of short-lived nodes that are
// disconnected when their last source ends. `e` is the AudioEngine internals:
// { ctx, res, bus, rng, state, engine, radio, windowSide }.

import {
  TAU, clamp, clamp01, lerp, randRange, gainNode, biquad, createPan,
  disposeOnEnd, shotSource, mtof, hold,
} from './dsp.js';

const curve = (n, fn) => {
  const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = fn(i / (n - 1));
    a[i] = Number.isFinite(v) ? v : 0;
  }
  return a;
};

function osc(ctx, type, freq, t, stop) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.start(t);
  o.stop(stop);
  return o;
}

/** Fast decaying percussive envelope. */
function hit(param, t, peak, tc, attack = 0.003) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setTargetAtTime(0, t + attack, tc);
}

// ---------------------------------------------------------------------------

export function bump(e, s) {
  const { ctx, res, bus, rng } = e;
  const t = ctx.currentTime + 0.01;
  const end = t + 0.6;
  const thump = osc(ctx, 'sine', 62 + 25 * s, t, end);
  thump.frequency.exponentialRampToValueAtTime(34, t + 0.2);
  const tg = gainNode(ctx, 0);
  hit(tg.gain, t, 0.18 * s, 0.07, 0.006);
  const thud = shotSource(ctx, res.noise.brown, t, end, rng);
  const thudLp = biquad(ctx, 'lowpass', 220, 0.7);
  const dg = gainNode(ctx, 0);
  hit(dg.gain, t, 0.28 * s, 0.045, 0.004);
  // interior rattle: a few tiny ticks of loose trim
  const rat = shotSource(ctx, res.noise.white, t, end, rng);
  const ratBp = biquad(ctx, 'bandpass', randRange(rng, 1800, 3200), 2.5);
  const rg = gainNode(ctx, 0);
  const ticks = 2 + Math.round(5 * s * rng() + 2 * s);
  let tt = t + 0.012;
  for (let i = 0; i < ticks; i++) {
    rg.gain.setTargetAtTime(0.06 * s * (0.4 + rng()), tt, 0.0006);
    rg.gain.setTargetAtTime(0, tt + 0.002, 0.005);
    tt += randRange(rng, 0.012, 0.045);
  }
  const pan = createPan(ctx, randRange(rng, -0.3, 0.3));
  thump.connect(tg).connect(bus.cabin);
  thud.connect(thudLp).connect(dg).connect(bus.cabin);
  rat.connect(ratBp).connect(rg).connect(pan.input);
  pan.output.connect(bus.cabin);
  disposeOnEnd(thump, [thump, tg, thud, thudLp, dg, rat, ratBp, rg, pan]);
}

export function wiperStroke(e, dur) {
  const { ctx, res, bus, rng, state } = e;
  const t = ctx.currentTime + 0.01;
  const end = t + dur + 0.4;
  const out = biquad(ctx, 'lowpass', 3200, 0.7); // heard from the back seat
  const pan = createPan(ctx, -0.12);
  out.connect(pan.input);
  pan.output.connect(bus.cabin);
  // motor whir, slightly loaded mid-stroke
  const motor = osc(ctx, 'sawtooth', 82, t, end);
  motor.frequency.linearRampToValueAtTime(104, t + dur * 0.45);
  motor.frequency.linearRampToValueAtTime(90, t + dur);
  const mBp = biquad(ctx, 'bandpass', 420, 1.1);
  const mg = gainNode(ctx, 0);
  mg.gain.setValueAtTime(0, t);
  mg.gain.linearRampToValueAtTime(0.032, t + 0.05);
  mg.gain.setTargetAtTime(0, t + dur - 0.04, 0.03);
  motor.connect(mBp).connect(mg).connect(out);
  // rubber swish over wet glass
  const swish = shotSource(ctx, res.noise.pink, t, end, rng);
  const sBp = biquad(ctx, 'bandpass', 1100, 1.1);
  sBp.frequency.setValueAtTime(800, t);
  sBp.frequency.linearRampToValueAtTime(1700, t + dur * 0.5);
  sBp.frequency.linearRampToValueAtTime(900, t + dur);
  const sg = gainNode(ctx, 0);
  const wet = clamp01(Math.max(state.wetness, state.rain));
  sg.gain.setValueCurveAtTime(curve(64, (x) => Math.sin(Math.PI * x) ** 1.5 * (0.035 + 0.045 * wet)), t, dur);
  swish.connect(sBp).connect(sg).connect(out);
  // soft rubber squeak near the reversal, more on drier glass
  const sq = osc(ctx, 'triangle', 1700, t, end);
  const jitter = rng() * 10;
  sq.frequency.setValueCurveAtTime(curve(48, (x) => 1650 + 260 * x + 90 * Math.sin(TAU * (x * 23 + jitter))), t, dur);
  const qg = gainNode(ctx, 0);
  const qAmt = (0.012 + 0.02 * (1 - wet)) * (0.5 + rng());
  qg.gain.setValueCurveAtTime(curve(64, (x) => qAmt * (Math.exp(-((x - 0.82) ** 2) / 0.004) + 0.5 * Math.exp(-((x - 0.1) ** 2) / 0.002))), t, dur);
  sq.connect(qg).connect(out);
  // end thunk as the arm parks/reverses
  const te = t + dur;
  const thunk = osc(ctx, 'sine', 120, te, end);
  thunk.frequency.exponentialRampToValueAtTime(65, te + 0.08);
  const kg = gainNode(ctx, 0);
  hit(kg.gain, te, 0.07, 0.035);
  thunk.connect(kg).connect(out);
  disposeOnEnd(thunk, [motor, mBp, mg, swish, sBp, sg, sq, qg, thunk, kg, out, pan]);
}

export function thunder(e, distance) {
  const { ctx, res, bus, rng } = e;
  const d = clamp01(distance);
  const t = ctx.currentTime + 0.05 + d * 2.5;
  const dur = 4 + 4.5 * d + rng() * 2;
  const end = t + dur + 0.2;
  const level = 0.34 - 0.15 * d;
  const nodes = [];
  const outPan = createPan(ctx, randRange(rng, -0.5, 0.5));
  const send = gainNode(ctx, 0.55 + 0.25 * d);
  outPan.output.connect(bus.ext);
  outPan.output.connect(send).connect(bus.extVerb);
  nodes.push(outPan, send);

  // rolling envelope: several overlapping bumps under a slow decay
  const bumps = [];
  const nb = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < nb; i++) bumps.push([rng() * 0.6, randRange(rng, 0.04, 0.16), 0.4 + rng() * 0.6]);
  const roll = (x) => {
    let v = 0;
    for (const [c, w, a] of bumps) v += a * Math.exp(-((x - c) ** 2) / (2 * w * w));
    const attack = Math.min(1, x / (0.02 + 0.08 * d));
    return attack * v * Math.exp(-x * 2.2) * Math.min(1, (1 - x) * 12);
  };
  let peak = 0;
  for (let i = 0; i < 200; i++) peak = Math.max(peak, roll(i / 199));

  const rum = shotSource(ctx, res.noise.brown, t, end, rng);
  const rLp = biquad(ctx, 'lowpass', 420 - 300 * d, 0.6);
  const rg = gainNode(ctx, 0);
  rg.gain.setValueCurveAtTime(curve(256, (x) => (roll(x) / peak) * level * 1.4), t, dur);
  rum.connect(rLp).connect(rg).connect(outPan.input);
  nodes.push(rum, rLp, rg);

  if (d < 0.75) {
    const roar = shotSource(ctx, res.noise.pink, t, end, rng);
    const bp = biquad(ctx, 'bandpass', 500, 0.5);
    const g = gainNode(ctx, 0);
    const k = (1 - d / 0.75) * level * 0.6;
    g.gain.setValueCurveAtTime(curve(256, (x) => (roll(Math.min(1, x * 1.6)) / peak) * k), t, dur);
    roar.connect(bp).connect(g).connect(outPan.input);
    nodes.push(roar, bp, g);
  }
  if (d < 0.45) {
    // the crack: jagged broadband tearing at the very start
    const crack = shotSource(ctx, res.noise.white, t, end, rng);
    const hp = biquad(ctx, 'highpass', 700, 0.6);
    const g = gainNode(ctx, 0);
    const k = (1 - d / 0.45) * level * 0.5;
    const cd = 0.35 + rng() * 0.25;
    const seed = rng() * 100;
    g.gain.setValueCurveAtTime(curve(128, (x) => {
      const jag = 0.5 + 0.5 * Math.sin(seed + x * 97) * Math.sin(seed * 2 + x * 41);
      return k * Math.min(1, x * 20) * Math.exp(-x * 5) * (0.35 + 0.65 * jag) * Math.min(1, (1 - x) * 20);
    }), t, cd);
    crack.connect(hp).connect(g).connect(outPan.input);
    nodes.push(crack, hp, g);
  }
  disposeOnEnd(rum, nodes);
}

export function passBy(e, opts = {}) {
  const { ctx, res, bus, rng, state } = e;
  const side = opts.side === 1 ? 1 : opts.side === -1 ? -1 : -1;
  const dur = clamp(Number.isFinite(opts.duration) ? opts.duration : 2.5, 1, 8);
  const loud = clamp01(Number.isFinite(opts.loudness) ? opts.loudness : 0.7);
  const t = ctx.currentTime + 0.02;
  const end = t + dur + 0.1;
  const vRel = Math.max(18, state.speed + 22);
  const tc = 0.55;
  const lateral = 3.2;
  const pts = 96;
  const geo = (x) => {
    const along = vRel * (x - tc) * dur;
    const dist = Math.hypot(along, lateral);
    const fade = Math.min(1, x / 0.15) * Math.min(1, (1 - x) / 0.12);
    const radial = (vRel * along) / dist; // >0 receding
    return { amp: Math.pow(lateral / dist, 1.1) * fade, doppler: 343 / (343 + radial), lat: lateral / dist };
  };
  const wet = clamp01(state.wetness);
  const pan = createPan(ctx, side * 0.3);
  pan.curve(Array.from(curve(pts, (x) => side * (0.25 + 0.65 * Math.sqrt(geo(x).lat)) * (x > tc ? 0.85 : 1))), t, dur);
  const send = gainNode(ctx, 0.15);
  pan.output.connect(bus.ext);
  pan.output.connect(send).connect(bus.extVerb);

  const f0 = randRange(rng, 62, 84);
  const eng = osc(ctx, 'sawtooth', f0, t, end);
  eng.frequency.setValueCurveAtTime(curve(pts, (x) => f0 * geo(x).doppler), t, dur);
  const eLp = biquad(ctx, 'lowpass', 380, 0.8);
  const eg = gainNode(ctx, 0);
  eg.gain.setValueCurveAtTime(curve(pts, (x) => geo(x).amp * 0.13 * loud), t, dur);
  eng.connect(eLp).connect(eg).connect(pan.input);

  const hiss = shotSource(ctx, res.noise.white, t, end, rng);
  const hBp = biquad(ctx, 'bandpass', 3000, 0.7);
  hBp.frequency.setValueCurveAtTime(curve(pts, (x) => 2800 * geo(x).doppler), t, dur);
  const hg = gainNode(ctx, 0);
  hg.gain.setValueCurveAtTime(curve(pts, (x) => geo(x).amp ** 1.3 * (0.25 + 0.6 * wet) * 0.33 * loud), t, dur);
  hiss.connect(hBp).connect(hg).connect(pan.input);

  const whoosh = shotSource(ctx, res.noise.pink, t, end, rng);
  const wLp = biquad(ctx, 'lowpass', 800, 0.6);
  wLp.frequency.setValueCurveAtTime(curve(pts, (x) => 300 + 4200 * geo(x).amp ** 2), t, dur);
  const wg = gainNode(ctx, 0);
  wg.gain.setValueCurveAtTime(curve(pts, (x) => geo(x).amp ** 1.8 * 0.3 * loud), t, dur);
  whoosh.connect(wLp).connect(wg).connect(pan.input);
  disposeOnEnd(eng, [eng, eLp, eg, hiss, hBp, hg, whoosh, wLp, wg, pan, send]);
}

export function engineFalter(e, dur) {
  const { ctx, rng, engine } = e;
  const t = ctx.currentTime + 0.01;
  const g = engine.falter.gain;
  hold(g, t);
  for (const o of engine.oscs) hold(o.detune, t);
  let tt = t;
  while (tt < t + dur) {
    const w = randRange(rng, 0.04, 0.16);
    const depth = randRange(rng, 0.12, 0.6);
    const cents = -randRange(rng, 60, 260);
    g.setTargetAtTime(depth, tt, 0.012);
    g.setTargetAtTime(1, tt + w, 0.03);
    for (const o of engine.oscs) {
      o.detune.setTargetAtTime(cents, tt, 0.02);
      o.detune.setTargetAtTime(0, tt + w, 0.05);
    }
    tt += w + randRange(rng, 0.03, 0.2);
  }
  g.setTargetAtTime(1, tt, 0.08);
  for (const o of engine.oscs) o.detune.setTargetAtTime(0, tt, 0.1);
}

export function windowMotor(e, dur) {
  const { ctx, res, bus, rng, windowSide } = e;
  const t = ctx.currentTime + 0.01;
  const te = t + dur;
  const end = te + 0.5;
  const pan = createPan(ctx, 0.45 * windowSide);
  pan.output.connect(bus.cabin);
  const m = osc(ctx, 'sawtooth', 70, t, end);
  m.frequency.linearRampToValueAtTime(148, t + 0.09);
  m.frequency.linearRampToValueAtTime(138 + rng() * 8, te - 0.05);
  m.frequency.linearRampToValueAtTime(60, te + 0.08);
  const bp = biquad(ctx, 'bandpass', 1100, 1.4);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.04, t + 0.06);
  g.gain.setValueAtTime(0.04, te - 0.02);
  g.gain.linearRampToValueAtTime(0, te + 0.08);
  m.connect(bp).connect(g).connect(pan.input);
  const whine = osc(ctx, 'sine', 2150, t, end);
  whine.frequency.linearRampToValueAtTime(2300, te);
  const wg = gainNode(ctx, 0);
  wg.gain.setValueAtTime(0, t);
  wg.gain.linearRampToValueAtTime(0.006, t + 0.1);
  wg.gain.linearRampToValueAtTime(0, te + 0.05);
  whine.connect(wg).connect(pan.input);
  // the glass stops in its seal
  const clunk = osc(ctx, 'sine', 95, te, end);
  clunk.frequency.exponentialRampToValueAtTime(55, te + 0.1);
  const cg = gainNode(ctx, 0);
  hit(cg.gain, te, 0.09, 0.04);
  clunk.connect(cg).connect(pan.input);
  const tick = shotSource(ctx, res.noise.white, te, end, rng);
  const tb = biquad(ctx, 'bandpass', 2400, 1.5);
  const tg = gainNode(ctx, 0);
  hit(tg.gain, te, 0.05, 0.008, 0.001);
  tick.connect(tb).connect(tg).connect(pan.input);
  disposeOnEnd(clunk, [m, bp, g, whine, wg, clunk, cg, tick, tb, tg, pan]);
}

export function click(e, level = 1) {
  const { ctx, res, bus, rng } = e;
  const t = ctx.currentTime + 0.005;
  const end = t + 0.15;
  const src = shotSource(ctx, res.noise.white, t, end, rng);
  const hp = biquad(ctx, 'bandpass', randRange(rng, 3000, 4200), 1.2);
  const g = gainNode(ctx, 0);
  hit(g.gain, t, 0.12 * level, 0.004, 0.0008);
  const body = osc(ctx, 'sine', 520, t, end);
  body.frequency.exponentialRampToValueAtTime(300, t + 0.02);
  const bg = gainNode(ctx, 0);
  hit(bg.gain, t, 0.05 * level, 0.008, 0.001);
  const pan = createPan(ctx, randRange(rng, -0.25, 0.1));
  src.connect(hp).connect(g).connect(pan.input);
  body.connect(bg).connect(pan.input);
  pan.output.connect(bus.cabin);
  disposeOnEnd(body, [src, hp, g, body, bg, pan]);
}

// ---------------------------------------------------------------------------
// Score stingers (non-diegetic, scoreBus)

function notice(e) {
  const { ctx, res, bus, rng } = e;
  const t = ctx.currentTime + 0.02;
  const end = t + 6;
  const lp = biquad(ctx, 'lowpass', 300, 0.7);
  lp.frequency.setValueAtTime(220, t);
  lp.frequency.linearRampToValueAtTime(700, t + 1.4);
  lp.frequency.linearRampToValueAtTime(250, t + 4.5);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(0.04, t, 0.45);
  g.gain.setTargetAtTime(0, t + 1.6, 0.9);
  const send = gainNode(ctx, 0.6);
  lp.connect(g);
  g.connect(bus.score);
  g.connect(send).connect(bus.scoreVerb);
  const nodes = [lp, g, send];
  for (const [m, det] of [[38, -4], [45, 5], [50, -3], [57, 7]]) {
    const o = osc(ctx, 'triangle', mtof(m), t, end);
    o.detune.value = det;
    o.connect(lp);
    nodes.push(o);
  }
  const air = shotSource(ctx, res.noise.pink, t, end, rng);
  const ab = biquad(ctx, 'bandpass', 380, 0.8);
  const ag = gainNode(ctx, 0.25);
  air.connect(ab).connect(ag).connect(lp);
  nodes.push(air, ab, ag);
  // sub thump
  const sub = osc(ctx, 'sine', 52, t, end);
  sub.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  const sg = gainNode(ctx, 0);
  hit(sg.gain, t, 0.16, 0.2, 0.01);
  sub.connect(sg).connect(bus.score);
  nodes.push(sub, sg);
  disposeOnEnd(sub, nodes);
}

function heartbeat(e) {
  const { ctx, bus, rng } = e;
  const t = ctx.currentTime + 0.05;
  const beats = 3 + (rng() < 0.5 ? 1 : 0);
  const end = t + beats * 1.15 + 1;
  const o = osc(ctx, 'triangle', 55, t, end);
  const g = gainNode(ctx, 0);
  const lp = biquad(ctx, 'lowpass', 170, 0.7);
  let tt = t;
  for (let i = 0; i < beats; i++) {
    for (const [off, f, a] of [[0, 64, 0.21], [0.27, 58, 0.14]]) {
      const s = tt + off;
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(38, s + 0.12);
      g.gain.setTargetAtTime(a * (1 - i * 0.08), s, 0.006);
      g.gain.setTargetAtTime(0, s + 0.03, 0.045);
    }
    tt += 1.05 + i * 0.06;
  }
  o.connect(lp).connect(g).connect(bus.score);
  disposeOnEnd(o, [o, g, lp]);
}

function swell(e) {
  const { ctx, res, bus, rng } = e;
  const t = ctx.currentTime + 0.02;
  const dur = randRange(rng, 2.2, 2.9);
  const src = shotSource(ctx, res.noise.white, t, t + dur + 0.2, rng);
  const bp = biquad(ctx, 'bandpass', 500, 0.7);
  bp.frequency.setValueAtTime(400, t);
  bp.frequency.exponentialRampToValueAtTime(8500, t + dur);
  const g = gainNode(ctx, 0);
  const k = 4;
  g.gain.setValueCurveAtTime(curve(128, (x) => 0.28 * ((Math.exp(k * x) - 1) / (Math.exp(k) - 1)) * Math.min(1, (1 - x) * 30)), t, dur);
  const send = gainNode(ctx, 0.7);
  src.connect(bp).connect(g);
  g.connect(bus.score);
  g.connect(send).connect(bus.scoreVerb);
  disposeOnEnd(src, [src, bp, g, send]);
}

function glitch(e) {
  const { ctx, res, bus, rng, radio } = e;
  const t = ctx.currentTime + 0.01;
  const dur = randRange(rng, 0.25, 0.5);
  const end = t + dur + 0.1;
  const buzz = osc(ctx, 'square', randRange(rng, 90, 160), t, end);
  const bLp = biquad(ctx, 'lowpass', 2200, 0.7);
  const bg = gainNode(ctx, 0.06);
  const crackle = shotSource(ctx, res.crackle, t, end, rng);
  crackle.playbackRate.value = 1.8;
  const hp = biquad(ctx, 'highpass', 600, 0.7);
  const cg = gainNode(ctx, 0.8);
  const g = gainNode(ctx, 0);
  const seed = rng() * 50;
  g.gain.setValueCurveAtTime(curve(96, (x) => {
    const gate = Math.sin(seed + x * 61) * Math.sin(seed * 1.7 + x * 23) > 0.1 ? 1 : 0.08;
    return 0.4 * gate * Math.min(1, (1 - x) * 15) * Math.min(1, x * 30);
  }), t, dur);
  buzz.connect(bLp).connect(bg).connect(g);
  crackle.connect(hp).connect(cg).connect(g);
  g.connect(bus.cabin);
  if (radio) radio.glitch(t, 1);
  disposeOnEnd(buzz, [buzz, bLp, bg, crackle, hp, cg, g]);
}

function arrival(e) {
  const { ctx, bus } = e;
  const t = ctx.currentTime + 0.05;
  const end = t + 13;
  const lp = biquad(ctx, 'lowpass', 900, 0.6);
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.linearRampToValueAtTime(2000, t + 4);
  lp.frequency.linearRampToValueAtTime(1100, t + 11);
  const g = gainNode(ctx, 0);
  g.gain.setValueAtTime(0, t);
  g.gain.setTargetAtTime(0.027, t, 0.9);
  g.gain.setTargetAtTime(0, t + 6, 1.6);
  const send = gainNode(ctx, 0.5);
  lp.connect(g);
  g.connect(bus.score);
  g.connect(send).connect(bus.scoreVerb);
  const nodes = [lp, g, send];
  // Cmaj9 with a low C: warm, open, resolved
  let last = null;
  for (const m of [36, 48, 55, 59, 62, 64, 67]) {
    for (const det of [-6, 5]) {
      const o = osc(ctx, m < 50 ? 'triangle' : 'sawtooth', mtof(m), t, end);
      o.detune.value = det;
      const og = gainNode(ctx, m < 50 ? 0.9 : 0.35);
      o.connect(og).connect(lp);
      nodes.push(o, og);
      last = o;
    }
  }
  // a soft high bell
  const bell = osc(ctx, 'sine', mtof(76), t + 1.2, end);
  const bg = gainNode(ctx, 0);
  bg.gain.setValueAtTime(0, t + 1.2);
  bg.gain.linearRampToValueAtTime(0.012, t + 1.25);
  bg.gain.setTargetAtTime(0, t + 1.25, 1.5);
  bell.connect(bg);
  bg.connect(bus.score);
  bg.connect(send);
  nodes.push(bell, bg);
  disposeOnEnd(last, nodes);
}

const STINGERS = { notice, heartbeat, swell, glitch, arrival };

export function stinger(e, kind) {
  const fn = STINGERS[kind];
  if (fn) fn(e);
}

// ---------------------------------------------------------------------------

/** Brief sparks/flicker on the failing streetlight buzz (scheduler driven). */
export function buzzFlicker(e, t, amount) {
  const { rng, buzz } = e;
  const g = buzz.flicker.gain;
  const c = buzz.crackle.gain;
  let tt = t;
  const n = 2 + Math.floor(rng() * 6);
  for (let i = 0; i < n; i++) {
    const on = randRange(rng, 0.02, 0.12);
    g.setTargetAtTime(lerp(1, randRange(rng, 0.05, 0.5), amount), tt, 0.008);
    c.setTargetAtTime(0.3 + 1.2 * amount * rng(), tt, 0.005);
    g.setTargetAtTime(1, tt + on, 0.02);
    c.setTargetAtTime(0.15, tt + on, 0.02);
    tt += on + randRange(rng, 0.02, 0.15);
  }
  return tt;
}
