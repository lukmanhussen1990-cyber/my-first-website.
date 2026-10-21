(function () {
  'use strict';

  window.Photosynthesis = window.Photosynthesis || {};
  if (window.Photosynthesis.celebrate) return; // already loaded

  // Confetti on level complete and on the finale. Visual only: no text.
  const copy = {};

  const DEG = Math.PI / 180;
  const PALETTE = ['#ffd166', '#95d5b2', '#8ecae6', '#f4a261', '#b388eb', '#ffb703', '#6bcb77'];
  const BURSTS = {
    level: { count: 120, duration: 2.5 },
    finale: { count: 260, duration: 4 }
  };
  // Two cannons on the bottom edge. x is a fraction of the width; aim is the launch angle above the horizontal.
  const CANNONS = [
    { x: 0, aim: 68 * DEG },
    { x: 1, aim: 112 * DEG }
  ];
  const SPREAD = 12 * DEG;    // random aim jitter either side of each cannon
  const LAUNCH_WINDOW = 0.5;  // seconds over which pieces pop out
  const FADE_SECONDS = 0.7;   // alpha ramps to 0 over this long before the end
  const MAX_DT = 0.05;

  let canvas = null;
  let ctx = null;
  const view = { w: 1, h: 1, sx: 1, sy: 1 }; // CSS size and backing-store scale
  let pieces = [];
  let duration = 0;
  let elapsed = 0;
  let last = null;
  let rafId = null;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function reducedMotion() {
    if (typeof window.matchMedia !== 'function') return false;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    return !!(query && query.matches);
  }

  function ensureStyle() {
    if (document.querySelector('style[data-feature="celebrate"]')) return;
    const style = document.createElement('style');
    style.setAttribute('data-feature', 'celebrate');
    style.textContent = [
      '.celebrate-canvas {',
      '  position: fixed;',
      '  inset: 0;',
      '  width: 100%;',
      '  height: 100%;',
      '  pointer-events: none;',
      '  z-index: 50;',
      '}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  // Creates the canvas on demand. A running burst reuses it.
  function ensureCanvas() {
    if (!canvas || canvas.parentNode !== document.body) {
      canvas = document.createElement('canvas');
      canvas.className = 'celebrate-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      removeCanvas();
      return false;
    }
    return true;
  }

  function sizeCanvas() {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    view.w = Math.max(1, window.innerWidth);
    view.h = Math.max(1, window.innerHeight);
    canvas.width = Math.max(1, Math.round(view.w * scale));
    canvas.height = Math.max(1, Math.round(view.h * scale));
    view.sx = canvas.width / view.w;
    view.sy = canvas.height / view.h;
  }

  function removeCanvas() {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
  }

  // Cancels the running animation, if any.
  function stop() {
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    pieces = [];
  }

  function makePieces(count, u) {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        cannon: i % 2,
        launchAt: rand(0, LAUNCH_WINDOW),
        launched: false,
        shape: Math.random() < 0.35 ? 'circle' : 'rect',
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
        size: Math.max(5, u * rand(0.016, 0.028)),
        aspect: rand(0.4, 0.65), // rectangle height / width
        x: 0, y: 0, vx: 0, vy: 0,
        drag: rand(1.8, 3.2),    // per second; sets the fall speed
        angle: rand(0, Math.PI * 2),
        spin: (Math.random() < 0.5 ? -1 : 1) * rand(3, 9),
        flip: rand(0, Math.PI * 2),
        flipSpeed: rand(6, 14),
        swayAmp: u * rand(0.01, 0.025),
        swayFreq: rand(4, 8),
        swayPhase: rand(0, Math.PI * 2)
      });
    }
    return list;
  }

  function launch(p) {
    const cannon = CANNONS[p.cannon];
    const theta = cannon.aim + rand(-SPREAD, SPREAD);
    const speed = view.h * rand(1.5, 2.2); // px/s; drag turns this into a rise
    p.launched = true;
    p.x = cannon.x * view.w;
    p.y = view.h;
    p.vx = Math.cos(theta) * speed;
    p.vy = -Math.sin(theta) * speed;
  }

  function step(dt) {
    const gravity = Math.min(view.w, view.h); // px/s^2
    for (const p of pieces) {
      if (!p.launched) {
        if (elapsed < p.launchAt) continue;
        launch(p);
      }
      const drag = Math.exp(-p.drag * dt);
      p.vy += gravity * dt;
      p.vx *= drag;
      p.vy *= drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.flip += p.flipSpeed * dt;
    }
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.sx, 0, 0, view.sy, 0, 0); // draw in CSS pixels
    const fade = Math.max(0, Math.min(1, (duration - elapsed) / FADE_SECONDS));
    if (fade <= 0) return;
    for (const p of pieces) {
      if (!p.launched) continue;
      const x = p.x + Math.sin(p.swayPhase + elapsed * p.swayFreq) * p.swayAmp;
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(x, p.y);
      ctx.rotate(p.angle);
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(p.flip))); // paper flip
        ctx.fillRect(-p.size / 2, (-p.size * p.aspect) / 2, p.size, p.size * p.aspect);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rafId = null;
    const dt = Math.min(MAX_DT, last === null ? 1 / 60 : (now - last) / 1000);
    last = now;
    elapsed += dt;
    step(dt);
    draw();
    if (elapsed >= duration) {
      stop();
      removeCanvas();
    } else {
      rafId = requestAnimationFrame(frame);
    }
  }

  // Starts a burst. Returns false when nothing is shown: reduced motion,
  // an unknown kind, or no canvas could be made.
  function burst(kind) {
    const spec = kind === 'level' || kind === 'finale' ? BURSTS[kind] : null;
    if (!spec || reducedMotion() || !document.body || typeof requestAnimationFrame !== 'function') {
      return false;
    }
    stop(); // cancel any running burst before starting this one
    ensureStyle();
    if (!ensureCanvas()) return false;
    sizeCanvas();
    duration = spec.duration;
    elapsed = 0;
    last = null;
    pieces = makePieces(spec.count, Math.min(view.w, view.h));
    rafId = requestAnimationFrame(frame);
    return true;
  }

  function onResize() {
    if (canvas && ctx) sizeCanvas();
  }

  function onGameEvent(event) {
    const detail = event && event.detail;
    const type = detail && detail.type;
    if (type === 'level-complete') {
      burst('level');
    } else if (type === 'finale') {
      burst('finale');
    } else if (type === 'restart') {
      stop();
      removeCanvas();
    }
  }

  function start() {
    document.addEventListener('photo:event', onGameEvent);
    window.addEventListener('resize', onResize);
  }

  window.Photosynthesis.celebrate = { burst: burst };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
