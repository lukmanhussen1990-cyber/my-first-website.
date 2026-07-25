/* Crossy Road — everything that gets drawn in the world, built out of boxes. */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;

  var M = {};

  M.palette = {
    grassA: '#7ec94b',
    grassB: '#75c043',
    grassEdge: '#5c9c37',
    dirt: '#8a6b45',
    road: '#41454e',
    roadB: '#3b3f47',
    kerb: '#5a5f69',
    water: '#3a8fd4',
    waterB: '#3486ca',
    gravel: '#6d6459',
    sleeper: '#4d3b2c',
    rail: '#b9c0c8'
  };

  /* ── Scenery ──────────────────────────────────────────────── */

  var TREE_GREENS = ['#2f8f3e', '#37a047', '#2a7f38', '#3faa50'];

  M.tree = function (r, x, y, o) {
    var trunkH = 0.3 + o.size * 0.25;
    r.box(x, y, 0, 0.26, 0.26, trunkH, '#7a5230');
    var layers = o.layers;
    var w = 0.95 + o.size * 0.25;
    var z = trunkH;
    for (var i = 0; i < layers; i++) {
      var h = 0.42 + o.size * 0.1;
      r.box(x, y, z, w, w, h, o.color);
      z += h - 0.04;
      w *= 0.74;
    }
  };

  M.rock = function (r, x, y, o) {
    r.box(x, y, 0, 0.72, 0.68, 0.34, '#9aa1a8');
    r.box(x + 0.08 * o.size, y - 0.05, 0.32, 0.46, 0.44, 0.26, '#aab1b8');
  };

  M.bush = function (r, x, y, o) {
    r.box(x, y, 0, 0.86, 0.86, 0.42 + o.size * 0.2, '#3e8b3a');
  };

  M.lamp = function (r, x, y) {
    r.box(x, y, 0, 0.16, 0.16, 1.15, '#5a616b');
    r.box(x, y, 1.15, 0.34, 0.3, 0.18, '#ffe9a8');
  };

  M.scenery = function (r, o, x, y) {
    if (o.kind === 'tree') M.tree(r, x, y, o);
    else if (o.kind === 'rock') M.rock(r, x, y, o);
    else if (o.kind === 'lamp') M.lamp(r, x, y);
    else M.bush(r, x, y, o);
  };

  /* ── Vehicles ─────────────────────────────────────────────── */

  M.VEHICLES = {
    car:    { len: 1.55, weight: 5 },
    taxi:   { len: 1.55, weight: 2 },
    police: { len: 1.6,  weight: 1 },
    truck:  { len: 3.2,  weight: 3 },
    bus:    { len: 3.0,  weight: 2 }
  };

  var CAR_COLORS = ['#e8453c', '#3f7ae0', '#f2f2f2', '#7d47cf', '#22b573', '#ff8c1a', '#4a5568', '#e94f9a', '#ffd23f', '#16a5c9'];
  var GLASS = '#1e2a38';

  /**
   * Draw a vehicle. `dir` is +1 (moving right) or −1 and body-local +f points
   * at the front. Parts go through the renderer's sorted batch, so nothing
   * needs to be emitted in a particular order.
   */
  M.vehicle = function (r, v, y, t) {
    var d = v.dir, cx = v.x;
    function X(f) { return cx + f * d; }      // f: distance toward the front
    var body = v.color;

    if (v.kind === 'truck') {
      // laid out so the whole rig is centred on cx (matches the hit box)
      M.wheels(r, cx, y, [-1.3, -0.35, 1.15], d, 0.96);
      r.part(X(-0.6), y, 0.16, 2.0, 0.92, 0.78, '#e9edf2');         // trailer
      r.part(X(-0.6), y, 0.94, 1.94, 0.88, 0.05, '#cfd6de');
      r.part(X(1.07), y, 0.14, 1.05, 0.92, 0.42, body);             // cab
      r.part(X(1.03), y, 0.56, 0.82, 0.84, 0.36, body);
      r.part(X(1.03), y - 0.43, 0.62, 0.6, 0.02, 0.24, GLASS);
      M.endLights(r, cx + 1.58, y, d, 0.3, 0.22);
    } else if (v.kind === 'bus') {
      M.wheels(r, cx, y, [-1.05, 1.0], d, 1.0);
      r.part(cx, y, 0.16, 2.9, 0.95, 0.82, body);
      r.part(cx, y, 0.98, 2.86, 0.9, 0.06, util.shade(body, 0.86));
      r.part(cx, y - 0.48, 0.52, 2.4, 0.02, 0.32, GLASS);           // side windows
      M.endLights(r, cx + 1.46, y, d, 0.3, 0.28);
    } else {
      var isPolice = v.kind === 'police';
      M.wheels(r, cx, y, [-0.5, 0.5], d, 0.9);
      r.part(cx, y, 0.13, 1.5, 0.86, 0.35, body);
      r.part(X(-0.1), y, 0.48, 0.88, 0.8, 0.3, isPolice ? '#f2f4f7' : body);
      r.part(X(-0.1), y - 0.41, 0.54, 0.66, 0.02, 0.2, GLASS);      // side glass
      if (v.kind === 'taxi') r.part(X(-0.1), y, 0.78, 0.4, 0.24, 0.14, '#ffd23f');
      if (isPolice) {
        var blink = Math.floor(t * 6) % 2 === 0;
        r.part(X(-0.1), y - 0.16, 0.78, 0.26, 0.2, 0.12, blink ? '#ff3b30' : '#7a1f1a');
        r.part(X(-0.1), y + 0.16, 0.78, 0.26, 0.2, 0.12, blink ? '#8a1f6a' : '#2f6ad0');
      }
      M.endLights(r, cx + 0.75, y, d, 0.26, 0.2);
    }
    r.drawParts();
  };

  M.wheels = function (r, cx, y, offsets, d, width) {
    for (var i = 0; i < offsets.length; i++) {
      r.part(cx + offsets[i] * d, y, 0, 0.32, width, 0.15, '#23262c');
    }
  };

  /** Lights on the +x end only — the −x end faces away from the camera.
   *  Heading right you see headlamps, heading left you see tail lights. */
  M.endLights = function (r, x, y, d, size, z) {
    var col = d > 0 ? '#fff3c4' : '#ff5040';
    r.part(x, y - 0.28, z, 0.07, size, 0.13, col);
    r.part(x, y + 0.28, z, 0.07, size, 0.13, col);
  };

  /* ── Train ────────────────────────────────────────────────── */

  M.train = function (r, tr, y, t) {
    var d = tr.dir, n = tr.cars;
    for (var i = 0; i < n; i++) {
      // car 0 is the locomotive, at the front
      var off = (i === 0 ? 0 : -1.6 - (i - 1) * 3.0 - 1.7);
      var cx = tr.x + off * d;
      var loco = i === 0;
      var len = loco ? 3.4 : 2.9;
      var col = loco ? '#c8443a' : '#4c5560';
      M.wheels(r, cx, y, [-len * 0.3, len * 0.3], d, 1.02);
      r.part(cx, y, 0.12, len, 1.0, 0.9, col);
      r.part(cx, y, 1.02, len - 0.3, 0.86, 0.16, util.shade(col, 0.82));
      r.part(cx, y - 0.51, 0.58, len - 0.7, 0.02, 0.3, '#1c2530');
      if (loco) {
        r.part(cx + len * 0.5, y, 0.34, 0.1, 0.55, 0.34,
          d > 0 ? (Math.floor(t * 10) % 2 ? '#fff6cf' : '#ffd23f') : '#c23a30');
        r.part(cx - len * 0.34 * d, y, 1.18, 0.3, 0.3, 0.35, '#333a44');
      }
    }
    r.drawParts();
  };

  M.signal = function (r, x, y, on) {
    r.box(x, y, 0, 0.14, 0.14, 1.0, '#4a5057');
    r.box(x, y, 1.0, 0.4, 0.24, 0.2, '#2b3036');
    r.box(x - 0.1, y, 1.03, 0.16, 0.26, 0.14, on ? '#ff3b30' : '#5c2a26');
    r.box(x + 0.1, y, 1.03, 0.16, 0.26, 0.14, on ? '#5c2a26' : '#ff3b30');
  };

  /* ── River props ──────────────────────────────────────────── */

  M.log = function (r, lg, y) {
    var len = lg.len;
    r.box(lg.x, y, -0.08, len, 0.82, 0.36, '#8b5a2b');
    r.box(lg.x, y, 0.26, len - 0.14, 0.7, 0.04, '#a06b34');
    r.box(lg.x + len * 0.5 - 0.04, y, -0.06, 0.09, 0.74, 0.32, '#6d4522');  // cut end
  };

  M.pad = function (r, p, y) {
    r.box(p.x, y, -0.05, 0.78, 0.78, 0.12, '#237d45');
    r.box(p.x, y, 0.07, 0.66, 0.66, 0.03, '#35a95f');
    r.box(p.x - 0.14, y + 0.1, 0.1, 0.24, 0.2, 0.02, '#2b8e4f');   // leaf notch
    if (p.flower) r.box(p.x + 0.18, y - 0.16, 0.1, 0.18, 0.18, 0.12, '#f472b6');
  };

  /* ── Pickups ──────────────────────────────────────────────── */

  M.coin = function (r, x, y, t) {
    var spin = t * 3.4;
    var w = Math.abs(Math.cos(spin)) * 0.34 + 0.05;
    var d = Math.abs(Math.sin(spin)) * 0.34 + 0.05;
    var z = 0.34 + Math.sin(t * 2.6) * 0.07;
    r.shadow(x, y, 0.5, 0.5, 0.13);
    r.box(x, y, z, w, d, 0.36, '#ffcf3f');
    r.box(x, y, z + 0.36, w * 0.6, d * 0.6, 0.02, '#fff0a8');
  };

  /* ── Eagle (the "stop dawdling" enforcer) ─────────────────── */

  M.eagle = function (r, x, y, z, t) {
    var flap = Math.sin(t * 16) * 0.22;
    r.part(x, y, z, 0.55, 1.0, 0.42, '#5b4632');
    r.part(x, y - 0.6, z + 0.16, 0.42, 0.4, 0.34, '#efe9dd');
    r.part(x, y - 0.86, z + 0.22, 0.16, 0.2, 0.12, '#ffb02e');
    r.part(x - 0.72, y, z + 0.2 + flap, 0.9, 0.62, 0.12, '#6b543c');
    r.part(x + 0.72, y, z + 0.2 - flap, 0.9, 0.62, 0.12, '#6b543c');
    r.part(x, y + 0.62, z + 0.1, 0.34, 0.4, 0.1, '#efe9dd');
    r.drawParts();
  };

  /* ── Ground rows ──────────────────────────────────────────── */

  M.rowGround = function (r, row, x0, x1, t) {
    var p = M.palette;
    var y = row.y, y0 = y - 0.5, y1 = y + 0.5;

    if (row.type === 'road') {
      r.tile(x0, x1, y0, y1, 0, row.shade ? p.roadB : p.road);
      if (row.markLeading) {
        r.beginFlat('rgba(255,255,255,.72)');
        for (var mx = Math.floor(x0); mx < x1; mx += 2) {
          r.addFlat(mx, mx + 1.05, y1 - 0.055, y1 + 0.055, 0.002);
        }
        r.endFlat();
      }
      if (row.kerbNear) r.tile(x0, x1, y0 - 0.02, y0 + 0.06, 0.002, p.kerb);
      if (row.kerbFar) r.tile(x0, x1, y1 - 0.06, y1 + 0.02, 0.002, p.kerb);
    } else if (row.type === 'water') {
      r.tile(x0, x1, y0, y1, 0, row.shade ? p.waterB : p.water);
      // drifting highlight bands
      var off = (t * 0.35 * row.dir) % 2;
      var wx;
      r.beginFlat('rgba(255,255,255,.15)');
      for (wx = Math.floor(x0 / 2) * 2 + off; wx < x1; wx += 2) {
        var wob = Math.sin(t * 1.6 + wx * 0.6) * 0.08;
        r.addFlat(wx, wx + 0.9, y - 0.16 + wob, y - 0.06 + wob, 0.003);
        r.addFlat(wx + 0.5, wx + 1.2, y + 0.16 - wob, y + 0.24 - wob, 0.003);
      }
      r.endFlat();
      if (row.bankNear) r.tile(x0, x1, y0 - 0.04, y0 + 0.05, 0.004, '#6f9c4a');
      if (row.bankFar) r.tile(x0, x1, y1 - 0.05, y1 + 0.04, 0.004, '#6f9c4a');
    } else if (row.type === 'rail') {
      r.tile(x0, x1, y0, y1, 0, p.gravel);
      r.beginFlat(p.sleeper);
      for (var sx = Math.floor(x0); sx < x1; sx += 0.62) {
        r.addFlat(sx, sx + 0.34, y0 + 0.12, y1 - 0.12, 0.004);
      }
      r.endFlat();
      r.beginFlat(p.rail);
      r.addFlat(x0, x1, y - 0.3, y - 0.22, 0.006);
      r.addFlat(x0, x1, y + 0.22, y + 0.3, 0.006);
      r.endFlat();
    } else {
      r.tile(x0, x1, y0, y1, 0, row.shade ? p.grassB : p.grassA);
      if (row.flowers) {
        for (var i = 0; i < row.flowers.length; i++) {
          var f = row.flowers[i];
          r.tile(f.x, f.x + 0.16, y + f.o, y + f.o + 0.16, 0.003, f.c);
        }
      }
    }
  };

  CR.models = M;
  CR.CAR_COLORS = CAR_COLORS;
})(window);
