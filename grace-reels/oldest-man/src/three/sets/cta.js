// 'cta' set (S14): a dark warm studio, two pedestals under soft spotlights. Left: a pair of low-poly dice tumble in
// on "Coincidence…" and come to rest. Right: a golden hourglass whose sand runs, and which glows warm on "timing".
// The overlay adds the words COINCIDENCE / TIMING (anchors in src/cams/cta.js) and the comment box with hearts.
import * as THREE from 'three';
import { makeBevelBox, makeStone } from '../kit.js';
import { makeMotes } from '../fx.js';
import { MOODS, merge } from '../moods.js';
import { clamp, smooth, invLerp, lerp, easeOut, hash01 } from '../../lib/util.js';
import { CTA } from '../../cams/cta.js';

const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
function makeDie(s = 0.2, seed = 1) {
  const g = new THREE.Group();
  const body = makeBevelBox(s, s, s, '#f1e8d8', { bevel: s * 0.16, lum: 0.03, seed }); g.add(body);
  body.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const pipMat = new THREE.MeshLambertMaterial({ color: '#2a1a12' });
  const pipGeo = new THREE.CircleGeometry(s * 0.085, 10);
  // faces: +y 1, -y 6, +x 3, -x 4, +z 2, -z 5 (opposite faces sum to 7)
  const faces = [[1, [0, 1, 0]], [6, [0, -1, 0]], [3, [1, 0, 0]], [4, [-1, 0, 0]], [2, [0, 0, 1]], [5, [0, 0, -1]]];
  const q = new THREE.Quaternion(), z = new THREE.Vector3(0, 0, 1);
  for (const [n, nrm] of faces) {
    const N = new THREE.Vector3(...nrm); q.setFromUnitVectors(z, N);
    for (const [u, v] of PIPS[n]) {
      const p = new THREE.Mesh(pipGeo, pipMat);
      const off = new THREE.Vector3(u * s * 0.25, v * s * 0.25, s * 0.502).applyQuaternion(q);
      p.position.copy(off); p.quaternion.copy(q); g.add(p);
    }
  }
  return g;
}

function makeHourglass() {
  const g = new THREE.Group(), Hh = CTA.glassH;
  const gold = new THREE.MeshStandardMaterial({ color: '#c99a42', metalness: 0.75, roughness: 0.32 });
  const wood = new THREE.MeshLambertMaterial({ color: '#6a4426', flatShading: true });
  for (const y of [0.02, Hh - 0.02]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.04, 14), wood); cap.position.y = y; cap.castShadow = true; g.add(cap);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), gold); rim.rotation.x = Math.PI / 2; rim.position.y = y; g.add(rim);
  }
  for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, Hh - 0.04, 6), gold); p.position.set(Math.cos(a) * 0.178, Hh / 2, Math.sin(a) * 0.178); p.castShadow = true; g.add(p); }
  const prof = [[0.01, 0.04], [0.11, 0.07], [0.15, 0.14], [0.13, 0.23], [0.03, 0.3], [0.03, 0.32], [0.13, 0.39], [0.15, 0.48], [0.11, 0.55], [0.01, 0.58]].map(([r, y]) => new THREE.Vector2(r, y * Hh / 0.62));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), new THREE.MeshStandardMaterial({ color: '#dfeaf0', transparent: true, opacity: 0.2, roughness: 0.06, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  glass.renderOrder = 5; g.add(glass);
  const sandMat = new THREE.MeshStandardMaterial({ color: '#e2b35c', roughness: 0.8, emissive: '#ff9a3a', emissiveIntensity: 0 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.02, 1, 18), sandMat); g.add(top);
  const pile = new THREE.Mesh(new THREE.ConeGeometry(0.135, 1, 18), sandMat); g.add(pile);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 5), sandMat); g.add(stream);
  const neck = 0.31 * Hh / 0.62;
  return {
    group: g, sandMat,
    set(t, run, glow) {
      // run 0..1: share of the sand already fallen (the top cone shrinks, the pile grows)
      const th = lerp(0.2, 0.06, run) * Hh / 0.62, ph = lerp(0.03, 0.17, run) * Hh / 0.62;
      top.scale.set(lerp(1, 0.62, run), th, lerp(1, 0.62, run)); top.position.y = neck + 0.03 + th / 2;
      pile.scale.set(lerp(0.55, 1, run), ph, lerp(0.55, 1, run)); pile.position.y = 0.055 + ph / 2;
      const s0 = 0.055 + ph, s1 = neck + 0.01; stream.scale.y = Math.max(0.001, s1 - s0); stream.position.y = (s0 + s1) / 2;
      stream.position.x = 0.0015 * Math.sin(t * 23);
      sandMat.emissiveIntensity = 2.6 * glow;
    },
  };
}

export function build(ctx) {
  const { plan } = ctx; const E = plan.ev;
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#2c1d13' })); floor.receiveShadow = true; g.add(floor);
  // a soft curved backdrop (cyclorama) so the dark studio has depth
  const cyc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 10, 48, 1, true, Math.PI * 0.75, Math.PI * 1.5), new THREE.MeshLambertMaterial({ color: '#24170f', side: THREE.BackSide }));
  cyc.position.set(0, 5, 1); g.add(cyc);
  const pedMat = new THREE.MeshLambertMaterial({ color: '#4a3323', flatShading: true });
  for (const p of [CTA.dice, CTA.glass]) {
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, p[1], 8), pedMat); ped.position.set(p[0], p[1] / 2, p[2]); ped.castShadow = true; ped.receiveShadow = true; g.add(ped);
    const lip = makeBevelBox(0.8, 0.05, 0.8, '#5a3e2a', { bevel: 0.02 }); lip.position.set(p[0], p[1] + 0.005, p[2]); lip.rotation.y = Math.PI / 8; g.add(lip);
  }
  for (let i = 0; i < 6; i++) { const s = makeStone(0.08 + 0.06 * hash01(i, 3), { seed: 50 + i, color: '#3a2a1e', sink: 0.3 }); const a = i * 1.1, r = 1.6 + 0.6 * hash01(i, 4); s.position.set(Math.cos(a) * r, 0.01, Math.sin(a) * r - 0.6); g.add(s); }
  const dice = [makeDie(0.2, 1), makeDie(0.2, 2)]; for (const d of dice) g.add(d);
  const glass = makeHourglass(); glass.group.position.set(CTA.glass[0], CTA.glass[1] + 0.03, CTA.glass[2]); glass.group.rotation.y = 0.3; g.add(glass.group);
  const motes = makeMotes(90, 17); g.add(motes.group);
  const _o = new THREE.Vector3();
  // the dice: fall from above, tumble, bounce twice and rest (pure functions of t)
  const DIE = [
    { x: CTA.dice[0] - 0.13, z: CTA.dice[2] + 0.06, t0: E.dice - 0.32, rest: [0, 0.5, 0], spin: [7.2, 2.1, 5.3] },
    { x: CTA.dice[0] + 0.14, z: CTA.dice[2] - 0.08, t0: E.dice - 0.22, rest: [Math.PI / 2, -0.35, 0], spin: [-6.1, 3.3, -4.4] },
  ];
  const glowK = (t) => smooth(invLerp(E.hourglass - 0.15, E.hourglass + 0.5, t));

  return {
    group: g, persons: [],
    update(t) {
      DIE.forEach((D, i) => {
        const d = dice[i], a = t - D.t0, fall = 0.42, top = CTA.dice[1] + 0.1 + 0.005;
        if (a < 0) { d.visible = false; return; }
        d.visible = true;
        let y; if (a < fall) y = lerp(2.4, top, (a / fall) ** 2);
        else { const b = a - fall; y = top + 0.16 * Math.abs(Math.sin(b * 9)) * Math.exp(-b * 6.5); }
        const settle = clamp((a - fall) / 0.75), w = (1 - easeOut(settle)) * (a < fall ? 1 : 0.4) + (a < fall ? 0 : 0);
        const spinK = a < fall ? (1 - a / fall) * 0.8 + 0.2 : (1 - easeOut(settle)) * 0.2;
        d.position.set(D.x + 0.05 * (1 - settle) * (i ? 1 : -1), y, D.z);
        d.rotation.set(D.rest[0] + D.spin[0] * spinK, D.rest[1] + D.spin[1] * spinK, D.rest[2] + D.spin[2] * spinK);
        void w;
      });
      const shotLen = 4.4;
      glass.set(t, clamp(0.35 + 0.15 * (t - (E.cta)) / shotLen), glowK(t));
      g.getWorldPosition(_o);
      motes.set(t, [_o.x, _o.y + 1.6, _o.z], [3.2, 2.6, 2], 0.9, [1.0, 0.82, 0.55], 0.012);
    },
    mood(t) {
      const gk = glowK(t);
      const gp = [CTA.glass[0], CTA.glass[1] + 0.3, CTA.glass[2]];
      return merge(MOODS.ctaDark, {
        sunDir: [-0.45, 0.75, 0.5], sun: { color: '#ffd8a8', intensity: 0.9 },
        hemi: { sky: '#5a4030', ground: '#140e0a', intensity: 0.5 },
        spot: { pos: [0.0, 5.2, 2.6], target: [0, 0.7, 0], color: '#ffd9a8', intensity: 55, angle: 0.42, penumbra: 0.75, decay: 2, distance: 18, shadow: true },
        point: { pos: gp, color: '#ffb257', intensity: 9 * gk, distance: 4.5, charColor: '#ffbf75', charK: 0.6, charRange: 2 },
        post: { bloom: 0.9 + 0.6 * gk, dof: 0.25, focusRange: 2.5, vignette: 0.62, tilt: 0 },
      });
    },
  };
}
