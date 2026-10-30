import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, C, EvidenceRow, loadFonts, pop, prog} from '../../../src/kit-flat';
import {CaptionTrack, EndCardWorld, EndTag, TypingComment} from '../../../src/shared/ReelParts.tsx';
import {A, TL} from './data.ts';
import {LOOP_FRAMES, TYPE_FRAMES, XF} from './anchors.ts';
import {
  AfterglowWorld, AntennaWorld, BibleWorld, BoardWorld, BoxesWorld, BurstWorld, CtaWorld, DominoWorld, EinsteinWorld, GalaxyBackdrop,
  HimWorld, NewsWorld, ObservatoryWorld, OpeningWorld, RadioWorld, RewindWorld,
} from './scenes/Worlds.tsx';

loadFonts();

const COMMENT = 'God 🙏✨';
const blockIn = (f: number, from: number, to: number) => {
  if (f < from - XF / 2 || f >= to + XF / 2) return 0;
  if (from <= 0) return 1;
  return Math.min(1, (f - (from - XF / 2)) / XF);
};

export const TheBeginning: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loopStart = A.total - LOOP_FRAMES;
  const blocks: [number, number, React.ReactNode][] = [
    [0, A.board, <OpeningWorld f={f} />],
    [A.board, A.rewindShot, <BoardWorld f={f} />],
    [A.rewindShot, A.einstein, <RewindWorld f={f} />],
    [A.einstein, A.obs, <EinsteinWorld f={f} />],
    [A.obs, A.radio, <ObservatoryWorld f={f} />],
    [A.radio, A.antenna, <RadioWorld f={f} />],
    [A.antenna, A.glowShot, <AntennaWorld f={f} />],
    [A.glowShot, A.news, <AfterglowWorld f={f} />],
    [A.news, A.page, <NewsWorld f={f} />],
    [A.page, A.dominoes, <BibleWorld f={f} />],
    [A.dominoes, A.boxes, <DominoWorld f={f} />],
    [A.boxes, A.burstShot, <BoxesWorld f={f} />],
    [A.burstShot, A.him, <BurstWorld f={f} />],
    [A.him, A.cta, <HimWorld f={f} />],
    [A.cta, A.endCard, <CtaWorld f={f} />],
    [A.endCard, A.total + 100, <g><EndCardWorld f={f} start={A.endCard} /><GalaxyBackdrop f={f} /></g>],
  ];
  const loop = f >= loopStart ? prog(f, loopStart, LOOP_FRAMES - 2) : 0;
  const rowOpacity = prog(f, A.rowIn, 12) * (1 - prog(f, A.endCard - XF / 2, XF));
  const ctaOn = blockIn(f, A.cta, A.endCard);
  const chars = Math.max(0, Math.min(1, (f - A.typing) / TYPE_FRAMES)) * Array.from(COMMENT).length;
  const onLight = (f >= A.antenna && f < A.glowShot) || (f >= A.page && f < A.dominoes);
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
        {rowOpacity > 0 ? <EvidenceRow frame={f} opacity={rowOpacity} fills={[A.expanding, A.apart, A.afterglow]} unlock={A.god} /> : null}
      </svg>
      <TypingComment text={COMMENT} chars={chars} f={f} top={700} scale={pop(f, A.typing - 10, 10)} opacity={ctaOn * (1 - prog(f, A.endCard - XF / 2, XF))} />
      <CaptionTrack f={f} fps={fps} T={A.T} endCard={A.endCard} loopStart={loopStart} loopFrames={LOOP_FRAMES} />
      <EndTag opacity={f >= A.endCard ? prog(f, A.endCard + 40, 12) * (1 - loop) : 0} />
      <Brand onLight={onLight} />
    </AbsoluteFill>
  );
};

export const BEGINNING_FRAMES = A.total;
