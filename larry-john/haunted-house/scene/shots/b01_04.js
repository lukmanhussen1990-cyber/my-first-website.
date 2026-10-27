// Beats 1-4 (golden hour): the $1 haunted house.
import * as THREE from 'three';
import { P, pose, place, walk, hop, popScale, chewFace, smooth, clamp, lerp, track, easeOutBack, spring, wobble, mergePose, blendPose } from '../acting.js';
import { easeInOut, easeOutCubic, easeInCubic } from '../../../engine/toon/anim.js';

// shed-local → world helper
export function shedXZ(W, x, z, y = 0) {
  const S = W.LAYOUT.shed, r = S.rotY;
  return [S.pos[0] + x * Math.cos(r) + z * Math.sin(r), y, S.pos[2] - x * Math.sin(r) + z * Math.cos(r)];
}
export function mainCam(W) { const m = W.LAYOUT.mainCam; return { pos: m.pos, target: m.target, fov: m.fov }; }

// camera framing two world points side by side (a "two-shot"): returns {pos, target}
export function twoShot(a, b, { dist = 1.0, height = 1.2, side = 1, lookY = null, extra = 1.25 } = {}) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const M = A.clone().add(B).multiplyScalar(0.5);
  const d = B.clone().sub(A); d.y = 0;
  const half = d.length() / 2;
  const perp = new THREE.Vector3(d.z, 0, -d.x).normalize().multiplyScalar(side);
  const pos = M.clone().addScaledVector(perp, (half * extra) / Math.tan(0.24) * dist); pos.y = height;
  return { pos: pos.toArray(), target: [M.x, lookY ?? (A.y + B.y) / 2, M.z] };
}

// the three kids standing to the left of the shed, watching
export function kidsSpots(W) {
  // a little row facing Larry (who stands at shed-local (0, 1.75))
  const kc = [-1.75, 3.65], v = [kc[0] - 0, kc[1] - 1.75], n = Math.hypot(...v), p = [v[1] / n, -v[0] / n];
  const at = (k) => shedXZ(W, kc[0] + p[0] * k * 0.52, kc[1] + p[1] * k * 0.52);
  return { pumpkin: at(0), witch: at(-1), dino: at(1), center: shedXZ(W, ...kc) };
}

export function shots01_04(T, W) {
  const C = W.cast, L = C.larry, J = C.john, S = [];
  const by = W.sets.backyard.userData;
  const door = shedXZ(W, 0, 1.55), front = shedXZ(W, 0, 2.5);
  const kids = kidsSpots(W);
  const showKids = (faceTo, expr = 'happy', t = 0) => {
    place(C.pumpkinKid, kids.pumpkin, faceTo); place(C.witchKid, kids.witch, faceTo); place(C.dinoKid, kids.dino, faceTo);
    for (const k of [C.pumpkinKid, C.witchKid, C.dinoKid]) { k.idle(t + k.seed); k.setFace(expr, {}, t); }
  };

  // ---------------- beat 1 ----------------
  // 1a WIDE (main camera spot): John throws a bedsheet over Larry; hidden ghost in the attic window
  const t1b = T.cut(1, 'put');
  S.push({
    id: '1a', beat: 1, at: 0, look: 'golden',
    sfx: [['cloth_whoosh', 0.35, 0.8], ['sheet_flop', 1.18, 1.0], ['kid_giggle', 1.4, 0.35]],
    frame({ t, d, u }) {
      W.show('backyard');
      W.shadow([2.5, 0, -4], 9);
      const m = mainCam(W);
      W.cam.set(m.pos, m.target, m.fov).push(u * 0.8).shake(t, 0.5, 11);
      // Larry in front of the shed door, facing the camera; John beside him throwing the sheet
      place(L, front, null, -0.42 + 0.35);
      const throwU = clamp((t - 0.25) / 1.0);
      const drape = smooth(clamp((t - 0.5) / 0.75));
      L.setSheet(drape > 0.02 || t > 0.4, drape > 0.88);
      L.sheet.set({ drape: t < 0.4 ? 0 : drape, flatY: lerp(2.7, 1.55, easeInOut(throwU)), flatTilt: lerp(0.5, 0.0, throwU), t, sway: t * 2.5,
        lift: drape >= 1 ? wobble(t - 1.25, 3, 6) * 0.04 : 0 });
      L.sheet.position.x = lerp(-0.85, 0, easeOutCubic(throwU));
      L.sheet.face.set('shocked', { lid: 0 });
      const landed = t > 1.15;
      const lp = P({ armL: { fwd: 30, out: 15, elbow: 50 }, ...hop(t, 1.15, 0.0, 0.3) });
      if (!landed) { L.setFace('happy', {}, t); }
      L.applyPose(lp); L.idle(t);
      // John: arms up holding the sheet, then the throw follow-through
      place(J, shedXZ(W, -0.95, 2.6), null, -0.42 - 0.35);
      const jp = blendPose(pose('armsUp'), P({ armL: { fwd: 100, out: 30, elbow: 20 }, armR: { fwd: 100, out: 30, elbow: 20 }, spine: { fwd: 12 } }), easeOutBack(throwU));
      J.applyPose(t > 1.4 ? blendPose(jp, pose('stand', { head: { tilt: 8 } }), smooth((t - 1.4) / 0.4)) : jp);
      J.setFace(t > 1.2 ? 'proud' : 'grin', {}, t); J.idle(t);
      showKids(front, 'happy', t);
      // hidden ghost: faint face in the attic window
      const attic = by.house.userData.atticWindow;
      const gc = C.ghostCameo; gc.visible = true;
      attic.updateWorldMatrix(true, false);
      const p = new THREE.Vector3(0, -0.25, 0.08).applyMatrix4(attic.matrixWorld);
      gc.position.copy(p); gc.scale.setScalar(0.62);
      gc.rotation.y = W.LAYOUT.house.rotY + Math.PI / 2;
      gc.set({ t, armWave: 0, tailSwish: 0.5 });
      gc.face.set('neutral', { eyes: 'open', mouth: 'O', mouthOpen: 0.2 });
    },
  });

  // 1b MEDIUM: John guides sheet-Larry into the shed doorway
  const t1c = T.cut(1, 'and');
  S.push({
    id: '1b', beat: 1, at: t1b, look: 'golden',
    sfx: [['footsteps_soft', t1b + 0.15, 0.5], ['door_creak_short', t1b + 0.5, 0.35]],
    frame({ t, d, u }) {
      W.show('backyard');
      W.shadow(door, 4);
      const tgt = shedXZ(W, -0.05, 2.35, 0.85);
      W.cam.set(shedXZ(W, 2.7, 2.75, 1.1), tgt, 50).push(u * 0.3).shake(t, 0.6, 12);
      const a = shedXZ(W, 0, 2.6), b = shedXZ(W, 0, 1.75);
      const lp = walk(L, a, b, t, 0.05, d * 0.85, { stride: 0.2 });
      L.setSheet(true); L.sheet.set({ drape: 1, sway: t * 4, swing: -Math.sin(t * 9) * 0.15 });
      L.sheet.face.set('happy');
      L.applyPose(lp);
      W.sets.backyard.userData.shed.userData.door.rotation.y = 1.75;
      // John behind him, hands on his back
      const ja = shedXZ(W, 0.15, 3.25), jb = shedXZ(W, 0.15, 2.45);
      const jp = walk(J, ja, jb, t, 0.0, d * 0.85, { stride: 0.32, extra: { armL: { fwd: 70, out: 8, elbow: 30 }, armR: { fwd: 70, out: 8, elbow: 30 } } });
      jp.armL = { fwd: 70, out: 8, elbow: 30 }; jp.armR = { fwd: 70, out: 8, elbow: 30 };
      J.applyPose(jp); J.setFace('smug', { mouth: 'smile' }, t);
      showKids(front, 'happy', t);
    },
  });

  // 1c CLOSE-UP: the pumpkin kid drops a $1 coin into the jar
  const t2 = T.beatCut(2);
  const dollar = T.word(1, 'dollar').s;
  S.push({
    id: '1c', beat: 1, at: t1c, look: 'golden',
    sfx: [['coin_clink', dollar + 0.08, 1.0], ['coin_rattle', dollar + 0.2, 0.5]],
    frame({ t, d, u, abs }) {
      W.show('backyard');
      const jar = by.jar; jar.updateWorldMatrix(true, false);
      const jp = new THREE.Vector3().setFromMatrixPosition(jar.matrixWorld);
      W.shadow([jp.x, 0, jp.z], 2.5);
      const tgt = jp.clone().add(new THREE.Vector3(0, 0.62, 0));
      const camPos = new THREE.Vector3(...shedXZ(W, -0.25, 3.25, 0.92));
      W.cam.set(camPos, new THREE.Vector3(...shedXZ(W, -1.2, 1.9, 0.68)), 44).push(u * 0.18).shake(t, 0.4, 13).dof(tgt, 0.006, 0.01);
      // the pumpkin kid beside the jar, arm out over it
      const K = C.pumpkinKid;
      place(K, shedXZ(W, -1.55, 2.0), [jp.x, 0, jp.z]);
      const reach = smooth(clamp((abs - (dollar - 0.9)) / 0.4));
      K.applyPose(P({ armR: { fwd: lerp(20, 78, reach), out: 14, elbow: lerp(30, 12, reach) }, spine: { fwd: 6 * reach }, head: { nod: 14 } }));
      K.setFace(abs > dollar + 0.1 ? 'grin' : 'happy', { pupil: [0, -0.6] }, t);
      K.idle(t, 0.5);
      // the coin: held, released, falls into the jar with a spin
      const coin = W.props.coin; coin.visible = true;
      K.updateMatrixWorld(true);
      const hand = new THREE.Vector3(); K.hand('R').getWorldPosition(hand);
      const rel = dollar - 0.18;
      if (abs < rel) { coin.position.copy(hand).add(new THREE.Vector3(0, -0.07, 0.03)); coin.rotation.set(1.3, 0, 0); }
      else {
        const ft = abs - rel;
        const top = hand.clone().add(new THREE.Vector3(0, -0.07, 0.03));
        const bottom = jp.clone().add(new THREE.Vector3(0, 0.46, 0));
        const k = clamp(ft / 0.26);
        coin.position.lerpVectors(top, bottom, easeInCubic(k));
        coin.position.x = lerp(top.x, jp.x, k); coin.position.z = lerp(top.z, jp.z, k);
        coin.rotation.set(1.3 + ft * 14, ft * 6, 0);
        if (k >= 1) coin.position.y = bottom.y + Math.abs(wobble(ft - 0.26, 5, 9)) * 0.03;
      }
    },
  });

  // ---------------- beat 2 ----------------
  // LOW-ANGLE HERO: Larry in the doorway, arms up like he's huge; party popper bursts
  const t3 = T.beatCut(3);
  const congrats = T.word(2, 'Congratulations!').s;
  S.push({
    id: '2', beat: 2, at: t2, look: 'golden',
    sfx: [['party_popper', congrats + 0.02, 1.0], ['confetti', congrats + 0.1, 0.6], ['sheet_whoosh', congrats + 0.05, 0.45], ['kids_cheer', congrats + 0.4, 0.35]],
    blur: (t) => (t < 0.45 ? 4 : 0),
    frame({ t, d, u, abs }) {
      W.show('backyard');
      W.shadow(door, 4);
      const base = shedXZ(W, 0, 1.6);
      place(L, base, null, -0.42);
      L.setSheet(true);
      const up = easeOutBack(clamp((t - 0.05) / 0.35), 2.2);
      L.sheet.set({ drape: 1, wingL: up * 1.15, wingR: up * 1.15, wingY: 1.02, sway: t * 5, mouthPush: 0.3 * up });
      L.sheet.face.set('happy');
      const lp = P({ armL: { fwd: 25, out: lerp(10, 150, up), elbow: 15 }, armR: { fwd: 25, out: lerp(10, 150, up), elbow: 15 }, ...hop(t, 0.0, 0.12, 0.35) });
      L.applyPose(lp);
      L.chips.visible = false;
      W.sets.backyard.userData.shed.userData.door.rotation.y = 1.75;
      const tgt = shedXZ(W, 0, 1.6, 1.12);
      // low hero angle on the whole costume (arms up in the sheet), the shed behind him
      W.cam.set(shedXZ(W, -0.25, 3.9, 0.42), shedXZ(W, 0, 1.6, 0.98), 60, 0.05).push(u * 0.35).shake(t, 0.8, 14);
      W.fx.confetti.show(shedXZ(W, -1.1, 2.5, 0.6), abs - congrats, [0.45, 1.0, -0.25]);
    },
  });

  // ---------------- beat 3 ----------------
  // 3a: the kids, unimpressed, in front of "scary" Larry. Label SCARES: 0
  const t3b = T.cut(3, 'and');
  const zero = T.word(3, 'zero').s;
  S.push({
    id: '3a', beat: 3, at: t3, look: 'golden',
    labels: [{ text: 'SCARES: 0', color: 'red', at: zero - 0.05, dur: 1.35 }],
    sfx: [['boo_weak', t3 + 0.15, 0.6], ['crickets', zero + 0.1, 0.5]],
    frame({ t, d, u }) {
      W.show('backyard');
      W.shadow(front, 5);
      place(L, shedXZ(W, 0, 1.75), null, -0.42);
      L.setSheet(true);
      const boo = Math.sin(clamp(t / 0.5) * Math.PI);
      L.sheet.set({ drape: 1, wingL: 0.7 * boo + 0.3, wingR: 0.7 * boo + 0.3, wingY: 0.9, sway: t * 4, mouthPush: 0.7 * boo });
      L.sheet.face.set(boo > 0.3 ? 'yell' : 'happy');
      L.applyPose(P({ armL: { fwd: 40, out: 70 + 30 * boo, elbow: 40 }, armR: { fwd: 40, out: 70 + 30 * boo, elbow: 40 } }));
      L.chips.visible = false;
      W.sets.backyard.userData.shed.userData.door.rotation.y = 1.75;
      showKids(shedXZ(W, 0, 1.75), 'bored', t);
      C.witchKid.applyPose(P({ head: { tilt: 12 } })); C.dinoKid.applyPose(P({ armL: { fwd: 10, out: 30, elbow: 90, twist: -60 }, armR: { fwd: 10, out: 30, elbow: 90, twist: 60 } }));
      C.pumpkinKid.setFace('flat', {}, t); C.dinoKid.setFace('bored', {}, t + 1);
      // from behind the kids: their costumes in the foreground, Larry's "BOO" in the doorway
      const k = kidsSpots(W);
      const larryP = new THREE.Vector3(...shedXZ(W, 0, 1.75)), kc = new THREE.Vector3(...k.center);
      const away = kc.clone().sub(larryP).setY(0).normalize();
      const cpos = kc.clone().addScaledVector(away, 1.95).setY(1.32);
      W.cam.set(cpos, [larryP.x, 0.88, larryP.z], 50).push(u * 0.45).shake(t, 0.5, 15);
    },
  });

  // 3b CLOSE-UP: Larry pushes a chip through the eye hole. CRUNCH.
  const chips = T.word(3, 'chips').s;
  S.push({
    id: '3b', beat: 3, at: t3b, look: 'golden',
    sfx: [['crunch', chips + 0.02, 1.0], ['crunch_small', chips + 0.32, 0.7], ['bag_crinkle', t3b + 0.1, 0.5]],
    frame({ t, d, u, abs }) {
      W.show('backyard');
      const base = shedXZ(W, 0, 1.75);
      W.shadow(base, 3);
      place(L, base, null, -0.42);
      L.setSheet(true);
      L.sheet.set({ drape: 1, sway: t * 3 });
      const crunched = abs > chips;
      L.sheet.face.set(crunched ? 'happy' : 'open', { pupil: [0.1, -0.5] });
      // a hand pokes out from under the sheet holding a chip and pushes it into the left eye hole
      L.applyPose(P({ armL: { fwd: 30, out: 25, elbow: 50 }, ...(crunched ? { squash: 1 + wobble(abs - chips, 6, 7) * 0.05 } : {}) }));
      L.updateMatrixWorld(true);
      const eye = new THREE.Vector3(...shedXZ(W, -0.11, 1.75 + 0.35, 0.985));
      const hand = W.props.larryHand; hand.visible = true;
      const reach = smooth(clamp((abs - (chips - 0.7)) / 0.62));
      const start = new THREE.Vector3(...shedXZ(W, 0.2, 1.75 + 0.55, 0.45));
      const end = eye.clone().add(new THREE.Vector3(...shedXZ(W, 0.05, 0.12, 0)).sub(new THREE.Vector3(...shedXZ(W, 0, 0, 0))));
      end.y -= 0.075;
      hand.position.lerpVectors(start, end, reach);
      if (crunched) hand.position.y -= easeOutCubic(clamp((abs - chips) / 0.35)) * 0.25;
      hand.rotation.set(-0.35 - 0.4 * reach, W.LAYOUT.shed.rotY, 0.35 - 0.2 * reach);
      const chip = W.props.chip;
      chip.visible = !crunched;
      chip.position.copy(hand.position).add(new THREE.Vector3(0, 0.085, 0)).lerp(eye, smooth(clamp((abs - (chips - 0.12)) / 0.12)));
      chip.rotation.set(1.2, 0.3, 0.2); chip.scale.setScalar(1.3);
      const tgt = shedXZ(W, 0, 1.75, 0.94);
      W.cam.set(shedXZ(W, 0.25, 3.05, 0.9), tgt, 44).push(u * 0.12).shake(t, 0.5, 16).dof(eye, 0.005, 0.009);
      W.fx.crumbs.show(eye.toArray(), abs - chips);
    },
  });

  // ---------------- beat 4 ----------------
  const t4 = T.beatCut(4), t4b = T.cut(4, 'laugh'), t4c = T.cut(4, "Larry's");
  // 4a: the kids don't scream (deadpan)
  S.push({
    id: '4a', beat: 4, at: t4, look: 'golden',
    sfx: [['crickets', t4 + 0.1, 0.4]],
    frame({ t, d, u }) {
      W.show('backyard');
      const c = kidsSpots(W);
      W.shadow(c.pumpkin, 4);
      showKids(shedXZ(W, 0, 1.75), 'flat', t);
      C.witchKid.setFace('bored', {}, t); C.dinoKid.setFace('flat', { pupil: [0.5, 0] }, t);
      C.dinoKid.applyPose(P({ head: { tilt: -8 } }));
      const tgt = [c.center[0], 0.58, c.center[2]];
      W.cam.set(shedXZ(W, -0.15, 1.6, 0.75), tgt, 56).push(u * 0.25).shake(t, 0.4, 17);
    },
  });
  // 4b: they laugh and point
  S.push({
    id: '4b', beat: 4, at: t4b, look: 'golden',
    sfx: [['kids_laugh', t4b + 0.05, 1.0]],
    frame({ t, d, u }) {
      W.show('backyard');
      const c = kidsSpots(W);
      W.shadow(c.pumpkin, 4);
      showKids(shedXZ(W, 0, 1.75), 'laugh', t);
      for (const [k, side, ph] of [[C.pumpkinKid, 'R', 0], [C.witchKid, 'L', 1.3], [C.dinoKid, 'R', 2.1]]) {
        const bounce = Math.abs(Math.sin((t + ph) * 11)) * 0.03;
        const arm = side === 'R' ? { armR: { fwd: 80, out: 8, elbow: 4 } } : { armL: { fwd: 80, out: 8, elbow: 4 } };
        k.applyPose(P({ ...arm, y: bounce, spine: { fwd: -8 + Math.sin((t + ph) * 11) * 4 }, head: { nod: -10 } }));
        k.setHand(side, 'point');
        k.setFace('laugh');
      }
      const tgt = [c.center[0], 0.58, c.center[2]];
      W.cam.set(shedXZ(W, -0.2, 1.65, 0.72), tgt, 56).push(u * 0.3).shake(t, 0.9, 18);
    },
  });
  // 4c: CLOSE-UP on the bottom of the sheet: white socks and sandals
  const socks = T.word(4, 'socks').s;
  S.push({
    id: '4c', beat: 4, at: t4c, look: 'golden',
    sfx: [['sandal_tap', socks - 0.05, 0.7], ['sandal_tap', socks + 0.2, 0.6], ['kids_laugh_small', socks + 0.15, 0.5]],
    frame({ t, d, u, abs }) {
      W.show('backyard');
      const base = shedXZ(W, 0, 1.75);
      W.shadow(base, 2);
      place(L, base, null, -0.42);
      L.setSheet(true);
      L.sheet.set({ drape: 1, sway: t * 5, lift: 0.02 * Math.sin(t * 8) });
      const tap = Math.max(0, Math.sin((abs - socks + 0.1) * 14)) * clamp((abs - socks + 0.15) / 0.1);
      L.applyPose(P({ legR: { fwd: tap * 10, foot: -tap * 25, knee: tap * 8 }, legL: { out: 4 } }));
      const tgt = shedXZ(W, 0, 1.75, 0.12);
      W.cam.set(shedXZ(W, 0.18, 2.55, 0.16), tgt, 44, -0.04).push(u * 0.1).shake(t, 0.4, 19).dof(tgt, 0.005, 0.01);
    },
  });
  return S;
}
