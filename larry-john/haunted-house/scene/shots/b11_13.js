// Beats 11-13: it grows into a mansion (main camera spot), secret doors, moving paintings, trapdoors.
import * as THREE from 'three';
import { P, pose, place, walk, hop, popScale, smooth, clamp, lerp, track, easeOutBack, spring, wobble, mergePose, blendPose, facepalm } from '../acting.js';
import { easeInOut, easeOutCubic, easeInCubic } from '../../../engine/toon/anim.js';
import { shedXZ, mainCam } from './b01_04.js';

// hide any wall group whose plane separates the camera from what it looks at (cutaway set)
export function cutaway(W, walls, target) {
  W.after.unshift(() => {
    const cam = W.stage.camera.position, T = new THREE.Vector3(...target);
    for (const k in walls) {
      const w = walls[k]; w.updateWorldMatrix(true, false);
      const p0 = new THREE.Vector3().setFromMatrixPosition(w.matrixWorld);
      const n = new THREE.Vector3(0, 0, 1).transformDirection(w.matrixWorld);
      if (cam.clone().sub(p0).dot(n) * T.clone().sub(p0).dot(n) < 0) w.visible = false;
    }
  });
}

export function hall(W) {
  const O = W.HALL.origin;
  return (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
}

export function shots11_13(T, W) {
  const C = W.cast, L = C.larry, J = C.john, S = [];
  const E = () => W.sets.estate.userData;
  const H = hall(W);
  const HI = () => W.sets.interior.userData;
  const inHall = (target, look = 'mansion') => {
    W.show('interior');
    W.shadow(H(0, 0, -5), 9);
    cutaway(W, HI().walls, target);
  };

  // the line of kids along the stepping stones, waiting at the shed
  const lineOfKids = (t, n = 14) => {
    const stones = W.sets.backyard.userData.stones;
    const path = new THREE.CatmullRomCurve3([new THREE.Vector3(...shedXZ(W, 0, 2.4)), ...stones.slice().reverse().map((p) => new THREE.Vector3(p[0] + 0.55, 0, p[2]))]);
    const named = [C.pumpkinKid, C.witchKid, C.dinoKid];
    for (let i = 0; i < n; i++) {
      const u = Math.min(0.98, i * 0.062);
      const p = path.getPoint(u), ahead = path.getPoint(Math.max(0, u - 0.02));
      const k = i < 3 ? named[i] : W.crowdPerson(i - 3);
      place(k, [p.x, 0, p.z], [ahead.x, 0, ahead.z]);
      k.applyPose(P({ y: Math.abs(Math.sin(t * 3 + i)) * 0.01, head: { turn: Math.sin(t * 0.8 + i) * 12 } }));
      k.setFace(i % 4 === 0 ? 'bored' : 'happy', {}, t + i);
    }
  };

  // ---------------- beat 11 ----------------
  const t11 = T.beatCut(11), t11b = T.cut(11, 'So'), t11c = T.cut(11, 'One', 2), t11d = T.cut(11, 'Thirteen'), t11e = T.cut(11, 'A');
  const one = T.word(11, 'One', 2).s, thirteen = T.word(11, 'Thirteen').s, mansionW = T.word(11, 'mansion').s;
  const t12 = T.beatCut(12);
  const popOne = one + 0.05, popB = thirteen + 0.05, popC = T.word(11, 'whole').s + 0.02;
  const growthFrame = (abs, u) => {
    W.show('backyard', 'estate');
    const m = mainCam(W);
    const E_ = E();
    // dusk → night across the growth
    const night = smooth(clamp((abs - t11) / (t12 - t11)));
    W.look(...(night < 0.5 ? ['dusk', 'dusk', 0] : ['dusk', 'night', (night - 0.5) * 2]));
    // pop 1: the shed bounces
    const shed = W.sets.backyard.userData.shed;
    const k1 = abs - popOne;
    shed.scale.set(1 - 0.12 * wobble(k1, 3, 6), 1 + 0.25 * wobble(k1, 3, 6), 1 - 0.12 * wobble(k1, 3, 6));
    // pop 2: the crooked spooky house
    if (abs > popB - 0.02 && abs < popC + 0.15) {
      E_.spooky.visible = true;
      E_.spooky.scale.setScalar(popScale(abs, popB, 0.4) * (abs > popC ? Math.max(0.0001, 1 - (abs - popC) / 0.15) : 1));
      W.fx.puffs.pop([W.SPOOKY.pos[0], 0, W.SPOOKY.pos[2] + 2.5], abs - popB, { radius: 4, count: 14, size: 1.1, life: 0.9, seed: 4 });
    }
    // pop 3: the giant mansion, the full moon rising behind it
    if (abs > popC - 0.02) {
      E_.mansion.visible = true; E_.graveyard.visible = abs > popC + 0.25;
      E_.mansion.scale.setScalar(popScale(abs, popC, 0.5) * W.MANSION.scale);
      W.fx.puffs.pop([W.MANSION.pos[0], 0, W.MANSION.pos[2] + 9], abs - popC, { radius: 16, count: 18, size: 3.2, life: 0.9, seed: 5 });
    }
    const rise = smooth(clamp((abs - popC + 0.2) / 1.4));
    W.moonAt([W.MANSION.pos[0] + 30, lerp(-10, 60, rise) + 20, W.MANSION.pos[2] - 260], 30);
    // camera: same spot; tilts up a little for the mansion
    const tilt = smooth(clamp((abs - popC) / 0.6));
    W.cam.set(m.pos, [m.target[0] + tilt * 2.2, m.target[1] + tilt * 4.2, m.target[2]], m.fov + tilt * 5).shake(abs, 0.4 + (Math.abs(abs - popC) < 0.35 ? 2.5 : 0) + (Math.abs(abs - popB) < 0.25 ? 1.5 : 0), 41);
    W.shadow([4, 0, -14], 22);
  };
  S.push({
    id: '11a', beat: 11, at: t11, look: 'dusk',
    sfx: [['crowd_kids', t11 + 0.05, 0.5]],
    frame({ t, abs, u }) {
      W.show('backyard');
      W.look('golden', 'dusk', smooth(u));
      lineOfKids(t, 16);
      place(L, shedXZ(W, 0, 1.75), null, -0.32); L.setSheet(true); L.sheet.set({ drape: 1, sway: t * 3 }); L.sheet.face.set('happy');
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 } }));
      const m = mainCam(W);
      W.cam.set(m.pos, m.target, m.fov).push(-u * 1.2).shake(t, 0.4, 40);
      W.shadow([1, 0, -1], 10);
    },
  });
  S.push({
    id: '11b', beat: 11, at: t11b, look: 'dusk',
    sfx: [['blueprint_unroll', t11b + 0.08, 0.6], ['hammer', t11b + 0.38, 0.9], ['hammer', t11b + 0.6, 0.8]],
    frame({ t, abs }) {
      W.show('backyard');
      W.look('dusk');
      const p = shedXZ(W, -2.3, 3.6);
      const cpos = shedXZ(W, -1.6, 6.2, 1.2);
      place(J, p, cpos);
      // John raises a big hammer, determined grin: time to build bigger
      const swing = Math.max(0, Math.sin((t - 0.25) * 14));
      J.applyPose(P({ armR: { fwd: 100 + 50 * swing, out: 18, elbow: 30 + 40 * swing }, armL: { fwd: 40, out: 25, elbow: 80 }, head: { nod: -4 } }));
      J.setFace('grin', { brows: 'angry' }, t);
      const hm = W.props.hammer; hm.visible = true;
      J.updateMatrixWorld(true); J.hand('R').add(hm); hm.position.set(0, -0.08, 0.02); hm.rotation.set(Math.PI / 2, 0, 0);
      W.cam.set(cpos, [p[0], 1.15, p[2]], 44).push(t * 0.3).shake(t, 0.6, 42);
      W.shadow(p, 4);
    },
  });
  S.push({
    id: '11c', beat: 11, at: t11c, look: 'dusk',
    labels: [{ text: '1 ROOM', color: 'yellow', at: one - 0.03, dur: thirteen - one + 0.02, group: 'grow' }],
    sfx: [['pop', popOne, 0.9], ['boing_small', popOne + 0.02, 0.5]],
    frame({ t, abs, u }) { growthFrame(abs, u); lineOfKids(abs, 16); },
  });
  S.push({
    id: '11d', beat: 11, at: t11d, look: 'dusk',
    labels: [{ text: '13 ROOMS', color: 'yellow', at: thirteen - 0.03, dur: T.word(11, 'A').s - thirteen + 0.05, group: 'grow' }],
    sfx: [['pop_big', popB, 1.0], ['smoke_puff', popB + 0.02, 0.6], ['wood_creak', popB + 0.25, 0.5]],
    frame({ t, abs, u }) { growthFrame(abs, u); lineOfKids(abs, 16); },
  });
  S.push({
    id: '11e', beat: 11, at: t11e, look: 'night',
    labels: [{ text: 'MANSION', color: 'yellow', at: popC - 0.02, dur: t12 - popC + 0.15, group: 'grow' }],
    sfx: [['pop_huge', popC, 1.0], ['smoke_puff_big', popC + 0.03, 0.8], ['thunder_soft', popC + 0.45, 0.5], ['wolf_howl_cartoon', mansionW + 0.15, 0.35]],
    frame({ t, abs, u }) { growthFrame(abs, u); lineOfKids(abs, 16); },
  });

  // ---------------- beat 12 (inside the mansion) ----------------
  const t12b = T.cut(12, 'moving'), t12c = T.cut(12, 'and'), secret = T.word(12, 'secret').s, trapW = T.word(12, 'trapdoors').s;
  S.push({
    id: '12a', beat: 12, at: t12, look: 'mansion',
    sfx: [['stone_rumble', secret - 0.05, 0.9], ['bookshelf_spin', secret + 0.05, 0.8]],
    blur: (t) => (t > 0.4 && t < 1.1 ? 3 : 0),
    frame({ t, abs }) {
      const tgt = H(1.9, 1.35, -5.6);
      inHall(tgt);
      const sh = HI().shelf;
      const spin = easeInOut(clamp((abs - secret + 0.05) / 0.75));
      sh.userData.pivot.rotation.y = spin * Math.PI / 2;
      sh.userData.glowL.intensity = spin > 0.4 ? 2.5 : 0;
      W.fog.show({ center: H(0, 0.25, -5), size: [4, 0.5, 8] }, abs, { density: 0.45, color: '#a8ffbf', opacity: 0.1, floor: 1 });
      W.cam.set(H(-1.4, 1.5, -2.2), tgt, 56).push(t * 0.3).shake(t, spin > 0 && spin < 1 ? 1.4 : 0.5, 43);
    },
  });
  S.push({
    id: '12b', beat: 12, at: t12b, look: 'mansion',
    sfx: [['eyes_shift', t12b + 0.15, 0.6], ['creepy_organ_hit', t12b + 0.05, 0.4]],
    frame({ t, d, u }) {
      const tgt = H(-2.0, 2.0, -4.3);
      inHall(tgt);
      // the camera dollies past; the portrait's eyes follow it
      const cpos = new THREE.Vector3(...H(0.8, 1.7, lerp(-2.4, -6.2, smooth(u))));
      W.cam.set(cpos, tgt, 50).shake(t, 0.4, 44);
      const pp = HI().portrait;
      const rel = cpos.z - tgt[2];
      pp.userData.look(clamp(-rel / 2.2, -1, 1), 0.15);
    },
  });
  S.push({
    id: '12c', beat: 12, at: t12c, look: 'mansion',
    labels: [{ text: 'TRAPDOORS', color: 'yellow', at: trapW - 0.04, dur: 1.1 }],
    sfx: [['trapdoor_rattle', trapW, 0.7]],
    frame({ t, abs }) {
      const tgt = H(0, 0, -9.2);
      inHall(tgt);
      const rattle = abs > trapW ? wobble(abs - trapW, 9, 5) : 0;
      HI().trapdoor.hinge.rotation.x = rattle * 0.06;
      W.cam.set(H(0.6, 2.2, -6.6), tgt, 52).push(t * 0.35).shake(t, 0.5, 45);
    },
  });

  // ---------------- beat 13 ----------------
  const t13 = T.beatCut(13), t13b = T.cut(13, 'Personally'), personally = T.word(13, 'Personally').s;
  const john13 = T.word(13, 'JOHN!'), t14 = T.beatCut(14);
  const dropAt = personally - 0.08;
  S.push({
    id: '13a', beat: 13, at: t13, look: 'mansion',
    sfx: [['footsteps_soft', t13 + 0.05, 0.5], ['wood_tap', t13 + 0.75, 0.6], ['wood_tap', t13 + 0.95, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0, 0.8, -9.2);
      inHall(tgt);
      const lp = walk(L, H(0, 0, -6.6), H(0, 0, -8.6), abs, t13, t13 + 0.75, { stride: 0.2 });
      if (abs > t13 + 0.75) { const tap = Math.max(0, Math.sin((abs - t13 - 0.75) * 16)); lp.legL = { fwd: 25 * tap, knee: 10 * tap, foot: -20 * tap }; }
      L.applyPose(lp);
      L.setSheet(true); L.sheet.set({ drape: 1, sway: abs * 4 }); L.sheet.face.set('happy', { pupil: [0, -0.7] });
      W.cam.set(H(1.3, 1.25, -11.6), tgt, 50).shake(t, 0.4, 46);
    },
  });
  S.push({
    id: '13b', beat: 13, at: t13b, look: 'mansion',
    sfx: [['trapdoor_snap', dropAt, 1.0], ['fall_whoosh', dropAt + 0.12, 1.0]],
    blur: (t) => 4,
    frame({ t, abs }) {
      const tgt = H(0, 0.7, -9.2);
      inHall(tgt);
      const k = abs - dropAt;
      HI().trapdoor.hinge.rotation.x = k > 0 ? Math.min(1.75, k * 22) - wobble(k - 0.08, 4, 6) * 0.25 : 0;
      place(L, H(0, 0, -9.2), H(0, 0, -6));
      // cartoon hang time: he hangs for a beat, looks down, then drops
      const fall = k > 0.22 ? (k - 0.22) ** 2 * 18 : 0;
      L.position.y = -fall;
      L.setSheet(true);
      L.sheet.set({ drape: 1, lift: k > 0.22 ? Math.min(0.25, (k - 0.22) * 2) : 0, sway: abs * 4 });
      L.sheet.face.set(k > 0.05 ? 'terrified' : 'happy', { pupil: [0, -0.8] });
      L.applyPose(P({ squash: k > 0.22 ? 1.15 : 1 }));
      W.cam.set(H(1.0, 1.4, -6.9), tgt, 54).shake(abs, k > 0 ? 1.6 : 0.4, 47);
    },
  });
  S.push({
    id: '13c', beat: 13, at: john13.s - 0.05, look: 'mansion',
    sfx: [],
    frame({ t, abs }) {
      const tgt = H(0, -2.5, -9.2);
      inHall(H(0, 0, -9.2));
      HI().trapdoor.hinge.rotation.x = 1.75;
      // looking down the dark hole: Larry lies face-up at the bottom, yelling up at us
      place(L, H(0, -2.4, -8.6), null, 0);
      L.rotation.x = -Math.PI / 2;
      L.setSheet(true); L.sheet.set({ drape: 1, mouthPush: 1.0 * clamp((abs - john13.s) / 0.06) * (1 - clamp((abs - john13.e) / 0.3)) });
      L.sheet.face.set('yell');
      L.sheet.mat.userData.faceUniforms.faceGlow.value = 0.9;
      L.applyPose(P({ armL: { fwd: 30, out: 70, elbow: 20 }, armR: { fwd: 30, out: 70, elbow: 20 } }));
      W.cam.set(H(0.0, 2.6, -9.2), H(0.0, -2.0, -9.2), 62, 0.2).shake(abs, 1.2, 48);
    },
  });
  S.push({
    id: '13d', beat: 13, at: john13.e + 0.45, look: 'mansion',
    sfx: [['facepalm_slap', john13.e + 0.55, 0.8]],
    frame({ t }) {
      inHall(H(-1.2, 1.25, -6.4));
      place(J, H(-1.2, 0, -6.4), H(0, 0, -9.2));
      facepalm(J, t, { start: 0.0 });
      W.cam.set(H(-0.4, 1.4, -8.1), H(-1.2, 1.25, -6.4), 44).shake(t, 0.4, 49).dof(H(-1.2, 1.25, -6.4), 0.004, 0.008);
    },
  });
  return S;
}
