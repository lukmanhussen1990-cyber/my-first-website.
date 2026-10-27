// Camera + blocking for the 'riot' set (S6): the insurrection, remembered at night (Mark 15:7). A narrow street in red
// torchlight; an overturned cart burns; people run across the far end and their shadows stretch huge on the wall
// (no violence is shown); Barabbas strides toward us holding a torch, hard-eyed. World coords via H.at('riot', p).

export const RIOT = {
  cart: [-12.5, 0, 0.6],          // the overturned cart (fire)
  endWall: -25.5,                  // the house wall closing the street (the shadows land here)
  b0: [-9.6, 0, -0.3], b1: [-3.6, 0, 0.15],    // Barabbas walks from b0 to b1
};

export function blocking(plan, H) {
  const S = plan.shots.find((s) => s.id === 'S6');
  return {
    bAt: (t) => { const u = H.clamp((t - S.t0 + 0.3) / (S.t1 - S.t0 + 0.2)); return [H.lerp(RIOT.b0[0], RIOT.b1[0], u), 0, H.lerp(RIOT.b0[2], RIOT.b1[2], u)]; },
  };
}

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, u = H.clamp(lt / (shot.t1 - shot.t0)), k = H.easeInOut(u);
  const bp = B.bAt(t);
  const look = H.at('riot', [bp[0] - 0.4, H.lerp(1.9, 1.62, k), bp[2]]);
  const n = (s) => H.noise2(t * 1.3, s, 9);
  const pos = H.at('riot', [H.lerp(1.8, -0.4, k) + 0.04 * n(1), H.lerp(1.45, 1.55, k) + 0.03 * n(2), H.lerp(0.9, 0.55, k) + 0.04 * n(3)]);
  return { pos, look, fov: H.lerp(32, 30, k), focus: Math.hypot(pos[0] - look[0], pos[2] - look[2]) };
}

export const anchors = {
  barabbas: (plan, B, t, H) => { const p = B.bAt(t); return H.at('riot', [p[0], 1.95, p[2]]); },
};
