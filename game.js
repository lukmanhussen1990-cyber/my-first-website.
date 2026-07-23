/* =====================================================================
   SUPER MARIO — vanilla canvas platformer
   No images, no libraries. All art drawn with the Canvas 2D API,
   all sound synthesized with the Web Audio API.
   ===================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------
  const VW = 640, VH = 360;      // virtual resolution
  const T = 24;                  // tile size (px) -> 15 rows tall
  const GROUND_TOP = 13;         // ground occupies rows 13 & 14

  const GRAVITY = 2100;          // px / s^2
  const MAX_FALL = 620;
  const WALK_ACCEL = 1150;
  const RUN_ACCEL = 1550;
  const MAX_WALK = 165;
  const MAX_RUN = 285;
  const FRICTION = 1250;
  const AIR_FRICTION = 250;
  const JUMP_VEL = 585;          // initial jump velocity
  const JUMP_HOLD = 1250;        // upward assist while holding (variable jump)
  const COYOTE = 0.09;
  const JUMP_BUFFER = 0.11;

  const SOLIDS = new Set(['#', '-', '=', '?', '!', 'p', 'u', 'q']);
  // u = used block, q = spent brick(solid). '=' brick, '?'/'!' item blocks.

  // ---------------------------------------------------------------
  // Canvas
  // ---------------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  // ---------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------
  const keys = { left: false, right: false, jump: false, run: false };
  let jumpEdge = false, fireEdge = false, runWasDown = false;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyK: 'run', KeyJ: 'run',
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') { togglePause(); return; }
    if (e.code === 'KeyM') { toggleMute(); return; }
    const a = KEYMAP[e.code];
    if (a) {
      if (a === 'jump' && !keys.jump) jumpEdge = true;
      keys[a] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (a) keys[a] = false;
  });

  // Touch controls
  function bindTouch() {
    document.querySelectorAll('.tbtn').forEach((btn) => {
      const k = btn.dataset.key;
      const on = (e) => {
        e.preventDefault();
        if (k === 'jump') { if (!keys.jump) jumpEdge = true; keys.jump = true; }
        else if (k === 'run') keys.run = true;
        else keys[k] = true;
      };
      const off = (e) => {
        e.preventDefault();
        if (k === 'jump') keys.jump = false;
        else if (k === 'run') keys.run = false;
        else keys[k] = false;
      };
      btn.addEventListener('touchstart', on, { passive: false });
      btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('touchcancel', off, { passive: false });
      btn.addEventListener('mousedown', on);
      btn.addEventListener('mouseup', off);
      btn.addEventListener('mouseleave', off);
    });
  }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    document.getElementById('touch-controls').classList.remove('hidden');
  }
  bindTouch();

  // ---------------------------------------------------------------
  // Audio engine (synthesized)
  // ---------------------------------------------------------------
  const Audio = (function () {
    let ac = null, master = null, muted = false, musicOn = true;
    let mIndex = 0, nextTime = 0;

    // A cheerful original overworld-style loop (frequencies in Hz, 0 = rest)
    const STEP = 0.135;
    const N = { C: 261.6, D: 293.7, E: 329.6, F: 349.2, G: 392.0, A: 440.0, B: 493.9, c: 523.3, d: 587.3, e: 659.3, g: 784.0, r: 0 };
    const melody = [
      N.E, N.E, N.r, N.E, N.r, N.C, N.E, N.r, N.G, N.r, N.r, N.r, N.g, N.r, N.r, N.r,
      N.c, N.r, N.r, N.G, N.r, N.r, N.E, N.r, N.r, N.A, N.r, N.B, N.r, N.A, N.r, N.G,
      N.E, N.r, N.g, N.e, N.r, N.d, N.c, N.r, N.r, N.A, N.r, N.B, N.r, N.A, N.r, N.G,
      N.E, N.r, N.C, N.r, N.r, N.r, N.r, N.r, N.C, N.r, N.G, N.r, N.c, N.r, N.G, N.r,
    ];
    const bass = [N.C / 2, 0, N.G / 2, 0, N.A / 2, 0, N.E / 2, 0];

    function ensure() {
      if (ac) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
    }

    function blip(freq, t, dur, type, vol) {
      if (!ac || freq <= 0) return;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol == null ? 0.22 : vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    function sweep(f0, f1, dur, type, vol) {
      if (!ac) return;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(vol == null ? 0.22 : vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    }

    return {
      resume() { ensure(); if (ac && ac.state === 'suspended') ac.resume(); },
      get muted() { return muted; },
      toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
      startMusic() { musicOn = true; if (ac) nextTime = ac.currentTime + 0.05; },
      stopMusic() { musicOn = false; },
      // pump the music scheduler each frame
      pump() {
        if (!ac || muted || !musicOn) return;
        while (nextTime < ac.currentTime + 0.15) {
          const note = melody[mIndex % melody.length];
          blip(note, nextTime, STEP * 0.92, 'square', 0.16);
          const b = bass[mIndex % bass.length];
          if (b) blip(b, nextTime, STEP * 1.6, 'triangle', 0.16);
          mIndex++;
          nextTime += STEP;
        }
      },
      jump() { sweep(360, 620, 0.16, 'square', 0.2); },
      coin() { const t = ac ? ac.currentTime : 0; blip(988, t, 0.08, 'square', 0.22); blip(1319, t + 0.08, 0.14, 'square', 0.22); },
      stomp() { sweep(300, 90, 0.14, 'square', 0.24); },
      bump() { sweep(200, 120, 0.09, 'square', 0.2); },
      brick() { sweep(240, 60, 0.16, 'sawtooth', 0.22); },
      power() { if (!ac) return; const t = ac.currentTime; [523, 659, 784, 1047, 1319].forEach((f, i) => blip(f, t + i * 0.06, 0.12, 'square', 0.2)); },
      fire() { sweep(700, 300, 0.1, 'sawtooth', 0.18); },
      kick() { sweep(220, 500, 0.1, 'square', 0.2); },
      oneUp() { if (!ac) return; const t = ac.currentTime; [659, 784, 988, 1319].forEach((f, i) => blip(f, t + i * 0.09, 0.14, 'triangle', 0.2)); },
      die() { if (!ac) return; const t = ac.currentTime; blip(392, t, 0.14, 'square', 0.22); blip(370, t + 0.16, 0.14, 'square', 0.22); sweep(300, 80, 0.5, 'square', 0.22); },
      flag() { if (!ac) return; const t = ac.currentTime; [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => blip(f, t + i * 0.07, 0.12, 'square', 0.18)); },
      win() { if (!ac) return; const t = ac.currentTime; [523, 659, 784, 1047, 784, 1047].forEach((f, i) => blip(f, t + i * 0.12, 0.2, 'triangle', 0.2)); },
    };
  })();

  // ---------------------------------------------------------------
  // Level data
  // Each level: a set of feature placements over an auto-built ground.
  //   s : horizontal string placed at (r, c)  [spaces skipped]
  //   pipe: {c, h}  green pipe (2 tiles wide)
  //   stair: {c, h, dir}  solid staircase
  // Non-solid glyphs in strings: o=coin g=goomba k=koopa
  // ---------------------------------------------------------------
  const LEVELS = [
    {
      name: 'WORLD 1-1', time: 320, width: 150, start: 2, flag: 143,
      pits: [[54, 56], [90, 92]],
      features: [
        { r: 9, c: 15, s: 'o' },
        { r: 8, c: 20, s: '?=!=?' },
        { r: 12, c: 24, s: 'g' },
        { pipe: { c: 28, h: 2 } },
        { r: 12, c: 34, s: 'g' }, { r: 12, c: 37, s: 'g' },
        { pipe: { c: 40, h: 3 } },
        { r: 8, c: 46, s: 'ooo' },
        { pipe: { c: 48, h: 4 } },
        { r: 7, c: 60, s: '?' }, { r: 12, c: 62, s: 'k' },
        { r: 4, c: 64, s: 'oooo' },
        { r: 8, c: 66, s: '===?===' },
        { r: 12, c: 72, s: 'g' }, { r: 12, c: 75, s: 'g' },
        { r: 8, c: 78, s: '=!=' },
        { r: 6, c: 82, s: 'ooooo' },
        { r: 12, c: 96, s: 'g' },
        { stair: { c: 100, h: 4, dir: 1 } },
        { r: 12, c: 108, s: 'k' },
        { stair: { c: 112, h: 4, dir: -1 } },
        { r: 7, c: 118, s: '?=?' }, { r: 4, c: 119, s: 'ooo' },
        { pipe: { c: 124, h: 2 } },
        { r: 12, c: 130, s: 'g' }, { r: 12, c: 132, s: 'g' },
        { stair: { c: 136, h: 5, dir: 1 } },
      ],
    },
    {
      name: 'WORLD 1-2', time: 340, width: 160, start: 2, flag: 153,
      pits: [[40, 42], [66, 69], [104, 107]],
      features: [
        { r: 10, c: 10, s: '=?=' },
        { r: 6, c: 14, s: 'ooooo' },
        { r: 10, c: 14, s: '=!=' },
        { r: 12, c: 22, s: 'g' }, { r: 12, c: 25, s: 'g' },
        { stair: { c: 30, h: 3, dir: 1 } },
        { r: 12, c: 36, s: 'k' },
        { r: 7, c: 44, s: '?===?' }, { r: 4, c: 45, s: 'oooo' },
        { pipe: { c: 52, h: 3 } },
        { r: 12, c: 58, s: 'g' }, { r: 12, c: 60, s: 'g' }, { r: 12, c: 62, s: 'g' },
        { r: 8, c: 60, s: '=?!?=' },
        { r: 5, c: 72, s: 'oooooo' },
        { r: 9, c: 74, s: '====' },
        { stair: { c: 82, h: 5, dir: 1 } },
        { stair: { c: 89, h: 5, dir: -1 } },
        { r: 12, c: 96, s: 'k' }, { r: 12, c: 99, s: 'g' },
        { r: 7, c: 110, s: '?=!=?' }, { r: 4, c: 112, s: 'ooo' },
        { pipe: { c: 118, h: 4 } },
        { r: 12, c: 124, s: 'g' }, { r: 12, c: 127, s: 'g' },
        { r: 8, c: 130, s: '===' }, { r: 5, c: 131, s: 'ooo' },
        { r: 12, c: 138, s: 'k' },
        { stair: { c: 144, h: 6, dir: 1 } },
      ],
    },
    {
      name: 'WORLD 1-3', time: 300, width: 150, start: 2, flag: 143,
      pits: [[30, 32], [50, 53], [74, 77], [100, 103], [120, 122]],
      features: [
        { r: 9, c: 8, s: '?=?' },
        { r: 12, c: 16, s: 'g' }, { r: 12, c: 19, s: 'g' },
        { r: 6, c: 24, s: 'ooooo' },
        { r: 9, c: 26, s: '=!=' },
        { r: 10, c: 36, s: '----' },     // floating platform
        { r: 6, c: 38, s: 'oooo' },
        { r: 12, c: 44, s: 'k' },
        { r: 8, c: 56, s: '?===?' }, { r: 5, c: 58, s: 'ooo' },
        { r: 11, c: 60, s: '---' },
        { pipe: { c: 64, h: 2 } },
        { r: 12, c: 82, s: 'g' }, { r: 12, c: 84, s: 'g' }, { r: 12, c: 86, s: 'g' },
        { r: 8, c: 84, s: '=?!?=' },
        { r: 10, c: 94, s: '-----' },
        { r: 6, c: 96, s: 'ooooo' },
        { r: 12, c: 110, s: 'k' }, { r: 12, c: 113, s: 'g' },
        { stair: { c: 108, h: 4, dir: 1 } },
        { r: 7, c: 128, s: '?=!=?' }, { r: 4, c: 130, s: 'ooo' },
        { stair: { c: 136, h: 6, dir: 1 } },
      ],
    },
  ];

  // ---------------------------------------------------------------
  // Level construction
  // ---------------------------------------------------------------
  function buildLevel(def) {
    const W = def.width, H = 15;
    const grid = [];
    for (let r = 0; r < H; r++) grid.push(new Array(W).fill(' '));

    // ground rows 13, 14
    const isPit = (c) => def.pits && def.pits.some(([a, b]) => c >= a && c <= b);
    for (let c = 0; c < W; c++) {
      if (!isPit(c)) { grid[13][c] = '#'; grid[14][c] = '#'; }
    }

    const put = (r, c, ch) => { if (r >= 0 && r < H && c >= 0 && c < W) grid[r][c] = ch; };

    (def.features || []).forEach((f) => {
      if (f.s) {
        for (let i = 0; i < f.s.length; i++) {
          const ch = f.s[i];
          if (ch !== ' ') put(f.r, f.c + i, ch);
        }
      } else if (f.pipe) {
        const { c, h } = f.pipe;
        for (let i = 0; i < h; i++) {
          put(GROUND_TOP - 1 - i, c, 'p');
          put(GROUND_TOP - 1 - i, c + 1, 'p');
        }
      } else if (f.stair) {
        const { c, h, dir } = f.stair;
        for (let i = 0; i < h; i++) {
          const col = c + (dir > 0 ? i : (h - 1 - i));
          for (let j = 0; j <= i; j++) put(GROUND_TOP - 1 - j, col, '-');
        }
      }
    });

    // Extract entities from grid
    const enemies = [], coins = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const ch = grid[r][c];
        if (ch === 'g') { enemies.push(makeGoomba(c * T, r * T)); grid[r][c] = ' '; }
        else if (ch === 'k') { enemies.push(makeKoopa(c * T, r * T)); grid[r][c] = ' '; }
        else if (ch === 'o') { coins.push({ x: c * T + 3, y: r * T + 2, w: T - 6, h: T - 4, t: Math.random() * 6, dead: false }); grid[r][c] = ' '; }
      }
    }

    return {
      name: def.name, time: def.time, w: W, h: H, grid,
      flagCol: def.flag, start: def.start,
      pxw: W * T, pxh: H * T,
      enemies, coins,
    };
  }

  // ---------------------------------------------------------------
  // Entities
  // ---------------------------------------------------------------
  function makeGoomba(x, y) {
    return { type: 'goomba', x: x + 2, y: y, w: T - 4, h: T - 2, vx: -55, vy: 0, dir: -1, onGround: false, dead: false, squashT: 0, anim: 0 };
  }
  function makeKoopa(x, y) {
    return { type: 'koopa', x: x + 2, y: y - T, w: T - 6, h: T * 2 - 6, vx: -50, vy: 0, dir: -1, onGround: false, dead: false, shell: false, shellMove: 0, anim: 0, wakeT: 0 };
  }

  // ---------------------------------------------------------------
  // Collision helpers
  // ---------------------------------------------------------------
  function isSolid(c, r) {
    if (c < 0) return true;
    if (c >= level.w) return true;
    if (r < 0) return false;
    if (r >= level.h) return false;
    return SOLIDS.has(level.grid[r][c]);
  }

  // Move entity with tile collision. Returns collision info.
  function moveAndCollide(e, dt) {
    const info = { left: false, right: false, up: false, down: false, bumpTile: null };

    // ----- X -----
    e.x += e.vx * dt;
    let top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 0.01) / T);
    if (e.vx > 0) {
      const col = Math.floor((e.x + e.w - 0.01) / T);
      for (let r = top; r <= bot; r++) if (isSolid(col, r)) { e.x = col * T - e.w; e.vx = 0; info.right = true; break; }
    } else if (e.vx < 0) {
      const col = Math.floor(e.x / T);
      for (let r = top; r <= bot; r++) if (isSolid(col, r)) { e.x = (col + 1) * T; e.vx = 0; info.left = true; break; }
    }

    // ----- Y -----
    e.onGround = false;
    e.y += e.vy * dt;
    let lft = Math.floor(e.x / T), rgt = Math.floor((e.x + e.w - 0.01) / T);
    if (e.vy > 0) {
      const row = Math.floor((e.y + e.h - 0.01) / T);
      for (let c = lft; c <= rgt; c++) if (isSolid(c, row)) { e.y = row * T - e.h; e.vy = 0; e.onGround = true; info.down = true; break; }
    } else if (e.vy < 0) {
      const row = Math.floor(e.y / T);
      for (let c = lft; c <= rgt; c++) if (isSolid(c, row)) {
        e.y = (row + 1) * T; e.vy = 0; info.up = true;
        // choose the tile most overlapped for head-bump
        info.bumpTile = { c: c, r: row };
        break;
      }
    }
    return info;
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------
  const Game = {
    state: 'title',   // title | play | pause | dead | levelclear | gameover | win
    levelIndex: 0,
    score: 0, coins: 0, lives: 3,
    time: 0,
    camX: 0,
    stateTimer: 0,
  };

  let level = null;
  let player = null;
  let particles = [];
  let fireballs = [];
  let floaters = [];   // score popups

  function newPlayer(keepPower) {
    const power = keepPower != null ? keepPower : 0;
    const big = power >= 1;
    return {
      x: level.start * T, y: (GROUND_TOP - (big ? 2 : 1)) * T,
      w: 18, h: big ? T * 2 - 4 : T - 2,
      vx: 0, vy: 0, dir: 1, onGround: false,
      power, invuln: 0, walkT: 0,
      coyote: 0, jumpBuf: 0, jumpHeld: false,
      dead: false, deadTimer: 0,
      winT: 0, ctrl: true,
    };
  }

  function loadLevel(idx, keepPower) {
    level = buildLevel(LEVELS[idx]);
    player = newPlayer(keepPower);
    Game.time = level.time;
    Game.camX = 0;
    particles = []; fireballs = []; floaters = [];
  }

  function startGame() {
    Game.levelIndex = 0;
    Game.score = 0; Game.coins = 0; Game.lives = 3;
    loadLevel(0, 0);
    Game.state = 'play';
    Audio.resume(); Audio.startMusic();
    hideAllOverlays();
  }

  function addScore(n, x, y) {
    Game.score += n;
    if (x != null) floaters.push({ x, y, t: 0, text: n >= 1000 ? '1UP' : ('' + n) });
  }

  function addCoin() {
    Game.coins++;
    addScore(200);
    if (Game.coins >= 100) { Game.coins = 0; Game.lives++; Audio.oneUp(); floaters.push({ x: player.x, y: player.y - 20, t: 0, text: '1UP' }); }
  }

  // ---------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------
  function update(dt) {
    if (Game.state === 'play') updatePlay(dt);
    else if (Game.state === 'dead') updateDead(dt);
    else if (Game.state === 'levelclear' || Game.state === 'win') {
      Game.stateTimer += dt;
    }
    // decay input edges consumed
  }

  function updatePlay(dt) {
    // timer
    Game.time -= dt * 2.4;
    if (Game.time <= 0 && !player.dead) { Game.time = 0; killPlayer(); }

    updatePlayer(dt);
    updateEnemies(dt);
    updateFireballs(dt);
    updateCoins(dt);
    updateParticles(dt);

    // camera follows player, never scrolls backward past view, clamps to level
    const target = player.x + player.w / 2 - VW * 0.42;
    Game.camX = Math.max(Game.camX, target);
    Game.camX = Math.max(0, Math.min(Game.camX, level.pxw - VW));

    // fell in pit
    if (player.y > level.pxh + 40 && !player.dead) killPlayer();

    // reach flag
    if (!player.dead && player.ctrl && player.x + player.w > level.flagCol * T) {
      triggerFlag();
    }
  }

  function updatePlayer(dt) {
    const p = player;
    if (!p.ctrl) { // flag/win animation
      moveAndCollide(p, dt);
      p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
      return;
    }

    const left = keys.left, right = keys.right, running = keys.run;
    const accel = running ? RUN_ACCEL : WALK_ACCEL;
    const maxSpd = running ? MAX_RUN : MAX_WALK;

    if (left && !right) { p.vx -= accel * dt; p.dir = -1; }
    else if (right && !left) { p.vx += accel * dt; p.dir = 1; }
    else {
      const fr = (p.onGround ? FRICTION : AIR_FRICTION) * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - fr);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + fr);
    }
    p.vx = Math.max(-maxSpd, Math.min(maxSpd, p.vx));

    // jump buffering + coyote time
    if (jumpEdge) p.jumpBuf = JUMP_BUFFER;
    p.jumpBuf -= dt; p.coyote -= dt;
    if (p.onGround) p.coyote = COYOTE;

    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -JUMP_VEL;
      p.onGround = false; p.jumpHeld = true;
      p.jumpBuf = 0; p.coyote = 0;
      Audio.jump();
    }
    // variable jump height
    if (keys.jump && p.jumpHeld && p.vy < 0) p.vy -= JUMP_HOLD * dt;
    if (!keys.jump) p.jumpHeld = false;

    // gravity
    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

    const info = moveAndCollide(p, dt);
    if (info.up && info.bumpTile) bumpBlock(info.bumpTile.c, info.bumpTile.r);
    if (info.up) p.jumpHeld = false;

    // animation
    if (Math.abs(p.vx) > 8 && p.onGround) p.walkT += dt * (0.6 + Math.abs(p.vx) / 90); else p.walkT = 0;
    if (p.invuln > 0) p.invuln -= dt;

    // fire
    if (fireEdge && p.power >= 2 && fireballs.filter(f => f.mine).length < 2) {
      fireballs.push({ mine: true, x: p.dir > 0 ? p.x + p.w : p.x - 10, y: p.y + 8, w: 10, h: 10, vx: 320 * p.dir, vy: 60, dead: false, bounces: 0, spin: 0 });
      Audio.fire();
    }
  }

  function bumpBlock(c, r) {
    const ch = level.grid[r][c];
    if (ch === '?' || ch === '!') {
      level.grid[r][c] = 'u';
      spawnBlockPop(c, r);
      if (ch === '?') {
        addCoin();
        floaters.push({ x: c * T + 4, y: r * T - 6, t: 0, text: '200' });
        Audio.coin();
      } else {
        // powerup: mushroom if small, flower if big/fire
        if (player.power === 0) spawnMushroom(c * T, (r - 1) * T);
        else spawnFlower(c * T, (r - 1) * T);
        Audio.bump();
      }
    } else if (ch === '=') {
      if (player.power >= 1) {
        level.grid[r][c] = ' ';
        spawnBrickDebris(c, r);
        addScore(50);
        Audio.brick();
      } else {
        Audio.bump();
        spawnBlockPop(c, r);
      }
    } else {
      Audio.bump();
    }
    // knock enemies standing above the block
    level.enemies.forEach((en) => {
      if (!en.dead && en.onGround) {
        const ecx = en.x + en.w / 2;
        if (ecx > c * T && ecx < (c + 1) * T && Math.abs((en.y + en.h) - r * T) < 6) {
          en.dead = true; en.vy = -240; en.flip = true; addScore(100);
        }
      }
    });
  }

  const powerups = [];
  function spawnMushroom(x, y) { powerups.push({ kind: 'mush', x: x + 2, y, w: T - 4, h: T - 2, vx: 60, vy: 0, onGround: false, rise: T, t: 0 }); Audio.power(); }
  function spawnFlower(x, y) { powerups.push({ kind: 'flower', x: x + 2, y, w: T - 4, h: T - 2, vx: 0, vy: 0, onGround: false, rise: T, t: 0 }); Audio.power(); }

  function updatePowerups(dt) {
    for (const pu of powerups) {
      if (pu.dead) continue;
      pu.t += dt;
      if (pu.rise > 0) { // emerge from block
        const d = Math.min(pu.rise, 40 * dt);
        pu.y -= d; pu.rise -= d;
      } else if (pu.kind === 'mush') {
        pu.vy = Math.min(pu.vy + GRAVITY * dt, MAX_FALL);
        const info = moveAndCollide(pu, dt);
        if (info.left || info.right) pu.vx *= -1;
      }
      if (pu.y > level.pxh + 40) pu.dead = true;
      if (aabb(pu, player)) {
        pu.dead = true;
        collectPower(pu.kind);
      }
    }
  }

  function collectPower(kind) {
    const p = player;
    const wasSmall = p.power === 0;
    if (kind === 'mush') p.power = Math.max(p.power, 1);
    else p.power = 2;
    // grow
    if (wasSmall) { p.h = T * 2 - 4; p.y -= (T - 2); }
    addScore(1000, p.x, p.y - 16);
    Audio.power();
  }

  function updateEnemies(dt) {
    updatePowerups(dt);
    for (const e of level.enemies) {
      if (e.dead) {
        e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);
        e.y += e.vy * dt;
        e.squashT += dt;
        continue;
      }
      // only wake when near camera
      if (e.x > Game.camX + VW + 60) continue;

      e.anim += dt;
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);

      if (e.type === 'koopa' && e.shell && e.shellMove === 0) {
        e.wakeT += dt;
        if (e.wakeT > 6) { e.shell = false; e.h = T * 2 - 6; e.y -= (T * 2 - 6) - (T - 6); e.vx = -50 * (e.dir); e.wakeT = 0; }
      }

      const speed = e.shell && e.shellMove ? 300 * e.shellMove : e.vx;
      if (e.shell && e.shellMove) e.vx = 300 * e.shellMove; else if (!e.shell) e.vx = Math.abs(e.vx || 55) * e.dir;
      const info = moveAndCollide(e, dt);
      if (info.left) { e.dir = 1; if (e.shell && e.shellMove) e.shellMove = 1; else e.vx = Math.abs(e.vx); }
      if (info.right) { e.dir = -1; if (e.shell && e.shellMove) e.shellMove = -1; else e.vx = -Math.abs(e.vx); }

      // moving shell kills other enemies
      if (e.shell && e.shellMove) {
        for (const o of level.enemies) {
          if (o !== e && !o.dead && aabb(e, o)) {
            o.dead = true; o.vy = -260; o.flip = true; addScore(200, o.x, o.y);
            Audio.kick();
          }
        }
      }

      if (e.y > level.pxh + 40) e.dead = true;

      // player interaction
      if (player.dead || !player.ctrl) continue;
      if (aabb(e, player)) handlePlayerEnemy(e);
    }
    // cull far dead
    level.enemies = level.enemies.filter((e) => !(e.dead && e.squashT > 2));
  }

  function handlePlayerEnemy(e) {
    const p = player;
    const stomping = p.vy > 0 && (p.y + p.h) - e.y < 16;

    if (e.type === 'goomba') {
      if (stomping) {
        e.dead = true; e.squashT = 0; e.squashed = true; e.vx = 0;
        setTimeout(() => {}, 0);
        e.h = 8; e.y += (T - 2) - 8;
        p.vy = -320; p.jumpHeld = keys.jump;
        addScore(100, e.x, e.y - 10);
        Audio.stomp();
      } else hurtPlayer();
    } else { // koopa
      if (e.shell) {
        if (e.shellMove === 0) {
          // kick it
          if (stomping) { p.vy = -300; }
          const kickDir = (p.x + p.w / 2 < e.x + e.w / 2) ? 1 : -1;
          e.shellMove = kickDir; e.dir = kickDir; e.wakeT = 0;
          addScore(200, e.x, e.y - 10);
          Audio.kick();
        } else {
          // moving shell — stomp to stop, else get hurt
          if (stomping) { e.shellMove = 0; e.wakeT = 0; e.vx = 0; p.vy = -300; Audio.stomp(); }
          else hurtPlayer();
        }
      } else {
        if (stomping) {
          e.shell = true; e.shellMove = 0; e.vx = 0; e.wakeT = 0;
          e.h = T - 6; e.y += (T * 2 - 6) - (T - 6);
          p.vy = -320;
          addScore(100, e.x, e.y - 10);
          Audio.stomp();
        } else hurtPlayer();
      }
    }
  }

  function hurtPlayer() {
    const p = player;
    if (p.invuln > 0) return;
    if (p.power >= 1) {
      p.power = 0; p.invuln = 1.6;
      p.h = T - 2; p.y += (T - 2);
      Audio.bump();
    } else {
      killPlayer();
    }
  }

  function killPlayer() {
    if (player.dead) return;
    player.dead = true; player.ctrl = false;
    player.vy = -430; player.vx = 0;
    Game.state = 'dead'; Game.stateTimer = 0;
    Audio.stopMusic(); Audio.die();
  }

  function updateDead(dt) {
    Game.stateTimer += dt;
    player.vy = Math.min(player.vy + GRAVITY * dt, MAX_FALL);
    player.y += player.vy * dt;
    if (Game.stateTimer > 2.2) {
      Game.lives--;
      if (Game.lives <= 0) {
        showMessage('GAME OVER', 'Final score: ' + Game.score, 'RETURN TO TITLE');
        Game.state = 'gameover';
      } else {
        loadLevel(Game.levelIndex, 0);
        Game.state = 'play';
        Audio.startMusic();
      }
    }
  }

  function updateFireballs(dt) {
    for (const f of fireballs) {
      if (f.dead) continue;
      f.spin += dt * 20;
      f.vy = Math.min(f.vy + GRAVITY * dt, 480);
      const info = moveAndCollide(f, dt);
      if (info.down) { f.vy = -260; f.bounces++; }
      if (info.left || info.right) f.dead = true;
      if (f.bounces > 6 || f.x < Game.camX - 40 || f.x > Game.camX + VW + 40) f.dead = true;
      for (const e of level.enemies) {
        if (!e.dead && aabb(f, e)) {
          e.dead = true; e.vy = -260; e.flip = true; f.dead = true;
          addScore(200, e.x, e.y - 10); Audio.kick();
          spawnPoof(f.x, f.y);
        }
      }
    }
    fireballs = fireballs.filter((f) => !f.dead);
  }

  function updateCoins(dt) {
    for (const co of level.coins) {
      if (co.dead) continue;
      co.t += dt * 6;
      if (aabb(co, player)) { co.dead = true; addCoin(); Audio.coin(); floaters.push({ x: co.x, y: co.y - 6, t: 0, text: '200' }); }
    }
  }

  // ----- Particles & floaters -----
  function spawnBlockPop(c, r) {
    particles.push({ kind: 'bump', x: c * T, y: r * T, t: 0, life: 0.18 });
  }
  function spawnBrickDebris(c, r) {
    for (let i = 0; i < 4; i++) {
      particles.push({ kind: 'shard', x: c * T + (i % 2) * 12 + 4, y: r * T + Math.floor(i / 2) * 12 + 2, vx: (i % 2 ? 80 : -80), vy: -220 - Math.random() * 60, t: 0, life: 1.1 });
    }
  }
  function spawnPoof(x, y) {
    for (let i = 0; i < 5; i++) particles.push({ kind: 'poof', x, y, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, t: 0, life: 0.4 });
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.t += dt;
      if (p.kind === 'shard' || p.kind === 'poof') {
        p.vy += GRAVITY * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
    }
    particles = particles.filter((p) => p.t < p.life);
    for (const f of floaters) { f.t += dt; f.y -= 26 * dt; }
    floaters = floaters.filter((f) => f.t < 1.0);
  }

  // ----- Flag / level clear -----
  function triggerFlag() {
    player.ctrl = false;
    player.vx = 0;
    player.x = level.flagCol * T - player.w + 6;
    Audio.stopMusic(); Audio.flag();
    // award time bonus
    const bonus = Math.floor(Game.time) * 50;
    Game.score += bonus;
    Game.state = 'levelclear'; Game.stateTimer = 0;
    setTimeout(() => {
      const last = Game.levelIndex >= LEVELS.length - 1;
      if (last) {
        Audio.win();
        showMessage('YOU WIN!', 'You cleared every world!  Score: ' + Game.score, 'PLAY AGAIN');
        Game.state = 'win';
      } else {
        showMessage('LEVEL COMPLETE', LEVELS[Game.levelIndex].name + ' cleared!  Time bonus: ' + bonus, 'NEXT LEVEL');
      }
    }, 1600);
  }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------
  function render() {
    // sky
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#5c94fc');
    g.addColorStop(1, '#8fb7ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    if (level) {
      drawParallax();
      ctx.save();
      ctx.translate(-Math.round(Game.camX), 0);
      drawTiles();
      drawCoins();
      drawPowerups();
      drawEnemies();
      drawFireballs();
      drawParticles();
      drawFlag();
      drawPlayer();
      drawFloaters();
      ctx.restore();
      drawHUD();
    }
  }

  function drawParallax() {
    const cx = Game.camX;
    // hills
    ctx.fillStyle = '#3ea24a';
    for (let i = 0; i < 20; i++) {
      const hx = (i * 260 - cx * 0.5) % (level.pxw + 300);
      const x = hx < -160 ? hx + level.pxw + 300 : hx;
      hill(x + 60, VH - T * 2, 70);
      hill(x + 200, VH - T * 2, 44);
    }
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    for (let i = 0; i < 24; i++) {
      const seed = i * 137.5;
      let cxp = (i * 190 - cx * 0.35) % (level.pxw + 400);
      if (cxp < -120) cxp += level.pxw + 400;
      const cyp = 40 + (seed % 90);
      cloud(cxp, cyp);
    }
    // bushes near ground
    ctx.fillStyle = '#2f8f3d';
    for (let i = 0; i < 30; i++) {
      let bx = (i * 150 - cx * 0.75) % (level.pxw + 200);
      if (bx < -80) bx += level.pxw + 200;
      bush(bx, VH - T * 2 - 6);
    }
  }
  function hill(x, baseY, r) {
    ctx.beginPath();
    ctx.moveTo(x - r, baseY);
    ctx.arc(x, baseY, r, Math.PI, 0);
    ctx.closePath(); ctx.fill();
  }
  function cloud(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, 7); ctx.arc(x + 16, y + 4, 18, 0, 7);
    ctx.arc(x + 36, y, 14, 0, 7); ctx.arc(x + 18, y - 6, 14, 0, 7);
    ctx.fill();
  }
  function bush(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 12, Math.PI, 0); ctx.arc(x + 14, y, 16, Math.PI, 0);
    ctx.arc(x + 30, y, 12, Math.PI, 0);
    ctx.rect(x - 12, y, 54, 12);
    ctx.fill();
  }

  function drawTiles() {
    const c0 = Math.max(0, Math.floor(Game.camX / T));
    const c1 = Math.min(level.w - 1, Math.ceil((Game.camX + VW) / T));
    for (let c = c0; c <= c1; c++) {
      for (let r = 0; r < level.h; r++) {
        const ch = level.grid[r][c];
        if (ch === ' ') continue;
        drawTile(ch, c, r);
      }
    }
  }

  function drawTile(ch, c, r) {
    const x = c * T, y = r * T;
    switch (ch) {
      case '#': {
        ctx.fillStyle = '#c76b28';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#e08e4a';
        ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#a5551d';
        ctx.fillRect(x + 4, y + T - 7, 6, 4); ctx.fillRect(x + T - 10, y + 6, 6, 4);
        if (!isSolid(c, r - 1)) { ctx.fillStyle = '#49b84f'; ctx.fillRect(x, y, T, 6); ctx.fillStyle = '#3ea24a'; ctx.fillRect(x, y + 5, T, 2); }
        break;
      }
      case '-': {
        ctx.fillStyle = '#9a9a9a'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#c4c4c4'; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#7a7a7a'; ctx.fillRect(x + 2, y + T - 5, T - 4, 3);
        break;
      }
      case '=': case 'q': {
        ctx.fillStyle = '#8a3b1e'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#c96a34'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.fillStyle = '#8a3b1e';
        ctx.fillRect(x, y + T / 2 - 1, T, 2);
        ctx.fillRect(x + T / 2 - 1, y, 2, T / 2); ctx.fillRect(x + T / 4 - 1, y + T / 2, 2, T / 2); ctx.fillRect(x + 3 * T / 4 - 1, y + T / 2, 2, T / 2);
        break;
      }
      case '?': case '!': {
        const pulse = 0.5 + 0.5 * Math.sin(time * 4 + c);
        ctx.fillStyle = ch === '!' ? '#e8b23a' : '#e8a33a';
        ctx.fillRect(x, y, T, T);
        ctx.fillStyle = `rgba(255,240,150,${0.35 + pulse * 0.35})`;
        ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#7a4a00';
        ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + T - 4, y + 2, 2, 2);
        ctx.fillRect(x + 2, y + T - 4, 2, 2); ctx.fillRect(x + T - 4, y + T - 4, 2, 2);
        ctx.fillStyle = '#7a4a00';
        ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('?', x + T / 2, y + T / 2 + 1);
        break;
      }
      case 'u': {
        ctx.fillStyle = '#a5642c'; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#c07d3e'; ctx.fillRect(x + 2, y + 2, T - 4, T - 4);
        ctx.fillStyle = '#7a4a1c';
        ctx.fillRect(x + 2, y + 2, 2, 2); ctx.fillRect(x + T - 4, y + 2, 2, 2);
        ctx.fillRect(x + 2, y + T - 4, 2, 2); ctx.fillRect(x + T - 4, y + T - 4, 2, 2);
        break;
      }
      case 'p': {
        const capTop = !isSolid(c, r - 1);
        const isLeft = isSolid(c + 1, r) && level.grid[r][c + 1] === 'p';
        ctx.fillStyle = '#2fa028';
        if (capTop) {
          ctx.fillRect(x - 2, y, T + 2, 8);
          ctx.fillStyle = '#4fd047'; ctx.fillRect(x - 2, y + 1, T + 2, 3);
          ctx.fillStyle = '#1f7a1e'; ctx.fillRect(x - 2, y + 7, T + 2, 1);
          ctx.fillStyle = '#2fa028'; ctx.fillRect(x + 2, y + 8, T - 4, T - 8);
          ctx.fillStyle = '#4fd047'; ctx.fillRect(x + 3, y + 8, 3, T - 8);
        } else {
          ctx.fillRect(x + 2, y, T - 4, T);
          ctx.fillStyle = '#4fd047'; ctx.fillRect(x + 3, y, 3, T);
          ctx.fillStyle = '#1f7a1e'; ctx.fillRect(x + T - 5, y, 3, T);
        }
        break;
      }
    }
  }

  function drawCoins() {
    for (const co of level.coins) {
      if (co.dead) continue;
      const w = Math.abs(Math.cos(co.t)) * (co.w) + 2;
      const cx = co.x + co.w / 2;
      ctx.fillStyle = '#f6c915';
      ctx.beginPath(); ctx.ellipse(cx, co.y + co.h / 2, w / 2, co.h / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe680';
      ctx.beginPath(); ctx.ellipse(cx, co.y + co.h / 2, w / 4, co.h / 2.6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, co.y + co.h / 2, w / 2, co.h / 2, 0, 0, 7); ctx.stroke();
    }
  }

  function drawPowerups() {
    for (const pu of powerups) {
      if (pu.dead) continue;
      const x = pu.x, y = pu.y, w = pu.w, h = pu.h;
      if (pu.kind === 'mush') {
        ctx.fillStyle = '#e23b2e';
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, Math.PI, 0); ctx.fill();
        ctx.fillRect(x, y + h / 2, w, h / 2);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + 6, y + 7, 3, 0, 7); ctx.arc(x + w - 6, y + 7, 3, 0, 7); ctx.arc(x + w / 2, y + 4, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#f4d9b0'; ctx.fillRect(x + 3, y + h / 2, w - 6, h / 2 - 2);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 6, y + h - 8, 2, 3); ctx.fillRect(x + w - 8, y + h - 8, 2, 3);
      } else {
        const t = pu.t * 6;
        ctx.fillStyle = ['#ff4d3d', '#ff9d3d', '#ffe23d', '#4dff6a'][Math.floor(t) % 4];
        ctx.beginPath(); ctx.arc(x + w / 2, y + 6, 6, 0, 7); ctx.fill();
        ctx.fillStyle = '#ffd23d';
        for (let i = 0; i < 4; i++) { const a = t + i * Math.PI / 2; ctx.beginPath(); ctx.ellipse(x + w / 2 + Math.cos(a) * 6, y + 6 + Math.sin(a) * 6, 4, 6, a, 0, 7); ctx.fill(); }
        ctx.fillStyle = '#2fa028'; ctx.fillRect(x + w / 2 - 2, y + 10, 4, h - 10);
      }
    }
  }

  function drawEnemies() {
    for (const e of level.enemies) {
      const x = e.x, y = e.y, w = e.w, h = e.h;
      if (e.type === 'goomba') {
        if (e.dead && e.squashed) {
          ctx.fillStyle = '#8a5a2b'; ctx.fillRect(x, y, w, h);
          continue;
        }
        ctx.save();
        if (e.dead && e.flip) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(1, -1); ctx.translate(-x - w / 2, -y - h / 2); }
        ctx.fillStyle = '#8a5a2b';
        ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, w / 2, Math.PI, 0); ctx.fill();
        ctx.fillRect(x, y + h / 2, w, h / 2 - 3);
        ctx.fillStyle = '#5a3a1b';
        const foot = Math.sin(e.anim * 8) > 0;
        ctx.fillRect(x + (foot ? 0 : 3), y + h - 4, 7, 4);
        ctx.fillRect(x + w - 7 - (foot ? 0 : 3), y + h - 4, 7, 4);
        ctx.fillStyle = '#fff'; ctx.fillRect(x + 3, y + 6, 4, 5); ctx.fillRect(x + w - 7, y + 6, 4, 5);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 5, y + 7, 2, 3); ctx.fillRect(x + w - 6, y + 7, 2, 3);
        ctx.restore();
      } else { // koopa
        ctx.save();
        if (e.dead && e.flip) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(1, -1); ctx.translate(-x - w / 2, -y - h / 2); }
        if (e.shell) {
          ctx.fillStyle = '#2fa028';
          ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#e5d16a';
          ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2 - 3, h / 2 - 3, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = '#1f7a1e'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + 3, y + h / 2); ctx.lineTo(x + w - 3, y + h / 2); ctx.stroke();
        } else {
          // body
          ctx.fillStyle = '#f4d06a'; ctx.fillRect(x + 1, y + h - 16, w - 2, 12);
          // shell
          ctx.fillStyle = '#2fa028';
          ctx.beginPath(); ctx.ellipse(x + w / 2, y + h - 18, w / 2, 12, 0, Math.PI, 0); ctx.fill();
          ctx.fillRect(x, y + h - 18, w, 8);
          // head
          ctx.fillStyle = '#4fd047';
          ctx.beginPath(); ctx.arc(x + w / 2 + (e.dir > 0 ? 3 : -3), y + 8, 7, 0, 7); ctx.fill();
          ctx.fillStyle = '#000'; ctx.fillRect(x + w / 2 + (e.dir > 0 ? 5 : -7), y + 5, 2, 3);
          // feet
          ctx.fillStyle = '#f4a03a';
          const foot = Math.sin(e.anim * 7) > 0;
          ctx.fillRect(x + (foot ? 1 : 4), y + h - 4, 7, 4);
          ctx.fillRect(x + w - 8 - (foot ? 1 : 4), y + h - 4, 7, 4);
        }
        ctx.restore();
      }
    }
  }

  function drawFireballs() {
    for (const f of fireballs) {
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
      ctx.rotate(f.spin);
      ctx.fillStyle = '#ff5a1e';
      ctx.beginPath(); ctx.arc(0, 0, f.w / 2, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.arc(0, 0, f.w / 4, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      if (p.kind === 'bump') {
        const o = -Math.sin((p.t / p.life) * Math.PI) * 10;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(p.x, p.y + o, T, T);
      } else if (p.kind === 'shard') {
        ctx.fillStyle = '#c96a34';
        ctx.fillRect(p.x, p.y, 8, 8);
        ctx.fillStyle = '#8a3b1e'; ctx.fillRect(p.x + 2, p.y + 2, 4, 4);
      } else if (p.kind === 'poof') {
        ctx.fillStyle = `rgba(255,200,120,${1 - p.t / p.life})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 7); ctx.fill();
      }
    }
  }

  function drawFloaters() {
    ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const f of floaters) {
      ctx.fillStyle = `rgba(255,255,255,${1 - f.t})`;
      ctx.fillText(f.text, f.x, f.y);
    }
  }

  function drawFlag() {
    const fx = level.flagCol * T;
    const topY = (GROUND_TOP - 9) * T;
    const botY = GROUND_TOP * T;
    // pole
    ctx.fillStyle = '#bdbdbd'; ctx.fillRect(fx + 2, topY, 4, botY - topY);
    ctx.fillStyle = '#2fa028'; ctx.beginPath(); ctx.arc(fx + 4, topY, 6, 0, 7); ctx.fill();
    // flag cloth
    let cloth = topY + 6;
    if (Game.state === 'levelclear') cloth = Math.min(botY - 30, topY + 6 + Game.stateTimer * 120);
    ctx.fillStyle = '#e52521';
    ctx.beginPath();
    ctx.moveTo(fx + 2, cloth); ctx.lineTo(fx - 26, cloth + 10); ctx.lineTo(fx + 2, cloth + 20);
    ctx.closePath(); ctx.fill();
    // castle
    const castX = fx + 60;
    ctx.fillStyle = '#c05a2a';
    ctx.fillRect(castX, botY - 72, 96, 72);
    ctx.fillStyle = '#8a3b1e';
    for (let i = 0; i < 5; i++) ctx.fillRect(castX + 4 + i * 20, botY - 80, 12, 10);
    ctx.fillStyle = '#3a1e0e';
    ctx.fillRect(castX + 38, botY - 34, 20, 34);
    ctx.beginPath(); ctx.arc(castX + 48, botY - 34, 10, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#8a3b1e';
    ctx.fillRect(castX + 20, botY - 60, 14, 14); ctx.fillRect(castX + 62, botY - 60, 14, 14);
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return; // blink
    drawMario(p.x, p.y, p.w, p.h, p.dir, p.power, p.walkT, !p.onGround, p.vx);
  }

  function drawMario(x, y, w, h, dir, power, walkT, jumping, vx) {
    ctx.save();
    if (dir < 0) { ctx.translate(x + w, 0); ctx.scale(-1, 1); ctx.translate(-x, 0); }

    const skin = '#ffb27a', hatShirt = power >= 2 ? '#ffffff' : '#e52521', overall = power >= 2 ? '#e52521' : '#2a63d6';
    const shoe = '#5a2d0c', hair = '#5a2d0c';
    const big = power >= 1;
    const step = Math.floor(walkT * 6) % 4;

    if (!big) {
      // --- small mario (18 x 22) ---
      // hat
      ctx.fillStyle = hatShirt; ctx.fillRect(x + 3, y, 12, 4); ctx.fillRect(x + 8, y - 2, 8, 2);
      // face
      ctx.fillStyle = skin; ctx.fillRect(x + 4, y + 4, 11, 6);
      ctx.fillStyle = hair; ctx.fillRect(x + 2, y + 4, 3, 5);
      ctx.fillStyle = '#000'; ctx.fillRect(x + 10, y + 5, 2, 3); // eye
      ctx.fillStyle = hair; ctx.fillRect(x + 11, y + 9, 4, 2); // mustache
      // body
      ctx.fillStyle = overall; ctx.fillRect(x + 3, y + 10, 12, 8);
      ctx.fillStyle = hatShirt; ctx.fillRect(x + 1, y + 10, 3, 5); ctx.fillRect(x + 14, y + 10, 3, 5); // arms
      // legs
      ctx.fillStyle = shoe;
      if (jumping) { ctx.fillRect(x + 2, y + 17, 6, 5); ctx.fillRect(x + 10, y + 17, 6, 5); }
      else if (Math.abs(vx) > 8) { const o = step % 2 ? 2 : -2; ctx.fillRect(x + 3 + o, y + 18, 6, 4); ctx.fillRect(x + 9 - o, y + 18, 6, 4); }
      else { ctx.fillRect(x + 3, y + 18, 5, 4); ctx.fillRect(x + 10, y + 18, 5, 4); }
    } else {
      // --- big mario (18 x 44) ---
      const midColor = power >= 2 ? '#e52521' : '#e52521'; // shirt/torso red
      // hat
      ctx.fillStyle = hatShirt; ctx.fillRect(x + 3, y, 14, 5); ctx.fillRect(x + 9, y - 2, 8, 2);
      // face
      ctx.fillStyle = skin; ctx.fillRect(x + 4, y + 5, 12, 8);
      ctx.fillStyle = hair; ctx.fillRect(x + 2, y + 6, 3, 6);
      ctx.fillStyle = '#000'; ctx.fillRect(x + 11, y + 7, 2, 3);
      ctx.fillStyle = hair; ctx.fillRect(x + 11, y + 11, 5, 2);
      // shirt / torso
      ctx.fillStyle = hatShirt; ctx.fillRect(x + 3, y + 13, 14, 10);
      ctx.fillStyle = skin; ctx.fillRect(x, y + 15, 4, 7); ctx.fillRect(x + 15, y + 15, 4, 7); // hands
      // overalls
      ctx.fillStyle = overall; ctx.fillRect(x + 3, y + 21, 14, 14);
      ctx.fillStyle = '#f6c915'; ctx.fillRect(x + 6, y + 23, 2, 2); ctx.fillRect(x + 12, y + 23, 2, 2); // buttons
      ctx.fillStyle = overall; ctx.fillRect(x + 4, y + 16, 3, 6); ctx.fillRect(x + 13, y + 16, 3, 6); // straps
      // legs
      ctx.fillStyle = overall;
      if (jumping) { ctx.fillRect(x + 2, y + 33, 7, 7); ctx.fillRect(x + 11, y + 31, 6, 6); }
      else if (Math.abs(vx) > 8) { const o = step % 2 ? 3 : -3; ctx.fillRect(x + 3 + o, y + 34, 6, 6); ctx.fillRect(x + 9 - o, y + 34, 6, 6); }
      else { ctx.fillRect(x + 3, y + 34, 6, 6); ctx.fillRect(x + 10, y + 34, 6, 6); }
      // shoes
      ctx.fillStyle = shoe;
      ctx.fillRect(x + 2, y + h - 4, 7, 4); ctx.fillRect(x + 10, y + h - 4, 7, 4);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------
  function drawHUD() {
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.font = 'bold 15px monospace';
    const y = 12;
    // subtle top shade
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, VW, 34);
    label('MARIO', 20, y); value(pad(Game.score, 6), 20, y + 15);
    // coins
    ctx.fillStyle = '#f6c915'; ctx.beginPath(); ctx.arc(210, y + 6, 6, 0, 7); ctx.fill();
    label('x' + pad(Game.coins, 2), 222, y);
    // world
    label('WORLD', 330, y); value(level.name.replace('WORLD ', ''), 336, y + 15);
    // time
    label('TIME', 470, y); value(pad(Math.max(0, Math.ceil(Game.time)), 3), 476, y + 15);
    // lives
    label('x' + Game.lives, 560, y);
    ctx.fillStyle = '#e52521'; ctx.fillRect(544, y + 1, 10, 4);
    ctx.fillStyle = '#ffb27a'; ctx.fillRect(546, y + 5, 6, 4);
    // mute indicator
    if (Audio.muted) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.fillText('🔇', 600, y + 4); }
  }
  function label(t, x, y) { ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.fillText(t, x, y); }
  function value(t, x, y) { ctx.fillStyle = '#ffe680'; ctx.font = 'bold 15px monospace'; ctx.fillText(t, x, y); }
  function pad(n, w) { let s = '' + n; while (s.length < w) s = '0' + s; return s; }

  // ---------------------------------------------------------------
  // Overlays / UI
  // ---------------------------------------------------------------
  const ovTitle = document.getElementById('overlay-title');
  const ovPause = document.getElementById('overlay-pause');
  const ovMsg = document.getElementById('overlay-message');

  function hideAllOverlays() { [ovTitle, ovPause, ovMsg].forEach((o) => o.classList.add('hidden')); }
  function showMessage(title, sub, btn) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-sub').textContent = sub || '';
    document.getElementById('btn-next').textContent = btn || 'CONTINUE';
    ovMsg.classList.remove('hidden');
  }

  function togglePause() {
    if (Game.state === 'play') { Game.state = 'pause'; ovPause.classList.remove('hidden'); Audio.stopMusic(); }
    else if (Game.state === 'pause') { Game.state = 'play'; ovPause.classList.add('hidden'); Audio.startMusic(); }
  }
  function toggleMute() { const m = Audio.toggleMute(); }

  document.getElementById('btn-start').addEventListener('click', () => { Audio.resume(); startGame(); });
  document.getElementById('btn-resume').addEventListener('click', togglePause);
  document.getElementById('btn-restart-pause').addEventListener('click', () => {
    ovPause.classList.add('hidden'); loadLevel(Game.levelIndex, 0); Game.state = 'play'; Audio.startMusic();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    ovMsg.classList.add('hidden');
    if (Game.state === 'gameover' || Game.state === 'win') {
      ovTitle.classList.remove('hidden'); Game.state = 'title';
    } else {
      // next level
      Game.levelIndex++;
      loadLevel(Game.levelIndex, player.power);
      Game.state = 'play'; Audio.startMusic();
    }
  });

  // ---------------------------------------------------------------
  // Main loop (fixed timestep)
  // ---------------------------------------------------------------
  let time = 0;
  let last = performance.now(), acc = 0;
  const STEP = 1000 / 60;

  function frame(now) {
    let delta = now - last; last = now;
    if (delta > 250) delta = 250;
    acc += delta;
    while (acc >= STEP) {
      const dt = STEP / 1000;
      time += dt;
      // consume input edges for this tick
      fireEdge = (keys.run && !runWasDown);
      runWasDown = keys.run;
      update(dt);
      jumpEdge = false;
      acc -= STEP;
    }
    Audio.pump();
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

})();
