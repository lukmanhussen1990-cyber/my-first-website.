import * as THREE from 'three';
import { makeSky, makeEnvironment, SUN_DIR } from './sky.js';
import { makeTerrain } from './terrain.js';
import { makeGrass } from './grass.js';
import { makeScenery } from './trees.js';
import { makeCar, CAR } from './car.js';
import { makeCheetah } from './cheetah.js';
import { makeJohn } from './john.js';
import { makeStart, makeMeerkat, makeFinish } from './props.js';
import { Particles, ballistic, emitStream, makeJet, makeArrow } from './fx.js';
import { groundHeight, COURSE } from './course.js';
import { BEAT, W, DURATION } from './timeline.js';
import { carWorld, cheetahWorld, cheetahPose, seatedCheetahPose, johnPose, cameraAt, probe } from './choreo.js';
import { clamp, lerp, smoothstep } from './util.js';

// The film: the savanna slice, the race, and all effects, driven by the
// timeline (video time t in seconds).

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sm = smoothstep;
const SEAT_Y = 0.37; // the stowaway sits up tall so its panting grin clears the dash
const pulse = (t, a, b, ra = 0.2, rb = 0.2) => sm(a - ra, a, t) * (1 - sm(b, b + rb, t));

export async function build({ renderer, W: Wpx, H: Hpx, Q }) {
  const scene = new THREE.Scene();
  const env = makeEnvironment(renderer);
  scene.environment = env;
  scene.environmentIntensity = 0.6;
  scene.fog = new THREE.Fog(new THREE.Color(1.08, 0.5, 0.24), 200, 1400);
  const sky = makeSky(); scene.add(sky.mesh);
  const terrain = makeTerrain(env); scene.add(terrain.group);
  const grass = makeGrass(); scene.add(grass.group);
  const scenery = makeScenery(); scene.add(scenery.group);
  const start = makeStart(); scene.add(start.group);
  const finish = makeFinish(); scene.add(finish.group);
  const meerkat = makeMeerkat(env); scene.add(meerkat.root);
  meerkat.root.position.set(1.4, groundHeight(1.4, -0.85), -0.85); meerkat.root.rotation.y = 0.9;

  // ---- car with a flip pivot at the centre of mass
  const car = makeCar(env);
  scene.add(car.root);
  const flipG = new THREE.Group(), inner = new THREE.Group();
  flipG.add(inner); inner.position.y = -0.55;
  for (const ch of [...car.root.children]) inner.add(ch);
  car.root.add(flipG);
  const john = makeJohn(env); car.cabin.add(john.root); john.root.position.set(-0.4, 0.3, 0.42);
  const seated = makeCheetah(env); car.cabin.add(seated.root); seated.root.position.set(-0.43, SEAT_Y, -0.42);
  // the stowaway's seatbelt: shoulder strap across the chest, lap strap, buckle
  {
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.65 });
    const ribbon = (pts, w) => {
      const c = new THREE.CatmullRomCurve3(pts), n = 24, pos = [], idx = [];
      for (let i = 0; i <= n; i++) {
        const p = c.getPoint(i / n), tg = c.getTangent(i / n);
        const side = tg.clone().cross(V3(1, 0, 0)).normalize().multiplyScalar(w / 2);
        pos.push(p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z);
        if (i < n) { const a = 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, beltMat); m.material.side = THREE.DoubleSide; return m;
    };
    const belt = new THREE.Group();
    belt.add(ribbon([V3(-0.02, 0.56, -0.17), V3(0.12, 0.46, -0.12), V3(0.2, 0.33, -0.03), V3(0.21, 0.2, 0.06), V3(0.15, 0.1, 0.15)], 0.05));
    belt.add(ribbon([V3(0.15, 0.1, 0.15), V3(0.2, 0.12, 0.02), V3(0.19, 0.11, -0.1), V3(0.1, 0.08, -0.2)], 0.05));
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.045), new THREE.MeshPhysicalMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.25, envMap: env }));
    buckle.position.set(0.16, 0.1, 0.15); belt.add(buckle);
    seated.root.add(belt);
  }
  const cheetah = makeCheetah(env); scene.add(cheetah.root);

  // thruster jets on every nozzle (+ heat volumes on layer 1)
  const jets = { back: [], sideR: [], front: [] };
  let seed = 1;
  for (const key of ['back', 'sideR', 'front']) for (const n of car.nozzles[key]) {
    const j = makeJet(seed++, key === 'sideR' ? { len: 1.7, r1: 0.42 } : key === 'front' ? { len: 1.9, r1: 0.5 } : { len: 1.6, r1: 0.4 });
    n.obj.add(j.group); j.group.position.y = 0.02;
    n.obj.add(j.heat); j.heat.position.y = 0.02; j.heat.layers.set(1);
    jets[key].push(j);
  }
  // force arrows
  const arrows = {
    down: [makeArrow(1.0), makeArrow(1.15), makeArrow(1.0)],
    flow: [makeArrow(1.4, new THREE.Color(0.55, 0.9, 1.0)), makeArrow(1.4, new THREE.Color(0.55, 0.9, 1.0))],
    side: [makeArrow(2.0)], lift: [makeArrow(1.8)], brake: [makeArrow(2.0, new THREE.Color(1.0, 0.75, 0.3))],
  };
  for (const list of Object.values(arrows)) for (const a of list) scene.add(a.group);

  // particles
  const dust = new Particles(9000);                                     // soft puffs + sand grains
  const glow = new Particles(3000, { additive: true, renderOrder: 35 }); // thruster mist
  const drops = new Particles(2500, { renderOrder: 25 });               // water
  scene.add(dust.mesh, glow.mesh, drops.mesh);

  // ---- lights
  const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.56, 0.24), 4.6);
  sun.castShadow = true;
  const shadowRes = +(Q.get('shadow') || 4096);
  sun.shadow.mapSize.set(shadowRes, shadowRes);
  sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.025; sun.shadow.radius = 2.5;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 140 });
  scene.add(sun, sun.target);
  // warm golden key from the front-left (sunset cheat: faces and the cut face
  // stay golden while the real sun rims everything from behind)
  const fill = new THREE.DirectionalLight(new THREE.Color(1.0, 0.7, 0.42), 1.7);
  fill.position.set(-0.45, 0.62, 0.65).normalize().multiplyScalar(50);
  scene.add(fill, fill.target);
  const cool = new THREE.DirectionalLight(new THREE.Color(0.55, 0.6, 1.0), 0.35);
  cool.position.set(0.7, 0.4, 0.6).normalize().multiplyScalar(50);
  scene.add(cool, cool.target);
  scene.add(new THREE.HemisphereLight(new THREE.Color(0.5, 0.45, 0.7), new THREE.Color(0.62, 0.4, 0.18), 0.3));
  // blue-white light thrown by the thrusters
  const thrLight = new THREE.PointLight(new THREE.Color(0.5, 0.75, 1.0), 0, 9, 2);
  scene.add(thrLight);

  const camera = new THREE.PerspectiveCamera(34, Wpx / Hpx, 0.1, 3000);
  const camOverride = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
  const lookOverride = Q.get('look') ? Q.get('look').split(',').map(Number) : null;

  // heat-shimmer pass target (quarter resolution)
  const heatRT = new THREE.WebGLRenderTarget(Math.round(Wpx / 4), Math.round(Hpx / 4), { depthBuffer: false });

  // ---------------------------------------------------------------- update
  function placeCar(t) {
    const c = carWorld(t);
    car.root.position.set(c.x, 0, c.z);
    car.root.rotation.set(0, c.heading + c.yaw, 0);
    flipG.position.set(0, 0.55 + c.y, 0);
    flipG.rotation.set(0, 0, c.flip, 'YXZ');
    car.body.position.y = c.heave;
    car.body.rotation.set(c.roll, 0, c.pitch, 'YXZ');
    for (const w of car.wheels) {
      w.spinner.rotation.z = -c.wheel;
      w.pivot.rotation.y = w.front ? c.steer : 0;
      w.pivot.position.y = CAR.WR - (c.y > 0.05 ? 0.05 : 0); // suspension droop in the air
    }
    car.fan.rotation.x = c.fanAngle;
    car.M.fanGlow.emissiveIntensity = 3.5 * c.fan;
    car.M.tailBar.emissiveIntensity = 5 + 10 * clamp(c.brake, 0, 1);
    car.M.nozzleGlow.emissiveIntensity = 0.4 + 6 * Math.max(c.thrBack, c.thrSide, c.thrFront);
    return c;
  }

  function updateFX(t, c, chw) {
    const u = W(t);
    dust.begin(); glow.begin(); drops.begin();
    car.root.updateMatrixWorld(true);
    const bodyM = car.body.matrixWorld;
    const toW = (x, y, z) => V3(x, y, z).applyMatrix4(bodyM);
    const fwd = V3(Math.cos(c.heading + c.yaw), 0, -Math.sin(c.heading + c.yaw));
    const right = V3(Math.sin(c.heading + c.yaw), 0, Math.cos(c.heading + c.yaw));
    const sandCol = [0.98, 0.66, 0.36];
    // grains of sand thrown from a point
    const grains = (em, t0, t1, rate, life, origin, vfn, size = 0.05, col = sandCol) => {
      emitStream(em, u, W(t0), W(t1), rate, life, (i, age, ts, r) => {
        const p = ballistic(origin(ts, r), vfn(ts, r), age, 0.6);
        if (p[1] < 0.01 && age > 0.1) return; // landed
        const fade = 1 - age / life;
        const k = 0.8 + 0.3 * r(8);
        dust.push(p[0], p[1], p[2], size * (0.6 + r(9) * 0.9), col[0] * k, col[1] * k, col[2] * k, Math.min(1, fade * 2.5), r(5) * 6, r(6), 0, 1);
      });
    };
    // soft dust puffs that grow and fade
    const puffs = (em, t0, t1, rate, life, origin, vfn, s0 = 0.3, s1 = 1.4, alpha = 0.5, col = [0.92, 0.6, 0.34]) => {
      if (alpha <= 0) return;
      emitStream(em, u, W(t0), W(t1), rate, life, (i, age, ts, r) => {
        const p = ballistic(origin(ts, r), vfn(ts, r), age, 1.8, 0.35);
        const a = age / life;
        const size = lerp(s0, s1, 1 - Math.pow(1 - a, 2)) * (0.7 + 0.6 * r(3));
        const fade = sm(0, 0.12, a) * (1 - sm(0.45, 1.0, a));
        dust.push(p[0], Math.max(p[1], size * 0.25), p[2], size, col[0], col[1], col[2], alpha * fade * (0.6 + 0.4 * r(4)), r(5) * 6 + age * (r(7) - 0.5), r(6), 0, 0);
      });
    };
    const wheelW = (front, sz) => toW(front ? CAR.FW : CAR.RW, 0.04, sz * 0.86);
    const WHEELS = [[1, true, 1], [2, true, -1], [3, false, 1], [4, false, -1]];
    // 1) launch burst from all wheels
    for (const [k, fr, sz] of WHEELS) {
      grains(100 + k, BEAT.launch - 0.02, BEAT.launch + 0.55, 260, 0.9, () => wheelW(fr, sz).toArray(),
        (ts, r) => fwd.clone().multiplyScalar(-(2 + 5 * r(1))).add(V3(0, 1.5 + 3 * r(2), 0)).addScaledVector(right, (r(3) - 0.5) * 2).toArray());
    }
    puffs(110, BEAT.launch, BEAT.launch + 0.6, 24, 1.6, () => toW(CAR.RW, 0.15, 0).toArray(),
      (ts, r) => fwd.clone().multiplyScalar(-1.5 * r(1)).add(V3((r(2) - 0.5), 0.6, (r(3) - 0.5) * 1.5)).toArray(), 0.4, 1.8, 0.5);
    // 2) tyres spinning in the sand: rooster tails + dust
    if (t > 6.5 && t < 15.5) {
      for (const [k, sz] of [[1, 1], [2, -1]]) {
        grains(200 + k, 6.8, 13.98, 420, 1.15, () => toW(CAR.RW - 0.2, 0.05, sz * 0.86).toArray(),
          (ts, r) => fwd.clone().multiplyScalar(-(3 + 6 * r(1))).add(V3(0, 2.2 + 3.2 * r(2), 0)).addScaledVector(right, (r(3) - 0.5) * 2.2).toArray());
        grains(210 + k, 6.8, 13.98, 160, 0.9, () => toW(CAR.FW - 0.2, 0.05, sz * 0.86).toArray(),
          (ts, r) => fwd.clone().multiplyScalar(-(2 + 4 * r(1))).add(V3(0, 1.4 + 2 * r(2), 0)).addScaledVector(right, (r(3) - 0.5) * 2).toArray());
      }
      puffs(220, 6.8, 13.98, 22, 2.2, () => toW(CAR.RW - 0.8, 0.25, 0).toArray(),
        (ts, r) => fwd.clone().multiplyScalar(-(0.8 + 1.5 * r(1))).add(V3((r(2) - 0.5) * 0.6, 0.7, (r(3) - 0.5) * 1.2)).toArray(), 0.4, 2.0, 0.5);
    }
    // 3) cheetah paw dust and the cartoon "zip" cloud
    puffs(300, 4.8, BEAT.chStop - 0.3, 26, 0.9, (ts) => { const w = cheetahWorld(ts); return [w.x - Math.cos(w.heading) * 0.4, 0.05 + w.y, w.z + Math.sin(w.heading) * 0.4]; },
      (ts, r) => { const w = cheetahWorld(ts); return [-(0.8 + r(1)) * Math.cos(w.heading), 0.4 + 0.5 * r(2), (0.8 + r(1)) * Math.sin(w.heading) + (r(3) - 0.5)]; }, 0.12, 0.55, 0.45);
    // cartoon "zip" cloud: crisp puffy lobes left hanging where the cheetah was
    {
      const w0 = cheetahWorld(BEAT.zip);
      emitStream(310, u, W(BEAT.zip), W(BEAT.zip + 0.12), 170, 2.3, (i, age, ts, r) => {
        const p = ballistic([w0.x + 0.15 + (r(1) - 0.35) * 0.6, 0.22 + 0.3 * r(2), w0.z + (r(3) - 0.5) * 0.45],
          [(r(4) - 0.2) * 1.5, 0.2 + 0.45 * r(5), (r(6) - 0.5) * 0.7], age, 2.4, 0.06);
        const a = age / 2.3;
        const size = (0.26 + 0.3 * r(7)) * (0.55 + 0.6 * (1 - Math.pow(1 - Math.min(1, a * 5), 3))) * (1 - 0.45 * sm(0.55, 1.0, a));
        dust.push(p[0], Math.max(p[1], size * 0.4), p[2], size, 1.0, 0.9, 0.74, 1 - sm(0.5, 1.0, a), r(8) * 6, r(9), 0, 4);
      });
    }
    // 4) corner slide: sand sprays toward the outside of the bend
    for (const [k, fr, sz] of WHEELS) {
      grains(400 + k, BEAT.carSlide + 0.2, BEAT.sideThrEnd + 0.2, 300, 1.0, () => wheelW(fr, sz).toArray(),
        (ts, r) => right.clone().multiplyScalar(2 + 4 * r(1)).addScaledVector(fwd, -(1 + 3 * r(4))).add(V3(0, 1.5 + 2.5 * r(2), 0)).toArray());
    }
    puffs(410, BEAT.carSlide + 0.2, BEAT.sideThrEnd + 0.3, 26, 2.0, () => toW(-0.5, 0.2, 0.9).toArray(),
      (ts, r) => right.clone().multiplyScalar(0.8 + r(1)).add(V3(0, 0.6, 0)).toArray(), 0.4, 2.0, 0.5);
    // sand spilling over the cliff edge while the car hangs near it
    emitStream(420, u, W(BEAT.sideThr - 0.5), W(BEAT.sideThrEnd), 160, 1.6, (i, age, ts, r) => {
      const x0 = carWorld(BEAT.sideThr).x + (r(1) - 0.5) * 4.0;
      const p = ballistic([x0, 0.02, -0.05 + 0.1 * r(2)], [0, 0.2, 0.6 + 0.6 * r(3)], age, 0.2);
      dust.push(p[0], p[1], p[2], 0.03 + 0.03 * r(4), sandCol[0], sandCol[1], sandCol[2], 1 - age / 1.6, 0, r(6), 0, 1);
    });
    // 5) river: braking skid, launch blast spray, drops in slow motion, landing
    puffs(500, BEAT.carBrake + 0.1, BEAT.carBrake + 0.7, 30, 1.6, () => toW(CAR.FW, 0.15, 0).toArray(),
      (ts, r) => fwd.clone().multiplyScalar(1.2 + r(1)).add(V3((r(2) - 0.5), 0.5, (r(3) - 0.5) * 1.5)).toArray(), 0.35, 1.6, 0.55);
    {
      const rx = COURSE.RIVER;
      emitStream(510, u, W(BEAT.carLaunch - 0.05), W(BEAT.carLaunch + 0.35), 2400, 2.2, (i, age, ts, r) => {
        const x0 = rx - 3.5 + 3.0 * r(1), z0 = -5.6 + (r(2) - 0.5) * 2.4;
        const v = [-(1.5 + 4 * r(3)), 3.5 + 6.5 * r(4), (r(5) - 0.5) * 4];
        const p = ballistic([x0, COURSE.WATER_Y + 0.05, z0], v, age, 0.3);
        if (p[1] < COURSE.WATER_Y && age > 0.2) return;
        const tw = 0.6 + 0.4 * Math.sin(t * 40 + i);
        drops.push(p[0], p[1], p[2], 0.035 + 0.035 * r(6), 0.75 * tw, 0.85 * tw, 0.95 * tw, 0.95 * (1 - age / 2.2), 0, r(7), 0, 2);
      });
      // drips off the car during the flip
      emitStream(520, u, W(BEAT.carLaunch + 0.2), W(BEAT.land - 0.3), 160, 1.4, (i, age, ts, r) => {
        const cw = carWorld(Math.min(t, BEAT.land));
        const p0 = [cw.x + (r(1) - 0.5) * 3.5, 0.55 + cw.y + (r(2) - 0.5) * 0.8, cw.z + (r(3) - 0.5) * 1.6];
        const p = ballistic(p0, [(r(4) - 0.5) * 2, 0.5 + r(5), (r(6) - 0.5) * 2], age, 0.2);
        drops.push(p[0], p[1], p[2], 0.03 + 0.02 * r(7), 0.8, 0.9, 1.0, 0.9 * (1 - age / 1.4), 0, r(8), 0, 2);
      });
      puffs(530, BEAT.land - 0.05, BEAT.land + 0.25, 70, 1.8, () => toW(0, 0.15, 0).toArray(), (ts, r) => [(r(1) - 0.3) * 3, 0.5 + r(2), (r(3) - 0.5) * 3], 0.4, 2.2, 0.6);
    }
    // 6) finish: the front thrusters kick up a huge sand cloud
    puffs(600, BEAT.frontThr, BEAT.carStop + 0.1, 50, 3.6, () => toW(CAR.XN + 0.6, 0.3, 0).toArray(),
      (ts, r) => fwd.clone().multiplyScalar(2.0 + 3.5 * r(1)).addScaledVector(right, (r(2) - 0.5) * 5).add(V3(0, 0.6 + 1.2 * r(3), 0)).toArray(), 0.8, 4.2, 0.62);
    puffs(610, BEAT.frontThr + 0.3, BEAT.carStop + 0.3, 30, 3.8, () => toW(-0.5, 0.2, 0).toArray(),
      (ts, r) => right.clone().multiplyScalar((r(2) - 0.5) * 4).add(V3((r(1) - 0.5) * 2, 0.7 * r(3), 0)).toArray(), 0.8, 3.6, 0.6);
    for (const [k, fr, sz] of WHEELS) {
      grains(620 + k, BEAT.frontThr, BEAT.carStop, 260, 1.0, () => wheelW(fr, sz).toArray(),
        (ts, r) => fwd.clone().multiplyScalar(2 + 4 * r(1)).add(V3(0, 1.2 + 2.2 * r(2), 0)).addScaledVector(right, (r(3) - 0.5) * 3).toArray());
    }
    // light dust trail behind the speeding car (not during the jump)
    puffs(700, 15.0, BEAT.frontThr, 12, 1.6, (ts) => { const w = carWorld(ts); return [w.x - Math.cos(w.heading) * 2.3, 0.2, w.z + Math.sin(w.heading) * 2.3]; },
      (ts, r) => [(r(1) - 0.5), 0.3, (r(2) - 0.5)], 0.3, 1.4, t > 24.5 && t < 30.2 ? 0 : 0.35);

    // thruster mist (additive)
    const mist = (em, list, power, rate, speed) => {
      if (power < 0.01) return;
      list.forEach((n, ni) => {
        emitStream(em + ni, u, u - 0.5, u, rate, 0.32, (i, age, ts, r) => {
          const p0 = n.pos.clone().applyMatrix4(bodyM), d0 = n.dir.clone().transformDirection(bodyM);
          const v = d0.multiplyScalar(speed * (0.7 + 0.6 * r(1))).add(V3((r(2) - 0.5) * 2, (r(3) - 0.5) * 2, (r(4) - 0.5) * 2));
          const p = ballistic(p0.toArray(), v.toArray(), age, 3, 0);
          const a = (1 - age / 0.32) * power;
          glow.push(p[0], p[1], p[2], 0.05 + 0.25 * age, 0.45 * a, 0.7 * a, 1.0 * a, 1, r(5) * 6, r(6), 0, 3);
        });
      });
    };
    mist(800, car.nozzles.back, c.thrBack, 220, 9);
    mist(810, car.nozzles.sideR, c.thrSide, 220, 9);
    mist(820, car.nozzles.front, c.thrFront, 260, 10);
    dust.end(); glow.end(); drops.end();
  }

  function updateArrows(t) {
    const T = (x, y, z) => V3(x, y, z).applyMatrix4(car.root.matrixWorld);
    const q = car.root.quaternion;
    const setA = (a, pos, dir, alpha) => {
      a.group.position.copy(pos);
      a.group.quaternion.setFromUnitVectors(V3(0, 1, 0), dir.clone().normalize());
      a.set(alpha, t);
    };
    const down = pulse(t, 11.95, 14.15, 0.25, 0.35);
    const bob = 0.12 * Math.sin(t * 7);
    arrows.down.forEach((a, i) => setA(a, T(-1.1 + 1.0 * i, 2.45 + 0.6 * bob - 0.22 * sm(12.6, 13.2, t), 0), V3(0, -1, 0), down));
    const flow = pulse(t, 12.1, 14.15, 0.25, 0.35);
    arrows.flow.forEach((a, i) => setA(a, T(-1.4 - 0.4 * i, 0.22 + 0.25 * i, (i ? -1 : 1) * 1.25), V3(-1, 0.05, 0).applyQuaternion(q), flow));
    const side = pulse(t, BEAT.sideThr + 0.05, BEAT.sideThrEnd, 0.15, 0.3);
    setA(arrows.side[0], T(-0.2, 0.9, 3.4), V3(0, 0, -1).applyQuaternion(q), side);
    const lift = pulse(t, BEAT.backThr + 0.1, 26.6, 0.2, 0.4);
    setA(arrows.lift[0], car.body.localToWorld(V3(-2.6, 0.3, 0)), V3(0.6, 1, 0).applyQuaternion(q), lift);
    const brk = pulse(t, BEAT.frontThr + 0.15, 42.55, 0.2, 0.3);
    setA(arrows.brake[0], T(0.9, 1.65, 0), V3(-1, 0, 0).applyQuaternion(q), brk);
  }

  function update(t) {
    const u = W(t);
    terrain.update(u);
    grass.update(u);
    const c = placeCar(t);
    for (const j of jets.back) j.set(c.thrBack, u);
    for (const j of jets.sideR) j.set(c.thrSide, u);
    for (const j of jets.front) j.set(c.thrFront, u);
    const thr = Math.max(c.thrBack, c.thrSide, c.thrFront);
    thrLight.intensity = 22 * thr;
    if (thr > 0.01) {
      const key = c.thrFront >= c.thrBack && c.thrFront >= c.thrSide ? 'front' : c.thrBack >= c.thrSide ? 'back' : 'sideR';
      const n = car.nozzles[key][0];
      car.root.updateMatrixWorld(true);
      thrLight.position.copy(n.pos).addScaledVector(n.dir, 0.8).applyMatrix4(car.body.matrixWorld);
    }
    // the racing cheetah
    const chw = cheetahWorld(t);
    cheetah.root.visible = chw.visible;
    if (chw.visible) {
      cheetah.root.position.set(chw.x, chw.y, chw.z);
      cheetah.root.rotation.set(0, chw.heading, 0);
      cheetah.apply(cheetahPose(t), u);
      cheetah.root.updateMatrixWorld(true);
      probe.cheetahHead = cheetah.head.getWorldPosition(probe.cheetahHead || V3(0, 0, 0));
    }
    // the stowaway: ducked out of sight in the passenger seat until the reveal
    // it sits up (off the edge of John's close-up) just before the click
    seated.root.visible = t > 49.3;
    if (seated.root.visible) {
      const up = sm(49.35, 49.75, t);
      seated.root.position.y = SEAT_Y - 0.5 * (1 - up);
      seated.apply(seatedCheetahPose(t), t);
    }
    car.M.glass.userData.uniforms.uClarity.value = 0.8 * sm(45.8, 47.0, t);
    john.apply(johnPose(t), t);
    meerkat.set(t, sm(BEAT.flagDrop, BEAT.flagDrop + 0.18, t), 0.25 * Math.sin(t * 1.3) * (1 - sm(4.0, 4.4, t)) - 0.6 * sm(4.8, 5.2, t));
    finish.update(t, pulse(t, 40.1, 41.5, 0.3, 1.5));
    // grass pushed by the racers and thruster blasts
    const gp = grass.mat.userData.uniforms.uPush.value;
    gp[0].set(c.x, c.z, 2.6, clamp(c.v / 25, 0, 0.7) + 1.2 * thr);
    gp[1].set(chw.x, chw.z, 1.0, chw.visible ? clamp(chw.v / 20, 0, 0.4) : 0);
    // camera
    const cam = cameraAt(t);
    if (camOverride) cam.pos.set(...camOverride);
    if (lookOverride) cam.look.set(...lookOverride);
    camera.position.copy(cam.pos);
    camera.fov = +(Q.get('fov') || cam.fov);
    camera.lookAt(cam.look);
    camera.updateProjectionMatrix();
    sky.follow(camera);
    // shadow frustum follows the point of interest
    sun.target.position.copy(cam.look);
    sun.position.copy(cam.look).addScaledVector(SUN_DIR, 80);
    sun.updateMatrixWorld(); sun.target.updateMatrixWorld();
    car.root.updateMatrixWorld(true);
    updateFX(t, c, chw);
    updateArrows(t);
  }

  function heatPass() {
    const old = renderer.getRenderTarget();
    renderer.setRenderTarget(heatRT);
    renderer.setClearColor(new THREE.Color(0.5, 0.5, 0.0), 1);
    renderer.clear(true, true, true);
    const fog = scene.fog;
    scene.fog = null;
    camera.layers.set(1);
    renderer.render(scene, camera);
    camera.layers.set(0);
    scene.fog = fog;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(old);
    return heatRT.texture;
  }

  return {
    scene, camera, sun, sunSoftness: 0.014, update, duration: DURATION,
    samplesAt: () => +(Q.get('n') || 6),
    heatPass,
    postParams: (t) => {
      const c = carWorld(t);
      const thr = Math.max(c.thrBack, c.thrSide, c.thrFront);
      return { uExposure: 0.95, uBloom: 0.55 + 0.35 * thr, uVignette: 0.3, uSat: 1.12, uContrast: 1.1, uACES: 1, uHeat: 0.012 * thr, uFade: sm(0, 0.35, t) };
    },
  };
}
