// Camera + blocking for the 'ark' set: S7 (old Noah, 600, beside the finished ark; a gold 600 rises), S11a/b/c (the
// time-lapse "God waited": the ark grows keel > ribs > planks > roof through the seasons while crowds mock and old
// Methuselah watches from a little hill), S12 (the flood begins: the sky cracks with light, rain in sheets, the water
// spreads and the ark lifts — no people in the water). World coords via H.at('ark', [x,y,z]). ARKSET = shared layout.

export const ARKSET = {
  rotY: 0.3,
  noah: [6.5, 0, 8.6],             // S7 / S11 (works by the hull)
  number: [7.9, 0, 8.3],           // the gold 600
  mound: [-11.5, 13.5], moundH: 1.1,   // Methuselah's little hill (he watches every year)
  crowdZ: 12.5,
};

export function blocking(plan, H) {
  const E = plan.ev;
  const s11 = plan.shots.find((s) => s.id === 'S11a'), s11c = plan.shots.find((s) => s.id === 'S11c');
  const t0 = s11.t0 + 0.15, t1 = s11c.t0 + 1.1;
  return {
    // build progress: finished in S7 (before the time-lapse) and from late S11c on
    progress: (t) => (t < s11.t0 - 0.5 ? 1 : 0.04 + 0.96 * H.smooth(H.invLerp(t0, t1, t))),
    // season phase for the time-lapse (0 green .. 0.5 dry .. 1 green), several "years" go by
    season: (t) => Math.max(0, (t - t0) / 3.6),
    // the time-lapse sun sweeps across the sky (shadows wheel round)
    sunAngle: (t) => (t - t0) * 2.4,
    // the flood: water level and the ark's lift (S12)
    water: (t) => -0.6 + 3.4 * H.smooth(H.invLerp(E.floodRain, E.floodRain + 2.6, t)),
    lift: (t) => Math.max(0, -0.6 + 3.4 * H.smooth(H.invLerp(E.floodRain, E.floodRain + 2.6, t)) - 1.1) * H.smooth(H.invLerp(E.arkLift - 0.4, E.arkLift + 0.6, t)),
  };
}

export function camera(plan, B, shot, t, H) {
  const E = plan.ev, lt = t - shot.t0, len = shot.t1 - shot.t0, k = H.easeInOut(H.clamp(lt / len));
  const at = (p) => H.at('ark', p);
  switch (shot.id) {
    case 'S7': {
      // Noah (600) at the finished hull; the gold 600 rises on his right
      const look = at([ARKSET.noah[0] + 0.7, 1.6, ARKSET.noah[2] - 0.2]);
      const dist = 10 - 0.8 * k;
      return { pos: H.sph(look, 0.1 + 0.08 * k, 0.07, dist), look, fov: 28, focus: dist };
    }
    case 'S11a': {
      // wide, high diorama: the hull site, the crowd road, Methuselah's hill; a slow time-lapse dolly
      const look = at([-2, 2.0, 4]);
      const dist = 62 - 5 * k;
      return { pos: H.sph(look, -0.42 + 0.12 * k, 0.34, dist), look, fov: 22, focus: dist };
    }
    case 'S11b': {
      // closer: old Methuselah on his hill in the foreground (left), Noah hammering at the hull, mockers passing
      const look = at([-3.5, 2.2, 8.5]);
      const dist = 25 - 3 * k;
      return { pos: H.sph(look, -0.62 + 0.1 * k, 0.16, dist), look, fov: 24, focus: dist * 0.75 };
    }
    case 'S11c': {
      // the finished ark low in frame (the 1 Peter 3:20 card sits in the upper middle)
      const look = at([0, 9.5 - 0.5 * k, 0]);
      const dist = 52 - 4 * k;
      return { pos: H.sph(look, 0.18 - 0.08 * k, 0.1, dist), look, fov: 24, focus: dist };
    }
    case 'S12': {
      // the windows of heaven open: the camera cranes up as the water spreads and the ark lifts
      const e = H.easeInOut(H.clamp((t - (E.floodCrack - 0.2)) / 2.6));
      const look = at([0, H.lerp(5, 3, e), 0]);
      const dist = H.lerp(44, 58, e);
      return { pos: H.sph(look, 0.25 - 0.1 * e, H.lerp(0.05, 0.42, e), dist), look, fov: 26, focus: dist };
    }
    default: { const look = at([0, 3, 0]); return { pos: H.sph(look, 0.3, 0.3, 50), look, fov: 24 }; }
  }
}

export const anchors = {
  noah: (plan, B, t, H) => H.at('ark', [ARKSET.noah[0], 2.0, ARKSET.noah[2]]),
  ark: (plan, B, t, H) => H.at('ark', [0, 8, 0]),
  sky: (plan, B, t, H) => H.at('ark', [-8, 22, -40]),
  number: (plan, B, t, H) => H.at('ark', [ARKSET.number[0], 0.9, ARKSET.number[2]]),
};
