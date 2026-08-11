/* ══════════════════════════════════════════════════════════
   missions.js — three rolling objectives; clearing a set
   permanently raises the base score multiplier.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;

  const POOL = [
    { key: 'coins', tiers: [70, 140, 240, 400, 650], text: (t) => 'Collect ' + t + ' coins' },
    { key: 'distance', tiers: [800, 1600, 2800, 4500, 7000], text: (t) => 'Run ' + U.fmt(t) + ' m in total' },
    { key: 'runDistance', tiers: [500, 900, 1400, 2000, 3000], text: (t) => 'Reach ' + U.fmt(t) + ' m in a single run' },
    { key: 'near', tiers: [15, 30, 55, 90, 140], text: (t) => 'Squeeze past ' + t + ' near misses' },
    { key: 'nearChain', tiers: [5, 8, 12, 16, 22], text: (t) => 'Chain ' + t + ' near misses without a break' },
    { key: 'jumps', tiers: [30, 60, 100, 160, 240], text: (t) => 'Jump ' + t + ' times' },
    { key: 'rolls', tiers: [20, 45, 80, 130, 200], text: (t) => 'Roll ' + t + ' times' },
    { key: 'powerups', tiers: [4, 8, 14, 22, 34], text: (t) => 'Grab ' + t + ' power-ups' },
    { key: 'magnet', tiers: [2, 4, 7, 11, 16], text: (t) => 'Use the magnet ' + t + ' times' },
    { key: 'jetpack', tiers: [2, 4, 6, 9, 13], text: (t) => 'Fly the jetpack ' + t + ' times' },
    { key: 'trainTime', tiers: [20, 45, 80, 130, 200], text: (t) => 'Spend ' + t + ' s riding on train roofs' },
    { key: 'boards', tiers: [2, 4, 7, 11, 16], text: (t) => 'Ride the hoverboard ' + t + ' times' },
    { key: 'score', tiers: [8000, 20000, 45000, 90000, 160000], text: (t) => 'Score ' + U.fmtShort(t) + ' in one run' },
    { key: 'laneChanges', tiers: [80, 160, 280, 440, 650], text: (t) => 'Change lanes ' + t + ' times' },
    { key: 'ramps', tiers: [5, 12, 22, 35, 55], text: (t) => 'Hit ' + t + ' launch ramps' },
    { key: 'topMult', tiers: [4, 6, 9, 13, 18], text: (t) => 'Reach a x' + t + ' multiplier' },
  ];

  /* keys whose progress is a per-run best rather than a running total */
  const BEST_KEYS = { runDistance: 1, score: 1, topMult: 1, nearChain: 1 };

  const M = {
    items: [],
    set: 0,

    load(save) {
      this.set = save.missionSet || 0;
      if (save.missions && save.missions.length === 3) {
        this.items = save.missions;
      } else {
        this.roll();
        this.persist(save);
      }
    },

    persist(save) {
      save.missions = this.items;
      save.missionSet = this.set;
    },

    roll() {
      const tier = Math.min(4, Math.floor(this.set / 2));
      const picks = U.shuffle(POOL.slice()).slice(0, 3);
      this.items = picks.map((p) => {
        const jitter = 0.85 + Math.random() * 0.4;
        const target = Math.max(1, Math.round((p.tiers[tier] * jitter) / (p.tiers[tier] > 200 ? 10 : 1)) * (p.tiers[tier] > 200 ? 10 : 1));
        return { key: p.key, target: target, prog: 0, done: false, text: p.text(target) };
      });
    },

    /** Returns an array of missions completed by this call. */
    track(key, amount) {
      const out = [];
      for (let i = 0; i < this.items.length; i++) {
        const m = this.items[i];
        if (m.done || m.key !== key) continue;
        if (BEST_KEYS[key]) m.prog = Math.max(m.prog, amount);
        else m.prog += amount;
        if (m.prog >= m.target) { m.prog = m.target; m.done = true; out.push(m); }
      }
      return out;
    },

    allDone() {
      return this.items.length === 3 && this.items.every((m) => m.done);
    },

    advance() {
      this.set++;
      this.roll();
      return this.set;
    },

    /** Permanent multiplier bonus earned from cleared sets. */
    bonus() { return this.set; },
  };

  SS.Missions = M;
})();
