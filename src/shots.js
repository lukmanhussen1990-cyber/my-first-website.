// The shot list: for any time t returns the full scene state (camera, eyelids,
// phone, the woman's rigs, lights, twist). Pure function of t.
import { clamp, lerp, seg, smoothstep, easeInOutCubic, easeOutCubic, easeInOutSine, noise1, track } from './util.js';

export const EYE = [-0.83, 0.86, -1.16];
const PHONE_HAND = [-0.835, 1.05, -0.97];
const EYE_LOW = [-0.83, 0.78, -1.16];
const PHONE_CHEST = [-0.8, 0.676, -0.8];
const AISLE = { pos: [-1.98, 1.62, 0.72], look: [4.0, 0.78, 0.46] };
const HIGH = { pos: [-1.6, 2.15, 0.76], look: [2.5, 0.38, 0.62] };
const CHAIN = [-0.2, 1.585, -1.36];

const add = (a, b) => a.map((v, i) => v + b[i]);
const mix = (a, b, u) => a.map((v, i) => lerp(v, b[i], u));

export function sceneIndexAt(tl, t) {
  let i = 0;
  while (i < tl.scenes.length - 1 && t >= tl.scenes[i].end) i++;
  return i;
}

// Rail-joint bounce shared with the sound design (scripts/sfx.py).
export function railBounce(t, rail) {
  let y = 0;
  const k0 = Math.floor((t - rail.phase) / rail.period);
  for (let k = k0 - 1; k <= k0; k++) {
    for (const [j, off] of rail.hits.entries()) {
      const dt = t - (rail.phase + k * rail.period + off);
      if (dt >= 0 && dt < 0.6) y += (j ? 0.0012 : 0.0018) * Math.exp(-dt / 0.085) * Math.cos(dt * 2 * Math.PI * 7.5);
    }
  }
  return y;
}

export function scareEnvelope(t, tl) {
  let e = 0;
  for (const s of tl.scares) {
    const dt = t - s.time;
    if (dt < -0.03) continue;
    const env = dt < 0 ? (dt + 0.03) / 0.03 : Math.exp(-dt / 0.42);
    e = Math.max(e, env * s.strength);
  }
  return e;
}

function defaults() {
  return {
    cam: { pos: EYE, look: [0.8, 1.6, -0.6], up: [0, 1, 0], fov: 50, focus: 2, aperture: 0.25, maxBlur: 8, roll: 0 },
    lids: { gap: 2, center: 0.5, glow: 0, blur: 0 },
    phone: { mode: 'chest', on: 0, screen: 'lock', light: 1, buzz: 0, hand: false },
    woman: { lying: true, standing: null, face: null, hand: null },
    twist: 0,
    lights: { moon: 3.4, lamp: 6, lamp2: 4, lamp3: 4, hemi: 1.0 },
    shadow: { focus: [0.1, 1.1, -0.6], size: 4.2 },
    post: { bloom: 0.55, grain: 0.034, vignette: 0.5, fade: 0, exposure: 1.0 },
    breath: 1,
  };
}

// phone vibration: two pulses after `t0`
function buzz(lt, t0) {
  const d = lt - t0;
  if (d < 0 || d > 1.1) return 0;
  return (d < 0.38 || (d > 0.55 && d < 0.93)) ? 1 : 0;
}

const SHOTS = {
  s01(st, lt, sc, tl) {
    const ev = tl.events.find((e) => e.scene === 's01' && e.type === 'buzz');
    const tb = (ev ? ev.time : sc.start + 0.15) - sc.start;
    const on = smoothstep(tb + 0.08, tb + 0.3, lt);
    const u = easeInOutSine(seg(lt, 0, sc.duration));
    const dir = [PHONE_HAND[0] - EYE_LOW[0], PHONE_HAND[1] - EYE_LOW[1], PHONE_HAND[2] - EYE_LOW[2]];
    st.cam.pos = add(EYE_LOW, dir.map((v) => v * 0.08 * u));
    st.cam.look = add(PHONE_HAND, [0.01 * Math.sin(lt * 0.6), 0, 0.012]);
    st.cam.up = [0, 0, -1];
    st.cam.fov = 56 - 3 * u;
    st.cam.focus = 0.31;
    st.cam.aperture = 0.9;
    st.phone = { mode: 'hand', on, screen: 'lock', light: 1, buzz: buzz(lt, tb), hand: true };
    st.lights.hemi = lerp(0.5, 0.75, on);
    st.lights.lamp = 3.2;
    st.post.bloom = 0.45;
  },
  s02(st, lt, sc) {
    const u = easeInOutCubic(seg(lt, 0, sc.duration));
    const dir = [PHONE_HAND[0] - EYE_LOW[0], PHONE_HAND[1] - EYE_LOW[1], PHONE_HAND[2] - EYE_LOW[2]];
    st.cam.pos = add(EYE_LOW, dir.map((v) => v * (0.08 + 0.07 * u)));
    st.cam.look = add(PHONE_HAND, [0.006 * Math.sin(lt * 0.5), -0.004 * u, -0.012 - 0.01 * u]);
    st.cam.up = [0, 0, -1];
    st.cam.fov = 54 - 2 * u;
    st.cam.focus = 0.29;
    st.cam.aperture = 1.0;
    st.phone = { mode: 'hand', on: 1, screen: 'lock', light: 1, buzz: 0, hand: true };
    st.lights.hemi = 0.75;
    st.lights.lamp = 3.2;
    st.post.bloom = 0.35;
  },
  s03(st, lt, sc) {
    const u = easeInOutSine(seg(lt, 0, sc.duration));
    st.cam.pos = mix([-2.1, 1.66, 0.74], [-1.8, 1.6, 0.72], u);
    st.cam.look = mix([4.0, 0.9, 0.4], [4.0, 0.84, 0.5], u);
    st.cam.fov = 62;
    st.cam.focus = 3.2;
    st.cam.aperture = 0.22;
    st.phone = { mode: 'chest', on: 0.55, screen: 'lock', light: 0.7, buzz: 0, hand: false };
    st.shadow = { focus: [3.2, 1.0, -0.2], size: 8.5 };
    st.fog = true;
    st.farLamps = true;
    st.breath = 0;
  },
  s04(st, lt, sc) {
    const k = track(lt, [
      { t: 0, look: [0.85, 1.36, -0.62], fov: 52 },
      { t: 0.5, look: [0.85, 1.39, -0.62], fov: 52 },
      { t: Math.min(5.6, sc.duration - 0.8), look: [0.62, 2.1, -0.66], fov: 47 },
      { t: sc.duration, look: [0.62, 2.11, -0.64], fov: 46 },
    ]);
    st.cam.pos = add(EYE, [0.03, 0, 0.02]);
    st.cam.look = k.look;
    st.cam.fov = k.fov;
    st.cam.focus = 2.1;
    st.cam.aperture = 0.3;
  },
  s05(st, lt, sc, tl) {
    const hit = tl.events.find((e) => e.scene === 's05' && e.type === 'hit');
    const th = (hit ? hit.time : sc.start + 4) - sc.start;
    const k = track(lt, [
      { t: 0, look: [0.62, 2.11, -0.64], fov: 46 },
      { t: Math.min(3.2, th - 0.5), look: [0.68, 1.64, 0.42], fov: 33 },
      { t: sc.duration, look: [0.68, 1.62, 0.44], fov: 30 },
    ]);
    const punch = smoothstep(th - 0.02, th + 0.12, lt) * (1 - smoothstep(th + 0.2, th + 1.4, lt));
    st.cam.pos = add(EYE, [0.03, 0, 0.02]);
    st.cam.look = k.look;
    st.cam.fov = k.fov - 3.5 * punch;
    st.cam.focus = 2.35;
    st.cam.aperture = 0.5;
    st.lights.lamp = 6 + 2 * punch;
    st.woman.feetTwitch = lt >= th ? Math.exp(-(lt - th) / 0.35) * Math.sin((lt - th) * 38) : 0;
  },
  s06(st, lt, sc) {
    const close = easeInOutCubic(seg(lt, 0.35, 1.6));
    const blink = Math.exp(-(((lt - 1.75) / 0.12) ** 2));
    st.cam.pos = add(EYE, [0.03, 0, 0.02]);
    st.cam.look = mix([0.68, 1.62, 0.44], [0.64, 1.9, -0.4], easeInOutSine(seg(lt, 0.2, sc.duration)));
    st.cam.fov = lerp(30, 42, easeInOutSine(seg(lt, 0.2, sc.duration)));
    st.cam.focus = 1.4;
    st.cam.aperture = 0.45;
    st.lids.gap = lerp(1.6, 0.13, close) - 0.07 * blink;
    st.lids.blur = 0.35 * close;
  },
  s07(st, lt, sc) {
    const u = sc.duration;
    const down = easeInOutCubic(seg(lt, 0.25, u * 0.6));
    const near = easeInOutSine(seg(lt, u * 0.55, u));
    st.cam.pos = add(EYE, [0.03, 0, 0.02]);
    st.cam.look = [0.42, 1.36, -0.86];
    st.cam.fov = 42;
    st.cam.focus = lerp(1.6, 1.15, near);
    st.cam.aperture = 0.45;
    st.lids.gap = 0.2 + 0.012 * Math.sin(lt * 1.9);
    st.lids.blur = 0.3;
    st.woman.lying = false;
    const head = [lerp(0.6, 0.48, down) - 0.36 * near, lerp(2.05, 1.4, down) - 0.1 * near, lerp(-0.84, -0.86, down) - 0.08 * near];
    st.woman.face = { pos: head, look: add(EYE, [0.25, 0, 0.25]), up: [0, 1, 0], pupil: 1, hairAmp: 1.0, veil: true };
    st.lights.moon = 4.2;
    st.post.exposure = 1.3;
  },
  s08(st, lt) {
    const flinch = Math.exp(-(((lt - 0.12) / 0.18) ** 2));
    st.cam.pos = add(EYE, [0.02, 0, 0.0]);
    st.cam.look = [0.4, 1.0, -1.0];
    st.cam.fov = 44;
    st.cam.focus = 1.4;
    st.cam.aperture = 0.7;
    st.lids.gap = 0.13 - 0.05 * flinch + 0.006 * Math.sin(lt * 2.4);
    st.lids.blur = 0.3;
    st.woman.lying = false;
    st.woman.face = { pos: [-0.42, 0.92 + 0.006 * Math.sin(lt * 1.3), -1.2], look: [-0.86, 0.9, -1.34], up: [0, 1, 0], pupil: 1, hairAmp: 0.4, veil: true };
    st.lights.lamp = 7;
    st.lights.moon = 4.2;
    st.post.exposure = 1.3;
  },
  s09(st, lt, sc, tl) {
    const ev = tl.events.find((e) => e.scene === 's09' && e.type === 'buzz');
    const tb = (ev ? ev.time : sc.start + 2.5) - sc.start;
    const on = smoothstep(tb + 0.05, tb + 0.25, lt);
    const startle = easeOutCubic(seg(lt, tb, tb + 0.3));
    st.cam.pos = [-0.8, 0.9 + 0.005 * startle, -1.17];
    st.cam.look = mix([-0.76, 0.64, -0.8], [-0.75, 0.66, -0.8], easeInOutSine(seg(lt, 0, sc.duration)));
    st.cam.fov = 50;
    st.cam.focus = 0.52;
    st.cam.aperture = 0.55;
    st.lids.gap = lerp(0.22, 0.38, startle);
    st.lids.glow = 0.45 * on;
    st.lids.blur = lerp(0.25, 0.08, startle);
    st.phone = { mode: 'chest', on, screen: 'alert', light: 0.55, buzz: buzz(lt, tb), hand: false, shadow: true };
    st.woman.lying = false;
    st.woman.hand = { pos: [-0.66, 0.62, -0.72], rot: [0.1, -0.5, 0.42] };
    st.lights.lamp = 4.5;
    st.post.exposure = 1.15;
    st.shadow = { focus: [-0.6, 0.7, -0.8], size: 2.5 };
  },
  s10(st, lt) {
    const lean = easeOutCubic(seg(lt, 0.0, 1.3));
    const saw = smoothstep(2.4, 2.9, lt);
    const face = mix([-0.66, 1.1, -0.74], [-0.76, 0.99, -0.84], lean);
    st.cam.pos = [-0.8, 0.9, -1.17];
    st.cam.look = face;
    st.cam.lookAtEye = true;
    st.cam.eyeOffset = [0.0, -0.022, 0];
    st.cam.fov = 44 - 4 * lean;
    st.cam.focus = 0.31;
    st.cam.aperture = 0.9;
    st.lids.gap = lerp(0.4, 0.55, lean);
    st.lids.glow = 0.2;
    st.phone = { mode: 'chest', on: 1, screen: 'alert', light: 0.62, buzz: 0, hand: false, shadow: true };
    st.woman.lying = false;
    st.woman.hand = { pos: [-0.66, 0.62, -0.72], rot: [0.1, -0.5, 0.42] };
    st.woman.face = { pos: face, look: [-0.8, 0.8, -1.12], up: [0.1, 1, 0], pupil: lerp(1.0, 0.55, saw), hairAmp: 0.25 };
    st.lights.lamp = 1.4;
    st.lights.hemi = 0.4;
    st.post.exposure = 1.0;
    st.shadow = { focus: [-0.6, 0.8, -0.8], size: 2.5 };
  },
  s11(st, lt, sc) {
    const u = easeInOutSine(seg(lt, 0, sc.duration));
    st.cam.pos = mix([-0.76, 0.86, -0.98], [-0.7, 0.93, -1.02], u);
    st.cam.look = mix(add(CHAIN, [0.02, -0.2, 0]), add(CHAIN, [0, -0.15, 0]), u);
    st.cam.fov = 44 - 6 * u;
    st.cam.focus = 0.92;
    st.cam.aperture = 0.55;
    st.lids.gap = lerp(0.55, 1.6, easeInOutCubic(seg(lt, 0.4, sc.duration * 0.8)));
    st.lids.blur = 0.1;
    st.phone = { mode: 'chest', on: lerp(0.8, 0.45, u), screen: 'alert', light: 1, buzz: 0, hand: false };
    st.woman.lying = false;
    st.lights.lamp = 5;
    st.shadow = { focus: [-0.2, 1.3, -1.0], size: 3.0 };
  },
  s12(st, lt, sc, tl, abs) {
    const s12 = tl.scenes.find((s) => s.id === 's12');
    const s13 = tl.scenes.find((s) => s.id === 's13');
    const u = easeInOutSine(seg(abs, s12.start, s13.end));
    st.cam.pos = mix(HIGH.pos, add(HIGH.pos, [0.3, -0.04, 0]), u);
    st.cam.look = mix(HIGH.look, add(HIGH.look, [0, -0.04, 0.02]), u);
    st.cam.fov = 64;
    st.cam.focus = 2.6;
    st.cam.aperture = 0.25;
    st.woman.lying = false;
    st.shadow = { focus: [3.2, 1.0, -0.2], size: 8.5 };
    st.fog = true;
    st.farLamps = true;
    st.post.vignette = 0.62;
    st.breath = 0;
    st.lights.lamp = 7.5;
    st.lights.lamp2 = 5.5;
    st.lights.hemi = 1.2;
  },
  s13(st, lt, sc, tl, abs) {
    SHOTS.s12(st, lt, sc, tl, abs);
    st.twist = easeInOutSine(seg(lt, 0.15, sc.duration - 0.15));
  },
};

export function direct(t, tl) {
  const i = sceneIndexAt(tl, t);
  const sc = tl.scenes[i];
  const st = defaults();
  SHOTS[sc.id](st, t - sc.start, sc, tl, t);
  st.sceneIndex = i;
  st.scene = sc;
  st.scare = scareEnvelope(t, tl);
  return st;
}
