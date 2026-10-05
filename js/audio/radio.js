// The driver's car radio: two procedural stations, static/crackle layers,
// interference (dropouts, bursts, wow/flutter) and a small-speaker voicing.

import {
  clamp01, mulberry32, biquad, gainNode, glide, loopSource, disposeOnEnd,
  makeSaturationCurve, randRange,
} from './dsp.js';
import { NightDriveMusic, AmGhost } from './radioMusic.js';

const LABELS = { fm: '96.4 FM · NIGHT DRIVE', am: 'AM 1520 · ···', off: 'OFF' };
const ORDER = ['fm', 'am', 'off'];

export class Radio {
  /**
   * @param {BaseAudioContext} ctx
   * @param {AudioNode} dest cabin bus input
   * @param {{noise: object, crackle: AudioBuffer}} res shared buffers
   */
  constructor(ctx, dest, res, now) {
    this.ctx = ctx;
    this.rng = mulberry32(964);
    this.station = 'fm';
    this.lastStation = 'fm';
    this.interference = 0;

    // --- programme material -------------------------------------------
    this.fmGate = gainNode(ctx, 0);
    this.amGate = gainNode(ctx, 0);
    this.amFade = gainNode(ctx, 0.5); // slow signal fading (scheduler only)
    const amHp = biquad(ctx, 'highpass', 320, 0.7);
    const amLp = biquad(ctx, 'lowpass', 2300, 0.9);
    this.music = new NightDriveMusic(ctx, this.fmGate, res.noise);
    const amPre = gainNode(ctx, 1);
    this.am = new AmGhost(ctx, amPre);
    amPre.connect(amHp).connect(amLp).connect(this.amFade).connect(this.amGate);

    // wow & flutter via a modulated delay line
    this.warble = ctx.createDelay(0.1);
    this.warble.delayTime.value = 0.015;
    this.wow = ctx.createOscillator();
    this.wow.frequency.value = 0.55;
    this.wowDepth = gainNode(ctx, 0.0002);
    this.flutter = ctx.createOscillator();
    this.flutter.frequency.value = 5.3;
    this.flutterDepth = gainNode(ctx, 0.00002);
    this.wow.connect(this.wowDepth).connect(this.warble.delayTime);
    this.flutter.connect(this.flutterDepth).connect(this.warble.delayTime);
    this.dropout = gainNode(ctx, 1); // scheduler only
    this.programme = gainNode(ctx, 1); // per-frame
    this.fmGate.connect(this.warble);
    this.amGate.connect(this.warble);
    this.warble.connect(this.dropout).connect(this.programme);

    // --- noise layers ----------------------------------------------------
    this.mix = gainNode(ctx, 1);
    this.programme.connect(this.mix);
    const staticSrc = loopSource(ctx, res.noise.white, now, this.rng);
    const staticBp = biquad(ctx, 'bandpass', 2600, 0.45);
    this.staticLevel = gainNode(ctx, 0); // per-frame
    this.staticBurst = gainNode(ctx, 1); // scheduler only (multiplier)
    staticSrc.connect(staticBp).connect(this.staticLevel).connect(this.staticBurst).connect(this.mix);
    const crackleSrc = loopSource(ctx, res.crackle, now, this.rng);
    this.crackleLevel = gainNode(ctx, 0);
    crackleSrc.connect(this.crackleLevel).connect(this.mix);
    // heterodyne whistle of a weak AM signal
    this.whistle = ctx.createOscillator();
    this.whistle.frequency.value = 1830;
    this.whistleLevel = gainNode(ctx, 0);
    this.whistle.connect(this.whistleLevel).connect(this.mix);
    // tuning sweep burst (station changes / power)
    const tuneSrc = loopSource(ctx, res.noise.white, now, this.rng);
    this.tuneBp = biquad(ctx, 'bandpass', 1500, 1.2);
    this.tuneGain = gainNode(ctx, 0);
    tuneSrc.connect(this.tuneBp).connect(this.tuneGain).connect(this.mix);

    // --- small car speakers ------------------------------------------------
    const hp = biquad(ctx, 'highpass', 120, 0.75);
    const lp = biquad(ctx, 'lowpass', 6500, 0.7);
    const peak = biquad(ctx, 'peaking', 2400, 1.3, 3.5);
    const box = biquad(ctx, 'peaking', 190, 1.4, 2.5);
    const drive = gainNode(ctx, 1.5);
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSaturationCurve(1.5);
    const makeup = gainNode(ctx, 0.6);
    this.power = gainNode(ctx, 1);
    this.out = gainNode(ctx, 0.125);
    this.mix.connect(hp).connect(lp).connect(peak).connect(box).connect(drive)
      .connect(shaper).connect(makeup).connect(this.power).connect(this.out).connect(dest);

    for (const o of [this.wow, this.flutter, this.whistle]) o.start(now);
    this.nextEvent = now + 0.5;
    this.nextFade = now;
    this.applyStation(now, true);
  }

  get label() {
    return LABELS[this.station];
  }

  /** Radio power with a brief burst of static. */
  setPower(on, t) {
    if (on === (this.station !== 'off')) return;
    this.station = on ? this.lastStation : 'off';
    this.tuneBurst(t, on ? 0.35 : 0.2);
    this.applyStation(t);
  }

  /** Cycle FM -> AM -> OFF -> FM; returns the new label. */
  next(t) {
    const i = ORDER.indexOf(this.station);
    this.station = ORDER[(i + 1) % ORDER.length];
    if (this.station !== 'off') this.lastStation = this.station;
    this.tuneBurst(t, 0.3);
    this.applyStation(t);
    return this.label;
  }

  applyStation(t, initial = false) {
    const s = this.station;
    const tc = initial ? 0.3 : 0.06;
    const delay = initial ? 0 : 0.12; // the new station appears out of the tuning noise
    this.fmGate.gain.setTargetAtTime(s === 'fm' ? 1 : 0, t + delay, tc);
    this.amGate.gain.setTargetAtTime(s === 'am' ? 1 : 0, t + delay, tc);
    this.power.gain.setTargetAtTime(s === 'off' ? 0 : 1, t + (s === 'off' ? 0.18 : 0), 0.03);
    this.music.setActive(s === 'fm', t);
    this.am.setActive(s === 'am', t);
  }

  tuneBurst(t, dur) {
    const g = this.tuneGain.gain;
    const f = this.tuneBp.frequency;
    g.cancelScheduledValues(t);
    f.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.42, t + 0.015);
    g.setTargetAtTime(0, t + dur * 0.6, dur * 0.25);
    f.setValueAtTime(700, t);
    f.exponentialRampToValueAtTime(3800, t + dur);
  }

  /** Short electrical crackle through the speakers (dashboard glitch). */
  glitch(t, amount = 1) {
    const g = this.staticBurst.gain;
    const n = 4 + Math.floor(this.rng() * 5);
    let tt = t;
    for (let i = 0; i < n; i++) {
      const on = randRange(this.rng, 0.01, 0.05);
      g.setTargetAtTime(1 + 6 * amount * this.rng(), tt, 0.004);
      g.setTargetAtTime(1, tt + on, 0.01);
      tt += on + randRange(this.rng, 0.01, 0.06);
    }
    this.nextEvent = Math.max(this.nextEvent, tt + 0.05);
    const d = this.dropout.gain;
    d.setTargetAtTime(0.15, t, 0.01);
    d.setTargetAtTime(1, tt, 0.05);
  }

  /** Per-frame targets. */
  update(now, interference) {
    const x = clamp01(interference);
    this.interference = x;
    const am = this.station === 'am';
    const prog = am ? 0.9 - 0.75 * x : 1 - 0.9 * Math.pow(x, 1.3);
    glide(this.programme.gain, prog, now, 0.1);
    const stat = am ? 0.16 + 0.22 * x : 0.006 + 0.38 * x * x;
    glide(this.staticLevel.gain, stat, now, 0.12);
    glide(this.crackleLevel.gain, (am ? 0.5 : 0.18) + 0.9 * x, now, 0.15);
    glide(this.whistleLevel.gain, am ? 0.006 + 0.01 * x : 0.006 * x * x, now, 0.3);
    glide(this.wowDepth.gain, (am ? 0.0016 : 0.0002) + 0.0035 * x, now, 0.2);
    glide(this.flutterDepth.gain, (am ? 0.00006 : 0.00002) + 0.00012 * x, now, 0.2);
  }

  /** Lookahead scheduling: music notes and random interference events. */
  schedule(now, until) {
    this.music.schedule(now, until);
    this.am.schedule(now, until);
    if (this.station === 'off') {
      this.nextEvent = Math.max(this.nextEvent, until);
      return;
    }
    if (this.nextEvent < now) this.nextEvent = now + 0.02;
    let guard = 16;
    while (this.nextEvent < until && guard-- > 0) {
      const t = this.nextEvent;
      const x = this.interference + (this.station === 'am' ? 0.25 : 0);
      const rate = 0.1 + 5 * x * x;
      let len = 0.05;
      if (x > 0.04 && this.rng() < Math.min(0.95, x * 1.2)) {
        len = randRange(this.rng, 0.04, 0.12 + 0.35 * x);
        const depth = Math.max(0.03, 0.7 - 0.8 * x * this.rng());
        this.dropout.gain.setTargetAtTime(depth, t, 0.008);
        this.dropout.gain.setTargetAtTime(1, t + len, 0.03);
        this.staticBurst.gain.setTargetAtTime(1 + 3 * x * this.rng(), t, 0.006);
        this.staticBurst.gain.setTargetAtTime(1, t + len * 0.8, 0.04);
      }
      this.nextEvent = t + len + 0.06 + -Math.log(1 - this.rng() * 0.999) / rate;
    }
    // slow fading of the weak AM signal ("drifting in and out")
    if (this.nextFade < until) {
      const target = this.rng() < 0.35 ? randRange(this.rng, 0.03, 0.15) : randRange(this.rng, 0.3, 1);
      this.amFade.gain.setTargetAtTime(target, this.nextFade, randRange(this.rng, 0.6, 2.2));
      this.nextFade += randRange(this.rng, 1.5, 5);
    }
  }
}
