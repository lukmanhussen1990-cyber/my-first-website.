// Camera + blocking for the 'hill' set (STUB — the world track replaces this). World coords via H.at('hill', [x,y,z]).
export function blocking(plan, H) { return {}; }
export function camera(plan, B, shot, t, H) {
  const target = H.at('hill', [0, 1.2, 0]);
  return { pos: H.sph(target, 0.35, 0.28, 14 + 0.6 * (t - shot.t0)), look: target, fov: 24 };
}
// overlay label anchors (world points); the overlay calls anchorAt(plan, 'hill', name, t)
export const anchors = {
  methuselahHead: (plan, B, t, H) => H.at('hill', [0.3, 1.45, 0]),
  lamp: (plan, B, t, H) => H.at('hill', [0.9, 0.5, 0.3]),
  n969: (plan, B, t, H) => H.at('hill', [0.6, 3.2, -0.5]),
  sky: (plan, B, t, H) => H.at('hill', [0, 6, -10]),
};
