/* Crossy Road — game loop, camera, collisions, effects. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;
  var M = CR.models;
  var W = CR.World;

  var SKY_TOP = '#cfeaf7';
  var IDLE_WARN = 5.0;
  var IDLE_DEATH = 8.0;

  function Game(canvas) {
    this.r = new CR.Renderer(canvas);
    this.state = 'menu';
    this.time = 0;
    this.shake = 0;
    this.particles = [];
    this.pool = [];
    this.pending = null;
    this.pendingAt = 0;
    this.score = 0;
    this.best = util.store.get('best', 0);
    this.wallet = util.store.get('coins', 0);
    this.runCoins = 0;
    this.idle = 0;
    this.charId = util.store.get('char', 'chicken');
    this.overTimer = 0;
    this.newBest = false;

    this.world = new CR.World((Math.random() * 1e9) | 0);
    this.player = new CR.Player(CR.byId(this.charId));
    this.camY = 0; this.camX = 0;
    this.scroll = 0;
  }

  /* ── Lifecycle ────────────────────────────────────────────── */

  Game.prototype.setCharacter = function (id) {
    this.charId = id;
    util.store.set('char', id);
    this.player.char = CR.byId(id);
  };

  Game.prototype.start = function () {
    this.world = new CR.World((Math.random() * 1e9) | 0);
    this.player = new CR.Player(CR.byId(this.charId));
    this.particles.length = 0;
    this.camY = 0; this.camX = 0;
    this.score = 0; this.runCoins = 0;
    this.idle = 0; this.scroll = 0; this.shake = 0;
    this.pending = null;
    this.newBest = false;
    this.state = 'play';
    CR.ui.setScore(0);
    CR.ui.setCoins(this.wallet);
  };

  Game.prototype.toMenu = function () {
    this.state = 'menu';
    this.world = new CR.World((Math.random() * 1e9) | 0);
    this.player = new CR.Player(CR.byId(this.charId));
    this.camY = 0; this.camX = 0;
    this.particles.length = 0;
  };

  Game.prototype.pause = function () {
    if (this.state === 'play') { this.state = 'paused'; CR.ui.showPause(true); }
  };

  Game.prototype.resume = function () {
    if (this.state === 'paused') { this.state = 'play'; CR.ui.showPause(false); }
  };

  Game.prototype.move = function (dir) {
    if (this.state !== 'play') return;
    if (this.player.hopping) {
      // late-hop buffering keeps fast chains of taps feeling responsive
      if (this.player.hopT > 0.45) { this.pending = dir; this.pendingAt = this.time; }
      return;
    }
    this.player.tryMove(dir, this.world);
  };

  Game.prototype.nearRow = function (y, dist) {
    return Math.abs(y - this.camY) < dist;
  };

  /* ── Update ───────────────────────────────────────────────── */

  Game.prototype.update = function (dt) {
    this.time += dt;
    var r = this.r, p = this.player;

    // Shake decay
    if (this.shake > 0.001) {
      this.shake *= Math.exp(-7 * dt);
      r.shakeX = (Math.random() - 0.5) * this.shake;
      r.shakeY = (Math.random() - 0.5) * this.shake;
    } else { this.shake = 0; r.shakeX = 0; r.shakeY = 0; }

    var view = r.viewRows();
    this.world.ensure(Math.ceil(view.far) + 6);
    this.world.update(dt, view, this);
    this.updateParticles(dt);

    if (this.state === 'menu') {
      this.camY = util.damp(this.camY, 1.2, 2, dt);
      this.camX = 0;
      r.setCamera(this.camX, this.camY);
      return;
    }
    if (this.state === 'paused') return;

    // Buffered input
    if (this.pending && !p.hopping && p.alive) {
      if (this.time - this.pendingAt < 0.35) p.tryMove(this.pending, this.world);
      this.pending = null;
    }

    var cause = p.update(dt, this.world, this);
    if (cause) this.kill(cause, null);

    if (p.alive && this.state === 'play') {
      this.checkHazards();
      this.checkIdle(dt);
      var s = Math.max(0, Math.round(p.maxY));
      if (s !== this.score) { this.score = s; CR.ui.setScore(s); }
    }

    this.updateCamera(dt);

    if (this.state === 'dying') {
      this.overTimer -= dt;
      if (this.overTimer <= 0) this.gameOver();
    }

    if (this.time % 1 < dt) this.world.prune(Math.floor(this.camY) - 40);
  };

  Game.prototype.checkHazards = function () {
    var p = this.player;
    var ry = Math.round(p.y);
    var row = this.world.rowAt(ry);
    var hz = this.world.hazardAt(p.x, row, CR.Player.HALF);
    if (hz) {
      this.kill(row.type === 'rail' ? 'train' : 'car', hz);
      return;
    }
    if (row.type === 'water' && !p.hopping && !p.platform) this.kill('water', null);
  };

  Game.prototype.checkIdle = function (dt) {
    var p = this.player;
    if (!p.moved) return;                     // grace until the first hop
    if (p.hopping) this.idle = 0; else this.idle += dt;

    // Falling behind the camera is also a summons.
    var rowsBelow = (this.r.h * (1 - this.r.anchor)) / (this.r.scale * CR.Renderer.SE);
    if (p.y < this.camY - Math.max(2.4, rowsBelow - 0.8)) { this.kill('eagle', null); return; }
    if (this.idle > IDLE_DEATH) this.kill('eagle', null);
  };

  Game.prototype.updateCamera = function (dt) {
    var p = this.player, r = this.r;

    if (this.state === 'play' && p.moved) {
      var d = util.clamp(this.score / 260, 0, 1);
      this.scroll = 0.28 + d * 1.1;
      this.camY += this.scroll * dt;
    }
    var target = Math.max(this.camY, p.alive ? p.y : this.camY);
    this.camY = Math.max(this.camY, util.damp(this.camY, target, 7, dt));

    var half = r.halfCols();
    var cx = 0;
    if (half < W.MAXX + 1.5) {
      cx = util.clamp(p.x, W.MINX + half - 1.4, W.MAXX - half + 1.4);
    }
    this.camX = util.damp(this.camX, cx, 6, dt);
    r.setCamera(this.camX, this.camY);
  };

  Game.prototype.kill = function (cause, hazard) {
    var p = this.player;
    if (!p.alive) return;
    p.die(cause, hazard);
    this.state = 'dying';
    this.overTimer = cause === 'eagle' ? 1.75 : 1.15;

    if (cause === 'car') {
      this.shake = 16; CR.audio.crash();
      this.burst(p.x, p.y, 0.35, 16, p.char.body, 4.5);
    } else if (cause === 'train') {
      this.shake = 26; CR.audio.crash();
      this.burst(p.x, p.y, 0.4, 22, p.char.body, 7);
    } else if (cause === 'water') {
      CR.audio.splash();
      this.burst(p.x, p.y, 0.1, 18, '#9fd8ff', 3.4);
    } else {
      CR.audio.screech();
    }
    CR.audio.gameOver();
  };

  Game.prototype.gameOver = function () {
    this.state = 'over';
    // Distance itself pays out, so every run makes progress toward a character.
    this.distanceBonus = Math.floor(this.score / 8);
    this.runCoins += this.distanceBonus;
    this.wallet += this.runCoins;
    util.store.set('coins', this.wallet);
    if (this.score > this.best) {
      this.best = this.score;
      this.newBest = true;
      util.store.set('best', this.best);
    }
    CR.ui.showGameOver(this);
  };

  Game.prototype.collectCoin = function (x, y) {
    this.runCoins++;
    CR.audio.coin();
    CR.ui.setCoins(this.wallet + this.runCoins);
    this.burst(x, y, 0.4, 10, '#ffcf3f', 2.6);
  };

  /* ── Particles ────────────────────────────────────────────── */

  Game.prototype.burst = function (x, y, z, n, color, power) {
    for (var i = 0; i < n; i++) {
      var pt = this.pool.pop() || {};
      var a = Math.random() * util.TAU;
      var sp = power * (0.35 + Math.random() * 0.65);
      pt.x = x; pt.y = y; pt.z = z + Math.random() * 0.3;
      pt.vx = Math.cos(a) * sp * 0.6;
      pt.vy = Math.sin(a) * sp * 0.6;
      pt.vz = 1.6 + Math.random() * power * 0.5;
      pt.size = 0.07 + Math.random() * 0.09;
      pt.color = color;
      pt.life = pt.max = 0.5 + Math.random() * 0.6;
      this.particles.push(pt);
    }
  };

  Game.prototype.updateParticles = function (dt) {
    var list = this.particles;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.life -= dt;
      if (p.life <= 0) { this.pool.push(p); list.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= 13 * dt;
      if (p.z < 0.02) { p.z = 0.02; p.vz *= -0.34; p.vx *= 0.7; p.vy *= 0.7; }
    }
  };

  /* ── Draw ─────────────────────────────────────────────────── */

  function drawParticle(r, p) {
    var ctx = r.ctx;
    ctx.save();
    ctx.globalAlpha = util.clamp(p.life / p.max, 0, 1);
    r.box(p.x, p.y, p.z, p.size, p.size, p.size, p.color);
    ctx.restore();
  }

  function drawScenery(r, a) { M.scenery(r, a.o, a.x, a.y); }
  function drawVehicle(r, a) { M.vehicle(r, a.v, a.y, a.t); }
  function drawTrain(r, a) { M.train(r, a.t, a.y, a.time); }
  function drawSignal(r, a) { M.signal(r, a.x, a.y, a.on); }
  function drawLog(r, a) { M.log(r, a.l, a.y); }
  function drawPad(r, a) { M.pad(r, a.p, a.y); }
  function drawCoin(r, a) { M.coin(r, a.x, a.y, a.t); }
  function drawPlayer(r, a) { a.game.player.draw(r, a.game.time); }
  function drawEagle(r, a) { M.eagle(r, a.x, a.y, a.z, a.t); }

  Game.prototype.draw = function () {
    var r = this.r, ctx = r.ctx, t = this.time;
    var view = r.viewRows();
    var halfCols = r.halfCols();
    var tilt = CR.Renderer.SY / CR.Renderer.CY;

    ctx.fillStyle = SKY_TOP;
    ctx.fillRect(0, 0, r.w, r.h);

    var yFar = Math.ceil(view.far), yNear = Math.floor(view.near);
    var y, row, i;

    // 1. Ground, far → near.
    for (y = yFar; y >= yNear; y--) {
      row = this.world.rows[y];
      if (!row) continue;
      var centre = this.camX - (y - this.camY) * tilt;
      M.rowGround(r, row, centre - halfCols - 2.5, centre + halfCols + 2.5, t);
    }

    // 2. Contact shadows — flat, so they all go down before any geometry,
    //    batched into a single path/fill.
    r.beginShadows(0.17);
    for (y = yFar; y >= yNear; y--) {
      row = this.world.rows[y];
      if (!row) continue;
      if (row.type === 'grass') {
        for (var key in row.obstacles) r.addShadow(+key, y, 0.9, 0.9);
        for (i = 0; i < row.border.length; i++) r.addShadow(row.border[i].x, y, 0.9, 0.9);
      } else if (row.type === 'road') {
        for (i = 0; i < row.vehicles.length; i++) {
          var v = row.vehicles[i];
          r.addShadow(v.x, y, v.len + 0.25, 1.15);
        }
      }
    }
    r.endShadows();

    // 3. Everything with height, depth sorted.
    for (y = yFar; y >= yNear; y--) {
      row = this.world.rows[y];
      if (!row) continue;
      var cen = this.camX - (y - this.camY) * tilt;
      var x0 = cen - halfCols - 5, x1 = cen + halfCols + 5;

      if (row.type === 'grass') {
        for (var k in row.obstacles) {
          var ox = +k;
          if (ox < x0 || ox > x1) continue;
          r.push(r.depth(ox, y), drawScenery, { o: row.obstacles[k], x: ox, y: y });
        }
        for (i = 0; i < row.border.length; i++) {
          var b = row.border[i];
          if (b.x < x0 || b.x > x1) continue;
          r.push(r.depth(b.x, y), drawScenery, { o: b.o, x: b.x, y: y });
        }
        if (row.coin && !row.coin.taken) {
          r.push(r.depth(row.coin.x, y), drawCoin, { x: row.coin.x, y: y, t: t });
        }
      } else if (row.type === 'road') {
        if (row.lamp) r.push(r.depth(row.lamp, y), drawScenery, { o: { kind: 'lamp' }, x: row.lamp, y: y });
        for (i = 0; i < row.vehicles.length; i++) {
          var veh = row.vehicles[i];
          if (veh.x < x0 - veh.len || veh.x > x1 + veh.len) continue;
          r.push(r.depth(veh.x, y), drawVehicle, { v: veh, y: y, t: t });
        }
      } else if (row.type === 'water') {
        for (i = 0; i < row.logs.length; i++) {
          var lg = row.logs[i];
          if (lg.x < x0 - lg.len || lg.x > x1 + lg.len) continue;
          r.push(r.depth(lg.x, y), drawLog, { l: lg, y: y });
        }
        for (i = 0; i < row.pads.length; i++) {
          var pd = row.pads[i];
          if (pd.x < x0 || pd.x > x1) continue;
          r.push(r.depth(pd.x, y), drawPad, { p: pd, y: y });
        }
      } else if (row.type === 'rail') {
        r.push(r.depth(W.MINX - 1, y), drawSignal, { x: W.MINX - 1, y: y, on: row.signalOn });
        r.push(r.depth(W.MAXX + 1, y), drawSignal, { x: W.MAXX + 1, y: y, on: !row.signalOn && row.state !== 'idle' });
        if (row.train) r.push(r.depth(row.train.x, y), drawTrain, { t: row.train, y: y, time: t });
      }
    }

    // Player + eagle
    var p = this.player;
    if (p.alpha > 0.01) r.push(r.depth(p.x, p.y) - 0.001, drawPlayer, { game: this });

    if (!p.alive && p.cause === 'eagle') {
      var k2 = util.clamp(p.deathT / 0.42, 0, 1);
      var ez = util.lerp(6.5, 0.5, k2) + (p.deathT > 0.42 ? p.z : 0);
      var ey = p.y + util.lerp(3.2, 0.02, k2);
      r.push(r.depth(p.x, ey) - 0.5, drawEagle, { x: p.x, y: ey, z: ez, t: t });
    } else if (this.state === 'play' && this.idle > IDLE_WARN) {
      // Circling warning shadow — you have about two seconds.
      var warn = util.clamp((this.idle - IDLE_WARN) / (IDLE_DEATH - IDLE_WARN), 0, 1);
      var sz = util.lerp(2.4, 0.9, warn);
      ctx.save();
      ctx.globalAlpha = 0.1 + warn * 0.3;
      r.shadow(p.x + Math.cos(t * 2.2) * 0.6, p.y + Math.sin(t * 2.2) * 0.6, sz, sz, 1);
      ctx.restore();
    }

    for (i = 0; i < this.particles.length; i++) {
      var pt = this.particles[i];
      r.push(r.depth(pt.x, pt.y) - 0.002, drawParticle, pt);
    }

    r.flush();

    // 4. Distance haze so the far edge of the world melts away.
    var fog = r.h * 0.24;
    var g = ctx.createLinearGradient(0, 0, 0, fog);
    g.addColorStop(0, SKY_TOP);
    g.addColorStop(0.4, util.rgba(SKY_TOP, 0.6));
    g.addColorStop(1, util.rgba(SKY_TOP, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, r.w, fog);
  };

  CR.Game = Game;
})(window);
