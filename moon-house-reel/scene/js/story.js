// The film: every object's state as a pure function of time t (seconds).
import * as THREE from 'three';
import { createSlab, createSky, createEarth, createLights, createPebbles, createFootprints, setPit, groundHeight } from './world.js';
import { createJohn, pose } from './john.js';
import { createMachine, createPiles } from './machine.js';
import { createHouse, createMound, POD } from './house.js';
import { createGrains, createSparks, createMeteors, createAirDots, createTempFX, createIcons, createMagnifier, createTrail, glowSprite, G_MOON } from './fx.js';
import { kf, makeSpline, clamp, smoothstep, prog, ease, popScale, pulse, lerp, mulberry32 } from './util.js';

// ----------------------------------------------------------------- layout --
const DIG = { x: 0.6, z: -0.35 };                 // John's first little hole (at the cut edge)
const PIT = { x0: -2.0, x1: 3.6, zBack: -4.3, d1: 2.95, d2: 6.45 };
const POD_Y1 = -2.88, POD_Y2 = -6.38;             // room bottom: shallow, then deep
const MACH = { x: 5.35, z: -2.0 };
const HUT = { x: -4.6, z: -1.7 };
const FLAG = { x: -3.25, z: -0.85 };
const PILES = [{ x: 7.3, z: -1.3, r: 1.0, h: 0.95 }, { x: 8.6, z: -2.9, r: 1.15, h: 1.1 }, { x: 9.7, z: -1.2, r: 0.95, h: 0.85 }];
const TUBE_A = new THREE.Vector3(-0.15, POD_Y2 + POD.h - 0.1, -0.3);  // round window in the ceiling
const TUBE_B = new THREE.Vector3(-2.35, 0.05, -0.3);                   // glass dome at the surface

// scene starts and "So ..." cues (must match scene/timeline.json)
const S = { s1: 0, s2: 7.2, s3: 15.0, s4: 22.8, s5: 30.8, s6: 37.4, s7: 45.2, end: 55.0 };
const C = { c1: 4.1, c2: 11.3, c3: 19.1, c4: 26.7, c5: 33.1, c6: 41.0 };
export const CUES = { S, C };

export function buildStory(scene, camera) {
  scene.add(camera);
  const slab = createSlab(scene);
  createSky(scene);
  const earth = createEarth(scene);
  const lights = createLights(scene);
  createPebbles(scene, (x, z) =>
    (x > -2.4 && x < 3.9 && z > -4.6) || (x > -5.5 && x < -3.7 && z > -2.6 && z < -0.6) ||
    (x > 4.0 && x < 11.2 && z > -4.0) || Math.hypot(x - FLAG.x, z - FLAG.z) < 0.5 || (z > -1.5 && x > -3.2 && x < 1.8));
  const john = createJohn(scene);
  const mach = createMachine(scene);
  const house = createHouse(scene);
  const pileMat = new THREE.MeshStandardMaterial({ map: slab.reg.map, normalMap: slab.reg.normalMap, roughness: 0.98, color: 0xc2c2c4 });
  const piles = createPiles(scene, pileMat, PILES.map((p) => ({ ...p, y: groundHeight(p.x, p.z) - 0.02 })));
  const mound = createMound(scene, pileMat, slab.faceMat);
  const grains = createGrains(scene, 3200);
  const sparks = createSparks(scene, 700);
  const meteors = createMeteors(scene);
  const air = createAirDots(scene, 260);
  const tempfx = createTempFX(scene, { x0: -8, x1: 9, z0: -7, z1: -0.3 });
  const icons = createIcons(scene);
  const mag = createMagnifier(camera);
  const trails = [createTrail(scene), createTrail(scene)];
  const helmetProp = john.helmet.clone(); helmetProp.visible = false; scene.add(helmetProp);
  const sweat = glowSprite(new THREE.Color(0.6, 0.85, 1.4), 0.12, 0.9); sweat.visible = false; scene.add(sweat);
  const sparkles = []; for (let i = 0; i < 14; i++) { const s = glowSprite(new THREE.Color(1.6, 1.6, 1.4), 0.12, 1); s.visible = false; scene.add(s); sparkles.push(s); }
  const sealFlash = []; for (let i = 0; i < 4; i++) { const s = glowSprite(new THREE.Color(0.3, 1.4, 2.0), 0.45, 1); s.visible = false; scene.add(s); sealFlash.push(s); }
  const earthGlowOnFace = new THREE.PointLight(0x7fb0ff, 0, 3, 1.5); scene.add(earthGlowOnFace);
  const phoneGlow = new THREE.PointLight(0x9fc4ff, 0, 1.2, 1.5); scene.add(phoneGlow);

  // ---------------------------------------------------------- the pit ------
  // dig progress keys: [t, x0, x1, floorDepth, zBack]
  const pitKeys = [
    [2.80, DIG.x, DIG.x, 0.0, -0.05],
    [3.00, DIG.x - 0.42, DIG.x + 0.42, 0.34, -0.72],
    [7.5, DIG.x - 0.45, DIG.x + 0.45, 0.36, -0.75],
    [10.3, DIG.x - 0.55, DIG.x + 0.5, 0.48, -0.85],
    [12.75, DIG.x - 0.55, DIG.x + 0.5, 0.48, -0.85],
    [13.05, -0.9, 2.6, 1.4, -2.6],
    [13.95, -0.9, 2.6, 1.4, -2.6],
    [14.25, PIT.x0, PIT.x1, PIT.d1, PIT.zBack],
    [C.c4 + 0.6, PIT.x0, PIT.x1, PIT.d1, PIT.zBack],
    [C.c4 + 1.0, PIT.x0, PIT.x1, 4.6, PIT.zBack],
    [C.c4 + 1.9, PIT.x0, PIT.x1, 4.6, PIT.zBack],
    [C.c4 + 2.3, PIT.x0, PIT.x1, PIT.d2, PIT.zBack],
  ];
  function pitAt(t) {
    if (t < pitKeys[0][0]) return null;
    let k = pitKeys.length - 1;
    for (let i = 1; i < pitKeys.length; i++) if (t < pitKeys[i][0]) { k = i; break; }
    const a = pitKeys[Math.max(0, k - 1)], b = pitKeys[k];
    const u = t <= a[0] ? 0 : t >= b[0] ? 1 : ease.inOutCubic((t - a[0]) / (b[0] - a[0]));
    const v = [1, 2, 3, 4].map((i) => a[i] + (b[i] - a[i]) * u);
    return { x0: v[0], x1: v[1], floor: -v[2], zBack: v[3] };
  }
  // backfill: fill top rises from the pit floor to the surface, then the mound grows
  const fillTopAt = (t) => kf(t, [[C.c6 + 0.2, -PIT.d2], [C.c6 + 2.6, -0.02, 'inOutSine']]);
  const moundAt = (t) => kf(t, [[C.c6 + 2.3, 0], [C.c6 + 3.3, 1.25, 'outCubic']]);

  // room vertical position: drops into the pit, later moves down to the steady zone
  const podYAt = (t) => kf(t, [[14.35, 4.5], [14.95, POD_Y1, 'inQuad'], [C.c4 + 2.1, POD_Y1], [C.c4 + 3.0, POD_Y2, 'inOutCubic']]);
  const settle = (t, t0, a, w) => (t > t0 ? a * Math.exp(-6 * (t - t0)) * Math.sin((t - t0) * w) : 0);
  const podBounce = (t) => settle(t, 14.95, 0.06, 18) + settle(t, C.c4 + 3.0, 0.05, 16);

  // ground height for things landing (terrain, the pit floor, or off the edge into space)
  function groundAt(x, z, t = 10) {
    const p = pitAt(t);
    if (p && x > p.x0 && x < p.x1 && z > p.zBack && z < 0) return p.floor;
    if (x < -14 || x > 14 || z < -24 || z > 0) return -60;
    return groundHeight(x, z);
  }

  // -------------------------------------------------- dust batches ---------
  // John's shovel tosses (low gravity: way too high, way too far)
  const tossT = [3.02, 5.55, 6.65, 7.75, 8.95, 10.15];
  const tossV = [[0.6, 1.4, -0.2], [-1.0, 2.6, -0.8], [-2.2, 4.0, -0.95], [-1.4, 3.5, -1.4], [-0.9, 3.8, -2.2], [-2.3, 3.6, 0.5]];
  tossT.forEach((t0, i) => {
    const from = i === 0 ? [DIG.x + 0.5, 0.35, DIG.z - 0.1] : [DIG.x - 0.15, 0.9, DIG.z - 0.25];
    grains.add({ t0, n: i === 2 ? 70 : 45, seed: 100 + i, origin: from, vel: tossV[i], spread: [0.5, 0.6, 0.5], posSpread: [0.15, 0.08, 0.15], size: [0.015, 0.045], delay: 0.08, rest: 2.5, ground: (x, z) => groundAt(x, z, t0 + 3) });
    if (i === 2) grains.add({ t0, n: 1, seed: 999, origin: from, vel: tossV[i], spread: [0, 0, 0], size: [0.24, 0.24], rest: 3, ground: (x, z) => groundAt(x, z, t0 + 3) });
  });
  // arcs drawn as dotted trails (toss 3 and the big one over the crater)
  const arcPath = (i) => {
    const t0 = tossT[i], o = [DIG.x - 0.15, 0.9, DIG.z - 0.25], v = tossV[i];
    return (tt) => { const u = tt - t0; const y = o[1] + v[1] * u - 0.5 * G_MOON * u * u; const x = o[0] + v[0] * u, z = o[2] + v[2] * u;
      return y < groundAt(x, z, t0 + 3) - 0.02 ? null : [x, y, z]; };
  };
  const ARCS = [[2, arcPath(2)], [4, arcPath(4)]];
  // machine dumps onto the neat piles: [time, pile]
  const dumps = [[13.55, 0], [14.55, 1], [C.c4 + 1.55, 2], [C.c4 + 2.55, 1]];
  dumps.forEach(([t0, pi], i) => {
    const p = PILES[pi];
    grains.add({ t0, n: 120, seed: 300 + i, origin: [p.x, 1.55, p.z], vel: [0, -0.2, 0], spread: [0.25, 0.2, 0.25], posSpread: [0.25, 0.1, 0.2], size: [0.02, 0.045], delay: 0.5, rest: 0.6, ground: (x, z) => groundHeight(x, z) + 0.25 });
  });
  // backfill pours over the pit
  [C.c6 + 0.25, C.c6 + 1.25, C.c6 + 2.25].forEach((t0, i) => {
    grains.add({ t0, n: 160, seed: 400 + i, origin: [2.35 - i * 0.9, 1.7, -1.6], vel: [0, -0.2, 0], spread: [0.4, 0.2, 0.35], posSpread: [0.5, 0.1, 0.6], size: [0.02, 0.05], delay: 0.85, rest: 0.4, ground: () => Math.max(fillTopAt(t0 + 0.6), -3) });
  });
  // landing kick-up
  grains.add({ t0: 1.12, n: 40, seed: 7, origin: [-2.45, 0.05, -1.05], vel: [0, 0.9, 0], spread: [1.6, 0.6, 1.6], posSpread: [0.4, 0, 0.4], size: [0.01, 0.025], rest: 1.5, ground: (x, z) => groundHeight(x, z) });
  // space rocks
  const METEORS = [
    { t0: 37.85, t1: 38.55, to: [-4.2, 0, -5.0], from: [1.0, 18, -16], size: 0.24 },
    { t0: 38.85, t1: 39.45, to: [4.6, 0, -6.5], from: [10.0, 16, -18], size: 0.22 },
    { t0: 39.75, t1: 40.35, to: [-1.0, 0, -8.0], from: [4.0, 17, -20], size: 0.23 },
    { t0: 43.95, t1: 44.55, to: [0.9, 1.2, -1.6], from: [5.5, 17, -12], size: 0.2 },
  ];
  METEORS.forEach((m, i) => {
    m.to[1] = i === 3 ? 1.2 : groundHeight(m.to[0], m.to[2]);
    meteors.add(m);
    sparks.add({ t0: m.t1, pos: m.to, n: 110, speed: 3.6, seed: 50 + i, life: 1.0, scale: 2.4 });
    grains.add({ t0: m.t1, n: 55, seed: 60 + i, origin: [m.to[0], m.to[1] + 0.05, m.to[2]], vel: [0, 2.2, 0], spread: [3.2, 1.6, 3.2], posSpread: [0.2, 0, 0.2], size: [0.015, 0.04], rest: 2, ground: (x, z) => (i === 3 ? 0.9 : groundHeight(x, z)) });
  });
  const impactCraters = METEORS.slice(0, 3).map((m) => {
    const g = new THREE.RingGeometry(0.12, 0.42, 40); g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5c5c60, roughness: 1, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
    const ring = new THREE.Mesh(g, mat); ring.position.set(m.to[0], m.to[1] + 0.01, m.to[2]); ring.visible = false; scene.add(ring);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.06, 8, 40), pileMat); rim.rotation.x = Math.PI / 2; rim.position.copy(ring.position); rim.visible = false; rim.castShadow = true; scene.add(rim);
    return { ring, rim, t: m.t1 };
  });

  // footprints along John's walks
  const prints = [];
  const addPrints = (x0, z0, x1, z1, t0, t1, n) => {
    const yaw = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, side = i % 2 ? 1 : -1;
      prints.push({ x: lerp(x0, x1, u) + Math.cos(yaw) * 0.12 * side, z: lerp(z0, z1, u) - Math.sin(yaw) * 0.12 * side, rot: yaw, t: lerp(t0, t1, u) });
    }
  };
  addPrints(-2.55, -1.15, -2.35, -0.95, 1.15, 1.2, 2);
  addPrints(-2.3, -0.95, DIG.x + 0.9, DIG.z - 0.25, 2.25, 2.8, 4);
  addPrints(DIG.x + 0.9, DIG.z - 0.2, -2.65, -0.7, 11.6, 12.4, 4);
  addPrints(-2.7, -0.75, HUT.x, -0.75, 21.0, 21.6, 4);
  const footprints = createFootprints(scene, prints);

  // ------------------------------------------------------------ camera -----
  // framing rule: during narration, faces stay below the subtitle band (32-40% from the top)
  const camKeys = [
    [0.0, [6.5, 14.0, 64.0], [2.4, -3.6, -8.0]],
    [1.05, [1.2, 4.6, 24.0], [-1.6, 0.7, -2.0]],
    [2.2, [-1.2, 1.9, 7.6], [-2.0, 1.1, -1.0]],
    [3.1, [1.3, 1.95, 7.6], [1.0, 1.32, -0.6]],
    [4.3, [0.75, 1.35, 5.8], [0.62, 1.07, -0.6]],
    [5.2, [0.8, 1.4, 6.0], [0.7, 1.1, -0.6]],
    [6.6, [1.6, 2.15, 7.8], [1.0, 1.58, -0.6]],
    [7.7, [1.0, 2.6, 10.5], [0.0, 1.9, -1.2]],
    [9.3, [-2.4, 4.6, 26.0], [-2.8, 2.9, -3.0]],
    [10.75, [-2.7, 4.2, 25.0], [-3.2, 2.4, -3.0]],
    [11.9, [4.0, 2.2, 6.6], [4.9, 0.95, -1.8]],
    [13.0, [4.9, 3.8, 21.0], [4.7, 0.5, -2.0]],
    [14.2, [4.3, 3.8, 21.0], [3.9, 0.3, -2.0]],
    [15.0, [0.4, 2.6, 13.0], [0.0, -0.2, -1.8]],
    [15.9, [-2.0, 1.85, 6.0], [-2.6, 1.45, -0.7]],
    [17.8, [-2.1, 1.8, 5.6], [-2.6, 1.42, -0.7]],
    [19.4, [-2.3, 1.75, 5.9], [-2.75, 1.38, -0.8]],
    [21.0, [-3.4, 1.9, 7.8], [-3.7, 1.25, -1.2]],
    [22.6, [-3.2, 1.8, 8.4], [-3.5, 1.0, -1.4]],
    [24.0, [1.0, 0.9, 15.5], [1.0, -0.6, -2.0]],
    [26.6, [0.9, 0.8, 15.2], [0.9, -0.7, -2.0]],
    [27.6, [0.9, -2.0, 17.5], [0.9, -4.1, -2.0]],
    [29.6, [0.9, -2.6, 15.5], [0.9, -4.3, -2.0]],
    [31.0, [0.2, -3.8, 9.6], [0.0, -4.5, -1.7]],
    [32.6, [0.0, -3.85, 8.2], [-0.1, -4.48, -1.6]],
    [34.6, [-0.9, -3.75, 9.4], [-1.0, -4.5, -1.7]],
    [36.6, [0.15, -4.15, 3.7], [0.12, -4.32, -1.6]],
    [37.6, [0.4, -3.0, 11.0], [0.4, -3.6, -2.2]],
    [38.9, [0.6, 4.4, 25.0], [0.3, 2.4, -5.0]],
    [40.6, [0.8, 4.0, 26.0], [0.5, 1.8, -4.5]],
    [42.0, [1.0, 3.2, 27.0], [0.9, 0.8, -3.5]],
    [44.2, [1.0, 3.0, 26.0], [0.9, 0.6, -3.2]],
    [45.6, [0.4, 2.2, 23.0], [0.2, -0.6, -3.0]],
    [47.7, [0.5, -2.6, 11.0], [0.4, -4.3, -2.0]],
    [49.4, [2.3, -4.3, 4.2], [1.15, -4.78, -1.5]],
    [51.0, [2.15, -4.45, 3.2], [1.12, -4.8, -1.5]],
    [54.0, [1.85, -4.6, 2.2], [1.1, -4.82, -1.5]],
    [55.0, [1.82, -4.62, 2.1], [1.1, -4.83, -1.5]],
  ];
  const camPos = makeSpline(camKeys.map((k) => [k[0], k[1]]));
  const camTgt = makeSpline(camKeys.map((k) => [k[0], k[2]]));

  // Earth: placed by where it should sit on screen at key moments (NDC x, y), then
  // interpolated in world directions so it drifts naturally with the camera.
  const EARTH_KEYS = [[0, -0.32, 0.6], [1.05, -0.42, 0.66], [2.2, -0.48, 0.72], [4.3, -0.5, 0.74], [7.7, -0.45, 0.72], [9.3, -0.32, 0.7],
    [11.9, -0.48, 0.74], [13.0, -0.42, 0.72], [15.9, -0.52, 0.74], [19.4, -0.52, 0.74], [22.6, -0.48, 0.72], [24.0, -0.5, 0.8], [26.6, -0.5, 0.8],
    [39.2, -0.45, 0.72], [44.2, -0.45, 0.72], [45.6, -0.5, 0.72]];
  const fovT = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const earthDirs = EARTH_KEYS.map(([t, nx, ny]) => {
    const p = new THREE.Vector3(...camPos(t)), q = new THREE.Vector3(...camTgt(t));
    const f = q.sub(p).normalize(), r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize(), u = new THREE.Vector3().crossVectors(r, f);
    return f.addScaledVector(r, nx * fovT * camera.aspect).addScaledVector(u, ny * fovT).normalize();
  });
  function earthDirAt(t) {
    let i = 0;
    while (i < EARTH_KEYS.length - 1 && t > EARTH_KEYS[i + 1][0]) i++;
    if (i >= EARTH_KEYS.length - 1) return earthDirs[EARTH_KEYS.length - 1].clone();
    const u = ease.inOutSine(clamp((t - EARTH_KEYS[i][0]) / (EARTH_KEYS[i + 1][0] - EARTH_KEYS[i][0])));
    return earthDirs[i].clone().lerp(earthDirs[i + 1], u).normalize();
  }

  // --------------------------------------------------------- John poses ----
  function hopArc(t, t0, t1, a, b, h) {
    const u = clamp((t - t0) / (t1 - t0));
    const s = ease.inOutSine(u);
    return [lerp(a[0], b[0], s), lerp(a[1], b[1], u) + 4 * h * u * (1 - u), lerp(a[2], b[2], s), u];
  }
  const BLINKS = [0.8, 4.4, 7.0, 9.8, 13.3, 16.9, 20.2, 23.5, 27.6, 31.6, 35.1, 38.7, 42.5, 46.3, 48.6, 53.9];
  const blink = (t) => BLINKS.reduce((b, bt) => Math.max(b, pulse(t, bt, 0.16)), 0);
  function digPose(u, yaw, base) {
    // one shovel cycle: push down, lift, toss, recover
    const down = smoothstep(0, 0.4, u) * (1 - smoothstep(0.45, 0.7, u));
    const toss = smoothstep(0.55, 0.75, u) * (1 - smoothstep(0.85, 1.0, u));
    return pose({ ...base, yaw, hip: 0.53 - down * 0.12, tPitch: down * 0.5 - toss * 0.15, tYaw: toss * 0.25,
      raX: 0.5 + down * 0.6 + toss * 1.2, raE: 0.9 - down * 0.4 - toss * 0.3, raZ: 0.15, laX: 0.4 + down * 0.7 + toss * 1.0, laE: 1.1 - toss * 0.4, laZ: 0.05,
      lfz: 0.15, rfz: -0.12, mSmile: 1, brow: toss * 0.3, lookY: -down * 0.6 });
  }
  const DIGSPOT = { x: DIG.x + 0.95, z: DIG.z - 0.2 };

  function johnAt(t) {
    const ex = { dust: 0, seals: [0, 0, 0, 0], sealGlow: 0, jet: 0 };
    let p;
    const g = (x, z) => groundHeight(x, z);
    if (t < 1.12) {
      // ---- S1: jetpack landing
      const u = clamp(t / 1.12);
      const y = 7.5 * (1 - ease.outCubic(u));
      p = pose({ x: -2.45, y: g(-2.45, -1.05) + y, z: -1.05, yaw: 0.15, hip: 0.5, lfy: 0.05, rfy: 0.08, lfz: 0.06, rfz: -0.04, laZ: 0.75, raZ: 0.75, laE: 0.5, raE: 0.5, mOpen: 0.8, mSmile: 0, brow: 0.6, lookY: -0.5, hPitch: 0.15 });
      ex.jet = 0.6 + 0.4 * (1 - u);
    } else if (t < 2.25) {
      // plant the flag
      const land = Math.exp(-7 * (t - 1.12)) * Math.sin((t - 1.12) * 11);
      const lift = smoothstep(1.3, 1.55, t) * (1 - smoothstep(1.62, 1.75, t));
      const push = smoothstep(1.6, 1.72, t) * (1 - smoothstep(1.95, 2.2, t));
      p = pose({ x: -2.45, y: g(-2.45, -1.05), z: -1.05, yaw: lerp(0.15, -0.65, smoothstep(1.2, 1.45, t)), hip: 0.5 - land * 0.12 - push * 0.06, squash: land * 0.8,
        raX: 0.4 + lift * 1.3 + push * 0.6, raE: 0.5 + lift * 0.6, raZ: 0.35, laZ: 0.4, laE: 0.6, tPitch: push * 0.2, mSmile: 1, happy: t > 1.85 && t < 2.2 ? 1 : 0, brow: 0.3 });
      ex.jet = Math.max(0, 1 - (t - 1.12) * 8);
    } else if (t < 2.85) {
      const [x, y, z, u] = hopArc(t, 2.25, 2.8, [-2.45, 0, -1.05], [DIGSPOT.x, 0, DIGSPOT.z], 0.55);
      p = pose({ x, y: y + g(x, z), z, yaw: lerp(-0.65, -1.35, u), lfy: Math.sin(u * Math.PI) * 0.12, rfy: Math.sin(u * Math.PI) * 0.12, laX: 0.5, raX: 0.6, raE: 0.9, laE: 0.9, mSmile: 1 });
    } else if (t < 3.3) {
      p = digPose(prog(t, 2.8, 3.25), -1.35, { x: DIGSPOT.x, y: g(DIGSPOT.x, DIGSPOT.z), z: DIGSPOT.z });
    } else if (t < 4.95) {
      // hops into the tiny hole... "Sort of." (shrug)
      const [x, y, z] = hopArc(t, 3.3, 3.75, [DIGSPOT.x, g(DIGSPOT.x, DIGSPOT.z), DIGSPOT.z], [DIG.x, -0.33, DIG.z - 0.25], 0.35);
      const sh = smoothstep(C.c1 - 0.15, C.c1 + 0.25, t) * (1 - smoothstep(4.75, 4.95, t));
      p = pose({ x, y, z, yaw: lerp(-1.35, 0.25, smoothstep(3.3, 3.8, t)), laZ: 0.25 + sh * 0.45, raZ: 0.25 + sh * 0.45, laE: 0.3 + sh * 1.3, raE: 0.3 + sh * 1.3, laX: sh * 0.35, raX: sh * 0.35,
        laY: -sh * 0.6, raY: -sh * 0.6, hRoll: sh * 0.18, brow: 0.2 + sh * 0.7, browTilt: sh * 0.5, mSmile: 1 - sh, mFlat: sh * 1.2, lookX: sh * 0.4, tRoll: sh * 0.05, bodyY: sh * 0.03 });
    } else if (t < 5.35) {
      const [x, y, z, u] = hopArc(t, 4.95, 5.35, [DIG.x, -0.33, DIG.z - 0.25], [DIGSPOT.x, g(DIGSPOT.x, DIGSPOT.z), DIGSPOT.z], 0.45);
      p = pose({ x, y, z, yaw: lerp(0.25, -1.35, u) });
    } else if (t < 10.75) {
      // ---- S1/S2: dig, dig, dig - each toss flies way too far
      const cycles = [[5.0, 5.75], [6.1, 6.85], [7.2, 7.95], [8.4, 9.15], [9.6, 10.35]];
      const base = { x: DIGSPOT.x, y: g(DIGSPOT.x, DIGSPOT.z), z: DIGSPOT.z };
      p = pose({ ...base, yaw: -1.35 });
      for (const [a, b] of cycles) if (t >= a && t < b) p = digPose(prog(t, a, b), -1.35, base);
      const watch = smoothstep(6.95, 7.2, t) * (1 - smoothstep(7.45, 7.6, t)) + smoothstep(9.15, 9.4, t) * (1 - smoothstep(9.55, 9.65, t));
      p.hYaw += watch * 0.5; p.hPitch -= watch * 0.4; p.mO = watch * 1.5; p.brow += watch * 0.8;
    } else if (t < 11.7) {
      // hand over the visor, searching the sky for the dust... then the machine
      const base = { x: DIGSPOT.x, y: g(DIGSPOT.x, DIGSPOT.z), z: DIGSPOT.z };
      const look = smoothstep(10.75, 11.0, t);
      p = pose({ ...base, yaw: lerp(-1.35, -0.6, look), raX: 1.4 * look, raE: 1.9 * look, raZ: 0.6 * look, hPitch: -0.35 * look, hYaw: 0.3 * Math.sin((t - 10.75) * 3) * look, brow: 0.6, mO: 1.2, mSmile: 0 });
      const turn = smoothstep(11.35, 11.65, t);
      p.hYaw = lerp(p.hYaw, 1.1, turn); p.hPitch = lerp(p.hPitch, 0, turn); p.mO = 1.2 * (1 - turn); p.mSmile = turn * 1.3; p.raX *= 1 - turn; p.raE = lerp(p.raE, 0.3, turn);
    } else if (t < 12.45) {
      const [x, y, z, u] = hopArc(t, 11.7, 12.4, [DIGSPOT.x, 0, DIGSPOT.z], [-2.65, 0, -0.7], 0.6);
      p = pose({ x, y: y + g(x, z), z, yaw: lerp(-0.6, -1.9, clamp(u * 2)), hYaw: 0.6, laX: 0.6, raX: 0.6, laE: 0.8, raE: 0.8 });
    } else if (t < 15.0) {
      // watches the machine dig: thumbs up
      const th = smoothstep(13.6, 13.9, t);
      p = pose({ x: -2.65, y: g(-2.65, -0.7), z: -0.7, yaw: lerp(-1.9, 0.9, smoothstep(12.45, 12.9, t)), hYaw: 0.2, raX: th * 1.2, raE: th * 1.6, raZ: th * 0.3, happy: th > 0.5 && t < 14.4 ? 1 : 0, mOpen: th * 0.8, mSmile: 1, brow: 0.3 });
      ex.dust = smoothstep(14.2, 15.0, t) * 0.4;
    } else if (t < 21.0) {
      // ---- S3: sticky, sharp dust; then seals snap on
      const base = { x: -2.65, y: g(-2.65, -0.7), z: -0.7 };
      const lookDown = smoothstep(15.1, 15.5, t) * (1 - smoothstep(16.0, 16.3, t));
      const pat = smoothstep(16.6, 16.9, t) * (1 - smoothstep(18.3, 18.6, t));
      const patOsc = Math.sin((t - 16.6) * 14) * pat;
      const inspect = smoothstep(C.c3, C.c3 + 0.25, t) * (1 - smoothstep(20.3, 20.6, t));
      p = pose({ ...base, yaw: 0.35, hPitch: 0.45 * lookDown + 0.25 * inspect, brow: 0.5 + lookDown * 0.4 - pat * 0.2, browTilt: -pat * 0.6, mO: lookDown * 1.3, mFlat: pat * 1.4, mSmile: inspect * 1.3 + (1 - lookDown - pat) * 0.5,
        laX: 0.2 + pat * 1.1 + inspect * 0.8, laZ: 0.22 - pat * 0.55, laE: 0.25 + pat * 1.4 + inspect * 1.1, laY: pat * 0.4 + patOsc * 0.12,
        raX: 0.15 + pat * 0.5 + inspect * 0.8, raZ: 0.3 - inspect * 0.1, raE: 0.3 + pat * 0.4 + inspect * 1.1, lookY: -0.5 * (lookDown + inspect) });
      ex.dust = 0.4 + smoothstep(15.0, 16.0, t) * 0.6;
      const st = [C.c3 + 0.15, C.c3 + 0.4, C.c3 + 0.65, C.c3 + 0.9];
      ex.seals = st.map((s0) => popScale(t, s0, 0.35));
      ex.sealGlow = 3.0 * Math.max(...st.map((s0) => (t > s0 ? Math.exp(-3 * (t - s0)) : 0)));
      p.bodyY += 0.04 * pulse(t, C.c3 + 0.65, 0.3) + 0.04 * pulse(t, C.c3 + 0.9, 0.3);
    } else if (t < 22.8) {
      // hop to the hut door, get brushed clean, go inside
      const [x, y, z] = hopArc(t, 21.0, 21.55, [-2.65, 0, -0.7], [HUT.x, 0, -0.62], 0.4);
      const walkIn = smoothstep(22.05, 22.6, t);
      p = pose({ x, y: y + g(x, z), z: z - walkIn * 0.9, yaw: lerp(0.35, Math.PI, smoothstep(21.0, 21.5, t)), happy: t > 21.7 && t < 22.1 ? 1 : 0, mSmile: 1,
        laZ: 0.3, raZ: 0.3, bodyY: 0.02 * Math.sin(t * 30) * smoothstep(21.55, 21.65, t) * (1 - smoothstep(21.95, 22.05, t)) });
      ex.dust = 1 - smoothstep(21.6, 22.0, t);
      ex.seals = [1, 1, 1, 1];
      if (walkIn > 0.98) p.y = -50; // inside the hut
    } else {
      ex.seals = [1, 1, 1, 1];
      p = podPose(t, podYAt(t) + podBounce(t) + house.FLOOR_Y);
    }
    p.blink = Math.max(p.blink, blink(t));
    return { p, ex };
  }

  // chair (pod space -> world)
  const CHAIR = { x: POD.cx + 0.35, z: -1.55, yaw: -0.45 };

  function podPose(t, floorY) {
    const base = { x: 1.35, y: floorY, z: -1.7, yaw: 0.1 };
    if (t < C.c4 + 1.9) {
      // ---- S4: hot (fanning, panting) / cold (shivering, hugging)
      const hot = dayAt(t), cold = 1 - hot;
      const fan = Math.sin(t * 14) * hot, shiv = Math.sin(t * 55) * cold;
      return pose({ ...base, laX: 1.2 * hot + 0.9 * cold, laE: 1.8 * hot + 1.9 * cold, laZ: 0.4 * hot - 0.35 * cold, laY: fan * 0.4,
        raX: 0.9 * cold + 0.1 * hot, raE: 1.9 * cold + 0.3 * hot, raZ: -0.35 * cold + 0.25 * hot,
        mOpen: hot * 1.2, mFlat: cold * 1.3, mSmile: 0.2, brow: 0.3 * hot - 0.2 * cold, browTilt: 0.5 * cold, half: hot * 0.6, bodyY: shiv * 0.008, tRoll: shiv * 0.02, hRoll: shiv * 0.03 });
    }
    if (t < S.s5) {
      // riding the room down: surprised, then relieved
      const rel = smoothstep(C.c4 + 3.2, C.c4 + 3.6, t);
      return pose({ ...base, laZ: 0.8 - rel * 0.5, raZ: 0.8 - rel * 0.5, laE: 0.6, raE: 0.6, mO: 1.4 * (1 - rel), mSmile: rel * 1.5, brow: 0.8 - rel * 0.5, hip: 0.5, happy: rel > 0.5 && t < S.s5 - 0.3 ? 1 : 0 });
    }
    const baseL = { x: 0.15, y: floorY, z: -1.7, yaw: 0.05 };
    if (t < C.c5 + 0.2) {
      // ---- S5: tries to take the helmet off... no air
      const tug = smoothstep(31.2, 31.5, t) * (1 - smoothstep(32.5, 32.9, t));
      const osc = Math.sin((t - 31.2) * 16) * tug;
      return pose({ ...baseL, x: lerp(1.35, 0.15, smoothstep(30.8, 31.2, t)), laX: 1.1 * tug + 0.2, laZ: 0.75 * tug + 0.2, laE: 1.75 * tug + 0.3, raX: 1.1 * tug + 0.2, raZ: 0.75 * tug + 0.2, raE: 1.75 * tug + 0.3,
        bodyY: osc * 0.02 + tug * 0.03, hPitch: -0.1 * tug, mFlat: 1.3 * tug + smoothstep(32.5, 32.9, t) * 1.2, mSmile: 0.3, brow: 0.6, browTilt: -0.7 * tug, lookY: 0.4 * tug });
    }
    if (t < 35.55) {
      // looks at the airlock, then at the tanks: amazed
      const lookL = smoothstep(C.c5 + 0.1, C.c5 + 0.4, t) * (1 - smoothstep(34.0, 34.3, t));
      const lookB = smoothstep(34.0, 34.3, t);
      return pose({ ...baseL, hYaw: -lookL * 0.9 + lookB * 0.5, hPitch: lookB * 0.1, mO: 1.1, mSmile: 0.5, brow: 0.7, lookX: -lookL * 0.8 + lookB * 0.4, laZ: 0.3, raZ: 0.3 });
    }
    if (t < S.s6) {
      // helmet off + a big happy breath
      const lift = smoothstep(35.55, 35.85, t) * (1 - smoothstep(36.05, 36.35, t));
      const breath = smoothstep(36.3, 36.8, t) * (1 - smoothstep(37.1, 37.6, t));
      return pose({ ...baseL, laX: 1.25 * lift, laZ: 0.7 * lift + 0.25 + breath * 0.4, laE: 1.9 * lift + 0.3, raX: 1.25 * lift, raZ: 0.7 * lift + 0.25 + breath * 0.4, raE: 1.9 * lift + 0.3,
        breathe: breath, hPitch: -0.25 * breath, tPitch: -0.08 * breath, happy: breath > 0.4 ? 1 : 0, mOpen: breath * 1.3, mSmile: 1, brow: 0.4 });
    }
    if (t < 46.0) {
      // ---- S6: space rocks thud outside: he flinches and looks up; then thumbs up
      let flinch = 0;
      for (const m of METEORS) flinch = Math.max(flinch, pulse(t, m.t1, 0.6));
      const th = smoothstep(44.6, 44.85, t);
      return pose({ ...baseL, hPitch: -0.45 * flinch, bodyY: -0.03 * flinch, mO: flinch * 1.4, brow: 0.3 + flinch * 0.6, mSmile: 1,
        raX: th * 1.2, raE: th * 1.6, raZ: th * 0.3, happy: th > 0.5 ? 1 : 0 });
    }
    // ---- S7: hop into the reclining chair, gaze up at the Earth, phone, look at the camera
    const sitT = 46.0, sitD = 0.6;
    const u = clamp((t - sitT) / sitD);
    const seatY = floorY;
    const x = lerp(0.15, CHAIR.x, ease.inOutSine(u)), z = lerp(-1.7, CHAIR.z, ease.inOutSine(u));
    const hop = Math.sin(u * Math.PI) * 0.35;
    const sit = smoothstep(0.5, 1.0, u);
    const gaze = smoothstep(46.8, 47.6, t) * (1 - smoothstep(49.3, 49.7, t));
    const phoneUp = smoothstep(49.4, 49.85, t);
    const turn = ease.inOutSine(prog(t, 51.0, 52.9));
    const deadpan = smoothstep(50.35, 50.6, t);
    const look = (a, b, c, d) => lerp(lerp(lerp(a, b, gaze), c, phoneUp), d, turn); // rest -> window -> phone -> camera
    const P = pose({ x, y: seatY + hop, z, yaw: lerp(0.05, CHAIR.yaw, u),
      hip: lerp(0.53, 0.44, sit), lean: -0.42 * sit, lfz: lerp(0.02, 0.5, sit), rfz: lerp(-0.02, 0.48, sit),
      raX: lerp(0.05, 0.55, sit), raZ: lerp(0.22, 0.42, sit), raE: lerp(0.25, 0.75, sit),
      laX: lerp(0.05, 0.55, sit) * (1 - phoneUp) + phoneUp * (0.62 - 0.12 * turn), laZ: lerp(0.22, 0.42, sit) * (1 - phoneUp) + phoneUp * 0.12, laE: lerp(0.25, 0.75, sit) * (1 - phoneUp) + phoneUp * (1.2 - 0.25 * turn), laY: phoneUp * 0.2,
      hYaw: look(0, -0.35, 0.12, 0.68), hPitch: look(0.36 * sit, -0.42, 0.6, 0.4),
      lookX: look(0, -0.3, 0.25, 0.3), lookY: look(0, 0.7, -0.7, 0.05),
      mSmile: 1.2 * (1 - deadpan), mFlat: deadpan * 1.5, happy: gaze > 0.6 && t < 48.6 ? 1 : 0, half: deadpan * (0.35 + 0.65 * turn), brow: 0.2 - deadpan * 0.25 });
    return P;
  }

  // day/night switching for S4 (1 = hot day, 0 = cold night)
  function dayAt(t) {
    if (t < S.s4 + 0.2 || t > C.c4 + 3.3) return 1;
    const sw = [[S.s4 + 0.2, 1], [24.55, 1], [24.85, 0], [25.45, 0], [25.7, 1], [26.05, 1], [26.3, 0], [C.c4 + 1.2, 0], [C.c4 + 1.6, 1]];
    return kf(t, sw.map(([a, b]) => [a, b, 'inOutSine']));
  }

  // -------------------------------------------------------- machine -------
  const REST = { boom: 0.6, stick: -1.5, scoop: -0.6, ext: 0, turret: 0 };
  const REACH = { boom: -0.15, stick: -0.75, scoop: 0.2, ext: 0.4, turret: 0 };
  const DEEP = { boom: -0.35, stick: -1.0, scoop: 0.3, ext: 1.6, turret: 0 };
  const DUMP = { boom: 0.35, stick: -0.5, scoop: 1.6, ext: 0.4, turret: Math.PI };
  const PILE = { boom: -0.1, stick: -0.9, scoop: 0.3, ext: 0.3, turret: Math.PI };
  const OVER = { boom: 0.6, stick: -0.35, scoop: 1.7, ext: 1.0, turret: 0.15 };
  const mix = (a, b, u) => { const o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * u; return o; };
  const cycle = (u, reach, dump) => {
    if (u < 0.25) return { ...mix(REST, reach, ease.inOutSine(u / 0.25)), load: 0 };
    if (u < 0.4) return { ...reach, scoop: reach.scoop - ease.inOutSine((u - 0.25) / 0.15) * 1.2, load: smoothstep(0.25, 0.4, u) };
    if (u < 0.7) return { ...mix({ ...reach, scoop: reach.scoop - 1.2 }, { ...dump, scoop: -0.8 }, ease.inOutCubic((u - 0.4) / 0.3)), load: 1 };
    if (u < 0.85) return { ...mix({ ...dump, scoop: -0.8 }, dump, ease.inOutSine((u - 0.7) / 0.15)), load: 1 - smoothstep(0.72, 0.85, u) };
    return { ...mix(dump, REST, ease.inOutSine((u - 0.85) / 0.15)), load: 0 };
  };
  const DIGCYCLES = [[12.45, 13.85, REACH], [13.85, 14.95, REACH], [C.c4 + 0.1, C.c4 + 1.6, DEEP], [C.c4 + 1.6, C.c4 + 2.7, DEEP]];
  const FILLCYCLES = [[C.c6 - 0.6, C.c6 + 0.8], [C.c6 + 0.8, C.c6 + 1.9], [C.c6 + 1.9, C.c6 + 3.0]];
  function machineAt(t) {
    const st = { x: MACH.x, y: groundHeight(MACH.x, MACH.z), z: MACH.z, yaw: -Math.PI / 2, build: C.c2, buildGap: 0.12 };
    let arm = { ...REST, load: 0 };
    for (const [a, b, r] of DIGCYCLES) if (t >= a && t < b) arm = cycle((t - a) / (b - a), r, DUMP);
    for (const [a, b] of FILLCYCLES) if (t >= a && t < b) {
      const u = (t - a) / (b - a);
      if (u < 0.3) arm = { ...mix(REST, PILE, ease.inOutSine(u / 0.3)), load: smoothstep(0.2, 0.3, u) };
      else if (u < 0.6) arm = { ...mix(PILE, { ...OVER, scoop: -0.8 }, ease.inOutCubic((u - 0.3) / 0.3)), load: 1 };
      else if (u < 0.85) arm = { ...mix({ ...OVER, scoop: -0.8 }, OVER, ease.inOutSine((u - 0.6) / 0.25)), load: 1 - smoothstep(0.6, 0.85, u) };
      else arm = { ...mix(OVER, REST, ease.inOutSine((u - 0.85) / 0.15)), load: 0 };
    }
    Object.assign(st, arm);
    st.look = 0.35 * Math.sin(t * 0.7);
    st.lookUp = 0;
    return st;
  }
  function pileAt(i, t) {
    let a = 0;
    dumps.forEach(([t0, pi]) => { if (pi === i) a += 0.6 * smoothstep(t0, t0 + 0.6, t); });
    a += 0.25 * smoothstep(12.6, 13.3, t); // the first scoops
    const used = smoothstep(C.c6 - 0.4, C.c6 + 2.6, t) * 0.55;
    return Math.max(0, a * (1 - used));
  }

  // --------------------------------------------------------- update -------
  const U = slab.U;
  function setCavity(i, cx, cy, hw, hh, rad, ang = 0, rough = 0, on = 1) {
    U.uCav.value[i].set(cx, cy, hw, hh); U.uCavB.value[i].set(rad, ang, rough, on);
  }
  const tmp = new THREE.Vector3();

  const story = {
    S, C, dbg: { house, slab, john, mach, mound, earth, lights, air, icons },
    update(t) {
      // ---------------- camera
      const cp = camPos(t), ct = camTgt(t);
      camera.position.set(cp[0], cp[1], cp[2]);
      camera.lookAt(ct[0], ct[1], ct[2]);
      camera.updateMatrixWorld();

      // ---------------- sun: day / night
      const day = dayAt(t);
      lights.sun.intensity = 0.25 + 3.15 * day;
      lights.sun.color.setRGB(1.0, lerp(0.85, 0.955, day), lerp(1.0, 0.9, day));
      lights.hemi.intensity = lerp(0.75, 0.55, day);
      earth.mat.uniforms.uSpin.value = t * 0.0025;
      earth.group.position.copy(camera.position).addScaledVector(earthDirAt(t), earth.DIST);

      // ---------------- pit, room, fill
      const pit = pitAt(t);
      const podY = podYAt(t) + podBounce(t);
      const podOn = t >= 14.35;
      if (pit) {
        const top = t >= C.c6 ? fillTopAt(t) : pit.floor;
        const yF = Math.max(pit.floor, top);
        const open = yF < -0.03;
        setPit(slab, { on: open, x0: pit.x0, x1: pit.x1, zBack: pit.zBack, yFloor: yF });
        // while the fill rises past the room, its surface would slice through the room: hide it
        if (podOn && yF > podY + 0.05 && yF < podY + POD.h + 0.05) slab.pitFloor.visible = false;
        setCavity(0, (pit.x0 + pit.x1) / 2, (yF + 0.6) / 2, (pit.x1 - pit.x0) / 2, (0.6 - yF) / 2, Math.min(0.3, (pit.x1 - pit.x0) / 4), 0, 0.05, open ? 1 : 0);
        U.uPit.value.set(pit.x0, pit.x1, pit.zBack, 0); U.uPitOn.value = open ? 1 : 0;
        U.uFill.value.set(pit.x0 - 0.45, pit.x1 + 0.65, pit.floor - 0.1, t >= C.c6 ? top + (top > -0.05 ? moundAt(t) + 0.1 : 0) : -100);
      } else { setCavity(0, 0, 0, 0, 0, 0, 0, 0, 0); U.uPitOn.value = 0; setPit(slab, { on: false }); }
      house.pod.visible = podOn;
      house.pod.position.set(POD.cx, podY, 0);
      setCavity(1, POD.cx, podY + POD.h / 2, POD.w / 2, POD.h / 2, POD.r, 0, 0, podOn && podY < 0.5 ? 1 : 0);
      // airlock snaps on (S5)
      const al = popScale(t, C.c5, 0.45);
      house.airlock.visible = al > 0.002;
      house.airlock.scale.set(Math.max(0.001, al), Math.max(0.001, al), 1);
      house.airlock.position.set(-POD.w / 2 + 0.05 - house.AW * al, 0, 0);
      setCavity(2, POD.cx - POD.w / 2 + 0.05 - house.AW * al / 2, podY + house.AH * al / 2, house.AW * al / 2, house.AH * al / 2, 0.35 * al, 0, 0, al > 0.01 ? 1 : 0);
      house.doors.forEach((d, i) => {
        const shut = smoothstep(C.c5 + 0.45 + i * 0.35, C.c5 + 0.75 + i * 0.35, t);
        d.g.position.y = (1 - shut) * 1.7;
        d.led.material = t > C.c5 + 1.3 ? house.M.ledG : house.M.ledR;
      });
      house.tanks.forEach((g, i) => { const k = popScale(t, C.c5 + 0.95 + i * 0.25, 0.4); g.visible = k > 0.002; g.scale.setScalar(Math.max(0.001, k)); });
      house.vent.visible = t > C.c5 + 0.9;
      // furniture pops in for the finished house
      house.furn.forEach((f) => { const k = popScale(t, S.s7 + 0.15 + f.order * 0.28, 0.45); f.obj.visible = k > 0.002; f.obj.scale.setScalar(Math.max(0.001, k)); f.obj.position.y = f.base.y + (1 - Math.min(1, k)) * 0.3; });
      // room lights: cool work light, then warm and cozy
      const warm = smoothstep(S.s7 + 0.3, S.s7 + 1.2, t);
      const work = smoothstep(22.6, 23.2, t) * (podOn ? 1 : 0);
      house.lights.forEach((l) => { l.intensity = work * lerp(2.0, 3.4, warm); l.color.setRGB(1.0, lerp(0.93, 0.72, warm), lerp(0.88, 0.45, warm)); });
      house.M.lightStrip.emissiveIntensity = work * lerp(1.2, 1.8, warm);
      house.M.lightStrip.emissive.setRGB(1.0, lerp(0.95, 0.82, warm), lerp(0.9, 0.62, warm));
      house.M.lamp.emissiveIntensity = warm * 3.5;
      // light-pipe window + dome
      const tubeK = popScale(t, C.c6 + 3.5, 0.5);
      house.setTube(TUBE_A, TUBE_B, tubeK > 0.002 ? Math.min(1, tubeK) : 0);
      {
        const dx = TUBE_B.x - TUBE_A.x, dy = TUBE_B.y - TUBE_A.y, len = Math.hypot(dx, dy);
        const half = Math.sqrt(Math.max(0, 0.42 * 0.42 - TUBE_A.z * TUBE_A.z));
        setCavity(3, (TUBE_A.x + TUBE_B.x) / 2, (TUBE_A.y + TUBE_B.y) / 2, half, len / 2, 0, Math.atan2(dx, dy), 0, tubeK > 0.5 ? 1 : 0);
      }
      const beamOn = smoothstep(S.s7 + 2.0, S.s7 + 3.0, t);
      house.beam.material.opacity = beamOn * 0.2;
      mound.set(moundAt(t));
      // entrance hut with the dust-brush door (S3)
      const hutK = popScale(t, C.c3 + 1.15, 0.5);
      house.hut.visible = hutK > 0.002;
      house.hut.position.set(HUT.x, groundHeight(HUT.x, HUT.z) - 0.02 + (1 - Math.min(1, hutK)) * 0.4, HUT.z);
      house.hut.scale.setScalar(Math.max(0.001, hutK));
      const doorOpen = smoothstep(21.85, 22.1, t) * (1 - smoothstep(22.55, 22.8, t));
      house.doorPanel.position.x = doorOpen * 0.7;
      const spin = smoothstep(21.3, 21.5, t) * (1 - smoothstep(22.1, 22.4, t)) * (t - 21.3) * 18;
      house.brushes[0].rotation.y = spin; house.brushes[1].rotation.y = -spin; house.brushes[2].rotation.x = spin;

      // ---------------- temperature (S4)
      const tempOn = smoothstep(S.s4 + 0.1, S.s4 + 0.6, t) * (1 - smoothstep(C.c4 + 2.4, C.c4 + 3.2, t));
      U.uTemp.value.set(day * 2 - 1, tempOn, t);
      U.uDeepOn.value = smoothstep(C.c4 + 0.6, C.c4 + 1.4, t) * (1 - smoothstep(S.s5 + 0.8, S.s5 + 1.6, t));
      tempfx.update(t, tempOn * day, tempOn * (1 - day));

      // ---------------- flag: pops in John's hand, lifted, planted with a bounce, then unfurls
      if (t < 1.2) house.flag.visible = false;
      else {
        house.flag.visible = true;
        const gy = groundHeight(FLAG.x, FLAG.z);
        const k = popScale(t, 1.2, 0.35);
        const y = kf(t, [[1.2, 0.35], [1.55, 0.75, 'outCubic'], [1.72, -0.25, 'inQuad']]) + (t > 1.72 ? -0.06 * Math.exp(-8 * (t - 1.72)) * Math.sin((t - 1.72) * 20) : 0);
        house.flag.position.set(FLAG.x, gy + y, FLAG.z);
        house.flag.rotation.set(0, 0.5, t < 1.72 ? 0.12 * (1 - prog(t, 1.4, 1.72)) : 0);
        house.flag.scale.setScalar(Math.max(0.001, k));
        house.setFlag(popScale(t, 1.85, 0.6), t);
      }

      // ---------------- John
      const { p, ex } = johnAt(t);
      john.state.helmetOn = 1; john.state.helmetLift = 0;
      if (t >= 35.55) { john.state.helmetLift = smoothstep(35.55, 35.95, t) * 0.32; john.state.helmetOn = t < 36.05 ? 1 : 0; }
      john.setPose(p, ex);
      john.root.updateMatrixWorld(true);
      // the helmet he took off: a slow low-gravity arc onto the floor; on the shelf in the finished house
      helmetProp.visible = t >= 36.05;
      if (helmetProp.visible) {
        const floorY = podYAt(t) + podBounce(t) + house.FLOOR_Y;
        if (t > S.s7 + 0.6) { helmetProp.position.set(-0.05, floorY + 1.43, -3.42); helmetProp.rotation.set(0, 0.35, 0); helmetProp.scale.setScalar(0.62 * Math.max(0.001, popScale(t, S.s7 + 0.6, 0.4))); }
        else {
          const u = clamp((t - 36.05) / 0.9);
          tmp.set(p.x, floorY + 1.92, p.z);
          helmetProp.position.lerpVectors(tmp, new THREE.Vector3(-0.8, floorY + 0.36, -2.4), ease.inOutSine(u)); helmetProp.position.y += Math.sin(u * Math.PI) * 0.35;
          helmetProp.rotation.set(-u * 0.4, u * 1.2, u * 0.3);
          helmetProp.scale.setScalar(t > S.s7 + 0.3 ? Math.max(0.001, 1 - smoothstep(S.s7 + 0.3, S.s7 + 0.55, t)) : 1);
        }
      }
      // shovel (S1-S2)
      if (t >= 2.05 && t < 11.7) {
        john.handR.add(house.shovel);
        house.shovel.position.set(0.0, -0.1, 0.12);
        house.shovel.rotation.set(1.25, 0, 0);
        house.shovel.scale.setScalar(Math.max(0.001, popScale(t, 2.05, 0.4)) * (1 - smoothstep(11.45, 11.7, t)) + 0.001);
        house.shovelLoad.visible = tossT.some((tt) => t > tt - 0.5 && t < tt);
      } else if (house.shovel.parent) house.shovel.parent.remove(house.shovel);
      // phone (S7)
      const phoneOn = t >= 49.4;
      if (phoneOn) {
        john.handL.add(house.phone); house.phone.position.set(0.0, -0.17, 0.06);
        house.phone.scale.setScalar(Math.max(0.001, popScale(t, 49.4, 0.35)) * 2.2);
        // screen faces between John's eyes and the camera, so both can see it
        john.headG.getWorldPosition(tmp); tmp.y += 0.28;
        house.phone.lookAt(tmp.lerp(camera.position, 0.55));
      }
      else if (house.phone.parent) house.phone.parent.remove(house.phone);

      // ---------------- machine + piles
      mach.setState(machineAt(t), t);
      PILES.forEach((_, i) => piles.set(i, pileAt(i, t)));

      // ---------------- fx
      grains.update(t);
      sparks.update(t);
      meteors.update(t, camera);
      impactCraters.forEach((c) => { const k = popScale(t, c.t, 0.3); c.ring.visible = c.rim.visible = k > 0.01; c.ring.scale.setScalar(Math.max(0.001, k)); c.rim.scale.set(Math.max(0.001, k), Math.max(0.001, k), 0.5 * Math.max(0.001, k)); });
      footprints.update(t);
      ARCS.forEach(([i, path], k) => trails[k].update(t, path, tossT[i], 0.13, 2.4));
      const pyNow = podYAt(t);
      if (t > C.c5 + 1.4 && t < S.s6 + 2.0) air.update(t, { x0: POD.cx - POD.w / 2 + 0.25, x1: POD.cx + POD.w / 2 - 0.25, y0: pyNow + 0.55, y1: pyNow + POD.h - 0.3, z0: -3.4, z1: -0.4 }, [POD.cx - 1.4, pyNow + POD.h - 0.75, -3.4], C.c5 + 1.4, 1.8, 1 - smoothstep(S.s6 + 0.5, S.s6 + 2.0, t));
      else air.update(t, null);
      icons.place(icons.noAir, t, 31.35, C.c5 - 0.1, [0.95, pyNow + house.FLOOR_Y + 1.55, -1.2], 0.5);
      icons.place(icons.check, t, 36.3, 37.3, [0.95, pyNow + house.FLOOR_Y + 2.15, -1.4], 0.4);
      icons.place(icons.check2, t, 44.75, 45.6, [0.9, pyNow + house.FLOOR_Y + 2.1, -1.6], 0.42);
      {
        const k = popScale(t, 50.35, 0.4);
        icons.noSignal.visible = k > 0.002;
        house.phone.updateMatrixWorld(true);
        house.phone.getWorldPosition(tmp);
        const rise = ease.outCubic(clamp((t - 50.35) / 0.45));
        // pop out of the phone, rising up and a little left on screen (stays in frame, clear of his face)
        const camR = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), camU = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        icons.noSignal.position.copy(tmp).addScaledVector(camR, -0.05 - rise * 0.32).addScaledVector(camU, 0.08 + rise * 0.62);
        icons.noSignal.scale.setScalar(0.42 * k + 0.0001);
        house.phone.userData.screen.material.emissiveMap = t >= 50.35 ? house.noSignalScreen : house.phoneScreen;
      }
      const thK = popScale(t, S.s4 + 0.5, 0.4) * (1 - smoothstep(S.s5 - 0.2, S.s5 + 0.2, t));
      icons.thA.visible = thK > 0.002; icons.thA.position.set(-1.72, -0.62, 0.3); icons.thA.scale.set(0.34 * thK, 1.02 * thK, 1);
      icons.thermo(0, lerp(0.12, 0.95, day), day > 0.5 ? '#ff6a2a' : '#3f9bff');
      const thB = popScale(t, C.c4 + 3.25, 0.4) * (1 - smoothstep(S.s5 - 0.2, S.s5 + 0.2, t));
      icons.thB.visible = thB > 0.002; icons.thB.position.set(-1.72, -4.95, 0.3); icons.thB.scale.set(0.34 * thB, 1.02 * thB, 1);
      icons.thermo(1, 0.5, '#3fd68a');
      mag.update(t, popScale(t, 16.15, 0.45) * (1 - smoothstep(18.55, 18.85, t)), [0.4, 0.62, 0.23]);
      const hotNow = t > S.s4 + 0.6 && t < C.c4 && day > 0.5;
      sweat.visible = hotNow;
      if (hotNow) { john.headG.getWorldPosition(tmp); sweat.position.set(tmp.x + 0.18, tmp.y + 0.38 - ((t * 0.8) % 1) * 0.15, tmp.z + 0.3); }
      sparkles.forEach((s, i) => {
        const u = (t - (21.6 + (i % 7) * 0.06)) / 0.5;
        s.visible = u > 0 && u < 1;
        if (s.visible) { const r = mulberry32(i + 3); s.position.set(HUT.x + (r() - 0.5) * 0.7, 0.3 + r() * 1.5, -0.55 + r() * 0.2); s.material.opacity = Math.sin(u * Math.PI); s.scale.setScalar(0.08 + 0.1 * Math.sin(u * Math.PI)); }
      });
      const sealParts = [john.armL.hand, john.armR.hand, john.legL.ankle, john.legR.ankle];
      sealFlash.forEach((s, i) => {
        const u = (t - (C.c3 + 0.15 + i * 0.25)) / 0.45;
        s.visible = u > 0 && u < 1;
        if (s.visible) { sealParts[i].getWorldPosition(s.position); s.position.z += 0.1; s.material.opacity = 1 - u; s.scale.setScalar(0.2 + u * 0.5); }
      });
      earthGlowOnFace.intensity = beamOn * 1.4;
      earthGlowOnFace.position.set(TUBE_A.x - 0.2, TUBE_A.y - 0.3, -0.6);
      phoneGlow.intensity = phoneOn ? 1.2 * clamp((t - 49.5) * 3) : 0;
      if (phoneOn) house.phone.getWorldPosition(phoneGlow.position);

      if (story.post) { story.post.bloom.strength = 0.42 - 0.1 * warm; }
      house.tubeMat.emissiveIntensity = beamOn * 0.9;
    },
  };
  return story;
}
