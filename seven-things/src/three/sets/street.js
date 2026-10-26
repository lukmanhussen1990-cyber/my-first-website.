// S3 — "A proud look." Golden evening street. A rich man in purple and gold walks past a beggar,
// chin high. Low sun from the front-left throws their shadows onto the tall facade behind them:
// his grows huge and towers over the beggar, whose shadow shrinks. The camera cranes up the wall.
import * as THREE from 'three';
import { makeHouse, makeWall, makePalm, makeJar, texMat, paveTex, plasterTex, makeBasket } from '../kit.js';
import { makeRays, makeMotes } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, puppet, place, finish, kin } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, hash01 } from '../../lib/util.js';

const WALL_Z = -2.6;

export function buildStreet(ctx) {
  const { plan, B } = ctx; const O = SETS.street;
  const S3 = plan.shots.find((s) => s.id === 'S3');
  const g = new THREE.Group();
  const pave = paveTex().clone(); pave.needsUpdate = true; pave.repeat.set(9, 9);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), texMat('#cdb28a', pave, { flat: false })); ground.receiveShadow = true; g.add(ground);
  // the tall facade behind (shadow wall) + neighbours with a lane between them
  const big = makeHouse({ w: 7.4, d: 5, h: 7.6, wall: '#e2cba3', roofCol: '#b99a72', windows: 3, seed: 2 }); big.position.set(-0.6, 0, WALL_Z - 2.5); g.add(big);
  const left = makeHouse({ w: 4.6, d: 5, h: 5.2, wall: '#d4b088', roofCol: '#a98a62', windows: 2, seed: 4, stairs: true }); left.position.set(-7.0, 0, WALL_Z - 2.3); g.add(left);
  const right = makeHouse({ w: 4.2, d: 5, h: 4.6, wall: '#dcc0a0', roofCol: '#b4936a', windows: 2, seed: 5 }); right.position.set(6.1, 0, WALL_Z - 2.6); g.add(right);
  const far = makeHouse({ w: 6, d: 5, h: 6.5, wall: '#cfae86', roofCol: '#a88660', windows: 3, seed: 7 }); far.position.set(4.2, 0, -14); g.add(far);
  const far2 = makeHouse({ w: 5, d: 5, h: 4.5, wall: '#d9bd96', roofCol: '#a88660', windows: 2, seed: 8 }); far2.position.set(-12, 0, -10); g.add(far2);
  const lowWall = makeWall({ len: 6, h: 1.1, t: 0.4, color: '#c8b08c', seed: 9 }); lowWall.position.set(10.5, 0, WALL_Z - 0.4); g.add(lowWall);
  // a purple + gold banner and a striped awning on the big house (colour accents)
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.6), matte('#5b2a6e', { params: { side: THREE.DoubleSide } })); banner.position.set(-3.4, 5.0, WALL_Z + 0.03); g.add(banner);
  const bTrim = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.14), matte('#c99a3a')); bTrim.position.set(-3.4, 3.75, WALL_Z + 0.035); g.add(bTrim);
  // doorway beside the beggar, step, jars, a potted palm, basket
  const step = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.22, 0.5), texMat('#bfa784', plasterTex())); step.position.set(-2.5, 0.11, WALL_Z + 0.25); step.castShadow = step.receiveShadow = true; g.add(step);
  for (const [x, z, s, c] of [[-3.9, WALL_Z + 0.35, 1.0, '#b0683c'], [-4.35, WALL_Z + 0.5, 0.75, '#9a5a34'], [3.6, WALL_Z + 0.4, 0.9, '#a86a40']]) { const j = makeJar(s, c); j.position.set(x, 0, z); g.add(j); }
  const palm = makePalm(1.15, 4); palm.position.set(5.8, 0, WALL_Z + 0.9); g.add(palm);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.32, 0.6, 9), matte('#a0603a')); pot.position.set(5.8, 0.3, WALL_Z + 0.9); pot.castShadow = true; g.add(pot);
  const bk = makeBasket(1.1, ['#d98a2c', '#7a9a3a'], 3); bk.position.set(-0.4, 0, WALL_Z + 0.45); g.add(bk);

  // ---- people ----
  const rich = person(g, { seed: 31, height: 1.84, build: 1.14, skin: SKIN[4], hair: 'turban', wrap: '#efe0bc', beard: 'short', beardColor: HAIR.black, outfit: 'robe', cloth: CLOTH.purple, trim: CLOTH.gold, sash: CLOTH.gold, belt: CLOTH.gold, sleeve: '#4a2058', noShadow: true });
  const beggar = person(g, { seed: 32, height: 1.68, skin: SKIN[2], hair: 'wrap', wrap: '#8f7d62', beard: 'long', beardColor: HAIR.grey, age: 'old', outfit: 'robe', cloth: CLOTH.rag, belt: null, prop: 'bowl', noShadow: true });
  const walkers = [
    person(g, { seed: 33, height: 1.7, skin: SKIN[3], hair: 'veil', wrap: '#b06a5e', outfit: 'robe', cloth: CLOTH.olive }),
    person(g, { seed: 34, height: 1.76, skin: SKIN[5], hair: 'short', beard: 'short', outfit: 'tunic', cloth: CLOTH.sky, legs: '#8a6a4a' }),
  ];
  const richSh = puppet(g, { seed: 31, height: 1.84, build: 1.14, hair: 'turban', beard: 'short', outfit: 'robe', sash: '#000', belt: '#000' }, '#2a1432', 0.55);
  const begSh = puppet(g, { seed: 32, height: 1.68, hair: 'wrap', beard: 'long', outfit: 'robe', prop: 'bowl' }, '#2a1432', 0.5);
  const persons = [rich, beggar, ...walkers];

  const rays = makeRays(4, 3); g.add(rays.group);
  const motes = makeMotes(160, 5); g.add(motes.group);
  const sun = [-0.5, 0.36, 0.79];

  return {
    group: g, persons,
    update(t, cam) {
      // rich man: proud walk, chin up, follow-through from his pace
      const rx = (tt) => B.richX(tt);
      const { v, acc } = kin(rx, t);
      const walkK = clamp(v / 0.82);
      let P = Poses.proudWalk(t, 31, 0.92);
      if (walkK < 0.999) { // blend into a proud stand as he stops
        const I = expr(Poses.idle(t, 31), 'proud', 1); I.aF = [0.15, 0.9]; I.aB = [-0.2, 1.4]; I.lean = -0.07; I.headTilt = 0.2;
        for (const k of ['bob', 'lean', 'headTilt']) P[k] = lerp(I[k], P[k], walkK);
        for (const k of ['aF', 'aB', 'lF', 'lB']) P[k] = P[k].map((x, j) => lerp(I[k][j] ?? 0, x, walkK));
      }
      rich.secondary(P, { vx: v, ax: acc, t, wind: 0.3 });
      rich.setFacing(1); rich.pose(P); place(rich, O, B.rich(t));
      // beggar: sitting by the doorway, bowl raised; looks up as the rich man passes, then lowers his head
      const pass = smooth(invLerp(-1.6, -0.4, B.richX(t) - B.beggar()[0]));
      const BP = Poses.beg(t, 32);
      BP.headTilt = lerp(-0.12, 0.22, pass * (1 - smooth(invLerp(0.4, 1.6, B.richX(t) - B.beggar()[0])))) - 0.08;
      BP.look = 0.5; beggar.setFacing(1); beggar.pose(BP); place(beggar, O, B.beggar());
      // shadows on the facade: his towers, the beggar's shrinks
      const L = B.richShadow(t), Lb = B.beggarShadow(t);
      richSh.pose(P); richSh.setFacing(1);
      richSh.root.position.set(B.rich(t)[0] - O[0] + 0.55 + 0.14 * L, 0, WALL_Z + 0.02); richSh.root.scale.set(L * 1.02, L, 1);
      richSh.mat.opacity = 0.42 + 0.14 * smooth(invLerp(1.2, 3, L));
      begSh.pose(BP); begSh.setFacing(1);
      begSh.root.position.set(B.beggar()[0] - O[0] + 0.55, 0, WALL_Z + 0.02); begSh.root.scale.set(Lb, Lb, 1);
      // two people cross far down the street (life in the background)
      walkers.forEach((w, i) => {
        const dir = i ? -1 : 1; const x = (i ? 7.5 : -8.5) + dir * 0.85 * (t - S3.t0);
        const wp = Poses.walk(t, 33 + i, 0.95); w.secondary(wp, { vx: 0.85, t }); w.setFacing(dir); w.pose(wp);
        w.root.position.set(x, 0, i ? -1.0 : -1.2); w.root.visible = i === 0;
      });
      finish(persons, cam);
      rays.set(t, cam, [-sun[0], -sun[1], -sun[2]], [
        { p: [1.0, 0.0, -2.2], w: 1.6, len: 14, a: 0.12 }, { p: [3.4, 0.0, -1.5], w: 1.1, len: 13, a: 0.1 },
        { p: [-1.4, 0.0, -2.0], w: 0.9, len: 12, a: 0.08 }, { p: [5.2, 0.0, -0.8], w: 1.3, len: 14, a: 0.09 },
      ], 1, [1.0, 0.78, 0.48]);
      motes.set(t, [B.rich(t)[0] - O[0] + 0.6, 0.2, -0.8], [6, 5, 4], 0.9, [1.0, 0.78, 0.5], 0.03);
    },
    mood() {
      return {
        sky: { top: '#5d4e7a', horizon: '#f3c27c', bottom: '#b8885c', sunGlow: '#ffb867', sunDisk: '#fff0d0' },
        sunDir: sun, sun: { color: '#ffcb8a', intensity: 3.3 },
        hemi: { sky: '#b9a6c8', ground: '#6e4a5e', intensity: 0.9 },
        fog: { color: '#d9b68a', near: 30, far: 140 }, char: '#ffe3c4', ao: 0.2,
        shadow: { size: 9 },
        post: { exposure: 0.96, bloom: 0.55, bloomThreshold: 0.85, haze: 0.12, hazeColor: '#f1c890', tint: '#fff0dc', lift: '#0c0410', sat: 1.08, contrast: 1.05, vignette: 0.55, dof: 0.35, focusRange: 3, tilt: 0.2, grain: 0.03 },
      };
    },
  };
}
