(function () {
  'use strict';

  window.Photosynthesis = window.Photosynthesis || {};

  // Palette: exact values from the shared spec.
  var P = {
    ink: '#0c1a16',
    panel: '#13261f',
    text: '#eaf5ee',
    muted: '#9fbfb0',
    sun: '#ffd166',
    oxygen: '#8ecae6',
    oxygenEdge: '#219ebc',
    waterO: '#ff6b6b',
    waterH: '#e8f1f5',
    carbon: '#5c677d',
    atp: '#f4a261',
    nadph: '#b388eb',
    electron: '#4cc9f0',
    proton: '#ff99c8',
    sugar: '#a7e8a0',
    glucose: '#ffb703',
    leaf: '#2d6a4f',
    leafMid: '#40916c',
    leafLight: '#95d5b2',
    grana: '#52b788',
    granaEdge: '#b7e4c7',
    stroma: '#1b4332',
    success: '#6bcb77'
  };

  // Default sizes (fractions of u) from the spec table.
  var DEFAULT_SIZE = {
    photon: 0.014,
    electron: 0.012,
    proton: 0.012,
    water: 0.035,
    o2: 0.03,
    co2: 0.04,
    atp: 0.035,
    nadph: 0.035,
    sugar: 0.022,
    glucose: 0.10,
    burst: 0.08,
    popup: 0.03
  };

  var canvas = null;
  var ctx = null;
  var cssW = 0;
  var cssH = 0;
  var dpr = 1;
  var u = 1;

  // Offscreen caches. They depend only on the canvas size and dpr, so resize()
  // drops them all and they are rebuilt on next use.
  var cache = {
    staticLayer: null,
    sunRays: null,
    focus: {}
  };

  function resetCache() {
    cache.staticLayer = null;
    cache.sunRays = null;
    cache.focus = {};
  }

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Normalized (0..1) to CSS pixels.
  function px(x) { return x * cssW; }
  function py(y) { return y * cssH; }

  var FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  // Visible labels live in content.js. Read them at draw time, since content.js
  // loads before this file but may be replaced in tests.
  function readUi() {
    var c = window.Photosynthesis && window.Photosynthesis.content;
    var ui = (c && c.ui) || {};
    return { labels: ui.labels || {}, scene: ui.scene || {} };
  }

  function textOf(map, key) {
    var v = map && map[key];
    return typeof v === 'string' ? v : '';
  }

  function readGlow(g) {
    g = g || {};
    return {
      light: clamp01(num(g.light, 0)),
      turbine: clamp01(num(g.turbine, 0)),
      calvin: clamp01(num(g.calvin, 0))
    };
  }

  function hexRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgba(hex, a) {
    var c = hexRgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  // Glow sprites are cached per colour, so only six-digit hex colours get one.
  var HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  // Small deterministic random generator, so the stroma texture never shifts.
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Rounded-rectangle subpath with no beginPath, so several shapes can share one path.
  function rrSub(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function rrPath(g, x, y, w, h, r) {
    g.beginPath();
    rrSub(g, x, y, w, h, r);
  }

  function hexPath(g, cx, cy, r) {
    g.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      var x = cx + r * Math.cos(a);
      var y = cy + r * Math.sin(a);
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function setFont(px, weight) {
    ctx.font = (weight || '600') + ' ' + px.toFixed(1) + 'px ' + FONT_STACK;
  }

  // Light text with a dark halo, so it reads on any band.
  function haloText(str, x, y, color, px, align) {
    if (!str) return;
    setFont(px);
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * 0.3);
    ctx.strokeStyle = P.ink;
    ctx.strokeText(str, x, y);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  // Letter-spaced caps for zone labels. Draws each character with a halo.
  function spacedText(str, x, y, px, spacing, color, align) {
    if (!str) return;
    setFont(px, '600');
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    var chars = Array.from(str);
    var widths = [];
    var total = 0;
    for (var i = 0; i < chars.length; i++) {
      var cw = ctx.measureText(chars[i]).width;
      widths.push(cw);
      total += cw;
    }
    total += spacing * (chars.length - 1);
    var sx = align === 'right' ? x - total : x;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, px * 0.35);
    ctx.strokeStyle = P.ink;
    ctx.fillStyle = color;
    for (var j = 0; j < chars.length; j++) {
      ctx.strokeText(chars[j], sx, y);
      ctx.fillText(chars[j], sx, y);
      sx += widths[j] + spacing;
    }
  }

  // Soft radial sprites, one per colour, cached. Drawn additively.
  var sprites = {};

  function glowSprite(hex) {
    var s = sprites[hex];
    if (s) return s;
    s = document.createElement('canvas');
    s.width = 64;
    s.height = 64;
    var g = s.getContext('2d');
    var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    var rgb = hexRgb(hex).join(',');
    grad.addColorStop(0, 'rgba(' + rgb + ',1)');
    grad.addColorStop(0.3, 'rgba(' + rgb + ',0.5)');
    grad.addColorStop(0.65, 'rgba(' + rgb + ',0.12)');
    grad.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    sprites[hex] = s;
    return s;
  }

  // Additive glow centred on (x, y), radius r px, strength a (0..1).
  function softGlow(hex, x, y, r, a) {
    if (a <= 0 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, a) * ctx.globalAlpha;
    ctx.drawImage(glowSprite(hex), x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  }

  function init(c) {
    if (!c || typeof c.getContext !== 'function') return;
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    if (!canvas || !ctx) return;
    cssW = canvas.clientWidth || 1;
    cssH = canvas.clientHeight || 1;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = Math.min(cssW, cssH);
    resetCache();
  }

  // ---- Static layer: built once per canvas size and cached offscreen ----

  function ensureStaticLayer() {
    if (cache.staticLayer) return;
    var layer = document.createElement('canvas');
    layer.width = canvas.width;
    layer.height = canvas.height;
    var g = layer.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSkyAndLeaf(g);
    drawChloroplast(g);
    drawStroma(g);
    drawGrana(g);
    drawChain(g);
    drawPhotosystems(g);
    drawCalvinTrack(g);
    cache.staticLayer = layer;
  }

  function drawSkyAndLeaf(g) {
    g.fillStyle = P.ink;
    g.fillRect(0, 0, cssW, cssH);

    var sky = g.createLinearGradient(0, 0, 0, py(0.31));
    sky.addColorStop(0, '#0e2b33');
    sky.addColorStop(1, '#1a4140');
    g.fillStyle = sky;
    g.fillRect(0, 0, cssW, py(0.31));

    // Leaf surface: a green band with a lighter top edge and faint veins.
    var top = py(0.25);
    var bottom = py(0.31);
    var leaf = g.createLinearGradient(0, top, 0, bottom);
    leaf.addColorStop(0, P.leafMid);
    leaf.addColorStop(1, P.leaf);
    g.fillStyle = leaf;
    g.fillRect(-2, top, cssW + 4, bottom - top + 2);

    g.save();
    g.strokeStyle = P.leafLight;
    g.globalAlpha = 0.9;
    g.lineWidth = Math.max(1.5, 0.004 * u);
    g.beginPath();
    g.moveTo(0, top);
    g.lineTo(cssW, top);
    g.stroke();
    g.globalAlpha = 0.28;
    g.lineWidth = Math.max(1, 0.0022 * u);
    for (var i = 1; i <= 6; i++) {
      var vx = cssW * i / 7;
      g.beginPath();
      g.moveTo(vx, top + 2);
      g.quadraticCurveTo(vx + cssW * 0.03, (top + bottom) / 2, vx - cssW * 0.02, bottom);
      g.stroke();
    }
    g.restore();
  }

  // Chloroplast outline, inset by `inset` px (used for both membranes).
  function bodyPath(g, inset) {
    rrPath(g, px(0.05) + inset, py(0.30) + inset,
      px(0.90) - 2 * inset, py(0.67) - 2 * inset, 0.07 * u - inset);
  }

  function drawChloroplast(g) {
    bodyPath(g, 0);
    var body = g.createLinearGradient(0, py(0.30), 0, py(0.97));
    body.addColorStop(0, P.stroma);
    body.addColorStop(1, '#122e24');
    g.fillStyle = body;
    g.fill();

    // Thylakoid band: a lighter tint over y 0.31 to 0.61, clipped to the body.
    g.save();
    bodyPath(g, 0);
    g.clip();
    var band = g.createLinearGradient(0, py(0.31), 0, py(0.61));
    band.addColorStop(0, rgba(P.leafMid, 0));
    band.addColorStop(0.2, rgba(P.leafMid, 0.16));
    band.addColorStop(0.8, rgba(P.leafMid, 0.16));
    band.addColorStop(1, rgba(P.leafMid, 0));
    g.fillStyle = band;
    g.fillRect(0, py(0.31), cssW, py(0.30));
    g.restore();

    drawMembraneShade(g);

    // Double membrane: an outer outline and an inner outline.
    g.save();
    g.strokeStyle = P.leafLight;
    g.globalAlpha = 0.85;
    g.lineWidth = Math.max(2, 0.007 * u);
    bodyPath(g, 0);
    g.stroke();
    g.globalAlpha = 0.4;
    g.lineWidth = Math.max(1, 0.0035 * u);
    bodyPath(g, 0.016 * u);
    g.stroke();
    g.restore();

    drawTopHighlight(g);
  }

  // Soft inner shadow: a blurred dark shape outside the body, clipped to the body,
  // so only a soft dark rim shows inside the membrane.
  function drawMembraneShade(g) {
    g.save();
    bodyPath(g, 0);
    g.clip();
    g.beginPath();
    g.rect(-cssW, -cssH, cssW * 3, cssH * 3);
    rrSub(g, px(0.05), py(0.30), px(0.90), py(0.67), 0.07 * u);
    g.shadowColor = rgba(P.ink, 0.7);
    g.shadowBlur = 0.03 * u * dpr;   // shadow blur is in device pixels
    g.fillStyle = P.ink;
    g.fill('evenodd');
    g.restore();
  }

  // Thin light line just inside the upper membrane, fading toward the corners.
  function drawTopHighlight(g) {
    var x0 = px(0.05);
    var x1 = px(0.95);
    var y = py(0.30) + Math.max(3, 0.0075 * u);
    var grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, rgba(P.text, 0));
    grad.addColorStop(0.25, rgba(P.text, 0.3));
    grad.addColorStop(0.75, rgba(P.text, 0.3));
    grad.addColorStop(1, rgba(P.text, 0));
    g.save();
    bodyPath(g, 0);
    g.clip();
    g.strokeStyle = grad;
    g.lineWidth = Math.max(1, 0.0025 * u);
    g.beginPath();
    g.moveTo(x0, y);
    g.lineTo(x1, y);
    g.stroke();
    g.restore();
  }

  function drawStroma(g) {
    var rnd = seeded(7);
    var count = Math.min(240, Math.round(cssW * cssH / 2400));
    g.save();
    g.fillStyle = P.leafLight;
    for (var i = 0; i < count; i++) {
      var x = px(0.08) + rnd() * px(0.84);
      var y = py(0.64) + rnd() * py(0.30);
      g.globalAlpha = 0.04 + rnd() * 0.07;
      g.beginPath();
      g.arc(x, y, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // Grana: stacks of thylakoid discs in x 0.12 to 0.52, y 0.36 to 0.56.
  function drawGrana(g) {
    var stacks = cssW < 600 ? 3 : 4;
    var discs = 5;
    var top = py(0.37);
    var bottom = py(0.55);
    var slot = px(0.40) / stacks;
    var rx = slot * 0.36;
    var ry = Math.max(3, 0.0125 * u);
    g.save();
    g.lineWidth = Math.max(1, 0.0025 * u);
    for (var s = 0; s < stacks; s++) {
      var cx = px(0.12) + slot * (s + 0.5);
      for (var d = 0; d < discs; d++) {
        var cy = top + (bottom - top) * d / (discs - 1);
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        g.globalAlpha = 0.9;
        g.fillStyle = P.grana;
        g.fill();
        g.globalAlpha = 0.75;
        g.strokeStyle = P.granaEdge;
        g.stroke();
      }
    }
    g.restore();
  }

  // Electron transport chain: a dotted path from x 0.30 to 0.86, with seven carrier blocks along y 0.46.
  function drawChain(g) {
    var y = py(0.46);
    g.save();
    g.setLineDash([Math.max(2, 0.008 * u), Math.max(3, 0.012 * u)]);
    g.strokeStyle = P.electron;
    g.globalAlpha = 0.3;
    g.lineWidth = Math.max(1, 0.0028 * u);
    g.beginPath();
    g.moveTo(px(0.30), y);
    g.lineTo(px(0.86), y);
    g.stroke();
    g.restore();

    var size = Math.max(9, 0.03 * u);
    g.save();
    for (var i = 0; i < 7; i++) {
      var cx = px(0.32 + 0.08 * i);
      rrPath(g, cx - size / 2, y - size / 2, size, size, size * 0.28);
      g.fillStyle = P.leafMid;
      g.fill();
      g.strokeStyle = P.leafLight;
      g.lineWidth = Math.max(1, 0.0028 * u);
      g.stroke();
    }
    g.restore();
  }

  // Photosystem II (water-splitting site) and the photosystem I-style marker.
  function drawPhotosystems(g) {
    var cx = px(0.28);
    var cy = py(0.42);
    var r = 0.034 * u;
    g.save();
    g.beginPath();
    g.ellipse(cx, cy, r * 1.25, r * 0.95, 0, 0, Math.PI * 2);
    g.fillStyle = P.leaf;
    g.fill();
    g.strokeStyle = P.leafLight;
    g.lineWidth = Math.max(1.5, 0.004 * u);
    g.stroke();

    g.fillStyle = P.leafLight;
    for (var k = 0; k < 6; k++) {
      var a = k * Math.PI / 3;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.55, Math.max(1.2, 0.005 * u), 0, Math.PI * 2);
      g.fill();
    }

    // Water-splitting cluster: four small dots in the oxygen colour.
    var m = Math.max(1.4, 0.0055 * u);
    g.fillStyle = P.oxygen;
    var offs = [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]];
    for (var j = 0; j < offs.length; j++) {
      g.beginPath();
      g.arc(cx + offs[j][0] * r, cy + offs[j][1] * r, m, 0, Math.PI * 2);
      g.fill();
    }

    // Photosystem I-style marker at the NADPH station.
    var sx = px(0.86);
    var sy = py(0.46);
    var sr = 0.02 * u;
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fillStyle = P.leaf;
    g.fill();
    g.strokeStyle = P.nadph;
    g.lineWidth = Math.max(1.5, 0.0045 * u);
    g.stroke();
    g.beginPath();
    g.arc(sx, sy, sr * 0.45, 0, Math.PI * 2);
    g.fillStyle = P.nadph;
    g.fill();
    g.restore();
  }

  // Calvin cycle track. The turning arrows and glow are drawn each frame.
  function drawCalvinTrack(g) {
    var cx = px(0.5);
    var cy = py(0.80);
    var R = 0.16 * u;
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.fillStyle = rgba(P.ink, 0.35);
    g.fill();
    g.strokeStyle = P.leafLight;
    g.globalAlpha = 0.35;
    g.lineWidth = Math.max(2, 0.006 * u);
    g.stroke();
    g.restore();
  }

  // ---- Per-frame layers ----

  // Turbine spin is the one value kept between frames. It is animation timing
  // only, so the speed can change smoothly with glow.turbine.
  var spinPhase = 0;
  var lastT = null;

  function advanceSpin(t, glowTurbine, still) {
    if (still) {
      spinPhase = 0;
      lastT = t;
      return;
    }
    if (lastT === null) lastT = t;
    var dt = Math.min(0.1, Math.max(0, t - lastT));
    lastT = t;
    spinPhase = (spinPhase + dt * (0.5 + 6.5 * glowTurbine)) % (Math.PI * 2);
  }

  // Sun rays: tapered, soft-edged wedges. Drawn once per canvas size into a sprite,
  // which is then turned as a whole each frame.
  function sunRaySprite() {
    if (cache.sunRays) return cache.sunRays;
    var r = 0.045 * u;
    var reach = r * 2.4;
    var side = Math.max(2, Math.ceil(2 * reach * dpr));
    var k = side / (2 * reach);   // CSS px to sprite px
    var c = document.createElement('canvas');
    c.width = side;
    c.height = side;
    var g = c.getContext('2d');
    g.setTransform(k, 0, 0, k, side / 2, side / 2);
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6;
      var ca = Math.cos(a);
      var sa = Math.sin(a);
      var r0 = r * 1.3;
      var r1 = r * (i % 2 ? 1.8 : 2.2);   // alternating lengths
      var w = r * 0.12;                    // half-width at the base
      var x0 = ca * r0;
      var y0 = sa * r0;
      var x1 = ca * r1;
      var y1 = sa * r1;
      var fade = g.createLinearGradient(x0, y0, x1, y1);
      fade.addColorStop(0, rgba(P.sun, 0.9));
      fade.addColorStop(0.5, rgba(P.sun, 0.35));
      fade.addColorStop(1, rgba(P.sun, 0));
      g.beginPath();
      g.moveTo(x0 - sa * w, y0 + ca * w);
      g.lineTo(x1, y1);
      g.lineTo(x0 + sa * w, y0 - ca * w);
      g.closePath();
      g.fillStyle = fade;
      g.fill();
    }
    cache.sunRays = { canvas: c, reach: reach };
    return cache.sunRays;
  }

  function drawSun(glow, t, still) {
    var cx = px(0.12);
    var cy = py(0.10);
    var r = 0.045 * u;
    var light = glow.light;

    // Wide haze, and a corona that brightens with light.
    softGlow(P.sun, cx, cy, (0.2 + 0.05 * light) * u, 0.4 + 0.4 * light);
    softGlow(P.sun, cx, cy, r * 2.6, 0.12 + 0.5 * light);

    // Soft rays, turning slowly (not under reduced motion).
    var rays = sunRaySprite();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(still ? 0 : t * 0.08);
    ctx.globalAlpha *= 0.6 + 0.4 * light;
    ctx.drawImage(rays.canvas, -rays.reach, -rays.reach, 2 * rays.reach, 2 * rays.reach);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = P.sun;
    ctx.fill();
    ctx.restore();
    softGlow(P.sun, cx, cy, r * 1.5, 0.15 + 0.5 * light);
  }

  function drawPsiiHalo(glow) {
    softGlow(P.sun, px(0.28), py(0.42), (0.085 + 0.03 * glow.light) * u, 0.3 + 0.6 * glow.light);
  }

  // ATP synthase: a knob with three blades that spin, faster when glowing.
  function drawTurbine(glow, still) {
    var cx = px(0.60);
    var cy = py(0.58);
    var r = 0.028 * u;
    softGlow(P.atp, cx, cy, r * 3, 0.1 + 0.9 * glow.turbine);
    if (glow.turbine > 0.2) drawTurbineRing(cx, cy, r, glow.turbine, still);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(P.ink, 0.55);
    ctx.fill();
    ctx.strokeStyle = P.atp;
    ctx.globalAlpha = 0.45 + 0.55 * glow.turbine;
    ctx.lineWidth = Math.max(1.5, 0.005 * u);
    ctx.stroke();

    ctx.globalAlpha = 0.6 + 0.4 * glow.turbine;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.5, 0.009 * u);
    for (var k = 0; k < 3; k++) {
      var a = spinPhase + k * Math.PI * 2 / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 0.85);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = P.atp;
    ctx.fill();
    ctx.restore();
  }

  // Bright ring around ATP synthase while it glows. In motion it pulses: tight and bright
  // at the peak of the glow, wider and fading as the glow falls. Reduced motion keeps it fixed.
  function drawTurbineRing(cx, cy, r, glowValue, still) {
    var k = clamp01((glowValue - 0.2) / 0.8);   // 0 at the threshold, 1 at the peak
    var rad = still ? r * 1.6 : r * (1.6 + 0.9 * (1 - k));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.9 * k;
    ctx.strokeStyle = P.atp;
    ctx.lineWidth = Math.max(2, 0.007 * u);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Calvin cycle ring with four turning arrows. glow.calvin brightens it.
  function drawCalvin(glow, t, still) {
    var cx = px(0.5);
    var cy = py(0.80);
    var R = 0.16 * u;
    softGlow(P.sugar, cx, cy, R * 1.5, 0.05 + 0.85 * glow.calvin);

    var turn = still ? 0 : t * 0.25;
    var hs = Math.max(4, 0.022 * u);
    ctx.save();
    ctx.strokeStyle = P.sugar;
    ctx.fillStyle = P.sugar;
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.25 + 0.6 * glow.calvin;
    ctx.lineWidth = Math.max(2, 0.008 * u);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.5 + 0.5 * glow.calvin;
    ctx.lineWidth = Math.max(1.5, 0.006 * u);
    for (var i = 0; i < 4; i++) {
      var a = turn + i * Math.PI / 2;
      var start = a - 0.22;
      var end = a + 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, end, false);
      ctx.stroke();

      // Arrowhead at the end of the arc, pointing along increasing angle.
      var ex = cx + Math.cos(end) * R;
      var ey = cy + Math.sin(end) * R;
      var tx = -Math.sin(end);
      var ty = Math.cos(end);
      var nx = Math.cos(end);
      var ny = Math.sin(end);
      ctx.beginPath();
      ctx.moveTo(ex + tx * hs, ey + ty * hs);
      ctx.lineTo(ex + nx * hs * 0.6, ey + ny * hs * 0.6);
      ctx.lineTo(ex - nx * hs * 0.6, ey - ny * hs * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (glow.calvin > 0) drawCalvinArc(cx, cy, R, glow.calvin, t, still);
  }

  // A faint bright arc that orbits the Calvin ring while it glows. Under reduced motion it stays at the bottom.
  function drawCalvinArc(cx, cy, R, glowValue, t, still) {
    var a = still ? Math.PI / 2 : t * 2.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.35 * glowValue;
    ctx.strokeStyle = P.sugar;
    ctx.lineWidth = Math.max(3, 0.012 * u);
    ctx.beginPath();
    ctx.arc(cx, cy, R, a - 0.45, a + 0.45);
    ctx.stroke();
    ctx.globalAlpha = 0.5 * glowValue;
    ctx.strokeStyle = P.text;
    ctx.lineWidth = Math.max(1.2, 0.0045 * u);
    ctx.stroke();
    ctx.restore();
  }

  // Zone and landmark labels, all read from content.ui.scene.
  function drawLabels(ui) {
    var sc = ui.scene;
    var zone = Math.max(10, 0.021 * u);
    var small = Math.max(10.5, 0.0215 * u);

    spacedText(textOf(sc, 'light'), px(0.96), py(0.07), zone, zone * 0.3, P.muted, 'right');
    spacedText(textOf(sc, 'thylakoid'), px(0.07), py(0.585), zone, zone * 0.3, P.muted, 'left');
    spacedText(textOf(sc, 'stroma'), px(0.07), py(0.935), zone, zone * 0.3, P.muted, 'left');

    haloText(textOf(sc, 'photosystemII'), px(0.28), py(0.335), P.text, small);
    haloText(textOf(sc, 'photosystemI'), px(0.86), py(0.37), P.text, small);
    haloText(textOf(sc, 'electronChain'), px(0.66), py(0.41), P.text, small);
    haloText(textOf(sc, 'nadphStation'), px(0.86), py(0.505), P.text, small);
    haloText(textOf(sc, 'atpSynthase'), px(0.60), py(0.52), P.text, small);
    // Just above the Calvin ring.
    haloText(textOf(sc, 'calvinCycle'), px(0.5), py(0.80) - 0.16 * u - small * 1.2, P.text, small);
  }

  var BANDS = {
    light: [0, 0.31],
    thylakoid: [0.31, 0.61],
    stroma: [0.61, 1]
  };

  // Gradients for one focus band. They depend only on the canvas size, so they are built once.
  function focusParts(focus) {
    var parts = cache.focus[focus];
    if (parts) return parts;
    var f = BANDS[focus];
    var top = f[0];
    var bot = f[1];
    var dim = 0.3;
    var soft = 0.03;
    var aTop = top > 0 ? dim : 0;
    var aBot = bot < 1 ? dim : 0;

    var shade = ctx.createLinearGradient(0, 0, 0, cssH);
    shade.addColorStop(0, rgba(P.ink, aTop));
    shade.addColorStop(Math.max(0, top - soft), rgba(P.ink, aTop));
    shade.addColorStop(top, rgba(P.ink, 0));
    shade.addColorStop(bot, rgba(P.ink, 0));
    shade.addColorStop(Math.min(1, bot + soft), rgba(P.ink, aBot));
    shade.addColorStop(1, rgba(P.ink, aBot));

    // The lift is built at full strength; the frame sets its alpha (breathing).
    var lift = ctx.createLinearGradient(0, py(top), 0, py(bot));
    lift.addColorStop(0, rgba(P.sun, 0));
    lift.addColorStop(0.5, rgba(P.sun, 1));
    lift.addColorStop(1, rgba(P.sun, 0));

    parts = {
      shade: shade,
      lift: lift,
      topPx: py(top),
      botPx: py(bot)
    };
    cache.focus[focus] = parts;
    return parts;
  }

  // Dim the bands that are not focused (soft edges), then lightly highlight the
  // focused band. The highlight breathes gently; reduced motion keeps it steady.
  function drawFocus(focus, t, still) {
    if (!focus || !Object.prototype.hasOwnProperty.call(BANDS, focus)) return;
    var parts = focusParts(focus);

    ctx.save();
    // The shade is only non-zero outside the band, so fill just those two strips.
    ctx.fillStyle = parts.shade;
    if (parts.topPx > 0) ctx.fillRect(0, 0, cssW, parts.topPx);
    if (parts.botPx < cssH) ctx.fillRect(0, parts.botPx, cssW, cssH - parts.botPx);

    ctx.globalAlpha = still ? 0.1 : 0.1 + 0.04 * Math.sin(t * 1.85);   // about a 3.4 s breath
    ctx.fillStyle = parts.lift;
    ctx.fillRect(0, parts.topPx, cssW, parts.botPx - parts.topPx);
    ctx.restore();
  }

  // ---- Entities: one drawer per kind. Read only; never mutate e. ----

  function entX(e) { return px(num(e.x, 0)); }
  function entY(e) { return py(num(e.y, 0)); }

  // Size in px: the entity's own size (fraction of u), else the kind's default.
  function sizePx(e) {
    var f = num(e.size, DEFAULT_SIZE[e.kind]);
    if (!(f > 0)) f = DEFAULT_SIZE[e.kind];
    return f * u;
  }

  function colorOf(e, fallback) {
    return typeof e.color === 'string' && e.color ? e.color : fallback;
  }

  // Photon trails. The game reuses each entity object and moves it in place, so a WeakMap
  // keyed on the object can hold its recent positions. Samples are normalized, like entities.
  var TRAIL_SECONDS = 0.42;
  var TRAIL_STEP = 0.03;
  var TRAIL_MAX = 16;
  var trails = new WeakMap();

  // The entity's recent samples, oldest first. Drops samples older than TRAIL_SECONDS.
  function trailSamples(e, t) {
    var rec = trails.get(e);
    if (!rec || t < rec.seen) {   // new entity, or the clock went back
      rec = { pts: [], seen: t };
      trails.set(e, rec);
    }
    rec.seen = t;
    var pts = rec.pts;
    var x = num(e.x, 0);
    var y = num(e.y, 0);
    var last = pts[pts.length - 1];
    if (!last || (t - last.t >= TRAIL_STEP && (last.x !== x || last.y !== y))) {
      pts.push({ x: x, y: y, t: t });
      if (pts.length > TRAIL_MAX) pts.shift();
    }
    while (pts.length && t - pts[0].t > TRAIL_SECONDS) pts.shift();
    return pts;
  }

  // Fading trail behind the photon: butt-capped segments from the oldest sample to the head.
  // Each segment is fainter and thinner than the one in front of it.
  function drawPhotonTrail(e, s, t) {
    var pts = trailSamples(e, t);
    if (!pts.length) return;
    var base = ctx.globalAlpha;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = P.sun;
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var next = i + 1 < pts.length ? pts[i + 1] : null;
      var x1 = next ? px(next.x) : entX(e);
      var y1 = next ? py(next.y) : entY(e);
      var k = clamp01((t - (next ? next.t : t)) / TRAIL_SECONDS);   // 0 at the head, 1 at the tail
      ctx.globalAlpha = base * 0.6 * Math.pow(1 - k, 1.2);
      ctx.lineWidth = Math.max(0.8, s * (0.9 - 0.6 * k));
      ctx.beginPath();
      ctx.moveTo(px(p.x), py(p.y));
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Short squiggly tail, drawn still. Used under reduced motion, where there is no trail.
  function drawPhotonTail(x, y, s) {
    var len = s * 4.5;
    ctx.save();
    ctx.strokeStyle = P.sun;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, s * 0.4);
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    for (var i = 0; i <= 14; i++) {
      var k = i / 14;
      var tx = x + Math.sin(k * 8) * s * 0.9 * k;
      var ty = y - len * k;
      if (i === 0) ctx.moveTo(tx, ty); else ctx.lineTo(tx, ty);
    }
    ctx.stroke();
    ctx.restore();
  }

  // Yellow spark with glow. In motion it leaves a fading trail. Under reduced motion it
  // keeps the still squiggly tail and no trail.
  function drawPhoton(e, s, env) {
    var x = entX(e);
    var y = entY(e);
    if (env.still) drawPhotonTail(x, y, s);
    else drawPhotonTrail(e, s, env.t);
    softGlow(P.sun, x, y, s * 4, 0.9);

    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fillStyle = P.sun;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = P.text;
    ctx.fill();
  }

  function drawElectron(e, s) {
    var x = entX(e);
    var y = entY(e);
    softGlow(P.electron, x, y, s * 3.2, 0.85);
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fillStyle = P.electron;
    ctx.fill();
  }

  // Tiny pink dot with its H+ label above it.
  function drawProton(e, s) {
    var x = entX(e);
    var y = entY(e);
    softGlow(P.proton, x, y, s * 2.6, 0.5);
    ctx.beginPath();
    ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = P.proton;
    ctx.fill();
    haloText('H⁺', x, y - s * 2 - 6, P.text, Math.max(11, 0.019 * u));
  }

  // H2O: a red O with two white H atoms, hydrogens pointing up.
  function drawWater(e, s) {
    var x = entX(e);
    var y = entY(e);
    var rO = s * 0.62;
    var rH = s * 0.36;
    var b = s * 1.0;
    var angles = [-Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9];
    var i;
    ctx.save();
    ctx.strokeStyle = P.waterH;
    ctx.globalAlpha *= 0.6;
    ctx.lineWidth = Math.max(1.5, s * 0.18);
    for (i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angles[i]) * b, y + Math.sin(angles[i]) * b);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = P.waterH;
    for (i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(x + Math.cos(angles[i]) * b, y + Math.sin(angles[i]) * b, rH, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, rO, 0, Math.PI * 2);
    ctx.fillStyle = P.waterO;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - rO * 0.3, y - rO * 0.3, rO * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  }

  // O2: a pale blue bubble with its label inside.
  function drawOxygen(e, s, env) {
    var x = entX(e);
    var y = entY(e);
    var r = s;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(P.oxygen, 0.28);
    ctx.fill();
    ctx.strokeStyle = P.oxygenEdge;
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fill();
    haloText(textOf(env.labels, 'o2'), x, y + 0.5, P.text, Math.max(10.5, r * 0.85));
  }

  // CO2: grey carbon between two red oxygens, labelled on a dark pill.
  function drawCO2(e, s, env) {
    var x = entX(e);
    var y = entY(e);
    var rC = s * 0.42;
    var rO = s * 0.34;
    var b = s * 0.95;

    ctx.save();
    ctx.strokeStyle = P.muted;
    ctx.globalAlpha *= 0.7;
    ctx.lineWidth = Math.max(1.5, s * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - b, y);
    ctx.lineTo(x + b, y);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = P.waterO;
    ctx.beginPath();
    ctx.arc(x - b, y, rO, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + b, y, rO, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, rC, 0, Math.PI * 2);
    ctx.fillStyle = P.carbon;
    ctx.fill();
    ctx.strokeStyle = P.muted;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.stroke();

    var text = textOf(env.labels, 'co2');
    if (text) {
      var fp = Math.max(10.5, s * 0.6);
      setFont(fp, '700');
      var w = ctx.measureText(text).width + fp * 0.9;
      var h = fp * 1.5;
      var cy = y + Math.max(rC, rO) + h * 0.5 + 4;
      rrPath(ctx, x - w / 2, cy - h / 2, w, h, h / 2);
      ctx.fillStyle = rgba(P.ink, 0.85);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, x, cy + 0.5);
    }
  }

  // Four-point sparkle centred on (x, y).
  function sparkle(x, y, r, color) {
    if (r <= 0.3) return;
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ATP (orange) and NADPH (purple) pills, about 2.4 times as wide as tall.
  // Labels are dark on these light pills.
  function drawPill(e, s, env, color, key) {
    var x = entX(e);
    var y = entY(e);
    var H = Math.max(s, 15);
    var fp = Math.max(10.5, H * 0.56);
    var text = textOf(env.labels, key);
    setFont(fp, '700');
    var W = Math.max(H * 2.4, ctx.measureText(text).width + H * 0.5);
    softGlow(color, x, y, H * 2.2, 0.35);
    rrPath(ctx, x - W / 2, y - H / 2, W, H, H / 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = rgba(P.ink, 0.3);
    ctx.lineWidth = Math.max(1, H * 0.06);
    ctx.stroke();
    if (text) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.fillText(text, x, y + 0.5);
    }
  }

  // G3P sugar: a small light-green hexagon.
  function drawSugar(e, s) {
    var x = entX(e);
    var y = entY(e);
    softGlow(P.sugar, x, y, s * 2.6, 0.5);
    hexPath(ctx, x, y, s);
    ctx.fillStyle = P.sugar;
    ctx.fill();
    ctx.save();
    ctx.strokeStyle = P.text;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  // Glucose: a large amber hexagon ring with its formula. The finale adds a warm haze and sparkles.
  function drawGlucose(e, s, env) {
    var x = entX(e);
    var y = entY(e);
    softGlow(P.glucose, x, y, s * 2.4, 0.4);
    if (env.finale) softGlow(P.atp, x, y, s * 3.2, 0.12);
    hexPath(ctx, x, y, s);
    ctx.fillStyle = rgba(P.glucose, 0.18);
    ctx.fill();
    ctx.strokeStyle = P.glucose;
    ctx.lineWidth = Math.max(2.5, s * 0.16);
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.save();
    hexPath(ctx, x, y, s * 0.7);
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.globalAlpha *= 0.6;
    ctx.stroke();
    ctx.restore();

    // Formula inside the ring, so it stays clear of the membrane.
    var fp = Math.max(11, s * 0.3);
    haloText('C₆H₁₂O₆', x, y + 1, P.text, fp);

    if (env.finale) {
      for (var i = 0; i < 6; i++) {
        var a = (env.still ? 0 : env.t * 0.5) + i * Math.PI / 3;
        var d = s * 1.35;
        var sz = Math.max(3, s * 0.14) * (env.still ? 1 : 0.7 + 0.3 * Math.sin(env.t * 3 + i * 1.7));
        sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d, sz, P.sun);
      }
    }
  }

  // Burst: an expanding ring with a soft flash and eight sparkles, over 0.6 s. Size is the final
  // radius. The sparkles leave one after another and ease outward. Under reduced motion only the
  // ring remains, at a fixed radius, and fades.
  function drawBurst(e, s, env) {
    var x = entX(e);
    var y = entY(e);
    var age = num(e.age, 0);
    var k = clamp01(age / 0.6);
    var color = colorOf(e, '#ffffff');
    var ease = 1 - Math.pow(1 - k, 3);
    var rad = env.still ? s * 0.8 : s * (0.2 + 0.8 * ease);

    ctx.save();
    ctx.globalAlpha *= (1 - k);
    if (HEX_COLOR.test(color)) softGlow(color, x, y, rad * 1.4, 0.35);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.5, rad), 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, s * 0.12 * (1 - 0.6 * k));
    ctx.stroke();
    if (!env.still) {
      for (var i = 0; i < 8; i++) {
        // Each sparkle starts a little after the one before it, then eases outward and shrinks away.
        var q = clamp01((age - i * 0.02) / 0.5);
        if (q <= 0 || q >= 1) continue;
        var a = i * Math.PI / 4 + 0.2;
        var d = s * (0.1 + 0.95 * (1 - Math.pow(1 - q, 3)));
        var size = Math.max(1.5, s * 0.18) * Math.sin(Math.PI * q);
        sparkle(x + Math.cos(a) * d, y + Math.sin(a) * d, size, color);
      }
    }
    ctx.restore();
  }

  // Popup: text rising about 0.06 u with ease-out and fading over 0.9 s. Size is the font size.
  // A dark halo (outline plus soft shadow) keeps it readable on any band.
  function drawPopup(e) {
    var text = typeof e.text === 'string' ? e.text : '';
    if (!text) return;
    var k = clamp01(num(e.age, 0) / 0.9);
    var fp = Math.max(13, sizePx(e));
    var x = entX(e);
    var y = entY(e) - 0.06 * u * (1 - Math.pow(1 - k, 2));
    ctx.save();
    ctx.globalAlpha *= (1 - k);
    ctx.shadowColor = rgba(P.ink, 0.85);
    ctx.shadowBlur = fp * 0.5 * dpr;   // shadow blur is in device pixels
    haloText(text, x, y, colorOf(e, '#ffffff'), fp);
    ctx.restore();
  }

  // Kinds drawn in the main pass. Popups are drawn last, in drawEntities.
  var KIND_DRAW = {
    photon: drawPhoton,
    electron: drawElectron,
    proton: drawProton,
    water: drawWater,
    o2: drawOxygen,
    co2: drawCO2,
    atp: function (e, s, env) { drawPill(e, s, env, P.atp, 'atp'); },
    nadph: function (e, s, env) { drawPill(e, s, env, P.nadph, 'nadph'); },
    sugar: drawSugar,
    glucose: drawGlucose,
    burst: drawBurst
  };

  function hasKind(kind) {
    return typeof kind === 'string' && Object.prototype.hasOwnProperty.call(KIND_DRAW, kind);
  }

  // Entities in array order, then popups on top. Unknown kinds are skipped.
  function drawEntities(list, env) {
    if (!list || typeof list.length !== 'number') return;
    var i;
    var e;
    var a;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || typeof e !== 'object' || e.kind === 'popup' || !hasKind(e.kind)) continue;
      a = clamp01(num(e.alpha, 1));
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      KIND_DRAW[e.kind](e, sizePx(e), env);
      ctx.restore();
    }
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || typeof e !== 'object' || e.kind !== 'popup') continue;
      a = clamp01(num(e.alpha, 1));
      if (a <= 0) continue;
      ctx.save();
      ctx.globalAlpha = a;
      drawPopup(e);
      ctx.restore();
    }
  }

  // Scene-level values the entity drawers read. One object, reused each frame.
  var frame = { t: 0, still: false, labels: {}, finale: false };

  function draw(scene) {
    if (!ctx) return;
    scene = scene || {};
    var t = num(scene.t, 0);
    var still = !!scene.reducedMotion;
    var glow = readGlow(scene.glow);
    var ui = readUi();

    frame.t = t;
    frame.still = still;
    frame.labels = ui.labels;
    frame.finale = !!scene.finale;

    advanceSpin(t, glow.turbine, still);
    ensureStaticLayer();

    // Clear the whole backing store, then copy the cached static layer.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(cache.staticLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawSun(glow, t, still);
    drawPsiiHalo(glow);
    drawTurbine(glow, still);
    drawCalvin(glow, t, still);
    drawLabels(ui);
    drawFocus(scene.focus, t, still);
    drawEntities(scene.entities, frame);
  }

  window.Photosynthesis.render = {
    init: init,
    resize: resize,
    draw: draw
  };
})();
