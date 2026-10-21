// Sound effects: every sound is synthesized with WebAudio, plus a Sound on / Sound off button in the HUD.
(function () {
  'use strict';

  window.Photosynthesis = window.Photosynthesis || {};

  // Player-facing strings.
  var copy = {
    soundOn: 'Sound on',
    soundOff: 'Sound off'
  };

  var MASTER_GAIN = 0.15;   // keeps the whole mix quiet
  var THROTTLE_MS = 60;     // minimum gap between two plays of the same sound
  var MUTE_KEY = 'photo.muted';

  // photo:event type -> sound name
  var EVENT_SOUNDS = {
    capture: 'capture',
    split: 'split',
    o2: 'o2',
    nadph: 'nadph',
    atp: 'atp',
    fix: 'fix',
    miss: 'miss',
    'level-complete': 'levelComplete',
    finale: 'finale',
    restart: 'restart'
  };

  var ctx = null;           // AudioContext, created on the first user gesture
  var master = null;        // master gain; every sound ends here
  var noiseBuf = null;      // shared buffer of white noise
  var contextTried = false;
  var muted = readMuted();
  var button = null;
  var lastPlayed = {};      // sound name -> clock time of its last play

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function clock() {
    return window.performance ? window.performance.now() : Date.now();
  }

  // Storage can be blocked, so every access is guarded.
  function readMuted() {
    try {
      return window.localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function writeMuted(on) {
    try {
      window.localStorage.setItem(MUTE_KEY, on ? '1' : '0');
    } catch (e) {
      // The mute still works for this page view.
    }
  }

  function createContext() {
    contextTried = true;
    var AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_GAIN;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
      master = null;
    }
  }

  function resumeContext() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    try {
      var pending = ctx.resume();
      if (pending && pending.catch) pending.catch(function () {});
    } catch (e) {
      // The next gesture tries again.
    }
  }

  // Browsers allow audio only after a user gesture, so this runs on pointerdown and keydown.
  function unlock() {
    if (!contextTried) createContext();
    resumeContext();
  }

  // Synthesis helpers. Times are absolute AudioContext times.

  // Attack, hold, release envelope on a gain. Returns the end time.
  function envelope(param, at, peak, attack, hold, release) {
    var end = at + attack + hold + release;
    param.setValueAtTime(0.0001, at);
    param.exponentialRampToValueAtTime(peak, at + attack);
    param.setValueAtTime(peak, at + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, end);
    return end;
  }

  // Lowpass filter that feeds the master gain. Use it as a note's destination.
  function lowpass(freq, q) {
    var filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    filter.connect(master);
    return filter;
  }

  // One oscillator note. With freqEnd, the pitch glides to it over `glide` seconds.
  function tone(o) {
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = o.type;
    osc.frequency.setValueAtTime(o.freq, o.at);
    if (o.freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(o.freqEnd, o.at + (o.glide || 0.1));
    }
    var end = envelope(gain.gain, o.at, o.peak, o.attack || 0.005, o.hold || 0, o.release || 0.1);
    osc.connect(gain);
    gain.connect(o.dest || master);
    osc.start(o.at);
    osc.stop(end + 0.01);
  }

  // Shared half-second buffer of white noise.
  function noiseBuffer() {
    if (!noiseBuf) {
      var len = Math.floor(ctx.sampleRate * 0.5);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }
    return noiseBuf;
  }

  // Short noise burst through a filter. With freqEnd, the filter sweeps from freq to freqEnd.
  function burst(o) {
    var src = ctx.createBufferSource();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    filter.type = o.filter;
    filter.Q.value = o.q;
    filter.frequency.setValueAtTime(o.freq, o.at);
    if (o.freqEnd) {
      filter.frequency.exponentialRampToValueAtTime(o.freqEnd, o.at + o.dur);
    }
    var end = envelope(gain.gain, o.at, o.peak, o.attack, 0, o.dur - o.attack);
    src.buffer = noiseBuffer();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(o.at, Math.random() * 0.25);
    src.stop(end + 0.01);
  }

  // Brass-like note: two detuned sawtooths through a lowpass that opens, then closes.
  function brass(freq, at, peak, attack, hold, release) {
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.Q.value = 1;
    filter.frequency.setValueAtTime(700, at);
    filter.frequency.exponentialRampToValueAtTime(2400, at + attack + 0.04);
    filter.frequency.exponentialRampToValueAtTime(1000, at + attack + hold + release);
    var end = envelope(gain.gain, at, peak, attack, hold, release);
    filter.connect(gain);
    gain.connect(master);
    [-7, 7].forEach(function (cents) {
      var osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, at);
      osc.detune.setValueAtTime(cents, at);
      osc.connect(filter);
      osc.start(at);
      osc.stop(end + 0.01);
    });
  }

  // Each sound takes its start time. All but levelComplete and finale end within 0.4 s.
  var SYNTHS = {
    // Bright rising blip.
    capture: function (t) {
      tone({ type: 'triangle', freq: 740, freqEnd: 1480, glide: 0.07, at: t, peak: 0.6, attack: 0.004, hold: 0.02, release: 0.07 });
      tone({ type: 'sine', freq: 1480, at: t, peak: 0.12, attack: 0.004, release: 0.06 });
    },

    // Soft pop: a falling sine with a tiny click.
    split: function (t) {
      tone({ type: 'sine', freq: 420, freqEnd: 150, glide: 0.12, at: t, peak: 0.7, attack: 0.005, release: 0.14 });
      burst({ at: t, dur: 0.03, filter: 'lowpass', freq: 1200, q: 0.7, peak: 0.25, attack: 0.002 });
    },

    // Bubble bloop: a quick upward sine glide.
    o2: function (t) {
      tone({ type: 'sine', freq: 240, freqEnd: 640, glide: 0.14, at: t, peak: 0.65, attack: 0.01, hold: 0.02, release: 0.14 });
    },

    // Soft chime: two sines a fifth apart.
    nadph: function (t) {
      tone({ type: 'sine', freq: 659.25, at: t, peak: 0.45, attack: 0.004, hold: 0.02, release: 0.3 });
      tone({ type: 'sine', freq: 987.77, at: t, peak: 0.25, attack: 0.004, hold: 0.02, release: 0.26 });
    },

    // Rising ping.
    atp: function (t) {
      tone({ type: 'sine', freq: 523.25, freqEnd: 1046.5, glide: 0.16, at: t, peak: 0.7, attack: 0.004, hold: 0.02, release: 0.18 });
      tone({ type: 'triangle', freq: 784, freqEnd: 1568, glide: 0.16, at: t, peak: 0.12, attack: 0.004, hold: 0.02, release: 0.14 });
    },

    // Whoosh, then a low thud.
    fix: function (t) {
      burst({ at: t, dur: 0.2, filter: 'bandpass', freq: 350, freqEnd: 2600, q: 1.2, peak: 0.5, attack: 0.05 });
      tone({ type: 'sine', freq: 120, freqEnd: 42, glide: 0.15, at: t + 0.18, peak: 0.8, attack: 0.005, release: 0.14 });
    },

    // Quiet, short, low buzz.
    miss: function (t) {
      tone({ type: 'sawtooth', freq: 110, freqEnd: 82, glide: 0.15, at: t, peak: 0.3, attack: 0.01, hold: 0.04, release: 0.1, dest: lowpass(380, 1) });
    },

    // Arpeggio up a C major triad, then a held chord. About 0.9 s.
    levelComplete: function (t) {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (freq, i) {
        tone({ type: 'triangle', freq: freq, at: t + i * 0.1, peak: 0.45, attack: 0.005, hold: 0.03, release: 0.14 });
      });
      [1046.5, 1318.5, 1568].forEach(function (freq) {
        tone({ type: 'triangle', freq: freq, at: t + 0.42, peak: 0.25, attack: 0.01, hold: 0.3, release: 0.16 });
      });
    },

    // Brass fanfare: three short G notes, a held C, then a C major chord. About 1.6 s.
    finale: function (t) {
      [0, 0.16, 0.32].forEach(function (offset) {
        brass(392, t + offset, 0.2, 0.02, 0.06, 0.04);
      });
      brass(523.25, t + 0.48, 0.2, 0.03, 0.2, 0.12);
      [523.25, 659.25, 783.99].forEach(function (freq) {
        brass(freq, t + 0.8, 0.15, 0.03, 0.5, 0.25);
      });
      tone({ type: 'triangle', freq: 1046.5, at: t + 0.8, peak: 0.1, attack: 0.05, hold: 0.45, release: 0.25 });
      [0, 0.48, 0.8].forEach(function (offset) {
        tone({ type: 'sine', freq: 110, freqEnd: 48, glide: 0.2, at: t + offset, peak: 0.6, attack: 0.005, hold: 0.02, release: 0.2 });
      });
    },

    // Soft descending tone.
    restart: function (t) {
      tone({ type: 'sine', freq: 659.25, freqEnd: 329.63, glide: 0.3, at: t, peak: 0.5, attack: 0.02, hold: 0.04, release: 0.25 });
    }
  };

  // Plays one sound by name. Silent when muted, before the first gesture, or within the throttle window.
  function play(name) {
    try {
      if (!hasOwn(SYNTHS, name) || muted || !ctx) return;
      if (ctx.state !== 'running') {
        resumeContext();
        return;
      }
      var now = clock();
      var last = lastPlayed[name];
      if (last !== undefined && now - last < THROTTLE_MS) return;
      lastPlayed[name] = now;
      SYNTHS[name](ctx.currentTime + 0.02);
    } catch (e) {
      // Audio must never break the game.
    }
  }

  function setMuted(on) {
    muted = !!on;
    writeMuted(muted);
    if (master) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : MASTER_GAIN, ctx.currentTime, 0.02);
      } catch (e) {
        // play() already checks the flag.
      }
    }
    updateButton();
  }

  function isMuted() {
    return muted;
  }

  // The visible text already says whether sound is on, so the button needs no aria-pressed.
  function updateButton() {
    if (!button) return;
    button.textContent = muted ? copy.soundOff : copy.soundOn;
  }

  // Inserts the button just before #btn-restart. Skips it if either is missing.
  function buildButton() {
    button = document.getElementById('btn-sound');
    if (!button) {
      var meta = document.querySelector('.hud-meta');
      var restart = document.getElementById('btn-restart');
      if (!meta || !restart || !meta.contains(restart)) return;
      button = document.createElement('button');
      button.id = 'btn-sound';
      button.className = 'btn btn-ghost';
      button.type = 'button';
      restart.parentNode.insertBefore(button, restart);
    }
    button.addEventListener('click', function () {
      setMuted(!muted);
    });
    updateButton();
  }

  function onEvent(e) {
    var detail = e && e.detail;
    if (!detail || !hasOwn(EVENT_SOUNDS, detail.type)) return;
    play(EVENT_SOUNDS[detail.type]);
  }

  window.Photosynthesis.sound = {
    play: play,
    setMuted: setMuted,
    isMuted: isMuted
  };

  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('photo:event', onEvent);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildButton);
  } else {
    buildButton();
  }
})();
