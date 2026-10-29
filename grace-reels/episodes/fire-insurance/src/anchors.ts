// Every timed beat of the reel, derived from the voice timeline. Used by the
// picture (Remotion) and by the sound tools (Node), so hits line up to the frame.
import {TimelineIndex, type Timeline} from '../../../src/shared/timeline.ts';

export const END_CARD_FRAMES = 90; // 3 s
export const LOOP_FRAMES = 14; // last frames dissolve back into frame 0
export const XF = 12; // scene crossfade length

export const makeAnchors = (tl: Timeline) => {
  const T = new TimelineIndex(tl);
  const s = (id: number) => T.sf(id);
  const e = (id: number) => T.ef(id);
  const w = (id: number, word: string, nth = 0) => T.wf(id, word, nth);
  const we = (id: number, word: string, nth = 0) => T.f(T.word(id, word, nth).end);

  const endCard = T.f(tl.voiceEnd + 0.55);
  const total = endCard + END_CARD_FRAMES;

  const A = {
    T,
    total,
    endCard,
    // S1–S3 opening
    thoughtPop: 5,
    meterIn: 8,
    docDrop: s(2) - 4,
    docLand: s(2) + 8,
    stamp: w(2, 'insurance'),
    docOut: s(3) - 2,
    qPop: w(3, 'faith'),
    // S4–S11 storm sequence
    storm: s(4) - 6,
    waves: s(5) - 4,
    lightning1: s(4) + 26,
    lightning2: w(5, 'die'),
    waveHit: w(5, 'crashed'),
    bang1: w(5, 'crashed') + 6,
    bang2: w(5, 'sure'),
    bang3: w(5, 'would'),
    asleep: s(6) - 4,
    zzz: w(6, 'asleep'),
    shake: s(7) - 3,
    prayerBubble: w(7, 'master'),
    pureFear: s(8) - 4,
    pureFearLabel: w(8, 'pure'),
    notice: s(9) - 6,
    standUp: w(9, 'got'),
    peaceBubble: w(9, 'peace'),
    still: w(9, 'still'),
    stopped: w(10, 'stopped'),
    goldBang1: w(10, 'stopped') + 4,
    goldBang2: w(10, 'stopped') + 12,
    goldBang3: w(10, 'stopped') + 20,
    answered: w(11, 'answered'),
    whyShot: s(12) - 4,
    whyBubble: w(12, 'why'),
    // S12–S16 path sequence
    dawn: s(13) - 6,
    fearStone: s(13) + 6,
    beginningLabel: w(13, 'fear', 1),
    respectTag: w(13, 'beginning'),
    youStand: w(14, 'only'),
    walk1: w(14, 'god'),
    walk1End: we(14, 'heart'),
    heartFloat: w(14, 'heart'),
    loveCasts: s(15) - 4,
    fearBubble: s(15),
    goldWash: w(15, 'perfect'),
    burst: w(15, 'out') + 4,
    firstLoved: s(16) - 4,
    jesusWalk: s(16),
    jesusStop: w(16, 'love'),
    dotted: w(16, 'love'),
    loved: w(16, 'loved'),
    closeStep: w(17, 'close'),
    lovesYou: w(17, 'you', 1),
    dontStay: s(18) - 4,
    stepBack: w(18, 'fear'),
    okay: w(18, "that's"),
    signpost: w(18, 'stay'),
    walkHome: w(18, 'stay'),
    // S17 call to action
    cta: s(19) - 6,
    btnFear: w(19, 'fear'),
    btnLove: w(19, 'love'),
    typing: w(19, 'love') + 6,
    // S18 send
    send: s(20) - 6,
    plane: w(20, 'send'),
    planeArrive: w(20, 'scared'),
    melt: w(20, 'scared') + 6,
  };
  return A;
};

export type Anchors = ReturnType<typeof makeAnchors>;

/** Fear↔Love meter value (0 = FEAR, 1 = LOVE) and knob shake at a frame. */
export const meterState = (A: Anchors, f: number) => {
  const ramp = (from: number, dur: number, a: number, b: number) => {
    if (f <= from) return a;
    if (f >= from + dur) return b;
    const t = (f - from) / dur;
    const k = t * t * (3 - 2 * t);
    return a + (b - a) * k;
  };
  let v = 0.03;
  if (f >= A.whyBubble) v = ramp(A.whyBubble, 24, 0.03, 0.13);
  if (f >= A.dawn) v = ramp(A.dawn, 20, 0.13, 0.18);
  if (f >= A.heartFloat - 10) v = ramp(A.heartFloat - 10, 30, 0.18, 0.5);
  if (f >= A.burst) v = ramp(A.burst, 20, 0.5, 0.64);
  if (f >= A.loved - 22) v = ramp(A.loved - 22, 22, 0.64, 1);
  if (f >= A.btnFear - 2) v = ramp(A.btnFear - 2, 10, 1, 0.04);
  if (f >= A.btnLove - 2) v = ramp(A.btnLove - 2, 14, 0.04, 1);
  const shake = f >= A.waveHit - 4 && f < A.still ? (f < A.pureFear ? 5 : 7) : f >= A.storm && f < A.still ? 2 : 0;
  return {value: v, shake};
};

/** YOU's walks on the path: [startFrame, endFrame, fromX, toX]. */
export const youLegs = (A: Anchors): [number, number, number, number][] => [
  [A.walk1, Math.max(A.walk1 + 30, A.walk1End), 300, 500],
  [A.closeStep, A.closeStep + 30, 500, 560],
  [A.stepBack, A.stepBack + 22, 560, 530],
  [A.walkHome, A.walkHome + 48, 530, 712],
];

/** Jesus' walk down the path: [startFrame, endFrame]. */
export const jesusWalkRange = (A: Anchors): [number, number] => [A.jesusWalk, Math.max(A.jesusWalk + 36, A.jesusStop + 6)];
