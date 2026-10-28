// One source of truth for every animation hit and sound cue, in seconds.
// Imported by the Remotion scenes and by tools/synth (sound effects), so pictures and sounds land on
// the same frame. Everything is derived from timeline.json (built from the user's voice recording).

const r3 = (x) => Math.round(x * 1000) / 1000;

// Walk cycles: one full cycle = two steps; a foot lands at phase 0 and 0.5.
export const WALKS = {
  enoch: { period: 1.1, phase: 0.1 },
  elijah: { period: 1.24, phase: 0.0 },
  elisha: { period: 1.04, phase: 0.27 },
};

export function footsteps(walk, start, stop) {
  const { period, phase } = WALKS[walk];
  const out = [];
  for (let k = 0; ; k++) {
    const t = start + ((phase + k * 0.5) % 1e9) * period;
    if (t > stop) break;
    if (t >= start) out.push(r3(t));
  }
  return out;
}

export function computeBeats(tl) {
  const c = tl.cues;
  const scene = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));
  const part = Object.fromEntries(tl.parts.map((p) => [p.id, p]));
  const word = (p, text) => tl.words.find((w) => w.part === p && w.text.replace(/[^A-Za-z’']/g, '') === text);

  const b = {
    total: tl.durationInSeconds,
    // S1 hook
    hookTitleIn: 0.08,
    hookTitleFly: 1.8,
    trackerIn: 2.3,
    cloakPass: 2.45,
    cloakWipe: scene.S2.start - 0.32,
    // S2 Enoch
    s2: scene.S2.start,
    enochLabel: c.enochLabel,
    enochBeamBright: word(2, 'Enoch').start,
    enochIntoLight: c.enochWalksIn,
    enochVanish: c.enochTaken,
    cardHebrewsIn: part[3].start - 0.38,
    badge1: c.translated,
    cardHebrewsOut: word(3, 'because').start - 0.12,
    // S3 Elijah and Elisha
    s3: scene.S3.start,
    elijahLabel: c.elijahLabel,
    wrong: c.wrong,
    elishaLabel: c.elishaLabel,
    // S4 chariot
    s4: scene.S4.start,
    suddenly: c.suddenly,
    lookUp: c.suddenly + 0.25,
    chariotBurst: c.chariotBurst,
    horsesWord: word(6, 'horses').start,
    // S5 myth
    s5: scene.S5.start,
    freeze: c.freeze,
    mythIn: c.freeze + 0.45,
    stampLift: c.redX,
    redX: word(7, 'read').start - 0.06,
    rewind: c.rewind,
    // S6 truth + whirlwind
    s6: scene.S6.start,
    replay: part[8].start,
    asunderLabel: c.asunder,
    between: c.between,
    stormGather: part[9].start,
    liftOff: c.wentUp,
    cloakSlip: c.wentUp + 0.55,
    whirlwindFull: c.whirlwind,
    heaven: c.heaven,
    badge2: c.heaven,
    // S7 my father
    s7: scene.S7.start,
    myFather: c.myFather,
    sawNoMore: c.sawNoMore,
    cloakFloat: c.cloakFloat,
    cloakLand: c.cloakLand,
    kneel: c.cloakLand + 0.25,
    pickUp: c.cloakLand + 0.95,
    lightGrows: scene.S8.start - 0.9,
    // S8 mountain
    s8: scene.S8.start,
    centuries: c.centuries,
    figuresAppear: c.elijahAppeared - 0.2,
    matthewLabel: c.centuries + 0.9,
    eliasLabel: c.elijahAppeared + 0.1,
    jesusShine: c.jesus,
    // S9 promise
    s9: scene.S9.start,
    keyChange: c.keyChange,
    cardJohnIn: part[14].start - 0.3,
    neverDie: c.neverDie,
    cardJohnOut: scene.S10.start + 0.3,
    // S10 call to action
    s10: scene.S10.start,
    typingStart: c.question + 0.15,
    typingCps: 14,
    commentText: 'Elijah, what did heaven look like?',
    hearts: c.commentBelow + 0.2,
    // S11 end card + loop
    s11: scene.S11.start,
    logoDraw: scene.S11.start + 0.12,
    loopOut: tl.durationInSeconds - 0.6,
  };
  b.typingEnd = b.typingStart + b.commentText.length / b.typingCps;

  b.steps = {
    enoch: footsteps('enoch', b.s2 + 0.05, b.enochIntoLight + 0.75),
    elijah: footsteps('elijah', b.s3, b.suddenly + 0.1),
    elisha: footsteps('elisha', b.s3, b.suddenly),
  };
  for (const k of Object.keys(b)) if (typeof b[k] === 'number') b[k] = r3(b[k]);
  return b;
}
