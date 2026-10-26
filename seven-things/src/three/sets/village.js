// S9 / S10 / S14b — the village at night. Friends sit round a fire, joined by thin glowing gold
// threads. A man walks behind the circle whispering ear to ear; each whisper snaps a thread, the
// listener turns their back, and the circle splits in two. After the good news the threads regrow,
// everyone turns back to the fire and the two groups come together as the dawn warms the sky.
import * as THREE from 'three';
import { makeTerrain, makeHouse, makePalm, makeOlive, makeWall, makeLog, makeJar, makeMountains, srgb, mixc } from '../kit.js';
import { makeFire, makeThreads, makeMotes } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, place, finish, kin } from '../cast.js';
import { SETS, cameraShot } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, fbm, hash01, noise2, easeInOut } from '../../lib/util.js';

const LOOKS = [
  { cloth: CLOTH.rust, hair: 'curly', beard: 'short', skin: SKIN[3] }, { cloth: CLOTH.sky, hair: 'veil', wrap: '#d9c7a4', skin: SKIN[5] },
  { cloth: CLOTH.olive, hair: 'wrap', wrap: '#c9b48a', beard: 'long', skin: SKIN[2] }, { cloth: CLOTH.wine, hair: 'long', hairColor: HAIR.black, skin: SKIN[4] },
  { cloth: CLOTH.indigo, hair: 'short', beard: 'short', skin: SKIN[1] }, { cloth: CLOTH.ochre, hair: 'veil', wrap: '#8a5a6a', skin: SKIN[3] },
  { cloth: CLOTH.teal, hair: 'turban', wrap: '#e8dcc0', beard: 'short', skin: SKIN[5] }, { cloth: CLOTH.cream, hair: 'curly', hairColor: HAIR.brown, skin: SKIN[4], kid: true },
];

export function buildVillage(ctx) {
  const { plan, B } = ctx; const O = SETS.village; const E = plan.ev;
  const g = new THREE.Group();
  const height = (x, z) => { const r = Math.hypot(x, z); return smooth(invLerp(6, 26, r)) * (0.8 * fbm(x * 0.04, z * 0.04, 3, 3) + 0.4) + smooth(invLerp(60, 140, r)) * 9; };
  const dA = srgb('#8a7458'), dB = srgb('#6a5a44'), gA = srgb('#5a6a3a');
  g.add(makeTerrain({ size: 420, seg: 150, height, color: (x, z, y) => { const n = fbm(x * 0.12, z * 0.12, 3, 5); return mixc(mixc(dB, dA, smooth(0.5 + n)), gA, smooth(invLerp(0.1, 0.5, n)) * smooth(invLerp(3.5, 7, Math.hypot(x, z)))); } }));
  g.add(makeMountains({ seed: 5, n: 18, r0: 160, r1: 260, h0: 12, h1: 34, color: '#3a3a4a' }));
  // houses around the square with warm windows
  const ring = [[-9, -8, 5, 3.6, 0.6], [-2, -12, 6, 4.4, 0.1], [6.5, -10, 5, 3.4, -0.5], [12, -3, 4.5, 3.2, -1.2], [-13, -1, 4.5, 3.0, 1.3], [-11, 8, 5, 3.4, 2.2], [11, 7, 5, 3.6, -2.2], [1, -19, 6, 5.0, 0], [-6, -17, 4, 3.0, 0.3]];
  ring.forEach(([x, z, w, h, ry], i) => { const hs = makeHouse({ w, d: 4.5, h, wall: ['#b8a284', '#c4ad8c', '#ad977a'][i % 3], roofCol: '#7a6a54', windows: 2, glow: 0.9 + 0.3 * hash01(i, 2), seed: 100 + i }); hs.position.set(x, height(x, z), z); hs.rotation.y = ry; g.add(hs); });
  for (const [x, z, s, seed] of [[-6.5, -4.5, 1.5, 1], [7.5, -5.5, 1.7, 2], [-15, -9, 1.6, 3], [15, -11, 1.8, 4]]) { const p = makePalm(s, seed); p.position.set(x, height(x, z), z); g.add(p); }
  const ol = makeOlive(1.4, 3); ol.position.set(-8.5, height(-8.5, -12), -12); g.add(ol);
  const well = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.8, 12, 1, true), matte('#8a8070', { params: { side: THREE.DoubleSide } })); well.position.set(-4.5, 0.4, -6); well.castShadow = true; g.add(well);
  const wall = makeWall({ len: 7, h: 0.8, t: 0.4, color: '#8a7e6a', seed: 31 }); wall.position.set(3, 0, -6.5); wall.rotation.y = -0.2; g.add(wall);
  for (const [x, z] of [[-3.6, -5.6], [3.9, -7.4]]) { const j = makeJar(0.9, '#7a5a42'); j.position.set(x, 0, z); g.add(j); }
  // logs to sit on, one per seat (tangent to the circle)
  const logs = Array.from({ length: 8 }, (_, i) => { const l = makeLog(0.95, 0.15); g.add(l); return l; });
  const fire = makeFire(7); g.add(fire.group);

  const friends = LOOKS.map((L, i) => person(g, { seed: 110 + i, height: L.kid ? 1.25 : 1.68 + 0.12 * hash01(i, 4), outfit: i % 2 ? 'robe' : 'tunic', legs: L.skin, beardColor: HAIR.black, belt: '#b89a6a', ...L }));
  const whisperer = person(g, { seed: 120, height: 1.78, skin: SKIN[4], hair: 'wrap', wrap: '#3a3440', wrapTail: true, beard: 'short', outfit: 'robe', cloth: '#2f3346', trim: '#6a5a7a', belt: '#5a4a5a' });
  const persons = [...friends, whisperer];
  const threads = makeThreads(B.threads.length, 26); g.add(threads.group);
  const motes = makeMotes(90, 41); g.add(motes.group);

  // facing toward the fire, decided once per shot from the camera at mid-shot (no flip-flopping)
  const faceCache = new Map();
  const facings = (shot) => {
    if (faceCache.has(shot.id)) return faceCache.get(shot.id);
    const tm = (shot.t0 + shot.t1) / 2, c = cameraShot(plan, shot, tm);
    const cam = new THREE.PerspectiveCamera(c.fov, 1080 / 1920, 0.1, 1000); cam.position.set(...c.pos); cam.lookAt(...c.look); cam.updateMatrixWorld();
    const fx = new THREE.Vector3(...O).project(cam).x;
    const f = friends.map((_, i) => { const p = B.seat(i, tm); const x = new THREE.Vector3(...p).project(cam).x; return Math.abs(x - fx) < 0.02 ? (i < 4 ? -1 : 1) : Math.sign(fx - x); });
    faceCache.set(shot.id, f); return f;
  };
  const turnedAt = (i) => { const k = B.whisperTargets.indexOf(i); return k < 0 ? null : E.snaps[k] + 0.12; };
  const backAt = (i) => E.reunite + 0.3 + 0.12 * i;

  return {
    group: g, persons, fire,
    update(t, cam, shot) {
      const F = facings(shot);
      const after = shot.id === 'S14b';
      // seats + logs follow the split / reunion
      friends.forEach((p, i) => {
        const w = B.seat(i, t); const a = B.seatAngle(i);
        place(p, O, w);
        const lg = logs[i]; lg.position.set(w[0] - O[0] - Math.cos(a) * 0.08, 0, w[2] - O[2] - Math.sin(a) * 0.08); lg.rotation.y = -a + Math.PI / 2;
        const P = Poses.sit(t, 110 + i, 0.32);
        // talk + laugh before the reveal; turned away and hurt after their whisper; joy at the reunion
        const ta = turnedAt(i); const turned = ta !== null && t > ta && t < backAt(i);
        if (!after && t < E.reveal + 0.6) { if ((i + Math.floor(t * 0.5)) % 3 === 0) Object.assign(P, Poses.talk(t, 110 + i, 0.6), { lF: P.lF, lB: P.lB, bob: P.bob }); expr(P, 'happy', 1); }
        else if (turned) { expr(P, 'hurt', 1); P.headTilt = -0.14; P.aF = [0.9, 1.6]; }
        else if (after) { expr(P, 'happy', smooth(invLerp(backAt(i), backAt(i) + 0.5, t))); }
        else { expr(P, 'neutral', 1); P.look = 0.3; }
        const wk = B.whisperTargets.indexOf(i);
        if (wk >= 0 && !after) { // listening: head tips toward the whisper, mouth opens
          const near = smooth(invLerp(E.whisperTo[wk] - 0.1, E.whisperTo[wk] + 0.2, t)) * (1 - smooth(invLerp(E.snaps[wk] - 0.05, E.snaps[wk] + 0.15, t)));
          if (near > 0) { P.headTilt = lerp(P.headTilt, -0.18, near); P.look = lerp(P.look || 0, -0.8, near); if (near > 0.5) P.mouth = 'o'; }
        }
        // paper turn: 0 = facing the fire, 1 = back turned (after their whisper, until the reunion)
        const sTurn = ta === null ? 0 : smooth(invLerp(ta, ta + 0.3, t)) - smooth(invLerp(backAt(i), backAt(i) + 0.3, t));
        p.setFacing(-F[i], clamp(sTurn));
        p.pose(P);
      });
      // the whisperer: walks behind the circle, leans into each ear
      const wp = B.whisperer(t);
      const active = !after && t > E.reveal - 0.2;
      whisperer.root.visible = active || after;
      if (whisperer.root.visible) {
        const k = B.whisperK(t);
        const { v } = kin((tt) => B.whisperer(tt)[0], t);
        const { v: vz } = kin((tt) => B.whisperer(tt)[2], t);
        const sp = Math.hypot(v, vz);
        let P = sp > 0.3 && k < 0.2 ? Poses.walk(t, 120, 0.9, 0.7) : Poses.whisper(t, 120, k);
        if (after) { P = Poses.idle(t, 120); expr(P, 'sad', 1 - smooth(invLerp(E.reunite + 1.2, E.reunite + 2.2, t))); if (t > E.reunite + 2.2) expr(P, 'happy', 1); P.headTilt = -0.1; }
        whisperer.secondary(P, { vx: sp, t });
        place(whisperer, O, after ? [O[0] + 0.2, 0, O[2] - 3.2] : wp);
        // face the person he is whispering to (screen space)
        const tgt = B.whisperTargets.find((_, kk) => t < E.snaps[kk] + 0.3) ?? B.whisperTargets[B.whisperTargets.length - 1];
        const tp = B.seat(tgt, t); const v1 = new THREE.Vector3(...tp).project(cam).x, v0 = new THREE.Vector3(...(after ? [O[0] + 0.2, 0, O[2] - 3.2] : wp)).project(cam).x;
        whisperer.setFacing(after ? 1 : (v1 > v0 ? 1 : -1));
        whisperer.pose(P);
      }
      // gold threads chest to chest
      const chest = (i) => { const w = B.seat(i, t); return [w[0] - O[0], 0.98, w[2] - O[2]]; };
      const on = smooth(invLerp(E.reveal - 0.05, E.reveal + 0.5, t));
      threads.set(t, cam, B.threads.map(([a, b], j) => {
        const k = B.snapOrder.indexOf(j);
        return { a: chest(a), b: chest(b), snap: k >= 0 ? E.snaps[k] : null, regrow: k >= 0 ? E.regrow[k] : null, alpha: after ? 1 : on * (shot.id === 'S9' ? 0 : 1) };
      }), 0.026);
      fire.set(t, cam, 1);
      motes.set(t, [0, 0.4, 0], [5, 3, 5], 0.5, [1.0, 0.6, 0.3], 0.03);
      finish(persons, cam);
    },
    mood(t, shot) {
      const fl = fire.flicker(t);
      const night = {
        sky: { top: '#060a18', horizon: '#1a2238', bottom: '#0a0c14', stars: 1.0, moon: 1, moonDir: [0.45, 0.32, -1] },
        sunDir: [0.45, 0.55, -0.7], sun: { color: '#9fb4e8', intensity: 0.75 },
        hemi: { sky: '#3a4a78', ground: '#1a1410', intensity: 0.5 },
        fog: { color: '#0e1424', near: 30, far: 150 }, char: '#8a96c0', ao: 0.1,
        point: { pos: [0, 0.9, 0], color: '#ff9a4a', intensity: 22 * fl, distance: 16, charColor: '#ffb070', charK: 0.95 * fl, charRange: 4.6 },
        shadow: { size: 12 },
        post: { exposure: 1.05, bloom: 0.8, bloomThreshold: 0.72, haze: 0, tint: '#eef0ff', lift: '#03040a', sat: 1.0, contrast: 1.08, vignette: 0.65, dof: 0.35, focusRange: 3.5, tilt: 0.25, grain: 0.038 },
      };
      if (shot.id === 'S9') { night.post.sat = 0.85; night.char = '#7a88b4'; night.point.intensity *= 0.8; }
      if (shot.id === 'S14b') { // dawn warms the sky as they come together
        const k = smooth(invLerp(E.reunite, E.cta, t));
        night.sky.horizon = '#' + new THREE.Color('#2a2c44').lerp(new THREE.Color('#e8a070'), k).getHexString();
        night.sky.top = '#' + new THREE.Color('#0a1022').lerp(new THREE.Color('#4a5a8a'), k).getHexString();
        night.sky.band = '#' + new THREE.Color('#000000').lerp(new THREE.Color('#ffb070'), k * 0.6).getHexString();
        night.sky.stars = 1 - k; night.sky.moon = 1 - k;
        night.hemi = { sky: '#' + new THREE.Color('#3a4a78').lerp(new THREE.Color('#c8a8a0'), k).getHexString(), ground: '#3a2a20', intensity: lerp(0.5, 1.0, k) };
        night.char = '#' + new THREE.Color('#8a96c0').lerp(new THREE.Color('#f4dcc8'), k).getHexString();
        night.fog.color = '#' + new THREE.Color('#0e1424').lerp(new THREE.Color('#8a6a6a'), k).getHexString();
        night.post.tint = '#fff4e8'; night.post.sat = 1.05;
      }
      return night;
    },
  };
}
