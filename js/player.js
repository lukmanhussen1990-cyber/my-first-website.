/* Crossy Road — the hopper: grid movement, log riding, and death theatrics. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;
  var W = CR.World;

  var HOP_TIME = 0.145;
  var HOP_HEIGHT = 0.55;
  var HALF = 0.34;              // collision half-width

  function Player(character) {
    this.char = character;
    this.reset();
  }

  Player.HALF = HALF;

  Player.prototype.reset = function () {
    this.x = 0; this.y = 0; this.z = 0;
    this.gx = 0; this.gy = 0;
    this.facing = 0;
    this.hopping = false;
    this.hopT = 0;
    this.from = { x: 0, y: 0 };
    this.to = { x: 0, y: 0 };
    this.platform = null;
    this.platformOff = 0;
    this.landT = 0;
    this.bumpT = 0;
    this.alive = true;
    this.cause = null;
    this.deathT = 0;
    this.vel = { x: 0, z: 0 };
    this.spin = 0;
    this.squash = 1;
    this.stretch = 1;
    this.alpha = 1;
    this.maxY = 0;
    this.moved = false;
  };

  var DIRS = {
    up: { dx: 0, dy: 1, f: 0 },
    right: { dx: 1, dy: 0, f: 1 },
    down: { dx: 0, dy: -1, f: 2 },
    left: { dx: -1, dy: 0, f: 3 }
  };

  /**
   * Attempt a hop. Returns 'ok' | 'blocked' | 'busy'.
   * Movement is grid based, but x stays fractional while riding a log so the
   * hopper keeps the drift it picked up on the water.
   */
  Player.prototype.tryMove = function (dirName, world) {
    if (!this.alive) return 'busy';
    var d = DIRS[dirName];
    if (!d) return 'busy';
    if (this.hopping) return 'busy';

    this.facing = d.f;

    var ty = this.gy + d.dy;
    var tx = this.x + d.dx;
    if (ty < 0 && this.gy <= 0) ty = 0;                       // no falling off the start

    var row = world.rowAt(ty);
    var landX;
    if (row.type === 'water') {
      landX = util.clamp(tx, W.MINX, W.MAXX);
      if (Math.abs(landX - tx) > 0.3) { this.bump(); return 'blocked'; }
    } else {
      landX = Math.round(tx);
      if (world.blocked(landX, ty)) { this.bump(); return 'blocked'; }
    }

    this.from.x = this.x; this.from.y = this.y;
    this.to.x = landX; this.to.y = ty;
    this.hopping = true;
    this.hopT = 0;
    this.platform = null;
    this.moved = true;
    CR.audio.hop();
    return 'ok';
  };

  Player.prototype.bump = function () {
    this.bumpT = 0.12;
    CR.audio.blocked();
  };

  /** Advance one frame. Returns a death cause string if the hop was fatal. */
  Player.prototype.update = function (dt, world, game) {
    if (!this.alive) { this._death(dt); return null; }

    if (this.bumpT > 0) this.bumpT -= dt;

    if (this.hopping) {
      this.hopT += dt / HOP_TIME;
      if (this.hopT >= 1) {
        this.hopT = 1;
        this.hopping = false;
        this.x = this.to.x; this.y = this.to.y;
        this.gx = Math.round(this.to.x); this.gy = this.to.y;
        this.z = 0;
        this.landT = 0.12;
        var cause = this._land(world, game);
        if (cause) return cause;
      } else {
        var t = this.hopT;
        this.x = util.lerp(this.from.x, this.to.x, t);
        this.y = util.lerp(this.from.y, this.to.y, t);
        this.z = Math.sin(Math.PI * t) * HOP_HEIGHT;
        var p = Math.sin(Math.PI * t);
        this.stretch = 1 + 0.26 * p;
        this.squash = 1 - 0.13 * p;
      }
    } else {
      if (this.landT > 0) {
        this.landT -= dt;
        var k = Math.max(0, this.landT / 0.12);
        this.stretch = 1 - 0.22 * k;
        this.squash = 1 + 0.16 * k;
      } else {
        this.stretch = 1; this.squash = 1;
      }
      // Drift with the log / pad underfoot.
      if (this.platform) {
        this.x = this.platform.x + this.platformOff;
        this.gx = Math.round(this.x);
        if (this.x < W.MINX - 0.75 || this.x > W.MAXX + 0.75) return 'water';
      }
    }
    return null;
  };

  Player.prototype._land = function (world, game) {
    var row = world.rowAt(this.gy);

    if (row.type === 'water') {
      var plat = world.platformAt(this.x, row);
      if (!plat) return 'water';
      this.platform = plat;
      this.platformOff = plat.len
        ? util.clamp(this.x - plat.x, -plat.len * 0.5 + 0.25, plat.len * 0.5 - 0.25)
        : 0;                                  // lily pads always centre you
      this.x = plat.x + this.platformOff;
    } else {
      this.platform = null;
      if (row.coin && !row.coin.taken && row.coin.x === this.gx) {
        row.coin.taken = true;
        game.collectCoin(this.gx, this.gy);
      }
    }

    if (this.y > this.maxY) this.maxY = this.y;
    return null;
  };

  /* ── Death ────────────────────────────────────────────────── */

  Player.prototype.die = function (cause, hazard) {
    if (!this.alive) return;
    this.alive = false;
    this.cause = cause;
    this.deathT = 0;
    this.hopping = false;
    if (cause === 'car' || cause === 'train') {
      var dir = hazard && hazard.dir ? hazard.dir : 1;
      var force = cause === 'train' ? 1 : 0.35;
      this.vel.x = dir * (cause === 'train' ? 13 : 3.4);
      this.vel.z = cause === 'train' ? 7.5 : 0;
      this.spinRate = dir * force * 22;
    }
  };

  Player.prototype._death = function (dt) {
    this.deathT += dt;
    var t = this.deathT;
    if (this.cause === 'car') {
      var k = Math.min(1, t / 0.1);
      this.stretch = util.lerp(1, 0.13, k);
      this.squash = util.lerp(1, 1.42, k);
      this.x += this.vel.x * dt;
      this.vel.x *= 0.86;
    } else if (this.cause === 'train') {
      this.x += this.vel.x * dt;
      this.z += this.vel.z * dt;
      this.vel.z -= 16 * dt;
      this.vel.x *= 0.985;
      this.spin = (this.spin || 0) + this.spinRate * dt;
      this.facing = ((Math.round(this.spin / (Math.PI / 2)) % 4) + 4) % 4;
      if (this.z < -3) this.alpha = 0;
    } else if (this.cause === 'water') {
      this.z = Math.max(-0.62, this.z - 1.05 * dt);
      this.stretch = util.lerp(1, 0.8, Math.min(1, t / 0.6));
      this.alpha = util.clamp(1 - (t - 0.35) / 0.7, 0, 1);
      if (this.platform) this.platform = null;
    } else if (this.cause === 'eagle') {
      if (t > 0.42) {
        this.z += (t - 0.42) * 26 * dt;
        this.alpha = util.clamp(1 - (t - 1.1) / 0.5, 0, 1);
      }
    }
  };

  /* ── Draw ─────────────────────────────────────────────────── */

  Player.prototype.draw = function (r, time) {
    var bump = this.bumpT > 0 ? Math.sin(this.bumpT * 90) * 0.05 : 0;
    var bob = (!this.hopping && this.alive && this.landT <= 0) ? Math.sin(time * 3) * 0.012 : 0;
    if (this.alive || this.cause !== 'water') {
      // shrink and fade the contact shadow as the hopper gets airborne
      var s = Math.max(0.12, 0.66 - Math.max(0, this.z) * 0.14);
      r.shadow(this.x, this.y, s, s, this.z > 0.03 ? 0.14 : 0.2);
    }
    CR.drawCharacter(r, this.char, {
      x: this.x + bump, y: this.y, z: this.z + bob,
      facing: this.facing,
      squash: this.squash, stretch: this.stretch,
      alpha: this.alpha
    });
  };

  CR.Player = Player;
})(window);
