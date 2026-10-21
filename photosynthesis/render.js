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

  // Caches keyed on canvas size; rebuilt in resize().
  var cache = {
    width: 0,
    height: 0,
    staticLayer: null
  };

  function num(v, fallback) {
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  // Normalized (0..1) to CSS pixels.
  function px(x) { return x * cssW; }
  function py(y) { return y * cssH; }

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
    cache.width = cssW;
    cache.height = cssH;
    cache.staticLayer = null; // rebuilt lazily on next draw
  }

  function draw(scene) {
    if (!ctx) return;
    scene = scene || {};
    // Placeholder: frame body is added in later steps.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
  }

  window.Photosynthesis.render = {
    init: init,
    resize: resize,
    draw: draw
  };
})();
