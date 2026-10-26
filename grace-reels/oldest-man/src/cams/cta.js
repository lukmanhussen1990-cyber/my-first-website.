// Camera + blocking for the 'cta' set (S14): a dark warm studio with two objects on pedestals — a pair of dice
// (COINCIDENCE, left) that tumble in on "Coincidence…" and a golden hourglass (TIMING, right) that glows on "timing".
// World coords via H.at('cta', [x,y,z]). CTA holds the shared layout.

export const CTA = {
  dice: [-0.62, 0.7, 0.05],        // pedestal top (left)
  glass: [0.62, 0.7, -0.05],       // pedestal top (right)
  glassH: 0.62,
};

export function blocking(plan, H) { return {}; }

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, k = H.easeInOut(H.clamp(lt / (shot.t1 - shot.t0)));
  const look = H.at('cta', [0, 0.78 - 0.04 * k, 0]);
  const dist = 7.4 - 1.0 * k;
  return { pos: H.sph(look, 0.08 - 0.1 * k, 0.12, dist), look, fov: 26, focus: dist };
}

// overlay anchors: just under each object (the overlay hangs the words COINCIDENCE / TIMING there)
export const anchors = {
  dice: (plan, B, t, H) => H.at('cta', [CTA.dice[0], 0.45, CTA.dice[2] + 0.2]),
  hourglass: (plan, B, t, H) => H.at('cta', [CTA.glass[0], 0.45, CTA.glass[2] + 0.2]),
};
