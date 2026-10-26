// Shared timing plan — imported by the Remotion video (3D + overlay) AND the Node audio synth, so every
// animation hit and its sound land on the same frame. Pure: input = timeline.json, output = seconds.
// Q.02 THE OLDEST MAN.

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
  const lead = 0.15;                 // pictures cut slightly before the voice
  const dur = T.duration;
  const ev = {};
  // --- S1 hook
  ev.hookIn = 0;                     // hook title visible from frame 0 ("969 YEARS. THEN THE FLOOD.")
  ev.hookHit = 0.12;                 // the title punches in (deep hit)
  ev.hookOut = 1.8;                  // flies into the caption spot
  // --- S2 name: label + life-ribbon
  ev.nameLabel = word('B02', 'Methuselah').start;
  ev.ribbon = word('B02', 'lived').start;            // the life-ribbon draws across the frame
  ev.ribbon969 = word('B02', '969').start;
  // --- S3 Enoch
  ev.enochWalk = B.B03.start - 0.3;
  ev.card524 = word('B03', 'walked').start - 0.25;   // Genesis 5:24 card
  ev.enochGone = word('B03', 'took').start;          // he walks into the light and is gone; footprints stop
  ev.card524Out = B.B03.end + 0.35;
  // --- S4 overlap timeline
  ev.timeline = B.B04.start - lead;
  ev.barMeth = word('B04', "Methuselah's").start;
  ev.barAdam = word('B04', 'Adam').start;            // Adam / Methuselah overlap glows
  ev.barNoah = word('B04', 'Noah').start;            // Methuselah / Noah overlap glows
  // --- S5–S8 the math (tracker under the captions from line 5)
  ev.tracker = word('B05', 'math').start;
  ev.n187 = word('B06', '187').start;                // each number dips (anticipation) then rises on its word
  ev.n182 = word('B07', '182').start;
  ev.n600 = word('B08', '600').start;
  ev.sum187 = word('B09', '187').start;              // line 9: the numbers fly together one by one
  ev.sum182 = word('B09', '182').start;
  ev.sum600 = word('B09', '600').start;
  ev.equals = word('B09', 'equals').start;
  ev.slam = word('B09', '969').start;                // the three numbers slam into one huge 969 over the lamp
  ev.yearLabel = ev.slam + 0.45;                     // "THE YEAR HE DIED · GENESIS 5:27"
  // --- S9 the lamp goes out, near silence, one giant raindrop
  ev.lampOut = word('B10', 'died').start;            // the flame dies on "died" (it gutters from the slam on)
  ev.silence = B.B10.end + 0.05;                     // 0.6 s of near silence
  ev.dropFall = ev.silence + 0.6;                    // the slow-motion raindrop starts falling
  ev.dropSplash = ev.dropFall + 0.75;                // splash on dry cracked ground
  ev.thunderFar = ev.dropSplash + 0.25;
  // --- S10 the name
  ev.nameMeaning = B.B11.start + 0.2;
  // --- S11 God waited (ark time-lapse) + 1 Peter 3:20 card
  ev.timelapse = B.B12.start - 0.8;
  ev.card320 = B.B13.start - 0.25;
  ev.card320Out = B.B13.end + 0.3;
  // --- S12 the flood begins (in the held pause after B13): the sky cracks with light
  ev.floodCrack = B.B13.end + 0.2;
  ev.floodRain = ev.floodCrack + 0.25;
  ev.arkLift = ev.floodCrack + 1.4;
  // --- S13 today: match cut to the city in the rain, the warm light falls "for you"
  ev.city = B.B14.start - lead;
  ev.warmLight = word('B14', 'for', 0).start;        // "Not to punish you… but FOR you" → light + D major
  ev.card39 = B.B15.start - 0.25;
  ev.card39Out = B.B15.end + 0.3;
  // --- S14 call to action
  ev.cta = B.B16.start - lead;
  ev.dice = word('B16', 'Coincidence…').start;
  ev.hourglass = word('B16', 'timing').start;
  ev.typeStart = ev.hourglass + 0.35;               // the comment types "TIMING 🙏" while the question lands
  ev.typeEnd = ev.typeStart + 0.9;
  ev.hearts = Array.from({ length: 6 }, (_, i) => ev.typeEnd + 0.1 + i * 0.22);
  // --- S15 end card + loop back to the lit lamp of S1
  ev.endCard = T.voice_end + 0.75;
  ev.loopBack = dur - 0.7;
  // --- the lamp burns lower through the story (1 = full flame), out at lampOut
  ev.lampLevel = (t) => (t < 0 || t > dur - 1.0 ? 1 : t >= ev.lampOut + 0.35 ? 0 : Math.max(0.15, 1 - 0.8 * Math.min(1, t / ev.lampOut)));

  // shots: id, scene, start, end, transition INTO this shot (cut | whip | dust | flare | push | match | dissolve)
  const S = (id, scene, t0, t1, trans = 'cut', tdur = 0) => ({ id, scene, t0, t1, trans, tdur });
  const st = (b) => B[b].start - lead;
  const shots = [
    S('S1', 'S1', 0, st('B02')),                                  // night hill, lamp, distant ark, push-in
    S('S2', 'S2', st('B02'), st('B03'), 'cut'),                   // face close-up, label, life-ribbon
    S('S3', 'S3', st('B03'), st('B04'), 'flare', 0.5),            // Enoch walks into the light
    S('S4', 'S4', st('B04'), st('B05'), 'dust', 0.5),             // parchment overlap timeline (HTML)
    S('S5', 'S5', st('B05'), st('B07'), 'push', 0.35),            // Methuselah + baby Lamech, gold 187
    S('S6', 'S6', st('B07'), st('B08'), 'whip', 0.4),             // Lamech + baby Noah, gold 182
    S('S7', 'S7', st('B08'), st('B09'), 'whip', 0.4),             // old Noah + finished ark, gold 600
    S('S8', 'S8', st('B09'), st('B10'), 'whip', 0.4),             // numbers fly → 969 slam over the lamp
    S('S9', 'S9', st('B10'), ev.dropSplash + 0.35, 'cut'),         // lamp extreme close-up → raindrop
    S('S10', 'S10', ev.dropSplash + 0.35, st('B12'), 'cut'),      // cold lamp, cane, first rain, label
    S('S11a', 'S11', st('B12'), B.B12.start + 3.6, 'dust', 0.5),  // ark time-lapse, wide
    S('S11b', 'S11', B.B12.start + 3.6, st('B13'), 'cut'),        // time-lapse closer: Noah building, Methuselah watching
    S('S11c', 'S11', st('B13'), ev.floodCrack - 0.05, 'cut'),     // 1 Peter 3:20 card over the finished ark
    S('S12', 'S12', ev.floodCrack - 0.05, ev.city, 'flare', 0.3), // the windows of heaven opened; the ark lifts
    S('S13a', 'S13', ev.city, ev.warmLight - 0.4, 'match', 0.3),  // rain on the ark → rain on the city
    S('S13b', 'S13', ev.warmLight - 0.4, st('B16'), 'cut'),       // warm light falls on the lone person; 2 Pet 3:9
    S('S14', 'S14', st('B16'), ev.endCard, 'dust', 0.5),          // dice vs hourglass, comment box
    S('S15', 'S15', ev.endCard, ev.loopBack, 'flare', 0.5),       // end card (HTML)
    S('LOOP', 'S1', ev.loopBack, dur + 1, 'dissolve', 0.6),       // back to the lit lamp of frame 0
  ];
  // caption theme per scene (dark = warm off-white on a dark band, light = ink on a cream band)
  const theme = { S1: 'dark', S2: 'dark', S3: 'light', S4: 'light', S5: 'dark', S6: 'dark', S7: 'dark', S8: 'dark', S9: 'dark', S10: 'dark', S11: 'light', S12: 'dark', S13: 'dark', S14: 'dark', S15: 'dark' };
  return { fps: FPS, dur, frames: T.frames, beats: B, words: W, word, ev, shots, theme };
}

export function shotAt(plan, t) {
  const S = plan.shots;
  let i = S.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = t < 0 ? 0 : S.length - 1;
  return { i, shot: S[i], lt: t - S[i].t0, next: S[i + 1], prev: S[i - 1] };
}
