/*
 * imran — player: sizes the canvas, runs the clock, wires up the controls.
 * Muted autoplay on load; "Play with sound" restarts from the top with audio.
 */
(function () {
  'use strict';

  var S = window.ImranScene;
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var startBtn = document.getElementById('start');
  var replayBtn = document.getElementById('replay');
  var soundBtn = document.getElementById('sound');
  var loopBtn = document.getElementById('loop');

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    loop: true,
    sound: false,
    playing: !reduceMotion,
    origin: performance.now() / 1000,   // wall-clock start of the current run
    audio: null,                        // AudioContext
    track: null,                        // current scheduled soundtrack
    trackStart: 0,                      // audio-clock start of the current run
    nextTrack: null
  };

  // ------------------------------------------------------------ layout

  var view = { scale: 1, w: 0, h: 0, dpr: 1 };

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    // fit the 3840x2160 design so the logo keeps the original's proportions on
    // wide screens and still fills the width on phones
    view.scale = Math.min(w / 2000, h / 2160);
    view.w = w; view.h = h; view.dpr = dpr;
  }

  function draw(t) {
    var s = view.scale * view.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = S.COLOR.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, (view.w / 2) * view.dpr - S.CX * s, (view.h / 2) * view.dpr - S.CY * s);
    S.drawFrame(ctx, t);
  }

  // ------------------------------------------------------------ clock

  function elapsed() {
    if (state.sound && state.audio) return state.audio.currentTime - state.trackStart;
    return performance.now() / 1000 - state.origin;
  }

  function frame() {
    var t;
    if (!state.playing) {
      t = reduceMotion ? 4.5 : S.DURATION;
    } else {
      var e = elapsed();
      if (state.loop) {
        // keep the soundtrack one loop ahead
        if (state.sound && state.audio && e > S.DURATION - 0.6 && !state.nextTrack) {
          state.nextTrack = ImranSound.play(state.audio, state.audio.destination, state.trackStart + S.DURATION);
        }
        if (e >= S.DURATION) {
          state.trackStart += S.DURATION;
          state.origin += S.DURATION;
          state.track = state.nextTrack || state.track;
          state.nextTrack = null;
          e -= S.DURATION;
        }
        t = e;
      } else {
        t = Math.min(e, S.DURATION);
        if (e >= S.DURATION + 1) state.playing = false;
      }
    }
    draw(Math.max(0, t));
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------ actions

  function stopAudio() {
    if (state.track) state.track.stop(0.06);
    if (state.nextTrack) state.nextTrack.stop(0.06);
    state.track = state.nextTrack = null;
  }

  function restart() {
    stopAudio();
    state.playing = true;
    state.origin = performance.now() / 1000;
    if (state.sound) {
      var a = state.audio;
      state.trackStart = a.currentTime + 0.08;
      state.track = ImranSound.play(a, a.destination, state.trackStart);
    }
  }

  function setSound(on) {
    state.sound = on;
    if (on) {
      if (!state.audio) {
        var AC = window.AudioContext || window.webkitAudioContext;
        state.audio = new AC({ latencyHint: 'interactive' });
      }
      if (state.audio.state === 'suspended') state.audio.resume();
    }
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    startBtn.hidden = on;
    restart();
  }

  function setLoop(on) {
    state.loop = on;
    loopBtn.setAttribute('aria-pressed', String(on));
    loopBtn.textContent = on ? 'Loop on' : 'Loop off';
    if (!on && state.nextTrack) { state.nextTrack.stop(0.02); state.nextTrack = null; }
  }

  startBtn.addEventListener('click', function () { setSound(true); });
  soundBtn.addEventListener('click', function () { setSound(!state.sound); });
  replayBtn.addEventListener('click', restart);
  loopBtn.addEventListener('click', function () { setLoop(!state.loop); });
  canvas.addEventListener('click', restart);

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'r' || e.key === 'R') { e.preventDefault(); restart(); }
    else if (e.key === 'm' || e.key === 'M') setSound(!state.sound);
    else if (e.key === 'l' || e.key === 'L') setLoop(!state.loop);
  });

  // pause the audio clock with the tab so picture and sound stay locked
  document.addEventListener('visibilitychange', function () {
    if (!state.audio) return;
    if (document.hidden) state.audio.suspend(); else if (state.sound) state.audio.resume();
  });

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
