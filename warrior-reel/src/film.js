// The film: world + characters + performance + cameras, all driven by timeline/timeline.json.
// One continuous world timeline; cameras cut between shots. Everything is a pure function of t.
import * as THREE from 'three';
import { buildWorld } from './world/environment.js';
import * as K from './characters/knight.js';
import * as J from './characters/jesus.js';
import { Humanoid, BONE_NAMES, quatFromBasis } from './core/rig.js';
import { DEG, clamp, lerp, smoothstep, easeInOut, sampleTrack, noise1, fbm1 } from './core/util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------------------------
// Staging constants (world space, see docs/DESIGN.md)
// ---------------------------------------------------------------------------------------------
const KNIGHT_SEAT_ROOT = V3(-0.55, 0, 0.06);
const KNIGHT_SEAT_YAW = 14;
const JESUS_SEAT_ROOT = V3(0.80, 0, 0.12);
const JESUS_SEAT_YAW = -38;
const JESUS_STAND_SPOT = V3(1.05, 0, 0.62);   // where he stops before sitting
const KNIGHT_END_ROOT = V3(-0.42, 0, 0.62);
const KNIGHT_END_YAW = 6;
const JESUS_END_ROOT = V3(0.36, 0, 0.66);
const JESUS_END_YAW = -14;

// Orientation with local +Y along `dir` and local +Z (flat of the blade) toward `face`.
function quatDirFace(dir, face) {
  const y = dir.clone().normalize();
  const z = face.clone().addScaledVector(y, -face.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return quatFromBasis(x, y, z);
}

// Partial pose blend: blend only `bones` of `over` onto `base` with weight w (compiled poses).
function blendBones(base, over, w, bones) {
  if (w <= 0) return base;
  const out = { ...base };
  for (const n of bones) out[n] = base[n].clone().slerp(over[n], clamp(w, 0, 1));
  return out;
}
const ARM_R = ['shoulderR', 'upperArmR', 'foreArmR', 'handR'];
const ARM_L = ['shoulderL', 'upperArmL', 'foreArmL', 'handL'];
const HEAD = ['neck', 'head'];

// Window helper: 0 before a, ramps to 1 over ra, holds, ramps to 0 over rb ending at b.
const win = (t, a, b, ra = 0.4, rb = 0.4) => Math.min(smoothstep(a, a + ra, t), 1 - smoothstep(b - rb, b, t));

export async function build(stage, params) {
  const tl = await (await fetch('/timeline/timeline.json', { cache: 'no-store' })).json();
  let mouth = null;
  try { const r = await fetch('/out/audio/mouth.json', { cache: 'no-store' }); if (r.ok) mouth = await r.json(); } catch (e) { /* optional */ }
  const B = tl.beats;
  const cue = Object.fromEntries(tl.cues.map((c) => [c.id, c]));
  const FPS = tl.fps;
  const goldenMid = (B.goldenStart + B.goldenEnd) / 2;

  const { scene, camera } = stage;
  const world = buildWorld(stage);

  const knight = K.buildKnight();
  scene.add(knight.root);
  scene.add(knight.sword);
  const jesus = J.buildJesus();
  scene.add(jesus.root);
  const kr = knight.rig, jr = jesus.rig;

  const KP = Object.fromEntries(Object.entries(K.POSES).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, Humanoid.compile(v)]));
  const JP = Object.fromEntries(Object.entries(J.POSES).filter(([, v]) => typeof v === 'object').map(([k, v]) => [k, Humanoid.compile(v)]));
  const SW = K.SWORD;

  // ---------------- voice activity / mouth ----------------
  function speechEnv(speaker, t) {
    const f = Math.round(t * FPS);
    if (mouth && mouth[speaker] && f >= 0 && f < mouth[speaker].length) return mouth[speaker][f];
    // Fallback from word timings.
    for (const c of tl.cues) {
      if (c.speaker !== speaker || t < c.speechStart - 0.05 || t > c.speechEnd + 0.05) continue;
      for (const w of c.words) if (t >= w.s && t <= w.e) return 0.45 + 0.4 * Math.abs(noise1(t * 11 + w.s * 3));
      return 0.05;
    }
    return 0;
  }
  const speakingCue = (speaker, t, pad = 0.15) => tl.cues.find((c) => c.speaker === speaker && t >= c.speechStart - pad && t <= c.speechEnd + pad);

  // ---------------- KNIGHT performance ----------------
  // Sword keyframes in knight-root-local space (seated part of the film).
  const tipDownLocal = V3(-0.16, 0.0, 0.66);
  const downDir = V3(0.05, -1, -0.12).normalize();
  const swordKeys = [
    { t: 0, pos: V3(-0.30, 0.80, 0.42), dir: V3(-0.36, 1, 0.40), face: V3(0.25, 0, 1) },
    { t: cue.L04.speechStart + 1.2, pos: V3(-0.30, 0.82, 0.43), dir: V3(-0.32, 1, 0.38), face: V3(0.25, 0, 1) },
    { t: cue.L05.speechStart + 0.4, pos: V3(-0.22, 0.97, 0.46), dir: V3(-0.10, 1, 0.16), face: V3(0.85, 0, -0.5), ease: 'inout' },
    { t: cue.L05.speechEnd + 0.2, pos: V3(-0.22, 0.97, 0.46), dir: V3(-0.11, 1, 0.17), face: V3(0.85, 0, -0.45) },
    { t: cue.L06.speechStart + 0.6, pos: V3(-0.30, 0.80, 0.42), dir: V3(-0.36, 1, 0.40), face: V3(0.25, 0, 1), ease: 'inout' },
    { t: B.swordLookStart, pos: V3(-0.30, 0.79, 0.43), dir: V3(-0.34, 1, 0.42), face: V3(0.25, 0, 1) },
    { t: B.swordLowerStart, pos: V3(-0.29, 0.78, 0.46), dir: V3(-0.30, 1, 0.48), face: V3(0.2, 0, 1) },
    { t: lerp(B.swordLowerStart, B.swordTipDown, 0.5), pos: V3(-0.27, 0.70, 0.62), dir: V3(-0.25, 0.05, 1), face: V3(0, 1, 0.2), ease: 'inout' },
    { t: B.swordTipDown, pos: tipDownLocal.clone().addScaledVector(downDir, -SW.tipY), dir: downDir.clone(), face: V3(0, 0, 1), ease: 'out' },
  ];
  function swordLocalAt(t) {
    let i = 1;
    while (i < swordKeys.length - 1 && swordKeys[i].t < t) i++;
    const a = swordKeys[i - 1], b = swordKeys[i];
    if (t <= a.t) return { pos: a.pos.clone(), q: quatDirFace(a.dir, a.face) };
    if (t >= b.t && i === swordKeys.length - 1) return { pos: b.pos.clone(), q: quatDirFace(b.dir, b.face) };
    const u0 = clamp((t - a.t) / (b.t - a.t), 0, 1);
    const u = b.ease === 'out' ? 1 - Math.pow(1 - u0, 2.2) : b.ease === 'inout' ? easeInOut(u0) : u0 * u0 * (3 - 2 * u0);
    const qa = quatDirFace(a.dir, a.face), qb = quatDirFace(b.dir, b.face);
    return { pos: a.pos.clone().lerp(b.pos, u), q: qa.slerp(qb, u) };
  }
  // Fist tension (1 = white-knuckle) over the film.
  const gripKeys = [
    { t: 0, v: 1 }, { t: 3.4, v: 0.95 }, { t: B.establishStart + 1, v: 0.75 }, { t: cue.L04.speechStart, v: 0.8 },
    { t: cue.L04.speechStart + 1.5, v: 1 }, { t: cue.L05.speechEnd, v: 0.95 }, { t: cue.L07.speechStart + 2, v: 0.7 },
    { t: B.swordLowerStart, v: 0.55 }, { t: B.swordSettleEnd, v: 0.25 }, { t: goldenMid, v: 0.3 },
  ];
  // Relaxation 0 (tense) -> 1 (at peace).
  const relaxKeys = [{ t: 0, v: 0 }, { t: cue.L07.speechEnd, v: 0.1 }, { t: B.swordTipDown, v: 0.5 }, { t: B.swordSettleEnd + 1.2, v: 0.8, ease: 'inout' },
    { t: cue.L11.speechStart, v: 0.85 }, { t: cue.L11.speechEnd + 0.4, v: 1, ease: 'inout' }];

  function knightLookTarget(t) {
    const jHead = jr.worldPos('head').add(V3(0, 0.12, 0));
    const sword = knight.sword.localToWorld(V3(0, SW.tipY * 0.55, 0));
    const river = V3(-0.2, 0.9, 5);
    const down = kr.pointToWorld(V3(-0.1, 0.4, 0.9));
    // [target, weight] schedule
    const sched = [
      [0, river, 0.55],
      [2.0, river, 0.6],
      [cue.L02.speechStart + 0.8, jHead, 0.25],          // guarded glance as the stranger speaks
      [cue.L02.speechEnd, down, 0.35],
      [cue.L03.speechStart + 0.6, jHead, 0.45],
      [cue.L04.speechStart + 0.3, river, 0.55],          // looks away while telling it
      [cue.L05.speechStart + 0.2, sword, 0.85],          // stares at the blade
      [cue.L06.speechStart + 0.4, jHead, 0.4],
      [cue.L07.speechStart + 1.5, jHead, 0.7],
      [B.swordLookStart, sword, 0.95],
      [B.swordTipDown + 0.2, down, 0.6],
      [cue.L08.speechStart - 0.2, jHead, 0.75],
      [cue.L10.speechEnd - 0.5, down, 0.45],
      [cue.L11.speechStart + 0.9, jHead, 0.6],
      [goldenMid, river, 0.5],
      [cue.L12.speechStart + 1.6, jHead, 0.7],
    ];
    let i = 0;
    while (i < sched.length - 1 && sched[i + 1][0] <= t) i++;
    const cur = sched[i], prev = sched[Math.max(0, i - 1)];
    const u = smoothstep(cur[0], cur[0] + 0.7, t);
    return { target: prev[1].clone().lerp(cur[1], u), w: lerp(prev[2], cur[2], u) };
  }

  function updateKnight(t) {
    const seated = t < goldenMid;
    const relax = sampleTrack(relaxKeys, t);
    const grip = sampleTrack(gripKeys, t);
    const kEnv = speechEnv('KNIGHT', t);
    if (seated) {
      kr.root.position.copy(KNIGHT_SEAT_ROOT);
      kr.root.rotation.set(0, KNIGHT_SEAT_YAW * DEG, 0);
      let pose = Humanoid.blend([[KP.seated, 1 - relax], [KP.seatedRelaxed || KP.seated, relax]]);
      kr.applyPose(pose);
      // breathing: tense = quicker, shallower; relaxed = slow deep
      const br = Math.sin(t * Math.PI * 2 * lerp(0.32, 0.22, relax));
      kr.addRot('chest', -br * lerp(0.6, 1.2, relax), 0, 0);
      kr.addRot('shoulderL', 0, 0, br * 0.6); kr.addRot('shoulderR', 0, 0, -br * 0.6);
      // the exhale on L11: a visible sigh — chest/shoulders drop
      const sigh = win(t, cue.L11.fileStart, cue.L11.speechStart + 0.6, 0.3, 0.8);
      kr.addRot('chest', 3 * sigh, 0, 0); kr.addRot('neck', 4 * sigh, 0, 0);
      // speaking: small head emphasis
      kr.addRot('head', -2.2 * kEnv, 1.2 * noise1(t * 3.1), 0);
      kr.update();
      const feet = K.legTargetsSeated(knight);
      kr.legIK('L', feet.L); kr.legIK('R', feet.R);
      // sword
      const s = swordLocalAt(t);
      const trem = grip * (1 - relax) * 0.9;
      s.q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(fbm1(t * 6, 1) * trem * DEG, 0, fbm1(t * 5.3, 2) * trem * DEG)));
      kr.root.updateMatrixWorld(true);
      const pos = s.pos.applyMatrix4(kr.root.matrixWorld);
      const q = kr.root.quaternion.clone().multiply(s.q);
      const leftToPommel = smoothstep(B.swordTipDown - 0.7, B.swordTipDown + 0.35, t);
      if (leftToPommel > 0.98) K.solveSwordHands(knight, pos, q, { left: 'pommel' });
      else {
        K.solveSwordHands(knight, pos, q, { left: 'knee' });
        if (leftToPommel > 0) {
          // move the left hand from the knee to the pommel along an arc
          kr.update();
          const kneeHand = kr.worldPos('handL');
          K.solveSwordHands(knight, pos, q, { left: 'pommel' });
          const pomHand = kr.worldPos('handL');
          const qPom = kr.b.handL.getWorldQuaternion(new THREE.Quaternion());
          const mid = kneeHand.clone().lerp(pomHand, easeInOut(leftToPommel)).add(V3(0, 0.08 * Math.sin(Math.PI * leftToPommel), 0));
          K.solveSwordHands(knight, pos, q, { left: 'free' });
          kr.armIK('L', mid);
          const qCur = kr.b.handL.getWorldQuaternion(new THREE.Quaternion());
          kr.setWorldQuat(kr.b.handL, qCur.slerp(qPom, easeInOut(leftToPommel)));
        }
      }
    } else {
      kr.root.position.copy(KNIGHT_END_ROOT);
      kr.root.rotation.set(0, KNIGHT_END_YAW * DEG, 0);
      kr.applyPose(KP.stand);
      const br = Math.sin(t * Math.PI * 2 * 0.22);
      kr.addRot('chest', -br * 1.1, 0, 0);
      kr.addRot('head', -2 * kEnv, 0, 0);
      // a slow turn of the shoulders toward Jesus when touched
      const turn = smoothstep(B.shoulderTouch + 0.3, B.shoulderTouch + 1.6, t);
      kr.addRot('chest', 0, 6 * turn, 0);
      kr.update();
      // sword point-down at his right side, tip resting on the grass slightly forward
      const tip = kr.pointToWorld(V3(-0.36, 0.0, 0.34));
      const dir = kr.dirToWorld(V3(-0.06, -1, -0.16)).normalize();
      const pos = tip.clone().addScaledVector(dir, -SW.tipY);
      const q = quatDirFace(dir, kr.dirToWorld(V3(0, 0, 1)));
      K.solveSwordHands(knight, pos, q, { left: 'free' });
    }
    const look = knightLookTarget(t);
    kr.lookAt(look.target, look.w);
    knight.update(t, { grip, seated, relax });
  }

  // ---------------- JESUS performance ----------------
  const walkStartT = 2.4, walkStartX = 4.6;
  const arriveT = B.jesusArrive;
  const walkSpeed = (walkStartX - JESUS_STAND_SPOT.x) / (arriveT - walkStartT);
  const STRIDE = 0.62; // metres per step
  function jesusLookTarget(t) {
    const kHead = kr.worldPos('head').add(V3(0, 0.1, 0.05));
    const sword = knight.sword.localToWorld(V3(0, SW.tipY * 0.5, 0));
    const ahead = V3(-3, 1.4, 0.6);
    const sched = [
      [0, ahead, 0.3],
      [cue.L02.speechStart - 0.4, kHead, 0.8],
      [cue.L06.speechStart + 1.0, sword, 0.55],
      [cue.L06.speechEnd, kHead, 0.85],
      [B.swordLowerStart + 0.3, sword, 0.65],
      [B.swordSettleEnd, kHead, 0.85],
      [goldenMid, V3(-2, 1.2, 8), 0.5],
      [B.shoulderTouch + 0.2, kHead, 0.8],
    ];
    let i = 0;
    while (i < sched.length - 1 && sched[i + 1][0] <= t) i++;
    const cur = sched[i], prev = sched[Math.max(0, i - 1)];
    const u = smoothstep(cur[0], cur[0] + 0.8, t);
    return { target: prev[1].clone().lerp(cur[1], u), w: lerp(prev[2], cur[2], u) };
  }

  function updateJesus(t) {
    const jEnv = speechEnv('JESUS', t);
    let seated = false, walkPhase = 0;
    if (t < goldenMid) {
      if (t < arriveT + 0.5) {
        // walking along the bank toward the knight, then settling to a stop
        const tt = Math.min(t, arriveT);
        const x = Math.max(JESUS_STAND_SPOT.x, walkStartX - walkSpeed * Math.max(0, tt - walkStartT));
        const travelled = walkStartX - x;
        walkPhase = (travelled / (2 * STRIDE)) % 1;
        const z = lerp(0.75, JESUS_STAND_SPOT.z, smoothstep(walkStartX, JESUS_STAND_SPOT.x, x));
        jr.root.position.set(x, 0, z);
        const stopW = smoothstep(arriveT - 0.35, arriveT + 0.5, t);
        const yaw = lerp(-90, -55, stopW);
        jr.root.rotation.set(0, yaw * DEG, 0);
        const walk = Humanoid.compile(J.walkPose(walkPhase));
        jr.applyPose(Humanoid.blend([[walk, 1 - stopW], [JP.stand, stopW]]));
        jr.root.position.y = 0.012 * Math.abs(Math.sin(walkPhase * Math.PI * 2)) * (1 - stopW);
      } else if (t < B.jesusSitStart) {
        jr.root.position.copy(JESUS_STAND_SPOT);
        jr.root.rotation.set(0, lerp(-55, -40, smoothstep(arriveT + 0.5, B.jesusSitStart, t)) * DEG, 0);
        jr.applyPose(JP.stand);
      } else {
        // sit down: blend root from the standing spot to the seat, pose stand -> sit
        const u = easeInOut(clamp((t - B.jesusSitStart) / (B.jesusSitEnd - B.jesusSitStart), 0, 1));
        seated = u > 0.5;
        jr.root.position.copy(JESUS_STAND_SPOT).lerp(JESUS_SEAT_ROOT, u);
        jr.root.rotation.set(0, lerp(-40, JESUS_SEAT_YAW, u) * DEG, 0);
        let pose = Humanoid.blend([[JP.stand, 1 - u], [JP.sit, u]]);
        // gestures while seated
        if (u >= 1) {
          const g1 = win(t, cue.L03.speechStart - 0.1, cue.L03.speechEnd + 0.3, 0.6, 0.7) * 0.55; // gentle open palm
          const g2 = win(t, cue.L07.speechStart + 0.2, cue.L07.speechEnd + 0.4, 0.7, 0.9);         // teaching gesture
          const g3 = win(t, cue.L10.speechStart, cue.L10.speechEnd + 0.4, 0.6, 0.8) * 0.8;
          const g4 = win(t, cue.L09.speechStart + 1.0, cue.L09.speechEnd + 0.2, 0.6, 0.6) * 0.6;   // hand to heart
          if (JP.openPalm) pose = blendBones(pose, JP.openPalm, Math.max(g1, g2, g3), ARM_R);
          if (JP.handOnHeart) pose = blendBones(pose, JP.handOnHeart, g4, ARM_R);
        }
        jr.applyPose(pose);
        if (u < 1) jr.addRot('spine', 10 * Math.sin(Math.PI * u), 0, 0); // lean forward while lowering
      }
    } else {
      seated = false;
      jr.root.position.copy(JESUS_END_ROOT);
      jr.root.rotation.set(0, JESUS_END_YAW * DEG, 0);
      jr.applyPose(JP.stand);
    }
    // breathing + speaking life
    const br = Math.sin(t * Math.PI * 2 * 0.2 + 1);
    jr.addRot('chest', -br * 0.8, 0, 0);
    jr.addRot('head', -1.8 * jEnv + 0.8 * noise1(t * 0.7 + 4), 1.0 * noise1(t * 0.5 + 9), 0.8 * noise1(t * 0.43 + 2));
    if (speakingCue('JESUS', t)) jr.addRot('head', 0, 0, 2.2 * Math.sin(t * 1.3)); // gentle tilt while speaking
    // "No." — a soft, slow head shake
    const shake = win(t, cue.L09.speechStart - 0.1, cue.L09.speechStart + 0.9, 0.2, 0.3);
    jr.addRot('neck', 0, 7 * shake * Math.sin((t - cue.L09.speechStart) * 9), 0);
    jr.update();
    // feet
    if (t >= B.jesusSitStart && t < goldenMid) {
      const u = easeInOut(clamp((t - B.jesusSitStart) / (B.jesusSitEnd - B.jesusSitStart), 0, 1));
      const seatFeet = J.legTargetsSeated(jesus);
      if (u >= 1) { jr.legIK('L', seatFeet.L); jr.legIK('R', seatFeet.R); }
    }
    // ending: right hand on the knight's left shoulder
    if (t >= goldenMid) {
      const reach = smoothstep(B.shoulderTouch, B.shoulderTouch + 1.1, t);
      if (reach > 0) {
        kr.update();
        const pauldron = kr.worldPos('shoulderL').add(kr.dirToWorld(V3(0.06, 0.1, 0.02)));
        const rest = jr.worldPos('handR');
        jr.armIK('R', rest.clone().lerp(pauldron, easeInOut(reach)), [-0.6, -0.4, -0.6]);
        const palmDown = quatDirFace(V3(0, -1, 0).applyQuaternion(kr.root.quaternion), kr.dirToWorld(V3(-1, 0, 0)));
        const cur = jr.b.handR.getWorldQuaternion(new THREE.Quaternion());
        jr.setWorldQuat(jr.b.handR, cur.slerp(palmDown, reach * 0.6));
      }
    }
    const look = jesusLookTarget(t);
    jr.lookAt(look.target, look.w);
    // face
    if (jesus.setMouth) jesus.setMouth(clamp(jEnv * 1.05, 0, 1));
    if (jesus.setBlink) {
      const period = 3.7, ph = (t + 1.3) % period;
      const extra = (t + 0.4) % 11.3 < 0.16 ? 1 : 0;
      jesus.setBlink(ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : extra);
    }
    jesus.update(t, { seated: t >= B.jesusSitStart + 0.5 && t < goldenMid, walkPhase, walking: t < arriveT });
  }

  // ---------------- CAMERA: shot list ----------------
  // Each shot: [start, from {p, l, fov}, to {p, l, fov}, ease, shake]
  const S = (p, l, fov) => ({ p: V3(...p), l: V3(...l), fov });
  const shots = [
    // 1 HOOK: across the river, low; the knight on his rock gripping the raised sword; slow push-in to the helmet.
    { t: 0, a: S([0.85, 0.42, 5.0], [-0.48, 0.92, 0.05], 34), b: S([0.35, 0.95, 3.0], [-0.52, 1.18, 0.05], 26), shake: 0.6, focus: [V3(-0.3, 0.5, 0.3), 3] },
    // 2 ESTABLISHING: high, wide crane over the river; Jesus walking in along the bank (title card).
    { t: B.establishStart, a: S([5.2, 3.2, 12.5], [0.9, 0.5, 0.2], 40), b: S([3.6, 2.4, 10.2], [0.7, 0.6, 0.3], 40), shake: 0.2, focus: [V3(1.4, 0.5, 0.4), 6] },
    // 3 MEDIUM TWO-SHOT: Jesus arrives beside the knight and speaks.
    { t: cue.L02.speechStart - 0.25, a: S([1.85, 1.15, 4.1], [0.45, 1.0, 0.25], 36), b: S([1.55, 1.12, 3.7], [0.3, 1.0, 0.2], 36), shake: 0.4, focus: [V3(0.3, 0.6, 0.3), 3] },
    // 4 Jesus sits; frontal two-shot, gentle push.
    { t: B.jesusSitStart - 0.05, a: S([0.25, 1.0, 3.1], [0.12, 0.88, 0.05], 36), b: S([0.2, 1.02, 2.75], [0.12, 0.92, 0.05], 36), shake: 0.35, focus: [V3(0.1, 0.6, 0.1), 2.5] },
    // 5 KNIGHT close-up, low angle, slow push (betrayal).
    { t: cue.L04.speechStart - 0.3, a: S([-0.02, 0.95, 1.75], [-0.56, 1.22, 0.02], 32), b: S([-0.12, 0.98, 1.45], [-0.56, 1.25, 0.02], 30), shake: 0.35, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 6 OVER JESUS'S SHOULDER onto the knight inspecting his blade.
    { t: cue.L05.speechStart - 0.35, a: S([1.42, 1.38, -0.38], [-0.62, 1.12, 0.38], 34), b: S([1.36, 1.36, -0.28], [-0.62, 1.1, 0.38], 32), shake: 0.4, focus: [V3(0.1, 0.8, 0.1), 2.5] },
    // 7 JESUS close-up, 3/4 front, slow push-in through "true strength".
    { t: cue.L06.speechStart - 0.3, a: S([0.08, 1.30, 1.55], [0.80, 1.30, 0.08], 32), b: S([0.25, 1.31, 1.12], [0.80, 1.32, 0.08], 28), shake: 0.3, focus: [V3(0.7, 0.8, 0.1), 2] },
    // 8 KNIGHT reaction: helmet turns toward Jesus, then down to his sword.
    { t: cue.L07.speechStart + 2.45, a: S([-0.95, 1.18, 1.35], [-0.5, 1.28, 0.1], 31), b: S([-0.9, 1.15, 1.28], [-0.5, 1.22, 0.12], 31), shake: 0.3, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 9 THE SWORD: low, close; the blade descends and its point meets the grass.
    { t: B.swordLowerStart - 0.1, a: S([0.05, 0.32, 2.05], [-0.62, 0.52, 0.42], 40), b: S([-0.05, 0.28, 1.85], [-0.64, 0.46, 0.50], 38), shake: 0.25, focus: [V3(-0.5, 0.4, 0.5), 2] },
    // 10 KNIGHT medium, hands resting on the hilt, posture softened.
    { t: cue.L08.speechStart - 0.35, a: S([-1.45, 1.05, 2.15], [-0.52, 0.95, 0.12], 34), b: S([-1.35, 1.06, 1.98], [-0.5, 0.98, 0.12], 34), shake: 0.3, focus: [V3(-0.5, 0.6, 0.3), 2.5] },
    // 11 OVER THE KNIGHT'S SHOULDER onto Jesus ("No...").
    { t: cue.L09.speechStart - 0.3, a: S([-1.02, 1.42, -0.32], [0.78, 1.24, 0.15], 33), b: S([-0.96, 1.4, -0.24], [0.78, 1.25, 0.15], 32), shake: 0.35, focus: [V3(0.1, 0.8, 0.1), 2.5] },
    // 12 JESUS close-up, frontal-left, warm push.
    { t: cue.L10.speechStart - 0.2, a: S([0.3, 1.28, 1.45], [0.82, 1.31, 0.1], 30), b: S([0.42, 1.30, 1.18], [0.82, 1.33, 0.1], 27), shake: 0.3, focus: [V3(0.7, 0.8, 0.1), 2] },
    // 13 KNIGHT close-up: the exhale; light begins to warm.
    { t: cue.L11.fileStart - 0.15, a: S([-0.2, 1.05, 1.55], [-0.56, 1.28, 0.05], 30), b: S([-0.25, 1.12, 1.32], [-0.56, 1.32, 0.05], 28), shake: 0.3, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 14 GOLDEN: standing together on the bank, low 3/4 front, slow arc.
    { t: goldenMid, a: S([1.75, 0.95, 4.0], [-0.08, 1.12, 0.6], 36), b: S([1.25, 1.0, 3.55], [-0.06, 1.18, 0.62], 34), shake: 0.3, focus: [V3(0, 0.8, 0.6), 2.5] },
    // 15 FINAL: behind them, looking across the river toward the sunlit castle; rising crane (end card).
    { t: B.endCardStart - 0.25, a: S([0.55, 1.55, -2.1], [-0.2, 1.25, 10], 42), b: S([0.45, 2.15, -2.9], [-0.2, 1.4, 12], 42), shake: 0.2, focus: [V3(0, 0.8, 0.8), 3] },
  ];
  for (let i = 0; i < shots.length; i++) shots[i].end = i + 1 < shots.length ? shots[i + 1].t : tl.duration;

  let lastShot = -1;
  function updateCamera(t) {
    let i = 0;
    while (i < shots.length - 1 && shots[i + 1].t <= t) i++;
    const s = shots[i];
    const u = easeInOut(clamp((t - s.t) / (s.end - s.t), 0, 1)) * 0.85 + clamp((t - s.t) / (s.end - s.t), 0, 1) * 0.15;
    const p = s.a.p.clone().lerp(s.b.p, u), l = s.a.l.clone().lerp(s.b.l, u);
    // subtle handheld float (deterministic)
    const amp = (s.shake || 0) * 0.006;
    p.x += fbm1(t * 0.55, 11) * amp; p.y += fbm1(t * 0.5, 12) * amp; p.z += fbm1(t * 0.45, 13) * amp * 0.5;
    l.x += fbm1(t * 0.4, 14) * amp * 0.6; l.y += fbm1(t * 0.42, 15) * amp * 0.6;
    camera.position.copy(p);
    camera.fov = lerp(s.a.fov, s.b.fov, u);
    camera.lookAt(l);
    camera.updateProjectionMatrix();
    if (i !== lastShot) { if (world.focusShadow && s.focus) world.focusShadow(s.focus[0], s.focus[1]); lastShot = i; }
    return i;
  }

  // ---------------- mood / grade / transitions ----------------
  const moodKeys = [{ t: 0, v: 0 }, { t: B.swordTipDown, v: 0.04 }, { t: cue.L09.speechStart, v: 0.14, ease: 'inout' },
    { t: cue.L11.speechEnd, v: 0.32, ease: 'inout' }, { t: B.goldenStart, v: 0.36 }, { t: goldenMid, v: 1, ease: 'hold' }];
  function updateGrade(t) {
    const g = stage.grade.uniforms;
    const mood = t >= goldenMid ? 1 : sampleTrack(moodKeys, t);
    g.uWarm.value = lerp(-0.05, 0.75, mood);
    g.uSat.value = lerp(1.06, 1.12, mood);
    g.uVignette.value = lerp(0.26, 0.34, mood);
    // dip through warm light between the seated scene and the golden ending
    const dipIn = smoothstep(B.goldenStart, goldenMid, t), dipOut = 1 - smoothstep(goldenMid, B.goldenEnd, t);
    let fade = Math.min(dipIn, dipOut) * 0.92;
    let fadeCol = new THREE.Color(1.0, 0.86, 0.62);
    // end card: dim the picture for legibility, then fade to black at the very end
    if (t >= B.endCardStart) {
      const dim = smoothstep(B.endCardStart, B.endCardStart + 1.0, t) * 0.42;
      const out = smoothstep(tl.duration - 0.9, tl.duration - 0.05, t);
      fade = Math.max(dim, out);
      fadeCol = new THREE.Color(0.02, 0.015, 0.01);
    }
    // fade in from black at the very start (3 frames) so the first frame is not a hard pop
    fade = Math.max(fade, 1 - smoothstep(0, 0.1, t));
    if (t < 0.12) fadeCol = new THREE.Color(0, 0, 0);
    g.uFade.value = fade;
    g.uFadeColor.value.copy(fadeCol);
    return mood;
  }

  return {
    duration: tl.duration,
    fps: FPS,
    timeline: tl,
    shots,
    update(t, frame) {
      const mood = updateGrade(t);
      world.update(t, { mood, wind: 0.5 });
      updateJesus(t);      // Jesus first: knight looks at Jesus's head
      updateKnight(t);
      // Jesus's ending hand needs the knight's final shoulder; re-run his arm after the knight is posed.
      if (t >= goldenMid) updateJesus(t);
      updateCamera(t);
    },
  };
}
