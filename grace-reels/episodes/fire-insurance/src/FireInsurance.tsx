import React from 'react';
import {AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Brand, C, Caption, FearLoveMeter, loadFonts, prog} from '../../../src/kit-flat';
import {A, TL} from './data.ts';
import {LOOP_FRAMES, XF, meterState} from './anchors.ts';
import {OpeningWorld} from './scenes/Opening.tsx';
import {StormSequence} from './scenes/Storm.tsx';
import {PathSequence} from './scenes/Path.tsx';
import {CtaHtml, CtaWorld, EndCardWorld, SendWorld, endTagOpacity} from './scenes/Ending.tsx';

loadFonts();

const PAGES = A.T.pages();

/** Opacity of a block that starts at `from` (crossfade in) and ends at `to`. */
const blockIn = (f: number, from: number, to: number) => {
  if (f < from - XF / 2 || f >= to + XF / 2) return 0;
  if (from <= 0) return 1;
  return Math.min(1, (f - (from - XF / 2)) / XF);
};

const CaptionLayer: React.FC<{f: number; fps: number}> = ({f, fps}) => {
  const t = f / fps;
  const lead = 0.12;
  let idx = -1;
  for (let i = 0; i < PAGES.length; i++) if (t >= PAGES[i].start - lead || i === 0) idx = i;
  const loopStart = A.total - LOOP_FRAMES;
  if (f >= A.endCard) {
    const fadeOut = 1 - prog(f, A.endCard, 8);
    const loopIn = prog(f, loopStart, LOOP_FRAMES - 2);
    return (
      <>
        {fadeOut > 0 ? <Caption words={PAGES[PAGES.length - 1].words} frame={f} fps={fps} opacity={fadeOut} /> : null}
        {loopIn > 0 ? <Caption words={PAGES[0].words} frame={-100} fps={fps} opacity={loopIn} /> : null}
      </>
    );
  }
  const page = PAGES[idx];
  const shownAt = Math.round((page.start - lead) * fps);
  const o = idx === 0 ? 1 : Math.min(1, (f - shownAt + 1) / 4);
  return <Caption key={idx} words={page.words} frame={f} fps={fps} opacity={o} />;
};

export const FireInsurance: React.FC = () => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const m = meterState(A, f);
  const loopStart = A.total - LOOP_FRAMES;

  const opening = blockIn(f, 0, A.storm);
  const storm = blockIn(f, A.storm, A.dawn);
  const path = blockIn(f, A.dawn, A.cta);
  const cta = blockIn(f, A.cta, A.send);
  const send = blockIn(f, A.send, A.endCard);
  const end = blockIn(f, A.endCard, A.total + 100);
  const loop = f >= loopStart ? prog(f, loopStart, LOOP_FRAMES - 2) : 0;

  const meterOpacity =
    f < A.cta + XF / 2
      ? prog(f, A.meterIn, 12) * (1 - prog(f, A.cta - XF / 2, XF))
      : prog(f, A.send - XF / 2, XF) * (1 - prog(f, A.endCard - XF / 2, XF));
  const burst = prog(f, A.loved, 18) * (1 - prog(f, A.loved + 18, 24));
  const onLight = (f >= A.dawn && f < A.cta) || (f >= A.send && f < A.endCard);

  return (
    <AbsoluteFill style={{backgroundColor: C.fogMid}}>
      {TL.audio ? <Audio src={staticFile(TL.audio)} /> : null}
      <svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{position: 'absolute', inset: 0}}>
        {opening > 0 ? <OpeningWorld frame={f} /> : null}
        {storm > 0 ? (
          <g opacity={storm}>
            <StormSequence f={f} />
          </g>
        ) : null}
        {path > 0 ? (
          <g opacity={path}>
            <PathSequence f={f} />
          </g>
        ) : null}
        {cta > 0 ? (
          <g opacity={cta}>
            <CtaWorld f={f} />
          </g>
        ) : null}
        {send > 0 ? (
          <g opacity={send}>
            <SendWorld f={f} />
          </g>
        ) : null}
        {end > 0 ? (
          <g opacity={end}>
            <EndCardWorld f={f} />
          </g>
        ) : null}
        {loop > 0 ? (
          <g opacity={loop}>
            <OpeningWorld frame={0} still />
          </g>
        ) : null}
        {meterOpacity > 0 ? <FearLoveMeter value={m.value} shake={m.shake} frame={f} opacity={meterOpacity} burst={burst} /> : null}
      </svg>
      {cta > 0 ? <CtaHtml f={f} opacity={cta * (1 - send)} /> : null}
      <CaptionLayer f={f} fps={fps} />
      {end > 0 && loop < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: 1080,
            top: 1385,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontWeight: 700,
            fontSize: 58,
            color: C.captionInk,
            opacity: endTagOpacity(f) * (1 - loop),
          }}
        >
          Hard questions. <span style={{color: C.gold}}>Bible answers.</span>
        </div>
      ) : null}
      <Brand onLight={onLight} />
    </AbsoluteFill>
  );
};

export const FIRE_INSURANCE_FRAMES = A.total;
