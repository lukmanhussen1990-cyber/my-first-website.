// Shared timing plan — imported by the Remotion video AND the Node audio synth, so every animation
// hit and its sound land on the same frame. Pure: input = timeline.json, output = times in seconds.

export const FPS = 30;

export function buildPlan(T) {
  const B = Object.fromEntries(T.beats.map((b) => [b.id, b]));
  const W = T.words;
  const clean = (s) => s.replace(/[^A-Za-z0-9']/g, '').toUpperCase();
  const word = (beat, w, nth = 0) => {
    const m = W.filter((x) => x.beat === beat && clean(x.w) === clean(w));
    if (!m[nth]) throw new Error(`plan: word ${w}#${nth} not found in ${beat}`);
    return m[nth];
  };
  const lead = 0.15; // pictures cut slightly before the voice
  const dur = T.duration;
  const endCard = T.voice_end + 0.75;            // CTA holds a moment after the last word

  const ev = {};
  ev.impact = 0.4;                                   // stone 7 lands (frame 12)
  ev.hookOut = 1.8;                                  // hook title flies into the caption spot
  ev.trackerIn = Array.from({ length: 7 }, (_, i) => 2.15 + i * 0.13);
  const flipBeats = ['B04', 'B06', 'B07', 'B08', 'B09', 'B10'];
  ev.flip = flipBeats.map((b, i) => word(b, String(i + 1)).start);   // tile flips on the spoken number
  ev.riser = ev.flip.map((t) => t - 0.55);
  ev.buildup = B.B11.start - 0.2;                    // music drops, heartbeat starts
  ev.reveal = B.B12.start - 0.02;                    // hard hit: ? -> gold 7
  ev.flip.push(ev.reveal);
  ev.snaps = ['Gossip', 'Stirring', 'drama', 'Turning', 'against'].map((w) => word('B13', w).start + 0.05);
  ev.whisperTo = ev.snaps.map((t) => t - 0.55);
  ev.split = word('B13', 'other').start;
  ev.phone = B.B14.start - lead;
  ev.bubbles = [B.B14.start + 0.15, B.B14.start + 0.75, B.B14.start + 1.35];
  ev.howMany = B.B15.start - lead;
  ev.pulses = Array.from({ length: 7 }, (_, i) => B.B15.start + 0.25 + i * Math.max(0.24, (B.B15.end - B.B15.start - 0.1) / 7));
  ev.goodNews = B.B16.start - 0.55;                  // slow warm dissolve starts in the 0.7 s pause
  ev.card = word('B16', 'God').start - 0.25;
  ev.cardOut = B.B16.end + 0.25;
  ev.wash = Array.from({ length: 7 }, (_, i) => B.B17.start + 0.3 + i * 0.42);
  ev.reunite = B.B17.start + 3.6;
  ev.regrow = Array.from({ length: 5 }, (_, i) => ev.reunite + 0.2 + i * 0.32);
  ev.cta = B.B18.start - lead;
  ev.taps = Array.from({ length: 7 }, (_, i) => B.B18.start + 0.25 + i * 0.16);
  ev.typeStart = B.B18.start + 0.55;               // the comment types while the question is asked
  ev.typeEnd = ev.typeStart + 1.0;
  ev.hearts = Array.from({ length: 6 }, (_, i) => ev.typeEnd + 0.1 + i * 0.28);
  ev.endCard = endCard;
  ev.loopBack = dur - 0.8;                          // end card flows back into the falling 7

  // shots: id, scene, start, end, transition INTO this shot
  const S = (id, scene, t0, t1, trans = 'cut', tdur = 0) => ({ id, scene, t0, t1, trans, tdur });
  const sc = (id) => T.scenes[id];
  const s6b = word('B08', 'deviseth').start - 0.25;
  const shots = [
    S('S1', 'S1', 0, sc('S2').start - lead),
    S('S2', 'S2', sc('S2').start - lead, sc('S3').start - lead, 'dust', 0.5),
    S('S3', 'S3', sc('S3').start - lead, sc('S4').start - lead, 'whip', 0.4),
    S('S4', 'S4', sc('S4').start - lead, sc('S5').start - lead, 'whip', 0.4),
    S('S5a', 'S5', sc('S5').start - lead, word('B07', 'innocent').start - 0.35, 'flare', 0.5),
    S('S5b', 'S5', word('B07', 'innocent').start - 0.35, sc('S6').start - lead, 'cut'),
    S('S6a', 'S6', sc('S6').start - lead, s6b, 'whip', 0.4),
    S('S6b', 'S6', s6b, sc('S7').start - lead, 'push', 0.35),
    S('S7', 'S7', sc('S7').start - lead, sc('S8').start - lead, 'whip', 0.4),
    S('S8', 'S8', sc('S8').start - lead, sc('S9').start - lead, 'dust', 0.5),
    S('S9', 'S9', sc('S9').start - lead, ev.reveal, 'whip', 0.4),
    S('S10', 'S10', ev.reveal, ev.phone, 'cut'),
    S('S11', 'S11', ev.phone, ev.howMany, 'match', 0.3),
    S('S12', 'S12', ev.howMany, ev.goodNews, 'push', 0.3),
    S('S13', 'S13', ev.goodNews, sc('S14').start - lead, 'dissolve', 1.2),
    S('S14a', 'S14', sc('S14').start - lead, ev.reunite, 'flare', 0.5),
    S('S14b', 'S14', ev.reunite, ev.cta, 'flare', 0.5),
    S('S15', 'S15', ev.cta, ev.endCard, 'dust', 0.5),
    S('S16', 'S16', ev.endCard, ev.loopBack, 'flare', 0.5),
    S('LOOP', 'S1', ev.loopBack, dur + 1, 'dissolve', 0.6),
  ];
  // caption theme per scene (light = ink on cream scrim, dark = warm white on dark scrim)
  const theme = { S1: 'dark', S2: 'light', S3: 'dark', S4: 'light', S5: 'dark', S6: 'dark', S7: 'light', S8: 'dark', S9: 'dark', S10: 'dark', S11: 'dark', S12: 'dark', S13: 'light', S14: 'light', S15: 'dark', S16: 'dark' };
  return { fps: FPS, dur, frames: T.frames, beats: B, words: W, word, ev, shots, theme };
}

export function shotAt(plan, t) {
  const S = plan.shots;
  let i = S.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = t < 0 ? 0 : S.length - 1;
  return { i, shot: S[i], lt: t - S[i].t0, next: S[i + 1], prev: S[i - 1] };
}
