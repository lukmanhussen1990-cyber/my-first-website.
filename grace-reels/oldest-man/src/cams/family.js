// Camera + blocking for the 'family' set (S5, S6): night in the village, warm lamplight.
// S5: young Methuselah at his door rocks baby Lamech; a gold 187 dips then rises beside them on "187".
// S6: Lamech (strong, dark beard) at his own door holds baby Noah; a gold 182 rises on "182".
// World coords via H.at('family', [x,y,z]). FAMILY holds the shared layout.

export const FAMILY = {
  A: { person: [0, 0, 0], number: [1.15, 0, -0.3], lamp: [0.45, 0, 0.8], house: [-0.4, -2.6], houseRot: 0.05 },
  B: { person: [14, 0, 0], number: [15.15, 0, -0.3], lamp: [14.45, 0, 0.8], house: [13.6, -2.6], houseRot: -0.06 },
  numSize: 0.72,
};

export function blocking(plan, H) { return {}; }

function frame(H, spot, lt, len) {
  const k = H.easeInOut(H.clamp(lt / len));
  const look = H.at('family', [spot.person[0] + 0.72, 1.62 + 0.04 * k, spot.person[2] - 0.25]);
  const dist = 9.6 - 1.0 * k;
  return { look, dist, k };
}

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, len = shot.t1 - shot.t0;
  const spot = shot.id === 'S6' ? FAMILY.B : FAMILY.A;
  const { look, dist, k } = frame(H, spot, lt, len);
  const yaw = shot.id === 'S6' ? -0.12 + 0.07 * k : 0.14 - 0.08 * k;   // drifts the other way in each shot
  return { pos: H.sph(look, yaw, 0.08, dist), look, fov: 28, focus: dist - 0.3 };
}

const spotOf = (plan, t) => (t >= plan.ev.n182 - 1.5 ? FAMILY.B : FAMILY.A);
export const anchors = {
  methuselah: (plan, B, t, H) => H.at('family', [FAMILY.A.person[0] + 0.05, 1.98, FAMILY.A.person[2]]),
  lamech: (plan, B, t, H) => H.at('family', [FAMILY.B.person[0] + 0.05, 2.06, FAMILY.B.person[2]]),
  baby: (plan, B, t, H) => { const s = spotOf(plan, t); return H.at('family', [s.person[0] + 0.25, 1.25, s.person[2]]); },
  number: (plan, B, t, H) => { const s = spotOf(plan, t); return H.at('family', [s.number[0], FAMILY.numSize + 0.15, s.number[2]]); },
};
