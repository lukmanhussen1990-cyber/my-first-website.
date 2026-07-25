/* Crossy Road — procedural sound. Every effect is synthesised with the
   WebAudio API, so the game ships with zero audio assets. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var store = CR.util.store;

  function Audio() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.muted = store.get('muted', false);
    this.ready = false;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  Audio.prototype.init = function () {
    if (this.ready) { this.resume(); return; }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);

      // One shared noise buffer for splashes/crashes.
      var len = Math.floor(this.ctx.sampleRate * 0.7);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.ready = true;
    } catch (e) { this.ready = false; }
  };

  Audio.prototype.resume = function () {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  };

  Audio.prototype.setMuted = function (m) {
    this.muted = m;
    store.set('muted', m);
    if (this.master) this.master.gain.value = m ? 0 : 0.6;
  };

  Audio.prototype.toggle = function () { this.setMuted(!this.muted); return this.muted; };

  /* ── Primitives ───────────────────────────────────────────── */

  /** A single enveloped oscillator note. */
  Audio.prototype.tone = function (opt) {
    if (!this.ready || this.muted) return;
    var ctx = this.ctx, t0 = ctx.currentTime + (opt.delay || 0);
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = opt.type || 'square';
    osc.frequency.setValueAtTime(opt.from, t0);
    if (opt.to && opt.to !== opt.from) {
      if (opt.exp !== false && opt.to > 0 && opt.from > 0) osc.frequency.exponentialRampToValueAtTime(opt.to, t0 + opt.dur);
      else osc.frequency.linearRampToValueAtTime(opt.to, t0 + opt.dur);
    }
    var vol = opt.vol == null ? 0.2 : opt.vol;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.012, opt.dur * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    osc.connect(gain);
    if (opt.detune) osc.detune.value = opt.detune;
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + opt.dur + 0.03);
  };

  /** Filtered noise burst. */
  Audio.prototype.burst = function (opt) {
    if (!this.ready || this.muted) return;
    var ctx = this.ctx, t0 = ctx.currentTime + (opt.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    var filt = ctx.createBiquadFilter();
    filt.type = opt.filter || 'lowpass';
    filt.frequency.setValueAtTime(opt.from || 1200, t0);
    filt.frequency.exponentialRampToValueAtTime(Math.max(60, opt.to || 300), t0 + opt.dur);
    filt.Q.value = opt.q || 1;
    var gain = ctx.createGain();
    var vol = opt.vol == null ? 0.22 : opt.vol;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opt.dur);
    src.connect(filt); filt.connect(gain); gain.connect(this.master);
    src.start(t0);
    src.stop(t0 + opt.dur + 0.02);
  };

  /* ── Game sounds ──────────────────────────────────────────── */

  Audio.prototype.hop = function () {
    this.tone({ type: 'triangle', from: 420, to: 760, dur: 0.09, vol: 0.16 });
    this.tone({ type: 'sine', from: 180, to: 120, dur: 0.07, vol: 0.1, delay: 0.07 });
  };

  Audio.prototype.blocked = function () {
    this.tone({ type: 'square', from: 150, to: 90, dur: 0.08, vol: 0.08 });
  };

  Audio.prototype.coin = function () {
    this.tone({ type: 'square', from: 988, to: 988, dur: 0.06, vol: 0.13 });
    this.tone({ type: 'square', from: 1319, to: 1319, dur: 0.13, vol: 0.13, delay: 0.055 });
  };

  Audio.prototype.splash = function () {
    this.burst({ from: 2600, to: 260, dur: 0.5, vol: 0.3 });
    this.tone({ type: 'sine', from: 300, to: 90, dur: 0.35, vol: 0.16 });
  };

  Audio.prototype.crash = function () {
    this.burst({ from: 1800, to: 120, dur: 0.4, vol: 0.34 });
    this.tone({ type: 'sawtooth', from: 160, to: 42, dur: 0.4, vol: 0.24 });
  };

  Audio.prototype.horn = function () {
    this.tone({ type: 'sawtooth', from: 233, to: 233, dur: 0.55, vol: 0.13 });
    this.tone({ type: 'sawtooth', from: 311, to: 311, dur: 0.55, vol: 0.11, detune: 8 });
  };

  Audio.prototype.trainPass = function () {
    this.burst({ from: 900, to: 400, dur: 0.9, vol: 0.2, filter: 'bandpass', q: 0.7 });
  };

  Audio.prototype.screech = function () {
    this.tone({ type: 'sawtooth', from: 1500, to: 620, dur: 0.5, vol: 0.14 });
    this.tone({ type: 'sawtooth', from: 1900, to: 900, dur: 0.4, vol: 0.09, delay: 0.12 });
  };

  Audio.prototype.gameOver = function () {
    var self = this, notes = [392, 330, 262];
    notes.forEach(function (n, i) {
      self.tone({ type: 'triangle', from: n, to: n, dur: 0.22, vol: 0.16, delay: 0.14 * i + 0.25 });
    });
  };

  Audio.prototype.unlock = function () {
    var self = this, notes = [523, 659, 784, 1047];
    notes.forEach(function (n, i) {
      self.tone({ type: 'square', from: n, to: n, dur: 0.15, vol: 0.14, delay: 0.08 * i });
    });
  };

  Audio.prototype.click = function () {
    this.tone({ type: 'square', from: 660, to: 880, dur: 0.06, vol: 0.1 });
  };

  CR.audio = new Audio();
})(window);
