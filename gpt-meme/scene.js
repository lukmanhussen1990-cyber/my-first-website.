/* =====================================================================
   GPT — "WHAT ABOUT ME?"
   2D animated meme · 1080x1920 · 30 fps · 15 s · no audio

   Every frame is a pure function of time:  MEME.render(ctx, t)
   - Open index.html (via `node render.js --serve`) to preview / scrub.
   - Run `node render.js` to export gpt_what_about_me.mp4.

   Edit TIMING (seconds) below to re-time anything. COPY holds all text,
   LAYOUT holds positions, COLORS holds the palette.
   ===================================================================== */
(function (global) {
'use strict';

// ─────────────────────────────────────────────────────────────────────
//  TIMING  (all values in seconds)
// ─────────────────────────────────────────────────────────────────────
const TIMING = {
  DURATION: 15.0,
  FPS: 30,

  // ── Act 1 · bright room, happy scrolling (0.0 – 4.5) ──────────────
  SWIPES: [0.30, 1.00, 2.15, 3.35, 4.05], // right-thumb scroll flicks
  CHUCKLES: [1.20, 2.70],                  // shoulder-bounce chuckles start
  CHUCKLE_LEN: 1.0,
  MICRO_TAP_SEED: 11,                      // seed for idle thumb taps
  BLINK_SEED: 4,                           // seed for random blinks
  FIRST_BLINK: 0.75,
  BLINK_GAP: [2.0, 4.0],                   // random gap between blinks
  BLINK_LEN: 0.17,
  BREATH_PERIOD: 3.4,                      // body scale 1.00 → 1.02 loop

  // ── Act 2 · taps a story, smile fades to confusion (4.5 – 5.5) ────
  TAP: 4.58,                               // thumb press on the story
  SMILE_FADE: [4.65, 5.45],                // slow smile fade [start, end]
  CONFUSED_IN: 4.85, CONFUSED_LEN: 0.65,   // confused pose change
  TRAY_OUT: [5.40, 5.55],                  // stories tray fades out

  // ── Story popup (5.5 – 6.5) ───────────────────────────────────────
  POPUP_IN: 5.50, POPUP_SLIDE: 0.45,       // slide-in with overshoot
  SURPRISE_IN: 5.62, SURPRISE_LEN: 0.50,   // eyes widen + lean in

  // ── Act 3 · HARD CUT, lights out (6.5 – 9.0) ──────────────────────
  LIGHTS_OUT: 6.50,
  GLOSS: [6.60, 7.70],                     // eyes go glossy
  SAD_IN: 6.62, SAD_LEN: 0.85,             // brows go sad
  PRESS_IN: 6.80, PRESS_LEN: 0.60,         // lips press together
  SLOW_BLINK: 7.70, SLOW_BLINK_LEN: 1.00,  // the one slow blink
  LINE1_WORDS: [7.00, 7.45, 8.35],         // "WHAT" · "ABOUT" · "ME?"

  // ── Act 4 · second line, head lowers, sniffle (9.0 – 12.0) ────────
  LINE2_WORDS: [9.10, 9.50, 10.20],        // "WHAT" · "ABOUT" · "ME?"
  HEAD_LOWER_IN: 9.20, HEAD_LOWER_LEN: 1.50,
  GLOSS_MORE: [10.20, 11.00],              // eyes get even more teary
  SNIFFLE: 10.75,                          // shoulder twitch
  SCREEN_DIM: [11.05, 11.60],              // phone screen dims
  LATE_BLINK: 11.85, LATE_BLINK_LEN: 0.75,

  // ── Act 5 · outro (12.0 – 15.0) ───────────────────────────────────
  BG_FADE: [12.00, 13.40],                 // room falls to black first
  CHAR_FADE: [12.00, 14.30],               // GPT fades to a faint silhouette
  TEXT_FADE: [12.00, 13.30], TEXT_FADE_TO: 0.40,
  HANDLE_MOVE_IN: 12.20, HANDLE_MOVE_LEN: 1.30,
  HANDLE_PULSE_PERIOD: 1.10,
  TO_BLACK: [14.40, 14.90],                // everything → black

  WORD_POP_LEN: 0.16,                      // typewriter jitter per word
};

// ─────────────────────────────────────────────────────────────────────
//  COPY  (all on-screen text)
// ─────────────────────────────────────────────────────────────────────
const COPY = {
  HANDLE: '@YOURHANDLE',
  LINE: ['WHAT', 'ABOUT', 'ME?'],
  TRAY: ['Your story', 'user_42', 'pixel.pal', 'neo_bot'],
  STORY_USER: 'user_42',
  STORY_AGE: '2h',
  STORY_CAPTION: 'I said yes',
  STORY_SUB: 'switched to Claude',
  STORY_REPLY: 'Send message',
  GPT_TAG: 'GPT',
  CLAUDE_TAG: 'Claude',
};

// ─────────────────────────────────────────────────────────────────────
//  LAYOUT  (pixels, 1080x1920 canvas)
// ─────────────────────────────────────────────────────────────────────
const W = 1080, H = 1920;
const LAYOUT = {
  PIVOT: { x: 590, y: 1040 },          // camera zoom pivot
  NECK: { x: 590, y: 1150 },           // where the head sits on the hoodie
  HEAD_RX: 285, HEAD_RY: 262,
  PHONE: { x: 585, y: 1535, w: 236, h: 356, rot: -0.06 },
  TRAY: { x: 44, y: 268, w: 560, h: 214 },
  POPUP: { x: 52, y: 262, w: 340, h: 604 },
  TEXT_Y: [348, 422], TEXT_SIZE: 46, TEXT_TRACK: 11,
  HANDLE: { right: 1012, y: 560, size: 34 },
  HANDLE_END: { x: 540, y: 990, size: 60 },
};

// ─────────────────────────────────────────────────────────────────────
//  COLORS
// ─────────────────────────────────────────────────────────────────────
const C = {
  teal: '#62CDB5', tealTop: '#7ADAC4', tealBot: '#53BFA6', tealShade: '#3FA894',
  tealDeep: '#2F8C7C', tealLine: '#1E5A51', tealLight: '#A6F0DE',
  hoodie: '#2F6FE3', hoodieShade: '#2153BC', hoodieDeep: '#1A43A0', hoodieLight: '#5C96F3',
  hoodieLine: '#14347E', hoodieRib: '#3A7BEA',
  tee: '#1B2135',
  brow: '#1E5249', mouthLine: '#1D4C45', mouthIn: '#7A2335', tongue: '#F27D8E',
  phone: '#3A404D', phoneDark: '#262B35', phoneLine: '#12151B',
  hp: '#E8EBF1', hpShade: '#B9C1CF', hpLine: '#5A6272', cushion: '#2B2F3A',
  claude: '#DD7C51', claudeTop: '#E99068', claudeShade: '#B65A37', claudeLine: '#73351F',
  skin: '#F2BD97', skinShade: '#D89A72', skinLine: '#8C5537',
  wood: '#B7743A', woodDark: '#8A5024', woodLight: '#D69A5C', woodLine: '#5E3415',
  bamboo: '#86B94F', bambooShade: '#5D8F34', bambooLight: '#BCE07F', leaf: '#6EAD45', leafShade: '#4A8730',
};

// ─────────────────────────────────────────────────────────────────────
//  Math, easing, keyframes
// ─────────────────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, a, b) => clamp((t - a) / (b - a));
const Ease = {
  sine: p => 0.5 - 0.5 * Math.cos(Math.PI * p),
  cubic: p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
  outCubic: p => 1 - Math.pow(1 - p, 3),
  inCubic: p => p * p * p,
  outBack: (p, s = 1.7) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
};

/** Keyframe track: keys = [[time, value], ...], eased (sine in-out) per segment. */
function track(t, keys, ease = Ease.sine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

/** Pose change with anticipation → overshoot → settle. */
function pose(t, t0, dur, from, to, antic = 0.12, over = 0.10) {
  const d = to - from;
  return track(t, [
    [t0, from],
    [t0 + dur * 0.22, from - d * antic],
    [t0 + dur * 0.60, to + d * over],
    [t0 + dur * 0.82, to - d * over * 0.3],
    [t0 + dur, to],
  ]);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

// ─────────────────────────────────────────────────────────────────────
//  Schedules (deterministic "random")
// ─────────────────────────────────────────────────────────────────────
const BLINKS = (() => {
  const r = mulberry32(TIMING.BLINK_SEED), out = [];
  let b = TIMING.FIRST_BLINK;
  while (b < TIMING.LIGHTS_OUT - 0.3) {
    out.push([b, TIMING.BLINK_LEN]);
    b += lerp(TIMING.BLINK_GAP[0], TIMING.BLINK_GAP[1], r());
  }
  out.push([TIMING.SLOW_BLINK, TIMING.SLOW_BLINK_LEN]);
  out.push([TIMING.LATE_BLINK, TIMING.LATE_BLINK_LEN]);
  return out;
})();

const MICRO_TAPS = (() => {
  const r = mulberry32(TIMING.MICRO_TAP_SEED), out = [];
  let tt = 0.15;
  while (tt < TIMING.TAP - 0.45) {
    const busy = TIMING.SWIPES.some(s => Math.abs(s - tt) < 0.3) ||
      TIMING.CHUCKLES.some(c => tt > c - 0.1 && tt < c + TIMING.CHUCKLE_LEN);
    if (!busy) out.push([tt, r() < 0.45 ? -1 : 1, 6 + r() * 6]);
    tt += 0.32 + r() * 0.4;
  }
  return out;
})();

// ─────────────────────────────────────────────────────────────────────
//  Motion curves
// ─────────────────────────────────────────────────────────────────────
function blinkAt(t) {
  let c = 0;
  for (const [b, len] of BLINKS) {
    if (t < b || t > b + len) continue;
    const p = (t - b) / len;
    const v = p < 0.38 ? Ease.sine(p / 0.38) : p < 0.55 ? 1 : 1 - Ease.sine((p - 0.55) / 0.45);
    c = Math.max(c, v);
  }
  return c;
}

function chuckle(t, t0, len) {
  if (t < t0 || t > t0 + len) return { y: 0, env: 0, open: 0 };
  const p = (t - t0) / len;
  const env = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(clamp(p), 0.8))), 0.7);
  const b = Math.abs(Math.sin(Math.PI * 3.5 * p));
  return { y: -14 * env * b, env, open: env * (0.35 + 0.65 * b) };
}

// thumb-tip dip curves (positive = tip goes down behind the phone edge)
const tapCurve = (dt, d) => track(dt, [[-0.14, 0], [-0.06, -d * 0.4], [0, d], [0.09, -d * 0.18], [0.2, 0]]);
const swipeCurve = dt => track(dt, [[-0.12, 0], [-0.05, -6], [0.1, 30], [0.24, -5], [0.36, 0]]);
const storyTap = dt => track(dt, [[-0.3, 0], [-0.1, -12], [0, 30], [0.14, -6], [0.3, 0]]);
const sniffleCurve = t => track(t - TIMING.SNIFFLE,
  [[-0.05, 0], [0.06, 1], [0.15, -0.22], [0.27, 0], [0.42, 0.55], [0.52, -0.12], [0.7, 0]]);

// ─────────────────────────────────────────────────────────────────────
//  Pose: every animated parameter of GPT at time t
// ─────────────────────────────────────────────────────────────────────
function getPose(t) {
  const T = TIMING, P = { t };
  const dark = t >= T.LIGHTS_OUT;
  P.dark = dark;
  const idle = dark ? 0.22 : 1; // GPT "freezes" after the cut

  // breathing + sniffle
  const breath = 0.5 - 0.5 * Math.cos(TAU * t / T.BREATH_PERIOD);
  const sn = sniffleCurve(t);
  P.sniffle = sn;
  P.bodyScale = 1 + 0.02 * breath * (dark ? 0.6 : 1) + 0.005 * Math.max(0, sn);

  // chuckles (shoulders bounce, head follows a beat later)
  let chY = 0, chYLag = 0, chEnv = 0, chOpen = 0;
  if (!dark) {
    for (const c of T.CHUCKLES) {
      const r = chuckle(t, c, T.CHUCKLE_LEN), rl = chuckle(t - 0.05, c, T.CHUCKLE_LEN);
      chY += r.y; chYLag += rl.y; chEnv = Math.max(chEnv, r.env); chOpen = Math.max(chOpen, r.open);
    }
  }
  P.chuckle = chEnv;
  P.bodyY = chY - 10 * sn;

  // expression drivers
  const smileBase = track(t, [[T.SMILE_FADE[0], 1], [T.SMILE_FADE[1], 0]]);
  let confused = pose(t, T.CONFUSED_IN, T.CONFUSED_LEN, 0, 1, 0.15, 0.12);
  let surprise = pose(t, T.SURPRISE_IN, T.SURPRISE_LEN, 0, 1, 0.2, 0.14);
  const lean = pose(t, T.SURPRISE_IN - 0.04, 0.55, 0, 1, 0.18, 0.12);
  if (dark) {
    confused *= 1 - Ease.sine(prog(t, T.LIGHTS_OUT + 0.1, T.LIGHTS_OUT + 0.8));
    surprise *= lerp(1, 0.2, Ease.sine(prog(t, T.LIGHTS_OUT + 0.2, T.LIGHTS_OUT + 1.2)));
  }
  const sad = pose(t, T.SAD_IN, T.SAD_LEN, 0, 1, 0.1, 0.1);
  const press = pose(t, T.PRESS_IN, T.PRESS_LEN, 0, 1, 0.12, 0.12);
  const lower = pose(t, T.HEAD_LOWER_IN, T.HEAD_LOWER_LEN, 0, 1, 0.1, 0.07);
  P.confused = confused; P.surprise = surprise; P.sad = sad; P.lower = lower;

  // mouth
  P.smile = dark ? -0.28 * sad : smileBase;
  P.open = chOpen * 0.95;
  P.oh = dark ? surprise * (1 - prog(t, T.LIGHTS_OUT + 0.05, T.PRESS_IN + 0.2)) * 0.6 : surprise;
  P.press = press;
  P.quiver = dark ? 0.35 * press + 1.6 * Math.abs(sn) : 0;

  // eyes
  P.blink = blinkAt(t);
  P.squint = 0.38 * chEnv + 0.1 * smileBase * (dark ? 0 : 1);
  P.eyeScale = 1 + 0.12 * surprise;
  P.eyeL = 1 + 0.06 * confused;          // raised-brow eye opens a bit wider
  P.eyeR = 1 - 0.05 * confused;
  P.lidTop = 0.1 + 0.08 * sad + 0.13 * lower - 0.08 * surprise;
  P.lidTopR = 0.14 * confused;           // skeptical squint on one eye
  P.lidTilt = sad;
  P.gloss = track(t, [[T.GLOSS[0], 0], [T.GLOSS[1], 1], [T.GLOSS_MORE[0], 1], [T.GLOSS_MORE[1], 1.35]]);
  P.lookX = -0.05; P.lookY = 0.16 + 0.06 * lower;

  // brows: raise (+ up), tilt (+ inner end up = sad)
  const happyB = dark ? 0 : 0.55 * smileBase + 0.45 * chEnv;
  P.browL = { raise: happyB + 0.95 * confused + 0.8 * surprise - 0.25 * sad, tilt: 1.0 * sad + 0.1 * confused };
  P.browR = { raise: happyB - 0.55 * confused + 0.8 * surprise - 0.25 * sad, tilt: 1.0 * sad - 0.75 * confused };

  // blush
  P.blush = dark ? 0.25 : 0.42 + 0.25 * chEnv - 0.2 * confused;

  // head
  const bobY = (Math.sin(TAU * t / 2.3) * 4 + Math.sin(TAU * t / 0.95 + 1) * 1.2) * idle;
  P.headX = Math.sin(TAU * t / 4.4) * 3 * idle - 8 * confused;
  P.headY = bobY + (chYLag - chY) * 0.9 + 24 * lower + 8 * lean;
  P.headRot = Math.sin(TAU * t / 3.3 + 0.5) * 0.012 * idle - 0.06 * confused + 0.025 * lower;
  const sq = 0.014 * Math.min(1, -chY / 14);   // squash on each chuckle bounce
  P.headSX = 1 + 0.025 * lean + sq; P.headSY = 1 + 0.025 * lean - sq - 0.012 * lower;
  P.faceDX = -4 + 6 * confused; P.faceDY = 8 + 14 * lower;

  // hands / phone
  let tl = 0, tr = 0, press0 = 0;
  if (!dark) {
    for (const s of T.SWIPES) tr += swipeCurve(t - s);
    for (const [tt, side, d] of MICRO_TAPS) { const v = tapCurve(t - tt, d); side < 0 ? (tl += v) : (tr += v); }
    const st = storyTap(t - T.TAP); tr += st; press0 = Math.max(0, st) / 30;
  }
  P.thumbL = tl; P.thumbR = tr;
  P.phoneX = Math.sin(TAU * t / 5.1) * 2 * idle;
  P.phoneY = 4 * press0 + 0.5 * chY + 12 * lower;
  P.phoneRot = LAYOUT.PHONE.rot + Math.sin(TAU * t / 3.7) * 0.012 * idle + 0.02 * lower;

  // light from the screen
  const swipeFlash = T.SWIPES.reduce((a, s) => a + Math.max(0, 1 - Math.abs(t - s - 0.12) / 0.15), 0);
  P.faceGlow = 0.11 + 0.05 * vnoise(t * 9) + 0.07 * Math.min(1, swipeFlash);
  const charFade = Ease.sine(prog(t, ...T.CHAR_FADE));
  P.charFade = charFade;
  P.glow = track(t, [[T.SCREEN_DIM[0], 1], [T.SCREEN_DIM[1], 0.55]]) *
    (1 + 0.05 * (vnoise(t * 11) - 0.5)) * (1 - 0.72 * charFade);
  return P;
}

// ─────────────────────────────────────────────────────────────────────
//  Transforms
// ─────────────────────────────────────────────────────────────────────
function camera(t) {
  const T = TIMING;
  const x = Math.sin(t * 0.42) * 9 + Math.sin(t * 1.13 + 1) * 3;
  const y = Math.sin(t * 0.31 + 2) * 6 + Math.sin(t * 0.83) * 2;
  let zoom = 1 + 0.025 * Ease.sine(prog(t, 0, T.LIGHTS_OUT));
  if (t >= T.LIGHTS_OUT) zoom = 1.055 + 0.045 * Ease.sine(prog(t, T.LIGHTS_OUT, T.DURATION));
  return { x, y, zoom };
}
function camXform(ctx, cam, f) {
  const z = 1 + (cam.zoom - 1) * f, p = LAYOUT.PIVOT;
  ctx.translate(p.x, p.y); ctx.scale(z, z); ctx.translate(-p.x + cam.x * f, -p.y + cam.y * f);
}
function gptMatrices(P) {
  const L = LAYOUT;
  const body = new DOMMatrix().translate(0, P.bodyY).translate(590, 1960).scale(P.bodyScale).translate(-590, -1960);
  const neck = body.transformPoint(new DOMPoint(L.NECK.x, L.NECK.y));
  const head = new DOMMatrix()
    .translate(neck.x + P.headX, neck.y - 245 + P.headY)
    .translate(0, 210).rotate(P.headRot * 180 / Math.PI).translate(0, -210)
    .scale(P.headSX, P.headSY);
  const phone = new DOMMatrix()
    .translate(L.PHONE.x + P.phoneX, L.PHONE.y + P.phoneY)
    .rotate(P.phoneRot * 180 / Math.PI);
  return { body, head, phone };
}
const applyM = (ctx, m) => ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);

// Secondary motion: antenna + drawstrings follow with spring lag
const SPR = { init: false };
function springs(t) {
  const dt = 1 / 240;
  const anchor = tt => { const P = getPose(tt), M = gptMatrices(P); const p = M.head.transformPoint(new DOMPoint(0, -LAYOUT.HEAD_RY)); return { x: p.x, y: p.y, by: P.bodyY }; };
  if (!SPR.init || t < SPR.t - 1e-6) {
    const a0 = anchor(0), a1 = anchor(dt);
    Object.assign(SPR, { init: true, t: 0, ax: a0.x, ay: a0.y, vx: (a1.x - a0.x) / dt, vy: (a1.y - a0.y) / dt,
      ox: 0, oy: 0, ovx: 0, ovy: 0, by: a0.by, bv: 0, sy: 0, svy: 0, sx: 0, svx: 0 });
  }
  while (SPR.t + dt <= t + 1e-9) {
    const a = anchor(SPR.t + dt);
    const vx = (a.x - SPR.ax) / dt, vy = (a.y - SPR.ay) / dt;
    const accx = (vx - SPR.vx) / dt, accy = (vy - SPR.vy) / dt;
    SPR.ovx += (-170 * SPR.ox - 7 * SPR.ovx - accx) * dt; SPR.ox += SPR.ovx * dt;
    SPR.ovy += (-260 * SPR.oy - 9 * SPR.ovy - accy) * dt; SPR.oy += SPR.ovy * dt;
    const bv = (a.by - SPR.by) / dt, bacc = (bv - SPR.bv) / dt;
    SPR.svy += (-120 * SPR.sy - 6 * SPR.svy - bacc) * dt; SPR.sy += SPR.svy * dt;
    SPR.svx += (-90 * SPR.sx - 4 * SPR.svx - accx * 0.6) * dt; SPR.sx += SPR.svx * dt;
    Object.assign(SPR, { ax: a.x, ay: a.y, vx, vy, by: a.by, bv, t: SPR.t + dt });
  }
  return { ax: clamp(SPR.ox, -34, 34), ay: clamp(SPR.oy, -20, 20), sx: clamp(SPR.sx, -14, 14), sy: clamp(SPR.sy, -12, 12) };
}

// ─────────────────────────────────────────────────────────────────────
//  Drawing helpers
// ─────────────────────────────────────────────────────────────────────
function ellipseP(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, TAU); return p; }
function rrectP(x, y, w, h, r) { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; }
function capsuleP(x1, y1, x2, y2, r) { return tubeP([{ x: x1, y: y1 }, { x: x2, y: y2 }], [r * 2, r * 2], 2); }
function superP(rx, ry, n) {
  const p = new Path2D(), N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU, c = Math.cos(a), s = Math.sin(a);
    const x = rx * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
    const y = ry * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    i ? p.lineTo(x, y) : p.moveTo(x, y);
  }
  p.closePath(); return p;
}
/** Smooth tube along a Catmull-Rom centerline, round caps. */
function tubeP(pts, widths, steps = 20) {
  const S = [];
  const n = pts.length;
  if (n === 2) {
    for (let i = 0; i <= steps; i++) { const u = i / steps; S.push({ x: lerp(pts[0].x, pts[1].x, u), y: lerp(pts[0].y, pts[1].y, u), w: lerp(widths[0], widths[1], u) }); }
  } else {
    for (let s = 0; s < n - 1; s++) {
      const p0 = pts[Math.max(0, s - 1)], p1 = pts[s], p2 = pts[s + 1], p3 = pts[Math.min(n - 1, s + 2)];
      for (let i = s ? 1 : 0; i <= steps; i++) {
        const u = i / steps, u2 = u * u, u3 = u2 * u;
        const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
        S.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), w: lerp(widths[s], widths[s + 1], u) });
      }
    }
  }
  const Lf = [], Rt = [], ang = [];
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 1)], b = S[Math.min(S.length - 1, i + 1)];
    let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const nx = -dy, ny = dx, r = S[i].w / 2;
    Lf.push([S[i].x + nx * r, S[i].y + ny * r]); Rt.push([S[i].x - nx * r, S[i].y - ny * r]); ang.push(Math.atan2(ny, nx));
  }
  const p = new Path2D();
  p.moveTo(...Lf[0]);
  for (let i = 1; i < Lf.length; i++) p.lineTo(...Lf[i]);
  const e = S.length - 1;
  p.arc(S[e].x, S[e].y, S[e].w / 2, ang[e], ang[e] - Math.PI, true);
  for (let i = e; i >= 0; i--) p.lineTo(...Rt[i]);
  p.arc(S[0].x, S[0].y, S[0].w / 2, ang[0] + Math.PI, ang[0], true);
  p.closePath();
  return p;
}
/** Soft cel shading: base fill, offset shadow (blurred edge), optional outline. */
function cel(ctx, path, o) {
  ctx.fillStyle = o.base; ctx.fill(path);
  if (o.shade) {
    ctx.save(); ctx.clip(path);
    const sp = new Path2D(); sp.rect(-6000, -6000, 14000, 14000);
    sp.addPath(path, new DOMMatrix().translate(o.off[0], o.off[1]));
    if (o.blur) ctx.filter = `blur(${o.blur}px)`;
    ctx.fillStyle = o.shade; ctx.globalAlpha *= (o.shadeA ?? 1);
    ctx.fill(sp, 'evenodd');
    ctx.restore();
  }
  if (o.line) { ctx.lineWidth = o.lw || 5; ctx.strokeStyle = o.line; ctx.lineJoin = 'round'; ctx.stroke(path); }
}
function radial(ctx, x, y, r, stops, sy = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g; ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
}
function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function star4(ctx, x, y, r, color, a = 1) {
  if (r <= 0.2) return;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a; ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0); ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
  ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0); ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
  ctx.fill(); ctx.restore();
}
function heart(ctx, x, y, s, color) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8); ctx.bezierCurveTo(8, -16, 14, -4, 0, 6);
  ctx.fill(); ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  ROOM  (parallax: far wall 0.35, furniture 0.6, character 1.0)
// ─────────────────────────────────────────────────────────────────────
const ceilY = x => 318 - 0.07 * x;
function drawRoom(ctx, t, cam) {
  // far layer
  ctx.save(); camXform(ctx, cam, 0.35);
  ctx.fillStyle = linGrad(ctx, 0, 200, 0, 2000, [[0, '#F7EBD2'], [1, '#E8D1AA']]);
  ctx.fillRect(-300, -300, W + 600, H + 600);
  radial(ctx, 880, 640, 950, [[0, 'rgba(255,248,228,0.75)'], [0.6, 'rgba(255,244,220,0.25)'], [1, 'rgba(255,244,220,0)']]);
  radial(ctx, 120, 1500, 700, [[0, 'rgba(150,100,50,0.10)'], [1, 'rgba(150,100,50,0)']]);

  // wall panel moldings
  const panel = (x, y, w, h) => {
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,250,236,0.95)'; ctx.strokeRect(x, y, w, h);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(196,168,120,0.55)'; ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.strokeStyle = 'rgba(196,168,120,0.35)'; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  };
  panel(300, 500, 590, 1150); panel(960, 500, 300, 1150); panel(-260, 500, 500, 1150);

  // ceiling + crown molding
  const X0 = -400, X1 = W + 400;
  ctx.fillStyle = linGrad(ctx, 0, -100, 0, 360, [[0, '#FFFBF4'], [1, '#EFE6D6']]);
  ctx.beginPath(); ctx.moveTo(X0, -400); ctx.lineTo(X1, -400); ctx.lineTo(X1, ceilY(X1)); ctx.lineTo(X0, ceilY(X0)); ctx.fill();
  const strips = [[0, 14, '#FFFDF7'], [14, 24, '#DCCDB3'], [24, 44, '#FFFBF2'], [44, 50, '#D3C2A4'], [50, 64, '#FAF3E4'], [64, 70, '#C9B696']];
  for (const [o1, o2, col] of strips) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(X0, ceilY(X0) + o1); ctx.lineTo(X1, ceilY(X1) + o1); ctx.lineTo(X1, ceilY(X1) + o2); ctx.lineTo(X0, ceilY(X0) + o2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(190,170,135,0.35)';
  for (let x = X0; x < X1; x += 26) { const y = ceilY(x) + 27; ctx.fillRect(x, y, 12, 14); }
  ctx.save(); ctx.beginPath();
  ctx.moveTo(X0, ceilY(X0) + 70); ctx.lineTo(X1, ceilY(X1) + 70); ctx.lineTo(X1, ceilY(X1) + 140); ctx.lineTo(X0, ceilY(X0) + 140); ctx.clip();
  ctx.fillStyle = linGrad(ctx, 0, ceilY(540) + 70, 0, ceilY(540) + 140, [[0, 'rgba(120,90,50,0.20)'], [1, 'rgba(120,90,50,0)']]);
  ctx.fillRect(X0, 0, X1 - X0, 600); ctx.restore();

  // soft ambient shadow behind the character
  radial(ctx, 610, 1350, 640, [[0, 'rgba(90,60,30,0.16)'], [1, 'rgba(90,60,30,0)']], 0.9);
  ctx.restore();

  // mid layer
  ctx.save(); camXform(ctx, cam, 0.6);
  drawCabinet(ctx);
  drawBamboo(ctx, t);
  ctx.restore();
}

function drawCabinet(ctx) {
  const x0 = -110, x1 = 262, top = 1000;
  // side face (perspective)
  ctx.fillStyle = C.woodDark; ctx.beginPath();
  ctx.moveTo(x1, top); ctx.lineTo(x1 + 34, top + 18); ctx.lineTo(x1 + 34, 2100); ctx.lineTo(x1, 2100); ctx.fill();
  // body
  const body = rrectP(x0, top, x1 - x0, 1100, 4);
  cel(ctx, body, { base: linGrad(ctx, x0, 0, x1, 0, [[0, '#A9672F'], [1, C.wood]]), line: C.woodLine, lw: 4 });
  // cornice
  const corn = rrectP(x0 - 20, top - 34, x1 - x0 + 66, 38, 6);
  cel(ctx, corn, { base: linGrad(ctx, 0, top - 34, 0, top, [[0, C.woodLight], [1, C.wood]]), line: C.woodLine, lw: 4 });
  ctx.fillStyle = 'rgba(255,230,190,0.35)'; ctx.fillRect(x0 - 16, top - 30, x1 - x0 + 58, 6);
  // two glass doors
  const doors = [[x0 + 22, 160], [x0 + 196, 156]];
  for (const [dx, dw] of doors) {
    const dy = top + 26, dh = 1020;
    cel(ctx, rrectP(dx, dy, dw, dh, 6), { base: C.wood, shade: C.woodDark, off: [-6, -6], blur: 2, shadeA: 0.6, line: C.woodLine, lw: 3 });
    const gx = dx + 18, gy = dy + 18, gw = dw - 36, gh = 560;
    ctx.fillStyle = linGrad(ctx, gx, gy, gx + gw, gy + gh, [[0, '#5B5148'], [1, '#3F3731']]);
    ctx.fillRect(gx, gy, gw, gh);
    // things behind the glass: books + jar
    const books = ['#C9584A', '#E3B65A', '#5E8C7A', '#8B6BB5', '#D98E5F', '#4F79A8'];
    for (let i = 0; i < 6; i++) {
      const bw = 16 + (i % 3) * 4, bh = 90 + ((i * 37) % 30);
      ctx.fillStyle = books[(i + (dx > 0 ? 3 : 0)) % 6]; ctx.globalAlpha = 0.65;
      ctx.fillRect(gx + 8 + i * 22, gy + 196 - bh, bw, bh);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = 'rgba(30,22,18,0.55)'; ctx.fillRect(gx, gy + 196, gw, 8);
    ctx.fillStyle = 'rgba(240,220,180,0.25)'; ctx.beginPath(); ctx.ellipse(gx + gw * 0.6, gy + 340, 28, 36, 0, 0, TAU); ctx.fill();
    // muntins (2 cols x 3 rows)
    ctx.fillStyle = C.wood; ctx.strokeStyle = C.woodLine; ctx.lineWidth = 2;
    ctx.fillRect(gx + gw / 2 - 5, gy, 10, gh); ctx.strokeRect(gx + gw / 2 - 5, gy, 10, gh);
    for (let r = 1; r < 3; r++) { ctx.fillRect(gx, gy + r * gh / 3 - 5, gw, 10); ctx.strokeRect(gx, gy + r * gh / 3 - 5, gw, 10); }
    // reflections
    ctx.save(); ctx.beginPath(); ctx.rect(gx, gy, gw, gh); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 22;
    ctx.beginPath(); ctx.moveTo(gx - 20, gy + 220); ctx.lineTo(gx + gw + 20, gy + 60); ctx.stroke();
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(gx - 20, gy + 280); ctx.lineTo(gx + gw + 20, gy + 120); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = C.woodLine; ctx.lineWidth = 3; ctx.strokeRect(gx, gy, gw, gh);
  }
  // knobs
  for (const kx of [x0 + 172, x0 + 206]) {
    cel(ctx, ellipseP(kx, top + 640, 9, 9), { base: '#E7C56B', line: '#7A5A17', lw: 2 });
  }
  // wood grain
  ctx.strokeStyle = 'rgba(80,40,10,0.12)'; ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) { const gx = x0 + 10 + i * 45; ctx.beginPath(); ctx.moveTo(gx, top + 8); ctx.bezierCurveTo(gx + 8, top + 300, gx - 8, top + 700, gx + 4, top + 1100); ctx.stroke(); }
}

function drawBamboo(ctx, t) {
  const stalks = [
    { b: [930, 1460], c: [915, 1100], e: [925, 780], w: 24, ph: 0.0 },
    { b: [985, 1460], c: [1000, 1050], e: [1012, 640], w: 26, ph: 1.7 },
    { b: [1045, 1460], c: [1060, 1150], e: [1062, 880], w: 22, ph: 3.1 },
  ];
  const leaves = [];
  for (const s of stalks) {
    const sway = Math.sin(t * 0.9 + s.ph) * 4;
    const pt = u => ({
      x: (1 - u) * (1 - u) * s.b[0] + 2 * u * (1 - u) * s.c[0] + u * u * (s.e[0] + sway),
      y: (1 - u) * (1 - u) * s.b[1] + 2 * u * (1 - u) * s.c[1] + u * u * s.e[1],
    });
    const nSeg = 6;
    for (let k = 0; k < nSeg; k++) {
      const a = pt(k / nSeg), b = pt((k + 1) / nSeg);
      const seg = capsuleP(a.x, a.y - 2, b.x, b.y + 2, s.w / 2);
      cel(ctx, seg, { base: C.bamboo, shade: C.bambooShade, off: [-7, 0], blur: 1.5, line: '#3E6A22', lw: 3 });
      ctx.strokeStyle = 'rgba(220,245,170,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(a.x - s.w * 0.22, a.y - 10); ctx.lineTo(b.x - s.w * 0.22, b.y + 10); ctx.stroke();
      ctx.fillStyle = '#4E7C2C'; ctx.beginPath(); ctx.ellipse(b.x, b.y, s.w / 2 + 3, 5, 0, 0, TAU); ctx.fill();
      if (k >= 3) leaves.push({ x: b.x, y: b.y, k, ph: s.ph });
    }
    leaves.push({ x: pt(1).x, y: pt(1).y, k: 9, ph: s.ph });
  }
  for (const l of leaves) {
    const dir = (l.k + Math.round(l.ph)) % 2 ? 1 : -1;
    const base = dir > 0 ? -0.55 : -2.55;
    for (let j = 0; j < (l.k === 9 ? 3 : 1); j++) {
      const a = base + (l.k === 9 ? (j - 1) * 0.55 : 0) + Math.sin(t * 1.3 + l.ph + j + l.k) * 0.06;
      drawLeaf(ctx, l.x, l.y, a, 120 + (l.k % 3) * 18, 24);
    }
  }
}
function drawLeaf(ctx, x, y, a, len, w) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const p = new Path2D(); p.moveTo(0, 0);
  p.quadraticCurveTo(len * 0.45, -w, len, 0); p.quadraticCurveTo(len * 0.45, w * 0.75, 0, 0);
  cel(ctx, p, { base: C.leaf, shade: C.leafShade, off: [0, -8], blur: 2, line: '#355F1E', lw: 2.5 });
  ctx.strokeStyle = 'rgba(210,240,160,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(4, 0); ctx.quadraticCurveTo(len * 0.5, -w * 0.12, len * 0.92, 0); ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  GPT
// ─────────────────────────────────────────────────────────────────────
function drawGPT(ctx, P, M, spr) {
  ctx.save(); applyM(ctx, M.body); drawBehindHead(ctx); ctx.restore();
  ctx.save(); applyM(ctx, M.head); drawHead(ctx, P, spr); ctx.restore();
  ctx.save(); applyM(ctx, M.body); drawTorso(ctx, P, spr); ctx.restore();
  drawArms(ctx, P, M);
  ctx.save(); applyM(ctx, M.phone);
  drawPalms(ctx); drawThumbs(ctx, P); drawPhone(ctx, P); drawFingers(ctx);
  ctx.restore();
}

function drawBehindHead(ctx) {
  // hood bunched behind the neck
  const hood = ellipseP(590, 1168, 330, 108);
  cel(ctx, hood, { base: C.hoodieShade, shade: C.hoodieDeep, off: [0, 40], blur: 8, line: C.hoodieLine, lw: 5 });
  ctx.save(); ctx.clip(hood);
  ctx.strokeStyle = 'rgba(15,40,110,0.55)'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.ellipse(590, 1190, 290, 90, 0, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
  ctx.restore();
  // dark inner neck / tee
  ctx.fillStyle = '#121828'; ctx.fill(ellipseP(590, 1162, 170, 40));
  // headphone band (behind head)
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.hpLine; ctx.lineWidth = 28;
  ctx.beginPath(); ctx.ellipse(590, 1152, 214, 64, 0, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = C.hp; ctx.lineWidth = 20;
  ctx.beginPath(); ctx.ellipse(590, 1152, 214, 64, 0, Math.PI, TAU); ctx.stroke();
  ctx.strokeStyle = C.hpShade; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.ellipse(590, 1157, 214, 64, 0, Math.PI, TAU); ctx.stroke();
}

function drawHead(ctx, P, spr) {
  const RX = LAYOUT.HEAD_RX, RY = LAYOUT.HEAD_RY;
  const head = superP(RX, RY, 2.35);
  // antenna stem (behind head)
  const tip = { x: spr.ax * 0.9, y: -RY - 84 + spr.ay * 0.6 };
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.tealLine; ctx.lineWidth = 15;
  ctx.beginPath(); ctx.moveTo(0, -RY + 20); ctx.quadraticCurveTo(tip.x * 0.15, (-RY + tip.y) / 2, tip.x, tip.y); ctx.stroke();
  ctx.strokeStyle = C.tealDeep; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(0, -RY + 20); ctx.quadraticCurveTo(tip.x * 0.15, (-RY + tip.y) / 2, tip.x, tip.y); ctx.stroke();
  // ear nubs
  for (const s of [-1, 1]) {
    const ear = rrectP(s * RX - 22, -36, 44, 96, 20);
    cel(ctx, ear, { base: C.tealDeep, shade: '#25705F', off: [s * 10, -10], blur: 2, line: C.tealLine, lw: 5 });
  }
  // head ball
  cel(ctx, head, {
    base: linGrad(ctx, 0, -RY, 0, RY, [[0, C.tealTop], [1, C.tealBot]]),
    shade: C.tealShade, off: P.dark ? [0, 80] : [-60, -52], blur: 10,
  });
  ctx.save(); ctx.clip(head);
  // bounce light + specular
  radial(ctx, 150, 210, 260, [[0, 'rgba(150,240,220,0.0)'], [0.7, 'rgba(150,240,220,0.18)'], [1, 'rgba(150,240,220,0)']]);
  radial(ctx, -120, -150, 190, [[0, 'rgba(255,255,255,0.38)'], [1, 'rgba(255,255,255,0)']], 0.75);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill(ellipseP(-150, -170, 38, 16, -0.6));
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(ellipseP(-95, -205, 9, 6, -0.6));
  // screen glow flicker on the face (bright room)
  if (!P.dark && P.faceGlow > 0) {
    ctx.globalCompositeOperation = 'screen';
    radial(ctx, 0, RY + 170, 520, [[0, `rgba(190,228,255,${P.faceGlow})`], [1, 'rgba(190,228,255,0)']], 0.9);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  ctx.lineWidth = 7; ctx.strokeStyle = C.tealLine; ctx.stroke(head);
  // antenna ball
  const ball = ellipseP(tip.x, tip.y, 21, 21);
  cel(ctx, ball, { base: C.tealLight, shade: '#6CCFB8', off: P.dark ? [0, 8] : [-6, -6], blur: 2, line: C.tealLine, lw: 5 });
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill(ellipseP(tip.x - 7, tip.y - 8, 6, 4, -0.6));

  // face
  ctx.save(); ctx.translate(P.faceDX, P.faceDY);
  for (const s of [-1, 1]) {
    radial(ctx, s * 168, 66, 60, [[0, `rgba(255,120,150,${P.blush})`], [1, 'rgba(255,120,150,0)']], 0.5);
  }
  drawEye(ctx, -1, P); drawEye(ctx, 1, P);
  drawBrow(ctx, -1, P.browL); drawBrow(ctx, 1, P.browR);
  drawMouth(ctx, P);
  ctx.restore();
}

function drawEye(ctx, side, P) {
  const sc = P.eyeScale * (side < 0 ? P.eyeL : P.eyeR);
  const rx = 50 * sc, ry = 64 * sc, t = P.t;
  ctx.save(); ctx.translate(side * 108, -14);
  const eye = ellipseP(0, 0, rx, ry);
  const lx = P.lookX * rx, ly = P.lookY * ry, gl = P.gloss, ga = Math.min(gl, 1);

  // Lids are an aperture (clip), so the head's own shading shows through.
  const closed = clamp(Math.max(P.blink, P.lidTop + (side > 0 ? P.lidTopR : 0)));
  const ey = -ry + 2 * ry * closed + 2;
  const tilt = 12 * P.lidTilt * (1 - closed);
  const upY = x => ey + (x / rx) * side * tilt;
  const upC = ey + 16 * (1 - closed) + 4;                 // lid edge follows the eyeball curve
  const sq = P.squint, loY = ry - 2 * ry * sq + 14, loC = ry - 2 * ry * sq - 26 * sq;
  const hasUp = closed > 0.01, hasLo = sq > 0.01;
  const E = rx + 8;
  const upMid = 0.25 * upY(-E) + 0.5 * upC + 0.25 * upY(E);
  const loMid = hasLo ? 0.25 * loY + 0.5 * loC + 0.25 * loY : ry + 20;
  const shut = upMid >= loMid - 3;
  const ap = new Path2D();
  if (hasUp) { ap.moveTo(-E, upY(-E)); ap.quadraticCurveTo(0, upC, E, upY(E)); }
  else { ap.moveTo(-E, -ry - 10); ap.lineTo(E, -ry - 10); }
  if (hasLo) { ap.lineTo(E, loY); ap.quadraticCurveTo(0, loC, -E, loY); }
  else { ap.lineTo(E, ry + 10); ap.lineTo(-E, ry + 10); }
  ap.closePath();

  if (!shut) {
    ctx.save(); ctx.clip(eye); ctx.clip(ap);
    const g = ctx.createRadialGradient(0, ry * 0.42, 2, 0, ry * 0.1, ry * 1.1);
    g.addColorStop(0, '#3E8FA6'); g.addColorStop(0.45, '#22365C'); g.addColorStop(1, '#131930');
    ctx.fillStyle = g; ctx.fill(eye);
    // watery shine pooling at the bottom (soft, no hard line)
    if (gl > 0) {
      radial(ctx, Math.sin(t * 2.3) * 4, ry * 0.85, rx * 1.1, [[0, `rgba(150,215,255,${0.5 * ga})`], [0.6, `rgba(120,190,255,${0.2 * ga})`], [1, 'rgba(120,190,255,0)']], 0.6);
    }
    // lid casts a soft shadow on the eyeball
    if (hasUp) {
      ctx.strokeStyle = 'rgba(5,8,20,0.35)'; ctx.lineWidth = 22;
      ctx.beginPath(); ctx.moveTo(-E, upY(-E)); ctx.quadraticCurveTo(0, upC, E, upY(E)); ctx.stroke();
    }
    // highlights: grow + wobble when glossy
    const hs = 1 + 0.4 * Math.min(gl, 1.3), wob = gl * 1.8;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fill(ellipseP(rx * 0.3 + lx * 0.3 + Math.sin(t * 7.1) * wob, -ry * 0.34 + ly * 0.3 + Math.cos(t * 6.3) * wob, rx * 0.34 * hs, ry * 0.29 * hs, -0.3));
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fill(ellipseP(-rx * 0.32 + lx * 0.2 + Math.cos(t * 5.3) * wob * 0.6, ry * 0.36 + ly * 0.2, rx * 0.13 * hs, rx * 0.13 * hs));
    if (gl > 0) {
      const tw = 0.5 + 0.5 * Math.sin(t * 8 + side * 1.3);
      // shimmering tear rim along the lower edge
      ctx.strokeStyle = `rgba(215,242,255,${0.8 * ga})`; ctx.lineWidth = 3 + 2.5 * ga;
      ctx.beginPath(); ctx.ellipse(0, -2 + Math.sin(t * 6) * 1.2, rx * 0.86, ry * 0.86, 0, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${0.55 * ga})`;
      ctx.fill(ellipseP(rx * 0.32, ry * 0.42, rx * 0.2 * hs, ry * 0.1 * hs, -0.4));
      star4(ctx, -rx * 0.12, -ry * 0.02, 8 * tw * ga, '#FFFFFF', 0.9);
      star4(ctx, rx * 0.5, ry * 0.12, 6 * (1 - tw) * ga, '#E6F6FF', 0.85);
    }
    ctx.restore();
  }
  // lash lines along the lid edges
  ctx.save(); ctx.clip(ellipseP(0, 0, rx + 7, ry + 7));
  ctx.lineCap = 'round';
  if (hasUp || shut) {
    ctx.strokeStyle = '#141A2E'; ctx.lineWidth = 6.5;
    ctx.beginPath(); ctx.moveTo(-E, upY(-E)); ctx.quadraticCurveTo(0, Math.min(upC, loMid + 4), E, upY(E)); ctx.stroke();
  }
  if (hasLo && !shut) {
    ctx.strokeStyle = 'rgba(20,26,46,0.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-E, loY); ctx.quadraticCurveTo(0, loC, E, loY); ctx.stroke();
  }
  ctx.restore();
  // tear welling on the lower rim (outside the eye)
  if (gl > 0 && !shut) {
    const a = Math.min(gl, 1.3) / 1.3;
    ctx.strokeStyle = `rgba(190,232,255,${0.65 * a})`; ctx.lineWidth = 2 + 3 * a;
    ctx.beginPath(); ctx.ellipse(0, 3, rx * 0.99, ry * 0.99, 0, Math.PI * 0.25, Math.PI * 0.75); ctx.stroke();
    const bead = 3 + 6 * clamp(gl - 0.6, 0, 0.7) / 0.7;
    const bx = -side * rx * 0.66, by = ry * 0.78;
    ctx.fillStyle = `rgba(190,232,255,${0.85 * a})`; ctx.fill(ellipseP(bx, by, bead, bead * 1.15));
    ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fill(ellipseP(bx - bead * 0.3, by - bead * 0.4, bead * 0.32, bead * 0.32));
  }
  ctx.restore();
}

function drawBrow(ctx, side, b) {
  const bx = side * 108, by = -112 - b.raise * 15;
  const inner = { x: bx - side * 44, y: by - b.tilt * 22 + 2 };
  const outer = { x: bx + side * 46, y: by + b.tilt * 11 + 4 };
  const ctl = { x: bx, y: by - 13 + b.tilt * 3 };
  ctx.lineCap = 'round'; ctx.strokeStyle = C.brow; ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(inner.x, inner.y); ctx.quadraticCurveTo(ctl.x, ctl.y, outer.x, outer.y); ctx.stroke();
}

function drawMouth(ctx, P) {
  const sm = P.smile, op = P.open, pr = P.press, cf = P.confused, oh = P.oh;
  const mx = 0, my = 96;
  const w = 40 + 16 * Math.max(0, sm) - 10 * pr - 20 * oh;
  const curve = 26 * sm;
  const skew = 10 * cf;
  const q = P.quiver ? Math.sin(P.t * 41) * P.quiver : 0;
  const L = { x: mx - w, y: my - curve * 0.45 + skew + 4 * pr + q };
  const R = { x: mx + w, y: my - curve * 0.45 - skew + 4 * pr - q };
  const cy = my + curve * 0.55 - 2 * pr;
  const openAmt = op + 0.42 * oh;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (openAmt > 0.04) {
    const depth = 8 + 44 * openAmt;
    const m = new Path2D();
    m.moveTo(L.x, L.y);
    m.bezierCurveTo(mx - w * 0.4, cy - 6 * openAmt + cf * 8, mx + w * 0.4, cy - 6 * openAmt - cf * 8, R.x, R.y);
    m.bezierCurveTo(mx + w * 0.55, cy + depth, mx - w * 0.55, cy + depth, L.x, L.y);
    m.closePath();
    ctx.fillStyle = C.mouthIn; ctx.fill(m);
    ctx.save(); ctx.clip(m);
    ctx.fillStyle = C.tongue; ctx.fill(ellipseP(mx + 2, cy + depth * 0.82, w * 0.55, depth * 0.42));
    ctx.restore();
    ctx.strokeStyle = C.mouthLine; ctx.lineWidth = 6; ctx.stroke(m);
  } else {
    ctx.strokeStyle = C.mouthLine; ctx.lineWidth = 8 + 2 * pr;
    ctx.beginPath(); ctx.moveTo(L.x, L.y);
    ctx.bezierCurveTo(mx - w * 0.4, cy + cf * 12, mx + w * 0.4, cy - cf * 12, R.x, R.y);
    ctx.stroke();
    if (pr > 0.02) {
      ctx.strokeStyle = `rgba(29,76,69,${0.55 * pr})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(mx, my + 34, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); // chin bunch
      ctx.beginPath(); ctx.moveTo(L.x - 4, L.y - 5); ctx.lineTo(L.x + 1, L.y + 4); ctx.stroke(); // corner tucks
      ctx.beginPath(); ctx.moveTo(R.x + 4, R.y - 5); ctx.lineTo(R.x - 1, R.y + 4); ctx.stroke();
    }
  }
}

function torsoP() {
  const p = new Path2D();
  p.moveTo(-80, 2050); p.lineTo(-80, 1460);
  p.bezierCurveTo(-60, 1345, 110, 1272, 270, 1228);
  p.bezierCurveTo(340, 1208, 385, 1175, 412, 1124);
  p.bezierCurveTo(455, 1170, 520, 1184, 590, 1184);
  p.bezierCurveTo(660, 1184, 725, 1170, 768, 1124);
  p.bezierCurveTo(795, 1175, 840, 1208, 910, 1228);
  p.bezierCurveTo(1070, 1272, 1240, 1345, 1260, 1460);
  p.lineTo(1260, 2050); p.closePath();
  return p;
}
function drawTorso(ctx, P, spr) {
  const torso = torsoP();
  cel(ctx, torso, {
    base: linGrad(ctx, 0, 1150, 0, 1950, [[0, C.hoodieLight], [0.25, C.hoodie], [1, '#2A63D4']]),
    shade: C.hoodieShade, off: [-80, -40], blur: 12,
  });
  ctx.save(); ctx.clip(torso);
  // contact shadow under the head
  radial(ctx, 590, 1190, 250, [[0, 'rgba(10,25,80,0.45)'], [1, 'rgba(10,25,80,0)']], 0.28);
  // folds
  ctx.strokeStyle = 'rgba(20,55,150,0.55)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  for (const [a, b, c2, d] of [[[300, 1290], [360, 1330], [380, 1400], [370, 1460]], [[880, 1290], [830, 1330], [810, 1400], [818, 1450]], [[470, 1760], [500, 1800], [520, 1860], [515, 1920]]]) {
    ctx.beginPath(); ctx.moveTo(...a); ctx.bezierCurveTo(...b, ...c2, ...d); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = C.hoodieLine; ctx.stroke(torso);

  // inner tee in the open zipper V
  const v = new Path2D(); v.moveTo(546, 1178); v.lineTo(590, 1296); v.lineTo(634, 1178); v.closePath();
  ctx.fillStyle = C.tee; ctx.fill(v);
  // zipper teeth along V + closed zipper below
  ctx.strokeStyle = '#B9C3D6'; ctx.lineWidth = 5; ctx.setLineDash([3, 5]);
  ctx.beginPath(); ctx.moveTo(546, 1180); ctx.lineTo(590, 1296); ctx.lineTo(634, 1180); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(590, 1296); ctx.lineTo(590, 2000); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = C.hoodieLine; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(584, 1300); ctx.lineTo(584, 2000); ctx.moveTo(596, 1300); ctx.lineTo(596, 2000); ctx.stroke();
  cel(ctx, rrectP(582, 1292, 16, 40, 6), { base: '#DDE3EE', line: '#5A6272', lw: 3 });

  // collar rib
  const collar = new Path2D();
  collar.moveTo(400, 1118);
  collar.bezierCurveTo(450, 1172, 520, 1186, 590, 1186);
  collar.bezierCurveTo(660, 1186, 730, 1172, 780, 1118);
  ctx.lineCap = 'round';
  ctx.strokeStyle = C.hoodieLine; ctx.lineWidth = 32; ctx.stroke(collar);
  ctx.strokeStyle = C.hoodieRib; ctx.lineWidth = 24; ctx.stroke(collar);
  ctx.strokeStyle = 'rgba(160,200,255,0.35)'; ctx.lineWidth = 4; ctx.setLineDash([2, 9]); ctx.stroke(collar); ctx.setLineDash([]);

  // drawstrings
  for (const [x0, x1] of [[566, 556], [614, 626]]) {
    const ex = x1 + spr.sx, ey = 1334 + spr.sy;
    ctx.strokeStyle = '#7C879A'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(x0, 1196); ctx.quadraticCurveTo((x0 + ex) / 2 + spr.sx * 0.3, 1270, ex, ey); ctx.stroke();
    ctx.strokeStyle = '#F3F5F9'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(x0, 1196); ctx.quadraticCurveTo((x0 + ex) / 2 + spr.sx * 0.3, 1270, ex, ey); ctx.stroke();
    cel(ctx, capsuleP(ex, ey, ex + spr.sx * 0.15, ey + 22, 6), { base: '#C9CFDA', line: '#5A6272', lw: 2.5 });
  }

  // headphone cups resting on the collar
  for (const s of [-1, 1]) {
    ctx.save(); ctx.translate(590 + s * 192, 1176); ctx.rotate(s * 0.42);
    ctx.strokeStyle = C.hpLine; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -6); ctx.stroke();
    ctx.strokeStyle = C.hpShade; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -6); ctx.stroke();
    const cup = rrectP(-50, -12, 100, 64, 28);
    cel(ctx, cup, { base: linGrad(ctx, 0, -12, 0, 52, [[0, '#FFFFFF'], [1, C.hp]]), shade: C.hpShade, off: [-s * 14, -12], blur: 3, line: C.hpLine, lw: 4.5 });
    cel(ctx, ellipseP(0, -8, 44, 13), { base: C.cushion, line: C.hpLine, lw: 3 });
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fill(ellipseP(-22, 14, 12, 5, -0.2));
    ctx.restore();
  }

  // name tag
  ctx.save(); ctx.translate(782, 1300); ctx.rotate(0.05);
  ctx.fillStyle = 'rgba(10,30,90,0.3)'; ctx.fill(rrectP(-74, -28, 152, 66, 14));
  const tag = rrectP(-78, -34, 152, 66, 14);
  cel(ctx, tag, { base: '#FFFFFF', shade: '#E2E8EE', off: [-6, -6], blur: 1, line: C.tealLine, lw: 4 });
  ctx.fillStyle = C.teal; ctx.fill(rrectP(-78, -34, 18, 66, [14, 0, 0, 14]));
  ctx.fillStyle = '#1D5C53'; ctx.font = '900 40px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(COPY.GPT_TAG, 8, 2);
  ctx.restore();
}

// hand geometry in phone-local coords (side -1 = viewer-left, +1 = right)
const HAND = { palm: [150, 70], wrist: [184, 128] };
function drawArms(ctx, P, M) {
  for (const s of [-1, 1]) {
    const sh = M.body.transformPoint(new DOMPoint(590 + s * 420, 1380));
    const el = M.body.transformPoint(new DOMPoint(590 + s * 530, 1990));
    const wr = M.phone.transformPoint(new DOMPoint(s * HAND.wrist[0], HAND.wrist[1]));
    const arm = tubeP([{ x: sh.x, y: sh.y }, { x: el.x, y: el.y }, { x: wr.x, y: wr.y }], [200, 214, 168], 22);
    cel(ctx, arm, { base: linGrad(ctx, 0, 1300, 0, 1950, [[0, C.hoodie], [1, '#2A62D2']]), shade: C.hoodieShade, off: [-s * 34 - 20, -34], blur: 8, line: C.hoodieLine, lw: 6 });
    // cuff
    const dir = { x: wr.x - el.x, y: wr.y - el.y }, d = Math.hypot(dir.x, dir.y);
    const c0 = { x: wr.x - dir.x / d * 70, y: wr.y - dir.y / d * 70 };
    const cuff = tubeP([c0, { x: wr.x, y: wr.y }], [160, 146], 6);
    cel(ctx, cuff, { base: C.hoodieRib, shade: C.hoodieShade, off: [-10, -12], blur: 3, line: C.hoodieLine, lw: 5 });
    ctx.save(); ctx.clip(cuff); ctx.strokeStyle = 'rgba(18,52,140,0.45)'; ctx.lineWidth = 3;
    for (let k = -3; k <= 3; k++) {
      const nx = -dir.y / d, ny = dir.x / d;
      ctx.beginPath(); ctx.moveTo(c0.x + nx * k * 20 - dir.x / d * 10, c0.y + ny * k * 20 - dir.y / d * 10); ctx.lineTo(wr.x + nx * k * 20 + dir.x / d * 30, wr.y + ny * k * 20 + dir.y / d * 30); ctx.stroke();
    }
    ctx.restore();
  }
}

function drawPalms(ctx) {
  for (const s of [-1, 1]) {
    const palm = ellipseP(s * HAND.palm[0], HAND.palm[1], 62, 78, -s * 0.3);
    cel(ctx, palm, { base: C.teal, shade: C.tealShade, off: [-s * 16 - 8, -18], blur: 5, line: C.tealLine, lw: 6 });
  }
}
function drawThumbs(ctx, P) {
  const ph = LAYOUT.PHONE;
  for (const s of [-1, 1]) {
    const dip = s < 0 ? P.thumbL : P.thumbR;
    const th = capsuleP(s * 132, 30, s * 70, -ph.h / 2 - 12 + dip, 24);
    cel(ctx, th, { base: C.teal, shade: C.tealShade, off: [-s * 8, -10], blur: 3, line: C.tealLine, lw: 6 });
    // screen light on the thumb tips
    ctx.save(); ctx.clip(th);
    radial(ctx, s * 70, -ph.h / 2 + 6, 60, [[0, `rgba(210,240,255,${P.dark ? 0.0 : 0.35})`], [1, 'rgba(210,240,255,0)']]);
    ctx.restore();
  }
}
function drawPhone(ctx, P) {
  const { w, h } = LAYOUT.PHONE;
  const body = rrectP(-w / 2, -h / 2, w, h, 34);
  cel(ctx, body, { base: linGrad(ctx, -w / 2, -h / 2, w / 2, h / 2, [[0, '#4A5160'], [0.5, C.phone], [1, C.phoneDark]]),
    shade: C.phoneDark, off: [-22, -18], blur: 6 });
  ctx.save(); ctx.clip(body);
  // glossy diagonal
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath(); ctx.moveTo(-w / 2, h * 0.05); ctx.lineTo(w / 2, -h * 0.35); ctx.lineTo(w / 2, -h * 0.18); ctx.lineTo(-w / 2, h * 0.22); ctx.fill();
  // glitter
  const r = mulberry32(99);
  for (let i = 0; i < 26; i++) {
    const gx = (r() - 0.5) * w * 0.9, gy = (r() - 0.5) * h * 0.9, tw = 0.5 + 0.5 * Math.sin(P.t * 3 + i * 1.7);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.4 * tw})`; ctx.beginPath(); ctx.arc(gx, gy, 1.6 + r() * 1.6, 0, TAU); ctx.fill();
  }
  // screen-light leaking over the top edge
  ctx.fillStyle = linGrad(ctx, 0, -h / 2, 0, -h / 2 + 16, [[0, `rgba(200,232,255,${P.dark ? 0.9 * P.glow : 0.55})`], [1, 'rgba(200,232,255,0)']]);
  ctx.fillRect(-w / 2, -h / 2, w, 16);
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = C.phoneLine; ctx.stroke(body);
  // camera module
  const cam = rrectP(-w / 2 + 16, -h / 2 + 16, 96, 96, 24);
  cel(ctx, cam, { base: '#2A2F39', shade: '#1D2129', off: [-6, -6], blur: 2, line: C.phoneLine, lw: 3.5 });
  for (const [cx, cy] of [[-w / 2 + 42, -h / 2 + 42], [-w / 2 + 42, -h / 2 + 86], [-w / 2 + 86, -h / 2 + 64]]) {
    cel(ctx, ellipseP(cx, cy, 17, 17), { base: '#0E1117', line: '#535B6A', lw: 4 });
    radial(ctx, cx, cy, 12, [[0, 'rgba(80,110,190,0.9)'], [1, 'rgba(30,40,80,0)']]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(cx - 5, cy - 5, 3.5, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#FFF2C4'; ctx.beginPath(); ctx.arc(-w / 2 + 86, -h / 2 + 34, 6, 0, TAU); ctx.fill();
  // little star sticker
  ctx.save(); ctx.translate(48, 66); ctx.rotate(0.2);
  star4(ctx, 0, 0, 26, '#FFE38A'); star4(ctx, 0, 0, 13, '#FFF6D2');
  ctx.restore();
}
function drawFingers(ctx) {
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = 26 + i * 40;
      const f = capsuleP(s * 150, y + 4, s * (86 + i * 4), y - 2, 20);
      cel(ctx, f, { base: C.teal, shade: C.tealShade, off: [0, -10], blur: 2, line: C.tealLine, lw: 5 });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────
//  LIGHTING
// ─────────────────────────────────────────────────────────────────────
let LIGHT = null;
function lightCanvas() {
  if (!LIGHT) { LIGHT = document.createElement('canvas'); LIGHT.width = W; LIGHT.height = H; }
  return LIGHT;
}
function applyDarkLighting(ctx, t, P, M, cam) {
  const lc = lightCanvas(), l = lc.getContext('2d');
  const f = 1 - 0.85 * P.charFade;
  // 1) drain most of the colour (night vision), keep a hint of hue
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // 2) light map: cold dim ambient + phone glow from below
  l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over';
  l.fillStyle = `rgb(${Math.round(36 * f)},${Math.round(44 * f)},${Math.round(74 * f)})`;
  l.fillRect(0, 0, W, H);
  l.globalCompositeOperation = 'lighter';
  camXform(l, cam, 1);
  const top = M.phone.transformPoint(new DOMPoint(0, -LAYOUT.PHONE.h / 2));
  const g = P.glow;
  radial(l, top.x, top.y - 230, 470, [[0, `rgba(165,195,250,${0.8 * g})`], [0.5, `rgba(100,130,200,${0.36 * g})`], [1, 'rgba(0,0,0,0)']], 1.1);
  radial(l, top.x, top.y - 20, 250, [[0, `rgba(210,232,255,${0.6 * g})`], [1, 'rgba(0,0,0,0)']], 0.7);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(lc, 0, 0);
  ctx.restore();
  // bloom spilling around the phone (not on its back)
  ctx.save(); camXform(ctx, cam, 1);
  const clip = new Path2D(); clip.rect(-500, -500, W + 1000, H + 1000);
  clip.addPath(rrectP(-LAYOUT.PHONE.w / 2, -LAYOUT.PHONE.h / 2, LAYOUT.PHONE.w, LAYOUT.PHONE.h, 34), M.phone);
  ctx.clip(clip, 'evenodd');
  ctx.globalCompositeOperation = 'lighter';
  radial(ctx, top.x, top.y - 6, 190, [[0, `rgba(120,165,255,${0.28 * g})`], [1, 'rgba(0,0,0,0)']], 0.55);
  ctx.restore();
}
function vignette(ctx, dark) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.32, W / 2, H * 0.5, H * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, dark ? 'rgba(0,0,8,0.6)' : 'rgba(60,35,10,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
}
let NOISE = null;
function grain(ctx, t, a) {
  if (!NOISE) {
    NOISE = document.createElement('canvas'); NOISE.width = NOISE.height = 256;
    const nx = NOISE.getContext('2d'), id = nx.createImageData(256, 256), r = mulberry32(3);
    for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    nx.putImageData(id, 0, 0);
  }
  const fi = Math.floor(t * TIMING.FPS / 2);   // grain refreshes at 15 fps (keeps the file small)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = a;
  ctx.translate(-Math.floor(hash(fi) * 256), -Math.floor(hash(fi + 0.5) * 256));
  ctx.fillStyle = ctx.createPattern(NOISE, 'repeat'); ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  UI · stories tray (generic, no app logos)
// ─────────────────────────────────────────────────────────────────────
function avatarArt(ctx, kind, r, t) {
  if (kind === 0) {           // GPT mini
    ctx.fillStyle = '#BFEFE3'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.fillStyle = C.teal; ctx.fill(ellipseP(0, 10, r * 0.78, r * 0.7));
    ctx.fillStyle = '#1B2240'; ctx.fill(ellipseP(-r * 0.25, r * 0.08, 6, 8)); ctx.fill(ellipseP(r * 0.25, r * 0.08, 6, 8));
    ctx.strokeStyle = '#1B4C45'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, r * 0.25, 8, 0.2, Math.PI - 0.2); ctx.stroke();
  } else if (kind === 1) {    // human, generic
    ctx.fillStyle = '#F6D2B0'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.fillStyle = '#C46A55'; ctx.fill(ellipseP(0, r * 0.95, r * 0.8, r * 0.55));
    ctx.fillStyle = C.skin; ctx.fill(ellipseP(0, -r * 0.08, r * 0.38, r * 0.42));
    ctx.fillStyle = '#4A2C22'; ctx.beginPath(); ctx.ellipse(0, -r * 0.28, r * 0.42, r * 0.3, 0, Math.PI, TAU); ctx.fill();
  } else if (kind === 2) {    // purple bot
    ctx.fillStyle = '#D9CCF5'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.fillStyle = '#8D6FD8'; ctx.fill(rrectP(-r * 0.6, -r * 0.45, r * 1.2, r * 1.0, 14));
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(-r * 0.32, -r * 0.12, 9, 9); ctx.fillRect(r * 0.32 - 9, -r * 0.12, 9, 9);
  } else {                    // pink smiley
    ctx.fillStyle = '#FFD6E2'; ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.fillStyle = '#FF8FB1'; ctx.fill(ellipseP(0, 0, r * 0.6, r * 0.6));
  }
}
function drawTray(ctx, t, alpha) {
  const { x, y, w, h } = LAYOUT.TRAY, T = TIMING;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 6;
  ctx.fillStyle = 'rgba(16,16,22,0.9)'; ctx.fill(rrectP(x, y, w, h, 26));
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip(rrectP(x, y, w, h, 26));
  for (let i = 0; i < 4; i++) {
    const cx = x + 86 + i * 150, cy = y + 88, r = 54;
    let s = 1;
    if (i === 1) s = track(t, [[T.TAP - 0.06, 1], [T.TAP + 0.05, 0.86], [T.TAP + 0.18, 1.06], [T.TAP + 0.3, 1]]);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    if (i === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r + 8, 0, TAU); ctx.stroke();
    } else {
      const g = ctx.createConicGradient(t * 0.4 + i, 0, 0);
      g.addColorStop(0, '#36D1B5'); g.addColorStop(0.35, '#6C8CFF'); g.addColorStop(0.7, '#C77DFF'); g.addColorStop(1, '#36D1B5');
      ctx.strokeStyle = g; ctx.lineWidth = 6;
      if (i === 1 && t > T.TAP + 0.08) {   // loading spinner after the tap
        ctx.setLineDash([18, 12]); ctx.lineDashOffset = -t * 120;
      }
      ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); avatarArt(ctx, i, r, t); ctx.restore();
    if (i === 0) {
      ctx.fillStyle = '#3B82F6'; ctx.strokeStyle = '#101016'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(r * 0.72, r * 0.72, 17, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(r * 0.72 - 8, r * 0.72); ctx.lineTo(r * 0.72 + 8, r * 0.72); ctx.moveTo(r * 0.72, r * 0.72 - 8); ctx.lineTo(r * 0.72, r * 0.72 + 8); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(236,236,242,0.92)'; ctx.font = '600 21px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(COPY.TRAY[i], cx, y + h - 22);
  }
  ctx.restore();
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  UI · story popup with Claude
// ─────────────────────────────────────────────────────────────────────
function claudeBodyP(w, h) {
  const p = new Path2D();
  p.moveTo(-w * 0.5, -h * 0.14);
  p.bezierCurveTo(-w * 0.56, -h * 0.78, -w * 0.3, -h, 0, -h);
  p.bezierCurveTo(w * 0.3, -h, w * 0.56, -h * 0.78, w * 0.5, -h * 0.14);
  p.bezierCurveTo(w * 0.48, h * 0.03, -w * 0.48, h * 0.03, -w * 0.5, -h * 0.14);
  p.closePath(); return p;
}
function drawClaude(ctx, lt, x, y) {
  const hop = Math.abs(Math.sin(TAU * 1.4 * lt));
  const land = 1 - hop;
  ctx.save(); ctx.translate(x, y);
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(ellipseP(0, 4, 70 - hop * 10, 10));
  ctx.translate(0, -hop * 8); ctx.scale(1 + 0.05 * land, 1 - 0.05 * land);
  ctx.rotate(Math.sin(TAU * 0.7 * lt) * 0.04);
  const w = 150, h = 168;
  // tuft
  ctx.lineCap = 'round'; ctx.strokeStyle = C.claudeLine; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(0, -h + 4); ctx.bezierCurveTo(4, -h - 22, 26, -h - 26, 22, -h - 10); ctx.stroke();
  ctx.strokeStyle = C.claudeTop; ctx.lineWidth = 6; ctx.stroke();
  const body = claudeBodyP(w, h);
  cel(ctx, body, { base: linGrad(ctx, 0, -h, 0, 0, [[0, C.claudeTop], [1, C.claude]]), shade: C.claudeShade, off: [-20, -16], blur: 4, line: C.claudeLine, lw: 4 });
  ctx.save(); ctx.clip(body); radial(ctx, -30, -h * 0.8, 60, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); ctx.restore();
  // blush (pulsing) + hatch lines
  const bl = clamp(0.55 + 0.3 * Math.sin(lt * 7) + 0.2 * Ease.outBack(clamp(lt / 0.4)));
  for (const s of [-1, 1]) {
    radial(ctx, s * 44, -h * 0.47, 28, [[0, `rgba(255,95,120,${bl})`], [1, 'rgba(255,95,120,0)']], 0.62);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(s * 34 + k * 7, -h * 0.43); ctx.lineTo(s * 40 + k * 7, -h * 0.51); ctx.stroke(); }
  }
  // happy closed eyes ^ ^
  ctx.strokeStyle = '#3A160D'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 30, -h * 0.58, 13, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
  // shy smile
  ctx.beginPath(); ctx.moveTo(-12, -h * 0.44); ctx.quadraticCurveTo(0, -h * 0.36 + Math.sin(lt * 9) * 1.5, 12, -h * 0.44); ctx.stroke();
  // little arms on cheeks
  for (const s of [-1, 1]) {
    cel(ctx, ellipseP(s * 66, -h * 0.42, 15, 22, s * 0.5), { base: C.claude, shade: C.claudeShade, off: [-4, -4], blur: 1, line: C.claudeLine, lw: 3.5 });
  }
  // name tag
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = C.claudeLine; ctx.lineWidth = 3;
  const tg = rrectP(-42, -h * 0.25, 84, 28, 9); ctx.fill(tg); ctx.stroke(tg);
  ctx.fillStyle = '#9A4325'; ctx.font = '900 18px Nunito'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(COPY.CLAUDE_TAG, 0, -h * 0.25 + 15);
  ctx.restore();
}
function ringIcon(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.strokeStyle = '#F4C64F'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(0, 4, 9, 9, 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = '#E9F8FF'; ctx.strokeStyle = '#7DB5D6'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(7, -7); ctx.lineTo(10, -3); ctx.lineTo(0, 5); ctx.lineTo(-10, -3); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawRingHand(ctx, lt) {
  const off = Math.sin(lt * 3.2) * 3;
  ctx.save(); ctx.translate(off, -off * 0.5);
  const sleeve = tubeP([{ x: -40, y: 690 }, { x: 30, y: 580 }, { x: 88, y: 504 }], [92, 84, 70], 10);
  cel(ctx, sleeve, { base: '#56709F', shade: '#3E5584', off: [-12, -10], blur: 3, line: '#22324F', lw: 3.5 });
  // palm under the box
  cel(ctx, ellipseP(112, 478, 42, 30, -0.45), { base: C.skin, shade: C.skinShade, off: [-6, -8], blur: 2, line: C.skinLine, lw: 3 });
  // ring box
  ctx.save(); ctx.translate(140, 438); ctx.rotate(-0.18);
  const lid = rrectP(-40, -58, 80, 46, 10);
  cel(ctx, lid, { base: '#B71731', shade: '#8D0F25', off: [-6, -6], blur: 1, line: '#560916', lw: 3 });
  ctx.fillStyle = '#2A0D14'; ctx.fill(rrectP(-31, -51, 62, 32, 7));
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill(rrectP(-27, -48, 30, 8, 4));
  const base = rrectP(-40, -14, 80, 44, 10);
  cel(ctx, base, { base: linGrad(ctx, 0, -14, 0, 30, [[0, '#E3304B'], [1, '#A5122A']]), shade: '#8D0F25', off: [-8, -6], blur: 1, line: '#560916', lw: 3 });
  ctx.fillStyle = '#1E0A10'; ctx.fill(ellipseP(0, -10, 32, 8));
  ctx.strokeStyle = '#F2C14E'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(0, -18, 13, 10, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = '#FFE9A3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -18, 13, 10, 0, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  ctx.fillStyle = '#E9F8FF'; ctx.strokeStyle = '#7DB5D6'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-8, -36); ctx.lineTo(8, -36); ctx.lineTo(11, -31); ctx.lineTo(0, -22); ctx.lineTo(-11, -31); ctx.closePath(); ctx.fill(); ctx.stroke();
  star4(ctx, 12, -44, 9 * (0.5 + 0.5 * Math.sin(lt * 8)), '#FFFFFF');
  ctx.restore();
  // fingers wrapping the front of the box + thumb
  for (let i = 0; i < 3; i++) {
    cel(ctx, capsuleP(118 + i * 17, 492, 124 + i * 17, 462 - i * 3, 9.5), { base: C.skin, shade: C.skinShade, off: [-3, -4], blur: 1, line: C.skinLine, lw: 2.5 });
  }
  cel(ctx, capsuleP(96, 482, 100, 452, 10), { base: C.skin, shade: C.skinShade, off: [-3, -4], blur: 1, line: C.skinLine, lw: 2.5 });
  ctx.restore();
}
function drawStoryCard(ctx, t) {
  const T = TIMING, { x, y, w, h } = LAYOUT.POPUP;
  const lt = t - T.POPUP_IN;
  const p = prog(t, T.POPUP_IN, T.POPUP_IN + T.POPUP_SLIDE);
  const sx = lerp(-(x + w + 40), 0, Ease.outBack(p, 1.5));
  const sc = lerp(0.9, 1, Ease.outBack(p, 1.2));
  const rot = lerp(-0.07, 0, Ease.outBack(p, 1.8));
  ctx.save();
  ctx.translate(x + sx + w / 2, y + h / 2); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
  const card = rrectP(0, 0, w, h, 24);
  ctx.fillStyle = '#2E2829'; ctx.fill(card);
  ctx.shadowColor = 'transparent';
  ctx.save(); ctx.clip(card);
  // "photo" background: cozy blurred room
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [[0, '#8E7B70'], [0.55, '#6A5A54'], [1, '#3E3436']]); ctx.fillRect(0, 0, w, h);
  radial(ctx, w * 0.85, h * 0.12, 260, [[0, 'rgba(255,226,170,0.45)'], [1, 'rgba(255,226,170,0)']]);
  const br = mulberry32(21);
  for (let i = 0; i < 9; i++) {
    const bx = br() * w, by = br() * h * 0.6 + Math.sin(lt * 1.5 + i) * 4, rr = 10 + br() * 22;
    ctx.fillStyle = `rgba(255,230,180,${0.08 + br() * 0.12})`; ctx.beginPath(); ctx.arc(bx, by, rr, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = 'rgba(40,30,30,0.35)'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
  // Claude + sparkles
  drawClaude(ctx, lt, 246, 528);
  const sr = mulberry32(8);
  for (let i = 0; i < 12; i++) {
    const px = 170 + sr() * 160, py0 = 310 + sr() * 230, ph = sr();
    const py = py0 - ((lt * 40 + ph * 80) % 80);
    const tw = Math.max(0, Math.sin(TAU * (lt * 1.6 + ph)));
    star4(ctx, px, py, (6 + sr() * 9) * tw, i % 3 ? '#FFFFFF' : '#FFE9A6', 0.95);
  }
  for (let i = 0; i < 3; i++) {
    const hy = 330 - ((lt * 60 + i * 40) % 110), hx = 270 + i * 22 + Math.sin(lt * 5 + i) * 6;
    ctx.globalAlpha = clamp(1 - (330 - hy) / 110) * 0.9; heart(ctx, hx, hy, 0.9 + 0.2 * i, '#FF7A9A'); ctx.globalAlpha = 1;
  }
  drawRingHand(ctx, lt);
  // caption sticker
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '600 44px "Dancing Script"';
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#FFFFFF';
  const cw = ctx.measureText(COPY.STORY_CAPTION).width;
  ctx.fillText(COPY.STORY_CAPTION, w / 2 - 14, 186);
  ctx.shadowColor = 'transparent';
  ringIcon(ctx, w / 2 - 14 + cw / 2 + 20, 172, 1.25);
  ctx.font = '800 18px Nunito';
  const sw = ctx.measureText(COPY.STORY_SUB).width + 26;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(rrectP(w / 2 - sw / 2, 204, sw, 30, 15));
  ctx.fillStyle = '#FFFFFF'; ctx.fillText(COPY.STORY_SUB, w / 2, 225);
  // story chrome
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill(rrectP(12, 12, 152, 4, 2)); ctx.fill(rrectP(176, 12, 152, 4, 2));
  ctx.fillStyle = '#FFFFFF'; ctx.fill(rrectP(12, 12, 152, 4, 2));
  ctx.fill(rrectP(176, 12, 152 * clamp(lt / 3.5), 4, 2));
  ctx.save(); ctx.beginPath(); ctx.arc(30, 44, 16, 0, TAU); ctx.clip(); ctx.translate(30, 44); avatarArt(ctx, 1, 16, t); ctx.restore();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(30, 44, 16, 0, TAU); ctx.stroke();
  ctx.textAlign = 'left'; ctx.font = '800 17px Nunito'; ctx.fillStyle = '#FFFFFF';
  ctx.fillText(COPY.STORY_USER, 54, 50);
  const uw = ctx.measureText(COPY.STORY_USER).width;
  ctx.font = '600 16px Nunito'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(COPY.STORY_AGE, 62 + uw, 50);
  ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(276 + i * 7, 44, 2.4, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(310, 36); ctx.lineTo(326, 52); ctx.moveTo(326, 36); ctx.lineTo(310, 52); ctx.stroke();
  // reply bar
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 2; ctx.stroke(rrectP(14, h - 50, 250, 36, 18));
  ctx.font = '600 15px Nunito'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillText(COPY.STORY_REPLY, 32, h - 27);
  ctx.save(); ctx.translate(292, h - 32); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.bezierCurveTo(-13, -1, -8, -13, 0, -6); ctx.bezierCurveTo(8, -13, 13, -1, 0, 8); ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(322, h - 32); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-9, -1); ctx.lineTo(10, -9); ctx.lineTo(3, 10); ctx.lineTo(0, 1); ctx.closePath(); ctx.stroke(); ctx.restore();
  ctx.restore();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke(card);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  UI · typed text + handle
// ─────────────────────────────────────────────────────────────────────
function drawTypedText(ctx, t) {
  const T = TIMING, L = LAYOUT;
  const fadeA = lerp(1, T.TEXT_FADE_TO, Ease.sine(prog(t, ...T.TEXT_FADE)));
  ctx.save();
  ctx.font = `400 ${L.TEXT_SIZE}px "Josefin Sans"`;
  ctx.letterSpacing = `${L.TEXT_TRACK}px`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const words = COPY.LINE;
  const fullW = ctx.measureText(words.join(' ')).width - L.TEXT_TRACK;
  const x0 = W / 2 - fullW / 2;
  const fi = Math.floor(t * T.FPS);
  [T.LINE1_WORDS, T.LINE2_WORDS].forEach((times, li) => {
    words.forEach((word, wi) => {
      const tw = times[wi];
      if (t < tw) return;
      const age = t - tw, popping = age < T.WORD_POP_LEN;
      const amp = popping ? 7 * (1 - age / T.WORD_POP_LEN) + 1 : 0.9;
      const seed = fi * 0.37 + li * 13.1 + wi * 7.7;
      const jx = (hash(seed) - 0.5) * amp, jy = (hash(seed + 3.3) - 0.5) * amp;
      const a = (popping ? 0.55 + 0.45 * hash(seed + 9.1) : 1) * fadeA;
      let wx = x0 + (wi ? ctx.measureText(words.slice(0, wi).join(' ') + ' ').width : 0);
      ctx.globalAlpha = a;
      ctx.shadowColor = 'rgba(255,255,255,0.35)'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#FFFFFF';
      for (let ci = 0; ci < word.length; ci++) {
        const chY = (hash(li * 100 + wi * 10 + ci) - 0.5) * 3.2;   // typewriter misalignment
        const cx = wx + ctx.measureText(word.slice(0, ci)).width;
        ctx.fillText(word[ci], cx + jx, L.TEXT_Y[li] + chY + jy);
      }
    });
  });
  ctx.restore();
}
function drawHandle(ctx, t, dark) {
  const T = TIMING, L = LAYOUT;
  const p = pose(t, T.HANDLE_MOVE_IN, T.HANDLE_MOVE_LEN, 0, 1, 0.1, 0.07);
  ctx.save();
  ctx.font = `800 ${L.HANDLE.size}px Nunito`; ctx.letterSpacing = '1px';
  const w0 = ctx.measureText(COPY.HANDLE).width;
  const cx = lerp(L.HANDLE.right - w0 / 2, L.HANDLE_END.x, p);
  const cy = lerp(L.HANDLE.y, L.HANDLE_END.y, p);
  const size = lerp(L.HANDLE.size, L.HANDLE_END.size, p);
  const moving = t >= T.HANDLE_MOVE_IN;
  const pulse = moving ? Ease.sine(prog(t, T.HANDLE_MOVE_IN + T.HANDLE_MOVE_LEN * 0.5, T.HANDLE_MOVE_IN + T.HANDLE_MOVE_LEN)) *
    (0.5 - 0.5 * Math.cos(TAU * (t - T.HANDLE_MOVE_IN) / T.HANDLE_PULSE_PERIOD)) : 0;
  if (moving) radial(ctx, cx, cy - size * 0.3, 300, [[0, `rgba(190,215,255,${0.05 + 0.12 * pulse})`], [1, 'rgba(190,215,255,0)']], 0.45);
  ctx.font = `800 ${size}px Nunito`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (dark) { ctx.shadowColor = `rgba(220,235,255,${0.5 + 0.5 * pulse})`; ctx.shadowBlur = 8 + 26 * pulse; }
  else {
    ctx.lineJoin = 'round'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(70,45,20,0.35)';
    ctx.strokeText(COPY.HANDLE, cx, cy);
    ctx.shadowColor = 'rgba(50,30,10,0.7)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = dark ? `rgba(255,255,255,${0.88 + 0.12 * pulse})` : '#FFFFFF';
  ctx.fillText(COPY.HANDLE, cx, cy);
  ctx.restore();
}

// ─────────────────────────────────────────────────────────────────────
//  RENDER  (pure function of t)
// ─────────────────────────────────────────────────────────────────────
function render(ctx, t) {
  const T = TIMING;
  t = clamp(t, 0, T.DURATION);
  const P = getPose(t), spr = springs(t), cam = camera(t), M = gptMatrices(P);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  drawRoom(ctx, t, cam);
  const bgF = Ease.sine(prog(t, ...T.BG_FADE));
  if (bgF > 0) { ctx.fillStyle = `rgba(0,0,0,${0.985 * bgF})`; ctx.fillRect(0, 0, W, H); }

  ctx.save(); camXform(ctx, cam, 1); drawGPT(ctx, P, M, spr); ctx.restore();

  if (P.dark) applyDarkLighting(ctx, t, P, M, cam);
  vignette(ctx, P.dark);
  if (P.dark) grain(ctx, t, 0.022);           // anti-banding dither for the dark gradients

  // UI overlays
  if (t < T.TRAY_OUT[1]) drawTray(ctx, t, 1 - Ease.sine(prog(t, ...T.TRAY_OUT)));
  if (t >= T.POPUP_IN && t < T.LIGHTS_OUT) drawStoryCard(ctx, t);
  if (P.dark) drawTypedText(ctx, t);
  drawHandle(ctx, t, P.dark);

  const blk = Ease.sine(prog(t, ...T.TO_BLACK));
  if (blk > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${blk})`; ctx.fillRect(0, 0, W, H); }
}

// ─────────────────────────────────────────────────────────────────────
//  COVER IMAGE (thumbnail)  ·  `node render.js --cover` → cover.png
//  A still that sums up the joke: teary GPT in the dark + the story card.
//  Key content stays inside the centre 3:4 crop used by profile grids.
// ─────────────────────────────────────────────────────────────────────
const COVER = {
  POSE_T: 9.3,            // which moment's pose to borrow (dark, teary)
  GLOSS: 1.3,             // extra-teary eyes
  ZOOM: 1.08,
  TITLE: 'WHAT ABOUT ME?', TITLE_Y: 372, TITLE_SIZE: 80, TITLE_TRACK: 12,
  CARD: { x: 44, y: 470, scale: 0.98, rot: -0.08 },
};
function renderCover(ctx) {
  const T = TIMING, t = COVER.POSE_T;
  const P = getPose(t);
  Object.assign(P, { gloss: COVER.GLOSS, blink: 0, glow: 1, charFade: 0 });
  const spr = { ax: 0, ay: 0, sx: 0, sy: 0 };
  const cam = { x: 0, y: 0, zoom: COVER.ZOOM };
  const M = gptMatrices(P);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.shadowColor = 'transparent'; ctx.letterSpacing = '0px';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  drawRoom(ctx, t, cam);
  ctx.save(); camXform(ctx, cam, 1); drawGPT(ctx, P, M, spr); ctx.restore();
  applyDarkLighting(ctx, t, P, M, cam);
  vignette(ctx, true);
  grain(ctx, t, 0.022);

  // story card, settled, tilted, with a warm glow so it pops off the dark
  const L = LAYOUT.POPUP, c = COVER.CARD;
  ctx.save();
  ctx.translate(c.x + L.w / 2, c.y + L.h / 2); ctx.rotate(c.rot); ctx.scale(c.scale, c.scale);
  ctx.translate(-(L.x + L.w / 2), -(L.y + L.h / 2));
  ctx.shadowColor = 'rgba(255,150,170,0.55)'; ctx.shadowBlur = 70;
  ctx.fillStyle = '#2E2829'; ctx.fill(rrectP(L.x, L.y, L.w, L.h, 24));
  ctx.shadowColor = 'transparent';
  drawStoryCard(ctx, T.POPUP_IN + 0.9);
  ctx.restore();

  // title
  ctx.save();
  let size = COVER.TITLE_SIZE;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const setFont = () => { ctx.font = `400 ${size}px "Josefin Sans"`; ctx.letterSpacing = `${COVER.TITLE_TRACK}px`; };
  setFont();
  while (ctx.measureText(COVER.TITLE).width - COVER.TITLE_TRACK > W - 120) { size -= 2; setFont(); }
  const tw = ctx.measureText(COVER.TITLE).width - COVER.TITLE_TRACK;
  radial(ctx, W / 2, COVER.TITLE_Y - size * 0.35, 520, [[0, 'rgba(0,0,10,0.55)'], [1, 'rgba(0,0,10,0)']], 0.3);
  ctx.shadowColor = 'rgba(200,222,255,0.55)'; ctx.shadowBlur = 22;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(COVER.TITLE, W / 2 - tw / 2, COVER.TITLE_Y);
  ctx.restore();
}

const FONT_SPECS = ['600 20px Nunito', '800 20px Nunito', '900 20px Nunito', '400 20px "Josefin Sans"', '600 20px "Dancing Script"'];
function ready() { return Promise.all(FONT_SPECS.map(f => document.fonts.load(f))).then(() => document.fonts.ready); }

global.MEME = { W, H, TIMING, COPY, LAYOUT, COVER, render, renderCover, ready, getPose };
})(window);
