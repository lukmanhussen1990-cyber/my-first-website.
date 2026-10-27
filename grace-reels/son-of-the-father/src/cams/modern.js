// Camera + blocking for the 'modern' set (S14b): the match cut on "you" — the same pose and silhouette as Barabbas at
// the gate, now a person in a hoodie alone under a streetlight on a city street at night. Warm light falls on them
// from above (God shown only as light) on "So am I", and they look up. World coords via H.at('modern', p).

export const MODERN = {
  person: [-1.4, 0.15, -4.7],      // on the far sidewalk (kerb height 0.15)
  lamp: [-0.7, 0.15, -5.5],        // their streetlight
  lampH: 5.2,
};

export function blocking(plan, H) {
  const E = plan.ev;
  return { warm: (t) => H.smooth(H.invLerp(E.warmLight - 0.15, E.warmLight + 1.4, t)) };
}

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, len = shot.t1 - shot.t0, k = H.easeInOut(H.clamp(lt / len));
  const P = MODERN.person;
  // starts exactly where S14a ends (head close-up, same angle), then eases back as the warm light falls
  const look = H.at('modern', [P[0], P[1] + 1.56 + 0.1 * k, P[2] + 0.05]);
  const dist = H.lerp(1.75, 3.6, k);
  return { pos: H.sph(look, 1.47 - 0.04 * k, 0.0 + 0.05 * k, dist), look, fov: 30, focus: dist };
}

export const anchors = {
  person: (plan, B, t, H) => H.at('modern', [MODERN.person[0], MODERN.person[1] + 1.95, MODERN.person[2]]),
};
