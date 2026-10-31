// Every timed beat of "Who Made God?", from the voice timeline.
import {TimelineIndex, type Timeline} from '../../../src/shared/timeline.ts';

export const END_CARD_FRAMES = 90;
export const LOOP_FRAMES = 14;
export const XF = 12;
export const TYPE_FRAMES = 34;

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
    q: 3,
    chess: s(2) - 4,
    piece: w(2, 'question'),
    checkmate: w(2, 'debate'),
    watch: w(2, 'watch'),
    cards: s(3) - 6,
    phone: w(3, 'phone'),
    house: w(3, 'house'),
    baby: w(3, 'you', 1),
    heb: w(3, 'beginning'),
    arrows: s(4),
    caused: w(4, 'caused'),
    chain: s(5) - 6,
    space: s(6) - 4,
    earth: w(6, 'earth'),
    stars: w(6, 'stars'),
    forever: s(7) - 2,
    fall: w(7, 'nothing'),
    rewind: s(8) - 6,
    neverMade: w(8, 'made'),
    neverBegan: w(8, 'began'),
    everlasting: s(9) - 6,
    psalm: w(9, 'from'),
    bush: s(10) - 6,
    iamBubble: w(10, 'i'),
    iamCard: w(10, 'am', 1),
    just: s(11) - 2,
    x1: w(11, 'made'),
    x2: w(11, 'began'),
    check: w(11, 'am'),
    paint: s(12) - 6,
    paintBubble: w(12, 'painting'),
    painterBang: w(12, 'painter'),
    notGod: s(13) - 2,
    notGodGold: w(13, 'he'),
    aToZ: s(14) - 6,
    alpha: w(14, 'alpha'),
    revCard: w(14, 'beginning'),
    az: w(14, 'z'),
    born: s(15) - 6,
    flesh: w(15, 'word'),
    know: s(16) - 6,
    knowWord: w(16, 'know'),
    madeYou: s(17) - 6,
    noOne: w(17, 'no'),
    heMade: w(17, 'made', 1),
    youWord: w(17, 'you'),
    cta: s(18) - 6,
    btnYes: w(18, 'yes'),
    typing: s(18) + 20,
    voice6End: e(6),
  };
};
export type Anchors = ReturnType<typeof makeAnchors>;
