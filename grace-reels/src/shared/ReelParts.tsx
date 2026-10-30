// Reusable reel parts: word-synced caption track, end card and its tag line.
import React from 'react';
import {C, Caption, CrossLogo, FogPanel, Glow, GroundLine, Sky, pop, prog, progInOut} from '../kit-flat';
import {FONT_CAPTION, FONT_SERIF, FONT_UI} from '../kit-flat/fonts';
import type {TimelineIndex} from './timeline.ts';

/** Caption pages from the timeline; hides at the end card and shows page 1 (ghosted) for the loop. */
export const CaptionTrack: React.FC<{f: number; fps: number; T: TimelineIndex; endCard: number; loopStart: number; loopFrames: number}> = ({
  f,
  fps,
  T,
  endCard,
  loopStart,
  loopFrames,
}) => {
  const pages = T.pages();
  const t = f / fps;
  const lead = 0.12;
  if (f >= endCard) {
    const out = 1 - prog(f, endCard, 8);
    const loopIn = prog(f, loopStart, loopFrames - 2);
    return (
      <>
        {out > 0 ? <Caption words={pages[pages.length - 1].words} frame={f} fps={fps} opacity={out} /> : null}
        {loopIn > 0 ? <Caption words={pages[0].words} frame={-100} fps={fps} opacity={loopIn} /> : null}
      </>
    );
  }
  let idx = 0;
  for (let i = 0; i < pages.length; i++) if (t >= pages[i].start - lead) idx = i;
  const shownAt = Math.round((pages[idx].start - lead) * fps);
  const o = idx === 0 ? 1 : Math.min(1, (f - shownAt + 1) / 4);
  return <Caption key={idx} words={pages[idx].words} frame={f} fps={fps} opacity={o} />;
};

/** End card world (SVG): night, moon, self-drawing logo, title, handle. */
export const EndCardWorld: React.FC<{f: number; start: number}> = ({f, start}) => {
  const draw = progInOut(f, start + 4, 34);
  const title = pop(f, start + 26, 12);
  return (
    <g>
      <Sky kind="night" frame={f} moon={{x: 540, y: 420, r: 92}} />
      <FogPanel />
      <GroundLine />
      <Glow x={540} y={790} r={260} color="#FFD27A" opacity={0.45 * draw} />
      <CrossLogo x={560} y={790} scale={1.25} draw={draw} />
      <g transform={`translate(540,990) scale(${title})`}>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={84} letterSpacing={3} fill={C.ink} stroke={C.ink} strokeWidth={14} strokeLinejoin="round">
          GRACE IN MOTION
        </text>
        <text x={0} y={0} textAnchor="middle" fontFamily={FONT_SERIF} fontWeight={900} fontSize={84} letterSpacing={3} fill={C.cream}>
          GRACE IN MOTION
        </text>
      </g>
      <text x={540} y={1070} textAnchor="middle" fontFamily={FONT_UI} fontWeight={600} fontSize={40} fill={C.gold} opacity={prog(f, start + 34, 12)}>
        @GraceINMotion616
      </text>
    </g>
  );
};

/** End card tag line (HTML, on the fog). */
export const EndTag: React.FC<{opacity: number}> = ({opacity}) =>
  opacity <= 0 ? null : (
    <div style={{position: 'absolute', left: 0, width: 1080, top: 1385, transform: 'translateY(-50%)', textAlign: 'center', fontFamily: FONT_CAPTION, fontWeight: 700, fontSize: 58, color: C.captionInk, opacity}}>
      Hard questions. <span style={{color: C.gold}}>Bible answers.</span>
    </div>
  );

/** Comment box that types a line (HTML). */
export const TypingComment: React.FC<{text: string; chars: number; f: number; scale: number; opacity: number; top: number}> = ({text, chars, f, scale, opacity, top}) => {
  if (scale <= 0 || opacity <= 0) return null;
  const all = Array.from(text);
  const shown = all.slice(0, Math.floor(chars)).join('');
  const cursor = Math.floor(f / 15) % 2 === 0 || chars < all.length;
  return (
    <div style={{position: 'absolute', left: 540, top, width: 700, transform: `translate(-50%,-50%) scale(${scale})`, opacity, background: '#FFFDF8', border: `5px solid ${C.ink}`, borderRadius: 34, padding: '20px 28px', display: 'flex', alignItems: 'center', gap: 22, boxSizing: 'border-box'}}>
      <div style={{width: 66, height: 66, borderRadius: 33, background: C.youBlue, border: `4px solid ${C.ink}`, flexShrink: 0}} />
      <div style={{display: 'flex', flexDirection: 'column'}}>
        <div style={{fontFamily: FONT_UI, fontWeight: 600, fontSize: 24, color: '#8B8790'}}>you · now</div>
        <div style={{fontFamily: FONT_CAPTION, fontWeight: 700, fontSize: 42, color: C.captionInk, minHeight: 56, whiteSpace: 'nowrap'}}>
          {shown}
          <span style={{opacity: cursor ? 1 : 0, color: C.gold, fontWeight: 400}}>|</span>
        </div>
      </div>
    </div>
  );
};
