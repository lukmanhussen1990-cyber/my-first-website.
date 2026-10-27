// 'cta' set (S15): dark warm call to action. The open iron shackles and their chain lie on old paving stones in a
// warm pool of light (he walked free); dust floats in the beam; the stone fades to darkness around them.
import * as THREE from 'three';
import { makeStone } from '../kit.js';
import { makePavement, makeShackles, makeStraw } from '../jerusalem.js';
import { makeMotes } from '../fx.js';
import { MOODS, merge } from '../moods.js';
import { hash01 } from '../../lib/util.js';
import { CTA } from '../../cams/cta.js';

export function build(ctx) {
  const g = new THREE.Group();
  g.add(makePavement({ x0: -6, x1: 6, z0: -6, z1: 6, sw: 0.9, sd: 0.62, seed: 31 }));
  for (let i = 0; i < 7; i++) { const s = makeStone(0.05 + 0.05 * hash01(i, 3), { seed: 60 + i, color: '#8a7658', sink: 0.35 }); const a = i * 0.9 + 0.3, r = 0.7 + 0.5 * hash01(i, 4); s.position.set(Math.cos(a) * r, 0.0, Math.sin(a) * r); g.add(s); }
  g.add(makeStraw(70, { area: [-1.4, -1.1, 1.4, 1.1], seed: 9 }));
  // the shackles lying open: settled pose of the same falling rig
  const sh = makeShackles({ links: 22, sag: 0.34 }); g.add(sh.group);
  const a0 = new THREE.Vector3(-0.2, 0.9, 0.05), b0 = new THREE.Vector3(0.22, 0.88, -0.04);
  sh.fall(5, a0, b0, { groundY: 0.0, toCam: new THREE.Vector3(0.3, 0, 1).normalize() });
  sh.cuffs[0].rotation.set(0.25, 0.4, 0.15); sh.cuffs[1].rotation.set(-0.2, 1.3, -0.1);
  sh.cuffs[0].position.y = 0.035; sh.cuffs[1].position.y = 0.035;
  const motes = makeMotes(110, 23); g.add(motes.group);
  const _o = new THREE.Vector3();
  return {
    group: g, persons: [],
    update(t) {
      g.getWorldPosition(_o);
      motes.set(t, [_o.x, _o.y + 0.1, _o.z], [2.4, 2.2, 2.0], 1.0, [1.0, 0.84, 0.55], 0.012);
    },
    mood() {
      return merge(MOODS.ctaDark, {
        sunDir: [-0.35, 0.85, 0.4], sun: { color: '#ffd8a8', intensity: 0.35 },
        hemi: { sky: '#4a3020', ground: '#120c08', intensity: 0.3 },
        fog: { color: '#120b07', near: 2.5, far: 9 },
        spot: { pos: [0.4, 4.2, 1.0], target: [0, 0, 0], color: '#ffcf95', intensity: 42, angle: 0.36, penumbra: 0.8, decay: 2, distance: 12, shadow: true },
        post: { exposure: 1.05, bloom: 0.9, bloomThreshold: 0.82, vignette: 0.72, dof: 0.6, focusRange: 0.5, tilt: 0, grain: 0.03, sat: 0.95, split: 0.32, splitShadow: '#2a1810', splitHigh: '#ffc880', ao: 0.55, aoRadius: 0.2 },
      });
    },
  };
}
