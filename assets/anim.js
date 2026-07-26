/* ------------------------------------------------------------------------
   Hand-drawn line animation
   ------------------------------------------------------------------------
   A tiny 2D engine for "boiling" brush-line animation:

     drawings are lists of strokes -> strokes are anchor points
     -> splined -> resampled -> roughened with seeded noise -> painted
        as tapered round-cap segments.

   Everything is a pure function of the frame index, so the same frame
   always renders identically. That is what lets render.mjs step through
   frames offscreen and encode a video.
   ---------------------------------------------------------------------- */

const W = 1280;
const H = 720;

const OUT_FPS = 24;  // frames written to the video
const DRAW_FPS = 12; // how often the drawing itself changes ("on twos")
const DURATION = 6;
const TOTAL_FRAMES = Math.round(DURATION * OUT_FPS);

const C = {
  bg: '#e2d8cb',
  ink: '#171512',
  accent: '#df7f53',
  paper: '#f7f4ee',
  badgeShadow: '#c2653e',
};

// The corner badge. Change these two strings to re-label the animation.
const BADGE = { kicker: 'CLAUDE', title: 'OPUS 5' };

/* --- little math ------------------------------------------------------ */

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeIn = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const smooth = (t) => t * t * (3 - 2 * t);

// Normalised progress through the window [a, b].
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

const fract = (x) => x - Math.floor(x);
const hash1 = (n) => fract(Math.sin(n) * 43758.5453123);

// Smooth 1D value noise in -1..1, stable for a given seed.
function vnoise(x, seed) {
  const i = Math.floor(x);
  const u = smooth(fract(x));
  const a = hash1(i * 12.9898 + seed * 78.233);
  const b = hash1((i + 1) * 12.9898 + seed * 78.233);
  return (a + (b - a) * u) * 2 - 1;
}

/* --- stroke geometry -------------------------------------------------- */

// Catmull-Rom through every anchor, so shapes follow the points I picked
// and get sharp corners wherever the anchors bunch up.
function spline(pts, per = 14) {
  if (pts.length < 2) return pts.map((p) => p.slice());
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [x0, y0] = P[i - 1];
    const [x1, y1] = P[i];
    const [x2, y2] = P[i + 1];
    const [x3, y3] = P[i + 2];
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
        0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1].slice());
  return out;
}

// Even spacing makes the draw-on reveal advance at a constant speed.
function resample(poly, spacing = 5) {
  if (poly.length < 2) return poly.map((p) => p.slice());
  const out = [poly[0].slice()];
  let carry = 0;
  for (let i = 1; i < poly.length; i++) {
    let [ax, ay] = poly[i - 1];
    const [bx, by] = poly[i];
    let d = Math.hypot(bx - ax, by - ay);
    while (carry + d >= spacing) {
      const need = (spacing - carry) / d;
      ax = ax + (bx - ax) * need;
      ay = ay + (by - ay) * need;
      out.push([ax, ay]);
      d = Math.hypot(bx - ax, by - ay);
      carry = 0;
    }
    carry += d;
  }
  const last = poly[poly.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > spacing * 0.4) {
    out.push(last.slice());
  }
  return out;
}

// Push points sideways along their own normal: a slow wander for the
// overall wobble of a hand, plus a faster ripple for brush chatter.
function roughen(poly, seed, amp = 2.6) {
  const n = poly.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = poly[i];
    const a = poly[Math.max(0, i - 1)];
    const b = poly[Math.min(n - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const wander = vnoise(i * 0.035, seed) * amp * 1.5;
    const chatter = vnoise(i * 0.28, seed + 17.3) * amp * 0.45;
    // Ends stay put so shapes do not drift apart at their joins.
    const hold = smooth(clamp(Math.min(i, n - 1 - i) / 6, 0, 1));
    const d = (wander + chatter) * hold;
    out[i] = [p[0] + nx * d, p[1] + ny * d];
  }
  return out;
}

/* --- painting --------------------------------------------------------- */

// One brush line. `progress` < 1 leaves it half-drawn, tapered at the tip,
// which is the whole "line drawing itself" effect.
function brush(ctx, poly, opts = {}) {
  const width = opts.width ?? 8;
  const color = opts.color ?? C.ink;
  const alpha = opts.alpha ?? 1;
  const progress = clamp(opts.progress ?? 1, 0, 1);
  const seed = opts.seed ?? 0;
  if (alpha <= 0.002 || progress <= 0.001 || poly.length < 2) return;

  const n = poly.length;
  const visible = Math.max(2, Math.round(n * progress));
  const tipIsEnd = visible >= n;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < visible - 1; i++) {
    const t = i / (visible - 1);
    // Taper the head, the tail, and (while drawing) the moving tip.
    const headIn = smooth(clamp(t / 0.05, 0, 1));
    const tailIn = smooth(clamp((1 - t) / (tipIsEnd ? 0.05 : 0.12), 0, 1));
    const pressure = 0.86 + 0.14 * vnoise(i * 0.06, seed + 3.1);
    const w = width * (0.3 + 0.7 * Math.min(headIn, tailIn)) * pressure;
    ctx.lineWidth = Math.max(0.6, w);
    ctx.beginPath();
    ctx.moveTo(poly[i][0], poly[i][1]);
    ctx.lineTo(poly[i + 1][0], poly[i + 1][1]);
    ctx.stroke();
  }
  ctx.restore();
}

// A closed wobbly blob (cheek, screen, paper) with no outline.
function blob(ctx, pts, opts = {}) {
  const alpha = opts.alpha ?? 1;
  if (alpha <= 0.002) return;
  const poly = roughen(resample(spline(pts, 16), 6), opts.seed ?? 0, opts.amp ?? 2.2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = opts.color ?? C.accent;
  ctx.beginPath();
  ctx.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Cache the expensive spline+resample step; only roughening is per-frame.
const baseCache = new Map();
function base(key, pts, spacing = 5) {
  let v = baseCache.get(key);
  if (!v) {
    v = resample(spline(pts, 14), spacing);
    baseCache.set(key, v);
  }
  return v;
}

function line(ctx, key, pts, opts = {}) {
  const poly = roughen(base(key, pts), opts.seed ?? 0, opts.amp ?? 2.6);
  brush(ctx, poly, opts);
}

/* --- drawings --------------------------------------------------------- */

// Profile facing left: crown, forehead, brow, nose, lips, chin, jaw,
// all in one unbroken line. Anchors bunch up wherever a feature needs a
// corner (the nose tip, the lips) and spread out over the smooth curves.
const FACE_PROFILE = [
  [770, 166], [730, 138], [684, 128], [642, 138], [612, 168], [598, 210],
  [594, 258], [590, 286], [578, 300], [560, 334], [586, 346], [600, 350],
  [604, 366], [588, 380], [602, 390], [598, 404], [618, 414], [624, 430],
  [658, 440], [696, 440],
];

const CHEEK = [
  [664, 246], [692, 238], [714, 252], [716, 278], [696, 290], [670, 284], [658, 264],
];

// Fist tucked under the chin: index finger curling up the cheek, three
// knuckle creases, then the outline of the fist itself.
const THINK_HAND = [
  [[494, 470], [502, 430], [522, 398], [550, 378], [568, 376], [564, 396], [546, 420], [536, 440]],
  [[540, 444], [578, 436], [616, 440], [640, 452]],
  [[544, 470], [584, 464], [620, 470], [640, 480]],
  [[550, 496], [588, 490], [620, 496], [636, 508]],
  [[638, 442], [690, 432], [726, 448], [744, 484], [738, 526], [704, 562], [656, 582], [612, 582], [578, 564], [564, 534], [570, 494], [574, 468]],
];

// One finger: an inverted U, tip at the top.
function finger(x, tipY, bottomY, halfW) {
  return [
    [x - halfW, bottomY],
    [x - halfW - 1, tipY + halfW * 1.6],
    [x - halfW * 0.55, tipY],
    [x + halfW * 0.55, tipY],
    [x + halfW + 1, tipY + halfW * 1.6],
    [x + halfW, bottomY],
  ];
}

// Two hands seen from behind, fingertips up on an implied keyboard, with
// the thumbs turned in towards each other. The outermost stroke of each
// hand is the pinky curling over at the top and running on down into the
// wrist, which is what stops the hands reading as loose fingers.
// `taps` lifts individual fingers; `bob` sinks the whole hand slightly.
function typingHand(side, taps, bob) {
  const spec =
    side === 'left'
      ? {
          edge: [[398, 440], [396, 396], [402, 356], [416, 336], [434, 336], [442, 356], [438, 400], [434, 448],
                 [418, 500], [396, 546], [386, 572]],
          fingers: [[470, 330, 452, 17], [512, 322, 458, 18], [554, 334, 458, 17]],
          thumb: [[562, 464], [582, 424], [608, 412], [626, 426], [624, 456], [604, 498], [576, 538], [562, 570]],
        }
      : {
          // Deliberately not a mirror of the left hand -- slightly
          // narrower, with the fingertips at their own heights.
          edge: [[878, 442], [880, 398], [874, 358], [860, 340], [842, 340], [834, 358], [838, 402], [842, 450],
                 [858, 502], [880, 546], [890, 572]],
          fingers: [[806, 326, 452, 17], [764, 320, 456, 18], [722, 338, 460, 16]],
          thumb: [[714, 466], [694, 428], [668, 414], [650, 428], [652, 458], [672, 500], [700, 540], [714, 570]],
        };

  const strokes = [];
  // The pinky flexes at its tip; the wrist below it barely moves.
  strokes.push({
    pts: spec.edge.map((p, i) => [p[0], p[1] + taps[0] * (i < 7 ? 1 : 0.25) + bob]),
  });
  spec.fingers.forEach((f, i) => {
    const dy = taps[i + 1];
    strokes.push({ pts: finger(f[0], f[1] + dy, f[2] + dy * 0.3, f[3]).map((p) => [p[0], p[1] + bob]) });
  });
  strokes.push({ pts: spec.thumb.map((p) => [p[0], p[1] + bob]) });
  return strokes;
}

/* --- corner badge ----------------------------------------------------- */

function sparkle(ctx, cx, cy, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const b = a + Math.PI / 4;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(b) * r * 0.26, cy + Math.sin(b) * r * 0.26);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawBadge(ctx) {
  const pad = 22;
  const h = 58;
  const w = 218;
  const x = W - pad - w;
  const y = pad;
  ctx.save();
  ctx.fillStyle = C.badgeShadow;
  roundRect(ctx, x + 5, y + 5, w, h, 4);
  ctx.fill();
  ctx.fillStyle = C.accent;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  sparkle(ctx, x + 30, y + h / 2, 11, C.paper);
  ctx.fillStyle = C.paper;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 14px system-ui, "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillText(BADGE.kicker, x + 52, y + 21);
  ctx.font = '600 29px system-ui, "Segoe UI", Helvetica, Arial, sans-serif';
  ctx.fillText(BADGE.title, x + 52, y + 47);
  ctx.restore();
}

/* --- the animation ---------------------------------------------------- */
/*
   0.00-0.75  the face draws itself on
   0.75-1.10  a hand rises to the chin
   1.10-2.35  thinking: idle boil, a slow nod, fingers flexing
   2.35-2.85  morph: the face drifts off, the desk line opens into a screen
   2.85-5.35  typing: fingers tap, lines of writing appear on the screen
   5.35-6.00  a spark pops, then everything fades for a clean loop
*/
function render(ctx, frame) {
  const f = ((frame % TOTAL_FRAMES) + TOTAL_FRAMES) % TOTAL_FRAMES;
  const step = Math.floor((f * DRAW_FPS) / OUT_FPS); // held for 2 frames
  const t = step / DRAW_FPS;
  const seed = step * 1.7 + 0.5;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  const out = 1 - easeIn(seg(t, 5.72, 6.0)); // global fade for the loop
  ctx.save();
  ctx.globalAlpha = out;

  /* --- thinking half --- */
  const faceGone = seg(t, 2.35, 2.78);
  const faceAlpha = 1 - easeIn(faceGone);

  if (faceAlpha > 0.002) {
    const nod = Math.sin(t * 2.1) * 3.2 * seg(t, 1.1, 1.5);
    ctx.save();
    // On the way out the head lifts, shrinks and slides off to the right.
    const k = easeInOut(faceGone);
    ctx.translate(640 + 150 * k, 360 - 120 * k + nod);
    ctx.scale(1 - 0.45 * k, 1 - 0.45 * k);
    ctx.translate(-640, -360);

    // Starts slightly "before" zero so frame one already has ink on it.
    const faceDraw = easeOut(seg(t, -0.1, 0.75));
    line(ctx, 'face', FACE_PROFILE, { progress: faceDraw, width: 9, seed, alpha: faceAlpha });
    blob(ctx, CHEEK, { seed, alpha: faceAlpha * easeOut(seg(t, 0.17, 0.42)) });

    const handDraw = easeOut(seg(t, 0.72, 1.12));
    THINK_HAND.forEach((pts, i) => {
      // Creases flex a little while the head is thinking.
      const flex = i >= 1 && i <= 3 ? Math.sin(t * 3.4 - i * 0.7) * 2.4 * seg(t, 1.15, 1.45) : 0;
      const moved = pts.map((p) => [p[0] + flex * 0.6, p[1] + flex]);
      line(ctx, `hand${i}`, moved, {
        progress: clamp(handDraw * 1.35 - i * 0.09, 0, 1),
        width: i === 4 ? 8.5 : 7,
        seed: seed + i * 5,
        alpha: faceAlpha,
      });
    });
    ctx.restore();
  }

  /* --- the desk line opening into a screen --- */
  const deskIn = easeOut(seg(t, 2.42, 2.62));
  const openUp = easeInOut(seg(t, 2.56, 2.92));
  if (deskIn > 0.002) {
    const cx = 640;
    const halfW = lerp(120, 279, deskIn);
    const top = lerp(426, 170, openUp);
    const bot = 432;
    const l = cx - halfW;
    const r = cx + halfW;
    // Plenty of anchors along each edge so the roughening reads as a
    // slightly shaky straight line rather than a billow. Corners get a
    // tight chamfer: coincident anchors would be sharper but their two
    // normals disagree, which spits out a spur once the edge is roughened.
    const cr = Math.min(9, (bot - top) / 3);
    const pts = [
      [l + cr, top], [lerp(l, r, 0.33), top - 4], [lerp(l, r, 0.66), top - 1], [r - cr, top + 2],
      [r + 1, top + cr], [r + 3, lerp(top, bot, 0.33)], [r, lerp(top, bot, 0.66)], [r - 1, bot - cr],
      [r - cr, bot], [lerp(l, r, 0.66), bot - 3], [lerp(l, r, 0.33), bot], [l + cr, bot + 2],
      [l + 1, bot - cr], [l - 2, lerp(top, bot, 0.66)], [l + 1, lerp(top, bot, 0.33)], [l, top + cr],
    ];
    blob(ctx, pts, { color: C.paper, seed, alpha: 1, amp: 1.3 });
  }

  /* --- typing half --- */
  const handsIn = easeOut(seg(t, 2.62, 2.95));
  if (handsIn > 0.002) {
    // Each finger taps on its own offset rhythm.
    const tapFor = (phase) => {
      const v = Math.sin((t - 2.7) * 9.2 + phase);
      return Math.max(0, v) * 9 * (1 - easeIn(seg(t, 5.2, 5.7)));
    };
    const bob = Math.sin((t - 2.7) * 2.4) * 2.2;

    // Lines of writing appearing on the screen, drawn before the hands so
    // the fingers sit in front of them.
    const rows = [
      [[404, 226], [500, 222], [598, 227], [694, 223], [744, 226]],
      [[404, 268], [486, 264], [570, 269], [652, 265], [700, 268]],
      [[404, 310], [512, 306], [620, 311], [728, 307], [812, 310]],
    ];
    rows.forEach((r, i) => {
      const p = easeOut(seg(t, 3.15 + i * 0.55, 3.65 + i * 0.55));
      line(ctx, `row${i}`, r, { progress: p, width: 5.5, seed: seed + 40 + i, alpha: 0.85, amp: 0.6 });
    });

    ['left', 'right'].forEach((side, s) => {
      const taps = [tapFor(s * 1.9), tapFor(s * 1.9 + 1.2), tapFor(s * 1.9 + 2.6), tapFor(s * 1.9 + 4.1)];
      typingHand(side, taps, bob).forEach((st, i) => {
        // These points move every frame, so they cannot use the shape
        // cache and get splined fresh instead.
        const poly = roughen(resample(spline(st.pts, 12), 5), seed + s * 11 + i * 3, 2.6);
        brush(ctx, poly, {
          progress: clamp(handsIn * 1.3 - i * 0.05, 0, 1),
          width: 9,
          alpha: 1,
          seed: seed + i,
        });
      });
    });

    // And a spark, once the thought has landed.
    const sp = seg(t, 5.05, 5.45);
    if (sp > 0) {
      const pop = sp < 0.45 ? easeOut(sp / 0.45) : 1 - easeIn((sp - 0.45) / 0.55) * 0.25;
      sparkle(ctx, 1004, 142, 26 * pop, C.accent, Math.min(1, sp * 4));
      sparkle(ctx, 1054, 204, 13 * pop, C.accent, Math.min(1, sp * 3) * 0.8);
    }
  }

  ctx.restore();
  drawBadge(ctx);
}

/* --- exports ---------------------------------------------------------- */

const ANIM = { W, H, OUT_FPS, DRAW_FPS, DURATION, TOTAL_FRAMES, render, C };
if (typeof window !== 'undefined') window.ANIM = ANIM;
