/* ══════════════════════════════════════════════════════════
   game.js — the run: loop, collisions, power-ups, scoring
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const C = SS.C;
  const { clamp, lerp, damp, css, mix, hex, TAU } = U;

  const DIFF = {
    chill: { max: 66, ramp: 4200, dens: 0.8 },
    normal: { max: 84, ramp: 3200, dens: 1.0 },
    brutal: { max: 104, ramp: 2300, dens: 1.25 },
  };

  const PU_META = {
    magnet: { icon: '🧲', label: 'MAGNET', color: '#ff3d94' },
    jetpack: { icon: '🚀', label: 'JETPACK', color: '#22e6ff' },
    sneakers: { icon: '👟', label: 'SNEAKERS', color: '#7dff8a' },
    x2: { icon: '✖', label: '2× SCORE', color: '#ffce3d' },
    warp: { icon: '⏳', label: 'TIME WARP', color: '#9a6bff' },
  };

  const G = {
    state: 'menu',
    travel: 0, speed: 32, distance: 0, score: 0, coins: 0,
    multiplier: 1, topMult: 1,
    combo: 0, comboT: 0, comboBest: 0, nearTotal: 0,
    time: 0, timeScale: 1, targetScale: 1,
    tod: 0.12, weather: 0, weatherNext: 900,
    shakeX: 0, shakeY: 0, shake: 0,
    fov: 1, pitch: 0,
    pu: { magnet: 0, jetpack: 0, sneakers: 0, x2: 0, warp: 0 },
    puMax: { magnet: 1, jetpack: 1, sneakers: 1, x2: 1, warp: 1 },
    revives: 0,
    chase: 1,
    run: null,
    countdown: 0,
    last: 0,
    warnT: 0,
    boardUsedThisRun: 0,

    init() {
      this.reset();
      requestAnimationFrame((t) => this.frame(t));
    },

    cfg() { return DIFF[SS.Save.data.opt.diff] || DIFF.normal; },
    charDef() { return SS.charById(SS.Save.data.char); },
    powerMul() { return this.charDef().perk === 'power' ? 1.3 : 1; },

    reset() {
      const d = SS.Save.data;
      const head = SS.UP.headStart(d.up.headstart || 0);
      this.travel = 0;
      this.distance = head;
      this.speed = 32 + (head > 0 ? 14 : 0);
      this.score = 0; this.coins = 0;
      this.multiplier = 1; this.topMult = 1;
      this.combo = 0; this.comboT = 0; this.comboBest = 0; this.nearTotal = 0;
      this.timeScale = 1; this.targetScale = 1;
      this.tod = Math.random();
      this.weather = 0; this.weatherNext = 700;
      this.shake = 0; this.shakeX = this.shakeY = 0;
      this.fov = 1; this.pitch = 0;
      for (const k in this.pu) this.pu[k] = 0;
      this.revives = 0;
      this.chase = 1;
      this.warnT = 0;
      this.boardUsedThisRun = 0;
      this.run = {
        coins: 0, jumps: 0, rolls: 0, powerups: 0, magnet: 0, jetpack: 0,
        trainTime: 0, boards: 0, laneChanges: 0, ramps: 0, distTick: 0,
      };
      SS.World.reset();
      SS.FX.clear();
      SS.Player.reset(this.charDef());
      if (head > 0) {
        // fast-forward the generator so the head start feels earned
        SS.World.genZ = 90;
      }
    },

    /* ── lifecycle ─────────────────────────────────────── */
    start() {
      SS.Audio.resume();
      this.reset();
      const d = SS.Save.data;
      if (this.charDef().perk === 'board') {
        SS.Player.board = true;
        SS.Player.boardT = 30;
      }
      this.state = 'countdown';
      this.countdown = 3.1;
      SS.UI.show(null);
      SS.UI.hud(this);
      SS.UI.combo(0);
      SS.UI.powerups([]);
      SS.Audio.startMusic();
      SS.Audio.setIntensity(0.15);
      SS.Input.clear();
    },

    toMenu() {
      this.state = 'menu';
      SS.Audio.stopMusic();
      SS.UI.show('title');
      SS.UI.updateTitle();
      SS.UI.combo(0);
      SS.UI.warn(false);
      SS.UI.powerups([]);
    },

    pause() {
      if (this.state !== 'playing') return;
      this.state = 'paused';
      SS.UI.el['p-score'].textContent = U.fmt(this.score);
      SS.UI.el['p-dist'].textContent = U.fmt(this.distance) + ' m';
      SS.UI.el['p-coins'].textContent = U.fmt(this.coins);
      SS.UI.show('pause');
      SS.Audio.duck(0.6, 99);
    },

    resume() {
      if (this.state !== 'paused') return;
      SS.UI.show(null);
      this.state = 'countdown';
      this.countdown = 2.1;
      SS.Audio.resume();
      SS.Audio.duck(0, 0.2);
      SS.Input.clear();
    },

    useBoard() {
      if (this.state !== 'playing') return;
      const d = SS.Save.data;
      if (SS.Player.board) return;
      if (d.hoverboards <= 0) { SS.Audio.play('deny'); SS.UI.toast('NO BOARDS LEFT', 'pink'); return; }
      d.hoverboards--;
      SS.Save.save();
      SS.Player.board = true;
      SS.Player.boardT = 30;
      this.run.boards++;
      this.mission('boards', 1);
      SS.Audio.play('board');
      SS.UI.toast('HOVERBOARD', 'cyan');
      SS.FX.ring(SS.Player.x, SS.Player.y + 0.4, 0, [154, 107, 255]);
    },

    reviveCost() { return 200 * Math.pow(2, this.revives); },

    revive() {
      const cost = this.reviveCost();
      if (this.revives >= 2 || !SS.Save.spend(cost)) { SS.Audio.play('deny'); return; }
      this.revives++;
      /* clear the road ahead */
      const obs = SS.World.obstacles;
      for (let i = obs.length - 1; i >= 0; i--) {
        const rz = obs[i].z - this.travel;
        if (rz < 75 && rz + obs[i].l > -12) obs.splice(i, 1);
      }
      const P = SS.Player;
      P.dead = false; P.deathT = 0; P.deathSpin = 0;
      P.y = 0; P.vy = 0; P.lane = 1; P.x = 0; P.state = 'run';
      P.onGround = true; P.invuln = 3.2;
      this.speed = Math.max(30, this.speed * 0.72);
      this.chase = 1;
      this.timeScale = 1; this.targetScale = 1;
      SS.Audio.play('revive');
      SS.Audio.startMusic();
      SS.FX.confetti(0, 1.5, 0, 30);
      SS.UI.show(null);
      SS.UI.flash('#22e6ff', 0.5, 400);
      this.state = 'countdown';
      this.countdown = 2.1;
      SS.Input.clear();
    },

    die() {
      if (this.state !== 'playing') return;
      const P = SS.Player;
      P.die();
      this.state = 'dying';
      this.deathTimer = 0;
      this.targetScale = 0.28;
      this.shake = 1.4;
      this.chase = 1;
      SS.Audio.play('crash');
      SS.Audio.duck(0.85, 2.2);
      SS.UI.flash('#ff3355', 0.55, 500);
      SS.FX.sparks(P.x, P.y + 0.9, 0, [255, 120, 90], 34, 1.7);
      SS.FX.smoke(P.x, P.y + 0.6, 0, [200, 210, 230], 10);
      SS.UI.combo(0);
      SS.UI.warn(false);
    },

    finish() {
      const d = SS.Save.data;
      const M = SS.Missions;
      this.state = 'over';
      SS.Audio.stopMusic();

      /* best-of-run missions */
      this.mission('runDistance', Math.floor(this.distance));
      this.mission('score', Math.floor(this.score));
      this.mission('topMult', this.topMult);
      this.mission('nearChain', this.comboBest);

      /* bank coins (Nova's cut included) */
      let banked = this.coins;
      if (this.charDef().perk === 'coin') banked = Math.floor(banked * 1.15);
      SS.Save.addCoins(banked);

      const newBest = this.score > d.best;
      d.best = Math.max(d.best, Math.floor(this.score));
      d.bestDistance = Math.max(d.bestDistance, Math.floor(this.distance));
      d.runs++;
      d.totalDistance += Math.floor(this.distance);
      M.persist(d);
      SS.Save.save();

      SS.UI.gameOver(this, newBest);
      SS.UI.updateTitle();
    },

    /* ── missions helper ── */
    mission(key, amount) {
      const done = SS.Missions.track(key, amount);
      for (const m of done) {
        SS.UI.toast('MISSION: ' + m.text, 'lime');
        SS.Audio.play('mission');
        SS.FX.confetti(SS.Player.x, SS.Player.y + 1.4, 0, 18);
      }
      if (done.length && SS.Missions.allDone()) {
        const set = SS.Missions.advance();
        SS.UI.toast('SET CLEARED — BASE MULTIPLIER x' + (1 + set), 'gold');
        SS.Audio.play('power');
        SS.Missions.persist(SS.Save.data);
        SS.Save.save();
      }
    },

    /* ── input ─────────────────────────────────────────── */
    handleInput() {
      const acts = SS.Input.drain();
      const P = SS.Player;
      for (let i = 0; i < acts.length; i++) {
        const a = acts[i];
        if (a === 'mute') {
          const o = SS.Save.data.opt;
          o.music = o.sfx = !(o.music || o.sfx);
          SS.Audio.setMusic(o.music); SS.Audio.setSfx(o.sfx);
          SS.Save.save(); SS.UI.syncSettings();
          SS.UI.toast(o.music ? 'SOUND ON' : 'MUTED', 'cyan');
          continue;
        }
        if (a === 'blur') { if (this.state === 'playing') this.pause(); continue; }
        if (a === 'pause') {
          if (this.state === 'playing') this.pause();
          else if (this.state === 'paused') this.resume();
          else if (this.state === 'over' || this.state === 'menu') { /* stay */ }
          continue;
        }
        if (this.state === 'menu' && (a === 'jump' || a === 'confirm')) { this.start(); continue; }
        if (this.state === 'over' && (a === 'jump' || a === 'confirm')) { this.start(); continue; }
        if (this.state === 'paused' && (a === 'jump' || a === 'confirm')) { this.resume(); continue; }
        if (this.state !== 'playing' && this.state !== 'countdown') continue;

        switch (a) {
          case 'left': P.moveLane(-1); break;
          case 'right': P.moveLane(1); break;
          case 'jump': P.jump(); break;
          case 'roll': P.roll(); break;
          case 'board': this.useBoard(); break;
        }
      }
    },

    /* ── main loop ─────────────────────────────────────── */
    frame(ts) {
      requestAnimationFrame((t) => this.frame(t));
      if (!this.last) this.last = ts;
      let raw = (ts - this.last) / 1000;
      this.last = ts;
      if (raw > 0.05) raw = 0.05;          // clamp after a tab stall
      if (raw <= 0) raw = 1 / 60;

      this.handleInput();

      const active = this.state === 'playing' || this.state === 'dying' || this.state === 'countdown';
      if (active) this.update(raw);
      else { this.time += raw; if (this.state === 'menu') this.attract(raw); }

      // Pause / game-over sit behind a blurred overlay: the frame underneath
      // is frozen anyway, so stop repainting it.
      if (this.state === 'paused' || this.state === 'over') return;
      this.render(raw);
    },

    /** Menu backdrop: the yard keeps rolling by with nobody on it. */
    attract(raw) {
      const dz = 26 * raw;
      this.travel += dz;
      this.tod = (this.tod + raw * 0.008) % 1;
      SS.World.update(raw, this.travel, 0.35);
      SS.FX.update(raw, dz);
      this.shake = 0; this.shakeX = this.shakeY = 0;
      this.fov = 1; this.pitch = 0;
    },

    update(raw) {
      const P = SS.Player;
      const cfg = this.cfg();

      /* countdown gate */
      if (this.state === 'countdown') {
        this.countdown -= raw;
        const n = Math.ceil(this.countdown - 0.1);
        SS.UI.countdown(n <= 0 ? 'GO' : n);
        if (this.countdown <= 0) {
          this.state = 'playing';
          SS.UI.countdown(null);
        }
        this.time += raw;
        this.renderPrepOnly = true;
        return;
      }
      SS.UI.countdown(null);

      /* time scaling: warp power-up + death slow-mo */
      this.targetScale = this.state === 'dying' ? 0.3 : (this.pu.warp > 0 ? 0.55 : 1);
      this.timeScale = damp(this.timeScale, this.targetScale, 7, raw);
      const dt = raw * this.timeScale;
      this.time += dt;

      if (this.state === 'dying') {
        this.deathTimer += raw;
        P.update(dt, SS.World, this.speed);
        this.speed = damp(this.speed, 0, 2.2, raw);
        this.travel += this.speed * dt;
        this.chase = Math.min(1, this.chase + raw * 2);
        SS.FX.update(dt, this.speed * dt);
        this.updateCamera(raw);
        if (this.deathTimer > 1.35) this.finish();
        return;
      }

      /* ── speed & difficulty ── */
      const t = clamp(this.distance / cfg.ramp, 0, 1);
      const target = lerp(32, cfg.max, U.easeOutCubic(t));
      this.speed = damp(this.speed, target, 0.55, raw);
      const diff = t;

      const dz = this.speed * dt;
      this.travel += dz;
      this.distance += this.speed * raw;      // warp shouldn't cost you metres

      /* day/night + weather */
      this.tod = (this.tod + raw * 0.0042) % 1;
      this.weatherNext -= this.speed * raw;
      if (this.weatherNext <= 0) {
        this.weatherNext = U.rand(700, 1600);
        this.weather = U.chance(0.34) ? 1 : 0;
        if (this.weather) SS.UI.toast('RAIN INBOUND', 'cyan');
      }

      /* ── world ── */
      SS.World.update(dt, this.travel, diff * cfg.dens);
      P.update(dt, SS.World, this.speed);

      /* power-up timers */
      for (const k in this.pu) {
        if (this.pu[k] > 0) {
          this.pu[k] -= raw;
          if (this.pu[k] <= 0) {
            this.pu[k] = 0;
            if (k === 'jetpack') { P.jet = false; P.vy = 0; P.onGround = false; P.state = 'air'; }
            if (k === 'warp') SS.Audio.play('slow');
            SS.UI.toast(PU_META[k].label + ' OVER', 'cyan');
          }
        }
      }
      if (this.pu.sneakers > 0) P.sneak = this.pu.sneakers;

      /* combo decay */
      if (this.comboT > 0) {
        this.comboT -= raw;
        if (this.comboT <= 0 && this.combo > 0) { this.combo = 0; SS.UI.combo(0); }
      }

      this.collide(dt);
      this.collectibles(dt);

      /* ── multiplier & score ── */
      const base = 1 + SS.Missions.bonus() + (this.charDef().perk === 'mult' ? 1 : 0);
      const distBonus = Math.min(8, Math.floor(this.distance / 450));
      const comboBonus = Math.min(6, Math.floor(this.combo / 3));
      let m = base + distBonus + comboBonus;
      if (this.pu.x2 > 0) m *= 2;
      this.multiplier = m;
      this.topMult = Math.max(this.topMult, m);
      this.score += this.speed * raw * 0.55 * m;

      /* riding a train roof */
      if (P.onGround && P.support > 1) this.run.trainTime += raw;

      /* mission counters that tick */
      const distTicks = Math.floor(this.distance / 10) - this.run.distTick;
      if (distTicks > 0) { this.run.distTick += distTicks; this.mission('distance', distTicks * 10); }
      if (P.jumps > this.run.jumps) { this.mission('jumps', P.jumps - this.run.jumps); this.run.jumps = P.jumps; }
      if (P.rolls > this.run.rolls) { this.mission('rolls', P.rolls - this.run.rolls); this.run.rolls = P.rolls; }
      if (P.laneChanges > this.run.laneChanges) {
        this.mission('laneChanges', P.laneChanges - this.run.laneChanges);
        this.run.laneChanges = P.laneChanges;
      }
      if (Math.floor(this.run.trainTime) > (this.run.trainTicks || 0)) {
        const n = Math.floor(this.run.trainTime) - (this.run.trainTicks || 0);
        this.run.trainTicks = Math.floor(this.run.trainTime);
        this.mission('trainTime', n);
      }

      /* oncoming-train warning */
      let warn = false;
      const obs = SS.World.obstacles;
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        if (!o.moving) continue;
        const rz = o.z - this.travel;
        if (rz > 0 && rz < 105 && Math.abs(o.x - P.x) < 2.0) { warn = true; break; }
      }
      SS.UI.warn(warn);
      if (warn) {
        this.warnT -= raw;
        if (this.warnT <= 0) { this.warnT = 0.55; SS.Audio.play('warn'); }
      }

      /* chase pressure */
      this.chase = damp(this.chase, 0, 0.8, raw);

      /* weather particles */
      if (this.weather && SS.R.quality !== 'low') SS.FX.rain();

      SS.FX.update(dt, dz);
      this.updateCamera(raw);

      SS.Audio.setIntensity(clamp((this.speed - 32) / 52, 0, 1));
      SS.UI.hud(this);
      this.syncPowerHud();
    },

    updateCamera(raw) {
      const P = SS.Player;
      this.shake = Math.max(0, this.shake - raw * 2.6);
      const amp = SS.Save.data.opt.shake ? this.shake * 22 : 0;
      this.shakeX = (Math.random() - 0.5) * amp;
      this.shakeY = (Math.random() - 0.5) * amp;
      const boost = clamp((this.speed - 40) / 70, 0, 1);
      this.fov = damp(this.fov, 1 - boost * 0.09 - (this.pu.warp > 0 ? -0.05 : 0), 4, raw);
      this.pitch = damp(this.pitch, boost * 14, 3, raw);
    },

    syncPowerHud() {
      const list = [];
      for (const k in this.pu) {
        if (this.pu[k] > 0) {
          const meta = PU_META[k];
          list.push({ id: k, icon: meta.icon, label: meta.label, color: meta.color, t: clamp(this.pu[k] / this.puMax[k], 0, 1) });
        }
      }
      SS.UI.powerups(list);
    },

    /* ── collisions ────────────────────────────────────── */
    collide(dt) {
      const P = SS.Player;
      if (P.dead) return;
      const obs = SS.World.obstacles;
      const pz0 = -0.72, pz1 = 0.72;
      const py0 = P.y, py1 = P.y + P.bodyH;
      const flying = P.jet;

      for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        const rz = o.z - this.travel;

        /* near-miss bookkeeping once an obstacle is fully behind */
        if (!o.passed && rz + o.l < -0.4) {
          o.passed = true;
          const dx = Math.abs(P.x - o.x);
          const gap = P.halfW + o.w / 2;
          if (!flying && dx < gap + 1.85) {
            const clean = dx < gap;   // we were in its lane and survived it
            this.nearMiss(clean ? 2 : 1, o);
          }
        }

        if (flying) continue;
        if (rz > pz1 || rz + o.l < pz0) continue;
        if (Math.abs(P.x - o.x) > P.halfW + o.w / 2 - 0.14) continue;

        /* ramps launch instead of hurting */
        if (o.launch) {
          if (!o.used && P.y < o.h + 0.4) {
            o.used = true;
            P.launch(26);
            this.run.ramps++;
            this.mission('ramps', 1);
            this.shake = Math.max(this.shake, 0.35);
            SS.UI.toast('LAUNCH!', 'cyan');
          }
          continue;
        }

        const oy0 = o.y, oy1 = o.y + o.h;
        if (py0 >= oy1 - 0.16) continue;          // above it
        if (py1 <= oy0 + 0.14) continue;          // under it
        if (P.invuln > 0) continue;

        /* hit */
        if (P.board) {
          P.board = false;
          P.invuln = 1.5;
          this.shake = Math.max(this.shake, 0.9);
          SS.Audio.play('crash');
          SS.UI.flash('#9a6bff', 0.4, 350);
          SS.UI.toast('BOARD WRECKED', 'pink');
          SS.FX.sparks(P.x, P.y + 0.4, 0, [154, 107, 255], 26, 1.4);
          this.combo = 0; SS.UI.combo(0);
          /* shove the runner clear so they don't instantly re-hit */
          if (o.kind === 'train' || o.h > 2) {
            const free = [0, 1, 2].filter((l) => Math.abs(C.LANES[l] - o.x) > 1.5);
            if (free.length) P.lane = free.reduce((a, b) =>
              Math.abs(C.LANES[a] - P.x) < Math.abs(C.LANES[b] - P.x) ? a : b);
          }
          continue;
        }
        this.die();
        return;
      }
    },

    nearMiss(weight, o) {
      this.combo += 1;
      this.comboT = 2.6;
      this.comboBest = Math.max(this.comboBest, this.combo);
      this.nearTotal++;
      this.score += 25 * weight * this.multiplier;
      this.mission('near', 1);
      SS.UI.combo(this.combo);
      SS.Audio.play('nearmiss', this.combo);
      if (this.combo > 0 && this.combo % 5 === 0) {
        SS.UI.toast(this.combo + '× CHAIN  +' + U.fmt(100 * this.multiplier), 'pink');
        this.score += 100 * this.multiplier;
        SS.FX.ring(SS.Player.x, SS.Player.y + 0.9, 0, [255, 61, 148]);
      }
    },

    /* ── coins & pickups ───────────────────────────────── */
    collectibles(dt) {
      const P = SS.Player;
      const W = SS.World;
      const magnet = this.pu.magnet > 0;
      const radius = magnet ? SS.UP.magnetRadius(SS.Save.data.up.magnet || 0) : 0;
      const px = P.x, py = P.y + P.bodyH * 0.5;

      const coins = W.coins;
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i];
        if (c.taken) continue;
        const rz = c.z - this.travel;
        if (rz > (magnet ? radius + 4 : 3)) continue;
        if (rz < -3) continue;

        if (magnet && rz > -1) {
          const d = Math.hypot(c.x - px, c.y - py, rz);
          if (d < radius) {
            const k = Math.min(1, dt * (7 + 26 / Math.max(d, 0.6)));
            c.x += (px - c.x) * k;
            c.y += (py - c.y) * k;
            c.z += (this.travel - c.z) * k;
          }
        }

        const nz = c.z - this.travel;
        if (Math.abs(nz) < 1.1 && Math.abs(c.x - px) < 0.95 && Math.abs(c.y - py) < 1.25) {
          c.taken = true;
          this.coins++;
          this.run.coins++;
          this.score += 12 * this.multiplier;
          this.mission('coins', 1);
          SS.Audio.play('coin', this.coinStreak = (this.coinStreak || 0) + 1);
          this.coinStreakT = 0.9;
          SS.FX.coinBurst(c.x, c.y, nz);
        }
      }
      if (this.coinStreakT > 0) {
        this.coinStreakT -= dt;
        if (this.coinStreakT <= 0) this.coinStreak = 0;
      }

      const pus = W.pickups;
      for (let i = 0; i < pus.length; i++) {
        const p = pus[i];
        if (p.taken) continue;
        const rz = p.z - this.travel;
        if (rz > 2.4 || rz < -2.4) continue;
        if (Math.abs(p.x - px) > 1.3) continue;
        if (Math.abs(p.y - py) > 2.2 && !P.jet) continue;
        p.taken = true;
        this.grab(p.type);
      }
    },

    grab(type) {
      const up = SS.Save.data.up;
      const mul = this.powerMul();
      const P = SS.Player;
      let dur = 8;
      switch (type) {
        case 'magnet': dur = SS.UP.magnetTime(up.magnet || 0) * mul; this.mission('magnet', 1); break;
        case 'jetpack':
          dur = SS.UP.jetTime(up.jetpack || 0) * mul;
          P.jet = true; P.state = 'air'; P.onGround = false;
          this.mission('jetpack', 1);
          break;
        case 'sneakers': dur = SS.UP.sneakTime(up.sneakers || 0) * mul; break;
        case 'x2': dur = SS.UP.x2Time(up.multi || 0) * mul; break;
        case 'warp': dur = SS.UP.warpTime(up.warp || 0) * mul; SS.Audio.play('slow'); break;
      }
      this.pu[type] = dur;
      this.puMax[type] = dur;
      this.run.powerups++;
      this.mission('powerups', 1);
      SS.Audio.play('power');
      SS.UI.toast(PU_META[type].label + '!', 'gold');
      SS.UI.flash(PU_META[type].color, 0.22, 300);
      SS.FX.ring(P.x, P.y + 0.9, 0, U.hex(PU_META[type].color));
      SS.FX.sparks(P.x, P.y + 0.9, 0, U.hex(PU_META[type].color), 22, 1.2);
    },

    /* ── render ────────────────────────────────────────── */
    render(raw) {
      const R = SS.R, P = SS.Player, W = SS.World;
      const th = R.setTheme(this.tod);

      R.begin({
        x: this.state === 'menu' ? Math.sin(this.time * 0.28) * 1.9 : P.x * 0.6,
        h: C.CAM_H + clamp(P.y, 0, 12) * 0.62,
        fov: this.fov,
        pitch: this.pitch,
        shakeX: this.shakeX,
        shakeY: this.shakeY,
      });

      R.sky(th, this.time);
      R.skyline(this.travel);
      W.drawBuildings(R, this.travel);
      W.drawTrack(R, this.travel, this.time);

      W.drawEntities(R, this.travel, this.time, 0, C.FAR);
      /* the inspector looms behind but is painted first so he never
         swallows the runner the player is actually steering */
      if (this.chase > 0.02 && this.state !== 'menu') P.drawChaser(R, this.time, this.chase);
      if (this.state !== 'menu') P.draw(R, this.time);
      W.drawEntities(R, this.travel, this.time, C.MINZ, 0);

      SS.FX.draw(R);

      this.postFX(R);
      R.end();
    },

    postFX(R) {
      const ctx = R.ctx, W = R.W, H = R.H;

      /* speed streaks */
      const boost = clamp((this.speed - 46) / 60, 0, 1) * (SS.Save.data.opt.blur ? 1 : 0);
      if (boost > 0.02 && this.state !== 'menu') {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(190,225,255,' + (0.05 + boost * 0.1).toFixed(3) + ')';
        const cx = W / 2, cy = R.horizon;
        const n = 22;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + this.time * 0.6;
          const r0 = Math.min(W, H) * (0.35 + ((i * 37) % 10) / 22);
          const len = 60 + boost * 190 + ((i * 53) % 60);
          ctx.lineWidth = 1 + boost * 2.2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8);
          ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len) * 0.8);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* time-warp tint */
      if (this.pu.warp > 0) {
        ctx.fillStyle = 'rgba(120,80,255,.10)';
        ctx.fillRect(0, 0, W, H);
      }

      /* vignette */
      if (!this._vig || this._vigW !== W || this._vigH !== H) {
        const g = ctx.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.32, W / 2, H * 0.55, Math.max(W, H) * 0.78);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,.5)');
        this._vig = g; this._vigW = W; this._vigH = H;
      }
      ctx.fillStyle = this._vig;
      ctx.fillRect(0, 0, W, H);
    },
  };

  SS.Game = G;
})();
