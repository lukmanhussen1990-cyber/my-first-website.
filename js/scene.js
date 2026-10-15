/*
 * imran — logo animation scene.
 *
 * Everything is a pure function of time: drawFrame(ctx, t) paints the frame at
 * t seconds. The live player and the video exporter both call it, so what you
 * see in the browser is exactly what ends up in the MP4.
 *
 * Coordinates live in a 3840 x 2160 design space (the original 4K frame);
 * the caller scales that onto whatever canvas it has.
 */
(function (global) {
  'use strict';

  // ---------------------------------------------------------------- constants

  var W = 3840, H = 2160, CX = W / 2, CY = H / 2;
  var DURATION = 10.8;

  var XH = 326;              // x-height = block height
  var CELL = XH / 6;         // pixel grid: 6 cells per x-height, stems are 2 cells
  var GAP = 33;              // gap between blocks
  var RADIUS = 22;           // block corner radius

  var COLOR = {
    bg: '#FFFFFF',
    blue: '#0000FF',
    cerulean: '#3C8AFF',
    tan: '#B8A581',
    red: '#FC401F',
    yellow: '#FFD12F',
    green: '#66C800',
    lime: '#B6F569',
    pink: '#FEA8CD'
  };

  var LETTERS = ['i', 'm', 'r', 'a', 'n'];
  var CELLS = { i: 2, m: 10, r: 4, a: 6, n: 6 };

  // ------------------------------------------------------------------ helpers

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function prog(t, a, b) { return clamp((t - a) / (b - a), 0, 1); }
  var ease = {
    inQuad: function (x) { return x * x; },
    outQuad: function (x) { return 1 - (1 - x) * (1 - x); },
    inOutQuad: function (x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; },
    inCubic: function (x) { return x * x * x; },
    outCubic: function (x) { return 1 - Math.pow(1 - x, 3); },
    inOutCubic: function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
    outQuart: function (x) { return 1 - Math.pow(1 - x, 4); },
    inOutSine: function (x) { return -(Math.cos(Math.PI * x) - 1) / 2; },
    outBack: function (x, s) {
      s = s === undefined ? 1.70158 : s;
      var c3 = s + 1;
      return 1 + c3 * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
    },
    inBack: function (x, s) {
      s = s === undefined ? 1.70158 : s;
      return (s + 1) * x * x * x - s * x * x;
    }
  };

  // Smooth keyframe curve through [t, value] pairs (monotone cubic Hermite,
  // so it never overshoots between keys). Clamped outside the key range.
  function curve(keys) {
    var n = keys.length, xs = [], ys = [], m = [], d = [];
    for (var i = 0; i < n; i++) { xs.push(keys[i][0]); ys.push(keys[i][1]); }
    for (i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m.push(d[0]);
    for (i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    m.push(d[n - 2]);
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
    }
    return function (t) {
      if (t <= xs[0]) return ys[0];
      if (t >= xs[n - 1]) return ys[n - 1];
      var j = 0;
      while (t > xs[j + 1]) j++;
      var h = xs[j + 1] - xs[j], u = (t - xs[j]) / h, u2 = u * u, u3 = u2 * u;
      return (2 * u3 - 3 * u2 + 1) * ys[j] + (u3 - 2 * u2 + u) * h * m[j] +
        (-2 * u3 + 3 * u2) * ys[j + 1] + (u3 - u2) * h * m[j + 1];
    };
  }

  // deterministic hash -> [0, 1)
  function hash(a, b, c) {
    var h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function fillRect(ctx, x, y, w, h, color, r) {
    if (w <= 0.01 || h <= 0.01) return;
    ctx.beginPath();
    roundRectPath(ctx, x, y, w, h, r === undefined ? RADIUS : r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ------------------------------------------------------------------- layout

  // Block row: every letter is a block on the 6-cell grid; the i also has its dot.
  var rowW = 0;
  LETTERS.forEach(function (ch) { rowW += CELLS[ch] * CELL; });
  rowW += GAP * (LETTERS.length - 1);
  var DOT = 2 * CELL;
  var groupH = DOT + GAP + XH;
  var BASE = CY + groupH / 2;          // baseline
  var XTOP = BASE - XH;                // top of the x-height blocks
  var DOT_Y = XTOP - GAP - DOT;        // top of the i's dot
  var MID_Y = BASE - XH / 2;           // vertical centre of the block row

  var BLOCKS = {};
  (function () {
    var x = CX - rowW / 2;
    LETTERS.forEach(function (ch) {
      var w = CELLS[ch] * CELL;
      BLOCKS[ch] = { x: x, w: w, cx: x + w / 2 };
      x += w + GAP;
    });
  })();

  // Five equal squares, used for the shuffle and the merge.
  var SLOT_PITCH = XH + GAP;
  function slotX(k) { return CX - (5 * XH + 4 * GAP) / 2 + k * SLOT_PITCH; }

  // Wordmark: natural (kerned) spacing, slightly tightened, centred like the blocks.
  var GL = global.IMRAN_GLYPHS;
  var K = XH / GL.xHeight;             // font units -> design px
  var TRACK = -15;                     // font units
  var WORD = {};
  (function () {
    var pen = 0, pens = {};
    LETTERS.forEach(function (ch, idx) {
      pens[ch] = pen;
      pen += GL.advances[ch] + (idx < LETTERS.length - 1 ? TRACK : 0);
    });
    var left = pens.i + GL.glyphs.i.bbox[0];
    var right = pens.n + GL.glyphs.n.bbox[2];
    var originX = CX - ((left + right) / 2) * K;
    LETTERS.forEach(function (ch) {
      WORD[ch] = { x: originX + pens[ch] * K, path: null };
    });
  })();

  function glyphPath(ch) {
    if (!WORD[ch].path) WORD[ch].path = new Path2D(GL.glyphs[ch].d);
    return WORD[ch].path;
  }

  function drawGlyph(ctx, ch, color) {
    ctx.save();
    ctx.translate(WORD[ch].x, BASE);
    ctx.scale(K, K);
    ctx.fillStyle = color;
    ctx.fill(glyphPath(ch));
    ctx.restore();
  }

  // --------------------------------------------------------- pixel bitmaps
  // Coverage of each letter sampled on its block's cell grid (computed once).

  var BITMAPS = null;

  function sampleGlyph(ch, cols, rows, fx0, fx1, fy0, fy1) {
    var S = 24;                        // offscreen pixels per cell
    var cw = cols * S, chh = rows * S;
    var c = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(cw, chh)
      : Object.assign(document.createElement('canvas'), { width: cw, height: chh });
    var g = c.getContext('2d');
    g.clearRect(0, 0, cw, chh);
    // map font box [fx0..fx1] x [fy0..fy1] (y-up) onto the canvas
    g.setTransform(cw / (fx1 - fx0), 0, 0, chh / (fy1 - fy0), -fx0 * cw / (fx1 - fx0), fy1 * chh / (fy1 - fy0));
    g.fillStyle = '#000';
    g.fill(new Path2D(GL.glyphs[ch].d));
    var data = g.getImageData(0, 0, cw, chh).data;
    var cov = [];
    for (var r = 0; r < rows; r++) {
      for (var q = 0; q < cols; q++) {
        var sum = 0;
        for (var yy = 0; yy < S; yy++) {
          for (var xx = 0; xx < S; xx++) {
            sum += data[((r * S + yy) * cw + q * S + xx) * 4 + 3];
          }
        }
        cov.push(sum / (S * S * 255));
      }
    }
    return cov;
  }

  function bitmaps() {
    if (BITMAPS) return BITMAPS;
    BITMAPS = {};
    LETTERS.forEach(function (ch) {
      var bb = GL.glyphs[ch].bbox;
      var x0 = ch === 'i' ? 60 : bb[0], x1 = ch === 'i' ? 210 : bb[2];
      BITMAPS[ch] = { cols: CELLS[ch], rows: 6, cov: sampleGlyph(ch, CELLS[ch], 6, x0, x1, 0, GL.xHeight) };
    });
    // the i's dot gets its own 2x2 grid
    BITMAPS.dot = { cols: 2, rows: 2, cov: sampleGlyph('i', 2, 2, 55, 215, 578, 740) };
    return BITMAPS;
  }

  // ------------------------------------------------------------------ timing

  var T = {
    deckEnd: 1.335,
    splitStart: 1.335, splitEnd: 1.54,
    dotStart: 1.46, dotEnd: 1.74,
    // letter reveal: block flashes a colour, goes blue again, then becomes the glyph
    reveal: [
      { ch: 'm', t: 3.170, color: COLOR.pink },
      { ch: 'r', t: 3.237, color: COLOR.red },
      { ch: 'a', t: 3.337, color: COLOR.green },
      { ch: 'n', t: 3.437, color: COLOR.cerulean },
      { ch: 'i', t: 3.537, color: COLOR.yellow }
    ],
    flash: 0.1, settle: 0.167,
    // pixel breakdown: glyph -> lit cells -> full grid -> solid block -> blue
    pixel: [
      { ch: 'r', t: 5.706, solid: 6.139, blue: 6.373, color: COLOR.cerulean },
      { ch: 'i', t: 5.739, solid: 6.206, blue: 6.406, color: COLOR.red },
      { ch: 'm', t: 5.806, solid: 6.040, blue: 6.290, color: COLOR.yellow },
      { ch: 'a', t: 5.873, solid: 6.073, blue: 6.315, color: COLOR.green },
      { ch: 'n', t: 5.939, solid: 6.106, blue: 6.340, color: COLOR.pink }
    ],
    dotDropStart: 7.88, dotDropEnd: 8.10,
    squareStart: 7.95, squareEnd: 8.22,
    shuffleStart: 8.24, shuffleEnd: 8.96,
    mergeStart: 9.0, mergeEnd: 9.309,
    vortexStart: 9.309, vortexEnd: 10.31
  };

  // ------------------------------------------------------ chess card faces

  var INK = '#0A0B0D';
  var WHITE = '#FFFFFF';
  var PIECE_PATHS = {};

  // piece centred in a card of side `size`; call inside the card's own frame
  function drawPiece(ctx, name, size, color, scale) {
    var P = global.IMRAN_CHESS[name];
    var s = size * 0.58 * scale / P.h;
    if (s <= 0.0005) return;
    if (!PIECE_PATHS[name]) PIECE_PATHS[name] = new Path2D(P.d);
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(-P.w / 2, -P.h / 2);
    ctx.fillStyle = color;
    ctx.fill(PIECE_PATHS[name]);
    ctx.restore();
  }

  function drawCard(ctx, x, y, size, deg, color, piece, ink, pieceScale) {
    if (size <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(deg * Math.PI / 180);
    fillRect(ctx, -size / 2, -size / 2, size, size, color, RADIUS * size / XH);
    if (piece && pieceScale > 0) drawPiece(ctx, piece, size, ink, pieceScale);
    ctx.restore();
  }

  // ------------------------------------------------------- 1. chess card deck
  //
  // Six chess cards pop up out of the baseline and spin round like a fanned
  // hand. Every card runs the same motion, pivoting on its bottom edge; each
  // one trails the card above it by two frames. Curves are keyframed from the
  // original animation.

  var DECK = [   // bottom -> top
    { color: COLOR.pink, piece: 'pawn', ink: INK },
    { color: COLOR.cerulean, piece: 'knight', ink: WHITE },
    { color: COLOR.yellow, piece: 'bishop', ink: INK },
    { color: COLOR.red, piece: 'rook', ink: WHITE },
    { color: COLOR.lime, piece: 'queen', ink: INK },
    { color: COLOR.blue, piece: 'king', ink: WHITE }
  ];
  var DECK_STAGGER = 1 / 15;

  var deckScale = curve([
    [0, 0], [0.033, 0.24], [0.067, 0.53], [0.1, 0.73], [0.133, 0.85],
    [0.167, 0.925], [0.2, 0.97], [0.234, 0.994], [0.267, 1]
  ]);
  // rotation of a card (degrees, clockwise)
  var deckSpin = curve([
    [0.08, 0], [0.133, 2.5], [0.167, 4.5], [0.2, 7], [0.234, 10], [0.267, 14],
    [0.3, 18.5], [0.334, 24], [0.367, 31.5], [0.4, 40.5], [0.434, 51.5],
    [0.467, 66.5], [0.501, 86], [0.534, 114.5], [0.567, 154], [0.601, 205.9],
    [0.634, 245.1], [0.667, 273.9], [0.701, 294.5], [0.734, 308.9], [0.767, 319.6],
    [0.801, 328.1], [0.834, 335.2], [0.868, 340.1], [0.901, 345.5], [0.934, 349.3],
    [0.968, 353], [1.001, 355.3], [1.034, 356.9], [1.068, 358.5], [1.101, 359.5],
    [1.134, 360]
  ]);
  // height of the shared pivot above the baseline (negative = up)
  var deckLift = curve([
    [0.1, 0], [0.133, -13], [0.167, -44], [0.2, -81], [0.234, -109], [0.267, -130],
    [0.3, -145], [0.334, -157], [0.367, -167], [0.4, -175], [0.434, -181],
    [0.467, -187], [0.501, -191], [0.567, -196], [0.634, -205], [0.701, -208],
    [0.767, -212], [0.834, -215], [0.901, -216], [0.968, -213], [1.034, -207],
    [1.101, -194], [1.168, -167], [1.235, -110], [1.268, -46], [1.301, 0],
    [1.335, -12], [1.368, 0]
  ]);

  function deckState(t) {
    var size = XH * deckScale(t);
    var px = CX, py = BASE + deckLift(t);      // pivot: bottom centre of the cards
    // the king hops off the top card just before it lands
    var kingOut = prog(t, 1.16, 1.3);
    var cards = [];
    for (var i = 0; i < DECK.length; i++) {
      var deg = deckSpin(t - (DECK.length - 1 - i) * DECK_STAGGER);
      var a = deg * Math.PI / 180;
      var c = DECK[i];
      cards.push({
        x: px + Math.sin(a) * size / 2,
        y: py - Math.cos(a) * size / 2,
        size: size, rot: deg, color: c.color, piece: c.piece, ink: c.ink,
        pieceScale: c.piece === 'king' ? 1 - ease.inBack(kingOut, 2.2) : 1
      });
    }
    return cards;
  }

  function drawDeck(ctx, t) {
    if (t <= 0) return;
    var cards = deckState(t);
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      drawCard(ctx, c.x, c.y, c.size, c.rot, c.color, c.piece, c.ink, c.pieceScale);
    }
  }

  // --------------------------------------------- 2. blocks, letters, pixels

  // how far the landed square has stretched out into the block row (0..1)
  var splitCurve = curve([[1.345, 0], [1.368, 0.122], [1.401, 0.52], [1.435, 0.79], [1.468, 0.923], [1.502, 0.983], [1.535, 1]]);

  // Block rectangles for the letter row at time t (handles split-in and
  // the later morph into five equal squares).
  function blockRect(ch, idx, t) {
    var b = BLOCKS[ch];
    var x = b.x, w = b.w;
    var y = XTOP;
    // split: every block starts as the single centred square and slides out
    if (t < T.splitEnd) {
      var k = splitCurve(t);
      x = lerp(CX - XH / 2, b.x, k);
      w = lerp(XH, b.w, k);
      y += deckLift(t);                 // finish the landing bounce
    }
    // morph into equal squares before the shuffle
    if (t > T.squareStart) {
      var m = ease.inOutCubic(prog(t, T.squareStart, T.squareEnd));
      x = lerp(b.x, slotX(idx), m);
      w = lerp(b.w, XH, m);
    }
    return { x: x, y: y, w: w, h: XH };
  }

  // i's dot: pops out of the stem, later drops back into it
  function dotRect(t) {
    var stem = blockRect('i', 0, t);
    var cx = stem.x + stem.w / 2;
    var restY = DOT_Y;
    var hiddenY = XTOP;                 // tucked into the top of the stem
    var y = restY, sx = 1, sy = 1;
    if (t < T.dotEnd) {
      var k = prog(t, T.dotStart, T.dotEnd);
      y = lerp(hiddenY, restY, ease.outBack(k, 2.2));
      // squash & stretch on the way up
      var st = Math.sin(Math.PI * Math.min(1, k * 1.6));
      sy = 1 + 0.25 * st; sx = 1 - 0.15 * st;
    }
    if (t > T.dotDropStart) {
      var d = prog(t, T.dotDropStart, T.dotDropEnd);
      y = lerp(restY, hiddenY + DOT * 0.15, ease.inBack(d, 2.4));
      var sd = Math.sin(Math.PI * d);
      sy = 1 + 0.2 * sd; sx = 1 - 0.12 * sd;
    }
    var w = DOT * sx, h = DOT * sy;
    return { x: cx - w / 2, y: y + (DOT - h) / 2, w: w, h: h };
  }

  function revealOf(ch) {
    for (var i = 0; i < T.reveal.length; i++) if (T.reveal[i].ch === ch) return T.reveal[i];
  }
  function pixelOf(ch) {
    for (var i = 0; i < T.pixel.length; i++) if (T.pixel[i].ch === ch) return T.pixel[i];
  }

  // draw a letter's cell grid; `level` 0 = glyph-shaped, 1 = every cell lit
  function drawCells(ctx, bm, x, y, w, h, color, t, p, seed) {
    var cols = bm.cols, rows = bm.rows;
    var cw = w / cols, chh = h / rows;
    var local = t - p.t;
    var span = Math.max(0.12, p.solid - p.t - 0.05);
    var fill = ease.inQuad(clamp((local - 0.05) / span, 0, 1));    // 0 -> 1
    var frame = Math.floor(local * 30);                             // flicker at 30 Hz
    var inset = 0.07 * Math.min(cw, chh);
    var rr = 0.1 * Math.min(cw, chh);
    var close = clamp((t - (p.solid - 0.05)) / 0.05, 0, 1);         // gaps close just before solid
    inset *= (1 - close);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (var r = 0; r < rows; r++) {
      for (var q = 0; q < cols; q++) {
        var idx = r * cols + q;
        var cov = bm.cov[idx];
        var jitter = (hash(seed, idx, frame) - 0.5) * 0.5 * (1 - fill);
        var threshold = lerp(0.5, -0.6, fill);
        if (cov + jitter <= threshold) continue;
        roundRectPath(ctx, x + q * cw + inset, y + r * chh + inset, cw - 2 * inset, chh - 2 * inset, rr * (1 - close));
      }
    }
    ctx.fill();
  }

  function drawLetterRow(ctx, t) {
    var bm = bitmaps();
    LETTERS.forEach(function (ch, idx) {
      var rv = revealOf(ch), px = pixelOf(ch);
      var rect = blockRect(ch, idx, t);
      var hasDot = ch === 'i' && t >= T.dotStart && t < T.dotDropEnd;
      var dot = hasDot ? dotRect(t) : null;

      // the wordmark
      if (t >= rv.t + T.settle && t < px.t) {
        drawGlyph(ctx, ch, COLOR.blue);
        return;
      }
      // pixel breakdown
      if (t >= px.t && t < px.solid) {
        drawCells(ctx, bm[ch], rect.x, rect.y, rect.w, rect.h, px.color, t, px, idx + 1);
        if (ch === 'i') {
          var d = dotRect(t);
          drawCells(ctx, bm.dot, d.x, d.y, d.w, d.h, px.color, t, px, 9);
        }
        return;
      }
      // plain block, possibly flashing a colour
      var color = COLOR.blue;
      if (t >= rv.t && t < rv.t + T.flash) color = rv.color;
      if (t >= px.solid && t < px.blue) color = px.color;
      fillRect(ctx, rect.x, rect.y, rect.w, rect.h, color, Math.min(RADIUS, rect.w / 4));
      if (dot) fillRect(ctx, dot.x, dot.y, dot.w, dot.h, color, Math.min(RADIUS, dot.w / 4));
    });
  }

  // ------------------------------------------------------------- 3. shuffle

  // Choreography: each move slides one block between slots, in colour.
  // Built once from a fixed list so the sound design can follow it.
  var SHUFFLE = (function () {
    var palette = [COLOR.yellow, COLOR.cerulean, COLOR.red, COLOR.tan, COLOR.pink, COLOR.green, COLOR.lime];
    // [start, duration, slotA, slotB] — blocks in A and B swap places
    var swaps = [
      [8.300, 0.115, 0, 1],
      [8.370, 0.115, 3, 4],
      [8.440, 0.150, 1, 3],
      [8.520, 0.115, 2, 0],
      [8.590, 0.150, 4, 2],
      [8.660, 0.115, 0, 1],
      [8.730, 0.115, 3, 2]
    ];
    var occupant = [0, 1, 2, 3, 4];          // slot -> block
    var where = [0, 1, 2, 3, 4];             // block -> slot
    var moves = [[], [], [], [], []];
    var colors = [[], [], [], [], []];       // per block: [time, color]
    var pc = 0;
    colors[0].push([8.240, COLOR.yellow]);
    colors[1].push([8.275, COLOR.cerulean]);
    pc = 2;
    var events = [];
    swaps.forEach(function (s) {
      var t0 = s[0], dur = s[1], a = s[2], b = s[3];
      var ba = occupant[a], bb = occupant[b];
      moves[ba].push({ t0: t0, t1: t0 + dur, from: a, to: b });
      moves[bb].push({ t0: t0, t1: t0 + dur, from: b, to: a });
      colors[ba].push([t0, palette[pc++ % palette.length]]);
      colors[bb].push([t0 + 0.02, palette[pc++ % palette.length]]);
      colors[ba].push([t0 + dur + 0.07, COLOR.blue]);
      colors[bb].push([t0 + dur + 0.05, COLOR.blue]);
      occupant[a] = bb; occupant[b] = ba; where[ba] = b; where[bb] = a;
      events.push({ t0: t0, t1: t0 + dur, from: a, to: b, colorA: colors[ba][colors[ba].length - 1][1], colorB: colors[bb][colors[bb].length - 1][1] });
    });
    // a block that is already off on its next move stays in colour
    colors = colors.map(function (cs, k) {
      return cs.filter(function (c) {
        return c[1] !== COLOR.blue || !moves[k].some(function (m) { return c[0] > m.t0 && c[0] < m.t1 + 0.04; });
      }).sort(function (p, q) { return p[0] - q[0]; });
    });
    // everyone goes back to blue in a quick cascade (by final slot, left to right)
    var blueAt = [];
    for (var slot = 0; slot < 5; slot++) {
      var blk = occupant[slot];
      var tb = 8.86 + slot * 0.02;
      colors[blk].push([tb, COLOR.blue]);
      blueAt.push({ t: tb, slot: slot });
    }
    return { moves: moves, colors: colors, finalSlot: where, events: events, blueAt: blueAt };
  })();

  function shuffleBlock(k, t) {
    var slot = k, x = slotX(k), lift = 0;
    var ms = SHUFFLE.moves[k];
    for (var i = 0; i < ms.length; i++) {
      var m = ms[i];
      if (t >= m.t1) { slot = m.to; x = slotX(slot); continue; }
      if (t > m.t0) {
        var e = ease.inOutCubic(prog(t, m.t0, m.t1));
        x = lerp(slotX(m.from), slotX(m.to), e);
        lift = Math.sin(Math.PI * e);
      }
      break;
    }
    var color = COLOR.blue;
    var cs = SHUFFLE.colors[k];
    for (var j = 0; j < cs.length; j++) if (t >= cs[j][0]) color = cs[j][1];
    return { x: x, color: color, lift: lift, slot: slot };
  }

  function drawShuffle(ctx, t) {
    var items = [];
    for (var k = 0; k < 5; k++) items.push(shuffleBlock(k, t));
    // moving blocks pass over the parked ones
    items.sort(function (a, b) { return a.lift - b.lift; });
    items.forEach(function (it) { fillRect(ctx, it.x, XTOP, XH, XH, it.color); });
  }

  // --------------------------------------------------------------- 4. merge

  // the row lifts a little as it collapses into one square
  var mergeLift = curve([[9.1, 0], [9.276, -21], [9.31, -29], [9.343, -35], [9.41, -41], [9.476, -45], [9.576, -48]]);

  var mergeCurve = curve([[9.0, 0], [9.042, 0.0075], [9.076, 0.032], [9.109, 0.081], [9.142, 0.165], [9.176, 0.298], [9.209, 0.506], [9.243, 0.799], [9.276, 0.964], [9.309, 1]]);

  function drawMerge(ctx, t) {
    var k = mergeCurve(t);
    var centre = CX - XH / 2;
    var y = XTOP + mergeLift(t);
    var order = [0, 4, 1, 3, 2];
    for (var i = 0; i < order.length; i++) {
      var slot = order[i];
      fillRect(ctx, lerp(slotX(slot), centre, k), y, XH, XH, COLOR.blue);
    }
  }

  // -------------------------------------------------------------- 5. vortex
  //
  // The merged square becomes the king card again. Underneath it sits the
  // rest of the stack; every card twists and spirals into the centre on the
  // same curve, each a beat after the card above it.

  var VORTEX = [   // top -> bottom
    { color: COLOR.blue, piece: 'king', ink: WHITE, delay: 0 },
    { color: COLOR.yellow, piece: 'bishop', ink: INK, delay: 0.133 },
    { color: COLOR.red, piece: 'rook', ink: WHITE, delay: 0.2 },
    { color: COLOR.lime, piece: 'queen', ink: INK, delay: 0.267 },
    { color: COLOR.blue, piece: null, ink: null, delay: 0.333 }
  ];
  var vortexSpin = curve([
    [9.343, 0], [9.443, 1], [9.543, 4.5], [9.61, 9.5], [9.676, 17.5], [9.743, 29],
    [9.81, 45], [9.877, 70], [9.943, 108], [9.977, 135]
  ]);
  var vortexSize = curve([
    [9.343, 1], [9.443, 0.99], [9.51, 0.97], [9.576, 0.935], [9.643, 0.885],
    [9.71, 0.81], [9.743, 0.76], [9.776, 0.7], [9.81, 0.6], [9.843, 0.48],
    [9.877, 0.32], [9.91, 0.15], [9.943, 0.035], [9.977, 0]
  ]);

  function vortexLayer(i, t) {
    var L = VORTEX[i];
    var tau = t - L.delay;
    var size = XH * vortexSize(tau);
    var pieceScale = 1;
    if (L.piece === 'king') pieceScale = ease.outBack(prog(t, 9.3, 9.46), 2.2);
    return { size: size, rot: vortexSpin(tau), color: L.color, piece: L.piece, ink: L.ink, pieceScale: pieceScale };
  }

  function drawVortex(ctx, t) {
    var y = MID_Y + mergeLift(t);
    for (var i = VORTEX.length - 1; i >= 0; i--) {
      var v = vortexLayer(i, t);
      if (v.size <= 0.5) continue;
      drawCard(ctx, CX, y, v.size, v.rot, v.color, v.piece, v.ink, v.pieceScale);
    }
  }

  // ---------------------------------------------------------------- frame

  function drawFrame(ctx, t) {
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, W, H);
    if (t < T.splitStart) drawDeck(ctx, t);
    else if (t < T.shuffleStart) drawLetterRow(ctx, t);
    else if (t < T.mergeStart) drawShuffle(ctx, t);
    else if (t < T.mergeEnd) drawMerge(ctx, t);
    else if (t < T.vortexEnd) drawVortex(ctx, t);
  }

  // How fast things move at time t (0 = still). The exporter uses this to
  // decide how many sub-frames of motion blur a frame needs.
  function motionAt(t) {
    if (t < T.deckEnd + 0.05) return 1;
    if (t < T.splitEnd + 0.05) return 1;
    if (t < T.dotEnd) return 0.6;
    if (t > T.dotDropStart - 0.02 && t < T.vortexEnd + 0.02) return 1;
    return 0;
  }

  global.ImranScene = {
    W: W, H: H, CX: CX, CY: CY, DURATION: DURATION,
    XH: XH, GAP: GAP, CELL: CELL, BASE: BASE, MID_Y: MID_Y,
    COLOR: COLOR, LETTERS: LETTERS, BLOCKS: BLOCKS, WORD: WORD, T: T,
    SHUFFLE: SHUFFLE, DECK: DECK, VORTEX: VORTEX,
    slotX: slotX, deckState: deckState, vortexLayer: vortexLayer,
    deckSpin: deckSpin, vortexSize: vortexSize,
    drawFrame: drawFrame, motionAt: motionAt, bitmaps: bitmaps,
    ease: ease, curve: curve
  };
})(window);
