// Camera + blocking for the 'family' set (STUB — the world track replaces this). World coords via H.at('family', [x,y,z]).
export function blocking(plan, H) { return {}; }
export function camera(plan, B, shot, t, H) {
  const target = H.at('family', [0, 1.2, 0]);
  return { pos: H.sph(target, 0.35, 0.28, 14 + 0.6 * (t - shot.t0)), look: target, fov: 24 };
}
// overlay label anchors (world points); the overlay calls anchorAt(plan, 'family', name, t)
export const anchors = {
  methuselah: (plan, B, t, H) => H.at('family', [0, 1.9, 0]),
  lamech: (plan, B, t, H) => H.at('family', [0, 1.95, 0]),
  baby: (plan, B, t, H) => H.at('family', [0.3, 1.2, 0]),
  number: (plan, B, t, H) => H.at('family', [1.5, 2.0, -1]),
};
