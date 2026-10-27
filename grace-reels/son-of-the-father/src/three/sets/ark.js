// 'ark' set: the ark site on the plain. S7: old Noah (600) at the finished hull at dusk, a gold 600 rises beside him.
// S11 a/b/c: the time-lapse "God waited" — the ark grows (keel > ribs > planks > roof), seasons turn green > dry >
// green, the sun wheels across the sky, mockers walk by laughing and pointing, Noah hammers, and old Methuselah
// watches from his little hill every year. S12: the flood begins — the sky cracks with light, rain comes down in
// sheets, low water spreads over the land and the ark lifts. Gentle: no people in the water.
// Layout + blocking (progress, season, water, lift) live in src/cams/ark.js (ARKSET).
import * as THREE from 'three';
import { makeTerrain, srgb, mixc, makePalm, makeTree, makeOlive, makeTent, makeStone, makeHalfBuriedRock, scatterGrass, scatterPebbles, scatterFirewood, scatterBaskets, scatterPots, makeLog, makeBush, makeBevelBox, pathWeight, makePathRibbon } from '../kit.js';
import { makeOilLamp } from '../lamp.js';
import { makeGoldNumber } from '../gold.js';
import { MOODS, merge, seasonMood, blend, resolve } from '../moods.js';
import { crackEnv } from '../sky.js';
import { rainRamp, wetten } from '../rain.js';
import { Person, Poses, expr } from '../rig.js';
import { NOAH_OLD, METHUSELAH_OLD, crowdMember } from '../characters/cast.js';
import { buildArk } from '../arkmodel.js';
import { makeAnimal } from '../animals.js';
import { fbm, clamp, smooth, invLerp, lerp, hash01 } from '../../lib/util.js';
import { ARKSET } from '../../cams/ark.js';

const GREEN = new THREE.Color('#ffffff'), DRY = new THREE.Color('#e8c98a');
const isS11 = (id) => id === 'S11a' || id === 'S11b' || id === 'S11c';

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev; const B = ctx.B.ark;
  const g = new THREE.Group();
  const road = [[-40, ARKSET.crowdZ + 2], [-15, ARKSET.crowdZ], [10, ARKSET.crowdZ - 0.5], [40, ARKSET.crowdZ + 1.5]];
  const pw = pathWeight(road, 2.2, { seed: 8 });
  const [mx, mz] = ARKSET.mound;
  const H = (x, z) => {
    const m = ARKSET.moundH * Math.exp(-((x - mx) ** 2 + (z - mz) ** 2) / 9);
    return 0.5 * fbm(x * 0.03, z * 0.03, 3, 31) * smooth(invLerp(25, 60, Math.hypot(x, z))) + 0.08 * fbm(x * 0.3, z * 0.3, 2, 3) + m - pw(x, z) * 0.04;
  };
  const terr = makeTerrain({ size: 900, seg: 220, height: H, color: (x, z, y) => {
    const n = clamp(0.5 + fbm(x * 0.06, z * 0.06, 3, 17) * 1.4), m = clamp(0.5 + fbm(x * 0.25, z * 0.25, 2, 19));
    let c = mixc(srgb('#a89a58'), srgb('#7d8a44'), smooth(invLerp(0.35, 0.8, n)));
    c = mixc(c, srgb('#b88f5a'), m * 0.25);
    c = mixc(c, srgb('#d6b47e'), pw(x, z) * 0.85);
    const site = 1 - smooth(invLerp(10, 22, Math.hypot(x * 0.6, z)));
    c = mixc(c, srgb('#b8946a'), site * 0.75);                         // trampled work site around the hull
    return c;
  } });
  wetten(terr.material, { patch: 0.4, scale: 0.3 }); g.add(terr);
  g.add(makePathRibbon(road, { width: 2.0, height: H, color: '#dcbd88', edge: '#c9a874', opacity: 0.5 }));
  // vegetation that turns with the seasons (materials tinted per frame)
  const veg = [];
  const tint = (o) => o.traverse((m) => { if (m.isMesh && m.material && m.material.color) { m.material = m.material.clone(); m.userData.base = m.material.color.clone(); veg.push(m); } });
  const grass = scatterGrass(1400, { area: [-45, -30, 45, 30], height: H, seed: 21, clump: 5, spread: 0.6, skip: (x, z) => Math.hypot(x * 0.6, z) < 13 || pw(x, z) > 0.2 });
  grass.material = grass.material.clone(); g.add(grass);
  const occupied = [];
  for (const [x, z, s, sd, kind] of [[-24, -14, 1.3, 3, 't'], [22, -16, 1.4, 7, 'o'], [-30, 6, 1.2, 9, 'p'], [28, 4, 1.1, 11, 't'], [-6, -24, 1.5, 13, 't'], [14, -26, 1.3, 15, 'p'], [-18, 22, 1.2, 17, 'o'], [24, 20, 1.3, 19, 't'], [-34, -8, 1.4, 21, 'p']]) {
    const tr = kind === 'p' ? makePalm(s, sd) : kind === 'o' ? makeOlive(s, sd) : makeTree(s, sd); tr.position.set(x, H(x, z), z); g.add(tr); tint(tr); occupied.push([x, z]);
  }
  for (let i = 0; i < 14; i++) { const x = -40 + 80 * hash01(i, 5), z = -28 + 56 * hash01(i, 6); if (Math.hypot(x * 0.6, z) < 14 || pw(x, z) > 0.1) continue; const b = makeBush(0.6 + 0.5 * hash01(i, 7), { seed: 70 + i }); b.position.set(x, H(x, z), z); g.add(b); tint(b); }
  for (let i = 0; i < 10; i++) { const x = -30 + 60 * hash01(i, 15), z = -20 + 40 * hash01(i, 16); if (Math.hypot(x * 0.6, z) < 12) continue; const r = makeHalfBuriedRock(0.5 + 0.6 * hash01(i, 17), { seed: 80 + i, color: '#9c8a70' }); r.position.set(x, H(x, z), z); g.add(r); }
  g.add(scatterPebbles(500, { area: [-25, -18, 25, 20], height: H, seed: 31 }));
  // the work site: timber stacks, logs, a workshop tent, tools, pitch pots
  for (const [x, z, ry] of [[-14, 7, 0.2], [13, 8.5, -0.3], [-16, -6, 0.6], [16, -7, 0.1]]) for (let k = 0; k < 5; k++) { const L = makeLog(3.2, 0.17); L.position.set(x + (k % 3) * 0.05, 0.17 + Math.floor(k / 2) * 0.3, z + (k - 2) * 0.36); L.rotation.y = ry; g.add(L); }
  const tent = makeTent({ seed: 6, colors: ['#3e2f26', '#8a6a4a'] }); tent.position.set(-19, H(-19, 2), 2); tent.rotation.y = 0.8; g.add(tent);
  g.add(scatterFirewood(4, { points: [[-12, 9], [11, 10], [-17, -3], [17, -3]], height: H }));
  g.add(scatterPots(6, { points: [[9.2, 9.6], [9.6, 9.9], [-9.5, 9.3], [-9.1, 9.8], [14, 2], [-15, 3]], height: H, colors: ['#3a2a1e', '#4a3424'] }));
  g.add(scatterBaskets(3, { points: [[8.3, 10.1], [-10.4, 10.3], [-13, 4]], height: H }));
  for (let i = 0; i < 4; i++) { const A = makeAnimal('sheep', 40 + i); const x = 18 + (i % 2) * 1.4, z = 14 + Math.floor(i / 2) * 1.2; A.group.position.set(x, H(x, z), z); A.group.rotation.y = hash01(i, 9) * 6; g.add(A.group); }

  // the ark
  const ark = buildArk(); const arkG = ark.root; arkG.rotation.y = ARKSET.rotY; g.add(arkG);
  // the flood: low water spreading over the plain (gentle waves), only in S12
  const wGeo = new THREE.PlaneGeometry(700, 700, 90, 90).rotateX(-Math.PI / 2);
  const wBase = wGeo.attributes.position.array.slice();
  const water = new THREE.Mesh(wGeo, new THREE.MeshStandardMaterial({ color: '#33464f', roughness: 0.16, metalness: 0.15, transparent: true, opacity: 0.94, flatShading: true }));
  water.receiveShadow = true; g.add(water);

  // people
  const noah = new Person({ ...NOAH_OLD }); noah.root.position.set(...ARKSET.noah); g.add(noah.root);
  const meth = new Person({ ...METHUSELAH_OLD, quality: 'main' }); meth.root.position.set(mx + 0.3, H(mx + 0.3, mz), mz); g.add(meth.root);
  const crowd = Array.from({ length: 9 }, (_, i) => { const p = new Person(crowdMember(i)); g.add(p.root); return p; });
  // crowd blocking: walkers along the road (each "year" a different group) and a few who stop to point and laugh
  const C = crowd.map((p, i) => ({ p, speed: 1.1 + 0.35 * hash01(i, 3), dir: i % 3 === 1 ? -1 : 1, off: hash01(i, 4) * 40, stopX: i % 3 === 2 ? -4 + 10 * hash01(i, 5) : null, z: ARKSET.crowdZ - 0.8 + 1.6 * hash01(i, 6), seed: 4100 + i }));
  const lamp = makeOilLamp({ scale: 1.6, seed: 9 }); lamp.group.position.set(ARKSET.noah[0] - 1.0, 0.62, ARKSET.noah[2] + 0.3); g.add(lamp.group);
  const crate = makeBevelBox(0.6, 0.6, 0.5, '#6a4a2e', { bevel: 0.03 }); crate.position.set(ARKSET.noah[0] - 1.0, 0.3, ARKSET.noah[2] + 0.3); g.add(crate);
  const n600 = makeGoldNumber('600', { renderer: ctx.world.gl, size: 0.66 }); g.add(n600.group, n600.fx);
  const _c = new THREE.Color();

  return {
    group: g, persons: [noah, meth, ...crowd], heightAt: (x, z) => Math.max(H(x, z), water.visible ? water.position.y : -99),
    update(t, cam, shot) {
      const id = shot.id, s11 = isS11(id), s12 = id === 'S12';
      // the hull
      const p = B.progress(t);
      ark.set({ progress: p, pitch: smooth(invLerp(0.86, 1, p)) * 0.7, door: s12 ? 0 : 1, scaffold: p < 0.985 && !s12, ladderOn: p < 0.985 && !s12 });
      const lift = s12 ? B.lift(t) : 0;
      arkG.position.y = lift + (lift > 0 ? 0.08 * Math.sin(t * 1.3) : 0); arkG.rotation.z = lift > 0 ? 0.012 * Math.sin(t * 0.9) : 0;
      // seasons (S11): tint vegetation + ground
      const sk = s11 ? 1 - Math.abs(((B.season(t) % 1) + 1) % 1 * 2 - 1) : 0;
      for (const m of veg) m.material.color.copy(m.userData.base).multiply(_c.copy(GREEN).lerp(DRY, sk));
      grass.material.color.copy(GREEN).lerp(DRY, sk * 1.1); terr.material.color.copy(GREEN).lerp(_c.set('#f2dcb0'), sk * 0.6);
      // water (S12)
      water.visible = s12;
      if (s12) {
        const wl = B.water(t); water.position.y = wl;
        const pos = wGeo.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) { const x = wBase[i], z = wBase[i + 2]; pos[i + 1] = 0.12 * Math.sin(x * 0.35 + t * 1.6) * Math.sin(z * 0.28 - t * 1.1) + 0.05 * Math.sin(x * 1.1 - t * 2.3); }
        wGeo.attributes.position.needsUpdate = true; wGeo.computeVertexNormals();
      }
      // Noah: S7 standing with his hammer by the hull; S11 hammering (looks up in S11c); inside the ark in S12
      noah.root.visible = !s12 && id !== 'S11a' ? true : id === 'S11a';
      if (s12) noah.root.visible = false;
      noah.setFacing(1);
      if (id === 'S7') { const P = Poses.idle(t, 600); expr(P, 'kind', 0.8); P.look = 0.6 * smooth(invLerp(E.n600 + 0.2, E.n600 + 0.7, t)); noah.pose(P); }
      else if (id === 'S11c') { const P = Poses.lookUp(t, 600, 0.6); expr(P, 'peace', 1); noah.pose(P); }
      else noah.pose(Poses.hammer(t, 600, 0.9));
      const NP = s11 ? ARKSET.noahWork : ARKSET.noah; noah.root.position.set(NP[0], H(NP[0], NP[2]), NP[2]);
      // Methuselah on his hill, every year (S11)
      meth.root.visible = s11; meth.setFacing(1); meth.pose(Poses.oldStand(t, 969, 0.15));
      // the crowd (S11a, S11b)
      const crowdOn = id === 'S11a' || id === 'S11b';
      C.forEach((c, i) => {
        c.p.root.visible = crowdOn;
        if (!crowdOn) return;
        let x = ((c.off + t * c.speed * 2.2) % 50) - 25; if (c.dir < 0) x = -x;
        if (c.stopX != null) { x = c.stopX; c.p.setFacing(c.z > ARKSET.crowdZ ? -1 : 1); c.p.root.position.set(x, H(x, c.z), c.z); c.p.pose(Poses.pointLaugh(t, c.seed)); return; }
        c.p.root.position.set(x, H(x, c.z), c.z); c.p.setFacing(c.dir);
        const P = Poses.walk(t, c.seed, 1.1, 1); if (i % 2 === 0) { expr(P, 'laugh', 0.8); P.handF = 'point'; P.aF = [1.3, 0.1, 0]; } c.p.pose(P);
      });
      for (const q of [noah, meth, ...crowd]) if (q.root.visible) { q.billboard(cam, 0.3); q.autoOutline(cam); }
      lamp.group.visible = crate.visible = id === 'S7';
      if (id === 'S7') lamp.set(t, 0.9, cam);
      if (id === 'S7') n600.rise(t - E.n600, { pos: ARKSET.number, t, groundY: 0.02 }); else { n600.group.visible = false; n600.quiet(); }
    },
    mood(t, shot) {
      const id = shot.id;
      if (id === 'S7') {
        return merge(MOODS.mathDark, {
          sky: { top: '#1a1630', horizon: '#c0684a', bottom: '#2a1a12', band: '#6a2e24', sunGlow: '#ff8a4a', stars: 0.4 },
          sunDir: [0.75, 0.16, 0.55], sun: { color: '#ff9a5a', intensity: 1.6 },
          hemi: { sky: '#5a4a6a', ground: '#2a1a10', intensity: 0.65 }, fog: { color: '#3a2620', density: 0.004 },
          char: '#b0a2a8',
          point: lamp.light(t, 0.9),
          post: { dof: 0.3, focusRange: 2.2, ao: 0.5, tilt: 0.15 },
        });
      }
      if (isS11(id)) {
        const a = B.sunAngle(t);
        const M = merge(seasonMood(B.season(t)), { sky: { top: '#6f9cc0', horizon: '#ecd9ae', bottom: '#b9a578' } });
        return merge(M, {
          sunDir: [Math.cos(a) * 0.8, 0.5 + 0.22 * Math.abs(Math.sin(a * 0.5)), Math.sin(a) * 0.55 - 0.35],
          sky: { cloudSpeed: 14, clouds: 0.45 }, wind: 1.6, char: '#fff4e4', fog: { density: 0.0035, color: '#c3d0da', max: 0.3 },
          post: { haze: 0.07, exposure: 0.92, tilt: id === 'S11b' ? 0.3 : 0.45, tiltBottom: 0.1, ao: 0.45, vignette: 0.36, grain: 0.024, bloom: 0.35 },
        });
      }
      if (id === 'S12') {
        const age = t - E.floodCrack, Ek = crackEnv(age), cpos = [-30, 62, -380];
        return merge(MOODS.storm, {
          sky: { crack: { age, pos: cpos, size: 300 }, top: '#3a4250', horizon: '#7a828c', bottom: '#2c3036', stormLit: '#6a7480' }, fog: { density: 0.006, color: '#5a626c' }, sun: { intensity: 1.2 }, hemi: { intensity: 1.1 },
          rain: { k: rainRamp(t, E.floodRain, E.floodRain + 1.2, { drizzle: 0.3 }), sheets: 1, splash: 0.5, wind: [3.0, 0.6], color: '#b9c2cc', far: 120 }, wet: smooth(invLerp(E.floodRain, E.floodRain + 1.5, t)),
          post: { exposure: 1.55, godrays: { pos: cpos, strength: 0.9 * Ek.glow, color: '#fff1d0', radius: 0.22, decay: 0.975, density: 0.95, streaks: 0.85 }, tilt: 0.2, ao: 0.4 },
        });
      }
      return MOODS.dayWarm;
    },
  };
}
