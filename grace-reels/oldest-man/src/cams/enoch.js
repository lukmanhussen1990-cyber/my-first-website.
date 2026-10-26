// Camera + blocking for the 'enoch' set (S3): golden morning, Enoch walks the worn path into a soft beam of light
// and is gone on "took"; his footprints stop there; young Methuselah watches from a doorway.
// World coords via H.at('enoch', [x,y,z]). ENOCH holds the shared layout (set, camera and anchors use it).

export const ENOCH = {
  path: [[-16, 11], [-9, 6.5], [-4, 3], [-0.5, 0.5], [2.4, -2.2], [4.5, -4.5]],
  beam: [2.8, -3.2],
  house: { pos: [-7, -3.2], rotY: 0.35 },
  speed: 0.95,                      // m/s, a calm unhurried walk
};

// arc length along the path -> [x, z, dirX]
const SEG = (() => { const out = []; let L = 0; const P = ENOCH.path; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); out.push([L, l]); L += l; } return out; })();
export function along(s) {
  const P = ENOCH.path;
  for (let i = 0; i < SEG.length; i++) {
    if (s <= SEG[i][0] + SEG[i][1] || i === SEG.length - 1) {
      const u = Math.max(0, Math.min(1, (s - SEG[i][0]) / SEG[i][1]));
      return [P[i][0] + (P[i + 1][0] - P[i][0]) * u, P[i][1] + (P[i + 1][1] - P[i][1]) * u, Math.sign(P[i + 1][0] - P[i][0]) || 1];
    }
  }
  return [P[P.length - 1][0], P[P.length - 1][1], 1];
}
// arc length of the beam's foot on the path (closest path point)
export const S_BEAM = (() => { let best = 0, bd = 1e9; for (let s = 0; s < 40; s += 0.02) { const [x, z] = along(s); const d = Math.hypot(x - ENOCH.beam[0], z - ENOCH.beam[1]); if (d < bd) { bd = d; best = s; } } return best; })();

export function blocking(plan, H) {
  const E = plan.ev;
  const arrive = E.enochGone - 0.35;           // he steps into the light just before "took"
  return {
    // Enoch's arc length along the path (stops in the light)
    enochS: (t) => S_BEAM - Math.max(0, arrive - t) * ENOCH.speed,
    walking: (t) => t < arrive,
    // 0..1: the light takes him (glow to white), then he is gone
    glow: (t) => H.smooth(H.invLerp(arrive - 0.1, E.enochGone + 0.02, t)),
    gone: (t) => t >= E.enochGone + 0.05,
  };
}

export function camera(plan, B, shot, t, H) {
  const E = plan.ev, lt = t - shot.t0;
  // high, long-lens diorama view (tilt-shift); a slow push and a slight pan that follows him to the light
  const k = H.easeInOut(H.clamp(lt / (shot.t1 - shot.t0)));
  const look = H.at('enoch', [H.lerp(-1.7, -0.5, k), 1.4, H.lerp(-1.0, -2.0, k)]);
  const dist = 48 - 6 * k;
  return { pos: H.sph(look, -0.24 + 0.06 * k, 0.3 - 0.02 * k, dist), look, fov: 22, focus: dist };
}

// overlay label anchors (world points)
const enochAt = (plan, B, t, H) => { const [x, z] = along(B.enochS(t)); return H.at('enoch', [x, 2.0, z]); };
export const anchors = {
  enoch: enochAt,
  light: (plan, B, t, H) => H.at('enoch', [ENOCH.beam[0], 4.5, ENOCH.beam[1]]),
  doorway: (plan, B, t, H) => H.at('enoch', [-5.2, 2.2, -1.6]),
};
