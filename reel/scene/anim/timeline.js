// The whole story as pure functions of time t (seconds). apply(t) poses every object and the camera.
import * as THREE from 'three';
import * as GEO from '../world/geo.js';
import { updateTunnel } from '../world/tunnel.js';
import { updateParticles } from '../fx/particles.js';
import { moundGeometry, MAT } from '../props/machines.js';
import { CAR_L, FLOOR_Y } from '../props/train.js';
import { G, glowMaterial } from '../lib/materials.js';
import { track, ease, clamp, lerp, smoothstep, pop, dropBounce, cameraPath, hash1, deg } from '../lib/util.js';

const { TUBE_Z, BED_DROP, PORTAL_X } = GEO;
const floorT = (x) => GEO.tunnelY(x) - BED_DROP - 0.06;           // raw tunnel floor / valley road
const railTop = (x) => GEO.tunnelY(x) - BED_DROP + 0.26;
const CAR_GAP = CAR_L + 0.35;

// ---------------------------------------------------------------- TBM progress (cutter face x)
const digTBM = (t) => {
  if (t < 11.2) return 21.95;
  if (t < 12.0) return lerp(21.95, 25.5, ease.inOut((t - 11.2) / 0.8));
  if (t < 14.6) return lerp(25.5, 31.0, (t - 12.0) / 2.6);
  if (t < 16.5) return lerp(31.0, 40.0, (t - 14.6) / 1.9);
  if (t < 20.6) return lerp(40.0, 46.6, (t - 16.5) / 4.1);
  if (t < 25.9) return 46.6;
  if (t < 31.2) return lerp(46.6, 470, Math.pow((t - 25.9) / 5.3, 2.2));
  return 470;
};
const RING_BACK = 5.6;
// when does the TBM tail pass x? (numeric inverse; dig is monotonic)
function tailPassTime(x) {
  let a = 11, b = 31.3;
  if (digTBM(b) - RING_BACK < x) return null;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (digTBM(m) - RING_BACK >= x) b = m; else a = m; }
  return b;
}

// ---------------------------------------------------------------- train speed profile (scene 6 -> 7)
const DEP = 38.6, CRUISE_END = 42.2, STOP_T = 44.6, ACC = 60;
const X0_LEAD = -2.0;
const VMAX = (() => { // solve 4.4 v - v^2/(2*ACC) = distance (accel + cruise + cubic ease-out over 2.4 s)
  const D = GEO.STATION_STOP - X0_LEAD; const a = 1 / (2 * ACC), b = -((CRUISE_END - DEP) + 2.4 / 3), c = D;
  return (-b - Math.sqrt(b * b - 4 * a * c)) / (2 * a);
})();
function leadX(t) {
  if (t <= DEP) return X0_LEAD;
  const t1 = DEP + VMAX / ACC;
  const dAcc = (VMAX * VMAX) / (2 * ACC);
  if (t < t1) return X0_LEAD + 0.5 * ACC * (t - DEP) ** 2;
  if (t < CRUISE_END) return X0_LEAD + dAcc + VMAX * (t - t1);
  const xc = X0_LEAD + dAcc + VMAX * (CRUISE_END - t1);
  const u = clamp((t - CRUISE_END) / 2.4);
  return xc + (VMAX * 2.4 / 3) * (1 - Math.pow(1 - u, 3));
}
const leadSpeed = (t) => (leadX(t + 0.005) - leadX(t - 0.005)) / 0.01;

// ---------------------------------------------------------------- excavator dig cycle
function digCycle(u, sw) {
  return track([
    [0.00, [0.00, 0.22, -1.45, 1.10, 0]],
    [0.45, [0.00, -0.28, -0.55, 0.15, 0]],
    [0.62, [0.00, -0.36, -0.95, 1.85, 1]],
    [0.95, [0.00, 0.38, -1.35, 2.05, 1]],
    [1.40, [sw, 0.55, -0.95, 2.05, 1]],
    [1.62, [sw, 0.48, -0.80, -0.35, 0], 'out'],
    [2.00, [0.00, 0.22, -1.45, 1.10, 0]],
  ])(u);
}

export function createTimeline(ctx) {
  const { TL, VOICE, world, tunnel, exc, exc2, doz, truck1, truck2, tbm, cars, shuttle, john, oldJohn, fx, sun, hemi, points, bloom, grade, camera, renderer, scene } = ctx;
  exc2.root.visible = false;
  const lead = cars[0];

  // rubble pile pushed by the bulldozer
  const rubble = new THREE.Group();
  const rm = new THREE.Mesh(moundGeometry(0.9, 0.55, 1.1, 9), MAT.rock); rm.castShadow = rm.receiveShadow = true; rubble.add(rm);
  for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + 0.12 * hash1(i), 0), MAT.rock); c.position.set((hash1(i + 3) - 0.5) * 1.2, 0.25 + hash1(i + 9) * 0.3, (hash1(i + 5) - 0.5) * 1.6); c.rotation.set(i, i * 2, 0); c.castShadow = true; rubble.add(c); }
  scene.add(rubble);

  // speed streaks around the train
  const streakMat = glowMaterial('#ffe7c2', 6, 'streak');
  const streaks = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.025, 1, 2, 6).rotateZ(Math.PI / 2), streakMat, 26);
  streaks.frustumCulled = false; scene.add(streaks);

  // John's mouth follows the word timings of his voice line (placed at its cue)
  const johnCue = TL.voice_windows['07_john'].cue;
  const johnWords = VOICE?.lines?.['07_john']?.words || [{ start: 0.0, end: 0.5 }, { start: 1.4, end: 2.0 }];
  const ev = (type) => TL.sfx.filter((e) => e.type === type).map((e) => e.t);
  const tapTimes = ev('stick_tap');

  // ---------------------------------------------------------------- camera
  const P = (x, y, z) => [x, y, z];
  const camKeys = [
    { t: 0.0, pos: P(-36, 18, 52), look: P(12, 6.5, -14), fov: 40 },
    { t: 2.6, pos: P(-9, 7.0, 23), look: P(5.5, 4.4, -3), fov: 40 },
    { t: 5.2, pos: P(-2.5, 6.6, 19), look: P(8.5, 4.8, -2.5), fov: 40 },
    { t: 7.0, pos: P(11, 5.6, 23), look: P(16.5, 5.0, -1.5), fov: 40 },
    { t: 7.95, pos: P(17.0, 5.3, 21.5), look: P(19.0, 4.8, -1.2), fov: 40 },
    { t: 8.7, pos: P(18.3, 4.6, 17), look: P(19.9, 4.3, -1.2), fov: 40, ease: 'outCubic' },
    { t: 10.4, pos: P(16.5, 6.0, 26.5), look: P(18.0, 5.2, -1.5), fov: 40 },
    { t: 12.0, pos: P(18.5, 6.0, 26.5), look: P(19.5, 5.2, -1.5), fov: 40 },
    { t: 13.6, pos: P(13.0, 6.3, 27.5), look: P(13.0, 5.3, -1.5), fov: 40 },
    { t: 15.3, pos: P(24.0, 6.0, 26.5), look: P(24.5, 5.0, -1.3), fov: 40 },
    { t: 17.2, pos: P(34.0, 4.1, 24.0), look: P(35.0, 3.3, -1.3), fov: 40 },
    { t: 19.6, pos: P(38.5, 3.3, 22.5), look: P(39.5, 2.4, -1.3), fov: 40 },
    { t: 21.5, pos: P(58, 16, 70), look: P(64, 13, -4), fov: 40 },
    { t: 22.4, pos: P(48, 7.5, 24), look: P(53, 6.0, -1), fov: 40 },
    { t: 24.6, pos: P(49, 7.0, 25), look: P(53.5, 5.6, -1), fov: 40 },
    { t: 25.4, pos: P(64, 3.5, 47), look: P(68, 0.5, -2), fov: 40 },
    { t: 28.0, pos: P(66, 4.0, 48), look: P(70, 0.5, -2), fov: 40 },
    { t: 29.9, pos: P(85, 34, 118), look: P(190, 6, -20), fov: 40 },
    { t: 31.2, pos: P(-12, 50, 116), look: P(215, 2, -32), fov: 40 },
    { t: 32.0, pos: P(19, 8.6, 10.5), look: P(-10, 3.2, -2.5), fov: 40 },
    { t: 33.8, pos: P(19.5, 8.4, 11.0), look: P(-9, 3.0, -2.5), fov: 40 },
    { t: 34.7, pos: P(23, 8.0, 14.0), look: P(3.0, 2.6, -2.4), fov: 40 },
    { t: 35.5, pos: P(23, 7.8, 14.5), look: P(4.0, 2.5, -2.4), fov: 40 },
    { t: 36.4, pos: P(-30, 26, 64), look: P(70, 1, -8), fov: 40 },
    { t: 37.0, pos: P(-31, 25, 62), look: P(68, 1, -8), fov: 40 },
    { t: 37.4, pos: P(-27, 6.6, 18), look: P(-47, 4.9, -4), fov: 40 },
    { t: 38.5, pos: P(-26, 6.4, 17.5), look: P(-46, 4.8, -4), fov: 40 },
    { t: 39.1, pos: P(-4, 5.0, 18), look: P(14, 2.8, -1), fov: 40, ease: 'inOutCubic' },
    { t: 39.4, pos: P(8, 4.4, 14), look: P(20, 2.4, -1.2), fov: 40, ease: 'inOut' },
  ];
  const camPath = cameraPath(camKeys);
  const stationCam = cameraPath([
    { t: 44.3, pos: P(0.6, 2.1, 12.0), look: P(0.0, 1.9, 1.5), fov: 40 },
    { t: 47.8, pos: P(0.4, 1.75, 9.6), look: P(0.0, 1.45, 2.6), fov: 40 },
    { t: 49.0, pos: P(0.3, 1.75, 7.9), look: P(0.0, 1.62, 2.75), fov: 40 },
    { t: 53.0, pos: P(0.2, 1.72, 6.9), look: P(0.0, 1.6, 2.75), fov: 40 },
  ]);

  const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
  const o = new THREE.Object3D();
  const emit = [];

  // place a machine on the floor of the tunnel/valley
  function place(m, x, z, yaw, { floor = null, tilt = true } = {}) {
    const y = floor ?? (x >= 6 && z > -3.4 ? floorT(x) : GEO.terrainH(x, z));
    m.root.position.set(x, y, z);
    const a = tilt && x >= 6 ? GEO.slopeAngle(GEO.tunnelY, x) : 0;
    m.root.rotation.set(0, yaw, Math.cos(yaw) * a);
  }

  const rowYaw = (x, z) => Math.atan2(-(18 - z), (-27 - x));
  function apply(t) {
    emit.length = 0;
    const dig = digTBM(t);
    const scene1 = t < 7.6, scene2 = t >= 7.6 && t < 14.6;

    // ============================================================ tunnel state
    const st = {
      digMain: PORTAL_X, ringsTo: PORTAL_X, trackTo: PORTAL_X, steepDig: GEO.JUNCTION_X, dotsT: 1e9, dotsClearTo: -1e9, dotsGlow: 1,
      lampsOn: 0, stripOn: 0, portalPop: 0, portalLamp: 0, plugFront: 6.0, stationOpen: true, trackA: 0, trackB: 0, lampStretch: 1,
    };
    // excavator digs the soil part, then the TBM takes over
    if (t < 4.6) st.digMain = PORTAL_X;
    else if (t < 6.3) st.digMain = PORTAL_X + 0.85;   // the hillside is dug away: a soil face waits behind the portal
    else if (t < 7.9) st.digMain = lerp(PORTAL_X + 0.85, 21.95, ease.inOut((t - 6.3) / 1.6));
    else st.digMain = Math.max(21.95, dig);
    st.plugFront = t < 2.45 ? 6.0 : t < 2.62 ? lerp(6.0, 9.2, ease.out((t - 2.45) / 0.17)) : t < 4.45 ? 9.2 : t < 4.62 ? lerp(9.2, 14.0, ease.out((t - 4.45) / 0.17)) : 14.0;
    st.portalPop = pop(t, 5.6, 0.5);
    st.portalLamp = smoothstep(5.8, 6.3, t) * (t > 35 ? 6 : 3);
    // rings: ripple back to the portal + one ring per thunk at the tail, then following the TBM
    st.ringPop = (x) => {
      if (x < 34.4) return 16.6 + (34.4 - x) * 0.03;
      if (x < 40.9) return 16.6 + Math.round(x - 34.4) * 0.6;
      return tailPassTime(x);
    };
    if (t >= 16.55) st.ringsTo = t < 20.6 ? Math.min(40.9, 34.4 + Math.floor((t - 16.6) / 0.6 + 1e-6) + 0.5) : Math.max(40.9, dig - RING_BACK);
    if (t >= 16.55 && t < 20.6) st.ringsTo = Math.max(st.ringsTo, 34.45);
    st.trackTo = Math.max(PORTAL_X, st.ringsTo);
    st.lampsOn = smoothstep(17.0, 17.6, t) * 5.5 + smoothstep(29.5, 31, t) * 4.0 + smoothstep(34, 37, t) * 3.0;
    st.stripOn = smoothstep(29.5, 31.0, t) * 4.0 + smoothstep(35.5, 37.0, t) * 3.0;
    st.steepDig = t >= 20.0 ? GEO.STEEP_END : GEO.JUNCTION_X;
    st.dotsT = 24.9; st.dotsGlow = 1.0 - smoothstep(30.5, 31.5, t);
    st.dotsClearTo = t > 25.9 ? dig + 0.5 : -1e9;
    if (t < 24.9) st.dotsT = 1e9;
    st.trackA = t > 29.6 ? 1 : 0;
    st.trackB = pop(t, 35.22, 0.4);
    if (t > 39.0) st.lampStretch = 1 + clamp(leadSpeed(t) / 25, 0, 4);
    tunnel.ringMat.emissiveIntensity = smoothstep(29.5, 31.5, t) * 0.18 + smoothstep(35.0, 36.5, t) * 0.32;
    updateTunnel(tunnel, st, t, world.cutMat);

    // ============================================================ excavator
    {
      let x = 4.0, z = TUBE_Z, yaw = 0, drive = 0, pose = { swing: 0, boom: 0.22, stick: -1.45, bucketA: 1.1, load: 0 }, wobble = 0;
      const SW = 1.80;
      if (t < 1.8) { x = lerp(-14, 4.0, ease.outCubic(clamp(t / 1.8))); drive = x; }
      else if (t < 5.9) {
        x = t < 3.9 ? 4.0 : lerp(4.0, 5.2, ease.inOut(clamp((t - 3.9) / 0.4))); drive = 18 + x;
        const c0 = t < 3.9 ? 1.9 : 3.9;
        const u = clamp(t - c0, 0, 2.0);
        const [sw, b, s, bk, ld] = t < 1.9 ? [0, 0.22, -1.45, 1.1, 0] : digCycle(u, SW);
        pose = { swing: sw, boom: b, stick: s, bucketA: bk, load: ld };
      } else if (t < 7.6) {
        // drive into the new tunnel while scooping soil
        x = lerp(5.2, 15.8, ease.inOut(clamp((t - 6.0) / 1.5))); drive = 18 + x;
        const w = Math.sin((t - 6.0) * 7.0);
        pose = { swing: 0, boom: -0.12 + 0.08 * w, stick: -0.9 + 0.25 * w, bucketA: 0.9 + 0.6 * Math.sin((t - 6.0) * 7.0 + 1.2), load: 0.4 };
      } else if (t < 8.75) {
        x = 15.8; drive = 33.8;
        // swing the bucket into the face... CLANG at 8.0, then bounce back
        const r = track([[7.6, [-0.12, -0.9, 0.9]], [7.98, [-0.05, -0.42, 0.25], 'inCubic']])(Math.min(t, 7.98));
        let [b, s, bk] = r;
        if (t >= 8.0) {
          const tau = t - 8.0, dmp = Math.exp(-5.5 * tau);
          b += 0.28 * dmp * Math.sin(17 * tau) + 0.12 * (1 - dmp);
          s += -0.45 * dmp * Math.sin(17 * tau + 0.6) - 0.3 * (1 - dmp);
          bk += 0.5 * dmp * Math.sin(21 * tau);
          wobble = 0.07 * Math.exp(-4.5 * tau) * Math.sin(15 * tau);
        }
        pose = { swing: 0, boom: b, stick: s, bucketA: bk, load: 0 };
      } else if (t < 25.6) {
        // backs out of the tunnel (reverse beeps) and waits outside
        x = lerp(15.8, -9.0, ease.inOut(clamp((t - 8.75) / 1.7))); drive = 33.8 + (x - 15.8);
        pose = { swing: 0, boom: 0.3, stick: -1.5, bucketA: 1.4, load: 0 };
      } else if (t < 31.0) {
        // follows the boring machine down the deep path, scooping
        x = Math.max(GEO.JUNCTION_X - 9.0, dig - 13.5); drive = x;
        const w = Math.sin(t * 6.5);
        pose = { swing: 0, boom: -0.05 + 0.12 * w, stick: -0.95 + 0.3 * w, bucketA: 1.0 + 0.7 * Math.sin(t * 6.5 + 1.1), load: 0.5 };
      }
      if (t >= 31.0) {
        // parked in a row in the valley, facing the camera (scene 6)
        const k = clamp((t - 36.3) / 0.9);
        x = -57; z = lerp(-4.9, -3.9, ease.outCubic(k)); yaw = rowYaw(x, z); drive = z * 3;
        pose = { swing: 0, boom: 0.55, stick: -1.7, bucketA: 1.5, load: 0 };
        place(exc, x, z, yaw, { floor: 0, tilt: false });
      } else place(exc, x, z, yaw);
      exc.root.visible = !(t > 8.75 && t < 25.6 && x < -8.5) && !(t > 14.6 && t < 25.6);
      exc.update({ drive, ...pose, wobble });
      if (t >= 8.0 && t < 8.12) exc.root.position.y += 0.06 * Math.sin((t - 8.0) / 0.12 * Math.PI);
      // particles: scoops, dumps, digging, clang sparks
      const tip = () => exc.bucketTip(new THREE.Vector3()).clone();
      if (t > 2.3 && t < 3.1) emit.push({ id: 1, kind: 'clod', t0: 2.45, t1: 2.65, rate: 70, origin: () => new THREE.Vector3(7.2, 0.9, -1.0), vel: [-1.2, 3.5, 0.8], spread: [1.6, 1.4, 1.4], size: [0.08, 0.22], life: 1.4, floorY: 0.02 });
      if (t > 4.3 && t < 5.1) emit.push({ id: 2, kind: 'clod', t0: 4.45, t1: 4.65, rate: 70, origin: () => new THREE.Vector3(10.0, 1.2, -1.0), vel: [-1.2, 3.5, 0.8], spread: [1.6, 1.4, 1.4], size: [0.08, 0.22], life: 1.4, floorY: 0.02 });
      for (const [id, td] of [[3, 3.42], [4, 5.37]]) if (t > td - 0.1 && t < td + 1.6) {
        emit.push({ id, kind: 'clod', t0: td, t1: td + 0.3, rate: 80, origin: () => new THREE.Vector3(3.2, 3.6, -4.8), vel: [0, -1, 0], spread: [1.0, 0.8, 0.7], size: [0.08, 0.2], life: 1.2, floorY: 1.25 });
        emit.push({ id: id + 50, kind: 'dust', t0: td + 0.1, t1: td + 0.5, rate: 30, origin: () => new THREE.Vector3(3.2, 2.4, -4.6), vel: [0, 0.5, 0.6], spread: [1.2, 0.4, 0.8], size: [0.8, 1.6], life: 2.2, alpha: 0.35 });
      }
      if (t > 6.2 && t < 8.3) emit.push({ id: 5, kind: 'clod', t0: 6.3, t1: 7.6, rate: 40, origin: (ts) => new THREE.Vector3(st.digMain - 0.3, 0.9, -0.6), vel: [-2.5, 2.5, 1.0], spread: [1.5, 1.2, 1.0], size: [0.07, 0.2], life: 1.3, floorY: 0.16 });
      if (t > 7.95 && t < 8.8) {
        emit.push({ id: 6, kind: 'spark', t0: 8.0, t1: 8.12, rate: 500, origin: () => new THREE.Vector3(21.85, 0.9, -0.2), vel: [-3, 2.5, 2.5], spread: [3.5, 3.5, 3.5], size: [1, 1], life: 0.5 });
        emit.push({ id: 7, kind: 'dust', t0: 8.0, t1: 8.15, rate: 60, origin: () => new THREE.Vector3(21.7, 1.0, -0.6), vel: [-0.8, 0.3, 0.5], spread: [0.5, 0.5, 0.5], size: [0.4, 0.8], life: 1.0, alpha: 0.4, color: [0.8, 0.8, 0.8] });
      }
      if (t > 25.8 && t < 31.0 && exc.root.visible) emit.push({ id: 8, kind: 'clod', t0: 25.9, t1: 30.0, rate: 22, origin: (ts) => new THREE.Vector3(Math.max(GEO.JUNCTION_X - 9.0, digTBM(ts) - 13.5) + 4.2, GEO.tunnelY(digTBM(ts) - 6) - 0.6, -0.6), vel: [0.5, 3.0, 0.8], spread: [1.2, 1, 1], size: [0.08, 0.2], life: 1.2, floorY: (x) => floorT(x) });
    }

    // ============================================================ dump trucks
    {
      // truck 1: loaded by the excavator in scene 1, then drives off; parked in the row in scene 6
      let x = 2.3, z = -5.3, yaw = Math.PI, tip = 0, load = 0, drive = 0;
      load = t < 3.45 ? 0 : t < 5.4 ? 0.55 : 1.0;
      if (t > 3.4 && t < 3.6) load = lerp(0, 0.55, (t - 3.4) / 0.2);
      if (t > 5.35 && t < 5.55) load = lerp(0.55, 1.0, (t - 5.35) / 0.2);
      if (t > 5.9) { const k = clamp((t - 5.9) / 1.8); x = 2.3 - 30 * ease.in(k); drive = 30 * ease.in(k); }
      truck1.root.visible = t < 7.8 || t > 31;
      if (t > 31) { const k = clamp((t - 36.5) / 0.9); x = -45; z = lerp(-4.9, -3.9, ease.outCubic(k)); yaw = rowYaw(x, z); drive = z * 3; load = 0; place(truck1, x, z, yaw, { floor: 0, tilt: false }); }
      else place(truck1, x, z, yaw, { floor: GEO.terrainH(x, z), tilt: false });
      truck1.update({ drive, tip, load });
    }
    {
      // truck 2: waits at the portal for the rubble, then carries it away
      let x = -12, z = TUBE_Z, yaw = Math.PI, load = 0, drive = 0;
      if (t < 12.6) { x = lerp(-14, 9.0, ease.outCubic(clamp((t - 11.2) / 1.4))); drive = x; }
      else if (t < 13.8) { x = 9.0; drive = 9.0; }
      else { const k = clamp((t - 13.8) / 1.4); x = 9.0 - 26 * ease.in(k); drive = 9.0 + 26 * ease.in(k); }
      load = t < 13.55 ? 0 : clamp((t - 13.55) / 0.25);
      truck2.root.visible = t > 11.0 && t < 15.3 || t > 31;
      if (t > 31) { const k = clamp((t - 36.7) / 0.9); x = -39.5; z = lerp(-4.9, -3.9, ease.outCubic(k)); yaw = rowYaw(x, z); drive = z * 3; load = 0; place(truck2, x, z, yaw, { floor: 0, tilt: false }); }
      else place(truck2, x, z, yaw, { floor: x > 6 ? floorT(x) : 0, tilt: false });
      truck2.update({ drive, load, rockLoad: true });
      if (t > 13.35 && t < 14.4) emit.push({ id: 20, kind: 'rock', t0: 13.38, t1: 13.55, rate: 90, origin: () => new THREE.Vector3(12.3, 0.6, -1.0), vel: [-2.6, 5.2, 0], spread: [0.8, 0.8, 0.7], size: [0.12, 0.26], life: 1.0, floorY: 1.6 });
    }

    // ============================================================ bulldozer
    {
      let x = -20, z = TUBE_Z, yaw = Math.PI, lift = 1, drive = 0, vis = false;
      if (t > 10.5 && t < 14.6) {
        vis = true;
        if (t < 12.0) { x = lerp(2.0, 15.6, ease.inOut(clamp((t - 10.6) / 1.4))); lift = 1; }
        else if (t < 13.4) { x = lerp(15.6, 14.0, ease.inOut(clamp((t - 12.0) / 1.4))); lift = 1 - smoothstep(11.9, 12.2, t); }
        else { x = 14.0 + 0.4 * ease.out(clamp((t - 13.6) / 0.6)); lift = smoothstep(13.35, 13.55, t); }
        drive = -x;
        // rubble in front of the blade
        rubble.visible = t > 11.7 && t < 13.5;
        const bladeX = x - 2.3;
        rubble.position.set(bladeX - 0.3, floorT(bladeX), TUBE_Z + 0.1);
        rubble.scale.setScalar(clamp((t - 11.7) / 0.4) * (1 - smoothstep(13.38, 13.5, t)) + 1e-3);
        if (t > 11.5 && t < 12.6) emit.push({ id: 30, kind: 'rock', t0: 11.6, t1: 12.0, rate: 30, origin: () => new THREE.Vector3(13.2, 2.8, -1.2), vel: [0, -1, 0.3], spread: [0.8, 0.5, 0.6], size: [0.1, 0.22], life: 0.9, floorY: (xx) => floorT(xx) });
        if (t > 12.0 && t < 13.5) emit.push({ id: 31, kind: 'dust', t0: 12.05, t1: 13.4, rate: 14, origin: (ts) => new THREE.Vector3(lerp(15.6, 14.0, (ts - 12.0) / 1.4) - 2.6, floorT(13) + 0.3, -0.3), vel: [-0.6, 0.4, 0.6], spread: [0.4, 0.2, 0.4], size: [0.5, 1.0], life: 1.6, alpha: 0.3, color: [0.7, 0.68, 0.66] });
      } else rubble.visible = false;
      if (t > 34.2 && t < 35.85) {
        // smooths the last bit of track bed by the portal
        vis = true;
        const bx = (tt) => lerp(12.4, 8.0, ease.inOut(clamp((tt - 34.45) / 0.85)));
        x = bx(t);
        if (t > 35.3) x = 8.0 + 4.6 * ease.in(clamp((t - 35.32) / 0.5));
        lift = t < 35.3 ? 0 : smoothstep(35.3, 35.42, t); drive = -x;
        if (t < 35.4) emit.push({ id: 32, kind: 'clod', t0: 34.5, t1: 35.3, rate: 26, origin: (ts) => new THREE.Vector3(bx(ts) - 2.6, 0.25, -0.4), vel: [-1.2, 1.6, 0.9], spread: [0.6, 0.6, 0.8], size: [0.06, 0.15], life: 1.0, floorY: 0.0 });
        emit.push({ id: 33, kind: 'dust', t0: 34.5, t1: 35.3, rate: 12, origin: (ts) => new THREE.Vector3(bx(ts) - 2.4, 0.3, 0.0), vel: [-0.5, 0.5, 0.7], spread: [0.4, 0.2, 0.4], size: [0.6, 1.2], life: 1.8, alpha: 0.28 });
      }
      if (t > 35.8) { vis = true; const k = clamp((t - 36.4) / 0.9); x = -51; z = lerp(-4.9, -3.9, ease.outCubic(k)); yaw = rowYaw(x, z); lift = 0.4; drive = z * 3; place(doz, x, z, yaw, { floor: 0, tilt: false }); }
      else place(doz, x, z, yaw, { floor: x > 6 ? floorT(x) : 0 });
      doz.root.visible = vis;
      doz.update({ drive, bladeLift: lift });
    }

    // ============================================================ TBM
    {
      const asm = [pop(t, 9.43, 0.5), pop(t, 9.83, 0.5), pop(t, 10.23, 0.45), pop(t, 10.58, 0.45), 0];
      const x = Math.max(21.95, dig);
      tbm.root.visible = t > 9.3 && t < 31.3;
      tbm.root.position.set(x, GEO.tunnelY(x), TUBE_Z);
      tbm.root.rotation.set(0, 0, GEO.slopeAngle(GEO.tunnelY, x));
      const spinRate = smoothstep(10.9, 11.6, t) * 3.2 + (t > 25.9 ? 4 : 0);
      const spinA = t < 10.9 ? 0 : (t - 10.9) * spinRate * 0.8;
      const erectA = t > 16.4 && t < 20.6 ? Math.sin((t - 16.4) / 0.6 * Math.PI * 2) * 0.6 : 0;
      tbm.update({ asm, spinA, erectA, segShow: t > 16.2 && t < 20.4 ? 1 : 0 });
      if (t > 10.95 && t < 31.2) {
        const face = (ts) => { const xx = Math.max(21.95, digTBM(ts)); return new THREE.Vector3(xx + 0.5, GEO.tunnelY(xx) - 1.6, 0.35); };
        const fast = t > 25.9;
        emit.push({ id: 40, kind: 'spark', t0: 11.0, t1: 31.2, rate: fast ? 120 : 70, origin: face, vel: [-1.5, 2.2, 3.0], spread: [2.0, 2.0, 1.6], size: [1, 1], life: 0.42 });
        emit.push({ id: 41, kind: 'dust', t0: 11.0, t1: 31.2, rate: fast ? 18 : 12, origin: (ts) => face(ts).add(new THREE.Vector3(-0.6, 0.6, 0.2)), vel: [-1.0, 0.6, 1.0], spread: [0.6, 0.5, 0.6], size: [0.6, 1.4], life: 2.0, alpha: 0.3, color: [0.78, 0.76, 0.74] });
        emit.push({ id: 42, kind: 'rock', t0: 11.0, t1: 31.2, rate: fast ? 30 : 14, origin: (ts) => face(ts).add(new THREE.Vector3(-0.2, 0.9, -0.1)), vel: [-1.2, 1.0, 1.4], spread: [0.8, 0.8, 0.8], size: [0.06, 0.18], life: 1.0, floorY: (xx) => floorT(xx) });
      }
    }

    // ============================================================ crumbling walls (scene 3)
    if (t > 14.7 && t < 17.8) {
      for (const [id, t0, xc] of [[60, 14.95, 22], [61, 15.5, 27], [62, 15.95, 18.5]]) {
        emit.push({ id, kind: 'rock', t0, t1: t0 + 0.35, rate: 70, origin: (ts, i) => new THREE.Vector3(xc + (hash1(i * 3.1 + id) - 0.5) * 4.5, GEO.tunnelY(xc) + 2.1, -1.4 + hash1(i + id) * 1.2), vel: [0, -0.5, 0.6], spread: [0.6, 0.3, 0.6], size: [0.1, 0.32], life: 1.8, floorY: (x) => floorT(x) });
        emit.push({ id: id + 10, kind: 'dust', t0: t0 + 0.15, t1: t0 + 0.7, rate: 28, origin: (ts, i) => new THREE.Vector3(xc + (hash1(i * 1.7 + id) - 0.5) * 4.0, GEO.tunnelY(xc) - 1.0, -0.6), vel: [0, 0.6, 0.8], spread: [0.8, 0.3, 0.5], size: [0.8, 1.6], life: 2.4, alpha: 0.38, color: [0.72, 0.62, 0.52] });
      }
    }
    // ring thunk dust puffs
    if (t > 16.5 && t < 21) for (let k = 0; k < 7; k++) {
      const t0 = 16.6 + k * 0.6; const xr = 34.4 + k;
      emit.push({ id: 70 + k, kind: 'dust', t0, t1: t0 + 0.1, rate: 80, origin: () => new THREE.Vector3(xr, GEO.tunnelY(xr) - 1.9, -0.2), vel: [0, 0.4, 0.8], spread: [0.8, 0.2, 0.5], size: [0.35, 0.7], life: 1.1, alpha: 0.32, color: [0.85, 0.84, 0.8] });
    }

    // ============================================================ small shuttle on the steep first attempt (scene 4)
    {
      shuttle.visible = t > 20.0 && t < 28.8;
      let s = 0;
      if (t < 22.2) s = 0;
      else if (t < 23.55) s = 7.0 * ease.outCubic((t - 22.2) / 1.35);
      else if (t < 23.7) s = 7.0;
      else if (t < 24.75) s = 7.0 - 8.2 * ease.in((t - 23.7) / 1.05);
      else s = -1.2 + 0.25 * Math.exp(-6 * (t - 24.75)) * Math.sin((t - 24.75) * 14);
      const x0 = 49.0;
      const x = GEO.xAtArc(GEO.steepY, x0, Math.abs(s), Math.sign(s) || 1);
      const y = GEO.steepY(x) - BED_DROP + 0.26;
      shuttle.position.set(x, y, TUBE_Z);
      shuttle.rotation.set(0, 0, GEO.slopeAngle(GEO.steepY, x));
      shuttle.userData.update({ dist: t < 23.7 ? s : 7 + (t - 23.7) * 6 });
      if (t > 23.7 && t < 24.8) emit.push({ id: 80, kind: 'spark', t0: 23.75, t1: 24.75, rate: 70, origin: (ts) => { const xx = GEO.xAtArc(GEO.steepY, x0, Math.abs(7.0 - 8.2 * ease.in((ts - 23.7) / 1.05)), 1); return new THREE.Vector3(xx - 1.4, GEO.steepY(xx) - BED_DROP + 0.3, 0.05); }, vel: [-0.5, 1.6, 1.4], spread: [1.0, 0.8, 0.8], size: [1, 1], life: 0.35 });
    }

    // ============================================================ train
    {
      const visible = t > 29.6;
      const clicks = [null, 32.2, 32.9, 33.6];
      const lx = leadX(t);
      cars.forEach((car, i) => {
        car.visible = visible && (i === 0 || t > clicks[i] - 0.62);
        let x = lx - i * CAR_GAP, yOff = 0;
        if (i > 0 && t < clicks[i] + 0.8) {
          const land = clicks[i] - 0.14;
          yOff = dropBounce(t, clicks[i] - 0.56, 5.5, 0.42);
          x -= 0.45 * (1 - smoothstep(land, clicks[i], t));
        }
        const y = railTop(x) + yOff;
        car.position.set(x, y, TUBE_Z);
        car.rotation.set(0, 0, GEO.slopeAngle(GEO.tunnelY, x));
        car.userData.update({ dist: x, doorOpen: i === 0 ? smoothstep(45.35, 46.05, t) : 0 });
        if (i > 0 && t > clicks[i] - 0.2 && t < clicks[i] + 1.2) {
          emit.push({ id: 90 + i, kind: 'dust', t0: clicks[i] - 0.12, t1: clicks[i] - 0.02, rate: 160, origin: () => new THREE.Vector3(lx - i * CAR_GAP + (hash1(i) - 0.5) * 6, 0.4, -0.2), vel: [0, 0.3, 1.0], spread: [3.0, 0.2, 0.6], size: [0.5, 1.0], life: 1.3, alpha: 0.25 });
        }
      });
      // speed streaks
      const v = leadSpeed(t);
      const sv = smoothstep(30, 70, v);
      streaks.visible = sv > 0.01 && t > 38.6 && t < 44;
      if (streaks.visible) {
        for (let i = 0; i < 26; i++) {
          const span = 40, ph = hash1(i * 5.1) * span;
          const rel = ((ph - t * v * 0.6) % span + span) % span - span * 0.6;
          const len = (3 + hash1(i * 2.3) * 7) * sv;
          const y = railTop(lx) + 0.4 + hash1(i * 7.7) * 3.6;
          const z = lerp(-2.9, 0.9, hash1(i * 9.1));
          o.position.set(lx + rel, y, z); o.rotation.set(0, 0, GEO.slopeAngle(GEO.tunnelY, lx)); o.scale.set(len, 1, 1); o.updateMatrix();
          streaks.setMatrixAt(i, o.matrix);
        }
        streaks.instanceMatrix.needsUpdate = true;
        streakMat.emissiveIntensity = 5 * sv;
      }
    }

    // ============================================================ John (young, in the window) and old John (station)
    {
      const winX = lead.userData.johnWindowX;
      john.root.visible = t > 37.0 && t < 45.4;
      lead.updateMatrixWorld(true);
      john.root.position.set(winX, FLOOR_Y - 0.02, 0.45).applyMatrix4(lead.matrixWorld);
      john.root.rotation.set(0, 0, lead.rotation.z);
      john.update({ wave: t * 9.0, lookX: 0.2, smile: 1.15, snackUp: 0.5, blink: (t % 3.1) < 0.12 ? 1 : 0, browUp: 0.6 });

      oldJohn.root.visible = t > 45.5;
      if (oldJohn.root.visible) {
        const doorX = lead.userData.doorsX[0];
        const wk = clamp((t - 45.9) / 1.9);
        const zl = lerp(-0.45, 2.75, ease.inOut(wk));
        const platY = tunnel.station.platY;
        const carFloor = railTop(GEO.STATION_STOP) + FLOOR_Y;
        const y = lerp(carFloor, platY, smoothstep(1.05, 1.35, zl));
        oldJohn.root.position.set(lead.position.x + doorX + 0.05 * Math.sin(wk * 3), y, TUBE_Z + zl);
        oldJohn.root.rotation.set(0, 0, 0);
        const walking = t > 45.9 && t < 47.85 ? 1 : 0;
        const walk = (t - 45.9) * Math.PI / 0.35;
        // stick taps: lift between taps
        let stickLift = 0;
        for (const tt of tapTimes) { const d = t - tt; if (d > -0.35 && d < 0) stickLift = Math.max(stickLift, Math.sin((d + 0.35) / 0.35 * Math.PI)); }
        // look around slowly, then talk
        const yaw = track([[47.85, 0], [48.25, -0.55], [48.55, -0.55], [48.85, 0.45], [49.05, 0.45], [49.35, 0.0]])(t);
        let talk = 0;
        for (const w of johnWords) { const a = johnCue + w.start, b = johnCue + w.end; if (t > a && t < b) talk = 0.45 + 0.55 * Math.abs(Math.sin((t - a) * 16)); }
        oldJohn.update({ walk, walking, stickLift, headYaw: yaw, headPitch: t > 49 ? -0.08 : 0, lookX: yaw * 1.4, talk, smile: 0.6, blink: (t > 51.9 && t < 52.05) || (t > 48.4 && t < 48.5) ? 1 : 0, browUp: t > 49 && t < 52 ? 0.8 : 0.2, headTilt: t > 50.3 ? 0.12 * smoothstep(50.3, 50.8, t) : 0 });
        if (tapTimes.some((tt) => t > tt && t < tt + 0.8)) {
          const tt = tapTimes.find((x) => t > x && t < x + 0.8);
          emit.push({ id: 100 + Math.round(tt * 10), kind: 'dust', t0: tt, t1: tt + 0.05, rate: 120, origin: () => new THREE.Vector3(oldJohn.root.position.x + 0.3, oldJohn.root.position.y + 0.02, oldJohn.root.position.z + 0.15), vel: [0, 0.15, 0.2], spread: [0.25, 0.05, 0.25], size: [0.12, 0.25], life: 0.9, alpha: 0.25, color: [0.85, 0.82, 0.78] });
        }
      }
    }

    // ============================================================ headlights / glow
    {
      const flash = [37.6, 37.85, 38.1].reduce((a, ft) => Math.max(a, Math.exp(-Math.pow((t - ft) / 0.07, 2))), 0);
      const base = t < 31 ? 1.3 : 2.0;
      MAT.head.emissiveIntensity = base + flash * 45;
      world.dusk.lanterns.emissiveIntensity = smoothstep(33, 38, t) * 2.2;
    }

    updateParticles(fx, emit, t);

    // ============================================================ sky, sun, fog: golden hour -> sunset -> dusk
    {
      const el = deg(track([[0, 13], [30, 10], [37, 4.5], [44, 2.0], [53, 1.5]])(t));
      const az = deg(62);
      G.uSunDir.value.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize();
      const dk = smoothstep(30, 40, t);
      sun.intensity = lerp(3.3, 1.5, dk);
      sun.color.set('#ffd2a1').lerp(new THREE.Color('#ff9f63'), dk);
      hemi.intensity = lerp(0.7, 0.45, dk);
      hemi.color.set('#bcd2ff').lerp(new THREE.Color('#8f9fd8'), dk);
      scene.environmentIntensity = lerp(0.6, 0.38, dk);
      const U = world.sky.userData.U;
      U.uZenith.value.set('#4b82c4').lerp(new THREE.Color('#2b3f78'), dk);
      U.uHorizon.value.set('#ffb36c').lerp(new THREE.Color('#f27d4d'), dk);
      U.uSunCol.value.set('#ffd08a').lerp(new THREE.Color('#ff8f4f'), dk);
      U.uBelow.value.set('#6b5a54').lerp(new THREE.Color('#3e3446'), dk);
      G.uFogWarm.value.set('#f6bf86').lerp(new THREE.Color('#e98e62'), dk);
      G.uFogCool.value.set('#9fb6d6').lerp(new THREE.Color('#7480a8'), dk);
      G.uFogDensity.value = 0.0024; G.uFogFalloff.value = 0.03; G.uFogBase.value = -2;
      renderer.toneMappingExposure = lerp(1.0, 1.08, dk) * (t > 43.5 ? lerp(1, 0.9, smoothstep(43.5, 44.5, t)) : 1);
      ctx.fx.dustMat.uniforms.uLight.value.copy(sun.color).multiplyScalar(0.55 + 0.4 * (1 - dk)).addScalar(0.15);
    }

    // ============================================================ local lights
    {
      const [p0, p1, p2] = points;
      // work light near the dig front
      const wx = t < 7.6 ? 12 : Math.max(21.95, dig) - 3.5;
      p0.position.set(wx, GEO.tunnelY(wx) + 1.4, 0.4);
      p0.intensity = t > 5.8 && t < 31 ? 18 : 0; p0.distance = 14; p0.color.set('#ffcf94');
      // station lamps
      p1.position.set(GEO.STATION_STOP - 2.5, tunnel.station.platY + 3.4, 1.4);
      p1.intensity = t > 41 ? 7 : 0; p1.distance = 16; p1.color.set('#ffe3b8');
      // warm interior light on John's face in the train window
      tmpV.set(lead.userData.johnWindowX, FLOOR_Y + 1.35, 0.9).applyMatrix4(lead.matrixWorld);
      p2.position.copy(tmpV); p2.intensity = t > 37 && t < 45.4 ? 0.7 : 0; p2.distance = 2.5; p2.color.set('#ffd2a0');
    }

    // ============================================================ camera
    let cam;
    if (t < 39.4) cam = camPath(t);
    else {
      lead.updateMatrixWorld(true);
      const wx = lead.userData.johnWindowX;
      const trackPos = new THREE.Vector3(wx + 0.4, FLOOR_Y + 2.05, 7.6).applyMatrix4(lead.matrixWorld);
      const trackLook = new THREE.Vector3(wx, FLOOR_Y + 1.85, 0.45).applyMatrix4(lead.matrixWorld);
      const tc = { pos: trackPos, look: trackLook, fov: 40 };
      if (t < 40.0) {
        const a = camPath(Math.min(t, 39.4)); const k = ease.inOut(clamp((t - 39.4) / 0.6));
        cam = { pos: a.pos.clone().lerp(tc.pos, k), look: a.look.clone().lerp(tc.look, k), fov: 40 };
        // keep up with the train while blending
        const lagX = leadX(t) - leadX(39.4);
        cam.pos.x += lagX * (1 - k); cam.look.x += lagX * (1 - k);
      } else if (t < 43.6) cam = tc;
      else {
        const doorX = lead.userData.doorsX[0];
        const base = new THREE.Vector3(GEO.STATION_STOP + doorX, tunnel.station.platY, TUBE_Z);
        const sc = stationCam(t);
        const sp = sc.pos.clone().add(base), sl = sc.look.clone().add(base);
        const k = ease.inOut(clamp((t - 43.6) / 1.4));
        cam = { pos: tc.pos.clone().lerp(sp, k), look: tc.look.clone().lerp(sl, k), fov: lerp(40, sc.fov, k) };
      }
    }
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    camera.fov = cam.fov;
    // tiny handheld drift + a shake on impacts
    const shake = 0.05 * Math.exp(-7 * Math.max(0, t - 8.0)) * (t >= 8.0 ? 1 : 0) + 0.025 * [14.95, 15.5, 15.95].reduce((a, tt) => a + (t >= tt ? Math.exp(-6 * (t - tt)) : 0), 0);
    camera.rotation.z += shake * Math.sin(t * 61) + 0.0015 * Math.sin(t * 0.9);
    camera.rotation.x += shake * Math.sin(t * 47 + 1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const dist = cam.pos.distanceTo(cam.look);
    return { focus: cam.look.clone(), shadowExtent: clamp(dist * 0.62, 9, 150) };
  }

  function blurAt(t) {
    if (t > 38.75 && t < 43.9) return 5;
        return 0;
  }

  return { apply, blurAt, leadX, digTBM };
}
