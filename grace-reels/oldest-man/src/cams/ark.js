// Camera + blocking for the 'ark' set (STUB — the world track replaces this). World coords via H.at('ark', [x,y,z]).
export function blocking(plan, H) { return {}; }
export function camera(plan, B, shot, t, H) {
  const target = H.at('ark', [0, 1.2, 0]);
  return { pos: H.sph(target, 0.35, 0.28, 14 + 0.6 * (t - shot.t0)), look: target, fov: 24 };
}
// overlay label anchors (world points); the overlay calls anchorAt(plan, 'ark', name, t)
export const anchors = {
  noah: (plan, B, t, H) => H.at('ark', [0, 1.9, 0]),
  ark: (plan, B, t, H) => H.at('ark', [6, 4, -10]),
  sky: (plan, B, t, H) => H.at('ark', [0, 14, -30]),
  number: (plan, B, t, H) => H.at('ark', [1.8, 2.2, -1]),
};
