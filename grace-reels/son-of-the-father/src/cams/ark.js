// Camera + blocking for the 'ark' set: S7 (old Noah, 600, beside the finished ark; a gold 600 rises), S11a/b/c (the
// time-lapse "God waited": the ark grows keel > ribs > planks > roof through the seasons while crowds mock and old
// Methuselah watches from a little hill), S12 (the flood begins: the sky cracks with light, rain in sheets, the water
// spreads and the ark lifts — no people in the water). World coords via H.at('ark', [x,y,z]). ARKSET = shared layout.

export const ARKSET = {
  rotY: 0.3,
  noah: [6.5, 0, 8.6],             // S7 (by the finished hull)
  noahWork: [-3.6, 0, 6.6],        // S11 (hammering at the hull side)
  number: [7.5, 0, 9.3],           // the gold 600 (in front of the crate)
  mound: [-11.5, 12.5], moundH: 1.2,   // Methuselah's little hill (he watches every year)
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
      const look = at([ARKSET.noah[0] + 0.55, 1.95, ARKSET.noah[2] - 0.2]);
      const dist = 11.5 - 0.8 * k;
      return { pos: H.sph(look, 0.12 + 0.06 * k, 0.1, dist), look, fov: 30, focus: dist };
    }
    case 'S11a': {
      // wide, high diorama: the hull site, the crowd road, Methuselah's hill; a slow time-lapse dolly
      const look = at([-6.5, 2.0, 6.5]);
      const dist = 64 - 5 * k;
      return { pos: H.sph(look, -0.2 + 0.1 * k, 0.34, dist), look, fov: 22, focus: dist };
    }
    case 'S11b': {
      // closer: old Methuselah on his hill in the foreground (left), Noah hammering at the hull, mockers passing
      const look = at([-4.0 + 0.6 * k, 3.0, 3.6]);
      const pos = at([-19.5 + 1.2 * k, 3.4 + 0.2 * k, 19.0 - 0.8 * k]);
      return { pos, look, fov: 30, focus: 9 };
    }
    case 'S11c': {
      // the finished ark low in frame (the 1 Peter 3:20 card sits in the upper middle)
      const look = at([-2, 7.0 - 0.4 * k, 0]);
      const dist = 68 - 5 * k;
      return { pos: H.sph(look, 0.85 - 0.1 * k, 0.07, dist), look, fov: 24, focus: dist };
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
  // a point in the sky straight above where the S12 camera looks (keeps the Genesis 7:11 label centred as it cranes)
  sky: (plan, B, t, H) => { const s = plan.shots.find((x) => x.id === 'S12'); const c = camera(plan, B, s, t, H); return [c.look[0], c.look[1] + 7, c.look[2]]; },
  number: (plan, B, t, H) => H.at('ark', [ARKSET.number[0], 0.9, ARKSET.number[2]]),
};
