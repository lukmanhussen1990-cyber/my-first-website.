// The director: every animated value as a pure function of time t (seconds).
import * as THREE from 'three';
import { LAYOUT as L } from './layout.js';
import { CAR } from './roadster.js';
import { Jet, makeEmitter } from './fx.js';
import { contactShadowTex } from './tex.js';
import {
  clamp, sat, lerp, smoothstep, smootherstep, easeInOutCubic, easeOutCubic, easeInCubic, easeOutBack, hermite,
  splineTrack, track, pulse, deg, wobble, noise1, fbm1, rng, hash,
} from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COM = CAR.com;
const WALL_X = L.tower.x0, TOWER_Z = (L.tower.z0 + L.tower.z1) / 2, ROOF_Y = L.tower.h, ROOF_X1 = L.tower.x1;
const HP = L.helipad, HP_C = V((HP.x0 + HP.x1) / 2, HP.h, (HP.z0 + HP.z1) / 2);
const WASH_FLOOR = 0.10;

// ---------- time warp for the slow-motion flip ----------
const rate = (t) => 1 - 0.65 * smoothstep(39.8, 40.2, t) * (1 - smoothstep(44.4, 44.8, t));
const TAU_DT = 0.002, TAU = new Float32Array(Math.ceil(60 / TAU_DT) + 2);
for (let i = 1; i < TAU.length; i++) TAU[i] = TAU[i - 1] + rate((i - 0.5) * TAU_DT) * TAU_DT;
export const tau = (t) => { const f = clamp(t, 0, 59.9) / TAU_DT, i = Math.floor(f); return lerp(TAU[i], TAU[i + 1], f - i); };

// ---------- ballistic jump with a short thrust phase ----------
function makeJump(p0, p2, t0, t2, ta, g) {
  const T = t2 - t0 - ta;
  const d = new THREE.Vector3().subVectors(p2, p0);
  const k = ta / 2 + T;
  const v = V(d.x / k, (d.y + 0.5 * g * T * T) / k, d.z / k);
  const p1 = p0.clone().addScaledVector(v, ta / 2);
  return {
    v, t0, t2, ta, g,
    pos(t, out = new THREE.Vector3()) {
      const u = t - t0;
      if (u <= ta) { const s = u * u / (2 * ta); return out.copy(p0).addScaledVector(v, s); }
      const w = u - ta;
      return out.copy(p1).addScaledVector(v, w).add(V(0, -0.5 * g * w * w, 0));
    },
    vel(t) { const u = t - t0; if (u <= ta) return v.clone().multiplyScalar(u / ta); const w = u - ta; return V(v.x, v.y - g * w, v.z); },
  };
}

export class Director {
  constructor(world) {
    this.w = world;
    this.car = world.car; this.john = world.john; this.bus = world.traffic.bus; this.fx = world.fx; this.wash = world.carwash;
    this.tl = world.tl;
    this.cam = world.camera;
    this.build();
  }

  build() {
    // ---- jumps ----
    this.P0 = V(0, COM, L.laneA);
    this.BUS_LAND = V(L.busX - 2.3, L.busRoof + COM, L.laneA);
    this.hop = makeJump(this.P0, this.BUS_LAND, 4.75, 7.0, 0.3, 18);
    this.PLAZA_LAND = V(56, L.curbH + COM, -12);
    this.jump2 = makeJump(this.BUS_LAND, this.PLAZA_LAND, 13.6, 17.0, 0.3, 9);
    // ---- climb distance table ----
    const climbTotal = (ROOF_Y - 2.24) - (L.curbH + 2.1);
    const vprof = (t) => 36 * smoothstep(19.55, 20.3, t) * (1 - 0.78 * smoothstep(21.25, 21.7, t));
    const n = 2000, dt = (21.7 - 19.55) / n; let acc = 0; const raw = [0];
    for (let i = 0; i < n; i++) { acc += vprof(19.55 + (i + 0.5) * dt) * dt; raw.push(acc); }
    const sc = climbTotal / acc;
    this.climbD = (t) => { if (t <= 19.55) return 0; if (t >= 21.7) return climbTotal; const f = (t - 19.55) / dt, i = Math.floor(f); return lerp(raw[i], raw[i + 1], f - i) * sc; };
    // ---- flight spline (23.0 .. 39.3) ----
    this.flight = splineTrack([
      [23.0, V(104.5, ROOF_Y + COM, TOWER_Z), V(30, 7, 0)],
      [25.0, V(165, 80, -19.0)],
      [26.8, V(220, 89, -16.5)],
      [28.8, V(283, 94, -13.5)],
      [31.5, V(372, 96.0, -12.0), V(26, 0, 0.0)],
      [33.9, V(452, 62, -16), V(22, -24, -2)],
      [35.6, V(495, 33, -21), V(12, -10, -1.5)],
      [37.6, V(HP_C.x - 1, HP.h + 6.6, HP_C.z + 0.3), V(1.2, -0.8, -0.2)],
      [39.3, V(HP_C.x + 1, HP.h + 6.4, HP_C.z), V(0.8, 0, 0)],
    ]);
    // ---- flip arc in warped time ----
    const K = (t, p, v) => [tau(t), p, v];
    this.flipArc = splineTrack([
      K(39.3, V(HP_C.x + 1, HP.h + 6.4, HP_C.z), V(0.8, 0, 0)),
      K(40.0, V(523, 38, -20.5)),
      K(41.2, V(549, 84, -16)),
      K(42.3, V(576, 112, -11)),
      K(43.4, V(601, 102, -7)),
      K(44.6, V(625, 68, -3)),
      K(45.4, V(646, 22, -0.5), V(12, -24, 0.4)),
      K(46.0, V(657, WASH_FLOOR + COM, L.carwash.zc), V(0, -1.5, 0)),
    ]);
    // ---- wheel spin table (integrated forward speed) ----
    const N = Math.ceil(56 * 240); this.wheelAng = new Float32Array(N + 1);
    let prev = this.carPose(0).p.clone(); let ang = 0;
    for (let i = 1; i <= N; i++) {
      const t = i / 240; const c = this.carPose(t); const d = c.p.distanceTo(prev);
      const air = !c.grounded;
      ang += (air ? d * 0.6 : d) / CAR.wheelR; prev.copy(c.p); this.wheelAng[i] = ang;
    }
    this.buildFX();
    this.buildCamera();
  }

  wheelAngle(t) { const f = clamp(t, 0, 55.99) * 240, i = Math.floor(f); return lerp(this.wheelAng[i], this.wheelAng[i + 1], f - i); }

  busWobble(t) {
    const u = t - 7.0;
    if (u < 0) return { sy: 1, roll: 0, pitch: 0, dy: 0 };
    return {
      sy: 1 - 0.10 * Math.exp(-3.2 * u) * Math.cos(2 * Math.PI * 2.1 * u),
      roll: 0.065 * Math.exp(-2.4 * u) * Math.sin(2 * Math.PI * 1.35 * u),
      pitch: -0.025 * Math.exp(-3 * u) * Math.sin(2 * Math.PI * 1.9 * u),
      dy: 0,
    };
  }
  busRoofPoint(t, local) {
    const b = this.busWobble(t);
    const m = new THREE.Matrix4().compose(V(L.busX, 0, L.laneA), new THREE.Quaternion().setFromEuler(new THREE.Euler(b.roll, 0, b.pitch, 'XYZ')), V(1, b.sy, 1));
    return { p: local.clone().applyMatrix4(m), b };
  }

  // ------------------------------------------------------------------ car pose
  carPose(t) {
    const out = { p: V(0, 0, 0), yaw: 0, pitch: 0, roll: 0, spinQ: null, grounded: true, susp: 0, extraQ: null };
    const p = out.p;
    if (t < 4.75) {
      p.copy(this.P0);
      const pre = smoothstep(3.7, 3.85, t);
      p.y += pre * (0.012 * Math.sin(t * 95) + 0.03);  // rumble + rear lift from thrust
      out.pitch = -pre * deg(1.5);
      out.susp = -0.05 * pulse(t, 2.85, 3.4, 0.1, 0.3);   // the car "sighs" with John
      return out;
    }
    if (t < 7.0) {
      this.hop.pos(t, p); const v = this.hop.vel(t);
      out.grounded = false;
      const ang = Math.atan2(v.y, Math.hypot(v.x, v.z));
      out.pitch = 0.45 * ang * (1 - smoothstep(6.75, 7.0, t)) - deg(4) * smoothstep(6.75, 7.0, t);
      out.roll = deg(3) * Math.sin((t - 4.75) * 3.0);
      return out;
    }
    if (t < 13.6) {
      const u = t - 7.0;
      const bounce = 0.34 * Math.exp(-3.2 * u) * Math.abs(Math.sin(Math.PI * u / 0.42)) * (u < 1.6 ? 1 : 0);
      const { p: rp, b } = this.busRoofPoint(t, V(-2.3, L.busRoof, 0));
      p.copy(rp); p.y += COM + bounce;
      out.roll = b.roll; out.pitch = b.pitch - deg(4) * Math.exp(-8 * u);
      out.susp = -0.09 * Math.exp(-9 * u) * Math.cos(u * 30) * (u < 0.6 ? 1 : 0);
      const pre = smoothstep(13.15, 13.3, t);
      p.y += pre * (0.012 * Math.sin(t * 95) + 0.03);
      out.grounded = bounce < 0.01;
      return out;
    }
    if (t < 17.0) {
      this.jump2.pos(t, p); const v = this.jump2.vel(t);
      out.grounded = false;
      const head = Math.atan2(-v.z, v.x);
      out.yaw = head * smootherstep(13.7, 14.6, t);
      const ang = Math.atan2(v.y, Math.hypot(v.x, v.z));
      out.pitch = 0.4 * ang * (1 - smoothstep(16.7, 17.0, t));
      out.roll = deg(4) * Math.sin((t - 13.6) * 2.2) * (1 - smoothstep(16.5, 17.0, t));
      return out;
    }
    if (t < 19.4) {
      const v2 = this.jump2.vel(16.999); const vh = V(v2.x, 0, v2.z);
      const A = this.PLAZA_LAND, B = V(71.5, L.curbH + COM, TOWER_Z), C = V(WALL_X - 2.24, L.curbH + COM, TOWER_Z);
      let vel;
      if (t < 18.4) {
        const u = (t - 17.0) / 1.4;
        p.set(hermite(A.x, vh.x, B.x, 2.0, u, 1.4), A.y, hermite(A.z, vh.z, B.z, 0, u, 1.4));
        const e = 1e-3; const u2 = Math.min(1, u + e / 1.4);
        vel = V(hermite(A.x, vh.x, B.x, 2.0, u2, 1.4) - p.x, 0, hermite(A.z, vh.z, B.z, 0, u2, 1.4) - p.z);
        const head = Math.atan2(-vel.z, vel.x);
        out.yaw = head + deg(9) * Math.sin(Math.PI * u) * (1 - u);  // little drift
        const ld = t - 17.0;
        out.susp = -0.12 * Math.exp(-8 * ld) * Math.cos(ld * 26);
        p.y += 0.22 * Math.exp(-5 * ld) * Math.abs(Math.sin(Math.PI * ld / 0.35)) * (ld < 0.7 ? 1 : 0);
        out.roll = -deg(3) * Math.sin(Math.PI * u);
      } else {
        const u = (t - 18.4) / 1.0;
        p.set(hermite(B.x, 2.0, C.x, 18, u, 1.0), B.y, B.z);
        out.yaw = 0; out.pitch = deg(1.5) * smoothstep(0, 0.3, u);  // squat on acceleration
      }
      return out;
    }
    if (t < 21.7) {
      // pitch up onto the wall then climb
      const th = (Math.PI / 2) * smootherstep(19.4, 19.85, t);
      const c = Math.cos(th), s = Math.sin(th);
      const dx = Math.max(2.24 * c + 0.03 * s, 2.07 * c + 0.39 * s, 1.42 * c + 0.55 * s, 0.55 * s);
      const dy = Math.max(2.1 * s + 0.4 * c, 1.45 * s + 0.55 * c);
      p.set(WALL_X - dx, L.curbH + dy + this.climbD(t), TOWER_Z);
      out.pitch = th; out.grounded = true;
      return out;
    }
    if (t < 22.05) {
      const pr = smoothstep(21.7, 22.05, t);
      const pr2 = Math.pow(sat((t - 21.7) / 0.35), 0.85);
      const th = (Math.PI / 2) * (1 - smootherstep(0.05, 0.95, pr2));
      const xc = 2.24 - 4.48 * pr2;
      const fwd = V(Math.cos(th), Math.sin(th), 0), up = V(-Math.sin(th), Math.cos(th), 0);
      p.set(WALL_X, ROOF_Y, TOWER_Z).addScaledVector(fwd, -xc).addScaledVector(up, COM);
      out.pitch = th; void pr;
      return out;
    }
    if (t < 23.0) {
      const u = (t - 22.05) / 0.95;
      p.set(hermite(WALL_X + 2.24, 12, 104.5, 30, u, 0.95), ROOF_Y + COM, TOWER_Z);
      out.pitch = deg(2) * smoothstep(22.5, 22.7, t);
      return out;
    }
    if (t < 39.3) {
      this.flight(t, p);
      out.grounded = false;
      const e = 0.02; const p2 = this.flight(Math.min(t + e, 39.3), V()); const v = p2.sub(p).divideScalar(e);
      out.yaw = Math.atan2(-v.z, Math.max(0.5, v.x)) * 0.6;
      const ang = Math.atan2(v.y, Math.hypot(v.x, v.z));
      let pitch = 0.3 * ang;
      // drop: nose dives, then levels for the burn
      pitch += -deg(30) * pulse(t, 31.6, 34.2, 0.9, 0.35);
      pitch *= 1 - smoothstep(33.9, 34.3, t) * (1 - smoothstep(39.2, 39.4, t));
      out.pitch = pitch;
      out.roll = deg(3) * Math.sin(t * 1.3) * smoothstep(28.8, 29.5, t) + deg(2) * fbm1(t * 2.0) * smoothstep(34, 35, t);
      // wild tumble 23.5..28.8 resolving upright (each angle ends on a whole turn)
      if (t > 23.4 && t < 28.85) {
        const prof = (a, b, turns) => { const u = sat((t - a) / (b - a)); const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; return turns * 2 * Math.PI * e; };
        const ax = prof(23.4, 28.75, 3), ay = prof(23.6, 28.6, 1), az = prof(23.5, 28.8, -1);
        // side puffs damp a residual wobble near the end
        out.spinQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(ax, ay, az, 'XYZ'));
      }
      return out;
    }
    if (t < 46.0) {
      const tt = tau(t);
      this.flipArc(tt, p);
      out.grounded = false;
      const e = 0.01; const p2 = this.flipArc(tt + e, V()); const v = p2.sub(p).divideScalar(e);
      out.yaw = Math.atan2(-v.z, Math.max(0.5, v.x)) * 0.5 * (1 - smoothstep(45.2, 45.9, t));
      // one graceful back flip during the slow motion
      const flip = 2 * Math.PI * smootherstep(40.25, 44.35, t);
      out.pitch = flip + deg(10) * pulse(t, 39.35, 40.3, 0.2, 0.5) - deg(6) * pulse(t, 44.6, 45.6, 0.4, 0.5);
      out.roll = deg(4) * Math.sin(t * 1.1) * (1 - smoothstep(45.4, 46.0, t));
      return out;
    }
    // car wash
    const xs = 657, xa = 676, xe = 684;
    let x = xs;
    if (t > 46.55 && t <= 50.3) x = lerp(xs, xa, easeInOutCubic((t - 46.55) / 3.75));
    else if (t > 50.3) { const u = sat((t - 50.3) / 1.0); x = hermite(xa, 0.8, xe, 0, u, 1.0); }
    p.set(x, WASH_FLOOR + COM, L.carwash.zc);
    const ld = t - 46.0;
    out.susp = -0.11 * Math.exp(-7 * ld) * Math.cos(ld * 22);
    out.pitch = -deg(1.2) * pulse(t, 50.3, 51.5, 0.2, 0.6);
    return out;
  }

  // ------------------------------------------------------------------ thrusters & toggles
  thrust(t) {
    const tt = t < 39.0 ? t : tau(t);
    const rear =
      (0.55 * smoothstep(3.75, 3.95, t) + 0.6 * smoothstep(4.62, 4.78, t)) * (1 - smoothstep(5.0, 5.35, t)) +
      (0.5 * smoothstep(13.2, 13.35, t) + 0.6 * smoothstep(13.5, 13.62, t)) * (1 - smoothstep(14.0, 14.35, t)) +
      0.95 * smoothstep(22.5, 22.65, t) * (1 - smoothstep(23.6, 24.0, t)) +
      1.0 * smoothstep(tau(39.33), tau(39.45), tt) * (1 - smoothstep(tau(40.1), tau(40.9), tt));
    const under =
      1.3 * smoothstep(33.9, 34.12, t) * (1 - smoothstep(36.0, 37.2, t)) +
      (0.42 + 0.06 * Math.sin(t * 11)) * smoothstep(36.0, 37.2, t) * (1 - smoothstep(39.3, 39.4, t)) +
      1.0 * smoothstep(tau(39.33), tau(39.45), tt) * (1 - smoothstep(tau(40.0), tau(40.6), tt)) +
      0.75 * smoothstep(45.2, 45.3, t) * (1 - smoothstep(45.92, 46.05, t));
    const puffs = this.tl.events.side_puffs;
    let sideR = 0, sideL = 0;
    puffs.forEach((tp, i) => { const v = Math.exp(-Math.pow((t - tp) / 0.06, 2)); if (i % 2 === 0) sideR += v; else sideL += v; });
    // rear nozzle tilt (radians below horizontal)
    let tilt = deg(70) * smoothstep(3.45, 3.7, t);
    tilt = lerp(tilt, deg(45), easeOutBack(sat((t - 11.2) / 1.5), 1.2) * (t > 11.2 ? 1 : 0));
    tilt = lerp(tilt, 0, smoothstep(15.0, 16.0, t));
    tilt = lerp(tilt, deg(45), smoothstep(38.6, 39.2, t));
    tilt = lerp(tilt, 0, smoothstep(41.0, 42.0, t));
    const fan = smoothstep(18.15, 18.4, t) * (1 - smoothstep(22.1, 22.5, t));
    let dirt = 0.12 * smoothstep(13.6, 14.2, t) + 0.12 * smoothstep(19.5, 21.5, t) + 0.66 * smoothstep(34.3, 36.8, t);
    dirt *= 1 - smoothstep(48.4, 50.0, t);
    const shine = pulse(t, 50.45, 52.2, 0.3, 0.8);
    return { rear, under, sideR, sideL, tilt, fan, dirt, shine, tt };
  }

  // ------------------------------------------------------------------ John
  johnState(t) {
    const s = { eyeOpen: 1, lookX: 0, lookY: 0, browRaise: 0, browTilt: 0, mouthOpen: 0, smile: 0.3, mouthW: 1, headYaw: 0, headPitch: 0, headRoll: 0,
      leanPitch: 0, leanRoll: 0, leanSide: 0, squish: 0, squishSide: 1, honk: 0, foam: 0, dizzy: 0, handsOff: 0 };
    const P = (a, b, ri = 0.12, fo = 0.15) => pulse(t, a, b, ri, fo);
    // gaze & head idle
    s.lookX = 0.12 * fbm1(t * 0.6 + 3); s.lookY = 0.05 * fbm1(t * 0.5 + 9);
    s.headYaw = 0.06 * fbm1(t * 0.4 + 1); s.headRoll = 0.03 * fbm1(t * 0.5 + 5);
    // scene 1: bored -> honk (annoyed) -> sigh -> determined
    s.smile = lerp(s.smile, -0.35, P(0.0, 2.75, 0.1, 0.2));
    s.browTilt -= 0.55 * P(1.9, 2.8, 0.15, 0.2);
    s.honk = Math.exp(-Math.pow((t - 2.15) / 0.07, 2)) + Math.exp(-Math.pow((t - 2.45) / 0.07, 2));
    s.leanPitch -= 0.08 * P(2.0, 2.65, 0.1, 0.2);
    const sigh = P(2.85, 3.4, 0.1, 0.18);
    s.eyeOpen -= 0.6 * sigh; s.browTilt += 0.7 * sigh; s.mouthOpen += 0.32 * sigh; s.smile -= 0.2 * sigh; s.headPitch -= 0.18 * sigh; s.leanPitch -= 0.05 * sigh;
    const det = P(3.4, 4.75, 0.08, 0.1);
    s.browTilt -= 0.5 * det; s.smile = lerp(s.smile, 0.95, det); s.eyeOpen -= 0.15 * det; s.lookX += 0.35 * P(2.0, 3.0, 0.1, 0.1);
    // launch: wide eyes, "woo"
    const woo = P(4.75, 6.4, 0.06, 0.3);
    s.eyeOpen += 0.18 * woo; s.browRaise += 0.9 * woo; s.mouthOpen += 0.75 * woo; s.smile = lerp(s.smile, 0.9, woo); s.leanPitch += 0.12 * P(4.75, 5.4, 0.05, 0.3);
    // bonk: ow + dizzy
    const ow = P(7.0, 7.6, 0.03, 0.2), dz = P(7.05, 9.3, 0.1, 0.4);
    s.mouthOpen += 0.55 * ow; s.eyeOpen -= 0.75 * ow; s.browTilt += 0.6 * ow; s.leanPitch -= 0.15 * ow; s.headPitch -= 0.2 * ow;
    s.dizzy = dz; s.eyeOpen -= 0.25 * dz; s.headRoll += 0.18 * Math.sin(t * 6) * dz; s.lookX += 0.25 * Math.sin(t * 7) * dz; s.lookY += 0.15 * Math.cos(t * 7) * dz; s.smile = lerp(s.smile, 0.15, dz);
    // arc + tilt: curious, looks up/ahead then back at the nozzles
    const cur = P(9.5, 11.1, 0.2, 0.2); s.lookY += 0.32 * cur; s.lookX -= 0.15 * cur; s.browRaise += 0.6 * cur; s.smile = lerp(s.smile, 0.55, cur);
    const back = P(11.2, 12.8, 0.25, 0.25); s.headYaw += 0.55 * back; s.lookX += 0.5 * back; s.lookY -= 0.12 * back; s.smile = lerp(s.smile, 0.8, back);
    // launch 2: big grin
    const grin = P(13.4, 16.8, 0.1, 0.3); s.smile = lerp(s.smile, 1.0, grin); s.mouthOpen += 0.35 * grin; s.browRaise += 0.4 * grin; s.leanPitch += 0.1 * P(13.6, 14.1, 0.05, 0.3);
    // landing + wall: determined grin, looks at the wall / up
    s.leanPitch -= 0.12 * P(17.0, 17.4, 0.03, 0.3);
    const wall = P(18.1, 21.9, 0.2, 0.2); s.browTilt -= 0.45 * wall; s.smile = lerp(s.smile, 0.85, wall); s.lookY += 0.15 * wall;
    // spin: scream, then face squish against the side glass
    const spin = P(23.4, 26.9, 0.15, 0.3);
    s.eyeOpen += 0.2 * spin; s.mouthOpen += 0.9 * spin; s.smile = lerp(s.smile, -0.5, spin); s.browRaise += 1.0 * spin;
    s.squish = smoothstep(25.0, 25.18, t) * (1 - smoothstep(26.4, 26.62, t));
    s.headYaw = lerp(s.headYaw, -1.45, s.squish); s.headPitch = lerp(s.headPitch, 0.05, s.squish); s.leanRoll += 0.16 * s.squish; s.mouthOpen = lerp(s.mouthOpen, 0.55, s.squish); s.handsOff = Math.max(s.handsOff, 0.75 * s.squish);
    s.lookX = lerp(s.lookX, 0.15, s.squish);
    // steady: relieved
    const rel = P(28.6, 31.4, 0.3, 0.3); s.smile = lerp(s.smile, 0.75, rel); s.eyeOpen -= 0.12 * rel; s.mouthOpen = lerp(s.mouthOpen, 0.08, rel);
    // drop: scream
    const drop = P(31.7, 34.4, 0.15, 0.4); s.mouthOpen = lerp(s.mouthOpen, 0.95, drop); s.eyeOpen += 0.2 * drop; s.browRaise += drop; s.smile = lerp(s.smile, -0.4, drop); s.leanPitch -= 0.1 * drop;
    // burn: relief
    const ok = P(36.6, 39.4, 0.4, 0.2); s.smile = lerp(s.smile, 0.7, ok); s.mouthOpen = lerp(s.mouthOpen, 0.1, ok);
    // flip: joy, hands up
    const joy = P(39.6, 45.0, 0.4, 0.4); s.smile = lerp(s.smile, 1.0, joy); s.mouthOpen = lerp(s.mouthOpen, 0.6, joy); s.browRaise += 0.7 * joy; s.handsOff = 0.85 * P(40.6, 44.2, 0.5, 0.6);
    // car wash: proud landing -> "oh" -> calm and foamy
    const proud = P(45.9, 46.6, 0.08, 0.15); s.smile = lerp(s.smile, 0.95, proud); s.browRaise += 0.5 * proud;
    const oh = P(46.6, 47.6, 0.1, 0.4); s.eyeOpen += 0.25 * oh; s.mouthOpen = lerp(s.mouthOpen, 0.45, oh); s.smile = lerp(s.smile, 0.0, oh); s.browRaise += oh;
    const calm = smoothstep(47.6, 48.4, t); s.eyeOpen = lerp(s.eyeOpen, 0.62, calm); s.smile = lerp(s.smile, 0.35, calm); s.browRaise = lerp(s.browRaise, -0.3, calm); s.mouthOpen = lerp(s.mouthOpen, 0.0, calm);
    s.foam = smoothstep(47.8, 48.9, t);
    // final: look at camera, proud little smile, talk
    const fin = smoothstep(51.6, 52.2, t);
    s.headYaw = lerp(s.headYaw, -0.78, fin); s.lookX = lerp(s.lookX, 0.3, fin); s.lookY = lerp(s.lookY, 0.02, fin); s.smile = lerp(s.smile, 0.55, fin); s.eyeOpen = lerp(s.eyeOpen, 0.72, fin);
    s.browRaise = lerp(s.browRaise, 0.1 + 0.5 * pulse(t, 54.1, 55.5, 0.3, 0.2), fin);
    s.mouthOpen += this.talk(t);
    // blinks
    for (const bt of [0.9, 4.25, 8.95, 12.1, 16.6, 20.9, 29.9, 33.1, 38.4, 47.4, 51.0, 54.75]) s.eyeOpen *= 1 - Math.exp(-Math.pow((t - bt) / 0.055, 2));
    // g-forces
    s.leanPitch += 0.1 * fbm1(t * 3) * (t > 23 && t < 29 ? 1 : 0);
    return s;
  }
  talk(t) {
    const env = this.w.mouthEnv;
    if (env && env.data && t >= env.start && t < env.start + env.data.length / env.rate) {
      const f = (t - env.start) * env.rate, i = Math.floor(f);
      return clamp(lerp(env.data[i] || 0, env.data[i + 1] || 0, f - i), 0, 1) * 0.75;
    }
    // fallback syllable pattern for "Well... it did need a wash."
    const a = 52.35;
    const syl = [[0.0, 0.32], [0.95, 0.1], [1.1, 0.12], [1.27, 0.13], [1.45, 0.12], [1.62, 0.32]];
    let m = 0; for (const [s0, d] of syl) m += pulse(t - a, s0, s0 + d, 0.05, 0.07);
    return 0.6 * m;
  }

  // ------------------------------------------------------------------ FX setup
  buildFX() {
    const car = this.car, fx = this.fx;
    this.jets = {
      rear: car.nozzles.rear.map((n) => new Jet(n, { len: 2.4, width: 0.085 })),
      under: car.nozzles.under.map((n) => new Jet(n, { len: 3.2, width: 0.08 })),
      side: car.nozzles.side.map((n) => new Jet(n, { len: 0.9, width: 0.06 })),
    };
    // world-space emitters
    const smokeCol = (u) => { const k = 0.85 - 0.15 * u; return [k * 1.0, k * 0.95, k * 0.92]; };
    const E = [];
    const nozWorld = (t, which, i) => { this.applyCar(t, true); const n = this.car.nozzles[which][i]; return n.group.getWorldPosition(V()); };
    // 1) hop ignition: jets hit the road behind the car
    E.push(makeEmitter({ seed: 1, t0: 3.8, t1: 5.1, rate: 55, life: [1.4, 2.6], spawn: (bt, r) => V(-2.9 + r[0] * 0.8, 0.2, L.laneA + (r[1] - 0.5) * 1.6),
      vel: (bt, r) => V(-3 - r[2] * 4, 1.2 + r[0] * 2.5, (r[1] - 0.5) * 6), size0: [0.5, 0.9], size1: [2.2, 3.6], drag: 1.6, grav: 0.3, col: smokeCol, alpha: 0.55 }));
    // 2) launch 2 off the bus roof
    E.push(makeEmitter({ seed: 2, t0: 13.25, t1: 14.2, rate: 60, life: [1.2, 2.2], spawn: (bt, r) => V(L.busX - 4.6 + r[0], L.busRoof + 0.3, L.laneA + (r[1] - 0.5) * 1.6),
      vel: (bt, r) => V(-4 - r[2] * 4, 0.5 + r[0] * 2, (r[1] - 0.5) * 6), size0: [0.5, 0.9], size1: [2, 3.4], drag: 1.6, grav: 0.2, col: smokeCol, alpha: 0.55 }));
    // 3) roof launch
    E.push(makeEmitter({ seed: 3, t0: 22.55, t1: 23.1, rate: 60, life: [1.0, 2.0], spawn: (bt, r) => { const c = this.carPose(bt).p; return V(c.x - 3 - r[0], ROOF_Y + 0.3, TOWER_Z + (r[1] - 0.5) * 1.6); },
      vel: (bt, r) => V(-6 - r[2] * 4, 1 + r[0] * 2, (r[1] - 0.5) * 5), size0: [0.6, 1.0], size1: [2.4, 3.6], drag: 1.4, grav: 0.2, col: smokeCol, alpha: 0.5 }));
    // 4) landing burn smoke ring on the helipad roof
    E.push(makeEmitter({ seed: 4, t0: 34.45, t1: 37.9, rate: 70, life: [1.8, 3.2], spawn: (bt, r) => { const c = this.carPose(bt).p; const a = r[0] * Math.PI * 2; return V(c.x + Math.cos(a) * 0.8, HP.h + 0.35, c.z + Math.sin(a) * 0.8); },
      vel: (bt, r) => { const a = r[0] * Math.PI * 2; const sp = 9 + r[2] * 8; return V(Math.cos(a) * sp, 0.6 + r[1] * 1.4, Math.sin(a) * sp); }, size0: [0.8, 1.3], size1: [3.0, 4.8], drag: 1.3, grav: 0.25,
      col: (u) => { const k = 0.92 - 0.2 * u; return [k, k * 0.97, k * 0.95]; }, alpha: (u, p) => 0.7 * (1 - 0.4 * p.r[5]), spin: 0.8 }));
    // 5) kick off the helipad
    E.push(makeEmitter({ seed: 5, t0: tau(39.36), t1: tau(39.9), rate: 120, life: [1.2, 2.4], spawn: (bt, r) => V(HP_C.x + 1 + (r[0] - 0.5) * 2, HP.h + 0.3, HP_C.z + (r[1] - 0.5) * 2),
      vel: (bt, r) => { const a = r[0] * Math.PI * 2; return V(Math.cos(a) * (5 + r[2] * 5), 0.8 + r[1], Math.sin(a) * (5 + r[2] * 5)); }, size0: [0.8, 1.2], size1: [2.6, 4.0], drag: 1.3, grav: 0.2, col: smokeCol, alpha: 0.5 }));
    // 6) car wash landing puff + mist
    E.push(makeEmitter({ seed: 6, t0: 45.55, t1: 46.1, rate: 90, life: [0.9, 1.8], spawn: (bt, r) => { const a = r[0] * Math.PI * 2; return V(657 + Math.cos(a) * 1.2, WASH_FLOOR + 0.25, L.carwash.zc + Math.sin(a) * 1.2); },
      vel: (bt, r) => { const a = r[0] * Math.PI * 2; return V(Math.cos(a) * (4 + r[2] * 4), 0.5 + r[1], Math.sin(a) * (4 + r[2] * 4)); }, size0: [0.5, 0.8], size1: [1.8, 2.8], drag: 1.6, grav: 0.1, col: [0.95, 0.97, 1.0], alpha: 0.45 }));
    // 7) water mist in the rinse arch
    E.push(makeEmitter({ seed: 7, t0: 48.9, t1: 50.6, rate: 45, life: [0.8, 1.6], spawn: (bt, r) => { const a = r[0] * Math.PI; return V(this.wash.rinseArchX + (r[2] - 0.5) * 0.6, 0.4 + Math.sin(a) * 2.6, L.carwash.zc + Math.cos(a) * 2.6); },
      vel: (bt, r) => V((r[1] - 0.5) * 2, -1.5 - r[2] * 2, (r[0] - 0.5) * 2), size0: [0.4, 0.7], size1: [1.4, 2.2], drag: 1.2, grav: 0.0, col: [0.85, 0.93, 1.0], alpha: 0.3 }));
    // 8) bonk dust on the bus roof
    E.push(makeEmitter({ seed: 8, t0: 7.0, t1: 7.12, rate: 260, life: [0.6, 1.2], spawn: (bt, r) => V(L.busX - 2.3 + (r[0] - 0.5) * 4, L.busRoof + 0.1, L.laneA + (r[1] - 0.5) * 2),
      vel: (bt, r) => V((r[0] - 0.5) * 8, 1 + r[2] * 2, (r[1] - 0.5) * 6), size0: [0.3, 0.5], size1: [1.0, 1.6], drag: 2.2, grav: 0.0, col: [0.95, 0.9, 0.82], alpha: 0.5 }));
    this.emitters = E;
    void nozWorld;
    // dotted arc samples
    this.arcPts = [];
    for (let i = 0; i < this.fx.arcDots.n; i++) {
      const tt = 13.6 + (i + 0.5) / this.fx.arcDots.n * (17.0 - 13.6);
      this.arcPts.push(this.jump2.pos(tt, V()));
    }
    // foam on the car (car-local positions on roof/hood/sides) + flying foam
    const R = rng(91);
    this.foamCoat = [];
    for (let i = 0; i < 90; i++) {
      const x = -2.0 + R() * 4.1; const side = R();
      let p;
      if (side < 0.55) { const z = (R() - 0.5) * 1.5; const y = (x > 0.95 ? 0.78 : x < -2.0 ? 0.9 : 1.14 - 0.1 * Math.abs(x + 0.5)) + 0.02; p = V(x, y, z); }
      else { const s = side < 0.78 ? 1 : -1; p = V(x, 0.45 + R() * 0.4, 0.98 * s); }
      const col = R() < 0.18 ? [1.0, 0.8, 0.9] : R() < 0.3 ? [0.8, 0.92, 1.0] : [1, 1, 1];
      const t0 = 47.0 + R() * 1.2 + (x + 2) * 0.12, t1 = 48.6 + R() * 0.6 + (2 - x) * 0.25;
      const nb = 3 + Math.floor(R() * 4);
      for (let k = 0; k < nb; k++) this.foamCoat.push({ p: p.clone().add(V((R() - 0.5) * 0.22, (R() - 0.3) * 0.12, (R() - 0.5) * 0.22)), r: 0.045 + R() * 0.075, t0: t0 + R() * 0.2, t1, col });
    }
    this.foamFly = [];
    for (let i = 0; i < 160; i++) {
      const src = R() < 0.5 ? this.wash.sideA : R() < 0.5 ? this.wash.sideB : this.wash.topBrush;
      const bt = 46.7 + R() * 3.4;
      const a = R() * Math.PI * 2;
      this.foamFly.push({ src, bt, life: 0.7 + R() * 0.8, v: V(Math.cos(a) * (3 + R() * 5), 2 + R() * 4, Math.sin(a) * (3 + R() * 5) + 2.5), r: 0.035 + R() * 0.07 });
    }
    // foam meshes
    const fg = new THREE.IcosahedronGeometry(1, 2);
    const fm = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.5, sheen: 1.0, sheenColor: new THREE.Color(0.85, 0.9, 1.0), clearcoat: 0.5 });
    this.foamCoatIM = new THREE.InstancedMesh(fg, fm, this.foamCoat.length); this.foamCoatIM.frustumCulled = false;
    this.foamFlyIM = new THREE.InstancedMesh(fg, fm, this.foamFly.length); this.foamFlyIM.frustumCulled = false;
    this.foamCoatIM.castShadow = true;
    this.foamCoat.forEach((f, i) => this.foamCoatIM.setColorAt(i, new THREE.Color(...f.col)));
    this.w.scene.add(this.foamCoatIM, this.foamFlyIM);
    // floor foam piles
    this.foamPile = [];
    for (let i = 0; i < 40; i++) { const c0 = V(L.carwash.x0 + 2 + R() * 26, WASH_FLOOR, L.carwash.zc + (R() - 0.5) * 9); const t0 = 47.0 + R() * 2.5; for (let k = 0; k < 4; k++) this.foamPile.push({ p: c0.clone().add(V((R() - 0.5) * 0.5, 0, (R() - 0.5) * 0.5)), r: 0.09 + R() * 0.18, t0: t0 + R() * 0.3 }); }
    this.foamPileIM = new THREE.InstancedMesh(fg, fm, this.foamPile.length); this.foamPileIM.frustumCulled = false; this.w.scene.add(this.foamPileIM);
    // water jets in the rinse arch + tri-colour foam jets in the foam arch
    const wm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uTime: { value: 0 }, uLevel: { value: 0 }, uCol: { value: new THREE.Color(0.55, 0.8, 1.0).multiplyScalar(0.9) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uTime; uniform float uLevel; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        float h(float n){ return fract(sin(n)*43758.5453); }
        void main(){ float rim = pow(abs(dot(vN, vV)), 1.2); float s = fract(vUv.y*6.0 - uTime*5.0 + h(floor(vUv.x*14.0))); float streak = smoothstep(0.0,0.2,s)*(1.0-smoothstep(0.5,1.0,s));
        float a = rim * (0.35 + 0.65*streak) * uLevel * (1.0 - vUv.y*0.6); gl_FragColor = vec4(uCol*a, 1.0); }`,
    });
    const jg = (() => { const g = new THREE.CylinderGeometry(0.006, 0.05, 1, 8, 4, true); g.translate(0, 0.5, 0); return g; })();
    this.waterJets = [];
    const WR = rng(17);
    this.wash.nozzles.forEach((nz, ni) => {
      const isFoam = nz.arch === 'foam';
      const cols = [[1.0, 0.5, 0.75], [0.5, 0.75, 1.0], [1.0, 0.9, 0.5]];
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(jg, wm.clone());
        const d = nz.d.clone().add(V((WR() - 0.5) * 0.5, (WR() - 0.5) * 0.25, (WR() - 0.5) * 0.5)).normalize();
        m.position.copy(nz.p); m.quaternion.setFromUnitVectors(V(0, 1, 0), d); m.scale.set(1, 1.6 + WR() * 1.2, 1); m.frustumCulled = false; m.renderOrder = 8;
        m.material.uniforms.uCol.value = isFoam ? new THREE.Color(...cols[ni % 3]).multiplyScalar(0.6) : new THREE.Color(0.6, 0.85, 1.0).multiplyScalar(0.38);
        this.w.scene.add(m); this.waterJets.push({ m, nz });
      }
    });
    // light trail behind the car during the slow-motion flip
    {
      const N = 56; this.trailN = N;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 2 * 3), 3));
      g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array((N + 1) * 2), 1));
      const idx = []; for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
      const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { uCol: { value: new THREE.Color(1.0, 0.82, 0.55).multiplyScalar(3.2) } },
        vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA, 1.0); }' });
      this.trail = new THREE.Mesh(g, m); this.trail.frustumCulled = false; this.trail.renderOrder = 9; this.w.scene.add(this.trail);
    }
    // Roadster contact shadow
    this.carShadow = new THREE.Mesh((() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; })(),
      new THREE.MeshBasicMaterial({ map: contactShadowTex(), color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }));
    this.carShadow.scale.set(5.2, 1, 2.6); this.carShadow.renderOrder = 1; this.w.scene.add(this.carShadow);
    // sparkles positions (car local)
    this.sparkles = [V(1.6, 0.8, 0.95), V(0.2, 1.15, 0.5), V(-1.2, 1.1, 0.62), V(2.22, 0.52, 0.5), V(-2.2, 0.85, 0.7), V(0.9, 0.79, 0.98), V(-0.6, 0.86, 0.86)];
  }

  // ------------------------------------------------------------------ camera
  // Aim so that `subject` lands at screen offset (sx, sy) in NDC (-1..1, +y up).
  frame(pos, subject, sx, sy, fov, up = V(0, 1, 0)) {
    const aspect = this.w.W / this.w.H;
    const s = subject.clone().sub(pos); const dist = s.length(); s.normalize();
    const r0 = new THREE.Vector3().crossVectors(s, up).normalize();
    const u0 = new THREE.Vector3().crossVectors(r0, s).normalize();
    const th = Math.tan(deg(fov) / 2);
    const f = s.clone().addScaledVector(r0, -sx * th * aspect).addScaledVector(u0, -sy * th).normalize();
    return { pos, target: pos.clone().addScaledVector(f, dist), fov, up };
  }

  buildCamera() {
    const C = this;
    const carP = (t) => C.carPose(t).p;
    const head = (t) => C.car.root.localToWorld ? null : null;
    const S = [];
    const shot = (t0, t1, fn, blend = 0.6) => S.push({ t0, t1, fn, blend });
    const F = (pos, subj, sx, sy, fov, up) => C.frame(pos, subj, sx, sy, fov, up);
    void head;
    // S1 establishing: high over the jam looking down the street into the sunset, glide down to John
    const s1 = splineTrack([[0.0, V(-36, 17, 15)], [1.1, V(-16, 8.0, 12.5)], [1.95, V(0.6, 2.3, 7.4), V(5.5, -2.2, -2.5)]]);
    const s1f = track([[0, 52], [1.1, 46], [1.95, 30]]);
    const s1x = track([[0, 0.0], [1.1, 0.0], [1.95, 0.0]]), s1y = track([[0, -0.62], [1.1, -0.45], [1.95, -0.2]]);
    shot(0, 1.95, (t) => F(s1(t, V()), V(t < 1.8 ? lerp(4, 0.2, smoothstep(0, 1.8, t)) : 0.2, 0.9, 1.85), s1x(t), s1y(t), s1f(t)), 0.0);
    // S2 honk & sigh: front 3/4 close-up of John through the windshield
    shot(1.95, 3.45, (t) => { const u = smoothstep(1.9, 3.45, t); return F(V(lerp(2.0, 1.55, u), lerp(1.5, 1.38, u), lerp(5.2, 4.6, u)), V(-0.2, 0.95, 1.85), 0.0, -0.14, lerp(27, 23, u)); }, 0.3);
    // S3 ignition: side view, rear jets in frame
    shot(3.45, 4.72, (t) => { const u = smoothstep(3.4, 4.7, t); return F(V(lerp(0.5, 1.5, u), lerp(1.9, 3.0, u), lerp(9.0, 12.5, u)), V(-1.4, 0.7, 1.85), 0.12, -0.32, lerp(40, 46, u)); }, 0.6);
    // S4 follow the hop like a spectator panning (car kept at ~62% height)
    shot(4.72, 7.0, (t) => { const c = carP(t); const cl = carP(Math.max(0, t - 0.18)); return F(V(5.5 + 0.35 * cl.x, 4.0 + 0.25 * cl.y, 25), cl.clone().lerp(c, 0.5), 0.0, -0.26, 50); }, 0.6);
    // S5 BONK quick push-in, then ease back
    shot(7.0, 9.05, (t) => { const pin = easeOutCubic(sat((t - 7.0) / 0.3)) * (1 - smoothstep(7.95, 9.05, t)); const c = carP(t);
      return F(V(lerp(13.5, 16.5, pin), lerp(6.8, 6.0, pin), lerp(24, 14.5, pin)), c, 0.0, lerp(-0.26, -0.2, pin), lerp(50, 40, pin)); }, 0.1);
    // S6 dotted arc reveal: rise up behind the car, arc sits below the caption band
    shot(9.05, 11.15, (t) => { const u = smootherstep(8.95, 11.0, t); return F(V(lerp(13.5, 4, u), lerp(6.8, 27, u), lerp(24, 42, u)), V(lerp(23, 38, u), lerp(4, 6, u), lerp(1.8, -5, u)), 0.0, lerp(-0.26, -0.3, u), lerp(50, 52, u)); }, 0.45);
    // S7 nozzles tilt to 45 deg: behind-right of the car on the bus roof
    shot(11.15, 13.15, (t) => { const u = smoothstep(11.1, 13.1, t); const c = carP(t); return F(V(c.x - lerp(6.8, 6.0, u), c.y + lerp(2.6, 2.3, u), c.z + lerp(6.4, 5.8, u)), V(c.x - 2.3, c.y, c.z + 0.6), 0.05, -0.2, 40); }, 0.65);
    // S8 launch 2 follow, widening
    shot(13.15, 15.9, (t) => { const c = carP(t), cl = carP(Math.max(0, t - 0.3)); const u = smoothstep(13.2, 15.9, t);
      return F(V(cl.x - lerp(6, 13, u), cl.y + lerp(2.0, 7, u), cl.z + lerp(7, 24, u)), c, lerp(0.05, -0.15, u), -0.22, lerp(42, 52, u)); }, 0.55);
    // S9 wide: the jam goes on for blocks; car lands on the plaza (lower left)
    shot(15.9, 18.3, (t) => { const u = smootherstep(15.8, 18.3, t); const c = carP(t); return F(V(lerp(8, 16, u), lerp(31, 26, u), lerp(17, 14, u)), c.clone().lerp(V(56, 0.7, -12), smoothstep(15.9, 16.9, t)), -0.42, -0.4, 56); }, 0.9);
    // S10 swoop down to the plaza as the car heads for the wall
    shot(18.3, 19.55, (t) => { const c = carP(t); const u = smoothstep(18.2, 19.55, t); return F(V(lerp(55, 66, u), lerp(7, 3.4, u), lerp(2, -1.5, u)), c, lerp(-0.15, -0.05, u), -0.3, lerp(46, 46, u)); }, 0.7);
    // S11 climb: camera rises alongside the facade
    shot(19.55, 21.85, (t) => { const c = carP(t), cl = carP(Math.max(0, t - 0.12)); return F(V(75.5, cl.y + 1.4, -2.0), c, 0.05, -0.28, 50); }, 0.45);
    // S12 crest + roof run
    shot(21.85, 23.15, (t) => { const c = carP(t); const u = smoothstep(21.8, 23.1, t); return F(V(lerp(80, 90, u), ROOF_Y + lerp(5.5, 4.0, u), lerp(-3.5, -5.5, u)), c, 0.0, -0.28, 48); }, 0.45);
    // S13 launch + tumble
    shot(23.15, 25.0, (t) => { const c = carP(t), cl = carP(Math.max(0, t - 0.3)); return F(V(cl.x - 7.5, cl.y + 3.4, cl.z + 13.5), c, 0.0, -0.22, 46); }, 0.45);
    // S14 locked on the side window: John's face squished on the glass (world spins behind)
    shot(25.0, 26.6, (t) => { const q = C.carQuat(t); const c = carP(t);
      const pos = V(-0.24, 1.0 - COM, 2.35).applyQuaternion(q).add(c); const tgt = V(-0.22, 0.95 - COM, 0.75).applyQuaternion(q).add(c);
      return F(pos, tgt, 0.0, -0.32, 34, V(0, 1, 0).applyQuaternion(q)); }, 0.22);
    // S15 side puffs steady the car
    shot(26.6, 28.9, (t) => { const c = carP(t); return F(V(c.x - 3.6, c.y + 2.0, c.z + 10.0), c, 0.0, -0.36, 44); }, 0.3);
    // S16 level flight: low angle, sunset sky behind
    shot(28.9, 31.45, (t) => { const c = carP(t); const u = smoothstep(28.9, 31.4, t); return F(V(c.x + lerp(2, 4.5, u), c.y - lerp(0.8, 2.0, u), c.z + 9.5), c, 0.0, -0.18, 42); }, 0.6);
    // S17 drop: above and ahead, looking down at the falling car
    shot(31.45, 33.95, (t) => { const c = carP(t), cl = carP(Math.max(0, t - 0.15)); return F(V(cl.x + 5.0, cl.y + 5.5, cl.z + 8.0), c, 0.0, -0.18, 54); }, 0.6);
    // S18 landing burn over the helipad
    shot(33.95, 37.7, (t) => { const c = carP(t); const u = smoothstep(33.9, 37.6, t); return F(V(HP_C.x - lerp(19, 13, u), HP.h + lerp(15, 8.5, u), HP_C.z + lerp(24, 18, u)), c, 0.0, lerp(-0.22, -0.18, u), lerp(54, 46, u)); }, 0.7);
    // S19 hover close
    shot(37.7, 39.45, (t) => { const c = carP(t); return F(V(c.x - 3.6, c.y + 0.9, c.z + 7.4), c, 0.0, -0.24, 40); }, 0.6);
    // S20/21 pull back to the huge wide shot for the slow-motion flip (car high in frame, above captions)
    shot(39.45, 44.6, (t) => { const c = carP(t); const u = smoothstep(39.45, 40.9, t); const k = smoothstep(40.0, 44.6, t);
      const near = F(V(c.x - 10, c.y + 1.5, c.z + 14), c, 0.0, -0.1, 42);
      const wide = F(V(lerp(540, 585, k), 54, 150), V(lerp(552, 598, k), 108, -14), 0.0, 0.72, 48);
      return { pos: near.pos.clone().lerp(wide.pos, u), target: near.target.clone().lerp(wide.target, u), fov: lerp(42, 48, u), up: V(0, 1, 0) }; }, 0.6);
    // S22 follow the descent into the car wash
    shot(44.6, 46.0, (t) => { const c = carP(t); const u = smoothstep(44.6, 46.0, t); return F(V(lerp(590, 649, u), lerp(54, 3.8, u), lerp(150, 14.5, u)), c, 0.0, lerp(0.5, -0.25, u), lerp(48, 42, u)); }, 0.9);
    // S23/24 car wash: track along the open front of the tunnel
    shot(46.0, 50.25, (t) => { const c = carP(t); const u = smoothstep(46.1, 47.0, t); return F(V(c.x - lerp(4.5, 6.2, u), lerp(3.4, 3.3, u), lerp(14.0, 10.2, u)), c, 0.12, -0.24, 44); }, 0.5);
    // S25 exit, shiny
    shot(50.25, 51.55, (t) => { const c = carP(t); return F(V(c.x + 4.6, 2.3, 9.6), c, 0.0, -0.08, 40); }, 0.6);
    // S26/27 push-in on John for his line
    shot(51.55, 55.6, (t) => { const u = easeInOutCubic(sat((t - 51.55) / 0.85)); const c = carP(t); const hx = c.x - 0.22, hy = c.y - COM + 0.98;
      return F(V(hx + lerp(2.4, 1.35, u), hy + lerp(0.75, 0.1, u), L.carwash.zc + lerp(6.0, 3.0, u) - 0.08 * sat((t - 52.4) / 3)), V(hx + 0.05, hy + 0.02, L.carwash.zc), 0.0, -0.12, lerp(34, 23, u)); }, 0.7);
    this.shots = S;
  }

  carQuat(t) {
    const c = this.carPose(t);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(c.roll, c.yaw, c.pitch, 'YZX'));
    if (c.spinQ) q.multiply(c.spinQ);
    return q;
  }

  cameraAt(t) {
    const S = this.shots;
    let i = S.findIndex((s) => t < s.t1); if (i < 0) i = S.length - 1;
    const cur = S[i].fn(t);
    const nxt = S[i + 1];
    let state = cur;
    // blend from previous shot at the start of this one
    const prev = S[i - 1];
    if (prev && S[i].blend > 0 && t < S[i].t0 + S[i].blend) {
      const w = smootherstep(S[i].t0, S[i].t0 + S[i].blend, t);
      const a = prev.fn(t);
      state = { pos: a.pos.clone().lerp(cur.pos, w), target: a.target.clone().lerp(cur.target, w), fov: lerp(a.fov, cur.fov, w), up: a.up.clone().lerp(cur.up, w).normalize() };
    }
    void nxt;
    // camera shake on impacts
    const shake = 0.06 * Math.exp(-6 * Math.max(0, t - 7.0)) * (t > 7.0 ? 1 : 0) + 0.025 * pulse(t, 34.0, 37.4, 0.2, 0.6) + 0.03 * Math.exp(-8 * Math.max(0, t - 46.0)) * (t > 46.0 ? 1 : 0);
    if (shake > 1e-4) { state.pos = state.pos.clone().add(V(noise1(t * 31) * shake, noise1(t * 29 + 7) * shake, noise1(t * 27 + 3) * shake)); }
    return state;
  }

  // ------------------------------------------------------------------ apply
  applyCar(t, quiet = false) {
    const c = this.carPose(t);
    const root = this.car.root;
    root.position.copy(c.p);
    root.quaternion.copy(this.carQuat(t));
    const susp = c.susp || 0;
    this.car.body.position.y = -COM + susp;
    const ang = this.wheelAngle(t);
    for (const w of this.car.wheels) { w.pivot.position.y = 0.37 - susp; w.spin.rotation.z = -ang; }
    root.updateMatrixWorld(true);
    return c;
  }

  update(t) {
    const w = this.w;
    const c = this.applyCar(t);
    const th = this.thrust(t);
    const tt = th.tt;
    // nozzles / jets
    this.car.setRearTilt(th.tilt);
    this.jets.rear.forEach((j) => j.set(th.rear, tt + 0.3, 0.3, 1.0));
    this.jets.under.forEach((j) => j.set(th.under, tt, th.under > 0.9 ? 1.0 : 0.4, 1.0 + 0.3 * sat(th.under - 1)));
    this.jets.side.forEach((j, i) => j.set(i < 2 ? th.sideR : th.sideL, tt, 0, 1.0));
    // fan
    const fan = this.car.fan.userData;
    fan.blades.rotation.x = -t * 60 * th.fan;
    fan.ring.material.color.setRGB(0.2, 0.9, 1.0).multiplyScalar(6 * th.fan);
    // paint state
    this.car.mats.paint.userData.uniforms.uDirt.value = th.dirt;
    this.car.mats.paint.userData.uniforms.uShine.value = th.shine;
    // bus wobble + passengers looking up
    const b = this.busWobble(t);
    this.bus.wob.scale.set(1, b.sy, 1); this.bus.wob.rotation.set(b.roll, 0, b.pitch);
    const lookUp = pulse(t, 7.05, 12.5, 0.3, 0.6);
    this.bus.pax.forEach((p, i) => { p.children[2].rotation.z = 0.6 * lookUp; p.rotation.x = 0.1 * Math.sin(t * 5 + i) * Math.exp(-3 * Math.max(0, t - 7)) * (t > 7 ? 1 : 0); });
    // John
    Object.assign(this.john.state, this.johnState(t));
    this.john.update(tt);
    // car wash
    this.wash.update(t, c.p);
    // camera
    const cs = this.cameraAt(t);
    const cam = this.cam;
    cam.position.copy(cs.pos); cam.up.copy(cs.up); cam.fov = cs.fov; cam.lookAt(cs.target);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.camState = cs;
    // shadows follow the action
    const dist = cs.pos.distanceTo(cs.target);
    const size = clamp(dist * 0.9, 14, 260);
    w.setShadowFocus(cs.target.clone().lerp(c.p, 0.5), size);
    this.updateFX(t, c, th);
  }

  groundAt(t) {
    if (t < 4.75) return 0; if (t < 7.0) return t < 6.0 ? 0 : L.busRoof; if (t < 13.6) return L.busRoof; if (t < 17.0) return t < 15.5 ? L.busRoof : L.curbH;
    if (t < 19.45) return L.curbH; if (t < 21.85) return null; if (t < 23.4) return ROOF_Y; if (t < 33.0) return null; if (t < 39.6) return HP.h; if (t < 45.4) return null; return WASH_FLOOR;
  }

  updateFX(t, c, th) {
    const fx = this.fx, cam = this.cam, tt = th.tt;
    // contact shadow under the Roadster (fades with height above the ground)
    const gy = this.groundAt(t);
    if (gy === null) this.carShadow.visible = false;
    else {
      const h = c.p.y - COM - gy;
      const k = 1 - smoothstep(0.05, 4.0, h);
      this.carShadow.visible = k > 0.01;
      this.carShadow.position.set(c.p.x, gy + 0.013, c.p.z); this.carShadow.rotation.set(0, c.yaw, 0);
      this.carShadow.material.opacity = 0.62 * k; const sc = 1 + 0.25 * (1 - k); this.carShadow.scale.set(5.2 * sc, 1, 2.6 * sc);
    }
    // flip light trail
    const trOn = smoothstep(39.6, 40.4, t) * (1 - smoothstep(44.3, 45.0, t));
    this.trail.visible = trOn > 0.01;
    if (this.trail.visible) {
      const N = this.trailN, pos = this.trail.geometry.getAttribute('position'), al = this.trail.geometry.getAttribute('aA');
      const pts = []; for (let i = 0; i <= N; i++) pts.push(this.carPose(t - (N - i) * (1.6 / N)).p.clone());
      for (let i = 0; i <= N; i++) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)];
        const tan = b.clone().sub(a).normalize(); const view = cam.position.clone().sub(pts[i]).normalize();
        const side = new THREE.Vector3().crossVectors(tan, view).normalize();
        const u = i / N; const wdt = 0.55 * Math.pow(u, 0.8);
        const p0 = pts[i].clone().addScaledVector(side, wdt), p1 = pts[i].clone().addScaledVector(side, -wdt);
        pos.setXYZ(i * 2, p0.x, p0.y, p0.z); pos.setXYZ(i * 2 + 1, p1.x, p1.y, p1.z);
        const aa = trOn * Math.pow(u, 1.6) * (1 - smoothstep(0.92, 1.0, u) * 0.6);
        al.setX(i * 2, aa); al.setX(i * 2 + 1, aa);
      }
      pos.needsUpdate = true; al.needsUpdate = true;
    }
    const smokeItems = [];
    for (const e of this.emitters) e.eval(t < 39.0 ? t : tt, smokeItems);
    fx.smoke.commit(smokeItems, cam);
    // glows at active nozzles + sparkles
    const glows = [];
    const addGlow = (n, lvl, size) => { if (lvl < 0.02) return; const p = n.aim.localToWorld(n.exit.clone()); glows.push({ p, size: size * (0.6 + 0.6 * Math.min(1, lvl)), rot: 0, col: [0.55, 0.8, 1.0], a: Math.min(1, lvl) * 1.2 }); };
    this.car.nozzles.rear.forEach((n) => addGlow(n, th.rear, 1.1));
    this.car.nozzles.under.forEach((n) => addGlow(n, th.under, 1.5));
    this.car.nozzles.side.forEach((n, i) => addGlow(n, i < 2 ? th.sideR : th.sideL, 0.7));
    // dotted arc dots glow halo
    fx.glow.commit(glows, null);
    const sp = [];
    const sh = th.shine;
    if (sh > 0.01) this.sparkles.forEach((lp, i) => { const ph = sat((t - 50.55 - i * 0.12) / 0.55); const k = Math.sin(Math.PI * ph); if (k > 0.01) sp.push({ p: this.car.body.localToWorld(lp.clone()), size: 0.9 * k, rot: t * 0.8 + i, col: [1.0, 0.97, 0.9], a: 1.6 * k }); });
    fx.spark.commit(sp, null);
    // thruster lights
    const L0 = fx.lights;
    const place = (l, n, lvl, k) => { if (lvl < 0.02 || !n) { l.intensity = 0; return; } l.position.copy(n.aim.localToWorld(n.exit.clone().add(V(0, 0.4, 0)))); l.intensity = k * lvl; };
    place(L0[0], this.car.nozzles.rear[0], th.rear, 60);
    place(L0[1], this.car.nozzles.under[0], th.under, 90);
    place(L0[2], th.sideR > th.sideL ? this.car.nozzles.side[0] : this.car.nozzles.side[2], Math.max(th.sideR, th.sideL), 25);
    // speed lines (attached to the camera)
    const spd = pulse(t, 31.9, 34.25, 0.5, 0.3);   // vertical lines: only for the vertical drop
    if (!fx.speed.grp.parent) cam.add(fx.speed.grp);
    fx.speed.grp.visible = spd > 0.01;
    if (spd > 0.01) {
      for (const ln of fx.speed.lines) {
        const ph = (ln.ph + t * ln.sp) % 1;
        const y = lerp(-2.2, 2.2, ph);
        ln.mesh.position.set(ln.x, y, -2.0);
        ln.mesh.scale.set(ln.w, ln.len, 1);
        ln.mesh.material.opacity = spd * 0.38 * Math.sin(Math.PI * ph);
      }
    }
    // dotted arc
    const ad = fx.arcDots, m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const appear = (i) => sat((t - (9.6 + (i / ad.n) * 1.25)) / 0.25);
    for (let i = 0; i < ad.n; i++) {
      const p = this.arcPts[i];
      const tPass = 13.6 + (i + 0.5) / ad.n * 3.4;
      let s = easeOutBack(appear(i), 2.5) * (1 - smoothstep(tPass - 0.05, tPass + 0.25, t));
      s *= 1 + 0.15 * Math.sin(t * 8 - i * 0.6);
      s = Math.max(0, s);
      m4.compose(p, q, V(s, s, s)); ad.im.setMatrixAt(i, m4);
    }
    ad.im.instanceMatrix.needsUpdate = true;
    ad.im.visible = t > 9.5 && t < 17.3;
    const ringA = sat((t - 10.6) / 0.4) * (1 - smoothstep(16.6, 17.2, t));
    ad.ring.visible = ringA > 0.01; ad.ring.position.set(this.PLAZA_LAND.x, L.curbH + 0.03, this.PLAZA_LAND.z);
    ad.ringM.opacity = ringA * (0.7 + 0.3 * Math.sin(t * 6)); ad.ring.scale.setScalar(1 + 0.08 * Math.sin(t * 5));
    // suction arrows (point at the wall, flow toward it)
    const ar = fx.arrows; const aOn = smoothstep(18.25, 18.5, t) * (1 - smoothstep(21.75, 22.05, t));
    ar.im.visible = aOn > 0.01;
    if (ar.im.visible) {
      const pitch = c.pitch;
      const anchorX = lerp(c.p.x + 2.7, c.p.x + 0.5, sat(pitch / (Math.PI / 2)));
      let k = 0;
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) for (let rep = 0; rep < 2; rep++) {
        const ph = ((t * 1.6 + rep * 0.5 + row * 0.13 + col * 0.21) % 1);
        const along = lerp(-1.6, 1.6, row / 2);   // along the car length
        const across = lerp(-0.6, 0.6, col / 2);
        const fwdUp = V(Math.cos(pitch), Math.sin(pitch), 0);
        const base = c.p.clone().addScaledVector(fwdUp, along * sat(pitch / (Math.PI / 2)) + 0).add(V(0, (1 - sat(pitch / (Math.PI / 2))) * (0.2 + 0.4 * row / 2), across));
        base.x = anchorX + ph * (WALL_X - 0.05 - anchorX);
        const sc = aOn * Math.sin(Math.PI * ph) * 1.25;
        // chevron points toward +X (the wall)
        q.setFromUnitVectors(V(0, 1, 0), V(1, 0, 0));
        m4.compose(base, q, V(sc, sc, sc)); ar.im.setMatrixAt(k++, m4);
      }
      ar.im.instanceMatrix.needsUpdate = true;
      ar.m.opacity = 0.9;
    }
    // 45 degree indicator at the rear nozzles
    const an = fx.angle; const aShow = smoothstep(11.25, 11.5, t) * (1 - smoothstep(13.1, 13.4, t));
    an.grp.visible = aShow > 0.01;
    if (an.grp.visible) {
      const rn = this.car.nozzles.rear[0];
      const pivot = this.car.body.localToWorld(V(-2.2, 0.40, 1.15));
      an.grp.position.copy(pivot); an.grp.quaternion.copy(this.car.root.quaternion);
      const sweep = th.tilt / deg(45);
      an.arc.scale.setScalar(1); an.arc.visible = true;
      an.arc.geometry.dispose(); an.arc.geometry = new THREE.TorusGeometry(0.95, 0.022, 6, 32, Math.max(0.01, th.tilt));
      an.dirL.rotation.z = Math.PI / 2 + th.tilt;
      an.label.position.set(-1.0, 0.75, 0.3);
      an.label.quaternion.copy(this.car.root.quaternion).invert().multiply(this.cam.quaternion);
      an.m.opacity = aShow; an.labelM.opacity = aShow * sat((t - 11.6) / 0.3);
      void rn; void sweep;
    }
    // bonk impact star
    const im = fx.impact; const u = t - 7.0;
    im.mesh.visible = u > 0 && u < 0.45;
    if (im.mesh.visible) {
      const s = easeOutBack(sat(u / 0.12), 2) * (1 - smoothstep(0.2, 0.45, u)) * 0.75;
      im.mesh.position.copy(c.p).add(V(-1.2, -0.45, 1.25)); im.mesh.quaternion.copy(this.cam.quaternion); im.mesh.scale.setScalar(Math.max(0.001, s)); im.m.opacity = 1 - smoothstep(0.25, 0.45, u);
    }
    // honk rings in front of the car
    const hk = this.tl.events.john_honks;
    fx.honk.rings.forEach((r, i) => {
      const ht = hk[i % hk.length] + (i >= hk.length ? 0.12 : 0); const v = t - ht;
      r.visible = v > 0 && v < 0.6;
      if (r.visible) { const s = 0.5 + v * 2.4; r.position.copy(c.p).add(V(2.9 + v * 1.2, 0.2, 0.2)); r.quaternion.copy(this.cam.quaternion); r.rotateZ(-Math.PI * 0.3); r.scale.setScalar(s); r.material.opacity = 1 - v / 0.6; }
    });
    // foam
    const fc = this.foamCoatIM; const cm = this.car.body.matrixWorld;
    this.foamCoat.forEach((f, i) => {
      const grow = easeOutBack(sat((t - f.t0) / 0.45), 1.5) * (1 - smoothstep(f.t1, f.t1 + 0.5, t));
      const s = Math.max(0.0001, grow * f.r * (1 + 0.06 * Math.sin(t * 3 + i)));
      const p = f.p.clone().applyMatrix4(cm);
      m4.compose(p, q.identity(), V(s, s * 0.8, s)); fc.setMatrixAt(i, m4);
    });
    fc.instanceMatrix.needsUpdate = true; fc.visible = t > 46.8 && t < 51.0;
    const ff = this.foamFlyIM;
    this.foamFly.forEach((f, i) => {
      const age = t - f.bt; let s = 0.0001; const p = V();
      if (age > 0 && age < f.life) { const o = f.src.pivot.position; p.set(o.x, o.y + 0.5, o.z).addScaledVector(f.v, age); p.y -= 4.9 * age * age; if (p.y < WASH_FLOOR) p.y = WASH_FLOOR; s = f.r * Math.sin(Math.PI * Math.min(1, age / f.life)) + 0.0001; }
      m4.compose(p, q.identity(), V(s, s, s)); ff.setMatrixAt(i, m4);
    });
    ff.instanceMatrix.needsUpdate = true; ff.visible = t > 46.6 && t < 50.6;
    const fp = this.foamPileIM;
    this.foamPile.forEach((f, i) => { const s = Math.max(0.0001, f.r * smoothstep(f.t0, f.t0 + 0.8, t) * (1 - 0.6 * smoothstep(50.0, 51.5, t))); m4.compose(f.p, q.identity(), V(s, s * 0.55, s)); fp.setMatrixAt(i, m4); });
    fp.instanceMatrix.needsUpdate = true; fp.visible = t > 46.9;
    // water/foam jets
    for (const wj of this.waterJets) {
      const on = wj.nz.arch === 'rinse' ? pulse(t, 48.9, 50.55, 0.15, 0.3) : pulse(t, 46.6, 48.4, 0.15, 0.3);
      wj.m.visible = on > 0.01; wj.m.material.uniforms.uLevel.value = on; wj.m.material.uniforms.uTime.value = t;
    }
  }

  samplesAt(t) {
    if (t > 22.85 && t < 23.45) return 14; // whip from the roof run to the launch: smooth blur
    if (t > 23.3 && t < 28.9) return 8;   // tumble
    if (t > 19.3 && t < 23.4) return 7;   // climb + roof launch
    if (t > 31.5 && t < 34.3) return 7;   // drop
    if (t > 46.4 && t < 50.4) return 7;   // brushes
    if (t > 4.6 && t < 7.3) return 6;
    if (t > 13.4 && t < 17.3) return 6;
    if (t > 39.3 && t < 46.2) return 5;
    return 4;
  }
}
