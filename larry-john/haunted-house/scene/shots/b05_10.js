// Beats 5-10: lights off, BONK, green lights, fog machine, spiders, skeletons, creaky doors, the scream.
import * as THREE from 'three';
import { P, pose, place, walk, hop, popScale, smooth, clamp, lerp, track, easeOutBack, spring, wobble, mergePose, blendPose, facepalm } from '../acting.js';
import { easeInOut, easeOutCubic, easeInCubic, easeInBack } from '../../../engine/toon/anim.js';
import { shedXZ } from './b01_04.js';

export function shots05_10(T, W) {
  const C = W.cast, L = C.larry, J = C.john, S = [];
  const O = W.SHED_IN.origin;
  const IN = (x, y, z) => [O[0] + x, O[1] + y, O[2] + z];
  const room = () => W.sets.shedInside.userData;
  const inside = (lightsOn = false) => {
    W.show('shedInside');
    W.shadow(IN(0, 0, 0), 3.5);
    const R = room();
    R.bulb.light.intensity = lightsOn ? 2.2 : 0; R.bulb.glass.material.emissiveIntensity = lightsOn ? 3 : 0.15;
    R.lightSwitch.set(lightsOn);
    // walls between the camera and the room are cut away (classic set trick)
    W.after.unshift(() => {
      const c = W.stage.camera.position, hw = W.SHED_IN.W / 2, hd = W.SHED_IN.D / 2;
      if (c.z > O[2] + hd - 0.05) R.walls.front.visible = false;
      if (c.z < O[2] - hd + 0.05) R.walls.back.visible = false;
      if (c.x > O[0] + hw - 0.05) R.walls.right.visible = false;
      if (c.x < O[0] - hw + 0.05) R.walls.left.visible = false;
    });
    return R;
  };
  const sheetLarry = (t, face = 'neutral', extra = {}) => {
    L.setSheet(true);
    L.sheet.set({ drape: 1, sway: t * 3, ...extra });
    L.sheet.face.set(face, { mouthPush: extra.mouthPush || 0 });
  };
  const eyesGlow = (k) => { L.sheet.mat.userData.faceUniforms.faceGlow.value = k; };
  const fogBox = { center: IN(0, 1.0, 0), size: [4.0, 2.0, 3.4] };

  // ---------------- beat 5 ----------------
  const lights5 = T.word(5, 'lights').s;
  const t5b = lights5 + 0.12;
  S.push({
    id: '5a', beat: 5, at: T.beatCut(5), look: 'shedGreen',
    sfx: [['switch_click', lights5 + 0.02, 1.0], ['power_down', lights5 + 0.05, 0.6]],
    frame({ t, d, abs }) {
      const on = abs < lights5;
      const R = inside(on);
      W.look(on ? 'shedGreen' : 'shedDark');
      // John at the switch, deadpan, flicks it with one finger
      place(J, IN(0.45, 0, 1.42), IN(0.3, 0, -1));
      const reach = smooth(clamp((abs - (lights5 - 0.55)) / 0.35));
      const flick = abs > lights5 - 0.06 ? 1 : 0;
      J.applyPose(P({ armR: { fwd: lerp(10, 20, reach), out: lerp(10, 78, reach), elbow: lerp(10, 25, reach) }, head: { turn: 0, nod: 4 } }));
      J.setHand('R', 'point');
      J.setFace('smug', { mouth: 'flat' }, t);
      R.lightSwitch.set(!flick);
      W.cam.set(IN(0.15, 1.35, -0.45), IN(0.55, 1.22, 1.42), 50).push(clamp(t / d) * 0.25).shake(t, 0.4, 21);
      place(L, IN(-0.4, 0, -0.2), IN(0, 0, 1.6)); sheetLarry(t, 'happy');
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 } }));
    },
  });
  // darkness: only the two eye holes show
  S.push({
    id: '5b', beat: 5, at: t5b, look: 'shedDark',
    sfx: [['dark_hum', t5b, 0.4]],
    frame({ t }) {
      const R = inside(false);
      R.moonSpot.intensity = 0.0;
      W.look('shedDark');
      W.stage.hemi.intensity = 0.04; W.stage.fill.intensity = 0.02; W.stage.rim.intensity = 0.05; W.stage.sun.intensity = 0.0;
      place(L, IN(-0.4, 0, -0.2), IN(0, 0, 1.6)); sheetLarry(t, 'neutral');
      L.sheet.face.set('neutral', { lid: [0.55, 0.62].some((b) => Math.abs(t - b) < 0.05) ? 1 : 0, pupil: [Math.sin(t * 2.5) * 0.6, 0] });
      eyesGlow(0.75);
      W.stage.bloom.threshold = 0.95; W.stage.bloom.strength = 0.25;
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 } }));
      W.cam.set(IN(-0.38, 1.0, 0.95), IN(-0.4, 0.97, -0.2), 40).push(t * 0.04);
    },
  });

  // ---------------- beat 6 ----------------
  const t6a = T.cut(6, 'Larry'), wall = T.word(6, 'wall').s, t6b = T.cut(6, 'He');
  const john6 = T.word(6, 'JOHN!');
  const t6c = john6.e - 0.12, t7 = t6c + 0.55;
  S.push({
    id: '6a', beat: 6, at: t6a, look: 'shedDark',
    sfx: [['footsteps_soft', t6a + 0.1, 0.5], ['bonk', wall + 0.0, 1.0], ['tweet_birds', wall + 0.15, 0.6]],
    blur: (t) => (Math.abs(t - (wall - t6a)) < 0.12 ? 4 : 0),
    frame({ t, d, abs }) {
      const R = inside(false);
      W.look('shedDark');
      R.walls.right.visible = false;
      eyesGlow(0.5);
      R.moonSpot.intensity = 7;
      const hitT = wall - 0.02;
      const a = IN(0.6, 0, 0.1), b = IN(-1.62, 0, 0.1);
      let lp;
      if (abs < hitT) lp = walk(L, a, b, abs, t6a - 0.25, hitT, { stride: 0.22 });
      else { place(L, b, IN(-3, 0, 0.1)); lp = P({ y: 0 }); }
      const after = abs - hitT;
      lp.armL = { fwd: 80, out: 15, elbow: 10 }; lp.armR = { fwd: 80, out: 15, elbow: 10 };
      if (after > 0) {
        const squash = 1 - 0.22 * Math.exp(-after * 9) * Math.cos(after * 30);
        lp.squash = squash; lp.lean = -6 * Math.exp(-after * 3);
        L.position.x += 0.07 * easeOutCubic(clamp(after / 0.2)) - 0.0;
      }
      L.applyPose(lp);
      sheetLarry(t, after > 0 ? 'dizzy' : 'neutral', { wingL: 0.55, wingR: 0.55, wingY: 0.85, swing: after > 0 ? wobble(after, 3, 4) * 0.4 : 0 });
      if (after > 0) W.fx.stars.show([L.position.x, 1.42, L.position.z], after, 0.3);
      W.cam.set(IN(-0.1, 1.15, 2.9), IN(-0.9, 0.95, 0.0), 50).shake(abs, after > 0 && after < 0.4 ? 3 : 0.5, 22);
    },
  });
  S.push({
    id: '6b', beat: 6, at: t6b, look: 'shedDark',
    sfx: [],
    frame({ t, abs }) {
      const R = inside(false);
      W.look('shedDark');
      eyesGlow(0.45);
      R.moonSpot.intensity = 7;
      const p = IN(-1.55, 0, 0.1);
      place(L, p, IN(0.5, 0, 1.2));
      const yell = clamp((abs - john6.s + 0.05) / 0.08) * (1 - clamp((abs - john6.e) / 0.25));
      sheetLarry(t, yell > 0.2 ? 'yell' : 'dizzy', { mouthPush: yell * 1.15, wingL: 0.35 + yell * 0.4, wingR: 0.35 + yell * 0.4, wingY: 0.8 });
      L.applyPose(P({ squash: 1 + yell * 0.06, spine: { fwd: -6 * yell }, head: { nod: -8 * yell } }));
      W.fx.stars.show([p[0], 1.42, p[2]], abs - (wall - 0.02), 0.3);
      W.cam.set(IN(-0.75, 1.0, 1.3), IN(-1.55, 0.98, 0.1), 46).shake(abs, 0.6 + yell * 2.5, 23);
    },
  });
  // John facepalm (half a second)
  S.push({
    id: '6c', beat: 6, at: t6c, look: 'shedDark',
    sfx: [['facepalm_slap', t6c + 0.12, 0.8]],
    frame({ t }) {
      const R = inside(false);
      W.look('shedDark');
      // dark shed, but John's tired face must read: a strong cool fill from the camera side
      W.stage.fill.intensity = 2.0; W.stage.hemi.intensity = 1.6;
      R.moonSpot.intensity = 9;
      place(J, IN(0.5, 0, 1.2), IN(0.2, 0, 0));
      facepalm(J, t, { start: 0.0 });
      W.cam.set(IN(0.25, 1.35, -0.1), IN(0.5, 1.2, 1.2), 44).shake(t, 0.4, 24).dof(IN(0.5, 1.22, 1.2), 0.004, 0.008);
    },
  });

  // ---------------- beat 7 ----------------
  const clicks = [T.word(7, 'creepy').s, T.word(7, 'green').s, T.word(7, 'lights').s];
  const t7b = T.cut(7, 'and'), fogW = T.word(7, 'fog').s, machine = T.word(7, 'machine').s;
  S.push({
    id: '7a', beat: 7, at: t7, look: 'shedDark',
    sfx: clicks.map((c, i) => ['spot_click', c, 0.9 - i * 0.05]).concat([['spooky_hum', clicks[0], 0.4]]),
    frame({ t, abs }) {
      const R = inside(false);
      const on = clicks.map((c) => clamp((abs - c) / 0.06));
      W.look('shedDark', 'shedGreen', Math.max(...on));
      R.walls.front.visible = false;
      R.spots.forEach((s, i) => s.setOn(on[i] * (1 - 0.15 * Math.max(0, Math.sin(abs * 60 + i)) * (1 - clamp((abs - clicks[i]) / 0.3)))));
      eyesGlow(0.6);
      place(L, IN(-0.1, 0, -0.1), IN(0, 0, 3));
      sheetLarry(t, on[2] > 0.5 ? 'happy' : 'neutral', { wingL: 0.3, wingR: 0.3 });
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 }, head: { turn: on[2] > 0 ? 0 : on[1] > 0 ? 20 : on[0] > 0 ? -20 : 0 } }));
      place(J, IN(1.3, 0, 1.0), IN(0, 0, 0));
      J.applyPose(pose('stand', { armR: { fwd: 40, out: 10, elbow: 70 } })); J.setFace('proud', {}, t);
      W.cam.set(IN(0.3, 1.5, 3.6), IN(-0.1, 1.05, -0.2), 55).push(t * 0.15).shake(t, 0.4, 25);
    },
  });
  // exterior at dusk: John rolls the fog machine in, PUFF, fog billows out of the door
  S.push({
    id: '7b', beat: 7, at: t7b, look: 'dusk',
    labels: [{ text: 'FOG MACHINE', color: 'yellow', at: fogW - 0.05, dur: 1.2 }],
    sfx: [['wheels_roll', t7b + 0.05, 0.7], ['fog_hiss', machine + 0.02, 1.0], ['fog_puff', machine + 0.02, 0.9]],
    frame({ t, abs }) {
      W.show('backyard');
      W.look('dusk');
      const sh = W.sets.backyard.userData.shed;
      sh.userData.door.rotation.y = 1.75;
      W.shadow(shedXZ(W, 0, 1.6), 5);
      // John pushes the machine to the door
      const push = smooth(clamp(t / 0.45));
      const m = W.props.fogMachine; m.visible = true;
      const mp = new THREE.Vector3(...shedXZ(W, 0.0, lerp(3.0, 1.9, push)));
      m.position.copy(mp); m.rotation.y = W.LAYOUT.shed.rotY + Math.PI / 2;
      const jp = walk(J, shedXZ(W, 0.05, 3.85), shedXZ(W, 0.05, 2.75), t, 0.0, 0.45, { stride: 0.3, extra: {} });
      jp.armL = { fwd: 65, out: 10, elbow: 40 }; jp.armR = { fwd: 65, out: 10, elbow: 40 };
      J.applyPose(jp); J.setFace('proud', {}, t);
      // fog billows from the door after the puff
      const f = clamp((abs - machine) / 0.6);
      if (abs > machine - 0.05) {
        const door = shedXZ(W, 0, 1.4);
        const dd = shedXZ(W, 0, 1.4 + 1.2 * f);
        W.fog.show({ center: [dd[0], 0.65, dd[2]], size: [1.2 + 2.2 * f, 1.1, 0.8 + 2.0 * f] }, abs, { density: 0.15 + 0.4 * f, grow: 0.5 + 0.6 * f, color: '#b8ffcc', opacity: 0.38, minS: 0.5, maxS: 1.3 });
        J.setFace('shocked', {}, t);
      }
      W.cam.set(shedXZ(W, -1.6, 6.4, 1.3), shedXZ(W, 0.1, 1.8, 1.05), 52).shake(t, abs > machine ? 1.2 : 0.5, 26);
    },
  });

  // ---------------- beat 8 ----------------
  const t8 = T.beatCut(8), t8b = T.cut(8, 'For'), three = T.word(8, 'three').s;
  S.push({
    id: '8a', beat: 8, at: t8, look: 'shedGreen',
    sfx: [['fog_hiss_soft', t8, 0.5], ['bump_wood', t8 + 0.55, 0.8], ['bucket_clang', t8 + 0.6, 0.6], ['ghost_whisper', t8 + 0.7, 0.25]],
    frame({ t, d, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      R.walls.front.visible = false;
      eyesGlow(0.5);
      // Larry wanders with arms out, bumps into the workbench
      const path = new THREE.CatmullRomCurve3([new THREE.Vector3(...IN(-0.8, 0, 0.6)), new THREE.Vector3(...IN(0.4, 0, 0.9)), new THREE.Vector3(...IN(1.3, 0, 0.5))]);
      const u = clamp(t / 0.6);
      const p = path.getPoint(easeInOut(u));
      const ahead = path.getPoint(Math.min(1, easeInOut(u) + 0.05));
      place(L, p.toArray(), ahead.toArray());
      const bumped = t > 0.6;
      const lp = mergePose(P({ armL: { fwd: 85, out: 15, elbow: 5 }, armR: { fwd: 85, out: 15, elbow: 5 } }), bumped ? { squash: 1 - 0.12 * Math.exp(-(t - 0.6) * 8), lean: 5 * wobble(t - 0.6, 3, 5) } : mergePose(P(), Character_walk(t)));
      L.applyPose(lp);
      sheetLarry(t, bumped ? 'scared' : 'worried', { wingL: 0.6, wingR: 0.6, wingY: 0.85, sway: t * 4 });
      W.fog.show(fogBox, abs, { density: 0.55, grow: 1.0, color: '#9effb4', opacity: 0.13, minS: 0.8, maxS: 1.8 });
      // the hidden ghost: a faint face in the fog for half a second
      const gt = t - 0.65;
      if (gt > 0 && gt < 0.55) {
        const g = C.ghostCameo; g.visible = true;
        g.position.set(...IN(-0.7, 0.75, -0.9)); g.scale.setScalar(0.85); g.rotation.y = 0.35;
        g.mat.opacity = 0.22 * Math.sin((gt / 0.55) * Math.PI);
        g.set({ t: abs, armWave: 0 });
        g.face.set('neutral', { eyes: 'open', mouth: 'O', mouthOpen: 0.3 });
      }
      W.cam.set(IN(0.2, 1.45, 3.4), IN(0.3, 0.95, 0.4), 52).shake(t, bumped ? 1.4 : 0.6, 27);
    },
  });
  S.push({
    id: '8b', beat: 8, at: t8b, look: 'shedGreen',
    labels: [{ text: '3 HOURS LATER', color: 'white', at: three - 0.06, dur: 1.15 }],
    sfx: [['clock_spin', t8b + 0.02, 0.9]],
    blur: 3,
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const spin = easeInOut(clamp(t / 0.85));
      R.clock.setTime(9 + spin * 3);
      W.fog.show(fogBox, abs, { density: 0.4, grow: 1.0, color: '#9effb4', opacity: 0.1 });
      const c = IN(-0.9, 1.85, -1.73);
      W.cam.set(IN(-0.75, 1.75, -0.55), c, 44).push(t * 0.15).shake(t, 0.4, 28).dof(c, 0.004, 0.008);
    },
  });

  // ---------------- beat 9 ----------------
  const t9 = T.beatCut(9), spiders = T.word(9, 'spiders').s, t9b = T.cut(9, 'skeletons'), skeletons = T.word(9, 'skeletons').s;
  const t9c = T.cut(9, 'creaky'), creaky = T.word(9, 'creaky').s;
  S.push({
    id: '9a', beat: 9, at: t9, look: 'shedGreen',
    sfx: [['boing', spiders - 0.05, 1.0], ['string_zip', spiders - 0.2, 0.5]],
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const sp = W.props.spider; sp.visible = true;
      const drop = abs - (spiders - 0.22);
      const len = drop < 0 ? 0.1 : 0.1 + Math.min(1, drop / 0.22) * 1.25 - wobble(drop - 0.22, 2.2, 3.5) * 0.25;
      sp.position.set(...IN(0.9, 2.62 - len, -0.9));
      sp.setString(len);
      sp.wiggle(abs, 1);
      sp.rotation.y = Math.sin(abs * 1.5) * 0.4;
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      W.cam.set(IN(0.55, 1.35, 0.45), IN(0.9, 1.35, -0.9), 50).shake(t, 0.5, 29);
    },
  });
  S.push({
    id: '9b', beat: 9, at: t9b, look: 'shedGreen',
    sfx: [['crate_bang', skeletons - 0.02, 0.9], ['spring_boing', skeletons, 0.7], ['bone_rattle', skeletons + 0.08, 1.0]],
    blur: (t) => (t < 0.35 ? 4 : 0),
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const box = R.skeletonBox.userData;
      const k = abs - (skeletons - 0.06);
      if (k > 0) {
        box.lid.rotation.x = -Math.min(2.2, k * 14) + wobble(k - 0.15, 4, 6) * 0.2;
        box.skel.visible = true;
        const ext = Math.min(1, k / 0.12);
        box.spring.position.y = 0.4 + ext * 0.35 + wobble(k - 0.12, 3.5, 4) * 0.18;
        box.spring.scale.y = 0.2 + ext * 0.8;
        box.skel.rotation.z = wobble(k, 2.5, 3) * 0.5;
        box.userData && 0;
        R.skeletonBox.userData.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.9 + Math.sin(k * 25) * 0.4); });
      }
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      W.cam.set(IN(-0.75, 0.95, 0.6), IN(-1.2, 0.85, -1.25), 52).shake(t, k > 0 && k < 0.3 ? 2 : 0.5, 30);
    },
  });
  S.push({
    id: '9c', beat: 9, at: t9c, look: 'shedGreen',
    sfx: [['door_creak', creaky - 0.08, 1.0]],
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      R.closetDoor.rotation.y = -1.5 * easeInOut(clamp((abs - creaky + 0.1) / 0.9));
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      W.cam.set(IN(-0.3, 1.35, 2.7), IN(-2.0, 1.0, 0.85), 54).push(t * 0.25).shake(t, 0.4, 31);
    },
  });

  // ---------------- beat 10 ----------------
  const t10 = T.beatCut(10), t10b = T.cut(10, 'screams'), screams = T.word(10, 'screams').s, t10c = T.cut(10, 'Bro');
  const your = T.word(10, 'YOUR').s;
  const t11 = T.beatCut(11);
  S.push({
    id: '10a', beat: 10, at: t10, look: 'shedGreen',
    sfx: [['spider_dangle', t10 + 0.1, 0.5], ['gulp', t10 + 0.75, 0.8]],
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const p = IN(0.6, 0, 0.0);
      place(L, p, IN(0.6, 0, 3));
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 }, spine: { fwd: -4 } }));
      const scared = t > 0.7;
      sheetLarry(t, scared ? 'terrified' : 'shocked', { wingL: 0.2, wingR: 0.2 });
      L.sheet.face.set(scared ? 'terrified' : 'shocked', { pupil: [0, 0], pupilScale: 0.4 });
      const sp = W.props.spider; sp.visible = true;
      sp.position.set(p[0] + 0.0, 0.98, p[2] + 0.48); sp.setString(1.6); sp.wiggle(abs, 0.6);
      sp.rotation.y = Math.PI + Math.sin(abs * 1.3) * 0.15;
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      const mid = new THREE.Vector3(p[0], 0.98, p[2] + 0.25);
      W.cam.set([p[0] + 1.75, 1.15, p[2] + 0.35], mid, 50).push(t * 0.25).shake(t, 0.5, 32).dof(mid, 0.004, 0.008);
    },
  });
  S.push({
    id: '10b', beat: 10, at: t10b, look: 'shedGreen',
    sfx: [['larry_scream', screams - 0.03, 1.0], ['cartoon_zip', screams + 0.25, 0.7], ['catch_thump', screams + 0.6, 0.8]],
    blur: (t) => (t > 0.15 && t < 0.7 ? 5 : 0),
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const k = abs - screams;
      // Larry leaps from his spot into John's arms (arc), John catches
      const a = new THREE.Vector3(...IN(0.6, 0, 0.0)), b = new THREE.Vector3(...IN(1.25, 0.62, 0.95));
      const u = clamp((k - 0.18) / 0.4);
      const pos = a.clone().lerp(b, easeInOut(u)); pos.y += Math.sin(u * Math.PI) * 0.65;
      place(L, pos.toArray(), IN(0.2, 0, 3));
      L.rotation.z = u > 0 ? -0.5 * smooth(u) : 0;
      const stretch = k > 0.12 && k < 0.6 ? 1.18 : 1;
      L.applyPose(P({ squash: k < 0.12 && k > 0 ? 0.82 : stretch, legL: { fwd: 70 * smooth(u), knee: 80 * smooth(u) }, legR: { fwd: 60 * smooth(u), knee: 70 * smooth(u) } }));
      const yell = k > -0.05 ? 1 : 0;
      sheetLarry(t, yell ? 'screaming' : 'terrified', { mouthPush: yell * 1.25 * (0.85 + 0.15 * Math.sin(abs * 40)), wingL: 0.8, wingR: 0.8, wingY: 0.95 });
      place(J, IN(1.45, 0, 1.25), IN(0.6, 0, 0.0));
      const catchK = smooth(clamp((k - 0.45) / 0.15));
      J.applyPose(blendPose(pose('stand'), P({ armL: { fwd: 75, out: 20, elbow: 70 }, armR: { fwd: 75, out: 20, elbow: 70 }, squash: 1 - 0.06 * wobble(k - 0.58, 3, 6) }), catchK));
      J.setFace(catchK > 0.5 ? 'flat' : 'shocked', {}, t);
      const sp = W.props.spider; sp.visible = true;
      sp.position.set(...IN(0.6, 0.98, 0.48)); sp.setString(1.6); sp.wiggle(abs, 1);
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      W.cam.set(IN(-1.3, 1.35, 2.3), IN(1.0, 1.0, 0.6), 60).shake(abs, k > 0 && k < 0.8 ? 2.5 : 0.6, 33);
    },
  });
  S.push({
    id: '10c', beat: 10, at: t10c, look: 'shedGreen',
    sfx: [['facepalm_slap', your - 0.12, 0.8], ['larry_whimper', t10c + 0.1, 0.5]],
    frame({ t, abs }) {
      const R = inside(false);
      R.spots.forEach((s) => s.setOn(1));
      const jpos = IN(1.2, 0, 1.0);
      place(J, jpos, IN(0.4, 0, -0.6));
      // Larry lies across John's arms (Scooby-Doo style), shaking; John's flat face, then a facepalm
      const palm = abs > your - 0.22;
      const hold = { armL: { fwd: 58, out: 14, elbow: 72 }, armR: { fwd: 58, out: 14, elbow: 72 } };
      if (palm) { facepalm(J, abs - (your - 0.22)); J.joints.shL.rotation.set(-1.01, 0, 0.24, 'ZXY'); J.joints.elL.rotation.set(-1.26, 0, 0); }
      else { J.applyPose(P(hold)); J.setFace('flat', { pupil: [0, 0] }, t); }
      J.updateMatrixWorld(true);
      const f = new THREE.Vector3(0, 0, 1).applyQuaternion(J.quaternion), left = new THREE.Vector3(1, 0, 0).applyQuaternion(J.quaternion);
      const lp = new THREE.Vector3(...jpos).addScaledVector(f, 0.42).addScaledVector(left, -0.6); lp.y = 0.62;
      L.visible = true; L.position.copy(lp);
      L.rotation.set(0, J.rotation.y, -1.38 + Math.sin(abs * 45) * 0.025);
      L.applyPose(P({ legL: { fwd: 70, knee: 80 }, legR: { fwd: 62, knee: 85 }, squash: 0.97 }));
      sheetLarry(t, 'scared', { wingL: 0.3, wingR: 0.3, wingY: 0.9, sway: abs * 6 });
      L.sheet.face.set('scared', { pupil: [0.5, -0.3], pupilScale: 0.6 });
      W.fog.show({ center: IN(0, 0.4, 0), size: [4, 0.8, 3.4] }, abs, { density: 0.5, color: '#9effb4', opacity: 0.12, floor: 1 });
      // from a little above, so John's tired face (and the facepalm) reads over the sheet in his arms
      const mid = new THREE.Vector3(...jpos).addScaledVector(f, 0.2).addScaledVector(left, 0.1).setY(1.12);
      const cpos = mid.clone().addScaledVector(f, 2.4).add(new THREE.Vector3(0, 0.85, 0));
      W.cam.set(cpos, mid, 50).push(t * 0.15).shake(t, 0.4, 34).dof(mid, 0.004, 0.008);
    },
  });
  return S;
}

// small helper: a walk cycle in place (used while bumping around in the fog)
import { Character } from '../../../engine/toon/rig.js';
function Character_walk(t) { return Character.walk(t * 1.6, 1); }
