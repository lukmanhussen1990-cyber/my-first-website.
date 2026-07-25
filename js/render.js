/* Crossy Road — 2.5D renderer.
 *
 * The world is a right-handed grid: +x runs right, +y runs away from the
 * camera (the direction you hop) and +z is up. It is drawn with a rotated
 * axonometric projection — no perspective divide — which gives the chunky
 * toy-box look while keeping depth sorting trivial.
 *
 *   u =  x·cosYAW + y·sinYAW      (screen right)
 *   v = -x·sinYAW + y·cosYAW      (depth: bigger = further away)
 *   screenY = -(v·sinELEV + z·cosELEV)
 */
(function (global) {
  'use strict';

  var CR = global.CR;
  var util = CR.util;

  var YAW = 9 * Math.PI / 180;
  var ELEV = 54 * Math.PI / 180;
  var CY = Math.cos(YAW), SY = Math.sin(YAW);
  var SE = Math.sin(ELEV), CE = Math.cos(ELEV);

  // Face brightness multipliers: top is lit, the two visible sides fall off.
  var TOP = 1, SOUTH = 0.8, EAST = 0.62;

  function Renderer(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: !!(opts && opts.alpha) });
    this.w = 0; this.h = 0; this.dpr = 1;
    this.scale = 60;
    this.cam = { x: 0, y: 0 };
    this.anchor = 0.7;      // where cam.y sits vertically on screen (0=top)
    this.shakeX = 0; this.shakeY = 0;
    this.queue = [];
    this.qn = 0;
    this.parts = [];
    this.pn = 0;
    this._pts = [0, 0, 0, 0, 0, 0, 0, 0];
  }

  Renderer.YAW = YAW; Renderer.ELEV = ELEV;
  Renderer.CY = CY; Renderer.SY = SY; Renderer.SE = SE; Renderer.CE = CE;

  Renderer.prototype.resize = function (cssW, cssH) {
    var dpr = Math.min(global.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    this.w = cssW; this.h = cssH;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Aim for ~11 columns × ~14 rows of playfield. On very tall/narrow
    // screens fall back to a floor so tiles never get postage-stamp small.
    var byCols = cssW / (11 * CY);
    var byRows = cssH / (14 * SE);
    var s = Math.min(byCols, byRows);
    var floor = Math.min(cssW / (8.5 * CY), cssH / (19 * SE));
    this.scale = util.clamp(Math.max(s, floor), 20, 120);
  };

  Renderer.prototype.setCamera = function (x, y) { this.cam.x = x; this.cam.y = y; };

  /** Depth key — larger is further from the camera. */
  Renderer.prototype.depth = function (x, y) { return -x * SY + y * CY; };

  Renderer.prototype.sx = function (x, y) {
    return this.w * 0.5 + ((x - this.cam.x) * CY + (y - this.cam.y) * SY) * this.scale + this.shakeX;
  };

  Renderer.prototype.sy = function (x, y, z) {
    var v = -(x - this.cam.x) * SY + (y - this.cam.y) * CY;
    return this.h * this.anchor - (v * SE + z * CE) * this.scale + this.shakeY;
  };

  /** Rows/columns that can possibly be on screen (generous margin). */
  Renderer.prototype.viewRows = function () {
    var up = (this.h * this.anchor) / (this.scale * SE);
    var down = (this.h * (1 - this.anchor)) / (this.scale * SE);
    var side = (this.w * 0.5) / this.scale * (SY / CY);
    return { far: this.cam.y + up + side + 3, near: this.cam.y - down - side - 3 };
  };

  Renderer.prototype.halfCols = function () { return (this.w * 0.5) / (this.scale * CY); };

  /* ── Flat quads (ground markings) ─────────────────────────────
   * Many small quads share a colour, so they are batched into one path
   * and filled once. */

  Renderer.prototype.beginFlat = function (color) {
    this.ctx.beginPath();
    this._flat = color;
  };

  Renderer.prototype.addFlat = function (x0, x1, y0, y1, z) {
    var c = this.ctx;
    c.moveTo(this.sx(x0, y0), this.sy(x0, y0, z));
    c.lineTo(this.sx(x1, y0), this.sy(x1, y0, z));
    c.lineTo(this.sx(x1, y1), this.sy(x1, y1, z));
    c.lineTo(this.sx(x0, y1), this.sy(x0, y1, z));
    c.closePath();
  };

  Renderer.prototype.endFlat = function () {
    this.ctx.fillStyle = this._flat;
    this.ctx.fill();
  };

  Renderer.prototype.tile = function (x0, x1, y0, y1, z, color) {
    this.beginFlat(color);
    this.addFlat(x0, x1, y0, y1, z);
    this.endFlat();
  };

  /* ── Boxes ────────────────────────────────────────────────────
   * A box shows three faces. Instead of filling each face and stroking
   * it to hide the seams, the whole silhouette is filled with the side
   * colour first and the lit faces are painted on top: three fills, no
   * strokes, and no sub-pixel gaps.
   */
  Renderer.prototype.box = function (x, y, z, w, d, h, color, light) {
    var x0 = x - w * 0.5, x1 = x + w * 0.5;
    var y0 = y - d * 0.5, y1 = y + d * 0.5;
    var z1 = z + h;
    var c = this.ctx;
    var l = light == null ? 1 : light;

    var ax = this.sx(x0, y0), ay = this.sy(x0, y0, z);      // A near-left base
    var bx = this.sx(x1, y0), by = this.sy(x1, y0, z);      // B near-right base
    var cx2 = this.sx(x1, y1), cy2 = this.sy(x1, y1, z);    // C far-right base
    var dx = cx2, dy = this.sy(x1, y1, z1);                 // D far-right top
    var ex = this.sx(x0, y1), ey = this.sy(x0, y1, z1);     // E far-left top
    var fx = ax, fy = this.sy(x0, y0, z1);                  // F near-left top
    var gx = bx, gy = this.sy(x1, y0, z1);                  // G near-right top

    c.beginPath();                                          // silhouette
    c.moveTo(ax, ay); c.lineTo(bx, by); c.lineTo(cx2, cy2);
    c.lineTo(dx, dy); c.lineTo(ex, ey); c.lineTo(fx, fy);
    c.closePath();
    c.fillStyle = util.shade(color, SOUTH * l);
    c.fill();

    c.beginPath();                                          // east (+x)
    c.moveTo(bx, by); c.lineTo(cx2, cy2); c.lineTo(dx, dy); c.lineTo(gx, gy);
    c.closePath();
    c.fillStyle = util.shade(color, EAST * l);
    c.fill();

    c.beginPath();                                          // top (+z)
    c.moveTo(fx, fy); c.lineTo(gx, gy); c.lineTo(dx, dy); c.lineTo(ex, ey);
    c.closePath();
    c.fillStyle = util.shade(color, TOP * l);
    c.fill();
  };

  /* ── Contact shadows ──────────────────────────────────────── */

  Renderer.prototype.beginShadows = function (alpha) {
    var c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = '#000';
    c.beginPath();
  };

  Renderer.prototype.addShadow = function (x, y, w, d) {
    var c = this.ctx;
    var px = this.sx(x, y), py = this.sy(x, y, 0.002);
    var rx = w * 0.5 * this.scale * CY, ry = d * 0.5 * this.scale * SE;
    c.moveTo(px + rx, py);
    c.ellipse(px, py, rx, ry, 0, 0, util.TAU);
  };

  Renderer.prototype.endShadows = function () {
    this.ctx.fill();
    this.ctx.restore();
  };

  /** Soft contact shadow under a single object. */
  Renderer.prototype.shadow = function (x, y, w, d, alpha) {
    this.beginShadows(alpha == null ? 0.17 : alpha);
    this.addShadow(x, y, w, d);
    this.endShadows();
  };

  /* ── Depth-sorted part batch ──────────────────────────────────
   * Composite models (a car, a train, a chicken) are built out of boxes
   * that can occlude each other. There is no z-buffer, so parts are
   * collected and sorted along the true view axis before drawing:
   *   depth = v·cosELEV − z·sinELEV   (bigger = further from the camera)
   */

  Renderer.prototype.part = function (x, y, z, w, d, h, color, light) {
    var p = this.parts[this.pn];
    if (!p) p = this.parts[this.pn] = {};
    p.x = x; p.y = y; p.z = z; p.w = w; p.d = d; p.h = h; p.c = color; p.l = light;
    p.k = (-x * SY + y * CY) * CE - (z + h * 0.5) * SE;
    this.pn++;
  };

  function byKey(a, b) { return b.k - a.k; }

  Renderer.prototype.drawParts = function () {
    var list = this.parts.slice(0, this.pn);
    this.pn = 0;
    list.sort(byKey);
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      this.box(p.x, p.y, p.z, p.w, p.d, p.h, p.c, p.l);
    }
  };

  /* ── Depth-sorted draw queue ──────────────────────────────── */

  Renderer.prototype.push = function (depth, fn, arg) {
    var item = this.queue[this.qn];
    if (item) { item.d = depth; item.fn = fn; item.a = arg; }
    else this.queue[this.qn] = { d: depth, fn: fn, a: arg };
    this.qn++;
  };

  Renderer.prototype.flush = function () {
    var list = this.queue.slice(0, this.qn);
    list.sort(function (a, b) { return b.d - a.d; });   // far → near
    for (var i = 0; i < list.length; i++) list[i].fn(this, list[i].a);
    this.qn = 0;
  };

  CR.Renderer = Renderer;
})(window);
