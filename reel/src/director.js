// The director: every shot is a pure function of time, anchored to the voiceover word timestamps.
import * as THREE from 'three';
import {
  makeYou, makeDad, makeGrandma, pose, makeVelcroMaterial, makeFuzz, makeSweaterProp,
  makeKnitting, makeYarnBall, makeSinglePancake, mat, mesh,
} from './characters.js';
import { ROOM, YARD, roofSurfaceY } from './sets.js';
import * as TX from './textures.js';
import {
  clamp, lerp, invLerp, easeInOut, easeOut, easeIn, easeOutBack, smooth, smoother, spring, wobble,
  noise1, mulberry32, DEG,
} from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
const UP = V(0, 1, 0);

export function createDirector({ renderer, camera, room, yard, timeline: T }) {
  const words = T.words;
  const Wd = (i) => words[i].start;
  const We = (i) => words[i].end;
  const env = (arr, t) => { if (!arr) return 0; const f = t * 30; const i = Math.floor(f); const a = arr[i] ?? 0, b = arr[i + 1] ?? 0; return a + (b - a) * (f - i); };
  // narrator loudness (0..1): from the analysed audio when available, else from word timing
  const voice = (t) => {
    if (T.voiceEnv) return clamp(env(T.voiceEnv, t) * 1.25);
    for (const w of words) if (t >= w.start && t <= w.end) return 0.35 + 0.35 * Math.abs(Math.sin((t - w.start) * 19));
    return 0;
  };

  // ---------------- cast & props ----------------
  const you = makeYou(), dad = makeDad(), gma = makeGrandma();
  const cast = [you, dad, gma];
  const velcroMat = makeVelcroMaterial();
  const shirtMeshes = [];
  you.root.traverse((o) => { if (o.isMesh && o.material === you.mats.shirt) shirtMeshes.push(o); });
  const fuzz = [];
  const addFuzz = (parent, n, r, h, seed, y = 0) => { const f = makeFuzz(n, r, h, seed); f.position.y = y; parent.add(f); fuzz.push(f); };
  addFuzz(you.j.spine, 150, 0.195, 0.27, 3, -0.02);
  addFuzz(you.j.chest, 170, 0.215, 0.3, 4, -0.04);
  addFuzz(you.j.shL, 45, 0.062, 0.3, 5, -0.3); addFuzz(you.j.shR, 45, 0.062, 0.3, 6, -0.3);
  addFuzz(you.j.elL, 40, 0.054, 0.26, 7, -0.27); addFuzz(you.j.elR, 40, 0.054, 0.26, 8, -0.27);
  const setSweater = (on) => {
    for (const m of shirtMeshes) m.material = on ? velcroMat : you.mats.shirt;
    for (const f of fuzz) f.visible = on;
    for (const m of you.torsoMeshes) m.scale.x = on ? 1.07 : 1;
  };

  const sweater = makeSweaterProp(velcroMat);
  const knit = makeKnitting();
  const wip = new THREE.Group();
  const wipBody = mesh(new THREE.BoxGeometry(0.26, 0.2, 0.03, 2, 2, 1), velcroMat); wipBody.position.y = -0.1; wip.add(wipBody);
  const wipFuzz = makeFuzz(70, 0.12, 0.2, 21); wipFuzz.position.y = -0.2; wipFuzz.scale.set(1.1, 1, 0.3); wip.add(wipFuzz);
  const yarn = makeYarnBall();
  const strand = mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 4), mat('#9a9ca2'), { cast: false });
  room.scene.add(sweater, knit.n1, knit.n2, wip, yarn, strand);
  const handPancake = makeSinglePancake();
  yard.scene.add(handPancake);
  // close-up stand-in arms for the button shot (exact control of the finger)
  const plaidMat = dad.mats.shirt;
  const armProp = new THREE.Group();
  const sleeve = mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.42, 7), plaidMat); sleeve.rotation.x = Math.PI / 2; sleeve.position.z = 0.27; armProp.add(sleeve);
  const handP = mesh(new THREE.IcosahedronGeometry(0.048, 0), dad.mats.skin); handP.scale.set(0.85, 0.62, 1.15); handP.position.z = 0.03; armProp.add(handP);
  const fingerP = mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.075, 6), dad.mats.skin); fingerP.rotation.x = Math.PI / 2; fingerP.position.set(0.0, 0.004, -0.04); armProp.add(fingerP);
  const nail = mesh(new THREE.SphereGeometry(0.0105, 6, 4), mat('#f6d2c0')); nail.position.set(0, 0.006, -0.077); armProp.add(nail);
  const knuck = mesh(new THREE.BoxGeometry(0.075, 0.03, 0.05), dad.mats.skin); knuck.position.set(0.01, -0.012, 0.0); armProp.add(knuck);
  room.scene.add(armProp);

  // ---------------- particles ----------------
  const r0 = mulberry32(1234);
  const fluffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.0085, 0), mat('#9c9ea3', { roughness: 1 }), 260);
  fluffMesh.frustumCulled = false; fluffMesh.castShadow = false;
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.04, 0, -0.025, -0.02, 0.002, 0.03, -0.025, -0.002], 3));
  shardGeo.computeVertexNormals();
  const glassMesh = new THREE.InstancedMesh(shardGeo, new THREE.MeshPhysicalMaterial({ color: '#e8f6ff', roughness: 0.02, metalness: 0.25, envMapIntensity: 3, emissive: '#9fd8ff', emissiveIntensity: 0.25, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 220);
  glassMesh.frustumCulled = false;
  const dotTex = TX.softDot(), starTex = TX.starSprite();
  const makePoints = (n, tex, additive) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('size', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('alpha', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, scale: { value: 1920 * 0.5 } },
      vertexShader: `attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC;
        void main(){ vA = alpha; vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 1080.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC; void main(){ vec4 c = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vC * c.rgb, c.a * vA); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const p = new THREE.Points(geo, m); p.frustumCulled = false; return p;
  };
  const dust = makePoints(220, dotTex, false);
  const sparks = makePoints(140, starTex, true);

  // ---------------- key times (from the voice) ----------------
  const K = {};
  K.whip = Wd(11) + 0.04;                // "boom" -> whip pan to the door
  K.dadIn = Wd(12) - 0.1;
  K.freeze = Wd(15) + 0.02;              // "in."
  K.sweaterOn = Wd(41);                   // "put"
  K.lean0 = Wd(48); K.stick = Wd(56) - 0.04;
  K.rip = Wd(59) - 0.06; K.fanStick = Wd(62) + 0.05;
  K.press = Wd(69) + 0.12;                // "holds"
  K.spin0 = Wd(76) - 0.1; K.release = Wd(82); K.crash = Wd(86) - 0.02;
  K.b1 = Wd(91); K.b2 = Wd(92); K.b3 = Wd(93);
  K.land = Wd(100) - 0.02;
  K.hand0 = Wd(109); K.hand1 = Wd(112) + 0.1;
  K.itch = Wd(114);
  K.voiceEnd = We(words.length - 1);
  const duration = Math.max(K.voiceEnd + 1.35, T.end || 0);
  K.ding = K.voiceEnd + 0.15;

  // fan angular velocity -> angle table (deterministic integration)
  const fanOmega = (t) => {
    if (t < K.press) return 0;
    if (t < K.spin0) return lerp(0, 2.5, smooth(invLerp(K.press, K.press + 0.8, t)));
    if (t < K.crash + 0.3) return lerp(2.5, 30, easeIn(invLerp(K.spin0, K.release, t)));
    return lerp(30, 6, invLerp(K.crash + 0.3, K.crash + 2.5, t));
  };
  const fanTable = []; { let a = 0; for (let i = 0; i <= Math.ceil(duration * 1000) + 10; i++) { fanTable.push(a); a += fanOmega(i / 1000) / 1000; } }
  const fanAngle = (t) => { const i = clamp(Math.floor(t * 1000), 0, fanTable.length - 2); const f = t * 1000 - i; return lerp(fanTable[i], fanTable[i + 1], f); };

  // ---------------- particle bursts ----------------
  const bursts = [];
  const burst = (o) => bursts.push(Object.assign({ seed: bursts.length * 17 + 3 }, o));
  const wallHit = V(-3.33, 1.25, 0.0);
  burst({ kind: 'fluff', world: 'room', t: K.sweaterOn + 0.05, o: V(0, 1.2, 0.3), n: 50, speed: 1.4, life: 1.6 });
  burst({ kind: 'dust', world: 'room', t: K.stick, o: wallHit, n: 40, speed: 1.2, life: 1.2, dir: V(1, 0, 0) });
  burst({ kind: 'fluff', world: 'room', t: K.stick, o: wallHit, n: 50, speed: 1.6, life: 1.8, dir: V(1, 0.2, 0) });
  burst({ kind: 'fluff', world: 'room', t: K.rip, o: V(-3.25, 1.35, 0), n: 90, speed: 2.6, life: 2.0, dir: V(1, 0.3, 0) });
  burst({ kind: 'dust', world: 'room', t: K.rip, o: V(-3.3, 1.35, 0), n: 30, speed: 1.0, life: 1.0, dir: V(1, 0, 0) });
  burst({ kind: 'fluff', world: 'room', t: K.fanStick, o: V(0.55, 2.5, 0), n: 40, speed: 1.4, life: 1.8 });
  burst({ kind: 'glass', world: 'room', t: K.crash, o: V(ROOM.window.x, ROOM.window.y, -2.98), n: 200, speed: 4.5, life: 2.2, dir: V(0, 0.1, -1) });
  burst({ kind: 'dust', world: 'room', t: K.crash, o: V(ROOM.window.x, ROOM.window.y, -2.9), n: 25, speed: 1.4, life: 0.9, dir: V(0, 0, 1) });
  for (const tb of [K.b1, K.b2, K.b3]) burst({ kind: 'fluff', world: 'yard', t: tb, o: V(YARD.tramp.x, 1.0, YARD.tramp.z), n: 18, speed: 1.6, life: 1.2 });
  burst({ kind: 'dust', world: 'yard', t: K.land, o: V(-0.42, roofSurfaceY(0.32), 0.45), n: 30, speed: 0.9, life: 1.0, dir: V(0, 0.3, 0.4), small: true });
  burst({ kind: 'fluff', world: 'yard', t: K.land, o: V(-0.42, roofSurfaceY(0.32) + 0.4, 0.4), n: 40, speed: 1.5, life: 1.6 });

  function updateParticles(t, world, scene) {
    scene.add(fluffMesh, glassMesh, dust, sparks);
    const d = new THREE.Object3D();
    let fi = 0, gi = 0, di = 0;
    const dp = dust.geometry.attributes;
    for (const b of bursts) {
      if (b.world !== world) continue;
      const age = t - b.t;
      if (age < 0 || age > b.life) continue;
      const r = mulberry32(b.seed);
      for (let i = 0; i < b.n; i++) {
        const rx = r() * 2 - 1, ry = r() * 2 - 1, rz = r() * 2 - 1, rs = r(), rr = r();
        const dir = tmpV.set(rx, ry * 0.8 + 0.3, rz).normalize();
        if (b.dir) dir.addScaledVector(b.dir, 1.3).normalize();
        const sp = b.speed * (0.35 + rs);
        if (b.kind === 'fluff') {
          if (fi >= 260) continue;
          const k = 2.2, drift = (1 - Math.exp(-k * age)) / k;
          d.position.copy(b.o).addScaledVector(dir, sp * drift);
          d.position.y += -0.35 * age * age + Math.sin(age * 3 + i) * 0.03;
          d.rotation.set(age * 6 * rx, age * 5 * ry, 0);
          d.scale.setScalar((0.5 + rr * 0.9) * (1 - smooth(invLerp(b.life * 0.6, b.life, age))));
          d.updateMatrix(); fluffMesh.setMatrixAt(fi++, d.matrix);
        } else if (b.kind === 'glass') {
          if (gi >= 220) continue;
          const v = tmpV2.copy(dir).multiplyScalar(sp);
          if (i % 4 === 0) v.z *= -0.35; // some shards fall back inside
          d.position.copy(b.o).addScaledVector(v, age);
          d.position.x += (rx) * 0.6; d.position.y += ry * 0.55;
          d.position.y -= 4.9 * age * age;
          if (d.position.y < 0.01) d.position.y = 0.01;
          d.rotation.set(age * 14 * rx, age * 11 * ry, age * 9 * rz);
          d.scale.setScalar(0.7 + rr * 1.8);
          d.updateMatrix(); glassMesh.setMatrixAt(gi++, d.matrix);
        } else if (b.kind === 'dust') {
          if (di >= 220) continue;
          const k = 3.0, drift = (1 - Math.exp(-k * age)) / k;
          const p = tmpV2.copy(b.o).addScaledVector(dir, sp * drift);
          p.y += age * 0.12;
          dp.position.setXYZ(di, p.x, p.y, p.z);
          dp.size.setX(di, (b.small ? 0.05 + rr * 0.08 : 0.1 + rr * 0.16) * (1 + age * 1.6));
          dp.alpha.setX(di, (b.small ? 0.35 : 0.45) * (1 - invLerp(0, b.life, age)) * smooth(age / 0.05));
          dp.color.setXYZ(di, 0.92, 0.86, 0.78);
          di++;
        }
      }
    }
    fluffMesh.count = fi; fluffMesh.instanceMatrix.needsUpdate = true;
    glassMesh.count = gi; glassMesh.instanceMatrix.needsUpdate = true;
    for (let i = di; i < 220; i++) dp.alpha.setX(i, 0);
    dp.position.needsUpdate = dp.size.needsUpdate = dp.alpha.needsUpdate = dp.color.needsUpdate = true;
  }
  // sparkle emitter: positions around a centre, twinkling
  const sparkList = [];
  function sparkle(center, radius, n, t, t0, t1, seed = 1, size = 0.12) {
    const r = mulberry32(seed);
    for (let i = 0; i < n; i++) {
      const ph = r() * 6.28, sp = 5 + r() * 6;
      const p = center.clone().add(V((r() - 0.5) * 2 * radius, (r() - 0.5) * 2 * radius, (r() - 0.5) * radius));
      const fade = smooth(invLerp(t0, t0 + 0.15, t)) * (1 - smooth(invLerp(t1 - 0.2, t1, t)));
      const a = Math.max(0, Math.sin(t * sp + ph)) * fade;
      sparkList.push({ p, size: size * (0.6 + r()), a });
    }
  }
  function flushSparks() {
    const sa = sparks.geometry.attributes;
    let i = 0;
    for (const s of sparkList) { if (i >= 140) break; sa.position.setXYZ(i, s.p.x, s.p.y, s.p.z); sa.size.setX(i, s.size); sa.alpha.setX(i, s.a); sa.color.setXYZ(i, 1, 0.95, 0.75); i++; }
    for (; i < 140; i++) sa.alpha.setX(i, 0);
    sa.position.needsUpdate = sa.size.needsUpdate = sa.alpha.needsUpdate = sa.color.needsUpdate = true;
    sparkList.length = 0;
  }

  // ---------------- comic pops & audio cues ----------------
  const pops = [
    { text: 'RIIIP!', t: K.rip, x: 330, y: 400, rot: -0.12, seed: 3 },
    { text: 'SPIN!', t: Wd(77), x: 730, y: 380, rot: 0.1, seed: 5, burst: '#5fd3ff', color: '#ffe11f' },
    { text: 'CRASH!', t: K.crash, x: 540, y: 420, rot: -0.06, seed: 9, size: 140 },
    { text: 'BOING!', t: K.b1, x: 300, y: 430, rot: -0.14, seed: 11, dur: 0.6, size: 118 },
    { text: 'BOING!', t: K.b2, x: 770, y: 360, rot: 0.12, seed: 12, dur: 0.6, size: 124 },
    { text: 'BOING!', t: K.b3, x: 540, y: 300, rot: -0.05, seed: 13, dur: 0.8, size: 138 },
  ];
  const events = [
    { type: 'moan', t: 0.0, dur: Math.min(4.05, K.freeze + 0.05), gain: 0.95, variant: 'long' },
    { type: 'moan', t: Wd(18), dur: 1.0, gain: 0.5, variant: 'short' },
    { type: 'whoosh', t: K.whip - 0.05, gain: 0.5 },
    { type: 'pop', t: K.sweaterOn, gain: 0.5 },
    { type: 'moan', t: Wd(46) - 0.05, dur: 1.3, gain: 0.75, variant: 'short' },
    { type: 'thud', t: K.stick, gain: 1.0 },
    { type: 'velcro', t: K.rip - 0.12, gain: 1.0 },
    { type: 'whoosh', t: K.rip + 0.05, gain: 0.45 },
    { type: 'thud', t: K.fanStick, gain: 0.45 },
    { type: 'click', t: K.press, gain: 0.8 },
    { type: 'fan', t: K.spin0 - 0.15, dur: K.crash - K.spin0 + 0.4, gain: 0.8 },
    { type: 'whoosh', t: K.release, gain: 0.55 },
    { type: 'glass', t: K.crash, gain: 1.0 },
    { type: 'boing', t: K.b1, gain: 0.85 }, { type: 'boing', t: K.b2, gain: 0.9 }, { type: 'boing', t: K.b3, gain: 1.0 },
    { type: 'whoosh', t: K.b3 + 0.1, gain: 0.45 },
    { type: 'roof', t: K.land, gain: 0.9 },
    { type: 'moan', t: K.itch - 0.05, dur: 1.2, gain: 0.6, variant: 'short' },
    { type: 'ding', t: K.ding, gain: 0.9 },
  ];
  for (const p of pops) events.push({ type: 'popfx', t: p.t, gain: 0.35 });
  const moans = events.filter((e) => e.type === 'moan');
  const moanAmt = (t) => { if (T.moanEnv) return clamp(env(T.moanEnv, t) * 1.3); let m = 0; for (const e of moans) { const a = t - e.t; if (a >= 0 && a <= e.dur) m = Math.max(m, Math.sin(Math.PI * a / e.dur) ** 0.6 * (0.6 + 0.4 * Math.sin(a * 7))); } return m; };

  // camera shakes
  const shakes = [
    { t: K.stick, a: 0.05, d: 7 }, { t: K.rip, a: 0.035, d: 7 }, { t: K.fanStick, a: 0.02, d: 8 },
    { t: K.crash, a: 0.07, d: 6 }, { t: K.b1, a: 0.02, d: 9 }, { t: K.b2, a: 0.025, d: 9 }, { t: K.b3, a: 0.035, d: 8 }, { t: K.land, a: 0.045, d: 7 },
  ];

  // ---------------- helpers ----------------
  function place(h, x, y, z, yaw = 0) { h.root.position.set(x, y, z); h.root.rotation.set(0, yaw, 0); }
  function headPos(h, out = new THREE.Vector3()) { h.root.updateMatrixWorld(true); return h.headC.getWorldPosition(out); }
  function jointPos(obj, out = new THREE.Vector3()) { obj.updateWorldMatrix(true, false); return obj.getWorldPosition(out); }
  function setWorld(obj, pos, quat) {
    obj.parent.updateWorldMatrix(true, false);
    tmpM.compose(pos, quat, obj.scale.clone().set(1, 1, 1));
    const inv = obj.parent.matrixWorld.clone().invert();
    tmpM.premultiply(inv);
    tmpM.decompose(obj.position, obj.quaternion, tmpV2);
  }
  const yawQ = (yaw) => new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  // camera: position, subject, fov; subject drawn at screen fraction sy from the top
  function frame(pos, subject, fov, sy = 0.5, roll = 0) {
    camera.fov = fov; camera.updateProjectionMatrix();
    camera.position.copy(pos);
    const dir = tmpV.copy(subject).sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const a = Math.atan((1 - 2 * sy) * Math.tan((fov * DEG) / 2));
    const look = pos.clone().addScaledVector(dir, Math.cos(a)).addScaledVector(camUp, -Math.sin(a));
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    if (roll) camera.rotateZ(roll);
  }
  function shake(t) {
    let x = 0, y = 0, z = 0;
    for (const s of shakes) {
      const a = t - s.t; if (a < 0 || a > 1.2) continue;
      const amp = s.a * Math.exp(-s.d * a);
      x += amp * noise1(t * 38, 1); y += amp * noise1(t * 41, 2); z += amp * 0.6 * noise1(t * 35, 3);
    }
    camera.position.x += x; camera.position.y += y; camera.position.z += z;
    camera.rotateZ(x * 0.8);
  }
  const keepLevel = (obj, yaw) => { obj.updateWorldMatrix(true, false); const p = obj.getWorldPosition(new THREE.Vector3()); setWorld(obj, p, yawQ(yaw)); };
  // dad holds the plate level on his left palm
  function dadPlate(yaw, lift = 0) {
    pose(dad, { shL: [-0.42, 0.12, 0.18], elL: [-1.25, 0, 0], handL: [0, 0, -0.1] });
    dad.root.updateMatrixWorld(true);
    const palm = dad.palmL.getWorldPosition(new THREE.Vector3());
    const fwd = V(Math.sin(yaw), 0, Math.cos(yaw));
    setWorld(dad.plate.group, palm.add(V(0, 0.045 + lift, 0)).addScaledVector(fwd, 0.04), yawQ(yaw));
  }
  function walk(h, phase, amt = 1) {
    const s = Math.sin(phase), c = Math.cos(phase);
    pose(h, {
      hipL: [0.42 * s * amt, 0, 0], hipR: [-0.42 * s * amt, 0, 0],
      kneeL: [Math.max(0, -c) * 0.7 * amt + 0.05, 0, 0], kneeR: [Math.max(0, c) * 0.7 * amt + 0.05, 0, 0],
      shR: [0.32 * s * amt, 0, -0.12],
    });
    h.j.hips.position.y = h.hipY + Math.abs(c) * 0.03 * amt - 0.015;
    h.j.spine.rotation.y = 0.08 * s * amt;
  }
  function sit(h, roofAngle = 0) {
    const hip = -Math.PI / 2 + roofAngle;
    pose(h, { hipL: [hip, 0, 0.06], hipR: [hip, 0, -0.06], kneeL: [1.35 - roofAngle * 0.8, 0, 0], kneeR: [1.35 - roofAngle * 0.8, 0, 0], ankleL: -0.1, ankleR: -0.1 });
  }
  function talk(h, t, amt = 1, mode = 'o', eyes = 'open', extra = {}) {
    const v = voice(t) * amt;
    h.setFace({ eyes, mouth: v > 0.08 ? mode : (extra.rest || 'smile'), open: v, t, ...extra });
  }

  // ---------------- default world layout ----------------
  const YOU_DOOR = V(-0.74, 0, -2.79);
  const DAD_DOOR = V(3.02, 0, -1.92);
  const dadYawToYou = Math.atan2(YOU_DOOR.x - DAD_DOOR.x, YOU_DOOR.z - DAD_DOOR.z);
  const CHAIR_YAW = -Math.PI / 2 - 0.35;
  const chairFwd = V(Math.sin(CHAIR_YAW), 0, Math.cos(CHAIR_YAW));
  const GMA_POS = ROOM.chair.clone().addScaledVector(chairFwd, 0.05).setY(0.6 - gma.hipY);
  const ROOF_YOU = V(-0.42, 0, 0.32), ROOF_DAD = V(0.5, 0, 0.28);
  const roofAng = Math.atan2(YARD.roofRidgeY - YARD.roofEaveY, YARD.roofEaveZ);

  function seatGrandma(t, knitting = true) {
    gma.root.visible = true;
    place(gma, GMA_POS.x, GMA_POS.y, GMA_POS.z, CHAIR_YAW);
    sit(gma, 0.05);
    pose(gma, { spine: [0.12, 0, 0], neck: [0.05, 0, 0], head: [0.12, 0, 0] });
    if (knitting) {
      const f = Math.sin(t * 2 * Math.PI * 1.2);
      pose(gma, { shL: [-0.55, 0, 0.32], elL: [-1.35, -0.3, 0], shR: [-0.55, 0, -0.32], elR: [-1.35, 0.3, 0] });
      gma.j.elL.rotation.x += 0.05 * f; gma.j.elR.rotation.x -= 0.05 * f;
    }
  }
  function roomDefaults(t) {
    place(you, YOU_DOOR.x, 0, YOU_DOOR.z, 0);
    place(dad, DAD_DOOR.x, 0, DAD_DOOR.z, dadYawToYou);
    dadPlate(dadYawToYou);
    dad.setFace({ eyes: 'wide', mouth: 'flat', t });
    seatGrandma(t);
    gma.setFace({ eyes: 'open', mouth: 'smile', t });
    you.setFace({ t });
    room.rotor.rotation.y = fanAngle(t);
    for (let i = 0; i < 3; i++) room.leds[i].material.emissiveIntensity = t > K.press + 0.25 + i * 0.35 ? 2.5 : 0;
    room.button.position.z = 0.016;
    const broken = t >= K.crash;
    room.panes.forEach((p) => { p.visible = !broken; });
    for (const p of room.pics) p.rotation.z = 0;
    sweater.visible = false; knit.n1.visible = knit.n2.visible = false; wip.visible = false; yarn.visible = false; strand.visible = false;
    armProp.visible = false;
    // knitting gear resting on the side
    yarn.visible = true; yarn.position.set(2.2, 0.075, 1.75); yarn.rotation.set(0, 0, 0);
  }
  function yardDefaults(t, sunset = 0) {
    gma.root.visible = false;
    setSky(sunset);
    handPancake.visible = false;
    yard.trampMat.scale.y = 0.02;
  }
  const C = (hex) => new THREE.Color(hex);
  const SKY = {
    day: { top: C('#3d86e0'), hor: C('#d2eaff'), bot: C('#a7cfa3'), sun: C('#fff2d0'), dir: V(-0.45, 0.62, 0.62), light: C('#fff0d4'), li: 3.1, hs: C('#cfe6ff'), hg: C('#6a9a50'), hi: 1.0 },
    set: { top: C('#2f3f86'), hor: C('#ff9a58'), bot: C('#5e4660'), sun: C('#ffb36a'), dir: V(-0.6, 0.14, -0.79), light: C('#ff9f55'), li: 2.4, hs: C('#ffb48a'), hg: C('#4a3a5a'), hi: 0.75 },
  };
  function setSky(s) {
    const a = SKY.day, b = SKY.set, u = yard.skyU;
    u.top.value.copy(a.top).lerp(b.top, s); u.horizon.value.copy(a.hor).lerp(b.hor, s); u.bottom.value.copy(a.bot).lerp(b.bot, s);
    u.sunCol.value.copy(a.sun).lerp(b.sun, s); u.sunDir.value.copy(a.dir).lerp(b.dir, s).normalize();
    u.sunSize.value = lerp(1.0, 2.2, s);
    yard.scene.fog.color.copy(u.horizon.value);
    yard.sun.color.copy(a.light).lerp(b.light, s); yard.sun.intensity = lerp(a.li, b.li, s);
    yard.hemi.color.copy(a.hs).lerp(b.hs, s); yard.hemi.groundColor.copy(a.hg).lerp(b.hg, s); yard.hemi.intensity = lerp(a.hi, b.hi, s);
    yard.fill.intensity = lerp(0, 1.1, s); yard.fill.color.set('#ffc898');
    const lightDir = a.dir.clone().lerp(V(-0.45, 0.4, -0.8), s).normalize();
    yard.sunDir = lightDir;
  }
  function sunShadow(center, ext) {
    const s = yard.sun;
    s.target.position.copy(center);
    s.position.copy(center).addScaledVector(yard.sunDir, 30);
    Object.assign(s.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 70 });
    s.shadow.camera.updateProjectionMatrix();
  }

  // ---------------- shots ----------------
  const shots = [];
  const shot = (id, t0, t1, world, fn) => shots.push({ id, t0, t1, world, fn });

  // 1a: close-up on your blissful face sliding up and down (don't reveal what "it" is)
  shot('1a', 0, K.whip, 'room', (lt, t, ctx) => {
    const bob = Math.sin(t * 2 * Math.PI * 1.75);
    you.j.hips.position.y = you.hipY - 0.06 + bob * 0.07;
    pose(you, { kneeL: 0.14 - bob * 0.13, kneeR: 0.14 - bob * 0.13, hipL: -0.07 + bob * 0.06, hipR: -0.07 + bob * 0.06, neck: [-0.18, 0, 0.07 * Math.sin(t * 3.4)], head: [-0.24 + 0.05 * bob, 0.06 * Math.sin(t * 2.6), 0.09 * Math.sin(t * 3.0)] });
    const m = Math.max(moanAmt(t), voice(t) * 0.5);
    you.setFace({ eyes: 'half', mouth: 'o', open: 0.35 + 0.65 * m, t });
    const hp = headPos(you);
    const camPos = V(YOU_DOOR.x + 0.06, 1.6, YOU_DOOR.z + lerp(1.12, 0.92, easeInOut(lt / 3)));
    frame(camPos, V(hp.x, 1.61, hp.z), 34, 0.3);
    ctx.dof = { focus: camPos.distanceTo(hp), aperture: 0.004, maxblur: 0.008 };
  });

  // 1b: whip-pan to the door: dad walks in with pancakes and freezes
  shot('1b', K.whip, Wd(16) - 0.04, 'room', (lt, t, ctx) => {
    // you keep rubbing off-screen
    const bob = Math.sin(t * 2 * Math.PI * 1.75);
    you.j.hips.position.y = you.hipY - 0.06 + bob * 0.07;
    // dad walks in from the hallway then freezes
    const walkEnd = K.freeze - 0.05;
    const wp = clamp(invLerp(K.dadIn, walkEnd, t));
    const start = V(4.55, 0, -1.95), end = DAD_DOOR;
    const p = start.clone().lerp(end, easeOut(wp));
    const yaw = lerp(-Math.PI / 2, dadYawToYou, smooth(invLerp(walkEnd - 0.2, walkEnd, t)));
    place(dad, p.x, 0, p.z, yaw);
    const frozen = t >= walkEnd;
    if (!frozen) walk(dad, (t - K.dadIn) * 9, 1);
    else {
      walk(dad, (walkEnd - K.dadIn) * 9, 1); // frozen mid-step
      const k = t - walkEnd;
      dad.squash(1 + 0.06 * wobble(k, 3, 5));
      pose(dad, { spine: [-0.06 * spring(k, 2, 6), 0, 0], head: [-0.08 * spring(k, 2, 6), 0, 0] });
    }
    dadPlate(yaw, frozen ? 0.02 * spring(t - walkEnd, 3, 6) : 0.01 * Math.abs(Math.sin((t - K.dadIn) * 9)));
    dad.setFace({ eyes: frozen ? 'wide' : 'open', mouth: frozen ? 'o' : 'flat', open: 0.22, t, blink: 0 });
    // camera whip
    const w = easeInOut(clamp(lt / 0.3));
    const camPos = V(-0.66, lerp(1.6, 1.45, w), lerp(-2.0, -1.75, w));
    const lookA = V(YOU_DOOR.x, 1.55, YOU_DOOR.z), lookB = V(DAD_DOOR.x, 1.05, DAD_DOOR.z);
    const yawA = Math.atan2(lookA.x - camPos.x, lookA.z - camPos.z), yawB = Math.atan2(lookB.x - camPos.x, lookB.z - camPos.z);
    let yy = yawA + (((yawB - yawA + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * w;
    const dist = lerp(0.8, camPos.distanceTo(lookB), w);
    const look = V(camPos.x + Math.sin(yy) * dist, lerp(1.55, 1.05, w), camPos.z + Math.cos(yy) * dist);
    const push = smooth(invLerp(K.freeze, K.freeze + 1.0, t));
    camera.fov = lerp(34, lerp(31, 26, push), w); camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    ctx.mb = lt < 0.34 ? 6 : 1; ctx.shutter = 0.9;
  });

  // 2a: pull back — you're scratching your back on the door frame
  shot('2a', Wd(16) - 0.04, Wd(21) - 0.03, 'room', (lt, t, ctx, s) => {
    const ph = t * 2 * Math.PI * 2.0;
    const sq = 0.5 + 0.5 * Math.sin(ph);
    you.j.hips.position.y = you.hipY - 0.04 - sq * 0.13;
    pose(you, {
      hipL: [-0.25 * sq, 0, 0.05], hipR: [-0.25 * sq, 0, -0.05], kneeL: 0.5 * sq + 0.05, kneeR: 0.5 * sq + 0.05, ankleL: -0.25 * sq, ankleR: -0.25 * sq,
      spine: [-0.06, 0, 0.1 * Math.sin(ph + 1.2)], chest: [-0.05, 0.12 * Math.sin(ph * 0.5), 0],
      neck: [-0.2, 0, 0], head: [-0.15, 0, 0.1 * Math.sin(ph * 0.5)],
      shL: [0.15, 0, 0.35], elL: -0.9, shR: [0.15, 0, -0.35], elR: -0.9,
    });
    const m = Math.max(moanAmt(t), voice(t) * 0.45);
    you.setFace({ eyes: 'half', mouth: 'o', open: 0.3 + 0.6 * m, t });
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = V(-0.66, 1.42, -2.0).lerp(V(0.35, 1.5, 0.95), k);
    const look = V(-0.74, 1.35, -2.8).lerp(V(-1.0, 1.02, -2.8), k);
    camera.fov = lerp(40, 50, k); camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    ctx.dof = k < 0.35 ? { focus: camPos.distanceTo(V(-0.74, 1.4, -2.8)), aperture: 0.0025 * (1 - k / 0.35) } : null;
  });

  // 2b: slow zoom on dad's glasses
  shot('2b', Wd(21) - 0.03, Wd(25) - 0.03, 'room', (lt, t, ctx, s) => {
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    dad.setFace({ eyes: 'wide', mouth: 'flat', t, blink: Math.max(0, Math.sin(clamp((t - Wd(23) + 0.05) / 0.18) * Math.PI)) });
    pose(dad, { head: [0.0, 0.0, 0.04 * k] });
    dadPlate(dadYawToYou);
    const hp = headPos(dad);
    const fwd = V(Math.sin(dadYawToYou), 0, Math.cos(dadYawToYou));
    const glasses = hp.clone().add(V(0, 0.03, 0)).addScaledVector(fwd, 0.17);
    const camPos = glasses.clone().addScaledVector(fwd, lerp(1.15, 0.72, k)).add(V(0.02, -0.04, 0));
    frame(camPos, glasses, lerp(30, 15, k), lerp(0.36, 0.33, k));
    ctx.dof = { focus: camPos.distanceTo(glasses), aperture: lerp(0.003, 0.012, k), maxblur: 0.01 };
    if (dad.lensMat) dad.lensMat.opacity = 0.16 + 0.12 * k;
    if (t > s.t1 - 0.45) ctx.sparkles2d.push({ pos: glasses.clone().add(V(0, 0.02, 0)).addScaledVector(V(-fwd.z, 0, fwd.x), 0.05), size: 70 * smooth(invLerp(s.t1 - 0.45, s.t1 - 0.25, t)) * (1 - smooth(invLerp(s.t1 - 0.2, s.t1, t))), alpha: 1, dx: 0, dy: 0 });
  });

  // 3a: grandma knits at super speed
  shot('3a', Wd(25) - 0.03, Wd(37) - 0.06, 'room', (lt, t, ctx, s) => {
    seatGrandma(t, false);
    const fast = Math.sin(t * 2 * Math.PI * 7.5), fast2 = Math.sin(t * 2 * Math.PI * 7.5 + 1.7);
    pose(gma, { shL: [-0.62 + 0.12 * fast, 0.1, 0.3], elL: [-1.45 + 0.2 * fast2, -0.35, 0], shR: [-0.62 - 0.12 * fast, -0.1, -0.3], elR: [-1.45 - 0.2 * fast2, 0.35, 0], head: [0.25, 0, 0], spine: [0.18, 0, 0] });
    talk(gma, t, 0.5, 'o', 'narrow', { rest: 'smile' });
    gma.root.updateMatrixWorld(true);
    const hl = gma.palmL.getWorldPosition(new THREE.Vector3()), hr = gma.palmR.getWorldPosition(new THREE.Vector3());
    const mid = hl.clone().add(hr).multiplyScalar(0.5);
    knit.n1.visible = knit.n2.visible = true;
    setWorld(knit.n1, hl, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9 + 0.3 * fast, CHAIR_YAW, 0.6)));
    setWorld(knit.n2, hr, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9 - 0.3 * fast, CHAIR_YAW, -0.6)));
    const grow = 0.25 + 0.75 * smooth(clamp(lt / (s.t1 - s.t0)));
    wip.visible = true; wip.scale.set(grow, grow, 1);
    setWorld(wip, mid.clone().add(V(0, -0.02, 0)), yawQ(CHAIR_YAW));
    yarn.position.set(2.05, 0.075, 1.85); yarn.rotation.set(t * 25, t * 9, 0);
    strand.visible = true;
    const a = yarn.position.clone(), b = mid.clone();
    strand.position.copy(a).add(b).multiplyScalar(0.5); strand.scale.set(1, a.distanceTo(b), 1);
    strand.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    const hp = headPos(gma);
    const k = easeOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = hp.clone().addScaledVector(chairFwd, lerp(1.75, 1.35, k)).add(V(0, -0.38 + 0.01 * fast, 0));
    frame(camPos, hp, 40, 0.3, 0.012 * fast);
    ctx.mb = 3; ctx.shutter = 0.7;
    ctx.speedLines = 0.9;
    ctx.dof = { focus: camPos.distanceTo(hp), aperture: 0.0016 };
  });

  // 3b: she holds up the finished Velcro sweater — sparkle
  shot('3b', Wd(37) - 0.06, Wd(40) - 0.03, 'room', (lt, t, ctx, s) => {
    seatGrandma(t, false);
    const up = easeOutBack(clamp(lt / 0.35), 2);
    pose(gma, { shL: [lerp(-0.6, -0.95, up), 0, 0.55], elL: [lerp(-1.3, -0.2, up), 0, 0], shR: [lerp(-0.6, -0.95, up), 0, -0.55], elR: [lerp(-1.3, -0.2, up), 0, 0], spine: [lerp(0.15, -0.06, up), 0, 0], head: [-0.08, 0, 0.06] });
    gma.squash(1 + 0.05 * wobble(lt, 3, 5));
    gma.setFace({ eyes: 'happy', mouth: 'grin', open: 0.5 + 0.4 * voice(t), t });
    gma.root.updateMatrixWorld(true);
    const hl = gma.palmL.getWorldPosition(new THREE.Vector3()), hr = gma.palmR.getWorldPosition(new THREE.Vector3());
    const mid = hl.clone().add(hr).multiplyScalar(0.5);
    sweater.visible = true;
    sweater.scale.setScalar(0.92 + 0.08 * up);
    setWorld(sweater, mid.clone().add(V(0, -0.2, 0)).addScaledVector(chairFwd, 0.12), yawQ(CHAIR_YAW).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), 0.06 * Math.sin(t * 5))));
    sparkle(mid.clone().add(V(0, -0.2, 0)).addScaledVector(chairFwd, 0.16), 0.42, 26, t, s.t0 + 0.15, s.t1 + 0.3, 31, 0.13);
    const hp = headPos(gma);
    const k = easeOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = hp.clone().addScaledVector(chairFwd, lerp(2.7, 2.35, k)).add(V(0, -0.35, 0));
    frame(camPos, hp.clone().add(V(0, 0.05, 0)), 40, 0.25);
    ctx.bloom = 0.45;
  });

  // 4: you put it on... and it feels AMAZING
  shot('4', Wd(40) - 0.03, Wd(48) - 0.03, 'room', (lt, t, ctx, s) => {
    const P = V(0, 0, 0.35);
    place(you, P.x, 0, P.z, 0);
    const on = t - K.sweaterOn;
    if (on < 0) {
      // pulling it over the head
      pose(you, { shL: [-2.7, 0, 0.3], shR: [-2.7, 0, -0.3], elL: -0.6, elR: -0.6 });
      you.setFace({ eyes: 'closed', mouth: 'flat', t });
    } else {
      const wig = Math.sin(t * 2 * Math.PI * 2.2);
      you.squash(1 + 0.1 * wobble(on, 2.5, 4) + 0.025 * wig);
      pose(you, {
        spine: [0.04, 0.22 * wig, 0.06 * wig], chest: [0, 0.15 * wig, 0], hips: [0, -0.12 * wig, 0.05 * wig],
        shL: [-0.75, -1.0, -0.3], elL: [-1.95, 0, 0], shR: [-0.75, 1.0, 0.3], elR: [-1.95, 0, 0],
        head: [0.05, 0.1 * wig, 0.12 * wig], neck: [-0.05, 0, 0],
      });
      you.j.hips.position.y = you.hipY + 0.015 * Math.abs(wig);
      const m = moanAmt(t);
      you.setFace({ eyes: 'happy', mouth: m > 0.15 || voice(t) > 0.5 && t > Wd(46) ? 'o' : 'grin', open: Math.max(m, 0.4), t });
      for (let i = 0; i < 7; i++) {
        const st = K.sweaterOn + 0.3 + i * 0.24, a = t - st;
        if (a < 0 || a > 1.4) continue;
        const r = mulberry32(i * 7 + 2);
        ctx.hearts.push({ pos: headPos(you).add(V((r() - 0.5) * 0.5, 0.15, 0)), dx: Math.sin(a * 4 + i) * 22, dy: -a * 260, size: 42 + r() * 26, alpha: 1 - smooth(invLerp(0.9, 1.4, a)), rot: (r() - 0.5) * 0.5 });
      }
    }
    const hp = headPos(you);
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = V(0.15, 1.32, lerp(2.75, 2.35, k));
    frame(camPos, V(0, 1.62, P.z), 40, 0.28);
    ctx.dof = { focus: camPos.distanceTo(hp), aperture: 0.0012 };
  });

  // 5: lean on the wall... THUD, stuck flat, feet off the floor
  const WALLX = -3.5;
  function wallStuck(t, extraLift = 0, strain = 0) {
    place(you, WALLX + 0.17 + strain * 0.25, 0.3 + extraLift, 0, Math.PI / 2);
    const k = t - K.stick;
    const flat = 1 + 0.16 * Math.exp(-6 * Math.max(0, k)) - strain * 0.12;
    you.body.scale.set(1 / Math.sqrt(flat), 1, flat > 1 ? 1 / flat : 1 + strain * 0.35);
    pose(you, {
      shL: [-0.15, 0, 2.0 + 0.05 * wobble(k, 3, 4)], elL: [-0.25, 0, 0], shR: [-0.15, 0, -2.0 - 0.05 * wobble(k, 3, 4)], elR: [-0.25, 0, 0],
      hipL: [0.0, 0, 0.3], hipR: [0.0, 0, -0.3], kneeL: 0.15, kneeR: 0.15,
    });
  }
  shot('5', Wd(48) - 0.03, Wd(57) - 0.03, 'room', (lt, t, ctx, s) => {
    if (t < K.stick) {
      const lean = smooth(invLerp(K.lean0 + 0.1, K.stick - 0.05, t));
      place(you, WALLX + 0.58, 0, 0, Math.PI / 2);
      you.body.rotation.x = -lean * 0.24;
      pose(you, { shL: [0.1, 0, 0.25], shR: [0.1, 0, -0.25], elL: -0.3, elR: -0.3, head: [0.05, 0, 0] });
      you.setFace({ eyes: 'happy', mouth: 'smile', open: 0.3, t });
    } else {
      wallStuck(t);
      const k = t - K.stick;
      you.setFace({ eyes: k < 0.25 ? 'wide' : 'wide', mouth: 'o', open: 0.55 + 0.3 * voice(t), t });
      for (const [i, p] of room.pics.entries()) if (i >= 1 && i <= 3) p.rotation.z = 0.25 * wobble(k, 2.2, 2.2) * (i === 2 ? -1 : 1) + (i === 1 ? 0.12 * smooth(k * 3) : 0);
    }
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = V(lerp(-1.25, -1.45, k), 1.25, lerp(1.95, 1.7, k));
    camera.fov = 44; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(V(-3.15, 1.12, -0.05));
  });

  // 6: pull free (RIIIP!) ... and get stuck on the ceiling fan instead
  const GRIP_R = 0.62, ROTOR_Y = ROOM.fan.y - 0.44;
  const hangPivot = new THREE.Group(); room.scene.add(hangPivot);
  function hangOnFan(t, ctx, swing = 0) {
    const a = fanAngle(t);
    const grip = V(GRIP_R * Math.cos(a), ROTOR_Y - 0.02, -GRIP_R * Math.sin(a));
    hangPivot.position.copy(grip);
    hangPivot.rotation.order = 'YXZ';
    const om = fanOmega(t);
    const tilt = Math.min(1.25, Math.atan((om * om * GRIP_R) / 9.8 * 0.6));
    hangPivot.rotation.set(0.12 * swing, a - Math.PI, -tilt);
    hangPivot.add(you.root);
    place(you, 0, -2.03, 0, 0);
    pose(you, { shL: [-3.02, 0, 0.1], shR: [-3.02, 0, -0.1], elL: -0.08, elR: -0.08, hipL: [-0.2 - 0.25 * Math.sin(t * 7), 0, 0.15 + tilt * 0.3], hipR: [-0.2 + 0.25 * Math.sin(t * 7), 0, -0.15], kneeL: 0.3, kneeR: 0.45 });
    return { grip, tilt, om };
  }
  shot('6', Wd(57) - 0.03, Wd(68) - 0.03, 'room', (lt, t, ctx, s) => {
    let focus;
    if (t < K.rip) {
      const strain = smooth(invLerp(s.t0, K.rip, t));
      wallStuck(t, 0, strain * 0.35);
      pose(you, { spine: [0.3 * strain, 0, 0], neck: [0.25 * strain, 0, 0], shL: [-1.2 * strain, 0, 2.0 - 1.2 * strain], shR: [-1.2 * strain, 0, -2.0 + 1.2 * strain], hipL: [-0.6 * strain + 0.2 * Math.sin(t * 22), 0, 0.2], hipR: [-0.6 * strain - 0.2 * Math.sin(t * 22), 0, -0.2], kneeL: 0.9 * strain, kneeR: 0.9 * strain });
      you.setFace({ eyes: 'narrow', mouth: 'grin', open: 0.3, t });
      focus = V(-3.2, 1.3, 0);
    } else if (t < K.fanStick) {
      // fly in an arc from the wall to the fan blade
      const k = invLerp(K.rip, K.fanStick, t);
      const a = fanAngle(K.fanStick);
      const end = V(GRIP_R * Math.cos(a), ROTOR_Y - 2.05, -GRIP_R * Math.sin(a));
      const start = V(WALLX + 0.4, 0.3, 0);
      const p = start.clone().lerp(end, easeOut(k)); p.y += Math.sin(k * Math.PI) * 0.9;
      place(you, p.x, p.y, p.z, Math.PI / 2 - k * 1.2);
      you.body.rotation.x = -0.6 * Math.sin(k * Math.PI);
      you.squash(1 + 0.25 * Math.sin(k * Math.PI));
      pose(you, { shL: [-2.9 * k, 0, 0.6], shR: [-2.9 * k, 0, -0.6], hipL: [-0.5, 0, 0.3], hipR: [0.3, 0, -0.3], kneeL: 0.8, kneeR: 0.3 });
      you.setFace({ eyes: 'wide', mouth: 'o', open: 0.9, t });
      focus = p.clone().add(V(0, 1.2, 0));
    } else {
      const { grip } = hangOnFan(t, ctx, wobble(t - K.fanStick, 1.6, 2.5));
      you.squash(1 + 0.12 * wobble(t - K.fanStick, 3, 5));
      you.setFace({ eyes: 'wide', mouth: 'o', open: 0.4 + 0.4 * voice(t), t });
      focus = grip.clone().add(V(0, -0.7, 0));
    }
    // camera: from the wall framing, tilt and drift up to the fan
    const k = smoother(invLerp(K.rip - 0.05, K.fanStick + 0.25, t));
    const camPos = V(-1.45, 1.25, 1.7).lerp(V(-0.4, 1.15, 2.75), k);
    const follow = Math.sin(Math.PI * clamp(invLerp(K.rip - 0.1, K.fanStick + 0.35, t)));
    const look = V(-3.15, 1.15, -0.05).lerp(V(0.25, 1.95, -0.05), k).lerp(focus, 0.85 * follow);
    camera.fov = lerp(44, 50, k); camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    ctx.mb = t > K.rip && t < K.fanStick ? 5 : 1;
  });

  // 7a: dad's finger slowly presses the fan button (pancakes in the other hand)
  const SW = ROOM.switchPos;
  shot('7a', Wd(68) - 0.03, Wd(72) - 0.03, 'room', (lt, t, ctx, s) => {
    dad.root.visible = false;
    armProp.visible = true;
    const press = smooth(invLerp(s.t0 + 0.15, K.press, t));
    const btn = V(SW.x - 0.03, SW.y, SW.z);
    const from = V(-0.62, -0.28, -0.72).normalize();
    const tip = btn.clone().addScaledVector(from, lerp(0.22, 0.0, press) + 0.008);
    armProp.position.copy(tip).addScaledVector(from, 0.078);
    armProp.quaternion.setFromUnitVectors(V(0, 0, -1), from.clone().negate());
    room.button.position.z = 0.016 - (t > K.press ? 0.008 : 0);
    // the plate of pancakes hovers in the foreground (other hand)
    dad.root.visible = true;
    const camPos = V(SW.x - 0.42, SW.y + 0.08, SW.z + 0.34);
    camera.fov = 32; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(V(SW.x, SW.y - 0.04, SW.z - 0.03));
    ctx.dof = { focus: camPos.distanceTo(btn), aperture: 0.008, maxblur: 0.012 };
    // only the plate of pancakes shows, soft in the lower-right foreground
    hideExceptPlate(dad, true); dad.palmL.visible = false;
    camera.updateMatrixWorld();
    const fwdC = new THREE.Vector3(); camera.getWorldDirection(fwdC);
    const rightC = new THREE.Vector3().crossVectors(fwdC, UP).normalize();
    const platePos = camPos.clone().addScaledVector(fwdC, 0.3).addScaledVector(rightC, 0.1).add(V(0, -0.15, 0));
    setWorld(dad.plate.group, platePos, yawQ(Math.atan2(fwdC.x, fwdC.z)));
  });
  function hideExceptPlate(h, on) {
    h.root.traverse((o) => { if (o.isMesh) o.visible = !on; });
    if (on) { h.plate.group.traverse((o) => { if (o.isMesh) o.visible = true; }); h.palmL.visible = true; }
  }

  // 7b: of course he does — tiny evil smile, glasses glint
  shot('7b', Wd(72) - 0.03, Wd(76) - 0.03, 'room', (lt, t, ctx, s) => {
    const yaw = Math.PI * 0.72;
    place(dad, SW.x - 0.5, 0, SW.z + 0.48, yaw);
    pose(dad, { shR: [-0.9, 0, -0.3], elR: [-0.4, 0, 0] });
    dadPlate(yaw);
    const turn = smooth(invLerp(s.t0 + 0.1, s.t0 + 0.55, t));
    pose(dad, { neck: [0, -0.55 * turn, 0], head: [0.05, -0.5 * turn, -0.06 * turn] });
    const evil = smooth(invLerp(Wd(73), Wd(74) + 0.1, t));
    dad.setFace({ eyes: evil > 0.3 ? 'narrow' : 'open', mouth: evil > 0.25 ? 'smirk' : 'flat', t, blink: 0 });
    const hp = headPos(dad);
    const camDir = V(Math.sin(yaw - 1.1), 0, Math.cos(yaw - 1.1));
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = hp.clone().addScaledVector(camDir, lerp(1.45, 1.15, k)).add(V(0, -0.1, 0));
    frame(camPos, hp, 30, 0.3);
    ctx.dof = { focus: camPos.distanceTo(hp), aperture: 0.004 };
    const g0 = Wd(74) + 0.05;
    if (t > g0 && t < g0 + 0.5) {
      const a = (t - g0) / 0.5;
      ctx.sparkles2d.push({ pos: hp.clone().add(V(0, 0.05, 0)).addScaledVector(camDir, 0.17), dx: -18, dy: -6, size: 85 * Math.sin(a * Math.PI), alpha: 1 });
    }
  });

  // 8a: you spin faster and faster (SPIN!)
  shot('8a', Wd(76) - 0.03, K.release - 0.12, 'room', (lt, t, ctx, s) => {
    const { om, grip } = hangOnFan(t, ctx);
    you.setFace({ eyes: 'wide', mouth: 'o', open: 0.7 + 0.3 * Math.sin(t * 20), t });
    const k = easeIn(clamp(lt / (s.t1 - s.t0)));
    const camPos = V(2.3, 0.95, 2.9).lerp(V(2.0, 0.9, 2.5), k);
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(V(0.0, 2.05, -0.1));
    camera.rotateZ(0.06 * Math.sin(t * 3));
    ctx.mb = om > 4 ? 6 : 3; ctx.shutter = 0.75;
    ctx.speedLines = clamp(om / 18);
    shakes.length; // (shake below)
    camera.position.x += 0.01 * clamp(om / 25) * noise1(t * 50, 5);
  });

  // 8b: ... and fly right out the window (CRASH!)
  shot('8b', K.release - 0.12, Wd(87) - 0.03, 'room', (lt, t, ctx, s) => {
    let p;
    if (t < K.release) {
      hangOnFan(t, ctx);
      you.setFace({ eyes: 'wide', mouth: 'o', open: 1, t });
      hangPivot.updateMatrixWorld(true);
      p = you.root.getWorldPosition(new THREE.Vector3());
    } else {
      room.scene.add(you.root);
      const a = fanAngle(K.release);
      const start = V(GRIP_R * Math.cos(a) * 1.6, 1.75, -GRIP_R * Math.sin(a) * 1.6);
      const win = V(ROOM.window.x, ROOM.window.y - 0.2, -3.0);
      const k = invLerp(K.release, K.crash, t);
      p = start.clone().lerp(win, k);
      p.y += Math.sin(k * Math.PI) * 0.25;
      if (t > K.crash) { const k2 = t - K.crash; p.copy(win).add(V(0.4 * k2, -1.2 * k2 * k2, -3.5 * k2)); }
      const dir = win.clone().sub(start).normalize();
      const yaw = Math.atan2(dir.x, dir.z);
      place(you, p.x, p.y - 0.9, p.z, yaw);
      you.body.position.y = 0.9; you.body.position.z = 0;
      you.body.rotation.set(Math.PI / 2 * 0.92, 0, t * 9);
      you.body.position.y = 0;
      you.root.position.set(p.x, p.y, p.z);
      you.root.rotation.set(0, yaw, 0);
      pose(you, { shL: [-2.9, 0, 0.35], shR: [-2.9, 0, -0.35], hipL: [0.2, 0, 0.25], hipR: [-0.1, 0, -0.25], kneeL: 0.6, kneeR: 0.2 });
      you.setFace({ eyes: 'wide', mouth: 'o', open: 1, t });
      you.root.visible = t < K.crash + 0.35;
    }
    const camPos = V(-1.25, 1.55, 2.35);
    const look = V(0.75, 1.85, -1.5);
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    ctx.mb = 5; ctx.shutter = 0.7;
    ctx.flash = t > K.crash ? 0.55 * Math.exp(-(t - K.crash) * 14) : 0;
  });

  // 9: onto the neighbour's trampoline — BOING x3
  const TR = YARD.tramp;
  const matTop = 0.78;
  function trampState(t) {
    // returns { p (feet position), squash, airborne, dip }
    const land = V(TR.x, matTop, TR.z);
    const contacts = [K.b1, K.b2, K.b3];
    const heights = [1.5, 2.7];
    if (t < K.b1) {
      const t0 = Wd(87) - 0.2;
      const k = invLerp(t0, K.b1, t);
      const start = V(2.3, 3.2, 3.9);
      const p = start.clone().lerp(land, k); p.y += Math.sin(k * Math.PI) * 1.4;
      return { p, air: true, phase: k, spin: k * 1.4 };
    }
    for (let i = 0; i < 2; i++) {
      if (t >= contacts[i] && t < contacts[i + 1]) {
        const k = invLerp(contacts[i], contacts[i + 1], t);
        const p = land.clone(); p.y += 4 * heights[i] * k * (1 - k);
        return { p, air: k > 0.08 && k < 0.92, phase: k, spin: 0, contact: contacts[i] };
      }
    }
    return { p: land.clone(), air: false, phase: 0, contact: K.b3 };
  }
  function trampDip(t) {
    let d = 0;
    for (const c of [K.b1, K.b2, K.b3]) { const a = t - c; if (a > -0.07 && a < 0.5) d = Math.max(d, a < 0 ? (1 + a / 0.07) : Math.exp(-a * 6) * Math.cos(a * 18) * 0.5 + 0.5 * Math.exp(-a * 14)); }
    return d;
  }
  shot('9', Wd(87) - 0.03, Wd(94) - 0.03, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 0);
    dad.root.visible = false;
    let st;
    if (t < K.b3 + 0.04) st = trampState(t);
    else st = launchState(t);
    const dip = trampDip(t);
    yard.trampMat.scale.y = 0.02 + dip * 0.42;
    place(you, st.p.x, st.p.y - (st.air ? 0 : dip * 0.4), st.p.z, 0.2);
    if (st.air) {
      const k = st.phase;
      you.body.rotation.x = st.spin ? st.spin * Math.PI * 2 : 0;
      you.body.position.y = st.spin ? 0 : 0;
      const flail = Math.sin(t * 16);
      pose(you, { shL: [-2.6 + 0.5 * flail, 0, 0.5], shR: [-2.6 - 0.5 * flail, 0, -0.5], elL: -0.4, elR: -0.4, hipL: [-0.3 + 0.4 * flail, 0, 0.15], hipR: [-0.3 - 0.4 * flail, 0, -0.15], kneeL: 0.6, kneeR: 0.6 });
      you.setFace({ eyes: 'wide', mouth: 'grin', open: 0.8, t });
      you.squash(1 + 0.12 * Math.sin(k * Math.PI));
    } else {
      you.squash(1 - 0.28 * dip);
      pose(you, { kneeL: 0.6 * dip, kneeR: 0.6 * dip, hipL: -0.3 * dip, hipR: -0.3 * dip, shL: [-1.0, 0, 1.2], shR: [-1.0, 0, -1.2] });
      you.setFace({ eyes: 'happy', mouth: 'grin', open: 0.7, t });
    }
    const k = smooth(invLerp(K.b2, K.b3 + 0.3, t));
    const camPos = V(-2.3, 2.0, 14.0).lerp(V(-2.0, 2.2, 13.4), k);
    const look = V(0.9, 1.35, 8.4).lerp(V(1.0, 2.7, 8.2), k);
    camera.fov = 46; camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    sunShadow(V(1, 0, 6), 9);
    ctx.mb = st.air ? 2 : 1;
  });

  // launch from the last bounce to the roof
  const ROOF_LAND = V(ROOF_YOU.x, roofSurfaceY(ROOF_YOU.z) + 0.0, ROOF_YOU.z);
  function launchState(t) {
    const k = invLerp(K.b3, K.land, t);
    const start = V(TR.x, matTop, TR.z);
    const p = start.clone().lerp(ROOF_LAND, k);
    p.y += 4 * 4.2 * k * (1 - k);
    return { p, air: k > 0.02 && k < 1, phase: k, spin: easeInOut(k) * 2 };
  }

  // 10a: last bounce — land on the roof
  shot('10a', Wd(94) - 0.03, Wd(101) - 0.03, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 0.05);
    let p;
    if (t < K.land) {
      const st = launchState(t);
      p = st.p;
      place(you, p.x, p.y, p.z, Math.PI * 0.05);
      you.body.position.y = 0.95; you.body.rotation.x = -st.spin * Math.PI * 2;
      you.body.position.y = 0;
      const ph = st.phase;
      pose(you, { hipL: [-1.4 * Math.sin(ph * Math.PI), 0, 0.1], hipR: [-1.4 * Math.sin(ph * Math.PI), 0, -0.1], kneeL: 1.8 * Math.sin(ph * Math.PI), kneeR: 1.8 * Math.sin(ph * Math.PI), shL: [-1.4, 0, 0.6], shR: [-1.4, 0, -0.6], elL: -1.2, elR: -1.2 });
      you.setFace({ eyes: 'wide', mouth: 'o', open: 0.8, t });
    } else {
      p = ROOF_LAND;
      sitOnRoof(you, ROOF_YOU, 0.0, t);
      const k = t - K.land;
      you.squash(1 - 0.22 * Math.exp(-k * 7) * Math.cos(k * 16), you.hipY);
      you.setFace({ eyes: k < 0.5 ? 'wide' : 'open', mouth: 'o', open: 0.4 + 0.3 * voice(t), t });
    }
    // dad already sits there (hidden by framing until 10b)
    sitOnRoof(dad, ROOF_DAD, 0, t);
    dadPlate(0);
    dad.setFace({ eyes: 'open', mouth: 'flat', t });
    const k = smoother(invLerp(s.t0, K.land + 0.1, t));
    const camPos = V(-5.2, 2.6, 11.5).lerp(V(-3.0, 6.5, 3.6), k);
    const look = p.clone().add(V(0, 0.6, 0)).lerp(V(-0.1, 5.9, 0.3), k * 0.85);
    camera.fov = lerp(52, 42, k); camera.updateProjectionMatrix();
    camera.position.copy(camPos); camera.lookAt(look);
    sunShadow(V(0, 3, 4), 10);
    ctx.mb = t < K.land ? 3 : 1;
  });
  function sitOnRoof(h, P, lean = 0, t = 0) {
    place(h, P.x, roofSurfaceY(P.z) - h.hipY + 0.1, P.z, 0);
    const hip = -Math.PI / 2 + roofAng + 0.08;
    pose(h, { hipL: [hip, 0, 0.08], hipR: [hip, 0, -0.08], kneeL: 0.35, kneeR: 0.45, ankleL: -0.35, ankleR: -0.3, spine: [0.04, 0, 0] });
    h.j.hips.rotation.x = lean;
  }

  // 10b: ...and her dad is already up there
  shot('10b', Wd(101) - 0.03, Wd(108) - 0.03, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 0.12);
    sitOnRoof(you, ROOF_YOU, 0, t);
    sitOnRoof(dad, ROOF_DAD, 0, t);
    dadPlate(0);
    const look2 = smooth(invLerp(Wd(104), Wd(105) + 0.15, t));
    pose(you, { neck: [0, 0.5 * look2, 0], head: [0, 0.45 * look2, 0.05 * look2], shL: [0.2, 0, 0.3], shR: [0.2, 0, -0.3] });
    you.setFace({ eyes: look2 > 0.5 ? 'wide' : 'open', mouth: 'o', open: 0.25 + 0.2 * look2, t, look: [look2, 0] });
    pose(dad, { neck: [0, -0.15, 0], head: [0, -0.1, 0] });
    dad.setFace({ eyes: 'open', mouth: 'flat', t });
    const k = smoother(invLerp(Wd(101), Wd(104) + 0.1, t));
    const camPos = V(1.6, 6.45, 3.1).lerp(V(2.6, 6.5, 3.4), k);
    const yH = headPos(you), dH = headPos(dad);
    const tgt = yH.clone().lerp(yH.clone().lerp(dH, 0.5), k);
    frame(camPos, tgt, lerp(32, 38, k), 0.32);
    sunShadow(V(0, 5, 1), 4);
  });

  // 11a: he hands you a pancake
  shot('11a', Wd(108) - 0.03, Wd(113) - 0.03, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 0.45);
    sitOnRoof(you, ROOF_YOU, 0, t);
    sitOnRoof(dad, ROOF_DAD, 0, t);
    dadPlate(0);
    const reach = smooth(invLerp(K.hand0, K.hand0 + 0.45, t)) * (1 - smooth(invLerp(K.hand1 + 0.1, K.hand1 + 0.5, t)));
    pose(dad, { shR: [-1.1 * reach - 0.1, -0.5 * reach, -0.2 - 0.5 * reach], elR: [-0.5 - 0.4 * (1 - reach), 0, 0], neck: [0, -0.3, 0], head: [0, -0.25, 0] });
    const take = smooth(invLerp(K.hand1 - 0.3, K.hand1, t));
    pose(you, { shL: [-1.0 * take, 0.35 * take, 0.25 + 0.45 * take], elL: [-0.9 * take, 0, 0], neck: [0, 0.35, 0], head: [0, 0.25, 0] });
    you.setFace({ eyes: 'open', mouth: take > 0.5 ? 'smile' : 'o', open: 0.3, t });
    dad.setFace({ eyes: 'open', mouth: 'smile', open: 0.2, t });
    // the pancake travels from the plate to your hand
    dad.root.updateMatrixWorld(true); you.root.updateMatrixWorld(true);
    handPancake.visible = t > K.hand0 + 0.1;
    dad.plate.pancakes[3].visible = !handPancake.visible;
    const from = dad.palmR.getWorldPosition(new THREE.Vector3()).add(V(0, 0.02, 0));
    const to = you.palmL.getWorldPosition(new THREE.Vector3()).add(V(0, 0.03, 0));
    const pp = t < K.hand1 ? from : to;
    setWorld(handPancake, pp, yawQ(t));
    const camPos = V(2.3, 6.45, 3.3);
    frame(camPos, V(0.05, 5.98, 0.3), 36, 0.34);
    sunShadow(V(0, 5, 1), 4);
    ctx.warmth = 0.2;
  });

  // 11b: the itch is gone — eyes closed, tiny happy moan
  shot('11b', Wd(113) - 0.03, Wd(117) - 0.03, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 0.7);
    sitOnRoof(you, ROOF_YOU, 0, t);
    sitOnRoof(dad, ROOF_DAD, 0, t);
    dadPlate(0);
    dad.plate.pancakes[3].visible = false;
    pose(you, { shL: [-1.0, 0.35, 0.6], elL: [-1.0, 0, 0], spine: [-0.06, 0, 0], head: [-0.12, 0, 0.06 * Math.sin(t * 2)] });
    you.root.updateMatrixWorld(true);
    handPancake.visible = true;
    setWorld(handPancake, you.palmL.getWorldPosition(new THREE.Vector3()).add(V(0, 0.03, 0)), yawQ(0.4));
    const m = moanAmt(t);
    you.setFace({ eyes: 'happy', mouth: m > 0.2 ? 'o' : 'grin', open: Math.max(0.4, m), t });
    you.squash(1 + 0.03 * Math.sin(t * 3));
    const hp = headPos(you);
    sparkle(hp.clone().add(V(0, 0.25, 0.05)), 0.28, 10, t, s.t0 + 0.4, s.t1 + 0.2, 51, 0.07);
    const k = easeInOut(clamp(lt / (s.t1 - s.t0)));
    const camPos = hp.clone().add(V(0.6, 0.06, lerp(2.15, 1.85, k)));
    frame(camPos, hp, 30, 0.33);
    ctx.dof = { focus: camPos.distanceTo(hp), aperture: 0.004 };
    sunShadow(V(0, 5, 1), 4);
    ctx.warmth = 0.3;
  });

  // 11c: final — both sitting on the roof at sunset. Ding.
  shot('11c', Wd(117) - 0.03, duration + 0.5, 'yard', (lt, t, ctx, s) => {
    yardDefaults(t, 1.0);
    sitOnRoof(you, ROOF_YOU, 0, t);
    sitOnRoof(dad, ROOF_DAD, 0, t);
    dadPlate(0);
    dad.plate.pancakes[3].visible = false;
    const bite = smooth(invLerp(Wd(120) - 0.1, Wd(120) + 0.2, t));
    pose(you, { shL: [-0.7 - 0.25 * bite, -0.6, -0.1], elL: [-1.5 - 0.3 * bite, 0, 0], neck: [0, 0.2 * bite, 0] });
    const shrug = wobble(t - Wd(120), 2, 3);
    pose(dad, { neck: [0, -0.35 * bite, 0], shR: [0, 0, -0.12 - 0.25 * Math.max(0, shrug)] });
    dad.j.chest.position.y = 0.22 + 0.03 * Math.max(0, shrug);
    you.root.updateMatrixWorld(true);
    handPancake.visible = true;
    setWorld(handPancake, you.palmL.getWorldPosition(new THREE.Vector3()).add(V(0, 0.03, 0)), yawQ(0.4));
    you.setFace({ eyes: t > K.voiceEnd ? 'happy' : 'open', mouth: 'grin', open: 0.4, t });
    dad.setFace({ eyes: 'open', mouth: bite > 0.5 ? 'flat' : 'smile', t });
    const k = easeInOut(clamp(lt / (s.t1 - s.t0 - 0.5)));
    const camPos = V(lerp(2.4, 3.6, k), lerp(6.25, 6.45, k), lerp(3.6, 5.4, k));
    frame(camPos, V(-0.05, 5.95, 0.3), lerp(36, 40, k), 0.56);
    sunShadow(V(0, 5, 1), 5);
    ctx.warmth = 0.35; ctx.bloom = 0.5; ctx.exposure = 1.05;
    if (t > K.ding - 0.05) {
      const a = t - K.ding;
      const hp = headPos(you);
      ctx.sparkles2d.push({ pos: hp.clone().add(V(0.12, 0.28, 0)), dx: 0, dy: 0, size: 70 * easeOutBack(clamp(a / 0.25)) * (1 - smooth(invLerp(0.7, 1.1, a))), alpha: 1 });
    }
  });

  // ---------------- apply(t) ----------------
  function apply(t) {
    const s = shots.find((x) => t >= x.t0 && t < x.t1) || shots[shots.length - 1];
    const lt = t - s.t0;
    const ctx = { world: s.world, shot: s.id, mb: 1, dof: null, speedLines: 0, hearts: [], sparkles2d: [], flash: 0, bloom: 0.32, exposure: 1.0, warmth: 0.08 };
    const scene = s.world === 'yard' ? yard.scene : room.scene;
    hideExceptPlate(dad, false);
    for (const h of cast) { h.reset(); scene.add(h.root); h.root.visible = true; }
    hangPivot.rotation.set(0, 0, 0);
    if (dad.lensMat) dad.lensMat.opacity = 0.16;
    dad.j.chest.position.y = 0.22;
    setSweater(t >= K.sweaterOn);
    if (s.world === 'room') roomDefaults(t); else { yardDefaults(t); handPancake.visible = false; }
    s.fn(lt, t, ctx, s);
    camera.updateMatrixWorld();
    shake(t);
    updateParticles(t, s.world, scene);
    flushSparks();
    scene.add(sparks, dust);
    return ctx;
  }

  return { apply, shots, pops, events, duration, K };
}
