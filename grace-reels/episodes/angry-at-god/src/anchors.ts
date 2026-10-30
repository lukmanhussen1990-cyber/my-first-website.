// Every timed beat of "Angry at God?", derived from the voice timeline.
import {TimelineIndex, type Timeline} from '../../../src/shared/timeline.ts';

export const END_CARD_FRAMES = 90;
export const LOOP_FRAMES = 14;
export const XF = 12;

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
    howLong: 3,
    // S2
    scroll: s(2),
    stamp: w(2, 'bible'),
    // S3
    psalmLabel: s(3),
    b1: w(3, 'forget'),
    b2: w(4, 'hide'),
    b3: w(5, 'times'),
    b4: w(5, 'row'),
    // S4
    stack: s(6),
    honest: w(6, 'honest'),
    // S5–S8 Job
    job: s(7) - 6,
    jobLook: w(8, 'he'),
    complain: w(8, 'i'),
    friends: s(9) - 4,
    f1: w(9, 'friends'),
    f2: w(9, 'neat'),
    f3: w(9, 'fault'),
    light: w(10, 'god'),
    crack: w(10, 'friends'),
    card42: w(10, 'ye'),
    jobFill: w(10, 'right'),
    anger: w(11, 'anger'),
    honestMan: w(11, 'honest'),
    // S9–S10 cross
    cross: s(12) - 6,
    whyBubble: w(12, 'my'),
    jesusFill: w(12, 'why'),
    psalm22: s(13),
    psalm22Bang: w(13, 'psalm'),
    // S11
    sign: s(14) - 6,
    eph: w(14, 'be'),
    // S12
    away: s(15) - 6,
    silent: w(15, 'silent'),
    door: w(15, 'shutting'),
    danger: w(15, 'danger'),
    rewind: e(15) - 2,
    // S13–S14
    dawn: Math.max(s(16) - 4, e(15) + 18),
    morph: w(16, 'trusted') - 12,
    sing: s(17) - 6,
    singBubble: w(17, 'will'),
    // S15
    path: s(18) - 6,
    rather: w(18, 'rather'),
    loseYou: w(18, 'you'),
    pour: s(19),
    // S16
    cta: s(20) - 6,
    btnYes: w(20, 'yes'),
    typing: s(20) + 24,
  };
};
export type Anchors = ReturnType<typeof makeAnchors>;
export const TYPE_FRAMES = 34;
