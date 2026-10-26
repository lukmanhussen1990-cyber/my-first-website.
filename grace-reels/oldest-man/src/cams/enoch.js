// Camera + blocking for the 'enoch' set (STUB — the world track replaces this). World coords via H.at('enoch', [x,y,z]).
export function blocking(plan, H) { return {}; }
export function camera(plan, B, shot, t, H) {
  const target = H.at('enoch', [0, 1.2, 0]);
  return { pos: H.sph(target, 0.35, 0.28, 14 + 0.6 * (t - shot.t0)), look: target, fov: 24 };
}
// overlay label anchors (world points); the overlay calls anchorAt(plan, 'enoch', name, t)
export const anchors = {
  enoch: (plan, B, t, H) => H.at('enoch', [0, 1.9, 0]),
  light: (plan, B, t, H) => H.at('enoch', [2, 3, -2]),
  doorway: (plan, B, t, H) => H.at('enoch', [-3, 1.8, -1]),
};
