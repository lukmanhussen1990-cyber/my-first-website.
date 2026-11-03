// Shot list. Every cut is anchored to a line or word time from build/timeline.json,
// so the edit follows the real voice timing automatically.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, ramp, pulse, hash, noise1, aim2 } from './lib.js';
import { pose, DIM } from './chars.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildShots(TL, Wd) {
  const { S, cast, fx, world, OFFSETS, setLights, W, H, scene } = Wd;
  const HB = cast.husband, WF = cast.wife, DAD = cast.dad, MOM = cast.mom, DOG = cast.dog;
  const L = {}; TL.lines.forEach((l) => { L[l.id] = l; });
  const s = (id) => L[id].s, e = (id) => L[id].e;
  const w = (id, k) => L[id].words[k].s;
  const we = (id, k) => L[id].words[k].e;
  const nextStart = (id) => { const i = TL.lines.findIndex((l) => l.id === id); return i + 1 < TL.lines.length ? TL.lines[i + 1].s : TL.duration; };

  // ---------------- helpers ----------------
  function use(c, set, lights = set) {
    c.set = set; c.o = OFFSETS[set];
    c.showSet(set); setLights(lights, set);
    c.overlays = [];
    S.living.fanRotor.rotation.y = c.t * 7.5;
  }
  const P = (c, x, y, z) => V(c.o.x + x, c.o.y + y, c.o.z + z);
  function place(c, ch, x, z, ry = 0, y = 0) {
    ch.root.visible = true;
    ch.root.position.set(c.o.x + x, c.o.y + y, c.o.z + z);
    ch.root.rotation.y = ry;
    return ch;
  }
  function cam(c, A, B, ease = easeInOut, u = c.u) {
    const k = B ? ease(u) : 0; B = B || A;
    c.camPos.set(c.o.x + lerp(A.p[0], B.p[0], k), lerp(A.p[1], B.p[1], k), c.o.z + lerp(A.p[2], B.p[2], k));
    c.camLook.set(c.o.x + lerp(A.l[0], B.l[0], k), lerp(A.l[1], B.l[1], k), c.o.z + lerp(A.l[2], B.l[2], k));
    c.fov = lerp(A.f ?? 40, B.f ?? A.f ?? 40, k);
  }
  const headPos = (ch) => { ch.root.updateMatrixWorld(true); const v = new THREE.Vector3(); ch.headMesh.getWorldPosition(v); return v; };
  const fwd = (ch) => V(Math.sin(ch.root.rotation.y), 0, Math.cos(ch.root.rotation.y));
  // camera in front of a character's face, pushing from d0 to d1
  function faceCam(c, ch, d0, d1, opts = {}) {
    const hp = headPos(ch).add(V(0, opts.dy ?? 0, 0));
    let f = fwd(ch);
    if (opts.yaw) f.applyAxisAngle(V(0, 1, 0), opts.yaw);
    const k = (opts.ease ?? easeInOut)(opts.u ?? c.u);
    const d = lerp(d0, d1, k);
    c.camPos.copy(hp).addScaledVector(f, d); c.camPos.y += opts.up ?? 0;
    c.camLook.copy(hp); c.camLook.y += opts.lookUp ?? 0;
    if (opts.side) { const r = V(f.z, 0, -f.x); c.camPos.addScaledVector(r, opts.side); c.camLook.addScaledVector(r, opts.lookSide ?? 0); }
    c.fov = opts.fov ?? 35;
  }
  // two-bone IK: put a hand on a world target
  function reach(ch, side, target, pole) {
    ch.root.updateMatrixWorld(true);
    const arm = ch.arms[side];
    const Pp = ch.body.worldToLocal(target.clone());
    const Sx = arm.shoulder.position.clone();
    const v = Pp.sub(Sx);
    const a = DIM.UA, b = DIM.FA + 0.1;
    let d = v.length();
    const n = v.clone().normalize();
    d = clamp(d, 0.1, a + b - 0.002);
    const pl = V(...(pole || [arm.s * 0.7, -1, -0.5])).normalize();
    const m = pl.sub(n.clone().multiplyScalar(pl.dot(n)));
    if (m.lengthSq() < 1e-6) m.set(arm.s, 0, 0);
    m.normalize();
    const cosA = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const up = n.clone().multiplyScalar(cosA).add(m.clone().multiplyScalar(sinA));
    const E = up.clone().multiplyScalar(a);
    const lo = n.clone().multiplyScalar(d).sub(E).normalize();
    aim2(arm.shoulder, arm.elbow, up.toArray(), lo.toArray());
  }
  function lookAt(ch, target, amount = 1) {
    const hp = headPos(ch);
    const dir = target.clone().sub(hp);
    dir.applyQuaternion(ch.root.quaternion.clone().invert());
    ch.neck.rotation.y = clamp(Math.atan2(dir.x, dir.z), -1.35, 1.35) * amount;
    ch.neck.rotation.x = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.6, 0.6) * amount;
  }
  function talking(t, id) {
    for (const wd of L[id].words) if (t >= wd.s - 0.02 && t <= wd.e) return Math.sin((t - wd.s) * 24) > -0.3;
    return false;
  }
  function dadTalk(c, id, closed = 'flat') {
    const open = talking(c.t, id);
    DAD.extras.mustache.position.y = 0.2 + (open ? 0.03 : 0);
    return open ? 'open' : closed;
  }
  const blink = (t, seed) => ((t + hash(seed) * 3) % 3.1) < 0.09;
  function sweatOn(c, ch, n, size = 0.16, seed = 1) { fx.sweat(headPos(ch), c.t, n, size, seed, fwd(ch)); }
  function propAt(name, pos, rot = [0, 0, 0], scale = 1) { const o = world[name]; o.visible = true; o.position.copy(pos); o.rotation.set(rot[0], rot[1], rot[2]); o.scale.setScalar(scale); return o; }

  // ---- shared timing anchors ----
  const tHappen = w('16', 2) + 0.28;                 // the moment it happens
  const tScratch = s('17') - 0.62;                   // record scratch / freeze
  const tSlam = s('24') - 0.62;                      // door slam
  const smellK = (t) => (t < tHappen ? 0 : clamp(0.25 + 0.75 * ramp(t, tHappen, s('23'))));
  const BELLY_FULL = 1.6;

  // smell cloud + stink in the living room after it happens
  function smell(c, opts = {}) {
    const k = smellK(c.t);
    if (k <= 0) return;
    if (!opts.noFog) scene.fog = new THREE.Fog(0xa6d36e, lerp(30, 9, k), lerp(60, 30, k));
    fx.puffCloud(P(c, opts.cx ?? 0, opts.cy ?? 1.7, opts.cz ?? -2.4), opts.r ?? 4.2, c.t, Math.floor(8 + 40 * k), { color: 0x9fe35a, opacity: 0.08 + 0.1 * k, size: 1.3 + 1.2 * k, seed: 7, flat: 0.9, depth: 0.7, drift: 0.3 });
    if (!opts.noSeat) fx.stinkBundle(P(c, -0.88, 0.5, -3.45), c.t, 1, 1.0, 3);
    c.overlays.push((o) => { o.fillStyle = `rgba(120,200,60,${(0.07 * k).toFixed(3)})`; o.fillRect(0, 0, W, H); });
  }
  function vignette(c, strength = 0.5, color = '0,0,0') {
    c.overlays.push((o) => {
      const g = o.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.62);
      g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${strength})`);
      o.fillStyle = g; o.fillRect(0, 0, W, H);
    });
  }
  function heavenly(c, k) {
    c.overlays.push((o) => {
      const g = o.createRadialGradient(W / 2, H * 0.12, 0, W / 2, H * 0.12, H * 0.7);
      g.addColorStop(0, `rgba(255,245,210,${0.35 * k})`); g.addColorStop(0.5, `rgba(255,236,190,${0.1 * k})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      o.fillStyle = g; o.fillRect(0, 0, W, H);
    });
  }
  function speedLines(c, k, seed = 0) {
    c.overlays.push((o) => {
      o.save(); o.translate(W / 2, H / 2);
      for (let i = 0; i < 70; i++) {
        const a = hash(seed + i) * Math.PI * 2, r0 = H * (0.32 + 0.15 * hash(i * 3 + seed)), len = H * (0.2 + 0.3 * hash(i * 7));
        o.strokeStyle = `rgba(255,255,255,${(0.35 * k * (0.5 + hash(i + Math.floor(c.t * 12)) * 0.5)).toFixed(3)})`;
        o.lineWidth = 2 + 6 * hash(i * 5);
        o.beginPath(); o.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); o.lineTo(Math.cos(a) * (r0 + len), Math.sin(a) * (r0 + len)); o.stroke();
      }
      o.restore();
    });
  }
  function fadeBlack(c, k) { if (k > 0) c.overlays.push((o) => { o.fillStyle = `rgba(0,0,0,${k.toFixed(3)})`; o.fillRect(0, 0, W, H); }); }
  function flash(c, k, col = '255,255,255') { if (k > 0) c.overlays.push((o) => { o.fillStyle = `rgba(${col},${k.toFixed(3)})`; o.fillRect(0, 0, W, H); }); }

  // ---- living room staging ----
  const SEAT = { husband: [-0.88, -3.6], wife: [0.88, -3.6] };
  const seatY = 0.52;
  function armchairSeat(c) { S.living.armchair.updateMatrixWorld(true); return S.living.armchair.localToWorld(V(0, 0, 0.02)); }
  function stageLiving(c, o = {}) {
    if (!o.noHusband) {
      place(c, HB, SEAT.husband[0], SEAT.husband[1], 0); pose.sit(HB, seatY);
      HB.extras.belly.scale.z = BELLY_FULL;
      S.living.cushions[0].scale.y = 0.82; S.living.cushions[0].position.y = 0.41;
      if (c.t > tHappen) HB.extras.stain.visible = true;
    }
    if (!o.noWife) { place(c, WF, SEAT.wife[0], SEAT.wife[1], 0); pose.sit(WF, seatY); WF.extras.hem.rotation.x = -Math.PI / 2 + 0.35; WF.extras.hem.position.set(0, 0.04, 0.12); }
    if (!o.noDad) {
      const p = armchairSeat(c);
      DAD.root.visible = true; DAD.root.position.copy(p); DAD.root.rotation.y = S.living.armchair.rotation.y;
      pose.sit(DAD, 0.53); pose.crossed(DAD);
    }
    if (!o.noMom) { place(c, MOM, -1.95, -2.75, 0.6); pose.holdPlate(MOM); momPlateIn(c); }
    if (!o.noDog) { place(c, DOG, 0.75, -1.2, -0.3); DOG.root.visible = true; DOG.sit(); }
    S.living.cushions[1].scale.y = 1; S.living.cushions[2].scale.y = 1;
  }
  function momPlateIn(c, extraZ = 0.45) {
    const hp = MOM.root.position.clone().add(fwd(MOM).multiplyScalar(extraZ)); hp.y = 1.22;
    propAt('momPlate', hp, [0, MOM.root.rotation.y, 0]);
    const r = V(fwd(MOM).z, 0, -fwd(MOM).x);
    reach(MOM, 'L', hp.clone().addScaledVector(r, -0.27).add(V(0, -0.02, 0)), [1, -1, -0.3]);
    reach(MOM, 'R', hp.clone().addScaledVector(r, 0.27).add(V(0, -0.02, 0)), [-1, -1, -0.3]);
  }
  const wideLiving = { p: [0.1, 3.6, 5.6], l: [0.05, 0.85, -2.3], f: 54 };

  const shots = [];
  const add = (t, name, fn) => shots.push({ t, name, fn });

  // =================== 01  You're a married man. ===================
  add(0, '01a mirror', (c) => {
    use(c, 'bedroom');
    place(c, HB, -0.95, -1.45, Math.PI - 0.12); pose.handsOnHips(HB); HB.body.rotation.x = -0.08;
    HB.setFace({ mouth: 'smile', brows: 'raised', eyes: 'big' });
    cam(c, { p: [1.25, 1.95, 2.3], l: [-0.95, 1.55, -2.6], f: 46 }, { p: [0.95, 1.9, 1.7], l: [-0.95, 1.6, -2.6], f: 44 });
  });
  add(w('01', 2), '01b proud face', (c) => {
    use(c, 'bedroom');
    place(c, HB, -0.95, -1.6, 0.15); pose.handsOnHips(HB); HB.body.rotation.x = -0.1;
    HB.setFace({ mouth: 'smile', brows: 'raised', eyes: 'big', pupil: [0, -0.2] });
    faceCam(c, HB, 2.9, 2.35, { fov: 36, dy: -0.22 });
    fx.sparkles(headPos(HB).add(V(0.15, 0.4, 0.2)), [0.4, 0.15, 0.1], c.t, 3, 0.18, 4);
  });

  // =================== 02  Today, you meet her parents... ===================
  add(s('02'), '02a calendar', (c) => {
    use(c, 'bedroom');
    const prog = ramp(c.t, s('02') + 0.1, s('02') + 0.75) + ramp(c.t, s('02') + 0.8, s('02') + 1.6);
    S.bedroom.calTex.userData.draw(prog);
    cam(c, { p: [1.6, 2.1, -0.75], l: [1.6, 2.1, -2.98], f: 40 }, { p: [1.47, 2.14, -1.55], l: [1.45, 2.14, -2.98], f: 38 }, easeInOut);
  });
  add(w('02', 5), '02b gulp', (c) => {
    use(c, 'bedroom');
    S.bedroom.calTex.userData.draw(2);
    place(c, HB, -0.4, -1.2, 0.25); pose.armsDown(HB);
    HB.setFace({ eyes: 'big', mouth: 'wavy', brows: 'worried', pupil: [noise1(c.t * 3, 5) * 0.6, 0] });
    faceCam(c, HB, 2.5, 1.9, { fov: 36, dy: -0.15 });
    sweatOn(c, HB, 1, 0.17, 2);
  });

  // =================== 03  irons / combs / sprays ===================
  add(s('03'), '03a ironing', (c) => {
    use(c, 'bedroom');
    place(c, WF, 1.5, -1.9, 0); WF.setFace({ mouth: 'smallSmile', eyes: blink(c.t, 1) ? 'shut' : 'normal', pupil: [0, 0.7] });
    const ix = 1.4 + Math.sin(c.lt * 7) * 0.32;
    const ip = P(c, ix, 0.99, -1.2);
    propAt('iron', ip, [0, 0, 0]);
    reach(WF, 'R', ip.clone().add(V(-0.03, 0.22, 0)), [-0.6, -0.5, -1]);
    WF.neck.rotation.x = 0.35;
    fx.steam(P(c, ix + 0.18, 1.0, -1.2), c.t, 6, 3, 0.75);
    cam(c, { p: [2.0, 2.0, 1.55], l: [1.45, 1.3, -1.55], f: 44 }, { p: [1.85, 1.9, 1.0], l: [1.45, 1.3, -1.55], f: 42 });
  });
  add(w('03', 5), '03b combing', (c) => {
    use(c, 'bedroom');
    place(c, HB, 0.2, -1.5, 0); pose.sit(HB, 0.5);
    const u = ramp(c.t, c.st + 0.2, c.et - 0.15);
    HB.extras.hairNeat.visible = u > 0.45; HB.extras.hairMessy.visible = u <= 0.45;
    HB.setFace({ eyes: 'shut', mouth: 'flat', brows: 'neutral' });
    place(c, WF, 0.25, -2.05, 0);
    WF.setFace({ mouth: 'smile', eyes: 'normal', pupil: [0, 1], brows: 'neutral' });
    WF.neck.rotation.x = 0.45;
    const hp = headPos(HB);
    const cz = Math.sin(c.lt * 9) * 0.16;
    const cp = hp.clone().add(V(0.05, 0.36, cz));
    propAt('comb', cp, [0, Math.PI / 2, 0]);
    reach(WF, 'L', cp.clone().add(V(0.05, 0.03, 0)), [1, 0.2, -0.5]);
    pose.armForward(WF, 'R', [-0.1, -1, 0.1]);
    if (u > 0.45) fx.sparkles(hp.clone().add(V(0.1, 0.42, 0.25)), [0.5, 0.15, 0.2], c.t, 4, 0.22, 9);
    cam(c, { p: [0.3, 1.95, 1.45], l: [0.22, 1.75, -1.7], f: 40 }, { p: [0.28, 1.95, 1.0], l: [0.22, 1.8, -1.7], f: 38 });
  });
  add(w('03', 8), '03c spray', (c) => {
    use(c, 'bedroom');
    place(c, HB, 0.2, -1.5, 0); pose.sit(HB, 0.5);
    HB.setFace({ eyes: 'shut', mouth: 'flat', brows: 'worried' });
    place(c, WF, 0.95, -1.85, -Math.PI / 2 - 0.35);
    WF.setFace({ mouth: 'smile', eyes: 'normal', pupil: [-0.6, 0] });
    const pumpRate = 6.5, pump = Math.max(0, Math.sin(c.lt * pumpRate * Math.PI));
    const bp = P(c, 0.62, 1.78, -1.38);
    propAt('perfume', bp, [0, -Math.PI / 2 + 0.3, 0]);
    reach(WF, 'R', bp.clone().add(V(0.06, -0.05, 0.02)), [0, -1, 0.5]);
    reach(WF, 'L', bp.clone().add(V(0.05, 0.15 - pump * 0.03, -0.05)), [0, 0, -1]);
    // mist streaming from the nozzle towards him
    for (let i = 0; i < 14; i++) {
      const ph = (c.lt * 1.8 + i / 14) % 1;
      const p = bp.clone().add(V(-0.12 - ph * 0.7, 0.16 + Math.sin(i * 1.7) * ph * 0.15, Math.cos(i * 2.3) * ph * 0.15));
      fx.sprite('puff', p, 0.08 + ph * 0.35, { opacity: (1 - ph) * 0.8, color: 0xe7a8ff, order: 21 });
    }
    cam(c, { p: [1.45, 2.0, 0.55], l: [0.42, 1.72, -1.45], f: 42 }, { p: [1.3, 1.95, 0.2], l: [0.42, 1.74, -1.45], f: 40 });
  });
  add(w('03', 12), '03d perfume cloud', (c) => {
    use(c, 'bedroom');
    place(c, HB, 0.2, -1.5, 0); pose.sit(HB, 0.5);
    const cough = Math.sin(c.lt * 16) > 0.3;
    HB.setFace({ eyes: 'shut', mouth: cough ? 'o' : 'grimace', brows: 'worried' });
    pose.armForward(HB, 'R', [-0.2, 0.3, 1], [0.4, 0.6, 0.6]);
    const k = easeOut(ramp(c.t, c.st, c.st + 1.0));
    fx.puffCloud(headPos(HB).add(V(0, -0.3, 0.1)), 0.4 + 1.1 * k, c.t, Math.floor(10 + 22 * k), { color: 0xe3a6ff, opacity: 0.42, size: 0.6 + 1.0 * k, seed: 21, flat: 1.2, drift: 0.12 });
    fx.puffCloud(headPos(HB).add(V(0, 0.2, 0.3)), 0.3 + 0.7 * k, c.t, Math.floor(6 + 10 * k), { color: 0xffb7e3, opacity: 0.38, size: 0.5 + 0.7 * k, seed: 44, flat: 1, drift: 0.1 });
    fx.sparkles(headPos(HB).add(V(0, 0, 0.4)), [1.2, 1.4, 0.4], c.t, 10, 0.2, 31, 0xfff1ff);
    cam(c, { p: [0.2, 1.8, 1.9], l: [0.2, 1.45, -1.5], f: 44 }, { p: [0.2, 1.75, 1.35], l: [0.2, 1.5, -1.5], f: 42 });
    c.shake.push({ t: c.st + 0.05, amp: 0.25, dur: 0.4 });
  });

  // =================== 04  WIFE: Just smile. And say nothing. ===================
  const wifePoint = (c, d0, d1, k) => {
    use(c, 'bedroom');
    place(c, WF, 0.95, -0.7, 0.05);
    const open = talking(c.t, '04');
    WF.setFace({ mouth: open ? 'open' : 'tight', eyes: 'normal', brows: k > 0.5 ? 'angry' : 'stern', sparkle: true });
    faceCam(c, WF, d0, d1, { fov: 38, side: 0.1, lookSide: 0.06, up: 0.02, dy: -0.12 });
    // finger pointing straight at the lens
    WF.root.updateMatrixWorld(true);
    const hpw = headPos(WF);
    const toCam = c.camPos.clone().sub(hpw).normalize();
    reach(WF, 'R', hpw.clone().addScaledVector(toCam, 0.62).add(V(-0.12, -0.3, 0)), [-0.8, -1, -0.2]);
    WF.arms.R.finger.visible = true;
    fx.sparkles(headPos(WF).add(V(0, 0.05, 0.35)), [0.5, 0.15, 0.05], c.t, 4, 0.14, 17);
  };
  add(s('04'), '04a wife points', (c) => wifePoint(c, 2.7, 2.25, 0));
  add(w('04', 2), '04b say nothing', (c) => { wifePoint(c, 1.95, 1.6, 1); });

  // =================== 05  Her dad opens the door. He doesn't smile. ===================
  add(s('05'), '05a door opens', (c) => {
    use(c, 'door');
    const open = easeInOut(ramp(c.t, s('05') + 0.05, s('05') + 1.7));
    S.door.hinge.rotation.y = open * 1.7;
    place(c, HB, -0.5, 1.35, Math.PI + 0.1); HB.setFace({ eyes: 'big', mouth: 'fakeSmile' });
    propAt('sweets', P(c, -0.45, 1.12, 0.88));
    reach(HB, 'L', P(c, -0.67, 1.12, 0.92), [1, -1, 0]); reach(HB, 'R', P(c, -0.23, 1.12, 0.92), [-1, -1, 0]);
    place(c, WF, 0.6, 1.45, Math.PI - 0.1); WF.setFace({ mouth: 'smile' });
    place(c, DAD, 0, -0.9, 0); pose.crossed(DAD); DAD.setFace({});
    cam(c, { p: [0.15, 2.55, 5.4], l: [0.0, 1.25, -0.8], f: 42 }, { p: [0.12, 2.35, 4.6], l: [0.0, 1.3, -0.8], f: 40 });
  });
  add(w('05', 5), "05b dad doesn't smile", (c) => {
    use(c, 'door');
    S.door.hinge.rotation.y = 1.7;
    place(c, DAD, 0, -0.9, 0); pose.crossed(DAD);
    DAD.setFace({ eyes: 'narrow', brows: 'stern' });
    DAD.extras.glint.material.opacity = pulse(c.t, c.et - 0.55, 0.12, 0.05, 0.25);
    DAD.extras.glint.position.x = -0.13 + pulse(c.t, c.et - 0.55, 0.12, 0.05, 0.25) * 0.05;
    faceCam(c, DAD, 3.0, 2.1, { fov: 36, ease: easeInOut, dy: -0.18 });
    vignette(c, 0.45);
  });

  // =================== 06  Her mom is sweet. She made spicy tacos. Extra spicy. ===================
  add(s('06'), '06a sweet mom', (c) => {
    use(c, 'living');
    place(c, MOM, -3.0, 0.3, 0.05); momPlateIn(c);
    const bob = Math.sin(c.lt * 6) * 0.03; MOM.hips.position.y += bob;
    MOM.setFace({ eyes: 'closedHappy', mouth: 'smile', blush: 0.6 });
    MOM.neck.rotation.z = Math.sin(c.lt * 3) * 0.08;
    faceCam(c, MOM, 3.3, 2.8, { fov: 40, dy: -0.45, up: 0.1 });
    fx.steam(world.momPlate.position.clone().add(V(0, 0.1, 0)), c.t, 5, 2, 0.5);
    fx.sparkles(headPos(MOM).add(V(0, 0.1, 0.3)), [0.9, 0.5, 0.1], c.t, 4, 0.16, 61, 0xffe0f0);
  });
  add(w('06', 4), '06b plate', (c) => {
    use(c, 'living');
    place(c, MOM, -3.0, 0.3, 0.05); momPlateIn(c);
    MOM.setFace({ eyes: 'closedHappy', mouth: 'smile', blush: 0.6 });
    const pp = world.momPlate.position.clone();
    fx.steam(pp.clone().add(V(-0.1, 0.12, 0.08)), c.t, 7, 5, 0.75);
    fx.steam(pp.clone().add(V(0.12, 0.15, -0.06)), c.t + 0.3, 6, 8, 0.75);
    c.camPos.copy(pp).add(V(0.05, lerp(0.85, 0.7, easeInOut(c.u)), lerp(1.25, 1.0, easeInOut(c.u))));
    c.camLook.copy(pp).add(V(0, 0.05, 0)); c.fov = 40;
  });
  add(w('06', 8), '06c extra spicy', (c) => {
    use(c, 'living');
    place(c, MOM, -3.0, 0.3, 0.05); momPlateIn(c);
    MOM.setFace({ eyes: 'closedHappy', mouth: 'hugeSmile', blush: 0.8 });
    const pp = world.momPlate.position.clone();
    fx.steam(pp.clone().add(V(0, 0.12, 0)), c.t, 6, 9, 0.6);
    for (let i = 0; i < 7; i++) {
      const t0 = c.st + 0.05 + i * 0.09;
      const k = easeOutBack(ramp(c.t, t0, t0 + 0.25));
      const a = i / 7 * Math.PI * 2 + c.t * 0.8;
      const p = pp.clone().add(V(Math.cos(a) * 0.42, 0.4 + Math.sin(a) * 0.55, 0.3));
      fx.sprite('chilli', p, 0.36 * k, { rot: Math.sin(c.t * 5 + i) * 0.3, order: 30 });
    }
    faceCam(c, MOM, 3.1, 2.6, { fov: 40, dy: -0.45, up: 0.05 });
    c.shake.push({ t: w('06', 9), amp: 0.6, dur: 0.35 });
  });

  // =================== 07  MOM: Eat more, beta! ===================
  const HUS_DINE = [-3.35, -1.95];
  function dining(c) {
    use(c, 'living');
    place(c, HB, HUS_DINE[0], HUS_DINE[1], 0); pose.sit(HB, 0.59);
    propAt('myPlate', P(c, HUS_DINE[0], 0.955, -1.3));
  }
  add(s('07'), '07 eat more beta', (c) => {
    dining(c);
    HB.setFace({ eyes: 'big', mouth: 'puffed', brows: 'worried' });
    HB.extras.belly.scale.z = 0.6;
    place(c, MOM, -2.55, -1.15, -Math.PI / 2 - 0.35);
    MOM.setFace({ eyes: 'closedHappy', mouth: talking(c.t, '07') ? 'open' : 'smile', blush: 0.7 });
    const pp = P(c, -2.95, 1.38, -1.25);
    propAt('momPlate', pp, [0, 0, 0.35 * easeInOut(ramp(c.t, c.st, c.st + 0.4))]);
    reach(MOM, 'R', pp.clone().add(V(0.22, -0.04, 0.12)), [0, -1, 0]);
    reach(MOM, 'L', pp.clone().add(V(0.05, 0.05, -0.2)), [0, -1, -1]);
    // a taco tumbling onto his plate
    const t0 = c.st + 0.25, kb = ramp(c.t, t0, t0 + 0.4);
    if (c.t > t0 && kb < 1) { const pb = pp.clone().lerp(P(c, HUS_DINE[0], 1.08, -1.3), easeIn(kb)); pb.y += Math.sin(kb * Math.PI) * 0.15; propAt('taco', pb, [kb * 3, 0, kb * 2]); }
    world.myPlate.scale.set(1, 1 + 0.6 * ramp(c.t, t0 + 0.35, t0 + 0.5), 1);
    fx.steam(P(c, HUS_DINE[0], 1.05, -1.3), c.t, 5, 12, 0.5);
    sweatOn(c, HB, 1, 0.14, 7);
    cam(c, { p: [-3.05, 2.05, 1.85], l: [-3.05, 1.3, -1.6], f: 44 }, { p: [-3.05, 2.0, 1.35], l: [-3.05, 1.35, -1.6], f: 42 });
  });

  // =================== 08  You eat four plates. ===================
  add(s('08'), '08a stuffing', (c) => {
    dining(c);
    HB.setFace({ eyes: 'big', mouth: Math.sin(c.lt * 20) > 0 ? 'puffed' : 'o', brows: 'worried' });
    HB.extras.belly.scale.z = 0.9;
    const k = (Math.sin(c.lt * 14) + 1) / 2;
    const mouth = headPos(HB).add(V(0, -0.12, 0.3));
    const plate = P(c, HUS_DINE[0] + 0.1, 1.0, -1.35);
    reach(HB, 'R', plate.clone().lerp(mouth, k), [-1, -1, -0.5]);
    reach(HB, 'L', plate.clone().add(V(-0.25, 0, 0)).lerp(mouth.clone().add(V(-0.05, 0, 0)), 1 - k), [1, -1, -0.5]);
    faceCam(c, HB, 2.4, 2.0, { fov: 38, dy: -0.3 });
  });
  add(w('08', 2), '08b four plates', (c) => {
    dining(c); world.myPlate.visible = false;
    HB.setFace({ eyes: 'big', mouth: 'puffed' });
    const st = propAt('stack', P(c, HUS_DINE[0] + 0.05, 0.955, -1.3));
    st.userData.plates.forEach((pl, i) => {
      const t0 = c.st + 0.02 + i * 0.13;
      const k = ramp(c.t, t0, t0 + 0.12);
      pl.visible = c.t >= t0;
      pl.position.y = i * 0.055 + (1 - easeIn(k)) * 0.5;
    });
    c.camPos.copy(P(c, HUS_DINE[0] + 0.7, 1.75, 0.0)); c.camLook.copy(P(c, HUS_DINE[0], 1.12, -1.35)); c.fov = 38;
    c.camPos.z -= 0.15 * easeInOut(c.u);
    for (let i = 0; i < 4; i++) { const t0 = c.st + 0.14 + i * 0.13; if (c.t > t0 && c.t < t0 + 0.12) c.shake.push({ t: t0, amp: 0.2, dur: 0.12 }); }
  });
  add(w('08', 2) + clamp((s('09') - w('08', 2)) * 0.5, 0.62, 0.95), '08c full', (c) => {
    dining(c); world.myPlate.visible = false;
    const st = propAt('stack', P(c, HUS_DINE[0] + 0.05, 0.955, -1.3)); st.userData.plates.forEach((pl, i) => { pl.visible = true; pl.position.y = i * 0.055; });
    HB.extras.belly.scale.z = lerp(1.0, BELLY_FULL, easeOutBack(ramp(c.t, c.st, c.st + 0.5)));
    HB.body.rotation.x = -0.18;
    HB.setFace({ eyes: 'shut', mouth: 'puffed', blush: 0.5 });
    reach(HB, 'R', HB.root.position.clone().add(V(-0.05, 1.0, 0.35)), [-1, -0.5, 0]);
    pose.armForward(HB, 'L', [0.6, -0.8, 0], [0.3, -1, 0]);
    cam(c, { p: [-3.35, 1.95, 1.45], l: [-3.35, 1.2, -1.9], f: 42 }, { p: [-3.35, 1.9, 0.95], l: [-3.35, 1.25, -1.9], f: 40 });
  });

  // =================== 09  Then they show you the new white sofa. ===================
  add(s('09'), '09a presenting', (c) => {
    use(c, 'living');
    place(c, HB, -0.45, -0.85, Math.PI + 0.15); HB.extras.belly.scale.z = BELLY_FULL; HB.setFace({ eyes: 'big' });
    place(c, DAD, 1.75, -2.55, -0.9); pose.point(DAD, 'R', [-1, -0.2, 0.4]); DAD.setFace({});
    place(c, MOM, -1.7, -2.45, 0.9); pose.armForward(MOM, 'L', [0.8, -0.3, 0.6]); pose.armForward(MOM, 'R', [-0.4, -0.5, 0.6]); MOM.setFace({ eyes: 'closedHappy', mouth: 'smile', blush: 0.5 });
    fx.sparkles(P(c, 0, 0.9, -3.7), [2.6, 0.8, 0.6], c.t, 8, 0.28, 51);
    cam(c, { p: [0.35, 2.4, 3.4], l: [0, 1.0, -3.4], f: 52 }, { p: [0.25, 2.3, 2.8], l: [0, 1.0, -3.4], f: 50 });
  });
  add(w('09', 4), '09b THE SOFA', (c) => {
    use(c, 'living');
    const k = smooth(ramp(c.t, c.st, c.st + 0.8));
    S.living.coffeeTable.visible = false;
    fx.godRays(P(c, 0, 3.0, -3.7), 0.9 * k);
    fx.sparkles(P(c, 0, 0.9, -3.7), [2.8, 0.9, 1.0], c.t, 16, 0.32, 77);
    fx.sparkles(P(c, 0, 2.2, -3.4), [2.0, 2.0, 0.6], c.t * 0.6, 8, 0.2, 99, 0xfff3c4);
    fx.sprite('glow', P(c, 0, 0.9, -3.6), [5.5, 3], { opacity: 0.35 * k, additive: true, color: 0xfff1d0, order: 9 });
    heavenly(c, k);
    // slow-motion dolly arc
    const a = lerp(-0.35, 0.18, easeInOut(c.u));
    c.camPos.set(Math.sin(a) * lerp(3.6, 3.0, c.u), lerp(1.15, 1.05, c.u), -3.75 + Math.cos(a) * lerp(3.6, 3.0, c.u));
    c.camLook.set(0, 0.9, -3.75); c.fov = 48;
  });

  // =================== 10  DAD: Imported. Bought it today. Sit. ===================
  add(s('10'), '10a imported', (c) => {
    use(c, 'living');
    place(c, DAD, 2.0, -3.0, -0.35);
    pose.point(DAD, 'R', [-1, -0.35, 0.25]); pose.armForward(DAD, 'L', [0.15, -1, 0.1]);
    DAD.setFace({ mouth: dadTalk(c, '10') });
    fx.sparkles(P(c, 0, 0.9, -3.7), [2.6, 0.8, 0.6], c.t, 6, 0.24, 52);
    cam(c, { p: [0.75, 1.95, 1.4], l: [1.3, 1.3, -3.2], f: 44 }, { p: [0.85, 1.95, 0.85], l: [1.35, 1.35, -3.2], f: 42 });
  });
  add(w('10', 4), '10b SIT.', (c) => {
    use(c, 'living');
    place(c, DAD, 2.0, -3.0, -0.35);
    pose.point(DAD, 'R', [-0.85, -0.7, 0.3]); pose.armForward(DAD, 'L', [0.15, -1, 0.1]);
    DAD.setFace({ mouth: dadTalk(c, '10'), brows: 'angry', eyes: 'narrow' });
    const k = easeOut(ramp(c.t, c.st, c.st + 0.16));
    faceCam(c, DAD, 3.0, 1.75, { u: k, ease: (x) => x, fov: 36, side: -0.15, lookSide: -0.1, dy: -0.15 });
    c.shake.push({ t: c.st + 0.05, amp: 0.45, dur: 0.3 });
    speedLines(c, 1 - ramp(c.t, c.st + 0.15, c.st + 0.5), 3);
  });

  // =================== 11  You sit. ===================
  add(s('11'), '11 you sit', (c) => {
    use(c, 'living');
    place(c, HB, SEAT.husband[0], SEAT.husband[1] + 0.25, 0); HB.extras.belly.scale.z = BELLY_FULL;
    const u = easeInOut(ramp(c.t, c.st + 0.05, Math.min(c.et - 0.1, c.st + 1.4)));
    pose.sitBlend(HB, u, seatY);
    HB.root.position.z = c.o.z + SEAT.husband[1] + 0.25 * (1 - u);
    S.living.cushions[0].scale.y = 1 - 0.18 * u; S.living.cushions[0].position.y = 0.43 - 0.02 * u;
    HB.setFace({ eyes: 'big', mouth: 'wavy', brows: 'worried', pupil: [0.5, 0.2] });
    sweatOn(c, HB, 1, 0.14, 3);
    fx.sparkles(P(c, 0.4, 0.75, -3.65), [1.8, 0.5, 0.5], c.t, 5, 0.22, 53);
    cam(c, { p: [0.9, 1.85, 0.9], l: [-0.75, 1.0, -3.55], f: 46 }, { p: [0.65, 1.75, 0.2], l: [-0.8, 1.0, -3.55], f: 44 });
  });

  // =================== 12  stomach sound / everyone hears ===================
  add(s('12') - 0.08, '12a stomach', (c) => {
    use(c, 'living'); stageLiving(c, { noMom: true, noDad: true, noDog: true });
    HB.setFace({ eyes: 'wide', mouth: 'grimace', brows: 'worried' });
    const k = Math.max(0, 1 - ramp(c.t, c.st, c.et + 0.2));
    const wob = Math.sin(c.t * 38) * 0.12 * k + Math.sin(c.t * 17) * 0.06 * k;
    HB.extras.belly.scale.set(1 + wob, 1 - wob * 0.5, BELLY_FULL + wob * 1.5);
    const bp = HB.root.position.clone().add(V(0, 1.0, 0.45));
    for (const sgn of [1, -1]) {
      const pk = (c.t * 3) % 1;
      fx.sprite('arcs', bp.clone().add(V(sgn * (0.38 + pk * 0.12), 0, 0)), [0.28, 0.28], { opacity: (1 - pk) * k, rot: sgn > 0 ? 0 : Math.PI, order: 30 });
    }
    c.camPos.copy(bp).add(V(0.2, 0.15, lerp(2.0, 1.6, easeInOut(c.u)))); c.camLook.copy(bp).add(V(0, 0.05, 0)); c.fov = 40;
  });
  add(w('12', 4), '12b everyone hears', (c) => {
    use(c, 'living'); stageLiving(c);
    const hp = headPos(HB);
    const turn = (ch, t0) => { const k = easeOutBack(ramp(c.t, t0, t0 + 0.12)); lookAt(ch, hp, k); };
    turn(DAD, c.st + 0.05); turn(MOM, c.st + 0.12); turn(WF, c.st + 0.0);
    const dk = easeOutBack(ramp(c.t, c.st + 0.18, c.st + 0.3)); DOG.headP.rotation.y = -0.9 * dk; DOG.headP.rotation.x = 0.75 - 0.2 * dk;
    HB.setFace({ eyes: 'big', mouth: 'wavy', brows: 'worried' });
    DAD.setFace({ eyes: 'narrow', brows: 'stern' }); MOM.setFace({ eyes: 'wide', mouth: 'o' }); WF.setFace({ eyes: 'wide', mouth: 'o', brows: 'raised' });
    cam(c, wideLiving, { ...wideLiving, p: [0.1, 3.45, 5.1], f: 54 });
  });

  // =================== 13  You smile. And say nothing. ===================
  add(s('13'), '13 fake smile', (c) => {
    use(c, 'living'); stageLiving(c, { noMom: true, noDog: true });
    HB.setFace({ eyes: 'big', mouth: 'fakeSmile', brows: 'worried', pupil: [Math.sign(noise1(c.t * 2.5, 9)) * 0.7, 0] });
    sweatOn(c, HB, 2, 0.15, 13);
    faceCam(c, HB, 2.7, 2.0, { fov: 36, dy: -0.18 });
  });

  // =================== 14  DAD: So, what do you do? ===================
  add(s('14'), '14 what do you do', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true });
    const lean = easeInOut(ramp(c.t, c.st, c.st + 0.9));
    DAD.body.rotation.x = 0.38 * lean; DAD.neck.rotation.x = -0.3 * lean;
    DAD.setFace({ mouth: dadTalk(c, '14'), eyes: 'narrow', brows: 'stern' });
    const g = pulse(c.t, w('14', 4) - 0.05, 0.1, 0.08, 0.3);
    DAD.extras.glint.material.opacity = g; DAD.extras.glint.position.x = -0.15 + g * 0.06;
    const hp = headPos(DAD), f = fwd(DAD);
    const d = lerp(3.0, 1.9, easeInOut(c.u));
    c.camPos.copy(hp).addScaledVector(f, d).add(V(0, -0.1, 0)); c.camLook.copy(hp).add(V(0, -0.22, 0)); c.fov = 36;
    vignette(c, 0.35);
  });

  // =================== 15  You smile harder. ===================
  add(s('15'), '15 smile harder', (c) => {
    use(c, 'living'); stageLiving(c, { noMom: true, noDog: true });
    HB.setFace({ eyes: 'wide', mouth: 'hugeSmile', brows: 'worried', blush: 0.7, red: 0.08 });
    HB.head.position.x = noise1(c.t * 30, 4) * 0.01;
    sweatOn(c, HB, 5, 0.15, 15);
    faceCam(c, HB, 1.9, 1.45, { fov: 34, dy: -0.08 });
    c.shake.push({ t: c.st, amp: 0.12, dur: c.dur });
  });

  // =================== 16  Then, it happens. ===================
  add(s('16'), '16 it happens', (c) => {
    use(c, 'living'); stageLiving(c, { noMom: true, noDad: true, noDog: true, noWife: true });
    const after = c.t > tHappen;
    HB.setFace({ eyes: after ? 'wide' : 'big', mouth: after ? 'o' : 'hugeSmile', brows: 'worried', blush: 0.5 });
    cam(c, { p: [-0.88, 1.75, 0.9], l: [-0.88, 1.05, -3.6], f: 44 }, { p: [-0.88, 1.0, -1.45], l: [-0.88, 0.62, -3.6], f: 40 }, easeInOut, ramp(c.t, c.st, c.et));
    if (after) {
      const k = ramp(c.t, tHappen, tHappen + 0.5);
      fx.puffCloud(P(c, -0.88, 0.55, -3.3), 0.25 + 0.5 * k, c.t, 8, { color: 0x9fe35a, opacity: 0.6 * (1 - k * 0.5), size: 0.35 + 0.5 * k, seed: 5, flat: 0.4 });
      fx.stinkBundle(P(c, -0.88, 0.4, -3.4), c.t, k, 0.8, 3);
      S.living.cushions[0].scale.y = 0.82 + 0.1 * Math.sin(ramp(c.t, tHappen, tHappen + 0.3) * Math.PI);
    }
    c.shake.push({ t: tHappen, amp: 1.0, dur: 0.55 });
  });

  // =================== 17  Silence. (frozen) ===================
  add(tScratch, '17 silence', (c) => {
    use(c, 'living'); stageLiving(c);
    const hp = headPos(HB);
    for (const ch of [DAD, MOM, WF]) lookAt(ch, hp, 1);
    DOG.headP.rotation.y = -0.9; DOG.headP.rotation.x = 0.55;
    HB.setFace({ eyes: 'big', mouth: 'fakeSmile', brows: 'worried' });
    DAD.setFace({ eyes: 'narrow', brows: 'stern' }); MOM.setFace({ eyes: 'wide', mouth: 'flat' }); WF.setFace({ eyes: 'wide', mouth: 'flat', brows: 'raised' });
    smell(c);
    fx.stinkBundle(P(c, -0.88, 0.55, -3.45), c.t, 1, 1.2, 11);
    cam(c, wideLiving, { p: [0.0, 3.0, 3.6], l: [-0.2, 0.95, -2.7], f: 52 }, easeInOut, ramp(c.t, c.st, c.et));
    flash(c, 0.6 * (1 - ramp(c.t, c.st, c.st + 0.12)));
    c.shake.push({ t: c.st, amp: 0.35, dur: 0.25 });
  });

  // =================== 18  mom stops smiling / dog leaves ===================
  add(s('18'), '18a mom stops smiling', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true });
    const k = ramp(c.t, w('18', 2), w('18', 2) + 0.35);
    MOM.setFace({ eyes: k < 0.3 ? 'closedHappy' : k < 0.8 ? 'normal' : 'wide', mouth: k < 0.3 ? 'smile' : k < 0.8 ? 'flat' : 'frown', green: 0.25 * k, blush: 0.3 * (1 - k), brows: k > 0.5 ? 'worried' : 'neutral' });
    smell(c);
    faceCam(c, MOM, 2.7, 2.0, { fov: 36, dy: -0.25 });
  });
  add(w('18', 4), '18b dog leaves', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true });
    const u = ramp(c.t, c.st, c.et);
    DOG.root.visible = true; DOG.root.position.set(lerp(1.2, -1.9, u), 0, -1.15); DOG.root.rotation.y = -Math.PI / 2;
    DOG.upright(c.t * 9);
    smell(c);
    fx.stinkBundle(DOG.root.position.clone().add(V(0.3, 0.4, 0)), c.t, 0.8, 0.6, 21);
    const dx = DOG.root.position.x; c.camPos.set(dx - 0.25, 0.85, 1.25); c.camLook.set(dx - 0.15, 0.62, -1.15); c.fov = 42;
  });

  // =================== 19  wife looks at you / you look at the fan ===================
  add(s('19'), '19a wife stares', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noDad: true });
    const hp = headPos(HB); lookAt(WF, hp, 1);
    pose.crossed(WF);
    WF.setFace({ eyes: 'angry', brows: 'angry', mouth: 'tight', red: 0.08 + 0.1 * c.u });
    smell(c, { noSeat: true });
    WF.root.updateMatrixWorld(true);
    const wp = headPos(WF), dir = hp.clone().sub(wp).normalize().add(V(0, 0, 1.1)).normalize();
    const d = lerp(2.2, 1.55, easeInOut(c.u));
    c.camPos.copy(wp).addScaledVector(dir, d); c.camLook.copy(wp).add(V(0, -0.12, 0)); c.fov = 36;
    vignette(c, 0.4, '60,0,0');
  });
  add(w('19', 5), '19b look up', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noDad: true, noWife: true });
    HB.setFace({ eyes: 'big', mouth: 'fakeSmile', brows: 'worried', pupil: [0.2, -1] });
    HB.neck.rotation.x = -0.25;
    sweatOn(c, HB, 2, 0.14, 19);
    smell(c, { noSeat: true });
    faceCam(c, HB, 2.2, 1.85, { fov: 38, up: -0.35, lookUp: -0.05 });
  });
  add(w('19', 8), '19c ceiling fan', (c) => {
    use(c, 'living');
    smell(c, { noSeat: true, cy: 3.8, cz: -1.8, r: 2.6 });
    const f = P(c, 0, 4.75, -1.6);
    c.camPos.copy(P(c, -0.85, 1.9, -3.2)); c.camLook.copy(f); c.fov = lerp(52, 44, easeInOut(c.u));
  });

  // =================== 20  dad stands up, walks to the cupboard (slow motion) ===================
  add(s('20'), '20a dad stands', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true });
    const u = easeInOut(ramp(c.t, c.st + 0.1, c.et));
    const p0 = armchairSeat(c), f = fwd(DAD);
    DAD.root.position.copy(p0).addScaledVector(f, 0.35 * u);
    pose.sitBlend(DAD, 1 - u, 0.53); pose.crossed(DAD);
    DAD.setFace({ eyes: 'narrow', brows: 'stern' });
    smell(c, { noSeat: true });
    const hp = headPos(DAD);
    c.camPos.copy(hp).addScaledVector(f, 2.6).add(V(-0.4, -0.35, 0.5)); c.camLook.copy(hp).add(V(0, -0.45, 0)); c.fov = 46;
  });
  add(w('20', 5), '20b slow walk', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noDad: true });
    const u = ramp(c.t, c.st, c.et);
    const A = V(1.55, 0, -1.2), B = V(4.1, 0, -3.25);
    const pos = A.clone().lerp(B, u);
    place(c, DAD, pos.x, pos.z, Math.atan2(B.x - A.x, B.z - A.z));
    pose.walk(DAD, c.t * 3.2, 0.8);
    pose.crossed(DAD);
    DAD.setFace({ eyes: 'narrow', brows: 'stern' });
    S.living.cbDoorR.rotation.y = -1.3 * easeInOut(ramp(c.t, c.et - 0.6, c.et));
    smell(c, { noSeat: true });
    c.camPos.set(lerp(2.3, 3.7, u), 1.9, lerp(1.2, 0.2, u)); c.camLook.set(pos.x, 1.2, pos.z); c.fov = 48;
  });

  // =================== 21  He comes back with a pen. ===================
  add(s('21'), '21 the pen', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noDad: true, noHusband: true, noWife: true });
    place(c, DAD, 0.9, -1.6, -0.25);
    DAD.setFace({ eyes: 'narrow', brows: 'stern' });
    const hp = headPos(DAD);
    const pp = hp.clone().add(V(-0.08, -0.32, 0.5));
    const pen = propAt('pen', pp, [0, c.t * 1.2, 0.18], 1.5);
    reach(DAD, 'R', pp.clone().add(V(0.02, -0.15, 0)), [-1, -1, 0]);
    pose.armForward(DAD, 'L', [0.15, -1, 0.1]);
    smell(c, { noSeat: true, noFog: true });
    // dramatic shine sweeping up the pen + star glint
    const sw = (c.lt * 0.9) % 1;
    fx.sprite('glow', pp.clone().add(V(0.02, -0.18 + sw * 0.36, 0.04)), [0.22, 0.12], { opacity: Math.sin(sw * Math.PI), additive: true, order: 40 });
    const g = pulse(c.t, c.st + 0.45, 0.1, 0.1, 0.35) + pulse(c.t, c.et - 0.5, 0.1, 0.1, 0.3);
    fx.sprite('star', pp.clone().add(V(0.03, 0.2, 0.08)), 0.15 + 0.6 * g, { opacity: g, rot: c.t * 2, additive: true, order: 41 });
    c.camPos.copy(pp).add(V(0.1, 0.12, lerp(1.7, 1.3, easeInOut(c.u)))); c.camLook.copy(pp).add(V(0.04, 0.16, 0)); c.fov = 36;
    vignette(c, 0.5);
    speedLines(c, 0.45, 8);
    void pen;
  });

  // =================== 22  And signs the divorce papers. For her. ===================
  const PAPER = V(0.25, 0.512, -2.25);
  function paper(c, sig, drop = 1) {
    const pp = P(c, PAPER.x, PAPER.y + (1 - drop) * 0.45, PAPER.z);
    const o = propAt('paper', pp, [-Math.PI / 2, 0, 0.12]);
    o.userData.tex.userData.draw(sig);
    return o;
  }
  const sigP = (u) => { // signature path in paper canvas coords -> world
    const cx = 50 + u * 250 + Math.sin(u * 40) * 10, cy = 425 - Math.abs(Math.sin(u * 23)) * 26 + Math.sin(u * 7) * 6;
    const lx = (cx / 360 - 0.5) * 0.6, ly = (0.5 - cy / 480) * 0.8;
    const a = 0.12; // paper yaw
    return V(PAPER.x + lx * Math.cos(a) - ly * Math.sin(a), PAPER.y + 0.01, PAPER.z - (lx * Math.sin(a) + ly * Math.cos(a)));
  };
  const sigU = (t) => ramp(t, w('22', 2) + 0.05, w('22', 5) - 0.15);
  add(s('22'), '22a slap', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true });
    place(c, DAD, 1.2, -2.15, -Math.PI / 2 - 0.25); DAD.body.rotation.x = 0.45; DAD.neck.rotation.x = 0.2;
    DAD.setFace({ eyes: 'narrow', brows: 'stern' });
    const drop = easeIn(ramp(c.t, c.st, c.st + 0.16));
    paper(c, 0, drop);
    reach(DAD, 'L', P(c, 0.45, 0.58 + (1 - drop) * 0.45, -2.1), [1, -1, 0]);
    reach(DAD, 'R', P(c, 0.55, 0.6, -2.4), [-1, -1, 0]);
    HB.setFace({ eyes: 'wide', mouth: 'o' }); WF.setFace({ eyes: 'angry', brows: 'angry', mouth: 'tight' });
    smell(c);
    cam(c, { p: [-1.5, 2.6, 1.9], l: [0.55, 0.8, -2.5], f: 46 }, { p: [-1.3, 2.45, 1.4], l: [0.55, 0.8, -2.5], f: 44 });
    c.shake.push({ t: c.st + 0.16, amp: 0.9, dur: 0.35 });
  });
  add(w('22', 2), '22b signing', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noWife: true, noHusband: true });
    place(c, DAD, 1.2, -2.15, -Math.PI / 2 - 0.25); DAD.body.rotation.x = 0.45;
    const u = sigU(c.t);
    paper(c, u);
    const tip = sigP(u);
    propAt('pen', tip.clone().add(V(0.05, 0.2, 0.05)), [0.25, 0, -0.35]);
    reach(DAD, 'R', tip.clone().add(V(0.12, 0.3, 0.08)), [-1, -1, 0]);
    reach(DAD, 'L', P(c, 0.5, 0.55, -2.0), [1, -1, 0]);
    smell(c, { noSeat: true });
    c.camPos.copy(P(c, 0.24, 1.55, -1.45)); c.camLook.copy(P(c, 0.25, 0.51, -2.25)); c.fov = lerp(44, 40, easeInOut(c.u));
  });
  add(w('22', 5), '22c for her', (c) => {
    use(c, 'living'); stageLiving(c, { noDog: true, noMom: true, noDad: true });
    paper(c, 1);
    pose.crossed(WF);
    const nod = Math.sin(ramp(c.t, c.st + 0.1, c.st + 0.6) * Math.PI * 2) * 0.22;
    WF.neck.rotation.x = nod; WF.neck.rotation.y = -0.15;
    WF.setFace({ eyes: 'angry', brows: 'angry', mouth: 'smallSmile' });
    smell(c, { noSeat: true });
    faceCam(c, WF, 2.6, 2.1, { fov: 36, dy: -0.25 });
  });

  // =================== 23  DAD: The sofa stays. You go. ===================
  function dadHug(c, pointOut) {
    use(c, 'living');
    place(c, DAD, 0.0, -3.6, 0); pose.sit(DAD, seatY);
    S.living.backCushions[1].visible = false;
    DAD.body.rotation.z = 0.08;
    const squeeze = 1 + Math.sin(c.t * 5) * 0.03;
    const cp = P(c, 0.02, 1.12, -3.2);
    const cu = propAt('cushion', cp, [0.15, 0, -0.08]); cu.scale.set(squeeze, squeeze, 1);
    reach(DAD, 'R', cp.clone().add(V(-0.35, -0.05, 0.12)), [-1, -0.3, 0]);
    if (pointOut) pose.point(DAD, 'L', [0.75, 0.3, 0.6]);
    else reach(DAD, 'L', cp.clone().add(V(0.33, 0.02, 0.12)), [1, -0.3, 0]);
    DAD.neck.rotation.z = pointOut ? 0.05 : 0.38; DAD.neck.rotation.x = pointOut ? 0 : 0.12;
    const open = talking(c.t, '23');
    DAD.extras.mustache.position.y = 0.2 + (open ? 0.03 : 0);
    DAD.setFace({ eyes: pointOut ? 'narrow' : 'shut', brows: pointOut ? 'angry' : 'neutral', mouth: open ? 'open' : 'flat', blush: pointOut ? 0 : 0.5 });
    fx.sparkles(P(c, 0.0, 1.1, -3.4), [2.2, 1.0, 0.6], c.t, 10, 0.26, 81);
  }
  add(s('23'), '23a hugging the sofa', (c) => {
    dadHug(c, false);
    fx.godRays(P(c, 0.6, 3.0, -3.7), 0.7);
    heavenly(c, 0.6);
    smell(c, { noSeat: true });
    cam(c, { p: [0.35, 1.65, -0.2], l: [0.0, 1.15, -3.6], f: 42 }, { p: [0.3, 1.6, -0.7], l: [0.0, 1.2, -3.6], f: 40 });
  });
  add(w('23', 3), '23b YOU GO', (c) => {
    dadHug(c, true);
    smell(c, { noSeat: true });
    const hp = headPos(DAD);
    c.camPos.copy(hp).add(V(0.25, 0.0, lerp(2.4, 1.8, easeOut(ramp(c.t, c.st, c.st + 0.2))))); c.camLook.copy(hp).add(V(0.15, -0.3, 0)); c.fov = 40;
    c.shake.push({ t: c.st + 0.02, amp: 0.3, dur: 0.25 });
  });

  // =================== 24  You smiled. And said nothing. ===================
  const outside = (c) => {
    use(c, 'door', 'night');
    S.door.hinge.rotation.y = c.t < tSlam + 0.05 ? 0.35 * (1 - ramp(c.t, tSlam - 0.12, tSlam)) : Math.sin(ramp(c.t, tSlam, tSlam + 0.35) * Math.PI * 3) * 0.02 * (1 - ramp(c.t, tSlam, tSlam + 0.35));
    place(c, HB, 0.1, 1.15, Math.PI + 0.05); HB.extras.stain.visible = true; HB.extras.belly.scale.z = BELLY_FULL;
    const k = clamp(0.35 + 0.65 * ramp(c.t, tSlam, TL.duration - 1));
    fx.puffCloud(P(c, 0.1, 1.5, 1.4), 0.9 + 0.6 * k, c.t, Math.floor(8 + 10 * k), { color: 0x9fe35a, opacity: 0.14 + 0.08 * k, size: 0.9 + 0.5 * k, seed: 91, flat: 1.2, drift: 0.12 });
    fx.stinkBundle(P(c, 0.1, 0.6, 1.25), c.t, 1, 1.0, 41);
    fx.stinkBundle(P(c, -0.45, 0.9, 1.3), c.t + 0.4, 0.8, 0.8, 43);
  };
  add(tSlam - 0.12, '24a slammed out', (c) => {
    outside(c);
    HB.setFace({ eyes: 'big', mouth: 'flat' });
    cam(c, { p: [1.0, 2.0, 6.2], l: [0.0, 1.25, 0.2], f: 42 }, { p: [0.85, 1.9, 5.4], l: [0.0, 1.25, 0.2], f: 40 });
    c.shake.push({ t: tSlam, amp: 1.5, dur: 0.55 });
  });
  add(w('24', 2), '24b tears', (c) => {
    outside(c); setLights('nightFace', 'door');
    HB.setFace({ eyes: 'big', mouth: 'fakeSmile', brows: 'worried', tears: true, pupil: [0, 0.3] });
    const hp = headPos(HB), f = fwd(HB);
    const eye = hp.clone().addScaledVector(f, 0.27); eye.y += 0.03;
    fx.tearsFountain(eye.clone().add(V(0.12, 0, 0)), c.t, -1, 1, 3, f, 0.06);
    fx.tearsFountain(eye.clone().add(V(-0.12, 0, 0)), c.t + 0.3, 1, 1, 9, f, 0.06);
    c.camPos.copy(hp).addScaledVector(f, 0.95).add(V(lerp(0.75, 0.62, easeInOut(c.u)), -0.08, 0)); c.camLook.copy(hp).addScaledVector(f, 0.22).add(V(0, -0.1, 0)); c.fov = 50;
  });
  add(e('24') + 0.3, '24c fade out', (c) => {
    outside(c);
    HB.setFace({ eyes: 'big', mouth: 'fakeSmile', brows: 'worried', tears: true });
    HB.neck.rotation.y = -0.5;
    const hp = headPos(HB), f = fwd(HB);
    const eye = hp.clone().addScaledVector(f, 0.27); eye.y += 0.03;
    fx.tearsFountain(eye.clone().add(V(-0.12, 0, 0)), c.t + 0.3, 1, 0.8, 9, f, 0.08);
    cam(c, { p: [1.0, 1.45, 3.1], l: [0.1, 1.0, 0.7], f: 44 }, { p: [1.2, 2.0, 5.4], l: [0.1, 1.2, 0.5], f: 44 }, easeOut);
    fadeBlack(c, ramp(c.t, TL.duration - 1.3, TL.duration - 0.1));
  });

  shots.sort((a, b) => a.t - b.t);
  shots.shakes = [];
  return shots;
}
