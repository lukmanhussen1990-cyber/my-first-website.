/**
 * All sound is synthesised with the Web Audio API — no asset downloads, so the
 * game works offline and from a bare static host.
 */

import { clamp } from './math.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.crowdGain = null;
    this.enabled = true;
    this.volume = 0.7;
    this.excitement = 0.25;
    this.targetExcitement = 0.25;
    this.started = false;
  }

  /** Must be called from a user gesture for autoplay policies. */
  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? this.volume : 0;
    this.master.connect(this.ctx.destination);
    this.buildCrowd();
    this.started = true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) {
      this.master.gain.setTargetAtTime(on ? this.volume : 0, this.ctx.currentTime, 0.08);
    }
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master && this.enabled) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  noiseBuffer(seconds = 2) {
    const { ctx } = this;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Brown-ish noise reads as a distant crowd rather than static.
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buffer;
  }

  buildCrowd() {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(4);
    src.loop = true;

    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 620;
    band.Q.value = 0.5;

    const hiss = ctx.createBiquadFilter();
    hiss.type = 'highpass';
    hiss.frequency.value = 180;

    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.08;

    src.connect(band);
    band.connect(hiss);
    hiss.connect(this.crowdGain);
    this.crowdGain.connect(this.master);
    src.start();
    this.crowdFilter = band;
  }

  /** Nudge the crowd noise: 0 = quiet ground, 1 = pandemonium. */
  setExcitement(v) {
    this.targetExcitement = clamp(v, 0, 1);
  }

  update(dt) {
    if (!this.ctx) return;
    const rate = this.targetExcitement > this.excitement ? 4.5 : 0.55;
    this.excitement += (this.targetExcitement - this.excitement) * Math.min(1, rate * dt);
    if (this.crowdGain) {
      this.crowdGain.gain.setTargetAtTime(0.045 + this.excitement * 0.34, this.ctx.currentTime, 0.12);
    }
    if (this.crowdFilter) {
      this.crowdFilter.frequency.setTargetAtTime(520 + this.excitement * 700, this.ctx.currentTime, 0.2);
    }
  }

  env(node, { attack = 0.005, decay = 0.2, peak = 1, start = 0 }) {
    const t = this.ctx.currentTime + start;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone({ freq = 440, type = 'sine', duration = 0.2, peak = 0.3, sweep = null, start = 0 }) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    const t = this.ctx.currentTime + start;
    osc.frequency.setValueAtTime(freq, t);
    if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(sweep, 1), t + duration);
    this.env(gain, { attack: 0.006, decay: duration, peak, start });
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.08);
  }

  burst({ duration = 0.12, peak = 0.4, freq = 1200, type = 'bandpass', q = 1, start = 0 }) {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.4);
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = this.ctx.createGain();
    this.env(gain, { attack: 0.003, decay: duration, peak, start });
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    const t = this.ctx.currentTime + start;
    src.start(t);
    src.stop(t + duration + 0.1);
  }

  play(name, intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'kick':
        this.burst({ duration: 0.07, peak: 0.32 * intensity, freq: 900, q: 0.7 });
        this.tone({ freq: 150, type: 'triangle', duration: 0.09, peak: 0.28 * intensity, sweep: 60 });
        break;
      case 'shot':
        this.burst({ duration: 0.09, peak: 0.45 * intensity, freq: 1400, q: 0.6 });
        this.tone({ freq: 190, type: 'triangle', duration: 0.12, peak: 0.4 * intensity, sweep: 70 });
        break;
      case 'save':
        this.burst({ duration: 0.16, peak: 0.34, freq: 420, q: 0.8 });
        this.tone({ freq: 320, type: 'sine', duration: 0.16, peak: 0.16, sweep: 180 });
        break;
      case 'post':
        this.tone({ freq: 780, type: 'square', duration: 0.5, peak: 0.3, sweep: 380 });
        this.burst({ duration: 0.18, peak: 0.2, freq: 2400, q: 2 });
        break;
      case 'whistle':
        this.whistle(0.42);
        break;
      case 'whistleShort':
        this.whistle(0.2);
        break;
      case 'whistleLong':
        this.whistle(0.55);
        this.whistle(0.55, 0.65);
        this.whistle(0.9, 1.3);
        break;
      case 'goal':
        this.setExcitement(1);
        this.tone({ freq: 300, type: 'sawtooth', duration: 0.9, peak: 0.2, sweep: 600 });
        this.burst({ duration: 1.6, peak: 0.5, freq: 900, q: 0.3 });
        break;
      case 'switch':
        this.tone({ freq: 620, type: 'square', duration: 0.05, peak: 0.06 });
        break;
      case 'slide':
        this.burst({ duration: 0.28, peak: 0.22, freq: 300, q: 0.5 });
        break;
      case 'tackle':
        this.burst({ duration: 0.1, peak: 0.3, freq: 260, q: 0.7 });
        break;
      case 'ui':
        this.tone({ freq: 520, type: 'triangle', duration: 0.06, peak: 0.09 });
        break;
      case 'uiBig':
        this.tone({ freq: 340, type: 'triangle', duration: 0.1, peak: 0.12 });
        this.tone({ freq: 510, type: 'triangle', duration: 0.14, peak: 0.1, start: 0.06 });
        break;
      default:
        break;
    }
  }

  whistle(duration = 0.4, start = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const trill = this.ctx.createOscillator();
    const trillGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc2.type = 'sine';
    osc.frequency.setValueAtTime(2350, t);
    osc2.frequency.setValueAtTime(3100, t);
    trill.frequency.setValueAtTime(28, t);
    trillGain.gain.setValueAtTime(120, t);
    trill.connect(trillGain);
    trillGain.connect(osc.frequency);
    trillGain.connect(osc2.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    gain.gain.setValueAtTime(0.16, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc2.start(t);
    trill.start(t);
    osc.stop(t + duration + 0.05);
    osc2.stop(t + duration + 0.05);
    trill.stop(t + duration + 0.05);
  }
}
