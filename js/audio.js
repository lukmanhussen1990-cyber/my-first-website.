/* ══════════════════════════════════════════════════════════
   audio.js — 100% procedural audio. No asset files, no CDN.
   Synthesised SFX plus a step-sequenced synthwave loop whose
   tempo and layering rise with the run's intensity.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});

  const A = {
    ctx: null,
    master: null,
    sfxBus: null,
    musicBus: null,
    noise: null,
    ready: false,
    sfxOn: true,
    musicOn: true,
    intensity: 0,      // 0..1, drives tempo + layers
    _timer: null,
    _step: 0,
    _next: 0,
    _bpm: 124,
  };

  /* ── boot (must follow a user gesture) ─────────────────── */
  A.init = function () {
    if (A.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }

    const c = A.ctx;
    A.master = c.createGain();
    A.master.gain.value = 0.9;

    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 9;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    A.master.connect(comp);
    comp.connect(c.destination);

    A.sfxBus = c.createGain();
    A.sfxBus.gain.value = A.sfxOn ? 0.85 : 0;
    A.sfxBus.connect(A.master);

    A.musicBus = c.createGain();
    A.musicBus.gain.value = 0;
    A.musicBus.connect(A.master);

    // shared white-noise buffer
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;

    A.ready = true;
  };

  A.resume = function () {
    if (!A.ctx) A.init();
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
  };

  A.setSfx = function (on) {
    A.sfxOn = on;
    if (A.sfxBus) A.sfxBus.gain.value = on ? 0.85 : 0;
  };

  A.setMusic = function (on) {
    A.musicOn = on;
    if (!A.musicBus) return;
    const t = A.ctx.currentTime;
    A.musicBus.gain.cancelScheduledValues(t);
    A.musicBus.gain.setTargetAtTime(on ? 0.34 : 0, t, 0.25);
  };

  /* ── low level voices ──────────────────────────────────── */

  function env(gain, t, a, d, peak) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  function tone(bus, opts) {
    const c = A.ctx, t = opts.t || c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(opts.f, t);
    if (opts.f2 != null) {
      if (opts.f2 > 0 && opts.f > 0) o.frequency.exponentialRampToValueAtTime(opts.f2, t + (opts.slide || opts.d));
      else o.frequency.linearRampToValueAtTime(opts.f2, t + (opts.slide || opts.d));
    }
    let node = o;
    if (opts.filter) {
      const bq = c.createBiquadFilter();
      bq.type = opts.filter;
      bq.frequency.setValueAtTime(opts.cut || 1800, t);
      if (opts.cut2) bq.frequency.exponentialRampToValueAtTime(opts.cut2, t + opts.d);
      bq.Q.value = opts.q || 1;
      node.connect(bq);
      node = bq;
    }
    env(g, t, opts.a || 0.004, opts.d, opts.v == null ? 0.3 : opts.v);
    node.connect(g);
    g.connect(bus || A.sfxBus);
    o.start(t);
    o.stop(t + (opts.a || 0.004) + opts.d + 0.05);
    return o;
  }

  function noiseHit(opts) {
    const c = A.ctx, t = opts.t || c.currentTime;
    const s = c.createBufferSource();
    s.buffer = A.noise;
    s.playbackRate.value = opts.rate || 1;
    const bq = c.createBiquadFilter();
    bq.type = opts.filter || 'bandpass';
    bq.frequency.setValueAtTime(opts.f, t);
    if (opts.f2) bq.frequency.exponentialRampToValueAtTime(opts.f2, t + opts.d);
    bq.Q.value = opts.q || 1.2;
    const g = c.createGain();
    env(g, t, opts.a || 0.005, opts.d, opts.v == null ? 0.24 : opts.v);
    s.connect(bq); bq.connect(g); g.connect(opts.bus || A.sfxBus);
    s.start(t);
    s.stop(t + opts.d + 0.1);
  }

  /* ── SFX library ───────────────────────────────────────── */

  const SFX = {
    coin(n) {
      const step = Math.min(n || 0, 14);
      const f = 880 * Math.pow(1.0595, step);
      tone(null, { f: f, f2: f * 1.5, type: 'square', d: 0.075, v: 0.13, slide: 0.05 });
      tone(null, { f: f * 2, type: 'triangle', d: 0.12, v: 0.07, a: 0.002 });
    },
    jump() {
      tone(null, { f: 240, f2: 620, type: 'triangle', d: 0.17, v: 0.2, slide: 0.14 });
      noiseHit({ f: 900, f2: 2600, d: 0.13, v: 0.07 });
    },
    land() {
      tone(null, { f: 150, f2: 70, type: 'sine', d: 0.11, v: 0.22 });
      noiseHit({ f: 420, d: 0.08, v: 0.09, filter: 'lowpass' });
    },
    roll() {
      noiseHit({ f: 380, f2: 1400, d: 0.22, v: 0.13, q: 0.8 });
    },
    lane() {
      noiseHit({ f: 1700, f2: 500, d: 0.09, v: 0.06, q: 2 });
    },
    crash() {
      tone(null, { f: 180, f2: 38, type: 'sawtooth', d: 0.6, v: 0.32, filter: 'lowpass', cut: 2200, cut2: 200 });
      noiseHit({ f: 1400, f2: 120, d: 0.55, v: 0.3, q: 0.5 });
      tone(null, { f: 90, f2: 40, type: 'square', d: 0.45, v: 0.18 });
    },
    power() {
      const base = 523.25;
      [0, 4, 7, 12, 16].forEach((s, i) => {
        tone(null, {
          f: base * Math.pow(2, s / 12), type: 'square',
          d: 0.2, v: 0.11, t: A.ctx.currentTime + i * 0.055,
        });
      });
    },
    board() {
      tone(null, { f: 120, f2: 480, type: 'sawtooth', d: 0.4, v: 0.16, filter: 'lowpass', cut: 400, cut2: 3200 });
    },
    mission() {
      [659.25, 830.6, 987.77, 1318.5].forEach((f, i) =>
        tone(null, { f: f, type: 'triangle', d: 0.3, v: 0.14, t: A.ctx.currentTime + i * 0.09 }));
    },
    buy() {
      tone(null, { f: 660, f2: 990, type: 'square', d: 0.14, v: 0.14 });
      tone(null, { f: 1320, type: 'sine', d: 0.2, v: 0.08, t: A.ctx.currentTime + 0.08 });
    },
    deny() {
      tone(null, { f: 200, f2: 120, type: 'square', d: 0.16, v: 0.14 });
    },
    ui() {
      tone(null, { f: 520, type: 'triangle', d: 0.06, v: 0.09 });
    },
    warn() {
      tone(null, { f: 440, f2: 300, type: 'sawtooth', d: 0.3, v: 0.11, filter: 'lowpass', cut: 900 });
    },
    nearmiss(n) {
      const f = 520 + Math.min(n, 12) * 55;
      tone(null, { f: f, f2: f * 1.35, type: 'sine', d: 0.13, v: 0.1 });
      noiseHit({ f: 2600, f2: 700, d: 0.16, v: 0.07, q: 0.7 });
    },
    revive() {
      tone(null, { f: 130, f2: 900, type: 'sawtooth', d: 0.85, v: 0.2, filter: 'lowpass', cut: 300, cut2: 5000 });
    },
    slow() {
      tone(null, { f: 700, f2: 180, type: 'sine', d: 0.7, v: 0.16 });
    },
  };

  A.play = function (name, arg) {
    if (!A.ready || !A.sfxOn) return;
    const fn = SFX[name];
    if (!fn) return;
    try { fn(arg); } catch (e) { /* audio graph hiccup — never break the frame */ }
  };

  /* ── music: 16-step sequencer, lookahead scheduling ────── */

  const ROOT = 55; // A1
  const SCALE = [0, 3, 5, 7, 10]; // minor pentatonic
  const BASS = [0, 0, 3, 0, 5, 0, 3, -2];
  const ARP = [12, 19, 24, 19, 22, 19, 24, 27];

  function note(semi) { return ROOT * Math.pow(2, semi / 12); }

  function scheduleStep(step, t) {
    const c = A.ctx;
    const bar = (step / 16) | 0;
    const s = step % 16;
    const inten = A.intensity;

    // kick — four on the floor
    if (s % 4 === 0) {
      tone(A.musicBus, { f: 130, f2: 42, type: 'sine', d: 0.2, v: 0.55, t: t, slide: 0.09 });
      noiseHit({ f: 120, d: 0.05, v: 0.14, t: t, filter: 'lowpass', bus: A.musicBus });
    }
    // hats
    if (s % 2 === 1 || (inten > 0.45 && s % 1 === 0)) {
      noiseHit({ f: 8200, d: 0.032, v: s % 4 === 3 ? 0.075 : 0.04, t: t, q: 1.6, bus: A.musicBus });
    }
    // snare/clap
    if (s === 4 || s === 12) {
      noiseHit({ f: 1900, f2: 700, d: 0.15, v: 0.16, t: t, q: 0.7, bus: A.musicBus });
    }
    // bass
    if (s % 2 === 0) {
      const semi = BASS[(s / 2) % BASS.length] + (bar % 4 === 3 ? 5 : 0);
      tone(A.musicBus, {
        f: note(12 + semi), type: 'sawtooth', d: 0.19, v: 0.2, t: t,
        filter: 'lowpass', cut: 260 + inten * 900, q: 6,
      });
    }
    // arp (kicks in with intensity)
    if (inten > 0.22 && s % 2 === 1) {
      const semi = ARP[((step / 2) | 0) % ARP.length] + (bar % 4 === 3 ? 5 : 0);
      tone(A.musicBus, {
        f: note(24 + semi), type: 'square', d: 0.13, v: 0.055 + inten * 0.05, t: t,
        filter: 'lowpass', cut: 1400 + inten * 3400, q: 3,
      });
    }
    // pad stabs on the downbeat of every other bar
    if (inten > 0.5 && s === 0 && bar % 2 === 0) {
      SCALE.slice(0, 3).forEach((iv) =>
        tone(A.musicBus, {
          f: note(24 + iv), type: 'triangle', d: 0.9, v: 0.05, a: 0.15, t: t,
        }));
    }
  }

  function pump() {
    if (!A.ctx) return;
    const now = A.ctx.currentTime;
    const spb = 60 / A._bpm / 4; // 16th note
    while (A._next < now + 0.16) {
      if (A._next < now) A._next = now + 0.02;
      scheduleStep(A._step, A._next);
      A._step = (A._step + 1) % 64;
      A._next += spb;
    }
  }

  A.startMusic = function () {
    if (!A.ready) return;
    if (A._timer) return;
    A._step = 0;
    A._next = A.ctx.currentTime + 0.08;
    A._timer = setInterval(pump, 25);
    A.setMusic(A.musicOn);
  };

  A.stopMusic = function () {
    if (A._timer) { clearInterval(A._timer); A._timer = null; }
    if (A.musicBus && A.ctx) {
      A.musicBus.gain.setTargetAtTime(0, A.ctx.currentTime, 0.15);
    }
  };

  /** intensity 0..1 — raises tempo and unlocks layers. */
  A.setIntensity = function (v) {
    A.intensity = Math.max(0, Math.min(1, v));
    A._bpm = 118 + A.intensity * 34;
  };

  /** Duck the music (used for slow-mo / death). */
  A.duck = function (amount, seconds) {
    if (!A.ready || !A.musicOn) return;
    const t = A.ctx.currentTime;
    const g = A.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.34 * (1 - amount), t, 0.05);
    g.setTargetAtTime(0.34, t + seconds, 0.3);
  };

  SS.Audio = A;
})();
