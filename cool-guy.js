/*
 * cool-guy.js — a hand-drawn style doodle of a cool guy with curly hair
 * and sunglasses, drawn with nothing but the Canvas 2D API.
 *
 * Usage:  drawCoolGuy(canvas.getContext('2d'), 800, 800);
 * The drawing is authored in an 800x800 space and scaled to fit.
 */
(function (root) {
  'use strict';

  var W = 800, H = 800;

  var C = {
    paper:      '#fdf4e3',
    dots:       '#e7d9bd',
    ink:        '#2a201c',
    skin:       '#f4c096',
    skinShade:  '#dfa273',
    hair:       '#3b2a20',
    hairLite:   '#57402f',
    hairDark:   '#2b1d15',
    jacket:     '#41809f',
    jacketDark: '#2e6382',
    shirt:      '#f9f3e4',
    lens:       '#1b1715',
    gold:       '#e9b83f',
    accent:     '#ef6f5c'
  };

  /* ---------- a tiny seeded RNG, so the "hand-drawn" wobble is stable ---------- */
  function makeRng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---------- sketchy path helpers ---------- */
  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // Smooth curve through a list of points (quadratics via midpoints).
  function curveThrough(ctx, pts, closed) {
    ctx.beginPath();
    if (closed) {
      var start = midpoint(pts[pts.length - 1], pts[0]);
      ctx.moveTo(start.x, start.y);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], n = pts[(i + 1) % pts.length], m = midpoint(p, n);
        ctx.quadraticCurveTo(p.x, p.y, m.x, m.y);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length - 1; j++) {
        var q = midpoint(pts[j], pts[j + 1]);
        ctx.quadraticCurveTo(pts[j].x, pts[j].y, q.x, q.y);
      }
      var last = pts[pts.length - 1];
      ctx.lineTo(last.x, last.y);
    }
  }

  function blobPoints(cx, cy, rx, ry, steps, wobble, rng, rot) {
    var pts = [], i, a, w;
    rot = rot || 0;
    for (i = 0; i < steps; i++) {
      a = rot + (i / steps) * Math.PI * 2;
      w = 1 + (rng() - 0.5) * wobble;
      pts.push({ x: cx + Math.cos(a) * rx * w, y: cy + Math.sin(a) * ry * w });
    }
    return pts;
  }

  // Rounded-rectangle-ish outline (squircle) — used for the sunglass lenses.
  function squirclePoints(cx, cy, rx, ry, steps, power, wobble, rng) {
    var pts = [], i, a, ca, sa, w;
    for (i = 0; i < steps; i++) {
      a = (i / steps) * Math.PI * 2;
      ca = Math.cos(a); sa = Math.sin(a);
      w = 1 + (rng() - 0.5) * wobble;
      pts.push({
        x: cx + Math.sign(ca) * Math.pow(Math.abs(ca), power) * rx * w,
        y: cy + Math.sign(sa) * Math.pow(Math.abs(sa), power) * ry * w
      });
    }
    return pts;
  }

  function shape(ctx, pts, fill, stroke, lw) {
    curveThrough(ctx, pts, true);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 4; ctx.stroke(); }
  }

  function stroke(ctx, pts, color, lw) {
    curveThrough(ctx, pts, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 4;
    ctx.stroke();
  }

  function spiral(ctx, cx, cy, r, turns, color, lw) {
    var total = turns * Math.PI * 2, t, rr, x, y;
    ctx.beginPath();
    for (t = 0; t <= total; t += 0.18) {
      rr = r * (1 - t / total * 0.92);
      x = cx + Math.cos(t) * rr;
      y = cy + Math.sin(t) * rr;
      if (t === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lw || 3;
    ctx.stroke();
  }

  function sparkle(ctx, cx, cy, r, color) {
    var k = r * 0.16;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.quadraticCurveTo(cx + k, cy - k, cx + r, cy);
    ctx.quadraticCurveTo(cx + k, cy + k, cx, cy + r);
    ctx.quadraticCurveTo(cx - k, cy + k, cx - r, cy);
    ctx.quadraticCurveTo(cx - k, cy - k, cx, cy - r);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  /* ---------- the doodle ---------- */
  function drawCoolGuy(ctx, width, height) {
    var rng = makeRng(20260821);

    ctx.save();
    ctx.scale((width || W) / W, (height || H) / H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    paper(ctx, rng);
    backCurls(ctx, rng);
    torso(ctx, rng);
    neck(ctx, rng);
    face(ctx, rng);
    hair(ctx, rng);
    ears(ctx, rng);
    sunglasses(ctx, rng);
    features(ctx, rng);
    confetti(ctx, rng);

    ctx.restore();
  }

  function paper(ctx, rng) {
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, W, H);

    // faint dot grid, like doodling on notebook paper
    ctx.fillStyle = C.dots;
    for (var y = 30; y < H; y += 34) {
      for (var x = 30; x < W; x += 34) {
        ctx.beginPath();
        ctx.arc(x + (rng() - 0.5) * 3, y + (rng() - 0.5) * 3, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Curls peeking out behind the silhouette, for volume.
  function backCurls(ctx, rng) {
    var a, i, x, y, r;
    for (i = 0; i <= 16; i++) {
      a = (-30 + (i / 16) * 240) * Math.PI / 180;
      x = 400 + Math.cos(a) * 152;
      y = 360 - Math.sin(a) * 168;
      r = 30 + rng() * 14;
      shape(ctx, blobPoints(x, y, r, r * 0.95, 9, 0.22, rng, rng() * 6), C.hairDark, C.ink, 4);
    }
  }

  function torso(ctx, rng) {
    var pts = [
      { x: 105, y: 815 }, { x: 128, y: 700 }, { x: 190, y: 630 },
      { x: 285, y: 585 }, { x: 400, y: 566 }, { x: 515, y: 585 },
      { x: 610, y: 630 }, { x: 672, y: 700 }, { x: 695, y: 815 }
    ];
    var i, p = [];
    for (i = 0; i < pts.length; i++) {
      p.push({ x: pts[i].x + (rng() - 0.5) * 5, y: pts[i].y + (rng() - 0.5) * 5 });
    }
    curveThrough(ctx, p, false);
    ctx.lineTo(695, 830); ctx.lineTo(105, 830); ctx.closePath();
    ctx.fillStyle = C.jacket; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.stroke();

    // shirt showing through the open jacket
    ctx.beginPath();
    ctx.moveTo(345, 572);
    ctx.quadraticCurveTo(400, 690, 455, 572);
    ctx.quadraticCurveTo(400, 556, 345, 572);
    ctx.closePath();
    ctx.fillStyle = C.shirt; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4.5; ctx.stroke();

    // lapels
    lapel(ctx, [{ x: 344, y: 566 }, { x: 292, y: 592 }, { x: 330, y: 706 }, { x: 380, y: 616 }]);
    lapel(ctx, [{ x: 456, y: 566 }, { x: 508, y: 592 }, { x: 470, y: 706 }, { x: 420, y: 616 }]);

    // a little gold chain, because he is cool
    for (i = 0; i <= 7; i++) {
      var t = i / 7;
      var cx = 368 + t * 64;
      var cy = 600 + Math.sin(t * Math.PI) * 32;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = C.gold; ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2; ctx.stroke();
    }

    // stitching on the shoulders
    ctx.setLineDash([9, 11]);
    stroke(ctx, [{ x: 258, y: 600 }, { x: 232, y: 700 }, { x: 226, y: 815 }], C.jacketDark, 4);
    stroke(ctx, [{ x: 542, y: 600 }, { x: 568, y: 700 }, { x: 574, y: 815 }], C.jacketDark, 4);
    ctx.setLineDash([]);
  }

  function lapel(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = C.jacketDark; ctx.fill();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.stroke();
  }

  function neck(ctx, rng) {
    var pts = [
      { x: 362, y: 430 }, { x: 438, y: 430 },
      { x: 452, y: 560 }, { x: 348, y: 560 }
    ];
    shape(ctx, pts, C.skin, C.ink, 5);
    ctx.save();
    ctx.globalAlpha = 0.5;
    shape(ctx, [{ x: 358, y: 440 }, { x: 442, y: 440 }, { x: 448, y: 500 }, { x: 352, y: 500 }], C.skinShade, null, 0);
    ctx.restore();
  }

  function ears(ctx, rng) {
    [[268, 392], [532, 392]].forEach(function (e, idx) {
      shape(ctx, blobPoints(e[0], e[1], 22, 30, 10, 0.12, rng), C.skin, C.ink, 5);
      ctx.save();
      ctx.beginPath();
      ctx.arc(e[0] + (idx ? -4 : 4), e[1], 9, idx ? -1.9 : 1.2, idx ? 0.9 : 4.2);
      ctx.strokeStyle = C.skinShade; ctx.lineWidth = 4; ctx.stroke();
      ctx.restore();
    });
  }

  function face(ctx, rng) {
    shape(ctx, blobPoints(400, 360, 132, 152, 22, 0.05, rng), C.skin, C.ink, 6);

    // soft shading down the right side and under the jaw
    ctx.save();
    ctx.globalAlpha = 0.35;
    curveThrough(ctx, blobPoints(400, 360, 132, 152, 22, 0.05, makeRng(20260821)), true);
    ctx.clip();
    ctx.fillStyle = C.skinShade;
    ctx.beginPath();
    ctx.moveTo(470, 200); ctx.quadraticCurveTo(560, 400, 430, 520);
    ctx.lineTo(560, 520); ctx.lineTo(560, 200); ctx.closePath();
    ctx.fill();
    ctx.restore();

    // stubble along the jaw
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = C.hairDark;
    for (var i = 0; i < 180; i++) {
      var a = Math.PI * (0.1 + rng() * 0.8);
      var rr = 0.84 + rng() * 0.16;
      var x = 400 + Math.cos(a) * 132 * rr * (rng() < 0.5 ? -1 : 1);
      var y = 360 + Math.sin(a) * 152 * rr;
      if (y < 440) continue;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + rng() * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function hair(ctx, rng) {
    // solid mass on top of the head, so no scalp shows between the curls
    var pts = [
      { x: 268, y: 358 }, { x: 286, y: 300 }, { x: 336, y: 276 },
      { x: 400, y: 268 }, { x: 466, y: 278 }, { x: 516, y: 302 },
      { x: 532, y: 358 }, { x: 520, y: 230 }, { x: 400, y: 196 }, { x: 280, y: 232 }
    ];
    curveThrough(ctx, pts, true);
    ctx.fillStyle = C.hair; ctx.fill();

    var i, a, x, y, r;

    // inner curls filling the crown
    for (i = 0; i <= 9; i++) {
      a = (14 + (i / 9) * 152) * Math.PI / 180;
      x = 400 + Math.cos(a) * (96 + rng() * 10);
      y = 362 - Math.sin(a) * (106 + rng() * 10);
      r = 30 + rng() * 10;
      shape(ctx, blobPoints(x, y, r, r * 0.94, 9, 0.24, rng, rng() * 6),
        rng() < 0.35 ? C.hairLite : C.hair, C.ink, 4);
    }

    // the outer ring of curls that makes the silhouette
    for (i = 0; i <= 17; i++) {
      a = (-24 + (i / 17) * 228) * Math.PI / 180;
      x = 400 + Math.cos(a) * (138 + rng() * 8);
      y = 360 - Math.sin(a) * (152 + rng() * 8);
      r = 30 + rng() * 15;
      shape(ctx, blobPoints(x, y, r, r * 0.95, 10, 0.26, rng, rng() * 6),
        rng() < 0.3 ? C.hairLite : C.hair, C.ink, 4.5);
      if (rng() < 0.55) spiral(ctx, x, y, r * 0.6, 1.35, C.hairLite, 3);
    }

    // a couple of loose curls falling over the forehead
    stroke(ctx, [{ x: 348, y: 292 }, { x: 366, y: 314 }, { x: 344, y: 326 }, { x: 358, y: 342 }], C.hair, 6);
    stroke(ctx, [{ x: 452, y: 296 }, { x: 436, y: 318 }, { x: 458, y: 330 }, { x: 444, y: 346 }], C.hair, 6);
  }

  function sunglasses(ctx, rng) {
    var lens = [[344, 366], [456, 366]];

    // arms of the glasses, tucked back toward the ears
    stroke(ctx, [{ x: 296, y: 352 }, { x: 280, y: 372 }, { x: 268, y: 384 }], C.ink, 9);
    stroke(ctx, [{ x: 504, y: 352 }, { x: 520, y: 372 }, { x: 532, y: 384 }], C.ink, 9);

    lens.forEach(function (l, idx) {
      var pts = squirclePoints(l[0], l[1], 54, 40, 30, 0.62, 0.05, rng);
      shape(ctx, pts, C.lens, C.ink, 7);

      // glints on the glass
      ctx.save();
      curveThrough(ctx, pts, true);
      ctx.clip();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(l[0] - 42, l[1] + 34);
      ctx.lineTo(l[0] - 12, l[1] - 46);
      ctx.lineTo(l[0] + 4, l[1] - 46);
      ctx.lineTo(l[0] - 26, l[1] + 34);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(l[0] - 4, l[1] + 34);
      ctx.lineTo(l[0] + 14, l[1] - 46);
      ctx.lineTo(l[0] + 22, l[1] - 46);
      ctx.lineTo(l[0] + 4, l[1] + 34);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (idx === 0) {
        // top rim, a bit heavier than the rest of the frame
        stroke(ctx, [{ x: 292, y: 344 }, { x: 344, y: 326 }, { x: 398, y: 340 }], C.ink, 8);
      } else {
        stroke(ctx, [{ x: 402, y: 340 }, { x: 456, y: 326 }, { x: 508, y: 344 }], C.ink, 8);
      }
    });

    // bridge
    stroke(ctx, [{ x: 392, y: 350 }, { x: 400, y: 342 }, { x: 408, y: 350 }], C.ink, 8);
  }

  function features(ctx, rng) {
    // nose
    stroke(ctx, [{ x: 398, y: 408 }, { x: 410, y: 436 }, { x: 392, y: 444 }], C.ink, 5.5);

    // a confident smirk
    stroke(ctx, [{ x: 352, y: 474 }, { x: 396, y: 492 }, { x: 442, y: 466 }], C.ink, 6);
    stroke(ctx, [{ x: 442, y: 466 }, { x: 450, y: 456 }], C.ink, 5);

    // cheek blush
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = C.accent;
    ctx.beginPath(); ctx.ellipse(312, 442, 26, 15, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(490, 442, 26, 15, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function confetti(ctx, rng) {
    sparkle(ctx, 158, 214, 26, C.gold);
    sparkle(ctx, 660, 172, 20, C.accent);
    sparkle(ctx, 690, 430, 15, C.gold);
    sparkle(ctx, 122, 470, 13, C.accent);

    // little motion doodles either side of the head
    stroke(ctx, [{ x: 118, y: 318 }, { x: 158, y: 330 }], C.ink, 5);
    stroke(ctx, [{ x: 108, y: 366 }, { x: 152, y: 372 }], C.ink, 5);
    stroke(ctx, [{ x: 646, y: 300 }, { x: 686, y: 288 }], C.ink, 5);
    stroke(ctx, [{ x: 654, y: 348 }, { x: 698, y: 348 }], C.ink, 5);
  }

  root.drawCoolGuy = drawCoolGuy;
  if (typeof module !== 'undefined' && module.exports) module.exports = drawCoolGuy;
})(typeof globalThis !== 'undefined' ? globalThis : this);
