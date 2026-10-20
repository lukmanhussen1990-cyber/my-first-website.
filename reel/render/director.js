// The director: pure functions of time -> where everything is. No state, so
// any frame can be rendered alone.
import * as THREE from 'three';
import { LAYOUT, pathAtS, pathAtDepth } from './layout.js';
import { clamp, lerp, smoothstep, smootherstep, easeIn, easeOut, popBounce, springSettle } from './lib/util.js';

const L = LAYOUT;
export const CAR_X0 = 3.6;            // car origin x on the lawn
const ROLL = 1.5;                     // it rolls this far before the front wheels drop
// The hole's rim where the wheel tracks cross it (the cut face slices the shaft off-centre).
const RIM_X = Math.sqrt(LAYOUT.TUNNEL_R ** 2 - 0.848 ** 2);
export const LAND_LOCAL = new THREE.Vector3(-6.2, 0, -2.0); // where the car lands on the beach (far-local)
export const LAND_YAW = 0.0;          // pure side view: driver's door faces the camera
export const TOURIST_LOCAL = new THREE.Vector3(-7.95, 0, -0.42);
const NOSE_LX = 2.25, NOSE_LY = 0.45; // nose point in car space
const MID_LY = 0.6;                   // car's vertical middle in car space

// ---------------------------------------------------------------- interpolation
// Monotone cubic through [t, v] keys (no overshoot, speed stays positive).
export function monotone(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); m[i] = k * a * d[i]; m[i + 1] = k * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}
// Smooth keyframe track over objects of numbers: keys = [[t, {a:1,b:2}], ...].
export function track(keys) {
  const names = Object.keys(keys[0][1]);
  const fns = {};
  for (const nm of names) fns[nm] = smoothKeys(keys.map((k) => [k[0], k[1][nm]]));
  return (t) => { const o = {}; for (const nm of names) o[nm] = fns[nm](t); return o; };
}
// Ease between neighbouring keys (holds are flat, moves start and stop gently).
function smoothKeys(keys) {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        const u = smootherstep(a[0], b[0], t);
        return lerp(a[1], b[1], u);
      }
    }
    return keys[keys.length - 1][1];
  };
}

// ---------------------------------------------------------------- drill progress
export function makeTipTrack(E) {
  return monotone([
    [E.drill_go, 6.6], [E.drill_go + 0.8, 7.2], [15.3, 9.6], [18.3, 13.0], [22.8, 19.6],
    [26.3, 26.2], [30.3, 34.4], [35.4, 46.2], [35.9, 49.0], [36.3, 56.5], [36.8, 78.0],
    [37.25, 96.5], [37.7, 103.0], [38.6, 107.6], [41.4, 116.6], [42.75, 121.6], [45.0, 130.4],
    [46.6, 135.4], [47.0, 136.4],
  ]);
}

// ---------------------------------------------------------------- car pose
// Rotation in the film is tracked as theta = rotation about world z applied on
// top of the base yaw (car faces world -x). theta = 90 deg is nose straight down.
function poseFromNose(N, theta) {
  const F = new THREE.Vector2(-Math.cos(theta), -Math.sin(theta));
  const U = new THREE.Vector2(-Math.sin(theta), Math.cos(theta));
  return new THREE.Vector2(N.x - NOSE_LX * F.x - NOSE_LY * U.x, N.y - NOSE_LX * F.y - NOSE_LY * U.y);
}
function carPoint(P, theta, lx, ly) {
  return new THREE.Vector2(P.x - Math.cos(theta) * lx - Math.sin(theta) * ly, P.y - Math.sin(theta) * lx + Math.cos(theta) * ly);
}

const FAR_ROT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
export function farToWorld(v) { return new THREE.Vector3(-v.x, L.FAR_Y - v.y, v.z); }
export function worldToFar(v) { return new THREE.Vector3(-v.x, L.FAR_Y - v.y, v.z); }

export function makeCarTrack(TL) {
  const E = TL.events;
  const tip = makeTipTrack(E);
  // Tipping into the pit: angle profile (gravity-like), then a little bounce.
  const tipAngle = (t) => {
    const u = clamp((t - E.car_tip) / (E.car_land - E.car_tip));
    const base = (Math.PI / 2) * Math.pow(u, 1.7) * (1.0 + 0.04 * Math.sin(u * Math.PI));
    const settle = t > E.car_land ? springSettle(t - E.car_land, 3.0, 6.0) * 0.06 : 0;
    return Math.min(base, Math.PI / 2) + settle;
  };
  const pitPose = () => poseFromNose(new THREE.Vector2(0.15, -L.PIT_DEPTH), Math.PI / 2);
  void tipAngle;

  return function carAt(t) {
    const out = { theta: 0, pos: new THREE.Vector3(), wheelAngle: 0, wheelSpinRate: 0, drillScale: 0,
      drillSpin: 0, s: 0, region: 'yard', quat: new THREE.Quaternion(), extraYaw: 0, flight: 0 };
    let P, theta;
    if (t < E.car_roll) {
      P = new THREE.Vector2(CAR_X0, 0); theta = 0;
    } else if (t < E.car_tip) {
      const u = (t - E.car_roll) / (E.car_tip - E.car_roll);
      P = new THREE.Vector2(CAR_X0 - ROLL * u * u, 0); theta = 0;
      out.wheelAngle = (ROLL * u * u) / 0.365;
    } else if (t < E.car_land + 1.5) {
      const tVert = E.car_tip + 0.62;            // car hangs vertical at the edge
      out.wheelAngle = ROLL / 0.365 + (t - E.car_tip) * 6;
      if (t < tVert) {
        // belly slides over the rim while the car tips forward
        const u = (t - E.car_tip) / (tVert - E.car_tip);
        theta = (Math.PI / 2) * Math.pow(u, 1.55);
        const xc = lerp(0.95, -1.7, smoothstep(0, 1, u));
        const ex = lerp(RIM_X, 0.72, smoothstep(0.3, 1, u)); // rim where the wheels cross it, easing to the middle
        P = new THREE.Vector2(ex + xc * Math.cos(theta) + 0.15 * Math.sin(theta),
          xc * Math.sin(theta) - 0.15 * Math.cos(theta));
        const b = smoothstep(E.car_tip, E.car_tip + 0.12, t);
        P.set(lerp(CAR_X0 - ROLL, P.x, b), lerp(0, P.y, b));
      } else {
        // free fall down the shaft, sliding to the middle, then a thud and settle
        const hang = new THREE.Vector2(0.72 + 0.15, -1.7);
        const pp = pitPose();
        const u = clamp((t - tVert) / (E.car_land - tVert));
        P = new THREE.Vector2(lerp(hang.x, pp.x, smoothstep(0, 1, u)), lerp(hang.y, pp.y, u * u));
        theta = Math.PI / 2 + 0.05 * Math.sin(u * Math.PI);
        if (t > E.car_land) {
          const sp = springSettle(t - E.car_land, 3.2, 5.5);
          P.set(pp.x, pp.y - Math.max(0, sp) * 0.12);
          theta = Math.PI / 2 + sp * 0.02;
        }
      }
    } else if (t < E.drill_go) {
      P = pitPose(); theta = Math.PI / 2;
    }
    // Wheels spinning in the dirt: shake.
    if (t >= E.spin_start - 0.1 && t < E.drill_go) {
      const k = smoothstep(E.spin_start, E.spin_start + 0.3, t) * (1 - smoothstep(E.spin_end - 0.2, E.spin_end, t));
      out.wheelSpinRate = 38 * k;
      const j = Math.sin(t * 71.0) * 0.6 + Math.sin(t * 43.0 + 1.3) * 0.4;
      if (P) { P.x += j * 0.025 * k; P.y += Math.sin(t * 57.0) * 0.02 * k; }
      if (theta !== undefined) theta += Math.sin(t * 39.0) * 0.012 * k;
    }
    // Drill: snaps on with a bounce, spins up, drills along the path.
    if (t >= E.drill_snap) {
      out.drillScale = popBounce((t - E.drill_snap) / 0.38);
      if (t >= E.drill_stop) out.drillScale = 1 - popBounce((t - E.drill_stop) / 0.32);
      const spinUp = smoothstep(E.drill_spinup, E.drill_go, t);
      out.drillSpin = spinUp;
    }
    if (t >= E.drill_go) {
      const sTip = tip(t);
      out.s = sTip;
      const sNose = sTip - L.DRILL_LEN;
      const pNose = pathAtS(Math.max(0, sNose));
      theta = Math.PI / 2 + pNose.ang;
      // car centre line rides on the path centre line
      const U = new THREE.Vector2(-Math.sin(theta), Math.cos(theta));
      const N = new THREE.Vector2(pNose.x, pNose.y).addScaledVector(U, NOSE_LY - MID_LY);
      P = poseFromNose(N, theta);
      // drill-go handoff from the pit pose (tiny settle)
      const pp = pitPose(); const k = smoothstep(E.drill_go, E.drill_go + 0.35, t);
      P.set(lerp(pp.x, P.x, k), lerp(pp.y, P.y, k));
      out.region = sTip < 50 ? 'near' : sTip < 94 ? 'core' : 'far';
    }
    out.theta = theta ?? 0;
    out.pos.set(P.x, P.y, L.TUNNEL_Z);
    // Orientation: base yaw (face -x) then tip about world z.
    const qBase = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const qTip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), out.theta);
    out.quat.copy(qTip).multiply(qBase);
    // Burst out of the beach and land (computed in the far-local frame).
    if (t >= E.burst - 0.6) {
      const tb = E.burst;
      const exitS = pathAtDepth(-L.FAR_Y).s;   // surface crossing
      // until the burst the car keeps drilling (tip track already covers it)
      if (t >= tb) {
        const T = E.land - tb;
        const tau = Math.min(t - tb, T);
        const u = tau / T;
        // car centre at the burst (still in the tunnel, nose just under the sand)
        const sNoseB = tip(tb) - L.DRILL_LEN;
        const pN = pathAtS(sNoseB);
        const thB = Math.PI / 2 + pN.ang;
        const Fb = new THREE.Vector2(-Math.cos(thB), -Math.sin(thB));
        const cW = new THREE.Vector2(pN.x, pN.y).addScaledVector(Fb, -NOSE_LX);
        const c0 = worldToFar(new THREE.Vector3(cW.x, cW.y, L.TUNNEL_Z));
        // ballistic arc for the centre, landing on its wheels at LAND
        const g = 12.0;
        const cL = new THREE.Vector3(LAND_LOCAL.x, MID_LY, LAND_LOCAL.z);
        const vx = (cL.x - c0.x) / T, vy = (cL.y - c0.y + 0.5 * g * T * T) / T, vz = (cL.z - c0.z) / T;
        const c = new THREE.Vector3(c0.x + vx * tau, c0.y + vy * tau - 0.5 * g * tau * tau, c0.z + vz * tau);
        // rotation: from the exit lean (far-local) to level; yaw toward the camera
        const thL0 = thB - Math.PI;
        const thL = lerp(thL0, 0, smootherstep(0.05, 0.9, u));
        const yaw = lerp(0, LAND_YAW, smootherstep(0.15, 1.0, u));
        // landing: squash and settle
        let pitchBounce = 0, drop = 0;
        if (t > E.land) {
          const sp = springSettle(t - E.land, 2.4, 4.0);
          drop = Math.max(0, sp) * 0.11 - Math.max(0, -sp) * 0.03;
          pitchBounce = sp * 0.035;
        }
        const qb = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        const qt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), thL + pitchBounce);
        const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const qLocal = qy.multiply(qt).multiply(qb);
        // origin = centre minus the car-space centre offset (0, MID_LY, 0)
        const centreOff = new THREE.Vector3(0, MID_LY, 0).applyQuaternion(qLocal);
        const originL = c.clone().sub(centreOff); originL.y -= drop;
        out.quat.copy(FAR_ROT).multiply(qLocal);
        out.pos.copy(farToWorld(originL));
        out.flight = u;
        out.region = 'beach';
        out.originLocal = originL;
        out.qLocal = qLocal;
        out.yawLocal = yaw;
      }
      out.exitS = exitS;
    }
    return out;
  };
}

// Car-space point -> world, using a car state.
export function carToWorld(state, v) {
  return v.clone().applyQuaternion(state.quat).add(state.pos);
}

// ---------------------------------------------------------------- camera rig
// Keys: follow (0 = absolute target a*, 1 = follow the car), fh = frame height
// in metres at the target, sy = where the car centre sits on screen (0 top,
// 1 bottom), yaw/pitch in degrees, roll in degrees about the view axis.
export function makeCameraTrack(TL) {
  // cx/cy/cz: target offset from the car centre in car space (follows the car's
  // rotation); ox/oy: world offset; hz: lowest screen height (0..1, from the
  // bottom) that gets heat haze, so close-ups keep John's face crisp.
  const D = { follow: 1, ax: 0, ay: 0, az: -1.4, fh: 12, sy: 0.5, yaw: 0, pitch: 0, fov: 36, roll: 0, look: 0,
    ox: 0, oy: 0, cx: 0, cy: 0, cz: 0, hz: 0 };
  const k = (t, o) => [t, { ...D, ...o }];
  // John's face (and the hologram beside it) in car space, relative to the centre (0, 0.6, 0)
  const FACE = { cx: -0.2, cy: 0.4, cz: -0.38 };
  const HOLO = { cx: -0.1, cy: 0.36, cz: -0.36 };
  const keys = [
    k(0.0, { follow: 0, ax: 1.85, ay: 2.3, az: -4.6, fh: 15.5, sy: 0.5, yaw: 12, pitch: 9 }),
    k(4.3, { follow: 0, ax: 1.7, ay: 1.4, az: -3.6, fh: 12.5, sy: 0.5, yaw: 12, pitch: 8 }),
    // frame rides up while the car tips over the rim, so its tail stays under the subtitles
    k(5.3, { follow: 0, ax: 1.3, ay: 2.6, az: -2.9, fh: 13.5, sy: 0.5, yaw: 12, pitch: 6 }),
    k(6.4, { follow: 0, ax: 0.5, ay: -0.6, az: -2.2, fh: 12.0, sy: 0.5, yaw: 11, pitch: 5 }),
    k(8.4, { follow: 0, ax: 0.3, ay: -1.45, az: -1.8, fh: 12.0, sy: 0.5, yaw: 10, pitch: 3 }),
    k(11.3, { follow: 0, ax: 0.2, ay: -1.6, az: -1.6, fh: 12.0, sy: 0.5, yaw: 9, pitch: 2 }),
    k(12.4, { follow: 0, ax: 0.1, ay: -2.4, az: -1.5, fh: 12.5, sy: 0.5, yaw: 9, pitch: 2 }),
    k(14.6, { fh: 12.5, sy: 0.67, yaw: 8, pitch: 1 }),
    k(23.2, { fh: 12.5, sy: 0.68, yaw: 8, pitch: 1 }),
    // scene 4: push in on John through the side window; the camera turns a
    // quarter so he sits upright (car roof up, nose to the left)
    k(24.9, { fh: 2.5, sy: 0.6, yaw: -24, roll: 90, ...FACE, hz: 0.55 }),
    k(29.9, { fh: 2.3, sy: 0.6, yaw: -26, roll: 90, ...FACE, hz: 0.55 }),
    k(31.9, { fh: 60.0, sy: 0.18, yaw: 4 }),
    k(33.2, { fh: 58.0, sy: 0.18, yaw: 4 }),
    // the car stays above the subtitles while the thrusters fire (core below),
    // then rushes down the frame into the core and stays under them
    k(35.0, { fh: 24.0, sy: 0.19, yaw: 6 }),
    k(35.9, { fh: 24.0, sy: 0.2, yaw: 6 }),
    k(36.35, { fh: 16.0, sy: 0.66, yaw: 6, fov: 42 }),
    k(37.4, { fh: 16.0, sy: 0.72, yaw: 6, fov: 40, roll: 180 }),
    k(38.6, { fh: 14.0, sy: 0.75, yaw: 5, roll: 180 }),
    // scene 6: push in on John and the hologram globe
    k(40.2, { fh: 2.1, sy: 0.6, yaw: -22, roll: 90, ...HOLO, hz: 0.55 }),
    k(42.6, { fh: 2.0, sy: 0.6, yaw: -24, roll: 90, ...HOLO, hz: 0.55 }),
    k(43.9, { fh: 7.5, sy: 0.62, yaw: 5, roll: 180 }),
    k(44.6, { fh: 11.0, sy: 0.66, yaw: 6, roll: 180 }),
    k(46.2, { follow: 0, ax: -4.9, ay: 2.5, az: -1.8, fh: 12.5, sy: 0.5, yaw: 3, pitch: 6, roll: 180, look: 1 }),
    k(48.4, { follow: 0, ax: -6.25, ay: 1.75, az: -1.6, fh: 10.4, sy: 0.5, yaw: -4, pitch: 6, roll: 180, look: 1 }),
    k(50.6, { follow: 0, ax: -6.7, ay: 1.55, az: -0.8, fh: 5.6, sy: 0.5, yaw: -27, pitch: 6, roll: 180, look: 1 }),
    k(52.4, { follow: 0, ax: -6.65, ay: 1.55, az: -0.75, fh: 4.6, sy: 0.5, yaw: -29, pitch: 6, roll: 180, look: 1 }),
    k(55.6, { follow: 0, ax: -6.4, ay: 1.5, az: -0.85, fh: 3.5, sy: 0.5, yaw: -30, pitch: 6, roll: 180, look: 1 }),
  ];
  const tr = track(keys);
  return (t, carCentre, carQuat) => {
    const c = tr(t);
    const roll = THREE.MathUtils.degToRad(c.roll);
    const up = new THREE.Vector3(-Math.sin(roll), Math.cos(roll), 0);
    // absolute targets after the flip are given in the far-local frame
    let abs = new THREE.Vector3(c.ax, c.ay, c.az);
    if (c.look > 0.5) abs = farToWorld(abs);
    const local = new THREE.Vector3(c.cx, c.cy, c.cz);
    if (carQuat) local.applyQuaternion(carQuat);
    const fol = carCentre.clone().add(local).add(new THREE.Vector3(c.ox, c.oy, 0)).addScaledVector(up, (c.sy - 0.5) * c.fh);
    const target = abs.clone().lerp(fol, c.follow);
    const fovR = THREE.MathUtils.degToRad(c.fov);
    const dist = c.fh / (2 * Math.tan(fovR / 2));
    const yaw = THREE.MathUtils.degToRad(c.yaw), pitch = THREE.MathUtils.degToRad(c.pitch);
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(dist);
    off.applyAxisAngle(new THREE.Vector3(0, 0, 1), roll);
    return { pos: target.clone().add(off), target, up, fov: c.fov, fh: c.fh, roll, hz: c.hz };
  };
}
