// The director: computes every pose, prop and camera value from time t alone.
import * as THREE from 'three';
import { clamp, lerp, seg, smooth, smoother, easeInOut, easeOut, easeIn, easeOutBack, pulse, bump, keys, pop, smoothNoise1 } from './lib.js';
import { B, L, holeDepth, holeFootprint, waterLevel, DEEP } from './beats.js';
import { C } from './world.js';
import { setHose, setStream } from './props.js';

const PI = Math.PI;
const mixP = (a, b, k) => { const o = { ...a }; for (const key in b) o[key] = lerp(a[key] ?? 0, b[key], k); return o; };

// ---------------- gorilla poses ----------------
const G0 = {
  bob: 0, squash: 0, lean: 0.08, twist: 0, roll: 0, hipPitch: 0, headPitch: 0.05, headYaw: 0, headRoll: 0, breath: 0,
  lPitch: 0.05, lYaw: 0, lRoll: 0.22, lElbow: -0.15, lWrist: 0, rPitch: 0.05, rYaw: 0, rRoll: 0.22, rElbow: -0.15, rWrist: 0,
  lLHip: 0, lLKnee: 0, lLAnkle: 0, lLHipRoll: 0.05, rLHip: 0, rLKnee: 0, rLAnkle: 0, rLHipRoll: 0.05,
};
const G_CROSS = { lPitch: -0.55, lRoll: 0.2, lElbow: -1.7, lYaw: 1.45, rPitch: -0.42, rRoll: 0.2, rElbow: -1.75, rYaw: -1.45, lean: -0.06, headPitch: -0.12 };
const G_TUCK = { lLHip: -1.9, lLKnee: 2.0, rLHip: -1.9, rLKnee: 2.0, lPitch: -1.3, lRoll: -0.25, lElbow: -1.3, rPitch: -1.3, rRoll: -0.25, rElbow: -1.3, lean: 0.55, headPitch: -0.25 };
const G_CROUCH = { bob: -0.16, lLHip: -0.55, lLKnee: 0.9, lLAnkle: -0.35, rLHip: -0.55, rLKnee: 0.9, rLAnkle: -0.35, lean: 0.35, lPitch: 0.5, rPitch: 0.5, headPitch: -0.2 };
const G_FLOAT = {
  lean: -0.1, headPitch: -0.35, headYaw: 0.0, lPitch: -2.75, lRoll: 0.35, lElbow: -2.1, rPitch: -0.55, rRoll: 0.05, rElbow: -1.7, rYaw: -1.0,
  lLHip: -1.15, lLKnee: 1.45, rLHip: -0.75, rLKnee: 0.6, rLHipRoll: -0.2,
};

// ---------------- kid poses ----------------
const K0 = {
  bob: 0, squash: 0, lean: 0, twist: 0, roll: 0, headPitch: 0, headYaw: 0, headRoll: 0,
  lPitch: -0.75, lYaw: 0.25, lRoll: 0.12, lElbow: -1.3, lWrist: 0.2, rPitch: 0.05, rYaw: 0, rRoll: 0.12, rElbow: -0.25, rWrist: 0,
  lLHip: 0, lLKnee: 0, lLAnkle: 0, lLHipRoll: 0.02, rLHip: 0, rLKnee: 0, rLAnkle: 0, rLHipRoll: 0.02,
};
const K_MAP = { lPitch: -2.75, lRoll: -0.05, lElbow: -0.45, lYaw: 0.0, rPitch: -2.75, rRoll: -0.05, rElbow: -0.45, headPitch: -0.12, lean: -0.08 };
const K_CHEER = { lPitch: -2.9, lRoll: 0.35, lElbow: -0.25, rPitch: -2.9, rRoll: 0.35, rElbow: -0.25, headPitch: -0.15 };
const K_READY = { bob: -0.09, lean: 0.35, lPitch: 1.0, lRoll: 0.2, lElbow: -0.2, rPitch: 1.0, rRoll: 0.2, rElbow: -0.2, lLHip: -0.65, lLKnee: 1.1, lLAnkle: -0.45, rLHip: -0.65, rLKnee: 1.1, rLAnkle: -0.45, headPitch: -0.3 };
const K_PUSH = { lean: 0.45, lPitch: -1.35, lRoll: -0.1, lElbow: -0.5, rPitch: -1.35, rRoll: -0.1, rElbow: -0.5, headPitch: -0.35 };
const K_STARE = { lPitch: 0.03, lRoll: 0.1, lElbow: -0.05, rPitch: 0.03, rRoll: 0.1, rElbow: -0.05, lean: 0.0, headPitch: 0.06 };

function walkCycle(phase, amp = 1) {
  const s = Math.sin(phase), c = Math.cos(phase);
  return {
    lLHip: -0.5 * s * amp, rLHip: 0.5 * s * amp,
    lLKnee: Math.max(0, c) * 0.8 * amp, rLKnee: Math.max(0, -c) * 0.8 * amp,
    lPitch: 0.35 * s * amp, rPitch: -0.35 * s * amp, bob: Math.abs(c) * 0.035 * amp, roll: 0.05 * s * amp,
  };
}

export function direct(t, R) {
  const { W, P, F, gor, kid, nb } = R;
  const s = {};

  // ================= world: hole, walls, pool =================
  const fp = holeFootprint(t);
  s.hole = { on: t >= B.dig0, d: Math.max(0.02, holeDepth(t)), ...fp };
  const crum = smooth(seg(t, B.crumble0, B.crumble0 + 1.2));
  const flat = (tp) => 1 - smooth(seg(t, tp - 0.02, tp + 0.12));
  const r0 = 0.22;
  s.rough = [
    lerp(r0, 1.0, crum) * (t > B.punches[0] - 0.05 ? flat(B.punches[0]) : 1),
    lerp(r0, 1.0, crum) * (t > B.punches[3] - 0.05 ? flat(B.punches[3]) : 1),
    lerp(r0, 1.0, crum) * (t > B.punches[1] - 0.05 ? lerp(1, 0.45, smooth(seg(t, B.punches[1], B.punches[1] + 0.12))) * flat(B.punches[2]) : 1),
    lerp(0.15, 0.8, crum) * (t > B.punches[4] - 0.05 ? flat(B.punches[4]) : 1),
  ];
  s.slabK = B.slabs.map((ts) => seg(t, ts, ts + 0.32));
  s.shellOn = [s.slabK[0] > 0.7 ? 1 : 0, s.slabK[1] > 0.7 ? 1 : 0, s.slabK[2] > 0.7 ? 1 : 0, s.slabK[3] > 0.7 ? 1 : 0];
  s.tileK = seg(t, B.tiles0, B.tiles1);
  s.copeK = seg(t, B.cope0, B.cope1);
  s.ladderK = seg(t, B.ladder, B.ladder + 0.4);
  const wl = waterLevel(t);
  s.water = { on: t >= B.water0, level: wl, splash: [L.floatAt[0], L.floatAt[2], B.impact, t > B.impact ? 1 : 0] };
  if (t > B.water0 && t < B.impact) s.water.splash = [0.25, -0.35, B.water0, 0.25]; // ripples under the hose stream

  // ================= gorilla =================
  let gp = { ...G0 }; let gpos = [5.4, 0, -2.3]; let gRot = -PI / 2; let gTilt = null;
  let gface = { brow: -0.7, mouth: -0.55, open: 0, squint: 0.1, blink: 0, lookX: 0, lookY: 0, pout: 0.6 };
  const blinkAt = (times) => times.reduce((m, tb) => Math.max(m, pulse(t, tb, tb + 0.16, 0.06)), 0);
  gface.blink = blinkAt([1.9, 6.2, 9.3, 12.9, 16.9, 20.5, 25.6, 27.4, 33.6, 37.0, 39.8, 47.1]);

  if (t < B.walk1 + 0.25) {
    // stomping in from the right
    const k = seg(t, B.walk0, B.walk1);
    const st = B.stomps;
    let ph = 0, xk = 0;
    if (t < st[0]) { ph = seg(t, B.walk0, st[0]) * PI * 0.5; xk = 0; }
    else {
      let i = st.findIndex((v) => v > t); if (i < 0) i = st.length;
      const a = st[i - 1], b = st[Math.min(i, st.length - 1)];
      const kk = i >= st.length ? 1 : seg(t, a, b);
      ph = PI * 0.5 + (i - 1) * PI + kk * PI;
      xk = ((i - 1) + easeInOut(kk)) / (st.length - 1);
    }
    gpos = [lerp(5.4, 0.9, clamp(xk)), 0, lerp(-2.0, -1.5, clamp(xk))];
    if (t < st[0]) gpos[0] = lerp(6.2, 5.4, easeOut(seg(t, 0, st[0])));
    const wc = walkCycle(ph, 1.25 * (1 - seg(t, B.walk1 - 0.1, B.walk1 + 0.2)));
    gp = { ...gp, ...wc, lean: 0.2, headYaw: 0.4 };
    const stompSq = B.stomps.reduce((m, ts) => Math.max(m, bump(t, ts, 0.3, 1)), 0);
    gp.squash = stompSq * 0.05; gp.bob -= stompSq * 0.04;
    gRot = lerp(-PI / 2 + 0.25, 0, smooth(seg(t, B.walk1 - 0.15, B.walk1 + 0.25)));
    gface = { ...gface, brow: -0.85, mouth: -0.7, pout: 0.8 };
  } else if (t < B.hop) {
    // huff + chest pound
    gpos = [0.9, 0, -1.5]; gRot = 0;
    const inhale = smooth(seg(t, 2.65, B.huff)) * (1 - smooth(seg(t, B.huff, B.huff + 0.35)));
    gp.breath = inhale * 1.5; gp.headPitch = 0.05 - inhale * 0.25 + smooth(seg(t, B.huff, B.huff + 0.2)) * 0.15 * (1 - seg(t, 3.1, 3.3));
    gface = { ...gface, brow: -1, mouth: -0.8, squint: 0.35, pout: 1, open: pulse(t, B.huff, B.huff + 0.35, 0.05) * 0.25 };
    const stance = smooth(seg(t, 3.1, 3.3)) * (1 - smooth(seg(t, 4.3, 4.45)));
    const READY = { lPitch: -0.85, lRoll: 0.25, lElbow: -1.85, lYaw: 1.25, rPitch: -0.85, rRoll: 0.25, rElbow: -1.85, rYaw: -1.25, headPitch: -0.3, lean: -0.1 };
    gp = mixP(gp, READY, stance);
    B.pounds.forEach((tp, j) => {
      const hit = pulse(t, tp - 0.08, tp + 0.07, 0.07);
      const side = j % 2 === 0 ? 'l' : 'r';
      gp[side + 'Pitch'] += hit * 0.45 * stance; gp[side + 'Roll'] -= hit * 0.1 * stance;
      gp[side + 'Elbow'] += hit * 0.25 * stance;
    });
    const anyHit = B.pounds.reduce((m, tp) => Math.max(m, bump(t, tp, 0.18, 1)), 0);
    gp.breath += anyHit * 0.4; gp.bob = -anyHit * 0.02;
    gface.open = Math.max(gface.open, stance * (0.55 + 0.25 * Math.sin(t * 22)) * seg(t, 3.25, 3.4));
    gface.mouth = lerp(gface.mouth, -0.2, stance);
    gface.brow = -1;
    // crouch before the hop
    gp = mixP(gp, G_CROUCH, smooth(seg(t, 4.25, B.hop)));
  } else if (t < B.dig0) {
    // hop into the dig spot
    const k = seg(t, B.hop, B.hopLand);
    gpos = [lerp(0.9, L.gDig[0], k), Math.sin(k * PI) * 0.75, lerp(-1.5, L.gDig[2], k)];
    gp = mixP(gp, G_TUCK, Math.sin(k * PI) * 0.6);
    gp.squash = bump(t, B.hopLand, 0.25, 1) * 0.12;
    gRot = 0;
  } else if (t < B.spray1 + 0.2 || (t >= B.deep0 - 0.1 && t < B.deep1 + 0.15)) {
    // digging like a machine
    const d = holeDepth(t);
    gpos = [L.gDig[0], -d, L.gDig[2]]; gRot = 0;
    const t0 = t < B.deep0 - 0.2 ? B.dig0 : B.deep0;
    const ph = (t - t0) * 3.4 * 2 * PI;
    const ramp = smooth(seg(t, t0, t0 + 0.25)) * (1 - smooth(seg(t, (t0 === B.dig0 ? B.spray1 : B.deep1) - 0.05, (t0 === B.dig0 ? B.spray1 : B.deep1) + 0.15)));
    const DIG = {
      lean: 0.85, headPitch: -0.55, bob: 0.03 * Math.sin(ph * 2), twist: 0.12 * Math.sin(ph),
      lPitch: 0.2 + 1.05 * Math.sin(ph), lElbow: -0.55 + 0.45 * Math.sin(ph + 0.6), lRoll: 0.3,
      rPitch: 0.2 + 1.05 * Math.sin(ph + PI), rElbow: -0.55 + 0.45 * Math.sin(ph + PI + 0.6), rRoll: 0.3,
      lLHip: -0.45, lLKnee: 0.6, rLHip: -0.45, rLKnee: 0.6, lLAnkle: -0.15, rLAnkle: -0.15,
    };
    gp = mixP(gp, DIG, ramp);
    gface = { ...gface, brow: -0.9, mouth: -0.5, squint: 0.35, pout: 0.7, lookY: 0.1 };
  } else if (t < B.deep0 - 0.1) {
    // pause, see the wheelbarrow, neat scoops
    const d = holeDepth(t);
    gpos = [L.gDig[0], -d, L.gDig[2]]; gRot = 0;
    const look = smooth(seg(t, B.barrowPop - 0.1, B.barrowPop + 0.2));
    gp.headYaw = look * 0.55 * (1 - smooth(seg(t, B.scoops[0] - 0.2, B.scoops[0])));
    gp.headPitch = -0.1;
    gface = { ...gface, brow: lerp(-0.7, 0.2, look), mouth: -0.4, lookX: look * 0.8 * (1 - seg(t, B.scoops[0] - 0.2, B.scoops[0])) };
    gp.lPitch = -0.2; gp.rPitch = -0.2; gp.lElbow = -0.7; gp.rElbow = -0.7;
    for (const ts of B.scoops) {
      const k = seg(t, ts, ts + 0.72);
      if (k <= 0 || k >= 1) continue;
      const down = pulse(k, 0.0, 0.32, 0.12), up = pulse(k, 0.28, 0.62, 0.1);
      const SC_DOWN = { lean: 0.8, lPitch: -0.9, rPitch: -0.9, lElbow: -0.3, rElbow: -0.3, lRoll: 0.05, rRoll: 0.05, headPitch: -0.3 };
      const SC_UP = { lean: -0.12, lPitch: -2.75, rPitch: -2.75, lElbow: -0.35, rElbow: -0.35, lRoll: 0.1, rRoll: 0.1, twist: 0.35, headPitch: 0.1 };
      gp = mixP(gp, SC_DOWN, down); gp = mixP(gp, SC_UP, up);
    }
    gface.squint = 0.2;
  } else if (t < B.climb) {
    // at the bottom of the too-deep hole: look up at the map, squint
    gpos = [L.gDig[0], -DEEP, L.gDig[2]]; gRot = 0;
    const up = smooth(seg(t, B.deep1, B.deep1 + 0.4));
    gp.headPitch = -0.45 * up; gp.lean = 0.05;
    const sq = smooth(seg(t, B.squint, B.squint + 0.25));
    gp.headPitch -= sq * 0.1; gp.lean += sq * 0.12;
    gp.headRoll = sq * 0.12;
    gp.rPitch = -sq * 1.6; gp.rElbow = -sq * 2.0; gp.rRoll = -sq * 0.4; // scratches head
    gp.rWrist = Math.sin(t * 18) * 0.25 * sq;
    gface = { ...gface, brow: lerp(-0.3, -0.6, sq), squint: 0.15 + sq * 0.75, mouth: lerp(-0.3, -0.6, sq), lookY: up * 0.6, lookX: -up * 0.25, pout: 0.8 };
    gp = mixP(gp, G_CROUCH, smooth(seg(t, B.climb - 0.2, B.climb)));
  } else if (t < B.fill0) {
    // big leap out of the hole
    const k = seg(t, B.climb, B.climbLand);
    gpos = [lerp(L.gDig[0], L.heap[0], k), lerp(-DEEP, 0, k) + Math.sin(k * PI) * 1.5, lerp(L.gDig[2], -3.65, k)];
    gp = mixP(gp, G_TUCK, Math.sin(k * PI) * 0.8);
    gp.squash = bump(t, B.climbLand, 0.25, 1) * 0.12;
    gRot = lerp(0, 0.0, k);
    gface = { ...gface, brow: -0.4, mouth: -0.3, open: Math.sin(k * PI) * 0.4 };
  } else if (t < B.crumble0) {
    // bulldoze the heap back into the hole
    const k = smooth(seg(t, B.fill0, B.fill1));
    gpos = [L.heap[0], 0, lerp(-3.65, -2.85, k)]; gRot = 0;
    const PUSH = { lean: 0.55, lPitch: -1.25, rPitch: -1.25, lElbow: -0.4, rElbow: -0.4, lRoll: 0.0, rRoll: 0.0, headPitch: -0.35 };
    gp = mixP(gp, PUSH, smooth(seg(t, B.fill0, B.fill0 + 0.2)) * (1 - smooth(seg(t, B.fill1 - 0.1, B.fill1 + 0.1))));
    Object.assign(gp, mixP(gp, walkCycle((t - B.fill0) * 6.5, 0.5), seg(t, B.fill0, B.fill0 + 0.2) * (1 - seg(t, B.fill1 - 0.2, B.fill1))));
    gface = { ...gface, brow: -0.6, mouth: -0.4, squint: 0.3 };
  } else if (t < B.jumpIn) {
    // walls cave in: alarm, then annoyed
    gpos = [L.heap[0], 0, -2.85]; gRot = lerp(0, 0.35, smooth(seg(t, B.crumble0, B.crumble0 + 0.4)));
    const alarm = smooth(seg(t, B.crumble0 + 0.1, B.crumble0 + 0.35)) * (1 - smooth(seg(t, 22.0, 22.3)));
    gp.headPitch = 0.25 * alarm + 0.2; gp.lean = 0.2 + 0.1 * alarm;
    gp.lPitch = -0.4 * alarm; gp.rPitch = -0.4 * alarm; gp.lRoll = 0.6 * alarm + 0.2; gp.rRoll = 0.6 * alarm + 0.2;
    gface = { ...gface, brow: lerp(-1, 0.9, alarm), mouth: lerp(-0.9, -0.2, alarm), open: alarm * 0.55, squint: 0.35 * (1 - alarm), pout: 1 - alarm, lookY: 0.5 };
    gp = mixP(gp, G_CROUCH, smooth(seg(t, B.jumpIn - 0.2, B.jumpIn)));
  } else if (t < B.jumpOut) {
    // jump in and pound the walls flat
    const kj = seg(t, B.jumpIn, B.jumpInLand);
    const base = [0.1, -1.46, -0.3];
    if (t < B.jumpInLand) {
      gpos = [lerp(L.heap[0], base[0], kj), lerp(0, base[1], kj) + Math.sin(kj * PI) * 0.8, lerp(-2.85, base[2], kj)];
      gp = mixP(gp, G_TUCK, Math.sin(kj * PI) * 0.7);
      gRot = lerp(0.35, 0, kj);
    } else {
      gpos = [base[0], -holeDepth(t), base[2]];
      gp.squash = bump(t, B.jumpInLand, 0.25, 1) * 0.12;
      // facing for each punch: L wall, back, back, R wall, floor
      const dirs = [-PI / 2, PI * 0.92, PI * 1.08, PI / 2, 0];
      let rot = 0;
      for (let i = 0; i < 5; i++) {
        const tp = B.punches[i];
        const prev = i === 0 ? 0 : dirs[i - 1];
        if (t >= tp - 0.24) rot = lerp(prev, dirs[i], smooth(seg(t, tp - 0.24, tp - 0.1)));
      }
      gRot = rot;
      B.punches.forEach((tp, i) => {
        const wind = pulse(t, tp - 0.24, tp - 0.04, 0.07), hit = pulse(t, tp - 0.05, tp + 0.13, 0.04);
        if (i === 4) {
          gp = mixP(gp, { lPitch: -2.7, rPitch: -2.7, lElbow: -0.6, rElbow: -0.6, lean: -0.1 }, wind);
          gp = mixP(gp, { lPitch: -0.9, rPitch: -0.9, lElbow: 0, rElbow: 0, lean: 0.9, lLKnee: 0.7, rLKnee: 0.7, lLHip: -0.6, rLHip: -0.6, bob: -0.25 }, hit);
        } else {
          const side = i % 2 === 0 ? 'r' : 'l';
          const o = {}; o[side + 'Pitch'] = -0.7; o[side + 'Elbow'] = -1.8; o.twist = side === 'r' ? 0.35 : -0.35;
          const h = {}; h[side + 'Pitch'] = -1.65; h[side + 'Elbow'] = -0.05; h.twist = side === 'r' ? -0.25 : 0.25; h.lean = 0.15;
          gp = mixP(gp, o, wind); gp = mixP(gp, h, hit);
        }
      });
      gface = { ...gface, brow: -1, mouth: -0.75, squint: 0.4, pout: 0.9 };
      gp = mixP(gp, G_CROUCH, smooth(seg(t, B.jumpOut - 0.12, B.jumpOut)));
    }
  } else if (t < B.cross - 0.1) {
    // jump out, watch the pool get built
    const kj = seg(t, B.jumpOut, B.jumpOutLand);
    if (t < B.jumpOutLand) {
      gpos = [lerp(0.1, L.gStage[0], kj), lerp(-1.6, 0, kj) + Math.sin(kj * PI) * 1.2, lerp(-0.3, L.gStage[2], kj)];
      gp = mixP(gp, G_TUCK, Math.sin(kj * PI) * 0.7);
      gRot = 0;
    } else {
      gpos = [...L.gStage]; gRot = -0.25;
      gp.squash = bump(t, B.jumpOutLand, 0.25, 1) * 0.12;
      gp.headPitch = 0.3; gp.headYaw = -0.2 + 0.15 * Math.sin(t * 1.3);
      const hipsOn = smooth(seg(t, 25.4, 25.8));
      gp = mixP(gp, { lPitch: -0.2, lRoll: 0.75, lElbow: -1.9, rPitch: -0.2, rRoll: 0.75, rElbow: -1.9 }, hipsOn); // hands on hips
      gface = { ...gface, brow: -0.2, mouth: -0.1, squint: 0.1, pout: 0.3, lookY: 0.45, lookX: -0.2 };
    }
  } else {
    gpos = [...L.gStage]; gRot = -0.25;
    if (t < B.smile + 0.2) {
      // angry again: arms crossed, grunt, huff
      const cross = smooth(seg(t, B.cross - 0.1, B.cross + 0.2));
      gp = mixP(gp, G_CROSS, cross);
      gp.headYaw = 0.45 * smooth(seg(t, B.grunt, B.grunt + 0.2)) * (1 - smooth(seg(t, 29.7, 30.1)));
      gp.headPitch = -0.12 + bump(t, B.grunt, 0.3, 1) * 0.15 + bump(t, B.huff2, 0.4, 1) * 0.1;
      gp.breath = pulse(t, B.huff2 - 0.35, B.huff2 + 0.1, 0.2) * 1.4;
      gface = { ...gface, brow: -1, mouth: -1, pout: 1, squint: 0.45, lookX: -0.3 * smooth(seg(t, B.grunt, B.grunt + 0.2)), open: pulse(t, B.huff2, B.huff2 + 0.3, 0.05) * 0.2 };
      // notice the bananas
      const see = smooth(seg(t, B.push1 - 0.2, B.push1));
      gp.headYaw *= 1 - see; gp.headPitch = lerp(gp.headPitch, 0.15, see);
      gface.lookX = lerp(gface.lookX, -0.7, see); gface.lookY = lerp(0, 0.4, see);
      gface.brow = lerp(gface.brow, 0.4, see); gface.squint = lerp(gface.squint, 0, see);
      gface.wide = see;
      gRot = lerp(-0.25, -0.55, see);
      const happy = smooth(seg(t, B.smile, B.smile + 0.2));
      gface.mouth = lerp(gface.mouth, 1, happy); gface.pout = lerp(gface.pout, 0, happy);
      gp = mixP(gp, G0, happy);
    } else if (t < B.water1 + 0.2) {
      // happy: grab, peel, bite, hose
      gRot = lerp(-0.55, -0.3, smooth(seg(t, B.grab + 0.3, B.hoseOn)));
      const reach = pulse(t, B.smile + 0.1, B.grab + 0.15, 0.12);
      gp = mixP(gp, { lPitch: -1.2, lRoll: 0.45, lElbow: -0.3, lean: 0.4, twist: -0.3 }, reach);
      const hold = smooth(seg(t, B.grab + 0.1, B.peel0));
      gp = mixP(gp, { lPitch: -0.55, lRoll: 0.0, lElbow: -1.45, lYaw: 0.3 }, hold);
      const peelA = pulse(t, B.peel0 - 0.05, B.peel1 + 0.05, 0.08);
      gp = mixP(gp, { rPitch: -1.15, rRoll: -0.35, rElbow: -1.8 }, peelA);
      const biteK = pulse(t, B.bite - 0.12, B.bite + 0.25, 0.1) + pulse(t, 33.2, 33.6, 0.1) + pulse(t, 34.6, 35.0, 0.1);
      gp.lElbow -= biteK * 0.6; gp.lPitch -= biteK * 0.45; gp.headPitch = 0.05 - biteK * 0.05;
      const hoseK = smooth(seg(t, B.hoseOn - 0.2, B.hoseOn + 0.1));
      gp = mixP(gp, { rPitch: -1.35, rRoll: 0.15, rElbow: -0.35, rYaw: 0.25 }, hoseK);
      gface = { ...gface, brow: 0.5, mouth: 1, pout: 0, squint: 0.45, open: biteK * 0.6 + pulse(t, B.smile, B.smile + 0.5, 0.1) * 0.25, lookX: -0.3 * hoseK, lookY: 0.35 * hoseK };
    } else if (t < B.bands - 0.1) {
      // watching the kid, munching
      gRot = lerp(-0.3, -0.6, smooth(seg(t, B.water1 + 0.2, B.water1 + 0.8)));
      const biteK = pulse(t, 36.7, 37.1, 0.1) + pulse(t, 38.4, 38.8, 0.1);
      gp = mixP(gp, { lPitch: -0.55, lRoll: 0.0, lElbow: -1.45, lYaw: 0.3, rPitch: -0.1, rRoll: 0.3, rElbow: -0.3 }, 1);
      gp.lElbow -= biteK * 0.6; gp.lPitch -= biteK * 0.45;
      gp.headYaw = -0.25; gp.headPitch = 0.12;
      // bends down to the banana pile for another one (keeps his face clear of the long first word)
      const dip = pulse(t, 35.8, 37.3, 0.32);
      gp = mixP(gp, { lean: 1.0, twist: -0.3, rPitch: -1.05, rRoll: 0.1, rElbow: -0.25, headPitch: -0.3, headYaw: -0.1,
                      lLHip: -0.55, rLHip: -0.55, lLKnee: 0.6, rLKnee: 0.6, bob: -0.14 }, dip);
      const sly = smooth(seg(t, 40.2, 40.6));
      gface = { ...gface, brow: lerp(0.4, -0.2, sly), mouth: lerp(0.8, 0.6, sly), pout: 0, squint: lerp(0.35, 0.55, sly), open: biteK * 0.5, lookX: lerp(-0.6, -0.9, sly), lookY: 0.15 };
      gp.headRoll = sly * 0.12;
    } else {
      // finale: armbands, leap, cannonball, float
      if (t < B.leap) {
        gRot = lerp(-0.6, -0.9, smooth(seg(t, B.bands, B.backstep)));
        gp = mixP(gp, { lPitch: -0.3, rPitch: -0.3, lRoll: 0.4, rRoll: 0.4 }, 1);
        gp = mixP(gp, G_CROUCH, smooth(seg(t, B.backstep, B.leap)));
        gface = { ...gface, brow: 0.3, mouth: 0.9, squint: 0.55, pout: 0, lookX: -0.4 };
      } else if (t < B.impact) {
        const k = seg(t, B.leap, B.impact);
        const st = L.gStage, en = [L.floatAt[0], -0.55, L.floatAt[2]];
        gpos = [lerp(st[0], en[0], k), lerp(st[1], en[1], k) + Math.sin(k * PI) * 2.3 + k * 0.0, lerp(st[2], en[2], k)];
        gp = mixP(gp, G_TUCK, smooth(seg(k, 0.1, 0.35)));
        gRot = lerp(-0.9, -0.2, k);
        gTilt = -0.35 * Math.sin(k * PI);
        gface = { ...gface, brow: 0.6, mouth: 1, squint: 0.8, open: 0.3, pout: 0 };
      } else {
        // under water, then floating on his back
        const up = smooth(seg(t, B.surface - 0.5, B.settle));
        const bobY = Math.sin((t - B.surface) * 1.6) * 0.03 * up;
        const wlv = waterLevel(t);
        gpos = [L.floatAt[0] + 0.95, lerp(wlv - 1.1, wlv - 0.12, up) + bobY, L.floatAt[2] - 0.05];
        gp = mixP(gp, G_TUCK, 1 - up);
        gp = mixP(gp, G_FLOAT, up);
        gp.breath = pulse(t, B.sigh - 0.4, B.sigh + 0.9, 0.4) * 1.3;
        gp.lElbow += pulse(t, B.bite2 - 0.15, B.bite2 + 0.3, 0.1) * 0.0;
        gRot = 'float';
        const sigh = pulse(t, B.sigh - 0.1, B.sigh + 1.1, 0.25);
        gface = { ...gface, brow: 0.5, mouth: 1, pout: 0, squint: 0.6, blink: Math.max(gface.blink, smooth(seg(t, B.sigh - 0.1, B.sigh + 0.2)) * 0.92), open: sigh * 0.45 + pulse(t, B.bite2 - 0.1, B.bite2 + 0.3, 0.1) * 0.5 };
      }
    }
  }
  // apply gorilla
  gor.setPose(gp); gor.setFace(gface);
  const GS = 1.0;
  gor.root.scale.setScalar(GS);
  gor.root.position.set(gpos[0], gpos[1], gpos[2]);
  if (gRot === 'float') {
    // lying on his back: head toward the kid (-x), belly up and turned a little to camera
    const u = new THREE.Vector3(-1, 0.14, 0).normalize();
    const f = new THREE.Vector3(0, 0.78, 0.62); f.addScaledVector(u, -f.dot(u)).normalize();
    const x = new THREE.Vector3().crossVectors(u, f);
    const rollBob = Math.sin(t * 1.3) * 0.04;
    gor.root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, u, f)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rollBob));
  } else {
    gor.root.rotation.set(gTilt ?? 0, gRot, 0, 'YXZ');
  }
  // armbands
  const bk = seg(t, B.bands, B.bands + 0.3);
  gor.armbands.forEach((a) => { a.visible = bk > 0; a.scale.setScalar(Math.max(0.001, easeOutBack(bk, 2.5))); });

  // ================= kid =================
  let kp = { ...K0 }; let kpos = [...L.kidHome]; let kRot = 0.55;
  let kface = { brow: 0.1, mouth: 0.45, open: 0, squint: 0, blink: 0, lookX: 0, lookY: 0, wide: 0 };
  kface.blink = [1.2, 4.1, 8.9, 12.2, 15.6, 19.9, 24.1, 29.2, 33.0, 38.9, 46.0, 48.4].reduce((m, tb) => Math.max(m, pulse(t, tb, tb + 0.15, 0.05)), 0);
  kp.bob = Math.sin(t * 2.2) * 0.004; kp.lean = Math.sin(t * 1.1) * 0.015;
  let clip = t < B.mapUp - 0.15 || (t > 19.9 && t < B.pilePop - 0.1);
  let swim = t > B.poof + 0.07, wet = t > B.soak0 + 0.2;
  if (t < 7) {
    const watch = smooth(seg(t, 0.6, 1.0));
    kp.headYaw = 0.3 * watch; kp.headPitch = -0.05;
    kface.lookX = 0.6 * watch; kface.lookY = 0.1;
    if (t < 0.6) { kp.headPitch = 0.18; kface.lookY = -0.6; kface.lookX = -0.1; }
    const hopK = B.stomps.reduce((m, ts) => Math.max(m, bump(t, ts + 0.02, 0.25, 1)), 0);
    kp.bob += hopK * 0.025;
    const wow = smooth(seg(t, 3.3, 3.6));
    kface.wide = wow; kface.brow = 0.1 + wow * 0.6; kface.mouth = lerp(0.45, 0.1, wow); kface.open = wow * 0.35 * (1 - smooth(seg(t, 4.6, 5.2)));
    kp.lean -= wow * 0.06;
    const dig = smooth(seg(t, B.dig0, B.dig0 + 0.4));
    kRot = lerp(0.55, 0.75, dig); kp.headYaw = lerp(kp.headYaw, 0.15, dig); kface.lookX = lerp(kface.lookX, 0.5, dig); kface.lookY = lerp(0.1, -0.2, dig);
    kface.mouth = lerp(kface.mouth, 0.7, dig); kface.open = Math.max(kface.open, dig * 0.25);
  } else if (t < 14) {
    const look = smooth(seg(t, 7.2, 7.6)) * (1 - smooth(seg(t, 10.1, 10.5)));
    kp.headYaw = lerp(0.15, 0.45, look); kp.headPitch = lerp(-0.05, -0.2, look);
    kface.lookX = lerp(0.5, 0.9, look); kface.lookY = lerp(-0.2, 0.5, look);
    const wince = smooth(seg(t, 7.7, 8.0)) * (1 - smooth(seg(t, 9.8, 10.2)));
    kface.squint = wince * 0.6; kface.mouth = lerp(0.6, -0.5, wince); kface.brow = lerp(0.2, 0.7, wince); kface.open = wince * 0.15;
    kp.headRoll = -wince * 0.1;
    const ta = pulse(t, B.barrowPop - 0.35, 13.2, 0.3);
    kp = mixP(kp, { rPitch: -1.3, rRoll: 0.7, rElbow: -0.25, rYaw: -0.3, twist: 0.15 }, ta);
    kface.mouth = lerp(kface.mouth, 0.9, ta); kface.open = Math.max(kface.open, ta * 0.3); kface.brow = lerp(kface.brow, 0.5, ta);
    kRot = 0.75;
  } else if (t < 21) {
    kRot = 0.75;
    const lookDown = smooth(seg(t, 14.1, 14.5));
    kp.headPitch = 0.3 * lookDown; kp.lean = 0.12 * lookDown; kface.lookY = -0.6 * lookDown; kface.lookX = 0.5;
    const worried = smooth(seg(t, 15.0, 15.4));
    kface.brow = lerp(0.1, 0.8, worried); kface.mouth = lerp(0.4, -0.4, worried); kface.open = worried * 0.2;
    const mapK = smooth(seg(t, B.mapUp - 0.15, B.mapUp + 0.2)) * (1 - smooth(seg(t, 19.6, 19.9)));
    kp = mixP(kp, K_MAP, mapK);
    kRot = lerp(0.75, 0.25, mapK);
    kface.brow = lerp(kface.brow, 0.5, mapK); kface.mouth = lerp(kface.mouth, 0.7, mapK); kface.lookY = lerp(kface.lookY, -0.4, mapK);
    kp.bob += mapK * Math.abs(Math.sin(t * 7)) * 0.01;
  } else if (t < 28) {
    kRot = 0.75;
    const alarm = smooth(seg(t, 21.2, 21.5)) * (1 - smooth(seg(t, 24.6, 25.0)));
    kface.wide = alarm; kface.brow = 0.1 + 0.6 * alarm; kface.mouth = lerp(0.4, -0.2, alarm); kface.open = alarm * 0.3;
    kp.lean = -0.08 * alarm; kface.lookY = -0.3; kface.lookX = 0.4;
    // walk to the back-left of the pool while the tiles go in
    const wk = seg(t, B.kidWalk0, B.kidWalk1);
    if (wk > 0) {
      kpos = [lerp(L.kidHome[0], L.kidPush[0], easeInOut(wk)), 0, lerp(L.kidHome[2], L.kidPush[2], easeInOut(wk))];
      const moving = pulse(t, B.kidWalk0, B.kidWalk1, 0.2);
      kp = mixP(kp, walkCycle((t - B.kidWalk0) * 9, 0.9), moving);
      kRot = lerp(0.75, PI * 0.95, smooth(seg(t, B.kidWalk0, B.kidWalk0 + 0.3)));
      kRot = lerp(kRot, 0.9, smooth(seg(t, B.kidWalk1 - 0.4, B.kidWalk1)));
      kface.lookX = 0.2;
    }
    const thumbs = pulse(t, 27.4, 28.2, 0.15);
    kp = mixP(kp, { rPitch: -1.6, rRoll: 0.2, rElbow: -1.2 }, thumbs);
    kface.mouth = lerp(kface.mouth, 1, thumbs);
  } else if (t < 35.75) {
    kpos = [...L.kidPush]; kRot = 0.9;
    kface.lookX = 0.6; kface.lookY = 0.15;
    const worry = smooth(seg(t, 28.3, 28.6));
    kface.brow = lerp(0.1, 0.7, worry); kface.mouth = lerp(0.4, -0.3, worry);
    // push the banana pile
    const pk = seg(t, B.push0, B.push1);
    const prep = smooth(seg(t, B.pilePop + 0.05, B.push0)) * (1 - smooth(seg(t, B.push1, B.push1 + 0.25)));
    kpos = [lerp(L.kidPush[0], L.kidPush[0] + (L.pileEnd[0] - L.pileStart[0]), easeInOut(pk)), 0, L.kidPush[2]];
    kRot = lerp(0.9, PI / 2, prep);
    kp = mixP(kp, K_PUSH, prep);
    kp = mixP(kp, walkCycle((t - B.push0) * 10, 0.8), pulse(t, B.push0, B.push1, 0.12));
    kface = { ...kface, brow: lerp(kface.brow, 0.3, prep), mouth: lerp(kface.mouth, 0.6, prep), squint: prep * 0.4 };
    const proud = smooth(seg(t, B.push1 + 0.1, B.push1 + 0.4));
    kface.mouth = lerp(kface.mouth, 1, proud); kface.squint = lerp(kface.squint, 0.3, proud);
    kp = mixP(kp, { lPitch: -0.2, lRoll: 0.9, lElbow: -1.9, rPitch: -0.2, rRoll: 0.9, rElbow: -1.9 }, proud * (1 - smooth(seg(t, B.kidBack0 - 0.3, B.kidBack0))));
    // walk back to the pool edge
    const bk2 = seg(t, B.kidBack0, B.kidBack1);
    if (bk2 > 0) {
      const from = [L.kidPush[0] + (L.pileEnd[0] - L.pileStart[0]), 0, L.kidPush[2]];
      kpos = [lerp(from[0], L.kidEdge[0], easeInOut(bk2)), 0, lerp(from[2], L.kidEdge[2], easeInOut(bk2))];
      kp = mixP(kp, walkCycle((t - B.kidBack0) * 10, 1.0), pulse(t, B.kidBack0, B.kidBack1, 0.15));
      kRot = lerp(PI / 2, -2.2, smooth(seg(t, B.kidBack0, B.kidBack0 + 0.25)));
      kRot = lerp(kRot, 1.15, smooth(seg(t, B.kidBack1 - 0.35, B.kidBack1)));
    }
  } else if (t < B.impact) {
    kpos = [...L.kidEdge]; kRot = 1.0;
    // outfit poof + cheering
    const spin = seg(t, B.poof - 0.05, B.poof + 0.35);
    kp.squash = bump(t, B.poof, 0.35, 1) * 0.12;
    let cheer = smooth(seg(t, 36.2, 36.45)) * (1 - smooth(seg(t, 40.4, 40.8)));
    kp = mixP(kp, K_CHEER, cheer);
    let jump = 0;
    for (const tc of B.cheers) jump = Math.max(jump, Math.max(0, Math.sin(seg(t, tc, tc + 0.42) * PI)));
    kpos[1] = jump * 0.22 * cheer;
    kp.lLKnee = (1 - jump) * 0.25 * cheer; kp.rLKnee = kp.lLKnee; kp.lLHip = -kp.lLKnee * 0.6; kp.rLHip = kp.lLHip;
    kp.lRoll += Math.sin(t * 11) * 0.12 * cheer; kp.rRoll += Math.sin(t * 11 + 1) * 0.12 * cheer;
    kface = { ...kface, brow: 0.6, mouth: 1, open: 0.55 * cheer + 0.1, squint: 0.35 * cheer, lookX: 0.0, lookY: 0.1 };
    kRot = lerp(kRot, 0.35, cheer * 0.6);
    // ready to jump
    const ready = smooth(seg(t, B.crouch, B.crouch + 0.35));
    kp = mixP(kp, K_READY, ready); kRot = lerp(kRot, 1.2, ready);
    kface = { ...kface, brow: lerp(kface.brow, 0.3, ready), mouth: lerp(kface.mouth, 0.8, ready), open: lerp(kface.open, 0.0, ready), squint: lerp(kface.squint, 0.2, ready), lookX: lerp(0, 0.5, ready), lookY: lerp(0.1, -0.3, ready) };
    // notices the gorilla leaping
    const see = smooth(seg(t, B.leap, B.leap + 0.25));
    kp = mixP(kp, { lean: 0.0, bob: -0.02, headPitch: -0.35, lLHip: -0.2, rLHip: -0.2, lLKnee: 0.3, rLKnee: 0.3 }, see);
    kface = { ...kface, wide: see, brow: lerp(kface.brow, 0.8, see), mouth: lerp(kface.mouth, -0.1, see), open: lerp(kface.open, 0.45, see), lookY: lerp(kface.lookY, 0.7, see), lookX: lerp(kface.lookX, 0.6, see) };
    kRot = lerp(kRot, 0.9, see);
    kRot += easeInOut(spin) * PI * 2;
  } else {
    // soaked, staring
    kpos = [...L.kidEdge]; kRot = 0.9;
    const hit = bump(t, B.soak0, 0.6, 1.5);
    kp = mixP(kp, K_STARE, smooth(seg(t, B.soak0, B.soak1)));
    kp.lean = -hit * 0.15; kp.bob = -hit * 0.02;
    const stare = smooth(seg(t, B.soak1, B.soak1 + 0.5));
    kface = { brow: lerp(0.8, -0.15, stare), mouth: lerp(-0.2, -0.15, stare), open: lerp(0.5, 0, stare), squint: lerp(0.6, 0.38, stare), blink: Math.max(kface.blink, pulse(t, B.soak0 - 0.05, B.soak0 + 0.35, 0.05)), wide: 0, lookX: 0.55, lookY: -0.1 };
    kp.headPitch = 0.08; kp.headYaw = 0.1;
    kp.lRoll = 0.08; kp.rRoll = 0.08;
    // slow deadpan turn to the camera for the final hold
    const turn = smooth(seg(t, 46.9, 47.7));
    kp.headYaw = lerp(0.1, -0.75, turn); kp.twist = -0.18 * turn;
    kface.lookX = lerp(0.55, -0.35, turn); kface.lookY = lerp(-0.1, 0.05, turn);
    kface.squint = lerp(kface.squint, 0.48, turn); kface.mouth = lerp(kface.mouth, -0.3, turn);
  }
  kid.setOutfit(swim, wet);
  kid.setPose(kp); kid.setFace(kface);
  kid.root.position.set(...kpos);
  kid.root.rotation.set(0, kRot, 0);
  kid.root.scale.setScalar(1.1);

  // ================= neighbour =================
  {
    let np = {}; let nf = { brow: 0.15, mouth: 0.35, open: 0, blink: 0, wide: 0, lookX: 0, lookY: 0, squint: 0.15 };
    nf.blink = [2.9, 6.6, 11.6, 14.5, 18.3, 23.0, 27.9, 32.1, 37.4, 42.2, 45.3, 49.0].reduce((m, tb) => Math.max(m, pulse(t, tb, tb + 0.16, 0.05)), 0);
    const sip = pulse(t, 1.6, 2.6, 0.25) + pulse(t, 5.2, 6.0, 0.25) + pulse(t, 12.4, 13.3, 0.25) + pulse(t, 26.0, 26.9, 0.25) + pulse(t, 38.0, 38.9, 0.25);
    np.rPitch = -0.5 - sip * 0.9; np.rElbow = -1.6 - sip * 0.6; np.rWrist = 0.4 - sip * 0.8;
    np.headPitch = -sip * 0.15; nf.squint = 0.15 + sip * 0.5; nf.mouth = 0.35 + sip * 0.2;
    const watchG = smooth(seg(t, 0.8, 1.3)) * (1 - smooth(seg(t, 6.8, 7.2)));
    np.headYaw = -0.25 * watchG; nf.lookX = -0.5 * watchG; nf.lookY = -0.2;
    const gasp = smooth(seg(t, B.gasp - 0.1, B.gasp + 0.12));
    const resigned = smooth(seg(t, 10.2, 10.8));
    if (t > B.gasp - 0.2) {
      nf = { ...nf, wide: gasp * (1 - resigned), brow: lerp(0.15, 1, gasp * (1 - resigned)) - resigned * 0.25, mouth: lerp(0.35, -0.2, gasp) * (1 - resigned) - resigned * 0.2, open: gasp * 0.9 * (1 - smooth(seg(t, 8.6, 9.4))) + 0.02 };
      nf.squint = resigned * 0.55 + sip * 0.4;
      np.lean = -0.25 * gasp * (1 - resigned);
      const high = gasp * (1 - pulse(t, 12.4, 13.3, 0.25));
      np.rPitch = lerp(np.rPitch, -2.7, high); np.rElbow = lerp(np.rElbow, -0.6, high); np.rWrist = lerp(np.rWrist, -0.3, high);
      np.lPitch = -1.0 * gasp * (1 - smooth(seg(t, 8.4, 9.0))); np.lRoll = 0.6 * gasp;
      nf.lookX = -0.35; nf.lookY = -0.3;
    }
    nb.setPose(np); nb.setFace(nf);
    nb.root.position.set(...L.neighbor); nb.root.rotation.set(0, -0.3, 0); nb.root.scale.setScalar(1.1);
  }

  // ================= props =================
  // clipboard / map in the kid's hands
  if (clip) { if (P.clipboard.parent !== kid.armL.grip) kid.armL.grip.add(P.clipboard); P.clipboard.visible = true; P.clipboard.position.set(0.04, 0.0, 0.05); P.clipboard.rotation.set(-0.35, 0.9 - Math.PI, -0.15); }
  else P.clipboard.visible = false;
  const mapK = seg(t, B.mapUp - 0.1, B.mapUp + 0.25) * (1 - seg(t, 19.6, 19.85));
  if (mapK > 0) {
    if (P.map.parent !== kid.waist) kid.waist.add(P.map);
    P.map.visible = true;
    P.map.position.set(0, 1.12, 0.22); P.map.rotation.set(-0.1, 0, 0);
    P.map.scale.set(Math.max(0.001, easeOutBack(mapK, 2)), Math.max(0.001, easeOutBack(clamp(mapK * 1.4), 1.6)), 1);
    P.mapMat.emissiveIntensity = (0.6 + 0.4 * Math.sin(t * 8)) * smooth(seg(t, B.linePop - 0.2, B.linePop + 0.2)) * 2.5;
  } else P.map.visible = false;
  // glowing depth line on the cutaway
  {
    const on = t > B.linePop - 0.05 && t < 21.4;
    P.line.g.visible = on;
    if (on) {
      const fade = 1 - smooth(seg(t, 20.9, 21.4));
      const glow = 0.75 + 0.25 * Math.sin(t * 7);
      for (const dsh of P.line.dashes) {
        const k = seg(t, B.linePop + dsh.k * 0.5, B.linePop + dsh.k * 0.5 + 0.25);
        const sc = Math.max(0.001, easeOutBack(k, 2.5) * fade);
        dsh.d.scale.setScalar(sc); if (dsh.h) dsh.h.scale.setScalar(sc);
      }
      P.line.dashMat.color.setRGB(0.5 * glow * 2, 2.6 * glow, 3.0 * glow);
      P.line.haloMat.opacity = 0.3 * glow;
    }
  }
  // wheelbarrow + heaps
  {
    const bk = seg(t, B.barrowPop, B.barrowPop + 0.4);
    const out = seg(t, 21.0, 21.3);
    P.barrow.g.visible = bk > 0 && out < 1;
    P.barrow.g.position.set(...L.barrow);
    P.barrow.g.rotation.set(0, 0.12, 0);
    P.barrow.g.scale.setScalar(Math.max(0.001, easeOutBack(bk, 2.6) * (1 - easeIn(out))));
    let fill = 0;
    B.scoops.forEach((ts, i) => { fill = Math.max(fill, (i + smooth(seg(t, ts + 0.75, ts + 0.95))) / B.scoops.length); });
    fill = Math.max(fill * (t > B.scoops[0] ? 1 : 0), seg(t, B.deep0, B.deep0 + 0.6));
    P.barrow.load.visible = fill > 0.02;
    P.barrow.load.scale.set(0.6 + 0.4 * fill, Math.max(0.01, fill * 1.15), 0.6 + 0.4 * fill);
    P.barrow.load.position.y = 0.32 + fill * 0.12;
    // overflow heap from the too-deep dig, pushed back in during the fill
    const grow = smooth(seg(t, B.deep0 + 1.0, B.deep1 + 0.9));
    const push = smooth(seg(t, B.fill0, B.fill1));
    const hs = grow * (1 - push);
    P.heap.visible = hs > 0.01;
    P.heap.position.set(L.heap[0], 0, lerp(L.heap[2], -2.15, push));
    P.heap.scale.set(0.35 + 0.65 * hs, Math.max(0.01, hs * 0.75), (0.35 + 0.45 * hs));
    // neighbour burial mound
    const by = smooth(seg(t, B.bury0, B.bury1));
    P.mound.visible = by > 0.01;
    P.mound.position.set(L.neighbor[0], L.neighbor[1], L.neighbor[2]);
    P.mound.scale.set(0.4 + 0.75 * by, Math.max(0.01, 1.62 * by), 0.3 + 0.38 * by);
    P.fenceDirt.visible = by > 0.2;
    P.fenceDirt.position.set(L.neighbor[0] - 0.1, 1.6, C.fenceZ - 0.04);
    P.fenceDirt.scale.set(0.9 * by, 0.16 * by + 0.01, 0.16);
  }
  // bananas
  {
    const pk = seg(t, B.pilePop, B.pilePop + 0.4);
    P.pile.visible = pk > 0;
    const mv = easeInOut(seg(t, B.push0, B.push1));
    P.pile.position.set(lerp(L.pileStart[0], L.pileEnd[0], mv), 0, L.pileStart[2]);
    P.pile.scale.setScalar(Math.max(0.001, easeOutBack(pk, 2.4)) * 1.45);
    P.pile.rotation.set(0, 0, Math.sin(seg(t, B.push0, B.push1) * PI) * 0.0);
    // hero banana in the gorilla's left hand
    const hv = t > B.grab && t < B.bands;
    P.hero.g.visible = hv;
    if (hv) {
      if (P.hero.g.parent !== gor.armL.grip) gor.armL.grip.add(P.hero.g);
      P.hero.g.position.set(0, 0.06, 0.0); P.hero.g.rotation.set(-0.3, 0, 0);
      P.hero.g.scale.setScalar(1.6);
      const pk2 = smooth(seg(t, B.peel0, B.peel1));
      P.hero.peelLow.visible = pk2 < 0.02;
      P.hero.petals.forEach((pg, q) => {
        pg.visible = pk2 >= 0.02;
        const ph = (q + 0.5) * PI / 2;
        pg.quaternion.setFromAxisAngle(new THREE.Vector3(Math.sin(ph), 0, Math.cos(ph)), pk2 * (1.9 + 0.2 * q));
        pg.position.y = 0.0;
      });
      // eaten down by bites
      const eaten = Math.min(1, (t > B.bite ? 0.35 : 0) + (t > 33.4 ? 0.25 : 0) + (t > 34.8 ? 0.2 : 0) + (t > 36.9 ? 0.1 : 0) + (t > 38.6 ? 0.1 : 0));
      P.hero.inner.scale.set(1, 1 - eaten * 0.55, 1);
    }
    // banana held while floating
    P.floatBanana.visible = t > B.surface;
    if (P.floatBanana.visible) {
      if (P.floatBanana.parent !== gor.armR.grip) gor.armR.grip.add(P.floatBanana);
      P.floatBanana.position.set(0.0, 0.12, 0.1); P.floatBanana.rotation.set(0.0, 0.0, 1.9); P.floatBanana.scale.setScalar(1.9);
    }
  }
  // hose + stream
  {
    const on = t > B.hoseOn - 0.15 && t < B.hoseOff + 0.25;
    P.hoseMesh.visible = on; P.nozzle.visible = on;
    s.hose = { on: false };
    if (on) {
      if (P.nozzle.parent !== gor.armR.grip) gor.armR.grip.add(P.nozzle);
      P.nozzle.position.set(0, 0.0, -0.05); P.nozzle.rotation.set(-1.2, 0, 0);
      const pk = seg(t, B.hoseOn - 0.15, B.hoseOn + 0.15);
      P.nozzle.scale.setScalar(Math.max(0.001, easeOutBack(pk, 2.2) * 1.4) * (1 - seg(t, B.hoseOff, B.hoseOff + 0.25)));
      gor.root.updateMatrixWorld(true);
      const tail = new THREE.Vector3(0, 0.02, -0.05); P.nozzle.localToWorld(tail);
      const tip = new THREE.Vector3(0, 0.02, 0.28); P.nozzle.localToWorld(tip);
      setHose(P, W.spigot, tail, t);
      const flow = seg(t, B.hoseOn, B.hoseOn + 0.15) * (1 - seg(t, B.hoseOff - 0.1, B.hoseOff));
      if (flow > 0) {
        const target = new THREE.Vector3(0.25, waterLevel(t), -0.35);
        const tau = 0.62;
        const v = new THREE.Vector3((target.x - tip.x) / tau, (target.y - tip.y + 0.5 * 9.8 * tau * tau) / tau, (target.z - tip.z) / tau);
        setStream(P, tip, v, -9.8, tau * flow);
        P.stream.visible = true; P.streamMat.uniforms.uOn.value = flow;
        s.hose = { on: true, o: tip, v, tEnd: tau * flow, k: flow };
      } else P.stream.visible = false;
    } else P.stream.visible = false;
  }
  // puddle under the soaked kid
  {
    const pk = smooth(seg(t, B.soak0 + 0.1, 46));
    P.puddle.visible = pk > 0;
    P.puddle.position.set(L.kidEdge[0] + 0.05, 0.012, L.kidEdge[2] + 0.05);
    P.puddle.scale.set(0.15 + 0.4 * pk, 0.12 + 0.32 * pk, 1);
  }
  // grass pushed down under feet / props
  s.grassPush = [kpos[0], kpos[2], 0.25, 0.8];

  // steam puffs (gorilla huffs) — need head position
  s.extraPuffs = [];
  gor.root.updateMatrixWorld(true);
  for (const th of [B.huff, B.huff2]) {
    if (t < th - 0.05 || t > th + 1.2) continue;
    const nose = new THREE.Vector3(0, 0.06, 0.47); gor.head.localToWorld(nose);
    const fwd = new THREE.Vector3(0, -0.9, 0.6).applyQuaternion(gor.head.getWorldQuaternion(new THREE.Quaternion()));
    for (let i = 0; i < 6; i++) {
      for (const side of [-1, 1]) {
        s.extraPuffs.push({ t0: th + i * 0.03, p: [nose.x + side * 0.06, nose.y, nose.z], v: [side * 1.5 + fwd.x * 0.4, fwd.y * 0.6 - 0.3, fwd.z * 0.5], s0: 0.04, s1: 0.2, life: 0.55, a: 0.35, col: [1.5, 1.5, 1.55], rise: 0.15, rot: i, seed: i + side });
      }
    }
  }
  // coffee steam
  if (true) {
    nb.root.updateMatrixWorld(true);
    const mp = new THREE.Vector3(0, 0.1, 0); nb.mug.localToWorld(mp);
    for (let i = 0; i < 5; i++) {
      const t0 = Math.floor(t / 0.35) * 0.35 - i * 0.35;
      s.extraPuffs.push({ t0, p: [mp.x, mp.y, mp.z], v: [0.02, 0.05, 0], s0: 0.03, s1: 0.13, life: 1.6, a: 0.22, col: [1.4, 1.4, 1.4], rise: 0.18, rot: t0, seed: t0 });
    }
  }
  return s;
}

// ---------------- camera ----------------
const CAM = [
  // t, camera position, look-at target, vertical fov
  // During narration faces/action are framed below the subtitle band (~40% height).
  [0.0, [-0.3, 2.9, 15.6], [-0.3, 1.5, -1.0], 40],         // establishing
  [2.3, [-0.1, 2.9, 15.0], [-0.1, 1.6, -1.2], 40],
  [4.2, [0.75, 2.75, 10.4], [0.8, 2.15, -2.3], 40],          // push-in: huff + chest pound
  [5.2, [0.1, 3.0, 14.6], [0.05, 0.95, -1.0], 40],           // digging starts
  [7.3, [0.3, 2.9, 14.2], [0.3, 2.15, -1.6], 40],
  [9.3, [1.45, 2.75, 6.4], [1.75, 2.45, -5.0], 40],          // the neighbour gets buried
  [10.5, [0.4, 3.0, 14.2], [0.4, 2.0, -1.6], 40],            // wheelbarrow pops in
  [12.4, [0.3, 3.0, 14.4], [0.3, 1.9, -1.5], 40],
  [13.8, [0.2, 3.0, 14.8], [0.2, 0.9, -1.4], 40],
  [16.3, [-0.2, 1.7, 16.4], [-0.2, -1.3, -0.2], 42],         // way too deep
  [17.5, [-0.4, 1.8, 16.0], [-0.4, -1.05, -0.2], 42],        // map + glowing line
  [18.55, [0.0, 0.5, 10.8], [0.0, -1.25, -0.2], 40],        // push-in on the squint
  [19.6, [0.0, 2.3, 15.4], [0.0, -0.55, -0.8], 40],
  [20.6, [0.0, 2.6, 15.0], [0.0, -0.4, -0.8], 40],
  [22.6, [0.0, 2.4, 14.4], [0.0, 0.0, -0.6], 40],            // walls cave in
  [24.4, [0.1, 1.8, 12.6], [0.1, 0.15, -0.3], 40],           // pounding
  [25.4, [0.0, 2.6, 14.6], [0.0, 0.0, -0.8], 40],
  [27.8, [0.0, 2.8, 14.6], [0.0, 0.4, -1.0], 40],
  [29.5, [0.95, 2.5, 10.0], [1.05, 2.75, -3.2], 40],         // angry again (push-in)
  [30.8, [-0.3, 3.0, 13.8], [-0.3, 1.55, -2.2], 40],         // bananas
  [32.3, [-0.2, 3.0, 14.0], [-0.2, 1.6, -1.9], 40],
  [34.6, [-0.1, 3.0, 14.4], [-0.1, 0.9, -1.2], 40],          // hose fills the pool
  [41.0, [-0.6, 2.55, 11.6], [-0.6, 1.0, -0.8], 40],         // beauty push-in + cheering
  [42.3, [0.0, 3.1, 15.0], [0.0, 0.5, -1.0], 40],            // cannonball
  [44.2, [0.0, 3.0, 14.8], [0.0, 0.2, -1.0], 40],
  [47.8, [-0.7, 2.0, 10.0], [-0.7, 0.4, -0.5], 40],          // final stare (held)
  [50.0, [-0.7, 2.0, 10.0], [-0.7, 0.4, -0.5], 40],
];
// time-aware cubic Hermite through the keyframes: velocity stays continuous, so the
// camera glides through keyframes instead of stopping at each one
function camTangent(i, idx) {
  if (i <= 0 || i >= CAM.length - 1) return null;
  const p = CAM[i - 1], n = CAM[i + 1], c = CAM[i];
  const get = (k) => (idx === 3 ? [k[3]] : k[idx]);
  const a = get(p), b = get(n), m = get(c);
  // hold (no motion on one side) -> zero tangent, avoids overshoot
  const still = (u, v) => u.every((x, j) => Math.abs(x - v[j]) < 1e-6);
  if (still(a, m) || still(m, b)) return a.map(() => 0);
  return a.map((x, j) => ((b[j] - x) / (n[0] - p[0])) * 0.8);
}
function hermite(i, idx, t) {
  const a = CAM[i], b = CAM[Math.min(CAM.length - 1, i + 1)];
  const get = (k) => (idx === 3 ? [k[3]] : k[idx]);
  const p0 = get(a), p1 = get(b);
  const dt = b[0] - a[0];
  if (dt <= 0) return p0;
  const u = clamp((t - a[0]) / dt);
  const m0 = camTangent(i, idx) || p0.map(() => 0), m1 = camTangent(i + 1, idx) || p0.map(() => 0);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  return p0.map((v, j) => h00 * v + h10 * dt * m0[j] + h01 * p1[j] + h11 * dt * m1[j]);
}
export function cameraAt(t, cam) {
  const i = Math.max(0, CAM.findIndex((c) => c[0] > t) - 1);
  const pos = hermite(i, 1, t), tgt = hermite(i, 2, t), fov = hermite(i, 3, t)[0];
  // tiny shakes on heavy impacts
  let sh = 0;
  for (const ts of B.stomps) sh += bump(t, ts, 0.3, 2.5) * 0.012;
  sh += bump(t, B.hopLand, 0.4, 3) * 0.02 + bump(t, B.climbLand, 0.4, 3) * 0.02 + bump(t, B.jumpInLand, 0.4, 3) * 0.015;
  for (const tp of B.punches) sh += bump(t, tp, 0.3, 3) * 0.012;
  sh += bump(t, B.impact, 0.9, 6) * 0.05;
  cam.position.set(pos[0], pos[1] + sh, pos[2]);
  cam.fov = fov; cam.updateProjectionMatrix();
  cam.lookAt(tgt[0], tgt[1] + sh * 0.6, tgt[2]);
}
