// Camera + blocking for the 'city' set (S13a, S13b): match cut from the rain on the ark to rain on a modern low-poly
// city at night (same art style). One person stands alone under a streetlight, head down; on "…but FOR you" the rain
// slows and a soft warm light falls on them from above; they look up. S13b keeps the upper middle calm for the
// 2 Peter 3:9 card. World coords via H.at('city', [x,y,z]). CITY = shared layout.

export const CITY = {
  person: [-1.4, 0.15, -4.7],      // on the far sidewalk (kerb height 0.15)
  lamp: [-0.7, 0.15, -5.5],        // their streetlight
  lampH: 5.2,
};

export function blocking(plan, H) {
  const E = plan.ev;
  return {
    // 0..1 the warm light arrives (rain slows, the person looks up)
    warm: (t) => H.smooth(H.invLerp(E.warmLight - 0.15, E.warmLight + 1.4, t)),
  };
}

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, len = shot.t1 - shot.t0, k = H.easeInOut(H.clamp(lt / len));
  const P = CITY.person;
  if (shot.id === 'S13a') {
    // street level, looking down the wet street; slow push toward the lone figure
    const look = H.at('city', [P[0] - 0.5, 2.2, P[2] + 0.3]);
    const dist = 12.5 - 1.6 * k;
    return { pos: H.sph(look, 1.05 + 0.04 * k, 0.04, dist), look, fov: 30, focus: dist * 0.92 };
  }
  // S13b: closer; the warm light falls; a slow rise of the camera with them as they look up
  const look = H.at('city', [P[0] - 0.2, 2.0 + 0.15 * k, P[2]]);
  const dist = 11 - 1.2 * k;
  return { pos: H.sph(look, 0.92 + 0.06 * k, 0.02 + 0.03 * k, dist), look, fov: 30, focus: dist * 0.95 };
}

export const anchors = {
  person: (plan, B, t, H) => H.at('city', [CITY.person[0], CITY.person[1] + 1.95, CITY.person[2]]),
  light: (plan, B, t, H) => H.at('city', [CITY.person[0], 7, CITY.person[2]]),
};
