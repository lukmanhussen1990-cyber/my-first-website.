// The reel, shot by shot. Every shot is a pure function of time; scene timing follows the voice
// (build/timings.json). Also exports overlay state and the SFX cue list.
import * as THREE from 'three';
import { mood, applyMood } from './moods.js';
import { Poses } from './characters.js';
import { groundHeight } from './world.js';
import { ARK, hullHalfWidth } from './ark.js';
import { BEARD_GREY, BEARD_WHITE } from './cast.js';
import { clamp, lerp, smooth, invLerp, easeInOut, easeOut, kf, hash01, pulse } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

export function buildTimeline(ctx) {
  const { T, camera, world: W, ark: A, P, animals: AN, fx, props } = ctx;
  const L = Object.fromEntries(T.lines.map((l) => [l.id, l]));
  const word = (id, w, nth = 0) => { const m = L[id].tokens.filter((t) => t.t.replace(/[^A-Za-z']/g, '').toUpperCase() === w.toUpperCase()); return m[nth].start; };
  const cut = (id) => L[id].start - 0.2;
  const END = T.duration;
  const cues = [];
  const cue = (t, type, gain = 1, extra = {}) => cues.push({ t: +t.toFixed(3), type, gain, ...extra });

  // ---------- helpers ----------
  const allPeople = ctx.allPeople, allAnimals = ctx.allAnimals;
  function reset() {
    for (const s of Object.values(W.sets)) s.visible = false;
    A.root.visible = false; A.root.position.set(0, 0, 0); A.root.rotation.set(0, 0, 0);
    for (const p of allPeople) p.root.visible = false;
    for (const a of allAnimals) a.group.visible = false;
    for (const k of Object.keys(fx)) { const f = fx[k]; if (Array.isArray(f)) f.forEach((x) => { (x.group || x).visible = false; }); else if (f && (f.group || f.isObject3D)) (f.group || f).visible = false; }
    for (const p of Object.values(props)) p.visible = false;
    W.terrainMat.color.setRGB(1, 1, 1);
    ctx.crownMats.forEach((m, i) => m.color.copy(ctx.crownBase[i]));
    W.site.visible = true;
    camera.up.set(0, 1, 0);
    ctx.U.uWind.value = 1;
  }
  function cam(p, l, fov = 32, roll = 0) {
    camera.position.copy(p); camera.fov = fov; camera.updateProjectionMatrix();
    camera.up.set(Math.sin(roll), Math.cos(roll), 0); camera.lookAt(l);
    camera.updateMatrixWorld(true);
  }
  function camK(u, keys, ease = easeInOut) { // keys: [[u, pos, look, fov], ...]
    const uu = clamp(u);
    let i = 0; while (i < keys.length - 2 && uu > keys[i + 1][0]) i++;
    const [u0, p0, l0, f0] = keys[i], [u1, p1, l1, f1] = keys[i + 1];
    const k = ease(clamp((uu - u0) / (u1 - u0)));
    cam(V(...p0).lerp(V(...p1), k), V(...l0).lerp(V(...l1), k), lerp(f0 ?? 32, f1 ?? f0 ?? 32, k));
  }
  const toScreen = (v) => { const p = v.clone().project(camera); return { x: (p.x + 1) / 2 * 1080, y: (1 - p.y) / 2 * 1920, z: p.z }; };
  function put(p, x, z, pose, facing = 1, y = null) {
    p.root.visible = true;
    p.root.position.set(x, y ?? groundHeight(x, z) + 0.02, z);
    p.setFacing(facing); p.pose(pose); p.billboard(camera); p.autoOutline(camera);
    return p;
  }
  function faceTo(p, target) { const a = toScreen(p.root.position), b = toScreen(target); p.setFacing(b.x >= a.x ? 1 : -1); }
  function shadowBox(center, size = 40) {
    const s = ctx.sun; s.position.copy(center).addScaledVector(ctx.sunDir, 120); s.target.position.copy(center); s.target.updateMatrixWorld();
    const c = s.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 1; c.far = 300; c.updateProjectionMatrix();
  }
  function setMood(a, b, u, overrides) {
    let m;
    if (typeof b === 'string') m = mood(a, b, u); else { m = typeof a === 'string' ? mood(a) : a; overrides = b; }
    const p = applyMood(m, ctx); return Object.assign(p, overrides || {});
  }
  function plainOn(t) {
    W.sets.plain.visible = true;
    fx.smoke.group.visible = true; fx.smoke.set(t);
    fx.birds.group.visible = true; fx.birds.set(t, V(-5, 0, 10), 34, 16);
    for (const s of W.flock) { s.group.visible = true; s.update(t, 0); }
    // palms sway
    W.palms.forEach((p, i) => { p.userData.crown.rotation.z = 0.05 * Math.sin(t * 1.3 + i); p.userData.crown.rotation.x = 0.04 * Math.sin(t * 1.1 + i * 2); });
  }
  const ROWH = ARK.H / ARK.rows;
  const noahSet = ctx.noahBeard;

  // Mockers around a point, laughing at `target`
  const mockPoses = [Poses.laughPoint, Poses.laughCup, Poses.laughPoint, Poses.laughBend, Poses.smirk, Poses.laughPoint, Poses.laughCup];
  function mockers(t, list, spots, target, intensity = 1) {
    list.forEach((p, i) => {
      if (!spots[i]) return;
      const [x, z] = spots[i];
      const f = mockPoses[i % mockPoses.length];
      const pose = f === Poses.laughPoint || f === Poses.laughCup ? f(t, p.seed, intensity) : f(t, p.seed);
      put(p, x, z, pose, 1); faceTo(p, target); p.billboard(camera);
    });
  }

  // ground point `dist` ahead of the camera, `off` world units to the right of the view axis
  function along2(dist, off = 0, y = null) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
    const p = camera.position.clone().addScaledVector(f, dist).add(V(-f.z, 0, f.x).multiplyScalar(off));
    p.y = y ?? groundHeight(p.x, p.z) + 0.02; return p;
  }
  // same, but `sx` is a fraction of the half frame width (-1 = left edge, 1 = right edge)
  function inFrame(dist, sx = 0, y = null) { return along2(dist, sx * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * dist, y); }
  const camRight = () => { const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); return V(-f.z, 0, f.x); };
  function putAt(p, v, pose, facing = 1) { return put(p, v.x, v.z, pose, facing, v.y); }

  // =====================================================================
  const S = [];
  const shot = (o) => { S.push(o); return o; };
  const ladderNoah = (t, k = 4) => {
    const r = A.rung(k); const toCam = camera.position.clone().sub(r).setY(0).normalize();
    return r.addScaledVector(toCam, 0.25);
  };

  // ---- S1: the hook — Noah on a ladder, crowd laughing below ----
  const S1 = shot({
    id: 'S1', t0: 0, t1: cut('S2'), trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.56, pitch: 0, door: 1, glow: 0, ramp: 0, scaffold: false });
      const u = lt / dur;
      camK(u, [[0, [5.8, 3.7, 19.8], [-4.7, 2.9, 4.6], 32], [1, [4.8, 3.45, 18.1], [-4.8, 3.0, 4.6], 30]]);
      const nf = ladderNoah(t, 4);
      put(P.noah, nf.x, nf.z, Poses.climb(t, 11), -1, nf.y); noahSet(0); P.noah.setProp('hammer');
      faceTo(P.noah, V(nf.x, nf.y + 1.5, 2.0)); P.noah.billboard(camera);
      P.noah.blob.visible = false;
      const spots = [[11.6, -0.78], [12.4, -0.42], [11.2, -0.08], [12.8, 0.22], [11.5, 0.55], [13.4, 0.84], [13.6, -0.62], [14.2, 0.42]];
      const crowd = P.crowd.slice(0, 8);
      crowd.forEach((p, i) => {
        const v = inFrame(spots[i][0], spots[i][1]);
        const f = mockPoses[i % mockPoses.length];
        const pose = f === Poses.laughPoint || f === Poses.laughCup ? f(t, p.seed, 1) : f(t, p.seed);
        putAt(p, v, pose); faceTo(p, P.noah.root.position); p.billboard(camera);
      });
      fx.dust.group.visible = true; fx.dust.set(t, V(nf.x, nf.y + 1.5, nf.z - 0.6), S1.strikes);
      shadowBox(V(-3, 0, 7), 24);
      return setMood('build', { focus: 15, focusRange: 6, dof: 0.55, tilt: 0.5, tiltTop: 0.72 });
    },
  });
  S1.strikes = []; for (let n = 0; n < 12; n++) { const s = (n + 0.8) * 0.62; if (s < S1.t1) S1.strikes.push(s); }

  // ---- S2: close on Noah, wiping sweat, looking up at a clear sky ----
  const S2 = shot({
    id: 'S2', t0: cut('S2'), t1: cut('S3'), trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.56, pitch: 0, glow: 0, ramp: 0, scaffold: false });
      const u = lt / dur;
      const r = A.rung(4);
      camK(u, [[0, [r.x + 4.3, r.y + 0.95, r.z + 1.7], [r.x - 0.1, r.y + 1.55, r.z + 0.15], 30], [1, [r.x + 3.8, r.y + 0.8, r.z + 1.45], [r.x - 0.1, r.y + 1.62, r.z + 0.15], 29]]);
      const nf = ladderNoah(t, 4);
      P.noah.setProp(null);
      const pose = u < 0.7 ? Poses.wipeSweat(t, 11, u / 0.7) : Poses.lookUp(t, 11, 1);
      put(P.noah, nf.x, nf.z, pose, 1, nf.y); noahSet(0.08);
      P.noah.blob.visible = false;
      shadowBox(V(-5, 0, 6), 14);
      return setMood('build', 'clear', 0.35, { focus: 4.5, focusRange: 1.2, dof: 1.0, tilt: 0.2, tiltTop: 0.85, haze: 0.12 });
    },
  });

  // ---- S3: time-lapse — seasons, sun arcs, ribs & planks grow, beard whitens, crowd keeps laughing ----
  const S3 = shot({
    id: 'S3', t0: cut('S3'), t1: cut('S4'), trans: { type: 'fade', dur: 0.45 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      const u = clamp(lt / dur);
      A.root.visible = true; A.set({ progress: lerp(0.3, 0.9, u), pitch: smooth(invLerp(0.6, 1, u)) * 0.5, glow: 0, ramp: 0 });
      camK(u, [[0, [21, 7.5, 31], [-1.5, 2.4, 1.0], 33], [1, [15, 6.2, 31], [-2.5, 2.6, 1.0], 31]], (x) => x);
      // sun arcs fast (≈2 days) + seasons cycle
      const day = lt * 0.42 + 0.15;
      const ang = day * TAU, elev = 0.25 + 0.55 * Math.max(0, Math.sin(day * TAU * 0.5 + 0.6));
      const m = mood('build');
      const mm = { ...m, sunDir: [Math.cos(ang) * 0.8, elev + 0.25, Math.sin(ang) * 0.6], sun: m.sun * (0.75 + 0.25 * Math.sin(day * TAU)) };
      const seasons = [[1, 1, 1], [1.13, 1.02, 0.74], [1.18, 0.86, 0.6], [1.2, 1.18, 1.16], [1, 1, 1]];
      const sp = (u * 1.6) % 1 * 4; const si = Math.floor(sp); const sf = smooth(sp - si);
      const sc = seasons[si].map((v, i) => lerp(v, seasons[si + 1][i], sf));
      W.terrainMat.color.setRGB(...sc);
      ctx.crownMats.forEach((mat, i) => mat.color.copy(ctx.crownBase[i]).multiply(new THREE.Color(...sc)));
      // Noah hammering on the scaffold (fast), beard grey -> white
      put(P.noah, -8.2, ARK.tw + 0.85, Poses.hammer(t, 11, 0.3), -1, 2.66); P.noah.setProp('hammer'); noahSet(smooth(u));
      faceTo(P.noah, V(-8.2, 3.5, 0)); P.noah.billboard(camera); P.noah.blob.visible = false;
      // sons carry planks back and forth; Ham pitches
      const walkLoop = (p, x0, x1, z, phase, speed = 2.2, propName = 'plank') => {
        const span = Math.abs(x1 - x0); const per = 2 * span / speed; const w = ((t * 1.6 + phase) % per) / per;
        const fwd = w < 0.5; const x = fwd ? lerp(x0, x1, w * 2) : lerp(x1, x0, (w - 0.5) * 2);
        p.setProp(fwd ? propName : null);
        put(p, x, z, fwd ? Poses.carryOverhead(t * 1.6, p.seed, 1) : Poses.walk(t * 1.6, p.seed, 1.2), (fwd ? 1 : -1) * Math.sign(x1 - x0));
        const a = toScreen(V(x0, 0, z)), b = toScreen(V(x1, 0, z)); p.setFacing(((fwd ? 1 : -1) * (b.x - a.x)) >= 0 ? 1 : -1);
      };
      walkLoop(P.shem, -16, -5, 6.6, 0.0); walkLoop(P.japheth, 8, 16, 6.9, 1.3);
      put(P.ham, 10.8, 5.0, Poses.paint(t * 1.5, 14), -1); P.ham.setProp('brush');
      put(P.wife, -13.5, 8.4, Poses.hold(t, 12), 1);
      put(P.hamWife, 13.0, 8.6, Poses.idle(t, 17), -1);
      // the crowd comes and goes, still laughing
      const crowd = P.crowd.slice(10, 18);
      const spots = [[-4.4, 11.5], [-2.2, 12.6], [0.6, 11.2], [2.4, 12.8], [-6.8, 13.2], [4.4, 11.8], [-0.8, 14.2], [6.4, 13.6]];
      mockers(t, crowd, spots, V(-8, 3.5, 4), 1);
      crowd.forEach((p, i) => { const w = (u * 2.2 + hash01(i, 77)) % 1; p.root.visible = w > 0.12 && w < 0.92; });
      fx.dust.group.visible = true; fx.dust.set(t, V(-8.2, 4.1, 4.2), S3.strikes, 1);
      shadowBox(V(0, 0, 4), 34);
      return setMood(mm, { focus: 30, focusRange: 15, dof: 0.3, tilt: 0.6 });
    },
  });
  S3.strikes = []; { const per = 0.3; for (let n = 0; n < 40; n++) { const s = S3.t0 + (n + 0.8) * per - ((S3.t0) % per); if (s > S3.t0 && s < S3.t1) S3.strikes.push(s); } }

  // ---- S4: wide, perfectly clear blue sky — not one cloud ----
  shot({
    id: 'S4', t0: cut('S4'), t1: cut('S5'), trans: { type: 'fade', dur: 0.5 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.9, pitch: 0.5, glow: 0, ramp: 0 });
      const u = lt / dur;
      camK(u, [[0, [52, 1.45, 14], [0, 8, -1], 34], [1, [52, 1.5, 14], [0, 14.5, -1], 36]]);
      const v = inFrame(7.5, -0.35);
      putAt(P.noah, v, Poses.lookUp(t, 11, 1), -1); P.noah.setProp('hammer'); noahSet(1);
      fx.birds.set(t, V(20, 0, 8), 18, 20);
      shadowBox(V(20, 0, 8), 40);
      return setMood('clear', { focus: 7.5, focusRange: 6, dof: 0.25, tilt: 0.2, tiltTop: 0.94, tiltBottom: 0.05 });
    },
  });

  // ---- S5: slow push-in on the giant ark towering over the town ----
  shot({
    id: 'S5', t0: cut('S5'), t1: cut('S6'), trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.93, pitch: 0.6, glow: 0, ramp: 0, scaffold: true, ladderOn: false });
      const u = lt / dur;
      camK(u, [[0, [-15.6, 1.65, 37.6], [-2, 7.6, 2], 30], [1, [-14.5, 1.7, 34.2], [-2, 7.9, 2], 27]], (x) => x);
      putAt(P.crowd[18], inFrame(5.2, -0.55), Poses.lookUp(t, 218, 0.7), 1);
      putAt(P.crowd[19], inFrame(5.8, 0.5), Poses.smirk(t, 219), -1);
      shadowBox(V(-10, 0, 25), 40);
      return setMood('build', { focus: 30, focusRange: 25, dof: 0.35, tilt: 0.45, tiltTop: 0.82 });
    },
  });

  // ---- S6: seen from everywhere — field, market, hilltop ----
  const s6b = word('S6', 'BOAT') + 0.15, s6c = word('S6', 'whole') - 0.15;
  shot({
    id: 'S6a', t0: cut('S6'), t1: s6b, trans: { type: 'fade', dur: 0.4 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.7, glow: 0, ramp: 0, scaffold: true, ladderOn: false });
      const u = lt / dur;
      camK(u, [[0, [47, 2.4, 41], [6, 5, 2], 30], [1, [45.5, 2.5, 39.5], [5, 5, 2], 29]]);
      const lookT = smooth(invLerp(0.15, 0.55, u));
      const pose = lookT < 0.5 ? Poses.paint(t, 41) : Poses.lookUp(t, 41, 0.25);
      P.farmer.setProp('staff');
      put(P.farmer, 40.5, 33.5, pose, -1);
      put(P.farmer2, 37.5, 31.4, Poses.idle(t, 42), -1);
      shadowBox(V(30, 0, 30), 40);
      return setMood('build', { focus: 9, focusRange: 5, dof: 0.55, tilt: 0.5 });
    },
  });
  shot({
    id: 'S6b', t0: s6b, t1: s6c, trans: { type: 'fade', dur: 0.3 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.7, glow: 0, ramp: 0, scaffold: true, ladderOn: false });
      const u = lt / dur;
      camK(u, [[0, [-22.2, 1.95, 38.8], [-6, 4.8, 8], 30], [1, [-21.5, 2.0, 37.8], [-6, 4.8, 8], 29]]);
      const target = V(0, 5, 0);
      const ppl = [P.crowd[2], P.crowd[3], P.crowd[5], P.crowd[6], P.crowd[20]];
      const spots = [[6.6, -0.62], [7.2, -0.12], [8.4, 0.4], [6.2, 0.7], [9.2, -0.4]];
      ppl.forEach((p, i) => { const f = i % 2 ? Poses.laughPoint : Poses.lookUp; putAt(p, inFrame(...spots[i]), f === Poses.lookUp ? f(t, p.seed, 0.5) : f(t, p.seed, 0.8)); faceTo(p, target); p.billboard(camera); });
      shadowBox(V(-18, 0, 30), 30);
      return setMood('build', { focus: 7.5, focusRange: 3, dof: 0.5, tilt: 0.45 });
    },
  });
  const S6c = shot({
    id: 'S6c', t0: s6c, t1: cut('S7'), trans: { type: 'fade', dur: 0.3 },
    pills: [{ text: 'THE BIGGEST SIGN ON EARTH', t0: s6c + 0.3, t1: cut('S7') + 0.1, x: 300, y: 690, anchor: null }],
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.7, glow: 0, ramp: 0, scaffold: true, ladderOn: false });
      const u = lt / dur;
      camK(u, [[0, [-82, 21, 108], [-14, 1, 4], 30], [1, [-80, 20.5, 104], [-13, 1.5, 4], 28.5]]);
      P.shepherd.setProp('staff');
      put(P.shepherd, -66.5, 87, Poses.idle(t, 43), 1);
      faceTo(P.shepherd, V(0, 0, 0)); P.shepherd.billboard(camera);
      S6c.pills[0].anchorScreen = toScreen(V(0, 6.5, 0));
      shadowBox(V(-50, 0, 60), 70);
      return setMood('build', { focus: 30, focusRange: 25, dof: 0.2, tilt: 0.55, tiltTop: 0.72 });
    },
  });

  // ---- S7: close-ups — nail, beam, pitch — each with a glint; then the door begins to glow ----
  const s7b = word('S7', 'every', 1) - 0.12, s7c = word('S7', 'every', 2) - 0.12, s7d = word('S7', 'was') - 0.15;
  const nailHits = [word('S7', 'nail') - 0.05, word('S7', 'nail') + 0.42];
  const S7a = shot({
    id: 'S7a', t0: cut('S7'), t1: s7b, trans: { type: 'fade', dur: 0.35 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.4, glow: 0, ramp: 0 });
      props.bench.visible = true;
      const B = props.bench.userData;
      let ang = 0.85;
      for (const h of nailHits) { const d = t - h; if (d > -0.3 && d < 0) ang = lerp(0.85, 0.0, easeOutQuad(1 + d / 0.3)); else if (d >= 0 && d < 0.25) ang = lerp(0.0, 0.85, smooth(d / 0.25)); }
      const sink = nailHits.filter((h) => t >= h).length;
      B.nail.position.y = B.nailY0 - sink * 0.07;
      B.hammer.position.y = B.nailY0 + 0.22 - sink * 0.07;
      B.hammer.rotation.z = -ang;
      const gp = B.nail.getWorldPosition(new THREE.Vector3());
      camK(lt / dur, [[0, [-9.25, 1.55, 9.35], [-10.0, 1.42, 6.5], 27], [1, [-9.35, 1.5, 8.95], [-10.0, 1.42, 6.5], 25]]);
      fx.glints[0].group.visible = true; fx.glints[0].set(t, nailHits[1] - 0.02, V(gp.x, gp.y + 0.03, gp.z + 0.05), 0.7);
      shadowBox(V(-10, 0, 6), 8);
      return setMood('golden', { focus: 2.95, focusRange: 0.6, dof: 1, tilt: 0.2, haze: 0.1, exposure: 1.3, lift: new THREE.Color(0.03, 0.02, 0.0) });
    },
  });
  shot({
    id: 'S7b', t0: s7b, t1: s7c, trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.4, glow: 0, ramp: 0 });
      const u = lt / dur;
      camK(u, [[0, [-1.5, 1.05, 16.6], [-2.2, 1.75, 9.6], 32], [1, [-1.6, 1.1, 15.9], [-2.2, 1.85, 9.6], 30]]);
      const k = smooth(invLerp(0.0, 0.75, u));
      putAt(P.shem, inFrame(6.4, -0.48), Poses.liftBeam(t, 13, k), 1); P.shem.setProp(null);
      putAt(P.japheth, inFrame(6.4, 0.48), Poses.liftBeam(t, 15, k), -1); P.japheth.setProp(null);
      const h1 = P.shem.armF.hand.getWorldPosition(new THREE.Vector3()), h2 = P.japheth.armF.hand.getWorldPosition(new THREE.Vector3());
      props.beam.visible = true; props.beam.position.copy(h1).add(h2).multiplyScalar(0.5); props.beam.position.y += 0.06;
      props.beam.position.addScaledVector(camera.position.clone().sub(props.beam.position).setY(0).normalize(), 0.12);
      props.beam.rotation.y = Math.atan2(-camRight().z, camRight().x);
      fx.glints[1].group.visible = true; fx.glints[1].set(t, word('S7', 'beam') - 0.05, props.beam.position.clone().add(camRight().multiplyScalar(0.75)).add(V(0, 0.1, 0)), 1.1);
      shadowBox(V(-2, 0, 10), 12);
      return setMood('golden', { focus: 6.5, focusRange: 1.5, dof: 0.9, tilt: 0.15 });
    },
  });
  shot({
    id: 'S7c', t0: s7c, t1: s7d, trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.95, pitch: 0.4, glow: 0, ramp: 0 });
      const u = lt / dur;
      camK(u, [[0, [7.0, 1.6, 14.0], [8.6, 1.15, 9.0], 30], [1, [7.25, 1.55, 13.3], [8.6, 1.15, 9.0], 28]]);
      props.trestle.visible = true;
      const TB = props.trestle.userData;
      const c = inFrame(4.3, 0.12);
      props.trestle.position.set(c.x - (TB.x0 + TB.len / 2), 0, c.z - TB.z);
      props.trestle.rotation.set(0, 0, 0);
      putAt(P.ham, inFrame(5.2, -0.42), Poses.paint(t, 14), 1); P.ham.setProp('brush');
      const tip = P.ham.prop.localToWorld(V(0, 0.33, 0));
      const sx0 = TB.x0 + props.trestle.position.x;
      TB.stripe.scale.x = clamp(((tip.x - sx0) / TB.len) * 0.5 + 0.5 * smooth(u), 0.04, 1);
      fx.glints[2].group.visible = true; fx.glints[2].set(t, word('S7', 'year') + 0.1, V(sx0 + TB.len * TB.stripe.scale.x, 1.13, c.z + 0.1), 1.0);
      shadowBox(c, 10);
      return setMood('golden', { focus: 4.4, focusRange: 1.2, dof: 0.9, tilt: 0.15 });
    },
  });
  shot({
    id: 'S7d', t0: s7d, t1: cut('S8'), trans: { type: 'fade', dur: 0.35 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      const u = lt / dur;
      const g = smooth(invLerp(0.15, 0.7, u));
      A.root.visible = true; A.set({ progress: 1, pitch: 0.8, door: 1, glow: g, ramp: 1 });
      camK(u, [[0, [11.5, 2.6, 15.5], [4.0, 2.9, 3.4], 30], [1, [10.2, 2.4, 13.2], [4.0, 2.9, 3.4], 27]]);
      fx.glints[3].group.visible = true; fx.glints[3].set(t, word('S7', 'INVITATION') + 0.05, A.doorPos.clone().add(V(0.6, 0.9, 0.5)), 2.0);
      shadowBox(V(4, 0, 6), 18);
      return setMood('build', 'golden', g, { focus: 13, focusRange: 5, dof: 0.5, tilt: 0.35 });
    },
  });

  // ---- S8: Scripture card over the ark at golden hour ----
  shot({
    id: 'S8', t0: cut('S8'), t1: cut('S9'), trans: { type: 'fade', dur: 0.5 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 0.97, pitch: 0.85, door: 1, glow: 0.55, ramp: 1, scaffold: true, ladderOn: false });
      const u = lt / dur;
      const a = lerp(0.5, 0.85, u);
      cam(V(Math.sin(a) * 40, 7.5, Math.cos(a) * 40 + 4), V(1, 2.6, 2), 31);
      put(P.noah, 6.5, 8.0, Poses.hold(t, 11), -1); P.noah.setProp(null); noahSet(1);
      put(P.wife, 7.6, 8.6, Poses.hold(t, 12), -1);
      put(P.shem, -6, 6.6, Poses.carryOverhead(t, 13, 1), 1); P.shem.setProp('plank');
      shadowBox(V(0, 0, 4), 32);
      return setMood('golden', { focus: 40, focusRange: 15, dof: 0.35, tilt: 0.55, exposure: 0.92 });
    },
  });

  // ---- S9: Noah preaching from a crate in the town square; people turn away ----
  const S9 = shot({
    id: 'S9', t0: cut('S9'), t1: cut('S10'), trans: { type: 'fade', dur: 0.45 },
    pills: [{ text: 'A PREACHER OF RIGHTEOUSNESS · 2 PETER 2:5', t0: word('S9', 'PREACHER') - 0.1, t1: cut('S10') + 0.1, x: 110, y: 640, anchor: null }],
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 0.85, glow: 0.2, ramp: 1 });
      const u = lt / dur;
      camK(u, [[0, [-12.3, 1.75, 20.6], [-17, 2.55, 26.6], 31], [1, [-12.9, 1.85, 21.5], [-17, 2.6, 26.6], 29]]);
      props.crate.visible = true; props.crate.position.set(-17, groundHeight(-17, 26.6) + 0.3, 26.6);
      put(P.noah, -17, 26.6, Poses.preach(t, 11, 1), -1, props.crate.position.y + 0.3); P.noah.setProp(null); noahSet(1);
      P.noah.blob.visible = false;
      const R = camRight();
      const go = [[P.crowd[0], 5.0, -0.55, -1], [P.crowd[4], 5.6, 0.5, 1], [P.crowd[7], 6.4, -0.85, -1], [P.crowd[8], 6.9, 0.85, 1]];
      go.forEach(([p, d, sx, dir], i) => {
        const w = smooth(invLerp(0.05 + i * 0.12, 0.65 + i * 0.08, u));
        const v = inFrame(d, sx).addScaledVector(R, dir * w * 1.6);
        const pose = w < 0.12 ? Poses.smirk(t, p.seed) : (i % 2 ? Poses.dismiss(t, p.seed) : Poses.walk(t, p.seed, 0.9));
        putAt(p, v, pose);
        if (w < 0.12) faceTo(p, P.noah.root.position); else p.setFacing(dir);
        p.billboard(camera);
      });
      putAt(P.crowd[9], inFrame(7.6, 0.35), Poses.laughCup(t, 209, 0.8)); faceTo(P.crowd[9], P.noah.root.position); P.crowd[9].billboard(camera);
      const hp = P.noah.head.getWorldPosition(new THREE.Vector3());
      S9.pills[0].anchorScreen = toScreen(hp.add(V(0, 0.36, 0)));
      shadowBox(V(-15, 0, 24), 14);
      return setMood('build', { focus: 7.2, focusRange: 2.5, dof: 0.6, tilt: 0.4 });
    },
  });

  // ---- S10: the animals come in pairs, calmly up the ramp; the crowd still laughs ----
  const pairPaths = ctx.pairPaths;
  shot({
    id: 'S10', t0: cut('S10'), t1: cut('S11'), trans: { type: 'fade', dur: 0.45 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door: 1, glow: 0.45, ramp: 1 });
      const u = lt / dur;
      camK(u, [[0, [28, 14.5, 36], [3.5, 0.6, 8.0], 33], [1, [25.5, 12.8, 33], [3.5, 0.9, 8.0], 31]]);
      ctx.placeAnimals(t - L.S10.start + 2.0);
      const crowd = P.crowd.slice(0, 7);
      const spots = [[24.0, -0.78, 0], [25.0, -0.66, 1], [23.2, -0.6, 2], [26.0, -0.84, 3], [24.4, -0.52, 4], [25.8, -0.72, 5], [23.4, -0.86, 6]];
      crowd.forEach((p, i) => {
        const [d, sx] = spots[i]; const f = mockPoses[i % mockPoses.length];
        putAt(p, inFrame(d, sx), f === Poses.laughPoint || f === Poses.laughCup ? f(t, p.seed, 1) : f(t, p.seed)); faceTo(p, A.rampBottom); p.billboard(camera);
      });
      put(P.noah, 6.0, 11.6, Poses.hold(t, 11), -1); P.noah.setProp(null); noahSet(1);
      put(P.wife, 6.9, 12.2, Poses.hold(t, 12), -1);
      shadowBox(V(4, 0, 12), 28);
      return setMood('build', 'golden', 0.25, { focus: 30, focusRange: 15, dof: 0.3, tilt: 0.55 });
    },
  });

  // ---- S11: glide to the ONE door — light pours onto the ramp ----
  const S11 = shot({
    id: 'S11', t0: cut('S11'), t1: cut('S12'), trans: { type: 'fade', dur: 0.5 },
    pills: [{ text: 'ONE DOOR · GENESIS 6:16', t0: word('S11', 'ONE') - 0.05, t1: cut('S12') + 0.1, x: 520, y: 640, anchor: null }],
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door: 1, glow: 1, ramp: 1 });
      const u = lt / dur;
      camK(u, [[0, [-6, 3.6, 19], [3.6, 2.9, 3.6], 30], [1, [-1.6, 2.6, 15.6], [3.9, 2.8, 3.6], 27]]);
      ctx.placeAnimals(t - L.S10.start + 2.0, true);
      S11.pills[0].anchorScreen = toScreen(A.doorPos.clone().add(V(0.4, 1.0, 0.3)));
      shadowBox(V(4, 0, 8), 18);
      return setMood('golden', { focus: 14, focusRange: 5, dof: 0.6, tilt: 0.4 });
    },
  });

  // ---- S12: people walk right past the glowing door ----
  shot({
    id: 'S12', t0: cut('S12'), t1: cut('S13'), trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door: 1, glow: 1, ramp: 1 });
      const u = lt / dur;
      camK(u, [[0, [-6.5, 1.25, 23.5], [4.2, 3.0, 4.5], 30], [1, [-6.0, 1.2, 22.5], [4.2, 3.0, 4.5], 29]]);
      const R = camRight();
      const walkers = [[P.crowd[11], 8.0, -3.2, 1, 1.25], [P.crowd[12], 9.0, 2.6, -1, 1.1], [P.crowd[13], 10.4, -4.6, 1, 1.0], [P.crowd[14], 7.2, 1.0, -1, 1.15], [P.crowd[15], 11.4, -2.2, 1, 1.0], [P.crowd[16], 12.2, 3.8, -1, 1.2]];
      walkers.forEach(([p, d, off0, dir, sp], i) => {
        const v = along2(d, off0 + dir * (lt + 0.3) * sp * 1.2);
        const pose = i === 1 ? Poses.dismiss(t, p.seed) : Poses.walk(t, p.seed, sp);
        if (i === 0 || i === 3) pose.headTilt = -0.14;
        putAt(p, v, pose, dir);
      });
      shadowBox(V(2, 0, 14), 14);
      return setMood('golden', 'build', 0.4, { focus: 9, focusRange: 3.5, dof: 0.45, tilt: 0.3 });
    },
  });

  // ---- S13: storm rolls in; the door slowly shuts from inside ----
  const shutT0 = word('S13', 'They') - 0.1, shutT1 = L.S13.end + 0.35;
  const S13 = shot({
    id: 'S13', t0: cut('S13'), t1: L.S13.end + 0.55, trans: { type: 'fade', dur: 0.4 },
    pills: [{ text: 'THE LORD SHUT HIM IN · GENESIS 7:16', t0: shutT0 + 0.4, t1: L.S13.end + 0.65, x: 140, y: 690, anchor: null }],
    apply(lt, dur, t) {
      reset(); plainOn(t);
      const u = lt / dur;
      const st = smooth(invLerp(0.0, 0.55, u));
      const door = 1 - smooth(invLerp(shutT0, shutT1, t));
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door, glow: 1, ramp: 1 });
      camK(u, [[0, [12.5, 1.1, 23.5], [3.2, 7.2, 1.0], 36], [1, [11.2, 1.1, 20.5], [3.6, 5.6, 2.0], 32]]);
      fx.clouds.forEach((c, i) => { c.visible = true; c.position.set(-70 + i * 18 + lt * 7 * (1 + (i % 3) * 0.3), 20 + (i % 3) * 5, -36 + (i % 4) * 12); c.material.opacity = 0.5 + 0.5 * st; c.material.transparent = true; });
      fx.rain.group.visible = true; fx.rain.set(t, camera.position.clone().add(V(-4, 0, -6)), smooth(invLerp(0.55, 1, u)) * 0.7, 30);
      ctx.U.uWind.value = 1 + 2 * st;
      S13.pills[0].anchorScreen = toScreen(A.doorPos.clone().add(V(0.0, 1.0, 0.3)));
      shadowBox(V(4, 0, 8), 20);
      return setMood('build', 'storm', st, { focus: 13, focusRange: 5, dof: 0.45, tilt: 0.3, rain: smooth(invLerp(0.6, 1, u)) * 0.6 });
    },
  });
  cue(shutT1 - 0.05, 'door_thud', 1);

  // ---- S14: the flood — ark floats in the storm; inside, safe in lamplight ----
  const s14b = L.S13.end + 0.55 + 1.05;
  const S14a = shot({
    id: 'S14a', t0: L.S13.end + 0.55, t1: s14b, trans: { type: 'dip', dur: 0.3, color: new THREE.Color(0.9, 0.92, 1.0) },
    apply(lt, dur, t) {
      reset(); W.sets.sea.visible = true; W.setSea(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door: 0, glow: 0.0, ramp: 0, scaffold: false, ladderOn: false });
      const h = W.waveAt(0, 0, t);
      A.root.position.set(0, h - 0.6, 0); A.root.rotation.set(0.05 * Math.sin(t * 1.1), 0.0, 0.04 * Math.sin(t * 0.8 + 1));
      const u = lt / dur;
      camK(u, [[0, [30, 6.0, 33], [-1, 5.2, 0], 32], [1, [28, 5.8, 31], [-1, 5.4, 0], 31]]);
      A.windowGlow(1);
      fx.rain.group.visible = true; fx.rain.set(t, camera.position.clone().add(V(-8, -4, -10)), 1, 36);
      fx.clouds.forEach((c, i) => { c.visible = true; c.position.set(-80 + i * 26 + lt * 6, 30 + (i % 3) * 5, -40 + (i % 4) * 16); c.material.opacity = 1; });
      const fl = Math.max(pulse(lt, 0.12, 0.3, 0.06), 0.6 * pulse(lt, 0.42, 0.52, 0.04));
      fx.bolt.visible = fl > 0.05; fx.bolt.position.set(-30, 52, -40); fx.bolt.material.opacity = fl;
      ctx.U.uWind.value = 3;
      shadowBox(V(0, 0, 0), 30);
      return setMood('storm', { focus: 45, dof: 0.2, tilt: 0.45, rain: 1, flash: fl * 0.5, exposure: 1.35, haze: 0.2, lift: new THREE.Color(0.02, 0.03, 0.05) });
    },
  });
  cue(S14a.t0 + 0.12, 'thunder', 1); cue(S13.t0 + 1.4, 'thunder', 0.35);
  shot({
    id: 'S14b', t0: s14b, t1: cut('S15') + 0.15, trans: { type: 'fade', dur: 0.4 },
    apply(lt, dur, t) {
      reset(); W.sets.inside.visible = true;
      const u = lt / dur;
      const ox = 600;
      cam(V(ox + 0.9 + u * 0.3, 2.9, 11.2 - u * 0.6), V(ox - 0.2, 1.3, -2.4), 34, 0.012 * Math.sin(t * 1.1));
      const fam = [[P.noah, 8.6, -0.36, Poses.hold, 1], [P.wife, 8.9, 0.18, Poses.hold, -1], [P.shem, 10.6, -0.92, Poses.idle, 1], [P.shemWife, 10.2, -0.52, Poses.sit, 1],
        [P.japheth, 10.8, 0.88, Poses.hold, -1], [P.japhethWife, 10.3, 0.5, Poses.sit, -1], [P.ham, 11.9, -0.1, Poses.idle, 1], [P.hamWife, 11.6, 0.36, Poses.sit, -1]];
      fam.forEach(([p, d, sx, f, fa]) => { p.setProp(null); putAt(p, inFrame(d, sx, 0.02), f(t, p.seed), fa); });
      noahSet(1);
      const spots = { sheep: [13.0, 0.95], lion: [13.4, -0.95], lioness: [14.2, -0.7], deer: [14.6, 0.72], camel: [15.4, -0.05] };
      let si = 0;
      W.insideAnimals.forEach((a) => {
        a.group.visible = true; a.update(t, 0);
        if (a.kind === 'dove') return;
        const sp = spots[a.kind] || [12.4 + si * 0.4, 1.2]; si++;
        const v = inFrame(sp[0] + (a.kind === 'sheep' ? (a.seed % 2) * 0.8 : 0), sp[1] + (a.kind === 'sheep' ? 0.12 * (a.seed % 3) : 0), 0);
        a.group.position.set(v.x - ox, 0, v.z);
      });
      W.lamp.rotation.z = 0.06 * Math.sin(t * 1.1); W.lampLight.intensity = 55 + 5 * Math.sin(t * 7.3);
      return setMood('lamp', { focus: 10, focusRange: 3, dof: 0.45, tilt: 0.2, rain: 0 });
    },
  });
  cue(s14b + 0.2, 'creak', 0.8);

  // ---- S15: golden light — match-cut ark door -> doorway on the hill near a cross ----
  const s15b = L.S15.start + 0.75;
  shot({
    id: 'S15a', t0: cut('S15') + 0.15, t1: s15b, trans: { type: 'fade', dur: 0.5 },
    apply(lt, dur, t) {
      reset(); plainOn(t);
      A.root.visible = true; A.set({ progress: 1, pitch: 1, door: 1, glow: 1.0, ramp: 1 });
      const u = lt / dur;
      const d = A.doorPos;
      camK(u, [[0, [d.x + 0.7, d.y + 0.2, d.z + 17], [d.x, d.y + 0.2, d.z], 26], [1, [d.x + 0.35, d.y + 0.15, d.z + 13.5], [d.x, d.y + 0.15, d.z], 26]]);
      return setMood('golden', { focus: 9, focusRange: 3, dof: 0.6, tilt: 0.3, exposure: 0.86 });
    },
  });
  shot({
    id: 'S15b', t0: s15b, t1: cut('S16'), trans: { type: 'dip', dur: 0.36, color: new THREE.Color(1.0, 0.92, 0.72) },
    apply(lt, dur, t) {
      reset(); W.sets.hill.visible = true;
      const D = W.hillDoor; D.set(1);
      const base = V(3000, 0, 0); const dc = D.group.position.clone().add(base).add(V(0, 1.5, 0));
      const u = lt / dur;
      camK(u, [[0, [dc.x + 0.35, dc.y + 0.1, dc.z + 9.0], [dc.x, dc.y + 0.1, dc.z], 26], [0.55, [dc.x + 6, dc.y + 2.2, dc.z + 17], [dc.x + 1.8, dc.y + 1.6, dc.z], 30], [1, [dc.x + 8, dc.y + 3.0, dc.z + 21], [dc.x + 2.0, dc.y + 2.0, dc.z], 31]]);
      fx.pillar.group.visible = true; fx.pillar.group.position.set(dc.x, dc.y - 1.5, dc.z); fx.pillar.set(t, smooth(invLerp(0.0, 0.7, u)));
      shadowBox(dc, 25);
      return setMood('pillar', { focus: 15, focusRange: 8, dof: 0.35, tilt: 0.45, exposure: 0.92, haze: 0.16 });
    },
  });
  cue(s15b, 'shimmer', 1);

  // ---- S16: Scripture card — John 10:9 — over the glowing doorway ----
  shot({
    id: 'S16', t0: cut('S16'), t1: cut('S17'), trans: { type: 'cut' },
    apply(lt, dur, t) {
      reset(); W.sets.hill.visible = true;
      const D = W.hillDoor; D.set(1 + 0.1 * Math.sin(t * 2));
      const dc = D.group.position.clone().add(V(3000, 1.5, 0));
      const u = lt / dur;
      const a = lerp(0.42, 0.62, u);
      cam(V(dc.x + Math.sin(a) * 23, dc.y + 3.4, dc.z + Math.cos(a) * 23), V(dc.x + 2.0, dc.y + 1.6, dc.z - 1), 31);
      fx.pillar.group.visible = true; fx.pillar.group.position.set(dc.x, dc.y - 1.5, dc.z); fx.pillar.set(t, 1);
      shadowBox(dc, 25);
      return setMood('pillar', { focus: 23, focusRange: 8, dof: 0.35, tilt: 0.45, exposure: 0.86, haze: 0.16 });
    },
  });

  // ---- S17: city at dusk — the same glowing door; one young woman stops and steps in ----
  const stopT = word('S17', 'door') - 0.6, lookT = word('S17', 'still'), stepT = word('S17', 'OPEN') - 0.1, inT = L.S17.end + 0.2;
  const S17 = shot({
    id: 'S17', t0: cut('S17'), t1: cut('S18'), trans: { type: 'dip', dur: 0.4, color: new THREE.Color(1.0, 0.88, 0.66) },
    apply(lt, dur, t) {
      reset(); W.sets.city.visible = true;
      const D = W.cityDoor; const glowK = 1 + 0.5 * smooth(invLerp(stepT, inT, t)) * (1 - smooth(invLerp(inT, inT + 0.6, t)));
      D.set(glowK);
      const ox = -3000; const dc = D.group.position.clone().add(V(ox, 1.5, 0));
      const u = lt / dur;
      camK(u, [[0, [dc.x + 10.5, 3.1, dc.z + 17.5], [dc.x - 1.2, 2.2, dc.z + 0.6], 32], [1, [dc.x + 8.2, 2.7, dc.z + 13.6], [dc.x - 0.9, 2.0, dc.z + 0.6], 29.5]]);
      W.cars.forEach((c, i) => { const dir = i % 2 ? 1 : -1; c.position.x = (i % 2 ? 1 : -1) * (16 + i * 9) + dir * t * 0.0; c.position.z = 1.6; c.rotation.y = i % 2 ? 0 : Math.PI; });
      // commuters, eyes on phones, walk past (camera-relative lanes)
      const lanes = [[0, -6.5, 0.7, 1, 0.95], [1, 3.5, 0.9, -1, 0.9], [2, -10.5, 0.5, 1, 1.0], [3, 8.0, 1.0, -1, 0.85], [4, -2.0, 3.9, -1, 0.9], [5, 1.2, 4.6, 1, 1.0], [6, -14, 4.2, 1, 0.85], [7, 12.5, 3.4, -1, 0.9]];
      lanes.forEach(([i, x0, dz, dir, sp]) => {
        const p = P.commuters[i]; const v = V(dc.x + x0 + dir * (lt + 0.2) * sp * 1.3, 0.18, dc.z + dz);
        const pose = p.o.prop === 'phone' ? Poses.phoneWalk(t, p.seed, sp) : Poses.walk(t, p.seed, sp);
        putAt(p, v, pose, dir);
      });
      // the seeker
      const s = P.seeker; const stopX = dc.x - 0.9, inX = dc.x - 0.05; const sx0 = stopX - 5.0;
      let x, pose;
      if (t < stopT) { x = lerp(sx0, stopX, clamp((t - S17.t0) / (stopT - S17.t0))); pose = Poses.phoneWalk(t, 31, 0.85); }
      else if (t < stepT) { x = stopX; const k = smooth(invLerp(stopT, lookT, t)); pose = Poses.wonder(t, 31, k); }
      else { const k = smooth(invLerp(stepT, inT, t)); x = lerp(stopX, inX, k); pose = Poses.walk(t, 31, 0.6, 0.8); pose.headTilt = 0.05; pose.aF = [0.3, 0.6]; }
      const sz = t < stepT ? dc.z + 2.2 : lerp(dc.z + 2.2, dc.z + 0.25, smooth(invLerp(stepT, inT, t)));
      put(s, x, sz, pose, 1, 0.18);
      s.root.visible = t < inT + 0.12;
      const enter = smooth(invLerp(inT - 0.5, inT + 0.2, t));
      fx.glints[4].group.visible = true; fx.glints[4].set(t, inT - 0.55, V(dc.x - 0.1, dc.y + 0.2, dc.z + 0.6), 5.0);
      shadowBox(dc, 16);
      return setMood('dusk', { focus: 19, focusRange: 6, dof: 0.35, tilt: 0.45, bloom: 0.5 + 0.4 * enter });
    },
  });
  cue(stepT + 0.2, 'shimmer', 0.8);

  // ---- S18–S20: ending (overlay), outro, loop echo ----
  const endT0 = cut('S18');
  const outroT0 = L.S19.end + 0.55;
  const echoT0 = END - 0.5;
  shot({
    id: 'END', t0: endT0, t1: echoT0, trans: { type: 'fade', dur: 0.6 }, overlayOnly: true,
    apply(lt, dur, t) { reset(); cam(V(0, 5, 30), V(0, 3, 0), 32); return setMood('build', { fade: 1, fadeColor: new THREE.Color('#1c130d') }); },
  });
  shot({
    id: 'ECHO', t0: echoT0, t1: END + 1, trans: { type: 'cut' },
    apply(lt, dur, t) { return S1.apply(0, S1.t1 - S1.t0, 0); },
  });

  // ---------- cues ----------
  S1.strikes.forEach((s) => cue(s, 'hammer', 0.85));
  S3.strikes.forEach((s, i) => cue(s, 'hammer', 0.38 + 0.12 * hash01(i, 5), { short: true }));
  nailHits.forEach((s) => cue(s, 'hammer', 1.0, { nail: true }));
  for (let i = 1; i < S.length; i++) { const tr = S[i].trans; if (tr.type !== 'cut' || i === 1) cue(S[i].t0 - 0.15, 'whoosh', tr.type === 'dip' ? 0.8 : 0.5); }
  for (const ln of T.lines) if (!ln.card) for (const tk of ln.tokens) if (tk.hl) cue(Math.max(0, tk.start - 0.07), 'pop', 0.55);
  cue(cut('S8') + 0.15, 'paper', 1); cue(cut('S16') + 0.1, 'paper', 1);
  cue(word('S7', 'INVITATION') - 0.1, 'shimmer', 0.7); cue(word('S11', 'ONE') - 0.2, 'shimmer', 0.5);
  cue(S3.t0 + 0.3, 'creak', 0.5); cue(S14a.t0 + 0.4, 'creak', 0.5);
  cue(word('S18', 'MERCY') - 0.05, 'shimmer', 0.6);
  cue(outroT0 + 0.3, 'chime', 1);
  // typing clicks + hearts
  const typeT0 = L.S19.start + 0.15, typeDur = 1.25, msg = 'Mercy, because…';
  for (let i = 0; i < msg.length; i++) cue(typeT0 + typeDur * (i + 1) / msg.length - 0.02, 'tick', 0.55);
  const heartsT0 = typeT0 + typeDur + 0.1;
  for (let i = 0; i < 6; i++) cue(heartsT0 + i * 0.32, 'heart', 0.45);
  // beds (start, end, gain)
  const beds = [
    { type: 'birds', t0: 0, t1: cut('S8'), gain: 0.5 }, { type: 'laugh', t0: 0, t1: cut('S2') + 0.3, gain: 0.85 },
    { type: 'laugh', t0: cut('S3'), t1: cut('S4'), gain: 0.55 }, { type: 'laugh', t0: cut('S10'), t1: cut('S11') + 0.2, gain: 0.7 },
    { type: 'laugh', t0: cut('S6') + 1.6, t1: s6c, gain: 0.3 }, { type: 'murmur', t0: cut('S9'), t1: cut('S10'), gain: 0.4 },
    { type: 'footsteps', t0: cut('S10'), t1: cut('S12'), gain: 0.6 }, { type: 'wind', t0: cut('S4'), t1: cut('S7'), gain: 0.45 },
    { type: 'wind', t0: cut('S13'), t1: S14a.t1, gain: 0.8 }, { type: 'rain', t0: cut('S13') + 1.5, t1: cut('S15') + 0.4, gain: 1 },
    { type: 'sea', t0: S14a.t0, t1: s14b + 0.2, gain: 0.8 }, { type: 'city', t0: cut('S17'), t1: cut('S18') + 0.3, gain: 0.55 },
    { type: 'lamp', t0: s14b, t1: cut('S15') + 0.3, gain: 0.4 },
  ];
  const music = [{ t: 0, section: 'hope' }, { t: cut('S12'), section: 'tense' }, { t: cut('S15') + 0.2, section: 'resolve' }, { t: endT0, section: 'end' }, { t: outroT0, section: 'outro' }];
  const animalCalls = [{ t: L.S10.start + 0.4, type: 'trumpet', gain: 0.35 }, { t: L.S10.start + 1.6, type: 'coo', gain: 0.5 }, { t: L.S10.start + 2.3, type: 'baa', gain: 0.35 }, { t: L.S11.start + 0.6, type: 'coo', gain: 0.35 }];
  animalCalls.forEach((c) => cue(c.t, c.type, c.gain));

  // ---------- overlay state ----------
  function overlayState(t, curShot) {
    const st = { topbar: 1, pills: [] };
    // pills from the shots active now
    for (const sh of S) if (sh.pills) for (const p of sh.pills) {
      if (t < p.t0 - 0.05 || t > p.t1 + 0.3) continue;
      const a = smooth(invLerp(p.t0, p.t0 + 0.3, t)) * (1 - smooth(invLerp(p.t1 - 0.05, p.t1 + 0.25, t)));
      let anchor = null;
      if (p.anchor && sh === curShot) { anchor = toScreen(p.anchor); }
      else if (p.anchorScreen) anchor = p.anchorScreen;
      st.pills.push({ text: p.text, x: p.x, y: p.y, a, anchor });
    }
    // cards
    for (const id of ['S8', 'S16']) {
      const ln = L[id]; const t0 = cut(id) + 0.1, t1 = ln.end + 0.45;
      if (t > t0 - 0.1 && t < t1 + 0.4) st.card = { id, a: smooth(invLerp(t0, t0 + 0.45, t)) * (1 - smooth(invLerp(t1, t1 + 0.35, t))), y: id === 'S8' ? 560 : 540 };
    }
    // ending
    if (t >= endT0 - 0.1 && t < echoT0 + 0.5) {
      const a = smooth(invLerp(endT0 - 0.05, endT0 + 0.5, t)) * (1 - smooth(invLerp(outroT0 - 0.1, outroT0 + 0.35, t)));
      st.ending = {
        a, j: smooth(invLerp(word('S18', 'JUDGMENT') - 0.1, word('S18', 'JUDGMENT') + 0.35, t)), m: smooth(invLerp(word('S18', 'MERCY') - 0.1, word('S18', 'MERCY') + 0.35, t)),
        pick: smooth(invLerp(word('S18', 'MERCY') + 0.2, word('S18', 'MERCY') + 1.0, t)),
        bubble: smooth(invLerp(L.S19.start - 0.1, L.S19.start + 0.3, t)), typed: clamp((t - typeT0) / typeDur), heartsT0,
      };
    }
    if (t >= outroT0 - 0.2) {
      st.outro = { a: smooth(invLerp(outroT0, outroT0 + 0.4, t)) * (1 - smooth(invLerp(END - 0.5, END - 0.05, t))), u: (t - outroT0) / (END - 0.5 - outroT0) };
      st.topbar = 1 - smooth(invLerp(outroT0, outroT0 + 0.3, t)) + smooth(invLerp(END - 0.45, END - 0.05, t));
    }
    // no captions on Scripture cards, during the storm beat and the outro
    st.noCaption = !!(st.card && st.card.a > 0.02) || t > outroT0;
    return st;
  }

  // active shots at time t: [{shot, lt, dur, w}] (w = weight of this shot in a cross-fade)
  function activeAt(t) {
    let i = S.findIndex((s) => t >= s.t0 && t < s.t1);
    if (i < 0) i = t < 0 ? 0 : S.length - 1;
    const cur = S[i], nxt = S[i + 1], prv = S[i - 1];
    const mk = (s) => ({ shot: s, lt: t - s.t0, dur: s.t1 - s.t0 });
    if (nxt && nxt.trans.type !== 'cut') { const d = nxt.trans.dur; if (t > nxt.t0 - d / 2) { const k = smooth((t - (nxt.t0 - d / 2)) / d); return { list: [mk(cur), mk(nxt)], k, trans: nxt.trans }; } }
    if (prv && cur.trans.type !== 'cut') { const d = cur.trans.dur; if (t < cur.t0 + d / 2) { const k = smooth((t - (cur.t0 - d / 2)) / d); return { list: [mk(prv), mk(cur)], k, trans: cur.trans }; } }
    return { list: [mk(cur)], k: 0, trans: null };
  }

  cues.sort((a, b) => a.t - b.t);
  return { shots: S, activeAt, overlayState, cues, beds, music, duration: END, outroT0, endT0, echoT0 };
}
function easeOutQuad(x) { x = clamp(x); return 1 - (1 - x) * (1 - x); }
