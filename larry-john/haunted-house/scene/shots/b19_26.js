// Beats 19-26: the scariest haunted house in the world, the 3-hour line, midnight, the real ghost,
// NOT SCARED x3, Larry around the corner, the ghost flees through the roof, and the loop back to the start.
import * as THREE from 'three';
import { P, pose, place, walk, hop, popScale, smooth, clamp, lerp, track, easeOutBack, spring, wobble, mergePose, blendPose, facepalm } from '../acting.js';
import { easeInOut, easeOutCubic, easeInCubic, fbm1 } from '../../../engine/toon/anim.js';
import { clay } from '../../../engine/toon/materials.js';
import { cutaway, hall } from './b11_13.js';
import { shedXZ, mainCam } from './b01_04.js';
import { signTexture } from '../world/common.js';

export function shots19_26(T, W) {
  const C = W.cast, L = C.larry, J = C.john, G = C.ghost, S = [];
  const H = hall(W);
  const HI = () => W.sets.interior.userData;
  const E = () => W.sets.estate.userData;
  const M = W.MANSION.pos;
  const inHall = (target) => { W.show('interior'); W.shadow(H(0, 0, -6), 10); cutaway(W, HI().walls, target); };
  const estate = (look = 'night') => {
    W.show('backyard', 'estate');
    const e = E(); e.mansion.visible = true; e.graveyard.visible = true; e.gate.visible = true; e.showFence(true);
    W.look(look);
    W.moonAt([M[0] + 30, 75, M[2] - 260], 30);
    return e;
  };
  const sheetLarry = (t, face = 'happy', extra = {}) => { L.setSheet(true); L.sheet.set({ drape: 1, sway: t * 3, ...extra }); L.sheet.face.set(face, { mouthPush: extra.mouthPush || 0 }); };
  const ghostAt = (pos, rotY, t, face = 'bored', extra = {}, params = {}) => {
    G.visible = true; G.position.set(...pos); G.rotation.y = rotY;
    G.set({ t, armWave: 0.6, ...params });
    G.face.set(face, extra);
    G.position.y += Math.sin(t * 2.2) * 0.05;
  };
  // flickering candles (midnight)
  const flicker = (abs, amount = 1) => {
    const I = HI();
    const f = fbm1(abs * 14, 3), off = Math.sin(abs * 47) > 0.55 ? 0.15 : 1;
    const k = 1 - amount + amount * Math.max(0.05, Math.min(1, 0.6 + f * 0.8) * off);
    I.lights.forEach((l, i) => { l.intensity = (l.distance > 6 ? 3.5 : 2.2) * k; });
    I.flameMat.emissiveIntensity = 3.2 * k;
  };

  // "WAIT: 3 HOURS" sign on a post
  const waitSign = W.registerProp('waitSign', (() => {
    const g = new THREE.Group();
    const tex = signTexture(['WAIT:', { text: '3 HOURS', color: '#b3261e' }], { w: 768, h: 512, bg: '#e9d6a8', sizes: [150, 170], rotate: -0.04, cardboard: false });
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.06), [clay('#8a5a33'), clay('#8a5a33'), clay('#8a5a33'), clay('#8a5a33'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), clay('#8a5a33')]);
    board.position.y = 2.0; board.castShadow = true; g.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.0, 0.09), clay('#6e4626')); post.position.y = 1.0; post.position.z = -0.06; post.castShadow = true; g.add(post);
    return g;
  })());

  // ---------------- beat 19: drone shot ----------------
  // the drone shot waits for John's half-second facepalm after "Twice"
  const t19 = Math.max(T.beatCut(19), T.word(18, 'Twice').e + 0.45), congrats = T.word(19, 'Congratulations!').s, scariest = T.word(19, 'scariest').s, world = T.word(19, 'world!').s;
  const t20 = T.beatCut(20);
  S.push({
    id: '19', beat: 19, at: t19, look: 'night',
    labels: [{ text: "WORLD'S SCARIEST!", color: 'green', at: scariest - 0.04, dur: t20 - scariest + 0.1 }],
    sfx: [['thunder', congrats + 0.05, 1.0], ['drone_whoosh', t19 + 0.1, 0.6], ['searchlight_hum', t19, 0.4], ['thunder_far', world + 0.1, 0.7], ['bats_flap', t19 + 0.6, 0.5], ['crowd_cheer_far', scariest, 0.35]],
    blur: 2,
    frame({ t, d, u, abs }) {
      const e = estate('night');
      e.searchlights.forEach((s, i) => { s.visible = true; s.userData.pivot.rotation.set(Math.sin(abs * 0.9 + i * 2.1) * 0.5, 0, Math.cos(abs * 0.7 + i) * 0.45); });
      W.fog.show({ center: [M[0], 0.4, -17], size: [30, 0.8, 16] }, abs, { density: 1, color: '#b9a8ff', opacity: 0.18, floor: 1, minS: 2.0, maxS: 4.0 });
      W.fx.lightning.strike([M[0] - 26, 70, M[2] - 70], abs - congrats, W);
      W.fx.lightning.strike([M[0] + 22, 66, M[2] - 80], abs - world, W);
      const k = easeInOut(u);
      const cp = [lerp(M[0] - 4, M[0] - 10, k), lerp(2.5, 30, k), lerp(-4.5, 12, k)];
      const tgt = [M[0], lerp(9, 6, k), M[2] + 2];
      W.cam.set(cp, tgt, 60).shake(abs, 0.5, 69);
      W.fx.bats.across([M[0] + 2, 26, M[2] + 2], abs, { spread: 22, size: 1.6, speed: 9, camPos: cp, seed: 8, count: 9 });
      W.shadow([M[0], 0, M[2] + 6], 26);
    },
  });

  // ---------------- beat 20: the 3-hour line ----------------
  const t20b = T.cut(20, 'People'), three = T.word(20, 'three').s, faint = T.word(20, 'faint').s, t21 = T.beatCut(21);
  const linePath = () => new THREE.CatmullRomCurve3([
    new THREE.Vector3(M[0], 0, E().gateZ + 0.8), new THREE.Vector3(M[0] - 1.5, 0, -7), new THREE.Vector3(M[0] - 7, 0, -4),
    new THREE.Vector3(-1.5, 0, 0.5), new THREE.Vector3(-6, 0, 4), new THREE.Vector3(-14, 0, 6), new THREE.Vector3(-22, 0, 9), new THREE.Vector3(-30, 0, 9),
  ]);
  S.push({
    id: '20a', beat: 20, at: t20, look: 'night',
    labels: [{ text: '3-HOUR LINE', color: 'green', at: three - 0.04, dur: t20b - three + 0.1 }],
    sfx: [['crowd_murmur', t20, 0.9], ['yawn', three + 0.3, 0.4]],
    frame({ t, abs, u }) {
      estate('night');
      const path = linePath();
      const N = 44;
      for (let i = 0; i < N; i++) {
        const v = 0.012 + i * (0.98 / N);
        const p = path.getPointAt(v), ahead = path.getPointAt(Math.max(0, v - 0.01));
        const person = W.crowdPerson(i, i % 3 === 0);
        place(person, [p.x + Math.sin(i * 2.3) * 0.15, 0, p.z + Math.cos(i * 1.7) * 0.15], [ahead.x, 0, ahead.z]);
        person.applyPose(P({ head: { turn: Math.sin(abs * 0.7 + i) * 15, nod: 4 }, armL: { fwd: 10, out: 10 + (i % 4) * 5, elbow: 20 }, y: 0 }));
        person.setFace(i % 5 === 0 ? 'sleepy' : i % 3 === 0 ? 'bored' : 'happy', {}, abs + i);
      }
      // the hidden ghost, quietly waiting in the line
      const gp = path.getPointAt(0.012 + 9.5 * (0.98 / N));
      const gc = C.ghostCameo; gc.visible = true; gc.position.set(gp.x + 0.3, 0.15, gp.z + 0.2); gc.scale.setScalar(0.85);
      gc.rotation.y = 2.4; gc.mat.opacity = 0.42; gc.set({ t: abs, armWave: 0 }); gc.face.set('bored');
      waitSign.visible = true; waitSign.position.set(-2.8, 0, 1.6); waitSign.rotation.y = 0.55;
      W.cam.set([-9 + u * 1.5, 9.5, 14], [M[0] - 6, 0.5, -9], 58).shake(abs, 0.4, 70);
      W.shadow([-4, 0, -2], 22);
    },
  });
  const doorWorld = (x, y, z) => { const d = E().mansion.userData.frontDoor; d.updateWorldMatrix(true, false); return new THREE.Vector3(x, y, z).applyMatrix4(d.matrixWorld); };
  S.push({
    id: '20b', beat: 20, at: t20b, look: 'night',
    sfx: [['gasp', faint - 0.1, 0.6], ['body_thud', faint + 0.35, 1.0], ['body_thud', faint + 0.62, 0.9], ['crowd_gasp', faint + 0.7, 0.5]],
    frame({ t, abs }) {
      estate('night');
      // two visitors at the door faint and fall over backwards, stiff as planks
      [[0, 0.3], [1, 0.57]].forEach(([i, delay]) => {
        const p = W.crowdPerson(30 + i, true);
        const base = doorWorld(-0.6 + i * 1.2, 0.72, 2.2);
        place(p, base.toArray(), doorWorld(-0.6 + i * 1.2, 0, 0).toArray());
        p.position.y = 0.72;
        const k = easeInCubic(clamp((abs - faint - delay + 0.28) / 0.28));
        p.rotation.x = 0;
        const back = new THREE.Vector3(0, 0, 1).applyQuaternion(p.quaternion);
        p.rotateX(-k * Math.PI / 2 * 0.98);
        p.position.addScaledVector(back, 0.0);
        p.applyPose(P({ armL: { fwd: 0, out: 3, elbow: 0 }, armR: { fwd: 0, out: 3, elbow: 0 }, squash: 1 - 0.05 * wobble(abs - faint - delay, 4, 6) }));
        p.setFace(k > 0.2 ? 'dizzy' : 'terrified');
      });
      W.cam.set(doorWorld(2.4, 1.5, 6.0), doorWorld(0, 0.95, 1.8), 50).shake(abs, 0.5, 71);
      W.shadow(doorWorld(0, 0, 2).toArray(), 5);
    },
  });

  // ---------------- beat 21: midnight ----------------
  const midnight = T.word(21, 'midnight').s, t21b = T.cut(21, 'something'), t21c = T.cut(21, 'A'), realW = T.word(21, 'real').s;
  const t22 = T.beatCut(22);
  W.music = { stopAt: midnight - 0.02, bong: midnight - 0.02, stingAt: null, resumeAt: null };
  S.push({
    id: '21a', beat: 21, at: t21, look: 'mansionMidnight',
    sfx: [['clock_tick', t21, 0.6], ['bong', midnight - 0.02, 1.0]],
    frame({ t, abs }) {
      const I = HI();
      const tgt = H(-1.75, 2.1, -0.9);
      inHall(tgt);
      I.clock.userData.setTime(abs < midnight ? 11.98 : 12.0);
      I.clock.userData.pendulum.rotation.z = Math.sin(abs * Math.PI) * 0.25;
      const hit = abs - midnight;
      if (hit > 0) { W.stage.grade.uniforms.flash.value = 0.12 * Math.exp(-hit * 6); W.stage.grade.uniforms.flashColor.value.set('#c8b8ff'); }
      W.cam.set(H(-0.4, 1.7, 0.6), tgt, 48).push(t * 0.25).shake(abs, hit > 0 && hit < 0.6 ? 2.0 : 0.4, 72);
    },
  });
  S.push({
    id: '21b', beat: 21, at: t21b, look: 'mansionMidnight',
    sfx: [['light_buzz', t21b, 0.8], ['ghost_whoosh', t21b + 0.25, 0.9], ['ghost_ooo', t21b + 0.5, 0.6]],
    frame({ t, abs }) {
      const tgt = H(1.7, 1.4, -5.0);
      inHall(tgt);
      flicker(abs, 1);
      // the ghost floats in through the right wall
      const k = easeOutCubic(clamp(t / 1.2));
      ghostAt(H(lerp(3.2, 1.0, k), 0.35, -5.0), -Math.PI / 2 + 0.3, abs, 'neutral', { eyes: 'open', mouth: 'O', mouthOpen: 0.3 });
      W.cam.set(H(-1.0, 1.35, -2.4), tgt, 54).shake(abs, 0.6, 73);
    },
  });
  S.push({
    id: '21c', beat: 21, at: t21c, look: 'mansionMidnight',
    labels: [{ text: 'REAL GHOST?!', color: 'red', at: realW - 0.05, dur: t22 - realW + 0.1 }],
    sfx: [['ghost_ooo', t21c + 0.05, 0.8], ['organ_sting', realW, 0.7]],
    frame({ t, abs }) {
      const gpos = H(0.7, 0.35, -5.0);
      inHall(gpos);
      flicker(abs, 0.6);
      ghostAt(gpos, -0.4, abs, 'smug', { pupil: [0.3, 0] });
      const f = [gpos[0], 1.05, gpos[2]];
      W.cam.set(H(-0.3, 1.2, -3.2), f, 44).push(t * 0.2).shake(abs, 0.5, 74).dof(f, 0.004, 0.008);
    },
  });

  // ---------------- beat 22: everyone runs ----------------
  const t22b = T.cut(22, 'The'), t22c = T.cut(22, 'Even'), t23 = T.beatCut(23);
  const runner = (ch, a, b, abs, t0, t1, face = 'screaming', extra = {}) => {
    const p = walk(ch, a, b, abs, t0, t1, { run: true, stride: 0.32 });
    p.armL = { fwd: 120 + Math.sin(abs * 30) * 30, out: 30, elbow: 20 }; p.armR = { fwd: 120 + Math.cos(abs * 30) * 30, out: 30, elbow: 20 };
    ch.applyPose(mergePose(p, extra)); ch.setFace(face);
    return p;
  };
  S.push({
    id: '22a', beat: 22, at: t22, look: 'mansionMidnight',
    sfx: [['scream_group', t22 + 0.05, 1.0], ['running_feet', t22 + 0.1, 0.9], ['broom_drop', t22 + 0.35, 0.7]],
    blur: 3,
    frame({ t, abs }) {
      inHall(H(0, 1, -6));
      flicker(abs, 0.4);
      runner(C.witch, H(-0.6, 0, -7.5), H(-0.4, 0, 1.5), abs, t22, t22 + 1.4);
      const b = C.witch.broom; b.visible = true; b.position.set(...H(0.6, 0.06, -7.6 + Math.min(0.3, t * 0.6))); b.rotation.set(0, 0.6, 0);
      runner(C.zombies[0], H(0.8, 0, -9.0), H(0.6, 0, 1.0), abs, t22 + 0.1, t22 + 1.6);
      W.fx.dust.trail((tt) => new THREE.Vector3(...H(-0.6, 0, lerp(-7.5, 1.5, clamp((tt - t22) / 1.4)))), abs, { count: 7, spacing: 0.08 });
      W.cam.set(H(0.2, 1.3, -1.5), H(0, 1.0, -7), 56).shake(abs, 1.3, 75);
    },
  });
  S.push({
    id: '22b', beat: 22, at: t22b, look: 'mansionMidnight',
    sfx: [['zombie_scream', t22b + 0.05, 1.0], ['running_feet', t22b, 0.9]],
    blur: 3,
    frame({ t, abs }) {
      inHall(H(0, 1, -6));
      flicker(abs, 0.4);
      C.zombies.forEach((z, i) => runner(z, H(-1.0 + i, 0, -9.5 - (i % 2) * 0.7), H(-1.0 + i, 0, 0.5), abs, t22b - 0.3 + i * 0.07, t22b + 1.1, 'terrified', { head: { nod: -15 } }));
      W.fx.dust.trail((tt) => new THREE.Vector3(...H(0, 0, lerp(-9.5, 0.5, clamp((tt - t22b + 0.3) / 1.4)))), abs, { count: 8, spacing: 0.07, size: 0.25 });
      W.cam.set(H(0.0, 0.9, -1.0), H(0, 1.0, -6), 58).shake(abs, 1.5, 76);
    },
  });
  S.push({
    id: '22c', beat: 22, at: t22c, look: 'mansionMidnight',
    sfx: [['vampire_scream', t22c + 0.08, 1.0], ['cape_flap', t22c + 0.15, 0.7], ['running_feet', t22c, 0.8]],
    blur: 3,
    frame({ t, abs }) {
      inHall(H(0, 1, -6));
      flicker(abs, 0.4);
      const V = C.vampire;
      const p = runner(V, H(-0.6, 0, -12.5), H(0.9, 0, -2.5), abs, t22c - 0.15, t22c + 1.5, 'terrified');
      // cape thrown over his face
      V.applyPose(mergePose(p, { armL: { fwd: 150, out: 10, elbow: 100 }, armR: { fwd: 150, out: 10, elbow: 100 }, head: { nod: 20 } }));
      V.cape.set({ t: abs, open: 0.2, up: 1.0, flare: 0.8, swoosh: 0.4 });
      W.fx.dust.trail((tt) => new THREE.Vector3(...H(lerp(-0.6, 0.9, clamp((tt - t22c + 0.15) / 1.65)), 0, lerp(-12.5, -2.5, clamp((tt - t22c + 0.15) / 1.65)))), abs, { count: 7, spacing: 0.08 });
      W.cam.set(H(-1.2, 1.25, -0.8), H(0.2, 1.1, -7), 52).shake(abs, 1.2, 77);
    },
  });

  // ---------------- beat 23: NOT SCARED x3 ----------------
  const past1 = T.cut(23, 'Past', 1), past2 = T.cut(23, 'Past', 2), t24 = T.beatCut(24);
  const not1 = T.word(23, 'Not', 1).s, not2 = T.word(23, 'Not', 2).s, not3 = T.word(23, 'Not', 3).s;
  const notLabel = (at, k) => ({ text: 'NOT SCARED', color: 'white', at: at - 0.04, dur: 0.75, tilt: k % 2 ? 4 : -4 });
  S.push({
    id: '23a', beat: 23, at: t23, look: 'mansionMidnight',
    labels: [notLabel(not1, 0)],
    sfx: [['ghost_float', t23 + 0.05, 0.6], ['fog_hiss_soft', t23, 0.4], ['meh', not1 + 0.05, 0.4]],
    frame({ t, abs }) {
      const gp = H(0.0, 0.35, lerp(-3.5, -5.0, smooth(t / 1.6)));
      inHall(gp);
      W.fog.show({ center: H(0, 0.4, -5), size: [4, 0.8, 6] }, abs, { density: 1, color: '#a8ffbf', opacity: 0.16, floor: 1 });
      ghostAt(gp, Math.PI, abs, 'bored', { pupil: [0.4, -0.2] });
      W.cam.set(H(-1.2, 1.1, -7.0), [gp[0], 1.0, gp[2]], 50).shake(abs, 0.4, 78);
    },
  });
  S.push({
    id: '23b', beat: 23, at: past1, look: 'mansionMidnight',
    labels: [notLabel(not2, 1)],
    sfx: [['spider_boing_soft', past1 + 0.25, 0.6], ['meh', not2 + 0.05, 0.4]],
    frame({ t, abs }) {
      const gp = H(0.1, 0.35, lerp(-6.5, -8.0, smooth(t / 1.4)));
      inHall(gp);
      for (const [sp, x, z, len] of [[W.props.spider, -0.5, -7.2, 1.5], [W.props.spider2, 0.7, -7.8, 1.2]]) {
        sp.visible = true; sp.position.set(...H(x, 3.7 - len, z)); sp.setString(len); sp.wiggle(abs, 0.5); sp.rotation.y = Math.sin(abs + x) * 0.5;
      }
      ghostAt(gp, Math.PI, abs, 'bored', { pupil: [-0.5, 0.3] });
      G.arms[1].rotation.z = 0.2 + 0.8 * Math.sin(clamp((t - 0.3) / 0.5) * Math.PI);
      W.cam.set(H(0.9, 1.2, -10.0), [gp[0], 1.3, gp[2]], 52).shake(abs, 0.4, 79);
    },
  });
  S.push({
    id: '23c', beat: 23, at: past2, look: 'mansionMidnight',
    labels: [notLabel(not3, 2)],
    sfx: [['squeak_toy', past2 + 0.3, 0.5], ['meh', not3 + 0.05, 0.4]],
    frame({ t, abs }) {
      const gp = H(0.4, 0.35, lerp(-9.6, -11.0, smooth(t / 1.4)));
      inHall(gp);
      HI().mask.visible = true;
      ghostAt(gp, Math.PI, abs, 'bored', { pupil: [0, -0.8] });
      W.cam.set(H(-1.0, 0.8, -12.6), H(0.5, 0.6, -10.4), 52).shake(abs, 0.4, 80);
    },
  });

  // ---------------- beat 24: around the corner ----------------
  const t24b = T.cut(24, 'and'), t24c = T.cut(24, 'In'), chips = T.word(24, 'chips').s, t25 = T.beatCut(25);
  const larrySpot = H(4.1, 0, -12.2);
  const larryAroundCorner = (abs, face = 'happy', extra = {}) => {
    place(L, larrySpot, H(1.0, 0, -12.2));
    sheetLarry(abs, face, extra);
    L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 } }));
  };
  S.push({
    id: '24a', beat: 24, at: t24, look: 'mansionMidnight',
    sfx: [['ghost_float', t24 + 0.05, 0.6]],
    frame({ t, abs, u }) {
      const k = smooth(u);
      const gp = H(lerp(0.6, 1.6, k), 0.35, lerp(-11.6, -12.2, k));
      inHall(gp);
      ghostAt(gp, lerp(Math.PI, Math.PI / 2, k), abs, 'bored', { pupil: [0.6, 0] });
      W.cam.set(H(-0.9, 1.25, -9.6), [gp[0] + 0.6, 1.0, gp[2]], 50).shake(abs, 0.4, 81);
    },
  });
  S.push({
    id: '24b', beat: 24, at: t24b, look: 'mansionMidnight',
    sfx: [['chips_rustle', t24b + 0.1, 0.6]],
    frame({ t, abs }) {
      const tgt = [larrySpot[0], 0.95, larrySpot[2]];
      inHall(tgt);
      larryAroundCorner(abs, 'peek', { });
      L.sheet.face.set('neutral', { pupil: [-0.7, 0] });
      // over the ghost's shoulder: Larry waiting in the side corridor
      ghostAt(H(1.9, 0.35, -12.2), Math.PI / 2, abs, 'bored');
      W.cam.set(H(1.0, 1.35, -11.6), tgt, 50).push(t * 0.3).shake(abs, 0.4, 82);
    },
  });
  S.push({
    id: '24c', beat: 24, at: t24c, look: 'mansionMidnight',
    sfx: [['bag_crinkle', chips - 0.6, 0.6], ['crunch', chips + 0.03, 1.0], ['crunch_small', chips + 0.33, 0.6]],
    frame({ t, abs }) {
      const eye = new THREE.Vector3(...larrySpot).add(new THREE.Vector3(-0.34, 0.995, -0.11));
      inHall(eye.toArray());
      larryAroundCorner(abs, abs > chips ? 'happy' : 'neutral');
      L.sheet.face.set(abs > chips ? 'happy' : 'neutral', { pupil: [-0.6, 0] });
      // hand pushes a chip through the eye hole
      const hand = W.props.larryHand; hand.visible = true;
      const reach = smooth(clamp((abs - (chips - 0.6)) / 0.5));
      const start = new THREE.Vector3(...larrySpot).add(new THREE.Vector3(-0.55, 0.45, 0.25));
      const end = eye.clone().add(new THREE.Vector3(-0.1, -0.08, 0.06));
      hand.position.lerpVectors(start, end, reach);
      if (abs > chips) hand.position.y -= easeOutCubic(clamp((abs - chips) / 0.35)) * 0.25;
      hand.rotation.set(-0.3, -Math.PI / 2, 0.3 - 0.2 * reach);
      const chip = W.props.chip; chip.visible = abs < chips; chip.scale.setScalar(1.3);
      chip.position.copy(hand.position).add(new THREE.Vector3(0, 0.085, 0)).lerp(eye, smooth(clamp((abs - (chips - 0.12)) / 0.12)));
      W.fx.crumbs.show(eye.toArray(), abs - chips);
      W.cam.set(H(2.95, 1.05, -12.1), [eye.x + 0.2, 0.9, eye.z], 42).shake(abs, 0.4, 83).dof(eye.toArray(), 0.004, 0.008);
    },
  });
  // one second of silence: the ghost just stares
  S.push({
    id: '24d', beat: 24, at: chips + 0.38, look: 'mansionMidnight',
    sfx: [],
    frame({ t, abs }) {
      const gp = H(1.9, 0.35, -12.2);
      inHall(gp);
      ghostAt(gp, Math.PI / 2, abs, 'neutral', { eyes: 'open', mouth: 'flat', pupil: [0, 0], lid: t > 0.55 && t < 0.62 ? 1 : 0 }, { tailSwish: 0.2, armWave: 0 });
      G.position.y = 0.35;
      const f = [gp[0], 1.05, gp[2]];
      W.cam.set(H(3.4, 1.1, -12.0), f, 40).push(t * 0.08).dof(f, 0.004, 0.008);
    },
  });

  // ---------------- beat 25: the ghost screams and flies through the roof ----------------
  const screams = T.word(25, 'screams').s, t25b = T.cut(25, 'and'), t25c = T.cut(25, 'roof'), t26 = T.beatCut(26);
  W.music.stingAt = screams - 0.05; W.music.resumeAt = screams - 0.05;
  S.push({
    id: '25a', beat: 25, at: t25, look: 'mansionMidnight',
    labels: [{ text: 'GHOST: SCARED', color: 'red', at: screams - 0.04, dur: 1.4 }],
    sfx: [['ghost_scream', screams - 0.05, 1.0]],
    frame({ t, abs }) {
      const gp = H(1.9, 0.35, -12.2);
      inHall(gp);
      const k = abs - screams + 0.08;
      ghostAt(gp, Math.PI / 2, abs, k > 0 ? 'terrified' : 'neutral', k > 0 ? { pupilScale: 0.3 } : { eyes: 'open', mouth: 'flat' }, { armUp: k > 0 ? 1 : 0, stretch: k > 0 ? 1 + 0.18 * Math.min(1, k * 6) : 1, tailSwish: 2 });
      G.position.x += k > 0 ? Math.sin(abs * 80) * 0.012 : 0;
      const f = [gp[0], 1.05, gp[2]];
      W.cam.set(H(3.3, 1.1, -12.0), f, 44).shake(abs, k > 0 ? 2.2 : 0.3, 84);
    },
  });
  S.push({
    id: '25b', beat: 25, at: t25b, look: 'mansionMidnight',
    sfx: [['zoom_up', t25b + 0.05, 1.0], ['ceiling_crash', t25b + 0.32, 1.0]],
    blur: 4,
    frame({ t, abs }) {
      const gp = H(1.9, 0.35, -12.2);
      inHall(gp);
      const up = Math.max(0, t - 0.08) ** 2 * 30;
      ghostAt([gp[0], gp[1] + up, gp[2]], Math.PI / 2, abs, 'screaming', {}, { armUp: 1, stretch: 1.5, tailSwish: 3 });
      HI().ceilHole.visible = t > 0.3;
      if (t > 0.3) { W.fx.puffs.pop(H(1.9, 3.6, -12.2), t - 0.3, { radius: 1.3, count: 10, size: 0.4, life: 0.8, seed: 9, color: '#b8a8c8' }); W.fx.crumbs.show(H(1.9, 3.6, -12.2), t - 0.3); }
      W.cam.set(H(1.2, 0.45, -10.4), H(1.9, 3.2, -12.2), 68).shake(abs, 1.8, 85);
    },
  });
  S.push({
    id: '25c', beat: 25, at: t25c, look: 'night',
    sfx: [['roof_crash', t25c + 0.05, 1.0], ['debris', t25c + 0.15, 0.7], ['ghost_scream_far', t25c + 0.1, 0.6]],
    blur: 3,
    frame({ t, abs }) {
      const e = estate('night');
      const hole = e.mansion.userData.hole; hole.visible = true;
      hole.updateWorldMatrix(true, false);
      const hp = new THREE.Vector3().setFromMatrixPosition(hole.matrixWorld);
      // the ghost bursts out of the roof and zooms toward the moon
      const k = Math.max(0, t - 0.02);
      ghostAt([hp.x, hp.y - 0.3 + k * k * 40 + k * 8, hp.z + k * 3], 0, abs, 'screaming', {}, { armUp: 1, stretch: 1.6 });
      G.scale.setScalar(1.6);
      W.fx.puffs.pop(hp.toArray(), t, { radius: 2.2, count: 14, size: 0.7, life: 1.0, seed: 10 });
      W.cam.set([M[0] - 3, 6, M[2] + 22], [hp.x, hp.y + 2.5, hp.z], 50).shake(abs, 1.4, 86);
      W.shadow([M[0], 0, M[2]], 20);
    },
  });

  // ---------------- beat 26: ten million dollars... and the loop ----------------
  const ten = T.word(26, 'ten').s, t26b = T.cut(26, 'and'), t26c = T.cut(26, 'of');
  S.push({
    id: '26a', beat: 26, at: t26, look: 'night',
    labels: [{ text: '$10,000,000', color: 'yellow', at: ten - 0.04, dur: 1.5 }],
    sfx: [['cha_ching', ten + 0.05, 1.0], ['wind_spooky', t26, 0.4]],
    frame({ t, abs, u }) {
      const e = estate('night');
      e.mansion.userData.hole.visible = true;
      e.searchlights.forEach((s, i) => { s.visible = true; s.userData.pivot.rotation.set(Math.sin(abs * 0.9 + i * 2.1) * 0.5, 0, Math.cos(abs * 0.7 + i) * 0.45); });
      e.mansion.userData.hole.updateWorldMatrix(true, false);
      const hp = new THREE.Vector3().setFromMatrixPosition(e.mansion.userData.hole.matrixWorld);
      W.cam.set([M[0] - 3, 3.0, -8.0], [hp.x, hp.y - 4, hp.z], 56).push(u * 2.0).shake(abs, 0.4, 87);
      W.shadow([M[0], 0, M[2] + 6], 24);
    },
  });
  S.push({
    id: '26b', beat: 26, at: t26b, look: 'night',
    sfx: [['shrug', t26b + 0.15, 0.4], ['bag_crinkle', t26b + 0.6, 0.6], ['crunch', t26b + 1.15, 0.7]],
    frame({ t, abs }) {
      const e = estate('night');
      e.mansion.userData.hole.visible = true;
      const lp = shedXZ(W, 0.35, 2.4), jp = shedXZ(W, -0.75, 2.6);
      place(L, lp, shedXZ(W, -0.3, 6)); place(J, jp, shedXZ(W, 0.2, 6)); L.rotation.y -= 0.35; J.rotation.y += 0.3;
      const shrug = Math.sin(clamp(t / 0.6) * Math.PI);
      const offer = smooth(clamp((t - 0.55) / 0.3));
      L.applyPose(P({ armL: { fwd: 30 + 50 * offer, out: 25 + 20 * shrug, elbow: 50 - 40 * offer }, armR: { fwd: 20, out: 40 * shrug + 10, elbow: 70 * shrug }, y: 0.03 * shrug }));
      sheetLarry(abs, 'happy', { wingL: 0.4 + 0.3 * offer, wingR: 0.5 * shrug, wingY: 0.85 });
      J.applyPose(P({ armR: { fwd: 45 * offer, out: 15, elbow: 40 * offer }, head: { tilt: 8 } }));
      J.setFace(offer > 0.5 ? 'smug' : 'flat', { mouth: offer > 0.5 ? 'smile' : 'flat' }, abs);
      const mid = [(lp[0] + jp[0]) / 2, 1.0, (lp[2] + jp[2]) / 2];
      W.cam.set(shedXZ(W, -0.2, 5.6, 1.25), mid, 48).push(t * 0.2).shake(abs, 0.4, 88);
      W.shadow(mid, 4);
    },
  });
  // the very last shot: framed exactly like the first one (the little shed with the $1 sign)
  S.push({
    id: '26c', beat: 26, at: t26c, look: 'night',
    sfx: [['crickets', t26c, 0.4]],
    frame({ t, abs }) {
      const e = estate('night');
      e.mansion.userData.hole.visible = true;
      const m = mainCam(W);
      W.cam.set(m.pos, m.target, m.fov).shake(abs, 0.5, 11);
      place(L, shedXZ(W, 0, 1.75), null, -0.32); sheetLarry(abs, 'happy');
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 } }));
      W.shadow([2.5, 0, -6], 14);
    },
  });
  return S;
}
