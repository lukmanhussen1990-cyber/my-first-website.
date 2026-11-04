// The 16 shots of the Flash POV reel (one per beat or two). Every shot is a clip; W.t0 = the shot's start in the
// video, so the storm (lightning flashes) and the moves line up with the song's beats (audio/beats.json).
import * as THREE from 'three';
import { makeChar, helpers } from './cast.js';
import * as S from './sets.js';
import * as ST from './storm.js';
import { clamp, smooth, lerp, hash1, easeInOut, easeOut, easeIn, easeOutBack, rng } from './lib.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const person = (W, name, over = {}) => { const ch = makeChar(W, name, over); W.cast.push(ch); W.chars[name] = ch; return ch; };
const sitAt = (ch, x, z, rotY) => { Object.assign(ch.p, { sit: 1, pos: [x, z], rotY }); };
const standAt = (ch, x, z, rotY, y = 0) => { Object.assign(ch.p, { sit: 0, pos: [x, z], rotY, y }); };
const face = (ch, eyes, brows, mouth, o = {}) => Object.assign(ch.p, { eyes, brows, mouth }, o);
const hl = (ch, x, y, z) => ch._w(V(x * ch.headScale, y * ch.headScale, z * ch.headScale), ch.head);
const forehead = (ch, side = 0) => hl(ch, side * 0.03, 0.065, 0.08);
const fwd = (rotY) => V(Math.sin(rotY), 0, Math.cos(rotY));
const camAt = (pos, target, fov = 40, roll = 0) => ({ pos: [...pos], target: [...target], fov, roll });
const P3 = (v) => [v.x, v.y, v.z];
const headCam = (ch, dist, dy = 0, dx = 0, ty = 0, fov = 40) => {
  const h = ch.headPos(), f = fwd(ch.p.rotY), l = V(f.z, 0, -f.x);
  const p = h.clone().add(f.multiplyScalar(dist)).add(V(0, dy, 0)).add(l.multiplyScalar(dx));
  return camAt(P3(p), [h.x, h.y + ty, h.z], fov);
};
const rel = (ch, f, l, y) => { const F = fwd(ch.p.rotY), L = V(F.z, 0, -F.x); return [ch.p.pos[0] + F.x * f + L.x * l, y, ch.p.pos[1] + F.z * f + L.z * l]; };

// ------------------------------------------------------------------ the storm clock (video time): lightning on the beats
const B = [0.0, 0.673, 1.346, 2.02, 2.67, 3.343, 4.017, 4.69, 5.34, 6.014, 6.687, 7.337, 8.01, 8.684, 9.357, 10.007, 10.681, 11.354, 12.027, 12.678, 13.351, 14.001, 14.675, 15.348];
export const FLASH = [B[1], B[5], B[7], B[11], B[12], B[13], B[14], B[16], B[18]];      // thunder + lightning (none after the door opens)
const flashK = (t) => FLASH.reduce((a, f) => a + (t >= f ? Math.exp(-(t - f) / 0.09) + 0.6 * Math.exp(-Math.abs(t - f - 0.14) / 0.04) : 0), 0);
function storm(W, lt, base = 0.8) {
  const k = Math.min(2.5, flashK(W.t0 + lt));
  if (W.lights) { W.lights.key.intensity = base + 5 * k; W.lights.hemi.intensity = (W.hemiBase ?? 0.5) + 0.8 * k; }
  if (W.cloudMat) W.cloudMat.color.setRGB(0.1 + 0.6 * k, 0.12 + 0.62 * k, 0.19 + 0.7 * k);
  (W.skyBolts || []).forEach((b, i) => { b.visible = k > 0.35 && ((i + Math.floor((W.t0 + lt) * 3)) % 2 === 0 || k > 1.2); });
  return k;
}
function night(W, at, o = {}) {
  S.lights(W, { sky: 0x6a7ab0, ground: 0x2a2c34, hemi: o.hemi ?? 0.85, key: 0xc8d4ff, keyI: 0.8, fillI: 0 });
  W.hemiBase = o.hemi ?? 0.85;
  S.keyAt(W, [at[0], 1, at[2]], { from: [-6, 14, -10], size: o.size ?? 12 });
  ST.stormSky(W, at);
  W.skyBolts = [ST.bolt(W.scene, [at[0] - 18, 40, at[2] - 50], [at[0] - 10, 6, at[2] - 46], { seed: 3 }), ST.bolt(W.scene, [at[0] + 20, 42, at[2] - 55], [at[0] + 14, 4, at[2] - 50], { seed: 7 })];
}
// glowing eyes (white-gold) + a red electric aura on the god
function godFx(W, c, ch, { eyes = 1, aura = 1 } = {}) {
  if (!c.eyeGlow) {
    c.eyeGlow = [-1, 1].map(() => S.glowSprite(W.scene, [0, 0, 0], 0.16, 'rgba(255,245,200,1)', 1.0));
    c.eyeCore = [-1, 1].map(() => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.02, 0.004), new THREE.MeshBasicMaterial({ color: '#fffbe8' })); W.scene.add(m); return m; });
    c.aura = S.glowSprite(W.scene, [0, 0, 0], 2.2, 'rgba(255,60,40,0.9)', 0.35);
  }
  [-1, 1].forEach((sd, i) => { const p = hl(ch, sd * 0.031, 0.004, 0.092); c.eyeGlow[i].position.copy(p); c.eyeGlow[i].material.opacity = Math.min(1, 0.85 * eyes); c.eyeGlow[i].scale.setScalar(0.035 + 0.02 * eyes); c.eyeCore[i].position.copy(p); c.eyeCore[i].quaternion.copy(ch.head.getWorldQuaternion(new THREE.Quaternion())); c.eyeCore[i].visible = eyes > 0.2; });
  c.aura.position.copy(ch.chestPos()).add(V(0, -0.1, -0.15)); c.aura.material.opacity = 0.22 * aura;
}
// the cape in the wind: wind 0..1, lift = how high it flies out behind
function capeWave(ch, t, wind = 0.5, grow = 1) {
  if (!ch.cape) return;
  const pos = ch.cape.geometry.attributes.position, base = ch.capeBase, L = ch.capeLen;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], y = base[i * 3 + 1], d = -y / L;
    const flap = Math.sin(t * (6 + wind * 6) + d * 5 + x * 7) * 0.08 * d * (0.4 + wind) + Math.sin(t * 13 + d * 9) * 0.02 * d * wind;
    const back = -Math.pow(d, 1.25) * L * (0.12 + 0.75 * wind);
    pos.setXYZ(i, x * (1 + 0.45 * d), y * (1 - 0.45 * wind * d) * grow, (back + flap) * grow);
  }
  pos.needsUpdate = true; ch.cape.geometry.computeVertexNormals();
}
// a red lightning trail behind a moving point: path(t) -> Vector3, rebuilt every frame
function trail(W, c, path, lt, len = 0.3) {
  if (c.trail) { c.trail.forEach((m) => { W.scene.remove(m); m.geometry.dispose(); }); }
  c.trail = [];
  const R = rng(Math.floor(lt * 30) + 1);
  for (const [col, r, jit] of [['#ff2a1a', 0.07, 0.18], ['#ffe24a', 0.03, 0.12], ['#ff6a3a', 0.04, 0.25]]) {
    const pts = []; for (let i = 0; i <= 14; i++) { const p = path(lt - len * (i / 14)).add(V((R() - 0.5) * jit, 0.9 + (R() - 0.5) * jit, (R() - 0.5) * jit)); pts.push(p); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, r, 5), new THREE.MeshBasicMaterial({ color: col, fog: false }));
    W.scene.add(m); c.trail.push(m);
  }
}
const SOFA = [ST.LIV.x0, -1.42];
const sitCouch = (ch) => { sitAt(ch, SOFA[0], SOFA[1], 0); ch.p.y = 0.14; };
const holdPhone = (c, lt, k = 0) => { const ch = c.you; const p = rel(ch, 0.3, -0.05, 0.98); c.ph.position.set(p[0] + Math.sin(lt * 70) * 0.004 * k, p[1], p[2]); c.ph.rotation.set(-0.5, ch.p.rotY, 0); ch.p.gripR = c.ph; ch.p.handL = [p[0] + 0.05, p[1] - 0.04, p[2] - 0.02]; ch.p.handPoseL = 'grip'; };

export const SHOTS = {
  // 01 on the couch at night, scrolling his phone, bored (the rain on the window, lightning)
  1: {
    build(W) { S.lights(W, { sky: 0x8a9ac8, ground: 0x4a3a30, hemi: 0.95, key: 0xffd8b0, keyI: 1.0, fillI: 0 }); S.keyAt(W, [0, 1, -1], { from: [3, 6, 5], size: 5 }); W.scene.background = new THREE.Color('#0a0c14'); const c = { L: ST.buildLiving(W) }; c.you = person(W, 'you'); c.ph = ST.phone(W.scene); return c; },
    update(W, c, lt) { sitCouch(c.you); face(c.you, 'squint', 'neutral', 'frown', { headPitch: -0.38, lean: -0.1 }); holdPhone(c, lt); helpers.blink(c.you, lt + 0.4); },
    after(W, c, lt) { c.ph.userData.draw('feed', 0, lt * 160); const k = flashK(W.t0 + lt); c.L.winM.emissiveIntensity = 0.5 + 2.5 * Math.min(1, k); },
    cam: (W, c, lt) => camAt([0.85 - lt * 0.1, 1.15, 0.55], [0.0, 0.95, -1.35], 50),
  },
  // 02 the phone buzzes: "Babe" (heart): "I'm home alone" (smiley)
  2: {
    build(W) { S.lights(W, { sky: 0x8a9ac8, ground: 0x4a3a30, hemi: 0.95, key: 0xffd8b0, keyI: 1.0, fillI: 0 }); S.keyAt(W, [0, 1, -1], { from: [3, 6, 5], size: 5 }); W.scene.background = new THREE.Color('#0a0c14'); const c = { L: ST.buildLiving(W) }; c.you = person(W, 'you'); c.ph = ST.phone(W.scene); return c; },
    update(W, c, lt) { sitCouch(c.you); face(c.you, 'open', 'raised', 'tight', { headPitch: -0.38 }); holdPhone(c, lt, lt < 0.35 ? 1 : 0); },
    after(W, c, lt) { c.ph.userData.draw('msg', clamp((lt - 0.12) / 0.2)); },
    cam: (W, c, lt) => { const p = c.ph.position, n = V(0, 0, 1).applyQuaternion(c.ph.quaternion), up = V(0, 1, 0).applyQuaternion(c.ph.quaternion); return camAt(P3(p.clone().addScaledVector(n, 0.27 - lt * 0.03).addScaledVector(up, 0.035)), P3(p.clone().addScaledVector(up, 0.035)), 40); },
  },
  // 03 slow zoom on his face: the eyes go wide, he slowly looks at the camera
  3: {
    build(W) { S.lights(W, { sky: 0x8a9ac8, ground: 0x4a3a30, hemi: 0.95, key: 0xffd8b0, keyI: 1.0, fillI: 0 }); S.keyAt(W, [0, 1, -1], { from: [3, 6, 5], size: 5 }); W.scene.background = new THREE.Color('#0a0c14'); const c = { L: ST.buildLiving(W) }; c.you = person(W, 'you'); c.ph = ST.phone(W.scene); return c; },
    update(W, c, lt) {
      sitCouch(c.you); const w = lt > 0.55, k = smooth(clamp((lt - 1.0) / 0.8));
      face(c.you, w ? 'wide' : 'open', w ? 'raised' : 'neutral', w ? 'o' : 'tight', { headPitch: lerp(-0.38, 0.0, k), pupils: [0, lerp(-0.6, 0, k)] }); holdPhone(c, lt);
    },
    after(W, c, lt) { c.ph.userData.draw('msg', 1); },
    cam: (W, c, lt) => headCam(c.you, lerp(0.95, 0.42, easeInOut(lt / 2.02)), -0.02, 0, -0.01, 40),
  },
  // 04 "drink for me": he stands up slowly; a lightning bolt strikes him from the sky. BOOM, red lightning everywhere
  4: {
    build(W) {
      S.lights(W, { sky: 0x5a6a9a, ground: 0x2a2420, hemi: 0.5, key: 0xffb0a0, keyI: 0.6, fillI: 0 }); S.keyAt(W, [0, 1, -1], { from: [2, 8, 3], size: 5 }); W.hemiBase = 0.5;
      W.scene.background = new THREE.Color('#06070c'); const c = { L: ST.buildLiving(W) }; c.you = person(W, 'you'); c.god = person(W, 'hero'); c.hood = ST.hoodieProp(W.scene);
      c.b1 = ST.bolt(W.scene, [0.5, 12, -2.5], [0, 1.9, -1.0], { seed: 11, color: '#fff4f0', glow: 'rgba(255,60,40,0.9)', r: 0.09, branches: 3 });
      c.red = new THREE.PointLight(0xff3020, 0, 9, 1.4); c.red.position.set(0, 2.5, -0.6); W.scene.add(c.red); return c;
    },
    update(W, c, lt) {
      const up = smooth(clamp(lt / 1.1)), on = lt >= 0.1;
      for (const ch of [c.you, c.god]) { sitCouch(ch); ch.p.sit = 1 - up; ch.p.pos = [SOFA[0], SOFA[1] + 0.12 * up]; ch.p.y = 0.14 * (1 - up); }
      c.you.p.visible = !on; c.god.p.visible = on;
      face(c.god, 'squint', 'angry', 'tight', { headPitch: lerp(-0.15, 0.12, up), lean: lerp(0.2, -0.06, up) });
      face(c.you, 'wide', 'raised', 'o');
      c.god.p.handL = rel(c.god, 0.12, 0.34, lerp(0.75, 1.0, up)); c.god.p.handR = rel(c.god, 0.12, -0.34, lerp(0.75, 1.0, up)); c.god.p.handPoseL = c.god.p.handPoseR = 'fist';
    },
    after(W, c, lt) {
      storm(W, lt, 0.6); const k = flashK(W.t0 + lt);
      c.b1.visible = lt < 0.45 && Math.floor(lt * 20) % 3 !== 2; c.red.intensity = 30 * Math.min(1, k) + 4;
      capeWave(c.god, lt, 0.6, smooth(clamp((lt - 0.15) / 0.5))); godFx(W, c, c.god, { eyes: smooth(clamp((lt - 0.3) / 0.3)), aura: 1 });
      c.hood.position.set(SOFA[0] + 0.25, 0.66, SOFA[1] + 0.05); c.hood.visible = lt > 0.15;
    },
    cam: (W, c, lt) => camAt([1.05, 0.55, 0.45 - lt * 0.1], [0.0, 1.45, -1.3], 54),
    anchors: (W, c) => ({ chest: c.god.chestPos(), head: c.god.headPos() }),
  },
  // 05 close-up: the eyes glow, the wind blows his hair back, the rain swirls round him
  5: {
    build(W) { S.lights(W, { sky: 0x5a6a9a, ground: 0x2a2420, hemi: 0.5, key: 0xffb0a0, keyI: 0.9, fillI: 0 }); W.scene.background = new THREE.Color('#06070c'); const c = { L: ST.buildLiving(W) }; c.god = person(W, 'hero'); const l = new THREE.PointLight(0xff3020, 8, 6, 1.5); l.position.set(0.4, 2.0, -0.4); W.scene.add(l); return c; },
    update(W, c, lt) { standAt(c.god, SOFA[0], SOFA[1] + 0.12, 0); face(c.god, 'squint', 'angry', 'tight', { headPitch: 0.12, headRoll: Math.sin(lt * 9) * 0.02 }); },
    after(W, c, lt) { capeWave(c.god, lt + 1, 0.8); godFx(W, c, c.god, { eyes: 1.4 }); },
    cam: (W, c, lt) => headCam(c.god, 0.5 - lt * 0.12, -0.06, 0, 0.0, 40),
    anchors: (W, c) => ({ head: c.god.headPos(), chest: c.god.chestPos() }),
  },
  // 06 wide: the long dark cape billows out behind him; the hoodie lies on the couch
  6: {
    build(W) { S.lights(W, { sky: 0x5a6a9a, ground: 0x2a2420, hemi: 0.55, key: 0xffb0a0, keyI: 0.8, fillI: 0 }); S.keyAt(W, [0, 1, -1], { from: [3, 7, 4], size: 5 }); W.scene.background = new THREE.Color('#06070c'); const c = { L: ST.buildLiving(W) }; c.god = person(W, 'hero'); c.hood = ST.hoodieProp(W.scene); const l = new THREE.PointLight(0xff3020, 8, 6, 1.5); l.position.set(0.6, 2.2, 0.2); W.scene.add(l); return c; },
    update(W, c, lt) { standAt(c.god, SOFA[0], SOFA[1] + 0.55, 0); face(c.god, 'squint', 'angry', 'smile', { headPitch: 0.15 }); c.god.p.chestPuff = 0.5; c.god.p.handL = rel(c.god, 0.05, 0.3, 0.95); c.god.p.handR = rel(c.god, 0.05, -0.3, 0.95); c.god.p.handPoseL = c.god.p.handPoseR = 'fist'; },
    after(W, c, lt) { capeWave(c.god, lt + 2, 1.0); godFx(W, c, c.god, { eyes: 1.2 }); c.hood.position.set(SOFA[0] - 0.35, 0.64, SOFA[1] + 0.02); },
    cam: (W, c, lt) => camAt([1.9 - lt * 0.2, 1.25, 1.2], [0.0, 1.1, -1.0], 52),
    anchors: (W, c) => ({ chest: c.god.chestPos() }),
  },
  // 07 outside in the storm: the slow-motion walk toward the camera; each step lands on a beat; lightning behind him
  7: {
    build(W) { night(W, [ST.ST.x0, 0, -10]); const c = { S: ST.buildStreet(W) }; c.god = person(W, 'hero'); return c; },
    update(W, c, lt) { const z = -3.6 + lt * 1.05; standAt(c.god, ST.ST.x0 + 0.2, z, Math.PI * 0); c.god.p.rotY = 0; c.god.p.walk = (lt / 0.673) * Math.PI + Math.PI / 2; c.god.p.chestPuff = 0.5; face(c.god, 'squint', 'angry', 'smile', { headPitch: 0.12 }); },
    after(W, c, lt) { storm(W, lt, 0.5); capeWave(c.god, lt, 0.9); godFx(W, c, c.god, { eyes: 1.2 }); },
    cam: (W, c, lt) => camAt([ST.ST.x0 + 0.5, 0.7, 1.5 + lt * 0.4], [ST.ST.x0 + 0.15, 1.5, -4], 46),
    anchors: (W, c) => ({ chest: c.god.chestPos(), head: c.god.headPos() }),
  },
  // 08 closer: chin up, shoulders back, a calm evil smile; step, step
  8: {
    build(W) { night(W, [ST.ST.x0, 0, -10]); const c = { S: ST.buildStreet(W) }; c.god = person(W, 'hero'); return c; },
    update(W, c, lt) { const z = -2.8 + lt * 1.05; standAt(c.god, ST.ST.x0 + 0.2, z, 0); c.god.p.walk = (lt / 0.673) * Math.PI + Math.PI / 2; c.god.p.chestPuff = 0.6; face(c.god, 'squint', 'angry', 'smile', { headPitch: 0.18 }); },
    after(W, c, lt) { storm(W, lt, 0.5); capeWave(c.god, lt + 1.3, 0.9); godFx(W, c, c.god, { eyes: 1.3 }); },
    cam: (W, c, lt) => { const h = c.god.headPos(); return camAt([h.x + 0.25, h.y - 0.35, h.z + 1.65], [h.x, h.y - 0.25, h.z], 42); },
    anchors: (W, c) => ({ chest: c.god.chestPos(), head: c.god.headPos() }),
  },
  // 09 he zooms past the cars in a red blur with a lightning trail: the cars spin
  9: {
    build(W) { night(W, [ST.ST.x0, 0, -10]); const c = { S: ST.buildStreet(W) }; c.god = person(W, 'hero'); return c; },
    update(W, c, lt) { const p = path9(lt); standAt(c.god, p.x, p.z, Math.PI); c.god.p.walk = lt * 42; c.god.p.lean = 0.45; face(c.god, 'squint', 'angry', 'grin'); },
    after(W, c, lt) {
      storm(W, lt, 0.5); capeWave(c.god, lt, 1.0); godFx(W, c, c.god, { eyes: 1.2 }); trail(W, c, path9, lt, 0.35);
      c.S.cars.forEach((car, i) => { const pz = car.position.z, pass = clamp((path9(lt).z < pz ? 1 : 0) * (pz - path9(lt).z) / 6); car.rotation.y = (i % 2 ? Math.PI : 0) + pass * (i % 2 ? -2.6 : 2.6); });
    },
    cam: (W, c, lt) => camAt([ST.ST.x0 + 4.2, 1.6, 4.0], [ST.ST.x0 - 0.4, 0.9, -14], 50),
    anchors: (W, c) => ({ chest: c.god.chestPos() }),
  },
  // 10 straight up the side of a building (from below)
  10: {
    build(W) { night(W, [ST.WA.x0, 0, 0], { size: 20 }); const c = { Wl: ST.buildWall(W) }; c.god = person(W, 'hero'); return c; },
    update(W, c, lt) { const p = path10(lt); standAt(c.god, p.x, p.z, Math.PI, p.y); c.god.p.walk = lt * 44; c.god.p.lean = -0.3; face(c.god, 'squint', 'angry', 'grin'); },
    after(W, c, lt) { storm(W, lt, 0.5); capeWave(c.god, lt, 1.0); godFx(W, c, c.god, { eyes: 1.0 }); trail(W, c, path10, lt, 0.3); },
    cam: (W, c, lt) => { const p = path10(lt); return camAt([ST.WA.x0 + 2.2, 0.7, 6.5], [p.x, p.y + 1.0, p.z], 50); },
    anchors: (W, c) => ({ chest: c.god.chestPos() }),
  },
  // 11 over the bridge in the rain
  11: {
    build(W) { night(W, [ST.BR.x0, 0, -20], { size: 30 }); const c = { Bg: ST.buildBridge(W) }; c.god = person(W, 'hero'); return c; },
    update(W, c, lt) { const p = path11(lt); standAt(c.god, p.x, p.z, Math.PI); c.god.p.walk = lt * 42; c.god.p.lean = 0.45; face(c.god, 'squint', 'angry', 'grin'); },
    after(W, c, lt) { storm(W, lt, 0.5); capeWave(c.god, lt, 1.0); godFx(W, c, c.god, { eyes: 1.0 }); trail(W, c, path11, lt, 0.35); },
    cam: (W, c, lt) => { const p = path11(lt); return camAt([ST.BR.x0 + 7.5, 2.4, p.z * 0.4 - 2], [p.x, 1.0, p.z], 50); },
    anchors: (W, c) => ({ chest: c.god.chestPos() }),
  },
  // 12 the leaves fly, a man's hat blows off as he zooms past
  12: {
    build(W) {
      night(W, [ST.ST.x0, 0, -10]); const c = { S: ST.buildStreet(W) }; c.god = person(W, 'hero'); c.man = person(W, 'crowd7', { hat: 'bowler', hatColor: '#2a2a30', female: false, skirt: null, hairStyle: 'short', face: { lash: false, blush: undefined } });
      c.leaves = []; const R = rng(5); for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), new THREE.MeshStandardMaterial({ color: ['#e88a2a', '#c8a02a', '#5aa04a'][i % 3], side: THREE.DoubleSide })); W.scene.add(m); m.userData = { a: R() * 6, r: 0.5 + R() * 1.5, h: R() * 1.5, s: 0.7 + R() }; c.leaves.push(m); }
      return c;
    },
    update(W, c, lt) {
      standAt(c.man, ST.ST.x0 + 5.6, 1.0, -Math.PI / 2 - 0.4); face(c.man, lt > 0.2 ? 'wide' : 'open', 'raised', lt > 0.2 ? 'o' : 'neutral', { headYaw: lt > 0.2 ? 0.5 : 0 });
      const p = path12(lt); standAt(c.god, p.x, p.z, Math.PI); c.god.p.walk = lt * 44; c.god.p.lean = 0.45; face(c.god, 'squint', 'angry', 'grin');
    },
    after(W, c, lt) {
      storm(W, lt, 0.5); capeWave(c.god, lt, 1.0); godFx(W, c, c.god, { eyes: 1.0 }); trail(W, c, path12, lt, 0.3);
      const k = clamp((lt - 0.18) / 0.5); if (c.man.hat) { c.man.hat.position.set(0, easeOut(k) * 1.6, -k * 0.5); c.man.hat.rotation.set(k * 6, k * 3, k * 2); }
      c.leaves.forEach((m) => { const u = m.userData, kk = clamp((lt - 0.15) * u.s); m.position.set(ST.ST.x0 + 5.0 + Math.cos(u.a + kk * 5) * u.r * kk, 0.1 + u.h * kk + kk * 1.2, 0.6 + Math.sin(u.a + kk * 5) * u.r * kk); m.rotation.set(kk * 9 + u.a, kk * 7, u.a); });
    },
    cam: (W, c, lt) => camAt([ST.ST.x0 + 3.2, 1.45, 4.4], [ST.ST.x0 + 5.0, 1.4, 0.6], 46),
    anchors: (W, c) => ({ chest: c.god.chestPos(), hat: c.man.headPos().add(V(0, 0.2, 0)) }),
  },
  // 13 round the corner toward her street (high, wide)
  13: {
    build(W) { night(W, [ST.ST.x0, 0, -10], { hemi: 1.1 }); const c = { S: ST.buildStreet(W) }; c.god = person(W, 'hero'); for (const z of [-18, -26]) { const l = new THREE.PointLight(0xffd8a0, 10, 14, 1.4); l.position.set(ST.ST.x0 + 2, 3.5, z); W.scene.add(l); } return c; },
    update(W, c, lt) { const p = path13(lt); standAt(c.god, p.x, p.z, Math.atan2(path13(lt + 0.02).x - p.x, path13(lt + 0.02).z - p.z)); c.god.p.walk = lt * 44; c.god.p.lean = 0.45; face(c.god, 'squint', 'angry', 'grin'); },
    after(W, c, lt) { storm(W, lt, 0.5); capeWave(c.god, lt, 1.0); godFx(W, c, c.god, { eyes: 1.0 }); trail(W, c, path13, lt, 0.32); },
    cam: (W, c, lt) => camAt([ST.ST.x0 + 4.5, 3.2, -10.5], [ST.ST.x0 + 2.5, 0.8, -24], 52),
    anchors: (W, c) => ({ chest: c.god.chestPos() }),
  },
  // 14 he screeches to a stop at her front door (smoke), fixes his hair, big smile, knocks on the beat
  14: {
    build(W) { night(W, [ST.HO.x0, 0, 0], { size: 8, hemi: 0.6 }); const c = { H: ST.buildHouse(W) }; c.god = person(W, 'hero'); c.sm = ST.smokePuffs(W.scene, 9); return c; },
    update(W, c, lt) {
      const k = easeOut(clamp(lt / 0.22)); standAt(c.god, ST.HO.x0 + lerp(-4.5, 0.15, k), 1.05, k < 1 ? Math.PI / 2 : Math.PI); c.god.p.lean = k < 1 ? -0.25 : 0; c.god.p.walk = k < 1 ? lt * 40 : null;
      face(c.god, lt > 0.45 ? 'happy' : 'squint', 'raised', lt > 0.45 ? 'grin' : 'smile', { headYaw: lt > 0.3 && lt < 0.62 ? -1.0 : -0.25 });
      if (lt > 0.28 && lt < 0.55) { const h = c.god.headPos(); c.god.p.handR = [h.x - 0.05, h.y + 0.12, h.z + 0.02]; c.god.p.handPoseR = 'flat'; }
      if (lt >= 0.55) { const a = Math.max(0, Math.sin((lt - 0.62) * Math.PI * 2 * 4)); c.god.p.handR = [ST.HO.x0 + 0.25, 1.45, 0.16 + 0.12 * a]; c.god.p.handPoseR = 'fist'; }
    },
    after(W, c, lt) {
      storm(W, lt, 0.4); capeWave(c.god, lt, lt < 0.25 ? 1.0 : 0.15); godFx(W, c, c.god, { eyes: 0.9 });
      c.sm.children.forEach((m, i) => { const kk = clamp((lt - 0.15 - i * 0.02) / 1.0); m.position.set(ST.HO.x0 - 0.6 - i * 0.35 - kk * 0.3, 0.25 + kk * (0.6 + i * 0.05), 1.25 + Math.sin(i) * 0.3); m.scale.setScalar(0.3 + kk * (1.0 + (i % 3) * 0.3)); }); c.sm.userData.mat.opacity = 0.7 * (1 - clamp((lt - 0.7) / 0.6));
    },
    cam: (W, c, lt) => camAt([ST.HO.x0 + 1.9, 1.5, 1.55], [ST.HO.x0 + 0.05, 1.35, 0.85], 46),
    anchors: (W, c) => ({ chest: c.god.chestPos(), door: [ST.HO.x0 + 0.25, 1.45, 0.1] }),
  },
  // 15 the door opens: HER DAD, arms crossed, staring (the music and the thunder stop: only rain)
  15: {
    build(W) { night(W, [ST.HO.x0, 0, 0], { size: 8, hemi: 0.75 }); const c = { H: ST.buildHouse(W) }; c.dad = person(W, 'dad'); const im = c.H.inside.material = c.H.inside.material.clone(); im.color.set('#8a5a3a'); im.emissiveIntensity = 0.3; const l = new THREE.PointLight(0xc8d4ff, 1.2, 3, 1.5); l.position.set(ST.HO.x0 - 0.4, 1.9, 1.3); W.scene.add(l); return c; },
    update(W, c, lt) {
      c.dad.p.visible = lt >= 0.06; standAt(c.dad, ST.HO.x0 + 0.0, lerp(-0.25, 0.3, easeOut(clamp((lt - 0.06) / 0.3))), 0); face(c.dad, 'open', 'angry', 'frown', { lookAt: [ST.HO.x0 + 0.08, 1.66, 1.55] });
      const cp = c.dad.chestPos(); c.dad.p.handL = [cp.x - 0.16, cp.y - 0.03, cp.z + 0.13]; c.dad.p.handR = [cp.x + 0.16, cp.y + 0.0, cp.z + 0.15]; c.dad.p.handPoseL = c.dad.p.handPoseR = 'fist';
    },
    after(W, c, lt) { storm(W, lt, 0.4); c.H.door.rotation.y = -easeOut(clamp(lt / 0.28)) * 1.5; },
    cam: (W, c, lt) => camAt([ST.HO.x0 + 0.08, 1.66, 1.55], [ST.HO.x0 + 0.0, 1.62, 0.3], 50),
  },
  // 16 freeze on his face: the smile drops, a sweat drop slides down, the lightning fizzles out with a small spark
  16: {
    build(W) { night(W, [ST.HO.x0, 0, 0], { size: 8, hemi: 0.6 }); const c = { H: ST.buildHouse(W) }; c.god = person(W, 'hero'); c.H.door.rotation.y = -1.5; return c; },
    update(W, c, lt) { standAt(c.god, ST.HO.x0 + 0.1, 1.25, Math.PI + 0.05); const d = lt > 0.3; face(c.god, d ? 'wide' : 'happy', d ? 'worried' : 'raised', d ? 'tight' : 'grin', { headPitch: 0.06 }); },
    after(W, c, lt) { storm(W, lt, 0.4); capeWave(c.god, 0.5, 0.2); const fz = 1 - clamp((lt - 0.55) / 0.35); godFx(W, c, c.god, { eyes: 0.9 * fz + (lt > 0.55 && lt < 0.95 && Math.floor(lt * 25) % 2 ? 0.5 : 0), aura: fz }); },
    cam: (W, c, lt) => headCam(c.god, 0.62, -0.02, 0.02, -0.01, 40),
    anchors: (W, c) => ({ forehead: forehead(c.god), shoulder: c.god._w(V(0.16, c.god.torsoH * 0.9, 0.05), c.god.chest) }),
  },
};

// the zoom paths (shot-local time -> position on the ground / wall)
function path9(t) { return V(ST.ST.x0 - 0.2 + Math.sin(t * 9) * 0.6, 0, 4 - t * 34); }
function path10(t) { return V(ST.WA.x0 + 0.2, Math.max(0, t * 22), 0.45); }
function path11(t) { return V(ST.BR.x0 + 0.4, 0, 8 - t * 40); }
function path12(t) { return V(ST.ST.x0 + 4.4, 0, 9 - t * 26); }
function path13(t) { const k = clamp(t / 0.67); const a = k * Math.PI / 2; return V(ST.ST.x0 + 8 - Math.cos(a) * 9, 0, -20 + Math.sin(a) * 9 - 9); }
