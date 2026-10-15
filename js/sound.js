/*
 * imran — sound design.
 *
 * No samples: every sound is synthesised with the Web Audio API and placed
 * on the same timeline the picture uses (ImranScene), panned to where the
 * thing that makes it is on screen. Key: A major, with a turn to F minor for
 * the pixel section.
 *
 *   ImranSound.play(ctx, destination, when) -> { stop() }
 *   ImranSound.render(sampleRate)            -> Promise<AudioBuffer>
 */
(function (global) {
  'use strict';

  var S = global.ImranScene;

  // ------------------------------------------------------------- utilities

  function rng(seed) {                  // mulberry32
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function hz(note) {                   // 'A4', 'C#5', 'Bb3' -> Hz
    var m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
    var n = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (n + (+m[3] + 1) * 12 - 69) / 12);
  }

  function panFor(x) { return Math.max(-0.85, Math.min(0.85, (x - S.CX) / 1100)); }

  // --------------------------------------------------------------- engine

  function Engine(ctx, destination, t0) {
    this.ctx = ctx;
    this.t0 = t0;
    this.rand = rng(7);
    this.nodes = [];

    var master = ctx.createGain();
    master.gain.value = 0.9;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 28;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.5;
    comp.attack.value = 0.004; comp.release.value = 0.18;
    var limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20;
    limit.attack.value = 0.001; limit.release.value = 0.06;
    this.bus = ctx.createGain();
    this.bus.connect(hp); hp.connect(comp); comp.connect(limit); limit.connect(master);
    master.connect(destination);
    this.master = master;

    // reverb send
    this.verb = ctx.createConvolver();
    this.verb.buffer = Engine.impulse(ctx);
    this.verbIn = ctx.createGain();
    this.verbIn.gain.value = 0.32;
    this.verbIn.connect(this.verb);
    this.verb.connect(hp);

    this.noise = Engine.noise(ctx);
  }

  Engine.noise = function (ctx) {
    if (ctx.__imranNoise) return ctx.__imranNoise;
    var len = ctx.sampleRate * 2, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0), r = rng(99);
    for (var i = 0; i < len; i++) d[i] = r() * 2 - 1;
    ctx.__imranNoise = b;
    return b;
  };

  Engine.impulse = function (ctx) {
    if (ctx.__imranVerb) return ctx.__imranVerb;
    var sr = ctx.sampleRate, len = Math.floor(sr * 2.2), pre = Math.floor(sr * 0.012);
    var b = ctx.createBuffer(2, len, sr), r = rng(3);
    for (var c = 0; c < 2; c++) {
      var d = b.getChannelData(c), lp = 0;
      for (var i = pre; i < len; i++) {
        var k = (i - pre) / sr;
        lp += (r() * 2 - 1 - lp) * (0.55 - 0.4 * Math.min(1, k / 1.6));   // darker as it decays
        d[i] = lp * Math.exp(-k * 3.1);
      }
    }
    ctx.__imranVerb = b;
    return b;
  };

  // output stage for one voice: gain envelope -> pan -> bus (+ reverb)
  Engine.prototype.out = function (t, pan, wet) {
    var ctx = this.ctx;
    var g = ctx.createGain();
    g.gain.value = 0;
    var p = ctx.createStereoPanner();
    p.pan.value = pan || 0;
    g.connect(p);
    p.connect(this.bus);
    g.__pan = p;
    if (wet) {
      var w = ctx.createGain();
      w.gain.value = wet;
      p.connect(w); w.connect(this.verbIn);
    }
    this.nodes.push(g, p);
    return g;
  };

  Engine.prototype.at = function (t) { return this.t0 + t; };

  // percussive envelope
  function adsr(param, t, a, peak, d, floor) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(floor || 0, t + a, d / 4);
  }

  // tonal voice: oscillators through a filter
  Engine.prototype.tone = function (time, o) {
    var ctx = this.ctx, t = this.at(time);
    var dur = o.dur || 0.3;
    var g = this.out(t, o.pan, o.wet === undefined ? 0.25 : o.wet);
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.value = o.cutoff || 4000;
    f.Q.value = o.q || 0.7;
    if (o.cutoffTo) f.frequency.setTargetAtTime(o.cutoffTo, t, (o.cutoffTime || dur) / 3);
    f.connect(g);
    var types = o.types || ['sine'];
    for (var i = 0; i < types.length; i++) {
      var osc = ctx.createOscillator();
      osc.type = types[i];
      var mult = o.ratios ? o.ratios[i] : 1;
      osc.frequency.setValueAtTime(o.freq * mult, t);
      if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(o.freqTo * mult, t + (o.glide || dur));
      if (o.detune) osc.detune.value = (i % 2 ? 1 : -1) * o.detune;
      var og = ctx.createGain();
      og.gain.value = o.mix ? o.mix[i] : 1 / types.length;
      osc.connect(og); og.connect(f);
      osc.start(t); osc.stop(t + dur + 0.5);
      this.nodes.push(osc, og);
    }
    this.nodes.push(f);
    if (o.sustain) {               // pad style: attack, hold, release
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.gain, t + (o.attack || 0.05));
      g.gain.setValueAtTime(o.gain, t + Math.max(o.attack || 0.05, dur - (o.release || 0.3)));
      g.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      adsr(g.gain, t, o.attack || 0.004, o.gain, o.decay || dur);
    }
    return g;
  };

  // filtered noise burst / sweep
  Engine.prototype.noiseHit = function (time, o) {
    var ctx = this.ctx, t = this.at(time);
    var dur = o.dur || 0.05;
    var src = ctx.createBufferSource();
    src.buffer = this.noise;
    var f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 2000, t);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t + dur);
    f.Q.value = o.q || 1;
    var g = this.out(t, o.pan, o.wet || 0);
    src.connect(f); f.connect(g);
    if (o.swell) {
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.gain, t + dur * o.swell);
      g.gain.linearRampToValueAtTime(0, t + dur);
    } else {
      adsr(g.gain, t, o.attack || 0.001, o.gain, dur);
    }
    if (o.panTo !== undefined) {
      g.__pan.pan.setValueAtTime(o.pan || 0, t);
      g.__pan.pan.linearRampToValueAtTime(o.panTo, t + dur);
    }
    src.start(t, this.rand() * 1.5);
    src.stop(t + dur + 0.3);
    this.nodes.push(src, f);
    return g;
  };

  // ------------------------------------------------------------ instruments

  // wooden click, like a chess piece set down on a board
  Engine.prototype.clack = function (time, pitch, pan, level) {
    level = level === undefined ? 1 : level;
    this.noiseHit(time, { freq: pitch * 2.2, q: 3.5, dur: 0.035, gain: 0.55 * level, pan: pan, wet: 0.12 });
    this.tone(time, { freq: pitch, freqTo: pitch * 0.92, glide: 0.04, dur: 0.09, gain: 0.5 * level, types: ['sine', 'triangle'], mix: [0.7, 0.3], pan: pan, wet: 0.15, cutoff: 3500 });
  };

  // soft low impact
  Engine.prototype.thump = function (time, level, from, to) {
    this.tone(time, { freq: from || 140, freqTo: to || 48, glide: 0.09, dur: 0.28, gain: 0.85 * (level || 1), types: ['sine'], wet: 0.05, cutoff: 900 });
  };

  // plucked note
  Engine.prototype.pluck = function (time, note, pan, level, bright) {
    var f = typeof note === 'number' ? note : hz(note);
    this.tone(time, { freq: f, dur: 0.45, decay: 0.32, gain: 0.32 * (level || 1), types: ['triangle', 'sine', 'sine'], ratios: [1, 2, 3], mix: [0.6, 0.3, 0.1], cutoff: bright ? 6000 : 3200, cutoffTo: 900, cutoffTime: 0.3, pan: pan, wet: 0.35 });
  };

  // short bright bleep
  Engine.prototype.bleep = function (time, note, pan, level) {
    var f = typeof note === 'number' ? note : hz(note);
    this.tone(time, { freq: f, dur: 0.14, decay: 0.1, gain: 0.26 * (level || 1), types: ['sine', 'triangle'], mix: [0.7, 0.3], cutoff: 7000, pan: pan, wet: 0.3 });
  };

  // 8-bit square blip
  Engine.prototype.chip = function (time, note, pan, level, dur) {
    var f = typeof note === 'number' ? note : hz(note);
    this.tone(time, { freq: f, dur: dur || 0.05, decay: dur || 0.05, gain: 0.12 * (level || 1), types: ['square'], cutoff: 3600, pan: pan, wet: 0.12 });
  };

  // sustained chord
  Engine.prototype.pad = function (time, notes, dur, level, cutoff) {
    for (var i = 0; i < notes.length; i++) {
      this.tone(time, { freq: hz(notes[i]), dur: dur, sustain: true, attack: 0.06, release: dur * 0.85, gain: (level || 0.05), types: ['sawtooth', 'sawtooth', 'sine'], detune: 7, mix: [0.35, 0.35, 0.6], cutoff: cutoff || 1200, cutoffTo: 500, cutoffTime: dur, pan: (i % 2 ? 0.25 : -0.25), wet: 0.4 });
    }
  };

  // airy whoosh following a speed envelope (array of 0..1 values over the span)
  Engine.prototype.whoosh = function (time, dur, speed, o) {
    var ctx = this.ctx, t = this.at(time);
    var src = ctx.createBufferSource();
    src.buffer = this.noise; src.loop = true;
    var f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = o.q || 1.4;
    var g = this.out(t, 0, o.wet || 0.2);
    var n = speed.length, fc = new Float32Array(n), gc = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      fc[i] = o.lo + (o.hi - o.lo) * speed[i];
      gc[i] = o.gain * speed[i] * speed[i];
    }
    f.frequency.setValueCurveAtTime(fc, t, dur);
    g.gain.setValueCurveAtTime(gc, t, dur);
    if (o.pan) g.__pan.pan.setValueCurveAtTime(o.pan, t, dur);
    src.connect(f); f.connect(g);
    src.start(t); src.stop(t + dur + 0.05);
    this.nodes.push(src, f);
  };

  // ------------------------------------------------------------ the score

  Engine.prototype.score = function () {
    var T = S.T, self = this;

    // ---- 0.00  the king card pops up
    this.tone(0.0, { freq: 260, freqTo: 780, glide: 0.08, dur: 0.18, decay: 0.12, gain: 0.34, types: ['sine', 'triangle'], mix: [0.8, 0.2], cutoff: 5000, wet: 0.25 });
    this.thump(0.01, 0.55, 160, 60);
    this.noiseHit(0.0, { freq: 3500, q: 0.8, dur: 0.03, gain: 0.12 });

    // ---- 0.08 - 1.30  the hand of chess cards spins round
    // every card flicks as it passes each 45 degrees; faster spin = louder
    var deck = S.DECK, stagger = 1 / 15;
    var notes = ['A4', 'B4', 'C#5', 'E5', 'F#5', 'A5'];          // bottom -> top
    for (var i = 0; i < deck.length; i++) {
      var delay = (deck.length - 1 - i) * stagger;
      var prev = S.deckSpin(0);
      var next = 22.5;
      for (var ms = 60; ms < 1400; ms += 2) {
        var tt = ms / 1000;
        var a = S.deckSpin(tt - delay);
        if (a >= next) {
          var speed = (a - prev) / 0.002;                 // deg/s
          var lvl = Math.min(1, speed / 1300);
          if (lvl > 0.08) {
            var pan = Math.sin(a * Math.PI / 180) * 0.55;
            this.noiseHit(tt, { freq: 3200 + 300 * i, q: 1.6, dur: 0.018, gain: 0.16 * lvl * (i === 5 ? 1.3 : 1), pan: pan });
            this.noiseHit(tt + 0.004, { freq: 900, q: 2.5, dur: 0.02, gain: 0.06 * lvl, pan: pan });
          }
          next += 45;
        }
        prev = a;
      }
      // each card sings as it starts to move: a rising arpeggio
      this.pluck(0.09 + delay, notes[i], (i - 2.5) * 0.12, 0.85, true);
    }
    // the air the spin pushes around
    (function () {
      var n = 140, sp = [], pans = [];
      for (var k = 0; k < n; k++) {
        var tt = 0.1 + 1.3 * k / (n - 1);
        var v = (S.deckSpin(tt + 0.01) - S.deckSpin(tt - 0.01)) / 0.02;
        sp.push(Math.min(1, v / 1400));
        pans.push(Math.sin(S.deckSpin(tt) * Math.PI / 180) * 0.6);
      }
      self.whoosh(0.1, 1.3, sp, { lo: 500, hi: 3200, gain: 0.22, q: 1.1, pan: new Float32Array(pans), wet: 0.25 });
    })();
    // bass swells under the spin
    this.tone(0.45, { freq: hz('A2'), dur: 0.85, sustain: true, attack: 0.18, release: 0.45, gain: 0.2, types: ['sine', 'triangle'], mix: [0.8, 0.25], cutoff: 500, wet: 0.1 });
    this.tone(0.45, { freq: hz('E3'), dur: 0.75, sustain: true, attack: 0.22, release: 0.4, gain: 0.05, types: ['triangle'], cutoff: 700, wet: 0.2 });
    // the king hops off, the card lands with a bounce
    this.tone(1.17, { freq: hz('E6'), freqTo: hz('A5'), glide: 0.09, dur: 0.12, gain: 0.16, types: ['sine'], pan: 0, wet: 0.35 });
    this.thump(1.30, 0.75, 150, 52);
    this.clack(1.30, 620, 0, 0.75);
    this.clack(1.34, 700, 0, 0.3);

    // ---- 1.35 - 1.75  stretch into the name blocks
    this.tone(1.345, { freq: 190, freqTo: 560, glide: 0.11, dur: 0.16, decay: 0.12, gain: 0.2, types: ['triangle', 'sawtooth'], mix: [0.7, 0.3], cutoff: 1400, cutoffTo: 3200, cutoffTime: 0.1, wet: 0.15 });
    this.noiseHit(1.345, { freq: 700, freqTo: 3000, q: 1.2, dur: 0.12, gain: 0.14, swell: 0.7 });
    var splitNotes = { i: 'A3', m: 'C#4', r: 'E4', a: 'A4', n: 'C#5' };
    S.LETTERS.forEach(function (ch, k) {
      var b = S.BLOCKS[ch];
      var tt = 1.405 + Math.abs(k - 2) * 0.018;
      self.clack(tt, hz(splitNotes[ch]) * 1.5, panFor(b.cx), 0.7);
    });
    this.thump(1.40, 0.6, 120, 50);
    // the i's dot pops up
    this.tone(T.dotStart + 0.02, { freq: hz('E5'), freqTo: hz('E6'), glide: 0.07, dur: 0.16, decay: 0.12, gain: 0.24, types: ['sine', 'triangle'], mix: [0.8, 0.2], pan: panFor(S.BLOCKS.i.cx), wet: 0.35 });
    this.bleep(T.dotEnd - 0.08, 'A6', panFor(S.BLOCKS.i.cx), 0.35);
    // and the room hums while the blocks wait
    this.pad(1.42, ['A2', 'E3', 'A3', 'C#4'], 1.8, 0.035, 900);

    // ---- 3.17 - 3.70  letters reveal one by one
    var flashNotes = { m: 'E5', r: 'F#5', a: 'A5', n: 'B5', i: 'C#6' };
    var landNotes = { m: 'E4', r: 'F#4', a: 'A4', n: 'B4', i: 'C#5' };
    T.reveal.forEach(function (rv) {
      var pan = panFor(S.BLOCKS[rv.ch].cx);
      self.bleep(rv.t, flashNotes[rv.ch], pan, 0.9);
      self.pluck(rv.t + T.settle, landNotes[rv.ch], pan, 0.8);
      self.noiseHit(rv.t + T.settle, { freq: 5000, q: 1, dur: 0.012, gain: 0.09, pan: pan });
    });
    // the name is complete: warm chord + sub
    var full = T.reveal[T.reveal.length - 1].t + T.settle;
    this.pad(full, ['A2', 'E3', 'A3', 'B3', 'C#4', 'E4'], 2.1, 0.05, 2200);
    this.tone(full, { freq: hz('A1'), dur: 0.7, decay: 0.55, gain: 0.45, types: ['sine'], cutoff: 300, wet: 0 });
    this.bleep(full + 0.03, 'A6', 0.2, 0.3);
    this.bleep(full + 0.11, 'E7', -0.2, 0.18);

    // ---- 5.70 - 6.41  pixel breakdown (F minor, 8-bit)
    var p0 = T.pixel[0].t;
    this.noiseHit(p0, { filter: 'highpass', freq: 2500, q: 0.5, dur: 0.12, gain: 0.16 });
    this.chip(p0, 'F3', 0, 1.6, 0.12);
    this.pad(p0, ['F2', 'C3', 'F3', 'Ab3'], 2.0, 0.04, 900);
    this.tone(p0, { freq: hz('F1'), dur: 0.6, decay: 0.5, gain: 0.35, types: ['sine'], cutoff: 200, wet: 0 });
    var arps = [['F5', 'Ab5', 'C6', 'F6'], ['C5', 'F5', 'Ab5', 'C6'], ['Ab4', 'C5', 'Eb5', 'Ab5'], ['Eb5', 'G5', 'C6', 'Eb6'], ['F5', 'C6', 'Ab5', 'F6']];
    var r = rng(11);
    T.pixel.forEach(function (px, k) {
      var pan = panFor(S.BLOCKS[px.ch].cx);
      arps[k].forEach(function (n, j) { self.chip(px.t + j * 0.028, n, pan, 0.9); });
      // cells flickering on
      for (var tt = px.t + 0.06; tt < px.solid - 0.03; tt += 1 / 30) {
        if (r() < 0.65) self.chip(tt, 1400 + r() * 1800, pan + (r() - 0.5) * 0.15, 0.22, 0.012);
      }
      // grid snaps solid
      self.chip(px.solid, 'F2', pan, 1.2, 0.09);
      self.clack(px.solid, 420, pan, 0.45);
      // and back to blue
      self.bleep(px.blue, ['C6', 'Ab5', 'F5', 'Eb5', 'C5'][k], pan, 0.45);
    });

    // ---- 7.88 - 8.22  the dot drops in, blocks square up
    var di = panFor(S.BLOCKS.i.cx);
    this.tone(7.98, { freq: hz('E6'), freqTo: hz('A4'), glide: 0.11, dur: 0.14, decay: 0.12, gain: 0.2, types: ['sine'], pan: di, wet: 0.3 });
    this.clack(T.dotDropEnd, 760, di, 0.55);
    this.tone(T.squareStart, { freq: 220, dur: 0.28, decay: 0.25, gain: 0.1, types: ['triangle'], cutoff: 1200, wet: 0.2 });
    this.tone(T.squareStart + 0.03, { freq: 330, dur: 0.24, decay: 0.2, gain: 0.06, types: ['triangle'], cutoff: 1500, wet: 0.2 });

    // ---- 8.24 - 8.96  shuffle
    var sh = S.SHUFFLE;
    this.bleep(8.240, 'B5', panFor(S.slotX(0) + S.XH / 2), 0.6);
    this.bleep(8.275, 'C#6', panFor(S.slotX(1) + S.XH / 2), 0.6);
    var shNotes = ['A4', 'C#5', 'E5', 'F#5', 'B4', 'E5', 'A5'];
    sh.events.forEach(function (ev, k) {
      var xa = S.slotX(ev.from) + S.XH / 2, xb = S.slotX(ev.to) + S.XH / 2;
      var dur = ev.t1 - ev.t0;
      self.noiseHit(ev.t0, { freq: 1300, freqTo: 2600, q: 1.3, dur: dur, gain: 0.13, swell: 0.6, pan: panFor(xa), panTo: panFor(xb) });
      self.noiseHit(ev.t0, { freq: 1500, freqTo: 2400, q: 1.3, dur: dur, gain: 0.1, swell: 0.6, pan: panFor(xb), panTo: panFor(xa) });
      self.clack(ev.t1, 900 + 120 * (k % 4), panFor(xb), 0.55);
      self.clack(ev.t1 + 0.012, 780 + 90 * (k % 3), panFor(xa), 0.4);
      self.bleep(ev.t0 + 0.01, shNotes[k], panFor(xa), 0.32);
    });
    [8.30, 8.44, 8.59, 8.73].forEach(function (tt) {
      self.tone(tt, { freq: hz('A2'), dur: 0.2, decay: 0.16, gain: 0.26, types: ['triangle', 'sine'], mix: [0.5, 0.6], cutoff: 600, wet: 0.05 });
    });
    sh.blueAt.forEach(function (b, k) {
      self.noiseHit(b.t, { freq: 6000, q: 1.5, dur: 0.01, gain: 0.05, pan: panFor(S.slotX(b.slot) + S.XH / 2) });
    });

    // ---- 9.00 - 9.31  merge into one square
    this.tone(9.03, { freq: hz('E5'), freqTo: hz('A2'), glide: 0.26, dur: 0.3, sustain: true, attack: 0.08, release: 0.08, gain: 0.09, types: ['sawtooth', 'triangle'], mix: [0.4, 0.6], cutoff: 1800, cutoffTo: 400, cutoffTime: 0.28, wet: 0.15 });
    [[9.13, -0.5, 0.5], [9.18, 0.5, 0.6], [9.225, -0.25, 0.7], [9.262, 0.25, 0.8]].forEach(function (c) {
      self.clack(c[0], 520 + c[0] * 0, c[1], c[2]);
    });
    this.thump(9.30, 1.0, 130, 42);
    this.clack(9.30, 560, 0, 0.9);
    this.noiseHit(9.30, { filter: 'lowpass', freq: 1200, q: 0.5, dur: 0.18, gain: 0.18 });
    // the king is back: bell
    this.tone(9.34, { freq: hz('A5'), dur: 1.1, decay: 0.9, gain: 0.16, types: ['sine', 'sine', 'sine'], ratios: [1, 2.76, 5.4], mix: [0.7, 0.2, 0.08], cutoff: 9000, wet: 0.55 });

    // ---- 9.34 - 10.31  vortex
    (function () {
      var n = 120, sp = [], pans = [];
      for (var k = 0; k < n; k++) {
        var tt = 9.34 + 0.97 * k / (n - 1);
        var v = (S.vortexSize(tt - 0.17) < 1 ? 1 : 0.3) * Math.min(1, ((tt - 9.34) / 0.75));
        sp.push(Math.min(1, Math.max(0, v * (tt < 10.28 ? 1 : 0))));
        pans.push(Math.sin(k * 0.55) * 0.6);
      }
      self.whoosh(9.34, 0.97, sp, { lo: 300, hi: 2600, gain: 0.2, q: 2.2, pan: new Float32Array(pans), wet: 0.3 });
    })();
    this.pad(9.40, ['A2', 'E3', 'A3', 'C#4', 'E4'], 0.95, 0.045, 1600);
    var vNotes = ['A4', 'C#5', 'E5', 'A5', 'C#6'];
    S.VORTEX.forEach(function (L, k) {
      // each card spirals away: rising zip as it disappears into the centre
      var gone = 9.977 + L.delay;
      self.tone(gone - 0.13, { freq: hz(vNotes[k]), freqTo: hz(vNotes[k]) * 2, glide: 0.13, dur: 0.16, decay: 0.12, gain: 0.18, types: ['sine', 'triangle'], mix: [0.8, 0.2], pan: (k % 2 ? 0.3 : -0.3), wet: 0.35 });
      self.noiseHit(gone - 0.1, { freq: 2000, freqTo: 6000, q: 2, dur: 0.1, gain: 0.05, swell: 0.8 });
    });
    // the last dot: a bright final ping that rings out
    this.tone(10.30, { freq: hz('A6'), dur: 0.9, decay: 0.7, gain: 0.2, types: ['sine', 'sine'], ratios: [1, 1.5], mix: [0.8, 0.2], cutoff: 9000, wet: 0.7 });
    this.tone(10.30, { freq: hz('A2'), dur: 0.5, decay: 0.4, gain: 0.18, types: ['sine'], cutoff: 400, wet: 0.2 });
  };

  Engine.prototype.stop = function (fade) {
    var t = this.ctx.currentTime;
    var g = this.master.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + (fade || 0.08));
    var nodes = this.nodes, master = this.master;
    setTimeout(function () {
      nodes.forEach(function (n) { try { if (n.stop) n.stop(); } catch (e) { /* already stopped */ } });
      try { master.disconnect(); } catch (e) { /* gone */ }
    }, ((fade || 0.08) + 0.05) * 1000);
  };

  // --------------------------------------------------------------- public

  global.ImranSound = {
    play: function (ctx, destination, when) {
      var e = new Engine(ctx, destination || ctx.destination, when === undefined ? ctx.currentTime + 0.05 : when);
      e.score();
      return { stop: function (fade) { e.stop(fade); }, start: e.t0 };
    },
    render: function (sampleRate) {
      sampleRate = sampleRate || 48000;
      var len = Math.ceil(S.DURATION * sampleRate);
      var ctx = new OfflineAudioContext(2, len, sampleRate);
      var e = new Engine(ctx, ctx.destination, 0);
      e.score();
      return ctx.startRendering();
    }
  };
})(window);
