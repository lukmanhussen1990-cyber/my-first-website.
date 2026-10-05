// Night forest ambience for the exterior bus: individual crickets, a faint
// distant insect chorus, frogs and the occasional owl.

import {
  mulberry32, randRange, gainNode, biquad, createPan, glide, loopSource,
  disposeOnEnd, renderCricket, renderInsectChorus, renderFrogs, clamp01,
} from './dsp.js';

export class Forest {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} dest exterior bus input
   * @param {AudioNode} verbSend outdoor reverb send
   * @param {{noise: object}} res shared buffers
   * @param {AudioNode} [leakDest] post-insulation input: crickets stay faintly audible with the window shut
   */
  constructor(ctx, dest, verbSend, res, now, leakDest) {
    this.ctx = ctx;
    this.dest = dest;
    this.verbSend = verbSend;
    this.noise = res.noise;
    this.rng = mulberry32(4242);
    this.insects = 1;
    this.bus = gainNode(ctx, 0);
    this.bus.connect(dest);
    const send = gainNode(ctx, 0.12);
    this.bus.connect(send).connect(verbSend);
    if (leakDest) this.bus.connect(gainNode(ctx, 0.12)).connect(leakDest);

    const specs = [
      { seconds: 5.3, freq: 4250, period: 0.52, pulses: 3, pan: -0.55, level: 0.8 },
      { seconds: 6.7, freq: 4720, period: 0.71, pulses: 4, pan: 0.6, level: 0.6 },
      { seconds: 7.9, freq: 3900, period: 0.43, pulses: 2, pan: 0.15, level: 0.45 },
      { seconds: 9.1, freq: 5050, period: 0.95, pulses: 5, pan: -0.25, level: 0.35 },
    ];
    this.crickets = specs.map((s, i) => {
      const buf = renderCricket(ctx, { ...s, seed: 31 + i * 17 });
      const src = loopSource(ctx, buf, now, this.rng, 1 + (this.rng() - 0.5) * 0.03);
      const g = gainNode(ctx, s.level);
      const pan = createPan(ctx, s.pan);
      src.connect(g).connect(pan.input);
      pan.output.connect(this.bus);
      return { g, level: s.level, next: now + this.rng() * 4 };
    });

    const chorus = loopSource(ctx, renderInsectChorus(ctx, { seconds: 8.3 }), now, this.rng);
    const chorusGain = gainNode(ctx, 0.55);
    chorus.connect(chorusGain).connect(this.bus);

    const frogs = loopSource(ctx, renderFrogs(ctx, { seconds: 12.7 }), now, this.rng);
    const frogLp = biquad(ctx, 'lowpass', 1400, 0.6);
    const frogGain = gainNode(ctx, 0.2);
    frogs.connect(frogLp).connect(frogGain).connect(this.bus);

    this.nextOwl = now + randRange(this.rng, 9, 22);
  }

  /** Per-frame: overall forest level (insects 0 => uncomfortable silence). */
  update(now, insects) {
    this.insects = clamp01(insects);
    glide(this.bus.gain, 0.32 * Math.pow(this.insects, 1.3), now, 0.45);
  }

  schedule(now, until) {
    for (const c of this.crickets) {
      if (c.next >= until) continue;
      const t = Math.max(c.next, now);
      // crickets pause now and then, and vary their effort
      const target = this.rng() < 0.18 ? 0 : c.level * randRange(this.rng, 0.55, 1);
      c.g.gain.setTargetAtTime(target, t, target === 0 ? 0.25 : 0.8);
      c.next = t + randRange(this.rng, 2, 9);
    }
    if (this.nextOwl < until) {
      const t = Math.max(this.nextOwl, now);
      if (this.insects > 0.25) this.owl(t, this.insects);
      this.nextOwl = t + randRange(this.rng, 20, 60);
    }
  }

  /** "hoo… hoo-hoo", 350-450 Hz with a slight downward bend, far away. */
  owl(t, amount = 1) {
    const ctx = this.ctx;
    const rng = this.rng;
    const f0 = randRange(rng, 360, 440);
    const dist = randRange(rng, 0.4, 1);
    const hoots = [[0, 0.5], [1.05, 0.17], [1.3, 0.42]];
    if (rng() < 0.3) hoots.push([2.3, 0.45]);
    const end = t + hoots[hoots.length - 1][0] + hoots[hoots.length - 1][1] + 0.3;

    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const h2 = gainNode(ctx, 0.1);
    const env = gainNode(ctx, 0);
    const breath = ctx.createBufferSource();
    breath.buffer = this.noise.pink;
    breath.loop = true;
    const bp = biquad(ctx, 'bandpass', f0, 6);
    const benv = gainNode(ctx, 0);
    const lp = biquad(ctx, 'lowpass', 2600 - 1400 * dist, 0.7);
    const pan = createPan(ctx, randRange(rng, -0.8, 0.8));
    const level = 0.022 * amount * (1.2 - dist * 0.6);
    const send = gainNode(ctx, 0.9);

    osc.frequency.setValueAtTime(f0, t);
    osc2.frequency.setValueAtTime(f0 * 2, t);
    for (const [off, dur] of hoots) {
      const s = t + off;
      osc.frequency.setValueAtTime(f0 * 1.015, s);
      osc.frequency.linearRampToValueAtTime(f0 * 0.94, s + dur);
      osc2.frequency.setValueAtTime(f0 * 2.03, s);
      osc2.frequency.linearRampToValueAtTime(f0 * 1.88, s + dur);
      env.gain.setValueAtTime(0, s);
      env.gain.linearRampToValueAtTime(level, s + Math.min(0.07, dur * 0.3));
      env.gain.linearRampToValueAtTime(level * 0.85, s + dur * 0.7);
      env.gain.linearRampToValueAtTime(0, s + dur);
      benv.gain.setValueAtTime(0, s);
      benv.gain.linearRampToValueAtTime(level * 0.6, s + 0.05);
      benv.gain.linearRampToValueAtTime(0, s + dur);
    }
    osc.connect(env);
    osc2.connect(h2).connect(env);
    breath.connect(bp).connect(benv).connect(lp);
    env.connect(lp).connect(pan.input);
    pan.output.connect(this.dest);
    pan.output.connect(send).connect(this.verbSend);
    osc.start(t);
    osc2.start(t);
    breath.start(t, rng() * 2);
    osc.stop(end);
    osc2.stop(end);
    breath.stop(end);
    disposeOnEnd(osc, [osc, osc2, h2, env, breath, bp, benv, lp, pan, send]);
  }
}
