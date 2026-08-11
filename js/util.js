/* ══════════════════════════════════════════════════════════
   util.js — math, colour and misc helpers
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));

  /** Frame-rate independent exponential smoothing. */
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

  const smoothstep = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
  const easeOutElastic = (t) =>
    t === 0 || t === 1 ? t : Math.pow(2, -9 * t) * Math.sin((t * 10 - 0.75) * 2.1) + 1;

  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const chance = (p) => Math.random() < p;
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };

  /** Weighted pick. items: [{w:number, ...}] */
  function weighted(items) {
    let total = 0;
    for (const it of items) total += it.w;
    let r = Math.random() * total;
    for (const it of items) { r -= it.w; if (r <= 0) return it; }
    return items[items.length - 1];
  }

  /* ── colour ─────────────────────────────────────────── */

  /** '#rrggbb' → [r,g,b] */
  function hex(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /** Multiply brightness, clipped. */
  function shade(c, m) {
    return [
      clamp(c[0] * m, 0, 255),
      clamp(c[1] * m, 0, 255),
      clamp(c[2] * m, 0, 255),
    ];
  }

  /** Linear blend between two rgb triples. */
  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function css(c, a) {
    return a === undefined || a >= 1
      ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
      : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  }

  /* ── formatting ─────────────────────────────────────── */

  function fmt(n) {
    n = Math.floor(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function fmtShort(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
    return fmt(n);
  }

  /* ── deterministic RNG (mulberry32) ─────────────────── */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  SS.util = {
    clamp, lerp, invLerp, damp, smoothstep,
    easeOutCubic, easeInCubic, easeOutBack, easeOutElastic,
    rand, randInt, pick, chance, shuffle, weighted,
    hex, shade, mix, css, fmt, fmtShort, rng,
    TAU: Math.PI * 2,
  };
})();
