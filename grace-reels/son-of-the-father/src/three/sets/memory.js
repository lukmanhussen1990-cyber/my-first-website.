// 'memory' set (S5a-S5c): three short glowing memories of who Jesus is, in soft warm light (the overlay adds a
// cream memory glow at the edges). A: a lane wall; the blind man's eyes open as Jesus' hand comes to them (Matthew
// 9:29). B: a sunny yard; Jesus lifts a child high, well again, the mother laughing. C: a rock tomb; Lazarus walks
// out into the light in white grave cloth, Jesus seen from behind, one hand raised. Layout in src/cams/memory.js.
import * as THREE from 'three';
import { makeMudHouse, makeStone, makeBush, makeBevelBox, scatterGrass, scatterPebbles, makeRug, scatterPots } from '../kit.js';
import { makePalms, makeRocks } from '../jerusalem.js';
import { makeMotes } from '../fx.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, expr } from '../rig.js';
import '../poses3.js';
import { JESUS, BLIND_MAN, CHILD, LAZARUS, JERUSALEM_CROWD } from '../characters/cast.js';
import { clamp, smooth, invLerp, lerp, hash01, fbm } from '../../lib/util.js';
import { MEM } from '../../cams/memory.js';

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const Bk = ctx.B.memory;
  const g = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 120, 40, 20).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#cbb48c', flatShading: true }));
  ground.position.x = 40; ground.receiveShadow = true; g.add(ground);
  // A: a lane: two mud houses behind the man, a doorway, pots
  for (const [x, z, s] of [[-2.2, -3.4, 11], [2.6, -3.6, 12], [-6.5, -2.4, 13]]) { const h = makeMudHouse({ w: 4.2, d: 3.2, h: 3.0, seed: s, color: '#c9a77a', ladder: false, awning: s === 12 ? ['#a8452c', '#e8d6b0'] : null }); h.position.set(x, 0, z); g.add(h); }
  g.add(scatterPots(5, { points: [[1.2, -1.6], [1.55, -1.75], [-1.9, -1.5], [3.4, -1.4], [-0.6, -1.9]] }));
  g.add(scatterPebbles(90, { area: [-4, -2, 4, 3], seed: 3 }));
  // B: a sunny yard with a palm and a low wall
  const wall = makeBevelBox(10, 1.2, 0.6, '#d4bf98', { bevel: 0.06, seed: 21 }); wall.position.set(40, 0.6, -3.2); g.add(wall);
  g.add(makePalms([[37.5, -4.5], [43.6, -5.2]], { seed: 22 }));
  const rug = makeRug(1.8, 1.1, { colors: ['#7a2e3a', '#d9b46a', '#2f4a6a'], seed: 23 }); rug.position.set(39.2, 0.01, -1.4); g.add(rug);
  g.add(scatterGrass(120, { area: [34, -4, 46, 4], seed: 24, clump: 4, spread: 0.3, scale: [0.4, 0.8] }));
  // C: the rock face with the tomb opening (dark), the round stone rolled aside, bushes
  const T = MEM.C.tomb;
  const rock = makeStone(5.2, { seed: 31, color: '#bba98a', sink: 0.35, squash: 0.9 }); rock.position.set(T[0], 0, T[1] + T[2] - 2.6); rock.scale.set(1.5, 1.0, 0.7); g.add(rock);
  const rock2 = makeStone(3.4, { seed: 32, color: '#b09f80', sink: 0.3, squash: 0.85 }); rock2.position.set(T[0] - 5.2, 0, T[2] - 1.0); g.add(rock2);
  const rock3 = makeStone(3.0, { seed: 33, color: '#b7a586', sink: 0.3, squash: 0.85 }); rock3.position.set(T[0] + 5.0, 0, T[2] - 1.2); g.add(rock3);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(1.05, 20, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#0e0906' }));
  hole.position.set(T[0], 1.05, T[2] + 1.42); g.add(hole);
  const holeLow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.05), new THREE.MeshBasicMaterial({ color: '#0e0906' })); holeLow.position.set(T[0], 0.53, T[2] + 1.42); g.add(holeLow);
  const lintel = makeBevelBox(2.6, 0.3, 0.5, '#cbb898', { bevel: 0.05, seed: 34 }); lintel.position.set(T[0], 2.2, T[2] + 1.5); g.add(lintel);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.42, 22).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#b3a284', flatShading: true }));
  disc.position.set(T[0] + 2.1, 1.25, T[2] + 1.8); disc.rotation.z = 0.4; disc.castShadow = true; g.add(disc);
  g.add(makeRocks([[T[0] - 2.8, T[2] + 2.6], [T[0] + 3.4, T[2] + 2.9], [T[0] - 1.9, T[2] + 3.5], [T[0] + 1.5, T[2] + 4.6], [T[0] - 3.9, T[2] + 4.2]], { seed: 35, scale: [0.3, 0.7] }));
  for (const [x, z, s] of [[T[0] - 3.4, T[2] + 2.0, 0.9], [T[0] + 3.8, T[2] + 2.2, 1.0], [T[0] - 4.6, T[2] + 3.4, 0.7]]) { const b = makeBush(s, { seed: 36 + x }); b.position.set(x, 0, z); g.add(b); }
  g.add(scatterGrass(160, { area: [T[0] - 6, T[2] + 2, T[0] + 6, T[2] + 9], seed: 37, clump: 4, spread: 0.3, scale: [0.4, 0.8] }));

  // people
  const jesus = new Person({ ...JESUS }), man = new Person({ ...BLIND_MAN }), child = new Person({ ...CHILD }), lazarus = new Person({ ...LAZARUS });
  const mother = new Person({ ...JERUSALEM_CROWD[12], quality: 'main' });
  for (const p of [jesus, man, child, mother, lazarus]) g.add(p.root);
  man.root.position.set(...MEM.A.man); mother.root.position.set(...MEM.B.mother);
  const motes = makeMotes(120, 51); g.add(motes.group);
  const _o = new THREE.Vector3();

  return {
    group: g, persons: [jesus, man, child, mother, lazarus],
    update(t, cam, shot) {
      const id = shot.id;
      man.root.visible = id === 'S5a'; child.root.visible = mother.root.visible = id === 'S5b'; lazarus.root.visible = id === 'S5c';
      if (id === 'S5a') {
        // the man faces Jesus (screen-left); his closed eyes open wide, wonder
        jesus.root.position.set(...MEM.A.jesus); jesus.setView('threeQuarter'); jesus.setFacing(1);
        jesus.act((tt) => { const P = Poses.idle(tt, 33); P.aF = [1.32, 0.52, 0.1]; P.handF = 'open'; expr(P, 'kind', 1); P.lookY = 0.05; return P; }, t, { wind: 0.3 });
        man.setView('threeQuarter'); man.setFacing(-1);
        const k = Bk.eyesOpen(t);
        man.act((tt) => { const P = Poses.idle(tt, 41); if (k < 0.5) { P.eye = 0; P.headTilt = 0.08; P.brow = -0.1; } else { expr(P, 'wonder', 1); P.eye = 1.15; P.lookY = 0.25; } return P; }, t, { wind: 0.3 });
      } else if (id === 'S5b') {
        jesus.root.position.set(...MEM.B.jesus); jesus.setView('threeQuarter'); jesus.setFacing(1);
        const L = Bk.lift(t);
        jesus.act((tt) => { const P = Poses.idle(tt, 33); P.aF = [lerp(1.4, 2.55, L), lerp(0.9, 0.35, L)]; P.aB = [lerp(1.3, 2.45, L), lerp(1.0, 0.4, L)]; P.handF = P.handB = 'open'; expr(P, 'laugh', 0.8); P.headTilt = 0.12 * L; P.lookY = 0.6 * L; return P; }, t, { wind: 0.4 });
        child.root.position.set(MEM.B.child[0], lerp(0.55, 1.08, L), MEM.B.child[2]);
        child.setView('threeQuarter'); child.setFacing(-1); child.uni.uLayerBase.value = 26;
        child.act((tt) => { const P = Poses.idle(tt, 42); P.aF = [2.4, 0.3]; P.aB = [2.2, 0.4]; P.lF = [0.5, -0.6]; P.lB = [-0.2, -0.3]; expr(P, 'laugh', 1); return P; }, t, { wind: 0.5 });
        mother.setView('threeQuarter'); mother.setFacing(-1);
        mother.act((tt) => { const P = Poses.idle(tt, 61); P.aF = [1.1, 1.9]; P.aB = [1.0, 2.0]; expr(P, 'happy', 1); P.lookY = 0.4; return P; }, t, { wind: 0.4 });
      } else {
        // C: Jesus from behind (one hand raised toward the tomb), Lazarus walking out into the light
        jesus.root.position.set(...MEM.C.jesus); jesus.setView('back'); jesus.setFacing(-1);
        jesus.act((tt) => { const P = Poses.idle(tt, 33); P.aF = [2.05, 0.2]; P.handF = 'open'; return P; }, t, { wind: 0.4 });
        const w = Bk.walkOut(t);
        lazarus.root.position.set(lerp(MEM.C.lazarus0[0], MEM.C.lazarus1[0], w), 0, lerp(MEM.C.lazarus0[2], MEM.C.lazarus1[2], w));
        lazarus.setView('threeQuarter'); lazarus.setFacing(-1);
        lazarus.act((tt) => { const P = Poses.walk(tt, 43, 0.45, 0.45); P.aF = [0.55, 0.5]; P.aB = [0.4, 0.6]; P.handF = P.handB = 'open'; expr(P, 'wonder', 0.7); P.lookY = 0.1; return P; }, t, { wind: 0.4, vx: 0.4 });
        lazarus.uni.uGlow.value = 0.12 * (1 - w);
      }
      for (const p of [jesus, man, child, mother, lazarus]) if (p.root.visible) { p.billboard(cam, 0.3); p.autoOutline(cam); }
      g.getWorldPosition(_o);
      const c = id === 'S5a' ? [0, 1.2, 0] : id === 'S5b' ? [40, 1.4, 0] : [80, 1.3, -2];
      motes.set(t, [_o.x + c[0], _o.y + 0.3, _o.z + c[2]], [4, 2.8, 4], 1.4, [1.0, 0.92, 0.72], 0.022);
    },
    mood(t, shot) {
      // soft glowing memory light: warm white haze, gentle contrast, light bloom; the subject in focus
      return merge(MOODS.morningGold, {
        sky: { top: '#f3e2c2', horizon: '#fff2dc', bottom: '#e6cfa6', band: '#000000', sunGlow: '#fff0d0', sunDisk: '#ffffff', clouds: 0 },
        sunDir: [0.35, 0.72, 0.6], sun: { color: '#fff1d8', intensity: 2.4 }, hemi: { sky: '#fff4e2', ground: '#d8b88a', intensity: 1.05 },
        fog: { color: '#f6e6c8', near: 8, far: 70, density: 0.03, height: 6, sun: 0.4 }, char: '#fff6ea', ao: 0.14,
        post: { exposure: 1.02, bloom: 1.1, bloomThreshold: 0.72, haze: 0.32, hazeTop: 0.45, hazeColor: '#fff0d6', vignette: 0.22, grain: 0.02, sat: 0.86, contrast: 0.96,
          split: 0.2, splitShadow: '#9a7a6a', splitHigh: '#ffe6b8', dof: shot.id === 'S5a' ? 1.2 : 0.8, focusRange: shot.id === 'S5a' ? 0.25 : 0.8, tilt: 0, ao: 0.35,
          godrays: { pos: [40, 60, 40], strength: 0 } },
      });
    },
  };
}
