// TOKEN HUNGRY: the 25-second story. renderFrame(t) is a pure function of
// time; getEvents() lists every sound cue with its time and screen position.
import { TAU, clamp, lerp, inv, E, tw, kf, wob, spr, bump, hash, vnoise, hopArc, smoothstep } from './util.js';
import { C, softEllipse, brush, setShadow } from './style.js';
import { ballState, drawBall, mouthPoint, headTop, eyePoint } from './ball.js';
import {
  drawToken,
  tokenLook,
  drawStrip,
  drawStripPiece,
  drawMeter,
  drawSpark,
  drawPage,
  drawActionMarks,
  drawTwinkle,
} from './props.js';
import { F, drawCaption, textWidth } from './type.js';
import { initBackdrop, drawPaper, drawFinish } from './backdrop.js';

export const DURATION = 25;
const G = 650; // ground / trail baseline (world y)
const R = 105; // ball radius
const BY = G - R; // resting centre
const TOK = 50; // trail token size
const HERO = 74; // first token size
const T_FREEZE = 13.4;

// ---------------------------------------------------------------------------
// Trail geometry (world space, arc-length parameterised)
let TR = null;
function trailY(x) {
  const A = 62 * smoothstep(inv(1000, 1260, x)) * (1 - smoothstep(inv(1700, 1980, x)));
  return G - A * Math.sin(((x - 1000) / 760) * TAU);
}
function buildTrail() {
  const xs = [];
  const ys = [];
  const ss = [];
  let s = 0;
  let px = 560;
  let py = trailY(560);
  for (let x = 560; x <= 6000; x += 2) {
    const y = trailY(x);
    if (x > 560) s += Math.hypot(x - px, y - py);
    xs.push(x);
    ys.push(y);
    ss.push(s);
    px = x;
    py = y;
  }
  return { xs, ys, ss };
}
function trailAt(s) {
  const { xs, ys, ss } = TR;
  let lo = 0;
  let hi = ss.length - 1;
  s = clamp(s, 0, ss[hi]);
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ss[mid] <= s) lo = mid;
    else hi = mid;
  }
  const u = (s - ss[lo]) / (ss[hi] - ss[lo] || 1);
  return {
    x: lerp(xs[lo], xs[hi], u),
    y: lerp(ys[lo], ys[hi], u),
    ang: Math.atan2(ys[hi] - ys[lo], xs[hi] - xs[lo]),
  };
}
function sAtX(x) {
  const { xs, ss } = TR;
  const i = clamp(Math.round((x - 560) / 2), 0, xs.length - 1);
  return ss[i];
}
function restOn(s, size) {
  const p = trailAt(s);
  const off = size / 2 + size * 0.09;
  return { x: p.x + Math.sin(p.ang) * off, y: p.y - Math.cos(p.ang) * off, rot: p.ang * 0.6, gy: p.y };
}

// ---------------------------------------------------------------------------
// Schedule
const DM = 92; // ball-centre to token distance at the moment of a bite
let S0 = 0; // start of the trail (arc length)
let SB0 = 0; // ball arc position in scene 2
let SSTOP = 0; // ball arc position in scene 4/5
const TOKS = []; // token records
const EAT = []; // [{t, id, phase}]
let STRIPS = [];
let SPIRAL = [];
let FINAL = null;
let EVENTS = [];
let END = null; // end card layout

function eatTime(k) {
  if (k <= 3) return 7.0 + 0.5 * k;
  if (k <= 11) return 8.75 + 0.25 * (k - 4);
  return 10.625 + 0.125 * (k - 12);
}
function phaseOf(k) {
  return k <= 3 ? 'A' : k <= 11 ? 'B' : 'C';
}

function buildSchedule(ctx) {
  TR = buildTrail();
  S0 = sAtX(760);
  SB0 = sAtX(640);
  const SP = 128; // trail spacing (half of it once the strips fill the gaps)
  const sOf = (k) => {
    if (k <= 3) return S0 + SP * k;
    if (k <= 11) return S0 + 3 * SP + (SP / 2) * (k - 3);
    return S0 + 7 * SP + (SP / 2) * (k - 11);
  };
  // hero token
  TOKS[0] = { id: 0, look: { kind: 'terra', mark: 'lines', markInk: false, seed: 1 }, size: HERO };
  for (let k = 1; k <= 21; k++) {
    const trail = k <= 3 || (k <= 11 ? (k - 3) % 2 === 0 : (k - 11) % 2 === 0);
    TOKS[k] = {
      id: k,
      look: tokenLook(k + 5),
      size: TOK,
      s: sOf(k),
      src: trail ? 'trail' : 'strip',
      tEat: eatTime(k),
      phase: phaseOf(k),
    };
    EAT.push({ t: eatTime(k), id: k, phase: phaseOf(k) });
  }
  SSTOP = sOf(21) - DM + 46;
  // spiral tokens + the one that gets away
  const slots = [];
  for (let i = 0; i < 8; i++) slots.push(SSTOP + 215 + 56 * i);
  SPIRAL = [];
  for (let j = 0; j < 8; j++) {
    const id = 22 + j;
    TOKS[id] = { id, look: tokenLook(id + 5), size: TOK, s: slots[j], src: 'strip', spiral: j };
    SPIRAL.push(id);
  }
  FINAL = TOKS[29];
  FINAL.look = { kind: 'cream', mark: 'arc', markInk: false, seed: 41 };
  // trail pop-in times (drawn by the travelling pen in scene 2)
  for (let k = 1; k <= 21; k++) {
    const tk = TOKS[k];
    if (tk.src === 'trail') tk.tPop = 5.06 + (tk.s - S0) / 1250 + 0.03;
  }
  // strips
  const defs = [
    { text: 'Explain this.', w: 400, tA: 6.95, tU: 7.02, tU1: 7.38, tB: 8.0, ids: [4, 6, 8, 10] },
    { text: 'Make it better.', w: 452, tA: 8.6, tU: 8.68, tU1: 9.05, tB: 9.84, ids: [12, 14, 16, 18, 20] },
    { text: 'Try again.', w: 360, tA: 10.05, tU: 10.12, tU1: 10.48, tB: 11.05, ids: [22, 23, 24, 25, 26, 27, 28, 29] },
  ];
  STRIPS = defs.map((d, i) => {
    const xs = d.ids.map((id) => restOn(TOKS[id].s, TOK).x);
    let cx = xs.reduce((a, b) => a + b, 0) / xs.length;
    // keep it in view: no further right than ~1450 px on screen at appearance
    const camA = camAt(d.tA);
    cx = Math.min(cx - 40, camA.x + 470);
    return Object.assign(d, { i, x: cx, y: 238, h: 84, fontSize: 40 });
  });
  // strip pieces -> token flights
  for (const st of STRIPS) {
    const n = st.ids.length;
    st.ids.forEach((id, j) => {
      const tk = TOKS[id];
      tk.strip = st.i;
      tk.piece = j;
      tk.pieces = n;
      const rest = restOn(tk.s, TOK);
      const pw = st.w / n;
      const lx = -st.w / 2 + (j + 0.5) * pw;
      const spread = (j - (n - 1) / 2) * 16;
      // burst end position (world)
      tk.bx = st.x + lx + spread;
      tk.by = st.y - 26;
      tk.bt = st.tB + 0.3;
      const dist = Math.hypot(rest.x - tk.bx, rest.y - tk.by);
      tk.flight = st.i < 2 ? 0.28 + hash(id, 3) * 0.04 : 0.4 + Math.min(0.12, dist / 4000) + hash(id, 3) * 0.06;
      tk.tLand = tk.bt + tk.flight;
      tk.rest = rest;
      tk.spin = (hash(id, 8) - 0.5) * 7;
      tk.flips = hash(id, 9) < 0.5 ? 2 : 0;
    });
  }
  // spiral arrivals
  const arr = [12.42, 12.56, 12.69, 12.8, 12.9, 12.99, 13.07];
  SPIRAL.slice(0, 7).forEach((id, j) => {
    TOKS[id].tLift = 12.1 + j * 0.035;
    TOKS[id].tArr = arr[j];
  });
  // the straggler: lifts late, bonks the closed mouth, drops in front
  FINAL.tLift = 12.5;
  FINAL.tArr = 13.44;
  // end card layout
  END = layoutEnd(ctx);
  EVENTS = buildEvents();
}

// ---------------------------------------------------------------------------
// Ball position along the trail during scene 3/4
function hopSegments() {
  // [t0, t1, s0, s1, height]
  const seg = [];
  let prevT = 7.0;
  let prevS = SB0;
  for (let k = 1; k <= 21; k++) {
    const t1 = eatTime(k);
    const s1 = TOKS[k].s - DM;
    const H = k <= 3 ? 82 : k <= 11 ? 34 : 13;
    seg.push([prevT, t1, prevS, s1, H, k]);
    prevT = t1;
    prevS = s1;
  }
  seg.push([prevT, 12.05, prevS, SSTOP, 0, 0]);
  return seg;
}
let HOPS = null;
function ballTrack(t) {
  // returns {s, lift, u, seg}
  if (!HOPS) HOPS = hopSegments();
  if (t <= 7.0) return { s: SB0, lift: 0, u: 0, seg: null };
  for (const sg of HOPS) {
    const [t0, t1, s0, s1, H, k] = sg;
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      if (k === 0) {
        // skid to a stop
        return { s: lerp(s0, s1, E.outCubic(u)), lift: 0, u, seg: sg };
      }
      const phaseC = k >= 12;
      const su = phaseC ? u : lerp(u, E.inOutSine(u), 0.35);
      let lift = H * hopArc(u);
      if (phaseC) lift = 13 * Math.abs(Math.sin(Math.PI * ((t - 10.5) / 0.25)));
      return { s: lerp(s0, s1, su), lift, u, seg: sg };
    }
  }
  return { s: SSTOP, lift: 0, u: 1, seg: null };
}
function ballXAt(t) {
  if (t < 7.0) return t < 3.0 ? 560 : 640;
  return trailAt(ballTrack(t).s).x;
}

// ---------------------------------------------------------------------------
// Camera
let CAM_CACHE = null;
function camAt(t) {
  const base = { x: 960, y: 540, zoom: 1 };
  if (t < 6.8) {
    base.zoom = 1 + 0.018 * E.inOutSine(clamp(t / 6.8));
    base.y = 540 + 6 * E.inOutSine(clamp(t / 6.8));
    return base;
  }
  // critically damped follow, integrated from 6.8 (deterministic)
  const tt = Math.min(t, 16.0);
  let x = 960;
  let v = 0;
  const w = 4.6;
  const dt = 1 / 240;
  for (let s = 6.8; s < tt; s += dt) {
    const target = s < 12.0 ? ballXAt(s) + 300 : trailAt(SSTOP).x + 320;
    const a = w * w * (target - x) - 2 * w * v;
    v += a * dt;
    x += v * dt;
  }
  let cam = { x, y: 540 + 6, zoom: 1.018 - 0.018 * E.inOutSine(clamp((t - 6.8) / 0.8)) };
  // realisation push-in toward the face
  const zk = E.inOutSine(clamp((t - T_FREEZE) / 2.4));
  if (zk > 0 && t < 16.8) {
    const z = 1 + 0.2 * zk;
    const fx = trailAt(SSTOP).x;
    const fy = BY - 18;
    const sx = (fx - cam.x) * cam.zoom;
    const sy = (fy - cam.y) * cam.zoom;
    cam = { x: fx - sx / z, y: fy - sy / z, zoom: z };
  }
  if (t >= 15.9) {
    const k = E.inOutCubic(clamp((t - 15.9) / 0.9));
    const c5 = { x: trailAt(SSTOP).x + 10, y: 445, zoom: 1 };
    cam = { x: lerp(cam.x, c5.x, k), y: lerp(cam.y, c5.y, k), zoom: lerp(cam.zoom, c5.zoom, k) };
    // gentle push-in while it considers the last token
    const zb = bump(t, 16.85, 19.3, 0.8, 0.5, E.inOutSine);
    if (zb > 0) {
      const z = 1 + 0.13 * zb;
      const fx = trailAt(SSTOP).x + 40;
      const fy = BY + 10;
      cam = { x: fx - (fx - cam.x) / z, y: fy - (fy - cam.y) / z, zoom: cam.zoom * z };
    }
  }
  return cam;
}

function camMatrix(cam) {
  return [cam.zoom, 0, 0, cam.zoom, 960 - cam.x * cam.zoom, 540 - cam.y * cam.zoom];
}
function toScreen(cam, x, y) {
  return [(x - cam.x) * cam.zoom + 960, (y - cam.y) * cam.zoom + 540];
}

// ---------------------------------------------------------------------------
// Helpers for expressions
function blinkAt(t, times, dur = 0.17) {
  let o = 1;
  for (const b of times) {
    const d = t - b;
    if (d >= 0 && d <= dur) {
      const a = dur * 0.38;
      const h = dur * 0.18;
      const k = d < a ? d / a : d < a + h ? 1 : 1 - (d - a - h) / (dur - a - h);
      o = Math.min(o, 1 - E.inOutSine(clamp(k)));
    }
  }
  return o;
}
function landSquash(t, L, A = 0.18, f = 3.1, k = 8.5) {
  const d = t - L;
  if (d < 0) return 0;
  return A * Math.exp(-k * d) * Math.cos(TAU * f * d);
}

// ---------------------------------------------------------------------------
// The ball, scenes 1-5 (world space)
function ballAt(t) {
  const b = ballState({ R, boil: Math.floor(t * 12) });
  b.boilAmp = t > T_FREEZE && t < 15.45 ? 0.35 : 1;
  let x = 560;
  let y = BY;
  let lift = 0;
  let sq = 0; // + = squash (wider, shorter)

  if (t < 3.0) {
    // ---- Scene 1: peek, hop in, spot the token
    if (t < 1.95) {
      x = kf(t, [
        [0, -160],
        [1.1, -160],
        [1.46, -26, E.outCubic],
      ]);
      b.rot = kf(t, [
        [1.1, 0.24],
        [1.46, 0.2],
        [1.78, 0.17],
        [1.95, -0.07, E.inOutSine],
      ]);
      sq += 0.12 * bump(t, 1.78, 2.0, 0.14, 0.05);
    } else if (t < 2.38) {
      const u = (t - 1.95) / 0.43;
      x = lerp(-26, 560, lerp(u, E.inOutSine(u), 0.4));
      lift = 118 * hopArc(u);
      b.rot = lerp(-0.07, 0.1, u) * (1 - u * u);
      b.vAxis = Math.atan2(-(1 - 2 * u) * 118 * 4, 586) ;
      b.vK = 1 + 0.13 * (1 - Math.sin(Math.PI * u)) * clamp(u * 12) * clamp((1 - u) * 12);
    } else {
      x = 560;
      sq += landSquash(t, 2.38, 0.2);
      sq -= 0.07 * bump(t, 2.47, 2.75, 0.06, 0.2); // little pop of surprise
    }
    b.yaw = 0.62;
    b.pitch = kf(t, [
      [1.2, -0.1],
      [2.4, -0.16],
      [2.6, -0.2],
    ]);
    b.wide = kf(t, [
      [1.2, 0.18],
      [2.4, 0.05],
      [2.5, 0.6, E.outBack],
      [2.75, 0.22],
    ]);
    b.eyeOpen = blinkAt(t, [1.55, 1.72]);
    b.mouthOpen = kf(t, [
      [1.3, 0.12],
      [1.9, 0.0],
      [2.46, 0.0],
      [2.52, 0.26, E.outCubic],
      [2.66, 0.0],
    ]);
    b.mouthW = kf(t, [
      [1.3, 0.06],
      [1.9, 0.11],
      [2.5, 0.07],
      [2.66, 0.12],
      [2.92, 0.19],
    ]);
    b.smile = kf(t, [
      [1.3, 0.2],
      [2.0, 0.45],
      [2.62, 0.2],
      [2.92, 0.92],
    ]);
    b.smirk = tw(t, 2.66, 2.95, 0, 0.6);
    b.lid = tw(t, 2.68, 2.95, 0, 0.42);
    b.lidTilt = -0.06;
    b.blush = tw(t, 2.6, 2.95, 0.6, 0.8);
  } else if (t < 7.0) {
    // ---- Scene 2: stretch, hesitate, bite; the trail appears
    x = kf(t, [
      [3.0, 560],
      [3.28, 546, E.inOutSine],
      [3.62, 660, E.outCubic],
    ]);
    if (t > 4.5) x = spr(t, 4.5, 660, 640, 2.5, 0.5);
    b.rot = kf(t, [
      [3.0, 0],
      [3.28, -0.1, E.inOutSine],
      [3.62, 0.07, E.outCubic],
      [4.22, 0.07],
      [4.42, 0.13],
    ]);
    if (t > 4.5) b.rot = spr(t, 4.5, 0.13, 0, 2.6, 0.4);
    b.reachDir = 0.28;
    b.reach = kf(t, [
      [3.28, 0],
      [3.62, 0.92, E.outBack],
      [4.22, 0.92],
      [4.44, 1.12, E.outCubic],
    ]);
    if (t > 3.62 && t < 4.22) b.reach += 0.025 * Math.sin((t - 3.62) * TAU * 2.2);
    if (t > 4.5) b.reach = spr(t, 4.5, 1.12, 0, 3.1, 0.3);
    sq += 0.08 * bump(t, 3.0, 3.36, 0.2, 0.12);
    sq += landSquash(t, 4.52, 0.1, 3.4, 9);
    sq += 0.09 * bump(t, 5.02, 5.2, 0.05, 0.12); // gulp
    sq -= 0.1 * bump(t, 6.16, 6.5, 0.06, 0.3); // surprise stretch
    sq += 0.13 * bump(t, 6.8, 7.06, 0.16, 0.06); // crouch before launch
    // gaze
    const trailHead = clamp((t - 5.06) / 1.1);
    b.yaw = kf(t, [
      [3.0, 0.6],
      [3.66, 0.6],
      [3.82, 0.06, E.inOutCubic],
      [4.05, 0.06],
      [4.2, 0.6, E.inOutCubic],
      [5.1, 0.45],
      [5.2, 0.4],
    ]);
    if (t > 5.2) b.yaw = lerp(0.4, 0.82, E.inOutSine(trailHead));
    if (t > 6.4) b.yaw = tw(t, 6.4, 6.8, 0.82, 0.58);
    b.pitch = kf(t, [
      [3.0, -0.2],
      [3.66, -0.24],
      [3.82, 0.0],
      [4.05, 0.0],
      [4.2, -0.26],
      [5.1, -0.12],
    ]);
    if (t > 5.2) b.pitch = -0.12 + 0.1 * Math.sin(trailHead * Math.PI);
    if (t > 6.4) b.pitch = tw(t, 6.4, 6.8, -0.12, -0.1);
    b.lid = kf(t, [
      [3.0, 0.4],
      [3.25, 0.08],
      [3.66, 0.08],
      [3.82, 0.44],
      [4.04, 0.44],
      [4.18, 0.0],
    ]);
    if (t > 6.45) b.lid = kf(t, [
      [6.45, 0],
      [6.6, 0.34],
      [6.9, 0.3],
    ]);
    b.lidTilt = -0.06;
    b.smirk = kf(t, [
      [3.0, 0.6],
      [3.3, 0.2],
      [3.66, 0.2],
      [3.82, 0.75],
      [4.1, 0.75],
      [4.25, 0.0],
    ]);
    if (t > 6.45) b.smirk = tw(t, 6.45, 6.62, 0, 0.42);
    b.smile = kf(t, [
      [3.0, 0.92],
      [3.3, 0.3],
      [3.66, 0.3],
      [3.82, 0.9],
      [4.1, 0.9],
      [4.25, 0.3],
      [4.52, 0.3],
      [4.56, 0.45],
      [5.1, 0.5],
      [5.2, 0.7],
    ]);
    if (t > 6.45) b.smile = tw(t, 6.45, 6.62, 0.6, 1.0);
    // mouth
    b.mouthOpen = kf(t, [
      [3.28, 0],
      [3.5, 0.16, E.outCubic],
      [3.7, 0.0],
      [4.22, 0.0],
      [4.42, 1.02, E.outBack],
      [4.5, 1.05],
      [4.535, 0.0, E.inQuad],
    ]);
    if (t > 6.14) b.mouthOpen = kf(t, [
      [6.14, 0],
      [6.22, 0.34, E.outBack],
      [6.42, 0.3],
      [6.5, 0.0],
    ]);
    b.mouthW = kf(t, [
      [3.0, 0.19],
      [3.28, 0.12],
      [3.5, 0.09],
      [3.7, 0.13],
      [4.22, 0.13],
      [4.42, 0.46],
      [4.5, 0.46],
      [4.54, 0.09],
      [5.1, 0.1],
      [5.2, 0.15],
      [6.14, 0.15],
      [6.22, 0.08],
      [6.45, 0.09],
      [6.62, 0.23],
    ]);
    b.jaw = kf(t, [
      [4.22, 0],
      [4.42, 0.55],
      [4.53, 0.0],
    ]);
    b.tongue = bump(t, 6.56, 6.84, 0.1, 0.12);
    // cheeks after the first bite
    const p = t > 4.53 ? Math.exp(-Math.max(0, t - 4.9) * 9) * clamp((t - 4.53) / 0.05) : 0;
    const chew = Math.sin((t - 4.53) * TAU * 4.2);
    b.puffL = p * (1 + 0.28 * chew);
    b.puffR = p * (1 - 0.28 * chew);
    b.chew = t > 4.55 && t < 5.0 ? chew : 0;
    b.happy = kf(t, [
      [4.53, 0],
      [4.6, 1.0, E.outCubic],
      [4.98, 1.0],
      [5.12, 0.0],
    ]);
    b.wide = kf(t, [
      [3.0, 0.22],
      [3.28, 0.0],
      [3.6, 0.22],
      [3.7, 0.0],
      [4.18, 0.0],
      [4.3, 0.38],
      [4.5, 0.38],
      [4.55, 0],
      [6.14, 0.05],
      [6.24, 1.0, E.outBack],
      [6.5, 0.85],
      [6.62, 0.3],
    ]);
    b.eyeScale = 1 + 0.12 * bump(t, 6.14, 6.6, 0.08, 0.16);
    b.blush = kf(t, [
      [4.5, 0.75],
      [4.6, 1.0],
      [5.2, 0.75],
    ]);
    b.eyeOpen = blinkAt(t, [5.3]);
  } else if (t < 12.05) {
    // ---- Scene 3: the feast
    const tr = ballTrack(t);
    const p = trailAt(tr.s);
    x = p.x;
    y = p.y - R;
    lift = tr.lift;
    // squash on landings, stretch in the air
    const sg = tr.seg;
    if (sg && sg[5] > 0) {
      const u = tr.u;
      const H = sg[4];
      if (H > 20) {
        b.vAxis = -Math.PI / 2;
        b.vK = 1 + (H / 82) * 0.13 * (1 - Math.sin(Math.PI * u)) * clamp(u * 10) * clamp((1 - u) * 10);
      } else {
        b.vAxis = 0;
        b.vK = 1 + clamp((t - 10.4) * 4) * 0.08;
      }
    }
    for (const e of EAT) {
      if (e.t <= t) sq += landSquash(t, e.t, e.phase === 'A' ? 0.15 : e.phase === 'B' ? 0.08 : 0.04, 3.4, 10);
    }
    sq += 0.1 * bump(t, 11.75, 12.1, 0.04, 0.2); // braking
    b.rot = -0.1 * bump(t, 11.74, 12.12, 0.05, 0.25);
    b.yaw = 0.55;
    b.pitch = -0.1;
    // glance up at each new prompt strip
    for (const st of STRIPS) {
      const g = bump(t, st.tA + 0.02, st.tA + 0.42, 0.08, 0.14);
      b.pitch = lerp(b.pitch, 0.55, g);
      b.yaw = lerp(b.yaw, 0.35, g);
    }
    mouthForEating(b, t);
    cheeksForEating(b, t);
    b.wide = t < 8.6 ? tw(t, 7.0, 7.2, 0.3, 0.1) : t < 10.5 ? tw(t, 8.6, 8.8, 0.1, 0.35) : tw(t, 10.5, 10.7, 0.35, 0.55);
    b.eyeScale = 1 + 0.06 * clamp((t - 10.5) / 0.2);
    b.lid = tw(t, 7.0, 7.2, 0.3, 0);
    b.lidTilt = -0.06;
    b.smirk = tw(t, 7.0, 7.2, 0.42, 0);
    if (b.mouthOpen === 0) b.mouthW = lerp(0.23, 0.13, clamp((t - 7.0) / 0.2));
    // happy squint after the big early bites
    let hp = 0;
    for (const e of EAT) if (e.phase === 'A') hp = Math.max(hp, bump(t, e.t + 0.02, e.t + 0.22, 0.04, 0.08));
    b.happy = hp;
    b.blush = t < 10.5 ? 0.8 : 0.95;
    b.smile = tw(t, 7.0, 7.2, 1.0, 0.6);
    // swallow everything before the stop
    if (t > 11.82) {
      const g = 1 - E.inOutSine(clamp((t - 11.82) / 0.2));
      b.puffL *= g;
      b.puffR *= g;
      b.chew *= g;
      sq += 0.06 * bump(t, 11.84, 12.04, 0.06, 0.12);
    }
  } else {
    // ---- Scene 4/5: spiral, realisation, the final careful bite
    const p = trailAt(SSTOP);
    x = p.x;
    y = p.y - R;
    const tf = Math.min(t, T_FREEZE); // the freeze holds every pre-freeze motion
    sq += landSquash(t, 12.05, 0.12, 3, 9);
    // spiral: mouth wide open, inhaling
    b.yaw = tw(t, 12.05, 12.2, 0.55, 0.5);
    b.pitch = tw(t, 12.05, 12.2, -0.1, 0.06);
    b.rot = -0.05 * bump(t, 12.06, 13.12, 0.12, 0.1);
    b.mouthOpen = kf(tf, [
      [12.04, 0],
      [12.2, 0.95, E.outBack],
      [13.08, 0.9],
      [13.17, 0.0, E.inQuad],
    ]);
    b.mouthW = kf(tf, [
      [12.04, 0.12],
      [12.2, 0.42],
      [13.08, 0.4],
      [13.18, 0.1],
    ]);
    b.jaw = kf(tf, [
      [12.04, 0],
      [12.2, 0.45],
      [13.1, 0.4],
      [13.18, 0],
    ]);
    let n = 0;
    for (const id of SPIRAL.slice(0, 7)) {
      const ta = TOKS[id].tArr;
      if (tf >= ta) n++;
      b.mouthOpen -= 0.22 * bump(tf, ta - 0.01, ta + 0.09, 0.03, 0.06);
    }
    const P = Math.min(1.05, 0.15 * n + 0.15 * clamp((tf - 12.2) / 0.2));
    const chewOn = tf > 13.18 ? 1 : 0;
    const chew = Math.sin((tf - 13.18) * TAU * 4.6) * chewOn;
    b.puffL = P * (1 + 0.24 * chew);
    b.puffR = P * (1 - 0.24 * chew);
    b.chew = chew * 0.8;
    b.smile = tf > 13.18 ? 0.1 : tw(t, 12.05, 12.2, 0.6, 0.4);
    b.wide = tw(t, 12.05, 12.25, 0.55, 0.3);
    b.eyeScale = 1 + 0.06 * (1 - clamp((t - 12.05) / 0.2));
    b.blush = 0.95;
    // notices the meter, freezes
    const look = E.outCubic(clamp((tf - 13.28) / 0.1));
    b.yaw = lerp(b.yaw, 0.42, look);
    b.pitch = lerp(b.pitch, 0.5, look);
    b.wide = lerp(b.wide, 0.62, look);
    if (t > 14.1) {
      const k = E.inOutSine(clamp((t - 14.1) / 0.85));
      b.yaw = lerp(0.42, 0.0, k);
      b.pitch = lerp(0.5, 0.0, k);
      b.wide = lerp(0.62, 0.42, k);
    }
    b.wavy = t > T_FREEZE && t < 15.47 ? clamp((t - T_FREEZE) / 0.08) : 0;
    b.sweat = clamp((t - 14.98) / 0.7);
    if (t > 15.7) b.sweat = 0;
    b.eyeOpen = blinkAt(t, [15.12], 0.24);
    // gulp + sheepish
    if (t > 15.45) {
      const g = E.inOutSine(clamp((t - 15.45) / 0.14));
      b.puffL = lerp(b.puffL, 0, g);
      b.puffR = lerp(b.puffR, 0, g);
      b.chew = 0;
      sq += landSquash(t, 15.5, 0.12, 3.2, 8);
      b.eyeOpen *= 1 - 0.7 * bump(t, 15.46, 15.66, 0.04, 0.1);
      b.yaw = kf(t, [
        [15.5, 0],
        [15.75, -0.14],
        [16.1, -0.14],
        [16.3, 0.5],
      ]);
      b.pitch = kf(t, [
        [15.5, 0],
        [16.1, 0.02],
        [16.32, -0.3],
      ]);
      b.lid = kf(t, [
        [15.5, 0],
        [15.7, 0.26],
        [16.1, 0.26],
        [16.3, 0.0],
      ]);
      b.lidTilt = -0.06;
      b.smile = kf(t, [
        [15.5, 0.1],
        [15.7, 0.45],
        [16.2, 0.4],
        [16.4, 0.25],
      ]);
      b.smirk = kf(t, [
        [15.5, 0],
        [15.7, -0.3],
        [16.2, -0.3],
        [16.4, 0],
      ]);
      b.mouthW = kf(t, [
        [15.5, 0.1],
        [15.7, 0.13],
        [16.3, 0.12],
      ]);
      b.mouthOpen = 0;
      b.wide = kf(t, [
        [15.5, 0.42],
        [15.7, 0.0],
      ]);
      b.blush = kf(t, [
        [15.5, 0.95],
        [16.0, 0.85],
      ]);
    }
    if (t > 16.0) scene5Ball(b, t);
    if (t > 16.0) {
      sq += b._sq || 0;
    }
  }

  b.x = x;
  b.y = y - lift;
  b.sy = 1 - sq;
  b.sx = 1 + sq * 0.92;
  b.ground = t < 12.05 && t >= 7.0 ? trailAt(ballTrack(t).s).y : t >= 12.05 ? trailAt(SSTOP).y : G;
  return b;
}

function scene5Ball(b, t) {
  // looks at the straggler token, picks it up, considers, careful bite
  if (t > 16.32) {
    b.pitch = tw(t, 16.32, 16.6, -0.3, -0.34);
    b.yaw = tw(t, 16.32, 16.6, 0.5, 0.52);
  }
  b.mouthOpen = kf(t, [
    [16.36, 0],
    [16.44, 0.18, E.outCubic],
    [16.6, 0.0],
    [16.82, 0.0],
    [16.96, 0.3],
    [17.04, 0.0],
  ]);
  b.mouthW = kf(t, [
    [16.36, 0.12],
    [16.44, 0.07],
    [16.6, 0.12],
    [16.96, 0.13],
    [17.05, 0.1],
  ]);
  // lean down to pick it up, then straighten
  b.rot = kf(t, [
    [16.55, 0],
    [16.98, 0.42, E.inOutCubic],
    [17.06, 0.42],
    [17.45, 0.0, E.inOutCubic],
  ]);
  b.reachDir = 0.62;
  b.reach = kf(t, [
    [16.6, 0],
    [16.98, 0.26],
    [17.1, 0.2],
    [17.4, 0],
  ]);
  b._sq = 0.05 * bump(t, 16.5, 16.62, 0.06, 0.06) + landSquash(t, 17.45, 0.05, 3, 8);
  // considering it (cross-eyed, little tilt)
  const con = bump(t, 17.42, 18.3, 0.18, 0.12);
  if (t > 17.06) {
    b.pitch = lerp(-0.1, -0.44, con);
    b.yaw = lerp(0.2, 0.0, clamp((t - 17.06) / 0.3));
    b.cross = 0.7 * con;
    b.rot += con * 0.06 * Math.sin((t - 17.42) * TAU * 0.9);
    b.lid = 0.12 * con;
    b.smile = 0.2;
    b.mouthW = 0.11;
  }
  // careful bite
  if (t > 18.2) {
    b.mouthOpen = kf(t, [
      [18.2, 0],
      [18.3, 0.36, E.outCubic],
      [18.42, 0.3],
      [18.47, 0.0, E.inQuad],
    ]);
    b.mouthW = kf(t, [
      [18.2, 0.11],
      [18.3, 0.16],
      [18.47, 0.09],
    ]);
    b.pitch = lerp(-0.2, 0.0, clamp((t - 18.2) / 0.3));
    b.yaw = 0;
    b.cross = 0;
  }
  if (t > 18.47) {
    const chew = Math.sin((t - 18.47) * TAU * 2.8) * (t < 18.95 ? 1 : 0);
    const pf = 0.42 * (t < 18.95 ? 1 : Math.exp(-(t - 18.95) * 14));
    b.puffL = pf * (1 + 0.3 * chew);
    b.puffR = pf * (1 - 0.3 * chew);
    b.chew = chew * 0.6;
    b.happy = kf(t, [
      [18.47, 0],
      [18.56, 1.0],
      [18.98, 1.0],
      [19.06, 0.0],
    ]);
    b.smile = 0.5;
    b.rot = 0.035 * Math.sin((t - 18.47) * TAU * 1.1) * (t < 19.0 ? 1 : 0);
    b._sq += landSquash(t, 18.95, 0.06, 3, 9);
  }
  // spark appears: look up in delight, then quiet satisfaction
  if (t > 19.0) {
    b.pitch = kf(t, [
      [19.0, 0.0],
      [19.12, 0.52, E.outCubic],
      [19.95, 0.55],
      [20.4, 0.22],
    ]);
    b.wide = kf(t, [
      [19.0, 0.0],
      [19.12, 0.45, E.outBack],
      [19.9, 0.3],
      [20.1, 0.0],
    ]);
    b.mouthOpen = kf(t, [
      [19.02, 0.0],
      [19.12, 0.22, E.outCubic],
      [19.8, 0.18],
      [19.95, 0.0],
    ]);
    b.mouthW = kf(t, [
      [19.02, 0.1],
      [19.12, 0.07],
      [19.8, 0.08],
      [20.0, 0.15],
    ]);
    b.happy = kf(t, [
      [19.95, 0.0],
      [20.15, 1.0, E.inOutSine],
    ]);
    b.smile = kf(t, [
      [19.9, 0.4],
      [20.15, 0.88],
    ]);
    b.blush = kf(t, [
      [19.9, 0.75],
      [20.3, 0.95],
    ]);
    b._sq += -0.05 * bump(t, 19.0, 19.3, 0.05, 0.2) - 0.012 * Math.sin((t - 20.2) * TAU * 0.75) * (t > 20.2 ? 1 : 0);
  }
}

function mouthForEating(b, t) {
  let open = 0;
  let w = 0.13;
  b.jaw = 0;
  for (const e of EAT) {
    const pre = e.phase === 'A' ? 0.26 : e.phase === 'B' ? 0.15 : 0.075;
    const peak = e.phase === 'A' ? 1.0 : e.phase === 'B' ? 0.78 : 0.62;
    const pw = e.phase === 'A' ? 0.46 : e.phase === 'B' ? 0.38 : 0.34;
    if (t >= e.t - pre && t <= e.t + 0.035) {
      const k = t <= e.t ? E.outCubic((t - (e.t - pre)) / pre) : 1 - (t - e.t) / 0.035;
      if (k * peak > open) {
        open = k * peak;
        w = lerp(0.13, pw, k);
        b.jaw = 0.5 * k * (e.phase === 'A' ? 1 : 0.5);
      }
    }
  }
  b.mouthOpen = open;
  b.mouthW = w;
}

function cheeksForEating(b, t) {
  let P = 0;
  let last = -1;
  for (const e of EAT) {
    if (e.t > t) break;
    const add = e.phase === 'A' ? 0.6 : e.phase === 'B' ? 0.26 : 0.15;
    P = P * Math.exp(-(e.t - Math.max(last, 0)) / (e.phase === 'A' ? 0.25 : 0.9)) + add;
    last = e.t;
  }
  if (last > 0) P *= Math.exp(-(t - last) / (t < 8.6 ? 0.25 : 0.9));
  P = Math.min(P, 1.05);
  const chew = Math.sin((t - 7) * TAU * (t < 10.5 ? 4 : 8));
  b.puffL = P * (1 + 0.22 * chew);
  b.puffR = P * (1 - 0.22 * chew);
  b.chew = P > 0.2 ? chew * 0.6 : 0;
}

// ---------------------------------------------------------------------------
// Tokens
function heroToken(t) {
  // drop with a paper tap, a little bounce and a rock to rest
  const rest = { x: 960, y: G - HERO / 2 - HERO * 0.09 };
  const t0 = 0.3;
  const tL = 0.8;
  const yTop = -80;
  const g = (2 * (rest.y - yTop)) / ((tL - t0) * (tL - t0));
  let y = rest.y;
  let rot = 0;
  let sq = 1;
  if (t < t0) return null;
  if (t < tL) {
    const d = t - t0;
    y = yTop + 0.5 * g * d * d;
    rot = lerp(-0.55, 0.16, E.inOutSine(d / (tL - t0)));
  } else {
    const v = g * (tL - t0) * 0.17;
    const tb = (2 * v) / g;
    const d = t - tL;
    if (d < tb) y = rest.y - (v * d - 0.5 * g * d * d);
    rot = 0.16 * Math.exp(-d * 6) * Math.cos(d * TAU * 2.6);
    sq = 1 - 0.12 * Math.exp(-d * 30) - (d > tb ? 0.05 * Math.exp(-(d - tb) * 30) : 0);
  }
  const h = rest.y - y;
  return { x: rest.x, y, rot, sq, contact: clamp(1 - h / 520), groundY: G, lift: 0 };
}

function tokenState(tk, t, ball, mouth) {
  // returns drawable state or null; also flags 'inMouth'
  const lk = tk.look;
  const base = { size: tk.size, kind: lk.kind, mark: lk.mark, markInk: lk.markInk, seed: lk.seed, alpha: 1, lift: 0 };
  let pos = null;
  if (tk.id === 0) {
    const h = heroToken(t);
    if (!h) return null;
    pos = h;
    if (t >= 4.42) {
      if (t >= 4.5) return null;
      const u = (t - 4.42) / 0.08;
      return flyToMouth(base, { x: 960, y: h.y, rot: 0 }, mouth, u, t);
    }
    return Object.assign(base, pos);
  }
  const rest = restOn(tk.s, tk.size);
  if (tk.src === 'trail') {
    if (t < tk.tPop) return null;
    const pk = clamp((t - tk.tPop) / 0.28);
    const sc = E.outBack(pk);
    pos = { x: rest.x, y: rest.y + (1 - sc) * 10, rot: rest.rot + wob(t, tk.tPop, 0.3, 2.5, 6), sq: 1, contact: pk, groundY: rest.gy };
    Object.assign(base, pos, { size: tk.size * Math.max(0.01, sc) });
  } else if (tk.spiral == null || tk.spiral >= 0) {
    // strip-born token: in the strip, bursting, flying, landed
    const st = STRIPS[tk.strip];
    if (t < tk.bt) return null; // drawn as part of the strip / piece
    if (t < tk.tLand) {
      const u = (t - tk.bt) / tk.flight;
      const gx = lerp(tk.bx, rest.x, u);
      const arcH = 60 + 40 * hash(tk.id, 4);
      const gy = lerp(tk.by, rest.y, E.inQuad(u)) - arcH * Math.sin(Math.PI * u) * (1 - u * 0.4);
      const rot = lerp(tk.spin, rest.rot, E.inOutSine(u));
      const flip = tk.flips ? Math.cos(Math.PI * tk.flips * E.inOutSine(u)) : 1;
      Object.assign(base, { x: gx, y: gy, rot, flip, sq: 1, lift: 80 * (1 - u), contact: 0 });
    } else {
      const d = t - tk.tLand;
      const bounce = d < 0.16 ? 14 * hopArc(d / 0.16) : 0;
      Object.assign(base, {
        x: rest.x,
        y: rest.y - bounce,
        rot: rest.rot + wob(t, tk.tLand, 0.14, 3, 7),
        sq: 1 - 0.1 * Math.exp(-d * 28),
        contact: 1,
        groundY: rest.gy,
      });
    }
  }
  // spiral / straggler behaviour in scene 4
  if (tk.tLift != null && t >= tk.tLift) {
    if (tk === FINAL) return stragglerState(tk, t, base, rest, mouth);
    if (t >= tk.tArr) return null;
    const u = clamp((t - tk.tLift) / (tk.tArr - tk.tLift));
    const m = mouth;
    const ue = E.inCubic(u) * 0.7 + u * 0.3;
    const c = [lerp(rest.x, m[0], 0.35), Math.min(rest.y, m[1]) - 80 - 50 * hash(tk.id, 6)];
    const q = (a, b, cc, k) => (1 - k) * (1 - k) * a + 2 * (1 - k) * k * cc + k * k * b;
    let x = q(rest.x, m[0], c[0], ue);
    let y = q(rest.y, m[1], c[1], ue);
    const tx = 2 * (1 - ue) * (c[0] - rest.x) + 2 * ue * (m[0] - c[0]);
    const ty = 2 * (1 - ue) * (c[1] - rest.y) + 2 * ue * (m[1] - c[1]);
    const tl = Math.hypot(tx, ty) || 1;
    const ph = TAU * 1.5 * ue + tk.spiral * 1.1;
    const A = 44 * (1 - ue) * Math.min(1, u * 5);
    x += (-ty / tl) * A * Math.sin(ph);
    y += (tx / tl) * A * Math.sin(ph);
    const depth = Math.cos(ph) * (1 - ue);
    Object.assign(base, {
      x,
      y,
      rot: rest.rot + ue * 7 + Math.sin(ph) * 0.3,
      size: tk.size * lerp(1, 0.52, ue) * (1 + 0.15 * depth),
      lift: 50 * Math.sin(Math.PI * u),
      contact: 1 - clamp(u * 4),
      inMouth: ue > 0.88,
    });
    return base;
  }
  // eaten during scene 3?
  if (tk.tEat != null && t >= tk.tEat - 0.09) {
    if (t >= tk.tEat) return null;
    const u = (t - (tk.tEat - 0.09)) / 0.09;
    return flyToMouth(base, { x: base.x, y: base.y, rot: base.rot }, mouth, u, t);
  }
  return base;
}

function stragglerState(tk, t, base, rest, mouth) {
  // trembles, lifts late, arcs toward the mouth, bonks the closed lips, drops
  if (t >= 17.0) return null; // picked up (drawn by heldToken)
  const m = mouth;
  if (t < 13.0) {
    const k = clamp((t - tk.tLift) / 0.5);
    return Object.assign(base, {
      x: rest.x + Math.sin(t * 70) * 2.2 * k - 18 * E.inOutSine(clamp((t - 12.6) / 0.4)),
      y: rest.y - 5 * k * Math.abs(Math.sin(t * 31)),
      rot: rest.rot + Math.sin(t * 53) * 0.08 * k,
    });
  }
  const start = { x: rest.x - 18, y: rest.y };
  const bonk = [m[0] + 14, m[1] + 2];
  const landX = trailAt(SSTOP).x + R + 2;
  const land = { x: landX, y: G - TOK / 2 - TOK * 0.09 };
  if (t < 13.44) {
    const u = (t - 13.0) / 0.44;
    const ue = E.inQuad(u);
    return Object.assign(base, {
      x: lerp(start.x, bonk[0], ue),
      y: lerp(start.y, bonk[1], ue) - 70 * Math.sin(Math.PI * u),
      rot: rest.rot - ue * 4.2,
      lift: 60 * Math.sin(Math.PI * u),
      contact: 1 - clamp(u * 3),
    });
  }
  if (t < 13.78) {
    // falls from the lips to the ground in front
    const u = (t - 13.44) / 0.34;
    return Object.assign(base, {
      x: lerp(bonk[0], land.x, u),
      y: lerp(bonk[1], land.y, E.inQuad(u)) - 30 * Math.sin(Math.PI * u * 0.8),
      rot: lerp(-4.2, -TAU, E.outQuad(u)) + 0.0,
      lift: 30 * (1 - u),
      contact: u,
      groundY: G,
    });
  }
  // resting in front of the ball until it is picked up in scene 5
  const d = t - 13.78;
  const restState = {
    x: land.x,
    y: land.y - (d < 0.12 ? 8 * hopArc(d / 0.12) : 0),
    rot: wob(t, 13.78, 0.12, 3, 7),
    sq: 1 - 0.1 * Math.exp(-d * 28),
    contact: 1,
    groundY: G,
    lift: 0,
  };
  return Object.assign(base, restState);
}

function flyToMouth(base, p0, mouth, u, t) {
  const ue = E.inQuad(clamp(u));
  return Object.assign(base, {
    x: lerp(p0.x, mouth[0], ue),
    y: lerp(p0.y, mouth[1], ue) - 26 * Math.sin(Math.PI * u),
    rot: (p0.rot || 0) + ue * 1.6,
    size: base.size * lerp(1, 0.55, ue),
    lift: 30 * Math.sin(Math.PI * u),
    contact: 1 - clamp(u * 3),
    inMouth: u > 0.62,
  });
}

// ---------------------------------------------------------------------------
// Strips
function stripState(st, t) {
  if (t < st.tA || t >= st.tB + 0.3) return null;
  const a = clamp((t - st.tA) / 0.16);
  const pop = E.outBack(clamp((t - st.tA) / 0.3));
  const unfold = E.outBackSoft(clamp((t - st.tU) / (st.tU1 - st.tU)));
  const floatY = Math.sin((t - st.tA) * 3.1 + st.i) * 4;
  const rot = (st.i % 2 ? 0.035 : -0.035) + wob(t, st.tA, 0.18, 1.6, 4) + wob(t, st.tU1, 0.04, 2.2, 5);
  return { a, pop, unfold, floatY, rot };
}

function drawStripsAndPieces(ctx, t) {
  for (const st of STRIPS) {
    const s = stripState(st, t);
    if (!s) continue;
    const y = st.y - (1 - s.pop) * 40 + s.floatY;
    if (t < st.tB) {
      drawStrip(ctx, {
        x: st.x,
        y,
        w: st.w,
        h: st.h,
        text: st.text,
        unfold: s.unfold,
        rot: s.rot,
        alpha: s.a,
        scale: lerp(0.7, 1, s.pop),
        fontSize: st.fontSize,
      });
    } else {
      // burst: pieces separate and turn into tokens
      const k = clamp((t - st.tB) / 0.3);
      const n = st.ids.length;
      const pw = st.w / n;
      st.ids.forEach((id, j) => {
        const tk = TOKS[id];
        const lx = -st.w / 2 + (j + 0.5) * pw;
        const cr = Math.cos(s.rot);
        const sr = Math.sin(s.rot);
        const x0 = st.x + lx * cr;
        const y0 = y + lx * sr;
        const ke = E.outCubic(k);
        drawStripPiece(ctx, {
          x: lerp(x0, tk.bx, ke),
          y: lerp(y0, tk.by, ke) - 22 * Math.sin(Math.PI * k),
          w: pw,
          h: st.h,
          size: TOK,
          k,
          rot: lerp(s.rot, tk.spin * 0.05, ke),
          kind: tk.look.kind,
          mark: tk.look.mark,
          markInk: tk.look.markInk,
          seed: tk.look.seed,
          text: st.text,
          textOffset: lx,
          fontSize: st.fontSize,
          alpha: 1,
        });
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Meter
function meterState(t) {
  if (t < 11.92 || t > 16.6) return null;
  const cam4x = trailAt(SSTOP).x + 320;
  const inK = E.outBack(clamp((t - 11.92) / 0.4));
  const outK = E.inBack(clamp((t - 16.0) / 0.45));
  let level = 0.36;
  let slosh = 0;
  SPIRAL.slice(0, 7).forEach((id, j) => {
    const ta = TOKS[id].tArr;
    level += 0.078 * E.outBack(clamp((t - ta) / 0.22));
    slosh += Math.exp(-Math.max(0, t - ta) * 5) * (t >= ta ? 1 : 0);
  });
  if (t > T_FREEZE) slosh *= Math.exp(-(t - T_FREEZE) * 3);
  return {
    x: cam4x + (1166 - 960),
    y: 196 - 540 + 546 - (1 - inK) * 260 - outK * 300,
    w: 540,
    h: 58,
    level,
    slosh: clamp(slosh, 0, 1),
    alpha: clamp((t - 11.92) / 0.12) * (1 - clamp((t - 16.3) / 0.3)),
    rot: wob(t, 11.92, 0.05, 1.8, 4) - 0.01,
    boil: Math.floor(t * 12),
  };
}

// ---------------------------------------------------------------------------
// Spark + page (scene 5) in world space; screen-space sweep in scene 6
function pageWorld(t) {
  const top = { x: trailAt(SSTOP).x + 10, y: 205 };
  return top;
}

function drawSparkPage(ctx, t) {
  if (t < 19.0 || t > 21.0) return;
  const c = pageWorld(t);
  const bob = Math.sin((t - 19) * 2.4) * 5;
  if (t < 19.3) {
    const k = clamp((t - 19.0) / 0.25);
    drawSpark(ctx, {
      x: c.x,
      y: c.y + 70 - 70 * E.outCubic(k) + bob,
      r: 34,
      scale: E.outBack(k),
      rot: (1 - k) * -0.6 + Math.sin(t * 6) * 0.04,
      alpha: 1,
      rays: E.outCubic(clamp((t - 19.08) / 0.2)),
    });
    return;
  }
  const m = clamp((t - 19.3) / 0.6);
  drawPage(
    ctx,
    {
      x: c.x,
      y: c.y + bob * (1 - m) + bob * 0.5,
      w: 270,
      h: 350,
      r: 34,
      morph: m,
      rot: (1 - E.inOutCubic(m)) * 0.2 - 0.03,
      scale: 1,
      alpha: 1,
      reveal: clamp((t - 19.72) / 0.75),
      boil: Math.floor(t * 12),
    },
    t,
  );
  if (m < 1) {
    drawActionMarks(ctx, c.x, c.y, [0.4, 1.2, 2.0, 2.8, 3.6, 4.4, 5.2, 6.0], 150, 26, 4, clamp((t - 19.3) / 0.45));
  }
}

// ---------------------------------------------------------------------------
// End card
function layoutEnd(ctx) {
  const titleSize = 156;
  const title = 'TOKEN HUNGRY';
  const tw_ = textWidth(ctx, title, titleSize, F.display, 2);
  const ballR = 60;
  const gap = 30;
  const groupW = tw_ + gap + ballR * 2;
  const left = 960 - groupW / 2;
  const base = 395;
  return {
    titleSize,
    title,
    titleX: left,
    titleY: base,
    ballX: left + tw_ + gap + ballR,
    ballY: base - ballR,
    ballR,
    tagY: 487,
    tagSize: 58,
    byY: 662,
    nameY: 785,
    nameSize: 120,
    nameW: textWidth(ctx, 'IMRAN', 120, F.display, 14),
  };
}

function drawEndCard(ctx, t) {
  const L = END;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawPaper(ctx, { x: 960, y: 540, zoom: 1 });
  // title
  ctx.fillStyle = C.ink;
  ctx.font = `${L.titleSize}px ${F.display}`;
  ctx.letterSpacing = '2px';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(L.title, L.titleX, L.titleY);
  ctx.letterSpacing = '0px';
  // tiny token divider
  const dk = (i) => E.outBack(clamp((t - 21.66 - i * 0.05) / 0.25));
  [
    ['cream', 'dot'],
    ['terra', 'lines'],
    ['cream', 'arc'],
  ].forEach(([kind, mark], i) => {
    const k = dk(i);
    if (k <= 0) return;
    drawToken(ctx, {
      x: 960 + (i - 1) * 44,
      y: 572,
      size: 26 * k,
      rot: (i - 1) * 0.12,
      kind,
      mark,
      markInk: true,
      seed: 60 + i,
      alpha: 1,
      lift: 0,
    });
  });
  // tagline + credit rise in as the page sweeps clear
  drawCaption(ctx, { text: 'Make every token count.', x: 960, y: L.tagY, size: L.tagSize, font: F.italic, tIn: 21.5, stagger: 0.045, dur: 0.42, color: 'rgba(42,37,33,0.9)' }, t);
  drawCaption(ctx, { text: 'Created by', x: 960, y: L.byY, size: 36, font: F.sans, tIn: 21.62, stagger: 0.05, dur: 0.36, color: 'rgba(42,37,33,0.78)', letterSpacing: 1 }, t);
  drawCaption(ctx, { text: 'IMRAN', x: 960, y: L.nameY, size: L.nameSize, font: F.display, tIn: 21.68, dur: 0.32, letterSpacing: 14 }, t);
  const uk = E.inOutCubic(clamp((t - 21.8) / 0.2));
  if (uk > 0) {
    const x0 = 960 - L.nameW / 2 - 6;
    const x1 = x0 + (L.nameW + 4) * uk;
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const u = i / 30;
      pts.push([lerp(x0, x1, u), L.nameY + 30 + Math.sin(u * 5.5) * 2.5 - u * 3]);
    }
    brush(ctx, pts, 8, C.terra, { taper: 0.12, minW: 0.5, seed: 77 });
  }
  ctx.restore();
}

function endBall(t) {
  const L = END;
  const b = ballState({ R: L.ballR, boil: Math.floor(t * 12) });
  const tLand = 21.88;
  let y = L.ballY;
  let sq = 0;
  if (t < tLand) {
    const u = clamp((t - 21.55) / (tLand - 21.55));
    y = lerp(-140, L.ballY, E.inQuad(u));
    b.vAxis = -Math.PI / 2;
    b.vK = 1 + 0.18 * u;
  } else {
    sq += landSquash(t, tLand, 0.24, 3, 8);
    // one tiny, contented bounce
    if (t > 22.44 && t < 22.72) {
      const u = (t - 22.44) / 0.28;
      y -= 26 * hopArc(u);
      b.vAxis = -Math.PI / 2;
      b.vK = 1 + 0.06 * (1 - Math.sin(Math.PI * u));
    }
    sq += 0.1 * bump(t, 22.34, 22.46, 0.08, 0.02);
    sq += landSquash(t, 22.72, 0.13, 3.2, 9);
    sq += 0.01 * Math.sin((t - 22.9) * TAU * 0.7) * (t > 22.9 ? 1 : 0);
  }
  b.x = L.ballX;
  b.y = y;
  b.sy = 1 - sq;
  b.sx = 1 + sq * 0.92;
  b.ground = L.ballY + L.ballR;
  b.shadowK = 0.8;
  b.yaw = kf(t, [
    [22.0, -0.1],
    [22.3, -0.04],
  ]);
  b.pitch = 0.04;
  b.happy = kf(t, [
    [21.86, 0.0],
    [21.92, 1.0],
    [22.22, 1.0],
    [22.32, 0.0],
    [22.4, 0.0],
    [22.48, 1.0],
    [22.9, 1.0],
    [23.0, 0.0],
  ]);
  b.happyR = Math.max(b.happy, kf(t, [
    [23.55, 0.0],
    [23.62, 1.0],
    [23.92, 1.0],
    [24.0, 0.0],
  ]));
  b.smile = 0.85;
  b.smirk = kf(t, [
    [23.5, 0.0],
    [23.62, 0.55],
    [23.95, 0.55],
    [24.1, 0.1],
  ]);
  b.mouthW = 0.16;
  b.blush = 0.9;
  b.eyeOpen = blinkAt(t, [24.45]);
  return b;
}

// ---------------------------------------------------------------------------
// Captions (screen space)
const CAPS = [
  { text: 'Just one prompt.', tIn: 0.95, tOut: 4.2 },
  { text: 'Maybe a follow-up.', tIn: 4.86, tOut: 6.72 },
  { text: 'And another…', tIn: 7.15, tOut: 11.92, revealDots: [7.5, 8.0, 8.5] },
  { text: 'Those bites add up.', tIn: 13.62, tOut: 16.12, stagger: 0.16 },
  { text: 'Make every token count.', tIn: 19.95, tOut: 21.0, stagger: 0.08 },
];

function drawCaptions(ctx, t) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const c of CAPS) {
    drawCaption(ctx, Object.assign({ x: 960, y: 880, size: 70, font: F.caption }, c), t);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Effects
function drawEffects(ctx, t, ball) {
  // paper tap marks when the first token lands
  drawActionMarks(ctx, 960 - 50, G - 8, [Math.PI + 0.3, Math.PI + 0.85], 8, 30, 4.5, clamp((t - 0.8) / 0.36));
  drawActionMarks(ctx, 960 + 50, G - 8, [-0.3, -0.85], 8, 30, 4.5, clamp((t - 0.8) / 0.36));
  // mischievous glint during the hesitation
  if (t > 3.84 && t < 4.14) {
    const ep = eyePoint(ball, 1);
    drawTwinkle(ctx, ep[0] + R * 0.14, ep[1] - R * 0.14, 17, (t - 3.84) / 0.3, '#FFF8E6');
  }
  // excitement lines when the trail appears
  if (t > 6.16 && t < 6.6) {
    const ht = headTop(ball);
    drawActionMarks(ctx, ht[0] + 6, ht[1] + 6, [-Math.PI / 2, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55], 18, 30, 4.5, (t - 6.16) / 0.44);
  }
  // braking puff at the stop
  if (t > 11.76 && t < 12.2) {
    const p = trailAt(SSTOP);
    drawActionMarks(ctx, p.x - R * 0.6, p.y - 6, [Math.PI + 0.25, Math.PI + 0.7], 0, 22, 4, (t - 11.76) / 0.44);
  }
  // the straggler's bonk
  if (t > 13.44 && t < 13.76) {
    const m = mouthPoint(ball);
    drawActionMarks(ctx, m[0] + 16, m[1], [-0.5, 0.0, 0.5], 22, 16, 3.6, (t - 13.44) / 0.32);
  }
}

// ---------------------------------------------------------------------------
// Trail line (dashed pencil path drawn by a travelling nib)
function drawTrailLine(ctx, t) {
  if (t < 5.06) return;
  const sA = S0 - 40;
  const sHead = sA + 1250 * (t - 5.06);
  const sEnd = Math.min(sHead, SSTOP + 900);
  const fade = 1 - clamp((t - 15.95) / 0.7);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalAlpha *= fade;
  ctx.beginPath();
  for (let s = sA; s <= sEnd; s += 6) {
    const p = trailAt(s);
    if (s === sA) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.setLineDash([15, 13]);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = 'rgba(42,37,33,0.42)';
  ctx.stroke();
  ctx.setLineDash([]);
  if (sHead < sEnd + 1 && t < 7.2) {
    const p = trailAt(sHead);
    ctx.fillStyle = C.terra;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = C.ink;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Frame
export function initArt(ctx) {
  initBackdrop();
  buildSchedule(ctx);
}

export function renderFrame(ctx, t) {
  t = clamp(t, 0, DURATION - 1e-6);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  const endPhase = t >= 21.32;
  if (!endPhase) {
    const cam = camAt(t);
    drawPaper(ctx, cam);
    ctx.setTransform(...camMatrix(cam));
    drawWorld(ctx, t, cam);
  } else {
    drawEndCard(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const b = endBall(t);
    if (t >= 21.55) drawBall(ctx, b);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawSweep(ctx, t);
  drawCaptions(ctx, t);
  drawFinish(ctx, t);
}

function drawWorld(ctx, t, cam) {
  const ball = ballAt(t);
  const mouth = mouthPoint(ball);
  drawTrailLine(ctx, t);
  // tokens that are resting or in flight (outside the mouth)
  const inside = [];
  const front = [];
  const states = [];
  for (const tk of TOKS) {
    if (!tk) continue;
    const s = tokenState(tk, t, ball, mouth);
    if (!s) continue;
    if (s.inMouth) inside.push(s);
    else if (s.lift > 20 || (tk.tLift != null && t >= tk.tLift) || (tk.tEat != null && t >= tk.tEat - 0.09) || (tk.id === 0 && t > 4.42)) front.push(s);
    else states.push(s);
  }
  for (const s of states) drawToken(ctx, s);
  drawStripsAndPieces(ctx, t);
  // held token (scene 5)
  let held = null;
  if (t >= 17.0 && t < 18.47) held = heldToken(t);
  const world = ctx.getTransform();
  const insideFn = (c) => {
    c.save();
    c.setTransform(world);
    for (const s of inside) drawToken(c, s);
    if (held && held.inMouth) drawToken(c, held);
    c.restore();
  };
  drawBall(ctx, ball, { inside: insideFn });
  if (held && !held.inMouth) {
    drawToken(ctx, held);
    // lips closing around the held token
    drawLipsOver(ctx, ball, held);
  }
  for (const s of front) drawToken(ctx, s);
  drawEffects(ctx, t, ball);
  drawSparkPage(ctx, t);
  const m = meterState(t);
  if (m) drawMeter(ctx, m, t);
}

function heldToken(t) {
  const lk = FINAL.look;
  const ball = ballAt(t);
  const m = mouthPoint(ball);
  const base = { size: TOK * 0.9, kind: lk.kind, mark: lk.mark, markInk: lk.markInk, seed: lk.seed, alpha: 1, lift: 10, contact: 0 };
  // hanging from the lips, nudged during the "consider" beat
  let x = m[0] + 4;
  let y = m[1] + TOK * 0.36;
  let rot = ball.rot * 0.6 + 0.12 * Math.sin((t - 17.4) * 3.2) * bump(t, 17.42, 18.2, 0.2, 0.2);
  let size = base.size;
  if (t < 17.14) {
    // grabbed from the ground: ease from its resting spot into the lips
    const g = E.outCubic(clamp((t - 17.0) / 0.14));
    const rx = trailAt(SSTOP).x + R + 2;
    const ry = G - TOK / 2 - TOK * 0.09;
    x = lerp(rx, x, g);
    y = lerp(ry, y, g);
    size = lerp(TOK, size, g);
    rot = lerp(0, rot, g);
  }
  if (t > 18.3) {
    const u = clamp((t - 18.3) / 0.17);
    y = lerp(y, m[1], E.inQuad(u));
    size = lerp(size, size * 0.45, u);
    return Object.assign(base, { x, y, rot, size, inMouth: true });
  }
  return Object.assign(base, { x, y, rot, size, inMouth: false });
}

function drawLipsOver(ctx, ball, held) {
  // small upper lip arc over the top edge of the held token
  const m = mouthPoint(ball);
  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = R * 0.036;
  const w = held.size * 0.62;
  ctx.fillStyle = C.gold;
  ctx.beginPath();
  ctx.ellipse(m[0] + 4, m[1] - 2, w * 0.8, held.size * 0.16, 0, Math.PI, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(m[0] + 4 - w * 0.85, m[1]);
  ctx.quadraticCurveTo(m[0] + 4, m[1] + 9, m[0] + 4 + w * 0.85, m[1]);
  ctx.stroke();
  ctx.restore();
}

function drawSweep(ctx, t) {
  if (t < 21.0 || t > 21.85) return;
  // The finished page lifts toward camera, covers the frame, then sweeps away.
  const c5 = camAt(20.99);
  const pw = pageWorld(21);
  const bob = Math.sin((21 - 19) * 2.4) * 5;
  const [sx, sy] = toScreen(c5, pw.x, pw.y + bob * 0.5);
  let x;
  let y;
  let sc;
  let rot;
  let contentAlpha;
  if (t < 21.32) {
    const u = E.inCubic(clamp((t - 21.0) / 0.32));
    x = lerp(sx, 960, u);
    y = lerp(sy, 540, u);
    sc = lerp(1, 7.8, u);
    rot = lerp(-0.03, -0.08, u);
    contentAlpha = 1 - clamp(u * 2.2);
  } else {
    const u = E.inOutCubic(clamp((t - 21.32) / 0.5));
    x = lerp(960, -1450, u);
    y = 540 - 60 * u;
    sc = 7.8;
    rot = lerp(-0.08, -0.15, u);
    contentAlpha = 0;
  }
  drawPage(ctx, {
    x,
    y,
    w: 270,
    h: 350,
    morph: 1,
    rot,
    scale: sc,
    alpha: 1,
    reveal: 1,
    contentAlpha,
    shadowK: 1.4,
    shadowOff: 0.6,
  });
}

// ---------------------------------------------------------------------------
// Sound cues
function buildEvents() {
  const ev = [];
  const add = (t, type, x = 960, extra = {}) => {
    const cam = camAt(Math.min(t, 21.3));
    const sx = typeof x === 'number' && extra.world ? toScreen(cam, x, 540)[0] : x;
    ev.push(Object.assign({ t: +t.toFixed(4), type, pan: clamp((sx - 960) / 960, -1, 1) }, extra));
  };
  add(0.3, 'fall', 960, { v: 0.5 });
  add(0.8, 'tap', 960, { v: 1.0 });
  add(0.98, 'tap', 960, { v: 0.35 });
  add(1.12, 'slide', 0, { v: 0.5 });
  add(1.55, 'blink', 40);
  add(1.72, 'blink', 40);
  add(1.95, 'jump', 60, { v: 0.8 });
  add(2.38, 'land', 560, { v: 0.9 });
  add(2.49, 'spot', 560);
  add(3.3, 'stretch', 660, { v: 0.8, dur: 0.32 });
  add(3.86, 'glint', 660);
  add(4.24, 'open', 700, { v: 0.8 });
  add(4.5, 'chomp', 800, { v: 1.0 });
  add(4.66, 'chew', 650, { v: 0.5 });
  add(4.86, 'chew', 650, { v: 0.45 });
  add(5.06, 'swallow', 640, { v: 0.7 });
  add(5.06, 'scribble', 900, { dur: 1.3, v: 0.6 });
  for (let k = 1; k <= 21; k++) {
    const tk = TOKS[k];
    if (tk.src === 'trail') add(tk.tPop, 'pop', restOn(tk.s, TOK).x, { world: true, n: k });
  }
  add(6.18, 'surprise', 640, { v: 0.8 });
  add(6.56, 'lick', 640, { v: 0.5 });
  add(6.98, 'jump', 640, { v: 0.9 });
  // eating
  for (const e of EAT) {
    const tk = TOKS[e.id];
    add(e.t, 'chomp', restOn(tk.s, TOK).x, { world: true, v: e.phase === 'A' ? 0.95 : e.phase === 'B' ? 0.75 : 0.55, phase: e.phase, n: e.id });
    if (e.phase === 'A') add(e.t + 0.01, 'land', restOn(tk.s, TOK).x - DM, { world: true, v: 0.55 });
  }
  // strips
  for (const st of STRIPS) {
    add(st.tA, 'flutter', st.x, { world: true, v: 0.6 });
    add(st.tU, 'unfold', st.x, { world: true, v: 0.8, dur: st.tU1 - st.tU });
    add(st.tB, 'burst', st.x, { world: true, v: 0.8, n: st.ids.length });
    for (const id of st.ids) {
      const tk = TOKS[id];
      add(tk.tLand, 'tap', tk.rest.x, { world: true, v: 0.45 + 0.2 * hash(id, 2) });
    }
  }
  // scene 4
  const sx = trailAt(SSTOP).x;
  add(11.76, 'skid', sx, { world: true, v: 0.7, dur: 0.3 });
  add(11.94, 'swallow', sx, { world: true, v: 0.6 });
  add(11.92, 'slide', 1400, { v: 0.6 });
  add(12.1, 'inhale', sx + 200, { world: true, v: 0.8, dur: 1.0 });
  SPIRAL.slice(0, 7).forEach((id, j) => {
    add(TOKS[id].tArr, 'nom', sx + 50, { world: true, v: 0.6 + j * 0.03, n: j });
    add(TOKS[id].tArr + 0.01, 'tick', 1400, { n: j });
  });
  add(13.17, 'chomp', sx + 50, { world: true, v: 0.8, phase: 'B' });
  add(13.26, 'chew', sx, { world: true, v: 0.4 });
  add(13.3, 'notice', sx, { world: true, v: 0.5 });
  add(T_FREEZE, 'freeze', 960);
  add(13.44, 'bonk', sx + 40, { world: true, v: 0.5 });
  add(13.78, 'tap', sx + R + 30, { world: true, v: 0.35 });
  add(15.0, 'sweat', sx - 80, { world: true, v: 0.4 });
  add(15.12, 'blink', sx, { world: true, v: 0.6 });
  add(15.47, 'gulp', sx, { world: true, v: 0.9 });
  // scene 5
  add(16.0, 'resume', 960);
  add(16.38, 'oh', 1000, { v: 0.4 });
  add(17.03, 'pick', 1040, { v: 0.6 });
  add(18.46, 'crunch', 1000, { v: 0.8 });
  add(18.62, 'chew', 980, { v: 0.35 });
  add(18.8, 'chew', 980, { v: 0.3 });
  add(18.96, 'swallow', 960, { v: 0.5 });
  add(19.02, 'spark', 960, { v: 0.9 });
  add(19.3, 'unfold', 960, { v: 0.9, dur: 0.6 });
  add(19.72, 'scribble', 960, { v: 0.4, dur: 0.75 });
  add(20.0, 'content', 960, { v: 0.6 });
  // scene 6
  add(21.0, 'whoosh', 960, { v: 1.0, dur: 0.85 });
  add(21.55, 'drop', END ? END.ballX : 1500, { v: 0.5 });
  add(21.88, 'land', END ? END.ballX : 1500, { v: 0.6 });
  add(21.68, 'pop', 960, { n: 30 });
  add(21.73, 'pop', 960, { n: 31 });
  add(21.78, 'pop', 960, { n: 32 });
  add(22.44, 'jump', END ? END.ballX : 1500, { v: 0.4 });
  add(22.72, 'boop', END ? END.ballX : 1500, { v: 0.6 });
  add(23.6, 'wink', END ? END.ballX : 1500, { v: 0.6 });
  ev.sort((a, b) => a.t - b.t);
  return ev;
}

export function getEvents() {
  return EVENTS;
}
