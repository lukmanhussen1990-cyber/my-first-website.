// Camera + blocking for the 'cta' set (S15): dark warm stone, the open shackles lying on it in a warm pool of light.
// The overlay puts the glowing name card (SON OF THE FATHER) above and the comment box below.

export const CTA = {
  shackles: [0, 0.02, 0],
};

export function blocking(plan, H) { return {}; }

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, k = H.easeInOut(H.clamp(lt / (shot.t1 - shot.t0)));
  const look = H.at('cta', [0.02, 0.05, 0.05]);
  const dist = 2.35 - 0.3 * k;
  return { pos: H.sph(look, 0.35 - 0.12 * k, 0.62 - 0.05 * k, dist), look, fov: 30, focus: dist };
}

export const anchors = {
  shackles: (plan, B, t, H) => H.at('cta', [0, 0.1, 0]),
};
