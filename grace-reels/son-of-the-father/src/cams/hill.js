// Camera + blocking for the 'hill' set: S1 (push-in), S2 (face close-up), S8 (the 969 slam over the lamp),
// S9 (lamp macro: the flame dies, one giant raindrop), S10 (the cold lamp and the cane, first rain), LOOP (= S1 at t 0).
// World coords via H.at('hill', [x,y,z]). HILL holds the shared layout (the set and the overlay anchors use it too).
import { camShake, slamCurve } from '../three/gold.js';

export const HILL = {
  seat: [-0.1, 0, 0],              // Methuselah sits here (rock seat), facing +x toward his lamp
  head: [0.2, 1.08, 0.02],         // his head while seated (sitOld, hunched)
  lampStone: [0.85, 0.02, 0.38],
  lamp: [0.85, 0.13, 0.38], lampScale: 1.7, lampRot: 0.4,
  flame: [1.03, 0.2, 0.31],        // flame tip (lamp + rotated spout)
  drop: [0.66, 0.024, 0.78],       // where the giant raindrop lands (dry cracked ground in front of the lamp)
  n969: [0.95, 0.5, -0.9],         // the slammed 969 hangs here, over the lamp (baseline centre)
  slots: { n187: [0.28, 0, -3.0], n182: [1.62, 0, -3.0], n600: [0.95, 0, -3.5] },
  ark: [-40, -7.6, -150], arkRot: 0.62,
};

export function blocking(plan, H) {
  const E = plan.ev;
  return {
    // Methuselah is on the hill until the lamp goes out (S9 is a macro without him); he is back for the loop
    methuselahOn: (t) => t < E.lampOut - 2.2 || t >= E.loopBack - 0.05,
  };
}

const flameW = (H) => H.at('hill', HILL.flame);

export function camera(plan, B, shot, t, H) {
  const E = plan.ev, lt = t - shot.t0;
  const at = (p) => H.at('hill', p);
  switch (shot.id) {
    case 'S1': case 'LOOP': {
      // one continuous slow push-in; the LOOP shot ends exactly on S1's first frame (u -> 0 at the end of the reel)
      const u = shot.id === 'LOOP' ? t - plan.dur : lt;
      const look = at([0.22, 1.62 - 0.03 * u, 0.05]);
      const dist = 10.4 - 0.62 * u + 0.012 * u * u;
      return { pos: H.sph(look, 0.4 - 0.016 * u, 0.075 + 0.004 * u, dist), look, fov: 30, focus: dist };
    }
    case 'S2': {
      // close-up of his face in the lamplight: slow drift + creep in, head ~55 % of the frame width
      const head = at(HILL.head);
      const look = [head[0] + 0.03, head[1] + 0.07, head[2]];
      const dist = 1.42 - 0.035 * lt;
      return { pos: H.sph(look, 0.52 + 0.022 * lt, 0.03 + 0.006 * lt, dist), look, fov: 30, focus: dist };
    }
    case 'S8': {
      // medium: Methuselah left, the guttering lamp right, the numbers rise behind and slam into 969 over the lamp
      const look = at([0.95, 0.78 + 0.008 * lt, -0.7]);
      const dist = 5.9 - 0.12 * lt;
      const pos = H.sph(look, -0.02 + 0.012 * lt, 0.09, dist);
      const S = slamCurve(t - E.slam), K = camShake(t, S.shake || 0, { amp: 0.05 });
      return { pos: H.add(pos, K.pos), look: H.add(look, K.look), roll: K.roll, fov: 30, focus: dist + 0.35 };
    }
    case 'S9': {
      // macro on the flame; after it dies the camera sinks toward the cracked ground where the drop will land
      const f = flameW(H), d = at(HILL.drop);
      const k = H.easeInOut(H.clamp(H.invLerp(E.lampOut + 0.4, E.dropFall + 0.2, t)));
      const look = H.mixv([f[0] - 0.02, f[1] + 0.02, f[2]], [d[0], d[1] + 0.06, d[2]], k);
      const dist = H.lerp(2.3 - 0.15 * Math.min(lt, 2), 1.3, k);
      return { pos: H.sph(look, 0.34 - 0.04 * k, H.lerp(0.14, 0.32, k), dist), look, fov: 30, focus: dist, locked: true };
    }
    case 'S10': {
      // the empty seat: the cold lamp, the cane against the rock; first rain; the far ark under the storm
      const look = at([0.25, 0.62, 0.05]);
      const dist = 6.2 + 0.09 * lt;
      return { pos: H.sph(look, 0.2 - 0.018 * lt, 0.12, dist), look, fov: 30, focus: dist };
    }
    default: { const look = at([0.2, 1, 0]); return { pos: H.sph(look, 0.4, 0.1, 9), look, fov: 30 }; }
  }
}

// overlay label anchors (world points); the overlay calls anchorAt(plan, 'hill', name, t)
export const anchors = {
  methuselahHead: (plan, B, t, H) => H.at('hill', [HILL.head[0], HILL.head[1] + 0.12, HILL.head[2]]),
  lamp: (plan, B, t, H) => H.at('hill', HILL.flame),
  n969: (plan, B, t, H) => H.at('hill', [HILL.n969[0], HILL.n969[1] + 0.5, HILL.n969[2]]),
  sky: (plan, B, t, H) => H.at('hill', [-3.5, 5.5, -26]),
};
