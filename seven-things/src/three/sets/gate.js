// S8 — "A false witness that speaketh lies." The city gate under a grey sky; elders on stone seats.
// The accuser pulls back (anticipation) and points; the camera pushes in on the innocent man while
// his name tag (overlay) cracks — Naboth, 1 Kings 21:13.
import * as THREE from 'three';
import { makeWall, makeHouse, makeOlive, makeJar, texMat, paveTex, stoneTex } from '../kit.js';
import { makeBirds } from '../fx.js';
import { matte } from '../materials.js';
import { SKIN, HAIR, CLOTH, Poses, expr } from '../rig.js';
import { person, place, finish } from '../cast.js';
import { SETS } from '../../lib/director.js';
import { clamp, smooth, invLerp, lerp, hash01 } from '../../lib/util.js';

export function buildGate(ctx) {
  const { plan, B } = ctx; const O = SETS.gate;
  const g = new THREE.Group();
  const pave = paveTex().clone(); pave.needsUpdate = true; pave.repeat.set(10, 10);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2), texMat('#a89c8a', pave, { flat: false })); ground.receiveShadow = true; g.add(ground);
  // the wall with its gate: two wall runs, a lintel, two towers, crenellations
  const WZ = -5.2, H = 6.4;
  const wl = makeWall({ len: 14, h: H, t: 1.6, color: '#a39a8c', seed: 61 }); wl.position.set(-9.0, 0, WZ); g.add(wl);
  const wr = makeWall({ len: 14, h: H, t: 1.6, color: '#a39a8c', seed: 62 }); wr.position.set(9.0, 0, WZ); g.add(wr);
  const lintel = makeWall({ len: 4.2, h: 2.0, t: 1.6, color: '#9c9384', seed: 63 }); lintel.position.set(0, 4.4, WZ); g.add(lintel);
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 4.4), matte('#1e1a16')); dark.position.set(0, 2.2, WZ - 0.75); g.add(dark);
  const sm = texMat('#9a9284', stoneTex());
  for (const x of [-3.4, 3.4]) {
    const tw = new THREE.Mesh(new THREE.BoxGeometry(2.8, 9.0, 2.8), sm); tw.position.set(x, 4.5, WZ + 0.2); tw.castShadow = tw.receiveShadow = true; g.add(tw);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.6, 2.9), sm); c.position.set(x - 1.0 + i * 1.0, 9.3, WZ + 0.2); c.castShadow = true; g.add(c); }
  }
  for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 1.6), sm); const x = (i < 6 ? -15.5 : 4.9) + (i % 6) * 1.95; c.position.set(x, H + 0.27, WZ); c.castShadow = true; g.add(c); }
  // elders' stone seats along the wall, a few onlookers
  const seat = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.46, 0.7), sm); seat.position.set(-0.2, 0.23, WZ + 1.45); seat.castShadow = seat.receiveShadow = true; g.add(seat);
  const seat2 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.46, 0.7), sm); seat2.position.set(5.6, 0.23, WZ + 1.45); seat2.castShadow = true; g.add(seat2);
  for (const [x, z] of [[-5.2, WZ + 1.2], [6.9, WZ + 1.3]]) { const j = makeJar(1.1, '#8a6a52'); j.position.set(x, 0, z); g.add(j); }
  const ol = makeOlive(1.2, 9); ol.position.set(-7.4, 0, WZ + 2.6); g.add(ol);
  const hs = makeHouse({ w: 5, d: 5, h: 4.2, wall: '#b8ae9e', roofCol: '#8a8274', windows: 2, seed: 64 }); hs.position.set(11, 0, 2); hs.rotation.y = -0.9; g.add(hs);

  const accuser = person(g, { seed: 91, height: 1.8, skin: SKIN[3], hair: 'turban', wrap: '#5a3a3a', beard: 'short', beardColor: HAIR.black, outfit: 'robe', cloth: CLOTH.wine, trim: '#b0883a', belt: '#3a2a20' });
  const naboth = person(g, { seed: 92, height: 1.76, skin: SKIN[4], hair: 'short', hairColor: HAIR.brown, beard: 'short', beardColor: HAIR.brown, outfit: 'tunic', cloth: CLOTH.cream, trim: CLOTH.olive, belt: '#8a6a4a', legs: SKIN[4] });
  const elderLooks = [[CLOTH.slate, 'wrap', '#d8d0c0'], [CLOTH.brown, 'turban', '#e0d8c8'], [CLOTH.indigo, 'wrap', '#c8bca8'], [CLOTH.stone, 'bald', null]];
  const elders = elderLooks.map(([cloth, hair, wrap], i) => person(g, { seed: 93 + i, height: 1.7, skin: SKIN[2 + (i % 4)], hair, wrap, hairColor: HAIR.grey, beard: 'long', beardColor: HAIR.white, age: 'old', outfit: 'robe', cloth, belt: '#b8a07a' }));
  const lookers = [0, 1, 2].map((i) => person(g, { seed: 97 + i, height: 1.66 + 0.1 * i, skin: SKIN[2 + i], hair: ['veil', 'short', 'wrap'][i], wrap: ['#6a7a8a', null, '#a89474'][i], beard: i === 1 ? 'short' : 'none', outfit: 'robe', cloth: [CLOTH.olive, CLOTH.rust, CLOTH.stone][i] }));
  const persons = [accuser, naboth, ...elders, ...lookers];
  const birds = makeBirds(5, 12, '#2a2622'); g.add(birds.group);

  return {
    group: g, persons,
    update(t, cam) {
      const P = Poses.point(t, 91, B.pointT);
      if (t < B.pointT - 0.3) { expr(P, 'sly', 0.8); P.look = 0.5; }
      accuser.setFacing(1); accuser.pose(P); place(accuser, O, B.accuser());
      const hit = smooth(invLerp(B.pointT, B.pointT + 0.3, t));
      const NP = Poses.idle(t, 92); expr(NP, hit > 0.5 ? 'surprised' : 'neutral', 1);
      if (t > B.crackT - 0.1) { expr(NP, 'hurt', 1); NP.headTilt = -0.12; }
      NP.lean = -0.06 * hit; NP.aF = [lerp(0.06, 0.55, hit), lerp(0.08, 1.35, hit)];
      naboth.setFacing(-1); naboth.pose(NP); place(naboth, O, B.innocent());
      elders.forEach((e, i) => {
        const EP = Poses.sit(t, 93 + i, 0.46); expr(EP, i % 2 ? 'sad' : 'neutral', 0.6);
        EP.headTilt = 0.05 * Math.sin(t * 0.8 + i) + (t > B.pointT ? 0.06 : 0);
        e.setFacing(i < 2 ? 1 : -1); e.pose(EP); e.root.position.set(-2.4 + i * 1.45, 0, WZ + 1.62);
      });
      lookers.forEach((p, i) => {
        const LP = Poses.idle(t, 97 + i); expr(LP, t > B.pointT ? 'surprised' : 'neutral', 0.7);
        p.setFacing(i === 1 ? -1 : 1); p.pose(LP); p.root.position.set([-4.2, 4.1, 5.4][i], 0, [-1.9, -2.4, -0.6][i]);
      });
      birds.set(t, (i, tt) => [-12 + (tt - 37) * (1.5 + 0.3 * i) + i * 1.5, 11 + i * 0.6 + Math.sin(tt * 1.3 + i) * 0.3, WZ - 2 - i, 0], 1.2, 8);
      finish(persons, cam);
    },
    mood() {
      return {
        sky: { top: '#7e8894', horizon: '#c6c3bc', bottom: '#8e877c', sunGlow: '#d8d4cc' },
        sunDir: [-0.35, 0.75, 0.55], sun: { color: '#e6e8ee', intensity: 1.7 },
        hemi: { sky: '#c8d0da', ground: '#7a7266', intensity: 1.45 },
        fog: { color: '#b6b2aa', near: 26, far: 120 }, char: '#e8e8ea', ao: 0.2,
        shadow: { size: 12 },
        post: { exposure: 0.98, bloom: 0.35, bloomThreshold: 0.95, haze: 0.1, hazeColor: '#cfcbc4', tint: '#eef2f7', lift: '#06080a', sat: 0.74, contrast: 1.06, vignette: 0.6, dof: 0.45, focusRange: 2.5, tilt: 0, grain: 0.034 },
      };
    },
  };
}
