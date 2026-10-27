// Shared timing plan — imported by the Remotion video (3D + overlay) AND the Node audio synth, so every
// animation hit and its sound land on the same frame. Pure: input = timeline.json, output = seconds.
// Q.03 SON OF THE FATHER.

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
  // --- S1 hook: the Jesus hero shot from frame 0 (fast orbit -> slow motion -> His calm face, eyes lift)
  ev.hookIn = 0;
  ev.hookHit = 0.12;                 // "ONLY ONE WALKS FREE" punches in (deep hit)
  ev.hookOut = 1.8;
  ev.jesusLabel = word('B01', 'Jesus').start;
  ev.rampStart = 0.0;                // fast orbit...
  ev.rampSlow = 1.45;                // ...slows into slow motion (the crowd roar drops "underwater")
  ev.eyesLift = word('B01', 'over').start - 0.25;   // He lifts His eyes
  // --- S2 the reveal: whip pan to Barabbas in heavy chains
  ev.reveal = B.B02.start - lead;
  ev.chainClank = ev.reveal + 0.2;
  ev.barabbasLabel = word('B02', "murderer's").start;
  ev.nameCard = word('B02', 'name').start;          // the locked name card "BARABBAS = ???" appears under the captions
  // --- S3 Passover: crane-up over Jerusalem
  ev.passover = word('B03', 'Passover').start;
  // --- S4 Pilate
  ev.pilateLabel = word('B04', 'Pilate').start;
  // --- S5 who Jesus is: glowing memory vignettes (~0.7 s each)
  ev.mem1 = word('B05', 'who').start - 0.1;         // a blind man's eyes opening
  ev.mem2 = word('B05', 'sick').start - 0.02;        // a sick child lifted up, well again
  ev.mem3 = word('B05', 'raised').start - 0.06;      // Lazarus walks out of the tomb in white cloth
  // --- S6 who Barabbas is: night riot flashback
  ev.riotLabel = word('B06', 'committed').start;
  // --- S7 the question
  ev.card2721 = word('B07', 'Whether').start - 0.3;
  ev.card2721Out = B.B07.end + 0.15;
  ev.whisper = ev.card2721 + 0.35;                   // people lean in and whisper through the hushed crowd (Mark 15:11)
  ev.hush = B.B07.start;                             // the crowd goes quiet
  // --- S8 the shout
  ev.shoutRise = word('B08', 'shouted').start;
  ev.shout = word('B08', 'Barabbas').start;           // the crowd explodes; BARABBAS slams on screen
  ev.silence = B.B08.end + 0.05;                     // 0.8 s of near silence
  // --- S9 but notice: freeze, drain to dark, the name card unlocks
  ev.freeze = B.B09.start - 0.05;
  ev.cardCenter = word('B09', 'notice').start;       // the name card flies to the centre and grows
  ev.lockBreak = word('B09', 'name').start + 0.25;   // the lock breaks (crack + sub boom)
  ev.splitBar = word('B09', 'Bar').start;            // BAR | ABBA split apart
  ev.tagSon = word('B09', 'son').start;              // tag SON under BAR
  ev.tagFather = word('B09', 'father').start;        // tag FATHER under ABBA
  ev.reform = word('B10', 'son').start - 0.1;        // the letters re-form...
  ev.goldName = word('B10', 'father').start;         // ...into SON OF THE FATHER in glowing gold (big hit + chime)
  // --- S10 the swap
  ev.unlock = word('B11', 'day').start;              // a guard turns the key
  ev.shacklesFall = word('B11', 'guilty').start + 0.15;
  ev.shacklesLand = ev.shacklesFall + 0.62;          // heavy clank on the stone
  ev.barabbasWalks = word('B11', 'walked').start - 0.2;
  ev.jesusLed = word('B12', 'true').start - 0.3;     // in the same shot, Jesus is led away toward the hill
  ev.majorLift = word('B12', 'Son').start;           // the music lifts into D major
  // --- S11 Matthew 27:26 card (full-screen cream)
  ev.card2726 = B.B13.start - lead - 0.1;
  // --- S12 he looks back
  ev.turnBack = word('B14', 'Barabbas').start + 0.35; // at the gate he stops and turns around
  ev.thunder1 = B.B14.start + 0.2;
  ev.soften = word('B15', 'walked').start;            // his hard face slowly softens
  ev.rackFocus = word('B15', 'Jesus').start - 0.2;    // focus pulls from Barabbas to the distant hill
  ev.thunder2 = word('B15', 'in').start + 0.3;
  // --- S13 1 Peter 3:18
  ev.card318 = B.B16.start - 0.25;
  ev.card318Out = B.B16.end + 0.45;
  ev.lightBreaks = B.B16.start + 0.4;
  // --- S14 you are Barabbas: push-in, then the match cut on "you"
  ev.matchCut = word('B17', 'you').start;
  ev.warmLight = word('B17', 'So').start - 0.2;
  // --- S15 call to action
  ev.cta = B.B18.start - lead;
  ev.typeStart = word('B18', 'say').start;
  ev.typeEnd = ev.typeStart + 1.6;
  ev.hearts = Array.from({ length: 6 }, (_, i) => ev.typeEnd + 0.08 + i * 0.13);
  // --- S16 end card + loop back to the Jesus hero shot of S1
  ev.endCard = T.voice_end + 0.35;
  ev.loopBack = dur - 0.7;

  // shots: id, scene, start, end, transition INTO this shot (cut | whip | dust | flare | push | match | dissolve)
  const S = (id, scene, t0, t1, trans = 'cut', tdur = 0) => ({ id, scene, t0, t1, trans, tdur });
  const st = (b) => B[b].start - lead;
  const shots = [
    S('S1', 'S1', 0, st('B02')),                                   // Jesus hero shot: fast orbit -> slow motion
    S('S2', 'S2', st('B02'), st('B03'), 'whip', 0.4),              // whip pan: Barabbas in chains beside Him
    S('S3', 'S3', st('B03'), st('B04'), 'cut'),                    // crane-up over Jerusalem at Passover
    S('S4', 'S4', st('B04'), st('B05'), 'cut'),                    // Pilate on the judgment seat; the two men led forward
    S('S5', 'S5', st('B05'), ev.mem1, 'cut'),                      // over Jesus' shoulder...
    S('S5a', 'S5', ev.mem1, ev.mem2, 'flare', 0.25),               // ...glowing memories: the blind man sees
    S('S5b', 'S5', ev.mem2, ev.mem3, 'flare', 0.25),               // a sick child lifted up
    S('S5c', 'S5', ev.mem3, st('B06'), 'flare', 0.25),             // Lazarus walks out of the tomb
    S('S6', 'S6', st('B06'), st('B07'), 'cut'),                    // night riot flashback (shadows)
    S('S7', 'S7', st('B07'), ev.card2721, 'cut'),                  // the question: Pilate raises a hand toward each man
    S('S7b', 'S7', ev.card2721, st('B08'), 'cut'),                 // the hushed crowd, whispers (the Matthew 27:21 card above)
    S('S8', 'S8', st('B08'), ev.freeze, 'cut'),                    // the shout; Jesus perfectly still
    S('S9', 'S9', ev.freeze, st('B11'), 'cut'),                    // freeze, drain to dark: the name card unlocks
    S('S10', 'S10', st('B11'), ev.card2726, 'dissolve', 0.45),     // the swap
    S('S11', 'S11', ev.card2726, st('B14'), 'dust', 0.45),         // Matthew 27:26 card (HTML)
    S('S12', 'S12', st('B14'), st('B16'), 'dust', 0.45),           // at the gate he looks back; rack focus to the hill
    S('S13', 'S13', st('B16'), st('B17'), 'flare', 0.45),          // light breaks through the clouds; 1 Peter 3:18
    S('S14a', 'S14', st('B17'), ev.matchCut, 'cut'),               // push-in on Barabbas's face
    S('S14b', 'S14', ev.matchCut, st('B18'), 'match', 0.12),       // match cut: the modern person, warm light falls
    S('S15', 'S15', st('B18'), ev.endCard, 'dust', 0.45),          // call to action
    S('S16', 'S16', ev.endCard, ev.loopBack, 'flare', 0.5),        // end card (HTML)
    S('LOOP', 'S1', ev.loopBack, dur + 1, 'dissolve', 0.6),        // back into the Jesus hero shot of frame 0
  ];
  // caption theme per scene (dark = warm off-white on a dark band, light = ink on a cream band)
  const theme = { S1: 'dark', S2: 'dark', S3: 'light', S4: 'dark', S5: 'dark', S6: 'dark', S7: 'dark', S8: 'dark', S9: 'dark', S10: 'dark', S11: 'light', S12: 'dark', S13: 'dark', S14: 'dark', S15: 'dark', S16: 'dark' };
  return { fps: FPS, dur, frames: T.frames, beats: B, words: W, word, ev, shots, theme };
}

export function shotAt(plan, t) {
  const S = plan.shots;
  let i = S.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = t < 0 ? 0 : S.length - 1;
  return { i, shot: S[i], lt: t - S[i].t0, next: S[i + 1], prev: S[i - 1] };
}
