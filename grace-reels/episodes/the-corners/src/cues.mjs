// Shared cue sheet: every story beat, built from the voice timeline.
// Imported by the Remotion scenes AND by audio/build_audio.mjs, so picture and sound hit the same frame.

const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');

export function buildCues(tl) {
  const word = (seg, text, nth = 0) => {
    const hits = tl.words.filter((w) => w.segment === seg && w.norm === norm(text));
    if (!hits[nth]) throw new Error(`cue word not found: seg ${seg} "${text}"`);
    return hits[nth].start;
  };
  const wordEnd = (seg, text, nth = 0) => {
    const hits = tl.words.filter((w) => w.segment === seg && w.norm === norm(text));
    return hits[nth].end;
  };
  const scenes = Object.fromEntries(tl.scenes.map((s) => [s.id, {start: s.start, end: s.end}]));
  // S9 needs a breath more for the workers' secret grain drop before the wedding.
  scenes.S9.end = word(17, 'boaz') - 0.08;
  scenes.S10.start = scenes.S9.end;

  const S = scenes;
  const e = {};

  // ---- S1 opening: harvest sweep, corners light, title, tracker ----
  e.harvest = {start: 0.0, end: 2.7};
  e.cornerLit = [0.5, 0.82, 1.14, 1.46];
  e.ruthWalk = {start: 0.0, end: S.S1.end};
  e.trackerIn = 2.7;

  // ---- S2 the rule ----
  e.lev199 = {in: word(4, 'when') - 0.25, out: S.S3.start + 0.05, words: [word(4, 'when'), wordEnd(4, 'field')]};
  e.edgesGlow = word(4, 'edges');
  e.swishesS2 = [];
  for (let t = S.S2.start + 0.35; t < S.S2.end - 0.3; t += 1.08) e.swishesS2.push(t);

  // ---- S3 leave them ----
  e.cornersWord = word(5, 'corners');
  e.familiesWalk = {start: S.S3.start + 0.1, end: word(6, 'poor') + 0.2};
  e.lev1910 = {in: word(6, 'leave') - 0.25, out: word(8, 'it') - 0.05, words: [word(6, 'leave'), wordEnd(6, 'foreigner')]};
  e.pours = [word(7, 'so') - 0.2, word(7, 'always'), word(7, 'food') + 0.35];
  e.happy = word(7, 'food') - 0.1;
  e.deut1511 = {in: word(8, 'law') - 0.15, out: S.S5.start + 0.25, words: [word(10, 'open'), wordEnd(10, 'hand')]};

  // ---- S4 open your hand ----
  e.fistSqueeze = word(10, 'open') - 0.3;
  e.handOpen = word(10, 'open');
  e.pour = {start: word(10, 'open') + 0.22, end: S.S5.start - 0.15};
  e.grainLand = word(10, 'open') + 0.55;

  // ---- S5 Ruth on the road ----
  e.ruthLabel = word(11, 'ruth');
  e.ruthDotGlow = word(11, 'ruth');
  e.widowWord = word(11, 'widow');
  e.foreignerLabel = word(12, 'foreigner');
  e.stepsS5 = [];
  for (let t = S.S5.start + 0.2; t < S.S5.end - 0.1; t += 0.56) e.stepsS5.push(t);

  // ---- S6 the ask ----
  e.ruth22 = {in: word(14, 'please') - 0.3, out: word(15, 'leftovers') - 0.3, words: [word(14, 'please'), wordEnd(14, 'grain')]};
  e.gleanTag = word(14, 'glean');
  e.ruthTalk = {start: word(13, 'she'), end: wordEnd(14, 'grain')};

  // ---- S7 the corner ----
  e.pickups = [S.S7.start + 0.55, word(15, 'leftovers') + 0.05, word(15, 'corner') + 0.15];

  // ---- S8 but notice ----
  e.butNotice = word(16, 'but');
  e.path = {start: word(16, 'she'), end: word(16, 'field') + 0.15};
  e.boazFieldLabel = word(16, 'field') - 0.1;

  // ---- S9 Boaz ----
  e.boazNotice = S.S9.start + 0.15;
  e.whisper = word(16, 'named') - 0.15;
  e.whipPan = {start: word(16, 'boaz') - 0.02, end: word(16, 'boaz') + 0.22};
  e.drops = [word(16, 'boaz') + 0.3, word(16, 'boaz') + 0.52, word(16, 'boaz') + 0.74];
  e.ruthAmazed = word(16, 'boaz') + 0.7;
  e.ruth216Label = word(16, 'boaz') + 0.3;

  // ---- S10 the family ----
  e.wedding = {start: S.S10.start, end: word(17, 'became') - 0.05};
  e.clap = {start: S.S10.start + 0.1, end: word(17, 'ruth') - 0.1};
  e.dotRuth = word(17, 'ruth');
  e.dotObed = word(17, 'the') + 0.05;
  e.coo = word(17, 'the') + 0.25;
  e.dotJesse = word(17, 'of') - 0.05;
  e.dotDavid = word(17, 'david');
  e.ruth417Label = word(17, 'the');

  // ---- S11 the line ----
  e.vine = {start: S.S11.start, end: word(19, 'jesus')};
  e.jesusBurst = word(19, 'jesus');
  e.matt15Label = word(19, 'jesus') + 0.35;
  e.pullBack = word(20, 'jesus') - 0.15;
  e.leftoversGlow = word(20, 'leftovers');

  // ---- S12 became poor ----
  e.cor89 = {in: word(21, 'though') - 0.3, out: S.S13.start, words: [word(21, 'though'), wordEnd(21, 'poor')]};
  e.becamePoor = word(21, 'poor');

  // ---- S13 for me ----
  e.breadBreak = word(22, 'said') + 0.1;
  e.breadOffer = word(23, 'one') - 0.1;
  e.matt2540 = {in: word(23, 'whatever') - 0.3, out: S.S14.start, words: [word(23, 'whatever'), wordEnd(24, 'me')]};
  e.forMe = word(24, 'me');

  // ---- S14 open hands ----
  e.matchCut = S.S14.start;
  e.reveal = {start: S.S14.start + 0.8, end: S.S14.start + 2.0};
  e.handoff = word(25, 'open');
  e.smile = word(26, 'people');

  // ---- S15 call to action ----
  e.ctaText = 'Buy someone lunch';
  e.typing = {start: word(27, 'help'), end: word(28, 'one') - 0.05};
  e.hearts = {start: word(28, 'one') + 0.1, end: S.S15.end};

  // ---- S16 end card + loop ----
  e.logoDraw = {start: S.S16.start + 0.1, end: S.S16.start + 1.15};
  e.endText = S.S16.start + 0.75;
  e.loopFlow = {start: S.S16.end - 0.75, end: S.S16.end};

  // ---- tracker states ----
  e.dots = {ruthGlow: e.ruthDotGlow, ruth: e.dotRuth, obed: e.dotObed, jesse: e.dotJesse, david: e.dotDavid, jesus: e.jesusBurst};

  return {scenes: S, e, word, wordEnd, duration: tl.duration, fps: tl.fps};
}
