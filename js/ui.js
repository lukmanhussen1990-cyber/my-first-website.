/* Crossy Road — DOM glue: HUD, menus, character shop. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;

  function $(id) { return document.getElementById(id); }

  var CAUSE = {
    car: 'Squashed!',
    train: 'Off the rails!',
    water: 'Splash!',
    eagle: 'Eagle got you!'
  };

  var ui = {
    game: null,
    index: 0,
    unlocked: util.store.get('unlocked', ['chicken']),
    preview: null,
    previewT: 0
  };

  ui.init = function (game) {
    this.game = game;
    this.el = {
      hud: $('hud'), score: $('hud-score'), coins: $('coin-count'),
      start: $('screen-start'), over: $('screen-over'), pause: $('screen-pause'),
      name: $('char-name'), status: $('char-status'),
      play: $('btn-play'), unlock: $('btn-unlock'), wallet: $('wallet-count'),
      cause: $('over-cause'), overScore: $('over-score'), overBest: $('over-best'),
      overCoins: $('over-coins'), newBest: $('new-best'),
      sound: $('btn-sound'), dpad: $('dpad')
    };

    // Character preview gets its own tiny renderer.
    this.preview = new CR.Renderer($('char-preview'), { alpha: true });
    this.resizePreview();

    var i = 0;
    for (; i < CR.characters.length; i++) {
      if (CR.characters[i].id === game.charId) { this.index = i; break; }
    }
    if (!this.has(game.charId)) { this.index = 0; game.setCharacter('chicken'); }

    var self = this;
    $('char-prev').onclick = function () { self.cycle(-1); };
    $('char-next').onclick = function () { self.cycle(1); };
    this.el.play.onclick = function () { self.play(); };
    this.el.unlock.onclick = function () { self.buy(); };
    $('btn-again').onclick = function () { self.play(); };
    $('btn-menu').onclick = function () { CR.audio.click(); self.showStart(); };
    $('btn-resume').onclick = function () { CR.audio.click(); game.resume(); };
    $('btn-quit').onclick = function () { CR.audio.click(); self.showPause(false); self.showStart(); };
    $('btn-pause').onclick = function () { CR.audio.click(); game.pause(); };
    this.el.sound.onclick = function () {
      var muted = CR.audio.toggle();
      self.el.sound.textContent = muted ? '🔇' : '🔊';
      if (!muted) CR.audio.click();
    };
    this.el.sound.textContent = CR.audio.muted ? '🔇' : '🔊';

    this.refreshChar();
    this.setCoins(game.wallet);
  };

  ui.has = function (id) { return this.unlocked.indexOf(id) !== -1; };

  ui.resizePreview = function () {
    var c = $('char-preview');
    var rect = c.getBoundingClientRect();
    this.preview.resize(Math.max(120, rect.width || 220), Math.max(100, rect.height || 170));
    this.preview.scale = this.preview.h * 0.5;
    this.preview.anchor = 0.56;
    this.preview.setCamera(0, 0);
  };

  ui.cycle = function (step) {
    CR.audio.click();
    var n = CR.characters.length;
    this.index = (this.index + step + n) % n;
    var ch = CR.characters[this.index];
    if (this.has(ch.id)) this.game.setCharacter(ch.id);
    this.refreshChar();
  };

  ui.refreshChar = function () {
    var ch = CR.characters[this.index];
    var owned = this.has(ch.id);
    this.el.name.textContent = ch.name;
    this.el.status.classList.toggle('locked', !owned);
    if (owned) {
      this.el.status.textContent = this.game.charId === ch.id ? 'Selected' : 'Tap play to use';
      this.el.play.classList.remove('hidden');
      this.el.unlock.classList.add('hidden');
    } else {
      var short = ch.cost - this.game.wallet;
      this.el.status.textContent = short > 0 ? 'Locked — ' + short + ' more coins' : 'Locked';
      this.el.play.classList.add('hidden');
      this.el.unlock.classList.remove('hidden');
      this.el.unlock.textContent = 'UNLOCK — ' + ch.cost + ' COINS';
      this.el.unlock.disabled = short > 0;
    }
    this.el.wallet.textContent = this.game.wallet;
  };

  ui.buy = function () {
    var ch = CR.characters[this.index];
    if (this.game.wallet < ch.cost || this.has(ch.id)) return;
    this.game.wallet -= ch.cost;
    util.store.set('coins', this.game.wallet);
    this.unlocked.push(ch.id);
    util.store.set('unlocked', this.unlocked);
    this.game.setCharacter(ch.id);
    CR.audio.unlock();
    this.refreshChar();
    this.setCoins(this.game.wallet);
  };

  ui.play = function () {
    CR.audio.init();
    CR.audio.click();
    var ch = CR.characters[this.index];
    if (this.has(ch.id)) this.game.setCharacter(ch.id);
    this.el.start.classList.add('hidden');
    this.el.over.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    if (CR.touch) this.el.dpad.classList.remove('hidden');
    this.game.start();
  };

  ui.showStart = function () {
    this.game.toMenu();
    this.el.over.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.dpad.classList.add('hidden');
    this.el.start.classList.remove('hidden');
    this.refreshChar();
  };

  ui.showGameOver = function (game) {
    this.el.cause.textContent = CAUSE[game.player.cause] || 'Game over';
    this.el.overScore.textContent = game.score;
    this.el.overBest.textContent = game.best;
    this.el.overCoins.textContent = game.runCoins;
    this.el.newBest.classList.toggle('hidden', !game.newBest);
    this.el.over.classList.remove('hidden');
    this.el.dpad.classList.add('hidden');
    this.refreshChar();
  };

  ui.showPause = function (on) {
    this.el.pause.classList.toggle('hidden', !on);
  };

  ui.setScore = function (v) { this.el.score.textContent = v; };
  ui.setCoins = function (v) { this.el.coins.textContent = v; };

  /** Idle animation on the character-select canvas. */
  ui.drawPreview = function (dt) {
    if (this.el.start.classList.contains('hidden')) return;
    var r = this.preview, t = (this.previewT += dt);
    var ctx = r.ctx;
    ctx.clearRect(0, 0, r.w, r.h);

    // little grass podium
    for (var gx = -0.5; gx <= 0.5; gx++) {
      for (var gy = -0.5; gy <= 0.5; gy++) {
        r.box(gx, gy, -0.4, 1, 1, 0.4, (gx + gy) === 0 ? '#7ec94b' : '#71bb41');
      }
    }
    var hop = Math.abs(Math.sin(t * 2.2));
    var z = Math.pow(hop, 0.7) * 0.22;
    r.shadow(0, 0, 0.66 - z * 0.3, 0.66 - z * 0.3, 0.18);
    CR.drawCharacter(r, CR.characters[this.index], {
      x: 0, y: 0, z: z,
      facing: 2,                       // turned to face the player

      squash: 1 - hop * 0.06,
      stretch: 1 + hop * 0.1
    });
  };

  CR.ui = ui;
})(window);
