// Timeline + renderer entry. window.renderFrame(f) renders frame f deterministically and POSTs raw RGBA to the node driver.
import * as THREE from 'three';
import { Pipeline } from './post.js';
import { buildRoom, SEAT, BED } from './room.js';
import { buildCharacter, PHONE } from './character.js';
import { createUI, UI } from './ui.js';
import { makeTypingBubble, makeChihuahua, makeDiorama, makeSparkles, makeBuzz } from './props.js';
import { drawCaptions } from './captions.js';
import { T, FPS, TOTAL_FRAMES, setData, loud, keyTimes } from './times.js';
import { clamp, lerp, sat, prog, smooth, ease, pop, impulse, spring, fbm1, TAU, hash1 } from './util.js';

const q = new URLSearchParams(location.search);
const SS = parseFloat(q.get('ss') || '2'), SCALE = parseFloat(q.get('scale') || '1');
const W = Math.round(1080 * SCALE), H = Math.round(1920 * SCALE);
const DEBUG = q.get('debug') || '';
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = THREE.MathUtils.degToRad;
const DP = PHONE.SW / UI.W;

async function init() {
  const [words, env] = await Promise.all([fetch('/assets/words.json').then((r) => r.json()), fetch('/assets/env.json').then((r) => r.json())]);
  setData(words, env);
  await Promise.all(['400 20px "Luckiest Guy"', '600 20px Nunito', '700 20px Nunito', '800 20px Nunito', '900 20px Nunito'].map((f) => document.fonts.load(f)));

  const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
  const renderer = new THREE.WebGLRenderer({ canvas: glc, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = !DEBUG.includes('noshadow'); renderer.shadowMap.type = DEBUG.includes('soft') ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const out = document.createElement('canvas'); out.width = W; out.height = H; const octx = out.getContext('2d', { willReadFrequently: true });
  const pipe = new Pipeline(renderer, W, H, SS);

  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05060c);
  const camera = new THREE.PerspectiveCamera(36, W / H, 0.03, 40);
  const room = buildRoom(); scene.add(room.group); const L = room.L;
  if (DEBUG.includes('fewlights')) { for (const k of ['lampGlow', 'moon', 'fill', 'bounce', 'key']) room.group.remove(L[k]); }
  const ui = createUI();
  const uiTex = new THREE.CanvasTexture(ui.canvas); uiTex.colorSpace = THREE.SRGBColorSpace; uiTex.anisotropy = 4; uiTex.generateMipmaps = true; uiTex.minFilter = THREE.LinearMipmapLinearFilter;
  const ch = buildCharacter(uiTex); ch.root.position.copy(SEAT); scene.add(ch.root);
  // free left fist (used when one hand lets go of the phone)
  const fist = new THREE.Mesh(ch.hands[0].palm.geometry, ch.hands[0].palm.material); fist.castShadow = true; ch.root.add(fist); fist.visible = false;

  // props
  const bubMom = makeTypingBubble({ color: 0xf4f6fb, dot: 0x8a93a8, who: 'mom', label: 'Mom is typing…' }); scene.add(bubMom);
  const bubDad = makeTypingBubble({ color: 0x2b3145, dot: 0xe8ecf5, who: 'dad', label: 'Dad is typing…', emissive: 0.15 }); scene.add(bubDad);
  const dog = makeChihuahua(); dog.position.set(0.02, BED.top + 0.045, -1.18); dog.rotation.y = 0.3; dog.scale.setScalar(1.25); scene.add(dog);
  const DIO = V(40, 0, 0); const dio = makeDiorama(); dio.position.copy(DIO); scene.add(dio);
  const sparkles = makeSparkles(); scene.add(sparkles);
  const buzz = makeBuzz(); ch.phone.add(buzz); buzz.position.z = -0.012;
  // slow-motion sweat drops for the horror dolly
  const sdG = new THREE.IcosahedronGeometry(1, 1); sdG.scale(0.75, 1.25, 0.75);
  const slowDrops = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(sdG, new THREE.MeshStandardMaterial({ color: 0xd8f1ff, emissive: 0x7fbfe8, emissiveIntensity: 0.7, roughness: 0.05, flatShading: true })); scene.add(m); return m; });

  // ---- static UI rects (dp) used for camera targets and thumb choreography
  const FULL = { x: 0, y: 0, w: UI.W, h: UI.H };
  const snap = (t) => JSON.parse(JSON.stringify(ui.draw(t, FULL)));
  const RM = snap(17.0), RS = snap(23.6), RL = snap(27.0), RR = snap(31.0), RT = snap(10.5);
  const cen = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const DEL = cen(RM.del), PINR = cen(RM.row3), COPYR = cen(RM.row2);
  const TAPS = [{ t: T.TAPS[0], x: PINR[0] - 30, y: PINR[1] + 6, row: 3 }, { t: T.TAPS[1], x: DEL[0] + 52, y: DEL[1] + 46 }, { t: T.TAPS[2], x: COPYR[0] + 26, y: COPYR[1] + 10, row: 2 }, { t: T.TAPS[3], x: DEL[0] - 74, y: DEL[1] + 50 }, { t: T.PIN, x: PINR[0] + 8, y: PINR[1] + 2, row: 3 }];
  ui.setTaps(TAPS);
  const dp2l = (x, y, z = 0) => V((x / UI.W - 0.5) * PHONE.SW, (0.5 - y / UI.H) * PHONE.SH, PHONE.T / 2 + z);
  // keyboard key positions (dp), mirrors ui.js layout
  const KEYS = keyTimes().map((k) => {
    const ky = UI.H - 262; let x = 180, y = ky + 10 + 3 * 54 + 22;
    ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'].forEach((row, ri) => { const i = row.indexOf(k.ch); if (i >= 0) { const total = row.length * 31.6 + (row.length - 1) * 4; x = (UI.W - total) / 2 + i * 35.6 + 15.8; y = ky + 10 + ri * 54 + 22; } });
    return { t: k.t, x, y, hand: x < 180 ? 0 : 1 };
  });
  KEYS.push({ t: T.SEND - 0.02, x: 328, y: UI.H - 262 - 56 + 28, hand: 1 });

  // ------------------------------------------------------------------ motion signals
  const RF = 2.6;
  const rockAmp = (t) => 1 - smooth(prog(t, 5.3, 5.95));
  const wave = (t) => Math.sin(TAU * RF * t) + 0.22 * Math.sin(2 * TAU * RF * t + 0.6);
  const wcos = (t) => Math.cos(TAU * RF * t);
  const tremor = (t, f = 17) => 0.6 * Math.sin(TAU * f * t) + 0.4 * Math.sin(TAU * f * 1.37 * t + 1.3);

  function thumbTyping(t, hand) {
    const rest = hand ? dp2l(292, 640, 0.012) : dp2l(68, 640, 0.012);
    const ks = KEYS.filter((k) => k.hand === hand); if (!ks.length) return rest;
    let prev = null, next = null; for (const k of ks) { if (k.t <= t) prev = k; else { next = k; break; } }
    const P = (k) => dp2l(k.x, k.y, 0.011);
    let pos; const a = prev ? P(prev) : rest;
    if (next) { const win = Math.min(0.13, prev ? (next.t - prev.t) : 0.3); pos = a.clone().lerp(P(next), ease.inOut(prog(t, next.t - win, next.t))); }
    else pos = a.clone().lerp(rest, ease.inOut(prog(t, prev.t + 0.12, prev.t + 0.5)));
    let dip = 0; for (const k of ks) dip = Math.max(dip, Math.exp(-(((t - k.t) / 0.035) ** 2)));
    pos.z -= dip * 0.008; return pos;
  }
  function thumbDelete(t) {
    const shakeK = lerp(7, 17, smooth(prog(t, 17.3, 17.9))) * (t > T.S6C ? 1.1 : 1);
    let x = DEL[0] + 30 + shakeK * Math.sin(TAU * 15 * t) + 5 * Math.sin(TAU * 2.1 * t), y = DEL[1] + 36 + shakeK * 0.75 * Math.sin(TAU * 12.4 * t + 1) + 4 * Math.sin(TAU * 1.3 * t + 2), z = 0.013 + 0.002 * Math.sin(TAU * 9 * t);
    for (const tp of TAPS) {
      const k = t < tp.t ? ease.in(prog(t, tp.t - 0.11, tp.t)) : 1 - ease.out(prog(t, tp.t + 0.05, tp.t + 0.2));
      if (k > 0) { x = lerp(x, tp.x + 2 * Math.sin(TAU * 15 * t), k); y = lerp(y, tp.y, k); z = lerp(z, 0.0025, k); }
    }
    return dp2l(x, y, z);
  }

  // ------------------------------------------------------------------ pose
  function headPosFor(pitch, headPitch) { return V(0, 0.555 * Math.cos(pitch) + 0.175 * Math.cos(pitch + headPitch), 0.006 + 0.555 * Math.sin(pitch) + 0.175 * Math.sin(pitch + headPitch)).add(SEAT); }
  const mix = (a, b, k) => { const o = { ...a }; for (const key in b) { const x = a[key], y = b[key]; if (typeof y === 'number' && typeof x === 'number') o[key] = lerp(x, y, k); else if (y && y.isVector3 && x && x.isVector3) o[key] = x.clone().lerp(y, k); else if (y && typeof y === 'object' && !y.isVector3 && x) o[key] = mix(x, y, k); else o[key] = k > 0.5 ? y : (x ?? y); } return o; };

  function poseAt(t) {
    const ld = loud(t); const amp = rockAmp(t); const tr = tremor(t), tr2 = tremor(t + 3.1, 13);
    const base = { pitch: 0.2, twist: 0, lean: 0, squash: 0, headPitch: 0.4, headYaw: 0, headRoll: 0, eyeOpen: 1, eyeSize: 1.1, eyeSlant: 0, browAngle: 0.3, browY: 0.004, lookX: 0, lookY: -0.6,
      mouth: { w: 0.036, open: 0.004, curve: -0.45, teeth: 0, teethBot: 0, sq: 0.55, skew: 0 }, flush: 0.3, sweat: 1, phonePos: V(0, 0.25, 0.46), phoneU: V(0, 1, 0), glow: 0.9, kneeL: 0, kneeR: 0,
      hairSway: 0, hairSwayZ: 0, earWob: 0, earFlap: 0, headSquash: 0, twitch: 0, browYR: 0, elbowOut: 0, sweatT: t, phoneRoll: 0 };
    let p;
    const rocking = (o) => {
      const w = wave(t) * amp, wl = wave(t - 0.07) * amp, wh = wcos(t - 0.1) * amp;
      return { ...o, pitch: o.pitch + o.rA * w, headPitch: o.headPitch + o.hA * wl, squash: 0.03 * wcos(t) * amp, headSquash: -0.02 * wcos(t - 0.05) * amp, hairSway: -0.28 * wh, earWob: 0.3 * wcos(t - 0.06) * amp, earFlap: 0.12 * wave(t - 0.1) * amp,
        kneeL: Math.max(0, Math.sin(TAU * RF * t)) * amp, kneeR: Math.max(0, Math.sin(TAU * RF * t + 2)) * amp };
    };
    if (t < T.S3) {
      const amp1 = 0.85 + 0.45 * ld;
      const a = rocking({ ...base, pitch: 0.1, rA: 0.17 * amp1, headPitch: -1.0, hA: -0.15, elbowOut: -0.5, eyeOpen: 0.13, eyeSize: 1.05, eyeSlant: -0.3, browAngle: -0.32, browY: -0.004, lookY: 0,
        mouth: { w: 0.05, open: 0.012 + 0.05 * ld, curve: -0.3, teeth: 0.8, teethBot: 0, sq: 0.5, skew: 0 }, flush: 1, phonePos: V(0, 0.02, 0.3), glow: 1.1 });
      const b = rocking({ ...base, pitch: 0.28, rA: 0.12, headPitch: 0.42, hA: 0.1, eyeOpen: 1.1, eyeSize: 1.3, browAngle: 0.45, browY: 0.02, lookY: -0.8,
        mouth: { w: 0.042, open: 0.022 + 0.035 * ld, curve: -0.55, teeth: 0.5, teethBot: 0, sq: 0.6, skew: 0 }, flush: 0.55, phonePos: V(0, 0.29, 0.4), glow: 1.2 });
      p = mix(a, b, smooth(prog(t, T.S2 + 0.05, T.S2 + 0.6)));
      p = mix(p, { ...base }, smooth(prog(t, 5.5, 5.95)));   // settle into the hunch before the OTS shot
    } else if (t < T.S5) {   // S3/S4 typing + send (phone shots)
      p = { ...base, pitch: 0.2 + 0.004 * tr, headPitch: 0.42 + 0.006 * tr2, thumbL: thumbTyping(t, 0), thumbR: thumbTyping(t, 1), hairSway: 0.02 * tr2, earWob: 0.03 * tr };
      p.phonePos = p.phonePos.clone().add(V(0.0006 * tr, 0.0005 * tr2, 0));
      p.mouth = { ...base.mouth, open: 0.004 + 0.02 * ld };
    } else if (t < T.S6) {   // S5 punch-ins
      const lvl = t < T.P2 ? 0 : t < T.P3 ? 1 : t < T.P4 ? 2 : 3; const t0 = [T.S5, T.P2, T.P3, T.P4][lvl]; const hit = impulse(t, t0, 0.02, 0.18);
      const tk = [0.3, 0.55, 0.85, 1.2][lvl];
      p = { ...base, pitch: 0.05 + 0.003 * tr * tk, headPitch: -0.03 - 0.05 * hit + 0.006 * tr2 * tk, headRoll: 0.008 * tr * tk, eyeOpen: 1.12, eyeSize: [1.1, 1.25, 1.4, 1.55][lvl] * (1 + 0.1 * hit), browAngle: 0.42, browY: 0.012 + lvl * 0.003, lookY: 0, lookX: 0.15 * tr2 * (lvl === 3 ? 1 : 0.3),
        mouth: { w: 0.034 - lvl * 0.002, open: 0.006 + 0.022 * ld + 0.003 * Math.abs(tr), curve: -0.6, teeth: 0, teethBot: 0, sq: 0.6, skew: 0.3 * tr2 }, flush: 0.35, phonePos: V(0.0008 * tr, 0.25 + 0.0008 * tr2, 0.38), glow: 1.3,
        hairSway: 0.03 * tr2 * tk - 0.1 * hit, earWob: 0.05 * tr * tk, earFlap: 0.05 * hit, headSquash: -0.03 * hit };
    } else if (t < T.S8) {   // S6 delete attempt, S7 seen-by (phone shots)
      const del = t < T.S7; const fl = del ? 0 : impulse(t, T.SEEN_DAD, 0.02, 0.2) + impulse(t, T.SEEN_UNCLE, 0.02, 0.2) + impulse(t, T.SEEN_GRANDMA, 0.02, 0.25);
      p = { ...base, pitch: 0.2 + 0.004 * tr, headPitch: 0.42, thumbR: del ? thumbDelete(t) : dp2l(356 + 2 * tr, 742 + 2 * tr2, 0.012), thumbL: dp2l(4 + 2 * tr2, 742 + 2 * tr, 0.012), hideHandR: !del };
      p.phonePos = p.phonePos.clone().add(V(0.0005 * tr, 0.0004 * tr2 + fl * 0.004, 0)); p.phoneRoll = fl * 0.02 * Math.sin(t * 60);
    } else if (t < T.S10) {   // S8/S9 frozen, typing bubbles
      const th = impulse(t, T.THUNDER, 0.02, 0.25); const d = pop(t, T.DAD_TYPING, 0.25);
      p = { ...base, pitch: 0.07, headPitch: 0.2 - 0.05 * th, eyeOpen: 1.12, eyeSize: 1.35 + 0.25 * d, browAngle: 0.4, browY: 0.016 + 0.006 * d, lookY: -0.9, mouth: { w: 0.03, open: 0.003 + 0.002 * Math.abs(tr), curve: -0.5, teeth: 0, teethBot: 0, sq: 0.6, skew: 0 },
        flush: 0.25, phonePos: V(0, 0.33, 0.37), glow: 1.6, headSquash: -0.04 * th, earFlap: 0.1 * th, hairSway: -0.12 * th, squash: -0.02 * th };
    } else if (t < T.S11B) {   // S10a / S11a phone shots (+ diorama cutaway)
      p = { ...base, pitch: 0.2 + 0.003 * tr, headPitch: 0.42, thumbR: dp2l(356 + 2 * tr, 744 + 2 * tr2, 0.012), thumbL: dp2l(4 + 2 * tr2, 744 + 2 * tr, 0.012), hideHandR: true };
      p.phonePos = p.phonePos.clone().add(V(0.0004 * tr, 0.0004 * tr2, 0));
    } else if (t < T.S12) {   // S11b confused slow blink
      const bl = t < 31.78 ? ease.inOut(prog(t, 31.36, 31.6)) : 1 - ease.inOut(prog(t, 31.84, 32.06)); const look = smooth(prog(t, 32.1, 32.3));
      p = { ...base, pitch: 0.06, headPitch: lerp(0.16, 0.02, look), headRoll: 0.13 - 0.05 * look, headYaw: -0.06, eyeOpen: lerp(1.05, 0.1, bl), eyeSize: 1.2, browAngle: 0.12, browY: 0.01, browYR: 0.022, lookY: lerp(-0.8, 0, look), lookX: 0,
        mouth: { w: 0.026, open: 0.003 + 0.012 * ld, curve: -0.15, teeth: 0, teethBot: 0, sq: 0.6, skew: 1.2 }, flush: 0.5, phonePos: V(0, 0.3, 0.38), glow: 1.25 };
    } else if (t < T.S13) {   // S12 horror dolly
      const k = prog(t, T.S12, T.S13); const tk = 0.6 + k * 1.2; const chat = Math.abs(Math.sin(TAU * 9 * t));
      p = { ...base, pitch: 0.06 + 0.004 * tr * tk, headPitch: 0.1 + 0.007 * tr2 * tk, headRoll: 0.01 * tr * tk, eyeOpen: 1.15, eyeSize: 1.5 + 0.3 * k, browAngle: 0.5, browY: 0.02, lookY: 0.0, lookX: 0.2 * tr2,
        mouth: { w: 0.04, open: 0.012 + 0.012 * chat + 0.02 * ld, curve: -0.75, teeth: 0.9, teethBot: 0.9, sq: 0.45, skew: 0.4 * tr }, flush: 0.15, sweat: 1.5, sweatT: T.S12 + (t - T.S12) * 0.35, phonePos: V(0.001 * tr, 0.3 + 0.001 * tr2, 0.38), glow: 0.9,
        hairSway: 0.04 * tr2 * tk, earWob: 0.07 * tr * tk };
    } else {   // S13 genius
      const k = t - T.S13; const tw = Math.pow(Math.max(0, Math.sin(TAU * 4.6 * k + 0.4)), 3) * (0.7 + 0.3 * Math.sin(TAU * 21 * k)); const bz = (Math.sin(TAU * 2.6 * k) > -0.2 ? 1 : 0);
      p = { ...base, pitch: 0.03 + 0.002 * tr, headPitch: -0.02, headRoll: -0.05 + 0.006 * tr2, headYaw: 0.03, eyeOpen: 1.0, eyeSize: 1.25, browAngle: 0.38, browY: 0.016, lookY: 0, lookX: 0, twitch: tw,
        mouth: { w: 0.078, open: 0.03 + 0.003 * tr, curve: 0.85, teeth: 1, teethBot: 1, sq: 0.3, skew: 0.3 * tr2 }, flush: 0.45, glow: 1.0,
        phonePos: V(-0.125 + 0.0016 * bz * Math.sin(TAU * 31 * k), 0.5 + 0.0012 * bz * Math.sin(TAU * 27 * k), 0.27), phoneRoll: 0.28 + 0.03 * bz * Math.sin(TAU * 31 * k), phoneNfix: V(0.45, 0.2, -0.87), phoneU: V(0, 1, 0), freeL: V(-0.12, 0.06, 0.3), elbowOut: 0.2, buzz: bz,
        hairSway: 0.02 * tr2, earWob: 0.03 * tr, sweat: 1.15 };
    }
    // phone screen faces the eyes
    const hp = headPosFor(p.pitch, p.headPitch).sub(SEAT);
    p.phoneN = p.phoneNfix ? p.phoneNfix : hp.clone().add(V(0, 0.03, 0.1)).sub(p.phonePos);
    return p;
  }

  // ------------------------------------------------------------------ cameras
  const orbit = (target, az, el, dist) => { const a = rad(az), e = rad(el); return target.clone().add(V(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)).multiplyScalar(dist)); };
  const frameH = (dist, fov) => 2 * dist * Math.tan(rad(fov / 2));
  // place `point` at fraction f (from bottom) of the frame
  const framed = (point, f, dist, fov, az, el) => { const target = point.clone().add(V(0, (0.5 - f) * frameH(dist, fov), 0)); return { pos: orbit(target, az, el, dist), target, fov }; };
  function phoneCam(cx, cy, wdp, dist = 0.25, tiltYaw = 0, tiltPitch = 0, roll = 0) {
    const hgt = wdp * DP * 16 / 9; const fov = THREE.MathUtils.radToDeg(2 * Math.atan(hgt / 2 / dist));
    const l = dp2l(cx, cy); const posL = V(l.x + Math.tan(tiltYaw) * dist, l.y + Math.tan(tiltPitch) * dist, PHONE.T / 2 + dist);
    const m = ch.phone.matrixWorld; const up = V(Math.sin(roll), Math.cos(roll), 0).transformDirection(m);
    return { pos: posL.applyMatrix4(m), target: l.applyMatrix4(m), up, fov, phone: true };
  }
  const lerpCam = (a, b, k) => ({ pos: a.pos.clone().lerp(b.pos, k), target: a.target.clone().lerp(b.target, k), up: (a.up || V(0, 1, 0)).clone().lerp(b.up || V(0, 1, 0), k).normalize(), fov: lerp(a.fov, b.fov, k), phone: k > 0.5 });
  const headW = () => ch.skull.getWorldPosition(V());
  const BUB = { mom: V(), dad: V(), momS: 0, dadS: 0 };

  function shotAt(t) {
    const s = { fx: { dof: 5, dofRange: 0.5, bloom: 1, vignette: 0.55 }, mb: 1, drift: 1, shake: 0, hideHead: false, lights: {}, vis: {} };
    const head = headW();
    if (t < T.S3) {
      // S1 overhead chest-up -> S2 pull up + swing to wide side
      const e = ease.inOut(prog(t, T.S2, T.S2 + 0.95)); const amp = rockAmp(t);
      const neutral = headPosFor(0.1, -1.0); const tgt1 = neutral.clone().lerp(head, 0.88).add(V(0, -0.075, 0.03));
      const tgt2 = V(-0.3, 0.86, -0.52);
      const target = tgt1.clone().lerp(tgt2, e); const az = lerp(0, 57, e), el = lerp(52, 8, e), dist = lerp(0.98, 2.86, e) - 0.14 * ease.out(prog(t, T.S2 + 0.9, T.S3 + 0.2)) - 0.05 * prog(t, 0, T.S2), fov = lerp(33, 40, e);
      s.cam = { pos: orbit(target, az, el, dist), target, fov };
      s.roll = (0.014 * wave(t - 0.05) + 0.01 * Math.sin(t * 1.3)) * amp * (1 - e * 0.7);
      s.kick = V(0, 0.012 * wave(t - 0.03) * amp * (1 - e * 0.6), 0);
      s.focusPoint = head; s.fx.dof = lerp(6, 4, e); s.fx.dofRange = 0.4; s.lights.key = 1 - e; s.mb = (e > 0.02 && e < 0.98) ? 3 : 1; s.safety = e < 0.001;
    } else if (t < T.S5) {
      // S3 over-the-shoulder push-in -> S4 send, whip to header, FAMILY zoom
      const camA = { pos: V(0.5, 0.86, -0.04).add(SEAT), target: ch.phone.getWorldPosition(V()).add(V(-0.02, 0.03, 0)), up: V(0, 1, 0), fov: 36 };
      const e = ease.inOut(prog(t, T.S3 + 0.05, 7.25));
      const sendK = ease.outBack(prog(t, T.SEND, T.SEND + 0.34), 1.6); const whip = ease.inOutQuint(prog(t, T.WHIP, T.WHIP + 0.32)); const zoom = ease.outBack(prog(t, T.FAMILY, T.FAMILY + 0.36), 2.2);
      const tc = cen(RT.title);
      const cx = lerp(180, tc[0] + 4, whip); let cy = lerp(lerp(lerp(548, 520, prog(t, 7.25, 8.9)), 430, sendK), tc[1] + 30, whip);
      let wdp = lerp(lerp(lerp(352, 330, prog(t, 7.25, 8.9)), 372, sendK), 300, whip); wdp = lerp(wdp, 150, zoom);
      const beats = impulse(t, T.BEAT1, 0.03, 0.2) + impulse(t, T.BEAT2, 0.03, 0.2) + impulse(t, T.BEAT3, 0.03, 0.2);
      wdp *= 1 - 0.09 * beats; wdp *= 1 - 0.05 * prog(t, T.FAMILY + 0.4, T.S5); cy -= lerp(0, 14, zoom);
      const camB = phoneCam(cx, cy, wdp, 0.25, 0.05 * (1 - zoom), -0.1 * (1 - whip), 0.02 * Math.sin(t * 0.9) + 0.05 * (whip - whip * whip) * 4);
      s.cam = e >= 1 ? camB : lerpCam(camA, camB, e); s.phone = e > 0.5; s.hideHead = e > 0.45;
      s.focusPoint = s.cam.target; s.fx.dof = lerp(7, 5, e); s.fx.dofRange = 0.35;
      s.mb = (t > T.WHIP - 0.02 && t < T.WHIP + 0.4) || (t > T.SEND - 0.02 && t < T.SEND + 0.3) ? 3 : 1;
      s.fx.vigColAmt = 0.6 * Math.min(1, beats) + 0.12 * zoom; s.fx.vigCol = 0xff1028; s.fx.flashAmt = 0.16 * impulse(t, T.BEAT1, 0.02, 0.12) + 0.1 * impulse(t, T.BEAT2, 0.02, 0.1) + 0.1 * impulse(t, T.BEAT3, 0.02, 0.1); s.fx.flashCol = 0xff2030;
      s.shake = 0.6 * beats + 0.5 * impulse(t, T.SEND + 0.02, 0.02, 0.12); s.drift = lerp(1, 0.25, e);
    } else if (t < T.S6) {
      const lvl = t < T.P2 ? 0 : t < T.P3 ? 1 : t < T.P4 ? 2 : 3; const t0 = [T.S5, T.P2, T.P3, T.P4][lvl];
      const dist = [1.95, 1.36, 0.98, 0.6][lvl] * (1 + 0.13 * (1 - spring(t - t0, 4.5, 11))) * (1 - 0.03 * prog(t, t0, t0 + 1.2));
      const eyeP = head.clone().add(V(0, 0.03, 0.12)); const pt = lvl === 3 ? eyeP : head; const f = [0.585, 0.6, 0.665, 0.6][lvl];
      s.cam = framed(pt, f, dist, 30, [-7, 5, -4, 3][lvl], [-3, -2, -1, 0][lvl]); s.focusPoint = eyeP; s.fx.dof = [5, 6, 7, 8][lvl]; s.fx.dofRange = 0.35;
      s.shake = impulse(t, t0, 0.01, 0.16) * (0.7 + lvl * 0.25); s.mb = t - t0 < 0.15 ? 2 : 1; s.fx.vigColAmt = 0.08 * lvl * impulse(t, t0, 0.02, 0.5); s.fx.vigCol = 0xff1028;
    } else if (t < T.DOG) {
      const k = prog(t, T.S6, T.DOG);
      s.cam = phoneCam(lerp(246, 240, k), DEL[1] + lerp(22, 14, k), lerp(236, 214, ease.out(k)), 0.2, 0.1, -0.22, -0.03); s.phone = true; s.hideHead = true; s.focusPoint = s.cam.target; s.fx.dof = 5; s.fx.dofRange = 0.3; s.mb = 3; s.drift = 0.2;
      s.shake = 0.35 * TAPS.reduce((a, tp) => a + impulse(t, tp.t, 0.01, 0.08), 0);
    } else if (t < T.S6C) {
      const k = prog(t, T.DOG, T.S6C); const dpos = dog.position.clone().add(V(0, 0.2, 0.03));
      s.cam = framed(dpos, 0.57, lerp(0.78, 0.66, ease.out(k)), 30, 24, 7); s.focusPoint = dpos.clone().add(V(0, 0.05, 0.1)); s.fx.dof = 9; s.fx.dofRange = 0.25; s.mb = 2; s.vis.dog = true; s.drift = 0.5;
    } else if (t < T.S7) {
      const k = prog(t, T.S6C, T.S7);
      s.cam = phoneCam(238, DEL[1] + 6, lerp(205, 196, k), 0.2, 0.1, -0.22, -0.03); s.phone = true; s.hideHead = true; s.focusPoint = s.cam.target; s.fx.dof = 5; s.fx.dofRange = 0.3; s.mb = 3; s.drift = 0.2;
      s.shake = 0.9 * impulse(t, T.PIN, 0.01, 0.12);
    } else if (t < T.S8) {
      const sc = cen(RS.seen); const g = RS.seen_grandma; const gk = ease.inOut(prog(t, T.SEEN_GRANDMA - 0.12, T.SEEN_GRANDMA + 0.2));
      const bump = impulse(t, T.SEEN_DAD, 0.02, 0.2) + impulse(t, T.SEEN_UNCLE, 0.02, 0.2) + impulse(t, T.SEEN_GRANDMA, 0.02, 0.25);
      const u = prog(t, T.S7, T.S8);
      const cx = lerp(sc[0], g.x - 14, gk), cy = lerp(sc[1] + 30, g.y + 24, gk), wdp = lerp(lerp(262, 248, u), 172, gk) * (1 - 0.05 * bump);
      s.cam = phoneCam(cx, cy, wdp, 0.24, -0.05, -0.14, 0.02); s.phone = true; s.hideHead = true; s.focusPoint = s.cam.target; s.fx.dof = 5; s.fx.dofRange = 0.3; s.drift = 0.25; s.shake = 0.5 * bump; s.mb = bump > 0.3 ? 2 : 1;
    } else if (t < T.S10) {
      const k = prog(t, T.S8, T.S10); const hn = headPosFor(0.07, 0.2);
      s.cam = framed(hn, 0.495, lerp(2.42, 2.25, ease.out(k)), 32, 7, -4); s.focusPoint = hn.clone().add(V(0, 0, 0.15)); s.fx.dof = 4; s.fx.dofRange = 0.6;
      s.vis.mom = true; s.vis.dad = t >= T.DAD_TYPING; s.shake = 0.5 * impulse(t, T.DAD_TYPING, 0.02, 0.15) + 0.5 * impulse(t, T.THUNDER, 0.02, 0.2);
      const dk = smooth(prog(t, T.DAD_TYPING - 0.05, T.DAD_TYPING + 0.25));
      BUB.mom.copy(hn).add(V(lerp(0.03, -0.17, dk), lerp(0.56, 0.635, dk), lerp(0.02, -0.06, dk))); BUB.momS = lerp(0.44, 0.25, dk) * pop(t, T.MOM_TYPING - 0.02, 0.34);
      BUB.dad.copy(hn).add(V(0.09, 0.56, 0.06)); BUB.dadS = 0.45 * pop(t, T.DAD_TYPING, 0.36);
      const fl = Math.max(impulse(t, T.THUNDER, 0.015, 0.07), 0.8 * impulse(t, T.THUNDER + 0.16, 0.015, 0.16));
      s.lights.flash = fl; s.fx.white = 0.1 * fl; s.lights.dim = 0.25 * dk;
    } else if (t < T.S10B) {
      const c0 = cen(RL.left); const k = prog(t, T.S10, T.S10B);
      s.cam = phoneCam(c0[0], c0[1] + 44, lerp(262, 240, ease.out(k)), 0.24, 0.04, -0.14, -0.02); s.phone = true; s.hideHead = true; s.focusPoint = s.cam.target; s.fx.dof = 5; s.fx.dofRange = 0.3; s.drift = 0.25; s.shake = 0.3 * impulse(t, T.LEFT + 0.3, 0.02, 0.12);
    } else if (t < T.S11) {
      const k = prog(t, T.S10B, T.S11); const sh = impulse(t, T.SLAM, 0.01, 0.16);
      s.cam = framed(DIO.clone().add(V(0, 1.02, 0)), 0.5, lerp(4.5, 4.25, ease.out(k)) * (1 - 0.04 * sh), 30, 6, 3); s.focusPoint = DIO.clone().add(V(0, 0.9, 0.2)); s.fx.dof = 3; s.fx.dofRange = 0.6;
      s.vis.dio = true; s.shake = 1.6 * sh; s.mb = (t > T.SLAM - 0.16 && t < T.SLAM + 0.1) ? 3 : 1; s.drift = 0.6;
    } else if (t < T.S11B) {
      const c0 = cen(RR.reply); const k = prog(t, T.S11, T.S11B); const rp = impulse(t, T.MOM_REPLY, 0.02, 0.2);
      s.cam = phoneCam(c0[0] - 14, c0[1] + 50, lerp(318, 280, ease.inOut(k)) * (1 - 0.04 * rp), 0.24, -0.04, -0.14, 0.015); s.phone = true; s.hideHead = true; s.focusPoint = s.cam.target; s.fx.dof = 5; s.fx.dofRange = 0.3; s.drift = 0.25;
      const w = smooth(prog(t, T.MOM_REPLY, T.MOM_REPLY + 0.5)); s.fx.tint = new THREE.Color().setRGB(1 + 0.05 * w, 1, 1 + 0.02 * w);
    } else if (t < T.S12) {
      const k = prog(t, T.S11B, T.S12); const hn = headPosFor(0.06, 0.1); const sp = 1 - smooth(prog(t, 32.0, 32.4));
      s.cam = framed(hn, 0.62, lerp(1.22, 1.14, k), 30, -6, -2); s.focusPoint = hn.clone().add(V(0, 0, 0.14)); s.fx.dof = 7; s.fx.dofRange = 0.35; s.vis.sparkles = true;
      s.lights.pink = sp; s.fx.bloom = 1 + 0.5 * sp;
    } else if (t < T.S13) {
      const k = prog(t, T.S12, T.S13); const hn = headPosFor(0.06, 0.1); const red = smooth(prog(t, T.S12 - 0.02, T.S12 + 0.45));
      const e = ease.inOut(k);
      s.cam = framed(hn, lerp(0.43, 0.6, e), lerp(2.8, 1.12, e), 31, lerp(-3, 2, e), lerp(-5, -2, e)); s.focusPoint = hn.clone().add(V(0, 0, 0.14)); s.fx.dof = 4; s.fx.dofRange = 0.7;
      s.roll = 0.05 * e; s.lights.red = red; s.vis.dadBig = true; s.fx.vigCol = 0x7a0008; s.fx.vignette = 0.75; s.fx.ca = 0.05 * red;
      const hb = (x) => impulse(x % 0.62, 0, 0.03, 0.09) + 0.7 * impulse((x + 0.44) % 0.62, 0, 0.03, 0.08); s.heart = hb(t - T.DAD_AGAIN + 0.62);
      s.shake = 0.18 * s.heart; s.fx.vigColAmt = 0.3 * red + 0.12 * s.heart;
    } else {
      const k = prog(t, T.S13, T.S13 + 1.0); const hn = headPosFor(0.03, -0.02);
      s.cam = framed(hn, 0.635, 1.42 * (1 + 0.06 * (1 - spring(t - T.S13, 4, 10))) - 0.03 * k, 31, 0, -1); s.focusPoint = hn.clone().add(V(0, 0, 0.14)); s.fx.dof = 6; s.fx.dofRange = 0.4; s.shake = 0.5 * impulse(t, T.S13, 0.01, 0.12); s.vis.buzz = true;
    }
    return s;
  }

  // ------------------------------------------------------------------ per-(sub)frame scene evaluation
  const camQ = new THREE.Quaternion();
  function evaluate(t) {
    const p = poseAt(t);
    ch.update(p, p.sweatT);
    if (p.freeL) { ch.hands[0].h.visible = false; fist.visible = true; fist.position.copy(p.freeL).add(V(0, -0.02, 0.03)); fist.rotation.set(1.2, 0, 0.3); } else { ch.hands[0].h.visible = true; fist.visible = false; }
    ch.root.updateMatrixWorld(true);
    const s = shotAt(t);
    // camera (+ gentle perpetual drift, impact shake)
    const c = s.cam; const dist = c.pos.distanceTo(c.target);
    const d = s.drift * 0.006 * Math.max(dist, 0.15);
    const pos = c.pos.clone().add(V(fbm1(t * 0.35, 1) * d, fbm1(t * 0.31, 2) * d, fbm1(t * 0.27, 3) * d));
    const target = c.target.clone().add(V(fbm1(t * 0.3, 4) * d * 0.6, fbm1(t * 0.33, 5) * d * 0.6, 0));
    if (s.kick) target.add(s.kick);
    if (s.shake > 0.001) { const a = s.shake * 0.012 * dist; target.add(V(Math.sin(t * 91) * a, Math.sin(t * 77 + 1) * a, 0)); pos.add(V(Math.sin(t * 83 + 2) * a * 0.5, Math.sin(t * 69) * a * 0.5, 0)); }
    camera.position.copy(pos); camera.up.copy(c.up || V(0, 1, 0)); camera.fov = c.fov; camera.near = c.phone ? 0.02 : 0.08; camera.far = 40; camera.updateProjectionMatrix(); camera.lookAt(target);
    const roll = (s.roll || 0) + fbm1(t * 0.22, 6) * 0.006 * s.drift + (s.shake > 0.001 ? Math.sin(t * 60) * 0.006 * s.shake : 0); if (roll) camera.rotateZ(roll);
    camera.updateMatrixWorld(true);
    s.fx.focus = Math.max(0.05, s.focusPoint.clone().sub(camera.position).dot(camera.getWorldDirection(V())));
    // visibility + props
    ch.skull.visible = !s.hideHead;
    dog.visible = !!s.vis.dog; if (dog.visible) dog.update(t, 1);
    dio.visible = !!s.vis.dio; if (dio.visible) dio.update(t, T.S10B, T.SLAM);
    camera.getWorldQuaternion(camQ);
    bubMom.visible = !!s.vis.mom; bubDad.visible = !!(s.vis.dad || s.vis.dadBig);
    if (bubMom.visible) { bubMom.position.copy(BUB.mom); bubMom.position.y += Math.sin(t * 2.1) * 0.006; bubMom.scale.setScalar(Math.max(BUB.momS, 1e-4)); bubMom.quaternion.copy(camQ); bubMom.rotateZ(Math.sin(t * 1.7) * 0.02 - 0.03); bubMom.rotateY(0.12); bubMom.update(t, T.MOM_TYPING, 5); }
    if (s.vis.dad) { bubDad.position.copy(BUB.dad); bubDad.position.y += Math.sin(t * 1.9 + 1) * 0.006; bubDad.scale.setScalar(Math.max(BUB.dadS, 1e-4)); bubDad.quaternion.copy(camQ); bubDad.rotateZ(Math.sin(t * 1.5) * 0.02 + 0.03); bubDad.rotateY(-0.12); bubDad.update(t, T.DAD_TYPING, 5); bubDad.userData.bodyM.emissive.set(0x2b3145); bubDad.userData.bodyM.emissiveIntensity = 0.15; }
    if (s.vis.dadBig) {
      const hn = headPosFor(0.06, 0.1); const a = pop(t, T.DAD_AGAIN - 0.04, 0.4); const hbt = s.heart || 0;
      bubDad.position.copy(hn).add(V(0.06, 0.86 + Math.sin(t * 1.4) * 0.01, -0.6)); bubDad.scale.setScalar(Math.max(1.0 * a * (1 + 0.07 * hbt), 1e-4)); bubDad.quaternion.copy(camQ); bubDad.rotateZ(Math.sin(t * 1.2) * 0.02); bubDad.update(t, T.DAD_AGAIN, 3.2);
      bubDad.userData.bodyM.emissive.set(0xff1a22); bubDad.userData.bodyM.emissiveIntensity = 0.12 + 0.5 * hbt;
    }
    sparkles.visible = !!s.vis.sparkles; if (sparkles.visible) sparkles.update(t, T.S11B - 0.05, headPosFor(0.06, 0.1), camQ);
    buzz.visible = !!(s.vis.buzz && p.buzz); if (buzz.visible) buzz.update(t);
    slowDrops.forEach((m, i) => {
      m.visible = !!s.vis.dadBig; if (!m.visible) return; const hn = headW(); const per = 1.5 + i * 0.37; const u = (((t - T.S12) / per + i * 0.31) % 1 + 1) % 1; const side = i % 2 ? 1 : -1;
      m.position.set(hn.x + side * (0.13 + 0.03 * (i > 1 ? 1 : 0)), hn.y - 0.06 - u * u * 0.34, hn.z + 0.13 + i * 0.012); const sc = 0.012 * (0.8 + 0.3 * hash1(i)) * Math.min(1, u * 8) * (u > 0.9 ? (1 - u) * 10 : 1); m.scale.setScalar(Math.max(sc, 1e-5));
    });
    // lights
    const red = s.lights.red || 0, dim = s.lights.dim || 0, fl = s.lights.flash || 0, pink = s.lights.pink || 0;
    const roomOn = !s.vis.dio;
    L.lamp.visible = roomOn; L.lampGlow.visible = roomOn; L.moon.visible = roomOn; L.fill.visible = roomOn; L.bounce.visible = roomOn; ch.glow.visible = roomOn; dio.userData.light.visible = !roomOn; dio.userData.fillL.visible = !roomOn;
    const flick = 1 + 0.015 * Math.sin(t * 23) + 0.01 * Math.sin(t * 51 + 1);
    L.lamp.intensity = 15 * flick * (1 - 0.82 * red) * (1 - 0.3 * dim); L.lamp.color.setHex(0xffc48a).lerp(new THREE.Color(0xff3020), red * 0.7).lerp(new THREE.Color(0xff9ec0), pink * 0.25);
    L.lampGlow.intensity = 1.3 * flick * (1 - 0.7 * red); L.key.intensity = 0.55 * (1 + 1.3 * (s.lights.key || 0)) * (1 - 0.8 * red) * (1 - 0.3 * dim); L.hemi.intensity = (roomOn ? 0.75 : 1.2) * (1 - 0.6 * red) * (1 - 0.25 * dim); L.moon.intensity = 9 * (1 - 0.5 * red); L.fill.intensity = 1.0 * (1 - 0.7 * red) + 2.5 * pink; L.fill.color.setHex(0x7b8cff).lerp(new THREE.Color(0xff8fc0), pink);
    L.bounce.intensity = 0.5 * (1 - 0.6 * red); L.red.intensity = 26 * red * (1 + 0.25 * (s.heart || 0)); L.flash.intensity = 7 * fl; room.nightMat.color.setRGB(0.5 + 9 * fl, 0.55 + 9 * fl, 0.75 + 10 * fl);
    room.bulb.material.color.setRGB(6 * (1 - 0.6 * red), 3.6 * (1 - 0.8 * red), 1.6 * (1 - 0.8 * red));
    ch.glow.intensity = 0.95 * (p.glow ?? 0.9) * (s.phone ? 0.55 : 1);
    L.red.visible = red > 0.001; L.flash.visible = fl > 0.001; L.bounce.visible = roomOn && !s.phone;
    return { p, s };
  }

  // ---- UI region-of-interest: draw only what the camera sees, at full texture resolution (keeps text razor sharp in zooms)
  const ray = new THREE.Raycaster(); const plane = new THREE.Plane();
  function computeROI(isPhone) {
    if (!isPhone) return FULL;
    const m = ch.phone.matrixWorld; const n = V(0, 0, 1).transformDirection(m); const o = V(0, 0, PHONE.T / 2).applyMatrix4(m); plane.setFromNormalAndCoplanarPoint(n, o);
    const inv = m.clone().invert(); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const hit = V();
    for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) {
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera); if (!ray.ray.intersectPlane(plane, hit)) return FULL; hit.applyMatrix4(inv);
      const x = (hit.x / PHONE.SW + 0.5) * UI.W, y = (0.5 - hit.y / PHONE.SH) * UI.H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const mx = (x1 - x0) * 0.08 + 6, my = (y1 - y0) * 0.08 + 6; x0 -= mx; x1 += mx; y0 -= my; y1 += my;
    let w = x1 - x0, h = y1 - y0; const asp = UI.W / UI.H; if (w / h > asp) h = w / asp; else w = h * asp;
    if (w >= UI.W) return FULL;
    w = Math.max(w, 60); h = w / asp; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return { x: clamp(cx - w / 2, 0, UI.W - w), y: clamp(cy - h / 2, 0, UI.H - h), w, h };
  }

  const violations = [];
  function safetyCheck(t) {   // opening shot must stay chest-up: nothing below the chest may enter frame
    const pts = [ch.phone.getWorldPosition(V()), V(0.11, -0.03, 0.4).add(SEAT), V(-0.11, -0.03, 0.4).add(SEAT)];
    ch.hands.forEach((h, i) => { const w = h.wrist.clone().applyMatrix4(ch.phone.matrixWorld); const e = ch.arms[i].elbow.getWorldPosition(V()); pts.push(w, w.clone().lerp(e, 0.45)); });
    for (const pnt of pts) { const n = pnt.clone().project(camera); if (Math.abs(n.x) < 1.0 && n.y > -1.0 && n.y < 1 && n.z < 1) { violations.push(t.toFixed(3)); break; } }
  }

  let uiMode = 0, pending = null;
  window.TOTAL_FRAMES = TOTAL_FRAMES;
  window.flush = async () => { await pending; };
  window.safetyScan = () => { violations.length = 0; for (let f = 0; f < T.S2 * FPS; f++) { const { s } = evaluate(f / FPS); if (s.safety) safetyCheck(f / FPS); } return violations.slice(); };
  window.VIOLATIONS = violations;
  window.renderFrame = async (f) => {
    const t = f / FPS; const P0 = performance.now(); if (DEBUG.includes('prof')) pipe.prof = {};
    const { s } = evaluate(t);
    if (s.safety) safetyCheck(t);
    const roi = computeROI(s.phone);
    const P1 = performance.now();
    // phone close-ups: ROI maps ~1:1 so skip mipmaps and refresh every frame; elsewhere the phone is tiny -> mipmapped, refreshed at 10fps
    const mode = s.phone ? 1 : 2; const need = s.phone || mode !== uiMode || f % 6 === 0;
    if (need) {
      ui.draw(t, roi); uiTex.generateMipmaps = !s.phone; uiTex.minFilter = s.phone ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
      uiTex.repeat.set(UI.W / roi.w, UI.H / roi.h); uiTex.offset.set(-roi.x / roi.w, -(1 - (roi.y + roi.h) / UI.H) * (UI.H / roi.h)); uiTex.needsUpdate = true; uiMode = mode;
    }
    const P2 = performance.now();
    const fx = { ...s.fx, seed: f % 997, grain: 0.03 };
    const n = DEBUG.includes('nomb') ? 1 : s.mb;
    pipe.render(scene, camera, fx, n, (k, nn) => { if (nn > 1) evaluate(t + ((k + 0.5) / nn - 0.5) * 0.55 / FPS); });
    octx.setTransform(1, 0, 0, 1, 0, 0); octx.drawImage(glc, 0, 0);
    if (!DEBUG.includes('nocap')) { octx.setTransform(SCALE, 0, 0, SCALE, 0, 0); drawCaptions(octx, t, 1080, 1920); }
    const P3 = performance.now(); const img = octx.getImageData(0, 0, W, H); const P4 = performance.now();
    const prev = pending; pending = fetch('/frame?f=' + f, { method: 'POST', body: img.data.buffer }); await prev;
    if (pipe.prof) console.log('PROF', JSON.stringify({ eval: P1 - P0 | 0, ui: P2 - P1 | 0, ...Object.fromEntries(Object.entries(pipe.prof).map(([k, v]) => [k, v | 0])), draw2d: P3 - P2 | 0, read: P4 - P3 | 0, post: performance.now() - P4 | 0 }));
  };
  window.READY = true;
}
init().catch((e) => { console.error(e); window.FAILED = String(e.stack || e); });
