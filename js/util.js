/* Crossy Road — small shared helpers (math, colour, storage, RNG). */
(function (global) {
  'use strict';

  var CR = global.CR || (global.CR = {});

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Frame-rate independent easing toward a target. */
  function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }

  /** Deterministic 32-bit PRNG so a run can be replayed from a seed. */
  function rng(seed) {
    var s = seed >>> 0 || 1;
    var f = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (lo, hi) { return lo + f() * (hi - lo); };
    f.int = function (lo, hi) { return Math.floor(lo + f() * (hi - lo + 1)); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length) % arr.length]; };
    f.chance = function (p) { return f() < p; };
    /** Weighted pick: entries are [value, weight]. */
    f.weighted = function (entries) {
      var total = 0, i;
      for (i = 0; i < entries.length; i++) total += entries[i][1];
      var r = f() * total;
      for (i = 0; i < entries.length; i++) {
        r -= entries[i][1];
        if (r <= 0) return entries[i][0];
      }
      return entries[entries.length - 1][0];
    };
    return f;
  }

  /* ── Colour ─────────────────────────────────────────────── */

  function hexToRgb(hex) {
    var h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  var shadeCache = Object.create(null);

  /** Multiply a colour's brightness; results are cached (hot path). */
  function shade(hex, mul) {
    var key = hex + '|' + mul;
    var hit = shadeCache[key];
    if (hit) return hit;
    var c = hexToRgb(hex);
    var out = 'rgb(' +
      clamp(Math.round(c[0] * mul), 0, 255) + ',' +
      clamp(Math.round(c[1] * mul), 0, 255) + ',' +
      clamp(Math.round(c[2] * mul), 0, 255) + ')';
    shadeCache[key] = out;
    return out;
  }

  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  function mix(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    return 'rgb(' +
      Math.round(lerp(a[0], b[0], t)) + ',' +
      Math.round(lerp(a[1], b[1], t)) + ',' +
      Math.round(lerp(a[2], b[2], t)) + ')';
  }

  /* ── Persistence (never throws — private mode, file://, etc.) ── */

  var store = {
    get: function (key, fallback) {
      try {
        var v = global.localStorage.getItem('crossy.' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (key, value) {
      try { global.localStorage.setItem('crossy.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    }
  };

  CR.util = {
    clamp: clamp, lerp: lerp, damp: damp, rng: rng,
    shade: shade, rgba: rgba, mix: mix, hexToRgb: hexToRgb,
    store: store,
    TAU: Math.PI * 2
  };
})(window);
