// One source of truth for every animation hit and sound cue, in seconds.
// Imported by the Remotion scenes and by tools/synth (music and sound effects), so pictures and sounds
// land on the same frame. Everything is derived from timeline.json (built from the voice recording).

const r3 = (x) => Math.round(x * 1000) / 1000;
const norm = (s) => s.toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9']/g, '').replace(/^'+|'+$/g, '');

// Walk cycles: one full cycle = two steps; a foot lands at phase 0 and 0.5.
export const WALKS = {
  moses: { period: 1.16, phase: 0.05 },
};

export function footsteps(walk, start, stop) {
  const { period, phase } = WALKS[walk];
  const out = [];
  for (let k = 0; ; k++) {
    const t = start + (phase + k * 0.5) * period;
    if (t > stop) break;
    if (t >= start) out.push(r3(t));
  }
  return out;
}

export function computeBeats(tl) {
  const c = tl.cues;
  const scene = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
  const sent = Object.fromEntries(tl.sentences.map((s) => [s.sid, s]));
  const word = (sid, text, nth = 0) => tl.words.filter((w) => w.sid === sid && norm(w.text) === text)[nth];

  const b = {
    total: tl.durationInSeconds,
    // ---- S1 the opening: storm on Sinai, fast push-in that ramps into slow motion ----
    s1: 0,
    lightning1: 0.16,
    rampEnd: 0.72,                       // the push-in slows into slow motion here
    titleOut: c.godSaid - 0.2,
    badgesIn: 0.85,
    lightning2: 1.62,
    // ---- S2 you will die: shield the eyes, tilt up into the light, swell, hard cut to near silence ----
    s2: c.godSaid - 0.08,
    tiltUp: c.ifYouDo - 0.1,
    swellStart: c.ifYouDo,
    lightning3: word('02', 'said').start + 0.1,
    hardCut: c.die - 0.04,               // everything drops out; "die" lands in near silence
    // ---- S3 montage: fire, plagues, sea (whip cuts) ----
    s3: c.alreadySeen - 0.11,
    fire: c.fire,
    whipPlagues: c.plagues - 0.06,
    frogs: [c.plagues + 0.02, c.plagues + 0.24, c.plagues + 0.47],
    whipSea: c.sea - 0.24,
    sea: c.sea,
    split: c.split,
    // ---- S4 the ask: kneeling on the summit, low angle ----
    s4: c.onTheMountain - 0.09,
    lightning4: c.onTheMountain + 0.35,
    cardGloryIn: c.beseech - 0.05,
    glory: c.glory,
    lightning5: c.shewMe - 0.15,
    // ---- S5 the answer: rolling thunderclouds, Moses bowed low ----
    s5: c.godAnswered - 0.11,
    cardGloryOut: c.noMan - 0.12,
    cardLiveIn: c.noMan - 0.06,
    lightning6: c.noMan + 0.5,
    live: c.live,
    // ---- S6 the clift: pressed into the rock; the covering shadow; the river of light ----
    s6: c.hid - 0.1,
    rockScrape: c.hid + 0.05,
    cardLiveOut: c.clift - 0.3,
    labelClift: c.clift - 0.05,
    inside: c.covered - 0.18,            // cut to inside the clift
    cover: c.covered,                    // the covering shadow falls over the opening
    gloryRush: c.gloryPassed - 0.12,     // the roaring river of light rushes past
    gloryPeak: c.passedBy + 0.12,
    gloryGone: sent['06'].end + 0.35,
    // ---- S7 his back: the shadow lifts, Moses peeks out at the trails of light ----
    s7: c.onlySaw - 0.12,
    labelBack: c.back - 0.1,
    // ---- S8 coming down: morning; the face shines and he doesn't know ----
    dawn: c.butNotice + 0.05,            // the night lifts into morning
    walkStart: c.butNotice + 0.2,
    shining: c.shining,
    faceCU: c.didntKnow - 0.18,
    labelKnow: c.didntKnow + 0.05,
    // ---- S9 the camp ----
    s9: c.wist - 0.1,
    cardShoneIn: c.wist + 0.02,
    gasp1: c.wist + 0.45,
    stepBack: c.afraid - 0.25,
    gasp2: c.afraid,
    childPeek: c.nearHim - 0.1,
    // ---- S10 the veil ----
    s10: c.justFrom - 0.08,
    cardShoneOut: c.justFrom - 0.15,
    veilOn: c.justFrom + 0.42,
    labelVeil: c.justFrom + 0.2,
    // ---- S11 the best part: D major; a streak of light flies centuries forward into the upper room ----
    keyChange: c.bestPart,
    craneUp: c.bestPart - 0.15,
    streak: c.centuries + 0.62,          // centre of the light-streak transition
    streakStart: c.centuries + 0.12,
    room: c.centuries + 0.62,
    cardJohnIn: c.jesusSaid - 0.05,
    me: c.me,
    father: c.father,
    faceGlow: c.me,                      // the FACE "?" glows brighter
    // ---- S12 no more hiding: split screen; the FACE badge fills ----
    s12: c.hide - 0.12,
    cardJohnOut: c.hide - 0.15,
    splitIn: c.hide - 0.12,
    splitOut: c.godsBack + 0.25,
    faceFill: c.godsBack + 0.05,
    // ---- S13 the face: sunrise, a slow push-in on Jesus' face ----
    s13: c.youCanSee - 0.1,
    cardFaceIn: c.youCanSee - 0.02,
    christ: c.christ,
    // ---- S14 call to action ----
    s14: c.cta - 0.12,
    cardFaceOut: c.cta + 0.2,
    typingCps: 13,
    commentText: 'I’d just say thank You 🙏',
    // ---- S15 end card, then the loop back to the storm ----
    s15: scene.S15.start,
    logoDraw: scene.S15.start + 0.12,
    loopOut: tl.durationInSeconds - 0.6,
  };
  b.typingStart = r3(c.oneLine + 0.75);
  b.typingEnd = b.typingStart + [...b.commentText].length / b.typingCps;
  b.hearts = b.typingEnd - 0.35;
  // Moses walks down the mountain path from the morning cut until the close-up.
  b.steps = { moses: footsteps('moses', b.walkStart, b.faceCU - 0.05) };
  for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r3(b[k]);
  b.frogs = b.frogs.map(r3);
  return b;
}
