// Shot list for the golden-toilet reel: 30 scenes, every cut on a word of the voiceover.
import * as THREE from 'three';
import { clamp, lerp, smooth, easeOut, easeIn, easeInOut, easeOutBack, ramp, pulse, hash, noise1, aim2 } from './lib.js';
import { pose, DIM } from './chars.js';
import { drawCentered } from './font.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildShots(TL, Wd) {
  const { S, cast, fx, world, OFFSETS, setLights, W, H } = Wd;
  const K = W / 1080;
  const YOU = cast.you, MOM = cast.mom, CZ = cast.cousin, GM = cast.grandma, GA = cast.ga, GB = cast.gb, GC = cast.gc, GD = cast.gd;
  const L = {}; TL.lines.forEach((l) => { L[l.id] = l; });
  const A = TL.anchors;
  const w = (id, k) => L[id].words[k].s;
  const shots = [];
  const add = (t, name, fn) => shots.push({ t: Math.max(0, t), name, fn });

  // ---------- helpers ----------
  let curO = OFFSETS.hall;
  function use(c, set) { c.o = OFFSETS[set]; curO = c.o; c.showSet(set); setLights(set); }
  const P = (c, x, y, z) => V(c.o.x + x, c.o.y + y, c.o.z + z);
  function place(ch, x, z, ry = 0) { ch.root.visible = true; ch.root.position.set(curO.x + x, 0, curO.z + z); ch.root.rotation.y = ry; return ch; }
  function cam(c, Ac, Bc, ease = easeInOut, u = c.u) {
    const k = Bc ? ease(u) : 0; Bc = Bc || Ac;
    c.camPos.set(c.o.x + lerp(Ac.p[0], Bc.p[0], k), lerp(Ac.p[1], Bc.p[1], k), c.o.z + lerp(Ac.p[2], Bc.p[2], k));
    c.camLook.set(c.o.x + lerp(Ac.l[0], Bc.l[0], k), lerp(Ac.l[1], Bc.l[1], k), c.o.z + lerp(Ac.l[2], Bc.l[2], k));
    c.fov = lerp(Ac.f ?? 40, Bc.f ?? Ac.f ?? 40, k);
  }
  const headPos = (ch) => { ch.root.updateMatrixWorld(true); const v = new THREE.Vector3(); ch.headMesh.getWorldPosition(v); return v; };
  const fwd = (ch) => V(Math.sin(ch.root.rotation.y), 0, Math.cos(ch.root.rotation.y));
  function faceCam(c, ch, d0, d1, o = {}) {
    const hp = headPos(ch).add(V(0, o.dy ?? -0.12, 0));
    const f = fwd(ch); if (o.yaw) f.applyAxisAngle(V(0, 1, 0), o.yaw);
    const d = lerp(d0, d1, (o.ease ?? easeInOut)(o.u ?? c.u));
    c.camPos.copy(hp).addScaledVector(f, d); c.camPos.y += o.up ?? 0;
    c.camLook.copy(hp); c.camLook.y += o.lookUp ?? 0;
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
    ch.neck.rotation.x = clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.5, 0.5) * k;
  }
  function talking(t, id) { for (const x of L[id].words) if (t >= x.s - 0.02 && t <= x.e) return Math.sin((t - x.s) * 24) > -0.3; return false; }
  const blink = (t, seed) => ((t + hash(seed) * 3) % 3.3) < 0.1;
  function propAt(name, pos, rot = [0, 0, 0], s = 1) { const o = world[name]; o.visible = true; o.position.copy(pos); o.rotation.set(rot[0], rot[1], rot[2]); o.scale.setScalar(s); return o; }
  const handPos = (ch, side) => { ch.root.updateMatrixWorld(true); const v = new THREE.Vector3(); ch.arms[side].hand.getWorldPosition(v); return v; };
  const sweat = (c, ch, n, size = 0.15, seed = 1) => fx.sweat(headPos(ch), c.t, n, size, seed, fwd(ch));
  const goldSparkles = (c, center, spread, n = 10, size = 0.25, seed = 1) => fx.sparkles(center, spread, c.t, n, size, seed, 0xffd86a);
  function vignette(c, k = 0.45, col = '0,0,0') { c.overlays.push((o) => { const g = o.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.62); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`); o.fillStyle = g; o.fillRect(0, 0, W, H); }); }
  function tint(c, rgba) { c.overlays.push((o) => { o.fillStyle = rgba; o.fillRect(0, 0, W, H); }); }
  function bigText(c, text, t0, color = '#ffd23f', y = 0.2, size = 26, x = 0.5) {
    const k = easeOutBack(clamp((c.t - t0) / 0.16));
    c.overlays.push((o) => drawCentered(o, text, W * x, H * y, Math.max(2, Math.round(size * K * lerp(0.4, 1, k))), { color, outline: Math.round(5 * K), outlineColor: '#000', shadow: Math.round(5 * K) }));
  }
  const glint = (c, pos, t0, size = 0.4) => { const g = pulse(c.t, t0, 0.1, 0.12, 0.35); if (g > 0) fx.sprite('star', pos, 0.1 + size * g, { opacity: g, additive: true, color: 0xfff2c0, rot: c.t * 2, order: 40 }); };

  // ---------- staging ----------
  const withMug = (c, ch = MOM, side = 'R') => { ch.root.updateMatrixWorld(true); const hp = handPos(ch, side); propAt('mug', hp.add(V(0, 0.1, 0)), [0, ch.root.rotation.y, 0], 1.3); };
  const momTired = (c, extra = {}) => MOM.setFace({ eyes: blink(c.t, 4) ? 'shut' : 'dot', tired: true, mouth: 'flat', ...extra });
  const youNervous = (c, extra = {}) => YOU.setFace({ eyes: 'wide', pupil: [noise1(c.t * 2, 3) * 0.6, 0], mouth: 'wavy', brows: 'worried', ...extra });
  const czCalm = (c, extra = {}) => CZ.setFace({ eyes: blink(c.t, 7) ? 'shut' : 'sly', mouth: 'flat', ...extra });
  function hallGuests(c, turnTo) {
    const G = [[GA, -4.6, 0.3, 0.3, 'glassA'], [GB, -3.7, 0.85, 0.15, 'glassB'], [GC, -2.8, 0.25, -0.1, 'glassC'], [GD, -1.9, 0.8, -0.3, 'glassD']];
    G.forEach(([g, x, z, ry, gl], i) => {
      place(g, x, z, ry);
      const hp = handPos(g, 'R'); propAt(gl, hp.add(V(0, 0.05, 0.02)));
      pose.arm(g, 'R', [-0.15, -0.8, 0.4], [-0.05, 0.3, 0.9]);
      g.root.updateMatrixWorld(true); const hp2 = handPos(g, 'R'); world[gl].position.copy(hp2.add(V(0, 0.08, 0)));
      if (turnTo) { const k = easeOutBack(ramp(c.t, turnTo.t0 + i * 0.18, turnTo.t0 + i * 0.18 + 0.2)); lookAt(g, turnTo.p, k); g.setFace({ eyes: k > 0.5 ? 'wide' : 'dot', mouth: k > 0.5 ? 'o' : 'smile' }); }
      else g.setFace({ eyes: blink(c.t, i) ? 'shut' : 'dot', mouth: 'smile' });
    });
  }
  const cousinOnSofa = (c) => { place(CZ, 3.35, -3.25, -0.35); pose.sit(CZ, 0.62); const bp = CZ.root.position.clone().add(V(-0.55, 0.72, 0.15)); propAt('bag', bp, [0, -0.3, 0]); pose.arm(CZ, 'R', [-0.3, -0.9, 0.3], [0.1, -0.2, 1]); pose.arm(CZ, 'L', [0.2, -0.9, 0.3], [-0.1, -0.2, 1]); };
  const sitToilet = () => { place(YOU, 0, -1.68, 0); pose.sit(YOU, 0.66); };
  const partyFamily = (c, o = {}) => {
    const fam = [[MOM, -1.3, -2.55, 0], [GM, -0.4, -2.6, 0], [GB, 0.5, -2.55, 0], [GC, 1.4, -2.6, 0]];
    fam.forEach(([ch, x, z, ry], i) => {
      const k = o.gather ? easeInOut(ramp(c.t, o.gather + i * 0.05, o.gather + 0.6)) : 0;
      place(ch, x * (1 - 0.25 * k), z + 0.9 * k, ry);
      if (o.clap) pose.clap(ch, c.t + i * 0.3);
    });
    MOM.setFace({ eyes: 'dot', tired: true, mouth: o.clap ? 'smile' : 'flat' });
    GM.setFace({ eyes: 'dot', mouth: o.clap ? 'smile' : 'o' }); GB.setFace({ eyes: 'dot', mouth: o.clap ? 'bigSmile' : 'o' }); GC.setFace({ eyes: 'dot', mouth: o.clap ? 'grin' : 'o' });
  };

  // =================== 1. You're 32 years old ===================
  add(0, '01a proud + 32 balloon', (c) => {
    use(c, 'home');
    place(YOU, 0.25, -1.3, 0); pose.proud(YOU);
    YOU.setFace({ eyes: 'dot', mouth: 'bigSmile', brows: 'raised' });
    S.home.n32.position.y = 2.5 + Math.sin(c.t * 2.2) * 0.05; S.home.n32.rotation.z = Math.sin(c.t * 1.7) * 0.05;
    goldSparkles(c, P(c, 0.9, 2.6, -2.4), [1.2, 0.8, 0.3], 8, 0.22, 3);
    cam(c, { p: [0.15, 1.85, 2.7], l: [0.0, 1.85, -1.8], f: 48 }, { p: [0.1, 1.85, 2.2], l: [0.0, 1.9, -1.8], f: 46 });
  });
  add(0.95, '01b proud face', (c) => {
    use(c, 'home');
    place(YOU, 0.25, -1.3, 0); pose.proud(YOU);
    YOU.setFace({ eyes: 'happy', mouth: 'bigSmile', brows: 'raised' });
    goldSparkles(c, headPos(YOU).add(V(0, 0.2, 0.3)), [1.0, 0.6, 0.2], 6, 0.18, 5);
    faceCam(c, YOU, 2.2, 1.85, { fov: 36 });
  });
  // =================== 2. and you still can't wipe your own ass ===================
  add(L['02'].s - 0.02, '02a toilet paper?', (c) => {
    use(c, 'home');
    place(YOU, 0.25, -1.3, 0);
    const rp = headPos(YOU).addScaledVector(fwd(YOU), 0.45).add(V(0.0, -0.35, 0));
    propAt('roll', rp, [0, 0, 0.25 * Math.sin(c.t * 2)]);
    reach(YOU, 'R', rp.clone().add(V(-0.12, -0.02, 0)), [-1, -1, 0]); reach(YOU, 'L', rp.clone().add(V(0.12, -0.02, 0)), [1, -1, 0]);
    YOU.setFace({ eyes: 'dot', mouth: 'small', brows: 'worried', look: 0 });
    YOU.neck.rotation.x = 0.25;
    cam(c, { p: [0.5, 1.8, 1.4], l: [0.25, 1.4, -1.3], f: 42 }, { p: [0.45, 1.75, 1.0], l: [0.25, 1.45, -1.3], f: 40 });
  });
  add(w('02', 3), '02b confused', (c) => {
    use(c, 'home');
    place(YOU, 0.25, -1.3, 0);
    const rp = headPos(YOU).addScaledVector(fwd(YOU), 0.45).add(V(0.15, -0.25, 0));
    propAt('roll', rp, [0.3, 0.4, 0.2]);
    reach(YOU, 'R', rp.clone().add(V(-0.1, -0.02, 0)), [-1, -1, 0]);
    YOU.setFace({ eyes: 'wide', pupil: [0.6, -0.3], mouth: 'wavy', brows: 'worried' });
    YOU.neck.rotation.z = 0.15;
    faceCam(c, YOU, 2.0, 1.7, { fov: 36 });
    bigText(c, '?', c.st + 0.1, '#ffffff', 0.17, 22, 0.66);
  });
  // =================== 3. rich cousin's house ===================
  add(L['03'].s - 0.3, '03a gate opens', (c) => {
    use(c, 'gate');
    const u = easeInOut(ramp(c.t, A.gate, A.gate + 1.6));
    S.gate.gate.L.rotation.y = 1.25 * u; S.gate.gate.R.rotation.y = -1.25 * u;
    goldSparkles(c, P(c, 0, 3.0, 0), [4, 1, 0.5], 8, 0.25, 9);
    cam(c, { p: [0, 1.5, 8.5], l: [0, 2.6, -10], f: 50 }, { p: [0, 1.6, 7.2], l: [0, 2.6, -10], f: 48 });
  });
  add(w('03', 4), '03b the mansion', (c) => {
    use(c, 'gate');
    S.gate.gate.L.rotation.y = 1.25; S.gate.gate.R.rotation.y = -1.25;
    place(YOU, 0.2, lerp(1.5, -1.5, c.u), Math.PI); pose.walk(YOU, c.t * 9, 0.9);
    goldSparkles(c, P(c, 0, 5, -14), [14, 5, 1], 14, 0.5, 11);
    cam(c, { p: [0.6, 1.9, 5.0], l: [0, 3.5, -14], f: 44 }, { p: [0.5, 2.2, 3.4], l: [0, 4, -14], f: 42 });
  });
  // =================== 4. Big house. Golden toilet. ===================
  add(L['04'].s - 0.1, '04a chandelier', (c) => {
    use(c, 'hall');
    S.hall.chandelier.rotation.y = c.t * 0.15;
    goldSparkles(c, P(c, 0, 4.8, -1.5), [3, 1.2, 3], 14, 0.3, 13);
    cam(c, { p: [0.4, 1.4, 4.2], l: [0, 4.8, -1.5], f: 56 }, { p: [0.3, 1.5, 3.2], l: [0, 4.9, -1.5], f: 54 });
  });
  add(w('04', 2) - 0.05, '04b golden toilet', (c) => {
    use(c, 'bath');
    goldSparkles(c, P(c, 0, 0.9, -1.8), [1.4, 1.4, 0.8], 16, 0.25, 15);
    fx.sprite('glow', P(c, 0, 0.8, -1.7), [2.6, 2.6], { opacity: 0.45, additive: true, color: 0xffd86a, order: 9 });
    fx.godRays(P(c, 0, 3.2, -1.85), 0.7);
    cam(c, { p: [0.9, 1.4, 1.0], l: [0, 0.75, -1.85], f: 44 }, { p: [0.7, 1.3, 0.4], l: [0, 0.75, -1.85], f: 42 });
  });
  // =================== 5. You poop. ===================
  add(L['05'].s - 0.15, '05 you poop', (c) => {
    use(c, 'bath'); sitToilet();
    YOU.setFace({ eyes: 'shut', mouth: 'grin', brows: 'angry' });
    YOU.body.rotation.x = 0.12 + Math.sin(c.t * 20) * 0.01;
    const k = ramp(c.t, L['05'].e - 0.2, L['05'].e + 0.2);
    if (k > 0) { fx.stinkBundle(P(c, -0.4, 0.75, -1.5), c.t, k, 0.9, 1); fx.stinkBundle(P(c, 0.45, 0.8, -1.5), c.t + 0.4, k, 0.9, 4); }
    goldSparkles(c, P(c, 0, 1.0, -1.9), [1.4, 1.0, 0.6], 6, 0.2, 17);
    cam(c, { p: [0.0, 1.55, 1.3], l: [0, 1.15, -1.7], f: 44 }, { p: [0.0, 1.55, 0.9], l: [0, 1.2, -1.7], f: 42 });
  });
  // =================== 6. Then you look around. No mom. ===================
  add(L['06'].s - 0.1, '06a look around', (c) => {
    use(c, 'bath'); sitToilet();
    const look = Math.sin((c.t - L['06'].s) * 5);
    YOU.neck.rotation.y = look * 0.7;
    YOU.setFace({ eyes: 'wide', pupil: [look, 0], mouth: 'flat', brows: 'raised' });
    fx.stinkBundle(P(c, 0.4, 0.9, -1.5), c.t, 0.6, 0.8, 5);
    faceCam(c, YOU, 2.1, 1.8, { fov: 36 });
  });
  add(w('06', 4) - 0.05, '06b no mom', (c) => {
    use(c, 'bath'); sitToilet();
    YOU.setFace({ eyes: 'dot', mouth: 'small', brows: 'worried' });
    YOU.neck.rotation.y = 0.5;
    cam(c, { p: [1.6, 2.6, 2.4], l: [0, 0.9, -1.6], f: 50 }, { p: [1.8, 2.8, 2.9], l: [0, 0.9, -1.6], f: 50 });
    vignette(c, 0.35);
  });
  // =================== 7. YOU PANIC. ===================
  add(L['07'].s - 0.08, '07 panic', (c) => {
    use(c, 'bath'); sitToilet();
    YOU.setFace({ eyes: 'wide', pupil: [0, 0], mouth: 'shout', brows: 'worried', eyeScale: 1.25 });
    const hp = headPos(YOU);
    for (let i = 0; i < 6; i++) { const ph = (c.t * 1.4 + i / 6) % 1; const side = i % 2 ? 1 : -1; fx.sprite('drop', hp.clone().add(V(side * (0.24 + ph * 0.12), 0.32 - ph * 0.55, 0.32)), 0.2, { opacity: 1 - ph * 0.5, rot: side * 0.4, order: 22 }); }
    pose.arm(YOU, 'L', [0.6, 0.6, 0.3], [0.1, 0.9, 0.3]); pose.arm(YOU, 'R', [-0.6, 0.6, 0.3], [-0.1, 0.9, 0.3]);
    faceCam(c, YOU, 1.8, 1.5, { fov: 38, ease: easeOut });
  });
  // =================== 8. You call her. ===================
  add(L['08'].s - 0.1, '08 call mom', (c) => {
    use(c, 'bath'); sitToilet();
    youNervous(c);
    const pp = headPos(YOU).addScaledVector(fwd(YOU), 0.42).add(V(0.12, -0.12, 0));
    propAt('phone', pp, [0, 0, 0]);
    reach(YOU, 'R', pp.clone().add(V(0, -0.2, -0.02)), [-1, -1, 0]);
    const ring = (c.t * 2.2) % 1;
    for (const s of [1, -1]) fx.sprite('arcs', pp.clone().add(V(s * (0.2 + ring * 0.08), 0.12, 0)), [0.18, 0.18], { opacity: 1 - ring, rot: s > 0 ? 0 : Math.PI, order: 30 });
    c.camPos.copy(pp).add(V(-0.12, 0.08, 1.15)); c.camLook.copy(pp).add(V(-0.12, 0.08, -0.5)); c.fov = 40;
    sweat(c, YOU, 1, 0.14, 6);
  });
  // =================== 9. Mom... I'm done. ===================
  const whisper = (c, d0, d1) => {
    use(c, 'bath'); sitToilet();
    YOU.setFace({ eyes: 'dot', mouth: 'small', brows: 'worried' });
    const hp = headPos(YOU);
    propAt('phone', hp.clone().add(V(-0.36, -0.02, 0.05)), [0, Math.PI / 2, 0.2]);
    reach(YOU, 'R', hp.clone().add(V(-0.36, -0.18, 0.05)), [-1, -1, 0]);
    reach(YOU, 'L', hp.clone().add(V(-0.05, -0.12, 0.33)), [1, -1, 0]);
    faceCam(c, YOU, d0, d1, { fov: 36, yaw: 0.3 });
    vignette(c, 0.4);
  };
  add(L['09'].s - 0.1, '09a mom...', (c) => { whisper(c, 2.0, 1.75); });
  add(w('09', 1) - 0.06, "09b i'm done", (c) => { whisper(c, 1.55, 1.4); sweat(c, YOU, 2, 0.13, 9); });
  // =================== 10. AGAIN?! OKAY, I'M COMING. ===================
  add(L['10'].s - 0.1, '10a AGAIN?!', (c) => {
    use(c, 'home');
    place(MOM, -1.0, -0.75, 0.3);
    MOM.setFace({ eyes: 'dot', tired: true, mouth: talking(c.t, '10') ? 'shout' : 'flat', brows: 'angry', eyeScale: 1.1 });
    pose.arm(MOM, 'R', [-0.5, 0.6, 0.4], [-0.1, 0.9, 0.2]);
    faceCam(c, MOM, 1.9, 1.5, { fov: 38, ease: easeOut });
  });
  add(w('10', 1) - 0.05, '10b grabs mug + slippers', (c) => {
    use(c, 'home');
    const u = ramp(c.t, c.st, c.et);
    place(MOM, lerp(-0.6, 0.9, u), lerp(-0.9, -1.8, u), 2.2); pose.walk(MOM, c.t * 8, 0.9);
    momTired(c, { mouth: talking(c.t, '10') ? 'open' : 'flat', brows: 'angry' });
    withMug(c);
    cam(c, { p: [0.2, 1.7, 2.3], l: [-0.2, 1.1, -1.5], f: 46 }, { p: [0.4, 1.7, 1.9], l: [0.4, 1.1, -1.8], f: 46 });
  });
  // =================== 11. 40 minutes later, Mom walks in ===================
  add(L['11'].s - 0.12, '11a doors open', (c) => {
    use(c, 'hall');
    const u = easeOut(ramp(c.t, A.mansionDoor, A.mansionDoor + 0.8));
    S.hall.entL.rotation.y = -1.3 * u; S.hall.entR.rotation.y = 1.3 * u;
    place(MOM, lerp(-8.4, -6.9, ramp(c.t, c.st + 0.3, c.et)), 2.0, Math.PI / 2); pose.walk(MOM, c.t * 4, 0.7); momTired(c); withMug(c);
    fx.sprite('glow', P(c, -8.2, 1.7, 2.0), [3, 4], { opacity: 0.6, additive: true, color: 0xffd080, order: 9 });
    cam(c, { p: [-3.0, 1.6, 4.8], l: [-7.6, 1.6, 2.0], f: 42 }, { p: [-3.4, 1.55, 4.3], l: [-7.4, 1.6, 2.0], f: 40 });
  });
  add(w('11', 3) - 0.05, '11b slow-mo walk', (c) => {
    use(c, 'hall');
    S.hall.entL.rotation.y = -1.3; S.hall.entR.rotation.y = 1.3;
    const x = lerp(-6.4, -5.4, c.u);
    place(MOM, x, 1.8, Math.PI / 2 - 0.25); pose.walk(MOM, c.t * 3.2, 0.7); momTired(c); withMug(c);
    const hp = headPos(MOM);
    c.camPos.copy(hp).add(V(2.6, -0.3, 0.9)); c.camLook.copy(hp).add(V(0, -0.5, 0)); c.fov = 42;
    goldSparkles(c, hp.clone().add(V(0, 0, 0)), [2, 2, 1], 6, 0.18, 21);
  });
  // =================== 12. with her mug ===================
  add(L['12'].s - 0.05, '12 the mug', (c) => {
    use(c, 'hall');
    place(MOM, -5.0, 1.7, Math.PI / 2 - 0.25); pose.walk(MOM, c.t * 3.2, 0.6); momTired(c); withMug(c);
    const mp = world.mug.position.clone();
    const sw = ramp(c.t, c.st + 0.15, c.st + 0.65);
    fx.sprite('glow', mp.clone().add(V(-0.05 + sw * 0.1, 0.0, 0.1)), [0.12, 0.3], { opacity: Math.sin(sw * Math.PI), additive: true, order: 40 });
    glint(c, mp.clone().add(V(0.05, 0.1, 0.12)), c.st + 0.55, 0.45);
    c.camPos.copy(mp).add(V(0.25, 0.05, 0.75)); c.camLook.copy(mp); c.fov = lerp(40, 34, easeInOut(c.u));
  });
  // =================== 13. past the guests ===================
  add(L['13'].s - 0.1, '13 guests turn', (c) => {
    use(c, 'hall');
    const mx = lerp(-4.8, -2.4, c.u);
    place(MOM, mx, 1.75, Math.PI / 2); pose.walk(MOM, c.t * 5, 0.8); momTired(c); withMug(c);
    hallGuests(c, { t0: c.st + 0.05, p: headPos(MOM) });
    cam(c, { p: [-4.4, 1.7, 4.4], l: [-3.6, 1.4, 0.6], f: 46 }, { p: [-2.8, 1.7, 4.4], l: [-2.6, 1.4, 0.6], f: 46 });
  });
  // =================== 14. past the chandelier ===================
  add(L['14'].s - 0.1, '14 under the chandelier', (c) => {
    use(c, 'hall');
    place(MOM, lerp(-1.0, 0.6, c.u), -0.9, Math.PI / 2 - 0.3); pose.walk(MOM, c.t * 5, 0.8); momTired(c); withMug(c);
    S.hall.chandelier.rotation.y = c.t * 0.15;
    goldSparkles(c, P(c, 0, 4.6, -1.5), [3, 1, 3], 10, 0.28, 23);
    cam(c, { p: [-0.6, 0.55, 2.8], l: [0, 3.0, -1.2], f: 58 }, { p: [-0.4, 0.6, 2.4], l: [0.2, 3.0, -1.2], f: 58 });
  });
  // =================== 15. past your cousin ===================
  add(L['15'].s - 0.1, '15 past your cousin', (c) => {
    use(c, 'hall'); cousinOnSofa(c); czCalm(c);
    place(MOM, lerp(1.4, 3.4, c.u), -1.7, Math.PI / 2 + 0.1); pose.walk(MOM, c.t * 5, 0.8); momTired(c); withMug(c);
    lookAt(CZ, headPos(MOM), 0.8);
    cam(c, { p: [2.6, 1.5, 1.3], l: [3.2, 1.2, -2.6], f: 46 }, { p: [2.8, 1.5, 1.0], l: [3.3, 1.2, -2.6], f: 44 });
  });
  // =================== 16. Your cousin doesn't say a word. ===================
  add(L['16'].s - 0.1, '16a cousin blank', (c) => {
    use(c, 'hall'); cousinOnSofa(c); czCalm(c);
    faceCam(c, CZ, 2.2, 2.0, { fov: 36 });
  });
  add(w('16', 2) - 0.05, '16b slow push', (c) => {
    use(c, 'hall'); cousinOnSofa(c); czCalm(c, { look: 0.6 });
    faceCam(c, CZ, 1.8, 1.45, { fov: 36, yaw: 0.25 });
    vignette(c, 0.35);
  });
  // =================== 17. She just watches. (sunglasses come down) ===================
  add(L['17'].s - 0.1, '17 lowers sunglasses', (c) => {
    use(c, 'hall'); cousinOnSofa(c);
    const u = easeInOut(ramp(c.t, c.st + 0.1, c.et - 0.1));
    const sh = CZ.extras.shades; sh.position.set(0, lerp(DIM.HR * 2 + 0.02, DIM.HR + 0.065, u), lerp(0.18, 0.32, u)); sh.rotation.x = lerp(-0.5, 0, u);
    reach(CZ, 'R', headPos(CZ).add(V(-0.36, lerp(0.32, 0.1, u), 0.12)), [-1, -1, 0]);
    CZ.setFace({ eyes: 'sly', mouth: 'flat' });
    faceCam(c, CZ, 1.5, 1.3, { fov: 36 });
  });
  // =================== 18. Mom wipes your ass. ===================
  add(L['18'].s - 0.12, '18a bathroom door closes', (c) => {
    use(c, 'hall');
    const u = easeIn(ramp(c.t, A.bathDoor, A.bathDoor + 0.45));
    S.hall.bathHinge.rotation.y = lerp(1.25, 0, u);
    if (u < 0.6) { place(MOM, lerp(7.0, 7.7, u), 1.2, Math.PI / 2); pose.walk(MOM, c.t * 5, 0.8); withMug(c); momTired(c); }
    if (u >= 1) { const ud = P(c, 7.7, 0.08, 1.2); for (let i = 0; i < 3; i++) fx.stinkBundle(ud.clone().add(V(-0.1, 0, -0.45 + i * 0.45)), c.t + i * 0.3, ramp(c.t, A.bathDoor + 0.45, A.bathDoor + 0.75), 0.7, 30 + i); }
    cam(c, { p: [3.6, 1.9, 4.6], l: [7.6, 1.3, 1.2], f: 46 }, { p: [4.0, 1.8, 4.2], l: [7.6, 1.2, 1.2], f: 46 });
  });
  add(w('18', 2) - 0.06, '18b censored', (c) => {
    use(c, 'bath');
    place(YOU, 0.25, -1.15, Math.PI); YOU.nude(true);
    YOU.body.rotation.x = 0.32;
    YOU.neck.rotation.y = 2.4; YOU.neck.rotation.x = -0.2;            // panicked look back over his shoulder
    YOU.setFace({ eyes: 'wide', pupil: [0, 0], mouth: 'wavy', brows: 'worried' });
    pose.arm(YOU, 'L', [0.3, -0.6, -0.7], [0.1, -0.4, -0.9]); pose.arm(YOU, 'R', [-0.3, -0.6, -0.7], [-0.1, -0.4, -0.9]);
    place(MOM, 0.95, -0.55, -2.35); momTired(c, { brows: 'angry' });
    const rp = YOU.hips.getWorldPosition(new THREE.Vector3()).add(V(0.3, -0.05, 0.38));
    propAt('roll', rp, [0, 0.4, 0.5]);
    reach(MOM, 'R', rp.clone().add(V(0.12, 0, 0.05)), [-1, -1, 0]);
    reach(MOM, 'L', headPos(MOM).add(V(0.0, -0.1, 0.25)), [1, -1, 0]);         // holding her nose
    const hips = YOU.hips.getWorldPosition(new THREE.Vector3());
    c.censor.push({ pos: hips.clone().add(V(0, -0.12, 0.12)), w: 0.82, h: 0.72, d: 0.5 });
    fx.stinkBundle(hips.clone().add(V(-0.3, 0.3, 0.3)), c.t, 1, 0.9, 41); fx.stinkBundle(hips.clone().add(V(0.4, 0.4, 0.4)), c.t + 0.5, 1, 0.9, 43);
    cam(c, { p: [0.35, 1.45, 1.55], l: [0.45, 1.05, -1.0], f: 46 }, { p: [0.35, 1.4, 1.3], l: [0.45, 1.05, -1.0], f: 46 });
  });
  // =================== 19. You walk out like nothing happened. ===================
  add(L['19'].s - 0.1, '19 walks out whistling', (c) => {
    use(c, 'hall');
    S.hall.bathHinge.rotation.y = 1.2 * (1 - ramp(c.t, c.et - 0.4, c.et));
    place(YOU, lerp(7.2, 5.2, c.u), lerp(1.2, 1.9, c.u), -Math.PI / 2 - 0.3); pose.walk(YOU, c.t * 6, 0.8);
    reach(YOU, 'R', headPos(YOU).add(V(0, -0.38, 0.05)).addScaledVector(fwd(YOU), 0.2), [-1, -1, 0]);
    YOU.setFace({ eyes: 'happy', mouth: 'small', brows: 'raised' });
    const mp = headPos(YOU).addScaledVector(fwd(YOU), 0.35);
    for (let i = 0; i < 3; i++) { const ph = (c.t * 0.9 + i / 3) % 1; fx.sprite('note', mp.clone().add(V(Math.sin(ph * 6 + i) * 0.15, 0.2 + ph * 0.6, 0.1)), 0.2, { opacity: Math.sin(ph * Math.PI), order: 30 }); }
    cam(c, { p: [3.0, 1.7, 3.6], l: [6.2, 1.3, 1.5], f: 44 }, { p: [2.9, 1.7, 3.4], l: [5.4, 1.4, 1.7], f: 44 });
  });
  // =================== 20. Your cousin smiles at you. ===================
  add(L['20'].s - 0.1, '20 sneaky smile', (c) => {
    use(c, 'hall'); cousinOnSofa(c);
    const sh = CZ.extras.shades; sh.position.set(0, DIM.HR + 0.065, 0.32); sh.rotation.x = 0;
    const k = ramp(c.t, w('20', 2), w('20', 2) + 0.6);
    CZ.setFace({ eyes: 'sly', mouth: k > 0.3 ? 'smirk' : 'flat', mouthScale: 1 + 0.3 * k });
    faceCam(c, CZ, 2.0, 1.6, { fov: 36 });
  });
  // =================== 21. Too long. ===================
  add(L['21'].s - 0.1, '21a her smile', (c) => {
    use(c, 'hall'); cousinOnSofa(c);
    const sh = CZ.extras.shades; sh.position.set(0, DIM.HR + 0.065, 0.32); sh.rotation.x = 0;
    CZ.setFace({ eyes: 'sly', mouth: 'smirk', mouthScale: 1.35 });
    const hp = headPos(CZ), f = fwd(CZ);
    c.camPos.copy(hp).addScaledVector(f, lerp(1.25, 0.95, c.u)).add(V(0, -0.12, 0)); c.camLook.copy(hp).add(V(0, -0.12, 0)); c.fov = 34;
  });
  add(L['21'].s + 0.42, '21b you sweat', (c) => {
    use(c, 'hall');
    place(YOU, 4.6, 1.9, -2.2); youNervous(c, { mouth: 'grin' });
    sweat(c, YOU, 5, 0.15, 21);
    faceCam(c, YOU, 1.9, 1.6, { fov: 36 });
  });
  // =================== 22. One week later, (calendar flips) ===================
  add(L['22'].s - 0.1, '22 calendar flips', (c) => {
    use(c, 'home');
    const base = S.home.calendarSpot.clone().add(curO);
    const f = ramp(c.t, c.st + 0.05, c.et - 0.15) * 7;    // flips 1 -> 8
    const day = Math.min(7, Math.floor(f)) + 1, ph = f - Math.floor(f);
    const under = world.page1, top = world.page0;
    under.userData.tex.userData.draw(Math.min(8, day + 1)); propAt('page1', base.clone().add(V(0, 0.5, 0.0)));
    top.userData.tex.userData.draw(day); propAt('page0', base.clone().add(V(0, 0.5, 0.01)), [day >= 8 ? 0 : -Math.PI * easeIn(ph), 0, 0]);
    if (day >= 8) { top.userData.tex.userData.draw(8); top.rotation.x = 0; under.visible = false; }
    c.camPos.copy(base).add(V(0.05, 0.0, 1.6)); c.camLook.copy(base); c.fov = 40;
  });
  // =================== 23. it's your birthday. ===================
  add(L['23'].s - 0.12, '23 party', (c) => {
    use(c, 'party'); partyFamily(c, { clap: true });
    place(YOU, -2.3, -1.3, Math.PI / 2 - 0.4); YOU.setFace({ eyes: 'happy', mouth: 'bigSmile', blush: true });
    place(CZ, 2.4, -1.2, -Math.PI / 2 + 0.3); czCalm(c, { mouth: 'smirk' }); pose.clap(CZ, c.t);
    S.party.flames.forEach((fl, i) => { fl.scale.y = 1 + Math.sin(c.t * 20 + i) * 0.2; });
    S.party.balloons.forEach((b, i) => { b.position.y += Math.sin(c.t * 2 + i) * 0.003; });
    goldSparkles(c, P(c, 0, 2.6, -2), [5, 2, 1], 10, 0.22, 25);
    cam(c, { p: [0, 2.3, 3.6], l: [0, 1.3, -1.8], f: 50 }, { p: [0, 2.2, 3.1], l: [0, 1.3, -1.8], f: 50 });
  });
  // =================== 24. Your cousin hands you a gift. ===================
  add(L['24'].s - 0.12, '24 the gift', (c) => {
    use(c, 'party'); partyFamily(c);
    place(YOU, -0.75, -0.55, Math.PI / 2 - 0.2); YOU.setFace({ eyes: 'dot', mouth: 'smile', brows: 'raised' });
    place(CZ, 0.85, -0.5, -Math.PI / 2 + 0.2); CZ.setFace({ eyes: 'sly', mouth: 'smirk' });
    const u = easeInOut(ramp(c.t, c.st + 0.1, c.st + 0.9));
    const gp = P(c, lerp(0.35, 0.0, u), 1.05, -0.45);
    propAt('gift', gp.clone().add(V(0, -0.25, 0)));
    reach(CZ, 'R', gp.clone().add(V(0.3, 0.0, -0.18)), [0, -1, -1]); reach(CZ, 'L', gp.clone().add(V(0.3, 0.0, 0.18)), [0, -1, 1]);
    if (u > 0.6) { reach(YOU, 'L', gp.clone().add(V(-0.3, 0, -0.18)), [0, -1, -1]); reach(YOU, 'R', gp.clone().add(V(-0.3, 0, 0.18)), [0, -1, 1]); }
    goldSparkles(c, gp.clone().add(V(0, 0.4, 0)), [0.7, 0.4, 0.5], 6, 0.16, 27);
    cam(c, { p: [0.0, 1.8, 2.6], l: [0, 1.3, -0.5], f: 44 }, { p: [0.0, 1.75, 2.1], l: [0, 1.3, -0.5], f: 42 });
  });
  // =================== 25. Open it. IN FRONT OF EVERYONE. ===================
  add(L['25'].s - 0.1, '25a open it', (c) => {
    use(c, 'party'); place(CZ, 0.85, -0.5, -Math.PI / 2 + 0.2);
    CZ.setFace({ eyes: 'sly', mouth: talking(c.t, '25') ? 'small' : 'smirk' });
    faceCam(c, CZ, 1.9, 1.6, { fov: 36, yaw: 0.4 });
  });
  add(w('25', 2) - 0.05, '25b everyone gathers', (c) => {
    use(c, 'party'); partyFamily(c, { gather: c.st });
    place(YOU, -0.75, -0.55, Math.PI / 2 - 0.2); youNervous(c);
    place(CZ, 0.85, -0.5, -Math.PI / 2 + 0.2); CZ.setFace({ eyes: 'sly', mouth: 'smirk' });
    const gp = P(c, -0.4, 1.05, -0.45); propAt('gift', gp.clone().add(V(0, -0.25, 0)));
    reach(YOU, 'L', gp.clone().add(V(-0.3, 0, -0.18)), [0, -1, -1]); reach(YOU, 'R', gp.clone().add(V(-0.3, 0, 0.18)), [0, -1, 1]);
    for (const ch of [MOM, GM, GB, GC]) lookAt(ch, headPos(YOU), 0.8);
    cam(c, { p: [0.2, 2.5, 3.2], l: [0, 1.2, -1.2], f: 52 }, { p: [0.2, 2.4, 2.5], l: [0, 1.2, -1.2], f: 52 });
  });
  // =================== 26. You open it. It's a photo. ===================
  add(L['26'].s - 0.1, '26a tearing paper', (c) => {
    use(c, 'party');
    place(YOU, -0.75, -0.55, Math.PI / 2 - 0.2); YOU.setFace({ eyes: 'wide', mouth: 'grin', brows: 'raised' });
    const gp = P(c, -0.25, 1.05, -0.45); const g = propAt('gift', gp.clone().add(V(0, -0.25, 0)));
    g.userData.body.scale.y = 1 - 0.5 * ramp(c.t, c.st + 0.1, c.et);
    reach(YOU, 'L', gp.clone().add(V(-0.2, 0.2, -0.15)), [0, -1, -1]); reach(YOU, 'R', gp.clone().add(V(-0.1 + Math.sin(c.t * 18) * 0.12, 0.25, 0.15)), [0, -1, 1]);
    for (let i = 0; i < 10; i++) { const ph = (c.t * 1.5 + i / 10) % 1; const s = world['scrap' + i]; s.visible = true; s.position.copy(gp).add(V((hash(i) - 0.5) * 1.2 * ph, 0.3 + ph * 0.6 - ph * ph * 1.2, (hash(i * 3) - 0.5) * 0.8 * ph)); s.rotation.set(ph * 8 + i, ph * 5, i); }
    c.camPos.copy(gp).add(V(0.35, 0.35, 1.35)); c.camLook.copy(gp).add(V(0, 0.15, 0)); c.fov = 42;
  });
  add(w('26', 3) - 0.05, "26b it's a photo", (c) => {
    use(c, 'party');
    place(YOU, -0.75, -0.55, Math.PI / 2 - 0.2);
    const k = ramp(c.t, c.st + 0.15, c.st + 0.45);
    YOU.setFace({ eyes: k > 0.5 ? 'wide' : 'dot', pupil: [0, 0.2], mouth: k > 0.5 ? 'o' : 'smile', brows: k > 0.5 ? 'worried' : 'raised' });
    const fp = headPos(YOU).addScaledVector(fwd(YOU), 0.55).add(V(0, -0.35, 0));
    const fr = propAt('frame', fp, [0, -Math.PI / 2 - 0.2, 0], 0.55);
    reach(YOU, 'L', fp.clone().add(V(0.05, -0.15, -0.3)), [0, -1, -1]); reach(YOU, 'R', fp.clone().add(V(0.05, -0.15, 0.3)), [0, -1, 1]);
    void fr;
    faceCam(c, YOU, 2.3, 2.0, { fov: 38, yaw: -0.35, dy: -0.25 });
  });
  // =================== 27. Mom. Walking into the bathroom with the mug ===================
  const photoCU = (c, ox, oy, d0, d1) => {
    use(c, 'party');
    const fp = P(c, 0, 1.6, -0.6);
    propAt('frame', fp, [0, 0, 0], 1);
    goldSparkles(c, fp, [1.5, 1.2, 0.2], 6, 0.12, 29);
    c.camPos.copy(fp).add(V(ox, oy, lerp(d0, d1, easeInOut(c.u)))); c.camLook.copy(fp).add(V(ox, oy, 0)); c.fov = 36;
  };
  add(L['27'].s - 0.12, '27a photo: mom', (c) => { photoCU(c, 0.0, 0.0, 1.35, 1.15); c.shake.push({ t: c.st, amp: 0.4, dur: 0.25 }); });
  add(w('27', 1) - 0.05, '27b walking into the bathroom', (c) => { photoCU(c, lerp(-0.12, 0.2, easeInOut(c.u)), 0.0, 1.05, 1.0); });
  add(w('27', 5) - 0.05, '27c with the mug', (c) => { photoCU(c, -0.04, -0.1, 0.8, 0.6); glint(c, P(c, -0.04, 1.5, -0.55), c.st + 0.25, 0.25); });
  // =================== 28. in a golden frame. ===================
  add(L['28'].s - 0.05, '28 golden frame', (c) => {
    use(c, 'party');
    const fp = P(c, 0, 1.6, -0.6);
    const fr = propAt('frame', fp, [0, Math.sin(c.t * 1.5) * 0.08, 0], 1);
    void fr;
    goldSparkles(c, fp, [1.8, 1.4, 0.3], 18, 0.26, 31);
    fx.sprite('glow', fp.clone().add(V(0, 0, -0.1)), [3.0, 2.4], { opacity: 0.4, additive: true, color: 0xffd86a, order: 9 });
    c.camPos.copy(fp).add(V(0, 0, lerp(0.75, 2.2, easeOut(c.u)))); c.camLook.copy(fp); c.fov = 40;
  });
  // =================== 29. Everyone looks at you. (quick reactions) ===================
  const react = (c, ch, face, seed) => {
    use(c, 'party'); partyFamily(c, { gather: -10 });
    ch.setFace(face);                                       // his point of view: he is the camera
    for (const q of [MOM, GM, GB, GC]) lookAt(q, P(c, -0.75, 1.95, -0.55), 0.9);
    const pov = P(c, -0.75, 1.95, -0.55), hp = headPos(ch);
    const away = pov.clone().sub(hp).normalize();
    c.camPos.copy(pov).addScaledVector(away, lerp(0.75, 0.6, c.u)); c.camLook.copy(hp).add(V(0, -0.08, 0)); c.fov = 30;
  };
  const r0 = L['29'].s - 0.1, rd = (L['30'].s - 0.05 - r0) / 4;
  add(r0, '29a mom looks', (c) => react(c, MOM, { eyes: 'dot', tired: true, mouth: 'flat' }, 1));
  add(r0 + rd, '29b grandma looks', (c) => react(c, GM, { eyes: 'wide', pupil: [0, 0], mouth: 'o' }, 2));
  add(r0 + rd * 2, '29c aunt looks', (c) => react(c, GB, { eyes: 'wide', pupil: [0, 0], mouth: 'bigO' }, 3));
  add(r0 + rd * 3, '29d uncle looks', (c) => react(c, GC, { eyes: 'dot', mouth: 'frown', brows: 'raised' }, 4));
  // =================== 30. Grandma takes a picture of the picture. ===================
  add(L['30'].s - 0.05, '30 grandma photo', (c) => {
    use(c, 'party'); partyFamily(c, { gather: -10 });
    const up = easeOut(ramp(c.t, c.st + 0.1, c.st + 0.6));
    GM.setFace({ eyes: c.t > A.flash ? 'happy' : 'dot', mouth: 'smile' });
    const pp = headPos(GM).addScaledVector(fwd(GM), 0.42).add(V(0.05, lerp(-0.45, 0.02, up), 0));
    propAt('oldPhone', pp, [0, 0, 0]);
    reach(GM, 'R', pp.clone().add(V(-0.05, -0.12, -0.02)), [-1, -1, 0]); reach(GM, 'L', pp.clone().add(V(0.05, -0.12, -0.02)), [1, -1, 0]);
    const fl = pulse(c.t, A.flash, 0.03, 0.06, 0.35);
    if (fl > 0) { fx.sprite('flash', pp.clone().add(V(0, 0.06, 0.1)), 0.6 + 1.6 * fl, { opacity: fl, additive: true, order: 50 }); tint(c, `rgba(255,255,255,${(0.85 * fl).toFixed(3)})`); }
    faceCam(c, GM, 2.0, 1.6, { fov: 38, dy: -0.15 });
    const fo = ramp(c.t, TL.duration - 0.55, TL.duration - 0.03);
    if (fo > 0) tint(c, `rgba(0,0,0,${fo.toFixed(3)})`);
  });

  shots.sort((a, b) => a.t - b.t);
  return shots;
}
