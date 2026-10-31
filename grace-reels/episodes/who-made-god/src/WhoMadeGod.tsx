import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, C, StepCounter, loadFonts, pop, prog} from '../../../src/kit-flat';
import {CaptionTrack, EndCardWorld, EndTag, TypingComment} from '../../../src/shared/ReelParts.tsx';
import {A, TL} from './data.ts';
import {LOOP_FRAMES, TYPE_FRAMES, XF} from './anchors.ts';
import {
  AtoZWorld, BushWorld, CardsWorld, ChainWorld, CtaWorld, EverlastingWorld, KnowWorld, MadeYouWorld, OpeningWorld, PaintWorld, StableWorld,
  counterValue,
} from './scenes/Worlds.tsx';

loadFonts();

const COMMENT = 'It finally makes sense 🙏';
const blockIn = (f: number, from: number, to: number) => {
  if (f < from - XF / 2 || f >= to + XF / 2) return 0;
  if (from <= 0) return 1;
  return Math.min(1, (f - (from - XF / 2)) / XF);
};

export const WhoMadeGod: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loopStart = A.total - LOOP_FRAMES;
  const blocks: [number, number, React.ReactNode][] = [
    [0, A.cards, <OpeningWorld f={f} />],
    [A.cards, A.chain, <CardsWorld f={f} />],
    [A.chain, A.everlasting, <ChainWorld f={f} />],
    [A.everlasting, A.bush, <EverlastingWorld f={f} />],
    [A.bush, A.paint, <BushWorld f={f} />],
    [A.paint, A.aToZ, <PaintWorld f={f} />],
    [A.aToZ, A.born, <AtoZWorld f={f} />],
    [A.born, A.know, <StableWorld f={f} />],
    [A.know, A.madeYou, <KnowWorld f={f} />],
    [A.madeYou, A.cta, <MadeYouWorld f={f} />],
    [A.cta, A.endCard, <CtaWorld f={f} />],
    [A.endCard, A.total + 100, <EndCardWorld f={f} start={A.endCard} />],
  ];
  const loop = f >= loopStart ? prog(f, loopStart, LOOP_FRAMES - 2) : 0;
  const counter = blockIn(f, A.chain, A.everlasting) * prog(f, A.chain + 10, 10) * (1 - prog(f, A.rewind, 10));
  const val = counterValue(f);
  const prevVal = counterValue(f - 4);
  const ctaOn = blockIn(f, A.cta, A.endCard);
  const chars = Math.max(0, Math.min(1, (f - A.typing) / TYPE_FRAMES)) * Array.from(COMMENT).length;
  const onLight = (f >= A.cards && f < A.chain) || (f >= A.paint && f < A.aToZ) || (f >= A.know && f < A.madeYou);
  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      {TL.audio ? <Audio src={staticFile(TL.audio)} /> : null}
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {blocks.map(([from, to, node], i) => {
          const o = blockIn(f, from, to);
          return o > 0 ? (
            <g key={i} opacity={o}>
              {node}
            </g>
          ) : null;
        })}
        {loop > 0 ? (
          <g opacity={loop}>
            <OpeningWorld f={0} />
          </g>
        ) : null}
        {counter > 0 ? <StepCounter value={val} opacity={counter} roll={val !== prevVal ? 0.5 : 0} /> : null}
      </svg>
      <TypingComment text={COMMENT} chars={chars} f={f} top={660} scale={pop(f, A.typing - 10, 10)} opacity={ctaOn * (1 - prog(f, A.endCard - XF / 2, XF))} />
      <CaptionTrack f={f} fps={fps} T={A.T} endCard={A.endCard} loopStart={loopStart} loopFrames={LOOP_FRAMES} />
      <EndTag opacity={f >= A.endCard ? prog(f, A.endCard + 40, 12) * (1 - loop) : 0} />
      <Brand onLight={onLight} />
    </AbsoluteFill>
  );
};

export const WHO_FRAMES = A.total;
