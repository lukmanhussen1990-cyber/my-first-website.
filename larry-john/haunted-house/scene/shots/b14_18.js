// Beats 14-18: actors, the zombie selfie, the chicken exit, Larry's 2-second visit, the graveyard,
// bats over the moon, the giant iron gate and the sheet that gets stuck. Twice.
import * as THREE from 'three';
import { P, pose, place, walk, hop, popScale, smooth, clamp, lerp, track, easeOutBack, spring, wobble, mergePose, blendPose, facepalm } from '../acting.js';
import { easeInOut, easeOutCubic, easeInCubic } from '../../../engine/toon/anim.js';
import { Character } from '../../../engine/toon/rig.js';
import { cloth, PAL } from '../../../engine/toon/materials.js';
import { cutaway, hall } from './b11_13.js';

export function shots14_18(T, W) {
  const C = W.cast, L = C.larry, J = C.john, S = [];
  const H = hall(W);
  const HI = () => W.sets.interior.userData;
  const E = () => W.sets.estate.userData;
  const M = W.MANSION.pos;
  const inHall = (target) => { W.show('interior'); W.shadow(H(0, 0, -5), 9); cutaway(W, HI().walls, target); };
  const estate = (look = 'night') => {
    W.show('backyard', 'estate');
    const e = E(); e.mansion.visible = true; e.graveyard.visible = true; e.gate.visible = true; e.showFence(true);
    W.sets.backyard.userData.estateMode(true);
    W.look(look);
    W.moonAt([M[0] + 30, 75, M[2] - 260], 30);
    return e;
  };
  const sheetLarry = (t, face = 'happy', extra = {}) => { L.setSheet(true); L.sheet.set({ drape: 1, sway: t * 3, ...extra }); L.sheet.face.set(face, { mouthPush: extra.mouthPush || 0 }); };
  const zombieShuffle = (z, t, i, from, to, t0, t1) => {
    const p = walk(z, from, to, t, t0, t1, { stride: 0.16 });
    p.armL = { fwd: 85 + Math.sin(t * 3 + i) * 6, out: 6, elbow: 8 }; p.armR = { fwd: 82 + Math.cos(t * 3 + i) * 6, out: 6, elbow: 10 };
    p.head = { ...p.head, tilt: 14 * Math.sin(t * 2 + i), nod: 8 };
    p.lean = Math.sin(t * 4 + i) * 4;
    z.applyPose(p); z.setFace('tongue', {}, t + i);
  };
  // witch on a broom hung on a wire from the ceiling
  const witchOnBroom = (pos, t, swing = 1) => {
    const w = C.witch, b = w.broom;
    b.visible = true;
    const sw = Math.sin(t * 2.6) * 0.25 * swing;
    b.position.set(pos[0] + Math.sin(sw) * 0.6, pos[1] + Math.cos(t * 5) * 0.05, pos[2]);
    b.rotation.set(0, 0.4, sw * 0.5);
    place(w, [b.position.x + 0.1, b.position.y - 0.62, b.position.z + 0.05], null, 0.3);
    w.applyPose(P({ legL: { fwd: 80, knee: 70, out: 25 }, legR: { fwd: 70, knee: 80, out: -5 }, armL: { fwd: 70, out: 25, elbow: 40 }, armR: { fwd: 30, out: 120, elbow: 30 + Math.sin(t * 9) * 25 }, lean: sw * 20 }));
    w.setFace('happy', {}, t);
    return b.position.clone();
  };
  const wire = W.registerProp('wire', new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 6), new THREE.MeshStandardMaterial({ color: '#d8d8e0', roughness: 0.3 })));
  const showWire = (top, bottom) => {
    wire.visible = true;
    const a = new THREE.Vector3(...top), b = bottom.clone();
    wire.position.copy(a).add(b).multiplyScalar(0.5); wire.scale.set(1, a.distanceTo(b), 1);
    wire.lookAt(b); wire.rotateX(Math.PI / 2);
  };

  // ---------------- beat 14 ----------------
  const t14 = T.beatCut(14), actors = T.word(14, 'actors').s, t14b = T.cut(14, 'Zombies'), t14c = T.cut(14, 'witches'), t14d = T.cut(14, 'vampire');
  const vampire = T.word(14, 'vampire').s, t15 = T.beatCut(15);
  S.push({
    id: '14a', beat: 14, at: t14, look: 'mansion',
    labels: [{ text: 'ACTORS', color: 'yellow', at: actors - 0.04, dur: 1.15 }],
    sfx: [['door_creak_short', t14 + 0.05, 0.5], ['zombie_groan', t14 + 0.3, 0.6], ['witch_cackle', t14 + 0.7, 0.45], ['cape_swoosh', actors + 0.2, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0, 1.3, -8.5);
      inHall(tgt);
      // the new actors line up for their first night
      C.zombies.forEach((z, i) => zombieShuffle(z, abs, i, H(-1.2 + i * 0.6, 0, -9.6 + (i % 2) * 0.4), H(-1.2 + i * 0.6, 0, -9.0 + (i % 2) * 0.4), t14, t14 + 1.5));
      place(C.vampire, H(1.35, 0, -8.6), H(0.3, 0, -4)); C.vampire.applyPose(P({ armL: { fwd: 30, out: 70, elbow: 30 }, armR: { fwd: 30, out: 70, elbow: 30 } }));
      C.vampire.setFace('grin', {}, abs); C.vampire.cape.set({ t: abs, open: 0.5, flare: 1.4 });
      const wp = witchOnBroom(H(0.2, 2.6, -10.2), abs, 0.6); showWire(H(0.2, 3.8, -10.2), wp);
      W.fog.show({ center: H(0, 0.25, -8), size: [4, 0.5, 6] }, abs, { density: 0.4, color: '#a8ffbf', opacity: 0.1, floor: 1 });
      W.cam.set(H(0.0, 1.5, -4.2), tgt, 56).push(t * 0.35).shake(t, 0.5, 51);
    },
  });
  S.push({
    id: '14b', beat: 14, at: t14b, look: 'mansion',
    sfx: [['zombie_groan', t14b + 0.05, 1.0], ['zombie_groan_2', t14b + 0.2, 0.8], ['shuffle_feet', t14b, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0, 1.1, -7.6);
      inHall(tgt);
      C.zombies.forEach((z, i) => zombieShuffle(z, abs, i, H(-0.9 + i * 0.9, 0, -9.3 - (i === 1 ? 0.5 : 0)), H(-0.9 + i * 0.9, 0, -7.6 - (i === 1 ? 0.5 : 0)), t14b - 0.4, t14c + 0.6));
      W.fog.show({ center: H(0, 0.25, -8), size: [4, 0.5, 6] }, abs, { density: 0.45, color: '#a8ffbf', opacity: 0.1, floor: 1 });
      W.cam.set(H(0.2, 0.75, -4.6), tgt, 58).push(t * 0.25).shake(t, 0.6, 52);
    },
  });
  S.push({
    id: '14c', beat: 14, at: t14c, look: 'mansion',
    sfx: [['wire_creak', t14c + 0.05, 0.6], ['witch_cackle', t14c + 0.12, 1.0], ['broom_whoosh', t14c + 0.3, 0.6]],
    frame({ t, abs }) {
      const wp = witchOnBroom(H(-0.4, 2.3, -7.0), abs, 1.4);
      showWire(H(-0.4, 3.8, -7.0), wp);
      inHall(wp.toArray());
      W.cam.set(H(0.8, 1.2, -4.2), [wp.x, wp.y - 0.2, wp.z], 54).shake(t, 0.6, 53);
    },
  });
  S.push({
    id: '14d', beat: 14, at: t14d, look: 'mansion',
    sfx: [['cape_swoosh', vampire + 0.05, 1.0], ['vampire_bleh', vampire + 0.3, 0.7], ['organ_sting_small', vampire + 0.08, 0.5]],
    blur: (t) => (t > 0.1 && t < 0.5 ? 4 : 0),
    frame({ t, abs }) {
      const tgt = H(1.0, 1.35, -5.2);
      inHall(tgt);
      const V = C.vampire;
      place(V, H(1.0, 0, -5.2), H(0.0, 0, -2.5));
      const sw = easeOutBack(clamp((abs - vampire) / 0.35), 1.6);
      V.applyPose(P({ armR: { fwd: 40 + 50 * sw, out: 80 * sw + 10, elbow: 40 - 30 * sw }, armL: { fwd: 30, out: 20, elbow: 90 }, spine: { twist: -25 * sw }, head: { nod: -8 * sw } }));
      V.setFace(sw > 0.5 ? 'grin' : 'smug', {}, abs);
      V.cape.set({ t: abs, open: 0.35 + 0.5 * sw, flare: 1 + sw, swoosh: Math.sin(clamp((abs - vampire) / 0.5) * Math.PI) });
      W.cam.set(H(-0.2, 1.25, -3.0), tgt, 50).push(t * 0.2).shake(t, 0.6, 54);
    },
  });

  // ---------------- beat 15: the zombie selfie ----------------
  const selfie = T.word(15, 'selfie').s, t15b = T.cut(15, 'Larry', 2), t15c = T.cut(15, 'not'), t16 = T.beatCut(16);
  const phone = W.registerProp('phone', (() => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.18, 0.012), new THREE.MeshStandardMaterial({ color: '#1d1d24', roughness: 0.35 })); g.add(body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.16), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true })); scr.position.z = 0.0065; g.add(scr);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.16), new THREE.MeshStandardMaterial({ color: '#c0392b' })); back.position.z = -0.0065; back.rotation.y = Math.PI; g.add(back);
    g.userData.screen = scr; return g;
  })());
  const rt = new THREE.WebGLRenderTarget(540, 1080, { samples: 4 });
  const selfieCam = new THREE.PerspectiveCamera(66, 0.5, 0.05, 50);
  // the zombie's green mitten (phone close-up)
  const zombieHand = W.registerProp('zombieHand', (() => {
    const g = new THREE.Group(), skin = cloth('#9fd18b', { sheen: 0.0, roughness: 0.75 });
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.26, 6, 16), skin); fore.position.y = -0.17; g.add(fore);
    const mit = new THREE.Mesh(new THREE.SphereGeometry(0.066, 24, 18), skin); mit.scale.set(0.92, 1.05, 0.72); mit.position.y = 0.04; g.add(mit);
    const thumb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), skin); thumb.position.set(-0.045, 0.03, 0.03); g.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.14, 7), cloth('#3f6fa8', { roughness: 0.9 })); cuff.position.y = -0.33; g.add(cuff);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  })());
  const posePair = (abs) => {
    // Larry and zombie #0 squeezed together for the selfie in the hallway
    const z = C.zombies[0];
    place(L, H(-0.26, 0, -6.2), H(-0.1, 0, -3)); place(z, H(0.33, 0, -6.3), H(-0.1, 0, -3));
    sheetLarry(abs, 'happy', {});
    L.chips.visible = false;
    L.applyPose(P({ lean: -5 }));
    // the zombie holds the phone up high (long zombie arms are great for selfies), other arm round Larry
    z.applyPose(P({ armL: { fwd: 150, out: -45, elbow: 10 }, armR: { fwd: 20, out: 80, elbow: 45, twist: 20 }, head: { tilt: -8 } }));
    z.setFace('grin', { eyes: 'happy' });
    return z;
  };
  S.push({
    id: '15a', beat: 15, at: t15, look: 'mansion',
    sfx: [['phone_beep', selfie - 0.35, 0.5], ['camera_click', selfie + 0.05, 1.0], ['camera_flash', selfie + 0.05, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0, 1.25, -6.3);
      inHall(tgt);
      posePair(abs);
      const z = C.zombies[0];
      // Larry asks, the zombie (arms out, zombie-style) gets pulled in and holds the phone up
      const up = easeOutBack(clamp((abs - selfie + 0.55) / 0.3), 1.5);
      if (up < 0.01) { z.setFace('tongue'); z.applyPose(P({ armL: { fwd: 85, out: 6, elbow: 8 }, armR: { fwd: 85, out: 6, elbow: 8 } })); L.sheet.face.set('happy', { pupil: [0.5, 0.2] }); }
      else z.applyPose(blendPose(P({ armL: { fwd: 85, out: 6, elbow: 8 }, armR: { fwd: 85, out: 6, elbow: 8 } }), z.pose, Math.min(1, up)));
      z.updateMatrixWorld(true);
      const hp = new THREE.Vector3(); z.hand('L').getWorldPosition(hp);
      phone.scale.setScalar(1.5);
      phone.visible = up > 0.01; phone.position.copy(hp).add(new THREE.Vector3(0, 0.12, 0.02)); phone.lookAt(H(0, 1.2, -6.3)[0], 1.2, H(0, 1.2, -6.3)[2]);   // screen toward them, red back toward us
      const fl = abs - (selfie + 0.05);
      W.stage.grade.uniforms.flash.value = fl > 0 && fl < 0.09 ? 0.7 * (1 - fl / 0.09) : 0;
      W.stage.grade.uniforms.flashColor.value.set('#ffffff');
      W.cam.set(H(-0.05, 1.3, -2.9), tgt, 52).push(t * 0.3).shake(t, 0.5, 55);
    },
  });
  S.push({
    id: '15b', beat: 15, at: t15b, look: 'mansion',
    sfx: [['phone_swoosh', t15b + 0.02, 0.4]],
    frame({ t, abs }) {
      inHall(H(0, 1.2, -6.3));
      // the selfie, rendered from the phone's point of view into the phone screen
      posePair(selfie);
      L.updateMatrixWorld(true);
      selfieCam.position.set(...H(0.04, 1.85, -4.75)); selfieCam.lookAt(...H(0.03, 1.12, -6.25)); selfieCam.fov = 62; selfieCam.updateProjectionMatrix(); selfieCam.updateMatrixWorld(true);
      W.pre.push(() => {
        // (the phone and the hand in front of our lens are hidden while the selfie itself is taken)
        const r = W.stage.renderer; const prev = r.getRenderTarget();
        phone.visible = false; zombieHand.visible = false;
        r.setRenderTarget(rt); r.render(W.scene, selfieCam); r.setRenderTarget(prev);
        phone.visible = true; zombieHand.visible = true;
        phone.userData.screen.material.map = rt.texture; phone.userData.screen.material.needsUpdate = true;
      });
      // the phone fills the frame, held up by a sheet-covered hand; the hallway behind is out of focus
      const cp = new THREE.Vector3(...H(1.2, 1.3, -2.0));
      phone.scale.setScalar(1.5);
      phone.visible = true; phone.position.copy(cp).add(new THREE.Vector3(0, -0.01, -0.62)); phone.rotation.set(0.04, -0.05, 0.06);
      // the zombie's green mitten grips the phone's lower right edge from behind
      zombieHand.visible = true;
      zombieHand.position.copy(phone.position).add(new THREE.Vector3(0.1, -0.2, -0.04)); zombieHand.rotation.set(0.5, 0, 0.55);
      W.cam.set(cp, phone.position.clone(), 34).push(t * 0.04).shake(t, 0.3, 56).dof(phone.position.toArray(), 0.007, 0.014);
    },
  });
  S.push({
    id: '15c', beat: 15, at: t15c, look: 'mansion',
    sfx: [['heart_pop', t15c + 0.3, 0.8], ['zombie_giggle', t15c + 0.35, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0.02, 1.08, -6.25);
      inHall(tgt);
      const z = C.zombies[0];
      // best friends now: the zombie throws an arm round Larry, both lean in and grin; hearts pop up
      const lean = easeOutBack(clamp((t - 0.05) / 0.25), 1.6);
      place(L, H(-0.28, 0, -6.2), H(-0.05, 0, -3)); place(z, H(0.36, 0, -6.28), H(-0.25, 0, -3));
      L.chips.visible = false;
      sheetLarry(abs, 'happy', { swing: -0.3 * lean });
      L.applyPose(P({ lean: -6 * lean, ...hop(t, 0.35, 0.06, 0.3) }));
      z.applyPose(P({ armR: { fwd: 20, out: 95 * lean, elbow: 55 * lean, twist: 20 }, armL: { fwd: 30, out: 20, elbow: 70 }, lean: 6 * lean, head: { tilt: -8 * lean } }));
      z.setFace(t > 0.3 ? 'laugh' : 'grin');
      W.fx.hearts.show(H(0.02, 1.62, -6.15), t - 0.3, { count: 3, spread: 0.3, rise: 0.45, life: 0.9, size: 1.1 });
      W.cam.set(H(0.0, 1.2, -3.7), tgt, 50).push(t * 0.25).shake(t, 0.5, 57);
    },
  });

  // ---------------- beat 16: the chicken exit ----------------
  const t16b = T.cut(16, 'So'), chicken = T.word(16, 'chicken').s, t16c = T.cut(16, 'Real'), t17 = T.beatCut(17);
  const ceWorld = () => { const ce = E().mansion.userData.chickenExit; ce.updateWorldMatrix(true, false); return ce; };
  const ceLocal = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(ceWorld().matrixWorld);
  S.push({
    id: '16a', beat: 16, at: t16, look: 'mansion',
    sfx: [['teeth_chatter', t16 + 0.1, 0.8], ['knees_knock', t16 + 0.2, 0.6]],
    frame({ t, abs }) {
      const tgt = H(0.2, 0.75, -6.0);
      inHall(tgt);
      const k = C.witchKid;
      place(k, H(0.2, 0, -6.0), H(0.2, 0, -3));
      k.applyPose(P({ armL: { fwd: 50, out: 20, elbow: 110 }, armR: { fwd: 50, out: 20, elbow: 110 }, legL: { out: 10 }, legR: { out: 10 }, lean: Math.sin(abs * 60) * 3, squash: 0.95 }));
      k.setFace('terrified', { pupil: [Math.sin(abs * 30) * 0.2, 0], sweat: 1 });
      k.position.x += Math.sin(abs * 70) * 0.012;
      W.fog.show({ center: H(0, 0.25, -6), size: [4, 0.5, 5] }, abs, { density: 0.45, color: '#a8ffbf', opacity: 0.1, floor: 1 });
      W.cam.set(H(0.05, 0.85, -4.5), tgt, 48).push(t * 0.4).shake(t, 0.8, 58).dof(tgt, 0.004, 0.008);
    },
  });
  S.push({
    id: '16b', beat: 16, at: t16b, look: 'night',
    labels: [{ text: 'CHICKEN EXIT', color: 'yellow', at: chicken - 0.04, dur: 1.3 }],
    sfx: [['door_bang', chicken + 0.25, 0.7], ['chicken_bawk', chicken + 0.35, 1.0], ['wing_flap', chicken + 0.4, 0.5]],
    frame({ t, abs }) {
      const e = estate('night');
      const ce = ceWorld();
      const open = clamp((abs - chicken - 0.22) / 0.1);
      e.mansion.userData.chickenDoor.rotation.y = -1.4 * open + wobble(abs - chicken - 0.32, 3, 5) * 0.2 * open;
      const ch = C.chicken; ch.visible = abs > chicken + 0.2;
      const pop = easeOutBack(clamp((abs - chicken - 0.25) / 0.25), 2);
      const p0 = ceLocal(0, 0, 0.15), p1 = ceLocal(0.15, 0, 0.95);
      ch.position.lerpVectors(p0, p1, pop); ch.rotation.y = W.MANSION.rotY + 0.25;
      ch.scale.setScalar(2.4);
      ch.bawk(abs, abs > chicken + 0.3 ? 1 : 0);
      // framed so the CHICKEN EXIT sign sits below the label and above the subtitles
      const tgt = ceLocal(0, 1.42, 0.6);
      const cp = ceLocal(-1.0, 0.95, 6.1);
      W.cam.set(cp, tgt, 52).push(t * 0.12).shake(t, 0.5, 59);
      W.shadow(ceLocal(0, 0, 1).toArray(), 6);
    },
  });
  S.push({
    id: '16c', beat: 16, at: t16c, look: 'night',
    sfx: [['running_feet', t16c + 0.05, 0.8], ['relieved_sigh', t16c + 0.5, 0.5]],
    blur: 3,
    frame({ t, abs }) {
      const e = estate('night');
      e.mansion.userData.chickenDoor.rotation.y = -1.4;
      // a pumpkin kid bolts out of the chicken exit, straight past the camera, very relieved
      const k = C.pumpkinKid;
      const a = ceLocal(0, 0, 0.2), b = ceLocal(2.4, 0, 4.7);
      const r0 = t16c + 0.05, r1 = t16c + 1.5;
      const p = walk(k, a.toArray(), b.toArray(), abs, r0, r1, { run: true, stride: 0.25 });
      p.armL = { fwd: 140, out: 35, elbow: 25 }; p.armR = { fwd: 150, out: 30, elbow: 20 };
      k.applyPose(p); k.setFace('happy', { eyes: 'squeeze' }, t);
      W.fx.dust.trail((tt) => a.clone().lerp(b, clamp((tt - r0) / (r1 - r0))), abs, { count: 8, spacing: 0.09 });
      const ch = C.chicken; ch.visible = true; ch.position.copy(ceLocal(-0.7, 0, 0.9)); ch.rotation.y = W.MANSION.rotY + 0.6; ch.scale.setScalar(2.4); ch.bawk(abs, 0.3);
      W.cam.set(ceLocal(1.5, 0.75, 4.5), ceLocal(0.7, 0.9, 1.2), 56).shake(t, 0.6, 60);
      W.shadow(ceLocal(1, 0, 2).toArray(), 6);
    },
  });

  // ---------------- beat 17: Larry uses it. At the entrance. ----------------
  const t17b = T.cut(17, 'At'), entrance = T.word(17, 'entrance').s, t18 = T.beatCut(18);
  const doorWorld = (x, y, z) => { const d = E().mansion.userData.frontDoor; d.updateWorldMatrix(true, false); return new THREE.Vector3(x, y, z).applyMatrix4(d.matrixWorld); };
  S.push({
    id: '17a', beat: 17, at: t17, look: 'night',
    sfx: [['footsteps_soft', t17 + 0.05, 0.6], ['door_open_creak', t17 + 0.35, 0.7], ['door_close', t17b - 0.1, 0.8], ['chips_rustle', t17 + 0.1, 0.4]],
    frame({ t, abs }) {
      estate('night');
      const a = doorWorld(0, 0.05, 3.2), b = doorWorld(0, 0.05, -0.6);
      const lp = walk(L, a.toArray(), b.toArray(), abs, t17, t17b - 0.1, { stride: 0.22 });
      L.position.y = Math.max(0.6, L.position.y);
      L.applyPose(lp); sheetLarry(abs, 'happy');
      W.cam.set(doorWorld(1.2, 1.4, 6.5), doorWorld(0, 1.4, 0.0), 52).shake(t, 0.5, 61);
      W.shadow(doorWorld(0, 0, 2).toArray(), 6);
    },
  });
  S.push({
    id: '17b', beat: 17, at: t17b, look: 'night',
    labels: [{ text: 'TIME INSIDE: 2 SEC', color: 'red', at: entrance - 0.05, dur: 1.25 }],
    sfx: [['door_bang', t17b + 0.08, 0.9], ['chicken_bawk', t17b + 0.2, 0.7], ['crunch', t17b + 0.75, 0.8]],
    frame({ t, abs }) {
      const e = estate('night');
      e.mansion.userData.chickenDoor.rotation.y = -1.4 * clamp((abs - t17b) / 0.08);
      // two seconds later he strolls out of the CHICKEN EXIT, munching, very pleased with himself
      const a = ceLocal(0, 0, -0.3), b = ceLocal(0.9, 0, 2.2);
      const lp = walk(L, a.toArray(), b.toArray(), abs, t17b + 0.06, t17b + 0.95, { stride: 0.22 });
      lp.armL = { fwd: 40, out: 20, elbow: 60 };
      L.applyPose(lp); sheetLarry(abs, 'smug', { wingL: 0.4 });
      const ch = C.chicken; ch.visible = true; ch.position.copy(ceLocal(-0.75, 0, 1.1)); ch.rotation.y = W.MANSION.rotY + 0.5; ch.scale.setScalar(2.4); ch.bawk(abs, abs > t17b + 0.15 && abs < t17b + 0.6 ? 1 : 0.2);
      // sign below the label, above the subtitles
      W.cam.set(ceLocal(2.2, 0.95, 6.1), ceLocal(0.4, 1.42, 0.6), 52).shake(t, 0.5, 62);
      W.shadow(ceLocal(0.5, 0, 2).toArray(), 6);
    },
  });

  // ---------------- beat 18: graveyard, bats, gate, stuck sheet ----------------
  const t18b = T.cut(18, 'flying'), t18c = T.cut(18, 'and'), t18d = T.cut(18, "Larry's"), twice = T.word(18, 'Twice').s, t18e = twice - 0.1;
  const t19 = T.beatCut(19);
  const gateZ = () => E().gateZ;
  S.push({
    id: '18a', beat: 18, at: t18, look: 'night',
    sfx: [['owl_hoot', t18 + 0.1, 0.5], ['wind_spooky', t18, 0.5]],
    frame({ t, abs, u }) {
      const e = estate('night');
      // low among the tombstones, pumpkin lanterns along the path, fog, the glowing mansion behind
      W.fog.show({ center: [M[0], 0.3, -17.0], size: [20, 0.6, 7] }, abs, { density: 0.45, color: '#b9a8ff', opacity: 0.13, floor: 1, minS: 1.2, maxS: 2.2 });
      W.cam.between({ pos: [M[0] + 6.2, 9.0, -9.8], target: [M[0] + 4.4, 0, -17.6], fov: 54 },
        { pos: [M[0] + 5.6, 6.2, -11.4], target: [M[0] + 4.0, 0.4, -18.6], fov: 54 }, u, easeOutCubic).shake(t, 0.4, 63);
      W.shadow([M[0] - 1, 0, -17], 9);
    },
  });
  S.push({
    id: '18b', beat: 18, at: t18b, look: 'night',
    sfx: [['bats_flap', t18b + 0.02, 1.0], ['bat_squeak', t18b + 0.3, 0.5]],
    frame({ t, abs }) {
      estate('night');
      // looking up from the graveyard: a giant full moon, a swarm of bats streaming across it
      const cp = new THREE.Vector3(M[0] + 3.0, 1.0, -15.0);
      const dir = new THREE.Vector3(-0.78, 0.64, -0.24).normalize();
      const side = dir.clone().cross(new THREE.Vector3(0, 1, 0)).normalize(), up = side.clone().cross(dir).normalize();
      W.moonAt(cp.clone().addScaledVector(dir, 300).addScaledVector(up, 18).toArray(), 46);
      W.moon.userData.halo.material.opacity *= 0.45;
      W.moon.userData.disc.material.color.setRGB(1.15, 1.12, 1.02);
      const mid = cp.clone().addScaledVector(dir, 22).addScaledVector(up, 2.5);
      W.fx.bats.swarm(mid.clone().addScaledVector(side, -14).addScaledVector(up, -3).toArray(), mid.clone().addScaledVector(side, 14).addScaledVector(up, 4).toArray(),
        t + 0.3, { spread: 6, size: 2.0, dur: 1.0, camPos: cp.toArray(), seed: 5, count: 16, stagger: 0.4 });
      W.cam.set(cp, cp.clone().addScaledVector(dir, 10), 62, 0.06).shake(t, 0.5, 64);
      W.shadow([M[0], 0, -24], 16);
    },
  });
  S.push({
    id: '18c', beat: 18, at: t18c, look: 'night',
    sfx: [['gate_squeak', t18c + 0.1, 1.0], ['iron_clank', t18c + 0.9, 0.5]],
    frame({ t, abs }) {
      const e = estate('night');
      e.gate.userData.doors.forEach((d, i) => { d.rotation.y = (i ? -1 : 1) * 0.75 * easeInOut(clamp(t / 1.1)); });
      W.cam.set([M[0] + 0.6, 0.45, gateZ() + 3.2], [M[0], 3.2, gateZ()], 64, 0.04).push(t * 0.4).shake(t, 0.5, 65);
      W.shadow([M[0], 0, gateZ()], 5);
    },
  });
  // a torn scrap of bedsheet left hanging on the left gate door after the first rip
  const scrap = W.registerProp('sheetScrap', (() => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.16, -0.05); sh.lineTo(0.1, -0.2); sh.lineTo(0.05, -0.12); sh.lineTo(-0.03, -0.22); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), cloth(PAL.sheet, { side: THREE.DoubleSide, sheen: 0.3, roughness: 0.9 }));
    m.castShadow = true; const g = new THREE.Group(); g.add(m); return g;
  })());
  const doorEnd = (i) => {
    // the free end of an open gate door (i = 0 left, 1 right), at snag height
    const d = E().gate.userData.doors[i]; d.updateWorldMatrix(true, true);
    return new THREE.Vector3((i ? -1 : 1) * 1.9, 0.72, 0).applyMatrix4(d.matrixWorld);
  };
  const snagSheet = (point, amount, extra = {}) => {
    L.updateMatrixWorld(true);
    const sp = L.sheet.worldToLocal(point.clone());
    return { snag: amount > 0 ? { point: sp.toArray(), amount } : null, ...extra };
  };
  const openGate = (e) => e.gate.userData.doors.forEach((d, i) => { d.rotation.y = (i ? -1 : 1) * 0.75; });
  S.push({
    id: '18d', beat: 18, at: t18d, look: 'night',
    sfx: [['cloth_snag', t18d + 0.5, 0.9], ['tug_grunt', t18d + 0.7, 0.6], ['cloth_rip', t18d + 1.05, 1.0]],
    frame({ t, abs }) {
      const e = estate('night'); openGate(e);
      const pin = doorEnd(0);
      // he strolls through the gate... the side of the sheet catches on the door... tug, tug... RIP
      const g0 = [M[0] - 0.22, 0, gateZ() + 1.4], g1 = [M[0] - 0.18, 0, gateZ() - 1.75];
      const lp = walk(L, g0, g1, Math.min(t, 0.62), 0, 0.62, { stride: 0.21 });
      const caught = t > 0.5, ripped = t > 1.05;
      const tug = clamp((t - 0.62) / 0.43);
      // body tips forward as he tugs (and leans away from the snag); after the rip he stumbles on
      let fwd = caught && !ripped ? 10 + 7 * Math.sin(tug * Math.PI * 4) : 0;
      lp.lean = caught && !ripped ? 5 : 0;
      if (ripped) { const st = easeOutCubic(clamp((t - 1.05) / 0.25)); L.position.z -= 0.35 * st; fwd = 16 * wobble(t - 1.05, 3, 6); }
      L.applyPose(lp);
      L.joints.body.rotation.x = fwd * Math.PI / 180;
      const amt = ripped ? 0 : caught ? Math.min(1, (t - 0.5) * 6) * (0.85 + 0.15 * Math.sin(tug * 22)) : 0;
      sheetLarry(abs, ripped ? 'shocked' : caught ? 'worried' : 'happy', snagSheet(pin, amt, { swing: ripped ? wobble(t - 1.05, 3, 5) * 0.8 : 0 }));
      L.chips.visible = false;
      if (ripped) { scrap.visible = true; scrap.position.copy(pin).add(new THREE.Vector3(0, 0.05, 0)); scrap.rotation.set(0, 0.6, 0.2 + 0.15 * wobble(t - 1.05, 4, 5)); }
      const tgt = [M[0] - 0.3, 0.85, gateZ() - 1.6];
      W.cam.set([M[0] - 0.9, 1.0, gateZ() - 4.6], tgt, 46).shake(t, caught && !ripped ? 0.9 : 0.4, 66).dof(tgt, 0.003, 0.006);
      W.shadow([M[0], 0, gateZ() - 1], 4);
    },
  });
  S.push({
    id: '18e', beat: 18, at: t18e, look: 'night',
    sfx: [['cloth_snag', t18e + 0.05, 0.9], ['larry_groan', t18e + 0.12, 0.6]],
    frame({ t, abs }) {
      const e = estate('night'); openGate(e);
      // ...and stuck again, on the other door. He turns to us. Not amused.
      const pin = doorEnd(1);
      place(L, [M[0] + 0.3, 0, gateZ() - 1.95], [M[0] + 0.25, 0, gateZ() - 6]);
      L.applyPose(P({ lean: -5 }));
      L.joints.body.rotation.x = (9 + 4 * Math.sin(t * 30)) * Math.PI / 180;
      L.rotation.y -= 0.45;   // half turned toward us
      L.chips.visible = false;
      sheetLarry(abs, 'annoyed', snagSheet(pin, 1, {}));
      scrap.visible = true; scrap.position.copy(doorEnd(0)).add(new THREE.Vector3(0, 0.05, 0)); scrap.rotation.set(0, 0.6, 0.2);
      const tgt = [M[0] + 0.3, 0.9, gateZ() - 1.9];
      W.cam.set([M[0] + 1.45, 1.0, gateZ() - 3.6], tgt, 42).shake(t, 1.0, 67).dof(tgt, 0.003, 0.006);
      W.shadow([M[0], 0, gateZ() - 1], 4);
    },
  });
  S.push({
    id: '18f', beat: 18, at: T.word(18, 'Twice').e - 0.05, look: 'night',
    sfx: [['facepalm_slap', T.word(18, 'Twice').e + 0.07, 0.8]],
    frame({ t }) {
      estate('night');
      const p = [M[0] + 1.6, 0, gateZ() + 1.4];
      place(J, p, [M[0] - 0.5, 0, gateZ()]);
      facepalm(J, t, { start: 0.0 });
      const f = [p[0], 1.25, p[2]];
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(J.quaternion);
      W.cam.set(new THREE.Vector3(...f).addScaledVector(fwd, 1.6).add(new THREE.Vector3(0.3, 0.1, 0)), f, 44).shake(t, 0.4, 68).dof(f, 0.004, 0.008);
      W.shadow(p, 3);
    },
  });
  return S;
}
