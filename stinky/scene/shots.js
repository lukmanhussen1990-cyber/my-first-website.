// Shot list for "Stinky Date". Every cut is anchored to a line/word time from build/timeline.json.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, ramp, pulse, hash, noise1, aim2 } from './lib.js';
import { pose, DIM } from './chars.js';
import { drawCentered } from './font.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildShots(TL, Wd) {
  const { S, cast, fx, world, OFFSETS, setLights, W, H, scene } = Wd;
  const K = W / 1080;
  const YOU = cast.you, CR = cast.crush, WT = cast.waiter, PA = cast.pa, PB = cast.pb, PC = cast.pc;
  const L = {}; TL.lines.forEach((l) => { L[l.id] = l; });
  const A = TL.anchors;
  const w = (id, k) => L[id].words[k].s;
  const shots = [];
  const add = (t, name, fn) => shots.push({ t, name, fn });

  // ---------- helpers ----------
  let curO = OFFSETS.cafe;
  function use(c, set) { c.set = set; c.o = OFFSETS[set]; curO = c.o; c.showSet(set); setLights(set); c.overlays = c.overlays || []; }
  const P = (c, x, y, z) => V(c.o.x + x, c.o.y + y, c.o.z + z);
  function place(ch, x, z, ry = 0, y = 0) { ch.root.visible = true; ch.root.position.set(curO.x + x, y, curO.z + z); ch.root.rotation.y = ry; return ch; }
  function cam(c, Ac, Bc, ease = easeInOut, u = c.u) {
    const k = Bc ? ease(u) : 0; Bc = Bc || Ac;
    c.camPos.set(c.o.x + lerp(Ac.p[0], Bc.p[0], k), lerp(Ac.p[1], Bc.p[1], k), c.o.z + lerp(Ac.p[2], Bc.p[2], k));
    c.camLook.set(c.o.x + lerp(Ac.l[0], Bc.l[0], k), lerp(Ac.l[1], Bc.l[1], k), c.o.z + lerp(Ac.l[2], Bc.l[2], k));
    c.fov = lerp(Ac.f ?? 40, Bc.f ?? Ac.f ?? 40, k);
  }
  const headPos = (ch) => { ch.root.updateMatrixWorld(true); const v = new THREE.Vector3(); ch.headMesh.getWorldPosition(v); return v; };
  const fwd = (ch) => V(Math.sin(ch.root.rotation.y), 0, Math.cos(ch.root.rotation.y));
  const right = (ch) => { const f = fwd(ch); return V(f.z, 0, -f.x); };
  function faceCam(c, ch, d0, d1, o = {}) {
    const hp = headPos(ch).add(V(0, o.dy ?? -0.15, 0));
    const f = fwd(ch); if (o.yaw) f.applyAxisAngle(V(0, 1, 0), o.yaw);
    const d = lerp(d0, d1, (o.ease ?? easeInOut)(o.u ?? c.u));
    c.camPos.copy(hp).addScaledVector(f, d); c.camPos.y += o.up ?? 0;
    c.camLook.copy(hp); c.camLook.y += o.lookUp ?? 0;
    if (o.side) { const r = V(f.z, 0, -f.x); c.camPos.addScaledVector(r, o.side); }
    c.fov = o.fov ?? 36;
  }
  function reach(ch, side, target, pole) {
    ch.root.updateMatrixWorld(true);
    const arm = ch.arms[side];
    const v = ch.body.worldToLocal(target.clone()).sub(arm.shoulder.position.clone());
    const a = DIM.UA, b = DIM.FA + 0.1;
    const n = v.clone().normalize(); const d = clamp(v.length(), 0.1, a + b - 0.002);
    const pl = V(...(pole || [arm.s * 0.7, -1, -0.5])).normalize();
    const m = pl.sub(n.clone().multiplyScalar(pl.dot(n))); if (m.lengthSq() < 1e-6) m.set(arm.s, 0, 0); m.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const up = n.clone().multiplyScalar(cosA).add(m.clone().multiplyScalar(sinA));
    const lo = n.clone().multiplyScalar(d).sub(up.clone().multiplyScalar(a)).normalize();
    aim2(arm.shoulder, arm.elbow, up.toArray(), lo.toArray());
  }
  function lookAt(ch, target, k = 1) {
    const hp = headPos(ch); const dir = target.clone().sub(hp).applyQuaternion(ch.root.quaternion.clone().invert());
    ch.neck.rotation.y = clamp(Math.atan2(dir.x, dir.z), -1.3, 1.3) * k;
    ch.neck.rotation.x = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.6) * k;
  }
  function talking(t, id) { for (const x of L[id].words) if (t >= x.s - 0.02 && t <= x.e) return Math.sin((t - x.s) * 24) > -0.3; return false; }
  const blink = (t, seed) => ((t + hash(seed) * 3) % 3.3) < 0.1;
  function propAt(name, pos, rot = [0, 0, 0], s = 1) { const o = world[name]; o.visible = true; o.position.copy(pos); o.rotation.set(rot[0], rot[1], rot[2]); o.scale.setScalar(s); return o; }
  const mouthPos = (ch, out = 0.32) => headPos(ch).addScaledVector(fwd(ch), out).add(V(0, -0.1, 0));
  const sweat = (c, ch, n, size = 0.15, seed = 1) => fx.sweat(headPos(ch), c.t, n, size, seed, fwd(ch));
  function vignette(c, k = 0.45, col = '0,0,0') { c.overlays.push((o) => { const g = o.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.62); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`); o.fillStyle = g; o.fillRect(0, 0, W, H); }); }
  function tint(c, rgba) { c.overlays.push((o) => { o.fillStyle = rgba; o.fillRect(0, 0, W, H); }); }
  function speedLines(c, k, seed = 0) {
    c.overlays.push((o) => { o.save(); o.translate(W / 2, H / 2);
      for (let i = 0; i < 60; i++) { const a = hash(seed + i) * Math.PI * 2, r0 = H * (0.33 + 0.12 * hash(i * 3)), len = H * (0.18 + 0.25 * hash(i * 7));
        o.strokeStyle = `rgba(255,255,255,${(0.4 * k * (0.5 + 0.5 * hash(i + Math.floor(c.t * 14)))).toFixed(3)})`; o.lineWidth = (2 + 5 * hash(i * 5)) * K;
        o.beginPath(); o.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); o.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); o.stroke(); }
      o.restore(); });
  }
  function bigText(c, text, t0, color = '#ffd23f', y = 0.13, size = 36, x = 0.5) {
    const k = easeOutBack(clamp((c.t - t0) / 0.16));
    c.overlays.push((o) => drawCentered(o, text, W * x, H * y, Math.max(2, Math.round(size * K * lerp(0.4, 1, k))), { color, outline: Math.round(5 * K), outlineColor: '#000', shadow: Math.round(5 * K) }));
  }
  const fade = (c, k) => { if (k > 0) tint(c, `rgba(0,0,0,${k.toFixed(3)})`); };

  // ---------- staging ----------
  const BED_Z = -1.75, SEAT_BED = 0.63;
  function inBed(c, lie) {
    use(c, 'bedroom');
    place(YOU, 0, BED_Z); pose.sit(YOU, SEAT_BED);
    YOU.body.rotation.x = -1.35 * lie;
    const ring = c.t < A.alarmEnd;
    S.bedroom.clockBody.rotation.z = ring ? Math.sin(c.t * 70) * 0.13 : 0;
    S.bedroom.clockBody.position.y = 0.2 + (ring ? Math.abs(Math.sin(c.t * 35)) * 0.02 : 0);
    if (ring) { const cp = P(c, 1.45, 0.86, -2.45); for (const sg of [1, -1]) { const ph = (c.t * 3) % 1; fx.sprite('arcs', cp.clone().add(V(sg * (0.28 + ph * 0.1), 0.08, 0)), [0.22, 0.22], { opacity: 1 - ph, rot: sg > 0 ? 0 : Math.PI, order: 30 }); } }
  }
  const BATH = { x: 0, z: -1.3 };
  const DATE = { crush: [-0.8, -1.7], you: [0.8, -1.7] };
  function cafe(c, o = {}) {
    use(c, 'cafe');
    if (!o.noCrush) { place(CR, DATE.crush[0], DATE.crush[1], Math.PI / 2); pose.sit(CR, 0.53); CR.extras.hem.rotation.x = -Math.PI / 2 + 0.4; CR.extras.hem.position.set(0, 0.05, 0.1); reach(CR, 'L', P(c, -0.35, 0.82, -1.45), [1, -1, 0]); reach(CR, 'R', P(c, -0.35, 0.82, -1.95), [-1, -1, 0]); }
    if (!o.noYou) { place(YOU, DATE.you[0], DATE.you[1], -Math.PI / 2); YOU.outfit('date'); pose.sit(YOU, 0.53); reach(YOU, 'L', P(c, 0.38, 0.82, -1.95), [1, -1, 0]); reach(YOU, 'R', P(c, 0.38, 0.82, -1.45), [-1, -1, 0]); }
    if (!o.noPatrons) {
      place(PA, 2.0, -2.2, Math.PI / 2); pose.sit(PA, 0.53); place(PB, 3.2, -2.2, -Math.PI / 2); pose.sit(PB, 0.53);
      place(PC, -2.7, -1.95, Math.PI); pose.sit(PC, 0.53);
      PA.setFace({ eyes: blink(c.t, 3) ? 'shut' : 'normal', mouth: 'smallSmile' }); PB.setFace({ eyes: blink(c.t, 5) ? 'shut' : 'normal', mouth: Math.sin(c.t * 9) > 0 ? 'open' : 'smallSmile' });
    }
    if (!o.noWaiter) { place(WT, 3.1, -2.75, -0.4); WT.setFace({ eyes: blink(c.t, 9) ? 'shut' : 'normal', mouth: 'smallSmile', brows: 'raised' }); }
  }
  const crushHappy = (c, extra = {}) => CR.setFace({ eyes: blink(c.t, 1) ? 'closedHappy' : 'cute', mouth: 'cuteSmile', blush: 0.6, ...extra });

  // =================== intro: alarm ===================
  add(0, '00a alarm', (c) => {
    inBed(c, 1); YOU.setFace({ eyes: 'shut', mouth: 'flat' });
    cam(c, { p: [1.3, 0.98, -1.55], l: [1.45, 0.84, -2.5], f: 42 }, { p: [1.35, 0.95, -1.75], l: [1.45, 0.84, -2.5], f: 40 });
  });
  add(0.75, '00b asleep', (c) => {
    inBed(c, 1); YOU.setFace({ eyes: 'shut', mouth: Math.sin(c.t * 3) > 0 ? 'o' : 'flat' });
    cam(c, { p: [0.9, 2.3, 1.9], l: [0.2, 0.9, -2.3], f: 46 }, { p: [0.8, 2.2, 1.5], l: [0.2, 0.9, -2.3], f: 44 });
  });
  // =================== 01 You wake up. ===================
  add(L['01'].at, '01a sit up', (c) => {
    const u = easeOutBack(ramp(c.t, L['01'].s + 0.05, L['01'].s + 0.55));
    inBed(c, 1 - u);
    YOU.setFace({ eyes: u < 0.6 ? 'shut' : 'sleepy', mouth: 'wavy' });
    cam(c, { p: [0.8, 2.2, 1.4], l: [0.1, 1.1, -2.1], f: 44 }, { p: [0.7, 2.05, 0.9], l: [0.05, 1.3, -2.1], f: 42 });
  });
  add(L['01'].e + 0.15, '01b sleepy face', (c) => {
    inBed(c, 0); YOU.setFace({ eyes: blink(c.t, 2) ? 'shut' : 'sleepy', mouth: 'flat' });
    YOU.neck.rotation.z = Math.sin(c.t * 2) * 0.08;
    faceCam(c, YOU, 2.3, 1.9, { fov: 36 });
  });
  // =================== 02 first date in ten minutes ===================
  add(L['02'].at, '02a phone', (c) => {
    inBed(c, 0); YOU.setFace({ eyes: 'sleepy', mouth: 'flat', pupil: [0, 0.6] });
    const pp = P(c, 0.02, 1.62, -1.1);
    const ph = propAt('phone', pp, [-0.5, Math.PI, 0]);
    world.phone.userData.tex.userData.draw(ramp(c.t, L['02'].s + 0.15, L['02'].s + 0.45));
    reach(YOU, 'R', pp.clone().add(V(-0.07, -0.21, -0.02)), [-1, -1, 0]); reach(YOU, 'L', pp.clone().add(V(0.09, -0.21, -0.02)), [1, -1, 0]);
    const eye = headPos(YOU); YOU.head.visible = false;            // his point of view
    c.camPos.copy(eye).add(V(0.02, 0.0, 0.05)); c.camLook.copy(pp); c.fov = lerp(44, 34, easeInOut(c.u));
    void ph;
  });
  add(w('02', 5), '02b ten minutes?!', (c) => {
    inBed(c, 0); YOU.setFace({ eyes: 'wide', mouth: 'o', brows: 'worried' });
    const pp = P(c, 0.12, 1.62, -1.15); propAt('phone', pp, [-0.6, Math.PI, 0]);
    reach(YOU, 'R', pp.clone().add(V(-0.06, -0.12, 0)), [-1, -1, 0]); reach(YOU, 'L', pp.clone().add(V(0.08, -0.12, 0)), [1, -1, 0]);
    sweat(c, YOU, 2, 0.15, 3);
    faceCam(c, YOU, 1.9, 1.5, { fov: 36, ease: easeOut });
    c.shake.push({ t: c.st, amp: 0.4, dur: 0.3 });
  });
  // =================== 03 You yawn. ===================
  add(L['03'].at, '03a yawn', (c) => {
    inBed(c, 0);
    const u = smooth(ramp(c.t, L['03'].s, L['03'].s + 0.35));
    YOU.setFace({ eyes: 'squeeze', mouth: u > 0.3 ? 'yawn' : 'o' });
    pose.stretch(YOU, u); YOU.neck.rotation.x = -0.25 * u;
    faceCam(c, YOU, 2.4, 2.0, { fov: 38, dy: -0.05 });
  });
  add(L['03'].e + 0.25, '03b stink cloud', (c) => {
    inBed(c, 0);
    YOU.setFace({ eyes: 'sleepy', mouth: 'yawn' }); pose.stretch(YOU, 1);
    const k = easeOut(ramp(c.t, c.st, c.st + 0.9));
    const mp = mouthPos(YOU, 0.4);
    fx.puffCloud(mp.clone().add(V(0, 0.2, 0.5 + 0.9 * k)), 0.3 + 1.5 * k, c.t, Math.floor(10 + 20 * k), { color: 0x8fdc3c, opacity: 0.38, size: 0.6 + 1.2 * k, seed: 4, flat: 0.8, drift: 0.12 });
    fx.stinkBundle(mp.clone().add(V(-0.5, 0.2, 0.4)), c.t, 1, 1, 2); fx.stinkBundle(mp.clone().add(V(0.6, 0.0, 0.5)), c.t + 0.3, 1, 1.1, 5);
    const pl = S.bedroom.plant; pl.rotation.z = 0.5 * k; pl.scale.set(0.55, 0.55 * (1 - 0.35 * k), 0.55);
    cam(c, { p: [0.4, 2.4, 2.6], l: [-0.3, 1.3, -2.0], f: 50 }, { p: [0.2, 2.35, 2.0], l: [-0.4, 1.4, -2.0], f: 50 });
    c.shake.push({ t: c.st, amp: 0.5, dur: 0.4 });
    tint(c, `rgba(120,200,60,${(0.12 * k).toFixed(3)})`);
  });
  // =================== 04 The mirror cracks. ===================
  const bath = (c, facing = Math.PI, z = BATH.z) => { use(c, 'bathroom'); place(YOU, BATH.x, z, facing); S.bathroom.crackTex.userData.draw(ramp(c.t, A.crack, A.crack + 0.3)); };
  add(L['04'].at, '04a breath on mirror', (c) => {
    bath(c); YOU.setFace({ eyes: 'sleepy', mouth: 'o' });
    const mp = mouthPos(YOU, 0.35);
    for (let i = 0; i < 8; i++) { const ph = (c.lt * 1.3 + i / 8) % 1; fx.sprite('blob', mp.clone().add(V(Math.sin(i) * 0.1 * ph, Math.cos(i * 2) * 0.08 * ph, -ph * 1.0)), 0.15 + ph * 0.5, { opacity: (1 - ph) * 0.7, color: 0x8fdc3c, order: 20 }); }
    cam(c, { p: [1.45, 2.4, 1.7], l: [0, 1.9, -2.46], f: 44 }, { p: [1.25, 2.35, 1.2], l: [0, 1.9, -2.46], f: 42 });
  });
  add(A.crack, '04b mirror cracks', (c) => {
    bath(c, Math.PI, -0.95); YOU.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' });
    c.camPos.copy(P(c, 0.22, 2.08, -1.55)); c.camLook.copy(P(c, 0, 2.0, -2.46)); c.fov = lerp(48, 42, easeOut(c.u));
    c.shake.push({ t: A.crack, amp: 0.9, dur: 0.35 });
    if (c.t < A.crack + 0.4) fx.sparkles(P(c, 0, 2.0, -2.4), [0.8, 0.8, 0.1], c.t * 3, 8, 0.12, 11);
  });
  // =================== 05 Your mouth smells like poop. ===================
  add(L['05'].at, '05a shocked', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'wide', mouth: 'o', brows: 'worried', green: 0.1 });
    sweat(c, YOU, 1, 0.16, 5);
    faceCam(c, YOU, 2.4, 2.0, { fov: 36 });
  });
  add(w('05', 4), '05b poop', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried', green: 0.3 });
    sweat(c, YOU, 3, 0.15, 6);
    faceCam(c, YOU, 1.6, 1.4, { fov: 36, ease: easeOut });
    c.shake.push({ t: c.st, amp: 0.5, dur: 0.35 });
    vignette(c, 0.4, '60,110,20');
  });
  // =================== 06 You brush. Once. Twice. Five times. ===================
  const brushing = (c, speed, foam, mouth = 'brush') => {
    bath(c, 0);
    YOU.setFace({ eyes: foam > 0.6 ? 'squeeze' : 'big', mouth, brows: 'angry', blue: 0.0 });
    const mp = mouthPos(YOU, 0.36);
    const bp = mp.clone().add(V(Math.sin(c.t * speed) * 0.09, 0, 0.02));
    propAt('brush', bp.clone().add(V(0.2, -0.02, 0)), [0, 0, Math.PI / 2]);
    reach(YOU, 'R', bp.clone().add(V(0.38, -0.05, 0.02)), [-1, -1, 0]);
    const fp = mp.clone();
    fx.puffCloud(fp, 0.15 + 0.35 * foam, c.t, Math.floor(3 + 14 * foam), { color: 0xffffff, opacity: 0.95, size: 0.1 + 0.16 * foam, seed: 21, flat: 0.8, drift: 0.04, kind: 'puff', order: 22 });
    if (foam > 0.5) for (let i = 0; i < 8; i++) { const ph = (c.t * 2 + i / 8) % 1; fx.sprite('puff', fp.clone().add(V((hash(i) - 0.5) * 1.2 * ph, 0.3 * ph - ph * ph * 1.2, 0.3 * ph)), 0.12, { opacity: 1 - ph, order: 23 }); }
  };
  add(L['06'].at, '06a brush', (c) => { brushing(c, 30, 0.15); faceCam(c, YOU, 2.1, 1.85, { fov: 36 }); });
  add(w('06', 2), '06b once', (c) => { brushing(c, 34, 0.35); faceCam(c, YOU, 1.9, 1.7, { fov: 36, yaw: 0.45 }); bigText(c, '1', c.st); });
  add(w('06', 3), '06c twice', (c) => { brushing(c, 40, 0.55); faceCam(c, YOU, 1.75, 1.55, { fov: 36, yaw: -0.4 }); bigText(c, '2', c.st); c.shake.push({ t: c.st, amp: 0.2, dur: 0.2 }); });
  add(w('06', 4), '06d five times', (c) => {
    brushing(c, 60, 1, 'foam'); faceCam(c, YOU, 1.6, 1.35, { fov: 38 }); bigText(c, '5', c.st, '#ff5d5d');
    speedLines(c, 0.8, 4); c.shake.push({ t: c.st, amp: 0.25, dur: c.dur });
  });
  // =================== 07 You check. Still poop. ===================
  add(L['07'].at, '07a check breath', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'big', mouth: c.lt < 0.5 ? 'o' : 'sniff', brows: 'worried', nose: c.lt > 0.5 ? 'twitch' : undefined });
    const mp = mouthPos(YOU, 0.3);
    reach(YOU, 'R', mp.clone().add(V(0.0, c.lt < 0.5 ? -0.05 : 0.07, 0.12)), [-1, -1, 0]);
    fx.puffCloud(mp.clone().add(V(0, 0, 0.18)), 0.12, c.t, 5, { color: 0x8fdc3c, opacity: 0.6, size: 0.18, seed: 33, flat: 1, drift: 0.03 });
    faceCam(c, YOU, 2.0, 1.75, { fov: 36 });
  });
  add(w('07', 2), '07b almost faints', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'spiral', mouth: 'wavy', green: 0.35 });
    YOU.root.rotation.z = Math.sin(c.lt * 5) * 0.12; YOU.body.rotation.x = -0.12 - 0.1 * Math.sin(c.lt * 3);
    YOU.hips.position.y -= 0.06 * Math.abs(Math.sin(c.lt * 4));
    pose.arm(YOU, 'L', [0.6, -0.6, 0.2]); pose.arm(YOU, 'R', [-0.6, -0.6, 0.2]);
    fx.stinkBundle(headPos(YOU).add(V(0, 0.2, 0.2)), c.t, 1, 0.9, 8);
    fx.sprite('star', headPos(YOU).add(V(Math.cos(c.t * 6) * 0.45, 0.45, Math.sin(c.t * 6) * 0.45)), 0.18, { additive: true, color: 0xffee88, rot: c.t * 4 });
    faceCam(c, YOU, 2.6, 2.1, { fov: 38 });
    vignette(c, 0.5, '60,110,20');
  });
  // =================== 08 You eat a whole pack of mints. ===================
  add(L['08'].at, '08a mint pack', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'big', mouth: 'flat', brows: 'angry' });
    const pp = headPos(YOU).addScaledVector(fwd(YOU), 0.45).add(V(-0.22, -0.05, 0));
    propAt('mints', pp, [0, 0, 0.15]);
    reach(YOU, 'R', pp.clone().add(V(0, -0.15, -0.02)), [-1, -1, 0]);
    faceCam(c, YOU, 2.1, 1.8, { fov: 36 });
  });
  add(w('08', 3), '08b mints pour in', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'squeeze', mouth: 'yawn' });
    YOU.neck.rotation.x = -0.45;
    const mp = mouthPos(YOU, 0.3).add(V(0, 0.06, 0));
    const pp = mp.clone().add(V(0.0, 0.42, 0.12));
    propAt('mints', pp, [0.0, 0, Math.PI * 0.8]);
    reach(YOU, 'R', pp.clone().add(V(0.05, 0.12, 0)), [-1, 0, 0]);
    for (let i = 0; i < 14; i++) { const ph = (c.t * 2.2 + i / 14) % 1; const m = propAt('mint' + i, pp.clone().lerp(mp, ph).add(V((hash(i) - 0.5) * 0.06, 0, (hash(i * 3) - 0.5) * 0.05)), [c.t * 5 + i, i, 0]); void m; }
    faceCam(c, YOU, 1.7, 1.5, { fov: 38, yaw: 0.6, dy: 0.05 });
  });
  // =================== 09 You gargle mouthwash. ===================
  add(L['09'].at, '09a drink mouthwash', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'shut', mouth: 'o' });
    YOU.neck.rotation.x = -0.3 * smooth(c.u);
    const bp = mouthPos(YOU, 0.36).add(V(0.0, 0.1, 0));
    propAt('bottle', bp, [0, 0, 2.2]);
    reach(YOU, 'R', bp.clone().add(V(0.12, -0.05, 0)), [-1, -1, 0]);
    faceCam(c, YOU, 2.0, 1.8, { fov: 36 });
  });
  add(w('09', 1) + 0.25, '09b gargle', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'squeeze', mouth: 'puffed', blue: 0.15 });
    YOU.neck.rotation.x = -0.55 + Math.sin(c.t * 18) * 0.04;
    YOU.head.position.x = Math.sin(c.t * 22) * 0.01;
    fx.bubbles(mouthPos(YOU, 0.3).add(V(0, 0.1, 0)), c.t, 12, 4, 0.1, 0.9);
    faceCam(c, YOU, 1.9, 1.65, { fov: 38, yaw: -0.5, dy: 0.05 });
  });
  // =================== 10 You check again. ===================
  add(L['10'].at, '10 minty check', (c) => {
    bath(c, 0);
    const k = ramp(c.t, L['10'].s + 0.25, L['10'].e + 0.2);
    YOU.setFace({ eyes: k > 0.3 ? 'big' : 'squeeze', mouth: 'o', brows: 'raised', pupil: [0, 0.5] });
    const mp = mouthPos(YOU, 0.3);
    reach(YOU, 'R', mp.clone().add(V(0.0, -0.05, 0.12)), [-1, -1, 0]);
    fx.mintCloud(mp.clone().add(V(0, 0.05, 0.3)), 0.08 + 0.14 * k, c.t, k, 51);
    faceCam(c, YOU, 2.0, 1.7, { fov: 36 });
  });
  // =================== 11 Fresh. ===================
  add(L['11'].at, '11 fresh', (c) => {
    bath(c, 0); YOU.setFace({ eyes: 'big', mouth: 'shiny', brows: 'raised' });
    pose.thumbsUp(YOU, 'R'); YOU.extras.messy.visible = false; YOU.extras.neat.visible = true;
    const g = pulse(c.t, A.fresh, 0.08, 0.12, 0.35);
    fx.sprite('star', mouthPos(YOU, 0.36).add(V(0.12, 0.08, 0.02)), 0.15 + 0.4 * g, { opacity: 0.4 + 0.6 * g, additive: true, rot: c.t * 2, order: 40 });
    fx.mintCloud(headPos(YOU).add(V(0, -0.1, 0.3)), 0.35, c.t, 0.5, 61);
    faceCam(c, YOU, 2.6, 2.2, { fov: 36, dy: -0.3 });
  });
  // =================== 12 You're late. You run. ===================
  const street = (c, x, runPhase) => {
    use(c, 'street'); place(YOU, x, 0.35, Math.PI / 2); YOU.outfit('date');
    if (runPhase !== undefined) pose.run(YOU, runPhase);
  };
  add(L['12'].at, '12a late!', (c) => {
    street(c, -6); YOU.root.rotation.y = 0.3;
    YOU.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried' });
    sweat(c, YOU, 4, 0.16, 9);
    pose.arm(YOU, 'L', [0.7, 0.6, 0.2], [0.2, 0.9, 0.2]); pose.arm(YOU, 'R', [-0.7, 0.6, 0.2], [-0.2, 0.9, 0.2]);
    faceCam(c, YOU, 2.6, 2.0, { fov: 40, dy: -0.25, ease: easeOut });
    c.shake.push({ t: c.st, amp: 0.3, dur: 0.3 });
  });
  const runSweat = (c, n) => { const hp = headPos(YOU); for (let i = 0; i < n; i++) { const ph = (c.t * 1.8 + i / n) % 1; fx.sprite('drop', hp.clone().add(V(-ph * 1.2 - 0.1, 0.3 + 0.5 * ph - 1.2 * ph * ph, (hash(i) - 0.5) * 1.2 * ph)), 0.13, { opacity: 1 - ph * 0.6, rot: -ph * 2, order: 22 }); } };
  add(A.runStart, '12b run wide', (c) => {
    const x = lerp(-8, -3.5, c.u);
    street(c, x, c.t * 16); YOU.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried' });
    runSweat(c, 10);
    c.camPos.set(c.o.x + x + 0.6, 1.4, c.o.z + 5.2); c.camLook.set(c.o.x + x + 0.4, 1.1, c.o.z + 0.3); c.fov = 46;
  });
  add(A.runStart + 0.75, '12c run face', (c) => {
    const x = lerp(-3.5, 0.5, c.u);
    street(c, x, c.t * 16); YOU.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried', red: 0.08 });
    runSweat(c, 16); sweat(c, YOU, 4, 0.14, 12);
    const hp = headPos(YOU);
    c.camPos.copy(hp).add(V(2.2, -0.2, 0.25)); c.camLook.copy(hp).add(V(0, -0.2, 0)); c.fov = 40;
    c.shake.push({ t: c.st, amp: 0.25, dur: c.dur + 0.1 });
  });
  // door bell: he bursts into the cafe
  add(A.runEnd, '12d cafe door', (c) => {
    cafe(c, { noYou: true });
    const u = easeOut(ramp(c.t, A.bell, A.bell + 0.4));
    S.cafe.doorHinge.rotation.y = 1.25 * u;
    S.cafe.bell.rotation.z = Math.sin((c.t - A.bell) * 30) * 0.5 * Math.exp(-(c.t - A.bell) * 3);
    place(YOU, lerp(-5.4, -4.4, u), 0.6, Math.PI / 2); YOU.outfit('date'); pose.run(YOU, c.t * 10);
    YOU.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried' }); sweat(c, YOU, 4, 0.16, 14);
    cam(c, { p: [-2.4, 2.3, 2.4], l: [-4.8, 1.6, 0.6], f: 46 });
    if (c.t > A.bell && c.t < A.bell + 0.5) { const bp = P(c, -4.95, 2.45, 0.55); for (const sg of [1, -1]) fx.sprite('arcs', bp.clone().add(V(sg * 0.25, 0, 0.05)), [0.18, 0.18], { opacity: 1 - (c.t - A.bell) * 2, rot: sg > 0 ? 0 : Math.PI, order: 30 }); }
  });
  // =================== 13 She's there. She smiles. ===================
  add(L['13'].at, "13a she's there", (c) => {
    cafe(c, { noYou: true });
    const slow = c.t * 0.35;
    CR.setFace({ eyes: 'cute', mouth: 'smallSmile', blush: 0.6, pupil: [0.3, 0] });
    CR.neck.rotation.z = Math.sin(slow * 3) * 0.05;
    fx.sparkles(headPos(CR).add(V(0, 0.1, 0)), [1.4, 1.2, 1.0], slow, 12, 0.2, 71, 0xfff3c4);
    fx.sprite('glow', headPos(CR).add(V(0, -0.2, -0.3)), [2.6, 2.6], { opacity: 0.25, additive: true, color: 0xfff1d0, order: 9 });
    const hp = headPos(CR);
    c.camPos.copy(hp).add(V(lerp(2.9, 2.2, easeInOut(c.u)), -0.05, lerp(1.2, 0.85, easeInOut(c.u)))); c.camLook.copy(hp).add(V(0, -0.25, 0)); c.fov = 40;
    vignette(c, 0.3, '255,230,240');
  });
  add(w('13', 2), '13b she smiles', (c) => {
    cafe(c, { noYou: true });
    crushHappy(c, { mouth: 'smile', eyes: 'cute' });
    fx.hearts(headPos(CR).add(V(0, 0.15, 0)), [1.0, 0.8, 0.6], c.t, 6, 0.16, 81);
    fx.sparkles(headPos(CR), [1.0, 1.0, 0.6], c.t * 0.5, 6, 0.16, 82, 0xfff3c4);
    faceCam(c, CR, 2.0, 1.75, { fov: 36, dy: -0.18 });
  });
  // =================== 14 CRUSH: Hi! ===================
  add(L['14'].at, '14 hi!', (c) => {
    cafe(c, { noYou: true });
    const open = talking(c.t, '14');
    CR.setFace({ eyes: c.t > L['14'].e ? 'closedHappy' : 'cute', mouth: open ? 'open' : 'smile', blush: 0.7 });
    CR.neck.rotation.z = 0.15 * smooth(c.u);
    pose.arm(CR, 'R', [-0.55, 0.7, 0.25], [-0.15 + Math.sin(c.t * 14) * 0.45, 1, 0.1]);
    fx.hearts(headPos(CR).add(V(0, 0.2, 0)), [1.1, 0.8, 0.6], c.t, 8, 0.15, 91);
    faceCam(c, CR, 2.3, 2.0, { fov: 38, dy: -0.25 });
  });
  // =================== 15 She leans in close. ===================
  add(L['15'].at, '15 leans in', (c) => {
    cafe(c);
    const u = easeInOut(ramp(c.t, L['15'].s, L['15'].e + 0.3));
    CR.body.rotation.x = 0.45 * u; CR.neck.rotation.x = -0.3 * u;
    crushHappy(c, { eyes: 'cute', mouth: 'cuteSmile', blush: 0.8 });
    YOU.setFace({ eyes: 'big', mouth: 'smallSmile', blush: 0.5 });
    fx.hearts(P(c, 0, 1.75, -1.7), [1.4, 0.9, 0.5], c.t, 10, 0.15, 101, 0.6);
    cam(c, { p: [0.0, 2.0, 3.5], l: [0.0, 1.4, -1.7], f: 46 }, { p: [0.0, 1.9, 2.6], l: [0.0, 1.45, -1.7], f: 44 });
  });
  // =================== 16 Your breath is perfect. ===================
  add(L['16'].at, '16 breath perfect', (c) => {
    cafe(c);
    CR.body.rotation.x = 0.45; CR.neck.rotation.x = -0.3; crushHappy(c, { blush: 0.8 });
    YOU.setFace({ eyes: 'normal', mouth: 'shiny', brows: 'raised' });
    YOU.body.rotation.x = -0.08;
    fx.mintCloud(mouthPos(YOU, 0.45), 0.16, c.t, 0.7, 111);
    fx.hearts(headPos(CR), [0.6, 0.5, 0.4], c.t, 4, 0.12, 112);
    faceCam(c, YOU, 2.1, 1.75, { fov: 36, yaw: 0.85, dy: -0.15 });
  });
  // =================== 17 (record scratch) She stops. She sniffs. ===================
  add(A.scratch, '17a she stops', (c) => {
    cafe(c, { noYou: true });
    CR.body.rotation.x = 0.45; CR.neck.rotation.x = -0.3;
    CR.setFace({ eyes: 'wide', mouth: 'cuteSmile', blush: 0.3 });
    const k = easeOut(ramp(c.t, c.st, c.st + 0.15));
    faceCam(c, CR, 2.2 - 0.5 * k, 1.6, { fov: 36, u: ramp(c.t, c.st + 0.15, c.et), dy: -0.12, yaw: -0.35 });
    c.shake.push({ t: c.st, amp: 0.5, dur: 0.25 });
    if (c.t < c.st + 0.12) tint(c, 'rgba(255,255,255,0.5)');
  });
  add(w('17', 2), '17b she sniffs', (c) => {
    cafe(c, { noYou: true });
    CR.body.rotation.x = 0.45; CR.neck.rotation.x = -0.3 + Math.sin(c.t * 20) * 0.02;
    const tw = Math.sin(c.t * 26) > 0;
    CR.setFace({ eyes: 'cute', mouth: 'sniff', nose: tw ? 'twitch' : 'on', blush: 0.2, pupil: [0, -0.3] });
    const np = headPos(CR).addScaledVector(fwd(CR), 0.33);
    for (const sg of [1, -1]) { const ph = (c.t * 3) % 1; fx.sprite('arcs', np.clone().add(V(0, 0.02, sg * (0.18 + ph * 0.08))), [0.12, 0.12], { opacity: 1 - ph, rot: sg > 0 ? Math.PI / 2 : -Math.PI / 2, order: 30 }); }
    faceCam(c, CR, 1.35, 1.2, { fov: 36, dy: -0.1, yaw: -0.3 });
  });
  // =================== 18 CRUSH: Why do your armpits smell like poop? ===================
  add(L['18'].at, '18a why', (c) => {
    cafe(c, { noYou: true });
    CR.body.rotation.x = 0.2;
    CR.setFace({ eyes: 'cute', mouth: talking(c.t, '18') ? 'open' : 'wavy', brows: 'confused', green: 0.08 });
    CR.neck.rotation.z = -0.12;
    faceCam(c, CR, 2.1, 1.9, { fov: 36, dy: -0.15, yaw: -0.35 });
  });
  add(w('18', 3), '18b armpits?', (c) => {
    cafe(c, { noYou: true });
    CR.body.rotation.x = 0.2;
    CR.setFace({ eyes: 'cute', mouth: talking(c.t, '18') ? 'open' : 'wavy', brows: 'confused', green: 0.15 });
    CR.neck.rotation.z = 0.12;
    reach(CR, 'R', headPos(CR).addScaledVector(fwd(CR), 0.3).add(V(0, -0.3, 0.15)), [-1, -1, 0]);
    faceCam(c, CR, 1.7, 1.55, { fov: 36, yaw: -0.3, dy: -0.12 });
    for (let i = 0; i < 3; i++) { const t0 = c.st + i * 0.22; if (c.t >= t0) bigText(c, '?', t0, '#ffffff', 0.2 - 0.03 * i, 16 + i * 4, [0.28, 0.72, 0.5][i]); }
  });
  // =================== 19 You forgot one thing. ===================
  add(L['19'].at, '19 forgot', (c) => {
    cafe(c);
    YOU.setFace({ eyes: 'wide', mouth: 'wavy', brows: 'worried', pupil: [0, 0] });
    sweat(c, YOU, 3, 0.14, 19);
    faceCam(c, YOU, 2.6, 1.5, { fov: 36, dy: -0.12, ease: (x) => x, yaw: 0.85 });
    vignette(c, 0.5);
  });
  // =================== 20 You didn't shower. ===================
  const pits = (c, k) => { pose.armpits(YOU, k); for (const p of YOU.extras.pits) p.visible = true; YOU.root.updateMatrixWorld(true);
    for (const [side, seed] of [['L', 3], ['R', 7]]) { const v = new THREE.Vector3(); YOU.arms[side].shoulder.getWorldPosition(v); fx.stinkBundle(v.add(V(0, -0.15, 0)), c.t, 1, 0.9, seed); } };
  const greenRoom = (c, k) => { fx.puffCloud(P(c, 0.6, 1.5, -1.7), 1.0 + 2.6 * k, c.t, Math.floor(6 + 26 * k), { color: 0x8fdc3c, opacity: 0.18 + 0.12 * k, size: 1.0 + 1.0 * k, seed: 121, flat: 0.8, drift: 0.2 }); tint(c, `rgba(120,200,60,${(0.1 * k).toFixed(3)})`); };
  add(L['20'].at, '20a armpits', (c) => {
    cafe(c);
    const k = easeOut(ramp(c.t, L['20'].s + 0.2, L['20'].e));
    pits(c, k); YOU.setFace({ eyes: 'big', mouth: 'grimace', brows: 'worried' });
    CR.body.rotation.x = -0.15 * k; CR.setFace({ eyes: 'wide', mouth: 'o', green: 0.2 * k });
    greenRoom(c, 0.2 * k);
    cam(c, { p: [0.25, 2.2, 2.9], l: [0.15, 1.3, -1.7], f: 46 }, { p: [0.25, 2.1, 2.3], l: [0.15, 1.35, -1.7], f: 44 });
  });
  add(L['20'].e + 0.45, '20b patrons flee', (c) => {
    cafe(c, { noPatrons: true });
    pits(c, 1); YOU.setFace({ eyes: 'big', mouth: 'grimace', brows: 'worried' });
    CR.setFace({ eyes: 'squeeze', mouth: 'grimace', green: 0.3 }); CR.body.rotation.x = -0.15;
    const u = c.lt;
    for (const [ch, x0, dir, seed] of [[PA, 2.0, 1, 1], [PB, 3.2, 1, 2]]) {
      place(ch, x0 + dir * u * 1.6, -2.2 + u * 0.8, dir > 0 ? Math.PI / 2 - 0.4 : 0); pose.walk(ch, c.t * 12, 1.1);
      reach(ch, 'R', headPos(ch).addScaledVector(fwd(ch), 0.3).add(V(0, -0.02, 0)), [-1, -1, 0]);
      ch.setFace({ eyes: 'squeeze', mouth: 'grimace', green: 0.35 }); void seed;
    }
    place(PC, -2.7 - u * 1.4, -1.95 + u * 0.4, -Math.PI / 2 - 0.3); pose.walk(PC, c.t * 11, 1.1); PC.setFace({ eyes: 'squeeze', mouth: 'grimace', green: 0.35 });
    reach(PC, 'L', headPos(PC).addScaledVector(fwd(PC), 0.3), [1, -1, 0]);
    greenRoom(c, 0.4 + 0.3 * c.u);
    cam(c, { p: [0.4, 3.0, 4.6], l: [0.4, 1.0, -2.0], f: 54 }, { p: [0.4, 2.9, 4.2], l: [0.4, 1.0, -2.0], f: 54 });
  });
  add(A.spray - 0.05, '20c air freshener', (c) => {
    cafe(c, { noPatrons: true, noWaiter: true });
    pits(c, 1); YOU.setFace({ eyes: 'squeeze', mouth: 'grimace' });
    CR.setFace({ eyes: 'squeeze', mouth: 'grimace', green: 0.3 });
    place(WT, 1.75, -0.95, -2.3); WT.setFace({ eyes: 'squeeze', mouth: 'grimace', brows: 'angry' });
    const sp = headPos(WT).addScaledVector(fwd(WT), 0.45).add(V(0, -0.25, 0));
    propAt('spray', sp, [0.3, 0, -0.5]);
    reach(WT, 'R', sp.clone().add(V(0, -0.1, 0)), [-1, -1, 0]);
    reach(WT, 'L', headPos(WT).addScaledVector(fwd(WT), 0.3).add(V(0, -0.02, 0)), [1, -1, 0]);
    const dir = mouthPos(YOU, 0).sub(sp).normalize();
    for (let i = 0; i < 16; i++) { const ph = (c.t * 2 + i / 16) % 1; fx.sprite('puff', sp.clone().addScaledVector(dir, ph * 1.2).add(V((hash(i) - 0.5) * 0.4 * ph, (hash(i * 2) - 0.5) * 0.3 * ph, 0)), 0.1 + ph * 0.35, { opacity: (1 - ph) * 0.8, color: 0xffe0f0, order: 21 }); }
    greenRoom(c, 0.7);
    const mid = headPos(WT).lerp(headPos(YOU), 0.5);
    c.camPos.copy(mid).add(V(0.2, 0.15, 2.4)); c.camLook.copy(mid).add(V(0, -0.2, 0)); c.fov = 46;
  });
  add(A.spray + 1.0, '20d she holds her nose', (c) => {
    cafe(c, { noPatrons: true, noWaiter: true });
    pits(c, 1); YOU.setFace({ eyes: 'big', mouth: 'grimace', brows: 'worried' });
    CR.setFace({ eyes: 'squeeze', mouth: 'grimace', green: 0.35 }); CR.body.rotation.x = -0.2;
    reach(CR, 'R', headPos(CR).addScaledVector(fwd(CR), 0.32).add(V(0, -0.02, 0)), [-1, -1, 0]);
    reach(CR, 'L', headPos(CR).addScaledVector(fwd(CR), 0.4).add(V(0, -0.2, 0.25)), [1, 0, 0]);
    greenRoom(c, 0.8 + 0.2 * c.u);
    const k = easeInOut(c.u);
    const hp = headPos(CR);
    c.camPos.copy(hp).add(V(lerp(2.0, 3.6, k), lerp(-0.1, 0.9, k), lerp(0.7, 3.2, k))); c.camLook.copy(hp).add(V(lerp(0.2, 0.9, k), lerp(-0.2, -0.4, k), 0)); c.fov = lerp(38, 50, k);
    fade(c, ramp(c.t, TL.duration - 1.3, TL.duration - 0.1));
  });

  shots.sort((a, b) => a.t - b.t);
  return shots;
}
