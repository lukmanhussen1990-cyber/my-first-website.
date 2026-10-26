// LAB set (lighting/graphics test bench, NOT part of the reel). Built lazily on first use so registering it
// costs nothing for other renders. One station per lab shot (see src/cams/_lab.js), 400 m apart on x.
import * as THREE from 'three';
import { matte } from '../materials.js';
import { makeTerrain, makeRock, srgb, mixc } from '../kit.js';
import { makeOilLamp } from '../lamp.js';
import { MOODS, merge } from '../moods.js';
import { Person, Poses, HAIR, CLOTH } from '../rig.js';
import { buildArk } from '../arkmodel.js';
import { fbm, clamp, smooth, invLerp } from '../../lib/util.js';

// bench configs by whole second of local time (pass timing comparisons)
const BENCH = [
  { aa: 'none' }, { aa: 'none', copytest: 1 }, { aa: 'fxaa' }, { aa: 'smaa' }, { aa: 'smaa', supersample: 1.5 }, { aa: 'none', ao: 0.8 },
  { aa: 'none', godrays: { strength: 1, pos: [0, 30, -40] } }, { aa: 'none', tonemap: 'agx' }, { aa: 'none', fogD: 1 }, { aa: 'none', tilt: 0, dof: 0 },
  { aa: 'none', noSky: 1 }, { aa: 'none', noShadow: 1 }, { aa: 'none', noGround: 1 }, { aa: 'none', msaa: 0 }, { aa: 'none', noSky: 1, noGround: 1 },
];
const X = { night: 0, beam: 400, rain: 800, storm: 1200, gold: 1600, drop: 2000, wide: 2400, face: 2800, bench: 3200 };

function person(o) { try { return new Person(o); } catch (e) { console.log('[lab] Person failed', e.message); return null; } }

// ---------------------------------------------------------------- night: lamp, stars, clouds, AO
function stationNight(root) {
  const g = new THREE.Group(); g.position.x = X.night; root.add(g);
  const H = (x, z) => 0.5 * fbm(x * 0.05, z * 0.05, 3, 4) * Math.min(1, Math.hypot(x, z) / 8) - Math.max(0, -z - 30) * 0.02;
  const ground = makeTerrain({ size: 900, seg: 160, height: H, color: (x, z, y) => mixc(srgb('#55603a'), srgb('#6f6a44'), clamp(0.5 + fbm(x * 0.2, z * 0.2, 2, 9))) });
  g.add(ground);
  const seat = makeRock(0.42, 3, '#7b7366'); seat.position.set(-0.1, 0.12, 0); seat.scale.set(1.2, 0.75, 1); g.add(seat);
  const stone = makeRock(0.22, 8, '#857b6c'); stone.position.set(0.85, 0.05, 0.38); stone.scale.set(1.3, 0.5, 1.1); g.add(stone);
  const lamp = makeOilLamp({ scale: 1.7 }); lamp.group.position.set(0.85, 0.15, 0.38); lamp.group.rotation.y = 0.4; g.add(lamp.group);
  const m = person({ seed: 11, height: 1.62, age: 'old', hair: 'wrap', wrap: '#cfc4ae', hairColor: HAIR.white, beard: 'long', beardColor: HAIR.white, cloth: CLOTH.indigo, belt: '#b89a62', skin: '#a2693d', outfit: 'robe' });
  if (m) { m.root.position.set(-0.1, 0, 0); g.add(m.root); }
  for (let i = 0; i < 9; i++) { const r = makeRock(0.12 + 0.1 * ((i * 37) % 7) / 7, 20 + i, '#6d665c'); r.position.set(-3 + (i * 1.37) % 6.5, 0.04, -1.5 + ((i * 2.3) % 4)); g.add(r); }
  const ark = buildArk(); ark.set?.({ progress: 1 }); const arkG = ark.group || ark.root || ark; arkG.position.set(-38, 0, -150); arkG.rotation.y = 0.5; arkG.scale.setScalar(0.9); g.add(arkG);
  return {
    g,
    update(t, cam) {
      if (m) { m.setFacing(1); m.pose(Poses.sit(t, 11, 0.42)); m.billboard(cam, 0.3); m.autoOutline(cam); }
      lamp.set(t, 0.9, cam);
    },
    mood(t) {
      return merge(MOODS.nightLamp, { sky: { cloudDir: -0.42, cloudArc: 1.0 }, point: lamp.light(t, 0.9), post: { profile: true, focus: 9.5, dof: 0.35, focusRange: 3 } });
    },
  };
}

// ---------------------------------------------------------------- bench: pass timing configs
function stationBench(root, ctx) {
  const g = new THREE.Group(); g.position.x = X.bench; root.add(g);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), matte('#9a8058')); ground.receiveShadow = true; g.add(ground);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), matte('#c99a3a')); box.position.y = 1; box.castShadow = true; g.add(box);
  return {
    g,
    update(t, cam, shot) {
      const B = BENCH[Math.floor(t - shot.t0) % BENCH.length];
      ctx.world.sky.visible = !B.noSky; ctx.world.sun.castShadow = !B.noShadow; ground.visible = !B.noGround;
    },
    mood(t, shot) {
      const B = { ...BENCH[Math.floor(t - shot.t0) % BENCH.length] };
      const fog = B.fogD ? { density: 0.02, height: 6 } : {}; for (const k of ['fogD', 'noSky', 'noShadow', 'noGround']) delete B[k];
      return { fog, post: { profile: true, ...B } };
    },
  };
}

function buildAll(ctx, root) {
  const S = { night: stationNight(root), bench: stationBench(root, ctx) };
  const pick = (shot) => S[shot.station] || S.bench;
  return {
    update(t, cam, shot, c, M) {
      ctx.world.sky.visible = true; ctx.world.sun.castShadow = true;
      for (const s of Object.values(S)) s.g.visible = s === pick(shot);
      pick(shot).update(t, cam, shot, c, M);
    },
    mood(t, shot, c) { return pick(shot).mood(t, shot, c); },
  };
}

export function build(ctx) {
  const g = new THREE.Group(); let B = null;
  const ensure = () => (B || (B = buildAll(ctx, g)));
  return {
    group: g, persons: [],
    update(t, cam, shot, c, M) { ensure().update(t, cam, shot, c, M); },
    mood(t, shot, c) { return ensure().mood(t, shot, c); },
  };
}
