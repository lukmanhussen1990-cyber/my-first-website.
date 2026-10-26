// Camera + blocking for the 'cta' set (STUB — the world track replaces this). World coords via H.at('cta', [x,y,z]).
export function blocking(plan, H) { return {}; }
export function camera(plan, B, shot, t, H) {
  const target = H.at('cta', [0, 1.2, 0]);
  return { pos: H.sph(target, 0.35, 0.28, 14 + 0.6 * (t - shot.t0)), look: target, fov: 24 };
}
// overlay label anchors (world points); the overlay calls anchorAt(plan, 'cta', name, t)
export const anchors = {
  dice: (plan, B, t, H) => H.at('cta', [-1.4, 1.2, 0]),
  hourglass: (plan, B, t, H) => H.at('cta', [1.4, 1.5, 0]),
};
