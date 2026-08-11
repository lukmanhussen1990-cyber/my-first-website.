/* ══════════════════════════════════════════════════════════
   save.js — persistent progress (localStorage, fail-safe)
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const KEY = 'neonsurge.save.v1';

  function defaults() {
    return {
      v: 1,
      coins: 0,
      best: 0,
      bestDistance: 0,
      runs: 0,
      totalCoins: 0,
      totalDistance: 0,
      hoverboards: 1,
      /* upgrade levels, 0-5 */
      up: { magnet: 0, jetpack: 0, sneakers: 0, multi: 0, warp: 0, headstart: 0 },
      chars: { jet: true },
      char: 'jet',
      opt: { music: true, sfx: true, shake: true, blur: true, quality: 'high', diff: 'normal' },
      missions: null,
      missionSet: 0,
      seenHelp: false,
    };
  }

  /** Recursively fill missing keys from the defaults tree. */
  function merge(target, def) {
    for (const k in def) {
      if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) {
        if (typeof target[k] !== 'object' || target[k] === null) target[k] = {};
        merge(target[k], def[k]);
      } else if (!(k in target)) {
        target[k] = def[k];
      }
    }
    return target;
  }

  const Save = {
    data: defaults(),
    ok: true,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        this.data = raw ? merge(JSON.parse(raw), defaults()) : defaults();
      } catch (e) {
        // Private mode / corrupt blob — run in memory so the game still works.
        this.data = defaults();
        this.ok = false;
      }
      return this.data;
    },

    save() {
      if (!this.ok) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(this.data));
      } catch (e) {
        this.ok = false;
      }
    },

    reset() {
      this.data = defaults();
      this.save();
    },

    addCoins(n) {
      this.data.coins += n;
      this.data.totalCoins += n;
    },

    spend(n) {
      if (this.data.coins < n) return false;
      this.data.coins -= n;
      this.save();
      return true;
    },
  };

  SS.Save = Save;
})();
