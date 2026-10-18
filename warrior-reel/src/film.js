// The film: world + characters + performance + cameras, all driven by timeline/timeline.json.
// One continuous world timeline; cameras cut between shots. Everything is a pure function of t.
import * as THREE from 'three';
import { buildWorld } from './world/environment.js';
import * as K from './characters/knight.js';
import * as J from './characters/jesus.js';
import { Humanoid, quatFromBasis } from './core/rig.js';
import { DEG, clamp, lerp, smoothstep, easeInOut, sampleTrack, noise1, fbm1 } from './core/util.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// Orientation with local +Y along `dir` and local +Z toward `face`.
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

// Window helper: 0 before a, ramps to 1 over ra, holds, ramps to 0 over rb ending at b.
const win = (t, a, b, ra = 0.4, rb = 0.4) => Math.min(smoothstep(a, a + ra, t), 1 - smoothstep(b - rb, b, t));

// Piecewise-smooth schedule of [time, target, weight] look targets.
function schedule(sched, t, blend = 0.7) {
  let i = 0;
  while (i < sched.length - 1 && sched[i + 1][0] <= t) i++;
  const cur = sched[i], prev = sched[Math.max(0, i - 1)];
  const u = smoothstep(cur[0], cur[0] + blend, t);
  return { target: prev[1].clone().lerp(cur[1], u), w: lerp(prev[2], cur[2], u) };
}

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

  const KP = Object.fromEntries(Object.entries(K.POSES).map(([k, v]) => [k, Humanoid.compile(v)]));
  const JP = Object.fromEntries(Object.entries(J.POSES).map(([k, v]) => [k, Humanoid.compile(v)]));

  // ---------------- staging (world space; see docs/DESIGN.md) ----------------
  const kSeat = world.seats.knight, jSeat = world.seats.jesus;
  const KNIGHT_SEAT_ROOT = V3(kSeat.x, 0, kSeat.z);
  const KNIGHT_SEAT_YAW = 14;
  const JESUS_SEAT_YAW = -38;
  const jFwd = V3(Math.sin(JESUS_SEAT_YAW * DEG), 0, Math.cos(JESUS_SEAT_YAW * DEG));
  const JESUS_SEAT_ROOT = V3(jSeat.x, 0, jSeat.z).addScaledVector(jFwd, 0.07);   // root ~7 cm in front of the rock centre
  const JESUS_STAND_SPOT = JESUS_SEAT_ROOT.clone().addScaledVector(jFwd, 0.30);   // he stops right in front of his seat
  const KNIGHT_END_ROOT = V3(-0.42, 0, 0.62), KNIGHT_END_YAW = 6;
  const JESUS_END_ROOT = V3(0.22, 0, 0.5), JESUS_END_YAW = -20;

  // ---------------- voice activity / mouth ----------------
  function speechEnv(speaker, t) {
    const f = Math.round(t * FPS);
    if (mouth && mouth[speaker] && f >= 0 && f < mouth[speaker].length) return mouth[speaker][f];
    for (const c of tl.cues) {
      if (c.speaker !== speaker || t < c.speechStart - 0.05 || t > c.speechEnd + 0.05) continue;
      for (const w of c.words) if (t >= w.s && t <= w.e) return 0.45 + 0.4 * Math.abs(noise1(t * 11 + w.s * 3));
      return 0.05;
    }
    return 0;
  }
  const speakingCue = (speaker, t, pad = 0.15) => tl.cues.find((c) => c.speaker === speaker && t >= c.speechStart - pad && t <= c.speechEnd + pad);

  // =====================================================================================
  // KNIGHT
  // =====================================================================================
  // Blade inspection while he says "...I've sharpened this blade for him": raised closer to the visor,
  // turned so he looks along the flat.
  const SIT_INSPECT = { grip: 'forward', left: 'knee', P: [-0.17, 0.86, 0.46], A: [-0.30, 1, 0.08], F: [-0.62, -0.5, -0.45] };
  const blendSword = (a, b, k) => ({ position: a.position.clone().lerp(b.position, k), quaternion: a.quaternion.clone().slerp(b.quaternion, k) });
  // Lowering beat: u 0 -> 0.45 lands the point on the grass exactly at beats.swordTipDown (music + foley),
  // u 0.45 -> 1 pivots the blade upright on its point, regrips, left hand to the pommel.
  const lowerEnd = B.swordSettleEnd + 0.9;
  const lowerU = (t) => (t < B.swordTipDown
    ? 0.45 * clamp((t - B.swordLowerStart) / (B.swordTipDown - B.swordLowerStart), 0, 1)
    : 0.45 + 0.55 * clamp((t - B.swordTipDown) / (lowerEnd - B.swordTipDown), 0, 1));

  const gripKeys = [
    { t: 0, v: 1 }, { t: 3.4, v: 0.95 }, { t: B.establishStart + 1, v: 0.75 }, { t: cue.L04.speechStart, v: 0.8 },
    { t: cue.L04.speechStart + 1.5, v: 1 }, { t: cue.L05.speechEnd, v: 0.95 }, { t: cue.L07.speechStart + 2, v: 0.7 },
    { t: B.swordLowerStart, v: 0.55 }, { t: B.swordSettleEnd, v: 0.25 }, { t: goldenMid, v: 0.3 },
  ];
  const trembleKeys = [{ t: 0, v: 1 }, { t: 3.5, v: 0.6 }, { t: cue.L04.speechStart + 1.2, v: 0.8 }, { t: cue.L05.speechEnd, v: 0.6 },
    { t: cue.L07.speechStart + 2, v: 0.25 }, { t: B.swordLowerStart, v: 0 }];
  const relaxKeys = [{ t: 0, v: 0 }, { t: cue.L07.speechEnd, v: 0.08 }, { t: B.swordTipDown, v: 0.35 }, { t: lowerEnd, v: 0.8, ease: 'inout' },
    { t: cue.L11.speechStart, v: 0.85 }, { t: cue.L11.speechEnd + 0.4, v: 1, ease: 'inout' }];

  function knightLook(t) {
    const jHead = jr.worldPos('head').add(V3(0, 0.12, 0));
    const blade = knight.sword.localToWorld(V3(0, K.SWORD.tipY * 0.55, 0));
    const river = V3(-0.3, 0.9, 6);
    const down = kr.pointToWorld(V3(-0.1, 0.3, 0.95));
    return schedule([
      [0, river, 0.55],
      [cue.L02.speechStart + 0.8, jHead, 0.3],           // a guarded glance at the stranger
      [cue.L02.speechEnd, down, 0.35],
      [cue.L03.speechStart + 0.6, jHead, 0.5],
      [cue.L04.speechStart + 0.3, river, 0.55],          // looks away while he tells it
      [cue.L05.speechStart + 0.1, blade, 0.85],          // stares at the blade
      [cue.L06.speechStart + 0.4, jHead, 0.45],
      [cue.L07.speechStart + 1.5, jHead, 0.72],
      [B.swordLookStart, blade, 0.95],
      [B.swordTipDown + 0.3, down, 0.6],
      [cue.L08.speechStart - 0.3, jHead, 0.75],
      [cue.L10.speechEnd - 0.4, down, 0.45],
      [cue.L11.speechStart + 1.0, jHead, 0.6],
      [goldenMid, river, 0.5],
      [cue.L12.speechStart + 1.6, jHead, 0.7],
    ], t);
  }

  function updateKnight(t) {
    const seated = t < goldenMid;
    const grip = sampleTrack(gripKeys, t);
    const kEnv = speechEnv('KNIGHT', t);
    let relax = sampleTrack(relaxKeys, t);
    if (seated) {
      kr.root.position.copy(KNIGHT_SEAT_ROOT);
      kr.root.rotation.set(0, KNIGHT_SEAT_YAW * DEG, 0);
      const lowering = t >= B.swordLowerStart;
      const lp = lowering ? K.swordLowerPose(knight, lowerU(t)) : null;
      kr.applyPose(Humanoid.blend([[KP.seated, 1 - relax], [KP.seatedRelaxed, relax]]));
      const br = Math.sin(t * Math.PI * 2 * lerp(0.3, 0.21, relax));
      kr.addRot('chest', -br * lerp(0.7, 1.3, relax), 0, 0);
      kr.addRot('shoulderL', 0, 0, br * 0.5); kr.addRot('shoulderR', 0, 0, -br * 0.5);
      const sigh = win(t, cue.L11.fileStart, cue.L11.speechStart + 0.6, 0.3, 0.8);   // the exhale on L11
      kr.addRot('chest', 3 * sigh, 0, 0); kr.addRot('neck', 4 * sigh, 0, 0);
      kr.addRot('head', -2.2 * kEnv, 1.2 * noise1(t * 3.1), 0);                     // speaking emphasis
      kr.update();
      K.plantFeet(knight);
      if (!lowering) {
        const base = K.swordPose(knight, 'sitGrip');
        const w = win(t, cue.L05.speechStart - 0.45, cue.L06.speechStart + 0.5, 0.9, 1.0);
        const s = w > 0 ? blendSword(base, K.swordPose(knight, SIT_INSPECT), easeInOut(w)) : base;
        K.solveSwordHands(knight, s.position, s.quaternion, { grip: 'forward', left: 'knee', tremble: sampleTrack(trembleKeys, t), t, tension: grip });
      } else {
        K.solveSwordHands(knight, lp.position, lp.quaternion, { grip: lp.grip, left: lp.left });
      }
    } else {
      kr.root.position.copy(KNIGHT_END_ROOT);
      kr.root.rotation.set(0, KNIGHT_END_YAW * DEG, 0);
      kr.applyPose(KP.stand);
      const br = Math.sin(t * Math.PI * 2 * 0.21);
      kr.addRot('chest', -br * 1.1, 0, 0);
      kr.addRot('head', -2 * kEnv, 0, 0);
      const turn = smoothstep(B.shoulderTouch + 0.3, B.shoulderTouch + 1.6, t);   // softens toward Jesus when touched
      kr.addRot('chest', 0, 5 * turn, 0);
      kr.update();
      const s = K.swordPose(knight, 'standDown');
      K.solveSwordHands(knight, s.position, s.quaternion, { grip: s.grip, left: 'free' });
      knight.setHand('L', 'relaxed');
    }
    const look = knightLook(t);
    kr.lookAt(look.target, look.w);
    knight.update(t, { grip, seated, rock: { center: kSeat }, wind: 0.35 });
  }

  // =====================================================================================
  // JESUS
  // =====================================================================================
  // Walk: footsteps in the mix fall every 0.543 s from beats.establishStart to beats.jesusArrive (8 steps),
  // so heel strikes are locked to them: phase 0 = left heel strike, 0.5 = right (J.walkPose).
  const STEP_T = (B.jesusArrive - B.establishStart) / 7;
  const STEP_L = J.WALK.stride;
  const walkDir = V3(-1, 0, -0.09).normalize();                                     // along the bank toward the seats
  const walkStart = JESUS_STAND_SPOT.clone().addScaledVector(walkDir, -7 * STEP_L);    // position at the first footstep
  const WALK_YAW = Math.atan2(walkDir.x, walkDir.z) / DEG;
  function jesusLook(t) {
    const kHead = kr.worldPos('head').add(V3(0, 0.1, 0.05));
    const blade = knight.sword.localToWorld(V3(0, K.SWORD.tipY * 0.5, 0));
    const ahead = jr.root.localToWorld(V3(0, 1.55, 3));
    return schedule([
      [0, ahead, 0.25],
      [cue.L02.speechStart - 0.4, kHead, 0.8],
      [cue.L06.speechStart + 1.0, blade, 0.55],
      [cue.L06.speechEnd, kHead, 0.85],
      [B.swordLowerStart + 0.3, blade, 0.65],
      [B.swordSettleEnd, kHead, 0.85],
      [goldenMid, V3(-2, 1.2, 8), 0.45],
      [B.shoulderTouch + 0.2, kHead, 0.8],
    ], t, 0.8);
  }

  let sitStandFeet = null;
  function updateJesus(t) {
    const jEnv = speechEnv('JESUS', t);
    let walkPhase = 0, walking = false;
    let feet = null;          // optional { L, R } world ankle targets to pin
    if (t < goldenMid) {
      if (t < B.jesusArrive + 0.45) {
        walking = t < B.jesusArrive;
        const tt = Math.min(t, B.jesusArrive);
        const steps = (tt - B.establishStart) / STEP_T;                            // may be negative (walking in off-screen)
        walkPhase = ((steps / 2) % 1 + 1) % 1;
        const p = walkStart.clone().addScaledVector(walkDir, steps * STEP_L);
        jr.root.position.copy(p);
        const stopW = smoothstep(B.jesusArrive - 0.25, B.jesusArrive + 0.45, t);
        jr.root.rotation.set(0, lerp(WALK_YAW, JESUS_SEAT_YAW - 12, stopW) * DEG, 0);
        jr.applyPose(Humanoid.blend([[Humanoid.compile(J.walkPose(walkPhase)), 1 - stopW], [JP.stand, stopW]]));
        jr.root.position.y = J.WALK.filmBob * Math.abs(Math.sin(walkPhase * Math.PI * 2)) * (1 - stopW);
      } else if (t < B.jesusSitStart) {
        jr.root.position.copy(JESUS_STAND_SPOT);
        jr.root.rotation.set(0, lerp(JESUS_SEAT_YAW - 12, JESUS_SEAT_YAW, smoothstep(B.jesusArrive + 0.45, B.jesusSitStart, t)) * DEG, 0);
        jr.applyPose(JP.stand);
      } else {
        // sit down: hips travel back and down onto the rock, feet stay planted then settle
        const u = easeInOut(clamp((t - B.jesusSitStart) / (B.jesusSitEnd - B.jesusSitStart), 0, 1));
        jr.root.position.copy(JESUS_STAND_SPOT).lerp(JESUS_SEAT_ROOT, u);
        jr.root.rotation.set(0, JESUS_SEAT_YAW * DEG, 0);
        let pose = Humanoid.blend([[JP.stand, 1 - u], [JP.sit, u]]);
        if (u >= 1) {
          const gOpen = Math.max(
            win(t, cue.L03.speechStart - 0.1, cue.L03.speechEnd + 0.3, 0.6, 0.7) * 0.55,     // gentle open palm
            win(t, cue.L07.speechStart + 0.2, cue.L07.speechEnd + 0.4, 0.7, 0.9),             // teaching gesture
            win(t, cue.L10.speechStart, cue.L10.speechEnd + 0.4, 0.6, 0.8) * 0.85);
          const gHeart = win(t, cue.L09.speechStart + 0.9, cue.L09.speechEnd + 0.3, 0.6, 0.6);
          pose = blendBones(pose, JP.openPalm, gOpen, ARM_R);
          pose = blendBones(pose, JP.handOnHeart, gHeart, ARM_R);
        }
        jr.applyPose(pose);
        if (u < 1) jr.addRot('spine', 12 * Math.sin(Math.PI * u), 0, 0);       // lean forward while lowering
        if (!sitStandFeet) {
          // standing ankle positions at the stand spot
          const save = jr.root.position.clone();
          jr.root.position.copy(JESUS_STAND_SPOT); jr.applyPose(JP.stand); jr.update();
          sitStandFeet = { L: jr.worldPos('footL'), R: jr.worldPos('footR') };
          jr.root.position.copy(save); jr.applyPose(pose);
          if (u < 1) jr.addRot('spine', 12 * Math.sin(Math.PI * u), 0, 0);
        }
        jr.update();
        const seatFeet = J.legTargetsSeated(jesus);
        const k = smoothstep(0.35, 0.95, u);
        feet = { L: sitStandFeet.L.clone().lerp(seatFeet.L, k), R: sitStandFeet.R.clone().lerp(seatFeet.R, k) };
      }
    } else {
      jr.root.position.copy(JESUS_END_ROOT);
      jr.root.rotation.set(0, JESUS_END_YAW * DEG, 0);
      jr.applyPose(JP.stand);
    }
    // breathing + speaking life
    const br = Math.sin(t * Math.PI * 2 * 0.2 + 1);
    jr.addRot('chest', -br * 0.8, 0, 0);
    jr.addRot('head', -1.8 * jEnv + 0.8 * noise1(t * 0.7 + 4), 1.0 * noise1(t * 0.5 + 9), 0.8 * noise1(t * 0.43 + 2));
    if (speakingCue('JESUS', t)) jr.addRot('head', 0, 0, 2.0 * Math.sin(t * 1.3));
    const shake = win(t, cue.L09.speechStart - 0.1, cue.L09.speechStart + 0.9, 0.2, 0.3);   // "No." — slow head shake
    jr.addRot('neck', 0, 7 * shake * Math.sin((t - cue.L09.speechStart) * 9), 0);
    jr.update();
    if (feet) { jr.legIK('L', feet.L); jr.legIK('R', feet.R); }
    // ending: right hand comes to rest on the knight's left pauldron
    if (t >= goldenMid) {
      const reach = smoothstep(B.shoulderTouch, B.shoulderTouch + 1.1, t);
      if (reach > 0) {
        kr.update();
        const contact = kr.worldPos('shoulderL').add(kr.dirToWorld(V3(0.03, 0.1, -0.03)));
        const fingers = contact.clone().sub(jr.worldPos('upperArmR')).setY(0).normalize().add(V3(0, -0.35, 0)).normalize();
        const wrist = contact.clone().addScaledVector(fingers, -0.065).add(V3(0, 0.03, 0));
        const rest = jr.worldPos('handR');
        const e = easeInOut(reach);
        jr.armIK('R', rest.clone().lerp(wrist, e), [-0.55, -0.6, -0.55]);
        // palm (+Z of the hand bone) down onto the plate, fingers (-Y) draped over the shoulder
        const hy = fingers.clone().negate(), hz = V3(0, -1, 0).addScaledVector(hy, -V3(0, -1, 0).dot(hy)).normalize();
        const qOn = quatFromBasis(V3().crossVectors(hy, hz).normalize(), hy, hz);
        const cur = jr.b.handR.getWorldQuaternion(new THREE.Quaternion());
        jr.setWorldQuat(jr.b.handR, cur.slerp(qOn, e));
        jesus.setFingers && jesus.setFingers('R', 0.25 * reach);
      }
    }
    const look = jesusLook(t);
    jr.lookAt(look.target, look.w);
    jesus.setMouth(clamp(jEnv * 1.05, 0, 1));
    const period = 3.7, ph = (t + 1.3) % period;
    jesus.setBlink(ph < 0.14 ? Math.sin((ph / 0.14) * Math.PI) : ((t + 0.4) % 11.3 < 0.16 ? 1 : 0));
    jesus.update(t, { seated: t >= B.jesusSitStart + 0.6 && t < goldenMid, walkPhase, walking });
  }

  // =====================================================================================
  // CAMERA — shot list. Each shot: a = start framing, b = end framing {p: position, l: look-at, fov}.
  // =====================================================================================
  const S = (p, l, fov) => ({ p: V3(...p), l: V3(...l), fov });
  const shots = [
    // 1 HOOK: across the river, low — the knight on his rock gripping the raised sword; slow push-in to the helmet.
    { t: 0, a: S([0.9, 1.35, 6.8], [-0.45, 0.85, 0.0], 30), b: S([0.35, 1.18, 3.5], [-0.5, 1.15, 0.0], 26), shake: 0.6, focus: [V3(-0.3, 0.6, 0.6), 3.2] },
    // 2 ESTABLISHING: high, wide crane over the river; Jesus walking in along the bank (title card).
    { t: B.establishStart, a: S([5.5, 3.6, 14.5], [2.2, 0.5, 0.3], 40), b: S([4.4, 2.9, 12.6], [1.7, 0.6, 0.3], 40), shake: 0.2, focus: [V3(2.0, 0.5, 0.4), 6] },
    // 3 TWO-SHOT: Jesus arrives beside the knight and speaks.
    { t: cue.L02.speechStart - 0.25, a: S([3.6, 1.5, 1.6], [-0.5, 0.95, 0.0], 38), b: S([3.2, 1.42, 1.5], [-0.4, 0.95, 0.05], 38), shake: 0.4, focus: [V3(0.8, 0.6, 0.3), 3.2] },
    // 4 Jesus sits; frontal two-shot, gentle push.
    { t: B.jesusSitStart - 0.05, a: S([0.1, 1.1, 4.4], [0.1, 0.85, 0.05], 40), b: S([0.1, 1.08, 4.05], [0.1, 0.87, 0.05], 39), shake: 0.35, focus: [V3(0.1, 0.6, 0.3), 2.6] },
    // 5 KNIGHT close-up, low angle, slow push (betrayal).
    { t: cue.L04.speechStart - 0.3, a: S([0.05, 0.98, 1.85], [-0.55, 1.1, 0.0], 32), b: S([-0.05, 1.0, 1.55], [-0.55, 1.13, 0.0], 30), shake: 0.35, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 6 OVER JESUS'S SHOULDER onto the knight studying his blade.
    { t: cue.L05.speechStart - 0.35, a: S([0.95, 1.36, -0.62], [-0.5, 1.18, 0.25], 36), b: S([0.9, 1.34, -0.55], [-0.5, 1.18, 0.25], 34), shake: 0.4, focus: [V3(0.1, 0.8, 0.0), 2.6] },
    // 7 JESUS close-up, 3/4 front from the knight's side, slow push-in ("Any man..." / "True strength...").
    { t: cue.L06.speechStart - 0.3, a: S([-0.02, 1.2, 1.25], [0.74, 1.06, 0.13], 32), b: S([0.14, 1.2, 0.98], [0.74, 1.08, 0.13], 28), shake: 0.3, focus: [V3(0.6, 0.8, 0.2), 2] },
    // 8 KNIGHT reaction: helmet turns toward Jesus, then down to his sword.
    { t: cue.L07.speechStart + 2.45, a: S([-1.0, 1.15, 1.35], [-0.5, 1.13, 0.1], 32), b: S([-0.95, 1.13, 1.28], [-0.5, 1.1, 0.12], 32), shake: 0.3, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 9 THE SWORD: low and close; the blade sweeps down and its point meets the grass.
    { t: B.swordLowerStart - 0.1, a: S([0.2, 0.42, 2.25], [-0.55, 0.55, 0.55], 40), b: S([0.1, 0.36, 2.05], [-0.58, 0.5, 0.62], 38), shake: 0.25, focus: [V3(-0.5, 0.4, 0.5), 2] },
    // 10 KNIGHT medium: hands resting on the hilt, posture softened.
    { t: cue.L08.speechStart - 0.35, a: S([-1.45, 1.05, 2.25], [-0.5, 0.95, 0.2], 36), b: S([-1.35, 1.06, 2.05], [-0.5, 0.98, 0.2], 35), shake: 0.3, focus: [V3(-0.5, 0.6, 0.3), 2.5] },
    // 11 OVER THE KNIGHT'S SHOULDER onto Jesus ("No...").
    { t: cue.L09.speechStart - 0.3, a: S([-0.38, 1.5, -0.68], [0.72, 1.05, 0.15], 36), b: S([-0.35, 1.48, -0.6], [0.72, 1.06, 0.15], 34), shake: 0.35, focus: [V3(0.1, 0.8, 0.0), 2.6] },
    // 12 JESUS close-up, warm push.
    { t: cue.L10.speechStart - 0.2, a: S([0.06, 1.18, 1.1], [0.74, 1.06, 0.13], 30), b: S([0.2, 1.19, 0.9], [0.74, 1.08, 0.13], 27), shake: 0.3, focus: [V3(0.6, 0.8, 0.2), 2] },
    // 13 KNIGHT close-up: the exhale; the light begins to warm.
    { t: cue.L11.fileStart - 0.15, a: S([-0.15, 1.02, 1.7], [-0.55, 1.13, 0.0], 30), b: S([-0.2, 1.08, 1.45], [-0.55, 1.17, 0.0], 28), shake: 0.3, focus: [V3(-0.5, 0.8, 0.2), 2] },
    // 14 GOLDEN: standing together on the bank, low 3/4 front, slow arc.
    { t: goldenMid, a: S([-1.55, 1.0, 3.5], [-0.1, 1.1, 0.55], 36), b: S([-1.2, 1.05, 3.1], [-0.08, 1.12, 0.55], 34), shake: 0.3, focus: [V3(-0.1, 0.8, 0.6), 2.5] },
    // 15 FINAL: behind them, looking across the river toward the sunlit castle; rising crane (end card).
    { t: B.endCardStart - 0.25, a: S([0.1, 1.75, -3.4], [-0.1, 1.15, 8], 42), b: S([0.0, 2.25, -4.1], [-0.1, 1.35, 10], 42), shake: 0.2, focus: [V3(0, 0.8, 0.8), 3.5] },
  ];
  for (let i = 0; i < shots.length; i++) shots[i].end = i + 1 < shots.length ? shots[i + 1].t : tl.duration;

  let lastShot = -1;
  function updateCamera(t) {
    let i = 0;
    while (i < shots.length - 1 && shots[i + 1].t <= t) i++;
    const s = shots[i];
    const lin = clamp((t - s.t) / (s.end - s.t), 0, 1);
    const u = easeInOut(lin) * 0.85 + lin * 0.15;
    const p = s.a.p.clone().lerp(s.b.p, u), l = s.a.l.clone().lerp(s.b.l, u);
    const amp = (s.shake || 0) * 0.006;                                         // subtle handheld float
    p.x += fbm1(t * 0.55, 11) * amp; p.y += fbm1(t * 0.5, 12) * amp; p.z += fbm1(t * 0.45, 13) * amp * 0.5;
    l.x += fbm1(t * 0.4, 14) * amp * 0.6; l.y += fbm1(t * 0.42, 15) * amp * 0.6;
    camera.position.copy(p);
    camera.fov = lerp(s.a.fov, s.b.fov, u);
    camera.lookAt(l);
    camera.updateProjectionMatrix();
    if (i !== lastShot) { world.focusShadow(s.focus[0], s.focus[1]); lastShot = i; }
    return i;
  }

  // =====================================================================================
  // MOOD / GRADE / TRANSITIONS
  // =====================================================================================
  const moodKeys = [{ t: 0, v: 0 }, { t: B.swordTipDown, v: 0.04 }, { t: cue.L09.speechStart, v: 0.14, ease: 'inout' },
    { t: cue.L11.speechEnd, v: 0.32, ease: 'inout' }, { t: B.goldenStart, v: 0.36 }];
  function updateGrade(t) {
    const g = stage.grade.uniforms;
    const mood = t >= goldenMid ? 1 : sampleTrack(moodKeys, t);
    g.uWarm.value = lerp(-0.04, 0.28, mood);
    g.uSat.value = lerp(1.06, 1.1, mood);
    g.uVignette.value = lerp(0.24, 0.32, mood);
    // dip through warm light between the seated scene and the golden ending
    const dipIn = smoothstep(B.goldenStart, goldenMid, t), dipOut = 1 - smoothstep(goldenMid, B.goldenEnd, t);
    let fade = Math.min(dipIn, dipOut) * 0.92;
    let fadeCol = new THREE.Color(1.0, 0.86, 0.62);
    if (t >= B.endCardStart) {   // end card: dim for legibility, then fade to black at the very end
      fade = Math.max(smoothstep(B.endCardStart, B.endCardStart + 1.0, t) * 0.42, smoothstep(tl.duration - 0.9, tl.duration - 0.05, t));
      fadeCol = new THREE.Color(0.02, 0.015, 0.01);
    }
    if (t < 0.1) { fade = Math.max(fade, 1 - smoothstep(0, 0.1, t)); fadeCol = new THREE.Color(0, 0, 0); }
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
      updateJesus(t);            // first: the knight looks at Jesus's head
      updateKnight(t);
      if (t >= goldenMid) updateJesus(t);   // his hand needs the knight's final shoulder position
      updateCamera(t);
    },
  };
}
