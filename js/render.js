/* ══════════════════════════════════════════════════════════
   render.js — pseudo-3D painter's-algorithm renderer on a
   plain 2D canvas: perspective projection, shaded boxes,
   distance fog, a day/night sky and a procedural skyline.
   ══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const SS = (window.SS = window.SS || {});
  const U = SS.util;
  const { clamp, lerp, mix, shade, css, hex, TAU } = U;

  /* ── world constants (metres) ──────────────────────────── */
  const C = SS.C = {
    NEAR: 10,          // camera sits this far behind the runner
    MINZ: -8.6,        // near clip in world z
    LANE: 2.7,
    LANES: [-2.7, 0, 2.7],
    TRACK_HALF: 4.35,
    WALL_X: 4.75,
    WALL_H: 4.6,
    FOG0: 70,
    FOG1: 235,
    FAR: 250,
    CAM_H: 3.7,
  };

  /* ── time-of-day palettes ──────────────────────────────── */
  const KEY = [
    { at: 0.00, name: 'dawn',  skyTop: '#243066', skyBot: '#ff9d6b', fog: '#c9927f', ground: '#4a4258', rail: '#9aa0b5', tie: '#3a3242', wall: '#3d3a58', gravel: '#514a5e', amb: 0.95, star: 0.18, sun: '#ffd9a0', neon: 0.45 },
    { at: 0.25, name: 'day',   skyTop: '#1b6ed6', skyBot: '#b7e3ff', fog: '#bcd8ef', ground: '#5a6270', rail: '#c2cad6', tie: '#454a55', wall: '#4e5868', gravel: '#646c7a', amb: 1.08, star: 0.00, sun: '#fff6cf', neon: 0.12 },
    { at: 0.52, name: 'dusk',  skyTop: '#1e1449', skyBot: '#ff5d72', fog: '#9c5570', ground: '#3b3350', rail: '#8b7f9e', tie: '#2d2740', wall: '#332a4c', gravel: '#413a54', amb: 0.88, star: 0.40, sun: '#ff8a5c', neon: 0.75 },
    { at: 0.78, name: 'night', skyTop: '#04060f', skyBot: '#111a3d', fog: '#0d1329', ground: '#1e2440', rail: '#6d7aa0', tie: '#171c31', wall: '#161d36', gravel: '#232a47', amb: 0.68, star: 1.00, sun: '#dfe8ff', neon: 1.00 },
  ];
  // pre-parse
  KEY.forEach((k) => {
    k.c = {
      skyTop: hex(k.skyTop), skyBot: hex(k.skyBot), fog: hex(k.fog),
      ground: hex(k.ground), rail: hex(k.rail), tie: hex(k.tie),
      wall: hex(k.wall), gravel: hex(k.gravel), sun: hex(k.sun),
    };
  });

  function themeAt(t) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    for (let k = 0; k < KEY.length; k++) if (t >= KEY[k].at) i = k;
    const a = KEY[i];
    const b = KEY[(i + 1) % KEY.length];
    let span = b.at - a.at; if (span <= 0) span += 1;
    let f = (t - a.at) / span; if (f < 0) f += 1 / span;
    f = U.smoothstep(clamp(f, 0, 1));
    const out = { name: f < 0.5 ? a.name : b.name };
    for (const key in a.c) out[key] = mix(a.c[key], b.c[key], f);
    out.amb = lerp(a.amb, b.amb, f);
    out.star = lerp(a.star, b.star, f);
    out.neon = lerp(a.neon, b.neon, f);
    out.tod = t;
    return out;
  }

  /* ── renderer ──────────────────────────────────────────── */
  const R = {
    canvas: null, ctx: null,
    W: 0, H: 0, dpr: 1,
    cx: 0, horizon: 0, focal: 0,
    camX: 0, camH: C.CAM_H, camRoll: 0,
    theme: themeAt(0.25),
    quality: 'high',
    stars: null,
    clouds: null,
    _skyGrad: null, _skyKey: '',

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      this.buildDecor();
      this.resize();
      window.addEventListener('resize', () => this.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 120));
    },

    buildDecor() {
      const r = U.rng(90210);
      this.stars = [];
      for (let i = 0; i < 260; i++) {
        this.stars.push({ x: r(), y: r() * r(), s: 0.5 + r() * 1.5, p: r() * TAU, b: 0.35 + r() * 0.65 });
      }
      this.clouds = [];
      for (let i = 0; i < 14; i++) {
        this.clouds.push({ x: r(), y: 0.08 + r() * 0.45, w: 0.1 + r() * 0.22, h: 0.02 + r() * 0.035, v: 0.004 + r() * 0.012, a: 0.1 + r() * 0.22 });
      }
      // two parallax silhouette skylines (screen-space, seeded)
      this.sky1 = this.makeSkyline(1337, 42, 0.10, 0.30);
      this.sky2 = this.makeSkyline(4242, 30, 0.16, 0.46);
    },

    makeSkyline(seed, n, minH, maxH) {
      const r = U.rng(seed);
      const out = [];
      let x = 0;
      while (x < 1.6) {
        const w = 0.02 + r() * 0.055;
        const h = minH + r() * (maxH - minH);
        out.push({ x, w, h, lit: r(), rows: 2 + ((r() * 4) | 0), cols: 1 + ((r() * 3) | 0), spire: r() < 0.16 });
        x += w + 0.004 + r() * 0.012;
      }
      return out;
    },

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      this.dpr = dpr;
      this.W = w; this.H = h;
      this.canvas.width = Math.max(1, Math.round(w * dpr));
      this.canvas.height = Math.max(1, Math.round(h * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this._skyKey = '';
    },

    /* camera set-up for the frame */
    begin(cam) {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      /* Focal is bounded on both axes: wide enough that all three lanes fit
         across, tall enough that the runner stays a decent size. Tall phone
         screens also get a higher horizon so the empty foreground shrinks. */
      this.focal = Math.min(this.W * 1.15, this.H) * (cam.fov || 1);
      const ar = this.H / this.W;
      const hz = 0.40 - clamp((ar - 1.15) * 0.085, 0, 0.12);
      this.horizon = this.H * hz + (cam.pitch || 0) + (cam.shakeY || 0);
      this.cx = this.W * 0.5 + (cam.shakeX || 0);
      this.camX = cam.x || 0;
      this.camH = cam.h == null ? C.CAM_H : cam.h;
      this.camRoll = cam.roll || 0;
      if (this.camRoll) {
        ctx.translate(this.W / 2, this.H * 0.75);
        ctx.rotate(this.camRoll);
        ctx.translate(-this.W / 2, -this.H * 0.75);
      }
    },

    end() {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    },

    /* ── projection ── */
    project(x, y, z) {
      const d = z + C.NEAR;
      const s = this.focal / d;
      return { x: this.cx + (x - this.camX) * s, y: this.horizon + (this.camH - y) * s, s: s, d: d };
    },

    scaleAt(z) { return this.focal / (z + C.NEAR); },

    fogAt(z) {
      return clamp((z - C.FOG0) / (C.FOG1 - C.FOG0), 0, 1);
    },

    /** base colour → shaded + fogged css string */
    col(base, mul, f, alpha) {
      let c = mul === 1 ? base : shade(base, mul);
      if (f > 0) c = mix(c, this.theme.fog, f * f);
      return css(c, alpha);
    },

    quad(a, b, c, d, fill) {
      const ctx = this.ctx;
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    },

    /** Horizontal quad on the y plane spanning x0..x1, z0..z1. */
    ground(x0, x1, y, z0, z1, fill) {
      if (z1 <= C.MINZ) return;
      z0 = Math.max(z0, C.MINZ);
      const a = this.project(x0, y, z0), b = this.project(x1, y, z0);
      const c = this.project(x1, y, z1), d = this.project(x0, y, z1);
      this.quad(a, b, c, d, fill);
    },

    /** Vertical quad at constant x, spanning y0..y1 and z0..z1. */
    wall(x, y0, y1, z0, z1, fill) {
      if (z1 <= C.MINZ) return;
      z0 = Math.max(z0, C.MINZ);
      const a = this.project(x, y0, z0), b = this.project(x, y0, z1);
      const c = this.project(x, y1, z1), d = this.project(x, y1, z0);
      this.quad(a, b, c, d, fill);
    },

    /** Vertical quad at constant z (a billboard face), x0..x1 × y0..y1. */
    face(x0, x1, y0, y1, z, fill) {
      if (z <= C.MINZ) return;
      const a = this.project(x0, y0, z), b = this.project(x1, y0, z);
      const c = this.project(x1, y1, z), d = this.project(x0, y1, z);
      this.quad(a, b, c, d, fill);
    },

    /**
     * Shaded axis-aligned box. (x,z) is the centre-front-bottom;
     * the box extends l metres away from the camera.
     */
    box(x, y, z, w, h, l, base, o) {
      o = o || {};
      const zf = z + l;
      if (zf <= C.MINZ || z > C.FAR) return;
      const zn = Math.max(z, C.MINZ);
      const x0 = x - w / 2, x1 = x + w / 2, y0 = y, y1 = y + h;
      const f = this.fogAt(Math.max(zn, 0));
      if (f >= 1) return;

      const A = this.project(x0, y0, zn), B = this.project(x1, y0, zn);
      const Cc = this.project(x1, y1, zn), D = this.project(x0, y1, zn);
      const E = this.project(x0, y0, zf), F = this.project(x1, y0, zf);
      const G = this.project(x1, y1, zf), Hh = this.project(x0, y1, zf);

      const amb = this.theme.amb * (o.amb == null ? 1 : o.amb);
      const alpha = o.alpha;

      // side faces (whichever the camera can see)
      if (this.camX > x1) this.quad(B, F, G, Cc, this.col(base, 0.60 * amb, f, alpha));
      else if (this.camX < x0) this.quad(A, E, Hh, D, this.col(base, 0.60 * amb, f, alpha));
      // top
      if (this.camH > y1) this.quad(D, Cc, G, Hh, this.col(base, 1.22 * amb, f, alpha));
      // front
      this.quad(A, B, Cc, D, this.col(base, 0.92 * amb, f, alpha));

      if (o.outline && f < 0.7) {
        const ctx = this.ctx;
        ctx.strokeStyle = this.col(base, 0.42 * amb, f, alpha);
        ctx.lineWidth = Math.max(0.6, A.s * 0.03);
        ctx.beginPath();
        ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(Cc.x, Cc.y); ctx.lineTo(D.x, D.y); ctx.closePath();
        ctx.stroke();
      }
      return { A, B, C: Cc, D, E, F, G, H: Hh, f };
    },

    /**
     * Radial glow blob. Gradients are expensive per-frame, so each colour
     * gets baked into a small sprite once and blitted from then on.
     */
    _glowCache: Object.create(null),
    glowSprite(color) {
      const key = (color[0] | 0) + ',' + (color[1] | 0) + ',' + (color[2] | 0);
      let s = this._glowCache[key];
      if (!s) {
        s = document.createElement('canvas');
        s.width = s.height = 64;
        const g = s.getContext('2d');
        const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        rg.addColorStop(0, css(color, 1));
        rg.addColorStop(0.4, css(color, 0.34));
        rg.addColorStop(1, css(color, 0));
        g.fillStyle = rg;
        g.fillRect(0, 0, 64, 64);
        this._glowCache[key] = s;
      }
      return s;
    },

    glow(sx, sy, r, color, alpha) {
      if (r <= 0.5 || alpha <= 0.01) return;
      if (r > 900) r = 900;
      const ctx = this.ctx;
      const prev = ctx.globalAlpha;
      ctx.globalAlpha = prev * Math.min(1, alpha);
      ctx.drawImage(this.glowSprite(color), sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = prev;
    },

    /* ── sky ───────────────────────────────────────────── */
    sky(t, time) {
      const ctx = this.ctx, W = this.W, H = this.H, th = this.theme;
      const key = (th.tod * 200 | 0) + '|' + W + 'x' + H + '|' + (this.horizon | 0);
      if (key !== this._skyKey) {
        const g = ctx.createLinearGradient(0, 0, 0, Math.max(this.horizon, 4));
        g.addColorStop(0, css(th.skyTop));
        g.addColorStop(0.62, css(mix(th.skyTop, th.skyBot, 0.55)));
        g.addColorStop(1, css(th.skyBot));
        this._skyGrad = g;
        this._skyKey = key;
      }
      ctx.fillStyle = this._skyGrad;
      ctx.fillRect(0, 0, W, Math.max(this.horizon, 0) + 1);
      // ground haze below the horizon (track drawing paints over most of it)
      ctx.fillStyle = css(mix(th.fog, th.ground, 0.35));
      ctx.fillRect(0, Math.max(this.horizon, 0), W, H - this.horizon + 1);

      /* stars */
      if (th.star > 0.02) {
        for (let i = 0; i < this.stars.length; i++) {
          const s = this.stars[i];
          const y = s.y * this.horizon;
          if (y > this.horizon - 2) continue;
          const tw = 0.55 + 0.45 * Math.sin(time * 1.7 + s.p);
          ctx.fillStyle = 'rgba(255,255,255,' + (th.star * s.b * tw * 0.9).toFixed(3) + ')';
          ctx.fillRect(s.x * W, y, s.s, s.s);
        }
      }

      /* sun / moon */
      const el = Math.sin(th.tod * TAU);
      const bx = W * (0.5 + 0.34 * Math.sin(th.tod * TAU + 1.1));
      const by = this.horizon - this.horizon * 0.78 * Math.abs(el) - 6;
      const isSun = el > 0;
      const rad = Math.min(W, H) * (isSun ? 0.055 : 0.042);
      const col = isSun ? th.sun : [230, 238, 255];
      this.glow(bx, by, rad * 5.5, col, isSun ? 0.22 : 0.16);
      ctx.fillStyle = css(col, 0.95);
      ctx.beginPath(); ctx.arc(bx, by, rad, 0, TAU); ctx.fill();
      if (!isSun) {
        // moon crater bite
        ctx.fillStyle = css(mix(th.skyTop, [230, 238, 255], 0.12), 0.9);
        ctx.beginPath(); ctx.arc(bx - rad * 0.42, by - rad * 0.3, rad * 0.85, 0, TAU); ctx.fill();
      }

      /* clouds */
      if (this.quality !== 'low') {
        for (let i = 0; i < this.clouds.length; i++) {
          const c = this.clouds[i];
          const x = ((c.x + time * c.v) % 1.3 - 0.15) * W;
          const y = c.y * this.horizon;
          ctx.fillStyle = css(mix(th.skyBot, [255, 255, 255], 0.35), c.a * 0.4 * (0.35 + th.amb * 0.45));
          ctx.beginPath();
          ctx.ellipse(x, y, c.w * W, c.h * H, 0, 0, TAU);
          ctx.fill();
        }
      }
    },

    /** Two parallax silhouette skylines sitting on the horizon. */
    skyline(travel) {
      const ctx = this.ctx, W = this.W, th = this.theme;
      const layers = [
        { d: this.sky1, par: 0.00055, col: mix(th.fog, th.skyTop, 0.55), scale: 1.0, lit: 0.35 },
        { d: this.sky2, par: 0.00135, col: mix(th.fog, th.skyTop, 0.25), scale: 1.35, lit: 0.7 },
      ];
      for (let li = 0; li < layers.length; li++) {
        const L = layers[li];
        const off = (travel * L.par) % 1;
        const camShift = -this.camX * (li === 0 ? 1.4 : 3.2);
        ctx.fillStyle = css(L.col);
        const baseY = this.horizon + 2;
        for (let rep = -1; rep <= 1; rep++) {
          for (let i = 0; i < L.d.length; i++) {
            const b = L.d[i];
            const x = (b.x - off + rep * 1.6) * W + camShift;
            const w = b.w * W;
            if (x > W + 40 || x + w < -40) continue;
            const h = b.h * this.horizon * L.scale;
            ctx.fillRect(x, baseY - h, w, h + 2);
            if (b.spire) ctx.fillRect(x + w * 0.45, baseY - h - h * 0.22, Math.max(1.5, w * 0.1), h * 0.22);
            // lit windows at night
            if (li === 1 && th.neon > 0.25 && this.quality === 'high') {
              const cols = b.cols, rows = Math.min(b.rows + 3, 8);
              const cw = w / (cols * 2 + 1), ch = h / (rows * 2 + 1);
              ctx.fillStyle = css([255, 226, 150], th.neon * 0.5 * (0.35 + b.lit * 0.65) * L.lit);
              for (let r = 0; r < rows; r++) {
                for (let cIdx = 0; cIdx < cols; cIdx++) {
                  if (((i * 7 + r * 3 + cIdx * 5) % 5) > 2) continue;
                  ctx.fillRect(x + cw * (cIdx * 2 + 1), baseY - h + ch * (r * 2 + 1), cw, ch);
                }
              }
              ctx.fillStyle = css(L.col);
            }
          }
        }
      }
    },

    setTheme(t) { this.theme = themeAt(t); return this.theme; },
    themeAt: themeAt,
  };

  SS.R = R;
})();
