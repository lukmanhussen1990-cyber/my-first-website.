/* ══════════════════════════════════════════════════════════
   ui.js — DOM screens, HUD, shop, missions, settings
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const $ = (id) => document.getElementById(id);

  /* ── shop catalogue ────────────────────────────────────── */
  const UPGRADES = [
    { id: 'magnet', name: 'Coin Magnet', icon: '🧲', max: 5, base: 260, desc: 'Longer pull, wider reach. Coins come to you.' },
    { id: 'jetpack', name: 'Jetpack', icon: '🚀', max: 5, base: 420, desc: 'More fuel — stay above the whole yard for longer.' },
    { id: 'sneakers', name: 'Super Sneakers', icon: '👟', max: 5, base: 300, desc: 'Extends the sky-high jump window.' },
    { id: 'multi', name: '2× Score', icon: '✖', max: 5, base: 480, desc: 'Doubles every point for longer each pickup.' },
    { id: 'warp', name: 'Time Warp', icon: '⏳', max: 5, base: 440, desc: 'Slows the world down while your score keeps pace.' },
    { id: 'headstart', name: 'Head Start', icon: '⚡', max: 3, base: 700, desc: 'Blast off already deep into the run.' },
  ];

  const GEAR = [
    { id: 'hoverboard', name: 'Hoverboard', icon: '🛹', cost: 320, desc: 'Survive one crash. Stack up to 10 in reserve.' },
    { id: 'coinbundle', name: 'Nothing to see', icon: '🚧', cost: 0, desc: '' },
  ];

  const UP_VALUES = SS.UP = {
    magnetTime: (l) => 7 + l * 1.7,
    magnetRadius: (l) => 7.5 + l * 1.4,
    jetTime: (l) => 5.5 + l * 1.3,
    sneakTime: (l) => 7 + l * 1.5,
    x2Time: (l) => 8 + l * 1.9,
    warpTime: (l) => 4.5 + l * 1.0,
    headStart: (l) => [0, 350, 750, 1250][l] || 0,
  };

  const UI = {
    el: {},
    screen: null,
    shopTab: 'upgrades',
    _puKeys: '',

    init() {
      const ids = [
        'hud', 'hud-score', 'hud-mult', 'hud-dist', 'hud-coins', 'combo', 'combo-n',
        'toasts', 'powerups', 'warn', 'board-count', 'btn-board', 'btn-pause',
        'flash', 'countdown', 'shop-body', 'shop-coins', 'mission-list', 'mission-set',
        't-best', 't-dist', 't-coins', 'p-score', 'p-dist', 'p-coins',
        'o-score', 'o-dist', 'o-coins', 'o-mult', 'o-near', 'o-missions', 'o-newbest',
        'over-title', 'btn-revive', 'revive-cost',
      ];
      ids.forEach((i) => (this.el[i] = $(i)));

      /* screen buttons */
      const G = () => SS.Game;
      $('btn-play').onclick = () => { this.click(); G().start(); };
      $('btn-shop').onclick = () => { this.click(); this.show('shop'); this.renderShop(); };
      $('btn-missions').onclick = () => { this.click(); this.show('missions'); this.renderMissions(); };
      $('btn-settings').onclick = () => { this.click(); this.show('settings'); this.syncSettings(); };
      $('btn-help').onclick = () => { this.click(); this.show('help'); };
      $('btn-resume').onclick = () => { this.click(); G().resume(); };
      $('btn-restart').onclick = () => { this.click(); G().start(); };
      $('btn-quit').onclick = () => { this.click(); G().toMenu(); };
      $('btn-again').onclick = () => { this.click(); G().start(); };
      $('btn-menu').onclick = () => { this.click(); G().toMenu(); };
      $('btn-revive').onclick = () => { G().revive(); };
      this.el['btn-pause'].onclick = () => { this.click(); G().pause(); };
      this.el['btn-board'].onclick = () => { G().useBoard(); };

      document.querySelectorAll('[data-back]').forEach((b) => {
        b.onclick = () => { this.click(); this.show(SS.Game.state === 'paused' ? 'pause' : 'title'); this.updateTitle(); };
      });

      document.querySelectorAll('.tab').forEach((t) => {
        t.onclick = () => {
          this.click();
          document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
          t.classList.add('active');
          this.shopTab = t.dataset.tab;
          this.renderShop();
        };
      });

      /* settings */
      const S = SS.Save.data.opt;
      const bind = (id, key, fn) => {
        const e = $(id);
        e.onchange = () => { S[key] = e.checked; SS.Save.save(); if (fn) fn(e.checked); };
      };
      bind('opt-music', 'music', (v) => { SS.Audio.setMusic(v); });
      bind('opt-sfx', 'sfx', (v) => { SS.Audio.setSfx(v); this.click(); });
      bind('opt-shake', 'shake');
      bind('opt-blur', 'blur');

      $('opt-quality').querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          S.quality = b.dataset.q; SS.Save.save(); this.syncSettings(); this.click();
          SS.R.quality = S.quality; SS.R.resize(); SS.FX.setQuality(S.quality);
        };
      });
      $('opt-diff').querySelectorAll('button').forEach((b) => {
        b.onclick = () => { S.diff = b.dataset.d; SS.Save.save(); this.syncSettings(); this.click(); };
      });

      $('btn-reset').onclick = () => {
        if (confirm('Erase all coins, upgrades, runners and records?')) {
          SS.Save.reset();
          SS.Missions.load(SS.Save.data);
          this.syncSettings();
          this.updateTitle();
          this.show('title');
        }
      };
    },

    click() { SS.Audio.play('ui'); },

    /* ── screen switching ── */
    show(name) {
      document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
      if (name) {
        const s = $('screen-' + name);
        if (s) s.classList.add('active');
      }
      this.screen = name;
      const playing = name === null;
      this.el.hud.classList.toggle('hidden', !playing && name !== 'hudonly');
      this.el.hud.setAttribute('aria-hidden', playing ? 'false' : 'true');
    },

    /* ── title ── */
    updateTitle() {
      const d = SS.Save.data;
      this.el['t-best'].textContent = U.fmt(d.best);
      this.el['t-dist'].textContent = U.fmt(d.bestDistance) + ' m';
      this.el['t-coins'].textContent = U.fmt(d.coins);
    },

    /* ── HUD ── */
    hud(g) {
      this.el['hud-score'].textContent = U.fmt(g.score);
      this.el['hud-dist'].textContent = U.fmt(g.distance) + ' M';
      this.el['hud-coins'].textContent = U.fmt(g.coins);
      const m = 'x' + g.multiplier;
      if (this.el['hud-mult'].textContent !== m) {
        this.el['hud-mult'].textContent = m;
        this.el['hud-mult'].classList.add('pop');
        setTimeout(() => this.el['hud-mult'].classList.remove('pop'), 170);
      }
      this.el['board-count'].textContent = SS.Save.data.hoverboards;
      this.el['btn-board'].classList.toggle('empty', SS.Save.data.hoverboards <= 0 || SS.Player.board);
    },

    combo(n) {
      const c = this.el.combo;
      if (n >= 2) { c.classList.add('on'); this.el['combo-n'].textContent = n + '×'; }
      else c.classList.remove('on');
    },

    warn(on) { this.el.warn.classList.toggle('on', !!on); },

    powerups(list) {
      const key = list.map((p) => p.id).join(',');
      if (key !== this._puKeys) {
        this._puKeys = key;
        this.el.powerups.innerHTML = list.map((p) =>
          '<div class="pu-chip" data-pu="' + p.id + '" style="color:' + p.color + '">' +
          '<span class="ring"><i>' + p.icon + '</i></span>' + p.label + '</div>').join('');
      }
      for (let i = 0; i < list.length; i++) {
        const el = this.el.powerups.children[i];
        if (!el) continue;
        const ring = el.querySelector('.ring');
        ring.style.setProperty('--p', (list[i].t * 360).toFixed(0) + 'deg');
      }
    },

    toast(text, cls) {
      const d = document.createElement('div');
      d.className = 'toast ' + (cls || 'cyan');
      d.textContent = text;
      this.el.toasts.appendChild(d);
      setTimeout(() => d.remove(), 2000);
      while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
    },

    flash(color, alpha, ms) {
      const f = this.el.flash;
      f.style.background = color || '#fff';
      f.style.transition = 'none';
      f.style.opacity = alpha == null ? 0.55 : alpha;
      requestAnimationFrame(() => {
        f.style.transition = 'opacity ' + (ms || 260) + 'ms ease-out';
        f.style.opacity = 0;
      });
    },

    countdown(n) {
      const c = this.el.countdown;
      if (n === null) { c.classList.remove('on'); c.innerHTML = ''; return; }
      c.classList.add('on');
      c.innerHTML = '<span>' + n + '</span>';
    },

    /* ── shop ── */
    renderShop() {
      const d = SS.Save.data;
      this.el['shop-coins'].textContent = U.fmt(d.coins);
      const body = this.el['shop-body'];
      let html = '';

      if (this.shopTab === 'upgrades') {
        UPGRADES.forEach((u) => {
          const lvl = d.up[u.id] || 0;
          const maxed = lvl >= u.max;
          const cost = u.base * (lvl + 1);
          const afford = d.coins >= cost;
          html += '<div class="card' + (maxed ? ' owned' : '') + '">' +
            '<div class="card-top"><div class="card-icon">' + u.icon + '</div><div><h3>' + u.name + '</h3>' +
            '<div class="perk">LEVEL ' + lvl + ' / ' + u.max + '</div></div></div>' +
            '<p>' + u.desc + '</p>' +
            '<div class="pips">' + Array.from({ length: u.max }, (_, i) =>
              '<span class="pip' + (i < lvl ? ' on' : '') + '"></span>').join('') + '</div>' +
            (maxed
              ? '<button class="buy" disabled>MAXED</button>'
              : '<button class="buy" data-buy="up:' + u.id + '" data-cost="' + cost + '"' + (afford ? '' : ' disabled') +
                '><i class="coin-dot"></i>' + U.fmt(cost) + '</button>') +
            '</div>';
        });
      } else if (this.shopTab === 'gear') {
        const g = GEAR[0];
        const cost = g.cost;
        const full = d.hoverboards >= 10;
        html += '<div class="card">' +
          '<div class="card-top"><div class="card-icon">' + g.icon + '</div><div><h3>' + g.name + '</h3>' +
          '<div class="perk">IN RESERVE: ' + d.hoverboards + ' / 10</div></div></div>' +
          '<p>' + g.desc + '</p>' +
          (full ? '<button class="buy" disabled>FULL</button>'
                : '<button class="buy" data-buy="gear:hoverboard" data-cost="' + cost + '"' +
                  (d.coins >= cost ? '' : ' disabled') + '><i class="coin-dot"></i>' + U.fmt(cost) + '</button>') +
          '</div>';
        html += '<div class="card"><div class="card-top"><div class="card-icon">🏆</div><div><h3>Career</h3>' +
          '<div class="perk">LIFETIME</div></div></div>' +
          '<p>' + U.fmt(d.runs) + ' runs · ' + U.fmt(d.totalDistance) + ' m travelled · ' +
          U.fmt(d.totalCoins) + ' coins banked.</p>' +
          '<button class="buy active" disabled>KEEP RUNNING</button></div>';
      } else {
        SS.CHARS.forEach((c) => {
          const owned = !!d.chars[c.id];
          const active = d.char === c.id;
          const afford = d.coins >= c.cost;
          html += '<div class="card' + (owned ? ' owned' : ' locked-char') + '">' +
            '<div class="card-top">' + charSwatch(c) + '<div><h3>' + c.name + '</h3>' +
            (c.perkText ? '<div class="perk">' + c.perkText + '</div>' : '<div class="perk">NO PERK</div>') +
            '</div></div>' +
            '<p>' + c.blurb + '</p>' +
            (active ? '<button class="buy active" disabled>EQUIPPED</button>'
              : owned ? '<button class="buy equip" data-buy="equip:' + c.id + '">EQUIP</button>'
                : '<button class="buy" data-buy="char:' + c.id + '" data-cost="' + c.cost + '"' +
                  (afford ? '' : ' disabled') + '><i class="coin-dot"></i>' + U.fmt(c.cost) + '</button>') +
            '</div>';
        });
      }

      body.innerHTML = html;
      body.querySelectorAll('[data-buy]').forEach((b) => {
        b.onclick = () => this.buy(b.dataset.buy, +(b.dataset.cost || 0));
      });
    },

    buy(what, cost) {
      const d = SS.Save.data;
      const [kind, id] = what.split(':');
      if (kind === 'equip') {
        d.char = id; SS.Save.save(); SS.Audio.play('buy'); this.renderShop(); return;
      }
      if (d.coins < cost) { SS.Audio.play('deny'); return; }
      SS.Save.spend(cost);
      if (kind === 'up') d.up[id] = (d.up[id] || 0) + 1;
      else if (kind === 'gear') d.hoverboards = Math.min(10, d.hoverboards + 1);
      else if (kind === 'char') { d.chars[id] = true; d.char = id; }
      SS.Save.save();
      SS.Audio.play('buy');
      this.renderShop();
      this.updateTitle();
    },

    /* ── missions ── */
    renderMissions(target, compact) {
      const M = SS.Missions;
      const host = target || this.el['mission-list'];
      if (this.el['mission-set']) this.el['mission-set'].textContent = M.set + 1;
      host.innerHTML = M.items.map((m) => {
        const pct = Math.min(100, (m.prog / m.target) * 100);
        return '<div class="mission' + (m.done ? ' done' : '') + '">' +
          '<div class="mission-top"><b>' + (m.done ? '✓ ' : '') + m.text + '</b>' +
          '<i>' + U.fmt(Math.min(m.prog, m.target)) + ' / ' + U.fmt(m.target) + '</i></div>' +
          '<div class="bar"><div style="width:' + pct.toFixed(1) + '%"></div></div></div>';
      }).join('');
    },

    /* ── settings sync ── */
    syncSettings() {
      const S = SS.Save.data.opt;
      $('opt-music').checked = S.music;
      $('opt-sfx').checked = S.sfx;
      $('opt-shake').checked = S.shake;
      $('opt-blur').checked = S.blur;
      $('opt-quality').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.q === S.quality));
      $('opt-diff').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.d === S.diff));
    },

    /* ── game over ── */
    gameOver(g, newBest) {
      this.el['o-score'].textContent = U.fmt(g.score);
      this.el['o-dist'].textContent = U.fmt(g.distance) + ' m';
      this.el['o-coins'].textContent = U.fmt(g.coins);
      this.el['o-mult'].textContent = 'x' + g.topMult;
      this.el['o-near'].textContent = U.fmt(g.nearTotal);
      this.el['o-newbest'].classList.toggle('hidden', !newBest);
      this.el['over-title'].textContent = newBest ? 'NEW RECORD' : U.pick(['BUSTED', 'CAUGHT', 'WIPEOUT', 'END OF THE LINE']);
      this.renderMissions(this.el['o-missions']);
      const cost = g.reviveCost();
      this.el['revive-cost'].textContent = U.fmt(cost);
      const can = SS.Save.data.coins >= cost && g.revives < 2;
      this.el['btn-revive'].disabled = !can;
      this.el['btn-revive'].classList.toggle('hidden', g.revives >= 2);
      this.show('over');
    },
  };

  function charSwatch(c) {
    return '<div class="card-icon" style="background:linear-gradient(135deg,' + c.col.shirt + ',' + c.col.pack + ')">' +
      '<span style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">🏃</span></div>';
  }

  SS.UI = UI;
})();
