/* Crossy Road — bootstrap, input, main loop. */
(function (global) {
  'use strict';

  var CR = global.CR;

  var canvas = document.getElementById('game');
  var game = new CR.Game(canvas);
  CR.game = game;
  CR.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in global;

  CR.ui.init(game);

  /* ── Sizing ───────────────────────────────────────────────── */

  function resize() {
    game.r.resize(global.innerWidth, global.innerHeight);
    CR.ui.resizePreview();
  }
  global.addEventListener('resize', resize);
  global.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
  resize();

  /* ── Keyboard ─────────────────────────────────────────────── */

  var KEYS = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right'
  };

  document.addEventListener('keydown', function (e) {
    var dir = KEYS[e.code];
    if (dir) {
      e.preventDefault();
      CR.audio.init();
      if (game.state === 'menu') { CR.ui.play(); return; }
      game.move(dir);
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (game.state === 'play') game.pause();
      else if (game.state === 'paused') game.resume();
    } else if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (game.state === 'menu' || game.state === 'over') CR.ui.play();
    } else if (e.code === 'KeyM') {
      var muted = CR.audio.toggle();
      document.getElementById('btn-sound').textContent = muted ? '🔇' : '🔊';
    }
  }, { passive: false });

  /* ── Touch: swipe anywhere, or the on-screen pad ──────────── */

  var t0 = null;
  canvas.addEventListener('touchstart', function (e) {
    CR.audio.init();
    var t = e.changedTouches[0];
    t0 = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, { passive: true });

  canvas.addEventListener('touchend', function (e) {
    if (!t0) return;
    var t = e.changedTouches[0];
    var dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    var dist = Math.hypot(dx, dy);
    var quick = Date.now() - t0.time < 450;
    t0 = null;
    if (game.state === 'menu') return;
    if (dist < 24) { game.move('up'); return; }          // tap = hop forward
    if (!quick && dist < 40) return;
    if (Math.abs(dx) > Math.abs(dy)) game.move(dx > 0 ? 'right' : 'left');
    else game.move(dy < 0 ? 'up' : 'down');
  }, { passive: true });

  // Mouse click on the playfield also hops forward (desktop convenience).
  canvas.addEventListener('mousedown', function () {
    CR.audio.init();
    if (game.state === 'play') game.move('up');
  });

  var pad = document.getElementById('dpad');
  Array.prototype.forEach.call(pad.querySelectorAll('.dbtn'), function (btn) {
    var dir = btn.getAttribute('data-dir');
    function press(e) { e.preventDefault(); CR.audio.init(); game.move(dir); }
    btn.addEventListener('touchstart', press, { passive: false });
    btn.addEventListener('mousedown', press);
  });

  if (CR.touch) document.body.classList.add('touch');

  /* ── Auto-pause when the tab or window goes away ──────────── */

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) game.pause();
  });
  global.addEventListener('blur', function () { game.pause(); });

  /* ── Loop ─────────────────────────────────────────────────── */

  var last = performance.now();
  function frame(now) {
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;             // never let a stall teleport traffic
    game.update(dt);
    game.draw();
    CR.ui.drawPreview(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window);
