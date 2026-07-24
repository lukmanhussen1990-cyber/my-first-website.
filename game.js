/* Dino Runner — a polished offline-style endless runner.
 * Vector-drawn (no image assets), retina-aware, with day/night cycle,
 * cacti + pterodactyls, WebAudio sfx, and local high scores.
 */
(() => {
  'use strict';

  // ---- Canvas setup ---------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WORLD = { w: 1200, h: 360 };     // logical coordinate space
  const GROUND_Y = 300;                   // y of the ground line

  function resizeForDPR() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WORLD.w * dpr;
    canvas.height = WORLD.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }
  resizeForDPR();
  window.addEventListener('resize', resizeForDPR);

  // ---- Persisted state ------------------------------------------------------
  const HS_KEY = 'dinoRunner.highScore';
  const MUTE_KEY = 'dinoRunner.muted';
  const THEME_KEY = 'dinoRunner.theme';

  let highScore = parseInt(localStorage.getItem(HS_KEY) || '0', 10) || 0;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  // ---- Audio (WebAudio, generated tones) -----------------------------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  function beep(freq, dur = 0.09, type = 'square', vol = 0.06) {
    if (muted || !audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  const sfx = {
    jump: () => beep(620, 0.10, 'square', 0.05),
    point: () => beep(880, 0.08, 'sine', 0.045),
    die: () => { beep(200, 0.18, 'sawtooth', 0.07); setTimeout(() => beep(120, 0.28, 'sawtooth', 0.06), 90); },
  };

  // ---- Game constants -------------------------------------------------------
  const GRAVITY = 2600;          // px/s^2
  const JUMP_V = -960;           // initial jump velocity
  const FAST_FALL = 3400;        // extra gravity when ducking mid-air
  const START_SPEED = 460;       // px/s
  const MAX_SPEED = 1150;
  const SPEED_RAMP = 14;         // px/s per second of play

  // ---- Entities -------------------------------------------------------------
  const dino = {
    x: 90, y: GROUND_Y, vy: 0,
    w: 60, h: 66,
    ducking: false,
    onGround: true,
    runFrame: 0, frameTimer: 0,
    hitFlash: 0,
  };

  let obstacles = [];
  let clouds = [];
  let stars = [];
  let groundBumps = [];

  // ---- Game state -----------------------------------------------------------
  const State = { MENU: 0, RUN: 1, PAUSE: 2, OVER: 3 };
  let state = State.MENU;
  let speed = START_SPEED;
  let distance = 0;         // world scroll used for score
  let elapsed = 0;
  let spawnTimer = 0;
  let nextSpawn = 1.1;
  let cloudTimer = 0;
  let score = 0;
  let lastMilestone = 0;
  let dayPhase = 0;         // 0..1, drives day/night blend
  let flashTimer = 0;       // milestone screen flash

  // ---- UI refs --------------------------------------------------------------
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');
  const scoreEl = document.getElementById('score');
  const hiScoreEl = document.getElementById('hiScore');
  const muteBtn = document.getElementById('muteBtn');
  const themeToggle = document.getElementById('themeToggle');

  const pad = (n) => String(Math.floor(n)).padStart(5, '0');
  hiScoreEl.textContent = pad(highScore);

  function updateMuteLabel() {
    muteBtn.textContent = muted ? '🔇 Sound off' : '🔊 Sound on';
  }
  updateMuteLabel();

  // ---- Theme ----------------------------------------------------------------
  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    themeToggle.querySelector('.theme-icon').textContent = dark ? '☀️' : '🌙';
    document.querySelector('meta[name=theme-color]').setAttribute('content', dark ? '#0f1115' : '#f7f7f7');
  }
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme ? savedTheme === 'dark' : prefersDark);
  themeToggle.addEventListener('click', () => {
    const dark = !document.body.classList.contains('dark');
    applyTheme(dark);
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  });

  // ---- Init decorative layers ----------------------------------------------
  function seedStars() {
    stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({ x: Math.random() * WORLD.w, y: Math.random() * (GROUND_Y - 80) + 10, r: Math.random() * 1.4 + 0.4, tw: Math.random() * Math.PI * 2 });
    }
  }
  function seedGround() {
    groundBumps = [];
    for (let i = 0; i < 60; i++) {
      groundBumps.push({ x: Math.random() * WORLD.w, len: Math.random() * 18 + 4, y: GROUND_Y + 8 + Math.random() * 26 });
    }
  }
  seedStars();
  seedGround();

  // ---- Spawning -------------------------------------------------------------
  function spawnObstacle() {
    // Difficulty rises with speed: more birds, tighter cacti later.
    const t = (speed - START_SPEED) / (MAX_SPEED - START_SPEED); // 0..1
    const birdChance = Math.min(0.35, 0.06 + t * 0.32);
    if (Math.random() < birdChance) {
      // Pterodactyl at one of three heights.
      const heights = [GROUND_Y - 24, GROUND_Y - 66, GROUND_Y - 108];
      const y = heights[Math.floor(Math.random() * heights.length)];
      obstacles.push({ type: 'bird', x: WORLD.w + 40, y, w: 62, h: 42, flap: 0 });
    } else {
      // Cactus cluster of 1..3.
      const count = 1 + Math.floor(Math.random() * (t > 0.4 ? 3 : 2));
      const big = Math.random() < 0.4;
      const unitW = big ? 26 : 18;
      const h = big ? 70 : 50;
      const w = unitW * count + (count - 1) * 4;
      obstacles.push({ type: 'cactus', x: WORLD.w + 40, y: GROUND_Y, w, h, count, unitW, big });
    }
  }

  function spawnCloud() {
    clouds.push({ x: WORLD.w + 60, y: 40 + Math.random() * 120, s: 0.3 + Math.random() * 0.4, scale: 0.7 + Math.random() * 0.7 });
  }

  // ---- Input ----------------------------------------------------------------
  function startJump() {
    ensureAudio();
    if (state === State.MENU || state === State.OVER) { startGame(); return; }
    if (state === State.PAUSE) { state = State.RUN; overlay.classList.add('hidden'); return; }
    if (state !== State.RUN) return;
    if (dino.onGround) {
      dino.vy = JUMP_V;
      dino.onGround = false;
      dino.ducking = false;
      sfx.jump();
    }
  }
  function setDuck(on) {
    if (state !== State.RUN) return;
    dino.ducking = on;
  }
  function togglePause() {
    if (state === State.RUN) {
      state = State.PAUSE;
      showOverlay('Paused', 'Press <kbd>P</kbd> or tap to resume.');
    } else if (state === State.PAUSE) {
      state = State.RUN;
      overlay.classList.add('hidden');
    }
  }

  window.addEventListener('keydown', (e) => {
    switch (e.code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault(); startJump(); break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault(); setDuck(true); break;
      case 'KeyP':
        e.preventDefault(); togglePause(); break;
      case 'KeyM':
        toggleMute(); break;
    }
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowDown' || e.code === 'KeyS') setDuck(false);
  });

  // Touch / pointer on the stage.
  const stage = document.getElementById('stage');
  stage.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.btn')) return;
    e.preventDefault();
    startJump();
  });

  const jumpBtn = document.getElementById('jumpBtn');
  const duckBtn = document.getElementById('duckBtn');
  const bindHold = (el, on, off) => {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); off && off(); });
    el.addEventListener('pointerleave', () => { off && off(); });
    el.addEventListener('pointercancel', () => { off && off(); });
  };
  bindHold(jumpBtn, startJump);
  bindHold(duckBtn, () => setDuck(true), () => setDuck(false));

  startBtn.addEventListener('click', (e) => { e.stopPropagation(); ensureAudio(); startGame(); });

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    updateMuteLabel();
    if (!muted) ensureAudio();
  }
  muteBtn.addEventListener('click', toggleMute);
  muteBtn.addEventListener('keydown', (e) => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); toggleMute(); } });

  // ---- Game control ---------------------------------------------------------
  function showOverlay(title, html) {
    overlayTitle.textContent = title;
    overlayText.innerHTML = html;
    overlay.classList.remove('hidden');
  }

  function startGame() {
    obstacles = [];
    clouds = [];
    speed = START_SPEED;
    distance = 0;
    elapsed = 0;
    score = 0;
    lastMilestone = 0;
    spawnTimer = 0;
    nextSpawn = 0.9;
    cloudTimer = 0;
    dayPhase = 0;
    flashTimer = 0;
    dino.y = GROUND_Y;
    dino.vy = 0;
    dino.onGround = true;
    dino.ducking = false;
    dino.hitFlash = 0;
    state = State.RUN;
    overlay.classList.add('hidden');
  }

  function gameOver() {
    state = State.OVER;
    dino.hitFlash = 0.4;
    sfx.die();
    if (score > highScore) {
      highScore = Math.floor(score);
      localStorage.setItem(HS_KEY, String(highScore));
      hiScoreEl.textContent = pad(highScore);
      showOverlay('New Best! 🏆', `You scored <b>${pad(score)}</b>.<br/>Press <kbd>Space</kbd> or tap to run again.`);
    } else {
      showOverlay('Game Over', `Score <b>${pad(score)}</b> · Best ${pad(highScore)}<br/>Press <kbd>Space</kbd> or tap to retry.`);
    }
  }

  // ---- Collision ------------------------------------------------------------
  function dinoBox() {
    if (dino.ducking && dino.onGround) {
      return { x: dino.x + 4, y: GROUND_Y - 38, w: 74, h: 38 };
    }
    return { x: dino.x + 8, y: dino.y - dino.h, w: dino.w - 16, h: dino.h };
  }
  function obstacleBox(o) {
    if (o.type === 'bird') return { x: o.x + 6, y: o.y - 6, w: o.w - 12, h: o.h - 12 };
    return { x: o.x + 3, y: o.y - o.h, w: o.w - 6, h: o.h };
  }
  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---- Update ---------------------------------------------------------------
  function update(dt) {
    if (state !== State.RUN) return;

    elapsed += dt;
    speed = Math.min(MAX_SPEED, START_SPEED + elapsed * SPEED_RAMP);
    const move = speed * dt;
    distance += move;

    // Score: 1 point per ~6px, feels like the original's tempo.
    const prevScore = score;
    score = distance / 6;
    scoreEl.textContent = pad(score);
    if (Math.floor(score / 100) > Math.floor(prevScore / 100)) {
      scoreEl.classList.remove('score-bump');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('score-bump');
    }
    // Milestone every 500 points: chime + flash + advance day/night.
    if (Math.floor(score / 500) > lastMilestone) {
      lastMilestone = Math.floor(score / 500);
      sfx.point();
      flashTimer = 0.25;
      dayPhase = (dayPhase + 0.5) % 2; // toggle toward night/day
    }

    // Dino physics.
    if (!dino.onGround) {
      dino.vy += (dino.ducking ? FAST_FALL : GRAVITY) * dt;
      dino.y += dino.vy * dt;
      if (dino.y >= GROUND_Y) {
        dino.y = GROUND_Y;
        dino.vy = 0;
        dino.onGround = true;
      }
    }
    // Run animation.
    dino.frameTimer += dt;
    const frameSpeed = Math.max(0.05, 0.14 - (speed - START_SPEED) / 12000);
    if (dino.frameTimer > frameSpeed) {
      dino.frameTimer = 0;
      dino.runFrame = (dino.runFrame + 1) % 2;
    }
    if (dino.hitFlash > 0) dino.hitFlash -= dt;
    if (flashTimer > 0) flashTimer -= dt;

    // Spawn obstacles.
    spawnTimer += dt;
    if (spawnTimer >= nextSpawn) {
      spawnTimer = 0;
      spawnObstacle();
      // Gap scales inversely with speed, plus jitter.
      const base = Math.max(0.55, 1.5 - (speed - START_SPEED) / 900);
      nextSpawn = base + Math.random() * 0.7;
    }

    // Move + cull obstacles, detect collisions.
    const db = dinoBox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      o.x -= move;
      if (o.type === 'bird') { o.flap += dt * 10; o.x -= move * 0.15; } // birds a touch faster
      if (o.x + o.w < -20) { obstacles.splice(i, 1); continue; }
      if (overlaps(db, obstacleBox(o))) { gameOver(); return; }
    }

    // Clouds.
    cloudTimer += dt;
    if (cloudTimer > 2.6) { cloudTimer = 0; if (clouds.length < 5) spawnCloud(); }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      c.x -= speed * c.s * 0.4 * dt;
      if (c.x < -80) clouds.splice(i, 1);
    }

    // Ground bumps scroll and wrap.
    for (const g of groundBumps) {
      g.x -= move;
      if (g.x < -20) { g.x = WORLD.w + Math.random() * 40; g.y = GROUND_Y + 8 + Math.random() * 26; g.len = Math.random() * 18 + 4; }
    }
    // Stars drift slowly (only visible at night).
    for (const s of stars) {
      s.x -= move * 0.05;
      if (s.x < 0) s.x += WORLD.w;
    }
  }

  // ---- Rendering ------------------------------------------------------------
  function lerp(a, b, t) { return a + (b - a) * t; }
  function nightAmount() {
    // dayPhase 0..2: 0=day, 1=night, wraps. Smooth via cosine.
    return (1 - Math.cos(dayPhase * Math.PI)) / 2;
  }

  function drawBackground() {
    const n = nightAmount();
    // Sky gradient.
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, mixColor([135, 206, 250], [12, 16, 32], n));
    g.addColorStop(1, mixColor([233, 244, 255], [24, 28, 48], n));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.w, GROUND_Y);

    // Sun / moon.
    const cx = WORLD.w - 140, cy = 70;
    if (n < 0.5) {
      ctx.globalAlpha = 1 - n * 2;
      ctx.fillStyle = '#ffdf6b';
      circle(cx, cy, 26);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = (n - 0.5) * 2;
      ctx.fillStyle = '#f4f4e8';
      circle(cx, cy, 24);
      ctx.fillStyle = mixColor([12, 16, 32], [12, 16, 32], 1);
      ctx.globalAlpha = ((n - 0.5) * 2) * 0.9;
      circle(cx + 9, cy - 6, 20); // crescent shadow
      ctx.globalAlpha = 1;
    }

    // Stars at night.
    if (n > 0.35) {
      const a = (n - 0.35) / 0.65;
      for (const s of stars) {
        ctx.globalAlpha = a * (0.5 + 0.5 * Math.sin(s.tw + performance.now() / 600));
        ctx.fillStyle = '#ffffff';
        circle(s.x, s.y, s.r);
      }
      ctx.globalAlpha = 1;
    }

    // Clouds.
    ctx.fillStyle = n > 0.5 ? 'rgba(120,130,160,0.5)' : 'rgba(255,255,255,0.9)';
    for (const c of clouds) drawCloud(c);
  }

  function drawCloud(c) {
    const { x, y, scale } = c;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.arc(16, 2, 12, 0, Math.PI * 2);
    ctx.arc(-16, 4, 11, 0, Math.PI * 2);
    ctx.arc(2, 8, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawGround() {
    const n = nightAmount();
    ctx.strokeStyle = mixColor([83, 83, 83], [150, 155, 170], n);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 1);
    ctx.lineTo(WORLD.w, GROUND_Y + 1);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const g of groundBumps) {
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + g.len, g.y);
    }
    ctx.stroke();
  }

  function inkColor() {
    const n = nightAmount();
    return mixColor([70, 70, 70], [222, 226, 235], n);
  }

  function drawDino() {
    const col = dino.hitFlash > 0 && Math.floor(dino.hitFlash * 20) % 2 ? '#e05252' : inkColor();
    ctx.fillStyle = col;

    const groundDuck = dino.ducking && dino.onGround;
    if (groundDuck) {
      drawDinoDuck();
    } else {
      drawDinoStand();
    }
  }

  // Blocky, T-rex-ish silhouette drawn from rectangles.
  function drawDinoStand() {
    const baseY = dino.y;                 // feet at baseY
    const x = dino.x;
    // Body block.
    rect(x + 6, baseY - 34, 34, 28);
    // Tail.
    rect(x, baseY - 30, 10, 8);
    rect(x - 6, baseY - 26, 8, 6);
    // Head.
    rect(x + 30, baseY - 60, 30, 26);
    // Snout.
    rect(x + 54, baseY - 50, 12, 10);
    // Eye (cut-out).
    ctx.save();
    ctx.fillStyle = document.body.classList.contains('dark') ? '#171a21' : '#f7f7f7';
    rect(x + 50, baseY - 55, 5, 5);
    ctx.restore();
    // Little arm.
    rect(x + 34, baseY - 24, 10, 5);
    // Legs — alternate for run cycle.
    if (dino.onGround) {
      if (dino.runFrame === 0) {
        rect(x + 12, baseY - 8, 8, 8);
        rect(x + 26, baseY - 6, 8, 6);
      } else {
        rect(x + 12, baseY - 6, 8, 6);
        rect(x + 26, baseY - 8, 8, 8);
      }
    } else {
      // Tucked while airborne.
      rect(x + 14, baseY - 8, 8, 8);
      rect(x + 26, baseY - 8, 8, 8);
    }
  }

  function drawDinoDuck() {
    const baseY = GROUND_Y;
    const x = dino.x;
    // Long low body.
    rect(x + 2, baseY - 30, 46, 22);
    // Tail up.
    rect(x - 6, baseY - 34, 10, 8);
    // Head forward.
    rect(x + 44, baseY - 30, 30, 20);
    rect(x + 68, baseY - 24, 10, 8);
    // Eye.
    ctx.save();
    ctx.fillStyle = document.body.classList.contains('dark') ? '#171a21' : '#f7f7f7';
    rect(x + 64, baseY - 26, 5, 5);
    ctx.restore();
    // Running legs.
    if (dino.runFrame === 0) {
      rect(x + 12, baseY - 8, 8, 8);
      rect(x + 30, baseY - 6, 8, 6);
    } else {
      rect(x + 12, baseY - 6, 8, 6);
      rect(x + 30, baseY - 8, 8, 8);
    }
  }

  function drawObstacles() {
    ctx.fillStyle = inkColor();
    for (const o of obstacles) {
      if (o.type === 'cactus') drawCactus(o);
      else drawBird(o);
    }
  }

  function drawCactus(o) {
    const baseY = o.y;
    let cx = o.x;
    for (let i = 0; i < o.count; i++) {
      const w = o.unitW;
      const h = o.h * (0.8 + Math.random() * 0); // stable height
      // Main stalk.
      rect(cx + w / 2 - 4, baseY - o.h, 8, o.h);
      // Arms.
      rect(cx, baseY - o.h * 0.6, 6, 4);
      rect(cx, baseY - o.h * 0.6 - 12, 5, 14);
      rect(cx + w - 6, baseY - o.h * 0.5, 6, 4);
      rect(cx + w - 5, baseY - o.h * 0.5 - 14, 5, 16);
      cx += w + 4;
    }
  }

  function drawBird(o) {
    const x = o.x, y = o.y;
    const up = Math.sin(o.flap) > 0;
    // Body.
    rect(x + 20, y + 12, 26, 10);
    // Head + beak.
    rect(x + 42, y + 8, 12, 10);
    rect(x + 54, y + 12, 8, 5);
    // Wings flap.
    if (up) {
      rect(x + 18, y, 24, 8);
      rect(x + 22, y - 8, 14, 8);
    } else {
      rect(x + 18, y + 22, 24, 8);
      rect(x + 22, y + 30, 14, 8);
    }
  }

  function render() {
    ctx.clearRect(0, 0, WORLD.w, WORLD.h);
    drawBackground();
    drawGround();
    drawObstacles();
    drawDino();

    // Milestone flash.
    if (flashTimer > 0) {
      ctx.fillStyle = `rgba(255,255,255,${flashTimer * 0.6})`;
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    }
    // Dim during pause/over.
    if (state === State.PAUSE) {
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    }
  }

  // ---- Draw helpers ---------------------------------------------------------
  function rect(x, y, w, h) { ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function mixColor(a, b, t) {
    const r = Math.round(lerp(a[0], b[0], t));
    const g = Math.round(lerp(a[1], b[1], t));
    const bl = Math.round(lerp(a[2], b[2], t));
    return `rgb(${r},${g},${bl})`;
  }

  // ---- Main loop (fixed-step accumulator) -----------------------------------
  let lastT = performance.now();
  let acc = 0;
  const STEP = 1 / 120; // physics step

  function frame(now) {
    let dt = (now - lastT) / 1000;
    lastT = now;
    if (dt > 0.1) dt = 0.1; // clamp after tab switch
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause when tab hidden.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === State.RUN) togglePause();
  });
})();
