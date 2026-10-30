// Every timed beat of "The Priest Who Found the Beginning", from the voice timeline.
import {TimelineIndex, type Timeline} from '../../../src/shared/timeline.ts';

export const END_CARD_FRAMES = 90;
export const LOOP_FRAMES = 14;
export const XF = 12;
export const TYPE_FRAMES = 24;

export const makeAnchors = (tl: Timeline) => {
  const T = new TimelineIndex(tl);
  const s = (id: number) => T.sf(id);
  const e = (id: number) => T.ef(id);
  const w = (id: number, word: string, nth = 0) => T.wf(id, word, nth);
  const endCard = T.f(tl.voiceEnd + 0.55);
  return {
    T,
    endCard,
    total: endCard + END_CARD_FRAMES,
    rowIn: 8,
    bang: w(1, 'scientists'),
    board: s(2) - 6,
    name: w(3, 'name'),
    tagPriest: w(3, 'catholic'),
    tagPhys: w(3, 'physicist'),
    chalk: s(4) - 6,
    expanding: w(4, 'expanding'),
    rewindShot: s(5) - 6,
    rewind: w(5, 'rewind'),
    point: w(5, 'point'),
    aBeginning: s(6),
    einstein: s(7) - 6,
    reportedly: w(7, 'reportedly'),
    eBubble: w(7, 'your'),
    shrug: w(7, 'abominable'),
    obs: s(8) - 6,
    lens: w(8, 'telescopes'),
    apart: w(8, 'apart'),
    radio: s(9) - 6,
    bigBang: w(9, 'big'),
    believed: w(9, 'believe'),
    hoyle: w(9, 'fred'),
    antenna: s(10) - 6,
    hiss: w(10, 'hiss'),
    pigeon: w(10, 'pigeon'),
    glowShot: s(11) - 6,
    afterglow: w(11, 'afterglow'),
    every: w(11, 'every'),
    news: s(12) - 6,
    letter: w(12, 'news'),
    page: s(13) - 6,
    bible: w(13, 'bible'),
    gen: s(14),
    genEnd: e(14),
    god: w(14, 'god'),
    dominoes: s(15) - 6,
    chain: w(15, 'everything'),
    cause: w(15, 'cause'),
    whyQ: w(16, 'caused'),
    boxes: s(17) - 6,
    outside: w(17, 'outside'),
    powerful: w(17, 'powerful'),
    notMade: w(17, 'not'),
    eternal: w(17, 'eternal'),
    burstShot: s(18) - 6,
    burst: s(18) + 2,
    worlds: w(18, 'worlds'),
    him: s(19) - 6,
    allThings: w(19, 'all'),
    cta: s(20) - 6,
    who: w(20, 'who'),
    typing: w(20, 'who') + 6,
  };
};
export type Anchors = ReturnType<typeof makeAnchors>;
