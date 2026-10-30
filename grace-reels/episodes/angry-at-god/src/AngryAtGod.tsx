import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, C, PrayerRow, loadFonts, pop, prog} from '../../../src/kit-flat';
import {CaptionTrack, EndCardWorld, EndTag, TypingComment} from '../../../src/shared/ReelParts.tsx';
import {A, TL} from './data.ts';
import {LOOP_FRAMES, TYPE_FRAMES, XF} from './anchors.ts';
import {AwayWorld, CrossWorld, CtaWorld, DavidNight, DawnWorld, JobWorld, PathWorld, SignWorld} from './scenes/Worlds.tsx';

loadFonts();

const COMMENT = 'Yes… but I’m still here 🙏';
const blockIn = (f: number, from: number, to: number) => {
  if (f < from - XF / 2 || f >= to + XF / 2) return 0;
  if (from <= 0) return 1;
  return Math.min(1, (f - (from - XF / 2)) / XF);
};

export const AngryAtGod: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const loopStart = A.total - LOOP_FRAMES;
  const blocks: [number, number, React.ReactNode][] = [
    [0, A.job, <DavidNight f={f} />],
    [A.job, A.cross, <JobWorld f={f} />],
    [A.cross, A.sign, <CrossWorld f={f} />],
    [A.sign, A.away, <SignWorld f={f} />],
    [A.away, A.dawn, <AwayWorld f={f} />],
    [A.dawn, A.sing, <DawnWorld f={f} singing={false} />],
    [A.sing, A.path, <DawnWorld f={f} singing />],
    [A.path, A.cta, <PathWorld f={f} />],
    [A.cta, A.endCard, <CtaWorld f={f} />],
    [A.endCard, A.total + 100, <EndCardWorld f={f} start={A.endCard} />],
  ];
  const loop = f >= loopStart ? prog(f, loopStart, LOOP_FRAMES - 2) : 0;
  const rowOpacity = prog(f, A.rowIn, 12) * (1 - prog(f, A.endCard - XF / 2, XF));
  const ctaOn = blockIn(f, A.cta, A.endCard);
  const chars = Math.max(0, Math.min(1, (f - A.typing) / TYPE_FRAMES)) * Array.from(COMMENT).length;
  const onLight = (f >= A.job && f < A.cross) || (f >= A.dawn + 30 && f < A.cta);
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
            <DavidNight f={0} />
          </g>
        ) : null}
        {rowOpacity > 0 ? <PrayerRow frame={f} opacity={rowOpacity} fills={[A.honest, A.jobFill, A.jesusFill, A.typing + TYPE_FRAMES]} /> : null}
      </svg>
      <TypingComment text={COMMENT} chars={chars} f={f} top={660} scale={pop(f, A.typing - 10, 10)} opacity={ctaOn * (1 - prog(f, A.endCard - XF / 2, XF))} />
      <CaptionTrack f={f} fps={fps} T={A.T} endCard={A.endCard} loopStart={loopStart} loopFrames={LOOP_FRAMES} />
      <EndTag opacity={f >= A.endCard ? prog(f, A.endCard + 40, 12) * (1 - loop) : 0} />
      <Brand onLight={onLight} />
    </AbsoluteFill>
  );
};

export const ANGRY_FRAMES = A.total;
