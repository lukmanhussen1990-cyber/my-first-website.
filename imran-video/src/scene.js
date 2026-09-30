// IMRAN logo reveal — deterministic frame renderer.
//
// World space is the final-frame layout in 1080 px (the logo SVG's 1000-unit
// viewBox maps onto it at 1.08 px/unit).  Every frame is a pure function of
// its index: a 3D sway + 2D camera is applied to the logo layers, the name on
// a tilted 3D ring and an orbiting star ring, sub-frame samples are averaged
// for real motion blur, then bloom, background and grain are composited.
(() => {
  const W = 1080, H = 1080, FPS = 60, FRAMES = 121;
  const RES = 2;               // logo layers are rasterized at 2x for close-ups
  const UNIT = W / 1000;       // SVG unit -> world px
  const PIVOT = { x: 540, y: 719 };     // camera zoom pivot (measured from reference)
  const SWAY_C = { x: 540, y: 520 };    // 3D rotation centre of the logo
  const FOCAL = 1900;          // perspective focal length (px)

  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const easeOutCubic = t => 1 - Math.pow(1 - clamp(t), 3);
  const easeInOutSine = t => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t));

  function mulberry32(a) {
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Monotone cubic (Fritsch-Carlson) interpolation through [frame, value] keys.
  function curve(keys) {
    const xs = keys.map(k => k[0]), ys = keys.map(k => k[1]), n = keys.length;
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return f => {
      if (f <= xs[0]) return ys[0];
      if (f >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (f > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (f - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
        + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // ---------------------------------------------------------------- timeline
  // All curves take a fractional frame number f (60 fps).
  const T = {};
  // Camera zoom: whip-in close-up, zoom out to 0.725 at f57, ease back to 1.
  // (the intro is ~12% wider than the reference so the pork-pie brim stays in frame)
  T.scale = curve([[-1, 4.8], [0, 3.3], [1, 2.3], [2, 2.0], [3, 1.85], [4, 1.75], [5, 1.67], [6, 1.61], [8, 1.53],
    [10, 1.47], [12, 1.43], [14, 1.4], [16, 1.36],
    [20, 1.27], [25, 1.12], [30, 1.0], [35, 0.9], [40, 0.83], [45, 0.78], [50, 0.745], [57, 0.725],
    [65, 0.733], [70, 0.75], [75, 0.772], [80, 0.808], [85, 0.842], [90, 0.884], [95, 0.921],
    [100, 0.955], [105, 0.983], [110, 0.996], [115, 1.0], [121, 1.0]]);
  // Intro whip: vertical slam + roll that settles into a decaying shake.
  T.whipY = curve([[-1, 2300], [0, 1150], [1, 330], [2, 120], [3, -40], [4, -95], [5, 70], [6, -30], [7, 12], [8.5, -4], [10, 0]]);
  T.whipX = curve([[-1, -1100], [0, -520], [1, -120], [2, -20], [3, 10], [5, 0]]);
  T.whipRoll = curve([[-1, 75], [0, 40], [1, 16], [2, 6], [3, -8], [4, -12], [5, -5], [6, 3], [8, 2], [10, -1.2], [13, 0.5], [16, 0]]);
  // Intro letter flips: letters start edge-on and swing open about their
  // vertical axis with a small overshoot, staggered so some are still thin
  // bars while others face the camera (reference f1-f8). Never mirrored.
  const FLIP_START = [0.5, 0, 1.7, 0.9, 2.5, 1.3, 0.2, 2.1];
  const easeOutBack = t => { const c = 1.9; t = clamp(t) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
  T.letterFlip = (f, i) => 90 * (1 - easeOutBack((f - FLIP_START[i % FLIP_START.length]) / 5.5));
  // Global pitch: camera starts below the name ring (rainbow arc), rises above (smile arc).
  T.pitch = curve([[0, -24], [16, -21], [24, -12], [32, 2], [40, 12], [48, 16], [70, 15], [95, 17.5], [121, 15]]);

  function camera(f) {
    const s = T.scale(f);
    // decaying hand-held shake after the whip
    const k = f < 5 ? smooth(f / 5) : 1;
    const decay = Math.exp(-Math.max(0, f - 5) / 7) * k;
    const sx = (Math.sin(f * 1.9) + 0.6 * Math.sin(f * 3.7 + 1.3)) * 9 * decay;
    const sy = (Math.sin(f * 2.3 + 0.7) + 0.5 * Math.sin(f * 4.1 + 2.1)) * 8 * decay;
    const sr = (Math.sin(f * 2.7 + 0.4) * 0.9) * decay;
    // slow sway measured from the reference (roll peaks ~f38 & ~f95)
    const w = smooth((f - 16) / 20);
    const roll = T.whipRoll(f) + sr + w * (0.9 + 1.0 * Math.cos(TAU * (f - 38) / 57));
    const dx = T.whipX(f) + sx + w * 16 * Math.sin(TAU * (f - 58) / 96 - Math.PI / 2);
    const dy = T.whipY(f) + sy;
    const yaw = w * 5.5 * Math.sin(TAU * (f - 34) / 96);
    return { s, roll: roll * D2R, dx, dy, yaw: yaw * D2R, pitch: T.pitch(f) * D2R };
  }

  // world 3D point -> screen 2D through sway rotation, perspective and camera
  function makeProjector(cam) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const cr = Math.cos(cam.roll), sr = Math.sin(cam.roll);
    return (x, y, z) => {
      let X = x - SWAY_C.x, Y = y - SWAY_C.y, Z = z;
      // yaw about vertical axis
      let X1 = X * cy + Z * sy, Z1 = -X * sy + Z * cy;
      // pitch about horizontal axis: positive = seen from above (front dips down)
      let Y2 = Y * cp + Z1 * sp, Z2 = -Y * sp + Z1 * cp;
      const p = FOCAL / (FOCAL - Z2);
      const wx = SWAY_C.x + X1 * p, wy = SWAY_C.y + Y2 * p;
      // 2D camera about the pivot
      const ux = (wx - PIVOT.x) * cam.s, uy = (wy - PIVOT.y) * cam.s;
      return {
        x: PIVOT.x + ux * cr - uy * sr + cam.dx,
        y: PIVOT.y + ux * sr + uy * cr + cam.dy,
        z: Z2, p,
      };
    };
  }

  // affine (a,b,c,d,e,f) mapping local 2D (origin o, x-dir u, y-dir v, all 3D) to screen
  function affineFor(proj, o, u, v) {
    const P = proj(o.x, o.y, o.z);
    const U = proj(o.x + u.x, o.y + u.y, o.z + u.z);
    const V = proj(o.x + v.x, o.y + v.y, o.z + v.z);
    return [U.x - P.x, U.y - P.y, V.x - P.x, V.y - P.y, P.x, P.y, P];
  }

  // ------------------------------------------------------------------ state
  const S = {
    layers: {},      // id -> {canvas, bbox(world)}
    text: 'IMRAN',
    font: 'Montserrat',
    fontWeight: 650,
    fontPx: 118,
    tracking: 0.38,  // em
    flicker: [],     // per-frame outlined-letter index (-1 none)
    stars: [],
  };

  const scene = document.createElement('canvas');
  scene.width = W; scene.height = H;
  const sctx = scene.getContext('2d', { willReadFrequently: true });
  const tmp = document.createElement('canvas');
  tmp.width = W; tmp.height = H;
  const tctx = tmp.getContext('2d');
  const out = document.getElementById('out');
  out.width = W; out.height = H;
  const octx = out.getContext('2d', { willReadFrequently: true });
  const tmp2 = document.createElement('canvas');
  tmp2.width = W; tmp2.height = H;
  const tctx2 = tmp2.getContext('2d');
  const glowC = document.createElement('canvas');
  glowC.width = W; glowC.height = H;
  const gctx = glowC.getContext('2d');

  async function loadSvgImage(text) {
    const im = new Image();
    im.src = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    await im.decode();
    return im;
  }

  function alphaBBox(canvas) {
    const c = canvas.getContext('2d', { willReadFrequently: true });
    const { data, width, height } = c.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    if (x1 < 0) return null;
    const k = 1 / RES;
    return { x0: x0 * k, y0: y0 * k, x1: x1 * k, y1: y1 * k, cx: (x0 + x1) / 2 * k, cy: (y0 + y1) / 2 * k };
  }

  async function setup(opts) {
    Object.assign(S, opts.style || {});
    if (opts.text) S.text = opts.text;
    const doc = new DOMParser().parseFromString(opts.svg, 'image/svg+xml');
    const root = doc.documentElement;
    const ids = ['head', 'hat', 'eye-left', 'eye-right', 'smile'];
    for (const id of ids) {
      const clone = root.cloneNode(true);
      for (const g of [...clone.children]) {
        const tag = g.tagName.toLowerCase();
        if (tag === 'defs') continue;
        if (g.getAttribute('id') !== id) g.remove();
      }
      clone.setAttribute('width', 1000 * RES * UNIT);
      clone.setAttribute('height', 1000 * RES * UNIT);
      const im = await loadSvgImage(new XMLSerializer().serializeToString(clone));
      const c = document.createElement('canvas');
      c.width = W * RES; c.height = H * RES;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      // black silhouette: occluder for the whites-only glow pass
      const sil = document.createElement('canvas');
      sil.width = c.width; sil.height = c.height;
      const sx = sil.getContext('2d');
      sx.drawImage(c, 0, 0);
      sx.globalCompositeOperation = 'source-in';
      sx.fillStyle = '#000';
      sx.fillRect(0, 0, sil.width, sil.height);
      S.layers[id] = { canvas: c, sil, bbox: alphaBBox(c) };
    }
    // bright smile variant for the finale / sheen
    await document.fonts.load(`${S.fontWeight} ${S.fontPx}px ${S.font}`);
    await document.fonts.ready;
    buildText();
    buildFlicker();
    buildStars();
    return { layers: Object.fromEntries(ids.map(id => [id, S.layers[id].bbox])), letters: S.letters };
  }

  // ------------------------------------------------------------------- text
  function buildText() {
    sctx.font = `${S.fontWeight} ${S.fontPx}px ${S.font}`;
    const chars = [...S.text];
    const track = S.tracking * S.fontPx;
    const widths = chars.map(ch => sctx.measureText(ch).width);
    const total = widths.reduce((a, b) => a + b, 0) + track * (chars.length - 1);
    const capM = sctx.measureText('H');
    S.capH = capM.actualBoundingBoxAscent;
    let x = -total / 2;
    S.letters = chars.map((ch, i) => {
      const cx = x + widths[i] / 2;
      x += widths[i] + track;
      return { ch, offset: cx, width: widths[i] };
    });
  }

  function buildFlicker() {
    // one letter at a time flips to a hollow outline for 3-6 frames
    const rnd = mulberry32(1337);
    const n = S.letters.length;
    const seq = new Array(FRAMES + 2).fill(-1);
    let f = 14, prev = -1;
    while (f < FRAMES) {
      const dur = 3 + Math.floor(rnd() * 4);
      let idx;
      if (rnd() < 0.14) idx = -1;
      else { do { idx = Math.floor(rnd() * n); } while (idx === prev && n > 1); }
      for (let k = 0; k < dur && f + k < seq.length; k++) seq[f + k] = idx;
      prev = idx; f += dur;
    }
    S.flicker = seq;
  }

  const RING = { cx: 540, y: 792, r: 430 };             // name ring (world): sits under the smile
  const TEXT_END = 115;                                  // name cuts out (reference)

  function drawText(ctx, proj, cam, f) {
    if (f >= TEXT_END) return;
    const outlineIdx = S.flicker[Math.floor(f)] ?? -1;
    const depth = 12;           // extrusion depth (world px)
    const layers = 9;
    const items = S.letters.map((L, i) => {
      const a = Math.PI / 2 - L.offset / RING.r;   // angle on ring, PI/2 = front
      const ca = Math.cos(a), sa = Math.sin(a);
      const o = { x: RING.cx + RING.r * ca, y: RING.y, z: RING.r * sa - RING.r };
      let n = { x: ca, y: 0, z: sa };              // outward normal
      let u = { x: sa, y: 0, z: -ca };             // tangent (glyph +x)
      const th = T.letterFlip(f, i) * D2R;
      if (th) {
        const c = Math.cos(th), s = Math.sin(th);
        [u, n] = [{ x: u.x * c + n.x * s, y: 0, z: u.z * c + n.z * s },
          { x: n.x * c - u.x * s, y: 0, z: n.z * c - u.z * s }];
      }
      const v = { x: 0, y: 1, z: 0 };              // glyph +y (down)
      return { L, i, o, n, u, v };
    });
    // paint far letters first
    items.sort((p, q) => p.o.z - q.o.z);
    ctx.save();
    ctx.font = `${S.fontWeight} ${S.fontPx}px ${S.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const yOff = S.capH / 2;
    for (const it of items) {
      const hollow = it.i === outlineIdx;
      // extrusion: back to front
      for (let k = 0; k <= layers; k++) {
        const d = depth * (1 - k / layers);
        const o = { x: it.o.x - it.n.x * d, y: it.o.y, z: it.o.z - it.n.z * d };
        const A = affineFor(proj, o, it.u, it.v);
        ctx.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
        if (k < layers) {
          const shade = Math.round(lerp(70, 150, k / layers));
          if (hollow) {
            if (k === 0) {
              ctx.lineWidth = 1.6;
              ctx.strokeStyle = 'rgba(200,196,210,0.45)';
              ctx.strokeText(it.L.ch, 0, yOff);
            }
          } else {
            ctx.fillStyle = `rgb(${shade},${shade - 2},${shade + 6})`;
            ctx.fillText(it.L.ch, 0, yOff);
          }
        } else if (hollow) {
          ctx.lineWidth = 2.4;
          ctx.strokeStyle = 'rgba(236,232,244,0.92)';
          ctx.strokeText(it.L.ch, 0, yOff);
        } else {
          ctx.fillStyle = '#fbfaff';
          ctx.fillText(it.L.ch, 0, yOff);
        }
      }
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ stars
  const STAR_RING = { cx: 540, cy: 520, r: 430, tilt: 28 * D2R };
  const STAR_N = 8;
  function buildStars() {
    const rnd = mulberry32(4242);
    S.stars = Array.from({ length: STAR_N }, (_, k) => ({
      k,
      size: 0.86 + rnd() * 0.26,
      spin: (rnd() < 0.5 ? -1 : 1) * (2.2 + rnd() * 2.6) * D2R,   // rad / frame
      rot0: rnd() * TAU,
      flip: (1.5 + rnd() * 2.5) * D2R,
      flip0: rnd() * TAU,
      jitter: (rnd() - 0.5) * 30,
    }));
  }
  const STAR_START = 15;
  const starSpacing = curve([[STAR_START, 4.5], [24, 9], [36, 22], [50, 38], [62, 45], [121, 45]]);
  const starLead = f => -46 + 4.5 * (f - STAR_START) - 0.004 * Math.pow(Math.max(0, f - STAR_START), 2);

  function starPath(ctx, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rad = i % 2 ? r : R;
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  function starStates(proj, f) {
    if (f < STAR_START) return [];
    const lead = starLead(f), sp = starSpacing(f);
    const appear = smooth((f - STAR_START) / 5);
    return S.stars.map(st => {
      const b = (lead - st.k * sp + st.jitter * smooth((f - 30) / 30)) * D2R;
      const lx = STAR_RING.r * Math.cos(b), ly = STAR_RING.r * Math.sin(b);
      const x = STAR_RING.cx + lx;
      const y = STAR_RING.cy + ly * Math.cos(STAR_RING.tilt);
      const z = ly * Math.sin(STAR_RING.tilt);
      const P = proj(x, y, z);
      // stars entering later in the chain appear a touch later
      const a = appear * smooth((f - STAR_START - st.k * 0.6) / 4);
      return { st, P, z: P.z, a, f };
    });
  }

  function drawStar(ctx, s, cam) {
    const { st, P, a, f } = s;
    if (a <= 0.001) return;
    const depthT = clamp((P.z + 200) / 400);   // 0 far .. 1 near
    const R = 39 * st.size * P.p * cam.s * lerp(0.84, 1.06, depthT);
    const rot = st.rot0 + st.spin * f;
    const flip = 0.55 + 0.45 * Math.abs(Math.cos(st.flip0 + st.flip * f));
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, P.x, P.y);
    ctx.rotate(rot + cam.roll);
    ctx.scale(flip, 1);
    starPath(ctx, R, R * 0.47);
    const c0 = [255, 255, 255], c1 = [118, 98, 136];
    const m = smooth(depthT * 1.6);
    const col = c0.map((c, i) => Math.round(lerp(c1[i], c, m)));
    ctx.globalAlpha = a * lerp(0.85, 1, m);
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = R * 0.14;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------------- logo
  function drawLayer(ctx, proj, id, xf) {
    const L = S.layers[id];
    if (!L) return;
    // plane affine from world (0,0,0) with unit x/y directions
    const A = affineFor(proj, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    ctx.save();
    ctx.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    if (xf && L.bbox) {
      const { cx, cy } = L.bbox;
      ctx.translate(cx, cy);
      if (xf.rot) ctx.rotate(xf.rot);
      ctx.scale(xf.sx ?? 1, xf.sy ?? 1);
      ctx.translate(-cx, -cy);
    }
    if (xf && xf.alpha != null) ctx.globalAlpha = xf.alpha;
    ctx.drawImage(xf && xf.sil ? L.sil : L.canvas, 0, 0, W, H);
    ctx.restore();
  }

  const eyeOpen = curve([[0, 0.2], [38, 0.2], [42, 1.18], [45, 0.9], [48, 1.04], [51, 1]]);
  function drawSmile(ctx, proj, f) {
    const L = S.layers.smile;
    if (!L || !L.bbox) return;
    const finale = f >= TEXT_END;
    if (finale) { drawLayer(ctx, proj, 'smile', { alpha: 1 }); return; }
    // dim base + travelling sheen
    drawLayer(ctx, proj, 'smile', { alpha: 0.34 });
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, W, H);
    drawLayer(tctx, proj, 'smile', null);
    const A = affineFor(proj, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    const { x0, x1, cy } = L.bbox;
    const span = x1 - x0;
    const ph = ((f - 10) / 46) % 1;                       // sweep period ~0.77 s
    const cx = x0 - span * 0.4 + ph * span * 1.8;
    tctx.setTransform(A[0], A[1], A[2], A[3], A[4], A[5]);
    tctx.globalCompositeOperation = 'destination-in';
    const g = tctx.createLinearGradient(cx - span * 0.32, 0, cx + span * 0.32, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.fillStyle = g;
    tctx.fillRect(x0 - span, cy - span, span * 3, span * 2);
    tctx.globalCompositeOperation = 'source-over';
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }

  // -------------------------------------------------------------- one sample
  // glow=true draws only the white elements (head and hat become black
  // occluders) as the source for the hot white halo
  function drawSample(ctx, f, glow = false) {
    const cam = camera(f);
    const proj = makeProjector(cam);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const stars = starStates(proj, f);
    for (const s of stars) if (s.z < 0) drawStar(ctx, s, cam);
    drawLayer(ctx, proj, 'head', glow ? { sil: true } : null);
    drawLayer(ctx, proj, 'hat', glow ? { sil: true } : null);
    const eo = eyeOpen(f);
    drawLayer(ctx, proj, 'eye-left', { sy: eo, sx: lerp(1.35, 1, clamp(eo)) });
    const tw = f > 50 ? 1 + 0.06 * Math.sin((f - 50) * 0.21) : 1;
    drawLayer(ctx, proj, 'eye-right', {
      sx: lerp(0.42, 1, clamp(eo)) * tw, sy: lerp(1.12, 1, clamp(eo)) * tw,
      rot: (f > 50 ? 7 * Math.sin((f - 50) * 0.12) : 0) * D2R,
    });
    drawSmile(ctx, proj, f);
    drawText(ctx, proj, cam, f);
    for (const s of stars) if (s.z >= 0) drawStar(ctx, s, cam);
    return cam;
  }

  // ------------------------------------------------------------ background
  function drawBackground(ctx, cam, f) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const proj = makeProjector(cam);
    const c = proj(540, 470, 0);
    const g = ctx.createRadialGradient(c.x, c.y, 20, lerp(c.x, 540, 0.5), lerp(c.y, 560, 0.5), 820);
    g.addColorStop(0, '#2b2631');
    g.addColorStop(0.38, '#1f1b23');
    g.addColorStop(0.72, '#110f13');
    g.addColorStop(1, '#050406');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // soft backlight halo that tracks the logo
    const r = 470 * cam.s;
    const h = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    h.addColorStop(0, 'rgba(92,82,104,0.42)');
    h.addColorStop(0.5, 'rgba(70,62,82,0.2)');
    h.addColorStop(1, 'rgba(60,52,70,0)');
    ctx.fillStyle = h;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStreaks(ctx, f) {
    // light-streak flash on the first frames (reference f0-f2): broad soft
    // diagonal smears, grey with a lavender cast toward the top right
    const a = f <= 0.5 ? 1 : Math.pow(Math.max(0, 1 - (f - 0.5) / 1.3), 2);
    if (a <= 0) return;
    const rnd = mulberry32(99);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.filter = 'blur(10px)';
    ctx.translate(540, 540);
    ctx.rotate(-56 * D2R);
    for (let i = 0; i < 70; i++) {
      const y = (rnd() - 0.5) * 1650;
      const w = 6 + rnd() * rnd() * 120;
      const len = 1100 + rnd() * 1500;
      const x = (rnd() - 0.5) * 700 - len / 2 + f * 300;
      const lum = 0.35 + 0.65 * rnd();
      // top-right (negative y after rotation) leans lavender
      const purple = rnd() < 0.25 + 0.5 * clamp((-y + 300) / 1200);
      const col = purple ? [200, 176, 232] : [196, 194, 204];
      const al = (w > 50 ? 0.18 : 0.34) * a * lum;
      const g = ctx.createLinearGradient(x, 0, x + len, 0);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.35, `rgba(${col},${al})`);
      g.addColorStop(0.7, `rgba(${col},${al * 0.8})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, len, w);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ frame render
  const acc = new Float32Array(W * H * 4);
  function renderFrame(frame, opts = {}) {
    const samples = opts.samples ?? (frame < 16 ? 48 : frame < 45 ? 24 : 14);
    const shutter = opts.shutter ?? (frame < 16 ? 1.0 : lerp(0.75, 0.42, smooth((frame - 16) / 30)));
    acc.fill(0);
    let camMid = null;
    for (let j = 0; j < samples; j++) {
      const f = frame + shutter * ((j + 0.5) / samples - 0.5);
      const cam = drawSample(sctx, f);
      if (j === Math.floor(samples / 2)) camMid = cam;
      const d = sctx.getImageData(0, 0, W, H).data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a === 0) continue;
        acc[i] += d[i] * a; acc[i + 1] += d[i + 1] * a; acc[i + 2] += d[i + 2] * a; acc[i + 3] += a;
      }
    }
    // resolve accumulated premultiplied samples into the scene canvas
    const img = sctx.createImageData(W, H);
    const o = img.data, inv = 1 / samples;
    for (let i = 0; i < o.length; i += 4) {
      const a = acc[i + 3];
      if (a <= 0) continue;
      o[i] = acc[i] / a; o[i + 1] = acc[i + 1] / a; o[i + 2] = acc[i + 2] / a;
      o[i + 3] = a * inv;
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.putImageData(img, 0, 0);

    // whites-only glow source: a few samples across the shutter, averaged
    const G = Math.min(samples, frame < 16 ? 10 : 6);
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.globalCompositeOperation = 'source-over';
    gctx.clearRect(0, 0, W, H);
    gctx.globalCompositeOperation = 'lighter';
    gctx.globalAlpha = 1 / G;
    for (let j = 0; j < G; j++) {
      drawSample(tctx2, frame + shutter * ((j + 0.5) / G - 0.5), true);
      gctx.drawImage(tmp2, 0, 0);
    }
    gctx.globalAlpha = 1;
    gctx.globalCompositeOperation = 'source-over';

    // composite: background, outer glows (under the scene so the hat keeps
    // its gradient and the face stays dark), scene, hot white bloom on top
    const finale = frame >= TEXT_END ? 1 : 0;
    drawBackground(octx, camMid || camera(frame), frame);
    octx.save();
    octx.globalCompositeOperation = 'screen';
    for (const [src, r, a] of [[scene, 26, 0.5], [scene, 80, 0.45], [glowC, 14, 0.85 + 0.1 * finale], [glowC, 40, 0.4]]) {
      octx.filter = `blur(${r}px)`;
      octx.globalAlpha = a;
      octx.drawImage(src, 0, 0);
    }
    octx.restore();
    octx.drawImage(scene, 0, 0);
    octx.save();
    octx.globalCompositeOperation = 'screen';
    for (const [r, a] of [[3, 0.35], [9, 0.45 + 0.15 * finale]]) {
      octx.filter = `blur(${r}px)`;
      octx.globalAlpha = a;
      octx.drawImage(glowC, 0, 0);
    }
    octx.restore();
    drawStreaks(octx, frame);
    if (opts.grain !== false) {
      const g = octx.getImageData(0, 0, W, H), gd = g.data;
      const rnd = mulberry32(7919 * (frame + 1));
      for (let i = 0; i < gd.length; i += 4) {
        const n = (rnd() - 0.5) * 5;
        gd[i] += n; gd[i + 1] += n; gd[i + 2] += n;
      }
      octx.putImageData(g, 0, 0);
    }
    return out.toDataURL('image/png');
  }

  window.IMRAN = { setup, renderFrame, FRAMES, FPS, W, H, camera, T };
})();
