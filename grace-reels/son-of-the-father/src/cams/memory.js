// Camera + blocking for the 'memory' set (S5a-S5c): who Jesus is, in three glowing memory vignettes (~0.7 s each).
// A: a blind man's eyes open as Jesus' hand comes to them. B: a sick child, well again, lifted up high. C: Lazarus walks
// out of the tomb in white grave cloth. World coords via H.at('memory', [x,y,z]). MEM = shared layout.

export const MEM = {
  A: { man: [0, 0, 0], jesus: [-0.78, 0, 0.06] },                 // the man faces -x (toward Jesus)
  B: { jesus: [40, 0, 0], child: [40.04, 0, 0.3], mother: [41.05, 0, 0.35] },
  C: { tomb: [80, 0, -4.2], lazarus0: [80, 0, -3.5], lazarus1: [80.05, 0, -2.0], jesus: [80.95, 0, 1.3] },
};

export function blocking(plan, H) {
  const E = plan.ev;
  return {
    eyesOpen: (t) => H.smooth(H.invLerp(E.mem1 + 0.28, E.mem1 + 0.48, t)),
    lift: (t) => H.easeOut(H.invLerp(E.mem2 - 0.15, E.mem2 + 0.6, t)),
    walkOut: (t) => H.clamp((t - E.mem3 + 0.1) / 1.3),
  };
}

export function camera(plan, B, shot, t, H) {
  const lt = t - shot.t0, u = H.clamp(lt / (shot.t1 - shot.t0));
  const at = (p) => H.at('memory', p);
  if (shot.id === 'S5a') {
    const m = MEM.A.man, look = at([m[0] - 0.22, 1.5, m[2]]);
    const dist = 2.35 - 0.2 * u;
    return { pos: H.sph(look, 0.22 + 0.05 * u, 0.02, dist), look, fov: 30, focus: dist };
  }
  if (shot.id === 'S5b') {
    const j = MEM.B.jesus, look = at([j[0] + 0.12, 2.25 + 0.06 * u, j[2] + 0.05]);
    const dist = 4.75 - 0.25 * u;
    return { pos: H.sph(look, 0.1 + 0.04 * u, -0.05, dist), look, fov: 30, focus: dist };
  }
  // S5c: wide, from behind Jesus (on the right, His hand raised), the dark tomb ahead; Lazarus walks out into the light
  const look = at([80.15, 1.3, -3.0]);
  const pos = at([80.3, 1.45, 9.3 - 0.35 * u]);
  return { pos, look, fov: 30, focus: Math.hypot(pos[0] - 80.0, pos[2] + 2.6) };
}

export const anchors = {};
