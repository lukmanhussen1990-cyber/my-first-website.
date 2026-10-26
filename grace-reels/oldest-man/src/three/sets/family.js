// 'family' set (S5, S6): night in the village, warm lamplight and gold numbers ("the math" mood).
// Spot A: young Methuselah at his door rocks baby Lamech; a gold 187 dips and rises beside them on "187".
// Spot B (a generation later, another door): strong Lamech holds baby Noah; a gold 182 rises on "182".
// Layout in src/cams/family.js (FAMILY). The whip pans between S5 > S6 > S7 > S8 come from the director.
import * as THREE from 'three';
import { makeTerrain, srgb, mixc, makeMudHouse, makeStone, scatterPebbles, scatterPots, scatterBaskets, scatterFirewood, makeRug, makeBevelBox, scatterGrass, makePalm } from '../kit.js';
import { makeOilLamp } from '../lamp.js';
import { makeMotes } from '../fx.js';
import { makeGoldNumber } from '../gold.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, expr } from '../rig.js';
import { METHUSELAH_YOUNG, LAMECH, BABY_LAMECH, BABY_NOAH } from '../characters/cast.js';
import { fbm, clamp, smooth, invLerp, hash01 } from '../../lib/util.js';
import { FAMILY } from '../../cams/family.js';

function doorway(g, house, H) {
  // the lit interior seen through the open door (warm HDR plane, feeds the bloom)
  const d = house.userData.door;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.72), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.05, 0.42) }));
  glow.position.set(d.x, 0.88, d.z - 0.205); house.add(glow);
  return glow;
}

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev;
  const g = new THREE.Group();
  const H = (x, z) => 0.05 * fbm(x * 0.3, z * 0.3, 2, 5) + 0.25 * fbm(x * 0.05, z * 0.05, 2, 8) * smooth(invLerp(6, 18, Math.abs(z + 1)));
  g.add(makeTerrain({ size: 400, seg: 160, height: H, color: (x, z) => {
    const n = clamp(0.5 + fbm(x * 0.25, z * 0.25, 3, 3));
    return mixc(srgb('#7a5e40'), srgb('#8e7050'), n);
  } }));
  const spots = [FAMILY.A, FAMILY.B];
  const lamps = [], houses = [];
  spots.forEach((S, i) => {
    const house = makeMudHouse({ w: 4.4, d: 3.4, h: 2.9, seed: 31 + i * 7, glow: 0.9, curtain: i ? '#2f5a5a' : '#7a2e3a', awning: i ? ['#7a2e3a', '#d9b46a'] : null, roofClutter: true });
    house.position.set(S.house[0], H(S.house[0], S.house[1]), S.house[1]); house.rotation.y = S.houseRot; g.add(house); houses.push(house);
    doorway(g, house, H);
    const n1 = makeMudHouse({ w: 3.6, d: 3.2, h: 2.6, seed: 40 + i, glow: 0.7, dome: i === 1 }); n1.position.set(S.house[0] - 5.2, 0, S.house[1] - 1.2); n1.rotation.y = 0.25; g.add(n1);
    const n2 = makeMudHouse({ w: 3.8, d: 3.4, h: 2.8, seed: 50 + i, glow: 0.6 }); n2.position.set(S.house[0] + 5.4, 0, S.house[1] - 1.6); n2.rotation.y = -0.3; g.add(n2);
    // the lamp on a little stone stool by the door
    const stool = makeStone(0.2, { seed: 60 + i, color: '#6e5a46', sink: 0.1 }); stool.position.set(S.lamp[0], 0.02, S.lamp[2]); stool.scale.set(1.2, 1.4, 1.2); g.add(stool);
    const lamp = makeOilLamp({ scale: 1.6, seed: 5 + i }); lamp.group.position.set(S.lamp[0], 0.27, S.lamp[2]); lamp.group.rotation.y = -0.6; g.add(lamp.group); lamps.push(lamp);
    const rug = makeRug(1.5, 0.95, { colors: i ? ['#2f4a6a', '#d9b46a', '#7a2e3a'] : ['#7a2e3a', '#d9b46a', '#2f4a6a'], seed: 3 + i }); rug.position.set(S.person[0] - 0.1, 0.02, S.person[2] - 0.15); g.add(rug);
    g.add(scatterPots(4, { points: [[S.house[0] - 1.9, S.house[1] + 1.95], [S.house[0] - 1.55, S.house[1] + 2.1], [S.house[0] + 1.9, S.house[1] + 2.0], [S.house[0] + 2.3, S.house[1] + 1.9]], height: H }));
    g.add(scatterBaskets(2, { points: [[S.house[0] + 1.5, S.house[1] + 2.25], [S.person[0] - 1.6, S.person[2] - 0.6]], height: H }));
    g.add(scatterFirewood(1, { points: [[S.house[0] - 2.3, S.house[1] + 1.4]], height: H }));
    const palm = makePalm(1.1, 9 + i); palm.position.set(S.house[0] + 3.2, 0, S.house[1] - 3.5); g.add(palm);
  });
  g.add(scatterPebbles(400, { area: [-6, -2, 20, 4], height: H, seed: 12, colors: ['#8a7058', '#7a6450', '#9a8066'] }));
  g.add(scatterGrass(160, { area: [-8, -6, 22, 5], height: H, seed: 13, clump: 4, spread: 0.3, scale: [0.3, 0.6], colors: ['#7a7a44', '#6e7040'], skip: (x, z) => z > -1.0 && z < 1.2 }));

  // people
  const meth = new Person({ ...METHUSELAH_YOUNG }); const bLamech = new Person({ ...BABY_LAMECH });
  const lamech = new Person({ ...LAMECH }); const bNoah = new Person({ ...BABY_NOAH });
  for (const p of [meth, lamech]) g.add(p.root);
  meth.hold(bLamech); lamech.hold(bNoah);
  meth.root.position.set(...FAMILY.A.person); lamech.root.position.set(...FAMILY.B.person);
  // gold numbers
  const renderer = ctx.world.gl;
  const n187 = makeGoldNumber('187', { renderer, size: FAMILY.numSize }), n182 = makeGoldNumber('182', { renderer, size: FAMILY.numSize });
  g.add(n187.group, n187.fx, n182.group, n182.fx);
  const motes = makeMotes(60, 23); g.add(motes.group);
  const _o = new THREE.Vector3();
  const spotIdx = (shot) => (shot.id === 'S6' ? 1 : 0);

  return {
    group: g, persons: [meth, lamech], heightAt: H,
    update(t, cam, shot) {
      const i = spotIdx(shot);
      meth.root.visible = i === 0; lamech.root.visible = i === 1;
      // rocking the baby, looking down at him, then up at the number as it lands
      const P1 = Poses.holdBaby(t, 187, 1); const lk1 = smooth(invLerp(E.n187 + 0.2, E.n187 + 0.8, t)) * (1 - smooth(invLerp(E.n187 + 2.6, E.n187 + 3.4, t)));
      P1.look = 0.5 * lk1; expr(P1, lk1 > 0.4 ? 'wonder' : 'kind', 0.6); meth.setFacing(1); meth.pose(P1);
      const P2 = Poses.holdBaby(t, 182, 0.9); const lk2 = smooth(invLerp(E.n182 + 0.2, E.n182 + 0.8, t));
      P2.look = 0.5 * lk2; expr(P2, lk2 > 0.4 ? 'proud' : 'happy', 0.6); lamech.setFacing(1); lamech.pose(P2);
      bLamech.pose(Poses.baby(t, 3)); bNoah.pose(Poses.baby(t, 4, lk2 > 0.5));
      for (const p of [meth, lamech]) if (p.root.visible) { p.billboard(cam, 0.3); p.autoOutline(cam); for (const b of [bLamech, bNoah]) if (b.holder === p) b.autoOutline(cam); }
      lamps.forEach((L, k) => L.set(t, 0.95, cam));
      // numbers: each dips (anticipation) then rises on its word
      if (i === 0) { n187.rise(t - E.n187, { pos: FAMILY.A.number, t, groundY: 0.02 }); n182.group.visible = false; n182.quiet(); }
      else { n182.rise(t - E.n182, { pos: FAMILY.B.number, t, groundY: 0.02 }); n187.group.visible = false; n187.quiet(); }
      g.getWorldPosition(_o); const S = spots[i];
      motes.set(t, [_o.x + S.person[0], _o.y + 1.4, _o.z - 0.5], [5, 2.2, 3], 0.7, [1.0, 0.8, 0.5], 0.014);
    },
    mood(t, shot) {
      const i = spotIdx(shot); const L = lamps[i].light(t, 0.95); const S = spots[i];
      return merge(MOODS.mathDark, {
        sky: { top: '#07060d', horizon: '#1d1622', bottom: '#0a0705', stars: 0.9, moon: 0.3, moonDir: [0.4, 0.3, -1] },
        sunDir: [0.35, 0.5, -0.8], sun: { color: '#7d8cc0', intensity: 0.55 },
        hemi: { sky: '#3a3048', ground: '#1a120c', intensity: 0.45 },
        char: '#a8a0b4',
        point: { ...L, intensity: L.intensity * 1.3, charK: (L.charK ?? 0.6) * 1.2, charRange: Math.max(L.charRange ?? 3, 3.4) },
        post: { dof: 0.3, focusRange: 1.8, ao: 0.55, tilt: 0.15 },
      });
    },
  };
}
