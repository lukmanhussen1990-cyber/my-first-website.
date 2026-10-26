// S7 — "Feet that be swift in running to mischief." Harsh noon on a dusty road: a man sprints toward
// a shouting crowd. Dust kicks at every footfall, robe and head-wrap whip back, posts flick past the
// lens; rendered with sub-frame motion blur.
import * as THREE from 'three';
import { makeTerrain, makeMountains, makeWall, makeOlive, makeRock, makeGrass, makeHouse, srgb, mixc } from '../kit.js';
import { makeSprites, puffTex } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, place, finish, kin } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, fbm, hash01, noise2 } from '../../lib/util.js';

const TAU = Math.PI * 2;

export function buildRoad(ctx) {
  const { plan, B } = ctx; const O = SETS.road;
  const S7 = plan.shots.find((s) => s.id === 'S7');
  const g = new THREE.Group();
  const roadW = (x, z) => Math.abs(z - 0.4 - 0.6 * Math.sin(x * 0.05)) < 1.7;
  const height = (x, z) => { const off = Math.abs(z - 0.4); return 0.04 * fbm(x * 0.2, z * 0.2, 2, 1) + smooth(invLerp(3, 14, off)) * (0.9 * fbm(x * 0.03, z * 0.03, 3, 4) + 0.6); };
  const dA = srgb('#d8c49c'), dB = srgb('#b8a07a'), gA = srgb('#a8985e'), gB = srgb('#8a8050');
  g.add(makeTerrain({ size: 400, seg: 200, height, color: (x, z, y) => { const n = fbm(x * 0.1, z * 0.1, 3, 6); const road = roadW(x, z) ? 1 : smooth(invLerp(2.4, 1.7, Math.abs(z - 0.4))); return mixc(mixc(gB, gA, smooth(0.5 + n)), mixc(dB, dA, smooth(0.5 + n)), road); } }));
  g.add(makeMountains({ seed: 8, n: 18, r0: 150, r1: 260, h0: 8, h1: 26, color: '#b9a88e' }));
  // walls, olive trees, rocks, a few houses where the crowd gathers
  for (let i = 0; i < 9; i++) { const w = makeWall({ len: 4 + 3 * hash01(i, 1), h: 0.8, t: 0.45, color: '#c2b294', seed: 30 + i }); w.position.set(-36 + i * 7.2, 0, i % 2 ? -2.6 : -4.4); g.add(w); }
  for (let i = 0; i < 12; i++) { const o = makeOlive(1.0 + 0.4 * hash01(i, 2), 40 + i); o.position.set(-40 + i * 6.3 + 2 * hash01(i, 3), 0, -5 - 9 * hash01(i, 4)); g.add(o); }
  for (let i = 0; i < 16; i++) { const r = makeRock(0.15 + 0.35 * hash01(i, 5), 50 + i, '#b8a688'); r.position.set(-38 + i * 4.1, 0, (hash01(i, 6) > 0.5 ? 2.6 : -1.9) + hash01(i, 7)); g.add(r); }
  g.add(makeGrass(2200, [-42, -12, 30, 9], 9, '#b0a062', 0.5, height, (x, z) => roadW(x, z) || (z > -1.6 && z < 5)));
  for (const [x, z, w, h, seed] of [[17, -6, 5, 3.6, 71], [22, -2, 4, 3.0, 72], [15, 5, 4, 3.2, 73]]) { const hs = makeHouse({ w, d: 4, h, wall: '#dccbaa', roofCol: '#a89474', windows: 2, seed }); hs.position.set(x, 0, z); hs.rotation.y = -0.5; g.add(hs); }
  // foreground posts that flick past the lens (speed cue)
  const posts = []; for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.4 + 0.3 * hash01(i, 8), 0.16), matte('#6a5038')); p.position.set(-34 + i * 3.3, 0.7, -1.7 - 0.4 * hash01(i, 9)); p.castShadow = true; g.add(p); posts.push(p); }

  const runner = person(g, { seed: 71, height: 1.78, skin: SKIN[3], hair: 'wrap', wrap: '#c9a36a', wrapTail: true, beard: 'short', beardColor: HAIR.black, outfit: 'tunic', cloth: CLOTH.ochre, belt: '#6a4a2a', legs: SKIN[3] });
  const crowdLooks = [
    { cloth: CLOTH.rust, hair: 'turban', wrap: '#e8dcc0', beard: 'long' }, { cloth: CLOTH.indigo, hair: 'short', beard: 'short' },
    { cloth: CLOTH.olive, hair: 'wrap', wrap: '#b8a07a', beard: 'short' }, { cloth: CLOTH.wine, hair: 'curly', beard: 'none' },
    { cloth: CLOTH.brown, hair: 'wrap', wrap: '#8a7a62', beard: 'long', beardColor: HAIR.grey }, { cloth: CLOTH.sky, hair: 'veil', wrap: '#c06a5e' },
    { cloth: CLOTH.stone, hair: 'short', beard: 'short' }, { cloth: CLOTH.moss, hair: 'turban', wrap: '#d0c0a0', beard: 'short' },
  ];
  const crowd = crowdLooks.map((L, i) => person(g, { seed: 80 + i, height: 1.68 + 0.14 * hash01(i, 1), skin: SKIN[1 + (i % 6)], outfit: i % 3 ? 'tunic' : 'robe', legs: SKIN[1 + (i % 6)], ...L }));
  const persons = [runner, ...crowd];
  const kick = makeSprites(260, { tex: puffTex(), order: 4 }); g.add(kick.group);
  const haze = makeSprites(30, { tex: puffTex(), order: 3 }); g.add(haze.group);
  const speed = 1.12, ph = hash01(71, 3) * TAU;
  // foot contacts of the run cycle: f = TAU*t*(30/18)*speed + ph crosses PI/2 (front foot) and 3PI/2 (back foot)
  const contacts = (t) => { const w = TAU * (30 / 18) * speed; const out = []; const k1 = Math.floor((w * (t - 1.2) + ph - Math.PI / 2) / Math.PI), k2 = Math.floor((w * t + ph - Math.PI / 2) / Math.PI); for (let k = k1; k <= k2; k++) out.push({ tc: (Math.PI / 2 + k * Math.PI - ph) / w, side: k & 1 }); return out; };

  return {
    group: g, persons,
    update(t, cam) {
      const rx = (tt) => B.runX(tt);
      const { v, acc } = kin(rx, t);
      const P = Poses.run(t, 71, speed);
      runner.secondary(P, { vx: v, ax: acc, t, wind: 1.0 });
      runner.setFacing(1); runner.pose(P); place(runner, O, B.runner(t));
      // dust kicked up behind each footfall
      kick.begin();
      for (const c of contacts(t)) {
        const u = t - c.tc; if (u < 0 || u > 1.2) continue;
        const fx = B.runX(c.tc) - O[0] - 0.15, fz = 0.4 + (c.side ? 0.06 : -0.06);
        for (let i = 0; i < 9; i++) {
          const h1 = hash01(Math.round(c.tc * 100) * 9 + i, 1), h2 = hash01(Math.round(c.tc * 100) * 9 + i, 2);
          const e = 1 - Math.exp(-u * 3.5);
          kick.add(fx - (0.6 + 1.6 * h1) * e, 0.08 + (0.25 + 0.6 * h2) * e, fz + (h2 - 0.5) * 0.9 * e, 0.18 + 0.7 * e * (0.6 + h1), 0.86, 0.76, 0.6, 0.55 * (1 - u / 1.2) ** 1.5, h1 * 6);
        }
      }
      kick.end();
      // the crowd ahead: shouting, shoving, a haze of dust over them
      const cx = B.crowdX;
      crowd.forEach((p, i) => {
        const a = i / crowd.length * TAU; const x = cx + Math.cos(a) * 1.4 + 0.3 * hash01(i, 5), z = 0.4 + Math.sin(a) * 1.6;
        const PP = i % 3 === 1 ? Poses.shove(t, 80 + i) : Poses.shout(t, 80 + i);
        p.setFacing(Math.cos(a) > 0 ? -1 : 1); p.pose(PP); p.root.position.set(x, 0, z);
      });
      haze.begin(); for (let i = 0; i < 30; i++) { const a = hash01(i, 11) * TAU; haze.add(cx + Math.cos(a) * 2.6, 0.5 + 1.2 * hash01(i, 12) + 0.2 * Math.sin(t + i), 0.4 + Math.sin(a) * 2.2, 1.5 + hash01(i, 13), 0.9, 0.82, 0.68, 0.22, t * 0.1 + i); } haze.end();
      finish(persons, cam);
    },
    mood() {
      return {
        sky: { top: '#86a9c6', horizon: '#f2ead6', bottom: '#d0c09a', sunGlow: '#fff2d0' },
        sunDir: [0.3, 0.9, 0.32], sun: { color: '#fff4e0', intensity: 3.9 },
        hemi: { sky: '#dfe9f2', ground: '#b09a74', intensity: 1.2 },
        fog: { color: '#eee3c8', near: 30, far: 170 }, char: '#fffaf0', ao: 0.15, wind: 1.4,
        shadow: { size: 14 },
        post: { exposure: 1.04, bloom: 0.4, bloomThreshold: 0.92, haze: 0.14, hazeColor: '#f6ecd6', tint: '#fff8ec', sat: 0.9, contrast: 1.12, vignette: 0.5, dof: 0.35, focusRange: 3, tilt: 0.2, grain: 0.032 },
      };
    },
  };
}
