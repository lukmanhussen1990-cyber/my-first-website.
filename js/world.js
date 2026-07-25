/* Crossy Road — endless world: row generation and traffic simulation.
 *
 * Rows are generated in *groups* (a highway of 1-4 lanes, a river of 1-3
 * lanes, a rail yard, a strip of meadow) which is what makes the terrain
 * read as a place rather than as noise. Everything is driven by a seeded
 * PRNG, so a seed replays exactly. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;
  var M = CR.models;

  var MINX = -9, MAXX = 9;          // playable columns (inclusive)
  var SPAWN = 21;                   // where traffic recycles
  var TRAIN_SPAWN = 26;

  var TREE_GREENS = ['#2f8f3e', '#37a047', '#2a7f38', '#3faa50', '#45b158'];
  var FLOWERS = ['#ffe066', '#ff8fab', '#ffffff', '#c084fc'];

  function World(seed) {
    this.rng = util.rng(seed);
    this.rows = Object.create(null);
    this.next = -12;
    this.lastType = 'grass';
    this.since = { road: 0, water: 0, rail: 0 };
    this.maxY = 0;

    // Opening stretch: quiet meadow so the first hop is never fatal.
    while (this.next < 4) this._meadow(this.next, this.next < -1);
    this.ensure(26);
  }

  World.MINX = MINX;
  World.MAXX = MAXX;

  /* ── Generation ───────────────────────────────────────────── */

  World.prototype.difficulty = function () { return util.clamp((this.next - 6) / 230, 0, 1); };

  World.prototype.ensure = function (upTo) {
    var guard = 0;
    while (this.next <= upTo && guard++ < 400) this._group();
  };

  World.prototype.rowAt = function (y) {
    var r = this.rows[y];
    if (r) return r;
    this.ensure(y);
    return this.rows[y] || this._meadow(y, false);
  };

  World.prototype._put = function (row) {
    row.shade = ((row.y % 2) + 2) % 2 === 0;
    this.hazardRun = row.type === 'grass' ? 0 : (this.hazardRun || 0) + 1;
    this.rows[row.y] = row;
    if (row.y >= this.next) this.next = row.y + 1;
    return row;
  };

  /** A single meadow row (also used as the safety net for stray lookups). */
  World.prototype._meadow = function (y, decorate) {
    var rng = this.rng;
    var row = { y: y, type: 'grass', obstacles: Object.create(null), coin: null, flowers: [] };
    if (decorate) {
      for (var x = MINX; x <= MAXX; x++) {
        if (rng.chance(0.1)) row.obstacles[x] = this._prop(rng);
      }
    }
    this._border(row);
    this._flowers(row);
    return this._put(row);
  };

  World.prototype._prop = function (rng) {
    var kind = rng.weighted([['tree', 7], ['rock', 2], ['bush', 2]]);
    return {
      kind: kind,
      size: rng.range(0, 1),
      layers: rng.int(2, 3),
      color: rng.pick(TREE_GREENS)
    };
  };

  /** Dense scenery outside the playfield so the edges feel like a forest. */
  World.prototype._border = function (row) {
    var rng = this.rng;
    row.border = [];
    for (var i = 1; i <= 7; i++) {
      if (rng.chance(0.82)) row.border.push({ x: MINX - i, o: this._prop(rng) });
      if (rng.chance(0.82)) row.border.push({ x: MAXX + i, o: this._prop(rng) });
    }
  };

  World.prototype._flowers = function (row) {
    var rng = this.rng, n = rng.int(0, 3);
    for (var i = 0; i < n; i++) {
      row.flowers.push({
        x: rng.range(MINX - 6, MAXX + 6),
        o: rng.range(-0.35, 0.35),
        c: rng.pick(FLOWERS)
      });
    }
  };

  World.prototype._group = function () {
    var rng = this.rng, d = this.difficulty();
    var y = this.next;
    var last = this.lastType;

    // Weights: meadows thin out, rivers and rails show up as you get deeper.
    var choices = [
      ['grass', last === 'grass' ? 0.6 : 3.4 - d * 1.2],
      ['road', last === 'road' ? 0.4 : 3.6 + d * 0.8],
      ['water', last === 'water' ? 0.2 : (d > 0.06 ? 1.4 + d * 1.6 : 0.35)],
      ['rail', last === 'rail' ? 0 : (d > 0.12 ? 0.8 + d * 1.6 : 0)]
    ];
    var type = rng.weighted(choices);
    // Guarantee breathing room: never string more than ~6 hazard rows
    // together, and keep rivers (the least forgiving row) out of long chains.
    if (this.hazardRun >= 6) type = 'grass';
    else if (this.hazardRun >= 4 && type === 'water') type = 'road';
    this.lastType = type;

    if (type === 'grass') this._grassGroup(y, d);
    else if (type === 'road') this._roadGroup(y, d);
    else if (type === 'water') this._waterGroup(y, d);
    else this._railGroup(y, d);
  };

  World.prototype._grassGroup = function (y, d) {
    var rng = this.rng;
    var len = rng.weighted([[1, 5], [2, 3], [3, 1.4]]);
    for (var i = 0; i < len; i++) {
      var row = { y: y + i, type: 'grass', obstacles: Object.create(null), coin: null, flowers: [] };
      var density = (i === 0 ? 0.07 : 0.13) + d * 0.14;
      var free = [];
      for (var x = MINX; x <= MAXX; x++) {
        if (rng.chance(density)) row.obstacles[x] = this._prop(rng);
        else free.push(x);
      }
      // Never wall the player in.
      while (free.length < 7) {
        var pick = rng.int(MINX, MAXX);
        if (row.obstacles[pick]) { delete row.obstacles[pick]; free.push(pick); }
      }
      if (rng.chance(0.2)) row.coin = { x: rng.pick(free), taken: false };
      this._border(row);
      this._flowers(row);
      this._put(row);
    }
  };

  World.prototype._roadGroup = function (y, d) {
    var rng = this.rng;
    var len = rng.weighted([[1, 3], [2, 4], [3, 2.6 + d], [4, 0.8 + d * 1.6]]);
    var baseDir = rng.chance(0.5) ? 1 : -1;
    var lampSide = rng.chance(0.5) ? MINX - 1 : MAXX + 1;
    for (var i = 0; i < len; i++) {
      var dir = len > 1 ? (i % 2 === 0 ? baseDir : -baseDir) : baseDir;
      var speed = (2.3 + d * 3.6) * rng.range(0.78, 1.3);
      var row = {
        y: y + i, type: 'road', dir: dir, speed: speed, vehicles: [],
        markLeading: i < len - 1, kerbNear: i === 0, kerbFar: i === len - 1,
        lamp: i === 0 ? lampSide : 0
      };
      this._fillTraffic(row, d);
      this._put(row);
    }
  };

  World.prototype._fillTraffic = function (row, d) {
    var rng = this.rng;
    var heavy = row.speed < 4.4;
    var table = [
      ['car', 6], ['taxi', 2], ['police', 1],
      ['truck', heavy ? 3 : 0.6], ['bus', heavy ? 2 : 0.4]
    ];
    var x = -SPAWN + rng.range(0, 6);
    while (x < SPAWN) {
      var kind = rng.weighted(table);
      var len = M.VEHICLES[kind].len;
      x += len * 0.5;
      row.vehicles.push({
        x: x, kind: kind, len: len, dir: row.dir, speed: row.speed,
        color: this._color(kind)
      });
      x += len * 0.5 + this._gap(row, d);
    }
    // Traffic always flows toward the row's direction.
    if (row.dir < 0) {
      for (var i = 0; i < row.vehicles.length; i++) row.vehicles[i].x *= -1;
    }
  };

  World.prototype._color = function (kind) {
    if (kind === 'police') return '#2f4f9e';
    if (kind === 'taxi') return '#ffc21f';
    return this.rng.pick(CR.CAR_COLORS);
  };

  World.prototype._gap = function (row, d) {
    var rng = this.rng;
    return Math.max(1.5, (2.6 - d * 0.7) * rng.range(0.7, 2.1) + row.speed * 0.18);
  };

  World.prototype._waterGroup = function (y, d) {
    var rng = this.rng;
    var len = rng.weighted([[1, 4], [2, 3], [3, 1 + d * 1.5]]);
    var baseDir = rng.chance(0.5) ? 1 : -1;
    for (var i = 0; i < len; i++) {
      var dir = len > 1 ? (i % 2 === 0 ? baseDir : -baseDir) : baseDir;
      var row = {
        y: y + i, type: 'water', dir: dir,
        speed: (1.05 + d * 1.5) * rng.range(0.8, 1.25),
        logs: [], pads: [],
        bankNear: i === 0, bankFar: i === len - 1
      };
      if (rng.chance(0.24)) this._fillPads(row, d);
      else this._fillLogs(row, d);
      this._put(row);
    }
  };

  World.prototype._fillLogs = function (row, d) {
    var rng = this.rng;
    var x = -SPAWN + rng.range(0, 5);
    while (x < SPAWN) {
      var len = d < 0.45 ? rng.int(2, 4) : rng.int(2, 3);
      x += len * 0.5;
      row.logs.push({ x: x, len: len });
      x += len * 0.5 + Math.max(1.0, rng.range(1.0, 2.1) + d * 0.5);
    }
    if (row.dir < 0) for (var i = 0; i < row.logs.length; i++) row.logs[i].x *= -1;
  };

  World.prototype._fillPads = function (row) {
    var rng = this.rng;
    row.speed = 0;
    for (var x = MINX - 3; x <= MAXX + 3; x++) {
      if (rng.chance(0.36)) row.pads.push({ x: x, flower: rng.chance(0.3) });
    }
    // Guarantee a foothold somewhere near the middle.
    if (!row.pads.length) row.pads.push({ x: rng.int(-3, 3), flower: false });
  };

  World.prototype._railGroup = function (y, d) {
    var rng = this.rng;
    var len = rng.chance(0.25 + d * 0.35) ? 2 : 1;
    for (var i = 0; i < len; i++) {
      this._put({
        y: y + i, type: 'rail',
        dir: rng.chance(0.5) ? 1 : -1,
        state: 'idle',
        timer: rng.range(1.6, 4.5) + i * 1.3,
        train: null,
        cars: rng.int(3, 5),
        speed: 24 + d * 12,
        signalOn: false
      });
    }
  };

  /* ── Simulation ───────────────────────────────────────────── */

  World.prototype.update = function (dt, view, game) {
    var d = this.difficulty();
    for (var y = Math.floor(view.near) - 2; y <= Math.ceil(view.far) + 2; y++) {
      var row = this.rows[y];
      if (!row) continue;
      if (row.type === 'road') this._updateRoad(row, dt, d);
      else if (row.type === 'water') this._updateWater(row, dt);
      else if (row.type === 'rail') this._updateRail(row, dt, game);
    }
  };

  World.prototype._updateRoad = function (row, dt, d) {
    var v = row.vehicles, i, n = v.length;
    if (!n) return;
    var step = row.dir * row.speed * dt;
    var edge = row.dir > 0 ? Infinity : -Infinity;
    for (i = 0; i < n; i++) {
      v[i].x += step;
      // find the tail of the queue so a recycled car slots in behind it
      if (row.dir > 0) edge = Math.min(edge, v[i].x - v[i].len * 0.5);
      else edge = Math.max(edge, v[i].x + v[i].len * 0.5);
    }
    for (i = 0; i < n; i++) {
      var car = v[i];
      if (row.dir > 0 && car.x - car.len * 0.5 > SPAWN) {
        car.x = edge - this._gap(row, d) - car.len * 0.5;
        edge = car.x - car.len * 0.5;
        car.color = this._color(car.kind);
      } else if (row.dir < 0 && car.x + car.len * 0.5 < -SPAWN) {
        car.x = edge + this._gap(row, d) + car.len * 0.5;
        edge = car.x + car.len * 0.5;
        car.color = this._color(car.kind);
      }
    }
  };

  World.prototype._updateWater = function (row, dt) {
    var logs = row.logs, n = logs.length;
    if (!n || !row.speed) return;
    var step = row.dir * row.speed * dt;
    var edge = row.dir > 0 ? Infinity : -Infinity;
    var i;
    for (i = 0; i < n; i++) {
      logs[i].x += step;
      if (row.dir > 0) edge = Math.min(edge, logs[i].x - logs[i].len * 0.5);
      else edge = Math.max(edge, logs[i].x + logs[i].len * 0.5);
    }
    for (i = 0; i < n; i++) {
      var lg = logs[i];
      if (row.dir > 0 && lg.x - lg.len * 0.5 > SPAWN) {
        lg.x = edge - this.rng.range(1.0, 2.2) - lg.len * 0.5;
        edge = lg.x - lg.len * 0.5;
      } else if (row.dir < 0 && lg.x + lg.len * 0.5 < -SPAWN) {
        lg.x = edge + this.rng.range(1.0, 2.2) + lg.len * 0.5;
        edge = lg.x + lg.len * 0.5;
      }
    }
  };

  World.prototype._updateRail = function (row, dt, game) {
    row.timer -= dt;
    if (row.state === 'idle') {
      row.signalOn = false;
      if (row.timer <= 0) {
        row.state = 'warn';
        row.timer = 1.35;
        if (game && game.nearRow(row.y, 9)) CR.audio.horn();
      }
    } else if (row.state === 'warn') {
      row.signalOn = Math.floor(row.timer * 6) % 2 === 0;
      if (row.timer <= 0) {
        row.state = 'run';
        row.train = { x: -TRAIN_SPAWN * row.dir, dir: row.dir, cars: row.cars };
        row.train.back = row.cars > 1 ? (1.6 + (row.cars - 2) * 3.0 + 1.7 + 1.45) : 1.7;
        if (game && game.nearRow(row.y, 10)) CR.audio.trainPass();
      }
    } else {
      row.signalOn = Math.floor(row.timer * 8) % 2 === 0;
      row.train.x += row.dir * row.speed * dt;
      var tail = row.train.x - row.train.back * row.dir;
      if ((row.dir > 0 && tail > TRAIN_SPAWN) || (row.dir < 0 && tail < -TRAIN_SPAWN)) {
        row.state = 'idle';
        row.train = null;
        row.timer = this.rng.range(2.6, 6.5);
        row.dir = this.rng.chance(0.5) ? 1 : -1;
        row.cars = this.rng.int(3, 5);
      }
    }
  };

  /* ── Queries ──────────────────────────────────────────────── */

  /** Is the integer cell (x, y) impassable? */
  World.prototype.blocked = function (x, y) {
    if (x < MINX || x > MAXX) return true;
    var row = this.rowAt(y);
    return row.type === 'grass' && !!row.obstacles[x];
  };

  /** The log or pad supporting a float x on a water row, else null. */
  World.prototype.platformAt = function (x, row) {
    var i;
    for (i = 0; i < row.logs.length; i++) {
      var lg = row.logs[i];
      if (x > lg.x - lg.len * 0.5 - 0.18 && x < lg.x + lg.len * 0.5 + 0.18) return lg;
    }
    for (i = 0; i < row.pads.length; i++) {
      var p = row.pads[i];
      if (Math.abs(x - p.x) < 0.62) return p;
    }
    return null;
  };

  /** Vehicle or train overlapping a float x on this row, else null. */
  World.prototype.hazardAt = function (x, row, halfWidth) {
    var i;
    if (row.type === 'road') {
      for (i = 0; i < row.vehicles.length; i++) {
        var v = row.vehicles[i];
        if (Math.abs(x - v.x) < v.len * 0.5 + halfWidth) return v;
      }
    } else if (row.type === 'rail' && row.train) {
      var t = row.train;
      var front = t.x + 1.7 * t.dir, back = t.x - t.back * t.dir;
      var lo = Math.min(front, back), hi = Math.max(front, back);
      if (x > lo - halfWidth && x < hi + halfWidth) return t;
    }
    return null;
  };

  /** Drop rows far behind the camera so memory stays flat on long runs. */
  World.prototype.prune = function (below) {
    for (var key in this.rows) {
      if (+key < below) delete this.rows[key];
    }
  };

  CR.World = World;
})(window);
